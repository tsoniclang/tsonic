/**
 * Reference type conversion
 */

import * as ts from "typescript";
import { IrType, IrDictionaryType, IrInterfaceMember } from "../../../types.js";
import { substituteIrType } from "../../../types/ir-substitution.js";
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

/**
 * Cache for structural member extraction to prevent infinite recursion
 * on recursive types like `type Node = { next: Node }`.
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Key: DeclId.id (numeric identifier) - handles are stable identifiers
 * Value: extracted members, null (not extractable), or "in-progress" sentinel
 */
const structuralMembersCache = new Map<
  number,
  readonly IrInterfaceMember[] | null | "in-progress"
>();

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

  // Skip library types (node_modules, lib.*.d.ts, or declaration files)
  if (
    fileName.includes("node_modules") ||
    fileName.includes("lib.") ||
    sourceFile.isDeclarationFile
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

  // Don't extract for classes, enums, etc.
  return false;
};

/**
 * Extract structural members from type declarations (AST-based).
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * Uses AST nodes directly instead of ts.Type computation.
 * Gets TypeNodes from declarations, not from getTypeOfSymbolAtLocation.
 *
 * Used to populate structuralMembers on referenceType for interfaces and type aliases.
 * This enables TSN5110 validation for object literal properties against expected types.
 *
 * Safety guards:
 * - Only extracts for interfaces/type-aliases (not classes, enums, lib types)
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

    // Get the type element source (interface members or type literal members)
    const typeElements = ts.isInterfaceDeclaration(decl)
      ? decl.members
      : ts.isTypeAliasDeclaration(decl) && ts.isTypeLiteralNode(decl.type)
        ? decl.type.members
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
      // Property signature
      if (ts.isPropertySignature(member)) {
        const propName = ts.isIdentifier(member.name)
          ? member.name.text
          : ts.isStringLiteral(member.name)
            ? member.name.text
            : undefined;

        if (!propName) {
          continue; // Skip computed/symbol keys
        }

        const isOptional = !!member.questionToken;
        const isReadonly =
          member.modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.ReadonlyKeyword
          ) ?? false;

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

      // Method signature
      if (ts.isMethodSignature(member)) {
        const methodName = ts.isIdentifier(member.name)
          ? member.name.text
          : undefined;

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
  const rawTypeName = ts.isIdentifier(node.typeName)
    ? node.typeName.text
    : node.typeName.getText();
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

  // Check for Array<T> utility type → convert to arrayType with explicit origin
  // This ensures Array<T> and T[] are treated identically
  const firstTypeArg = node.typeArguments?.[0];
  if (typeName === "Array" && firstTypeArg) {
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
    const isStringKey = keyTypeNode.kind === ts.SyntaxKind.StringKeyword;
    const isNumberKey = keyTypeNode.kind === ts.SyntaxKind.NumberKeyword;

    if (isStringKey || isNumberKey) {
      const keyType = convertType(keyTypeNode, binding);
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
          const fnType = convertFunctionType(declNode.type, binding, convertType);

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
            (ts.isIdentifier(param.default.typeName)
              ? param.default.typeName.text
              : param.default.typeName.getText()) === "__";

          if (hasTsbindgenDefaultSentinel && ts.isConditionalTypeNode(declNode.type)) {
            const expected = `${typeName}_${node.typeArguments.length}`;
            let found: string | undefined;

            const visit = (t: ts.TypeNode): void => {
              if (found) return;

              if (ts.isTypeReferenceNode(t)) {
                const raw = ts.isIdentifier(t.typeName)
                  ? t.typeName.text
                  : t.typeName.getText();
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
                typeArguments: node.typeArguments.map((t) => convertType(t, binding)),
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
    const declInfo = (binding as BindingInternal)._getHandleRegistry().getDecl(declId);
    return declInfo?.fqName ?? typeName;
  })();

  // Reference type (user-defined or library)
  return {
    kind: "referenceType",
    name: resolvedName,
    typeArguments: node.typeArguments?.map((t) => convertType(t, binding)),
    structuralMembers,
  };
};
