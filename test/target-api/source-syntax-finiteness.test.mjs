import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/source-semantics/target-source-program.js";
import { sourceSequenceConsumptionRoot, sourceSequenceInputChoice } from "../../packages/target-api/dist/source-navigation/sequence-inputs.js";
import { createSourceNodeInventory, createSourceSyntaxDomain } from "../../packages/target-api/dist/source-navigation/node-inventory.js";
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
  return { checked, source, file, foreign, nodes, context };
}

test("finite checked nullish sequence choices retain every operand beyond the former syntax quota", () => {
  const count = 2300;
  const current = fixture(`declare const input: readonly number[] | undefined;
    const values = [${Array(count).fill("...(input ?? [])").join(",")}];`);
  const spread = current.nodes.find(node => current.source.ast.is.IsSpreadElement(node));
  const expressions = current.nodes.filter(node => current.source.ast.is.IsBinaryExpression(node));
  assert.equal(expressions.length, count, "all operands come from shallow checked source");
  const links = new Map(expressions.map((node, index) => {
    const binary = current.source.ast.as.AsBinaryExpression(node);
    return [node, { Left: binary.Left, Right: expressions[index + 1] ?? binary.Right }];
  }));
  const parents = new Map(expressions.slice(1).map((node, index) => [node, expressions[index]]));
  const ast = { ...current.source.ast,
    parent: node => parents.get(node) ?? current.source.ast.parent(node),
    as: { ...current.source.ast.as,
      AsBinaryExpression: node => links.get(node) ?? current.source.ast.as.AsBinaryExpression(node) } };
  const choice = sourceSequenceInputChoice(ast, expressions[0]);
  assert.equal(choice !== undefined, true, "a finite checked source is not refused by a per-walk quota");
  assert.equal(choice.inputs.length, count + 1, "all original operands and the final empty array remain");
  assert.equal(choice.inputs.slice(0, count).every(node => current.source.ast.text(node) === "input"), true);
  assert.equal(choice.inputs.every(node => current.source.ast.getSourceFile(node) === current.file), true);
  assert.equal(choice.inputs.every((node, index) => index === 0 || current.source.ast.pos(choice.inputs[index - 1]) < current.source.ast.pos(node)), true);
  assert.equal(Object.isFrozen(choice) && Object.isFrozen(choice.inputs) && Object.isFrozen(choice.controlNodes), true);
  assert.equal(sourceSequenceConsumptionRoot(ast, choice.controlNodes.at(-1)) === spread, true,
    "the original deepest control retains its exact consuming spread");
});

test("native guard operands retain original checked identity through a finite deep transparent chain", () => {
  const count = 2300;
  const current = fixture(`declare const value: unknown; const operands = [${Array(count).fill("(value)").join(",")}];
    const selected = typeof value === "string";`);
  const comparison = current.nodes.find(node => current.source.ast.is.IsBinaryExpression(node));
  const typeOf = current.nodes.find(node => current.source.ast.is.IsTypeOfExpression(node));
  const reference = current.source.ast.as.AsTypeOfExpression(typeOf)?.Expression;
  const operands = current.nodes.filter(node => current.source.ast.is.IsParenthesizedExpression(node));
  assert.equal(reference !== undefined && operands.length === count, true, "all operands have original checked identities");
  const links = new Map(operands.map((node, index) => [node, operands[index + 1] ?? reference]));
  const ast = { ...current.source.ast, as: { ...current.source.ast.as,
    AsTypeOfExpression: node => node === typeOf ? { Expression: operands[0] } : current.source.ast.as.AsTypeOfExpression(node),
    AsParenthesizedExpression: node => links.has(node) ? { Expression: links.get(node) }
      : current.source.ast.as.AsParenthesizedExpression(node) } };
  const guard = selectSourceNativeValueGuard({ ...current.context, ast }, comparison);
  assert.equal(guard?.kind, "typeof");
  assert.equal(guard?.sourceOperand === reference, true, "no copied operand or guessed native fact is introduced");
  assert.equal(guard?.value, "string");
  assert.equal(guard?.negated, false);
  assert.equal(Object.isFrozen(guard), true);
});

test("native boolean guard results traverse complete finite authored negation chains", () => {
  const count = 2300;
  const current = fixture(`const selected = [${Array(count).fill("!true").join(",")}];`);
  const expressions = current.nodes.filter(node => current.source.ast.is.IsPrefixUnaryExpression(node));
  assert.equal(expressions.length, count, "the binder sees only shallow authored expressions");
  const terminal = current.source.ast.as.AsPrefixUnaryExpression(expressions.at(-1)).Operand;
  const links = new Map(expressions.map((node, index) => [node, expressions[index + 1] ?? terminal]));
  const ast = { ...current.source.ast, as: { ...current.source.ast.as,
    AsPrefixUnaryExpression: node => links.has(node) ? { Operand: links.get(node) }
      : current.source.ast.as.AsPrefixUnaryExpression(node) } };
  assert.equal(selectSourceNativeGuardResult({ ...current.context, ast }, expressions[0], () => undefined, () => undefined, () => undefined), true);
});

