import assert from "node:assert/strict";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { createModuleBindingViews, projectExportDeclarations, resolveModuleBinding } from "../../packages/host/dist/ir-hir/index.js";
import { encodeBodyId, encodeDefId, encodeModuleId, encodePackageId, nodeId } from "../../packages/host/dist/ids/index.js";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { moduleFixture } from "./ir-program-fixtures.mjs";
import { parseProgramIndex, printProgramIndex } from "../../packages/host/dist/ir-program/index.js";

const module = encodeModuleId({ package: encodePackageId("/bindings"), path: "source.ts" });
const owner = encodeDefId({ module, segments: [] });
const definition = encodeDefId({ module, segments: [{ name: "value", ordinal: 0 }] });
const another = encodeDefId({ module, segments: [{ name: "value", ordinal: 1 }] });
const body = encodeBodyId({ owner, role: "module", ordinal: 0 });
const item = node => ({ kind: "item", value: { owner, node: nodeId(node) } });
const executing = node => ({ kind: "body", value: { body, node: nodeId(node) } });
const available = value => ({ kind: "available", value });

function views(rows) {
  let reads = 0;
  const actual = createModuleBindingViews([rows]);
  return {
    reads: () => reads,
    bindingOf: occurrence => {
      reads += 1;
      return actual.bindingOf(occurrence);
    },
  };
}

test("qualified binding edges retain the complete declaration group and nearest occurrence order", () => {
  const first = item(1);
  const second = item(2);
  const third = executing(2);
  const target = { kind: "declarations", definitions: [definition, another] };
  const rows = views([
    { occurrence: first, target: available({ kind: "binding", occurrence: second }) },
    { occurrence: second, target: available({ kind: "binding", occurrence: third }) },
    { occurrence: third, target: available(target) },
  ]);
  const result = resolveModuleBinding(rows, structuredClone(first));
  assert.equal(result.target.kind, "available");
  assert.equal(result.target.value === target, true);
  assert.deepEqual(result.aliases, [first, second, third]);
  assert.equal(result.cycle, null);
  assert.equal(rows.reads(), 3);
});

test("the one ready relation rejects duplicate ownership and walks long actual chains once per edge", () => {
  const row = { occurrence: item(1), target: available({ kind: "module", module }) };
  assert.equal(createModuleBindingViews([]).bindingOf(row.occurrence), null);
  assert.throws(() => createModuleBindingViews([[row], [structuredClone(row)]]));
  assert.throws(() => createModuleBindingViews([[{ ...row, occurrence: { kind: "item", value: { owner, node: -0 } } }]]));
  for (const count of [1, 16, 64, 256]) {
    const rows = Array.from({ length: count }, (_, index) => ({ occurrence: item(index),
      target: available(index + 1 === count ? { kind: "declarations", definitions: [definition] } : { kind: "binding", occurrence: item(index + 1) }) }));
    const relation = views(rows);
    const result = resolveModuleBinding(relation, rows[0].occurrence);
    assert.equal(result.target.value.kind, "declarations");
    assert.equal(result.aliases.length, count);
    assert.equal(relation.reads(), count);
  }
});

test("an export's genuine syntax declaration requires the exact F1 owner and node join", () => {
  const occurrence = { kind: "item", value: { owner: definition, node: nodeId(7) } };
  const entry = { name: "namespace", target: { kind: "binding", occurrence } };
  const relation = createModuleBindingViews([[{ occurrence, target: available({ kind: "module", module }) }]]);
  const genuine = projectExportDeclarations({ ...relation, declarationSourceOf: actual => actual === definition ? structuredClone(occurrence) : null }, entry);
  assert.deepEqual(genuine.target, available({ kind: "declarations", definitions: [definition] }));
  assert.deepEqual(resolveModuleBinding(relation, occurrence).target, available({ kind: "module", module }));
  for (const declaration of [null, { ...occurrence, value: { owner: definition, node: nodeId(6) } },
    { ...occurrence, value: { owner: another, node: nodeId(7) } }, executing(7)]) {
    const projected = projectExportDeclarations({ ...relation, declarationSourceOf: () => declaration }, entry);
    assert.deepEqual(projected.target, available({ kind: "module", module }));
    assert.deepEqual(projected.aliases, [occurrence]);
  }
  const direct = { name: "overload", target: { kind: "declarations", definitions: [definition, another] } };
  assert.equal(projectExportDeclarations({ ...relation, declarationSourceOf: () => assert.fail("a direct group does not need a binding lookup") }, direct).target.value === direct.target, true);
});

