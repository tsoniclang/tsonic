/**
 * Workspace + project configuration loading and resolution.
 *
 * Airplane-grade rule: Tsonic always operates in a workspace.
 * - Workspace root contains `tsonic.workspace.json`
 * - Projects live under `packages/*` and contain `tsonic.json`
 * - All external dependencies are workspace-scoped (no project-private deps)
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { detectRid } from "@tsonic/backend";
import type { OutputType } from "@tsonic/backend";
import type {
  CliOptions,
  FrameworkReferenceConfig,
  LibraryReferenceConfig,
  PackageReferenceConfig,
  ResolvedConfig,
  Result,
  TsonicOutputConfig,
  TsonicProjectConfig,
  TsonicWorkspaceConfig,
} from "./types.js";

export const WORKSPACE_CONFIG_FILE = "tsonic.workspace.json";
export const PROJECT_CONFIG_FILE = "tsonic.json";
const MSBUILD_PROPERTY_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Find `tsonic.workspace.json` by walking up the directory tree.
 */
export const findWorkspaceConfig = (startDir: string): string | null => {
  let currentDir = resolve(startDir);

  for (;;) {
    const cfg = join(currentDir, WORKSPACE_CONFIG_FILE);
    if (existsSync(cfg)) return cfg;

    const parent = dirname(currentDir);
    if (parent === currentDir) return null;
    currentDir = parent;
  }
};

