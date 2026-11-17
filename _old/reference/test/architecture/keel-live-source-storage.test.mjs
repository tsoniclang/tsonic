import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { readSourceInventory } from "./tooling/file-inventory.mjs";
import { buildTypeScriptModuleGraph } from "./tooling/module-graph.mjs";
import { evaluateKeelStorageStages } from "./tooling/keel-structure-checks.mjs";

test("AC8 checks the current Host storage stages and type-only dependency graph", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const prefix = "packages/target-api/src";
  const sources = new Map([...readSourceInventory(resolve(root, prefix), {
    extensions: [".ts", ".tsx", ".mts", ".mjs"],
    exclude: [".analysis", ".temp", ".test", ".tests", ".git", "bin", "dist", "node_modules", "obj", "target"],
  })].map(([path, text]) => [`${prefix}/${path}`, text]));
  const edges = buildTypeScriptModuleGraph(sources);
  const findings = evaluateKeelStorageStages(sources, edges);
  assert.equal(findings.length === 0, true,
    findings.slice(0, 8).map(row => `${row.file}#${row.subject}: ${row.reason}`).join("\n"));
});
