/**
 * Collection expression emitters (arrays and objects)
 *
 * Facade re-exporting from focused sub-modules.
 */

export { emitArray } from "./array-literal.js";
export {
  emitObject,
  resolveBehavioralObjectLiteralType,
} from "./object-literal.js";
