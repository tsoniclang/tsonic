import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

import {
  collectTargetSourceProfileContributions,
  compileProject,
  createProgramOptionsForProject,
  parseTsonicProjectConfig,
} from "../../../packages/host/dist/index.js";
import { collectTstsDiagnostics } from "../../../packages/host/dist/diagnostics.js";
import {
  captureTargetCapabilityContributions,
  createTargetSourceCompilerComposition,
  getTargetRequiredProviderModules,
} from "../../../packages/host/dist/target/extensions.js";
import {
  createTargetRegistry,
} from "../../../packages/target-api/dist/public/index.js";
import {
  rejectedTargetStage,
  resolvedTargetStage,
} from "../../../packages/target-api/dist/public/artifacts.js";
import {
  targetSourceProfileDeclaration,
} from "../../../packages/target-api/dist/public/provider.js";
import {
  defineExtensionFactKey,
  createCompilerSession,
  providerVirtualDeclarationFactKey,
  TstsSourceProviderContractVersion,
} from "@tsonic/tsts";
export { assert, access, mkdir, readFile, writeFile, dirname, resolve, test, collectTstsDiagnostics, collectTargetSourceProfileContributions, compileProject, createProgramOptionsForProject, parseTsonicProjectConfig, createTargetRegistry, rejectedTargetStage, resolvedTargetStage, targetSourceProfileDeclaration, providerVirtualDeclarationFactKey, TstsSourceProviderContractVersion };

export const repoRoot = process.cwd();
export const tempRoot = resolve(repoRoot, ".temp/test-runs/host-surface-composition", `${Date.now()}-${process.pid}`);








export const portableOperationFactKey = defineExtensionFactKey({
  extensionId: "portable-operation-facts-test-extension",
  name: "binary-operation",
  snapshot(value) {
    return Object.freeze({ ...value });
  },
  equals(left, right) {
    return left.operator === right.operator &&
      left.resultType === right.resultType;
  },
});

export function createPortableOperationFactsExtension() {
  return {
    identity: {
      id: "portable-operation-facts-test-extension",
      version: "1.0.0",
    },
    analyzeSource(context) {
      const sourceFile = context.source.getSourceFiles().find((candidate) =>
        candidate !== undefined &&
        !candidate.IsDeclarationFile &&
        context.source.ast.getFileName(candidate).endsWith("src/index.ts"));
      assert.ok(sourceFile !== undefined);
      const expression = findBinaryExpression(context.source.ast, sourceFile);
      const queries = context.source.getSourceFileQueries(sourceFile);
      assert.equal(context.facts.set(expression, portableOperationFactKey, {
        operator: context.source.ast.operatorKindName(expression),
        resultType: queries.checker.typeToString(queries.checker.getTypeAtLocation(expression)),
      }), "inserted");
    },
  };
}






























