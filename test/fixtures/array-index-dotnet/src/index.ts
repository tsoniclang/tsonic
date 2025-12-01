// Test array/list indexing in dotnet mode
// Demonstrates that indexed access works with CLR List<T>
import { Console } from "@tsonic/dotnet/System";
import { List } from "@tsonic/dotnet/System.Collections.Generic";

export function main(): void {
  // Create a list with values
  const numbers = new List<number>();
  numbers.add(10);
  numbers.add(20);
  numbers.add(30);

  // Read via indexer - should work in dotnet mode
  Console.WriteLine(numbers[0]);
  Console.WriteLine(numbers[1]);
  Console.WriteLine(numbers[2]);

  // Modify via indexer
  numbers[1] = 25;
  Console.WriteLine(numbers[1]);

  // count property (NOT .length - that's JS)
  Console.WriteLine(numbers.count);
}
