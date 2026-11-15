import assert from "node:assert/strict";
import { test } from "node:test";
import { dependenciesOf } from "../../packages/host/dist/summaries/index.js";
import { createAccount, accountFailure, refuseAccount } from "../../packages/host/dist/dataflow/index.js";
import { InvocationAccount } from "../../packages/host/dist/dataflow/account.js";
import { encodePackageId, encodeModuleId, encodeDefId, encodeBodyId } from "../../packages/host/dist/ids/index.js";

const module = encodeModuleId({ package: encodePackageId("default-discovery"), path: "main.ts" });
const definition = name => encodeDefId({ module, segments: [{ name, ordinal: 0 }] });
const owner = definition("f");
const body = encodeBodyId({ owner, role: "function", ordinal: 0 });
const bindings = { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } };
const origin = { module, start: 0, length: 0, derived: [] };
const syntax = id => ({ id, parent: 0, origin, flags: [], loc: { pos: 0, end: 0 } });
const account = (maximumWork = 100000, maximumResultEntries = 100000) => createAccount({ maximumWork, maximumResultEntries });

function fixture(provided = 0, count = 1) {
  const params = Array.from({ length: count }, (_, index) => {
    const declaration = definition(`p${index}`);
    const initializer = encodeBodyId({ owner: declaration, role: "initializer", ordinal: 0 });
    const parameter = { ...syntax(10 + index), kind: "Parameter", modifiers: null, dotDotDotToken: null,
      questionToken: null, type: null, tsonic: { declaration, local: { body, local: index }, storage: 0,
        passing: "by-value", initializer, role: "default" } };
    Object.defineProperty(parameter, "name", { get() { assert.fail("Default discovery does not traverse parameter syntax."); } });
    Object.defineProperty(parameter, "initializer", { get() { assert.fail("The separately placed initializer syntax is not this execution's subtree."); } });
    return parameter;
  });
  const signature = { id: 0, declaration: owner, owner: null, composition: null, kind: "call", typeParameters: [], receiver: null,
    parameters: params.map(header => ({ declaration: header.tsonic.declaration, kind: "default", type: 0,
      passing: "by-value", initializer: header.tsonic.initializer, acceptsOmission: true })), result: 0 };
  const instance = { body, bindings };
  const input = { execution: { instance, provided }, tir: { body, owner, bindings, lexicalBindings: bindings.bindings,
    dependence: "parametric", signature: 0, completion: 0, yielded: null, sent: null, params, locals: [], nestedBodies: [],
    root: { ...syntax(0), parent: null, kind: "Block", statements: { loc: { pos: 0, end: 0 }, nodes: [] }, tsonic: null },
    captures: [], scopes: [], evidence: [], asynchronous: false, generator: false } };
  const reads = [];
  const deps = { account: account(), signatureOf: selected => { assert.equal(selected, 0); reads.push("signature"); return signature; },
    callableEntriesAt: () => assert.fail("No callable reference in this body."), calleeAt: () => assert.fail("No surface call in this body."),
    operationEntriesAt: () => assert.fail("No selected operation in this body."), dispatchEntriesAt: () => assert.fail("No dispatch in this body."),
    initializerAt: (at, initializer) => {
      const header = params.find(parameter => parameter.id === at.node);
      assert.equal(at.body, body);
      assert.equal(header !== undefined && header.tsonic.initializer === initializer, true);
      reads.push(at.node);
      return { kind: "body", execution: { instance: { body: initializer, bindings }, provided: 0 } };
    } };
  return { deps, input, signature, reads };
}

test("omitted defaults discover the real selected child at the actual header, supplied values do not", () => {
  for (const provided of [0, 1]) {
    const current = fixture(provided);
    const result = dependenciesOf(current.deps, current.input);
    assert.equal(result.kind, "complete");
    assert.deepEqual(current.reads, provided === 0 ? ["signature", 10] : ["signature"]);
    assert.equal(result.value.dependencies.length, provided === 0 ? 1 : 0);
    if (provided === 0) {
      const edge = result.value.dependencies[0];
      assert.equal(edge.reason, "initializer");
      assert.deepEqual(edge.at, { body, node: 10 });
      assert.equal(edge.target.execution.instance.body, current.input.tir.params[0].tsonic.initializer);
      assert.equal(edge.target.execution.instance.bindings, bindings);
    }
  }
});

