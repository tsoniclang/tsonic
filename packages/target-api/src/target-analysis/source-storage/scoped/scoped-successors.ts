import { Node_Expression, Node_Initializer } from "../../../source-navigation/index.js";
import type { Node, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageProjection } from "../model/subjects.js";
import { sourceStorageFormalOwner, sourceStorageHasOriginalValue, sourceStorageIsDataMember, sourceStorageIsMemberProjection } from "../model/subjects.js";
import { sourceStorageObjectRestOwner } from "../model/subjects.js";
import type { SourceStorageStore } from "../graph/stored-values.js";
import { createSourceStorageExecutionReachability, createSourceStorageInputExecutions, walkSourceStorageExecution,
  sourceStorageExecutionDemands } from "./execution-reachability.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import type { SourceStorageActivation, SourceStorageReduction, SourceStorageScope, SourceStorageTerm, SourceStorageReference, SourceStorageInputFrontier, SourceStorageOperation, SourceStorageVariable } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageInitializedValue, sourceStorageInputBinding, sourceStorageStoredValue } from "./scoped-transport.js";
import type { createSourceStorageEquations } from "./scoped-equations.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { sourceIndexedStorageProjection, sourceStorageAccessDeclarations, sourceStorageSubjectType, sourceStorageDynamicMemberKey } from "../model/components.js";
import { sourceStorageProjectComponents } from "../graph/component-projections.js";
import { sourceStorageClassLineages, sourceStorageInstanceCaptures, sourceStorageAllocations, sourceStorageInstanceInitializers, sourceStorageSuperConstructor } from "../model/construction.js";
import type { SourceStorageScopedSubject } from "../graph/scoped-model.js";
import { sourceStorageSymbolicMemberAlias } from "./member-selection.js";
import { createSourceStorageProgramEntries } from "./program-entries.js";
import { createSourceStorageMemberSuccessors, type SourceStorageChildContext } from "./scoped-member-successors.js";
import { createSourceStoragePointerValues } from "./pointer-values.js";
import { createSourceStorageScopedRejections } from "./rejections.js";

