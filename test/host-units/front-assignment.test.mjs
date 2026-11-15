import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

async function captured() {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const source = "export function choose(a:boolean,b:boolean=(a=true)):boolean{return a;}";
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
  return { fixture, raw, lower };
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
    /actual expression, declaration and qualified local/u);
  assert.throws(() => lower({ ...raw, storage: [{ ...row, node: { ...row.node, module: foreign } }] }), /actual module and unique syntax order/u);
  assert.throws(() => lower({ ...raw, storage: [row, row] }), /actual module and unique syntax order/u);
  assert.throws(() => lower({ ...raw, storage: [{ node: { module: raw.module, node: raw.tree.id }, fact: { kind: "available", value: null } }, row] }),
    /actual executing expression/u);
  const missing = lower({ ...raw, storage: [] }).checked.tree.statements.nodes[0].parameters.nodes[1].initializer.expression;
  assert.deepEqual(missing.tsonic.target, { kind: "unavailable", reason: "not-provided", causes: [] });
  const unavailable = { kind: "unavailable", reason: "missing-original-component", causes: [] };
  const retained = lower({ ...raw, storage: [{ ...row, fact: unavailable }] }).checked.tree.statements.nodes[0].parameters.nodes[1].initializer.expression;
  assert.equal(retained.left.tsonic.place === unavailable, true);
});
