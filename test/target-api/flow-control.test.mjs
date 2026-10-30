import assert from "node:assert/strict";
import test from "node:test";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceDeclarationControlFlow, createSourceControlFlowDomain } from "../../packages/target-api/dist/target-analysis/flow/index.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceFlowCaptureQuery } from "../../packages/target-api/dist/target-analysis/flow/captures.js";
import { checkedSource, namedDeclaration, projectSourceFile } from "../fixtures/source-navigation.mjs";

let caseNumber = 0;
const checkedGlobals = `interface Object {} interface Function {} interface CallableFunction extends Function {}
  interface NewableFunction extends Function {} interface IArguments {} interface Boolean {}
  interface Number {} interface String {} interface RegExp {}
  interface Array<Value> { [index: number]: Value; length: number; }
  interface ReadonlyArray<Value> { readonly [index: number]: Value; readonly length: number; }`;
async function fixture(text, name = "run", limits, globals) {
  const files = { "src/index.ts": text };
  if (globals !== undefined) files["globals.d.ts"] = globals;
  const checked = await checkedSource(`flow-control-${caseNumber++}`, files);
  const source = createTargetSourceProgram(checked);
  const declaration = namedDeclaration(source.ast, projectSourceFile(source, "src/index.ts"), name);
  const selection = createSourceDeclarationControlFlow(source, declaration, { domain: { kind: "source" }, limits });
  assert.equal(selection.kind, "resolved", selection.kind === "unresolved" ? selection.reason : "resolved");
  return { checked, source, ast: source.ast, declaration, graph: selection.graph };
}

function points(current, predicate) { return current.graph.points.filter(point => predicate(point, current.ast)); }
function one(current, predicate) {
  const selected = points(current, predicate);
  assert.equal(selected.length, 1, "one exact flow point");
  return selected[0];
}
function call(current, name) {
  return points(current, (point, ast) => point.operation.kind === "evaluate" && point.source !== undefined &&
    ast.is.IsCallExpression(point.source) && ast.is.IsIdentifier(ast.as.AsCallExpression(point.source).Expression) &&
    ast.text(ast.as.AsCallExpression(point.source).Expression) === name);
}
function reachable(graph, from, to, blocked = new Set(), exceptions = false) {
  const pending = [from];
  const visited = new Set();
  while (pending.length > 0) {
    const id = pending.pop();
    if (blocked.has(id) || visited.has(id)) continue;
    if (id === to) return true;
    visited.add(id);
    for (const edge of graph.points[id].successors) if (exceptions || edge.kind !== "exception") pending.push(edge.to);
  }
  return false;
}

test("yield resumes, injected throws and generator closure all retain their cleanup paths", async () => {
  const current = await fixture(`declare function after(): void; declare function caught(): void; declare function cleanup(): void;
    function* run(value: string): Generator<string, void, unknown> {
      try { try { yield value; after(); } catch { caught(); } } finally { cleanup(); }
    }`);
  const suspension = one(current, point => point.operation.kind === "yield");
  assert.deepEqual(suspension.successors.map(edge => edge.kind).sort(), ["exception", "resume", "return"]);
  const after = call(current, "after")[0];
  const caught = call(current, "caught")[0];
  const cleanups = call(current, "cleanup");
  assert.equal(cleanups.length > 0, true);
  const resume = suspension.successors.find(edge => edge.kind === "resume").to;
  const injectedThrow = suspension.successors.find(edge => edge.kind === "exception").to;
  const close = suspension.successors.find(edge => edge.kind === "return").to;
  assert.equal(reachable(current.graph, resume, after.id), true);
  assert.equal(reachable(current.graph, injectedThrow, caught.id, new Set(), true), true);
  assert.equal(reachable(current.graph, close, after.id, new Set(), true), false);
  assert.equal(reachable(current.graph, close, caught.id, new Set(), true), false);
  for (const start of [resume, injectedThrow, close]) {
    assert.equal(cleanups.some(point => reachable(current.graph, start, point.id, new Set(), true)), true);
  }
});

for (const [name, source] of [
  ["empty", "function* run(): Generator<undefined, void, unknown> { yield; }"],
  ["delegated", "function* run(values: Iterable<string>) { return yield* values; }"],
  ["async", "async function* run(value: string) { yield await Promise.resolve(value); }"],
]) {
  test(`flow accounts for ${name} generator suspension without treating it as an ordinary expression`, async () => {
    const current = await fixture(source);
    const suspension = one(current, point => point.operation.kind === "yield");
    assert.deepEqual(suspension.successors.map(edge => edge.kind).sort(), ["exception", "resume", "return"]);
    assert.equal(current.ast.is.IsYieldExpression(suspension.source), true);
    assert.equal(reachable(current.graph, current.graph.entry, suspension.id), true);
  });
}

