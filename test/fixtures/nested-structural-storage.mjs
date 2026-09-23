export const nestedStructuralStorageFiles = Object.freeze({
  "storage.ts": `
declare const stored: unique symbol;
interface Stored<Value> { readonly [stored]: Value; }
type Storage<Value> = Value extends Stored<infer Inner> ? Inner : Value;
export class Buffer<Value, Size extends number | bigint> {
  values: Value[];
  length: Size;
  constructor(values: Value[], length: Size) {
    this.values = values;
    this.length = length;
  }
}
export type MapStorage<Key, Value> = {
  keys: Buffer<Storage<Key>, 1>;
  values: Buffer<Storage<Value>, 1>;
};
`,
  "cache.ts": `
import type { Pointer } from "@tsonic/core/types.js";
import { loadPointer, storePointer } from "@tsonic/core/lang.js";
import type { MapStorage } from "./storage.js";
export class Entry<Value> {
  value: Value;
  constructor(value: Value) { this.value = value; }
}
export type CacheStorage<Key, Value> = {
  entries: MapStorage<Key, Pointer<Entry<Value>> | undefined>;
};
export class Cache<Key, Value> {
  storage: CacheStorage<Key, Value>;
  constructor(storage: CacheStorage<Key, Value>) { this.storage = storage; }
  static from<Key, Value>(storage: CacheStorage<Key, Value>): Cache<Key, Value> {
    return new Cache(storage);
  }
  first(): Pointer<Entry<Value>> | undefined {
    return this.storage.entries.values.values[0];
  }
}
export function read<Value>(entry: Pointer<Entry<Value>> | undefined): Value | undefined {
  if (entry === undefined) return undefined;
  return loadPointer(entry).value;
}
export function write<Value>(entry: Pointer<Entry<Value>> | undefined, value: Value): void {
  if (entry === undefined) return;
  storePointer(entry, new Entry(value));
}
`,
  "index.ts": `
import type { int32, Pointer } from "@tsonic/core/types.js";
import { addressOf } from "@tsonic/core/lang.js";
import { Buffer } from "./storage.js";
import { Cache, Entry, read, write } from "./cache.js";
import type { CacheStorage } from "./cache.js";
export function run(): boolean {
  let numericEntry = new Entry<int32>(7);
  let textEntry = new Entry<string>("first");
  const numericSource: CacheStorage<int32, int32> = { entries: {
    keys: new Buffer<int32, 1>([1 as int32], 1),
    values: new Buffer<Pointer<Entry<int32>> | undefined, 1>([addressOf(numericEntry)], 1),
  } };
  const textSource: CacheStorage<string, string> = { entries: {
    keys: new Buffer<string, 1>(["key"], 1),
    values: new Buffer<Pointer<Entry<string>> | undefined, 1>([addressOf(textEntry)], 1),
  } };
  const numeric = Cache.from<int32, int32>(numericSource);
  const text = Cache.from<string, string>(textSource);
  if (read(numeric.first()) !== 7 || read(text.first()) !== "first") return false;
  write(numeric.first(), 11 as int32);
  write(text.first(), "changed");
  if (numericEntry.value !== 11 || textEntry.value !== "changed") return false;
  if (numeric.storage !== numericSource || text.storage !== textSource) return false;
  if (numeric.storage.entries.values !== numericSource.entries.values) return false;
  numericSource.entries.values.values[0] = undefined;
  write(numeric.first(), 99 as int32);
  return read(numeric.first()) === undefined && numericEntry.value === 11 &&
    numeric.storage.entries.keys.values[0] === 1 && text.storage.entries.keys.values[0] === "key";
}
`,
});

export const invalidNestedStructuralStorageFiles = Object.freeze([
  Object.freeze({ ...nestedStructuralStorageFiles,
    "index.ts": nestedStructuralStorageFiles["index.ts"].replace("[1 as int32]", '["wrong"]'),
  }),
  Object.freeze({ ...nestedStructuralStorageFiles,
    "cache.ts": nestedStructuralStorageFiles["cache.ts"].replace("if (entry === undefined) return undefined;", ""),
  }),
]);
