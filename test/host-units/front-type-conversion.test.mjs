import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

test("actual generic declarations, composites and indexes retain their checked graph references", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const source = "export interface Box<T>{value:T;} export type Applied=Box<string>;"
    + "export type Both={left:boolean}&{right:string};export type Either=boolean|string;"
    + "export type Indexed={[key:string]:boolean};";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const captured = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(captured.kind, "ok");
  const definitions = fixture.front.lowerModuleDefinitions(captured.value);
  assert.equal(definitions.kind, "ok");
  const types = fixture.types.createTypeInterner();
  const deps = fixture.lowerDepsFor(definitions.value, types, source);
  const exported = fixture.front.lowerModuleExports(deps, captured.value);
  assert.equal(exported.kind, "ok");
  const result = fixture.front.lowerModule({ ...deps, exportsOf: owner => owner === module ? exported.value : null }, captured.value);
  assert.equal(result.kind, "ok");
  assert.equal(fixture.verifyChecked(result.value, types).length, 0);
  const declarations = new Map(result.value.tree.statements.nodes.map(node => [node.name.text, node]));
  const applied = fixture.types.readType(types, declarations.get("Applied").tsonic.type.value);
  assert.equal(applied.kind, "declared");
  assert.equal(applied.definition, declarations.get("Box").tsonic.definition);
  assert.equal(applied.arguments.length, 1);
  assert.deepEqual(fixture.types.readType(types, applied.arguments[0]), { kind: "string" });
  for (const [name, kind] of [["Both", "intersection"], ["Either", "union"]]) {
    const term = fixture.types.readType(types, declarations.get(name).tsonic.type.value);
    assert.equal(term.kind, kind);
    assert.equal(term.members.length >= 2, true);
  }
  const indexed = fixture.types.readType(types, declarations.get("Indexed").tsonic.type.value);
  assert.equal(indexed.kind, "shape");
  assert.equal(indexed.indexes.length, 1);
  const index = indexed.indexes[0];
  const actual = definitions.value.sourceOccurrences.find(row => row.kind === "IndexSignature");
  assert.deepEqual(index.origin, actual.occurrence);
  assert.deepEqual(fixture.types.readType(types, index.key), { kind: "string" });
  assert.deepEqual(fixture.types.readType(types, index.read), { kind: "primitive", primitive: "bool" });
  assert.equal(index.write, index.read);
});

test("an index origin cannot borrow a same-numbered occurrence from another actual module", async () => {
  const fixture = await loadFrontFixture();
  const source = "export type Indexed={[key:string]:boolean};";
  const opened = fixture.openAndCapture(fixture.projectSnapshot({ sourceFiles: { "left.ts": source, "right.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] }));
  const actual = [];
  for (const name of ["left.ts", "right.ts"]) {
    const module = fixture.moduleOf(fixture.packageOf("/project"), `src/${name}`);
    const captured = fixture.front.captureModule(opened.deps, opened.program, module);
    assert.equal(captured.kind, "ok");
    const definitions = fixture.front.lowerModuleDefinitions(captured.value);
    assert.equal(definitions.kind, "ok");
    actual.push({ raw: captured.value, definitions: definitions.value,
      index: definitions.value.sourceOccurrences.find(row => row.kind === "IndexSignature") });
  }
  assert.equal(actual[0].index.node, actual[1].index.node);
  assert.notEqual(actual[0].index.occurrence.value.owner, actual[1].index.occurrence.value.owner);
  const deps = fixture.lowerDepsFor(actual[0].definitions, fixture.types.createTypeInterner(), source);
  const exported = fixture.front.lowerModuleExports(deps, actual[0].raw);
  assert.equal(exported.kind, "ok");
  assert.throws(() => fixture.front.lowerModule({ ...deps,
    exportsOf: owner => owner === actual[0].raw.module ? exported.value : null,
    sourceOccurrenceOf: reference => reference.node === actual[0].index.node ? actual[1].index : deps.sourceOccurrenceOf(reference) },
  actual[0].raw), /actual captured module/u);
});
