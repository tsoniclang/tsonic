import type { SurfaceMode } from "../program/types.js";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";

type SurfaceProfile = {
  readonly mode: SurfaceMode;
  readonly extends: readonly SurfaceMode[];
  readonly requiredTypeRoots: readonly string[];
};

export type SurfaceCapabilities = {
  readonly mode: SurfaceMode;
  readonly includesClr: boolean;
  readonly resolvedModes: readonly SurfaceMode[];
  readonly requiredTypeRoots: readonly string[];
};

export const surfaceIncludesMode = (
  capabilities: Pick<SurfaceCapabilities, "resolvedModes">,
  mode: SurfaceMode
): boolean => capabilities.resolvedModes.includes(mode);

export const surfaceIncludesJs = (
  capabilities: Pick<SurfaceCapabilities, "resolvedModes">
): boolean => surfaceIncludesMode(capabilities, "@tsonic/js");

type SurfaceManifest = {
  readonly schemaVersion?: unknown;
  readonly id?: unknown;
  readonly extends?: unknown;
  readonly requiredTypeRoots?: unknown;
};

type ResolveSurfaceOptions = {
  readonly projectRoot?: string;
  readonly authoritativePackageRoots?: ReadonlyMap<string, string>;
};

const BUILTIN_SURFACE_PROFILES: Readonly<Record<string, SurfaceProfile>> = {
  clr: {
    mode: "clr",
    extends: [],
    requiredTypeRoots: ["node_modules/@tsonic/globals"],
  },
};

const mergeUnique = <T>(buckets: readonly (readonly T[])[]): readonly T[] => {
  const merged = new Set<T>();
  for (const bucket of buckets) {
    for (const value of bucket) {
      merged.add(value);
    }
  }
  return Array.from(merged);
};

const BUILTIN_SURFACE_MODE_SET = new Set<string>(
  Object.keys(BUILTIN_SURFACE_PROFILES)
);

const isBuiltInSurfaceMode = (value: string): boolean =>
  BUILTIN_SURFACE_MODE_SET.has(value);

const normalizeSurfaceMode = (mode: SurfaceMode | undefined): SurfaceMode => {
  if (typeof mode !== "string") return "clr";
  const trimmed = mode.trim();
  return trimmed.length > 0 ? trimmed : "clr";
};

type ResolvedSurfacePackage = {
  readonly packageName: string;
  readonly packageRoot: string;
};

const isSourceSurfacePackageRoot = (packageRoot: string): boolean => {
  const manifestPath = join(packageRoot, "tsonic.package.json");
  if (!existsSync(manifestPath)) return false;

  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      readonly kind?: unknown;
    };
    return parsed.kind === "tsonic-source-package";
  } catch {
    return false;
  }
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

const resolveSiblingSearchRoots = (projectRoot: string): readonly string[] => {
  const roots = new Set<string>();
  for (const candidateRoot of findAncestorLookupRoots(projectRoot)) {
    roots.add(resolve(candidateRoot));
    roots.add(resolve(candidateRoot, ".."));
  }
  return Array.from(roots);
};

const tryResolveSiblingSurfacePackage = (
  candidate: string,
  projectRoot: string
): ResolvedSurfacePackage | undefined => {
  const scoped = candidate.match(/^@tsonic\/([^/]+)$/);
  if (!scoped) return undefined;
  const pkgDirName = scoped[1];
  if (!pkgDirName) return undefined;

  for (const searchRoot of resolveSiblingSearchRoots(projectRoot)) {
    const siblingRepoRoot = join(searchRoot, pkgDirName);

    const repoPackageName = readPackageName(
      join(siblingRepoRoot, "package.json")
    );
    if (repoPackageName === candidate) {
      return { packageName: candidate, packageRoot: siblingRepoRoot };
    }

    const versionsRoot = join(siblingRepoRoot, "versions");
    if (!existsSync(versionsRoot)) {
      continue;
    }

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
  }

  return undefined;
};

const getSurfacePackageName = (mode: SurfaceMode): string | undefined => {
  const trimmed = mode.trim();
  if (trimmed.length === 0 || trimmed === "clr") return undefined;
  return trimmed;
};

const findAncestorLookupRoots = (projectRoot: string): readonly string[] => {
  const roots: string[] = [];
  let current = resolve(projectRoot);
  let encounteredPackageJson = false;

  for (;;) {
    const hasPackageJson = existsSync(join(current, "package.json"));
    if (!encounteredPackageJson || hasPackageJson) {
      roots.push(current);
    }
    if (hasPackageJson) {
      encounteredPackageJson = true;
    }

    const parent = dirname(current);
    if (parent === current) {
      return roots;
    }
    current = parent;
  }
};

const tryResolveWorkspaceInstalledSurfacePackage = (
  packageName: string,
  projectRoot: string
): ResolvedSurfacePackage | undefined => {
  const packagePathParts = packageName.startsWith("@")
    ? packageName.split("/")
    : [packageName];
  const candidateRoot = join(projectRoot, "node_modules", ...packagePathParts);
  if (!existsSync(join(candidateRoot, "package.json"))) {
    return undefined;
  }

  try {
    return {
      packageName,
      packageRoot: realpathSync(candidateRoot),
    };
  } catch {
    return {
      packageName,
      packageRoot: resolve(candidateRoot),
    };
  }
};

