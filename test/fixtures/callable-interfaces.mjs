export const callableInterfaceFiles = {
  "callbacks.ts": `
export interface Callback<Value> { (value: Value): Value; }
export interface Numeric extends Callback<number> {}
export interface Merged { (value: number): number; }
export interface Merged {}
export type Renamed = Numeric;
export function invoke<Value>(callback: Callback<Value>, value: Value): Value { return callback(value); }
export function apply(callback: Renamed, value: number): number { return callback(value); }
export function choose(callback: Numeric | undefined, value: number): number {
  if (callback === undefined) return value;
  return callback(value);
}
export function alternative(callback: string | Numeric, value: number): number {
  if (typeof callback === "function") return callback(value);
  return value;
}
export class Holder {
  callback: Numeric;
  constructor(callback: Numeric) { this.callback = callback; }
  evaluate(value: number): number { return this.callback(value); }
}
export type Control = string | Error | null | undefined;
export type Next = (value?: Control) => void;
export interface Nested { (next: Next): number; }
export function nested(handler: Nested, next: Next): number { return handler(next); }
`,
  "index.ts": `
import { apply, invoke, choose, alternative, Holder, nested } from "./callbacks.js";
import type { Numeric, Merged } from "./callbacks.js";
function create(offset: number): Numeric { return value => value + offset; }
export function run(): boolean {
  const callback = create(3);
  const merged: Merged = value => value * 2;
  const holder = new Holder(callback);
  let calls = 0;
  const nestedResult = nested(next => { next("route"); next(); return 5; }, value => { calls++; });
  return apply(callback, 4) === 7 && invoke(callback, 5) === 8 &&
    invoke((value: string): string => value, "text") === "text" &&
    choose(callback, 6) === 9 && choose(undefined, 6) === 6 &&
    alternative(callback, 7) === 10 && alternative("other", 7) === 7 &&
    merged(4) === 8 && holder.evaluate(8) === 11 && nestedResult === 5 && calls === 2;
}
`,
};

export const nonErasedCallableInterfaces = [
  "interface Callback { (value: number): number; tag: string; }",
  "interface Callback { (value: number): number; } interface Callback { tag: string; }",
  "interface Callback { (value: number): number; (value: string): string; }",
  "interface Callback { (value: number): number; new (): object; }",
];

export const asyncCallableInterfaceFiles = {
  "callbacks.ts": `
export interface AsyncCallback<Value> { (value: Value): Promise<Value>; }
export interface Handler { (): void | Promise<void>; }
export interface OptionalValue { (): Promise<number> | undefined; }
export interface AbsentValue { (): Promise<null | undefined>; }
export async function invoke<Value>(callback: AsyncCallback<Value>, value: Value): Promise<Value> {
  return await callback(value);
}
export async function settle(handler: Handler): Promise<void> {
  const result = handler();
  if (result !== undefined) await result;
}
export async function selected(handler: OptionalValue): Promise<number> {
  const result = handler();
  if (result !== undefined) return await result;
  return 0;
}
export async function isAbsent(handler: AbsentValue): Promise<boolean> {
  const value = await handler();
  const isNull = value === null;
  const isUndefined = value === undefined;
  return isNull && isUndefined;
}
`,
  "index.ts": `
import { invoke, settle, selected, isAbsent } from "./callbacks.js";
import type { AsyncCallback } from "./callbacks.js";
export async function run(): Promise<boolean> {
  const callback: AsyncCallback<number> = async value => value + 3;
  await settle(() => {});
  await settle(async () => {});
  await settle(async () => { return undefined; });
  await settle(async (): Promise<void> => { return undefined; });
  let calls = 0;
  await settle(async () => { calls++; });
  const firstCount = calls;
  const present = await selected(async () => { calls++; return 11; });
  const absent = await selected(() => undefined);
  return firstCount === 1 && calls === 2 && present === 11 && absent === 0 &&
    await invoke(callback, 4) === 7 && await isAbsent(async () => null) && await isAbsent(async () => undefined);
}
`,
};

export const nativeAsyncCallableFiles = {
  "callbacks.ts": `
export interface Callback { (value: number): Promise<number>; }
export interface OptionalCallback { (): Promise<number> | undefined; }
export interface Handler { (): void | Promise<void>; }
export interface Absent { (): Promise<null | undefined>; }
export async function invoke(callback: Callback, value: number): Promise<number> { return await callback(value); }
export async function selected(callback: OptionalCallback): Promise<number> {
  const result = callback();
  if (result !== undefined) return await result;
  return 0;
}
export async function settle(callback: Handler): Promise<void> {
  const result = callback();
  if (result !== undefined) await result;
}
export async function absent(callback: Absent): Promise<boolean> {
  const result = await callback();
  return result === null && result === undefined;
}
`,
  "index.ts": `
import { invoke, selected, settle, absent } from "./callbacks.js";
import type { Callback, OptionalCallback } from "./callbacks.js";
function make(offset: number): Callback { return async value => value + offset; }
export async function run(): Promise<boolean> {
  const callback = make(3);
  const alias = callback;
  const first = callback(2);
  if (await first !== 5 || await invoke(alias, 4) !== 7) return false;
  let calls = 0;
  const count = (): number => calls;
  const empty: OptionalCallback = () => { calls++; return undefined; };
  const emptyResult = empty();
  if (count() !== 1 || emptyResult !== undefined) return false;
  if (await selected(empty) !== 0 || count() !== 2) return false;
  const value = await selected(async () => { calls++; return 11; });
  if (value !== 11 || count() !== 3) return false;
  await settle(() => {});
  await settle(async () => {});
  await settle(async () => { calls++; });
  if (count() !== 4 || !await absent(async () => null) || !await absent(async () => undefined)) return false;
  let failed = false;
  try { await selected(() => { throw new Error("invocation"); }); } catch { failed = true; }
  let rejected = false;
  try { await invoke(async value => { throw new Error("awaiting"); }, 1); } catch { rejected = true; }
  return failed && rejected;
}
`,
};

export const inlineNativeAsyncCallableFiles = {
  "index.ts": `
interface Callback { (value: number): Promise<number>; }
async function invoke(callback: Callback, value: number): Promise<number> { return await callback(value); }
function make(offset: number): Callback { return async value => value + offset; }
export async function run(): Promise<boolean> {
  const callback = make(3);
  return await invoke(callback, 4) === 7 && await callback(5) === 8;
}
`,
};
