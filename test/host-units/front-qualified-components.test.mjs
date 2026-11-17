import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

async function sourceViews(fixture, modules) {
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  return checkedSourceViews(modules.map(module => ({ module, nodes: fixture.hir.indexSyntaxTree(module.tree) })));
}

test("actual imported generic constraints and defaults retain their qualified source domain", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModulesOf({
    "main.ts": "import type { Box } from './foreign.js';export type Applied=Box;export function value(input:boolean):boolean{return input;}",
    "foreign.ts": "export interface Box<T extends boolean=boolean>{(value:T):T;}",
  });
  const domain = await sourceViews(fixture, actual.modules);
  const foreign = actual.modules[1].tree.statements.nodes[0];
  const parameter = foreign.typeParameters.nodes[0];
  const applied = actual.modules[0].tree.statements.nodes[1];
  const selected = fixture.types.readType(actual.interner, applied.tsonic.type.value);
  assert.equal(selected.kind, "declared");
  assert.equal(selected.definition, foreign.tsonic.definition);
  assert.deepEqual(selected.arguments.map(type => fixture.types.readType(actual.interner, type)), [{ kind: "primitive", primitive: "bool" }]);
  for (const type of [parameter.tsonic.parameter.constraint, parameter.tsonic.parameter.default])
    assert.deepEqual(fixture.types.readType(actual.interner, type), { kind: "primitive", primitive: "bool" });
  for (let position = 0; position < actual.captured.length; position += 1) {
    const captured = actual.captured[position];
    const nodes = fixture.hir.indexSyntaxTree(actual.modules[position].tree);
    for (const component of captured.raw.types.components) {
      const source = actual.deps.sourceOccurrenceOf(component.root);
      assert.equal(source !== null, true, "an actual requested component has one ready qualified occurrence");
      assert.equal(domain.nodeOf(source.occurrence) === nodes[component.root.node], true,
        `${position}:${component.root.node} uses the canonical checked body/item scope`);
    }
  }
});

test("actual foreign default and constraint requests close before F1 even when requested by another module", async () => {
  const fixture = await loadFrontFixture();
  const texts = {
    "main.ts": "import {select} from './foreign.js';export type Callable=typeof select;",
    "foreign.ts": "export function select<T extends boolean=boolean>(value:T):T{return value;}",
  };
  const opened = fixture.openAndCapture(fixture.projectSnapshot({ sourceFiles: texts,
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] }));
  const captures = Object.keys(texts).map(name => {
    const module = fixture.moduleOf(fixture.packageOf("/project"), `src/${name}`);
    const result = fixture.front.captureModule(opened.deps, opened.program, module);
    assert.equal(result.kind, "ok");
    return result.value;
  });
  const foreign = captures[1];
  const parameter = foreign.tree.statements.nodes[0].typeParameters.nodes[0];
  const roots = captures[0].types.components.filter(component => component.root.module === foreign.module).map(component => component.root);
  assert.deepEqual([...new Set(roots.map(root => root.node))], [parameter.constraint.id, parameter.defaultType.id]);
  const baseline = fixture.front.lowerModuleDefinitions({ module: foreign, componentRoots: [] });
  const requested = fixture.front.lowerModuleDefinitions({ module: foreign, componentRoots: roots });
  assert.equal(baseline.kind, "ok");
  assert.equal(requested.kind, "ok");
  assert.deepEqual(requested.value.rows, baseline.value.rows, "actual component demands never create a declaration identity");
  for (const root of roots) {
    const selected = requested.value.sourceOccurrences.filter(source => source.node === root.node);
    assert.equal(selected.length, 1, "repeated genuine demands retain one ready row");
    assert.equal(selected[0].kind, "BooleanKeyword");
    assert.equal(selected[0].occurrence.kind, "body");
    const body = fixture.ids.decodeBodyId(selected[0].occurrence.value.body);
    assert.equal(body.kind, "decoded");
    const owner = fixture.ids.decodeDefId(body.value.owner);
    assert.equal(owner.kind, "decoded");
    assert.equal(owner.value.module, foreign.module);
    assert.equal(baseline.value.sourceOccurrences.some(source => source.node === root.node), false);
  }
  const mainDefinitions = fixture.front.lowerModuleDefinitions({ module: captures[0],
    componentRoots: captures[0].types.components.filter(component => component.root.module === captures[0].module).map(component => component.root) });
  assert.equal(mainDefinitions.kind, "ok");
  const modules = new Map([[foreign.module, requested.value], [captures[0].module, mainDefinitions.value]]);
  const types = fixture.types.createTypeInterner();
  const deps = { ...fixture.lowerDepsFor(mainDefinitions.value, types, texts["main.ts"]),
    definitionOf: reference => modules.get(reference.module)?.rows.find(row => row.node === reference.node)?.definition
      ?? assert.fail("an actual F1 declaration must be ready"),
    sourceOccurrenceOf: reference => modules.get(reference.module)?.sourceOccurrences.find(row => row.node === reference.node) ?? null };
  const { createTypeConversion, convertRawType } = await import("../../packages/host/dist/front/type-conversion.js");
  const conversion = createTypeConversion(deps, captures[0]);
  const localConversion = createTypeConversion(deps, foreign);
  for (const row of captures[0].types.types) {
    const component = captures[0].types.components[row.component];
    if (component.root.module !== foreign.module) continue;
    const result = convertRawType(conversion, row.id);
    assert.equal(result.kind, "complete");
    assert.deepEqual(fixture.types.readType(types, result.value.type), { kind: "primitive", primitive: "bool" });
    assert.deepEqual(result.value.evidence.component, deps.sourceOccurrenceOf(component.root).occurrence);
    const local = foreign.types.types.find(row => foreign.types.components[row.component].root.node === component.root.node);
    assert.equal(local !== undefined, true, "the same real authored scalar has an independently captured local view");
    const localResult = convertRawType(localConversion, local.id);
    assert.equal(localResult.kind, "complete");
    assert.deepEqual(result.value, localResult.value, "local and foreign conversion consume the same qualified ready relation");
  }
  assert.throws(() => fixture.front.lowerModuleDefinitions({ module: captures[0], componentRoots: roots }), /actual captured module/u);
  assert.throws(() => fixture.front.lowerModuleDefinitions({ module: foreign,
    componentRoots: [{ module: foreign.module, node: fixture.hir.indexSyntaxTree(foreign.tree).length }] }), /actual captured syntax node/u);
  assert.throws(() => fixture.front.lowerModuleDefinitions(foreign), TypeError, "the retired raw-module-only signature is rejected");
});

