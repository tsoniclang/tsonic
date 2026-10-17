import { Node_Expression } from "../../../source-navigation/index.js";
import type { Node, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageProjection } from "../model/subjects.js";
import { sourceStorageFormalOwner, sourceStorageHasOriginalValue, sourceStorageIsDataMember, sourceStorageIsMethodMember,
  sourceStorageIsMemberProjection, sourceStorageMemberSubject } from "../model/subjects.js";
import type { SourceStorageStore } from "../graph/stored-values.js";
import { createSourceStorageExecutionReachability } from "./execution-reachability.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import type { SourceStorageActivation, SourceStorageReduction, SourceStorageScope, SourceStorageTerm, SourceStorageReference, SourceStorageRelationWitness,
  SourceStorageOperation, SourceStorageVariable } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import type { createSourceStorageEquations } from "./scoped-equations.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { sourceMemberOwner } from "../../../source-navigation/class-members.js";
import { sourceStorageComponentType, sourceStorageSubjectType } from "../model/components.js";
import { sourceStorageProjectComponents } from "../graph/component-projections.js";
import { sourceStorageClassLineages, sourceStorageInstanceCaptures } from "../transport/invocation-results.js";
import { sourceStorageAllocations, sourceStorageInstanceInitializers, sourceStorageSuperConstructor } from "../model/construction.js";
import type { SourceStorageBoundSubject } from "./substitutions.js";
import type { SourceStorageCallbackEntry } from "../model/types.js";
import { sourceStorageNativeCallablePayloads } from "../graph/invocation-inputs.js";

interface SourceStorageChildContext {
  readonly contributes?: boolean;
  readonly independentCallee?: Node;
  readonly correlated?: boolean;
}

export function* walkSourceStorageExecution(budget: SourceStorageBudget, roots: Iterable<SourceStorageTerm>,
  read: (term: SourceStorageTerm) => Iterable<SourceStorageTerm> | undefined): Generator<SourceStorageTerm> {
  const rows = budget.createRows();
  const frontier = budget.createRows();
  let maximumFrontier = 0;
  const pending: SourceStorageTerm[] = [];
  const visited = new Set<SourceStorageTerm>();
  const schedule = (term: SourceStorageTerm): boolean => {
    if (!budget.step()) return false;
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
    for (const root of roots) if (!schedule(root)) return;
    while (pending.length !== 0) {
      if (!budget.step()) return;
      const term = pending.pop()!;
      if (term.kind === "leaf" || term.kind === "effect" || term.kind === "unresolved") { yield term; continue; }
      if (term.kind === "empty") continue;
      const successors = read(term);
      if (successors === undefined) {
        budget.reject("Source storage execution requires its active scoped relation."); return;
      }
      for (const successor of successors) if (!schedule(successor)) return;
    }
  } finally { pending.length = 0; visited.clear(); frontier.release(); rows.release(); }
}

