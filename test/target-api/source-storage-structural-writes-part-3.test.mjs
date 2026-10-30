import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, isSourceCallableBodyBoundary, sourceBindingWriteAtReference, sourceCallableValueParameters } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/graph-queries.js";
import { createSourceStorageFormalMemberWrites } from "../../packages/target-api/dist/target-analysis/source-storage/graph/stored-values.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { fixture, formalFixture, optionalDemand } from './source-storage-structural-writes-fixtures.mjs';

for (const [label, statements] of [
  ["direct", "owner.read = () => 3;"],
  ["constant-indexed", 'owner["read"] = () => 3;'],
  ["same-value", "owner.read = owner.read;"],
  ["const alias", "const alias = owner; alias.read = () => 3;"],
  ["transitive alias", "const first = owner; const alias = first; alias.read = () => 3;"],
  ["stable let", "let alias = owner; alias.read = () => 3;"],
  ["later reassignment", "let alias = owner; alias.read = () => 3; alias = other;"],
  ["captured parameter", "function apply() { owner.read = () => 3; } apply();"],
]){
test(`formal member writes retain ${label} binding and declaration evidence`, () => {
  const current = formalFixture(`function replace(owner: Reader, other: Reader) { ${statements} }`);
  current.complete("replace", [current.member()]);
  current.complete("replace", [], "other");
});
}

for (const [label, declarations] of [
  ["direct forwarding", "function sink(owner: Reader) { owner.read = () => 3; } function forward(owner: Reader) { sink(owner); }"],
  ["recursive forwarding", `
    function sink(owner: Reader, depth: number) { owner.read = () => 3; if (depth > 0) forward(owner, depth - 1); }
    function forward(owner: Reader, depth: number) { if (depth > 0) sink(owner, depth - 1); }
  `],
  ["generic forwarding", `
    function sink<T extends Reader>(owner: T) { owner.read = () => 3; }
    function forward(owner: Reader) { sink(owner); }
  `],
  ["selected overload to implementation", `
    function sink(owner: Reader): void;
    function sink(owner: Reader, count = 0) { owner.read = () => count; }
    function forward(owner: Reader) { sink(owner); }
  `],
  ["defaulted input", "function forward(owner: Reader, fallback: Reader = owner) { fallback.read = () => 3; }"],
]){
test(`formal member demand solves ${label} through exact checked inputs`, () => {
  const current = formalFixture(declarations);
  current.complete("forward", [current.member()]);
});
}

test("same-spelling interface members forward only by their original checked correspondence", () => {
  const current = formalFixture(`
    interface Other { read(): number; }
    function sink(owner: Other) { owner.read = () => 3; }
    function forward(owner: Reader) { sink(owner); }
  `);
  current.complete("sink", [current.member("Other")]);
  current.complete("forward", [current.member()]);
  assert.equal(current.member() !== current.member("Other"), true, "structurally corresponding declarations retain separate identities");
});

test("cross-file forwarding retains the implementation declaration rather than the signature's parameter", () => {
  const current = formalFixture(`
    import { sink } from "./sink.js";
    function forward(owner: Reader) { sink(owner); }
  `, { "/project/sink.ts": `
    interface RemoteReader { read(): number; }
    export function sink(value: RemoteReader): void;
    export function sink(actual: RemoteReader, count = 0) { actual.read = () => count; }
  ` });
  current.complete("forward", [current.member()]);
  const declaration = current.callable("sink");
  const parameter = current.parameter(declaration, "actual");
  const result = current.storage.formalMemberWriteDemand(declaration, parameter);
  assert.equal(result.kind, "complete", "the checked body parameter is the summary's sole input identity");
  assert.equal(result.members.length, 1, "one remote member is required");
});

test("a checked setter forwards its actual value input through the same canonical invocation mapping", () => {
  const current = formalFixture(`
    class Slot { set value(actual: Reader) { actual.read = () => 3; } }
    const slot = new Slot();
    function forward(owner: Reader) { slot.value = owner; }
  `);
  current.complete("forward", [current.member()]);
});