const tryResolveProjectInstalledSurfacePackage = (
  packageName: string,
  projectRoot: string
): ResolvedSurfacePackage | undefined => {
  for (const candidateRoot of findAncestorLookupRoots(projectRoot)) {
    const installed = tryResolveWorkspaceInstalledSurfacePackage(
      packageName,
      candidateRoot
    );
    if (installed) {
      return installed;
    }
  }

  return undefined;
};

const resolveSurfacePackage = (
  mode: SurfaceMode,
  projectRoot: string,
  options: ResolveSurfaceOptions
): ResolvedSurfacePackage | undefined => {
  const req = createRequire(join(projectRoot, "package.json"));
  const packageName = getSurfacePackageName(mode);
  if (!packageName) return undefined;

  const authoritativePackageRoot =
    options.authoritativePackageRoots?.get(packageName);
  if (authoritativePackageRoot) {
    return {
      packageName,
      packageRoot: authoritativePackageRoot,
    };
  }

  const workspaceInstalled = tryResolveProjectInstalledSurfacePackage(
    packageName,
    projectRoot
  );
  if (
    workspaceInstalled &&
    isSourceSurfacePackageRoot(workspaceInstalled.packageRoot)
  ) {
    return workspaceInstalled;
  }

  const sibling = tryResolveSiblingSurfacePackage(packageName, projectRoot);
  if (sibling && isSourceSurfacePackageRoot(sibling.packageRoot)) {
    return sibling;
  }

  if (
    workspaceInstalled &&
    existsSync(join(workspaceInstalled.packageRoot, "tsonic.surface.json"))
  ) {
    return workspaceInstalled;
  }

  try {
    const pkgJsonPath = req.resolve(`${packageName}/package.json`);
    const installed = { packageName, packageRoot: dirname(pkgJsonPath) };
    if (isSourceSurfacePackageRoot(installed.packageRoot)) {
      return installed;
    }
    if (
      sibling &&
      existsSync(join(sibling.packageRoot, "tsonic.surface.json"))
    ) {
      return sibling;
    }
    if (existsSync(join(installed.packageRoot, "tsonic.surface.json"))) {
      return installed;
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
  options: ResolveSurfaceOptions
): SurfaceProfile | undefined => {
  const projectRoot = options.projectRoot;
  if (!projectRoot) {
    return undefined;
  }

  const resolvedPackage = resolveSurfacePackage(mode, projectRoot, options);
  if (!resolvedPackage) return undefined;
  const packageRoot = resolvedPackage.packageRoot;
  const manifestPath = join(packageRoot, "tsonic.surface.json");

  if (existsSync(manifestPath)) {
    let parsed: SurfaceManifest;
    try {
      parsed = JSON.parse(
        readFileSync(manifestPath, "utf-8")
      ) as SurfaceManifest;
    } catch {
      return undefined;
    }

    const extendsList = (parseManifestStringArray(parsed.extends) ?? []).map(
      (parent) => normalizeExtendsMode(mode, parent)
    );
    const requiredTypeRoots = resolveManifestTypeRoots(
      packageRoot,
      parseManifestStringArray(parsed.requiredTypeRoots)
    );
    return {
      mode,
      extends: extendsList,
      requiredTypeRoots,
    };
  }

  if (isSourceSurfacePackageRoot(packageRoot)) {
    return {
      mode,
      extends: [],
      requiredTypeRoots: [packageRoot],
    };
  }

  return undefined;
};

const getSurfaceProfile = (
  mode: SurfaceMode,
  options: ResolveSurfaceOptions
): SurfaceProfile => {
  const projectRoot = options.projectRoot;
  if (projectRoot) {
    const custom = loadCustomSurfaceProfile(mode, options);
    if (custom) return custom;
  }

  if (isBuiltInSurfaceMode(mode)) {
    return BUILTIN_SURFACE_PROFILES[mode] as SurfaceProfile;
  }

  return {
    mode,
    extends: [],
    requiredTypeRoots: [],
  };
};

const resolveProfileChain = (
  mode: SurfaceMode,
  options: ResolveSurfaceOptions
): readonly SurfaceProfile[] => {
  const seen = new Set<SurfaceMode>();
  const chain: SurfaceProfile[] = [];

  const visit = (currentMode: SurfaceMode): void => {
    if (seen.has(currentMode)) return;
    seen.add(currentMode);
    const profile = getSurfaceProfile(currentMode, options);
    for (const parent of profile.extends) {
      visit(parent);
    }
    chain.push(profile);
  };

  visit(mode);
  return chain;
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
    resolvedModes: chain.map((profile) => profile.mode),
    requiredTypeRoots: mergeUnique(
      chain.map((profile) => profile.requiredTypeRoots)
    ),
  };
};

export const hasResolvedSurfaceProfile = (
  mode: SurfaceMode | undefined,
  options: ResolveSurfaceOptions = {}
): boolean => {
  const normalizedMode = normalizeSurfaceMode(mode);
  if (BUILTIN_SURFACE_MODE_SET.has(normalizedMode)) return true;
  if (!options.projectRoot) return false;
  return loadCustomSurfaceProfile(normalizedMode, options) !== undefined;
};
