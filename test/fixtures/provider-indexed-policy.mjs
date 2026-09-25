import assert from "node:assert/strict";
import { createCompilerSessionFromFiles, formatDiagnostics } from "../../packages/tsts/dist/src/index.js";
import { createTargetSourceProgram, sourceIndexedPropertyTypeEvidence } from "../../packages/target-api/dist/public/source.js";

export function providerIndexedPolicyFixture(keys = '"value"') {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      interface Box<T> { value: T; other: T; optional?: T }
      type Selected = Box<number>[${keys}];
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const declaration = source.ast.statements(file).find(node => node !== undefined && source.ast.is.IsTypeAliasDeclaration(node));
  const node = source.ast.typeNode(declaration);
  assert.ok(node);
  const semantics = source.semantics.forFile(file);
  const evidence = sourceIndexedPropertyTypeEvidence(source.ast, semantics, node);
  assert.ok(evidence);
  return { source, semantics, node, evidence };
}
