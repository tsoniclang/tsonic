import assert from "node:assert/strict";

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

export { fixture };
