/**
 * Reference type normalization helpers, key classification, and per-binding caches.
 *
 * Split from references.ts for file-size compliance (< 800 LOC).
 */

import type { TstsNode } from "@tsonic/tsts";
import { TstsSyntax } from "@tsonic/tsts";
import { IrType, IrInterfaceMember } from "../../../types.js";
import { normalizedUnionType } from "../../../types/type-ops.js";
import type { Binding } from "../../../binding/index.js";

/**
 * Generated declaration surfaces can refer to imported namespace objects via
 * a local `*_Internal` alias. IR type conversion only needs the exported type
 * name; semantic primitive lowering is handled by symbol provenance and binding
 * metadata, not by provider-name tables here.
 */
const normalizeSourceWrapperName = (typeName: string): string | undefined => {
  switch (typeName) {
    case "String":
      return "string";
    case "Number":
      return "number";
    case "Boolean":
      return "boolean";
    default:
      return undefined;
  }
};

export const normalizeProviderInternalQualifiedName = (
  typeName: string
): string => {
  const lastDot = typeName.lastIndexOf(".");
  if (lastDot <= 0) return typeName;

  const prefix = typeName.slice(0, lastDot);
  if (!prefix.endsWith("_Internal")) return typeName;
  const inner = typeName.slice(lastDot + 1);
  return normalizeSourceWrapperName(inner) ?? inner;
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
        ...(type.runtimeUnionLayout === "carrierSlotOrder"
          ? { runtimeUnionLayout: "carrierSlotOrder" as const }
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

export const isSymbolTypeReferenceNode = (node: TstsNode): boolean =>
  TstsSyntax.IsTypeReferenceNode(node) &&
  TstsSyntax.AsTypeReferenceNode(node)?.TypeName?.Kind ===
    TstsSyntax.KindIdentifier &&
  TstsSyntax.AsIdentifier(TstsSyntax.AsTypeReferenceNode(node)?.TypeName)
    ?.Text === "symbol";

export const classifyDictionaryKeyTypeNode = (
  keyTypeNode: TstsNode
): IrType | undefined => {
  const keyNodes = TstsSyntax.IsUnionTypeNode(keyTypeNode)
    ? (TstsSyntax.AsUnionTypeNode(keyTypeNode)?.Types?.Nodes ?? []).filter(
        (node): node is TstsNode => node !== undefined
      )
    : [keyTypeNode];

  let sawString = false;
  let sawNumber = false;
  let sawSymbol = false;

  for (const node of keyNodes) {
    if (node.Kind === TstsSyntax.KindStringKeyword) {
      sawString = true;
      continue;
    }
    if (node.Kind === TstsSyntax.KindNumberKeyword) {
      sawNumber = true;
      continue;
    }
    if (
      node.Kind === TstsSyntax.KindSymbolKeyword ||
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
    return { kind: "primitiveType", name: "number" };
  }

  return { kind: "primitiveType", name: "string" };
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
