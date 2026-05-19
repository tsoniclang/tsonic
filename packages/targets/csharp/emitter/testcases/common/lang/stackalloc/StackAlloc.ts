import { Console } from "@tsonic/dotnet/System.js";
import { stackalloc } from "@tsonic/core/lang.js";
import { int } from "@tsonic/core/types.js";

export function run(): void {
  const buffer = stackalloc<int>(256);
  buffer[0] = 42;
  Console.WriteLine(buffer[0]);
  Console.WriteLine(buffer.Length);
}
