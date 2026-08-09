import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

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

export function hasCompilerSourceExport(
  packageRoot: string,
  packageJson: PackageJson,
  sourceFiles: readonly string[],
): boolean {
  const availableSourcePaths = new Set(sourceFiles.flatMap((sourceFile) => {
    const packageRelativePath = relative(packageRoot, sourceFile);
    if (
      packageRelativePath === "" ||
      packageRelativePath === ".." ||
      packageRelativePath.startsWith("../") ||
      packageRelativePath.startsWith("..\\") ||
      isAbsolute(packageRelativePath)
    ) {
      return [];
    }
    return [`./${normalizePackagePath(packageRelativePath)}`];
  }));
  return hasCompilerSourceTarget(packageJson.exports, availableSourcePaths) ||
    hasCompilerSourceTarget(packageJson.main, availableSourcePaths) ||
    hasCompilerSourceTarget(packageJson.module, availableSourcePaths);
}

export function isCompilerSourceFile(name: string): boolean {
  return /\.(?:mts|ts)$/u.test(name) && !/\.d\.(?:mts|ts)$/u.test(name);
}

export function isDeclarationFile(name: string): boolean {
  return /\.d\.(?:cts|mts|ts)$/u.test(name);
}

export function normalizePackagePath(path: string): string {
  return path.split("\\").join("/");
}

function hasCompilerSourceTarget(
  value: unknown,
  availableSourcePaths: ReadonlySet<string>,
): boolean {
  if (typeof value === "string") {
    return compilerSourceTargetCandidates(value).some((candidate) =>
      matchesAvailableSourcePath(candidate, availableSourcePaths)
    );
  }
  if (Array.isArray(value)) {
    return value.some((entry) => hasCompilerSourceTarget(entry, availableSourcePaths));
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).some((entry) =>
    hasCompilerSourceTarget(entry, availableSourcePaths)
  );
}

function compilerSourceTargetCandidates(target: string): readonly string[] {
  if (isCompilerSourceFile(target)) {
    return [target];
  }
  if (target.endsWith(".js")) {
    return [`${target.slice(0, -3)}.ts`];
  }
  if (target.endsWith(".mjs")) {
    return [`${target.slice(0, -4)}.mts`];
  }
  return [];
}

function matchesAvailableSourcePath(
  candidate: string,
  availableSourcePaths: ReadonlySet<string>,
): boolean {
  const normalized = normalizeExportTarget(candidate);
  if (normalized === undefined) {
    return false;
  }
  const wildcardIndex = normalized.indexOf("*");
  if (wildcardIndex < 0) {
    return availableSourcePaths.has(normalized);
  }
  if (normalized.indexOf("*", wildcardIndex + 1) >= 0) {
    return false;
  }
  const prefix = normalized.slice(0, wildcardIndex);
  const suffix = normalized.slice(wildcardIndex + 1);
  for (const sourcePath of availableSourcePaths) {
    if (
      sourcePath.length >= prefix.length + suffix.length &&
      sourcePath.startsWith(prefix) &&
      sourcePath.endsWith(suffix)
    ) {
      return true;
    }
  }
  return false;
}

function normalizeExportTarget(target: string): string | undefined {
  const normalized = normalizePackagePath(target);
  const withPrefix = normalized.startsWith("./") ? normalized : `./${normalized}`;
  if (
    isAbsolute(normalized) ||
    withPrefix.split("/").some((segment) => segment === "..")
  ) {
    return undefined;
  }
  return withPrefix;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
