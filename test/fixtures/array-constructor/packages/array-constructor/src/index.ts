import { int, double } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";

function createIntArray(size: int): int[] {
  return new Array<int>(size);
}

function createStringArray(size: int): string[] {
  return new Array<string>(size);
}

function createFixedArray(): int[] {
  return new Array<int>(5);
}

const intArr = createIntArray(3);
Console.WriteLine(`Int array length: ${intArr.Length}`);

const strArr = createStringArray(4);
Console.WriteLine(`String array length: ${strArr.Length}`);

const fixedArr = createFixedArray();
Console.WriteLine(`Fixed array length: ${fixedArr.Length}`);
