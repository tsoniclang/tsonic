import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const packageNameCache = new Map<string, string>();
const installedPackageRootCache = new Map<string, string>();
const workspacePackageIndexCache = new Map<
  string,
  ReadonlyMap<string, string>
>();

const readPackageName = (pkgJsonPath: string): string | undefined => {
  if (!fs.existsSync(pkgJsonPath)) return undefined;
  const normalizedPath = path.resolve(pkgJsonPath);
  const cached = packageNameCache.get(normalizedPath);
  if (cached !== undefined) return cached;
  try {
    const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as {
      readonly name?: unknown;
    };
    if (typeof parsed.name === "string") {
      packageNameCache.set(normalizedPath, parsed.name);
      return parsed.name;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

const isSourcePackageRoot = (packageRoot: string): boolean => {
  const manifestPath = path.join(packageRoot, "tsonic.package.json");
  if (!fs.existsSync(manifestPath)) {
    return false;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
      readonly kind?: unknown;
    };
    return parsed.kind === "tsonic-source-package";
  } catch {
    return false;
  }
};

const isVersionedPackageRoot = (packageRoot: string): boolean =>
  path.basename(path.dirname(path.resolve(packageRoot))) === "versions";

const shouldPreferWorkspaceCandidate = (
  existingRoot: string | undefined,
  candidateRoot: string
): boolean => {
  if (!existingRoot) {
    return true;
  }

  const existingIsSourcePackage = isSourcePackageRoot(existingRoot);
  const candidateIsSourcePackage = isSourcePackageRoot(candidateRoot);
  if (candidateIsSourcePackage !== existingIsSourcePackage) {
    return candidateIsSourcePackage;
  }

  const existingIsVersioned = isVersionedPackageRoot(existingRoot);
  const candidateIsVersioned = isVersionedPackageRoot(candidateRoot);
  if (candidateIsVersioned !== existingIsVersioned) {
    return candidateIsVersioned;
  }

  return false;
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

const splitPackageNameSegments = (packageName: string): readonly string[] =>
  packageName.startsWith("@") ? packageName.split("/") : [packageName];

const normalizeWorkspaceLookupRoot = (packageRoot: string): string => {
  const absoluteRoot = path.resolve(packageRoot);
  try {
    return fs.realpathSync(absoluteRoot);
  } catch {
    return absoluteRoot;
  }
};

const getRepoRoot = (packageRoot: string): string => {
  const absoluteRoot = normalizeWorkspaceLookupRoot(packageRoot);
  if (path.basename(path.dirname(absoluteRoot)) === "versions") {
    return path.dirname(path.dirname(absoluteRoot));
  }
  return absoluteRoot;
};

const findNearestPackageRoot = (
  resolvedFilePath: string
): string | undefined => {
  if (!path.isAbsolute(resolvedFilePath)) {
    return undefined;
  }

  let currentDir = path.dirname(path.resolve(resolvedFilePath));

  for (;;) {
    if (fs.existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return undefined;
    }
    currentDir = parentDir;
  }
};

const tryResolveInstalledPackage = (
  packageRoot: string,
  packageName: string
): string | undefined => {
  const cacheKey = `${path.resolve(packageRoot)}::${packageName}`;
  const cached = installedPackageRootCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const packageSegments = splitPackageNameSegments(packageName);
  let currentDir = path.resolve(packageRoot);

  for (;;) {
    const candidate = path.join(currentDir, "node_modules", ...packageSegments);
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      installedPackageRootCache.set(cacheKey, candidate);
      return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  const packageJsonPath = path.join(packageRoot, "package.json");
  const req = createRequire(
    fs.existsSync(packageJsonPath)
      ? packageJsonPath
      : path.join(packageRoot, "__tsonic_require__.js")
  );

  try {
    const pkgJsonPath = req.resolve(`${packageName}/package.json`);
    const resolvedRoot = path.dirname(pkgJsonPath);
    installedPackageRootCache.set(cacheKey, resolvedRoot);
    return resolvedRoot;
  } catch {
  try {
    const entryPath = req.resolve(packageName);
    if (!path.isAbsolute(entryPath)) {
      return undefined;
    }
    const resolvedRoot = findNearestPackageRoot(entryPath);
    if (resolvedRoot) {
      installedPackageRootCache.set(cacheKey, resolvedRoot);
      return resolvedRoot;
    }
    } catch {
      // ignore and fall through
    }
    return undefined;
  }
};

const buildWorkspacePackageIndex = (
  workspaceRoot: string
): ReadonlyMap<string, string> => {
  const normalizedWorkspaceRoot = path.resolve(workspaceRoot);
  const cached = workspacePackageIndexCache.get(normalizedWorkspaceRoot);
  if (cached !== undefined) {
    return cached;
  }

  const packageIndex = new Map<string, string>();
  if (!fs.existsSync(normalizedWorkspaceRoot)) {
    workspacePackageIndexCache.set(normalizedWorkspaceRoot, packageIndex);
    return packageIndex;
  }

  const entries = fs.readdirSync(normalizedWorkspaceRoot, {
    withFileTypes: true,
  });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const siblingRoot = path.join(normalizedWorkspaceRoot, entry.name);
    const siblingName = readPackageName(path.join(siblingRoot, "package.json"));
    if (
      siblingName &&
      shouldPreferWorkspaceCandidate(packageIndex.get(siblingName), siblingRoot)
    ) {
      packageIndex.set(siblingName, siblingRoot);
    }

    const versionsRoot = path.join(siblingRoot, "versions");
    if (!fs.existsSync(versionsRoot)) {
      continue;
    }

    const versionDirs = sortVersionDirs(
      fs
        .readdirSync(versionsRoot, { withFileTypes: true })
        .filter((versionEntry) => versionEntry.isDirectory())
        .map((versionEntry) => versionEntry.name)
    );

    for (const versionDir of versionDirs) {
      const candidateRoot = path.join(versionsRoot, versionDir);
      const candidateName = readPackageName(
        path.join(candidateRoot, "package.json")
      );
      if (
        candidateName &&
        shouldPreferWorkspaceCandidate(
          packageIndex.get(candidateName),
          candidateRoot
        )
      ) {
        packageIndex.set(candidateName, candidateRoot);
      }
    }
  }

  workspacePackageIndexCache.set(normalizedWorkspaceRoot, packageIndex);
  return packageIndex;
};

const tryResolveSiblingWorkspacePackage = (
  packageRoot: string,
  packageName: string
): string | undefined => {
  const repoRoot = getRepoRoot(packageRoot);
  const workspaceRoot = path.dirname(repoRoot);
  return buildWorkspacePackageIndex(workspaceRoot).get(packageName);
};

export type DependencyPackageRootPreference =
  | "sibling-first"
  | "installed-first";

export const resolveDependencyPackageRoot = (
  packageRoot: string,
  packageName: string,
  preference: DependencyPackageRootPreference = "sibling-first"
): string | undefined => {
  const trySiblingFirst = (): string | undefined => {
    const sibling = tryResolveSiblingWorkspacePackage(packageRoot, packageName);
    if (sibling) {
      return sibling;
    }

    return tryResolveInstalledPackage(packageRoot, packageName);
  };

  const tryInstalledFirst = (): string | undefined => {
    const installed = tryResolveInstalledPackage(packageRoot, packageName);
    if (installed) {
      return installed;
    }

    return tryResolveSiblingWorkspacePackage(packageRoot, packageName);
  };

  if (preference === "installed-first") {
    return tryInstalledFirst();
  }

  return trySiblingFirst();
};

export const __resetDependencyPackageRootCachesForTests = (): void => {
  packageNameCache.clear();
  installedPackageRootCache.clear();
  workspacePackageIndexCache.clear();
};
