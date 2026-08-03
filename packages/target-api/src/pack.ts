import type {
  CompilerExtension,
  SourceSemanticsModule,
} from "@tsonic/tsts";
import type {
  TargetSourceProgram,
} from "./source-semantics/index.js";
import type { TargetCompileResult, TargetRuntimeContributions, TargetRuntimeReference } from "./artifacts.js";
import type {
  TargetSelection,
  TargetSurfaceId,
  TsonicProjectConfig,
} from "./config.js";
import type {
  TargetCapabilityRuntimeContributionContext,
  TsonicTargetCapabilityPlugin,
} from "./plugins.js";
import type {
  TargetSourceProfileContributions,
} from "./source-profile.js";

export interface TargetProviderContext {
  readonly project: TsonicProjectConfig;
  readonly projectDirectory: string;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
}

export interface TargetSourceCompilerContributions {
  readonly semanticsModules?: readonly SourceSemanticsModule[];
  readonly extensions?: readonly CompilerExtension[];
}

export interface TargetProviderModuleOwnership {
  readonly specifierPrefix: string;
  readonly providerId?: string;
  readonly message?: string;
}

export interface TargetSurfaceSourceCompilerContext {
  readonly project: TsonicProjectConfig;
  readonly projectDirectory: string;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly surface: TargetSurfaceImplementation;
}

export interface TargetBackendContext extends TargetProviderContext {}

export interface TargetToolchainContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
}

export interface TargetCompilationPaths {
  readonly projectFilePath: string;
  readonly projectRoot: string;
  readonly outputRoot: string;
  readonly targetOutputRoot: string;
}

export interface TargetRuntimeContributionContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly paths: TargetCompilationPaths;
}

export interface TargetProviderSourceProfileContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
}

export interface TargetSurfaceSourceProfileContext extends TargetProviderSourceProfileContext {
  readonly surface: TargetSurfaceImplementation;
}

export interface TargetCompileInput {
  readonly source: TargetSourceProgram;
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly runtimeReferences: readonly TargetRuntimeReference[];
  readonly paths: TargetCompilationPaths;
}

export interface TargetBackend {
  compile(input: TargetCompileInput): TargetCompileResult;
}

export interface TargetToolchainInput {
  readonly artifactsRoot: string;
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly compileResult: TargetCompileResult;
}

export interface TargetToolchainResult {
  readonly diagnostics: readonly string[];
  readonly producedArtifacts: readonly string[];
}

export interface TargetToolchain {
  prepare(input: TargetToolchainInput): TargetToolchainResult;
}

export interface TargetProvider {
  readonly id: string;
  readonly displayName: string;
  readonly moduleOwnership?: readonly TargetProviderModuleOwnership[];
  sourceProfileContributions?(context: TargetProviderSourceProfileContext): TargetSourceProfileContributions;
  sourceCompilerContributions(context: TargetProviderContext): TargetSourceCompilerContributions;
  runtimeContributions?(context: TargetRuntimeContributionContext): TargetRuntimeContributions;
}

export type TargetCapabilityImplementation = TsonicTargetCapabilityPlugin;
export type TargetCapabilityRuntimeContext = TargetCapabilityRuntimeContributionContext;

export interface TargetSurfaceImplementation {
  readonly id: TargetSurfaceId;
  readonly displayName: string;
  readonly requiredSurfaces?: readonly TargetSurfaceId[];
  sourceProfileContributions?(context: TargetSurfaceSourceProfileContext): TargetSourceProfileContributions;
  sourceCompilerContributions?(context: TargetSurfaceSourceCompilerContext): TargetSourceCompilerContributions;
  runtimeContributions(context: TargetRuntimeContributionContext): TargetRuntimeContributions;
}

export interface TargetPack {
  readonly id: string;
  readonly displayName: string;
  readonly provider?: TargetProvider;
  readonly surfaces?: readonly TargetSurfaceImplementation[];
  createBackend(context: TargetBackendContext): TargetBackend;
  createToolchain(context: TargetToolchainContext): TargetToolchain;
}
