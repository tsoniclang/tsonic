import { sourceStorageFormalOwner, sourceStorageHasOriginalCallableValue, sourceStorageHasOriginalValue, sourceStorageIsDirectCreation, sourceStorageIsMemberProjection } from "../model/subjects.js";
import { createSourceStorageScopedSuccessors } from "./scoped-successors.js";
import { sourceStorageInputBinding } from "./scoped-transport.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { Node_Initializer } from "../../../source-navigation/index.js";
import { createSourceStorageInitializerSummaries } from "./initializer-summaries.js";
const sourceStorageRelationKey = Symbol("source-storage-relation-key");
export const sourceStorageRelationData = Symbol("source-storage-relation-data");
export function sourceStorageIsTerminalValue(term) {
    return term.kind === "leaf" || term.kind === "input-frontier" || term.kind === "unresolved" || term.kind === "empty";
}
export function createSourceStorageRelationEvaluation(source, budget, transport, scopes, equations, reachability, keys, evaluationQueries, creation, boundary) {
    const relations = new Map();
    const rows = budget.createRows();
    const emptyTerm = Object.freeze({ kind: "empty", absence: undefined });
    const initializers = createSourceStorageInitializerSummaries(source, budget, scopes, creation, keys);
    const witnessScope = (subject, scope) => {
        if (scope === scopes.empty || subject.kind === "member")
            return scope;
        const region = transport.regions.enclosing(subject.node);
        const owner = subject.kind === "return" || subject.kind === "receiver" ? subject.node
            : region === undefined ? undefined : sourceStorageRegionOwner(source.ast, region);
        return owner === undefined ? scopes.empty : scopes.owningScope(scope, owner) ?? scope;
    };
    let currentRead;
    const outside = (subject, scope) => {
        if (boundary?.kind !== "input")
            return undefined;
        const input = subject.projection.length === 0 ? subject : transport.subject(subject.node, subject.kind);
        return input !== undefined && boundary.admits({ subject: input, bindings: scope, original: true })
            ? sourceStorageReference(input, scope) : undefined;
    };
    const successors = createSourceStorageScopedSuccessors(source, budget, transport, scopes, equations, reachability, keys.birth, keys.closed, term => currentRead === undefined ? undefined : currentRead(term), initializers.instantiate, outside);
    const addWitness = (relation, reference, actual = false) => {
        if (budget.failure() !== undefined)
            return false;
        const current = relation;
        if ((current.kind === "reference" || current.kind === "leaf") && current.subject === reference.subject &&
            (current.scope === reference.bindings || witnessScope(current.subject, current.scope) === reference.bindings))
            return true;
        const data = relation[sourceStorageRelationData];
        const states = data.witnesses?.get(reference.bindings);
        const mode = (reference.contributes ? 2 : 1) | (reference.observesValue ? 4 : 0) | (actual ? 8 : 0);
        const previous = states?.get(reference.subject);
        if (((previous ?? 0) & mode) === mode)
            return true;
        if (previous === undefined && !rows.add(states === undefined ? 2 : 1))
            return false;
        const selected = states ?? new Map();
        const witnesses = data.witnesses ?? new Map();
        selected.set(reference.subject, (previous ?? 0) | mode);
        witnesses.set(reference.bindings, selected);
        data.witnesses = witnesses;
        return true;
    };
    const normalize = (term, witnesses, temporary, contributes, observesValue, actual = false) => {
        while (true) {
            let witness;
            if (term.kind === "reference" || term.kind === "leaf") {
                if (!budget.step() || !temporary.add(1))
                    return undefined;
                witness = { subject: term.subject, bindings: witnessScope(term.subject, term.scope), contributes, observesValue, actual };
                witnesses.push(witness);
            }
            else if (!budget.step())
                return undefined;
            if (term.kind === "reference") {
                if (term.views !== undefined)
                    return term;
                if (sourceStorageIsDirectCreation(term.subject, source.ast))
                    return Object.freeze({ kind: "leaf", subject: term.subject, scope: witness.bindings });
                const input = term.subject.kind === "value" ? transport.bindingInputFor(term.subject) : undefined;
                if (input !== undefined) {
                    term = sourceStorageReference(input, term.scope);
                    continue;
                }
                if (term.scope !== scopes.empty && (term.subject.kind === "receiver" ||
                    term.subject.kind === "input" && Node_Initializer(source.ast, term.subject.node) === undefined)) {
                    const selected = sourceStorageInputBinding(source, budget, transport, scopes, term, undefined);
                    if (selected?.kind === "replace" && selected.terms.length === 1) {
                        term = selected.terms[0];
                        continue;
                    }
                }
                if (term.subject.kind === "value" && !term.subject.projection.some(sourceStorageIsMemberProjection) &&
                    !source.ast.is.IsVariableDeclaration(term.subject.node) && !source.ast.is.IsNewExpression(term.subject.node) &&
                    !source.ast.is.IsPropertyAccessExpression(term.subject.node) &&
                    !source.ast.is.IsElementAccessExpression(term.subject.node) && !transport.invocations.has(term.subject.node) &&
                    !transport.accessorTargets.has(term.subject.node) && transport.storedValuesFor(term.subject) === undefined &&
                    transport.incomingFor(term.subject).size === 0 && sourceStorageHasOriginalValue(term.subject, source.ast, false))
                    return Object.freeze({ kind: "leaf", subject: term.subject, scope: witness.bindings });
            }
            if (term.kind === "transition") {
                const condition = normalize(term.condition, witnesses, temporary, false, false);
                if (condition === undefined)
                    return undefined;
                const transition = condition === term.condition ? term : Object.freeze({ ...term, condition });
                if (condition.kind === "leaf" && sourceStorageHasOriginalCallableValue(condition.subject, source.ast)) {
                    const selected = successors.reduce(transition);
                    if (selected === undefined)
                        return undefined;
                    if (selected.kind !== "replace" || selected.terms.length !== 1) {
                        budget.reject("A selected callable transition requires its exact canonical replacement.");
                        return undefined;
                    }
                    term = selected.terms[0];
                    continue;
                }
                const guards = [];
                const conditions = new Map();
                let current = transition;
                let duplicate = false;
                while (current.kind === "transition") {
                    if (!budget.step())
                        return undefined;
                    const key = keys.encode(current.condition);
                    if (key === undefined)
                        return undefined;
                    const equation = conditions.get(current.capture.equation.identity);
                    const owner = equation?.get(current.capture.owner);
                    const selected = owner?.get(current.capture.capture);
                    if (selected?.has(key)) {
                        if (normalize(current.condition, witnesses, temporary, false, false) === undefined)
                            return undefined;
                        duplicate = true;
                    }
                    else {
                        if (!temporary.add(2 + (equation === undefined ? 2 : 0) + (owner === undefined ? 2 : 0) +
                            (selected === undefined ? 1 : 0)))
                            return undefined;
                        const retainedEquation = equation ?? new Map();
                        const retainedOwner = owner ?? new Map();
                        const retained = selected ?? new Set();
                        retained.add(key);
                        retainedOwner.set(current.capture.capture, retained);
                        retainedEquation.set(current.capture.owner, retainedOwner);
                        conditions.set(current.capture.equation.identity, retainedEquation);
                        guards.push(current);
                    }
                    current = current.value;
                }
                if (!duplicate)
                    return transition;
                for (let index = guards.length - 1; index >= 0; index -= 1) {
                    const guard = guards[index];
                    current = Object.freeze({ kind: "transition", capture: guard.capture, condition: guard.condition, value: current });
                }
                return current;
            }
            break;
        }
        if (term.kind === "store") {
            const destination = normalize(term.destination, witnesses, temporary, false, observesValue);
            const receiver = normalize(term.receiver, witnesses, temporary, false, observesValue);
            const value = normalize(term.value, witnesses, temporary, contributes, observesValue);
            return destination === undefined || receiver === undefined || value === undefined ? undefined
                : destination === term.destination && receiver === term.receiver && value === term.value ? term
                    : Object.freeze({ ...term, destination, receiver, value });
        }
        if (term.kind === "empty" && term.absence !== undefined) {
            if (!budget.step() || !temporary.add(1))
                return undefined;
            witnesses.push({ subject: term.absence.subject, bindings: witnessScope(term.absence.subject, term.absence.scope), contributes, observesValue, actual });
        }
        if (term.kind === "guarded") {
            let current = term;
            let guards;
            const references = new Set();
            let duplicate = false;
            while (current.kind === "guarded") {
                if (!budget.step())
                    return undefined;
                duplicate || (duplicate = references.has(current.reference));
                if (!references.has(current.reference) && !temporary.add(1))
                    return undefined;
                references.add(current.reference);
                const selected = transport.guardedValues.conjoin(guards, current.reference);
                if (budget.failure() !== undefined)
                    return undefined;
                if (selected === null)
                    return emptyTerm;
                guards = selected;
                current = current.value;
            }
            const normalized = normalize(current, witnesses, temporary, false, observesValue);
            if (normalized === undefined)
                return undefined;
            if (!duplicate && normalized === current)
                return term;
            let value = normalized;
            for (const reference of [...references].reverse())
                value = Object.freeze({ kind: "guarded", value, reference });
            return value;
        }
        if (term.kind === "member") {
            const receiver = normalize(term.receiver, witnesses, temporary, false, observesValue);
            return receiver === undefined ? undefined : receiver === term.receiver ? term : Object.freeze({ ...term, receiver });
        }
        if (term.kind === "pointer") {
            const pointer = normalize(term.pointer, witnesses, temporary, false, observesValue);
            const input = term.input === undefined ? undefined : normalize(term.input, witnesses, temporary, false, observesValue);
            return pointer === undefined || term.input !== undefined && input === undefined ? undefined
                : pointer === term.pointer && input === term.input ? term : Object.freeze({ ...term, pointer, input });
        }
        if (term.kind === "application") {
            const callee = normalize(term.callee, witnesses, temporary, false, false);
            if (term.activation.kind === "provided") {
                const argument = term.activation.argument === undefined ? undefined : normalize(term.activation.argument, witnesses, temporary, false, false);
                return callee === undefined || term.activation.argument !== undefined && argument === undefined ? undefined
                    : callee === term.callee && argument === term.activation.argument ? term
                        : Object.freeze({ ...term, callee, activation: argument === term.activation.argument
                                ? term.activation : Object.freeze({ kind: "provided", argument }) });
            }
            return callee === undefined ? undefined : callee === term.callee ? term : Object.freeze({ ...term, callee });
        }
        return term;
    };
    const intern = (term) => scopes.withTraversal(() => budget.withRows(temporary => {
        if (!budget.step())
            return undefined;
        if (sourceStorageRelationKey in term && typeof term[sourceStorageRelationKey] === "string") {
            const canonical = relations.get(term[sourceStorageRelationKey]);
            if (canonical === term)
                return canonical;
        }
        const retained = [];
        let normalized = term.kind === "leaf" ? term : normalize(term, retained, temporary, true, true, true);
        if (normalized === undefined) {
            budget.reject(`Source storage ${term.kind} terms require an exact normalized form.`);
            return undefined;
        }
        if ((normalized.kind === "leaf" || normalized.kind === "reference" && normalized.subject.projection.length === 0 &&
            sourceStorageFormalOwner(normalized.subject, source) === undefined) &&
            !sourceStorageHasOriginalCallableValue(normalized.subject, source.ast)) {
            const input = outside(normalized.subject, normalized.scope);
            if (input !== undefined)
                normalized = Object.freeze({ kind: "input-frontier", input,
                    preservesInput: normalized.subject === input.subject,
                    subject: normalized.subject, scope: normalized.scope, guards: normalized.guards, views: normalized.views });
        }
        const key = keys.encode(normalized);
        if (key === undefined) {
            budget.reject(`Source storage ${normalized.kind} terms require an exact relation key.`);
            return undefined;
        }
        let selected = relations.get(key);
        if (selected === undefined) {
            if (!rows.add(2))
                return undefined;
            const node = { ...normalized, [sourceStorageRelationKey]: key,
                [sourceStorageRelationData]: Object.assign(new Map(), {
                    complete: sourceStorageIsTerminalValue(normalized)
                }) };
            Object.defineProperties(node, {
                [sourceStorageRelationKey]: { enumerable: false },
                [sourceStorageRelationData]: { enumerable: false },
            });
            Object.freeze(node);
            selected = node;
            relations.set(key, selected);
        }
        if (selected.kind !== "empty" || selected.absence !== undefined)
            for (const witness of retained)
                if (!addWitness(selected, witness, witness.actual))
                    return undefined;
        if (term.kind === "leaf" && (selected.kind !== "leaf" || selected.subject !== term.subject ||
            selected.scope !== term.scope) && !addWitness(selected, { subject: term.subject,
            bindings: witnessScope(term.subject, term.scope), contributes: true, observesValue: true }, true))
            return undefined;
        return selected;
    }));
    const derive = (relation, read, emit, project) => scopes.withTraversal(() => {
        const current = relation;
        const data = relation[sourceStorageRelationData];
        const children = data;
        const retain = (term, values = true) => {
            const selected = intern(term);
            if (selected === undefined) {
                budget.reject("Source storage relations require an interned successor term.");
                return undefined;
            }
            if (!children.has(selected) && !rows.add(1))
                return undefined;
            children.set(selected, (children.get(selected) ?? 0) | (values ? 2 : 1));
            return selected;
        };
        const select = (term, values = true) => {
            const selected = retain(term, values);
            if (selected === undefined)
                return undefined;
            children.set(selected, children.get(selected) | 8);
            return read(selected);
        };
        const previousRead = currentRead;
        currentRead = term => select(term, false);
        try {
            for (const [child, mode] of children) {
                if (!budget.step())
                    return false;
                if ((mode & 2) !== 0 && !emit(child, sourceStorageIsTerminalValue(child)))
                    return false;
            }
            if (sourceStorageIsTerminalValue(current) || current.kind === "effect")
                return emit(relation, true);
            const selected = successors.reduce(current);
            if (selected === undefined)
                return budget.failure() === undefined;
            if (selected.kind === "project") {
                for (const term of selected.inputs) {
                    const input = current.kind === "instantiation" ? intern(term) : retain(term, false);
                    if (input === undefined)
                        return false;
                    if (current.kind === "instantiation") {
                        if (data.instantiation === undefined) {
                            if (!rows.add(2))
                                return false;
                            data.instantiation = { input, substitutions: new Map([[current.parameter, current.scope]]) };
                        }
                    }
                    else
                        children.set(input, children.get(input) | 4);
                    if (selected.valueFilter !== undefined) {
                        if (selected.inputs.length !== 1) {
                            budget.reject("A guarded storage projection requires one exact original value.");
                            return false;
                        }
                        if (data.filter === undefined && !rows.add(1))
                            return false;
                        data.filter = { reference: selected.valueFilter, input };
                    }
                    if (!project(input, value => scopes.withTraversal(() => {
                        const projected = value.kind === "leaf" || value.kind === "input-frontier" || value.kind === "empty" ? selected.select(value)
                            : value.kind === "unresolved" ? [value] : [];
                        if (projected === undefined)
                            return undefined;
                        const outputs = [];
                        for (const output of projected) {
                            if (!budget.step())
                                return undefined;
                            const normalized = retain(output);
                            if (normalized === undefined)
                                return undefined;
                            outputs.push(normalized);
                        }
                        return outputs;
                    })))
                        return false;
                }
                return true;
            }
            for (const dependency of selected.kind === "replace" ? selected.dependencies ?? [] : []) {
                if (!budget.step() || retain(dependency, false) === undefined)
                    return false;
            }
            for (const witness of selected.kind === "replace" ? selected.witnesses ?? [] : []) {
                const reference = { ...witness, bindings: witnessScope(witness.subject, witness.bindings) };
                if (!budget.step() || !addWitness(relation, reference, reference.contributes))
                    return false;
            }
            const alternatives = selected.kind === "expand" ? equations.expand(selected.variable, current, term => select(term, false)) : selected.terms;
            if (alternatives === undefined) {
                budget.reject("Source storage variable expansion requires exact equation alternatives.");
                return false;
            }
            let operation = current;
            while (operation.kind === "transition") {
                if (!budget.step())
                    return false;
                operation = operation.value;
            }
            const execution = operation.kind === "execution-root" || operation.kind === "region" ||
                (operation.kind === "application" || operation.kind === "member" || operation.kind === "pointer") && operation.mode === "execution";
            for (const term of alternatives) {
                if (!budget.step())
                    return false;
                if (execution) {
                    const successor = retain(term, false);
                    if (successor === undefined || !emit(successor, true))
                        return false;
                    continue;
                }
                const terminal = sourceStorageIsTerminalValue(term);
                const successor = retain(term);
                if (successor === undefined)
                    return false;
                if (terminal) {
                    if (!emit(successor, true))
                        return false;
                    continue;
                }
                if (!emit(successor, false))
                    return false;
            }
            return budget.failure() === undefined;
        }
        finally {
            currentRead = previousRead;
        }
    });
    const evaluateRelation = (current, read, emit, forward) => {
        const state = current[sourceStorageRelationData];
        const complete = derive(current, read, (relation, direct) => direct ? emit(relation) : forward(relation), (input, select) => {
            let projection = state.forwardProjection;
            if (projection === undefined) {
                if (!rows.add(1))
                    return false;
                projection = value => select(value)?.map(relation => sourceStorageIsTerminalValue(relation)
                    ? { kind: "value", value: relation } : { kind: "relation", key: relation });
                state.forwardProjection = projection;
            }
            return forward(input, projection);
        });
        if (complete)
            state.complete = true;
        return complete;
    };
    const results = evaluationQueries.fixedPoint(evaluateRelation, "storage-relations");
    return { intern, derive, results, witnessScope, release: () => {
            results.release();
            relations.clear();
            rows.release();
            initializers.release();
        } };
}
//# sourceMappingURL=relation-evaluation.js.map