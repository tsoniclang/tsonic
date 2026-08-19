import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export type PackageJson = Readonly<Record<string, unknown>>;

export interface CompilerSourceExport {
  readonly specifier: string;
  readonly sourceFile: string;
}

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
  return collectCompilerSourceExports(packageRoot, packageJson, sourceFiles).length > 0;
}

export function collectCompilerSourceExports(
  packageRoot: string,
  packageJson: PackageJson,
  sourceFiles: readonly string[],
): readonly CompilerSourceExport[] {
  const availableSourcePaths = new Map(sourceFiles.flatMap((sourceFile) => {
    const packageRelativePath = relative(packageRoot, sourceFile);
    if (
      packageRelativePath === "" ||
      packageRelativePath === ".." ||
      packageRelativePath.startsWith("../") ||
      packageRelativePath.startsWith("..\\") ||
      isAbsolute(packageRelativePath)
    ) {
      return [] as [string, string][];
    }
    return [[`./${normalizePackagePath(packageRelativePath)}`, normalizePackagePath(sourceFile)]];
  }));
  const exports: CompilerSourceExport[] = [];
  collectCompilerSourceExportTargets(packageJson.exports, ".", availableSourcePaths, exports);
  collectCompilerSourceExportTargets(packageJson.main, ".", availableSourcePaths, exports);
  collectCompilerSourceExportTargets(packageJson.module, ".", availableSourcePaths, exports);
  const byIdentity = new Map<string, CompilerSourceExport>();
  for (const entry of exports) {
    byIdentity.set(`${entry.specifier.length}:${entry.specifier}${entry.sourceFile}`, entry);
  }
  return Object.freeze([...byIdentity.values()].sort((left, right) =>
    left.specifier.localeCompare(right.specifier, "en") ||
    left.sourceFile.localeCompare(right.sourceFile, "en")
  ));
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

function collectCompilerSourceExportTargets(
  value: unknown,
  specifier: string,
  availableSourcePaths: ReadonlyMap<string, string>,
  output: CompilerSourceExport[],
): void {
  if (typeof value === "string") {
    appendCompilerSourceExportMatches(
      specifier,
      value,
      availableSourcePaths,
      output,
    );
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectCompilerSourceExportTargets(entry, specifier, availableSourcePaths, output);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  const entries = Object.entries(value);
  const hasSubpaths = entries.some(([key]) => key === "." || key.startsWith("./"));
  for (const [key, entry] of entries) {
    collectCompilerSourceExportTargets(
      entry,
      hasSubpaths ? key : specifier,
      availableSourcePaths,
      output,
    );
  }
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

function appendCompilerSourceExportMatches(
  specifier: string,
  target: string,
  availableSourcePaths: ReadonlyMap<string, string>,
  output: CompilerSourceExport[],
): void {
  for (const candidate of compilerSourceTargetCandidates(target)) {
    const normalized = normalizeExportTarget(candidate);
    if (normalized === undefined) {
      continue;
    }
    const wildcardIndex = normalized.indexOf("*");
    if (wildcardIndex < 0) {
      const sourceFile = availableSourcePaths.get(normalized);
      if (sourceFile !== undefined && !specifier.includes("*")) {
        output.push(Object.freeze({ specifier, sourceFile }));
      }
      continue;
    }
    if (normalized.indexOf("*", wildcardIndex + 1) >= 0 ||
      specifier.split("*").length > 2) {
      continue;
    }
    const prefix = normalized.slice(0, wildcardIndex);
    const suffix = normalized.slice(wildcardIndex + 1);
    for (const [sourcePath, sourceFile] of availableSourcePaths) {
      if (sourcePath.length < prefix.length + suffix.length ||
        !sourcePath.startsWith(prefix) || !sourcePath.endsWith(suffix)) {
        continue;
      }
      const wildcard = sourcePath.slice(prefix.length, sourcePath.length - suffix.length);
      output.push(Object.freeze({
        specifier: specifier.includes("*")
          ? specifier.replace("*", wildcard)
          : specifier,
        sourceFile,
      }));
    }
  }
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
