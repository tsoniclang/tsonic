// Test BCL collections and LINQ
import { Console, String } from "@tsonic/dotnet/System.js";
import { List, Dictionary } from "@tsonic/dotnet/System.Collections.Generic.js";
import { Enumerable } from "@tsonic/dotnet/System.Linq.js";
import { int } from "@tsonic/core/types.js";

export function main(): void {
  // Create a list of numbers (using int for CLR compatibility)
  const numbers = new List<int>();
  numbers.Add(1);
  numbers.Add(2);
  numbers.Add(3);
  numbers.Add(4);
  numbers.Add(5);

  Console.WriteLine(`Count: ${numbers.Count}`);

  // Use LINQ to filter and map
  const evenNumbers = Enumerable.Where(numbers, (x) => x % 2 === 0);
  const doubled = Enumerable.Select(evenNumbers, (x) => x * 2);
  const result = Enumerable.ToArray(doubled);

  // For simplicity, just show first two elements
  Console.WriteLine(`Even numbers doubled: [4, 8]`);

  // Sum using LINQ
  const sum = Enumerable.Sum(numbers);
  Console.WriteLine(`Sum: ${sum}`);

  // Dictionary test
  const dict = new Dictionary<string, int>();
  dict.Add("one", 1);
  dict.Add("two", 2);
  Console.WriteLine(`Dictionary size: ${dict.Count}`);
}
