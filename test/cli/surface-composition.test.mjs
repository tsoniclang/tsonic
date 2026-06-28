import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

import {
  compileProject,
  createProgramOptionsForProject,
  createTsonicSemanticSession,
  createTargetCompilerExtensions,
  parseTsonicProjectConfig,
} from "../../packages/host/dist/index.js";
import {
  createTargetRegistry,
} from "../../packages/target-api/dist/index.js";

const repoRoot = process.cwd();
const tempRoot = resolve(repoRoot, ".temp/test-runs/host-surface-composition", `${Date.now()}-${process.pid}`);

test("vendored TSTS is a package artifact, not a checked-in source project", async () => {
  await assert.rejects(
    () => access(resolve(repoRoot, "packages/tsts/src")),
    { code: "ENOENT" },
  );
  await assert.rejects(
    () => access(resolve(repoRoot, "packages/tsts/tsonic.json")),
    { code: "ENOENT" },
  );
  await access(resolve(repoRoot, "packages/tsts/package.json"));
  await access(resolve(repoRoot, "packages/tsts/dist/src/index.js"));
  await access(resolve(repoRoot, "packages/tsts/dist/src/internal/bundled/libs/lib.es2024.full.d.ts"));
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
  assert.deepEqual(extensionIds(composition.extensions), ["tsonic.source-core", "target"]);
  assert.equal(composition.extensions[1], targetExtension);
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
  assert.deepEqual(extensionIds(composition.extensions), ["tsonic.source-core", "target"]);
  assert.equal(composition.extensions[1], targetExtension);
});

test("host composes target provider extensions before selected surface extensions", () => {
  const events = [];
  const targetExtension = { name: "target" };
  const jsExtension = { name: "surface-js" };
  const nodejsExtension = { name: "surface-nodejs" };
  const targetPack = createFakeTargetPack(events, {
    targetExtension,
    surfaces: [
      createFakeSurface("js", { events, extension: jsExtension }),
      createFakeSurface("nodejs", { events, requiredSurfaces: ["js"], extension: nodejsExtension }),
      createFakeSurface("webworker", { events, extension: { name: "unselected" } }),
    ],
  });
  const project = parseTsonicProjectConfig({
    entryPoint: "index.ts",
    targets: [{ id: "demo", surfaces: ["js", "nodejs"] }],
  });
  const target = project.targets[0];

  const composition = createTargetCompilerExtensions({ project, target, targetPack });

  assert.deepEqual(events, [
    "provider:demo:surfaces=js,nodejs",
    "surface-extension:js:target=demo:surfaces=js,nodejs",
    "surface-extension:nodejs:target=demo:surfaces=js,nodejs",
  ]);
  assert.deepEqual(composition.selectedSurfaces.map((surface) => surface.id), ["js", "nodejs"]);
  assert.deepEqual(extensionIds(composition.extensions), ["tsonic.source-core", "target", "surface-js", "surface-nodejs"]);
  assert.equal(composition.extensions[1], targetExtension);
  assert.equal(composition.extensions[2], jsExtension);
  assert.equal(composition.extensions[3], nodejsExtension);
});

test("host rejects stale or unowned supplied surface composition", () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    targetExtension: { name: "target" },
    surfaces: [
      createFakeSurface("js"),
    ],
  });
  const project = parseTsonicProjectConfig({
    entryPoint: "index.ts",
    targets: [{ id: "demo", surfaces: ["js"] }],
  });
  const target = project.targets[0];
  const copiedSurface = createFakeSurface("js");

  assert.throws(
    () => createTargetCompilerExtensions({ project, target, targetPack, selectedSurfaces: [copiedSurface] }),
    /selected surface composition is stale or unowned/,
  );
  assert.deepEqual(events, []);
});

