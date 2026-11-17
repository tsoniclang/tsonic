import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { sourceFlowOwnerFixture } from "../host/fixtures/source-flow-owner.mjs";

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
  const { program: source } = sourceFlowOwnerFixture({ checked, apiFacts: undefined, profileFiles: [], safetyProviders: [] });
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true);
  const declarations = source.ast.statements(file);
  const expected = [true, false, undefined];
  assert.equal(declarations.length, expected.length);
  for (const [index, declaration] of declarations.entries()) {
    assert.equal(declaration !== undefined, true);
    const original = checked.getSourceFileQueries(file).checker.getResolvedCallableCompletionInfo(declaration);
    assert.equal(original?.canFallThrough, expected[index]);
    const result = source.facts.protocols.callableCompletion(declaration);
    assert.equal(result.kind, "resolved");
    assert.equal(source.facts.protocols.callableCompletion(declaration) === result, true,
      "the readonly Source result is cached by the authentic original declaration");
    if (original === undefined) assert.equal(result.value.kind, "none", "an ambient declaration gets no fabricated body completion");
    else {
      assert.equal(result.value.kind === "present" && result.value.value.declaration === original.declaration &&
        result.value.value.declaration === declaration && result.value.value.canFallThrough === original.canFallThrough, true,
      "the factual boundary retains the original declaration and exact observed completion, not a reconstructed flow answer");
      assert.equal(Object.isFrozen(result.value.value), true);
    }
  }
});
