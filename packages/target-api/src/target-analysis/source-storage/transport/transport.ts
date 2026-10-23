import { createSourceStorageCallbackInputFrontiers } from "./callback-input-frontiers.js";
import { createSourceStoragePointerBackings } from "./pointer-backings.js";
import { createSourceStorageGeneratorResumes } from "./generator-resumes.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import { pointerOperationFactKey } from "@tsonic/tsts";
import { sourceStorageHasOriginalValue, sourceStorageIsDataMember, sourceStorageIsMethodMember, sourceStorageMemberSubject, sourceStorageObjectRestOwner } from "../model/subjects.js";
import { Node_Expression, Node_Initializer, sourceReceiverOwner } from "../../../source-navigation/index.js";
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
import { sourceStorageClassLineages, sourceStorageConstructionExpression } from "../model/construction.js";
import { createSourceStorageUnresolvedQueries } from "../graph/unresolved.js";
import { createSourceStorageSubstitutions, sourceStorageMissingProducerReason } from "../scoped/substitutions.js";
import { createSourceStorageBindingInputs } from "../scoped/scoped-transport.js";
import { createSourceStorageInvocationResults } from "./invocation-results.js";
import { createSourceStorageInvocationInputs, createSourceStorageInvocationOrigins, sourceStorageCallableInputSlots, sourceStorageNativeCallablePayloads, sourceStorageInvocationActual, sourceStorageInvocationArgumentAbsence } from "../graph/invocation-inputs.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageArgumentTransport, SourceStorageBoundary, SourceStorageCallEffect, SourceStorageEffects, SourceStorageCallbackEntry } from "../model/types.js";
import { sourceMemberOwner } from "../../../source-navigation/class-members.js";
import { createSourceStorageMemberFlow, createSourceStorageMemberImplementations } from "../graph/member-flow.js";
import { createSourceStorageStoredValues, type SourceStorageWrite } from "../graph/stored-values.js";
import { createSourceStorageStoreProjections } from "../graph/store-projections.js";
import { createSourceStorageGraphQueries, type SourceStorageReconciliation } from "../graph/graph-queries.js";
import { sourceBindingWriteAtReference } from "../../../source-navigation/references-usage.js";
import { createSourceStorageAncestorQuery } from "../graph/ancestors.js";
import { createSourceStorageGuardedValues } from "../graph/guarded-values.js";
import { sourceStorageSubjectType } from "../model/components.js";
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
  const valueWrapper = (node: Node): boolean => ast.is.IsParenthesizedExpression(node) || ast.is.IsAsExpression(node) ||
    ast.is.IsSatisfiesExpression(node) || ast.is.IsNonNullExpression(node) || ast.is.IsTypeAssertion(node);
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
      ast.is.IsVariableDeclaration(selected) && Node_Initializer(ast, selected) === undefined && !nativeConstructors.has(selected)) {
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
      : ast.is.IsElementAccessExpression(node) ? projections.indexed(node, true) : subjectFor(node);
  };
  const connect = (origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined,
    types?: SourceStorageEdgeTypes): void => {
    if (origin === undefined || destination === undefined || origin === destination || budget.failure() !== undefined) return;
    if (sealed) { budget.reject("Source storage transport cannot add edges after graph construction is sealed."); return; }
    if (!edges.add(origin, destination, types)) return;
    graphQueries.invalidate(destination);
    connectStructuralFlow(origin, destination);
  };
  const connectStructuralFlow = createSourceStorageStructuralFlow(source, step, subject, connect,
    sourceFileFor, retainCheckedContext);
  const projections = createSourceStorageProjectionFlow(source, step, subject, subjectFor, locationFor, connect,
    (subject, reason) => unresolvedSubjects.set(subject, reason), sourceFileFor);
  const regions = createSourceStorageExecutionRegions(source, budget, invocation => constructionLineagesFor(invocation));
  const memberAccessors = createSourceStorageMemberAccessors(source, budget, {
    subject, subjectFor, incomingFor, connect, recordInvocation: regions.recordInvocation,
    spreadMembersFor: (expression, evaluation) => memberFlow.spreadMembersFor(expression, evaluation),
    implementationsFor: (declaration, invocation, receiver) => implementationsFor(declaration, invocation, originSubjects, receiver),
  }, graphQueries);
  const accessorTargets = memberAccessors.targets;
  const storedValues = createSourceStorageStoredValues(ast, budget, regions.enclosing, node => {
    const pointer = source.sourceFacts.getFact(node, pointerOperationFactKey);
    if (pointer?.operation === "store") return subjectFor(pointer.pointerExpression);
    const selected = ast.is.IsPropertyAccessExpression(node) ? semantics.forNode(node).operations.propertyAccess(node)
      : ast.is.IsElementAccessExpression(node) ? semantics.forNode(node).operations.elementAccess(node) : undefined;
    return subjectFor(selected?.receiver.expression);
  });
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
  const visit = createSourceStorageSyntaxCollection({ source, budget, effects, mutationOwners, invocations, pointerInvocations, invocationEffects,
    invocationTargets, invocationArguments, invocationDeclarations, argumentTransports, callbackEntries, unresolvedInvocations,
    memberImplementations, visitedNodes, subject, step, retainCheckedContext, enclosingCallable, valueWrapper, subjectFor,
    locationFor, connect, projections, regions, memberAccessors, storedValues, writeFor, connectWrite, recordThrow });
  const pendingNodes: Node[] = [];
  const visited = new Set<Node>();
  const admitNode = (node: Node): boolean => {
    if (visited.has(node) || !budget.node()) return false;
    visited.add(node);
    return true;
  };
  for (const file of sourceFiles) {
    if (!semantics.includes(file)) budget.reject("Source storage transport requires exact checked source-file ownership.");
    else if (admitNode(file)) pendingNodes.push(file);
  }
  while (pendingNodes.length !== 0 && budget.failure() === undefined) {
    const node = pendingNodes.pop()!;
    visit(node);
    const children: Node[] = [];
    ast.forEachChild(node, child => { if (child !== undefined && admitNode(child)) children.push(child); });
    for (let index = children.length - 1; index >= 0; index -= 1) pendingNodes.push(children[index]!);
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
    classLineagesFor(sourceStorageConstructionExpression(invocation, source, step), originsFor, mode);
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
  const memberFlow = createSourceStorageMemberFlow(source, budget, sourceFileFor, retainCheckedContext);
  const implementationsFor = createSourceStorageMemberImplementations(source, budget, {
    subject, subjectFor, incomingFor, originsFor: originSubjects, declarationsFor: memberFlow.declarationsFor,
    storesFor: storedValues.storesFor, constructionLineagesFor, contracts: memberImplementations, accessorTargets,
  });
  const collectInvocationImplementations = (invocation: Node,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined = originSubjects):
      { readonly nodes: ReadonlySet<Node>; readonly exact: boolean } => {
    graphQueries.read({ node: invocation, kind: accessorTargets });
    const implementations = new Set<Node>();
    const declaration = invocationDeclarations.get(invocation);
    const target = invocationTargets.get(invocation);
    const construction = ast.is.IsNewExpression(invocation) || ast.kindName(Node_Expression(ast, invocation)) === "KindSuperKeyword";
    if (construction) {
      const lineages = constructionLineagesFor(invocation, originsFor);
      let exact = lineages !== undefined && lineages.length !== 0;
      for (const lineage of lineages ?? []) {
        if (!step()) return { nodes: implementations, exact: false };
        exact &&= lineage.complete;
        if (lineage.complete) {
          const owner = lineage.implementation ?? lineage.classes[lineage.classes.length - 1]?.subject.node;
          if (owner !== undefined) implementations.add(owner);
        } else {
          const root = lineage.classes[0]?.subject.node;
          if (root !== undefined) implementations.add(root);
        }
      }
      return Object.freeze({ nodes: implementations, exact });
    }
    const member = declaration !== undefined && (ast.is.IsMethodDeclaration(declaration) || ast.is.IsMethodSignatureDeclaration(declaration) ||
      ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration));
    let exact = !member && target !== undefined;
    if (member) {
      return implementationsFor(declaration, invocation, originsFor);
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
    return Object.freeze({ nodes: implementations, exact });
  };
  const selectedInvocationImplementations = graphQueries.query((invocation: Node) =>
    new Set([collectInvocationImplementations(invocation)]));
  const invocationImplementationSelection = (invocation: Node,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined = originSubjects) =>
    originsFor === originSubjects ? selectedInvocationImplementations(invocation)?.values().next().value
      : collectInvocationImplementations(invocation, originsFor);
  const invocationImplementations = (invocation: Node,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined = originSubjects): ReadonlySet<Node> =>
    invocationImplementationSelection(invocation, originsFor)?.nodes ?? new Set();
  const callbackEntriesFor = (invocation: Node): readonly SourceStorageCallbackEntry[] => {
    if (!step()) return [];
    const entries = callbackEntries.get(invocation);
    if (entries === undefined || entries.length === 0) return entries ?? [];
    const selected = invocationImplementationSelection(invocation);
    if (selected?.exact === true && [...selected.nodes].some(candidate => ast.body(candidate) !== undefined)) return [];
    return entries;
  };
  const callbackImplementationsFor = (entry: SourceStorageCallbackEntry): ReadonlySet<Node> => {
    const implementations = new Set<Node>();
    for (const producer of originSubjects(entry.argument.actual) ?? []) {
      if (!step()) break;
      const selected = navigation.callableImplementation(producer.node);
      if (selected.kind === "resolved" && ast.body(selected.implementation.declaration) !== undefined)
        implementations.add(selected.implementation.declaration);
    }
    return implementations;
  };
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
    accessorTargets, invocation => unresolvedInvocations.has(invocation), rejections.receiverOriginsFor);
  const invocationOrigins = createSourceStorageInvocationOrigins(source, budget,
    { invocationInputs, incomingFor, isUnresolved: invocation => unresolvedInvocations.has(invocation) });

  const pointers = createSourceStoragePointerBackings(source, budget, {
    subjectFor, locationFor, originsFor: originSubjects,
  });
  const pointerBackings = graphQueries.query(pointers.backingsFor);
  const pointerAccessors = graphQueries.query(pointers.accessorsFor);
  const resumedImplementations = graphQueries.query(createSourceStorageGeneratorResumes(source, budget, {
    invocationEffects, subjectFor, originsFor: originSubjects,
    implementationsFor: invocation => pointerInvocations.has(invocation) ? pointerAccessors(invocation) : invocationImplementations(invocation),
  }));
  const operations = function* (): Generator<SourceStorageReconciliation> {
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
      const declaration = property?.selectedWriteDeclaration ?? selected?.selectedDeclaration;
      const write: SourceStorageWrite = writeFor(access)
        ?? { reference: access, operation: ast.parent(access) ?? access, kind: "mutation", values: Object.freeze([]),
          reason: "Source storage mutation requires its exact selected value producer." };
      const storage = locationFor(access);
      storedValues.recordWrite(storage, write);
      for (const origin of originSubjects(owner) ?? []) {
        if (!step()) break;
        if (selected !== undefined && property === undefined && storage !== undefined && storage.projection.length > owner.projection.length) {
          const file = sourceFileFor(origin);
          const type = sourceStorageSubjectType(source, origin, file);
          if (file === undefined || type === undefined) continue;
          sourceStorageProjectComponents(origin.projection, type, selected.receiver.type, storage.projection.slice(owner.projection.length),
            semantics.forNode(access), ast, budget, projection => {
              const destination = subject(origin.node, origin.kind, projection);
              if (destination !== undefined) storedValues.bind(destination, access);
            });
          continue;
        }
        const rest = sourceStorageObjectRestOwner(origin.node, ast) !== undefined;
        if (!ast.is.IsObjectLiteralExpression(origin.node) && !ast.is.IsNewExpression(origin.node) && !rest) continue;
        if (!once(origin)) continue;
        const file = sourceFileFor(origin);
        const type = sourceStorageSubjectType(source, origin, file);
        const members = selected === undefined || type === undefined ? undefined : memberFlow.membersFor(origin, selected.receiver.type);
        const matching = members?.filter(pair => pair.kind === "present" &&
          (pair.destination.property.symbol === selected?.selectedSymbol || pair.destination.property.symbol === selected?.sourceSymbol ||
            declaration !== undefined && pair.destination.declarations.includes(declaration)));
        if (matching === undefined || matching.length === 0) {
          const reason = "Source member writes require exact checked physical destination correspondence.";
          unresolvedSubjects.set(origin, reason);
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
        for (const pair of matching) {
          if (pair.kind !== "present") continue;
          for (const member of pair.source.declarations) {
            if (!step()) break;
            const copied = rest || ast.is.IsObjectLiteralExpression(origin.node) && ast.parent(member) !== origin.node;
            if (ast.is.IsSetAccessorDeclaration(member) || !copied && ast.is.IsGetAccessorDeclaration(member)) continue;
            const location = copied ? subject(origin.node, origin.kind, [...origin.projection, {
              kind: sourceStorageIsMethodMember(member, ast) ? "method-value" : "member", declaration: member,
            }]) : sourceStorageMemberSubject(member, ast, subject);
            connect(write.value, location);
            storedValues.bind(location, access);
          }
        }
      }
    };
    for (const [invocation, entries] of callbackEntries) {
      if (!step()) return;
      if (entries.length === 0) continue;
      yield () => {
        for (const callback of callbackEntriesFor(invocation)) {
          if (!step()) return;
          for (const candidate of callbackImplementationsFor(callback)) {
            if (!step()) return;
            const consumer = semantics.forNode(invocation);
            const slots = sourceStorageCallableInputSlots(source, candidate, consumer,
              { kind: "source-implementation", signature: undefined }, step);
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
        const slots = sourceStorageCallableInputSlots(source, candidate, consumer,
          { kind: "source-implementation", signature: selected?.selectedSignature }, step);
        const result = selected === undefined ? undefined : consumer.operations.callResult(selected);
        const generator = semantics.forNode(candidate).operations.generator(candidate);
        if (generator !== undefined && invocationImplementationSelection(invocation)?.exact === true &&
          [...invocationImplementations(invocation)].every(owner => semantics.forNode(owner).operations.generator(owner) !== undefined))
          invocationEffects.set(invocation, Object.freeze({ resultAllocation: invocation }));
        if (ast.is.IsCallExpression(invocation) && !ast.hasModifierKind(candidate, "async") && generator === undefined) connect(subject(candidate, "return"), subject(invocation),
          result === undefined ? undefined : { from: result.selectedReturnType, to: result.resultType });
        const receiver = subject(candidate, "receiver");
        if (receiver !== undefined) for (const origin of invocationInputs(receiver, candidate, invocation).subjects) connect(origin, receiver);
        for (const binding of selected?.sourceArgumentBindings ?? []) {
          if (!step()) break;
          if (binding.sourceForm === "spread-sequence" || binding.sourceParameterForm === "rest-sequence") continue;
          const contract = selected?.sourceSelectedSignatureParameters.find(parameter => parameter.parameterIndex === binding.sourceParameterIndex);
          for (const slot of slots ?? []) {
            if (!step()) return;
            if (slot.projection === undefined || slot.effectiveIndex !== binding.effectiveArgumentIndex &&
              !(slot.repeated && binding.effectiveArgumentIndex >= slot.effectiveIndex)) continue;
            const destination = subject(slot.parameter, "input", slot.projection);
            const actual = selected === undefined ? undefined : sourceStorageInvocationActual(source, selected, binding, subject, subjectFor);
            const initialized = Node_Initializer(ast, slot.parameter) !== undefined;
            if (!initialized || selected !== undefined && sourceStorageInvocationArgumentAbsence(source, selected, binding) !== "absent")
              connect(actual, destination, { from: binding.selectedArgumentType, to: binding.selectedParameterType });
            if (!initialized && slot.projection.length === 0) connect(subject(contract?.parameterDeclaration, "input"), destination);
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
      subjectFor, callbackEntriesFor, componentsFor: memberFlow.componentsFor,
      hasSourceImplementation: invocation => [...invocationImplementations(invocation)].some(candidate => ast.body(candidate) !== undefined),
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
    subjectFor, originSubjects, invocationInputs, nativePayloadCandidates,
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
    subject, subjectFor, locationFor, nativeConstructorsFor, bindingInputFor, incomingFor, contextualInputs, contextLocation, memberFlow, regions, invocationTargets,
    invocationDeclarations, invocationEffects, invocations, visitedNodes, pointerInvocations, pointerAccessors, resumedImplementations, thrownOrigins, unresolvedThrows,
    accessorTargets, invocationInputs, sourceFiles, callbackEntriesFor, callbackImplementationsFor, callbackInputFrontiersFor,
    storedValuesFor: storedProjections, storesFor: storedValues.storesFor, storesIn: storedValues.storesIn, invocationImplementations,
    isOpaque: invocation => opaqueInvocations.has(invocation), guardedValues, memberAccessorsFor: memberAccessors.declarationsFor,
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
    if (reason === undefined && implementations?.exact === true &&
      [...implementations.nodes].some(candidate => ast.body(candidate) !== undefined ||
        ast.is.IsClassDeclaration(candidate) || ast.is.IsClassExpression(candidate))) continue;
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
  storedValues.publish();
  sealed = true;
  return { subject, subjectFor, nativeConstructorsFor, locationFor, storageSubject: projections.ownerFor, incomingFor, identities, mutationOwners,
    storedInputsFor: storedValues.inputsFor,
    storedValuesFor: storedProjections,
    storesFor: storedValues.storesFor,
    storesIn: storedValues.storesIn,
    writeAt: storedValues.writeAt,
    invocationImplementationSelection,
    unresolvedStoredInputsFor: storedValues.unresolvedFor,
    sourceFileFor, retainCheckedContext, invocationTargets,
    invocations, pointerInvocations, pointerAccessors, resumedImplementations, invocationEffects, invocationArguments, invocationDeclarations, argumentTransports, unresolvedInvocations, boundaries,
    callbackEntriesFor, callbackImplementationsFor, invocationInputs,
    accessorTargets, visitedNodes, regions, memberFlow, guardedValues, ancestorSubjects, invocationImplementations, physicalMemberInputs,
    invocationOrigins, invocationResults, substitutions, contextualInputs, contextLocation, classLineagesFor, constructionLineagesFor,
    unresolvedFor: unresolved.ancestryFor, directlyUnresolvedFor: unresolved.directFor };
}
