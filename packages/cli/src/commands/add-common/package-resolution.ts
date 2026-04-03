import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { Result } from "../../types.js";

const findNearestPackageRoot = (resolvedFilePath: string): string | null => {
  let currentDir = dirname(resolvedFilePath);

  for (;;) {
    if (existsSync(join(currentDir, "package.json"))) return currentDir;
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) return null;
    currentDir = parentDir;
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

const isPathWithin = (rootPath: string, candidatePath: string): boolean => {
  const rel = relative(resolve(rootPath), resolve(candidatePath));
  return rel === "" || (!rel.startsWith("..") && rel.length > 0);
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

const resolveMonorepoRoot = (): string => {
  const envRoot = process.env.TSONIC_REPO_ROOT?.trim();
  if (envRoot) {
    return resolve(envRoot);
  }

  const here = fileURLToPath(import.meta.url);
  return resolve(dirname(here), "../../../../../..");
};

const tryResolveSiblingTsonicPackageRoot = (
  packageName: string
): string | undefined => {
  const scoped = packageName.match(/^@tsonic\/([^/]+)$/);
  if (!scoped?.[1]) return undefined;

  const repoRoot = resolveMonorepoRoot();
  const siblingRepoRootCandidates = [
    resolve(repoRoot, "..", scoped[1]),
    resolve(repoRoot, scoped[1]),
  ];

  for (const siblingRepoRoot of siblingRepoRootCandidates) {
    const repoPackageName = readPackageName(
      join(siblingRepoRoot, "package.json")
    );
    if (repoPackageName === packageName) return siblingRepoRoot;

    const versionsRoot = join(siblingRepoRoot, "versions");
    if (!existsSync(versionsRoot)) continue;

    const versionDirs = sortVersionDirs(
      readdirSync(versionsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    );

    for (const versionDir of versionDirs) {
      const candidateRoot = join(versionsRoot, versionDir);
      const candidateName = readPackageName(
        join(candidateRoot, "package.json")
      );
      if (candidateName === packageName) return candidateRoot;
    }
  }

  return undefined;
};

const tryResolveWorkspaceInstalledPackageRoot = (
  projectRoot: string,
  packageName: string
): string | undefined => {
  const parts = packageName.startsWith("@")
    ? packageName.split("/")
    : [packageName];
  const candidateRoot = join(projectRoot, "node_modules", ...parts);
  if (!existsSync(join(candidateRoot, "package.json"))) return undefined;

  try {
    return realpathSync(candidateRoot);
  } catch {
    return resolve(candidateRoot);
  }
};

export const resolveTsbindgenDllPath = (
  projectRoot: string
): Result<string, string> => {
  const tryResolve = (req: ReturnType<typeof createRequire>): string | null => {
    try {
      const entryPath = req.resolve("@tsonic/tsbindgen");
      const pkgRoot = findNearestPackageRoot(entryPath);
      if (!pkgRoot) return null;
      const dllPath = join(pkgRoot, "lib", "tsbindgen.dll");
      return existsSync(dllPath) ? dllPath : null;
    } catch {
      return null;
    }
  };

  const projectPkgJson = join(projectRoot, "package.json");
  const projectReq = existsSync(projectPkgJson)
    ? createRequire(projectPkgJson)
    : null;

  const selfReq = createRequire(import.meta.url);
  const selfBundled = (() => {
    const resolved = tryResolve(selfReq);
    if (!resolved) {
      return null;
    }

    return isPathWithin(resolveMonorepoRoot(), resolved) ? resolved : null;
  })();

  const direct =
    (projectReq ? tryResolve(projectReq) : null) ??
    selfBundled ??
    tryResolve(selfReq);
  if (direct) return { ok: true, value: direct };

  return {
    ok: false,
    error:
      "tsbindgen not found. Install '@tsonic/tsbindgen' (recommended) or ensure it is available in node_modules.",
  };
};

export const resolvePackageRoot = (
  projectRoot: string,
  packageName: string
): Result<string, string> => {
  const workspaceInstalled = tryResolveWorkspaceInstalledPackageRoot(
    projectRoot,
    packageName
  );
  if (workspaceInstalled) return { ok: true, value: workspaceInstalled };

  const sibling = tryResolveSiblingTsonicPackageRoot(packageName);
  if (sibling) return { ok: true, value: sibling };

  const projectPkgJson = join(projectRoot, "package.json");
  const req = createRequire(
    existsSync(projectPkgJson)
      ? projectPkgJson
      : join(projectRoot, "__tsonic_require__.js")
  );

  try {
    const pkgJson = req.resolve(`${packageName}/package.json`);
    return { ok: true, value: dirname(pkgJson) };
  } catch (error) {
    try {
      const entryPath = req.resolve(packageName);
      const pkgRoot = findNearestPackageRoot(entryPath);
      if (pkgRoot) return { ok: true, value: pkgRoot };
    } catch {
      // ignore - fall through to user-friendly error below
    }

    return {
      ok: false,
      error:
        `Missing ${packageName} in node_modules.\n` +
        `Install it (recommended: 'tsonic init') and retry.\n` +
        `${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
