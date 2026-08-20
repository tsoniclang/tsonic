import type { Node } from "@tsonic/tsts";

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
  readonly sourceNode?: Node;
  readonly sourceSpan?: TargetDiagnosticSourceSpan;
  readonly evidence?: readonly string[];
}

export interface TargetDiagnosticSourceSpan {
  readonly fileName: string;
  readonly line: number;
  readonly column: number;
  readonly endLine: number;
  readonly endColumn: number;
}

export interface TargetCompileOutput {
  readonly artifacts: readonly TargetArtifact[];
}

export type TargetStageResult<T> =
  | {
      readonly kind: "resolved";
      readonly value: T;
      readonly diagnostics: readonly TargetDiagnostic[];
    }
  | {
      readonly kind: "rejected";
      readonly diagnostics: readonly TargetDiagnostic[];
    };

export type TargetCompileResult = TargetStageResult<TargetCompileOutput>;

export interface TargetCompilationStages<Program, Plan> {
  readonly analyze: () => TargetStageResult<Program>;
  readonly plan: (program: Program) => TargetStageResult<Plan>;
  readonly materialize: (plan: Plan) => TargetCompileOutput;
}

export function resolvedTargetStage<T>(
  value: T,
  diagnostics: readonly TargetDiagnostic[] = [],
): TargetStageResult<T> {
  if (diagnostics.some((diagnostic) => diagnostic.category === "error")) {
    throw new Error("A resolved target stage cannot contain an error diagnostic.");
  }
  return Object.freeze({
    kind: "resolved",
    value,
    diagnostics: Object.freeze([...diagnostics]),
  });
}

export function rejectedTargetStage<T>(
  diagnostics: readonly TargetDiagnostic[],
): TargetStageResult<T> {
  if (!diagnostics.some((diagnostic) => diagnostic.category === "error")) {
    throw new Error("A rejected target stage must contain at least one error diagnostic.");
  }
  return Object.freeze({
    kind: "rejected",
    diagnostics: Object.freeze([...diagnostics]),
  });
}

export function runTargetCompilationStages<Program, Plan>(
  stages: TargetCompilationStages<Program, Plan>,
): TargetCompileResult {
  const analysis = stages.analyze();
  if (analysis.kind === "rejected") {
    return rejectedTargetStage(analysis.diagnostics);
  }
  const planning = stages.plan(analysis.value);
  const diagnostics = Object.freeze([
    ...analysis.diagnostics,
    ...planning.diagnostics,
  ]);
  if (planning.kind === "rejected") {
    return rejectedTargetStage(diagnostics);
  }
  return resolvedTargetStage(stages.materialize(planning.value), diagnostics);
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
