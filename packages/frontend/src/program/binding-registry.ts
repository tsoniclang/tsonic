/**
 * Binding Registry - runtime registry of all loaded bindings
 * Supports simple (global/module) and hierarchical (namespace/type/member) formats
 */

import { tsbindgenClrTypeNameToTsTypeName } from "../tsbindgen/names.js";
import type {
  ParameterModifier,
  MemberBinding,
  TypeBinding,
  NamespaceBinding,
  SimpleBindingDescriptor,
  TsbindgenExport,
  BindingFile,
} from "./binding-types.js";
import {
  isFullBindingManifest,
  isTsbindgenBindingFile,
} from "./binding-types.js";

/**
 * Registry of all loaded bindings
 * Supports simple (global/module) and hierarchical (namespace/type/member) formats
 */
export class BindingRegistry {
  private readonly loadedBindingFiles = new Set<string>();

  // Simple format: global/module bindings for identifiers like console, Math, fs
  private readonly simpleBindings = new Map<string, SimpleBindingDescriptor>();

  // Hierarchical format: namespace/type/member bindings
  private readonly namespaces = new Map<string, NamespaceBinding>();
  private readonly types = new Map<string, TypeBinding>(); // Flat lookup by TS name
  private readonly members = new Map<string, MemberBinding>(); // Flat lookup by "type.member"
  private readonly memberOverloads = new Map<string, MemberBinding[]>(); // Overload-aware lookup by "type.member"
  private readonly clrMemberOverloads = new Map<string, MemberBinding[]>(); // Overload-aware lookup by CLR target key
  private readonly tsbindgenExports = new Map<
    string,
    Map<string, TsbindgenExport>
  >();
  private readonly tsSupertypes = new Map<string, Set<string>>();

  /**
   * Extension method index for instance-style calls.
   *
   * Keyed by:
   * - declaring namespace key (CLR namespace with '.' replaced by '_', e.g. "System_Linq")
   * - receiver TS type name (e.g. "IEnumerable_1")
   * - method TS name (e.g. "where")
   *
   * Values are one or more candidates (overloads share the same target).
   */
  private readonly extensionMethods = new Map<
    string,
    Map<string, Map<string, MemberBinding[]>>
  >();

  private getExtensionMethodCandidates(
    namespaceKey: string,
    receiverTypeName: string,
    methodTsName: string
  ): readonly MemberBinding[] | undefined {
    return this.extensionMethods
      .get(namespaceKey)
      ?.get(receiverTypeName)
      ?.get(methodTsName);
  }

  private addSupertype(typeAlias: string, superAlias: string): void {
    if (!typeAlias || !superAlias) return;
    if (typeAlias === superAlias) return;

    const set = this.tsSupertypes.get(typeAlias) ?? new Set<string>();
    set.add(superAlias);
    this.tsSupertypes.set(typeAlias, set);
  }

