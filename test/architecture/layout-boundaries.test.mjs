import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import test from "node:test";
import {
  evaluateArchitecture,
  evaluateBarrelModules,
  formatArchitectureFindings,
} from "./tooling/architecture-rules.mjs";
import { collectFiles, readSourceInventory } from "./tooling/file-inventory.mjs";
import { classifyFiles } from "./tooling/layer-classification.mjs";
import { buildTypeScriptModuleAnalysis } from "./tooling/module-graph.mjs";
import {
  evaluateTestDomainOwnership,
  evaluateTestSuiteOwnership,
} from "./tooling/test-inventory.mjs";
import { createParallelSuiteDefinition } from "../scripts/suite-definition.mjs";
import {
  sharedAllowedImplementationIndexes,
  sharedForbiddenDirectories,
  sharedForbiddenPackages,
  sharedLayerPolicies,
  sharedLayerRules,
  sharedPackageLayers,
  sharedRootPolicies,
} from "./layer-policy.mjs";

const repositoryRoot = resolve(new URL("../..", import.meta.url).pathname);
const productPrefixes = Object.freeze([
  "packages/cli/src/",
  "packages/host/src/",
  "packages/source-core/src/",
  "packages/target-api/src/",
]);

test("shared Tsonic product imports conform to the declared architecture", () => {
  const repositorySources = readSourceInventory(repositoryRoot, {
    extensions: [".ts"],
    exclude: [
      ".analysis", ".temp", "dist", "node_modules", "packages/tsts", "test",
    ],
  });
  const sourceFiles = new Map([...repositorySources].filter(([path]) =>
    productPrefixes.some((prefixValue) => path.startsWith(prefixValue)) &&
    !path.endsWith(".test.ts") &&
    !path.endsWith(".fixtures.ts")
  ));
  const classification = classifyFiles(sourceFiles.keys(), sharedLayerRules);
  const moduleAnalysis = buildTypeScriptModuleAnalysis(sourceFiles);
  const architecture = evaluateArchitecture({
    sourceFiles,
    edges: moduleAnalysis.edges,
    classifications: classification.classifications,
    layerPolicies: sharedLayerPolicies,
    forbiddenPackages: sharedForbiddenPackages,
    packageLayers: sharedPackageLayers,
    forbiddenDirectories: sharedForbiddenDirectories,
    rootPolicies: sharedRootPolicies,
  });
  const barrelFindings = evaluateBarrelModules(moduleAnalysis.modules, {
    allowedImplementationFiles: sharedAllowedImplementationIndexes,
  });
  const findings = [
    ...classification.findings,
    ...architecture.findings,
    ...barrelFindings,
  ];
  assert.deepEqual(findings, [], formatArchitectureFindings(findings));
});

test("shared packages expose only deliberate audience entrypoints", () => {
  const expectedEntrypoints = new Map([
    ["target-api", [".", "./artifacts", "./package.json", "./provider", "./source"]],
    ["source-core", [".", "./extension", "./facts", "./package.json"]],
    ["host", ["."]],
  ]);
  for (const [packageName, expected] of expectedEntrypoints) {
    const manifest = JSON.parse(readFileSync(
      resolve(repositoryRoot, `packages/${packageName}/package.json`),
      "utf8",
    ));
    assert.deepEqual(Object.keys(manifest.exports).sort(), expected);
  }
});

test("parallel suite ownership is recursive and one-to-one", () => {
  const repos = {
    tsonic: repositoryRoot,
    tsonicCsharp: resolve(repositoryRoot, "../tsonic-csharp"),
    csharpJs: resolve(repositoryRoot, "../csharp-js"),
    csharpNodejs: resolve(repositoryRoot, "../csharp-nodejs"),
    csharpRuntime: resolve(repositoryRoot, "../csharp-runtime"),
  };
  const definition = createParallelSuiteDefinition(repos);
  const findings = [];
  for (const testRoot of definition.testRoots) {
    const repository = testRoot.scope === "tsonic"
      ? repos.tsonic
      : testRoot.scope === "tsonic-csharp"
        ? repos.tsonicCsharp
        : repos.csharpNodejs;
    const files = collectFiles(testRoot.directory, { extensions: [".test.mjs"] })
      .map((file) => normalize(relative(repository, resolve(testRoot.directory, file))));
    const suites = definition.nodeSuites
      .filter((suite) => suite.scope === testRoot.scope)
      .map((suite) => ({
        id: `${suite.scope}:${suite.group}:${normalize(relative(repository, suite.directory))}`,
        directory: normalize(relative(repository, suite.directory)),
        recursive: suite.recursive,
        maxDepth: suite.maxDepth,
      }));
    findings.push(...evaluateTestSuiteOwnership(files, suites));
  }
  assert.deepEqual(findings, [], formatArchitectureFindings(findings));
});

test("shared tests mirror explicit product and infrastructure domains", () => {
  const files = collectFiles(resolve(repositoryRoot, "test"), {
    extensions: [".test.mjs"],
  }).map((file) => `test/${normalize(file)}`);
  const domains = [
    "architecture",
    "cli-build",
    "host",
    "infrastructure",
    "source-core",
    "target-api",
  ];
  const findings = evaluateTestDomainOwnership(
    files,
    domains.map((domain) => ({
      directory: `test/${domain}`,
      productDomain: domain,
    })),
    new Set(domains),
  );
  assert.deepEqual(findings, [], formatArchitectureFindings(findings));
});

function normalize(path) {
  return path.replaceAll("\\", "/");
}
