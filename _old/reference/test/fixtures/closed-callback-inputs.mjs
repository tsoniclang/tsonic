export const closedIntegerCallbackInputsSource = `
import type { int32, int64 } from "@tsonic/core/types.js";
export function run(count: int32 = 10_000): boolean {
  const expected: int64 = 9007199254740993n;
  const values: int64[] = [expected, expected];
  let calls: int32 = 0;
  const inspect = (value: unknown): boolean => {
    calls++;
    return value === expected;
  };
  const alias = inspect;
  for (let index: int32 = 0; index < count; index++) {
    if (!values.every(alias)) return false;
  }
  return calls === count * 2;
}
`;

export const closedPromiseCallbackInputsSource = `
import type { int64 } from "@tsonic/core/types.js";
class DetailedError extends Error {
  readonly code: int64;
  constructor(code: int64) { super("native identity"); this.code = code; }
}
export async function run(): Promise<boolean> {
  const expected: int64 = 9007199254740993n;
  const original = new DetailedError(expected);
  let caught = false;
  const failure = (reason: unknown): void => {
    caught = reason instanceof DetailedError && reason === original && reason.code === expected;
  };
  const alias = failure;
  const reject = async (): Promise<void> => { throw original; };
  await reject().catch((((alias))));
  if (!caught) return false;
  caught = false;
  await reject().then(() => {}, failure);
  return caught;
}
`;

export const closedThrowingCallbackInputsSource = `
import type { int32 } from "@tsonic/core/types.js";
export function run(): boolean {
  const values: int32[] = [1, 2, 3];
  const original = new Error("native callback failure");
  const visit = (value: unknown): boolean => {
    if (value === 2) throw original;
    return true;
  };
  const alias = visit;
  try { values.every(alias); }
  catch (error) { return error === original; }
  return false;
}
`;

export const closedNativeCallbackEffectsSource = `
import type { int32 } from "@tsonic/core/types.js";
export function positive(value: int32): boolean { return value > 0; }
export function run(): boolean {
  const values: int32[] = [1, 2, 3];
  return positive(1) && values.every(positive);
}
`;
