import { Console } from "@tsonic/dotnet/System.js";

function spreadArray(arr1: number[], arr2: number[]): number[] {
  return [...arr1, ...arr2];
}

const a = [1, 2, 3];
const b = [4, 5, 6];
const combined = spreadArray(a, b);

Console.writeLine(`Combined length: ${combined.length}`);
Console.writeLine(
  `Combined: ${combined[0]}, ${combined[1]}, ${combined[2]}, ${combined[3]}, ${combined[4]}, ${combined[5]}`
);
