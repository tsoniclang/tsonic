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
        : (configOutput.stripSymbols ?? true),
      optimization: cliOptions.optimize ?? configOutput.optimization ?? "speed",
      invariantGlobalization:
        config.buildOptions?.invariantGlobalization ?? true,
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

  // Console app fallback
  return {
    ...baseConfig,
    singleFile: cliOptions.singleFile ?? configOutput.singleFile ?? true,
    selfContained:
      cliOptions.selfContained ?? configOutput.selfContained ?? true,
  };
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

  // Default type roots based on runtime mode
  // Only ambient globals packages need typeRoots - explicit import packages are resolved normally
  const runtime = config.runtime ?? "js";
  const defaultTypeRoots =
    runtime === "js"
      ? ["node_modules/@tsonic/js-globals"]
      : ["node_modules/@tsonic/dotnet-globals"];
  const typeRoots = config.dotnet?.typeRoots ?? defaultTypeRoots;

  // Merge libraries from config and CLI
  const configLibraries = config.dotnet?.libraries ?? [];
  const cliLibraries = cliOptions.lib ?? [];
  const libraries = [...configLibraries, ...cliLibraries];

  // Resolve output configuration
  const outputConfig = resolveOutputConfig(config, cliOptions, entryPoint);

  return {
    rootNamespace: cliOptions.namespace ?? config.rootNamespace,
    entryPoint,
    projectRoot,
    sourceRoot,
    outputDirectory: config.outputDirectory ?? "generated",
    outputName: cliOptions.out ?? config.outputName ?? "app",
    rid: cliOptions.rid ?? config.rid ?? detectRid(),
    dotnetVersion: config.dotnetVersion ?? "net10.0",
    optimize: cliOptions.optimize ?? config.optimize ?? "speed",
    runtime: config.runtime ?? "js",
    // Only include user-specified packages
    // Runtime DLLs are bundled with @tsonic/tsonic and added as assembly references
    packages: config.dotnet?.packages ?? config.packages ?? [],
    outputConfig,
    stripSymbols: cliOptions.noStrip
      ? false
      : (config.buildOptions?.stripSymbols ?? true),
    invariantGlobalization: config.buildOptions?.invariantGlobalization ?? true,
    keepTemp: cliOptions.keepTemp ?? false,
    verbose: cliOptions.verbose ?? false,
    quiet: cliOptions.quiet ?? false,
    typeRoots,
    libraries,
  };
};
