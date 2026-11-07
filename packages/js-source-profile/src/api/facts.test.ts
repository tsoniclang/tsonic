// Host fact tests for the JS API profile (D18): member meaning and collection facts, target-neutral.
import assert from "node:assert/strict";
import test from "node:test";
import type { SourceJsApiFactsInput, SourceTypeDescriptor } from "@tsonic/target-api/source";
import { createJsSourceApiFacts } from "./facts.js";
import { jsSourceApiConstructionMeaning, jsSourceApiMemberMeaning } from "./members.js";

test("array members separate the mutating Array view from the readonly view", () => {
  const push = jsSourceApiMemberMeaning("Array", "push");
  assert.deepEqual(push && { receiver: push.receiver, result: push.result, effects: push.effects },
    { receiver: "mutating", result: "number", effects: { invokesCallbacks: false, storesArguments: true } });
  assert.equal(jsSourceApiMemberMeaning("ReadonlyArray", "push"), undefined, "a readonly array has no push");
  assert.equal(jsSourceApiMemberMeaning("ReadonlyArray", "map")?.effects.invokesCallbacks, true);
  assert.equal(jsSourceApiMemberMeaning("Array", "length")?.receiver, "mutating", "Array length is writable");
  assert.equal(jsSourceApiMemberMeaning("ReadonlyArray", "length")?.receiver, "readonly");
});

test("Set, Map and their readonly views publish one meaning per member", () => {
  assert.equal(jsSourceApiMemberMeaning("Set", "add")?.result, "receiver");
  assert.equal(jsSourceApiMemberMeaning("ReadonlySet", "add"), undefined);
  assert.deepEqual(jsSourceApiMemberMeaning("Map", "set")?.parameters, ["key", "value"]);
  assert.equal(jsSourceApiMemberMeaning("ReadonlyMap", "get")?.result, "value");
  assert.equal(jsSourceApiMemberMeaning("Set", "Symbol.iterator")?.result, "iterator");
  assert.equal(jsSourceApiConstructionMeaning("MapConstructor")?.result, "new-collection");
  assert.equal(jsSourceApiConstructionMeaning("PromiseConstructor")?.effects.invokesCallbacks, true);
});

test("collection facts follow the descriptor", () => {
  const input: SourceJsApiFactsInput = {
    ast: undefined as never,
    sourceFacts: { getFact: () => undefined } as never,
    wellKnownSymbol: () => undefined,
  };
  const facts = createJsSourceApiFacts(input);
  const element: SourceTypeDescriptor = { kind: "string" };
  assert.deepEqual(facts.collection({ kind: "array", readonly: true, element }), { kind: "readonly-array", element });
  assert.deepEqual(facts.collection({ kind: "string" }), { kind: "string" });
  assert.equal(facts.collection({ kind: "intrinsic", intrinsic: "unknown" }), undefined);
});
