import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { ResolvedConfig, Result } from "../../types.js";
import { generateCommand } from "../generate.js";
import {
  collectTransitiveDllLocalPackageReferences,
  getDllModeLocalPackageReferences,
  resolveLocalPackageBuildReferences,
} from "../local-package-references.js";
import { buildExecutable } from "./executable-build.js";
import { buildLibrary } from "./library-build.js";

type BuildState = {
  readonly completedOutputPaths: Map<string, string>;
  readonly stack: string[];
};

const buildCurrentProject = (
  config: ResolvedConfig,
  referencedAssemblyPaths: readonly string[]
): Result<{ outputPath: string }, string> => {
  const outputType = config.outputConfig.type ?? "executable";

  const generatedDir = (() => {
    if (!config.noGenerate) {
      const generateResult = generateCommand(config);
      if (!generateResult.ok) return generateResult;
      return { ok: true as const, value: generateResult.value.outputDir };
    }

    const outputDir = resolve(config.projectRoot, config.outputDirectory);
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

  return outputType === "library"
    ? buildLibrary(config, generatedDir.value, referencedAssemblyPaths)
    : buildExecutable(config, generatedDir.value, referencedAssemblyPaths);
};

const buildCommandInternal = (
  config: ResolvedConfig,
  state: BuildState
): Result<{ outputPath: string }, string> => {
  const normalizedProjectRoot = resolve(config.projectRoot);
  const completedOutputPath =
    state.completedOutputPaths.get(normalizedProjectRoot);
  if (completedOutputPath) {
    return { ok: true, value: { outputPath: completedOutputPath } };
  }

  const cycleStartIndex = state.stack.indexOf(normalizedProjectRoot);
  if (cycleStartIndex >= 0) {
    const cycle = [...state.stack.slice(cycleStartIndex), normalizedProjectRoot]
      .map((projectRoot) => relative(config.workspaceRoot, projectRoot) || ".")
      .join(" -> ");
    return {
      ok: false,
      error: `Circular local package build dependency detected: ${cycle}`,
    };
  }

  const localPackageReferencesResult = resolveLocalPackageBuildReferences(
    config
  );
  if (!localPackageReferencesResult.ok) {
    return localPackageReferencesResult;
  }
  const dllLocalPackageReferences = getDllModeLocalPackageReferences(
    localPackageReferencesResult.value
  );
  const transitiveDllLocalPackageReferencesResult =
    collectTransitiveDllLocalPackageReferences(config);
  if (!transitiveDllLocalPackageReferencesResult.ok) {
    return transitiveDllLocalPackageReferencesResult;
  }
  const transitiveDllLocalPackageReferences =
    transitiveDllLocalPackageReferencesResult.value;

  state.stack.push(normalizedProjectRoot);
  try {
    for (const entry of dllLocalPackageReferences) {
      const dependencyResult = buildCommandInternal(
        {
          ...entry.config,
          verbose: config.verbose,
          quiet: config.quiet,
        },
        state
      );
      if (!dependencyResult.ok) {
        return {
          ok: false,
          error:
            `Failed to build local package '${entry.id}' for project '${relative(config.workspaceRoot, normalizedProjectRoot) || "."}':\n` +
            dependencyResult.error,
        };
      }

      if (!existsSync(entry.dllPath)) {
        return {
          ok: false,
          error:
            `Local package '${entry.id}' built successfully but expected DLL was not found at ${entry.dllPath}.`,
        };
      }
    }

    const currentResult = buildCurrentProject(
      config,
      transitiveDllLocalPackageReferences.map((entry) => entry.dllPath)
    );
    if (currentResult.ok) {
      state.completedOutputPaths.set(
        normalizedProjectRoot,
        currentResult.value.outputPath
      );
    }
    return currentResult;
  } finally {
    state.stack.pop();
  }
};

export const buildCommand = (
  config: ResolvedConfig
): Result<{ outputPath: string }, string> =>
  buildCommandInternal(config, {
    completedOutputPaths: new Map<string, string>(),
    stack: [],
  });
