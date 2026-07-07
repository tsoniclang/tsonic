import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

import {
  collectTstsDiagnostics,
  collectTargetSourceProfileContributions,
  compileTargetFromSemanticSession,
  compileProject,
  createProgramOptionsForProject,
  createTsonicSemanticSession,
  createTargetCompilerExtensions,
  parseTsonicProjectConfig,
} from "../../packages/host/dist/index.js";
import {
  createTargetRegistry,
  targetSourceProfileDeclaration,
} from "../../packages/target-api/dist/index.js";
import {
  ExtensionLifecycleEvent,
  providerVirtualDeclarationFactKey,
  runtimeCarrierFactKey,
  targetOperationFactKey,
  TstsProviderContractVersion,
} from "@tsonic/tsts";

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
  await access(resolve(repoRoot, "packages/tsts/dist/src/internal/bundled/libs_generated.d.ts"));
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

test("host composes installed target capabilities between target provider and surfaces", () => {
  const events = [];
  const targetExtension = { name: "target" };
  const acmeExtension = { name: "capability-acme" };
  const helpersExtension = { name: "capability-helpers" };
  const jsExtension = { name: "surface-js" };
  const acme = createFakeTargetCapability("acme", { events, extension: acmeExtension });
  const helpers = createFakeTargetCapability("helpers", { events, extension: helpersExtension });
  const targetPack = createFakeTargetPack(events, {
    targetExtension,
    surfaces: [
      createFakeSurface("js", { events, extension: jsExtension }),
    ],
  });
  const project = parseTsonicProjectConfig({
    entryPoint: "index.ts",
    targets: [{ id: "demo", surfaces: ["js"] }],
  });
  const target = project.targets[0];

  const composition = createTargetCompilerExtensions({
    project,
    target,
    targetPack,
    selectedCapabilities: [acme, helpers],
  });

  assert.deepEqual(composition.selectedCapabilities.map((capability) => capability.id), ["acme", "helpers"]);
  assert.deepEqual(composition.selectedSurfaces.map((surface) => surface.id), ["js"]);
  assert.deepEqual(events, [
    "provider:demo:surfaces=js",
    "capability-extension:acme:target=demo:capabilities=acme,helpers",
    "capability-extension:helpers:target=demo:capabilities=acme,helpers",
    "surface-extension:js:target=demo:surfaces=js",
  ]);
  assert.deepEqual(extensionIds(composition.extensions), ["tsonic.source-core", "target", "capability-acme", "capability-helpers", "surface-js"]);
});

