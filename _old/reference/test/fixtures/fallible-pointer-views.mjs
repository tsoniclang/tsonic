import { sourcePackageGraphFixture } from "./source-package-graph.mjs";

export const falliblePointerFiles = Object.freeze({
  "storage.ts": `
import { bindptr, viewptr, loadptr, storeptr } from "@tsonic/core/lang.js";
import type { Pointer } from "@tsonic/core/types.js";
export class MemoryFailure extends Error {
  code: number;
  constructor(code: number) { super("memory failure"); this.code = code; }
}
export class Storage {
  value: number = 3;
  reads: number = 0;
  writes: number = 0;
  failure: MemoryFailure;
  constructor(failure: MemoryFailure) { this.failure = failure; }
}
export function bound(owner: Storage): Pointer<number> {
  const read = (): number => {
    owner.reads += 1;
    if (owner.value < 0) throw owner.failure;
    return owner.value;
  };
  const write = (value: number): void => {
    owner.writes += 1;
    if (value < 0) throw owner.failure;
    owner.value = value;
  };
  return bindptr(owner, read, write);
}
export function poison(owner: Storage): Pointer<number> {
  return bindptr(owner, (): number => { throw owner.failure; }, (_value: number): void => { throw owner.failure; });
}
export function retained<T>(base: Pointer<T>, read: () => T, write: (value: T) => void): Pointer<T> {
  return viewptr(base, read, write);
}
export function read(pointer: Pointer<number>): number { return loadptr(pointer); }
export function write(pointer: Pointer<number>, value: number): void { storeptr(pointer, value); }
`,
  "index.ts": `
import { equalptr, hashptr, loadptr, storeptr, projectptr, viewptr } from "@tsonic/core/lang.js";
import { bound, poison, retained, read, write, Storage, MemoryFailure } from "./storage.js";
export function run(): boolean {
  const expected = new MemoryFailure(17);
  const owner = new Storage(expected);
  const pointer = bound(owner);
  let caught = 0;
  let projectedReads = 0;
  if (read(pointer) !== 3) return false;
  try { write(pointer, -1); }
  catch (error) { if (error instanceof MemoryFailure && error === expected && error.code === 17) caught += 1; }
  if (owner.value !== 3 || owner.reads !== 1 || owner.writes !== 1) return false;
  owner.value = -1;
  try { read(pointer); }
  catch (error) { if (error instanceof MemoryFailure && error === expected) caught += 1; }
  const projected = projectptr(pointer, value => { projectedReads += 1; return value + 1; }, value => value - 1);
  try { loadptr(projected); }
  catch (error) { if (error instanceof MemoryFailure && error === expected) caught += 1; }
  if (projectedReads !== 0) return false;
  const unreadable = poison(owner);
  const view = retained(unreadable, () => owner.value, next => { owner.value = next; });
  storeptr(view, 9);
  if (loadptr(view) !== 9 || !equalptr(unreadable, view) || hashptr(unreadable) !== hashptr(view)) return false;
  const badProjection = projectptr(view, value => value, (_value: number): number => { throw expected; });
  try { storeptr(badProjection, 11); }
  catch (error) { if (error instanceof MemoryFailure && error === expected) caught += 1; }
  const missing = viewptr<number, number>(undefined, (): number => { throw expected; }, (_value: number): void => { throw expected; });
  const missingProjection = projectptr<number, number>(undefined, (_value: number): number => { throw expected; }, (_value: number): number => { throw expected; });
  return caught === 4 && owner.value === 9 && missing === undefined && missingProjection === undefined;
}
`,
});

export const falliblePointerPackageFiles = Object.freeze({
  "node_modules/@acme/storage/package.json": JSON.stringify({ name: "@acme/storage", version: "1.0.0", type: "module", exports: { ".": "./index.ts" } }),
  "node_modules/@acme/storage/index.ts": falliblePointerFiles["storage.ts"],
  "index.ts": falliblePointerFiles["index.ts"].replace('"./storage.js"', '"@acme/storage"'),
});

export const falliblePointerPackageGraph = sourcePackageGraphFixture(["index.ts"], {
  "@acme/storage": { files: ["index.ts"], dependencies: [] },
});
