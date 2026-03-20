/**
 * Method member conversion - facade
 *
 * Re-exports from focused sub-modules:
 *   - method-declaration.ts  (single method conversion)
 *   - overload-wrappers.ts   (overload group orchestration + wrapper lowering)
 *   - overload-specialization.ts (IR specialization engine, internal)
 */

export { convertMethod } from "./method-declaration.js";
export { convertMethodOverloadGroup } from "./overload-wrappers.js";
