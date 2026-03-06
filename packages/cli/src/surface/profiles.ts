import type { SurfaceMode } from "../types.js";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type SurfaceProfile = {
  readonly mode: SurfaceMode;
  readonly extends: readonly SurfaceMode[];
  readonly requiredTypeRoots: readonly string[];
  readonly requiredNpmPackages: readonly string[];
  readonly useStandardLib: boolean;
};

export type SurfaceCapabilities = {
  readonly mode: SurfaceMode;
  readonly includesClr: boolean;
  readonly requiredTypeRoots: readonly string[];
  readonly requiredNpmPackages: readonly string[];
  readonly useStandardLib: boolean;
};

type SurfaceManifest = {
  readonly schemaVersion?: unknown;
  readonly id?: unknown;
  readonly extends?: unknown;
  readonly requiredTypeRoots?: unknown;
  readonly requiredNpmPackages?: unknown;
  readonly useStandardLib?: unknown;
};

type ResolveSurfaceOptions = {
  readonly workspaceRoot?: string;
};

const BUILTIN_SURFACE_PROFILES: Readonly<Record<string, SurfaceProfile>> = {
  clr: {
    mode: "clr",
    extends: [],
    requiredTypeRoots: ["node_modules/@tsonic/globals"],
    requiredNpmPackages: ["@tsonic/globals", "@tsonic/dotnet"],
    useStandardLib: false,
  },
};

const mergeUnique = <T>(values: readonly (readonly T[])[]): readonly T[] => {
  const merged = new Set<T>();
  for (const bucket of values) {
    for (const value of bucket) {
      merged.add(value);
    }
  }
  return Array.from(merged);
};

const BUILTIN_SURFACE_MODE_SET = new Set<string>(
  Object.keys(BUILTIN_SURFACE_PROFILES)
);

const normalizeSurfaceMode = (mode: SurfaceMode | undefined): SurfaceMode => {
  if (typeof mode !== "string") return "clr";
  const trimmed = mode.trim();
  return trimmed.length > 0 ? trimmed : "clr";
};

type ResolvedSurfacePackage = {
  readonly packageName: string;
  readonly packageRoot: string;
};

const readPackageName = (pkgJsonPath: string): string | undefined => {
  if (!existsSync(pkgJsonPath)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as {
      readonly name?: unknown;
    };
    return typeof parsed.name === "string" ? parsed.name : undefined;
  } catch {
    return undefined;
  }
};

const sortVersionDirs = (dirs: readonly string[]): readonly string[] => {
  return [...dirs].sort((left, right) => {
    const leftNum = Number.parseInt(left, 10);
    const rightNum = Number.parseInt(right, 10);
    const leftIsNum = Number.isFinite(leftNum);
    const rightIsNum = Number.isFinite(rightNum);
    if (leftIsNum && rightIsNum) return rightNum - leftNum;
    if (leftIsNum) return -1;
    if (rightIsNum) return 1;
    return right.localeCompare(left);
  });
};

const tryResolveSiblingSurfacePackage = (
  candidate: string
): ResolvedSurfacePackage | undefined => {
  const scoped = candidate.match(/^@tsonic\/([^/]+)$/);
  if (!scoped) return undefined;
  const pkgDirName = scoped[1];
  if (!pkgDirName) return undefined;

  const here = fileURLToPath(import.meta.url);
  const repoRoot = resolve(dirname(here), "../../../../");
  const siblingRepoRoot = resolve(repoRoot, "..", pkgDirName);

  const repoPackageName = readPackageName(
    join(siblingRepoRoot, "package.json")
  );
  if (repoPackageName === candidate) {
    return { packageName: candidate, packageRoot: siblingRepoRoot };
  }

  const versionsRoot = join(siblingRepoRoot, "versions");
  if (!existsSync(versionsRoot)) return undefined;

  const versionDirs = sortVersionDirs(
    readdirSync(versionsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  );

  for (const versionDir of versionDirs) {
    const candidateRoot = join(versionsRoot, versionDir);
    const name = readPackageName(join(candidateRoot, "package.json"));
    if (name === candidate) {
      return { packageName: candidate, packageRoot: candidateRoot };
    }
  }

  return undefined;
};

const getSurfacePackageName = (mode: SurfaceMode): string | undefined => {
  const trimmed = mode.trim();
  if (trimmed.length === 0 || trimmed === "clr") return undefined;
  return trimmed;
};

const resolveSurfacePackage = (
  mode: SurfaceMode,
  workspaceRoot: string
): ResolvedSurfacePackage | undefined => {
  const req = createRequire(join(workspaceRoot, "package.json"));
  const packageName = getSurfacePackageName(mode);
  if (!packageName) return undefined;

  const sibling = tryResolveSiblingSurfacePackage(packageName);

  try {
    const pkgJsonPath = req.resolve(`${packageName}/package.json`);
    const installed = { packageName, packageRoot: dirname(pkgJsonPath) };
    if (existsSync(join(installed.packageRoot, "tsonic.surface.json"))) {
      return installed;
    }
    if (sibling && existsSync(join(sibling.packageRoot, "tsonic.surface.json"))) {
      return sibling;
    }
    return installed;
  } catch {
    if (sibling) return sibling;
    return undefined;
  }
};

const parseManifestStringArray = (
  value: unknown
): readonly string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const values = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return values.length > 0 ? values : [];
};

