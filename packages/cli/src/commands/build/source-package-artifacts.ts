import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import * as nodePath from "node:path";
import type { ResolvedConfig, Result } from "../../types.js";

type ProjectPackageJson = {
  readonly files?: unknown;
  readonly exports?: unknown;
  readonly main?: unknown;
  readonly types?: unknown;
};

type SourcePackageManifest = {
  readonly kind?: unknown;
  readonly source?: {
    readonly ambient?: unknown;
  };
};

const normalizeSlashes = (pathLike: string): string => pathLike.replace(/\\/g, "/");

const matchesGlob = (candidate: string, pattern: string): boolean => {
  const pathApi = nodePath as unknown as {
    readonly matchesGlob?: (path: string, pattern: string) => boolean;
  };
  return pathApi.matchesGlob?.(candidate, pattern) ?? false;
};

const readProjectPackageJson = (
  projectRoot: string
): Result<ProjectPackageJson & { readonly raw: string }, string> => {
  const packageJsonPath = nodePath.join(projectRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return {
      ok: false,
      error: `Source-package build requires package.json at ${packageJsonPath}`,
    };
  }

  try {
    const raw = readFileSync(packageJsonPath, "utf-8");
    const parsed = JSON.parse(raw) as ProjectPackageJson;
    return { ok: true, value: { ...parsed, raw } };
  } catch (error) {
    return {
      ok: false,
      error:
        `Failed to parse project package.json: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const parseAmbientEntries = (value: unknown): readonly string[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("`source.ambient` must be a string array.");
  }

  return value.map((entry) => {
    if (typeof entry !== "string" || !entry.startsWith("./")) {
      throw new Error("`source.ambient` entries must be relative package paths.");
    }
    return normalizeSlashes(entry.slice(2));
  });
};

const validateSourcePackageManifest = (
  projectRoot: string
): Result<{ readonly manifestPath: string; readonly ambientFiles: readonly string[] }, string> => {
  const manifestPath = nodePath.join(projectRoot, "tsonic.package.json");
  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      error:
        `Source-package build requires tsonic.package.json at ${manifestPath}`,
    };
  }

  try {
    const parsed = JSON.parse(
      readFileSync(manifestPath, "utf-8")
    ) as SourcePackageManifest;
    if (parsed.kind !== "tsonic-source-package") {
      return {
        ok: false,
        error:
          `Source-package build requires kind "tsonic-source-package" in ${manifestPath}`,
      };
    }
    return {
      ok: true,
      value: {
        manifestPath,
        ambientFiles: parseAmbientEntries(parsed.source?.ambient),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        `Failed to parse source package manifest: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

const collectExportTargets = (
  value: unknown,
  out: Set<string>
): void => {
  if (typeof value === "string") {
    if (value.startsWith("./")) {
      out.add(normalizeSlashes(value.slice(2)));
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectExportTargets(item, out);
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    collectExportTargets(item, out);
  }
};

const collectFilePatterns = (packageJson: ProjectPackageJson): readonly string[] => {
  if (!Array.isArray(packageJson.files)) return [];
  return packageJson.files.filter(
    (entry): entry is string =>
      typeof entry === "string" && entry.trim().length > 0
  );
};

const shouldSkipDirectory = (
  relativeDir: string,
  outputDirectoryName: string
): boolean => {
  const normalized = normalizeSlashes(relativeDir);
  const topLevel = normalized.split("/")[0] ?? normalized;
  return (
    topLevel === ".git" ||
    topLevel === "node_modules" ||
    topLevel === "dist" ||
    topLevel === outputDirectoryName ||
    topLevel === ".temp" ||
    topLevel === ".tests"
  );
};

const walkProjectFiles = (
  projectRoot: string,
  outputDirectoryName: string
): readonly string[] => {
  const out: string[] = [];

  const visit = (absoluteDir: string, relativeDir: string): void => {
    if (relativeDir.length > 0 && shouldSkipDirectory(relativeDir, outputDirectoryName)) {
      return;
    }

    const entries = readdirSync(absoluteDir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    for (const entry of entries) {
      const absolutePath = nodePath.join(absoluteDir, entry.name);
      const relativePath = relativeDir.length
        ? `${relativeDir}/${entry.name}`
        : entry.name;

      if (entry.isDirectory()) {
        visit(absolutePath, normalizeSlashes(relativePath));
        continue;
      }

      if (entry.isFile()) {
        out.push(normalizeSlashes(relativePath));
      }
    }
  };

  visit(projectRoot, "");
  return out;
};

const copyProjectFile = (
  projectRoot: string,
  distRoot: string,
  relativePath: string
): void => {
  const sourcePath = nodePath.join(projectRoot, ...relativePath.split("/"));
  if (!existsSync(sourcePath)) return;
  const targetPath = nodePath.join(distRoot, ...relativePath.split("/"));
  mkdirSync(nodePath.dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
};

export const emitSourcePackageArtifacts = (
  config: ResolvedConfig
): Result<void, string> => {
  const packageJsonResult = readProjectPackageJson(config.projectRoot);
  if (!packageJsonResult.ok) return packageJsonResult;

    const manifestResult = validateSourcePackageManifest(config.projectRoot);
    if (!manifestResult.ok) return manifestResult;

  const distRoot = nodePath.join(config.projectRoot, "dist");
  mkdirSync(distRoot, { recursive: true });

  try {
    writeFileSync(
      nodePath.join(distRoot, "package.json"),
      packageJsonResult.value.raw,
      "utf-8"
    );

    const explicitFiles = new Set<string>();
    const typesPath = packageJsonResult.value.types;
    if (typeof typesPath === "string" && typesPath.startsWith("./")) {
      explicitFiles.add(normalizeSlashes(typesPath.slice(2)));
    }
    const mainPath = packageJsonResult.value.main;
    if (typeof mainPath === "string" && mainPath.startsWith("./")) {
      explicitFiles.add(normalizeSlashes(mainPath.slice(2)));
    }
    collectExportTargets(packageJsonResult.value.exports, explicitFiles);
    explicitFiles.add("tsonic.package.json");
    for (const ambientFile of manifestResult.value.ambientFiles) {
      explicitFiles.add(ambientFile);
    }

    for (const rootFile of [
      "README.md",
      "README.MD",
      "LICENSE",
      "LICENSE.md",
      "tsonic.surface.json",
      "families.json",
    ]) {
      if (existsSync(nodePath.join(config.projectRoot, rootFile))) {
        explicitFiles.add(rootFile);
      }
    }

    const filePatterns = collectFilePatterns(packageJsonResult.value);
    const sourceRootPrefix = `${normalizeSlashes(config.sourceRoot).replace(/\/+$/, "")}/`;
    const outputDirectoryName = normalizeSlashes(config.outputDirectory).split("/").pop() ?? config.outputDirectory;
    const projectFiles = walkProjectFiles(config.projectRoot, outputDirectoryName);

    for (const relativePath of projectFiles) {
      if (relativePath === "package.json") continue;

      const isSourceFile =
        relativePath === normalizeSlashes(config.sourceRoot) ||
        relativePath.startsWith(sourceRootPrefix);
      const matchesFiles = filePatterns.some((pattern) =>
        matchesGlob(relativePath, normalizeSlashes(pattern))
      );

      if (!isSourceFile && !matchesFiles && !explicitFiles.has(relativePath)) {
        continue;
      }

      copyProjectFile(config.projectRoot, distRoot, relativePath);
    }

    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error:
        `Failed to emit source-package artifacts: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
