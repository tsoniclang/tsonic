/**
 * Binding Registry - loading logic for addBindings.
 *
 * This module extracts the `addBindings` body into a free function that
 * mutates the maps owned by the BindingRegistry class via a mutable state
 * parameter.  All pure utility helpers used only during loading live here too.
 */

import { tsbindgenClrTypeNameToTsTypeName } from "../tsbindgen/names.js";
import { parseMethodSignature } from "../ir/type-system/internal/universe/clr-raw-converter.js";
import type {
  MemberBinding,
  TypeBinding,
  NamespaceBinding,
  SimpleBindingDescriptor,
  TsbindgenExport,
  BindingFile,
} from "./binding-types.js";
import { isFullBindingManifest } from "./binding-types.js";
import { getDotnetBindingPayload } from "./dotnet-binding-payload.js";

// ---------------------------------------------------------------------------
// MutableRegistryState – writable view into BindingRegistry maps
// ---------------------------------------------------------------------------

/**
 * Writable view of the BindingRegistry internal state used during loading.
 */
export type MutableRegistryState = {
  readonly loadedBindingFiles: Set<string>;
  readonly sourceOwnedTypeAliases: Set<string>;
  readonly simpleBindings: Map<string, SimpleBindingDescriptor>;
  readonly simpleGlobalBindings: Map<string, SimpleBindingDescriptor>;
  readonly simpleModuleBindings: Map<string, SimpleBindingDescriptor>;
  readonly namespaces: Map<string, NamespaceBinding>;
  readonly types: Map<string, TypeBinding>;
  readonly typeLookupAliasMap: Map<string, string>;
  readonly members: Map<string, MemberBinding>;
  readonly memberOverloads: Map<string, MemberBinding[]>;
  readonly clrMemberOverloads: Map<string, MemberBinding[]>;
  readonly clrTypeNamesByAlias: Map<string, Set<string>>;
  readonly extensionMethods: Map<
    string,
    Map<string, Map<string, MemberBinding[]>>
  >;
  readonly tsbindgenExports: Map<string, Map<string, TsbindgenExport>>;
  readonly tsSupertypes: Map<string, Set<string>>;
  readonly tsBaseTypes: Map<string, string>;
  readonly clrTypeNames: Set<string>;
};

// ---------------------------------------------------------------------------
// Pure utility helpers
// ---------------------------------------------------------------------------

export const makeClrMemberKey = (
  assembly: string,
  clrType: string,
  clrMember: string
): string => `${assembly}:${clrType}::${clrMember}`;

/**
 * Extract CLR namespace key ('.' -> '_') from a full CLR type name.
 * Example: "System.Linq.Enumerable" -> "System_Linq"
 */
export const extractNamespaceKey = (clrType: string): string | undefined => {
  const lastDot = clrType.lastIndexOf(".");
  if (lastDot <= 0) return undefined;
  return clrType.slice(0, lastDot).replace(/\./g, "_");
};

/**
 * Extract the extension receiver TS type name from a tsbindgen normalized signature.
 *
 * Format: "Name|(ParamTypes):ReturnType|static=true"
 * Example: "Where|(IEnumerable_1,Func_2):IEnumerable_1|static=true"
 *
 * Returns the first parameter type name (stripped of byref suffix and namespace prefix).
 */
export const extractExtensionReceiverType = (
  normalizedSignature: string
): string | undefined => {
  const paramsMatch = normalizedSignature.match(/\|\(([^)]*)\):/);
  const paramsStr = paramsMatch?.[1]?.trim();
  if (!paramsStr) return undefined;

  const [first] = splitSignatureTypeList(paramsStr);
  if (!first) return undefined;

  let receiver = first.trim();
  if (receiver.endsWith("&")) receiver = receiver.slice(0, -1);
  if (receiver.endsWith("[]")) receiver = receiver.slice(0, -2);
  const lastDot = receiver.lastIndexOf(".");
  if (lastDot >= 0) receiver = receiver.slice(lastDot + 1);
  return receiver || undefined;
};

/**
 * Split a comma-delimited type list, respecting nested bracket depth.
 * tsbindgen signatures use CLR-style nested generic brackets in some contexts.
 */
