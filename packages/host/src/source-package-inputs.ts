import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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
  if (!hasSourceExport(packageJson)) {
    return;
  }
  files.set(normalizePath(packageJsonPath), readFileSync(packageJsonPath, "utf8"));
  appendCompilerSourceFiles(packageRoot, files);
  for (const dependencyName of readDependencyNames(packageJson, false)) {
    appendSourcePackageDependency(packageRoot, dependencyName, files, visitedPackageRoots);
  }
}

function findInstalledPackageRoot(resolutionDirectory: string, packageName: string): string | undefined {
  const packageSegments = packageName.startsWith("@") ? packageName.split("/") : [packageName];
  let currentDirectory = resolve(resolutionDirectory);
  for (;;) {
    const candidate = join(currentDirectory, "node_modules", ...packageSegments);
    if (existsSync(join(candidate, "package.json"))) {
      return candidate;
    }
    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return undefined;
    }
    currentDirectory = parentDirectory;
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
      files.set(normalizePath(fullPath), readFileSync(fullPath, "utf8"));
    }
  }
}

function readPackageJson(packageJsonPath: string): Readonly<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`Invalid package.json at '${packageJsonPath}': ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`Invalid package.json at '${packageJsonPath}': root value must be an object.`);
  }
  return parsed;
}

function readDependencyNames(
  packageJson: Readonly<Record<string, unknown>>,
  includeDevelopmentDependencies: boolean,
): readonly string[] {
  const names = new Set<string>();
  const fields = includeDevelopmentDependencies
    ? ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]
    : ["dependencies", "optionalDependencies", "peerDependencies"];
  for (const fieldName of fields) {
    const field = packageJson[fieldName];
    if (field === undefined) {
      continue;
    }
    if (!isRecord(field)) {
      throw new Error(`Invalid package.json field '${fieldName}': expected an object.`);
    }
    for (const name of Object.keys(field)) {
      if (name.length > 0) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

function hasSourceExport(packageJson: Readonly<Record<string, unknown>>): boolean {
  return hasCompilerSourceTarget(packageJson.exports) ||
    hasCompilerSourceTarget(packageJson.main) ||
    hasCompilerSourceTarget(packageJson.module);
}

function hasCompilerSourceTarget(value: unknown): boolean {
  if (typeof value === "string") {
    return isCompilerSourceFile(value);
  }
  if (Array.isArray(value)) {
    return value.some(hasCompilerSourceTarget);
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).some(hasCompilerSourceTarget);
}

function shouldSkipPackageEntry(name: string): boolean {
  return name === ".git" ||
    name === ".temp" ||
    name === "bin" ||
    name === "dist" ||
    name === "node_modules" ||
    name === "obj";
}

function isCompilerSourceFile(name: string): boolean {
  return /\.(?:mts|ts)$/.test(name) && !/\.d\.(?:mts|ts)$/.test(name);
}

function normalizePath(path: string): string {
  return path.split("\\").join("/");
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
