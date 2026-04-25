import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { ResolvedConfig, Result } from "../../types.js";
import {
  buildDotnetProcessEnv,
  resolveNugetConfigFile,
} from "../../dotnet/nuget-config.js";
import { assertNoOutputAssemblyNameConflicts } from "./assets.js";

const DOTNET_PUBLISH_MAX_BUFFER = 64 * 1024 * 1024;

export const buildExecutable = (
  config: ResolvedConfig,
  generatedDir: string,
  referencedAssemblyPaths: readonly string[]
): Result<{ outputPath: string }, string> => {
  const { outputName, rid, quiet, verbose, workspaceRoot } = config;
  const nugetConfigResult = resolveNugetConfigFile(workspaceRoot);
  if (!nugetConfigResult.ok) return nugetConfigResult;

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
    env: buildDotnetProcessEnv(workspaceRoot),
    maxBuffer: DOTNET_PUBLISH_MAX_BUFFER,
  });
  if (publishResult.error) {
    return {
      ok: false,
      error: `dotnet publish failed:\n${publishResult.error.message}`,
    };
  }
  if (publishResult.status !== 0) {
    const errorMsg = publishResult.stderr || publishResult.stdout || "Unknown error";
    return { ok: false, error: `dotnet publish failed:\n${errorMsg}` };
  }

  const conflictResult = assertNoOutputAssemblyNameConflicts(
    generatedDir,
    outputName,
    [...config.libraries, ...referencedAssemblyPaths]
  );
  if (!conflictResult.ok) return conflictResult;

  const binaryName = process.platform === "win32" ? `${outputName}.exe` : outputName;
  const publishDir = join(
    generatedDir,
    "bin",
    "Release",
    config.dotnetVersion,
    rid,
    "publish"
  );
  const sourceBinary = join(publishDir, binaryName);
  const outDir = join(config.projectRoot, "out");
  const targetBinary = join(outDir, binaryName);

  if (!existsSync(sourceBinary)) {
    return { ok: false, error: `Built binary not found at ${sourceBinary}` };
  }

  try {
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });

    const publishEntries = readdirSync(publishDir, { withFileTypes: true });
    for (const entry of publishEntries) {
      if (config.stripSymbols && entry.name.endsWith(".dbg")) continue;
      const src = join(publishDir, entry.name);
      const dst = join(outDir, entry.name);
      cpSync(src, dst, { recursive: entry.isDirectory(), force: true });
    }

    if (process.platform !== "win32") {
      chmodSync(targetBinary, 0o755);
    }
    return { ok: true, value: { outputPath: targetBinary } };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to copy binary: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
