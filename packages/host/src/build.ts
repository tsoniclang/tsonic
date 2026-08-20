import type {
  TargetCompilationSession,
  TargetPack,
  TargetRegistry,
  TargetSelection,
  TargetSurfaceImplementation,
  TsonicProjectConfig,
} from "@tsonic/target-api";
import type {
  TargetCapabilityImplementation,
} from "@tsonic/target-api/provider";
import {
  rejectedTargetStage,
  resolvedTargetStage,
} from "@tsonic/target-api/artifacts";
import type {
  TargetCompileResult,
  TargetCompileOutput,
  TargetDiagnostic,
} from "@tsonic/target-api/artifacts";
import { sourceProjectFiles } from "@tsonic/target-api/source";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import { createCompilerSession } from "@tsonic/tsts";
import type { CheckedSourceProgram } from "@tsonic/tsts";
import { checkTargetSource } from "./compiler-session.js";
import { collectTstsDiagnostics } from "./diagnostics.js";
import { finalizeTargetDiagnostics } from "./diagnostics.js";
import { createProgramOptionsForProject } from "./program-options.js";
import { getTargetCompilationPaths, resolveProjectPaths } from "./project-paths.js";
import {
  collectImportActivatedTargetCapabilities,
  collectRuntimeActivatedTargetCapabilities,
} from "./target/capability-activation.js";
import {
  captureTargetCapabilityContributions,
  selectInstalledTargetCapabilities,
  selectTargetSurfaceImplementations,
  validateTargetModuleOwnership,
} from "./target/extensions.js";
import { collectTargetRuntimeContributions } from "./target/runtime-contributions.js";
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
  const buildPlans = createTargetBuildPlans(input);
  for (const plan of buildPlans) {
    const result = plan.diagnostics.some(isErrorDiagnostic)
      ? diagnosticTargetBuild(plan.target, plan.diagnostics)
      : compileTargetBuild(input, paths, plan);
    targets.push(result);
    diagnostics.push(...result.diagnostics);
  }
  return Object.freeze({
    targets: Object.freeze(targets),
    diagnostics: Object.freeze(diagnostics),
  });
}

function createTargetBuildPlans(
  input: CompileProjectInput,
): readonly TargetBuildPlan[] {
  const plans: TargetBuildPlan[] = [];
  let activationContext: CapabilityActivationContext | undefined;
  for (const target of input.project.targets) {
    const targetPack = getRequiredTargetPack(input.registry, target);
    if (isTargetDiagnostic(targetPack)) {
      plans.push({ target, diagnostics: [targetPack] });
      continue;
    }
    const surfaces = selectTargetSurfaceImplementations(targetPack, target);
    if ("error" in surfaces) {
      plans.push({
        target,
        targetPack,
        diagnostics: [targetDiagnostic(targetPack.id, "TARGET_SURFACE_SELECTION", surfaces.error)],
      });
      continue;
    }
    activationContext ??= createCapabilityActivationContext(input);
    const importActivatedCapabilities = collectImportActivatedTargetCapabilities(
      activationContext.ast,
      activationContext.sourceFiles,
      input.installedCapabilities ?? [],
      target,
    );
    const capabilities = selectInstalledTargetCapabilities(
      target,
      importActivatedCapabilities,
      surfaces.selectedSurfaces,
    );
    if ("error" in capabilities) {
      plans.push({
        target,
        targetPack,
        selectedSurfaces: surfaces.selectedSurfaces,
        diagnostics: [targetDiagnostic(targetPack.id, "TARGET_CAPABILITY_SELECTION", capabilities.error)],
      });
      continue;
    }
    try {
      validateTargetModuleOwnership(target, targetPack.provider, capabilities.selectedCapabilities);
    } catch (error) {
      plans.push({
        target,
        targetPack,
        selectedCapabilities: capabilities.selectedCapabilities,
        selectedSurfaces: surfaces.selectedSurfaces,
        diagnostics: [targetDiagnostic(targetPack.id, "TARGET_MODULE_OWNERSHIP", errorMessage(error))],
      });
      continue;
    }
    plans.push(Object.freeze({
      target,
      targetPack,
      selectedCapabilities: capabilities.selectedCapabilities,
      selectedSurfaces: surfaces.selectedSurfaces,
      diagnostics: Object.freeze([]),
    }));
  }
  return Object.freeze(plans);
}