test("module and exported-value-member targets never become a chosen declaration", () => {
  const occurrence = item(1);
  const origin = { kind: "declared", declaration: definition };
  for (const target of [{ kind: "module", module },
    { kind: "member", through: { kind: "declarations", definitions: [definition] }, key: available({ kind: "text", value: "property" }), origins: available([origin]) }]) {
    const result = resolveModuleBinding(views([{ occurrence, target: available(target) }]), occurrence);
    assert.equal(result.target.kind, "available");
    assert.equal(result.target.value === target, true);
    assert.deepEqual(result.aliases, [occurrence]);
    assert.equal(result.cycle, null);
  }
});

test("an actual unresolved checker root retains its original qualified diagnostic references", () => {
  const occurrence = item(1);
  const diagnostics = [{ module, index: 7 }, { module, index: 8 }];
  const target = { kind: "unresolved", diagnostics };
  const result = resolveModuleBinding(views([{ occurrence, target: available(target) }]), occurrence);
  assert.equal(result.target.value === target, true);
  assert.equal(result.target.value.diagnostics === diagnostics, true);
  assert.equal(result.cycle, null);
});

test("missing evidence preserves its availability reason without inventing a diagnostic or absence", () => {
  const occurrence = item(1);
  for (const reason of ["checker-error", "parameter-dependent", "not-provided", "missing-original-component", "incomplete-association", "unsupported-checked-structure"]) {
    const target = { kind: "unavailable", reason };
    const result = resolveModuleBinding(views([{ occurrence, target }]), occurrence);
    assert.equal(result.target === target, true);
    assert.equal(result.cycle, null);
    assert.deepEqual(result.aliases, [occurrence]);
  }
});

test("an alias cycle retains its actual edge boundary without inventing an error root", () => {
  const first = item(1);
  const second = item(2);
  const rows = views([
    { occurrence: first, target: available({ kind: "binding", occurrence: second }) },
    { occurrence: second, target: available({ kind: "binding", occurrence: structuredClone(first) }) },
  ]);
  const result = resolveModuleBinding(rows, first);
  assert.deepEqual(result.target, { kind: "unavailable", reason: "incomplete-association" });
  assert.deepEqual(result.aliases, [first, second]);
  assert.deepEqual(result.cycle, first);
  assert.equal(rows.reads(), 2);
});

test("qualification prevents equal syntax ordinals in different owners from closing a false cycle", () => {
  const first = item(1);
  const second = { kind: "item", value: { owner: definition, node: nodeId(1) } };
  const target = { kind: "declarations", definitions: [definition] };
  const result = resolveModuleBinding(views([
    { occurrence: first, target: available({ kind: "binding", occurrence: second }) },
    { occurrence: second, target: available(target) },
  ]), first);
  assert.equal(result.target.value === target, true);
  assert.equal(result.cycle, null);
  assert.deepEqual(result.aliases, [first, second]);
});

test("a ready relation rejects an absent or differently qualified binding row", () => {
  const occurrence = item(1);
  assert.throws(() => resolveModuleBinding({ bindingOf: () => null }, occurrence));
  for (const [requested, wrong] of [[occurrence, item(2)], [occurrence, executing(1)],
    [occurrence, { kind: "item", value: { owner: definition, node: nodeId(1) } }],
    [executing(1), { kind: "body", value: { body: encodeBodyId({ owner: definition, role: "function", ordinal: 0 }), node: nodeId(1) } }]]) {
    assert.throws(() => resolveModuleBinding({ bindingOf: () => ({ occurrence: wrong, target: available({ kind: "module", module }) }) }, requested));
  }
});

