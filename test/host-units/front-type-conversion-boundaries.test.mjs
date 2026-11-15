import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { checkedDomain } from "./fixtures/front/checked-domain.mjs";

async function captured(source, sourceFiles = { "main.ts": source }) {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const opened = fixture.openAndCapture(fixture.projectSnapshot({ sourceFiles,
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] }));
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const result = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(result.kind, "ok");
  const definitions = fixture.front.lowerModuleDefinitions(result.value);
  assert.equal(definitions.kind, "ok");
  const types = fixture.types.createTypeInterner();
  const deps = fixture.lowerDepsFor(definitions.value, types, source);
  const exported = fixture.front.lowerModuleExports(deps, result.value);
  assert.equal(exported.kind, "ok");
  const lowered = fixture.front.lowerModule({ ...deps, exportsOf: owner => owner === module ? exported.value : null }, result.value);
  assert.equal(lowered.kind, "ok");
  const domain = checkedDomain(lowered.value, fixture.hir);
  const bodyOf = new Map();
  for (const component of result.value.types.components) for (const body of lowered.value.bodies) {
    if (domain.nodeOf({ kind: "body", value: { body: body.body, node: component.root.node } }) !== null)
      bodyOf.set(component.root.node, body.body);
  }
  const conversion = await import("../../packages/host/dist/front/type-conversion.js");
  return { fixture, raw: result.value, definitions: definitions.value, source, conversion, bodyOf, opened };
}

function rejects(actual, raw, root, pattern, bodyOf = actual.bodyOf) {
  const types = actual.fixture.types.createTypeInterner();
  actual.fixture.types.internType(types, { kind: "string" });
  const table = actual.fixture.types.viewTypes(types);
  const previous = [...table.terms];
  const deps = actual.fixture.lowerDepsFor(actual.definitions, types, actual.source);
  const conversion = actual.conversion.createTypeConversion(deps, raw, bodyOf);
  assert.throws(() => root.kind === "type" ? actual.conversion.convertRawType(conversion, root.id)
    : actual.conversion.signatureOf(conversion, root.id), pattern);
  assert.equal(actual.fixture.types.viewTypes(types) === table, true);
  assert.equal(table.terms.length, previous.length);
  assert.equal(table.terms.every((row, index) => row === previous[index]), true);
  assert.equal(table.signatures.length, 0);
  assert.equal(conversion.convertedTypes.size, 0);
  assert.equal(conversion.convertedSignatures.size, 0);
}

test("captured type boundary failures do not publish an invented graph or mutate a populated arena", async () => {
  const actual = await captured("export type Flag=boolean;");
  const node = actual.raw.tree.statements.nodes[0].type;
  const row = actual.raw.types.types.find(candidate => candidate.authoredTypeNode?.node === node.id);
  assert.equal(row !== undefined, true);
  const unavailable = { kind: "unavailable", reason: "not-provided", causes: [] };
  for (const [replacement, pattern] of [
    [undefined, /raw type must name its captured form/u],
    [{ ...row, form: unavailable }, /actual captured component\/error association/u],
    [{ ...row, literal: unavailable }, /actual captured literal association/u],
    [{ ...row, literal: { kind: "available", value: { kind: "absence", spelling: "null" } } }, /checked literal conversion of absence/u],
    [{ ...row, form: { kind: "available", value: { kind: "array", readonly: false, element: row.id } } }, /checker type form array/u],
    [{ ...row, form: { kind: "available", value: { kind: "union", members: [undefined] } } }, /composite type cannot lose a member/u],
    [{ ...row, component: actual.raw.types.components.length }, /actual captured type and component/u],
  ]) {
    const types = [...actual.raw.types.types];
    types[row.id] = replacement;
    rejects(actual, { ...actual.raw, types: { ...actual.raw.types, types } }, { kind: "type", id: row.id }, pattern);
  }
  rejects(actual, actual.raw, { kind: "type", id: row.id }, /actual containing body/u, new Map());
});

