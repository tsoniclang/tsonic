import { createCompilerSession } from "@tsonic/tsts";
import type {
  CheckedSourceProgram,
  ProgramOptions,
} from "@tsonic/tsts";
import type {
  TargetPack,
  TargetSelection,
  TargetSourceCompilerContributions,
  TargetSourcePackageGraph,
  TargetSurfaceImplementation,
  TsonicProjectConfig,
} from "@tsonic/target-api";
import type {
  TargetCapabilityImplementation,
} from "@tsonic/target-api/provider";
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
}

export interface CheckedTargetSource {
  readonly source: CheckedSourceProgram;
  readonly sourcePackages: TargetSourcePackageGraph;
}

export function checkTargetSource(
  options: CheckTargetSourceOptions,
): CheckedTargetSource {
  const composition = createTargetSourceCompilerComposition({
    project: options.project,
    projectDirectory: options.projectDirectory,
    target: options.target,
    targetPack: options.targetPack,
    selectedCapabilities: options.selectedCapabilities,
    selectedSurfaces: options.selectedSurfaces,
    targetContributions: options.targetContributions,
  });
  const compiler = createCompilerSession({
    programOptions: options.programOptions,
    extensionHostOptions: {
      extensions: composition.extensions,
      requiredProviderModules: getTargetRequiredProviderModules(
        options.target,
        options.targetPack.provider,
        options.selectedCapabilities,
      ),
    },
  });
  return Object.freeze({
    source: compiler.checkSource(),
    sourcePackages: options.sourcePackages,
  });
}
