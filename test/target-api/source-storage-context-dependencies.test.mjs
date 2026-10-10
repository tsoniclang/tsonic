import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/target-analysis/source-storage/queries.js";
import { createSourceStorageContextFootprints } from "../../packages/target-api/dist/target-analysis/source-storage/context-footprints.js";
import { Node_Initializer } from "../../packages/target-api/dist/source-navigation/index.js";

function checkedSource(text) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src", compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": text },
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
  return { source, file, nodes, declaration, call };
}

function selectedContext(body) {
  const { source, file, declaration, call } = checkedSource(`
function identity<Value>(value: Value): Value { return value; }
function consume<Value>(value: Value): Value { return value; }
function outer(left: {}, right: {}): {} { ${body} }
const left = {};
const right = {};
const output = outer(left, right);
`);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, [file], budget);
  const parent = transport.substitutions.forInvocation(declaration("outer"), call("outer"), transport.substitutions.empty, transport.substitutions.empty);
  assert.equal(parent !== undefined, true, "complete selected outer invocation");
  const selected = transport.substitutions.forInvocation(declaration("consume"), call("consume"), parent, parent);
  assert.equal(selected !== undefined, true, "complete selected consumer invocation");
  const formal = transport.subject(source.ast.parameters(declaration("consume"))[0], "input");
  const binding = transport.substitutions.selection(formal, selected);
  assert.equal(binding?.length === 1, true, "one exact actual input and its enclosing scope");
  const ports = createSourceStorageContextFootprints(budget, transport.contextualInputs, () => false);
  const context = ports.select(binding[0].subject)?.ports;
  assert.equal(context !== undefined, true, "complete demanded caller footprint, including captured and contained values");
  assert.equal(budget.failure() === undefined, true, "all original finite guards remain intact");
  const parameter = index => transport.subject(source.ast.parameters(declaration("outer"))[index], "input");
  return { context, left: parameter(0), right: parameter(1) };
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

for (const [name, members, write, read, helpers = ""] of [
  ["getter", "get current(): {} { return this.value; }", "box.value = token;", "box.current"],
  ["method", "current(): {} { return this.value; }", "box.value = token;", "box.current()"],
  ["helper write", "get current(): {} { return this.value; }", "write(box, token);", "box.current",
    "function write(box: Box, token: {}): void { box.value = token; }"],
  ["method write", "set(value: {}): void { this.value = value; } get current(): {} { return this.value; }",
    "box.set(token);", "box.current"],
  ["accessor write", "get current(): {} { return this.value; } set current(value: {}) { this.value = value; }",
    "box.current = token;", "box.current"],
]) {
  test(`selected ${name} result retains written token provenance from only its own caller`, () => {
    const { source, file, nodes } = checkedSource(`
class Box { value: {} = {}; ${members} }
function consume<Value>(value: Value): Value { return value; }
${helpers}
function outer(box: Box, token: {}): {} { ${write} return consume(${read}); }
const firstToken = {};
const secondToken = {};
const first = outer(new Box(), firstToken);
const second = outer(new Box(), secondToken);
`);
    const variable = name => nodes.find(node => source.ast.is.IsVariableDeclaration(node) &&
      source.ast.text(source.ast.name(node)) === name);
    const storage = createSourceStorageQuery(source, [file]);
    const initialized = name => Node_Initializer(source.ast, variable(name));
    const subject = name => {
      const selected = storage.subjectFor(initialized(name));
      assert.equal(selected.kind === "resolved", true, name);
      return selected.subject;
    };
    for (const [name, expected, unrelated] of [["first", "firstToken", "secondToken"], ["second", "secondToken", "firstToken"]]) {
      const selected = storage.closedOriginsFor(subject(name));
      assert.equal(selected.kind === "complete", true, "the exact selected caller has a closed domain");
      assert.equal(selected.origins.some(origin => origin.subject === subject(expected)), true,
        "selected caller's stored token survives");
      assert.equal(selected.origins.some(origin => origin.subject === subject(unrelated)), false,
        "other caller's stored token is not imported");
    }
    assert.equal(storage.failureReason() === undefined, true, "all original finite guards remain intact");
  });
}
