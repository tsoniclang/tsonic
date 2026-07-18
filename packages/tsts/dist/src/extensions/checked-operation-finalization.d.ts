import type { CheckedOperationObservationPointName, CheckedOperationReference, ExtensionObservationPhase, ExtensionObservationRequest, ExtensionObservationResponse, ExtensionObservationResult } from "./observations.js";
import type { ExtensionFactSubject } from "./host.js";
import { type CheckedOperationRequestSnapshotCache } from "./checked-operation-value-snapshot.js";
export type CheckedOperationApplyOutcome = {
    readonly kind: "applied";
} | {
    readonly kind: "deferred";
    readonly unresolved: CheckedOperationReference;
} | {
    readonly kind: "unavailable";
};
export interface CheckedOperationInventoryCallbacks {
    readonly beginAttempt: () => unknown;
    readonly captureAttemptEffects: (attempt: unknown) => unknown;
    readonly applyAttemptEffects: (attempt: unknown, effects: unknown) => void;
    readonly commitAttempt: (attempt: unknown) => void;
    readonly rollbackAttempt: (attempt: unknown) => void;
    readonly discardAttemptPreservingDiagnostics: (attempt: unknown) => void;
    readonly deferAttemptPreservingOperations: (attempt: unknown) => readonly CheckedOperationReference[];
    readonly onRequestConflict: (observation: CheckedOperationObservationPointName, subject: ExtensionFactSubject, existing: ExtensionObservationRequest<CheckedOperationObservationPointName>, incoming: ExtensionObservationRequest<CheckedOperationObservationPointName>) => void;
    readonly onDependencyConflict: (observation: CheckedOperationObservationPointName, subject: ExtensionFactSubject) => void;
    readonly onAtomicOwnerConflict: (observation: CheckedOperationObservationPointName, subject: ExtensionFactSubject) => void;
    readonly onUnresolved: (observation: CheckedOperationObservationPointName, subject: ExtensionFactSubject) => void;
    readonly onFatalFailure: (error: Error) => void;
}
export declare class CheckedOperationInventory {
    #private;
    constructor(callbacks: CheckedOperationInventoryCallbacks);
    run<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, request: ExtensionObservationRequest<TObservation>, evaluate: (request: ExtensionObservationRequest<TObservation>, phase: ExtensionObservationPhase) => ExtensionObservationResult<ExtensionObservationResponse<TObservation>>, apply: (result: ExtensionObservationResult<ExtensionObservationResponse<TObservation>>, request: ExtensionObservationRequest<TObservation>) => void | CheckedOperationApplyOutcome, phase: ExtensionObservationPhase, requestSnapshotCache?: CheckedOperationRequestSnapshotCache, dependencies?: readonly CheckedOperationReference[], atomicOwner?: CheckedOperationReference): ExtensionObservationResult<ExtensionObservationResponse<TObservation>>;
    getRequest<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, subject: ExtensionFactSubject | undefined, reference?: CheckedOperationReference<TObservation>): ExtensionObservationRequest<TObservation> | undefined;
    getReference(subject: ExtensionFactSubject | undefined): CheckedOperationReference | undefined;
    finalize(): void;
    releaseRetainedEffects(): void;
    createSavepoint(): number;
    rollbackToSavepoint(recordCount: number): void;
    deferFromSavepoint(recordCount: number): readonly CheckedOperationReference[];
}
export declare class CheckedOperationReferenceIndex {
    #private;
    add(reference: CheckedOperationReference): boolean;
}
//# sourceMappingURL=checked-operation-finalization.d.ts.map