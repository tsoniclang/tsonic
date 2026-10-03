import assert from "node:assert/strict";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { borrowedNullishSequencesSource } from "./borrowed-nullish-sequences.mjs";

test("pure Node source consumers retain fresh snapshot, lazy fallback and ordered mixed contributions", async () => {
  const code = stripTypeScriptTypes(borrowedNullishSequencesSource);
  const source = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const authored = ["authored", "second"];
  const native = ["native", "tail"];
  const first = source.choose(authored, native);
  assert.deepEqual(first, authored);
  first[0] = "changed";
  assert.deepEqual(authored, ["authored", "second"]);
  assert.deepEqual(native, ["native", "tail"]);
  assert.deepEqual(source.choose(null, native), native);
  assert.deepEqual(source.choose(undefined, undefined), []);
  assert.deepEqual(source.chooseFromHeaders(undefined, { "x-item": native }, "x-item"), native);
  assert.deepEqual(source.chooseFromHeaders(undefined, {}, "missing"), []);
  assert.deepEqual(source.chooseLazy(authored, native, () => { throw new Error("Eager fallback."); }),
    ["before", "authored", "second", "after"]);
  let calls = 0;
  assert.deepEqual(source.chooseLazy(undefined, null, () => { calls++; return []; }), ["before", "after"]);
  assert.equal(calls, 1);
  assert.equal(source.first(native), "native");
  assert.equal(source.optionalFirst(undefined), undefined);
});
