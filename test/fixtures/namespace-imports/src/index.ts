// Test namespace imports (import * as)
import * as MathUtils from "./utils/math.ts";
import { Console } from "@tsonic/dotnet/System";

export function main(): void {
  // Use namespace import to access members
  const sum = MathUtils.add(5, 3);
  const product = MathUtils.multiply(4, 7);

  Console.writeLine(`Sum: ${sum}`);
  Console.writeLine(`Product: ${product}`);
  Console.writeLine(`PI: ${MathUtils.PI}`);
  Console.writeLine("Done");
}
