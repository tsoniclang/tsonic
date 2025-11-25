/**
 * tsonic emit command - Generate C# code only
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
 * Extract entry point information from IR module
 */
const extractEntryInfo = (
  entryModule: IrModule,
  runtime?: "js" | "dotnet"
): EntryInfo | null => {
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
          runtime,
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
            runtime,
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
export const emitCommand = (
  config: ResolvedConfig
): Result<{ filesGenerated: number; outputDir: string }, string> => {
  const {
    entryPoint,
    outputDirectory,
    rootNamespace,
    sourceRoot,
    packages,
    typeRoots,
  } = config;

  // For libraries, entry point is optional
  if (!entryPoint && config.outputConfig.type !== "library") {
    return {
      ok: false,
      error: "Entry point is required for executable builds",
    };
  }

  if (!config.quiet) {
    const target = entryPoint ?? sourceRoot;
    console.log(`Emitting C# code for ${target}...`);
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

    // Combine typeRoots and libraries for TypeScript compilation
    const allTypeRoots = [...typeRoots, ...config.libraries];

    // Build dependency graph - this traverses all imports and builds IR for all modules
    const compilerOptions: CompilerOptions = {
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

    const { modules, entryModule } = graphResult.value;

    if (config.verbose) {
      console.log(`  Discovered ${modules.length} TypeScript modules`);
      for (const module of modules) {
        console.log(`    - ${module.filePath}`);
      }
    }

    // irResult.value was an array of modules, now it's graphResult.value.modules
    const irResult = { ok: true as const, value: modules };

    // Emit C# code
    const absoluteEntryPoint = entryPoint ? resolve(entryPoint) : undefined;
    const csFiles = emitCSharpFiles(irResult.value, {
      rootNamespace,
      entryPointPath: absoluteEntryPoint,
      libraries: config.libraries,
      runtime: config.runtime,
    });

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

      if (config.verbose) {
        const relPath = relative(process.cwd(), fullPath);
        console.log(`  Generated: ${relPath}`);
      }
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
        const entryInfo = extractEntryInfo(foundEntryModule, config.runtime);
        if (entryInfo) {
          const programCs = generateProgramCs(entryInfo);
          const programPath = join(outputDir, "Program.cs");
          writeFileSync(programPath, programCs, "utf-8");

          if (config.verbose) {
            console.log(`  Generated: ${relative(process.cwd(), programPath)}`);
          }
        }
      }
    }

    // Generate or copy existing .csproj
    const csprojPath = join(outputDir, "tsonic.csproj");
    const projectCsproj = findProjectCsproj();

    if (projectCsproj) {
      // Copy existing .csproj from project root (preserves user edits)
      copyFileSync(projectCsproj, csprojPath);

      if (config.verbose) {
        console.log(
          `  Copied: ${relative(process.cwd(), projectCsproj)} → ${relative(process.cwd(), csprojPath)} (user edits preserved)`
        );
      }
    } else if (!existsSync(csprojPath)) {
      // Find Tsonic.Runtime.csproj path - try multiple locations
      let runtimePath: string | undefined;

      // 1. Try monorepo structure (development)
      const monorepoPath = resolve(
        join(import.meta.dirname, "../../../runtime/src/Tsonic.Runtime.csproj")
      );
      if (existsSync(monorepoPath)) {
        runtimePath = monorepoPath;
      } else {
        // 2. Try installed package structure
        const installedPath = resolve(
          join(
            import.meta.dirname,
            "../../../../@tsonic/runtime/src/Tsonic.Runtime.csproj"
          )
        );
        if (existsSync(installedPath)) {
          runtimePath = installedPath;
        }
      }

      // Warn if no runtime found
      if (!runtimePath && !config.quiet) {
        console.warn(
          "Warning: Tsonic.Runtime.csproj not found. You may need to add a reference manually."
        );
      }

      // Build output configuration
      const outputType = config.outputConfig.type ?? "executable";
      let outputConfig: ExecutableConfig | LibraryConfig;

      if (outputType === "library") {
        outputConfig = {
          type: "library",
          targetFrameworks: config.outputConfig.targetFrameworks ?? [
            config.dotnetVersion,
          ],
          generateDocumentation:
            config.outputConfig.generateDocumentation ?? true,
          includeSymbols: config.outputConfig.includeSymbols ?? true,
          packable: config.outputConfig.packable ?? false,
          packageMetadata: config.outputConfig.package,
        };
      } else {
        outputConfig = {
          type: "executable",
          nativeAot: config.outputConfig.nativeAot ?? true,
          singleFile: config.outputConfig.singleFile ?? true,
          trimmed: config.outputConfig.trimmed ?? true,
          stripSymbols: config.stripSymbols,
          optimization: config.optimize === "size" ? "Size" : "Speed",
          invariantGlobalization: config.invariantGlobalization,
          selfContained: config.outputConfig.selfContained ?? true,
        };
      }

      const buildConfig: BuildConfig = {
        rootNamespace,
        outputName: config.outputName,
        dotnetVersion: config.dotnetVersion,
        runtimePath,
        packages,
        outputConfig,
      };

      const csproj = generateCsproj(buildConfig);
      writeFileSync(csprojPath, csproj, "utf-8");

      if (config.verbose) {
        console.log(`  Generated: ${relative(process.cwd(), csprojPath)}`);
      }
    } else if (config.verbose) {
      console.log(
        `  Preserved: ${relative(process.cwd(), csprojPath)} (user edits kept)`
      );
    }

    if (!config.quiet) {
      console.log(
        `\n✓ Generated ${csFiles.size} C# files in ${outputDirectory}/`
      );
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
