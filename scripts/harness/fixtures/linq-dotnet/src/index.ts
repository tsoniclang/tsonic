// Test LINQ operations in dotnet runtime mode
import { Console } from "System";
import { List } from "System.Collections.Generic";
import { Enumerable } from "System.Linq";

export function main(): void {
  Console.WriteLine("=== LINQ Operations Test ===");

  // Create a list of numbers
  const numbers = new List<number>();
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
  const evenNumbers = Enumerable.Where(numbers, (n: number) => n % 2 === 0);
  const evenList = Enumerable.ToList(evenNumbers);
  Console.WriteLine(`Even numbers count: ${evenList.Count}`);

  // LINQ Select
  const doubled = Enumerable.Select(numbers, (n: number) => n * 2);
  const doubledList = Enumerable.ToList(doubled);
  Console.WriteLine(`Doubled numbers count: ${doubledList.Count}`);

  // LINQ Sum
  const sum = Enumerable.Sum(numbers);
  Console.WriteLine(`Sum: ${sum}`);

  // LINQ Any
  const hasLarge = Enumerable.Any(numbers, (n: number) => n > 5);
  Console.WriteLine(`Has numbers > 5: ${hasLarge}`);

  // LINQ All
  const allPositive = Enumerable.All(numbers, (n: number) => n > 0);
  Console.WriteLine(`All positive: ${allPositive}`);

  // LINQ FirstOrDefault
  const firstEven = Enumerable.FirstOrDefault(
    evenNumbers,
    (n: number) => n > 0
  );
  Console.WriteLine(`First even: ${firstEven}`);
}
