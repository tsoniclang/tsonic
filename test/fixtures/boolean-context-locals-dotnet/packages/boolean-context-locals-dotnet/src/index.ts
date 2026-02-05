import { Console } from "@tsonic/dotnet/System.js";
import type { int } from "@tsonic/core/types.js";

export function main(): void {
  // 1) Boolean local used in boolean context must not degrade to `!= null`.
  const flag = false;
  let out1 = "";
  if (flag) out1 = "T";
  else out1 = "F";
  Console.WriteLine(out1);

  // 2) Multi-declarator: later initializer must see earlier decl type.
  const a = false, b = !a;
  Console.WriteLine(b ? "T" : "F");

  // 3) Multi-declarator + logical operator: boolean `||` must not become `??`.
  const x = false, y = x || true;
  Console.WriteLine(y ? "T" : "F");

  // 4) Numeric truthiness for Int32: `for (; i; i--)` must stop at 0.
  let i = 2 as int;
  let loops = 0 as int;
  for (; i; i--) {
    loops++;
    if (loops > 10) break; // guard against `i != null` infinite loop bugs
  }
  Console.WriteLine(loops);

  // 5) for-of loop variable must be typed from iterable element type (string).
  const xs = ["", "x"];
  let nonEmpty = 0 as int;
  for (const s of xs) {
    if (s) nonEmpty++;
  }
  Console.WriteLine(nonEmpty);

  // 6) for-in loop variable is always string; empty key must be falsy.
  const obj: Record<string, int> = { "": 1 as int, a: 2 as int };
  let nonEmptyKeys = 0 as int;
  for (const k in obj) {
    if (k) nonEmptyKeys++;
  }
  Console.WriteLine(nonEmptyKeys);

  // 7) Destructuring must type bound locals so numeric truthiness works.
  const [n] = [0 as int];
  let d = 0 as int;
  if (n) d = 1 as int;
  Console.WriteLine(d);
}

