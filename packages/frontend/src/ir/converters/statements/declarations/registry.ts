/**
 * Metadata and binding registry management
 *
 * Provides module-level singletons for:
 * - DotnetMetadataRegistry: .NET metadata for imported types
 * - BindingRegistry: CLR bindings from tsbindgen
 * - TypeRegistry: AST-based type declarations (classes, interfaces, type aliases)
 * - NominalEnv: Inheritance chain substitution for deterministic typing
 */

import { DotnetMetadataRegistry } from "../../../../dotnet-metadata.js";
import { BindingRegistry } from "../../../../program/bindings.js";
import { TypeRegistry } from "../../../type-registry.js";
import { NominalEnv } from "../../../nominal-env.js";

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
 * Module-level type registry singleton
 * Set once at the start of compilation via setTypeRegistry()
 * Used for AST-based type declaration lookups (deterministic typing)
 */
let _typeRegistry: TypeRegistry | undefined = undefined;

/**
 * Module-level nominal env singleton
 * Set once at the start of compilation via setNominalEnv()
 * Used for inheritance chain substitution (deterministic typing)
 */
let _nominalEnv: NominalEnv | undefined = undefined;

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
 * Set the type registry for this compilation
 * Called once at the start of IR building
 */
export const setTypeRegistry = (registry: TypeRegistry): void => {
  _typeRegistry = registry;
};

/**
 * Get the current type registry
 * Returns undefined if not yet initialized
 */
export const getTypeRegistry = (): TypeRegistry | undefined => _typeRegistry;

/**
 * Set the nominal env for this compilation
 * Called once at the start of IR building
 */
export const setNominalEnv = (env: NominalEnv): void => {
  _nominalEnv = env;
};

/**
 * Get the current nominal env
 * Returns undefined if not yet initialized
 */
export const getNominalEnv = (): NominalEnv | undefined => _nominalEnv;

/**
 * Clear type registry and nominal env
 * Called between compilations to prevent stale data
 */
export const clearTypeRegistries = (): void => {
  _typeRegistry = undefined;
  _nominalEnv = undefined;
};