export async function compileFakeProject(name, targetPack, targetSelection, options = {}) {
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

export function createSemanticSession(projectDirectory, projectConfig, targetPack, selectedCapabilities = []) {
  const project = parseTsonicProjectConfig(projectConfig);
  const target = project.targets[0];
  const selectedSurfaces = targetPack.surfaces.filter((surface) =>
    (target.surfaces ?? []).includes(surface.id));
  const paths = fakePaths(projectDirectory);
  const targetSession = targetPack.createCompilationSession({
    project,
    projectDirectory,
    target,
    paths,
    selectedSurfaceIds: selectedSurfaces.map((surface) => surface.id),
    capabilities: captureTargetCapabilityContributions({
      project,
      projectDirectory,
      target,
      selectedCapabilities,
      selectedSurfaces,
    }),
  });
  const sourceProfile = collectTargetSourceProfileContributions({
    project,
    projectRoot: projectDirectory,
    projectDirectory,
    target,
    targetPackId: targetPack.id,
    selectedCapabilities,
    selectedSurfaces,
    targetContributions: targetSession.sourceProfileContributions(),
  });
  assert.deepEqual(sourceProfile.diagnostics, []);
  const programOptions = createProgramOptionsForProject({
    project,
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    sourceProfileFiles: sourceProfile.files,
  }).programOptions;
  const composition = createTargetSourceCompilerComposition({
    project,
    projectDirectory,
    target,
    targetPack,
    selectedCapabilities,
    selectedSurfaces,
    targetContributions: targetSession.sourceCompilerContributions(),
  });
  const source = createCompilerSession({
    programOptions,
    extensionHostOptions: {
      extensions: composition.extensions,
      requiredProviderModules: getTargetRequiredProviderModules(
        target,
        targetPack.provider,
        selectedCapabilities,
      ),
    },
  }).checkSource();
  targetSession.close();
  return { source };
}

export function composeFakeTargetSourceCompiler({
  project,
  projectDirectory,
  target,
  targetPack,
  selectedCapabilities = [],
}) {
  const selectedSurfaces = targetPack.surfaces.filter((surface) =>
    (target.surfaces ?? []).includes(surface.id));
  const targetSession = targetPack.createCompilationSession({
    project,
    projectDirectory,
    target,
    paths: fakePaths(projectDirectory),
    selectedSurfaceIds: selectedSurfaces.map((surface) => surface.id),
    capabilities: captureTargetCapabilityContributions({
      project,
      projectDirectory,
      target,
      selectedCapabilities,
      selectedSurfaces,
    }),
  });
  targetSession.sourceProfileContributions();
  const composition = createTargetSourceCompilerComposition({
    project,
    projectDirectory,
    target,
    targetPack,
    selectedCapabilities,
    selectedSurfaces,
    targetContributions: targetSession.sourceCompilerContributions(),
  });
  targetSession.close();
  return {
    ...composition,
    selectedCapabilities,
    selectedSurfaces,
  };
}

export function collectFakeTargetSourceProfile({
  project,
  projectRoot,
  target,
  targetPack,
  selectedCapabilities = [],
  selectedSurfaces = [],
}) {
  const targetSession = targetPack.createCompilationSession({
    project,
    projectDirectory: projectRoot,
    target,
    paths: fakePaths(projectRoot),
    selectedSurfaceIds: selectedSurfaces.map((surface) => surface.id),
    capabilities: captureTargetCapabilityContributions({
      project,
      projectDirectory: projectRoot,
      target,
      selectedCapabilities,
      selectedSurfaces,
    }),
  });
  const result = collectTargetSourceProfileContributions({
    project,
    projectRoot,
    projectDirectory: projectRoot,
    target,
    targetPackId: targetPack.id,
    selectedCapabilities,
    selectedSurfaces,
    targetContributions: targetSession.sourceProfileContributions(),
  });
  targetSession.close();
  return result;
}

export function targetArtifacts(targetBuild) {
  return targetBuild.compileResult.kind === "resolved"
    ? targetBuild.compileResult.value.artifacts
    : [];
}

export async function writeProject(projectDirectory, files) {
  for (const [relativePath, text] of Object.entries(files)) {
    const outputPath = resolve(projectDirectory, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, text, "utf8");
  }
}

export function findVariableInitializer(ast, sourceFile, variableName) {
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

export function findBinaryExpression(ast, sourceFile) {
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

export function fakePaths(projectDirectory) {
  return {
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    projectRoot: projectDirectory,
    outputRoot: resolve(projectDirectory, "out"),
    targetOutputRoot: resolve(projectDirectory, "out/demo"),
  };
}

export function createRegistry(targetPack) {
  return {
    packs: [targetPack],
    get(id) {
      return id === targetPack.id ? targetPack : undefined;
    },
  };
}

export function extensionIds(extensions) {
  return extensions.map((extension) => extension.identity.id);
}

export function createFakeCompilerExtension(id) {
  return {
    identity: {
      id,
      version: "1.0.0",
    },
  };
}

export function createFakeTargetPack(events, options = {}) {
  return {
    id: options.id ?? "demo",
    displayName: "Demo Target",
    provider: {
      id: "demo-provider",
      displayName: "Demo Provider",
      moduleOwnership: options.providerModuleOwnership ?? [],
    },
    surfaces: options.surfaces ?? [],
    createCompilationSession(context) {
      options.onSessionContext?.(context);
      if (options.traceLifecycle === true) {
        events.push("session:create");
      }
      let state = "created";
      return {
        sourceProfileContributions() {
          assert.equal(state, "created");
          state = "profile";
          if (options.traceLifecycle === true) {
            events.push("session:profile");
          }
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
        sourceCompilerContributions() {
          assert.equal(state, "profile");
          state = "compiler";
          if (options.traceLifecycle === true) {
            events.push("session:compiler");
          }
          events.push(`provider:${context.target.id}:surfaces=${context.selectedSurfaceIds.join(",")}`);
          return options.targetExtension === undefined
            ? {}
            : { extensions: [options.targetExtension] };
        },
        runtimeContributions() {
          assert.equal(state, "compiler");
          state = "runtime";
          if (options.traceLifecycle === true) {
            events.push("session:runtime");
          }
          events.push(`provider-runtime:${context.target.id}`);
          return {
            artifacts: options.providerArtifacts ?? [],
            references: options.providerReferences ?? [],
          };
        },
        compile(input) {
          assert.equal(state, "runtime");
          state = "compiled";
          if (options.traceLifecycle === true) {
            events.push("session:compile");
          }
          const result = options.onCompile?.(input);
          events.push(`compile:${input.target.id}`);
          if (result !== undefined) {
            return result;
          }
          const diagnostics = options.compileDiagnostics ?? [];
          return diagnostics.some((diagnostic) => diagnostic.category === "error")
            ? rejectedTargetStage(diagnostics)
            : resolvedTargetStage(
                { artifacts: options.compileArtifacts ?? [] },
                diagnostics,
              );
        },
        close() {
          state = "closed";
          if (options.traceLifecycle === true) {
            events.push("session:close");
          }
          if (options.closeError !== undefined) {
            throw options.closeError;
          }
        },
      };
    },
    createToolchain() {
      return {
        prepare(input) {
          options.onToolchain?.(input);
          events.push(`toolchain:${input.target.id}:artifacts=${input.compileOutput.artifacts.map((artifact) => artifact.path).join(",")}`);
          return {
            diagnostics: [],
            producedArtifacts: [],
          };
        },
      };
    },
  };
}

export function createFakeTargetCapability(id, options = {}) {
  return {
    kind: "target-capability",
    id,
    targetId: "demo",
    displayName: `${id} Target Capability`,
    ...((options.requiredSurfaces ?? []).length > 0 ? { requiredSurfaces: options.requiredSurfaces } : {}),
    ...((options.requiredCapabilities ?? []).length > 0 ? { requiredCapabilities: options.requiredCapabilities } : {}),
    moduleOwnership: options.moduleOwnership ?? [],
    ...(options.targetContributions === undefined
      ? {}
      : {
          createTargetContributions(context) {
            options.events?.push(`capability-target:${id}`);
            assert.equal(context.capability.id, id);
            return options.targetContributions;
          },
        }),
    sourceCompilerContributions(context) {
      options.events?.push(`capability-extension:${id}:target=${context.target.id}:capabilities=${context.selectedCapabilityIds.join(",")}`);
      assert.equal(context.capability.id, id);
      return options.extension === undefined
        ? {}
        : { extensions: [options.extension] };
    },
    runtimeContributions() {
      options.events?.push(`capability-runtime:${id}`);
      return {
        artifacts: options.artifacts ?? [],
        references: options.references ?? [],
      };
    },
    ...(options.sourceProfileDeclarations === undefined
      ? {}
      : {
          sourceProfileContributions(context) {
            options.events?.push(`capability-source-profile:${id}:target=${context.target.id}:capabilities=${context.selectedCapabilityIds.join(",")}`);
            return {
              declarations: options.sourceProfileDeclarations,
            };
          },
        }),
  };
}

export function createFakeVirtualTargetCapability(id, options = {}) {
  const moduleOwnership = options.moduleOwnership ?? [{ specifierPrefix: `@${id}/native/` }];
  return createFakeTargetCapability(id, {
    ...options,
    moduleOwnership,
    extension: {
      identity: {
        id: `${id}-extension`,
        version: "1.0.0",
      },
      initialize(context) {
        context.registerSourceDeclarationProvider(createFakeVirtualBindingProvider(id, moduleOwnership, options.events));
      },
    },
  });
}

export function createFakeVirtualBindingProvider(id, moduleOwnership, events) {
  return {
    identity: {
      id: `${id}-provider`,
      version: "1.0.0",
      extensionContractVersion: TstsSourceProviderContractVersion,
      displayName: `${id} fake provider`,
    },
    declarationMaterialization: "complete",
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
          },
          {
            id: "named",
            name: "named",
            kind: "value",
            type: { kind: "number" },
          },
        ],
        evidence: [{ message: `${id} target capability declaration model` }],
      };
    },
  };
}

export function formatImportSliceExports(slice) {
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

export function createFakeSurface(id, optionsOrRequiredSurfaces = {}) {
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
          sourceCompilerContributions(context) {
            options.events?.push(`surface-extension:${id}:target=${context.target.id}:surfaces=${context.selectedSurfaceIds.join(",")}`);
            assert.equal(context.surface.id, id);
            return { extensions: [options.extension] };
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

export function createFakeArtifact(kind, path, text) {
  return {
    kind,
    path,
    text,
  };
}

export function createFakeReference(kind, include) {
  return {
    kind,
    include,
  };
}
