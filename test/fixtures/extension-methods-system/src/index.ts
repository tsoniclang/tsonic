import type { ExtensionMethods as SystemExt } from "@tsonic/dotnet/System.js";
import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

type Ext<T> = SystemExt<T>;

export function main(): void {
  Console.writeLine("=== System Extension Methods E2E ===");

  const s = "hello";

  const a = (s as unknown as Ext<string>).asSpan();
  const b = (s as unknown as Ext<string>).asSpan(1 as int);

  const ok1 = a.overlaps(b);

  let off: int = 0 as int;
  const ok2 = a.overlaps(b, off);

  Console.writeLine(`ok1: ${ok1}`);
  Console.writeLine(`ok2: ${ok2} off: ${off}`);
}

