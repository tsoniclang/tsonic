/**
 * Import resolution with ESM rules enforcement
 *
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { Result, ok, error } from "../types/result.js";
import { Diagnostic, createDiagnostic } from "../types/diagnostic.js";
import { ResolvedModule } from "./types.js";
import {
  getLocalResolutionBoundary,
  findContainingPackageRoot,
  findInstalledPackageRoot,
  isPathWithinBoundary,
  resolveInstalledPackageImport,
  resolveInstalledPackageImportFromPackageRoot,
  resolveSourcePackageAliasTarget,
  resolveSourcePackageImport,
  resolveSourcePackageImportFromPackageRoot,
} from "./source-package-resolution.js";
import type { DeclarationModuleAlias } from "../program/declaration-module-aliases.js";
import {
  CORE_PACKAGE_NAME,
  CORE_LANG_MODULE_SPECIFIERS,
  CORE_TYPES_MODULE_SPECIFIERS,
  coreDeclarationFileBaseName,
} from "../source-frontend/core-module-identity.js";

const isLocalImport = (specifier: string): boolean =>
  specifier.startsWith(".") || specifier.startsWith("/");

/**
 * Options for import resolution
 */
export type ResolveImportOptions = {
  readonly projectRoot: string;
  readonly surface?: string;
  readonly backendTargetId?: string;
  readonly authoritativeTsonicPackageRoots: ReadonlyMap<string, string>;
  readonly declarationModuleAliases: ReadonlyMap<
    string,
    DeclarationModuleAlias
  >;
};

const findAuthoritativePackageRootForImport = (
  importSpecifier: string,
  authoritativeTsonicPackageRoots: ReadonlyMap<string, string>
): string | undefined => {
  let bestMatch: string | undefined;
  for (const [packageName, packageRoot] of authoritativeTsonicPackageRoots) {
    if (
      importSpecifier === packageName ||
      importSpecifier.startsWith(`${packageName}/`)
    ) {
      if (!bestMatch || packageName.length > bestMatch.length) {
        bestMatch = packageName;
      }
      if (packageName === importSpecifier) {
        return packageRoot;
      }
    }
  }

  return bestMatch ? authoritativeTsonicPackageRoots.get(bestMatch) : undefined;
};

const findCaseMismatchPath = (
  containingDir: string,
  resolvedPath: string
): string | undefined => {
  const relativePath = path.relative(containingDir, resolvedPath);
  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    return undefined;
  }

  const segments = relativePath.split(path.sep).filter((segment) => segment);
  let currentDir = containingDir;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (!segment) {
      continue;
    }
    const entries = fs.readdirSync(currentDir);
    if (entries.includes(segment)) {
      currentDir = path.join(currentDir, segment);
      continue;
    }

    const mismatchedEntry = entries.find(
      (entry) => entry.toLowerCase() === segment.toLowerCase()
    );
    if (!mismatchedEntry) {
      return undefined;
    }

    return path.join(currentDir, mismatchedEntry, ...segments.slice(i + 1));
  }

  return undefined;
};

const corePackageRootExists = (packageRoot: string): boolean =>
  fs.existsSync(path.join(packageRoot, "package.json"));

const activeCorePackageRootForImport = (
  containingFile: string,
  opts: ResolveImportOptions
): string | undefined => {
  const authoritativeRoot =
    opts.authoritativeTsonicPackageRoots.get(CORE_PACKAGE_NAME);
  if (authoritativeRoot !== undefined) return authoritativeRoot;

  const projectCoreRoot = path.join(
    opts.projectRoot,
    "node_modules",
    "@tsonic",
    "core"
  );
  if (corePackageRootExists(projectCoreRoot)) return projectCoreRoot;

  return findInstalledPackageRoot(CORE_PACKAGE_NAME, containingFile);
};

const resolveCoreDeclarationPath = (
  importSpecifier: string,
  containingFile: string,
  opts: ResolveImportOptions
): Result<string | undefined, Diagnostic> => {
  const module = CORE_TYPES_MODULE_SPECIFIERS.has(importSpecifier)
    ? "types"
    : CORE_LANG_MODULE_SPECIFIERS.has(importSpecifier)
      ? "lang"
      : undefined;
  if (!module) {
    return ok(undefined);
  }

  const packageRoot = activeCorePackageRootForImport(containingFile, opts);
  if (packageRoot === undefined) {
    return ok(undefined);
  }

  const declarationPath = path.join(
    packageRoot,
    coreDeclarationFileBaseName(module)
  );
  if (fs.existsSync(declarationPath)) {
    return ok(declarationPath);
  }

  return error(
    createDiagnostic(
      "TSN1004",
      "error",
      `Active @tsonic/core package is missing required source declaration for "${importSpecifier}".`,
      undefined,
      declarationPath
    )
  );
};

