import { Console } from "@tsonic/dotnet/System.js";

// E2E: Multi-member discriminated union narrowing via `"prop" in x`.
//
// This ensures:
// - Object-literal union selection works for 3+ members.
// - Early-return narrowing chains work (A -> B -> C).
type Shape = { a: string } | { b: number } | { c: boolean };

const fmt = (s: Shape): string => {
  if ("a" in s) return "A:" + s.a;
  if ("b" in s) return "B:" + s.b;
  if ("c" in s) return "C:" + (s.c ? "t" : "f");
  return "unreachable";
};

export function main(): void {
  Console.WriteLine(fmt({ a: "x" }));
  Console.WriteLine(fmt({ b: 5 }));
  Console.WriteLine(fmt({ c: true }));
}
