import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

async function checked(source) {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const captured = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(captured.kind, "ok");
  const definitions = fixture.front.lowerModuleDefinitions(captured.value);
  assert.equal(definitions.kind, "ok");
  const interner = fixture.types.createTypeInterner();
  const deps = fixture.lowerDepsFor(definitions.value, interner, source);
  const exported = fixture.front.lowerModuleExports(deps, captured.value);
  assert.equal(exported.kind, "ok");
  const result = fixture.front.lowerModule({ ...deps, exportsOf: owner => owner === module ? exported.value : null }, captured.value);
  assert.equal(result.kind, "ok");
  assert.equal(fixture.verifyChecked(result.value, interner).length, 0);
  const table = fixture.types.viewTypes(interner);
  const declarations = await import("../../packages/host/dist/elaborate/declarations.js");
  const projection = { types: interner, signatureOf: id => {
    const signature = table.signatures[id];
    assert.equal(signature !== undefined, true, "the endpoint names a genuine selected signature");
    return signature;
  } };
  return { fixture, declarations, projection, tree: result.value.tree, interner };
}

test("actual alias and interface members retain checked types, declarations and genuine bodyless endpoints", async () => {
  const { declarations, projection, tree } = await checked(
    "export type Fields<T> = { value: T; nested: { readonly leaf: boolean; }; method(input: boolean): boolean; get flag(): boolean; set flag(input: boolean | string); };\n"
    + "export interface Keys { [name: string]: boolean; }\n");
  const alias = tree.statements.nodes[0];
  const typed = declarations.declarationAlias(projection, alias);
  assert.equal(typed.type.kind, "TypeLiteral");
  assert.equal(typed.tsonic.type, alias.tsonic.type.value);
  assert.deepEqual(typed.typeParameters.nodes[0].tsonic.parameter, alias.typeParameters.nodes[0].tsonic.parameter);
  for (let index = 0; index < alias.type.members.nodes.length; index += 1) {
    const source = alias.type.members.nodes[index];
    const result = typed.type.members.nodes[index];
    assert.equal(result.id, source.id);
    assert.equal(result.parent, source.parent);
    assert.equal(result.tsonic.definition, source.tsonic.definition ?? source.tsonic.declaration.definition);
    if (source.type !== null) assert.equal(result.type.tsonic.type, source.type.tsonic.type.value);
    if (source.kind === "PropertySignature") {
      assert.equal(result.tsonic.storage, source.tsonic.declaredType.value);
      assert.equal(result.tsonic.initializer, null);
    } else {
      assert.equal(result.tsonic.template, null);
      assert.deepEqual(result.tsonic.signatures, source.tsonic.signatures);
      const signature = projection.signatureOf(source.tsonic.signatures[0].signature);
      for (let formal = 0; formal < result.parameters.nodes.length; formal += 1) {
        assert.equal(result.parameters.nodes[formal].tsonic.local, null);
        assert.equal(result.parameters.nodes[formal].tsonic.passing, signature.parameters[formal].passing);
        assert.equal(result.parameters.nodes[formal].tsonic.storage, signature.parameters[formal].type);
      }
    }
  }
  const nested = typed.type.members.nodes[1];
  assert.equal(nested.type.kind, "TypeLiteral");
  assert.equal(nested.type.members.nodes[0].kind, "PropertySignature");
  const keys = declarations.declarationInterface(projection, tree.statements.nodes[1]);
  assert.equal(keys.members.nodes[0].kind, "IndexSignature");
  assert.equal(keys.members.nodes[0].parameters.nodes[0].tsonic.local, null);
  assert.equal(keys.members.nodes[0].parameters.nodes[0].tsonic.passing, null);
});

