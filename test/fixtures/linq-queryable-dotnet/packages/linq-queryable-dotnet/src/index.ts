import { int } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import { Queryable } from "@tsonic/dotnet/System.Linq.js";
import type { IQueryable } from "@tsonic/dotnet/System.Linq.js";
import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";

type LinqQ<T> = Linq<IQueryable<T>>;

export function main(): void {
  Console.WriteLine("=== LINQ IQueryable E2E ===");

  const numbers = new List<int>();
  numbers.Add(1);
  numbers.Add(2);
  numbers.Add(3);
  numbers.Add(4);

  const q = Queryable.AsQueryable(numbers) as unknown as LinqQ<int>;

  const staticEven = Queryable.Where(q, (n) => n % 2 === 0);
  const staticDoubled = Queryable.Select(staticEven, (n) => n * 2);

  const extDoubled = q.Where((n) => n % 2 === 0).Select((n) => n * 2);

  // NOTE: Don't enumerate the IQueryable in NativeAOT.
  // EnumerableQuery<T> uses an interpreter that requires dynamic code.
  Console.WriteLine(staticDoubled.Expression.ToString());
  Console.WriteLine(extDoubled.Expression.ToString());
}
