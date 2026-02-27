import { Console } from "@tsonic/dotnet/System.js";

export function run(): number {
  let x: any = 2;
  x = x + 3;
  x = -x;
  return x as number;
}

Console.WriteLine(run());
