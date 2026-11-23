import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeBodyId, encodeDefId, encodeModuleId, encodePackageId } from "../../packages/host/dist/ids/index.js";
import { createAccount, accountFailure, refuseAccount } from "../../packages/host/dist/dataflow/index.js";
import { componentsOf, convergeComponent, dependenciesOf } from "../../packages/host/dist/summaries/index.js";
import { summaryKey } from "../../packages/host/dist/ir-facts/index.js";
import { executionKey } from "../../packages/host/dist/ir-types/index.js";

const module = encodeModuleId({ package: encodePackageId("summaries-unit"), path: "main.ts" });
const definition = encodeDefId({ module, segments: [{ name: "unit", ordinal: 0 }] });
const bindings = { kind: "parametric" };
const execution = { instance: { body: encodeBodyId({ owner: definition, role: "module", ordinal: 0 }), bindings }, provided: 0 };
const key = { kind: "body", execution };
const account = (maximumWork = 100000, maximumResultEntries = 100000) => createAccount({ maximumWork, maximumResultEntries });
const unexpected = () => { throw new Error("This constructed scalar unit has no selected dependency."); };
const node = (kind, id, fields) => ({ kind, id, flags: [], parent: null, loc: { pos: 0, end: 0 }, ...fields });
const readyStatement = node => ({ kind: "ready-statement", node });
const root = statements => node("SourceFile", 0, { statements: { nodes: statements }, endOfFileToken: node("EndOfFile", 1, { tsonic: null }),
  tsonic: { module, template: null } });
const tir = selectedRoot => ({ body: execution.instance.body, bindings, params: [], root: selectedRoot });
const dependencyDeps = current => ({ account: current, signatureOf: unexpected, callableEntriesAt: unexpected, calleeAt: unexpected,
  initializerAt: unexpected, operationEntriesAt: unexpected, dispatchEntriesAt: unexpected });
const refusal = { kind: "refused", diagnostics: [{ code: { kind: "checker", number: 1, rendered: "bound" }, severity: "error",
  site: { kind: "none" }, source: null, evidence: [], message: "bound", arguments: [], related: [], fix: null }] };

test("constructed dependency unit discovers actual offered activation rows and skips its nested execution", () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const selected = { kind: "body", execution: { instance: { ...execution.instance,
    body: encodeBodyId({ owner: definition, role: "function", ordinal: 0 }) }, provided: 2 } };
  const nested = node("Block", 3, {});
  Object.defineProperty(nested, "statements", { get() { assert.fail("The creating body never executes nested function statements."); } });
  const closure = node("FunctionExpression", 2, { modifiers: null, asteriskToken: null, name: null, typeParameters: null,
    parameters: { nodes: [] }, type: null, fullSignature: null,
    body: nested,
    tsonic: { callable: { definition, template: { body: selected.execution.instance.body } } } });
  const statement = node("ExpressionStatement", 4, { expression: closure, tsonic: null });
  const current = account();
  let reads = 0;
  const result = dependenciesOf({ ...dependencyDeps(current), callableEntriesAt: (at, requested) => {
    reads += 1;
    assert.deepEqual(at, { body: execution.instance.body, node: 2 });
    assert.equal(requested, definition);
    return [selected];
  } }, { execution, tir: tir(root([readyStatement(statement)])) });
  assert.equal(result.kind, "complete");
  assert.equal(reads, 1);
  assert.deepEqual(result.value.operations, [key, selected]);
  assert.deepEqual(result.value.dependencies, [{ dependent: execution, at: { body: execution.instance.body, node: 2 }, reason: "activation", target: selected }]);
  const declaration = { ...closure, kind: "FunctionDeclaration",
    tsonic: { definition, parameters: [], signatures: [], template: { body: selected.execution.instance.body } } };
  assert.deepEqual(dependenciesOf(dependencyDeps(account()), { execution, tir: tir(root([{ kind: "ready-callable", node: declaration }])) }),
    { kind: "complete", value: { operations: [key], dependencies: [] } });
});

test("constructed dependency unit preserves original stop before syntax or selected-reader work", () => {
  const current = account();
  const stopped = refuseAccount(current, refusal);
  const input = new Proxy({}, { get() { assert.fail("No syntax read after the original refusal."); } });
  assert.equal(dependenciesOf(dependencyDeps(current), input), stopped);
  const empty = dependenciesOf(dependencyDeps(account()), { execution, tir: tir(root([])) });
  assert.deepEqual(empty, { kind: "complete", value: { operations: [key], dependencies: [] } });
  const under = account(0);
  assert.equal(dependenciesOf(dependencyDeps(under), input), accountFailure(under));
});

