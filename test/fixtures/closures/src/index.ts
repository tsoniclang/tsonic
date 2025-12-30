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
Console.writeLine(`Count 1: ${counter()}`);
Console.writeLine(`Count 2: ${counter()}`);
Console.writeLine(`Count 3: ${counter()}`);

const add5 = makeAdder(5);
const add10 = makeAdder(10);
Console.writeLine(`Add5(3): ${add5(3)}`);
Console.writeLine(`Add10(3): ${add10(3)}`);
