import { Console } from "@tsonic/dotnet/System.js";

const calc = {
  base: 2,
  mul(x: number): number {
    return this.base * x;
  },
};

Console.WriteLine(calc.mul(3));
