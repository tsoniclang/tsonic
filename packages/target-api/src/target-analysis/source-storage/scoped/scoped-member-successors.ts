import { Node_Initializer, ObjectLiteralProperty_Value } from "../../../source-navigation/index.js";
import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { type SourceStorageSubject, type SourceStorageProjection, sourceStorageFormalOwner, sourceStorageIsMethodMember, sourceStorageIsMemberProjection, sourceStorageMemberSubject, sourceStorageObjectRestOwner } from "../model/subjects.js";
import type { SourceStorageStore } from "../graph/stored-values.js";
import type { createSourceStorageExecutionReachability } from "./execution-reachability.js";
import { sourceStorageReference, type SourceStorageActivation, type SourceStorageReduction, type SourceStorageScope, type SourceStorageTerm, type SourceStorageReference, type SourceStorageInputFrontier, type SourceStorageRelationWitness, type SourceStorageOperation } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageStoredValue } from "./scoped-transport.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { sourceMemberOwner } from "../../../source-navigation/class-members.js";
import { sourceStorageAccessDeclarations, sourceStorageComponentType, sourceStorageSubjectType, sourceStorageDynamicMemberKey, sourceStorageDynamicMemberDeclarations } from "../model/components.js";
import { sourceStorageProjectComponents } from "../graph/component-projections.js";
import type { sourceStorageClassLineages, SourceStorageClassValue } from "../model/construction.js";
import type { SourceStorageScopedSubject } from "../graph/scoped-model.js";
import { createSourceStoragePhysicalMembers } from "./member-selection.js";

export interface SourceStorageChildContext {
  readonly contributes?: boolean;
  readonly independentCallee?: Node;
  readonly correlated?: boolean;
}

/** A read of one store's effects from a demand, as the scoped successors select it. */
export type SourceStorageEffectSelection =
  | { readonly kind: "general"; readonly execution?: SourceStorageTerm }
  | { readonly kind: "own-construction"; readonly execution: SourceStorageTerm };

