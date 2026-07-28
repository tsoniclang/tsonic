import type { TargetRuntimeContributions } from "./artifacts.js";
import type { TargetSelection, TsonicProjectConfig } from "./config.js";
import type {
  TargetCompilationPaths,
  TargetPack,
  TargetProviderModuleOwnership,
  TargetSourceCompilerContributions,
  TargetSurfaceImplementation,
} from "./pack.js";
import type { TargetSourceProfileContributions } from "./source-profile.js";

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

export interface TargetCapabilityContribution {
  readonly kind: string;
}

export interface TsonicTargetCapabilityPlugin {
  readonly kind: "target-capability";
  readonly id: string;
  readonly targetId: string;
  readonly displayName: string;
  readonly requiredSurfaces?: readonly string[];
  readonly requiredCapabilities?: readonly string[];
  readonly moduleOwnership: readonly TargetProviderModuleOwnership[];
  sourceProfileContributions?(context: TargetCapabilityContext): TargetSourceProfileContributions;
  sourceCompilerContributions?(context: TargetCapabilityContext): TargetSourceCompilerContributions;
  createTargetContributions?(context: TargetCapabilityContext): readonly TargetCapabilityContribution[];
  runtimeContributions?(context: TargetCapabilityRuntimeContributionContext): TargetRuntimeContributions;
}
