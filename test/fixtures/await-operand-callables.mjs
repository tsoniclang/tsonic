export const awaitOperandCallableSource = `
import type { int32 } from "@tsonic/core/types.js";
class Failure extends Error {
  constructor(public readonly code: int32) { super("await failure"); }
}
export async function run(): Promise<boolean> {
  let order: int32 = 0;
  let executorCalls: int32 = 0;
  const original = new Failure(17);
  const value = await new Promise<int32>((resolve, reject) => {
    executorCalls++;
    const first = (step: int32): void => {
      if (step === 0) return;
      order = order * 10 + step;
      second(2);
    };
    const second = (step: int32): void => {
      order = order * 10 + step;
      first(0);
      resolve(order);
    };
    first(1);
  });
  let recovered = false;
  try {
    await new Promise<void>((resolve, reject) => {
      function fail(): void { reject(original); }
      fail();
    });
  } catch (reason) {
    recovered = reason instanceof Failure && reason === original && reason.code === 17;
  }
  return value === 12 && order === 12 && executorCalls === 1 && recovered;
}
export async function main(): Promise<void> {
  if (!await run()) throw new Error("await operand callable evidence was lost");
}
`;
