import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const readPackageName = (pkgJsonPath: string): string | undefined => {
  if (!fs.existsSync(pkgJsonPath)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as {
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

const getRepoRoot = (packageRoot: string): string => {
  const absoluteRoot = path.resolve(packageRoot);
  if (path.basename(path.dirname(absoluteRoot)) === "versions") {
    return path.dirname(path.dirname(absoluteRoot));
  }
  return absoluteRoot;
};

const tryResolveInstalledPackage = (
  packageRoot: string,
  packageName: string
): string | undefined => {
  try {
    const req = createRequire(path.join(packageRoot, "package.json"));
    const pkgJsonPath = req.resolve(`${packageName}/package.json`);
    return path.dirname(pkgJsonPath);
  } catch {
    return undefined;
  }
};

const tryResolveSiblingWorkspacePackage = (
  packageRoot: string,
  packageName: string
): string | undefined => {
  const repoRoot = getRepoRoot(packageRoot);
  const workspaceRoot = path.dirname(repoRoot);

  if (!fs.existsSync(workspaceRoot)) {
    return undefined;
  }

  const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const siblingRoot = path.join(workspaceRoot, entry.name);
    const siblingName = readPackageName(path.join(siblingRoot, "package.json"));
    if (siblingName === packageName) {
      return siblingRoot;
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
      if (candidateName === packageName) {
        return candidateRoot;
      }
    }
  }

  return undefined;
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
