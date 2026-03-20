/**
 * Rest Type Synthesis Pass — Facade
 *
 * Re-exports from sub-modules:
 * - rest-type-synthesis-helpers: RestTypeSynthesisResult type, synthesis context and helpers
 * - rest-type-synthesis-processing: runRestTypeSynthesisPass
 */

export type { RestTypeSynthesisResult } from "./rest-type-synthesis-helpers.js";
export { runRestTypeSynthesisPass } from "./rest-type-synthesis-processing.js";
