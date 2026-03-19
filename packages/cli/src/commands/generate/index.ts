import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
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
import { resolveSurfaceCapabilities } from "../../surface/profiles.js";
import { findMainEntryInfo, hasTopLevelExecutableStatements } from "./entry.js";
import {
  collectProjectLibraries,
  dedupePackageReferencesAgainstAssemblyReferences,
  findProjectCsproj,
  findRuntimeProjectReferencePath,
  findRuntimeDlls,
  toGeneratedRelativePath,
} from "./helpers.js";

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
  const surfaceCapabilities = resolveSurfaceCapabilities(config.surface, {
    workspaceRoot,
  });

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
    const dllLibraries = config.libraries.filter((pathLike) =>
      pathLike.toLowerCase().endsWith(".dll")
    );
    const missingDlls = dllLibraries.filter(
      (pathLike) => !existsSync(resolve(workspaceRoot, pathLike))
    );
    if (missingDlls.length > 0) {
      const details = missingDlls.map((pathLike) => `- ${pathLike}`).join("\n");
      return {
        ok: false,
        error:
          `Missing DLLs referenced by 'dotnet.libraries' / '--lib':\n` +
          `${details}\n` +
          `Ensure these DLLs exist or re-run the appropriate 'tsonic add ...' command.`,
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
      useStandardLib: surfaceCapabilities.useStandardLib,
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
    const emitResult = emitCSharpFiles(modules, {
      surface: config.surface,
      rootNamespace,
      entryPointPath: absoluteEntryPoint,
      libraries: typeLibraries,
      clrBindings: bindings,
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
        modules.find((module: IrModule) => module.filePath === entryRelative) ??
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
              config.libraries
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
