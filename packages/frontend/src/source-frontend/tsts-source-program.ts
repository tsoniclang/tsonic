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
  withTypeChecker<T>(
    sourceFile: TstsSourceFile,
    run: (checker: ExtensionTypeChecker) => T
  ): T;
};

export type CreateTstsSourceProgramOptions = {
  readonly projectRoot: string;
  readonly moduleResolutionPaths: Readonly<Record<string, readonly string[]>>;
  readonly sourceDiagnosticFileNames: readonly string[];
};

const defaultExtensions = (
  options: Pick<CreateTstsSourceProgramOptions, "sourceDiagnosticFileNames">
): readonly CompilerExtension[] => [
  createTsonicNumericPrimitiveExtension(),
  createTsonicSourceSemanticsExtension({
    sourceDiagnosticFileNames: options.sourceDiagnosticFileNames,
  }),
];

export const createTstsSourceProgram = (
  filePaths: readonly string[],
  options: CreateTstsSourceProgramOptions
): TstsSourceProgram => {
  const compiledSource = createCompilerSourceProgram(filePaths, {
    projectRoot: options.projectRoot,
    moduleResolutionPaths: options.moduleResolutionPaths,
    moduleResolutionBaseUrl: options.projectRoot,
    extensions: defaultExtensions(options),
    runSemanticChecks: true,
    runExtensionChecks: true,
  });

  return {
    engine: "tsts",
    sourceFiles: compiledSource.sourceFiles,
    moduleGraph: compiledSource.moduleGraph,
    extensionHost: compiledSource.extensionHost,
    diagnostics: compiledSource.extensionDiagnostics,
    compilerDiagnostics: compiledSource.diagnostics,
    withTypeChecker: compiledSource.withTypeChecker,
  };
};

export const createEmptyTstsSourceProgramForTests = (): TstsSourceProgram => {
  const extensionHost = createExtensionHost(
    defaultExtensions({ sourceDiagnosticFileNames: [] })
  );
  extensionHost.configure();
  return {
    engine: "tsts",
    sourceFiles: [],
    moduleGraph: createExtensionModuleGraph(undefined, []),
    extensionHost,
    diagnostics: extensionHost.diagnostics.all(),
    compilerDiagnostics: [],
    withTypeChecker: () => {
      throw new Error("Empty TSTS source program has no type checker.");
    },
  };
};
