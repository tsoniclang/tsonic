import assert from "node:assert/strict";
import { test } from "node:test";
import { snapshotTargetReadonlyMap } from "./readonly-map.js";

test("readonly collection snapshots preserve exact identities without exposing mutation", () => {
  const key = Object.freeze({ name: "source" });
  const value = Object.freeze({ name: "selected" });
  const original = new Map([[key, value]]);
  const selected = snapshotTargetReadonlyMap(original);
  original.clear();
  assert.equal(selected.size, 1, "the entry inventory survives changes to its original mutable map");
  assert.equal(selected.get(key) === value, true, "lookup preserves the exact original key and selected value");
  assert.equal(selected.has({ ...key }), false, "a foreign same-shaped key has no entry");
  assert.equal(Object.isFrozen(selected), true, "the published view is frozen");
  assert.equal("set" in selected || "delete" in selected || "clear" in selected, false, "the view exposes no mutation operation");
  assert.equal([...selected.keys()][0] === key, true, "key iteration preserves identity");
  assert.equal([...selected.values()][0] === value, true, "value iteration preserves identity");
  assert.equal([...selected.entries()][0]![0] === key, true, "entry iteration preserves key identity");
  assert.equal([...selected][0]![1] === value, true, "default iteration preserves value identity");
  const receiver = Object.freeze({ scope: "caller" });
  let callbacks = 0;
  selected.forEach(function (this: typeof receiver, selectedValue, selectedKey, map) {
    assert.equal(this === receiver && selectedValue === value && selectedKey === key && map === selected, true,
      "forEach retains the caller receiver and exposes only the frozen view");
    callbacks++;
  }, receiver);
  assert.equal(callbacks, 1, "forEach visits each original entry exactly once");
});
