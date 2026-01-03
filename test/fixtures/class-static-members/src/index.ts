import { Console } from "@tsonic/dotnet/System.js";

class MathHelper {
  static PI: number = 3.14159;
  static E: number = 2.71828;

  static square(x: number): number {
    return x * x;
  }

  static cube(x: number): number {
    return x * x * x;
  }
}

Console.writeLine(`PI: ${MathHelper.PI}`);
Console.writeLine(`E: ${MathHelper.E}`);
Console.writeLine(`Square of 5: ${MathHelper.square(5)}`);
Console.writeLine(`Cube of 3: ${MathHelper.cube(3)}`);