test("host composes installed target capabilities as provider-owned virtual modules", async () => {
  const events = [];
  const acme = createFakeVirtualTargetCapability("acme", {
    events,
    moduleOwnership: [
      { specifierPrefix: "@acme/native/" },
      { specifierPrefix: "@acme/alias/" },
    ],
  });
  const targetPack = createFakeTargetPack(events, {
  });
  const projectDirectory = resolve(tempRoot, "selected-target-capability-virtual-modules");
  const projectConfig = {
    entryPoint: "src/index.ts",
    rootDir: ".",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": [
      "import defaultValue from \"@acme/native/default.js\";",
      "import { named as renamed } from \"@acme/native/named.js\";",
      "import * as native from \"@acme/native/namespace.js\";",
      "import { named as aliasNamed } from \"@acme/alias/aliased.js\";",
      "export const result = `${defaultValue}:${renamed}:${native.named}:${aliasNamed}`;",
      "",
    ].join("\n"),
  });

  const session = createSemanticSession(projectDirectory, projectConfig, targetPack, [acme]);
  const diagnostics = collectTstsDiagnostics(session, projectDirectory);
  const virtualFacts = session.compiler.getSourceFiles()
    .filter((sourceFile) => sourceFile !== undefined && session.ast.getFileName(sourceFile).startsWith("tsts-provider://"))
    .map((sourceFile) => session.facts.getFact(sourceFile, providerVirtualDeclarationFactKey))
    .filter((fact) => fact !== undefined)
    .map((fact) => ({
      providerId: fact.providerId,
      moduleSpecifier: fact.moduleSpecifier,
      providerModuleId: fact.providerModuleId,
    }))
    .sort((left, right) => left.moduleSpecifier.localeCompare(right.moduleSpecifier));

  assert.deepEqual(diagnostics, []);
  assert.deepEqual(virtualFacts, [
    {
      providerId: "acme-provider",
      moduleSpecifier: "@acme/alias/aliased.js",
      providerModuleId: "@acme/alias/aliased.js",
    },
    {
      providerId: "acme-provider",
      moduleSpecifier: "@acme/native/default.js",
      providerModuleId: "@acme/native/default.js",
    },
    {
      providerId: "acme-provider",
      moduleSpecifier: "@acme/native/named.js",
      providerModuleId: "@acme/native/named.js",
    },
    {
      providerId: "acme-provider",
      moduleSpecifier: "@acme/native/namespace.js",
      providerModuleId: "@acme/native/namespace.js",
    },
  ]);
  assert.deepEqual(events.filter((event) => event.startsWith("provider-resolve:")), [
    "provider-resolve:acme:@acme/native/default.js:default:default",
    "provider-resolve:acme:@acme/native/named.js:named:named as renamed",
    "provider-resolve:acme:@acme/native/namespace.js:namespace:*",
    "provider-resolve:acme:@acme/alias/aliased.js:named:named as aliasNamed",
  ]);
});

test("non-C# target backend consumes portable operation and carrier facts without target helper facts", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    targetExtension: createPortableOperationFactsExtension(),
    onBackend(input) {
      const sourceFile = input.sourceFiles.find((candidate) => input.ast.getFileName(candidate).endsWith("src/index.ts"));
      assert.notEqual(sourceFile, undefined);
      const expression = findBinaryExpression(input.ast, sourceFile);
      const operation = input.facts.mustFact(expression, targetOperationFactKey, "neutral backend expression emission");
      const carrier = input.targetFacts.resolveRuntimeCarrier(expression);
      assert.deepEqual(operation, {
        operationId: "acme.neutral.operator.add",
        operationKind: "operator",
        targetOperation: "add",
        resultType: { kind: "source-primitive", name: "float64" },
      });
      assert.deepEqual(carrier, {
        kind: "resolved",
        carrier: { kind: "source-primitive", name: "float64" },
        evidence: [
          {
            message: "Runtime carrier resolved from an explicit provider/source-core fact.",
            subject: expression,
          },
        ],
      });
      events.push("backend-consumed-portable-operation-facts");
    },
  });
  const projectDirectory = resolve(tempRoot, "portable-operation-contract-positive");
  const projectConfig = {
    entryPoint: "src/index.ts",
    rootDir: ".",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": [
      "export const result = 1 + 2;",
      "",
    ].join("\n"),
  });

  const session = createSemanticSession(projectDirectory, projectConfig, targetPack);
  const project = parseTsonicProjectConfig(projectConfig);
  const result = compileTargetFromSemanticSession(session, project, project.targets[0], targetPack, fakePaths(projectDirectory));

  assert.deepEqual(collectTstsDiagnostics(session, projectDirectory), []);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(events.includes("backend-consumed-portable-operation-facts"), true);
});

