/**
 * Structural member extraction, declaration file classification,
 * bindings resolution, and type-alias analysis helpers.
 *
 * Split from references.ts for file-size compliance (< 800 LOC).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as ts from "typescript";
import { IrType, IrDictionaryType, IrInterfaceMember } from "../../../types.js";
import { substituteIrType } from "../../../types/ir-substitution.js";
import type { DeclId } from "../../../type-system/types.js";
import { tsbindgenClrTypeNameToTsTypeName } from "../../../../tsbindgen/names.js";
import { CLR_PRIMITIVE_TYPE_SET, getClrPrimitiveType } from "./primitives.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";
import { tryResolveDeterministicPropertyName } from "../../../syntax/property-names.js";
import {
  classifyDictionaryKeyTypeNode,
  normalizeExpandedAliasType,
  getStructuralMembersCache,
  getTypeAliasBodyCache,
  getTypeAliasRecursionCache,
} from "./references-normalize.js";

/**
 * Check whether a declaration file is a Tsonic-generated bindings artifact.
 *
 * We only apply aggressive declaration-file type-alias erasure to these files.
 * Airplane-grade rule: Never erase type aliases from tsbindgen-produced stdlib
 * packages (e.g., @tsonic/dotnet, @tsonic/core). Those aliases often encode CLR
 * nominal types (interfaces, delegates, indexers) and must remain NOMINAL.
 */
