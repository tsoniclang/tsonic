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
  numbers.add(1);
  numbers.add(2);
  numbers.add(3);
  numbers.add(4);

  const xs = numbers as unknown as LinqSeq<int>;
  const doubled = xs.where((n) => n % 2 === 0).select((n) => n * 2).toList();

  Console.writeLine(doubled.count);
  Console.writeLine(inc(5));
}

