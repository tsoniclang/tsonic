import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../go/compat.js";
import { Background } from "../go/context.js";
import type { Diagnostic } from "../internal/ast/diagnostic.js";
import type { SourceFile } from "../internal/ast/ast.js";
import { NewCompilerHost } from "../internal/compiler/host.js";
import {
  NewProgram,
  Program_BindSourceFiles,
  Program_GetConfigFileParsingDiagnostics,
  Program_GetProgramDiagnostics,
  Program_GetSemanticDiagnostics,
  Program_GetSourceFiles,
  Program_GetSyntacticDiagnostics,
  Program_GetTypeCheckerForFile,
} from "../internal/compiler/program.js";
import type { Program, ProgramOptions } from "../internal/compiler/program.js";
import { ParseCommandLine } from "../internal/tsoptions/commandlineparser.js";
import type { ParseConfigHost } from "../internal/tsoptions/tsconfigparsing.js";
import type { FS } from "../internal/vfs/vfs.js";
import { FS as createOsFs } from "../internal/vfs/osvfs/os.js";
import { TSTrue } from "../internal/core/tristate.js";
import type {
  CompilerExtension,
  ExtensionDiagnostic,
  ExtensionHost,
} from "../extensions/extension-host.js";
import { createExtensionHost } from "../extensions/extension-host.js";
import type { ExtensionTypeChecker } from "../extensions/checker-facade.js";
import {
  createExtensionCheckerHandle,
  createExtensionTypeChecker,
} from "../extensions/checker-facade.js";
import type { ExtensionModuleGraph } from "../extensions/module-graph.js";
import { createExtensionModuleGraph } from "../extensions/module-graph.js";
import type {
  TranspileCompilerOptions,
  TranspileCompilerOptionValue,
} from "./transpile.js";

export type CreateCompilerSourceProgramOptions = {
  readonly projectRoot?: string;
  readonly compilerOptions?: TranspileCompilerOptions;
  readonly extensions?: readonly CompilerExtension[];
  readonly runSemanticChecks?: boolean;
  readonly runExtensionChecks?: boolean;
};

export type CompilerSourceProgram = {
  readonly program: GoPtr<Program>;
  readonly sourceFiles: readonly SourceFile[];
  readonly moduleGraph: ExtensionModuleGraph;
  readonly extensionHost: ExtensionHost;
  readonly diagnostics: readonly Diagnostic[];
  readonly extensionDiagnostics: readonly ExtensionDiagnostic[];
  withSemanticView<T>(
    sourceFile: GoPtr<SourceFile>,
    run: (semantics: ExtensionTypeChecker) => T,
  ): T;
};

const isDefined = <T>(value: GoPtr<T>): value is T => value !== undefined;

const appendCompilerOption = (
  args: string[],
  key: string,
  value: TranspileCompilerOptionValue
): void => {
  if (value === undefined) {
    return;
  }

  args.push(`--${key}`);
  if (value === true) {
    return;
  }
  if (Array.isArray(value)) {
    args.push(value.join(","));
    return;
  }
  args.push(String(value));
};

const appendCompilerOptions = (
  args: string[],
  compilerOptions: TranspileCompilerOptions | undefined
): void => {
  if (!compilerOptions) {
    return;
  }

  for (const key of Object.keys(compilerOptions).sort()) {
    appendCompilerOption(args, key, compilerOptions[key]);
  }
};

const sourceProgramCommandLineArgs = (
  filePaths: readonly string[],
  options: CreateCompilerSourceProgramOptions
): string[] => {
  const args = ["--ignoreConfig"];
  appendCompilerOptions(args, options.compilerOptions);
  appendCompilerOptions(args, {
    pretty: false,
    noEmit: true,
    noLib: true,
    noResolve: true,
  });
  args.push(...filePaths);
  return args;
};

const collectDefinedDiagnostics = (
  diagnostics: readonly GoPtr<Diagnostic>[]
): Diagnostic[] => diagnostics.filter(isDefined);

const collectCompilerDiagnostics = (
  program: GoPtr<Program>,
  sourceFiles: readonly SourceFile[],
  runSemanticChecks: boolean
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  diagnostics.push(
    ...collectDefinedDiagnostics(
      Program_GetConfigFileParsingDiagnostics(program)
    )
  );
  for (const sourceFile of sourceFiles) {
    diagnostics.push(
      ...collectDefinedDiagnostics(
        Program_GetSyntacticDiagnostics(program, Background(), sourceFile)
      )
    );
    if (runSemanticChecks) {
      diagnostics.push(
        ...collectDefinedDiagnostics(
          Program_GetSemanticDiagnostics(program, Background(), sourceFile)
        )
      );
    }
  }
  diagnostics.push(
    ...collectDefinedDiagnostics(Program_GetProgramDiagnostics(program))
  );
  return diagnostics;
};

export const createCompilerSourceProgram = (
  filePaths: readonly string[],
  options: CreateCompilerSourceProgramOptions = {}
): CompilerSourceProgram => {
  const projectRoot = options.projectRoot ?? process.cwd();
  const fs: FS = createOsFs();
  const parseHost: ParseConfigHost = {
    FS: (): FS => fs,
    GetCurrentDirectory: (): string => projectRoot,
  };
  const parsed = ParseCommandLine(
    sourceProgramCommandLineArgs(filePaths, options),
    parseHost
  );
  const host = NewCompilerHost(
    projectRoot,
    fs,
    projectRoot,
    undefined,
    undefined
  );
  const program = NewProgram({
    Host: host,
    Config: parsed,
    UseSourceOfProjectReference: false as bool,
    SingleThreaded: TSTrue,
    TypingsLocation: "",
    ProjectName: "",
    Tracing: undefined,
  } satisfies ProgramOptions);
  const sourceFiles = Program_GetSourceFiles(program).filter(isDefined);
  const extensionHost = createExtensionHost(options.extensions ?? []);
  const withSemanticView = <T>(
    sourceFile: GoPtr<SourceFile>,
    run: (semantics: ExtensionTypeChecker) => T,
  ): T => {
    const [checker, release] = Program_GetTypeCheckerForFile(
      program,
      Background(),
      sourceFile,
    );
    try {
      return run(createExtensionTypeChecker(checker));
    } finally {
      release();
    }
  };

  extensionHost.configure();
  for (const sourceFile of sourceFiles) {
    extensionHost.afterParseSourceFile(sourceFile, program);
  }

  Program_BindSourceFiles(program);
  for (const sourceFile of sourceFiles) {
    extensionHost.afterBindSourceFile(sourceFile, program);
  }

  if (
    options.runSemanticChecks === true ||
    options.runExtensionChecks === true
  ) {
    for (const sourceFile of sourceFiles) {
      const [checker, release] = Program_GetTypeCheckerForFile(
        program,
        Background(),
        sourceFile
      );
      try {
        extensionHost.afterCheckSourceFile(
          sourceFile,
          createExtensionCheckerHandle(checker),
          program
        );
      } finally {
        release();
      }
    }
    extensionHost.afterCheckProgram(program, sourceFiles);
  }

  extensionHost.validateProgram(program, sourceFiles);

  return {
    program,
    sourceFiles,
    moduleGraph: createExtensionModuleGraph(program, sourceFiles),
    extensionHost,
    diagnostics: collectCompilerDiagnostics(
      program,
      sourceFiles,
      options.runSemanticChecks === true
    ),
    extensionDiagnostics: extensionHost.diagnostics.all(),
    withSemanticView,
  };
};
