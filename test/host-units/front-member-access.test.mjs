import assert from "node:assert/strict";
import { test } from "node:test";
import { lowerSingleCheckedModule, captureSingleModule, identifySingleModule, loadFrontFixture } from "./fixtures/front/checked-module.mjs";

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
    const exports = fixture.front.lowerModuleExports(deps, raw);
    assert.equal(exports.kind, "ok");
    const checked = lowerSingleCheckedModule(fixture.front, { ...deps, exportsOf: owner => owner === module ? exports.value : null }, raw);
    assert.equal(checked.kind, "ok");
    return { checked: checked.value, interner };
  };
  return { fixture, raw: result.value, definitions: definitions.value, lower };
}

const source = "export type Box={flag:boolean};export function read(box:Box):boolean{return box.flag;}\n";

test("actual SDK selected property reads retain their exact receiver, member arm and qualified declaration origins", async () => {
  const { fixture, raw, definitions, lower } = await captured(source);
  assert.equal(raw.memberUses.length, 1);
  const use = raw.memberUses[0];
  const call = raw.tree.statements.nodes[1];
  const access = call.body.statements.nodes[0].expression;
  assert.equal(access.kind, "PropertyAccessExpression");
  assert.deepEqual(use.occurrence, { module: raw.module, node: access.id });
  assert.deepEqual(use.receiver, { module: raw.module, node: access.expression.id });
  assert.equal(use.access, "read");
  assert.equal(use.callCallee, false);
  assert.equal(use.optionalChain, false);
  assert.equal(use.chainContinuation, false);
  assert.equal(use.write, null);
  assert.deepEqual(use.writeDeclarations, []);
  assert.equal(use.arms.length, 1);
  const arm = use.arms[0];
  assert.equal(arm.kind, "member");
  const member = arm.member;
  assert.equal(raw.types.types[use.receiverType].component, use.receiverComponent);
  assert.equal(use.selectedDeclarations, member.declarations);
  assert.equal(use.readDeclarations, arm.readDeclarations);
  assert.deepEqual(member.key, { kind: "text", value: "flag" });
  assert.equal(member.readonly, false, "the selected declaration can be written independently of this read");
  const declared = definitions.rows.find(row => row.kind === "PropertySignature");
  assert.equal(declared !== undefined, true);
  assert.deepEqual(use.selectedDeclaration, { module: raw.module, node: declared.node });
  assert.deepEqual(use.readDeclarations, [use.selectedDeclaration]);
  assert.deepEqual(raw.types.components[raw.types.types[use.read].component].root, use.occurrence);
  const { checked, interner } = lower();
  assert.equal(fixture.verifyChecked(checked, interner).length, 0);
  const actual = checked.tree.statements.nodes[1].body.statements.nodes[0].expression;
  assert.deepEqual(actual.tsonic.origins, { kind: "available", value: [{ kind: "declared", declaration: declared.definition }] });
  assert.equal(actual.name.tsonic.origins, actual.tsonic.origins);
  assert.deepEqual(actual.name.tsonic.key, { kind: "available", value: member.key });
  assert.deepEqual(actual.tsonic.accessor, { kind: "available", value: null });
});

test("selected property transport rejects foreign, missing and competing receiver or declaration associations", async () => {
  const { raw, lower } = await captured(source);
  const use = raw.memberUses[0];
  assert.equal(use !== undefined, true);
  const foreign = { ...use.receiver, node: use.occurrence.node };
  const wrongComponent = raw.types.types[use.read].component;
  assert.notEqual(wrongComponent, use.receiverComponent);
  for (const changed of [
    { receiver: foreign }, { access: "write" }, { optionalChain: true }, { chainContinuation: true }, { arms: [] },
    { read: null }, { write: use.read }, { writeDeclarations: use.readDeclarations }, { selectedDeclaration: foreign },
    { selectedDeclarations: [] }, { readDeclarations: [] },
    { readDeclarations: [foreign] }, { receiverType: use.read },
    { arms: [{ ...use.arms[0], member: { ...use.arms[0].member, declarations: [foreign] } }] },
    { arms: [{ ...use.arms[0], receiver: wrongComponent }] },
  ]) assert.throws(() => lower({ ...raw, memberUses: [{ ...use, ...changed }] }), /front:/u);
  assert.throws(() => lower({ ...raw, memberUses: [use, use] }), /unique syntax order/u);
  assert.throws(() => lower({ ...raw, memberUses: [{ ...use, occurrence: { module: raw.module, node: raw.tree.id } }, use] }),
    /member use.*actual selected syntax/u);
  const missing = lower({ ...raw, memberUses: [] }).checked.tree.statements.nodes[1].body.statements.nodes[0].expression;
  assert.deepEqual(missing.tsonic.origins, { kind: "unavailable", reason: "not-provided", causes: [] });
  assert.equal(missing.name.tsonic.key.kind, "unavailable");
});

