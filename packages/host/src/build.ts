import type {
  TargetCompileResult,
  TargetDiagnostic,
  TargetPack,
  TargetCapabilityImplementation,
  TargetRegistry,
  TargetSelection,
  TargetSurfaceImplementation,
  TsonicProjectConfig,
} from "@tsonic/target-api";
import {
  collectTargetRuntimeContributions,
  compileTargetFromSemanticSession,
  createTsonicSemanticSession,
  collectTstsDiagnostics,
} from "./compiler-session.js";
import { collectProjectModuleSpecifiers } from "./module-specifier-scan.js";
import { createProgramOptionsForProject } from "./program-options.js";
import { getTargetCompilationPaths, resolveProjectPaths } from "./project-paths.js";
import { getMissingTargetProviderMessage, selectInstalledTargetCapabilities, selectTargetSurfaceImplementations } from "./target/extensions.js";
import { collectTargetSourceProfileContributions } from "./target/source-profile.js";

export interface CompileProjectInput {
  readonly project: TsonicProjectConfig;
  readonly projectFilePath: string;
  readonly registry: TargetRegistry;
  readonly installedCapabilities?: readonly TargetCapabilityImplementation[];
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
  readonly targetPack?: TargetPack;
  readonly selectedCapabilities?: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces?: readonly TargetSurfaceImplementation[];
  readonly diagnostics: readonly TargetDiagnostic[];
}

