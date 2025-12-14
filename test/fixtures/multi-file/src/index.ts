// Multi-file import test
import { Console } from "@tsonic/dotnet/System";
import { add, multiply } from "./utils/Math.ts";

export function main(): void {
  const sum = add(5.0, 3.0);
  const product = multiply(4.0, 7.0);
  Console.writeLine(`Sum: ${sum}`);
  Console.writeLine(`Product: ${product}`);
}
