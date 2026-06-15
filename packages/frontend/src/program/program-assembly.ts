/**
 * Program assembly -- TSTS source construction plus Tsonic extension facts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  formatDiagnostics as formatTstsDiagnostics,
  type TstsDiagnostic,
} from "@tsonic/tsts";
import { Result, ok, error } from "../types/result.js";
import {
  addDiagnostic,
  createDiagnostic,
  createDiagnosticsCollector,
  type DiagnosticsCollector,
} from "../types/diagnostic.js";
import {
  hasResolvedSurfaceProfile,
  resolveSurfaceCapabilities,
} from "../surface/profiles.js";
import {
  createTstsSourceProgram,
  type TstsSourceProgram,
} from "../source-frontend/index.js";
import { discoverProgramInputs } from "./program-input-discovery.js";
import type { CompilerOptions, TsonicProgram } from "./types.js";

const canonicalizeFilePath = (filePath: string): string => {
  const normalizedPath = path.resolve(filePath);
  try {
    return fs.realpathSync(normalizedPath);
  } catch {
    return normalizedPath;
  }
};

const dedupeCanonicalFilePaths = (
  filePaths: readonly string[]
): readonly string[] => {
  const uniquePaths: string[] = [];
  const seen = new Set<string>();

  for (const filePath of filePaths) {
    const canonicalPath = canonicalizeFilePath(filePath);
    if (seen.has(canonicalPath)) {
      continue;
    }

    seen.add(canonicalPath);
    uniquePaths.push(canonicalPath);
  }

  return uniquePaths;
};

const createSourceFilePathSet = (
  filePaths: readonly string[]
): ReadonlySet<string> => {
  const canonicalPaths = new Set<string>();

  for (const filePath of filePaths) {
    canonicalPaths.add(canonicalizeFilePath(filePath));
  }

  return canonicalPaths;
};

const isFileUnderDirectory = (filePath: string, directoryPath: string): boolean => {
  const relativePath = path.relative(
    canonicalizeFilePath(directoryPath),
    canonicalizeFilePath(filePath)
  );
  return (
    relativePath.length === 0 ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
};

const getLineColumnFromTextOffset = (
  text: string,
  offset: number
): { readonly line: number; readonly column: number } => {
  const boundedOffset = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let column = 1;

  for (let index = 0; index < boundedOffset; index += 1) {
    if (text.charCodeAt(index) === 10) {
      line += 1;
      column = 1;
      continue;
    }
    column += 1;
  }

  return { line, column };
};

const getTstsDiagnosticLocation = (diagnostic: TstsDiagnostic) => {
  const sourceFile = diagnostic.file;
  if (!sourceFile || diagnostic.loc.pos < 0) {
    return undefined;
  }

  const { line, column } = getLineColumnFromTextOffset(
    sourceFile.Text(),
    diagnostic.loc.pos
  );

  return {
    file: sourceFile.FileName(),
    line,
    column,
    length: Math.max(1, diagnostic.loc.end - diagnostic.loc.pos),
  };
};

const formatTstsDiagnosticMessage = (diagnostic: TstsDiagnostic): string =>
  formatTstsDiagnostics([diagnostic]).trim() ||
  `TSTS source program diagnostic ${diagnostic.code}`;

const collectTstsSourceDiagnostics = (
  sourceProgram: TstsSourceProgram
): DiagnosticsCollector => {
  let collector = createDiagnosticsCollector();

  for (const diagnostic of sourceProgram.compilerDiagnostics) {
    collector = addDiagnostic(
      collector,
      createDiagnostic(
        "TSN1008",
        "error",
        formatTstsDiagnosticMessage(diagnostic),
        getTstsDiagnosticLocation(diagnostic)
      )
    );
  }

  for (const diagnostic of sourceProgram.diagnostics) {
    const severity =
      diagnostic.category === "suggestion" ? "info" : diagnostic.category;
    const sourceFileName = diagnostic.sourceFile?.FileName();
    const sourceLocation =
      sourceFileName === undefined ? "" : `${sourceFileName}: `;
    collector = addDiagnostic(
      collector,
      createDiagnostic(
        "TSN1008",
        severity,
        `${sourceLocation}Source extension '${diagnostic.extensionId}' reported ${diagnostic.code}: ${diagnostic.message}`
      )
    );
  }

  return collector;
};

export const createProgram = (
  filePaths: readonly string[],
  options: CompilerOptions
): Result<TsonicProgram, DiagnosticsCollector> => {
  const surface = options.surface ?? "core";
  const initialSurfaceResolveOptions = { projectRoot: options.projectRoot };
  let surfaceCapabilities = resolveSurfaceCapabilities(
    surface,
    initialSurfaceResolveOptions
  );
  let discovery = discoverProgramInputs(
    filePaths,
    options,
    surfaceCapabilities
  );
  const resolveFinalSurfaceOptions = () => ({
    projectRoot: options.projectRoot,
    authoritativePackageRoots: discovery.authoritativeTsonicPackageRoots,
  });

  if (
    surface !== "core" &&
    !hasResolvedSurfaceProfile(surface, initialSurfaceResolveOptions) &&
    !hasResolvedSurfaceProfile(surface, resolveFinalSurfaceOptions())
  ) {
    return error(
      addDiagnostic(
        createDiagnosticsCollector(),
        createDiagnostic(
          "TSN1004",
          "error",
          `Surface '${surface}' is not a valid ambient surface package.`,
          undefined,
          "Custom surfaces must provide tsonic.surface.json. Use '@tsonic/js' for JS ambient APIs, and add normal packages separately."
        )
      )
    );
  }

  const finalSurfaceCapabilities = resolveSurfaceCapabilities(
    surface,
    resolveFinalSurfaceOptions()
  );
  const surfaceCapabilitiesChanged =
    JSON.stringify(finalSurfaceCapabilities.resolvedModes) !==
      JSON.stringify(surfaceCapabilities.resolvedModes) ||
    JSON.stringify(finalSurfaceCapabilities.requiredTypeRoots) !==
      JSON.stringify(surfaceCapabilities.requiredTypeRoots) ||
    finalSurfaceCapabilities.includesCore !== surfaceCapabilities.includesCore;

  if (surfaceCapabilitiesChanged) {
    surfaceCapabilities = finalSurfaceCapabilities;
    discovery = discoverProgramInputs(filePaths, options, surfaceCapabilities);
  } else {
    surfaceCapabilities = finalSurfaceCapabilities;
  }

  if (discovery.diagnostics.length > 0) {
    return error({
      diagnostics: discovery.diagnostics,
      hasErrors: true,
      hasFatalErrors: discovery.diagnostics.some(
        (diagnostic) => diagnostic.severity === "fatal"
      ),
    });
  }

  const allFiles = dedupeCanonicalFilePaths(discovery.allFiles);

  let sourceProgram: TstsSourceProgram;
  try {
    sourceProgram = createTstsSourceProgram(allFiles, {
      projectRoot: options.projectRoot,
      runExtensionChecks: true,
      sourceDiagnosticFileNames: discovery.emittableSourceFiles.filter(
        (filePath) => isFileUnderDirectory(filePath, options.sourceRoot)
      ),
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return error(
      addDiagnostic(
        createDiagnosticsCollector(),
        createDiagnostic(
          "TSN1008",
          "error",
          `TSTS source program construction failed: ${message}`
        )
      )
    );
  }

  const sourceDiagnostics = collectTstsSourceDiagnostics(sourceProgram);
  if (sourceDiagnostics.hasErrors) {
    return error(sourceDiagnostics);
  }

  const sourceFilePaths = createSourceFilePathSet(
    dedupeCanonicalFilePaths(discovery.emittableSourceFiles)
  );
  const seenSourceFilePaths = new Set<string>();
  const sourceFiles = sourceProgram.sourceFiles.filter((sourceFile) => {
    if (
      sourceFile.IsDeclarationFile === true ||
      !sourceFilePaths.has(canonicalizeFilePath(sourceFile.FileName()))
    ) {
      return false;
    }

    const canonicalFileName = canonicalizeFilePath(sourceFile.FileName());
    if (seenSourceFilePaths.has(canonicalFileName)) {
      return false;
    }

    seenSourceFilePaths.add(canonicalFileName);
    return true;
  });

  const declarationSourceFiles = sourceProgram.sourceFiles.filter(
    (sourceFile) => sourceFile.IsDeclarationFile === true
  );

  const firstTstsSourceFile = sourceFiles[0] ?? sourceProgram.sourceFiles[0];
  if (!firstTstsSourceFile) {
    return error(
      addDiagnostic(
        createDiagnosticsCollector(),
        createDiagnostic("TSN1008", "error", "TSTS source program is empty.")
      )
    );
  }

  const sourceChecker = sourceProgram.withTypeChecker(
    firstTstsSourceFile,
    (checker) => checker
  );

  return ok({
    sourceProgram,
    sourceChecker,
    options,
    surfaceCapabilities,
    authoritativeTsonicPackageRoots:
      discovery.authoritativeTsonicPackageRoots,
    declarationModuleAliases: discovery.declarationModuleAliases,
    sourceFiles,
    declarationSourceFiles,
  });
};
