import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { sourceStorageReference, type SourceStorageTerm, type SourceStorageReduction } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { createSourceStorageExecutionReachability, createSourceStorageInputExecutions } from "./execution-reachability.js";
import type { createSourceStorageExecutionContext } from "./execution-context.js";
import type { createSourceStoragePointerValues } from "./pointer-values.js";

export interface SourceStorageRegionSuccessorContext extends Pick<ReturnType<typeof createSourceStorageExecutionContext>, "application" | "leaf"> {
  readonly source: TargetSourceProgram;
  readonly budget: SourceStorageBudget;
  readonly transport: SourceStorageScopedTransport;
  readonly reachability: ReturnType<typeof createSourceStorageExecutionReachability>;
  readonly nativeInputExecutions: ReturnType<typeof createSourceStorageInputExecutions>["nativeInputExecutions"];
  readonly pointerValues: Pick<ReturnType<typeof createSourceStoragePointerValues>, "execution">;
}

export function createSourceStorageRegionSuccessors(context: SourceStorageRegionSuccessorContext) {
  const { source, budget, transport, reachability, nativeInputExecutions, pointerValues, application, leaf } = context;
  const { ast, semantics } = source;
  return (term: Extract<SourceStorageTerm, { readonly kind: "region" }>): SourceStorageReduction | undefined => {
    const terms: SourceStorageTerm[] = [];
    const demandRegion = transport.regions.enclosing(term.demand);
    if (demandRegion === term.region && term.demand !== term.region) {
      const selected = transport.subjectFor(term.demand);
      if (selected === undefined) {
        budget.reject("A source execution demand requires its identical checked value subject."); return undefined;
      }
      terms.push(leaf(selected, term.scope));
    }
    if (term.region === term.demand) for (const store of transport.storesIn(term.region) ?? []) {
      if (!budget.step()) return undefined;
      terms.push(Object.freeze({ kind: "effect", store, scope: term.scope }));
    }
    for (const invocation of transport.regions.invocationsIn(term.region) ?? []) {
      if (!budget.step()) return undefined;
      const reaches = reachability.invocation(invocation, term.demand);
      if (reaches === undefined) return undefined;
      if (!reaches) continue;
      if (transport.pointerInvocations.has(invocation)) {
        const pointerExecution = pointerValues.execution(invocation, term.scope, term.demand, term.deferred);
        if (pointerExecution === undefined) return undefined;
        terms.push(...pointerExecution); continue;
      }
      if (transport.invocationEffects.get(invocation)?.resumeReceiver === true) {
        const receiver = semantics.forNode(invocation).operations.call(invocation)?.sourceReceiver?.expression;
        const subject = transport.subjectFor(receiver);
        if (subject === undefined) return undefined;
        terms.push(application(invocation, subject, term.scope, [], {
          mode: "execution", demand: term.demand, deferred: term.deferred,
        }));
        continue;
      }
      const possible = nativeInputExecutions(invocation, term.scope, term.demand, term.deferred);
      if (possible === undefined) return undefined;
      terms.push(...possible);
      for (const callback of transport.callbackEntriesFor(invocation)) {
        if (!budget.step()) return undefined;
        if (callback.timing === "deferred" && !term.deferred) continue;
        terms.push(Object.freeze({ kind: "application", invocation, callback, activation: Object.freeze({ kind: "invoke" }),
          callee: sourceStorageReference(callback.argument.actual, term.scope), scope: term.scope,
          projection: [], mode: "execution", demand: term.demand, deferred: term.deferred }));
      }
      const target = transport.invocationTargets.get(invocation);
      if (target !== undefined) terms.push(application(invocation, target, term.scope, [],
        { mode: "execution", demand: term.demand, deferred: term.deferred }));
      else if (transport.accessorTargets.has(invocation)) {
        for (const target of transport.accessorTargets.get(invocation) ?? []) {
          if (!budget.step()) return undefined;
          const receiver = transport.subjectFor(target.receiver);
          if (receiver === undefined) return undefined;
          const selection = ast.is.IsSpreadAssignment(invocation) || ast.is.IsBindingElement(invocation)
            ? Object.freeze({ kind: "projection" as const, subject: receiver, declaration: target.declaration, evaluation: invocation, before: undefined })
            : Object.freeze({ kind: "access" as const, node: invocation });
          terms.push(Object.freeze({ kind: "member", selection, receiver: sourceStorageReference(receiver, term.scope),
            scope: term.scope, projection: [], mode: "execution", demand: term.demand, deferred: term.deferred }));
        }
      }
    }
    return { kind: "replace", terms };
  };
}
