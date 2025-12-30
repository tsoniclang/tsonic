import { Console } from "@tsonic/dotnet/System.js";

function greet(name: string): string {
  return `Hello ${name}`;
}

function add(a: number, b: number): number {
  return a + b;
}

function isEven(n: number): boolean {
  return n % 2 === 0;
}

Console.writeLine(greet("World"));
Console.writeLine(`Add: ${add(3, 7)}`);
Console.writeLine(`Is 4 even: ${isEven(4)}`);
Console.writeLine(`Is 5 even: ${isEven(5)}`);