test("non-C# target backend fails closed when portable operation facts are missing", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    onBackend(input) {
      const sourceFile = input.sourceFiles.find((candidate) => input.ast.getFileName(candidate).endsWith("src/index.ts"));
      assert.notEqual(sourceFile, undefined);
      const expression = findBinaryExpression(input.ast, sourceFile);
      const operation = input.facts.requireFact(expression, targetOperationFactKey, "neutral backend expression emission");
      const carrier = input.targetFacts.resolveRuntimeCarrier(expression);
      assert.equal(operation, undefined);
      assert.equal(carrier.kind, "missing");
      return {
        artifacts: [],
        diagnostics: [
          {
            code: "DEMO_MISSING_PORTABLE_OPERATION_FACT",
            message: `neutral backend expression emission requires portable targetOperation facts; ${carrier.reason}`,
          },
        ],
      };
    },
  });
  const projectDirectory = resolve(tempRoot, "portable-operation-contract-negative");
  const projectConfig = {
    entryPoint: "src/index.ts",
    rootDir: ".",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": [
      "export const result = 1 + 2;",
      "",
    ].join("\n"),
  });

  const session = createSemanticSession(projectDirectory, projectConfig, targetPack);
  const project = parseTsonicProjectConfig(projectConfig);
  const result = compileTargetFromSemanticSession(session, project, project.targets[0], targetPack, fakePaths(projectDirectory));

  assert.match(
    collectTstsDiagnostics(session, projectDirectory).map((diagnostic) => diagnostic.message).join("\n"),
    /requires extension fact 'tsts\.target-bindings:targetOperation'/,
  );
  assert.equal(result.artifacts.length, 0);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, "DEMO_MISSING_PORTABLE_OPERATION_FACT");
  assert.match(result.diagnostics[0].message, /neutral backend expression emission/);
  assert.match(result.diagnostics[0].message, /Runtime carrier fact is missing/);
});

