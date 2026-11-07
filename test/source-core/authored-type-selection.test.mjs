import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompilerSessionFromFiles,
} from "@tsonic/tsts";
// The authored-type selection is a host-input checker view (I3); the fixture exposes the program checker views.
import {
  createHostSourceProgramFixture,
} from "../../packages/target-api/dist/source-semantics/host-program-fixtures.js";

test("authored type selection retains implicit optional nullish evidence", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/project",
    files: {
      "/project/index.ts": `
        export function read(value?: number): number {
          return value ?? 0;
        }
      `,
    },
    compilerOptions: {
      noLib: true,
      strict: true,
    },
  }).checkSource();
  const source = createHostSourceProgramFixture(checked);
  const sourceFile = source.sourceFiles.find((candidate) =>
    candidate !== undefined &&
    source.ast.getFileName(candidate) === "/project/index.ts"
  );
  assert.notEqual(sourceFile, undefined);
  const semantics = source.semantics.forFile(sourceFile);
  const parameter = requiredNode(source, sourceFile, (node) =>
    source.ast.is.IsParameterDeclaration(node));
  const parameterType = source.ast.as.AsParameterDeclaration(parameter)?.Type;
  const selectedValue = requiredNode(source, sourceFile, (node) =>
    source.ast.is.IsIdentifier(node) &&
    source.ast.text(node) === "value" &&
    source.ast.parent(node) !== parameter);
  const selectedType = semantics.types.expressionType(selectedValue);

  assert.notEqual(parameterType, undefined);
  assert.notEqual(selectedType, undefined);
  const selection = semantics.types.authoredSelection(
    parameterType,
    selectedType,
  );
  assert.equal(selection.kind, "authored-members");
  assert.deepEqual(selection.nodes, [parameterType]);
  assert.equal(selection.selectedNullishTypes.length, 1);
  assert.equal(
    semantics.types.isNullish(selection.selectedNullishTypes[0]),
    true,
  );
  // The Host value fact of the same read keeps the absence of the optional parameter.
  const published = source.facts.values.type(selectedValue);
  assert.equal(published.kind === "refused", false);
  const arms = published.type.kind === "optional" ? [published.type.value, { kind: "intrinsic", intrinsic: "absence" }]
    : published.type.kind === "union" ? published.type.types : [published.type];
  assert.equal(arms.some((arm) => arm.kind === "intrinsic" && arm.intrinsic === "absence"), true);
});

function requiredNode(source, root, predicate) {
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node !== undefined && predicate(node)) {
      return node;
    }
    if (node !== undefined) {
      pending.push(...source.ast.children(node));
    }
  }
  assert.fail("Expected source node was not found.");
}
