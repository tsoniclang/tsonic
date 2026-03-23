import * as fs from "node:fs";
import * as path from "node:path";
import { getClassNameFromPath } from "../resolver/naming.js";
import { getNamespaceFromPath } from "../resolver/namespace.js";
import { readPackageName } from "./module-resolution.js";

type SourcePackageManifest = {
  readonly kind?: unknown;
  readonly source?: {
    readonly exports?: Record<string, unknown>;
  };
};

type SourcePackageEntryMapping = {
  readonly targetPath: string;
  readonly matchRoot: string;
  readonly namespaceRoot: string;
  readonly entryClassName: string;
};

type SourceFileIdentity = {
  readonly filePath: string;
  readonly namespace: string;
  readonly className: string;
};

const sourcePackageRootCache = new Map<string, string | null>();
const sourcePackageManifestCache = new Map<string, SourcePackageManifest | null>();
const sourcePackageBindingCache = new Map<
  string,
  ReadonlyMap<string, string>
>();
const sourcePackageRootNamespaceCache = new Map<string, string | null>();

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

const readSourcePackageManifest = (
  packageRoot: string
): SourcePackageManifest | null => {
  const normalizedRoot = normalizeAbsolutePath(packageRoot);
  const cached = sourcePackageManifestCache.get(normalizedRoot);
  if (cached !== undefined) {
    return cached;
  }

  const manifestPath = path.join(normalizedRoot, "tsonic", "package-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    sourcePackageManifestCache.set(normalizedRoot, null);
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as unknown;
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      sourcePackageManifestCache.set(normalizedRoot, null);
      return null;
    }

    const manifest = parsed as SourcePackageManifest;
    if (manifest.kind !== "tsonic-source-package") {
      sourcePackageManifestCache.set(normalizedRoot, null);
      return null;
    }

    sourcePackageManifestCache.set(normalizedRoot, manifest);
    return manifest;
  } catch {
    sourcePackageManifestCache.set(normalizedRoot, null);
    return null;
  }
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
    if (
      fs.existsSync(path.join(currentDir, "package.json")) &&
      readSourcePackageManifest(currentDir)
    ) {
      sourcePackageRootCache.set(normalizedFilePath, currentDir);
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      sourcePackageRootCache.set(normalizedFilePath, null);
      return undefined;
    }
    currentDir = parentDir;
  }
};

const readSourcePackageModuleBindings = (
  packageRoot: string
): ReadonlyMap<string, string> => {
  const normalizedRoot = normalizeAbsolutePath(packageRoot);
  const cached = sourcePackageBindingCache.get(normalizedRoot);
  if (cached !== undefined) {
    return cached;
  }

  const bindingsPath = path.join(normalizedRoot, "bindings.json");
  if (!fs.existsSync(bindingsPath)) {
    const empty = new Map<string, string>();
    sourcePackageBindingCache.set(normalizedRoot, empty);
    return empty;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(bindingsPath, "utf-8")) as {
      readonly bindings?: Record<
        string,
        {
          readonly kind?: unknown;
          readonly type?: unknown;
          readonly sourceImport?: unknown;
        }
      >;
    };

    const sourceImportToType = new Map<string, string>();
    const bindings = parsed.bindings;
    if (bindings && typeof bindings === "object") {
      for (const descriptor of Object.values(bindings)) {
        if (
          descriptor?.kind === "module" &&
          typeof descriptor.type === "string" &&
          typeof descriptor.sourceImport === "string" &&
          descriptor.sourceImport.length > 0 &&
          !sourceImportToType.has(descriptor.sourceImport)
        ) {
          sourceImportToType.set(descriptor.sourceImport, descriptor.type);
        }
      }
    }

    sourcePackageBindingCache.set(normalizedRoot, sourceImportToType);
    return sourceImportToType;
  } catch {
    const empty = new Map<string, string>();
    sourcePackageBindingCache.set(normalizedRoot, empty);
    return empty;
  }
};

