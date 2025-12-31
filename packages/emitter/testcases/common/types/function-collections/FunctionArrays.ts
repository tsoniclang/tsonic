import { int } from "@tsonic/core/types.js";

export type Operation = (a: int, b: int) => int;

// Array of functions
export const operations: Operation[] = [
  (a: int, b: int): int => (a + b) as int,
  (a: int, b: int): int => (a - b) as int,
  (a: int, b: int): int => (a * b) as int,
];

// Interface with function properties
export interface OperationMap {
  add: Operation;
  subtract: Operation;
  multiply: Operation;
}