test("captured structure inventory failures retain their original boundary before any graph publication", async () => {
  const actual = await captured("export type Shape={flag:boolean;[key:string]:boolean};");
  const node = actual.raw.tree.statements.nodes[0].type;
  const row = actual.raw.types.types.find(candidate => candidate.authoredTypeNode?.node === node.id);
  assert.equal(row.form.value.kind, "structure");
  const inventory = actual.raw.types.members[row.form.value.inventory];
  const unavailable = { kind: "unavailable", reason: "not-provided", causes: [] };
  for (const [replacement, pattern] of [
    [undefined, /captured member inventory/u],
    [{ ...inventory, members: [undefined] }, /member inventory must retain every actual row/u],
    [{ ...inventory, members: [{ ...inventory.members[0], read: unavailable }] }, /member conversion requires its actual captured type association/u],
    [{ ...inventory, indexes: [undefined] }, /index inventory must retain every actual row/u],
  ]) {
    const members = [...actual.raw.types.members];
    members[inventory.id] = replacement;
    rejects(actual, { ...actual.raw, types: { ...actual.raw.types, members } }, { kind: "type", id: row.id }, pattern);
  }
});

test("captured callable boundary failures cannot become a signature or a partial type graph", async () => {
  const actual = await captured("export function value(input:boolean):boolean{return input;}");
  const signature = actual.raw.types.signatures.find(candidate => candidate.parameters.length === 1
    && candidate.declaration?.node === actual.raw.tree.statements.nodes[0].id);
  assert.equal(signature !== undefined, true);
  const unavailable = { kind: "unavailable", reason: "not-provided", causes: [] };
  for (const [replacement, pattern] of [
    [undefined, /callable inventory must name its captured signature/u],
    [{ ...signature, result: unavailable }, /unavailable callable result/u],
    [{ ...signature, parameters: [undefined] }, /captured parameter inventory must be dense/u],
    [{ ...signature, typeParameters: unavailable }, /generic or receiver-bearing/u],
    [{ ...signature, receiver: unavailable }, /generic or receiver-bearing/u],
    [{ ...signature, composition: { kind: "union", signatures: [signature.id] } }, /composed callable signature/u],
    [{ ...signature, declaration: null }, /declarationless callable signature/u],
    [{ ...signature, parameters: [{ ...signature.parameters[0], declaration: null }] }, /declarationless callable parameter/u],
    [{ ...signature, parameters: [{ ...signature.parameters[0], kind: "variadic" }] }, /variadic callable parameter/u],
    [{ ...signature, parameters: [{ ...signature.parameters[0], passing: unavailable }] }, /captured passing mode is unavailable/u],
  ]) {
    const signatures = [...actual.raw.types.signatures];
    signatures[signature.id] = replacement;
    rejects(actual, { ...actual.raw, types: { ...actual.raw.types, signatures } }, { kind: "signature", id: signature.id }, pattern);
  }
});

test("a foreign captured component cannot borrow the current module's same-numbered body node", async () => {
  const source = "export type Flag=boolean;";
  const actual = await captured(source, { "main.ts": source, "other.ts": source });
  const module = actual.fixture.moduleOf(actual.fixture.packageOf("/project"), "src/other.ts");
  const foreign = actual.fixture.front.captureModule(actual.opened.deps, actual.opened.program, module);
  assert.equal(foreign.kind, "ok");
  const node = actual.raw.tree.statements.nodes[0].type;
  const row = actual.raw.types.types.find(candidate => candidate.authoredTypeNode?.node === node.id);
  const foreignRow = foreign.value.types.types.find(candidate => candidate.authoredTypeNode?.node === node.id);
  const component = actual.raw.types.components[row.component];
  const foreignComponent = foreign.value.types.components[foreignRow.component];
  assert.equal(component.root.node, foreignComponent.root.node);
  assert.notEqual(component.root.module, foreignComponent.root.module);
  const components = [...actual.raw.types.components];
  components[row.component] = foreignComponent;
  rejects(actual, { ...actual.raw, types: { ...actual.raw.types, components } }, { kind: "type", id: row.id },
    /foreign type component requires its actual qualified body association/u);
});
