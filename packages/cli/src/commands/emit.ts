/**
 * tsonic emit command - Generate C# code only
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import {
  compile,
  buildIr,
  type Diagnostic,
  type IrModule,
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
    // Parse TypeScript - use entry point or all files in sourceRoot
    const entryFiles = entryPoint
      ? [entryPoint]
      : [join(sourceRoot, "**/*.ts")];
    const compileResult = compile(entryFiles, {
      sourceRoot,
      rootNamespace,
      typeRoots,
    });
    if (!compileResult.ok) {
      return {
        ok: false,
        error: `TypeScript compilation failed:\n${compileResult.error.diagnostics.map((d: Diagnostic) => d.message).join("\n")}`,
      };
    }

    // Build IR
    const irResult = buildIr(compileResult.value.program, {
      sourceRoot,
      rootNamespace,
    });

    if (!irResult.ok) {
      return {
        ok: false,
        error: `IR build failed:\n${irResult.error.map((d: Diagnostic) => d.message).join("\n")}`,
      };
    }

    // Emit C# code
    const absoluteEntryPoint = entryPoint ? resolve(entryPoint) : undefined;
    const csFiles = emitCSharpFiles(irResult.value, {
      rootNamespace,
      entryPointPath: absoluteEntryPoint,
      libraries: config.libraries,
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
      const entryModule = irResult.value.find(
        (m) => resolve(m.filePath) === absoluteEntryPoint
      );

      if (entryModule) {
        const entryInfo = extractEntryInfo(entryModule);
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

    // Generate or preserve tsonic.csproj
    const csprojPath = join(outputDir, "tsonic.csproj");
    if (!existsSync(csprojPath)) {
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
