import type { ExtensionDiagnostic, Node } from "@tsonic/tsts";
export type TargetArtifactKind = "source" | "project" | "configuration" | "asset";
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
export declare class TargetCompilerResourceLimitFailure extends Error {
    readonly diagnostic: TargetDiagnostic;
    constructor(source: string, subject: string, dimension: string, limit: number, sourceNode?: Node);
}
export declare function failTargetCompilerResourceLimit(source: string, subject: string, dimension: string, limit: number, sourceNode?: Node): never;
export declare function targetDiagnosticFromExtension(node: Node | undefined, diagnostic: ExtensionDiagnostic): TargetDiagnostic;
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
export type TargetStageResult<T> = {
    readonly kind: "resolved";
    readonly value: T;
    readonly diagnostics: readonly TargetDiagnostic[];
} | {
    readonly kind: "rejected";
    readonly diagnostics: readonly TargetDiagnostic[];
};
export type TargetCompileResult = TargetStageResult<TargetCompileOutput>;
export interface TargetCompilationStages<Program, Plan> {
    readonly analyze: () => TargetStageResult<Program>;
    readonly plan: (program: Program) => TargetStageResult<Plan>;
    readonly materialize: (plan: Plan) => TargetCompileOutput;
    readonly compilerResourceFailure?: (failure: unknown) => TargetCompilerResourceLimitFailure | undefined;
}
export interface TargetCompilationObserver<Program, Plan> {
    readonly analyzed?: (program: Program) => void;
    readonly planned?: (plan: Plan) => void;
}
export declare function failTargetAnalysisInvariant(source: string, message: string, sourceNode?: Node): never;
export declare function failTargetPlannerInvariant(source: string, message: string, sourceNode?: Node): never;
export declare function resolvedTargetStage<T>(value: T, diagnostics?: readonly TargetDiagnostic[]): TargetStageResult<T>;
export declare function rejectedTargetStage<T>(diagnostics: readonly TargetDiagnostic[]): TargetStageResult<T>;
export declare function runTargetCompilationStages<Program, Plan>(stages: TargetCompilationStages<Program, Plan>, observer?: TargetCompilationObserver<Program, Plan>): TargetCompileResult;
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
//# sourceMappingURL=artifacts.d.ts.map