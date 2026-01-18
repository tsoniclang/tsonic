import { Console, Char } from "@tsonic/dotnet/System.js";
import { Rune } from "@tsonic/dotnet/System.Text.js";
import { char } from "@tsonic/core/types.js";

export function main(): void {
  const a: char = "A";
  const quote: char = "'";
  const slash: char = "\\";

  let c: char = "x";
  c = "y";

  const d: char = false ? "m" : "n";
  const arr: char[] = ["a", quote, slash];

  // Call arguments: expectedType char should emit C# char literals.
  Console.WriteLine(Char.IsLetter("A"));
  Console.WriteLine(Char.IsLetter("1"));
  Console.WriteLine(Char.IsLetter(a));
  Console.WriteLine(Char.IsWhiteSpace("\n"));

  // Binary comparisons: char vs single-char string literal should emit char literals.
  Console.WriteLine(c === "y");
  Console.WriteLine(d === "n");
  Console.WriteLine(quote === "'");
  Console.WriteLine(slash === "\\");
  Console.WriteLine(arr[0] === "a");
  Console.WriteLine(arr[1] === "'");
  Console.WriteLine(arr[2] === "\\");

  // Type assertions to char should format inner literals correctly.
  Console.WriteLine(("Q" as char) === "Q");

  // Constructor arguments: expectedType char should emit C# char literals.
  const rune = new Rune("A");
  Console.WriteLine(rune.ToString());
}
