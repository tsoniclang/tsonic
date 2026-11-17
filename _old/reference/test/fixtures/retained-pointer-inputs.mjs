export const retainedPointerInputSource = `
import { allocateptr, viewptr, loadptr, storeptr } from "@tsonic/core/lang.js";
import type { int32, Pointer } from "@tsonic/core/types.js";
function retained<T>(base: Pointer<T>, read: () => T, write: (value: T) => void): Pointer<T> {
  const get = read;
  const set = write;
  return viewptr(base, get, set);
}
function forwarded<T>(base: Pointer<T>, read: () => T, write: (value: T) => void): Pointer<T> {
  return retained(base, read, write);
}
export function immediate(read: () => int32): int32 { return read(); }
export function run(): boolean {
  const base = allocateptr<int32>(0);
  let value: int32 = 3;
  const pointer = forwarded(base, () => value, next => { value = next; });
  storeptr(pointer, 8);
  return loadptr(pointer) === 8 && immediate(() => 9) === 9;
}
export function main(): void {
  if (!run()) throw new Error("retained callback lost");
}`;

export const reorderedPointerInputSource = retainedPointerInputSource.replace(
  "  const pointer = forwarded(base, () => value, next => { value = next; });",
  "  const pointer = reversed(() => value, next => { value = next; }, base);",
) + `
function reversed<T>(read: () => T, write: (value: T) => void, base: Pointer<T>): Pointer<T> {
  return forwarded(base, read, write);
}`;

export const widePointerInputSource = `
import { allocateptr, viewptr, loadptr, storeptr } from "@tsonic/core/lang.js";
import type { int64, Pointer } from "@tsonic/core/types.js";
function retained<T>(base: Pointer<T>, read: () => T, write: (value: T) => void): Pointer<T> {
  return viewptr(base, read, write);
}
export function run(): boolean {
  const wide: int64 = 9007199254740993n;
  const base = allocateptr<int64>(0n);
  let value: int64 = wide;
  const pointer = retained(base, () => value, next => { value = next; });
  if (loadptr(pointer) !== wide) return false;
  storeptr(pointer, wide + 2n);
  return value === wide + 2n && loadptr(pointer) === value;
}
export function main(): void { if (!run()) throw new Error("wide callback changed"); }
`;

export const incompatiblePointerInputSources = Object.freeze([
  retainedPointerInputSource.replace("() => value, next =>", "(): number => value, next =>"),
  retainedPointerInputSource.replace("() => value, next =>", "() => 3.5, next =>"),
]);
