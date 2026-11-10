export const sourceNativeCalleeFiles = Object.freeze({
  "helper.ts": `
import type { int32 } from "@tsonic/core/types.js";
export function echo<Value>(value: Value): Value { return value; }
export interface ReadView { read(): int32; }
export class Counter {
  value: int32;
  constructor(value: int32) { this.value = value; }
  read(): int32 { return this.value; }
  add(value: int32): void { this.value += value; }
  identity<Value>(value: Value): Value { return value; }
  static zero(): Counter { return new Counter(0 as int32); }
}
`,
  "index.ts": `
import type { int32 } from "@tsonic/core/types.js";
import { Counter, echo } from "./helper.js";
import type { ReadView } from "./helper.js";
export function create(): Counter { return new Counter(7 as int32); }
export function cost(counter: Counter): int32 { return counter.read(); }
function optional(counter: Counter | undefined): boolean {
  let evaluations = 0 as int32;
  function argument(): int32 { evaluations += 1; return 2 as int32; }
  counter?.add(argument());
  return counter === undefined ? evaluations === 0 : evaluations === 1;
}
function failure(): int32 { throw new Error("argument failure"); }
function optionalReturn(counter: Counter | undefined): void { return counter?.add(0 as int32); }
function optionalFailure(counter: Counter | undefined): boolean {
  let failed = false;
  try { counter?.add(failure()); } catch { failed = true; }
  return counter === undefined ? !failed : failed;
}
export function run(): boolean {
  const counter = new Counter(3 as int32);
  const view: ReadView = counter;
  counter.add(2 as int32);
  if (counter.read() !== 5 || view.read() !== 5 || counter.identity(echo(5 as int32)) !== 5) return false;
  if (Counter.zero().read() !== 0 || !optional(undefined) || !optional(counter) || counter.read() !== 7) return false;
  optionalReturn(undefined);
  optionalReturn(counter);
  if (!optionalFailure(undefined) || !optionalFailure(counter) || counter.read() !== 7) return false;
  let failed = false;
  try { counter.add(failure()); } catch { failed = true; }
  return failed && counter.read() === 7;
}
`,
});
