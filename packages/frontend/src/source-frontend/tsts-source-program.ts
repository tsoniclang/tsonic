import type {
  CompilerExtension,
  ExtensionDiagnostic,
  ExtensionHost,
  ExtensionModuleGraph,
  ExtensionTypeChecker,
  TstsDiagnostic,
  TstsSourceFile,
} from "@tsonic/tsts";
import * as fs from "node:fs";
import * as path from "node:path";
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

const canonicalizeFilePath = (filePath: string): string => {
  const resolvedPath = path.resolve(filePath);
  try {
    return fs.realpathSync(resolvedPath);
  } catch {
    return resolvedPath;
  }
};

const sourceDiagnosticFileSet = (
  fileNames: readonly string[]
): ReadonlySet<string> =>
  new Set(fileNames.map((fileName) => canonicalizeFilePath(fileName)));

const isScopedCompilerDiagnostic = (
  sourceDiagnosticFiles: ReadonlySet<string>,
  diagnostic: TstsDiagnostic
): boolean => {
  const fileName = diagnostic.file?.FileName();
  return (
    fileName === undefined ||
    sourceDiagnosticFiles.has(canonicalizeFilePath(fileName))
  );
};

export const createTstsSourceProgram = (
  filePaths: readonly string[],
  options: CreateTstsSourceProgramOptions
): TstsSourceProgram => {
  const sourceDiagnosticFiles = sourceDiagnosticFileSet(
    options.sourceDiagnosticFileNames
  );
  const compiledSource = createCompilerSourceProgram(filePaths, {
    projectRoot: options.projectRoot,
    compilerOptions: {
      allowImportingTsExtensions: true,
      skipLibCheck: true,
    },
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
    compilerDiagnostics: compiledSource.diagnostics.filter((diagnostic) =>
      isScopedCompilerDiagnostic(sourceDiagnosticFiles, diagnostic)
    ),
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
