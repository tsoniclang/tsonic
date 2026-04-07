import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  PROJECT_CONFIG_FILE,
  WORKSPACE_CONFIG_FILE,
  loadProjectConfig,
  loadWorkspaceConfig,
  resolveConfig,
} from "../config.js";
import { applyPackageManifestWorkspaceOverlay } from "../package-manifests/bindings.js";
import type {
  ResolvedConfig,
  Result,
  TsonicProjectConfig,
} from "../types.js";

type PackageJsonShape = {
  readonly name?: unknown;
};

type SourcePackageManifestShape = {
  readonly kind?: unknown;
};

type BaseResolvedLocalPackageBuildReference = {
  readonly id: string;
  readonly projectRoot: string;
  readonly projectConfig: TsonicProjectConfig;
  readonly config: ResolvedConfig;
  readonly generatedModulePrefix: string;
  readonly assemblyName: string;
};

export type ResolvedLocalPackageBuildReference =
  | (BaseResolvedLocalPackageBuildReference & {
      readonly mode: "source";
      readonly dllPath: null;
    })
  | (BaseResolvedLocalPackageBuildReference & {
      readonly mode: "dll";
      readonly dllPath: string;
    });

export type DllLocalPackageBuildReference = Extract<
  ResolvedLocalPackageBuildReference,
  { readonly mode: "dll" }
>;

const isPathWithinRoot = (rootPath: string, candidatePath: string): boolean => {
  const relativePath = relative(resolve(rootPath), resolve(candidatePath));
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
};

const normalizePackageModulePrefix = (packageId: string): string =>
  join("node_modules", ...packageId.split("/")).replace(/\\/g, "/") + "/";

