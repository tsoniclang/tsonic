// Test array/list indexing in dotnet mode
// Demonstrates that indexed access works with CLR List<T>
import { Console } from "System";
import { List } from "System.Collections.Generic";

export function main(): void {
  // Create a list with values
  const numbers = new List<number>();
  numbers.Add(10);
  numbers.Add(20);
  numbers.Add(30);

  // Read via indexer - should work in dotnet mode
  Console.WriteLine(numbers[0]);
  Console.WriteLine(numbers[1]);
  Console.WriteLine(numbers[2]);

  // Modify via indexer
  numbers[1] = 25;
  Console.WriteLine(numbers[1]);

  // Count property (NOT .length - that's JS)
  Console.WriteLine(numbers.Count);
}
