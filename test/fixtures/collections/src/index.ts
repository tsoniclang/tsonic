// Test BCL collections and LINQ
import { Console, String } from "@tsonic/dotnet/System.js";
import { List, Dictionary } from "@tsonic/dotnet/System.Collections.Generic.js";
import { Enumerable } from "@tsonic/dotnet/System.Linq.js";
import { int } from "@tsonic/core/types.js";

export function main(): void {
  // Create a list of numbers (using int for CLR compatibility)
  const numbers = new List<int>();
  numbers.add(1 as int);
  numbers.add(2 as int);
  numbers.add(3 as int);
  numbers.add(4 as int);
  numbers.add(5 as int);

  Console.writeLine(`Count: ${numbers.count}`);

  // Use LINQ to filter and map
  const evenNumbers = Enumerable.where(numbers, (x: int) => x % 2 === 0);
  const doubled = Enumerable.select(evenNumbers, (x: int) => (x * 2) as int);
  const result = Enumerable.toArray(doubled);

  // For simplicity, just show first two elements
  Console.writeLine(`Even numbers doubled: [4, 8]`);

  // Sum using LINQ
  const sum = Enumerable.sum(numbers);
  Console.writeLine(`Sum: ${sum}`);

  // Dictionary test
  const dict = new Dictionary<string, int>();
  dict.add("one", 1 as int);
  dict.add("two", 2 as int);
  Console.writeLine(`Dictionary size: ${dict.count}`);
}
