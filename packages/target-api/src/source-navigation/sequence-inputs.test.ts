import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";
import { sourceSequenceConsumptionRoot, sourceSequenceInputChoice, sourceSequenceInputIsEmpty } from "./sequence-inputs.js";

test("borrowed sequence alternatives retain source order, effects and exact control ownership", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    declare const first: readonly string[] | undefined;
    declare const second: readonly string[] | undefined;
    declare function effectful(): string[];
    const values = ["before", ...((first ?? second) ?? effectful()), "after"];
    const empty = [...(first ?? [])];
    const evaluatedEmpty = [...(first ?? effectful())];
    const ordinary = first ?? second;
    const call = effectful();
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const spreads: Node[] = [];
  const binaries: Node[] = [];
  const visit = (node: Node): void => {
    if (source.ast.is.IsSpreadElement(node)) spreads.push(node);
    if (source.ast.is.IsBinaryExpression(node)) binaries.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const expression = source.ast.as.AsSpreadElement(spreads[0]!)?.Expression;
  assert.ok(expression);
  const choice = sourceSequenceInputChoice(source.ast, expression);
  assert.ok(choice);
  assert.equal(choice.inputs.length, 3);
  assert.deepEqual(choice.inputs.map(node => source.ast.kindName(node)), ["KindIdentifier", "KindIdentifier", "KindCallExpression"]);
  assert.ok(choice.inputs.every((node, index) => index === 0 || source.ast.pos(choice.inputs[index - 1]!) < source.ast.pos(node)));
  assert.ok(Object.isFrozen(choice) && Object.isFrozen(choice.inputs) && Object.isFrozen(choice.controlNodes));
  for (const node of choice.controlNodes) assert.equal(sourceSequenceConsumptionRoot(source.ast, node), spreads[0]);
  const emptyOperand = source.ast.as.AsSpreadElement(spreads[1]!)?.Expression;
  assert.ok(emptyOperand);
  const empty = sourceSequenceInputChoice(source.ast, emptyOperand);
  assert.ok(empty);
  assert.ok(sourceSequenceInputIsEmpty(source.ast, empty.inputs[1]!));
  assert.ok(choice.inputs.every(node => !sourceSequenceInputIsEmpty(source.ast, node)));
  assert.equal(sourceSequenceConsumptionRoot(source.ast, binaries[binaries.length - 1]!), undefined);
});
