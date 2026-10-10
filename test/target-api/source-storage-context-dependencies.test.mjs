import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

function selectedContext(body) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src", compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `
function identity<Value>(value: Value): Value { return value; }
function consume<Value>(value: Value): Value { return value; }
function outer(left: {}, right: {}): {} { ${body} }
const left = {};
const right = {};
const output = outer(left, right);
` },
  }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = source.navigation.sourceFiles.find(file => source.ast.getFileName(file) === "/src/index.ts");
  assert.equal(file !== undefined, true, "exact checked source file");
  const nodes = [];
  const visit = node => { nodes.push(node); source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); }); };
  visit(file);
  const declaration = name => nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
  const call = name => nodes.find(node => {
    if (!source.ast.is.IsCallExpression(node)) return false;
    const expression = source.ast.as.AsCallExpression(node).Expression;
    return source.ast.is.IsIdentifier(expression) && source.ast.text(expression) === name;
  });
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, [file], budget);
  const parent = transport.substitutions.forInvocation(declaration("outer"), call("outer"), transport.substitutions.empty);
  assert.equal(parent !== undefined, true, "complete selected outer invocation");
  const selected = transport.substitutions.forInvocation(declaration("consume"), call("consume"), parent);
  assert.equal(selected !== undefined, true, "complete selected consumer invocation");
  const binding = selected.get(transport.subject(source.ast.parameters(declaration("consume"))[0]));
  assert.equal(binding !== undefined, true, "exact actual-input binding");
  assert.equal(budget.failure() === undefined, true, "all original finite guards remain intact");
  const parameter = index => transport.subject(source.ast.parameters(declaration("outer"))[index]);
  return { context: binding.context, left: parameter(0), right: parameter(1) };
}

for (const [name, body, expected] of [
  ["selected identity", `const first = identity(left); const second = identity(right); return consume(first);`, "left"],
  ["nested container", `const first = identity([left]); const second = identity([right]); return consume(first);`, "left"],
  ["lexical callback capture", `const callback = () => right; const first = identity(left); return consume(callback);`, "right"],
  ["selected receiver capture", `const reader = { read: () => right }; const first = identity(left); return consume(reader.read());`, "right"],
  ["default argument capture", `function read(value: {} = right): {} { return value; } const first = identity(left); return consume(read());`, "right"],
  ["authored method capture", `const reader = { read(): {} { return right; } }; const first = identity(left); return consume(reader.read());`, "right"],
  ["authored getter capture", `const reader = { get value(): {} { return right; } }; const first = identity(left); return consume(reader.value);`, "right"],
  ["constructor capture", `class Reader { value: {}; constructor() { this.value = right; } } const first = identity(left); return consume(new Reader());`, "right"],
]) {
  test(`caller context preserves ${name} without importing another invocation's formal inputs`, () => {
    const selected = selectedContext(body);
    assert.equal(selected.context.has(selected[expected]), true, "the exact required enclosing formal remains");
    assert.equal(selected.context.has(selected[expected === "left" ? "right" : "left"]), false,
      "an unrelated sibling invocation cannot manufacture a caller dependency");
  });
}