function createPortableOperationFactsExtension() {
  return {
    name: "portable-operation-facts-test-extension",
    identity: {
      id: "portable-operation-facts-test-extension",
      version: "1.0.0",
      capabilityNamespace: "test.portable-operation-facts",
    },
    initialize(context) {
      context.registerLifecycleHook(ExtensionLifecycleEvent.afterSourceFileBound, (request, lifecycleContext) => {
        const compiler = lifecycleContext.compiler;
        const sourceFile = request.sourceFile;
        if (sourceFile === undefined || sourceFile.IsDeclarationFile || !compiler.ast.getFileName(sourceFile).endsWith("src/index.ts")) {
          return;
        }
        const expression = findBinaryExpression(compiler.ast, sourceFile);
        const carrier = { kind: "source-primitive", name: "float64" };
        if (lifecycleContext.host.facts.get(expression, targetOperationFactKey) === undefined) {
          lifecycleContext.host.facts.set(expression, targetOperationFactKey, {
            operationId: "acme.neutral.operator.add",
            operationKind: "operator",
            targetOperation: "add",
            resultType: carrier,
          }, [{ message: "Neutral test target operation fact from TSTS-accepted binary expression." }]);
        }
        if (lifecycleContext.host.facts.get(expression, runtimeCarrierFactKey) === undefined) {
          lifecycleContext.host.facts.set(expression, runtimeCarrierFactKey, {
            carrier,
          }, [{ message: "Neutral test runtime carrier fact from TSTS-accepted binary expression." }]);
        }
      });
    },
  };
}

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
  assert.throws(
    () => parseTsonicProjectConfig({
      entryPoint: "index.ts",
      targets: [{ id: "csharp", packages: ["../native"] }],
    }),
    /Target at index 0 has unsupported field 'packages'\. Install a Tsonic target capability package instead\./,
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
  assert.throws(
    () => createTargetRegistry([
      createFakeTargetPack([], {
        providerModuleOwnership: [
          { specifierPrefix: "../native/" },
        ],
      }),
    ]),
    /provider module ownership prefix '\.\.\/native\/' must be a non-empty bare\/package\/URL-style ESM specifier prefix/,
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

test("host composes selected target capability runtime artifacts before surfaces and backend", async () => {
  const events = [];
  const acme = createFakeVirtualTargetCapability("acme", {
    events,
    artifacts: [
      createFakeArtifact("asset", "runtime/acme.txt", "acme"),
    ],
    references: [
      createFakeReference("project", "../acme/Acme.csproj"),
    ],
  });
  const unused = createFakeVirtualTargetCapability("unused", {
    events,
    moduleOwnership: [{ specifierPrefix: "@unused/native/" }],
    artifacts: [
      createFakeArtifact("asset", "runtime/unused.txt", "unused"),
    ],
  });
  const targetPack = createFakeTargetPack(events, {
    providerArtifacts: [
      createFakeArtifact("asset", "runtime/provider.txt", "provider"),
    ],
    backendArtifacts: [
      createFakeArtifact("source", "src/App.demo", "backend"),
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

  const result = await compileFakeProject("target-capability-runtime-artifact-composition", targetPack, {
    id: "demo",
    surfaces: ["js"],
  }, {
    installedCapabilities: [acme, unused],
    source: "import { named } from \"@acme/native/named.js\";\nexport const value = named;\n",
  });

  assert.deepEqual(result.targets[0].compileResult.artifacts.map((artifact) => artifact.path), [
    "runtime/provider.txt",
    "runtime/acme.txt",
    "runtime/js.txt",
    "src/App.demo",
  ]);
  assert.deepEqual(events, [
    "provider:demo:surfaces=js",
    "capability-extension:acme:target=demo:capabilities=acme,unused",
    "capability-extension:unused:target=demo:capabilities=acme,unused",
    "provider-resolve:acme:@acme/native/named.js:named:named as named",
    "provider-runtime:demo",
    "capability-runtime:acme",
    "surface-runtime:js",
    "backend:demo",
    "toolchain:demo:artifacts=runtime/provider.txt,runtime/acme.txt,runtime/js.txt,src/App.demo",
  ]);
  assert.equal(events.includes("capability-runtime:unused"), false);
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
        sourceSpan: {
          fileName: "src/index.ts",
          line: 1,
          column: 14,
          endLine: 1,
          endColumn: 19,
        },
        evidence: [
          "required fact: selected-target-operation",
          "capability: diagnostic.missing-target-fact",
        ],
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
  assert.deepEqual(result.diagnostics[0].sourceSpan, {
    fileName: "src/index.ts",
    line: 1,
    column: 14,
    endLine: 1,
    endColumn: 19,
  });
  assert.deepEqual(result.diagnostics[0].evidence, [
    "required fact: selected-target-operation",
    "capability: diagnostic.missing-target-fact",
  ]);
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

test("host exposes TSTS flow-narrowed source types to backend analysis queries", async () => {
  const events = [];
  const narrowedTypes = {};
  const projectDirectory = resolve(tempRoot, "tsts-flow-narrowed-analysis-query");
  const projectConfig = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  const targetPack = createFakeTargetPack(events, {
    onBackend(input) {
      const sourceFile = input.sourceFiles.find((candidate) => input.ast.getFileName(candidate).endsWith("/src/index.ts"));
      assert.ok(sourceFile !== undefined);
      const narrowedText = findVariableInitializer(input.ast, sourceFile, "narrowedText");
      const narrowedNumber = findVariableInitializer(input.ast, sourceFile, "narrowedNumber");
      narrowedTypes.text = input.analysis.describeTypeAtLocation(narrowedText, { sourceFile });
      narrowedTypes.number = input.analysis.describeTypeAtLocation(narrowedNumber, { sourceFile });
    },
  });
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": [
      "export function describe(value: string | number | null): string {",
      "  if (typeof value === \"string\") {",
      "    const narrowedText = value;",
      "    return narrowedText;",
      "  }",
      "  if (value !== null) {",
      "    const narrowedNumber = value;",
      "    return `${narrowedNumber}`;",
      "  }",
      "  return \"none\";",
      "}",
      "",
    ].join("\n"),
  });

  const result = compileProject({
    project: parseTsonicProjectConfig(projectConfig),
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    registry: createRegistry(targetPack),
  });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(narrowedTypes, {
    text: "string",
    number: "number",
  });
  assert.deepEqual(events, [
    "provider:demo:surfaces=",
    "provider-runtime:demo",
    "backend:demo",
    "toolchain:demo:artifacts=",
  ]);
});

test("host rejects invalid flow-narrowed source before backend analysis runs", async () => {
  const events = [];
  const projectDirectory = resolve(tempRoot, "tsts-flow-narrowed-analysis-query-negative");
  const projectConfig = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  const targetPack = createFakeTargetPack(events, {
    onBackend() {
      assert.fail("Backend must not run after TSTS source diagnostics.");
    },
  });
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": [
      "export function invalid(value: string | number): number {",
      "  if (typeof value === \"string\") {",
      "    const bad: number = value;",
      "    return bad;",
      "  }",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });

  const result = compileProject({
    project: parseTsonicProjectConfig(projectConfig),
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    registry: createRegistry(targetPack),
  });

  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.category === "error"), true);
  const tstsDiagnostic = result.diagnostics.find((diagnostic) => /TS2322: Type 'string' is not assignable to type 'number'/.test(diagnostic.message));
  assert.ok(tstsDiagnostic);
  assert.equal(tstsDiagnostic.code, "TSTS_DIAGNOSTIC");
  assert.deepEqual(tstsDiagnostic.sourceSpan, {
    fileName: "index.ts",
    line: 3,
    column: 11,
    endLine: 3,
    endColumn: 14,
  });
  assert.deepEqual(tstsDiagnostic.evidence, ["tsts.code=TS2322"]);
  assert.deepEqual(events, [
    "provider:demo:surfaces=",
  ]);
  assert.deepEqual(result.targets[0].compileResult.artifacts, []);
});

