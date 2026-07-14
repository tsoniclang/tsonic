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
export { assert, access, mkdir, readFile, writeFile, dirname, resolve, test, collectTstsDiagnostics, collectTargetSourceProfileContributions, compileTargetFromSemanticSession, compileProject, createProgramOptionsForProject, createTsonicSemanticSession, createTargetCompilerExtensions, parseTsonicProjectConfig, createTargetRegistry, targetSourceProfileDeclaration, ExtensionLifecycleEvent, providerVirtualDeclarationFactKey, runtimeCarrierFactKey, targetOperationFactKey, TstsProviderContractVersion };

export const repoRoot = process.cwd();
export const tempRoot = resolve(repoRoot, ".temp/test-runs/host-surface-composition", `${Date.now()}-${process.pid}`);








export function createPortableOperationFactsExtension() {
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
  return extensions.map((extension) => extension.identity?.id ?? extension.name);
}

export function createFakeTargetPack(events, options = {}) {
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

export function createFakeTargetCapability(id, options = {}) {
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
    ...(options.sourceProfileDeclarations === undefined
      ? {}
      : {
          sourceProfileContributions(context) {
            options.events?.push(`capability-source-profile:${id}:target=${context.target.id}:capabilities=${context.selectedCapabilities.map((capability) => capability.id).join(",")}`);
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
        capabilityNamespace: `test.${id}`,
      },
      initialize(context) {
        context.registerTargetBindingProvider(createFakeVirtualBindingProvider(id, moduleOwnership, options.events));
      },
    },
  });
}

export function createFakeVirtualBindingProvider(id, moduleOwnership, events) {
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
