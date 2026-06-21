import type { GoPtr, GoSlice } from "../go/compat.js";
import { Background } from "../go/context.js";
import type { Context } from "../go/context.js";
import type { SourceFile } from "../internal/ast/ast.js";
import type { Diagnostic } from "../internal/ast/diagnostic.js";
import type { CompilerOptions } from "../internal/core/compileroptions.js";
import type { CompilerHost } from "../internal/compiler/host.js";
import {
  NewProgram,
  Program_BindSourceFiles,
  Program_GetBindDiagnostics,
  Program_GetConfigFileParsingDiagnostics,
  Program_GetDeclarationDiagnostics,
  Program_GetGlobalDiagnostics,
  Program_GetProgramDiagnostics,
  Program_GetSemanticDiagnostics,
  Program_GetSourceFile,
  Program_GetSourceFiles,
  Program_GetSuggestionDiagnostics,
  Program_GetSyntacticDiagnostics,
  Program_getSourceFilesToEmit,
} from "../internal/compiler/program.js";
import type { Program, ProgramOptions } from "../internal/compiler/program.js";
import { GetParsedCommandLineOfConfigFile } from "../internal/tsoptions/tsconfigparsing.js";
import type { ParseConfigHost } from "../internal/tsoptions/tsconfigparsing.js";
import type { ParsedCommandLine } from "../internal/tsoptions/parsedcommandline.js";
import type { ExtensionHost, ExtensionHostOptions } from "../extensions/host.js";
import { attachExtensionHost, finalizeExtensionSemantics, getExtensionHost } from "../extensions/index.js";
import { createCompilerHost, createInMemoryFileSystem } from "./embedding-host.js";
import type { CompilerHostOptions } from "./embedding-host.js";
import { createTypeCheckerQueries } from "./type-checker.js";
import type { TypeCheckerQueries } from "./type-checker.js";
import { createTypeShapeQueries } from "./type-shape.js";
import type { TypeShapeQueries } from "./type-shape.js";
import { createAstReader } from "./ast-reader.js";
import type { AstReader } from "./ast-reader.js";

export type CompilerDiagnosticKind =
  | "config"
  | "program"
  | "global"
  | "syntactic"
  | "bind"
  | "semantic"
  | "suggestion"
  | "declaration"
  | "all";

export interface CompilerSessionOptions {
  readonly programOptions: ProgramOptions;
  readonly extensionHostOptions?: ExtensionHostOptions;
  readonly context?: Context;
}

export interface InMemoryCompilerSessionOptions {
  readonly currentDirectory: string;
  readonly files: ReadonlyMap<string, string> | Record<string, string>;
  readonly rootFiles?: readonly string[];
  readonly configFileName?: string;
  readonly compilerOptions?: Record<string, unknown>;
  readonly extensionHostOptions?: ExtensionHostOptions;
  readonly useCaseSensitiveFileNames?: boolean;
  readonly context?: Context;
}

export interface CompilerSession {
  readonly program: GoPtr<Program>;
  readonly host: CompilerHost;
  readonly config: GoPtr<ParsedCommandLine>;
  readonly extensionHost: ExtensionHost | undefined;
  readonly ast: AstReader;
  readonly checker: TypeCheckerQueries;
  readonly types: TypeShapeQueries;
  readonly getSourceFiles: () => readonly GoPtr<SourceFile>[];
  readonly getSourceFile: (fileName: string) => GoPtr<SourceFile>;
  readonly getSourceFilesToEmit: (targetSourceFile?: GoPtr<SourceFile>, forceDtsEmit?: boolean) => readonly GoPtr<SourceFile>[];
  readonly ensureBound: () => void;
  readonly ensureChecked: (sourceFile?: GoPtr<SourceFile>) => readonly GoPtr<Diagnostic>[];
  readonly getDiagnostics: (kind?: CompilerDiagnosticKind, sourceFile?: GoPtr<SourceFile>) => readonly GoPtr<Diagnostic>[];
  readonly finalizeExtensions: () => ExtensionHost | undefined;
  readonly isFinalized: () => boolean;
}

export function createCompilerSession(options: CompilerSessionOptions): CompilerSession {
  if (options.extensionHostOptions !== undefined) {
    attachExtensionHost(options.programOptions, options.extensionHostOptions);
  }
  const program = NewProgram(options.programOptions);
  const extensionHost = getExtensionHost(program!);
  const context = options.context ?? Background();
  return createCompilerSessionFromProgram(program, options.programOptions.Host, options.programOptions.Config, extensionHost, context);
}

