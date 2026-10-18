import { Node_Expression, Node_Initializer, ObjectLiteralProperty_Value } from "../../../source-navigation/index.js";
import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageProjection } from "../model/subjects.js";
import { sourceStorageFormalOwner, sourceStorageHasOriginalValue, sourceStorageIsDataMember, sourceStorageIsMethodMember,
  sourceStorageIsMemberProjection, sourceStorageMemberSubject } from "../model/subjects.js";
import { sourceStorageObjectRestOwner } from "../model/subjects.js";
import type { SourceStorageStore } from "../graph/stored-values.js";
import { createSourceStorageExecutionReachability, createSourceStorageInputExecutions, walkSourceStorageExecution } from "./execution-reachability.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import type { SourceStorageActivation, SourceStorageReduction, SourceStorageScope, SourceStorageTerm, SourceStorageReference, SourceStorageRelationWitness,
  SourceStorageOperation, SourceStorageVariable } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageInitializedValue, sourceStorageInputBinding } from "./scoped-transport.js";
import type { createSourceStorageEquations } from "./scoped-equations.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { sourceMemberOwner } from "../../../source-navigation/class-members.js";
import { sourceStorageAccessDeclarations, sourceStorageComponentType, sourceStorageSubjectType } from "../model/components.js";
import { sourceStorageProjectComponents } from "../graph/component-projections.js";
import { sourceStorageClassLineages, sourceStorageInstanceCaptures, sourceStorageAllocations,
  sourceStorageInstanceInitializers, sourceStorageSuperConstructor } from "../model/construction.js";
import type { SourceStorageBoundSubject } from "./substitutions.js";
import { createSourceStoragePhysicalMembers } from "./member-selection.js";

interface SourceStorageChildContext {
  readonly contributes?: boolean;
  readonly independentCallee?: Node;
  readonly correlated?: boolean;
}

