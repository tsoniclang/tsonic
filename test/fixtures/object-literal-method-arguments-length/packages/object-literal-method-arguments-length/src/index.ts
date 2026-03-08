import { Console } from "@tsonic/dotnet/System.js";

declare global {
  interface IArguments {
    readonly length: number;
  }
}

export function main(): void {
  const ops = {
    add(x: number, y: number): number {
      return arguments.length + x + y;
    },
  };

  Console.WriteLine(ops.add(1, 2));
}