export function createCompilerSessionFromProgram(program: GoPtr<Program>, host: CompilerHost, config: GoPtr<ParsedCommandLine>, extensionHost = getExtensionHost(program!), context: Context = Background()): CompilerSession {
  const ast = createAstReader();
  const checker = createTypeCheckerQueries(program, { context });
  const types = createTypeShapeQueries(program, { context });
  extensionHost?.setCompilerQueries({
    ast,
    checker,
    types,
    getSourceFiles: () => (Program_GetSourceFiles(program) ?? []).filter((sourceFile): sourceFile is SourceFile => sourceFile !== undefined),
  });
  return {
    program,
    host,
    config,
    extensionHost,
    ast,
    checker,
    types,
    getSourceFiles: () => Program_GetSourceFiles(program) ?? [],
    getSourceFile: (fileName) => Program_GetSourceFile(program, fileName),
    getSourceFilesToEmit: (targetSourceFile, forceDtsEmit = false) => Program_getSourceFilesToEmit(program, targetSourceFile, forceDtsEmit) ?? [],
    ensureBound: () => Program_BindSourceFiles(program),
    ensureChecked: (sourceFile) => Program_GetSemanticDiagnostics(program, context, sourceFile),
    getDiagnostics: (kind = "all", sourceFile) => getDiagnostics(program, context, kind, sourceFile),
    finalizeExtensions: () => {
      ensureCheckedOperationFacts(program, context);
      return finalizeExtensionSemantics(program!);
    },
    isFinalized: () => getExtensionHost(program!)?.finalized === true,
  };
}

export function createCompilerSessionFromFiles(options: InMemoryCompilerSessionOptions): CompilerSession {
  const configFileName = options.configFileName ?? `${options.currentDirectory}/tsconfig.json`;
  const files = options.files instanceof Map ? new Map(options.files) : new Map(Object.entries(options.files));
  if (!files.has(configFileName)) {
    files.set(configFileName, JSON.stringify({
      compilerOptions: options.compilerOptions ?? {},
      files: options.rootFiles ?? inferRootFiles(options.currentDirectory, files),
    }));
  }
  const fileSystem = createInMemoryFileSystem({
    files,
    ...(options.useCaseSensitiveFileNames !== undefined ? { useCaseSensitiveFileNames: options.useCaseSensitiveFileNames } : {}),
  });
  const host = createCompilerHost({
    currentDirectory: options.currentDirectory,
    fileSystem,
  } satisfies CompilerHostOptions);
  const defaultOptions = {} as CompilerOptions;
  const [config, configErrors] = GetParsedCommandLineOfConfigFile(configFileName, defaultOptions, undefined, host as ParseConfigHost, undefined);
  if ((configErrors ?? []).length !== 0) {
    const programOptions = { Config: config, Host: host } satisfies ProgramOptions;
    return createCompilerSession({
      programOptions,
      ...(options.extensionHostOptions !== undefined ? { extensionHostOptions: options.extensionHostOptions } : {}),
      ...(options.context !== undefined ? { context: options.context } : {}),
    });
  }
  return createCompilerSession({
    programOptions: {
      Config: config,
      Host: host,
    },
    ...(options.extensionHostOptions !== undefined ? { extensionHostOptions: options.extensionHostOptions } : {}),
    ...(options.context !== undefined ? { context: options.context } : {}),
  });
}

function getDiagnostics(program: GoPtr<Program>, context: Context, kind: CompilerDiagnosticKind, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>> {
  switch (kind) {
    case "config":
      return Program_GetConfigFileParsingDiagnostics(program);
    case "program":
      return Program_GetProgramDiagnostics(program);
    case "global":
      return Program_GetGlobalDiagnostics(program, context);
    case "syntactic":
      return Program_GetSyntacticDiagnostics(program, context, sourceFile);
    case "bind":
      return Program_GetBindDiagnostics(program, context, sourceFile);
    case "semantic":
      return Program_GetSemanticDiagnostics(program, context, sourceFile);
    case "suggestion":
      return Program_GetSuggestionDiagnostics(program, context, sourceFile);
    case "declaration":
      return Program_GetDeclarationDiagnostics(program, context, sourceFile);
    case "all":
      return [
        ...Program_GetConfigFileParsingDiagnostics(program),
        ...Program_GetProgramDiagnostics(program),
        ...Program_GetGlobalDiagnostics(program, context),
        ...Program_GetSyntacticDiagnostics(program, context, sourceFile),
        ...Program_GetBindDiagnostics(program, context, sourceFile),
        ...Program_GetSemanticDiagnostics(program, context, sourceFile),
      ];
  }
}

function ensureCheckedOperationFacts(program: GoPtr<Program>, context: Context): void {
  for (const sourceFile of Program_GetSourceFiles(program) ?? []) {
    if (sourceFile === undefined || sourceFile.IsDeclarationFile) {
      continue;
    }
    Program_GetSemanticDiagnostics(program, context, sourceFile);
  }
}

function inferRootFiles(currentDirectory: string, files: ReadonlyMap<string, string>): readonly string[] {
  const rootFiles: string[] = [];
  const prefix = currentDirectory.endsWith("/") ? currentDirectory : `${currentDirectory}/`;
  for (const fileName of files.keys()) {
    if (fileName === `${currentDirectory}/tsconfig.json`) {
      continue;
    }
    if (fileName.startsWith(prefix) && /\.(?:ts|tsx|js|jsx|mts|cts)$/.test(fileName)) {
      rootFiles.push(fileName.slice(prefix.length));
    }
  }
  return rootFiles.sort();
}