  private getDirectSupertypes(typeAlias: string): readonly string[] {
    const set = this.tsSupertypes.get(typeAlias);
    if (!set || set.size === 0) return [];
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Resolve an extension method binding target by extension interface name.
   *
   * @param extensionInterfaceName - e.g. "__Ext_System_Linq_IEnumerable_1"
   * @param methodTsName - e.g. "where"
   */
  resolveExtensionMethod(
    extensionInterfaceName: string,
    methodTsName: string,
    callArgumentCount?: number
  ): MemberBinding | undefined {
    const parsed = this.parseExtensionInterfaceName(extensionInterfaceName);
    if (!parsed) return undefined;

    return this.resolveExtensionMethodByKey(
      parsed.namespaceKey,
      parsed.receiverTypeName,
      methodTsName,
      callArgumentCount
    );
  }

  /**
   * Resolve an extension method binding target by explicit (namespaceKey, receiverTypeName).
   *
   * Used when extension methods are emitted as method-table members with explicit `this:`
   * receiver constraints (the declaring interface name no longer encodes the receiver type).
   */
  resolveExtensionMethodByKey(
    namespaceKey: string,
    receiverTypeName: string,
    methodTsName: string,
    callArgumentCount?: number
  ): MemberBinding | undefined {
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
      const candidates = this.getExtensionMethodCandidates(
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
        for (const sup of this.getDirectSupertypes(t)) {
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
  }

  private parseExtensionInterfaceName(
    extensionInterfaceName: string
  ):
    | { readonly namespaceKey: string; readonly receiverTypeName: string }
    | undefined {
    if (!extensionInterfaceName.startsWith("__Ext_")) return undefined;
    const rest = extensionInterfaceName.slice("__Ext_".length);

    // Find the longest namespaceKey prefix we have indexed.
    let bestNamespaceKey: string | undefined;
    for (const namespaceKey of this.extensionMethods.keys()) {
      if (rest.startsWith(`${namespaceKey}_`)) {
        if (
          !bestNamespaceKey ||
          namespaceKey.length > bestNamespaceKey.length
        ) {
          bestNamespaceKey = namespaceKey;
        }
      }
    }
    if (!bestNamespaceKey) return undefined;

    const receiverTypeName = rest.slice(bestNamespaceKey.length + 1);
    if (!receiverTypeName) return undefined;

    return { namespaceKey: bestNamespaceKey, receiverTypeName };
  }

  /**
   * Load a binding manifest file and add its bindings to the registry
   * Supports simple, full, and tsbindgen formats
   */
  addBindings(_filePath: string, manifest: BindingFile): void {
    // Airplane-grade: a given bindings file must be loaded exactly once per
    // ProgramContext. Some converters perform on-demand bindings.json loading
    // based on Binding-resolved MemberIds; without this guard, overload sets
    // can silently duplicate and become ambiguous.
    if (this.loadedBindingFiles.has(_filePath)) return;
    this.loadedBindingFiles.add(_filePath);

    const addMemberOverload = (key: string, member: MemberBinding): void => {
      const existing = this.memberOverloads.get(key) ?? [];
      existing.push(member);
      this.memberOverloads.set(key, existing);
    };

    const addClrMemberOverload = (member: MemberBinding): void => {
      if (member.kind !== "method") return;

      const clrTargetKey = makeClrMemberKey(
        member.binding.assembly,
        member.binding.type,
        member.binding.member
      );
      const existing = this.clrMemberOverloads.get(clrTargetKey) ?? [];
      existing.push(member);
      this.clrMemberOverloads.set(clrTargetKey, existing);
    };

    if (isFullBindingManifest(manifest)) {
      // Full format: hierarchical namespace/type/member structure
      // Index by alias (TS identifier) for quick lookup
      for (const ns of manifest.namespaces) {
        this.namespaces.set(ns.alias, ns);

        // Index types for quick lookup by TS alias
        for (const type of ns.types) {
          this.types.set(type.alias, type);

          // Index members for quick lookup (keyed by "typeAlias.memberAlias")
          for (const member of type.members) {
            const key = `${type.alias}.${member.alias}`;
            this.members.set(key, member);
            addMemberOverload(key, member);
            addClrMemberOverload(member);
          }
        }
      }
    } else if (isTsbindgenBindingFile(manifest)) {
      // tsbindgen format: convert to internal format
      for (const tsbType of manifest.types) {
        // Create members from methods, properties, and fields
        const members: MemberBinding[] = [];

        for (const method of tsbType.methods) {
          const memberBinding: MemberBinding = {
            kind: "method",
            name: method.clrName,
            // No naming policy: TS member names are the CLR names as authored.
            alias: method.clrName,
            signature: method.normalizedSignature,
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
                this.extensionMethods.get(namespaceKey) ??
                new Map<string, Map<string, MemberBinding[]>>();
              if (!this.extensionMethods.has(namespaceKey)) {
                this.extensionMethods.set(namespaceKey, nsMap);
              }

              const receiverMap =
                nsMap.get(receiverTypeName) ??
                new Map<string, MemberBinding[]>();
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
            name: field.clrName,
            alias: field.clrName,
            binding: {
              assembly: field.declaringAssemblyName,
              type: field.declaringClrType,
              member: field.clrName,
            },
          });
        }

        const tsAlias = tsbindgenClrTypeNameToTsTypeName(tsbType.clrName);

        // Record CLR inheritance relationships (base type + interfaces) so extension-method
        // binding lookup can follow the CLR graph deterministically.
        const baseAlias = tsbType.baseType?.clrName
          ? tsbindgenClrTypeNameToTsTypeName(tsbType.baseType.clrName)
          : undefined;
        if (baseAlias) this.addSupertype(tsAlias, baseAlias);

        for (const iface of tsbType.interfaces ?? []) {
          if (!iface?.clrName) continue;
          const ifaceAlias = tsbindgenClrTypeNameToTsTypeName(iface.clrName);
          this.addSupertype(tsAlias, ifaceAlias);
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

        // Index the type by its TS name.
        this.types.set(typeBinding.alias, typeBinding);

        // Also index by simple name if ts alias has arity suffix (e.g., "List_1" -> also index as "List")
        // This is needed because TS exports both List_1 and List as aliases, and TS code uses List<T>
        // IMPORTANT: Only set if not already present - non-generic versions should take precedence
        // (e.g., Action should resolve to System.Action, not System.Action`9)
        const arityMatch = typeBinding.alias.match(/^(.+)_(\d+)$/);
        const simpleAlias = arityMatch ? arityMatch[1] : null;
        if (
          simpleAlias &&
          simpleAlias !== typeBinding.alias &&
          !this.types.has(simpleAlias)
        ) {
          this.types.set(simpleAlias, typeBinding);
        }

        // Index members for direct lookup.
        for (const member of members) {
          // Key by TS name (e.g., "List_1.Add")
          const tsKey = `${typeBinding.alias}.${member.alias}`;
          this.members.set(tsKey, member);
          addMemberOverload(tsKey, member);

          // Also key by simple alias if applicable (e.g., "List.Add")
          if (simpleAlias) {
            const simpleKey = `${simpleAlias}.${member.alias}`;
            this.members.set(simpleKey, member);
            addMemberOverload(simpleKey, member);
          }
        }
      }

      // Optional flattened named exports.
      // These are stable value exports for CLR namespace facade modules and are
      // resolved by Tsonic during import binding (so `import { x }` maps to
      // `global::<DeclaringType>.<member>` in C#).
      if (manifest.exports) {
        const nsExports =
          this.tsbindgenExports.get(manifest.namespace) ??
          new Map<string, TsbindgenExport>();

        for (const [exportName, exp] of Object.entries(manifest.exports)) {
          nsExports.set(exportName, exp);
        }

        this.tsbindgenExports.set(manifest.namespace, nsExports);
      }
    } else {
      // Simple format: global/module bindings
      for (const [name, descriptor] of Object.entries(manifest.bindings)) {
        this.simpleBindings.set(name, descriptor);
      }
    }
  }

  /**
   * Look up a simple global/module binding
   */
  getBinding(name: string): SimpleBindingDescriptor | undefined {
    return this.simpleBindings.get(name);
  }

  /**
   * Look up a namespace binding by TS alias
   */
  getNamespace(tsAlias: string): NamespaceBinding | undefined {
    return this.namespaces.get(tsAlias);
  }

  /**
   * Look up a type binding by TS alias
   */
  getType(tsAlias: string): TypeBinding | undefined {
    return this.types.get(tsAlias);
  }

  /**
   * Look up a member binding by TS type alias and member alias
   */
  getMember(typeAlias: string, memberAlias: string): MemberBinding | undefined {
    const key = `${typeAlias}.${memberAlias}`;
    const direct = this.members.get(key);
    if (direct) return direct;

    // tsbindgen encodes protected CLR members on a synthetic `${TypeName}$protected` class.
    // Those members are still declared on the real CLR type, so bindings must resolve
    // through the owning type alias.
    if (typeAlias.endsWith("$protected")) {
      const ownerAlias = typeAlias.slice(0, -"$protected".length);
      return this.members.get(`${ownerAlias}.${memberAlias}`);
    }

    return undefined;
  }

  /**
   * Look up all member bindings for a TS type alias + member alias.
   *
   * IMPORTANT: Methods can be overloaded, and overloads can differ in ref/out/in
   * modifiers (tsbindgen provides these via `parameterModifiers`). This accessor
   * preserves overload sets so the call converter can select the correct one.
   */
  getMemberOverloads(
    typeAlias: string,
    memberAlias: string
  ): readonly MemberBinding[] | undefined {
    const key = `${typeAlias}.${memberAlias}`;
    const direct = this.memberOverloads.get(key);
    if (direct && direct.length > 0) return direct;

    // See getMember(): map `${TypeName}$protected` to `${TypeName}` for CLR binding lookup.
    if (typeAlias.endsWith("$protected")) {
      const ownerAlias = typeAlias.slice(0, -"$protected".length);
      const ownerKey = `${ownerAlias}.${memberAlias}`;
      const owner = this.memberOverloads.get(ownerKey);
      if (owner && owner.length > 0) return owner;
    }

    return undefined;
  }

  /**
   * Look up all member bindings for a CLR member target.
   *
   * Keyed by declaring assembly, CLR type, and CLR member name.
   */
  getClrMemberOverloads(
    assembly: string,
    clrType: string,
    clrMember: string
  ): readonly MemberBinding[] | undefined {
    return this.clrMemberOverloads.get(
      makeClrMemberKey(assembly, clrType, clrMember)
    );
  }

  /**
   * Look up a tsbindgen flattened named export by CLR namespace + export name.
   */
  getTsbindgenExport(
    namespace: string,
    exportName: string
  ): TsbindgenExport | undefined {
    return this.tsbindgenExports.get(namespace)?.get(exportName);
  }

  /**
   * Get all loaded simple bindings
   */
  getAllBindings(): readonly [string, SimpleBindingDescriptor][] {
    return Array.from(this.simpleBindings.entries());
  }

  /**
   * Get all loaded namespaces
   */
  getAllNamespaces(): readonly NamespaceBinding[] {
    return Array.from(this.namespaces.values());
  }

  /**
   * Get a copy of the types map for passing to the emitter.
   * Returns a new Map to ensure immutability - callers cannot modify the registry.
   */
  getTypesMap(): ReadonlyMap<string, TypeBinding> {
    return new Map(this.types);
  }

  /**
   * Clear all loaded bindings
   */
  clear(): void {
    this.loadedBindingFiles.clear();
    this.simpleBindings.clear();
    this.namespaces.clear();
    this.types.clear();
    this.members.clear();
    this.memberOverloads.clear();
    this.clrMemberOverloads.clear();
    this.extensionMethods.clear();
    this.tsbindgenExports.clear();
  }
}

const makeClrMemberKey = (
  assembly: string,
  clrType: string,
  clrMember: string
): string => `${assembly}:${clrType}::${clrMember}`;

/**
 * Extract CLR namespace key ('.' → '_') from a full CLR type name.
 * Example: "System.Linq.Enumerable" → "System_Linq"
 */
const extractNamespaceKey = (clrType: string): string | undefined => {
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
const extractExtensionReceiverType = (
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
