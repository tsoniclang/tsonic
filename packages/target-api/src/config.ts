export type TargetId = string;

export interface TargetSelection {
  readonly id: TargetId;
  readonly options?: Readonly<Record<string, unknown>>;
}

export interface TsonicProjectConfig {
  readonly entryPoint: string;
  readonly rootDir?: string;
  readonly outDir?: string;
  readonly targets: readonly TargetSelection[];
}
