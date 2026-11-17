import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const sourceNavigationRoot = resolve(
  repoRoot,
  "packages/target-api/src/source-navigation",
);
const targetAnalysisRoot = resolve(
  repoRoot,
  "packages/target-api/src/target-analysis",
);

test("source reference navigation has one exact positive-only graph", async () => {
  const graphFiles = await Promise.all([
    "reference-index.ts",
    "reference-selection.ts",
    "references.ts",
    "references-usage.ts",
  ].map((file) => readFile(resolve(sourceNavigationRoot, file), "utf8")));
  const graph = graphFiles.join("\n");
  const index = graphFiles[0];
  const planningSnapshot = await readFile(
    resolve(targetAnalysisRoot, "source-navigation-snapshot.ts"),
    "utf8",
  );

  assert.doesNotMatch(graph, /\bMap<string\s*,/u);
  assert.doesNotMatch(graph, /\bsourceNodeIdentity\b/u);
  assert.doesNotMatch(graph, /\b(?:sourceReferenceCache|referenceCache|declarationCache)\b/u);
  assert.doesNotMatch(graph, /WeakMap<[^>]+,\s*[^>]*\|\s*null/u);
  assert.doesNotMatch(graph, /\.set\([^;]*,\s*null\s*\)/u);
  assert.match(index, /function buildSourceDeclarationReferenceIndex/u);
  assert.match(index, /function sealSourceDeclarationReferenceIndex/u);
  const sealedBoundary = index.slice(
    index.indexOf("function sealSourceDeclarationReferenceIndex"),
  );
  assert.doesNotMatch(sealedBoundary, /\bCheckedSourceProgram\b/u);
  assert.doesNotMatch(sealedBoundary, /\bTypeCheckerQueries\b/u);
  assert.doesNotMatch(sealedBoundary, /\bgetSourceFileQueries\b/u);
  assert.doesNotMatch(
    planningSnapshot,
    /new WeakMap<Node, SourceDeclarationReference>/u,
  );
  assert.doesNotMatch(
    planningSnapshot,
    /\b(?:getExportsOfModule|getSourceFileQueries)\b/u,
  );
  assert.match(
    planningSnapshot,
    /sourceReferenceFor:\s*source\.navigation\.sourceReferenceFor/u,
  );
});

test("source reference consumers do not rescan source trees", async () => {
  const usage = await readFile(
    resolve(sourceNavigationRoot, "references-usage.ts"),
    "utf8",
  );
  const navigation = await readFile(
    resolve(sourceNavigationRoot, "navigation.ts"),
    "utf8",
  );

  assert.doesNotMatch(usage, /\bCheckedSourceProgram\b/u);
  assert.doesNotMatch(usage, /\bSourceFile\b/u);
  assert.doesNotMatch(usage, /\bforEachChild\b/u);
  assert.doesNotMatch(usage, /\bgetSourceFileQueries\b/u);
  assert.doesNotMatch(navigation, /const referenceIndex\s*=/u);
  assert.match(navigation, /references\.referencesForSymbol/u);
  assert.match(navigation, /references\.referencesToDeclaration/u);
});
