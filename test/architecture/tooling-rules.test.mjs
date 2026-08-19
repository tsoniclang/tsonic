import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateArchitecture,
  evaluateBarrelModules,
} from "./tooling/architecture-rules.mjs";
import { classifyFiles } from "./tooling/layer-classification.mjs";
import {
  evaluateTestDomainOwnership,
  evaluateTestSuiteOwnership,
} from "./tooling/test-inventory.mjs";
import {
  evaluatePublicExportInventory,
} from "./tooling/public-export-inventory.mjs";

test("architecture layer rules reject every forbidden dependency direction", () => {
  const cases = [
    ["ARCH-PROVIDER-001", "provider", "printer"],
    ["ARCH-POLICY-001", "policy", "planner"],
    ["ARCH-ANALYSIS-001", "analysis", "planner"],
    ["ARCH-PLANNER-001", "planner", "provider-worker"],
    ["ARCH-PRINTER-001", "printer", "policy"],
    ["ARCH-TOOLCHAIN-001", "toolchain", "analysis"],
  ];
  for (const [ruleId, sourceLayer, targetLayer] of cases) {
    const result = evaluateArchitecture({
      sourceFiles: new Map([
        ["src/source.ts", "export {};"],
        ["src/target.ts", "export {};"],
      ]),
      edges: [{
        source: "src/source.ts",
        target: "src/target.ts",
        kind: "relative",
        unresolved: false,
        specifier: "./target.js",
      }],
      classifications: new Map([
        ["src/source.ts", sourceLayer],
        ["src/target.ts", targetLayer],
      ]),
      layerPolicies: [{
        source: sourceLayer,
        allowed: new Set(),
        ruleId,
        reason: "mutation",
      }],
    });
    assert.deepEqual(result.findings.map((finding) => finding.ruleId), [ruleId]);
  }
});

test("shared and sibling-target package mutations fail at their exact rules", () => {
  for (const ruleId of ["ARCH-SHARED-001", "ARCH-TARGET-001"]) {
    const result = evaluateArchitecture({
      sourceFiles: new Map([["src/source.ts", "export {};"]]),
      edges: [{
        source: "src/source.ts",
        target: undefined,
        kind: "package",
        unresolved: false,
        specifier: "@forbidden/package",
      }],
      classifications: new Map([["src/source.ts", "source"]]),
      forbiddenPackages: [{
        prefix: "@forbidden/package",
        ruleId,
        reason: "mutation",
      }],
    });
    assert.deepEqual(result.findings.map((finding) => finding.ruleId), [ruleId]);
  }
});

test("source AST, module, directory, vague-root, and size mutations fail closed", () => {
  const oversized = Array.from({ length: 901 }, () => "x").join("\n");
  const result = evaluateArchitecture({
    sourceFiles: new Map([
      ["src/common/value.ts", "const raw = node.data;"],
      ["src/root.ts", oversized],
    ]),
    edges: [{
      source: "src/root.ts",
      target: undefined,
      kind: "relative",
      unresolved: true,
      specifier: "./missing.js",
    }],
    classifications: new Map([
      ["src/common/value.ts", "policy"],
      ["src/root.ts", "policy"],
    ]),
    forbiddenDirectories: ["common"],
    rootPolicies: [{
      prefix: "src/",
      allowed: new Set(),
    }],
    sourceRules: [{
      ruleId: "ARCH-SOURCE-AST-001",
      matches: (_file, source) => /\bnode\.data\b/u.test(source),
      reason: "mutation",
    }],
  });
  assert.deepEqual(
    [...new Set(result.findings.map((finding) => finding.ruleId))].sort(),
    [
      "ARCH-DIRECTORY-001",
      "ARCH-FILE-SIZE-001",
      "ARCH-MODULE-001",
      "ARCH-NO-VAGUE-ROOT-001",
      "ARCH-SOURCE-AST-001",
    ],
  );
});

test("cross-layer cycles and implementation barrels are discriminating", () => {
  const sourceFiles = new Map([
    ["src/policy/a.ts", "export {};"],
    ["src/analysis/b.ts", "export {};"],
  ]);
  const cycle = evaluateArchitecture({
    sourceFiles,
    edges: [
      { source: "src/policy/a.ts", target: "src/analysis/b.ts", kind: "relative", unresolved: false, specifier: "../analysis/b.js" },
      { source: "src/analysis/b.ts", target: "src/policy/a.ts", kind: "relative", unresolved: false, specifier: "../policy/a.js" },
    ],
    classifications: new Map([
      ["src/policy/a.ts", "policy"],
      ["src/analysis/b.ts", "analysis"],
    ]),
  });
  assert.deepEqual(cycle.findings.map((finding) => finding.ruleId), ["ARCH-CYCLE-001"]);
  assert.deepEqual(
    evaluateBarrelModules([{
      file: "src/policy/index.ts",
      topLevelKinds: ["KindExportDeclaration", "KindFunctionDeclaration"],
    }]).map((finding) => finding.ruleId),
    ["ARCH-INDEX-001"],
  );
});

test("classification, test ownership, and public API mutations are discriminating", () => {
  assert.deepEqual(
    classifyFiles(["src/unowned.ts"], []).findings.map((finding) => finding.ruleId),
    ["ARCH-CLASSIFICATION-001"],
  );
  assert.deepEqual(
    evaluateTestSuiteOwnership(
      ["test/policy/example.test.mjs"],
      [
        { id: "all", directory: "test" },
        { id: "policy", directory: "test/policy" },
      ],
    ).map((finding) => finding.ruleId),
    ["ARCH-TEST-001"],
  );
  assert.deepEqual(
    evaluateTestDomainOwnership(
      ["test/unknown/example.test.mjs"],
      [{ directory: "test/unknown", productDomain: "unknown" }],
      new Set(["policy"]),
    ).map((finding) => finding.ruleId),
    ["ARCH-TEST-002"],
  );
  assert.deepEqual(
    evaluatePublicExportInventory({
      manifest: { exports: { ".": {}, "./internal": {} } },
      expectedEntrypoints: ["."],
      sourceTextByEntrypoint: new Map([
        ["src/public/index.ts", "export { createPlanner } from './planner.js';"],
      ]),
      forbiddenNamesByEntrypoint: new Map([
        ["src/public/index.ts", ["createPlanner"]],
      ]),
    }).map((finding) => finding.ruleId),
    ["ARCH-API-001", "ARCH-API-001"],
  );
});
