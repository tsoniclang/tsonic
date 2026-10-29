import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { analyzeSourceConstructorResults, createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import * as construction from "../../packages/target-api/dist/target-analysis/source-storage/model/construction.js";
import { sourceStorageClassLineages } from "../../packages/target-api/dist/target-analysis/source-storage/model/construction.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

export function fixture(limits = defaultSourceStorageLimits) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    class Ready { ready = 1; }
    class Child extends Ready {}
    const Copy = Ready; const Parenthesized = (Copy); export const Published = Ready;
    export let Changing: typeof Ready = Ready;
    declare const Missing: typeof Ready;
    function dynamic(Factory: typeof Ready) { return new Factory(); }
    const copied = new Copy(); const parenthesized = new Parenthesized();
    const published = new Published(); const changing = new Changing(); const missing = new Missing();
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "The controls are actual checked source, not synthetic result-type identities.");
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles, limits);
  const variable = name => storage.nodes.find(node => source.ast.is.IsVariableDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === name);
  const invocation = name => source.ast.as.AsVariableDeclaration(variable(name)).Initializer;
  return { source, storage, invocation };
}

export function constructorResultFixture(text) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": text },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "Constructor admission controls are actual checked source.");
  const source = createTargetSourceProgram(checked);
  const nodes = [];
  const pending = [...source.sourceFiles];
  while (pending.length > 0) {
    const node = pending.pop();
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  return { source, nodes };
}