export function createSourceStorageScopedSuccessors(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes,
  equations: ReturnType<typeof createSourceStorageEquations>,
  birth: (subject: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageActivation | undefined,
  closed: (term: SourceStorageTerm) => boolean | undefined,
  readRelation: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined) {
  const { ast, navigation, semantics } = source;
  const empty: Extract<SourceStorageTerm, { readonly kind: "empty" }> = Object.freeze({ kind: "empty" });
  const absent: Extract<SourceStorageReduction, { readonly kind: "replace" }> = Object.freeze({
    kind: "replace", terms: Object.freeze([empty]),
  });
  const passiveMember = (declaration: Node): boolean => (sourceStorageIsDataMember(declaration, ast) ||
    ast.is.IsMethodDeclaration(declaration) || ast.is.IsMethodSignatureDeclaration(declaration)) &&
    transport.memberAccessorsFor(declaration)?.size === 0;
  const reachability = createSourceStorageExecutionReachability(source, budget, transport);
  const conditionalExecutions = (roots: Iterable<SourceStorageTerm>, demand: Node, exposure: Node,
    reasons: { readonly value: string; readonly effect: string }): readonly SourceStorageTerm[] | undefined => {
    const selected = transport.subjectFor(demand);
    const terms: SourceStorageTerm[] = [];
    for (const result of walkSourceStorageExecution(budget, roots, readRelation)) {
      if (!budget.step()) return undefined;
      if (result.kind === "unresolved") terms.push(result);
      else if (result.kind === "leaf" && result.subject === selected)
        terms.push(Object.freeze({ kind: "unresolved", subject: result.subject, scope: result.scope, exposure, reason: reasons.value }));
      else if (result.kind === "effect" && result.store.region === demand)
        terms.push(Object.freeze({ kind: "unresolved", subject: result.store.storage, scope: result.scope, exposure, reason: reasons.effect }));
    }
    return budget.failure() === undefined ? Object.freeze(terms) : undefined;
  };
  const nativeInputExecutions = (invocation: Node, scope: SourceStorageScope, demand: Node, deferred: boolean | undefined,
    callback?: { readonly entry: SourceStorageCallbackEntry; readonly subject: SourceStorageSubject;
      readonly bindings: SourceStorageScope }): readonly SourceStorageTerm[] | undefined => {
    const frontiers = reachability.frontiers(invocation, demand);
    if (frontiers === undefined) return undefined;
    if (frontiers.length === 0 && callback === undefined) return Object.freeze([]);
    const contexts = scopes.nativeExecutionRoots(scope);
    if (contexts === undefined) return undefined;
    const terms: SourceStorageTerm[] = [];
    const selected = transport.subjectFor(demand);
    let covered = false;
    let incomplete = false;
    const uncertain = (bindings: SourceStorageScope, reason: string, exposure: Node): boolean => {
      if (selected !== undefined) terms.push(Object.freeze({ kind: "unresolved", subject: selected, scope: bindings, reason, exposure }));
      else for (const store of transport.storesIn(demand) ?? []) {
        if (!budget.step()) return false;
        terms.push(Object.freeze({ kind: "unresolved", subject: store.storage, scope: bindings, reason, exposure }));
      }
      return budget.failure() === undefined;
    };
    for (const frontier of frontiers) {
      if (!budget.step()) return undefined;
      if (callback === undefined ? frontier.callback !== undefined
        : frontier.callback !== callback.entry || frontier.owner !== callback.subject) continue;
      const owner = frontier.owner === undefined ? undefined : sourceStorageFormalOwner(frontier.owner, ast);
      const actual = callback === undefined || owner === undefined ? undefined
        : scopes.boundActivation(callback.bindings, owner)?.nativeEntry;
      if (callback !== undefined) {
        if (actual === undefined) { incomplete = true; continue; }
        if (actual.invocation !== frontier.exposure) continue;
      }
      let matched = false;
      for (const context of contexts) {
        if (!budget.step()) return undefined;
        if (owner === undefined || context.owner !== owner) continue;
        const activation = scopes.boundActivation(context.scope, owner);
        const native = activation?.nativeEntry;
        if (native?.invocation !== frontier.exposure) {
          if (context.scope.kind === "variable" && context.callback !== undefined &&
            transport.callbackEntriesFor(frontier.exposure).includes(context.callback))
            if (!uncertain(context.scope, "A relevant native callback input requires its completed same-activation value correspondence.",
              frontier.exposure)) return undefined;
          continue;
        }
        if (actual !== undefined && (native.callback !== actual.callback || native.caller !== actual.caller)) continue;
        matched = true;
        if (native.callback.timing === "deferred" && !deferred) { covered = true; continue; }
        const payloads = sourceStorageNativeCallablePayloads(source, budget, frontier.exposure, native.caller, {
          subjectFor: transport.subjectFor, callbackEntriesFor: transport.callbackEntriesFor,
          hasSourceImplementation: invocation => [...transport.invocationImplementations(invocation)].some(candidate => ast.body(candidate) !== undefined),
          componentFor: (value, component) => transport.subject(value.subject.node, value.subject.kind, [...value.subject.projection, component]),
          valuesFor: (subject, bindings) => {
            const selected = readRelation(sourceStorageReference(subject, bindings));
            if (selected === undefined) return undefined;
            const values: SourceStorageBoundSubject[] = [];
            let complete = true;
            for (const value of selected) {
              if (!budget.step()) return undefined;
              if (value.kind === "leaf") values.push({ subject: value.subject, bindings: value.scope });
              else if (value.kind === "unresolved") complete = false;
            }
            return { values, complete };
          },
        });
        if (payloads === undefined) return undefined;
        if (callback !== undefined && payloads.values.length === 0) { incomplete = true; continue; }
        covered = true;
        if (!payloads.complete && !uncertain(native.caller,
          "A relevant native callback input requires its actual source payload and creation correspondence.", frontier.exposure)) return undefined;
        for (const value of payloads.values) {
          if (!budget.step()) return undefined;
          if (value.subject !== frontier.subject) continue;
          if (frontier.callback?.timing === "deferred" && !deferred) continue;
          const possible: SourceStorageTerm = Object.freeze({ kind: "application", invocation,
            callee: leaf(value.subject, value.bindings), scope, projection: [],
            ...(frontier.callback === undefined ? {} : { callback: frontier.callback }),
            mode: "execution", demand, deferred });
          const conditional = conditionalExecutions([possible], demand, frontier.exposure, {
            value: "A relevant source callable crosses a native input without completed value and capture correspondence.",
            effect: "A relevant source effect crosses a native input without completed value and capture correspondence.",
          });
          if (conditional === undefined) return undefined;
          terms.push(...conditional);
        }
      }
      if (callback !== undefined && !matched) incomplete = true;
    }
    if (callback !== undefined && (!covered || incomplete)) {
      if (selected === undefined) return undefined;
      terms.push(Object.freeze({ kind: "unresolved", subject: selected, scope, exposure: invocation,
        reason: "A native callback entry requires its exact original source implementation and capture context." }));
    }
    return budget.failure() !== undefined ? undefined : Object.freeze(terms);
  };
  const readEffects = function* (store: SourceStorageStore, selection:
    | { readonly kind: "general"; readonly execution?: SourceStorageTerm }
    | { readonly kind: "own-construction"; readonly execution: SourceStorageTerm }, deferred = false, context?: SourceStorageScope) {
    const roots = context === undefined || selection.execution !== undefined ? [] : scopes.nativeExecutionRoots(context);
    if (roots === undefined) return;
    const starts = function* (): Generator<SourceStorageTerm> {
      if (roots.length === 0) {
        yield selection.execution ?? Object.freeze({ kind: "execution-root", demand: store.region, deferred });
      } else for (const root of roots) {
        for (const region of transport.regions.callable(root.owner, root.invocation, undefined, root.callback)) {
          if (!budget.step()) return;
          yield Object.freeze({ kind: "region", region, scope: root.scope, demand: store.region, deferred });
        }
      }
    };
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
    for (const result of walkSourceStorageExecution(budget, starts(), read))
      if (result.kind === "unresolved" || result.kind === "effect" && result.store === store) yield result;
  };
  const creatorScope = (node: Node, scope: SourceStorageScope): SourceStorageScope => {
    if (scope === scopes.empty) return scope;
    const region = transport.regions.enclosing(node);
    const owner = region === undefined ? undefined : sourceStorageRegionOwner(ast, region);
    return owner === undefined ? scopes.empty : scopes.owningScope(scope, owner) ?? scope;
  };
  const leaf = (subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageReference => Object.freeze({ kind: "leaf", subject, scope });
  const classQueries = {
    subjectFor: transport.subjectFor,
    valuesFor(subject: SourceStorageSubject, bindings: SourceStorageScope): ReadonlySet<SourceStorageBoundSubject> | undefined {
      const terms = readRelation(sourceStorageReference(subject, bindings));
      if (terms === undefined) return undefined;
      const values = new Set<SourceStorageBoundSubject>();
      for (const term of terms) {
        if (!budget.step()) return undefined;
        if (term.kind === "unresolved") { budget.reject(term.reason); return undefined; }
        if (term.kind === "leaf") values.add(Object.freeze({ subject: term.subject, bindings: term.scope }));
      }
      return values;
    },
  };
  const classLineages = (value: SourceStorageReference, mode?: "heritage") =>
    sourceStorageClassLineages(source, budget, new Set([{ subject: value.subject, bindings: value.scope }]), classQueries, mode);
  const instanceCaptures = (candidate: Node, value: SourceStorageReference) => sourceStorageInstanceCaptures(
    source, budget, candidate, new Set([{ subject: value.subject, bindings: value.scope }]), classQueries);
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
  const regionsFor = (candidate: Node, invocation: Node, scope: SourceStorageScope, demand: Node,
    construction?: { readonly caller: SourceStorageScope; readonly classes: readonly SourceStorageBoundSubject[] }, deferred = false): readonly SourceStorageTerm[] | undefined => {
    const terms: SourceStorageTerm[] = [];
    const frame = scope.kind === "substitution" ? scope.scope : scope;
    const callback = frame.kind === "frame" ? frame.callback : undefined;
    for (const region of transport.regions.callable(candidate, transport.accessorTargets.has(invocation) ? undefined : invocation, undefined, callback)) {
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
    const original = birth(input.subject, input.scope);
    return original !== undefined && original.key === birth(allocation.subject, allocation.scope)?.key ? scope : undefined;
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
          if (sourceStorageIsMemberProjection(component) !== (store.destination === "member")) continue;
          const writeComponent = store.storage.projection[store.storage.projection.length - 1];
          if (component.kind === "tuple-element" && writeComponent?.kind === "tuple-element" && component.index !== writeComponent.index) continue;
          const receiver = transport.subject(subject.node, subject.kind, subject.projection.slice(0, index));
          const receiverType = receiver === undefined ? undefined : sourceStorageSubjectType(source, receiver);
          if (receiver === undefined || receiverType === undefined) return undefined;
          const context = semantics.forNode(receiver.node);
          if (sourceStorageIsMemberProjection(component)) {
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
          const execution: SourceStorageTerm = Object.freeze({ kind: "region", region, scope, demand: store.region, deferred: scopes.isDeferred(scope) });
          for (const effect of readEffects(store, { kind: "general", execution })) {
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
  const physicalMembers = (receiver: SourceStorageReference, target: Node, receiverType: Type): readonly Node[] | undefined => {
    const allocation = receiver.subject.node;
    const sourceConstruction = ast.is.IsNewExpression(allocation) && [...transport.invocationImplementations(allocation)].some(candidate =>
      navigation.isProjectDeclaration(candidate) && (ast.is.IsClassDeclaration(candidate) || ast.is.IsClassExpression(candidate) ||
        ast.is.IsConstructorDeclaration(candidate) && ast.body(candidate) !== undefined));
    if (!sourceConstruction) return transport.memberFlow.declarationsFor(receiver.subject, target, receiverType);
    const owner = sourceMemberOwner(ast, target);
    const selected = semantics.forNode(target);
    const contract = owner === undefined ? undefined : ast.is.IsTypeLiteralNode(owner) ? selected.types.authoredType(owner)
      : ast.is.IsObjectLiteralExpression(owner) ? selected.types.expressionType(owner) : selected.declarations.declaredType(owner);
    const operand = transport.invocationTargets.get(allocation);
    if (contract === undefined || operand === undefined) return undefined;
    const values = readRelation(sourceStorageReference(operand, receiver.scope));
    if (values === undefined) return undefined;
    const members = new Set<Node>();
    for (const value of values) {
      if (!budget.step()) return undefined;
      if (value.kind === "unresolved") { budget.reject(value.reason); return undefined; }
      if (value.kind !== "leaf") continue;
      const lineages = classLineages(value, "heritage");
      if (lineages === undefined) return undefined;
      for (const lineage of lineages) {
        let found = false;
        for (const captured of lineage.classes) {
          if (!budget.step()) return undefined;
          const declaration = captured.subject.node;
          const instance = transport.subject(declaration, "receiver");
          if (instance === undefined) return undefined;
          const selected = transport.memberFlow.declarationsFor(instance, target, contract);
          for (const member of selected ?? []) {
            if (!budget.step()) return undefined;
            if (sourceMemberOwner(ast, member) !== declaration || ast.hasModifierKind(member, "static")) continue;
            members.add(member); found = true;
          }
          if (found) break;
        }
        if (!found) return undefined;
      }
    }
    return Object.freeze([...members]);
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
      const unbound = scopes.isSymbolic(term.receiver) || (term.receiver.subject.kind === "input" || term.receiver.subject.kind === "receiver") &&
        scopes.lookup(term.receiver.subject, term.receiver.scope) === undefined;
      const members = unbound ? [target] : physicalMembers(term.receiver, target, receiverType);
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
          const regions = regionsFor(original, access, scope, term.demand, undefined, term.deferred);
          if (regions === undefined) return undefined;
          terms.push(...regions);
        } else terms.push(sourceStorageReference(result, scope));
        continue;
      }
      const subject = sourceStorageMemberSubject(original, ast, transport.subject, term.projection);
      if (subject === undefined) return undefined;
      if (scopes.isSymbolic(term.receiver) && (sourceStorageIsDataMember(original, ast) || sourceStorageIsMethodMember(original, ast))) {
        const projected = transport.subject(term.receiver.subject.node, term.receiver.subject.kind,
          [...term.receiver.subject.projection, { kind: sourceStorageIsMethodMember(original, ast) ? "method-value" : "member",
            declaration: original }, ...term.projection]);
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
        const writtenReceiver = transport.bindingInputFor(receiver) ?? receiver;
        const constructorWrite = store.kind === "mutation" && writtenReceiver.kind === "receiver" &&
          ast.is.IsConstructorDeclaration(writtenReceiver.node);
        const construction = (store.kind === "initialization" || constructorWrite) && ast.is.IsNewExpression(term.receiver.subject.node)
          ? term.receiver.subject.node : undefined;
        const target = construction === undefined ? undefined : transport.invocationTargets.get(construction);
        const execution = construction === undefined || target === undefined ? undefined
          : application(construction, target, term.receiver.scope, [],
            { mode: "execution", demand: store.region, deferred: scopes.isDeferred(term.scope) });
        const selection = execution !== undefined && (store.kind === "initialization" ||
          constructorWrite && store.region === ast.body(writtenReceiver.node))
          ? { kind: "own-construction" as const, execution } : { kind: "general" as const, execution };
        const effects = readEffects(store, selection, scopes.isDeferred(term.scope), term.scope);
        for (const effect of effects) {
          if (!budget.step()) return undefined;
          if (effect.kind === "unresolved") { terms.push(effect); continue; }
          if (effect.kind !== "effect" || effect.store !== store) continue;
          if (selection.kind === "own-construction") {
            terms.push(sourceStorageReference(value, effect.scope));
            continue;
          }
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
    if (child.kind === "unresolved" || child.kind === "empty") return { kind: "replace", terms: [child] };
    if (child.kind === "reference" || child.kind === "application" || child.kind === "member" || child.kind === "guarded") {
      const independent = closed(child);
      if (independent === undefined) return undefined;
      if (independent || context.independentCallee !== undefined)
        return materializeChild(child, value => [replace(value)], independent ? undefined : context.independentCallee);
    }
    const selected = reduce(child, context.correlated ?? true);
    if (selected?.kind === "project") return { kind: "project", input: selected.input,
      select: value => selected.select(value)?.map(child => child.kind === "empty" ? child : replace(child)) };
    return selected?.kind === "replace" ? { kind: "replace", terms: selected.terms.map(child => child.kind === "empty" ? child : replace(child)), dependencies: selected.dependencies,
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
    if (admitted === false) return [empty];
    if (admitted === true) return [value];
    const guards = transport.guardedValues.conjoin(value.guards, reference);
    return budget.failure() !== undefined ? undefined : guards === null ? [empty]
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
        if (reaches) terms.push(Object.freeze({ kind: "region", region, scope: scopes.empty, demand: term.demand, deferred: term.deferred }));
      }
      return { kind: "replace", terms };
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
      for (const store of transport.storesIn(term.region) ?? []) {
        if (!budget.step()) return undefined;
        if (term.region === term.demand) terms.push(Object.freeze({ kind: "effect", store, scope: term.scope }));
      }
      for (const invocation of transport.regions.invocationsIn(term.region) ?? []) {
        if (!budget.step()) return undefined;
        const reaches = reachability.invocation(invocation, term.demand);
        if (reaches === undefined) return undefined;
        if (!reaches) continue;
        const possible = nativeInputExecutions(invocation, term.scope, term.demand, term.deferred);
        if (possible === undefined) return undefined;
        terms.push(...possible);
        for (const callback of transport.callbackEntriesFor(invocation)) {
          if (!budget.step()) return undefined;
          if (callback.timing === "deferred" && !term.deferred) continue;
          terms.push(Object.freeze({ kind: "application", invocation, callback,
            callee: sourceStorageReference(callback.argument.actual, term.scope), scope: term.scope,
            projection: [], mode: "execution", demand: term.demand, deferred: term.deferred }));
        }
        const target = transport.invocationTargets.get(invocation);
        if (target !== undefined) terms.push(application(invocation, target, term.scope, [],
          { mode: "execution", demand: term.demand, deferred: term.deferred }));
        else if (transport.accessorTargets.has(invocation)) {
          const operation = ast.is.IsPropertyAccessExpression(invocation) ? semantics.forNode(invocation).operations.propertyAccess(invocation)
            : semantics.forNode(invocation).operations.elementAccess(invocation);
          const receiver = transport.subjectFor(operation?.receiver.expression);
          if (receiver === undefined) return undefined;
          terms.push(Object.freeze({ kind: "member", selection: Object.freeze({ kind: "access", node: invocation }), receiver: sourceStorageReference(receiver, term.scope),
            scope: term.scope, projection: [], mode: "execution", demand: term.demand, deferred: term.deferred }));
        }
      }
      return { kind: "replace", terms };
    }
    if (term.kind === "store") {
      if (term.destination.kind !== "leaf") return replaceChild(term.destination, destination => Object.freeze({ ...term, destination }), { contributes: false });
      if (term.receiver.kind !== "leaf") return replaceChild(term.receiver, receiver => Object.freeze({ ...term, receiver }));
      if (term.receiver.subject !== term.destination.subject) return absent;
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
      if (term.condition.kind !== "leaf") return replaceChild(term.condition, condition => Object.freeze({ ...term, condition }));
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
        if (selected.kind !== "resolved" || selected.implementation.declaration !== term.capture.owner)
          return { kind: "replace", terms: [] };
      }
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
          { value: reason, effect: reason }) : regions;
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
        const regions = regionsFor(candidate, term.invocation, scope, term.demand, undefined, term.deferred);
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
    const memberIndex = term.subject.projection.findIndex(sourceStorageIsMemberProjection);
    const component = term.subject.projection[memberIndex];
    if (component !== undefined && sourceStorageIsMemberProjection(component)) {
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
        const effects = readEffects(store, { kind: "general" }, scopes.isDeferred(term.scope), term.scope);
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
          const original = creator === undefined ? undefined : birth(term.subject, creator);
          if (original !== undefined && original.key === birth(term.subject, term.scope)?.key)
            terms.push(sourceStorageReference(value, effect.scope));
        }
      }
      return { kind: "replace", terms };
    }
    const parents = transport.incomingFor(term.subject);
    if (parents.size === 0 && ast.is.IsArrayLiteralExpression(node) && term.subject.projection.length !== 0 &&
      ast.elements(node).length === 0) return absent;
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
