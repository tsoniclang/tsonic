import { Console } from "@tsonic/dotnet/System.js";
import { stackalloc } from "@tsonic/core/lang.js";
import { int } from "@tsonic/core/types.js";

export function main(): void {
  const buffer = stackalloc<int>(256);
  buffer[0] = 42;

  Console.writeLine(`First: ${buffer[0]}`);
  Console.writeLine(`Length: ${buffer.length}`);
}

