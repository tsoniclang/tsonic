import { writeFileSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type {
  Result,
  TsonicProjectConfig,
  TsonicWorkspaceConfig,
} from "../../types.js";
import { buildDotnetProcessEnv } from "../../dotnet/nuget-config.js";

export type AddCommandOptions = {
  readonly verbose?: boolean;
  readonly quiet?: boolean;
  readonly deps?: readonly string[];
  readonly skipInstallIfPresent?: boolean;
  readonly strict?: boolean;
};

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
    env: command === "dotnet" ? buildDotnetProcessEnv(cwd) : process.env,
  });

  return {
    status: result.status,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
  };
};

export const writeTsonicJson = (
  configPath: string,
  config: TsonicWorkspaceConfig | TsonicProjectConfig
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
  const args = [
    "install",
    "--save-dev",
    packageSpec,
    "--no-fund",
    "--no-audit",
  ];
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
