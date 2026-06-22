import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

import {
  compileProject,
  createTargetCompilerExtensions,
  parseTsonicProjectConfig,
} from "../../packages/host/dist/index.js";

const repoRoot = process.cwd();
const tempRoot = resolve(repoRoot, ".temp/test-runs/host-surface-composition", `${Date.now()}-${process.pid}`);

test("checked-in TSTS config uses explicit target selection", async () => {
  const rawConfig = JSON.parse(await readFile(resolve(repoRoot, "packages/tsts/tsonic.json"), "utf8"));
  assert.equal(rawConfig.output, undefined);
  assert.equal(rawConfig.rootNamespace, undefined);

  const project = parseTsonicProjectConfig(rawConfig);

  assert.equal(project.entryPoint, "index.ts");
  assert.equal(project.rootDir, "src");
  assert.equal(project.outDir, "generated");
  assert.deepEqual(project.targets.map((target) => target.id), ["csharp"]);
  assert.deepEqual(project.targets[0].options, {
    namespace: "Tsts",
    assemblyName: "tsts",
    outputType: "Library",
    publishAot: false,
  });
});

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
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    providerArtifacts: [
      createFakeArtifact("asset", "runtime/provider.txt", "provider"),
    ],
    surfaces: [
      createFakeSurface("js", {
        events,
        artifacts: [
          createFakeArtifact("asset", "runtime/js.txt", "js"),
        ],
      }),
    ],
  });

  const result = await compileFakeProject("unknown-surface", targetPack, {
    id: "demo",
    surfaces: ["not-real"],
  });

  assert.equal(result.diagnostics.length, 1);
  assert.deepEqual(events, []);
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

test("host composes provider, selected surface, and backend artifacts for toolchain handoff", async () => {
  const events = [];
  let toolchainArtifacts = [];
  const targetPack = createFakeTargetPack(events, {
    providerArtifacts: [
      createFakeArtifact("asset", "runtime/provider.txt", "provider"),
    ],
    backendArtifacts: [
      createFakeArtifact("source", "src/App.demo", "backend"),
    ],
    onToolchain(input) {
      toolchainArtifacts = input.compileResult.artifacts.map((artifact) => artifact.path);
    },
    surfaces: [
      createFakeSurface("js", {
        events,
        artifacts: [
          createFakeArtifact("asset", "runtime/js.txt", "js"),
        ],
      }),
      createFakeSurface("nodejs", {
        events,
        requiredSurfaces: ["js"],
        artifacts: [
          createFakeArtifact("asset", "runtime/nodejs.txt", "nodejs"),
        ],
      }),
    ],
  });

  const result = await compileFakeProject("runtime-artifact-composition", targetPack, {
    id: "demo",
    surfaces: ["js"],
  });
  const artifactPaths = result.targets[0].compileResult.artifacts.map((artifact) => artifact.path);

  assert.deepEqual(artifactPaths, [
    "runtime/provider.txt",
    "runtime/js.txt",
    "src/App.demo",
  ]);
  assert.deepEqual(toolchainArtifacts, artifactPaths);
  assert.equal(events.includes("surface-runtime:nodejs"), false);
  assert.equal(events.includes("provider-runtime:demo"), true);
  assert.equal(events.includes("surface-runtime:js"), true);
  assert.equal(events.includes("backend:demo"), true);
  assert.equal(events.includes("toolchain:demo:artifacts=runtime/provider.txt,runtime/js.txt,src/App.demo"), true);
  assert.ok(events.indexOf("provider-runtime:demo") < events.indexOf("backend:demo"));
  assert.ok(events.indexOf("surface-runtime:js") < events.indexOf("backend:demo"));
  assert.ok(events.indexOf("backend:demo") < events.indexOf("toolchain:demo:artifacts=runtime/provider.txt,runtime/js.txt,src/App.demo"));
});

test("host omits surface runtime artifacts when no surface is selected", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    providerArtifacts: [
      createFakeArtifact("asset", "runtime/provider.txt", "provider"),
    ],
    surfaces: [
      createFakeSurface("js", {
        events,
        artifacts: [
          createFakeArtifact("asset", "runtime/js.txt", "js"),
        ],
      }),
    ],
  });

  const result = await compileFakeProject("runtime-artifact-unselected-surface", targetPack, {
    id: "demo",
  });

  assert.deepEqual(result.targets[0].compileResult.artifacts.map((artifact) => artifact.path), [
    "runtime/provider.txt",
  ]);
  assert.equal(events.includes("surface-runtime:js"), false);
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
      runtimeArtifacts(context) {
        events.push(`provider-runtime:${context.target.id}`);
        return options.providerArtifacts ?? [];
      },
    },
    surfaces: options.surfaces ?? [],
    createBackend() {
      return {
        compile(input) {
          events.push(`backend:${input.target.id}`);
          return {
            artifacts: options.backendArtifacts ?? [],
            diagnostics: [],
          };
        },
      };
    },
    createToolchain() {
      return {
        prepare(input) {
          options.onToolchain?.(input);
          events.push(`toolchain:${input.target.id}:artifacts=${input.compileResult.artifacts.map((artifact) => artifact.path).join(",")}`);
          return {
            diagnostics: [],
            producedArtifacts: [],
          };
        },
      };
    },
  };
}

function createFakeSurface(id, optionsOrRequiredSurfaces = {}) {
  const options = Array.isArray(optionsOrRequiredSurfaces)
    ? { requiredSurfaces: optionsOrRequiredSurfaces }
    : optionsOrRequiredSurfaces;
  return {
    id,
    displayName: `${id} Surface`,
    ...((options.requiredSurfaces ?? []).length > 0 ? { requiredSurfaces: options.requiredSurfaces } : {}),
    runtimeArtifacts() {
      options.events?.push(`surface-runtime:${id}`);
      return options.artifacts ?? [];
    },
  };
}

function createFakeArtifact(kind, path, text) {
  return {
    kind,
    path,
    text,
  };
}
