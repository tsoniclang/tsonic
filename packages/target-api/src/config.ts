export type TargetId = string;

export type TargetSurfaceId = string;

export type TargetTypescriptCompatibilityMode = "strict-native" | "compat";

export interface TargetSelectionOptions extends Readonly<Record<string, unknown>> {
  readonly typescriptCompatibility?: TargetTypescriptCompatibilityMode;
}

export interface TargetSelection {
  readonly id: TargetId;
  readonly surfaces?: readonly TargetSurfaceId[];
  readonly options?: TargetSelectionOptions;
}

export interface TsonicProjectConfig {
  readonly entryPoint: string;
  readonly rootFiles?: readonly string[];
  readonly rootDir?: string;
  readonly outDir?: string;
  readonly targets: readonly TargetSelection[];
}

const targetIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

export function isValidTargetId(value: string): value is TargetId {
  return targetIdPattern.test(value);
}

export function isValidTargetSurfaceId(value: string): value is TargetSurfaceId {
  return targetIdPattern.test(value);
}

export function getTargetIdValidationMessage(subject: string): string {
  return `${subject} must match ${targetIdPattern.source}; use lowercase ASCII letters, digits, and single hyphen-separated segments.`;
}
