import { dirname } from "node:path";
import type { Result, TsonicWorkspaceConfig } from "../types.js";
import {
  hasResolvedSurfaceProfile,
  resolveSurfaceCapabilities,
} from "../surface/profiles.js";
import {
  MSBUILD_PROPERTY_NAME_RE,
  WORKSPACE_CONFIG_FILE,
  parseJsonFile,
} from "./shared.js";
import { existsSync } from "node:fs";

const validateReferenceArray = (
  value: unknown,
  pathLabel: string
): Result<void, string> => {
  if (
    value !== undefined &&
    (!Array.isArray(value) ||
      value.some((entry) => {
        if (typeof entry === "string") return false;
        if (entry === null || typeof entry !== "object") return true;
        const id = (entry as { readonly id?: unknown }).id;
        const types = (entry as { readonly types?: unknown }).types;
        if (typeof id !== "string") return true;
        return (
          types !== undefined &&
          types !== false &&
          (typeof types !== "string" || types.trim().length === 0)
        );
      }))
  ) {
    return {
      ok: false,
      error: `${WORKSPACE_CONFIG_FILE}: '${pathLabel}' must be an array of strings or { id: string, types?: string|false }`,
    };
  }
  return { ok: true, value: undefined };
};

const validatePackageReferences = (
  value: unknown,
  pathLabel: string
): Result<void, string> => {
  if (value === undefined) return { ok: true, value: undefined };
  if (!Array.isArray(value)) {
    return {
      ok: false,
      error: `${WORKSPACE_CONFIG_FILE}: '${pathLabel}' must be an array of { id, version }`,
    };
  }

  for (const entry of value as unknown[]) {
    const candidate = entry as {
      readonly id?: unknown;
      readonly version?: unknown;
      readonly types?: unknown;
    };
    if (
      entry === null ||
      typeof entry !== "object" ||
      typeof candidate.id !== "string" ||
      typeof candidate.version !== "string" ||
      (candidate.types !== undefined &&
        candidate.types !== false &&
        (typeof candidate.types !== "string" ||
          String(candidate.types).trim().length === 0))
    ) {
      return {
        ok: false,
        error: `${WORKSPACE_CONFIG_FILE}: '${pathLabel}' entries must be { id: string, version: string, types?: string|false }`,
      };
    }
  }

  return { ok: true, value: undefined };
};

const validateMsbuildProperties = (
  value: unknown,
  pathLabel: string
): Result<void, string> => {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      error: `${WORKSPACE_CONFIG_FILE}: '${pathLabel}' must be an object mapping MSBuild property names to string values`,
    };
  }

  for (const [key, entryValue] of Object.entries(
    value as Record<string, unknown>
  )) {
    if (!MSBUILD_PROPERTY_NAME_RE.test(key)) {
      return {
        ok: false,
        error:
          `${WORKSPACE_CONFIG_FILE}: '${pathLabel}' contains an invalid MSBuild property name: ${key}. ` +
          `Property names must match ${String(MSBUILD_PROPERTY_NAME_RE)}.`,
      };
    }
    if (typeof entryValue !== "string") {
      return {
        ok: false,
        error: `${WORKSPACE_CONFIG_FILE}: '${pathLabel}.${key}' must be a string`,
      };
    }
  }

  return { ok: true, value: undefined };
};

const validateLibraries = (value: unknown): Result<void, string> => {
  if (value === undefined) return { ok: true, value: undefined };
  if (!Array.isArray(value)) {
    return {
      ok: false,
      error: `${WORKSPACE_CONFIG_FILE}: 'dotnet.libraries' must be an array of strings or { path: string, types?: string|false }`,
    };
  }

  for (const entry of value as unknown[]) {
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

  return { ok: true, value: undefined };
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

  if (
    config.surface !== undefined &&
    (typeof config.surface !== "string" || config.surface.trim().length === 0)
  ) {
    return {
      ok: false,
      error: `${WORKSPACE_CONFIG_FILE}: 'surface' must be a non-empty string`,
    };
  }

  if (
    config.surface !== undefined &&
    config.surface.trim() !== "clr" &&
    !hasResolvedSurfaceProfile(config.surface, {
      workspaceRoot: dirname(configPath),
    })
  ) {
    return {
      ok: false,
      error:
        `${WORKSPACE_CONFIG_FILE}: surface '${config.surface}' is not a valid ambient surface package.\n` +
        `Custom surfaces must provide tsonic.surface.json. Use '@tsonic/js' for JS ambient APIs, and add normal packages (for example '@tsonic/nodejs') separately.`,
    };
  }

  const dotnet = (config.dotnet ?? {}) as Record<string, unknown>;
  const testDotnet = (config.testDotnet ?? {}) as Record<string, unknown>;

  const librariesResult = validateLibraries(dotnet.libraries);
  if (!librariesResult.ok) return librariesResult;

  const frameworkResult = validateReferenceArray(
    dotnet.frameworkReferences,
    "dotnet.frameworkReferences"
  );
  if (!frameworkResult.ok) return frameworkResult;

  const packageResult = validatePackageReferences(
    dotnet.packageReferences,
    "dotnet.packageReferences"
  );
  if (!packageResult.ok) return packageResult;

  const typeRoots = dotnet.typeRoots;
  if (
    typeRoots !== undefined &&
    (!Array.isArray(typeRoots) ||
      typeRoots.some((entry) => typeof entry !== "string"))
  ) {
    return {
      ok: false,
      error: `${WORKSPACE_CONFIG_FILE}: 'dotnet.typeRoots' must be an array of strings`,
    };
  }

  const msbuildResult = validateMsbuildProperties(
    dotnet.msbuildProperties,
    "dotnet.msbuildProperties"
  );
  if (!msbuildResult.ok) return msbuildResult;

  const testFrameworkResult = validateReferenceArray(
    testDotnet.frameworkReferences,
    "testDotnet.frameworkReferences"
  );
  if (!testFrameworkResult.ok) return testFrameworkResult;

  const testPackageResult = validatePackageReferences(
    testDotnet.packageReferences,
    "testDotnet.packageReferences"
  );
  if (!testPackageResult.ok) return testPackageResult;

  const testMsbuildResult = validateMsbuildProperties(
    testDotnet.msbuildProperties,
    "testDotnet.msbuildProperties"
  );
  if (!testMsbuildResult.ok) return testMsbuildResult;

  resolveSurfaceCapabilities(config.surface ?? "clr", {
    workspaceRoot: dirname(configPath),
  });

  return { ok: true, value: config };
};
