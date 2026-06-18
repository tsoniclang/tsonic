import * as fs from "node:fs";
import * as path from "node:path";

type RawSourceSection = {
  readonly namespace?: unknown;
  readonly exports?: unknown;
  readonly ambient?: unknown;
  readonly moduleAliases?: unknown;
};

type RawSourcePackageManifest = {
  readonly kind?: unknown;
  readonly source?: unknown;
};

export type SourcePackageMetadata = {
  readonly packageName: string;
  readonly packageRoot: string;
  readonly namespace: string;
  readonly exports: Readonly<Record<string, string>>;
  readonly exportPaths: readonly string[];
  readonly ambient: readonly string[];
  readonly ambientPaths: readonly string[];
  readonly moduleAliases: Readonly<Record<string, string>>;
  readonly sourceRoot: string;
};

const metadataCache = new Map<string, SourcePackageMetadata | null>();

const normalizePackageRoot = (packageRoot: string): string =>
  path.resolve(packageRoot);

const readPackageName = (packageRoot: string): string | undefined => {
  const packageJsonPath = path.join(packageRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as {
      readonly name?: unknown;
    };
    return typeof parsed.name === "string" && parsed.name.length > 0
      ? parsed.name
      : undefined;
  } catch {
    return undefined;
  }
};

const readRawManifest = (
  manifestPath: string
): RawSourcePackageManifest => {
  try {
    return JSON.parse(
      fs.readFileSync(manifestPath, "utf-8")
    ) as RawSourcePackageManifest;
  } catch (error) {
    throw new Error(
      `Invalid source package manifest at ${manifestPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

const invalidSourcePackageManifest = (
  manifestPath: string,
  message: string
): never => {
  throw new Error(`Invalid source package manifest at ${manifestPath}: ${message}`);
};

const requirePackageName = (
  packageRoot: string,
  manifestPath: string
): string => {
  const packageName = readPackageName(packageRoot);
  return packageName
    ? packageName
    : invalidSourcePackageManifest(
        manifestPath,
        "package.json must declare a non-empty package name."
      );
};

const requireSourceSection = (
  manifestPath: string,
  value: unknown
): RawSourceSection =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RawSourceSection)
    : invalidSourcePackageManifest(manifestPath, "`source` must be an object.");

const parseExports = (
  value: unknown
): Readonly<Record<string, string>> | undefined => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries: Record<string, string> = {};
  for (const [key, target] of Object.entries(value)) {
    if (
      typeof key !== "string" ||
      key.length === 0 ||
      typeof target !== "string" ||
      target.length === 0
    ) {
      return undefined;
    }
    entries[key] = target;
  }

  return entries;
};

const parseAmbient = (value: unknown): readonly string[] | undefined => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const entries: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.length === 0) {
      return undefined;
    }
    entries.push(entry);
  }

  return entries;
};

const normalizeModuleAliasTarget = (
  packageName: string,
  target: string
): string | undefined => {
  const trimmed = target.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed === ".") {
    return packageName;
  }

  if (trimmed.startsWith("./")) {
    return `${packageName}/${trimmed.slice(2)}`;
  }

  if (trimmed.startsWith("/")) {
    return undefined;
  }

  return trimmed;
};

const parseModuleAliases = (
  packageName: string,
  value: unknown
): Readonly<Record<string, string>> | undefined => {
  if (value === undefined) {
    return {};
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries: Record<string, string> = {};
  for (const [specifier, target] of Object.entries(value)) {
    if (
      typeof specifier !== "string" ||
      specifier.trim().length === 0 ||
      typeof target !== "string"
    ) {
      return undefined;
    }

    const resolvedTarget = normalizeModuleAliasTarget(packageName, target);
    if (!resolvedTarget) {
      return undefined;
    }

    entries[specifier] = resolvedTarget;
  }

  return entries;
};

const parseNamespace = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const requireExports = (
  manifestPath: string,
  value: unknown
): Readonly<Record<string, string>> => {
  const exportsMap = parseExports(value);
  return exportsMap && Object.keys(exportsMap).length > 0
    ? exportsMap
    : invalidSourcePackageManifest(
        manifestPath,
        "`source.exports` must be a non-empty object of string targets."
      );
};

const requireAmbient = (
  manifestPath: string,
  value: unknown
): readonly string[] => {
  const ambient = parseAmbient(value);
  return ambient !== undefined
    ? ambient
    : invalidSourcePackageManifest(
        manifestPath,
        "`source.ambient` must be an array of non-empty strings when present."
      );
};

const requireModuleAliases = (
  manifestPath: string,
  packageName: string,
  value: unknown
): Readonly<Record<string, string>> => {
  const moduleAliases = parseModuleAliases(packageName, value);
  return moduleAliases !== undefined
    ? moduleAliases
    : invalidSourcePackageManifest(
        manifestPath,
        "`source.moduleAliases` must map non-empty specifiers to valid non-empty targets when present."
      );
};

const requireNamespace = (
  manifestPath: string,
  value: unknown
): string => {
  const namespace = parseNamespace(value);
  return namespace
    ? namespace
    : invalidSourcePackageManifest(
        manifestPath,
        "`source.namespace` must be a non-empty string."
      );
};

const resolveExportPaths = (
  packageRoot: string,
  exportsMap: Readonly<Record<string, string>>
): readonly string[] => {
  const exportPaths: string[] = [];

  for (const target of Object.values(exportsMap)) {
    const absolute = path.resolve(packageRoot, target);
    if (!fs.existsSync(absolute)) {
      continue;
    }
    exportPaths.push(absolute);
  }

  return exportPaths;
};

const resolveAmbientPaths = (
  packageRoot: string,
  ambientEntries: readonly string[]
): readonly string[] => {
  const ambientPaths: string[] = [];

  for (const ambientEntry of ambientEntries) {
    const absolute = path.resolve(packageRoot, ambientEntry);
    if (!fs.existsSync(absolute)) {
      continue;
    }
    ambientPaths.push(absolute);
  }

  return ambientPaths;
};

const isPathWithinRoot = (filePath: string, rootPath: string): boolean => {
  const relative = path.relative(
    path.resolve(rootPath),
    path.resolve(filePath)
  );
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
};

const resolveCommonRootDir = (paths: readonly string[]): string => {
  const [first, ...remaining] = paths;
  if (!first) {
    throw new Error("resolveCommonRootDir requires at least one path");
  }

  let current = path.resolve(first);
  const rest = remaining.map((entry) => path.resolve(entry));

  for (;;) {
    if (rest.every((candidate) => isPathWithinRoot(candidate, current))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return current;
    }
    current = parent;
  }
};

const resolveSourceRoot = (
  packageRoot: string,
  exportPaths: readonly string[]
): string => {
  const srcRoot = path.join(packageRoot, "src");
  if (exportPaths.length === 0) {
    return fs.existsSync(srcRoot) ? srcRoot : packageRoot;
  }

  if (
    fs.existsSync(srcRoot) &&
    exportPaths.every((exportPath) => isPathWithinRoot(exportPath, srcRoot))
  ) {
    return srcRoot;
  }

  return resolveCommonRootDir(
    exportPaths.map((exportPath) => path.dirname(exportPath))
  );
};

export const readSourcePackageMetadata = (
  packageRoot: string
): SourcePackageMetadata | null => {
  const normalizedRoot = normalizePackageRoot(packageRoot);
  const cached = metadataCache.get(normalizedRoot);
  if (cached !== undefined) {
    return cached;
  }

  const manifestPath = path.join(normalizedRoot, "tsonic.package.json");
  if (!fs.existsSync(manifestPath)) {
    metadataCache.set(normalizedRoot, null);
    return null;
  }

  const parsed = readRawManifest(manifestPath);
  if (parsed.kind !== "tsonic-source-package") {
    metadataCache.set(normalizedRoot, null);
    return null;
  }

  const packageName = requirePackageName(normalizedRoot, manifestPath);
  const source = requireSourceSection(manifestPath, parsed.source);
  const exportsMap = requireExports(manifestPath, source.exports);
  const ambient = requireAmbient(manifestPath, source.ambient);
  const moduleAliases = requireModuleAliases(
    manifestPath,
    packageName,
    source.moduleAliases
  );
  const namespace = requireNamespace(manifestPath, source.namespace);

  const exportPaths = resolveExportPaths(normalizedRoot, exportsMap);
  const metadata: SourcePackageMetadata = {
    packageName,
    packageRoot: normalizedRoot,
    namespace,
    exports: exportsMap,
    exportPaths,
    ambient,
    ambientPaths: resolveAmbientPaths(normalizedRoot, ambient),
    moduleAliases,
    sourceRoot: resolveSourceRoot(normalizedRoot, exportPaths),
  };
  metadataCache.set(normalizedRoot, metadata);
  return metadata;
};

export const clearSourcePackageMetadataCachesForTests = (): void => {
  metadataCache.clear();
};
