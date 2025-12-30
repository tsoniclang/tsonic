import { Console } from "@tsonic/dotnet/System";

// Test that number[] correctly emits as double[]
// Integer literals in number[] must emit as double[]
function createDoubleArray(): number[] {
  const arr: number[] = [1, 2, 3];
  return arr;
}

function returnDoubleArray(): number[] {
  return [4, 5, 6];
}

const arr1 = createDoubleArray();
const arr2 = returnDoubleArray();

Console.writeLine(`Array1: ${arr1[0]}, ${arr1[1]}, ${arr1[2]}`);
Console.writeLine(`Array2: ${arr2[0]}, ${arr2[1]}, ${arr2[2]}`);
