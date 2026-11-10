import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import test from "node:test";
import { schemaCastFindings } from "./tooling/schema-casts.mjs";

const repoRoot = process.cwd();
const hostSourceRoot = resolve(repoRoot, "packages/host/src");
const targetApiSourceRoot = resolve(repoRoot, "packages/target-api/src");

test("every generated shared source-processing AST cast has an exact controlling kind predicate", async () => {
  const files = [...await collectTypeScriptFiles(hostSourceRoot), ...await collectTypeScriptFiles(targetApiSourceRoot)].sort();
  const sources = new Map(await Promise.all(files.map(async file => [relative(repoRoot, file), await readFile(file, "utf8")])));
  assert.equal(sources.size > 0, true, "the complete shared source-processing inventory is present");
  assert.deepEqual(schemaCastFindings(sources), []);
});

for (const [label, body] of [
  ["positive branch", "if (ast.is.IsVariableDeclaration(node)) return ast.as.AsVariableDeclaration(node);"],
  ["negative early exit", "if (!ast.is.IsVariableDeclaration(node)) return; return ast.as.AsVariableDeclaration(node);"],
  ["conditional expression", "return node !== undefined && ast.is.IsVariableDeclaration(node) ? ast.as.AsVariableDeclaration(node) : undefined;"],
  ["lazy conjunction", "return ast.is.IsVariableDeclaration(node) && ast.as.AsVariableDeclaration(node);"],
  ["union predicate", "return ast.is.IsArrayBindingPattern(node) || ast.is.IsObjectBindingPattern(node) ? ast.as.AsBindingPattern(node) : undefined;"],
  ["long protected body", `if (ast.is.IsVariableDeclaration(node)) { ${"void 0;\n".repeat(24)} return ast.as.AsVariableDeclaration(node); }`],
]) {
  test(`schema cast accepts ${label} for the identical reader and original subject`, () => {
    const source = `function example(ast, node) { ${body} }`;
    assert.deepEqual(schemaCastFindings(new Map([["example.ts", source]])), []);
  });
}

for (const [label, body] of [
  ["missing predicate", "return ast.as.AsVariableDeclaration(node);"],
  ["predicate in a string", 'const message = "ast.is.IsVariableDeclaration(node)"; return ast.as.AsVariableDeclaration(node);'],
  ["predicate in a comment", "/* ast.is.IsVariableDeclaration(node) */ return ast.as.AsVariableDeclaration(node);"],
  ["wrong subject", "if (ast.is.IsVariableDeclaration(other)) return ast.as.AsVariableDeclaration(node);"],
  ["wrong reader", "if (other.is.IsVariableDeclaration(node)) return ast.as.AsVariableDeclaration(node);"],
  ["opposite branch", "if (!ast.is.IsVariableDeclaration(node)) return ast.as.AsVariableDeclaration(node);"],
  ["unguarded fallthrough", "if (ast.is.IsVariableDeclaration(node)) {} return ast.as.AsVariableDeclaration(node);"],
  ["intervening assignment", "if (!ast.is.IsVariableDeclaration(node)) return; node = other; return ast.as.AsVariableDeclaration(node);"],
  ["comma assignment", "if (ast.is.IsVariableDeclaration(node)) return (node = other, ast.as.AsVariableDeclaration(node));"],
  ["reader reassignment", "if (!ast.is.IsVariableDeclaration(node)) return; ast = other; return ast.as.AsVariableDeclaration(node);"],
  ["later condition assignment", "if (ast.is.IsVariableDeclaration(node) && (node = other)) return ast.as.AsVariableDeclaration(node);"],
  ["earlier call argument assignment", "if (ast.is.IsVariableDeclaration(node)) return use(node = other, ast.as.AsVariableDeclaration(node));"],
  ["earlier array element assignment", "if (ast.is.IsVariableDeclaration(node)) return [node = other, ast.as.AsVariableDeclaration(node)];"],
  ["different shadowed binding", "if (ast.is.IsVariableDeclaration(node)) { const work = (node) => ast.as.AsVariableDeclaration(node); }"],
  ["effectful subject recomputation", "if (ast.is.IsVariableDeclaration(next())) return ast.as.AsVariableDeclaration(next());"],
]) {
  test(`schema cast rejects ${label}`, () => {
    const rows = schemaCastFindings(new Map([["example.ts", `function example(ast, node, other, next) { ${body} }`]]));
    assert.equal(rows.some(row => row.rule === "unguarded-schema-cast"), true);
  });
}

test("schema cast inventory ignores authored example text and type queries", () => {
  const source = 'const sample = "ast.as.AsVariableDeclaration(node)"; type Result = ReturnType<typeof ast.as.AsVariableDeclaration>;';
  assert.deepEqual(schemaCastFindings(new Map([["example.ts", source]])), []);
});

test("host module classification has one shared implementation", async () => {
  const moduleReference = await readFile(resolve(targetApiSourceRoot, "module-reference.ts"), "utf8");
  const projectModules = await readFile(resolve(hostSourceRoot, "host-input/navigation/modules.ts"), "utf8");
  const capabilityActivation = await readFile(resolve(hostSourceRoot, "target/capability-activation.ts"), "utf8");
  const productFiles = [...await collectTypeScriptFiles(hostSourceRoot), ...await collectTypeScriptFiles(targetApiSourceRoot)];
  const productSource = (await Promise.all(productFiles.map(file => readFile(file, "utf8")))).join("\n");
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
    if (entry.isDirectory()) files.push(...await collectTypeScriptFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(path);
  }
  return files.sort();
}
