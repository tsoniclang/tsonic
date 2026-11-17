export const nativeUnaryLocationsSource = `
import type { int32 } from "@tsonic/core/types.js";

class Base {}
class Counter extends Base { value: int32 = 2; }

export function local(start: int32): int32 {
  let value: int32 = start;
  const previous: int32 = value++;
  const current: int32 = ++value;
  return previous + current + value;
}

export function parenthesized(start: int32): int32 {
  let value: int32 = start;
  const previous: int32 = (value)++;
  const current: int32 = --(value);
  return previous + current + value;
}

export function captured(start: int32): int32 {
  let value: int32 = start;
  function step(): int32 { return value++; }
  const previous: int32 = step();
  return previous + ++value;
}

export function updateReceiver(target: Base): int32 {
  if (target instanceof Counter) return target.value++;
  return 0;
}

export function run(): boolean {
  if (local(2) !== 10 || parenthesized(2) !== 6 || captured(2) !== 6) return false;
  const values: int32[] = [10, 20];
  let reads: int32 = 0;
  function pick(): int32 { reads += 1; return 0; }
  const previous: int32 = values[pick()]++;
  const current: int32 = --values[pick()];
  if (previous !== 10 || current !== 10 || reads !== 2 || values[0] !== 10) return false;
  const target = new Counter();
  if (updateReceiver(target) !== 2 || target.value !== 3) return false;
  const optional: Counter | undefined = target;
  if (optional !== undefined) {
    const before: int32 = optional.value++;
    if (before !== 3 || optional.value !== 4) return false;
  }
  return true;
}
`;
