import assert from "node:assert/strict";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { lowerSingleCheckedModule, captureSingleModule, identifySingleModule, loadFrontFixture } from "./fixtures/front/checked-module.mjs";
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
  const result = captureSingleModule(fixture.front, opened.deps, opened.program, module);
  assert.equal(result.kind, "ok");
  const definitions = identifySingleModule(fixture.front, { module: result.value, componentRoots: result.value.types.components.map(component => component.root).filter(root => root.module === result.value.module) });
  assert.equal(definitions.kind, "ok");
  const lower = (raw = result.value) => {
    const interner = fixture.types.createTypeInterner();
    const deps = fixture.lowerDepsFor(definitions.value, interner, source);
    const exported = fixture.front.lowerModuleExports(deps, raw);
    assert.equal(exported.kind, "ok");
    const checked = lowerSingleCheckedModule(fixture.front, { ...deps, exportsOf: owner => owner === module ? exported.value : null }, raw);
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

test("actual declared accessors retain separate checked endpoints, read/write types and genuine declaration origins", async () => {
  const { fixture, raw, definitions, lower } = await captured(
    "export type Fields = { get accessor(): boolean; set accessor(value: boolean | string); };\n");
  const { checked, interner } = lower();
  assert.equal(fixture.verifyChecked(checked, interner).length, 0);
  const table = fixture.types.viewTypes(interner);
  assert.equal(verifyTable(fixture, checked, table).length, 0);
  const alias = checked.tree.statements.nodes[0];
  const [getter, setter] = alias.type.members.nodes;
  assert.equal(getter.kind, "GetAccessor");
  assert.equal(setter.kind, "SetAccessor");
  assert.equal(getter.tsonic.body, null);
  assert.equal(setter.tsonic.body, null);
  assert.equal(getter.tsonic.signatures.length, 1);
  assert.equal(setter.tsonic.signatures.length, 1);
  assert.equal(getter.parameters.nodes.length, 0);
  assert.equal(setter.parameters.nodes.length, 1);
  const shape = table.terms[alias.tsonic.type.value];
  assert.equal(shape.kind, "shape");
  const member = shape.members[0];
  assert.equal(member.kind, "accessor");
  assert.deepEqual(table.terms[member.read], { kind: "primitive", primitive: "bool" });
  assert.equal(table.terms[member.write].kind, "union");
  assert.deepEqual(member.readOrigins, [{ kind: "declared", declaration: getter.tsonic.definition }]);
  assert.deepEqual(member.writeOrigins, [{ kind: "declared", declaration: setter.tsonic.definition }]);
  assert.equal(definitions.rows.some(row => row.kind === "GetAccessor" && row.definition === getter.tsonic.definition), true);
  assert.equal(definitions.rows.some(row => row.kind === "SetAccessor" && row.definition === setter.tsonic.definition), true);
  for (const accessor of [getter, setter]) {
    const signature = table.signatures[accessor.tsonic.signatures[0].signature];
    assert.equal(signature.declaration, accessor.tsonic.definition);
    assert.equal(signature.owner.kind, "item");
    assert.equal(signature.owner.value.owner, accessor.tsonic.definition);
    assert.equal(signature.owner.value.node, accessor.id);
  }
  const parsed = fixture.hir.parseHir(fixture.hir.printHir(checked));
  assert.equal(parsed.kind, "parsed");
  assert.equal(isDeepStrictEqual(parsed.value, checked), true, "actual getter/setter syntax and endpoint records survive the HIR codec");
  const aliasSyntax = raw.tree.statements.nodes[0];
  const unread = new Proxy({}, { get() { assert.fail("an executing accessor payload is never read as a bodyless declaration"); } });
  for (const changed of [{ body: unread }, { asteriskToken: unread }]) {
    const altered = { ...raw, tree: { ...raw.tree, statements: { ...raw.tree.statements, nodes: [
      { ...aliasSyntax, type: { ...aliasSyntax.type, members: { ...aliasSyntax.type.members,
        nodes: [{ ...aliasSyntax.type.members.nodes[0], ...changed }, ...aliasSyntax.type.members.nodes.slice(1)] } } },
    ] } } };
    assert.throws(() => lower(altered), /GetAccessor with an execution body or generator marker/u);
  }
});