export function createSourceStorageScopedSuccessors(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes,
  equations: ReturnType<typeof createSourceStorageEquations>,
  birth: (subject: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageActivation | undefined,
  closed: (term: SourceStorageTerm) => boolean | undefined,
  readRelation: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined) {
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
  const readEffects = function* (store: SourceStorageStore, selection:
    | { readonly kind: "general"; readonly execution?: SourceStorageTerm }
    | { readonly kind: "own-construction"; readonly execution: SourceStorageTerm }, deferred = false, context?: SourceStorageScope) {
    const roots = context === undefined || selection.execution !== undefined ? [] : scopes.executionRoots(context);
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
    nativeConstructorsFor: transport.nativeConstructorsFor,
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
          const selectedType = sourceStorageComponentType(receiverType, component, context, ast);
          const valueType = store.value === undefined ? undefined : sourceStorageSubjectType(source, store.value);
          if (selectedType === undefined || valueType === undefined || store.reason !== undefined) {
            terms.push(Object.freeze({ kind: "unresolved", subject, scope,
              reason: store.reason ?? "A symbolic storage mutation requires its exact checked producer and component type." }));
            continue;
          }
          const values: SourceStorageSubject[] = [];
          sourceStorageProjectComponents(store.value!.projection, valueType, selectedType, subject.projection.slice(index + 1),
            semantics.forNode(store.value!.node), ast, budget, projection => {
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
  const physicalMembers = createSourceStoragePhysicalMembers(source, budget, transport,
    { read: readRelation, symbolic: scopes.isSymbolic, lineages: value => classLineages(value, "heritage") });
  const member = (term: Extract<SourceStorageTerm, { readonly kind: "member" }>, correlated: boolean): SourceStorageReduction | undefined => {
    const access = term.selection.kind === "access" ? term.selection.node : term.selection.evaluation;
    const property = access !== undefined && ast.is.IsPropertyAccessExpression(access) ? semantics.forNode(access).operations.propertyAccess(access) : undefined;
    const selected = access === undefined ? undefined : property ?? (ast.is.IsElementAccessExpression(access)
      ? semantics.forNode(access).operations.elementAccess(access) : undefined);
    const selections = term.selection.kind === "projection" ? [{ target: term.selection.declaration, read: true }]
      : access === undefined ? undefined : term.mode === "execution" ? [
        ...(sourceStorageAccessDeclarations(source, access, "read") ?? []).map(target => ({ target, read: true })),
        ...(sourceStorageAccessDeclarations(source, access, "write") ?? []).map(target => ({ target, read: false })),
      ] : sourceStorageAccessDeclarations(source, access, "read")?.map(target => ({ target, read: true }));
    const declarations = selections?.map(selection => selection.target);
    const receiverType = term.selection.kind === "projection" ? sourceStorageSubjectType(source, term.selection.subject) : selected?.receiver.type;
    const receiverView = term.selection.kind === "projection" ? term.selection.subject : transport.subjectFor(selected?.receiver.expression);
    if (receiverType === undefined || receiverView === undefined || declarations === undefined || declarations.length === 0) {
      budget.reject("Source storage member reads require their exact checked declaration and receiver."); return undefined;
    }
    if (term.receiver.kind !== "leaf") {
      const replace = (receiver: SourceStorageTerm): SourceStorageTerm => Object.freeze({ ...term, receiver });
      return !correlated && term.mode === "value" && declarations.every(passiveMember)
        ? materializeChild(term.receiver, receiver => [replace(receiver)]) : replaceChild(term.receiver, replace);
    }
    if (term.selection.kind === "projection" && term.selection.before !== undefined) {
      const before = term.selection.before;
      const selection = term.selection;
      const receiver = term.receiver;
      const contribution = transport.memberFlow.copyContributionFor(receiver.subject, term.selection.declaration, receiverType, before);
      if (contribution === undefined) return { kind: "replace", terms: [Object.freeze({ kind: "unresolved",
        subject: selection.subject, scope: receiver.scope,
        reason: "Copied source storage requires its exact ordered own component and original creation binding." })] };
      if (contribution.kind === "absent") return { kind: "replace", terms: [Object.freeze({ kind: "empty",
        absence: sourceStorageReference(selection.subject, receiver.scope) })] };
      if (contribution.kind === "own") {
        const original = contribution.declaration;
        if (ast.is.IsMethodDeclaration(original)) {
          const subject = transport.subject(original);
          return subject === undefined ? undefined : { kind: "replace", terms: [leaf(subject, creatorScope(original, receiver.scope))] };
        }
        if (ast.is.IsGetAccessorDeclaration(original) || ast.is.IsSetAccessorDeclaration(original)) return member(Object.freeze({ ...term,
          selection: Object.freeze({ ...selection, declaration: original, before: undefined }) }), correlated);
        const value = transport.subjectFor(ObjectLiteralProperty_Value(ast, original));
        const projected = value === undefined ? undefined : transport.subject(value.node, value.kind, [...value.projection, ...term.projection]);
        return projected === undefined ? undefined : { kind: "replace", terms: [sourceStorageReference(projected, receiver.scope)] };
      }
      const value = transport.subjectFor(contribution.expression);
      if (value === undefined) return undefined;
      const inputs: SourceStorageTerm[] = [];
      for (const component of contribution.components) {
        if (!budget.step() || !sourceStorageIsMemberProjection(component)) return undefined;
        inputs.push(Object.freeze({ kind: "member", selection: Object.freeze({ kind: "projection", subject: value,
          declaration: component.declaration, evaluation: contribution.evaluation, before: undefined }),
          receiver: sourceStorageReference(value, receiver.scope), scope: receiver.scope, projection: term.projection, mode: "value" }));
      }
      return { kind: "project", inputs, select: value => value.kind !== "empty" || value.absence === undefined ? [value]
        : [Object.freeze({ ...term, selection: Object.freeze({ ...selection, before: contribution.evaluation }) })] };
    }
    const originals: SourceStorageBoundSubject[] = [];
    const terms: SourceStorageTerm[] = [];
    for (const { target, read } of selections ?? []) {
      if (!budget.step()) return undefined;
      if (target === undefined) continue;
      const members = physicalMembers(term.receiver, target, receiverType, read ? "read" : "write", receiverView);
      if (members === undefined) return undefined;
      if (members.kind === "pending") continue;
      if (members.reason !== undefined) {
        if (budget.failure() !== undefined) return undefined;
        const subject = term.selection.kind === "projection" ? term.selection.subject : transport.subject(term.selection.node, "value", term.projection);
        if (subject === undefined) return undefined;
        terms.push(Object.freeze({ kind: "unresolved", subject, scope: term.scope, reason: members.reason }));
      }
      if (members.absent) terms.push(Object.freeze({ kind: "empty", absence: term.receiver }));
      for (const member of members.members) {
        if (!budget.step()) return undefined;
        const getter = ast.is.IsGetAccessorDeclaration(member.subject.node);
        const setter = ast.is.IsSetAccessorDeclaration(member.subject.node);
        if (term.mode === "execution" && !getter && !setter) continue;
        if (!originals.some(previous => previous.subject === member.subject && previous.bindings === member.bindings)) originals.push(member);
      }
    }
    const witnesses: SourceStorageRelationWitness[] = [];
    for (const captured of originals) {
      if (!budget.step()) return undefined;
      const original = captured.subject.node;
      const copied = sourceStorageObjectRestOwner(term.receiver.subject.node, ast) !== undefined || ast.is.IsObjectLiteralExpression(term.receiver.subject.node) &&
        ast.parent(original) !== term.receiver.subject.node;
      const subject = copied ? transport.subject(term.receiver.subject.node, term.receiver.subject.kind, [...term.receiver.subject.projection, {
        kind: sourceStorageIsMethodMember(original, ast) ? "method-value" : "member", declaration: original,
      }, ...term.projection]) : sourceStorageMemberSubject(original, ast, transport.subject, term.projection);
      if (subject === undefined) return undefined;
      if (copied) {
        terms.push(Object.freeze({ ...term, selection: Object.freeze({ kind: "projection", subject: term.receiver.subject,
          declaration: original, evaluation: access, before: term.receiver.subject.node }) }));
      }
      const owner = sourceMemberOwner(ast, original);
      const prototype = term.selection.kind === "projection" && term.selection.evaluation !== undefined &&
        (ast.is.IsSpreadAssignment(term.selection.evaluation) || sourceStorageObjectRestOwner(term.selection.evaluation, ast) !== undefined) && owner !== undefined &&
        (ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner)) &&
        (ast.is.IsMethodDeclaration(original) || ast.is.IsGetAccessorDeclaration(original) || ast.is.IsSetAccessorDeclaration(original));
      if (prototype) {
        const absent = transport.subject(term.receiver.subject.node, term.receiver.subject.kind, [...term.receiver.subject.projection, {
          kind: sourceStorageIsMethodMember(original, ast) ? "method-value" : "member", declaration: original,
        }, ...term.projection]);
        if (absent === undefined) return undefined;
        terms.push(Object.freeze({ kind: "empty", absence: sourceStorageReference(absent, term.receiver.scope) }));
      }
      if (scopes.isSymbolic(term.receiver)) {
        if (prototype) continue;
        const projected = transport.subject(term.receiver.subject.node, term.receiver.subject.kind,
          [...term.receiver.subject.projection, { kind: sourceStorageIsMethodMember(original, ast) ? "method-value" : "member",
            declaration: original }, ...term.projection]);
        if (projected === undefined) return undefined;
        const selected = symbolicProjection(projected, term.receiver.scope);
        if (selected?.kind !== "replace") return selected;
        terms.push(...selected.terms);
        continue;
      }
      if (!copied && (ast.is.IsGetAccessorDeclaration(original) || ast.is.IsSetAccessorDeclaration(original))) {
        if (prototype) continue;
        const targets = access === undefined ? undefined : transport.accessorTargets.get(access)?.filter(target => target.declaration === original);
        if (access === undefined || targets === undefined || targets.length === 0) {
          terms.push(Object.freeze({ kind: "unresolved", subject, scope: term.scope,
            reason: "A projected storage member requires its original checked accessor evaluation." }));
          continue;
        }
        const allocation = birth(term.receiver.subject, term.receiver.scope);
        if (allocation === undefined) return undefined;
        let matched = false;
        const uncertain: Extract<SourceStorageTerm, { readonly kind: "unresolved" }>[] = [];
        for (const target of targets) {
          if (!budget.step()) return undefined;
          const receiver = transport.subjectFor(target.receiver);
          const values = receiver === undefined ? undefined : readRelation(sourceStorageReference(receiver, term.scope));
          if (values === undefined) return undefined;
          for (const value of values) {
            if (!budget.step()) return undefined;
            if (value.kind === "unresolved") { uncertain.push(value); continue; }
            if (value.kind !== "leaf" || value.subject !== term.receiver.subject) continue;
            const selected = birth(value.subject, value.scope);
            if (selected === undefined) return undefined;
            matched ||= selected.key === allocation.key;
          }
        }
        if (!matched) {
          terms.push(...uncertain);
          continue;
        }
        const scope = scopes.frameFor(original, access, term.scope, captured.bindings);
        const result = transport.subject(original, "return", term.projection);
        if (scope === undefined || result === undefined) return undefined;
        if (term.mode === "execution") {
          const regions = regionsFor(original, access, scope, term.demand, undefined, term.deferred);
          if (regions === undefined) return undefined;
          terms.push(...regions);
        } else terms.push(sourceStorageReference(result, scope));
        continue;
      }
      if (!copied) witnesses.push(Object.freeze({ subject, bindings: term.receiver.scope, contributes: true }));
      const stores = transport.storedValuesFor(subject);
      if ((term.receiver.subject.kind === "input" || term.receiver.subject.kind === "receiver") &&
        scopes.lookup(term.receiver.subject, term.receiver.scope) === undefined) {
        terms.push(sourceStorageReference(subject, term.receiver.scope)); continue;
      }
      if (stores === undefined) {
        if (!copied && !prototype) terms.push(ast.is.IsMethodDeclaration(original) && ast.body(original) !== undefined
          ? leaf(subject, creatorScope(original, captured.bindings)) : sourceStorageReference(subject, term.receiver.scope));
        continue;
      }
      if (!copied && !prototype && ast.is.IsMethodDeclaration(original) && ast.body(original) !== undefined)
        terms.push(leaf(subject, creatorScope(original, captured.bindings)));
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
    independentCallee?: Node): Extract<SourceStorageReduction, { readonly kind: "project" }> => ({ kind: "project", inputs: [child], select: value => {
      if (value.kind === "empty") return [value];
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
    if (selected?.kind === "project") return { kind: "project", inputs: selected.inputs,
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
          { value: reason, effect: reason }, true) : regions;
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
        const owner = sourceStorageFormalOwner(term.callee.subject, ast);
        const native = owner === undefined ? undefined : scopes.boundActivation(term.callee.scope, owner)?.nativeEntry;
        if (term.mode === "execution" && native !== undefined) {
          const possible = nativeInputExecutions(term.invocation, term.scope, term.demand, term.deferred);
          return possible === undefined ? undefined : { kind: "replace", terms: possible, dependencies };
        }
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
    const initializer = term.subject.kind === "input" ? Node_Initializer(ast, term.subject.node) : undefined;
    const bound = term.subject.kind === "input" ? sourceStorageInputBinding(source, budget, transport, scopes, term, initializer)
      : scopes.lookup(term.subject, term.scope);
    if (bound !== undefined) return bound;
    if (term.scope.kind === "frame" && term.scope.boundary === "declaration" &&
      sourceStorageFormalOwner(term.subject, ast) === term.scope.owner) return symbolicProjection(term.subject, term.scope);
    const node = term.subject.node;
    const bindingPattern = ast.is.IsBindingElement(node) ? ast.parent(node) : undefined;
    if (bindingPattern !== undefined && ast.is.IsObjectBindingPattern(bindingPattern) &&
      sourceStorageObjectRestOwner(node, ast) === undefined && term.subject.projection.length === 0) {
      const values: SourceStorageTerm[] = [];
      for (const input of transport.incomingFor(term.subject)) {
        if (!budget.step()) return undefined;
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
      (ast.is.IsVariableDeclaration(node) || ast.is.IsBindingElement(node));
    if (!storedBinding && term.subject.kind === "value" && term.subject.projection.length !== 0 &&
      (ast.is.IsVariableDeclaration(node) || ast.is.IsIdentifier(node) || ast.is.IsBindingElement(node))) {
      const root = transport.subject(node, term.subject.kind);
      return root === undefined ? undefined : materializeChild(sourceStorageReference(root, term.scope), value => {
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
      if (selected !== undefined && declarations !== undefined && declarations.length !== 0) {
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
    if (stores !== undefined) {
      const terms: SourceStorageTerm[] = [];
      for (const input of transport.incomingFor(term.subject)) {
        if (!budget.step()) return undefined;
        if (input.kind === "input" && input.node === node || ast.is.IsArrayLiteralExpression(node) && term.subject.projection.length !== 0)
          terms.push(sourceStorageReference(input, term.scope));
      }
      for (const { store, value } of stores) {
        if (!budget.step()) return undefined;
        if (store.reason !== undefined) continue;
        if (value === undefined) continue;
        if (store.kind === "initialization") {
          const creator = creatorScope(store.storage.node, term.scope);
          terms.push(store.birth !== undefined && value === store.storage ? leaf(value, creator)
            : sourceStorageReference(value, creator));
          continue;
        }
        if (store.destination === "member" && term.scope === scopes.empty) {
          terms.push(sourceStorageReference(value, scopes.empty)); continue;
        }
        const region = transport.regions.enclosing(node);
        const owner = region === undefined ? undefined : sourceStorageRegionOwner(ast, region);
        const local = (store.destination === "binding" || store.destination === "element") && store.region === region
          ? owner === undefined || term.scope === scopes.empty ? scopes.empty : scopes.owningScope(term.scope, owner) : undefined;
        if (local !== undefined) {
          if (store.destination === "element") {
            const container = transport.subject(term.subject.node, term.subject.kind,
              term.subject.projection.slice(0, store.storage.projection.length - 1));
            if (container === undefined || store.receiver === undefined) return undefined;
            terms.push(Object.freeze({ kind: "store", destination: sourceStorageReference(container, term.scope),
              receiver: sourceStorageReference(store.receiver, local), value: sourceStorageReference(value, local) }));
          } else terms.push(sourceStorageReference(value, local));
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
    if (parents.size === 0 && ast.is.IsArrayLiteralExpression(node) && term.subject.projection.length !== 0) {
      const elements = ast.elements(node);
      const component = term.subject.projection[0];
      if (component?.kind === "tuple-element" && term.subject.projection.length === 1 &&
        !elements.some(element => element !== undefined && ast.is.IsSpreadElement(element)) &&
        (elements[component.index] === undefined || ast.is.IsOmittedExpression(elements[component.index])))
        return { kind: "replace", terms: [Object.freeze({ kind: "empty", absence: sourceStorageReference(term.subject, term.scope) })] };
      if (elements.length === 0) return absent;
    }
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
