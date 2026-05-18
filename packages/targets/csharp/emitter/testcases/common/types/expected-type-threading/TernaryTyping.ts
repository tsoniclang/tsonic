import { int } from "@tsonic/core/types.js";

// Ternary with int type annotation - both branches should be int
export const ternaryInt: int = true ? 5 : 10;

// Nested ternary - all branches should be int
export const nestedTernary: int = true ? (false ? 1 : 2) : 3;

// Function returning int via ternary
export function ternaryReturn(flag: boolean): int {
  return flag ? 100 : 200;
}
