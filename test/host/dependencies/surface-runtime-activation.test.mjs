import { assert, access, mkdir, readFile, writeFile, dirname, resolve, test, collectTstsDiagnostics, collectFakeTargetSourceProfile, compileProject, createProgramOptionsForProject, composeFakeTargetSourceCompiler, parseTsonicProjectConfig, createTargetRegistry, targetSourceProfileDeclaration, providerVirtualDeclarationFactKey, repoRoot, tempRoot, createPortableOperationFactsExtension, portableOperationFactKey, compileFakeProject, createSemanticSession, writeProject, findVariableInitializer, findBinaryExpression, createRegistry, extensionIds, createFakeCompilerExtension, createFakeTargetPack, createFakeTargetCapability, createFakeVirtualTargetCapability, createFakeVirtualBindingProvider, formatImportSliceExports, createFakeSurface, createFakeArtifact, createFakeReference, targetArtifacts } from "./surface-composition.helpers.mjs";
import { sourceProjectFiles } from "../../../packages/target-api/dist/public/source.js";

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

  assert.deepEqual(targetArtifacts(result.targets[0]).map((artifact) => artifact.path), [
    "runtime/provider.txt",
  ]);
  assert.equal(events.includes("surface-runtime:js"), false);
});
test("host reports conflicting runtime artifacts as target diagnostics before target compilation", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    providerArtifacts: [
      createFakeArtifact("asset", "runtime/shared.txt", "provider"),
    ],
    compileArtifacts: [
      createFakeArtifact("source", "src/App.demo", "compile"),
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
  assert.equal(result.diagnostics[0].message, "conflicting target runtime artifact 'runtime/shared.txt'");
  assert.equal(targetArtifacts(result.targets[0]).length, 0);
  assert.equal(events.includes("compile:demo"), false);
  assert.equal(events.some((event) => event.startsWith("toolchain:")), false);
});
test("host canonicalizes byte-identical runtime artifacts before target compilation", async () => {
  const events = [];
  const shared = createFakeArtifact("asset", "runtime/shared.txt", "shared");
  const targetPack = createFakeTargetPack(events, {
    providerArtifacts: [shared],
    compileArtifacts: [
      createFakeArtifact("source", "src/App.demo", "compile"),
    ],
    surfaces: [
      createFakeSurface("js", {
        events,
        artifacts: [{ ...shared }],
      }),
    ],
  });

  const result = await compileFakeProject("identical-runtime-artifacts", targetPack, {
    id: "demo",
    surfaces: ["js"],
  });

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(targetArtifacts(result.targets[0]).map((artifact) => artifact.path), [
    "runtime/shared.txt",
    "src/App.demo",
  ]);
  assert.equal(events.includes("compile:demo"), true);
});
test("host canonicalizes identical runtime references before target compilation", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    providerReferences: [
      createFakeReference("project", "../runtime/Runtime.csproj"),
    ],
    compileArtifacts: [
      createFakeArtifact("source", "src/App.demo", "compile"),
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
    "compile:demo",
    "toolchain:demo:artifacts=src/App.demo",
  ]);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(targetArtifacts(result.targets[0]).map((artifact) => artifact.path), [
    "src/App.demo",
  ]);
  assert.equal(events.includes("compile:demo"), true);
  assert.equal(events.some((event) => event.startsWith("toolchain:")), true);
});
test("host canonicalizes absent and empty runtime-reference attributes", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    providerReferences: [
      createFakeReference("project", "../runtime/Runtime.csproj"),
    ],
    compileArtifacts: [
      createFakeArtifact("source", "src/App.demo", "compile"),
    ],
    surfaces: [
      createFakeSurface("js", {
        events,
        references: [{
          ...createFakeReference("project", "../runtime/Runtime.csproj"),
          attributes: {},
        }],
      }),
    ],
  });

  const result = await compileFakeProject("empty-runtime-reference-attributes", targetPack, {
    id: "demo",
    surfaces: ["js"],
  });

  assert.deepEqual(result.diagnostics, []);
  assert.equal(events.includes("compile:demo"), true);
});
test("host rejects conflicting runtime reference contracts before target compilation", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    providerReferences: [{
      ...createFakeReference("project", "../runtime/Runtime.csproj"),
      attributes: { Private: "true" },
    }],
    compileArtifacts: [
      createFakeArtifact("source", "src/App.demo", "compile"),
    ],
    surfaces: [
      createFakeSurface("js", {
        events,
        references: [{
          ...createFakeReference("project", "../runtime/Runtime.csproj"),
          attributes: { Private: "false" },
        }],
      }),
    ],
  });

  const result = await compileFakeProject("conflicting-runtime-references", targetPack, {
    id: "demo",
    surfaces: ["js"],
  });

  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, "TARGET_RUNTIME");
  assert.equal(result.diagnostics[0].category, "error");
  assert.equal(
    result.diagnostics[0].message,
    "conflicting target runtime reference 'project:../runtime/Runtime.csproj'",
  );
  assert.deepEqual(targetArtifacts(result.targets[0]), []);
  assert.equal(events.includes("compile:demo"), false);
  assert.equal(events.some((event) => event.startsWith("toolchain:")), false);
});
test("host suppresses compiled artifacts and toolchain when target compilation reports errors", async () => {
  const events = [];
  const targetPack = createFakeTargetPack(events, {
    providerArtifacts: [
      createFakeArtifact("asset", "runtime/provider.txt", "provider"),
    ],
    compileArtifacts: [
      createFakeArtifact("source", "src/App.demo", "compile"),
    ],
    compileDiagnostics: [
      {
        code: "MISSING_FACT",
        category: "error",
        message: "backend requires finalized target facts before emission",
        source: "demo-target",
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
    "compile:demo",
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
  assert.equal(targetArtifacts(result.targets[0]).length, 0);
  assert.equal(result.targets[0].compileResult.diagnostics.length, 1);
  assert.equal(events.some((event) => event.startsWith("toolchain:")), false);
});
test("host includes authored declarations but excludes metadata JSON from semantic input", async () => {
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
  assert.equal(fs.FileExists(resolve(projectDirectory, "src/generated.d.ts")), true);
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
    onCompile(input) {
      backendProjectSourceFiles = sourceProjectFiles(input.source)
        .map((sourceFile) => input.source.ast.getFileName(sourceFile))
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
test("host exposes TSTS flow-narrowed source types through the checked source program", async () => {
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
    onCompile(input) {
      const sourceFile = sourceProjectFiles(input.source).find((candidate) => input.source.ast.getFileName(candidate).endsWith("/src/index.ts"));
      assert.ok(sourceFile !== undefined);
      const narrowedText = findVariableInitializer(input.source.ast, sourceFile, "narrowedText");
      const narrowedNumber = findVariableInitializer(input.source.ast, sourceFile, "narrowedNumber");
      const semantics = input.source.semantics.forFile(sourceFile);
      narrowedTypes.text = semantics.types.isStringLike(
        semantics.types.expressionType(narrowedText),
      );
      narrowedTypes.number = semantics.types.isNumberLike(
        semantics.types.expressionType(narrowedNumber),
      );
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
    text: true,
    number: true,
  });
  assert.deepEqual(events, [
    "provider:demo:surfaces=",
    "provider-runtime:demo",
    "compile:demo",
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
    onCompile() {
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
  assert.deepEqual(targetArtifacts(result.targets[0]), []);
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
    onCompile(input) {
      const sourceFile = sourceProjectFiles(input.source).find((candidate) => input.source.ast.getFileName(candidate).endsWith("/src/index.ts"));
      assert.ok(sourceFile !== undefined);
      const semantics = input.source.semantics.forFile(sourceFile);
      for (const name of ["foundShape", "missingShape", "truthyValue", "derivedValue", "nullishValue"]) {
        const initializer = findVariableInitializer(input.source.ast, sourceFile, name);
        observedTypes[name] = summarizeSourceType(
          semantics,
          semantics.types.expressionType(initializer),
        );
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
    foundShape: { symbol: "Found", string: false, number: false, nullish: false },
    missingShape: { symbol: "Missing", string: false, number: false, nullish: false },
    truthyValue: { symbol: undefined, string: true, number: true, nullish: false },
    derivedValue: { symbol: "DerivedValue", string: false, number: false, nullish: false },
    nullishValue: { symbol: undefined, string: true, number: true, nullish: false },
  });
  assert.deepEqual(events, [
    "provider:demo:surfaces=",
    "provider-runtime:demo",
    "compile:demo",
    "toolchain:demo:artifacts=",
  ]);
});

function summarizeSourceType(semantics, type) {
  const members = semantics.types.isUnion(type)
    ? semantics.types.unionOrIntersectionTypes(type)
    : [type];
  const symbol = semantics.declarations.typeAliasSymbol(type) ??
    semantics.declarations.typeSymbol(type);
  return {
    symbol: symbol === undefined
      ? undefined
      : semantics.declarations.symbolName(symbol),
    string: members.some((member) => semantics.types.isStringLike(member)),
    number: members.some((member) => semantics.types.isNumberLike(member)),
    nullish: members.some((member) => semantics.types.isNullish(member)),
  };
}
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
    onCompile(input) {
      backendProjectSourceFiles = sourceProjectFiles(input.source)
        .map((sourceFile) => input.source.ast.getFileName(sourceFile))
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
    onCompile(input) {
      backendProjectSourceFiles = sourceProjectFiles(input.source)
        .map((sourceFile) => input.source.ast.getFileName(sourceFile))
        .filter((fileName) => fileName.startsWith(projectDirectory))
        .map((fileName) => fileName.slice(projectDirectory.length + 1).split("\\").join("/"))
        .sort();
    },
  });
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    "package.json": JSON.stringify({
      name: "source-package-graph-app",
      type: "module",
      dependencies: {
        "@demo/source-pkg": "1.0.0",
      },
    }, null, 2),
    "src/index.ts": [
      "import { subpathValue } from \"@demo/source-pkg/subpath.js\";",
      "export const result = subpathValue;",
      "",
    ].join("\n"),
    "node_modules/@demo/source-pkg/package.json": JSON.stringify({
      name: "@demo/source-pkg",
      version: "1.0.0",
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
  const checked = createSemanticSession(projectDirectory, projectConfig, targetPack).source;
  const allTstsProjectFiles = sourceProjectFiles(checked)
    .map((sourceFile) => sourceFile === undefined ? undefined : checked.ast.getFileName(sourceFile))
    .filter((fileName) => fileName?.startsWith(projectDirectory))
    .map((fileName) => fileName.slice(projectDirectory.length + 1).split("\\").join("/"))
    .sort();

  assert.deepEqual(allTstsProjectFiles, [
    "node_modules/@demo/source-pkg/src/internal.ts",
    "node_modules/@demo/source-pkg/src/subpath.ts",
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

  const sourceProfile = collectFakeTargetSourceProfile({
    project,
    projectRoot,
    target,
    targetPack,
    selectedCapabilities: [],
    selectedSurfaces: [],
  });

  assert.deepEqual(sourceProfile.files, []);
  assert.deepEqual(sourceProfile.diagnostics.map((diagnostic) => diagnostic.message), [
    "Source profile declaration 'globals.ts' from 'demo' must be a .d.ts file.",
    "Source profile declaration '../escape.d.ts' from 'demo' must be a file name, not a path.",
    "Source profile declaration 'nested/globals.d.ts' from 'demo' must be a file name, not a path.",
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

  const sourceProfile = collectFakeTargetSourceProfile({
    project,
    projectRoot,
    target,
    targetPack,
    selectedCapabilities: [],
    selectedSurfaces: [],
  });

  assert.deepEqual(sourceProfile.files.map((file) => file.path), [
    resolve(projectRoot, ".tsonic/source-profiles/demo/globals.d.ts").split("\\").join("/"),
  ]);
  assert.deepEqual(sourceProfile.diagnostics.map((diagnostic) => diagnostic.message), [
    `Source profile declaration path '${resolve(projectRoot, ".tsonic/source-profiles/demo/globals.d.ts").split("\\").join("/")}' is contributed by both 'demo' and 'demo'.`,
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
  assert.equal(result.diagnostics[0].message, "Source profile declaration 'globals.ts' from 'demo' must be a .d.ts file.");
  assert.equal(result.targets.length, 1);
  assert.deepEqual(targetArtifacts(result.targets[0]), []);
});
