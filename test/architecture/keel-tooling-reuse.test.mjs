import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "../../packages/tsts/dist/src/index.js";
import { evaluateArchitecture, evaluateModuleLayerDependencies } from "./tooling/architecture-rules.mjs";
import { analyzeCheckedTypeScriptModules, buildTypeScriptModuleAnalysis } from "./tooling/module-graph.mjs";
import { analyzeKeelTypeScript } from "./tooling/keel-source-analysis.mjs";

test("shared graph extraction preserves authored import/export/dynamic-import edges and module kinds", () => {
  const sourceFiles = new Map([
    ["src/source/entry.ts", 'import type { Value } from "../target-model/value.js"; export { identity } from "../target-model/value.js"; export async function load(): Promise<void> { await import("../target-model/value.js"); }'],
    ["src/target-model/value.ts", "export interface Value {} export const identity = 1;"],
  ]);
  const expected = buildTypeScriptModuleAnalysis(sourceFiles);
  const session = createCompilerSessionFromFiles({
    currentDirectory: "/reuse",
    files: new Map([...sourceFiles].map(([path, text]) => [`/reuse/${path}`, text])),
    rootFiles: [...sourceFiles.keys()],
    compilerOptions: { module: "esnext", moduleResolution: "bundler", target: "esnext", noLib: true, noResolve: true },
  });
  const extracted = analyzeCheckedTypeScriptModules(session.checkSource(), sourceFiles, "/reuse/");
  assert.deepEqual(extracted, expected);
  assert.equal(expected.edges.length, 3);
  assert.equal(expected.edges.every(edge => edge.target === "src/target-model/value.ts"), true);
  assert.deepEqual(analyzeKeelTypeScript(sourceFiles).edges, expected.edges);
});

test("shared dependency extraction preserves canonical allow rules, forbidden edges, packages and unresolved errors", () => {
  const sourceFiles = new Map([["src/source.ts", "export {};"], ["src/target.ts", "export {};"]]);
  const common = {
    sourceFiles, classifications: new Map([["src/source.ts", "source"], ["src/target.ts", "target"]]),
    layerPolicies: [{ source: "source", allowed: new Set(), ruleId: "EXACT-ALLOW", reason: "Boundary" }],
    forbiddenPackages: [{ prefix: "@blocked/pkg", ruleId: "EXACT-PACKAGE", reason: "Package boundary" }],
    packageLayers: [{ prefix: "@mapped/pkg", layer: "target" }],
    forbiddenLayerEdges: [{ source: "source", targets: ["target"], ruleId: "EXACT-EDGE", reason: "Forbidden edge" }],
  };
  for (const edge of [
    { source: "src/source.ts", target: "src/target.ts", specifier: "./target.js", kind: "relative", unresolved: false },
    { source: "src/source.ts", specifier: "./missing.js", kind: "relative", unresolved: true },
    { source: "src/source.ts", specifier: "@blocked/pkg/child", kind: "package", unresolved: false },
    { source: "src/source.ts", specifier: "@mapped/pkg/child", kind: "package", unresolved: false },
    { source: "src/source.ts", specifier: "@unrelated/pkg", kind: "package", unresolved: false },
  ]) {
    const inputs = { ...common, edges: [edge] };
    assert.deepEqual(evaluateModuleLayerDependencies(inputs), evaluateArchitecture(inputs).findings);
  }
  const allowed = { ...common, layerPolicies: [{ ...common.layerPolicies[0], allowed: new Set(["target"]) }],
    edges: [{ source: "src/source.ts", target: "src/target.ts", specifier: "./target.js", kind: "relative", unresolved: false }] };
  assert.equal(evaluateModuleLayerDependencies(allowed)[0]?.ruleId === "EXACT-EDGE", true);
  assert.equal(evaluateModuleLayerDependencies({ ...allowed, forbiddenLayerEdges: [] }).length, 0);
});
