/**
 * tsonic build command - Build executable or library
 */

import { spawnSync } from "node:child_process";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import * as ts from "typescript";
import type { ResolvedConfig, Result } from "../types.js";
import { generateCommand } from "./generate.js";
import { resolveNugetConfigFile } from "../dotnet/nuget-config.js";
import { VERSION } from "../cli/constants.js";
import { generateFirstPartyLibraryBindings } from "./library-bindings-firstparty.js";

type ProjectAssets = {
  readonly targets?: Record<string, unknown>;
  readonly libraries?: Record<
    string,
    { readonly type?: string; readonly path?: string }
  >;
  readonly packageFolders?: Record<string, unknown>;
};

type AssemblyNameConflict = {
  readonly assemblyName: string;
  readonly library: string;
  readonly assetPath: string;
};

type ProjectPackageMetadata = {
  readonly name: string;
  readonly version: string;
};

const readProjectAssets = (
  assetsPath: string
): Result<ProjectAssets, string> => {
  if (!existsSync(assetsPath)) {
    return { ok: false, error: `Restore assets not found at ${assetsPath}` };
  }

  try {
    const parsed = JSON.parse(
      readFileSync(assetsPath, "utf-8")
    ) as ProjectAssets;
    return { ok: true, value: parsed };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse ${assetsPath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const findAssemblyNameConflicts = (
  assets: ProjectAssets,
  outputName: string
): readonly AssemblyNameConflict[] => {
  const targets = assets.targets ?? {};
  const wanted = `${outputName}.dll`.toLowerCase();
  const librariesById = assets.libraries ?? {};

  const conflicts: AssemblyNameConflict[] = [];
  for (const [targetKey, targetValue] of Object.entries(targets)) {
    if (!targetKey || !targetValue || typeof targetValue !== "object") continue;

    for (const [libKey, libValue] of Object.entries(
      targetValue as Record<string, unknown>
    )) {
      if (!libKey || !libValue || typeof libValue !== "object") continue;

      // Ignore the root project (and any project references) to avoid false positives:
      // project.assets.json lists project outputs under a `type: project` library entry.
      if (librariesById[libKey]?.type === "project") continue;

      for (const sectionName of ["compile", "runtime"] as const) {
        const section = (libValue as Record<string, unknown>)[sectionName];
        if (!section || typeof section !== "object") continue;

        for (const assetPath of Object.keys(
          section as Record<string, unknown>
        )) {
          const normalized = assetPath.replace(/\\/g, "/");
          const parts = normalized.split("/");
          const file = parts.length > 0 ? parts[parts.length - 1] : undefined;
          if (!file || !file.toLowerCase().endsWith(".dll")) continue;
          if (file.toLowerCase() !== wanted) continue;
          conflicts.push({
            assemblyName: outputName,
            library: libKey,
            assetPath,
          });
        }
      }
    }
  }

  // Dedupe: multiple targets can report the same conflict.
  const seen = new Set<string>();
  const unique: AssemblyNameConflict[] = [];
  for (const c of conflicts) {
    const key = `${c.library}::${c.assetPath}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  unique.sort(
    (a, b) =>
      a.library.localeCompare(b.library) ||
      a.assetPath.localeCompare(b.assetPath)
  );
  return unique;
};

const assertNoOutputAssemblyNameConflicts = (
  generatedDir: string,
  outputName: string,
  libraries: readonly string[]
): Result<void, string> => {
  const wantedDll = `${outputName}.dll`.toLowerCase();

  const libraryConflicts = libraries
    .map((p) => p.replace(/\\/g, "/"))
    .filter((p) => {
      const parts = p.split("/");
      const file = parts.length > 0 ? parts[parts.length - 1] : undefined;
      return file?.toLowerCase() === wantedDll;
    })
    .sort((a, b) => a.localeCompare(b));

  const assetsPath = join(generatedDir, "obj", "project.assets.json");
  const assetsResult = readProjectAssets(assetsPath);
  if (!assetsResult.ok) return assetsResult;

  const nugetConflicts = findAssemblyNameConflicts(
    assetsResult.value,
    outputName
  );

  if (libraryConflicts.length === 0 && nugetConflicts.length === 0) {
    return { ok: true, value: undefined };
  }

  const lines: string[] = [];
  lines.push(
    `outputName '${outputName}' conflicts with a referenced assembly named '${outputName}.dll'.`
  );
  lines.push("");
  lines.push("Conflicting references:");
  for (const lib of libraryConflicts) {
    lines.push(`  - ${lib}`);
  }
  for (const c of nugetConflicts) {
    lines.push(`  - ${c.library} (${c.assetPath})`);
  }
  lines.push("");
  const suggested = outputName.endsWith(".App")
    ? undefined
    : `${outputName}.App`;
  lines.push(
    suggested
      ? `Fix: rename \`outputName\` in your project's tsonic.json (suggested: '${suggested}') and rebuild.`
      : "Fix: rename `outputName` in your project's tsonic.json to a unique name and rebuild."
  );

  return { ok: false, error: lines.join("\n") };
};

const readProjectPackageMetadata = (
  projectRoot: string,
  outputName: string
): ProjectPackageMetadata => {
  const packageJsonPath = join(projectRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return { name: outputName, version: "0.0.0" };
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      readonly name?: unknown;
      readonly version?: unknown;
    };
    const name =
      typeof parsed.name === "string" && parsed.name.trim().length > 0
        ? parsed.name.trim()
        : outputName;
    const version =
      typeof parsed.version === "string" && parsed.version.trim().length > 0
        ? parsed.version.trim()
        : "0.0.0";
    return { name, version };
  } catch {
    return { name: outputName, version: "0.0.0" };
  }
};

const writeAikyaPackageManifest = (
  config: ResolvedConfig
): Result<void, string> => {
  const distRoot = join(config.projectRoot, "dist");
  const bindingsRoot = join(distRoot, "tsonic", "bindings");
  if (!existsSync(bindingsRoot)) {
    return {
      ok: false,
      error:
        `Aikya manifest write failed: bindings root is missing at ${bindingsRoot}.\n` +
        `Build did not produce library bindings.`,
    };
  }

  const packageMeta = readProjectPackageMetadata(
    config.projectRoot,
    config.outputName
  );
  const runtimePackageId = config.outputConfig.package?.id ?? config.outputName;
  const runtimePackageVersion =
    config.outputConfig.package?.version ?? packageMeta.version;
  const manifestDir = join(distRoot, "tsonic");
  const manifestPath = join(manifestDir, "package-manifest.json");
  const facades = existsSync(join(bindingsRoot, "index.d.ts"))
    ? ["index.d.ts"]
    : [];
  const runtimeNugetPackagesRaw = [
    { id: runtimePackageId, version: runtimePackageVersion },
    ...config.packageReferences.map((pkg) => ({
      id: pkg.id,
      version: pkg.version,
    })),
  ];
  const seenRuntimeNuget = new Set<string>();
  const runtimeNugetPackages = runtimeNugetPackagesRaw
    .filter((pkg) => {
      const key = `${pkg.id.toLowerCase()}::${pkg.version}`;
      if (seenRuntimeNuget.has(key)) return false;
      seenRuntimeNuget.add(key);
      return true;
    })
    .sort(
      (a, b) => a.id.localeCompare(b.id) || a.version.localeCompare(b.version)
    );

  const manifest = {
    schemaVersion: 1,
    kind: "tsonic-library",
    npmPackage: packageMeta.name,
    npmVersion: packageMeta.version,
    producer: {
      tool: "tsonic",
      version: VERSION,
      mode: "aikya-firstparty",
    },
    runtime: {
      nugetPackages: runtimeNugetPackages,
      frameworkReferences: config.frameworkReferences,
      assemblies: [config.outputName],
      runtimePackages: [packageMeta.name],
    },
    typing: {
      bindingsRoot: "tsonic/bindings",
      facades,
    },
    dotnet: {
      frameworkReferences: config.frameworkReferences,
      packageReferences: config.packageReferences,
    },
  } as const;

  try {
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(
      manifestPath,
      JSON.stringify(manifest, null, 2) + "\n",
      "utf-8"
    );
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to write Aikya package manifest: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const listTypeScriptSourceInputs = (sourceRoot: string): readonly string[] => {
  const out: string[] = [];
  const visit = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (
        entry.isFile() &&
        (absolute.endsWith(".ts") ||
          absolute.endsWith(".mts") ||
          absolute.endsWith(".cts")) &&
        !absolute.endsWith(".d.ts")
      ) {
        out.push(absolute);
      }
    }
  };
  if (existsSync(sourceRoot)) {
    visit(sourceRoot);
  }
  return out;
};

const listDeclarationFiles = (roots: readonly string[]): readonly string[] => {
  const out: string[] = [];
  const seen = new Set<string>();

  const visit = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (entry.isFile() && absolute.endsWith(".d.ts") && !seen.has(absolute)) {
        seen.add(absolute);
        out.push(absolute);
      }
    }
  };

  for (const root of roots) {
    if (!existsSync(root)) continue;
    visit(root);
  }

  return out;
};

