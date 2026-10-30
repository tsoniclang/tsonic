import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const hostSourceRoot = resolve(repoRoot, "packages/host/src");
const targetApiSourceRoot = resolve(repoRoot, "packages/target-api/src");

const expectedCastCounts = Object.freeze({
  "packages/target-api/src/module-reference.ts": 3,
  "packages/target-api/src/source-navigation/array-density.ts": 3,
  "packages/target-api/src/source-navigation/ast.ts": 81,
  "packages/target-api/src/source-navigation/callable-aliases.ts": 2,
  "packages/target-api/src/source-navigation/callable-arguments-fixtures.ts": 1,
  "packages/target-api/src/source-navigation/callable-arguments.ts": 3,
  "packages/target-api/src/source-navigation/callable-values.test.ts": 1,
  "packages/target-api/src/source-navigation/callable-values.ts": 3,
  "packages/target-api/src/source-navigation/checked-casts.ts": 76,
  "packages/target-api/src/source-navigation/constructors.ts": 1,
  "packages/target-api/src/source-navigation/counted-loops.ts": 6,
  "packages/target-api/src/source-navigation/declaration-uses.ts": 22,
  "packages/target-api/src/source-navigation/deferred-captures.ts": 2,
  "packages/target-api/src/source-navigation/expression-effects.ts": 2,
  "packages/target-api/src/source-navigation/expression-use.test.ts": 4,
  "packages/target-api/src/source-navigation/expression-use.ts": 46,
  "packages/target-api/src/source-navigation/heritage.ts": 1,
  "packages/target-api/src/source-navigation/immediate-evaluation.ts": 4,
  "packages/target-api/src/source-navigation/initialization-uses.ts": 1,
  "packages/target-api/src/source-navigation/integer-ranges/analysis.ts": 17,
  "packages/target-api/src/source-navigation/integer-ranges/guards.test.ts": 1,
  "packages/target-api/src/source-navigation/integer-ranges/guards.ts": 8,
  "packages/target-api/src/source-navigation/integer-ranges/induction.ts": 2,
  "packages/target-api/src/source-navigation/lexical-captures.test.ts": 1,
  "packages/target-api/src/source-navigation/lexical-captures.ts": 2,
  "packages/target-api/src/source-navigation/lexical-environments.test.ts": 2,
  "packages/target-api/src/source-navigation/lexical-environments.ts": 1,
  "packages/target-api/src/source-navigation/member-contract-boundaries.test.ts": 1,
  "packages/target-api/src/source-navigation/member-dispatch.ts": 1,
  "packages/target-api/src/source-navigation/modules.ts": 1,
  "packages/target-api/src/source-navigation/navigation.ts": 1,
  "packages/target-api/src/source-navigation/reference-meaning.test.ts": 2,
  "packages/target-api/src/source-navigation/reference-selection.ts": 3,
  "packages/target-api/src/source-navigation/references-usage.ts": 17,
  "packages/target-api/src/source-navigation/sequence-inputs.ts": 3,
  "packages/target-api/src/source-navigation/syntax.ts": 9,
  "packages/target-api/src/source-navigation/value-flow.ts": 3,
  "packages/target-api/src/source-semantics/authored-type-facts.ts": 2,
  "packages/target-api/src/source-semantics/authored-type-selection.ts": 1,
  "packages/target-api/src/source-semantics/boolean-short-circuit.test.ts": 1,
  "packages/target-api/src/source-semantics/boolean-short-circuit.ts": 5,
  "packages/target-api/src/source-semantics/callable-parameters.test.ts": 1,
  "packages/target-api/src/source-semantics/callable-parameters.ts": 1,
  "packages/target-api/src/source-semantics/captured-value-guards.test.ts": 1,
  "packages/target-api/src/source-semantics/enum-numeric-uses-part-2.test.ts": 4,
  "packages/target-api/src/source-semantics/expression-sequence.test.ts": 1,
  "packages/target-api/src/source-semantics/expression-sequence.ts": 2,
  "packages/target-api/src/source-semantics/integer-constant.ts": 3,
  "packages/target-api/src/source-semantics/integer-literal.ts": 2,
  "packages/target-api/src/source-semantics/literal-values.ts": 2,
  "packages/target-api/src/source-semantics/native-control-flow.test.ts": 2,
  "packages/target-api/src/source-semantics/selected-indexed-declarations.test.ts": 1,
  "packages/target-api/src/source-semantics/standard-type-transformations.ts": 1,
  "packages/target-api/src/source-semantics/type-component-evidence.ts": 1,
  "packages/target-api/src/source-semantics/type-syntax.ts": 7,
  "packages/target-api/src/target-analysis/entry-validation.ts": 1,
  "packages/target-api/src/target-analysis/enum-constants.ts": 5,
  "packages/target-api/src/target-analysis/enum-numeric-uses.ts": 15,
  "packages/target-api/src/target-analysis/error-storage/error-storage-demands.ts": 1,
  "packages/target-api/src/target-analysis/flow-conditions.ts": 4,
  "packages/target-api/src/target-analysis/flow/bindings.ts": 10,
  "packages/target-api/src/target-analysis/flow/expressions.ts": 25,
  "packages/target-api/src/target-analysis/flow/loops.ts": 8,
  "packages/target-api/src/target-analysis/flow/resource-cleanup.test.ts": 2,
  "packages/target-api/src/target-analysis/flow/resource-scopes.ts": 4,
  "packages/target-api/src/target-analysis/flow/statement-exits.ts": 1,
  "packages/target-api/src/target-analysis/flow/statements.ts": 10,
  "packages/target-api/src/target-analysis/guard-preservation.ts": 4,
  "packages/target-api/src/target-analysis/native-control-flow.ts": 2,
  "packages/target-api/src/target-analysis/ownership/flow.ts": 1,
  "packages/target-api/src/target-analysis/ownership/receiver-occurrences.ts": 2,
  "packages/target-api/src/target-analysis/ownership/recursive-retention-part-1.test.ts": 2,
  "packages/target-api/src/target-analysis/property-names.ts": 40,
  "packages/target-api/src/target-analysis/source-storage/graph/invocation-inputs.ts": 2,
  "packages/target-api/src/target-analysis/source-storage/graph/lexical-regions.ts": 2,
  "packages/target-api/src/target-analysis/source-storage/graph/member-flow.ts": 3,
  "packages/target-api/src/target-analysis/source-storage/graph/stored-values.ts": 4,
  "packages/target-api/src/target-analysis/source-storage/model/global-call-effects.ts": 2,
  "packages/target-api/src/target-analysis/source-storage/model/projections.ts": 1,
  "packages/target-api/src/target-analysis/source-storage/model/subjects.ts": 1,
  "packages/target-api/src/target-analysis/source-storage/queries.ts": 1,
  "packages/target-api/src/target-analysis/source-storage/scoped/scoped-keys.ts": 1,
  "packages/target-api/src/target-analysis/source-storage/scoped/scoped-member-successors.ts": 2,
  "packages/target-api/src/target-analysis/source-storage/scoped/scoped-scopes.ts": 1,
  "packages/target-api/src/target-analysis/source-storage/scoped/scoped-successors.ts": 1,
  "packages/target-api/src/target-analysis/source-storage/transport/syntax-collection.ts": 2,
  "packages/target-api/src/target-analysis/value-flow-conditions.ts": 3,
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
