import type { FrameworkReferenceConfig, Result } from "../../types.js";
import {
  bindingsStoreDir,
  defaultBindingsPackageNameForFramework,
  ensureGeneratedBindingsPackageJson,
  installGeneratedBindingsPackage,
  resolveFromProjectRoot,
  tsbindgenGenerate,
  type AddCommandOptions,
  type DotnetRuntime,
} from "../add-common.js";

type GenerateFrameworkBindingsOptions = {
  readonly frameworkReferences: readonly FrameworkReferenceConfig[];
  readonly runtimes: readonly DotnetRuntime[];
  readonly workspaceRoot: string;
  readonly dotnetLib: string;
  readonly tsbindgenDll: string;
  readonly options: AddCommandOptions;
};

export const generateFrameworkBindings = ({
  frameworkReferences,
  runtimes,
  workspaceRoot,
  dotnetLib,
  tsbindgenDll,
  options,
}: GenerateFrameworkBindingsOptions): Result<void, string> => {
  for (const entry of frameworkReferences) {
    const frameworkRef = typeof entry === "string" ? entry : entry.id;
    const typesPackage = typeof entry === "string" ? undefined : entry.types;
    if (typesPackage !== undefined) continue;

    const runtime = runtimes.find(
      (candidate) => candidate.name === frameworkRef
    );
    if (!runtime) {
      const available = runtimes
        .map((candidate) => `${candidate.name} ${candidate.version}`)
        .join("\n");
      return {
        ok: false,
        error:
          `Framework runtime not found: ${frameworkRef}\n` +
          `Installed runtimes:\n${available}`,
      };
    }

    const packageName = defaultBindingsPackageNameForFramework(frameworkRef);
    const outDir = bindingsStoreDir(workspaceRoot, "framework", packageName);
    const pkgJsonResult = ensureGeneratedBindingsPackageJson(
      outDir,
      packageName,
      {
        kind: "framework",
        source: { frameworkReference: frameworkRef },
      }
    );
    if (!pkgJsonResult.ok) return pkgJsonResult;

    const generateArgs: string[] = [
      "-d",
      runtime.dir,
      "-o",
      outDir,
      "--lib",
      dotnetLib,
    ];
    for (const candidate of runtimes)
      generateArgs.push("--ref-dir", candidate.dir);
    for (const dep of options.deps ?? []) {
      generateArgs.push(
        "--ref-dir",
        resolveFromProjectRoot(workspaceRoot, dep)
      );
    }

    const genResult = tsbindgenGenerate(
      workspaceRoot,
      tsbindgenDll,
      generateArgs,
      options
    );
    if (!genResult.ok) return genResult;

    const installResult = installGeneratedBindingsPackage(
      workspaceRoot,
      packageName,
      outDir
    );
    if (!installResult.ok) return installResult;
  }

  return { ok: true, value: undefined };
};
