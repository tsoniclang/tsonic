import { Node_Initializer } from "../../../source-navigation/index.js";
import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageFormalOwner, sourceStorageHasOriginalValue, sourceStorageIsMemberProjection } from "../model/subjects.js";
import { sourceStorageObjectRestOwner } from "../model/subjects.js";
import { type createSourceStorageExecutionReachability, createSourceStorageInputExecutions, walkSourceStorageExecution } from "./execution-reachability.js";
import { sourceStorageReference } from "../graph/scoped-model.js";
import type { SourceStorageActivation, SourceStorageReduction, SourceStorageScope, SourceStorageTerm, SourceStorageReference, SourceStorageInputFrontier } from "../graph/scoped-model.js";
import type { SourceStorageScopes } from "./scoped-scopes.js";
import type { SourceStorageScopedTransport } from "./scoped-transport.js";
import { sourceStorageInitializedValue, sourceStorageInputBinding, sourceStorageStoredValue } from "./scoped-transport.js";
import type { createSourceStorageEquations } from "./scoped-equations.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { sourceIndexedStorageProjection, sourceStorageAccessDeclarations, sourceStorageSubjectType, sourceStorageDynamicMemberKey } from "../model/components.js";
import { sourceStorageProjectComponents } from "../graph/component-projections.js";
import { createSourceStorageProgramEntries } from "./program-entries.js";
import { createSourceStorageMemberSuccessors } from "./scoped-member-successors.js";
import { createSourceStoragePointerValues } from "./pointer-values.js";
import { createSourceStorageScopedRejections } from "./rejections.js";
import { createSourceStorageExecutionContext } from "./execution-context.js";
import { createSourceStorageRegionSuccessors } from "./region-successors.js";
import { createSourceStorageStoreSuccessors } from "./store-successors.js";
import { createSourceStorageTransitionSuccessors } from "./transition-successors.js";
import { createSourceStorageApplicationSuccessors } from "./application-successors.js";
import { completeSourceStorageChildReduction, sourceStorageChildDependencies,
  type SourceStorageChildContext, type SourceStoragePendingReduction } from "./child-reduction.js";

export function createSourceStorageScopedSuccessors(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: SourceStorageScopedTransport, scopes: SourceStorageScopes,
  equations: ReturnType<typeof createSourceStorageEquations>,
  reachability: ReturnType<typeof createSourceStorageExecutionReachability>,
  birth: (subject: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageActivation | undefined,
  closed: (term: SourceStorageTerm) => boolean | undefined,
  readRelation: (term: SourceStorageTerm) => ReadonlySet<SourceStorageTerm> | undefined,
  initialize: (value: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageTerm | undefined,
  outside: (subject: SourceStorageSubject, scope: SourceStorageScope) => SourceStorageReference | undefined = () => undefined) {
  const { ast, navigation, semantics } = source;
  const empty: Extract<SourceStorageTerm, { readonly kind: "empty" }> = Object.freeze({ kind: "empty", absence: undefined });
  const absent: Extract<SourceStorageReduction, { readonly kind: "replace" }> = Object.freeze({
    kind: "replace", terms: Object.freeze([empty]),
  });
  const { conditionalExecutions, nativeInputExecutions } = createSourceStorageInputExecutions(source, budget, transport, scopes, reachability, readRelation);
  const programEntries = createSourceStorageProgramEntries(source, transport, scopes, reachability, budget.step);
  const { readEffects, creatorScope, leaf, symbolicInput, classLineages, instanceCaptures, application,
    dispatchDependencies, regionsFor, passiveMember, independentCalleeFor } =
    createSourceStorageExecutionContext(source, budget, transport, scopes, reachability, readRelation);
  const { member, symbolicProjection } = createSourceStorageMemberSuccessors({ source, budget, transport, scopes, reachability,
    birth, readRelation, readEffects, initialize, leaf, outside, creatorScope, passiveMember, regionsFor, application, classLineages,
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
    replace: (child: SourceStorageTerm) => SourceStorageTerm, context: SourceStorageChildContext = {}): SourceStoragePendingReduction | undefined => {
    if (child.kind === "unresolved" || child.kind === "empty")
      return sourceStorageChildDependencies({ kind: "replace", terms: [child] }, context.dependencies);
    if (child.kind === "input-frontier")
      return sourceStorageChildDependencies({ kind: "replace", terms: [replace(child)] }, context.dependencies);
    if (child.kind === "reference" || child.kind === "application" || child.kind === "member" || child.kind === "guarded") {
      const independent = closed(child);
      if (independent === undefined) return undefined;
      if (independent || context.independentCallee !== undefined)
        return materializeChild(child, value => [replace(value)], independent ? undefined : context.independentCallee);
    }
    return { kind: "child-reduction", child, replace, context };
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
  const region = createSourceStorageRegionSuccessors({ source, budget, transport, reachability,
    nativeInputExecutions, pointerValues, application, leaf });
  const store = createSourceStorageStoreSuccessors({ budget, transport, absent, birth, symbolicInput, replaceChild });
  const transition = createSourceStorageTransitionSuccessors({ source, scopes, absent, instanceCaptures, replaceChild });
  const applicationSuccessors = createSourceStorageApplicationSuccessors({ source, budget, transport, scopes, equations,
    absent, nativeInputExecutions, conditionalExecutions, rejections, replaceChild, dispatchDependencies,
    independentCalleeFor, regionsFor, classLineages, leaf });
  const reduceStep = (term: SourceStorageTerm, correlated: boolean): SourceStoragePendingReduction | undefined => {
    if (!budget.step()) return undefined;
    if (term.kind === "leaf" || term.kind === "input-frontier" || term.kind === "unresolved" || term.kind === "effect" || term.kind === "empty") return undefined;
    if (term.kind === "instantiation") return { kind: "project", inputs: [term.value], select: value => {
      const instantiated = scopes.applyTerm(value, new Map([[term.parameter, term.scope]]));
      return instantiated === undefined ? undefined : [instantiated];
    } };
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
    if (term.kind === "region") return region(term);
    if (term.kind === "store") return store(term);
    if (term.kind === "transition") return transition(term);
    if (term.kind === "pointer") return pointerValues.operation(term);
    if (term.kind === "member") return member(term, correlated);
    if (term.kind === "application") return applicationSuccessors(term);
    const initializer = term.subject.kind === "input" ? Node_Initializer(ast, term.subject.node) : undefined;
    if (term.views !== undefined && scopes.isSymbolic(Object.freeze({ ...term, kind: "leaf" })))
      return symbolicProjection(term.subject, term.scope, undefined, term.views);
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
      sourceStorageFormalOwner(term.subject, source) === term.scope.owner) return symbolicProjection(term.subject, term.scope, undefined, term.views);
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
  const reduce = (term: SourceStorageTerm, correlated = false): SourceStorageReduction | undefined =>
    completeSourceStorageChildReduction(budget, reduceStep(term, correlated), reduceStep);
  return Object.freeze({ reduce });
}
