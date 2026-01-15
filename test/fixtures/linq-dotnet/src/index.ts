// Test LINQ operations in dotnet runtime mode
import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import { Enumerable } from "@tsonic/dotnet/System.Linq.js";
import { int } from "@tsonic/core/types.js";

export function main(): void {
  Console.writeLine("=== LINQ Operations Test ===");

  // Create a list of numbers (using int for LINQ compatibility)
  const numbers = new List<int>();
  numbers.add(1);
  numbers.add(2);
  numbers.add(3);
  numbers.add(4);
  numbers.add(5);
  numbers.add(6);
  numbers.add(7);
  numbers.add(8);
  numbers.add(9);
  numbers.add(10);

  // LINQ Where
  const evenNumbers = Enumerable.where(numbers, (n) => n % 2 === 0);
  const evenList = Enumerable.toList(evenNumbers);
  Console.writeLine(`Even numbers count: ${evenList.count}`);

  // LINQ Select
  const doubled = Enumerable.select(numbers, (n) => n * 2);
  const doubledList = Enumerable.toList(doubled);
  Console.writeLine(`Doubled numbers count: ${doubledList.count}`);

  // LINQ Sum
  const sum = Enumerable.sum(numbers);
  Console.writeLine(`Sum: ${sum}`);

  // LINQ Any
  const hasLarge = Enumerable.any(numbers, (n) => n > 5);
  Console.writeLine(`Has numbers > 5: ${hasLarge}`);

  // LINQ All
  const allPositive = Enumerable.all(numbers, (n) => n > 0);
  Console.writeLine(`All positive: ${allPositive}`);

  // LINQ FirstOrDefault
  const firstEven = Enumerable.firstOrDefault(evenNumbers, (n) => n > 0);
  Console.writeLine(`First even: ${firstEven}`);
}
