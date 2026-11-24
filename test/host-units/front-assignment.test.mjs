import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

async function captured(source = "export function choose(a:boolean,b:boolean=(a=true)):boolean{return a;}") {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const opened = fixture.openAndCapture(fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] }));
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const result = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const definitions = fixture.front.lowerModuleDefinitions({ module: raw,
    componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === module) });
  assert.equal(definitions.kind, "ok");
  const lower = (input = raw) => {
    const types = fixture.types.createTypeInterner();
    const deps = fixture.lowerDepsFor(definitions.value, types, source);
    const exports = fixture.front.lowerModuleExports(deps, input);
    assert.equal(exports.kind, "ok");
    const checked = fixture.front.lowerModule({ ...deps, exportsOf: owner => owner === module ? exports.value : null }, input);
    assert.equal(checked.kind, "ok");
    return { checked: checked.value, types };
  };
  return { fixture, raw, lower, opened, module };
}

async function withStorageReader(opened, reader) {
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(opened.program);
  return OpenedProgram.create({ ...checked, getSourceFileQueries(file) {
    const queries = checked.getSourceFileQueries(file);
    return { ...queries, checker: { ...queries.checker,
      acquireResolvedStorage(node, admit) {
        const actual = queries.checker.acquireResolvedStorage(node, admit);
        return actual.kind === "complete" ? reader(node, actual) : actual;
      } } };
  } }, OpenedProgram.table(opened.program), OpenedProgram.modules(opened.program).modules.map(origin =>
    OpenedProgram.file(opened.program, origin.kind === "snapshot" ? origin.module : origin.document.module)),
  OpenedProgram.libraryData(opened.program), OpenedProgram.contributions(opened.program));
}

test("actual SDK plain assignment storage retains its expression, writable type and qualified captured local", async () => {
  const { fixture, raw, lower } = await captured();
  const callable = raw.tree.statements.nodes[0];
  const assignment = callable.parameters.nodes[1].initializer.expression;
  assert.equal(assignment.kind, "BinaryExpression");
  assert.equal(raw.storage.length, 1);
  const row = raw.storage[0];
  assert.deepEqual(row.node, { module: raw.module, node: assignment.left.id });
  assert.equal(row.fact.kind, "available");
  const selected = row.fact.value;
  assert.deepEqual(selected.expression, row.node);
  assert.deepEqual(selected.storageExpression, row.node);
  assert.deepEqual(selected.declaration, { module: raw.module, node: callable.parameters.nodes[0].id });
  assert.equal(selected.writable, true);
  assert.equal(selected.symbol !== null, true);
  const { checked, types } = lower();
  assert.equal(fixture.verifyChecked(checked, types).length, 0);
  const actual = checked.tree.statements.nodes[0];
  const expression = actual.parameters.nodes[1].initializer.expression;
  assert.equal(expression.tsonic.role, "assignment");
  assert.equal(expression.left.tsonic.role, "assignment-target");
  assert.equal(expression.left.tsonic.access, "write");
  assert.equal("value" in expression.left.tsonic, false);
  assert.deepEqual(expression.left.tsonic.resolution, { kind: "local", local: actual.parameters.nodes[0].tsonic.declaration.local });
  assert.deepEqual(expression.tsonic.target, expression.left.tsonic.place);
  const place = expression.tsonic.target.value;
  assert.deepEqual(place.base, { kind: "root", resolution: expression.left.tsonic.resolution });
  assert.equal(place.step, null);
  assert.equal(place.write.kind, "available");
  const owner = checked.bodies.find(body => body.body === actual.tsonic.body);
  const signature = fixture.types.readSignature(types, actual.tsonic.signatures[0].signature);
  assert.equal(place.write.value, signature.parameters[0].type);
  const initializer = checked.bodies.find(body => body.body === actual.parameters.nodes[1].tsonic.initializer);
  assert.deepEqual(initializer.captures, [{ body: owner.body, local: owner.params[0].local }]);
});

