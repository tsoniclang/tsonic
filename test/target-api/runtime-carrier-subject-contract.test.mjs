import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const hostSourceRoot = resolve(repoRoot, "packages/host/src");
const targetApiSourceRoot = resolve(repoRoot, "packages/target-api/src");

test("shared Tsonic exposes source semantics and never owns target runtime carriers", async () => {
  const sourceProgramTypes = await readFile(
    resolve(targetApiSourceRoot, "source-semantics/types.ts"),
    "utf8",
  );
  const productSource = (await Promise.all([
    ...await collectTypeScriptFiles(hostSourceRoot),
    ...await collectTypeScriptFiles(targetApiSourceRoot),
  ].map((file) => readFile(file, "utf8")))).join("\n");

  assert.match(
    sourceProgramTypes,
    /export interface TargetSourceProgram \{[\s\S]*readonly sourceFacts: ReadonlySourceFactResolver;[\s\S]*readonly navigation: SourceProgramNavigation;[\s\S]*readonly semantics: SourceProgramSemantics;/u,
  );
  assert.doesNotMatch(productSource, /\b(?:TargetTypeRef|RuntimeCarrierFact|getRuntimeCarrierFact|getSelectedTargetCall)\b/u);
  assert.doesNotMatch(productSource, /kind:\s*["']target-named["']/u);
});

test("retired host target-fact modules cannot re-enter the product boundary", async () => {
  await assert.rejects(
    () => access(resolve(hostSourceRoot, "target-facts/runtime-carriers.ts")),
    { code: "ENOENT" },
  );
  await assert.rejects(
    () => access(resolve(hostSourceRoot, "target-facts/queries.ts")),
    { code: "ENOENT" },
  );
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
