import { int } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System";

function createArray(): int[] {
  const arr = [1, 2, 3];
  return arr;
}

const arr = createArray();
Console.writeLine(`Array: ${arr[0]}, ${arr[1]}, ${arr[2]}`);
Console.writeLine(`Length: ${arr.length}`);
