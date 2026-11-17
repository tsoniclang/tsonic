import assert from "node:assert/strict";
import test from "node:test";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { sourceDescriptorInputFixture } from "../host/fixtures/source-descriptor-input.mjs";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

const program = `
      function trailing(value: void | string): void {}
      function requiredUndefined(value: undefined | string): void {}
      function requiredNull(value: null | string): void {}
      function defaults(first = 1, second: string): void {}
      function optional(value?: string): void {}
      function tuples(...values: [void | string, number?]): void {}
      trailing(); requiredUndefined(undefined); requiredNull(null);
      defaults(undefined, "value"); optional(); tuples();
`;

function resolved(result, label) {
  assert.equal(result.kind, "resolved", result.kind === "refused" ? `${label}: ${result.message}` : label);
  return result.value;
}

function assertOriginalParameterInputs() {
  const current = sourceDescriptorInputFixture({ "/src/index.ts": program });
  const file = current.checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true);
  const queries = current.checked.getSourceFileQueries(file);
  const declarations = current.ast.statements(file).filter(node => node !== undefined && current.ast.is.IsFunctionDeclaration(node));
  assert.equal(declarations.length, 6);
  const expected = [
    [{ parameterKind: "required", acceptsOmission: true, initializer: false }],
    [{ parameterKind: "required", acceptsOmission: false, initializer: false }],
    [{ parameterKind: "required", acceptsOmission: false, initializer: false }],
    [{ parameterKind: "required", acceptsOmission: false, initializer: true },
      { parameterKind: "required", acceptsOmission: false, initializer: false }],
    [{ parameterKind: "optional", acceptsOmission: true, initializer: false }],
    [{ parameterKind: "required", acceptsOmission: true, initializer: false },
      { parameterKind: "optional", acceptsOmission: true, initializer: false }],
  ];
  for (const [index, declaration] of declarations.entries()) {
    const label = current.ast.text(current.ast.name(declaration));
    const component = current.input.syntax(declaration);
    const description = current.input.describe(component);
    assert.equal(description.kind === "structure" && description.calls.length === 1, true, label);
    const original = queries.typeShape.getSignatureInfos(current.identities.checkedComponent(component), "call")[0];
    assert.equal(original !== undefined, true, label);
    const parameters = queries.typeShape.getSignatureParameterInfos(original.signature);
    assert.equal(parameters.length, expected[index].length, label);
    assert.equal(Object.isFrozen(original.parameters) && original.parameters.every(Object.isFrozen), true, label);
    assert.equal(Object.isFrozen(description.calls[0].parameters) && description.calls[0].parameters.every(Object.isFrozen), true, label);
    for (const [position, parameter] of parameters.entries()) {
      const observed = original.parameters[position];
      const retained = description.calls[0].parameters[position];
      assert.equal(observed !== undefined && retained !== undefined, true, label);
      assert.equal(parameter.sourceSymbol === observed.sourceSymbol && parameter.type === observed.type &&
        parameter.declaration === observed.declaration, true, `${label}: exact original source symbol, type and declaration`);
      assert.equal(retained.declaration === observed.declaration &&
        current.identities.checkedComponent(retained.value) === observed.type, true,
      `${label}: the private gateway retains the actual observed child, not a synthetic omission answer`);
      assert.equal(parameter.parameterKind, expected[index][position].parameterKind, label);
      assert.equal(parameter.acceptsOmission, expected[index][position].acceptsOmission, label);
      const initializer = parameter.declaration !== undefined && current.ast.is.IsParameterDeclaration(parameter.declaration)
        ? current.ast.as.AsParameterDeclaration(parameter.declaration)?.Initializer : undefined;
      assert.equal(initializer !== undefined, expected[index][position].initializer,
        `${label}: initializer syntax is independent of kind and factual omission availability`);
    }
  }
}

