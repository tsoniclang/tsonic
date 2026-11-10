import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import { sourceBooleanShortCircuitBranch } from "./boolean-short-circuit.js";

test("boolean short-circuit selection preserves literal, wrapped, sequenced and unknown conditions", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    declare const enabled: boolean;
    declare function effect(): void;
    false && 1;
    true && 1;
    true || 1;
    false || 1;
    (effect(), true) && 1;
    ((false as boolean) satisfies boolean)! || 1;
    enabled && 1;
    enabled || 1;
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0);
  const ast = checked.ast;
  const selected: string[] = [];
  const visit = (node: Node): void => {
    const operator = ast.operatorKindName(node);
    if (operator === "KindAmpersandAmpersandToken" || operator === "KindBarBarToken") {
      assert.equal(ast.is.IsBinaryExpression(node), true);
      const left = ast.as.AsBinaryExpression(node)?.Left;
      assert.equal(left !== undefined, true);
      selected.push(sourceBooleanShortCircuitBranch(ast, left!, operator === "KindAmpersandAmpersandToken" ? "&&" : "||"));
    }
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  for (const file of checked.sourceFiles) {
    if (file !== undefined && ast.getFileName(file) === "/src/index.ts") visit(file);
  }
  assert.deepEqual(selected, ["left", "right", "left", "right", "right", "right", "conditional", "conditional"]);
});
