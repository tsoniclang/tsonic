import { createCompilerSession } from "@tsonic/tsts";
import type {
  AstReader,
  CheckedSourceProgram,
  ProgramOptions,
  SourceFile,
} from "@tsonic/tsts";
import type {
  TargetCompileInput,
  TargetCompileResult,
  TargetCompilationPaths,
  TargetPack,
  TargetCapabilityImplementation,
  TargetProviderContext,
  TargetRuntimeReference,
  TargetSelection,
  TargetSurfaceImplementation,
  TsonicProjectConfig,
} from "@tsonic/target-api";
import {
  createTargetSourceCompilerComposition,
  getTargetRequiredProviderModules,
} from "./target/extensions.js";
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
  createTargetSourceCompilerComposition,
  getSelectedSurfaceImplementations,
  getSelectedTargetCapabilities,
  getTargetRequiredProviderModules,
} from "./target/extensions.js";
export type {
  CreateTargetSourceCompilerCompositionOptions,
  TargetSourceCompilerComposition,
} from "./target/extensions.js";

export interface TsonicSemanticSession {
  readonly source: CheckedSourceProgram;
  readonly targetContext: TargetProviderContext;
}

export interface CreateTsonicSemanticSessionOptions {
  readonly programOptions: ProgramOptions;
  readonly project: TsonicProjectConfig;
  readonly projectDirectory: string;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedCapabilities?: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces?: readonly TargetSurfaceImplementation[];
}

export function createTsonicSemanticSession(options: CreateTsonicSemanticSessionOptions): TsonicSemanticSession {
  const composition = createTargetSourceCompilerComposition(options);
  const targetContext = Object.freeze({
    project: options.project,
    projectDirectory: options.projectDirectory,
    target: options.target,
    targetPack: options.targetPack,
    selectedCapabilities: composition.selectedCapabilities,
    selectedSurfaces: composition.selectedSurfaces,
  });
  const compiler = createCompilerSession({
    programOptions: options.programOptions,
    extensionHostOptions: {
      extensions: composition.extensions,
      requiredProviderModules: getTargetRequiredProviderModules(
        options.targetPack,
        options.target,
        composition.selectedCapabilities,
      ),
    },
  });
  return {
    source: compiler.checkSource(),
    targetContext,
  };
}

export function collectProjectSourceFiles(source: {
  readonly ast: AstReader;
  readonly getSourceFiles: () => readonly (SourceFile | undefined)[];
}): readonly SourceFile[] {
  return source.getSourceFiles()
    .filter((sourceFile): sourceFile is SourceFile =>
      sourceFile !== undefined &&
      !sourceFile.IsDeclarationFile &&
      !source.ast.getFileName(sourceFile).startsWith("tsts-provider://"));
}

export function compileTargetFromSemanticSession(
  session: TsonicSemanticSession,
  paths: TargetCompilationPaths,
  runtimeReferences: readonly TargetRuntimeReference[] = [],
): TargetCompileResult {
  const {
    project,
    target,
    targetPack,
  } = session.targetContext;
  const input: TargetCompileInput = {
    source: session.source,
    project,
    target,
    runtimeReferences,
    paths,
  };
  return targetPack.createBackend(session.targetContext).compile(input);
}
