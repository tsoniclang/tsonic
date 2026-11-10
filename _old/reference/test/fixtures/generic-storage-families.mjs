export const independentStorageFamilyFiles = Object.freeze({
  "storage.ts": `
export declare const storageKey: unique symbol;
export interface Stored<Value> { readonly [storageKey]: Value; }
export type Storage<Value> = Value extends Stored<infer Inner> ? Inner : Value;
export declare const containerKey: unique symbol;
export interface ContainerStored<Value> { readonly [containerKey]: Value; }
export type ContainerStorage<Value> = Value extends ContainerStored<infer Inner> ? Inner : Value;
`,
  "nested.ts": `
import type { ContainerStorage, Storage as Selected } from "./storage.js";
export type Local<Value> = Selected<Value>;
export type Pair<Value> = { value: Local<Value>; container: ContainerStorage<Value> };
export function pair<Value>(value: Local<Value>, container: ContainerStorage<Value>): Pair<Value> {
  return { value, container };
}
export function first<Value>(values: Local<Value>[]): Local<Value> { return values[0]; }
`,
  "index.ts": `
import { containerKey, storageKey } from "./storage.js";
import { first, pair } from "./nested.js";
type Left = { count: number };
type Right = { label: string };
class Both {
  declare readonly [storageKey]: Left;
  declare readonly [containerKey]: Right;
}
export function run(): boolean {
  const left = { count: 3 };
  const right = { label: "right" };
  const stored = pair<Both>(left, right);
  stored.value.count = 9;
  stored.container.label = "changed";
  if (left.count !== 9 || right.label !== "changed") return false;
  const values = [left];
  const selected = first<Both>(values);
  selected.count = 12;
  if (stored.value.count !== 12) return false;
  const ordinary = pair<number>(4, 5);
  return ordinary.value === 4 && ordinary.container === 5;
}
`,
});
