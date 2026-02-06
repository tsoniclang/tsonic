/**
 * tsonic test command - Generate a non-NativeAOT test assembly and run `dotnet test`.
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { ResolvedConfig, Result } from "../types.js";
import { resolveNugetConfigFile } from "../dotnet/nuget-config.js";
import { generateCommand } from "./generate.js";

export const testCommand = (
  config: ResolvedConfig
): Result<{ exitCode: number }, string> => {
  const generateResult = generateCommand(config);
  if (!generateResult.ok) return generateResult;

  const generatedDir = generateResult.value.outputDir;

  const nugetConfigResult = resolveNugetConfigFile(config.workspaceRoot);
  if (!nugetConfigResult.ok) return nugetConfigResult;

  const restoreArgs = [
    "restore",
    "tsonic.csproj",
    "--nologo",
    "--configfile",
    nugetConfigResult.value,
  ];
  const testArgs = [
    "test",
    "tsonic.csproj",
    "--no-restore",
    "-c",
    "Release",
    "--nologo",
  ];

  const verbosity =
    config.quiet ? "quiet" : config.verbose ? "detailed" : "minimal";
  restoreArgs.push("--verbosity", verbosity);
  testArgs.push("--verbosity", verbosity);

  const restoreResult = spawnSync("dotnet", restoreArgs, {
    cwd: generatedDir,
    stdio: config.verbose ? "inherit" : "pipe",
    encoding: "utf-8",
  });
  if (restoreResult.status !== 0) {
    const msg = restoreResult.stderr || restoreResult.stdout || "Unknown error";
    return { ok: false, error: `dotnet restore failed:\n${msg}` };
  }

  const testResult = spawnSync("dotnet", testArgs, {
    cwd: generatedDir,
    stdio: config.verbose ? "inherit" : "pipe",
    encoding: "utf-8",
  });

  if (testResult.status !== 0) {
    const msg = testResult.stderr || testResult.stdout || "Unknown error";
    return { ok: false, error: `dotnet test failed:\n${msg}` };
  }

  return {
    ok: true,
    value: { exitCode: 0 },
  };
};