export function createSourceStorageScopedSuccessors(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes,
  equations: ReturnType<typeof createSourceStorageEquations>,
  birth: (subject: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageActivation | undefined,
  closed: (term: SourceStorageTerm) => boolean | undefined,
  readRelation: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined,
  outside: (subject: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageReference | undefined = () => undefined) {
  const { ast, navigation, semantics } = source;
  const empty: Extract<SourceStorageTerm, { readonly kind: "empty" }> = Object.freeze({ kind: "empty", absence: undefined });
  const absent: Extract<SourceStorageReduction, { readonly kind: "replace" }> = Object.freeze({
    kind: "replace", terms: Object.freeze([empty]),
  });
  const passiveMember = (declaration: Node): boolean => (sourceStorageIsDataMember(declaration, ast) ||
    ast.is.IsMethodDeclaration(declaration) || ast.is.IsMethodSignatureDeclaration(declaration)) &&
    transport.memberAccessorsFor(declaration)?.size === 0;
  const reachability = createSourceStorageExecutionReachability(source, budget, transport);
  const { conditionalExecutions, nativeInputExecutions } = createSourceStorageInputExecutions(source, budget, transport, scopes, reachability, readRelation);
  const programEntries = createSourceStorageProgramEntries(source, transport, scopes, reachability, budget.step);
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
  const { member, symbolicProjection } = createSourceStorageMemberSuccessors({ source, budget, transport, scopes, reachability,
    birth, readRelation, readEffects, leaf, outside, creatorScope, passiveMember, regionsFor, application, classLineages,
    pointerWrites: (destination, store, projection, invocation, scope) =>
      pointerValues.writes(destination, store, projection, invocation, scope),
    materializeChild: (child, select, independentCallee) => materializeChild(child, select, independentCallee),
    replaceChild: (child, replace, childContext) => replaceChild(child, replace, childContext) });
  const materializeChild = (child: SourceStorageTerm,
    select: (child: SourceStorageReference | SourceStorageInputFrontier) => readonly SourceStorageTerm[] | undefined,
    independentCallee?: Node): Extract<SourceStorageReduction, { readonly kind: "project" }> => ({ kind: "project", inputs: [child], select: value => {
      if (value.kind === "empty") return [value];
      if (independentCallee !== undefined) {
        const selected = navigation.callableImplementation(value.subject.node);
        if (value.kind === "input-frontier" || selected.kind !== "resolved" || selected.implementation.declaration !== independentCallee) {
          return [Object.freeze({ kind: "unresolved", subject: value.subject, scope: value.scope,
            reason: "Source storage shared dispatch requires its exact context-independent implementation." })];
        }
      }
      return select(value);
    } });
  const pointerValues = createSourceStoragePointerValues(source, budget, transport, {
    readEffects, read: readRelation, deferred: scopes.isDeferred, isSymbolic: scopes.isSymbolic, creatorScope,
  });
  const rejections = createSourceStorageScopedRejections(source, budget, transport, scopes, reachability, {
    application, read: readRelation,
    pointerThrows: (invocation, scope) => pointerValues.execution(invocation, scope, invocation, scopes.isDeferred(scope), "throw"),
  });
  const replaceChild = (child: SourceStorageTerm,
    replace: (child: SourceStorageTerm) => SourceStorageTerm, context: SourceStorageChildContext = {}): SourceStorageReduction | undefined => {
    if (child.kind === "unresolved" || child.kind === "empty") return { kind: "replace", terms: [child] };
    if (child.kind === "input-frontier") return { kind: "replace", terms: [replace(child)] };
    if (child.kind === "reference" || child.kind === "application" || child.kind === "member" || child.kind === "guarded") {
      const independent = closed(child);
      if (independent === undefined) return undefined;
      if (independent || context.independentCallee !== undefined)
        return materializeChild(child, value => [replace(value)], independent ? undefined : context.independentCallee);
    }
    const selected = reduce(child, context.correlated ?? true);
    if (selected?.kind === "project") return { kind: "project", inputs: selected.inputs,
      select: value => selected.select(value)?.map(child => child.kind === "empty" ? child : replace(child)) };
    return selected?.kind === "replace" ? { kind: "replace", terms: selected.terms.map(child => child.kind === "empty" ? child : replace(child)), dependencies: selected.dependencies,
      witnesses: [...(selected.witnesses ?? []).map(witness => context.contributes !== false ? witness
        : { ...witness, contributes: false, observesValue: false }),
        ...child.kind === "reference" || child.kind === "leaf"
        ? [{ subject: child.subject, bindings: child.scope, contributes: context.contributes !== false,
          observesValue: context.contributes !== false }] : []] } : selected;
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
  const guardedLeaf = (reference: Node, value: SourceStorageReference | SourceStorageInputFrontier): readonly SourceStorageTerm[] | undefined => {
    if (value.kind === "input-frontier") {
      const guards = transport.guardedValues.conjoin(value.guards, reference);
      return budget.failure() !== undefined ? undefined : guards === null ? [empty]
        : guards === value.guards ? [value] : [Object.freeze({ ...value, guards })];
    }
    const admitted = transport.guardedValues.admits(value.subject, reference);
    if (budget.failure() !== undefined) return undefined;
    if (admitted === false) return [empty];
    if (admitted === true) return [value];
    const guards = transport.guardedValues.conjoin(value.guards, reference);
    return budget.failure() !== undefined ? undefined : guards === null ? [empty]
      : guards === value.guards ? [value] : [Object.freeze({ ...value, guards })];
  };
  const reduce = (term: SourceStorageTerm, correlated = false): SourceStorageReduction | undefined => {
    if (!budget.step()) return undefined;
    if (term.kind === "leaf" || term.kind === "input-frontier" || term.kind === "unresolved" || term.kind === "effect" || term.kind === "empty") return undefined;
    if (term.kind === "input-projection") return symbolicProjection(term.subject, term.scope, term.value);
    if (term.kind === "guarded") {
      if (term.value.kind !== "leaf" && term.value.kind !== "input-frontier") {
        const replace = (value: SourceStorageTerm): SourceStorageTerm => value === term.value ? term : Object.freeze({ ...term, value });
        return correlated ? replaceChild(term.value, replace, { contributes: false, correlated })
          : { ...materializeChild(term.value, value => guardedLeaf(term.reference, value)), valueFilter: term.reference };
      }
      const terms = guardedLeaf(term.reference, term.value);
      return terms === undefined ? undefined : { kind: "replace", terms };
    }
    if (term.kind === "execution-root") {
      const terms = programEntries(term);
      return terms === undefined ? undefined : { kind: "replace", terms };
    }
    if (term.kind === "region") {
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
    }
    if (term.kind === "store") {
      if ((term.destination.kind === "leaf" || term.destination.kind === "input-frontier") &&
        (term.receiver.kind === "leaf" || term.receiver.kind === "input-frontier")) {
        const frontier = term.destination.kind === "input-frontier" ? term.destination
          : term.receiver.kind === "input-frontier" ? Object.freeze({ ...term.receiver, subject: term.destination.subject,
            scope: term.destination.scope, preservesInput: false }) : undefined;
        if (frontier !== undefined) {
          const sameLocation = term.destination.subject === term.receiver.subject && term.destination.scope === term.receiver.scope;
          const sameInput = term.destination.kind === "input-frontier" && term.receiver.kind === "input-frontier" &&
            term.destination.input.subject === term.receiver.input.subject && term.destination.input.scope === term.receiver.input.scope;
          return term.destination.kind === "leaf" && !sameLocation && !sameInput ? absent : { kind: "replace", terms: sameLocation || sameInput ? [frontier, term.value] : [frontier] };
        }
      }
      if (term.destination.kind !== "leaf") return replaceChild(term.destination, destination =>
        destination === term.destination ? term : Object.freeze({ ...term, destination }), { contributes: false });
      if (term.receiver.kind !== "leaf") return replaceChild(term.receiver, receiver =>
        receiver === term.receiver ? term : Object.freeze({ ...term, receiver }));
      if (term.receiver.subject !== term.destination.subject) return sourceStorageSymbolicMemberAlias(transport, symbolicInput,
        term.receiver, term.destination) ? { kind: "replace", terms: [term.value] } : absent;
      const receiver = birth(term.receiver.subject, term.receiver.scope);
      const destination = birth(term.destination.subject, term.destination.scope);
      if (receiver === undefined || destination === undefined) return undefined;
      return budget.withRows((rows): SourceStorageReduction | undefined => {
        const pending: (readonly [SourceStorageActivation, SourceStorageActivation])[] = [[receiver, destination]];
        const visited = new Map<SourceStorageActivation, Set<SourceStorageActivation>>();
        let expansion: SourceStorageVariable | undefined;
        while (pending.length !== 0) {
          if (!budget.step()) return undefined;
          const [receiver, destination] = pending.pop()!;
          if (receiver.key === destination.key || visited.get(receiver)?.has(destination)) continue;
          if (!rows.add(2)) return undefined;
          const targets = visited.get(receiver) ?? new Set<SourceStorageActivation>();
          targets.add(destination);
          visited.set(receiver, targets);
          if (receiver.variable !== undefined || destination.variable !== undefined) {
            for (const variable of [receiver.variable, destination.variable]) {
              if (variable !== undefined && (expansion === undefined ||
                expansion.capture !== undefined && variable.capture === undefined)) expansion = variable;
            }
            continue;
          }
          if (receiver.invocation !== destination.invocation || receiver.owner !== destination.owner ||
            receiver.nativeEntry !== destination.nativeEntry) return absent;
          if (receiver.invocation !== undefined && destination.invocation !== undefined)
            pending.push([receiver.parent, destination.parent]);
          if (receiver.creation.length !== destination.creation.length) return absent;
          for (const [index, creation] of receiver.creation.entries()) {
            if (!budget.step() || !rows.add(1)) return undefined;
            pending.push([creation, destination.creation[index]!]);
          }
        }
        return expansion === undefined ? { kind: "replace", terms: [term.value] } : { kind: "expand", variable: expansion };
      });
    }
    if (term.kind === "transition") {
      if (term.condition.kind === "input-frontier") return { kind: "replace", terms: [term.condition] };
      if (term.condition.kind !== "leaf") return replaceChild(term.condition, condition =>
        condition === term.condition ? term : Object.freeze({ ...term, condition }), { contributes: false });
      const node = term.condition.subject.node;
      if (ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node)) {
        const owner = ast.is.IsConstructorDeclaration(term.capture.owner) ? ast.parent(term.capture.owner) : term.capture.owner;
        if (owner === undefined) return undefined;
        const captures = instanceCaptures(term.capture.owner, term.condition);
        if (captures === undefined) return undefined;
        const terms: SourceStorageTerm[] = [];
        for (const captured of captures) {
          const value = scopes.applyTerm(term.value, new Map([[term.capture, captured.bindings]]));
          if (value === undefined) return undefined;
          terms.push(value);
        }
        return { kind: "replace", terms };
      } else {
        const selected = navigation.callableImplementation(node);
        if (selected.kind !== "resolved") return { kind: "replace", terms: [] };
        if (selected.implementation.declaration !== term.capture.owner) return absent;
      }
      const value = scopes.applyTerm(term.value, new Map([[term.capture, term.condition.scope]]));
      return value === undefined ? undefined : { kind: "replace", terms: [value] };
    }
    if (term.kind === "pointer") return pointerValues.operation(term);
    if (term.kind === "member") return member(term, correlated);
    if (term.kind === "application") {
      const resumes = term.callback === undefined && transport.invocationEffects.get(term.invocation)?.resumeReceiver === true;
      const dependencies = resumes || term.activation.kind !== "invoke" ? [] : dispatchDependencies(term.invocation, term.scope);
      if (term.callee.kind !== "leaf" && term.callee.kind !== "input-frontier") {
        const selected = replaceChild(term.callee, callee => callee === term.callee ? term : Object.freeze({ ...term, callee }), {
          contributes: false,
          independentCallee: resumes ? undefined : independentCalleeFor(term.invocation),
        });
        return selected?.kind !== "replace" ? selected : { ...selected, dependencies: [...selected.dependencies ?? [], ...dependencies] };
      }
      const node = term.callee.subject.node;
      if (term.activation.kind === "provided") {
        const selected = navigation.callableImplementation(node);
        if (selected.kind !== "resolved" || ast.body(selected.implementation.declaration) === undefined)
          return { kind: "replace", terms: [Object.freeze({ kind: "unresolved", subject: term.callee.subject,
            scope: term.callee.scope, reason: "A native pointer accessor requires its original checked source implementation." })] };
        return scopes.enterApplication(term, selected.implementation.declaration, term.callee);
      }
      if (resumes) {
        if (term.mode === "value") {
          const result = transport.subject(term.invocation, "value", term.projection);
          return result === undefined ? undefined : { kind: "replace", terms: [leaf(result, term.scope)] };
        }
        const terms: SourceStorageTerm[] = [];
        let supplied = false;
        if (term.callee.subject.kind === "value" && term.callee.subject.projection.length === 0 && ast.is.IsCallExpression(node)) {
          const implementations = transport.pointerInvocations.has(node) ? transport.pointerAccessors(node) : transport.invocationImplementations(node);
          if (implementations === undefined) return undefined;
          for (const candidate of implementations) {
            if (!budget.step()) return undefined;
            if (semantics.forNode(candidate).operations.generator(candidate) === undefined) continue;
            const activation = scopes.boundActivation(term.callee.scope, candidate);
            const body = ast.body(candidate);
            if (activation?.invocation !== node || body === undefined) continue;
            supplied = true;
            if (term.mode === "throw") {
              const thrown = rejections.callableThrows(term.callee.subject, candidate, node, activation.scope, undefined, "active");
              if (thrown === undefined) return undefined;
              terms.push(...thrown);
            } else terms.push(Object.freeze({ kind: "region", region: body, scope: activation.scope,
              demand: term.demand, deferred: term.deferred }));
          }
        }
        if (!supplied) terms.push(Object.freeze({ kind: "unresolved", subject: term.callee.subject,
          scope: term.callee.scope, exposure: term.invocation,
          reason: "A generator may-resume requires its original checked creation call and activation." }));
        return { kind: "replace", terms };
      }
      if (term.callback !== undefined) {
        const type = sourceStorageSubjectType(source, term.callee.subject);
        if (type !== undefined && semantics.forNode(term.invocation).types.isNullish(type)) return absent;
        const selected = navigation.callableImplementation(node);
        const demand = term.mode === "execution" ? transport.subjectFor(term.demand) : undefined;
        if (term.mode !== "execution" || demand === undefined) return undefined;
        if (selected.kind !== "resolved" || ast.body(selected.implementation.declaration) === undefined) {
          const possible = nativeInputExecutions(term.invocation, term.scope, term.demand, term.deferred,
            { entry: term.callback, subject: term.callee.subject, bindings: term.callee.scope });
          if (possible === undefined) return undefined;
          return { kind: "replace", terms: possible, dependencies };
        }
        const candidate = selected.implementation.declaration;
        const scope = equations.scopeFor(candidate, term.invocation, term.scope, term.callee.scope, term);
        if (scope === undefined) return undefined;
        const regions = regionsFor(candidate, term.invocation, scope, term.demand, undefined, term.deferred);
        if (regions === undefined) return undefined;
        const reason = "The relevant native callback has no completed checked execution contract.";
        const terms = term.callback.timing === "unknown" ? conditionalExecutions(regions, term.demand, term.invocation,
          { value: { reason, executionOnly: true }, effect: undefined }, true) : regions;
        if (terms === undefined) return undefined;
        return { kind: "replace", terms, dependencies };
      }
      const construction = ast.is.IsNewExpression(term.invocation) || ast.kindName(Node_Expression(ast, term.invocation)) === "KindSuperKeyword";
      if (construction && (ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node))) {
        const lineages = classLineages(term.callee);
        if (lineages === undefined || lineages.some(lineage => !lineage.complete)) return undefined;
        const terms: SourceStorageTerm[] = [];
        for (const lineage of lineages) {
          const captured = lineage.classes[lineage.classes.length - 1];
          if (captured === undefined) return undefined;
          const owner = captured.subject.node;
          const candidate = lineage.implementation ?? owner;
          const scope = equations.scopeFor(candidate, term.invocation, term.scope, captured.bindings,
            Object.freeze({ ...term, callee: leaf(captured.subject, captured.bindings) }));
          if (scope === undefined) return undefined;
          if (term.mode === "execution") {
            const regions = regionsFor(candidate, term.invocation, scope, term.demand, { caller: term.scope, classes: lineage.classes }, term.deferred);
            if (regions === undefined) return undefined;
            terms.push(...regions);
          } else if (term.mode === "throw") {
            const thrown = rejections.callableThrows(captured.subject, candidate, term.invocation, scope);
            if (thrown === undefined) return undefined;
            terms.push(...thrown);
          } else {
            const result = transport.subject(candidate, "return", term.projection);
            if (result !== undefined && transport.incomingFor(result).size !== 0) terms.push(sourceStorageReference(result, scope));
          }
        }
        return { kind: "replace", terms, dependencies };
      }
      const selected = navigation.callableImplementation(node);
      const missingBody = selected.kind !== "resolved" || ast.body(selected.implementation.declaration) === undefined;
      const symbolic = missingBody && scopes.isSymbolic(term.callee);
      if (symbolic) {
        const owner = sourceStorageFormalOwner(term.callee.subject, source);
        const native = owner === undefined ? undefined : scopes.boundActivation(term.callee.scope, owner)?.nativeEntry;
        if (term.mode === "execution" && native !== undefined) {
          const possible = nativeInputExecutions(term.invocation, term.scope, term.demand, term.deferred);
          return possible === undefined ? undefined : { kind: "replace", terms: possible, dependencies };
        }
      }
      const contract = transport.invocationDeclarations.get(term.invocation);
      const nativeAllocation = transport.invocationEffects.get(term.invocation)?.resultAllocation === term.invocation;
      if (missingBody && transport.isOpaque(term.invocation) && contract === undefined) {
        const result = transport.subject(term.invocation, "value", term.projection);
        return result === undefined ? undefined : { kind: "replace", terms: [Object.freeze({
          kind: "unresolved", subject: result, scope: term.scope, exposure: term.invocation,
          reason: "An invocation has no exact checked selected signature transport.",
        })], dependencies };
      }
      if (missingBody && (transport.isOpaque(term.invocation) || nativeAllocation) &&
        (contract !== undefined && ast.body(contract) === undefined || transport.declarationIsAmbient(node) === true &&
          semantics.forNode(node).declarations.declarationSignature(node) !== undefined)) {
        const result = transport.subject(term.invocation, "value", term.projection);
        return result === undefined ? undefined : { kind: "replace", terms: term.mode === "value"
          ? [leaf(result, term.scope)] : term.mode === "execution" ? []
            : [Object.freeze({ kind: "unresolved", subject: result, scope: term.scope, exposure: term.invocation,
              reason: "An opaque invocation has no completed original thrown-value transport." })], dependencies };
      }
      if (symbolic) {
        const result = transport.subject(term.invocation, "value", term.projection);
        if (result === undefined) return undefined;
        return { kind: "replace", terms: [term.mode === "value" ? leaf(result, term.scope)
          : Object.freeze({ kind: "unresolved", subject: result, scope: term.scope,
            reason: "A symbolic callable invocation has no selected implementation execution." })], dependencies };
      }
      if (selected.kind !== "resolved" || ast.body(selected.implementation.declaration) === undefined) {
        budget.reject("Source storage invocation requires its exact checked original implementation."); return undefined;
      }
      const candidate = selected.implementation.declaration;
      const generator = semantics.forNode(candidate).operations.generator(candidate);
      const asynchronous = ast.hasModifierKind(candidate, "async");
      const scope = asynchronous && term.activation.kind !== "entered" &&
        (term.mode === "throw" || term.mode === "value" && generator === undefined)
        ? term.scope : equations.scopeFor(candidate, term.invocation, term.scope, term.callee.scope, term);
      if (scope === undefined) return undefined;
      if (term.mode === "throw") {
        const terms = rejections.callableThrows(term.callee.subject, candidate, term.invocation, scope,
          term.activation.kind === "entered" ? term.activation.actualTypes : undefined);
        return terms === undefined ? undefined : { kind: "replace", terms };
      }
      if (term.mode === "execution") {
        const regions = regionsFor(candidate, term.invocation, scope, term.demand, undefined, term.deferred,
          term.activation.kind === "entered" ? term.activation.actualTypes : undefined);
        return regions === undefined ? undefined : { kind: "replace", terms: regions };
      }
      if (generator !== undefined) {
        const result = transport.subject(term.invocation, "value", term.projection);
        return result === undefined ? undefined : { kind: "replace", terms: [leaf(result, scope)], dependencies };
      }
      if (asynchronous) {
        const result = transport.subject(term.invocation, "value", term.projection);
        return result === undefined ? undefined : { kind: "replace", terms: [leaf(result, scope)], dependencies };
      }
      const result = transport.subject(candidate, "return", term.projection);
      return result === undefined ? undefined : { kind: "replace", terms: [sourceStorageReference(result, scope)], dependencies };
    }
    const initializer = term.subject.kind === "input" ? Node_Initializer(ast, term.subject.node) : undefined;
    const bound = term.subject.kind === "input" || term.subject.kind === "receiver"
      ? sourceStorageInputBinding(source, budget, transport, scopes, term, initializer) : scopes.lookup(term.subject, term.scope);
    if (bound !== undefined) return bound;
    const caught = rejections.caught(term);
    if (caught !== undefined || budget.failure() !== undefined) return caught;
    const inputOwner = term.subject.kind === "input" && term.scope === scopes.empty
      ? sourceStorageFormalOwner(term.subject, source) : undefined;
    if (inputOwner !== undefined && ast.body(inputOwner) !== undefined) {
      const root = transport.subjectFor(term.subject.node);
      if (root === undefined) return undefined;
      const terms: SourceStorageTerm[] = [];
      const entry: SourceStorageTerm = Object.freeze({ kind: "execution-root", demand: term.subject.node, deferred: true });
      for (const value of walkSourceStorageExecution(budget, [entry], readRelation)) {
        if (!budget.step()) return undefined;
        if (value.kind === "unresolved") {
          if (value.executionOnly !== true || value.subject !== root || scopes.owningScope(value.scope, inputOwner) === undefined)
            terms.push(value);
        }
        else if (value.kind === "leaf" && value.subject === root && scopes.owningScope(value.scope, inputOwner) !== undefined)
          terms.push(sourceStorageReference(term.subject, value.scope));
      }
      return budget.failure() === undefined ? { kind: "replace", terms } : undefined;
    }
    if (term.scope.kind === "frame" && term.scope.boundary === "declaration" &&
      sourceStorageFormalOwner(term.subject, source) === term.scope.owner) return symbolicProjection(term.subject, term.scope);
    const node = term.subject.node;
    if (term.subject.kind === "value" && ast.is.IsElementAccessExpression(node) &&
      ast.as.AsElementAccessExpression(node)?.QuestionDotToken !== undefined) {
      const context = semantics.forNode(node);
      const selected = context.operations.elementAccess(node);
      const component = selected === undefined ? undefined
        : sourceIndexedStorageProjection(selected.receiver.type, selected.argument.expression, context, ast);
      if (component !== undefined) {
        const receiver = transport.subjectFor(selected?.receiver.expression);
        const projection = receiver === undefined ? undefined
          : transport.subject(receiver.node, receiver.kind, [component, ...term.subject.projection]);
        if (receiver === undefined || projection === undefined) return undefined;
        return materializeChild(sourceStorageReference(receiver, term.scope), value =>
          budget.withRows(rows => scopes.project(value, projection, rows.add, receiver, term.scope)));
      }
    }
    const pointed = pointerValues.reduce(term);
    if (pointed !== undefined) return pointed;
    const bindingPattern = ast.is.IsBindingElement(node) ? ast.parent(node) : undefined;
    if (bindingPattern !== undefined && ast.is.IsObjectBindingPattern(bindingPattern) &&
      sourceStorageObjectRestOwner(node, ast) === undefined && term.subject.projection.length === 0) {
      const values: SourceStorageTerm[] = [];
      for (const input of transport.incomingFor(term.subject)) {
        if (!budget.step()) return undefined;
        // The binding's own initialization write joins the component and its default; both are selected below instead.
        if (input.kind === "value" && input.projection.length === 0 && input.node === ast.name(node)) continue;
        const component = input.projection[input.projection.length - 1];
        const receiver = component === undefined || !sourceStorageIsMemberProjection(component) ? undefined
          : transport.subject(input.node, input.kind, input.projection.slice(0, -1));
        if (receiver === undefined || component === undefined || !sourceStorageIsMemberProjection(component)) return undefined;
        values.push(Object.freeze({ kind: "member", selection: Object.freeze({ kind: "projection", subject: receiver,
          declaration: component.declaration, evaluation: node, before: undefined }), receiver: sourceStorageReference(receiver, term.scope),
          scope: term.scope, projection: [], mode: "value" }));
      }
      if (values.length === 0) return { kind: "replace", terms: [Object.freeze({ kind: "unresolved", subject: term.subject, scope: term.scope,
        reason: "A binding default requires its exact original checked storage input before initialization." })] };
      const bindingInitializer = Node_Initializer(ast, node);
      if (bindingInitializer === undefined) return { kind: "replace", terms: values };
      const fallback = transport.subjectFor(bindingInitializer);
      if (fallback === undefined) return undefined;
      return { kind: "project", inputs: values, select: value => sourceStorageInitializedValue(source, budget, scopes, term,
        sourceStorageReference(fallback, term.scope), value) };
    }
    const stores = term.subject.kind === "value" || term.subject.kind === "member" ? transport.storedValuesFor(term.subject) : undefined;
    const storedBinding = stores !== undefined && term.subject.kind === "value" &&
      !term.subject.projection.some(sourceStorageIsMemberProjection) &&
      (ast.is.IsVariableDeclaration(node) || ast.is.IsBindingElement(node));
    if (!storedBinding && term.subject.kind === "value" && term.subject.projection.length !== 0 &&
      !term.subject.projection.some(sourceStorageIsMemberProjection) &&
      (ast.is.IsVariableDeclaration(node) || ast.is.IsIdentifier(node) || ast.is.IsBindingElement(node))) {
      const root = transport.subject(node, term.subject.kind);
      const declared = root === undefined ? undefined : sourceStorageSubjectType(source, root);
      if (root !== undefined && declared !== undefined && semantics.forNode(node).types.couldContainTypeVariables(declared)) {
        const inputs = transport.incomingFor(term.subject);
        if (inputs.size !== 0) {
          const terms: SourceStorageTerm[] = [];
          for (const input of inputs) {
            if (!budget.step()) return undefined;
            terms.push(sourceStorageReference(input, term.scope));
          }
          return { kind: "replace", terms,
            dependencies: [sourceStorageReference(root, term.scope)],
            witnesses: [{ subject: root, bindings: term.scope, contributes: false, observesValue: true }] };
        }
      }
      return root === undefined ? undefined : materializeChild(sourceStorageReference(root, term.scope), value => {
        if (value.kind === "input-frontier") return [Object.freeze({ kind: "input-projection", value,
          subject: term.subject, scope: term.scope })];
        const from = sourceStorageSubjectType(source, value.subject);
        const to = sourceStorageSubjectType(source, root);
        if (from === undefined || to === undefined) return undefined;
        const selected: SourceStorageTerm[] = [];
        sourceStorageProjectComponents(value.subject.projection, from, to, term.subject.projection,
          semantics.forNode(value.subject.node), ast, budget, projection => {
            const projected = transport.subject(value.subject.node, value.subject.kind, projection);
            if (projected !== undefined) selected.push(sourceStorageReference(projected, value.scope));
          });
        return budget.failure() === undefined ? selected : undefined;
      });
    }
    const memberIndex = term.subject.projection.findIndex(sourceStorageIsMemberProjection);
    const component = term.subject.projection[memberIndex];
    if (!storedBinding && component !== undefined && sourceStorageIsMemberProjection(component)) {
      const receiver = transport.subject(node, term.subject.kind, term.subject.projection.slice(0, memberIndex));
      if (receiver === undefined) return undefined;
      return { kind: "replace", terms: [Object.freeze({ kind: "member",
        selection: Object.freeze({ kind: "projection", subject: receiver, declaration: component.declaration, evaluation: undefined, before: undefined }), scope: term.scope,
        receiver: sourceStorageReference(receiver, term.scope), projection: term.subject.projection.slice(memberIndex + 1), mode: "value" })] };
    }
    if (term.subject.kind === "value" && (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node))) {
      const selected = ast.is.IsPropertyAccessExpression(node) ? semantics.forNode(node).operations.propertyAccess(node) : semantics.forNode(node).operations.elementAccess(node);
      const declarations = sourceStorageAccessDeclarations(source, node, "read");
      if (selected !== undefined && (declarations !== undefined && declarations.length !== 0 ||
        sourceStorageDynamicMemberKey(source, node) !== undefined)) {
        const receiver = transport.subjectFor(selected.receiver.expression);
        if (receiver === undefined) return undefined;
        return { kind: "replace", terms: [Object.freeze({ kind: "member", selection: Object.freeze({ kind: "access", node }), scope: term.scope,
          receiver: sourceStorageReference(receiver, term.scope), projection: term.subject.projection, mode: "value" })] };
      }
    }
    if (ast.is.IsCallExpression(node) && transport.invocations.has(node) && transport.isOpaque(node) &&
      !transport.invocationDeclarations.has(node) && transport.invocationEffects.get(node)?.resultAlias === undefined) {
      return { kind: "replace", terms: [Object.freeze({ kind: "unresolved", subject: term.subject,
        scope: term.scope, exposure: node, reason: "An invocation has no exact checked selected signature transport." })] };
    }
    if (ast.is.IsNewExpression(node) && transport.invocationEffects.get(node)?.resultAlias === undefined) {
      const candidate = transport.invocationDeclarations.get(node);
      if (candidate === undefined) return { kind: "replace", terms: [leaf(term.subject, term.scope)] };
      const creator = creatorScope(node, term.scope);
      const target = transport.invocationTargets.get(node);
      const returned = [...transport.invocationImplementations(node)].some(candidate => {
        const result = transport.subject(candidate, "return", term.subject.projection);
        return result !== undefined && transport.incomingFor(result).size !== 0;
      });
      return { kind: "replace", terms: [leaf(term.subject, creator), ...target === undefined || transport.isOpaque(node) || !returned
        ? [] : [application(node, target, term.scope, term.subject.projection, { mode: "value" })]], dependencies: dispatchDependencies(node, term.scope) };
    }
    if ((transport.invocations.has(node) || transport.accessorTargets.has(node)) &&
      transport.invocationEffects.get(node)?.resultAlias === undefined) {
      const target = transport.invocationTargets.get(node);
      if (target !== undefined) return { kind: "replace", terms: [application(node, target, term.scope, term.subject.projection, { mode: "value" })] };
    }
    const parents = transport.incomingFor(term.subject);
    let initial: Extract<SourceStorageTerm, { readonly kind: "empty" }> | undefined;
    if (parents.size === 0 && ast.is.IsArrayLiteralExpression(node) && term.subject.projection.length !== 0) {
      const elements = ast.elements(node);
      const component = term.subject.projection[0];
      if (component?.kind === "tuple-element" && term.subject.projection.length === 1 &&
        !elements.some(element => element !== undefined && ast.is.IsSpreadElement(element)) &&
        (elements[component.index] === undefined || ast.is.IsOmittedExpression(elements[component.index])))
        initial = Object.freeze({ kind: "empty", absence: sourceStorageReference(term.subject, term.scope) });
      else if (elements.length === 0) initial = empty;
    }
    if (term.subject.kind === "value" && term.subject.projection.length === 0 &&
      ast.is.IsVariableDeclaration(node) && ast.is.IsIdentifier(ast.name(node)) &&
      Node_Initializer(ast, node) === undefined && navigation.isProjectDeclaration(node) &&
      ast.getSourceFile(node)?.IsDeclarationFile !== true) {
      const declarations = ast.parent(node);
      const container = declarations === undefined ? undefined : ast.parent(declarations);
      if (declarations !== undefined && ast.is.IsVariableDeclarationList(declarations) &&
        (container === undefined || !ast.is.IsForInStatement(container) && !ast.is.IsForOfStatement(container))) {
        const ambient = transport.declarationIsAmbient(node);
        if (ambient === undefined) return undefined;
        if (!ambient) initial = Object.freeze({ kind: "empty",
          absence: sourceStorageReference(term.subject, creatorScope(node, term.scope)) });
      }
    }
    const ambient = ast.is.IsVariableDeclaration(node) && Node_Initializer(ast, node) === undefined
      ? transport.declarationIsAmbient(node) : false;
    if (ambient === undefined) return undefined;
    if (stores !== undefined) {
      const terms: SourceStorageTerm[] = initial === undefined ? [] : [initial];
      if (ambient) terms.push(leaf(term.subject, creatorScope(node, term.scope)));
      for (const input of parents) {
        if (!budget.step()) return undefined;
        if (input.kind === "input" && input.node === node || ast.is.IsArrayLiteralExpression(node) && term.subject.projection.length !== 0)
          terms.push(sourceStorageReference(input, term.scope));
      }
      for (const { store, value } of stores) {
        if (!budget.step()) return undefined;
        if (store.reason !== undefined) continue;
        if (store.destination === "pointer") {
          const written = pointerValues.writes(leaf(term.subject,
            creatorScope(term.subject.node, term.scope)), store, [], term.subject.node, term.scope);
          if (written === undefined) return undefined;
          terms.push(...written); continue;
        }
        if (value === undefined && sourceStorageStoredValue(ast, store, undefined, term.scope) === undefined) continue;
        if (store.kind === "initialization") {
          if (value === undefined) continue;
          const creator = creatorScope(store.storage.node, term.scope);
          terms.push(store.birth !== undefined && value === store.storage ? leaf(value, creator)
            : sourceStorageReference(value, creator));
          continue;
        }
        const region = transport.regions.enclosing(node);
        const owner = region === undefined ? undefined : sourceStorageRegionOwner(ast, region);
        const local = (store.destination === "binding" || store.destination === "element") && store.region === region
          ? owner === undefined || term.scope === scopes.empty ? scopes.empty : scopes.owningScope(term.scope, owner) : undefined;
        if (local !== undefined) {
          const written = sourceStorageStoredValue(ast, store, value, local);
          if (written === undefined) continue;
          if (store.destination === "element") {
            const container = transport.subject(term.subject.node, term.subject.kind,
              term.subject.projection.slice(0, store.storage.projection.length - 1));
            if (container === undefined || store.receiver === undefined) return undefined;
            terms.push(Object.freeze({ kind: "store", destination: sourceStorageReference(container, term.scope),
              receiver: sourceStorageReference(store.receiver, local), value: written }));
          } else terms.push(written);
          continue;
        }
        const effects = readEffects(store, { kind: "general" }, scopes.isDeferred(term.scope), term.scope);
        for (const effect of effects) {
          if (!budget.step()) return undefined;
          if (effect.kind === "unresolved") { terms.push(effect); continue; }
          if (effect.kind !== "effect" || effect.store !== store) continue;
          const written = sourceStorageStoredValue(ast, store, value, effect.scope);
          if (written === undefined) continue;
          if (store.destination === "member") {
            terms.push(written);
            continue;
          }
          if (store.destination === "element") {
            const container = transport.subject(term.subject.node, term.subject.kind,
              term.subject.projection.slice(0, store.storage.projection.length - 1));
            if (container === undefined || store.receiver === undefined) {
              budget.reject("Source storage element writes require their exact physical container."); return undefined;
            }
            terms.push(Object.freeze({ kind: "store", destination: sourceStorageReference(container, term.scope),
              receiver: sourceStorageReference(store.receiver, effect.scope), value: written }));
            continue;
          }
          const creator = owner === undefined ? scopes.empty : scopes.owningScope(effect.scope, owner);
          const original = creator === undefined ? undefined : birth(term.subject, creator);
          if (original !== undefined && original.key === birth(term.subject, term.scope)?.key)
            terms.push(written);
        }
      }
      return { kind: "replace", terms };
    }
    if (initial !== undefined) return { kind: "replace", terms: [initial] };
    let selectedBody: boolean | undefined;
    const terms = [...parents].filter(parent => {
      if (parent.kind !== "return") return true;
      if (selectedBody === undefined) {
        const receiver = term.subject.kind === "return" && ast.body(node) !== undefined
          ? transport.subject(node, "receiver") : undefined;
        selectedBody = receiver !== undefined && scopes.lookup(receiver, term.scope) !== undefined;
      }
      return !selectedBody;
    }).map(parent => sourceStorageReference(parent, term.scope));
    if (ambient || sourceStorageHasOriginalValue(term.subject, ast, parents.size !== 0))
      terms.unshift(leaf(term.subject, creatorScope(node, term.scope)));
    const qualified = term.subject.kind === "value" && ast.is.IsIdentifier(node) && parents.size !== 0 &&
      transport.guardedValues.appliesTo(node) === true;
    return { kind: "replace", terms: qualified ? terms.map(value => Object.freeze({ kind: "guarded" as const, reference: node, value })) : terms,
      dependencies: transport.invocations.has(node) || transport.accessorTargets.has(node)
      ? dispatchDependencies(node, term.scope) : undefined };
  };
  return Object.freeze({ reduce });
}
