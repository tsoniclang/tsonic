/**
 * Overload specialization engine — Facade
 *
 * Re-exports from sub-modules:
 * - overload-specialization-expressions: typesEqualForIsType, specializeExpression
 * - overload-specialization-statements: specializeStatement
 */

export {
  typesEqualForIsType,
  specializeExpression,
} from "./overload-specialization-expressions.js";

export { specializeStatement } from "./overload-specialization-statements.js";
