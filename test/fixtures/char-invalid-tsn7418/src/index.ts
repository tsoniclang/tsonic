import { Char } from "@tsonic/dotnet/System.js";
import { Rune } from "@tsonic/dotnet/System.Text.js";
import { char } from "@tsonic/core/types.js";

export function main(): void {
  // Invalid literals (length must be 1)
  const a: char = "";
  const b: char = "AB";

  // Non-literal strings are not accepted as char without an explicit conversion.
  const s: string = "A";
  const c: char = s;

  // Call arguments expecting char must be length-1 literals.
  Char.isLetter("AB");

  // Constructor arguments expecting char must be length-1 literals.
  const r = new Rune("AB");

  // Type assertion to char does not make an invalid literal valid.
  const d = ("AB" as char);
  // (Unused vars are fine in fixtures.)
  const _ = [a, b, c, r, d];
}
