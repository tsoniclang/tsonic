import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

// Async function returning sync function
async function createMultiplier(factor: int): Promise<(x: int) => int> {
  return (x: int): int => (x * factor) as int;
}

// Async function returning async function
async function createAsyncAdder(base: int): Promise<(x: int) => Promise<int>> {
  return async (x: int): Promise<int> => (base + x) as int;
}

// Function taking async callback
async function withAsyncCallback<T>(
  value: T,
  callback: (x: T) => Promise<string>
): Promise<string> {
  return await callback(value);
}

async function main(): Promise<void> {
  const mult3 = await createMultiplier(3 as int);
  Console.writeLine(`3 * 5 = ${mult3(5 as int)}`);

  const asyncAdd10 = await createAsyncAdder(10 as int);
  const result = await asyncAdd10(7 as int);
  Console.writeLine(`10 + 7 = ${result}`);

  const msg = await withAsyncCallback(
    42 as int,
    async (x: int): Promise<string> => `Value is ${x}`
  );
  Console.writeLine(msg);
}

main();