test("nominal property selection keeps the named receiver and borrows only its actual member declaration", async () => {
  const { fixture, raw, definitions, lower } = await captured(
    "export interface Header { tag:boolean; payload:boolean };"
      + "export function read(value:Header):boolean{return value.payload;}");
  const [use] = raw.memberUses;
  const receiver = raw.types.types[use.receiverType];
  const header = raw.tree.statements.nodes[0];
  const payload = header.members.nodes[1];
  assert.deepEqual(receiver.form.value.declaration, { module: raw.module, node: header.id });
  assert.equal(receiver.form.value.kind, "declared");
  assert.equal(raw.types.members.some(table => table.component === use.receiverComponent), false);
  assert.deepEqual(use.selectedDeclarations, [{ module: raw.module, node: payload.id }]);
  const { checked, interner } = lower();
  assert.deepEqual(fixture.verifyChecked(checked, interner), []);
  const access = checked.tree.statements.nodes.find(node => node.kind === "FunctionDeclaration").body.statements.nodes[0].expression;
  const definition = definitions.rows.find(row => row.node === payload.id).definition;
  assert.deepEqual(access.tsonic.origins, { kind: "available", value: [{ kind: "declared", declaration: definition }] });
  assert.deepEqual(access.name.tsonic.key, { kind: "available", value: { kind: "text", value: "payload" } });
});

test("authored function and constructor types publish their own annotations without creating executions", async () => {
  const { fixture, raw, definitions, lower } = await captured(
    "export type Predicate<T> = (input: T) => boolean;"
      + "export type Factory = new (flag: boolean) => {flag: boolean};");
  const { checked, interner } = lower();
  assert.deepEqual(fixture.verifyChecked(checked, interner), []);
  assert.equal(checked.bodies.length, 1);
  const text = fixture.hir.printHir(checked);
  const decoded = fixture.hir.parseHir(text);
  assert.equal(decoded.kind, "parsed");
  assert.equal(fixture.hir.printHir(decoded.value), text);
  for (const [position, family] of ["calls", "constructs"].entries()) {
    const original = raw.tree.statements.nodes[position].type;
    const actual = checked.tree.statements.nodes[position].type;
    const definition = definitions.rows.find(row => row.node === original.id).definition;
    const type = fixture.types.readType(interner, actual.tsonic.type.value);
    assert.equal(type.kind, "callable");
    assert.equal(type[family].length, 1);
    const signature = fixture.types.readSignature(interner, type[family][0]);
    assert.equal(signature.declaration, definition);
    assert.equal(actual.parameters.nodes[0].tsonic.parent, definition);
    assert.equal(actual.parameters.nodes[0].tsonic.initializer, null);
    assert.equal(decoded.value.tree.statements.nodes[position].type.tsonic.definition, definition);
  }
});

