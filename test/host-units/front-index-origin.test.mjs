import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

test("actual declared and mapped indexes retain source origin and row key without becoming bindings", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const source = "export type Mapped = { [key in string]: unknown }; export type Indexed = { [key: string]: unknown; }; export { Indexed as Renamed };";
  const opened = fixture.openedModule(source);
  const captured = fixture.front.captureModule(opened.deps, opened.program, opened.module);
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const identified = fixture.front.lowerModuleDefinitions({ module: raw, componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === raw.module) });
  assert.equal(identified.kind, "ok");
  assert.equal("bindingSources" in identified.value, false);
  const rows = identified.value.sourceOccurrences;
  const mapped = rows.find(row => row.kind === "MappedType");
  const declared = rows.find(row => row.kind === "IndexSignature");
  assert.notEqual(mapped, undefined);
  assert.notEqual(declared, undefined);
  const alias = identified.value.rows.find(row => row.kind === "TypeAliasDeclaration");
  const index = identified.value.rows.find(row => row.kind === "IndexSignature");
  assert.equal(mapped.occurrence.value.owner, alias.definition);
  assert.equal(declared.occurrence.value.owner, index.definition);
  assert.equal(mapped.occurrence.value.node, mapped.node);
  assert.equal(declared.occurrence.value.node, declared.node);
  assert.equal(identified.value.rows.some(row => row.node === mapped.node), false);
  const indexes = raw.types.members.flatMap(table => table.indexes);
  assert.equal(indexes.some(row => row.origin.node === mapped.node), true);
  assert.equal(indexes.some(row => row.origin.node === declared.node), true);
  for (const row of indexes) {
    assert.equal("declaration" in row, false);
    const key = raw.types.types[row.key];
    const value = raw.types.types[row.value];
    assert.deepEqual(raw.types.components[key.component].path?.step, { kind: "index-key", origin: row.origin, key: row.key });
    assert.deepEqual(raw.types.components[value.component].path?.step, { kind: "index-value", origin: row.origin, key: row.key });
  }
  const deps = fixture.lowerDepsFor(identified.value, fixture.types.createTypeInterner(), source);
  assert.equal("bindingOccurrenceOf" in deps, false);
  const exported = fixture.front.lowerModuleExports(deps, raw);
  assert.equal(exported.kind, "ok");
  assert.deepEqual(exported.value.entries.map(row => [row.name, row.target.kind]), [
    ["Indexed", "declarations"], ["Mapped", "declarations"], ["Renamed", "binding"],
  ]);
  for (const row of [mapped, declared]) assert.throws(() => fixture.front.lowerModuleExports(deps,
    { ...raw, bindings: [...raw.bindings, { binding: { module: raw.module, node: row.node },
      target: { kind: "available", value: { kind: "module", module: raw.module } } }] }), /genuine ready source owner/u);
  const { sourceOccurrenceOf, ...retired } = deps;
  assert.throws(() => fixture.front.lowerModuleExports({ ...retired, bindingOccurrenceOf: sourceOccurrenceOf }, raw), /sourceOccurrenceOf/u);
});

test("actual Record mapped domains share their real source but retain distinct selected keys", async () => {
  const fixture = await loadFrontFixture();
  const opened = fixture.openedModule("export function value(input: Record<PropertyKey, unknown>): unknown { return input; }");
  const captured = fixture.front.captureModule(opened.deps, opened.program, opened.module);
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const indexed = raw.types.members.filter(table => table.indexes.length === 3);
  assert.equal(indexed.length > 0, true);
  for (const table of indexed) {
    const [first, ...rest] = table.indexes;
    assert.equal(rest.every(row => row.origin.module === first.origin.module && row.origin.node === first.origin.node), true);
    assert.equal(new Set(table.indexes.map(row => row.key)).size, 3);
    assert.deepEqual(table.indexes.map(row => raw.types.types[row.key].form.value.scalar).sort(), ["number", "string", "symbol"]);
  }
});
