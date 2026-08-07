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
  if (!hasCompilerSourceExport(packageJson)) {
    return;
  }
  files.set(normalizePackagePath(packageJsonPath), readFileSync(packageJsonPath, "utf8"));
  appendCompilerSourceFiles(packageRoot, files);
  for (const dependencyName of readDependencyNames(packageJson, false)) {
    appendSourcePackageDependency(packageRoot, dependencyName, files, visitedPackageRoots);
  }
}

function appendCompilerSourceFiles(directory: string, files: Map<string, string>): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (shouldSkipPackageEntry(entry.name)) {
      continue;
    }
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      appendCompilerSourceFiles(fullPath, files);
      continue;
    }
    if (entry.isFile() && isCompilerSourceFile(entry.name)) {
      files.set(normalizePackagePath(fullPath), readFileSync(fullPath, "utf8"));
    }
  }
}

function shouldSkipPackageEntry(name: string): boolean {
  return name === ".git" ||
    name === ".temp" ||
    name === "bin" ||
    name === "dist" ||
    name === "node_modules" ||
    name === "obj";
}
