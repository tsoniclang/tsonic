import { createSourceStorageScopeFrames } from "./scope-frames.js";
import { sourceCallableValueParameters } from "../../../source-navigation/callable-parameters.js";
import { sourceStorageFormalOwner, sourceStorageIsMemberProjection } from "../model/subjects.js";
import { sourceStorageIsAbsentType, sourceStorageSubjectType } from "../model/components.js";
import { sourceStorageProjectionType } from "./projection-views.js";
import { sourceStorageProjectComponents } from "../graph/component-projections.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { createSourceStorageScopedTraversal } from "../graph/scoped-traversal.js";
import { createSourceStorageActivationKeys } from "./activation-keys.js";
function scopedMemo(budget, create) {
    let active;
    return (collect) => {
        if (active !== undefined)
            return collect(active);
        return budget.withRows(rows => {
            const memo = create(rows.add);
            active = memo;
            try {
                return collect(memo);
            }
            finally {
                active = undefined;
            }
        });
    };
}
export function createSourceStorageScopes(source, budget, subject, invocationInputs, graphQueries, entryInputFor, creation, inputSlotsFor) {
    const rows = budget.createRows();
    const identities = new Map();
    const identity = (value) => {
        const cached = identities.get(value);
        if (cached !== undefined)
            return cached;
        if (!rows.add(1))
            return -1;
        const selected = identities.size;
        identities.set(value, selected);
        return selected;
    };
    const empty = Object.freeze({ kind: "frame", entries: new Map(), parents: Object.freeze([]) });
    identity(empty);
    const variables = new Map();
    const callbackKey = (callback) => callback === undefined ? "" :
        `${identity(callback.argument.actual)}:${identity(callback.argument.formal)}:${callback.argument.binding.argumentIndex}:${callback.argument.binding.parameterIndex}:${callback.timing}:${(callback.inputs ?? []).map(input => `${input.parameterIndex}/${input.from}/${input.sourceParameterIndex ?? ""}`).join(";")}`;
    const variable = (equation, owner, capture, callback) => {
        if (!budget.step())
            return undefined;
        const key = `${equation.identity}:${identity(owner)}:${capture === undefined ? "" : identity(capture)}:${callbackKey(callback)}`;
        const cached = variables.get(key);
        if (cached !== undefined)
            return cached;
        if (!rows.add(1))
            return undefined;
        const selected = Object.freeze({ kind: "variable", equation, owner, capture, callback });
        variables.set(key, selected);
        return selected;
    };
    const scopeParameters = (includeFrames) => graphQueries.fixedPoint((scope, read, emit, forward) => {
        if (scope.kind === "variable")
            return emit(scope);
        if (includeFrames && !emit(scope))
            return false;
        const inputs = scope.kind === "substitution" ? [scope.scope]
            : [...scope.parents, ...scope.caller === undefined ? [] : [scope.caller],
                ...[...scope.entries.values()].flatMap(entry => entry.values.flatMap(value => value.kind === "empty" ? value.absence === undefined ? [] : [value.absence.scope]
                    : value.kind === "input-frontier" ? [value.scope, value.input.scope] : [value.scope]))];
        for (const input of inputs) {
            if (!budget.step())
                return false;
            if (scope.kind !== "substitution") {
                if (!forward(input))
                    return false;
                continue;
            }
            const variables = read(input);
            if (variables === undefined)
                return false;
            for (const variable of variables) {
                if (!budget.step())
                    return false;
                const replacement = scope.kind === "substitution" ? scope.substitutions.get(variable) : undefined;
                if (replacement === undefined) {
                    if (!emit(variable))
                        return false;
                }
                else {
                    const values = read(replacement);
                    if (values === undefined)
                        return false;
                    for (const value of values)
                        if (!budget.step() || !emit(value))
                            return false;
                }
            }
        }
        return true;
    }, includeFrames ? "scope-parameters" : "scope-variables");
    const variablesFor = scopeParameters(false);
    const frameParameters = scopeParameters(true);
    const views = new Map();
    const withTraversal = scopedMemo(budget, add => ({ add, owners: new Map(), families: new Map(), lookups: new Map() }));
    const withQueryMemo = scopedMemo(budget, add => ({ add, applications: new Map(),
        lookups: new Map() }));
    const substitutionKey = (substitutions) => [...substitutions].map(([input, replacement]) => [identity(input), identity(replacement)])
        .sort((left, right) => left[0] - right[0]).map(entry => entry.join(":")).join(";");
    const applyScope = (scope, replacements) => withQueryMemo(memo => {
        if (!budget.step())
            return undefined;
        if (scope === empty || replacements.size === 0)
            return scope;
        const direct = replacements.get(scope);
        if (direct !== undefined || scope.kind === "variable")
            return direct ?? scope;
        const parameters = [...replacements.keys()].some(input => input.kind !== "variable") ? frameParameters : variablesFor;
        const inputs = parameters(scope);
        if (inputs === undefined)
            return undefined;
        const selected = new Map();
        const candidates = replacements.size < inputs.size ? replacements.keys() : inputs;
        for (const input of candidates) {
            if (!budget.step())
                return undefined;
            if (!inputs.has(input))
                continue;
            const replacement = replacements.get(input);
            if (replacement !== undefined)
                selected.set(input, replacement);
        }
        if (selected.size === 0)
            return scope;
        const request = scope.kind === "substitution" ? substitutionKey(selected) : undefined;
        const applied = request === undefined ? undefined : memo.applications.get(scope)?.get(request);
        if (applied !== undefined)
            return applied;
        const remember = (result) => {
            if (request === undefined)
                return result;
            const selections = memo.applications.get(scope);
            if (!memo.add(selections === undefined ? 2 : 1))
                return undefined;
            const values = selections ?? new Map();
            values.set(request, result);
            memo.applications.set(scope, values);
            return result;
        };
        const base = scope.kind === "substitution" ? scope.scope : scope;
        const substitutions = new Map();
        if (scope.kind === "substitution")
            for (const [input, replacement] of scope.substitutions) {
                const applied = applyScope(replacement, selected);
                if (applied === undefined)
                    return undefined;
                substitutions.set(input, applied);
            }
        const originals = parameters(base);
        if (originals === undefined)
            return undefined;
        for (const [input, replacement] of selected) {
            if (!budget.step())
                return undefined;
            if (originals.has(input) && !substitutions.has(input))
                substitutions.set(input, replacement);
        }
        const key = substitutionKey(substitutions);
        const retained = views.get(base);
        const cached = retained?.get(key);
        if (cached !== undefined)
            return remember(cached);
        if (!rows.add(1 + substitutions.size + (retained === undefined ? 1 : 0)))
            return undefined;
        const result = Object.freeze({ kind: "substitution", scope: base, substitutions });
        const selections = retained ?? new Map();
        selections.set(key, result);
        views.set(base, selections);
        return remember(result);
    });
    const applyTerm = (term, replacements) => {
        if (!budget.step())
            return undefined;
        if (replacements.size === 0)
            return term;
        if (term.kind === "execution-root")
            return term;
        if (term.kind === "empty") {
            if (term.absence === undefined)
                return term;
            const scope = applyScope(term.absence.scope, replacements);
            return scope === undefined ? undefined : scope === term.absence.scope ? term
                : Object.freeze({ kind: "empty", absence: Object.freeze({ ...term.absence, scope }) });
        }
        if (term.kind === "guarded") {
            const value = applyTerm(term.value, replacements);
            return value === undefined ? undefined : value === term.value ? term : Object.freeze({ ...term, value });
        }
        if (term.kind === "transition") {
            const condition = applyTerm(term.condition, replacements);
            if (condition === undefined)
                return undefined;
            return budget.withRows(temporary => {
                const free = new Map();
                for (const [input, replacement] of replacements) {
                    if (!budget.step())
                        return undefined;
                    if (input === term.capture)
                        continue;
                    if (!temporary.add(1))
                        return undefined;
                    free.set(input, replacement);
                }
                const value = free.size === 0 ? term.value : applyTerm(term.value, free);
                return value === undefined ? undefined : condition === term.condition && value === term.value ? term
                    : Object.freeze({ ...term, condition, value });
            });
        }
        if (term.kind === "store") {
            const destination = applyTerm(term.destination, replacements);
            const receiver = applyTerm(term.receiver, replacements);
            const value = applyTerm(term.value, replacements);
            return destination === undefined || receiver === undefined || value === undefined
                ? undefined : destination === term.destination && receiver === term.receiver && value === term.value ? term
                : Object.freeze({ ...term, destination, receiver, value });
        }
        const scope = applyScope(term.scope, replacements);
        if (scope === undefined)
            return undefined;
        if (term.kind === "instantiation") {
            const value = applyTerm(term.value, replacements);
            const parameter = applyScope(term.parameter, replacements);
            if (value === undefined || value.kind !== "reference" && value.kind !== "leaf" || parameter === undefined)
                return undefined;
            return value === term.value && parameter === term.parameter && scope === term.scope ? term
                : Object.freeze({ ...term, value, parameter, scope });
        }
        if (term.kind === "input-frontier") {
            const inputScope = applyScope(term.input.scope, replacements);
            return inputScope === undefined ? undefined : scope === term.scope && inputScope === term.input.scope ? term
                : Object.freeze({ ...term, scope, input: Object.freeze({ ...term.input, scope: inputScope }) });
        }
        if (term.kind === "input-projection") {
            const value = applyTerm(term.value, replacements);
            return value?.kind !== "input-frontier" ? undefined : value === term.value && scope === term.scope ? term
                : Object.freeze({ ...term, value, scope });
        }
        if (term.kind === "pointer") {
            const pointer = applyTerm(term.pointer, replacements);
            const input = term.input === undefined ? undefined : applyTerm(term.input, replacements);
            return pointer === undefined || term.input !== undefined && input === undefined ? undefined
                : scope === term.scope && pointer === term.pointer && input === term.input ? term
                    : Object.freeze({ ...term, scope, pointer, input });
        }
        if (term.kind === "application") {
            const callee = applyTerm(term.callee, replacements);
            if (term.activation.kind === "provided") {
                const argument = term.activation.argument === undefined ? undefined : applyTerm(term.activation.argument, replacements);
                return callee === undefined || term.activation.argument !== undefined && argument === undefined ? undefined
                    : scope === term.scope && callee === term.callee && argument === term.activation.argument ? term
                        : Object.freeze({ ...term, scope, callee, activation: Object.freeze({ kind: "provided", argument }) });
            }
            const entered = term.activation.kind === "entered" ? applyScope(term.activation.scope, replacements) : undefined;
            return callee === undefined || term.activation.kind === "entered" && entered === undefined ? undefined
                : scope === term.scope && callee === term.callee &&
                    (term.activation.kind === "invoke" || entered === term.activation.scope) ? term
                    : Object.freeze({ ...term, scope, callee, activation: term.activation.kind === "invoke" ? term.activation
                            : Object.freeze({ kind: "entered", scope: entered, actualTypes: term.activation.actualTypes }) });
        }
        if (term.kind === "member") {
            const receiver = applyTerm(term.receiver, replacements);
            return receiver === undefined ? undefined : scope === term.scope && receiver === term.receiver ? term
                : Object.freeze({ ...term, scope, receiver });
        }
        return scope === term.scope ? term : Object.freeze({ ...term, scope });
    };
    const project = (entry, origin, retain, selectedRoot, selectionScope) => {
        if (entry.kind === "empty")
            return retain(1) ? [entry] : undefined;
        if (entry.kind === "input-frontier") {
            const root = selectedRoot ?? subject(origin.node, origin.kind);
            const selected = root === undefined ? undefined : subject(root.node, root.kind, [...root.projection, ...origin.projection]);
            if (selected === undefined || sourceStorageProjectionType(source, selected, entry.views) === undefined || !retain(1))
                return undefined;
            return origin.projection.length === 0 ? [Object.freeze({ ...entry, subject: selected, scope: selectionScope })]
                : [Object.freeze({ kind: "input-projection", value: entry, subject: selected, scope: selectionScope })];
        }
        if (origin.projection.length === 0)
            return retain(1) ? [entry] : undefined;
        const from = sourceStorageProjectionType(source, entry.subject, entry.views);
        if (from === undefined)
            return undefined;
        if (sourceStorageIsAbsentType(from))
            return retain(1) ? [Object.freeze({ kind: "empty", absence: sourceStorageReference(entry.subject, entry.scope) })] : undefined;
        const selected = [];
        const collect = (projection) => {
            const projected = subject(entry.subject.node, entry.subject.kind, projection);
            if (projected !== undefined && retain(1))
                selected.push(Object.freeze({ ...entry, subject: projected, kind: "reference" }));
        };
        const memberIndex = origin.projection.findIndex(sourceStorageIsMemberProjection);
        if (memberIndex < 0)
            collect([...entry.subject.projection, ...origin.projection]);
        else {
            const root = selectedRoot ?? subject(origin.node, origin.kind);
            const to = root === undefined ? undefined : sourceStorageSubjectType(source, root);
            if (to === undefined)
                return undefined;
            const component = origin.projection[memberIndex];
            const prefix = origin.projection.slice(0, memberIndex);
            const contract = root === undefined ? undefined : subject(root.node, root.kind, [...root.projection, ...prefix]);
            if (component === undefined || !sourceStorageIsMemberProjection(component) || contract === undefined)
                return undefined;
            sourceStorageProjectComponents(entry.subject.projection, from, to, prefix, source, source.ast, budget, projection => {
                const receiver = subject(entry.subject.node, entry.subject.kind, projection);
                if (receiver === undefined || !retain(1))
                    return;
                selected.push(Object.freeze({ kind: "member", selection: Object.freeze({ kind: "projection", subject: contract,
                        declaration: component.declaration, evaluation: undefined, before: undefined }),
                    receiver: Object.freeze({ ...entry, subject: receiver }), scope: entry.scope,
                    projection: origin.projection.slice(memberIndex + 1), mode: "value" }));
            });
        }
        return budget.failure() === undefined ? selected : undefined;
    };
    const traverse = createSourceStorageScopedTraversal(budget);
    const applyPath = (term, path) => {
        let selected = term;
        for (let current = path; current !== undefined; current = current.parent) {
            if (!budget.step() || selected === undefined)
                return undefined;
            selected = applyTerm(selected, current.replacements);
        }
        return selected;
    };
    const selectEntries = (origin, entry, path, retain, selectedRoot, selectionScope) => {
        if (origin.projection.length === 0 && path === undefined)
            return retain(1) ? Object.freeze({ kind: "replace", terms: entry.values, initialization: entry.initialization }) : undefined;
        const terms = [];
        for (const value of entry.values) {
            if (!budget.step())
                return undefined;
            const projected = project(value, origin, retain, selectedRoot, selectionScope);
            if (projected === undefined)
                return undefined;
            for (const value of projected) {
                const applied = applyPath(value, path);
                if (applied === undefined)
                    return undefined;
                terms.push(applied);
            }
        }
        return Object.freeze({ kind: "replace", terms: Object.freeze(terms), initialization: entry.initialization });
    };
    const variableIncludesOwner = (variable, owner) => {
        let lexical = variable.capture === undefined ? variable.owner : source.ast.parent(variable.owner);
        while (lexical !== undefined && lexical !== owner) {
            if (!budget.step())
                return false;
            lexical = source.ast.parent(lexical);
        }
        return lexical === owner;
    };
    const selectVariable = (origin, variable, path, retain) => {
        const owner = sourceStorageFormalOwner(origin, source);
        if (owner === undefined || !variableIncludesOwner(variable, owner))
            return undefined;
        const initial = entryInputFor(origin, variable);
        if (initial === undefined)
            return Object.freeze({ kind: "expand", variable });
        if (!retain(1))
            return undefined;
        const selected = applyPath(sourceStorageReference(initial, variable.equation.initial), path);
        return selected === undefined ? undefined : Object.freeze({ kind: "replace", terms: Object.freeze([selected]), initialization: "actual" });
    };
    const selectInput = (origin, root, scope, retain) => {
        if (scope.kind === "variable")
            return selectVariable(origin, scope, undefined, retain);
        const select = (entries) => {
            for (let length = origin.projection.length; length >= 0; length -= 1) {
                if (!budget.step())
                    return undefined;
                const prefix = length === 0 ? root : subject(origin.node, origin.kind, origin.projection.slice(0, length));
                const selected = prefix === undefined ? undefined : entries.get(prefix);
                if (selected === undefined)
                    continue;
                const remaining = subject(origin.node, origin.kind, origin.projection.slice(length));
                return remaining === undefined || prefix === undefined ? undefined : { subject: remaining, root: prefix, entries: selected };
            }
            return undefined;
        };
        const local = select((scope.kind === "substitution" ? scope.scope : scope).entries);
        if (local !== undefined) {
            if (scope.kind === "frame")
                return selectEntries(local.subject, local.entries, undefined, retain, local.root, scope);
            return budget.withRows(rows => rows.add(1) ? selectEntries(local.subject, local.entries, { replacements: scope.substitutions, parent: undefined }, retain, local.root, scope) : undefined);
        }
        for (const current of traverse(scope)) {
            if (current.scope.kind === "variable") {
                const selected = selectVariable(origin, current.scope, current.path, retain);
                if (selected !== undefined)
                    return selected;
                continue;
            }
            const selected = select(current.scope.entries);
            if (selected !== undefined)
                return selectEntries(selected.subject, selected.entries, current.path, retain, selected.root, scope);
        }
        return undefined;
    };
    const lookup = (origin, scope) => {
        if (!budget.step() || origin.kind !== "input" && origin.kind !== "receiver")
            return undefined;
        if (origin.projection.length !== 0 && scope.kind === "frame" && scope.boundary === "declaration" &&
            sourceStorageFormalOwner(origin, source) === scope.owner)
            return undefined;
        const root = subject(origin.node, origin.kind);
        if (root === undefined)
            return undefined;
        const frame = scope.kind === "substitution" ? scope.scope : scope;
        const withInputs = frame.kind === "frame" && frame.entries.has(root) ? withQueryMemo : withTraversal;
        return withInputs(memo => {
            const selections = memo.lookups.get(scope);
            const retained = selections?.get(origin);
            if (retained !== undefined)
                return retained ?? undefined;
            const selected = selectInput(origin, root, scope, memo.add);
            if (budget.failure() !== undefined || !memo.add(selections === undefined ? 2 : 1))
                return undefined;
            const inputs = selections ?? new Map();
            inputs.set(origin, selected ?? null);
            memo.lookups.set(scope, inputs);
            return selected;
        });
    };
    const inputBase = (origin, scope) => {
        const root = subject(origin.node, origin.kind);
        if (root === undefined || origin.projection.length === 0)
            return root;
        const owner = sourceStorageFormalOwner(origin, source);
        for (const current of traverse(scope)) {
            if (!budget.step())
                return undefined;
            if (current.scope.kind === "variable") {
                if (owner !== undefined && variableIncludesOwner(current.scope, owner))
                    return root;
                continue;
            }
            for (let length = origin.projection.length; length >= 0; length -= 1) {
                if (!budget.step())
                    return undefined;
                const prefix = length === 0 ? root : subject(origin.node, origin.kind, origin.projection.slice(0, length));
                if (prefix === undefined)
                    return undefined;
                if (current.scope.entries.has(prefix))
                    return prefix;
            }
        }
        return budget.failure() === undefined ? root : undefined;
    };
    const { frameFor, enterApplication, declarationFor } = createSourceStorageScopeFrames({
        source, budget, rows, subject, inputSlotsFor, invocationInputs, identity, callbackKey,
    });
    const owningScope = (scope, owner) => withTraversal(memo => {
        if (!budget.step())
            return undefined;
        if (scope === empty)
            return undefined;
        if (scope.kind !== "substitution" && scope.owner === owner)
            return scope;
        const selections = memo.owners.get(scope);
        const retained = selections?.get(owner);
        if (retained !== undefined)
            return retained ?? undefined;
        let selected;
        for (const current of traverse(scope)) {
            if (current.scope.owner !== owner && (current.scope.kind !== "variable" ||
                current.scope.capture === undefined || !variableIncludesOwner(current.scope, owner)))
                continue;
            selected = current.scope;
            for (let path = current.path; path !== undefined; path = path.parent) {
                if (!budget.step() || selected === undefined)
                    return undefined;
                selected = applyScope(selected, path.replacements);
            }
            break;
        }
        if (budget.failure() !== undefined || !memo.add(selections === undefined ? 2 : 1))
            return undefined;
        const values = selections ?? new Map();
        values.set(owner, selected ?? null);
        memo.owners.set(scope, values);
        return selected;
    });
    const family = (scope) => withTraversal(memo => {
        if (!budget.step())
            return undefined;
        if (scope === empty)
            return undefined;
        if (scope.kind === "variable")
            return scope.equation;
        if (scope.kind === "frame" && scope.equation !== undefined)
            return scope.equation;
        const retained = memo.families.get(scope);
        if (retained !== undefined)
            return retained ?? undefined;
        let equation;
        for (const current of traverse(scope, "caller")) {
            if (current.scope.equation === undefined)
                continue;
            equation = current.scope.equation;
            break;
        }
        if (budget.failure() !== undefined || !memo.add(1))
            return undefined;
        memo.families.set(scope, equation ?? null);
        return equation;
    });
    const boundActivation = (scope, owner) => withTraversal(() => {
        const selected = owningScope(scope, owner);
        if (selected === undefined || selected.kind === "variable")
            return undefined;
        const frame = selected.kind === "substitution" ? selected.scope : selected;
        if (frame.owner !== owner)
            return undefined;
        if (frame.boundary === "declaration")
            return { scope: selected };
        if (frame.invocation === undefined || frame.caller === undefined)
            return undefined;
        const caller = selected.kind === "substitution" ? applyScope(frame.caller, selected.substitutions) : frame.caller;
        return caller === undefined ? undefined : frame.callback === undefined
            ? { scope: selected, invocation: frame.invocation, caller }
            : { scope: selected, nativeEntry: { invocation: frame.invocation, callback: frame.callback, caller } };
    });
    const activation = createSourceStorageActivationKeys(budget, rows, { empty, subject, identity, callbackKey, applyScope, owningScope, declarationFor }, creation);
    const formals = (scope) => budget.withRows(temporary => {
        const selected = new Set();
        const visited = new Set();
        const pending = [scope];
        while (pending.length !== 0) {
            if (!budget.step())
                return undefined;
            const current = pending.pop();
            if (visited.has(current))
                continue;
            if (!temporary.add(1))
                return undefined;
            visited.add(current);
            if (current.kind === "variable") {
                const parameters = source.ast.is.IsClassDeclaration(current.owner) || source.ast.is.IsClassExpression(current.owner)
                    ? [] : sourceCallableValueParameters(source.ast, current.owner, source.navigation, { kind: "declaration" });
                if (parameters === undefined)
                    return undefined;
                for (const parameter of [...parameters, current.owner]) {
                    if (parameter === undefined || !budget.step())
                        continue;
                    const formal = subject(parameter, parameter === current.owner ? "receiver" : "input");
                    if (formal !== undefined)
                        selected.add(formal);
                }
                pending.push(current.equation.initial);
            }
            else if (current.kind === "substitution")
                pending.push(current.scope, ...current.substitutions.values());
            else {
                for (const formal of current.entries.keys()) {
                    if (!budget.step())
                        return undefined;
                    selected.add(formal);
                }
                pending.push(...current.parents);
            }
        }
        return selected;
    });
    return Object.freeze({ empty, identity, callbackKey, variable, variablesFor, applyScope, applyTerm, lookup, inputBase, frameFor, enterApplication, declarationFor,
        executionRoots: (scope) => withTraversal(() => budget.withRows(temporary => {
            const roots = [];
            const seen = new Set();
            let entry = false;
            for (const direction of ["caller", "lexical"])
                for (const current of traverse(scope, direction)) {
                    if (!budget.step())
                        return undefined;
                    if (current.scope.owner === undefined)
                        continue;
                    entry || (entry = current.scope.callback !== undefined || current.scope.kind === "frame" &&
                        current.scope.boundary === "declaration" && source.ast.body(current.scope.owner) !== undefined);
                    let bound = current.scope;
                    for (let path = current.path; path !== undefined && bound !== undefined; path = path.parent)
                        bound = applyScope(bound, path.replacements);
                    if (bound === undefined)
                        return undefined;
                    if (seen.has(bound))
                        continue;
                    if (!temporary.add(2))
                        return undefined;
                    seen.add(bound);
                    roots.push(Object.freeze({ owner: current.scope.owner, scope: bound, invocation: current.scope.kind === "frame" ? current.scope.invocation : undefined,
                        callback: current.scope.callback }));
                }
            return entry ? Object.freeze(roots) : Object.freeze([]);
        })),
        isDeferred: (scope) => withTraversal(() => {
            for (const current of traverse(scope, "caller")) {
                if (!budget.step())
                    return false;
                if (current.scope.callback !== undefined && current.scope.callback.timing !== "synchronous")
                    return true;
            }
            return false;
        }),
        isSymbolic: (value) => {
            if (value.kind !== "leaf" && value.kind !== "input-frontier" || value.scope.kind !== "frame" ||
                sourceStorageFormalOwner(value.subject, source) !== value.scope.owner)
                return false;
            if (value.scope.boundary === "declaration")
                return true;
            if (value.scope.callback === undefined || value.subject.kind !== "input")
                return false;
            const root = subject(value.subject.node, value.subject.kind);
            const input = root === undefined ? undefined : value.scope.entries.get(root);
            const original = input?.values.length === 1 ? input.values[0] : undefined;
            return input?.initialization === "actual" && original?.kind === "leaf" &&
                original.subject === root && original.scope === value.scope;
        },
        owningScope, boundActivation, project, family, activation, activationKey: (scope) => activation(scope)?.key, formals,
        withQuery: (collect) => withQueryMemo(() => collect()),
        withTraversal: (collect) => withTraversal(() => collect()) });
}
//# sourceMappingURL=scoped-scopes.js.map