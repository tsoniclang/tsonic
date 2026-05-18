/**
 * Binding Registry - runtime registry of all loaded bindings
 * Supports simple (global/module) and hierarchical (namespace/type/member) formats
 *
 * This file is a thin facade. Heavy logic lives in:
 *   - binding-registry-resolution.ts  (member & extension-method resolution)
 *   - binding-registry-loading.ts     (addBindings ingestion)
 */

import type {
  MemberBinding,
  TypeBinding,
  NamespaceBinding,
  SimpleBindingDescriptor,
  TsbindgenExport,
  BindingFile,
} from "./binding-types.js";
import type { RegistryState } from "./binding-registry-resolution.js";
import {
  resolveLookupAlias,
  resolveMemberOverloads,
  resolveExtensionMethod,
  resolveExtensionMethodByKey,
  isTypeOrSubtype,
} from "./binding-registry-resolution.js";
import { makeTargetMemberKey } from "./binding-registry-loading.js";
import { addBindingsToState } from "./binding-registry-loading.js";

// ---------------------------------------------------------------------------
// Simple-binding helpers (used by getEmitterTypeMap and external callers)
// ---------------------------------------------------------------------------

export const simpleBindingContributesTypeIdentity = (
  descriptor: SimpleBindingDescriptor
): boolean => {
  const explicit = descriptor.typeSemantics?.contributesTypeIdentity;
  if (explicit !== undefined) {
    return explicit;
  }

  return false;
};

const getSimpleBindingIdentityTargetType = (
  descriptor: SimpleBindingDescriptor
): string => descriptor.staticType ?? descriptor.type;

// ---------------------------------------------------------------------------
// BindingRegistry class (facade)
// ---------------------------------------------------------------------------

/**
 * Registry of all loaded bindings
 * Supports simple (global/module) and hierarchical (namespace/type/member) formats
 */
export class BindingRegistry {
  private readonly loadedBindingFiles = new Set<string>();
  private readonly sourceOwnedTypeAliases = new Set<string>();

  // Simple format: global/module bindings for identifiers like console, Math, fs
  private readonly simpleBindings = new Map<string, SimpleBindingDescriptor>();
  private readonly simpleGlobalBindings = new Map<
    string,
    SimpleBindingDescriptor
  >();
  private readonly simpleModuleBindings = new Map<
    string,
    SimpleBindingDescriptor
  >();

  // Hierarchical format: namespace/type/member bindings
  private readonly namespaces = new Map<string, NamespaceBinding>();
  private readonly types = new Map<string, TypeBinding>(); // Flat lookup by TS name
  private readonly typeLookupAliasMap = new Map<string, string>(); // Provider FQN or qualified TS alias -> canonical TS alias
  private readonly members = new Map<string, MemberBinding>(); // Flat lookup by "type.member"
  private readonly memberOverloads = new Map<string, MemberBinding[]>(); // Overload-aware lookup by "type.member"
  private readonly targetMemberOverloads = new Map<string, MemberBinding[]>(); // Overload-aware lookup by provider target key
  private readonly targetTypeNamesByAlias = new Map<string, Set<string>>();
  private readonly tsbindgenExports = new Map<
    string,
    Map<string, TsbindgenExport>
  >();
  private readonly tsSupertypes = new Map<string, Set<string>>();
  private readonly tsBaseTypes = new Map<string, string>();
  private readonly targetTypeNames = new Set<string>();

  /**
   * Extension method index for instance-style calls.
   *
   * Keyed by:
   * - declaring namespace key (external namespace with '.' replaced by '_', e.g. "System_Linq")
   * - receiver TS type name (e.g. "ProviderIterable_1")
   * - method TS name (e.g. "where")
   *
   * Values are one or more candidates (overloads share the same target).
   */
  private readonly extensionMethods = new Map<
    string,
    Map<string, Map<string, MemberBinding[]>>
  >();

  /** Snapshot of mutable state for use by extracted pure resolution functions. */
  private get state(): RegistryState {
    return {
      types: this.types,
      memberOverloads: this.memberOverloads,
      targetTypeNamesByAlias: this.targetTypeNamesByAlias,
      extensionMethods: this.extensionMethods,
      tsSupertypes: this.tsSupertypes,
      tsBaseTypes: this.tsBaseTypes,
      simpleBindings: this.simpleBindings,
      simpleGlobalBindings: this.simpleGlobalBindings,
      simpleModuleBindings: this.simpleModuleBindings,
      typeLookupAliasMap: this.typeLookupAliasMap,
      targetTypeNames: this.targetTypeNames,
    };
  }

  /**
   * Load a binding manifest file and add its bindings to the registry
   * Supports simple, full, and tsbindgen formats
   */
  addBindings(_filePath: string, manifest: BindingFile): void {
    addBindingsToState(
      {
        loadedBindingFiles: this.loadedBindingFiles,
        sourceOwnedTypeAliases: this.sourceOwnedTypeAliases,
        simpleBindings: this.simpleBindings,
        simpleGlobalBindings: this.simpleGlobalBindings,
        simpleModuleBindings: this.simpleModuleBindings,
        namespaces: this.namespaces,
        types: this.types,
        typeLookupAliasMap: this.typeLookupAliasMap,
        members: this.members,
        memberOverloads: this.memberOverloads,
        targetMemberOverloads: this.targetMemberOverloads,
        targetTypeNamesByAlias: this.targetTypeNamesByAlias,
        extensionMethods: this.extensionMethods,
        tsbindgenExports: this.tsbindgenExports,
        tsSupertypes: this.tsSupertypes,
        tsBaseTypes: this.tsBaseTypes,
        targetTypeNames: this.targetTypeNames,
      },
      _filePath,
      manifest
    );
  }

