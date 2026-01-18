// Multi-file import test
import { Console } from "@tsonic/dotnet/System.js";
import { add, multiply } from "./utils/Math.js";

export function main(): void {
  const sum = add(5.0, 3.0);
  const product = multiply(4.0, 7.0);
  Console.WriteLine(`Sum: ${sum}`);
  Console.WriteLine(`Product: ${product}`);
}
