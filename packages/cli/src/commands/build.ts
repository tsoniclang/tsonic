/**
 * tsonic build command - Build executable or library
 */

import { spawnSync } from "node:child_process";
import { dirname, join, relative } from "node:path";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import type { ResolvedConfig, Result } from "../types.js";
import { generateCommand } from "./generate.js";
import { resolveNugetConfigFile } from "../dotnet/nuget-config.js";
import {
  listDotnetRuntimes,
  resolvePackageRoot,
  resolveTsbindgenDllPath,
  tsbindgenGenerate,
  type AddCommandOptions,
} from "./add-common.js";

type ProjectAssets = {
  readonly targets?: Record<string, unknown>;
  readonly libraries?: Record<string, { readonly type?: string; readonly path?: string }>;
  readonly packageFolders?: Record<string, unknown>;
};

const pickPackageFolder = (assets: ProjectAssets): string | undefined => {
  const folders = assets.packageFolders ? Object.keys(assets.packageFolders) : [];
  if (folders.length === 0) return undefined;
  return folders[0];
};

const findTargetKey = (assets: ProjectAssets, tfm: string): string | undefined => {
  const targets = assets.targets ? Object.keys(assets.targets) : [];
  if (targets.includes(tfm)) return tfm;
  return targets.find((k) => k.startsWith(`${tfm}/`));
};

