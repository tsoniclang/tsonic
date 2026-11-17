import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

async function captured(source) {
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const result = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const definitions = fixture.front.lowerModuleDefinitions({ module: raw,
    componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === module) });
  assert.equal(definitions.kind, "ok");
  const types = fixture.types.createTypeInterner();
  const deps = fixture.lowerDepsFor(definitions.value, types, source);
  return { fixture, raw, types, deps, opened, lower() {
    const exports = fixture.front.lowerModuleExports(deps, raw);
    assert.equal(exports.kind, "ok");
    return fixture.front.lowerModule({ ...deps, exportsOf: owner => owner === module ? exports.value : null }, raw);
  } };
}

test("authored failed type answers retain their original checker roots while actual any stays available", async () => {
  const actual = await captured("export type First=Missing;export type Second=OtherMissing;export type Open=any;");
  const failures = actual.raw.tree.statements.nodes.slice(0, 2).map(node => {
    const row = actual.raw.types.types.find(type => type.authoredTypeNode?.node === node.type.id);
    assert.equal(row.form.kind, "unavailable");
    assert.equal(row.form.reason, "checker-error");
    const reference = row.form.causes[0].diagnostic.diagnostic;
    assert.equal(reference.module, actual.raw.module);
    assert.equal(actual.raw.checkerDiagnostics[reference.index].code.number, 2304);
    return row.form;
  });
  assert.notDeepEqual(failures[0].causes, failures[1].causes);
  const checked = actual.lower();
  assert.equal(checked.kind, "ok");
  for (const [index, failure] of failures.entries()) {
    const node = checked.value.tree.statements.nodes[index];
    assert.deepEqual(node.type.tsonic.type, failure);
    assert.deepEqual(node.tsonic.type, failure);
  }
  assert.equal(checked.value.tree.statements.nodes[2].type.tsonic.type.kind, "available");
  assert.deepEqual(actual.fixture.verifyChecked(checked.value, actual.types), []);
});

test("a failed captured dependency stops graph publication without poisoning a populated arena or its maps", async () => {
  const actual = await captured("export type Failed=Missing;export type Pair={first:boolean;second:string};");
  const conversion = await import("../../packages/host/dist/front/type-conversion.js");
  const failed = actual.raw.types.types.find(row => row.authoredTypeNode?.node === actual.raw.tree.statements.nodes[0].type.id);
  const pair = actual.raw.types.types.find(row => row.authoredTypeNode?.node === actual.raw.tree.statements.nodes[1].type.id);
  const inventory = actual.raw.types.members[pair.form.value.inventory];
  const child = inventory.members[0].read.value;
  const rows = [...actual.raw.types.types];
  rows[child] = { ...rows[child], form: failed.form };
  actual.fixture.types.internType(actual.types, { kind: "string" });
  const before = actual.fixture.types.viewTypes(actual.types);
  const prefix = [...before.terms];
  const signatures = [...before.signatures];
  const graph = conversion.createTypeConversion(actual.deps, { ...actual.raw, types: { ...actual.raw.types, types: rows } });
  assert.deepEqual(conversion.convertRawType(graph, pair.id), failed.form);
  assert.equal(graph.convertedTypes.size, 0);
  assert.equal(graph.convertedSignatures.size, 0);
  const after = actual.fixture.types.viewTypes(actual.types);
  assert.deepEqual(after.terms, prefix);
  assert.equal(after.terms.every((row, index) => row === prefix[index]), true);
  assert.deepEqual(after.signatures, signatures);
  assert.deepEqual(conversion.convertRawType(graph, failed.id), failed.form);
  const missing = [...rows];
  missing[failed.id] = { ...failed, form: { ...failed.form, causes: [] } };
  const malformed = conversion.createTypeConversion(actual.deps, { ...actual.raw, types: { ...actual.raw.types, types: missing } });
  assert.throws(() => conversion.convertRawType(malformed, failed.id), /actual captured component\/error association \(checker-error\)/u);
});

test("an actual foreign constraint answer names the original foreign module's published run", async () => {
  const fixture = await loadFrontFixture();
  const opened = fixture.openAndCapture(fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "import {make} from './leaf.js';export type Value=typeof make;",
    "leaf.ts": "export declare function make<T extends Missing=Missing>(value:T):T;",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] }));
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const leaf = fixture.moduleOf(fixture.packageOf("/project"), "src/leaf.ts");
  const capturedMain = fixture.front.captureModule(opened.deps, opened.program, main);
  const capturedLeaf = fixture.front.captureModule(opened.deps, opened.program, leaf);
  assert.equal(capturedMain.kind, "ok");
  assert.equal(capturedLeaf.kind, "ok");
  const failures = capturedMain.value.types.types.filter(row => row.authoredTypeNode?.module === leaf && row.form.reason === "checker-error");
  assert.equal(failures.length >= 2, true);
  for (const row of failures) {
    const reference = row.form.causes[0].diagnostic.diagnostic;
    assert.equal(reference.module, leaf);
    assert.equal(capturedLeaf.value.checkerDiagnostics[reference.index].code.number, 2304);
  }
});
