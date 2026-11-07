import type { TargetCompileResult, TargetRuntimeContributions, TargetRuntimeReference } from "../artifacts.js";
import type { TargetSelection, TargetSurfaceId, TsonicProjectConfig } from "../config.js";
import type { TargetSourceProfileContributions } from "../source-profile.js";
import type { TargetSourceProgramFacts } from "../public/source/index.js";
import type { TargetSourcePackageGraph } from "../source-packages/model.js";
import type { SelectedTargetCapabilityContributions, TargetSourceCompilerContributions } from "./composition.js";
import type { TargetCompilationPaths } from "./paths.js";

export interface TargetCompileInput {
  readonly source: TargetSourceProgramFacts;
  readonly sourcePackages: TargetSourcePackageGraph;
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly runtimeReferences: readonly TargetRuntimeReference[];
  readonly runtimeActivatedCapabilityIds: readonly string[];
  readonly paths: TargetCompilationPaths;
}

export interface TargetCompilationSessionContext {
  readonly project: TsonicProjectConfig;
  readonly projectDirectory: string;
  readonly target: TargetSelection;
  readonly paths: TargetCompilationPaths;
  readonly selectedSurfaceIds: readonly TargetSurfaceId[];
  readonly capabilities: readonly SelectedTargetCapabilityContributions[];
}

export interface TargetCompilationSession {
  sourceProfileContributions(): TargetSourceProfileContributions;
  sourceCompilerContributions(): TargetSourceCompilerContributions;
  runtimeContributions(): TargetRuntimeContributions;
  compile(input: TargetCompileInput): TargetCompileResult;
  close(): void;
}