test("invalid syntax ordinals are rejected before reading the nearest relation", () => {
  for (const node of [-0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    let reads = 0;
    assert.throws(() => resolveModuleBinding({ bindingOf: () => { reads += 1; return null; } }, { kind: "item", value: { owner, node } }));
    assert.equal(reads, 0);
  }
});

test("real B1 capture retains local aliases as binding occurrences without fabricated definitions", async () => {
  const fixture = await loadFrontFixture();
  const source = "function add(a:number,b:number):number { return a+b; } export { add, add as sum };";
  const opened = fixture.openedModule(source);
  const captured = fixture.front.captureModule(opened.deps, opened.program, opened.module);
  assert.equal(captured.kind, "ok");
  const definitions = fixture.front.lowerModuleDefinitions(captured.value);
  assert.equal(definitions.kind, "ok");
  assert.equal(definitions.value.bindingSources.length, 2);
  const bindingNodes = new Set(definitions.value.bindingSources.map(row => row.node));
  assert.equal(definitions.value.rows.some(row => bindingNodes.has(row.node)), false);
  const deps = fixture.lowerDepsFor(definitions.value, fixture.types.createTypeInterner(), source);
  const lowered = fixture.front.lowerModuleExports(deps, captured.value);
  assert.equal(lowered.kind, "ok");
  assert.deepEqual(lowered.value.entries.map(entry => [entry.name, entry.target.kind]), [["add", "binding"], ["sum", "binding"]]);
  const actual = definitions.value.rows.find(row => row.kind === "FunctionDeclaration").definition;
  const inventory = views(lowered.value.bindings);
  for (const entry of lowered.value.entries) {
    const result = fixture.hir.resolveModuleBinding(inventory, entry.target.occurrence);
    assert.deepEqual(result.target, available({ kind: "declarations", definitions: [actual] }));
    assert.equal(result.aliases.length, 1);
    assert.equal(result.aliases[0].value.owner, ownerOf(definitions.value));
  }
});

function ownerOf(definitions) {
  return definitions.rows.find(row => row.kind === "SourceFile").definition;
}

test("real checked aliases use the same B1 inventories through HIR and Program text transport", async () => {
  const fixture = await loadFrontFixture();
  const source = "function add(a:number,b:number):number { return a+b; } export { add, add as sum };";
  const actual = fixture.checkedModuleOf(source);
  assert.deepEqual(fixture.verifyChecked(actual.checked, actual.interner), []);
  assert.equal(actual.checked.exports === actual.exports.entries, true, "checked exports retain the actual ready B1 inventory");
  assert.equal(actual.checked.bindings === actual.exports.bindings, true, "checked bindings retain the actual nearest rows");
  const text = fixture.hir.printHir(actual.checked);
  const parsed = fixture.hir.parseHir(text);
  assert.equal(parsed.kind, "parsed");
  assert.equal(isDeepStrictEqual(parsed.value, actual.checked), true, "HIR preserves complete binding targets and occurrence ownership");
  const program = moduleFixture();
  program.index.modules = [{ module: actual.module, package: program.index.rootPackage, items: actual.checked.items,
    exports: actual.checked.exports, bindings: actual.checked.bindings, checkerDiagnostics: actual.checked.checkerDiagnostics }];
  const programText = printProgramIndex(program.index);
  const received = parseProgramIndex(programText);
  assert.equal(received.kind, "parsed");
  assert.equal(isDeepStrictEqual(received.value.modules, program.index.modules), true, "Program carries the same qualified relation");
  const empty = structuredClone(actual.checked);
  empty.exports[0].target = { kind: "declarations", definitions: [] };
  assert.equal(fixture.hir.parseHir(fixture.hir.printHir(empty)).kind, "invalid-text", "empty declaration groups are not a replacement binding form");
  program.index.modules[0].exports = empty.exports;
  assert.equal(parseProgramIndex(printProgramIndex(program.index)).kind, "invalid-text", "Program rejects the same removed empty form");
  const missing = structuredClone(actual.checked);
  missing.bindings = [];
  assert.equal(fixture.verifyChecked(missing, actual.interner).some(violation => violation.rule === "binding-capture-owner"), true,
    "checked aliases cannot lose their canonical nearest rows");
  const duplicate = structuredClone(actual.checked);
  duplicate.bindings.push(structuredClone(duplicate.bindings[0]));
  assert.equal(fixture.verifyChecked(duplicate, actual.interner).some(violation => violation.rule === "binding-capture-owner"), true,
    "duplicate qualified binding ownership is a violation rather than a chosen row");
});

test("real raw B1 direct overload inventory retains every declaration in canonical syntax order", async () => {
  const fixture = await loadFrontFixture();
  const source = "export function over(a:number):number; export function over(a:string):string; export function over(a:any):any { return a; }";
  const opened = fixture.openedModule(source);
  const captured = fixture.front.captureModule(opened.deps, opened.program, opened.module);
  assert.equal(captured.kind, "ok");
  const definitions = fixture.front.lowerModuleDefinitions(captured.value);
  assert.equal(definitions.kind, "ok");
  const expected = definitions.value.rows.filter(row => row.kind === "FunctionDeclaration").map(row => row.definition);
  assert.equal(expected.length, 3);
  const deps = fixture.lowerDepsFor(definitions.value, fixture.types.createTypeInterner(), source);
  const lowered = fixture.front.lowerModuleExports(deps, captured.value);
  assert.deepEqual(lowered, { kind: "ok", diagnostics: [], value: { module: opened.module,
    entries: [{ name: "over", target: { kind: "declarations", definitions: expected } }], bindings: [] } });
});

test("real B1 cross-module aliases retain every nearest binding hop and star/module targets", async () => {
  const fixture = await loadFrontFixture();
  const sourceFiles = {
    "a.ts": "export function add(a:number,b:number):number { return a+b; }",
    "b.ts": 'export { add as middle } from "./a.js";',
    "c.ts": 'import { middle as local } from "./b.js"; export { local as final };',
    "star.ts": 'export * from "./a.js";',
    "namespace.ts": 'export * as names from "./a.js";',
  };
  const snapshot = fixture.projectSnapshot({ sourceFiles, libraries: fixture.bundled() });
  const opened = fixture.openAndCapture(snapshot);
  const captured = [];
  const definitions = new Map();
  const bindings = new Map();
  const sourceModules = new Map();
  for (const [name, text] of Object.entries(sourceFiles)) {
    const identity = fixture.moduleOf(fixture.packageOf("/project"), `src/${name}`);
    sourceModules.set(name, identity);
    const raw = fixture.front.captureModule(opened.deps, opened.program, identity);
    assert.equal(raw.kind, "ok");
    const inventory = fixture.front.lowerModuleDefinitions(raw.value);
    assert.equal(inventory.kind, "ok");
    definitions.set(identity, new Map(inventory.value.rows.map(row => [row.node, row.definition])));
    bindings.set(identity, new Map(inventory.value.bindingSources.map(row => [row.node, row.occurrence])));
    captured.push({ raw: raw.value, inventory: inventory.value, text });
  }
  const first = captured[0];
  const deps = { ...fixture.lowerDepsFor(first.inventory, fixture.types.createTypeInterner(), first.text),
    definitionOf: reference => {
      const value = definitions.get(reference.module)?.get(reference.node);
      assert.notEqual(value, undefined, "a B1 group uses only an actual declaration identity");
      return value;
    },
    bindingOccurrenceOf: reference => bindings.get(reference.module)?.get(reference.node) ?? null,
  };
  const lowered = captured.map(entry => {
    const result = fixture.front.lowerModuleExports(deps, entry.raw);
    assert.equal(result.kind, "ok");
    return result.value;
  });
  const relation = views(lowered.flatMap(entry => entry.bindings));
  const named = (file, name) => lowered.find(entry => entry.module === sourceModules.get(file)).entries.find(entry => entry.name === name).target;
  const original = named("a.ts", "add");
  assert.equal(original.kind, "declarations");
  const final = named("c.ts", "final");
  assert.equal(final.kind, "binding");
  const resolved = fixture.hir.resolveModuleBinding(relation, final.occurrence);
  assert.deepEqual(resolved.target, available(original));
  assert.equal(resolved.aliases.length, 3);
  assert.equal(resolved.aliases[0].value.owner, resolved.aliases[1].value.owner);
  assert.notEqual(resolved.aliases[1].value.owner, resolved.aliases[2].value.owner);
  assert.deepEqual(named("star.ts", "add"), original);
  const namespace = named("namespace.ts", "names");
  assert.equal(namespace.kind, "binding");
  assert.deepEqual(fixture.hir.resolveModuleBinding(relation, namespace.occurrence).target,
    available({ kind: "module", module: sourceModules.get("a.ts") }));
  const namespaceDefinition = captured.find(entry => entry.raw.module === sourceModules.get("namespace.ts")).inventory.rows.find(row => row.kind === "NamespaceExport");
  assert.notEqual(namespaceDefinition, undefined);
  assert.equal(namespace.occurrence.value.owner, namespaceDefinition.definition);
  const declarationSources = new Map(captured.flatMap(entry => entry.inventory.rows.map(row => [row.definition,
    { kind: "item", value: { owner: row.definition, node: row.node } }])));
  const projected = fixture.hir.projectExportDeclarations({ ...relation,
    declarationSourceOf: definition => declarationSources.get(definition) ?? null }, { name: "names", target: namespace });
  assert.deepEqual(projected.target, available({ kind: "declarations", definitions: [namespaceDefinition.definition] }));
  for (const entry of [...captured].reverse()) {
    const repeat = fixture.front.lowerModuleExports(deps, entry.raw);
    assert.deepEqual(repeat.value, lowered.find(value => value.module === entry.raw.module));
  }
  const selected = new Set(["a.ts", "star.ts", "namespace.ts"].map(name => sourceModules.get(name)));
  const texts = new Map(captured.map(entry => [entry.raw.module, entry.text]));
  const checked = captured.filter(entry => selected.has(entry.raw.module)).map(entry => {
    const result = fixture.front.lowerModule({ ...deps, sourceTextOf: module => texts.get(module),
      exportsOf: module => lowered.find(value => value.module === module) ?? null }, entry.raw);
    assert.equal(result.kind, "ok");
    return result.value;
  });
  for (const current of checked) {
    assert.deepEqual(fixture.verifyChecked(current, deps.types, checked), []);
    const parsed = fixture.hir.parseHir(fixture.hir.printHir(current));
    assert.equal(parsed.kind, "parsed");
    assert.equal(isDeepStrictEqual(parsed.value, current), true, "checked cross-module bindings round-trip without selecting a representative");
  }
  const namespaceModule = checked.find(current => current.module === sourceModules.get("namespace.ts"));
  assert.equal(namespaceModule.items.filter(item => item.definition === namespaceDefinition.definition).length, 1,
    "NamespaceExport's genuine F1 declaration occurs exactly once");
});
