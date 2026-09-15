export const pointerViewFiles = Object.freeze({
  "view.ts": `
import { viewPointer as view } from "@tsonic/core/lang.js";
import type { Pointer } from "@tsonic/core/types.js";
export function direct<T>(source: Pointer<T>, initial: T): Pointer<T> {
  let storage = initial;
  return view(source, () => storage, next => { storage = next; });
}
export function optional<T>(source: Pointer<T> | undefined, initial: T): Pointer<T> | undefined {
  let storage = initial;
  return view(source, () => storage, next => { storage = next; });
}
`,
  "index.ts": `
import { allocatePointer, equalPointer, hashPointer, loadPointer, storePointer, viewPointer } from "@tsonic/core/lang.js";
import { direct, optional } from "./view.js";
export function run(): boolean {
  const base = allocatePointer<number>(1);
  let value = 3;
  let reads = 0;
  const view = viewPointer(base, () => { reads += 1; return value; }, next => { value = next; });
  const before = reads;
  storePointer(view, 7);
  const afterStore = reads;
  const observed = loadPointer(view);
  const absent = optional<number>(undefined, 5);
  const returned = direct(base, 9);
  const other = allocatePointer<number>(1);
  const text = viewPointer<number, string>(base, () => "text", _next => {});
  return before === 0 && afterStore === 0 && value === 7 && observed === 7 &&
    equalPointer(base, view) && hashPointer(base) === hashPointer(view) && loadPointer(base) === 1 &&
    absent === undefined && reads === 1 && loadPointer(returned) === 9 && !equalPointer(other, view) &&
    hashPointer(text) === hashPointer(base) && loadPointer(text) === "text";
}
`,
});
