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
} from "./types.js";

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
 * Resolve final configuration from file + CLI args
 */
export const resolveConfig = (
  config: TsonicConfig,
  cliOptions: CliOptions,
  entryFile?: string
): ResolvedConfig => {
  const entryPoint = entryFile ?? config.entryPoint ?? "src/main.ts";
  const sourceRoot = cliOptions.src ?? config.sourceRoot ?? dirname(entryPoint);

  return {
    rootNamespace: cliOptions.namespace ?? config.rootNamespace,
    entryPoint,
    sourceRoot,
    outputDirectory: config.outputDirectory ?? "generated",
    outputName: cliOptions.out ?? config.outputName ?? "app",
    rid: cliOptions.rid ?? config.rid ?? detectRid(),
    dotnetVersion: config.dotnetVersion ?? "net10.0",
    optimize: cliOptions.optimize ?? config.optimize ?? "speed",
    packages: config.packages ?? [],
    stripSymbols: cliOptions.noStrip
      ? false
      : (config.buildOptions?.stripSymbols ?? true),
    invariantGlobalization: config.buildOptions?.invariantGlobalization ?? true,
    keepTemp: cliOptions.keepTemp ?? false,
    verbose: cliOptions.verbose ?? false,
    quiet: cliOptions.quiet ?? false,
  };
};
