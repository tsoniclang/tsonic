/**
 * Reference type conversion
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as ts from "typescript";
import { IrType, IrDictionaryType, IrInterfaceMember } from "../../../types.js";
import { substituteIrType } from "../../../types/ir-substitution.js";
import type { DeclId } from "../../../type-system/types.js";
import { tsbindgenClrTypeNameToTsTypeName } from "../../../../tsbindgen/names.js";
import {
  isPrimitiveTypeName,
  getPrimitiveType,
  isClrPrimitiveTypeName,
  getClrPrimitiveType,
  CLR_PRIMITIVE_TYPE_SET,
} from "./primitives.js";
import { convertFunctionType } from "./functions.js";
import {
  isExpandableUtilityType,
  expandUtilityType,
  isExpandableConditionalUtilityType,
  expandConditionalUtilityType,
  expandRecordType,
} from "./utility-types.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";

/**
 * tsbindgen emits qualified names for core System primitives inside internal
 * extension bucket signatures, e.g. `System_Internal.Boolean`.
 *
 * For IR purposes these must canonicalize to the compiler's surface primitive
 * / numeric alias names so:
 * - deterministic lambda typing can use `boolean`/`int` etc
 * - the IR soundness gate does not treat these as unresolved reference types
 *
 * This is NOT a workaround: it is the correct boundary translation from the
 * tsbindgen surface name to Tsonic's canonical IR type names.
 */
const normalizeSystemInternalQualifiedName = (typeName: string): string => {
  const prefix = "System_Internal.";
  if (!typeName.startsWith(prefix)) return typeName;

  const inner = typeName.slice(prefix.length);
  const mapped = (() => {
    switch (inner) {
      // TS primitives
      case "Boolean":
        return "boolean";
      case "String":
        return "string";
      case "Char":
        return "char";

      // Distinct CLR numeric aliases (from @tsonic/core)
      case "SByte":
        return "sbyte";
      case "Byte":
        return "byte";
      case "Int16":
        return "short";
      case "UInt16":
        return "ushort";
      case "Int32":
        return "int";
      case "UInt32":
        return "uint";
      case "Int64":
        return "long";
      case "UInt64":
        return "ulong";
      case "Int128":
        return "int128";
      case "UInt128":
        return "uint128";
      case "Half":
        return "half";
      case "Single":
        return "float";
      case "Double":
        return "double";
      case "Decimal":
        return "decimal";
      case "IntPtr":
        return "nint";
      case "UIntPtr":
        return "nuint";

      default:
        return undefined;
    }
  })();

  // If we don't recognize the alias, strip the namespace import prefix and
  // keep the exported type name (e.g. System_Internal.Exception -> Exception).
  return mapped ?? inner;
};

/**
 * tsbindgen extension bucket files import namespaces as `System_Collections_Generic`, etc,
 * then reference types via qualified names like `System_Collections_Generic.List_1`.
 *
 * For IR purposes we must canonicalize these to their simple TS export names
 * (e.g., `List_1`) so they resolve through the binding registry.
 */
const normalizeNamespaceAliasQualifiedName = (typeName: string): string => {
  const lastDot = typeName.lastIndexOf(".");
  if (lastDot <= 0) return typeName;

  const prefix = typeName.slice(0, lastDot);
  // Strip facade-local internal namespace alias: `Internal.Foo` → `Foo`.
  if (prefix === "Internal") {
    return typeName.slice(lastDot + 1);
  }
  // Only strip tsbindgen namespace-alias qualifiers (they contain underscores).
  if (!prefix.includes("_")) return typeName;

  return typeName.slice(lastDot + 1);
};

const isSymbolTypeReferenceNode = (node: ts.TypeNode): boolean =>
  ts.isTypeReferenceNode(node) &&
  ts.isIdentifier(node.typeName) &&
  node.typeName.text === "symbol";

const classifyDictionaryKeyTypeNode = (
  keyTypeNode: ts.TypeNode,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType,
  binding: Binding
): IrType | undefined => {
  const keyNodes = ts.isUnionTypeNode(keyTypeNode)
    ? keyTypeNode.types
    : [keyTypeNode];

  let sawString = false;
  let sawNumber = false;
  let sawSymbol = false;

  for (const node of keyNodes) {
    if (node.kind === ts.SyntaxKind.StringKeyword) {
      sawString = true;
      continue;
    }
    if (node.kind === ts.SyntaxKind.NumberKeyword) {
      sawNumber = true;
      continue;
    }
    if (
      node.kind === ts.SyntaxKind.SymbolKeyword ||
      isSymbolTypeReferenceNode(node)
    ) {
      sawSymbol = true;
      continue;
    }
    return undefined;
  }

  const distinctKinds =
    (sawString ? 1 : 0) + (sawNumber ? 1 : 0) + (sawSymbol ? 1 : 0);

  if (distinctKinds === 0) {
    return undefined;
  }

  if (distinctKinds > 1 || sawSymbol) {
    return { kind: "referenceType", name: "object" };
  }

  if (sawNumber) {
    return convertType(
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
      binding
    );
  }

  return convertType(
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    binding
  );
};

/**
 * Per-binding caches for structural extraction and alias-body expansion.
 *
 * Airplane-grade determinism requirement:
 * - Cache lifetime MUST be scoped to one compilation context.
 * - DeclId numeric handles are stable only within a binding universe.
 * - Cross-program cache reuse can silently miscompile types.
 *
 * We use WeakMap<Binding, ...> to isolate caches per program/binding graph.
 */
