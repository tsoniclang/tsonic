/**
 * Anonymous Type IR Rewriting.
 *
 * Expression and statement lowering now live in dedicated sidecars to keep the
 * mutually recursive lowering steps readable.
 */
export type { LoweringContext } from "./anon-type-lower-types.js";
export { lowerExpression } from "./anon-type-lower-expressions.js";
export {
  lowerBlockStatement,
  lowerClassMember,
  lowerStatement,
  lowerVariableDeclaration,
} from "./anon-type-lower-statements.js";
