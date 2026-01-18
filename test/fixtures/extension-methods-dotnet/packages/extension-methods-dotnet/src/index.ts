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
  Console.WriteLine("=== Extension Methods E2E ===");

  const numbers = new List<int>() as unknown as LinqList<int>;
  numbers.Add(1);
  numbers.Add(2);
  numbers.Add(3);
  numbers.Add(4);

  const doubled = numbers
    .Where((n) => n % 2 === 0)
    .Select((n) => n * 2)
    .ToList();
  Console.WriteLine(`Doubled count: ${doubled.Count}`);

  let count: int = 0;
  const ok = numbers.TryGetNonEnumeratedCount(count);
  Console.WriteLine(`TryGetNonEnumeratedCount: ${ok} ${count}`);

  let n: int = 10;
  addOne(n);
  Console.WriteLine(`addOne(10): ${n}`);

  Console.WriteLine(`inc(5): ${inc(5)}`);
}
