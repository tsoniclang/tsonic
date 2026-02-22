/**
 * Test: defaultof<T>() intrinsic
 *
 * Verifies that defaultof<T>() is lowered to C# `default(T)` and is usable for:
 * - value types (int, bool)
 * - reference types (class)
 * - initializing locals for out parameters (Dictionary.TryGetValue)
 */

import { Console } from "@tsonic/dotnet/System.js";
import { Dictionary } from "@tsonic/dotnet/System.Collections.Generic.js";
import { defaultof } from "@tsonic/core/lang.js";
import { bool, int, out } from "@tsonic/core/types.js";

class Person {
  name!: string;
}

export function main(): void {
  const zero: int = defaultof<int>();
  const f: bool = defaultof<bool>();
  const p = defaultof<Person>();

  Console.WriteLine(`${zero},${f},${p === null}`);

  const dict = new Dictionary<string, int>();
  dict.Add("a", 123 as int);

  let value: int = defaultof<int>();
  const ok = dict.TryGetValue("a", value as out<int>);
  Console.WriteLine(`${ok},${value}`);
}