test("declaration flow retains one conditional parameter default independently of all four calls", async () => {
  const current = await fixture(`function fallback() { return 7; }
    function run(value: number = fallback()) { return value; }
    function enter(maybe: number | undefined, spread: [number?]) { run(1); run(); run(maybe); run(...spread); }`);
  const storage = createSourceStorageQuery(current.source, current.source.navigation.sourceFiles);
  const invocations = storage.invocations.filter(node => current.source.semantics.forNode(node).operations.call(node)
    ?.sourceSelectedSignatureKind === "resolved" && storage.invocationImplementationsFor(node).kind === "resolved" &&
    storage.invocationImplementationsFor(node).nodes.includes(current.declaration));
  assert.equal(invocations.length, 4);
  const ordered = invocations.sort((left, right) => current.ast.pos(left) - current.ast.pos(right));
  const initializer = current.ast.as.AsParameterDeclaration(current.ast.parameters(current.declaration)[0]).Initializer;
  for (const [index, invocation] of ordered.entries()) {
    const caller = storage.bindingsForLexicalOwner(invocation);
    assert.equal(caller.kind === "resolved", true, caller.kind === "unresolved" ? caller.reason : "exact declaration caller");
    const selected = createSourceDeclarationControlFlow(current.source, current.declaration, { domain: { kind: "source" } });
    assert.equal(selected.kind === "resolved", true, `checked call ${index}: ${selected.kind === "unresolved" ? selected.reason : "checked entry"}`);
    const entries = selected.graph.points.filter(point => point.source === initializer && point.operation.kind === "evaluate");
    assert.equal(entries.length, 1, `conditional default for checked call ${index}`);
    const branch = selected.graph.points.filter(point => point.operation.kind === "branch");
    assert.equal(branch.length, 1, "one declaration-local default choice");
    assert.deepEqual(branch[0].successors.map(edge => edge.kind).sort(), ["default", "present"]);
    const execution = selected.graph.executionRegions.get(entries[0].id);
    assert.equal(execution?.owner === current.declaration && execution.root === initializer && execution.role === "parameter-initializer", true,
      "same original declaration and initializer, no caller binding");
    assert.equal("selection" in execution, false, "declaration evidence is not an activation");
  }
  assert.equal(current.graph.points.some(point => point.source === initializer), true, "unspecialized declaration retains its default path");
});

test("declaration flow rejects removed invocation inputs, foreign roots and unverified regions", async () => {
  const current = await fixture("function fallback() { return 1; } function run(value = fallback()) { return value; } function other() { return 2; } run(3); other();");
  const storage = createSourceStorageQuery(current.source, current.source.navigation.sourceFiles);
  const invocation = storage.invocations.find(node => storage.invocationImplementationsFor(node).kind === "resolved" &&
    storage.invocationImplementationsFor(node).nodes.includes(current.declaration));
  const wrong = storage.invocations.find(node => current.source.ast.is.IsIdentifier(current.source.ast.as.AsCallExpression(node).Expression) &&
    current.source.ast.text(current.source.ast.as.AsCallExpression(node).Expression) === "other");
  const foreign = await fixture("function run(value = 4) { return value; } run();");
  const foreignStorage = createSourceStorageQuery(foreign.source, foreign.source.navigation.sourceFiles);
  const foreignCall = foreignStorage.invocations[0];
  const foreignInitializer = foreign.ast.as.AsParameterDeclaration(foreign.ast.parameters(foreign.declaration)[0]).Initializer;
  for (const context of [{ storage, call: wrong }, { storage: foreignStorage, call: invocation },
    { storage, call: foreignCall }, { storage, call: invocation, initializers: [foreignInitializer] }]) {
    const selected = createSourceDeclarationControlFlow(current.source, current.declaration, { domain: { kind: "source" }, invocation: context });
    assert.equal(selected.kind, "unresolved");
    assert.equal("graph" in selected, false);
  }
  const superseded = createSourceDeclarationControlFlow(current.source, current.declaration, { domain: { kind: "source" }, maximumSteps: 1 });
  assert.equal(superseded.kind, "unresolved", "the superseded flat-limits API is rejected, not silently ignored");
  assert.match(superseded.reason, /explicit limits/u);
  const foreignRoot = createSourceDeclarationControlFlow(current.source, foreign.declaration, { domain: { kind: "source" } });
  assert.equal(foreignRoot.kind === "unresolved" && !("graph" in foreignRoot), true, "foreign original declaration rejected");
  for (const forged of [{ root: foreignInitializer }, { owner: foreign.declaration },
    { region: { owner: current.declaration, root: foreignInitializer, role: "parameter-initializer" } }]) {
    const selected = createSourceDeclarationControlFlow(current.source, current.declaration, { domain: { kind: "source" }, ...forged });
    assert.equal(selected.kind === "unresolved" && !("graph" in selected), true, "unverified caller region cannot become a graph fact");
  }
});

