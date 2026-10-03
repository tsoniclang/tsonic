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
