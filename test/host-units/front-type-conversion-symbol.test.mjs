import assert from "node:assert/strict";
import { test } from "node:test";
import { captureSingleModule, identifySingleModule, loadFrontFixture } from "./fixtures/front/checked-module.mjs";

test("a real raw unique-symbol graph retains its exact F1 declaration independently of checked TypeOperator support", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const source = "declare const key:unique symbol;export function read(){return key;}";
  const opened = fixture.openAndCapture(fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] }));
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const captured = captureSingleModule(fixture.front, opened.deps, opened.program, module);
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const definitions = identifySingleModule(fixture.front, { module: raw, componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === raw.module) });
  assert.equal(definitions.kind, "ok");
  const row = raw.types.types.find(candidate => candidate.literal.kind === "available" && candidate.literal.value?.kind === "symbol");
  assert.equal(row !== undefined, true);
  const declaration = row.literal.value.declaration;
  const actualDeclaration = definitions.value.rows.find(candidate => candidate.node === declaration.node);
  assert.equal(actualDeclaration?.kind, "VariableDeclaration");
  assert.equal(declaration.module, module);
  const component = raw.types.components[row.component];
  assert.equal(component.root.module, module);
  const types = fixture.types.createTypeInterner();
  const deps = fixture.lowerDepsFor(definitions.value, types, source);
  const { createTypeConversion, convertRawType } = await import("../../packages/host/dist/front/type-conversion.js");
  const conversion = createTypeConversion(deps, raw);
  const result = convertRawType(conversion, row.id);
  assert.equal(result.kind, "complete");
  const term = fixture.types.readType(types, result.value.type);
  assert.equal(term.kind, "literal");
  assert.deepEqual(term.value, { kind: "unique-symbol", declaration: actualDeclaration.definition });
  assert.deepEqual(fixture.types.readType(types, term.base), { kind: "intrinsic", intrinsic: "symbol" });
  assert.deepEqual(result.value.evidence.component, deps.sourceOccurrenceOf(component.root).occurrence);
  const prefix = fixture.types.viewTypes(types);
  const previous = [...prefix.terms];
  const failure = new TypeError("the actual unique-symbol declaration has no ready F1 association");
  const missing = createTypeConversion({ ...deps, definitionOf: reference => {
    if (reference.module === declaration.module && reference.node === declaration.node) throw failure;
    return deps.definitionOf(reference);
  } }, raw);
  assert.throws(() => convertRawType(missing, row.id), error => error === failure);
  assert.equal(fixture.types.viewTypes(types) === prefix, true);
  assert.equal(prefix.terms.length, previous.length);
  assert.equal(prefix.terms.every((term, position) => term === previous[position]), true);
  assert.equal(missing.convertedTypes.size, 0);
  assert.equal(missing.convertedSignatures.size, 0);
});

test("an actual ordinary symbol never gains a unique declaration literal", async () => {
  const fixture = await loadFrontFixture();
  const source = "declare let key:symbol;export function read(){return key;}";
  const opened = fixture.openedModule(source);
  const captured = captureSingleModule(fixture.front, opened.deps, opened.program, opened.module);
  assert.equal(captured.kind, "ok");
  const raw = captured.value;
  const identified = identifySingleModule(fixture.front, { module: raw,
    componentRoots: raw.types.components.map(component => component.root).filter(root => root.module === raw.module) });
  assert.equal(identified.kind, "ok");
  const rows = raw.types.types.filter(row => row.form.kind === "available" && row.form.value.kind === "scalar" && row.form.value.scalar === "symbol");
  assert.equal(rows.length > 0, true);
  assert.equal(raw.types.types.some(row => row.literal.kind === "available" && row.literal.value?.kind === "symbol"), false);
  const types = fixture.types.createTypeInterner();
  const deps = fixture.lowerDepsFor(identified.value, types, source);
  const { createTypeConversion, convertRawType } = await import("../../packages/host/dist/front/type-conversion.js");
  const conversion = createTypeConversion(deps, raw);
  for (const row of rows) {
    assert.deepEqual(row.literal, { kind: "available", value: null });
    const result = convertRawType(conversion, row.id);
    assert.equal(result.kind, "complete");
    assert.deepEqual(fixture.types.readType(types, result.value.type), { kind: "intrinsic", intrinsic: "symbol" });
  }
});
