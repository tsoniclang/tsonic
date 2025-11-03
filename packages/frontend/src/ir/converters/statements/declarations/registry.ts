/**
 * Metadata and binding registry management
 */

import { DotnetMetadataRegistry } from "../../../../dotnet-metadata.js";
import { BindingRegistry } from "../../../../program/bindings.js";

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
