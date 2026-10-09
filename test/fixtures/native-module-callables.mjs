export const nativeModuleCallableFiles = {
  "types.ts": `
import type { int64 } from "@tsonic/core/types.js";
export interface Callback<Input, Output = Input> { (value: Input): Output; }
export interface AsyncCallback<Input, Output = Input> { (value: Input): Promise<Output>; }
export type AsyncAlias<Value> = AsyncCallback<Value>;
export interface InheritedExact extends AsyncCallback<int64> {}
export interface GenericInherited<Value, Output = Value> extends AsyncCallback<Value, Output> {}
export interface RepeatedExact extends GenericInherited<int64>, AsyncCallback<int64> {}
`,
  "state.ts": `
import type { int32 } from "@tsonic/core/types.js";
let defaults = 0;
export function next(): int32 { defaults++; return 5; }
export function defaultCount(): number { return defaults; }
`,
  "api.ts": `
import type { int32, int64, uint64 } from "@tsonic/core/types.js";
import type { Callback, AsyncCallback, AsyncAlias, InheritedExact, RepeatedExact } from "./types.js";
import { next } from "./state.js";
export { defaultCount } from "./state.js";
export const numeric: AsyncCallback<number> = async value => value + 1;
export const textual: AsyncCallback<string> = async value => value + "!";
export const exact: AsyncAlias<int64> = async value => value;
export const inherited: InheritedExact = async value => value;
export const repeated: RepeatedExact = async value => value;
export const nullable: AsyncCallback<int64, int64 | null> = async value => value;
export const unsigned: Callback<uint64> = value => value;
export const count: Callback<string, number> = (value: string) => value === "retained" ? 8 : 0;
export const optional: (value?: int32) => int32 = (value = 3) => value;
export const deferred: (value?: int32) => int32 = (value = next()) => value;
export const total: (first: int32, ...values: int32[]) => int32 = (first, ...values) => {
  let result = first;
  for (const value of values) result += value;
  return result;
};
export const checked: AsyncCallback<int32> = async value => {
  if (value < 0) throw new Error("negative argument");
  return value;
};
`,
  "bridge.ts": `
export { exact as forwarded } from "./api.js";
`,
  "index.ts": `
import type { int32, int64, uint64 } from "@tsonic/core/types.js";
import { numeric, count, optional, total, checked } from "./api.js";
import * as api from "./api.js";
import { forwarded } from "./bridge.js";
export async function run(): Promise<boolean> {
  const wide: int64 = 9007199254740993n;
  const positive: uint64 = 18446744073709551615n;
  const left: int32 = 2;
  const right: int32 = 4;
  const text = "retained";
  if (count(text) !== 8 || text !== "retained") return false;
  if (optional() !== 3 || optional(left) !== left || total(left, right, left) !== 8) return false;
  if (api.defaultCount() !== 0 || api.deferred(0) !== 0 || api.defaultCount() !== 0) return false;
  if (api.deferred() !== 5 || api.deferred(undefined) !== 5 || api.defaultCount() !== 2) return false;
  if (await numeric(1) !== 2 || await api.textual("a") !== "a!") return false;
  if (await forwarded(wide) !== wide || api.unsigned(positive) !== positive) return false;
  if (await api.inherited(wide) !== wide) return false;
  if (await api.repeated(wide) !== wide || await api.nullable(wide) !== wide) return false;
  let rejected = false;
  try { await checked(-left); } catch { rejected = true; }
  return rejected && await checked(left) === left;
}
`,
};

export const conflictingNativeCallableSource = `
import type { int64, uint64 } from "@tsonic/core/types.js";
interface Callback<Value> { (value: Value): Value; }
interface Conflicting extends Callback<int64>, Callback<uint64> {}
export const identity: Conflicting = value => value;
`;

export const relocatedModuleCallableFiles = {
  "other.ts": `
import type { int32 } from "@tsonic/core/types.js";
export const step = (value: int32): int32 => value + 1;
`,
  "helpers.ts": `
import type { int32 } from "@tsonic/core/types.js";
import { step as importedStep } from "./other.js";
const base: int32 = 2;
const step = (value: int32): int32 => value + base;
function multiply(value: int32): int32 { return value * 3; }
export function plain(value: int32): int32 { return multiply(step(value)); }
export function recursive(seed: int32): int32 {
  let total: int32 = 0;
  const walk = (value: int32): void => {
    total += multiply(step(value));
    if (value > 0) walk(value - 1);
  };
  walk(seed);
  return total;
}
export function object(seed: int32): int32 {
  const record = {
    apply(value: int32): int32 { return multiply(step(value)) + importedStep(seed); },
  };
  return record.apply(1);
}
`,
  "index.ts": `
import { plain, recursive, object } from "./helpers.js";
export function run(): boolean {
  return plain(1) === 9 && recursive(2) === 27 && recursive(1) === 15
    && object(4) === 14 && object(0) === 10;
}
`,
};