test("plain assignment storage rejects crossed, foreign, duplicate and unused captured associations", async () => {
  const { fixture, raw, lower } = await captured();
  assert.equal(raw.storage.length, 1);
  const row = raw.storage[0];
  assert.equal(row.fact.kind, "available");
  const callable = raw.tree.statements.nodes[0];
  const assignment = callable.parameters.nodes[1].initializer.expression;
  const foreign = fixture.moduleOf(fixture.packageOf("/project"), "src/foreign.ts");
  for (const selected of [
    { ...row.fact.value, expression: { module: raw.module, node: assignment.right.id } },
    { ...row.fact.value, storageExpression: { module: raw.module, node: assignment.right.id } },
    { ...row.fact.value, declaration: { module: raw.module, node: callable.parameters.nodes[1].id } },
    { ...row.fact.value, declaration: { ...row.fact.value.declaration, module: foreign } },
    { ...row.fact.value, symbol: null },
  ]) assert.throws(() => lower({ ...raw, storage: [{ ...row, fact: { kind: "available", value: selected } }] }),
    /actual expression and qualified local or static declaration/u);
  assert.throws(() => lower({ ...raw, storage: [{ ...row, node: { ...row.node, module: foreign } }] }), /actual module and unique syntax order/u);
  assert.throws(() => lower({ ...raw, storage: [row, row] }), /actual module and unique syntax order/u);
  assert.throws(() => lower({ ...raw, storage: [{ node: { module: raw.module, node: raw.tree.id }, fact: { kind: "available", value: null } }, row] }),
    /actual executing expression/u);
  const missing = lower({ ...raw, storage: [] }).checked.tree.statements.nodes[0].parameters.nodes[1].initializer.expression;
  assert.deepEqual(missing.tsonic.target, { kind: "unavailable", reason: "not-provided", causes: [] });
  const unavailable = { kind: "unavailable", reason: "missing-original-component", causes: [] };
  const retained = lower({ ...raw, storage: [{ ...row, fact: unavailable }] }).checked.tree.statements.nodes[0].parameters.nodes[1].initializer.expression;
  assert.equal(retained.left.tsonic.place === unavailable, true);
  const readonly = lower({ ...raw, storage: [{ ...row, fact: { kind: "available", value: { ...row.fact.value, writable: false } } }] })
    .checked.tree.statements.nodes[0].parameters.nodes[1].initializer.expression;
  assert.deepEqual(readonly.left.tsonic.place.value.write, { kind: "available", value: null });
  assert.equal(readonly.left.tsonic.place.value.read.value !== null, true);
});

test("an absent actual storage answer stays unavailable rather than gaining writable storage", async () => {
  const { fixture, opened, module, lower } = await captured();
  let reads = 0;
  const guarded = await withStorageReader(opened, () => { reads += 1; return { kind: "unavailable" }; });
  const result = fixture.front.captureModule(opened.deps, guarded, module);
  assert.equal(result.kind, "ok");
  assert.equal(reads, 1);
  assert.deepEqual(result.value.storage.map(row => row.fact), [{ kind: "unavailable", reason: "not-provided", causes: [] }]);
  const assignment = lower(result.value).checked.tree.statements.nodes[0].parameters.nodes[1].initializer.expression;
  assert.deepEqual(assignment.left.tsonic.place, result.value.storage[0].fact);
  assert.equal(assignment.tsonic.target.kind, "unavailable");
});

test("a declaration-only computed name does not acquire executing assignment storage", async () => {
  const { fixture, opened, module } = await captured('declare let key:"flag";export interface Shape{[key=key]:boolean}');
  let reads = 0;
  const guarded = await withStorageReader(opened, () => { reads += 1; assert.fail("a declaration name is not an executing storage query"); });
  const result = fixture.front.captureModule(opened.deps, guarded, module);
  assert.equal(result.kind, "ok");
  assert.equal(reads, 0);
  assert.deepEqual(result.value.storage, []);
  assert.equal(result.value.tree.statements.nodes[1].members.nodes[0].name.expression.operatorToken.kind, "EqualsToken");
});

