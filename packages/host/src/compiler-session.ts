import {
  attachExtensionHost,
  Background,
  createExtensionConsumerQueries,
  createTypeCheckerQueries,
  finalizeExtensionSemantics,
  formatDiagnostics,
  getExtensionHost,
  NewProgram,
  Program_BindSourceFiles,
  Program_GetConfigFileParsingDiagnostics,
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
  TargetCompilationPaths,
  TargetDiagnostic,
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
  paths: TargetCompilationPaths,
): TargetCompileResult {
  const input: TargetCompileInput = {
    program: session.program,
    sourceFiles: session.sourceFiles,
    checker: session.checker,
    facts: session.facts,
    project,
    target,
    paths,
  };
  return targetPack.createBackend({ project, target }).compile(input);
}

export function collectTstsDiagnostics(program: Program, sourceFiles: readonly SourceFile[], currentDirectory: string): readonly TargetDiagnostic[] {
  const diagnostics = [
    ...(Program_GetConfigFileParsingDiagnostics(program) ?? []),
    ...(Program_GetProgramDiagnostics(program) ?? []),
  ].filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined);
  const context = Background();
  for (const sourceFile of sourceFiles) {
    diagnostics.push(...(Program_GetSyntacticDiagnostics(program, context, sourceFile) ?? [])
      .filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined));
    diagnostics.push(...(Program_GetSemanticDiagnostics(program, context, sourceFile) ?? [])
      .filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined));
  }
  const message = formatDiagnostics(diagnostics, currentDirectory);
  if (message.length === 0) {
    return [];
  }
  return [{
    code: "TSTS_DIAGNOSTIC",
    category: "error",
    message,
    source: "tsts",
  }];
}

function forceDiagnostics(program: Program, sourceFiles: readonly SourceFile[]): void {
  Program_GetProgramDiagnostics(program);
  const context = Background();
  for (const sourceFile of sourceFiles) {
    Program_GetSyntacticDiagnostics(program, context, sourceFile);
    Program_GetSemanticDiagnostics(program, context, sourceFile);
  }
}
