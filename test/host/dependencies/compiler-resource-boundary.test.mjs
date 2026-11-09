import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compileProject, parseTsonicProjectConfig } from "../../../packages/host/dist/index.js";
import { createTargetRegistry } from "@tsonic/target-api";
import { createCsharpTargetPack } from "../../../../tsonic-csharp/dist/public/index.js";
import { sourceTypeExpansionBudget } from "../../../packages/target-api/dist/source-semantics/type-expansion-budget.js";

async function compileAtBoundary(name, text, demand) {
  const projectDirectory = resolve(".temp/test-runs/compiler-resource-boundary", `${process.pid}-${name}`);
  const target = { id: "csharp", options: { outputType: "Library" } };
  const config = { entryPoint: "index.ts", rootDir: ".", outDir: "out", targets: [target] };
  await mkdir(projectDirectory, { recursive: true });
  await writeFile(resolve(projectDirectory, "index.ts"), text);
  await writeFile(resolve(projectDirectory, "tsonic.json"), JSON.stringify(config));
  const original = createCsharpTargetPack();
  const pack = { ...original, createCompilationSession(context) {
    const session = original.createCompilationSession(context);
    return { ...session, compile(input) {
      demand(input.source);
      return session.compile(input);
    } };
  } };
  return compileProject({ project: parseTsonicProjectConfig(config),
    projectFilePath: resolve(projectDirectory, "tsonic.json"), registry: createTargetRegistry([pack]) });
}

test("normal compilation retains the exact demanded Source resource diagnostic and original site", async () => {
  const text = `type Expanded = number${"[]".repeat(sourceTypeExpansionBudget.depth + 1)}; export const anchor = 1;`;
  let targetReached = false;
  const result = await compileAtBoundary("resource", text, () => {
    targetReached = true;
  });
  assert.equal(targetReached, false, "Source assembly hits its existing expansion limit before target compilation");
  assert.equal(result.targets.length, 1);
  assert.equal(result.targets[0].compileResult.kind, "rejected");
  assert.equal(result.diagnostics.length, 1);
  const diagnostic = result.diagnostics[0];
  assert.equal(diagnostic === result.targets[0].compileResult.diagnostics[0], true,
    "the normal entry retains the same diagnostic object through its rejected target result");
  assert.equal(diagnostic.code, "TSONIC_COMPILER_RESOURCE_LIMIT");
  assert.equal(diagnostic.source, "tsonic");
  assert.deepEqual(diagnostic.evidence, [`depth=${sourceTypeExpansionBudget.depth}`]);
  const site = diagnostic.sourceNode;
  assert.equal(site !== undefined, true, "the original owner site is not replaced with the target id");
  assert.equal(site.Loc.pos >= text.indexOf("number") - 1 && site.Loc.end <= text.indexOf(";"), true,
  "the resource site remains inside the exact demanded original annotation");
  let root = site;
  while (root.Parent !== undefined) root = root.Parent;
  assert.equal(root.Loc.pos, 0);
  assert.equal(root.Loc.end, text.length, "the diagnostic still belongs to the complete original input file");
  assert.equal(result.diagnostics.some(issue => issue.code === "TARGET_COMPILATION"), false);
});

test("normal compilation preserves the ordinary internal-failure TARGET_COMPILATION boundary", async () => {
  const failure = new Error("target invariant failed");
  let demanded = false;
  const result = await compileAtBoundary("ordinary", "export const anchor = 1;", () => {
    demanded = true;
    throw failure;
  });
  assert.equal(demanded, true, "ordinary failure is observed after the same real Source assembly and target session");
  assert.equal(result.targets.length, 1);
  assert.equal(result.targets[0].compileResult.kind, "rejected");
  assert.deepEqual(result.diagnostics, [{ code: "TARGET_COMPILATION", category: "error", source: "csharp",
    message: failure.message }]);
});
