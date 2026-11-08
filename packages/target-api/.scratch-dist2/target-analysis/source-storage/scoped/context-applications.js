import { sourceStorageIsGenerator } from "../model/host-reads.js";
import { sourceCallableValueParameters } from "../../../source-navigation/callable-parameters.js";
export function createSourceStorageContextApplications(source, budget, queries, graph) {
    const rows = budget.createRows();
    const bindings = new Map();
    const selections = new Map();
    const projections = new Map();
    const isPort = (subject) => subject.kind === "input" || subject.kind === "receiver";
    const ownsPort = (subject, candidate) => {
        if (subject.kind === "receiver")
            return subject.node === candidate;
        if (subject.kind !== "input" || source.ast.is.IsClassDeclaration(candidate) || source.ast.is.IsClassExpression(candidate))
            return false;
        const parameters = sourceCallableValueParameters(source.ast, candidate, source.navigation, { kind: "declaration" });
        if (parameters === undefined) {
            budget.reject("Source storage context ports require their exact checked value parameters.");
            return undefined;
        }
        return parameters.includes(subject.node);
    };
    const binding = (subject, candidate, invocation) => {
        const candidates = bindings.get(subject);
        const invocations = candidates?.get(candidate);
        const retained = invocations?.get(invocation);
        if (retained !== undefined)
            return retained;
        if (!rows.add(1 + (candidates === undefined ? 1 : 0) + (invocations === undefined ? 1 : 0)))
            return undefined;
        const selected = Object.freeze({ kind: "binding", subject, candidate, invocation });
        const calls = invocations ?? new Map();
        const owners = candidates ?? new Map();
        calls.set(invocation, selected);
        owners.set(candidate, calls);
        bindings.set(subject, owners);
        return selected;
    };
    const instantiate = (port, candidate, invocation) => {
        const owned = ownsPort(port, candidate);
        if (owned === undefined)
            return undefined;
        if (!owned)
            return [];
        const result = [];
        const inputs = queries.invocationInputs(port, candidate, invocation);
        for (const input of inputs.subjects) {
            if (!budget.step())
                return undefined;
            if (input === port) {
                result.push({ kind: "value", value: port });
                continue;
            }
            const selected = inputs.context === "callee" ? binding(input, candidate, invocation) : input;
            if (selected === undefined)
                return undefined;
            result.push({ kind: "relation", key: selected });
        }
        return budget.failure() === undefined ? result : undefined;
    };
    const projectionFor = (current, candidate, invocation) => {
        const candidates = projections.get(current);
        const cached = candidates?.get(candidate);
        if (cached !== undefined)
            return cached;
        if (!rows.add(candidates === undefined ? 2 : 1))
            return undefined;
        const projection = current.kind === "binding"
            ? (value) => {
                const owned = ownsPort(value, candidate);
                return owned === undefined ? undefined : owned ? instantiate(value, candidate, invocation) : [{ kind: "value", value }];
            }
            : (value) => isPort(value)
                ? instantiate(value, candidate, invocation)
                : queries.ownerFor(value.node) === candidate ? [{ kind: "value", value: current }] : [];
        const selected = candidates ?? new Map();
        selected.set(candidate, projection);
        projections.set(current, selected);
        return projection;
    };
    const dependencies = graph.fixedPoint((current, _read, emit, forward) => {
        if (current.kind === "binding") {
            const projection = projectionFor(current, current.candidate, current.invocation);
            if (projection === undefined) {
                budget.reject("Source storage context bindings require a projection for their selected candidate.");
                return false;
            }
            return forward(current.subject, projection);
        }
        if (isPort(current))
            return emit(current);
        const location = queries.locationFor(current);
        if (location !== undefined && !emit(current))
            return false;
        if (location === "binding")
            return budget.failure() === undefined;
        const direct = queries.inputsFor(current);
        if (direct === undefined) {
            budget.reject("Source storage context traversal requires the subject's exact direct inputs.");
            return false;
        }
        for (const input of direct)
            if (!budget.step() || !forward(input))
                return false;
        if (!queries.isInvocation(current.node))
            return budget.failure() === undefined;
        const candidates = queries.implementationsFor(current.node);
        const deferred = [...candidates].some(candidate => source.ast.hasModifierKind(candidate, "async") ||
            sourceStorageIsGenerator(source, candidate));
        if (deferred && !emit(current))
            return false;
        if (candidates.size === 0 || source.ast.is.IsNewExpression(current.node) || deferred) {
            for (const expression of queries.argumentsFor(current.node)) {
                if (!budget.step())
                    return false;
                const subject = queries.subjectFor(expression);
                if (subject === undefined) {
                    budget.reject("Source storage invocation arguments require exact storage subjects.");
                    return false;
                }
                if (!forward(subject))
                    return false;
            }
        }
        if (candidates.size === 0) {
            for (const input of queries.incomingFor(current))
                if (!budget.step() || !forward(input))
                    return false;
        }
        for (const candidate of candidates) {
            if (!budget.step())
                return false;
            if (source.ast.hasModifierKind(candidate, "async") ||
                sourceStorageIsGenerator(source, candidate))
                continue;
            const result = queries.subject(candidate, "return", current.projection);
            const projection = projectionFor(current, candidate, current.node);
            if (result === undefined || projection === undefined) {
                budget.reject("Source storage invocation candidates require an exact return subject and projection.");
                return false;
            }
            if (!forward(result, projection))
                return false;
        }
        return budget.failure() === undefined;
    }, "context-applications");
    return (subject) => {
        if (!queries.isInvocation(subject.node) || !budget.step())
            return undefined;
        const cached = selections.get(subject);
        if (cached !== undefined)
            return cached;
        const values = dependencies(subject);
        if (values === undefined)
            return undefined;
        const ports = new Set();
        const locations = new Set();
        for (const value of values) {
            if (!budget.step())
                return undefined;
            (isPort(value) ? ports : locations).add(value);
        }
        if (!rows.add(3 + values.size))
            return undefined;
        const result = Object.freeze({ ports, locations });
        selections.set(subject, result);
        return result;
    };
}
//# sourceMappingURL=context-applications.js.map