test("constructed naming unit distinguishes actual noncallable evidence from a missing selected association", () => {
  const value = node("Identifier", 2, { text: "original", tsonic: { role: "value", resolution: { kind: "definition", definition, aliases: [] } } });
  const statement = node("ExpressionStatement", 3, { expression: value, tsonic: null });
  const input = { execution, tir: tir(root([readyStatement(statement)])) };
  assert.throws(() => dependenciesOf({ ...dependencyDeps(account()), callableEntriesAt: () => null }, input), /complete ready operation/);
  assert.deepEqual(dependenciesOf({ ...dependencyDeps(account()), callableEntriesAt: () => [] }, input),
    { kind: "complete", value: { operations: [key], dependencies: [] } });
});

test("constructed dependency ready readers preserve their original refusal before absence or returned row reads", () => {
  const resolved = { decision: { api: { declaration: definition }, advertised: { declaration: definition } }, activation: execution.instance };
  const application = arguments_ => ({ callee: resolved, arguments: arguments_ });
  const selected = decision => ({ kind: "decided", decision });
  const callable = node("FunctionExpression", 2, { body: node("Block", 3, {}), tsonic: { callable: { definition } } });
  const name = node("Identifier", 2, { tsonic: { role: "value", resolution: { kind: "definition", definition } } });
  const call = arguments_ => node("CallExpression", 2, { tsonic: { application: selected(application(arguments_)) } });
  const operation = node("PrefixUnaryExpression", 2, { tsonic: { role: "value", operation: selected({ decision: { operation: { kind: "core" } } }) } });
  const cases = [
    ["callableEntriesAt", callable], ["callableEntriesAt", name], ["calleeAt", call([])],
    ["initializerAt", node("VariableDeclaration", 2, { tsonic: { initializer: execution.instance.body } })],
    ["initializerAt", call([{ kind: "omitted", value: { kind: "initializer", instance: execution.instance } }])],
    ["operationEntriesAt", operation],
    ["dispatchEntriesAt", node("NewExpression", 2, { tsonic: { application: selected(application([])) } })],
  ];
  for (const [reader, syntax] of cases) for (const absent of [false, true]) {
    const current = account();
    let reads = 0;
    let stopped;
    const unread = new Proxy([], { get() { assert.fail("No returned ready row is read after its reader refuses."); } });
    const deps = { ...dependencyDeps(current), calleeAt: () => key, [reader]: () => {
      reads += 1;
      stopped = refuseAccount(current, refusal);
      return absent ? null : unread;
    } };
    const statements = [readyStatement(syntax)];
    Object.defineProperty(statements, 1, { get() { assert.fail("No later syntax is read after ready-input refusal."); } });
    assert.equal(dependenciesOf(deps, { execution, tir: tir(root(statements)) }), stopped);
    assert.equal(reads, 1, reader);
    assert.equal(accountFailure(current), stopped);
  }
});

test("constructed convergence unit borrows terminal original error result and runs Liveness and round exactly once", () => {
  const current = account();
  const inventory = componentsOf({ account: current, maximumComponentSize: 1, componentRefusal: refusal }, { operations: [key], dependencies: [] }).value;
  const unit = { query: "constructed-body", key: [execution.instance.body, execution.provided] };
  const error = { kind: "error", causes: [{ kind: "unit", unit: { request: { query: "actual-upstream", key: "one" }, position: { kind: "result" } } }] };
  const result = { kind: "ok", value: error, positions: [{ position: { kind: "result" }, error }], diagnostics: [], emissions: [] };
  const liveness = { execution };
  let storageCalls = 0, rounds = 0;
  const mir = { body: execution.instance.body, bindings };
  const typed = tir(root([]));
  const received = convergeComponent({ resources: { account: current, conditionRefusal: refusal }, environment: {}, verification: {},
    analyzeStorageUse: (deps, input) => {
      storageCalls += 1;
      assert.equal(deps.account, current);
      assert.equal(input.execution, execution);
      assert.equal(input.body, mir);
      return { kind: "ok", value: liveness, diagnostics: [] };
    }, analyzeBodyRound: (deps, input) => {
      rounds += 1;
      assert.equal(deps.account, current);
      assert.equal(deps.unit, unit);
      assert.equal(input.liveness, liveness);
      return { kind: "complete", value: result };
    } }, { inventory, component: 0, members: [{ execution, mir, tir: typed, unit }], outside: [], maximumIterations: 1, iterationRefusal: refusal });
  assert.equal(received.kind, "complete");
  assert.equal(storageCalls, 1);
  assert.equal(rounds, 1);
  assert.equal(received.value[0].result, result);
  assert.equal(received.value[0].execution, execution);
});