test("the actual SDK readonly local answer retains its original error association through lowering", async () => {
  const { raw, lower } = await captured("export function store():boolean{const a:boolean=true;a=false;return a;}");
  assert.equal(raw.storage.length, 1);
  const fact = raw.storage[0].fact;
  assert.equal(fact.kind, "available");
  assert.equal(fact.value.writable, false);
  assert.equal(raw.checkerDiagnostics.length > 0, true);
  const assignment = raw.tree.statements.nodes[0].body.statements.nodes[1].expression;
  const read = raw.checkerViews.find(view => view.node.node === assignment.left.id).read;
  const failed = raw.types.types[read.value].form;
  assert.equal(failed.kind, "unavailable");
  assert.equal(failed.reason, "checker-error");
  const root = failed.causes[0].diagnostic.diagnostic;
  assert.equal(root.module, raw.module);
  assert.equal(raw.checkerDiagnostics[root.index].code.number, 2588);
  assert.deepEqual(raw.types.types[fact.value.type].form, failed);
  const { checked } = lower();
  const target = checked.tree.statements.nodes[0].body.statements.nodes[1].expression.left;
  assert.equal(target.tsonic.role, "assignment-target");
  assert.deepEqual(target.tsonic.place.value.read, failed);
  assert.deepEqual(target.tsonic.place.value.write, { kind: "available", value: null });
});

test("plain assignment capture admits every fact and edge before publishing its actual storage answer", async () => {
  const { resourceLimitDiagnostic } = await import("../../packages/host/dist/diag/index.js");
  const run = async (dimension, maximum) => {
    const { fixture, opened, module } = await captured();
    return { module, result: fixture.front.captureModule({ ...opened.deps, navigationCapture: {
      ...opened.deps.navigationCapture, [dimension]: maximum } }, opened.program, module) };
  };
  for (const [dimension, exact] of [["maximumCapturedFactsPerModule", 73], ["maximumCapturedEdgesPerModule", 67]]) {
    for (let maximum = 0; maximum < exact; maximum += 1) {
      const { module, result } = await run(dimension, maximum);
      assert.deepEqual(result, { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "front",
        limit: `front.${dimension}`, maximum, site: { kind: "file", path: "/project/src/main.ts" },
        unit: { request: { query: "captureModule", key: module }, position: { kind: "result" } } })] });
    }
    const { result } = await run(dimension, exact);
    assert.equal(result.kind, "ok");
    assert.equal(result.value.storage.length, 1);
    assert.equal(result.value.storage[0].fact.kind, "available");
  }
});

test("capture refuses before the actual storage query and preserves an original ready-reader failure", async () => {
  const { resourceLimitDiagnostic } = await import("../../packages/host/dist/diag/index.js");
  const original = new Error("the actual storage query failed");
  let reads = 0;
  const run = async (dimension, maximum) => {
    const { fixture, opened, module } = await captured();
    const guarded = await withStorageReader(opened, () => { reads += 1; throw original; });
    return { module, result: fixture.front.captureModule({ ...opened.deps, navigationCapture: {
      ...opened.deps.navigationCapture, [dimension]: maximum } }, guarded, module) };
  };
  for (const [dimension, firstRead] of [["maximumCapturedFactsPerModule", 36], ["maximumCapturedEdgesPerModule", 43]]) {
    for (let maximum = 0; maximum < firstRead; maximum += 1) {
      reads = 0;
      const { module, result } = await run(dimension, maximum);
      assert.deepEqual(result, { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "front",
        limit: `front.${dimension}`, maximum, site: { kind: "file", path: "/project/src/main.ts" },
        unit: { request: { query: "captureModule", key: module }, position: { kind: "result" } } })] });
      assert.equal(reads, 0, `${dimension} refuses before the query at ${maximum}`);
    }
    reads = 0;
    await assert.rejects(run(dimension, firstRead), error => error === original);
    assert.equal(reads, 1);
  }
});
