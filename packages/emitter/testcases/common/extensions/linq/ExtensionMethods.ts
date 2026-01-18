import type { thisarg } from "@tsonic/core/lang.js";
import { int } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { IEnumerable } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";

type LinqSeq<T> = Linq<IEnumerable<T>>;

export function inc(x: thisarg<int>): int {
  return x + 1;
}

export function run(): void {
  const numbers = new List<int>();
  numbers.Add(1);
  numbers.Add(2);
  numbers.Add(3);
  numbers.Add(4);

  const xs = numbers as unknown as LinqSeq<int>;
  const doubled = xs
    .Where((n) => n % 2 === 0)
    .Select((n) => n * 2)
    .ToList();

  Console.WriteLine(doubled.Count);
  Console.WriteLine(inc(5));
}
