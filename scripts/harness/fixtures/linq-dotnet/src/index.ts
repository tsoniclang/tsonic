// Test LINQ operations in dotnet runtime mode
import { Console } from "@tsonic/dotnet/System";
import { List } from "@tsonic/dotnet/System.Collections.Generic";
import { Enumerable } from "@tsonic/dotnet/System.Linq";
import { int } from "@tsonic/types";

export function main(): void {
  Console.writeLine("=== LINQ Operations Test ===");

  // Create a list of numbers (using int for LINQ compatibility)
  const numbers = new List<int>();
  numbers.add(1 as int);
  numbers.add(2 as int);
  numbers.add(3 as int);
  numbers.add(4 as int);
  numbers.add(5 as int);
  numbers.add(6 as int);
  numbers.add(7 as int);
  numbers.add(8 as int);
  numbers.add(9 as int);
  numbers.add(10 as int);

  // LINQ Where
  const evenNumbers = Enumerable.where(numbers, (n: int) => n % 2 === 0);
  const evenList = Enumerable.toList(evenNumbers);
  Console.writeLine(`Even numbers count: ${evenList.count}`);

  // LINQ Select
  const doubled = Enumerable.select(numbers, (n: int) => (n * 2) as int);
  const doubledList = Enumerable.toList(doubled);
  Console.writeLine(`Doubled numbers count: ${doubledList.count}`);

  // LINQ Sum
  const sum = Enumerable.sum(numbers);
  Console.writeLine(`Sum: ${sum}`);

  // LINQ Any (renamed to any_ in tsbindgen because 'any' is TS keyword)
  const hasLarge = Enumerable.any_(numbers, (n: int) => n > 5);
  Console.writeLine(`Has numbers > 5: ${hasLarge}`);

  // LINQ All
  const allPositive = Enumerable.all(numbers, (n: int) => n > 0);
  Console.writeLine(`All positive: ${allPositive}`);

  // LINQ FirstOrDefault
  const firstEven = Enumerable.firstOrDefault(evenNumbers, (n: int) => n > 0);
  Console.writeLine(`First even: ${firstEven}`);
}
