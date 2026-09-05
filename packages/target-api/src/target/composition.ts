import type {
  CompilerExtension,
  SourceSemanticsModule,
} from "@tsonic/tsts";
import type { TsonicDataLayoutRegistration } from "./data-layout.js";
import type {
  TargetRuntimeContributions,
} from "../artifacts.js";
import type {
  TargetSelection,
  TargetSurfaceId,
  TsonicProjectConfig,
} from "../config.js";
import type {
  TargetSourceProfileContributions,
} from "../source-profile.js";
import type {
  TargetCompilationPaths,
} from "./compilation.js";

export interface TargetCompositionContext {
  readonly project: TsonicProjectConfig;
  readonly projectDirectory: string;
  readonly target: TargetSelection;
  readonly selectedCapabilityIds: readonly string[];
  readonly selectedSurfaceIds: readonly TargetSurfaceId[];
}

export interface TargetSourceCompilerContributions {
  readonly semanticsModules?: readonly SourceSemanticsModule[];
  readonly extensions?: readonly CompilerExtension[];
  readonly dataLayouts?: readonly TsonicDataLayoutRegistration[];
}

export interface TargetProviderModuleOwnership {
  readonly specifierPrefix: string;
  readonly providerId?: string;
  readonly message?: string;
}

export interface TargetProviderDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly moduleOwnership: readonly TargetProviderModuleOwnership[];
}

export interface TargetCapabilityContribution {
  readonly kind: string;
}

export interface SelectedTargetCapabilityContributions {
  readonly capabilityId: string;
  readonly moduleOwnership: readonly TargetProviderModuleOwnership[];
  readonly contributions: readonly TargetCapabilityContribution[];
}

export interface TargetRuntimeContributionContext extends TargetCompositionContext {
  readonly paths: TargetCompilationPaths;
}

export interface TargetSurfaceImplementation {
  readonly id: TargetSurfaceId;
  readonly displayName: string;
  readonly requiredSurfaces?: readonly TargetSurfaceId[];
  sourceProfileContributions?(
    context: TargetSurfaceCompositionContext,
  ): TargetSourceProfileContributions;
  sourceCompilerContributions?(
    context: TargetSurfaceCompositionContext,
  ): TargetSourceCompilerContributions;
  runtimeContributions(
    context: TargetRuntimeContributionContext,
  ): TargetRuntimeContributions;
}

export interface TargetCapabilityContext extends TargetCompositionContext {
  readonly capability: TsonicTargetCapabilityPlugin;
}

export interface TargetCapabilityRuntimeContributionContext extends TargetCapabilityContext {
  readonly paths: TargetCompilationPaths;
}

export interface TsonicTargetCapabilityPlugin {
  readonly kind: "target-capability";
  readonly id: string;
  readonly targetId: string;
  readonly displayName: string;
  readonly requiredSurfaces?: readonly string[];
  readonly requiredCapabilities?: readonly string[];
  readonly moduleOwnership: readonly TargetProviderModuleOwnership[];
  sourceProfileContributions?(
    context: TargetCapabilityContext,
  ): TargetSourceProfileContributions;
  sourceCompilerContributions?(
    context: TargetCapabilityContext,
  ): TargetSourceCompilerContributions;
  createTargetContributions?(
    context: TargetCapabilityContext,
  ): readonly TargetCapabilityContribution[];
  runtimeContributions?(
    context: TargetCapabilityRuntimeContributionContext,
  ): TargetRuntimeContributions;
}

export type TargetCapabilityImplementation = TsonicTargetCapabilityPlugin;
export type TargetCapabilityRuntimeContext = TargetCapabilityRuntimeContributionContext;

export interface TargetSurfaceCompositionContext extends TargetCompositionContext {
  readonly surface: TargetSurfaceImplementation;
}
