import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";

test("source-call results separate selected invocation storage from optional completion", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      interface Source {
        read(value: string): string;
        read(value: number): number;
        nullable(): number | null | undefined;
        map<Value>(value: Value): Value;
      }
      declare const source: Source | undefined;
      source?.read(1); source?.nullable(); source?.map<number>(1);
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const checker = checked.getSourceFileQueries(file).checker;
  const results: [string, string][] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsCallExpression(node)) {
      const call = semantics.operations.call(node);
      assert.ok(call);
      const result = semantics.operations.callResult(call);
      assert.ok(result);
      assert.ok(Object.isFrozen(result));
      assert.deepEqual(semantics.operations.callResult(call), result);
      results.push([
        checker.typeToString(result.selectedReturnType),
        checker.typeToString(result.resultType),
      ]);
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.deepEqual(results, [
    ["number", "number | undefined"],
    ["number | null | undefined", "number | null | undefined"],
    ["number", "number | undefined"],
  ]);
});