test("selected provided count skips only the supplied prefix of actual default formals", () => {
  const current = fixture(1, 2);
  const result = dependenciesOf(current.deps, current.input);
  assert.equal(result.kind, "complete");
  assert.deepEqual(current.reads, ["signature", 11]);
  assert.deepEqual(result.value.dependencies.map(edge => edge.at.node), [11]);
});

test("explicit this is not an ordinary formal and omission without an initializer creates no dependency", () => {
  const current = fixture();
  const parameter = current.input.tir.params[0];
  current.signature.receiver = 0;
  current.input.tir.params.unshift({ ...syntax(9), kind: "Parameter", tsonic: {
    declaration: definition("this"), local: { body, local: 1 }, storage: 0, passing: "by-value", initializer: null, role: "this" } });
  parameter.tsonic.initializer = null;
  parameter.tsonic.role = "required";
  current.signature.parameters[0].initializer = null;
  current.signature.parameters[0].kind = "required";
  const result = dependenciesOf(current.deps, current.input);
  assert.equal(result.kind, "complete");
  assert.deepEqual(current.reads, ["signature"]);
  assert.deepEqual(result.value.dependencies, []);
});

test("default discovery rejects missing or foreign selected initializer associations", () => {
  for (const target of [null, { kind: "declared" }, { kind: "body", execution: { instance: { body, bindings }, provided: 0 } }]) {
    const current = fixture();
    current.deps.initializerAt = () => target;
    assert.throws(() => dependenciesOf(current.deps, current.input), TypeError);
  }
});

test("default discovery retains the real selected signature, header position and omission capability", () => {
  for (const change of ["signature", "declaration", "capability", "sparse-header", "sparse-formal", "missing-header"]) {
    const current = fixture();
    if (change === "signature") current.signature.id = 99;
    if (change === "declaration") current.signature.parameters[0].declaration = definition("other");
    if (change === "capability") current.signature.parameters[0].acceptsOmission = false;
    if (change === "sparse-header") delete current.input.tir.params[0];
    if (change === "sparse-formal") delete current.signature.parameters[0];
    if (change === "missing-header") current.signature.parameters.push(current.signature.parameters[0]);
    assert.throws(() => dependenciesOf(current.deps, current.input), TypeError, change);
  }
});

test("default discovery preserves the selected-signature reader's original refusal before answer or header reads", () => {
  for (const unreadAnswer of [false, true]) {
    const current = fixture();
    const original = { kind: "refused", diagnostics: [] };
    const unread = new Proxy({}, { get() { assert.fail("No signature answer read after its reader refuses."); } });
    let reads = 0;
    current.deps.signatureOf = selected => {
      assert.equal(selected, current.input.tir.signature);
      reads += 1;
      refuseAccount(current.deps.account, original);
      return unreadAnswer ? unread : current.signature;
    };
    Object.defineProperty(current.input.tir.params, 0, { get() { assert.fail("No parameter read after the signature reader refuses."); } });
    Object.defineProperty(current.input.tir, "root", { get() { assert.fail("No body syntax read after the signature reader refuses."); } });
    assert.equal(dependenciesOf(current.deps, current.input), original);
    assert.equal(accountFailure(current.deps.account), original);
    assert.equal(reads, 1);
  }
});

test("header discovery uses the same cumulative account with exact bounds and no reads after refusal", () => {
  const reference = fixture();
  assert.equal(dependenciesOf(reference.deps, reference.input).kind, "complete");
  const { work, entries } = InvocationAccount.stateOf(reference.deps.account);
  const unread = new Proxy({}, { get() { assert.fail("No header, signature or producer read after refusal."); } });
  for (const dimension of ["work", "result-entries"]) {
    const required = dimension === "work" ? work : entries;
    for (let maximum = 0; maximum <= required; maximum += 1) {
      const current = fixture();
      current.deps.account = account(dimension === "work" ? maximum : work, dimension === "result-entries" ? maximum : entries);
      const result = dependenciesOf(current.deps, current.input);
      if (maximum === required) assert.equal(result.kind, "complete");
      else {
        assert.equal(result.kind, "resource-limit");
        assert.equal(result.dimension, dimension);
        assert.equal(result, accountFailure(current.deps.account));
        assert.equal(dependenciesOf({ ...current.deps, signatureOf: unread, initializerAt: unread }, unread), result);
      }
    }
  }
  const stopped = account();
  const original = { kind: "refused", diagnostics: [] };
  refuseAccount(stopped, original);
  assert.equal(dependenciesOf({ ...reference.deps, account: stopped, signatureOf: unread, initializerAt: unread }, unread), original);
});
