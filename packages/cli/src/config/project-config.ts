import { existsSync } from "node:fs";
import type { Result, TsonicProjectConfig } from "../types.js";
import {
  PROJECT_CONFIG_FILE,
  WORKSPACE_CONFIG_FILE,
  parseJsonFile,
} from "./shared.js";

export const loadProjectConfig = (
  configPath: string
): Result<TsonicProjectConfig, string> => {
  if (!existsSync(configPath)) {
    return { ok: false, error: `Project config not found: ${configPath}` };
  }

  const parsed = parseJsonFile<Record<string, unknown>>(configPath);
  if (!parsed.ok) return parsed;

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
        libraries.some((entry) => typeof entry !== "string"))
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

  const libraryPackaging = config.output?.libraryPackaging;
  if (libraryPackaging !== undefined && libraryPackaging !== "source-package") {
    return {
      ok: false,
      error:
        `${PROJECT_CONFIG_FILE}: 'output.libraryPackaging' must be 'source-package' when present ` +
        `(got '${String(libraryPackaging)}')`,
    };
  }

  return { ok: true, value: config };
};
