import { Console } from "@tsonic/dotnet/System.js";

function getDefault(value: string | null | undefined): string {
  return value ?? "default";
}

function getNumber(value: number | null): number {
  return value ?? 0;
}

class BoolHolder {
  readonly value: boolean;

  constructor(value: boolean) {
    this.value = value;
  }
}

function makeBoolHolder(value: boolean | undefined): BoolHolder {
  const flag = value ?? false;
  return new BoolHolder(flag);
}

Console.WriteLine(`With value: ${getDefault("hello")}`);
Console.WriteLine(`With null: ${getDefault(null)}`);
Console.WriteLine(`With undefined: ${getDefault(undefined)}`);
Console.WriteLine(`Number with value: ${getNumber(42)}`);
Console.WriteLine(`Number with null: ${getNumber(null)}`);
Console.WriteLine(`Bool holder: ${makeBoolHolder(undefined).value}`);