test("host exposes broad TSTS flow-narrowed source types without target policy conclusions", async () => {
  const events = [];
  const observedTypes = {};
  const projectDirectory = resolve(tempRoot, "tsts-broad-flow-narrowed-analysis-query");
  const projectConfig = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  const targetPack = createFakeTargetPack(events, {
    onBackend(input) {
      const sourceFile = input.sourceFiles.find((candidate) => input.ast.getFileName(candidate).endsWith("/src/index.ts"));
      assert.ok(sourceFile !== undefined);
      for (const name of ["foundShape", "missingShape", "truthyValue", "derivedValue", "nullishValue"]) {
        const initializer = findVariableInitializer(input.ast, sourceFile, name);
        observedTypes[name] = input.analysis.describeTypeAtLocation(initializer, { sourceFile });
      }
    },
  });
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": [
      "class BaseValue {",
      "  name: string = \"base\";",
      "}",
      "",
      "class DerivedValue extends BaseValue {",
      "  score: number = 1;",
      "}",
      "",
      "type Found = { kind: \"found\"; value: number };",
      "type Missing = { kind: \"missing\"; value: number };",
      "type Lookup = Found | Missing;",
      "",
      "export function analyze(shape: Lookup, value: string | number | null | undefined, base: BaseValue | null): string {",
      "  if (shape.kind === \"found\") {",
      "    const foundShape = shape;",
      "    void foundShape;",
      "  } else {",
      "    const missingShape = shape;",
      "    void missingShape;",
      "  }",
      "  if (value) {",
      "    const truthyValue = value;",
      "    void truthyValue;",
      "  }",
      "  if (base instanceof DerivedValue) {",
      "    const derivedValue = base;",
      "    void derivedValue;",
      "  }",
      "  const nullishValue = value ?? \"fallback\";",
      "  return `${nullishValue}`;",
      "}",
      "",
    ].join("\n"),
  });

  const result = compileProject({
    project: parseTsonicProjectConfig(projectConfig),
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    registry: createRegistry(targetPack),
  });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(observedTypes, {
    foundShape: "Found",
    missingShape: "Missing",
    truthyValue: "string | number",
    derivedValue: "DerivedValue",
    nullishValue: "string | number",
  });
  assert.deepEqual(events, [
    "provider:demo:surfaces=",
    "provider-runtime:demo",
    "backend:demo",
    "toolchain:demo:artifacts=",
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

test("host rejects invalid target source-profile declaration file names", () => {
  const events = [];
  const projectRoot = resolve(tempRoot, "invalid-source-profile-names");
  const project = parseTsonicProjectConfig({
    entryPoint: "index.ts",
    targets: [{ id: "demo" }],
  });
  const target = project.targets[0];
  const targetPack = createFakeTargetPack(events, {
    providerSourceProfileDeclarations: [
      targetSourceProfileDeclaration("globals.ts", "interface Object {}\n"),
      targetSourceProfileDeclaration("../escape.d.ts", "interface String {}\n"),
      targetSourceProfileDeclaration("nested/globals.d.ts", "interface Number {}\n"),
    ],
  });

  const sourceProfile = collectTargetSourceProfileContributions({
    project,
    projectRoot,
    target,
    targetPack,
    selectedCapabilities: [],
    selectedSurfaces: [],
  });

  assert.deepEqual(sourceProfile.files, []);
  assert.deepEqual(sourceProfile.diagnostics.map((diagnostic) => diagnostic.message), [
    "Source profile declaration 'globals.ts' from 'demo-provider' must be a .d.ts file.",
    "Source profile declaration '../escape.d.ts' from 'demo-provider' must be a file name, not a path.",
    "Source profile declaration 'nested/globals.d.ts' from 'demo-provider' must be a file name, not a path.",
  ]);
});

test("host rejects duplicate target source-profile virtual paths from one owner", () => {
  const events = [];
  const projectRoot = resolve(tempRoot, "duplicate-source-profile-paths");
  const project = parseTsonicProjectConfig({
    entryPoint: "index.ts",
    targets: [{ id: "demo" }],
  });
  const target = project.targets[0];
  const targetPack = createFakeTargetPack(events, {
    providerSourceProfileDeclarations: [
      targetSourceProfileDeclaration("globals.d.ts", "interface Object {}\n"),
      targetSourceProfileDeclaration("globals.d.ts", "interface String {}\n"),
    ],
  });

  const sourceProfile = collectTargetSourceProfileContributions({
    project,
    projectRoot,
    target,
    targetPack,
    selectedCapabilities: [],
    selectedSurfaces: [],
  });

  assert.deepEqual(sourceProfile.files.map((file) => file.path), [
    resolve(projectRoot, ".tsonic/source-profiles/demo-provider/globals.d.ts").split("\\").join("/"),
  ]);
  assert.deepEqual(sourceProfile.diagnostics.map((diagnostic) => diagnostic.message), [
    `Source profile declaration path '${resolve(projectRoot, ".tsonic/source-profiles/demo-provider/globals.d.ts").split("\\").join("/")}' is contributed by both 'demo-provider' and 'demo-provider'.`,
  ]);
});

test("host blocks semantic input and backend execution for invalid source-profile declarations", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    providerSourceProfileDeclarations: [
      targetSourceProfileDeclaration("globals.ts", "interface Object {}\n"),
    ],
  });

  const result = await compileFakeProject("invalid-source-profile-blocks-semantic-input", targetPack, { id: "demo" });

  assert.deepEqual(events, []);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, "TARGET_SOURCE_PROFILE");
  assert.equal(result.diagnostics[0].message, "Source profile declaration 'globals.ts' from 'demo-provider' must be a .d.ts file.");
  assert.equal(result.targets.length, 1);
  assert.deepEqual(result.targets[0].compileResult.artifacts, []);
});

