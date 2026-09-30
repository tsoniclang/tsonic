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
`,
  "index.ts": `
import { invoke, settle, selected } from "./callbacks.js";
import type { AsyncCallback } from "./callbacks.js";
export async function run(): Promise<boolean> {
  const callback: AsyncCallback<number> = async value => value + 3;
  await settle(() => {});
  await settle(async () => {});
  let calls = 0;
  await settle(async () => { calls++; });
  const firstCount = calls;
  const present = await selected(async () => { calls++; return 11; });
  const absent = await selected(() => undefined);
  return firstCount === 1 && calls === 2 && present === 11 && absent === 0 &&
    await invoke(callback, 4) === 7;
}
`,
};
