import { Console } from "@tsonic/dotnet/System.js";
import type { JsValue } from "@tsonic/core/types.js";

function sink(_x: JsValue): void {}

export function main(): void {
  // Regression: object literal passed to `JsValue` must instantiate the
  // synthesized __Anon_* type, not `new object { ... }` (invalid C#).
  sink({ ok: true });
  Console.WriteLine("ok");
}
