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
import {
  canonicalTargetForbiddenDirectories,
  canonicalTargetLayerPolicies,
  canonicalTargetSourceRules,
  targetLayerNames,
} from "./tooling/target-layer-contract.mjs";

test("canonical target layer contract is complete and discriminating", () => {
  assert.deepEqual(
    canonicalTargetLayerPolicies.map((policy) => policy.source),
    targetLayerNames,
  );
  assert.equal(new Set(targetLayerNames).size, targetLayerNames.length);
  assert.equal(canonicalTargetForbiddenDirectories.includes("compat"), true);
  assert.equal(canonicalTargetForbiddenDirectories.includes("legacy"), true);
  const mutation = evaluateArchitecture({
    sourceFiles: new Map([
      ["src/policy/rule.ts", "export {};"],
      ["src/backend/planner/plan.ts", "export {};"],
    ]),
    edges: [{
      source: "src/policy/rule.ts",
      target: "src/backend/planner/plan.ts",
      kind: "relative",
      unresolved: false,
      specifier: "../backend/planner/plan.js",
    }],
    classifications: new Map([
      ["src/policy/rule.ts", "policy"],
      ["src/backend/planner/plan.ts", "planner"],
    ]),
    layerPolicies: canonicalTargetLayerPolicies,
  });
  assert.deepEqual(mutation.findings.map((finding) => finding.ruleId), [
    "ARCH-POLICY-001",
  ]);
  const sourceRuleMutations = [
    ["ARCH-TARGET-SESSION-001", "src/backend/compile.ts", "createBackend(context);"],
    ["ARCH-TARGET-SOURCE-001", "src/policy/types.ts", "checker.getSymbolAtLocation(node);"],
    ["ARCH-TARGET-SOURCE-002", "src/analysis/program.ts", "interface Queries extends TypeCheckerQueries {}"],
    ["ARCH-TARGET-CONTEXT-001", "src/backend/planner/context.ts", "interface RustPlanningContext extends RustTargetProgram {}"],
    ["ARCH-TARGET-CONTEXT-002", "src/backend/planner/context.ts", "const context = { ...input, ...program };"],
    ["ARCH-TARGET-CAPABILITY-001", "src/compilation/session.ts", "capability.createTargetContributions?.(context);"],
    ["ARCH-TARGET-PROVIDER-001", "src/backend/planner/program.ts", "const provider = createReflectionProvider();"],
    ["ARCH-TARGET-EMISSION-001", "src/backend/emission/materialize.ts", "function materialize(input: TargetCompileInput) {}"],
    ["ARCH-TARGET-SESSION-002", "src/descriptor/target-pack.ts", "const sessions = new WeakMap<object, object>();"],
    ["ARCH-TARGET-IDENTITY-001", "src/policy/storage.ts", "const identity = outputIdentity.artifactPath;"],
    ["ARCH-TARGET-LAYOUT-001", "src/backend/project-model/model.ts", "export {};"],
  ];
  for (const [ruleId, file, source] of sourceRuleMutations) {
    assert.equal(
      canonicalTargetSourceRules.some((rule) =>
        rule.ruleId === ruleId && rule.matches(file, source)),
      true,
      `${ruleId} did not reject its mutation`,
    );
  }
});

test("architecture layer rules reject every forbidden dependency direction", () => {
  const cases = [
    ["ARCH-PROVIDER-001", "provider-implementation", "printer"],
    ["ARCH-POLICY-001", "policy", "planner"],
    ["ARCH-ANALYSIS-001", "analysis", "planner"],
    ["ARCH-PLANNER-001", "planner", "provider-implementation"],
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
