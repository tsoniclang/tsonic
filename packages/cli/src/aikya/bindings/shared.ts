import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type {
  LibraryReferenceConfig,
  Result,
  TsonicWorkspaceConfig,
} from "../../types.js";
import type { ManifestSurfaceMode, NormalizedBindingsManifest } from "./types.js";

export const AIKYA_DIAGNOSTIC = {
  invalidSchema: "TSN8A01",
  unresolvedRuntime: "TSN8A02",
  conflictingRuntime: "TSN8A03",
  missingBindingsRoot: "TSN8A04",
  missingRuntimeMapping: "TSN8A05",
} as const;

export const normalizeId = (id: string): string => id.trim().toLowerCase();

const libraryReferencePath = (library: LibraryReferenceConfig): string =>
  typeof library === "string" ? library : library.path;

const localLibraryAssemblyNames = (
  config: TsonicWorkspaceConfig
): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const library of config.dotnet?.libraries ?? []) {
    const rawPath = libraryReferencePath(library).trim();
    if (rawPath.length === 0) continue;
    const file = basename(rawPath).trim();
    if (!file.toLowerCase().endsWith(".dll")) continue;
    const stem = file.slice(0, -4).trim();
    if (stem.length === 0) continue;
    names.add(normalizeId(stem));
  }
  return names;
};

export const manifestIsSatisfiedByLocalLibrary = (
  config: TsonicWorkspaceConfig,
  manifest: NormalizedBindingsManifest
): boolean => {
  if (!manifest.assemblyName || manifest.assemblyName.trim().length === 0) {
    return false;
  }
  return localLibraryAssemblyNames(config).has(
    normalizeId(manifest.assemblyName)
  );
};

export const errorWithCode = (
  code: string,
  message: string
): Result<never, string> => {
  return { ok: false, error: `${code}: ${message}` };
};

export const isSurfaceMode = (value: unknown): value is ManifestSurfaceMode =>
  typeof value === "string" && value.trim().length > 0;

export const readJsonObject = (
  path: string,
  parseErrorCode: string
): Result<Record<string, unknown>, string> => {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return errorWithCode(parseErrorCode, `Expected JSON object at ${path}`);
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (error) {
    return errorWithCode(
      parseErrorCode,
      `Failed to parse JSON at ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};
