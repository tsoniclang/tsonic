import type { Node, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageOperation, SourceStorageReduction, SourceStorageReference, SourceStorageScope, SourceStorageTerm } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import { sourceStorageExecutionDemands, walkSourceStorageExecution, type createSourceStorageExecutionReachability } from "./execution-reachability.js";

export function createSourceStorageScopedRejections(source: TargetSourceProgram, budget: SourceStorageBudget, transport: SourceStorageScopedTransport,
  scopes: SourceStorageScopes, reachability: ReturnType<typeof createSourceStorageExecutionReachability>,
  queries: {
    read(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
    pointerThrows(invocation: Node, scope: SourceStorageScope): readonly SourceStorageTerm[] | undefined;
    application(invocation: Node, target: SourceStorageSubject, scope: SourceStorageScope,
      projection: SourceStorageSubject["projection"], operation: SourceStorageOperation): SourceStorageTerm;
  }) {
  const relevant = new Map<Node, boolean>();
  const relevantRows = budget.createRows();
  let caughtSites: ReadonlyMap<Node, readonly Node[]> | undefined;
  const nativeThrows = new Set([...transport.pointerInvocations,
    ...[...transport.invocationEffects].filter(([, effect]) => effect.resumeReceiver === true).map(([invocation]) => invocation)]);
  const reachesNativeThrow = (invocation: Node): boolean | undefined => {
    const previous = relevant.get(invocation);
    if (previous !== undefined) return previous;
    let selected = false;
    for (const pointer of nativeThrows) {
      if (!budget.step()) return undefined;
      const reaches = pointer === invocation || reachability.invocation(invocation, pointer);
      if (reaches === undefined) return undefined;
      if (reaches) { selected = true; break; }
    }
    if (!relevantRows.add(1)) return undefined;
    relevant.set(invocation, selected);
    return selected;
  };
  const invocationThrows = (invocation: Node, scope: SourceStorageScope): readonly SourceStorageTerm[] | undefined => {
    if (transport.pointerInvocations.has(invocation)) return queries.pointerThrows(invocation, scope);
    if (transport.invocationEffects.get(invocation)?.resumeReceiver === true) {
      const receiver = transport.subjectFor(source.semantics.forNode(invocation).operations.call(invocation)?.sourceReceiver?.expression);
      if (receiver === undefined) return undefined;
      const terms: SourceStorageTerm[] = [queries.application(invocation, receiver, scope, [], { mode: "throw" })];
      return terms;
    }
    const target = transport.invocationTargets.get(invocation);
    return target === undefined ? undefined : [queries.application(invocation, target, scope, [], { mode: "throw" })];
  };
  const callableThrows = (subject: SourceStorageSubject, candidate: Node, invocation: Node, scope: SourceStorageScope,
    actualTypes?: readonly (readonly Type[] | undefined)[], phase: "call" | "active" = "call"): readonly SourceStorageTerm[] | undefined => {
    if (budget.failure() !== undefined) return undefined;
    if (phase === "call" && source.ast.hasModifierKind(candidate, "async"))
      return [Object.freeze({ kind: "empty", absence: undefined })];
    const terms: SourceStorageTerm[] = [];
    for (const region of transport.regions.callable(candidate, invocation, undefined, undefined, actualTypes, phase)) {
      if (!budget.step()) return undefined;
      const reason = transport.unresolvedThrows.get(region);
      if (reason !== undefined) terms.push(Object.freeze({ kind: "unresolved", subject, scope, reason, exposure: invocation }));
      for (const origin of transport.thrownOrigins.get(region) ?? []) {
        if (!budget.step()) return undefined;
        terms.push(sourceStorageReference(origin, scope));
      }
      for (const nested of transport.regions.invocationsIn(region) ?? []) {
        if (!budget.step()) return undefined;
        if (transport.regions.catchDestination(nested) !== undefined) continue;
        const relevant = reachesNativeThrow(nested);
        if (relevant === undefined) return undefined;
        if (!relevant) continue;
        const selected = invocationThrows(nested, scope);
        if (selected === undefined) return undefined;
        terms.push(...selected);
      }
    }
    return budget.failure() !== undefined ? undefined : terms.length === 0
      ? [Object.freeze({ kind: "empty", absence: undefined })] : terms;
  };
  const caught = (reference: SourceStorageReference): SourceStorageReduction | undefined => {
    if (reference.subject.kind !== "input" || reference.subject.projection.length !== 0) return undefined;
    if (caughtSites === undefined) {
      const index = new Map<Node, Node[]>();
      for (const invocation of transport.invocations) {
        if (!budget.step()) return undefined;
        const destination = transport.regions.catchDestination(invocation);
        if (destination === undefined) continue;
        const selected = reachesNativeThrow(invocation);
        if (selected === undefined) return undefined;
        if (!selected) continue;
        const sites = index.get(destination);
        if (!relevantRows.add(sites === undefined ? 2 : 1)) return undefined;
        if (sites === undefined) index.set(destination, [invocation]);
        else sites.push(invocation);
      }
      caughtSites = index;
    }
    const sites = caughtSites.get(reference.subject.node);
    if (sites === undefined) return undefined;
    const terms: SourceStorageTerm[] = [...transport.incomingFor(reference.subject)]
      .map(subject => sourceStorageReference(subject, reference.scope));
    for (const invocation of sites) {
      const roots = sourceStorageExecutionDemands(transport, scopes, budget, invocation, reference.scope, scopes.isDeferred(reference.scope));
      if (roots === undefined) return undefined;
      for (const value of walkSourceStorageExecution(budget, roots, queries.read)) {
        if (!budget.step()) return undefined;
        if (value.kind === "unresolved") terms.push(value);
        if (value.kind !== "leaf" || value.subject.node !== invocation) continue;
        const thrown = invocationThrows(invocation, value.scope);
        if (thrown === undefined) return undefined;
        terms.push(...thrown);
      }
    }
    return budget.failure() === undefined ? { kind: "replace", terms } : undefined;
  };
  return Object.freeze({ caught, callableThrows });
}
