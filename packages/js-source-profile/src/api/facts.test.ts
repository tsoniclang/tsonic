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

test("calling Generator.throw is a Host refusal at the call (profile callRefusal, raised in facts.refusals())", async () => {
  const { createCompilerSessionFromFiles } = await import("@tsonic/tsts");
  const { createTargetSourceProgram } = await import("@tsonic/target-api/host");
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
export function* numbers(): Generator<number, void, unknown> { yield 1; }
const iterator = numbers();
iterator.next();
iterator.throw(new Error("stop"));` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const program = createTargetSourceProgram(checked, { profile: createJsSourceApiFacts,
    platform: { kind: "known", nativeIntegerBits: 64, basis: "js-source-profile test" } });
  const refusals = program.facts.refusals().filter(refusal => refusal.code === "TSONIC_GENERATOR_THROW_UNSUPPORTED");
  assert.equal(refusals.length, 1, "only the throw call; next is supported");
  assert.equal(refusals[0]!.message, "Generator throw-in is not supported.");
  assert.equal(program.syntax.text(refusals[0]!.site).startsWith("iterator.throw("), true);
});
