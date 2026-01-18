import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

// Async function returning sync function
async function createMultiplier(factor: int): Promise<(x: int) => int> {
  return (x) => x * factor;
}

// Async function returning async function
async function createAsyncAdder(base: int): Promise<(x: int) => Promise<int>> {
  return async (x) => base + x;
}

// Function taking async callback
async function withAsyncCallback<T>(
  value: T,
  callback: (x: T) => Promise<string>
): Promise<string> {
  return await callback(value);
}

async function main(): Promise<void> {
  const mult3 = await createMultiplier(3);
  Console.WriteLine(`3 * 5 = ${mult3(5)}`);

  const asyncAdd10 = await createAsyncAdder(10);
  const result = await asyncAdd10(7);
  Console.WriteLine(`10 + 7 = ${result}`);

  const msg = await withAsyncCallback(42, async (x) => `Value is ${x}`);
  Console.WriteLine(msg);
}

main();
