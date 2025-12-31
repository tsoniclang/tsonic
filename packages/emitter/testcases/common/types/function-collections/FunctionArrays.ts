import { int } from "@tsonic/core/types.js";

export type Operation = (a: int, b: int) => int;

// Array of functions
export const operations: Operation[] = [
  (a, b) => a + b,
  (a, b) => a - b,
  (a, b) => a * b,
];

// Interface with function properties
export interface OperationMap {
  add: Operation;
  subtract: Operation;
  multiply: Operation;
}
