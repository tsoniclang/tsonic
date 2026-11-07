import { copySelectedCallInferenceContext, createSelectedCallInferenceJournal } from "./selected-call-inference-evidence.js";
const frameBudget = 1_024;
const snapshotBudget = 65_536;
const inferenceBudget = 65_536;
export function beginSelectedCallEvidenceFrame(checker, kind) {
    let state = checker.selectedCallEvidenceTransactionState;
    if (state === undefined) {
        if (kind !== "signature-resolution") {
            return undefined;
        }
        state = {
            failed: false,
            frames: [],
            entryCount: 0,
            inferenceEntryCount: 0,
        };
        checker.selectedCallEvidenceTransactionState = state;
    }
    if (state.failed) {
        throw failedStateError();
    }
    if (kind !== "signature-resolution" && state.frames.length === 0) {
        return failClosed(checker, state, "a nested frame has no signature-resolution owner");
    }
    if (!Number.isSafeInteger(state.frames.length) || state.frames.length >= frameBudget) {
        return failClosed(checker, state, "frame budget exceeded");
    }
    const transaction = state;
    const contexts = [];
    const frame = {
        kind,
        depth: state.frames.length,
        settled: false,
        snapshots: [],
        candidate: undefined,
        contexts,
        defaults: [],
        inference: createSelectedCallInferenceJournal(contexts, () => {
            if (transaction.failed || checker.selectedCallEvidenceTransactionState !== transaction
                || transaction.inferenceEntryCount >= inferenceBudget)
                return false;
            transaction.inferenceEntryCount++;
            return true;
        }, () => {
            if (transaction.failed || checker.selectedCallEvidenceTransactionState !== transaction)
                return;
            removeInferenceEntries(transaction, 1);
        }),
    };
    state.frames.push(frame);
    return frame;
}
export function commitSelectedCallEvidenceFrame(checker, frame) {
    const state = stateForSettlement(checker, frame);
    if (state === undefined || frame === undefined) {
        return;
    }
    const record = activeFrame(state, frame);
    if (record.kind === "discard") {
        failClosed(checker, state, "discard frames cannot commit");
    }
    const parent = state.frames[state.frames.length - 2];
    if (parent === undefined) {
        settleRoot(checker, state, record);
        return;
    }
    mergeSnapshots(state, parent, record);
    if (record.inference.traces.length !== 0)
        failClosed(checker, state, "selected inference origin is still active at commit");
    removeSnapshots(state, record.defaults.length + record.contexts.length);
    removeInferenceEntries(state, record.inference.records.length);
    record.inference.records.length = 0;
    record.defaults.length = 0;
    record.contexts.length = 0;
    settleTopFrame(state, record);
}
export function rollbackSelectedCallEvidenceFrame(checker, frame) {
    const state = stateForSettlement(checker, frame);
    if (state === undefined || frame === undefined) {
        return;
    }
    const record = activeFrame(state, frame);
    restoreSnapshots(record.snapshots);
    if (record.inference.traces.length !== 0)
        failClosed(checker, state, "selected inference origin is still active at rollback");
    removeSnapshots(state, record.snapshots.length + record.defaults.length + record.contexts.length);
    removeInferenceEntries(state, record.inference.records.length);
    record.inference.records.length = 0;
    record.snapshots.length = 0;
    record.defaults.length = 0;
    record.contexts.length = 0;
    settleTopFrame(state, record);
    if (state.frames.length === 0) {
        checker.selectedCallEvidenceTransactionState = undefined;
    }
}
export function journalSelectedCallEvidence(checker, links) {
    const state = checker.selectedCallEvidenceTransactionState;
    if (state === undefined || state.frames.length === 0) {
        return;
    }
    if (state.failed) {
        throw failedStateError();
    }
    const frame = currentFrame(state);
    if (frame.snapshots.some((snapshot) => snapshot.links === links)) {
        return;
    }
    if (!Number.isSafeInteger(state.entryCount) || state.entryCount >= snapshotBudget) {
        failClosed(checker, state, "SignatureLinks snapshot budget exceeded");
    }
    frame.snapshots.push({
        links,
        resolvedSignature: links.resolvedSignature,
        checkedCallSelectionSeed: links.checkedCallSelectionSeed,
        resolvedCallSelectionEvidence: links.resolvedCallSelectionEvidence,
        resolvedCallEvidence: links.resolvedCallEvidence,
    });
    state.entryCount++;
}
export function bindSelectedCallDefaultOwner(checker, frame, candidate) {
    const state = stateForSettlement(checker, frame);
    if (state === undefined || frame === undefined)
        return;
    const record = activeFrame(state, frame);
    if (record.kind !== "overload-candidate" || record.candidate !== undefined) {
        failClosed(checker, state, "a selected-default owner is not one exact overload candidate");
    }
    record.candidate = candidate;
}
export function bindSelectedCallDefaultContext(checker, frame, context) {
    const state = stateForSettlement(checker, frame);
    if (state === undefined || frame === undefined)
        return;
    retainDefaultContext(checker, state, activeFrame(state, frame), context);
}
function retainDefaultContext(checker, state, frame, context) {
    if (frame.kind !== "overload-candidate" || frame.candidate !== context.signature) {
        failClosed(checker, state, "a selected-default inference context has a different candidate owner");
    }
    if (frame.contexts.includes(context))
        return;
    if (!Number.isSafeInteger(state.entryCount) || state.entryCount >= snapshotBudget) {
        failClosed(checker, state, "selected-default context budget exceeded");
    }
    frame.contexts.push(context);
    state.entryCount++;
}
export function retainSelectedCallDefault(checker, context, parameter, selectedType, defaultTypeNode) {
    const owner = selectedDefaultOwner(checker, context, parameter);
    if (owner === undefined)
        return;
    const { state, frame } = owner;
    const previous = frame.defaults.findIndex(entry => entry.context === context && entry.parameter === parameter);
    if (defaultTypeNode === undefined) {
        if (previous >= 0) {
            frame.defaults.splice(previous, 1);
            removeSnapshots(state, 1);
        }
        return;
    }
    const contribution = Object.freeze({ context, parameter, selectedType, defaultTypeNode });
    if (previous >= 0) {
        frame.defaults[previous] = contribution;
        return;
    }
    if (!Number.isSafeInteger(state.entryCount) || state.entryCount >= snapshotBudget) {
        failClosed(checker, state, "selected-default contribution budget exceeded");
    }
    frame.defaults.push(contribution);
    state.entryCount++;
}
export function selectedCallDefaultNode(checker, context, parameter, selectedType) {
    const owner = selectedDefaultOwner(checker, context, parameter);
    const contribution = owner?.frame.defaults.find(entry => entry.context === context && entry.parameter === parameter);
    if (contribution?.selectedType !== selectedType || context !== undefined &&
        context.inferences.find(inference => inference?.typeParameter === parameter)?.inferredType !== selectedType)
        return undefined;
    return contribution?.defaultTypeNode;
}
export function copySelectedCallDefaults(checker, source, destination) {
    if (source.signature !== destination.signature)
        return;
    const state = checker.selectedCallEvidenceTransactionState;
    if (state === undefined)
        return;
    if (state.failed)
        throw failedStateError();
    const frame = state.frames.find(candidate => candidate.contexts.includes(source));
    if (frame === undefined)
        return;
    retainDefaultContext(checker, state, frame, destination);
    copySelectedCallInferenceContext(frame.inference, source, destination);
    for (const inference of destination.inferences) {
        const parameter = inference?.typeParameter;
        const selectedType = inference?.inferredType;
        if (parameter === undefined || selectedType === undefined)
            continue;
        const node = selectedCallDefaultNode(checker, source, parameter, selectedType);
        if (node !== undefined)
            retainSelectedCallDefault(checker, destination, parameter, selectedType, node);
    }
}
export function selectedCallInferenceJournal(checker, inferences) {
    const state = checker.selectedCallEvidenceTransactionState;
    if (state === undefined)
        return undefined;
    if (state.failed)
        throw failedStateError();
    return state.frames.findLast(frame => frame.kind === "overload-candidate" &&
        frame.contexts.some(context => context.inferences === inferences))?.inference;
}
function selectedDefaultOwner(checker, context, parameter) {
    const state = checker.selectedCallEvidenceTransactionState;
    if (state === undefined)
        return undefined;
    if (state.failed)
        throw failedStateError();
    for (let index = state.frames.length - 1; index >= 0; index--) {
        const frame = state.frames[index];
        if (frame?.kind === "overload-candidate" && frame.candidate?.typeParameters.includes(parameter) &&
            (context === undefined || frame.contexts.includes(context)))
            return { state, frame };
    }
    return undefined;
}
function stateForSettlement(checker, frame) {
    const state = checker.selectedCallEvidenceTransactionState;
    if (state === undefined) {
        if (frame !== undefined) {
            throw new Error("Selected-call evidence frame does not belong to this checker.");
        }
        return undefined;
    }
    if (state.failed) {
        throw failedStateError();
    }
    if (frame === undefined) {
        return undefined;
    }
    return state;
}
function activeFrame(state, frame) {
    const record = state.frames[state.frames.length - 1];
    if (record === undefined || record !== frame || record.settled || record.depth !== state.frames.length - 1) {
        throw new Error("Selected-call evidence frames must settle in strict stack order.");
    }
    return record;
}
function currentFrame(state) {
    const frame = state.frames[state.frames.length - 1];
    if (frame === undefined || frame.settled) {
        throw new Error("Selected-call evidence mutation requires an active frame.");
    }
    return frame;
}
function mergeSnapshots(state, parent, child) {
    for (const childSnapshot of child.snapshots) {
        if (parent.snapshots.some((parentSnapshot) => parentSnapshot.links === childSnapshot.links)) {
            removeSnapshots(state, 1);
        }
        else {
            parent.snapshots.push(childSnapshot);
        }
    }
    child.snapshots.length = 0;
}
function restoreSnapshots(snapshots) {
    for (let index = snapshots.length - 1; index >= 0; index--) {
        const snapshot = snapshots[index];
        if (snapshot === undefined) {
            throw new Error("Selected-call evidence journal is sparse.");
        }
        const currentSelection = snapshot.links.resolvedCallSelectionEvidence;
        const currentSignature = snapshot.links.resolvedSignature;
        if (currentSignature !== snapshot.resolvedSignature) {
            if (currentSelection?.selectedSignature === currentSignature) {
                if (snapshot.links.resolvedCallEvidence !== undefined
                    && snapshot.links.resolvedCallEvidence.selectedSignature !== currentSignature) {
                    throw new Error("Selected-call evidence rollback found final evidence for a different cached signature.");
                }
                continue;
            }
            snapshot.links.checkedCallSelectionSeed = undefined;
            snapshot.links.resolvedCallSelectionEvidence = undefined;
            snapshot.links.resolvedCallEvidence = undefined;
            continue;
        }
        snapshot.links.checkedCallSelectionSeed = snapshot.checkedCallSelectionSeed;
        snapshot.links.resolvedCallSelectionEvidence = snapshot.resolvedCallSelectionEvidence;
        snapshot.links.resolvedCallEvidence = snapshot.resolvedCallEvidence;
    }
}
function settleRoot(checker, state, frame) {
    if (frame.inference.traces.length !== 0)
        failClosed(checker, state, "selected inference origin is still active at root settlement");
    removeSnapshots(state, frame.snapshots.length + frame.defaults.length + frame.contexts.length);
    removeInferenceEntries(state, frame.inference.records.length);
    frame.inference.records.length = 0;
    frame.snapshots.length = 0;
    frame.defaults.length = 0;
    frame.contexts.length = 0;
    settleTopFrame(state, frame);
    if (state.entryCount !== 0 || state.inferenceEntryCount !== 0 || state.frames.length !== 0) {
        failClosed(checker, state, "root settlement retained transaction state");
    }
    checker.selectedCallEvidenceTransactionState = undefined;
}
function settleTopFrame(state, frame) {
    const top = state.frames.pop();
    if (top !== frame) {
        throw new Error("Selected-call evidence frame stack changed during settlement.");
    }
    frame.settled = true;
}
function removeSnapshots(state, count) {
    if (!Number.isSafeInteger(count)
        || count < 0
        || !Number.isSafeInteger(state.entryCount)
        || count > state.entryCount) {
        throw new Error("Selected-call evidence snapshot count is inconsistent.");
    }
    state.entryCount -= count;
}
function removeInferenceEntries(state, count) {
    if (!Number.isSafeInteger(count) || count < 0
        || !Number.isSafeInteger(state.inferenceEntryCount) || count > state.inferenceEntryCount) {
        throw new Error("Selected-call inference contribution count is inconsistent.");
    }
    state.inferenceEntryCount -= count;
}
function failClosed(checker, state, reason) {
    state.failed = true;
    for (let index = state.frames.length - 1; index >= 0; index--) {
        const frame = state.frames[index];
        if (frame !== undefined) {
            restoreSnapshots(frame.snapshots);
            frame.snapshots.length = 0;
            frame.defaults.length = 0;
            frame.contexts.length = 0;
            frame.settled = true;
        }
    }
    state.frames.length = 0;
    state.entryCount = 0;
    state.inferenceEntryCount = 0;
    checker.selectedCallEvidenceTransactionState = undefined;
    throw new Error(`Selected-call evidence transaction failed closed: ${reason}.`);
}
function failedStateError() {
    return new Error("Selected-call evidence transaction is failed.");
}
//# sourceMappingURL=selected-call-evidence-transaction.js.map