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
  createTargetSourceCompilerComposition,
  parseTsonicProjectConfig,
} from "../../../packages/host/dist/index.js";
import {
  createTargetRegistry,
} from "../../../packages/target-api/dist/public/index.js";
import {
  targetSourceProfileDeclaration,
} from "../../../packages/target-api/dist/public/provider.js";
import {
  defineExtensionFactKey,
  providerVirtualDeclarationFactKey,
  TstsSourceProviderContractVersion,
} from "@tsonic/tsts";
export { assert, access, mkdir, readFile, writeFile, dirname, resolve, test, collectTstsDiagnostics, collectTargetSourceProfileContributions, compileTargetFromSemanticSession, compileProject, createProgramOptionsForProject, createTsonicSemanticSession, createTargetSourceCompilerComposition, parseTsonicProjectConfig, createTargetRegistry, targetSourceProfileDeclaration, providerVirtualDeclarationFactKey, TstsSourceProviderContractVersion };

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
    projectDirectory,
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
    ...(options.includeProvider === false
      ? {}
      : {
          provider: {
            id: "demo-provider",
            displayName: "Demo Provider",
            ...((options.providerModuleOwnership ?? []).length > 0 ? { moduleOwnership: options.providerModuleOwnership } : {}),
            sourceCompilerContributions(context) {
              events.push(`provider:${context.target.id}:surfaces=${context.selectedSurfaces.map((surface) => surface.id).join(",")}`);
              return options.targetExtension === undefined
                ? {}
                : { extensions: [options.targetExtension] };
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
    kind: "target-capability",
    id,
    targetId: "demo",
    displayName: `${id} Target Capability`,
    ...((options.requiredSurfaces ?? []).length > 0 ? { requiredSurfaces: options.requiredSurfaces } : {}),
    ...((options.requiredCapabilities ?? []).length > 0 ? { requiredCapabilities: options.requiredCapabilities } : {}),
    moduleOwnership: options.moduleOwnership ?? [],
    sourceCompilerContributions(context) {
      options.events?.push(`capability-extension:${id}:target=${context.target.id}:capabilities=${context.selectedCapabilities.map((capability) => capability.id).join(",")}`);
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
            options.events?.push(`surface-extension:${id}:target=${context.target.id}:surfaces=${context.selectedSurfaces.map((surface) => surface.id).join(",")}`);
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
