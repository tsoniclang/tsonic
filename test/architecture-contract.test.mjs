import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

const productSourceRoots = Object.freeze([
  "packages/cli/src",
  "packages/host/src",
  "packages/source-core/src",
  "packages/target-api/src",
]);

const packageManifestPaths = Object.freeze([
  "package.json",
  "packages/cli/package.json",
  "packages/host/package.json",
  "packages/source-core/package.json",
  "packages/target-api/package.json",
]);

const allowedRootDevDependencies = Object.freeze([
  "@types/node",
  "@typescript/native-preview",
]);

const bannedProductFileNames = Object.freeze([
  "collection-target-metadata.ts",
  "policy.ts",
  "property-policy.ts",
  "provider-metadata.ts",
  "selection-policy.ts",
  "module-specifier-scan.ts",
  "source-usage.ts",
]);

const forbiddenSourcePatterns = Object.freeze([
  {
    name: "CommonJS require call",
    pattern: /(^|[^\w$])require\s*\(/u,
  },
  {
    name: "CommonJS module.exports assignment",
    pattern: /\bmodule\s*\.\s*exports\s*=/u,
  },
  {
    name: "CommonJS exports mutation",
    pattern: /(^|[^\w$.])exports\s*\./u,
  },
  {
    name: "TypeScript export assignment",
    pattern: /\bexport\s*=/u,
  },
  {
    name: "triple-slash reference",
    pattern: /^\s*\/\/\/\s*<reference\b/mu,
  },
  {
    name: "namespace declaration shim",
    pattern: /^\s*(?:export\s+)?namespace\s+[A-Za-z_$]/mu,
  },
  {
    name: "ambient module shim",
    pattern: /^\s*declare\s+module\s+["{]/mu,
  },
]);

const forbiddenSourceUsageMemberScanningPatterns = Object.freeze([
  {
    name: "TargetSourceUsageHints API",
    pattern: /\bTargetSourceUsageHints\b/u,
  },
  {
    name: "sourceUsage context channel",
    pattern: /\bsourceUsage\b/u,
  },
  {
    name: "sourceMemberNames context channel",
    pattern: /\bsourceMemberNames\b/u,
  },
  {
    name: "collectProjectSourceUsageHints scan hook",
    pattern: /\bcollectProjectSourceUsageHints\b/u,
  },
  {
    name: "raw property-access member regex scan",
    pattern: /\/\(\?:\\\?\\\.\|\\\.\)\\s\*/u,
  },
]);

const forbiddenRawModuleSpecifierScanningPatterns = Object.freeze([
  {
    name: "collectProjectModuleSpecifiers scan hook",
    pattern: /\bcollectProjectModuleSpecifiers\b/u,
  },
  {
    name: "collectModuleSpecifiersFromText raw text parser",
    pattern: /\bcollectModuleSpecifiersFromText\b/u,
  },
  {
    name: "raw module import regex scan",
    pattern: /\\bimport\\s\+/u,
  },
]);

test("product compiler source stays ESM-only and native-compilable", async () => {
  const failures = [];
  for (const sourceFile of await productSourceFiles()) {
    const text = await readFile(sourceFile, "utf8");
    for (const forbidden of forbiddenSourcePatterns) {
      if (forbidden.pattern.test(text)) {
        failures.push(`${repoRelative(sourceFile)}: ${forbidden.name}`);
      }
    }
  }

  assert.deepEqual(failures, []);
});

test("architecture validator rejects non-ESM and non-native source snippets", () => {
  const rejectedSnippets = [
    ["CommonJS require call", "const fs = require('node:fs');"],
    ["CommonJS module.exports assignment", "module.exports = {};"],
    ["CommonJS exports mutation", "exports.value = 1;"],
    ["TypeScript export assignment", "export = value;"],
    ["triple-slash reference", "/// <reference types=\"node\" />"],
    ["namespace declaration shim", "namespace Legacy { export const value = 1; }"],
    ["ambient module shim", "declare module \"legacy\" { export const value: number; }"],
  ];

  for (const [name, text] of rejectedSnippets) {
    assert.equal(
      forbiddenSourcePatterns.some((forbidden) => forbidden.name === name && forbidden.pattern.test(text)),
      true,
      `expected snippet to be rejected as ${name}`,
    );
  }
});

test("product compiler source has no source-usage member scanning channel", async () => {
  const failures = [];
  for (const sourceFile of await productSourceFiles()) {
    const relativePath = repoRelative(sourceFile);
    const text = await readFile(sourceFile, "utf8");
    failures.push(...sourceUsageMemberScanningFailures(relativePath, text));
  }

  assert.deepEqual(failures, []);
});

test("architecture validator rejects source-usage member scanning snippets", () => {
  assert.deepEqual(
    sourceUsageMemberScanningFailures(
      "packages/host/src/source-usage.ts",
      `
        export interface TargetSourceUsageHints {
          readonly memberNames?: readonly string[];
        }
        export function collectProjectSourceUsageHints(projectRoot) {
          const propertyAccessPattern = /(?:\\?\\.|\\.)\\s*([A-Za-z_$][\\w$]*)/gu;
          return { sourceUsage: [...projectRoot.matchAll(propertyAccessPattern)] };
        }
      `,
    ),
    [
      "packages/host/src/source-usage.ts: banned source-usage product file",
      "packages/host/src/source-usage.ts: TargetSourceUsageHints API",
      "packages/host/src/source-usage.ts: sourceUsage context channel",
      "packages/host/src/source-usage.ts: collectProjectSourceUsageHints scan hook",
      "packages/host/src/source-usage.ts: raw property-access member regex scan",
    ],
  );

  assert.deepEqual(
    sourceUsageMemberScanningFailures(
      "packages/host/src/target/extensions.ts",
      "provider.createExtensions({ sourceMemberNames: context.sourceUsage?.memberNames });",
    ),
    [
      "packages/host/src/target/extensions.ts: sourceUsage context channel",
      "packages/host/src/target/extensions.ts: sourceMemberNames context channel",
    ],
  );
});

test("product compiler source has no raw module specifier scanning channel", async () => {
  const failures = [];
  for (const sourceFile of await productSourceFiles()) {
    const relativePath = repoRelative(sourceFile);
    const text = await readFile(sourceFile, "utf8");
    failures.push(...rawModuleSpecifierScanningFailures(relativePath, text));
  }

  assert.deepEqual(failures, []);
});

test("architecture validator rejects raw module specifier scanning snippets", () => {
  assert.deepEqual(
    rawModuleSpecifierScanningFailures(
      "packages/host/src/module-specifier-scan.ts",
      `
        export function collectProjectModuleSpecifiers(projectRoot) {
          return collectModuleSpecifiersFromText(projectRoot).matchAll(/\\bimport\\s+/g);
        }
      `,
    ),
    [
      "packages/host/src/module-specifier-scan.ts: banned raw module-specifier scanner product file",
      "packages/host/src/module-specifier-scan.ts: collectProjectModuleSpecifiers scan hook",
      "packages/host/src/module-specifier-scan.ts: collectModuleSpecifiersFromText raw text parser",
      "packages/host/src/module-specifier-scan.ts: raw module import regex scan",
    ],
  );
});

test("architecture scan scope covers every first-party product source root", async () => {
  const expectedRoots = Object.freeze([
    "packages/cli/src",
    "packages/host/src",
    "packages/source-core/src",
    "packages/target-api/src",
  ]);

  assert.deepEqual(productSourceRoots, expectedRoots);
});

test("product source has no procedural policy or metadata blob filenames", async () => {
  const failures = [];
  for (const sourceFile of await productSourceFiles()) {
    if (isBannedProductFileName(sourceFile)) {
      failures.push(repoRelative(sourceFile));
    }
  }

  assert.deepEqual(failures, []);
});

test("architecture validator rejects procedural policy and metadata blob filenames", () => {
  const rejectedPaths = bannedProductFileNames.map((fileName) => join(repoRoot, "packages/target-api/src", fileName));

  assert.deepEqual(rejectedPaths.map(isBannedProductFileName), rejectedPaths.map(() => true));
});

test("product source has no catch-all semantic facade names", async () => {
  const failures = [];
  for (const sourceFile of await productSourceFiles()) {
    const relativePath = repoRelative(sourceFile);
    const text = await readFile(sourceFile, "utf8");
    failures.push(...catchAllSemanticFailures(relativePath, text));
  }

  assert.deepEqual(failures, []);
});

test("architecture validator rejects catch-all semantic directories and APIs", () => {
  assert.deepEqual(
    catchAllSemanticFailures("packages/target-api/src/semantics/index.ts", "export const value = 1;"),
    ["packages/target-api/src/semantics/index.ts: catch-all semantic directory"],
  );
  assert.deepEqual(
    catchAllSemanticFailures("packages/target-api/src/pack.ts", "export interface TargetSemanticQueries {}"),
    ["packages/target-api/src/pack.ts: catch-all TargetSemantic API"],
  );
});

test("target fact API exposes structured carrier resolution instead of optional raw carriers", async () => {
  const text = await readFile(join(repoRoot, "packages/target-api/src/pack.ts"), "utf8");

  assert.match(text, /\bexport type TargetCarrierResolution = TargetCarrierResolved \| TargetCarrierMissing;/u);
  assert.doesNotMatch(text, /\bgetRuntimeCarrierForNode\b/u);
  assert.doesNotMatch(text, /\bgetResolvedCallReturnRuntimeCarrier\b/u);
  assert.doesNotMatch(text, /\bgetResolvedCallParameterRuntimeCarriers\b/u);
  assert.doesNotMatch(text, /\bgetReturnTypeCarrierFromDeclaration\b/u);
  assert.doesNotMatch(text, /resolveRuntimeCarrierForNode\([^)]*\):\s*TargetTypeRef\s*\|\s*undefined/u);
  assert.doesNotMatch(text, /resolveCallReturnRuntimeCarrier\([^)]*\):\s*TargetTypeRef\s*\|\s*undefined/u);
  assert.doesNotMatch(text, /resolveDeclarationReturnCarrier\([^)]*\):\s*TargetTypeRef\s*\|\s*undefined/u);
});