test("host reports unknown selected target as target diagnostic", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events);

  const result = await compileFakeProject("unknown-target", targetPack, {
    id: "not-real",
  });

  assert.equal(result.diagnostics.length, 1);
  assert.deepEqual(events, []);
  assert.equal(result.diagnostics[0].code, "TARGET_SELECTION");
  assert.equal(result.diagnostics[0].category, "error");
  assert.equal(result.diagnostics[0].message, "Unknown target 'not-real'.");
  assert.equal(result.targets[0].compileResult.artifacts.length, 0);
});

test("host resolves target and surface selection before creating semantic input", () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    surfaces: [
      createFakeSurface("js"),
    ],
  });
  const projectDirectory = resolve(tempRoot, "selection-before-source-graph");
  const project = parseTsonicProjectConfig({
    entryPoint: "missing-entry.ts",
    rootDir: "src",
    outDir: "out",
    targets: [
      { id: "not-real" },
      { id: "demo", surfaces: ["not-real"] },
    ],
  });

  const result = compileProject({
    project,
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    registry: createRegistry(targetPack),
  });

  assert.deepEqual(events, []);
  assert.deepEqual(result.diagnostics.map((diagnostic) => diagnostic.code), [
    "TARGET_SELECTION",
    "TARGET_SURFACE_SELECTION",
  ]);
  assert.match(result.diagnostics[0].message, /Unknown target 'not-real'/);
  assert.match(result.diagnostics[1].message, /target 'demo' does not implement requested surface 'not-real'/);
  assert.deepEqual(result.targets.map((target) => target.compileResult.artifacts.length), [0, 0]);
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

test("host reports duplicate target surface implementations before provider composition", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    surfaces: [
      createFakeSurface("js"),
      createFakeSurface("js"),
    ],
  });

  const result = await compileFakeProject("duplicate-target-surfaces", targetPack, {
    id: "demo",
    surfaces: ["js"],
  });

  assert.equal(result.diagnostics.length, 1);
  assert.deepEqual(events, []);
  assert.equal(result.diagnostics[0].code, "TARGET_SURFACE_SELECTION");
  assert.equal(result.diagnostics[0].category, "error");
  assert.equal(result.diagnostics[0].message, "target 'demo' declares surface 'js' more than once");
  assert.equal(result.targets[0].compileResult.artifacts.length, 0);
});

test("host reports missing target provider as target diagnostic", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    includeProvider: false,
    backendArtifacts: [
      createFakeArtifact("source", "src/App.demo", "backend"),
    ],
  });

  const result = await compileFakeProject("missing-provider", targetPack, {
    id: "demo",
  });

  assert.equal(result.diagnostics.length, 1);
  assert.deepEqual(events, []);
  assert.equal(result.diagnostics[0].code, "TARGET_PROVIDER");
  assert.equal(result.diagnostics[0].category, "error");
  assert.equal(
    result.diagnostics[0].message,
    "target 'demo' does not declare a provider; Tsonic requires provider-composed TSTS facts before backend emission",
  );
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

test("host rejects unsafe configured target and surface identifiers", () => {
  assert.throws(
    () => parseTsonicProjectConfig({
      entryPoint: "index.ts",
      targets: [{ id: "../csharp" }],
    }),
    /Target at index 0 id '\.\.\/csharp' must match/,
  );
  assert.throws(
    () => parseTsonicProjectConfig({
      entryPoint: "index.ts",
      targets: [{ id: "csharp", surfaces: ["../nodejs"] }],
    }),
    /Target 'csharp' surface '\.\.\/nodejs' must match/,
  );
});

test("target registry rejects unsafe pack and required surface identifiers", () => {
  assert.throws(
    () => createTargetRegistry([
      createFakeTargetPack([], { id: "../csharp" }),
    ]),
    /Target pack id '\.\.\/csharp' must match/,
  );
  assert.throws(
    () => createTargetRegistry([
      createFakeTargetPack([], {
        surfaces: [
          createFakeSurface("nodejs", ["../js"]),
        ],
      }),
    ]),
    /required surface id '\.\.\/js' must match/,
  );
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
  assert.deepEqual(extensionIds(composition.extensions), ["tsonic.source-core", "target"]);
  assert.equal(composition.extensions[1], targetExtension);
});

