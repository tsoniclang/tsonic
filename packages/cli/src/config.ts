/**
 * Configuration loading and validation
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { detectRid } from "@tsonic/backend";
import type {
  TsonicConfig,
  CliOptions,
  ResolvedConfig,
  Result,
  TsonicOutputConfig,
} from "./types.js";
import type { OutputType } from "@tsonic/backend";

/**
 * Load tsonic.json from a directory
 */
export const loadConfig = (
  configPath: string
): Result<TsonicConfig, string> => {
  if (!existsSync(configPath)) {
    return {
      ok: false,
      error: `Config file not found: ${configPath}`,
    };
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content) as TsonicConfig;

    // Validate required fields
    if (!config.rootNamespace) {
      return {
        ok: false,
        error: "tsonic.json: 'rootNamespace' is required",
      };
    }

    const isNamingPolicy = (value: string): boolean =>
      value === "clr" || value === "none";

    const validateNamingPolicyKey = (
      key: string,
      value: string | undefined
    ): Result<void, string> => {
      if (value === undefined) return { ok: true, value: undefined };
      if (isNamingPolicy(value)) return { ok: true, value: undefined };
      return {
        ok: false,
        error: `tsonic.json: '${key}' must be one of 'clr', 'none' (got '${value}')`,
      };
    };

    const namingPolicy = config.namingPolicy;
    if (namingPolicy) {
      const checks: Array<Result<void, string>> = [
        validateNamingPolicyKey("namingPolicy.all", namingPolicy.all),
        validateNamingPolicyKey("namingPolicy.classes", namingPolicy.classes),
        validateNamingPolicyKey(
          "namingPolicy.namespaces",
          namingPolicy.namespaces
        ),
        validateNamingPolicyKey("namingPolicy.methods", namingPolicy.methods),
        validateNamingPolicyKey(
          "namingPolicy.properties",
          namingPolicy.properties
        ),
        validateNamingPolicyKey("namingPolicy.fields", namingPolicy.fields),
        validateNamingPolicyKey(
          "namingPolicy.enumMembers",
          namingPolicy.enumMembers
        ),
      ];

      for (const res of checks) {
        if (!res.ok) return res;
      }
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
        error:
          `tsonic.json: 'output.type' must be one of 'executable', 'library', 'console-app' (got '${outputType}')`,
      };
    }

    const frameworkReferences = config.dotnet?.frameworkReferences;
    if (
      frameworkReferences !== undefined &&
      (!Array.isArray(frameworkReferences) ||
        frameworkReferences.some((r) => {
          if (typeof r === "string") return false;
          if (r === null || typeof r !== "object") return true;
          const id = (r as { readonly id?: unknown }).id;
          const types = (r as { readonly types?: unknown }).types;
          if (typeof id !== "string") return true;
          if (types !== undefined && typeof types !== "string") return true;
          return false;
        }))
    ) {
      return {
        ok: false,
        error:
          "tsonic.json: 'dotnet.frameworkReferences' must be an array of strings or { id: string, types?: string }",
      };
    }

    const packageReferences = config.dotnet?.packageReferences;
    if (packageReferences !== undefined) {
      if (!Array.isArray(packageReferences)) {
        return {
          ok: false,
          error:
            "tsonic.json: 'dotnet.packageReferences' must be an array of { id, version }",
        };
      }

      for (const entry of packageReferences as unknown[]) {
        if (
          entry === null ||
          typeof entry !== "object" ||
          typeof (entry as { readonly id?: unknown }).id !== "string" ||
          typeof (entry as { readonly version?: unknown }).version !== "string" ||
          ((entry as { readonly types?: unknown }).types !== undefined &&
            typeof (entry as { readonly types?: unknown }).types !== "string")
        ) {
          return {
            ok: false,
            error:
              "tsonic.json: 'dotnet.packageReferences' entries must be { id: string, version: string, types?: string }",
          };
        }
      }
    }

    return { ok: true, value: config };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse tsonic.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Find tsonic.json by walking up the directory tree
 */
export const findConfig = (startDir: string): string | null => {
  let currentDir = resolve(startDir);

  // Walk up until we find tsonic.json or hit root
  while (true) {
    const configPath = join(currentDir, "tsonic.json");
    if (existsSync(configPath)) {
      return configPath;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      // Hit root
      return null;
    }
    currentDir = parentDir;
  }
};

/**
 * Auto-detect output type based on entry point and project structure
 */
const autoDetectOutputType = (entryPoint: string | undefined): OutputType => {
  // If no entry point, default to library
  if (!entryPoint) {
    return "library";
  }

  // If entry point is provided, default to executable
  // The user specified an entry point, so they want a runnable program
  return "executable";
};

/**
 * Resolve output configuration from config + CLI options
 */
