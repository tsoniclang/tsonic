import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

test("one iterative type/member assembly preserves twenty thousand nested ready declaration scopes without recursive calls", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf("export function identity(input: boolean): boolean { return input; }\n");
  const { lowerCheckedType } = await import("../../packages/host/dist/front/checked-declarations.js");
  const depth = 20000;
  const rootOwner = actual.checked.tree.tsonic.definition;
  const origin = actual.checked.tree.origin;
  const loc = actual.checked.tree.loc;
  const core = actual.checked.tree.tsonic.core;
  const header = (id, parent) => ({ id, parent, origin, loc, flags: [] });
  const definitions = new Map();
  const types = new Map();
  const owners = [];
  const terms = Array.from({ length: depth + 1 });
  let node = { ...header(depth * 3, depth * 3 - 2), kind: "BooleanKeyword", tsonic: null };
  types.set(node.id, depth);
  terms[depth] = { kind: "primitive", primitive: "bool" };
  for (let index = depth - 1; index >= 0; index -= 1) {
    const id = index * 3;
    const declaration = fixture.ids.encodeDefId({ module: actual.module, segments: [{ name: `ready${index}`, ordinal: 0 }] });
    owners[index] = declaration;
    definitions.set(id + 1, declaration);
    types.set(id, index);
    terms[index] = { kind: "shape", members: [{ key: { kind: "text", value: "next" },
      origins: [{ kind: "declared", declaration }], readOrigins: [{ kind: "declared", declaration }],
      writeOrigins: [{ kind: "declared", declaration }], kind: "property", read: index + 1, write: index + 1,
      optional: false, readonly: false }], indexes: [], calls: [], constructs: [] };
    node = { ...header(id, index === 0 ? 0 : id - 2), kind: "TypeLiteral", tsonic: null,
      members: { loc, nodes: [{ ...header(id + 1, id), kind: "PropertySignature", modifiers: null,
        name: { ...header(id + 2, id + 1), kind: "Identifier", text: "next", tsonic: null },
        postfixToken: null, type: node, initializer: null, tsonic: null }] } };
  }
  const interner = fixture.types.seedTypeInterner({ terms, signatures: [] });
  const table = fixture.types.viewTypes(interner);
  assert.equal(table.terms.length, depth + 1);
  const read = new Set();
  const result = lowerCheckedType({ definitions, core: () => core,
    checkedType: node => {
      assert.equal(read.has(node), false, "each actual type node completes once");
      read.add(node);
      const type = types.get(node);
      assert.equal(type !== undefined, true);
      return { kind: "complete", value: type };
    }, memory: () => ({ kind: "available", value: null }),
    resolution: () => assert.fail("no type name is selected in this constructed ready graph"),
    signature: () => assert.fail("no callable is selected in this constructed ready graph"),
    expression: () => assert.fail("no executable expression belongs to this type graph"),
    property: () => assert.fail("no computed member key belongs to this type graph") }, node, rootOwner);
  assert.equal(read.size, depth + 1);
  assert.equal(result.kind, "complete");
  let completed = result.value;
  let owner = rootOwner;
  for (let index = 0; index < depth; index += 1) {
    assert.equal(completed.kind, "TypeLiteral");
    assert.equal(completed.tsonic.type.value, index);
    const member = completed.members.nodes[0];
    assert.equal(member.tsonic.parent, owner);
    assert.equal(member.tsonic.declaration.definition, owners[index]);
    assert.equal(member.type.tsonic.type.value, index + 1);
    owner = owners[index];
    completed = member.type;
  }
  assert.equal(completed.kind, "BooleanKeyword");
  assert.equal(completed.tsonic.type.value, depth);
});

test("a missing prepared type retains the original failure and never pulls a later member", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf("export function identity(input: boolean): boolean { return input; }\n");
  const { lowerCheckedType } = await import("../../packages/host/dist/front/checked-declarations.js");
  const origin = actual.checked.tree.origin;
  const loc = actual.checked.tree.loc;
  const owner = actual.checked.tree.tsonic.definition;
  const header = (id, parent) => ({ id, parent, origin, loc, flags: [] });
  let laterReads = 0;
  const later = new Proxy({}, { get() { laterReads += 1; assert.fail("the later member is never read"); } });
  const root = { ...header(0, 0), kind: "TypeLiteral", tsonic: null,
    members: { loc, nodes: [{ ...header(1, 0), kind: "PropertySignature", modifiers: null,
      name: { ...header(2, 1), kind: "Identifier", text: "first", tsonic: null }, postfixToken: null,
      type: { ...header(3, 1), kind: "BooleanKeyword", tsonic: null }, initializer: null, tsonic: null }, later] } };
  const original = new TypeError("the actual prepared annotation is missing");
  let reads = 0;
  const unused = () => assert.fail("no dependent construction follows the original missing annotation");
  assert.throws(() => lowerCheckedType({ definitions: new Map([[1, owner]]),
    checkedType: node => { reads += 1; assert.equal(node, 3); throw original; },
    core: unused, resolution: unused, signature: unused, memory: unused, expression: unused, property: unused }, root, owner),
  error => error === original);
  assert.equal(reads, 1);
  assert.equal(laterReads, 0);
});

test("an expected publication stop remains the same result and prevents dependent member construction", async () => {
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf("export function identity(input: boolean): boolean { return input; }\n");
  const { lowerCheckedType } = await import("../../packages/host/dist/front/checked-declarations.js");
  const types = fixture.types.createTypeInterner();
  const stop = fixture.types.internTypeGraph({ types,
    work: fixture.types.createTypePublicationWork({ maximumWork: 0, maximumCreatedRecords: 100 }) },
  new Proxy({}, { get() { assert.fail("the refused graph input is never read"); } }));
  assert.equal(stop.kind, "resource-limit");
  const owner = actual.checked.tree.tsonic.definition;
  const header = (id, parent) => ({ id, parent, origin: actual.checked.tree.origin, loc: actual.checked.tree.loc, flags: [] });
  let laterReads = 0;
  const later = new Proxy({}, { get() { laterReads += 1; assert.fail("no later member follows the original publication stop"); } });
  const root = { ...header(0, null), kind: "TypeLiteral", tsonic: null,
    members: { loc: actual.checked.tree.loc, nodes: [{ ...header(1, 0), kind: "PropertySignature", modifiers: null,
      name: { ...header(2, 1), kind: "Identifier", text: "first", tsonic: null }, postfixToken: null,
      type: { ...header(3, 1), kind: "BooleanKeyword", tsonic: null }, initializer: null, tsonic: null }, later] } };
  const unused = () => assert.fail("the original stop prevents dependent construction");
  let reads = 0;
  const result = lowerCheckedType({ definitions: new Map([[1, owner]]), checkedType: node => {
    reads += 1; assert.equal(node, 3); return stop;
  }, core: unused, resolution: unused, signature: unused, memory: unused, expression: unused, property: unused }, root, owner);
  assert.equal(result === stop, true);
  assert.equal(reads, 1);
  assert.equal(laterReads, 0);
});
