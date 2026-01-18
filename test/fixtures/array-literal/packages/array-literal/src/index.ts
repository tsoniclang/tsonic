import { int } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";

function createArray(): int[] {
  const arr = [1, 2, 3];
  return arr;
}

const arr = createArray();
Console.WriteLine(`Array: ${arr[0]}, ${arr[1]}, ${arr[2]}`);
Console.WriteLine(`Length: ${arr.Length}`);
