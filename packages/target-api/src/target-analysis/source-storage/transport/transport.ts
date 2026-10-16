import type { Node, SourceFile } from "@tsonic/tsts";
import { sourceStorageHasOriginalValue, sourceStorageIsDataMember, sourceStorageIsMethodMember, sourceStorageMemberSubject } from "../model/subjects.js";
import { Node_Expression, Node_Initializer, ObjectLiteralProperty_Value,
  sourceReceiverOwner } from "../../../source-navigation/index.js";
import { createSourceStorageContextInputs } from "../scoped/context-inputs.js";
import { createSourceStorageContextLocations } from "../graph/context-locations.js";
import { sourceExpressionSelectsOperandValue } from "../../../source-navigation/expression-use.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { createSourceStorageSubjects, type SourceStorageSubject } from "../model/subjects.js";
import { createSourceStorageProjectionFlow } from "../model/projections.js";
import { createSourceStorageStructuralFlow } from "../model/structural-flow.js";
import { createSourceStorageEdges } from "../graph/edges.js";
import type { SourceStorageEdgeTypes } from "../graph/edges.js";
import { createSourceStorageExecutionRegions } from "../graph/execution-regions.js";
import { sourceStorageRegionOwner } from "../graph/lexical-regions.js";
import { sourceStorageConstructionExpression, sourceStorageSuperConstructor } from "../model/construction.js";
import { createSourceStorageUnresolvedQueries } from "../graph/unresolved.js";
import { createSourceStorageSubstitutions } from "../scoped/substitutions.js";
import { createSourceStorageBindingInputs } from "../scoped/scoped-transport.js";
import { createSourceStorageInvocationResults, sourceStorageClassLineages } from "./invocation-results.js";
import { createSourceStorageInvocationInputs } from "../graph/invocation-inputs.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageArgumentTransport, SourceStorageBoundary, SourceStorageCallEffect, SourceStorageEffects } from "../model/types.js";
import { snapshotSourceStorageCallEffect } from "../graph/call-effects.js";
import { sourceMemberOwner, sourceParameterIsProperty } from "../../../source-navigation/class-members.js";
import { createSourceStorageMemberFlow } from "../graph/member-flow.js";
import { createSourceStorageStoredValues } from "../graph/stored-values.js";
import { createSourceStorageStoreProjections } from "../graph/store-projections.js";
import { createSourceStorageGraphQueries, type SourceStorageReconciliation } from "../graph/graph-queries.js";
import { sourceBindingWriteAtReference } from "../../../source-navigation/references-usage.js";
import { createSourceStorageAncestorQuery } from "../graph/ancestors.js";
import { createSourceStorageGuardedValues } from "../graph/guarded-values.js";
import { sourceStorageIsScalarType } from "../model/components.js";
import { createSourceStorageMemberAccessors } from "../scoped/member-accessors.js";

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
  const invocationEffects = new Map<Node, SourceStorageCallEffect>();
  const invocationTargets = new Map<Node, SourceStorageSubject>();
  const invocationArguments = new Map<Node, readonly Node[]>();
  const invocationDeclarations = new Map<Node, Node>();
  const argumentTransports = new Map<Node, readonly SourceStorageArgumentTransport[]>();
  const checkedSourceFiles = new Map<Node, SourceFile>();
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
    const pattern = selected !== undefined && ast.is.IsBindingElement(selected) ? ast.parent(selected) : undefined;
    const projected = pattern !== undefined && ast.is.IsArrayBindingPattern(pattern);
    const binding = selected === undefined || !projected ? undefined : projections.binding(selected);
    if (projected && binding === undefined) return undefined;
    const value = qualified ? subject(node) : binding ?? subject(target);
    if (value === undefined) return undefined;
    if (pattern !== undefined && ast.is.IsObjectBindingPattern(pattern))
      unresolvedSubjects.set(value, "An object binding requires exact checked source storage component transport.");
    if (binding !== undefined) subjects.set(selected!, binding);
    subjects.set(node, value);
    if (qualified) connect(binding ?? subjectFor(selected), value);
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
    implementationsFor: (declaration, invocation) => implementationsFor(declaration, invocation).nodes,
  }, graphQueries);
  const accessorTargets = memberAccessors.targets;
  const storedValues = createSourceStorageStoredValues(ast, budget, regions.enclosing, node => {
    const selected = ast.is.IsPropertyAccessExpression(node) ? semantics.forNode(node).operations.propertyAccess(node)
      : ast.is.IsElementAccessExpression(node) ? semantics.forNode(node).operations.elementAccess(node) : undefined;
    return subjectFor(selected?.receiver.expression);
  });
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
  const visit = (node: Node): void => {
    visitedNodes.push(node);
    if (ast.is.IsIdentifier(node) || ast.is.IsVariableDeclaration(node) || ast.is.IsParameterDeclaration(node) ||
      ast.is.IsPropertyDeclaration(node) || ast.is.IsFunctionDeclaration(node) || ast.is.IsArrowFunction(node) ||
      ast.is.IsElementAccessExpression(node) || valueWrapper(node) || ast.kindName(node) === "KindThisKeyword") subjectFor(node);
    if ((ast.is.IsMethodDeclaration(node) || ast.is.IsGetAccessorDeclaration(node) ||
      ast.is.IsSetAccessorDeclaration(node)) && ast.body(node) !== undefined) {
      const contracts = navigation.memberContracts(node);
      if (contracts.kind === "resolved") {
        for (const contract of contracts.contracts) {
          if (!step()) return;
          const implementations = memberImplementations.get(contract) ?? new Set<Node>();
          implementations.add(node);
          memberImplementations.set(contract, implementations);
        }
      }
    }
    if (ast.is.IsVariableDeclaration(node)) {
      const initializer = Node_Initializer(ast, node);
      const parent = ast.parent(node);
      const original = parent !== undefined && ast.is.IsCatchClause(parent) ? subject(node, "input") : subjectFor(initializer);
      connect(original, subject(node));
      storedValues.initialize(subject(node), initializer ?? node, original);
    }
    if (ast.is.IsIdentifier(node) || ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node)) {
      const write = storedValues.writeFor(node, subjectFor);
      if (write !== undefined) storedValues.recordWrite(locationFor(node), write);
    }
    const parent = ast.parent(node);
    if (parent !== undefined && sourceExpressionSelectsOperandValue(ast, parent, node))
      connect(subjectFor(node), subject(parent));
    if (ast.is.IsArrayLiteralExpression(node)) projections.literal(node);
    if (ast.is.IsPropertyDeclaration(node)) {
      connect(subjectFor(Node_Initializer(ast, node)), subject(node));
      storedValues.initialize(subject(node), Node_Initializer(ast, node) ?? node, subjectFor(Node_Initializer(ast, node)));
    }
    if (ast.is.IsParameterDeclaration(node)) {
      const input = subject(node, "input");
      connect(input, subject(node));
      connect(subjectFor(Node_Initializer(ast, node)), input);
      if (sourceParameterIsProperty(ast, node)) {
        const member = sourceStorageMemberSubject(node, ast, subject);
        connect(input, member);
        storedValues.initialize(member, node, input);
      }
    }
    if ((ast.is.IsPropertyAssignment(node) || ast.is.IsShorthandPropertyAssignment(node)) &&
      sourceBindingWriteAtReference(ast, node) === undefined) {
      connect(subjectFor(ObjectLiteralProperty_Value(ast, node)), subject(node));
      storedValues.initialize(subject(node), ObjectLiteralProperty_Value(ast, node) ?? node, subjectFor(ObjectLiteralProperty_Value(ast, node)));
    }
    if (ast.is.IsArrowFunction(node)) {
      const body = ast.as.AsArrowFunction(node)?.Body;
      if (body !== undefined && !ast.is.IsBlock(body)) connect(subjectFor(body), subject(node, "return"));
    }
    if (ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindEqualsToken") {
      const binary = ast.as.AsBinaryExpression(node);
      if (binary?.Left !== undefined) connect(subjectFor(binary.Right), locationFor(binary.Left));
    }
    if (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node)) {
      const property = ast.is.IsPropertyAccessExpression(node) ? semantics.forNode(node).operations.propertyAccess(node) : undefined;
      const selected = property ?? semantics.forNode(node).operations.elementAccess(node);
      const declaration = property?.selectedReadDeclaration ?? selected?.selectedDeclaration;
      if (declaration !== undefined && !ast.is.IsGetAccessorDeclaration(declaration) &&
        (ast.is.IsPropertyAccessExpression(node) || sourceStorageIsDataMember(declaration, ast)))
        connect(sourceStorageMemberSubject(declaration, ast, subject), subjectFor(node));
      if (selected?.selectedDeclaration !== undefined) memberAccessors.record(node);
      if (selected !== undefined && selected.accessMode !== "read") {
        const owner = subjectFor(selected.receiver.expression);
        if (owner !== undefined) mutationOwners.set(node, owner);
      }
    }
    if (ast.is.IsReturnStatement(node)) connect(subjectFor(Node_Expression(ast, node)), subject(enclosingCallable(node), "return"));
    if (ast.is.IsThrowStatement(node)) {
      const origin = subjectFor(Node_Expression(ast, node));
      const caught = regions.catchDestination(node);
      if (caught !== undefined) connect(origin, subject(caught, "input"));
      else {
        const region = regions.enclosing(node);
        if (region !== undefined && origin !== undefined) recordThrow(region, origin);
      }
    }
    if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) {
      invocations.add(node);
      regions.recordInvocation(node);
      const selected = semantics.forNode(node).operations.call(node);
      const contributed = selected === undefined ? undefined : effects.call?.(node, selected);
      if (contributed !== undefined && selected !== undefined) {
        const effect = snapshotSourceStorageCallEffect(contributed, selected, budget);
        if (effect !== undefined) {
          if (effect.resultAllocation !== undefined && effect.resultAllocation !== node) {
            budget.reject("Source storage allocation requires its exact checked invocation owner.");
            return;
          }
          invocationEffects.set(node, effect);
          if (effect.resultAlias !== undefined) connect(subjectFor(effect.resultAlias), subjectFor(node));
        }
      }
      const signature = selected === undefined ? undefined
        : semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
      if (selected !== undefined && (signature !== undefined || ast.is.IsNewExpression(node))) {
        if (signature !== undefined) invocationDeclarations.set(node, signature);
        const target = subjectFor(Node_Expression(ast, node));
        if (target !== undefined) invocationTargets.set(node, target);
        const base = sourceStorageSuperConstructor(node, source, step);
        if (base !== undefined) connect(subjectFor(base.callee), target);
        invocationArguments.set(node, Object.freeze([
          ...selected.sourceArguments.map(argument => argument.expression),
          ...(selected.sourceReceiver === undefined ? [] : [selected.sourceReceiver.expression]),
        ]));
        const arguments_: SourceStorageArgumentTransport[] = [];
        for (const binding of selected.sourceArgumentBindings) {
          if (!step()) break;
          const formal = selected.sourceSelectedSignatureParameters.find(parameter =>
            parameter.parameterIndex === binding.sourceParameterIndex)?.parameterDeclaration;
          const actual = subjectFor(selected.sourceArguments[binding.sourceArgumentIndex]?.expression);
          if (formal === undefined || actual === undefined || binding.sourceForm !== "value" || binding.sourceParameterForm !== "parameter") {
            unresolvedInvocations.set(node, "Source storage argument transport requires exact selected scalar formal and actual subjects.");
            continue;
          }
          const destination = subject(formal, "input");
          if (destination === undefined || !budget.row()) break;
          const formalFile = ast.getSourceFile(formal);
          if (formalFile === undefined || !semantics.includes(formalFile)) {
            const checkedFile = ast.getSourceFile(node);
            if (checkedFile === undefined || !semantics.includes(checkedFile)) {
              unresolvedInvocations.set(node, "A selected formal requires its exact checked invocation source-file owner.");
              continue;
            }
            if (!retainCheckedContext(formal, checkedFile)) break;
          }
          arguments_.push(Object.freeze({ actual, formal: destination, selectedParameterDeclaration: formal,
            binding: Object.freeze({ ...binding }) }));
          connect(actual, destination, { from: binding.selectedArgumentType, to: binding.selectedParameterType });
        }
        argumentTransports.set(node, Object.freeze(arguments_));
      } else {
        unresolvedInvocations.set(node, "An invocation has no exact checked selected signature transport.");
      }
    }
  };
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
    captureOwner?: Node) => {
    const valuesFor = (subject: SourceStorageSubject) => {
      const origins = originsFor === originSubjects ? classValueSubjects(subject) : originsFor(subject);
      return origins === undefined ? undefined : new Set([...origins].map(origin => ({ subject: origin, bindings: undefined })));
    };
    const target = subjectFor(expression);
    return target === undefined ? undefined : sourceStorageClassLineages(source, budget, valuesFor(target), { subjectFor, valuesFor }, captureOwner);
  };
  const constructionLineagesFor = (invocation: Node,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined = originSubjects,
    captureOwner?: Node) =>
    classLineagesFor(sourceStorageConstructionExpression(invocation, source, step), originsFor, captureOwner);
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
  const implementationsFor = (declaration: Node, invocation: Node,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined = originSubjects): { readonly nodes: ReadonlySet<Node>; readonly exact: boolean;
      readonly slots?: ReadonlySet<SourceStorageSubject> } => {
    const selected = new Set<Node>();
    const implementation = navigation.callableImplementation(declaration);
    if (implementation.kind === "resolved") selected.add(implementation.implementation.declaration);
    if (ast.hasModifierKind(declaration, "static") || ast.hasModifierKind(declaration, "private") ||
      !ast.is.IsMethodDeclaration(declaration) && ast.kindName(declaration) !== "KindMethodSignature" &&
      !ast.is.IsGetAccessorDeclaration(declaration) && !ast.is.IsSetAccessorDeclaration(declaration))
        return { nodes: selected, exact: implementation.kind === "resolved" };
    const queries = semantics.forNode(invocation);
    const call = queries.operations.call(invocation);
    const access = queries.operations.propertyAccess(invocation);
    const receiver = call?.sourceReceiver?.expression ?? call?.sourceCalleeAccess?.receiver.expression
      ?? access?.receiver.expression;
    const receiverType = call?.sourceReceiver?.type ?? call?.sourceCalleeAccess?.receiver.type ?? access?.receiver.type;
    const valueType = receiver === undefined ? undefined : queries.types.expressionType(receiver);
    if (valueType !== undefined && sourceStorageIsScalarType(valueType, queries))
      return { nodes: selected, exact: true };
    if (ast.kindName(receiver) === "KindSuperKeyword") return { nodes: selected, exact: true };
    const receiverSubject = subjectFor(receiver);
    const origins = receiverSubject === undefined ? undefined : originsFor(receiverSubject);
    const exact = new Set<Node>();
    const slots = new Set<SourceStorageSubject>();
    let unknown = receiverSubject === undefined;
    const selectMember = (member: Node): void => {
      if (ast.is.IsGetAccessorDeclaration(member) || ast.is.IsSetAccessorDeclaration(member)) {
        exact.add(member);
        return;
      }
      const slot = sourceStorageMemberSubject(member, ast, subject);
      if (slot !== undefined) slots.add(slot);
      const values = slot === undefined ? undefined : originsFor(slot);
      for (const value of values ?? []) {
        if (!step()) return;
        if (!sourceStorageHasOriginalValue(value, ast, incomingFor(value).size !== 0)) continue;
        const implementation = navigation.callableImplementation(value.node);
        if (implementation.kind !== "resolved") { unknown = true; continue; }
        exact.add(implementation.implementation.declaration);
      }
    };
    for (const origin of origins ?? []) {
      if (!step()) return { nodes: selected, exact: false };
      if (ast.is.IsParameterDeclaration(origin.node)) unknown = true;
      if (incomingFor(origin).size !== 0) continue;
      if (ast.is.IsNewExpression(origin.node)) {
        const lineages = constructionLineagesFor(origin.node, originsFor);
        unknown ||= lineages === undefined || lineages.length === 0 || lineages.some(lineage => !lineage.complete);
        for (const lineage of lineages ?? []) {
          const concrete = lineage.classes[0]?.subject.node;
          const target = concrete === undefined ? undefined : navigation.memberImplementation(concrete, declaration);
          if (target?.kind !== "resolved") { unknown = true; continue; }
          const original = target.implementation.declaration;
          exact.add(original);
          const slot = sourceStorageMemberSubject(original, ast, subject);
          if (slot !== undefined && storedValues.storesFor(slot) !== undefined) selectMember(original);
        }
      } else if (ast.is.IsObjectLiteralExpression(origin.node)) {
        const members = receiverType === undefined ? undefined : memberFlow.declarationsFor(origin, declaration, receiverType);
        unknown ||= members === undefined;
        for (const member of members ?? []) {
          if (!step()) return { nodes: selected, exact: false };
          selectMember(member);
        }
      } else unknown = true;
    }
    if (!unknown) return { nodes: exact, exact: true, slots };
    for (const implementation of exact) selected.add(implementation);
    for (const target of memberImplementations.get(declaration) ?? []) {
      if (!step()) break;
      selected.add(target);
    }
    return { nodes: selected, exact: false };
  };
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
      const selected = implementationsFor(declaration, invocation, originsFor);
      if (selected.exact) return selected;
      for (const implementation of selected.nodes) implementations.add(implementation);
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
      const selected = implementationsFor(accessor, invocation, originsFor);
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
  const physicalMemberInputs = (invocation: Node,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined = originSubjects): ReadonlySet<SourceStorageSubject> | undefined => {
    const declaration = invocationDeclarations.get(invocation) ?? accessorTargets.get(invocation)?.[0];
    if (declaration === undefined) return undefined;
    const selected = implementationsFor(declaration, invocation, originsFor);
    return selected.exact ? selected.slots : undefined;
  };
  const invocationInputs = createSourceStorageInvocationInputs(source, budget, subject, subjectFor,
    invocation => accessorTargets.has(invocation), invocation => unresolvedInvocations.has(invocation));
  const invocationOrigins = (origin: SourceStorageSubject, candidate: Node, invocation: Node): ReadonlySet<SourceStorageSubject> => {
    const origins = new Set<SourceStorageSubject>();
    if (unresolvedInvocations.has(invocation)) return origins;
    const pending = [origin];
    const visited = new Set<SourceStorageSubject>();
    while (pending.length !== 0 && step()) {
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      if (current.kind === "receiver" || current.kind === "input") {
        for (const input of invocationInputs(current, candidate, invocation).subjects) {
          if (!step()) break;
          origins.add(input);
        }
      } else {
        const incomingOrigins = incomingFor(current);
        if (sourceStorageHasOriginalValue(current, ast, incomingOrigins.size !== 0)) origins.add(current);
        for (const incomingOrigin of incomingOrigins) { if (!step()) break; pending.push(incomingOrigin); }
      }
    }
    return origins;
  };

  const operations = function* (): Generator<SourceStorageReconciliation> {
    for (const [access, owner] of mutationOwners) yield once => {
      if (!step()) return;
      const parent = ast.parent(access);
      const assignment = parent === undefined || !ast.is.IsBinaryExpression(parent) ? undefined : ast.as.AsBinaryExpression(parent);
      const property = ast.is.IsPropertyAccessExpression(access) ? semantics.forNode(access).operations.propertyAccess(access) : undefined;
      const selected = property ?? semantics.forNode(access).operations.elementAccess(access);
      const declaration = property?.selectedWriteDeclaration ?? selected?.selectedDeclaration;
      if (declaration === undefined || selected === undefined) return;
      const write = storedValues.writeFor(access, subjectFor)
        ?? { reference: access, operation: parent ?? access, reason: "Source storage mutation requires its exact selected value producer." };
      storedValues.recordWrite(locationFor(access), write);
      for (const origin of originSubjects(owner) ?? []) {
        if (!step()) break;
        if (!ast.is.IsObjectLiteralExpression(origin.node) && !ast.is.IsNewExpression(origin.node)) continue;
        if (!once(origin)) continue;
        for (const member of memberFlow.declarationsFor(origin, declaration, selected.receiver.type) ?? []) {
          if (!step()) break;
          if (ast.is.IsGetAccessorDeclaration(member) || ast.is.IsSetAccessorDeclaration(member)) continue;
          const location = sourceStorageMemberSubject(member, ast, subject);
          if (assignment?.Left === access && ast.operatorKindName(parent!) === "KindEqualsToken")
            connect(subjectFor(assignment.Right), location);
          storedValues.bind(location, access);
        }
      }
    };
    for (const invocation of invocationTargets.keys()) yield once => {
      for (const candidate of invocationImplementations(invocation)) {
        if (!once(candidate)) continue;
        const parameters = ast.is.IsClassDeclaration(candidate) || ast.is.IsClassExpression(candidate) ? [] : ast.parameters(candidate);
        const selected = semantics.forNode(invocation).operations.call(invocation);
        const result = selected === undefined ? undefined : semantics.forNode(invocation).operations.callResult(selected);
        if (ast.is.IsCallExpression(invocation) && !ast.hasModifierKind(candidate, "async")) connect(subject(candidate, "return"), subject(invocation),
          result === undefined ? undefined : { from: result.selectedReturnType, to: result.resultType });
        const receiver = subject(candidate, "receiver");
        if (receiver !== undefined) for (const origin of invocationInputs(receiver, candidate, invocation).subjects) connect(origin, receiver);
        for (const binding of selected?.sourceArgumentBindings ?? []) {
          if (!step()) break;
          if (binding.sourceForm !== "value" || binding.sourceParameterForm !== "parameter") continue;
          const parameter = parameters[binding.sourceParameterIndex];
          const contract = selected?.sourceSelectedSignatureParameters.find(parameter => parameter.parameterIndex === binding.sourceParameterIndex);
          connect(subjectFor(selected?.sourceArguments[binding.sourceArgumentIndex]?.expression), subject(parameter, "input"),
            { from: binding.selectedArgumentType, to: binding.selectedParameterType });
          connect(subject(contract?.parameterDeclaration, "input"), subject(parameter, "input"));
        }
      }
    };
    yield* memberAccessors.operations();
    for (const invocation of new Set([...invocations, ...memberAccessors.sites])) yield () => {
      if (!step()) return;
      const destination = regions.catchDestination(invocation);
      const enclosing = destination === undefined ? regions.enclosing(invocation) : undefined;
      const reason = unresolvedInvocations.get(invocation);
      if (reason !== undefined) {
        const caught = destination === undefined ? undefined : subject(destination, "input");
        if (caught !== undefined) unresolvedSubjects.set(caught, reason);
        else if (enclosing !== undefined) recordUnresolvedThrow(enclosing, reason);
        return;
      }
      const targets = [...invocationImplementations(invocation)].map(candidate => ({ candidate,
        regions: regions.callable(candidate, accessorTargets.has(invocation) ? undefined : invocation) }));
      if (sourceStorageConstructionExpression(invocation, source, step) !== undefined) {
        const instance = regions.instance(invocation);
        if (instance === undefined) return;
        for (const region of instance.regions) targets.push({ candidate: region.owner, regions: [region.node] });
      }
      for (const target of targets) {
        for (const region of target.regions) {
          graphQueries.read({ node: region, kind: thrownOrigins });
          const reason = unresolvedThrows.get(region);
          if (reason !== undefined) {
            const caught = destination === undefined ? undefined : subject(destination, "input");
            if (caught !== undefined) unresolvedSubjects.set(caught, reason);
            else if (enclosing !== undefined) recordUnresolvedThrow(enclosing, reason);
          }
          for (const origin of thrownOrigins.get(region) ?? []) {
            for (const actual of invocationOrigins(origin, target.candidate, invocation)) {
              if (destination !== undefined) connect(actual, subject(destination, "input"));
              else if (enclosing !== undefined) recordThrow(enclosing, actual);
            }
          }
        }
      }
    };
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
  const invocationResults = createSourceStorageInvocationResults(source, budget, {
    subject, subjectFor,
    targetFor: invocation => invocationTargets.get(invocation),
    valuesFor: (origin, bindings) => substitutions.values(origin, bindings),
    bindingsFor: (candidate, invocation, bindings, captured, callee) => substitutions.forInvocation(candidate, invocation, bindings, captured, callee),
    hasResultAlias: invocation => invocationEffects.get(invocation)?.resultAlias !== undefined,
  });
  const storedProjections = createSourceStorageStoreProjections(budget, subject, storedValues.storesFor, edges.projectOrigin);
  const bindingInputFor = createSourceStorageBindingInputs(ast, { incomingFor, guardedValues }, budget);
  const substitutions = createSourceStorageSubstitutions(source, budget, {
    subject, subjectFor, bindingInputFor, incomingFor, contextualInputs, contextLocation, memberFlow, regions, invocationTargets,
    invocationDeclarations, invocationEffects, invocations, accessorTargets, sourceFiles,
    storedValuesFor: storedProjections, storesIn: storedValues.storesIn, invocationImplementations,
    isOpaque: invocation => opaqueInvocations.has(invocation), guardedValues, memberAccessorsFor: memberAccessors.declarationsFor,
  }, invocationInputs, graphQueries);
  const unresolved = createSourceStorageUnresolvedQueries(budget, subject,
    selected => substitutions.walk(selected, substitutions.empty), unresolvedSubjects);
  const boundaries: SourceStorageBoundary[] = [];
  for (const invocation of invocations) {
    if (!step()) break;
    const reason = unresolvedInvocations.get(invocation);
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
  sealed = true;
  return { subject, subjectFor, locationFor, storageSubject: projections.ownerFor, incomingFor, identities, mutationOwners,
    storedInputsFor: storedValues.inputsFor,
    storesFor: storedValues.storesFor,
    storesIn: storedValues.storesIn,
    invocationImplementationSelection,
    unresolvedStoredInputsFor: storedValues.unresolvedFor,
    sourceFileFor, retainCheckedContext, invocationTargets,
    invocations, invocationEffects, invocationArguments, invocationDeclarations, argumentTransports, unresolvedInvocations, boundaries,
    accessorTargets, visitedNodes, regions, memberFlow, guardedValues, ancestorSubjects, invocationImplementations, physicalMemberInputs,
    invocationOrigins, invocationResults, substitutions, contextualInputs, contextLocation, classLineagesFor, constructionLineagesFor,
    unresolvedFor: unresolved.ancestryFor, directlyUnresolvedFor: unresolved.directFor };
}