test("host composes provider, selected surface, and backend artifacts for toolchain handoff", async () => {
  const events = [];
  let toolchainArtifacts = [];
  let toolchainArtifactsRoot = "";
  let toolchainTargetId = "";
  let toolchainProjectTargetIds = [];
  const targetPack = createFakeTargetPack(events, {
    providerArtifacts: [
      createFakeArtifact("asset", "runtime/provider.txt", "provider"),
    ],
    backendArtifacts: [
      createFakeArtifact("source", "src/App.demo", "backend"),
    ],
    onToolchain(input) {
      toolchainArtifacts = input.compileResult.artifacts.map((artifact) => artifact.path);
      toolchainArtifactsRoot = input.artifactsRoot;
      toolchainTargetId = input.target.id;
      toolchainProjectTargetIds = input.project.targets.map((target) => target.id);
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

  const projectName = "runtime-artifact-composition";
  const projectDirectory = resolve(tempRoot, projectName);
  const result = await compileFakeProject(projectName, targetPack, {
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
  assert.equal(toolchainArtifactsRoot, resolve(projectDirectory, "out/demo"));
  assert.equal(toolchainTargetId, "demo");
  assert.deepEqual(toolchainProjectTargetIds, ["demo"]);
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

test("host reports duplicate runtime artifacts as target diagnostics before backend emission", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    providerArtifacts: [
      createFakeArtifact("asset", "runtime/shared.txt", "provider"),
    ],
    backendArtifacts: [
      createFakeArtifact("source", "src/App.demo", "backend"),
    ],
    surfaces: [
      createFakeSurface("js", {
        events,
        artifacts: [
          createFakeArtifact("asset", "runtime/shared.txt", "js"),
        ],
      }),
    ],
  });

  const result = await compileFakeProject("duplicate-runtime-artifacts", targetPack, {
    id: "demo",
    surfaces: ["js"],
  });

  assert.deepEqual(events, [
    "provider:demo:surfaces=js",
    "provider-runtime:demo",
    "surface-runtime:js",
  ]);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, "TARGET_RUNTIME");
  assert.equal(result.diagnostics[0].category, "error");
  assert.equal(result.diagnostics[0].message, "duplicate target runtime artifact 'runtime/shared.txt'");
  assert.equal(result.targets[0].compileResult.artifacts.length, 0);
  assert.equal(events.includes("backend:demo"), false);
  assert.equal(events.some((event) => event.startsWith("toolchain:")), false);
});

test("host reports duplicate runtime references as target diagnostics before backend emission", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    providerReferences: [
      createFakeReference("project", "../runtime/Runtime.csproj"),
    ],
    backendArtifacts: [
      createFakeArtifact("source", "src/App.demo", "backend"),
    ],
    surfaces: [
      createFakeSurface("js", {
        events,
        references: [
          createFakeReference("project", "../runtime/Runtime.csproj"),
        ],
      }),
    ],
  });

  const result = await compileFakeProject("duplicate-runtime-references", targetPack, {
    id: "demo",
    surfaces: ["js"],
  });

  assert.deepEqual(events, [
    "provider:demo:surfaces=js",
    "provider-runtime:demo",
    "surface-runtime:js",
  ]);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, "TARGET_RUNTIME");
  assert.equal(result.diagnostics[0].category, "error");
  assert.equal(result.diagnostics[0].message, "duplicate target runtime reference 'project:../runtime/Runtime.csproj'");
  assert.equal(result.targets[0].compileResult.artifacts.length, 0);
  assert.equal(events.includes("backend:demo"), false);
  assert.equal(events.some((event) => event.startsWith("toolchain:")), false);
});

