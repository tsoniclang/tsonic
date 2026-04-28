/**
 * Reference type normalization helpers, key classification, and per-binding caches.
 *
 * Split from references.ts for file-size compliance (< 800 LOC).
 */

import * as ts from "typescript";
import { IrType, IrInterfaceMember } from "../../../types.js";
import { normalizedUnionType } from "../../../types/type-ops.js";
import type { Binding } from "../../../binding/index.js";

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
export const normalizeSystemInternalQualifiedName = (
  typeName: string
): string => {
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
export const normalizeNamespaceAliasQualifiedName = (
  typeName: string
): string => {
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

export const normalizeExpandedAliasType = (type: IrType): IrType =>
  type.kind === "unionType"
    ? normalizedUnionType(type.types, {
        ...(type.preserveRuntimeLayout === true
          ? { preserveRuntimeLayout: true as const }
          : {}),
        ...(type.runtimeCarrierFamilyKey !== undefined
          ? { runtimeCarrierFamilyKey: type.runtimeCarrierFamilyKey }
          : {}),
        ...(type.runtimeCarrierName !== undefined
          ? { runtimeCarrierName: type.runtimeCarrierName }
          : {}),
        ...(type.runtimeCarrierNamespace !== undefined
          ? { runtimeCarrierNamespace: type.runtimeCarrierNamespace }
          : {}),
        ...(type.runtimeCarrierTypeParameters !== undefined
          ? { runtimeCarrierTypeParameters: type.runtimeCarrierTypeParameters }
          : {}),
        ...(type.runtimeCarrierTypeArguments !== undefined
          ? { runtimeCarrierTypeArguments: type.runtimeCarrierTypeArguments }
          : {}),
      })
    : type;

export const isSymbolTypeReferenceNode = (node: ts.TypeNode): boolean =>
  ts.isTypeReferenceNode(node) &&
  ts.isIdentifier(node.typeName) &&
  node.typeName.text === "symbol";

export const classifyDictionaryKeyTypeNode = (
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
export type StructuralMembersCache = Map<
  number,
  readonly IrInterfaceMember[] | null | "in-progress"
>;

export type TypeAliasBodyCache = Map<number, IrType | "in-progress">;
export type TypeAliasRecursionCache = Map<number, boolean | "in-progress">;

const structuralMembersCacheByBinding = new WeakMap<
  Binding,
  StructuralMembersCache
>();

const typeAliasBodyCacheByBinding = new WeakMap<Binding, TypeAliasBodyCache>();
const typeAliasRecursionCacheByBinding = new WeakMap<
  Binding,
  TypeAliasRecursionCache
>();

export const getStructuralMembersCache = (
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

export const getTypeAliasBodyCache = (binding: Binding): TypeAliasBodyCache => {
  let cache = typeAliasBodyCacheByBinding.get(binding);
  if (!cache) {
    cache = new Map<number, IrType | "in-progress">();
    typeAliasBodyCacheByBinding.set(binding, cache);
  }
  return cache;
};

export const getTypeAliasRecursionCache = (
  binding: Binding
): TypeAliasRecursionCache => {
  let cache = typeAliasRecursionCacheByBinding.get(binding);
  if (!cache) {
    cache = new Map<number, boolean | "in-progress">();
    typeAliasRecursionCacheByBinding.set(binding, cache);
  }
  return cache;
};
