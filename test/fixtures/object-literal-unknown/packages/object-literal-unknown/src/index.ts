import { Console } from "@tsonic/dotnet/System.js";

function sink(_x: unknown): void {}

export function main(): void {
  // Regression: object literal passed to `unknown` must instantiate the
  // synthesized __Anon_* type, not `new object { ... }` (invalid C#).
  sink({ ok: true });
  Console.WriteLine("ok");
}

