import type { CompilerExtension } from "@tsonic/tsts";
import type { TargetRuntimeContributions } from "./artifacts.js";
import type { TargetSelection, TsonicProjectConfig } from "./config.js";
import type { TargetCompilationPaths, TargetPack, TargetProviderModuleOwnership, TargetSurfaceImplementation } from "./pack.js";

export type TsonicPlugin =
  | TsonicTargetPlugin
  | TsonicTargetCapabilityPlugin;

export interface TsonicTargetPlugin {
  readonly kind: "target";
  readonly id: string;
  readonly targetId: string;
  createTargetPack(): TargetPack;
}

export interface TargetCapabilityContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedCapabilities: readonly TsonicTargetCapabilityPlugin[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly capability: TsonicTargetCapabilityPlugin;
}

export interface TargetCapabilityRuntimeContributionContext extends TargetCapabilityContext {
  readonly paths: TargetCompilationPaths;
}

export interface TargetCapabilityOperationMapper {
  readonly kind: string;
}

export interface TsonicTargetCapabilityPlugin {
  readonly kind: "target-capability";
  readonly id: string;
  readonly targetId: string;
  readonly displayName: string;
  readonly requiredSurfaces?: readonly string[];
  readonly moduleOwnership: readonly TargetProviderModuleOwnership[];
  createExtensions(context: TargetCapabilityContext): readonly CompilerExtension[];
  createOperationMappers?(context: TargetCapabilityContext): readonly TargetCapabilityOperationMapper[];
  runtimeContributions?(context: TargetCapabilityRuntimeContributionContext): TargetRuntimeContributions;
}
