import { Console } from "@tsonic/dotnet/System.js";

function makeCounter(): () => number {
  let count = 0;
  return (): number => {
    count++;
    return count;
  };
}

function makeAdder(x: number): (y: number) => number {
  return (y: number): number => x + y;
}

const counter = makeCounter();
Console.WriteLine(`Count 1: ${counter()}`);
Console.WriteLine(`Count 2: ${counter()}`);
Console.WriteLine(`Count 3: ${counter()}`);

const add5 = makeAdder(5);
const add10 = makeAdder(10);
Console.WriteLine(`Add5(3): ${add5(3)}`);
Console.WriteLine(`Add10(3): ${add10(3)}`);