const collectNugetCompileDirs = (workspaceRoot: string, tfm: string): Result<readonly string[], string> => {
  const assetsPath = join(workspaceRoot, ".tsonic", "nuget", "obj", "project.assets.json");
  if (!existsSync(assetsPath)) return { ok: true, value: [] };

  let assets: ProjectAssets;
  try {
    assets = JSON.parse(readFileSync(assetsPath, "utf-8")) as ProjectAssets;
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse ${assetsPath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const packageFolder = pickPackageFolder(assets);
  if (!packageFolder) return { ok: true, value: [] };

  const targetKey = findTargetKey(assets, tfm);
  if (!targetKey) return { ok: true, value: [] };

  const targets = assets.targets?.[targetKey];
  const libraries = assets.libraries ?? {};
  if (!targets || typeof targets !== "object") return { ok: true, value: [] };

  const compileDirs = new Set<string>();
  for (const [libKey, libValue] of Object.entries(targets as Record<string, unknown>)) {
    if (!libKey || !libValue || typeof libValue !== "object") continue;

    const libInfo = libraries[libKey];
    if (!libInfo || libInfo.type !== "package" || !libInfo.path) continue;

    const compile = (libValue as Record<string, unknown>).compile;
    if (!compile || typeof compile !== "object") continue;

    for (const p of Object.keys(compile as Record<string, unknown>)) {
      if (!p.toLowerCase().endsWith(".dll")) continue;
      const dllPath = join(packageFolder, libInfo.path as string, p);
      compileDirs.add(dirname(dllPath));
    }
  }

  return { ok: true, value: Array.from(compileDirs).sort((a, b) => a.localeCompare(b)) };
};

const listGeneratedBindingsLibDirs = (workspaceRoot: string): readonly string[] => {
  const base = join(workspaceRoot, ".tsonic", "bindings");
  if (!existsSync(base)) return [];

  const libs: string[] = [];
  const kinds = readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  for (const kind of kinds) {
    const kindDir = join(base, kind);
    for (const entry of readdirSync(kindDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = join(kindDir, entry.name);
      const pkgJsonPath = join(dir, "package.json");
      if (!existsSync(pkgJsonPath)) continue;
      try {
        const parsed = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as Record<string, unknown>;
        const tsonic = (parsed.tsonic ?? {}) as Record<string, unknown>;
        if (tsonic.generated === true) libs.push(dir);
      } catch {
        // Ignore malformed generated packages; restore will report these separately.
      }
    }
  }

  libs.sort((a, b) => a.localeCompare(b));
  return libs;
};

const generateLibraryBindings = (
  config: ResolvedConfig
): Result<void, string> => {
  const { workspaceRoot, projectRoot, outputName, dotnetVersion, verbose, quiet, packageReferences } = config;

  const dllPath = join(projectRoot, "dist", dotnetVersion, `${outputName}.dll`);
  if (!existsSync(dllPath)) {
    return { ok: false, error: `Built library DLL not found at ${dllPath}` };
  }

  const tsbindgenDllResult = resolveTsbindgenDllPath(workspaceRoot);
  if (!tsbindgenDllResult.ok) return tsbindgenDllResult;

  const runtimesResult = listDotnetRuntimes(workspaceRoot);
  if (!runtimesResult.ok) return runtimesResult;
  const runtimes = runtimesResult.value;

  const dotnetRoot = resolvePackageRoot(workspaceRoot, "@tsonic/dotnet");
  if (!dotnetRoot.ok) return dotnetRoot;

  const outDir = join(projectRoot, "dist", "tsonic", "bindings");
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const compileDirsResult = collectNugetCompileDirs(workspaceRoot, dotnetVersion);
  if (!compileDirsResult.ok) return compileDirsResult;

  if (packageReferences.length > 0 && compileDirsResult.value.length === 0) {
    return {
      ok: false,
      error:
        "NuGet PackageReferences are configured, but no restore assets were found.\n" +
        "Run `tsonic restore` at the workspace root and retry.",
    };
  }

  const generatedLibs = listGeneratedBindingsLibDirs(workspaceRoot);

  const args: string[] = [
    "-a",
    dllPath,
    "-o",
    outDir,
    "--lib",
    dotnetRoot.value,
  ];

  for (const lib of generatedLibs) args.push("--lib", lib);

  const refDirs = new Set<string>();
  refDirs.add(join(projectRoot, "dist", dotnetVersion));
  refDirs.add(join(workspaceRoot, "libs"));
  for (const rt of runtimes) refDirs.add(rt.dir);
  for (const d of compileDirsResult.value) refDirs.add(d);

  for (const dir of Array.from(refDirs).sort((a, b) => a.localeCompare(b))) {
    if (existsSync(dir)) args.push("--ref-dir", dir);
  }

  const options: AddCommandOptions = { verbose, quiet };
  const genResult = tsbindgenGenerate(workspaceRoot, tsbindgenDllResult.value, args, options);
  if (!genResult.ok) return genResult;

  return { ok: true, value: undefined };
};

/**
 * Build native executable
 */
const buildExecutable = (
  config: ResolvedConfig,
  generatedDir: string
): Result<{ outputPath: string }, string> => {
  const { outputName, rid, quiet, verbose, workspaceRoot } = config;

  const nugetConfigResult = resolveNugetConfigFile(workspaceRoot);
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
  const outDir = join(config.projectRoot, "out");
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
  const { outputName, quiet, verbose, workspaceRoot, rid } = config;
  const targetFrameworks = config.outputConfig.targetFrameworks ?? [
    config.dotnetVersion,
  ];
  const nativeAot = config.outputConfig.nativeAot ?? false;

  const nugetConfigResult = resolveNugetConfigFile(workspaceRoot);
  if (!nugetConfigResult.ok) return nugetConfigResult;

  if (nativeAot) {
    // Run dotnet publish for NativeAOT libraries (RID-specific)
    for (const framework of targetFrameworks) {
      const publishArgs = [
        "publish",
        "tsonic.csproj",
        "-c",
        "Release",
        "-r",
        rid,
        "-f",
        framework,
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
    }
  } else {
    // Run dotnet build (managed library)
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
  }

  // Copy output library artifacts
  const outputDir = join(config.projectRoot, "dist");

  try {
    // Create output directory
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Copy artifacts for each target framework
    const copiedFiles: string[] = [];

    for (const framework of targetFrameworks) {
      const buildDir = join(generatedDir, "bin", "Release", framework);
      const artifactDir = nativeAot ? join(buildDir, rid) : buildDir;

      if (!existsSync(buildDir)) {
        continue;
      }

      const frameworkOutputDir = join(outputDir, framework);
      if (!existsSync(frameworkOutputDir)) {
        mkdirSync(frameworkOutputDir, { recursive: true });
      }

      // Copy .dll
      const dllSource = join(artifactDir, `${outputName}.dll`);
      if (existsSync(dllSource)) {
        const dllTarget = join(frameworkOutputDir, `${outputName}.dll`);
        copyFileSync(dllSource, dllTarget);
        copiedFiles.push(relative(config.projectRoot, dllTarget));
      }

      // Copy .xml (documentation)
      const xmlSource = join(artifactDir, `${outputName}.xml`);
      if (existsSync(xmlSource)) {
        const xmlTarget = join(frameworkOutputDir, `${outputName}.xml`);
        copyFileSync(xmlSource, xmlTarget);
        copiedFiles.push(relative(config.projectRoot, xmlTarget));
      }

      // Copy .pdb (symbols)
      const pdbSource = join(artifactDir, `${outputName}.pdb`);
      if (existsSync(pdbSource)) {
        const pdbTarget = join(frameworkOutputDir, `${outputName}.pdb`);
        copyFileSync(pdbSource, pdbTarget);
        copiedFiles.push(relative(config.projectRoot, pdbTarget));
      }

      if (nativeAot) {
        const publishDir = join(buildDir, rid, "publish");
        if (!existsSync(publishDir)) {
          return {
            ok: false,
            error: `NativeAOT publish output not found at ${publishDir}`,
          };
        }

        const publishOutDir = join(frameworkOutputDir, rid, "publish");
        rmSync(publishOutDir, { recursive: true, force: true });
        mkdirSync(publishOutDir, { recursive: true });

        const publishEntries = readdirSync(publishDir, { withFileTypes: true });
        for (const entry of publishEntries) {
          const src = join(publishDir, entry.name);
          const dst = join(publishOutDir, entry.name);
          cpSync(src, dst, { recursive: entry.isDirectory(), force: true });
        }
      }
    }

    if (copiedFiles.length === 0) {
      return {
        ok: false,
        error: "No library artifacts found to copy",
      };
    }

    const bindingsResult = generateLibraryBindings(config);
    if (!bindingsResult.ok) {
      return { ok: false, error: bindingsResult.error };
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