test("target pack API exposes explicit provider surface backend runtime and toolchain modules", async () => {
  const text = await readFile(join(repoRoot, "packages/target-api/src/pack.ts"), "utf8");

  assert.match(text, /export interface TargetProvider\b/u);
  assert.match(text, /export interface TargetSurfaceImplementation\b/u);
  assert.match(text, /export interface TargetBackend\b/u);
  assert.match(text, /export interface TargetToolchain\b/u);
  assert.match(text, /export interface TargetRuntimeContributionContext\b/u);
  assert.match(text, /readonly provider\?: TargetProvider;/u);
  assert.match(text, /readonly surfaces\?: readonly TargetSurfaceImplementation\[\];/u);
  assert.match(text, /createBackend\(context: TargetBackendContext\): TargetBackend;/u);
  assert.match(text, /createToolchain\(context: TargetToolchainContext\): TargetToolchain;/u);
});

test("product package manifests use only approved compiler/runtime dependencies", async () => {
  const failures = [];
  for (const manifestPath of packageManifestPaths) {
    const manifest = JSON.parse(await readFile(join(repoRoot, manifestPath), "utf8"));
    collectDisallowedDependencies(failures, manifestPath, "dependencies", manifest.dependencies, isAllowedProductDependency);
    collectDisallowedDependencies(failures, manifestPath, "optionalDependencies", manifest.optionalDependencies, isAllowedProductDependency);
    collectDisallowedDependencies(failures, manifestPath, "peerDependencies", manifest.peerDependencies, isAllowedProductDependency);
    collectDisallowedDependencies(
      failures,
      manifestPath,
      "devDependencies",
      manifest.devDependencies,
      (name) => manifestPath === "package.json" && allowedRootDevDependencies.includes(name),
    );
  }

  assert.deepEqual(failures, []);
});

