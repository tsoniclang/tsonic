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
Console.writeLine(`Int array length: ${intArr.length}`);

const strArr = createStringArray(4);
Console.writeLine(`String array length: ${strArr.length}`);

const fixedArr = createFixedArray();
Console.writeLine(`Fixed array length: ${fixedArr.length}`);
