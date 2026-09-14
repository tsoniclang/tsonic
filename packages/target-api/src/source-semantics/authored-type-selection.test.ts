import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Expression } from "../public/source.js";

test("authored union aliases retain exact whole groups after undefined narrowing", () => {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      type Region = { readonly kind: "dense"; readonly value: number } |
        { readonly kind: "remote"; readonly offset: number };
      type Same = Region;
      function whole(value: Region | undefined) {
        if (value === undefined) return;
        return value;
      }
      function partial(value: Region | undefined) {
        if (value === undefined || value.kind !== "dense") return;
        return value;
      }
      function duplicate(value: Region | Same | undefined) {
        if (value === undefined) return;
        return value;
      }
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const functions = source.ast.statements(file).slice(2);
  const selections = functions.map(declaration => {
    assert.ok(declaration);
    const parameter = source.ast.parameters(declaration)[0];
    assert.ok(parameter);
    const type = source.ast.typeNode(parameter);
    const body = source.ast.body(declaration);
    assert.ok(type && body);
    const returned = source.ast.statements(body)[1];
    assert.ok(returned);
    const expression = Node_Expression(source.ast, returned);
    assert.ok(expression);
    const semantics = source.semantics.forNode(expression);
    const selected = semantics.types.expressionType(expression);
    assert.ok(selected);
    return { type, result: semantics.types.authoredSelection(type, selected) };
  });
  const whole = selections[0]!;
  assert.equal(whole.result.kind, "authored-members");
  if (whole.result.kind !== "authored-members") return;
  assert.deepEqual(whole.result.nodes, [source.ast.children(whole.type)[0]]);
  assert.deepEqual(whole.result.selectedNullishTypes, []);
  assert.ok(Object.isFrozen(whole.result.nodes));
  assert.equal(selections[1]!.result.kind, "unrelated");
  assert.equal(selections[2]!.result.kind, "ambiguous");
});
