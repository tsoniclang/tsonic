/**
 * Declaration-file scanning for program creation.
 */

import * as path from "node:path";
import * as fs from "node:fs";

/**
 * Recursively scan a directory for .d.ts files
 */
export const scanForDeclarationFiles = (dir: string): readonly string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const scanRoot = path.resolve(dir);
  const sourcePackageRoot = fs.existsSync(
    path.join(scanRoot, "tsonic.package.json")
  )
    ? scanRoot
    : undefined;
  const results: string[] = [];
  const isSourcePackageInternalDeclaration = (
    candidatePath: string
  ): boolean => {
    if (!sourcePackageRoot) {
      return false;
    }

    const relativePath = path
      .relative(sourcePackageRoot, candidatePath)
      .split(path.sep)
      .join("/");
    return (
      relativePath === "index/internal/index.d.ts" ||
      relativePath.startsWith("index/internal/")
    );
  };

  const visit = (currentDir: string): void => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === ".git" ||
          isSourcePackageInternalDeclaration(fullPath)
        ) {
          continue;
        }
        visit(fullPath);
      } else if (
        entry.name.endsWith(".d.ts") &&
        !isSourcePackageInternalDeclaration(fullPath)
      ) {
        results.push(fullPath);
      }
    }
  };

  visit(scanRoot);

  return results;
};

type ProjectConfigFileList = {
  readonly files?: readonly string[];
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
};

const asStringArray = (value: unknown): readonly string[] | undefined =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : undefined;

const readProjectConfigFileList = (
  configPath: string
): ProjectConfigFileList | undefined => {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      readonly files?: unknown;
      readonly include?: unknown;
      readonly exclude?: unknown;
    };
    return {
      files: asStringArray(parsed.files),
      include: asStringArray(parsed.include),
      exclude: asStringArray(parsed.exclude),
    };
  } catch {
    return undefined;
  }
};

const toPosixRelativePath = (projectRoot: string, filePath: string): string =>
  path.relative(projectRoot, filePath).split(path.sep).join("/");

const escapeRegExp = (text: string): string =>
  text.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");

const globPatternToRegExp = (pattern: string): RegExp => {
  const normalized = pattern.split(path.sep).join("/");
  let source = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
      continue;
    }
    if (char === "*") {
      source += "[^/]*";
      continue;
    }
    source += escapeRegExp(char ?? "");
  }

  return new RegExp(`${source}$`);
};

const staticGlobRoot = (projectRoot: string, pattern: string): string => {
  const normalized = pattern.split(path.sep).join("/");
  const wildcardIndex = normalized.search(/[*?[\]{}]/);
  const staticPrefix =
    wildcardIndex === -1 ? normalized : normalized.slice(0, wildcardIndex);
  const directoryPrefix = staticPrefix.endsWith("/")
    ? staticPrefix
    : path.dirname(staticPrefix);
  return path.resolve(
    projectRoot,
    directoryPrefix === "." ? "" : directoryPrefix
  );
};

const isExcluded = (
  projectRoot: string,
  filePath: string,
  excludeMatchers: readonly RegExp[]
): boolean => {
  const relativePath = toPosixRelativePath(projectRoot, filePath);
  return excludeMatchers.some((matcher) => matcher.test(relativePath));
};

const collectIncludedDeclarationFiles = (
  projectRoot: string,
  includePattern: string,
  excludeMatchers: readonly RegExp[]
): readonly string[] => {
  const matcher = globPatternToRegExp(includePattern);
  const root = staticGlobRoot(projectRoot, includePattern);
  if (!fs.existsSync(root)) {
    return [];
  }

  if (fs.statSync(root).isFile()) {
    const relativePath = toPosixRelativePath(projectRoot, root);
    return root.endsWith(".d.ts") &&
      matcher.test(relativePath) &&
      !isExcluded(projectRoot, root, excludeMatchers)
      ? [root]
      : [];
  }

  return scanForDeclarationFiles(root).filter((filePath) => {
    const relativePath = toPosixRelativePath(projectRoot, filePath);
    return (
      matcher.test(relativePath) &&
      !isExcluded(projectRoot, filePath, excludeMatchers)
    );
  });
};

export const collectProjectIncludedDeclarationFiles = (
  projectRoot: string
): readonly string[] => {
  const configPath = path.join(projectRoot, "tsconfig.json");
  if (!fs.existsSync(configPath)) {
    return [];
  }

  const config = readProjectConfigFileList(configPath);
  if (!config) {
    return [];
  }

  const explicitFiles = (config.files ?? [])
    .map((fileName) => path.resolve(projectRoot, fileName))
    .filter((fileName) => fileName.endsWith(".d.ts"));
  const excludeMatchers = (config.exclude ?? []).map(globPatternToRegExp);
  const includedFiles = (config.include ?? []).flatMap((pattern) =>
    collectIncludedDeclarationFiles(projectRoot, pattern, excludeMatchers)
  );

  return Array.from(new Set([...explicitFiles, ...includedFiles]));
};
