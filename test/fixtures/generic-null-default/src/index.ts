// Test null in generic type contexts emits as 'default' (CS0403 fix)
import { Console } from "@tsonic/dotnet/System";

interface Result<T> {
  value: T | null;
  error: string | null;
}

// Generic function returning null value - must emit 'default' for value
function wrapError<T>(error: string): Result<T> {
  return { value: null, error };
}

// Generic function returning actual value - error stays 'null' (concrete string type)
function wrapValue<T>(value: T): Result<T> {
  return { value, error: null };
}

// Concrete type - both nulls stay as 'null'
function getConcreteNull(): Result<string> {
  return { value: null, error: null };
}

export function main(): void {
  // Test wrapError - the value is null (default in C#)
  const err = wrapError<number>("something went wrong");
  Console.WriteLine(`Error: ${err.error}`);
  Console.WriteLine(`Value is null: ${err.value === null}`);

  // Test wrapValue - error is null, value has data
  const ok = wrapValue(42);
  Console.WriteLine(`Value: ${ok.value}`);
  Console.WriteLine(`Error is null: ${ok.error === null}`);

  // Test concrete - both are null
  const concrete = getConcreteNull();
  Console.WriteLine(
    `Both null: ${concrete.value === null && concrete.error === null}`
  );

  Console.WriteLine("All tests passed!");
}
