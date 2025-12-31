import { int } from "@tsonic/core/types.js";

// Async function returning sync function
export async function createMultiplier(factor: int): Promise<(x: int) => int> {
  return (x: int): int => (x * factor) as int;
}

// Async function returning async function
export async function createAsyncAdder(
  base: int
): Promise<(x: int) => Promise<int>> {
  return async (x: int): Promise<int> => (base + x) as int;
}

// Function taking async callback
export async function withAsyncCallback<T>(
  value: T,
  callback: (x: T) => Promise<string>
): Promise<string> {
  return await callback(value);
}
