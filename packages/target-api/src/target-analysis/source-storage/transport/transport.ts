import { createSourceStorageCallbackInputFrontiers } from "./callback-input-frontiers.js";
import { createSourceStoragePointerBackings } from "./pointer-backings.js";
import { createSourceStorageGeneratorResumes } from "./generator-resumes.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import { pointerOperationFactKey } from "@tsonic/tsts";
import { sourceStorageHasOriginalValue, sourceStorageIsDataMember, sourceStorageIsMethodMember, sourceStorageIsMemberProjection, sourceStorageMemberSubject, sourceStorageObjectRestOwner } from "../model/subjects.js";
import { Node_Expression, Node_Initializer, ObjectLiteralProperty_Value, sourceReceiverOwner } from "../../../source-navigation/index.js";
import { createSourceStorageContextInputs } from "../scoped/context-inputs.js";
import { createSourceStorageContextLocations } from "../graph/context-locations.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { createSourceStorageSubjects, type SourceStorageSubject } from "../model/subjects.js";
import { createSourceStorageProjectionFlow } from "../model/projections.js";
import { createSourceStorageStructuralFlow } from "../model/structural-flow.js";
import { createSourceStorageEdges } from "../graph/edges.js";
import type { SourceStorageEdgeTypes } from "../graph/edges.js";
import { createSourceStorageExecutionRegions } from "../graph/execution-regions.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { sourceStorageClassLineages } from "../model/construction.js";
import { sourceConstructionExpression } from "../../../source-navigation/class-initialization.js";
import { createSourceStorageUnresolvedQueries } from "../graph/unresolved.js";
import { createSourceStorageSubstitutions, sourceStorageMissingProducerReason } from "../scoped/substitutions.js";
import { createSourceStorageBindingInputs } from "../scoped/scoped-transport.js";
import { createSourceStorageInvocationResults } from "./invocation-results.js";
import { createSourceStorageInvocationInputs, createSourceStorageInvocationOrigins, sourceStorageInvocationInputSelection, sourceStorageSelectedInputSlots, sourceStorageNativeCallablePayloads, sourceStorageInvocationArgumentAbsence } from "../graph/invocation-inputs.js";
import type { SourceStorageInvocationSelectionKey, SourceStorageInvocationInputSelectionQuery } from "../graph/invocation-inputs.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageArgumentTransport, SourceStorageBoundary, SourceStorageCallEffect, SourceStorageEffects, SourceStorageCallbackEntry, SourceStorageInvocationInputSlots } from "../model/types.js";
import { sourceMemberOwner } from "../../../source-navigation/class-members.js";
import { sourceDeclarationAmbientContext } from "../../../source-navigation/declaration-context.js";
import { createSourceStorageMemberFlow, createSourceStorageMemberImplementations } from "../graph/member-flow.js";
import { createSourceStorageStoredValues, createSourceStorageFormalMemberWrites, type SourceStorageWrite } from "../graph/stored-values.js";
import { createSourceStorageStoreProjections } from "../graph/store-projections.js";
import { createSourceStorageGraphQueries, type SourceStorageReconciliation } from "../graph/graph-queries.js";
import { sourceBindingWriteAtReference } from "../../../source-navigation/references-usage.js";
import { createSourceStorageAncestorQuery } from "../graph/ancestors.js";
import { createSourceStorageGuardedValues } from "../graph/guarded-values.js";
import { sourceStorageAccessDeclarations, sourceStorageSubjectType, sourceStorageDynamicMemberKey, sourceStorageDynamicMemberDeclarations } from "../model/components.js";
import { createSourceStorageMutationDestinations } from "./mutation-destinations.js";
import { sourceStorageProjectComponents } from "../graph/component-projections.js";
import { createSourceStorageMemberAccessors } from "../scoped/member-accessors.js";
import { createSourceStorageSyntaxCollection } from "./syntax-collection.js";
import { createSourceStorageRejections } from "./rejections.js";

