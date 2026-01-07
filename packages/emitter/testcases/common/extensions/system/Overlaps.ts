import type { ExtensionMethods as SystemExt } from "@tsonic/dotnet/System.js";
import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

type Ext<T> = SystemExt<T>;

export function run(): void {
  const s = "hello";

  const a = (s as unknown as Ext<string>).asSpan();
  const b = (s as unknown as Ext<string>).asSpan(1);

  let off: int = 0;

  const ok1 = a.overlaps(b);
  const ok2 = a.overlaps(b, off);

  Console.writeLine(`ok1: ${ok1}`);
  Console.writeLine(`ok2: ${ok2} off: ${off}`);
}