test("private convergence cannot stabilize a propagated ground whose actual detector disappeared", () => {
  const selected = executionKey(execution);
  const unit = { query: "bodyFactsOf", key: selected };
  const source = node => ({ request: unit, position: { kind: "execution-source-node", execution: selected,
    node: { body: execution.instance.body, node } } });
  const tentative = source(2);
  const final = source(3);
  const sibling = source(4);
  function run(maximumIterations) {
    const current = account();
    const inventory = componentsOf({ account: current, maximumComponentSize: 1, componentRefusal: refusal },
      { operations: [key], dependencies: [{ dependent: execution, at: tentative.position.node, reason: "call", target: key }] });
    assert.equal(inventory.kind, "complete");
    let liveness = 0;
    const offered = [];
    const observed = [];
    const result = convergeComponent({ resources: { account: current, conditionRefusal: refusal }, environment: {}, verification: {},
      analyzeStorageUse: () => {
        liveness += 1;
        return { kind: "ok", value: { execution }, diagnostics: [] };
      }, analyzeBodyRound: deps => {
        const seen = deps.summaryOf(key, summaryKey(key));
        observed.push(seen);
        const position = observed.length === 1 ? tentative : final;
        const lost = observed.length === 2;
        const detectors = lost ? [] : observed.length === 1 ? [position] : [position, sibling];
        const emitted = detectors.map(unit => ({
          identity: { kind: "host", unit, code: "TSONIC_READ_BEFORE_INITIALIZATION" },
          diagnostic: { ...refusal.diagnostics[0], code: { kind: "host", name: "TSONIC_READ_BEFORE_INITIALIZATION",
            rendered: "TSONIC_READ_BEFORE_INITIALIZATION" } },
        }));
        offered.push(emitted);
        const causes = lost ? seen.grounds : observed.length === 4 ? [sibling, position] : detectors;
        const value = { kind: "error", causes: causes.map(unit => ({ kind: "unit", unit })) };
        const positions = emitted.map(row => ({ position: row.identity.unit.position,
          error: { kind: "error", causes: [{ kind: "diagnostic", diagnostic: row.identity }] } }));
        positions.push({ position: { kind: "execution-result", execution: selected }, error: value });
        return { kind: "complete", value: { kind: "ok", value, positions,
          diagnostics: emitted.map(row => row.diagnostic), emissions: emitted } };
      } }, { inventory: inventory.value, component: 0,
      members: [{ execution, mir: { body: execution.instance.body, bindings, entries: [{ provided: 0, block: 0 }] },
        tir: { ...tir(root([])), signature: 0, asynchronous: false, generator: false }, unit }],
      outside: [], maximumIterations, iterationRefusal: refusal });
    assert.equal(liveness, 1);
    return { result, observed, offered, stopped: accountFailure(current) };
  }
  const exact = run(4);
  assert.deepEqual(exact.observed.map(row => row.kind), ["least", "prior-error", "least", "prior-error"]);
  assert.equal(exact.result.kind, "complete");
  const [published] = exact.result.value;
  assert.deepEqual(published.result.value.causes, [{ kind: "unit", unit: final }, { kind: "unit", unit: sibling }]);
  assert.strictEqual(published.result.emissions[0], exact.offered[3][0]);
  assert.strictEqual(published.result.emissions[1], exact.offered[3][1]);
  assert.deepEqual(published.result.positions.map(row => row.position.kind), ["execution-source-node", "execution-source-node", "execution-result"]);
  const stopped = run(3);
  assert.strictEqual(stopped.result, stopped.stopped);
  assert.strictEqual(stopped.result, refusal);
  assert.equal("value" in stopped.result, false);
});

test("constructed convergence unit refuses zero iterations and original enclosing stop without a round", () => {
  const current = account();
  const inventory = componentsOf({ account: current, maximumComponentSize: 1, componentRefusal: refusal }, { operations: [key], dependencies: [] }).value;
  const deps = { resources: { account: current, conditionRefusal: refusal }, environment: {}, verification: {},
    analyzeStorageUse: unexpected, analyzeBodyRound: unexpected };
  const input = { inventory, component: 0, members: [{ execution, mir: { body: execution.instance.body, bindings }, tir: tir(root([])),
    unit: { query: "constructed-body", key: "one" } }], outside: [], maximumIterations: 0, iterationRefusal: refusal };
  assert.equal(convergeComponent(deps, input), refusal);
  assert.equal(convergeComponent(deps, new Proxy({}, { get: unexpected })), refusal);
});
