import type { ExtensionMethods as SystemExt } from "@tsonic/dotnet/System.js";
import { asinterface } from "@tsonic/core/lang.js";
import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

type Ext<T> = SystemExt<T>;

export function main(): void {
  Console.WriteLine("=== System Extension Methods E2E ===");

  const s = "hello";

  const a = asinterface<Ext<string>>(s).AsSpan();
  const b = asinterface<Ext<string>>(s).AsSpan(1);

  const ok1 = a.Overlaps(b);

  let off: int = 0;
  const ok2 = a.Overlaps(b, off);

  Console.WriteLine(`ok1: ${ok1}`);
  Console.WriteLine(`ok2: ${ok2} off: ${off}`);
}