test("flow sequences checked reads and writes and retains exact binding identities", async () => {
  const current = await fixture("function run(input: number) { let value = input; value = value + 1; return value; }");
  const { graph, ast } = current;
  const reads = points(current, point => point.operation.kind === "read" && ast.text(point.source) === "value");
  assert.equal(reads.length, 2);
  assert.equal(reads[0].operation.binding === reads[1].operation.binding, true);
  const ordered = [...reads].sort((left, right) => ast.pos(left.source) - ast.pos(right.source));
  assert.equal(reachable(graph, ordered[0].id, ordered[1].id), true);
  for (const point of graph.points) {
    assert.equal(Object.isFrozen(point) && Object.isFrozen(point.successors) && Object.isFrozen(point.predecessors), true);
    for (const edge of point.successors) {
      assert.equal(edge.from, point.id);
      assert.equal(graph.points[edge.to].predecessors.includes(edge), true);
    }
  }
});

test("flow if branches join without executing the other branch", async () => {
  const current = await fixture("function left() {} function right() {} function done() {} function run(flag: boolean) { if (flag) left(); else right(); done(); }");
  const branch = one(current, (point, ast) => point.operation.kind === "branch" && ast.is.IsIfStatement(point.source));
  const left = call(current, "left")[0];
  const right = call(current, "right")[0];
  const done = call(current, "done")[0];
  assert.equal(reachable(current.graph, branch.successors.find(edge => edge.kind === "true").to, left.id), true);
  assert.equal(reachable(current.graph, left.id, right.id), false);
  assert.equal(reachable(current.graph, left.id, done.id) && reachable(current.graph, right.id, done.id), true);
});

test("flow switch tests follow source order, skip default until no match and preserve fallthrough", async () => {
  const current = await fixture(`function first() { return 1; } function second() { return 2; }
    function hit() {} function fallback() {} function tail() {}
    function run(value: number) { switch (value) { case first(): hit(); default: fallback(); break; case second(): tail(); } }`);
  const first = call(current, "first")[0];
  const second = call(current, "second")[0];
  const hit = call(current, "hit")[0];
  const fallback = call(current, "fallback")[0];
  const firstBranch = current.graph.points[first.successors.find(edge => edge.kind === "normal").to];
  assert.equal(firstBranch.successors.some(edge => edge.kind === "case"), true);
  assert.equal(reachable(current.graph, firstBranch.successors.find(edge => edge.kind === "false").to, second.id,
    new Set([fallback.id])), true);
  assert.equal(reachable(current.graph, hit.id, fallback.id), true);
  assert.equal(reachable(current.graph, hit.id, second.id), false);
  assert.equal(points(current, point => point.successors.some(edge => edge.kind === "default")).length, 1);
});

test("flow labelled break and continue preserve exact loop and block destinations", async () => {
  const current = await fixture(`function tick(value: number) { return value + 1; }
    function run(flag: boolean) { let value = 0; outer: for (; flag; value = tick(value)) {
      inner: while (flag) { if (value > 0) continue outer; break inner; } break outer;
    } return value; }`);
  const transfers = points(current, (point, ast) => point.source !== undefined &&
    (ast.is.IsBreakStatement(point.source) || ast.is.IsContinueStatement(point.source)));
  assert.equal(transfers.length, 3);
  const continuing = transfers.find(point => current.ast.is.IsContinueStatement(point.source));
  assert.equal(continuing.successors[0].kind, "continue");
  assert.equal(reachable(current.graph, continuing.successors[0].to, call(current, "tick")[0].id), true);
  const breaks = transfers.filter(point => current.ast.is.IsBreakStatement(point.source));
  assert.equal(breaks.every(point => point.successors[0].kind === "break"), true);
  assert.equal(breaks[0].successors[0].to === breaks[1].successors[0].to, false);
});

test("flow do-while enters its body before testing, for initialization is outside the backedge", async () => {
  const current = await fixture(`function initial() { return 0; } function body() {} function condition() { return false; }
    function run() { let value = initial(); do { body(); value++; } while (condition()); for (let index = initial(); condition(); index++) body(); }`);
  const firstBody = call(current, "body").find(point => current.ast.pos(point.source) < current.ast.pos(call(current, "condition")[1].source));
  const firstCondition = [...call(current, "condition")].sort((left, right) => current.ast.pos(left.source) - current.ast.pos(right.source))[0];
  assert.equal(reachable(current.graph, current.graph.entry, firstBody.id, new Set([firstCondition.id])), true);
  const initializers = call(current, "initial");
  assert.equal(initializers.length, 2);
  for (const initializer of initializers) assert.equal(initializer.successors.filter(edge => edge.kind === "normal").length, 1);
});

