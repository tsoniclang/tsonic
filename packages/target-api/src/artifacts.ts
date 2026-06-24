export type TargetArtifactKind =
  | "source"
  | "project"
  | "configuration"
  | "asset";

export interface TargetArtifact {
  readonly kind: TargetArtifactKind;
  readonly path: string;
  readonly text: string;
}

export interface TargetSourceFile extends TargetArtifact {
  readonly kind: "source";
  readonly language: string;
}

export interface TargetDiagnostic {
  readonly code: string;
  readonly category: "error" | "warning" | "suggestion";
  readonly message: string;
  readonly source?: string;
  readonly evidence?: readonly string[];
}

export interface TargetCompileResult {
  readonly artifacts: readonly TargetArtifact[];
  readonly diagnostics: readonly TargetDiagnostic[];
}

export interface TargetRuntimeContributions {
  readonly artifacts?: readonly TargetArtifact[];
  readonly references?: readonly TargetRuntimeReference[];
}

export interface TargetRuntimeReference {
  readonly kind: string;
  readonly include: string;
  readonly version?: string;
  readonly attributes?: Readonly<Record<string, string>>;
}
