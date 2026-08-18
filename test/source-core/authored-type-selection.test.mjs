import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompilerSessionFromFiles,
} from "@tsonic/tsts";
import {
  createTargetSourceProgram,
} from "../../packages/target-api/dist/public/source.js";

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
  const source = createTargetSourceProgram(checked);
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
  const selectedType = semantics.getTypeAtLocation(selectedValue);

  assert.notEqual(parameterType, undefined);
  assert.notEqual(selectedType, undefined);
  const selection = semantics.selectAuthoredType(
    parameterType,
    selectedType,
  );
  assert.equal(selection.kind, "authored-members");
  assert.deepEqual(selection.nodes, [parameterType]);
  assert.equal(selection.selectedNullishTypes.length, 1);
  assert.equal(
    semantics.isNullish(selection.selectedNullishTypes[0]),
    true,
  );
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
