import type { Node, SourceFile } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer, ObjectLiteralProperty_Value, sourceConstructorParametersMatch } from "../../source-navigation/index.js";
import { sourceExpressionSelectsOperandValue } from "../../source-navigation/expression-use.js";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { createSourceStorageSubjects, type SourceStorageSubject } from "./subjects.js";
import { createSourceStorageProjectionFlow } from "./projections.js";
import { createSourceStorageStructuralFlow } from "./structural-flow.js";
import { createSourceStorageEdges } from "./edges.js";
import { createSourceStorageExecutionRegions } from "./execution-regions.js";
import { sourceStorageConstructedClass } from "./construction.js";
import { createSourceStorageUnresolvedQuery } from "./unresolved.js";
import { createSourceStorageSubstitutions } from "./substitutions.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageArgumentTransport, SourceStorageBoundary, SourceStorageCallEffect, SourceStorageEffects } from "./types.js";
import { snapshotSourceStorageCallEffect } from "./call-effects.js";

export function createSourceStorageTransport(
  source: TargetSourceProgram,
  sourceFiles: readonly SourceFile[],
  budget: SourceStorageBudget,
  effects: SourceStorageEffects = {},
) {
  const { ast, navigation, semantics } = source;
  const subjects = new Map<Node, SourceStorageSubject>();
  const identities = new Set<SourceStorageSubject>();
  const mutationOwners = new Map<Node, SourceStorageSubject>();
  const invocations = new Set<Node>();
  const invocationEffects = new Map<Node, SourceStorageCallEffect>();
  const invocationTargets = new Map<Node, SourceStorageSubject>();
  const invocationArguments = new Map<Node, readonly Node[]>();
  const invocationDeclarations = new Map<Node, Node>();
  const implicitConstructions = new Set<Node>();
  const argumentTransports = new Map<Node, readonly SourceStorageArgumentTransport[]>();
  const checkedSourceFiles = new Map<Node, SourceFile>();
  const unresolvedInvocations = new Map<Node, string>();
  const accessorTargets = new Map<Node, readonly Node[]>();
  const memberImplementations = new Map<Node, Set<Node>>();
  const thrownOrigins = new Map<Node, Set<SourceStorageSubject>>();
  const unresolvedThrows = new Map<Node, string>();
  const unresolvedSubjects = new Map<SourceStorageSubject, string>();
  const visitedNodes: Node[] = [];
  let edgeCount = 0;
  let throwCount = 0;
  let sealed = false;
  const internSubject = createSourceStorageSubjects(budget.subject, budget.reject);
  const subject: typeof internSubject = (node, kind, projection) => {
    const selected = internSubject(node, kind, projection);
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
  const { add: addEdge, incomingFor } = createSourceStorageEdges(source, budget, subject, sourceFileFor);
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
    for (let parent = ast.parent(node); parent !== undefined && step(); parent = ast.parent(parent)) {
      if (ast.is.IsClassDeclaration(parent) || ast.is.IsClassExpression(parent)) return subject(parent, "receiver");
      if (ast.is.IsFunctionDeclaration(parent) || ast.is.IsFunctionExpression(parent) ||
        ast.is.IsMethodDeclaration(parent) || ast.is.IsConstructorDeclaration(parent) ||
        ast.is.IsGetAccessorDeclaration(parent) || ast.is.IsSetAccessorDeclaration(parent)) return subject(parent, "receiver");
    }
    return undefined;
  };
  const catchDestination = (node: Node): Node | undefined => {
    let child = node;
    for (let parent = ast.parent(node); parent !== undefined && step(); child = parent, parent = ast.parent(parent)) {
      if (ast.is.IsFunctionDeclaration(parent) || ast.is.IsFunctionExpression(parent) || ast.is.IsArrowFunction(parent) ||
        ast.is.IsMethodDeclaration(parent) || ast.is.IsConstructorDeclaration(parent) ||
        ast.is.IsGetAccessorDeclaration(parent) || ast.is.IsSetAccessorDeclaration(parent)) return undefined;
      if (!ast.is.IsTryStatement(parent)) continue;
      const selected = ast.as.AsTryStatement(parent);
      if (selected !== undefined && selected.TryBlock === child) {
        const caught = selected.CatchClause === undefined || !ast.is.IsCatchClause(selected.CatchClause)
          ? undefined : ast.as.AsCatchClause(selected.CatchClause)?.VariableDeclaration;
        if (caught !== undefined) return caught;
      }
    }
    return undefined;
  };
  const subjectFor = (node: Node | undefined): SourceStorageSubject | undefined => {
    if (node === undefined) return undefined;
    const original = node;
    while (step()) {
      const cached = subjects.get(node);
      if (cached !== undefined) return cached;
      if (!ast.is.IsParenthesizedExpression(node) && !ast.is.IsAsExpression(node) &&
        !ast.is.IsSatisfiesExpression(node) && !ast.is.IsNonNullExpression(node) && !ast.is.IsTypeAssertion(node)) break;
      const expression = Node_Expression(ast, node);
      if (expression === undefined) return undefined;
      node = expression;
    }
    if (budget.failure() !== undefined) return undefined;
    if (ast.kindName(node) === "KindThisKeyword") {
      const receiver = receiverFor(node);
      if (receiver !== undefined) subjects.set(node, receiver);
      return receiver;
    }
    if (ast.is.IsElementAccessExpression(node)) {
      const value = projections.indexed(node);
      if (value !== undefined) {
        subjects.set(original, value);
        subjects.set(node, value);
      }
      return value;
    }
    const reference = ast.is.IsBindingElement(node) ? node : navigation.sourceReferenceFor(node)?.declaration;
    if (reference !== undefined && ast.is.IsBindingElement(reference)) {
      const value = projections.binding(reference);
      if (value !== undefined) {
        subjects.set(reference, value);
        subjects.set(node, value);
        subjects.set(original, value);
        return value;
      }
    }
    const selected = ast.is.IsElementAccessExpression(node) || ast.is.IsCallExpression(node) ? node
      : ast.is.IsPropertyAccessExpression(node)
        ? semantics.forNode(node).operations.propertyAccess(node)?.selectedReadDeclaration
          ?? semantics.forNode(node).operations.propertyAccess(node)?.selectedDeclaration
      : navigation.sourceReferenceFor(node)?.declaration;
    const target = selected !== undefined && !ast.is.IsGetAccessorDeclaration(selected) ? selected : node;
    const value = subject(target);
    if (value === undefined) return undefined;
    subjects.set(node, value);
    subjects.set(original, value);
    return value;
  };
  const connect = (origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined): void => {
    if (origin === undefined || destination === undefined || origin === destination || budget.failure() !== undefined) return;
    const origins = incomingFor(destination);
    if (origins.has(origin)) return;
    if (sealed) { budget.reject("Source storage transport cannot add edges after graph construction is sealed."); return; }
    if (!addEdge(origin, destination)) return;
    edgeCount += 1;
    connectStructuralFlow(origin, destination);
  };
  const connectStructuralFlow = createSourceStorageStructuralFlow(source, step, subject, connect,
    sourceFileFor, retainCheckedContext);
  const projections = createSourceStorageProjectionFlow(source, step, subject, subjectFor, connect,
    (subject, reason) => unresolvedSubjects.set(subject, reason), sourceFileFor);
  const connectValueFlow = (expression: Node | undefined): void => {
    if (expression === undefined) return;
    const subject = subjectFor(expression);
    for (const declaration of navigation.expressionValueFlow(expression).aliasDeclarations) {
      if (!step()) return;
      connect(subject, subjectFor(declaration));
    }
  };

  const regions = createSourceStorageExecutionRegions(source, step);
  const recordThrow = (region: Node, origin: SourceStorageSubject): void => {
    const origins = thrownOrigins.get(region) ?? new Set<SourceStorageSubject>();
    if (origins.has(origin) || !budget.row()) return;
    origins.add(origin);
    thrownOrigins.set(region, origins);
    throwCount += 1;
  };
  const recordUnresolvedThrow = (region: Node, reason: string): void => {
    if (unresolvedThrows.has(region) || !budget.row()) return;
    unresolvedThrows.set(region, reason);
    throwCount += 1;
  };
  const visit = (node: Node): void => {
    visitedNodes.push(node);
    if (ast.is.IsIdentifier(node) || ast.is.IsVariableDeclaration(node) || ast.is.IsParameterDeclaration(node) ||
      ast.is.IsPropertyDeclaration(node) || ast.is.IsFunctionDeclaration(node) || ast.is.IsArrowFunction(node)) subjectFor(node);
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
      connectValueFlow(Node_Initializer(ast, node));
      connect(subjectFor(Node_Initializer(ast, node)), subject(node));
    }
    const parent = ast.parent(node);
    if (parent !== undefined && sourceExpressionSelectsOperandValue(ast, parent, node))
      connect(subjectFor(node), subject(parent));
    if (ast.is.IsArrayLiteralExpression(node)) projections.literal(node);
    if (ast.is.IsPropertyDeclaration(node) || ast.is.IsParameterDeclaration(node)) {
      connect(subjectFor(Node_Initializer(ast, node)), subject(node));
    }
    if (ast.is.IsPropertyAssignment(node) || ast.is.IsShorthandPropertyAssignment(node)) {
      connect(subjectFor(ObjectLiteralProperty_Value(ast, node)), subject(node));
    }
    if (ast.is.IsArrowFunction(node)) {
      const body = ast.as.AsArrowFunction(node)?.Body;
      if (body !== undefined && !ast.is.IsBlock(body)) connect(subjectFor(body), subject(node, "return"));
    }
    if (ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindEqualsToken") {
      const binary = ast.as.AsBinaryExpression(node);
      connectValueFlow(binary?.Right);
      if (binary?.Left !== undefined && !ast.is.IsIdentifier(binary.Left)) connect(subjectFor(binary.Right), subjectFor(binary.Left));
    }
    if (ast.is.IsPropertyAccessExpression(node)) {
      const selected = semantics.forNode(node).operations.propertyAccess(node);
      const targets = [
        ...(selected?.accessMode === "write" ? [] : [selected?.selectedReadDeclaration ?? selected?.selectedDeclaration]),
        ...(selected?.accessMode === "read" ? [] : [selected?.selectedWriteDeclaration ?? selected?.selectedDeclaration]),
      ].filter((target): target is Node => target !== undefined &&
        (ast.is.IsGetAccessorDeclaration(target) || ast.is.IsSetAccessorDeclaration(target)));
      if (targets.length !== 0) accessorTargets.set(node, Object.freeze(targets));
      if (selected !== undefined && selected.accessMode !== "read") {
        const owner = subjectFor(selected.receiver.expression);
        if (owner !== undefined) mutationOwners.set(node, owner);
      }
    }
    if (ast.is.IsReturnStatement(node)) connect(subjectFor(Node_Expression(ast, node)), subject(enclosingCallable(node), "return"));
    if (ast.is.IsThrowStatement(node)) {
      const origin = subjectFor(Node_Expression(ast, node));
      const caught = catchDestination(node);
      if (caught !== undefined) connect(origin, subject(caught));
      else {
        const region = regions.enclosing(node);
        if (region !== undefined && origin !== undefined) recordThrow(region, origin);
      }
    }
    if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) {
      invocations.add(node);
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
      let signature = selected === undefined ? undefined
        : semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
      if (selected !== undefined && signature === undefined && ast.is.IsNewExpression(node)) {
        const declaration = sourceStorageConstructedClass(node, source, step);
        const constructors = declaration === undefined ? undefined : navigation.classConstructors(declaration);
        if (constructors?.kind === "resolved" && constructors.implicit) {
          const matches = constructors.signatures.filter(candidate =>
            sourceConstructorParametersMatch(candidate.parameters, selected.sourceSelectedSignatureParameters));
          if (matches.length === 1) {
            signature = matches[0]!.declaration ?? declaration;
            implicitConstructions.add(node);
          }
        }
      }
      if (selected !== undefined && signature !== undefined) {
        invocationDeclarations.set(node, signature);
        const implementation = navigation.callableImplementation(signature);
        const callee = Node_Expression(ast, node);
        const target = implementation.kind === "resolved" && ast.body(implementation.implementation.declaration) !== undefined
          ? subject(implementation.implementation.declaration) : subjectFor(callee);
        if (target !== undefined) invocationTargets.set(node, target);
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
          const destination = subject(formal);
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
          connect(actual, destination);
        }
        argumentTransports.set(node, Object.freeze(arguments_));
      } else {
        unresolvedInvocations.set(node, "An invocation has no exact checked selected signature transport.");
      }
      if (ast.is.IsNewExpression(node)) connectValueFlow(node);
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
  const ancestorSubjects = (selected: SourceStorageSubject): ReadonlySet<SourceStorageSubject> | undefined => {
    const pending = [selected];
    const visited = new Set<SourceStorageSubject>();
    for (let index = 0; index < pending.length; index += 1) {
      const current = pending[index]!;
      if (visited.has(current)) continue;
      visited.add(current);
      if (!step()) return undefined;
      for (const origin of incomingFor(current)) { if (!step()) break; pending.push(origin); }
    }
    return visited;
  };
  const implementationsFor = (declaration: Node, invocation: Node,
    originsFor = ancestorSubjects): ReadonlySet<Node> => {
    const selected = new Set<Node>();
    const implementation = navigation.callableImplementation(declaration);
    if (implementation.kind === "resolved") selected.add(implementation.implementation.declaration);
    if (ast.hasModifierKind(declaration, "static") || ast.hasModifierKind(declaration, "private") ||
      !ast.is.IsMethodDeclaration(declaration) && ast.kindName(declaration) !== "KindMethodSignature" &&
      !ast.is.IsGetAccessorDeclaration(declaration) && !ast.is.IsSetAccessorDeclaration(declaration)) return selected;
    const call = semantics.forNode(invocation).operations.call(invocation);
    const receiver = call?.sourceReceiver?.expression ?? call?.sourceCalleeAccess?.receiver.expression
      ?? semantics.forNode(invocation).operations.propertyAccess(invocation)?.receiver.expression;
    if (ast.kindName(receiver) === "KindSuperKeyword") return selected;
    const receiverSubject = subjectFor(receiver);
    const origins = receiverSubject === undefined ? undefined : originsFor(receiverSubject);
    const exact = new Set<Node>();
    let complete = origins !== undefined && origins.size !== 0;
    for (const origin of origins ?? []) {
      if (!step()) return selected;
      if (ast.is.IsParameterDeclaration(origin.node)) complete = false;
      if (incomingFor(origin).size !== 0) continue;
      const concrete = sourceStorageConstructedClass(origin.node, source, step);
      const target = concrete === undefined ? undefined : navigation.memberImplementation(concrete, declaration);
      if (target?.kind === "resolved") exact.add(target.implementation.declaration);
      else complete = false;
    }
    if (complete && exact.size !== 0) return exact;
    for (const target of memberImplementations.get(declaration) ?? []) {
      if (!step()) break;
      selected.add(target);
    }
    return selected;
  };
  const invocationImplementations = (invocation: Node, originsFor = ancestorSubjects): ReadonlySet<Node> => {
    const implementations = new Set<Node>();
    const target = invocationTargets.get(invocation);
    for (const candidate of target === undefined ? [] : originsFor(target) ?? []) {
      if (!step()) break;
      if (candidate.kind !== "value") continue;
      for (const implementation of implementationsFor(candidate.node, invocation, originsFor)) implementations.add(implementation);
    }
    for (const accessor of accessorTargets.get(invocation) ?? []) {
      for (const implementation of implementationsFor(accessor, invocation, originsFor)) implementations.add(implementation);
    }
    return implementations;
  };
  const invocationOrigins = (origin: SourceStorageSubject, candidate: Node, invocation: Node): ReadonlySet<SourceStorageSubject> => {
    const origins = new Set<SourceStorageSubject>();
    if (unresolvedInvocations.has(invocation)) return origins;
    const pending = [origin];
    const visited = new Set<SourceStorageSubject>();
    const selected = semantics.forNode(invocation).operations.call(invocation);
    while (pending.length !== 0 && step()) {
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      if (current.kind === "value" && ast.is.IsParameterDeclaration(current.node)) {
        const index = ast.parameters(candidate).indexOf(current.node);
        if (index === -1) origins.add(current);
        else {
          const bindings = selected?.sourceArgumentBindings.filter(binding => binding.sourceParameterIndex === index) ?? [];
          for (const binding of bindings) {
            const actual = subjectFor(selected?.sourceArguments[binding.sourceArgumentIndex]?.expression);
            const argument = actual === undefined ? undefined
              : subject(actual.node, actual.kind, [...actual.projection, ...current.projection]);
            if (argument !== undefined) origins.add(argument);
          }
          if (bindings.length === 0) {
            const access = accessorTargets.has(invocation) ? ast.parent(invocation) : undefined;
            const assignment = access === undefined || !ast.is.IsBinaryExpression(access)
              ? undefined : ast.as.AsBinaryExpression(access);
            const argument = subjectFor(assignment?.Left === invocation && ast.operatorKindName(access) === "KindEqualsToken"
              ? assignment.Right : Node_Initializer(ast, current.node));
            origins.add(argument === undefined ? current
              : subject(argument.node, argument.kind, [...argument.projection, ...current.projection]) ?? current);
          }
        }
      } else if (current.kind === "receiver") {
        const receiver = current.node !== candidate ? current : ast.is.IsNewExpression(invocation) ? subject(invocation)
          : subjectFor(selected?.sourceReceiver?.expression ?? selected?.sourceCalleeAccess?.receiver.expression
            ?? semantics.forNode(invocation).operations.propertyAccess(invocation)?.receiver.expression);
        if (receiver !== undefined) origins.add(subject(receiver.node, receiver.kind,
          [...receiver.projection, ...current.projection]) ?? receiver);
      } else {
        const incomingOrigins = incomingFor(current);
        if (incomingOrigins.size === 0) origins.add(current);
        else for (const incomingOrigin of incomingOrigins) { if (!step()) break; pending.push(incomingOrigin); }
      }
    }
    return origins;
  };

  let previousEdges = -1;
  let previousThrows = -1;
  while ((previousEdges !== edgeCount || previousThrows !== throwCount) && step()) {
    previousEdges = edgeCount;
    previousThrows = throwCount;
    for (const invocation of invocationTargets.keys()) {
      for (const candidate of invocationImplementations(invocation)) {
        if (ast.is.IsCallExpression(invocation)) connect(subject(candidate, "return"), subject(invocation));
        const selected = semantics.forNode(invocation).operations.call(invocation);
        connect(ast.is.IsNewExpression(invocation) ? subject(invocation)
          : subjectFor(selected?.sourceReceiver?.expression ?? selected?.sourceCalleeAccess?.receiver.expression),
        subject(candidate, "receiver"));
        for (const binding of selected?.sourceArgumentBindings ?? []) {
          if (!step()) break;
          if (binding.sourceForm !== "value" || binding.sourceParameterForm !== "parameter") continue;
          const parameter = ast.parameters(candidate)[binding.sourceParameterIndex];
          const contract = selected?.sourceSelectedSignatureParameters.find(parameter =>
            parameter.parameterIndex === binding.sourceParameterIndex)?.parameterDeclaration;
          connect(subjectFor(selected?.sourceArguments[binding.sourceArgumentIndex]?.expression), subject(parameter));
          connect(subject(contract), subject(parameter));
        }
      }
    }
    for (const [access, accessors] of accessorTargets) {
      for (const accessor of accessors) {
        for (const candidate of implementationsFor(accessor, access)) {
          const receiver = semantics.forNode(access).operations.propertyAccess(access)?.receiver.expression;
          connect(subjectFor(receiver), subject(candidate, "receiver"));
          if (ast.is.IsGetAccessorDeclaration(accessor)) connect(subject(candidate, "return"), subjectFor(access));
          else {
            const parent = ast.parent(access);
            const assignment = parent === undefined || !ast.is.IsBinaryExpression(parent)
              ? undefined : ast.as.AsBinaryExpression(parent);
            if (assignment?.Left === access && ast.operatorKindName(parent) === "KindEqualsToken") {
              connect(subjectFor(assignment.Right), subject(ast.parameters(candidate)[0]));
            }
          }
        }
      }
    }
    for (const invocation of new Set([...invocations, ...accessorTargets.keys()])) {
      if (!step()) break;
      const destination = catchDestination(invocation);
      const enclosing = destination === undefined ? regions.enclosing(invocation) : undefined;
      const reason = unresolvedInvocations.get(invocation);
      if (reason !== undefined) {
        const caught = destination === undefined ? undefined : subject(destination);
        if (caught !== undefined) unresolvedSubjects.set(caught, reason);
        else if (enclosing !== undefined) recordUnresolvedThrow(enclosing, reason);
        continue;
      }
      const targets = [...invocationImplementations(invocation)].map(candidate => ({ candidate,
        regions: regions.callable(candidate, accessorTargets.has(invocation) ? undefined : invocation) }));
      if (ast.is.IsNewExpression(invocation)) {
        for (const region of regions.instance(invocation)) targets.push({ candidate: region.owner, regions: [region.node] });
      }
      for (const target of targets) {
        for (const region of target.regions) {
          const reason = unresolvedThrows.get(region);
          if (reason !== undefined) {
            const caught = destination === undefined ? undefined : subject(destination);
            if (caught !== undefined) unresolvedSubjects.set(caught, reason);
            else if (enclosing !== undefined) recordUnresolvedThrow(enclosing, reason);
          }
          for (const origin of thrownOrigins.get(region) ?? []) {
            for (const actual of invocationOrigins(origin, target.candidate, invocation)) {
              if (destination !== undefined) connect(actual, subject(destination));
              else if (enclosing !== undefined) recordThrow(enclosing, actual);
            }
          }
        }
      }
    }
  }
  const unresolvedFor = createSourceStorageUnresolvedQuery(step, subject, incomingFor, unresolvedSubjects);
  const substitutions = createSourceStorageSubstitutions(source, step, subject, incomingFor, invocationOrigins, budget.row);
  const boundaries: SourceStorageBoundary[] = [];
  for (const invocation of invocations) {
    if (!step()) break;
    const reason = unresolvedInvocations.get(invocation);
    if (reason === undefined && (implicitConstructions.has(invocation) ||
      [...invocationImplementations(invocation)].some(candidate => ast.body(candidate) !== undefined))) continue;
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
  sealed = true;
  return { subject, subjectFor, storageSubject: projections.ownerFor, incomingFor, identities, mutationOwners,
    sourceFileFor, retainCheckedContext, invocationTargets,
    invocations, invocationEffects, invocationArguments, invocationDeclarations, argumentTransports, unresolvedInvocations, boundaries,
    accessorTargets, visitedNodes, regions, ancestorSubjects, invocationImplementations, invocationOrigins, substitutions, unresolvedFor };
}
