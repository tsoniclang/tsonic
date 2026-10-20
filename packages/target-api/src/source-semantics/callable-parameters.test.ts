import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { sourceCallableParameterEvidence } from "./callable-parameters.js";

test("callable evidence preserves omission, syntax and initializers independently", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `
      function trailing(value: void | string): void {}
      function requiredUndefined(value: undefined | string): void {}
      function requiredNull(value: null | string): void {}
      function defaults(first = 1, second: string): void {}
      function optional(value?: string): void {}
      function tuples(...values: [void | string, number?]): void {}
      trailing(); requiredUndefined(undefined); requiredNull(null);
      defaults(undefined, "value"); optional(); tuples();
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  const diagnostics = checked.diagnostics.filter(diagnostic => diagnostic !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const expected = [
    [{ parameterKind: "required", acceptsOmission: true, omissionKind: "undefined" }],
    [{ parameterKind: "required", acceptsOmission: false, omissionKind: "required" }],
    [{ parameterKind: "required", acceptsOmission: false, omissionKind: "required" }],
    [{ parameterKind: "required", acceptsOmission: false, omissionKind: "initializer" },
      { parameterKind: "required", acceptsOmission: false, omissionKind: "required" }],
    [{ parameterKind: "optional", acceptsOmission: true, omissionKind: "undefined" }],
    [{ parameterKind: "required", acceptsOmission: true, omissionKind: "undefined" },
      { parameterKind: "optional", acceptsOmission: true, omissionKind: "undefined" }],
  ];
  const declarations = source.ast.statements(file).filter((node): node is Node =>
    node !== undefined && source.ast.is.IsFunctionDeclaration(node));
  for (const [index, declaration] of declarations.entries()) {
    const name = source.ast.name(declaration);
    assert.ok(name);
    const type = semantics.types.expressionType(name);
    assert.ok(type);
    const signature = semantics.types.signatureInfos(type, "call")[0];
    const callable = semantics.types.callable(type);
    assert.ok(signature && callable);
    const parameters = signature.parameters.map(parameter => sourceCallableParameterEvidence(parameter, source.ast));
    assert.equal(parameters.length === callable.parameters.length && parameters.every((parameter, position) => {
      const selected = callable.parameters[position];
      return selected !== undefined && parameter.sourceSymbol === selected.sourceSymbol &&
        parameter.type === selected.type && parameter.declaration === selected.declaration &&
        parameter.omissionKind === selected.omissionKind && parameter.acceptsOmission === selected.acceptsOmission;
    }), true, source.ast.text(name));
    assert.deepEqual(parameters.map(({ parameterKind, acceptsOmission, omissionKind }) =>
      ({ parameterKind, acceptsOmission, omissionKind })), expected[index], source.ast.text(name));
    assert.equal(Object.isFrozen(callable.parameters) && parameters.every(Object.isFrozen), true);
  }
  for (const statement of source.ast.statements(file)) {
    if (statement === undefined || !source.ast.is.IsExpressionStatement(statement)) continue;
    const node = source.ast.as.AsExpressionStatement(statement)?.Expression;
    assert.ok(node);
    const call = semantics.operations.call(node);
    assert.ok(call);
    const slots = semantics.operations.callParameterSlots(call);
    assert.ok(slots);
    const selected = semantics.types.signatureParameterInfos(call.selectedSignature);
    assert.deepEqual(slots.map(slot => slot.form), selected.map(parameter =>
      parameter.parameterKind === "rest" ? "rest" : parameter.acceptsOmission ? "optional" : "required"));
  }
});
