import { Node_Expression } from "../../source-navigation/index.js";
import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject, SourceStorageProjection } from "./subjects.js";
import { sourceStorageHasOriginalCallableValue, sourceStorageMemberSubject } from "./subjects.js";
import type { SourceStorageStore } from "./stored-values.js";
import { sourceStorageReference } from "./scoped-model.js";
import type { SourceStorageReduction, SourceStorageScope, SourceStorageTerm, SourceStorageReference, SourceStorageScopedSubject } from "./scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { createSourceStorageEquations } from "./scoped-equations.js";
import { sourceStorageRegionOwner } from "./lexical-regions.js";

export function createSourceStorageScopedSuccessors(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes,
  equations: ReturnType<typeof createSourceStorageEquations>,
  birthKey: (subject: SourceStorageSubject, scope: SourceStorageScope) => string | undefined,
  readRelation: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined) {
  const { ast, navigation, semantics } = source;
  const executionRoot: SourceStorageTerm = Object.freeze({ kind: "execution-root" });
  const readEffects = () => readRelation(executionRoot);
  const creatorScope = (node: Node, scope: SourceStorageScope): SourceStorageScope => {
    if (scope === scopes.empty) return scope;
    const region = transport.regions.enclosing(node);
    const owner = region === undefined ? undefined : sourceStorageRegionOwner(ast, region);
    return owner === undefined ? scopes.empty : scopes.owningScope(scope, owner) ?? scope;
  };
  const leaf = (subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageReference => Object.freeze({ kind: "leaf", subject, scope });
  const application = (invocation: Node, target: SourceStorageSubject, scope: SourceStorageScope,
    projection: readonly SourceStorageProjection[], mode: "value" | "execution"): SourceStorageTerm =>
    Object.freeze({ kind: "application", invocation, callee: sourceStorageReference(target, scope), scope, projection, mode });
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
  const regionsFor = (candidate: Node, invocation: Node, scope: SourceStorageScope): readonly SourceStorageTerm[] | undefined => {
    const terms: SourceStorageTerm[] = [];
    for (const region of transport.regions.callable(candidate, transport.accessorTargets.has(invocation) ? undefined : invocation)) {
      if (!budget.step()) return undefined;
      terms.push(Object.freeze({ kind: "region", region, scope }));
    }
    if (ast.is.IsNewExpression(invocation)) for (const region of transport.regions.instance(invocation)) {
      if (!budget.step()) return undefined;
      const caller = scope.kind === "frame" ? scope.caller ?? scope : scope;
      const captured = scope.kind === "frame" ? scope.parents[0] ?? scope : scope;
      const context = scopes.frameFor(region.owner, invocation, caller, captured);
      if (context === undefined) return undefined;
      terms.push(Object.freeze({ kind: "region", region: region.node, scope: context }));
    }
    return Object.freeze(terms);
  };
  const receiverFor = (store: SourceStorageStore): SourceStorageSubject | undefined => {
    if (store.kind !== "initialization") return store.receiver;
    const parent = ast.parent(store.storage.node);
    if (ast.is.IsParameterDeclaration(store.storage.node) || ast.is.IsPropertyDeclaration(store.storage.node)) return transport.subject(parent, "receiver");
    return parent !== undefined && ast.is.IsObjectLiteralExpression(parent) ? transport.subject(parent) : undefined;
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
          const regions = regionsFor(original, term.access, scope);
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
      const effects = readEffects();
      if (effects === undefined) return undefined;
      for (const store of stores) {
        if (!budget.step()) return undefined;
        if (store.reason !== undefined) continue;
        if (store.value === undefined) continue;
        const receiver = receiverFor(store);
        if (receiver === undefined) { budget.reject("Source storage physical members require exact initialized or mutated receivers."); return undefined; }
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
      const variables = scopes.variablesFor(child.scope);
      if (variables === undefined) return undefined;
      if (variables.size === 0) {
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
    if (term.kind === "leaf" || term.kind === "effect") return undefined;
    if (term.kind === "execution-root") return { kind: "replace", terms: transport.sourceFiles.filter(file => !file.IsDeclarationFile)
      .map(region => Object.freeze({ kind: "region" as const, region, scope: scopes.empty })) };
    if (term.kind === "region") {
      const terms: SourceStorageTerm[] = [];
      for (const store of transport.storesIn(term.region) ?? []) {
        if (!budget.step()) return undefined;
        terms.push(Object.freeze({ kind: "effect", store, scope: term.scope }));
      }
      for (const invocation of transport.regions.invocationsIn(term.region) ?? []) {
        if (!budget.step()) return undefined;
        const target = transport.invocationTargets.get(invocation);
        if (target !== undefined && !transport.isOpaque(invocation)) terms.push(application(invocation, target, term.scope, [], "execution"));
        else if (transport.accessorTargets.has(invocation)) {
          const operation = ast.is.IsPropertyAccessExpression(invocation) ? semantics.forNode(invocation).operations.propertyAccess(invocation)
            : semantics.forNode(invocation).operations.elementAccess(invocation);
          const receiver = transport.subjectFor(operation?.receiver.expression);
          if (receiver === undefined) return undefined;
          terms.push(Object.freeze({ kind: "member", access: invocation, receiver: sourceStorageReference(receiver, term.scope),
            scope: term.scope, projection: [], mode: "execution" }));
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
    if (term.kind === "guard") {
      if (term.condition.kind !== "leaf") return replaceChild(term.condition, condition => Object.freeze({ ...term, condition }));
      const selected = navigation.callableImplementation(term.condition.subject.node);
      return { kind: "replace", terms: selected.kind === "resolved" && selected.implementation.declaration === term.candidate ? [term.value] : [] };
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
            const regions = regionsFor(candidate, term.invocation, scope);
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
        const regions = regionsFor(candidate, term.invocation, scope);
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
        ? [] : [application(node, target, term.scope, term.subject.projection, "value")]], dependencies: dispatchDependencies(node, term.scope) };
    }
    if ((transport.invocations.has(node) || transport.accessorTargets.has(node)) &&
      transport.invocationEffects.get(node)?.resultAlias === undefined && !transport.isOpaque(node)) {
      const target = transport.invocationTargets.get(node);
      if (target !== undefined) return { kind: "replace", terms: [application(node, target, term.scope, term.subject.projection, "value")] };
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
        const effects = readEffects();
        if (effects === undefined) return undefined;
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
  return Object.freeze({ reduce, regionsFor });
}
