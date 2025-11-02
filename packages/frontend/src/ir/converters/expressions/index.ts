/**
 * Expression converters barrel exports
 */

// Helpers
export {
  getInferredType,
  extractTypeArguments,
  checkIfRequiresSpecialization,
  convertBinaryOperator,
  isAssignmentOperator,
} from "./helpers.js";

// Literals
export { convertLiteral } from "./literals.js";

// Collections
export { convertArrayLiteral, convertObjectLiteral } from "./collections.js";

// Member access
export { convertMemberExpression } from "./access.js";

// Calls
export { convertCallExpression, convertNewExpression } from "./calls.js";

// Operators
export {
  convertBinaryExpression,
  convertUnaryExpression,
  convertUpdateExpression,
} from "./operators.js";

// Functions
export {
  convertFunctionExpression,
  convertArrowFunction,
} from "./functions.js";

// Other
export {
  convertConditionalExpression,
  convertTemplateLiteral,
} from "./other.js";
