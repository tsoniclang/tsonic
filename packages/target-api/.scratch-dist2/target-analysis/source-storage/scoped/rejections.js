import { sourceStorageInvocationReceiver } from "../model/host-reads.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageExecutionDemands, walkSourceStorageExecution } from "./execution-reachability.js";
export function createSourceStorageScopedRejections(source, budget, transport, scopes, reachability, queries) {
    const relevant = new Map();
    const relevantRows = budget.createRows();
    let caughtSites;
    const nativeThrows = new Set([...transport.pointerInvocations,
        ...[...transport.invocationEffects].filter(([, effect]) => effect.resumeReceiver === true).map(([invocation]) => invocation)]);
    const reachesNativeThrow = (invocation) => {
        const previous = relevant.get(invocation);
        if (previous !== undefined)
            return previous;
        let selected = false;
        for (const pointer of nativeThrows) {
            if (!budget.step())
                return undefined;
            const reaches = pointer === invocation || reachability.invocation(invocation, pointer);
            if (reaches === undefined)
                return undefined;
            if (reaches) {
                selected = true;
                break;
            }
        }
        if (!relevantRows.add(1))
            return undefined;
        relevant.set(invocation, selected);
        return selected;
    };
    const invocationThrows = (invocation, scope) => {
        if (transport.pointerInvocations.has(invocation))
            return queries.pointerThrows(invocation, scope);
        if (transport.invocationEffects.get(invocation)?.resumeReceiver === true) {
            const receiver = transport.subjectFor(sourceStorageInvocationReceiver(source, invocation));
            if (receiver === undefined)
                return undefined;
            const terms = [queries.application(invocation, receiver, scope, [], { mode: "throw" })];
            return terms;
        }
        const target = transport.invocationTargets.get(invocation);
        return target === undefined ? undefined : [queries.application(invocation, target, scope, [], { mode: "throw" })];
    };
    const callableThrows = (subject, candidate, invocation, scope, actualTypes, phase = "call") => {
        if (budget.failure() !== undefined)
            return undefined;
        if (phase === "call" && source.ast.hasModifierKind(candidate, "async"))
            return [Object.freeze({ kind: "empty", absence: undefined })];
        const terms = [];
        for (const region of transport.regions.callable(candidate, invocation, undefined, undefined, actualTypes, phase)) {
            if (!budget.step())
                return undefined;
            const reason = transport.unresolvedThrows.get(region);
            if (reason !== undefined)
                terms.push(Object.freeze({ kind: "unresolved", subject, scope, reason, exposure: invocation }));
            for (const origin of transport.thrownOrigins.get(region) ?? []) {
                if (!budget.step())
                    return undefined;
                terms.push(sourceStorageReference(origin, scope));
            }
            for (const nested of transport.regions.invocationsIn(region) ?? []) {
                if (!budget.step())
                    return undefined;
                if (transport.regions.catchDestination(nested) !== undefined)
                    continue;
                const relevant = reachesNativeThrow(nested);
                if (relevant === undefined)
                    return undefined;
                if (!relevant)
                    continue;
                const selected = invocationThrows(nested, scope);
                if (selected === undefined)
                    return undefined;
                terms.push(...selected);
            }
        }
        return budget.failure() !== undefined ? undefined : terms.length === 0
            ? [Object.freeze({ kind: "empty", absence: undefined })] : terms;
    };
    const caught = (reference) => {
        if (reference.subject.kind !== "input" || reference.subject.projection.length !== 0)
            return undefined;
        if (caughtSites === undefined) {
            const index = new Map();
            for (const invocation of transport.invocations) {
                if (!budget.step())
                    return undefined;
                const destination = transport.regions.catchDestination(invocation);
                if (destination === undefined)
                    continue;
                const selected = reachesNativeThrow(invocation);
                if (selected === undefined)
                    return undefined;
                if (!selected)
                    continue;
                const sites = index.get(destination);
                if (!relevantRows.add(sites === undefined ? 2 : 1))
                    return undefined;
                if (sites === undefined)
                    index.set(destination, [invocation]);
                else
                    sites.push(invocation);
            }
            caughtSites = index;
        }
        const sites = caughtSites.get(reference.subject.node);
        if (sites === undefined)
            return undefined;
        const terms = [...transport.incomingFor(reference.subject)]
            .map(subject => sourceStorageReference(subject, reference.scope));
        for (const invocation of sites) {
            const roots = sourceStorageExecutionDemands(transport, scopes, budget, invocation, reference.scope, scopes.isDeferred(reference.scope));
            if (roots === undefined)
                return undefined;
            for (const value of walkSourceStorageExecution(budget, roots, queries.read)) {
                if (!budget.step())
                    return undefined;
                if (value.kind === "unresolved")
                    terms.push(value);
                if (value.kind !== "leaf" || value.subject.node !== invocation)
                    continue;
                const thrown = invocationThrows(invocation, value.scope);
                if (thrown === undefined)
                    return undefined;
                terms.push(...thrown);
            }
        }
        return budget.failure() === undefined ? { kind: "replace", terms } : undefined;
    };
    return Object.freeze({ caught, callableThrows });
}
//# sourceMappingURL=rejections.js.map