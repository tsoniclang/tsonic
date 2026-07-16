import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const hostSourceRoot = resolve(repoRoot, "packages/host/src");

test("every generated host AST cast has an exact local kind predicate", async () => {
  const files = await collectTypeScriptFiles(hostSourceRoot);
  const castPattern = /ast\.as\.As([A-Za-z0-9_]+)\(([A-Za-z0-9_]+)\)/gu;
  const audited = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const lines = source.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      for (const match of lines[index].matchAll(castPattern)) {
        const castKind = match[1];
        const subject = match[2];
        const localContext = lines.slice(Math.max(0, index - 12), index + 1).join("\n");
        assert.match(
          localContext,
          new RegExp(`ast\\.is\\.Is${castKind}\\(${subject}\\)`, "u"),
          `${relative(repoRoot, file)}:${index + 1}: As${castKind}(${subject}) has no exact preceding kind predicate`,
        );
        audited.push(`${relative(repoRoot, file)}:${index + 1}:As${castKind}`);
      }
    }
  }

  assert.equal(audited.length, 33, `Update the reviewed host AST-cast inventory for:\n${audited.join("\n")}`);
});

test("host module classification has one shared implementation", async () => {
  const projectSource = await readFile(resolve(hostSourceRoot, "analysis/project-source.ts"), "utf8");
  const capabilityActivation = await readFile(resolve(hostSourceRoot, "target/capability-activation.ts"), "utf8");
  const productSource = `${projectSource}\n${capabilityActivation}`;

  assert.match(projectSource, /getStaticModuleReference/u);
  assert.match(capabilityActivation, /getStaticModuleReference/u);
  assert.doesNotMatch(productSource, /isExclusivelyTypeOnlyImportDeclaration/u);
  assert.doesNotMatch(productSource, /get(?:Static|Value)ModuleSpecifier/u);
  assert.doesNotMatch(productSource, /AsImportClause\(importClause\)/u);
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
