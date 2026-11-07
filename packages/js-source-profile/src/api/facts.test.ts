// Host fact tests for the JS API profile (D18): member meaning and collection facts, target-neutral.
import assert from "node:assert/strict";
import test from "node:test";
import type { SourceJsApiFactsInput, SourceTypeDescriptor } from "@tsonic/target-api/source";
import { createJsSourceApiFacts } from "./facts.js";
import { jsSourceApiEntry } from "./table.js";

const jsSourceApiMemberMeaning = (declaringName: string, name: string) => jsSourceApiEntry(declaringName, name)?.meaning;
const jsSourceApiConstructionMeaning = (declaringName: string) => jsSourceApiEntry(declaringName, "constructor")?.meaning;

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
    presentArms: type => type.kind === "union" ? type.types : [type],
    typeofCategory: type => type.kind === "string" ? "string" : type.kind === "primitive" ? "bigint" : type.kind === "callable" ? "function" : undefined,
  };
  const facts = createJsSourceApiFacts(input);
  const element: SourceTypeDescriptor = { kind: "string" };
  assert.deepEqual(facts.collection({ kind: "array", readonly: true, element }), { kind: "readonly-array", element });
  assert.deepEqual(facts.collection({ kind: "string" }), { kind: "string" });
  assert.equal(facts.collection({ kind: "intrinsic", intrinsic: "unknown" }), undefined);
});

test("keyCategories: one Host category per present arm of a union key, function and unproven arms as object (Q86)", () => {
  const facts = createJsSourceApiFacts({
    ast: undefined as never, sourceFacts: { getFact: () => undefined } as never, wellKnownSymbol: () => undefined,
    presentArms: type => type.kind === "union" ? type.types : [type],
    typeofCategory: type => type.kind === "string" ? "string" : type.kind === "primitive" ? "bigint" : type.kind === "callable" ? "function" : undefined,
  });
  const key: SourceTypeDescriptor = { kind: "union", types: [{ kind: "primitive", primitive: "int64" }, { kind: "string" },
    { kind: "callable", calls: [], constructs: [] }, { kind: "intrinsic", intrinsic: "unknown" }] };
  assert.deepEqual(facts.keyCategories(key), ["bigint", "string", "object", "object"]);
  assert.equal(facts.keyCategories({ kind: "string" }), undefined);
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

test("one table entry carries every facet of an identity", () => {
  const sort = jsSourceApiEntry("Array", "sort");
  assert.equal(sort?.meaning?.receiver, "mutating");
  assert.deepEqual(sort?.callables?.invocationOnly, [0]);
  assert.equal(jsSourceApiEntry("ObjectConstructor", "freeze")?.storage?.kind, "argument-alias");
  assert.deepEqual(jsSourceApiEntry("ErrorConstructor", "constructor")?.storage,
    { kind: "allocation", binding: "Error", nativeConstructor: true });
  assert.equal(jsSourceApiEntry("Generator", "next")?.callables?.resumeReceiver, true);
  assert.equal(jsSourceApiEntry("Generator", "throw")?.refusal?.code, "TSONIC_GENERATOR_THROW_UNSUPPORTED");
  assert.deepEqual(jsSourceApiEntry("Generator", "throw")?.callables?.entries, [], "throw is a classified operation with no callback");
  assert.deepEqual(jsSourceApiEntry("ObjectConstructor", "isFrozen")?.refusal, { code: "TSONIC_IS_FROZEN_UNSUPPORTED",
    message: "Object.isFrozen has no native equivalent; immutability is a compile-time property. Use readonly declarations instead." });
  assert.equal(jsSourceApiEntry("ObjectConstructor", "isFrozen")?.callables, undefined, "isFrozen has no callback classification");
  assert.equal(jsSourceApiEntry("String", "replace")?.meaning?.parameters[1], "value",
    "replace takes a string in one overload, so its parameter 1 is not a callback in every overload");
  assert.equal(jsSourceApiEntry("JSON", "stringify")?.meaning?.parameters[1], "value");
  assert.equal(jsSourceApiEntry("StringConstructor", "call")?.meaning?.result, "string", "String(x) is a string conversion");
  assert.equal(jsSourceApiEntry("DateConstructor", "call")?.meaning?.result, "string", "Date() returns a string");
});