const sanitizeNamespaceSegment = (segment: string): string => {
  const cleaned = segment.replace(/[^a-zA-Z0-9_]/g, "");
  if (cleaned.length === 0) return "_";
  return /^\d/.test(cleaned) ? `_${cleaned}` : cleaned;
};

const promoteEntryClassToNamespaceSegment = (entryClassName: string): string => {
  const parts = entryClassName
    .split(/[^a-zA-Z0-9]+/g)
    .filter((part) => part.length > 0);
  const pascal = (parts.length > 0 ? parts : [entryClassName])
    .map((part) =>
      part.length === 0 ? "" : part[0]!.toUpperCase() + part.slice(1)
    )
    .join("");
  return sanitizeNamespaceSegment(pascal);
};

const derivePackageFallbackNamespace = (packageName: string): string => {
  const segments = packageName
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => sanitizeNamespaceSegment(segment.replace(/^@/, "")));

  return segments.length > 0 ? segments.join(".") : "External";
};

const inferPackageRootNamespaceFromBindings = (
  packageRoot: string
): string | undefined => {
  const normalizedRoot = normalizeAbsolutePath(packageRoot);
  const cached = sourcePackageRootNamespaceCache.get(normalizedRoot);
  if (cached !== undefined) {
    return cached ?? undefined;
  }

  const namespaceRoots = [...readSourcePackageModuleBindings(normalizedRoot).values()]
    .map((moduleClrType) => {
      const lastDot = moduleClrType.lastIndexOf(".");
      return lastDot > 0 ? moduleClrType.slice(0, lastDot) : undefined;
    })
    .filter((namespaceRoot): namespaceRoot is string => !!namespaceRoot);

  if (namespaceRoots.length === 0) {
    sourcePackageRootNamespaceCache.set(normalizedRoot, null);
    return undefined;
  }

  let commonSegments = namespaceRoots[0]!.split(".");
  for (const namespaceRoot of namespaceRoots.slice(1)) {
    const nextSegments = namespaceRoot.split(".");
    let prefixLength = 0;
    while (
      prefixLength < commonSegments.length &&
      prefixLength < nextSegments.length &&
      commonSegments[prefixLength] === nextSegments[prefixLength]
    ) {
      prefixLength += 1;
    }
    commonSegments = commonSegments.slice(0, prefixLength);
    if (commonSegments.length === 0) {
      break;
    }
  }

  const inferredNamespace =
    commonSegments.length > 0 ? commonSegments.join(".") : undefined;
  sourcePackageRootNamespaceCache.set(normalizedRoot, inferredNamespace ?? null);
  return inferredNamespace;
};

const namespaceTailEqualsEntryClass = (
  namespaceRoot: string,
  entryClassName: string
): boolean => {
  const tail = namespaceRoot.split(".").pop();
  return (
    typeof tail === "string" &&
    tail.length > 0 &&
    tail.toLowerCase() === entryClassName.toLowerCase()
  );
};

const exportKeyToSourceImport = (
  packageName: string,
  exportKey: string
): string | undefined => {
  if (exportKey === ".") {
    return packageName;
  }

  if (!exportKey.startsWith("./")) {
    return undefined;
  }

  return `${packageName}/${exportKey.slice(2)}`;
};

const isIndexModuleTarget = (targetPath: string): boolean =>
  /^index\.[cm]?[jt]s$/i.test(path.basename(targetPath));

