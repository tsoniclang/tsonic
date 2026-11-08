import { sourceStorageInvocationReceiver } from "../model/host-reads.js";
import { sourceStorageIsDataMember } from "../model/subjects.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageExecutionDemands, walkSourceStorageExecution } from "./execution-reachability.js";
import { Node_Expression } from "../../../source-navigation/index.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { sourceStorageClassLineages, sourceStorageInstanceCaptures, sourceStorageAllocations } from "../model/construction.js";
import { sourceInstanceInitializers, sourceSuperConstructor } from "../../../source-navigation/class-initialization.js";
export function createSourceStorageExecutionContext(source, budget, transport, scopes, reachability, readRelation) {
    const { ast, navigation } = source;
    const passiveMember = (declaration) => (sourceStorageIsDataMember(declaration, ast) ||
        ast.is.IsMethodDeclaration(declaration) || ast.is.IsMethodSignatureDeclaration(declaration)) &&
        transport.memberAccessorsFor(declaration)?.size === 0;
    const readEffects = function* (store, selection, deferred = false, context) {
        const starts = sourceStorageExecutionDemands(transport, scopes, budget, store.region, context, deferred, selection.execution);
        if (starts === undefined)
            return;
        const read = (term) => {
            if (selection.kind === "own-construction" && term.kind === "region" && term.region === store.region)
                return [Object.freeze({ kind: "effect", store, scope: term.scope })];
            const successors = readRelation(term);
            if (successors === undefined)
                return undefined;
            return (function* () {
                for (const successor of successors) {
                    if (!budget.step())
                        return;
                    if (successor.kind === "effect" && successor.store !== store)
                        continue;
                    if (selection.kind === "own-construction" && term.kind === "region" && successor.kind !== "unresolved" &&
                        (successor.kind !== "application" || sourceSuperConstructor(successor.invocation, source, budget.step) === undefined))
                        continue;
                    yield successor;
                }
            })();
        };
        for (const result of walkSourceStorageExecution(budget, starts, read))
            if (result.kind === "unresolved" || result.kind === "effect" && result.store === store)
                yield result;
    };
    const creatorScope = (node, scope) => {
        if (scope === scopes.empty)
            return scope;
        const region = transport.regions.enclosing(node);
        const owner = region === undefined ? undefined : sourceStorageRegionOwner(ast, region);
        return owner === undefined ? scopes.empty : scopes.owningScope(scope, owner) ?? scope;
    };
    const leaf = (subject, scope) => Object.freeze({ kind: "leaf", subject, scope });
    const symbolicInput = (subject, scope) => {
        const bound = scopes.lookup(subject, scope);
        return bound === undefined || bound.kind === "replace" && bound.terms.some(value => (value.kind === "leaf" || value.kind === "input-frontier") && scopes.isSymbolic(value));
    };
    const classQueries = {
        subjectFor: transport.subjectFor,
        nativeConstructorsFor: transport.nativeConstructorsFor,
        valuesFor(subject, bindings) {
            const terms = readRelation(sourceStorageReference(subject, bindings));
            if (terms === undefined)
                return undefined;
            const values = new Set();
            for (const term of terms) {
                if (!budget.step())
                    return undefined;
                if (term.kind === "unresolved") {
                    budget.reject(term.reason);
                    return undefined;
                }
                if (term.kind === "leaf")
                    values.add(Object.freeze({ subject: term.subject, bindings: term.scope }));
            }
            return values;
        },
    };
    const classLineages = (value, mode) => sourceStorageClassLineages(source, budget, new Set([{ subject: value.subject, bindings: value.scope }]), classQueries, mode);
    const instanceCaptures = (candidate, value) => sourceStorageInstanceCaptures(source, budget, candidate, new Set([{ subject: value.subject, bindings: value.scope }]), classQueries);
    const application = (invocation, target, scope, projection, operation) => {
        const caller = creatorScope(invocation, scope);
        return Object.freeze({ kind: "application", invocation, activation: Object.freeze({ kind: "invoke" }),
            callee: sourceStorageReference(target, caller), scope: caller, projection, ...operation });
    };
    const dispatchDependencies = (invocation, scope) => {
        if (transport.invocationEffects.get(invocation)?.resultAlias !== undefined)
            return [];
        const property = ast.is.IsPropertyAccessExpression(invocation) ? navigation.memberAccess(invocation) : undefined;
        const nodes = [Node_Expression(ast, invocation), sourceStorageInvocationReceiver(source, invocation) ?? property?.receiver];
        const selected = [];
        for (const node of nodes) {
            if (!budget.step())
                break;
            const subject = transport.subjectFor(node);
            if (subject !== undefined && subject.node !== invocation)
                selected.push(sourceStorageReference(subject, scope));
        }
        return selected;
    };
    const regionsFor = (candidate, invocation, scope, demand, construction, deferred = false, actualTypes) => {
        const terms = [];
        const frame = scope.kind === "substitution" ? scope.scope : scope;
        const callback = frame.kind === "frame" ? frame.callback : undefined;
        for (const region of transport.regions.callable(candidate, transport.accessorTargets.has(invocation) ? undefined : invocation, undefined, callback, actualTypes)) {
            if (!budget.step())
                return undefined;
            const reaches = reachability.region(region, demand);
            if (reaches === undefined)
                return undefined;
            if (reaches)
                terms.push(Object.freeze({ kind: "region", region, scope, demand, deferred }));
        }
        if (construction !== undefined)
            for (const captured of construction.classes) {
                if (!budget.step())
                    return undefined;
                const owner = captured.subject.node;
                const initializers = sourceInstanceInitializers(owner, source, budget.step);
                if (initializers === undefined)
                    return undefined;
                for (const initializer of initializers) {
                    const reaches = reachability.region(initializer, demand);
                    if (reaches === undefined)
                        return undefined;
                    if (!reaches)
                        continue;
                    const allocations = sourceStorageAllocations(source, budget, invocation, construction.caller, (owner, bindings) => {
                        const receiver = transport.subject(owner, "receiver");
                        const selected = receiver === undefined ? undefined : classQueries.valuesFor(receiver, bindings);
                        return selected === undefined ? { kind: "unresolved",
                            reason: "Instance initialization requires its completed original allocation receiver." } : [...selected];
                    });
                    if (allocations.kind === "unresolved")
                        return undefined;
                    for (const allocation of allocations.allocations) {
                        const context = scopes.frameFor(owner, allocation.call, allocation.callerBindings, captured.bindings);
                        if (context === undefined)
                            return undefined;
                        terms.push(Object.freeze({ kind: "region", region: initializer, scope: context, demand, deferred }));
                    }
                }
            }
        return Object.freeze(terms);
    };
    const independentCalleeFor = (invocation) => {
        if (!budget.step())
            return undefined;
        const candidates = transport.invocationImplementations(invocation);
        const candidate = candidates.size === 1 ? candidates.values().next().value : undefined;
        if (candidate === undefined || ast.body(candidate) === undefined ||
            ast.is.IsClassDeclaration(candidate) || ast.is.IsClassExpression(candidate))
            return undefined;
        const region = transport.regions.enclosing(candidate);
        if (region === undefined || sourceStorageRegionOwner(ast, region) !== undefined)
            return undefined;
        const subject = transport.subject(candidate);
        return subject !== undefined && transport.contextualInputs(subject)?.size === 0 ? candidate : undefined;
    };
    return Object.freeze({ readEffects, creatorScope, leaf, symbolicInput, classLineages, instanceCaptures, application,
        dispatchDependencies, regionsFor, passiveMember, independentCalleeFor });
}
//# sourceMappingURL=execution-context.js.map