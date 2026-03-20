/**
 * Binding Registry - loading logic for addBindings.
 *
 * This module extracts the `addBindings` body into a free function that
 * mutates the maps owned by the BindingRegistry class via a mutable state
 * parameter.  All pure utility helpers used only during loading live here too.
 */

import { tsbindgenClrTypeNameToTsTypeName } from "../tsbindgen/names.js";
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
  readonly simpleBindings: Map<string, SimpleBindingDescriptor>;
  readonly simpleBindingsLowercase: Map<string, SimpleBindingDescriptor>;
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
  // Airplane-grade: a given bindings file must be loaded exactly once per
  // ProgramContext. Some converters perform on-demand bindings.json loading
  // based on Binding-resolved MemberIds; without this guard, overload sets
  // can silently duplicate and become ambiguous.
  if (state.loadedBindingFiles.has(_filePath)) return;
  state.loadedBindingFiles.add(_filePath);

  const addMemberOverload = (key: string, member: MemberBinding): void => {
    const existing = state.memberOverloads.get(key) ?? [];
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
    existing.push(member);
    state.clrMemberOverloads.set(clrTargetKey, existing);
  };

  const recordClrTypeAlias = (alias: string, clrName: string): void => {
    const names = state.clrTypeNamesByAlias.get(alias) ?? new Set<string>();
    names.add(clrName);
    state.clrTypeNamesByAlias.set(alias, names);
  };

  if (isFullBindingManifest(manifest)) {
    // Full format: hierarchical namespace/type/member structure
    // Index by alias (TS identifier) for quick lookup
    for (const ns of manifest.namespaces) {
      state.namespaces.set(ns.alias, ns);

      // Index types for quick lookup by TS alias
      for (const type of ns.types) {
        state.clrTypeNames.add(type.name);
        state.types.set(type.alias, type);

        // Index members for quick lookup (keyed by "typeAlias.memberAlias")
        for (const member of type.members) {
          const key = `${type.alias}.${member.alias}`;
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
        state.simpleBindings.set(name, descriptor);
        state.simpleBindingsLowercase.set(name.toLowerCase(), descriptor);
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
        const memberBinding: MemberBinding = {
          kind: "method",
          name: method.clrName,
          // No naming policy: TS member names are the CLR names as authored.
          alias: method.clrName,
          signature: method.normalizedSignature,
          semanticSignature: method.semanticSignature,
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
      const typeBinding: TypeBinding = {
        name: tsbType.clrName,
        alias: tsAlias,
        kind: kindFromBindings,
        members,
      };
      state.clrTypeNames.add(tsbType.clrName);
      state.typeLookupAliasMap.set(tsbType.clrName, typeBinding.alias);
      if (!typeBinding.alias.includes(".")) {
        state.typeLookupAliasMap.set(
          `${manifestNamespace}.${typeBinding.alias}`,
          typeBinding.alias
        );
      }
      namespaceTypes.push(typeBinding);

      // Index the type by its TS name.
      state.types.set(typeBinding.alias, typeBinding);
      recordClrTypeAlias(typeBinding.alias, typeBinding.name);

      if (uniqueDerivedAlias && derivedAlias !== typeBinding.alias) {
        state.types.set(derivedAlias, typeBinding);
        state.typeLookupAliasMap.set(derivedAlias, typeBinding.alias);
        recordClrTypeAlias(derivedAlias, typeBinding.name);
      }

      // Also index by simple name if ts alias has arity suffix (e.g., "List_1" -> also index as "List")
      // This is needed because TS exports both List_1 and List as aliases, and TS code uses List<T>
      // IMPORTANT: Only set if not already present - non-generic versions should take precedence
      // (e.g., Action should resolve to System.Action, not System.Action`9)
      const arityMatch = derivedAlias.match(/^(.+)_(\d+)$/);
      const simpleAlias = arityMatch ? arityMatch[1] : null;
      if (
        simpleAlias &&
        simpleAlias !== typeBinding.alias &&
        !state.types.has(simpleAlias)
      ) {
        state.types.set(simpleAlias, typeBinding);
      }
      if (simpleAlias && simpleAlias !== typeBinding.alias) {
        recordClrTypeAlias(simpleAlias, typeBinding.name);
      }

      // Index members for direct lookup.
      for (const member of members) {
        // Key by canonical TS alias.
        const tsKey = `${typeBinding.alias}.${member.alias}`;
        state.members.set(tsKey, member);
        addMemberOverload(tsKey, member);

        // Also key by the derived/simple alias when it is uniquely owned.
        if (uniqueDerivedAlias && derivedAlias !== typeBinding.alias) {
          const derivedKey = `${derivedAlias}.${member.alias}`;
          state.members.set(derivedKey, member);
          addMemberOverload(derivedKey, member);
        }

        // Also key by simple alias if applicable (e.g., "List.Add")
        if (simpleAlias) {
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

      for (const [exportName, exp] of Object.entries(
        dotnetPayload.exports
      )) {
        nsExports.set(exportName, exp);
      }

      state.tsbindgenExports.set(manifestNamespace, nsExports);
    }

    state.namespaces.set(manifestNamespace, {
      name: manifestNamespace,
      alias: manifestNamespace,
      types: namespaceTypes,
    });
  }
};
