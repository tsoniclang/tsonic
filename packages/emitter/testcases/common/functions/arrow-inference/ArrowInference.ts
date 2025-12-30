/**
 * Test case: Arrow function type inference
 * Demonstrates contextual type inference for arrow function parameters and return types.
 */

// Type for typed callback parameter
type NumberToNumber = (x: number) => number;

// Test: arrow with contextual type from typed variable
export const double: NumberToNumber = (x) => x * 2;

// Test: arrow with explicit parameter types (no inference needed)
export const triple = (x: number): number => x * 3;

// Test: multiple parameters with contextual type
type BinaryOp = (a: number, b: number) => number;
export const add: BinaryOp = (a, b) => a + b;