test("flow for-of and for-in evaluate the iterable once and write on each successful iteration", async () => {
  const current = await fixture(`function values() { return [1, 2]; } function record() { return { key: 1 }; }
    function run() { for (const item of values()) { if (item) continue; break; } for (const key in record()) { if (key) break; } }`);
  assert.equal(call(current, "values").length, 1);
  assert.equal(call(current, "record").length, 1);
  const iterations = points(current, point => point.operation.kind === "iteration");
  assert.equal(iterations.length, 2);
  for (const point of iterations) {
    assert.deepEqual(point.successors.map(edge => edge.kind), ["true", "false", "exception"]);
    const body = current.graph.points[point.successors[0].to];
    assert.equal(body.operation.kind, "write");
  }
});

test("flow for-await represents awaited iterator resumption explicitly", async () => {
  const current = await fixture("async function run(values: number[]) { for await (const item of values) { if (item) break; } }");
  const awaiting = one(current, point => point.operation.kind === "await");
  assert.equal(awaiting.successors.some(edge => edge.kind === "resume"), true);
  const resumed = current.graph.points[awaiting.successors.find(edge => edge.kind === "resume").to];
  assert.equal(resumed.operation.kind, "iteration");
});

test("flow try/catch routes checked call exceptions through the catch binding before finally", async () => {
  const current = await fixture(`function fail() {} function handled(error: unknown) {} function cleanup() {}
    function run() { try { fail(); } catch (error) { handled(error); } finally { cleanup(); } }`);
  const invocation = call(current, "fail")[0];
  const handler = one(current, point => point.operation.kind === "catch");
  assert.equal(invocation.successors.find(edge => edge.kind === "exception").to, handler.id);
  assert.equal(current.graph.points[handler.successors[0].to].operation.kind, "write");
  assert.equal(reachable(current.graph, handler.id, call(current, "handled")[0].id), true);
  for (const cleanup of call(current, "cleanup")) assert.equal(reachable(current.graph, cleanup.id, handler.id), false);
});

test("flow finally preserves return completion instead of merging it with normal continuation", async () => {
  const current = await fixture(`function cleanup() {} function after() {}
    function run(flag: boolean) { try { if (flag) return 1; } finally { cleanup(); } after(); return 2; }`);
  const returns = points(current, (point, ast) => point.operation.kind === "return" && ast.is.IsReturnStatement(point.source));
  const early = returns.find(point => current.ast.pos(point.source) < current.ast.pos(call(current, "after")[0].source));
  const route = early.successors[0].to;
  assert.equal(reachable(current.graph, route, current.graph.exit), true);
  assert.equal(reachable(current.graph, route, call(current, "after")[0].id), false);
  assert.equal(reachable(current.graph, current.graph.entry, call(current, "after")[0].id), true);
});

test("flow writes and the canonical store retain identical original nested default and iterator inputs", async () => {
  const current = await fixture(`
    function run(source: { nested?: { value?: object } }, outer: { value?: object },
    fallback: object, rows: [object?][]) {
    let { nested: { value = fallback } = outer } = source;
    ({ nested: { value = fallback } = outer } = source);
    for (const [iterated = fallback] of rows) void iterated;
    for ([value = fallback] of rows) void value;
    return value;
  }`, "run", undefined, checkedGlobals);
  assert.equal(current.checked.diagnostics.length === 0, true, "the complete original array and tuple source is checked");
  const storage = createSourceStorageQuery(current.source, current.source.sourceFiles);
  const writes = current.graph.points.filter(point => point.operation.kind === "write" &&
    point.operation.value !== undefined && ["value", "iterated"].includes(current.ast.text(current.ast.name(point.operation.binding))));
  assert.equal(writes.length, 10, "every original incoming/default/iteration branch has its own exact checked write event");
  for (const point of writes) {
    const operation = point.operation;
    const selected = storage.writeAt(operation.reference, storage.emptyBindings);
    assert.equal(selected.kind === "resolved" && selected.write.reason === undefined, true,
      "the actual CFG occurrence has complete canonical source-storage evidence");
    assert.equal(selected.write.values.some(value => value.source.kind === operation.value.kind &&
      value.source.expression === operation.value.expression && value.source.projection.length === operation.value.projection.length &&
      value.source.projection.every((part, index) => part === operation.value.projection[index])), true,
    "the source store and the same CFG consume identical original expression and full projection, not RHS-node coincidence");
  }
});

test("nested default patterns share identical continuations and retain bounded construction", async () => {
  for (const depth of [4, 8, 16]) {
    let type = "{ value?: number }";
    let pattern = "{ value = 0 }";
    for (let index = 0; index < depth; index += 1) {
      type = `{ child?: ${type} }`;
      pattern = `{ child: ${pattern} = {} }`;
    }
    const current = await fixture(`function run(input: ${type}) { const ${pattern} = input; return value; }`, "run",
      { maximumSteps: 12000, maximumPoints: 2500, maximumEdges: 5000 }, checkedGlobals);
    assert.equal(current.checked.diagnostics.length === 0, true, "the nested optional defaults are ordinary checked source");
    const writes = current.graph.points.filter(point => point.operation.kind === "write" &&
      current.ast.text(current.ast.name(point.operation.binding)) === "value");
    assert.equal(writes.length, depth + 2, "one checked event for each distinct input and one shared terminal default");
    assert.equal(current.graph.points.length < 8 * (depth + 2) ** 2, true,
      "nested defaults cannot multiply the same continuation exponentially");
  }
});