test("host suppresses backend artifacts and toolchain when backend reports errors", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    providerArtifacts: [
      createFakeArtifact("asset", "runtime/provider.txt", "provider"),
    ],
    backendArtifacts: [
      createFakeArtifact("source", "src/App.demo", "backend"),
    ],
    backendDiagnostics: [
      {
        code: "MISSING_FACT",
        category: "error",
        message: "backend requires finalized target facts before emission",
        source: "demo-backend",
      },
    ],
  });

  const result = await compileFakeProject("backend-error-no-artifacts", targetPack, {
    id: "demo",
  });

  assert.deepEqual(events, [
    "provider:demo:surfaces=",
    "provider-runtime:demo",
    "backend:demo",
  ]);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, "MISSING_FACT");
  assert.equal(result.diagnostics[0].category, "error");
  assert.equal(result.targets[0].compileResult.artifacts.length, 0);
  assert.equal(result.targets[0].compileResult.diagnostics.length, 1);
  assert.equal(events.some((event) => event.startsWith("toolchain:")), false);
});

test("host excludes generated declarations and metadata JSON from semantic input", async () => {
  const projectDirectory = resolve(tempRoot, "semantic-input-filter");
  const projectConfig = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": "export const value = 1;\n",
    "src/generated.d.ts": "declare global { const generatedAmbientLeak: string; }\n",
    "src/provider.metadata.json": JSON.stringify({ target: "demo" }),
  });

  const created = createProgramOptionsForProject({
    project: parseTsonicProjectConfig(projectConfig),
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
  });
  const fs = created.programOptions.Host.FS();

  assert.equal(fs.FileExists(resolve(projectDirectory, "src/index.ts")), true);
  assert.equal(fs.FileExists(resolve(projectDirectory, "src/generated.d.ts")), false);
  assert.equal(fs.FileExists(resolve(projectDirectory, "src/provider.metadata.json")), false);
});

test("host excludes the configured output root from semantic input", async () => {
  const projectDirectory = resolve(tempRoot, "configured-output-root-filter");
  const projectConfig = {
    entryPoint: "src/index.ts",
    rootDir: ".",
    outDir: "generated",
    targets: [{ id: "demo" }],
  };
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": "export const value = 1;\n",
    "generated/stale.ts": "export const stale = ;\n",
    "generated/nested/stale.ts": "export const staleNested = ;\n",
  });

  const created = createProgramOptionsForProject({
    project: parseTsonicProjectConfig(projectConfig),
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
  });
  const fs = created.programOptions.Host.FS();

  assert.equal(fs.FileExists(resolve(projectDirectory, "src/index.ts")), true);
  assert.equal(fs.FileExists(resolve(projectDirectory, "generated/stale.ts")), false);
  assert.equal(fs.FileExists(resolve(projectDirectory, "generated/nested/stale.ts")), false);
});

test("host gives backends the TSTS source graph instead of the raw project file crawl", async () => {
  const events = [];
  let backendProjectSourceFiles = [];
  const projectDirectory = resolve(tempRoot, "tsts-source-graph");
  const projectConfig = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  const targetPack = createFakeTargetPack(events, {
    onBackend(input) {
      backendProjectSourceFiles = input.sourceFiles
        .map((sourceFile) => input.ast.getFileName(sourceFile))
        .filter((fileName) => fileName.startsWith(projectDirectory))
        .map((fileName) => fileName.slice(projectDirectory.length + 1).split("\\").join("/"))
        .sort();
    },
  });
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": "import { value } from \"./dep.js\";\nexport const result = value + 1;\n",
    "src/dep.ts": "export const value = 41;\n",
    "src/orphan.ts": "export const orphan = 0;\n",
    "src/generated.d.ts": "declare global { const generatedAmbientLeak: string; }\n",
    "src/provider.metadata.json": JSON.stringify({ target: "demo" }),
  });

  const result = compileProject({
    project: parseTsonicProjectConfig(projectConfig),
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    registry: createRegistry(targetPack),
  });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(backendProjectSourceFiles, [
    "src/dep.ts",
    "src/index.ts",
  ]);
});

