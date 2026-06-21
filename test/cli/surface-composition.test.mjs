import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

import {
  compileProject,
  createTargetCompilerExtensions,
  parseTsonicProjectConfig,
} from "../../packages/host/dist/index.js";

const repoRoot = process.cwd();
const tempRoot = resolve(repoRoot, ".temp/test-runs/host-surface-composition", `${Date.now()}-${process.pid}`);

test("host passes no selected surfaces to target provider when target requests none", () => {
  const events = [];
  const targetExtension = { name: "target" };
  const targetPack = createFakeTargetPack(events, {
    targetExtension,
    surfaces: [
      createFakeSurface("js"),
    ],
  });
  const project = parseTsonicProjectConfig({
    entryPoint: "index.ts",
    targets: [{ id: "demo" }],
  });
  const target = project.targets[0];

  const composition = createTargetCompilerExtensions({ project, target, targetPack });

  assert.deepEqual(events, ["provider:demo:surfaces="]);
  assert.deepEqual(composition.selectedSurfaces.map((surface) => surface.id), []);
  assert.deepEqual(composition.extensions, [targetExtension]);
});

test("host passes selected surfaces to the single target provider", () => {
  const events = [];
  const targetExtension = { name: "target" };
  const targetPack = createFakeTargetPack(events, {
    targetExtension,
    surfaces: [
      createFakeSurface("js"),
    ],
  });
  const project = parseTsonicProjectConfig({
    entryPoint: "index.ts",
    targets: [{ id: "demo", surfaces: ["js"] }],
  });
  const target = project.targets[0];

  const composition = createTargetCompilerExtensions({ project, target, targetPack });

  assert.deepEqual(target.surfaces, ["js"]);
  assert.deepEqual(events, ["provider:demo:surfaces=js"]);
  assert.deepEqual(composition.selectedSurfaces.map((surface) => surface.id), ["js"]);
  assert.deepEqual(composition.extensions, [targetExtension]);
});

test("host reports unknown requested surface as target diagnostic", async () => {
  const targetPack = createFakeTargetPack([], {
    surfaces: [
      createFakeSurface("js"),
    ],
  });

  const result = await compileFakeProject("unknown-surface", targetPack, {
    id: "demo",
    surfaces: ["not-real"],
  });

  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, "TARGET_SURFACE_SELECTION");
  assert.equal(result.diagnostics[0].category, "error");
  assert.equal(result.diagnostics[0].message, "target 'demo' does not implement requested surface 'not-real'");
  assert.equal(result.targets[0].compileResult.artifacts.length, 0);
});

test("host reports missing selected surface dependency as target diagnostic", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    surfaces: [
      createFakeSurface("js"),
      createFakeSurface("nodejs", ["js"]),
    ],
  });

  const result = await compileFakeProject("missing-surface-dependency", targetPack, {
    id: "demo",
    surfaces: ["nodejs"],
  });

  assert.deepEqual(events, []);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, "TARGET_SURFACE_SELECTION");
  assert.equal(result.diagnostics[0].category, "error");
  assert.equal(result.diagnostics[0].message, "target 'demo' surface 'nodejs' requires surface 'js'");
  assert.equal(result.targets[0].compileResult.artifacts.length, 0);
});

test("host does not pass unselected surfaces to the target provider", () => {
  const events = [];
  const targetExtension = { name: "target" };
  const targetPack = createFakeTargetPack(events, {
    targetExtension,
    surfaces: [
      createFakeSurface("js"),
      createFakeSurface("nodejs", ["js"]),
    ],
  });
  const project = parseTsonicProjectConfig({
    entryPoint: "index.ts",
    targets: [{ id: "demo", surfaces: ["js"] }],
  });
  const target = project.targets[0];

  const composition = createTargetCompilerExtensions({ project, target, targetPack });

  assert.deepEqual(events, ["provider:demo:surfaces=js"]);
  assert.deepEqual(composition.selectedSurfaces.map((surface) => surface.id), ["js"]);
  assert.deepEqual(composition.extensions, [targetExtension]);
});

async function compileFakeProject(name, targetPack, targetSelection) {
  const projectDirectory = resolve(tempRoot, name);
  const projectConfig = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [targetSelection],
  };
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": "export const value = 1;\n",
  });
  return compileProject({
    project: parseTsonicProjectConfig(projectConfig),
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    registry: createRegistry(targetPack),
  });
}

async function writeProject(projectDirectory, files) {
  for (const [relativePath, text] of Object.entries(files)) {
    const outputPath = resolve(projectDirectory, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, text, "utf8");
  }
}

function createRegistry(targetPack) {
  return {
    packs: [targetPack],
    require(id) {
      if (id !== targetPack.id) {
        throw new Error(`Unknown target '${id}'.`);
      }
      return targetPack;
    },
  };
}

function createFakeTargetPack(events, options = {}) {
  return {
    id: "demo",
    displayName: "Demo Target",
    provider: {
      id: "demo-provider",
      displayName: "Demo Provider",
      createExtensions(context) {
        events.push(`provider:${context.target.id}:surfaces=${context.selectedSurfaces.map((surface) => surface.id).join(",")}`);
        return options.targetExtension === undefined ? [] : [options.targetExtension];
      },
    },
    surfaces: options.surfaces ?? [],
    createBackend() {
      return {
        compile() {
          return {
            artifacts: [],
            diagnostics: [],
          };
        },
      };
    },
    createToolchain() {
      return {
        prepare() {
          return {
            diagnostics: [],
            producedArtifacts: [],
          };
        },
      };
    },
  };
}

function createFakeSurface(id, requiredSurfaces = []) {
  return {
    id,
    displayName: `${id} Surface`,
    ...(requiredSurfaces.length > 0 ? { requiredSurfaces } : {}),
    runtimeArtifacts() {
      return [];
    },
  };
}
