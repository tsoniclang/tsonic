// Test array/list indexing in dotnet mode
// Demonstrates that indexed access works with CLR List<T>
import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";

export function main(): void {
  // Create a list with values
  // Using double literals (10.0) because List<number> expects doubles
  const numbers = new List<number>();
  numbers.Add(10.0);
  numbers.Add(20.0);
  numbers.Add(30.0);

  // Read via indexer - should work in dotnet mode
  Console.WriteLine(numbers[0]);
  Console.WriteLine(numbers[1]);
  Console.WriteLine(numbers[2]);

  // Modify via indexer
  numbers[1] = 25.0;
  Console.WriteLine(numbers[1]);

  // count property (NOT .length - that's JS)
  Console.WriteLine(numbers.Count);
}