test("host source graph follows relative ESM import and export edges through TSTS", async () => {
  const events = [];
  let backendProjectSourceFiles = [];
  const projectDirectory = resolve(tempRoot, "tsts-relative-esm-graph");
  const projectConfig = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  const targetPack = createFakeTargetPack(events, {
    onBackend(input) {
      backendProjectSourceFiles = input.sourceFiles
        .map((sourceFile) => input.ast.getFileName(sourceFile))
        .filter((fileName) => fileName.startsWith(projectDirectory))
        .map((fileName) => fileName.slice(projectDirectory.length + 1).split("\\").join("/"))
        .sort();
    },
  });
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": [
      "import defaultValue from \"./defaulted.js\";",
      "import { named } from \"./named.js\";",
      "import * as namespace from \"./namespace.js\";",
      "import type { Shape } from \"./types.js\";",
      "import \"./side-effect.js\";",
      "export { named as renamed } from \"./named.js\";",
      "export { default as renamedDefault } from \"./defaulted.js\";",
      "export * from \"./star.js\";",
      "export * as starNamespace from \"./star.js\";",
      "export const result: Shape = { value: defaultValue + named + namespace.value };",
      "",
    ].join("\n"),
    "src/defaulted.ts": "const value = 1;\nexport default value;\n",
    "src/named.ts": "export const named = 2;\n",
    "src/namespace.ts": "export const value = 3;\n",
    "src/side-effect.ts": "export const initialized = true;\n",
    "src/star.ts": "export const star = 4;\n",
    "src/types.ts": "export interface Shape { value: number; }\n",
    "src/orphan.ts": "export const orphan = 0;\n",
    "src/generated.d.ts": "export declare const generatedAmbientLeak: string;\n",
    "src/provider.metadata.json": JSON.stringify({ target: "demo" }),
  });

  const result = compileProject({
    project: parseTsonicProjectConfig(projectConfig),
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    registry: createRegistry(targetPack),
  });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(backendProjectSourceFiles, [
    "src/defaulted.ts",
    "src/index.ts",
    "src/named.ts",
    "src/namespace.ts",
    "src/side-effect.ts",
    "src/star.ts",
    "src/types.ts",
  ]);
});