test("flow return and throw in finally replace the original completion", async () => {
  for (const completion of ["return 2;", "throw 2;"]) {
    const current = await fixture(`function run() { try { return 1; } finally { ${completion} } }`);
    const original = points(current, point => point.operation.kind === "return")
      .sort((left, right) => current.ast.pos(left.source) - current.ast.pos(right.source))[0];
    const expected = completion.startsWith("return") ? current.graph.exit : current.graph.exceptionExit;
    const excluded = completion.startsWith("return") ? current.graph.exceptionExit : current.graph.exit;
    assert.equal(reachable(current.graph, original.id, expected, new Set(), true), true);
    assert.equal(reachable(current.graph, original.id, excluded, new Set(), true), false);
  }
});

test("flow labelled transfers execute nested finally bodies in order", async () => {
  const current = await fixture(`function inner() {} function outer() {} function run(flag: boolean) {
    target: while (flag) { try { try { break target; } finally { inner(); } } finally { outer(); } }
  }`);
  const transfer = one(current, (point, ast) => point.source !== undefined && ast.is.IsBreakStatement(point.source));
  const inner = call(current, "inner").find(point => reachable(current.graph, transfer.id, point.id));
  const outer = call(current, "outer").find(point => reachable(current.graph, inner.id, point.id));
  assert.equal(inner !== undefined && outer !== undefined, true);
  assert.equal(reachable(current.graph, transfer.id, outer.id, new Set(call(current, "inner").map(point => point.id))), false);
  assert.equal(reachable(current.graph, inner.id, current.graph.exit), true);
});

for (const [operator, selectedKind, skippedKind] of [["&&", "true", "false"], ["||", "false", "true"], ["??", "nullish", "present"]]) {
  test(`flow ${operator} evaluates the right operand only on its selected edge`, async () => {
    const current = await fixture(`function right() { return 1; } function after() {} function run(value: number | undefined) { const result = value ${operator} right(); after(); return result; }`);
    const branch = one(current, point => point.operation.kind === "branch");
    const right = call(current, "right")[0];
    const after = call(current, "after")[0];
    assert.equal(reachable(current.graph, branch.successors.find(edge => edge.kind === selectedKind).to, right.id), true);
    assert.equal(reachable(current.graph, branch.successors.find(edge => edge.kind === skippedKind).to, after.id), true);
    assert.equal(reachable(current.graph, branch.successors.find(edge => edge.kind === skippedKind).to, right.id), false);
  });
}

test("flow logical assignments retain one receiver/index evaluation and conditional write", async () => {
  const current = await fixture(`function object() { return [1]; } function index() { return 0; } function right() { return 2; }
    function run() { object()[index()] ||= right(); }`);
  assert.equal(call(current, "object").length, 1);
  assert.equal(call(current, "index").length, 1);
  const branch = one(current, point => point.operation.kind === "branch");
  assert.equal(reachable(current.graph, branch.successors.find(edge => edge.kind === "false").to, call(current, "right")[0].id), true);
  assert.equal(reachable(current.graph, branch.successors.find(edge => edge.kind === "true").to, call(current, "right")[0].id), false);
});

test("flow optional chains skip all remaining property, index and argument evaluations", async () => {
  const current = await fixture(`function index() { return 0; } function argument() { return 1; } function after() {}
    function run(value: { list: { call(value: number): number }[] } | undefined) { value?.list[index()].call(argument()); after(); }`);
  const branch = one(current, point => point.operation.kind === "branch");
  const skipped = branch.successors.find(edge => edge.kind === "nullish").to;
  assert.equal(reachable(current.graph, skipped, call(current, "index")[0].id), false);
  assert.equal(reachable(current.graph, skipped, call(current, "argument")[0].id), false);
  assert.equal(reachable(current.graph, skipped, call(current, "after")[0].id), true);
});

test("flow optional call skips arguments, while parentheses end chain short-circuiting", async () => {
  const optional = await fixture("function argument() { return 1; } function run(value?: (input: number) => number) { return value?.(argument()); }");
  const branch = one(optional, point => point.operation.kind === "branch");
  assert.equal(reachable(optional.graph, branch.successors.find(edge => edge.kind === "nullish").to, call(optional, "argument")[0].id), false);
  const grouped = await fixture("function run(value: { item: { count: number } } | undefined) { return (value?.item)!.count; }");
  const groupedBranch = one(grouped, point => point.operation.kind === "branch");
  const access = one(grouped, (point, ast) => point.operation.kind === "evaluate" && point.source !== undefined &&
    ast.is.IsPropertyAccessExpression(point.source) && ast.text(ast.name(point.source)) === "count");
  assert.equal(reachable(grouped.graph, groupedBranch.successors.find(edge => edge.kind === "nullish").to, access.id), true);
});

