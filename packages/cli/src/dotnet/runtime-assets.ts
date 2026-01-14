import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Result } from "../types.js";

export type RuntimeDllCopyOptions = {
  readonly includeJsRuntime?: boolean;
  readonly includeNodejs?: boolean;
};

export const findCliRuntimeDir = (): string | null => {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Monorepo/dev: <repoRoot>/packages/cli/src/dotnet -> <repoRoot>/packages/cli/runtime
    join(moduleDir, "../../runtime"),
    // npm installed: <pkgRoot>/dist/dotnet -> <pkgRoot>/runtime
    join(moduleDir, "../runtime"),
    // When CLI is a dev dependency in the project (process.cwd() is project root)
    join(process.cwd(), "node_modules/@tsonic/cli/runtime"),
    // Monorepo structure when invoked from repo root
    join(process.cwd(), "packages/cli/runtime"),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  return null;
};

export const copyRuntimeDllsToProjectLib = (
  projectRoot: string,
  options: RuntimeDllCopyOptions = {}
): Result<readonly string[], string> => {
  const runtimeDir = findCliRuntimeDir();
  if (!runtimeDir) {
    return {
      ok: false,
      error: "Runtime directory not found. Make sure 'tsonic' is installed.",
    };
  }

  const libDir = join(projectRoot, "lib");
  mkdirSync(libDir, { recursive: true });

  const includeJsRuntime = options.includeJsRuntime === true;
  const includeNodejs = options.includeNodejs === true;

  const requiredDlls = [
    "Tsonic.Runtime.dll",
    ...(includeJsRuntime || includeNodejs ? ["Tsonic.JSRuntime.dll"] : []),
    ...(includeNodejs ? ["nodejs.dll"] : []),
  ] as const;

  const copiedPaths: string[] = [];
  for (const dllName of requiredDlls) {
    const sourcePath = join(runtimeDir, dllName);
    if (!existsSync(sourcePath)) {
      return {
        ok: false,
        error: `${dllName} not found in runtime directory.`,
      };
    }

    copyFileSync(sourcePath, join(libDir, dllName));
    copiedPaths.push(`lib/${dllName}`);
  }

  return { ok: true, value: copiedPaths };
};