function compileTargetBuild(
  input: CompileProjectInput,
  paths: ReturnType<typeof resolveProjectPaths>,
  plan: TargetBuildPlan,
): TargetBuildResult {
  if (
    plan.targetPack === undefined ||
    plan.selectedCapabilities === undefined ||
    plan.selectedSurfaces === undefined
  ) {
    throw new Error(`Target '${plan.target.id}' build plan is incomplete without a diagnostic.`);
  }
  const targetPack = plan.targetPack;
  const targetPaths = getTargetCompilationPaths(paths, plan.target);
  let session: TargetCompilationSession | undefined;
  let compileResult: TargetCompileResult | undefined;
  let diagnostics: readonly TargetDiagnostic[] = [];
  try {
    const capturedCapabilities = captureTargetCapabilityContributions({
      project: input.project,
      projectDirectory: paths.projectDirectory,
      target: plan.target,
      selectedCapabilities: plan.selectedCapabilities,
      selectedSurfaces: plan.selectedSurfaces,
    });
    session = targetPack.createCompilationSession(Object.freeze({
      project: input.project,
      projectDirectory: paths.projectDirectory,
      target: plan.target,
      paths: targetPaths,
      selectedSurfaceIds: Object.freeze(plan.selectedSurfaces.map((surface) => surface.id)),
      capabilities: capturedCapabilities,
    }));
    const sourceProfile = collectTargetSourceProfileContributions({
      project: input.project,
      projectDirectory: paths.projectDirectory,
      projectRoot: paths.projectRoot,
      target: plan.target,
      targetPackId: targetPack.id,
      selectedCapabilities: plan.selectedCapabilities,
      selectedSurfaces: plan.selectedSurfaces,
      targetContributions: session.sourceProfileContributions(),
    });
    diagnostics = Object.freeze([...diagnostics, ...sourceProfile.diagnostics]);
    if (sourceProfile.diagnostics.some(isErrorDiagnostic)) {
      compileResult = rejectedTargetStage(diagnostics);
    } else {
      const created = createProgramOptionsForProject({
        ...input,
        sourceProfileFiles: sourceProfile.files,
        sourceDeclarationPolicy: sourceProfile.declarationPolicy,
      });
      const checked = checkTargetSource({
        programOptions: created.programOptions,
        sourcePackages: created.sourcePackages,
        project: input.project,
        projectDirectory: paths.projectDirectory,
        target: plan.target,
        targetPack,
        selectedCapabilities: plan.selectedCapabilities,
        selectedSurfaces: plan.selectedSurfaces,
        targetContributions: session.sourceCompilerContributions(),
      });
      const sourceDiagnostics = collectTstsDiagnostics(checked.source, paths.projectRoot);
      diagnostics = Object.freeze([...diagnostics, ...sourceDiagnostics]);
      if (sourceDiagnostics.some(isErrorDiagnostic)) {
        compileResult = rejectedTargetStage(diagnostics);
      } else {
        const runtimeActivatedCapabilities = collectRuntimeActivatedTargetCapabilities(
          checked.source.ast,
          sourceProjectFiles(checked.source),
          plan.selectedCapabilities,
        );
        const runtime = collectTargetRuntimeContributions({
          project: input.project,
          projectDirectory: paths.projectDirectory,
          target: plan.target,
          targetPackId: targetPack.id,
          selectedCapabilities: plan.selectedCapabilities,
          runtimeActivatedCapabilities,
          selectedSurfaces: plan.selectedSurfaces,
          paths: targetPaths,
          targetContributions: session.runtimeContributions(),
        });
        diagnostics = Object.freeze([...diagnostics, ...runtime.diagnostics]);
        if (runtime.diagnostics.some(isErrorDiagnostic)) {
          compileResult = rejectedTargetStage(diagnostics);
        } else {
          const targetResult = session.compile({
            source: createTargetSourceProgram(checked.source),
            sourcePackages: checked.sourcePackages,
            project: input.project,
            target: plan.target,
            runtimeReferences: runtime.references,
            paths: targetPaths,
          });
          const targetDiagnostics = finalizeTargetDiagnostics(
            checked.source,
            targetResult.diagnostics,
            paths.projectRoot,
          );
          diagnostics = Object.freeze([...diagnostics, ...targetDiagnostics]);
          compileResult = targetResult.kind === "rejected" ||
              targetDiagnostics.some(isErrorDiagnostic)
            ? rejectedTargetStage(diagnostics)
            : resolvedTargetStage({
                artifacts: Object.freeze([
                  ...runtime.artifacts,
                  ...targetResult.value.artifacts,
                ]),
              }, diagnostics);
        }
      }
    }
  } catch (error) {
    const diagnostic = targetDiagnostic(targetPack.id, "TARGET_COMPILATION", errorMessage(error));
    diagnostics = Object.freeze([...diagnostics, diagnostic]);
    compileResult = rejectedTargetStage(diagnostics);
  } finally {
    if (session !== undefined) {
      try {
        session.close();
      } catch (error) {
        const diagnostic = targetDiagnostic(targetPack.id, "TARGET_SESSION_CLOSE", errorMessage(error));
        diagnostics = Object.freeze([...diagnostics, diagnostic]);
        compileResult = rejectedTargetStage(diagnostics);
      }
    }
  }
  if (compileResult === undefined) {
    throw new Error(`Target '${plan.target.id}' completed without a stage result.`);
  }
  if (compileResult.kind === "resolved") {
    const toolchainResult = targetPack.createToolchain({
      project: input.project,
      target: plan.target,
    }).prepare({
      artifactsRoot: targetPaths.targetOutputRoot,
      project: input.project,
      target: plan.target,
      compileOutput: compileResult.value,
    });
    const toolchainDiagnostics = toolchainResult.diagnostics.map((message): TargetDiagnostic => ({
      code: "TARGET_TOOLCHAIN",
      category: "suggestion",
      message,
      source: targetPack.id,
    }));
    diagnostics = Object.freeze([...diagnostics, ...toolchainDiagnostics]);
    compileResult = resolvedTargetStage(compileResult.value, diagnostics);
  }
  return Object.freeze({
    target: plan.target,
    compileResult,
    diagnostics,
  });
}