type StructuralMembersCache = Map<
  number,
  readonly IrInterfaceMember[] | null | "in-progress"
>;

type TypeAliasBodyCache = Map<number, IrType | "in-progress">;

const structuralMembersCacheByBinding = new WeakMap<
  Binding,
  StructuralMembersCache
>();

const typeAliasBodyCacheByBinding = new WeakMap<Binding, TypeAliasBodyCache>();

const getStructuralMembersCache = (
  binding: Binding
): StructuralMembersCache => {
  let cache = structuralMembersCacheByBinding.get(binding);
  if (!cache) {
    cache = new Map<
      number,
      readonly IrInterfaceMember[] | null | "in-progress"
    >();
    structuralMembersCacheByBinding.set(binding, cache);
  }
  return cache;
};

const getTypeAliasBodyCache = (binding: Binding): TypeAliasBodyCache => {
  let cache = typeAliasBodyCacheByBinding.get(binding);
  if (!cache) {
    cache = new Map<number, IrType | "in-progress">();
    typeAliasBodyCacheByBinding.set(binding, cache);
  }
  return cache;
};

/**
 * Check whether a declaration file is a Tsonic-generated bindings artifact.
 *
 * We only apply aggressive declaration-file type-alias erasure to these files.
 * Airplane-grade rule: Never erase type aliases from tsbindgen-produced stdlib
 * packages (e.g., @tsonic/dotnet, @tsonic/core). Those aliases often encode CLR
 * nominal types (interfaces, delegates, indexers) and must remain NOMINAL.
 */
const isTsonicBindingsDeclarationFile = (fileName: string): boolean => {
  // Cross-platform: handle both POSIX and Windows paths.
  return (
    fileName.includes("/tsonic/bindings/") ||
    fileName.includes("\\tsonic\\bindings\\")
  );
};

const bindingAliasClrIdentityCache = new Map<
  string,
  ReadonlyMap<string, string>
>();

