import type {
  TargetCompilationSession,
  TargetCompilationSessionContext,
} from "./compilation.js";
import type {
  TargetProviderDescriptor,
  TargetSurfaceImplementation,
  TsonicTargetCapabilityPlugin,
} from "./composition.js";
import type {
  TargetToolchain,
  TargetToolchainContext,
} from "./toolchain.js";

export type TsonicPlugin =
  | TsonicTargetPlugin
  | TsonicTargetCapabilityPlugin;

export interface TsonicTargetPlugin {
  readonly kind: "target";
  readonly id: string;
  readonly targetId: string;
  createTargetPack(): TargetPack;
}

export interface TargetPack {
  readonly id: string;
  readonly displayName: string;
  readonly provider: TargetProviderDescriptor;
  readonly surfaces: readonly TargetSurfaceImplementation[];
  createCompilationSession(
    context: TargetCompilationSessionContext,
  ): TargetCompilationSession;
  createToolchain(context: TargetToolchainContext): TargetToolchain;
}
