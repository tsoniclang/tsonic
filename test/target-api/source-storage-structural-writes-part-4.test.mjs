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

for (const [label, declarations] of [
  ["external body", "declare function opaque(value: Reader): void; function forward(owner: Reader) { opaque(owner); }"],
  ["unknown callback", "function forward(owner: Reader, callback: (value: Reader) => void) { callback(owner); }"],
  ["opaque aggregate", "declare function opaque(value: { value: Reader }): void; function forward(owner: Reader) { opaque({ value: owner }); }"],
  ["opaque captured result", "declare function opaque(value: () => Reader): void; function forward(owner: Reader) { opaque(() => owner); }"],
  ["partially known callee", `
    declare function opaque(value: Reader): void;
    function sink(value: Reader) { value.read = () => 3; }
    function forward(owner: Reader, condition: boolean) { const invoke = condition ? sink : opaque; invoke(owner); }
  `],
]){
test(`formal member demand preserves ${label} uncertainty`, () => {
  const current = formalFixture(declarations);
  const selected = current.query("forward");
  assert.equal(selected.kind, "unresolved", `${label}: unknown native/source effects never complete as empty`);
  assert.match(selected.reason, /callee|signature|transport|parameter|captured/u);
});
}

test("ordinary concrete literal writes and closed read-only forwarding do not require a setter contract", () => {
  const current = formalFixture(`
    function inspect(owner: Reader) { return owner.read(); }
    function forward(owner: Reader) {
      const concrete = { read() { return 1; } };
      concrete.read = () => 2;
      return inspect(owner);
    }
  `);
  current.complete("inspect", []);
  current.complete("forward", []);
  assert.equal(current.storage.failureReason() === undefined, true, "concrete slots and genuine closed empty summaries stay supported");
});

test("exporting a constant concrete binding does not turn its field write into a formal alias refusal", () => {
  const current = formalFixture(`
    export const concrete: Reader = { read() { return 1; } };
    function forward(owner: Reader) { concrete.read = () => 2; return owner.read(); }
  `);
  current.complete("forward", []);
  const access = current.nodes.find(node => current.source.ast.is.IsPropertyAccessExpression(node) &&
    current.source.semantics.forNode(node).operations.propertyAccess(node)?.accessMode === "write");
  assert.equal(access !== undefined, true, "the concrete field retains its original write access");
  const selected = current.storage.writeAt(access, current.storage.emptyBindings);
  assert.equal(selected.kind, "resolved", "the exact original write remains published");
  assert.equal(selected.write.reason === undefined, true, "exporting const storage cannot rebind its object identity");
});

test("missing formal/member correspondence remains unresolved after a narrowed receiver write", () => {
  const current = formalFixture(`
    interface Other { value: number; }
    function replace(owner: Reader | Other) { if ("read" in owner) owner.read = () => 3; }
  `);
  const selected = current.query("replace");
  assert.equal(selected.kind, "unresolved", "a narrowed use cannot manufacture an all-input member identity");
  assert.match(selected.reason, /correspondence/u);
});

test("the receiver declaration is not a runtime value parameter", () => {
  const current = formalFixture("function inspect(this: Reader, owner: Reader) { return owner.read(); }");
  current.complete("inspect", []);
  const declaration = current.callable("inspect");
  const receiver = current.source.semantics.forNode(declaration).types.declarationSignatureInfo(declaration)?.thisParameter?.declaration;
  assert.equal(receiver !== undefined, true, "the original checked receiver contract is present");
  assert.equal(current.storage.formalMemberWriteDemand(declaration, receiver).kind, "unresolved",
    "explicit this never shifts or substitutes the canonical runtime parameter vector");
});

test("formal demand identity rejects a different declaration, foreign input and forged node", () => {
  const current = formalFixture("function replace(owner: Reader) { owner.read = () => 3; } function other(owner: Reader) { }");
  const foreign = formalFixture("function replace(owner: Reader) { owner.read = () => 3; }");
  const declaration = current.callable("replace");
  const wrong = current.parameter(current.callable("other"), "owner");
  const foreignParameter = foreign.parameter(foreign.callable("replace"), "owner");
  for (const parameter of [wrong, foreignParameter, Object.freeze({})]) {
    const selected = current.storage.formalMemberWriteDemand(declaration, parameter);
    assert.equal(selected.kind, "unresolved", "only the identical actual implementation input can select a demand");
    assert.match(selected.reason, /identical checked implementation/u);
  }
  assert.equal(current.storage.formalMemberWriteDemand(foreign.callable("replace"), foreignParameter).kind,
    "unresolved", "foreign declarations do not become local summaries by spelling");
});

for (const limits of [{ maximumSteps: 1 }, { maximumTransportRows: 1 }]){
test(`formal write demand keeps finite refusal ${Object.keys(limits)[0]}`, () => {
  const current = formalFixture("function replace(owner: Reader) { owner.read = () => 3; }", {}, limits);
  const selected = current.query("replace");
  assert.equal(selected.kind, "unresolved", "incomplete finite source work never becomes an empty summary");
  assert.match(selected.reason, /budget/u);
});
}

for (const [label, parameter, aliases, receiver] of [
  ["undefined union", "owner: Reader | undefined", "", "owner"],
  ["optional parameter", "owner?: Reader", "", "owner"],
  ["null union", "owner: Reader | null", "", "owner"],
  ["null and undefined union", "owner: Reader | null | undefined", "", "owner"],
  ["undefined default", "owner: Reader | undefined = undefined", "", "owner"],
  ["null default", "owner: Reader | null = null", "", "owner"],
  ["optional const alias", "owner?: Reader", "const alias = owner;", "alias"],
  ["optional stable let alias", "owner?: Reader", "let alias = owner;", "alias"],
]){
test(`formal present-member demand preserves ${label} absence`, () => {
  const current = formalFixture(`function replace(${parameter}) { ${aliases} if (${receiver}) ${receiver}.read = () => 3; }`);
  optionalDemand(current, "replace", [current.member()]);
});
}

test("cross-file generic optional aliases retain the exact present member and raw generic binding", () => {
  const current = formalFixture(`
    import type { Maybe } from "./maybe.js";
    function replace(owner: Maybe<Reader>) { if (owner) owner.read = () => 3; }
  `, { "/project/maybe.ts": "export type Maybe<Value> = Value | null | undefined;" });
  optionalDemand(current, "replace", [current.member()]);
});
