/**
 * tsonic emit command - Generate C# code only
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { compile, buildIr, type Diagnostic } from "@tsonic/frontend";
import { emitCSharpFiles } from "@tsonic/emitter";
import { generateCsproj } from "@tsonic/backend";
import type { ResolvedConfig, Result } from "../types.js";

/**
 * Emit C# code from TypeScript
 */
export const emitCommand = (
  config: ResolvedConfig
): Result<{ filesGenerated: number; outputDir: string }, string> => {
  const { entryPoint, outputDirectory, rootNamespace, sourceRoot, packages } =
    config;

  if (!config.quiet) {
    console.log(`Emitting C# code for ${entryPoint}...`);
  }

  try {
    // Parse TypeScript
    const compileResult = compile([entryPoint], {
      sourceRoot,
      rootNamespace,
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
    const csFiles = emitCSharpFiles(irResult.value, { rootNamespace });

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

    // Generate or preserve tsonic.csproj
    const csprojPath = join(outputDir, "tsonic.csproj");
    if (!existsSync(csprojPath)) {
      const csproj = generateCsproj({
        rootNamespace,
        outputName: config.outputName,
        packages,
        invariantGlobalization: config.invariantGlobalization,
        stripSymbols: config.stripSymbols,
        optimizationPreference: config.optimize === "size" ? "Size" : "Speed",
      });
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
