import { Console } from "@tsonic/dotnet/System.js";

function shadowedVariable(): number {
  const x = 10;
  {
    const x = 20;
    return x;
  }
}

function shadowInFunction(): number {
  const value = 5;
  const inner = (): number => {
    const value = 10;
    return value;
  };
  return value + inner();
}

Console.writeLine(`Shadowed: ${shadowedVariable()}`);
Console.writeLine(`Shadow in function: ${shadowInFunction()}`);
