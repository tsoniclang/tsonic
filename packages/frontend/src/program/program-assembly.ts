/**
 * Program assembly -- TSTS source construction plus Tsonic extension facts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  formatDiagnostics as formatTstsDiagnostics,
  type TstsDiagnostic,
  type TstsSourceFile,
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
import {
  discoverProgramInputs,
  type ProgramInputDiscovery,
} from "./program-input-discovery.js";
import {
  buildWorkspaceGraphSnapshot,
  type WorkspaceGraphEdge,
} from "./workspace-fingerprint.js";
import type { CompilerOptions, TsonicProgram } from "./types.js";
import type { BackendTargetId } from "../lowering/index.js";

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

const isRuntimeSourceFile = (sourceFile: TstsSourceFile): boolean =>
  sourceFile.IsDeclarationFile !== true;

const tstsSourceFilePath = (sourceFile: TstsSourceFile): string =>
  canonicalizeFilePath(sourceFile.FileName());

const collectTstsRuntimeSourceFiles = (
  sourceProgram: TstsSourceProgram,
  seedFiles: readonly string[]
): Result<readonly TstsSourceFile[], DiagnosticsCollector> => {
  const runtimeSourceFilesByPath = new Map<string, TstsSourceFile>();
  for (const sourceFile of sourceProgram.sourceFiles) {
    if (!isRuntimeSourceFile(sourceFile)) {
      continue;
    }
    runtimeSourceFilesByPath.set(tstsSourceFilePath(sourceFile), sourceFile);
  }

  const seedPaths = dedupeCanonicalFilePaths(seedFiles);
  const missingSeeds = seedPaths.filter(
    (seedFile) => !runtimeSourceFilesByPath.has(seedFile)
  );
  if (missingSeeds.length > 0) {
    return error(
      addDiagnostic(
        createDiagnosticsCollector(),
        createDiagnostic(
          "TSN1008",
          "fatal",
          "TSTS source program did not load every requested runtime seed file.",
          undefined,
          missingSeeds.join("\n")
        )
      )
    );
  }

  const selectedSourceFiles: TstsSourceFile[] = [];
  const seenSourceFiles = new Set<string>();
  const queue = [...seedPaths];

  while (queue.length > 0) {
    const currentPath = queue.shift();
    if (currentPath === undefined || seenSourceFiles.has(currentPath)) {
      continue;
    }

    const sourceFile = runtimeSourceFilesByPath.get(currentPath);
    if (sourceFile === undefined) {
      continue;
    }

    seenSourceFiles.add(currentPath);
    selectedSourceFiles.push(sourceFile);

    for (const moduleImport of sourceProgram.moduleGraph.getImports(sourceFile)) {
      const resolvedModule = moduleImport.resolvedModule;
      if (resolvedModule === undefined) {
        continue;
      }
      const resolvedPath = canonicalizeFilePath(resolvedModule.resolvedFileName);
      if (
        runtimeSourceFilesByPath.has(resolvedPath) &&
        !seenSourceFiles.has(resolvedPath)
      ) {
        queue.push(resolvedPath);
      }
    }
  }

  return ok(selectedSourceFiles);
};

const collectTstsWorkspaceGraphEdges = (
  sourceProgram: TstsSourceProgram
): readonly WorkspaceGraphEdge[] => {
  const edges = new Map<string, WorkspaceGraphEdge>();
  for (const sourceModule of sourceProgram.moduleGraph.modules) {
    for (const moduleImport of sourceModule.imports) {
      const resolvedModule = moduleImport.resolvedModule;
      if (resolvedModule === undefined) {
        continue;
      }
      const from = canonicalizeFilePath(sourceModule.fileName);
      const to = canonicalizeFilePath(resolvedModule.resolvedFileName);
      const specifier = moduleImport.specifier;
      edges.set(`${from}\0${to}\0${specifier}`, { from, to, specifier });
    }
  }

  return Array.from(edges.values()).sort((left, right) => {
    const leftKey = `${left.from}\0${left.to}\0${left.specifier}`;
    const rightKey = `${right.from}\0${right.to}\0${right.specifier}`;
    return leftKey.localeCompare(rightKey);
  });
};

const discoverProgramInputsOrDiagnostic = (
  filePaths: readonly string[],
  options: CompilerOptions,
  surfaceCapabilities: Parameters<typeof discoverProgramInputs>[2]
): Result<ProgramInputDiscovery, DiagnosticsCollector> => {
  try {
    return ok(discoverProgramInputs(filePaths, options, surfaceCapabilities));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return error(
      addDiagnostic(
        createDiagnosticsCollector(),
        createDiagnostic(
          "TSN1004",
          "error",
          `Program input discovery failed: ${message}`
        )
      )
    );
  }
};

export const createProgram = <Target extends BackendTargetId = BackendTargetId>(
  filePaths: readonly string[],
  options: CompilerOptions<Target>
): Result<TsonicProgram<Target>, DiagnosticsCollector> => {
  const surface = options.surface ?? "core";
  const initialSurfaceResolveOptions = { projectRoot: options.projectRoot };
  let surfaceCapabilities = resolveSurfaceCapabilities(
    surface,
    initialSurfaceResolveOptions
  );
  let discoveryResult = discoverProgramInputsOrDiagnostic(
    filePaths,
    options,
    surfaceCapabilities
  );
  if (!discoveryResult.ok) return discoveryResult;
  let discovery = discoveryResult.value;
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
    discoveryResult = discoverProgramInputsOrDiagnostic(
      filePaths,
      options,
      surfaceCapabilities
    );
    if (!discoveryResult.ok) return discoveryResult;
    discovery = discoveryResult.value;
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
      moduleResolutionPaths: discovery.moduleResolutionPaths,
      sourceDiagnosticRoots: discovery.sourceDiagnosticRoots,
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

  const runtimeSourceFilesResult = collectTstsRuntimeSourceFiles(
    sourceProgram,
    discovery.runtimeSeedFiles
  );
  if (!runtimeSourceFilesResult.ok) return runtimeSourceFilesResult;
  const sourceFiles = runtimeSourceFilesResult.value;

  const workspaceGraphEdges = collectTstsWorkspaceGraphEdges(sourceProgram);

  if (sourceFiles.length === 0) {
    return error(
      addDiagnostic(
        createDiagnosticsCollector(),
        createDiagnostic(
          "TSN1008",
          "fatal",
          "TSTS source program did not contain a runtime source file."
        )
      )
    );
  }

  return ok({
    sourceProgram,
    options,
    surfaceCapabilities,
    workspaceGraph: buildWorkspaceGraphSnapshot({
      projectRoot: options.projectRoot,
      sourceRoot: options.sourceRoot,
      sourceFiles: sourceProgram.sourceFiles.map((sourceFile) =>
        sourceFile.FileName()
      ),
      ambientFiles: discovery.ambientSupportFiles,
      typeRoots: discovery.typeRoots,
      edges: workspaceGraphEdges,
      options,
      surfaceCapabilities,
    }),
    authoritativeTsonicPackageRoots:
      discovery.authoritativeTsonicPackageRoots,
    declarationModuleAliases: discovery.declarationModuleAliases,
    runtimeSourceFiles: sourceFiles,
  });
};