const formatTsDiagnostics = (
  diagnostics: readonly ts.Diagnostic[],
  cwd: string
): string => {
  const host: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => cwd,
    getNewLine: () => "\n",
  };
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, host).trim();
};

const emitLibraryTypeDeclarations = (
  config: ResolvedConfig
): Result<void, string> => {
  const sourceRoot = resolve(config.projectRoot, config.sourceRoot);
  const sourceFiles = listTypeScriptSourceInputs(sourceRoot);
  if (sourceFiles.length === 0) {
    return {
      ok: false,
      error: `No TypeScript source files found under sourceRoot: ${sourceRoot}`,
    };
  }

  const distDir = join(config.projectRoot, "dist");
  mkdirSync(distDir, { recursive: true });

  const resolvedTypeRoots = config.typeRoots.map((p) =>
    resolve(config.workspaceRoot, p)
  );
  const declarationFiles = listDeclarationFiles(resolvedTypeRoots);
  const rootNames = Array.from(
    new Set<string>([...sourceFiles, ...declarationFiles])
  );

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    declaration: true,
    emitDeclarationOnly: true,
    noEmitOnError: true,
    allowImportingTsExtensions: true,
    noCheck: true,
    skipLibCheck: true,
    outDir: distDir,
    rootDir: sourceRoot,
    types: [],
  };

  const host = ts.createCompilerHost(compilerOptions, true);
  const program = ts.createProgram({
    rootNames,
    options: compilerOptions,
    host,
  });

  const preEmitDiagnostics = ts.getPreEmitDiagnostics(program);
  if (preEmitDiagnostics.length > 0) {
    return {
      ok: false,
      error:
        `Type declaration emit failed before emit.\n` +
        formatTsDiagnostics(preEmitDiagnostics, config.projectRoot),
    };
  }

  const emitResult = program.emit(undefined, undefined, undefined, true);
  if (emitResult.emitSkipped || emitResult.diagnostics.length > 0) {
    return {
      ok: false,
      error:
        `Type declaration emit failed.\n` +
        formatTsDiagnostics(emitResult.diagnostics, config.projectRoot),
    };
  }

  return { ok: true, value: undefined };
};

