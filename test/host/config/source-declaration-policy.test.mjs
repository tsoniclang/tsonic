import assert from "node:assert/strict";
import test from "node:test";
import { collectTargetSourceProfileContributions } from "../../../packages/host/dist/index.js";

const project = {
  entryPoint: "App.ts",
  rootDir: "src",
  targets: [{ id: "test" }],
};
const target = project.targets[0];

test("source declaration policies compose as one deterministic selected-profile policy", () => {
  const capability = {
    id: "test.capability",
    targetId: "test",
    sourceProfileContributions() {
      return { declarationPolicy: { bundledLibraries: ["lib.es2023.d.ts"] } };
    },
  };
  const surface = {
    id: "extra",
    sourceProfileContributions() {
      return { declarationPolicy: { bundledLibraries: ["lib.es2024.d.ts", "lib.es2023.d.ts"] } };
    },
  };
  const collected = collectTargetSourceProfileContributions({
    project,
    projectRoot: "/project",
    projectDirectory: "/project",
    target,
    targetPackId: "test.pack",
    selectedCapabilities: [capability],
    selectedSurfaces: [surface],
    targetContributions: {
      declarationPolicy: { installedDeclarations: "package-contract" },
    },
  });
  assert.deepEqual(collected.diagnostics, []);
  assert.deepEqual(collected.declarationPolicy, {
    bundledLibraries: ["lib.es2023.d.ts", "lib.es2024.d.ts"],
    installedDeclarations: "package-contract",
  });
});

test("source declaration policies reject paths and unknown modes before compiler input", () => {
  const collected = collectTargetSourceProfileContributions({
    project,
    projectRoot: "/project",
    projectDirectory: "/project",
    target,
    targetPackId: "test.pack",
    selectedCapabilities: [],
    selectedSurfaces: [],
    targetContributions: {
      declarationPolicy: {
        bundledLibraries: ["../lib.es2024.d.ts"],
        installedDeclarations: "everything-installed",
      },
    },
  });
  assert.deepEqual(collected.declarationPolicy, {});
  assert.equal(collected.diagnostics.length, 2);
  assert.ok(collected.diagnostics.every((diagnostic) => diagnostic.code === "TARGET_SOURCE_PROFILE"));
});
