import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import { Queryable } from "@tsonic/dotnet/System.Linq.js";
import { int } from "@tsonic/core/types.js";

export function main(): void {
  Console.writeLine("=== LINQ IQueryable Test ===");

  const numbers = new List<int>();
  numbers.add(1);
  numbers.add(2);
  numbers.add(3);
  numbers.add(4);

  const q = Queryable.asQueryable(numbers);
  const even = Queryable.where(q, (n) => n % 2 === 0);
  const doubled = Queryable.select(even, (n) => n * 2);

  // NOTE: Do not enumerate IQueryable in NativeAOT mode.
  // EnumerableQuery execution uses reflection-heavy expression compilation which is AOT-incompatible.
  // This test validates that we can *build* IQueryable expression trees (EF-style), not execute them.
  Console.writeLine(doubled.expression.toString());
}
