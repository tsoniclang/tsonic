import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type PackageJson = Readonly<Record<string, unknown>>;

export function findInstalledPackageRoot(resolutionDirectory: string, packageName: string): string | undefined {
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

export function readPackageJson(packageJsonPath: string): PackageJson {
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

export function readDependencyNames(
  packageJson: PackageJson,
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

export function hasCompilerSourceExport(packageJson: PackageJson): boolean {
  return hasCompilerSourceTarget(packageJson.exports) ||
    hasCompilerSourceTarget(packageJson.main) ||
    hasCompilerSourceTarget(packageJson.module);
}

export function isCompilerSourceFile(name: string): boolean {
  return /\.(?:cts|mts|ts)$/u.test(name) && !/\.d\.(?:cts|mts|ts)$/u.test(name);
}

export function isDeclarationFile(name: string): boolean {
  return /\.d\.(?:cts|mts|ts)$/u.test(name);
}

export function normalizePackagePath(path: string): string {
  return path.split("\\").join("/");
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