interface CapabilityActivationContext {
  readonly ast: CheckedSourceProgram["ast"];
  readonly sourceFiles: ReturnType<typeof sourceProjectFiles>;
}

function createCapabilityActivationContext(
  input: CompileProjectInput,
): CapabilityActivationContext {
  const activationSession = createCompilerSession({
    programOptions: createProgramOptionsForProject(input).programOptions,
  });
  const source = activationSession.checkSource();
  return Object.freeze({
    ast: source.ast,
    sourceFiles: sourceProjectFiles(source),
  });
}

function getRequiredTargetPack(
  registry: TargetRegistry,
  target: TargetSelection,
): TargetPack | TargetDiagnostic {
  const targetPack = registry.get(target.id);
  return targetPack ?? targetDiagnostic(
    "tsonic-host",
    "TARGET_SELECTION",
    `Unknown target '${target.id}'.`,
  );
}

function diagnosticTargetBuild(
  target: TargetSelection,
  diagnostics: readonly TargetDiagnostic[],
): TargetBuildResult {
  return Object.freeze({
    target,
    compileResult: rejectedTargetStage<TargetCompileOutput>(diagnostics),
    diagnostics,
  });
}

function targetDiagnostic(
  source: string,
  code: string,
  message: string,
): TargetDiagnostic {
  return Object.freeze({ code, category: "error", message, source });
}

function isTargetDiagnostic(value: unknown): value is TargetDiagnostic {
  return typeof value === "object" && value !== null &&
    typeof (value as Readonly<Record<string, unknown>>).code === "string";
}

function isErrorDiagnostic(diagnostic: TargetDiagnostic): boolean {
  return diagnostic.category === "error";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
