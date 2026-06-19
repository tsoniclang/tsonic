import type {
  TargetCompileResult,
  TargetDiagnostic,
  TargetRegistry,
  TargetSelection,
  TsonicProjectConfig,
} from "@tsonic/target-api";
import {
  compileTargetFromSemanticSession,
  createTsonicSemanticSession,
  collectTstsDiagnostics,
} from "./compiler-session.js";
import { createProgramOptionsForProject } from "./program-options.js";
import { getTargetCompilationPaths, resolveProjectPaths } from "./project-paths.js";

export interface CompileProjectInput {
  readonly project: TsonicProjectConfig;
  readonly projectFilePath: string;
  readonly registry: TargetRegistry;
}

export interface TargetBuildResult {
  readonly target: TargetSelection;
  readonly compileResult: TargetCompileResult;
  readonly diagnostics: readonly TargetDiagnostic[];
}

export interface ProjectBuildResult {
  readonly targets: readonly TargetBuildResult[];
  readonly diagnostics: readonly TargetDiagnostic[];
}

export function compileProject(input: CompileProjectInput): ProjectBuildResult {
  const paths = resolveProjectPaths(input);
  const created = createProgramOptionsForProject(input);
  const targets: TargetBuildResult[] = [];
  const diagnostics: TargetDiagnostic[] = [];
  for (const target of input.project.targets) {
    const targetPack = input.registry.require(target.id);
    const session = createTsonicSemanticSession({
      programOptions: created.programOptions,
      project: input.project,
      target,
      targetPack,
    });
    const tstsDiagnostics = collectTstsDiagnostics(session.program, session.sourceFiles, paths.projectRoot);
    diagnostics.push(...tstsDiagnostics);
    const compileResult = compileTargetFromSemanticSession(
      session,
      input.project,
      target,
      targetPack,
      getTargetCompilationPaths(paths, target),
    );
    const toolchainResult = targetPack.createToolchain({ project: input.project, target }).prepare({
      artifactsRoot: getTargetCompilationPaths(paths, target).targetOutputRoot,
      project: input.project,
      target,
      compileResult,
    });
    diagnostics.push(...compileResult.diagnostics);
    diagnostics.push(...toolchainResult.diagnostics.map((message): TargetDiagnostic => ({
      code: "TARGET_TOOLCHAIN",
      category: "suggestion",
      message,
      source: targetPack.id,
    })));
    targets.push({
      target,
      compileResult,
      diagnostics: [...tstsDiagnostics, ...compileResult.diagnostics],
    });
  }
  return {
    targets,
    diagnostics,
  };
}