async function compileFakeProject(name, targetPack, targetSelection, options = {}) {
  const projectDirectory = resolve(tempRoot, name);
  const projectConfig = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [targetSelection],
  };
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "src/index.ts": options.source ?? "export const value = 1;\n",
  });
  return compileProject({
    project: parseTsonicProjectConfig(projectConfig),
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    registry: createRegistry(targetPack),
    installedCapabilities: options.installedCapabilities ?? [],
  });
}

function createSemanticSession(projectDirectory, projectConfig, targetPack, selectedCapabilities = []) {
  const project = parseTsonicProjectConfig(projectConfig);
  const target = project.targets[0];
  const sourceProfile = collectTargetSourceProfileContributions({
    project,
    projectRoot: projectDirectory,
    target,
    targetPack,
    selectedCapabilities,
    selectedSurfaces: [],
  });
  assert.deepEqual(sourceProfile.diagnostics, []);
  const programOptions = createProgramOptionsForProject({
    project,
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    sourceProfileFiles: sourceProfile.files,
  }).programOptions;
  return createTsonicSemanticSession({
    programOptions,
    project,
    target,
    targetPack,
    selectedCapabilities,
  });
}

async function writeProject(projectDirectory, files) {
  for (const [relativePath, text] of Object.entries(files)) {
    const outputPath = resolve(projectDirectory, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, text, "utf8");
  }
}

