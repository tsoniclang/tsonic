import {
  copyFileSync,
  existsSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, posix, relative, resolve } from "node:path";
import {
  buildModuleDependencyGraph,
  type CompilerOptions,
  type Diagnostic,
  type IrModule,
} from "@tsonic/frontend";
import { emitCSharpFiles } from "@tsonic/emitter";
import {
  generateCsproj,
  generateProgramCs,
  type BuildConfig,
  type ConsoleAppConfig,
  type ExecutableConfig,
  type LibraryConfig,
} from "@tsonic/backend";
import type { ResolvedConfig, Result } from "../../types.js";
import { findMainEntryInfo, hasTopLevelExecutableStatements } from "./entry.js";
import {
  collectProjectLibraries,
  dedupePackageReferencesAgainstAssemblyReferences,
  findProjectCsproj,
  findRuntimeProjectReferencePath,
  findRuntimeDlls,
  toGeneratedRelativePath,
} from "./helpers.js";
import {
  collectTransitiveDllLocalPackageReferences,
  getDllModeLocalPackageReferences,
  getLocalPackageIdFromModulePath,
  resolveLocalPackageBuildReferences,
} from "../local-package-references.js";

const normalizeResolvedFilePath = (filePath: string): string =>
  resolve(filePath).replace(/\\/g, "/");

const canonicalResolvedFilePath = (filePath: string): string => {
  const resolved =
    typeof realpathSync.native === "function"
      ? realpathSync.native(filePath)
      : realpathSync(filePath);
  return resolved.replace(/\\/g, "/");
};

const buildResolvedModuleIndex = (
  modules: readonly IrModule[],
  absoluteSourceRoot: string,
  workspaceRoot: string
): ReadonlyMap<string, IrModule> => {
  const index = new Map<string, IrModule>();

  const register = (candidatePath: string, module: IrModule): void => {
    if (!existsSync(candidatePath)) {
      return;
    }

    const normalizedPath = normalizeResolvedFilePath(candidatePath);
    if (!index.has(normalizedPath)) {
      index.set(normalizedPath, module);
    }

    const canonicalPath = canonicalResolvedFilePath(candidatePath);
    if (!index.has(canonicalPath)) {
      index.set(canonicalPath, module);
    }
  };

  for (const module of modules) {
    if (module.filePath.startsWith("__tsonic/")) {
      continue;
    }

    if (module.filePath.startsWith("node_modules/")) {
      register(resolve(workspaceRoot, module.filePath), module);
      continue;
    }

    register(resolve(absoluteSourceRoot, module.filePath), module);
  }

  return index;
};

const buildLogicalModuleIndex = (
  modules: readonly IrModule[]
): ReadonlyMap<string, IrModule> =>
  new Map(modules.map((module) => [module.filePath, module] as const));

const resolveReexportTargetModule = (
  currentModule: IrModule,
  fromModule: string,
  logicalModuleIndex: ReadonlyMap<string, IrModule>
): IrModule | undefined => {
  if (!fromModule.startsWith(".")) {
    return undefined;
  }

  const logicalBaseDir = posix.dirname(currentModule.filePath);
  const normalizedSpecifier = posix.normalize(posix.join(logicalBaseDir, fromModule));
  const logicalCandidates = new Set<string>([normalizedSpecifier]);

  if (normalizedSpecifier.endsWith(".js")) {
    logicalCandidates.add(normalizedSpecifier.slice(0, -3) + ".ts");
  } else if (!normalizedSpecifier.endsWith(".ts")) {
    logicalCandidates.add(normalizedSpecifier + ".ts");
  }

  for (const candidate of logicalCandidates) {
    const targetModule = logicalModuleIndex.get(candidate);
    if (targetModule) {
      return targetModule;
    }
  }

  return undefined;
};