test("a zero-formal accessor still requires its genuine endpoint and original reader failure", async () => {
  const { declarations, projection, tree } = await checked("export type Fields = { get flag(): boolean; };\n");
  const alias = tree.statements.nodes[0];
  const getter = alias.type.members.nodes[0];
  const signature = projection.signatureOf(getter.tsonic.signatures[0].signature);
  for (const changed of [{ id: signature.id + 1 }, { declaration: alias.tsonic.definition }, { receiver: signature.result }]) {
    assert.throws(() => declarations.declarationAlias({ ...projection, signatureOf: () => ({ ...signature, ...changed }) }, alias),
      /bodyless callable endpoint/u);
  }
  const original = new TypeError("the actual endpoint reader failed");
  const later = new Proxy({}, { get() { assert.fail("no later declaration is read after the original endpoint failure"); } });
  const altered = { ...alias, type: { ...alias.type, members: { ...alias.type.members, nodes: [getter, later] } } };
  assert.throws(() => declarations.declarationAlias({ ...projection, signatureOf: () => { throw original; } }, altered),
    error => error === original);
  const unread = new Proxy({}, { get() { assert.fail("an executing accessor payload is never traversed as an annotation"); } });
  for (const changed of [{ body: unread }, { asteriskToken: unread }]) {
    const executing = { ...alias, type: { ...alias.type, members: { ...alias.type.members,
      nodes: [{ ...getter, ...changed }] } } };
    assert.throws(() => declarations.declarationAlias(projection, executing), /nonexecuting body boundary/u);
  }
});

test("twenty thousand checked member annotations project once through the same iterative typed assembly", async () => {
  const { fixture, declarations, tree } = await checked("export type Fields = { value: boolean; };\n");
  const alias = tree.statements.nodes[0];
  const leaf = alias.type.members.nodes[0].type;
  const source = alias.type.members.nodes[0];
  const depth = 20000;
  const terms = Array.from({ length: depth + 1 });
  const reads = new Set();
  const phase = (base, id, type) => ({ ...base, type: { kind: "available", value: type },
    get referencedDefinitions() {
      assert.equal(reads.has(id), false, "each actual annotation completes exactly once");
      reads.add(id);
      return [];
    } });
  terms[depth] = { kind: "primitive", primitive: "bool" };
  let node = { ...leaf, id: depth * 3, parent: depth * 3 - 2, tsonic: phase(leaf.tsonic, depth * 3, depth) };
  for (let index = depth - 1; index >= 0; index -= 1) {
    const id = index * 3;
    const definition = fixture.ids.encodeDefId({ module: tree.origin.module, segments: [{ name: `member${index}`, ordinal: 0 }] });
    const origin = { kind: "declared", declaration: definition };
    terms[index] = { kind: "shape", members: [{ key: { kind: "text", value: "value" }, kind: "property",
      origins: [origin], readOrigins: [origin], writeOrigins: [origin], read: index + 1, write: index + 1,
      optional: false, readonly: false }], indexes: [], calls: [], constructs: [] };
    node = { ...alias.type, id, parent: index === 0 ? alias.id : id - 2, tsonic: phase(alias.type.tsonic, id, index),
      members: { ...alias.type.members, nodes: [{ ...source, id: id + 1, parent: id,
        name: { ...source.name, id: id + 2, parent: id + 1,
          tsonic: { ...source.name.tsonic, declaration: { kind: "definition", definition } } },
        type: node, tsonic: { ...source.tsonic, declaration: { kind: "definition", definition },
          declaredType: { kind: "available", value: index + 1 } } }] } };
  }
  const interner = fixture.types.seedTypeInterner({ terms, signatures: [] });
  const table = fixture.types.viewTypes(interner);
  assert.equal(table.terms.length, depth + 1);
  const unused = () => assert.fail("this closed shape graph has no component, nominal or local references");
  assert.equal(fixture.types.verifyTypes({ table, bindings: [], evidence: [], nominalOf: unused,
    nodeExists: unused, localExists: unused }).length, 0, "the deep fixture is a valid complete canonical TypeTable");
  let completed = declarations.declarationType({ types: interner,
    signatureOf: () => assert.fail("no callable endpoint belongs to this constructed property-only graph") }, node);
  for (let index = 0; index < depth; index += 1) {
    assert.equal(completed.kind, "TypeLiteral");
    assert.equal(completed.tsonic.type, index);
    assert.equal(completed.members.nodes[0].tsonic.storage, index + 1);
    assert.equal(completed.members.nodes[0].id, index * 3 + 1);
    completed = completed.members.nodes[0].type;
  }
  assert.equal(completed.kind, "BooleanKeyword");
  assert.equal(completed.tsonic.type, depth);
  assert.equal(reads.size, depth + 1);
});
