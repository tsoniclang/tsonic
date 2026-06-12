import type {
  CompilerSourceProgram,
  CompilerExtension,
  ExtensionDiagnostic,
  ExtensionHost,
  ExtensionTypeChecker,
  TstsDiagnostic,
  TstsSourceFile,
} from "@tsonic/tsts";
import { createCompilerSourceProgram, createExtensionHost } from "@tsonic/tsts";
import {
  createTsonicNumericPrimitiveExtension,
  createTsonicSourceSemanticsExtension,
} from "../tsonic-extension/index.js";

export type TstsSourceProgram = {
  readonly engine: "tsts";
  readonly compilerProgram?: CompilerSourceProgram;
  readonly sourceFiles: readonly TstsSourceFile[];
  readonly extensionHost: ExtensionHost;
  readonly diagnostics: readonly ExtensionDiagnostic[];
  readonly compilerDiagnostics: readonly TstsDiagnostic[];
  withSourceSemantics<T>(
    sourceFile: TstsSourceFile,
    run: (semantics: ExtensionTypeChecker) => T
  ): T;
};

export type CreateTstsSourceProgramOptions = {
  readonly extensions?: readonly CompilerExtension[];
  readonly projectRoot?: string;
  readonly runSemanticChecks?: boolean;
};

const defaultExtensions = (): readonly CompilerExtension[] => [
  createTsonicNumericPrimitiveExtension(),
  createTsonicSourceSemanticsExtension(),
];

export const createTstsSourceProgram = (
  filePaths: readonly string[],
  options: CreateTstsSourceProgramOptions = {}
): TstsSourceProgram => {
  const extensions = options.extensions ?? defaultExtensions();
  const compilerProgram = createCompilerSourceProgram(filePaths, {
    projectRoot: options.projectRoot,
    extensions,
    runSemanticChecks: options.runSemanticChecks === true,
  });

  return {
    engine: "tsts",
    compilerProgram,
    sourceFiles: compilerProgram.sourceFiles,
    extensionHost: compilerProgram.extensionHost,
    diagnostics: compilerProgram.extensionDiagnostics,
    compilerDiagnostics: compilerProgram.diagnostics,
    withSourceSemantics: compilerProgram.withSemanticView,
  };
};

export const createEmptyTstsSourceProgramForTests = (): TstsSourceProgram => {
  const extensionHost = createExtensionHost(defaultExtensions());
  extensionHost.configure();
  return {
    engine: "tsts",
    sourceFiles: [],
    extensionHost,
    diagnostics: extensionHost.diagnostics.all(),
    compilerDiagnostics: [],
    withSourceSemantics: () => {
      throw new Error("Empty TSTS source program has no source semantics.");
    },
  };
};
