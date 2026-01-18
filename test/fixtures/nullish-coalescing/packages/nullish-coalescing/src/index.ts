import { Console } from "@tsonic/dotnet/System.js";

function getDefault(value: string | null | undefined): string {
  return value ?? "default";
}

function getNumber(value: number | null): number {
  return value ?? 0;
}

Console.WriteLine(`With value: ${getDefault("hello")}`);
Console.WriteLine(`With null: ${getDefault(null)}`);
Console.WriteLine(`With undefined: ${getDefault(undefined)}`);
Console.WriteLine(`Number with value: ${getNumber(42)}`);
Console.WriteLine(`Number with null: ${getNumber(null)}`);
