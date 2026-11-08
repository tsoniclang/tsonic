import { sourceTypeDescriptorMayBeAbsent } from "../../../source-semantics/descriptor-arms.js";
import { sourceAnalysisIncludesFile } from "../../analysis-program.js";
import { sourcePresentStorageArms, sourceStorageIsAbsentType } from "../model/components.js";
import { sourceStorageNativeInputSlots } from "../graph/invocation-inputs.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageFormalOwner } from "../model/subjects.js";
import { sourceStorageProjectionType, sourceStorageWithProjectionView } from "./projection-views.js";
export function sourceStorageTransparentInput(subject, ast, transport) {
    if (subject.kind !== "value" || subject.projection.length !== 0)
        return undefined;
    const parents = transport.incomingFor(subject);
    const input = parents.size === 1 ? parents.values().next().value : undefined;
    if (input?.kind === "input" && input.node === subject.node)
        return input;
    return ast.is.IsVariableDeclaration(subject.node) && ast.variableDeclarationKind(subject.node) === "const" ? input : undefined;
}
export function createSourceStorageBindingInputs(ast, transport, budget) {
    const selections = new Map();
    const retained = budget.createRows();
    return subject => {
        if (!budget.step())
            return undefined;
        if (subject.projection.length !== 0)
            return undefined;
        const transparent = sourceStorageTransparentInput(subject, ast, transport);
        if (transparent !== undefined)
            return transparent;
        if (subject.kind !== "value" || !ast.is.IsIdentifier(subject.node) && ast.kindName(subject.node) !== "KindThisKeyword")
            return undefined;
        const previous = selections.get(subject);
        if (previous !== undefined)
            return previous ?? undefined;
        const selected = budget.withRows(rows => {
            let current = subject;
            let first;
            const visited = new Set();
            while (current.kind === "value") {
                if (!budget.step())
                    return undefined;
                if (current.projection.length !== 0)
                    return undefined;
                if (visited.has(current)) {
                    budget.reject("Source storage binding aliases require an acyclic exact input.");
                    return undefined;
                }
                if (!rows.add(1))
                    return undefined;
                visited.add(current);
                const completed = current === subject ? undefined : selections.get(current);
                if (completed !== undefined)
                    return completed === null ? undefined : first ?? completed;
                let input = sourceStorageTransparentInput(current, ast, transport);
                if (input === undefined) {
                    if (!ast.is.IsIdentifier(current.node) && ast.kindName(current.node) !== "KindThisKeyword" ||
                        transport.guardedValues.appliesTo(current.node) !== false)
                        return undefined;
                    const inputs = transport.incomingFor(current);
                    input = inputs.size === 1 ? inputs.values().next().value : undefined;
                }
                if (input === undefined)
                    return undefined;
                first ?? (first = input);
                current = input;
            }
            return current.kind === "input" || current.kind === "receiver" ? first : undefined;
        });
        if (budget.failure() !== undefined || !retained.add(1))
            return undefined;
        selections.set(subject, selected ?? null);
        return selected;
    };
}
export function sourceStorageInputBinding(source, budget, transport, scopes, term, initializer) {
    const owner = sourceStorageFormalOwner(term.subject, source);
    if (term.subject.projection.length !== 0) {
        const base = scopes.inputBase(term.subject, term.scope);
        if (base === undefined)
            return undefined;
        const selected = base === term.subject ? undefined : scopes.lookup(base, term.scope);
        const value = selected?.kind === "replace" && selected.terms.length === 1 ? selected.terms[0] : undefined;
        const symbolic = value !== undefined && (value.kind === "leaf" || value.kind === "input-frontier") &&
            value.subject === base && scopes.isSymbolic(value);
        if (selected !== undefined && !symbolic) {
            const remaining = transport.subject(term.subject.node, term.subject.kind, term.subject.projection.slice(base.projection.length));
            return remaining === undefined ? undefined : { kind: "project", inputs: [sourceStorageReference(base, term.scope)],
                select: value => budget.withRows(temporary => scopes.project(value, remaining, temporary.add, base, term.scope)) };
        }
    }
    const bound = scopes.lookup(term.subject, term.scope);
    if (bound?.kind === "expand")
        return bound;
    const unresolved = (reason) => ({ kind: "replace", terms: [Object.freeze({
                kind: "unresolved", subject: term.subject, scope: term.scope, reason,
            })] });
    if (bound?.initialization === "initialized")
        return bound;
    if (initializer !== undefined && term.subject.projection.length !== 0) {
        const root = transport.subject(term.subject.node, "input");
        return root === undefined ? undefined : { kind: "project", inputs: [sourceStorageReference(root, term.scope)],
            select: value => budget.withRows(temporary => scopes.project(value, term.subject, temporary.add, undefined, term.scope)) };
    }
    if (initializer === undefined)
        return bound;
    const fallback = transport.subjectFor(initializer);
    if (fallback === undefined)
        return unresolved("An initialized input requires its exact checked default value.");
    const activation = owner === undefined ? undefined : scopes.boundActivation(term.scope, owner);
    const native = activation?.nativeEntry;
    if (owner !== undefined && activation !== undefined && native !== undefined) {
        const inputs = sourceStorageNativeInputSlots(source, owner, term.subject, transport.inputSlotsFor(owner, native.invocation, native.callback), budget.step);
        if (inputs !== undefined && inputs.length !== 0 && inputs.every(input => input.absent || input.type !== undefined &&
            sourceStorageIsAbsentType(input.type)))
            return { kind: "replace", terms: [sourceStorageReference(fallback, activation.scope)] };
    }
    if (bound === undefined) {
        const inputs = transport.incomingFor(term.subject);
        if (inputs.size === 0)
            return undefined;
        const defaultValue = sourceStorageReference(fallback, term.scope);
        return { kind: "project", inputs: [...inputs].map(value => sourceStorageReference(value, term.scope)),
            select: value => sourceStorageInitializedValue(source, budget, scopes, term, defaultValue, value) };
    }
    if (activation === undefined || activation.invocation === undefined && activation.nativeEntry === undefined)
        return bound;
    const defaultValue = sourceStorageReference(fallback, activation.scope);
    if (bound.initialization === "absent")
        return { kind: "replace", terms: [defaultValue] };
    return { kind: "project", inputs: bound.terms,
        select: value => sourceStorageInitializedValue(source, budget, scopes, term, defaultValue, value) };
}
export function sourceStorageInitializedValue(source, budget, scopes, input, fallback, value) {
    if (!budget.step())
        return undefined;
    if (value.kind === "empty")
        return [value.absence === undefined ? value : fallback];
    if (value.subject.kind === "input") {
        const selected = scopes.lookup(value.subject, value.scope);
        if (selected?.kind === "replace" && selected.initialization === "absent")
            return [fallback];
    }
    const unresolved = (reason) => [Object.freeze({ kind: "unresolved", subject: input.subject, scope: input.scope, reason })];
    const file = source.ast.getSourceFile(value.subject.node);
    const type = file === undefined || !sourceAnalysisIncludesFile(source, file) ? undefined : sourceStorageProjectionType(source, value.subject, value.views);
    if (type === undefined || file === undefined || value.subject === input.subject && value.scope === input.scope)
        return unresolved("An initialized input requires exact checked presence or absence of its actual value.");
    if (sourceStorageIsAbsentType(type))
        return [fallback];
    if (!sourceTypeDescriptorMayBeAbsent(source.ast, type))
        return [value];
    // The value read after defaulting is present: a single present arm becomes the input view; several present arms keep
    // the Host type (storage components are always read over present arms).
    const present = sourcePresentStorageArms(type);
    const retained = present.length === 1
        ? Object.freeze({ ...value, views: sourceStorageWithProjectionView(value.views, value.subject, value.subject, present[0]) })
        : value;
    return [retained, fallback];
}
export function sourceStorageStoredValue(ast, store, value, scope) {
    if (value !== undefined)
        return sourceStorageReference(value, scope);
    return store.kind === "mutation" && store.values.length === 0 && store.reason === undefined && ast.is.IsDeleteExpression(store.operation)
        ? Object.freeze({ kind: "empty", absence: sourceStorageReference(store.storage, scope) }) : undefined;
}
//# sourceMappingURL=scoped-transport.js.map