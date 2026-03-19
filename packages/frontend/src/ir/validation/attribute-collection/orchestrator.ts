/**
 * Attribute Collection — Module Processing & Entry Point
 *
 * Orchestrates the attribute collection pass: walks module statements,
 * detects attribute markers, attaches IR attributes to declarations,
 * and removes marker statements.
 *
 * FACADE: re-exports from marker-collection and module-rebuild.
 */

export type { AttributeCollectionResult } from "./module-rebuild.js";
export { runAttributeCollectionPass } from "./module-rebuild.js";
