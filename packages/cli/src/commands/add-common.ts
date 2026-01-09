/**
 * Shared utilities for `tsonic add ...` commands.
 *
 * These commands must be airplane-grade:
 * - Deterministic dependency closure resolution (no "copy everything" modes)
 * - Fail fast with actionable messages when requirements aren't met
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { Result, TsonicConfig } from "../types.js";

export type AddCommandOptions = {
  readonly verbose?: boolean;
  readonly quiet?: boolean;
  readonly deps?: readonly string[];
};

export type TsbindgenNaming = "js" | "clr";

export type ExecResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

export type Exec = (
  command: string,
  args: readonly string[],
  cwd: string,
  stdio: "inherit" | "pipe"
) => ExecResult;

export const defaultExec: Exec = (command, args, cwd, stdio) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio,
    encoding: "utf-8",
  });

  return {
    status: result.status,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
  };
};

export const readTsonicJson = (
  projectRoot: string
): Result<{ path: string; config: TsonicConfig }, string> => {
  const configPath = join(projectRoot, "tsonic.json");
  if (!existsSync(configPath)) {
    return { ok: false, error: `tsonic.json not found in ${projectRoot}` };
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content) as TsonicConfig;
    return { ok: true, value: { path: configPath, config: parsed } };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse tsonic.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export const writeTsonicJson = (
  configPath: string,
  config: TsonicConfig
): Result<void, string> => {
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to write tsonic.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export const resolveFromProjectRoot = (
  projectRoot: string,
  pathLike: string
): string => {
  return isAbsolute(pathLike) ? pathLike : resolve(projectRoot, pathLike);
};

export const normalizeNpmName = (raw: string): string => {
  const cleaned = raw
    .trim()
    .replace(/\.dll$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return cleaned.length > 0 ? cleaned : "bindings";
};

export const defaultBindingsPackageNameForDll = (dllPath: string): string => {
  const dllName = basename(dllPath);
  const base = dllName.replace(/\.dll$/i, "");
  return `${normalizeNpmName(base)}-types`;
};

export const defaultBindingsPackageNameForNuget = (
  packageId: string
): string => {
  return `${normalizeNpmName(packageId)}-types`;
};

export const defaultBindingsPackageNameForFramework = (
  frameworkRef: string
): string => {
  return `${normalizeNpmName(frameworkRef)}-types`;
};

export const npmInstallDevDependency = (
  projectRoot: string,
  packageSpec: string,
  options: AddCommandOptions,
  exec: Exec = defaultExec
): Result<void, string> => {
  const args = ["install", "--save-dev", packageSpec];
  if (options.quiet) args.push("--silent");

  const result = exec(
    "npm",
    args,
    projectRoot,
    options.verbose ? "inherit" : "pipe"
  );
  if (result.status !== 0) {
    const errorMsg = result.stderr || result.stdout || "Unknown error";
    return { ok: false, error: `npm install failed:\n${errorMsg}` };
  }

  return { ok: true, value: undefined };
};

export const detectTsbindgenNaming = (config: TsonicConfig): TsbindgenNaming => {
  const typeRoots = config.dotnet?.typeRoots;
  if (!typeRoots) return "js";
  return typeRoots.some((p) => p.includes("@tsonic/globals-pure")) ? "clr" : "js";
};

export const resolveTsbindgenDllPath = (
  projectRoot: string
): Result<string, string> => {
  const tryResolve = (req: ReturnType<typeof createRequire>): string | null => {
    try {
      const pkgJson = req.resolve("@tsonic/tsbindgen/package.json");
      const pkgRoot = dirname(pkgJson);
      const dllPath = join(pkgRoot, "lib", "tsbindgen.dll");
      return existsSync(dllPath) ? dllPath : null;
    } catch {
      return null;
    }
  };

  const projectPkgJson = join(projectRoot, "package.json");
  const projectReq = existsSync(projectPkgJson)
    ? createRequire(projectPkgJson)
    : null;

  const selfReq = createRequire(import.meta.url);

  const direct =
    (projectReq ? tryResolve(projectReq) : null) ?? tryResolve(selfReq);
  if (direct) return { ok: true, value: direct };

  // Development fallback: sibling checkout next to the tsonic repo.
  const here = fileURLToPath(import.meta.url);
  // <repoRoot>/packages/cli/src/commands/add-common.ts
  const repoRoot = resolve(join(dirname(here), "../../../.."));
  const sibling = resolve(join(repoRoot, "..", "tsbindgen"));
  const siblingDll = join(sibling, "lib", "tsbindgen.dll");
  if (existsSync(siblingDll)) return { ok: true, value: siblingDll };

  return {
    ok: false,
    error:
      "tsbindgen not found. Install '@tsonic/tsbindgen' (recommended) or ensure it is available in node_modules.",
  };
};

export type DotnetRuntime = {
  readonly name: string;
  readonly version: string;
  readonly dir: string;
};

export const listDotnetRuntimes = (
  cwd: string,
  exec: Exec = defaultExec
): Result<readonly DotnetRuntime[], string> => {
  const result = exec("dotnet", ["--list-runtimes"], cwd, "pipe");
  if (result.status !== 0) {
    const msg = result.stderr || result.stdout || "Unknown error";
    return { ok: false, error: `dotnet --list-runtimes failed:\n${msg}` };
  }

  const lines = result.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const entries: DotnetRuntime[] = [];
  for (const line of lines) {
    // Example:
    // Microsoft.NETCore.App 10.0.1 [/home/user/.dotnet/shared/Microsoft.NETCore.App]
    const match = line.match(/^(\S+)\s+(\S+)\s+\[(.+)\]$/);
    if (!match) continue;
    const [, name, version, baseDir] = match;
    if (!name || !version || !baseDir) continue;
    entries.push({ name, version, dir: join(baseDir, version) });
  }

  // Pick highest version per runtime name (lexicographic is not enough).
  const byName = new Map<string, DotnetRuntime>();
  const parseVer = (v: string): number[] =>
    v.split(".").map((p) => Number.parseInt(p, 10)).map((n) => (Number.isFinite(n) ? n : 0));
  const cmp = (a: string, b: string): number => {
    const av = parseVer(a);
    const bv = parseVer(b);
    const len = Math.max(av.length, bv.length);
    for (let i = 0; i < len; i++) {
      const d = (av[i] ?? 0) - (bv[i] ?? 0);
      if (d !== 0) return d;
    }
    return 0;
  };

  for (const e of entries) {
    const existing = byName.get(e.name);
    if (!existing || cmp(existing.version, e.version) < 0) {
      byName.set(e.name, e);
    }
  }

  return { ok: true, value: Array.from(byName.values()) };
};

export const ensurePackageJson = (
  dir: string,
  packageName: string
): Result<void, string> => {
  const pkgJsonPath = join(dir, "package.json");
  if (existsSync(pkgJsonPath)) return { ok: true, value: undefined };

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      pkgJsonPath,
      JSON.stringify(
        {
          name: packageName,
          version: "0.0.0",
          private: true,
          type: "module",
        },
        null,
        2
      ) + "\n",
      "utf-8"
    );
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to write bindings package.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export type TsbindgenClosureOutput = {
  readonly seeds: readonly string[];
  readonly referenceDirectories: readonly string[];
  readonly resolvedAssemblies: ReadonlyArray<{
    readonly name: string;
    readonly publicKeyToken: string;
    readonly culture: string;
    readonly version: string;
    readonly path: string;
  }>;
  readonly diagnostics: ReadonlyArray<{
    readonly code: string;
    readonly severity: "Info" | "Warning" | "Error";
    readonly message: string;
    readonly location?: string;
  }>;
};

export const tsbindgenResolveClosure = (
  projectRoot: string,
  tsbindgenDllPath: string,
  seeds: readonly string[],
  refDirs: readonly string[],
  exec: Exec = defaultExec
): Result<TsbindgenClosureOutput, string> => {
  const args: string[] = [tsbindgenDllPath, "resolve-closure"];

  for (const seed of seeds) {
    args.push("-a", seed);
  }
  for (const dir of refDirs) {
    args.push("--ref-dir", dir);
  }
  args.push("--strict-versions");

  const result = exec("dotnet", args, projectRoot, "pipe");
  if (result.status !== 0 && !result.stdout.trim()) {
    const msg = result.stderr || "Unknown error";
    return { ok: false, error: `tsbindgen resolve-closure failed:\n${msg}` };
  }

  try {
    const parsed = JSON.parse(result.stdout) as TsbindgenClosureOutput;
    return { ok: true, value: parsed };
  } catch (error) {
    const msg = result.stderr || result.stdout || "Unknown error";
    return {
      ok: false,
      error: `Failed to parse tsbindgen closure JSON:\n${msg}\n${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export const tsbindgenGenerate = (
  projectRoot: string,
  tsbindgenDllPath: string,
  args: readonly string[],
  options: AddCommandOptions,
  exec: Exec = defaultExec
): Result<void, string> => {
  const result = exec(
    "dotnet",
    [tsbindgenDllPath, "generate", ...args],
    projectRoot,
    options.verbose ? "inherit" : "pipe"
  );
  if (result.status !== 0) {
    const msg = result.stderr || result.stdout || "Unknown error";
    return { ok: false, error: `tsbindgen generate failed:\n${msg}` };
  }
  return { ok: true, value: undefined };
};