function findVariableInitializer(ast, sourceFile, variableName) {
  let initializer;
  visit(sourceFile);
  assert.ok(initializer !== undefined, `Missing initializer for variable '${variableName}'.`);
  return initializer;

  function visit(node) {
    if (initializer !== undefined) {
      return;
    }
    if (ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)) === variableName) {
      initializer = ast.as.AsVariableDeclaration(node)?.Initializer;
      return;
    }
    ast.forEachChild(node, visit);
  }
}

function findBinaryExpression(ast, sourceFile) {
  let expression;
  visit(sourceFile);
  assert.notEqual(expression, undefined);
  return expression;

  function visit(node) {
    if (expression !== undefined) {
      return;
    }
    if (ast.is.IsBinaryExpression(node)) {
      expression = node;
      return;
    }
    ast.forEachChild(node, visit);
  }
}

function fakePaths(projectDirectory) {
  return {
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    projectRoot: projectDirectory,
    outputRoot: resolve(projectDirectory, "out"),
    targetOutputRoot: resolve(projectDirectory, "out/demo"),
  };
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
            ...((options.providerModuleOwnership ?? []).length > 0 ? { moduleOwnership: options.providerModuleOwnership } : {}),
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
            sourceProfileContributions() {
              return {
                declarations: options.providerSourceProfileDeclarations ?? [
                  targetSourceProfileDeclaration("globals.d.ts", [
                    "interface Array<T> {}",
                    "interface Boolean {}",
                    "interface CallableFunction extends Function {}",
                    "interface Function {}",
                    "interface IArguments {}",
                    "interface NewableFunction extends Function {}",
                    "interface Number {}",
                    "interface Object {}",
                    "interface RegExp {}",
                    "interface String {}",
                    "",
                  ].join("\n")),
                ],
              };
            },
          },
        }),
    surfaces: options.surfaces ?? [],
    createBackend() {
      return {
        compile(input) {
          const result = options.onBackend?.(input);
          if (result !== undefined) {
            return result;
          }
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

function createFakeTargetCapability(id, options = {}) {
  return {
    id,
    targetId: "demo",
    displayName: `${id} Target Capability`,
    ...((options.requiredSurfaces ?? []).length > 0 ? { requiredSurfaces: options.requiredSurfaces } : {}),
    moduleOwnership: options.moduleOwnership ?? [],
    createExtensions(context) {
      options.events?.push(`capability-extension:${id}:target=${context.target.id}:capabilities=${context.selectedCapabilities.map((capability) => capability.id).join(",")}`);
      assert.equal(context.capability.id, id);
      return options.extension === undefined ? [] : [options.extension];
    },
    runtimeContributions() {
      options.events?.push(`capability-runtime:${id}`);
      return {
        artifacts: options.artifacts ?? [],
        references: options.references ?? [],
      };
    },
  };
}

function createFakeVirtualTargetCapability(id, options = {}) {
  const moduleOwnership = options.moduleOwnership ?? [{ specifierPrefix: `@${id}/native/` }];
  return createFakeTargetCapability(id, {
    ...options,
    moduleOwnership,
    extension: {
      identity: {
        id: `${id}-extension`,
        version: "1.0.0",
        capabilityNamespace: `test.${id}`,
      },
      initialize(context) {
        context.registerTargetBindingProvider(createFakeVirtualBindingProvider(id, moduleOwnership, options.events));
      },
    },
  });
}

function createFakeVirtualBindingProvider(id, moduleOwnership, events) {
  return {
    identity: {
      id: `${id}-provider`,
      version: "1.0.0",
      target: "demo",
      extensionContractVersion: TstsProviderContractVersion,
      providerKind: "binding",
      displayName: `${id} fake provider`,
    },
    ownsModule(specifier) {
      return moduleOwnership.some((ownership) => specifier.startsWith(ownership.specifierPrefix))
        ? {
            kind: "owned",
            evidence: [{ message: `${id} target capability owns ${specifier}` }],
          }
        : { kind: "unowned" };
    },
    resolveModule(specifier, context) {
      const slice = context.importSlice;
      events?.push(`provider-resolve:${id}:${specifier}:${slice?.kind ?? "unknown"}:${formatImportSliceExports(slice)}`);
      if (specifier.endsWith("/unsupported.js")) {
        return {
          extensionId: `${id}-provider`,
          extensionCode: "ACME_PROVIDER_UNSUPPORTED_MODULE",
          numericCode: 9910001,
          publicCode: "ACME_PROVIDER_9910001",
          category: "error",
          message: `Provider package '${id}' does not support module '${specifier}'.`,
          source: `${id}-provider`,
          identity: `${id}:unsupported:${specifier}`,
        };
      }
      return {
        kind: "virtual",
        moduleSpecifier: specifier,
        virtualFileName: `tsts-provider://${id}/${encodeURIComponent(specifier)}.d.ts`,
        providerModuleId: specifier,
        packageName: `@${id}/native`,
        packageVersion: "1.0.0",
        evidence: [{ message: `${id} target capability resolved ${specifier}` }],
      };
    },
    getDeclarationModel(resolution) {
      return {
        moduleSpecifier: resolution.moduleSpecifier,
        providerModuleId: resolution.providerModuleId,
        exports: [
          {
            id: "defaultValue",
            name: "defaultValue",
            exportKind: "default",
            kind: "value",
            type: { kind: "string" },
            targetIdentity: { target: "demo", id: `${id}.DefaultValue`, displayName: `${id}.DefaultValue` },
          },
          {
            id: "named",
            name: "named",
            kind: "value",
            type: { kind: "number" },
            targetIdentity: { target: "demo", id: `${id}.Named`, displayName: `${id}.Named` },
          },
        ],
        evidence: [{ message: `${id} target capability declaration model` }],
      };
    },
    getTargetIdentity(symbol) {
      return {
        target: "demo",
        id: `${id}:${symbol.moduleSpecifier}:${symbol.exportName ?? "module"}:${symbol.memberName ?? ""}:${symbol.signatureId ?? ""}`,
      };
    },
  };
}

function formatImportSliceExports(slice) {
  if (slice === undefined) {
    return "none";
  }
  if (slice.kind === "namespace") {
    return "*";
  }
  if (slice.kind === "default") {
    return "default";
  }
  return (slice.requestedExports ?? [])
    .map((requestedExport) => requestedExport.localName === undefined
      ? requestedExport.exportedName
      : `${requestedExport.exportedName} as ${requestedExport.localName}`)
    .join(",");
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
