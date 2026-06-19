import {
  attachExtensionHost,
  Background,
  createExtensionConsumerQueries,
  createTypeCheckerQueries,
  finalizeExtensionSemantics,
  getExtensionHost,
  NewProgram,
  Program_BindSourceFiles,
  Program_GetProgramDiagnostics,
  Program_GetSemanticDiagnostics,
  Program_GetSourceFiles,
  Program_GetSyntacticDiagnostics,
} from "@tsonic/tsts";
import type {
  ExtensionConsumerQueries,
  ExtensionHost,
  Program,
  ProgramOptions,
  SourceFile,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import type {
  TargetCompileInput,
  TargetCompileResult,
  TargetPack,
  TargetSelection,
  TsonicProjectConfig,
} from "@tsonic/target-api";

export interface TsonicSemanticSession {
  readonly program: Program;
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
}

export function createTsonicSemanticSession(options: CreateTsonicSemanticSessionOptions): TsonicSemanticSession {
  const extensions = options.targetPack.createExtensions({
    project: options.project,
    target: options.target,
  });
  const extended = attachExtensionHost(options.programOptions, {
    activeTarget: options.target.id,
    extensions,
  });
  const program = NewProgram(options.programOptions);
  if (program === undefined) {
    throw new Error("TSTS NewProgram returned undefined.");
  }
  const sourceFiles = Program_GetSourceFiles(program).filter((sourceFile): sourceFile is SourceFile => sourceFile !== undefined);
  Program_BindSourceFiles(program);
  forceDiagnostics(program, sourceFiles);
  const extensionHost = finalizeExtensionSemantics(program) ?? getExtensionHost(program) ?? extended.extensionHost;
  return {
    program,
    sourceFiles,
    extensionHost,
    checker: createTypeCheckerQueries(program),
    facts: createExtensionConsumerQueries(extensionHost, "tsonic-host"),
  };
}

export function compileTargetFromSemanticSession(
  session: TsonicSemanticSession,
  project: TsonicProjectConfig,
  target: TargetSelection,
  targetPack: TargetPack,
): TargetCompileResult {
  const input: TargetCompileInput = {
    program: session.program,
    sourceFiles: session.sourceFiles,
    checker: session.checker,
    facts: session.facts,
    project,
    target,
  };
  return targetPack.createBackend({ project, target }).compile(input);
}

function forceDiagnostics(program: Program, sourceFiles: readonly SourceFile[]): void {
  Program_GetProgramDiagnostics(program);
  const context = Background();
  for (const sourceFile of sourceFiles) {
    Program_GetSyntacticDiagnostics(program, context, sourceFile);
    Program_GetSemanticDiagnostics(program, context, sourceFile);
  }
}
