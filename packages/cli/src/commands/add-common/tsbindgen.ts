import type { Result } from "../../types.js";
import {
  defaultExec,
  type AddCommandOptions,
  type Exec,
} from "./shared.js";

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
