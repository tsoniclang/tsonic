import { Node_Expression } from "../../source-navigation/index.js";
import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject, SourceStorageProjection } from "./subjects.js";
import { sourceStorageHasOriginalCallableValue, sourceStorageMemberSubject } from "./subjects.js";
import type { SourceStorageStore } from "./stored-values.js";
import { createSourceStorageExecutionReachability } from "./execution-reachability.js";
import { sourceStorageReference } from "./scoped-model.js";
import type { SourceStorageReduction, SourceStorageScope, SourceStorageTerm, SourceStorageReference, SourceStorageScopedSubject,
  SourceStorageOperation } from "./scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { createSourceStorageEquations } from "./scoped-equations.js";
import { sourceStorageRegionOwner } from "./lexical-regions.js";

export function createSourceStorageScopedSuccessors(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes,
  equations: ReturnType<typeof createSourceStorageEquations>,
  birthKey: (subject: SourceStorageSubject, scope: SourceStorageScope) => string | undefined,
  closed: (term: SourceStorageTerm) => boolean | undefined,
  readRelation: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined) {
  const { ast, navigation, semantics } = source;
  const reachability = createSourceStorageExecutionReachability(source, budget, transport);
  const readEffects = function* (store: SourceStorageStore) {
    const rows = budget.createRows();
    const frontier = budget.createRows();
    let maximumFrontier = 0;
    const pending: SourceStorageTerm[] = [];
    const visited = new Set<SourceStorageTerm>();
    const schedule = (term: SourceStorageTerm): boolean => {
      if (!budget.step()) return false;
      if (term.kind === "effect" && term.store !== store) return true;
      if (visited.has(term)) return true;
      if (!rows.add(1)) return false;
      if (pending.length === maximumFrontier) {
        if (!frontier.add(1)) return false;
        maximumFrontier += 1;
      }
      visited.add(term); pending.push(term);
      return true;
    };
    try {
      if (!schedule(Object.freeze({ kind: "execution-root", demand: store.region }))) return;
      while (pending.length !== 0) {
        if (!budget.step()) return;
        const term = pending.pop()!;
        if (term.kind === "effect") { yield term; continue; }
        const successors = readRelation(term);
        if (successors === undefined) {
          budget.reject("Source storage execution requires its active scoped relation."); return;
        }
        for (const successor of successors) if (!schedule(successor)) return;
      }
    } finally { pending.length = 0; visited.clear(); frontier.release(); rows.release(); }
  };
  const creatorScope = (node: Node, scope: SourceStorageScope): SourceStorageScope => {
    if (scope === scopes.empty) return scope;
    const region = transport.regions.enclosing(node);
    const owner = region === undefined ? undefined : sourceStorageRegionOwner(ast, region);
    return owner === undefined ? scopes.empty : scopes.owningScope(scope, owner) ?? scope;
  };
  const leaf = (subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageReference => Object.freeze({ kind: "leaf", subject, scope });
  const application = (invocation: Node, target: SourceStorageSubject, scope: SourceStorageScope,
    projection: readonly SourceStorageProjection[], operation: SourceStorageOperation): SourceStorageTerm =>
    Object.freeze({ kind: "application", invocation, callee: sourceStorageReference(target, scope), scope, projection, ...operation });
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
  const regionsFor = (candidate: Node, invocation: Node, scope: SourceStorageScope, demand: Node): readonly SourceStorageTerm[] | undefined => {
    const terms: SourceStorageTerm[] = [];
    for (const region of transport.regions.callable(candidate, transport.accessorTargets.has(invocation) ? undefined : invocation)) {
      if (!budget.step()) return undefined;
      const reaches = reachability.region(region, demand);
      if (reaches === undefined) return undefined;
      if (reaches) terms.push(Object.freeze({ kind: "region", region, scope, demand }));
    }
    if (ast.is.IsNewExpression(invocation)) for (const region of transport.regions.instance(invocation)) {
      if (!budget.step()) return undefined;
      const reaches = reachability.region(region.node, demand);
      if (reaches === undefined) return undefined;
      if (!reaches) continue;
      const caller = scope.kind === "frame" ? scope.caller ?? scope : scope;
      const captured = scope.kind === "frame" ? scope.parents[0] ?? scope : scope;
      const context = scopes.frameFor(region.owner, invocation, caller, captured);
      if (context === undefined) return undefined;
      terms.push(Object.freeze({ kind: "region", region: region.node, scope: context, demand }));
    }
    return Object.freeze(terms);
  };
  const receiverFor = (store: SourceStorageStore): SourceStorageSubject | undefined => {
    if (store.kind !== "initialization") return store.receiver;
    const parent = ast.parent(store.storage.node);
    if (ast.is.IsParameterDeclaration(store.storage.node) || ast.is.IsPropertyDeclaration(store.storage.node)) return transport.subject(parent, "receiver");
    return parent !== undefined && ast.is.IsObjectLiteralExpression(parent) ? transport.subject(parent) : undefined;
  };
  const initializationScope = (store: SourceStorageStore, receiver: SourceStorageSubject,
    allocation: SourceStorageReference): SourceStorageScope | undefined => {
    if (store.kind !== "initialization") return undefined;
    if (receiver === allocation.subject) return allocation.scope;
    const owner = sourceStorageRegionOwner(ast, store.region);
    if (owner === undefined) return undefined;
    const scope = scopes.owningScope(allocation.scope, owner);
    if (scope === undefined) return undefined;
    const bound = scopes.lookup(receiver, scope);
    const input = bound?.kind === "replace" && bound.terms.length === 1 ? bound.terms[0] : undefined;
    if (input === undefined || input.kind !== "reference" && input.kind !== "leaf" || input.subject !== allocation.subject) return undefined;
    const original = birthKey(input.subject, input.scope);
    return original !== undefined && original === birthKey(allocation.subject, allocation.scope) ? scope : undefined;
  };
  const member = (term: Extract<SourceStorageTerm, { readonly kind: "member" }>): SourceStorageReduction | undefined => {
    if (term.receiver.kind !== "leaf") return replaceChild(term.receiver, receiver => Object.freeze({ ...term, receiver }));
    const selected = ast.is.IsPropertyAccessExpression(term.access) ? semantics.forNode(term.access).operations.propertyAccess(term.access)
      : semantics.forNode(term.access).operations.elementAccess(term.access);
    const property = ast.is.IsPropertyAccessExpression(term.access) ? semantics.forNode(term.access).operations.propertyAccess(term.access) : undefined;
    const declaration = property?.selectedReadDeclaration ?? selected?.selectedDeclaration;
    if (selected === undefined || declaration === undefined) {
      budget.reject("Source storage member reads require their exact checked declaration and receiver."); return undefined;
    }
    const originals = new Set<Node>();
    for (const target of term.mode === "execution" ? transport.accessorTargets.get(term.access) ?? [] : [declaration]) {
      if (!budget.step()) return undefined;
      const unbound = (term.receiver.subject.kind === "input" || term.receiver.subject.kind === "receiver") &&
        scopes.lookup(term.receiver.subject, term.receiver.scope) === undefined;
      const members = unbound ? [target] : transport.memberFlow.declarationsFor(term.receiver.subject, target, selected.receiver.type);
      if (members === undefined) { budget.reject("Source storage members require exact checked correspondence."); return undefined; }
      for (const member of members) {
        if (!budget.step()) return undefined;
        if (ast.is.IsGetAccessorDeclaration(target) && ast.is.IsSetAccessorDeclaration(member) ||
          ast.is.IsSetAccessorDeclaration(target) && ast.is.IsGetAccessorDeclaration(member)) continue;
        originals.add(member);
      }
    }
    const terms: SourceStorageTerm[] = [];
    const witnesses: SourceStorageScopedSubject[] = [];
    for (const original of originals) {
      if (!budget.step()) return undefined;
      if (ast.is.IsGetAccessorDeclaration(original) || ast.is.IsSetAccessorDeclaration(original)) {
        const scope = scopes.frameFor(original, term.access, term.scope, term.receiver.scope);
        const result = transport.subject(original, "return", term.projection);
        if (scope === undefined || result === undefined) return undefined;
        if (term.mode === "execution") {
          const regions = regionsFor(original, term.access, scope, term.demand);
          if (regions === undefined) return undefined;
          terms.push(...regions);
        } else terms.push(sourceStorageReference(result, scope));
        continue;
      }
      const subject = sourceStorageMemberSubject(original, ast, transport.subject, term.projection);
      if (subject === undefined) return undefined;
      witnesses.push(Object.freeze({ subject, bindings: term.receiver.scope }));
      const stores = transport.storedValuesFor(subject);
      if ((term.receiver.subject.kind === "input" || term.receiver.subject.kind === "receiver") &&
        scopes.lookup(term.receiver.subject, term.receiver.scope) === undefined) {
        terms.push(sourceStorageReference(subject, term.receiver.scope)); continue;
      }
      if (stores === undefined) { terms.push(sourceStorageReference(subject, term.receiver.scope)); continue; }
      for (const store of stores) {
        if (!budget.step()) return undefined;
        if (store.reason !== undefined) continue;
        if (store.value === undefined) continue;
        const receiver = receiverFor(store);
        if (receiver === undefined) { budget.reject("Source storage physical members require exact initialized or mutated receivers."); return undefined; }
        const initialized = initializationScope(store, receiver, term.receiver);
        if (initialized !== undefined) {
          terms.push(sourceStorageReference(store.value, initialized));
          continue;
        }
        const effects = readEffects(store);
        for (const effect of effects) {
          if (!budget.step()) return undefined;
          if (effect.kind !== "effect" || effect.store !== store) continue;
          terms.push(Object.freeze({ kind: "store", destination: term.receiver,
            receiver: sourceStorageReference(receiver, effect.scope), value: sourceStorageReference(store.value, effect.scope) }));
        }
      }
    }
    return { kind: "replace", terms, witnesses };
  };
  const replaceChild = (child: SourceStorageTerm,
    replace: (child: SourceStorageTerm) => SourceStorageTerm): SourceStorageReduction | undefined => {
    if (child.kind === "reference" || child.kind === "application" || child.kind === "member") {
      const independent = closed(child);
      if (independent === undefined) return undefined;
      if (independent) {
        const values = readRelation(child);
        if (values === undefined) return undefined;
        const terms: SourceStorageTerm[] = [];
        for (const value of values) {
          if (!budget.step()) return undefined;
          if (value.kind === "leaf") terms.push(replace(value));
        }
        return { kind: "replace", terms, dependencies: [child] };
      }
    }
    const selected = reduce(child);
    return selected?.kind === "replace" ? { kind: "replace", terms: selected.terms.map(replace), dependencies: selected.dependencies,
      witnesses: [...selected.witnesses ?? [], ...child.kind === "reference" || child.kind === "leaf"
        ? [{ subject: child.subject, bindings: child.scope }] : []] } : selected;
  };
  const reduce = (term: SourceStorageTerm): SourceStorageReduction | undefined => {
    if (!budget.step()) return undefined;
    if (term.kind === "leaf" || term.kind === "effect" || term.kind === "empty") return undefined;
    if (term.kind === "execution-root") {
      const terms: SourceStorageTerm[] = [];
      for (const region of transport.sourceFiles) {
        if (region.IsDeclarationFile) continue;
        const reaches = reachability.region(region, term.demand);
        if (reaches === undefined) return undefined;
        if (reaches) terms.push(Object.freeze({ kind: "region", region, scope: scopes.empty, demand: term.demand }));
      }
      return { kind: "replace", terms };
    }
    if (term.kind === "region") {
      const terms: SourceStorageTerm[] = [];
      for (const store of transport.storesIn(term.region) ?? []) {
        if (!budget.step()) return undefined;
        if (term.region === term.demand) terms.push(Object.freeze({ kind: "effect", store, scope: term.scope }));
      }
      for (const invocation of transport.regions.invocationsIn(term.region) ?? []) {
        if (!budget.step()) return undefined;
        const reaches = reachability.invocation(invocation, term.demand);
        if (reaches === undefined) return undefined;
        if (!reaches) continue;
        const target = transport.invocationTargets.get(invocation);
        if (target !== undefined && !transport.isOpaque(invocation)) terms.push(application(invocation, target, term.scope, [],
          { mode: "execution", demand: term.demand }));
        else if (transport.accessorTargets.has(invocation)) {
          const operation = ast.is.IsPropertyAccessExpression(invocation) ? semantics.forNode(invocation).operations.propertyAccess(invocation)
            : semantics.forNode(invocation).operations.elementAccess(invocation);
          const receiver = transport.subjectFor(operation?.receiver.expression);
          if (receiver === undefined) return undefined;
          terms.push(Object.freeze({ kind: "member", access: invocation, receiver: sourceStorageReference(receiver, term.scope),
            scope: term.scope, projection: [], mode: "execution", demand: term.demand }));
        }
      }
      return { kind: "replace", terms };
    }
    if (term.kind === "store") {
      if (term.receiver.kind !== "leaf") return replaceChild(term.receiver, receiver => Object.freeze({ ...term, receiver }));
      const receiver = birthKey(term.receiver.subject, term.receiver.scope);
      const destination = birthKey(term.destination.subject, term.destination.scope);
      return receiver === undefined || destination === undefined ? undefined
        : { kind: "replace", terms: receiver === destination ? [term.value] : [] };
    }
    if (term.kind === "transition") {
      if (term.condition.kind !== "leaf") return replaceChild(term.condition, condition => Object.freeze({ ...term, condition }));
      const selected = navigation.callableImplementation(term.condition.subject.node);
      if (selected.kind !== "resolved" || selected.implementation.declaration !== term.capture.owner)
        return { kind: "replace", terms: [] };
      const value = scopes.applyTerm(term.value, new Map([[term.capture, term.condition.scope]]));
      return value === undefined ? undefined : { kind: "replace", terms: [value] };
    }
    if (term.kind === "member") return member(term);
    if (term.kind === "application") {
      const dependencies = dispatchDependencies(term.invocation, term.scope);
      if (term.callee.kind !== "leaf") {
        const selected = replaceChild(term.callee, callee => Object.freeze({ ...term, callee }));
        return selected?.kind !== "replace" ? selected : { ...selected, dependencies: [...selected.dependencies ?? [], ...dependencies] };
      }
      const node = term.callee.subject.node;
      const construction = ast.is.IsNewExpression(term.invocation) || ast.kindName(Node_Expression(ast, term.invocation)) === "KindSuperKeyword";
      if (construction && (ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node))) {
        const selected = transport.invocationImplementations(term.invocation);
        const terms: SourceStorageTerm[] = [];
        for (const candidate of selected.size === 0 ? [node] : selected) {
          const scope = scopes.frameFor(candidate, term.invocation, term.scope, term.callee.scope);
          if (scope === undefined) return undefined;
          if (term.mode === "execution") {
            const regions = regionsFor(candidate, term.invocation, scope, term.demand);
            if (regions === undefined) return undefined;
            terms.push(...regions);
          } else {
            const result = transport.subject(candidate, "return", term.projection);
            if (result !== undefined && transport.incomingFor(result).size !== 0) terms.push(sourceStorageReference(result, scope));
          }
        }
        return { kind: "replace", terms, dependencies };
      }
      const selected = navigation.callableImplementation(node);
      if (selected.kind !== "resolved") {
        if (transport.isOpaque(term.invocation)) return { kind: "replace", terms: [] };
        budget.reject("Source storage invocation requires its exact checked original implementation."); return undefined;
      }
      const candidate = selected.implementation.declaration;
      const scope = equations.scopeFor(candidate, term.invocation, term.scope, term.callee.scope, term);
      if (scope === undefined) return undefined;
      if (term.mode === "execution") {
        const regions = regionsFor(candidate, term.invocation, scope, term.demand);
        return regions === undefined ? undefined : { kind: "replace", terms: regions };
      }
      const result = transport.subject(candidate, "return", term.projection);
      return result === undefined ? undefined : { kind: "replace", terms: [sourceStorageReference(result, scope)], dependencies };
    }
    const bound = scopes.lookup(term.subject, term.scope);
    if (bound !== undefined) return bound;
    const node = term.subject.node;
    if (term.subject.kind === "value" && (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node))) {
      const selected = ast.is.IsPropertyAccessExpression(node) ? semantics.forNode(node).operations.propertyAccess(node) : semantics.forNode(node).operations.elementAccess(node);
      if (selected?.selectedDeclaration !== undefined) {
        const receiver = transport.subjectFor(selected.receiver.expression);
        if (receiver === undefined) return undefined;
        return { kind: "replace", terms: [Object.freeze({ kind: "member", access: node, scope: term.scope,
          receiver: sourceStorageReference(receiver, term.scope), projection: term.subject.projection, mode: "value" })] };
      }
    }
    if (ast.is.IsNewExpression(node) && transport.invocationEffects.get(node)?.resultAlias === undefined) {
      const candidate = transport.invocationDeclarations.get(node);
      if (candidate === undefined) return { kind: "replace", terms: [leaf(term.subject, term.scope)] };
      const creator = creatorScope(node, term.scope);
      const scope = ast.is.IsClassDeclaration(candidate) || ast.is.IsClassExpression(candidate)
        ? creator : scopes.frameFor(candidate, node, creator, creator);
      if (scope === undefined) return undefined;
      const target = transport.invocationTargets.get(node);
      const returned = [...transport.invocationImplementations(node)].some(candidate => {
        const result = transport.subject(candidate, "return", term.subject.projection);
        return result !== undefined && transport.incomingFor(result).size !== 0;
      });
      return { kind: "replace", terms: [leaf(term.subject, scope), ...target === undefined || transport.isOpaque(node) || !returned
        ? [] : [application(node, target, term.scope, term.subject.projection, { mode: "value" })]], dependencies: dispatchDependencies(node, term.scope) };
    }
    if ((transport.invocations.has(node) || transport.accessorTargets.has(node)) &&
      transport.invocationEffects.get(node)?.resultAlias === undefined && !transport.isOpaque(node)) {
      const target = transport.invocationTargets.get(node);
      if (target !== undefined) return { kind: "replace", terms: [application(node, target, term.scope, term.subject.projection, { mode: "value" })] };
    }
    const stores = term.subject.kind === "value" || term.subject.kind === "member" ? transport.storedValuesFor(term.subject) : undefined;
    if (stores !== undefined) {
      const terms: SourceStorageTerm[] = [];
      for (const input of transport.incomingFor(term.subject)) {
        if (!budget.step()) return undefined;
        if (input.kind === "input" && input.node === node) terms.push(sourceStorageReference(input, term.scope));
      }
      for (const store of stores) {
        if (!budget.step()) return undefined;
        if (store.reason !== undefined) continue;
        if (store.value === undefined) continue;
        if (store.kind === "initialization" || store.destination !== "binding") {
          terms.push(sourceStorageReference(store.value, store.kind === "initialization"
            ? creatorScope(store.storage.node, term.scope) : term.scope)); continue;
        }
        const effects = readEffects(store);
        const region = transport.regions.enclosing(node);
        const owner = region === undefined ? undefined : sourceStorageRegionOwner(ast, region);
        for (const effect of effects) {
          if (!budget.step()) return undefined;
          if (effect.kind !== "effect" || effect.store !== store) continue;
          const creator = owner === undefined ? scopes.empty : scopes.owningScope(effect.scope, owner);
          if (creator !== undefined && birthKey(term.subject, creator) === birthKey(term.subject, term.scope))
            terms.push(sourceStorageReference(store.value, effect.scope));
        }
      }
      return { kind: "replace", terms };
    }
    const parents = transport.incomingFor(term.subject);
    const receiver = term.subject.kind === "return" && ast.body(node) !== undefined
      ? transport.subject(node, "receiver") : undefined;
    const selectedBody = receiver !== undefined && scopes.lookup(receiver, term.scope) !== undefined;
    const terms = [...parents].filter(parent => !selectedBody || parent.kind !== "return")
      .map(parent => sourceStorageReference(parent, term.scope));
    if (parents.size === 0 || sourceStorageHasOriginalCallableValue(term.subject, ast))
      terms.unshift(leaf(term.subject, creatorScope(node, term.scope)));
    return { kind: "replace", terms, dependencies: transport.invocations.has(node) || transport.accessorTargets.has(node)
      ? dispatchDependencies(node, term.scope) : undefined };
  };
  return Object.freeze({ reduce });
}
