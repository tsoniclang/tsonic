import assert from "node:assert/strict";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { checkedDomain } from "./fixtures/front/checked-domain.mjs";

function verifyTable(fixture, checked, table) {
  const domain = checkedDomain(checked, fixture.hir);
  return fixture.types.verifyTypes({ table, bindings: [], evidence: [], nominalOf: () => null,
    nodeExists: node => domain.nodeOf(node) !== null, localExists: domain.localExists });
}

async function captured(source) {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const result = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(result.kind, "ok");
  const definitions = fixture.front.lowerModuleDefinitions(result.value);
  assert.equal(definitions.kind, "ok");
  const lower = (raw = result.value) => {
    const interner = fixture.types.createTypeInterner();
    const deps = fixture.lowerDepsFor(definitions.value, interner, source);
    const exported = fixture.front.lowerModuleExports(deps, raw);
    assert.equal(exported.kind, "ok");
    const checked = fixture.front.lowerModule({ ...deps, exportsOf: owner => owner === module ? exported.value : null }, raw);
    assert.equal(checked.kind, "ok");
    return { checked: checked.value, interner };
  };
  return { fixture, raw: result.value, definitions: definitions.value, lower };
}

test("actual declared type aliases lower member types, qualified origins and method signatures into verified checked syntax", async () => {
  const { fixture, definitions, lower } = await captured(
    "export type Fields = { plain: boolean; readonly frozen: string; method(value: boolean): boolean; };\n");
  const { checked, interner } = lower();
  assert.equal(fixture.verifyChecked(checked, interner).length, 0);
  const table = fixture.types.viewTypes(interner);
  assert.equal(verifyTable(fixture, checked, table).length, 0);
  const alias = checked.tree.statements.nodes[0];
  assert.equal(alias.kind, "TypeAliasDeclaration");
  assert.equal(alias.type.kind, "TypeLiteral");
  assert.deepEqual(alias.type.tsonic.type, alias.tsonic.type);
  const shape = table.terms[alias.tsonic.type.value];
  assert.equal(shape.kind, "shape");
  assert.equal(shape.members.length, 3);
  const members = new Map(shape.members.map(member => [member.key.value, member]));
  const origins = new Map(definitions.rows.filter(row => row.kind === "PropertySignature" || row.kind === "MethodSignature")
    .map(row => [fixture.ids.decodeDefId(row.definition).value.segments.at(-1).name, row.definition]));
  for (const [name, member] of members) {
    assert.deepEqual(member.origins, [{ kind: "declared", declaration: origins.get(name) }]);
    assert.deepEqual(member.readOrigins, member.origins);
    assert.deepEqual(member.writeOrigins, name === "frozen" ? [] : member.origins);
  }
  assert.equal(members.get("frozen").write, null);
  assert.equal(members.get("frozen").readonly, true);
  const method = members.get("method");
  assert.equal(method.kind, "method");
  const callable = table.terms[method.read];
  assert.equal(callable.kind, "callable");
  assert.equal(callable.calls.length, 1);
  assert.equal(table.signatures[callable.calls[0]].declaration, origins.get("method"));
  const parsed = fixture.hir.parseHir(fixture.hir.printHir(checked));
  assert.equal(parsed.kind, "parsed");
  assert.equal(isDeepStrictEqual(parsed.value, checked), true, "the actual checked member tree round-trips unchanged");
});

test("actual generic and nested member annotations retain their genuine parameter and containing declaration identities", async () => {
  const { fixture, definitions, lower } = await captured(
    "export type Fields<T> = { value: T; nested: { leaf: boolean; }; };\n");
  const { checked, interner } = lower();
  assert.equal(fixture.verifyChecked(checked, interner).length, 0);
  const table = fixture.types.viewTypes(interner);
  assert.equal(verifyTable(fixture, checked, table).length, 0);
  const alias = checked.tree.statements.nodes[0];
  const parameter = definitions.rows.find(row => row.kind === "TypeParameter");
  assert.equal(parameter !== undefined, true);
  assert.equal(alias.tsonic.parameters[0].declaration, parameter.definition);
  const outer = table.terms[alias.tsonic.type.value];
  assert.equal(outer.kind, "shape");
  const value = outer.members.find(member => member.key.value === "value");
  assert.deepEqual(table.terms[value.read], { kind: "param", parameter: parameter.definition });
  const nested = alias.type.members.nodes.find(member => member.name.text === "nested");
  assert.equal(nested.type.kind, "TypeLiteral");
  const leaf = nested.type.members.nodes[0];
  assert.equal(leaf.tsonic.parent, nested.tsonic.declaration.definition);
  assert.equal(leaf.type.tsonic.type.kind, "available");
});

test("member lowering rejects missing type, kind and origin associations instead of inventing structural members", async () => {
  const { raw, lower } = await captured("export type Fields = { plain: boolean; };\n");
  const selected = raw.types.members.find(table => table.members.length === 1);
  assert.equal(selected !== undefined, true);
  const replace = changed => ({ ...raw, types: { ...raw.types, members: raw.types.members.map(table =>
    table.id === selected.id ? { ...table, members: [{ ...table.members[0], ...changed }] } : table) } });
  assert.throws(() => lower(replace({ read: { kind: "unavailable", reason: "missing-original-component", causes: [] } })),
    /actual captured type association/u);
  assert.throws(() => lower(replace({ origins: [] })), /actual captured origins/u);
  assert.throws(() => lower(replace({ readKind: "unavailable" })), /actual selected member kind/u);
});
