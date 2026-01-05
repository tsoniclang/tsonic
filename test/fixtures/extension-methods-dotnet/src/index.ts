import type { thisarg } from "@tsonic/core/lang.js";
import { int, ref } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";

type LinqList<T> = Linq<List<T>>;

export function inc(x: thisarg<int>): int {
  return x + 1;
}

export function addOne(x: thisarg<ref<int>>): void {
  x = x + 1;
}

export function main(): void {
  Console.writeLine("=== Extension Methods E2E ===");

  const numbers = new List<int>() as unknown as LinqList<int>;
  numbers.add(1);
  numbers.add(2);
  numbers.add(3);
  numbers.add(4);

  const doubled = numbers
    .where((n) => n % 2 === 0)
    .select((n) => n * 2)
    .toList();
  Console.writeLine(`Doubled count: ${doubled.count}`);

  let count: int = 0 as int;
  const ok = numbers.tryGetNonEnumeratedCount(count);
  Console.writeLine(`TryGetNonEnumeratedCount: ${ok} ${count}`);

  let n: int = 10 as int;
  addOne(n);
  Console.writeLine(`addOne(10): ${n}`);

  Console.writeLine(`inc(5): ${inc(5 as int)}`);
}
