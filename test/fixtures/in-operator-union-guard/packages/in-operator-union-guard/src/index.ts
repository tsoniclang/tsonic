// E2E: `"prop" in union` guard lowering
//
// Requirements:
// - Object literals in union contexts must instantiate the selected union member,
//   not `new Union<...> { ... }`.
// - `"prop" in x` must lower to `x.IsN()` for unions.
// - Narrowing must apply in the then-branch (via AsN()).
// - For 2-member unions, the else branch should see the complementary member,
//   and for early-return patterns the remainder of the block should be narrowed.

import { Console } from "@tsonic/dotnet/System.js";

type Auth = { property_id: string } | { error: string };

const requireReadKey = (ok: boolean): Auth => {
  if (!ok) return { error: "unauthorized" };
  return { property_id: "p1" };
};

export function main(): void {
  const a1 = requireReadKey(false);
  if ("error" in a1) {
    Console.WriteLine("ERR1:" + a1.error);
  } else {
    Console.WriteLine("OK1:" + a1.property_id);
  }

  const a2 = requireReadKey(true);
  if ("error" in a2) {
    Console.WriteLine("ERR2:" + a2.error);
    return;
  }
  Console.WriteLine("OK2:" + a2.property_id);
}

