import { Console } from "@tsonic/dotnet/System";

function destructure(arr: number[]): number {
  const [first, second] = arr;
  return first + second;
}

const result = destructure([10, 20, 30]);
Console.writeLine(`Destructured sum: ${result}`);

const [a, b, c] = [1, 2, 3];
Console.writeLine(`Direct destructure: ${a}, ${b}, ${c}`);
