// Test cases for new Array<T>(size) constructor
import { int, double } from "@tsonic/core/types.js";

// Basic primitive types
export function createIntArray(size: int): int[] {
  return new Array<int>(size);
}

export function createStringArray(size: int): string[] {
  return new Array<string>(size);
}

export function createBooleanArray(size: int): boolean[] {
  return new Array<boolean>(size);
}

export function createDoubleArray(size: int): double[] {
  return new Array<double>(size);
}

// Fixed size with literal
export function createFixedArray(): int[] {
  return new Array<int>(10);
}

// Empty array (no size argument)
export function createEmptyArray(): int[] {
  return new Array<int>();
}

// Nullable type
export function createNullableArray(size: int): (string | undefined)[] {
  return new Array<string | undefined>(size);
}

// Variable size
export function createDynamicArray(count: int): int[] {
  const size = count * 2;
  return new Array<int>(size);
}

// Expression as size
export function createExpressionSizeArray(a: int, b: int): int[] {
  return new Array<int>(a + b);
}

// Interface/object type
interface User {
  name: string;
  age: int;
}

export function createObjectArray(size: int): User[] {
  return new Array<User>(size);
}
