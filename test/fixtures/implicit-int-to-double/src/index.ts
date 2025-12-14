// Test: Implicit int→double conversion should be rejected (TSN5110)
// This tests the strict numeric contract enforcement.

// Case 1: Variable initialization with explicit type annotation
// const x: number = 42;  // ERROR: Integer literal cannot be implicitly converted to 'number' (double)

// Case 2: Parameter passing where function expects 'number'
function acceptDouble(x: number): number {
  return x * 2;
}

// This should error: integer literal passed to function expecting number
const result = acceptDouble(42);

// Case 3: Array element type mismatch
// const arr: number[] = [1, 2, 3];  // ERROR for each element

export function main(): void {
  // The compiler should reject this file with TSN5110 errors
}
