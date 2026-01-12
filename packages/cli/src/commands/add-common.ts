/**
 * Shared utilities for `tsonic add ...` commands.
 *
 * These commands must be airplane-grade:
 * - Deterministic dependency closure resolution (no "copy everything" modes)
 * - Fail fast with actionable messages when requirements aren't met
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { Result, TsonicConfig } from "../types.js";

export type AddCommandOptions = {
  readonly verbose?: boolean;
  readonly quiet?: boolean;
  readonly deps?: readonly string[];
  /**
   * Strict bindings generation. When true, tsbindgen is invoked without any
   * relaxation flags (including constructor constraint loss).
   */
  readonly strict?: boolean;
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
      error: `Failed to write config: ${error instanceof Error ? error.message : String(error)}`,
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

const findNearestPackageRoot = (resolvedFilePath: string): string | null => {
  let currentDir = dirname(resolvedFilePath);

  for (;;) {
    if (existsSync(join(currentDir, "package.json"))) return currentDir;
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) return null;
    currentDir = parentDir;
  }
};

export const resolveTsbindgenDllPath = (
  projectRoot: string
): Result<string, string> => {
  const tryResolve = (req: ReturnType<typeof createRequire>): string | null => {
    try {
      // Node 24+ respects `exports` and may disallow deep imports like
      // "@tsonic/tsbindgen/package.json". Resolve the public entrypoint and
      // locate the nearest package root on disk.
      const entryPath = req.resolve("@tsonic/tsbindgen");
      const pkgRoot = findNearestPackageRoot(entryPath);
      if (!pkgRoot) return null;
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

export const resolvePackageRoot = (
  projectRoot: string,
  packageName: string
): Result<string, string> => {
  const projectPkgJson = join(projectRoot, "package.json");
  const req = createRequire(
    existsSync(projectPkgJson)
      ? projectPkgJson
      : join(projectRoot, "__tsonic_require__.js")
  );

  try {
    const pkgJson = req.resolve(`${packageName}/package.json`);
    return { ok: true, value: dirname(pkgJson) };
  } catch (error) {
    try {
      const entryPath = req.resolve(packageName);
      const pkgRoot = findNearestPackageRoot(entryPath);
      if (pkgRoot) return { ok: true, value: pkgRoot };
    } catch {
      // ignore - fall through to user-friendly error below
    }

    return {
      ok: false,
      error:
        `Missing ${packageName} in node_modules.\n` +
        `Install it (recommended: 'tsonic project init') and retry.\n` +
        `${error instanceof Error ? error.message : String(error)}`,
    };
  }
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
          tsonic: { generated: true },
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

export type GeneratedBindingsKind = "framework" | "nuget" | "dll";

export const bindingsStoreDir = (
  projectRoot: string,
  kind: GeneratedBindingsKind,
  packageName: string
): string => join(projectRoot, ".tsonic", "bindings", kind, packageName);

export const ensureGeneratedBindingsPackageJson = (
  dir: string,
  packageName: string,
  meta: { readonly kind: GeneratedBindingsKind; readonly source: Record<string, unknown> }
): Result<void, string> => {
  const pkgJsonPath = join(dir, "package.json");

  if (existsSync(pkgJsonPath)) {
    try {
      const parsed = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as Record<string, unknown>;
      if (parsed.name !== packageName) {
        return {
          ok: false,
          error:
            `Refusing to reuse existing bindings package with a different name.\n` +
            `Expected: ${packageName}\n` +
            `Found: ${String(parsed.name)}`,
        };
      }

      const tsonic = (parsed.tsonic ?? {}) as Record<string, unknown>;
      if (tsonic.generated !== true) {
        return {
          ok: false,
          error:
            `Refusing to overwrite non-generated package.json at ${pkgJsonPath}.\n` +
            `Move it aside or delete the directory and retry.`,
        };
      }

      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: `Failed to parse existing package.json at ${pkgJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

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
          tsonic: { generated: true, ...meta },
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

export const installGeneratedBindingsPackage = (
  projectRoot: string,
  packageName: string,
  fromDir: string
): Result<void, string> => {
  const nodeModulesDir = join(projectRoot, "node_modules");
  mkdirSync(nodeModulesDir, { recursive: true });

  const targetDir = join(nodeModulesDir, packageName);
  if (existsSync(targetDir)) {
    // Airplane-grade: only overwrite packages we generated.
    const pkgJsonPath = join(targetDir, "package.json");
    if (!existsSync(pkgJsonPath)) {
      return {
        ok: false,
        error:
          `Refusing to overwrite existing directory without package.json: ${targetDir}\n` +
          `Rename/remove it and retry.`,
      };
    }
    try {
      const parsed = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as Record<string, unknown>;
      const tsonic = (parsed.tsonic ?? {}) as Record<string, unknown>;
      if (tsonic.generated !== true) {
        return {
          ok: false,
          error:
            `Refusing to overwrite existing npm package '${packageName}' in node_modules.\n` +
            `Delete ${targetDir} if you intended to replace it.`,
        };
      }
    } catch (error) {
      return {
        ok: false,
        error: `Failed to parse ${pkgJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    rmSync(targetDir, { recursive: true, force: true });
  }

  mkdirSync(dirname(targetDir), { recursive: true });
  cpSync(fromDir, targetDir, { recursive: true, force: true });
  return { ok: true, value: undefined };
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
    readonly references?: ReadonlyArray<{
      readonly name: string;
      readonly publicKeyToken: string;
      readonly culture: string;
      readonly version: string;
    }>;
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
  const policyArgs: string[] = [];

  // Airplane-grade default:
  // Allow *only* constructor constraint loss (C# still enforces constraints at build time).
  // Users can opt into full strictness via `--strict`.
  if (!options.strict) {
    policyArgs.push("--allow-constructor-constraint-loss");
  }

  const result = exec(
    "dotnet",
    [tsbindgenDllPath, "generate", ...policyArgs, ...args],
    projectRoot,
    options.verbose ? "inherit" : "pipe"
  );
  if (result.status !== 0) {
    const msg = result.stderr || result.stdout || "Unknown error";
    return { ok: false, error: `tsbindgen generate failed:\n${msg}` };
  }
  return { ok: true, value: undefined };
};
