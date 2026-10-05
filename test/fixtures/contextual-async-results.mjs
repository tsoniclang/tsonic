export const contextualAsyncResultSource = `
import type { int32 } from "@tsonic/core/types.js";

class Reply {
  count: int32;
  constructor(count: int32) { this.count = count; }
}
type HandlerResult = void | Reply | Promise<void | Reply>;
interface Handler { (present: boolean): HandlerResult; }
async function pause(): Promise<void> {}

function implicitCompletion(): Handler {
  return async (_present: boolean) => { await pause(); };
}
function explicitAbsence(): Handler {
  return async (_present: boolean) => { await pause(); return undefined; };
}
function optionalResult(): Handler {
  return async (present: boolean) => {
    await pause();
    if (present) return new Reply(7);
  };
}
function failedCompletion(): Handler {
  return async (_present: boolean) => { await pause(); throw new Error("rejected"); };
}
function capturedCompletion(seed: int32): Handler {
  let count: int32 = seed;
  return async (present: boolean) => {
    await pause();
    count += 1;
    if (present) return new Reply(count);
    return undefined;
  };
}
function namedCompletion(): Handler {
  return async function completed(_present: boolean) { await pause(); };
}
function retain(handler: Handler): Handler { return handler; }
function passedCompletion(): Handler {
  return retain(async (_present: boolean) => { await pause(); return undefined; });
}
const storedCompletion: Handler = async (_present: boolean) => { await pause(); };
const inferredStoredCompletion = async (present: boolean) => {
  await pause();
  if (present) return new Reply(9);
};

export async function run(): Promise<boolean> {
  if (await implicitCompletion()(false) !== undefined) return false;
  if (await explicitAbsence()(false) !== null) return false;
  if (await namedCompletion()(false) !== undefined) return false;
  if (await passedCompletion()(false) !== undefined) return false;
  if (await storedCompletion(false) !== undefined) return false;
  if (await inferredStoredCompletion(false) !== undefined) return false;
  const stored = await inferredStoredCompletion(true);
  if (stored === undefined || stored.count !== 9) return false;
  const optional = optionalResult();
  if (await optional(false) !== undefined) return false;
  const present = await optional(true);
  if (present === undefined || present.count !== 7) return false;
  const retained = capturedCompletion(10);
  const alias = retained;
  if (alias !== retained) return false;
  if (await retained(false) !== undefined) return false;
  const first = await alias(true);
  const second = await retained(true);
  if (first === undefined || second === undefined || first.count !== 12 || second.count !== 13) return false;
  const pending = failedCompletion()(false);
  let failures = 0;
  try { await pending; } catch { failures += 1; }
  try { await pending; } catch { failures += 1; }
  return failures === 2;
}
export async function main(): Promise<void> { if (!await run()) throw new Error("contextual async result"); }
`;

export const ordinaryAsyncResultSource = `
import type { int64 } from "@tsonic/core/types.js";
export const explicit = async (): Promise<int64> => 9007199254740993n;
function wideValue(): int64 { return 9007199254740993n; }
export function inferred(): () => Promise<int64> { return async () => wideValue(); }
export async function main(): Promise<void> {
  if (await explicit() !== 9007199254740993n || await inferred()() !== 9007199254740993n) {
    throw new Error("native async integer output");
  }
}
`;

export const contextualAsyncCostSource = `
import type { int32 } from "@tsonic/core/types.js";
export function makeEmpty(): () => Promise<int32 | void> { return async () => {}; }
`;

export const inlineContextualAsyncResultSource = `
import type { int32 } from "@tsonic/core/types.js";
class Reply {
  count: int32;
  constructor(count: int32) { this.count = count; }
}
export function makeEmpty(): () => (void | Reply | Promise<void | Reply>) {
  return async () => {};
}
export function makeOptional(): (present: boolean) => (Promise<void | Reply> | Reply | void) {
  return async (present: boolean) => { if (present) return new Reply(7); };
}
export async function main(): Promise<void> {
  if (await makeEmpty()() !== undefined) throw new Error("inline empty result");
  const optional = makeOptional();
  if (await optional(false) !== null) throw new Error("inline absent result");
  const present = await optional(true);
  if (present === undefined || present.count !== 7) throw new Error("inline present result");
}
`;
