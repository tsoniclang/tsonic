export const suspendedActivationCallableSource = `
import type { int32 } from "@tsonic/core/types.js";
function counter(): () => Promise<int32> {
  let total: int32 = 0;
  const advance = async (): Promise<int32> => {
    await Promise.resolve(undefined);
    total++;
    if (total < 3) return await finish();
    return total;
  };
  const finish = async (): Promise<int32> => {
    await Promise.resolve(undefined);
    return await advance();
  };
  return advance;
}
export async function run(): Promise<boolean> {
  const first = counter();
  const alias = first;
  const second = counter();
  const pending = first();
  const initial = await pending;
  const next = await alias();
  return first === alias && first !== second && initial === 3 && next === 4 && await second() === 3;
}
export async function main(): Promise<void> {
  if (!await run()) throw new Error("suspended activation identity or lifetime was lost");
}
`;
