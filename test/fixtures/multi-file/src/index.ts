// Multi-file import test
import { Console } from "@tsonic/dotnet/System";
import { add, multiply } from "./utils/Math.ts";

export function main(): void {
  const sum = add(5, 3);
  const product = multiply(4, 7);
  Console.writeLine(`Sum: ${sum}`);
  Console.writeLine(`Product: ${product}`);
}
