import assert from "node:assert/strict";
import test from "node:test";
import {
  createCompilerSessionFromFiles,
  defineExtensionFactKey,
  type Node,
  type SourceFile,
  type SourceProgramQueries,
} from "@tsonic/tsts";
import { createSourceProgramNavigation, createSourceReferenceNavigation, sourceProjectFiles } from "../public/source.js";
import { createSourceDeclarationReferenceIndex, type SourceReferenceIndexLimits } from "./reference-index.js";
import type { SourceReferenceNavigation } from "./references.js";

function source() {
  return createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/index.ts": 'import { value as alias } from "./value.js"; export const first = alias; export const second = alias;',
      "/src/value.ts": "export const value = 42;",
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
}

function references(queries: SourceProgramQueries) {
  const file = queries.getSourceFile("/src/index.ts");
  assert.ok(file);
  const selected: Node[] = [];
  const visit = (node: Node): void => {
    if (queries.ast.is.IsVariableDeclaration(node)) {
      const initializer = queries.ast.as.AsVariableDeclaration(node)!.Initializer;
      assert.ok(initializer);
      selected.push(initializer);
    }
    queries.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  assert.equal(selected.length, 2);
  return [selected[0]!, selected[1]!] as const;
}

function observed(queries: SourceProgramQueries) {
  const selected: Node[] = [];
  let visits = 0;
  let active = true;
  const assertActive = (): void => { if (!active) throw new Error("retired test source"); };
  const source: SourceProgramQueries = {
    ...queries,
    ast: { ...queries.ast, children(node) { visits += 1; return queries.ast.children(node); } },
    getSourceFiles() { assertActive(); return queries.getSourceFiles(); },
    getSourceFileQueries(file) {
      assertActive();
      const current = queries.getSourceFileQueries(file);
      return { ...current, checker: { ...current.checker,
        getSymbolAtLocation(node) {
          if (node !== undefined) selected.push(node);
          return current.checker.getSymbolAtLocation(node);
        },
      } };
    },
  };
  return { source, selected, visits: () => visits, retire: () => { active = false; } };
}

test("forward reference selection does not eagerly visit or check unrelated source", () => {
  const checked = source();
  const [first, second] = references(checked);
  const observation = observed(checked);
  const navigation = createSourceReferenceNavigation(observation.source, sourceProjectFiles(checked));
  assert.equal(observation.visits(), 0);
  assert.equal(observation.selected.length, 0);
  const selected = navigation.sourceReferenceFor(second);
  assert.ok(selected);
  assert.equal(observation.visits(), 0);
  assert.equal(observation.selected.includes(second), true);
  assert.equal(observation.selected.includes(first), false);
  const queries = observation.selected.length;
  for (let index = 0; index < 20; index += 1) assert.equal(navigation.sourceReferenceFor(second), selected);
  assert.equal(observation.selected.length, queries);
  assert.equal(navigation.sourceReferenceFor(first), selected);
  const reverse = navigation.referencesToDeclaration(selected.declaration);
  assert.ok(reverse.indexOf(first) < reverse.indexOf(second));
  const visits = observation.visits();
  const queryCount = observation.selected.length;
  assert.ok(visits > 0);
  assert.equal(navigation.referencesToDeclaration(selected.declaration), reverse);
  assert.equal(navigation.referenceIndexStatistics.constructionPasses, 1);
  assert.equal(observation.visits(), visits);
  assert.equal(observation.selected.length, queryCount);
  assert.equal(Object.isFrozen(reverse), true);
});

test("whole-program navigation does not force its reference index at construction", () => {
  const checked = source();
  const observation = observed(checked);
  const navigation = createSourceProgramNavigation({ ...checked, ...observation.source });
  assert.equal(observation.selected.length, 0);
  assert.equal(observation.visits(), 0);
  assert.equal(navigation.referenceIndexStatistics.constructionPasses, 1);
  assert.ok(observation.visits() > 0);
});

test("reverse edge order and accounting do not depend on forward query order", () => {
  const checked = source();
  const [first, second] = references(checked);
  const files = sourceProjectFiles(checked);
  const forward = createSourceReferenceNavigation(checked, files);
  const reverse = createSourceReferenceNavigation(checked, files);
  const selected = forward.sourceReferenceFor(first);
  assert.ok(selected);
  forward.sourceReferenceFor(second);
  reverse.sourceReferenceFor(second);
  reverse.sourceReferenceFor(first);
  assert.deepEqual(forward.referencesToDeclaration(selected.declaration), reverse.referencesToDeclaration(selected.declaration));
  assert.deepEqual(forward.referenceIndexStatistics, reverse.referenceIndexStatistics);
});

test("cached source reference queries still reject a retired source", () => {
  const checked = source();
  const observation = observed(checked);
  const navigation = createSourceReferenceNavigation(observation.source, sourceProjectFiles(checked));
  const [first] = references(checked);
  const selected = navigation.sourceReferenceFor(first);
  assert.ok(selected?.symbol);
  navigation.referencesToDeclaration(selected.declaration);
  navigation.declarationFor(first);
  navigation.referenceFor(first);
  observation.retire();
  for (const query of [
    () => navigation.sourceReferenceFor(first),
    () => navigation.referencesToDeclaration(selected.declaration),
    () => navigation.referencesForSymbol(selected.symbol!),
    () => navigation.declarationFor(first),
    () => navigation.referenceFor(first),
    () => navigation.isProjectDeclaration(selected.declaration),
    () => navigation.referenceIndexStatistics,
  ]) assert.throws(query, /retired test source/);
});

test("early reference navigation uses the same source identities without a finalized program", () => {
  const captures: { readonly source: SourceProgramQueries; readonly navigation: SourceReferenceNavigation; readonly node: Node }[] = [];
  const extensionId = "test.reference-demand";
  const key = defineExtensionFactKey<null>({ extensionId, name: "replay", snapshot: value => value });
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/index.ts": 'import { value as alias } from "./value.js"; export const first = alias; export const second = alias;',
      "/src/value.ts": "export const value = 42;",
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    extensionHostOptions: { extensions: [{
      identity: { id: extensionId, version: "1" },
      initialize: context => context.registerSourceElaborator(key, () => null),
      elaborateSource(context) {
        assert.equal("program" in context.source, false);
        assert.equal("diagnostics" in context.source, false);
        const navigation = createSourceReferenceNavigation(context.source, sourceProjectFiles(context.source));
        const [node] = references(context.source);
        assert.ok(navigation.sourceReferenceFor(node));
        captures.push({ source: context.source, navigation, node });
        context.request(context.source.getSourceFile("/src/index.ts")!, key);
      },
    }] },
  }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
  assert.ok(captures.length >= 2);
  const latest = captures[captures.length - 1]!;
  const finalized = createSourceProgramNavigation(checked);
  assert.equal(latest.navigation.sourceReferenceFor(latest.node)?.declaration,
    finalized.sourceReferenceFor(latest.node)?.declaration);
  const old = captures[0]!;
  assert.throws(() => old.navigation.sourceReferenceFor(old.node), /retired compiler program or epoch/);
});

