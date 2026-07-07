import { assert, access, mkdir, readFile, writeFile, dirname, resolve, test, collectTstsDiagnostics, collectTargetSourceProfileContributions, compileTargetFromSemanticSession, compileProject, createProgramOptionsForProject, createTsonicSemanticSession, createTargetCompilerExtensions, parseTsonicProjectConfig, createTargetRegistry, targetSourceProfileDeclaration, ExtensionLifecycleEvent, providerVirtualDeclarationFactKey, runtimeCarrierFactKey, targetOperationFactKey, TstsProviderContractVersion, repoRoot, tempRoot, createPortableOperationFactsExtension, compileFakeProject, createSemanticSession, writeProject, findVariableInitializer, findBinaryExpression, fakePaths, createRegistry, extensionIds, createFakeTargetPack, createFakeTargetCapability, createFakeVirtualTargetCapability, createFakeVirtualBindingProvider, formatImportSliceExports, createFakeSurface, createFakeArtifact, createFakeReference } from "./surface-composition.helpers.mjs";

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