/**
 * Metadata and binding registry management
 *
 * Provides module-level singletons for:
 * - DotnetMetadataRegistry: .NET metadata for imported types
 * - BindingRegistry: CLR bindings from tsbindgen
 * - TypeRegistry: AST-based type declarations (opaque, set by orchestrator)
 * - NominalEnv: Inheritance chain substitution (opaque, set by orchestrator)
 *
 * ALICE'S SPEC: This module does NOT import internal types.
 * TypeRegistry and NominalEnv are stored as opaque values.
 * Only the orchestrator (which IS allowed to import internals) knows the actual types.
 */

import { DotnetMetadataRegistry } from "../../../../dotnet-metadata.js";
import { BindingRegistry } from "../../../../program/bindings.js";
import type { TypeSystem } from "../../../type-system/type-system.js";

/**
 * Opaque type for TypeRegistry (internal type-system implementation detail)
 * The orchestrator sets and retrieves these; converters should use TypeSystem instead.
 */
type OpaqueTypeRegistry = unknown;

/**
 * Opaque type for NominalEnv (internal type-system implementation detail)
 * The orchestrator sets and retrieves these; converters should use TypeSystem instead.
 */
type OpaqueNominalEnv = unknown;

/**
 * Module-level metadata registry singleton
 * Set once at the start of compilation via setMetadataRegistry()
 */
let _metadataRegistry: DotnetMetadataRegistry = new DotnetMetadataRegistry();

/**
 * Module-level binding registry singleton
 * Set once at the start of compilation via setBindingRegistry()
 */
let _bindingRegistry: BindingRegistry = new BindingRegistry();

/**
 * Module-level type registry singleton (opaque)
 * Set once at the start of compilation via setTypeRegistry()
 * Used for AST-based type declaration lookups (deterministic typing)
 *
 * ALICE'S SPEC: Stored as opaque value. Only orchestrator knows actual type.
 */
let _typeRegistry: OpaqueTypeRegistry | undefined = undefined;

/**
 * Module-level nominal env singleton (opaque)
 * Set once at the start of compilation via setNominalEnv()
 * Used for inheritance chain substitution (deterministic typing)
 *
 * ALICE'S SPEC: Stored as opaque value. Only orchestrator knows actual type.
 */
let _nominalEnv: OpaqueNominalEnv | undefined = undefined;

/**
 * Module-level TypeSystem singleton
 * Set once at the start of compilation via setTypeSystem()
 * This is the single source of truth for all type queries (Alice's spec)
 */
let _typeSystem: TypeSystem | undefined = undefined;

/**
 * Set the metadata registry for this compilation
 * Called once at the start of IR building
 */
export const setMetadataRegistry = (registry: DotnetMetadataRegistry): void => {
  _metadataRegistry = registry;
};

/**
 * Get the current metadata registry
 */
export const getMetadataRegistry = (): DotnetMetadataRegistry =>
  _metadataRegistry;

/**
 * Set the binding registry for this compilation
 * Called once at the start of IR building
 */
export const setBindingRegistry = (registry: BindingRegistry): void => {
  _bindingRegistry = registry;
};

/**
 * Get the current binding registry
 */
export const getBindingRegistry = (): BindingRegistry => _bindingRegistry;

/**
 * Set the type registry for this compilation (opaque)
 * Called once at the start of IR building by orchestrator
 *
 * ALICE'S SPEC: Parameter is opaque. Orchestrator passes actual TypeRegistry.
 */
export const setTypeRegistry = (registry: OpaqueTypeRegistry): void => {
  _typeRegistry = registry;
};

/**
 * Internal accessor for TypeSystem construction only.
 * NOT for use in converters - use TypeSystem methods instead.
 *
 * ALICE'S SPEC: Returns opaque value. Orchestrator casts to actual type.
 */
export const _internalGetTypeRegistry = (): OpaqueTypeRegistry | undefined =>
  _typeRegistry;

/**
 * Set the nominal env for this compilation (opaque)
 * Called once at the start of IR building by orchestrator
 *
 * ALICE'S SPEC: Parameter is opaque. Orchestrator passes actual NominalEnv.
 */
export const setNominalEnv = (env: OpaqueNominalEnv): void => {
  _nominalEnv = env;
};

/**
 * Internal accessor for TypeSystem construction only.
 * NOT for use in converters - use TypeSystem methods instead.
 *
 * ALICE'S SPEC: Returns opaque value. Orchestrator casts to actual type.
 */
export const _internalGetNominalEnv = (): OpaqueNominalEnv | undefined =>
  _nominalEnv;

/**
 * Set the TypeSystem for this compilation.
 * Called once at the start of IR building, after TypeRegistry and NominalEnv are created.
 *
 * This is the ONLY way to set the global TypeSystem. All converters should
 * eventually receive TypeSystem as a parameter, but during migration they
 * can access it via getTypeSystem().
 */
export const setTypeSystem = (ts: TypeSystem): void => {
  _typeSystem = ts;
};

/**
 * Get the current TypeSystem.
 * Returns undefined if not yet initialized.
 *
 * During Step 7 migration, converters can use this to access TypeSystem
 * before they are fully migrated to receive it as a parameter.
 */
export const getTypeSystem = (): TypeSystem | undefined => _typeSystem;

/**
 * Clear type registry, nominal env, and TypeSystem.
 * Called between compilations to prevent stale data.
 */
export const clearTypeRegistries = (): void => {
  _typeRegistry = undefined;
  _nominalEnv = undefined;
  _typeSystem = undefined;
};
