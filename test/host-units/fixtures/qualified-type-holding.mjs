import assert from "node:assert/strict";

export async function checkQualifiedTypeHolding() {
  const { loadFrontFixture } = await import("./front/checked-module.mjs");
  const { analysisInput } = await import("./front/analysis-input.mjs");
  const { captureSourceBarrier } = await import("../../../packages/host/dist/pipeline/source-barrier.js");
  const { analyzeHostProgram } = await import("../../../packages/host/dist/pipeline/index.js");
  const { parseModuleBodies, printModuleBodies } = await import("../../../packages/host/dist/ir-program/index.js");
  const fixture = await loadFrontFixture();
  const main = `
    import type * as Names from "./base.js";
    type Alias = import("./base.js").Shape;
    export function qualified(input: Names.Shape): boolean { const { flag: selected } = input; return !selected; }
    export function throughAlias(input: Alias): boolean { const { flag: selected } = input; return !selected; }
    export function inlineType(input: import("./base.js").Shape): boolean { const { flag: selected } = input; return !selected; }
    export function query(flag: typeof Names.flag): boolean { return flag; }
  `;
  const input = analysisInput(fixture, "sdk-minimal", main);
  input.snapshot = fixture.projectSnapshot({
    sourceFiles: { "main.ts": main, "base.ts": "export type Shape = { flag: boolean; other: boolean }; export const flag: boolean = false;" },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  });
  const captured = captureSourceBarrier(input);
  assert.equal(captured.kind, "ok", JSON.stringify(captured.diagnostics));
  const modules = captured.value.modules.map(row => row.module);
  const checked = modules.find(row => row.module === input.snapshot.entryPoint);
  const shape = modules.flatMap(row => row.tree.statements.nodes)
    .find(node => node.kind === "TypeAliasDeclaration" && node.name.text === "Shape");
  const field = shape.type.members.nodes[0].name.tsonic.declaration.definition;
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok", JSON.stringify(result.diagnostics));
  const { index, modules: published } = result.value;
  const chapter = published.find(row => row.module === input.snapshot.entryPoint);
  for (const callable of checked.tree.statements.nodes.filter(node => node.kind === "FunctionDeclaration")) {
    const body = chapter.bodies.find(row => row.kind === "selected" && row.instance.body === callable.tsonic.body);
    const original = callable.parameters.nodes[0].type;
    const typed = body.tir.params[0].type;
    assert.equal(typed.kind, original.kind);
    assert.equal(typed.id, original.id);
    const nameOf = type => type.typeName ?? type.exprName ?? type.qualifier;
    const expectedName = nameOf(original);
    const actualName = nameOf(typed);
    const reached = [[actualName, expectedName]];
    for (const [actual, expected] of reached) {
      assert.deepEqual([actual.kind, actual.id, actual.parent, actual.origin], [expected.kind, expected.id, expected.parent, expected.origin]);
      assert.equal(actual.tsonic.role, "type-name");
      assert.equal(actual.tsonic.type, typed.tsonic.type);
      const resolution = expected.tsonic.resolution;
      assert.deepEqual(actual.tsonic.declarations, resolution.kind === "declarations" ? resolution.definitions : []);
      if (actual.kind === "Identifier") assert.equal(actual.text, expected.text);
      else reached.push([actual.left, expected.left], [actual.right, expected.right]);
    }
    const places = body.mir.places.filter(row => row.base.kind === "place" && row.base.projection.kind === "field");
    assert.deepEqual(places.map(row => row.base.projection.member.decision.primary), callable.name.text === "query" ? [] : [field]);
  }
  const text = printModuleBodies(index, chapter);
  const roundtrip = parseModuleBodies(index, text);
  assert.equal(roundtrip.kind, "parsed");
  assert.equal(printModuleBodies(index, roundtrip.value), text);
}
