import { sourceStorageIsMemberProjection } from "../model/subjects.js";
import { createSourceStorageGraphQueries } from "../graph/graph-queries.js";
import { createSourceStorageScopes } from "./scoped-scopes.js";
import { createSourceStorageScopedKeys } from "./scoped-keys.js";
import { createSourceStorageEquations } from "./scoped-equations.js";
import { createSourceStorageScopedRecursion } from "./scoped-recursion.js";
import { createSourceStorageExecutionReachability, walkSourceStorageExecution } from "./execution-reachability.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { sourceStorageIsNeverType, sourceStorageSubjectType } from "../model/components.js";
import { isSourceCallableBodyBoundary } from "../../../source-navigation/index.js";
import { createSourceStorageContextFootprints } from "../graph/context-footprints.js";
import { sourceStorageActivationOwner } from "./activation-keys.js";
import { sourceStorageWithProjectionView } from "./projection-views.js";
import { createSourceStorageRelationEvaluation, sourceStorageIsTerminalValue, sourceStorageRelationData } from "./relation-evaluation.js";
export const sourceStorageMissingProducerReason = "A demanded source storage relation has no completed correlated producer or absence proof.";
function sourceStorageIsProjectedInput(frontier) {
    return !frontier.preservesInput && (frontier.subject.kind === "input" || frontier.subject.kind === "receiver") &&
        frontier.subject.kind === frontier.input.subject.kind && frontier.subject.node === frontier.input.subject.node &&
        frontier.input.subject.projection.length === 0 && frontier.subject.projection.length !== 0;
}
export function createSourceStorageSubstitutions(source, budget, transport, graphQueries) {
    const { invocationInputs } = transport;
    const recursion = createSourceStorageScopedRecursion(source, budget, transport, invocationInputs);
    const creation = Object.freeze({ footprints: createSourceStorageContextFootprints(budget, transport.contextualInputs, transport.contextLocation, transport.contextualInputs.applicationFor),
        ownerFor: (subject) => sourceStorageActivationOwner(source, transport.regions.enclosing, subject) });
    const scopes = createSourceStorageScopes(source, budget, transport.subject, invocationInputs, graphQueries, recursion.entryInputFor, creation, transport.inputSlotsFor);
    const keys = createSourceStorageScopedKeys(source, budget, transport, scopes, creation);
    const equations = createSourceStorageEquations(source, budget, transport, scopes, recursion, keys.invocation);
    let querying = false;
    const withQuery = (collect) => {
        if (querying)
            return collect();
        querying = true;
        try {
            return scopes.withQuery(collect);
        }
        finally {
            querying = false;
            keys.releaseReferenceMemo();
        }
    };
    const reachability = createSourceStorageExecutionReachability(source, budget, transport);
    const evaluation = createSourceStorageRelationEvaluation(source, budget, transport, scopes, equations, reachability, keys, graphQueries, creation);
    const { intern, results, witnessScope } = evaluation;
    const selectRoot = (origin, scope) => intern(sourceStorageReference(origin, scope));
    const termValues = (term) => withQuery(() => {
        const root = intern(term);
        const selected = root === undefined ? undefined : results(root);
        if (selected === undefined)
            return undefined;
        const values = new Set();
        for (const value of selected) {
            if (!budget.step())
                return undefined;
            if (value.kind === "unresolved" && value.executionOnly !== true) {
                if (value.exposure === undefined)
                    budget.reject(value.reason);
                return undefined;
            }
            if (value.kind === "input-frontier") {
                if (value.preservesInput)
                    values.add(Object.freeze({ subject: value.input.subject, bindings: value.input.scope }));
                else if (sourceStorageIsProjectedInput(value))
                    values.add(Object.freeze({ subject: value.subject, bindings: value.scope, views: value.views }));
                else
                    return undefined;
            }
            if (value.kind === "leaf")
                values.add(Object.freeze({ subject: value.subject, bindings: value.scope, views: value.views }));
        }
        return values;
    });
    const values = (origin, scope) => termValues(sourceStorageReference(origin, scope));
    const projectedValues = (receiver) => {
        if (sourceStorageIsMemberProjection(receiver.component))
            return termValues(Object.freeze({ kind: "member",
                selection: Object.freeze({ kind: "physical", subject: receiver.view,
                    declaration: receiver.component.declaration, receiverType: receiver.type }),
                receiver: Object.freeze({ kind: "leaf", subject: receiver.subject, scope: receiver.bindings, views: receiver.views }),
                scope: receiver.bindings, projection: Object.freeze([]), mode: "value" }));
        const projected = transport.subject(receiver.subject.node, receiver.subject.kind, [...receiver.subject.projection, receiver.component]);
        if (projected === undefined)
            return undefined;
        const views = sourceStorageWithProjectionView(receiver.views, receiver.subject, receiver.view, receiver.type);
        return termValues(sourceStorageReference(projected, receiver.bindings, views));
    };
    const provenance = (origin, scope) => withQuery(() => {
        const root = selectRoot(origin, scope);
        const selected = root === undefined ? undefined : results(root);
        if (selected === undefined)
            return undefined;
        const subjects = new Set();
        let reason;
        let fatalReason;
        for (const value of selected) {
            if (!budget.step())
                return undefined;
            if (value.kind === "unresolved" && value.executionOnly !== true) {
                reason ?? (reason = value.reason);
                if (value.exposure === undefined)
                    fatalReason ?? (fatalReason = value.reason);
            }
            if (value.kind === "input-frontier") {
                if (value.preservesInput)
                    subjects.add(value.input.subject);
                else if (sourceStorageIsProjectedInput(value))
                    subjects.add(value.subject);
                else
                    reason ?? (reason = sourceStorageMissingProducerReason);
            }
            if (value.kind === "leaf")
                subjects.add(value.subject);
        }
        return Object.freeze({ origins: subjects, reason, fatalReason });
    });
    const origins = (origin, scope) => {
        const selected = provenance(origin, scope);
        if (selected?.reason !== undefined) {
            if (selected.fatalReason !== undefined)
                budget.reject(selected.fatalReason);
            return undefined;
        }
        return selected?.origins;
    };
    const contributingExecutions = (origin, declaration, creation, entry) => withQuery(() => budget.withRows(temporary => {
        const body = source.ast.body(declaration);
        const scope = entry === "generator-result" ? scopes.owningScope(creation, declaration)
            : scopes.declarationFor(declaration, creation);
        if (body === undefined || scope === undefined)
            return undefined;
        const root = Object.freeze({ kind: "region", region: body, scope, demand: origin.node, deferred: true });
        const selected = walkSourceStorageExecution(budget, [root], term => {
            const relation = intern(term);
            return relation === undefined ? undefined : results(relation);
        });
        const subjects = [];
        const boundaries = [];
        let reason;
        for (const value of selected) {
            if (!budget.step())
                return undefined;
            if (value.kind === "unresolved") {
                if (value.exposure === undefined)
                    reason ?? (reason = value.reason);
                else {
                    if (!temporary.add(1))
                        return undefined;
                    boundaries.push(value);
                }
            }
            if (value.kind !== "leaf" || value.subject !== origin)
                continue;
            if (!temporary.add(1))
                return undefined;
            subjects.push(Object.freeze({ subject: value.subject, bindings: value.scope }));
        }
        return Object.freeze({ subjects: Object.freeze(subjects), boundaries: Object.freeze(boundaries), reason });
    }));
    const hasStaticValue = (relation) => {
        if (sourceStorageIsTerminalValue(relation))
            return true;
        const data = relation[sourceStorageRelationData];
        if (!data.complete || data.forwardProjection !== undefined)
            return false;
        let present = false;
        for (const [child, mode] of data) {
            if (!budget.step())
                return undefined;
            if ((mode & 12) !== 0)
                return false;
            present || (present = (mode & 2) !== 0 && sourceStorageIsTerminalValue(child));
        }
        return present;
    };
    const walk = (origin, scope, boundary, preserveValuePath = false) => withQuery(() => scopes.withTraversal(() => budget.withRows(temporary => {
        const inputBoundary = typeof boundary === "function" ? undefined : boundary;
        const isolatedQueries = inputBoundary === undefined ? undefined : createSourceStorageGraphQueries(budget);
        isolatedQueries?.seal();
        const isolated = isolatedQueries === undefined ? undefined : createSourceStorageRelationEvaluation(source, budget, transport, scopes, equations, reachability, keys, isolatedQueries, creation, inputBoundary);
        const { intern, derive, results, witnessScope } = isolated ?? evaluation;
        const stopAt = typeof boundary === "function" ? boundary : undefined;
        try {
            const root = intern(sourceStorageReference(origin, scope));
            if (root === undefined)
                return undefined;
            if (boundary === undefined && results(root) === undefined)
                return undefined;
            const directVisits = new Map();
            const visits = new Map();
            const paths = new Map();
            const pending = [{ relation: root, collect: true, observesValue: true }];
            const subjects = new Map();
            const origins = new Set();
            const emptyDemands = [];
            const effectFrontiers = [];
            let reason;
            let fatalReason;
            let demandReason;
            let absence = false;
            const project = (input, select) => {
                const values = results(input);
                if (values === undefined)
                    return false;
                for (const value of values)
                    if (!budget.step() || select(value) === undefined)
                        return false;
                return budget.failure() === undefined;
            };
            const admitted = (subject, guards) => {
                for (const reference of guards?.references ?? []) {
                    if (!budget.step() || transport.guardedValues.admits(subject, reference) === false)
                        return false;
                }
                return budget.failure() === undefined;
            };
            const mappedScope = (scope, path) => {
                let selected = scope;
                for (let current = path; current !== undefined && selected !== undefined; current = current.parent)
                    selected = scopes.applyScope(selected, current.replacements);
                return selected;
            };
            const mappedTerm = (term, path) => {
                let selected = term;
                for (let current = path; current !== undefined && selected !== undefined; current = current.parent)
                    selected = scopes.applyTerm(selected, current.replacements);
                return selected;
            };
            const collectWitnesses = (current, term, collect, observesValue, guards, path) => {
                let stopped = false;
                const retain = (scope, input, mode, views) => {
                    if (!budget.step())
                        return false;
                    const retained = subjects.get(scope) ?? new Map();
                    const state = retained.get(input);
                    const previous = state?.mode ?? 0;
                    const observed = observesValue && (mode & 6) !== 0;
                    const required = (collect && (mode & 2) !== 0 ? 2 | (mode & 16) : 1) | (observed ? 128 : 0);
                    if (stopAt === undefined && guards === undefined && (previous & required) === required &&
                        (views === undefined || state?.views.has(views)))
                        return true;
                    if (!retained.has(input) && !temporary.add(1))
                        return false;
                    const contributes = collect && (mode & 2) !== 0 && admitted(input, guards);
                    let selected = previous | (contributes ? 2 : 1) | (observed ? 128 : 0);
                    if (contributes && (mode & 16) !== 0)
                        selected |= 16;
                    if (contributes && stopAt !== undefined) {
                        const original = (mode & 16) !== 0;
                        const inspected = original ? 32 : 4;
                        const boundary = original ? 64 : 8;
                        if ((selected & inspected) === 0)
                            selected |= inspected |
                                (stopAt({ subject: input, bindings: scope, original }) ? boundary : 0);
                        if ((selected & boundary) !== 0) {
                            origins.add(input);
                            selected |= 16;
                            stopped = true;
                        }
                    }
                    const entry = state ?? { mode: selected, views: new Set() };
                    if (contributes && (mode & 16) !== 0 && views !== undefined && !entry.views.has(views)) {
                        if (!temporary.add(1))
                            return false;
                        entry.views.add(views);
                    }
                    entry.mode = selected;
                    retained.set(input, entry);
                    subjects.set(scope, retained);
                    return true;
                };
                if (term.kind === "reference" && !retain(witnessScope(term.subject, term.scope), term.subject, 2))
                    return undefined;
                if (term.kind === "leaf" && !retain(term.scope, term.subject, 2 | 16, term.views))
                    return undefined;
                if (term.kind === "input-frontier") {
                    if (!retain(term.input.scope, term.input.subject, 2 | 16))
                        return undefined;
                    if (sourceStorageIsProjectedInput(term) && !retain(term.scope, term.subject, 2 | 16, term.views))
                        return undefined;
                }
                for (const [scope, inputs] of current[sourceStorageRelationData].witnesses ?? [])
                    for (const [input, mode] of inputs) {
                        const selected = mappedScope(scope, path);
                        if (selected === undefined || !retain(selected, input, mode))
                            return undefined;
                    }
                return stopped;
            };
            while (pending.length !== 0) {
                if (!budget.step())
                    return undefined;
                const entry = pending.pop();
                const relation = entry.relation;
                const current = mappedTerm(relation, entry.path);
                if (current === undefined)
                    return undefined;
                if (current.kind === "store") {
                    const values = results(relation);
                    if (values === undefined)
                        return undefined;
                    if (values.size === 1 && [...values].every(value => value.kind === "empty" && value.absence === undefined))
                        continue;
                }
                let visited = directVisits;
                if (entry.path !== undefined) {
                    const mapped = visits.get(entry.path);
                    if (mapped === undefined) {
                        if (!temporary.add(1))
                            return undefined;
                        visited = new Map();
                        visits.set(entry.path, visited);
                    }
                    else
                        visited = mapped;
                }
                const flag = (entry.collect ? 2 : 1) | (entry.observesValue ? 4 : 0);
                const guardsKey = entry.guards?.key ?? "";
                const visitedGuards = visited.get(relation);
                const previous = typeof visitedGuards === "number" ? guardsKey === "" ? visitedGuards : 0
                    : visitedGuards?.get(guardsKey) ?? 0;
                if ((previous & flag) !== 0)
                    continue;
                if (visitedGuards === undefined && guardsKey === "") {
                    if (!temporary.add(1))
                        return undefined;
                    visited.set(relation, flag);
                }
                else if (typeof visitedGuards === "number" && guardsKey === "") {
                    visited.set(relation, visitedGuards | flag);
                }
                else {
                    if ((visitedGuards === undefined || typeof visitedGuards === "number") && !temporary.add(2) ||
                        visitedGuards instanceof Map && !visitedGuards.has(guardsKey) && !temporary.add(1))
                        return undefined;
                    const retainedGuards = visitedGuards instanceof Map ? visitedGuards : new Map(visitedGuards === undefined ? [] : [["", visitedGuards]]);
                    retainedGuards.set(guardsKey, previous | flag);
                    visited.set(relation, retainedGuards);
                }
                const stopped = collectWitnesses(relation, current, entry.collect, entry.observesValue, entry.guards, entry.path);
                if (stopped === undefined)
                    return undefined;
                if (stopped)
                    continue;
                const data = relation[sourceStorageRelationData];
                if (!data.complete) {
                    if (!derive(relation, results, () => true, project))
                        return undefined;
                    data.complete = true;
                    const completed = collectWitnesses(relation, current, entry.collect, entry.observesValue, entry.guards, entry.path);
                    if (completed === undefined)
                        return undefined;
                    if (completed)
                        continue;
                }
                if (entry.collect && current.kind !== "execution-root" && current.kind !== "region" && current.kind !== "effect") {
                    const present = hasStaticValue(relation);
                    if (present === undefined)
                        return undefined;
                    if (!present) {
                        const completed = results(relation);
                        if (completed === undefined)
                            return undefined;
                        if (completed.size === 0) {
                            const subject = current.kind === "reference" || current.kind === "leaf" || current.kind === "unresolved" ? current.subject
                                : current.kind === "application" || current.kind === "pointer" ? transport.subject(current.invocation, "value", current.projection)
                                    : current.kind === "member" ? current.selection.kind !== "access" ? current.selection.subject
                                        : transport.subject(current.selection.node) : undefined;
                            const type = subject === undefined ? undefined : sourceStorageSubjectType(source, subject);
                            if (type === undefined || !sourceStorageIsNeverType(type)) {
                                if (!temporary.add(1))
                                    return undefined;
                                emptyDemands.push(current);
                            }
                        }
                    }
                }
                if (entry.collect && current.kind === "leaf" && admitted(current.subject, entry.guards))
                    origins.add(current.subject);
                if (entry.collect && current.kind === "input-frontier") {
                    if (current.preservesInput)
                        origins.add(current.input.subject);
                    else if (sourceStorageIsProjectedInput(current))
                        origins.add(current.subject);
                    else if (inputBoundary === undefined)
                        reason ?? (reason = sourceStorageMissingProducerReason);
                }
                if (entry.collect && current.kind === "empty" && current.absence !== undefined &&
                    admitted(current.absence.subject, entry.guards))
                    absence = true;
                if (current.kind === "unresolved" && current.executionOnly !== true) {
                    if (current.effectOnly === true && current.exposure !== undefined) {
                        if (entry.collect) {
                            if (!temporary.add(1))
                                return undefined;
                            effectFrontiers.push(current);
                        }
                    }
                    else {
                        reason ?? (reason = current.reason);
                        if (current.exposure === undefined)
                            fatalReason ?? (fatalReason = current.reason);
                        if (current.demandFailure === true)
                            demandReason ?? (demandReason = current.reason);
                    }
                }
                const filter = preserveValuePath ? data.filter : undefined;
                if (filter !== undefined) {
                    const guards = transport.guardedValues.conjoin(entry.guards, filter.reference);
                    if (budget.failure() !== undefined)
                        return undefined;
                    if (guards !== null)
                        pending.push({ relation: filter.input, collect: entry.collect, observesValue: entry.observesValue, guards, path: entry.path });
                    continue;
                }
                if (data.instantiation !== undefined) {
                    const { substitutions, input } = data.instantiation;
                    const parents = paths.get(substitutions);
                    let path = parents?.get(entry.path);
                    if (path === undefined) {
                        if (!temporary.add(parents === undefined ? 3 : 2))
                            return undefined;
                        path = { replacements: substitutions, parent: entry.path };
                        const selected = parents ?? new Map();
                        selected.set(entry.path, path);
                        paths.set(substitutions, selected);
                    }
                    pending.push({ relation: input, collect: entry.collect, observesValue: entry.observesValue, guards: entry.guards, path });
                    continue;
                }
                for (const [child, mode] of data) {
                    if (!budget.step())
                        return undefined;
                    if (child.kind !== "execution-root")
                        pending.push({ relation: child, collect: entry.collect && (mode & 2) !== 0,
                            observesValue: entry.observesValue && (mode & 6) !== 0, guards: entry.guards, path: entry.path });
                }
            }
            const selected = [];
            for (const [scope, inputs] of subjects)
                for (const [subject, state] of inputs) {
                    if (!budget.step())
                        return undefined;
                    const mode = state.mode;
                    const witness = { subject, bindings: scope, contributes: (mode & 2) !== 0,
                        observesValue: (mode & 128) !== 0, original: (mode & 16) !== 0, views: undefined };
                    if (state.views.size === 0)
                        selected.push(Object.freeze(witness));
                    else
                        for (const views of state.views) {
                            if (!budget.step())
                                return undefined;
                            selected.push(Object.freeze({ ...witness, views }));
                        }
                }
            return Object.freeze({ subjects: Object.freeze(selected), origins, reason, fatalReason, demandReason, absence,
                effectFrontiers: Object.freeze(effectFrontiers),
                emptyDemands: Object.freeze(emptyDemands) });
        }
        finally {
            isolated?.release();
        }
    })));
    const trace = (origin, scope) => {
        const selected = walk(origin, scope);
        return selected?.reason === undefined && selected?.fatalReason === undefined && selected?.emptyDemands.length === 0 &&
            selected.effectFrontiers.length === 0
            ? selected.subjects : undefined;
    };
    const frontier = (origin, scope, boundaries, position) => withQuery(() => budget.withRows(temporary => {
        const rootScope = witnessScope(origin, scope);
        const stopped = new Map();
        const selected = walk(origin, scope, current => {
            if (!boundaries.has(current.subject) || position === "input" &&
                current.subject === origin && current.bindings === rootScope)
                return false;
            const previous = stopped.get(current.bindings);
            if (previous?.has(current.subject) !== true && !temporary.add(previous === undefined ? 2 : 1))
                return false;
            const subjects = previous ?? new Set();
            subjects.add(current.subject);
            stopped.set(current.bindings, subjects);
            return true;
        }, true);
        if (selected === undefined || selected.reason !== undefined || selected.fatalReason !== undefined || selected.emptyDemands.length !== 0 ||
            selected.effectFrontiers.length !== 0)
            return selected === undefined ? undefined
                : { reason: selected.fatalReason ?? selected.reason ?? selected.effectFrontiers[0]?.reason ?? sourceStorageMissingProducerReason, subjects: [] };
        const subjects = [];
        for (const current of selected.subjects) {
            if (!budget.step())
                return undefined;
            if (current.original && selected.origins.has(current.subject)) {
                if (!temporary.add(1))
                    return undefined;
                subjects.push(Object.freeze({ subject: current.subject, bindings: current.bindings,
                    kind: stopped.get(current.bindings)?.has(current.subject) === true ? "boundary" : "origin" }));
            }
        }
        return { subjects: Object.freeze(subjects), reason: undefined };
    }));
    const selection = (origin, scope) => withQuery(() => {
        const selected = scopes.lookup(origin, scope);
        if (selected === undefined)
            return undefined;
        if (selected.kind === "expand") {
            const inputs = values(origin, scope);
            return inputs === undefined ? undefined : Object.freeze([...inputs]);
        }
        const inputs = [];
        for (const input of selected.terms) {
            if (!budget.step())
                return undefined;
            if (input.kind !== "reference" && input.kind !== "leaf")
                return undefined;
            inputs.push(Object.freeze({ subject: input.subject, bindings: input.scope }));
        }
        return Object.freeze(inputs);
    });
    const lexicalScopes = new Map();
    const lexicalRows = budget.createRows();
    const forLexicalOwner = (node) => budget.withRows(temporary => {
        const owners = [];
        const visited = new Set();
        let current = node;
        let parent = scopes.empty;
        while (current !== undefined) {
            if (!budget.step())
                return undefined;
            const existing = lexicalScopes.get(current);
            if (existing !== undefined) {
                parent = existing;
                break;
            }
            if (visited.has(current)) {
                budget.reject("Lexical substitution has a cyclic declaration ancestry.");
                return undefined;
            }
            if (!temporary.add(1))
                return undefined;
            visited.add(current);
            if (isSourceCallableBodyBoundary(source.ast, current) || source.ast.is.IsClassDeclaration(current) ||
                source.ast.is.IsClassExpression(current)) {
                if (!temporary.add(1))
                    return undefined;
                owners.push(current);
            }
            const region = transport.regions.enclosing(current);
            current = region === undefined ? undefined : sourceStorageRegionOwner(source.ast, region);
        }
        while (owners.length !== 0) {
            if (!budget.step())
                return undefined;
            const owner = owners.pop();
            const selected = scopes.declarationFor(owner, parent);
            if (selected === undefined || !lexicalRows.add(1))
                return undefined;
            parent = selected;
            lexicalScopes.set(owner, parent);
        }
        return parent;
    });
    return Object.freeze({ empty: scopes.empty, withQuery, values, projectedValues, origins, provenance, trace, walk, frontier, selection, contributingExecutions, forLexicalOwner,
        formals: scopes.formals,
        invocationContextKeyFor(invocation, bindings) {
            return withQuery(() => budget.withRows(temporary => {
                const subject = transport.subject(invocation);
                if (subject === undefined)
                    return undefined;
                const target = transport.invocationTargets.get(invocation);
                const accessors = transport.accessorTargets.get(invocation);
                const operation = accessors === undefined ? undefined : source.navigation.memberAccess(invocation);
                const receiver = transport.subjectFor(operation?.receiver);
                const states = [];
                for (const scope of bindings) {
                    if (!budget.step() || !temporary.add(1))
                        return undefined;
                    const inputs = [];
                    const add = (term) => {
                        if (!temporary.add(1))
                            return false;
                        inputs.push({ subject, term });
                        return true;
                    };
                    if (target !== undefined) {
                        if (!add(Object.freeze({ kind: "application", mode: "execution", demand: invocation, activation: Object.freeze({ kind: "invoke" }),
                            invocation, callee: sourceStorageReference(target, scope), scope, projection: Object.freeze([]) })))
                            return undefined;
                    }
                    else if (receiver !== undefined) {
                        if (!add(Object.freeze({ kind: "member", mode: "execution", demand: invocation,
                            selection: Object.freeze({ kind: "access", node: invocation }), receiver: sourceStorageReference(receiver, scope),
                            scope, projection: Object.freeze([]) })))
                            return undefined;
                    }
                    else if (source.ast.is.IsSpreadAssignment(invocation) || source.ast.is.IsBindingElement(invocation)) {
                        for (const accessor of accessors ?? []) {
                            if (!budget.step())
                                return undefined;
                            const receiver = transport.subjectFor(accessor.receiver);
                            if (receiver === undefined || !add(Object.freeze({ kind: "member", mode: "execution", demand: invocation,
                                selection: Object.freeze({ kind: "projection", subject: receiver, declaration: accessor.declaration,
                                    evaluation: invocation, before: undefined }), receiver: sourceStorageReference(receiver, scope),
                                scope, projection: Object.freeze([]) })))
                                return undefined;
                        }
                    }
                    if (inputs.length === 0) {
                        budget.reject("An invocation context requires its exact checked callee or accessor receiver.");
                        return undefined;
                    }
                    states.push(inputs);
                }
                return keys.context(states);
            }));
        },
        contextKeyFor(subjects, bindings) {
            return withQuery(() => budget.withRows(temporary => {
                const states = [];
                for (const scope of bindings) {
                    const inputs = [];
                    for (const subject of subjects) {
                        if (!budget.step() || !temporary.add(1))
                            return undefined;
                        const selected = intern(sourceStorageReference(subject, scope));
                        if (selected === undefined)
                            return undefined;
                        inputs.push({ subject, term: selected });
                    }
                    if (!temporary.add(1))
                        return undefined;
                    states.push(inputs);
                }
                return keys.context(states);
            }));
        },
        boundActivation: scopes.boundActivation,
        creationKeyFor: (subject, bindings) => withQuery(() => keys.birth(subject, bindings)?.key),
        ownerScope: scopes.owningScope,
        isBound: (origin, scope) => scopes.withTraversal(() => {
            const bound = scopes.lookup(origin, scope);
            return bound !== undefined && (bound.kind !== "replace" || !bound.terms.some(term => (term.kind === "leaf" || term.kind === "input-frontier") && scopes.isSymbolic(term)));
        }),
        forDeclaration: scopes.declarationFor,
        forInvocation: (candidate, invocation, caller, captured, callee) => withQuery(() => {
            if (transport.accessorTargets.has(invocation))
                return scopes.frameFor(candidate, invocation, caller, captured);
            if (callee === undefined || !transport.invocationTargets.has(invocation)) {
                budget.reject("An invocation context requires its exact checked callee transport.");
                return undefined;
            }
            return equations.scopeFor(candidate, invocation, caller, captured, Object.freeze({ kind: "application",
                activation: Object.freeze({ kind: "invoke" }),
                mode: "execution", demand: invocation, invocation, callee: Object.freeze({ kind: "leaf", subject: callee, scope: captured }),
                scope: caller, projection: Object.freeze([]) }));
        }),
        identityFor: scopes.identity });
}
//# sourceMappingURL=substitutions.js.map