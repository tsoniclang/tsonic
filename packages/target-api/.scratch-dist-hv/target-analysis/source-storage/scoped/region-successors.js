import { sourceStorageInvocationReceiver } from "../model/host-reads.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
export function createSourceStorageRegionSuccessors(context) {
    const { source, budget, transport, reachability, nativeInputExecutions, pointerValues, application, leaf } = context;
    const { ast } = source;
    return (term) => {
        const terms = [];
        const demandRegion = transport.regions.enclosing(term.demand);
        if (demandRegion === term.region && term.demand !== term.region) {
            const selected = transport.subjectFor(term.demand);
            if (selected === undefined) {
                budget.reject("A source execution demand requires its identical checked value subject.");
                return undefined;
            }
            terms.push(leaf(selected, term.scope));
        }
        if (term.region === term.demand)
            for (const store of transport.storesIn(term.region) ?? []) {
                if (!budget.step())
                    return undefined;
                terms.push(Object.freeze({ kind: "effect", store, scope: term.scope }));
            }
        for (const invocation of transport.regions.invocationsIn(term.region) ?? []) {
            if (!budget.step())
                return undefined;
            const reaches = reachability.invocation(invocation, term.demand);
            if (reaches === undefined)
                return undefined;
            if (!reaches)
                continue;
            if (transport.pointerInvocations.has(invocation)) {
                const pointerExecution = pointerValues.execution(invocation, term.scope, term.demand, term.deferred);
                if (pointerExecution === undefined)
                    return undefined;
                terms.push(...pointerExecution);
                continue;
            }
            if (transport.invocationEffects.get(invocation)?.resumeReceiver === true) {
                const receiver = sourceStorageInvocationReceiver(source, invocation);
                const subject = transport.subjectFor(receiver);
                if (subject === undefined)
                    return undefined;
                terms.push(application(invocation, subject, term.scope, [], {
                    mode: "execution", demand: term.demand, deferred: term.deferred,
                }));
                continue;
            }
            const possible = nativeInputExecutions(invocation, term.scope, term.demand, term.deferred);
            if (possible === undefined)
                return undefined;
            terms.push(...possible);
            for (const callback of transport.callbackEntriesFor(invocation)) {
                if (!budget.step())
                    return undefined;
                if (callback.timing === "deferred" && !term.deferred)
                    continue;
                terms.push(Object.freeze({ kind: "application", invocation, callback, activation: Object.freeze({ kind: "invoke" }),
                    callee: sourceStorageReference(callback.argument.actual, term.scope), scope: term.scope,
                    projection: [], mode: "execution", demand: term.demand, deferred: term.deferred }));
            }
            const target = transport.invocationTargets.get(invocation);
            if (target !== undefined)
                terms.push(application(invocation, target, term.scope, [], { mode: "execution", demand: term.demand, deferred: term.deferred }));
            else if (transport.accessorTargets.has(invocation)) {
                for (const target of transport.accessorTargets.get(invocation) ?? []) {
                    if (!budget.step())
                        return undefined;
                    const receiver = transport.subjectFor(target.receiver);
                    if (receiver === undefined)
                        return undefined;
                    const selection = ast.is.IsSpreadAssignment(invocation) || ast.is.IsBindingElement(invocation)
                        ? Object.freeze({ kind: "projection", subject: receiver, declaration: target.declaration, evaluation: invocation, before: undefined })
                        : Object.freeze({ kind: "access", node: invocation });
                    terms.push(Object.freeze({ kind: "member", selection, receiver: sourceStorageReference(receiver, term.scope),
                        scope: term.scope, projection: [], mode: "execution", demand: term.demand, deferred: term.deferred }));
                }
            }
        }
        return { kind: "replace", terms };
    };
}
//# sourceMappingURL=region-successors.js.map