export const isTsonicBindingsDeclarationFile = (fileName: string): boolean => {
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

const tsonicSourcePackageFileCache = new Map<string, boolean>();

export const isInstalledTsonicSourcePackageFile = (
  fileName: string
): boolean => {
  const normalized = fileName.replace(/\\/g, "/");
  const cached = tsonicSourcePackageFileCache.get(normalized);
  if (cached !== undefined) return cached;

  if (!normalized.includes("/node_modules/")) {
    tsonicSourcePackageFileCache.set(normalized, false);
    return false;
  }

  let currentDir = dirname(fileName);
  while (true) {
    const manifestPath = join(currentDir, "tsonic", "package-manifest.json");
    if (existsSync(manifestPath)) {
      try {
        const parsed = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
          readonly kind?: unknown;
        };
        const isSourcePackage = parsed.kind === "tsonic-source-package";
        tsonicSourcePackageFileCache.set(normalized, isSourcePackage);
        return isSourcePackage;
      } catch {
        tsonicSourcePackageFileCache.set(normalized, false);
        return false;
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      tsonicSourcePackageFileCache.set(normalized, false);
      return false;
    }
    currentDir = parentDir;
  }
};

export const shouldPreserveUserTypeAliasIdentity = (
  decl: ts.TypeAliasDeclaration
): boolean => {
  const sourceFile = decl.getSourceFile();
  return (
    !sourceFile.isDeclarationFile ||
    isInstalledTsonicSourcePackageFile(sourceFile.fileName)
  );
};

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

export const resolveSourceBindingsClrIdentity = (
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
 * Erase only aliases whose targets are semantically transparent for lowering:
 * - references / arrays / primitive and literal aliases
 * - callable aliases
 * - intersections / indexed access / typeof / keyof / readonly-style wrappers
 *
 * Preserve aliases whose identity is required for stable lowering contracts:
 * - object/type-literal aliases (these lower to stable emitted shapes)
 * - union aliases (runtime-union/discriminant stability)
 * - tuple aliases (tuple lowering stability)
 * - mapped / conditional aliases (non-local shape selection)
 */
export const isSafeToEraseUserTypeAliasTarget = (
  node: ts.TypeNode
): boolean => {
  // Peel parentheses (e.g., type X = (Y))
  while (ts.isParenthesizedTypeNode(node)) {
    node = node.type;
  }

  if (
    ts.isTypeLiteralNode(node) ||
    ts.isTupleTypeNode(node) ||
    ts.isMappedTypeNode(node) ||
    ts.isConditionalTypeNode(node)
  ) {
    return false;
  }

  return (
    ts.isTypeReferenceNode(node) ||
    ts.isExpressionWithTypeArguments(node) ||
    ts.isArrayTypeNode(node) ||
    ts.isUnionTypeNode(node) ||
    ts.isFunctionTypeNode(node) ||
    ts.isConstructorTypeNode(node) ||
    ts.isIntersectionTypeNode(node) ||
    ts.isTypeOperatorNode(node) ||
    ts.isIndexedAccessTypeNode(node) ||
    ts.isLiteralTypeNode(node) ||
    ts.isTypePredicateNode(node) ||
    node.kind === ts.SyntaxKind.AnyKeyword ||
    node.kind === ts.SyntaxKind.UnknownKeyword ||
    node.kind === ts.SyntaxKind.NeverKeyword ||
    node.kind === ts.SyntaxKind.VoidKeyword ||
    node.kind === ts.SyntaxKind.UndefinedKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword ||
    node.kind === ts.SyntaxKind.StringKeyword ||
    node.kind === ts.SyntaxKind.NumberKeyword ||
    node.kind === ts.SyntaxKind.BooleanKeyword ||
    node.kind === ts.SyntaxKind.ObjectKeyword ||
    node.kind === ts.SyntaxKind.SymbolKeyword ||
    node.kind === ts.SyntaxKind.BigIntKeyword
  );
};

export const isRecursiveUserTypeAliasDeclaration = (
  declId: number,
  declNode: ts.TypeAliasDeclaration,
  binding: Binding
): boolean => {
  const recursionCache = getTypeAliasRecursionCache(binding);
  const cached = recursionCache.get(declId);
  if (cached === "in-progress") {
    return true;
  }
  if (typeof cached === "boolean") {
    return cached;
  }

  recursionCache.set(declId, "in-progress");
  const registry = (binding as BindingInternal)._getHandleRegistry();
  let isRecursive = false;

  const visit = (node: ts.Node): void => {
    if (isRecursive) return;

    if (ts.isTypeReferenceNode(node)) {
      const referencedDecl = binding.resolveTypeReference(node);
      if (referencedDecl) {
        if (referencedDecl.id === declId) {
          isRecursive = true;
          return;
        }

        const referencedDeclInfo = registry.getDecl(referencedDecl);
        const referencedNode = referencedDeclInfo?.declNode as
          | ts.Declaration
          | undefined;
        if (
          referencedNode &&
          ts.isTypeAliasDeclaration(referencedNode) &&
          shouldPreserveUserTypeAliasIdentity(referencedNode) &&
          isRecursiveUserTypeAliasDeclaration(
            referencedDecl.id,
            referencedNode,
            binding
          )
        ) {
          isRecursive = true;
          return;
        }
      }
    }

    node.forEachChild(visit);
  };

  visit(declNode.type);
  recursionCache.set(declId, isRecursive);
  return isRecursive;
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
  const isInstalledSourcePackageFile =
    !sourceFile.isDeclarationFile &&
    isInstalledTsonicSourcePackageFile(fileName);

  // Skip external library types, but keep first-party/source-package bindings
  // extractable even when they are installed under node_modules.
  //
  // This is required for the full installed-package class:
  // - source-package callback/contextual typing
  // - imported structural/container value recovery
  // - sibling type closure across package boundaries
  //
  // Tsonic-generated bindings under node_modules are not "external libraries"
  // in the tsbindgen sense; they are the authoritative first-party semantic
  // surface and must preserve structural shape.
  if (
    (!isSourceBindingsDecl &&
      !isInstalledSourcePackageFile &&
      fileName.includes("node_modules")) ||
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
export const extractStructuralMembersFromDeclarations = (
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
      if (
        "name" in member &&
        member.name &&
        ts.isPrivateIdentifier(member.name)
      ) {
        return false;
      }
      return true;
    };

    const getMemberName = (
      name: ts.PropertyName | ts.PrivateIdentifier | undefined
    ): string | undefined => tryResolveDeterministicPropertyName(name);

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
        if (
          ts.isClassDeclaration(decl) &&
          !isPublicInstanceClassMember(member)
        ) {
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
        if (
          ts.isPropertyDeclaration(member) &&
          !isPublicInstanceClassMember(member)
        ) {
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
        if (
          ts.isMethodDeclaration(member) &&
          !isPublicInstanceClassMember(member)
        ) {
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
 * Try to convert a pure index-signature interface/type alias to dictionaryType.
 *
 * This supports idiomatic TS dictionary surfaces:
 *   interface MetricsTotals { [metric: string]: int }
 *   type MetricsTotals = { [metric: string]: int }
 *
 * Without this, computed access `totals["pageviews"]` is misclassified as
 * a CLR indexer and fails numeric proof (TSN5107). This is not a workaround:
 * index-signature-only shapes are structural dictionaries and should compile
 * to `Dictionary<K, V>` / `Record<K, V>` behavior.
 */
export const tryConvertPureIndexSignatureToDictionary = (
  decl: ts.Declaration,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType,
  binding: Binding
): IrDictionaryType | undefined => {
  const typeElements = ts.isInterfaceDeclaration(decl)
    ? decl.members
    : ts.isTypeAliasDeclaration(decl) && ts.isTypeLiteralNode(decl.type)
      ? decl.type.members
      : undefined;
  if (!typeElements) return undefined;

  const indexSignatures = typeElements.filter(ts.isIndexSignatureDeclaration);
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
      classifyDictionaryKeyTypeNode(keyTypeNode, convertType, binding) ?? {
        kind: "primitiveType",
        name: "string",
      }
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

/**
 * Expand a type alias body with optional type-parameter substitution.
 *
 * Shared helper used by both declaration-file alias erasure and user-defined
 * type alias erasure paths in convertTypeReference.
 */
export const expandTypeAliasBody = (
  declId: number,
  declNode: ts.TypeAliasDeclaration,
  node: ts.TypeReferenceNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | undefined => {
  const key = declId;
  const typeAliasBodyCache = getTypeAliasBodyCache(binding);
  const cached = typeAliasBodyCache.get(key);

  if (cached === "in-progress") {
    return undefined;
  }

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
    return normalizeExpandedAliasType(
      subst.size > 0 ? substituteIrType(base, subst) : base
    );
  }

  return normalizeExpandedAliasType(base);
};