/** The scoped-successor values the member reductions read; built once by createSourceStorageScopedSuccessors. */
export interface SourceStorageMemberSuccessorContext {
  readonly source: TargetSourceProgram;
  readonly budget: SourceStorageBudget;
  readonly transport: SourceStorageScopedTransport;
  readonly scopes: SourceStorageScopes;
  readonly reachability: ReturnType<typeof createSourceStorageExecutionReachability>;
  birth(subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageActivation | undefined;
  readRelation(term: SourceStorageTerm): ReadonlySet<SourceStorageTerm> | undefined;
  pointerWrites(destination: SourceStorageReference, store: SourceStorageStore,
    projection: readonly SourceStorageProjection[], invocation: Node,
    scope: SourceStorageScope): readonly SourceStorageTerm[] | undefined;
  readEffects(store: SourceStorageStore, selection: SourceStorageEffectSelection, deferred?: boolean,
    context?: SourceStorageScope): Iterable<SourceStorageTerm>;
  leaf(subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageReference;
  outside(subject: SourceStorageSubject, scope: SourceStorageScope): SourceStorageReference | undefined;
  creatorScope(node: Node, scope: SourceStorageScope): SourceStorageScope;
  passiveMember(declaration: Node): boolean;
  regionsFor(candidate: Node, invocation: Node, scope: SourceStorageScope, demand: Node,
    construction?: { readonly caller: SourceStorageScope; readonly classes: readonly SourceStorageScopedSubject[] },
    deferred?: boolean): readonly SourceStorageTerm[] | undefined;
  application(invocation: Node, target: SourceStorageSubject, scope: SourceStorageScope,
    projection: readonly SourceStorageProjection[], operation: SourceStorageOperation): SourceStorageTerm;
  classLineages(value: SourceStorageReference, mode?: "heritage"):
    ReturnType<typeof sourceStorageClassLineages<SourceStorageClassValue<SourceStorageScope>["bindings"]>>;
  materializeChild(child: SourceStorageTerm, select: (child: SourceStorageReference | SourceStorageInputFrontier) => readonly SourceStorageTerm[] | undefined,
    independentCallee?: Node): Extract<SourceStorageReduction, { readonly kind: "project" }>;
  replaceChild(child: SourceStorageTerm, replace: (child: SourceStorageTerm) => SourceStorageTerm,
    context?: SourceStorageChildContext): SourceStorageReduction | undefined;
}

/** Member reads and symbolic projections of the scoped successors. */
export function createSourceStorageMemberSuccessors(context: SourceStorageMemberSuccessorContext) {
  const { source, budget, transport, scopes, reachability, birth, readRelation, readEffects, leaf, outside,
    creatorScope, passiveMember, regionsFor, application, classLineages, materializeChild, replaceChild } = context;
  const { ast, semantics } = source;
  const receiverFor = (store: SourceStorageStore): SourceStorageSubject | undefined => {
    if (store.kind !== "initialization") return store.receiver;
    if (store.birth !== undefined) return store.storage;
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
  const symbolicProjection = (subject: SourceStorageSubject, scope: SourceStorageScope,
    frontier?: SourceStorageInputFrontier): SourceStorageReduction | undefined => {
    const component = subject.projection[0];
    const declaration = component !== undefined && sourceStorageIsMemberProjection(component) ? component.declaration : undefined;
    const memberOwner = declaration === undefined ? undefined : sourceMemberOwner(ast, declaration);
    if (declaration !== undefined && memberOwner !== undefined &&
      (ast.is.IsClassDeclaration(memberOwner) || ast.is.IsClassExpression(memberOwner)) &&
      ast.is.IsPropertyDeclaration(declaration) && Node_Initializer(ast, declaration) !== undefined &&
      ast.hasModifierKind(declaration, "readonly")) {
      const member = sourceStorageMemberSubject(declaration, ast, transport.subject, subject.projection.slice(1));
      if (member === undefined) return undefined;
      return { kind: "replace", terms: [sourceStorageReference(member, scope)],
        witnesses: [{ subject, bindings: scope, contributes: false, observesValue: true }] };
    }
    const boundary = frontier?.input ?? outside(subject, scope);
    const terms: SourceStorageTerm[] = [boundary === undefined ? leaf(subject, scope)
      : Object.freeze({ kind: "input-frontier", input: boundary,
        preservesInput: subject === boundary.subject && frontier?.preservesInput !== false,
        subject, scope, guards: frontier?.guards })];
    const owner = sourceStorageFormalOwner(subject, source);
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
          const receiverFile = receiver === undefined ? undefined : transport.sourceFileFor(receiver);
          const receiverType = receiver === undefined ? undefined : sourceStorageSubjectType(source, receiver, receiverFile);
          if (receiver === undefined || receiverType === undefined || receiverFile === undefined) return undefined;
          const receiverSemantics = semantics.forFile(receiverFile);
          if (sourceStorageIsMemberProjection(component)) {
            const access = ast.is.IsPropertyAccessExpression(store.reference) ? semantics.forNode(store.reference).operations.propertyAccess(store.reference)
              : semantics.forNode(store.reference).operations.elementAccess(store.reference);
            const members = access === undefined ? undefined : transport.memberFlow.declarationsFor(receiver, store.storage.node, access.receiver.type);
            if (members === undefined || !members.includes(component.declaration)) continue;
          }
          const selectedType = sourceStorageComponentType(receiverType, component, receiverSemantics, ast);
          const valueType = store.value === undefined ? undefined : sourceStorageSubjectType(source, store.value, transport.sourceFileFor(store.value));
          const absent = store.value === undefined ? sourceStorageStoredValue(ast, store, undefined, scope) : undefined;
          if (selectedType === undefined || valueType === undefined && absent === undefined || store.reason !== undefined) {
            terms.push(Object.freeze({ kind: "unresolved", subject, scope,
              reason: store.reason ?? "A symbolic storage mutation requires its exact checked producer and component type." }));
            continue;
          }
          const values: SourceStorageSubject[] = [];
          if (store.value !== undefined && valueType !== undefined)
            sourceStorageProjectComponents(store.value.projection, valueType, selectedType, subject.projection.slice(index + 1),
              semantics.forNode(store.value.node), ast, budget, projection => {
                const value = transport.subject(store.value!.node, store.value!.kind, projection);
                if (value !== undefined) values.push(value);
              });
          const execution: SourceStorageTerm = Object.freeze({ kind: "region", region, scope, demand: store.region, deferred: scopes.isDeferred(scope) });
          for (const effect of readEffects(store, { kind: "general", execution })) {
            if (!budget.step()) return undefined;
            if (effect.kind === "unresolved") { terms.push(effect); continue; }
            if (effect.kind !== "effect" || effect.store !== store) continue;
            if (absent !== undefined) {
              const written = sourceStorageStoredValue(ast, store, undefined, effect.scope);
              if (written !== undefined) terms.push(Object.freeze({ kind: "store", destination: leaf(receiver, scope),
                receiver: sourceStorageReference(store.receiver, effect.scope), value: written }));
            }
            for (const value of values) terms.push(Object.freeze({ kind: "store", destination: leaf(receiver, scope),
              receiver: sourceStorageReference(store.receiver, effect.scope), value: sourceStorageReference(value, effect.scope) }));
          }
        }
      }
    }
    return { kind: "replace", terms };
  };
  const physicalMembers = createSourceStoragePhysicalMembers(source, budget, transport,
    { read: readRelation, symbolic: scopes.isSymbolic,
      lineages: value => classLineages(value, "heritage") });
  const member = (term: Extract<SourceStorageTerm, { readonly kind: "member" }>, correlated: boolean): SourceStorageReduction | undefined => {
    const access = term.selection.kind === "access" ? term.selection.node : term.selection.evaluation;
    const property = access !== undefined && ast.is.IsPropertyAccessExpression(access) ? semantics.forNode(access).operations.propertyAccess(access) : undefined;
    const selected = access === undefined ? undefined : property ?? (ast.is.IsElementAccessExpression(access)
      ? semantics.forNode(access).operations.elementAccess(access) : undefined);
    const optional = access !== undefined && (ast.is.IsPropertyAccessExpression(access)
      ? ast.as.AsPropertyAccessExpression(access)?.QuestionDotToken !== undefined
      : ast.is.IsElementAccessExpression(access) && ast.as.AsElementAccessExpression(access)?.QuestionDotToken !== undefined);
    if (optional && (term.receiver.kind === "leaf" || term.receiver.kind === "input-frontier")) {
      const type = sourceStorageSubjectType(source, term.receiver.subject, transport.sourceFileFor(term.receiver.subject));
      const types = semantics.forNode(term.receiver.subject.node).types;
      if (type !== undefined && (types.isNullish(type) || types.isVoidLike(type)))
        return { kind: "replace", terms: [Object.freeze({ kind: "empty",
          absence: sourceStorageReference(term.receiver.subject, term.receiver.scope) })] };
    }
    let selections = term.selection.kind === "projection" ? [{ target: term.selection.declaration, read: true }]
      : access === undefined ? undefined : term.mode === "execution" ? [
        ...(sourceStorageAccessDeclarations(source, access, "read") ?? []).map(target => ({ target, read: true })),
        ...(sourceStorageAccessDeclarations(source, access, "write") ?? []).map(target => ({ target, read: false })),
      ] : sourceStorageAccessDeclarations(source, access, "read")?.map(target => ({ target, read: true }));
    let declarations = selections?.map(selection => selection.target);
    let receiverType = term.selection.kind === "projection"
      ? sourceStorageSubjectType(source, term.selection.subject, transport.sourceFileFor(term.selection.subject)) : selected?.receiver.type;
    let receiverView = term.selection.kind === "projection" ? term.selection.subject : transport.subjectFor(selected?.receiver.expression);
    const dynamicKey = access === undefined || term.selection.kind !== "access" || (declarations?.length ?? 0) !== 0
      ? undefined : sourceStorageDynamicMemberKey(source, access);
    if (dynamicKey !== undefined) {
      if (term.receiver.kind !== "leaf" && term.receiver.kind !== "input-frontier") return materializeChild(term.receiver, receiver =>
        [Object.freeze({ ...term, receiver })]);
      receiverView = term.receiver.subject;
      const read = term.mode !== "execution" || selected?.accessMode !== "write"
        ? sourceStorageDynamicMemberDeclarations(source, receiverView, dynamicKey, "read", budget.step) : undefined;
      const write = term.mode === "execution" && selected?.accessMode !== "read"
        ? sourceStorageDynamicMemberDeclarations(source, receiverView, dynamicKey, "write", budget.step) : undefined;
      if (read === undefined && write === undefined) {
        const subject = transport.subject(access, "value", term.projection);
        return subject === undefined ? undefined : { kind: "replace", terms: [Object.freeze({ kind: "unresolved",
          subject, scope: term.scope, reason: "A dynamic source member requires its actual checked receiver and physical declaration." })] };
      }
      receiverType = read?.type ?? write?.type;
      selections = [...(read?.declarations ?? []).map(target => ({ target, read: true })),
        ...(write?.declarations ?? []).map(target => ({ target, read: false }))];
      declarations = selections.map(selection => selection.target);
    }
    if (receiverType === undefined || receiverView === undefined || declarations === undefined || declarations.length === 0) {
      budget.reject("Source storage member reads require their exact checked declaration and receiver."); return undefined;
    }
    if (term.receiver.kind !== "leaf" && term.receiver.kind !== "input-frontier") {
      const replace = (receiver: SourceStorageTerm): SourceStorageTerm =>
        receiver === term.receiver ? term : Object.freeze({ ...term, receiver });
      return !correlated && term.mode === "value" && declarations.every(passiveMember)
        ? materializeChild(term.receiver, receiver => [replace(receiver)]) : replaceChild(term.receiver, replace, { contributes: false });
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
    const originals: SourceStorageScopedSubject[] = [];
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
      if (members.absent) terms.push(Object.freeze({ kind: "empty",
        absence: sourceStorageReference(term.receiver.subject, term.receiver.scope) }));
      if (members.excluded) terms.push(Object.freeze({ kind: "empty", absence: undefined }));
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
      const storageKind = transport.memberFlow.memberStorageKindFor(term.receiver.subject, original, receiverType);
      if (storageKind === undefined) {
        terms.push(Object.freeze({ kind: "unresolved", subject: captured.subject, scope: captured.bindings,
          reason: budget.failure() ?? "Source members require exact checked physical copy correspondence." }));
        continue;
      }
      const copied = storageKind === "copied";
      const subject = copied ? transport.subject(term.receiver.subject.node, term.receiver.subject.kind, [...term.receiver.subject.projection, {
        kind: sourceStorageIsMethodMember(original, ast) ? "method-value" : "member", declaration: original,
      }, ...term.projection]) : sourceStorageMemberSubject(original, ast, transport.subject, term.projection);
      if (subject === undefined) return undefined;
      if (copied) {
        terms.push(Object.freeze({ ...term, selection: Object.freeze({ kind: "projection", subject: receiverView,
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
      if (storageKind === "absent") terms.push(Object.freeze({ kind: "empty",
        absence: sourceStorageReference(term.receiver.subject, term.receiver.scope) }));
      if (term.receiver.kind === "input-frontier" || scopes.isSymbolic(term.receiver)) {
        if (prototype) continue;
        const projected = transport.subject(term.receiver.subject.node, term.receiver.subject.kind,
          [...term.receiver.subject.projection, { kind: sourceStorageIsMethodMember(original, ast) ? "method-value" : "member",
            declaration: original }, ...term.projection]);
        if (projected === undefined) return undefined;
        const selected = symbolicProjection(projected, term.receiver.scope,
          term.receiver.kind === "input-frontier" ? term.receiver : undefined);
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
      if (!copied) {
        const bindings = owner !== undefined && (ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner)) &&
          ast.is.IsNewExpression(term.receiver.subject.node)
          ? scopes.frameFor(owner, term.receiver.subject.node, term.receiver.scope, captured.bindings) : term.receiver.scope;
        if (bindings === undefined) return undefined;
        witnesses.push(Object.freeze({ subject, bindings, contributes: true, observesValue: true }));
      }
      const stores = transport.storedValuesFor(subject);
      // An unbound external receiver keeps its symbolic member value; stored writes of the member still apply.
      const unboundReceiver = (term.receiver.subject.kind === "input" || term.receiver.subject.kind === "receiver") &&
        scopes.lookup(term.receiver.subject, term.receiver.scope) === undefined;
      if (unboundReceiver) terms.push(sourceStorageReference(subject, term.receiver.scope));
      if (unboundReceiver && stores === undefined) continue;
      if (stores === undefined) {
        if (!copied && !prototype && storageKind !== "absent") terms.push(ast.is.IsMethodDeclaration(original) && ast.body(original) !== undefined
          ? leaf(subject, creatorScope(original, captured.bindings)) : sourceStorageReference(subject, term.receiver.scope));
        continue;
      }
      if (!copied && !prototype && ast.is.IsMethodDeclaration(original) && ast.body(original) !== undefined)
        terms.push(leaf(subject, creatorScope(original, captured.bindings)));
      for (const { store, value } of stores) {
        if (!budget.step()) return undefined;
        if (store.reason !== undefined) continue;
        if (store.destination === "pointer") {
          const projected = transport.subject(term.receiver.subject.node, term.receiver.subject.kind,
            [...term.receiver.subject.projection, { kind: "member", declaration: original }]);
          const written = projected === undefined ? undefined : context.pointerWrites(
            leaf(projected, term.receiver.scope), store, term.projection, original, term.scope);
          if (written === undefined) return undefined;
          terms.push(...written); continue;
        }
        if (value === undefined && sourceStorageStoredValue(ast, store, undefined, term.scope) === undefined) continue;
        const receiver = receiverFor(store);
        if (receiver === undefined) { budget.reject("Source storage physical members require exact initialized or mutated receivers."); return undefined; }
        const initialized = value === undefined ? undefined : initializationScope(store, receiver, term.receiver);
        if (initialized !== undefined && value !== undefined) {
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
          const written = sourceStorageStoredValue(ast, store, value, effect.scope);
          if (written === undefined) continue;
          if (selection.kind === "own-construction") {
            terms.push(written);
            continue;
          }
          const destination: SourceStorageTerm = store.destination === "element"
            ? Object.freeze({ ...term, projection: term.projection.slice(0, store.storage.projection.length - 1) }) : term.receiver;
          terms.push(Object.freeze({ kind: "store", destination,
            receiver: sourceStorageReference(receiver, effect.scope), value: written }));
        }
      }
    }
    return { kind: "replace", terms, witnesses };
  };
  return Object.freeze({ member, symbolicProjection });
}
