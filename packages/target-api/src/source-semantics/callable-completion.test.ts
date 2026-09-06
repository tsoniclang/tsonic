import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";

test("target source forwards exact callable completion without a source-flow reconstruction", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      function maybe(flag: boolean) { if (flag) return 1; }
      function forever(): never { while (true) {} }
      declare function externalFunction(): number;
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  const diagnostics = checked.diagnostics.filter(diagnostic => diagnostic !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const declarations = source.ast.statements(file);
  const operations = source.semantics.forFile(file).operations;
  const expected = [true, false, undefined];
  for (let index = 0; index < declarations.length; index++) {
    const declaration = declarations[index]!;
    const evidence = operations.callableCompletion(declaration);
    assert.equal(evidence?.canFallThrough, expected[index]);
    assert.equal(evidence, checked.getSourceFileQueries(file).checker.getResolvedCallableCompletionInfo(declaration));
  }
});