/**
 * Resolve import specifier to module
 *
 * @param importSpecifier - The import path to resolve
 * @param containingFile - The file containing the import
 * @param sourceRoot - The project source root
 * @param opts - Package/source-resolution context
 */
export const resolveImport = (
  importSpecifier: string,
  containingFile: string,
  sourceRoot: string,
  opts: ResolveImportOptions
): Result<ResolvedModule, Diagnostic> => {
  const canonicalImportSpecifier = importSpecifier;

  if (isLocalImport(canonicalImportSpecifier)) {
    return resolveLocalImport(
      canonicalImportSpecifier,
      containingFile,
      sourceRoot
    );
  }

  // @tsonic/core packages are type-only (phantom types, attributes) - no runtime code
  if (
    CORE_TYPES_MODULE_SPECIFIERS.has(importSpecifier) ||
    CORE_LANG_MODULE_SPECIFIERS.has(importSpecifier)
  ) {
    const resolvedCoreDeclaration = resolveCoreDeclarationPath(
      importSpecifier,
      containingFile,
      opts
    );
    if (!resolvedCoreDeclaration.ok) return resolvedCoreDeclaration;
    const resolvedPath = resolvedCoreDeclaration.value;
    if (resolvedPath === undefined) {
      return error(
        createDiagnostic(
          "TSN1004",
          "error",
          `Cannot resolve core source declaration import: "${importSpecifier}"`,
          undefined,
          `Expected ${importSpecifier} to resolve through the active @tsonic/core source package.`
        )
      );
    }
    return ok({
      resolvedPath,
      isLocal: false,
      resolutionKind: "phantomTypeOnly",
      originalSpecifier: importSpecifier,
    });
  }

  // Prefer authoritative source packages before installed declaration packages.
  {
    const declarationAlias = opts.declarationModuleAliases.get(
      canonicalImportSpecifier
    );
    if (declarationAlias) {
      const authoritativePackageRoot = findAuthoritativePackageRootForImport(
        declarationAlias.targetSpecifier,
        opts.authoritativeTsonicPackageRoots
      );
      const declarationAliasTarget =
        authoritativePackageRoot !== undefined
          ? resolveSourcePackageAliasTarget(
              declarationAlias.targetSpecifier,
              authoritativePackageRoot,
              opts.surface,
              opts.projectRoot,
              opts.backendTargetId
            )
          : declarationAlias.targetSpecifier === "." ||
              declarationAlias.targetSpecifier.startsWith("./")
            ? resolveSourcePackageAliasTarget(
                declarationAlias.targetSpecifier,
                path.dirname(declarationAlias.declarationFile),
                opts.surface,
                opts.projectRoot,
                opts.backendTargetId
              )
            : resolveSourcePackageImport(
                declarationAlias.targetSpecifier,
                containingFile,
                opts.surface,
                opts.projectRoot,
                opts.backendTargetId
              );
      if (!declarationAliasTarget.ok) {
        return declarationAliasTarget;
      }
      if (declarationAliasTarget.value) {
        return ok({
          resolvedPath: declarationAliasTarget.value.resolvedPath,
          isLocal: true,
          isSourcePackage: true,
          resolutionKind: "local",
          originalSpecifier: importSpecifier,
        });
      }
    }

    const authoritativePackageRoot = findAuthoritativePackageRootForImport(
      canonicalImportSpecifier,
      opts.authoritativeTsonicPackageRoots
    );
    const sourcePackage =
      authoritativePackageRoot !== undefined
        ? resolveSourcePackageImportFromPackageRoot(
            canonicalImportSpecifier,
            authoritativePackageRoot,
            opts.surface,
            opts.projectRoot,
            opts.backendTargetId
          )
        : resolveSourcePackageImport(
            canonicalImportSpecifier,
            containingFile,
            opts.surface,
            opts.projectRoot,
            opts.backendTargetId
          );
    if (!sourcePackage.ok) return sourcePackage;
    if (sourcePackage.value) {
      return ok({
        resolvedPath: sourcePackage.value.resolvedPath,
        isLocal: true,
        isSourcePackage: true,
        resolutionKind: "local",
        originalSpecifier: importSpecifier,
      });
    }

    const installedPackage =
      authoritativePackageRoot !== undefined
        ? resolveInstalledPackageImportFromPackageRoot(
            canonicalImportSpecifier,
            authoritativePackageRoot
          )
        : resolveInstalledPackageImport(
            canonicalImportSpecifier,
            containingFile
          );
    if (!installedPackage.ok) return installedPackage;
    if (installedPackage.value) {
      return ok({
        resolvedPath: installedPackage.value.resolvedPath,
        isLocal: true,
        resolutionKind: "local",
        originalSpecifier: importSpecifier,
      });
    }
  }

  return error(
    createDiagnostic(
      "TSN1004",
      "error",
      `Unsupported module import: "${importSpecifier}"`,
      undefined,
      "Tsonic frontend only resolves local imports, source-package imports, declaration-module aliases, and installed package source/declarations. Backend target bindings are not frontend imports."
    )
  );
};

