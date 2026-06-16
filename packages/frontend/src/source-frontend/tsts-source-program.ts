import type {
  CompilerExtension,
  ExtensionDiagnostic,
  ExtensionModuleGraph,
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
import type { SourceSemanticFacts } from "./source-facts.js";

export type TstsSourceProgram = {
  readonly engine: "tsts";
  readonly sourceFiles: readonly TstsSourceFile[];
  readonly moduleGraph: ExtensionModuleGraph;
  readonly facts: SourceSemanticFacts;
  readonly diagnostics: readonly ExtensionDiagnostic[];
  readonly compilerDiagnostics: readonly TstsDiagnostic[];
};

export type CreateTstsSourceProgramOptions = {
  readonly projectRoot: string;
  readonly moduleResolutionPaths: Readonly<Record<string, readonly string[]>>;
  readonly sourceDiagnosticRoots: readonly string[];
};

const defaultExtensions = (
  options: Pick<CreateTstsSourceProgramOptions, "sourceDiagnosticRoots">
): readonly CompilerExtension[] => [
  createTsonicNumericPrimitiveExtension(),
  createTsonicSourceSemanticsExtension({
    sourceDiagnosticRoots: options.sourceDiagnosticRoots,
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

const sourceDiagnosticRoots = (roots: readonly string[]): readonly string[] =>
  roots.map((root) => canonicalizeFilePath(root));

const isFileUnderRoot = (fileName: string, root: string): boolean => {
  const relative = path.relative(root, canonicalizeFilePath(fileName));
  return (
    relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
};

const isScopedCompilerDiagnostic = (
  diagnosticRoots: readonly string[],
  diagnostic: TstsDiagnostic
): boolean => {
  const fileName = diagnostic.file?.FileName();
  return (
    fileName === undefined ||
    diagnosticRoots.some((root) => isFileUnderRoot(fileName, root))
  );
};

export const createTstsSourceProgram = (
  filePaths: readonly string[],
  options: CreateTstsSourceProgramOptions
): TstsSourceProgram => {
  const diagnosticRoots = sourceDiagnosticRoots(options.sourceDiagnosticRoots);
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
    facts: compiledSource.extensionHost.facts,
    diagnostics: compiledSource.extensionDiagnostics,
    compilerDiagnostics: compiledSource.diagnostics.filter((diagnostic) =>
      isScopedCompilerDiagnostic(diagnosticRoots, diagnostic)
    ),
  };
};

export const createEmptyTstsSourceProgramForTests = (): TstsSourceProgram => {
  const extensionHost = createExtensionHost(
    defaultExtensions({ sourceDiagnosticRoots: [] })
  );
  extensionHost.configure();
  return {
    engine: "tsts",
    sourceFiles: [],
    moduleGraph: createExtensionModuleGraph(undefined, []),
    facts: extensionHost.facts,
    diagnostics: extensionHost.diagnostics.all(),
    compilerDiagnostics: [],
  };
};
