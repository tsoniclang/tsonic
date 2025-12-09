// Test multi-file imports
import { Console } from "@tsonic/dotnet/System";
// Named imports from re-export barrel
import { add, multiply, PI, prefix } from "./utils/index.ts";

export function main(): void {
  // Test math utils
  const sum = add(10, 5);
  const product = multiply(4, 3);
  Console.writeLine(`Sum: ${sum}`);
  Console.writeLine(`Product: ${product}`);
  Console.writeLine(`PI: ${PI}`);

  // Test string utils
  const greeting = prefix("World", "Hello ");
  Console.writeLine(greeting);
}
