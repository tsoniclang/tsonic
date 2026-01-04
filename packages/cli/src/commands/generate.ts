/**
 * tsonic generate command - Generate C# code only
 */

import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import {
  buildModuleDependencyGraph,
  type Diagnostic,
  type IrModule,
  type CompilerOptions,
} from "@tsonic/frontend";
import { emitCSharpFiles } from "@tsonic/emitter";
import {
  generateCsproj,
  generateProgramCs,
  type EntryInfo,
  type BuildConfig,
  type ExecutableConfig,
  type LibraryConfig,
  type AssemblyReference,
} from "@tsonic/backend";
import type { ResolvedConfig, Result } from "../types.js";

/**
 * Find project .csproj file in current directory
 */
const findProjectCsproj = (): string | null => {
  const cwd = process.cwd();
  const files = readdirSync(cwd);
  const csprojFile = files.find((f) => f.endsWith(".csproj"));
  return csprojFile ? join(cwd, csprojFile) : null;
};

/**
 * Collect all CLR assemblies used by modules
 * Returns unique assembly names from module imports
 */
const collectClrAssemblies = (modules: readonly IrModule[]): Set<string> => {
  const assemblies = new Set<string>();
  for (const mod of modules) {
    for (const imp of mod.imports) {
      if (imp.isClr && imp.resolvedAssembly) {
        assemblies.add(imp.resolvedAssembly);
      }
    }
  }
  return assemblies;
};

/**
 * Find a specific DLL, checking project's lib/ first, then CLI package runtime
 * Returns the absolute path to the DLL or null if not found
 */
const findDll = (dllName: string): string | null => {
  // 1. First check project's lib/ directory (created by tsonic init)
  const projectLibPath = join(process.cwd(), "lib", dllName);
  if (existsSync(projectLibPath)) {
    return projectLibPath;
  }

  // 2. Fall back to CLI package runtime directory
  const cliRuntimePaths = [
    // Development: From dist/commands -> ../../runtime
    join(import.meta.dirname, "../../runtime"),
    // npm installed: From dist/commands -> ../runtime (inside @tsonic/cli package)
    join(import.meta.dirname, "../runtime"),
    // From project's node_modules (when CLI is a dev dependency)
    join(process.cwd(), "node_modules/@tsonic/cli/runtime"),
  ];

  for (const runtimeDir of cliRuntimePaths) {
    const dllPath = join(runtimeDir, dllName);
    if (existsSync(dllPath)) {
      return dllPath;
    }
  }

  return null;
};

/**
 * Find runtime DLLs for the project
 * Checks project's lib/ directory first, then falls back to CLI package
 * Returns assembly references for the csproj file
 */
const findRuntimeDlls = (
  outputDir: string,
  usedAssemblies: Set<string> = new Set()
): readonly AssemblyReference[] => {
  const refs: AssemblyReference[] = [];

  // Always include Tsonic.Runtime
  const runtimeDll = findDll("Tsonic.Runtime.dll");
  if (runtimeDll) {
    refs.push({
      name: "Tsonic.Runtime",
      hintPath: relative(outputDir, runtimeDll),
    });
  }

  // Include nodejs.dll if nodejs assembly is used
  if (usedAssemblies.has("nodejs")) {
    const nodejsDll = findDll("nodejs.dll");
    if (nodejsDll) {
      refs.push({
        name: "nodejs",
        hintPath: relative(outputDir, nodejsDll),
      });
    }
  }

  // Include Tsonic.JSRuntime.dll if JS runtime types are used
  if (usedAssemblies.has("Tsonic.JSRuntime")) {
    const jsRuntimeDll = findDll("Tsonic.JSRuntime.dll");
    if (jsRuntimeDll) {
      refs.push({
        name: "Tsonic.JSRuntime",
        hintPath: relative(outputDir, jsRuntimeDll),
      });
    }
  }

  return refs;
};

/**
 * Collect assembly references from project libraries (lib/*.dll)
 * These are DLLs registered in tsonic.json's dotnet.libraries
 */
