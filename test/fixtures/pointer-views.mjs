export const pointerViewFiles = Object.freeze({
  "view.ts": `
import { viewptr as view } from "@tsonic/core/lang.js";
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
import { allocateptr, equalptr, hashptr, loadptr, storeptr, viewptr } from "@tsonic/core/lang.js";
import { direct, optional } from "./view.js";
export function run(): boolean {
  const base = allocateptr<number>(1);
  let value = 3;
  let reads = 0;
  const view = viewptr(base, () => { reads += 1; return value; }, next => { value = next; });
  const before = reads;
  storeptr(view, 7);
  const afterStore = reads;
  const observed = loadptr(view);
  const absent = optional<number>(undefined, 5);
  let hashEffects = 0;
  const absentHash = hashptr(absent);
  const undefinedHash = hashptr<number>(undefined);
  const effectfulHash = hashptr<number>(void (hashEffects += 1));
  const returned = direct(base, 9);
  const other = allocateptr<number>(1);
  const text = viewptr<number, string>(base, () => "text", _next => {});
  return before === 0 && afterStore === 0 && value === 7 && observed === 7 &&
    equalptr(base, view) && hashptr(base) === hashptr(view) && loadptr(base) === 1 &&
    absent === undefined && absentHash === 0 && undefinedHash === 0 && effectfulHash === 0 && hashEffects === 1 &&
    reads === 1 && loadptr(returned) === 9 && !equalptr(other, view) &&
    hashptr(text) === hashptr(base) && loadptr(text) === "text";
}
`,
});
