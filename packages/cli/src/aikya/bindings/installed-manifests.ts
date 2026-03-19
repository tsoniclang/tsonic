import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Result } from "../../types.js";
import { resolvePackageRoot } from "../../commands/add-common.js";
import { resolveSurfaceCapabilities } from "../../surface/profiles.js";
import {
  AIKYA_DIAGNOSTIC,
  errorWithCode,
  normalizeId,
  readJsonObject,
} from "./shared.js";
import {
  resolveFromAikyaManifest,
  resolveFromLegacyBindingsManifest,
} from "./manifest-parsing.js";
import type { NormalizedBindingsManifest } from "./types.js";

const readInstalledPackageInfo = (
  packageRoot: string
): Result<{ readonly name: string; readonly version: string }, string> => {
  const packageJsonPath = join(packageRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return {
      ok: false,
      error: `package.json not found for installed npm package: ${packageRoot}`,
    };
  }

  const parsed = readJsonObject(
    packageJsonPath,
    AIKYA_DIAGNOSTIC.invalidSchema
  );
  if (!parsed.ok) return parsed;
  const name = parsed.value.name;
  const version = parsed.value.version;
  if (typeof name !== "string" || name.trim().length === 0) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `Invalid package.json (missing name): ${packageJsonPath}`
    );
  }
  if (typeof version !== "string" || version.trim().length === 0) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `Invalid package.json (missing version): ${packageJsonPath}`
    );
  }
  return { ok: true, value: { name: name.trim(), version: version.trim() } };
};

export const resolveInstalledPackageBindingsManifest = (
  packageRoot: string
): Result<NormalizedBindingsManifest | null, string> => {
  const info = readInstalledPackageInfo(packageRoot);
  if (!info.ok) return info;

  const aikya = resolveFromAikyaManifest(
    packageRoot,
    info.value.name,
    info.value.version
  );
  if (!aikya.ok) return aikya;
  if (aikya.value) return aikya;

  return resolveFromLegacyBindingsManifest(
    packageRoot,
    info.value.name,
    info.value.version
  );
};

export const hasInstalledSourcePackageManifest = (
  packageRoot: string
): Result<boolean, string> => {
  const path = join(packageRoot, "tsonic", "package-manifest.json");
  if (!existsSync(path)) return { ok: true, value: false };

  const parsed = readJsonObject(path, AIKYA_DIAGNOSTIC.invalidSchema);
  if (!parsed.ok) return parsed;

  const schemaVersion = parsed.value.schemaVersion;
  if (schemaVersion !== 1) {
    return errorWithCode(
      AIKYA_DIAGNOSTIC.invalidSchema,
      `schemaVersion must be 1 at ${path}`
    );
  }

  const kind = parsed.value.kind;
  if (kind === "tsonic-source-package") {
    return { ok: true, value: true };
  }
  if (kind === "tsonic-library") {
    return { ok: true, value: false };
  }

  return errorWithCode(
    AIKYA_DIAGNOSTIC.invalidSchema,
    `Unsupported kind '${String(kind)}' at ${path}`
  );
};

const collectDependencyNames = (value: unknown): string[] => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value as Record<string, unknown>);
};

const listWorkspaceDependencyNames = (
  workspaceRoot: string
): Result<readonly string[], string> => {
  const packageJsonPath = join(workspaceRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return { ok: true, value: [] };
  }
  const parsed = readJsonObject(
    packageJsonPath,
    AIKYA_DIAGNOSTIC.invalidSchema
  );
  if (!parsed.ok) return parsed;

  const dependencies = parsed.value.dependencies;
  const devDependencies = parsed.value.devDependencies;
  const optionalDependencies = parsed.value.optionalDependencies;

  const names = new Set<string>();
  for (const name of collectDependencyNames(dependencies)) names.add(name);
  for (const name of collectDependencyNames(devDependencies)) names.add(name);
  for (const name of collectDependencyNames(optionalDependencies))
    names.add(name);
  return {
    ok: true,
    value: [...names].sort((a, b) =>
      normalizeId(a).localeCompare(normalizeId(b))
    ),
  };
};

