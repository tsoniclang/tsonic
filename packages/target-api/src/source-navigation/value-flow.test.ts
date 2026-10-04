import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";

function fixture(body: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    declare function observe(value: readonly string[] | undefined): void;
    function select(flag: boolean, value: readonly string[] | undefined, other: readonly string[]) { ${body} }
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const callable = source.ast.statements(file).find(node => source.ast.is.IsFunctionDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === "select");
  assert.ok(callable);
  const parameter = source.ast.parameters(callable)[1];
  assert.ok(parameter);
  const uses = source.navigation.parameterUseSummary(parameter);
  assert.ok(uses);
  return { source, uses };
}

test("selected operand values retain return ownership through every native value selector", () => {
  for (const body of [
    "return flag ? value : [];", "return flag ? [] : value;", "return value ?? [];",
    "return flag && value;", "return flag || value;", "return (observe(other), value);",
    "return flag ? (value ?? []) : other;",
  ]) {
    const { source, uses } = fixture(body);
    assert.equal(uses.uses.length, 1, body);
    assert.equal(uses.uses[0]?.role, "return", body);
    assert.equal(uses.returned, true, body);
    const flow = source.navigation.expressionValueFlow(uses.uses[0]!.reference);
    assert.equal(flow.returned, true, body);
    assert.equal(flow.escapes, true, body);
  }
});

test("conditional aliases retain their exact destinations without inventing escape for local-only reads", () => {
  for (const escaped of [false, true]) {
    const { source, uses } = fixture(`const selected = flag ? value : []; ${escaped ? "return selected;" : "void selected;"}`);
    assert.equal(uses.uses[0]?.role, "storage");
    const flow = source.navigation.expressionValueFlow(uses.uses[0]!.reference);
    assert.equal(flow.aliasDeclarations.length, 1);
    assert.equal(flow.returned, escaped);
    assert.equal(flow.escapes, escaped);
    assert.equal(flow.storedOutsideBinding, false);
    assert.equal(Object.isFrozen(flow.aliasDeclarations), true);
  }
});

test("conditions, comparisons, member projections and discarded comma inputs are not returned values", () => {
  for (const body of [
    "return value ? other : [];", "return value === other;", "return value?.[0];",
    "return (observe(value), other);",
  ]) {
    const { source, uses } = fixture(body);
    assert.equal(uses.returned, false, body);
    assert.equal(source.navigation.expressionValueFlow(uses.uses[0]!.reference).returned, false, body);
  }
});