test("architecture validator rejects unapproved product dependencies", () => {
  const failures = [];
  collectDisallowedDependencies(failures, "packages/host/package.json", "dependencies", {
    "@tsonic/target-api": "workspace:*",
    "left-pad": "^1.3.0",
  }, isAllowedProductDependency);
  collectDisallowedDependencies(failures, "package.json", "devDependencies", {
    "@types/node": "latest",
    "some-build-helper": "latest",
  }, (name) => allowedRootDevDependencies.includes(name));

  assert.deepEqual(failures, [
    "packages/host/package.json:dependencies:left-pad",
    "package.json:devDependencies:some-build-helper",
  ]);
});

function isBannedProductFileName(sourceFile) {
  return bannedProductFileNames.includes(basename(sourceFile));
}

function catchAllSemanticFailures(relativePath, text) {
  const failures = [];
  const pathParts = relativePath.split("/");
  if (pathParts.includes("semantic") || pathParts.includes("semantics")) {
    failures.push(`${relativePath}: catch-all semantic directory`);
  }
  if (/\bTargetSemantic(?:Queries|NodeOptions)\b/u.test(text)) {
    failures.push(`${relativePath}: catch-all TargetSemantic API`);
  }
  return failures;
}

function sourceUsageMemberScanningFailures(relativePath, text) {
  const failures = [];
  if (basename(relativePath) === "source-usage.ts") {
    failures.push(`${relativePath}: banned source-usage product file`);
  }
  for (const forbidden of forbiddenSourceUsageMemberScanningPatterns) {
    if (forbidden.pattern.test(text)) {
      failures.push(`${relativePath}: ${forbidden.name}`);
    }
  }
  return failures;
}

function rawModuleSpecifierScanningFailures(relativePath, text) {
  const failures = [];
  if (basename(relativePath) === "module-specifier-scan.ts") {
    failures.push(`${relativePath}: banned raw module-specifier scanner product file`);
  }
  for (const forbidden of forbiddenRawModuleSpecifierScanningPatterns) {
    if (forbidden.pattern.test(text)) {
      failures.push(`${relativePath}: ${forbidden.name}`);
    }
  }
  return failures;
}

function collectDisallowedDependencies(failures, manifestPath, field, dependencies, isAllowed) {
  if (dependencies === undefined) {
    return;
  }
  for (const dependencyName of Object.keys(dependencies)) {
    if (!isAllowed(dependencyName)) {
      failures.push(`${manifestPath}:${field}:${dependencyName}`);
    }
  }
}

function isAllowedProductDependency(name) {
  return name.startsWith("@tsonic/");
}

async function productSourceFiles() {
  const files = [];
  for (const sourceRoot of productSourceRoots) {
    await collectSourceFiles(join(repoRoot, sourceRoot), files);
  }
  return files.sort();
}

async function collectSourceFiles(directory, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectSourceFiles(path, files);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) {
      continue;
    }
    files.push(path);
  }
}

function repoRelative(path) {
  return relative(repoRoot, path);
}
