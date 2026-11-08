import { TypeFlagsUnion, Type_Types } from "../types.js";
const unavailable = Object.freeze({ kind: "unavailable" });
export function createSelectedCallInferenceJournal(contexts, reserve, release) {
    let complete = true;
    return {
        contexts,
        records: [],
        traces: [],
        get complete() { return complete; },
        reserve: () => {
            if (!complete)
                return false;
            complete = reserve();
            return complete;
        },
        release,
        invalidate: () => { complete = false; },
        returnContexts: new Map(),
    };
}
export function withSelectedCallInferenceOrigin(journal, context, origin, sourceType, formalType, operation) {
    if (journal === undefined || !journal.reserve())
        return operation();
    const trace = {
        context,
        origin: Object.freeze(origin),
        sourceRootType: sourceType,
        formalRootType: formalType,
        sourceType,
        formalType,
        sourcePath: Object.freeze([]),
        formalPath: Object.freeze([]),
        complete: true,
        typeArguments: undefined,
        signatures: undefined,
    };
    journal.traces.push(trace);
    try {
        return operation();
    }
    finally {
        if (journal.traces.pop() !== trace)
            throw new Error("Selected inference origins must settle in stack order.");
        journal.release();
    }
}
export function withSelectedCallInferenceProjection(journal, inferences, sourceType, formalType, sourcePart, formalPart, operation) {
    return withSelectedCallInferencePaths(journal, inferences, sourceType, formalType, sourcePart === undefined ? undefined : sourcePart === null ? null : [sourcePart], formalPart === undefined ? undefined : formalPart === null ? null : [formalPart], operation);
}
export function withSelectedCallInferencePaths(journal, inferences, sourceType, formalType, sourceParts, formalParts, operation) {
    const trace = currentTrace(journal, inferences);
    if (trace === undefined || journal === undefined || !journal.reserve())
        return operation();
    const previous = {
        sourceType: trace.sourceType,
        formalType: trace.formalType,
        sourcePath: trace.sourcePath,
        formalPath: trace.formalPath,
        complete: trace.complete,
    };
    const sourceMatches = sourceParts === undefined ? trace.sourceType === sourceType
        : sourceParts !== null && sourceParts[0]?.owner === trace.sourceType;
    const formalMatches = formalParts === undefined ? trace.formalType === formalType
        : formalParts !== null && formalParts[0]?.owner === trace.formalType;
    trace.sourceType = sourceType;
    trace.formalType = formalType;
    if (sourceParts !== undefined && sourceParts !== null)
        trace.sourcePath = Object.freeze([...trace.sourcePath, ...sourceParts.map(part => Object.freeze(part))]);
    if (formalParts !== undefined && formalParts !== null)
        trace.formalPath = Object.freeze([...trace.formalPath, ...formalParts.map(part => Object.freeze(part))]);
    trace.complete = trace.complete && sourceMatches && formalMatches;
    try {
        return operation();
    }
    finally {
        Object.assign(trace, previous);
        journal.release();
    }
}
export function withSelectedCallInferenceFrame(journal, inferences, operation) {
    const trace = currentTrace(journal, inferences);
    return trace === undefined ? operation() : withSelectedCallInferenceProjection(journal, inferences, trace.sourceType, trace.formalType, undefined, undefined, operation);
}
export function selectCallInferenceProjection(journal, inferences, sourceType, formalType, sourcePart, formalPart) {
    const trace = currentTrace(journal, inferences);
    if (trace === undefined)
        return;
    const sourceMatches = sourcePart === undefined ? trace.sourceType === sourceType
        : sourcePart !== null && sourcePart.owner === trace.sourceType;
    const formalMatches = formalPart === undefined ? trace.formalType === formalType
        : formalPart !== null && formalPart.owner === trace.formalType;
    trace.sourceType = sourceType;
    trace.formalType = formalType;
    if (sourcePart !== undefined && sourcePart !== null)
        trace.sourcePath = Object.freeze([...trace.sourcePath, Object.freeze(sourcePart)]);
    if (formalPart !== undefined && formalPart !== null)
        trace.formalPath = Object.freeze([...trace.formalPath, Object.freeze(formalPart)]);
    trace.complete = trace.complete && sourceMatches && formalMatches;
}
export function selectedCallInferencePosition(journal, inferences) {
    const trace = currentTrace(journal, inferences);
    return trace === undefined ? undefined : { sourceType: trace.sourceType, formalType: trace.formalType };
}
export function withSelectedCallInferenceUnionMembers(journal, inferences, source, formal, operation) {
    const position = selectedCallInferencePosition(journal, inferences);
    if (position === undefined || source === undefined || formal === undefined)
        return operation();
    const member = (owner, selected) => {
        if (owner === selected)
            return undefined;
        if ((owner.flags & TypeFlagsUnion) === 0)
            return null;
        const index = Type_Types(owner).indexOf(selected);
        return index < 0 ? null : { kind: "union-member", owner, member: selected, index };
    };
    return withSelectedCallInferenceProjection(journal, inferences, source, formal, member(position.sourceType, source), member(position.formalType, formal), operation);
}
export function withSelectedCallInferenceTypeArguments(journal, inferences, owners, operation) {
    const trace = currentTrace(journal, inferences);
    if (trace === undefined)
        return operation();
    const previous = trace.typeArguments;
    trace.typeArguments = owners;
    try {
        return operation();
    }
    finally {
        trace.typeArguments = previous;
    }
}
export function selectedCallInferenceTypeArguments(journal, inferences) {
    return currentTrace(journal, inferences)?.typeArguments;
}
export function withSelectedCallInferenceSignatures(journal, inferences, signatures, operation) {
    const trace = currentTrace(journal, inferences);
    if (trace === undefined)
        return operation();
    const previous = trace.signatures;
    trace.signatures = signatures;
    try {
        return operation();
    }
    finally {
        trace.signatures = previous;
    }
}
export function selectedCallInferenceSignatures(journal, inferences) {
    return currentTrace(journal, inferences)?.signatures;
}
export function retainSelectedCallInferenceCandidate(journal, inferences, inference, sourceType, formalType, candidate, priority, contravariant) {
    if (journal === undefined || !journal.complete || inference.typeParameter === undefined)
        return;
    const trace = currentTrace(journal, inferences);
    const context = trace?.context ?? journal.contexts.find(candidateContext => candidateContext.inferences === inferences);
    if (context === undefined)
        return;
    const contribution = trace !== undefined && trace.complete && trace.sourceType === sourceType && trace.formalType === formalType
        ? Object.freeze({ typeParameter: inference.typeParameter, origin: trace.origin,
            sourceRootType: trace.sourceRootType, formalRootType: trace.formalRootType,
            sourcePath: trace.sourcePath, formalPath: trace.formalPath }) : undefined;
    if (!journal.reserve())
        return;
    journal.records.push({ context, parameter: inference.typeParameter, candidate, priority, contravariant, contribution });
}
export function copySelectedCallInferenceContext(journal, source, destination) {
    for (const record of journal.records.slice()) {
        if (record.context !== source)
            continue;
        if (!journal.reserve())
            return;
        journal.records.push({ ...record, context: destination });
    }
}
export function selectedCallInferenceEvidence(journal, context) {
    if (journal?.complete === false)
        return unavailable;
    if (context === undefined)
        return Object.freeze({ kind: "available", contributions: Object.freeze([]) });
    const contexts = [];
    const pending = [context];
    const visited = new Set();
    while (pending.length !== 0) {
        const selected = pending.pop();
        if (visited.has(selected))
            continue;
        visited.add(selected);
        contexts.push(selected);
        const returned = journal?.returnContexts.get(selected);
        if (returned !== undefined)
            pending.push(returned);
    }
    const contributions = [];
    for (const selected of contexts) {
        const expected = new Map();
        for (const inference of selected.inferences) {
            if (inference?.typeParameter === undefined)
                continue;
            expected.set(inference.typeParameter, {
                inference,
                positive: new Set(inference.candidates.filter((candidate) => candidate !== undefined)),
                negative: new Set(inference.contraCandidates.filter((candidate) => candidate !== undefined)),
                observedPositive: new Set(),
                observedNegative: new Set(),
            });
        }
        for (const record of journal?.records ?? []) {
            if (record.context !== selected)
                continue;
            const actual = expected.get(record.parameter);
            const candidates = record.contravariant ? actual?.negative : actual?.positive;
            if (actual === undefined || actual.inference.priority !== record.priority || !candidates?.has(record.candidate))
                continue;
            if (record.contribution === undefined)
                return unavailable;
            (record.contravariant ? actual.observedNegative : actual.observedPositive).add(record.candidate);
            contributions.push(record.contribution);
        }
        for (const actual of expected.values()) {
            if (actual.positive.size !== actual.observedPositive.size || actual.negative.size !== actual.observedNegative.size)
                return unavailable;
        }
    }
    return Object.freeze({ kind: "available", contributions: Object.freeze(contributions) });
}
function currentTrace(journal, inferences) {
    return journal?.complete ? journal.traces.findLast(trace => trace.context.inferences === inferences) : undefined;
}
//# sourceMappingURL=selected-call-inference-evidence.js.map