const parseJsonFile = <T>(filePath: string): Result<T, string> => {
  try {
    const raw = readFileSync(filePath, "utf-8");
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export const loadWorkspaceConfig = (
  configPath: string
): Result<TsonicWorkspaceConfig, string> => {
  if (!existsSync(configPath)) {
    return { ok: false, error: `Workspace config not found: ${configPath}` };
  }

  const parsed = parseJsonFile<Record<string, unknown>>(configPath);
  if (!parsed.ok) return parsed;
  const config = parsed.value as TsonicWorkspaceConfig;

  if (!config.dotnetVersion || typeof config.dotnetVersion !== "string") {
    return {
      ok: false,
      error: `${WORKSPACE_CONFIG_FILE}: 'dotnetVersion' is required`,
    };
  }

  const dotnet = (config.dotnet ?? {}) as Record<string, unknown>;

  const libraries = dotnet.libraries;
  if (libraries !== undefined) {
    if (!Array.isArray(libraries)) {
      return {
        ok: false,
        error: `${WORKSPACE_CONFIG_FILE}: 'dotnet.libraries' must be an array of strings or { path: string, types?: string|false }`,
      };
    }

    for (const entry of libraries as unknown[]) {
      if (typeof entry === "string") continue;
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        return {
          ok: false,
          error: `${WORKSPACE_CONFIG_FILE}: 'dotnet.libraries' entries must be strings or { path: string, types?: string|false }`,
        };
      }

      const path = (entry as { readonly path?: unknown }).path;
      const types = (entry as { readonly types?: unknown }).types;
      if (typeof path !== "string" || path.trim().length === 0) {
        return {
          ok: false,
          error: `${WORKSPACE_CONFIG_FILE}: 'dotnet.libraries' object entries must include a non-empty 'path'`,
        };
      }
      if (
        types !== undefined &&
        types !== false &&
        (typeof types !== "string" || types.trim().length === 0)
      ) {
        return {
          ok: false,
          error: `${WORKSPACE_CONFIG_FILE}: 'dotnet.libraries' object entries must have 'types' as a non-empty string or false when present`,
        };
      }
    }
  }

  const frameworkReferences = dotnet.frameworkReferences;
  if (
    frameworkReferences !== undefined &&
    (!Array.isArray(frameworkReferences) ||
      frameworkReferences.some((r) => {
        if (typeof r === "string") return false;
        if (r === null || typeof r !== "object") return true;
        const id = (r as { readonly id?: unknown }).id;
        const types = (r as { readonly types?: unknown }).types;
        if (typeof id !== "string") return true;
        if (
          types !== undefined &&
          types !== false &&
          (typeof types !== "string" || types.trim().length === 0)
        ) {
          return true;
        }
        return false;
      }))
  ) {
    return {
      ok: false,
      error: `${WORKSPACE_CONFIG_FILE}: 'dotnet.frameworkReferences' must be an array of strings or { id: string, types?: string|false }`,
    };
  }

  const packageReferences = dotnet.packageReferences;
  if (packageReferences !== undefined) {
    if (!Array.isArray(packageReferences)) {
      return {
        ok: false,
        error: `${WORKSPACE_CONFIG_FILE}: 'dotnet.packageReferences' must be an array of { id, version }`,
      };
    }

    for (const entry of packageReferences as unknown[]) {
      if (
        entry === null ||
        typeof entry !== "object" ||
        typeof (entry as { readonly id?: unknown }).id !== "string" ||
        typeof (entry as { readonly version?: unknown }).version !== "string" ||
        ((entry as { readonly types?: unknown }).types !== undefined &&
          (entry as { readonly types?: unknown }).types !== false &&
          (typeof (entry as { readonly types?: unknown }).types !== "string" ||
            String((entry as { readonly types?: unknown }).types).trim()
              .length === 0))
      ) {
        return {
          ok: false,
          error: `${WORKSPACE_CONFIG_FILE}: 'dotnet.packageReferences' entries must be { id: string, version: string, types?: string|false }`,
        };
      }
    }
  }

  const typeRoots = dotnet.typeRoots;
  if (
    typeRoots !== undefined &&
    (!Array.isArray(typeRoots) || typeRoots.some((r) => typeof r !== "string"))
  ) {
    return {
      ok: false,
      error: `${WORKSPACE_CONFIG_FILE}: 'dotnet.typeRoots' must be an array of strings`,
    };
  }

  const msbuildProperties = dotnet.msbuildProperties;
  if (msbuildProperties !== undefined) {
    if (
      msbuildProperties === null ||
      typeof msbuildProperties !== "object" ||
      Array.isArray(msbuildProperties)
    ) {
      return {
        ok: false,
        error: `${WORKSPACE_CONFIG_FILE}: 'dotnet.msbuildProperties' must be an object mapping MSBuild property names to string values`,
      };
    }

    for (const [key, value] of Object.entries(
      msbuildProperties as Record<string, unknown>
    )) {
      if (!MSBUILD_PROPERTY_NAME_RE.test(key)) {
        return {
          ok: false,
          error:
            `${WORKSPACE_CONFIG_FILE}: 'dotnet.msbuildProperties' contains an invalid MSBuild property name: ${key}. ` +
            `Property names must match ${String(MSBUILD_PROPERTY_NAME_RE)}.`,
        };
      }
      if (typeof value !== "string") {
        return {
          ok: false,
          error: `${WORKSPACE_CONFIG_FILE}: 'dotnet.msbuildProperties.${key}' must be a string`,
        };
      }
    }
  }

  // Test-only .NET deps validation
  const testDotnet = (config.testDotnet ?? {}) as Record<string, unknown>;

  const testFrameworkReferences = testDotnet.frameworkReferences;
  if (
    testFrameworkReferences !== undefined &&
    (!Array.isArray(testFrameworkReferences) ||
      testFrameworkReferences.some((r) => {
        if (typeof r === "string") return false;
        if (r === null || typeof r !== "object") return true;
        const id = (r as { readonly id?: unknown }).id;
        const types = (r as { readonly types?: unknown }).types;
        if (typeof id !== "string") return true;
        if (
          types !== undefined &&
          types !== false &&
          (typeof types !== "string" || types.trim().length === 0)
        ) {
          return true;
        }
        return false;
      }))
  ) {
    return {
      ok: false,
      error: `${WORKSPACE_CONFIG_FILE}: 'testDotnet.frameworkReferences' must be an array of strings or { id: string, types?: string|false }`,
    };
  }

  const testPackageReferences = testDotnet.packageReferences;
  if (testPackageReferences !== undefined) {
    if (!Array.isArray(testPackageReferences)) {
      return {
        ok: false,
        error: `${WORKSPACE_CONFIG_FILE}: 'testDotnet.packageReferences' must be an array of { id, version }`,
      };
    }

    for (const entry of testPackageReferences as unknown[]) {
      if (
        entry === null ||
        typeof entry !== "object" ||
        typeof (entry as { readonly id?: unknown }).id !== "string" ||
        typeof (entry as { readonly version?: unknown }).version !== "string" ||
        ((entry as { readonly types?: unknown }).types !== undefined &&
          (entry as { readonly types?: unknown }).types !== false &&
          (typeof (entry as { readonly types?: unknown }).types !== "string" ||
            String((entry as { readonly types?: unknown }).types).trim()
              .length === 0))
      ) {
        return {
          ok: false,
          error: `${WORKSPACE_CONFIG_FILE}: 'testDotnet.packageReferences' entries must be { id: string, version: string, types?: string|false }`,
        };
      }
    }
  }

  const testMsbuildProperties = testDotnet.msbuildProperties;
  if (testMsbuildProperties !== undefined) {
    if (
      testMsbuildProperties === null ||
      typeof testMsbuildProperties !== "object" ||
      Array.isArray(testMsbuildProperties)
    ) {
      return {
        ok: false,
        error: `${WORKSPACE_CONFIG_FILE}: 'testDotnet.msbuildProperties' must be an object mapping MSBuild property names to string values`,
      };
    }

    for (const [key, value] of Object.entries(
      testMsbuildProperties as Record<string, unknown>
    )) {
      if (!MSBUILD_PROPERTY_NAME_RE.test(key)) {
        return {
          ok: false,
          error:
            `${WORKSPACE_CONFIG_FILE}: 'testDotnet.msbuildProperties' contains an invalid MSBuild property name: ${key}. ` +
            `Property names must match ${String(MSBUILD_PROPERTY_NAME_RE)}.`,
        };
      }
      if (typeof value !== "string") {
        return {
          ok: false,
          error: `${WORKSPACE_CONFIG_FILE}: 'testDotnet.msbuildProperties.${key}' must be a string`,
        };
      }
    }
  }

  return { ok: true, value: config };
};

export const loadProjectConfig = (
  configPath: string
): Result<TsonicProjectConfig, string> => {
  if (!existsSync(configPath)) {
    return { ok: false, error: `Project config not found: ${configPath}` };
  }

  const parsed = parseJsonFile<Record<string, unknown>>(configPath);
  if (!parsed.ok) return parsed;

  // Airplane-grade enforcement: deps live in the workspace config only.
  if ("dotnet" in parsed.value || "dotnetVersion" in parsed.value) {
    return {
      ok: false,
      error:
        `${PROJECT_CONFIG_FILE}: dotnet dependencies must be declared in ${WORKSPACE_CONFIG_FILE} (workspace-scoped).\n` +
        `Remove 'dotnet' / 'dotnetVersion' from this project config and retry.`,
    };
  }

  const references = (parsed.value as { readonly references?: unknown })
    .references;
  if (references !== undefined) {
    if (
      references === null ||
      typeof references !== "object" ||
      Array.isArray(references)
    ) {
      return {
        ok: false,
        error: `${PROJECT_CONFIG_FILE}: 'references' must be an object`,
      };
    }

    const libraries = (references as { readonly libraries?: unknown })
      .libraries;
    if (
      libraries !== undefined &&
      (!Array.isArray(libraries) ||
        libraries.some((p) => typeof p !== "string"))
    ) {
      return {
        ok: false,
        error: `${PROJECT_CONFIG_FILE}: 'references.libraries' must be an array of strings`,
      };
    }
  }

  const tests = (parsed.value as { readonly tests?: unknown }).tests;
  if (tests !== undefined) {
    if (tests === null || typeof tests !== "object" || Array.isArray(tests)) {
      return {
        ok: false,
        error: `${PROJECT_CONFIG_FILE}: 'tests' must be an object`,
      };
    }
    const entryPoint = (tests as { readonly entryPoint?: unknown }).entryPoint;
    if (typeof entryPoint !== "string" || entryPoint.trim().length === 0) {
      return {
        ok: false,
        error: `${PROJECT_CONFIG_FILE}: 'tests.entryPoint' must be a non-empty string`,
      };
    }
    const outputDirectory = (tests as { readonly outputDirectory?: unknown })
      .outputDirectory;
    if (outputDirectory !== undefined && typeof outputDirectory !== "string") {
      return {
        ok: false,
        error: `${PROJECT_CONFIG_FILE}: 'tests.outputDirectory' must be a string when present`,
      };
    }
    const outputName = (tests as { readonly outputName?: unknown }).outputName;
    if (outputName !== undefined && typeof outputName !== "string") {
      return {
        ok: false,
        error: `${PROJECT_CONFIG_FILE}: 'tests.outputName' must be a string when present`,
      };
    }
  }

  const config = parsed.value as TsonicProjectConfig;

  if (!config.rootNamespace || typeof config.rootNamespace !== "string") {
    return {
      ok: false,
      error: `${PROJECT_CONFIG_FILE}: 'rootNamespace' is required`,
    };
  }

  const outputType = config.output?.type;
  if (
    outputType !== undefined &&
    outputType !== "executable" &&
    outputType !== "library" &&
    outputType !== "console-app"
  ) {
    return {
      ok: false,
      error: `${PROJECT_CONFIG_FILE}: 'output.type' must be one of 'executable', 'library', 'console-app' (got '${String(outputType)}')`,
    };
  }

  const nativeAot = config.output?.nativeAot;
  if (nativeAot !== undefined && typeof nativeAot !== "boolean") {
    return {
      ok: false,
      error: `${PROJECT_CONFIG_FILE}: 'output.nativeAot' must be a boolean when present`,
    };
  }

  const nativeLib = config.output?.nativeLib;
  if (
    nativeLib !== undefined &&
    nativeLib !== "shared" &&
    nativeLib !== "static"
  ) {
    return {
      ok: false,
      error: `${PROJECT_CONFIG_FILE}: 'output.nativeLib' must be 'shared' or 'static' when present (got '${String(nativeLib)}')`,
    };
  }

  return { ok: true, value: config };
};

export const listProjects = (workspaceRoot: string): readonly string[] => {
  const packagesDir = join(workspaceRoot, "packages");
  if (!existsSync(packagesDir)) return [];

  const projects: string[] = [];
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const projectDir = join(packagesDir, entry.name);
    if (existsSync(join(projectDir, PROJECT_CONFIG_FILE))) {
      projects.push(projectDir);
    }
  }
  return projects;
};

