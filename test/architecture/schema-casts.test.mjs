import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const hostSourceRoot = resolve(repoRoot, "packages/host/src");
const targetApiSourceRoot = resolve(repoRoot, "packages/target-api/src");

const expectedCastCounts = Object.freeze({
  "packages/target-api/src/module-reference.ts": 3,
  "packages/target-api/src/source-navigation/ast.ts": 81,
  "packages/target-api/src/source-navigation/checked-casts.ts": 76,
  "packages/target-api/src/source-navigation/constructors.ts": 1,
  "packages/target-api/src/source-navigation/heritage.ts": 1,
  "packages/target-api/src/source-navigation/member-dispatch.ts": 1,
  "packages/target-api/src/source-navigation/modules.ts": 1,
  "packages/target-api/src/source-navigation/navigation.ts": 1,
  "packages/target-api/src/source-navigation/references-usage.ts": 12,
  "packages/target-api/src/source-navigation/references.ts": 3,
  "packages/target-api/src/source-navigation/syntax.ts": 2,
  "packages/target-api/src/source-semantics/authored-type-facts.ts": 2,
  "packages/target-api/src/source-semantics/authored-type-selection.ts": 1,
  "packages/target-api/src/source-semantics/standard-type-transformations.ts": 2,
  "packages/target-api/src/source-semantics/type-syntax.ts": 6,
});

test("every generated shared source-processing AST cast has an exact local kind predicate", async () => {
  const files = [
    ...await collectTypeScriptFiles(hostSourceRoot),
    ...await collectTypeScriptFiles(targetApiSourceRoot),
  ].sort();
  const castPattern = /ast\.as\.As([A-Za-z0-9_]+)\(\s*([A-Za-z0-9_.]+)\s*,?\s*\)/gu;
  const audited = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(castPattern)) {
      const castKind = match[1];
      const subject = match[2];
      const line = source.slice(0, match.index).split("\n").length;
      const localContext = source.slice(0, match.index).split("\n").slice(-18).join("\n");
      const escapedSubject = subject.replaceAll(".", "\\.");
      const exactPredicate = castKind === "BindingPattern"
        ? new RegExp(`ast\\.is\\.Is(?:Array|Object)BindingPattern\\(${escapedSubject}\\)`, "u")
        : castKind === "ForInOrOfStatement"
        ? new RegExp(`ast\\.is\\.Is(?:ForIn|ForOf)Statement\\(${escapedSubject}\\)`, "u")
        : castKind === "CaseOrDefaultClause"
          ? new RegExp(`ast\\.is\\.Is(?:Case|Default)Clause\\(${escapedSubject}\\)`, "u")
        : new RegExp(`ast\\.is\\.Is${castKind}\\(${escapedSubject}\\)`, "u");
      assert.match(
        localContext,
        exactPredicate,
        `${relative(repoRoot, file)}:${line}: As${castKind}(${subject}) has no exact preceding kind predicate`,
      );
      audited.push(`${relative(repoRoot, file)}:As${castKind}`);
    }
  }

  const actualCastCounts = Object.fromEntries(
    Object.entries(Object.groupBy(audited, (entry) => entry.slice(0, entry.lastIndexOf(":"))))
      .map(([file, entries]) => [file, entries.length])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  assert.deepEqual(actualCastCounts, expectedCastCounts);
});

test("host module classification has one shared implementation", async () => {
  const moduleReference = await readFile(resolve(targetApiSourceRoot, "module-reference.ts"), "utf8");
  const projectModules = await readFile(resolve(targetApiSourceRoot, "source-navigation/modules.ts"), "utf8");
  const capabilityActivation = await readFile(resolve(hostSourceRoot, "target/capability-activation.ts"), "utf8");
  const productFiles = [
    ...await collectTypeScriptFiles(hostSourceRoot),
    ...await collectTypeScriptFiles(targetApiSourceRoot),
  ];
  const productSource = (await Promise.all(productFiles.map((file) => readFile(file, "utf8")))).join("\n");
  const consumerSource = `${projectModules}\n${capabilityActivation}`;

  assert.match(moduleReference, /export function getStaticModuleReference/u);
  assert.match(projectModules, /getStaticModuleReference/u);
  assert.match(capabilityActivation, /getStaticModuleReference/u);
  assert.equal([...productSource.matchAll(/\bgetStaticModuleReference\s*\(/gu)].length, 3);
  assert.doesNotMatch(productSource, /isExclusivelyTypeOnlyImportDeclaration/u);
  assert.doesNotMatch(productSource, /get(?:Static|Value)ModuleSpecifier/u);
  assert.doesNotMatch(consumerSource, /AsImportClause\(importClause\)/u);
});

async function collectTypeScriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTypeScriptFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files.sort();
}
