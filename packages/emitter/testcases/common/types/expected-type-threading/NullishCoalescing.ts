import { int } from "@tsonic/core/types.js";

// Function returning int via nullish coalescing
// RHS fallback value should get expectedType int
export function getOrDefault(value: int | null): int {
  return value ?? 100;
}
