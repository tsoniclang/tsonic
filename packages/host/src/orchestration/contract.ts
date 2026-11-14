import type { Diagnostic, InvariantFailure, Result } from "../diag/contract.js";
import type { PackageId } from "../ids/contract.js";
import type { SelectedNativeFacts } from "../ir-types/contract.js";
import type { HostProgram } from "../ir-program/contract.js";
import type {
  CheckerExtensions, CompilerLimits, HostAnalysisResult, PrepareImports,
} from "../pipeline/contract.js";
import type {
  Artifact,
  ArtifactLimits,
  ArtifactReconstruction,
  ArtifactUpdate,
  PublishedOutput,
  PublishedTarget,
  PublicationLimits,
  ReconstructionRequest,
  NextPublicationStep,
  OperationOutcome,
  OutputLockOwner,
  OutputOperation,
  PlanReconstruction,
  StartReconstruction,
} from "../artifacts/contract.js";
import type { CaptureRequest, PackageInventory, PackageLimits, PackagePlan, PlanPackages } from "../packages/contract.js";
import type {
  ActivateCapabilities, DescribePlugins, PlanPluginLoads, PluginCatalogue, PluginLoadOutcome,
  PluginLoadRequest, PluginModuleEntry, SelectSurfaces,
} from "../plugins/contract.js";
import type {
  ParseProject, PathEntry, ProjectCapturePlan, ProjectConfiguration, ProjectResolution, ResolveProject,
} from "../project/contract.js";
import type {
  EffectResult, ImportPreparation, PackageSnapshot, SelectedSurfaces, SelectedTarget, SourceContributions,
  ProjectSnapshot, TargetOptions, TargetSelection, VirtualDeclarationFile,
} from "../snapshot/contract.js";

export type TargetSession = object & { readonly identityKind: "target-session" };

export interface CompileProjectRequest {
  readonly projectFilePath: string;
  readonly compilerLimits: CompilerLimits;
  readonly packageLimits: PackageLimits;
  readonly artifactLimits: ArtifactLimits;
  readonly publicationLimits: PublicationLimits;
}

export interface TargetPaths {
  readonly projectFilePath: string;
  readonly projectRoot: string;
  readonly outputRoot: string;
  readonly targetOutputRoot: string;
  readonly cacheRoot: string;
}

export interface TargetSessionInput {
  readonly project: ProjectResolution;
  readonly packages: PackageSnapshot;
  readonly selection: SelectedTarget;
  readonly paths: TargetPaths;
  readonly targetModule: PackageId;
  readonly capabilityModules: readonly PackageId[];
}

export interface TargetArtifacts {
  readonly artifacts: readonly Artifact[];
  readonly roots: readonly string[];
  readonly contracts: readonly ArtifactUpdate[];
}

export type TargetHandoff = (
  program: HostProgram,
  options: TargetOptions,
) => Result<TargetArtifacts>;

export interface TargetFailure {
  readonly targetId: string;
  readonly phase: "create-session" | "source-contributions" | "handoff" | "reconstruction" | "toolchain" | "close";
  readonly name: string;
  readonly message: string;
  readonly diagnostics: readonly Diagnostic[];
}

export type TargetEffectResult<Value> =
  | { readonly kind: "done"; readonly value: Value }
  | { readonly kind: "failed"; readonly failure: TargetFailure };

export type TargetAttempt =
  | { readonly kind: "selection-refused"; readonly target: TargetSelection;
      readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]] }
  | { readonly kind: "selected"; readonly target: SelectedTarget;
      readonly result: TargetEffectResult<Result<TargetArtifacts>> };

export interface ToolchainInput {
  readonly project: ProjectConfiguration;
  readonly target: TargetSelection;
  readonly artifacts: readonly Artifact[];
  readonly published: PublishedTarget;
}

export interface ToolchainOutput {
  readonly diagnostics: readonly string[];
  readonly producedArtifacts: readonly string[];
}

export interface ToolchainAttempt {
  readonly targetId: string;
  readonly result: TargetEffectResult<ToolchainOutput>;
}

export type CompileProjectResult =
  | { readonly kind: "compiled"; readonly project: ProjectResolution;
      readonly targets: readonly TargetAttempt[]; readonly publication: PublishedOutput;
      readonly toolchains: readonly ToolchainAttempt[]; readonly diagnostics: readonly Diagnostic[] }
  | { readonly kind: "failed"; readonly stage: "project" | "packages" | "plugins" | "analysis" | "target"
        | "reconstruction" | "publication" | "toolchain" | "cleanup";
      readonly targets: readonly TargetAttempt[]; readonly publication: PublishedOutput | null;
      readonly toolchains: readonly ToolchainAttempt[]; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]] };

export type SessionEntry =
  | { readonly kind: "created"; readonly targetId: string; readonly session: TargetSession }
  | { readonly kind: "contributed"; readonly targetId: string; readonly session: TargetSession;
      readonly extensions: CheckerExtensions };

export interface SessionTable {
  readonly modules: readonly PluginModuleEntry[];
  readonly sessions: readonly SessionEntry[];
}

export interface CompilationEnvironment {
  readonly workingDirectory: string;
  readonly pathStyle: "posix" | "windows";
  readonly rootDevelopmentDependencies: boolean;
  readonly outputOwner: OutputLockOwner;
  readonly now: number;
  readonly unownedLockGraceMilliseconds: number;
  readonly unverifiableLiveLockMaximumAgeMilliseconds: number;
}

