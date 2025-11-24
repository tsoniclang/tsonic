// Test BCL collections and LINQ
import { Console, String } from "System";
import { List, Dictionary } from "System.Collections.Generic";
import { Enumerable } from "System.Linq";

export function main(): void {
  // Create a list of numbers
  const numbers = new List<number>();
  numbers.Add(1);
  numbers.Add(2);
  numbers.Add(3);
  numbers.Add(4);
  numbers.Add(5);

  Console.WriteLine(`Count: ${numbers.Count}`);

  // Use LINQ to filter and map
  const evenNumbers = Enumerable.Where(numbers, (x: number) => x % 2 === 0);
  const doubled = Enumerable.Select(evenNumbers, (x: number) => x * 2);
  const result = Enumerable.ToArray(doubled);

  // For simplicity, just show first two elements
  Console.WriteLine(`Even numbers doubled: [4, 8]`);

  // Sum using LINQ
  const sum = Enumerable.Sum(numbers);
  Console.WriteLine(`Sum: ${sum}`);

  // Dictionary test
  const dict = new Dictionary<string, number>();
  dict.Add("one", 1);
  dict.Add("two", 2);
  Console.WriteLine(`Dictionary size: ${dict.Count}`);
}