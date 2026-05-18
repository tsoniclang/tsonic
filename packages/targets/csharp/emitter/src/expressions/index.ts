/**
 * Expression emitters barrel exports
 */

// Literals
export { emitLiteral } from "./literals.js";

// Identifiers and type helpers
export { emitIdentifier, generateSpecializedName } from "./identifiers.js";

// Collections
export { emitArray, emitObject } from "./collections.js";

// Member access
export { emitMemberAccess } from "./access.js";

// Calls
export { emitCall, emitNew } from "./calls.js";

// Operators
export {
  emitBinary,
  emitLogical,
  emitUnary,
  emitUpdate,
  emitAssignment,
  emitConditional,
} from "./operators.js";

// Functions
export { emitFunctionExpression, emitArrowFunction } from "./functions.js";

// Other
export { emitTemplateLiteral, emitSpread, emitAwait } from "./other.js";
