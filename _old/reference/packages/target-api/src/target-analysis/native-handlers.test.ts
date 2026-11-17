import assert from "node:assert/strict";
import test from "node:test";
import { selectTargetNativeHandler, selectTargetNativePointerOperation } from "./native-handlers.js";

test("one shared root priority preserves every exact selected payload, including rejected data", () => {
  const kinds = ["memory-binding", "explicit-safety", "js-string-conversion", "native-pointer", "typed-location"];
  const selections = kinds.map(kind => Object.freeze({ kind: "rejected", reason: kind }));
  for (let mask = 0; mask < 32; mask += 1) {
    const candidates = selections.map((value, index) => mask & (1 << index) ? value : undefined);
    const chosen = candidates.findIndex(candidate => candidate !== undefined);
    const selected = selectTargetNativeHandler(candidates[0], candidates[1], candidates[2], candidates[3], candidates[4]);
    const label = `candidate mask ${mask}`;
    if (chosen < 0) assert.equal(selected === undefined, true, label);
    else {
      assert.equal(selected?.kind, kinds[chosen], label);
      assert.equal(selected?.selection === selections[chosen], true, label);
      assert.equal(Object.isFrozen(selected), true, label);
    }
  }
});

test("one shared pointer priority retains the chosen native answer without projecting or allocating it", () => {
  const selections = ["raw-location", "layout-query", "raw-address", "raw-identity", "native-pointer"]
    .map(kind => Object.freeze({ kind }));
  for (let mask = 0; mask < 32; mask += 1) {
    const candidates = selections.map((value, index) => mask & (1 << index) ? value : undefined);
    const selected = selectTargetNativePointerOperation(candidates[0], candidates[1], candidates[2], candidates[3], candidates[4]);
    assert.equal(selected === candidates.find(candidate => candidate !== undefined), true, `candidate mask ${mask}`);
  }
});