test("local component roots retain the same ready header, function and separately executing initializer scopes", async () => {
  const fixture = await loadFrontFixture();
  const actual = fixture.checkedModuleOf("export function local(input:boolean,omitted:boolean=true):boolean{let value:boolean=input;const copy:boolean=value;return copy;}");
  const domain = await sourceViews(fixture, [actual.checked]);
  assert.deepEqual(fixture.verifyChecked(actual.checked, actual.interner), []);
  const nodes = fixture.hir.indexSyntaxTree(actual.checked.tree);
  for (const component of actual.raw.types.components) {
    const source = actual.definitions.sourceOccurrences.find(source => source.node === component.root.node);
    assert.equal(source !== undefined, true);
    assert.equal(domain.nodeOf(source.occurrence) === nodes[component.root.node], true,
      `${component.root.node} retains the one actual checked scope`);
  }
  const roles = actual.checked.bodies.map(body => fixture.ids.decodeBodyId(body.body)).map(decoded => {
    assert.equal(decoded.kind, "decoded");
    return decoded.value.role;
  });
  assert.equal(roles.includes("default-argument"), true);
  assert.equal(roles.filter(role => role === "initializer").length, 2);
});

test("an actual bodyless declaration component never gains an invented execution header body", async () => {
  const fixture = await loadFrontFixture();
  const opened = fixture.openedModule("export declare function value(input:boolean):boolean;");
  const captured = fixture.front.captureModule(opened.deps, opened.program, opened.module);
  assert.equal(captured.kind, "ok");
  const parameter = captured.value.tree.statements.nodes[0].parameters.nodes[0];
  const identified = fixture.front.lowerModuleDefinitions({ module: captured.value,
    componentRoots: [{ module: opened.module, node: parameter.type.id }] });
  assert.equal(identified.kind, "ok");
  const selected = identified.value.sourceOccurrences.find(row => row.node === parameter.type.id);
  assert.equal(selected.occurrence.kind, "body");
  const decoded = fixture.ids.decodeBodyId(selected.occurrence.value.body);
  assert.equal(decoded.kind, "decoded");
  assert.equal(decoded.value.role, "module");
});

