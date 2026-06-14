/**
 * Import validation.
 *
 * Import syntax and module resolution are TSTS-owned. Tsonic validates only
 * product policy on top of the TSTS module graph.
 */

import type {
  ExtensionModuleImport,
  ExtensionSourceModule,
  TstsSourceFile,
} from "@tsonic/tsts";
import { createExtensionModuleGraph, parseTstsSourceFile } from "@tsonic/tsts";
import fs from "node:fs";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";
import { resolveImport } from "../resolver.js";
import { getNodeLocation } from "./helpers.js";

const hasExplicitDefaultExport = (
  target: ExtensionSourceModule | undefined
): boolean =>
  target?.exports.some(
    (binding) =>
      binding.kind === "default" ||
      binding.kind === "export-equals" ||
      binding.exportedName === "default"
  ) === true;

const findResolvedSourceModule = (
  program: TsonicProgram,
  resolvedPath: string
): ExtensionSourceModule | undefined =>
  program.sourceProgram.moduleGraph.modules.find(
    (module) => module.fileName === resolvedPath
  );

const loadResolvedSourceModule = (
  program: TsonicProgram,
  resolvedPath: string
): ExtensionSourceModule | undefined => {
  const existing = findResolvedSourceModule(program, resolvedPath);
  if (existing) {
    return existing;
  }
  if (!fs.existsSync(resolvedPath)) {
    return undefined;
  }

  const parsed = parseTstsSourceFile(fs.readFileSync(resolvedPath, "utf-8"), {
    fileName: resolvedPath,
  });
  return createExtensionModuleGraph(undefined, [parsed]).getSourceFileModule(parsed);
};

const addDefaultImportDiagnostic = (
  collector: DiagnosticsCollector,
  sourceFile: TstsSourceFile,
  importModule: ExtensionModuleImport
): DiagnosticsCollector =>
  addDiagnostic(
    collector,
    createDiagnostic(
      "TSN2002",
      "error",
      `Default import requires an explicit default export: "${importModule.specifier}"`,
      getNodeLocation(sourceFile, importModule.importNode ?? sourceFile),
      "Use a namespace import, a named import, or add `export default` to the source module"
    )
  );

/**
 * Validate all imports in a source file.
 */
export const validateImports = (
  sourceFile: TstsSourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  let currentCollector = collector;
  const module = program.sourceProgram.moduleGraph.getSourceFileModule(sourceFile);
  if (!module) {
    return currentCollector;
  }

  for (const importModule of module.imports) {
    currentCollector = validateImportModule(
      importModule,
      sourceFile,
      program,
      currentCollector
    );
  }

  return currentCollector;
};

export const validateImportModule = (
  importModule: ExtensionModuleImport,
  sourceFile: TstsSourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const importNode = importModule.importNode ?? sourceFile;
  const result = resolveImport(
    importModule.specifier,
    sourceFile.FileName(),
    program.options.sourceRoot,
    {
      bindings: program.bindings,
      externalResolver: program.externalResolver,
      projectRoot: program.options.projectRoot,
      surface: program.options.surface,
      backendTargetId: program.options.backendTargetId,
      authoritativeTsonicPackageRoots: program.authoritativeTsonicPackageRoots,
      declarationModuleAliases: program.declarationModuleAliases,
    }
  );

  if (!result.ok) {
    return addDiagnostic(collector, {
      ...result.error,
      location: getNodeLocation(sourceFile, importNode),
    });
  }

  const hasDefaultBinding = importModule.bindings.some(
    (binding) =>
      binding.kind === "default" || binding.importedName === "default"
  );
  if (!hasDefaultBinding) {
    return collector;
  }

  if (result.value.resolutionKind === "externalSurface") {
    return addDefaultImportDiagnostic(collector, sourceFile, importModule);
  }

  const resolvedFileName =
    importModule.resolvedModule?.resolvedFileName || result.value.resolvedPath;
  const targetModule =
    resolvedFileName === ""
      ? undefined
      : loadResolvedSourceModule(program, resolvedFileName);

  if (targetModule !== undefined && !hasExplicitDefaultExport(targetModule)) {
    return addDefaultImportDiagnostic(collector, sourceFile, importModule);
  }

  return collector;
};