test("host source graph follows package exports and subpaths through TSTS", async () => {
  const events = [];
  let backendProjectSourceFiles = [];
  const projectDirectory = resolve(tempRoot, "tsts-package-exports-graph");
  const projectConfig = {
    entryPoint: "src/index.ts",
    rootDir: ".",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  const targetPack = createFakeTargetPack(events, {
    onBackend(input) {
      backendProjectSourceFiles = input.sourceFiles
        .map((sourceFile) => input.ast.getFileName(sourceFile))
        .filter((fileName) => fileName.startsWith(projectDirectory))
        .map((fileName) => fileName.slice(projectDirectory.length + 1).split("\\").join("/"))
        .sort();
    },
  });
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": [
      "import { subpathValue } from \"@demo/source-pkg/subpath.js\";",
      "export const result = subpathValue;",
      "",
    ].join("\n"),
    "node_modules/@demo/source-pkg/package.json": JSON.stringify({
      name: "@demo/source-pkg",
      type: "module",
      exports: {
        "./subpath.js": {
          types: "./src/subpath.ts",
          default: "./src/subpath.ts",
        },
      },
    }, null, 2),
    "node_modules/@demo/source-pkg/src/subpath.ts": [
      "import { internalValue } from \"./internal.js\";",
      "export const subpathValue = internalValue + 1;",
      "",
    ].join("\n"),
    "node_modules/@demo/source-pkg/src/internal.ts": "export const internalValue = 41;\n",
    "node_modules/@demo/source-pkg/src/generated.d.ts": "export declare const generatedAmbientLeak: string;\n",
    "node_modules/@demo/source-pkg/src/provider.metadata.json": JSON.stringify({ target: "demo" }),
    "node_modules/@demo/source-pkg/src/orphan.ts": "export const orphan = 0;\n",
  });

  const project = parseTsonicProjectConfig(projectConfig);
  const programOptions = createProgramOptionsForProject({
    project,
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
  }).programOptions;
  const session = createTsonicSemanticSession({
    programOptions,
    project,
    target: project.targets[0],
    targetPack,
    selectedSurfaces: [],
  });
  const allTstsProjectFiles = session.compiler.getSourceFiles()
    .map((sourceFile) => sourceFile === undefined ? undefined : session.ast.getFileName(sourceFile))
    .filter((fileName) => fileName?.startsWith(projectDirectory))
    .map((fileName) => fileName.slice(projectDirectory.length + 1).split("\\").join("/"))
    .sort();
  const emitTstsProjectFiles = session.compiler.getSourceFilesToEmit()
    .map((sourceFile) => sourceFile === undefined ? undefined : session.ast.getFileName(sourceFile))
    .filter((fileName) => fileName?.startsWith(projectDirectory))
    .map((fileName) => fileName.slice(projectDirectory.length + 1).split("\\").join("/"))
    .sort();

  assert.deepEqual(allTstsProjectFiles, [
    "node_modules/@demo/source-pkg/src/internal.ts",
    "node_modules/@demo/source-pkg/src/subpath.ts",
    "src/index.ts",
  ]);
  assert.deepEqual(emitTstsProjectFiles, [
    "src/index.ts",
  ]);

  const result = compileProject({
    project,
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    registry: createRegistry(targetPack),
  });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(backendProjectSourceFiles, [
    "node_modules/@demo/source-pkg/src/internal.ts",
    "node_modules/@demo/source-pkg/src/subpath.ts",
    "src/index.ts",
  ]);
});

test("host rejects declaration entrypoints before semantic input creation", () => {
  assert.throws(
    () => parseTsonicProjectConfig({
      entryPoint: "generated.d.ts",
      targets: [{ id: "demo" }],
    }),
    /entryPoint must use a final ESM TypeScript source extension: \.ts or \.mts/,
  );
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
    get(id) {
      return id === targetPack.id ? targetPack : undefined;
    },
  };
}

function extensionIds(extensions) {
  return extensions.map((extension) => extension.identity?.id ?? extension.name);
}

function createFakeTargetPack(events, options = {}) {
  return {
    id: options.id ?? "demo",
    displayName: "Demo Target",
    ...(options.includeProvider === false
      ? {}
      : {
          provider: {
            id: "demo-provider",
            displayName: "Demo Provider",
            createExtensions(context) {
              events.push(`provider:${context.target.id}:surfaces=${context.selectedSurfaces.map((surface) => surface.id).join(",")}`);
              return options.targetExtension === undefined ? [] : [options.targetExtension];
            },
            runtimeContributions(context) {
              events.push(`provider-runtime:${context.target.id}`);
              return {
                artifacts: options.providerArtifacts ?? [],
                references: options.providerReferences ?? [],
              };
            },
          },
        }),
    surfaces: options.surfaces ?? [],
    createBackend() {
      return {
        compile(input) {
          options.onBackend?.(input);
          events.push(`backend:${input.target.id}`);
          return {
            artifacts: options.backendArtifacts ?? [],
            diagnostics: options.backendDiagnostics ?? [],
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
    ...(options.extension === undefined
      ? {}
      : {
          createExtensions(context) {
            options.events?.push(`surface-extension:${id}:target=${context.target.id}:surfaces=${context.selectedSurfaces.map((surface) => surface.id).join(",")}`);
            assert.equal(context.surface.id, id);
            return [options.extension];
          },
        }),
    runtimeContributions() {
      options.events?.push(`surface-runtime:${id}`);
      return {
        artifacts: options.artifacts ?? [],
        references: options.references ?? [],
      };
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

function createFakeReference(kind, include) {
  return {
    kind,
    include,
  };
}
