/**
 * Test case for null in generic type contexts.
 * CS0403: Cannot convert null to type 'T' because it could be a non-nullable value type.
 * Solution: emit 'default' instead of 'null' when expected type contains type parameters.
 */

// Interface with generic type parameter
export interface Result<T> {
  value: T | null;
  error: string | null;
}

// Function returning Result<T> with null value
export function wrapError<T>(error: string): Result<T> {
  return { value: null, error };
}

// Function returning Result<T> with actual value
export function wrapValue<T>(value: T): Result<T> {
  return { value, error: null };
}

// Test with concrete type - null should still be null
export function getConcreteNull(): Result<string> {
  return { value: null, error: null };
}
