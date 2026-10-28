import type { Node, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageProjection } from "../model/subjects.js";
import { sourceStorageIsDataMember } from "../model/subjects.js";
import type { SourceStorageStore } from "../graph/stored-values.js";
import type { SourceStorageScope, SourceStorageTerm, SourceStorageReference, SourceStorageInputFrontier,
  SourceStorageOperation, SourceStorageScopedSubject } from "../graph/scoped-model.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import { sourceStorageExecutionDemands, walkSourceStorageExecution,
  type createSourceStorageExecutionReachability } from "./execution-reachability.js";
import { Node_Expression } from "../../../source-navigation/index.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { sourceStorageClassLineages, sourceStorageInstanceCaptures, sourceStorageAllocations,
  sourceStorageInstanceInitializers, sourceStorageSuperConstructor } from "../model/construction.js";

export function createSourceStorageExecutionContext(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes,
  reachability: ReturnType<typeof createSourceStorageExecutionReachability>,
  readRelation: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined) {
  const { ast, semantics } = source;
  const passiveMember = (declaration: Node): boolean => (sourceStorageIsDataMember(declaration, ast) ||
    ast.is.IsMethodDeclaration(declaration) || ast.is.IsMethodSignatureDeclaration(declaration)) &&
    transport.memberAccessorsFor(declaration)?.size === 0;
  const readEffects = function* (store: SourceStorageStore, selection:
    | { readonly kind: "general"; readonly execution?: SourceStorageTerm }
    | { readonly kind: "own-construction"; readonly execution: SourceStorageTerm }, deferred = false, context?: SourceStorageScope) {
    const starts = sourceStorageExecutionDemands(transport, scopes, budget, store.region, context, deferred, selection.execution);
    if (starts === undefined) return;
    const read = (term: SourceStorageTerm): Iterable<SourceStorageTerm> | undefined => {
      if (selection.kind === "own-construction" && term.kind === "region" && term.region === store.region)
        return [Object.freeze({ kind: "effect", store, scope: term.scope })];
      const successors = readRelation(term);
      if (successors === undefined) return undefined;
      return (function* () {
        for (const successor of successors) {
          if (!budget.step()) return;
          if (successor.kind === "effect" && successor.store !== store) continue;
          if (selection.kind === "own-construction" && term.kind === "region" && successor.kind !== "unresolved" &&
            (successor.kind !== "application" || sourceStorageSuperConstructor(successor.invocation, source, budget.step) === undefined)) continue;
          yield successor;
        }
      })();
    };
    for (const result of walkSourceStorageExecution(budget, starts, read))
      if (result.kind === "unresolved" || result.kind === "effect" && result.store === store) yield result;
  };
  const creatorScope = (node: Node, scope: SourceStorageScope): SourceStorageScope => {
    if (scope === scopes.empty) return scope;
    const region = transport.regions.enclosing(node);
    const owner = region === undefined ? undefined : sourceStorageRegionOwner(ast, region);
    return owner === undefined ? scopes.empty : scopes.owningScope(scope, owner) ?? scope;
  };
  const leaf = (subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageReference => Object.freeze({ kind: "leaf", subject, scope });
  const symbolicInput = (subject: SourceStorageSubject, scope: SourceStorageScope): boolean => { const bound = scopes.lookup(subject, scope);
    return bound === undefined || bound.kind === "replace" && bound.terms.some(value =>
      (value.kind === "leaf" || value.kind === "input-frontier") && scopes.isSymbolic(value)); };
  const classQueries = {
    subjectFor: transport.subjectFor,
    nativeConstructorsFor: transport.nativeConstructorsFor,
    valuesFor(subject: SourceStorageSubject, bindings: SourceStorageScope): ReadonlySet<SourceStorageScopedSubject> | undefined {
      const terms = readRelation(sourceStorageReference(subject, bindings));
      if (terms === undefined) return undefined;
      const values = new Set<SourceStorageScopedSubject>();
      for (const term of terms) {
        if (!budget.step()) return undefined;
        if (term.kind === "unresolved") { budget.reject(term.reason); return undefined; }
        if (term.kind === "leaf") values.add(Object.freeze({ subject: term.subject, bindings: term.scope }));
      }
      return values;
    },
  };
  const classLineages = (value: SourceStorageReference | SourceStorageInputFrontier, mode?: "heritage") =>
    sourceStorageClassLineages(source, budget, new Set([{ subject: value.subject, bindings: value.scope }]), classQueries, mode);
  const instanceCaptures = (candidate: Node, value: SourceStorageReference) => sourceStorageInstanceCaptures(
    source, budget, candidate, new Set([{ subject: value.subject, bindings: value.scope }]), classQueries);
  const application = (invocation: Node, target: SourceStorageSubject, scope: SourceStorageScope,
    projection: readonly SourceStorageProjection[], operation: SourceStorageOperation): SourceStorageTerm => {
    const caller = creatorScope(invocation, scope);
    return Object.freeze({ kind: "application", invocation, activation: Object.freeze({ kind: "invoke" }),
      callee: sourceStorageReference(target, caller), scope: caller, projection, ...operation });
  };
  const dispatchDependencies = (invocation: Node, scope: SourceStorageScope): readonly SourceStorageTerm[] => {
    if (transport.invocationEffects.get(invocation)?.resultAlias !== undefined) return [];
    const call = semantics.forNode(invocation).operations.call(invocation);
    const property = ast.is.IsPropertyAccessExpression(invocation) ? semantics.forNode(invocation).operations.propertyAccess(invocation) : undefined;
    const nodes = [Node_Expression(ast, invocation), call?.sourceReceiver?.expression ??
      call?.sourceCalleeAccess?.receiver.expression ?? property?.receiver.expression];
    const selected: SourceStorageTerm[] = [];
    for (const node of nodes) {
      if (!budget.step()) break;
      const subject = transport.subjectFor(node);
      if (subject !== undefined && subject.node !== invocation) selected.push(sourceStorageReference(subject, scope));
    }
    return selected;
  };
  const regionsFor = (candidate: Node, invocation: Node, scope: SourceStorageScope, demand: Node,
    construction?: { readonly caller: SourceStorageScope; readonly classes: readonly SourceStorageScopedSubject[] }, deferred = false,
    actualTypes?: readonly (readonly Type[] | undefined)[]): readonly SourceStorageTerm[] | undefined => {
    const terms: SourceStorageTerm[] = [];
    const frame = scope.kind === "substitution" ? scope.scope : scope;
    const callback = frame.kind === "frame" ? frame.callback : undefined;
    for (const region of transport.regions.callable(candidate, transport.accessorTargets.has(invocation) ? undefined : invocation, undefined, callback, actualTypes)) {
      if (!budget.step()) return undefined;
      const reaches = reachability.region(region, demand);
      if (reaches === undefined) return undefined;
      if (reaches) terms.push(Object.freeze({ kind: "region", region, scope, demand, deferred }));
    }
    if (construction !== undefined) for (const captured of construction.classes) {
      if (!budget.step()) return undefined;
      const owner = captured.subject.node;
      for (const initializer of sourceStorageInstanceInitializers(owner, source, budget.step)) {
        const reaches = reachability.region(initializer, demand);
        if (reaches === undefined) return undefined;
        if (!reaches) continue;
        const allocations = sourceStorageAllocations(source, budget, invocation, construction.caller, (owner, bindings) => {
          const receiver = transport.subject(owner, "receiver");
          const selected = receiver === undefined ? undefined : classQueries.valuesFor(receiver, bindings);
          return selected === undefined ? { kind: "unresolved",
            reason: "Instance initialization requires its completed original allocation receiver." } : [...selected];
        });
        if (allocations.kind === "unresolved") return undefined;
        for (const allocation of allocations.allocations) {
          const context = scopes.frameFor(owner, allocation.call, allocation.callerBindings, captured.bindings);
          if (context === undefined) return undefined;
          terms.push(Object.freeze({ kind: "region", region: initializer, scope: context, demand, deferred }));
        }
      }
    }
    return Object.freeze(terms);
  };
  const independentCalleeFor = (invocation: Node): Node | undefined => {
    if (!budget.step()) return undefined;
    const candidates = transport.invocationImplementations(invocation);
    const candidate = candidates.size === 1 ? candidates.values().next().value : undefined;
    if (candidate === undefined || ast.body(candidate) === undefined ||
      ast.is.IsClassDeclaration(candidate) || ast.is.IsClassExpression(candidate)) return undefined;
    const region = transport.regions.enclosing(candidate);
    if (region === undefined || sourceStorageRegionOwner(ast, region) !== undefined) return undefined;
    const subject = transport.subject(candidate);
    return subject !== undefined && transport.contextualInputs(subject)?.size === 0 ? candidate : undefined;
  };
  return Object.freeze({ readEffects, creatorScope, leaf, symbolicInput, classLineages, instanceCaptures, application,
    dispatchDependencies, regionsFor, passiveMember, independentCalleeFor });
}
