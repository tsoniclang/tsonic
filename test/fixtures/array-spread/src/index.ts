import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

function spreadArray(arr1: int[], arr2: int[]): int[] {
  return [...arr1, ...arr2];
}

const a: int[] = [1, 2, 3];
const b: int[] = [4, 5, 6];
const combined = spreadArray(a, b);

Console.writeLine(`Combined length: ${combined.length}`);
Console.writeLine(
  `Combined: ${combined[0]}, ${combined[1]}, ${combined[2]}, ${combined[3]}, ${combined[4]}, ${combined[5]}`
);
