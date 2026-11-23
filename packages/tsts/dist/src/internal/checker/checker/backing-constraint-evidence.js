import { Node_Arguments, Node_Initializer, Node_Type } from "../../ast/ast.js";
import { IsReturnStatement, IsTypeParameterDeclaration } from "../../ast/generated/predicates.js";
import { AsTypeParameterDeclaration } from "../../ast/generated/casts.js";
import { GetContainingFunction, HasInitializer, IsCallOrNewExpression } from "../../ast/utilities.js";
import { admitNativeChecker } from "../resource-admission.js";
function stateFor(checker) {
    return checker.backingConstraintEvidenceState ??= { frames: [], records: [], candidates: [],
        roots: new Map(), invocations: new Map(), diagnosticCaptures: [],
        origins: new Map(), envelopes: new Map(), notes: new Map(), noteTrees: new Map(),
        applicability: new Set(), applicabilityRoots: new Map(), invocationFrames: [], invocationDiagnostics: new Map(),
        revision: 0, cachedRevision: -1, cached: Object.freeze([]) };
}
export function checkedComponent(node, type, kind = "value") {
    return Object.freeze({ root: Object.freeze({ kind, node, type }),
        path: Object.freeze([]), type, application: undefined });
}
export function withBackingConstraint(checker, body, operation) {
    const state = stateFor(checker);
    const frame = { body, diagnostics: [] };
    state.frames.push(frame);
    try {
        return operation();
    }
    finally {
        if (state.frames.pop() !== frame)
            throw new Error("Backing constraints must settle in exact stack order.");
    }
}
export function withBackingCandidate(checker, application, operation) {
    const candidates = stateFor(checker).candidates;
    candidates.push(application);
    try {
        return operation();
    }
    finally {
        if (candidates.pop() !== application)
            throw new Error("Backing candidate observations must settle in exact stack order.");
    }
}
export function withBackingApplicabilityConstraint(checker, body, diagnostics, operation) {
    const state = stateFor(checker);
    const firstRecord = state.records.length;
    const firstDiagnostic = diagnostics?.length ?? 0;
    const result = withBackingConstraint(checker, body, operation);
    if (body.application !== undefined) {
        for (const diagnostic of diagnostics?.slice(firstDiagnostic) ?? []) {
            if (diagnostic === undefined)
                continue;
            const tree = diagnosticTree(diagnostic);
            for (const record of state.records.slice(firstRecord)) {
                if (record.body === body && tree.has(record.diagnostic))
                    state.applicability.add(record);
            }
        }
        state.revision++;
    }
    return result;
}
export function beginBackingInvocation(checker, invocation) {
    const state = stateFor(checker);
    let diagnostics = state.invocationDiagnostics.get(invocation);
    if (diagnostics === undefined)
        state.invocationDiagnostics.set(invocation, diagnostics = new Set());
    const observation = { invocation, diagnostics };
    state.invocationFrames.push(observation);
    return observation;
}
export function endBackingInvocation(checker, observation) {
    if (observation === undefined)
        return;
    if (stateFor(checker).invocationFrames.pop() !== observation) {
        throw new Error("Call diagnostic observations must settle in exact stack order.");
    }
}
export function retainCallApplicabilityDiagnostics(checker, invocation, diagnostics) {
    const state = stateFor(checker);
    for (const diagnostic of diagnostics)
        state.applicabilityRoots.set(diagnostic, invocation);
    state.revision++;
}
export function activeBackingCandidate(checker) {
    return checker.backingConstraintEvidenceState?.candidates.at(-1);
}
export function capturePublishedDiagnostics(checker, operation) {
    const captures = stateFor(checker).diagnosticCaptures;
    const diagnostics = [];
    captures.push(diagnostics);
    try {
        operation();
        return Object.freeze(diagnostics);
    }
    finally {
        if (captures.pop() !== diagnostics)
            throw new Error("Diagnostic publication must settle in exact stack order.");
    }
}
export function observePublishedDiagnostic(checker, diagnostic) {
    if (diagnostic === undefined)
        return;
    for (const capture of checker.backingConstraintEvidenceState?.diagnosticCaptures ?? []) {
        if (!capture.includes(diagnostic))
            capture.push(diagnostic);
    }
    const state = checker.backingConstraintEvidenceState;
    if (state !== undefined) {
        for (const frame of state.invocationFrames)
            frame.diagnostics.add(diagnostic);
        for (let current = checker.currentNode; current?.Parent !== undefined; current = current.Parent) {
            const parent = current.Parent;
            if (!IsCallOrNewExpression(parent) || !(Node_Arguments(parent) ?? []).includes(current))
                continue;
            let diagnostics = state.invocationDiagnostics.get(parent);
            if (diagnostics === undefined)
                state.invocationDiagnostics.set(parent, diagnostics = new Set());
            diagnostics.add(diagnostic);
        }
        state.revision++;
    }
}
function diagnosticEdges(diagnostic) {
    return { messages: Object.freeze(diagnostic.messageChain.slice()),
        related: Object.freeze(diagnostic.relatedInformation.slice()) };
}
function diagnosticTree(diagnostic) {
    const tree = new Map();
    const pending = [diagnostic];
    while (pending.length !== 0) {
        const current = pending.pop();
        if (tree.has(current))
            continue;
        const edges = diagnosticEdges(current);
        tree.set(current, edges);
        for (const child of [...edges.messages, ...edges.related])
            if (child !== undefined)
                pending.push(child);
    }
    return tree;
}
export function retainBackingDiagnosticEnvelope(checker, diagnostic) {
    const state = stateFor(checker);
    state.envelopes.set(diagnostic, diagnosticEdges(diagnostic));
    state.revision++;
}
export function retainBackingDiagnosticNotes(checker, diagnostic, notes) {
    const state = stateFor(checker);
    const existing = state.notes.get(diagnostic) ?? [];
    for (const note of notes) {
        if (note === undefined)
            continue;
        if (!existing.includes(note))
            existing.push(note);
        state.noteTrees.set(note, diagnosticTree(note));
    }
    state.notes.set(diagnostic, existing);
    state.revision++;
}
function* readBackingRows(checker, rows) {
    for (let position = 0; position < rows.length; position += 1) {
        admitNativeChecker(checker, "work");
        yield rows[position];
    }
}
function* readBackingEntries(checker, count, rows) {
    for (let position = 0; position < count; position += 1) {
        admitNativeChecker(checker, "work");
        const row = rows.next();
        if (row.done)
            throw new Error("A completed backing inventory must retain its actual rows.");
        yield row.value;
    }
}
export function checkerDiagnosticCoverage(checker, root) {
    admitNativeChecker(checker, "work");
    const state = checker.backingConstraintEvidenceState;
    const unavailable = () => {
        admitNativeChecker(checker, "retained");
        return Object.freeze({ kind: "unavailable", root });
    };
    if (state === undefined)
        return unavailable();
    admitNativeChecker(checker, "retained", 4);
    const obligations = new Set();
    const visited = new Set();
    const authorized = new Set();
    const notes = new Set();
    const same = (actual, expected) => {
        if (actual.length !== expected.length)
            return false;
        let index = 0;
        for (const entry of readBackingRows(checker, actual))
            if (entry !== expected[index++])
                return false;
        return true;
    };
    const matches = (diagnostic, edges) => {
        if (!same(diagnostic.messageChain, edges.messages))
            return false;
        const notes = state.notes.get(diagnostic) ?? [];
        if (notes.length === 0)
            return same(diagnostic.relatedInformation, edges.related);
        const actual = diagnostic.relatedInformation;
        if (actual.length < edges.related.length)
            return false;
        admitNativeChecker(checker, "retained");
        const original = new Set();
        let index = 0;
        for (const entry of readBackingRows(checker, edges.related)) {
            if (actual[index++] !== entry)
                return false;
            if (!original.has(entry)) {
                admitNativeChecker(checker, "retained");
                original.add(entry);
            }
        }
        for (const note of readBackingRows(checker, notes)) {
            if (!original.has(note) && (index >= actual.length || actual[index++] !== note))
                return false;
        }
        return index === actual.length;
    };
    const inspectNotes = (diagnostic) => {
        for (const note of readBackingRows(checker, state.notes.get(diagnostic) ?? [])) {
            const tree = state.noteTrees.get(note);
            if (tree === undefined)
                return false;
            for (const [node, edges] of readBackingEntries(checker, tree.size, tree.entries()))
                if (!matches(node, edges))
                    return false;
            if (!notes.has(note)) {
                admitNativeChecker(checker, "retained");
                notes.add(note);
            }
        }
        return true;
    };
    const inspect = (diagnostic) => {
        admitNativeChecker(checker, "work");
        if (visited.has(diagnostic))
            return false;
        admitNativeChecker(checker, "retained");
        visited.add(diagnostic);
        const records = state.origins.get(diagnostic);
        if (records !== undefined) {
            for (const record of readBackingRows(checker, records)) {
                for (const [node, edges] of readBackingEntries(checker, record.tree.size, record.tree.entries())) {
                    if (!matches(node, edges) || !inspectNotes(node))
                        return false;
                    if (!authorized.has(node)) {
                        admitNativeChecker(checker, "retained");
                        authorized.add(node);
                    }
                }
                if (!obligations.has(record)) {
                    admitNativeChecker(checker, "retained");
                    obligations.add(record);
                }
            }
            return true;
        }
        const envelope = state.envelopes.get(diagnostic);
        if (envelope === undefined || !matches(diagnostic, envelope) || !inspectNotes(diagnostic) || envelope.messages.length === 0)
            return false;
        for (const child of readBackingRows(checker, envelope.messages))
            if (child === undefined || !inspect(child))
                return false;
        for (const child of readBackingRows(checker, envelope.related)) {
            if (child === undefined)
                return false;
            if (authorized.has(child))
                continue;
            let joined = false;
            for (const note of readBackingRows(checker, state.notes.get(diagnostic) ?? [])) {
                if (note !== child)
                    continue;
                joined = true;
                break;
            }
            if (!joined)
                return false;
        }
        return true;
    };
    if (!inspect(root))
        return unavailable();
    const invocation = state.applicabilityRoots.get(root);
    const allAlternatives = () => {
        for (const record of readBackingEntries(checker, obligations.size, obligations.values()))
            if (!state.applicability.has(record) || record.body.application?.invocation !== invocation)
                return false;
        return true;
    };
    const alternative = invocation !== undefined && obligations.size !== 0 && allAlternatives();
    if (alternative) {
        const diagnostics = state.invocationDiagnostics.get(invocation);
        if (diagnostics !== undefined)
            for (const diagnostic of readBackingEntries(checker, diagnostics.size, diagnostics.values())) {
                if (state.applicabilityRoots.get(diagnostic) !== invocation)
                    return unavailable();
                if (diagnostic !== root && !inspect(diagnostic))
                    return unavailable();
            }
        if (!allAlternatives())
            return unavailable();
    }
    admitNativeChecker(checker, "retained", 3);
    const delivered = [];
    for (const record of readBackingEntries(checker, obligations.size, obligations.values())) {
        admitNativeChecker(checker, "retained", 2);
        delivered.push(Object.freeze({ diagnostic: record.diagnostic, application: record.body.application,
            kind: state.applicability.has(record) ? "applicability" : "backing" }));
    }
    const deliveredNotes = [];
    if (alternative) {
        admitNativeChecker(checker, "retained");
        for (const note of readBackingEntries(checker, notes.size, notes.values())) {
            admitNativeChecker(checker, "retained");
            deliveredNotes.push(note);
        }
    }
    return Object.freeze({ kind: "complete", root, obligations: Object.freeze(delivered),
        purpose: alternative
            ? Object.freeze({ kind: "alternative-applicability", invocation, notes: Object.freeze(deliveredNotes) })
            : Object.freeze({ kind: "other" }) });
}
export function withBackingWriteFit(checker, expression, source, target, operation) {
    if (expression === undefined || source === undefined || target === undefined ||
        checker.backingConstraintEvidenceState?.frames.length)
        return operation();
    const parent = expression.Parent;
    const declaration = parent !== undefined && HasInitializer(parent) && Node_Initializer(parent) === expression ? parent
        : IsReturnStatement(parent) ? GetContainingFunction(parent) : undefined;
    const annotation = declaration === undefined ? undefined : Node_Type(declaration);
    if (annotation === undefined)
        return operation();
    return withBackingConstraint(checker, { kind: "write-fit", site: expression,
        application: activeBackingCandidate(checker), source: checkedComponent(expression, source),
        destination: checkedComponent(annotation, target, "annotation") }, operation);
}
export function withBackingTypeArgumentFit(checker, argument, source, parameter, target, application, diagnostics, operation) {
    const declaration = parameter?.symbol?.Declarations?.find(node => node !== undefined && IsTypeParameterDeclaration(node));
    const annotation = declaration === undefined ? undefined : AsTypeParameterDeclaration(declaration)?.Constraint;
    if (argument === undefined || source === undefined || target === undefined || annotation === undefined)
        return operation();
    const body = { kind: "write-fit", site: argument, application,
        source: Object.freeze({ ...checkedComponent(argument, source, "annotation"), application }),
        destination: Object.freeze({ ...checkedComponent(annotation, target, "annotation"), application }) };
    return application === undefined ? withBackingConstraint(checker, body, operation)
        : withBackingApplicabilityConstraint(checker, body, diagnostics, operation);
}
export function observeBackingDiagnostic(checker, diagnostic) {
    if (diagnostic === undefined)
        return;
    const state = checker.backingConstraintEvidenceState;
    if (state === undefined)
        return;
    const frame = state.frames.at(-1);
    if (frame !== undefined && !frame.diagnostics.includes(diagnostic)) {
        frame.diagnostics.push(diagnostic);
        const application = frame.body.application;
        const record = { body: frame.body, diagnostic, root: diagnostic,
            candidate: application?.signature, tree: diagnosticTree(diagnostic) };
        state.records.push(record);
        const origins = state.origins.get(diagnostic);
        if (origins === undefined)
            state.origins.set(diagnostic, [record]);
        else
            origins.push(record);
        const roots = state.roots.get(diagnostic);
        if (roots === undefined)
            state.roots.set(diagnostic, [record]);
        else
            roots.push(record);
        if (application !== undefined) {
            let invocation = state.invocations.get(application.invocation);
            if (invocation === undefined)
                state.invocations.set(application.invocation, invocation = new Map());
            const records = invocation.get(application);
            if (records === undefined)
                invocation.set(application, [record]);
            else
                records.push(record);
        }
        state.revision++;
    }
    const contained = new Set();
    const pending = [diagnostic];
    while (pending.length !== 0) {
        const current = pending.pop();
        if (contained.has(current))
            continue;
        contained.add(current);
        for (const child of current.messageChain)
            if (child !== undefined)
                pending.push(child);
        for (const child of current.relatedInformation)
            if (child !== undefined)
                pending.push(child);
    }
    for (const child of contained) {
        if (child === diagnostic)
            continue;
        const records = state.roots.get(child);
        if (records === undefined)
            continue;
        state.roots.delete(child);
        const roots = state.roots.get(diagnostic);
        if (roots === undefined)
            state.roots.set(diagnostic, records);
        else
            roots.push(...records);
        for (const record of records)
            record.root = diagnostic;
        state.revision++;
    }
}
export function checkerBackingConstraints(checker, application) {
    admitNativeChecker(checker, "work");
    const state = checker.backingConstraintEvidenceState;
    const snapshot = (records) => {
        admitNativeChecker(checker, "retained");
        const output = [];
        for (const record of readBackingRows(checker, records)) {
            const rootCoverage = checkerDiagnosticCoverage(checker, record.root);
            admitNativeChecker(checker, "retained", 3);
            output.push(Object.freeze({ ...record.body,
                diagnostic: Object.freeze({ diagnostic: record.diagnostic, root: record.root, candidate: record.candidate, rootCoverage }) }));
        }
        return Object.freeze(output);
    };
    if (state === undefined)
        return snapshot([]);
    if (application !== undefined) {
        return snapshot(state.invocations.get(application.invocation)?.get(application) ?? []);
    }
    if (state.cachedRevision !== state.revision) {
        state.cached = snapshot(state.records);
        state.cachedRevision = state.revision;
    }
    return state.cached;
}
//# sourceMappingURL=backing-constraint-evidence.js.map