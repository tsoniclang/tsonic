import assert from "node:assert/strict";
import test from "node:test";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

function fixture(files, entryPoint = "index.ts") {
  const target = { id: "csharp", options: { outputType: "Library" } };
  const checked = checkSourceProgramFixture({
    project: { entryPoint, rootDir: ".", targets: [target] },
    projectDirectory: "/src", target, targetPack: createCsharpTargetPack(),
    paths: { projectFilePath: "/src/tsonic.json", projectRoot: "/src", outputRoot: "/out",
      targetOutputRoot: "/out/csharp", cacheRoot: "/out/cache" },
    selectedCapabilities: [], selectedSurfaces: [], currentDirectory: "/src", files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  });
  assert.equal(checked.kind, "resolved", checked.diagnostics.map(issue => issue.message).join("\n").slice(0, 4096));
  assert.equal(checked.diagnostics.length, 0, "the original complete program has no diagnostics");
  return checked.value;
}

function resolved(result, label) {
  assert.equal(result.kind, "resolved", result.kind === "refused" ? `${label}: ${result.message}` : label);
  return result.value;
}

test("callable interface evidence accounts for complete inherited and merged shapes", () => {
  const source = fixture({ "/src/index.ts": `
      interface Direct { (value: number): number; }
      interface Generic<Value> { (value: Value): Value; }
      interface Inherited extends Direct {}
      interface Repeated extends Direct, Generic<number> {}
      interface Merged { (value: number): number; }
      interface Merged {}
      interface Tagged extends Direct { tag: string; }
      interface Overloaded { (value: number): number; (value: string): string; }
      interface Indexed extends Direct { [key: string]: number; }
      interface Constructor extends Direct { new (): Direct; }
      interface Empty {}
      class Nominal {}
  ` });
  const { ast, facts } = source;
  const file = source.sourceFiles.find(file => ast.getFileName(file) === "/src/index.ts");
  assert.equal(file !== undefined, true);
  const declarations = ast.statements(file).filter(node => node !== undefined);
  assert.equal(declarations.length, 12, "all twelve original declaration rows remain");
  const expected = [
    { kind: "callable", calls: 1, members: 0, indexes: 0, constructs: 0 },
    { kind: "callable", calls: 1, members: 0, indexes: 0, constructs: 0 },
    { kind: "callable", calls: 1, members: 0, indexes: 0, constructs: 0 },
    { kind: "callable", calls: 2, members: 0, indexes: 0, constructs: 0 },
    { kind: "callable", calls: 1, members: 0, indexes: 0, constructs: 0 },
    { kind: "callable", calls: 1, members: 0, indexes: 0, constructs: 0 },
    { kind: "shape", calls: 1, members: 1, indexes: 0, constructs: 0 },
    { kind: "callable", calls: 2, members: 0, indexes: 0, constructs: 0 },
    { kind: "shape", calls: 1, members: 0, indexes: 1, constructs: 0 },
    { kind: "callable", calls: 1, members: 0, indexes: 0, constructs: 1 },
    { kind: "shape", calls: 0, members: 0, indexes: 0, constructs: 0 },
    { kind: "shape", calls: 0, members: 0, indexes: 0, constructs: 0 },
  ];
  const definitions = declarations.map((declaration, index) => {
    const label = ast.text(ast.name(declaration));
    const slot = resolved(facts.values.declaredSlot(declaration), label);
    assert.equal(slot.origin.kind === "declaration" && slot.origin.declaration === declaration, true, label);
    const body = resolved(facts.descriptors.definition(slot.type), `${label}: original definition`);
    facts.descriptors.assertEvidence(body);
    const { type } = body;
    assert.equal(type.kind, expected[index].kind, label);
    assert.deepEqual({ kind: type.kind, calls: type.calls.length,
      members: type.kind === "shape" ? type.members.length : 0,
      indexes: type.kind === "shape" ? type.indexes.length : 0, constructs: type.constructs.length }, expected[index], label);
    assert.equal(Object.isFrozen(type.calls) && type.calls.every(Object.isFrozen), true, label);
    for (const signature of type.calls) {
      assert.equal(signature.parameters.length, 1, label);
      const parameter = resolved(facts.descriptors.component(body,
        { kind: "parameter", signature: signature.identity, index: 0 }), `${label}: original parameter`);
      const result = resolved(facts.descriptors.component(body,
        { kind: "result", signature: signature.identity }), `${label}: original result`);
      assert.equal(parameter.type === signature.parameters[0].type && result.type === signature.result, true, label);
      assert.equal(signature.identity.declaration !== undefined, true, label);
      assert.equal(signature.parameters[0].declaration === ast.parameters(signature.identity.declaration)[0], true, label);
    }
    return body;
  });
  const directSignature = definitions[0].type.calls[0].identity;
  assert.equal(definitions[2].type.calls[0].identity.declaration === directSignature.declaration, true,
    "inherited callability retains the original base signature");
  assert.equal(definitions[3].type.calls[0].identity.declaration === ast.members(declarations[0])[0] &&
    definitions[3].type.calls[1].identity.declaration === ast.members(declarations[1])[0], true,
  "repeated inheritance retains both original signatures in order");
  assert.equal(definitions[4].type === definitions[5].type, true,
    "both original merged declarations describe the same complete shape");
  const generic = definitions[1].type.calls[0];
  assert.equal(generic.parameters[0].type.kind === "parameter" &&
    generic.parameters[0].type.declaration === ast.typeParameters(declarations[1])[0], true);
  assert.equal(generic.result === generic.parameters[0].type, true);
  assert.equal(definitions[6].type.members[0].name, "tag", "a callable with a property is not a pure callable interface");
  assert.equal(definitions[8].type.indexes[0].declaration === ast.members(declarations[8])[0], true,
    "the original index signature remains an exclusion rather than disappearing");
  assert.equal(definitions[9].type.constructs[0].identity.declaration === ast.members(declarations[9])[0], true,
    "the original constructor signature is not collapsed into the call signature");
  assert.throws(() => facts.descriptors.definition(undefined), /Source type evidence must belong to this exact descriptor view/,
    "missing evidence is rejected by the canonical input boundary, not promoted to a callable");
});

