/**
 * Binding Registry - resolution logic for member overloads and extension methods.
 *
 * All functions in this module are pure (side-effect-free) and operate on an
 * explicit `RegistryState` parameter that exposes the maps owned by the
 * BindingRegistry class.
 */

import { tsbindgenClrTypeNameToTsTypeName } from "../tsbindgen/names.js";
import type {
  ParameterModifier,
  MemberBinding,
  TypeBinding,
  SimpleBindingDescriptor,
} from "./binding-types.js";

// ---------------------------------------------------------------------------
// RegistryState – read-only view into BindingRegistry maps
// ---------------------------------------------------------------------------

/**
 * Read-only view of the BindingRegistry internal state.
 *
 * Resolution functions receive this instead of accessing `this` so they can
 * live in a separate module without coupling to the class definition.
 */
export type RegistryState = {
  readonly types: ReadonlyMap<string, TypeBinding>;
  readonly memberOverloads: ReadonlyMap<string, MemberBinding[]>;
  readonly clrTypeNamesByAlias: ReadonlyMap<string, Set<string>>;
  readonly extensionMethods: ReadonlyMap<
    string,
    ReadonlyMap<string, ReadonlyMap<string, MemberBinding[]>>
  >;
  readonly tsSupertypes: ReadonlyMap<string, Set<string>>;
  readonly tsBaseTypes: ReadonlyMap<string, string>;
  readonly simpleBindings: ReadonlyMap<string, SimpleBindingDescriptor>;
  readonly simpleBindingsLowercase: ReadonlyMap<
    string,
    SimpleBindingDescriptor
  >;
  readonly typeLookupAliasMap: ReadonlyMap<string, string>;
  readonly clrTypeNames: ReadonlySet<string>;
};

// ---------------------------------------------------------------------------
// Signature parsing
// ---------------------------------------------------------------------------

/**
 * Split a comma-delimited type list, respecting nested bracket depth.
 * tsbindgen signatures use CLR-style nested generic brackets in some contexts.
 */