const resolveOutputConfig = (
  config: TsonicConfig,
  cliOptions: CliOptions,
  entryPoint: string | undefined
): TsonicOutputConfig => {
  const configOutput = config.output ?? {};

  // Determine output type
  const outputType =
    cliOptions.type ?? configOutput.type ?? autoDetectOutputType(entryPoint);

  // Base config from file
  const baseConfig: TsonicOutputConfig = {
    type: outputType,
    name: configOutput.name ?? config.outputName,
  };

  // Merge executable-specific options
  if (outputType === "executable") {
    return {
      ...baseConfig,
      nativeAot: cliOptions.noAot ? false : (configOutput.nativeAot ?? true),
      singleFile: cliOptions.singleFile ?? configOutput.singleFile ?? true,
      trimmed: configOutput.trimmed ?? true,
      stripSymbols: cliOptions.noStrip
        ? false
        : (configOutput.stripSymbols ?? config.buildOptions?.stripSymbols ?? true),
      optimization:
        cliOptions.optimize ??
        config.optimize ??
        configOutput.optimization ??
        "speed",
      invariantGlobalization:
        configOutput.invariantGlobalization ??
        config.buildOptions?.invariantGlobalization ??
        true,
      selfContained:
        cliOptions.selfContained ?? configOutput.selfContained ?? true,
    };
  }

  // Merge library-specific options
  if (outputType === "library") {
    return {
      ...baseConfig,
      targetFrameworks: configOutput.targetFrameworks ?? [
        config.dotnetVersion ?? "net10.0",
      ],
      generateDocumentation:
        cliOptions.generateDocs ?? configOutput.generateDocumentation ?? true,
      includeSymbols:
        cliOptions.includeSymbols ?? configOutput.includeSymbols ?? true,
      packable: cliOptions.pack ?? configOutput.packable ?? false,
      package: configOutput.package,
    };
  }

  // Console app (non-NativeAOT) output
  if (outputType === "console-app") {
    return {
      ...baseConfig,
      targetFramework:
        cliOptions.targetFramework ??
        configOutput.targetFramework ??
        config.dotnetVersion ??
        "net10.0",
      singleFile: cliOptions.singleFile ?? configOutput.singleFile ?? true,
      selfContained:
        cliOptions.selfContained ?? configOutput.selfContained ?? true,
    };
  }

  // Unknown output type - preserve for downstream error handling.
  return baseConfig;
};

/**
 * Resolve final configuration from file + CLI args
 * @param projectRoot - Directory containing tsonic.json/package.json (for package resolution)
 */
export const resolveConfig = (
  config: TsonicConfig,
  cliOptions: CliOptions,
  projectRoot: string,
  entryFile?: string
): ResolvedConfig => {
  const entryPoint = entryFile ?? config.entryPoint;
  const sourceRoot =
    cliOptions.src ??
    config.sourceRoot ??
    (entryPoint ? dirname(entryPoint) : "src");

  // Default type roots
  // Only ambient globals packages need typeRoots - explicit import packages are resolved normally
  const defaultTypeRoots = ["node_modules/@tsonic/globals"];
  const typeRoots = config.dotnet?.typeRoots ?? defaultTypeRoots;

  // Merge libraries from config and CLI
  const configLibraries = config.dotnet?.libraries ?? [];
  const cliLibraries = cliOptions.lib ?? [];
  const libraries = [...configLibraries, ...cliLibraries];

  const rawFrameworkReferences = config.dotnet?.frameworkReferences ?? [];
  const frameworkReferences = rawFrameworkReferences.map((r) =>
    typeof r === "string" ? r : r.id
  );
  const packageReferences = (config.dotnet?.packageReferences ?? []).map((p) => ({
    id: p.id,
    version: p.version,
  }));

  // Resolve output configuration
  const outputConfig = resolveOutputConfig(config, cliOptions, entryPoint);

  return {
    rootNamespace: cliOptions.namespace ?? config.rootNamespace,
    namingPolicy: config.namingPolicy,
    entryPoint,
    projectRoot,
    sourceRoot,
    outputDirectory: config.outputDirectory ?? "generated",
    outputName: cliOptions.out ?? config.outputName ?? "app",
    rid: cliOptions.rid ?? config.rid ?? detectRid(),
    dotnetVersion: config.dotnetVersion ?? "net10.0",
    optimize:
      cliOptions.optimize ??
      config.optimize ??
      config.output?.optimization ??
      "speed",
    outputConfig,
    stripSymbols: cliOptions.noStrip
      ? false
      : (config.output?.stripSymbols ?? config.buildOptions?.stripSymbols ?? true),
    invariantGlobalization:
      config.output?.invariantGlobalization ??
      config.buildOptions?.invariantGlobalization ??
      true,
    keepTemp: cliOptions.keepTemp ?? false,
    verbose: cliOptions.verbose ?? false,
    quiet: cliOptions.quiet ?? false,
    typeRoots,
    libraries,
    frameworkReferences,
    packageReferences,
  };
};
