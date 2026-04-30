import { Console } from "@tsonic/dotnet/System.js";

type RuntimeValue = string | number | boolean | object | null;

declare global {
  interface __ObjectLiteralMethodArgumentsIndexable {
    readonly [index: number]: RuntimeValue;
  }

  interface IArguments {
    readonly length: number;
  }

  interface IArguments extends __ObjectLiteralMethodArgumentsIndexable {}
}

export function main(): void {
  const ops = {
    add(x: number, y: number): number {
      return (arguments[0] as number) + y;
    },
  };

  Console.WriteLine(ops.add(1, 4));
}
