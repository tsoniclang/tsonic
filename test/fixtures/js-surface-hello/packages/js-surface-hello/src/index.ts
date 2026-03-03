import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  const message = "  hello  ".trim();
  const upper = message.toUpperCase();
  const parsed = parseInt("42");

  Console.WriteLine(upper);
  if (parsed !== undefined) {
    Console.WriteLine(parsed.ToString());
  }
}