const collectEmittedSourceClosure = (
  modules: readonly IrModule[],
  absoluteSourceRoot: string,
  workspaceRoot: string,
  dllModePackageIds: ReadonlySet<string>
): readonly IrModule[] => {
  if (dllModePackageIds.size === 0) {
    return modules;
  }

  const resolvedModuleIndex = buildResolvedModuleIndex(
    modules,
    absoluteSourceRoot,
    workspaceRoot
  );
  const logicalModuleIndex = buildLogicalModuleIndex(modules);
  const visitedModulePaths = new Set<string>();
  const queue = modules.filter(
    (module) =>
      !module.filePath.startsWith("__tsonic/") &&
      !module.filePath.startsWith("node_modules/")
  );

  while (queue.length > 0) {
    const currentModule = queue.pop();
    if (!currentModule) {
      continue;
    }

    if (visitedModulePaths.has(currentModule.filePath)) {
      continue;
    }
    visitedModulePaths.add(currentModule.filePath);

    for (const imp of currentModule.imports) {
      if (!imp.isLocal || !imp.resolvedPath) {
        continue;
      }

      const targetModule =
        resolvedModuleIndex.get(normalizeResolvedFilePath(imp.resolvedPath)) ??
        resolvedModuleIndex.get(canonicalResolvedFilePath(imp.resolvedPath));
      if (!targetModule) {
        continue;
      }

      const packageId = getLocalPackageIdFromModulePath(targetModule.filePath);
      if (packageId && dllModePackageIds.has(packageId)) {
        continue;
      }

      queue.push(targetModule);
    }

    for (const exp of currentModule.exports) {
      if (exp.kind !== "reexport") {
        continue;
      }

      const targetModule = resolveReexportTargetModule(
        currentModule,
        exp.fromModule,
        logicalModuleIndex
      );
      if (!targetModule) {
        continue;
      }

      const packageId = getLocalPackageIdFromModulePath(targetModule.filePath);
      if (packageId && dllModePackageIds.has(packageId)) {
        continue;
      }

      queue.push(targetModule);
    }
  }

  return modules.filter(
    (module) =>
      module.filePath.startsWith("__tsonic/") ||
      visitedModulePaths.has(module.filePath)
  );
};

const SYNTHETIC_ANONYMOUS_TYPES_FILE_PATH =
  "__tsonic/__tsonic_anonymous_types.g.ts";

const collectReferencedAnonymousTypeNames = (
  value: unknown,
  referencedNames: Set<string>,
  seen: WeakSet<object>
): void => {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectReferencedAnonymousTypeNames(entry, referencedNames, seen);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  const candidate = value as {
    readonly kind?: unknown;
    readonly name?: unknown;
  };
  if (
    candidate.kind === "referenceType" &&
    typeof candidate.name === "string" &&
    candidate.name.startsWith("__Anon_")
  ) {
    referencedNames.add(candidate.name);
  }

  for (const nested of Object.values(value)) {
    collectReferencedAnonymousTypeNames(nested, referencedNames, seen);
  }
};

const pruneSyntheticAnonymousModules = (
  modules: readonly IrModule[]
): readonly IrModule[] => {
  const syntheticModule = modules.find(
    (module) => module.filePath === SYNTHETIC_ANONYMOUS_TYPES_FILE_PATH
  );
  if (!syntheticModule) {
    return modules;
  }

  const referencedNames = new Set<string>();
  const seen = new WeakSet<object>();
  for (const module of modules) {
    if (module.filePath === SYNTHETIC_ANONYMOUS_TYPES_FILE_PATH) {
      continue;
    }
    collectReferencedAnonymousTypeNames(module, referencedNames, seen);
  }

  if (referencedNames.size === 0) {
    return modules.filter(
      (module) => module.filePath !== SYNTHETIC_ANONYMOUS_TYPES_FILE_PATH
    );
  }

  const declarationByName = new Map(
    syntheticModule.body.flatMap((statement) =>
      "name" in statement && typeof statement.name === "string"
        ? [[statement.name, statement] as const]
        : []
    )
  );
  const queue = Array.from(referencedNames);
  while (queue.length > 0) {
    const name = queue.shift();
    if (!name) {
      continue;
    }
    const declaration = declarationByName.get(name);
    if (!declaration) {
      continue;
    }
    const nestedNames = new Set<string>();
    collectReferencedAnonymousTypeNames(
      declaration,
      nestedNames,
      new WeakSet<object>()
    );
    for (const nestedName of nestedNames) {
      if (referencedNames.has(nestedName)) {
        continue;
      }
      referencedNames.add(nestedName);
      queue.push(nestedName);
    }
  }

  const prunedSyntheticModule: IrModule = {
    ...syntheticModule,
    body: syntheticModule.body.filter(
      (statement) =>
        !("name" in statement) ||
        typeof statement.name !== "string" ||
        referencedNames.has(statement.name)
    ),
  };

  if (prunedSyntheticModule.body.length === 0) {
    return modules.filter(
      (module) => module.filePath !== SYNTHETIC_ANONYMOUS_TYPES_FILE_PATH
    );
  }

  return modules.map((module) =>
    module.filePath === SYNTHETIC_ANONYMOUS_TYPES_FILE_PATH
      ? prunedSyntheticModule
      : module
  );
};

