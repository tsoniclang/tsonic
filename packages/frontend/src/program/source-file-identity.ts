import * as fs from "node:fs";
import * as path from "node:path";
import { getClassNameFromPath } from "../resolver/naming.js";
import { getNamespaceFromPath } from "../resolver/namespace.js";
import { readPackageName } from "./module-resolution.js";
import { readSourcePackageMetadata } from "./source-package-metadata.js";

type SourceFileIdentity = {
  readonly filePath: string;
  readonly namespace: string;
  readonly className: string;
};

const sourcePackageRootCache = new Map<string, string | null>();

const sourcePackageManifestPath = (dirPath: string): string =>
  path.join(dirPath, "tsonic.package.json");

const normalizeAbsolutePath = (filePath: string): string =>
  path.resolve(filePath);

const normalizeRelativePath = (filePath: string): string =>
  filePath.replace(/\\/g, "/");

const isPathWithinRoot = (filePath: string, rootPath: string): boolean => {
  const relative = path.relative(
    normalizeAbsolutePath(rootPath),
    normalizeAbsolutePath(filePath)
  );
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
};

const findContainingSourcePackageRoot = (
  filePath: string
): string | undefined => {
  const normalizedFilePath = normalizeAbsolutePath(filePath);
  const cached = sourcePackageRootCache.get(normalizedFilePath);
  if (cached !== undefined) {
    return cached ?? undefined;
  }

  let currentDir = path.dirname(normalizedFilePath);
  for (;;) {
    const manifestPath = sourcePackageManifestPath(currentDir);
    const metadata = readSourcePackageMetadata(currentDir);
    if (metadata) {
      sourcePackageRootCache.set(normalizedFilePath, currentDir);
      return currentDir;
    }
    if (fs.existsSync(manifestPath)) {
      throw new Error(
        `Invalid native source package metadata at ${manifestPath}.`
      );
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      sourcePackageRootCache.set(normalizedFilePath, null);
      return undefined;
    }
    currentDir = parentDir;
  }
};

const defaultSourceFileIdentity = (
  filePath: string,
  sourceRoot: string,
  rootNamespace: string
): SourceFileIdentity => ({
  filePath: normalizeRelativePath(
    path.relative(
      normalizeAbsolutePath(sourceRoot),
      normalizeAbsolutePath(filePath)
    )
  ),
  namespace: getNamespaceFromPath(filePath, sourceRoot, rootNamespace),
  className: getClassNameFromPath(filePath),
});

export const resolveSourceFileIdentity = (
  filePath: string,
  sourceRoot: string,
  rootNamespace: string
): SourceFileIdentity => {
  const normalizedFilePath = normalizeAbsolutePath(filePath);
  const normalizedSourceRoot = normalizeAbsolutePath(sourceRoot);

  if (isPathWithinRoot(normalizedFilePath, normalizedSourceRoot)) {
    return defaultSourceFileIdentity(
      normalizedFilePath,
      normalizedSourceRoot,
      rootNamespace
    );
  }

  const packageRoot = findContainingSourcePackageRoot(normalizedFilePath);
  if (!packageRoot) {
    return defaultSourceFileIdentity(
      normalizedFilePath,
      normalizedSourceRoot,
      rootNamespace
    );
  }

  const metadata = readSourcePackageMetadata(packageRoot);
  const packageName = readPackageName(path.join(packageRoot, "package.json"));
  if (!metadata || !packageName) {
    throw new Error(
      `Installed source package at ${packageRoot} is missing valid package metadata.`
    );
  }

  const relativeFromPackageRoot = normalizeRelativePath(
    path.relative(packageRoot, normalizedFilePath)
  );
  const stableFilePath = normalizeRelativePath(
    path.join(
      "node_modules",
      ...packageName.split("/"),
      relativeFromPackageRoot
    )
  );

  return {
    filePath: stableFilePath,
    namespace: getNamespaceFromPath(
      normalizedFilePath,
      metadata.sourceRoot,
      metadata.namespace
    ),
    className: getClassNameFromPath(normalizedFilePath),
  };
};

export const resolveInstalledSourcePackageNamespace = (
  filePath: string
): string | undefined => {
  const normalizedFilePath = normalizeAbsolutePath(filePath);
  const normalizedWithSlashes = normalizeRelativePath(normalizedFilePath);
  if (!normalizedWithSlashes.includes("/node_modules/")) {
    return undefined;
  }

  const packageRoot = findContainingSourcePackageRoot(normalizedFilePath);
  if (!packageRoot) {
    return undefined;
  }

  const metadata = readSourcePackageMetadata(packageRoot);
  if (!metadata) {
    return undefined;
  }

  return getNamespaceFromPath(
    normalizedFilePath,
    metadata.sourceRoot,
    metadata.namespace
  );
};

export const resolveContainingSourcePackageNamespace = (
  filePath: string
): string | undefined => {
  const normalizedFilePath = normalizeAbsolutePath(filePath);
  const packageRoot = findContainingSourcePackageRoot(normalizedFilePath);
  if (!packageRoot) {
    return undefined;
  }

  const metadata = readSourcePackageMetadata(packageRoot);
  if (!metadata) {
    return undefined;
  }

  return getNamespaceFromPath(
    normalizedFilePath,
    metadata.sourceRoot,
    metadata.namespace
  );
};

export const resolveSourceFileNamespace = (
  filePath: string,
  sourceRoot: string,
  rootNamespace: string
): string =>
  resolveSourceFileIdentity(filePath, sourceRoot, rootNamespace).namespace;

export const resolveSourceFileOwnerIdentity = (
  filePath: string,
  sourceRoot: string,
  rootNamespace: string
): string => {
  const normalizedFilePath = normalizeAbsolutePath(filePath);
  const normalizedSourceRoot = normalizeAbsolutePath(sourceRoot);

  if (isPathWithinRoot(normalizedFilePath, normalizedSourceRoot)) {
    return rootNamespace;
  }

  const packageRoot = findContainingSourcePackageRoot(normalizedFilePath);
  if (!packageRoot) {
    return rootNamespace;
  }

  const packageName = readPackageName(path.join(packageRoot, "package.json"));
  if (!packageName) {
    throw new Error(
      `Installed source package at ${packageRoot} is missing package.json name.`
    );
  }

  return packageName;
};
