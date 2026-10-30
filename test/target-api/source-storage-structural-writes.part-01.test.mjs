import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, isSourceCallableBodyBoundary, sourceBindingWriteAtReference, sourceCallableValueParameters } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageGraphQueries } from "../../packages/target-api/dist/target-analysis/source-storage/graph/graph-queries.js";
import { createSourceStorageFormalMemberWrites } from "../../packages/target-api/dist/target-analysis/source-storage/graph/stored-values.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { fixture, formalFixture, optionalDemand } from './source-storage-structural-writes-fixtures.mjs';

for (const [label, statements] of Array.from([
  ["direct", "owner.read = () => 3;"],
  ["constant-indexed", 'owner["read"] = () => 3;'],
  ["same-value", "owner.read = owner.read;"],
  ["const alias", "const alias = owner; alias.read = () => 3;"],
  ["transitive alias", "const first = owner; const alias = first; alias.read = () => 3;"],
  ["stable let", "let alias = owner; alias.read = () => 3;"],
  ["later reassignment", "let alias = owner; alias.read = () => 3; alias = other;"],
  ["captured parameter", "function apply() { owner.read = () => 3; } apply();"],
]).slice(6, 8)){
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

for (const [label, statements] of [
  ["intervening reassignment", "let alias = owner; alias = other; alias.read = () => 3;"],
  ["branch reassignment", "let alias = owner; if (condition) alias = other; alias.read = () => 3;"],
  ["loop reassignment", "let alias = owner; while (condition) { alias = other; break; } alias.read = () => 3;"],
  ["captured reassignment", "let alias = owner; const change = () => { alias = other; }; change(); alias.read = () => 3;"],
  ["function-scoped var", "var alias = owner; alias.read = () => 3;"],
]){
test(`formal write demand refuses unqualified ${label} instead of manufacturing an empty proof`, () => {
  const current = formalFixture(`function replace(owner: Reader, other: Reader, condition: boolean) { ${statements} }`);
  const selected = current.query("replace");
  assert.equal(selected.kind, "unresolved", `${label}: absence of qualification is not absence of writes`);
  assert.match(selected.reason, /alias|reassign|exposure|const\/let/u);
});
}

test("later parameter initializer effects cannot be ignored when qualifying a body input", () => {
  const current = formalFixture(`
    function replace(owner: Reader, other: Reader, applied: Reader = (owner = other)) { owner.read = () => 3; }
  `);
  assert.equal(current.query("replace").kind, "unresolved", "parameter evaluation precedes the body use and can rebind it");
});

for (const [label, body, input] of [
  ["array-element receiver", "function replace(owners: Reader[]) { owners[0].read = () => 3; }", "owners"],
  ["rest-element receiver", "function replace(...owners: Reader[]) { owners[0].read = () => 3; }", "owners"],
  ["nested member receiver", "function replace(owner: { value: Reader }) { owner.value.read = () => 3; }", "owner"],
  ["call-result receiver", `
    function identity(owner: Reader) { return owner; }
    function replace(owner: Reader) { identity(owner).read = () => 3; }
  `, "owner"],
]){
test(`unsupported shared ${label} exposes the exact source refusal`, () => {
  const current = formalFixture(body);
  const selected = current.query("replace", input);
  assert.equal(selected.kind, "unresolved", `${label}: unqualified receivers do not admit a native writable destination`);
  assert.match(selected.reason, /parameter|alias|element|property|call result/u);
  const access = current.nodes.find(node => current.source.ast.is.IsPropertyAccessExpression(node) &&
    current.source.semantics.forNode(node).operations.propertyAccess(node)?.accessMode === "write");
  assert.equal(access !== undefined, true, `${label}: original source write access`);
  const write = current.storage.writeAt(access, current.storage.emptyBindings);
  assert.equal(write.kind, "resolved", `${label}: the exact original occurrence remains published`);
  assert.equal(typeof write.write.reason === "string", true, `${label}: target admission receives the original source-v1 refusal`);
});
}

for (const [label, declarations] of Array.from([
  ["external body", "declare function opaque(value: Reader): void; function forward(owner: Reader) { opaque(owner); }"],
  ["unknown callback", "function forward(owner: Reader, callback: (value: Reader) => void) { callback(owner); }"],
  ["opaque aggregate", "declare function opaque(value: { value: Reader }): void; function forward(owner: Reader) { opaque({ value: owner }); }"],
  ["opaque captured result", "declare function opaque(value: () => Reader): void; function forward(owner: Reader) { opaque(() => owner); }"],
  ["partially known callee", `
    declare function opaque(value: Reader): void;
    function sink(value: Reader) { value.read = () => 3; }
    function forward(owner: Reader, condition: boolean) { const invoke = condition ? sink : opaque; invoke(owner); }
  `],
]).slice(0, 1)){
test(`formal member demand preserves ${label} uncertainty`, () => {
  const current = formalFixture(declarations);
  const selected = current.query("forward");
  assert.equal(selected.kind, "unresolved", `${label}: unknown native/source effects never complete as empty`);
  assert.match(selected.reason, /callee|signature|transport|parameter|captured/u);
});
}