const findOwningBindingsJson = (fileName: string): string | undefined => {
  let currentDir = dirname(fileName);
  while (true) {
    const candidate = join(currentDir, "bindings.json");
    if (existsSync(candidate)) return candidate;

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  if (fileName.endsWith(".d.ts")) {
    const baseName = fileName.slice(0, -".d.ts".length);
    const lastSep = Math.max(
      baseName.lastIndexOf("/"),
      baseName.lastIndexOf("\\")
    );
    const stem = lastSep >= 0 ? baseName.slice(lastSep + 1) : baseName;
    if (stem.length > 0) {
      const sibling = join(dirname(fileName), stem, "bindings.json");
      if (existsSync(sibling)) return sibling;
    }
  }

  return undefined;
};

const buildBindingAliasClrIdentityMap = (
  bindingsPath: string
): ReadonlyMap<string, string> => {
  const cached = bindingAliasClrIdentityCache.get(bindingsPath);
  if (cached) return cached;

  const aliasToClr = new Map<string, string>();

  try {
    const raw = JSON.parse(readFileSync(bindingsPath, "utf-8")) as unknown;
    if (
      raw &&
      typeof raw === "object" &&
      Array.isArray((raw as { readonly types?: unknown }).types)
    ) {
      for (const type of (raw as { readonly types: readonly unknown[] })
        .types) {
        if (!type || typeof type !== "object") continue;
        const clrName = (type as { readonly clrName?: unknown }).clrName;
        if (typeof clrName !== "string" || clrName.trim().length === 0)
          continue;

        const tsAlias = tsbindgenClrTypeNameToTsTypeName(clrName);
        const lastDot = clrName.lastIndexOf(".");
        if (lastDot <= 0) continue;

        const namespace = clrName.slice(0, lastDot);
        aliasToClr.set(`${namespace}.${tsAlias}`, clrName);
      }
    }
  } catch {
    // Fall through to the conservative fallback.
  }

  bindingAliasClrIdentityCache.set(bindingsPath, aliasToClr);
  return aliasToClr;
};

const resolveSourceBindingsClrIdentity = (
  declId: DeclId | undefined,
  binding: Binding
): string | undefined => {
  if (!declId) return undefined;
  const declInfo = (binding as BindingInternal)
    ._getHandleRegistry()
    .getDecl(declId);
  const declNode = (declInfo?.typeDeclNode ?? declInfo?.declNode) as
    | ts.Declaration
    | undefined;
  if (!declNode) return undefined;
  if (!declNode.getSourceFile().isDeclarationFile) return undefined;
  if (!isTsonicBindingsDeclarationFile(declNode.getSourceFile().fileName)) {
    return undefined;
  }

  const fqName = declInfo?.fqName?.trim();
  if (!fqName || !fqName.includes(".")) return undefined;

  const bindingsPath = findOwningBindingsJson(
    declNode.getSourceFile().fileName
  );
  if (bindingsPath) {
    const exactClrName =
      buildBindingAliasClrIdentityMap(bindingsPath).get(fqName);
    if (exactClrName) return exactClrName;
  }

  return fqName;
};

/**
 * Determine whether a TS-only type alias target is safe to erase to its underlying shape.
 *
 * We ONLY erase aliases whose targets are "reference-shaped" (type references / intersections
 * / primitives / arrays, etc.). We intentionally DO NOT erase:
 * - Union aliases (discriminated unions rely on the alias identity across lowering)
 * - Tuple aliases (tuple alias resolution is handled via emitter-side type-alias resolution)
 * - Type-literal aliases (structural alias → __Alias class; handled separately)
 *
 * This preserves the established lowering contracts while still enabling deterministic
 * receiver-driven generic inference for aliases like:
 *   type LinqList<T> = Linq<List<T>>;
 */
const isSafeToEraseUserTypeAliasTarget = (node: ts.TypeNode): boolean => {
  // Peel parentheses (e.g., type X = (Y))
  while (ts.isParenthesizedTypeNode(node)) {
    node = node.type;
  }

  if (ts.isTypeLiteralNode(node)) return false;
  if (ts.isUnionTypeNode(node)) return false;
  if (ts.isTupleTypeNode(node)) return false;

  return true;
};

/**
 * Check if a declaration should have structural members extracted.
 *
 * Only extract for:
 * - Interfaces (InterfaceDeclaration)
 * - Type aliases to object types (TypeAliasDeclaration with TypeLiteralNode)
 *
 * Do NOT extract for:
 * - Classes (have implementation, not just shape)
 * - Enums, namespaces
 * - Library types (from node_modules or lib.*.d.ts)
 * - Type aliases to primitives, unions, functions, etc.
 */
const shouldExtractFromDeclaration = (decl: ts.Declaration): boolean => {
  const sourceFile = decl.getSourceFile();
  const fileName = sourceFile.fileName;
  const isSourceBindingsDecl =
    sourceFile.isDeclarationFile && isTsonicBindingsDeclarationFile(fileName);

  // Skip library types (node_modules, lib.*.d.ts, or declaration files)
  if (
    fileName.includes("node_modules") ||
    fileName.includes("lib.") ||
    (sourceFile.isDeclarationFile && !isSourceBindingsDecl)
  ) {
    return false;
  }

  // Only extract for interfaces
  if (ts.isInterfaceDeclaration(decl)) {
    return true;
  }

  // Only extract for type aliases that resolve to object types
  if (ts.isTypeAliasDeclaration(decl)) {
    // Check if the alias is to an object type (TypeLiteral)
    return ts.isTypeLiteralNode(decl.type);
  }

  // Class instance members can participate in deterministic contextual typing
  // even when the consuming module never imports the class directly (for example
  // callback parameter types inferred from an imported query surface). Preserve
  // the public instance shape so the soundness gate and member typing can see
  // the real class members without weakening to `any`.
  if (ts.isClassDeclaration(decl)) {
    return true;
  }

  // Don't extract for enums, etc.
  return false;
};

/**
 * Extract structural members from type declarations (AST-based).
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Uses AST nodes directly instead of ts.Type computation.
 * Gets TypeNodes from declarations, not from getTypeOfSymbolAtLocation.
 *
 * Used to populate structuralMembers on referenceType for interfaces, object type aliases,
 * and public instance class surfaces.
 * This enables TSN5110 validation for object literal properties against expected types,
 * and preserves deterministic member typing for nominal classes used structurally across
 * callback/contextual-typing boundaries.
 *
 * Safety guards:
 * - Only extracts for interfaces/type-aliases/public instance classes (not enums/lib types)
 * - Uses cache to prevent infinite recursion on recursive types
 * - Skips unsupported keys instead of bailing entirely
 * - Returns undefined for index signatures (can't fully represent)
 *
 * @param declId - The DeclId for the type (from Binding.resolveTypeReference)
 * @param binding - The Binding layer for symbol resolution
 * @param convertType - Function to convert nested types
 * @returns Structural members or undefined if extraction fails/skipped
 */
const extractStructuralMembersFromDeclarations = (
  declId: number | undefined,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): readonly IrInterfaceMember[] | undefined => {
  if (declId === undefined) {
    return undefined;
  }

  // Check cache first (handles recursion)
  const structuralMembersCache = getStructuralMembersCache(binding);
  const cached = structuralMembersCache.get(declId);
  if (cached === "in-progress") {
    // Recursive reference - return undefined to break cycle
    return undefined;
  }
  if (cached !== undefined) {
    return cached === null ? undefined : cached;
  }

  // Get declaration info from HandleRegistry
  const registry = (binding as BindingInternal)._getHandleRegistry();
  const declInfo = registry.getDecl({ id: declId, __brand: "DeclId" } as never);
  if (!declInfo?.declNode) {
    structuralMembersCache.set(declId, null);
    return undefined;
  }

  const decl = declInfo.declNode as ts.Declaration;

  // Check if this declaration should have structural members extracted
  if (!shouldExtractFromDeclaration(decl)) {
    structuralMembersCache.set(declId, null);
    return undefined;
  }

  // Mark as in-progress before recursing.
  structuralMembersCache.set(declId, "in-progress");

  try {
    const members: IrInterfaceMember[] = [];
    const accessorGroups = new Map<
      string,
      {
        getter?: ts.GetAccessorDeclaration;
        setter?: ts.SetAccessorDeclaration;
      }
    >();

    const getModifiers = (
      node: ts.Node
    ): readonly ts.ModifierLike[] | undefined =>
      ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;

    const hasModifier = (
      modifiers: readonly ts.ModifierLike[] | undefined,
      kind: ts.SyntaxKind
    ): boolean => modifiers?.some((m) => m.kind === kind) ?? false;

    const isPublicInstanceClassMember = (member: ts.ClassElement): boolean => {
      if (ts.isConstructorDeclaration(member)) return false;
      const modifiers = getModifiers(member);
      if (hasModifier(modifiers, ts.SyntaxKind.StaticKeyword)) {
        return false;
      }
      if (
        hasModifier(modifiers, ts.SyntaxKind.PrivateKeyword) ||
        hasModifier(modifiers, ts.SyntaxKind.ProtectedKeyword)
      ) {
        return false;
      }
      if ("name" in member && member.name && ts.isPrivateIdentifier(member.name)) {
        return false;
      }
      return true;
    };

    const getMemberName = (
      name: ts.PropertyName | ts.PrivateIdentifier | undefined
    ): string | undefined => {
      if (!name) return undefined;
      if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
        return name.text;
      }
      return undefined;
    };

    // Get the member source (interface members, type literal members, or class members)
    const typeElements = ts.isInterfaceDeclaration(decl)
      ? decl.members
      : ts.isTypeAliasDeclaration(decl) && ts.isTypeLiteralNode(decl.type)
        ? decl.type.members
        : ts.isClassDeclaration(decl)
          ? decl.members
        : undefined;

    if (!typeElements) {
      structuralMembersCache.set(declId, null);
      return undefined;
    }

    // Check for index signatures - can't fully represent these structurally
    for (const member of typeElements) {
      if (ts.isIndexSignatureDeclaration(member)) {
        structuralMembersCache.set(declId, null);
        return undefined;
      }
    }

    // Extract members from AST (TypeNodes directly)
    for (const member of typeElements) {
      if (
        ts.isGetAccessorDeclaration(member) ||
        ts.isSetAccessorDeclaration(member)
      ) {
        if (ts.isClassDeclaration(decl) && !isPublicInstanceClassMember(member)) {
          continue;
        }

        const accessorName = getMemberName(member.name);

        if (
          !accessorName ||
          accessorName.startsWith("__tsonic_type_") ||
          accessorName.startsWith("__tsonic_binding_alias_")
        ) {
          continue;
        }

        const existing = accessorGroups.get(accessorName) ?? {};
        if (ts.isGetAccessorDeclaration(member)) {
          existing.getter = member;
        } else {
          existing.setter = member;
        }
        accessorGroups.set(accessorName, existing);
        continue;
      }

      // Property signature / declaration
      if (ts.isPropertySignature(member) || ts.isPropertyDeclaration(member)) {
        if (ts.isPropertyDeclaration(member) && !isPublicInstanceClassMember(member)) {
          continue;
        }

        const propName = getMemberName(member.name);

        if (
          !propName ||
          propName.startsWith("__tsonic_type_") ||
          propName.startsWith("__tsonic_binding_alias_")
        ) {
          continue; // Skip computed/symbol keys
        }

        const isOptional = !!member.questionToken;
        const isReadonly = hasModifier(
          getModifiers(member),
          ts.SyntaxKind.ReadonlyKeyword
        );

        // DETERMINISTIC: Get type from TypeNode in declaration
        const declTypeNode = member.type;
        if (!declTypeNode) {
          continue; // Skip properties without type annotation
        }

        // Check for CLR primitive type aliases
        if (ts.isTypeReferenceNode(declTypeNode)) {
          const typeName = ts.isIdentifier(declTypeNode.typeName)
            ? declTypeNode.typeName.text
            : undefined;
          if (typeName && CLR_PRIMITIVE_TYPE_SET.has(typeName)) {
            // Resolve to check it comes from @tsonic/core (symbol-based, allowed)
            // Use Binding to resolve the type reference
            const typeRefDeclId = binding.resolveTypeReference(declTypeNode);
            if (typeRefDeclId) {
              const typeRefDeclInfo = registry.getDecl(typeRefDeclId);
              const refDeclNode = typeRefDeclInfo?.declNode as
                | ts.Declaration
                | undefined;
              const refSourceFile = refDeclNode?.getSourceFile();
              if (refSourceFile?.fileName.includes("@tsonic/core")) {
                members.push({
                  kind: "propertySignature",
                  name: propName,
                  type: getClrPrimitiveType(typeName as "int" | "char"),
                  isOptional,
                  isReadonly,
                });
                continue;
              }
            }
          }
        }

        // Convert the TypeNode to IrType
        members.push({
          kind: "propertySignature",
          name: propName,
          type: convertType(declTypeNode, binding),
          isOptional,
          isReadonly,
        });
      }

      // Method signature / declaration
      if (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) {
        if (ts.isMethodDeclaration(member) && !isPublicInstanceClassMember(member)) {
          continue;
        }

        const methodName = getMemberName(member.name);

        if (!methodName) {
          continue; // Skip computed keys
        }

        members.push({
          kind: "methodSignature",
          name: methodName,
          parameters: member.parameters.map((param, index) => ({
            kind: "parameter" as const,
            pattern: {
              kind: "identifierPattern" as const,
              name: ts.isIdentifier(param.name)
                ? param.name.text
                : `arg${index}`,
            },
            type: param.type ? convertType(param.type, binding) : undefined,
            isOptional: !!param.questionToken,
            isRest: !!param.dotDotDotToken,
            passing: "value" as const,
          })),
          returnType: member.type
            ? convertType(member.type, binding)
            : undefined,
        });
      }
    }

    for (const [memberName, pair] of accessorGroups) {
      const getterTypeNode = pair.getter?.type;
      const setterTypeNode = pair.setter?.parameters[0]?.type;
      const propertyTypeNode = getterTypeNode ?? setterTypeNode;

      if (!propertyTypeNode) {
        continue;
      }

      members.push({
        kind: "propertySignature",
        name: memberName,
        type: convertType(propertyTypeNode, binding),
        isOptional: false,
        isReadonly: !!pair.getter && !pair.setter,
      });
    }

    const result = members.length > 0 ? members : undefined;
    structuralMembersCache.set(declId, result ?? null);
    return result;
  } catch {
    // On any error, settle cache to null (not extractable)
    structuralMembersCache.set(declId, null);
    return undefined;
  }
};

