import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics, sourcePrimitive } from "@tsonic/tsts";
import { TargetCompilerResourceLimitFailure } from "@tsonic/target-api/artifacts";
import { sourceTypeExpansionBudget } from "../../packages/target-api/dist/source-semantics/type-expansion-budget.js";
import { sourceFlowOwnerFixture } from "../host/fixtures/source-flow-owner.mjs";

test("source order uses exact authored starts and one preorder tie breaker", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "export const first = 1; export const second = 2;",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0,
    formatDiagnostics(checked.diagnostics.filter(issue => issue !== undefined)).slice(0, 2048));
  const { flow } = sourceFlowOwnerFixture({ checked, apiFacts: undefined, profileFiles: [], safetyProviders: [] });
  const { ast } = checked;
  const first = flow.context.nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)) === "first");
  const second = flow.context.nodes.find(node => ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)) === "second");
  assert.equal(first !== undefined && second !== undefined, true, "both original declarations remain in the one retained context");
  const firstOrder = flow.context.order(first);
  const secondOrder = flow.context.order(second);
  assert.equal(firstOrder.start < secondOrder.start && firstOrder.preorder < secondOrder.preorder, true);
  const firstRange = ast.authoredRange(first);
  const secondRange = ast.authoredRange(second);
  assert.equal(firstRange.kind === "authored" && secondRange.kind === "authored" &&
    firstOrder.start === firstRange.start && secondOrder.start === secondRange.start, true,
  "the original authored starts are not replaced with preorder ordinals");
  assert.equal(firstOrder.preorder === flow.context.nodes.indexOf(first) &&
    secondOrder.preorder === flow.context.nodes.indexOf(second), true, "one retained preorder resolves source-position ties");
  assert.equal(Object.isFrozen(firstOrder) && Object.isFrozen(secondOrder), true);
});

test("expanding alias recursion uses the shared declared resource budget rather than a silent cut", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/node_modules/@test/words/package.json": JSON.stringify({ name: "@test/words", version: "1.0.0", type: "module", exports: { ".": "./index.d.ts" } }),
    "/src/node_modules/@test/words/index.d.ts": "export type int32 = number; export type float32 = number;",
    "/src/index.ts": 'import type { int32, float32 } from "@test/words"; type Expanding<Value> = { child: Expanding<Value[]> }; declare const expanded: Expanding<int32>;',
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{ moduleSpecifier: "@test/words", packageName: "@test/words",
    exports: [sourcePrimitive("int32", "int32", "number", true, 32), sourcePrimitive("float32", "float32", "number", true, 32)] }] })] } }).checkSource();
  assert.equal(checked.diagnostics.length, 0,
    formatDiagnostics(checked.diagnostics.filter(issue => issue !== undefined)).slice(0, 2048));
  const file = checked.getSourceFile("/src/index.ts");
  assert.equal(file !== undefined, true, "the exact original resource-purpose file is retained");
  const { ast } = checked;
  const pending = [file];
  let declaration;
  while (pending.length !== 0) {
    const node = pending.pop();
    if (ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)) === "expanded") declaration = node;
    ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  const annotation = declaration === undefined ? undefined : ast.typeNode(declaration);
  assert.equal(annotation !== undefined, true, "the original expanding annotation is the demanded component");
  assert.throws(() => {
    const { flow } = sourceFlowOwnerFixture({ checked, apiFacts: undefined, profileFiles: [], safetyProviders: [] });
    flow.context.reader.describeSyntax(annotation, []);
  }, failure => failure instanceof TargetCompilerResourceLimitFailure &&
    failure.diagnostic.code === "TSONIC_COMPILER_RESOURCE_LIMIT" && failure.diagnostic.sourceNode !== undefined &&
    ast.getSourceFile(failure.diagnostic.sourceNode) === file &&
    failure.message.includes(`depth=${sourceTypeExpansionBudget.depth}`) &&
    failure.diagnostic.evidence?.includes(`depth=${sourceTypeExpansionBudget.depth}`) === true,
  "the genuine owner demand retains its exact resource code, original site and shared depth evidence");
});
