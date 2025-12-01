/**
 * tsonic build command - Build executable or library
 */

import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";
import { copyFileSync, chmodSync, existsSync, mkdirSync } from "node:fs";
import type { ResolvedConfig, Result } from "../types.js";
import { emitCommand } from "./emit.js";

/**
 * Build native executable
 */
const buildExecutable = (
  config: ResolvedConfig,
  generatedDir: string
): Result<{ outputPath: string }, string> => {
  const { outputName, rid, quiet, verbose } = config;

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
    config.dotnetVersion,
    rid,
    "publish"
  );
  const sourceBinary = join(publishDir, binaryName);
  const outDir = join(process.cwd(), "out");
  const targetBinary = join(outDir, binaryName);

  if (!existsSync(sourceBinary)) {
    return {
      ok: false,
      error: `Built binary not found at ${sourceBinary}`,
    };
  }

  try {
    // Create out/ directory if it doesn't exist
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }
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

/**
 * Build library
 */
const buildLibrary = (
  config: ResolvedConfig,
  generatedDir: string
): Result<{ outputPath: string }, string> => {
  const { outputName, quiet, verbose } = config;
  const targetFrameworks = config.outputConfig.targetFrameworks ?? [
    config.dotnetVersion,
  ];

  // Step 2: Run dotnet build
  if (!quiet) {
    console.log("Step 2/3: Compiling library with dotnet build...");
  }

  const buildArgs = ["build", "tsonic.csproj", "-c", "Release", "--nologo"];

  if (quiet) {
    buildArgs.push("--verbosity", "quiet");
  } else if (verbose) {
    buildArgs.push("--verbosity", "detailed");
  } else {
    buildArgs.push("--verbosity", "minimal");
  }

  const buildResult = spawnSync("dotnet", buildArgs, {
    cwd: generatedDir,
    stdio: verbose ? "inherit" : "pipe",
    encoding: "utf-8",
  });

  if (buildResult.status !== 0) {
    const errorMsg =
      buildResult.stderr || buildResult.stdout || "Unknown error";
    return {
      ok: false,
      error: `dotnet build failed:\n${errorMsg}`,
    };
  }

  // Step 3: Copy output library artifacts
  if (!quiet) {
    console.log("Step 3/3: Copying library artifacts...");
  }

  const outputDir = join(process.cwd(), "dist");

  try {
    // Create output directory
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Copy artifacts for each target framework
    const copiedFiles: string[] = [];

    for (const framework of targetFrameworks) {
      const buildDir = join(generatedDir, "bin", "Release", framework);

      if (!existsSync(buildDir)) {
        continue;
      }

      const frameworkOutputDir = join(outputDir, framework);
      if (!existsSync(frameworkOutputDir)) {
        mkdirSync(frameworkOutputDir, { recursive: true });
      }

      // Copy .dll
      const dllSource = join(buildDir, `${outputName}.dll`);
      if (existsSync(dllSource)) {
        const dllTarget = join(frameworkOutputDir, `${outputName}.dll`);
        copyFileSync(dllSource, dllTarget);
        copiedFiles.push(relative(process.cwd(), dllTarget));
      }

      // Copy .xml (documentation)
      const xmlSource = join(buildDir, `${outputName}.xml`);
      if (existsSync(xmlSource)) {
        const xmlTarget = join(frameworkOutputDir, `${outputName}.xml`);
        copyFileSync(xmlSource, xmlTarget);
        copiedFiles.push(relative(process.cwd(), xmlTarget));
      }

      // Copy .pdb (symbols)
      const pdbSource = join(buildDir, `${outputName}.pdb`);
      if (existsSync(pdbSource)) {
        const pdbTarget = join(frameworkOutputDir, `${outputName}.pdb`);
        copyFileSync(pdbSource, pdbTarget);
        copiedFiles.push(relative(process.cwd(), pdbTarget));
      }
    }

    if (copiedFiles.length === 0) {
      return {
        ok: false,
        error: "No library artifacts found to copy",
      };
    }

    if (!quiet) {
      console.log(`\n✓ Build complete. Artifacts copied to dist/:`);
      for (const file of copiedFiles) {
        console.log(`  - ${file}`);
      }
    }

    return {
      ok: true,
      value: { outputPath: outputDir },
    };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to copy library artifacts: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Main build command - dispatches to executable or library build
 */
export const buildCommand = (
  config: ResolvedConfig
): Result<{ outputPath: string }, string> => {
  const { outputDirectory, quiet } = config;
  const outputType = config.outputConfig.type ?? "executable";

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

  // Dispatch to appropriate build function
  if (outputType === "library") {
    return buildLibrary(config, generatedDir);
  } else {
    return buildExecutable(config, generatedDir);
  }
};
