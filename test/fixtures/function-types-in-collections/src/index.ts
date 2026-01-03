import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

type Operation = (a: int, b: int) => int;

// Array of functions
const operations: Operation[] = [
  (a, b) => a + b,
  (a, b) => a - b,
  (a, b) => a * b,
];

// Interface with function properties
interface OperationMap {
  add: Operation;
  subtract: Operation;
  multiply: Operation;
}

const opMap: OperationMap = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
};

export function main(): void {
  const a: int = 10;
  const b: int = 5;

  // Test array of functions
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    Console.writeLine(`Op ${i}: ${op(a, b)}`);
  }

  // Test object with function properties
  Console.writeLine(`Add: ${opMap.add(a, b)}`);
  Console.writeLine(`Subtract: ${opMap.subtract(a, b)}`);
  Console.writeLine(`Multiply: ${opMap.multiply(a, b)}`);
}
