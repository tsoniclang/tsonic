import { asinterface } from "@tsonic/core/lang.js";
import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { IEnumerable } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";

type Seq<T> = Linq<IEnumerable<T>>;

export function main(): void {
  const xs = new List<number>([1, 2, 3]);
  const seq = asinterface<Seq<number>>(xs);
  Console.WriteLine(seq.Count());
}
