// Test tuple types with >7 elements (requires .NET ValueTuple nesting)

// 8-element tuple: ValueTuple<T1..T7, ValueTuple<T8>>
export type T8 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

// 9-element tuple: ValueTuple<T1..T7, ValueTuple<T8, T9>>
export type T9 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

// Tuple literals with 8+ elements
export const t8: T8 = [1, 2, 3, 4, 5, 6, 7, 8];
export const t9: T9 = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Function returning 8-element tuple
export function makeT8(): T8 {
  return [10, 20, 30, 40, 50, 60, 70, 80];
}

// Function with 8-element tuple parameter
export function sumT8(t: T8): number {
  return t[0] + t[1] + t[2] + t[3] + t[4] + t[5] + t[6] + t[7];
}