const listRootBindingsDiscoveryNames = (
  workspaceRoot: string,
  surface: string | undefined
): Result<readonly string[], string> => {
  const workspaceDeps = listWorkspaceDependencyNames(workspaceRoot);
  if (!workspaceDeps.ok) return workspaceDeps;

  const surfaceDeps = resolveSurfaceCapabilities(surface, {
    workspaceRoot,
  }).requiredNpmPackages;

  const names = new Set<string>();
  for (const name of workspaceDeps.value) names.add(name);
  for (const name of surfaceDeps) names.add(name);

  return {
    ok: true,
    value: [...names].sort((a, b) =>
      normalizeId(a).localeCompare(normalizeId(b))
    ),
  };
};

const resolveInstalledPackageRootFrom = (
  fromDir: string,
  dependencyName: string
): string | null => {
  try {
    const req = createRequire(join(fromDir, "package.json"));
    const packageJsonPath = req.resolve(`${dependencyName}/package.json`);
    return dirname(packageJsonPath);
  } catch {
    return null;
  }
};

const readInstalledPackageDependencyNames = (
  packageRoot: string
): Result<readonly string[], string> => {
  const packageJsonPath = join(packageRoot, "package.json");
  const parsed = readJsonObject(
    packageJsonPath,
    AIKYA_DIAGNOSTIC.invalidSchema
  );
  if (!parsed.ok) return parsed;

  const dependencies = parsed.value.dependencies;
  const optionalDependencies = parsed.value.optionalDependencies;
  const peerDependencies = parsed.value.peerDependencies;

  const names = new Set<string>();
  for (const name of collectDependencyNames(dependencies)) names.add(name);
  for (const name of collectDependencyNames(optionalDependencies))
    names.add(name);
  for (const name of collectDependencyNames(peerDependencies)) names.add(name);

  return {
    ok: true,
    value: [...names].sort((a, b) =>
      normalizeId(a).localeCompare(normalizeId(b))
    ),
  };
};

export const discoverWorkspaceBindingsManifests = (
  workspaceRoot: string,
  surface: string | undefined = undefined
): Result<readonly NormalizedBindingsManifest[], string> => {
  const rootDeps = listRootBindingsDiscoveryNames(workspaceRoot, surface);
  if (!rootDeps.ok) return rootDeps;

  const queue: Array<{
    readonly dependencyName: string;
    readonly fromDir: string;
    readonly rootDependency: boolean;
  }> = rootDeps.value.map((dependencyName) => ({
    dependencyName,
    fromDir: workspaceRoot,
    rootDependency: true,
  }));

  const seenPackageRoots = new Set<string>();
  const out: NormalizedBindingsManifest[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    let resolvedRoot: string | null = null;
    let rootResolutionError: string | undefined;
    if (current.fromDir === workspaceRoot) {
      const rootResolved = resolvePackageRoot(
        workspaceRoot,
        current.dependencyName
      );
      if (rootResolved.ok) {
        resolvedRoot = rootResolved.value;
      } else {
        rootResolutionError = rootResolved.error;
      }
    } else {
      resolvedRoot = resolveInstalledPackageRootFrom(
        current.fromDir,
        current.dependencyName
      );
    }

    if (!resolvedRoot) {
      if (current.rootDependency) {
        return errorWithCode(
          AIKYA_DIAGNOSTIC.unresolvedRuntime,
          `Unable to resolve workspace dependency '${current.dependencyName}' from node_modules.` +
            (rootResolutionError ? `\n${rootResolutionError}` : "")
        );
      }
      continue;
    }

    const packageRoot = resolvedRoot;
    if (seenPackageRoots.has(packageRoot)) continue;
    seenPackageRoots.add(packageRoot);

    const manifest = resolveInstalledPackageBindingsManifest(packageRoot);
    if (!manifest.ok) return manifest;
    if (manifest.value) out.push(manifest.value);

    const childDeps = readInstalledPackageDependencyNames(packageRoot);
    if (!childDeps.ok) return childDeps;
    for (const childName of childDeps.value) {
      queue.push({
        dependencyName: childName,
        fromDir: packageRoot,
        rootDependency: false,
      });
    }
  }

  return {
    ok: true,
    value: out.sort((a, b) =>
      normalizeId(a.packageName).localeCompare(normalizeId(b.packageName))
    ),
  };
};
