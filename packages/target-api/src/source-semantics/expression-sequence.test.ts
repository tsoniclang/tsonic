import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { sourceExpressionSequence } from "./expression-sequence.js";

test("source comma sequences preserve exact ordered leaves without treating other operators as separators", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `declare function first(): number;
declare function second(): number;
declare function third(): number;
declare function fourth(): number;
((first(), second()), (third(), fourth()));
(first() + second());`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  const diagnostics = checked.diagnostics.filter(diagnostic => diagnostic !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const expressions = source.ast.statements(file).slice(4).map(statement => source.ast.as.AsExpressionStatement(statement!)?.Expression);
  assert.ok(expressions[0] && expressions[1]);
  const sequence = sourceExpressionSequence(source.ast, expressions[0]);
  assert.deepEqual(sequence.map(expression => source.ast.text(source.ast.as.AsCallExpression(expression)?.Expression!)),
    ["first", "second", "third", "fourth"]);
  assert.ok(Object.isFrozen(sequence));
  const single = sourceExpressionSequence(source.ast, expressions[1]);
  assert.equal(single.length, 1);
  assert.equal(source.ast.operatorKindName(single[0]!), "KindPlusToken");
});
