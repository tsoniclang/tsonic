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

Console.WriteLine(greet("World"));
Console.WriteLine(`Add: ${add(3, 7)}`);
Console.WriteLine(`Is 4 even: ${isEven(4)}`);
Console.WriteLine(`Is 5 even: ${isEven(5)}`);
