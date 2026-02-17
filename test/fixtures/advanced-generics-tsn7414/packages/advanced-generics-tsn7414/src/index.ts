import { Console } from "@tsonic/dotnet/System.js";
import { divide } from "./result.js";

// E2E: Generic discriminated unions with inline object members.
//
// Requirements:
// - This must be representable in the CLR subset (no TSN7414).
// - Union members must synthesize generic CLR types (e.g., Result__0<T,E>).
// - `"error" in r` must narrow the union (then-branch + else-branch).
// NOTE: The union + helpers live in a separate module (result.ts) to ensure
// generic union synthesis + narrowing works across module boundaries.

export function main(): void {
  const r1 = divide(1, 0);
  if ("error" in r1) {
    Console.WriteLine("E1:" + r1.error);
  } else {
    Console.WriteLine("V1:" + r1.value);
  }

  const r2 = divide(4, 2);
  if ("error" in r2) {
    Console.WriteLine("E2:" + r2.error);
    return;
  }
  Console.WriteLine("V2:" + r2.value);
}