test("flow await evaluates its operand before resumption and preserves rejection edges", async () => {
  const current = await fixture("async function input() { return 1; } function after() {} async function run() { const value = await input(); after(); return value; }");
  const awaiting = one(current, point => point.operation.kind === "await");
  assert.equal(reachable(current.graph, call(current, "input")[0].id, awaiting.id), true);
  assert.deepEqual(awaiting.successors.map(edge => edge.kind), ["resume", "exception"]);
  assert.equal(reachable(current.graph, awaiting.successors[0].to, call(current, "after")[0].id), true);
  assert.equal(awaiting.successors[1].to, current.graph.exceptionExit);
});

test("flow closure creation captures checked bindings without running its nested body", async () => {
  const current = await fixture("function nested() {} function run(value: number) { const read = () => { nested(); return value; }; return read; }");
  assert.equal(call(current, "nested").length, 0);
  const capture = one(current, point => point.operation.kind === "capture");
  assert.equal(current.ast.text(current.ast.name(capture.operation.binding)), "value");
});

test("flow source identity excludes a callable from another checked program", async () => {
  const left = await fixture("function run() { return 1; }");
  const right = await fixture("function run() { return 2; }");
  const selection = createSourceDeclarationControlFlow(left.source, right.declaration, { domain: { kind: "source" } });
  assert.equal(selection.kind, "unresolved");
  assert.match(selection.reason, /exact checked source/u);
});

test("flow unsupported syntax and finite construction budgets fail closed without publishing partial graphs", async () => {
  const current = await fixture("function run(value: number) { return value + 1; }");
  for (const limits of [{ maximumSteps: 1 }, { maximumPoints: 1 }, { maximumEdges: 1 }, { maximumDepth: 1 }, { maximumSteps: Infinity }]) {
    const selection = createSourceDeclarationControlFlow(current.source, current.declaration, { domain: { kind: "source" }, limits });
    assert.equal(selection.kind, "unresolved");
    assert.equal("graph" in selection, false);
    assert.match(selection.reason, /finite/u);
  }
  const checked = createTargetSourceProgram(await checkedSource("flow-unsupported-import", {
    "src/index.ts": "function run() { return import('./value.js'); }",
    "src/value.ts": "export const value = 1;",
  }));
  const selection = createSourceDeclarationControlFlow(checked, namedDeclaration(checked.ast, projectSourceFile(checked, "src/index.ts"), "run"), { domain: { kind: "source" } });
  assert.equal(selection.kind, "unresolved");
  assert.equal("graph" in selection, false);
  assert.match(selection.reason, /KindImportKeyword/u);
});

test("flow call arguments, array elements and computed object keys preserve left-to-right order", async () => {
  const current = await fixture(`function first() { return "key"; } function second() { return 2; }
    function third() { return 3; } function consume(...values: unknown[]) {}
    function run() { consume({ [first()]: second() }, [third()]); }`);
  const first = call(current, "first")[0];
  const second = call(current, "second")[0];
  const third = call(current, "third")[0];
  const consume = call(current, "consume")[0];
  assert.equal(reachable(current.graph, first.id, second.id) && reachable(current.graph, second.id, third.id), true);
  assert.equal(reachable(current.graph, third.id, consume.id), true);
  assert.equal(reachable(current.graph, second.id, first.id), false);
});

test("flow destructuring evaluates RHS then computed key then extraction then target reference", async () => {
  const current = await fixture(`function input() { return { key: 1 }; } function key() { return "key"; }
    function target() { return { value: 0 }; } function run() { ({ [key()]: target().value } = input()); }`);
  const input = call(current, "input")[0];
  const key = call(current, "key")[0];
  const target = call(current, "target")[0];
  const extraction = one(current, (point, ast) => point.operation.kind === "evaluate" && point.source !== undefined &&
    ast.is.IsPropertyAssignment(point.source));
  assert.equal(reachable(current.graph, input.id, key.id) && reachable(current.graph, key.id, extraction.id), true);
  assert.equal(reachable(current.graph, extraction.id, target.id), true);
  assert.equal(reachable(current.graph, extraction.id, key.id), false);
});

test("flow default parameter and binding initializers remain conditional", async () => {
  const current = await fixture("function fallback() { return 1; } function run(value = fallback(), input: number[] = []) { const [item = fallback()] = input; return value + item; }");
  const branches = points(current, point => point.operation.kind === "branch");
  assert.equal(branches.length, 3);
  for (const branch of branches) {
    assert.deepEqual(branch.successors.map(edge => edge.kind), ["default", "present"]);
    assert.equal(branch.successors[0].to === branch.successors[1].to, false);
  }
});