/**
 * Find the nearest project config under `packages/<project>/tsonic.json` for a given working directory.
 */
export const findProjectConfig = (
  startDir: string,
  workspaceRoot: string
): string | null => {
  let currentDir = resolve(startDir);
  const workspaceAbs = resolve(workspaceRoot);

  for (;;) {
    // Don't walk above the workspace.
    if (!currentDir.startsWith(workspaceAbs)) return null;

    const cfg = join(currentDir, PROJECT_CONFIG_FILE);
    if (existsSync(cfg)) {
      // Enforce packages/* boundary.
      const rel = currentDir.slice(workspaceAbs.length).replace(/^[\\/]/, "");
      if (!rel.startsWith("packages/")) return null;
      return cfg;
    }

    if (currentDir === workspaceAbs) return null;
    const parent = dirname(currentDir);
    if (parent === currentDir) return null;
    currentDir = parent;
  }
};

/**
 * Resolve output configuration from project + workspace + CLI options.
 */
const resolveOutputConfig = (
  projectConfig: TsonicProjectConfig,
  workspaceConfig: TsonicWorkspaceConfig,
  cliOptions: CliOptions,
  entryPoint: string | undefined
): TsonicOutputConfig => {
  const configOutput = projectConfig.output ?? {};

  const autoDetectOutputType = (ep: string | undefined): OutputType =>
    ep ? "executable" : "library";

  const outputType =
    cliOptions.type ?? configOutput.type ?? autoDetectOutputType(entryPoint);

  const baseConfig: TsonicOutputConfig = {
    type: outputType,
    name: configOutput.name ?? projectConfig.outputName,
  };

  if (outputType === "executable") {
    return {
      ...baseConfig,
      nativeAot: cliOptions.noAot ? false : (configOutput.nativeAot ?? true),
      singleFile: cliOptions.singleFile ?? configOutput.singleFile ?? true,
      trimmed: configOutput.trimmed ?? true,
      stripSymbols: cliOptions.noStrip
        ? false
        : (configOutput.stripSymbols ??
          projectConfig.buildOptions?.stripSymbols ??
          workspaceConfig.buildOptions?.stripSymbols ??
          true),
      optimization:
        cliOptions.optimize ??
        projectConfig.optimize ??
        workspaceConfig.optimize ??
        configOutput.optimization ??
        "speed",
      invariantGlobalization:
        configOutput.invariantGlobalization ??
        projectConfig.buildOptions?.invariantGlobalization ??
        workspaceConfig.buildOptions?.invariantGlobalization ??
        true,
      selfContained:
        cliOptions.selfContained ?? configOutput.selfContained ?? true,
    };
  }

  if (outputType === "library") {
    return {
      ...baseConfig,
      targetFrameworks: configOutput.targetFrameworks ?? [
        workspaceConfig.dotnetVersion,
      ],
      nativeAot: cliOptions.noAot ? false : (configOutput.nativeAot ?? false),
      nativeLib: configOutput.nativeLib ?? "shared",
      generateDocumentation:
        cliOptions.generateDocs ?? configOutput.generateDocumentation ?? true,
      includeSymbols:
        cliOptions.includeSymbols ?? configOutput.includeSymbols ?? true,
      packable: cliOptions.pack ?? configOutput.packable ?? false,
      package: configOutput.package,
    };
  }

  if (outputType === "console-app") {
    return {
      ...baseConfig,
      targetFramework:
        cliOptions.targetFramework ??
        configOutput.targetFramework ??
        workspaceConfig.dotnetVersion,
      singleFile: cliOptions.singleFile ?? configOutput.singleFile ?? true,
      selfContained:
        cliOptions.selfContained ?? configOutput.selfContained ?? true,
    };
  }

  return baseConfig;
};

