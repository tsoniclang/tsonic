// Test multi-file imports
import { Console } from "@tsonic/dotnet/System.js";
// Named imports from re-export barrel
import { add, multiply, PI, prefix } from "./utils/index.js";

export function main(): void {
  // Test math utils
  const sum = add(10.0, 5.0);
  const product = multiply(4.0, 3.0);
  Console.writeLine(`Sum: ${sum}`);
  Console.writeLine(`Product: ${product}`);
  Console.writeLine(`PI: ${PI}`);

  // Test string utils
  const greeting = prefix("World", "Hello ");
  Console.writeLine(greeting);
}
