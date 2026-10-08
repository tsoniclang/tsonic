export const finiteCompletionSequencingSource = `
import type { int32 } from "@tsonic/core/types.js";
export type MixedCompletion = int32 | Promise<void> | undefined;
export async function ordered(
  first: () => int32,
  pending: () => MixedCompletion,
  last: () => int32,
  consume: (first: int32, completed: int32 | void | undefined, last: int32) => int32,
): Promise<int32> {
  return consume(first(), await pending(), last());
}
export async function conditional(
  enabled: boolean,
  pending: () => MixedCompletion,
  fallback: () => int32,
): Promise<int32 | void | undefined> {
  return enabled ? await pending() : fallback();
}
export async function lazyAnd(enabled: boolean, pending: () => MixedCompletion): Promise<boolean | int32 | void | undefined> {
  return enabled && await pending();
}
export async function lazyOr(enabled: boolean, pending: () => MixedCompletion): Promise<boolean | int32 | void | undefined> {
  return enabled || await pending();
}
export async function coalesce(present: int32 | undefined, pending: () => MixedCompletion): Promise<int32 | void | undefined> {
  return present ?? await pending();
}
export async function snapshot(pending: () => MixedCompletion): Promise<int32> {
  let current = 1 as int32;
  function mutate(): MixedCompletion { current = 2 as int32; return pending(); }
  function first(left: int32, ignored: int32 | void | undefined): int32 { return left; }
  return first(current, await mutate());
}
export async function loop(
  pending: () => MixedCompletion,
  effect: () => void,
): Promise<int32> {
  let visits = 0 as int32;
  for (let index = 0 as int32; index < 3; effect()) {
    index++;
    const completed = await pending();
    if (completed == null) continue;
    visits++;
  }
  return visits;
}
`;

export const finiteCompletionSequencingExecutionSource = `${finiteCompletionSequencingSource}
export async function main(): Promise<void> {
  let calls = 0 as int32;
  function first(): int32 { calls = calls * 10 + 1; return 11; }
  function pending(): MixedCompletion { calls = calls * 10 + 2; return Promise.resolve(undefined); }
  function last(): int32 { calls = calls * 10 + 3; return 22; }
  function consume(left: int32, completed: int32 | void | undefined, right: int32): int32 {
    calls = calls * 10 + 4;
    if (left !== 11 || completed !== null || right !== 22) throw new Error("ordered arguments");
    return 33;
  }
  if (await ordered(first, pending, last, consume) !== 33 || calls !== 1234) throw new Error("ordered completion");
  let invocations = 0 as int32;
  function invocationCount(): int32 { return invocations; }
  function direct(): MixedCompletion { invocations += 1; return 44 as int32; }
  function fallback(): int32 { return 55; }
  if (await conditional(false, direct, fallback) !== 55 || invocationCount() !== 0) throw new Error("conditional laziness");
  if (await lazyAnd(false, direct) !== false || await lazyOr(true, direct) !== true ||
    await coalesce(66 as int32, direct) !== 66 || invocationCount() !== 0) throw new Error("short-circuit laziness");
  if (await conditional(true, direct, fallback) !== 44 || await lazyAnd(true, direct) !== 44 ||
    await lazyOr(false, direct) !== 44 || invocationCount() !== 3) throw new Error("selected logical completion");
  function absent(): MixedCompletion { return undefined; }
  function completed(): MixedCompletion { return Promise.resolve(undefined); }
  if (await lazyAnd(true, completed) !== undefined || await lazyOr(false, absent) !== null ||
    await snapshot(completed) !== 1) throw new Error("absence or argument snapshot");
  let advances = 0 as int32;
  function effect(): void { advances += 1; }
  if (await loop(completed, effect) !== 0 || advances !== 3) throw new Error("loop continuation");
  const failure = new Error("finite sequencing failure");
  async function rejected(): Promise<void> { throw failure; }
  function failed(): MixedCompletion { calls = calls * 10 + 2; return rejected(); }
  calls = 0 as int32;
  let caught = false;
  try { await ordered(first, failed, last, consume); }
  catch (actual) { if (actual !== failure || calls !== 12) throw new Error("failure identity or ordering"); caught = true; }
  if (!caught) throw new Error("failure was lost");
}
`;
