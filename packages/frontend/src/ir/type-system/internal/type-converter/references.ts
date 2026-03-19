/**
 * Reference type conversion (facade)
 *
 * Sub-modules:
 * - references-converter.ts : main convertTypeReference entry point
 * - references-alias.ts     : type alias declaration handling
 * - references-normalize.ts : normalization helpers, key classification, caches
 * - references-structural.ts: structural extraction, declaration analysis, bindings
 */

export { convertTypeReference } from "./references-converter.js";
