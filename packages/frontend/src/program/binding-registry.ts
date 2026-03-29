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
import { makeClrMemberKey } from "./binding-registry-loading.js";
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

const getSimpleBindingIdentityClrType = (
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
  private readonly typeLookupAliasMap = new Map<string, string>(); // CLR FQN or qualified TS alias -> canonical TS alias
  private readonly members = new Map<string, MemberBinding>(); // Flat lookup by "type.member"
  private readonly memberOverloads = new Map<string, MemberBinding[]>(); // Overload-aware lookup by "type.member"
  private readonly clrMemberOverloads = new Map<string, MemberBinding[]>(); // Overload-aware lookup by CLR target key
  private readonly clrTypeNamesByAlias = new Map<string, Set<string>>();
  private readonly tsbindgenExports = new Map<
    string,
    Map<string, TsbindgenExport>
  >();
  private readonly tsSupertypes = new Map<string, Set<string>>();
  private readonly tsBaseTypes = new Map<string, string>();
  private readonly clrTypeNames = new Set<string>();

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

  /** Snapshot of mutable state for use by extracted pure resolution functions. */
  private get state(): RegistryState {
    return {
      types: this.types,
      memberOverloads: this.memberOverloads,
      clrTypeNamesByAlias: this.clrTypeNamesByAlias,
      extensionMethods: this.extensionMethods,
      tsSupertypes: this.tsSupertypes,
      tsBaseTypes: this.tsBaseTypes,
      simpleBindings: this.simpleBindings,
      simpleGlobalBindings: this.simpleGlobalBindings,
      simpleModuleBindings: this.simpleModuleBindings,
      typeLookupAliasMap: this.typeLookupAliasMap,
      clrTypeNames: this.clrTypeNames,
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
        clrMemberOverloads: this.clrMemberOverloads,
        clrTypeNamesByAlias: this.clrTypeNamesByAlias,
        extensionMethods: this.extensionMethods,
        tsbindgenExports: this.tsbindgenExports,
        tsSupertypes: this.tsSupertypes,
        tsBaseTypes: this.tsBaseTypes,
        clrTypeNames: this.clrTypeNames,
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
   * Check whether a CLR type name exists in loaded bindings.
   */
  hasClrTypeName(clrTypeName: string): boolean {
    return this.clrTypeNames.has(clrTypeName);
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
    preferredClrOwner?: string
  ): readonly MemberBinding[] | undefined {
    return resolveMemberOverloads(
      this.state,
      typeAlias,
      memberAlias,
      preferredClrOwner
    );
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
      const identityClrType = getSimpleBindingIdentityClrType(descriptor);

      if (!result.has(alias)) {
        result.set(alias, {
          alias,
          name: identityClrType,
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
    this.clrMemberOverloads.clear();
    this.clrTypeNamesByAlias.clear();
    this.extensionMethods.clear();
    this.tsbindgenExports.clear();
    this.tsSupertypes.clear();
    this.tsBaseTypes.clear();
    this.clrTypeNames.clear();
  }
}
