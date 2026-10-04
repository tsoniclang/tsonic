export const localFiniteAwaitBranches = `
import type { uint64 } from "@tsonic/core/types.js";
async function verify(deferred: boolean, absent: boolean): Promise<void> {
  const wide: uint64 = 9007199254740993n;
  const value = deferred ? Promise.resolve(wide) : wide;
  if (await value !== wide) throw new Error("finite await lost native width");
  const optional = absent ? null : deferred ? Promise.resolve(wide) : wide;
  const result = await optional;
  if (absent ? result !== undefined : result !== wide) throw new Error("finite await lost absence or value");
}
export async function main(): Promise<void> {
  await verify(false, false);
  await verify(true, false);
  await verify(false, true);
  await verify(true, true);
}
`;
