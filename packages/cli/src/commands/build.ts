/**
 * tsonic build command - Build executable or library
 */

import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import type { ResolvedConfig, Result } from "../types.js";
import { generateCommand } from "./generate.js";
import { resolveNugetConfigFile } from "../dotnet/nuget-config.js";

/**
 * Build native executable
 */
const buildExecutable = (
  config: ResolvedConfig,
  generatedDir: string
): Result<{ outputPath: string }, string> => {
  const { outputName, rid, quiet, verbose } = config;

  const nugetConfigResult = resolveNugetConfigFile(config.projectRoot);
  if (!nugetConfigResult.ok) return nugetConfigResult;

  // Run dotnet publish
  const publishArgs = [
    "publish",
    "tsonic.csproj",
    "-c",
    "Release",
    "-r",
    rid,
    "--nologo",
    "--configfile",
    nugetConfigResult.value,
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

  // Copy output binary
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

    // Copy the entire publish output so native/runtime dependencies (e.g. SQLite)
    // are available alongside the executable. This keeps `./out/<app>` runnable.
    const publishEntries = readdirSync(publishDir, { withFileTypes: true });
    for (const entry of publishEntries) {
      // When stripSymbols is enabled, avoid copying NativeAOT .dbg sidecar files.
      if (config.stripSymbols && entry.name.endsWith(".dbg")) continue;

      const src = join(publishDir, entry.name);
      const dst = join(outDir, entry.name);
      cpSync(src, dst, { recursive: entry.isDirectory(), force: true });
    }

    // Make executable on Unix
    if (process.platform !== "win32") {
      chmodSync(targetBinary, 0o755);
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

  const nugetConfigResult = resolveNugetConfigFile(config.projectRoot);
  if (!nugetConfigResult.ok) return nugetConfigResult;

  // Run dotnet build
  const buildArgs = [
    "build",
    "tsonic.csproj",
    "-c",
    "Release",
    "--nologo",
    "--configfile",
    nugetConfigResult.value,
  ];

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

  // Copy output library artifacts
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
  const { outputDirectory } = config;
  const outputType = config.outputConfig.type ?? "executable";

  // Emit C# code
  const generateResult = generateCommand(config);
  if (!generateResult.ok) {
    return generateResult;
  }

  const generatedDir = generateResult.value.outputDir;
  const csprojPath = join(generatedDir, "tsonic.csproj");

  if (!existsSync(csprojPath)) {
    return {
      ok: false,
      error: `No tsonic.csproj found in ${outputDirectory}/. This should have been created by generate.`,
    };
  }

  // Dispatch to appropriate build function
  if (outputType === "library") {
    return buildLibrary(config, generatedDir);
  } else {
    return buildExecutable(config, generatedDir);
  }
};
