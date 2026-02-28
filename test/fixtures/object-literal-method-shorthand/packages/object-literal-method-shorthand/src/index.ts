import { Console } from "@tsonic/dotnet/System.js";

const calc = {
  add(x: number, y: number): number {
    return x + y;
  },
  sub(x: number, y: number): number {
    return x - y;
  },
};

const value = calc.add(10, 5) + calc.sub(10, 3);
Console.WriteLine(value);
