// Test LINQ operations in dotnet runtime mode
import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import { Enumerable } from "@tsonic/dotnet/System.Linq.js";
import { int } from "@tsonic/core/types.js";

export function main(): void {
  Console.WriteLine("=== LINQ Operations Test ===");

  // Create a list of numbers (using int for LINQ compatibility)
  const numbers = new List<int>();
  numbers.Add(1);
  numbers.Add(2);
  numbers.Add(3);
  numbers.Add(4);
  numbers.Add(5);
  numbers.Add(6);
  numbers.Add(7);
  numbers.Add(8);
  numbers.Add(9);
  numbers.Add(10);

  // LINQ Where
  const evenNumbers = Enumerable.Where(numbers, (n) => n % 2 === 0);
  const evenList = Enumerable.ToList(evenNumbers);
  Console.WriteLine(`Even numbers count: ${evenList.Count}`);

  // LINQ Select
  const doubled = Enumerable.Select(numbers, (n) => n * 2);
  const doubledList = Enumerable.ToList(doubled);
  Console.WriteLine(`Doubled numbers count: ${doubledList.Count}`);

  // LINQ Sum
  const sum = Enumerable.Sum(numbers);
  Console.WriteLine(`Sum: ${sum}`);

  // LINQ Any
  const hasLarge = Enumerable.Any(numbers, (n) => n > 5);
  Console.WriteLine(`Has numbers > 5: ${hasLarge}`);

  // LINQ All
  const allPositive = Enumerable.All(numbers, (n) => n > 0);
  Console.WriteLine(`All positive: ${allPositive}`);

  // LINQ FirstOrDefault
  const firstEven = Enumerable.FirstOrDefault(evenNumbers, (n) => n > 0);
  Console.WriteLine(`First even: ${firstEven}`);
}
