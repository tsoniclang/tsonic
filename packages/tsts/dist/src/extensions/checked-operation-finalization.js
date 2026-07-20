import { ExtensionObservationPoint } from "./observations.js";
import { targetCallArgumentConversionSlotEquals } from "./fact-value-equality.js";
import { checkedOperationRequestEquals } from "./checked-operation-request-equality.js";
import { encodeIdentityTuple } from "./identity-tuple.js";
import { snapshotCheckedOperationRequestWithMetrics, snapshotCheckedOperationResult, snapshotTargetCallArgumentConversionSlot, } from "./checked-operation-value-snapshot.js";
const checkedOperationApplied = Object.freeze({ kind: "applied" });
const checkedOperationUnavailableResult = Object.freeze({ kind: "checked-operation-apply-unavailable" });
const checkedPrimaryOperationObservationOrder = Object.freeze([
    ExtensionObservationPoint.mapCheckedCall,
    ExtensionObservationPoint.mapCheckedPropertyAccess,
    ExtensionObservationPoint.mapCheckedElementAccess,
    ExtensionObservationPoint.mapCheckedOperator,
    ExtensionObservationPoint.mapCheckedIteration,
]);
const defaultCheckedOperationInventoryLimits = Object.freeze({
    records: 1_048_576,
    edges: 4_194_304,
    savepointDepth: 4_096,
    activeSnapshots: 4_194_304,
    snapshotWork: 268_435_456,
    retainedSnapshotUnits: 67_108_864,
    retainedScalarCodeUnits: 67_108_864,
    finalizationWork: 67_108_864,
});
export class CheckedOperationInventory {
    #records = [];
    #recordPositions = new WeakMap();
    #recordsBySubject = new WeakMap();
    #ownedRecordsByOwnerSubject = new WeakMap();
    #callbacks;
    #limits;
    #executionFrames = [];
    #savepoints = [];
    #edgeCount = 0;
    #checkingRecordCursor = 0;
    #activeSnapshotCount = 0;
    #snapshotWork = 0;
    #retainedSnapshotUnits = 0;
    #retainedScalarCodeUnits = 0;
    #finalizationWork = 0;
    #openingAttemptFor;
    #preparedSavepoint;
    #failure;
    #state = "open";
    constructor(callbacks, limits = {}) {
        this.#callbacks = callbacks;
        this.#limits = snapshotCheckedOperationInventoryLimits(limits);
    }
    run(observation, request, evaluate, apply, phase, requestSnapshotCache, dependencies = [], atomicOwner) {
        const prepared = this.#prepareRecord(observation, request, evaluate, apply, requestSnapshotCache, dependencies, atomicOwner);
        if (prepared.conflict !== undefined) {
            return prepared.conflict;
        }
        const record = prepared.record;
        if (!prepared.created) {
            if (record.state === "evaluating") {
                const error = new Error(`Checked operation '${observation}' re-entered while its selected mapping was being evaluated.`);
                this.#fail(error);
                throw error;
            }
            if (record.result === undefined) {
                throw new Error("Active checked operation has no observation result.");
            }
            const enclosingApplication = this.#executionFrames[this.#executionFrames.length - 1];
            if (record.state === "deferred"
                && (record.atomicOwner !== undefined || enclosingApplication?.stage === "applying")) {
                const dependencyReadiness = this.#dependencyReadiness(record, false);
                if (dependencyReadiness === "blocked") {
                    this.#markUnavailable(record);
                    this.#settleOwnedRecords(record);
                }
                else if (dependencyReadiness === "ready") {
                    this.#journalRecord(record);
                    record.state = "evaluating";
                    const resumedResult = this.#runAttempt(record, phase);
                    this.#throwIfFailed();
                    record.result = resumedResult;
                    this.#setResultState(record, resumedResult);
                    this.#terminalizeFinalizationMapperDeferral(record, resumedResult, phase);
                    this.#settleOwnedRecords(record);
                }
            }
            return record.result;
        }
        this.#journalRecord(record);
        record.state = "evaluating";
        try {
            const dependencyReadiness = this.#dependencyReadiness(record, false);
            if (dependencyReadiness !== "ready") {
                const deferred = dependencyDeferredResult(observation);
                record.result = deferred;
                if (dependencyReadiness === "blocked") {
                    this.#markUnavailable(record);
                }
                else {
                    record.state = "deferred";
                }
                return deferred;
            }
            const initialResult = this.#runAttempt(record, phase);
            this.#throwIfFailed();
            record.result = initialResult;
            this.#setResultState(record, initialResult);
            this.#terminalizeFinalizationMapperDeferral(record, initialResult, phase);
            this.#settleOwnedRecords(record);
            return initialResult;
        }
        catch (error) {
            this.#fail(asError(error));
            throw error;
        }
    }
    retain(observation, request, evaluate, apply, requestSnapshotCache, dependencies = []) {
        const prepared = this.#prepareRecord(observation, request, evaluate, apply, requestSnapshotCache, dependencies, undefined);
        if (prepared.conflict !== undefined) {
            throw new Error(`Checked operation '${observation}' could not be retained because its selected source evidence conflicts.`);
        }
        const record = prepared.record;
        if (prepared.created) {
            this.#journalRecord(record);
            record.result = dependencyDeferredResult(observation);
            record.state = "deferred";
        }
        return record.reference;
    }
    #prepareRecord(observation, request, evaluate, apply, requestSnapshotCache, dependencies, atomicOwner) {
        this.#assertRecordingAvailable("record");
        const executionFrame = this.#executionFrames[this.#executionFrames.length - 1];
        if (executionFrame?.stage === "evaluating") {
            const error = new Error("A checked-operation mapper cannot record another checked operation while it is being evaluated.");
            this.#fail(error);
            throw error;
        }
        if (!Array.isArray(dependencies)) {
            throw new Error("Checked-operation dependencies must be an array.");
        }
        this.#assertReferenceInputWithinBudget(dependencies.length + (atomicOwner === undefined ? 0 : 1));
        const incomingSnapshot = snapshotCheckedOperationRequestWithMetrics(observation, request, requestSnapshotCache);
        this.#reserveSnapshotWork(incomingSnapshot.metrics.workUnits);
        const incomingRequest = incomingSnapshot.request;
        const referenceInputCount = dependencies.length + (atomicOwner === undefined ? 0 : 1);
        this.#assertReferenceInputWithinBudget(referenceInputCount);
        this.#reserveSnapshotWork(referenceInputCount);
        const incomingDependencies = snapshotCheckedOperationReferences(dependencies);
        this.#assertReferenceInputWithinBudget(incomingDependencies.length + (atomicOwner === undefined ? 0 : 1));
        const incomingAtomicOwner = atomicOwner === undefined ? undefined : snapshotCheckedOperationReference(atomicOwner);
        const incomingSubject = checkedOperationSubject(observation, incomingRequest);
        const existing = this.#findRecordForRequest(observation, incomingSubject, incomingRequest);
        if (existing !== undefined && !checkedOperationRequestEquals(observation, existing.request, incomingRequest)) {
            this.#callbacks.onRequestConflict(observation, incomingSubject, existing.request, incomingRequest);
            this.#fail(new Error(`Checked operation '${observation}' was observed with conflicting selected source evidence.`));
            return { created: false, conflict: Object.freeze({ kind: "conflict", observation }) };
        }
        if (existing !== undefined && !checkedOperationReferenceArraysEqual(existing.dependencies, incomingDependencies)) {
            this.#callbacks.onDependencyConflict(observation, incomingSubject);
            this.#fail(new Error(`Checked operation '${observation}' was observed with conflicting operation dependencies.`));
            return { created: false, conflict: Object.freeze({ kind: "conflict", observation }) };
        }
        if (existing !== undefined && !optionalCheckedOperationReferenceEquals(existing.atomicOwner, incomingAtomicOwner)) {
            this.#callbacks.onAtomicOwnerConflict(observation, incomingSubject);
            this.#fail(new Error(`Checked operation '${observation}' was observed with a conflicting atomic owner.`));
            return { created: false, conflict: Object.freeze({ kind: "conflict", observation }) };
        }
        if (incomingAtomicOwner !== undefined
            && (executionFrame?.stage !== "applying"
                || !checkedOperationReferenceEquals(executionFrame.record.reference, incomingAtomicOwner))) {
            const error = new Error(`Atomically owned checked operation '${observation}' must be recorded while its exact owner is applying.`);
            this.#fail(error);
            throw error;
        }
        if (existing !== undefined) {
            return { record: existing, created: false };
        }
        if (this.#records.length >= this.#limits.records) {
            const error = new Error(`Checked-operation inventory exceeds its ${this.#limits.records}-record session limit.`);
            this.#fail(error);
            throw error;
        }
        this.#assertEdgeCapacity(incomingDependencies.length + (incomingAtomicOwner === undefined ? 0 : 1));
        const immutableRequest = incomingRequest;
        const subject = checkedOperationSubject(observation, immutableRequest);
        const evaluateRecord = (phase) => {
            this.#reserveSnapshotWork(1);
            return snapshotCheckedOperationResult(observation, evaluate(immutableRequest, phase));
        };
        const applyRecord = (result) => {
            return apply(result, immutableRequest);
        };
        const record = {
            observation,
            subject,
            reference: checkedOperationReference(observation, immutableRequest, subject),
            request: immutableRequest,
            retainedSnapshotUnits: checkedOperationRetainedSnapshotUnits(incomingSnapshot.metrics),
            retainedScalarCodeUnits: incomingSnapshot.metrics.scalarCodeUnits,
            dependencies: incomingDependencies,
            ...(incomingAtomicOwner === undefined ? {} : { atomicOwner: incomingAtomicOwner }),
            allDependencies: incomingDependencies,
            dependencyIndex: createCheckedOperationReferenceIndex(incomingDependencies),
            evaluate: evaluateRecord,
            apply: applyRecord,
            unresolvedReported: false,
            rejectionPublished: false,
            checkingAttempted: false,
            finalizationAttempts: 0,
            state: "deferred",
        };
        if (incomingAtomicOwner !== undefined && checkedOperationReferenceEquals(record.reference, incomingAtomicOwner)) {
            const error = new Error(`Checked operation '${observation}' cannot atomically own itself.`);
            this.#fail(error);
            throw error;
        }
        this.#assertAtomicOwnershipAcyclic(record);
        this.#addRecord(record);
        return { record, created: true };
    }
    getRequest(observation, subject, reference) {
        if (subject === undefined) {
            return undefined;
        }
        if (this.#state === "failed") {
            return undefined;
        }
        const records = (this.#recordsBySubject.get(subject)?.get(observation) ?? [])
            .filter((record) => reference === undefined || checkedOperationReferenceEquals(record.reference, reference));
        if (records.length > 1) {
            const error = new Error(`Checked operation '${observation}' has multiple request slots; an exact operation reference is required.`);
            this.#fail(error);
            throw error;
        }
        return records[0]?.request;
    }
    getReference(subject) {
        if (subject === undefined) {
            return undefined;
        }
        if (this.#state === "failed") {
            return undefined;
        }
        const records = this.#recordsBySubject.get(subject);
        if (records === undefined) {
            return undefined;
        }
        let primary;
        for (const observation of checkedPrimaryOperationObservationOrder) {
            const primaryRecords = records.get(observation) ?? [];
            if (primaryRecords.length > 1) {
                const error = new Error(`Checked-operation subject has multiple '${observation}' records.`);
                this.#fail(error);
                throw error;
            }
            const record = primaryRecords[0];
            if (record !== undefined) {
                if (primary !== undefined) {
                    const error = new Error(`Checked-operation subject has multiple primary operations: '${primary.observation}' and '${record.observation}'.`);
                    this.#fail(error);
                    throw error;
                }
                primary = record;
            }
        }
        if (primary !== undefined) {
            return primary.reference;
        }
        return (records.get(ExtensionObservationPoint.mapCheckedConversion) ?? [])
            .find((record) => record.reference.conversionKind === "assertion")
            ?.reference;
    }
    evaluateRetainedChecking() {
        this.#assertRecordingAvailable("record");
        if (this.#state !== "open") {
            throw new Error(`Retained checked operations cannot be evaluated while the inventory is '${this.#state}'.`);
        }
        const roots = this.#records.slice(this.#checkingRecordCursor);
        if (roots.length === 0) {
            return;
        }
        try {
            for (const record of this.#dependencyOrderedRecords(roots, false)) {
                if (record.atomicOwner !== undefined || record.checkingAttempted || record.state !== "deferred") {
                    continue;
                }
                const dependencyReadiness = this.#dependencyReadiness(record, false);
                if (dependencyReadiness === "blocked") {
                    this.#markUnavailable(record);
                    this.#settleOwnedRecords(record);
                    continue;
                }
                if (dependencyReadiness !== "ready") {
                    continue;
                }
                this.#journalRecord(record);
                record.state = "evaluating";
                const result = this.#runAttempt(record, "checking");
                this.#throwIfFailed();
                record.result = result;
                this.#setResultState(record, result);
                this.#settleOwnedRecords(record);
            }
            this.#checkingRecordCursor = this.#records.length;
        }
        catch (error) {
            this.#fail(asError(error));
            throw error;
        }
    }
    finalize() {
        if (this.#state === "finalized") {
            return;
        }
        const savepoint = this.createSavepoint();
        try {
            this.prepareFinalization();
            this.commitSavepoint(savepoint);
            this.commitFinalization();
        }
        catch (error) {
            if (savepoint.active) {
                this.rollbackToSavepoint(savepoint);
            }
            if (this.#state !== "failed") {
                this.#fail(asError(error));
            }
            throw error;
        }
    }
    prepareFinalization() {
        if (this.#state === "finalized") {
            return;
        }
        if (this.#state === "prepared") {
            return;
        }
        if (this.#state === "finalizing") {
            throw new Error("Checked-operation finalization cannot re-enter itself.");
        }
        if (this.#state === "failed") {
            throw new Error("Checked-operation finalization previously failed and cannot be retried.");
        }
        const outerSavepoint = this.#savepoints[this.#savepoints.length - 1];
        if (outerSavepoint === undefined || outerSavepoint.owner !== undefined) {
            throw new Error("Checked-operation finalization preparation requires an active outer transaction savepoint.");
        }
        this.#state = "finalizing";
        this.#finalizationWork = 0;
        try {
            this.#validatePrimaryOperationUniqueness();
            while (this.#hasDeferredRootRecord()) {
                let completedDeferredRecord = false;
                for (const record of this.#dependencyOrderedRecords()) {
                    if (record.atomicOwner !== undefined || record.state !== "deferred") {
                        continue;
                    }
                    const dependencyReadiness = this.#dependencyReadiness(record, true);
                    if (dependencyReadiness === "blocked") {
                        this.#markUnavailable(record);
                        this.#settleOwnedRecords(record);
                        completedDeferredRecord = true;
                        continue;
                    }
                    if (dependencyReadiness !== "ready") {
                        continue;
                    }
                    this.#journalRecord(record);
                    record.state = "evaluating";
                    const result = this.#runAttempt(record, "finalization");
                    this.#throwIfFailed();
                    record.result = result;
                    this.#setResultState(record, result);
                    this.#terminalizeFinalizationMapperDeferral(record, result, "finalization");
                    this.#settleOwnedRecords(record);
                    completedDeferredRecord = true;
                }
                if (!completedDeferredRecord) {
                    throw new Error("Checked-operation finalization made no progress while deferred operations remained.");
                }
            }
            if (this.#savepoints[this.#savepoints.length - 1] !== outerSavepoint) {
                throw new Error("Checked-operation finalization left an attempt transaction unsettled.");
            }
            for (const record of this.#records) {
                if (record.result?.kind !== "reject" || record.rejectionPublished) {
                    continue;
                }
                this.#journalRecord(record);
                this.#callbacks.publishRejectedDiagnostic(record.result);
                record.rejectionPublished = true;
            }
            this.#validateOwnedOperationStates();
            this.#validatePrimaryOperationUniqueness();
            for (const record of this.#records) {
                if (record.pendingAcceptedResult !== undefined) {
                    throw new Error("Prepared checked operation still retains a pending accepted result.");
                }
                if (record.state === "evaluating" || record.state === "deferred") {
                    throw new Error(`Prepared checked operation '${record.observation}' remained in non-terminal state '${record.state}'.`);
                }
            }
            this.#preparedSavepoint = outerSavepoint;
            this.#state = "prepared";
        }
        catch (error) {
            this.#fail(asError(error));
            throw error;
        }
    }
    commitFinalization() {
        if (this.#state === "finalized") {
            return;
        }
        if (this.#state !== "prepared") {
            throw new Error("Checked-operation finalization can commit only after successful preparation.");
        }
        const preparedSavepoint = this.#preparedSavepoint;
        if (preparedSavepoint === undefined
            || !preparedSavepoint.active
            || !preparedSavepoint.commitRequested
            || this.#savepoints[this.#savepoints.length - 1] !== preparedSavepoint) {
            throw new Error("Checked-operation finalization can commit only with its prepared outer transaction committed.");
        }
        this.#savepoints.pop();
        this.#releaseSavepointSnapshots(preparedSavepoint);
        preparedSavepoint.active = false;
        this.#preparedSavepoint = undefined;
        for (const record of this.#records) {
            delete record.acceptedEffects;
        }
        this.#state = "finalized";
    }
    #assertRecordingAvailable(action) {
        if (this.#state === "failed") {
            throw new Error(`Cannot ${action} a checked operation after semantic finalization failed.`);
        }
        if (this.#state === "finalized") {
            throw new Error(`Cannot ${action} a checked operation after semantic finalization.`);
        }
        if (this.#state === "prepared") {
            throw new Error(`Cannot ${action} a checked operation after semantic finalization was prepared.`);
        }
        if (this.#state === "finalizing" && this.#executionFrames[this.#executionFrames.length - 1]?.stage !== "applying") {
            throw new Error(`Cannot ${action} a checked operation outside checked-operation result application during finalization.`);
        }
    }
    #runAttempt(record, phase) {
        if (phase === "checking") {
            this.#journalRecord(record);
            record.checkingAttempted = true;
        }
        else {
            this.#journalRecord(record);
            const retryBound = this.#records.length + this.#edgeCount + 1;
            if (!Number.isSafeInteger(retryBound) || record.finalizationAttempts >= retryBound) {
                throw new Error(`Checked operation '${record.observation}' exceeded its finite graph-derived finalization retry bound.`);
            }
            record.finalizationAttempts += 1;
            this.#consumeFinalizationWork(1);
        }
        if (this.#openingAttemptFor !== undefined) {
            throw new Error("Checked-operation attempt creation cannot re-enter itself.");
        }
        const savepointDepth = this.#savepoints.length;
        let attempt;
        this.#openingAttemptFor = record;
        try {
            attempt = this.#callbacks.beginAttempt();
        }
        catch (error) {
            while (this.#savepoints.length > savepointDepth) {
                this.rollbackToSavepoint(this.#savepoints[this.#savepoints.length - 1]);
            }
            this.#fail(asError(error));
            throw error;
        }
        finally {
            this.#openingAttemptFor = undefined;
        }
        if (this.#savepoints.length > savepointDepth + 1) {
            const error = new Error("A checked-operation attempt opened more than one inventory savepoint.");
            this.#callbacks.rollbackAttempt(attempt);
            this.#fail(error);
            throw error;
        }
        const attemptSavepoint = this.#savepoints[savepointDepth];
        if (attemptSavepoint !== undefined && attemptSavepoint.owner !== record) {
            const error = new Error("A checked-operation attempt savepoint has the wrong immutable owner.");
            this.#callbacks.rollbackAttempt(attempt);
            this.#fail(error);
            throw error;
        }
        this.#journalRecord(record);
        let attemptOpen = true;
        try {
            const pendingAcceptedResult = record.pendingAcceptedResult;
            if (pendingAcceptedResult !== undefined) {
                if (!Object.hasOwn(record, "acceptedEffects")) {
                    throw new Error(`Checked operation '${record.observation}' lost retained accepted-observation effects.`);
                }
                this.#callbacks.applyAttemptEffects(attempt, record.acceptedEffects);
            }
            const result = pendingAcceptedResult ?? this.#withExecutionFrame("evaluating", record, () => record.evaluate(phase));
            this.#throwIfFailed();
            if (result.kind === "reject" && phase === "finalization") {
                this.#callbacks.publishRejectedDiagnostic(result);
                record.rejectionPublished = true;
            }
            if (result.kind === "accept") {
                if (pendingAcceptedResult === undefined) {
                    record.acceptedEffects = this.#callbacks.captureAttemptEffects(attempt);
                }
                if (!Object.hasOwn(record, "acceptedEffects")) {
                    throw new Error(`Checked operation '${record.observation}' did not retain its accepted-observation effects.`);
                }
                const retainedAcceptedEffects = record.acceptedEffects;
                const applyOutcome = normalizeCheckedOperationApplyOutcome(this.#withExecutionFrame("applying", record, () => record.apply(result)));
                if (applyOutcome.kind === "applied") {
                    this.#callbacks.commitAttempt(attempt);
                    attemptOpen = false;
                    delete record.pendingAcceptedResult;
                    delete record.unresolved;
                    return result;
                }
                if (applyOutcome.kind === "deferred") {
                    const unresolved = snapshotCheckedOperationReference(applyOutcome.unresolved);
                    const unresolvedRecord = this.#findRecordForReference(unresolved);
                    if (unresolvedRecord === undefined) {
                        throw new Error(`Checked operation '${record.observation}' deferred on an operation that was not retained.`);
                    }
                    if (unresolvedRecord === record) {
                        throw new Error(`Checked operation '${record.observation}' cannot defer on itself.`);
                    }
                    if (unresolvedRecord.state === "unavailable") {
                        attemptOpen = false;
                        this.#callbacks.rollbackAttemptPreservingOperations(attempt);
                        delete record.pendingAcceptedResult;
                        delete record.acceptedEffects;
                        delete record.unresolved;
                        return checkedOperationUnavailableResult;
                    }
                    if (unresolvedRecord.state !== "deferred") {
                        throw new Error(`Checked operation '${record.observation}' deferred on operation '${unresolved.observation}' in state '${unresolvedRecord.state}'.`);
                    }
                    attemptOpen = false;
                    const deferredDependencies = this.#callbacks.rollbackAttemptPreservingOperations(attempt);
                    record.acceptedEffects = retainedAcceptedEffects;
                    this.#retainDeferredDependencies(record, [...deferredDependencies, unresolved]);
                    record.pendingAcceptedResult = result;
                    record.unresolved = unresolved;
                    return dependencyDeferredResult(record.observation);
                }
                attemptOpen = false;
                this.#callbacks.rollbackAttemptPreservingOperations(attempt);
                delete record.pendingAcceptedResult;
                delete record.acceptedEffects;
                delete record.unresolved;
                return checkedOperationUnavailableResult;
            }
            else {
                attemptOpen = false;
                this.#callbacks.discardAttemptPreservingDiagnostics(attempt);
                delete record.pendingAcceptedResult;
                delete record.acceptedEffects;
            }
            return result;
        }
        catch (error) {
            if (attemptOpen) {
                attemptOpen = false;
                this.#callbacks.rollbackAttempt(attempt);
            }
            this.#fail(asError(error));
            throw error;
        }
    }
    #addRecord(record) {
        if (this.#records.length >= this.#limits.records) {
            const error = new Error(`Checked-operation inventory exceeds its ${this.#limits.records}-record session limit.`);
            this.#fail(error);
            throw error;
        }
        this.#assertRecordDependenciesAcyclic(record);
        this.#assertRetainedSnapshotCapacity(record.retainedSnapshotUnits, record.retainedScalarCodeUnits);
        this.#reserveEdges(record.allDependencies.length + (record.atomicOwner === undefined ? 0 : 1));
        this.#retainedSnapshotUnits += record.retainedSnapshotUnits;
        this.#retainedScalarCodeUnits += record.retainedScalarCodeUnits;
        this.#recordPositions.set(record, this.#records.length);
        this.#records.push(record);
        let recordsForSubject = this.#recordsBySubject.get(record.subject);
        if (recordsForSubject === undefined) {
            recordsForSubject = new Map();
            this.#recordsBySubject.set(record.subject, recordsForSubject);
        }
        const recordsForObservation = recordsForSubject.get(record.observation);
        if (recordsForObservation === undefined) {
            recordsForSubject.set(record.observation, [record]);
        }
        else {
            recordsForObservation.push(record);
        }
        if (record.atomicOwner !== undefined) {
            const ownedRecords = this.#ownedRecordsByOwnerSubject.get(record.atomicOwner.subject);
            if (ownedRecords === undefined) {
                this.#ownedRecordsByOwnerSubject.set(record.atomicOwner.subject, [record]);
            }
            else {
                ownedRecords.push(record);
            }
        }
    }
    createSavepoint() {
        if (this.#state === "prepared" || this.#state === "finalized" || this.#state === "failed") {
            throw new Error(`Cannot create a checked-operation savepoint while the inventory is '${this.#state}'.`);
        }
        if (this.#savepoints.length >= this.#limits.savepointDepth) {
            const error = new Error(`Checked-operation inventory exceeds its ${this.#limits.savepointDepth}-savepoint nesting limit.`);
            this.#fail(error);
            throw error;
        }
        this.#reserveSnapshotWork(1);
        const savepoint = {
            recordCount: this.#records.length,
            snapshots: new Map(),
            edgeCount: this.#edgeCount,
            checkingRecordCursor: this.#checkingRecordCursor,
            retainedSnapshotUnits: this.#retainedSnapshotUnits,
            retainedScalarCodeUnits: this.#retainedScalarCodeUnits,
            ...(this.#openingAttemptFor === undefined ? {} : { owner: this.#openingAttemptFor }),
            commitRequested: false,
            active: true,
        };
        this.#savepoints.push(savepoint);
        return savepoint;
    }
    commitSavepoint(savepoint) {
        this.#requireCurrentSavepoint(savepoint);
        this.#reserveSnapshotWork(this.#records.length - savepoint.recordCount);
        const retained = Object.freeze(this.#records
            .slice(savepoint.recordCount)
            .map((record) => record.reference));
        if (this.#state === "prepared") {
            if (savepoint !== this.#preparedSavepoint || savepoint.owner !== undefined) {
                throw new Error("Only the exact outer finalization transaction can commit prepared checked operations.");
            }
            if (savepoint.commitRequested) {
                throw new Error("The prepared checked-operation outer transaction can be committed only once.");
            }
            this.#assertCanReleaseSavepointSnapshots(savepoint);
            savepoint.commitRequested = true;
            return retained;
        }
        this.#savepoints.pop();
        this.#releaseSavepointSnapshots(savepoint);
        savepoint.active = false;
        return retained;
    }
    rollbackToSavepoint(savepoint) {
        this.#requireCurrentSavepoint(savepoint);
        while (this.#records.length > savepoint.recordCount) {
            const record = this.#records.pop();
            this.#recordPositions.delete(record);
            const recordsForSubject = this.#recordsBySubject.get(record.subject);
            const recordsForObservation = recordsForSubject?.get(record.observation);
            if (recordsForObservation === undefined || recordsForObservation[recordsForObservation.length - 1] !== record) {
                throw new Error("Checked-operation inventory rollback encountered inconsistent record ordering.");
            }
            recordsForObservation.pop();
            if (recordsForObservation.length === 0) {
                recordsForSubject.delete(record.observation);
            }
            if (recordsForSubject.size === 0) {
                this.#recordsBySubject.delete(record.subject);
            }
            if (record.atomicOwner !== undefined) {
                const ownedRecords = this.#ownedRecordsByOwnerSubject.get(record.atomicOwner.subject);
                if (ownedRecords === undefined || ownedRecords[ownedRecords.length - 1] !== record) {
                    throw new Error("Checked-operation inventory rollback encountered inconsistent atomic-owner ordering.");
                }
                ownedRecords.pop();
                if (ownedRecords.length === 0) {
                    this.#ownedRecordsByOwnerSubject.delete(record.atomicOwner.subject);
                }
            }
        }
        this.#restoreSavepointSnapshots(savepoint);
        this.#edgeCount = savepoint.edgeCount;
        this.#checkingRecordCursor = savepoint.checkingRecordCursor;
        this.#retainedSnapshotUnits = savepoint.retainedSnapshotUnits;
        this.#retainedScalarCodeUnits = savepoint.retainedScalarCodeUnits;
        this.#savepoints.pop();
        this.#releaseSavepointSnapshots(savepoint);
        savepoint.active = false;
        if (savepoint === this.#preparedSavepoint) {
            this.#preparedSavepoint = undefined;
            if (this.#state === "prepared") {
                this.#failure = new Error("Checked-operation finalization outer transaction rolled back after preparation.");
                this.#state = "failed";
            }
        }
    }
    preserveFromSavepoint(savepoint) {
        this.#requireCurrentSavepoint(savepoint);
        try {
            return this.#preserveFromSavepoint(savepoint);
        }
        catch (error) {
            if (savepoint.active && this.#savepoints[this.#savepoints.length - 1] === savepoint) {
                this.rollbackToSavepoint(savepoint);
            }
            this.#fail(asError(error));
            throw error;
        }
    }
    #preserveFromSavepoint(savepoint) {
        if (savepoint.owner === undefined) {
            throw new Error("Only a checked-operation attempt transaction can preserve nested operations.");
        }
        const newRecordCount = this.#records.length - savepoint.recordCount;
        const changedRecordCount = savepoint.snapshots.size + newRecordCount;
        this.#reserveSnapshotWork(changedRecordCount * 2);
        const preserved = new Map();
        for (const record of savepoint.snapshots.keys()) {
            if (record !== savepoint.owner) {
                preserved.set(record, snapshotCheckedOperationRecord(record));
            }
        }
        for (let index = savepoint.recordCount; index < this.#records.length; index += 1) {
            const record = this.#records[index];
            if (record !== savepoint.owner) {
                preserved.set(record, snapshotCheckedOperationRecord(record));
            }
        }
        this.#restoreSavepointSnapshots(savepoint);
        const deferred = [];
        const deferredIndex = new CheckedOperationReferenceIndex();
        for (const [record, snapshot] of preserved) {
            this.#restoreDeferredRecordCapsule(record, snapshot);
            if (deferredIndex.add(record.reference)) {
                deferred.push(record.reference);
            }
        }
        this.#reserveSnapshotWork(this.#records.length);
        const retainedEdgeCount = this.#countCurrentEdges();
        this.#savepoints.pop();
        this.#releaseSavepointSnapshots(savepoint);
        savepoint.active = false;
        this.#edgeCount = retainedEdgeCount;
        return Object.freeze(deferred);
    }
    #journalRecord(record) {
        const position = this.#recordPositions.get(record);
        if (position === undefined) {
            throw new Error("Checked-operation state journal received an unregistered record.");
        }
        let snapshotCount = 0;
        let snapshotWork = 0;
        for (const savepoint of this.#savepoints) {
            if (position < savepoint.recordCount && !savepoint.snapshots.has(record)) {
                snapshotCount += 1;
                snapshotWork += 1 + record.allDependencies.length;
            }
        }
        this.#reserveSnapshotWork(snapshotWork);
        this.#reserveActiveSnapshots(snapshotCount);
        for (const savepoint of this.#savepoints) {
            if (position < savepoint.recordCount && !savepoint.snapshots.has(record)) {
                savepoint.snapshots.set(record, snapshotCheckedOperationRecord(record));
            }
        }
    }
    #restoreSavepointSnapshots(savepoint) {
        for (const [record, snapshot] of savepoint.snapshots) {
            this.#restoreRecordSnapshot(record, snapshot);
        }
    }
    #restoreRecordSnapshot(record, snapshot) {
        if (snapshot.hasResult) {
            record.result = snapshot.result;
        }
        else {
            delete record.result;
        }
        if (snapshot.hasPendingAcceptedResult) {
            record.pendingAcceptedResult = snapshot.pendingAcceptedResult;
        }
        else {
            delete record.pendingAcceptedResult;
        }
        if (snapshot.hasAcceptedEffects) {
            record.acceptedEffects = snapshot.acceptedEffects;
        }
        else {
            delete record.acceptedEffects;
        }
        if (snapshot.hasUnresolved) {
            record.unresolved = snapshot.unresolved;
        }
        else {
            delete record.unresolved;
        }
        record.unresolvedReported = snapshot.unresolvedReported;
        record.rejectionPublished = snapshot.rejectionPublished;
        record.checkingAttempted = snapshot.checkingAttempted;
        record.finalizationAttempts = snapshot.finalizationAttempts;
        record.state = snapshot.state;
        record.allDependencies = snapshot.allDependencies;
        record.dependencyIndex = createCheckedOperationReferenceIndex(record.allDependencies);
    }
    #restoreDeferredRecordCapsule(record, snapshot) {
        this.#restoreRecordSnapshot(record, snapshot);
        if (record.state === "evaluating") {
            throw new Error(`Checked operation '${record.observation}' remained evaluating while its owner deferred.`);
        }
        const result = record.result;
        if (result === undefined) {
            throw new Error(`Checked operation '${record.observation}' has no result while preserving a deferred apply attempt.`);
        }
        if (record.state === "unavailable") {
            markCheckedOperationUnavailable(record);
            return;
        }
        if (record.state === "accepted") {
            if (result.kind !== "accept") {
                throw new Error(`Accepted checked operation '${record.observation}' lost its exact accepted result.`);
            }
            if (!Object.hasOwn(record, "acceptedEffects")) {
                throw new Error(`Accepted checked operation '${record.observation}' lost its replay effects.`);
            }
            record.pendingAcceptedResult = result;
            record.result = dependencyDeferredResult(record.observation);
            record.state = "deferred";
            delete record.unresolved;
            return;
        }
        if (record.state === "deferred" && result.kind === "owner-deferred") {
            record.state = "deferred";
            return;
        }
        throw new Error(`Deferred checked operation '${record.observation}' has inconsistent retained result '${result.kind}'.`);
    }
    #requireCurrentSavepoint(savepoint) {
        if (!savepoint.active || this.#savepoints[this.#savepoints.length - 1] !== savepoint) {
            throw new Error("Checked-operation inventory savepoints must settle exactly once in strict stack order.");
        }
        if (!Number.isSafeInteger(savepoint.recordCount)
            || savepoint.recordCount < 0
            || savepoint.recordCount > this.#records.length) {
            throw new Error("Invalid checked-operation inventory savepoint.");
        }
        if (!Number.isSafeInteger(savepoint.checkingRecordCursor)
            || savepoint.checkingRecordCursor < 0
            || savepoint.checkingRecordCursor > savepoint.recordCount) {
            throw new Error("Invalid checked-operation checking-stage savepoint cursor.");
        }
    }
    #assertReferenceInputWithinBudget(count) {
        if (!Number.isSafeInteger(count) || count < 0 || count > this.#limits.edges) {
            const error = new Error(`Checked-operation reference input exceeds its ${this.#limits.edges}-entry session limit.`);
            this.#fail(error);
            throw error;
        }
    }
    #reserveSnapshotWork(count) {
        if (!Number.isSafeInteger(count) || count < 0 || this.#snapshotWork > this.#limits.snapshotWork - count) {
            const error = new Error(`Checked-operation inventory exceeds its ${this.#limits.snapshotWork}-unit snapshot-work session limit.`);
            this.#fail(error);
            throw error;
        }
        this.#snapshotWork += count;
    }
    #reserveActiveSnapshots(count) {
        if (!Number.isSafeInteger(count)
            || count < 0
            || this.#activeSnapshotCount > this.#limits.activeSnapshots - count) {
            const error = new Error(`Checked-operation inventory exceeds its ${this.#limits.activeSnapshots}-snapshot transaction limit.`);
            this.#fail(error);
            throw error;
        }
        this.#activeSnapshotCount += count;
    }
    #assertRetainedSnapshotCapacity(units, scalarCodeUnits) {
        if (!Number.isSafeInteger(units)
            || units < 0
            || this.#retainedSnapshotUnits > this.#limits.retainedSnapshotUnits - units) {
            const error = new Error(`Checked-operation inventory exceeds its ${this.#limits.retainedSnapshotUnits}-unit retained-snapshot session limit.`);
            this.#fail(error);
            throw error;
        }
        if (!Number.isSafeInteger(scalarCodeUnits)
            || scalarCodeUnits < 0
            || this.#retainedScalarCodeUnits > this.#limits.retainedScalarCodeUnits - scalarCodeUnits) {
            const error = new Error(`Checked-operation inventory exceeds its ${this.#limits.retainedScalarCodeUnits}-code-unit retained-scalar session limit.`);
            this.#fail(error);
            throw error;
        }
    }
    #releaseSavepointSnapshots(savepoint) {
        this.#assertCanReleaseSavepointSnapshots(savepoint);
        this.#activeSnapshotCount -= savepoint.snapshots.size;
    }
    #assertCanReleaseSavepointSnapshots(savepoint) {
        if (this.#activeSnapshotCount < savepoint.snapshots.size) {
            throw new Error("Checked-operation active snapshot accounting underflowed.");
        }
    }
    #consumeFinalizationWork(count) {
        if (this.#state !== "finalizing") {
            return;
        }
        if (!Number.isSafeInteger(count) || count < 0 || this.#finalizationWork > this.#limits.finalizationWork - count) {
            const error = new Error(`Checked-operation finalization exceeds its ${this.#limits.finalizationWork}-unit work limit.`);
            this.#fail(error);
            throw error;
        }
        this.#finalizationWork += count;
    }
    #hasDeferredRootRecord() {
        for (const record of this.#records) {
            this.#consumeFinalizationWork(1);
            if (record.atomicOwner === undefined && record.state === "deferred") {
                return true;
            }
        }
        return false;
    }
    #countCurrentEdges() {
        let count = 0;
        for (const record of this.#records) {
            const recordEdges = record.allDependencies.length + (record.atomicOwner === undefined ? 0 : 1);
            if (count > this.#limits.edges - recordEdges) {
                throw new Error(`Checked-operation inventory exceeds its ${this.#limits.edges}-edge session limit.`);
            }
            count += recordEdges;
        }
        return count;
    }
    #reserveEdges(count) {
        this.#assertEdgeCapacity(count);
        this.#edgeCount += count;
    }
    #assertEdgeCapacity(count) {
        if (!Number.isSafeInteger(count) || count < 0 || this.#edgeCount > this.#limits.edges - count) {
            const error = new Error(`Checked-operation inventory exceeds its ${this.#limits.edges}-edge session limit.`);
            this.#fail(error);
            throw error;
        }
    }
    #assertAtomicOwnershipAcyclic(record) {
        let ownerReference = record.atomicOwner;
        const visited = new Set();
        while (ownerReference !== undefined) {
            if (checkedOperationReferenceEquals(ownerReference, record.reference)) {
                const error = new Error(`Checked operation '${record.observation}' cannot participate in an atomic-ownership cycle.`);
                this.#fail(error);
                throw error;
            }
            const owner = this.#findRecordForReference(ownerReference);
            if (owner === undefined) {
                const error = new Error(`Atomically owned checked operation '${record.observation}' references a missing owner.`);
                this.#fail(error);
                throw error;
            }
            if (visited.has(owner)) {
                const error = new Error("Checked-operation atomic ownership contains a cycle.");
                this.#fail(error);
                throw error;
            }
            visited.add(owner);
            ownerReference = owner.atomicOwner;
        }
    }
    #assertRecordDependenciesAcyclic(record) {
        for (const reference of record.allDependencies) {
            if (checkedOperationReferenceEquals(reference, record.reference)) {
                const error = new Error(`Checked operation '${record.observation}' cannot depend on itself.`);
                this.#fail(error);
                throw error;
            }
            const dependency = this.#findRecordForReference(reference);
            if (dependency !== undefined) {
                this.#assertDependencyEdgeAcyclic(record, dependency);
            }
        }
    }
    #assertDependencyEdgeAcyclic(owner, dependency) {
        if (dependency === owner || this.#hasDependencyPath(dependency, owner.reference)) {
            const error = new Error(`Checked-operation dependency cycle includes '${owner.observation}' and '${dependency.observation}'.`);
            this.#fail(error);
            throw error;
        }
    }
    #hasDependencyPath(root, target) {
        const pending = [root];
        const visited = new Set();
        while (pending.length !== 0) {
            this.#consumeFinalizationWork(1);
            const record = pending.pop();
            if (visited.has(record)) {
                continue;
            }
            visited.add(record);
            for (const dependencyReference of record.allDependencies) {
                this.#consumeFinalizationWork(1);
                if (checkedOperationReferenceEquals(dependencyReference, target)) {
                    return true;
                }
                const dependency = this.#findRecordForReference(dependencyReference);
                if (dependency !== undefined && !visited.has(dependency)) {
                    pending.push(dependency);
                }
            }
        }
        return false;
    }
    #retainDeferredDependencies(owner, references) {
        this.#journalRecord(owner);
        this.#assertReferenceInputWithinBudget(references.length);
        this.#reserveSnapshotWork(references.length);
        const pending = [...references];
        let nextReferenceIndex = 0;
        const expandedOwnedRecords = new Set();
        const additions = [];
        while (nextReferenceIndex < pending.length) {
            this.#consumeFinalizationWork(1);
            const reference = pending[nextReferenceIndex++];
            const dependency = this.#findRecordForReference(reference);
            if (dependency === undefined) {
                throw new Error(`Checked operation '${owner.observation}' deferred on an operation that was not retained.`);
            }
            if (dependency === owner) {
                throw new Error(`Checked operation '${owner.observation}' cannot defer on itself.`);
            }
            if (this.#isAtomicallyOwnedBy(dependency, owner)) {
                if (expandedOwnedRecords.has(dependency)) {
                    continue;
                }
                expandedOwnedRecords.add(dependency);
                this.#assertReferenceInputWithinBudget(dependency.allDependencies.length);
                this.#reserveSnapshotWork(dependency.allDependencies.length);
                pending.push(...checkedOperationDependencies(dependency));
                continue;
            }
            if (owner.dependencyIndex.add(reference)) {
                this.#assertDependencyEdgeAcyclic(owner, dependency);
                additions.push(reference);
            }
        }
        if (additions.length !== 0) {
            this.#reserveEdges(additions.length);
            owner.allDependencies = Object.freeze([...owner.allDependencies, ...additions]);
        }
    }
    #isAtomicallyOwnedBy(candidate, owner) {
        let ownerReference = candidate.atomicOwner;
        const visited = new Set();
        while (ownerReference !== undefined) {
            const ownerRecord = this.#findRecordForReference(ownerReference);
            if (ownerRecord === undefined) {
                throw new Error(`Atomically owned checked operation '${candidate.observation}' references a missing owner.`);
            }
            if (ownerRecord === owner) {
                return true;
            }
            if (visited.has(ownerRecord)) {
                throw new Error("Checked-operation atomic ownership contains a cycle.");
            }
            visited.add(ownerRecord);
            ownerReference = ownerRecord.atomicOwner;
        }
        return false;
    }
    #directlyOwnedRecords(owner) {
        return (this.#ownedRecordsByOwnerSubject.get(owner.reference.subject) ?? [])
            .filter((record) => record.atomicOwner !== undefined
            && checkedOperationReferenceEquals(record.atomicOwner, owner.reference));
    }
    #settleOwnedRecords(owner) {
        if (owner.state === "deferred" || owner.state === "evaluating") {
            return;
        }
        const pending = [...this.#directlyOwnedRecords(owner)];
        while (pending.length !== 0) {
            const record = pending.pop();
            if (owner.state === "accepted") {
                if (record.state !== "accepted") {
                    throw new Error(`Accepted checked operation '${owner.observation}' has atomically owned operation '${record.observation}' in state '${record.state}'.`);
                }
            }
            else {
                this.#markUnavailable(record);
            }
            pending.push(...this.#directlyOwnedRecords(record));
        }
    }
    #validateOwnedOperationStates() {
        for (const record of this.#records) {
            if (record.atomicOwner === undefined) {
                continue;
            }
            const owner = this.#findRecordForReference(record.atomicOwner);
            if (owner === undefined) {
                throw new Error(`Atomically owned checked operation '${record.observation}' references a missing owner.`);
            }
            if (owner.state === "accepted" && record.state !== "accepted") {
                throw new Error(`Accepted checked operation '${owner.observation}' has unaccepted atomic child '${record.observation}'.`);
            }
            if (owner.state === "unavailable" && record.state !== "unavailable") {
                throw new Error(`Unavailable checked operation '${owner.observation}' has a published atomic child '${record.observation}'.`);
            }
            if (record.state === "deferred") {
                throw new Error(`Atomically owned checked operation '${record.observation}' remained deferred after finalization.`);
            }
        }
    }
    #markUnavailable(record) {
        this.#journalRecord(record);
        markCheckedOperationUnavailable(record);
    }
    #setResultState(record, result) {
        record.state = checkedOperationResultState(result);
    }
    #terminalizeFinalizationMapperDeferral(record, result, phase) {
        if (phase !== "finalization"
            || result.kind !== "owner-deferred"
            || record.unresolved !== undefined) {
            return;
        }
        this.#journalRecord(record);
        if (!record.unresolvedReported) {
            record.unresolvedReported = true;
            this.#callbacks.onUnresolved(record.observation, record.subject, result.extensionId);
        }
        this.#markUnavailable(record);
    }
    #findRecordForRequest(observation, subject, request) {
        return (this.#recordsBySubject.get(subject)?.get(observation) ?? [])
            .find((record) => checkedOperationSlotEquals(observation, record.request, request));
    }
    #findRecordForReference(reference) {
        return (this.#recordsBySubject.get(reference.subject)?.get(reference.observation) ?? [])
            .find((record) => checkedOperationReferenceEquals(record.reference, reference));
    }
    #dependencyReadiness(record, requirePresent) {
        for (const dependency of checkedOperationDependencies(record)) {
            this.#consumeFinalizationWork(1);
            const dependencyRecord = this.#findRecordForReference(dependency);
            if (dependencyRecord === undefined) {
                if (requirePresent) {
                    throw new Error(`Checked operation '${record.observation}' references missing dependency '${dependency.observation}'.`);
                }
                return "waiting";
            }
            if (dependencyRecord === record) {
                throw new Error(`Checked operation '${record.observation}' cannot depend on itself.`);
            }
            if (dependencyRecord.state === "unavailable") {
                return "blocked";
            }
            if (dependencyRecord.state !== "accepted") {
                return "waiting";
            }
        }
        return "ready";
    }
    #fail(error) {
        if (this.#state === "failed") {
            return;
        }
        this.#failure = error;
        this.#state = "failed";
        this.#callbacks.onFatalFailure(error);
    }
    #throwIfFailed() {
        if (this.#state === "failed") {
            throw this.#failure ?? new Error("Checked-operation finalization failed without error evidence.");
        }
    }
    #withExecutionFrame(stage, record, callback) {
        const frame = { stage, record };
        this.#executionFrames.push(frame);
        try {
            return callback();
        }
        finally {
            const completed = this.#executionFrames.pop();
            if (completed !== frame) {
                throw new Error("Checked-operation execution stage stack is inconsistent.");
            }
        }
    }
    #validatePrimaryOperationUniqueness() {
        const primaryBySubject = new WeakMap();
        for (const record of this.#records) {
            this.#consumeFinalizationWork(1);
            if (!checkedPrimaryOperationObservationOrder.includes(record.observation)) {
                continue;
            }
            const existing = primaryBySubject.get(record.subject);
            if (existing !== undefined && existing.observation !== record.observation) {
                throw new Error(`Checked-operation subject has multiple primary operations: '${existing.observation}' and '${record.observation}'.`);
            }
            primaryBySubject.set(record.subject, record);
        }
    }
    #dependencyOrderedRecords(roots = this.#records, requirePresent = true) {
        this.#consumeFinalizationWork(roots.length);
        const ordered = [];
        const visited = new Set();
        const visiting = new Set();
        for (const root of roots) {
            if (visited.has(root)) {
                continue;
            }
            const stack = [{
                    record: root,
                    dependencies: checkedOperationDependencies(root),
                    nextDependencyIndex: 0,
                }];
            visiting.add(root);
            while (stack.length !== 0) {
                const frame = stack[stack.length - 1];
                const dependency = frame.dependencies[frame.nextDependencyIndex];
                if (dependency !== undefined) {
                    this.#consumeFinalizationWork(1);
                    frame.nextDependencyIndex += 1;
                    const dependencyRecord = this.#findRecordForReference(dependency);
                    if (dependencyRecord === undefined) {
                        if (requirePresent) {
                            throw new Error(`Checked operation '${frame.record.observation}' references missing dependency '${dependency.observation}'.`);
                        }
                        continue;
                    }
                    if (visiting.has(dependencyRecord)) {
                        throw new Error(`Checked-operation dependency cycle includes '${frame.record.observation}' and '${dependencyRecord.observation}'.`);
                    }
                    if (visited.has(dependencyRecord)) {
                        continue;
                    }
                    visiting.add(dependencyRecord);
                    stack.push({
                        record: dependencyRecord,
                        dependencies: checkedOperationDependencies(dependencyRecord),
                        nextDependencyIndex: 0,
                    });
                    continue;
                }
                stack.pop();
                visiting.delete(frame.record);
                if (!visited.has(frame.record)) {
                    visited.add(frame.record);
                    ordered.push(frame.record);
                }
            }
        }
        return ordered;
    }
}
function snapshotCheckedOperationRecord(record) {
    if (!Object.isFrozen(record.reference)
        || !Object.isFrozen(record.request)
        || !Object.isFrozen(record.dependencies)
        || !Object.isFrozen(record.allDependencies)
        || (record.atomicOwner !== undefined && !Object.isFrozen(record.atomicOwner))) {
        throw new Error(`Checked operation '${record.observation}' has mutable retained identity or selected evidence.`);
    }
    return Object.freeze({
        hasResult: Object.hasOwn(record, "result"),
        result: record.result,
        hasPendingAcceptedResult: Object.hasOwn(record, "pendingAcceptedResult"),
        pendingAcceptedResult: record.pendingAcceptedResult,
        hasAcceptedEffects: Object.hasOwn(record, "acceptedEffects"),
        acceptedEffects: record.acceptedEffects,
        hasUnresolved: Object.hasOwn(record, "unresolved"),
        unresolved: record.unresolved,
        unresolvedReported: record.unresolvedReported,
        rejectionPublished: record.rejectionPublished,
        checkingAttempted: record.checkingAttempted,
        finalizationAttempts: record.finalizationAttempts,
        state: record.state,
        allDependencies: record.allDependencies,
    });
}
function checkedOperationRetainedSnapshotUnits(metrics) {
    const counts = [
        metrics.objectCount,
        metrics.targetTypeRefObjectCount,
        metrics.arrayElementCount,
        metrics.ownFieldCount,
    ];
    let total = 0;
    for (const count of counts) {
        if (!Number.isSafeInteger(count) || count < 0 || total > Number.MAX_SAFE_INTEGER - count) {
            throw new Error("Checked-operation request snapshot reported invalid retained-resource metrics.");
        }
        total += count;
    }
    return total;
}
function snapshotCheckedOperationInventoryLimits(limits) {
    const snapshot = {
        records: checkedOperationLimit(limits.records, defaultCheckedOperationInventoryLimits.records, "records"),
        edges: checkedOperationLimit(limits.edges, defaultCheckedOperationInventoryLimits.edges, "edges"),
        savepointDepth: checkedOperationLimit(limits.savepointDepth, defaultCheckedOperationInventoryLimits.savepointDepth, "savepointDepth"),
        activeSnapshots: checkedOperationLimit(limits.activeSnapshots, defaultCheckedOperationInventoryLimits.activeSnapshots, "activeSnapshots"),
        snapshotWork: checkedOperationLimit(limits.snapshotWork, defaultCheckedOperationInventoryLimits.snapshotWork, "snapshotWork"),
        retainedSnapshotUnits: checkedOperationLimit(limits.retainedSnapshotUnits, defaultCheckedOperationInventoryLimits.retainedSnapshotUnits, "retainedSnapshotUnits"),
        retainedScalarCodeUnits: checkedOperationLimit(limits.retainedScalarCodeUnits, defaultCheckedOperationInventoryLimits.retainedScalarCodeUnits, "retainedScalarCodeUnits"),
        finalizationWork: checkedOperationLimit(limits.finalizationWork, defaultCheckedOperationInventoryLimits.finalizationWork, "finalizationWork"),
    };
    return Object.freeze(snapshot);
}
function checkedOperationLimit(value, fallback, name) {
    const limit = value ?? fallback;
    if (!Number.isSafeInteger(limit) || limit < 0) {
        throw new Error(`Checked-operation inventory limit '${name}' must be a non-negative safe integer.`);
    }
    return limit;
}
function checkedOperationSubject(observation, request) {
    switch (observation) {
        case ExtensionObservationPoint.mapCheckedCall:
            return request.call;
        case ExtensionObservationPoint.mapCheckedPropertyAccess:
            return request.expression;
        case ExtensionObservationPoint.mapCheckedElementAccess:
            return request.expression;
        case ExtensionObservationPoint.mapCheckedOperator:
            return request.expression;
        case ExtensionObservationPoint.mapCheckedIteration:
            return request.statement;
        case ExtensionObservationPoint.mapCheckedConversion:
            return request.expression;
    }
}
function checkedOperationReference(observation, request, subject) {
    switch (observation) {
        case ExtensionObservationPoint.mapCheckedCall:
            return Object.freeze({ observation: ExtensionObservationPoint.mapCheckedCall, subject });
        case ExtensionObservationPoint.mapCheckedPropertyAccess:
            return Object.freeze({ observation: ExtensionObservationPoint.mapCheckedPropertyAccess, subject });
        case ExtensionObservationPoint.mapCheckedElementAccess:
            return Object.freeze({ observation: ExtensionObservationPoint.mapCheckedElementAccess, subject });
        case ExtensionObservationPoint.mapCheckedOperator:
            return Object.freeze({ observation: ExtensionObservationPoint.mapCheckedOperator, subject });
        case ExtensionObservationPoint.mapCheckedIteration:
            return Object.freeze({ observation: ExtensionObservationPoint.mapCheckedIteration, subject });
        case ExtensionObservationPoint.mapCheckedConversion: {
            const conversion = request;
            return Object.freeze(conversion.conversionKind === "assertion"
                ? { observation: ExtensionObservationPoint.mapCheckedConversion, subject, conversionKind: "assertion" }
                : {
                    observation: ExtensionObservationPoint.mapCheckedConversion,
                    subject,
                    conversionKind: "call-argument",
                    call: conversion.call,
                    slot: conversion.slot,
                });
        }
    }
}
function checkedOperationSlotEquals(observation, left, right) {
    if (observation !== ExtensionObservationPoint.mapCheckedConversion) {
        return true;
    }
    const leftConversion = left;
    const rightConversion = right;
    if (leftConversion.conversionKind !== rightConversion.conversionKind) {
        return false;
    }
    return leftConversion.conversionKind === "assertion"
        || (leftConversion.call === rightConversion.call
            && targetCallArgumentConversionSlotEquals(leftConversion.slot, rightConversion.slot));
}
function checkedOperationReferenceEquals(left, right) {
    return left.observation === right.observation
        && left.subject === right.subject
        && left.conversionKind === right.conversionKind
        && left.call === right.call
        && (left.slot === undefined || right.slot === undefined
            ? left.slot === right.slot
            : targetCallArgumentConversionSlotEquals(left.slot, right.slot));
}
function optionalCheckedOperationReferenceEquals(left, right) {
    return left === undefined || right === undefined
        ? left === right
        : checkedOperationReferenceEquals(left, right);
}
function asError(value) {
    return value instanceof Error ? value : new Error(String(value));
}
function snapshotCheckedOperationReferences(references) {
    if (!Array.isArray(references)) {
        throw new Error("Checked-operation dependencies must be an array.");
    }
    const snapshots = [];
    const index = new CheckedOperationReferenceIndex();
    for (const reference of references) {
        const snapshot = snapshotCheckedOperationReference(reference);
        if (index.add(snapshot)) {
            snapshots.push(snapshot);
        }
    }
    return Object.freeze(snapshots);
}
function snapshotCheckedOperationReference(reference) {
    const fields = readExactDataFields(reference, "checked-operation reference");
    const observation = fields.observation;
    if (!isCheckedOperationObservationPointName(observation)) {
        throw new Error(`Unknown checked-operation reference observation '${String(observation)}'.`);
    }
    const subject = requireReferenceSubject(fields.subject, "subject");
    if (observation !== ExtensionObservationPoint.mapCheckedConversion) {
        assertExactReferenceFields(fields, ["observation", "subject"]);
        return Object.freeze({ observation, subject });
    }
    const conversionKind = fields.conversionKind;
    if (conversionKind === "assertion") {
        assertExactReferenceFields(fields, ["observation", "subject", "conversionKind"]);
        return Object.freeze({ observation, subject, conversionKind });
    }
    if (conversionKind !== "call-argument") {
        throw new Error(`Unknown checked-operation conversion reference kind '${String(conversionKind)}'.`);
    }
    assertExactReferenceFields(fields, [
        "observation",
        "subject",
        "conversionKind",
        "call",
        "slot",
    ]);
    const call = requireReferenceSubject(fields.call, "call");
    const slot = snapshotTargetCallArgumentConversionSlot(requireReferenceSubject(fields.slot, "slot"));
    return Object.freeze({
        observation,
        subject,
        conversionKind,
        call,
        slot,
    });
}
function readExactDataFields(value, valueName) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`A ${valueName} must be a non-array object.`);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        throw new Error(`A ${valueName} must be a plain object.`);
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== "string")) {
        throw new Error(`A ${valueName} cannot contain symbol fields.`);
    }
    const fields = Object.create(null);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of ownKeys) {
        const descriptor = descriptors[key];
        if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
            throw new Error(`A ${valueName} field '${key}' must be an enumerable own data property.`);
        }
        fields[key] = descriptor.value;
    }
    return Object.freeze(fields);
}
function assertExactReferenceFields(fields, expected) {
    const actual = Object.keys(fields);
    if (actual.length !== expected.length || expected.some((field) => !Object.hasOwn(fields, field))) {
        throw new Error(`A checked-operation reference must contain exactly: ${expected.join(", ")}.`);
    }
}
function requireReferenceSubject(value, field) {
    if (typeof value !== "object" || value === null) {
        throw new Error(`Checked-operation reference '${field}' must be an object identity.`);
    }
    return value;
}
function isCheckedOperationObservationPointName(value) {
    return value === ExtensionObservationPoint.mapCheckedCall
        || value === ExtensionObservationPoint.mapCheckedPropertyAccess
        || value === ExtensionObservationPoint.mapCheckedElementAccess
        || value === ExtensionObservationPoint.mapCheckedOperator
        || value === ExtensionObservationPoint.mapCheckedIteration
        || value === ExtensionObservationPoint.mapCheckedConversion;
}
function checkedOperationDependencies(record) {
    return record.allDependencies;
}
export class CheckedOperationReferenceIndex {
    #subjects = new WeakMap();
    add(reference) {
        let subject = this.#subjects.get(reference.subject);
        if (subject === undefined) {
            subject = {
                observations: new Set(),
                assertion: false,
                calls: new WeakMap(),
            };
            this.#subjects.set(reference.subject, subject);
        }
        if (reference.observation !== ExtensionObservationPoint.mapCheckedConversion) {
            if (subject.observations.has(reference.observation)) {
                return false;
            }
            subject.observations.add(reference.observation);
            return true;
        }
        if (reference.conversionKind === "assertion") {
            if (subject.assertion) {
                return false;
            }
            subject.assertion = true;
            return true;
        }
        let slots = subject.calls.get(reference.call);
        if (slots === undefined) {
            slots = new Set();
            subject.calls.set(reference.call, slots);
        }
        const slotIdentity = targetCallArgumentConversionSlotIdentity(reference.slot);
        if (slots.has(slotIdentity)) {
            return false;
        }
        slots.add(slotIdentity);
        return true;
    }
}
function targetCallArgumentConversionSlotIdentity(slot) {
    return encodeIdentityTuple([
        slot.sourceArgumentIndex,
        slot.sourceForm,
        slot.spreadElementIndex,
        slot.targetParameterIndex,
        slot.targetForm,
    ]);
}
function createCheckedOperationReferenceIndex(references) {
    const index = new CheckedOperationReferenceIndex();
    for (const reference of references) {
        index.add(reference);
    }
    return index;
}
function checkedOperationReferenceArraysEqual(left, right) {
    return left.length === right.length
        && left.every((reference, index) => checkedOperationReferenceEquals(reference, right[index]));
}
function dependencyDeferredResult(observation) {
    return Object.freeze({
        kind: "owner-deferred",
        observation,
        extensionId: "tsts.checked-operation-dependency",
    });
}
function checkedOperationResultState(result) {
    if (result.kind === "checked-operation-apply-unavailable") {
        return "unavailable";
    }
    if (result.kind === "accept") {
        return "accepted";
    }
    if (result.kind === "owner-deferred") {
        return "deferred";
    }
    return "unavailable";
}
function markCheckedOperationUnavailable(record) {
    record.state = "unavailable";
    delete record.pendingAcceptedResult;
    delete record.acceptedEffects;
    delete record.unresolved;
}
function normalizeCheckedOperationApplyOutcome(value) {
    if (value === undefined) {
        return checkedOperationApplied;
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("A checked-operation apply callback must return undefined or an exact CheckedOperationApplyOutcome object.");
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        throw new Error("A checked-operation apply outcome must be a plain object.");
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== "string")) {
        throw new Error("A checked-operation apply outcome cannot contain symbol fields.");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of ownKeys) {
        const descriptor = descriptors[key];
        if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
            throw new Error(`A checked-operation apply outcome field '${key}' must be an enumerable own data property.`);
        }
    }
    const kind = descriptors.kind?.value;
    if (kind === "applied" || kind === "unavailable") {
        assertExactApplyOutcomeFields(ownKeys, ["kind"], kind);
        return Object.freeze({ kind });
    }
    if (kind === "deferred") {
        assertExactApplyOutcomeFields(ownKeys, ["kind", "unresolved"], kind);
        const unresolved = descriptors.unresolved?.value;
        if (unresolved === undefined) {
            throw new Error("A deferred checked-operation apply outcome requires an unresolved operation reference.");
        }
        return Object.freeze({ kind, unresolved });
    }
    throw new Error(`Unknown checked-operation apply outcome kind '${String(kind)}'.`);
}
function assertExactApplyOutcomeFields(actualFields, expectedFields, kind) {
    if (actualFields.length !== expectedFields.length || expectedFields.some((field) => !actualFields.includes(field))) {
        throw new Error(`Checked-operation apply outcome '${kind}' must contain exactly: ${expectedFields.join(", ")}.`);
    }
}
//# sourceMappingURL=checked-operation-finalization.js.map