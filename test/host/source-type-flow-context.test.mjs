import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { sourceFlowOwnerFixture } from "./fixtures/source-flow-owner.mjs";

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