test("a failed reverse demand poisons the index rather than exposing partial edges", () => {
  const checked = source();
  const files = sourceProjectFiles(checked);
  const limits: SourceReferenceIndexLimits = {
    sourceFiles: 100, nodesVisited: 1, referenceCandidates: 100, selectedReferences: 100,
    selectedDeclarations: 100, reverseEdges: 100, indexedSymbols: 100, moduleExportsExamined: 100,
  };
  const index = createSourceDeclarationReferenceIndex(checked, files,
    node => node !== undefined && files.includes(checked.ast.getSourceFile(node) as SourceFile), limits);
  const [first] = references(checked);
  const selected = index.sourceReferenceFor(first);
  assert.ok(selected?.symbol);
  assert.throws(() => index.referencesToDeclaration(selected.declaration), /visited nodes limit/);
  for (const query of [
    () => index.sourceReferenceFor(first),
    () => index.referencesToDeclaration(selected.declaration),
    () => index.referencesForSymbol(selected.symbol!),
    () => index.statistics,
  ]) assert.throws(query, /visited nodes limit/);
});

test("demanded reference limits are snapshotted rather than mutable after construction", () => {
  const checked = source();
  const files = sourceProjectFiles(checked);
  const limits = {
    sourceFiles: 100, nodesVisited: 1, referenceCandidates: 100, selectedReferences: 100,
    selectedDeclarations: 100, reverseEdges: 100, indexedSymbols: 100, moduleExportsExamined: 100,
  };
  const index = createSourceDeclarationReferenceIndex(checked, files, () => true, limits);
  limits.nodesVisited = 100_000;
  assert.throws(() => index.statistics, /exceeds the 1 visited nodes limit/);
});

test("forward requests enforce their selection budget before a reverse scan", () => {
  const checked = source();
  const files = sourceProjectFiles(checked);
  const limits = {
    sourceFiles: 100, nodesVisited: 100, referenceCandidates: 1, selectedReferences: 100,
    selectedDeclarations: 100, reverseEdges: 100, indexedSymbols: 100, moduleExportsExamined: 100,
  };
  const observation = observed(checked);
  const index = createSourceDeclarationReferenceIndex(observation.source, files, () => true, limits);
  const [first, second] = references(checked);
  assert.ok(index.sourceReferenceFor(first));
  assert.equal(observation.visits(), 0);
  assert.throws(() => index.sourceReferenceFor(second), /exceeds the 1 reference candidates limit/);
  assert.throws(() => index.sourceReferenceFor(first), /reference candidates limit/);
  assert.equal(observation.visits(), 0);
});
