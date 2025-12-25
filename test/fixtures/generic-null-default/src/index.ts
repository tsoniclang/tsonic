// Test null in generic type contexts with proper constraints
// Nullable generic types require T extends struct or T extends object
import { Console } from "@tsonic/dotnet/System";

// Result type constrained to reference types (T extends object → where T : class)
interface Result<T extends object> {
  value: T | null;
  error: string | null;
}

// Generic function returning null value - T is constrained to class
function wrapError<T extends object>(error: string): Result<T> {
  return { value: null, error };
}

// Generic function returning actual value
function wrapValue<T extends object>(value: T): Result<T> {
  return { value, error: null };
}

// Concrete type - strings are reference types
function getConcreteNull(): Result<string> {
  return { value: null, error: null };
}

// Simple wrapper class for testing
class NumberWrapper {
  constructor(public num: number) {}
}

export function main(): void {
  // Test wrapError with reference type
  const err = wrapError<NumberWrapper>("something went wrong");
  Console.writeLine(`Error: ${err.error}`);
  Console.writeLine(`Value is null: ${err.value === null}`);

  // Test wrapValue with reference type
  const ok = wrapValue(new NumberWrapper(42));
  Console.writeLine(`Value: ${ok.value!.num}`);
  Console.writeLine(`Error is null: ${ok.error === null}`);

  // Test concrete string result
  const concrete = getConcreteNull();
  Console.writeLine(
    `Both null: ${concrete.value === null && concrete.error === null}`
  );

  Console.writeLine("All tests passed!");
}
