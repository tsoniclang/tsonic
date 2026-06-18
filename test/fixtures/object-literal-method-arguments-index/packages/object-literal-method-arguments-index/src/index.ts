import { Console } from "@tsonic/dotnet/System.js";

export function main(): void {
  const ops = {
    add(x: number, y: number): number {
      return (arguments[0] as number) + y;
    },
  };

  Console.WriteLine(ops.add(1, 4));
}
