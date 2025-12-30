import { Console } from "@tsonic/dotnet/System.js";

const add = (a: number, b: number): number => a + b;

const greet = (name: string): string => {
  return `Hello ${name}`;
};

Console.writeLine(`Add: ${add(3, 5)}`);
Console.writeLine(greet("World"));