export function createSourceStorageTransport(
  source: TargetSourceProgram,
  sourceFiles: readonly SourceFile[],
  budget: SourceStorageBudget,
  effects: SourceStorageEffects = {},
) {
  const { ast, navigation, semantics } = source;
  const guardedValues = createSourceStorageGuardedValues(source, budget, expression => classLineagesFor(expression));
  const subjects = new Map<Node, SourceStorageSubject>();
  const identities = new Set<SourceStorageSubject>();
  const mutationOwners = new Map<Node, SourceStorageSubject>();
  const invocations = new Set<Node>();
  const pointerInvocations = new Set<Node>();
  const invocationEffects = new Map<Node, SourceStorageCallEffect>();
  const invocationTargets = new Map<Node, SourceStorageSubject>();
  const invocationArguments = new Map<Node, readonly Node[]>();
  const invocationDeclarations = new Map<Node, Node>();
  const argumentTransports = new Map<Node, readonly SourceStorageArgumentTransport[]>();
  const callbackEntries = new Map<Node, readonly SourceStorageCallbackEntry[]>();
  const checkedSourceFiles = new Map<Node, SourceFile>();
  const nativeConstructors = new Map<Node, readonly Node[] | null>();
  const nativeConstructorRows = budget.createRows();
  const unresolvedInvocations = new Map<Node, string>();
  const memberImplementations = new Map<Node, Set<Node>>();
  const thrownOrigins = new Map<Node, Set<SourceStorageSubject>>();
  const unresolvedThrows = new Map<Node, string>();
  const unresolvedSubjects = new Map<SourceStorageSubject, string>();
  const visitedNodes: Node[] = [];
  const callableDeclarations: Node[] = [];
  const callableDeclarationRows = budget.createRows();
  const admittedAmbient = new Map<Node, { readonly ambient: boolean; collected: boolean }>();
  const declarationIsAmbient = (declaration: Node): boolean | undefined =>
    budget.step() ? admittedAmbient.get(declaration)?.ambient : undefined;
  const retainAmbientContext = (node: Node): boolean => budget.withRows(temporary => {
    const pending: Node[] = [];
    let current: Node | undefined = node;
    while (current !== undefined && !admittedAmbient.has(current)) {
      if (!budget.step() || !temporary.add(1)) return false;
      pending.push(current);
      current = ast.parent(current);
    }
    let ambient = current === undefined ? false : admittedAmbient.get(current)!.ambient;
    while (pending.length !== 0) {
      if (!budget.node()) return false;
      const selected = pending.pop()!;
      ambient = sourceDeclarationAmbientContext(ast, selected, ambient);
      admittedAmbient.set(selected, { ambient, collected: false });
    }
    return budget.failure() === undefined;
  });
  let sealed = false;
  const internSubject = createSourceStorageSubjects(budget.subject, budget.reject);
  const subject: typeof internSubject = (node, kind, projection) => {
    const selectedKind = kind ?? (node !== undefined && !ast.is.IsParameterDeclaration(node) && sourceStorageIsDataMember(node, ast) ? "member" : "value");
    const selected = internSubject(node, selectedKind, projection);
    if (selected !== undefined) identities.add(selected);
    return selected;
  };
  const step = budget.step;
  const retainCheckedContext = (node: Node, sourceFile: SourceFile): boolean => {
    if (!semantics.includes(sourceFile)) return false;
    const file = ast.getSourceFile(node);
    if (!sealed && file !== undefined && !retainAmbientContext(node)) return false;
    if (file !== undefined && semantics.includes(file) || checkedSourceFiles.has(node)) return true;
    if (!budget.row()) return false;
    checkedSourceFiles.set(node, sourceFile);
    return true;
  };
  const sourceFileFor = (subject: SourceStorageSubject): SourceFile | undefined =>
    checkedSourceFiles.get(subject.node) ?? ast.getSourceFile(subject.node);
  const nativeConstructorsFor = (subject: SourceStorageSubject): readonly Node[] | undefined =>
    subject.kind === "value" && subject.projection.length === 0 ? nativeConstructors.get(subject.node) ?? undefined : undefined;
  const graphQueries = createSourceStorageGraphQueries(budget);
  const edges = createSourceStorageEdges(source, budget, subject, sourceFileFor);
  const incomingFor: typeof edges.incomingFor = selected => {
    graphQueries.read(selected);
    return edges.incomingFor(selected);
  };
  const enclosingCallable = (node: Node): Node | undefined => {
    for (let current = ast.parent(node); current !== undefined && step(); current = ast.parent(current)) {
      if (ast.is.IsFunctionDeclaration(current) || ast.is.IsFunctionExpression(current) ||
        ast.is.IsArrowFunction(current) || ast.is.IsMethodDeclaration(current) ||
        ast.is.IsGetAccessorDeclaration(current) || ast.is.IsSetAccessorDeclaration(current) ||
        ast.is.IsConstructorDeclaration(current)) return current;
    }
    return undefined;
  };
  const receiverFor = (node: Node): SourceStorageSubject | undefined => {
    const owner = sourceReceiverOwner(node, ast, "storage", step);
    return owner === undefined ? undefined : subject(owner, "receiver");
  };
  const valueWrapper = (node: Node): boolean => {
    if (ast.is.IsParenthesizedExpression(node) || ast.is.IsAsExpression(node) || ast.is.IsSatisfiesExpression(node) ||
      ast.is.IsNonNullExpression(node) || ast.is.IsTypeAssertion(node)) return true;
    if (!ast.is.IsSpreadElement(node)) return false;
    const parent = ast.parent(node);
    return parent !== undefined && (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) &&
      ast.arguments(parent).includes(node);
  };
  const valueSubjectFor = (node: Node): SourceStorageSubject | undefined => {
    if (!step()) return undefined;
    const cached = subjects.get(node);
    if (cached !== undefined) return cached;
    if (ast.is.IsBindingElement(node) && ast.name(node) === undefined) return undefined;
    if (ast.kindName(node) === "KindThisKeyword") {
      const receiver = receiverFor(node);
      const value = receiver === undefined ? undefined : subject(node);
      if (value !== undefined) subjects.set(node, value);
      connect(receiver, value);
      return value;
    }
    if (ast.is.IsElementAccessExpression(node)) {
      const indexed = projections.indexed(node);
      const value = indexed === undefined ? undefined : subject(node);
      if (value !== undefined) subjects.set(node, value);
      connect(indexed, value);
      return value;
    }
    const reference = ast.is.IsBindingElement(node) ? node : navigation.sourceReferenceFor(node)?.declaration;
    const selected = ast.is.IsElementAccessExpression(node) || ast.is.IsCallExpression(node) ? node
      : ast.is.IsPropertyAccessExpression(node)
        ? semantics.forNode(node).operations.propertyAccess(node)?.selectedReadDeclaration
          ?? semantics.forNode(node).operations.propertyAccess(node)?.selectedDeclaration
      : reference;
    const qualified = ast.is.IsIdentifier(node) && selected !== undefined && node !== selected && ast.name(selected) !== node &&
      (ast.is.IsVariableDeclaration(selected) || ast.is.IsParameterDeclaration(selected) || ast.is.IsBindingElement(selected) ||
        ast.is.IsFunctionDeclaration(selected) || ast.is.IsFunctionExpression(selected)) &&
      sourceBindingWriteAtReference(ast, node) === undefined;
    if (budget.failure() !== undefined) return undefined;
    const target = ast.is.IsPropertyAccessExpression(node) || qualified ? node
      : selected !== undefined && !ast.is.IsGetAccessorDeclaration(selected) ? selected : node;
    const file = ast.getSourceFile(node);
    if (selected !== undefined && file !== undefined && semantics.includes(file) && !retainCheckedContext(selected, file)) return undefined;
    if (!sealed && selected !== undefined && file !== undefined && semantics.includes(file) &&
      (ast.is.IsVariableDeclaration(selected) && Node_Initializer(ast, selected) === undefined ||
        ast.is.IsClassDeclaration(selected) && !navigation.isProjectDeclaration(selected)) && !nativeConstructors.has(selected)) {
      const constructors = effects.nativeConstructorsFor?.(selected, semantics.forFile(file));
      if (!nativeConstructorRows.add(1 + (constructors?.length ?? 0))) return undefined;
      nativeConstructors.set(selected, constructors === undefined ? null : Object.freeze([...constructors]));
    }
    const pattern = selected !== undefined && ast.is.IsBindingElement(selected) ? ast.parent(selected) : undefined;
    const projected = pattern !== undefined && (ast.is.IsArrayBindingPattern(pattern) || ast.is.IsObjectBindingPattern(pattern));
    const iteration = selected !== undefined && ast.is.IsBindingElement(selected) &&
      sourceBindingWriteAtReference(ast, ast.name(selected)!)?.kind === "iteration";
    // A binding element already connected to its pattern component (during graph construction) is reused; a later reference
    // (for example one first read after sealing) adds no edge.
    const connected = selected !== undefined && projected && !iteration ? subjects.get(selected) : undefined;
    const binding = selected === undefined || !projected || iteration || connected !== undefined ? undefined : projections.binding(selected);
    if (projected && !iteration && connected === undefined && binding === undefined) return undefined;
    const value = qualified ? subject(node) : subject(target);
    if (value === undefined) return undefined;
    let declaration: SourceStorageSubject | undefined = connected;
    if (binding !== undefined && selected !== undefined) {
      declaration = subject(selected);
      if (declaration === undefined) return undefined;
      subjects.set(selected, declaration);
      connect(binding, declaration);
    }
    subjects.set(node, value);
    // A reference to a destructured binding reads the binding element's own storage, which the pattern projection
    // feeds; writes through the reference therefore reach the binding element and, through it, the original value.
    if (qualified) connect(declaration ?? subjectFor(selected), value);
    return value;
  };
  const subjectFor = (node: Node | undefined): SourceStorageSubject | undefined => budget.withRows(rows => {
    const wrappers: Node[] = [];
    while (node !== undefined && !subjects.has(node) && valueWrapper(node)) {
      if (!step() || !rows.add(1)) return undefined;
      wrappers.push(node);
      node = Node_Expression(ast, node);
    }
    let value = node === undefined ? undefined : valueSubjectFor(node);
    for (let index = wrappers.length - 1; value !== undefined && index >= 0; index -= 1) {
      if (!step()) return undefined;
      const wrapper = wrappers[index]!;
      const selected = subject(wrapper);
      if (selected === undefined) return undefined;
      subjects.set(wrapper, selected);
      connect(value, selected);
      value = selected;
    }
    return value;
  });
  const locationFor = (node: Node | undefined): SourceStorageSubject | undefined => {
    while (node !== undefined && valueWrapper(node)) {
      if (!step()) return undefined;
      node = Node_Expression(ast, node);
    }
    if (node === undefined) return undefined;
    if (ast.is.IsIdentifier(node)) {
      const declaration = navigation.sourceReferenceFor(node)?.declaration;
      return declaration === undefined ? subjectFor(node) : subjectFor(declaration);
    }
    if (ast.kindName(node) === "KindThisKeyword") return receiverFor(node);
    const property = ast.is.IsPropertyAccessExpression(node) ? semantics.forNode(node).operations.propertyAccess(node) : undefined;
    const selected = property ?? (ast.is.IsElementAccessExpression(node) ? semantics.forNode(node).operations.elementAccess(node) : undefined);
    const declaration = property?.selectedWriteDeclaration ?? selected?.selectedDeclaration;
    if (declaration !== undefined && (ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration)))
      return undefined;
    return declaration !== undefined && (sourceStorageIsDataMember(declaration, ast) || sourceStorageIsMethodMember(declaration, ast))
      ? sourceStorageMemberSubject(declaration, ast, subject)
      : ast.is.IsElementAccessExpression(node)
        ? projections.indexed(node, true) : subjectFor(node);
  };
  const connect = (origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined,
    types?: SourceStorageEdgeTypes): void => {
    if (origin === undefined || destination === undefined || origin === destination || budget.failure() !== undefined) return;
    if (sealed) { budget.reject("Source storage transport cannot add edges after graph construction is sealed."); return; }
    if (!edges.add(origin, destination, types)) return;
    graphQueries.invalidate(destination);
    connectStructuralFlow(origin, destination, types);
  };
  const connectStructuralFlow = createSourceStorageStructuralFlow(source, step, subject, connect,
    sourceFileFor, retainCheckedContext);
  const projections = createSourceStorageProjectionFlow(source, step, subject, subjectFor, locationFor, connect,
    (subject, reason) => unresolvedSubjects.set(subject, reason), sourceFileFor);
  const regions = createSourceStorageExecutionRegions(source, budget, invocation => constructionLineagesFor(invocation),
    (candidate, invocation, callback) => inputSlotsFor(candidate, invocation, callback), subject);
  const memberAccessors = createSourceStorageMemberAccessors(source, budget, {
    subject, subjectFor, incomingFor, connect, recordInvocation: regions.recordInvocation,
    spreadMembersFor: (expression, evaluation) => memberFlow.spreadMembersFor(expression, evaluation),
    implementationsFor: (declaration, invocation, receiver) => implementationsFor(declaration, invocation, originSubjects, receiver),
    inputSlotsFor: (candidate, invocation) => inputSlotsFor(candidate, invocation),
  }, graphQueries);
  const accessorTargets = memberAccessors.targets;
  const storedValues = createSourceStorageStoredValues(ast, budget, regions.enclosing, node => {
    const pointer = source.sourceFacts.getFact(node, pointerOperationFactKey);
    if (pointer?.operation === "store") return subjectFor(pointer.pointerExpression);
    const selected = ast.is.IsPropertyAccessExpression(node) ? semantics.forNode(node).operations.propertyAccess(node)
      : ast.is.IsElementAccessExpression(node) ? semantics.forNode(node).operations.elementAccess(node) : undefined;
    return subjectFor(selected?.receiver.expression);
  }, declarationIsAmbient);
  const writeFor = (node: Node) => storedValues.writeFor(node, projections.writeValue, values => {
    const selected = [...new Set(values)];
    if (selected.length === 1) return selected[0];
    if (selected.length === 0) return undefined;
    const aggregate = subject(node);
    for (const value of selected) connect(value, aggregate);
    return aggregate;
  });
  const connectWrite = (location: SourceStorageSubject | undefined, value: SourceStorageSubject | undefined): void => {
    if (location !== undefined && !ast.is.IsPropertySignatureDeclaration(location.node)) connect(value, location);
  };
  const recordThrow = (region: Node, origin: SourceStorageSubject): void => {
    const origins = thrownOrigins.get(region) ?? new Set<SourceStorageSubject>();
    if (origins.has(origin) || !budget.row()) return;
    origins.add(origin);
    thrownOrigins.set(region, origins);
    graphQueries.invalidate({ node: region, kind: thrownOrigins });
  };
  const recordUnresolvedThrow = (region: Node, reason: string): void => {
    if (unresolvedThrows.has(region) || !budget.row()) return;
    unresolvedThrows.set(region, reason);
    graphQueries.invalidate({ node: region, kind: thrownOrigins });
  };
  const syntax = createSourceStorageSyntaxCollection({ source, budget, effects, mutationOwners, invocations, pointerInvocations, invocationEffects,
    invocationTargets, invocationArguments, invocationDeclarations, argumentTransports, callbackEntries, unresolvedInvocations,
    memberImplementations, callableDeclarations, callableDeclarationRows,
    subject, step, retainCheckedContext, enclosingCallable, valueWrapper, subjectFor,
    locationFor, connect, projections, regions, memberAccessors, storedValues, writeFor, connectWrite, recordThrow,
    inputSlotsFor: invocation => invocationImplementationSelection(invocation)?.inputs[0] });
  const sourceNodes = navigation.nodesForFiles(sourceFiles);
  for (const file of sourceFiles) {
    if (!semantics.includes(file)) budget.reject("Source storage transport requires exact checked source-file ownership.");
    else {
      const existing = admittedAmbient.get(file);
      if (existing !== undefined) existing.collected = true;
      else if (budget.node()) admittedAmbient.set(file, {
        ambient: sourceDeclarationAmbientContext(ast, file, false), collected: true,
      });
    }
  }
  for (const node of sourceNodes) {
    if (budget.failure() !== undefined) break;
    const existing = admittedAmbient.get(node);
    if (existing !== undefined) existing.collected = true;
    else {
      if (!budget.node()) break;
      const parent = ast.parent(node);
      const inheritedAmbient = parent === undefined ? false : admittedAmbient.get(parent)?.ambient ?? false;
      admittedAmbient.set(node, { ambient: sourceDeclarationAmbientContext(ast, node, inheritedAmbient), collected: true });
    }
    visitedNodes.push(node);
  }
  for (const node of visitedNodes) {
    if (budget.failure() !== undefined) break;
    syntax.visit(node);
  }
  const walkAncestors = createSourceStorageAncestorQuery(budget, incomingFor);
  const originSubjects = graphQueries.query((selected: SourceStorageSubject): ReadonlySet<SourceStorageSubject> | undefined => {
    const originals = new Set(walkAncestors(selected, (origin, incoming) => step() &&
      (ast.is.IsParameterDeclaration(origin.node) || ast.is.IsObjectLiteralExpression(origin.node) ||
        ast.is.IsNewExpression(origin.node) || sourceStorageHasOriginalValue(origin, ast, incoming.size !== 0))));
    return budget.failure() === undefined ? originals : undefined;
  });
  const classLineagesFor = (expression: Node | undefined,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined = originSubjects,
    mode?: "heritage") => {
    const valuesFor = (subject: SourceStorageSubject) => {
      const origins = originsFor === originSubjects ? classValueSubjects(subject) : originsFor(subject);
      return origins === undefined ? undefined : new Set([...origins].map(origin => ({ subject: origin, bindings: undefined })));
    };
    const target = subjectFor(expression);
    return target === undefined ? undefined : sourceStorageClassLineages(source, budget, valuesFor(target), { subjectFor, valuesFor, nativeConstructorsFor }, mode);
  };
  const constructionLineagesFor = (invocation: Node,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined = originSubjects,
    mode?: "heritage") =>
    classLineagesFor(sourceConstructionExpression(invocation, source, step), originsFor, mode);
  const ancestorSubjects = graphQueries.query((selected: SourceStorageSubject): ReadonlySet<SourceStorageSubject> | undefined => {
    const subjects = new Set(walkAncestors(selected));
    return budget.failure() === undefined ? subjects : undefined;
  });
  const classValueSubjects = graphQueries.query((selected: SourceStorageSubject): ReadonlySet<SourceStorageSubject> | undefined => {
    const values = new Set<SourceStorageSubject>();
    for (const origin of walkAncestors(selected)) {
      if (!step()) return undefined;
      if (ast.is.IsParameterDeclaration(origin.node) || sourceStorageHasOriginalValue(origin, ast, incomingFor(origin).size !== 0))
        values.add(origin);
    }
    return budget.failure() === undefined ? values : undefined;
  });
  const memberFlow = createSourceStorageMemberFlow(source, budget, subject, sourceFileFor, retainCheckedContext);
  const implementationsFor = createSourceStorageMemberImplementations(source, budget, {
    subject, subjectFor, incomingFor, originsFor: originSubjects, declarationsFor: memberFlow.declarationsFor,
    membersInLineage: memberFlow.membersInLineage, excludes: memberFlow.excludes, memberStorageKindFor: memberFlow.memberStorageKindFor,
    storesFor: storedValues.storesFor, constructionLineagesFor, contracts: memberImplementations, accessorTargets,
  });
  const ownedImplementations = (nodes: ReadonlySet<Node>, exact: boolean, implicitSourceConstruction = false,
    sourceConstruction = false) => Object.freeze({
    nodes, exact, sourceOwned: exact && nodes.size !== 0 &&
      (implicitSourceConstruction || [...nodes].every(candidate => ast.body(candidate) !== undefined)),
    sourceConstruction: exact && nodes.size !== 0 && sourceConstruction,
  });
  const collectInvocationImplementations = (invocation: Node,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined = originSubjects):
      { readonly nodes: ReadonlySet<Node>; readonly exact: boolean; readonly sourceOwned: boolean; readonly sourceConstruction: boolean } => {
    graphQueries.read({ node: invocation, kind: accessorTargets });
    const implementations = new Set<Node>();
    const declaration = invocationDeclarations.get(invocation);
    const target = invocationTargets.get(invocation);
    const construction = ast.is.IsNewExpression(invocation) || ast.kindName(Node_Expression(ast, invocation)) === "KindSuperKeyword";
    if (construction) {
      const lineages = constructionLineagesFor(invocation, originsFor);
      let exact = lineages !== undefined && lineages.length !== 0;
      for (const lineage of lineages ?? []) {
        if (!step()) return ownedImplementations(implementations, false);
        exact &&= lineage.complete;
        if (lineage.complete) {
          const owner = lineage.implementation ?? lineage.classes[lineage.classes.length - 1]?.subject.node;
          if (owner !== undefined) implementations.add(owner);
        } else {
          const root = lineage.classes[0]?.subject.node;
          if (root !== undefined) implementations.add(root);
        }
      }
      return ownedImplementations(implementations, exact, lineages !== undefined && lineages.length !== 0 &&
        lineages.every(lineage => lineage.complete && lineage.nativeBase === undefined),
        lineages !== undefined && lineages.length !== 0 && lineages.every(lineage => lineage.complete && lineage.classes.length !== 0));
    }
    const member = declaration !== undefined && (ast.is.IsMethodDeclaration(declaration) || ast.is.IsMethodSignatureDeclaration(declaration) ||
      ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration));
    let exact = !member && target !== undefined;
    if (member) {
      const selected = implementationsFor(declaration, invocation, originsFor);
      return ownedImplementations(selected.nodes, selected.exact);
    }
    const origins = target === undefined ? undefined : originsFor(target);
    if (target !== undefined && origins === undefined) exact = false;
    for (const candidate of origins ?? []) {
      if (!step()) break;
      if (candidate.kind !== "value") { exact = false; continue; }
      const owner = member ? sourceMemberOwner(ast, candidate.node) : undefined;
      if (owner !== undefined && (ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner) || ast.is.IsInterfaceDeclaration(owner))) continue;
      const selected = implementationsFor(candidate.node, invocation, originsFor);
      if (!selected.exact) exact = false;
      for (const implementation of selected.nodes) implementations.add(implementation);
    }
    for (const accessor of accessorTargets.get(invocation) ?? []) {
      const selected = implementationsFor(accessor.declaration, invocation, originsFor);
      exact = target === undefined ? selected.exact : exact && selected.exact;
      for (const implementation of selected.nodes) implementations.add(implementation);
    }
    return ownedImplementations(implementations, exact);
  };
  let invocationSelectionsSealed = false;
  const selectedInvocationImplementations: (key: SourceStorageInvocationSelectionKey) => ReadonlySet<{
    readonly nodes: ReadonlySet<Node>; readonly exact: boolean; readonly sourceOwned: boolean; readonly sourceConstruction: boolean; readonly inputs: readonly SourceStorageInvocationInputSlots[];
  }> | undefined = graphQueries.query((key: SourceStorageInvocationSelectionKey, retain): ReadonlySet<{
    readonly nodes: ReadonlySet<Node>; readonly exact: boolean; readonly sourceOwned: boolean; readonly sourceConstruction: boolean; readonly inputs: readonly SourceStorageInvocationInputSlots[];
  }> | undefined => {
    if (invocationSelectionsSealed) throw new Error("Source storage invocation inputs were not published before their consumers.");
    const entry = "kind" in key && (key.kind === "source-storage-callback-entry" || key.kind === "source-storage-accessor-entry") ? key : undefined;
    const invocation = "invocation" in key ? key.invocation : key;
    let selected: { readonly nodes: ReadonlySet<Node>; readonly exact: boolean; readonly sourceOwned: boolean; readonly sourceConstruction: boolean };
    if (entry?.kind === "source-storage-callback-entry") {
      const nodes = new Set<Node>();
      const producers = originSubjects(entry.argument.actual);
      let exact = producers !== undefined && producers.size !== 0;
      for (const producer of producers ?? []) {
        if (!step()) return undefined;
        const implementation = navigation.callableImplementation(producer.node);
        if (implementation.kind !== "resolved" || ast.body(implementation.implementation.declaration) === undefined) exact = false;
        else nodes.add(implementation.implementation.declaration);
      }
      selected = ownedImplementations(nodes, exact);
    } else if (entry?.kind === "source-storage-accessor-entry") {
      graphQueries.read({ node: invocation, kind: accessorTargets });
      const implementation = navigation.callableImplementation(entry.declaration);
      selected = ownedImplementations(new Set([entry.declaration]), implementation.kind === "resolved" &&
        implementation.implementation.declaration === entry.declaration && ast.body(entry.declaration) !== undefined);
    } else if (!invocations.has(invocation) && !accessorTargets.has(invocation)) {
      const implementation = navigation.callableImplementation(invocation);
      selected = ownedImplementations(new Set(implementation.kind === "resolved" ? [implementation.implementation.declaration] : []),
        implementation.kind === "resolved");
    } else selected = collectInvocationImplementations(invocation);
    const inputs: SourceStorageInvocationInputSlots[] = [];
    const accessors = entry === undefined ? accessorTargets.get(invocation) : undefined;
    if (accessors !== undefined && !ast.is.IsCallExpression(invocation) && !ast.is.IsNewExpression(invocation)) {
      for (const accessor of accessors) {
        if (!step()) return undefined;
        const result = selectedInvocationImplementations(accessor)?.values().next().value;
        if (result === undefined) return undefined;
        inputs.push(...result.inputs);
      }
      if (!retain(inputs.length)) return undefined;
    } else {
      const input = sourceStorageInvocationInputSelection(source, key, selected.nodes, selected.exact, step, retain,
        declaration => selectedInvocationImplementations(declaration)?.values().next().value?.inputs[0]);
      if (input === undefined) return undefined;
      inputs.push(input);
    }
    return new Set([Object.freeze({ ...selected, inputs: Object.freeze(inputs) })]);
  });
  const invocationImplementationSelection = (invocation: Node,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined = originSubjects) => {
    const selected = selectedInvocationImplementations(invocation)?.values().next().value;
    return selected === undefined || originsFor === originSubjects ? selected
      : Object.freeze({ ...collectInvocationImplementations(invocation, originsFor), inputs: selected.inputs });
  };
  const inputSlotsFor: SourceStorageInvocationInputSelectionQuery = (candidate, invocation, callback) => {
    const key = callback ?? (invocation === undefined ? candidate
      : accessorTargets.get(invocation)?.find(entry => entry.declaration === candidate) ?? invocation);
    return selectedInvocationImplementations(key)?.values().next().value?.inputs.find(input =>
      input.selectedDeclaration === candidate || input.implementations.some(body => body.declaration === candidate));
  };
  const invocationImplementations = (invocation: Node,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined = originSubjects): ReadonlySet<Node> =>
    invocationImplementationSelection(invocation, originsFor)?.nodes ?? new Set();
  const hasOnlySourceImplementations = (invocation: Node): boolean =>
    invocationImplementationSelection(invocation)?.sourceOwned === true;
  const callbackEntriesFor = (invocation: Node): readonly SourceStorageCallbackEntry[] => {
    if (!step()) return [];
    const entries = callbackEntries.get(invocation);
    if (entries === undefined || entries.length === 0) return entries ?? [];
    if (hasOnlySourceImplementations(invocation)) return [];
    return entries;
  };
  const callbackImplementationsFor = (entry: SourceStorageCallbackEntry): ReadonlySet<Node> =>
    selectedInvocationImplementations(entry)?.values().next().value?.nodes ?? new Set();
  const physicalMemberInputs = (invocation: Node,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined = originSubjects): ReadonlySet<SourceStorageSubject> | undefined => {
    const declaration = invocationDeclarations.get(invocation);
    const declarations = declaration === undefined ? accessorTargets.get(invocation)?.map(target => target.declaration) : [declaration];
    if (declarations === undefined || declarations.length === 0) return undefined;
    const slots = new Set<SourceStorageSubject>();
    for (const declaration of declarations) {
      if (!step()) return undefined;
      const selected = implementationsFor(declaration, invocation, originsFor);
      if (!selected.exact) return undefined;
      for (const slot of selected.slots ?? []) slots.add(slot);
    }
    return slots;
  };
  const rejections = createSourceStorageRejections(source, budget, {
    subjectFor, subject, originsFor: originSubjects, callbackEntriesFor,
    implementationsFor: invocationImplementationSelection,
    invocationOrigins: (origin, candidate, invocation) => invocationOrigins(origin, candidate, invocation),
    regions, graph: graphQueries, thrownOrigins, unresolvedThrows, unresolvedSubjects, unresolvedInvocations,
    sealed: () => sealed, isAccessorInvocation: invocation => accessorTargets.has(invocation),
    enclosingCallable, recordThrow, recordUnresolvedThrow, connect,
  });
  const invocationInputs = createSourceStorageInvocationInputs(source, budget, subject, subjectFor,
    accessorTargets, invocation => unresolvedInvocations.has(invocation), rejections.receiverOriginsFor, inputSlotsFor, argumentTransports);
  const invocationOrigins = createSourceStorageInvocationOrigins(source, budget,
    { invocationInputs, inputSlotsFor, incomingFor, isUnresolved: invocation => unresolvedInvocations.has(invocation) });

  const pointers = createSourceStoragePointerBackings(source, budget, {
    subjectFor, locationFor, originsFor: originSubjects,
  });
  const pointerBackings = graphQueries.query(pointers.backingsFor);
  const pointerAccessors = graphQueries.query(pointers.accessorsFor);
  const resumedImplementations = graphQueries.query(createSourceStorageGeneratorResumes(source, budget, {
    invocationEffects, subjectFor, originsFor: originSubjects,
    implementationsFor: invocation => pointerInvocations.has(invocation) ? pointerAccessors(invocation) : invocationImplementations(invocation),
  }));
  const physicalMemberDestinationsFor = createSourceStorageMutationDestinations(source, budget, memberFlow,
    origin => constructionLineagesFor(origin.node, originSubjects, "heritage"));
  const operations = function* (): Generator<SourceStorageReconciliation> {
    for (const invocation of invocations)
      yield once => { if (once(invocation)) syntax.publishInvocationInputs(invocation); };
    for (const access of memberAccessors.sites) {
      if (!ast.is.IsSpreadAssignment(access)) continue;
      const object = ast.parent(access);
      if (object === undefined || !ast.is.IsObjectLiteralExpression(object)) continue;
      yield once => {
        if (!once(object) || !step()) return;
        const owner = subject(object);
        const type = owner === undefined ? undefined : sourceStorageSubjectType(source, owner);
        const components = owner === undefined ? undefined : memberFlow.componentsFor(owner);
        if (owner === undefined || type === undefined || components === undefined) return;
        for (const component of components) {
          if (!step()) return;
          if (!sourceStorageIsMemberProjection(component)) continue;
          const destination = subject(object, "value", [component]);
          let before = object;
          while (step()) {
            const contribution = memberFlow.copyContributionFor(owner, component.declaration, type, before);
            if (contribution === undefined || contribution.kind === "absent") break;
            if (contribution.kind === "own") {
              if (!ast.is.IsGetAccessorDeclaration(contribution.declaration) && !ast.is.IsSetAccessorDeclaration(contribution.declaration))
                connect(subjectFor(ObjectLiteralProperty_Value(ast, contribution.declaration)), destination);
              break;
            }
            const original = subjectFor(contribution.expression);
            if (original === undefined) return;
            let definite = contribution.definite;
            for (const selected of contribution.components) {
              if (!step() || !sourceStorageIsMemberProjection(selected)) return;
              const declaration = selected.declaration;
              const declaredOwner = sourceMemberOwner(ast, declaration);
              if (declaredOwner !== undefined && (ast.is.IsClassDeclaration(declaredOwner) || ast.is.IsClassExpression(declaredOwner)) &&
                (ast.is.IsMethodDeclaration(declaration) || ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration))) {
                definite = false;
                continue;
              }
              if (ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration)) continue;
              connect(subject(original.node, original.kind, [...original.projection, selected]), destination);
            }
            if (definite) break;
            before = contribution.evaluation;
          }
        }
      };
    }
    for (const invocation of pointerInvocations) {
      const pointer = source.sourceFacts.getFact(invocation, pointerOperationFactKey);
      if (pointer?.operation !== "store") continue;
      yield () => {
        const selected = pointerBackings(pointer.pointerExpression);
        for (const backing of selected ?? []) {
          if (!step()) return;
          storedValues.bind(backing, invocation);
        }
      };
    }
    for (const [access, owner] of mutationOwners) yield once => {
      if (!step()) return;
      const property = ast.is.IsPropertyAccessExpression(access) ? semantics.forNode(access).operations.propertyAccess(access) : undefined;
      const selected = property ?? semantics.forNode(access).operations.elementAccess(access);
      const declarations = sourceStorageAccessDeclarations(source, access, "write");
      const write: SourceStorageWrite = writeFor(access)
        ?? { reference: access, operation: ast.parent(access) ?? access, kind: "mutation", values: Object.freeze([]),
          reason: "Source storage mutation requires its exact selected value producer." };
      const storage = locationFor(access);
      storedValues.recordWrite(storage, write);
      const physicalOwner = storage === undefined ? undefined : sourceMemberOwner(ast, storage.node);
      const receiver = owner.kind === "receiver" ? owner
        : ast.kindName(owner.node) === "KindThisKeyword" ? receiverFor(owner.node) : undefined;
      if (receiver !== undefined && storage?.kind === "member" && ast.is.IsPropertyDeclaration(storage.node) &&
        declarations?.includes(storage.node) === true && physicalOwner !== undefined &&
        (physicalOwner === receiver.node || physicalOwner === ast.parent(receiver.node))) return;
      for (const origin of originSubjects(owner) ?? []) {
        if (!step()) break;
        if (selected !== undefined && storage !== undefined && storage.projection.length > owner.projection.length) {
          const file = sourceFileFor(origin);
          const type = sourceStorageSubjectType(source, origin, file);
          if (file === undefined || type === undefined) continue;
          let projected = false;
          sourceStorageProjectComponents(origin.projection, type, selected.receiver.type, storage.projection.slice(owner.projection.length),
            semantics.forNode(access), ast, budget, projection => {
              const destination = subject(origin.node, origin.kind, projection);
              if (destination !== undefined) {
                storedValues.bind(destination, access);
                projected = true;
              }
            });
          if (projected) continue;
        }
        const rest = sourceStorageObjectRestOwner(origin.node, ast) !== undefined;
        if (!ast.is.IsObjectLiteralExpression(origin.node) && !ast.is.IsNewExpression(origin.node) && !rest) continue;
        if (!once(origin)) continue;
        const file = sourceFileFor(origin);
        const type = sourceStorageSubjectType(source, origin, file);
        const key = (declarations?.length ?? 0) === 0 ? sourceStorageDynamicMemberKey(source, access) : undefined;
        const dynamic = key === undefined ? undefined : sourceStorageDynamicMemberDeclarations(source, origin, key, "write", step);
        const selectedDeclarations = dynamic?.declarations ?? declarations;
        const receiverType = dynamic?.type ?? selected?.receiver.type;
        const matching = receiverType === undefined || type === undefined || selectedDeclarations === undefined || selectedDeclarations.length === 0
          ? undefined : physicalMemberDestinationsFor(origin, selectedDeclarations, receiverType);
        if (selected === undefined || receiverType === undefined || matching === undefined) {
          const reason = "Source member writes require exact checked physical destination correspondence.";
          const checkedIndex = property?.selectedIndex !== undefined || selected?.selectedDeclaration !== undefined &&
            ast.is.IsIndexSignatureDeclaration(selected.selectedDeclaration);
          const indexedLocation = checkedIndex && selected?.writable === true &&
            (declarations?.length ?? 0) === 0 ? storage : undefined;
          unresolvedSubjects.set(indexedLocation ?? origin, reason);
          for (const pair of type === undefined ? [] : memberFlow.membersFor(origin, type) ?? []) {
            if (!step()) return;
            if (pair.kind !== "present") continue;
            for (const member of pair.source.declarations) {
              if (!step()) return;
              const location = sourceStorageMemberSubject(member, ast, subject);
              if (location !== undefined) unresolvedSubjects.set(location, reason);
            }
          }
          continue;
        }
        for (const member of matching) {
          if (!step()) break;
          const storageKind = memberFlow.memberStorageKindFor(origin, member, receiverType);
          if (storageKind === undefined) {
            unresolvedSubjects.set(origin, budget.failure() ?? "Source member writes require exact checked physical copy correspondence.");
            continue;
          }
          const copied = storageKind === "copied";
          if (ast.is.IsSetAccessorDeclaration(member) || !copied && ast.is.IsGetAccessorDeclaration(member)) continue;
          const location = copied ? subject(origin.node, origin.kind, [...origin.projection, {
            kind: sourceStorageIsMethodMember(member, ast) ? "method-value" : "member", declaration: member,
          }]) : sourceStorageMemberSubject(member, ast, subject);
          connect(write.value, location);
          storedValues.bind(location, access);
        }
      }
    };
    for (const invocation of invocations) {
      yield () => {
        for (const callback of callbackEntriesFor(invocation)) {
          if (!step()) return;
          for (const candidate of callbackImplementationsFor(callback)) {
            if (!step()) return;
            const slots = sourceStorageSelectedInputSlots(inputSlotsFor(candidate, invocation, callback), candidate);
            for (const slot of slots ?? []) {
              if (!step()) return;
              if (slot.projection === undefined) continue;
              const formal = subject(slot.parameter, "input", slot.projection);
              if (formal === undefined) return;
              const selected = invocationInputs(formal, candidate, invocation, callback);
              for (const origin of selected.subjects) connect(origin, formal);
              for (const origin of selected.calleeSubjects ?? []) connect(origin, formal);
            }
          }
        }
      };
    }
    for (const invocation of invocationTargets.keys()) yield once => {
      for (const candidate of invocationImplementations(invocation)) {
        if (!once(candidate)) continue;
        const consumer = semantics.forNode(invocation);
        const selected = consumer.operations.call(invocation);
        const slots = sourceStorageSelectedInputSlots(inputSlotsFor(candidate, invocation), candidate);
        const result = selected === undefined ? undefined : consumer.operations.callResult(selected);
        const generator = semantics.forNode(candidate).operations.generator(candidate);
        if (generator !== undefined && invocationImplementationSelection(invocation)?.exact === true &&
          [...invocationImplementations(invocation)].every(owner => semantics.forNode(owner).operations.generator(owner) !== undefined))
          invocationEffects.set(invocation, Object.freeze({ resultAllocation: invocation }));
        if (ast.is.IsCallExpression(invocation) && !ast.hasModifierKind(candidate, "async") && generator === undefined) connect(subject(candidate, "return"), subject(invocation),
          result === undefined ? undefined : { from: result.selectedReturnType, to: result.resultType });
        const receiver = subject(candidate, "receiver");
        if (receiver !== undefined) for (const origin of invocationInputs(receiver, candidate, invocation).subjects) connect(origin, receiver);
        const arguments_ = argumentTransports.get(invocation);
        if (selected !== undefined && arguments_ === undefined && !unresolvedInvocations.has(invocation))
          throw new Error("Selected source storage invocation actuals were not published before their consumers.");
        for (const argument of arguments_ ?? []) {
          if (!step()) break;
          const binding = argument.binding;
          for (const slot of slots ?? []) {
            if (!step()) return;
            if (slot.projection === undefined || slot.effectiveIndex !== binding.effectiveArgumentIndex &&
              !(slot.repeated && binding.effectiveArgumentIndex >= slot.effectiveIndex)) continue;
            const destination = subject(slot.parameter, "input", slot.projection);
            const initialized = Node_Initializer(ast, slot.parameter) !== undefined;
            if (!initialized || selected !== undefined &&
              sourceStorageInvocationArgumentAbsence(source, selected, binding) !== "absent")
              connect(argument.actual, destination, { from: binding.selectedArgumentType, to: binding.selectedParameterType });
            if (!initialized && slot.projection.length === 0) connect(subject(argument.selectedParameterDeclaration, "input"), destination);
          }
        }
        for (const slot of slots ?? []) {
          if (!step()) return;
          if (slot.projection === undefined) continue;
          const destination = subject(slot.parameter, "input", slot.projection);
          if (destination === undefined) return;
          const inputs = invocationInputs(destination, candidate, invocation);
          if (inputs.context === "callee") for (const origin of inputs.subjects) connect(origin, destination);
          for (const origin of inputs.calleeSubjects ?? []) connect(origin, destination);
        }
      }
    };
    yield* memberAccessors.operations();
    yield* rejections.operations(visitedNodes, new Set([...invocations, ...memberAccessors.sites]));
  };
  graphQueries.reconcile(operations());
  for (const declaration of callableDeclarations) {
    if (!step() || selectedInvocationImplementations(declaration) === undefined) break;
  }
  for (const invocation of invocations) {
    if (!step() || selectedInvocationImplementations(invocation) === undefined) break;
    for (const callback of callbackEntriesFor(invocation)) {
      if (!step() || selectedInvocationImplementations(callback) === undefined) break;
    }
  }
  for (const entries of accessorTargets.values()) for (const entry of entries) {
    if (!step() || selectedInvocationImplementations(entry) === undefined) break;
  }
  const contextLocation = createSourceStorageContextLocations(source, budget, storedValues.storesFor,
    subject => invocationEffects.get(subject.node));
  const contextualInputs = createSourceStorageContextInputs(source, budget, {
    subject, subjectFor, incomingFor, sourceFileFor,
    isInvocation: node => invocations.has(node) || accessorTargets.has(node),
    implementationsFor: invocationImplementations,
    invocationInputs, locationFor: contextLocation,
    ownerFor: node => {
      const region = regions.enclosing(node);
      return region === undefined ? undefined : sourceStorageRegionOwner(source.ast, region);
    },
    argumentsFor: node => invocationArguments.get(node) ?? [],
  }, graphQueries);
  const nativePayloadCandidates = graphQueries.query((invocation: Node): ReadonlySet<{
    readonly values: readonly SourceStorageSubject[]; readonly complete: boolean;
  }> | undefined => {
    const selected = sourceStorageNativeCallablePayloads(source, budget, invocation, undefined, {
      subjectFor, inputsFor: incomingFor, callbackEntriesFor, componentsFor: memberFlow.componentsFor,
      hasOnlySourceImplementations,
      valuesFor: selected => {
        const values = originSubjects(selected);
        return values === undefined ? undefined : { values: [...values].map(subject => ({ subject, bindings: undefined })), complete: true };
      },
      componentFor: (value, component) => component.kind === "member" || component.kind === "method-value"
        ? sourceStorageMemberSubject(component.declaration, ast, subject)
        : subject(value.subject.node, value.subject.kind, [...value.subject.projection, component]),
    });
    return selected === undefined ? undefined : new Set([Object.freeze({
      values: Object.freeze([...new Set(selected.values.map(value => value.subject))]), complete: selected.complete,
    })]);
  });
  const callbackInputFrontiersFor = createSourceStorageCallbackInputFrontiers(source, budget, graphQueries, {
    invocations, callbackEntriesFor, callbackImplementationsFor, invocationTargets,
    subjectFor, originSubjects, invocationInputs, inputSlotsFor, nativePayloadCandidates,
  });
  const invocationResults = createSourceStorageInvocationResults(source, budget, {
    subject, subjectFor, nativeConstructorsFor,
    targetFor: invocation => invocationTargets.get(invocation),
    valuesFor: (origin, bindings) => substitutions.values(origin, bindings),
    bindingsFor: (candidate, invocation, bindings, captured, callee) => substitutions.forInvocation(candidate, invocation, bindings, captured, callee),
    hasResultAlias: invocation => invocationEffects.get(invocation)?.resultAlias !== undefined,
  });
  const storedProjections = createSourceStorageStoreProjections(budget, subject, storedValues.storesFor, edges.projectOrigin);
  const bindingInputFor = createSourceStorageBindingInputs(ast, { incomingFor, guardedValues }, budget);
  const substitutions = createSourceStorageSubstitutions(source, budget, {
    subject, subjectFor, sourceFileFor, locationFor, nativeConstructorsFor, bindingInputFor, declarationIsAmbient, incomingFor, contextualInputs, contextLocation, memberFlow, regions, invocationTargets,
    invocationDeclarations, invocationEffects, invocations, visitedNodes, pointerInvocations, pointerAccessors, resumedImplementations, thrownOrigins, unresolvedThrows,
    accessorTargets, invocationInputs, inputSlotsFor, sourceFiles, callbackEntriesFor, callbackImplementationsFor, callbackInputFrontiersFor,
    storedValuesFor: storedProjections, storesFor: storedValues.storesFor, storesIn: storedValues.storesIn, invocationImplementations,
    isOpaque: invocation => opaqueInvocations.has(invocation), hasOnlySourceImplementations, guardedValues, memberAccessorsFor: memberAccessors.declarationsFor,
  }, graphQueries);
  const unresolved = createSourceStorageUnresolvedQueries(budget, subject,
    selected => {
      const result = substitutions.walk(selected, substitutions.empty);
      return result === undefined ? undefined : { subjects: result.subjects,
        reason: result.fatalReason ?? result.reason ?? (result.emptyDemands.length === 0 ? undefined : sourceStorageMissingProducerReason) };
    }, unresolvedSubjects);
  const boundaries: SourceStorageBoundary[] = [];
  for (const invocation of invocations) {
    if (!step()) break;
    const reason = unresolvedInvocations.get(invocation);
    if (reason === undefined && pointerInvocations.has(invocation)) continue;
    const implementations = invocationImplementationSelection(invocation);
    if (reason === undefined && (implementations?.sourceOwned === true || implementations?.sourceConstruction === true)) continue;
    const selected = new Set<SourceStorageSubject>();
    const result = subject(invocation);
    if (result !== undefined) {
      selected.add(result);
      if (reason !== undefined) unresolvedSubjects.set(result, reason);
    }
    for (const argument of invocationArguments.get(invocation) ?? []) {
      if (!step()) break;
      const actual = subjectFor(argument);
      if (actual !== undefined) selected.add(actual);
    }
    for (const argument of argumentTransports.get(invocation) ?? []) {
      if (!step()) break;
      selected.add(argument.actual);
      selected.add(argument.formal);
    }
    if (!budget.row()) break;
    boundaries.push(Object.freeze({ kind: reason === undefined ? "opaque-invocation" : "unresolved-transport", invocation,
      declaration: invocationDeclarations.get(invocation), subjects: Object.freeze([...selected]),
      ...(reason === undefined ? {} : { reason }) }));
  }
  const opaqueInvocations = new Set(boundaries.map(boundary => boundary.invocation));
  regions.seal();
  graphQueries.seal();
  invocationSelectionsSealed = true;
  const formalMemberWrites = createSourceStorageFormalMemberWrites(source, budget, createSourceStorageGraphQueries, {
    declarations: callableDeclarations, invocations: { *[Symbol.iterator]() { yield* invocations; yield* accessorTargets.keys(); } },
    invocationInputs, subject, subjectFor,
    inputsFor: current => invocations.has(current.node) || accessorTargets.has(current.node)
      ? contextualInputs.applicationFor(current)?.ports : contextualInputs(current),
    implementationsFor: invocationImplementationSelection, unresolvedFor: invocation => unresolvedInvocations.get(invocation),
  });
  callableDeclarationRows.release();
  callableDeclarations.length = 0;
  storedValues.publish(formalMemberWrites.recordWrite);
  formalMemberWrites.closeInputs();
  sealed = true;
  return { subject, subjectFor, nativeConstructorsFor, locationFor, declarationIsAmbient, storageSubject: projections.ownerFor, incomingFor, identities, mutationOwners,
    storedInputsFor: storedValues.inputsFor,
    storedValuesFor: storedProjections,
    storesFor: storedValues.storesFor,
    storesIn: storedValues.storesIn,
    writeAt: storedValues.writeAt,
    formalMemberWriteDemand: formalMemberWrites.get, sealFormalMemberWriteDemands: formalMemberWrites.seal,
    invocationImplementationSelection, inputSlotsFor,
    callbackImplementationSelection: (entry: SourceStorageCallbackEntry) => selectedInvocationImplementations(entry)?.values().next().value,
    unresolvedStoredInputsFor: storedValues.unresolvedFor,
    sourceFileFor, retainCheckedContext, checkedDeclarations: checkedSourceFiles, invocationTargets,
    invocations, pointerInvocations, pointerAccessors, resumedImplementations, invocationEffects, invocationArguments, invocationDeclarations, argumentTransports, unresolvedInvocations, boundaries,
    callbackEntriesFor, callbackImplementationsFor, invocationInputs,
    accessorTargets, visitedNodes, hasNode: (node: Node): boolean => admittedAmbient.get(node)?.collected === true,
    regions, memberFlow, guardedValues, ancestorSubjects, invocationImplementations, hasOnlySourceImplementations, physicalMemberInputs,
    invocationOrigins, invocationResults, substitutions, contextualInputs, contextLocation, classLineagesFor, constructionLineagesFor,
    unresolvedFor: unresolved.ancestryFor, directlyUnresolvedFor: unresolved.directFor };
}
