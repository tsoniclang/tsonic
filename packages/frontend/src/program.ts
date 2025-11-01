/**
 * TypeScript program creation and management
 */

import * as ts from "typescript";
import * as path from "node:path";
import { Result, ok, error } from "./types/result.js";
import {
  Diagnostic,
  DiagnosticsCollector,
  createDiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "./types/diagnostic.js";

export type CompilerOptions = {
  readonly sourceRoot: string;
  readonly rootNamespace: string;
  readonly strict?: boolean;
};

export type TsonicProgram = {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly options: CompilerOptions;
  readonly sourceFiles: readonly ts.SourceFile[];
};

const defaultTsConfig: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ES2022,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  forceConsistentCasingInFileNames: true,
  allowJs: false,
  checkJs: false,
  noEmit: true,
  resolveJsonModule: false,
  isolatedModules: true,
  verbatimModuleSyntax: true,
};

export const createProgram = (
  filePaths: readonly string[],
  options: CompilerOptions
): Result<TsonicProgram, DiagnosticsCollector> => {
  const absolutePaths = filePaths.map((fp) => path.resolve(fp));

  const tsOptions: ts.CompilerOptions = {
    ...defaultTsConfig,
    strict: options.strict ?? true,
    rootDir: options.sourceRoot,
  };

  const host = ts.createCompilerHost(tsOptions);
  const program = ts.createProgram(absolutePaths, tsOptions, host);

  const diagnostics = collectTsDiagnostics(program);

  if (diagnostics.hasErrors) {
    return error(diagnostics);
  }

  const sourceFiles = program
    .getSourceFiles()
    .filter(
      (sf) => !sf.isDeclarationFile && absolutePaths.includes(sf.fileName)
    );

  return ok({
    program,
    checker: program.getTypeChecker(),
    options,
    sourceFiles,
  });
};

const collectTsDiagnostics = (program: ts.Program): DiagnosticsCollector => {
  const tsDiagnostics = [
    ...program.getConfigFileParsingDiagnostics(),
    ...program.getOptionsDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ];

  return tsDiagnostics.reduce((collector, tsDiag) => {
    const diagnostic = convertTsDiagnostic(tsDiag);
    return diagnostic ? addDiagnostic(collector, diagnostic) : collector;
  }, createDiagnosticsCollector());
};

const convertTsDiagnostic = (tsDiag: ts.Diagnostic): Diagnostic | null => {
  if (tsDiag.category === ts.DiagnosticCategory.Suggestion) {
    return null; // Ignore suggestions
  }

  const severity =
    tsDiag.category === ts.DiagnosticCategory.Error
      ? "error"
      : tsDiag.category === ts.DiagnosticCategory.Warning
        ? "warning"
        : "info";

  const message = ts.flattenDiagnosticMessageText(tsDiag.messageText, "\n");

  const location =
    tsDiag.file && tsDiag.start !== undefined
      ? getSourceLocation(tsDiag.file, tsDiag.start, tsDiag.length ?? 1)
      : undefined;

  return createDiagnostic(
    "TSN2001", // Generic TypeScript error
    severity,
    message,
    location
  );
};

const getSourceLocation = (
  file: ts.SourceFile,
  start: number,
  length: number
): {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly length: number;
} => {
  const { line, character } = file.getLineAndCharacterOfPosition(start);
  return {
    file: file.fileName,
    line: line + 1,
    column: character + 1,
    length,
  };
};

export const getSourceFile = (
  program: TsonicProgram,
  filePath: string
): ts.SourceFile | null => {
  const absolutePath = path.resolve(filePath);
  return program.program.getSourceFile(absolutePath) ?? null;
};
