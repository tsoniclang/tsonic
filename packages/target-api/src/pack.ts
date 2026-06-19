import type {
  CompilerExtension,
  ExtensionConsumerQueries,
  Program,
  SourceFile,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import type { TargetCompileResult } from "./artifacts.js";
import type { TargetSelection, TsonicProjectConfig } from "./config.js";

export interface TargetExtensionContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
}

export interface TargetBackendContext {
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
}

export interface TargetCompileInput {
  readonly program: Program;
  readonly sourceFiles: readonly SourceFile[];
  readonly checker: TypeCheckerQueries;
  readonly facts: ExtensionConsumerQueries;
  readonly project: TsonicProjectConfig;
  readonly target: TargetSelection;
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

export interface TargetPack {
  readonly id: string;
  readonly displayName: string;
  createExtensions(context: TargetExtensionContext): readonly CompilerExtension[];
  createBackend(context: TargetBackendContext): TargetBackend;
  createToolchain(context: TargetBackendContext): TargetToolchain;
}
