import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

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

export function hasCompilerSourceExport(packageRoot: string, packageJson: PackageJson): boolean {
  return hasCompilerSourceTarget(packageRoot, packageJson.exports) ||
    hasCompilerSourceTarget(packageRoot, packageJson.main) ||
    hasCompilerSourceTarget(packageRoot, packageJson.module);
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

function hasCompilerSourceTarget(packageRoot: string, value: unknown): boolean {
  if (typeof value === "string") {
    return compilerSourceTargetCandidates(value).some((candidate) => {
      const candidatePath = resolve(packageRoot, candidate);
      const packageRelativePath = relative(packageRoot, candidatePath);
      return packageRelativePath !== "" &&
        !isAbsolute(packageRelativePath) &&
        packageRelativePath !== ".." &&
        !packageRelativePath.startsWith(`..${sep}`) &&
        existsSync(candidatePath);
    });
  }
  if (Array.isArray(value)) {
    return value.some((entry) => hasCompilerSourceTarget(packageRoot, entry));
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).some((entry) => hasCompilerSourceTarget(packageRoot, entry));
}

function compilerSourceTargetCandidates(target: string): readonly string[] {
  if (isCompilerSourceFile(target)) {
    return [target];
  }
  if (target.endsWith(".js")) {
    return [`${target.slice(0, -3)}.ts`, `${target.slice(0, -3)}.tsx`];
  }
  if (target.endsWith(".mjs")) {
    return [`${target.slice(0, -4)}.mts`];
  }
  if (target.endsWith(".cjs")) {
    return [`${target.slice(0, -4)}.cts`];
  }
  if (target.endsWith(".jsx")) {
    return [`${target.slice(0, -4)}.tsx`];
  }
  return [];
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
