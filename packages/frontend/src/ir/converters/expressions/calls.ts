/**
 * Call and new expression converters
 *
 * ALICE'S SPEC: All call resolution goes through TypeSystem.resolveCall().
 * NO FALLBACKS ALLOWED. If TypeSystem can't resolve, return unknownType.
 */

export {
  getDeclaredReturnType,
  convertCallExpression,
} from "./calls/call-converter.js";
export { convertNewExpression } from "./calls/new-converter.js";
