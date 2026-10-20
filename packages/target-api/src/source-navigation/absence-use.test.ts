import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";
import { sourceAbsenceUse } from "./absence-use.js";

function fixture(expression: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    declare function effect(): void;
    function select(value: number | undefined, other: number | undefined) { return ${expression}; }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const callable = source.ast.statements(file).find(node => source.ast.is.IsFunctionDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === "select");
  assert.ok(callable);
  const parameter = source.ast.parameters(callable)[0];
  assert.ok(parameter);
  const uses = source.navigation.parameterUseSummary(parameter);
  assert.equal(uses?.uses.length, 1, expression);
  const reference = uses?.uses[0]?.reference;
  assert.ok(reference);
  return sourceAbsenceUse(reference, { ast: source.ast, semanticsFor: node => source.semantics.forNode(node) });
}

test("absence consumers select only the left coalescing operand through transparent syntax", () => {
  for (const operand of ["value", "(value)", "value satisfies number | undefined",
    "((value) satisfies number | undefined)"]) {
    assert.equal(fixture(`(${operand}) ?? other`), "coalesce", operand);
    assert.equal(fixture(`other ?? (${operand})`), undefined, operand);
  }
});

test("absence comparisons use checked nullish and void types on both sides of every equality operator", () => {
  for (const operator of ["==", "!=", "===", "!=="]) {
    for (const absence of ["null", "undefined", "void effect()"]) {
      for (const operand of ["value", "((value) satisfies number | undefined)"]) {
        assert.equal(fixture(`(${operand}) ${operator} (${absence})`), "comparison",
          `${operand} ${operator} ${absence}`);
        assert.equal(fixture(`(${absence}) ${operator} (${operand})`), "comparison",
          `${absence} ${operator} ${operand}`);
      }
    }
  }
});

test("ordinary value comparisons, typeof and returned values do not become absence consumers", () => {
  for (const expression of ["value === other", "other !== value", "value == 1", "1 != value",
    "typeof value", "value"]) {
    assert.equal(fixture(expression), undefined, expression);
  }
});
