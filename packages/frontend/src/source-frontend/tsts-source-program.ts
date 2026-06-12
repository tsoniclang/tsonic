import type {
  CompilerSourceProgram,
  CompilerExtension,
  ExtensionDiagnostic,
  ExtensionHost,
  TstsDiagnostic,
  TstsSourceFile,
} from "@tsonic/tsts";
import { createCompilerSourceProgram, createExtensionHost } from "@tsonic/tsts";
import { createTsonicNumericPrimitiveExtension } from "../tsonic-extension/index.js";

export type TstsSourceProgram = {
  readonly engine: "tsts";
  readonly compilerProgram?: CompilerSourceProgram;
  readonly sourceFiles: readonly TstsSourceFile[];
  readonly extensionHost: ExtensionHost;
  readonly diagnostics: readonly ExtensionDiagnostic[];
  readonly compilerDiagnostics: readonly TstsDiagnostic[];
};

export type CreateTstsSourceProgramOptions = {
  readonly extensions?: readonly CompilerExtension[];
  readonly projectRoot?: string;
  readonly runSemanticChecks?: boolean;
};

const defaultExtensions = (): readonly CompilerExtension[] => [
  createTsonicNumericPrimitiveExtension(),
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
  };
};