const collectProjectLibraries = (
  projectRoot: string,
  outputDir: string,
  libraries: readonly string[]
): readonly AssemblyReference[] => {
  const refs: AssemblyReference[] = [];

  for (const libPath of libraries) {
    // Library path is relative to project root
    const absolutePath = join(projectRoot, libPath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    if (!libPath.endsWith(".dll")) {
      continue;
    }

    // Extract assembly name from filename
    const dllName = libPath.split("/").pop() ?? "";
    const assemblyName = dllName.replace(/\.dll$/, "");

    // Calculate relative path from output directory to the DLL
    const hintPath = relative(outputDir, absolutePath);

    refs.push({
      name: assemblyName,
      hintPath,
    });
  }

  return refs;
};

/**
 * Extract entry point information from IR module
 */
const extractEntryInfo = (entryModule: IrModule): EntryInfo | null => {
  // Look for exported 'main' function
  for (const exp of entryModule.exports) {
    if (exp.kind === "declaration") {
      const decl = exp.declaration;
      if (decl.kind === "functionDeclaration" && decl.name === "main") {
        return {
          namespace: entryModule.namespace,
          className: entryModule.className,
          methodName: "main",
          isAsync: decl.isAsync,
          needsProgram: true,
        };
      }
    } else if (exp.kind === "named" && exp.name === "main") {
      // Named export of 'main'
      // Look in body for the function declaration
      for (const stmt of entryModule.body) {
        if (stmt.kind === "functionDeclaration" && stmt.name === "main") {
          return {
            namespace: entryModule.namespace,
            className: entryModule.className,
            methodName: "main",
            isAsync: stmt.isAsync,
            needsProgram: true,
          };
        }
      }
    }
  }

  // No main function found
  return null;
};

/**
 * Emit C# code from TypeScript
 */
export const generateCommand = (
  config: ResolvedConfig
): Result<{ filesGenerated: number; outputDir: string }, string> => {
  const {
    entryPoint,
    outputDirectory,
    rootNamespace,
    projectRoot,
    sourceRoot,
    typeRoots,
  } = config;

  // For libraries, entry point is optional
  if (!entryPoint && config.outputConfig.type !== "library") {
    return {
      ok: false,
      error: "Entry point is required for executable builds",
    };
  }

  try {
    // For libraries without entry point, we need a different approach
    // For now, require entry point (library multi-file support can be added later)
    if (!entryPoint) {
      return {
        ok: false,
        error:
          "Entry point is required (library multi-file support coming soon)",
      };
    }

    // Combine typeRoots and non-DLL libraries for TypeScript compilation
    // DLL paths (*.dll) are for assembly references, not type roots
    const typeLibraries = config.libraries.filter(
      (lib) => !lib.endsWith(".dll")
    );
    const allTypeRoots = [...typeRoots, ...typeLibraries];

    // Build dependency graph - this traverses all imports and builds IR for all modules
    const compilerOptions: CompilerOptions = {
      projectRoot,
      sourceRoot,
      rootNamespace,
      typeRoots: allTypeRoots,
      verbose: config.verbose,
    };
    const graphResult = buildModuleDependencyGraph(entryPoint, compilerOptions);

    if (!graphResult.ok) {
      const errorMessages = graphResult.error
        .map((d: Diagnostic) => {
          if (d.location) {
            return `${d.location.file}:${d.location.line} ${d.message}`;
          }
          return d.message;
        })
        .join("\n");
      return {
        ok: false,
        error: `TypeScript compilation failed:\n${errorMessages}`,
      };
    }

    const { modules, entryModule, bindings } = graphResult.value;

    // irResult.value was an array of modules, now it's graphResult.value.modules
    const irResult = { ok: true as const, value: modules };

    // Emit C# code
    const absoluteEntryPoint = entryPoint ? resolve(entryPoint) : undefined;
    const emitResult = emitCSharpFiles(irResult.value, {
      rootNamespace,
      entryPointPath: absoluteEntryPoint,
      libraries: typeLibraries, // Only non-DLL libraries (type roots)
      clrBindings: bindings, // Pass bindings from frontend for Action/Func resolution
    });

    if (!emitResult.ok) {
      // Handle file name collision errors
      for (const error of emitResult.errors) {
        console.error(`error ${error.code}: ${error.message}`);
      }
      process.exit(1);
    }

    const csFiles = emitResult.files;

    // Create output directory
    const outputDir = join(process.cwd(), outputDirectory);
    mkdirSync(outputDir, { recursive: true });

    // Write C# files preserving directory structure
    for (const [modulePath, csCode] of csFiles) {
      // Convert module path to C# file path
      // src/models/User.ts → generated/src/models/User.cs
      const csPath = modulePath.replace(/\.ts$/, ".cs");
      const fullPath = join(outputDir, csPath);

      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, csCode, "utf-8");
    }

    // Generate Program.cs entry point wrapper (only for executables)
    if (absoluteEntryPoint) {
      // entryModule is already provided by buildDependencyGraph
      // But double-check by comparing relative paths
      const entryRelative = relative(sourceRoot, absoluteEntryPoint).replace(
        /\\/g,
        "/"
      );
      const foundEntryModule =
        irResult.value.find((m: IrModule) => m.filePath === entryRelative) ??
        entryModule;

      if (foundEntryModule) {
        const entryInfo = extractEntryInfo(foundEntryModule);
        if (entryInfo) {
          const programCs = generateProgramCs(entryInfo);
          const programPath = join(outputDir, "Program.cs");
          writeFileSync(programPath, programCs, "utf-8");
        }
      }
    }

    // Generate or copy existing .csproj
    const csprojPath = join(outputDir, "tsonic.csproj");
    const projectCsproj = findProjectCsproj();

    // Collect CLR assemblies used by the modules (e.g., "nodejs")
    const usedAssemblies = collectClrAssemblies(irResult.value);

    // Debug: log collected assemblies
    if (config.verbose && usedAssemblies.size > 0) {
      console.log(`  CLR assemblies used: ${[...usedAssemblies].join(", ")}`);
    }

    if (projectCsproj) {
      // Copy existing .csproj from project root (preserves user edits)
      copyFileSync(projectCsproj, csprojPath);
    } else {
      // Always regenerate tsonic.csproj for generated output (unless the user
      // provides a project .csproj at the project root). This keeps runtime and
      // library references in sync across repeated builds.

      // Find Tsonic runtime - try multiple approaches:
      // 1. ProjectReference to .csproj (development/monorepo)
      // 2. Assembly references to DLLs (npm installed package)
      const runtimePath = (() => {
        // 1. Try monorepo structure (development) - ProjectReference
        const monorepoPath = resolve(
          join(import.meta.dirname, "../../../runtime/src/Tsonic.Runtime.csproj")
        );
        if (existsSync(monorepoPath)) {
          return monorepoPath;
        }

        // 2. Try installed package structure - ProjectReference
        const installedPath = resolve(
          join(
            import.meta.dirname,
            "../../../../@tsonic/runtime/src/Tsonic.Runtime.csproj"
          )
        );
        if (existsSync(installedPath)) {
          return installedPath;
        }

        return undefined;
      })();

      const assemblyReferences = runtimePath
        ? []
        : [
            ...findRuntimeDlls(outputDir, usedAssemblies),
            ...collectProjectLibraries(projectRoot, outputDir, config.libraries),
          ];

      // Build output configuration
      const outputType = config.outputConfig.type ?? "executable";
      const outputConfig: ExecutableConfig | LibraryConfig =
        outputType === "library"
          ? {
              type: "library",
              targetFrameworks: config.outputConfig.targetFrameworks ?? [
                config.dotnetVersion,
              ],
              generateDocumentation:
                config.outputConfig.generateDocumentation ?? true,
              includeSymbols: config.outputConfig.includeSymbols ?? true,
              packable: config.outputConfig.packable ?? false,
              packageMetadata: config.outputConfig.package,
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
        outputConfig,
      };

      const csproj = generateCsproj(buildConfig);
      writeFileSync(csprojPath, csproj, "utf-8");
    }

    return {
      ok: true,
      value: {
        filesGenerated: csFiles.size,
        outputDir,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: `Emit failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
