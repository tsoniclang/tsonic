import type { GoPtr } from "../go/compat.js";
import type { SourceFile } from "../internal/ast/ast.js";
import type { Program } from "../internal/compiler/program.js";
import { ExtensionFacts } from "./facts.js";
import type { ExtensionCheckerHandle, ExtensionTypeChecker } from "./checker-facade.js";
import type { ExtensionImportIndex } from "./import-index.js";
import { createExtensionImportIndex } from "./import-index.js";

export type ExtensionDiagnosticCategory = "error" | "warning" | "suggestion";

export type ExtensionDiagnostic = {
  readonly extensionId: string;
  readonly code: string;
  readonly category: ExtensionDiagnosticCategory;
  readonly message: string;
  readonly sourceFile?: GoPtr<SourceFile>;
  readonly node?: object;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type ExtensionDiagnostics = {
  add(diagnostic: ExtensionDiagnostic): void;
  all(): readonly ExtensionDiagnostic[];
};

export type ExtensionConfigureContext = {
  readonly facts: ExtensionFacts;
  readonly diagnostics: ExtensionDiagnostics;
};

export type ExtensionSourceFileContext = {
  readonly program?: GoPtr<Program>;
  readonly sourceFile: GoPtr<SourceFile>;
  readonly imports: ExtensionImportIndex;
  readonly facts: ExtensionFacts;
  readonly diagnostics: ExtensionDiagnostics;
};

export type ExtensionCheckedSourceFileContext = ExtensionSourceFileContext & {
  readonly checker: ExtensionTypeChecker;
};

export type ExtensionProgramContext = {
  readonly program: GoPtr<Program>;
  readonly sourceFiles: readonly GoPtr<SourceFile>[];
  readonly facts: ExtensionFacts;
  readonly diagnostics: ExtensionDiagnostics;
};

export type CompilerExtension = {
  readonly id: string;
  readonly dependsOn?: readonly string[];
  readonly runsAfter?: readonly string[];
  configure?(context: ExtensionConfigureContext): void;
  afterParseSourceFile?(context: ExtensionSourceFileContext): void;
  afterBindSourceFile?(context: ExtensionSourceFileContext): void;
  afterCheckSourceFile?(context: ExtensionCheckedSourceFileContext): void;
  afterCheckProgram?(context: ExtensionProgramContext): void;
  validateProgram?(context: ExtensionProgramContext): void;
};

export type ExtensionHost = {
  readonly extensions: readonly CompilerExtension[];
  readonly facts: ExtensionFacts;
  readonly diagnostics: ExtensionDiagnostics;
  configure(): void;
  afterParseSourceFile(sourceFile: GoPtr<SourceFile>, program?: GoPtr<Program>): void;
  afterBindSourceFile(sourceFile: GoPtr<SourceFile>, program?: GoPtr<Program>): void;
  afterCheckSourceFile(
    sourceFile: GoPtr<SourceFile>,
    checker: ExtensionCheckerHandle,
    program?: GoPtr<Program>,
  ): void;
  afterCheckProgram(
    program: GoPtr<Program>,
    sourceFiles: readonly GoPtr<SourceFile>[],
  ): void;
  validateProgram(
    program: GoPtr<Program>,
    sourceFiles: readonly GoPtr<SourceFile>[],
  ): void;
};

const createDiagnostics = (): ExtensionDiagnostics => {
  const diagnostics: ExtensionDiagnostic[] = [];
  return {
    add: (diagnostic: ExtensionDiagnostic): void => {
      diagnostics.push(diagnostic);
    },
    all: (): readonly ExtensionDiagnostic[] => diagnostics,
  };
};

const reportHookFailure = (
  diagnostics: ExtensionDiagnostics,
  extensionId: string,
  hookName: string,
  error: unknown,
  sourceFile?: GoPtr<SourceFile>,
): void => {
  const message = error instanceof Error ? error.message : String(error);
  diagnostics.add({
    extensionId,
    code: "TSTS_EXTENSION_FAILURE",
    category: "error",
    message: `Extension '${extensionId}' failed in ${hookName}: ${message}`,
    sourceFile,
  });
};

const runExtensionHook = (
  diagnostics: ExtensionDiagnostics,
  extension: CompilerExtension,
  hookName: string,
  run: () => void,
  sourceFile?: GoPtr<SourceFile>,
): void => {
  try {
    run();
  } catch (error) {
    reportHookFailure(diagnostics, extension.id, hookName, error, sourceFile);
  }
};

const orderedExtensions = (
  extensions: readonly CompilerExtension[],
): readonly CompilerExtension[] => {
  const byId = new Map<string, CompilerExtension>();
  for (const extension of extensions) {
    if (byId.has(extension.id)) {
      throw new Error(`Duplicate TSTS extension id '${extension.id}'.`);
    }
    byId.set(extension.id, extension);
  }

  const ordered: CompilerExtension[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (extension: CompilerExtension): void => {
    if (visited.has(extension.id)) return;
    if (visiting.has(extension.id)) {
      throw new Error(`TSTS extension dependency cycle includes '${extension.id}'.`);
    }

    visiting.add(extension.id);
    for (const dependencyId of extension.dependsOn ?? []) {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        throw new Error(
          `TSTS extension '${extension.id}' depends on missing extension '${dependencyId}'.`,
        );
      }
      visit(dependency);
    }
    for (const predecessorId of extension.runsAfter ?? []) {
      const predecessor = byId.get(predecessorId);
      if (predecessor) {
        visit(predecessor);
      }
    }
    visiting.delete(extension.id);
    visited.add(extension.id);
    ordered.push(extension);
  };

  for (const extension of extensions) {
    visit(extension);
  }

  return ordered;
};

export const createExtensionHost = (
  extensions: readonly CompilerExtension[],
): ExtensionHost => {
  const ordered = orderedExtensions(extensions);
  const facts = new ExtensionFacts();
  const diagnostics = createDiagnostics();

  const sourceFileContext = (
    sourceFile: GoPtr<SourceFile>,
    program?: GoPtr<Program>,
  ): ExtensionSourceFileContext => {
    let imports: ExtensionImportIndex | undefined;
    return {
      program,
      sourceFile,
      get imports(): ExtensionImportIndex {
        imports ??= createExtensionImportIndex(sourceFile);
        return imports;
      },
      facts,
      diagnostics,
    };
  };

  const programContext = (
    program: GoPtr<Program>,
    sourceFiles: readonly GoPtr<SourceFile>[],
  ): ExtensionProgramContext => ({
    program,
    sourceFiles,
    facts,
    diagnostics,
  });

  return {
    extensions: ordered,
    facts,
    diagnostics,
    configure: (): void => {
      for (const extension of ordered) {
        if (!extension.configure) continue;
        runExtensionHook(diagnostics, extension, "configure", () =>
          extension.configure!({ facts, diagnostics }),
        );
      }
    },
    afterParseSourceFile: (
      sourceFile: GoPtr<SourceFile>,
      program?: GoPtr<Program>,
    ): void => {
      const context = sourceFileContext(sourceFile, program);
      for (const extension of ordered) {
        if (!extension.afterParseSourceFile) continue;
        runExtensionHook(diagnostics, extension, "afterParseSourceFile", () =>
          extension.afterParseSourceFile!(context),
          sourceFile,
        );
      }
    },
    afterBindSourceFile: (
      sourceFile: GoPtr<SourceFile>,
      program?: GoPtr<Program>,
    ): void => {
      const context = sourceFileContext(sourceFile, program);
      for (const extension of ordered) {
        if (!extension.afterBindSourceFile) continue;
        runExtensionHook(diagnostics, extension, "afterBindSourceFile", () =>
          extension.afterBindSourceFile!(context),
          sourceFile,
        );
      }
    },
    afterCheckSourceFile: (
      sourceFile: GoPtr<SourceFile>,
      checker: ExtensionCheckerHandle,
      program?: GoPtr<Program>,
    ): void => {
      const context: ExtensionCheckedSourceFileContext = {
        ...sourceFileContext(sourceFile, program),
        checker: checker.facade,
      };
      for (const extension of ordered) {
        if (!extension.afterCheckSourceFile) continue;
        runExtensionHook(diagnostics, extension, "afterCheckSourceFile", () =>
          extension.afterCheckSourceFile!(context),
          sourceFile,
        );
      }
    },
    afterCheckProgram: (
      program: GoPtr<Program>,
      sourceFiles: readonly GoPtr<SourceFile>[],
    ): void => {
      const context = programContext(program, sourceFiles);
      for (const extension of ordered) {
        if (!extension.afterCheckProgram) continue;
        runExtensionHook(diagnostics, extension, "afterCheckProgram", () =>
          extension.afterCheckProgram!(context),
        );
      }
    },
    validateProgram: (
      program: GoPtr<Program>,
      sourceFiles: readonly GoPtr<SourceFile>[],
    ): void => {
      const context = programContext(program, sourceFiles);
      for (const extension of ordered) {
        if (!extension.validateProgram) continue;
        runExtensionHook(diagnostics, extension, "validateProgram", () =>
          extension.validateProgram!(context),
        );
      }
    },
  };
};