test("flow does not create an ordinary value binding for the checked this parameter", async () => {
  const current = await fixture("function run(this: { count: number }, value: number) { return this.count + value; }");
  const receiver = current.source.semantics.forFile(projectSourceFile(current.source, "src/index.ts"))
    .types.declarationSignatureInfo(current.declaration).thisParameter.declaration;
  assert.equal(receiver !== undefined, true);
  assert.equal(current.graph.bindings.has(receiver), false);
  assert.equal(points(current, point => point.operation.kind === "write").length, 1);
});

test("flow constructor, method and expression-bodied arrow bodies stay separate graphs", async () => {
  const source = createTargetSourceProgram(await checkedSource("flow-callable-bodies", { "src/index.ts": `
    class Box { constructor(public count: number) { this.count = count; } read() { return this.count; } }
    const arrow = (value: number) => value + 1;
  ` }));
  const pending = [projectSourceFile(source, "src/index.ts")];
  const declarations = [];
  while (pending.length > 0) {
    const node = pending.pop();
    if (source.ast.is.IsConstructorDeclaration(node) || source.ast.is.IsMethodDeclaration(node) || source.ast.is.IsArrowFunction(node)) declarations.push(node);
    for (const child of source.ast.children(node)) if (child !== undefined) pending.push(child);
  }
  assert.equal(declarations.length, 3);
  for (const declaration of declarations) {
    const result = createSourceDeclarationControlFlow(source, declaration, { domain: { kind: "source" } });
    assert.equal(result.kind, "resolved", result.kind === "unresolved" ? result.reason : "resolved");
    assert.equal(result.graph.declaration === declaration, true);
    assert.equal(result.graph.points.filter(point => point.operation.kind === "entry").length, 1);
  }
});

test("flow deletion evaluates a reference without invoking the deleted property getter", async () => {
  const current = await fixture("function index() { return 'count'; } function run(value?: { count?: number }) { delete value?.[index()]; }");
  const branch = one(current, point => point.operation.kind === "branch");
  assert.equal(reachable(current.graph, branch.successors.find(edge => edge.kind === "nullish").to, call(current, "index")[0].id), false);
  assert.equal(points(current, (point, ast) => point.operation.kind === "evaluate" && point.source !== undefined && ast.is.IsElementAccessExpression(point.source)).length, 0);
  assert.equal(points(current, (point, ast) => point.operation.kind === "evaluate" && point.source !== undefined && ast.is.IsDeleteExpression(point.source)).length, 1);
});

test("flow tagged templates evaluate substitutions without ordinary template coercion", async () => {
  const current = await fixture("function input() { return 1; } function tag(parts: TemplateStringsArray, value: number) { return value; } function run() { return tag`value ${input()}`; }");
  const invoke = one(current, (point, ast) => point.operation.kind === "evaluate" && point.source !== undefined && ast.is.IsTaggedTemplateExpression(point.source));
  assert.equal(reachable(current.graph, call(current, "input")[0].id, invoke.id), true);
  assert.equal(points(current, (point, ast) => point.operation.kind === "evaluate" && point.source !== undefined && ast.is.IsTemplateExpression(point.source)).length, 0);
});

test("flow non-null assertions preserve an optional chain but parentheses still end it", async () => {
  for (const [expression, skipped] of [["value?.item!.call(argument())", true], ["(value?.item)!.call(argument())", false]]) {
    const current = await fixture(`function argument() { return 1; }
      function run(value?: { item?: { call(input: number): number } }) { return ${expression}; }`);
    const branch = one(current, point => point.operation.kind === "branch");
    const skippedEntry = branch.successors.find(edge => edge.kind === "nullish").to;
    assert.equal(reachable(current.graph, skippedEntry, call(current, "argument")[0].id), !skipped, expression);
  }
});

test("flow class captures use canonical evaluation roots rather than eager static or computed evaluation", async () => {
  for (const [member, count] of [["static field = value;", 0], ["[value]() {}", 0], ["field = value;", 1], ["read() { return value; }", 1]]) {
    const current = await fixture(`function run(value: number) { class Entry { ${member} } return Entry; }`);
    assert.equal(points(current, point => point.operation.kind === "capture").length, count, member);
  }
});

test("flow closures created in eager class initialization do not become class-environment captures", async () => {
  for (const member of ["static field = () => value;", "[(() => value)()]() {}"]) {
    const current = await fixture(`function run(value: number) { class Entry { ${member} } return Entry; }`);
    const captures = points(current, point => point.operation.kind === "capture");
    assert.equal(captures.length, 1, member);
    assert.equal(current.ast.is.IsArrowFunction(captures[0].source), true, member);
  }
});