  /**
   * Look up a simple global/module binding
   */
  getExactBinding(name: string): SimpleBindingDescriptor | undefined {
    return this.simpleBindings.get(name);
  }

  getExactBindingByKind(
    name: string,
    kind: SimpleBindingDescriptor["kind"]
  ): SimpleBindingDescriptor | undefined {
    return kind === "global"
      ? this.simpleGlobalBindings.get(name)
      : this.simpleModuleBindings.get(name);
  }

  /**
   * Look up a simple global/module binding by exact authored name.
   */
  getBinding(name: string): SimpleBindingDescriptor | undefined {
    return this.simpleBindings.get(name);
  }

  getBindingByKind(
    name: string,
    kind: SimpleBindingDescriptor["kind"]
  ): SimpleBindingDescriptor | undefined {
    return kind === "global"
      ? this.simpleGlobalBindings.get(name)
      : this.simpleModuleBindings.get(name);
  }

  hasSourceOwnedTypeAlias(typeAlias: string): boolean {
    return this.sourceOwnedTypeAliases.has(typeAlias);
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
    return this.types.get(resolveLookupAlias(this.state, tsAlias));
  }

  /**
   * Check whether a target type name exists in loaded bindings.
   */
  hasTargetTypeName(targetTypeName: string): boolean {
    return this.targetTypeNames.has(targetTypeName);
  }

  /**
   * Look up a member binding by TS type alias and member alias
   */
  getMember(typeAlias: string, memberAlias: string): MemberBinding | undefined {
    const overloads = this.getMemberOverloads(typeAlias, memberAlias);
    return overloads?.[0];
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
    memberAlias: string,
    preferredTargetOwner?: string
  ): readonly MemberBinding[] | undefined {
    return resolveMemberOverloads(
      this.state,
      typeAlias,
      memberAlias,
      preferredTargetOwner
    );
  }

  /**
   * Look up all member bindings for a provider member target.
   *
   * Keyed by declaring owner, target type, and target member name.
   */
  getTargetMemberOverloads(
    assembly: string,
    targetType: string,
    targetMember: string
  ): readonly MemberBinding[] | undefined {
    return this.targetMemberOverloads.get(
      makeTargetMemberKey(assembly, targetType, targetMember)
    );
  }

  /**
   * Resolve an extension method binding target by extension interface name.
   *
   * @param extensionInterfaceName - e.g. "__Ext_Query_Iterable_1"
   * @param methodTsName - e.g. "where"
   */
  resolveExtensionMethod(
    extensionInterfaceName: string,
    methodTsName: string,
    callArgumentCount?: number
  ): MemberBinding | undefined {
    return resolveExtensionMethod(
      this.state,
      extensionInterfaceName,
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
    return resolveExtensionMethodByKey(
      this.state,
      namespaceKey,
      receiverTypeName,
      methodTsName,
      callArgumentCount
    );
  }

  /**
   * Look up a tsbindgen flattened named export by external namespace + export name.
   */
  getTsbindgenExport(
    namespace: string,
    exportName: string
  ): TsbindgenExport | undefined {
    return this.tsbindgenExports.get(namespace)?.get(exportName);
  }

  getAllTsbindgenExports(): readonly (readonly [
    namespace: string,
    exportName: string,
    descriptor: TsbindgenExport,
  ])[] {
    const result: (readonly [
      namespace: string,
      exportName: string,
      descriptor: TsbindgenExport,
    ])[] = [];

    for (const [namespace, exports] of this.tsbindgenExports) {
      for (const [exportName, descriptor] of exports) {
        result.push([namespace, exportName, descriptor]);
      }
    }

    return result;
  }

  /**
   * Get all loaded simple bindings
   */
  getAllBindings(): readonly [string, SimpleBindingDescriptor][] {
    return Array.from(this.simpleBindings.entries());
  }

  isTypeOrSubtype(typeAlias: string, superAlias: string): boolean {
    return isTypeOrSubtype(this.state, typeAlias, superAlias);
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
   * Get the type map used by the emitter.
   *
   * This includes:
   * - hierarchical tsbindgen/full-manifest types
   * - simple global bindings that are type-like (e.g. Error, Date, Uint8Array)
   *
   * Expression lowering still uses the full binding registry. This view exists so
   * type emission can resolve ambient global constructors/types that are authored
   * via simple bindings instead of hierarchical type manifests.
   */
  getEmitterTypeMap(): ReadonlyMap<string, TypeBinding> {
    const result = new Map(this.types);

    for (const [alias, descriptor] of this.simpleBindings) {
      if (!simpleBindingContributesTypeIdentity(descriptor)) {
        continue;
      }
      const identityTargetType = getSimpleBindingIdentityTargetType(descriptor);

      if (!result.has(alias)) {
        result.set(alias, {
          alias,
          name: identityTargetType,
          kind: "class",
          members: [],
        });
      }
    }

    return result;
  }

  /**
   * Clear all loaded bindings
   */
  clear(): void {
    this.loadedBindingFiles.clear();
    this.simpleBindings.clear();
    this.simpleGlobalBindings.clear();
    this.simpleModuleBindings.clear();
    this.namespaces.clear();
    this.types.clear();
    this.typeLookupAliasMap.clear();
    this.members.clear();
    this.memberOverloads.clear();
    this.targetMemberOverloads.clear();
    this.targetTypeNamesByAlias.clear();
    this.extensionMethods.clear();
    this.tsbindgenExports.clear();
    this.tsSupertypes.clear();
    this.tsBaseTypes.clear();
    this.targetTypeNames.clear();
  }
}
