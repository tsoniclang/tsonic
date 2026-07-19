import type { CheckedOperationObservationPointName, CheckedOperationReference, ExtensionObservationPhase, ExtensionObservationRequest, ExtensionObservationResponse, ExtensionObservationResult } from "./observations.js";
import type { ExtensionFactSubject } from "./host.js";
import { type CheckedOperationRequestSnapshotCache } from "./checked-operation-value-snapshot.js";
type AnyCheckedOperationResult = ExtensionObservationResult<unknown>;
type AcceptedCheckedOperationResult = Extract<AnyCheckedOperationResult, {
    readonly kind: "accept";
}>;
type RejectedCheckedOperationResult = Extract<AnyCheckedOperationResult, {
    readonly kind: "reject";
}>;
export type CheckedOperationApplyOutcome = {
    readonly kind: "applied";
} | {
    readonly kind: "deferred";
    readonly unresolved: CheckedOperationReference;
} | {
    readonly kind: "unavailable";
};
declare const checkedOperationUnavailableResult: Readonly<{
    kind: "checked-operation-apply-unavailable";
}>;
type CheckedOperationUnavailableResult = typeof checkedOperationUnavailableResult;
type RetainedCheckedOperationResult = AnyCheckedOperationResult | CheckedOperationUnavailableResult;
interface CheckedOperationRecord {
    readonly observation: CheckedOperationObservationPointName;
    readonly subject: ExtensionFactSubject;
    readonly reference: CheckedOperationReference;
    readonly request: ExtensionObservationRequest<CheckedOperationObservationPointName>;
    readonly dependencies: readonly CheckedOperationReference[];
    readonly atomicOwner?: CheckedOperationReference;
    allDependencies: readonly CheckedOperationReference[];
    dependencyIndex: CheckedOperationReferenceIndex;
    readonly evaluate: (phase: ExtensionObservationPhase) => AnyCheckedOperationResult;
    readonly apply: (result: AnyCheckedOperationResult) => void | CheckedOperationApplyOutcome;
    result?: RetainedCheckedOperationResult;
    pendingAcceptedResult?: AcceptedCheckedOperationResult;
    acceptedEffects?: unknown;
    unresolved?: CheckedOperationReference;
    unresolvedReported: boolean;
    rejectionPublished: boolean;
    checkingAttempted: boolean;
    finalizationAttempts: number;
    state: "evaluating" | "deferred" | "accepted" | "unavailable";
}
interface CheckedOperationRecordSnapshot {
    readonly hasResult: boolean;
    readonly result: RetainedCheckedOperationResult | undefined;
    readonly hasPendingAcceptedResult: boolean;
    readonly pendingAcceptedResult: AcceptedCheckedOperationResult | undefined;
    readonly hasAcceptedEffects: boolean;
    readonly acceptedEffects: unknown;
    readonly hasUnresolved: boolean;
    readonly unresolved: CheckedOperationReference | undefined;
    readonly unresolvedReported: boolean;
    readonly rejectionPublished: boolean;
    readonly checkingAttempted: boolean;
    readonly finalizationAttempts: number;
    readonly state: CheckedOperationRecord["state"];
    readonly allDependencies: readonly CheckedOperationReference[];
}
interface CheckedOperationSavepoint {
    readonly recordCount: number;
    readonly snapshots: Map<CheckedOperationRecord, CheckedOperationRecordSnapshot>;
    readonly edgeCount: number;
    readonly checkingRecordCursor: number;
    readonly owner?: CheckedOperationRecord;
    commitRequested: boolean;
    active: boolean;
}
export interface CheckedOperationInventoryCallbacks {
    readonly beginAttempt: () => unknown;
    readonly captureAttemptEffects: (attempt: unknown) => unknown;
    readonly applyAttemptEffects: (attempt: unknown, effects: unknown) => void;
    readonly commitAttempt: (attempt: unknown) => void;
    readonly rollbackAttempt: (attempt: unknown) => void;
    readonly discardAttemptPreservingDiagnostics: (attempt: unknown) => void;
    readonly rollbackAttemptPreservingOperations: (attempt: unknown) => readonly CheckedOperationReference[];
    readonly publishRejectedDiagnostic: (result: RejectedCheckedOperationResult) => void;
    readonly onRequestConflict: (observation: CheckedOperationObservationPointName, subject: ExtensionFactSubject, existing: ExtensionObservationRequest<CheckedOperationObservationPointName>, incoming: ExtensionObservationRequest<CheckedOperationObservationPointName>) => void;
    readonly onDependencyConflict: (observation: CheckedOperationObservationPointName, subject: ExtensionFactSubject) => void;
    readonly onAtomicOwnerConflict: (observation: CheckedOperationObservationPointName, subject: ExtensionFactSubject) => void;
    readonly onUnresolved: (observation: CheckedOperationObservationPointName, subject: ExtensionFactSubject) => void;
    readonly onFatalFailure: (error: Error) => void;
}
export interface CheckedOperationInventoryLimits {
    readonly records: number;
    readonly edges: number;
    readonly savepointDepth: number;
    readonly activeSnapshots: number;
    readonly snapshotWork: number;
    readonly finalizationWork: number;
}
export declare class CheckedOperationInventory {
    #private;
    constructor(callbacks: CheckedOperationInventoryCallbacks, limits?: Partial<CheckedOperationInventoryLimits>);
    run<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, request: ExtensionObservationRequest<TObservation>, evaluate: (request: ExtensionObservationRequest<TObservation>, phase: ExtensionObservationPhase) => ExtensionObservationResult<ExtensionObservationResponse<TObservation>>, apply: (result: ExtensionObservationResult<ExtensionObservationResponse<TObservation>>, request: ExtensionObservationRequest<TObservation>) => void | CheckedOperationApplyOutcome, phase: ExtensionObservationPhase, requestSnapshotCache?: CheckedOperationRequestSnapshotCache, dependencies?: readonly CheckedOperationReference[], atomicOwner?: CheckedOperationReference): ExtensionObservationResult<ExtensionObservationResponse<TObservation>>;
    retain<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, request: ExtensionObservationRequest<TObservation>, evaluate: (request: ExtensionObservationRequest<TObservation>, phase: ExtensionObservationPhase) => ExtensionObservationResult<ExtensionObservationResponse<TObservation>>, apply: (result: ExtensionObservationResult<ExtensionObservationResponse<TObservation>>, request: ExtensionObservationRequest<TObservation>) => void | CheckedOperationApplyOutcome, requestSnapshotCache?: CheckedOperationRequestSnapshotCache, dependencies?: readonly CheckedOperationReference[]): CheckedOperationReference<TObservation>;
    getRequest<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, subject: ExtensionFactSubject | undefined, reference?: CheckedOperationReference<TObservation>): ExtensionObservationRequest<TObservation> | undefined;
    getReference(subject: ExtensionFactSubject | undefined): CheckedOperationReference | undefined;
    evaluateRetainedChecking(): void;
    finalize(): void;
    prepareFinalization(): void;
    commitFinalization(): void;
    createSavepoint(): CheckedOperationSavepoint;
    commitSavepoint(savepoint: CheckedOperationSavepoint): readonly CheckedOperationReference[];
    rollbackToSavepoint(savepoint: CheckedOperationSavepoint): void;
    preserveFromSavepoint(savepoint: CheckedOperationSavepoint): readonly CheckedOperationReference[];
}
export declare class CheckedOperationReferenceIndex {
    #private;
    add(reference: CheckedOperationReference): boolean;
}
export {};
//# sourceMappingURL=checked-operation-finalization.d.ts.map