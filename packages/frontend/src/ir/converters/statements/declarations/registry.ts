/**
 * Metadata registry management
 */

import { DotnetMetadataRegistry } from "../../../../dotnet-metadata.js";

/**
 * Module-level metadata registry singleton
 * Set once at the start of compilation via setMetadataRegistry()
 */
let _metadataRegistry: DotnetMetadataRegistry = new DotnetMetadataRegistry();

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
