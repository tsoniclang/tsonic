/**
 * Binding Registry - extension method resolution and type/subtype checking.
 *
 * All functions in this module are pure (side-effect-free) and operate on an
 * explicit `RegistryState` parameter.
 *
 * Split from binding-registry-resolution.ts for file-size compliance (< 500 LOC).
 */

import type { ParameterModifier, MemberBinding } from "./binding-types.js";
import type { RegistryState } from "./binding-registry-resolution-member.js";
import {
  splitSignatureTypeList,
  resolveLookupAlias,
  getDirectSupertypes,
} from "./binding-registry-resolution-member.js";

// ---------------------------------------------------------------------------
// Extension method resolution
// ---------------------------------------------------------------------------

const getExtensionMethodCandidates = (
  state: RegistryState,
  namespaceKey: string,
  receiverTypeName: string,
  methodTsName: string
): readonly MemberBinding[] | undefined =>
  state.extensionMethods
    .get(namespaceKey)
    ?.get(receiverTypeName)
    ?.get(methodTsName);

const parseExtensionInterfaceName = (
  state: RegistryState,
  extensionInterfaceName: string
):
  | { readonly namespaceKey: string; readonly receiverTypeName: string }
  | undefined => {
  if (!extensionInterfaceName.startsWith("__Ext_")) return undefined;
  const rest = extensionInterfaceName.slice("__Ext_".length);

  // Find the longest namespaceKey prefix we have indexed.
  let bestNamespaceKey: string | undefined;
  for (const namespaceKey of state.extensionMethods.keys()) {
    if (rest.startsWith(`${namespaceKey}_`)) {
      if (!bestNamespaceKey || namespaceKey.length > bestNamespaceKey.length) {
        bestNamespaceKey = namespaceKey;
      }
    }
  }
  if (!bestNamespaceKey) return undefined;

  const receiverTypeName = rest.slice(bestNamespaceKey.length + 1);
  if (!receiverTypeName) return undefined;

  return { namespaceKey: bestNamespaceKey, receiverTypeName };
};

/**
 * Resolve an extension method binding target by extension interface name.
 *
 * @param extensionInterfaceName - e.g. "__Ext_System_Linq_IEnumerable_1"
 * @param methodTsName - e.g. "where"
 */
export const resolveExtensionMethod = (
  state: RegistryState,
  extensionInterfaceName: string,
  methodTsName: string,
  callArgumentCount?: number
): MemberBinding | undefined => {
  const parsed = parseExtensionInterfaceName(state, extensionInterfaceName);
  if (!parsed) return undefined;

  return resolveExtensionMethodByKey(
    state,
    parsed.namespaceKey,
    parsed.receiverTypeName,
    methodTsName,
    callArgumentCount
  );
};

/**
 * Resolve an extension method binding target by explicit (namespaceKey, receiverTypeName).
 *
 * Used when extension methods are emitted as method-table members with explicit `this:`
 * receiver constraints (the declaring interface name no longer encodes the receiver type).
 */
export const resolveExtensionMethodByKey = (
  state: RegistryState,
  namespaceKey: string,
  receiverTypeName: string,
  methodTsName: string,
  callArgumentCount?: number
): MemberBinding | undefined => {
  type ResolveResult =
    | { readonly kind: "none" }
    | { readonly kind: "ambiguous" }
    | { readonly kind: "resolved"; readonly binding: MemberBinding };

  const getParameterCount = (binding: MemberBinding): number | undefined => {
    if (typeof binding.parameterCount === "number") {
      return binding.parameterCount;
    }

    const sig = binding.signature;
    if (!sig) return undefined;
    const paramsMatch = sig.match(/\|\(([^)]*)\):/);
    const paramsStr = paramsMatch?.[1]?.trim();
    if (!paramsStr) return undefined;
    return splitSignatureTypeList(paramsStr).length;
  };

  const getModifiersKey = (binding: MemberBinding): string => {
    const mods = (binding.parameterModifiers ??
      []) as readonly ParameterModifier[];
    if (!Array.isArray(mods) || mods.length === 0) return "";
    return [...mods]
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((m) => `${m.index}:${m.modifier}`)
      .join(",");
  };

  const resolveForReceiver = (receiverTypeName: string): ResolveResult => {
    const candidates = getExtensionMethodCandidates(
      state,
      namespaceKey,
      receiverTypeName,
      methodTsName
    );
    if (!candidates || candidates.length === 0) return { kind: "none" };

    let filteredCandidates: readonly MemberBinding[] = candidates;
    if (typeof callArgumentCount === "number") {
      const desiredParamCount = callArgumentCount + 1;

      const exact = candidates.filter(
        (c) => getParameterCount(c) === desiredParamCount
      );

      if (exact.length > 0) {
        filteredCandidates = exact;
      } else {
        // Optional-parameter safety: if no exact arity match, choose the smallest
        // candidate arity that can still accept the provided arguments.
        const larger = candidates
          .map((c) => ({ c, count: getParameterCount(c) }))
          .filter(
            (x): x is { c: MemberBinding; count: number } =>
              typeof x.count === "number" && x.count > desiredParamCount
          );

        if (larger.length === 0) return { kind: "none" };

        const minCount = Math.min(...larger.map((x) => x.count));
        filteredCandidates = larger
          .filter((x) => x.count === minCount)
          .map((x) => x.c);
      }
    }

    // If multiple candidates map to different CLR targets, treat as unresolved (unsafe).
    const first = filteredCandidates[0];
    if (!first) return { kind: "none" };
    const firstTarget = `${first.binding.type}::${first.binding.member}`;
    const firstModsKey = getModifiersKey(first);
    for (const c of filteredCandidates) {
      const target = `${c.binding.type}::${c.binding.member}`;
      if (target !== firstTarget) {
        return { kind: "ambiguous" };
      }

      if (getModifiersKey(c) !== firstModsKey) {
        return { kind: "ambiguous" };
      }
    }

    return { kind: "resolved", binding: first };
  };

  const direct = resolveForReceiver(receiverTypeName);
  if (direct.kind === "resolved") return direct.binding;
  return direct.kind === "ambiguous" ? undefined : undefined;
};

// ---------------------------------------------------------------------------
// Type/subtype check
// ---------------------------------------------------------------------------

export const isTypeOrSubtype = (
  state: RegistryState,
  typeAlias: string,
  superAlias: string
): boolean => {
  const normalizedTypeAlias = resolveLookupAlias(state, typeAlias);
  const normalizedSuperAlias = resolveLookupAlias(state, superAlias);

  if (normalizedTypeAlias === normalizedSuperAlias) {
    return true;
  }

  const visited = new Set<string>([normalizedTypeAlias]);
  let frontier = getDirectSupertypes(state, normalizedTypeAlias);
  for (const candidate of frontier) {
    if (candidate === normalizedSuperAlias) {
      return true;
    }
    visited.add(candidate);
  }

  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const candidate of frontier) {
      for (const parent of getDirectSupertypes(state, candidate)) {
        if (visited.has(parent)) continue;
        if (parent === normalizedSuperAlias) {
          return true;
        }
        visited.add(parent);
        nextFrontier.push(parent);
      }
    }
    frontier = nextFrontier;
  }

  return false;
};
