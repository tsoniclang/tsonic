/**
 * Pattern lowering for static/module-level fields and assignment expressions
 * — facade re-exports.
 *
 * Implementations live in:
 *   - static-lowering-members.ts
 *   - static-lowering-assignments.ts
 */

export {
  type StaticPatternLoweringResultAst,
  lowerPatternToStaticMembersAst,
} from "./static-lowering-members.js";

export { lowerAssignmentPatternAst } from "./static-lowering-assignments.js";
