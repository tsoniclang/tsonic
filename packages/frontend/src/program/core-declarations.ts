/**
 * Compiler-option helpers and declaration-file scanning for program creation.
 */

import * as ts from "typescript";
import * as path from "node:path";
import * as fs from "node:fs";
import { CompilerOptions } from "./types.js";
import { defaultTsConfig } from "./config.js";

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
  const isLegacySourcePackageDeclaration = (candidatePath: string): boolean => {
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
          isLegacySourcePackageDeclaration(fullPath)
        ) {
          continue;
        }
        visit(fullPath);
      } else if (
        entry.name.endsWith(".d.ts") &&
        !isLegacySourcePackageDeclaration(fullPath)
      ) {
        results.push(fullPath);
      }
    }
  };

  visit(scanRoot);

  return results;
};

export const collectProjectIncludedDeclarationFiles = (
  projectRoot: string,
  compilerOptions: ts.CompilerOptions
): readonly string[] => {
  const configPath = path.join(projectRoot, "tsconfig.json");
  if (!fs.existsSync(configPath)) {
    return [];
  }

  const configResult = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configResult.error) {
    return [];
  }

  const parsed = ts.parseJsonConfigFileContent(
    configResult.config,
    ts.sys,
    projectRoot,
    {
      ...compilerOptions,
      noEmit: true,
    },
    configPath
  );

  return parsed.fileNames
    .filter((fileName) => fileName.endsWith(".d.ts"))
    .map((fileName) => path.resolve(fileName));
};

/**
 * Create TypeScript compiler options from Tsonic options
 * Exported for use by dependency graph builder
 */
export const createCompilerOptions = (
  options: CompilerOptions
): ts.CompilerOptions => {
  const canonicalizePath = (filePath: string): string => {
    const normalizedPath = path.resolve(filePath);
    try {
      return fs.realpathSync(normalizedPath);
    } catch {
      return normalizedPath;
    }
  };
  const resolveCommonRootDir = (...paths: readonly string[]): string => {
    const [first, ...rest] = paths.map(canonicalizePath);
    let current = first ?? canonicalizePath(options.projectRoot);

    for (;;) {
      const containsAll = rest.every((candidate) => {
        const relative = path.relative(current, candidate);
        return (
          relative === "" ||
          (!relative.startsWith("..") && !path.isAbsolute(relative))
        );
      });

      if (containsAll) {
        return current;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        return current;
      }
      current = parent;
    }
  };
  const findNearestNodeModulesRoot = (start: string): string | undefined => {
    let current = path.resolve(start);
    for (;;) {
      if (fs.existsSync(path.join(current, "node_modules"))) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        return undefined;
      }
      current = parent;
    }
  };
  const nodeModulesRoot = findNearestNodeModulesRoot(options.projectRoot);
  const baseConfig: ts.CompilerOptions = {
    ...defaultTsConfig,
    ...(options.strict === undefined ? {} : { strict: options.strict }),
    preserveSymlinks: true,
    rootDir: nodeModulesRoot
      ? resolveCommonRootDir(
          options.sourceRoot,
          options.projectRoot,
          nodeModulesRoot
        )
      : resolveCommonRootDir(options.sourceRoot, options.projectRoot),
  };

  return baseConfig;
};
