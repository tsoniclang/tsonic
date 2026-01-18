import { Console } from "@tsonic/dotnet/System.js";
import { stackalloc } from "@tsonic/core/lang.js";
import { int } from "@tsonic/core/types.js";

export function main(): void {
  const buffer = stackalloc<int>(256);
  buffer[0] = 42;

  Console.WriteLine(`First: ${buffer[0]}`);
  Console.WriteLine(`Length: ${buffer.Length}`);
}
