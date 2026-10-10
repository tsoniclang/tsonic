import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Expression } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";

test("checked invocation targets retain the authored callee value independently of the selected implementation declaration", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {};
      function make(token: object) { return { read: () => token }; }
      function identity<Value>(value: Value): Value { return value; }
      class Box { constructor(public value: object) {} read(): object { return this.value; } }
      const original = {}; const replacement = {};
      const owner = make(original); const other = make(replacement);
      const direct = owner.read(); const computed = other["read"]();
      const alias = owner.read; const aliased = alias();
      const returned = identity(other.read)();
      const box = new Box(original); const member = box.read();
    ` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "ordinary source checks without target annotations");
  const source = createTargetSourceProgram(checked);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, source.navigation.sourceFiles, budget);
  assert.equal(transport.invocations.size === 9, true, "every direct, nested, constructor and property invocation is covered");
  let selections = 0;
  for (const invocation of transport.invocations) {
    const operand = Node_Expression(source.ast, invocation);
    const target = transport.invocationTargets.get(invocation);
    assert.equal(operand !== undefined && target !== undefined && target === transport.subjectFor(operand), true,
      "the exact callee operand supplies the value instance, while checked signature identity remains separate");
    assert.equal(transport.invocationDeclarations.has(invocation), true, "selected declaration evidence remains available");
    if (source.ast.is.IsPropertyAccessExpression(operand) || source.ast.is.IsElementAccessExpression(operand)) {
      selections += 1;
      assert.equal(target.node === operand && target.kind === "value", true,
        "property-held callable values retain the read occurrence and its checked receiver");
    }
  }
  assert.equal(selections === 3, true, "dot, computed and native-method callee occurrences all retain their receivers");
  assert.equal(budget.failure() === undefined, true, "the original finite guards remain intact");
});

test("intrinsic base constructor dispatch retains the exact checked heritage callee rather than a fabricated callable value", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {};
      class Base { constructor(value: object) {} }
      class Derived extends Base { constructor(value: object) { super(value); } }
      const original = {}; const value = new Derived(original);
    ` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true);
  const source = createTargetSourceProgram(checked);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const transport = createSourceStorageTransport(source, source.navigation.sourceFiles, budget);
  const invocation = [...transport.invocations].find(node => source.ast.kindName(Node_Expression(source.ast, node)) === "KindSuperKeyword");
  assert.equal(invocation !== undefined, true);
  const derived = transport.visitedNodes.find(node => source.ast.is.IsClassDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === "Derived");
  const heritage = source.navigation.declaredHeritage(derived);
  assert.equal(heritage.kind === "resolved", true);
  const edge = heritage.edges.find(edge => edge.kind === "extends");
  const expression = source.ast.as.AsExpressionWithTypeArguments(edge.heritage).Expression;
  const target = transport.invocationTargets.get(invocation);
  assert.equal(target === transport.subjectFor(Node_Expression(source.ast, invocation)), true);
  assert.equal(transport.incomingFor(target).has(transport.subjectFor(expression)), true,
    "the exact base-class value supplies the constructor callee's captured class context");
  const declaration = transport.invocationDeclarations.get(invocation);
  const selected = source.navigation.callableImplementation(declaration);
  assert.equal(selected.kind === "resolved" && transport.invocationImplementations(invocation).has(selected.implementation.declaration), true,
    "selected constructor body identity is retained independently of class value transport");
  assert.equal(budget.failure() === undefined, true);
});
