import type { TargetId, TargetSelectionOptions } from "../config.js";

export interface TargetStarterProjectContext {
  readonly projectName: string;
}

export interface TargetStarterFile {
  readonly path: string;
  readonly contents: string;
}

export interface TargetStarterScripts {
  readonly build: string;
  readonly start: string;
  readonly check: string;
}

export interface TargetStarterSelection {
  readonly id: TargetId;
  readonly options: TargetSelectionOptions;
}

export interface TargetStarterRequirementCheck {
  readonly command: string;
  readonly args: readonly string[];
  readonly expectedOutputPattern?: string;
}

export interface TargetStarterRequirement {
  readonly id: string;
  readonly displayName: string;
  readonly checks: readonly TargetStarterRequirementCheck[];
  readonly installUrl: string;
  readonly installInstructions: string;
}

export interface TargetStarterProject {
  readonly target: TargetStarterSelection;
  readonly scripts: TargetStarterScripts;
  readonly files: readonly TargetStarterFile[];
  readonly requirements: readonly TargetStarterRequirement[];
}