const generateLibraryBindings = (
  config: ResolvedConfig
): Result<void, string> => {
  const outDir = join(config.projectRoot, "dist", "tsonic", "bindings");
  return generateFirstPartyLibraryBindings(config, outDir);
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

  const conflictResult = assertNoOutputAssemblyNameConflicts(
    generatedDir,
    outputName,
    config.libraries
  );
  if (!conflictResult.ok) return conflictResult;

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

  const conflictResult = assertNoOutputAssemblyNameConflicts(
    generatedDir,
    outputName,
    config.libraries
  );
  if (!conflictResult.ok) return conflictResult;

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

    const declarationEmitResult = emitLibraryTypeDeclarations(config);
    if (!declarationEmitResult.ok) {
      return { ok: false, error: declarationEmitResult.error };
    }

    const manifestResult = writeAikyaPackageManifest(config);
    if (!manifestResult.ok) {
      return { ok: false, error: manifestResult.error };
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
  const outputType = config.outputConfig.type ?? "executable";

  const generatedDir = (() => {
    if (!config.noGenerate) {
      // Emit C# code
      const generateResult = generateCommand(config);
      if (!generateResult.ok) return generateResult;
      return { ok: true as const, value: generateResult.value.outputDir };
    }

    // Build from an existing generated output directory without re-running generate.
    const outputDir = resolve(config.projectRoot, config.outputDirectory);

    // Safety: refuse to use a generated directory outside the project root.
    const outputRel = relative(config.projectRoot, outputDir);
    if (!outputRel || outputRel.startsWith("..") || isAbsolute(outputRel)) {
      return {
        ok: false as const,
        error: `Refusing to use output outside project root. outputDirectory='${config.outputDirectory}' resolved to '${outputDir}'.`,
      };
    }

    if (!existsSync(outputDir)) {
      return {
        ok: false as const,
        error:
          `Generated output directory not found: ${outputDir}\n` +
          `Run \`tsonic generate\` first (or omit --no-generate).`,
      };
    }

    return { ok: true as const, value: outputDir };
  })();

  if (!generatedDir.ok) return generatedDir;

  const csprojPath = join(generatedDir.value, "tsonic.csproj");

  if (!existsSync(csprojPath)) {
    return {
      ok: false,
      error:
        `No tsonic.csproj found in ${generatedDir.value}/.\n` +
        `Run \`tsonic generate\` first (or omit --no-generate).`,
    };
  }

  // Dispatch to appropriate build function
  if (outputType === "library") {
    return buildLibrary(config, generatedDir.value);
  } else {
    return buildExecutable(config, generatedDir.value);
  }
};
