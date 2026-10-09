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

export const suspendedClassActivationCallableSource = `
import type { int32 } from "@tsonic/core/types.js";
class Counter {
  total: int32 = 0;
  readonly advance = async (): Promise<int32> => {
    await Promise.resolve(undefined);
    this.total++;
    if (this.total < 3) return await this.finish();
    return this.total;
  };
  readonly finish = async (): Promise<int32> => {
    await Promise.resolve(undefined);
    return await this.advance();
  };
}
function pending(): Promise<int32> {
  const owner = new Counter();
  return owner.advance();
}
export async function run(): Promise<boolean> {
  const first = new Counter();
  const alias = first.advance;
  const second = new Counter();
  return alias === first.advance && alias !== second.advance && await alias() === 3 &&
    await first.advance() === 4 && await second.advance() === 3 && await pending() === 3;
}
export async function main(): Promise<void> {
  if (!await run()) {
    throw new Error("suspended class activation identity or lifetime was lost");
  }
}
`;