export function compileProject(input: CompileProjectInput): ProjectBuildResult {
  const paths = resolveProjectPaths(input);
  const targets: TargetBuildResult[] = [];
  const diagnostics: TargetDiagnostic[] = [];
  const buildPlans: TargetBuildPlan[] = [];
  let moduleSpecifiers: readonly string[] | undefined;
  for (const target of input.project.targets) {
    const targetPack = getRequiredTargetPack(input.registry, target);
    if (isTargetDiagnostic(targetPack)) {
      buildPlans.push({ target, diagnostics: [targetPack] });
      continue;
    }
    const selectedSurfaces = getTargetSelectedSurfaces(targetPack, target);
    if (isTargetDiagnostic(selectedSurfaces)) {
      buildPlans.push({ target, targetPack, diagnostics: [selectedSurfaces] });
      continue;
    }
    moduleSpecifiers ??= collectProjectModuleSpecifiers(paths.projectRoot, paths.outputRoot);
    const selectedCapabilities = getTargetSelectedCapabilities(input.installedCapabilities ?? [], targetPack, target, selectedSurfaces, moduleSpecifiers);
    if (isTargetDiagnostic(selectedCapabilities)) {
      buildPlans.push({ target, targetPack, selectedSurfaces, diagnostics: [selectedCapabilities] });
      continue;
    }
    const providerDiagnostic = getTargetProviderDiagnostic(targetPack, target);
    if (providerDiagnostic !== undefined) {
      buildPlans.push({ target, targetPack, selectedCapabilities, selectedSurfaces, diagnostics: [providerDiagnostic] });
      continue;
    }
    buildPlans.push({ target, targetPack, selectedCapabilities, selectedSurfaces, diagnostics: [] });
  }
  if (buildPlans.every((plan) => hasBlockingDiagnostics(plan.diagnostics))) {
    pushDiagnosticOnlyTargets(buildPlans, targets, diagnostics);
    return {
      targets,
      diagnostics,
    };
  }
  for (const { target, targetPack, selectedCapabilities, selectedSurfaces, diagnostics: planDiagnostics } of buildPlans) {
    if (hasBlockingDiagnostics(planDiagnostics)) {
      pushDiagnosticOnlyTarget(targets, diagnostics, target, planDiagnostics);
      continue;
    }
    if (targetPack === undefined || selectedCapabilities === undefined || selectedSurfaces === undefined) {
      throw new Error(`Target '${target.id}' build planning produced no provider-backed target pack.`);
    }
    const sourceProfile = collectTargetSourceProfileContributions({
      project: input.project,
      projectRoot: paths.projectRoot,
      target,
      targetPack,
      selectedCapabilities,
      selectedSurfaces,
    });
    if (hasBlockingDiagnostics(sourceProfile.diagnostics)) {
      pushDiagnosticOnlyTarget(targets, diagnostics, target, sourceProfile.diagnostics);
      continue;
    }
    const created = createProgramOptionsForProject({
      ...input,
      sourceProfileFiles: sourceProfile.files,
    });
    const session = createTsonicSemanticSession({
      programOptions: created.programOptions,
      project: input.project,
      target,
      targetPack,
      selectedCapabilities,
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
    const targetPaths = getTargetCompilationPaths(paths, target);
    const runtimeContributions = collectTargetRuntimeContributions({
      project: input.project,
      target,
      targetPack,
      selectedCapabilities,
      selectedSurfaces,
      paths: targetPaths,
    });
    if (hasBlockingDiagnostics(runtimeContributions.diagnostics)) {
      pushDiagnosticOnlyTarget(targets, diagnostics, target, runtimeContributions.diagnostics);
      continue;
    }
    const backendCompileResult = compileTargetFromSemanticSession(
      session,
      input.project,
      target,
      targetPack,
      targetPaths,
      runtimeContributions.references,
    );
    diagnostics.push(...backendCompileResult.diagnostics);
    if (hasBlockingDiagnostics(backendCompileResult.diagnostics)) {
      targets.push({
        target,
        compileResult: {
          artifacts: [],
          diagnostics: backendCompileResult.diagnostics,
        },
        diagnostics: [...tstsDiagnostics, ...backendCompileResult.diagnostics],
      });
      continue;
    }
    const compileResult = {
      artifacts: [
        ...runtimeContributions.artifacts,
        ...backendCompileResult.artifacts,
      ],
      diagnostics: backendCompileResult.diagnostics,
    };
    const toolchainResult = targetPack.createToolchain({ project: input.project, target }).prepare({
      artifactsRoot: targetPaths.targetOutputRoot,
      project: input.project,
      target,
      compileResult,
    });
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

function getRequiredTargetPack(
  registry: TargetRegistry,
  target: TargetSelection,
): TargetPack | TargetDiagnostic {
  const targetPack = registry.get(target.id);
  if (targetPack === undefined) {
    return {
      code: "TARGET_SELECTION",
      category: "error",
      message: `Unknown target '${target.id}'.`,
      source: "tsonic-host",
    };
  }
  return targetPack;
}

function getTargetSelectedSurfaces(
  targetPack: TargetPack,
  target: TargetSelection,
): readonly TargetSurfaceImplementation[] | TargetDiagnostic {
  const result = selectTargetSurfaceImplementations(targetPack, target);
  if ("error" in result) {
    return {
      code: "TARGET_SURFACE_SELECTION",
      category: "error",
      message: result.error,
      source: targetPack.id,
    };
  }
  return result.selectedSurfaces;
}

function getTargetSelectedCapabilities(
  installedCapabilities: readonly TargetCapabilityImplementation[],
  targetPack: TargetPack,
  target: TargetSelection,
  selectedSurfaces: readonly TargetSurfaceImplementation[],
  moduleSpecifiers: readonly string[],
): readonly TargetCapabilityImplementation[] | TargetDiagnostic {
  const result = selectInstalledTargetCapabilities(target, installedCapabilities, selectedSurfaces, moduleSpecifiers);
  if ("error" in result) {
    return {
      code: "TARGET_CAPABILITY_SELECTION",
      category: "error",
      message: result.error,
      source: targetPack.id,
    };
  }
  return result.selectedCapabilities;
}

function getTargetProviderDiagnostic(
  targetPack: TargetPack,
  target: TargetSelection,
): TargetDiagnostic | undefined {
  if (targetPack.provider !== undefined) {
    return undefined;
  }
  return {
    code: "TARGET_PROVIDER",
    category: "error",
    message: getMissingTargetProviderMessage(target),
    source: targetPack.id,
  };
}

function isTargetDiagnostic(
  value: unknown,
): value is TargetDiagnostic {
  return typeof value === "object" &&
    value !== null &&
    typeof (value as Readonly<Record<string, unknown>>).code === "string";
}

function hasBlockingDiagnostics(diagnostics: readonly TargetDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.category === "error");
}

function pushDiagnosticOnlyTargets(
  buildPlans: readonly TargetBuildPlan[],
  targets: TargetBuildResult[],
  diagnostics: TargetDiagnostic[],
): void {
  for (const plan of buildPlans) {
    pushDiagnosticOnlyTarget(targets, diagnostics, plan.target, plan.diagnostics);
  }
}

function pushDiagnosticOnlyTarget(
  targets: TargetBuildResult[],
  diagnostics: TargetDiagnostic[],
  target: TargetSelection,
  targetDiagnostics: readonly TargetDiagnostic[],
): void {
  diagnostics.push(...targetDiagnostics);
  targets.push({
    target,
    compileResult: {
      artifacts: [],
      diagnostics: [],
    },
    diagnostics: targetDiagnostics,
  });
}
