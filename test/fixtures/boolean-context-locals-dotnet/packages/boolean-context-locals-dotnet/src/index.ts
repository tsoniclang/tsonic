import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
import type { int, long } from "@tsonic/core/types.js";

type BoolBox = { readonly __kind: "BoolBox"; readonly value: boolean };
type WrappedBool = boolean | BoolBox;

type IntBox = { readonly __kind: "IntBox"; readonly value: int };
type WrappedInt = int | IntBox;

type LongBox = { readonly __kind: "LongBox"; readonly value: long };
type WrappedLong = long | LongBox;

type StringBox = { readonly __kind: "StringBox"; readonly value: string };
type WrappedString = string | StringBox;

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

  // 8) CLR bool return types (System.Boolean) must not degrade to `!= null`.
  // This catches a subtle miscompile where `if (bclBool)` becomes `if (bclBool != null)`,
  // which silently compiles (boxing) but is always true for value types.
  const bclBool = "x".Contains("y");
  Console.WriteLine(bclBool ? "T" : "F");

  // 9) Unknown/any typed locals must use JS truthiness, not `!= null`.
  // `false as unknown` boxes to a non-null object in C#, so `!= null` would miscompile to true.
  const unkBool = false as unknown;
  Console.WriteLine(unkBool ? "T" : "F");

  const unkInt = 0 as unknown;
  Console.WriteLine(unkInt ? "T" : "F");

  const unkString = "" as unknown;
  Console.WriteLine(unkString ? "T" : "F");

  const unkObj = new List<int>() as unknown;
  Console.WriteLine(unkObj ? "T" : "F");

  // 10) Union wrappers around falsy CLR primitives must not degrade to `!= null`.
  //
  // Union/intersection types can appear via bindings and generics. If boolean-context lowering
  // emits `x != null` for these, C# can silently box value types (bool/int/...) and become
  // always-true, which is a catastrophic miscompile.
  const wrappedFalse: WrappedBool = false;
  Console.WriteLine(wrappedFalse ? "T" : "F");

  const wrappedZero: WrappedInt = 0 as int;
  Console.WriteLine(wrappedZero ? "T" : "F");

  const wrappedLongZero: WrappedLong = 0 as long;
  Console.WriteLine(wrappedLongZero ? "T" : "F");

  const wrappedEmpty: WrappedString = "";
  Console.WriteLine(wrappedEmpty ? "T" : "F");

  // 11) Unary `!` must apply JS truthiness (not require a boolean operand).
  const z0 = 0 as int;
  Console.WriteLine(!z0 ? "T" : "F");

  const z1 = 1 as int;
  Console.WriteLine(!z1 ? "T" : "F");

  // 12) Logical short-circuit must be preserved (side effects must not run when skipped).
  let calls = 0 as int;
  const hit = (): boolean => {
    calls++;
    return true;
  };

  const s1 = false && hit();
  Console.WriteLine(calls);

  const s2 = true || hit();
  Console.WriteLine(calls);

  const s3 = true && hit();
  Console.WriteLine(calls);

  const s4 = false || hit();
  Console.WriteLine(calls);

  // 13) Precedence between && and || must match JS/TS.
  const g1 = false && false || true;
  Console.WriteLine(g1 ? "T" : "F");

  const g2 = false && (false || true);
  Console.WriteLine(g2 ? "T" : "F");

  // 14) Numeric truthiness must parenthesize non-simple expressions like `a ?? b`
  // under pattern matching (`is double tmp`) to avoid precedence bugs in C#.
  const maybe0: number | undefined = undefined;
  Console.WriteLine((maybe0 ?? 0) ? "T" : "F");

  const maybe1: number | undefined = 1;
  Console.WriteLine((maybe1 ?? 0) ? "T" : "F");

  // 15) Same precedence hazard for conditional (ternary) expressions producing numbers.
  const t1 = true;
  Console.WriteLine((t1 ? 0 : 1) ? "T" : "F");

  const t2 = false;
  Console.WriteLine((t2 ? 0 : 1) ? "T" : "F");

  // 16) NaN must be falsy under JS truthiness rules for numbers.
  const n0: number = 0;
  const nan = n0 / n0;
  Console.WriteLine(nan ? "T" : "F");
}
