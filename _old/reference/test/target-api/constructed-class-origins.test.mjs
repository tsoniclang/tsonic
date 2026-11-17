import assert from "node:assert/strict";
import test from "node:test";
import { getTargetCompilationPaths, resolveProjectPaths } from "../../packages/host/dist/index.js";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

function fixture() {
  const targetPack = createCsharpTargetPack();
  const target = { id: "csharp", options: { outputType: "Library" } };
  const project = { entryPoint: "index.ts", rootDir: ".", targets: [target] };
  const paths = getTargetCompilationPaths(resolveProjectPaths({ projectFilePath: "/src/tsonic.json", project }), target);
  const result = checkSourceProgramFixture({ project, projectDirectory: "/src", currentDirectory: "/src", target, targetPack, paths,
    selectedCapabilities: [], selectedSurfaces: [],
    compilerOptions: { strict: true, noLib: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `
      export class Box<T> { constructor(readonly value: T) {} }
      export const boxed = new Box<number>(1);
      export const anonymous = new (class { readonly value = 2; })();
    ` } });
  assert.equal(result.kind, "resolved", result.diagnostics.map(issue => issue.message).join("\n"));
  assert.equal(result.diagnostics.length, 0);
  const source = result.value;
  const occurrences = source.facts.values.occurrences();
  const constructions = occurrences.filter(source.ast.is.IsNewExpression);
  assert.equal(constructions.length, 2);
  return { source, constructions };
}

test("constructed classes retain genuine original template facts without a fabricated closed checked instance", () => {
  const { source, constructions } = fixture();
  const values = constructions.map(occurrence => {
    const result = source.facts.values.type(occurrence);
    assert.equal(result.kind, "resolved");
    const value = result.value;
    assert.equal(value.type.kind, "declared");
    assert.equal(source.ast.is.IsClassDeclaration(value.type.declaration) || source.ast.is.IsClassExpression(value.type.declaration), true);
    const pointer = source.facts.protocols.pointerType(value);
    assert.equal(pointer.kind === "resolved" && pointer.value.kind === "none", true,
      "an ordinary constructed class is not an unavailable or borrowed pointer fact");
    const markers = source.facts.protocols.typeMarkers(value);
    assert.equal(markers.kind === "resolved" && markers.value.value === value &&
      markers.value.struct.kind === "none" && markers.value.jsString === false, true,
    "ordinary class marker absence comes from its authentic original association");
    const definition = source.facts.descriptors.definition(value);
    assert.equal(definition.kind, "resolved");
    assert.equal(source.facts.protocols.pointerType(value).kind, "resolved");
    return value;
  });
  const declared = values.find(value => source.ast.is.IsClassDeclaration(value.type.declaration));
  const expression = values.find(value => source.ast.is.IsClassExpression(value.type.declaration));
  assert.equal(declared !== undefined && expression !== undefined, true);
  assert.equal(declared.type.typeArguments.length, 1);
  const argument = source.facts.descriptors.component(declared, { kind: "type-argument", declaration: declared.type.declaration, index: 0 });
  assert.equal(argument.kind === "resolved" && argument.value.type === declared.type.typeArguments[0], true,
    "actual Source bindings remain distinct from the original class template fact");
  const foreign = fixture();
  assert.throws(() => source.facts.protocols.pointerType({ ...declared }), /exact descriptor view/);
  const foreignValue = foreign.source.facts.values.type(foreign.constructions[0]);
  assert.equal(foreignValue.kind, "resolved");
  assert.throws(() => source.facts.protocols.typeMarkers(foreignValue.value), /exact descriptor view/);
});
