import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

async function capture(source) {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": source },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const opened = fixture.openAndCapture(snapshot);
  const module = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const captured = fixture.front.captureModule(opened.deps, opened.program, module);
  assert.equal(captured.kind, "ok", "actual SDK capture completes");
  const identified = fixture.front.lowerModuleDefinitions(captured.value);
  assert.equal(identified.kind, "ok", "actual F1 declaration inventory completes");
  return { fixture, source, raw: captured.value, definitions: identified.value };
}

test("actual alias and nested mapped parameter references retain only their genuine F1 declarations", async () => {
  const { fixture, raw, definitions } = await capture(
    "export type Alias<T> = { [K in string]: T | K | { [K in string]: K } };\n");
  const parameters = definitions.rows.filter(row => row.kind === "TypeParameter");
  assert.equal(parameters.length, 3);
  assert.equal(new Set(parameters.map(row => row.definition)).size, 3);
  assert.equal(definitions.rows.some(row => row.kind === "MappedType"), false, "mapped syntax never gains a fabricated F1 binder");
  const byNode = new Map(parameters.map(row => [row.node, row.definition]));
  const forms = raw.types.types.filter(row => row.form.kind === "available" && row.form.value.kind === "parameter")
    .map(row => row.form.value);
  const observed = new Set();
  for (const form of forms) {
    assert.deepEqual(Object.keys(form).sort(), ["constraint", "default", "kind", "parameter"]);
    assert.equal(form.parameter.module, raw.module);
    assert.equal(byNode.has(form.parameter.node), true, "every actual checker parameter selects its genuine source declaration");
    observed.add(byNode.get(form.parameter.node));
  }
  assert.equal(observed.size, 3, "the actual outer and both nested K answers retain distinct declarations");
  const paths = parameters.map(row => fixture.ids.decodeDefId(row.definition));
  assert.equal(paths.every(path => path.kind === "decoded"), true);
  assert.deepEqual(paths.map(path => path.value.segments.at(-1)), [
    { name: "T", ordinal: 0 }, { name: "K", ordinal: 0 }, { name: "K", ordinal: 1 },
  ]);
});

test("actual checked generic formals and converted parameter types share the same F1 declaration", async () => {
  const { fixture, source, raw, definitions } = await capture("export interface Box<T> { (value: T): T; }\n");
  const interner = fixture.types.createTypeInterner();
  const deps = fixture.lowerDepsFor(definitions, interner, source);
  const exported = fixture.front.lowerModuleExports(deps, raw);
  assert.equal(exported.kind, "ok");
  const checked = fixture.front.lowerModule({ ...deps, exportsOf: module => module === raw.module ? exported.value : null }, raw);
  assert.equal(checked.kind, "ok");
  const declaration = definitions.rows.find(row => row.kind === "TypeParameter");
  assert.notEqual(declaration, undefined);
  const box = checked.value.tree.statements.nodes[0];
  assert.equal(box.kind, "InterfaceDeclaration");
  assert.deepEqual(box.typeParameters.nodes[0].tsonic.parameter,
    { declaration: declaration.definition, constraint: null, default: null });
  const parameters = fixture.types.viewTypes(interner).terms.filter(term => term.kind === "param");
  assert.deepEqual(parameters, [{ kind: "param", parameter: declaration.definition }]);
  assert.throws(() => fixture.front.lowerModule({ ...deps,
    definitionOf: reference => {
      assert.notEqual(reference.node, declaration.node, "missing genuine parameter declaration is not an owner/index fallback");
      return deps.definitionOf(reference);
    }, exportsOf: module => module === raw.module ? exported.value : null }, raw), /missing genuine parameter declaration/u);
});
