import type {
  TargetCompileResult,
  TargetDiagnostic,
  TargetPack,
  TargetRegistry,
  TargetSelection,
  TargetSurfaceImplementation,
  TsonicProjectConfig,
} from "@tsonic/target-api";
import {
  compileTargetFromSemanticSession,
  createTsonicSemanticSession,
  collectTstsDiagnostics,
  getSelectedSurfaceImplementations,
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

interface TargetBuildPlan {
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedSurfaces?: readonly TargetSurfaceImplementation[];
  readonly surfaceDiagnostic?: TargetDiagnostic;
}

export function compileProject(input: CompileProjectInput): ProjectBuildResult {
  const paths = resolveProjectPaths(input);
  const targets: TargetBuildResult[] = [];
  const diagnostics: TargetDiagnostic[] = [];
  const buildPlans: TargetBuildPlan[] = [];
  for (const target of input.project.targets) {
    const targetPack = input.registry.require(target.id);
    const selectedSurfaces = getTargetSelectedSurfaces(targetPack, target);
    if (isTargetDiagnostic(selectedSurfaces)) {
      buildPlans.push({ target, targetPack, surfaceDiagnostic: selectedSurfaces });
      continue;
    }
    buildPlans.push({ target, targetPack, selectedSurfaces });
  }
  if (buildPlans.every((plan) => plan.selectedSurfaces === undefined)) {
    for (const plan of buildPlans) {
      if (plan.surfaceDiagnostic === undefined) {
        continue;
      }
      diagnostics.push(plan.surfaceDiagnostic);
      targets.push({
        target: plan.target,
        compileResult: {
          artifacts: [],
          diagnostics: [],
        },
        diagnostics: [plan.surfaceDiagnostic],
      });
    }
    return {
      targets,
      diagnostics,
    };
  }
  const created = createProgramOptionsForProject(input);
  for (const { target, targetPack, selectedSurfaces, surfaceDiagnostic } of buildPlans) {
    if (surfaceDiagnostic !== undefined) {
      diagnostics.push(surfaceDiagnostic);
      targets.push({
        target,
        compileResult: {
          artifacts: [],
          diagnostics: [],
        },
        diagnostics: [surfaceDiagnostic],
      });
      continue;
    }
    if (selectedSurfaces === undefined) {
      throw new Error(`Target '${target.id}' selected surface validation produced no result.`);
    }
    const session = createTsonicSemanticSession({
      programOptions: created.programOptions,
      project: input.project,
      target,
      targetPack,
      selectedSurfaces,
    });
    const tstsDiagnostics = collectTstsDiagnostics(session, paths.projectRoot);
    diagnostics.push(...tstsDiagnostics);
    if (tstsDiagnostics.some((diagnostic) => diagnostic.category === "error")) {
      targets.push({
        target,
        compileResult: {
          artifacts: [],
          diagnostics: [],
        },
        diagnostics: tstsDiagnostics,
      });
      continue;
    }
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

function getTargetSelectedSurfaces(
  targetPack: TargetPack,
  target: TargetSelection,
): readonly TargetSurfaceImplementation[] | TargetDiagnostic {
  try {
    return getSelectedSurfaceImplementations(targetPack, target);
  } catch (error: unknown) {
    return {
      code: "TARGET_SURFACE_SELECTION",
      category: "error",
      message: error instanceof Error ? error.message : String(error),
      source: targetPack.id,
    };
  }
}

function isTargetDiagnostic(
  value: readonly TargetSurfaceImplementation[] | TargetDiagnostic,
): value is TargetDiagnostic {
  return typeof (value as TargetDiagnostic).code === "string";
}
