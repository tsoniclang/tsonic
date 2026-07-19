import { GetSourceFileOfNode } from "../internal/ast/utilities.js";
import { checkedSourceTypesShareStableIdentity } from "./checked-source-type-identity.js";
import { isRuntimeCheckedSourceExecution } from "./source-execution-role.js";
const eventBudget = 65_536;
const frameBudget = 1_024;
const signatureLinksSnapshotBudget = 65_536;
const typeNodeLinksSnapshotBudget = 65_536;
export function beginSourceDecisionFrame(checker, kind, ownerSourceFile) {
    const existing = checker.extensionSourceDecisionState;
    if (existing === false) {
        return undefined;
    }
    const state = existing ?? createState();
    if (existing === undefined) {
        checker.extensionSourceDecisionState = state;
    }
    if (state.phase === "failed") {
        throw failedStateError();
    }
    if (state.phase === "publishing") {
        return failClosed(state, "cannot begin a frame while publishing");
    }
    if (state.phase === "idle") {
        if (kind !== "source-file") {
            return failClosed(state, "the root frame must be a source-file frame");
        }
        if (ownerSourceFile === undefined) {
            return failClosed(state, "the root source-file frame requires an exact owner");
        }
        if (state.events.length !== 0
            || state.frames.length !== 0
            || state.eventsByOrigin.size !== 0
            || state.signatureLinksSnapshotCount !== 0
            || state.typeNodeLinksSnapshotCount !== 0) {
            return failClosed(state, "idle state retained transaction data");
        }
        state.phase = "source";
    }
    else if (kind === "source-file") {
        return failClosed(state, "a source-file frame cannot be nested");
    }
    else {
        const root = state.frames[0];
        if (root === undefined) {
            return failClosed(state, "a nested frame has no root source-file owner");
        }
        if (ownerSourceFile !== undefined && ownerSourceFile !== root.ownerSourceFile) {
            return failClosed(state, "a nested frame cannot change the root source-file owner");
        }
        ownerSourceFile = root.ownerSourceFile;
    }
    if (!Number.isSafeInteger(state.frames.length) || state.frames.length >= frameBudget) {
        return failClosed(state, "frame budget exceeded");
    }
    if (!Number.isSafeInteger(state.events.length)) {
        return failClosed(state, "event mark is not a safe integer");
    }
    const frame = {
        kind,
        eventMark: state.events.length,
        depth: state.frames.length,
        ownerSourceFile: ownerSourceFile,
        settled: false,
        eventInsertions: [],
        signatureLinksSnapshots: [],
        typeNodeLinksSnapshots: [],
    };
    state.frames.push(frame);
    return frame;
}
export function commitSourceDecisionFrame(checker, frame) {
    const state = stateForSettlement(checker, frame);
    if (state === undefined || frame === undefined) {
        return;
    }
    const record = activeFrame(state, frame);
    if (record.kind === "discard") {
        failClosed(state, "discard frames cannot commit");
    }
    if (record.depth === 0) {
        failClosed(state, "root source-file frames require prepareSourceDecisionFrame");
    }
    const parent = state.frames[state.frames.length - 2];
    if (parent === undefined || parent.settled) {
        return failClosed(state, "nested frame has no active parent");
    }
    mergeSignatureLinksSnapshots(state, parent, record);
    settleTopFrame(state, record);
}
export function prepareSourceDecisionFrame(checker, frame) {
    const state = stateForSettlement(checker, frame);
    if (state === undefined || frame === undefined) {
        return undefined;
    }
    const record = activeFrame(state, frame);
    if (record.kind !== "source-file"
        || record.depth !== 0
        || record.eventMark !== 0
        || state.frames.length !== 1) {
        return failClosed(state, "only the root source-file frame can be prepared");
    }
    if (state.signatureLinksSnapshotCount !== record.signatureLinksSnapshots.length) {
        return failClosed(state, "root SignatureLinks journal is inconsistent");
    }
    if (state.typeNodeLinksSnapshotCount !== record.typeNodeLinksSnapshots.length) {
        return failClosed(state, "root TypeNodeLinks journal is inconsistent");
    }
    state.phase = "publishing";
    return {
        batch: Object.freeze(state.events.slice()),
        frame: record,
        active: true,
    };
}
export function commitPreparedSourceDecision(checker, prepared) {
    if (prepared === undefined) {
        return;
    }
    const state = preparedState(checker, prepared);
    const frame = prepared.frame;
    frame.signatureLinksSnapshots.length = 0;
    frame.typeNodeLinksSnapshots.length = 0;
    frame.eventInsertions.length = 0;
    state.signatureLinksSnapshotCount = 0;
    state.typeNodeLinksSnapshotCount = 0;
    state.events.length = 0;
    state.eventsByOrigin.clear();
    settleTopFrame(state, frame);
    prepared.active = false;
    state.phase = "idle";
}
export function rollbackPreparedSourceDecision(checker, prepared) {
    if (prepared === undefined) {
        return;
    }
    const state = preparedState(checker, prepared);
    const frame = prepared.frame;
    frame.signatureLinksSnapshots.length = 0;
    frame.typeNodeLinksSnapshots.length = 0;
    frame.eventInsertions.length = 0;
    state.signatureLinksSnapshotCount = 0;
    state.typeNodeLinksSnapshotCount = 0;
    state.events.length = 0;
    state.eventsByOrigin.clear();
    settleTopFrame(state, frame);
    prepared.active = false;
    state.phase = "failed";
}
export function rollbackSourceDecisionFrame(checker, frame) {
    const state = stateForSettlement(checker, frame);
    if (state === undefined || frame === undefined) {
        return;
    }
    const record = activeFrame(state, frame);
    if (record.kind === "discard") {
        failClosed(state, "discard frames require rollbackDiscardSourceDecisionFrame");
    }
    rollbackTopFrame(state, record);
}
export function rollbackDiscardSourceDecisionFrame(checker, frame) {
    const state = stateForSettlement(checker, frame);
    if (state === undefined || frame === undefined) {
        return;
    }
    const record = activeFrame(state, frame);
    if (record.kind !== "discard") {
        failClosed(state, "rollbackDiscardSourceDecisionFrame requires a discard frame");
    }
    rollbackTopFrame(state, record);
}
export function journalSignatureLinks(checker, links) {
    const state = checker.extensionSourceDecisionState;
    if (state === undefined || state === false || state.phase === "idle") {
        return;
    }
    if (state.phase === "failed") {
        throw failedStateError();
    }
    if (state.phase !== "source") {
        failClosed(state, "cannot journal SignatureLinks outside the source phase");
    }
    const frame = currentFrame(state);
    for (const snapshot of frame.signatureLinksSnapshots) {
        if (snapshot.links === links) {
            return;
        }
    }
    if (!Number.isSafeInteger(state.signatureLinksSnapshotCount)
        || state.signatureLinksSnapshotCount >= signatureLinksSnapshotBudget) {
        failClosed(state, "SignatureLinks snapshot budget exceeded");
    }
    frame.signatureLinksSnapshots.push({
        links,
        checkedCallSelectionSeed: links.checkedCallSelectionSeed,
        resolvedCallSelectionEvidence: links.resolvedCallSelectionEvidence,
        resolvedCallEvidence: links.resolvedCallEvidence,
        extensionSourceDecisionOwner: links.extensionSourceDecisionOwner,
    });
    state.signatureLinksSnapshotCount++;
}
export function journalTypeNodeLinks(checker, links) {
    const state = checker.extensionSourceDecisionState;
    if (state === undefined || state === false || state.phase === "idle") {
        return;
    }
    if (state.phase === "failed") {
        throw failedStateError();
    }
    if (state.phase !== "source") {
        failClosed(state, "cannot journal TypeNodeLinks outside the source phase");
    }
    const frame = currentFrame(state);
    for (const snapshot of frame.typeNodeLinksSnapshots) {
        if (snapshot.links === links) {
            return;
        }
    }
    if (!Number.isSafeInteger(state.typeNodeLinksSnapshotCount)
        || state.typeNodeLinksSnapshotCount >= typeNodeLinksSnapshotBudget) {
        failClosed(state, "TypeNodeLinks snapshot budget exceeded");
    }
    frame.typeNodeLinksSnapshots.push({
        links,
        extensionSourceDecisionOwner: links.extensionSourceDecisionOwner,
    });
    state.typeNodeLinksSnapshotCount++;
}
export function appendEvent(checker, event) {
    const state = checker.extensionSourceDecisionState;
    if (state === undefined || state === false || state.phase === "idle") {
        return;
    }
    if (state.phase === "failed") {
        throw failedStateError();
    }
    if (state.phase !== "source") {
        failClosed(state, "cannot append an event outside the source phase");
    }
    currentFrame(state);
    if (state.frames.some((frame) => frame.kind === "discard")) {
        return;
    }
    const sourceFile = GetSourceFileOfNode(event.origin);
    if (sourceFile === undefined) {
        failClosed(state, "an event origin has no source file");
    }
    const root = state.frames[0];
    if (root === undefined || sourceFile !== root.ownerSourceFile) {
        failClosed(state, "an event origin does not belong to the active source-file owner");
    }
    if (isRuntimeCheckedOperationEvent(event) && !isRuntimeCheckedSourceExecution(event.origin)) {
        return;
    }
    const existing = eventsForIdentity(state, event);
    for (const candidate of existing) {
        if (sourceDecisionEventsEquivalent(candidate, event)) {
            return;
        }
    }
    if (existing.length !== 0
        && event.kind !== "post-assignability"
        && !isComplementaryCheckedPropertySelection(existing, event)) {
        failClosed(state, `conflicting '${event.kind}' events were recorded for one source decision`);
    }
    if (!Number.isSafeInteger(state.events.length) || state.events.length >= eventBudget) {
        failClosed(state, "event budget exceeded");
    }
    const snapshot = Object.freeze({ ...event });
    state.events.push(snapshot);
    existing.push(snapshot);
    currentFrame(state).eventInsertions.push(snapshot);
}
function isComplementaryCheckedPropertySelection(existing, event) {
    if (event.kind !== "checked-property"
        || event.accessMode !== "read-write"
        || event.callCallee
        || existing.length !== 1) {
        return false;
    }
    const candidate = existing[0];
    return candidate?.kind === "checked-property"
        && candidate.accessMode === "read-write"
        && !candidate.callCallee
        && candidate.selectionMode !== event.selectionMode;
}
export function sourceDecisionRecordingActive(checker) {
    const state = checker.extensionSourceDecisionState;
    return state !== undefined && state !== false && state.phase === "source";
}
export function sourceDecisionOwner(checker) {
    const state = checker.extensionSourceDecisionState;
    if (state === undefined || state === false || state.phase !== "source") {
        return undefined;
    }
    return state.frames[0]?.ownerSourceFile;
}
export function sourceDecisionDiscardActive(checker) {
    const state = checker.extensionSourceDecisionState;
    return state !== undefined
        && state !== false
        && state.phase === "source"
        && state.frames.some((frame) => frame.kind === "discard");
}
export function disableSourceDecisionRecording(checker) {
    const state = checker.extensionSourceDecisionState;
    if (state !== undefined && state !== false && state.phase !== "idle") {
        failClosed(state, "cannot disable recording while a transaction is active");
    }
    checker.extensionSourceDecisionState = false;
}
function createState() {
    return {
        phase: "idle",
        events: [],
        frames: [],
        eventsByOrigin: new Map(),
        signatureLinksSnapshotCount: 0,
        typeNodeLinksSnapshotCount: 0,
    };
}
function stateForSettlement(checker, frame) {
    const state = checker.extensionSourceDecisionState;
    if (state === undefined || state === false) {
        if (frame !== undefined) {
            throw new Error("Extension source-decision frame does not belong to this checker.");
        }
        return undefined;
    }
    if (state.phase === "failed") {
        throw failedStateError();
    }
    if (frame === undefined) {
        if (state.phase === "idle") {
            return undefined;
        }
        failClosed(state, "an active transaction cannot settle an absent frame");
    }
    if (state.phase !== "source") {
        failClosed(state, "frames can settle only in the source phase");
    }
    return state;
}
function preparedState(checker, prepared) {
    const state = checker.extensionSourceDecisionState;
    if (!prepared.active) {
        throw new Error("Prepared extension source decision is no longer active.");
    }
    if (state === undefined || state === false) {
        throw new Error("Prepared extension source decision does not belong to this checker.");
    }
    if (state.phase === "failed") {
        throw failedStateError();
    }
    if (state.phase !== "publishing") {
        return failClosed(state, "prepared decisions can settle only in the publishing phase");
    }
    const frame = prepared.frame;
    if (state.frames.length !== 1 || state.frames[0] !== frame || frame.settled) {
        return failClosed(state, "prepared root frame is not active");
    }
    return state;
}
function isRuntimeCheckedOperationEvent(event) {
    switch (event.kind) {
        case "checked-call":
        case "checked-property":
        case "checked-element":
        case "checked-operator":
        case "checked-iteration":
        case "assertion-conversion":
        case "flow-use":
            return true;
        case "target-constraint":
        case "runtime-carrier":
        case "contextual-target":
        case "post-assignability":
            return false;
    }
}
function currentFrame(state) {
    const frame = state.frames[state.frames.length - 1];
    if (frame === undefined || frame.settled || frame.depth !== state.frames.length - 1) {
        return failClosed(state, "source phase has no valid active frame");
    }
    return frame;
}
function activeFrame(state, frame) {
    const active = currentFrame(state);
    if (active !== frame) {
        return failClosed(state, "frames must settle exactly once in LIFO order");
    }
    if (!Number.isSafeInteger(active.eventMark)
        || active.eventMark < 0
        || active.eventMark > state.events.length) {
        return failClosed(state, "frame event mark is invalid");
    }
    return active;
}
function rollbackTopFrame(state, frame) {
    restoreSignatureLinksSnapshots(frame.signatureLinksSnapshots);
    removeSignatureLinksSnapshots(state, frame.signatureLinksSnapshots.length);
    frame.signatureLinksSnapshots.length = 0;
    restoreTypeNodeLinksSnapshots(frame.typeNodeLinksSnapshots);
    removeTypeNodeLinksSnapshots(state, frame.typeNodeLinksSnapshots.length);
    frame.typeNodeLinksSnapshots.length = 0;
    removeEventInsertions(state, frame.eventInsertions);
    frame.eventInsertions.length = 0;
    state.events.length = frame.eventMark;
    settleTopFrame(state, frame);
    if (frame.depth === 0) {
        if (frame.kind !== "source-file"
            || state.frames.length !== 0
            || state.signatureLinksSnapshotCount !== 0
            || state.typeNodeLinksSnapshotCount !== 0) {
            failClosed(state, "root rollback did not empty the transaction");
        }
        state.events.length = 0;
        state.eventsByOrigin.clear();
        state.phase = "idle";
    }
}
function settleTopFrame(state, frame) {
    const popped = state.frames.pop();
    if (popped !== frame || frame.settled) {
        failClosed(state, "frame settlement violated LIFO order");
    }
    frame.settled = true;
}
function mergeSignatureLinksSnapshots(state, parent, child) {
    for (const childSnapshot of child.signatureLinksSnapshots) {
        let alreadyJournaled = false;
        for (const parentSnapshot of parent.signatureLinksSnapshots) {
            if (parentSnapshot.links === childSnapshot.links) {
                alreadyJournaled = true;
                break;
            }
        }
        if (alreadyJournaled) {
            removeSignatureLinksSnapshots(state, 1);
        }
        else {
            parent.signatureLinksSnapshots.push(childSnapshot);
        }
    }
    child.signatureLinksSnapshots.length = 0;
    mergeTypeNodeLinksSnapshots(state, parent, child);
    parent.eventInsertions.push(...child.eventInsertions);
    child.eventInsertions.length = 0;
}
function mergeTypeNodeLinksSnapshots(state, parent, child) {
    for (const childSnapshot of child.typeNodeLinksSnapshots) {
        let alreadyJournaled = false;
        for (const parentSnapshot of parent.typeNodeLinksSnapshots) {
            if (parentSnapshot.links === childSnapshot.links) {
                alreadyJournaled = true;
                break;
            }
        }
        if (alreadyJournaled) {
            removeTypeNodeLinksSnapshots(state, 1);
        }
        else {
            parent.typeNodeLinksSnapshots.push(childSnapshot);
        }
    }
    child.typeNodeLinksSnapshots.length = 0;
}
function removeSignatureLinksSnapshots(state, count) {
    if (!Number.isSafeInteger(count)
        || count < 0
        || !Number.isSafeInteger(state.signatureLinksSnapshotCount)
        || count > state.signatureLinksSnapshotCount) {
        failClosed(state, "SignatureLinks snapshot count is inconsistent");
    }
    state.signatureLinksSnapshotCount -= count;
}
function removeTypeNodeLinksSnapshots(state, count) {
    if (!Number.isSafeInteger(count)
        || count < 0
        || !Number.isSafeInteger(state.typeNodeLinksSnapshotCount)
        || count > state.typeNodeLinksSnapshotCount) {
        failClosed(state, "TypeNodeLinks snapshot count is inconsistent");
    }
    state.typeNodeLinksSnapshotCount -= count;
}
function restoreSignatureLinksSnapshots(snapshots) {
    for (let index = snapshots.length - 1; index >= 0; index--) {
        const snapshot = snapshots[index];
        if (snapshot === undefined) {
            throw new Error("Extension source-decision SignatureLinks journal is sparse.");
        }
        snapshot.links.checkedCallSelectionSeed = snapshot.checkedCallSelectionSeed;
        snapshot.links.resolvedCallSelectionEvidence = snapshot.resolvedCallSelectionEvidence;
        snapshot.links.resolvedCallEvidence = snapshot.resolvedCallEvidence;
        snapshot.links.extensionSourceDecisionOwner = snapshot.extensionSourceDecisionOwner;
    }
}
function restoreTypeNodeLinksSnapshots(snapshots) {
    for (let index = snapshots.length - 1; index >= 0; index--) {
        const snapshot = snapshots[index];
        if (snapshot === undefined) {
            throw new Error("Extension source-decision TypeNodeLinks journal is sparse.");
        }
        snapshot.links.extensionSourceDecisionOwner = snapshot.extensionSourceDecisionOwner;
    }
}
function failClosed(state, reason) {
    state.phase = "failed";
    for (let frameIndex = state.frames.length - 1; frameIndex >= 0; frameIndex--) {
        const frame = state.frames[frameIndex];
        if (frame !== undefined) {
            restoreSignatureLinksSnapshots(frame.signatureLinksSnapshots);
            frame.signatureLinksSnapshots.length = 0;
            restoreTypeNodeLinksSnapshots(frame.typeNodeLinksSnapshots);
            frame.typeNodeLinksSnapshots.length = 0;
            frame.settled = true;
        }
    }
    state.events.length = 0;
    state.eventsByOrigin.clear();
    state.frames.length = 0;
    state.signatureLinksSnapshotCount = 0;
    state.typeNodeLinksSnapshotCount = 0;
    throw new Error(`Extension source-decision transaction failed closed: ${reason}.`);
}
function eventsForIdentity(state, event) {
    let byKind = state.eventsByOrigin.get(event.origin);
    if (byKind === undefined) {
        byKind = new Map();
        state.eventsByOrigin.set(event.origin, byKind);
    }
    let events = byKind.get(event.kind);
    if (events === undefined) {
        events = [];
        byKind.set(event.kind, events);
    }
    return events;
}
function removeEventInsertions(state, insertions) {
    for (let index = insertions.length - 1; index >= 0; index--) {
        const event = insertions[index];
        if (event === undefined) {
            failClosed(state, "event insertion journal is sparse");
        }
        const byKind = state.eventsByOrigin.get(event.origin);
        const events = byKind?.get(event.kind);
        if (events === undefined || events[events.length - 1] !== event) {
            failClosed(state, "event insertion journal is inconsistent");
        }
        events.pop();
        if (events.length === 0) {
            byKind.delete(event.kind);
        }
        if (byKind.size === 0) {
            state.eventsByOrigin.delete(event.origin);
        }
    }
}
function sourceDecisionEventsEquivalent(left, right) {
    if (left === right) {
        return true;
    }
    if (left.kind !== right.kind || left.origin !== right.origin) {
        return false;
    }
    switch (left.kind) {
        case "checked-call":
            return right.kind === left.kind && resolvedCallEvidenceEquivalent(left.resolvedCallEvidence, right.resolvedCallEvidence);
        case "checked-property":
            return right.kind === left.kind
                && left.selectedSymbol === right.selectedSymbol
                && left.selectedDeclaration === right.selectedDeclaration
                && checkedSourceTypesShareStableIdentity(left.resultType, right.resultType)
                && checkedSourceTypesShareStableIdentity(left.receiverType, right.receiverType)
                && left.selectionMode === right.selectionMode
                && left.accessMode === right.accessMode
                && left.callCallee === right.callCallee;
        case "checked-element":
            return right.kind === left.kind
                && left.selectedSymbol === right.selectedSymbol
                && left.selectedDeclaration === right.selectedDeclaration
                && checkedSourceTypesShareStableIdentity(left.resultType, right.resultType)
                && left.selectedElementIndex === right.selectedElementIndex
                && checkedSourceTypesShareStableIdentity(left.receiverType, right.receiverType)
                && checkedSourceTypesShareStableIdentity(left.argumentType, right.argumentType)
                && left.accessMode === right.accessMode
                && left.callCallee === right.callCallee;
        case "checked-operator":
            return right.kind === left.kind
                && left.operator === right.operator
                && left.left === right.left
                && left.right === right.right
                && checkedSourceTypesShareStableIdentity(left.sourceLeftType, right.sourceLeftType)
                && optionalSourceTypesEquivalent(left.sourceRightType, right.sourceRightType)
                && checkedSourceTypesShareStableIdentity(left.sourceResultType, right.sourceResultType);
        case "checked-iteration":
            return right.kind === left.kind
                && extensionCheckedIterationSelectionsEquivalent(left.selection, right.selection);
        case "assertion-conversion":
            return right.kind === left.kind
                && left.sourceExpression === right.sourceExpression
                && left.explicitTargetTypeNode === right.explicitTargetTypeNode
                && checkedSourceTypesShareStableIdentity(left.sourceType, right.sourceType)
                && checkedSourceTypesShareStableIdentity(left.targetType, right.targetType)
                && left.assertionKind === right.assertionKind
                && left.sourceSelectedSymbol === right.sourceSelectedSymbol
                && left.sourceSelectedDeclaration === right.sourceSelectedDeclaration
                && left.sourceSelectedDeclarationTypeNode === right.sourceSelectedDeclarationTypeNode;
        case "target-constraint":
            return right.kind === left.kind && left.symbol === right.symbol;
        case "runtime-carrier":
            return right.kind === left.kind
                && checkedSourceTypesShareStableIdentity(left.type, right.type)
                && left.symbol === right.symbol;
        case "contextual-target":
            return right.kind === left.kind
                && checkedSourceTypesShareStableIdentity(left.contextualType, right.contextualType);
        case "post-assignability":
            return right.kind === left.kind
                && checkedSourceTypesShareStableIdentity(left.source, right.source)
                && checkedSourceTypesShareStableIdentity(left.target, right.target)
                && left.errorNode === right.errorNode
                && left.expression === right.expression
                && left.relation === right.relation;
        case "flow-use":
            return right.kind === left.kind
                && left.symbol === right.symbol
                && left.sourceUse.kind === right.sourceUse.kind
                && (left.sourceUse.kind !== "ordinary"
                    || right.sourceUse.kind === "ordinary" && left.sourceUse.access === right.sourceUse.access);
    }
}
function optionalSourceTypesEquivalent(left, right) {
    return left === undefined || right === undefined
        ? left === right
        : checkedSourceTypesShareStableIdentity(left, right);
}
function extensionCheckedIterationSelectionsEquivalent(left, right) {
    if (left.iterationKind !== right.iterationKind
        || !checkedSourceTypesShareStableIdentity(left.sourceIterableType, right.sourceIterableType)
        || !checkedSourceTypesShareStableIdentity(left.sourceElementType, right.sourceElementType)) {
        return false;
    }
    switch (left.iterationKind) {
        case "for-in":
            return right.iterationKind === "for-in" && left.mechanism.kind === right.mechanism.kind;
        case "for-of":
            return right.iterationKind === "for-of"
                && extensionForOfMechanismsEquivalent(left.mechanism, right.mechanism);
        case "for-await-of":
            return right.iterationKind === "for-await-of"
                && extensionForAwaitOfMechanismsEquivalent(left.mechanism, right.mechanism);
    }
}
function extensionForOfMechanismsEquivalent(left, right) {
    if (left.kind !== right.kind) {
        return false;
    }
    if (left.kind === "union") {
        return right.kind === "union"
            && left.alternatives.length === right.alternatives.length
            && left.alternatives.every((alternative, index) => extensionForOfAtomicMechanismsEquivalent(alternative, right.alternatives[index]));
    }
    return right.kind !== "union" && extensionForOfAtomicMechanismsEquivalent(left, right);
}
function extensionForOfAtomicMechanismsEquivalent(left, right) {
    if (left.kind !== right.kind
        || !checkedSourceTypesShareStableIdentity(left.sourceIterableType, right.sourceIterableType)) {
        return false;
    }
    switch (left.kind) {
        case "synchronous-iterator-protocol":
            return right.kind === "synchronous-iterator-protocol"
                && extensionIterationProtocolsEquivalent(left.protocol, right.protocol);
        case "array-like-index":
            return right.kind === "array-like-index"
                && checkedSourceTypesShareStableIdentity(left.selectedIndexType, right.selectedIndexType);
        case "string-code-unit-index":
        case "untyped-dynamic-iteration":
            return true;
    }
}
function extensionForAwaitOfMechanismsEquivalent(left, right) {
    if (left.kind !== right.kind) {
        return false;
    }
    if (left.kind === "union") {
        return right.kind === "union"
            && left.alternatives.length === right.alternatives.length
            && left.alternatives.every((alternative, index) => extensionForAwaitOfAtomicMechanismsEquivalent(alternative, right.alternatives[index]));
    }
    return right.kind !== "union" && extensionForAwaitOfAtomicMechanismsEquivalent(left, right);
}
function extensionForAwaitOfAtomicMechanismsEquivalent(left, right) {
    if (left.kind !== right.kind
        || !checkedSourceTypesShareStableIdentity(left.sourceIterableType, right.sourceIterableType)) {
        return false;
    }
    switch (left.kind) {
        case "asynchronous-iterator-protocol":
        case "synchronous-iterator-adapted-to-async":
            return right.kind === left.kind
                && extensionIterationProtocolsEquivalent(left.protocol, right.protocol);
        case "array-like-index-adapted-to-async":
            return right.kind === "array-like-index-adapted-to-async"
                && checkedSourceTypesShareStableIdentity(left.selectedIndexType, right.selectedIndexType);
        case "string-code-unit-index-adapted-to-async":
        case "untyped-dynamic-iteration":
            return true;
    }
}
function extensionIterationProtocolsEquivalent(left, right) {
    if (left.resolutionKind !== right.resolutionKind
        || !checkedSourceTypesShareStableIdentity(left.sourceIterableType, right.sourceIterableType)
        || !extensionIterationTypesEquivalent(left.iterationTypes, right.iterationTypes)) {
        return false;
    }
    if (left.resolutionKind === "known-iterable-instantiation") {
        return right.resolutionKind === "known-iterable-instantiation"
            && checkedSourceTypesShareStableIdentity(left.iterableTargetType, right.iterableTargetType)
            && left.iterableSymbol === right.iterableSymbol
            && left.iterableValueDeclaration === right.iterableValueDeclaration
            && extensionSubjectArraysEquivalent(left.iterableDeclarations, right.iterableDeclarations);
    }
    return right.resolutionKind === "selected-iterator-member"
        && left.iteratorMethodSymbol === right.iteratorMethodSymbol
        && left.iteratorMethodValueDeclaration === right.iteratorMethodValueDeclaration
        && extensionSubjectArraysEquivalent(left.iteratorMethodDeclarations, right.iteratorMethodDeclarations)
        && checkedSourceTypesShareStableIdentity(left.iteratorMethodType, right.iteratorMethodType)
        && checkedSourceTypesShareStableIdentity(left.iteratorType, right.iteratorType);
}
function extensionIterationTypesEquivalent(left, right) {
    return optionalSourceTypesEquivalent(left.yieldType, right.yieldType)
        && optionalSourceTypesEquivalent(left.returnType, right.returnType)
        && optionalSourceTypesEquivalent(left.nextType, right.nextType);
}
function extensionSubjectArraysEquivalent(left, right) {
    return left.length === right.length && left.every((subject, index) => subject === right[index]);
}
function resolvedCallEvidenceEquivalent(left, right) {
    return left.outcome === right.outcome
        && left.call === right.call
        && left.selectedSignature === right.selectedSignature
        && left.sourceSelectedSignatureKind === right.sourceSelectedSignatureKind
        && optionalMethodTypeArgumentsEquivalent(left.sourceSelectedMethodTypeArguments, right.sourceSelectedMethodTypeArguments)
        && signatureParametersEquivalent(left.sourceSelectedSignatureParameters, right.sourceSelectedSignatureParameters)
        && sourceValuesEquivalent(left.sourceCallee, right.sourceCallee)
        && sourceValueListsEquivalent(left.sourceArguments, right.sourceArguments)
        && argumentBindingsEquivalent(left.sourceArgumentBindings, right.sourceArgumentBindings)
        && optionalSourceValuesEquivalent(left.sourceReceiver, right.sourceReceiver)
        && checkedSourceTypesShareStableIdentity(left.sourceResultType, right.sourceResultType);
}
function sourceValuesEquivalent(left, right) {
    return left.expression === right.expression
        && checkedSourceTypesShareStableIdentity(left.type, right.type)
        && left.symbol === right.symbol
        && left.declaration === right.declaration
        && left.selectedSymbol === right.selectedSymbol
        && left.selectedDeclaration === right.selectedDeclaration
        && left.authoredTypeNode === right.authoredTypeNode;
}
function optionalSourceValuesEquivalent(left, right) {
    return left === undefined || right === undefined ? left === right : sourceValuesEquivalent(left, right);
}
function sourceValueListsEquivalent(left, right) {
    return sameLengthAndEvery(left, right, sourceValuesEquivalent);
}
function optionalMethodTypeArgumentsEquivalent(left, right) {
    if (left === undefined || right === undefined) {
        return left === right;
    }
    return sameLengthAndEvery(left, right, (leftArgument, rightArgument) => leftArgument.typeParameterName === rightArgument.typeParameterName
        && checkedSourceTypesShareStableIdentity(leftArgument.typeParameter, rightArgument.typeParameter)
        && checkedSourceTypesShareStableIdentity(leftArgument.selectedType, rightArgument.selectedType)
        && leftArgument.explicitTypeNode === rightArgument.explicitTypeNode);
}
function signatureParametersEquivalent(left, right) {
    return sameLengthAndEvery(left, right, (leftParameter, rightParameter) => leftParameter.parameterIndex === rightParameter.parameterIndex
        && leftParameter.parameterName === rightParameter.parameterName
        && leftParameter.parameterSymbol === rightParameter.parameterSymbol
        && leftParameter.parameterDeclaration === rightParameter.parameterDeclaration
        && checkedSourceTypesShareStableIdentity(leftParameter.selectedType, rightParameter.selectedType)
        && leftParameter.authoredTypeNode === rightParameter.authoredTypeNode
        && leftParameter.acceptsOmission === rightParameter.acceptsOmission
        && leftParameter.rest === rightParameter.rest);
}
function argumentBindingsEquivalent(left, right) {
    return sameLengthAndEvery(left, right, (leftBinding, rightBinding) => leftBinding.sourceArgumentIndex === rightBinding.sourceArgumentIndex
        && leftBinding.effectiveArgumentIndex === rightBinding.effectiveArgumentIndex
        && leftBinding.sourceForm === rightBinding.sourceForm
        && leftBinding.spreadElementIndex === rightBinding.spreadElementIndex
        && leftBinding.sourceParameterIndex === rightBinding.sourceParameterIndex
        && leftBinding.sourceParameterForm === rightBinding.sourceParameterForm
        && checkedSourceTypesShareStableIdentity(leftBinding.selectedArgumentType, rightBinding.selectedArgumentType)
        && checkedSourceTypesShareStableIdentity(leftBinding.selectedParameterType, rightBinding.selectedParameterType));
}
function sameLengthAndEvery(left, right, equivalent) {
    return left.length === right.length
        && left.every((leftValue, index) => equivalent(leftValue, right[index]));
}
function failedStateError() {
    return new Error("Extension source-decision transaction is permanently failed.");
}
//# sourceMappingURL=checker-source-decisions.js.map