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
    if (bannedProductFileNames.includes(basename(sourceFile))) {
      failures.push(repoRelative(sourceFile));
    }
  }

  assert.deepEqual(failures, []);
});

test("product source has no catch-all semantic facade names", async () => {
  const failures = [];
  for (const sourceFile of await productSourceFiles()) {
    const relativePath = repoRelative(sourceFile);
    const pathParts = relativePath.split("/");
    if (pathParts.includes("semantic") || pathParts.includes("semantics")) {
      failures.push(`${relativePath}: catch-all semantic directory`);
    }

    const text = await readFile(sourceFile, "utf8");
    if (/\bTargetSemantic(?:Queries|NodeOptions)\b/u.test(text)) {
      failures.push(`${relativePath}: catch-all TargetSemantic API`);
    }
  }

  assert.deepEqual(failures, []);
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
