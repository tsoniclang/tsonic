import {
  createCompilerSession,
  createExtensionConsumerQueries,
} from "@tsonic/tsts";
import type {
  AstReader,
  CompilerSession,
  ExtensionConsumerQueries,
  ExtensionHost,
  Program,
  ProgramOptions,
  SourceFile,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import type {
  TargetCompileInput,
  TargetCompileResult,
  TargetCompilationPaths,
  TargetPack,
  TargetRuntimeReference,
  TargetSelection,
  TargetSurfaceImplementation,
  TsonicProjectConfig,
} from "@tsonic/target-api";
import { forceDiagnostics } from "./diagnostics.js";
import { createTargetSemanticQueries } from "./semantic/queries.js";
import { createTargetCompilerExtensions } from "./target/extensions.js";
export {
  collectTstsDiagnostics,
} from "./diagnostics.js";
export {
  collectTargetRuntimeContributions,
} from "./target/runtime-contributions.js";
export type {
  CollectedTargetRuntimeContributions,
  CollectTargetRuntimeContributionsOptions,
} from "./target/runtime-contributions.js";
export {
  createTargetCompilerExtensions,
  getSelectedSurfaceImplementations,
} from "./target/extensions.js";
export type {
  CreateTargetCompilerExtensionsOptions,
  TargetCompilerExtensionComposition,
} from "./target/extensions.js";

export interface TsonicSemanticSession {
  readonly compiler: CompilerSession;
  readonly program: Program;
  readonly ast: AstReader;
  readonly types: TypeShapeQueries;
  readonly sourceFiles: readonly SourceFile[];
  readonly extensionHost: ExtensionHost;
  readonly checker: TypeCheckerQueries;
  readonly facts: ExtensionConsumerQueries;
}

export interface CreateTsonicSemanticSessionOptions {
  readonly programOptions: ProgramOptions;
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedSurfaces?: readonly TargetSurfaceImplementation[];
}

export function createTsonicSemanticSession(options: CreateTsonicSemanticSessionOptions): TsonicSemanticSession {
  const { extensions } = createTargetCompilerExtensions(options);
  const compiler = createCompilerSession({
    programOptions: options.programOptions,
    extensionHostOptions: {
      activeTarget: options.target.id,
      extensions,
    },
  });
  if (compiler.program === undefined) {
    throw new Error("TSTS createCompilerSession returned no program.");
  }
  compiler.ensureBound();
  forceDiagnostics(compiler);
  const extensionHost = compiler.finalizeExtensions();
  if (extensionHost === undefined) {
    throw new Error("TSTS extension finalization returned no extension host.");
  }
  const sourceFiles = compiler.getSourceFiles().filter((sourceFile): sourceFile is SourceFile => sourceFile !== undefined);
  return {
    compiler,
    program: compiler.program,
    ast: compiler.ast,
    types: compiler.types,
    sourceFiles,
    extensionHost,
    checker: compiler.checker,
    facts: createExtensionConsumerQueries(extensionHost, "tsonic-host"),
  };
}

export function compileTargetFromSemanticSession(
  session: TsonicSemanticSession,
  project: TsonicProjectConfig,
  target: TargetSelection,
  targetPack: TargetPack,
  paths: TargetCompilationPaths,
  runtimeReferences: readonly TargetRuntimeReference[] = [],
): TargetCompileResult {
  const input: TargetCompileInput = {
    program: session.program,
    ast: session.ast,
    types: session.types,
    sourceFiles: session.sourceFiles,
    facts: session.facts,
    semantics: createTargetSemanticQueries(session.ast, session.checker, session.types, session.facts, session.sourceFiles),
    project,
    target,
    runtimeReferences,
    paths,
  };
  return targetPack.createBackend({ project, target }).compile(input);
}