export const splitSignatureTypeList = (str: string): string[] => {
  const result: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of str) {
    if (char === "[") {
      depth++;
      current += char;
    } else if (char === "]") {
      depth--;
      current += char;
    } else if (char === "," && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
};

// ---------------------------------------------------------------------------
// Simple binding helpers (used by resolution)
// ---------------------------------------------------------------------------

const SIMPLE_BINDING_CONSTRUCTOR_SUFFIX = "Constructor";

const getSimpleBindingConstructorBaseAlias = (
  alias: string
): string | undefined =>
  alias.endsWith(SIMPLE_BINDING_CONSTRUCTOR_SUFFIX)
    ? alias.slice(0, -SIMPLE_BINDING_CONSTRUCTOR_SUFFIX.length)
    : undefined;

const simpleBindingContributesTypeIdentity = (
  descriptor: SimpleBindingDescriptor
): boolean => {
  const explicit = descriptor.typeSemantics?.contributesTypeIdentity;
  if (explicit !== undefined) {
    return explicit;
  }

  return false;
};

const getSimpleBindingMemberOwnerClrType = (
  descriptor: SimpleBindingDescriptor
): string => descriptor.type;

// ---------------------------------------------------------------------------
// Alias resolution
// ---------------------------------------------------------------------------

export const resolveLookupAlias = (
  state: RegistryState,
  typeAlias: string
): string => state.typeLookupAliasMap.get(typeAlias) ?? typeAlias;

const resolveSimpleBindingMemberOwnerAlias = (
  state: RegistryState,
  typeAlias: string
): string | undefined => {
  const directDescriptor =
    state.simpleBindings.get(typeAlias) ??
    state.simpleBindingsLowercase.get(typeAlias.toLowerCase());
  const descriptor =
    directDescriptor ??
    (() => {
      const baseAlias = getSimpleBindingConstructorBaseAlias(typeAlias);
      if (!baseAlias) return undefined;
      const baseDescriptor =
        state.simpleBindings.get(baseAlias) ??
        state.simpleBindingsLowercase.get(baseAlias.toLowerCase());
      if (!baseDescriptor) return undefined;
      return simpleBindingContributesTypeIdentity(baseDescriptor)
        ? baseDescriptor
        : undefined;
    })();
  if (!descriptor) return undefined;
  const mapped = tsbindgenClrTypeNameToTsTypeName(
    getSimpleBindingMemberOwnerClrType(descriptor)
  );
  if (!mapped || mapped === typeAlias) return undefined;
  return mapped;
};

// ---------------------------------------------------------------------------
// Supertype / base-type helpers
// ---------------------------------------------------------------------------

const getDirectSupertypes = (
  state: RegistryState,
  typeAlias: string
): readonly string[] => {
  const set = state.tsSupertypes.get(typeAlias);
  if (!set || set.size === 0) return [];
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

const getDirectBaseType = (
  state: RegistryState,
  typeAlias: string
): string | undefined => state.tsBaseTypes.get(typeAlias);

const getDirectInterfaceSupertypes = (
  state: RegistryState,
  typeAlias: string
): readonly string[] => {
  const direct = getDirectSupertypes(state, typeAlias);
  const baseType = getDirectBaseType(state, typeAlias);
  return baseType
    ? direct.filter((candidate) => candidate !== baseType)
    : direct;
};

// ---------------------------------------------------------------------------
// Member lookup owner aliases
// ---------------------------------------------------------------------------

const getMemberLookupOwnerAliases = (
  state: RegistryState,
  typeAlias: string
): readonly string[] => {
  const aliases: string[] = [];
  const seen = new Set<string>();
  const push = (alias: string | undefined): void => {
    if (!alias || seen.has(alias)) return;
    seen.add(alias);
    aliases.push(alias);
  };

  push(typeAlias);

  if (typeAlias.endsWith("$protected")) {
    push(typeAlias.slice(0, -"$protected".length));
  }

  const mappedAlias = resolveSimpleBindingMemberOwnerAlias(state, typeAlias);
  push(mappedAlias);
  if (mappedAlias?.endsWith("$protected")) {
    push(mappedAlias.slice(0, -"$protected".length));
  }

  return aliases;
};

// ---------------------------------------------------------------------------
// Case-insensitive member resolution
// ---------------------------------------------------------------------------

const resolveUniqueCaseInsensitiveMemberAlias = (
  state: RegistryState,
  ownerAlias: string,
  memberAlias: string
): string | undefined => {
  const type = state.types.get(ownerAlias);
  if (!type) return undefined;

  const target = memberAlias.toLowerCase();
  const matches = new Set<string>();
  for (const member of type.members) {
    if (member.alias.toLowerCase() === target) {
      matches.add(member.alias);
    }
  }

  if (matches.size !== 1) return undefined;
  return Array.from(matches)[0];
};

const getExactOrUniqueCaseInsensitiveMember = <T>(
  state: RegistryState,
  ownerAlias: string,
  memberAlias: string,
  lookup: (key: string) => T | undefined,
  allowCaseInsensitiveFallback = true
): T | undefined => {
  const exact = lookup(`${ownerAlias}.${memberAlias}`);
  if (exact !== undefined) return exact;

  if (!allowCaseInsensitiveFallback) {
    return undefined;
  }

  const resolvedAlias = resolveUniqueCaseInsensitiveMemberAlias(
    state,
    ownerAlias,
    memberAlias
  );
  if (!resolvedAlias || resolvedAlias === memberAlias) {
    return undefined;
  }

  return lookup(`${ownerAlias}.${resolvedAlias}`);
};

// ---------------------------------------------------------------------------
// Member overload resolution (single owner)
// ---------------------------------------------------------------------------

const resolveMemberOverloadsForOwner = (
  state: RegistryState,
  ownerAlias: string,
  memberAlias: string,
  allowCaseInsensitiveFallback = true,
  preferredClrOwner?: string
): readonly MemberBinding[] | undefined => {
  const resolved = getExactOrUniqueCaseInsensitiveMember(
    state,
    ownerAlias,
    memberAlias,
    (key) => {
      const overloads = state.memberOverloads.get(key);
      return overloads && overloads.length > 0 ? overloads : undefined;
    },
    allowCaseInsensitiveFallback
  );
  if (!resolved || resolved.length === 0) return resolved;

  if (preferredClrOwner) {
    const preferredOwnerMatches = resolved.filter(
      (binding) => binding.binding.type === preferredClrOwner
    );
    if (preferredOwnerMatches.length > 0) {
      return preferredOwnerMatches;
    }
  }

  const ownerClrTypes = state.clrTypeNamesByAlias.get(ownerAlias);
  if (!ownerClrTypes || ownerClrTypes.size !== 1) {
    return resolved;
  }

  const [ownerClrType] = Array.from(ownerClrTypes);
  if (!ownerClrType) return resolved;

  const directOwnerMatches = resolved.filter((binding) =>
    ownerClrTypes.has(binding.binding.type)
  );
  return directOwnerMatches.length > 0 ? directOwnerMatches : resolved;
};

// ---------------------------------------------------------------------------
// Member overload resolution (hierarchy walk)
// ---------------------------------------------------------------------------

const resolveMemberOverloadsByHierarchy = (
  state: RegistryState,
  ownerAlias: string,
  memberAlias: string,
  allowCaseInsensitiveFallback = true,
  preferredClrOwner?: string
): readonly MemberBinding[] | undefined => {
  const direct = resolveMemberOverloadsForOwner(
    state,
    ownerAlias,
    memberAlias,
    allowCaseInsensitiveFallback,
    preferredClrOwner
  );
  if (direct && direct.length > 0) {
    return direct;
  }

  const getTargetKey = (binding: MemberBinding): string =>
    `${binding.binding.assembly}:${binding.binding.type}::${binding.binding.member}`;

  const getModifiersKey = (binding: MemberBinding): string => {
    const modifiers = binding.parameterModifiers ?? [];
    if (modifiers.length === 0) return "";
    return [...modifiers]
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((mod) => `${mod.index}:${mod.modifier}`)
      .join(",");
  };

  const visited = new Set<string>([ownerAlias]);

  let currentBase = getDirectBaseType(state, ownerAlias);
  while (currentBase) {
    if (visited.has(currentBase)) break;
    visited.add(currentBase);

    const resolved = resolveMemberOverloadsForOwner(
      state,
      currentBase,
      memberAlias,
      allowCaseInsensitiveFallback,
      preferredClrOwner
    );
    if (resolved && resolved.length > 0) {
      return resolved;
    }

    currentBase = getDirectBaseType(state, currentBase);
  }

  let frontier: string[] = [];
  const interfaceOwners = [ownerAlias];
  let baseForInterfaces = getDirectBaseType(state, ownerAlias);
  while (baseForInterfaces) {
    interfaceOwners.push(baseForInterfaces);
    baseForInterfaces = getDirectBaseType(state, baseForInterfaces);
  }

  for (const candidateOwner of interfaceOwners) {
    for (const iface of getDirectInterfaceSupertypes(state, candidateOwner)) {
      if (visited.has(iface)) continue;
      visited.add(iface);
      frontier.push(iface);
    }
  }

  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    const resolvedAtDepth: (readonly MemberBinding[])[] = [];

    for (const candidateAlias of frontier) {
      const resolved = resolveMemberOverloadsForOwner(
        state,
        candidateAlias,
        memberAlias,
        allowCaseInsensitiveFallback,
        preferredClrOwner
      );
      if (resolved && resolved.length > 0) {
        resolvedAtDepth.push(resolved);
      }

      for (const superAlias of getDirectInterfaceSupertypes(
        state,
        candidateAlias
      )) {
        if (visited.has(superAlias)) continue;
        visited.add(superAlias);
        nextFrontier.push(superAlias);
      }
    }

    if (resolvedAtDepth.length > 0) {
      const first = resolvedAtDepth[0]?.[0];
      if (!first) return undefined;

      const targetKey = getTargetKey(first);
      const modifiersKey = getModifiersKey(first);
      for (const overloads of resolvedAtDepth) {
        const current = overloads[0];
        if (!current) return undefined;
        if (getTargetKey(current) !== targetKey) {
          return undefined;
        }
        if (getModifiersKey(current) !== modifiersKey) {
          return undefined;
        }
        for (const overload of overloads) {
          if (getTargetKey(overload) !== targetKey) {
            return undefined;
          }
          if (getModifiersKey(overload) !== modifiersKey) {
            return undefined;
          }
        }
      }

      return resolvedAtDepth[0];
    }

    frontier = nextFrontier;
  }

  return undefined;
};

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

  // 1) Exact receiver match.
  const direct = resolveForReceiver(receiverTypeName);
  if (direct.kind === "resolved") return direct.binding;
  if (direct.kind === "ambiguous") return undefined;

  // 2) Airplane-grade fallback: CLR interface/base-type inheritance.
  // This allows instance-style calls to resolve when TS surface selects a method
  // declared on a derived type's extension bucket (e.g., IQueryable<T>.ToList)
  // but the CLR binding is declared on a base interface (e.g., IEnumerable<T>).
  //
  // Determinism rules:
  // - Prefer the closest base match (BFS).
  // - If multiple matches exist at the same depth with different CLR targets,
  //   treat as unresolved (unsafe).
  const visited = new Set<string>([receiverTypeName]);
  let frontier: readonly string[] = [receiverTypeName];

  for (let depth = 0; depth < 20; depth++) {
    const next: string[] = [];
    for (const t of frontier) {
      for (const sup of getDirectSupertypes(state, t)) {
        if (visited.has(sup)) continue;
        visited.add(sup);
        next.push(sup);
      }
    }

    if (next.length === 0) break;

    const resolvedAtDepth: MemberBinding[] = [];
    let sawAmbiguous = false;

    for (const sup of next) {
      const res = resolveForReceiver(sup);
      if (res.kind === "ambiguous") sawAmbiguous = true;
      if (res.kind === "resolved") resolvedAtDepth.push(res.binding);
    }

    if (resolvedAtDepth.length > 0 || sawAmbiguous) {
      // If any ambiguity exists at the closest depth, do not guess.
      if (sawAmbiguous) return undefined;
      const first = resolvedAtDepth[0];
      if (!first) return undefined;
      const target0 = `${first.binding.type}::${first.binding.member}`;
      const mods0 = getModifiersKey(first);
      for (const b of resolvedAtDepth) {
        const target = `${b.binding.type}::${b.binding.member}`;
        if (target !== target0) return undefined;
        if (getModifiersKey(b) !== mods0) return undefined;
      }
      return first;
    }

    frontier = next;
  }

  return undefined;
};

// ---------------------------------------------------------------------------
// Public member-overload resolution
// ---------------------------------------------------------------------------

/**
 * Look up all member bindings for a TS type alias + member alias.
 *
 * IMPORTANT: Methods can be overloaded, and overloads can differ in ref/out/in
 * modifiers (tsbindgen provides these via `parameterModifiers`). This accessor
 * preserves overload sets so the call converter can select the correct one.
 */
export const resolveMemberOverloads = (
  state: RegistryState,
  typeAlias: string,
  memberAlias: string,
  allowCaseInsensitiveFallback = true,
  preferredClrOwner?: string
): readonly MemberBinding[] | undefined => {
  const resolvedPreferredClrOwner =
    preferredClrOwner ??
    (state.clrTypeNames.has(typeAlias) ? typeAlias : undefined);
  const normalizedTypeAlias = resolveLookupAlias(state, typeAlias);
  for (const ownerAlias of getMemberLookupOwnerAliases(
    state,
    normalizedTypeAlias
  )) {
    const match = resolveMemberOverloadsByHierarchy(
      state,
      ownerAlias,
      memberAlias,
      allowCaseInsensitiveFallback,
      resolvedPreferredClrOwner
    );
    if (match && match.length > 0) return match;
  }

  return undefined;
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