test("F1 identities remain independent of Lower frontiers for every actual closed callable default", async () => {
  const fixture = await loadFrontFixture();
  for (const source of [
    "export function value(input:boolean=true){return input;}",
    "export const value=function(input:boolean=true){return input;};",
    "export const value=(input:boolean=true)=>input;",
    "export class Value{constructor(input:boolean=true){}}",
    "export class Value{method(input:boolean=true){return input;}}",
    "export class Value{get value(){return true;}}",
    "export class Value{set value(input:boolean){}}",
  ]) {
    const opened = fixture.openedModule(source);
    const captured = fixture.front.captureModule(opened.deps, opened.program, opened.module);
    assert.equal(captured.kind, "ok");
    const raw = captured.value;
    const baseline = fixture.front.lowerModuleDefinitions({ module: raw, componentRoots: [] });
    assert.equal(baseline.kind, "ok");
    const nodes = fixture.hir.indexSyntaxTree(raw.tree);
    const callable = nodes.find(node => ["FunctionDeclaration", "FunctionExpression", "ArrowFunction", "Constructor", "MethodDeclaration", "GetAccessor", "SetAccessor"].includes(node.kind));
    assert.equal(callable !== undefined && callable.body !== null, true);
    const definition = baseline.value.rows.find(row => row.node === callable.id);
    assert.equal(definition !== undefined, true, "even the anonymous callable has its own genuine F1 identity");
    const roots = [{ module: raw.module, node: callable.body.id }];
    for (const parameter of callable.parameters.nodes) {
      if (parameter.type !== null) roots.push({ module: raw.module, node: parameter.type.id });
      if (parameter.initializer !== null) roots.push({ module: raw.module, node: parameter.initializer.id });
    }
    const identified = fixture.front.lowerModuleDefinitions({ module: raw, componentRoots: roots });
    assert.equal(identified.kind, "ok");
    assert.deepEqual(identified.value.rows, baseline.value.rows);
    const body = identified.value.sourceOccurrences.find(row => row.node === callable.body.id);
    assert.equal(body.occurrence.kind, "body");
    assert.deepEqual(fixture.ids.decodeBodyId(body.occurrence.value.body), { kind: "decoded",
      value: { owner: definition.definition, role: "function", ordinal: 0 } });
    for (const parameter of callable.parameters.nodes) {
      if (parameter.type !== null) {
        const header = identified.value.sourceOccurrences.find(row => row.node === parameter.type.id);
        assert.deepEqual(fixture.ids.decodeBodyId(header.occurrence.value.body), { kind: "decoded",
          value: { owner: definition.definition, role: "function", ordinal: 0 } });
      }
      if (parameter.initializer === null) continue;
      const owner = baseline.value.rows.find(row => row.node === parameter.id);
      const selected = identified.value.sourceOccurrences.find(row => row.node === parameter.initializer.id);
      assert.deepEqual(fixture.ids.decodeBodyId(selected.occurrence.value.body), { kind: "decoded",
        value: { owner: owner.definition, role: "default-argument", ordinal: 0 } });
    }
  }
});

test("component root demands preserve B1 and index item authority without emitting all syntax nodes", async () => {
  const fixture = await loadFrontFixture();
  for (const [expression, kind] of [["{[key:string]:boolean}", "IndexSignature"], ["{[K in string]:boolean}", "MappedType"]]) {
    const source = `type Indexed=${expression};export{Indexed};export function value(input:boolean):boolean{return input;}`;
    const opened = fixture.openedModule(source);
    const captured = fixture.front.captureModule(opened.deps, opened.program, opened.module);
    assert.equal(captured.kind, "ok");
    const raw = captured.value;
    const baseline = fixture.front.lowerModuleDefinitions({ module: raw, componentRoots: [] });
    assert.equal(baseline.kind, "ok");
    const index = baseline.value.sourceOccurrences.find(row => row.kind === kind);
    assert.equal(index !== undefined, true);
    assert.equal(baseline.value.sourceOccurrences.some(row => row.kind === "ExportSpecifier"), true);
    const requested = fixture.front.lowerModuleDefinitions({ module: raw,
      componentRoots: [...raw.types.components.map(component => component.root), { module: raw.module, node: index.node }] });
    assert.equal(requested.kind, "ok");
    assert.deepEqual(requested.value.rows, baseline.value.rows);
    for (const row of baseline.value.sourceOccurrences) {
      assert.equal(row.occurrence.kind, "item");
      assert.deepEqual(requested.value.sourceOccurrences.find(selected => selected.node === row.node), row);
    }
    assert.equal(requested.value.sourceOccurrences.filter(row => row.node === index.node).length, 1);
    assert.equal(requested.value.sourceOccurrences.length < fixture.hir.indexSyntaxTree(raw.tree).length, true);
  }
});
