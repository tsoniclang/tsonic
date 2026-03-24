import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import type { ResolvedConfig, Result } from "../../types.js";
import { resolveNugetConfigFile } from "../../dotnet/nuget-config.js";
import { generateFirstPartyLibraryBindings } from "../library-bindings-firstparty.js";
import { assertNoOutputAssemblyNameConflicts } from "./assets.js";
import { writeLegacyBindingsPackageManifest } from "./package-manifest.js";
import { emitLibraryTypeDeclarations } from "./declarations.js";
import { emitSourcePackageArtifacts } from "./source-package-artifacts.js";

const generateLibraryBindings = (
  config: ResolvedConfig
): Result<void, string> => {
  const outDir = join(config.projectRoot, "dist", "tsonic", "bindings");
  return generateFirstPartyLibraryBindings(config, outDir);
};

const resolveLibraryPackaging = (
  config: ResolvedConfig
): "source-package" | "bindings-library" => {
  const explicit = config.outputConfig.libraryPackaging;
  if (explicit === "source-package" || explicit === "bindings-library") {
    return explicit;
  }

  return existsSync(join(config.projectRoot, "tsonic", "package-manifest.json"))
    ? "source-package"
    : "bindings-library";
};

export const buildLibrary = (
  config: ResolvedConfig,
  generatedDir: string
): Result<{ outputPath: string }, string> => {
  const { outputName, quiet, verbose, workspaceRoot, rid } = config;
  const targetFrameworks = config.outputConfig.targetFrameworks ?? [
    config.dotnetVersion,
  ];
  const nativeAot = config.outputConfig.nativeAot ?? false;
  const libraryPackaging = resolveLibraryPackaging(config);

  const nugetConfigResult = resolveNugetConfigFile(workspaceRoot);
  if (!nugetConfigResult.ok) return nugetConfigResult;

  if (nativeAot) {
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
        const errorMsg = publishResult.stderr || publishResult.stdout || "Unknown error";
        return { ok: false, error: `dotnet publish failed:\n${errorMsg}` };
      }
    }
  } else {
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
      const errorMsg = buildResult.stderr || buildResult.stdout || "Unknown error";
      return { ok: false, error: `dotnet build failed:\n${errorMsg}` };
    }
  }

  const conflictResult = assertNoOutputAssemblyNameConflicts(
    generatedDir,
    outputName,
    config.libraries
  );
  if (!conflictResult.ok) return conflictResult;

  const outputDir = join(config.projectRoot, "dist");
  try {
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
    const copiedFiles: string[] = [];

    for (const framework of targetFrameworks) {
      const buildDir = join(generatedDir, "bin", "Release", framework);
      const artifactDir = nativeAot ? join(buildDir, rid) : buildDir;
      if (!existsSync(buildDir)) continue;

      const frameworkOutputDir = join(outputDir, framework);
      if (!existsSync(frameworkOutputDir)) {
        mkdirSync(frameworkOutputDir, { recursive: true });
      }

      for (const extension of ["dll", "xml", "pdb"] as const) {
        const source = join(artifactDir, `${outputName}.${extension}`);
        if (!existsSync(source)) continue;
        const target = join(frameworkOutputDir, `${outputName}.${extension}`);
        copyFileSync(source, target);
        copiedFiles.push(relative(config.projectRoot, target));
      }

      if (!nativeAot) continue;
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

    if (copiedFiles.length === 0) {
      return { ok: false, error: "No library artifacts found to copy" };
    }

    if (libraryPackaging === "bindings-library") {
      const bindingsResult = generateLibraryBindings(config);
      if (!bindingsResult.ok) return { ok: false, error: bindingsResult.error };

      const declarationResult = emitLibraryTypeDeclarations(config);
      if (!declarationResult.ok) {
        return { ok: false, error: declarationResult.error };
      }

      const manifestResult = writeLegacyBindingsPackageManifest(config);
      if (!manifestResult.ok) return { ok: false, error: manifestResult.error };
    } else {
      const sourceArtifactsResult = emitSourcePackageArtifacts(config);
      if (!sourceArtifactsResult.ok) {
        return { ok: false, error: sourceArtifactsResult.error };
      }

      const declarationResult = emitLibraryTypeDeclarations(config, {
        preserveSourceRoot: true,
      });
      if (!declarationResult.ok) {
        return { ok: false, error: declarationResult.error };
      }
    }

    return { ok: true, value: { outputPath: outputDir } };
  } catch (error) {
    const errorDetail =
      error instanceof Error
        ? process.env.TSONIC_DEBUG_STACKS === "1"
          ? (error.stack ?? error.message)
          : error.message
        : String(error);
    return {
      ok: false,
      error: `Failed to copy library artifacts: ${errorDetail}`,
    };
  }
};
