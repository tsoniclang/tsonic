// Test BCL collections and LINQ
import { List } from "System.Collections.Generic";
import { Enumerable } from "System.Linq";

export function main(): void {
  // Create a list of numbers
  const numbers = new List<number>();
  numbers.Add(1);
  numbers.Add(2);
  numbers.Add(3);
  numbers.Add(4);
  numbers.Add(5);

  console.log(`Count: ${numbers.Count}`);

  // Use LINQ to filter and map
  const evenNumbers = Enumerable.Where(numbers, (x: number) => x % 2 === 0);
  const doubled = Enumerable.Select(evenNumbers, (x: number) => x * 2);
  const result = Enumerable.ToArray(doubled);

  console.log(`Even numbers doubled: [${result.join(", ")}]`);

  // Sum using LINQ
  const sum = Enumerable.Sum(numbers);
  console.log(`Sum: ${sum}`);

  // Dictionary test
  const dict = new Map<string, number>();
  dict.set("one", 1);
  dict.set("two", 2);
  console.log(`Dictionary size: ${dict.size}`);
}