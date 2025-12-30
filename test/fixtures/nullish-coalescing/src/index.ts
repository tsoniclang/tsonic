import { Console } from "@tsonic/dotnet/System";

function getDefault(value: string | null | undefined): string {
  return value ?? "default";
}

function getNumber(value: number | null): number {
  return value ?? 0;
}

Console.writeLine(`With value: ${getDefault("hello")}`);
Console.writeLine(`With null: ${getDefault(null)}`);
Console.writeLine(`With undefined: ${getDefault(undefined)}`);
Console.writeLine(`Number with value: ${getNumber(42)}`);
Console.writeLine(`Number with null: ${getNumber(null)}`);