const readJsonFile = <T>(filePath: string): Result<T, string> => {
  if (!existsSync(filePath)) {
    return { ok: false, error: `Required file not found: ${filePath}` };
  }

  try {
    return { ok: true, value: JSON.parse(readFileSync(filePath, "utf-8")) as T };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const loadEffectiveWorkspaceConfig = (
  workspaceRoot: string
): Result<
  Parameters<typeof resolveConfig>[0],
  string
> => {
  const workspaceConfigPath = join(workspaceRoot, WORKSPACE_CONFIG_FILE);
  const workspaceConfigResult = loadWorkspaceConfig(workspaceConfigPath);
  if (!workspaceConfigResult.ok) return workspaceConfigResult;

  const overlayResult = applyPackageManifestWorkspaceOverlay(
    workspaceRoot,
    workspaceConfigResult.value
  );
  if (!overlayResult.ok) return { ok: false, error: overlayResult.error };
  return { ok: true, value: overlayResult.value.config };
};

const readPackageName = (projectRoot: string): Result<string, string> => {
  const packageJsonResult = readJsonFile<PackageJsonShape>(
    join(projectRoot, "package.json")
  );
  if (!packageJsonResult.ok) return packageJsonResult;

  if (
    typeof packageJsonResult.value.name !== "string" ||
    packageJsonResult.value.name.trim().length === 0
  ) {
    return {
      ok: false,
      error: `Local package project at ${projectRoot} must declare a non-empty package.json name.`,
    };
  }

  return { ok: true, value: packageJsonResult.value.name };
};

const validateSourcePackageManifest = (
  projectRoot: string
): Result<void, string> => {
  const manifestResult = readJsonFile<SourcePackageManifestShape>(
    join(projectRoot, "tsonic.package.json")
  );
  if (!manifestResult.ok) return manifestResult;

  if (manifestResult.value.kind !== "tsonic-source-package") {
    return {
      ok: false,
      error:
        `Local package project at ${projectRoot} must declare kind "tsonic-source-package" in tsonic.package.json.`,
    };
  }

  return { ok: true, value: undefined };
};

const resolveReferencedProjectConfig = (
  workspaceRoot: string,
  projectRoot: string
): Result<
  {
    readonly projectConfig: TsonicProjectConfig;
    readonly config: ResolvedConfig;
  },
  string
> => {
  const workspaceConfigResult = loadEffectiveWorkspaceConfig(workspaceRoot);
  if (!workspaceConfigResult.ok) return workspaceConfigResult;

  const projectConfigPath = join(projectRoot, PROJECT_CONFIG_FILE);
  const projectConfigResult = loadProjectConfig(projectConfigPath);
  if (!projectConfigResult.ok) return projectConfigResult;

  return {
    ok: true,
    value: {
      projectConfig: projectConfigResult.value,
      config: resolveConfig(
        workspaceConfigResult.value,
        projectConfigResult.value,
        {},
        workspaceRoot,
        projectRoot
      ),
    },
  };
};

export const resolveLocalPackageBuildReferences = (
  config: ResolvedConfig
): Result<readonly ResolvedLocalPackageBuildReference[], string> => {
  const seenIds = new Set<string>();
  const seenProjects = new Set<string>();
  const resolvedReferences: ResolvedLocalPackageBuildReference[] = [];

  for (const entry of config.localPackageReferences) {
    if (seenIds.has(entry.id)) {
      return {
        ok: false,
        error: `Duplicate local package reference id '${entry.id}' in ${join(config.projectRoot, PROJECT_CONFIG_FILE)}.`,
      };
    }
    seenIds.add(entry.id);

    const normalizedProjectRoot = resolve(entry.projectRoot);
    if (seenProjects.has(normalizedProjectRoot)) {
      return {
        ok: false,
        error:
          `Duplicate local package project '${normalizedProjectRoot}' in ${join(config.projectRoot, PROJECT_CONFIG_FILE)}.`,
      };
    }
    seenProjects.add(normalizedProjectRoot);

    if (!isPathWithinRoot(config.workspaceRoot, normalizedProjectRoot)) {
      return {
        ok: false,
        error:
          `Local package reference '${entry.id}' points outside workspace root.\n` +
          `Resolved project: ${normalizedProjectRoot}\n` +
          `Workspace root: ${config.workspaceRoot}`,
      };
    }

    const packageNameResult = readPackageName(normalizedProjectRoot);
    if (!packageNameResult.ok) return packageNameResult;
    if (packageNameResult.value !== entry.id) {
      return {
        ok: false,
        error:
          `Local package reference id mismatch for ${normalizedProjectRoot}.\n` +
          `Expected package.json name '${entry.id}', found '${packageNameResult.value}'.`,
      };
    }

    const manifestValidationResult =
      validateSourcePackageManifest(normalizedProjectRoot);
    if (!manifestValidationResult.ok) return manifestValidationResult;

    const referencedProjectResult = resolveReferencedProjectConfig(
      config.workspaceRoot,
      normalizedProjectRoot
    );
    if (!referencedProjectResult.ok) {
      return {
        ok: false,
        error:
          `Failed to resolve local package reference '${entry.id}':\n${referencedProjectResult.error}`,
      };
    }

    const referencedConfig = referencedProjectResult.value.config;
    const outputType = referencedConfig.outputConfig.type ?? "executable";
    if (entry.mode === "dll") {
      if (outputType !== "library") {
        return {
          ok: false,
          error:
            `Local package reference '${entry.id}' uses mode 'dll' but project '${normalizedProjectRoot}' is not a library build.`,
        };
      }
      if (referencedConfig.outputConfig.nativeAot) {
        return {
          ok: false,
          error:
            `Local package reference '${entry.id}' uses mode 'dll' but project '${normalizedProjectRoot}' builds a NativeAOT library, not a managed CLR DLL.`,
        };
      }

      const targetFrameworks = referencedConfig.outputConfig.targetFrameworks ?? [
        referencedConfig.dotnetVersion,
      ];
      if (!targetFrameworks.includes(config.dotnetVersion)) {
        return {
          ok: false,
          error:
            `Local package reference '${entry.id}' must target '${config.dotnetVersion}' for mode 'dll'.\n` +
            `Project '${normalizedProjectRoot}' targets: ${targetFrameworks.join(", ")}`,
        };
      }
    }

    const baseReference = {
      id: entry.id,
      projectRoot: normalizedProjectRoot,
      projectConfig: referencedProjectResult.value.projectConfig,
      config: referencedConfig,
      generatedModulePrefix: normalizePackageModulePrefix(entry.id),
      assemblyName: referencedConfig.outputName,
    } as const;

    if (entry.mode === "dll") {
      resolvedReferences.push({
        ...baseReference,
        mode: "dll",
        dllPath: join(
          normalizedProjectRoot,
          "dist",
          config.dotnetVersion,
          `${referencedConfig.outputName}.dll`
        ),
      });
      continue;
    }

    resolvedReferences.push({
      ...baseReference,
      mode: "source",
      dllPath: null,
    });
  }

  return { ok: true, value: resolvedReferences };
};

export const getDllModeLocalPackageReferences = (
  refs: readonly ResolvedLocalPackageBuildReference[]
): readonly DllLocalPackageBuildReference[] =>
  refs.filter(
    (entry): entry is DllLocalPackageBuildReference => entry.mode === "dll"
  );

export const collectTransitiveDllLocalPackageReferences = (
  config: ResolvedConfig
): Result<readonly DllLocalPackageBuildReference[], string> => {
  const collected = new Map<string, DllLocalPackageBuildReference>();
  const visitedProjectRoots = new Set<string>();
  const stack: string[] = [];

  const visitConfig = (
    currentConfig: ResolvedConfig
  ): Result<void, string> => {
    const normalizedProjectRoot = resolve(currentConfig.projectRoot);
    if (visitedProjectRoots.has(normalizedProjectRoot)) {
      return { ok: true, value: undefined };
    }

    const cycleStartIndex = stack.indexOf(normalizedProjectRoot);
    if (cycleStartIndex >= 0) {
      const cycle = [...stack.slice(cycleStartIndex), normalizedProjectRoot]
        .map(
          (projectRoot) =>
            relative(currentConfig.workspaceRoot, projectRoot) || "."
        )
        .join(" -> ");
      return {
        ok: false,
        error: `Circular local package reference graph detected: ${cycle}`,
      };
    }

    stack.push(normalizedProjectRoot);
    try {
      const directReferencesResult =
        resolveLocalPackageBuildReferences(currentConfig);
      if (!directReferencesResult.ok) {
        return directReferencesResult;
      }

      for (const entry of directReferencesResult.value) {
        if (entry.mode === "dll" && !collected.has(entry.projectRoot)) {
          collected.set(entry.projectRoot, entry);
          const visitResult = visitConfig(entry.config);
          if (!visitResult.ok) {
            return visitResult;
          }
        }
      }

      visitedProjectRoots.add(normalizedProjectRoot);
      return { ok: true, value: undefined };
    } finally {
      stack.pop();
    }
  };

  const visitResult = visitConfig(config);
  if (!visitResult.ok) {
    return visitResult;
  }

  return { ok: true, value: Array.from(collected.values()) };
};

export const getLocalPackageIdFromModulePath = (
  modulePath: string
): string | undefined => {
  const normalized = modulePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized.startsWith("node_modules/")) {
    return undefined;
  }

  const rest = normalized.slice("node_modules/".length);
  if (rest.length === 0) {
    return undefined;
  }

  const parts = rest.split("/");
  if (parts[0]?.startsWith("@")) {
    if ((parts[0]?.length ?? 0) === 0 || (parts[1]?.length ?? 0) === 0) {
      return undefined;
    }
    return `${parts[0]}/${parts[1]}`;
  }

  return parts[0] && parts[0].length > 0 ? parts[0] : undefined;
};