/**
 * Resolve local import with ESM rules
 *
 * Accepts both .js and .ts extensions:
 * - .js is the ESM-compliant extension (resolves to .ts source files
 *   and to .d.ts declaration siblings from declaration files)
 * - .ts is also accepted for convenience
 */
export const resolveLocalImport = (
  importSpecifier: string,
  containingFile: string,
  sourceRoot: string
): Result<ResolvedModule, Diagnostic> => {
  // Check for .js or .ts extension
  const hasJsExtension = importSpecifier.endsWith(".js");
  const hasTsExtension = importSpecifier.endsWith(".ts");

  if (!hasJsExtension && !hasTsExtension) {
    return error(
      createDiagnostic(
        "TSN1001",
        "error",
        `Local import must have .js or .ts extension: "${importSpecifier}"`,
        undefined,
        `Change to: "${importSpecifier}.js" (ESM) or "${importSpecifier}.ts"`
      )
    );
  }

  const containingDir = path.dirname(containingFile);

  // If .js extension, resolve to the source/declaration file that owns the
  // static module contract. Declaration files in ESM packages import their
  // declaration siblings using runtime .js specifiers, matching TypeScript's
  // declaration-resolution model.
  const jsBaseSpecifier = hasJsExtension
    ? importSpecifier.slice(0, -3)
    : undefined;
  const candidateSpecifiers = jsBaseSpecifier
    ? containingFile.endsWith(".d.ts")
      ? [`${jsBaseSpecifier}.d.ts`, `${jsBaseSpecifier}.ts`]
      : [`${jsBaseSpecifier}.ts`, `${jsBaseSpecifier}.d.ts`]
    : [importSpecifier];
  const candidatePaths = candidateSpecifiers.map((specifier) =>
    path.resolve(containingDir, specifier)
  );
  const resolvedPath = candidatePaths.find((candidatePath) =>
    fs.existsSync(candidatePath)
  );

  // Check if file exists
  if (resolvedPath === undefined) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Cannot find module: "${importSpecifier}"`,
        undefined,
        `Files not found:\n${candidatePaths.join("\n")}`
      )
    );
  }

  const caseMismatchPath =
    process.platform === "win32"
      ? undefined
      : findCaseMismatchPath(containingDir, resolvedPath);
  if (caseMismatchPath && caseMismatchPath !== resolvedPath) {
    return error(
      createDiagnostic(
        "TSN1003",
        "error",
        `Case mismatch in import path: "${importSpecifier}"`,
        undefined,
        `File exists as: ${caseMismatchPath}`
      )
    );
  }

  const localBoundary = resolvedPath.endsWith(".d.ts")
    ? findContainingPackageRoot(containingFile) ??
      getLocalResolutionBoundary(containingFile, sourceRoot)
    : getLocalResolutionBoundary(containingFile, sourceRoot);

  // Ensure it's within the current module boundary (workspace source root or
  // installed source-package root).
  if (!isPathWithinBoundary(resolvedPath, localBoundary)) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Import outside allowed module root: "${importSpecifier}"`,
        undefined,
        `Allowed root: ${localBoundary}`
      )
    );
  }

  return ok({
    resolvedPath,
    isLocal: true,
    resolutionKind: "local",
    originalSpecifier: importSpecifier,
  });
};
