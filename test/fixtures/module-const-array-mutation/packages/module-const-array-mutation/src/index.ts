import { Console } from "@tsonic/dotnet/System.js";

const parts: string[] = [];

function add(value: string): void {
  parts.push(value);
}

function main(): void {
  add("hello");
  add("world");
  Console.WriteLine(parts.join("-"));
}

main();
