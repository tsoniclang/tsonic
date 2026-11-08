import type { Diagnostic } from "../../ast/diagnostic.js";
import type { Node } from "../../ast/spine.js";
import type { ResolvedCallApplicationEvidence, ResolvedCheckedComponentEvidence, ResolvedCheckerBackingConstraint, ResolvedCheckerDiagnosticCoverage, Signature, Type } from "../types.js";
import type { Checker } from "./state.js";
type ConstraintBody = ResolvedCheckerBackingConstraint extends infer Constraint ? Constraint extends ResolvedCheckerBackingConstraint ? Omit<Constraint, "diagnostic"> : never : never;
interface ConstraintFrame {
    readonly body: ConstraintBody;
    readonly diagnostics: Diagnostic[];
}
interface ConstraintRecord {
    readonly body: ConstraintBody;
    readonly diagnostic: Diagnostic;
    root: Diagnostic;
    readonly candidate: Signature | undefined;
    readonly tree: ReadonlyMap<Diagnostic, DiagnosticEdges>;
}
interface DiagnosticEdges {
    readonly messages: readonly (Diagnostic | undefined)[];
    readonly related: readonly (Diagnostic | undefined)[];
}
interface InvocationObservation {
    readonly invocation: Node;
    readonly diagnostics: Set<Diagnostic>;
}
export interface BackingConstraintEvidenceState {
    readonly frames: ConstraintFrame[];
    readonly records: ConstraintRecord[];
    readonly candidates: ResolvedCallApplicationEvidence[];
    readonly roots: Map<Diagnostic, ConstraintRecord[]>;
    readonly invocations: Map<Node, Map<ResolvedCallApplicationEvidence, ConstraintRecord[]>>;
    readonly diagnosticCaptures: Diagnostic[][];
    readonly origins: Map<Diagnostic, ConstraintRecord[]>;
    readonly envelopes: Map<Diagnostic, DiagnosticEdges>;
    readonly notes: Map<Diagnostic, Diagnostic[]>;
    readonly noteTrees: Map<Diagnostic, ReadonlyMap<Diagnostic, DiagnosticEdges>>;
    readonly applicability: Set<ConstraintRecord>;
    readonly applicabilityRoots: Map<Diagnostic, Node>;
    readonly invocationFrames: InvocationObservation[];
    readonly invocationDiagnostics: Map<Node, Set<Diagnostic>>;
    revision: number;
    cachedRevision: number;
    cached: readonly ResolvedCheckerBackingConstraint[];
}
export declare function checkedComponent(node: Node, type: Type, kind?: "value" | "annotation" | "declaration"): ResolvedCheckedComponentEvidence;
export declare function withBackingConstraint<Output>(checker: Checker, body: ConstraintBody, operation: () => Output): Output;
export declare function withBackingCandidate<Output>(checker: Checker, application: ResolvedCallApplicationEvidence, operation: () => Output): Output;
export declare function withBackingApplicabilityConstraint<Output>(checker: Checker, body: ConstraintBody, diagnostics: readonly (Diagnostic | undefined)[] | undefined, operation: () => Output): Output;
export declare function beginBackingInvocation(checker: Checker, invocation: Node): InvocationObservation;
export declare function endBackingInvocation(checker: Checker, observation: InvocationObservation | undefined): void;
export declare function retainCallApplicabilityDiagnostics(checker: Checker, invocation: Node, diagnostics: readonly Diagnostic[]): void;
export declare function activeBackingCandidate(checker: Checker): ResolvedCallApplicationEvidence | undefined;
export declare function capturePublishedDiagnostics(checker: Checker, operation: () => void): readonly Diagnostic[];
export declare function observePublishedDiagnostic(checker: Checker, diagnostic: Diagnostic | undefined): void;
export declare function retainBackingDiagnosticEnvelope(checker: Checker, diagnostic: Diagnostic): void;
export declare function retainBackingDiagnosticNotes(checker: Checker, diagnostic: Diagnostic, notes: readonly (Diagnostic | undefined)[]): void;
export declare function checkerDiagnosticCoverage(checker: Checker, root: Diagnostic): ResolvedCheckerDiagnosticCoverage;
export declare function withBackingWriteFit<Output>(checker: Checker, expression: Node | undefined, source: Type | undefined, target: Type | undefined, operation: () => Output): Output;
export declare function withBackingTypeArgumentFit<Output>(checker: Checker, argument: Node | undefined, source: Type | undefined, parameter: Type | undefined, target: Type | undefined, application: ResolvedCallApplicationEvidence | undefined, diagnostics: readonly (Diagnostic | undefined)[] | undefined, operation: () => Output): Output;
export declare function observeBackingDiagnostic(checker: Checker, diagnostic: Diagnostic | undefined): void;
export declare function checkerBackingConstraints(checker: Checker, application?: ResolvedCallApplicationEvidence): readonly ResolvedCheckerBackingConstraint[];
export {};
//# sourceMappingURL=backing-constraint-evidence.d.ts.map