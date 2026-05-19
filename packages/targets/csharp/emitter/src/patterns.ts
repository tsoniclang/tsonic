/**
 * Pattern lowering (AST-only) -- facade.
 *
 * Handles destructuring for:
 * - local declarations
 * - static/module-level field declarations
 * - assignment expressions
 */

export type { LoweringResultAst } from "./patterns/local-lowering.js";
export { lowerPatternAst } from "./patterns/local-lowering.js";

export type { StaticPatternLoweringResultAst } from "./patterns/static-assignment-lowering.js";
export {
  lowerPatternToStaticMembersAst,
  lowerAssignmentPatternAst,
} from "./patterns/static-assignment-lowering.js";
