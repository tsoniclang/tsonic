/**
 * Dotnet CLI wrapper for executing build commands
 */

import { spawnSync } from "child_process";
import { DotnetResult } from "./types.js";

/**
 * Check if dotnet CLI is available
 */
export const checkDotnetInstalled = (): DotnetResult => {
  const result = spawnSync("dotnet", ["--version"], {
    encoding: "utf-8",
  });

  if (result.error) {
    return {
      ok: false,
      error: ".NET SDK not found. Install from https://dot.net",
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      error: "dotnet command failed",
      stderr: result.stderr,
    };
  }

  return {
    ok: true,
    stdout: result.stdout.trim(),
  };
};

/**
 * Detect runtime identifier for current platform
 */
export const detectRid = (): string => {
  const platform = process.platform;
  const arch = process.arch;

  const ridMap: Record<string, string> = {
    "darwin-x64": "osx-x64",
    "darwin-arm64": "osx-arm64",
    "linux-x64": "linux-x64",
    "linux-arm64": "linux-arm64",
    "win32-x64": "win-x64",
    "win32-arm64": "win-arm64",
  };

  const key = `${platform}-${arch}`;
  return ridMap[key] || "linux-x64";
};

/**
 * Execute dotnet publish with NativeAOT
 */
export const publishNativeAot = (
  buildDir: string,
  rid: string
): DotnetResult => {
  const args = [
    "publish",
    "tsonic.csproj",
    "-c",
    "Release",
    "-r",
    rid,
    "-p:PublishAot=true",
    "-p:PublishSingleFile=true",
    "--self-contained",
  ];

  const result = spawnSync("dotnet", args, {
    cwd: buildDir,
    encoding: "utf-8",
  });

  if (result.error) {
    return {
      ok: false,
      error: `Failed to execute dotnet: ${result.error.message}`,
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      error: `dotnet publish failed with code ${result.status}`,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  return {
    ok: true,
    stdout: result.stdout,
  };
};
