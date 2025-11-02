/**
 * Class conversion - Public API
 */

export { convertClassDeclaration } from "./orchestrator.js";
export { detectOverride, type OverrideInfo } from "./override-detection.js";
export { convertProperty } from "./properties.js";
export { convertMethod } from "./methods.js";
export {
  convertConstructor,
  extractParameterProperties,
} from "./constructors.js";