test("callable evidence preserves omission, syntax and initializers independently", () => {
  assertOriginalParameterInputs();
  const target = { id: "csharp", options: { outputType: "Library" } };
  const checked = checkSourceProgramFixture({
    project: { entryPoint: "index.ts", rootDir: ".", targets: [target] },
    projectDirectory: "/src", target, targetPack: createCsharpTargetPack(),
    paths: { projectFilePath: "/src/tsonic.json", projectRoot: "/src", outputRoot: "/out",
      targetOutputRoot: "/out/csharp", cacheRoot: "/out/cache" },
    selectedCapabilities: [], selectedSurfaces: [], currentDirectory: "/src", files: { "/src/index.ts": program },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  });
  assert.equal(checked.kind, "resolved", checked.diagnostics.map(issue => issue.message).join("\n").slice(0, 4096));
  assert.equal(checked.diagnostics.length, 0, "all six original calls check through the normal Host boundary");
  const source = checked.value;
  const { ast, facts } = source;
  const file = source.sourceFiles.find(file => ast.getFileName(file) === "/src/index.ts");
  assert.equal(file !== undefined, true);
  const declarations = ast.statements(file).filter(node => node !== undefined && ast.is.IsFunctionDeclaration(node));
  assert.equal(declarations.length, 6);
  const expected = [["required"], ["required"], ["required"], ["required", "required"], ["optional"], ["rest"]];
  for (const [index, declaration] of declarations.entries()) {
    const label = ast.text(ast.name(declaration));
    const slot = resolved(facts.values.declaredSlot(declaration), `${label}: original callable declaration`);
    assert.equal(slot.origin.kind === "declaration" && slot.origin.declaration === declaration, true, label);
    const body = resolved(facts.descriptors.definition(slot.type), `${label}: complete callable head`);
    assert.equal(body.type.kind === "callable" && body.type.calls.length === 1, true, label);
    const signature = body.type.calls[0];
    assert.equal(signature.identity.declaration === declaration, true, label);
    assert.deepEqual(signature.parameters.map(parameter => parameter.kind), expected[index], label);
    assert.equal(Object.isFrozen(signature.parameters) && signature.parameters.every(Object.isFrozen), true, label);
    assert.equal(signature.parameters.every((parameter, position) => parameter.declaration === ast.parameters(declaration)[position]), true, label);
    for (const [position, parameter] of signature.parameters.entries()) {
      const child = resolved(facts.descriptors.component(body,
        { kind: "parameter", signature: signature.identity, index: position }), `${label}: original formal ${position}`);
      assert.equal(child.type === parameter.type, true, label);
      facts.descriptors.assertEvidence(child);
      if (index === 5) {
        assert.equal(child.type.kind, "tuple");
        assert.deepEqual(child.type.elements.map(element => element.kind), ["required", "optional"],
          "the original rest tuple retains both effective omission places without erasing the original rest parameter");
        for (const elementIndex of [0, 1]) {
          const element = resolved(facts.descriptors.component(child, { kind: "tuple-element", index: elementIndex }),
            `tuples: original element ${elementIndex}`);
          assert.equal(element.type === child.type.elements[elementIndex].type, true);
        }
      }
    }
  }
  const calls = ast.statements(file).filter(node => node !== undefined && ast.is.IsExpressionStatement(node))
    .map(statement => ast.as.AsExpressionStatement(statement)?.Expression);
  assert.equal(calls.length, 6, "all original omission, explicit-absence and initializer calls remain");
  const expectedArguments = [0, 1, 1, 2, 0, 0];
  for (const [index, call] of calls.entries()) {
    assert.equal(call !== undefined && ast.is.IsCallExpression(call), true);
    const application = resolved(facts.applications.application(call), `original call ${index}`);
    assert.equal(application.identity.invocation === call && application.identity.signature.declaration === declarations[index], true);
    const callee = resolved(facts.descriptors.definition(application.callee.value), `original call ${index}: complete callee`);
    assert.equal(callee.type.kind === "callable" && callee.type.calls.length === 1, true);
    const signature = callee.type.calls[0];
    assert.equal(signature.identity === application.identity.signature, true);
    assert.deepEqual(signature.parameters.map(parameter => parameter.kind), expected[index],
      "the selected callable retains every original formal even when no argument was supplied");
    const authored = ast.arguments(call).filter(node => node !== undefined);
    assert.equal(application.sourceArguments.length, expectedArguments[index]);
    assert.equal(application.arguments.length, expectedArguments[index], "omission never fabricates an evaluated argument place");
    assert.equal(application.sourceArguments.every((argument, position) => argument.occurrence === authored[position]), true);
    for (const [position, argument] of application.arguments.entries()) {
      const parameter = ast.parameters(declarations[index])[position];
      assert.equal(argument.sourceArgument === authored[position] && argument.effectiveArgument === authored[position] &&
        argument.sourceArgumentIndex === position && argument.effectiveArgumentIndex === position, true);
      assert.equal(argument.parameter.signature === application.identity.signature && argument.parameter.index === position &&
        argument.parameter.declaration === parameter && argument.parameter.form === "parameter", true);
      const origin = argument.destination.declaration.origin;
      assert.equal(origin.kind === "parameter" && origin.signature === application.identity.signature &&
        origin.index === position && origin.declaration === parameter, true);
      facts.descriptors.assertEvidence(argument.source);
      facts.descriptors.assertEvidence(argument.destination.declaration.type);
      facts.descriptors.assertEvidence(argument.destination.applied);
    }
  }
});
