/**
 * Binding Registry - RegistryState type, signature parsing, alias resolution,
 * supertype/base-type helpers, case-insensitive member resolution,
 * and member overload resolution (single owner + hierarchy walk).
 *
 * All functions in this module are pure (side-effect-free) and operate on an
 * explicit `RegistryState` parameter.
 *
 * Split from binding-registry-resolution.ts for file-size compliance (< 500 LOC).
 */

import { tsbindgenClrTypeNameToTsTypeName } from "../tsbindgen/names.js";
import type {
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
  readonly simpleGlobalBindings: ReadonlyMap<string, SimpleBindingDescriptor>;
  readonly simpleGlobalBindingsLowercase: ReadonlyMap<
    string,
    SimpleBindingDescriptor
  >;
  readonly simpleModuleBindings: ReadonlyMap<string, SimpleBindingDescriptor>;
  readonly simpleModuleBindingsLowercase: ReadonlyMap<
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
  const descriptor =
    state.simpleBindings.get(typeAlias) ??
    state.simpleBindingsLowercase.get(typeAlias.toLowerCase());
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

export const getDirectSupertypes = (
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
    return undefined;
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
