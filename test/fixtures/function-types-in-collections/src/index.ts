import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

type Operation = (a: int, b: int) => int;

// Array of functions
const operations: Operation[] = [
  (a: int, b: int): int => (a + b) as int,
  (a: int, b: int): int => (a - b) as int,
  (a: int, b: int): int => (a * b) as int,
];

// Interface with function properties
interface OperationMap {
  add: Operation;
  subtract: Operation;
  multiply: Operation;
}

const opMap: OperationMap = {
  add: (a: int, b: int): int => (a + b) as int,
  subtract: (a: int, b: int): int => (a - b) as int,
  multiply: (a: int, b: int): int => (a * b) as int,
};

export function main(): void {
  const a: int = 10 as int;
  const b: int = 5 as int;

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
