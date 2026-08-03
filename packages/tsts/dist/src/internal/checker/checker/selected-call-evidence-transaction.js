const frameBudget = 1_024;
const snapshotBudget = 65_536;
export function beginSelectedCallEvidenceFrame(checker, kind) {
    let state = checker.selectedCallEvidenceTransactionState;
    if (state === undefined) {
        if (kind !== "signature-resolution") {
            return undefined;
        }
        state = {
            failed: false,
            frames: [],
            snapshotCount: 0,
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
    const frame = {
        kind,
        depth: state.frames.length,
        settled: false,
        snapshots: [],
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
    settleTopFrame(state, record);
}
export function rollbackSelectedCallEvidenceFrame(checker, frame) {
    const state = stateForSettlement(checker, frame);
    if (state === undefined || frame === undefined) {
        return;
    }
    const record = activeFrame(state, frame);
    restoreSnapshots(record.snapshots);
    removeSnapshots(state, record.snapshots.length);
    record.snapshots.length = 0;
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
    if (!Number.isSafeInteger(state.snapshotCount) || state.snapshotCount >= snapshotBudget) {
        failClosed(checker, state, "SignatureLinks snapshot budget exceeded");
    }
    frame.snapshots.push({
        links,
        resolvedSignature: links.resolvedSignature,
        checkedCallSelectionSeed: links.checkedCallSelectionSeed,
        resolvedCallSelectionEvidence: links.resolvedCallSelectionEvidence,
        resolvedCallEvidence: links.resolvedCallEvidence,
    });
    state.snapshotCount++;
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
    removeSnapshots(state, frame.snapshots.length);
    frame.snapshots.length = 0;
    settleTopFrame(state, frame);
    if (state.snapshotCount !== 0 || state.frames.length !== 0) {
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
        || !Number.isSafeInteger(state.snapshotCount)
        || count > state.snapshotCount) {
        throw new Error("Selected-call evidence snapshot count is inconsistent.");
    }
    state.snapshotCount -= count;
}
function failClosed(checker, state, reason) {
    state.failed = true;
    for (let index = state.frames.length - 1; index >= 0; index--) {
        const frame = state.frames[index];
        if (frame !== undefined) {
            restoreSnapshots(frame.snapshots);
            frame.snapshots.length = 0;
            frame.settled = true;
        }
    }
    state.frames.length = 0;
    state.snapshotCount = 0;
    checker.selectedCallEvidenceTransactionState = undefined;
    throw new Error(`Selected-call evidence transaction failed closed: ${reason}.`);
}
function failedStateError() {
    return new Error("Selected-call evidence transaction is failed.");
}
//# sourceMappingURL=selected-call-evidence-transaction.js.map