/**
 * Resolve a project's effective configuration (workspace-scoped deps + project settings).
 */
export const resolveConfig = (
  workspaceConfig: TsonicWorkspaceConfig,
  projectConfig: TsonicProjectConfig,
  cliOptions: CliOptions,
  workspaceRoot: string,
  projectRoot: string,
  entryFile?: string
): ResolvedConfig => {
  const entryPoint = entryFile ?? projectConfig.entryPoint;
  const sourceRoot =
    cliOptions.src ??
    projectConfig.sourceRoot ??
    (entryPoint ? dirname(entryPoint) : "src");

  const defaultTypeRoots = ["node_modules/@tsonic/globals"];
  const typeRoots = workspaceConfig.dotnet?.typeRoots ?? defaultTypeRoots;

  const configLibraries = (workspaceConfig.dotnet?.libraries ?? []).map(
    (p: LibraryReferenceConfig) => (typeof p === "string" ? p : p.path)
  );
  const projectLibraries = (projectConfig.references?.libraries ?? []).map(
    (p) => resolve(projectRoot, p)
  );
  const cliLibraries = cliOptions.lib ?? [];
  const libraries = [...configLibraries, ...projectLibraries, ...cliLibraries];

  const rawFrameworkReferences = (workspaceConfig.dotnet?.frameworkReferences ??
    []) as readonly FrameworkReferenceConfig[];
  const frameworkReferences = rawFrameworkReferences.map((r) =>
    typeof r === "string" ? r : r.id
  );

  const packageReferences = (
    (workspaceConfig.dotnet?.packageReferences ??
      []) as readonly PackageReferenceConfig[]
  ).map((p) => ({ id: p.id, version: p.version }));

  const outputConfig = resolveOutputConfig(
    projectConfig,
    workspaceConfig,
    cliOptions,
    entryPoint
  );

  return {
    workspaceRoot,
    rootNamespace: cliOptions.namespace ?? projectConfig.rootNamespace,
    entryPoint,
    projectRoot,
    sourceRoot,
    outputDirectory: projectConfig.outputDirectory ?? "generated",
    outputName: cliOptions.out ?? projectConfig.outputName ?? "app",
    rid: cliOptions.rid ?? workspaceConfig.rid ?? detectRid(),
    dotnetVersion: workspaceConfig.dotnetVersion,
    optimize:
      cliOptions.optimize ??
      projectConfig.optimize ??
      workspaceConfig.optimize ??
      projectConfig.output?.optimization ??
      "speed",
    outputConfig,
    stripSymbols: cliOptions.noStrip
      ? false
      : (projectConfig.output?.stripSymbols ??
        projectConfig.buildOptions?.stripSymbols ??
        workspaceConfig.buildOptions?.stripSymbols ??
        true),
    invariantGlobalization:
      projectConfig.output?.invariantGlobalization ??
      projectConfig.buildOptions?.invariantGlobalization ??
      workspaceConfig.buildOptions?.invariantGlobalization ??
      true,
    keepTemp: cliOptions.keepTemp ?? false,
    noGenerate: cliOptions.noGenerate ?? false,
    verbose: cliOptions.verbose ?? false,
    quiet: cliOptions.quiet ?? false,
    typeRoots,
    libraries,
    frameworkReferences,
    packageReferences,
    msbuildProperties: workspaceConfig.dotnet?.msbuildProperties,
  };
};
