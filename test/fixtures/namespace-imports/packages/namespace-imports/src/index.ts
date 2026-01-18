// Test namespace imports (import * as)
import * as MathUtils from "./utils/math.js";
import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  // Use namespace import to access members
  const sum = MathUtils.add(5.0, 3.0);
  const product = MathUtils.multiply(4.0, 7.0);

  Console.WriteLine(`Sum: ${sum}`);
  Console.WriteLine(`Product: ${product}`);
  Console.WriteLine(`PI: ${MathUtils.PI}`);
  Console.WriteLine("Done");
}