test("guarded members retain finite deep conditions and the binding's entire original checked use set", () => {
  const count = 2300;
  const current = fixture(`declare function isArray(value: unknown): boolean; declare function observe(value: unknown): void;
    const operands = [${Array(count - 1).fill("!true").join(",")}];
    function run(value: unknown): void { if (!!isArray(value)) observe(value); }`);
  const call = current.nodes.map(node => current.source.semantics.forNode(node).operations.call(node))
    .find(operation => current.source.ast.text(operation?.sourceCallee.expression) === "observe");
  const reference = call?.sourceArguments[0]?.expression;
  assert.equal(reference !== undefined, true, "the original observed argument exists");
  const flow = current.source.semantics.forNode(reference).operations.flowConditions(reference);
  const condition = flow?.conditions[0]?.expression;
  const guardCall = current.nodes.find(node => current.source.ast.is.IsCallExpression(node) &&
    current.source.ast.text(current.source.semantics.forNode(node).operations.call(node)?.sourceCallee.expression) === "isArray");
  assert.equal(condition !== undefined && current.source.ast.is.IsPrefixUnaryExpression(condition) && guardCall !== undefined, true);
  const operands = current.nodes.filter(node => current.source.ast.is.IsPrefixUnaryExpression(node) &&
    current.source.ast.kindName(current.source.ast.as.AsPrefixUnaryExpression(node)?.Operand) === "KindTrueKeyword");
  const expressions = [condition, ...operands];
  assert.equal(expressions.length, count, "the same checked condition enters a finite synthetic child transport");
  const links = new Map(expressions.map((node, index) => [node, expressions[index + 1] ?? guardCall]));
  const ast = { ...current.source.ast, as: { ...current.source.ast.as,
    AsPrefixUnaryExpression: node => links.has(node) ? { Operand: links.get(node) }
      : current.source.ast.as.AsPrefixUnaryExpression(node) } };
  const selected = selectSourceGuardedValueMembers({ ...current.context, ast }, reference, ["array", "other"], expression => {
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
  const guards = fixture(`declare const value: unknown; const selected = (typeof value) === "string"; const truth = !true;
    declare function isArray(value: unknown): boolean; declare function observe(value: unknown): void;
    function run(value: unknown): void { if (!!isArray(value)) observe(value); }`);
  const comparison = guards.nodes.find(node => guards.source.ast.is.IsBinaryExpression(node));
  const operand = guards.source.ast.as.AsBinaryExpression(comparison)?.Left;
  assert.equal(guards.source.ast.is.IsParenthesizedExpression(operand), true);
  const nativeCycle = { ...guards.source.ast, as: { ...guards.source.ast.as,
    AsParenthesizedExpression: node => node === operand ? { Expression: operand }
      : guards.source.ast.as.AsParenthesizedExpression(node) } };
  assert.equal(selectSourceNativeValueGuard({ ...guards.context, ast: nativeCycle }, comparison) === undefined, true,
    "native guard transparent operands reject cycles");
  const negation = guards.nodes.find(node => guards.source.ast.is.IsPrefixUnaryExpression(node));
  const booleanCycle = { ...guards.source.ast, as: { ...guards.source.ast.as,
    AsPrefixUnaryExpression: node => node === negation ? { Operand: negation }
      : guards.source.ast.as.AsPrefixUnaryExpression(node) } };
  assert.equal(selectSourceNativeGuardResult({ ...guards.context, ast: booleanCycle }, negation,
    () => undefined, () => undefined, () => undefined), undefined, "native guard results reject cycles");
  const observed = guards.nodes.map(node => guards.source.semantics.forNode(node).operations.call(node))
    .find(operation => guards.source.ast.text(operation?.sourceCallee.expression) === "observe");
  const reference = observed?.sourceArguments[0]?.expression;
  const condition = guards.source.semantics.forNode(reference).operations.flowConditions(reference)?.conditions[0]?.expression;
  assert.equal(condition !== undefined && guards.source.ast.is.IsPrefixUnaryExpression(condition), true);
  const valueCycle = { ...guards.source.ast, as: { ...guards.source.ast.as,
    AsPrefixUnaryExpression: node => node === condition ? { Operand: condition }
      : guards.source.ast.as.AsPrefixUnaryExpression(node) } };
  assert.equal(selectSourceGuardedValueMembers({ ...guards.context, ast: valueCycle }, reference,
    ["array", "other"], () => undefined, () => undefined) === undefined, true, "guarded value conditions reject cycles");
  let visits = 0;
  const inventory = createSourceNodeInventory({ containsSourceFile: current.checked.containsSourceFile,
    ast: { ...current.source.ast, forEachChild(node, visit) { visits += 1; visit(node); } } }, [current.file]);
  assert.equal(inventory.nodes.length === 1 && inventory.nodes[0] === current.file, true,
    "canonical inventory visits a cyclic original node once, never expands it indefinitely");
  assert.equal(visits, 1);
  assert.equal(Object.isFrozen(inventory.nodes), true);
});