const normalizeExtendsMode = (
  mode: SurfaceMode,
  parentMode: SurfaceMode
): SurfaceMode => {
  const trimmedParent = parentMode.trim();
  if (trimmedParent.length === 0) return trimmedParent;
  if (trimmedParent === "clr" || trimmedParent.includes("/")) {
    return trimmedParent;
  }
  const scopedMatch = mode.match(/^(@[^/]+)\/[^/]+$/);
  if (scopedMatch?.[1]) {
    return `${scopedMatch[1]}/${trimmedParent}`;
  }
  return trimmedParent;
};

const resolveManifestTypeRoots = (
  packageRoot: string,
  requiredTypeRoots: readonly string[] | undefined
): readonly string[] => {
  const roots =
    requiredTypeRoots && requiredTypeRoots.length > 0
      ? requiredTypeRoots
      : ["."];
  return roots.map((entry) =>
    isAbsolute(entry) ? entry : resolve(packageRoot, entry)
  );
};

const loadCustomSurfaceProfile = (
  mode: SurfaceMode,
  workspaceRoot: string
): SurfaceProfile | undefined => {
  const resolvedPackage = resolveSurfacePackage(mode, workspaceRoot);
  if (!resolvedPackage) return undefined;
  const packageRoot = resolvedPackage.packageRoot;

  const manifestPath = join(packageRoot, "tsonic.surface.json");
  if (!existsSync(manifestPath)) return undefined;

  let parsed: SurfaceManifest;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf-8")) as SurfaceManifest;
  } catch {
    return undefined;
  }

  const extendsList = (parseManifestStringArray(parsed.extends) ?? []).map(
    (parent) => normalizeExtendsMode(mode, parent)
  );
  const typeRoots = resolveManifestTypeRoots(
    packageRoot,
    parseManifestStringArray(parsed.requiredTypeRoots)
  );
  const requiredNpmPackages = parseManifestStringArray(
    parsed.requiredNpmPackages
  ) ?? [resolvedPackage.packageName];
  const useStandardLib = parsed.useStandardLib === true;

  return {
    mode,
    extends: extendsList,
    requiredTypeRoots: typeRoots,
    requiredNpmPackages,
    useStandardLib,
  };
};

const getSurfaceProfile = (
  mode: SurfaceMode,
  options: ResolveSurfaceOptions
): SurfaceProfile => {
  if (options.workspaceRoot) {
    const custom = loadCustomSurfaceProfile(mode, options.workspaceRoot);
    if (custom) return custom;
  }

  if (BUILTIN_SURFACE_MODE_SET.has(mode)) {
    return BUILTIN_SURFACE_PROFILES[mode] as SurfaceProfile;
  }

  return {
    mode,
    extends: [],
    requiredTypeRoots: [],
    requiredNpmPackages: [],
    useStandardLib: false,
  };
};

const resolveProfileChain = (
  mode: SurfaceMode,
  options: ResolveSurfaceOptions
): readonly SurfaceProfile[] => {
  const seen = new Set<SurfaceMode>();
  const ordered: SurfaceProfile[] = [];

  const visit = (currentMode: SurfaceMode): void => {
    if (seen.has(currentMode)) return;
    seen.add(currentMode);
    const profile = getSurfaceProfile(currentMode, options);
    for (const parent of profile.extends) {
      visit(parent);
    }
    ordered.push(profile);
  };

  visit(mode);
  return ordered;
};

export const resolveSurfaceCapabilities = (
  mode: SurfaceMode | undefined,
  options: ResolveSurfaceOptions = {}
): SurfaceCapabilities => {
  const normalizedMode = normalizeSurfaceMode(mode);
  const chain = resolveProfileChain(normalizedMode, options);
  return {
    mode: normalizedMode,
    includesClr: chain.some((profile) => profile.mode === "clr"),
    requiredTypeRoots: mergeUnique(
      chain.map((profile) => profile.requiredTypeRoots)
    ),
    requiredNpmPackages: mergeUnique(
      chain.map((profile) => profile.requiredNpmPackages)
    ),
    useStandardLib: chain.some((profile) => profile.useStandardLib),
  };
};

export const hasResolvedSurfaceProfile = (
  mode: SurfaceMode | undefined,
  options: ResolveSurfaceOptions = {}
): boolean => {
  const normalizedMode = normalizeSurfaceMode(mode);
  if (BUILTIN_SURFACE_MODE_SET.has(normalizedMode)) return true;
  if (!options.workspaceRoot) return false;
  return loadCustomSurfaceProfile(normalizedMode, options.workspaceRoot) !== undefined;
};

export const isSurfaceMode = (value: unknown): value is SurfaceMode =>
  typeof value === "string" && value.trim().length > 0;