test("callable evidence retains instantiated signature ownership through re-exports", () => {
  const source = fixture({
    "/src/types.ts": `export interface Callback<Value> { (value: Value): Value; }`,
    "/src/api.ts": `import type { Callback } from "./types.js"; export declare const callback: Callback<number>;`,
    "/src/bridge.ts": `export { callback as forwarded } from "./api.js";`,
  }, "bridge.ts");
  const { ast, facts } = source;
  const files = ["/src/types.ts", "/src/api.ts", "/src/bridge.ts"].map(path => {
    const file = source.sourceFiles.find(file => ast.getFileName(file) === path);
    assert.equal(file !== undefined, true, path);
    return file;
  });
  const nodes = [];
  function visit(node) {
    nodes.push(node);
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  }
  files.forEach(visit);
  const declaration = nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)) === "callback");
  const callback = nodes.find(node => ast.is.IsInterfaceDeclaration(node) && ast.text(ast.name(node)) === "Callback");
  const forwarded = nodes.find(node => ast.is.IsIdentifier(node) && ast.text(node) === "forwarded");
  assert.equal(declaration !== undefined && callback !== undefined && forwarded !== undefined, true);
  const slot = resolved(facts.values.declaredSlot(declaration), "the original exported callback");
  const body = resolved(facts.descriptors.definition(slot.type), "the instantiated callback definition");
  assert.equal(body.type.kind, "callable");
  assert.equal(body.type.calls.length, 1);
  const signature = body.type.calls[0];
  assert.equal(signature.identity.declaration === ast.members(callback)[0], true,
    "the applied signature retains the actual original generic declaration");
  assert.equal(signature.parameters.length, 1);
  const parameter = resolved(facts.descriptors.component(body,
    { kind: "parameter", signature: signature.identity, index: 0 }), "the original applied parameter");
  const result = resolved(facts.descriptors.component(body,
    { kind: "result", signature: signature.identity }), "the original applied result");
  assert.equal(parameter.type.kind === "primitive" && parameter.type.primitive === "float64", true);
  assert.equal(result.type === parameter.type, true, "both uses receive the same original Callback<number> binding");
  const reexport = resolved(facts.values.type(forwarded), "the original re-exported occurrence");
  const reexported = resolved(facts.descriptors.definition(reexport), "the re-exported callback definition");
  assert.equal(reexported.type === body.type, true, "re-exporting does not fabricate another callable or selected signature");
});
