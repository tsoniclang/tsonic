import { Console } from "@tsonic/dotnet/System.js";

function sink(_x: object): void {}

export function main(): void {
  // Regression: object literal passed to `object` must not emit
  // `new object { ... }` (invalid C# object initializer).
  sink({ ok: true });
  Console.WriteLine("ok");
}