test("flow closure capture facts are computed once per exact checked scope", async () => {
  const current = await fixture("function run(value: number) { class Entry { read() { return value; } } return Entry; }");
  const declaration = one(current, (point, ast) => point.operation.kind === "write" && ast.is.IsClassDeclaration(point.source)).source;
  let steps = 0;
  const query = createSourceFlowCaptureQuery(current.source, () => { steps += 1; }, "source");
  const first = query(declaration);
  const beforeRepeat = steps;
  const repeated = query(declaration);
  assert.equal(first === repeated, true);
  assert.equal(steps - beforeRepeat, 1, "completed reads charge work without recomputing source facts");
  assert.equal(first.length, 1);
  assert.equal(Object.isFrozen(first) && Object.isFrozen(first[0]) && Object.isFrozen(first[0].references), true);
});

test("flow budgets include capture-free closure scanning after syntax preflight", async () => {
  const source = createTargetSourceProgram(await checkedSource(`flow-capture-budget-${caseNumber++}`, {
    "src/index.ts": `export function run() { return () => { ${"0;".repeat(256)} return 0; }; }`,
  }));
  const declaration = namedDeclaration(source.ast, projectSourceFile(source, "src/index.ts"), "run");
  const nodes = new Set();
  const pending = [declaration];
  while (pending.length > 0) {
    const node = pending.pop();
    nodes.add(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const selection = createSourceDeclarationControlFlow(source, declaration, { domain: { kind: "source" }, limits: { maximumSteps: nodes.size + 64 } });
  assert.equal(selection.kind, "unresolved");
  assert.equal("graph" in selection, false, "exhaustion never publishes a partial graph");
  assert.equal(selection.reason, "Source flow exceeds its finite work budget.");
  assert.equal(nodes.has(selection.source), true, "the failure retains the exact checked source subject");
});

test("flow capture queries never cache a partial selection after a work failure", async () => {
  const current = await fixture("function run(value: number) { class Entry { read() { return value; } } return Entry; }");
  const declaration = one(current, (point, ast) => point.operation.kind === "write" && ast.is.IsClassDeclaration(point.source)).source;
  const failure = new Error("test capture budget exhausted");
  let remaining = 2;
  let steps = 0;
  const query = createSourceFlowCaptureQuery(current.source, () => {
    steps += 1;
    remaining -= 1;
    if (remaining < 0) throw failure;
  }, "source");
  assert.throws(() => query(declaration), error => error === failure);
  remaining = 100_000;
  const complete = query(declaration);
  assert.equal(complete.length, 1, "a failed first scan does not cache an empty or incomplete answer");
  assert.equal(Object.isFrozen(complete) && Object.isFrozen(complete[0]) && Object.isFrozen(complete[0].references), true);
  const beforeRepeat = steps;
  assert.equal(query(declaration) === complete, true, "the completed answer is canonical");
  assert.equal(steps - beforeRepeat, 1, "a completed lookup charges entry without rescanning");
});

test("flow refuses the removed implicit source-domain API", async () => {
  const current = await fixture("function run() { return 1; }");
  const selected = createSourceDeclarationControlFlow(current.source, current.declaration);
  assert.equal(selected.kind, "unresolved");
  assert.equal(selected.reason, "Source flow requires explicit limits, checked invocation options and an explicit source domain.");
  assert.equal(selected.source === current.declaration, true, "the refusal identifies the actual requested root");
  assert.equal("graph" in selected, false, "a missing domain cannot publish a partial graph");
});

test("flow selected domains require the original checked factory identity", async () => {
  const current = await fixture("function run() { return 1; }");
  const foreign = await fixture("function run() { return 2; }");
  const inventory = source => {
    const nodes = [];
    const pending = [...source.sourceFiles];
    while (pending.length > 0) {
      const node = pending.pop();
      nodes.push(node);
      for (const child of source.ast.children(node)) if (child !== undefined) pending.push(child);
    }
    return nodes;
  };
  const selected = createSourceControlFlowDomain(current.source, inventory(current.source));
  const other = createSourceControlFlowDomain(foreign.source, inventory(foreign.source));
  assert.equal(selected.kind, "resolved", "the actual checked inventory is admitted by its single owner");
  assert.equal(other.kind, "resolved", "the other program has its own genuine canonical domain");
  const valid = createSourceDeclarationControlFlow(current.source, current.declaration, { domain: selected.domain });
  assert.equal(valid.kind, "resolved", "the factory's original frozen domain remains usable");
  const copied = Object.freeze({ ...selected.domain });
  const reflected = Object.freeze(Object.defineProperties({}, Object.getOwnPropertyDescriptors(selected.domain)));
  for (const [label, domain] of [["frozen copy", copied], ["reflected payload", reflected], ["foreign source", other.domain]]) {
    const result = createSourceDeclarationControlFlow(current.source, current.declaration, { domain });
    assert.equal(result.kind, "unresolved", label);
    assert.equal(result.reason, "Source flow selected domain must come from its original checked inventory boundary.", label);
    assert.equal(result.source === current.declaration, true, label);
    assert.equal("graph" in result, false, label);
  }
});
