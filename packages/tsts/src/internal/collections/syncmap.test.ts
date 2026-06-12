import { test } from "node:test";
import assert from "node:assert/strict";
import { SyncMap_Load, SyncMap_LoadOrStore, SyncMap_Range, SyncMap_Store } from "./syncmap.js";
import type { SyncMap } from "./syncmap.js";

test("SyncMap mirrors upstream nil value behavior", () => {
  const map = {} as SyncMap<string, unknown>;

  const [got1, ok1] = SyncMap_Load(map, "foo");
  assert.equal(ok1, false);
  assert.equal(got1, undefined);

  SyncMap_Store(map, "foo", undefined);

  const [got2, ok2] = SyncMap_Load(map, "foo");
  assert.equal(ok2, true);
  assert.equal(got2, undefined);

  const [too, loaded] = SyncMap_LoadOrStore(map, "too", undefined);
  assert.equal(loaded, false);
  assert.equal(too, undefined);

  const ranged: string[] = [];
  SyncMap_Range(map, (key: string, value: unknown): boolean => {
    ranged.push(`${key}:${value === undefined ? "nil" : String(value)}`);
    return true;
  });
  assert.deepEqual(ranged.sort(), ["foo:nil", "too:nil"]);
});
