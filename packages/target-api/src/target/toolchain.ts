import type {
  TargetCompileOutput,
} from "../artifacts.js";
import type {
  TargetSelection,
  TsonicProjectConfig,
} from "../config.js";

export interface TargetToolchainInput {
  readonly artifactsRoot: string;
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
  readonly compileOutput: TargetCompileOutput;
}

export interface TargetToolchainResult {
  readonly diagnostics: readonly string[];
  readonly producedArtifacts: readonly string[];
}

export interface TargetToolchain {
  prepare(input: TargetToolchainInput): TargetToolchainResult;
}

export interface TargetToolchainContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
}
