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
  Console.writeLine(Char.isLetter("A"));
  Console.writeLine(Char.isLetter("1"));
  Console.writeLine(Char.isLetter(a));
  Console.writeLine(Char.isWhiteSpace("\n"));

  // Binary comparisons: char vs single-char string literal should emit char literals.
  Console.writeLine(c === "y");
  Console.writeLine(d === "n");
  Console.writeLine(quote === "'");
  Console.writeLine(slash === "\\");
  Console.writeLine(arr[0] === "a");
  Console.writeLine(arr[1] === "'");
  Console.writeLine(arr[2] === "\\");

  // Type assertions to char should format inner literals correctly.
  Console.writeLine(("Q" as char) === "Q");

  // Constructor arguments: expectedType char should emit C# char literals.
  const rune = new Rune("A");
  Console.writeLine(rune.toString());
}