const splitSignatureTypeList = (str: string): string[] => {
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

const stableSerialize = (value: unknown): string => JSON.stringify(value);

const mergeMemberBindings = (
  existing: readonly MemberBinding[],
  incoming: readonly MemberBinding[],
  context: string
): readonly MemberBinding[] => {
  const merged = [...existing];
  const seen = new Map<string, string>();

  for (const member of existing) {
    const key = `${member.kind}:${member.alias}:${member.binding.assembly}:${member.binding.type}:${member.binding.member}:${member.signature ?? ""}`;
    seen.set(key, stableSerialize(member));
  }

  for (const member of incoming) {
    const key = `${member.kind}:${member.alias}:${member.binding.assembly}:${member.binding.type}:${member.binding.member}:${member.signature ?? ""}`;
    const serialized = stableSerialize(member);
    const previous = seen.get(key);
    if (previous !== undefined) {
      if (previous !== serialized) {
        throw new Error(
          `Conflicting member binding for ${context}:${member.alias}`
        );
      }
      continue;
    }

    seen.set(key, serialized);
    merged.push(member);
  }

  return merged;
};

const mergeTypeBinding = (
  existing: TypeBinding | undefined,
  incoming: TypeBinding,
  context: string
): TypeBinding => {
  if (!existing) {
    return incoming;
  }

  if (existing.name !== incoming.name || existing.kind !== incoming.kind) {
    throw new Error(
      `Conflicting type binding for ${context}:${incoming.alias}`
    );
  }

  return {
    ...existing,
    members: mergeMemberBindings(
      existing.members,
      incoming.members,
      `${context}.${incoming.alias}`
    ),
  };
};

const mergeNamespaceBinding = (
  existing: NamespaceBinding | undefined,
  incoming: NamespaceBinding
): NamespaceBinding => {
  if (!existing) {
    return incoming;
  }

  if (existing.name !== incoming.name) {
    throw new Error(`Conflicting namespace binding for ${incoming.alias}`);
  }

  const typeOrder: string[] = [];
  const mergedTypes = new Map<string, TypeBinding>();

  for (const type of existing.types) {
    typeOrder.push(type.alias);
    mergedTypes.set(type.alias, type);
  }

  for (const type of incoming.types) {
    if (!mergedTypes.has(type.alias)) {
      typeOrder.push(type.alias);
    }
    mergedTypes.set(
      type.alias,
      mergeTypeBinding(
        mergedTypes.get(type.alias),
        type,
        `${incoming.alias}`
      )
    );
  }

  return {
    ...existing,
    types: typeOrder
      .map((alias) => mergedTypes.get(alias))
      .filter((type): type is TypeBinding => type !== undefined),
  };
};

// ---------------------------------------------------------------------------
// Supertype / base-type mutation helpers
// ---------------------------------------------------------------------------

const addSupertype = (
  state: MutableRegistryState,
  typeAlias: string,
  superAlias: string
): void => {
  if (!typeAlias || !superAlias) return;
  if (typeAlias === superAlias) return;

  const set = state.tsSupertypes.get(typeAlias) ?? new Set<string>();
  set.add(superAlias);
  state.tsSupertypes.set(typeAlias, set);
};

const setBaseType = (
  state: MutableRegistryState,
  typeAlias: string,
  baseAlias: string
): void => {
  if (!typeAlias || !baseAlias) return;
  if (typeAlias === baseAlias) return;
  state.tsBaseTypes.set(typeAlias, baseAlias);
};

const isSyntheticSourceTypeManifestPath = (filePath: string): boolean =>
  filePath.endsWith("::synthetic-source-types");

const getQualifiedTypeAlias = (
  namespaceName: string,
  type: Pick<TypeBinding, "name" | "alias">
): string =>
  type.name === type.alias ? `${namespaceName}.${type.alias}` : type.name;

const remapRegisteredTypeAlias = (
  state: MutableRegistryState,
  fromAlias: string,
  toAlias: string,
  expectedTypeName: string
): void => {
  if (fromAlias === toAlias) {
    return;
  }

  const existing = state.types.get(fromAlias);
  if (!existing) {
    return;
  }
  if (existing.name !== expectedTypeName) {
    return;
  }

  const renamedExisting: TypeBinding = {
    ...existing,
    alias: toAlias,
  };

  const existingAtDestination = state.types.get(toAlias);
  if (
    existingAtDestination &&
    (existingAtDestination.name !== renamedExisting.name ||
      existingAtDestination.kind !== renamedExisting.kind)
  ) {
    throw new Error(`Conflicting type binding for ${toAlias}`);
  }

  state.types.delete(fromAlias);
  state.types.set(
    toAlias,
    mergeTypeBinding(existingAtDestination, renamedExisting, toAlias)
  );

  for (const [lookupAlias, canonicalAlias] of Array.from(
    state.typeLookupAliasMap.entries()
  )) {
    if (canonicalAlias !== fromAlias) {
      continue;
    }
    if (lookupAlias === fromAlias) {
      state.typeLookupAliasMap.delete(lookupAlias);
      continue;
    }
    state.typeLookupAliasMap.set(lookupAlias, toAlias);
  }

  const clrNames = state.clrTypeNamesByAlias.get(fromAlias);
  if (clrNames) {
    const destinationNames = state.clrTypeNamesByAlias.get(toAlias) ?? new Set();
    for (const clrName of clrNames) {
      destinationNames.add(clrName);
    }
    state.clrTypeNamesByAlias.set(toAlias, destinationNames);
    state.clrTypeNamesByAlias.delete(fromAlias);
  }

  const directBaseType = state.tsBaseTypes.get(fromAlias);
  if (directBaseType !== undefined) {
    state.tsBaseTypes.set(
      toAlias,
      directBaseType === fromAlias ? toAlias : directBaseType
    );
    state.tsBaseTypes.delete(fromAlias);
  }
  for (const [typeAlias, baseAlias] of Array.from(state.tsBaseTypes.entries())) {
    if (baseAlias === fromAlias) {
      state.tsBaseTypes.set(typeAlias, toAlias);
    }
  }

  const directSupertypes = state.tsSupertypes.get(fromAlias);
  if (directSupertypes) {
    state.tsSupertypes.set(
      toAlias,
      new Set(
        Array.from(directSupertypes, (candidate) =>
          candidate === fromAlias ? toAlias : candidate
        )
      )
    );
    state.tsSupertypes.delete(fromAlias);
  }
  for (const [typeAlias, supertypes] of Array.from(state.tsSupertypes.entries())) {
    if (!supertypes.has(fromAlias)) {
      continue;
    }
    const remapped = new Set<string>();
    for (const candidate of supertypes) {
      remapped.add(candidate === fromAlias ? toAlias : candidate);
    }
    state.tsSupertypes.set(typeAlias, remapped);
  }

  for (const member of existing.members) {
    const oldKey = `${fromAlias}.${member.alias}`;
    const newKey = `${toAlias}.${member.alias}`;
    const directMember = state.members.get(oldKey);
    if (directMember) {
      state.members.delete(oldKey);
      state.members.set(newKey, directMember);
    }
    const overloads = state.memberOverloads.get(oldKey);
    if (overloads) {
      const destination = state.memberOverloads.get(newKey) ?? [];
      for (const overload of overloads) {
        const serialized = stableSerialize(overload);
        if (
          !destination.some(
            (candidate) => stableSerialize(candidate) === serialized
          )
        ) {
          destination.push(overload);
        }
      }
      state.memberOverloads.delete(oldKey);
      state.memberOverloads.set(newKey, destination);
    }
  }

  for (const [namespaceAlias, namespace] of Array.from(state.namespaces.entries())) {
    let changed = false;
    const remappedTypes = namespace.types.map((type) => {
      if (type.alias !== fromAlias || type.name !== expectedTypeName) {
        return type;
      }
      changed = true;
      return renamedExisting;
    });
    if (changed) {
      state.namespaces.set(namespaceAlias, {
        ...namespace,
        types: remappedTypes,
      });
    }
  }

  for (const [, receiverMapByNamespace] of Array.from(
    state.extensionMethods.entries()
  )) {
    const receiverMap = receiverMapByNamespace.get(fromAlias);
    if (!receiverMap) {
      continue;
    }
    const destination =
      receiverMapByNamespace.get(toAlias) ?? new Map<string, MemberBinding[]>();
    for (const [memberAlias, overloads] of Array.from(receiverMap.entries())) {
      const existingOverloads = destination.get(memberAlias) ?? [];
      for (const overload of overloads) {
        const serialized = stableSerialize(overload);
        if (
          !existingOverloads.some(
            (candidate: MemberBinding) => stableSerialize(candidate) === serialized
          )
        ) {
          existingOverloads.push(overload);
        }
      }
      destination.set(memberAlias, existingOverloads);
    }
    receiverMapByNamespace.set(toAlias, destination);
    receiverMapByNamespace.delete(fromAlias);
  }
};

const canonicalizeTypeBinding = (
  state: MutableRegistryState,
  namespaceName: string,
  type: TypeBinding,
  preferSimpleAlias: boolean
): TypeBinding => {
  const existing = state.types.get(type.alias);
  if (!existing) {
    return type;
  }

  if (existing.name === type.name && existing.kind === type.kind) {
    return type;
  }

  if (preferSimpleAlias) {
    if (state.sourceOwnedTypeAliases.has(type.alias)) {
      const qualifiedAlias = getQualifiedTypeAlias(namespaceName, type);
      return qualifiedAlias === type.alias
        ? type
        : {
            ...type,
            alias: qualifiedAlias,
          };
    }

    const existingQualifiedAlias = getQualifiedTypeAlias(namespaceName, existing);
    if (existingQualifiedAlias === existing.alias) {
      throw new Error(`Conflicting type binding for ${namespaceName}:${type.alias}`);
    }

    remapRegisteredTypeAlias(
      state,
      type.alias,
      existingQualifiedAlias,
      existing.name
    );
    return type;
  }

  const qualifiedAlias = getQualifiedTypeAlias(namespaceName, type);

  return {
    ...type,
    alias: qualifiedAlias,
  };
};

const throwOnExplicitAliasConflict = (
  state: MutableRegistryState,
  namespaceName: string,
  type: TypeBinding
): void => {
  const existing = state.types.get(type.alias);
  if (!existing) {
    return;
  }

  if (existing.name === type.name && existing.kind === type.kind) {
    return;
  }

  const existingNamespace = extractNamespaceKey(existing.name)?.replace(/_/g, ".");
  if (existingNamespace !== namespaceName) {
    return;
  }

  throw new Error(`Conflicting type binding for ${namespaceName}:${type.alias}`);
};

// ---------------------------------------------------------------------------
// addBindings – the main loading entry point
// ---------------------------------------------------------------------------

/**
 * Load a binding manifest file and add its bindings to the registry state.
 * Supports simple, full, and tsbindgen formats.
 */
export const addBindingsToState = (
  state: MutableRegistryState,
  _filePath: string,
  manifest: BindingFile
): void => {
  const preferSimpleAlias = isSyntheticSourceTypeManifestPath(_filePath);
  // Airplane-grade: a given bindings file must be loaded exactly once per
  // ProgramContext. Some converters perform on-demand bindings.json loading
  // based on Binding-resolved MemberIds; without this guard, overload sets
  // can silently duplicate and become ambiguous.
  if (state.loadedBindingFiles.has(_filePath)) return;
  state.loadedBindingFiles.add(_filePath);

  const addMemberOverload = (key: string, member: MemberBinding): void => {
    const existing = state.memberOverloads.get(key) ?? [];
    const serialized = stableSerialize(member);
    if (existing.some((candidate) => stableSerialize(candidate) === serialized)) {
      return;
    }
    existing.push(member);
    state.memberOverloads.set(key, existing);
  };

  const addClrMemberOverload = (member: MemberBinding): void => {
    if (member.kind !== "method") return;

    const clrTargetKey = makeClrMemberKey(
      member.binding.assembly,
      member.binding.type,
      member.binding.member
    );
    const existing = state.clrMemberOverloads.get(clrTargetKey) ?? [];
    const serialized = stableSerialize(member);
    if (existing.some((candidate) => stableSerialize(candidate) === serialized)) {
      return;
    }
    existing.push(member);
    state.clrMemberOverloads.set(clrTargetKey, existing);
  };

  const recordClrTypeAlias = (alias: string, clrName: string): void => {
    const names = state.clrTypeNamesByAlias.get(alias) ?? new Set<string>();
    names.add(clrName);
    state.clrTypeNamesByAlias.set(alias, names);
  };

  const setPreferredSimpleBinding = (
    name: string,
    descriptor: SimpleBindingDescriptor
  ): void => {
    const existing = state.simpleBindings.get(name);
    if (
      existing === undefined ||
      descriptor.kind === "global" ||
      existing.kind !== "global"
    ) {
      state.simpleBindings.set(name, descriptor);
    }
  };

  if (isFullBindingManifest(manifest)) {
    // Full format: hierarchical namespace/type/member structure
    // Index by alias (TS identifier) for quick lookup
    for (const ns of manifest.namespaces) {
      const canonicalTypes = ns.types.map((type) =>
        canonicalizeTypeBinding(state, ns.name, type, preferSimpleAlias)
      );
      state.namespaces.set(
        ns.alias,
        mergeNamespaceBinding(state.namespaces.get(ns.alias), {
          ...ns,
          types: canonicalTypes,
        })
      );

      // Index types for quick lookup by TS alias
      for (const type of canonicalTypes) {
        if (preferSimpleAlias && !type.alias.includes(".")) {
          state.sourceOwnedTypeAliases.add(type.alias);
        }
        const existing = state.types.get(type.alias);
        const merged = mergeTypeBinding(existing, type, `${ns.alias}`);
        state.clrTypeNames.add(merged.name);
        state.types.set(merged.alias, merged);
        if (!state.typeLookupAliasMap.has(type.name)) {
          state.typeLookupAliasMap.set(type.name, merged.alias);
        }
        if (!merged.alias.includes(".")) {
          state.typeLookupAliasMap.set(
            `${ns.name}.${type.alias}`,
            merged.alias
          );
        }
        const simpleClrName = merged.name.split(".").pop();
        if (
          simpleClrName &&
          simpleClrName !== merged.alias &&
          !state.types.has(simpleClrName) &&
          !state.typeLookupAliasMap.has(simpleClrName)
        ) {
          state.typeLookupAliasMap.set(simpleClrName, merged.alias);
        }
        recordClrTypeAlias(merged.alias, merged.name);

        // Index members for quick lookup (keyed by "typeAlias.memberAlias")
        for (const member of merged.members) {
          const key = `${merged.alias}.${member.alias}`;
          state.members.set(key, member);
          addMemberOverload(key, member);
          addClrMemberOverload(member);
        }
      }
    }
  } else {
    const dotnetPayload = getDotnetBindingPayload(manifest);
    if (!dotnetPayload) {
      if (!("bindings" in manifest)) {
        return;
      }
      // Simple format: global/module bindings
      for (const [name, descriptor] of Object.entries(manifest.bindings)) {
        if (descriptor.kind === "global") {
          state.simpleGlobalBindings.set(name, descriptor);
        } else {
          state.simpleModuleBindings.set(name, descriptor);
        }
        setPreferredSimpleBinding(name, descriptor);
      }
      return;
    }

    const manifestNamespace = dotnetPayload.namespace;
    // tsbindgen format: convert to internal format
    const namespaceTypes: TypeBinding[] = [];
    const derivedAliasCounts = new Map<string, number>();

    for (const tsbType of dotnetPayload.types) {
      const derivedAlias = tsbindgenClrTypeNameToTsTypeName(tsbType.clrName);
      derivedAliasCounts.set(
        derivedAlias,
        (derivedAliasCounts.get(derivedAlias) ?? 0) + 1
      );
    }

    for (const tsbType of dotnetPayload.types) {
      // Create members from methods, properties, and fields
      const members: MemberBinding[] = [];

      for (const method of tsbType.methods) {
        const parsedSemanticSignature =
          method.semanticSignature ??
          (method.normalizedSignature
            ? (() => {
                const parsed = parseMethodSignature(
                  method.normalizedSignature,
                  method as never
                );
                return {
                  ...(parsed.typeParameters.length > 0
                    ? {
                        typeParameters: parsed.typeParameters.map(
                          (parameter) => parameter.name
                        ),
                      }
                    : {}),
                  parameters: parsed.parameters.map((parameter) => ({
                    kind: "parameter" as const,
                    pattern: {
                      kind: "identifierPattern" as const,
                      name: parameter.name,
                    },
                    type: parameter.type,
                    isOptional: parameter.isOptional,
                    isRest: parameter.isRest,
                    passing: parameter.mode,
                  })),
                  ...(parsed.returnType.kind !== "voidType"
                    ? { returnType: parsed.returnType }
                    : {}),
                };
              })()
            : undefined);
        const memberBinding: MemberBinding = {
          kind: "method",
          name: method.clrName,
          // No naming policy: TS member names are the CLR names as authored.
          alias: method.clrName,
          signature: method.normalizedSignature,
          semanticSignature: parsedSemanticSignature,
          overloadFamily: method.overloadFamily,
          parameterCount: method.parameterCount,
          binding: {
            assembly: method.declaringAssemblyName,
            type: method.declaringClrType,
            // member = clrName (what C# emits, e.g., "Add")
            member: method.clrName,
          },
          // Include parameter modifiers for ref/out/in parameters
          parameterModifiers: method.parameterModifiers,
          isExtensionMethod: method.isExtensionMethod ?? false,
          emitSemantics: method.emitSemantics,
          receiverExpectedType:
            method.isExtensionMethod === true
              ? parsedSemanticSignature?.parameters[0]?.type
              : undefined,
        };

        members.push(memberBinding);

        addClrMemberOverload(memberBinding);

        // Index extension methods by (declaring namespace, receiver type, method name).
        if (method.isExtensionMethod && method.normalizedSignature) {
          const receiverTypeName = extractExtensionReceiverType(
            method.normalizedSignature
          );
          const namespaceKey = extractNamespaceKey(method.declaringClrType);
          if (receiverTypeName && namespaceKey) {
            const nsMap =
              state.extensionMethods.get(namespaceKey) ??
              new Map<string, Map<string, MemberBinding[]>>();
            if (!state.extensionMethods.has(namespaceKey)) {
              state.extensionMethods.set(namespaceKey, nsMap);
            }

            const receiverMap =
              nsMap.get(receiverTypeName) ?? new Map<string, MemberBinding[]>();
            if (!nsMap.has(receiverTypeName)) {
              nsMap.set(receiverTypeName, receiverMap);
            }

            const list = receiverMap.get(memberBinding.alias) ?? [];
            list.push(memberBinding);
            receiverMap.set(memberBinding.alias, list);
          }
        }
      }

      for (const prop of tsbType.properties) {
        members.push({
          kind: "property",
          signature: prop.normalizedSignature,
          semanticType: prop.semanticType,
          semanticOptional: prop.semanticOptional,
          name: prop.clrName,
          alias: prop.clrName,
          binding: {
            assembly: prop.declaringAssemblyName,
            type: prop.declaringClrType,
            member: prop.clrName,
          },
        });
      }

      for (const field of tsbType.fields) {
        // Fields are treated as properties for binding purposes
        members.push({
          kind: "property",
          signature: field.normalizedSignature,
          semanticType: field.semanticType,
          semanticOptional: field.semanticOptional,
          name: field.clrName,
          alias: field.clrName,
          binding: {
            assembly: field.declaringAssemblyName,
            type: field.declaringClrType,
            member: field.clrName,
          },
        });
      }

      const derivedAlias = tsbindgenClrTypeNameToTsTypeName(tsbType.clrName);
      const tsAlias = tsbType.alias ?? derivedAlias;
      const uniqueDerivedAlias =
        (derivedAliasCounts.get(derivedAlias) ?? 0) === 1;

      // Record CLR inheritance relationships (base type + interfaces) so extension-method
      // binding lookup can follow the CLR graph deterministically.
      const baseAlias = tsbType.baseType?.clrName
        ? tsbindgenClrTypeNameToTsTypeName(tsbType.baseType.clrName)
        : undefined;
      if (baseAlias) {
        setBaseType(state, tsAlias, baseAlias);
        addSupertype(state, tsAlias, baseAlias);
      }

      for (const iface of tsbType.interfaces ?? []) {
        if (!iface?.clrName) continue;
        const ifaceAlias = tsbindgenClrTypeNameToTsTypeName(iface.clrName);
        addSupertype(state, tsAlias, ifaceAlias);
      }

      const kindFromBindings = (() => {
        switch (tsbType.kind) {
          case "Interface":
            return "interface" as const;
          case "Struct":
            return "struct" as const;
          case "Enum":
            return "enum" as const;
          case "Class":
          default:
            return "class" as const;
        }
      })();

      // Create TypeBinding - TS alias is derived deterministically from CLR name.
      const rawTypeBinding: TypeBinding = {
        name: tsbType.clrName,
        alias: tsAlias,
        kind: kindFromBindings,
        members,
      };
      if (tsbType.alias) {
        throwOnExplicitAliasConflict(state, manifestNamespace, rawTypeBinding);
      }
      const typeBinding = canonicalizeTypeBinding(
        state,
        manifestNamespace,
        rawTypeBinding,
        preferSimpleAlias
      );
      const mergedTypeBinding = mergeTypeBinding(
        state.types.get(typeBinding.alias),
        typeBinding,
        `${manifestNamespace}`
      );
      state.clrTypeNames.add(tsbType.clrName);
      if (!state.typeLookupAliasMap.has(tsbType.clrName)) {
        state.typeLookupAliasMap.set(tsbType.clrName, mergedTypeBinding.alias);
      }
      if (!mergedTypeBinding.alias.includes(".")) {
        state.typeLookupAliasMap.set(
          `${manifestNamespace}.${tsAlias}`,
          mergedTypeBinding.alias
        );
      }
      namespaceTypes.push(mergedTypeBinding);

      // Index the type by its TS name.
      state.types.set(mergedTypeBinding.alias, mergedTypeBinding);
      recordClrTypeAlias(mergedTypeBinding.alias, mergedTypeBinding.name);

      if (tsAlias !== mergedTypeBinding.alias) {
        recordClrTypeAlias(tsAlias, mergedTypeBinding.name);
      }

      const registeredDerivedAlias =
        uniqueDerivedAlias &&
        derivedAlias !== mergedTypeBinding.alias &&
        !state.types.has(derivedAlias) &&
        !state.typeLookupAliasMap.has(derivedAlias);
      if (registeredDerivedAlias) {
        state.types.set(derivedAlias, mergedTypeBinding);
        state.typeLookupAliasMap.set(derivedAlias, mergedTypeBinding.alias);
        recordClrTypeAlias(derivedAlias, mergedTypeBinding.name);
      }

      // Also index by simple name if ts alias has arity suffix (e.g., "List_1" -> also index as "List")
      // This is needed because TS exports both List_1 and List as aliases, and TS code uses List<T>
      // IMPORTANT: Only set if not already present - non-generic versions should take precedence
      // (e.g., Action should resolve to System.Action, not System.Action`9)
      const arityMatch = derivedAlias.match(/^(.+)_(\d+)$/);
      const simpleAlias = arityMatch ? arityMatch[1] : null;
      const registeredSimpleAlias =
        simpleAlias &&
        simpleAlias !== mergedTypeBinding.alias &&
        !state.types.has(simpleAlias);
      if (registeredSimpleAlias) {
        state.types.set(simpleAlias, mergedTypeBinding);
      }
      if (registeredSimpleAlias && simpleAlias) {
        recordClrTypeAlias(simpleAlias, mergedTypeBinding.name);
      }

      // Index members for direct lookup.
      for (const member of mergedTypeBinding.members) {
        // Key by canonical TS alias.
        const tsKey = `${mergedTypeBinding.alias}.${member.alias}`;
        state.members.set(tsKey, member);
        addMemberOverload(tsKey, member);

        // Also key by the derived/simple alias when it is uniquely owned.
        if (registeredDerivedAlias) {
          const derivedKey = `${derivedAlias}.${member.alias}`;
          state.members.set(derivedKey, member);
          addMemberOverload(derivedKey, member);
        }

        if (tsAlias !== mergedTypeBinding.alias) {
          const authoredAliasKey = `${tsAlias}.${member.alias}`;
          state.members.set(authoredAliasKey, member);
          addMemberOverload(authoredAliasKey, member);
        }

        // Also key by simple alias if applicable (e.g., "List.Add")
        if (registeredSimpleAlias && simpleAlias) {
          const simpleKey = `${simpleAlias}.${member.alias}`;
          state.members.set(simpleKey, member);
          addMemberOverload(simpleKey, member);
        }
      }
    }

    // Optional flattened named exports.
    // These are stable value exports for CLR namespace facade modules and are
    // resolved by Tsonic during import binding (so `import { x }` maps to
    // `global::<DeclaringType>.<member>` in C#).
    if (dotnetPayload.exports) {
      const nsExports =
        state.tsbindgenExports.get(manifestNamespace) ??
        new Map<string, TsbindgenExport>();

      for (const [exportName, exp] of Object.entries(dotnetPayload.exports)) {
        nsExports.set(exportName, exp);
      }

      state.tsbindgenExports.set(manifestNamespace, nsExports);
    }

    state.namespaces.set(
      manifestNamespace,
      mergeNamespaceBinding(state.namespaces.get(manifestNamespace), {
        name: manifestNamespace,
        alias: manifestNamespace,
        types: namespaceTypes,
      })
    );
  }
};
