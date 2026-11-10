import { createCompilerSession, createCompilerSessionFromFiles } from "@tsonic/tsts";
import type {
  CheckedSourceProgram,
  ProgramOptions,
} from "@tsonic/tsts";
import type {
  TargetPack,
  TargetSelection,
  TargetSourceCompilerContributions,
  TargetSourceSafetyProvider,
  TargetSourcePackageGraph,
  TargetSurfaceImplementation,
  TsonicProjectConfig,
} from "@tsonic/target-api";
import type {
  TargetCapabilityImplementation,
} from "@tsonic/target-api/provider";
import { rejectedTargetStage, resolvedTargetStage, type TargetStageResult } from "@tsonic/target-api/artifacts";
import type { TargetSourceProgram } from "@tsonic/target-api/source";
import type { CollectedTargetSourceProfile } from "./target/source-profile.js";
import { createHostSourceProgram } from "./host-input/program.js";
import { collectTstsDiagnostics, targetCompilationBoundary } from "./diagnostics.js";
import {
  createTargetSourceCompilerComposition,
  getTargetRequiredProviderModules,
} from "./target/extensions.js";

export interface CheckTargetSourceOptions {
  readonly programOptions: ProgramOptions;
  readonly sourcePackages: TargetSourcePackageGraph;
  readonly project: TsonicProjectConfig;
  readonly projectDirectory: string;
  readonly target: TargetSelection;
  readonly targetPack: TargetPack;
  readonly selectedCapabilities: readonly TargetCapabilityImplementation[];
  readonly selectedSurfaces: readonly TargetSurfaceImplementation[];
  readonly targetContributions: TargetSourceCompilerContributions;
  readonly sourceProfile: CollectedTargetSourceProfile;
  readonly currentDirectory: string;
}

export interface CheckedTargetSource {
  readonly source: CheckedSourceProgram;
  readonly sourcePackages: TargetSourcePackageGraph;
  readonly adjudicated: TargetStageResult<TargetSourceProgram>;
}

export interface CheckTargetSourceFilesOptions extends Omit<CheckTargetSourceOptions, "programOptions" | "sourcePackages"> {
  readonly currentDirectory: string;
  readonly files: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  readonly rootFiles?: readonly string[];
  readonly configFileName?: string;
  readonly compilerOptions?: Readonly<Record<string, unknown>>;
}

export function checkTargetSource(
  options: CheckTargetSourceOptions,
): CheckedTargetSource {
  const composition = sourceCompilerComposition(options);
  const compiler = createCompilerSession({
    programOptions: options.programOptions,
    extensionHostOptions: composition.extensionHostOptions,
  });
  const source = compiler.checkSource();
  return Object.freeze({
    source,
    sourcePackages: options.sourcePackages,
    adjudicated: adjudicateCheckedSource(() => source, options.currentDirectory, options.sourceProfile, options.targetPack.id, composition.safetyProviders),
  });
}

export function checkTargetSourceFiles(options: CheckTargetSourceFilesOptions): TargetStageResult<TargetSourceProgram> {
  if (options.sourceProfile.diagnostics.some(diagnostic => diagnostic.category === "error"))
    return rejectedTargetStage(options.sourceProfile.diagnostics);
  const files = options.files instanceof Map ? new Map(options.files) : new Map(Object.entries(options.files));
  for (const file of options.sourceProfile.files) files.set(file.path, file.text);
  const composition = sourceCompilerComposition(options);
  const compiler = createCompilerSessionFromFiles({
    currentDirectory: options.currentDirectory,
    files,
    ...(options.rootFiles === undefined ? {} : { rootFiles: options.rootFiles }),
    ...(options.configFileName === undefined ? {} : { configFileName: options.configFileName }),
    ...(options.compilerOptions === undefined ? {} : { compilerOptions: { ...options.compilerOptions } }),
    extensionHostOptions: composition.extensionHostOptions,
  });
  return adjudicateCheckedSource(() => compiler.checkSource(), options.currentDirectory, options.sourceProfile, options.targetPack.id, composition.safetyProviders);
}

function sourceCompilerComposition(options: Omit<CheckTargetSourceOptions, "programOptions" | "sourcePackages">) {
  const composition = createTargetSourceCompilerComposition({
    project: options.project,
    projectDirectory: options.projectDirectory,
    target: options.target,
    targetPack: options.targetPack,
    selectedCapabilities: options.selectedCapabilities,
    selectedSurfaces: options.selectedSurfaces,
    targetContributions: options.targetContributions,
  });
  return Object.freeze({
    safetyProviders: composition.safetyProviders,
    extensionHostOptions: Object.freeze({
      extensions: composition.extensions,
      requiredProviderModules: getTargetRequiredProviderModules(options.target, options.targetPack.provider, options.selectedCapabilities),
    }),
  });
}

function adjudicateCheckedSource(readCheckedSource: () => CheckedSourceProgram, currentDirectory: string,
  profile: CollectedTargetSourceProfile, targetId: string,
  safetyProviders: readonly TargetSourceSafetyProvider[]): TargetStageResult<TargetSourceProgram> {
  let checked: CheckedSourceProgram | undefined;
  return targetCompilationBoundary(targetId, () => {
    checked = readCheckedSource();
    void checked.diagnostics;
    const assembled = createHostSourceProgram({ checked, apiFacts: profile.apiFacts, profileFiles: profile.files, safetyProviders });
    const diagnostics = Object.freeze([...profile.diagnostics,
      ...collectTstsDiagnostics(checked, currentDirectory, assembled.dischargedDiagnostics)]);
    return diagnostics.some(diagnostic => diagnostic.category === "error")
      ? rejectedTargetStage(diagnostics) : resolvedTargetStage(assembled.source, diagnostics);
  }, diagnostic => rejectedTargetStage(Object.freeze([...profile.diagnostics,
    ...(checked === undefined ? [] : collectTstsDiagnostics(checked, currentDirectory)), diagnostic])));
}