const resolveSourcePackageEntryMapping = (
  filePath: string,
  packageRoot: string,
  packageName: string
): SourcePackageEntryMapping | undefined => {
  const manifest = readSourcePackageManifest(packageRoot);
  const exportsField = manifest?.source?.exports;
  if (!exportsField || typeof exportsField !== "object") {
    return undefined;
  }

  const sourceImportToType = readSourcePackageModuleBindings(packageRoot);
  const normalizedFilePath = normalizeAbsolutePath(filePath);

  let bestMatch: SourcePackageEntryMapping | undefined;
  for (const [exportKey, rawTarget] of Object.entries(exportsField)) {
    if (typeof rawTarget !== "string" || rawTarget.length === 0) {
      continue;
    }

    const sourceImport = exportKeyToSourceImport(packageName, exportKey);
    if (!sourceImport) continue;

    const moduleClrType = sourceImportToType.get(sourceImport);
    if (!moduleClrType) continue;

    const lastDot = moduleClrType.lastIndexOf(".");
    if (lastDot <= 0 || lastDot === moduleClrType.length - 1) {
      continue;
    }

    const targetPath = normalizeAbsolutePath(path.resolve(packageRoot, rawTarget));
    const namespaceRoot = moduleClrType.slice(0, lastDot);
    const entryClassName = moduleClrType.slice(lastDot + 1);
    const matchRoot = isIndexModuleTarget(targetPath)
      ? path.dirname(targetPath)
      : targetPath;
    const isMatch = isIndexModuleTarget(targetPath)
      ? isPathWithinRoot(normalizedFilePath, matchRoot)
      : normalizedFilePath === targetPath;

    if (!isMatch) {
      continue;
    }

    if (!bestMatch || matchRoot.length > bestMatch.matchRoot.length) {
      bestMatch = {
        targetPath,
        matchRoot,
        namespaceRoot,
        entryClassName,
      };
    }
  }

  return bestMatch;
};

const defaultSourceFileIdentity = (
  filePath: string,
  sourceRoot: string,
  rootNamespace: string
): SourceFileIdentity => ({
  filePath: normalizeRelativePath(
    path.relative(normalizeAbsolutePath(sourceRoot), normalizeAbsolutePath(filePath))
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

  const packageName = readPackageName(path.join(packageRoot, "package.json"));
  if (!packageName) {
    return defaultSourceFileIdentity(
      normalizedFilePath,
      normalizedSourceRoot,
      rootNamespace
    );
  }

  const relativeFromPackageRoot = normalizeRelativePath(
    path.relative(packageRoot, normalizedFilePath)
  );
  const stableFilePath = normalizeRelativePath(
    path.join("node_modules", ...packageName.split("/"), relativeFromPackageRoot)
  );

  const mapping = resolveSourcePackageEntryMapping(
    normalizedFilePath,
    packageRoot,
    packageName
  );
  if (mapping) {
    const isIndexEntry = isIndexModuleTarget(mapping.targetPath);
    const shouldOverrideEntryClassName =
      normalizedFilePath === mapping.targetPath && isIndexEntry;
    const isDirectNonIndexEntry =
      normalizedFilePath === mapping.targetPath && !isIndexEntry;
    const namespaceRootForNestedFiles =
      isIndexEntry &&
      !namespaceTailEqualsEntryClass(
        mapping.namespaceRoot,
        mapping.entryClassName
      )
        ? `${mapping.namespaceRoot}.${promoteEntryClassToNamespaceSegment(
            mapping.entryClassName
          )}`
        : mapping.namespaceRoot;
    return {
      filePath: stableFilePath,
      namespace: isDirectNonIndexEntry
        ? mapping.namespaceRoot
        : getNamespaceFromPath(
            normalizedFilePath,
            mapping.matchRoot,
            normalizedFilePath === mapping.targetPath
              ? mapping.namespaceRoot
              : namespaceRootForNestedFiles
          ),
      className: shouldOverrideEntryClassName
        ? mapping.entryClassName
        : getClassNameFromPath(normalizedFilePath),
    };
  }

  const packageSourceRoot = fs.existsSync(path.join(packageRoot, "src"))
    ? path.join(packageRoot, "src")
    : packageRoot;
  const fallbackNamespace =
    inferPackageRootNamespaceFromBindings(packageRoot) ??
    derivePackageFallbackNamespace(packageName);

  return {
    filePath: stableFilePath,
    namespace: getNamespaceFromPath(
      normalizedFilePath,
      packageSourceRoot,
      fallbackNamespace
    ),
    className: getClassNameFromPath(normalizedFilePath),
  };
};

export const resolveSourceFileNamespace = (
  filePath: string,
  sourceRoot: string,
  rootNamespace: string
): string => resolveSourceFileIdentity(filePath, sourceRoot, rootNamespace).namespace;
