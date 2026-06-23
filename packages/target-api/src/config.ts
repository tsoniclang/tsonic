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
  readonly rootDir?: string;
  readonly outDir?: string;
  readonly targets: readonly TargetSelection[];
}
