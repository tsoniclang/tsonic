/**
 * Yield Expression Lowering
 *
 * Lowers yield expressions that appear inside larger expression trees
 * (binary, call, member-access, conditional, etc.) into leading
 * IrYieldStatement nodes plus a rewritten expression that references
 * temporary identifiers.
 *
 * FACADE: re-exports from yield-member-access-lowering and yield-main-expression-lowering.
 */

export { lowerMemberAccessAssignmentWithYields } from "./yield-member-access-lowering.js";
export { lowerExpressionWithYields } from "./yield-main-expression-lowering.js";
