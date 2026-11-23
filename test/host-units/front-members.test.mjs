import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

test("actual global augmentation retains its original module keyword and genuine declaration identity", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "export {}; declare global { interface Extra {} }\n",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const captured = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(captured.kind, "ok");
  const declaration = captured.value.tree.statements.nodes.find(node => node.kind === "ModuleDeclaration");
  assert.equal(declaration !== undefined, true);
  assert.equal(declaration.keyword, "GlobalKeyword");
  const definitions = fixture.front.lowerModuleDefinitions({ module: captured.value,
    componentRoots: captured.value.types.components.map(component => component.root).filter(root => root.module === captured.value.module) });
  assert.equal(definitions.kind, "ok");
  assert.equal(definitions.value.rows.some(row => row.node === declaration.id && row.kind === "ModuleDeclaration"), true);
});

test("actual namespace-valued members retain their genuine module declaration origins", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "declare namespace Top { namespace Child { const value: boolean; } } export type Fields = typeof Top;\n",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const captured = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const definitions = fixture.front.lowerModuleDefinitions({ module: raw,
    componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === raw.module) });
  assert.equal(definitions.kind, "ok");
  const rows = new Map(definitions.value.rows.map(row => [row.node, row]));
  const child = raw.types.members.flatMap(table => table.members).find(member => member.name === "Child");
  assert.notEqual(child, undefined);
  assert.equal(child.origins.length > 0, true);
  assert.equal(child.origins.every(origin => origin.kind === "declaration"
    && rows.get(origin.declaration.node)?.kind === "ModuleDeclaration"), true);
  assert.equal(child.read.kind, "available");
  const form = raw.types.types[child.read.value].form;
  assert.equal(form.kind === "available" && form.value.kind === "structure", true);
  const value = raw.types.members[form.value.inventory].members.find(member => member.name === "value");
  assert.notEqual(value, undefined);
  assert.equal(value.read.kind, "available");
  assert.deepEqual(raw.types.types[value.read.value].form, { kind: "available", value: { kind: "scalar", scalar: "boolean" } });
});

test("actual declared structural members retain their genuine keys, origins and distinct accessor type components", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const source = "export type Fields = { plain: boolean; readonly frozen: string; method(value: boolean): boolean; get accessor(): boolean; set accessor(value: boolean | string); };\n";
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const result = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const definitions = fixture.front.lowerModuleDefinitions({ module: raw, componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === raw.module) });
  assert.equal(definitions.kind, "ok");
  const byNode = new Map(definitions.value.rows.map(row => [row.node, row]));
  const table = raw.types.members.find(table => table.members.length === 4);
  assert.notEqual(table, undefined);
  const members = new Map(table.members.map(member => [member.name, member]));
  assert.deepEqual([...members.keys()], ["plain", "frozen", "method", "accessor"]);
  const formOf = fact => {
    assert.equal(fact.kind, "available");
    assert.notEqual(fact.value, null);
    return raw.types.types[fact.value].form;
  };
  const plain = members.get("plain");
  assert.deepEqual(plain.key, { kind: "text", value: "plain" });
  assert.deepEqual(formOf(plain.read), { kind: "available", value: { kind: "scalar", scalar: "boolean" } });
  assert.deepEqual(formOf(plain.write), formOf(plain.read));
  assert.deepEqual(members.get("frozen").write, { kind: "available", value: null });
  assert.equal(members.get("frozen").readonly, true);
  assert.equal(members.get("method").readKind, "method");
  const accessor = members.get("accessor");
  assert.equal(accessor.readKind, "accessor");
  assert.equal(accessor.getters.length, 1);
  assert.equal(accessor.setters.length, 1);
  assert.deepEqual(formOf(accessor.read), { kind: "available", value: { kind: "scalar", scalar: "boolean" } });
  assert.equal(formOf(accessor.write).value.kind, "union");
  for (const member of table.members) for (const origin of member.origins) {
    assert.equal(origin.kind, "declaration");
    assert.equal(origin.declaration.module, module);
    assert.equal(byNode.has(origin.declaration.node), true, "each actual origin retains genuine same-module F1 identity");
  }
  for (const [access, declaration] of [["read", accessor.getters[0]], ["write", accessor.setters[0]]]) {
    const row = raw.types.types[accessor[access].value];
    assert.deepEqual(raw.types.components[row.component].path?.step, { kind: "member", declaration, access });
  }
});

test("actual overloaded, readonly and nonidentifier member keys retain every selected declaration without invented origins", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const source = 'declare const key: unique symbol; export type Fields = { readonly [key]: boolean; 1: string; "": boolean; run(value: boolean): boolean; run(value: boolean, extra: boolean): boolean; get only(): boolean; };\n';
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const result = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(result.kind, "ok");
  const raw = result.value;
  const identified = fixture.front.lowerModuleDefinitions({ module: raw, componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === raw.module) });
  assert.equal(identified.kind, "ok");
  const definitions = new Map(identified.value.rows.map(row => [row.node, row]));
  const table = raw.types.members.find(table => table.members.length === 5);
  assert.equal(table !== undefined, true);
  const symbolic = table.members.find(member => member.key.kind === "symbol");
  assert.equal(symbolic !== undefined, true);
  assert.equal(symbolic.key.declaration.module, module);
  assert.equal(definitions.get(symbolic.key.declaration.node)?.kind, "VariableDeclaration");
  assert.equal(symbolic.readonly, true);
  assert.deepEqual(symbolic.write, { kind: "available", value: null });
  assert.deepEqual(symbolic.origins.map(origin => origin.access), ["read"]);
  const numeric = table.members.find(member => member.key.kind === "numeric");
  assert.equal(numeric !== undefined, true);
  assert.deepEqual(numeric.key.value, { kind: "checker-value", value: 1 });
  assert.equal(table.members.some(member => member.key.kind === "text" && member.key.value === ""), true);
  const method = table.members.find(member => member.name === "run");
  assert.equal(method !== undefined, true);
  assert.equal(method.declarations.length, 2);
  assert.equal(new Set(method.declarations.map(declaration => declaration.node)).size, 2);
  assert.equal(method.origins.length, 4);
  for (const declaration of method.declarations) {
    assert.equal(definitions.get(declaration.node)?.kind, "MethodSignature");
    assert.deepEqual(method.origins.filter(origin => origin.declaration.node === declaration.node)
      .map(origin => origin.access), ["read", "write"]);
  }
  const getter = table.members.find(member => member.name === "only");
  assert.equal(getter !== undefined, true);
  assert.equal(getter.getters.length, 1);
  assert.equal(getter.setters.length, 0);
  assert.equal(getter.readonly, true);
  assert.deepEqual(getter.write, { kind: "available", value: null });
  assert.deepEqual(getter.origins.map(origin => origin.access), ["read"]);
  for (const member of table.members) for (const origin of member.origins) {
    assert.equal(origin.kind, "declaration");
    assert.equal(origin.declaration.module, module);
    assert.equal(definitions.has(origin.declaration.node), true);
  }
});
