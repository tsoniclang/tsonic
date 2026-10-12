import { Node_Expression } from "../../source-navigation/index.js";
import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject, SourceStorageProjection } from "./subjects.js";
import { sourceStorageFormalOwner, sourceStorageHasOriginalValue, sourceStorageIsDataMember, sourceStorageIsMethodMember,
  sourceStorageMemberSubject } from "./subjects.js";
import type { SourceStorageStore } from "./stored-values.js";
import { createSourceStorageExecutionReachability } from "./execution-reachability.js";
import { sourceStorageReference } from "./scoped-model.js";
import type { SourceStorageReduction, SourceStorageScope, SourceStorageTerm, SourceStorageReference, SourceStorageRelationWitness,
  SourceStorageOperation } from "./scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { createSourceStorageEquations } from "./scoped-equations.js";
import { sourceStorageRegionOwner } from "./lexical-regions.js";
import { sourceStorageComponentType, sourceStorageSubjectType } from "./components.js";
import { sourceStorageProjectComponents } from "./component-projections.js";

interface SourceStorageChildContext {
  readonly contributes?: boolean;
  readonly independentCallee?: Node;
  readonly correlated?: boolean;
}

export function createSourceStorageScopedSuccessors(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes,
  equations: ReturnType<typeof createSourceStorageEquations>,
  birthKey: (subject: SourceStorageSubject, scope: SourceStorageScope) => string | undefined,
  closed: (term: SourceStorageTerm) => boolean | undefined,
  readRelation: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined) {
  const { ast, navigation, semantics } = source;
  const passiveMember = (declaration: Node): boolean => (sourceStorageIsDataMember(declaration, ast) ||
    ast.is.IsMethodDeclaration(declaration) || ast.is.IsMethodSignatureDeclaration(declaration)) &&
    transport.memberAccessorsFor(declaration)?.size === 0;
  const reachability = createSourceStorageExecutionReachability(source, budget, transport);
  const readEffects = function* (store: SourceStorageStore, execution?: SourceStorageTerm) {
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
      if (!schedule(execution ?? Object.freeze({ kind: "execution-root", demand: store.region }))) return;
      while (pending.length !== 0) {
        if (!budget.step()) return;
        const term = pending.pop()!;
        if (term.kind === "effect" || term.kind === "unresolved") { yield term; continue; }
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
  const symbolicProjection = (subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageReduction | undefined => {
    const terms: SourceStorageTerm[] = [leaf(subject, scope)];
    const owner = sourceStorageFormalOwner(subject, ast);
    const region = owner === undefined ? undefined : ast.body(owner);
    if (region === undefined || subject.projection.length === 0) return { kind: "replace", terms };
    const reachable = reachability.reachableFrom(region);
    if (reachable === undefined) return undefined;
    for (const reachableRegion of reachable) {
      if (!budget.step()) return undefined;
      for (const store of transport.storesIn(reachableRegion) ?? []) {
        if (!budget.step()) return undefined;
        if (store.kind !== "mutation" || store.receiver === undefined || store.destination === "binding") continue;
        for (const [index, component] of subject.projection.entries()) {
          if (!budget.step()) return undefined;
          if ((component.kind === "member") !== (store.destination === "member")) continue;
          const writeComponent = store.storage.projection[store.storage.projection.length - 1];
          if (component.kind === "tuple-element" && writeComponent?.kind === "tuple-element" && component.index !== writeComponent.index) continue;
          const receiver = transport.subject(subject.node, subject.kind, subject.projection.slice(0, index));
          const receiverType = receiver === undefined ? undefined : sourceStorageSubjectType(source, receiver);
          if (receiver === undefined || receiverType === undefined) return undefined;
          const context = semantics.forNode(receiver.node);
          if (component.kind === "member") {
            const access = ast.is.IsPropertyAccessExpression(store.reference) ? semantics.forNode(store.reference).operations.propertyAccess(store.reference)
              : semantics.forNode(store.reference).operations.elementAccess(store.reference);
            const members = access === undefined ? undefined : transport.memberFlow.declarationsFor(receiver, store.storage.node, access.receiver.type);
            if (members === undefined || !members.includes(component.declaration)) continue;
          }
          const selectedType = sourceStorageComponentType(receiverType, component, context);
          const valueType = store.value === undefined ? undefined : sourceStorageSubjectType(source, store.value);
          if (selectedType === undefined || valueType === undefined || store.reason !== undefined) {
            terms.push(Object.freeze({ kind: "unresolved", subject, scope,
              reason: store.reason ?? "A symbolic storage mutation requires its exact checked producer and component type." }));
            continue;
          }
          const values: SourceStorageSubject[] = [];
          sourceStorageProjectComponents(store.value!.projection, valueType, selectedType, subject.projection.slice(index + 1),
            semantics.forNode(store.value!.node), budget, projection => {
              const value = transport.subject(store.value!.node, store.value!.kind, projection);
              if (value !== undefined) values.push(value);
            });
          const execution: SourceStorageTerm = Object.freeze({ kind: "region", region, scope, demand: store.region });
          for (const effect of readEffects(store, execution)) {
            if (!budget.step()) return undefined;
            if (effect.kind === "unresolved") { terms.push(effect); continue; }
            if (effect.kind !== "effect" || effect.store !== store) continue;
            for (const value of values) terms.push(Object.freeze({ kind: "store", destination: leaf(receiver, scope),
              receiver: sourceStorageReference(store.receiver, effect.scope), value: sourceStorageReference(value, effect.scope) }));
          }
        }
      }
    }
    return { kind: "replace", terms };
  };
  const member = (term: Extract<SourceStorageTerm, { readonly kind: "member" }>, correlated: boolean): SourceStorageReduction | undefined => {
    const access = term.selection.kind === "access" ? term.selection.node : undefined;
    const property = access !== undefined && ast.is.IsPropertyAccessExpression(access) ? semantics.forNode(access).operations.propertyAccess(access) : undefined;
    const selected = access === undefined ? undefined : property ?? semantics.forNode(access).operations.elementAccess(access);
    const declaration = term.selection.kind === "projection" ? term.selection.declaration : property?.selectedReadDeclaration ?? selected?.selectedDeclaration;
    const receiverType = term.selection.kind === "projection" ? sourceStorageSubjectType(source, term.selection.subject) : selected?.receiver.type;
    if (receiverType === undefined || declaration === undefined) {
      budget.reject("Source storage member reads require their exact checked declaration and receiver."); return undefined;
    }
    if (term.receiver.kind !== "leaf") {
      const replace = (receiver: SourceStorageTerm): SourceStorageTerm => Object.freeze({ ...term, receiver });
      return !correlated && term.mode === "value" && passiveMember(declaration)
        ? materializeChild(term.receiver, receiver => [replace(receiver)]) : replaceChild(term.receiver, replace);
    }
    const originals = new Set<Node>();
    const selections = term.mode === "execution" && selected !== undefined ? [
      ...(selected.accessMode === "write" ? [] : [{ target: property?.selectedReadDeclaration ?? selected.selectedDeclaration, read: true }]),
      ...(selected.accessMode === "read" ? [] : [{ target: property?.selectedWriteDeclaration ?? selected.selectedDeclaration, read: false }]),
    ] : [{ target: declaration, read: true }];
    for (const { target, read } of selections) {
      if (!budget.step()) return undefined;
      if (target === undefined) continue;
      const unbound = (term.receiver.subject.kind === "input" || term.receiver.subject.kind === "receiver") &&
        scopes.lookup(term.receiver.subject, term.receiver.scope) === undefined;
      const members = unbound ? [target] : transport.memberFlow.declarationsFor(term.receiver.subject, target, receiverType);
      if (members === undefined) {
        if (budget.failure() !== undefined) return undefined;
        const subject = term.selection.kind === "projection" ? term.selection.subject : transport.subject(term.selection.node, "value", term.projection);
        return subject === undefined ? undefined : { kind: "replace", terms: [Object.freeze({ kind: "unresolved", subject,
          scope: term.scope, reason: "Source storage members require exact checked correspondence." })] };
      }
      for (const member of members) {
        if (!budget.step()) return undefined;
        const getter = ast.is.IsGetAccessorDeclaration(member);
        const setter = ast.is.IsSetAccessorDeclaration(member);
        if (read && setter || !read && getter || term.mode === "execution" && !getter && !setter) continue;
        originals.add(member);
      }
    }
    const terms: SourceStorageTerm[] = [];
    const witnesses: SourceStorageRelationWitness[] = [];
    for (const original of originals) {
      if (!budget.step()) return undefined;
      if (ast.is.IsGetAccessorDeclaration(original) || ast.is.IsSetAccessorDeclaration(original)) {
        if (access === undefined) { budget.reject("A projected storage member cannot manufacture an accessor invocation."); return undefined; }
        const scope = scopes.frameFor(original, access, term.scope, term.receiver.scope);
        const result = transport.subject(original, "return", term.projection);
        if (scope === undefined || result === undefined) return undefined;
        if (term.mode === "execution") {
          const regions = regionsFor(original, access, scope, term.demand);
          if (regions === undefined) return undefined;
          terms.push(...regions);
        } else terms.push(sourceStorageReference(result, scope));
        continue;
      }
      const subject = sourceStorageMemberSubject(original, ast, transport.subject, term.projection);
      if (subject === undefined) return undefined;
      if (scopes.isSymbolic(term.receiver) && sourceStorageIsDataMember(original, ast)) {
        const projected = transport.subject(term.receiver.subject.node, term.receiver.subject.kind,
          [...term.receiver.subject.projection, { kind: "member", declaration: original }, ...term.projection]);
        if (projected === undefined) return undefined;
        terms.push(sourceStorageReference(projected, term.receiver.scope));
        continue;
      }
      witnesses.push(Object.freeze({ subject, bindings: term.receiver.scope, contributes: true }));
      const stores = transport.storedValuesFor(subject);
      if ((term.receiver.subject.kind === "input" || term.receiver.subject.kind === "receiver") &&
        scopes.lookup(term.receiver.subject, term.receiver.scope) === undefined) {
        terms.push(sourceStorageReference(subject, term.receiver.scope)); continue;
      }
      if (stores === undefined) {
        terms.push(ast.is.IsMethodDeclaration(original) && ast.body(original) !== undefined
          ? leaf(subject, creatorScope(original, term.receiver.scope)) : sourceStorageReference(subject, term.receiver.scope));
        continue;
      }
      if (ast.is.IsMethodDeclaration(original) && ast.body(original) !== undefined)
        terms.push(leaf(subject, creatorScope(original, term.receiver.scope)));
      for (const { store, value } of stores) {
        if (!budget.step()) return undefined;
        if (store.reason !== undefined) continue;
        if (value === undefined) continue;
        const receiver = receiverFor(store);
        if (receiver === undefined) { budget.reject("Source storage physical members require exact initialized or mutated receivers."); return undefined; }
        const initialized = initializationScope(store, receiver, term.receiver);
        if (initialized !== undefined) {
          terms.push(sourceStorageReference(value, initialized));
          continue;
        }
        const construction = store.kind === "initialization" && ast.is.IsNewExpression(term.receiver.subject.node)
          ? term.receiver.subject.node : undefined;
        const target = construction === undefined ? undefined : transport.invocationTargets.get(construction);
        const execution = construction === undefined || target === undefined ? undefined
          : application(construction, target, term.receiver.scope, [], { mode: "execution", demand: store.region });
        const effects = readEffects(store, execution);
        for (const effect of effects) {
          if (!budget.step()) return undefined;
          if (effect.kind === "unresolved") { terms.push(effect); continue; }
          if (effect.kind !== "effect" || effect.store !== store) continue;
          const destination: SourceStorageTerm = store.destination === "element"
            ? Object.freeze({ ...term, projection: term.projection.slice(0, store.storage.projection.length - 1) }) : term.receiver;
          terms.push(Object.freeze({ kind: "store", destination,
            receiver: sourceStorageReference(receiver, effect.scope), value: sourceStorageReference(value, effect.scope) }));
        }
      }
    }
    return { kind: "replace", terms, witnesses };
  };
  const materializeChild = (child: SourceStorageTerm,
    select: (child: SourceStorageReference) => readonly SourceStorageTerm[] | undefined,
    independentCallee?: Node): Extract<SourceStorageReduction, { readonly kind: "project" }> => ({ kind: "project", input: child, select: value => {
      if (independentCallee !== undefined) {
        const selected = navigation.callableImplementation(value.subject.node);
        if (selected.kind !== "resolved" || selected.implementation.declaration !== independentCallee) {
          return [Object.freeze({ kind: "unresolved", subject: value.subject, scope: value.scope,
            reason: "Source storage shared dispatch requires its exact context-independent implementation." })];
        }
      }
      return select(value);
    } });
  const replaceChild = (child: SourceStorageTerm,
    replace: (child: SourceStorageTerm) => SourceStorageTerm, context: SourceStorageChildContext = {}): SourceStorageReduction | undefined => {
    if (child.kind === "unresolved") return { kind: "replace", terms: [child] };
    if (child.kind === "reference" || child.kind === "application" || child.kind === "member" || child.kind === "guarded") {
      const independent = closed(child);
      if (independent === undefined) return undefined;
      if (independent || context.independentCallee !== undefined)
        return materializeChild(child, value => [replace(value)], independent ? undefined : context.independentCallee);
    }
    const selected = reduce(child, context.correlated ?? true);
    if (selected?.kind === "project") return { kind: "project", input: selected.input,
      select: value => selected.select(value)?.map(replace) };
    return selected?.kind === "replace" ? { kind: "replace", terms: selected.terms.map(replace), dependencies: selected.dependencies,
      witnesses: [...(selected.witnesses ?? []).map(witness => context.contributes !== false ? witness : { ...witness, contributes: false }),
        ...child.kind === "reference" || child.kind === "leaf"
        ? [{ subject: child.subject, bindings: child.scope, contributes: context.contributes !== false }] : []] } : selected;
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
  const guardedLeaf = (reference: Node, value: SourceStorageReference): readonly SourceStorageTerm[] | undefined => {
    const admitted = transport.guardedValues.admits(value.subject, reference);
    if (budget.failure() !== undefined) return undefined;
    if (admitted === false) return [];
    if (admitted === true) return [value];
    const guards = transport.guardedValues.conjoin(value.guards, reference);
    return budget.failure() !== undefined ? undefined : guards === null ? []
      : guards === value.guards ? [value] : [Object.freeze({ ...value, guards })];
  };
  const reduce = (term: SourceStorageTerm, correlated = false): SourceStorageReduction | undefined => {
    if (!budget.step()) return undefined;
    if (term.kind === "leaf" || term.kind === "unresolved" || term.kind === "effect" || term.kind === "empty") return undefined;
    if (term.kind === "guarded") {
      if (term.value.kind !== "leaf") {
        const replace = (value: SourceStorageTerm): SourceStorageTerm => Object.freeze({ ...term, value });
        return correlated ? replaceChild(term.value, replace, { contributes: false, correlated })
          : { ...materializeChild(term.value, value => guardedLeaf(term.reference, value)), valueFilter: term.reference };
      }
      const terms = guardedLeaf(term.reference, term.value);
      return terms === undefined ? undefined : { kind: "replace", terms };
    }
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
        if (target !== undefined) terms.push(application(invocation, target, term.scope, [],
          { mode: "execution", demand: term.demand }));
        else if (transport.accessorTargets.has(invocation)) {
          const operation = ast.is.IsPropertyAccessExpression(invocation) ? semantics.forNode(invocation).operations.propertyAccess(invocation)
            : semantics.forNode(invocation).operations.elementAccess(invocation);
          const receiver = transport.subjectFor(operation?.receiver.expression);
          if (receiver === undefined) return undefined;
          terms.push(Object.freeze({ kind: "member", selection: Object.freeze({ kind: "access", node: invocation }), receiver: sourceStorageReference(receiver, term.scope),
            scope: term.scope, projection: [], mode: "execution", demand: term.demand }));
        }
      }
      return { kind: "replace", terms };
    }
    if (term.kind === "store") {
      if (term.destination.kind !== "leaf") return replaceChild(term.destination, destination => Object.freeze({ ...term, destination }), { contributes: false });
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
    if (term.kind === "member") return member(term, correlated);
    if (term.kind === "application") {
      const dependencies = dispatchDependencies(term.invocation, term.scope);
      if (term.callee.kind !== "leaf") {
        const selected = replaceChild(term.callee, callee => Object.freeze({ ...term, callee }), {
          independentCallee: independentCalleeFor(term.invocation),
        });
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
      if (scopes.isSymbolic(term.callee)) {
        const result = transport.subject(term.invocation, "value", term.projection);
        if (result === undefined) return undefined;
        return { kind: "replace", terms: [term.mode === "value" ? leaf(result, term.scope)
          : Object.freeze({ kind: "unresolved", subject: result, scope: term.scope,
            reason: "A symbolic callable invocation has no selected implementation execution." })], dependencies };
      }
      const selected = navigation.callableImplementation(node);
      if (selected.kind !== "resolved") {
        if (transport.isOpaque(term.invocation)) {
          const result = transport.subject(term.invocation, "value", term.projection);
          return result === undefined ? undefined : { kind: "replace", terms: term.mode === "value"
            ? [leaf(result, term.scope)] : [], dependencies };
        }
        budget.reject("Source storage invocation requires its exact checked original implementation."); return undefined;
      }
      const candidate = selected.implementation.declaration;
      const scope = equations.scopeFor(candidate, term.invocation, term.scope, term.callee.scope, term);
      if (scope === undefined) return undefined;
      if (term.mode === "execution") {
        const regions = regionsFor(candidate, term.invocation, scope, term.demand);
        return regions === undefined ? undefined : { kind: "replace", terms: regions };
      }
      if (ast.hasModifierKind(candidate, "async")) {
        const result = transport.subject(term.invocation, "value", term.projection);
        return result === undefined ? undefined : { kind: "replace", terms: [leaf(result, term.scope)], dependencies };
      }
      const result = transport.subject(candidate, "return", term.projection);
      return result === undefined ? undefined : { kind: "replace", terms: [sourceStorageReference(result, scope)], dependencies };
    }
    const bound = scopes.lookup(term.subject, term.scope);
    if (bound !== undefined) return bound;
    if (term.scope.kind === "frame" && term.scope.boundary === "declaration" &&
      sourceStorageFormalOwner(term.subject, ast) === term.scope.owner) return symbolicProjection(term.subject, term.scope);
    const node = term.subject.node;
    const memberIndex = term.subject.projection.findIndex(component => component.kind === "member");
    const component = term.subject.projection[memberIndex];
    if (component?.kind === "member") {
      const receiver = transport.subject(node, term.subject.kind, term.subject.projection.slice(0, memberIndex));
      if (receiver === undefined) return undefined;
      return { kind: "replace", terms: [Object.freeze({ kind: "member",
        selection: Object.freeze({ kind: "projection", subject: receiver, declaration: component.declaration }), scope: term.scope,
        receiver: sourceStorageReference(receiver, term.scope), projection: term.subject.projection.slice(memberIndex + 1), mode: "value" })] };
    }
    if (term.subject.kind === "value" && (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node))) {
      const selected = ast.is.IsPropertyAccessExpression(node) ? semantics.forNode(node).operations.propertyAccess(node) : semantics.forNode(node).operations.elementAccess(node);
      const declaration = selected?.selectedDeclaration;
      if (selected !== undefined && declaration !== undefined && (sourceStorageIsDataMember(declaration, ast) ||
        sourceStorageIsMethodMember(declaration, ast) || ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration))) {
        const receiver = transport.subjectFor(selected.receiver.expression);
        if (receiver === undefined) return undefined;
        return { kind: "replace", terms: [Object.freeze({ kind: "member", selection: Object.freeze({ kind: "access", node }), scope: term.scope,
          receiver: sourceStorageReference(receiver, term.scope), projection: term.subject.projection, mode: "value" })] };
      }
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
    const stores = term.subject.kind === "value" || term.subject.kind === "member" ? transport.storedValuesFor(term.subject) : undefined;
    if (stores !== undefined) {
      const terms: SourceStorageTerm[] = [];
      for (const input of transport.incomingFor(term.subject)) {
        if (!budget.step()) return undefined;
        if (input.kind === "input" && input.node === node) terms.push(sourceStorageReference(input, term.scope));
      }
      for (const { store, value } of stores) {
        if (!budget.step()) return undefined;
        if (store.reason !== undefined) continue;
        if (value === undefined) continue;
        if (store.kind === "initialization") {
          terms.push(sourceStorageReference(value, creatorScope(store.storage.node, term.scope))); continue;
        }
        if (store.destination === "member" && term.scope === scopes.empty) {
          terms.push(sourceStorageReference(value, scopes.empty)); continue;
        }
        const region = transport.regions.enclosing(node);
        const owner = region === undefined ? undefined : sourceStorageRegionOwner(ast, region);
        const local = store.destination === "binding" && store.region === region
          ? owner === undefined || term.scope === scopes.empty ? scopes.empty : scopes.owningScope(term.scope, owner) : undefined;
        if (local !== undefined) {
          terms.push(sourceStorageReference(value, local));
          continue;
        }
        const effects = readEffects(store);
        for (const effect of effects) {
          if (!budget.step()) return undefined;
          if (effect.kind === "unresolved") { terms.push(effect); continue; }
          if (effect.kind !== "effect" || effect.store !== store) continue;
          if (store.destination === "member") {
            terms.push(sourceStorageReference(value, effect.scope));
            continue;
          }
          if (store.destination === "element") {
            const container = transport.subject(term.subject.node, term.subject.kind,
              term.subject.projection.slice(0, store.storage.projection.length - 1));
            if (container === undefined || store.receiver === undefined) {
              budget.reject("Source storage element writes require their exact physical container."); return undefined;
            }
            terms.push(Object.freeze({ kind: "store", destination: sourceStorageReference(container, term.scope),
              receiver: sourceStorageReference(store.receiver, effect.scope), value: sourceStorageReference(value, effect.scope) }));
            continue;
          }
          const creator = owner === undefined ? scopes.empty : scopes.owningScope(effect.scope, owner);
          if (creator !== undefined && birthKey(term.subject, creator) === birthKey(term.subject, term.scope))
            terms.push(sourceStorageReference(value, effect.scope));
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
    if (sourceStorageHasOriginalValue(term.subject, ast, parents.size !== 0))
      terms.unshift(leaf(term.subject, creatorScope(node, term.scope)));
    const qualified = term.subject.kind === "value" && ast.is.IsIdentifier(node) && parents.size !== 0 &&
      transport.guardedValues.appliesTo(node) === true;
    return { kind: "replace", terms: qualified ? terms.map(value => Object.freeze({ kind: "guarded" as const, reference: node, value })) : terms,
      dependencies: transport.invocations.has(node) || transport.accessorTargets.has(node)
      ? dispatchDependencies(node, term.scope) : undefined };
  };
  return Object.freeze({ reduce });
}
