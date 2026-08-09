import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  findInstalledPackageRoot,
  hasCompilerSourceExport,
  isCompilerSourceFile,
  normalizePackagePath,
  readDependencyNames,
  readPackageJson,
} from "./package-contract.js";

export function appendInstalledSourcePackageFiles(
  projectDirectory: string,
  files: Map<string, string>,
): void {
  const packageJsonPath = join(projectDirectory, "package.json");
  if (!existsSync(packageJsonPath)) {
    return;
  }
  const projectPackage = readPackageJson(packageJsonPath);
  const visitedPackageRoots = new Set<string>();
  for (const packageName of readDependencyNames(projectPackage, true)) {
    appendSourcePackageDependency(projectDirectory, packageName, files, visitedPackageRoots);
  }
}

function appendSourcePackageDependency(
  resolutionDirectory: string,
  packageName: string,
  files: Map<string, string>,
  visitedPackageRoots: Set<string>,
): void {
  const packageRoot = findInstalledPackageRoot(resolutionDirectory, packageName);
  if (packageRoot === undefined || visitedPackageRoots.has(packageRoot)) {
    return;
  }
  visitedPackageRoots.add(packageRoot);
  const packageJsonPath = join(packageRoot, "package.json");
  const packageJson = readPackageJson(packageJsonPath);
  const sourceFiles = collectCompilerSourceFiles(packageRoot);
  if (!hasCompilerSourceExport(packageRoot, packageJson, sourceFiles)) {
    return;
  }
  files.set(normalizePackagePath(packageJsonPath), readFileSync(packageJsonPath, "utf8"));
  for (const sourceFile of sourceFiles) {
    files.set(normalizePackagePath(sourceFile), readFileSync(sourceFile, "utf8"));
  }
  for (const dependencyName of readDependencyNames(packageJson, false)) {
    appendSourcePackageDependency(packageRoot, dependencyName, files, visitedPackageRoots);
  }
}

function collectCompilerSourceFiles(directory: string): readonly string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    comparePackageEntryNames(left.name, right.name)
  )) {
    if (shouldSkipPackageEntry(entry.name)) {
      continue;
    }
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectCompilerSourceFiles(fullPath));
      continue;
    }
    if (entry.isFile() && isCompilerSourceFile(entry.name)) {
      files.push(fullPath);
    }
  }
  return Object.freeze(files);
}

function comparePackageEntryNames(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function shouldSkipPackageEntry(name: string): boolean {
  return name === ".git" ||
    name === ".temp" ||
    name === "bin" ||
    name === "dist" ||
    name === "node_modules" ||
    name === "obj";
}