test("a selected native property write captures its own type and exact receiver without an implicit read", async () => {
  const { fixture, raw, lower } = await captured("export type Box={flag:boolean};export function write(box:Box,value:boolean):void { box.flag = value; }");
  const [use] = raw.memberUses;
  const assignment = raw.tree.statements.nodes[1].body.statements.nodes[0].expression;
  assert.deepEqual(use.occurrence, { module: raw.module, node: assignment.left.id });
  assert.deepEqual(use.receiver, { module: raw.module, node: assignment.left.expression.id });
  assert.equal(use.access, "write");
  assert.equal(use.read, null);
  assert.deepEqual(use.readDeclarations, []);
  assert.deepEqual(use.writeDeclarations, [use.selectedDeclaration]);
  assert.equal(use.writeDeclarations === use.arms[0].writeDeclarations, true);
  const write = raw.types.types[use.write];
  assert.equal(write.id, use.write);
  assert.equal(write.form.kind, "available");
  assert.deepEqual(raw.types.components[write.component].root, use.occurrence);
  const { checked, interner } = lower();
  assert.deepEqual(fixture.verifyChecked(checked, interner), []);
  const target = checked.tree.statements.nodes[1].body.statements.nodes[0].expression;
  const annotation = target.left.tsonic;
  assert.equal(annotation.role, "assignment-target");
  assert.equal(annotation.access, "write");
  assert.equal(target.tsonic.target === annotation.place, true);
  assert.deepEqual(annotation.place.value.base, { kind: "receiver", node: target.left.expression.id });
  assert.deepEqual(annotation.place.value.step, { kind: "member", key: annotation.origins.kind === "available"
    ? target.left.name.tsonic.key.value : assert.fail("the write has its actual qualified member key"), origins: annotation.origins.value });
  assert.deepEqual(annotation.place.value.read, { kind: "unavailable", reason: "not-provided", causes: [] });
  assert.deepEqual(fixture.types.readType(interner, annotation.place.value.write.value), { kind: "primitive", primitive: "bool" });

  const text = fixture.hir.printHir(checked);
  const decoded = fixture.hir.parseHir(text);
  assert.equal(decoded.kind, "parsed");
  assert.equal(fixture.hir.printHir(decoded.value), text);
  const copiedTarget = decoded.value.tree.statements.nodes[1].body.statements.nodes[0].expression;
  copiedTarget.left.tsonic.place.value.base = { kind: "receiver", node: copiedTarget.right.id };
  assert.equal(fixture.verifyChecked(decoded.value, interner).some(row => row.rule === "place-access-base-in-receiver"), true);
});

test("a declaration-only computed name never gains an executing property selection", async () => {
  const { raw, definitions } = await captured(
    "declare const names:{readonly key:unique symbol};export type Box={ [names.key]:boolean };\n");
  assert.equal(raw.memberUses.length, 0);
  const member = raw.tree.statements.nodes[1].type.members.nodes[0];
  const name = member.name;
  assert.equal(name.kind, "ComputedPropertyName");
  const key = raw.propertyNames.find(value => value.node.module === raw.module && value.node.node === name.id);
  assert.equal(key !== undefined, true);
  assert.equal(key.selected.kind, "available");
  assert.equal(key.selected.value.kind, "symbol");
  assert.equal(definitions.rows.some(row => row.node === member.id && row.kind === "PropertySignature"), true);
});

test("equal property spellings retain distinct actual selected declarations and reject crossed member arms", async () => {
  const { fixture, raw, definitions, lower } = await captured(
    "export type Left={flag:boolean};export type Right={flag:boolean};"
    + "export function readLeft(input:Left):boolean{return input.flag;}"
    + "export function readRight(input:Right):boolean{return input.flag;}\n");
  assert.equal(raw.memberUses.length, 2);
  const [left, right] = raw.memberUses;
  assert.notDeepEqual(left.occurrence, right.occurrence);
  assert.notDeepEqual(left.receiver, right.receiver);
  assert.notDeepEqual(left.selectedDeclaration, right.selectedDeclaration);
  const properties = raw.tree.statements.nodes.slice(0, 2).map(node => node.type.members.nodes[0]);
  const selectedDefinitions = properties.map(property => definitions.rows.find(row => row.node === property.id).definition);
  const { checked, interner } = lower();
  assert.equal(fixture.verifyChecked(checked, interner).length, 0);
  for (const [index, use] of raw.memberUses.entries()) {
    assert.deepEqual(use.selectedDeclaration, { module: raw.module, node: properties[index].id });
    const actual = checked.tree.statements.nodes[index + 2].body.statements.nodes[0].expression;
    assert.equal(actual.name.text, "flag");
    assert.deepEqual(actual.name.tsonic.key, { kind: "available", value: { kind: "text", value: "flag" } });
    assert.deepEqual(actual.tsonic.origins, { kind: "available", value: [{ kind: "declared", declaration: selectedDefinitions[index] }] });
  }
  assert.throws(() => lower({ ...raw, memberUses: [{ ...left, selectedDeclaration: right.selectedDeclaration }, right] }),
    /exact original declaration inventory/u);
  assert.throws(() => lower({ ...raw, memberUses: [{ ...left, arms: right.arms }, right] }),
    /actual selected member arm/u);
  assert.throws(() => lower({ ...raw, memberUses: [{ ...left, readDeclarations: right.readDeclarations }, right] }),
    /exact selected receiver declarations/u);
});
