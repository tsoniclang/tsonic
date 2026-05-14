import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { CompilerOptions } from "./types.js";
import type { SurfaceCapabilities } from "../surface/profiles.js";

export type WorkspaceGraphNodeKind =
  | "source"
  | "ambient"
  | "config"
  | "surface"
  | "package"
  | "binding";

export type WorkspaceGraphNode = {
  readonly id: string;
  readonly kind: WorkspaceGraphNodeKind;
  readonly path: string;
  readonly sha256: string;
};

export type WorkspaceGraphEdge = {
  readonly from: string;
  readonly to: string;
  readonly specifier: string;
};

export type WorkspaceGraphSnapshot = {
  readonly schemaVersion: 1;
  readonly rootFingerprint: string;
  readonly projectRoot: string;
  readonly sourceRoot: string;
  readonly surfaceModes: readonly string[];
  readonly nodes: readonly WorkspaceGraphNode[];
  readonly edges: readonly WorkspaceGraphEdge[];
};

export type WorkspaceGraphInput = {
  readonly projectRoot: string;
  readonly sourceRoot: string;
  readonly sourceFiles: readonly string[];
  readonly ambientFiles: readonly string[];
  readonly typeRoots: readonly string[];
  readonly edges: readonly WorkspaceGraphEdge[];
  readonly options: CompilerOptions;
  readonly surfaceCapabilities: SurfaceCapabilities;
};

const normalizePath = (filePath: string): string =>
  filePath.replace(/\\/g, "/");

const normalizeAbsolutePath = (filePath: string): string =>
  normalizePath(resolve(filePath));

const pathId = (projectRoot: string, filePath: string): string => {
  const absoluteRoot = resolve(projectRoot);
  const absolutePath = resolve(filePath);
  const relativePath = relative(absoluteRoot, absolutePath);
  if (relativePath === "") {
    return ".";
  }
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return normalizeAbsolutePath(absolutePath);
  }
  return normalizePath(relativePath);
};

const sha256 = (bytes: string): string =>
  createHash("sha256").update(bytes).digest("hex");

const fileSha256 = (filePath: string): string =>
  sha256(readFileSync(filePath, "utf8"));

const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
};

const classifyNode = (
  filePath: string,
  ambientFileIds: ReadonlySet<string>,
  projectRoot: string
): WorkspaceGraphNodeKind => {
  const normalized = normalizePath(filePath);
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
  if (ambientFileIds.has(pathId(projectRoot, filePath))) {
    return "ambient";
  }
  if (basename === "bindings.json" || basename === "tsonic.bindings.json") {
    return "binding";
  }
  if (basename === "tsonic.surface.json") {
    return "surface";
  }
  if (basename === "package.json" || basename === "tsonic.package.json") {
    return "package";
  }
  if (basename === "tsconfig.json" || basename === "tsonic.json") {
    return "config";
  }
  return "source";
};

const existingFiles = (files: Iterable<string>): readonly string[] =>
  Array.from(new Set(Array.from(files).map((filePath) => resolve(filePath))))
    .filter((filePath) => existsSync(filePath) && statSync(filePath).isFile())
    .sort((left, right) =>
      normalizePath(left).localeCompare(normalizePath(right))
    );

const collectProjectConfigFiles = (
  projectRoot: string,
  sourceRoot: string
): readonly string[] => {
  const roots = new Set([resolve(projectRoot), resolve(sourceRoot)]);
  const candidates: string[] = [];
  for (const root of roots) {
    candidates.push(
      resolve(root, "package.json"),
      resolve(root, "tsconfig.json"),
      resolve(root, "tsonic.json"),
      resolve(root, "tsonic.workspace.json"),
      resolve(root, "tsonic.package.json"),
      resolve(root, "tsonic.surface.json"),
      resolve(root, "tsonic.bindings.json")
    );
  }
  return existingFiles(candidates);
};

const collectTypeRootMetadataFiles = (
  typeRoots: readonly string[]
): readonly string[] => {
  const candidates: string[] = [];
  for (const typeRoot of typeRoots) {
    candidates.push(
      resolve(typeRoot, "package.json"),
      resolve(typeRoot, "tsonic.package.json"),
      resolve(typeRoot, "tsonic.surface.json"),
      resolve(typeRoot, "tsonic.bindings.json"),
      resolve(typeRoot, "bindings.json")
    );
  }
  return existingFiles(candidates);
};

const collectNearestPackageMetadataFiles = (
  files: readonly string[],
  projectRoot: string
): readonly string[] => {
  const candidates: string[] = [];
  const visitedDirs = new Set<string>();

  for (const file of files) {
    let current = resolve(file);
    if (existsSync(current) && statSync(current).isFile()) {
      current = resolve(current, "..");
    }

    for (;;) {
      if (!visitedDirs.has(current)) {
        visitedDirs.add(current);
        candidates.push(
          resolve(current, "package.json"),
          resolve(current, "tsonic.package.json"),
          resolve(current, "tsonic.surface.json"),
          resolve(current, "tsonic.bindings.json"),
          resolve(current, "bindings.json")
        );
      }

      if (current === resolve(projectRoot)) {
        break;
      }

      const parent = resolve(current, "..");
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }

  return existingFiles(candidates);
};

const sanitizeOptionsForFingerprint = (
  options: CompilerOptions
): Record<string, unknown> => ({
  rootNamespace: options.rootNamespace,
  strict: options.strict,
  surface: options.surface,
  typeRoots: options.typeRoots,
});

export const buildWorkspaceGraphSnapshot = (
  input: WorkspaceGraphInput
): WorkspaceGraphSnapshot => {
  const projectRoot = normalizeAbsolutePath(input.projectRoot);
  const sourceRoot = normalizeAbsolutePath(input.sourceRoot);
  const ambientFileIds = new Set(
    input.ambientFiles.map((filePath) => pathId(projectRoot, filePath))
  );
  const files = existingFiles([
    ...input.sourceFiles,
    ...input.ambientFiles,
    ...collectProjectConfigFiles(projectRoot, sourceRoot),
    ...collectNearestPackageMetadataFiles(input.sourceFiles, projectRoot),
    ...collectTypeRootMetadataFiles(input.typeRoots),
  ]);
  const nodes = files.map((filePath) => ({
    id: pathId(projectRoot, filePath),
    kind: classifyNode(filePath, ambientFileIds, projectRoot),
    path: normalizeAbsolutePath(filePath),
    sha256: fileSha256(filePath),
  }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = input.edges
    .map((edge) => ({
      from: pathId(projectRoot, edge.from),
      to: pathId(projectRoot, edge.to),
      specifier: edge.specifier,
    }))
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
    .sort(
      (left, right) =>
        left.from.localeCompare(right.from) ||
        left.to.localeCompare(right.to) ||
        left.specifier.localeCompare(right.specifier)
    );
  const snapshotBody = {
    schemaVersion: 1,
    projectRoot,
    sourceRoot,
    surfaceModes: [...input.surfaceCapabilities.resolvedModes],
    options: sanitizeOptionsForFingerprint(input.options),
    nodes,
    edges,
  };

  return {
    schemaVersion: 1,
    rootFingerprint: sha256(stableJson(snapshotBody)),
    projectRoot,
    sourceRoot,
    surfaceModes: snapshotBody.surfaceModes,
    nodes,
    edges,
  };
};
