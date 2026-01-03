import { Console } from "@tsonic/dotnet/System.js";

// Test arrow function contextual type inference
function applyOperation(
  x: number,
  y: number,
  op: (a: number, b: number) => number
): number {
  return op(x, y);
}

// Arrow with inferred parameter types from context
const sum = applyOperation(10, 5, (a, b) => a + b);
const diff = applyOperation(10, 5, (a, b) => a - b);
const product = applyOperation(10, 5, (a, b) => a * b);

Console.writeLine(`Sum: ${sum}`);
Console.writeLine(`Diff: ${diff}`);
Console.writeLine(`Product: ${product}`);

// Higher-order with inference
function createMultiplier(factor: number): (x: number) => number {
  return (x) => x * factor;
}

const double = createMultiplier(2);
const triple = createMultiplier(3);

Console.writeLine(`Double 5: ${double(5)}`);
Console.writeLine(`Triple 5: ${triple(5)}`);