export interface OrchestrationDeps {
  readonly environment: CompilationEnvironment;
  readonly parseProject: ParseProject;
  readonly resolveProject: ResolveProject;
  readonly planPackages: PlanPackages;
  readonly planPluginLoads: PlanPluginLoads;
  readonly describePlugins: DescribePlugins;
  readonly selectSurfaces: SelectSurfaces;
  readonly prepareImports: PrepareImports;
  readonly activateCapabilities: ActivateCapabilities;
  readonly startReconstruction: StartReconstruction;
  readonly planReconstruction: PlanReconstruction;
  readonly nextPublicationStep: NextPublicationStep;
}

export interface CapturedSourceContributions {
  readonly contributions: SourceContributions;
  readonly files: readonly VirtualDeclarationFile[];
  readonly nativeFacts: SelectedNativeFacts;
}

export type CompilationEffect =
  | { readonly kind: "read-text"; readonly path: string }
  | { readonly kind: "capture-paths"; readonly paths: readonly string[] }
  | { readonly kind: "capture-packages"; readonly requests: readonly CaptureRequest[] }
  | { readonly kind: "load-plugins"; readonly requests: readonly PluginLoadRequest[] }
  | { readonly kind: "create-session"; readonly targetId: string; readonly input: TargetSessionInput }
  | { readonly kind: "source-contributions"; readonly targetId: string }
  | { readonly kind: "analyze-host"; readonly targetId: string; readonly snapshot: ProjectSnapshot;
      readonly preparation: ImportPreparation; readonly limits: CompilerLimits }
  | { readonly kind: "handoff"; readonly targetId: string; readonly program: HostProgram;
      readonly options: TargetOptions }
  | { readonly kind: "reconstruct"; readonly targetId: string; readonly request: ReconstructionRequest }
  | { readonly kind: "output"; readonly operations: readonly OutputOperation[] }
  | { readonly kind: "toolchain"; readonly targetId: string; readonly input: ToolchainInput }
  | { readonly kind: "close-session"; readonly targetId: string };

export type CompilationEffectOutcome =
  | { readonly kind: "invariant"; readonly effect: CompilationEffect; readonly failure: InvariantFailure }
  | { readonly kind: "read-text"; readonly path: string; readonly result: EffectResult<string> }
  | { readonly kind: "capture-paths"; readonly paths: readonly string[]; readonly entries: readonly PathEntry[] }
  | { readonly kind: "capture-packages"; readonly requests: readonly CaptureRequest[]; readonly inventory: PackageInventory }
  | { readonly kind: "load-plugins"; readonly requests: readonly PluginLoadRequest[];
      readonly outcomes: readonly PluginLoadOutcome[] }
  | { readonly kind: "create-session"; readonly targetId: string; readonly result: TargetEffectResult<null> }
  | { readonly kind: "source-contributions"; readonly targetId: string;
      readonly result: TargetEffectResult<CapturedSourceContributions> }
  | { readonly kind: "analyze-host"; readonly targetId: string; readonly result: HostAnalysisResult }
  | { readonly kind: "handoff"; readonly targetId: string; readonly result: TargetEffectResult<Result<TargetArtifacts>> }
  | { readonly kind: "reconstruct"; readonly targetId: string; readonly request: ReconstructionRequest;
      readonly result: TargetEffectResult<ArtifactReconstruction> }
  | { readonly kind: "output"; readonly operations: readonly OutputOperation[]; readonly outcomes: readonly OperationOutcome[] }
  | { readonly kind: "toolchain"; readonly targetId: string; readonly result: TargetEffectResult<ToolchainOutput> }
  | { readonly kind: "close-session"; readonly targetId: string; readonly result: TargetEffectResult<null> };

export type CompilationCalculation =
  | { readonly kind: "project-parsed"; readonly result: Result<ProjectCapturePlan> }
  | { readonly kind: "project-resolved"; readonly result: Result<ProjectResolution> }
  | { readonly kind: "packages-planned"; readonly captureCount: number; readonly result: Result<PackagePlan> }
  | { readonly kind: "plugins-described"; readonly result: Result<PluginCatalogue> }
  | { readonly kind: "surfaces-selected"; readonly targetId: string; readonly result: Result<SelectedSurfaces> }
  | { readonly kind: "imports-prepared"; readonly targetId: string; readonly result: Result<ImportPreparation> }
  | { readonly kind: "capabilities-activated"; readonly targetId: string; readonly result: Result<SelectedTarget> };

export type CompilationOutcome = CompilationEffectOutcome | CompilationCalculation;

export type CompilationStep =
  | { readonly kind: "computed"; readonly calculation: CompilationCalculation }
  | { readonly kind: "perform"; readonly effect: CompilationEffect }
  | { readonly kind: "invariant"; readonly failure: InvariantFailure;
      readonly closeFailures: readonly TargetFailure[]; readonly closeInvariants: readonly InvariantFailure[] }
  | { readonly kind: "finished"; readonly result: CompileProjectResult };

export type NextCompilationStep = (
  deps: OrchestrationDeps,
  request: CompileProjectRequest,
  history: readonly CompilationOutcome[],
) => CompilationStep;

export interface CompilationEffectResult {
  readonly outcome: CompilationEffectOutcome;
  readonly sessions: SessionTable;
}

export interface OrchestrationEffects {
  readonly perform: (effect: CompilationEffect, sessions: SessionTable) => Promise<CompilationEffectResult>;
}
