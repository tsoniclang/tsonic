import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/source-semantics/target-source-program.js";
import { sourceSequenceConsumptionRoot, sourceSequenceInputChoice } from "../../packages/target-api/dist/source-navigation/sequence-inputs.js";
import { createSourceSyntaxDomain } from "../../packages/target-api/dist/source-navigation/node-inventory.js";
import { selectSourceNativeValueGuard } from "../../packages/target-api/dist/source-semantics/native-value-guards.js";
import { selectSourceGuardedValueMembers, selectSourceNativeGuardResult } from "../../packages/target-api/dist/source-semantics/value-flow-conditions.js";

function fixture(text) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": text, "/src/foreign.ts": "export const foreign = 1;",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics).slice(0, 2048));
  assert.equal(checked.extensionDiagnostics.length, 0, "the original program has no extension rejection");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const foreign = checked.getSourceFile("/src/foreign.ts");
  assert.equal(file !== undefined && foreign !== undefined, true, "both original checked files exist");
  const nodes = [];
  const pending = [file];
  while (pending.length !== 0) {
    const node = pending.pop();
    nodes.push(node);
    const children = source.ast.children(node).filter(child => child !== undefined);
    for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]);
  }
  const context = { ast: source.ast, navigation: source.navigation, sourceFacts: source.sourceFacts,
    semanticsFor: node => source.semantics.forNode(node) };
  return { source, file, foreign, nodes, context };
}

test("finite checked nullish sequence choices retain every operand beyond the former syntax quota", () => {
  const count = 2300;
  const current = fixture(`declare const input: readonly number[] | undefined; const values = [...(${Array(count).fill("input").join(" ?? ")} ?? [])];`);
  const spread = current.nodes.find(node => current.source.ast.is.IsSpreadElement(node));
  const expression = current.source.ast.as.AsSpreadElement(spread)?.Expression;
  assert.equal(expression !== undefined, true, "the original spread operand exists");
  const choice = sourceSequenceInputChoice(current.source.ast, expression);
  assert.equal(choice !== undefined, true, "a finite checked source is not refused by a per-walk quota");
  assert.equal(choice.inputs.length, count + 1, "all original operands and the final empty array remain");
  assert.equal(choice.inputs.slice(0, count).every(node => current.source.ast.text(node) === "input"), true);
  assert.equal(choice.inputs.every(node => current.source.ast.getSourceFile(node) === current.file), true);
  assert.equal(choice.inputs.every((node, index) => index === 0 || current.source.ast.pos(choice.inputs[index - 1]) < current.source.ast.pos(node)), true);
  assert.equal(Object.isFrozen(choice) && Object.isFrozen(choice.inputs) && Object.isFrozen(choice.controlNodes), true);
  assert.equal(sourceSequenceConsumptionRoot(current.source.ast, choice.controlNodes.at(-1)) === spread, true,
    "the original deepest control retains its exact consuming spread");
});

test("native guard operands retain original checked identity through a finite deep transparent chain", () => {
  const count = 2300;
  const current = fixture(`declare const value: unknown; const selected = typeof ${"(".repeat(count)}value${")".repeat(count)} === "string";`);
  const comparison = current.nodes.find(node => current.source.ast.is.IsBinaryExpression(node));
  const reference = current.nodes.find(node => current.source.ast.is.IsIdentifier(node) && current.source.ast.text(node) === "value" &&
    current.source.ast.is.IsParenthesizedExpression(current.source.ast.parent(node)));
  const guard = selectSourceNativeValueGuard(current.context, comparison);
  assert.equal(guard?.kind, "typeof");
  assert.equal(guard?.sourceOperand === reference, true, "no copied operand or guessed native fact is introduced");
  assert.equal(guard?.value, "string");
  assert.equal(guard?.negated, false);
  assert.equal(Object.isFrozen(guard), true);
});

test("native boolean guard results traverse complete finite authored negation chains", () => {
  const current = fixture(`const selected = ${"!".repeat(2300)}true;`);
  const expression = current.nodes.find(node => current.source.ast.is.IsPrefixUnaryExpression(node));
  assert.equal(selectSourceNativeGuardResult(current.context, expression, () => undefined, () => undefined, () => undefined), true);
});

test("guarded members retain finite deep conditions and the binding's entire original checked use set", () => {
  const current = fixture(`declare function isArray(value: unknown): boolean; declare function observe(value: unknown): void;
    function run(value: unknown): void { if (${"!".repeat(2300)}isArray(value)) observe(value); }`);
  const call = current.nodes.map(node => current.source.semantics.forNode(node).operations.call(node))
    .find(operation => current.source.ast.text(operation?.sourceCallee.expression) === "observe");
  const reference = call?.sourceArguments[0]?.expression;
  assert.equal(reference !== undefined, true, "the original observed argument exists");
  const selected = selectSourceGuardedValueMembers(current.context, reference, ["array", "other"], expression => {
    const operation = current.source.semantics.forNode(expression).operations.call(expression);
    return current.source.ast.text(operation?.sourceCallee.expression) === "isArray" && operation.sourceArguments[0] !== undefined
      ? { sourceOperand: operation.sourceArguments[0].expression, predicate: "array" } : undefined;
  }, (member, predicate) => member === predicate);
  assert.deepEqual(selected, ["array"]);
  assert.equal(Object.isFrozen(selected), true);
});

test("finite syntax owners reject foreign operands, cyclic children and cyclic parent chains", () => {
  const current = fixture("declare const input: readonly number[] | undefined; const values = [...((input ?? []))];");
  const expression = current.nodes.find(node => current.source.ast.is.IsParenthesizedExpression(node));
  const contains = createSourceSyntaxDomain(current.source.ast, expression);
  assert.equal(contains(expression), true);
  assert.equal(contains(current.foreign), false, "same checked program is not same owning source file");
  assert.equal(createSourceSyntaxDomain({ getSourceFile: () => undefined }, expression)(expression), false,
    "a missing original source file is never an admitted default");
  const cyclic = { ...current.source.ast, as: { ...current.source.ast.as,
    AsParenthesizedExpression: node => node === expression ? { Expression: expression }
      : current.source.ast.as.AsParenthesizedExpression(node) } };
  assert.equal(sourceSequenceInputChoice(cyclic, expression), undefined, "cyclic original-child transport is unavailable");
  const foreign = { ...cyclic, as: { ...cyclic.as,
    AsParenthesizedExpression: node => node === expression ? { Expression: current.foreign }
      : current.source.ast.as.AsParenthesizedExpression(node) } };
  assert.equal(sourceSequenceInputChoice(foreign, expression), undefined, "foreign child transport is unavailable");
  const parentCycle = { ...current.source.ast, parent: node => node === expression ? expression : current.source.ast.parent(node) };
  assert.equal(sourceSequenceConsumptionRoot(parentCycle, expression), undefined, "cyclic original-parent transport is unavailable");
});
