import { int } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import { Queryable } from "@tsonic/dotnet/System.Linq.js";
import type { IQueryable } from "@tsonic/dotnet/System.Linq.js";
import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";

type LinqQ<T> = Linq<IQueryable<T>>;

export function main(): void {
  Console.writeLine("=== LINQ IQueryable E2E ===");

  const numbers = new List<int>();
  numbers.add(1);
  numbers.add(2);
  numbers.add(3);
  numbers.add(4);

  const q = Queryable.asQueryable(numbers) as unknown as LinqQ<int>;

  const staticEven = Queryable.where(q, (n) => n % 2 === 0);
  const staticDoubled = Queryable.select(staticEven, (n) => n * 2);

  const extDoubled = q.where((n) => n % 2 === 0).select((n) => n * 2);

  // NOTE: Don't enumerate the IQueryable in NativeAOT.
  // EnumerableQuery<T> uses an interpreter that requires dynamic code.
  Console.writeLine(staticDoubled.expression.toString());
  Console.writeLine(extDoubled.expression.toString());
}
