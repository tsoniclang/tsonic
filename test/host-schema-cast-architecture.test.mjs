import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const hostSourceRoot = resolve(repoRoot, "packages/host/src");
const targetApiSourceRoot = resolve(repoRoot, "packages/target-api/src");

const expectedCasts = Object.freeze([
  "packages/target-api/src/module-reference.ts:AsExportDeclaration",
  "packages/target-api/src/module-reference.ts:AsImportClause",
  "packages/target-api/src/module-reference.ts:AsImportDeclaration",
  "packages/target-api/src/source-navigation/constructors.ts:AsParameterDeclaration",
  "packages/target-api/src/source-navigation/heritage.ts:AsExpressionWithTypeArguments",
  "packages/target-api/src/source-navigation/index.ts:AsParameterDeclaration",
  "packages/target-api/src/source-navigation/member-dispatch.ts:AsExpressionWithTypeArguments",
  "packages/target-api/src/source-navigation/modules.ts:AsForInOrOfStatement",
  "packages/target-api/src/source-navigation/references-usage.ts:AsAsExpression",
  "packages/target-api/src/source-navigation/references-usage.ts:AsBinaryExpression",
  "packages/target-api/src/source-navigation/references-usage.ts:AsForInOrOfStatement",
  "packages/target-api/src/source-navigation/references-usage.ts:AsNonNullExpression",
  "packages/target-api/src/source-navigation/references-usage.ts:AsParenthesizedExpression",
  "packages/target-api/src/source-navigation/references-usage.ts:AsPostfixUnaryExpression",
  "packages/target-api/src/source-navigation/references-usage.ts:AsPrefixUnaryExpression",
  "packages/target-api/src/source-navigation/references-usage.ts:AsPropertyAssignment",
  "packages/target-api/src/source-navigation/references-usage.ts:AsSatisfiesExpression",
  "packages/target-api/src/source-navigation/references-usage.ts:AsSpreadAssignment",
  "packages/target-api/src/source-navigation/references-usage.ts:AsSpreadElement",
  "packages/target-api/src/source-navigation/references-usage.ts:AsTypeAssertion",
  "packages/target-api/src/source-navigation/references.ts:AsImportClause",
  "packages/target-api/src/source-navigation/references.ts:AsImportDeclaration",
  "packages/target-api/src/source-navigation/references.ts:AsImportSpecifier",
  "packages/target-api/src/source-navigation/syntax.ts:AsExpressionWithTypeArguments",
  "packages/target-api/src/source-navigation/syntax.ts:AsTypeReferenceNode",
  "packages/target-api/src/source-semantics/authored-type-facts.ts:AsTypeAliasDeclaration",
  "packages/target-api/src/source-semantics/authored-type-facts.ts:AsTypeReferenceNode",
  "packages/target-api/src/source-semantics/authored-type-selection.ts:AsParenthesizedTypeNode",
  "packages/target-api/src/source-semantics/standard-type-transformations.ts:AsParameterDeclaration",
  "packages/target-api/src/source-semantics/standard-type-transformations.ts:AsTypeReferenceNode",
  "packages/target-api/src/source-semantics/type-syntax.ts:AsArrayTypeNode",
  "packages/target-api/src/source-semantics/type-syntax.ts:AsNamedTupleMember",
  "packages/target-api/src/source-semantics/type-syntax.ts:AsOptionalTypeNode",
  "packages/target-api/src/source-semantics/type-syntax.ts:AsParenthesizedTypeNode",
  "packages/target-api/src/source-semantics/type-syntax.ts:AsRestTypeNode",
  "packages/target-api/src/source-semantics/type-syntax.ts:AsTypeOperatorNode",
]);

test("every generated shared source-processing AST cast has an exact local kind predicate", async () => {
  const files = [
    ...await collectTypeScriptFiles(hostSourceRoot),
    ...await collectTypeScriptFiles(targetApiSourceRoot),
  ].sort();
  const castPattern = /ast\.as\.As([A-Za-z0-9_]+)\(\s*([A-Za-z0-9_.]+)\s*,?\s*\)/gu;
  const audited = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const lines = source.split("\n");
    for (const match of source.matchAll(castPattern)) {
      const castKind = match[1];
      const subject = match[2];
      const line = source.slice(0, match.index).split("\n").length;
      const localContext = lines.slice(Math.max(0, line - 18), line).join("\n");
      const escapedSubject = subject.replaceAll(".", "\\.");
      const exactPredicate = castKind === "ForInOrOfStatement"
        ? new RegExp(`ast\\.is\\.Is(?:ForIn|ForOf)Statement\\(${escapedSubject}\\)`, "u")
        : new RegExp(`ast\\.is\\.Is${castKind}\\(${escapedSubject}\\)`, "u");
      assert.match(
        localContext,
        exactPredicate,
        `${relative(repoRoot, file)}:${line}: As${castKind}(${subject}) has no exact preceding kind predicate`,
      );
      audited.push(`${relative(repoRoot, file)}:As${castKind}`);
    }
  }

  assert.deepEqual(
    audited.sort(),
    [...expectedCasts].sort(),
    `Update the reviewed shared source-processing AST-cast inventory for:\n${audited.join("\n")}`,
  );
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
