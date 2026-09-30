import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { sourceCallableInterface } from "./callable-interfaces.js";

test("callable interface evidence accounts for complete inherited and merged shapes", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      interface Direct { (value: number): number; }
      interface Generic<Value> { (value: Value): Value; }
      interface Inherited extends Direct {}
      interface Merged { (value: number): number; }
      interface Merged {}
      interface Tagged extends Direct { tag: string; }
      interface Overloaded { (value: number): number; (value: string): string; }
      interface Indexed extends Direct { [key: string]: number; }
      interface Constructor extends Direct { new (): Direct; }
      interface Empty {}
      class Nominal {}
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  const diagnostics = checked.diagnostics.filter(diagnostic => diagnostic !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const expected = [true, true, true, true, true, false, false, false, false, false, false];
  source.ast.statements(file).forEach((declaration, index) => {
    assert.ok(declaration);
    const type = semantics.declarations.declaredType(declaration);
    const evidence = sourceCallableInterface(type, semantics, source.ast);
    assert.equal(evidence !== undefined, expected[index], source.ast.text(source.ast.name(declaration)));
    if (evidence !== undefined) {
      assert.equal(evidence.result.declaration, semantics.types.callable(type!)?.result.declaration);
      assert.equal(evidence.parameters.length, 1);
    }
  });
  assert.equal(sourceCallableInterface(undefined, semantics, source.ast), undefined);
});
