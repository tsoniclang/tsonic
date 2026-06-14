import type {
  CompilerExtension,
  ExtensionDiagnostic,
  ExtensionHost,
  ExtensionModuleGraph,
  ExtensionTypeChecker,
  TstsDiagnostic,
  TstsSourceFile,
} from "@tsonic/tsts";
import {
  createCompilerSourceProgram,
  createExtensionHost,
  createExtensionModuleGraph,
} from "@tsonic/tsts";
import {
  createTsonicNumericPrimitiveExtension,
  createTsonicSourceSemanticsExtension,
} from "../tsonic-extension/index.js";

export type TstsSourceProgram = {
  readonly engine: "tsts";
  readonly sourceFiles: readonly TstsSourceFile[];
  readonly moduleGraph: ExtensionModuleGraph;
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
  readonly runExtensionChecks?: boolean;
  readonly sourceDiagnosticFileNames?: readonly string[];
};

const defaultExtensions = (
  options: Pick<CreateTstsSourceProgramOptions, "sourceDiagnosticFileNames"> = {}
): readonly CompilerExtension[] => [
  createTsonicNumericPrimitiveExtension(),
  createTsonicSourceSemanticsExtension({
    sourceDiagnosticFileNames: options.sourceDiagnosticFileNames,
  }),
];

export const createTstsSourceProgram = (
  filePaths: readonly string[],
  options: CreateTstsSourceProgramOptions = {}
): TstsSourceProgram => {
  const extensions = options.extensions ?? defaultExtensions(options);
  const compiledSource = createCompilerSourceProgram(filePaths, {
    projectRoot: options.projectRoot,
    extensions,
    runSemanticChecks: options.runSemanticChecks === true,
    runExtensionChecks: options.runExtensionChecks === true,
  });

  return {
    engine: "tsts",
    sourceFiles: compiledSource.sourceFiles,
    moduleGraph: compiledSource.moduleGraph,
    extensionHost: compiledSource.extensionHost,
    diagnostics: compiledSource.extensionDiagnostics,
    compilerDiagnostics: compiledSource.diagnostics,
    withSourceSemantics: compiledSource.withSemanticView,
  };
};

export const createEmptyTstsSourceProgramForTests = (): TstsSourceProgram => {
  const extensionHost = createExtensionHost(defaultExtensions());
  extensionHost.configure();
  return {
    engine: "tsts",
    sourceFiles: [],
    moduleGraph: createExtensionModuleGraph(undefined, []),
    extensionHost,
    diagnostics: extensionHost.diagnostics.all(),
    compilerDiagnostics: [],
    withSourceSemantics: () => {
      throw new Error("Empty TSTS source program has no source semantics.");
    },
  };
};