/**
 * Convert TypeScript type reference to IR type
 * Handles both primitive type names and user-defined types
 */
export const convertTypeReference = (
  node: ts.TypeReferenceNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType => {
  const entityNameToText = (entityName: ts.EntityName): string =>
    ts.isIdentifier(entityName)
      ? entityName.text
      : `${entityNameToText(entityName.left)}.${entityName.right.text}`;

  const rawTypeName = entityNameToText(node.typeName);
  const typeName = normalizeNamespaceAliasQualifiedName(
    normalizeSystemInternalQualifiedName(rawTypeName)
  );

  // Check for primitive type names
  if (isPrimitiveTypeName(typeName)) {
    return getPrimitiveType(typeName);
  }

  // Check for CLR primitive type names (e.g., int from @tsonic/core)
  // These are compiler-known types that map to distinct primitives, not referenceType
  if (isClrPrimitiveTypeName(typeName)) {
    return getClrPrimitiveType(typeName);
  }

  // Check for Array<T> / ReadonlyArray<T> utility types → convert to arrayType
  // with explicit origin. This ensures Array<T>, ReadonlyArray<T>, and T[] are
  // treated identically at the IR level.
  const firstTypeArg = node.typeArguments?.[0];
  if ((typeName === "Array" || typeName === "ReadonlyArray") && firstTypeArg) {
    return {
      kind: "arrayType",
      elementType: convertType(firstTypeArg, binding),
      origin: "explicit",
    };
  }

  // Check for expandable conditional utility types (NonNullable, Exclude, Extract)
  // These are expanded at compile time by delegating to TypeScript's type checker
  if (
    isExpandableConditionalUtilityType(typeName) &&
    node.typeArguments?.length
  ) {
    const expanded = expandConditionalUtilityType(
      node,
      typeName,
      binding,
      convertType
    );
    if (expanded) return expanded;
    // Fall through to referenceType if can't expand (e.g., type parameter)
  }

  // Check for Record<K, V> utility type
  // First try to expand to IrObjectType for finite literal keys
  // Falls back to IrDictionaryType ONLY for string/number keys (not type parameters)
  const typeArgsForRecord = node.typeArguments;
  const keyTypeNode = typeArgsForRecord?.[0];
  const valueTypeNode = typeArgsForRecord?.[1];
  if (typeName === "Record" && keyTypeNode && valueTypeNode) {
    // Try to expand to IrObjectType for finite literal keys
    const expandedRecord = expandRecordType(node, binding, convertType);
    if (expandedRecord) return expandedRecord;

    // Only create dictionary if K is exactly 'string' or 'number'
    // Type parameters should fall through to referenceType
    //
    // DETERMINISTIC: Only check SyntaxKind - no getTypeAtLocation.
    // If the key is a type alias that resolves to string/number, it falls through
    // to referenceType (the user should use `string` or `number` directly).
    const keyType = classifyDictionaryKeyTypeNode(
      keyTypeNode,
      convertType,
      binding
    );
    if (keyType) {
      const valueType = convertType(valueTypeNode, binding);

      return {
        kind: "dictionaryType",
        keyType,
        valueType,
      } as IrDictionaryType;
    }
    // Type parameter or other complex key type - fall through to referenceType
  }

  // Check for expandable utility types (Partial, Required, Readonly, Pick, Omit)
  // These are expanded to IrObjectType at compile time for concrete types
  if (isExpandableUtilityType(typeName) && node.typeArguments?.length) {
    const expanded = expandUtilityType(node, typeName, binding, convertType);
    if (expanded) return expanded;
    // Fall through to referenceType if can't expand (e.g., type parameter)
  }

  // tsbindgen's `CLROf<T>` is a conditional type used to coerce ergonomic primitives
  // into their CLR nominal types in generic positions. For deterministic IR typing,
  // we treat it as an identity wrapper and rely on the TypeSystem's primitive-to-nominal
  // normalization (and alias table) to unify primitives with System.* TypeIds.
  if (typeName === "CLROf" && node.typeArguments?.length === 1) {
    const inner = node.typeArguments[0];
    return inner ? convertType(inner, binding) : { kind: "unknownType" };
  }

  // `thisarg<T>` is a TS-only marker used to declare C# extension method receivers.
  // For IR typing it must erase to the underlying T so call resolution and generic
  // inference operate on the real receiver type.
  if (typeName === "thisarg" && node.typeArguments?.length === 1) {
    const inner = node.typeArguments[0];
    return inner ? convertType(inner, binding) : { kind: "unknownType" };
  }

  // `field<T>` is a TS-only marker used to force C# field emission for class members.
  // For IR typing it must erase to the underlying T.
  if (typeName === "field" && node.typeArguments?.length === 1) {
    const inner = node.typeArguments[0];
    return inner ? convertType(inner, binding) : { kind: "unknownType" };
  }

  // `Rewrap<TReceiver, TNewShape>` is a TS-only helper used by generated extension method
  // surfaces to keep extension scopes sticky across fluent chains.
  //
  // For IR typing / runtime shape, it MUST erase to the new shape. We intentionally do not
  // attempt to interpret the `TReceiver` argument here (it is often `this`, which is not a
  // resolvable CLR type in IR conversion).
  if (typeName === "Rewrap" && node.typeArguments?.length === 2) {
    const newShape = node.typeArguments[1];
    return newShape ? convertType(newShape, binding) : { kind: "unknownType" };
  }

  // Handle parameter passing modifiers: out<T>, ref<T>, inref<T>
  // These are type aliases that should NOT be resolved - we preserve them
  // so the emitter can detect `as out<T>` casts and emit the correct C# prefix.
  if (
    (typeName === "out" || typeName === "ref" || typeName === "inref") &&
    node.typeArguments &&
    node.typeArguments.length === 1
  ) {
    // Safe: we checked length === 1 above
    const innerTypeArg = node.typeArguments[0];
    if (!innerTypeArg) {
      return { kind: "anyType" };
    }
    return {
      kind: "referenceType",
      name: typeName,
      typeArguments: [convertType(innerTypeArg, binding)],
    };
  }

  // DETERMINISTIC: Check if this is a type parameter or type alias using Binding
  const declId = binding.resolveTypeReference(node);
  if (declId) {
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    if (declInfo) {
      // Check for type parameter declaration (class type params, method type params, etc.)
      // CRITICAL: Check the AST node directly - do NOT rely on declInfo.kind.
      // Binding's DeclKind may not label TypeParameterDeclaration as "parameter".
      const declNode = (declInfo.typeDeclNode ?? declInfo.declNode) as
        | ts.Declaration
        | undefined;
      if (declNode && ts.isTypeParameterDeclaration(declNode)) {
        return { kind: "typeParameterType", name: typeName };
      }

      // tsbindgen-generated extension method helpers are exported as `ExtensionMethods`
      // from facade modules, then imported with a local alias:
      //   import type { ExtensionMethods as __TsonicExt_Linq } from "@tsonic/dotnet/System.Linq.js";
      //
      // In this case the DeclId resolves to the import specifier (not the underlying
      // `ExtensionMethods_<Namespace>` type alias declaration), so we must recognize
      // the imported name and erase it to the receiver shape for deterministic typing.
      if (
        declNode &&
        ts.isImportSpecifier(declNode) &&
        (declNode.propertyName ?? declNode.name).text === "ExtensionMethods" &&
        node.typeArguments?.length === 1
      ) {
        const shape = node.typeArguments[0];
        return shape ? convertType(shape, binding) : { kind: "unknownType" };
      }

      // Pure index-signature interface/type alias: treat as dictionaryType.
      //
      // This supports idiomatic TS dictionary surfaces:
      //   interface MetricsTotals { [metric: string]: int }
      //   type MetricsTotals = { [metric: string]: int }
      //
      // Without this, computed access `totals["pageviews"]` is misclassified as
      // a CLR indexer and fails numeric proof (TSN5107). This is not a workaround:
      // index-signature-only shapes are structural dictionaries and should compile
      // to `Dictionary<K, V>` / `Record<K, V>` behavior.
      const tryConvertPureIndexSignatureToDictionary = (
        decl: ts.Declaration
      ): IrDictionaryType | undefined => {
        const typeElements = ts.isInterfaceDeclaration(decl)
          ? decl.members
          : ts.isTypeAliasDeclaration(decl) && ts.isTypeLiteralNode(decl.type)
            ? decl.type.members
            : undefined;
        if (!typeElements) return undefined;

        const indexSignatures = typeElements.filter(
          ts.isIndexSignatureDeclaration
        );
        const otherMembers = typeElements.filter(
          (m) => !ts.isIndexSignatureDeclaration(m)
        );
        if (indexSignatures.length === 0 || otherMembers.length > 0) {
          return undefined;
        }

        const indexSig = indexSignatures[0];
        const keyParam = indexSig?.parameters[0];
        const keyTypeNode = keyParam?.type;
        const keyType: IrType = (() => {
          if (!keyTypeNode) {
            return { kind: "primitiveType", name: "string" };
          }
          return (
            classifyDictionaryKeyTypeNode(
              keyTypeNode,
              convertType,
              binding
            ) ?? { kind: "primitiveType", name: "string" }
          );
        })();
        const valueType = indexSig?.type
          ? convertType(indexSig.type, binding)
          : { kind: "anyType" as const };

        return {
          kind: "dictionaryType",
          keyType,
          valueType,
        };
      };

      const pureIndexSigDict = declNode
        ? tryConvertPureIndexSignatureToDictionary(declNode)
        : undefined;
      if (pureIndexSigDict) {
        return pureIndexSigDict;
      }

      // Check for type alias to function type
      // DETERMINISTIC: Expand function type aliases so lambda contextual typing works
      // e.g., `type NumberToNumber = (x: number) => number` should be converted
      // to a functionType, not a referenceType
      if (declNode && ts.isTypeAliasDeclaration(declNode)) {
        // tsbindgen extension method wrapper types are type-only helpers.
        //
        // Example: ExtensionMethods_System_Linq<TShape> = TShape & (__Ext_* ...)
        //
        // For IR/runtime typing, this must erase to the underlying shape type:
        // - Enables member binding on the real receiver type (e.g., List<T>.count → Count)
        // - Prevents TS-only wrapper names from leaking into IR and confusing emit
        //
        // Extension method *member* discovery is handled via Binding + BindingRegistry,
        // not by treating ExtensionMethods_* as a nominal CLR type.
        if (
          declNode.name.text.startsWith("ExtensionMethods_") &&
          node.typeArguments?.length === 1
        ) {
          const shape = node.typeArguments[0];
          return shape ? convertType(shape, binding) : { kind: "unknownType" };
        }

        if (ts.isFunctionTypeNode(declNode.type)) {
          // tsbindgen emits CLR delegates as type aliases to function types in .d.ts.
          //
          // Example (generated):
          //   export type NextFunction = (control?: string) => Task;
          //
          // Airplane-grade rule: CLR delegate types are NOMINAL in C#.
          // If we eagerly expand them into IrFunctionType, we lose the delegate's
          // CLR identity and the emitter will incorrectly lower them to
          // `System.Func` / `System.Action`, breaking overload resolution and
          // delegate parameter typing.
          //
          // Keep declaration-file function aliases as NOMINAL reference types.
          //
          // IMPORTANT: Don't early-return here. We still want the shared
          // reference-type path at the end of this function so we pick up:
          // - Binding-followed fqName (stabilizes identity for facades/aliases)
          // - structuralMembers extraction (for TSN5110)
          //
          // delegateToFunctionType() can still recover the Invoke signature for
          // deterministic lambda typing at call sites.
          if (declNode.getSourceFile().isDeclarationFile) {
            // Fall through to the referenceType emission at the end of this function.
          } else {
            const fnType = convertFunctionType(
              declNode.type,
              binding,
              convertType
            );

            // If the type alias is generic (e.g. `type Func_2<T, TResult> = (arg: T) => TResult`),
            // apply the reference site's type arguments so lambdas get a fully-instantiated
            // expected type (critical for deterministic inference).
            const aliasTypeParams = (declNode.typeParameters ?? []).map(
              (tp) => tp.name.text
            );
            const refTypeArgs = (node.typeArguments ?? []).map((t) =>
              convertType(t, binding)
            );

            if (aliasTypeParams.length > 0 && refTypeArgs.length > 0) {
              const subst = new Map<string, IrType>();
              for (
                let i = 0;
                i < Math.min(aliasTypeParams.length, refTypeArgs.length);
                i++
              ) {
                const name = aliasTypeParams[i];
                const arg = refTypeArgs[i];
                if (name && arg) subst.set(name, arg);
              }

              return subst.size > 0 ? substituteIrType(fnType, subst) : fnType;
            }

            return fnType;
          }
        }

        // Declaration-file type aliases are often TS-only “ergonomic” names (including
        // Tsonic source type aliases appended to generated bindings).
        //
        // These aliases have NO CLR identity and must erase to their underlying shapes
        // so emission uses CLR-backed types.
        //
        // Examples (from generated bindings):
        //   export type Ok<T> = Internal.Ok__Alias_1<T>;
        //   export type Result<T, E = string> = Ok<T> | Err<E>;
        //
        // If we keep these nominal, the emitter will try to reference a CLR type
        // named `Ok` / `Result` which does not exist, causing C# compile failures
        // in downstream projects.
        //
        // IMPORTANT: We must NOT erase:
        // - Delegate aliases (handled above)
        // - Facade conditional “arity families” (handled below)
        // - Conditional type aliases generally (unsupported in the compiler subset)
        if (
          // Only erase *type-only* declaration-file aliases.
          //
          // tsbindgen uses merged type+value symbols for CLR types:
          //   export interface DbSet_1$instance<T> { ... }
          //   export const DbSet_1: ...;
          //   export type DbSet_1<T> = DbSet_1$instance<T> & __DbSet_1$views<T>;
          //
          // These must remain NOMINAL so we don't pull synthetic helper interfaces
          // like `__DbSet_1$views` into user code (they have no CLR binding).
          //
          // By contrast, tsonic-generated bindings often include TS-only re-exports:
          //   export type Ok<T> = Internal.Ok__Alias_1<T>;
          //   export type Result<T, E = string> = Ok<T> | Err<E>;
          //
          // Those aliases have no CLR identity and must erase to their shapes.
          declNode.getSourceFile().isDeclarationFile &&
          isTsonicBindingsDeclarationFile(declNode.getSourceFile().fileName) &&
          !declInfo.valueDeclNode &&
          !ts.isConditionalTypeNode(declNode.type)
        ) {
          const key = declId.id;
          const typeAliasBodyCache = getTypeAliasBodyCache(binding);
          const cached = typeAliasBodyCache.get(key);

          if (cached !== "in-progress") {
            const base =
              cached ??
              (() => {
                typeAliasBodyCache.set(key, "in-progress");
                const converted = convertType(declNode.type, binding);
                typeAliasBodyCache.set(key, converted);
                return converted;
              })();

            const aliasTypeParams = (declNode.typeParameters ?? []).map(
              (tp) => tp.name.text
            );
            const refTypeArgs = (node.typeArguments ?? []).map((t) =>
              convertType(t, binding)
            );

            if (aliasTypeParams.length > 0 && refTypeArgs.length > 0) {
              const subst = new Map<string, IrType>();
              for (
                let i = 0;
                i < Math.min(aliasTypeParams.length, refTypeArgs.length);
                i++
              ) {
                const name = aliasTypeParams[i];
                const arg = refTypeArgs[i];
                if (name && arg) subst.set(name, arg);
              }
              return subst.size > 0 ? substituteIrType(base, subst) : base;
            }

            return base;
          }
        }

        // User-defined type aliases are TS-only and have no CLR identity.
        //
        // For deterministic typing (especially generic inference), we must erase them to their
        // underlying shapes.
        //
        // Example (extension methods):
        //   type LinqList<T> = Linq<List<T>>;
        //   const numbers = new List<int>() as unknown as LinqList<int>;
        //   numbers.AsParallel(); // must infer TSource=int from the receiver
        //
        // Without this erasure, the receiver type becomes a non-nominal referenceType ("LinqList")
        // which prevents interface/heritage-based inference through NominalEnv.
        if (
          !declNode.getSourceFile().isDeclarationFile &&
          isSafeToEraseUserTypeAliasTarget(declNode.type)
        ) {
          const key = declId.id;
          const typeAliasBodyCache = getTypeAliasBodyCache(binding);
          const cached = typeAliasBodyCache.get(key);

          if (cached === "in-progress") {
            // Recursive alias expansion: fall through to the referenceType path to avoid infinite recursion.
          } else {
            const base =
              cached ??
              (() => {
                typeAliasBodyCache.set(key, "in-progress");
                const converted = convertType(declNode.type, binding);
                typeAliasBodyCache.set(key, converted);
                return converted;
              })();

            const aliasTypeParams = (declNode.typeParameters ?? []).map(
              (tp) => tp.name.text
            );
            const refTypeArgs = (node.typeArguments ?? []).map((t) =>
              convertType(t, binding)
            );

            if (aliasTypeParams.length > 0 && refTypeArgs.length > 0) {
              const subst = new Map<string, IrType>();
              for (
                let i = 0;
                i < Math.min(aliasTypeParams.length, refTypeArgs.length);
                i++
              ) {
                const name = aliasTypeParams[i];
                const arg = refTypeArgs[i];
                if (name && arg) subst.set(name, arg);
              }
              return subst.size > 0 ? substituteIrType(base, subst) : base;
            }

            return base;
          }
        }

        // tsbindgen facade type families use conditional type aliases to map:
        //   Foo<T = __> → Foo (non-generic) or Foo_N<T> (generic)
        //
        // Example:
        //   export type IQueryable<T1 = __> =
        //     [T1] extends [__] ? Internal.IQueryable : Internal.IQueryable_1<T1>;
        //
        // When callers reference `Foo<T>` (including with type parameters), we must
        // deterministically lower it to the arity-qualified CLR surface type name
        // (Foo_1/Foo_2/...) so TypeSystem can resolve it nominally via metadata.
        if (
          node.typeArguments &&
          node.typeArguments.length > 0 &&
          declNode.typeParameters &&
          declNode.typeParameters.length === 1
        ) {
          const param = declNode.typeParameters[0];
          const hasTsbindgenDefaultSentinel =
            !!param &&
            !!param.default &&
            ts.isTypeReferenceNode(param.default) &&
            entityNameToText(param.default.typeName) === "__";

          if (
            hasTsbindgenDefaultSentinel &&
            ts.isConditionalTypeNode(declNode.type)
          ) {
            const expected = `${typeName}_${node.typeArguments.length}`;
            let found: string | undefined;

            const visit = (t: ts.TypeNode): void => {
              if (found) return;

              if (ts.isTypeReferenceNode(t)) {
                const raw = entityNameToText(t.typeName);
                const normalized = normalizeNamespaceAliasQualifiedName(
                  normalizeSystemInternalQualifiedName(raw)
                );
                if (normalized === expected) {
                  found = normalized;
                }
                return;
              }

              if (ts.isConditionalTypeNode(t)) {
                visit(t.trueType);
                visit(t.falseType);
                return;
              }

              if (ts.isParenthesizedTypeNode(t)) {
                visit(t.type);
              }
            };

            visit(declNode.type);

            if (found) {
              return {
                kind: "referenceType",
                name: found,
                typeArguments: node.typeArguments.map((t) =>
                  convertType(t, binding)
                ),
              };
            }
          }
        }
      }
    }
  }

  // DETERMINISTIC IR TYPING (INV-0 compliant):
  // Symbol-based type parameter check above handles all cases.
  // The getTypeAtLocation fallback has been removed for INV-0 compliance.

  // Extract structural members from declarations (AST-based)
  // This enables TSN5110 validation for object literal properties.
  const structuralMembers = extractStructuralMembersFromDeclarations(
    declId?.id,
    binding,
    convertType
  );

  // tsbindgen facade exports often re-export arity-qualified CLR types under
  // ergonomic names (e.g., `DbSet` → `DbSet_1`). Binding.resolveTypeReference()
  // already follows aliases, so use the resolved symbol name to keep IR nominal
  // identity stable for member lookup and generic substitution.
  const resolvedName = (() => {
    if (!declId) return typeName;
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    return declInfo?.fqName ?? typeName;
  })();
  const resolvedClrType = resolveSourceBindingsClrIdentity(declId, binding);

  // tsbindgen exports extension method helpers as:
  //   export type { ExtensionMethods_System_Linq as ExtensionMethods } from "./__internal/extensions/index.js";
  //
  // Call sites (and generated bindings for Tsonic source) will often import these with a local alias:
  //   import type { ExtensionMethods as __TsonicExt_Linq } from "@tsonic/dotnet/System.Linq.js";
  //
  // In that case, the TypeReference's `typeName` is the local alias (e.g. "__TsonicExt_Linq"),
  // and the earlier `declNode.name.text.startsWith("ExtensionMethods_")` erasure check won't match
  // because the DeclId points at an import specifier, not the original type-alias declaration node.
  //
  // Airplane-grade rule: these helpers are TS-only wrappers and must erase to the receiver shape
  // for deterministic IR typing / generic inference.
  if (
    (resolvedName.startsWith("ExtensionMethods_") ||
      resolvedName === "ExtensionMethods") &&
    node.typeArguments?.length === 1
  ) {
    const shape = node.typeArguments[0];
    return shape ? convertType(shape, binding) : { kind: "unknownType" };
  }

  // Reference type (user-defined or library)
  return {
    kind: "referenceType",
    name: resolvedName,
    typeArguments: node.typeArguments?.map((t) => convertType(t, binding)),
    resolvedClrType,
    structuralMembers,
  };
};
