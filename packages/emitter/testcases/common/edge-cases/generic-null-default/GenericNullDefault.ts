/**
 * Test case for null in generic type contexts with proper constraints.
 * Nullable generic types require constraints:
 * - T extends object → where T : class (reference type, T? works)
 * - T extends struct → where T : struct (value type, T? becomes Nullable<T>)
 */

// Interface with constrained generic type parameter (reference types)
export interface Result<T extends object> {
  value: T | null;
  error: string | null;
}

// Function returning Result<T> with null value (T is constrained to class)
export function wrapError<T extends object>(error: string): Result<T> {
  return { value: null, error };
}

// Function returning Result<T> with actual value
export function wrapValue<T extends object>(value: T): Result<T> {
  return { value, error: null };
}

// Wrapper class for string (reference type)
class StringWrapper {
  constructor(public value: string) {}
}

// Concrete result with reference type
export function getConcreteNull(): Result<StringWrapper> {
  return { value: null, error: null };
}
