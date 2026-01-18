import { Console } from "@tsonic/dotnet/System.js";
import {
  int,
  long,
  byte,
  short,
  float,
  decimal,
  uint,
  ulong,
} from "@tsonic/core/types.js";

export function main(): void {
  // Test int array
  const intArr: int[] = [1, 2, 3];
  Console.WriteLine(`int[]: ${intArr[0]}, ${intArr[1]}, ${intArr[2]}`);

  // Test long array (requires L suffix)
  const longArr: long[] = [1, 2, 3];
  Console.WriteLine(`long[]: ${longArr[0]}, ${longArr[1]}, ${longArr[2]}`);

  // Test byte array
  const byteArr: byte[] = [1, 2, 3];
  Console.WriteLine(`byte[]: ${byteArr[0]}, ${byteArr[1]}, ${byteArr[2]}`);

  // Test short array
  const shortArr: short[] = [1, 2, 3];
  Console.WriteLine(`short[]: ${shortArr[0]}, ${shortArr[1]}, ${shortArr[2]}`);

  // Test float array (requires f suffix)
  const floatArr: float[] = [1.5, 2.5, 3.5];
  Console.WriteLine(`float[]: ${floatArr[0]}, ${floatArr[1]}, ${floatArr[2]}`);

  // Test double array
  const doubleArr: number[] = [1.5, 2.5, 3.5];
  Console.WriteLine(
    `double[]: ${doubleArr[0]}, ${doubleArr[1]}, ${doubleArr[2]}`
  );

  // Test decimal array (requires m suffix)
  const decimalArr: decimal[] = [1.5, 2.5, 3.5];
  Console.WriteLine(
    `decimal[]: ${decimalArr[0]}, ${decimalArr[1]}, ${decimalArr[2]}`
  );

  // Test uint array (requires U suffix)
  const uintArr: uint[] = [1, 2, 3];
  Console.WriteLine(`uint[]: ${uintArr[0]}, ${uintArr[1]}, ${uintArr[2]}`);

  // Test ulong array (requires UL suffix)
  const ulongArr: ulong[] = [1, 2, 3];
  Console.WriteLine(`ulong[]: ${ulongArr[0]}, ${ulongArr[1]}, ${ulongArr[2]}`);

  // Test 2D long array (nested arrays with L suffix)
  const matrix: long[][] = [
    [1, 2],
    [3, 4],
  ];
  Console.WriteLine(`long[0][0]: ${matrix[0][0]}`);
  Console.WriteLine(`long[1][1]: ${matrix[1][1]}`);

  // Test 2D float array
  const floatMatrix: float[][] = [
    [1.5, 2.5],
    [3.5, 4.5],
  ];
  Console.WriteLine(`float[0][0]: ${floatMatrix[0][0]}`);
  Console.WriteLine(`float[1][1]: ${floatMatrix[1][1]}`);

  Console.WriteLine("All array types compiled successfully!");
}
