import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

const tryResolveSiblingTsonicPackageRoot = (
  packageName: string
): string | undefined => {
  const scoped = packageName.match(/^@tsonic\/([^/]+)$/);
  if (!scoped?.[1]) return undefined;

  const here = fileURLToPath(import.meta.url);
  const siblingRepoRootCandidates = [
    resolve(dirname(here), "../../../../../..", scoped[1]),
    resolve(dirname(here), "../../../../..", scoped[1]),
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

  const direct =
    (projectReq ? tryResolve(projectReq) : null) ?? tryResolve(selfReq);
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

    const sibling = tryResolveSiblingTsonicPackageRoot(packageName);
    if (sibling) return { ok: true, value: sibling };

    return {
      ok: false,
      error:
        `Missing ${packageName} in node_modules.\n` +
        `Install it (recommended: 'tsonic init') and retry.\n` +
        `${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
