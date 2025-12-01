// Test generic contextual object literals
// This tests that object literals in generic type contexts emit with type arguments
import { Console } from "@tsonic/dotnet/System";

interface Container<T> {
  value: T;
  label: string;
}

function createContainer<T>(value: T, label: string): Container<T> {
  return { value: value, label: label };
}

export function main(): void {
  const strContainer = createContainer("hello", "string container");

  Console.WriteLine(strContainer.label);
  Console.WriteLine(strContainer.value);
}