export const generateCommand = (
  config: ResolvedConfig
): Result<{ filesGenerated: number; outputDir: string }, string> => {
  const {
    entryPoint,
    outputDirectory,
    rootNamespace,
    workspaceRoot,
    projectRoot,
    sourceRoot,
    typeRoots,
    frameworkReferences,
    packageReferences,
  } = config;

  if (!entryPoint && config.outputConfig.type !== "library") {
    return {
      ok: false,
      error: "Entry point is required for executable builds",
    };
  }

  try {
    const outputType = config.outputConfig.type ?? "executable";
    if (!entryPoint) {
      return {
        ok: false,
        error:
          "Entry point is required (library multi-file support coming soon)",
      };
    }

    const absoluteEntryPoint = isAbsolute(entryPoint)
      ? entryPoint
      : resolve(projectRoot, entryPoint);
    const absoluteSourceRoot = isAbsolute(sourceRoot)
      ? sourceRoot
      : resolve(projectRoot, sourceRoot);
    const localPackageReferencesResult = resolveLocalPackageBuildReferences(
      config
    );
    if (!localPackageReferencesResult.ok) {
      return localPackageReferencesResult;
    }
    const directDllLocalPackageReferences = getDllModeLocalPackageReferences(
      localPackageReferencesResult.value
    );
    const transitiveDllLocalPackageReferencesResult =
      collectTransitiveDllLocalPackageReferences(config);
    if (!transitiveDllLocalPackageReferencesResult.ok) {
      return transitiveDllLocalPackageReferencesResult;
    }
    const transitiveDllLocalPackageReferences =
      transitiveDllLocalPackageReferencesResult.value;
    const dllLibraries = [
      ...config.libraries.filter((pathLike) => pathLike.toLowerCase().endsWith(".dll")),
      ...transitiveDllLocalPackageReferences.map((entry) => entry.dllPath),
    ];
    const missingDlls = dllLibraries.filter((pathLike) => {
      const absolutePath = isAbsolute(pathLike)
        ? pathLike
        : resolve(workspaceRoot, pathLike);
      return !existsSync(absolutePath);
    });
    if (missingDlls.length > 0) {
      const details = missingDlls.map((pathLike) => `- ${pathLike}`).join("\n");
      return {
        ok: false,
        error:
          `Missing DLLs referenced by 'dotnet.libraries' / '--lib' / 'references.packages':\n` +
          `${details}\n` +
          `Ensure these DLLs exist or build the referenced local package first.`,
      };
    }

    const typeLibraries = config.libraries.filter(
      (lib) => !lib.endsWith(".dll")
    );
    const allTypeRoots = [...typeRoots, ...typeLibraries].map((pathLike) =>
      isAbsolute(pathLike) ? pathLike : resolve(workspaceRoot, pathLike)
    );
    const compilerOptions: CompilerOptions = {
      projectRoot,
      sourceRoot: absoluteSourceRoot,
      rootNamespace,
      typeRoots: allTypeRoots,
      surface: config.surface,
      verbose: config.verbose,
    };
    const graphResult = buildModuleDependencyGraph(
      absoluteEntryPoint,
      compilerOptions
    );
    if (!graphResult.ok) {
      const errorMessages = graphResult.error
        .map((diagnostic: Diagnostic) => {
          const prefix = `${diagnostic.code} `;
          if (diagnostic.location) {
            return `${diagnostic.location.file}:${diagnostic.location.line} ${prefix}${diagnostic.message}`;
          }
          return `${prefix}${diagnostic.message}`;
        })
        .join("\n");
      return {
        ok: false,
        error: `TypeScript compilation failed:\n${errorMessages}`,
      };
    }

    const { modules, entryModule, bindings } = graphResult.value;
    const dllModePackageIds = new Set(
      directDllLocalPackageReferences.map((entry) => entry.id)
    );
    const emittedModules = collectEmittedSourceClosure(
      modules,
      absoluteSourceRoot,
      workspaceRoot,
      dllModePackageIds
    );
    const prunedEmittedModules = pruneSyntheticAnonymousModules(emittedModules);

    const emitResult = emitCSharpFiles(prunedEmittedModules, {
      surface: config.surface,
      rootNamespace,
      entryPointPath: absoluteEntryPoint,
      libraries: typeLibraries,
      referenceModules: modules,
      clrBindings: bindings,
      bindingRegistry: graphResult.value.bindingRegistry,
      enableJsonAot: config.outputConfig.nativeAot ?? false,
    });
    if (!emitResult.ok) {
      for (const error of emitResult.errors) {
        console.error(`error ${error.code}: ${error.message}`);
      }
      process.exit(1);
    }

    const outputDir = resolve(projectRoot, outputDirectory);
    const outputRel = relative(projectRoot, outputDir);
    if (!outputRel || outputRel.startsWith("..") || isAbsolute(outputRel)) {
      return {
        ok: false,
        error: `Refusing to write output outside project root. outputDirectory='${outputDirectory}' resolved to '${outputDir}'.`,
      };
    }

    rmSync(outputDir, { recursive: true, force: true });
    mkdirSync(outputDir, { recursive: true });

    for (const [modulePath, csCode] of emitResult.files) {
      const fullPath = join(outputDir, toGeneratedRelativePath(modulePath));
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, csCode, "utf-8");
    }

    if (outputType !== "library") {
      const entryRelative = relative(
        absoluteSourceRoot,
        absoluteEntryPoint
      ).replace(/\\/g, "/");
      const foundEntryModule =
        prunedEmittedModules.find(
          (module: IrModule) => module.filePath === entryRelative
        ) ??
        entryModule;
      if (foundEntryModule) {
        const hasTopLevelCode =
          hasTopLevelExecutableStatements(foundEntryModule);
        const mainExport = findMainEntryInfo(foundEntryModule);
        if (mainExport && hasTopLevelCode) {
          return {
            ok: false,
            error:
              "Entry point module exports main() and also contains top-level executable statements. Remove the top-level code or remove the main export to make program startup deterministic.",
          };
        }

        const entryInfo =
          mainExport ??
          (hasTopLevelCode
            ? {
                namespace: foundEntryModule.namespace,
                className: foundEntryModule.className,
                methodName: "__TopLevel",
                isAsync: false,
                needsProgram: true,
              }
            : null);

        if (!entryInfo) {
          return {
            ok: false,
            error:
              "Entry point module must either export main() or contain top-level executable statements.",
          };
        }
        writeFileSync(
          join(outputDir, "Program.cs"),
          generateProgramCs(entryInfo),
          "utf-8"
        );
      }
    }

    const csprojPath = join(outputDir, "tsonic.csproj");
    const projectCsproj = findProjectCsproj(projectRoot);
    if (projectCsproj) {
      copyFileSync(projectCsproj, csprojPath);
    } else {
      const runtimePath = findRuntimeProjectReferencePath();

      const assemblyReferences = runtimePath
        ? []
        : [
            ...findRuntimeDlls(outputDir),
            ...collectProjectLibraries(
              workspaceRoot,
              outputDir,
              [
                ...config.libraries,
                ...transitiveDllLocalPackageReferences.map(
                  (entry) => entry.dllPath
                ),
              ]
            ),
          ];
      const effectivePackageReferences =
        dedupePackageReferencesAgainstAssemblyReferences(
          packageReferences,
          assemblyReferences
        );

      const outputConfig: ExecutableConfig | LibraryConfig | ConsoleAppConfig =
        outputType === "library"
          ? {
              type: "library",
              targetFrameworks: config.outputConfig.targetFrameworks ?? [
                config.dotnetVersion,
              ],
              nativeAot: config.outputConfig.nativeAot ?? false,
              nativeLib: config.outputConfig.nativeLib,
              generateDocumentation:
                config.outputConfig.generateDocumentation ?? true,
              includeSymbols: config.outputConfig.includeSymbols ?? true,
              packable: config.outputConfig.packable ?? false,
              packageMetadata: config.outputConfig.package,
            }
          : outputType === "console-app"
            ? {
                type: "console-app",
                targetFramework:
                  config.outputConfig.targetFramework ?? config.dotnetVersion,
                singleFile: config.outputConfig.singleFile ?? true,
                selfContained: config.outputConfig.selfContained ?? true,
              }
            : {
                type: "executable",
                nativeAot: config.outputConfig.nativeAot ?? true,
                singleFile: config.outputConfig.singleFile ?? true,
                trimmed: config.outputConfig.trimmed ?? true,
                stripSymbols: config.stripSymbols,
                optimization: config.optimize === "size" ? "Size" : "Speed",
                invariantGlobalization: config.invariantGlobalization,
                selfContained: config.outputConfig.selfContained ?? true,
              };

      const buildConfig: BuildConfig = {
        rootNamespace,
        outputName: config.outputName,
        dotnetVersion: config.dotnetVersion,
        runtimePath,
        assemblyReferences,
        frameworkReferences,
        packageReferences: effectivePackageReferences,
        msbuildProperties: config.msbuildProperties,
        outputConfig,
      };
      writeFileSync(csprojPath, generateCsproj(buildConfig), "utf-8");
    }

    return {
      ok: true,
      value: { filesGenerated: emitResult.files.size, outputDir },
    };
  } catch (error) {
    const details =
      error instanceof Error
        ? config.verbose && error.stack
          ? error.stack
          : error.message
        : String(error);
    return { ok: false, error: `Emit failed: ${details}` };
  }
};
