import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  findInstalledPackageRoot,
  isDeclarationFile,
  normalizePackagePath,
  readDependencyNames,
  readPackageJson,
} from "./package-contract.js";

export interface InstalledDeclarationSnapshot {
  readonly fingerprint: string;
  readonly packages: readonly {
    readonly name: string;
    readonly version?: string;
    readonly root: string;
  }[];
  readonly declarationFileCount: number;
  readonly declarationByteCount: number;
}

export function appendInstalledDeclarationPackageFiles(
  projectDirectory: string,
  files: Map<string, string>,
): InstalledDeclarationSnapshot {
  const packageJsonPath = join(projectDirectory, "package.json");
  const collectedFiles = new Map<string, string>();
  const packages: Array<{ name: string; version?: string; root: string }> = [];
  if (existsSync(packageJsonPath)) {
    const projectPackage = readPackageJson(packageJsonPath);
    const visitedPackageRoots = new Set<string>();
    for (const packageName of readDependencyNames(projectPackage, true)) {
      appendDeclarationPackage(
        projectDirectory,
        packageName,
        collectedFiles,
        packages,
        visitedPackageRoots,
      );
    }
  }
  for (const [path, text] of collectedFiles) {
    files.set(path, text);
  }
  return createSnapshot(collectedFiles, packages);
}

function appendDeclarationPackage(
  resolutionDirectory: string,
  requestedPackageName: string,
  files: Map<string, string>,
  packages: Array<{ name: string; version?: string; root: string }>,
  visitedPackageRoots: Set<string>,
): void {
  const packageRoot = findInstalledPackageRoot(resolutionDirectory, requestedPackageName);
  if (packageRoot === undefined) {
    return;
  }
  const normalizedRoot = normalizePackagePath(packageRoot);
  if (visitedPackageRoots.has(normalizedRoot)) {
    return;
  }
  visitedPackageRoots.add(normalizedRoot);
  const packageJsonPath = join(packageRoot, "package.json");
  const packageJson = readPackageJson(packageJsonPath);
  const packageName = packageJson.name;
  if (packageName !== requestedPackageName) {
    throw new Error(`Installed package '${requestedPackageName}' at '${packageRoot}' declares package name '${String(packageName)}'.`);
  }
  const packageFiles = collectDeclarationFiles(packageRoot);
  if (packageFiles.size === 0) {
    return;
  }
  const packageJsonText = readFileSync(packageJsonPath, "utf8");
  files.set(normalizePackagePath(packageJsonPath), packageJsonText);
  for (const [path, text] of packageFiles) {
    files.set(path, text);
  }
  const version = packageJson.version;
  if (version !== undefined && typeof version !== "string") {
    throw new Error(`Installed package '${requestedPackageName}' at '${packageRoot}' has a non-string version.`);
  }
  packages.push({
    name: requestedPackageName,
    ...(version === undefined ? {} : { version }),
    root: normalizedRoot,
  });
  for (const dependencyName of readDependencyNames(packageJson, false)) {
    appendDeclarationPackage(
      packageRoot,
      dependencyName,
      files,
      packages,
      visitedPackageRoots,
    );
  }
}

function collectDeclarationFiles(packageRoot: string): Map<string, string> {
  const files = new Map<string, string>();
  visitPackageDirectory(packageRoot, files, true);
  return files;
}

function visitPackageDirectory(directory: string, files: Map<string, string>, packageRoot: boolean): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === ".temp" || entry.name === "node_modules") {
      continue;
    }
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      visitPackageDirectory(fullPath, files, false);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (isDeclarationFile(entry.name) || (!packageRoot && entry.name === "package.json")) {
      files.set(normalizePackagePath(fullPath), readFileSync(fullPath, "utf8"));
    }
  }
}

function createSnapshot(
  files: ReadonlyMap<string, string>,
  packages: readonly { name: string; version?: string; root: string }[],
): InstalledDeclarationSnapshot {
  const sortedPackages = [...packages].sort((left, right) =>
    left.root.localeCompare(right.root) || left.name.localeCompare(right.name)
  );
  const sortedFiles = [...files].sort(([left], [right]) => left.localeCompare(right));
  const hash = createHash("sha256");
  let byteCount = 0;
  for (const entry of sortedPackages) {
    appendHashPart(hash, entry.root);
    appendHashPart(hash, entry.name);
    appendHashPart(hash, entry.version ?? "");
  }
  for (const [path, text] of sortedFiles) {
    appendHashPart(hash, path);
    appendHashPart(hash, text);
    byteCount += Buffer.byteLength(text, "utf8");
  }
  return {
    fingerprint: hash.digest("hex"),
    packages: sortedPackages,
    declarationFileCount: sortedFiles.length,
    declarationByteCount: byteCount,
  };
}

function appendHashPart(hash: ReturnType<typeof createHash>, value: string): void {
  hash.update(String(Buffer.byteLength(value, "utf8")));
  hash.update(":");
  hash.update(value);
}
