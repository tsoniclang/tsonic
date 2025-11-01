/**
 * tsonic build command - Build executable
 */

import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";
import { copyFileSync, chmodSync, existsSync } from "node:fs";
import type { ResolvedConfig, Result } from "../types.js";
import { emitCommand } from "./emit.js";

/**
 * Build native executable
 */
export const buildCommand = (
  config: ResolvedConfig
): Result<{ outputPath: string }, string> => {
  const { outputDirectory, outputName, rid, quiet, verbose } = config;

  // Step 1: Emit C# code
  if (!quiet) {
    console.log("Step 1/3: Generating C# code...");
  }

  const emitResult = emitCommand(config);
  if (!emitResult.ok) {
    return emitResult;
  }

  const generatedDir = emitResult.value.outputDir;
  const csprojPath = join(generatedDir, "tsonic.csproj");

  if (!existsSync(csprojPath)) {
    return {
      ok: false,
      error: `No tsonic.csproj found in ${outputDirectory}/. This should have been created by emit.`,
    };
  }

  // Step 2: Run dotnet publish
  if (!quiet) {
    console.log("Step 2/3: Compiling with dotnet publish...");
  }

  const publishArgs = [
    "publish",
    "tsonic.csproj",
    "-c",
    "Release",
    "-r",
    rid,
    "--nologo",
  ];

  if (quiet) {
    publishArgs.push("--verbosity", "quiet");
  } else if (verbose) {
    publishArgs.push("--verbosity", "detailed");
  } else {
    publishArgs.push("--verbosity", "minimal");
  }

  const publishResult = spawnSync("dotnet", publishArgs, {
    cwd: generatedDir,
    stdio: verbose ? "inherit" : "pipe",
    encoding: "utf-8",
  });

  if (publishResult.status !== 0) {
    const errorMsg =
      publishResult.stderr || publishResult.stdout || "Unknown error";
    return {
      ok: false,
      error: `dotnet publish failed:\n${errorMsg}`,
    };
  }

  // Step 3: Copy output binary
  if (!quiet) {
    console.log("Step 3/3: Copying output binary...");
  }

  const binaryName =
    process.platform === "win32" ? `${outputName}.exe` : outputName;
  const publishDir = join(
    generatedDir,
    "bin",
    "Release",
    "net9.0",
    rid,
    "publish"
  );
  const sourceBinary = join(publishDir, binaryName);
  const targetBinary = join(process.cwd(), binaryName);

  if (!existsSync(sourceBinary)) {
    return {
      ok: false,
      error: `Built binary not found at ${sourceBinary}`,
    };
  }

  try {
    copyFileSync(sourceBinary, targetBinary);

    // Make executable on Unix
    if (process.platform !== "win32") {
      chmodSync(targetBinary, 0o755);
    }

    if (!quiet) {
      const relativePath = relative(process.cwd(), targetBinary);
      console.log(`\n✓ Build complete: ${relativePath}`);
    }

    return {
      ok: true,
      value: { outputPath: targetBinary },
    };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to copy binary: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
