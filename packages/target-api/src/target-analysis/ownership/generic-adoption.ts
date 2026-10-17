import { providerVirtualDeclarationFactKey, type Node, type Type } from "@tsonic/tsts";
import { isAbsolute, relative } from "node:path";
import type { TargetDiagnosticSourceSpan } from "../../artifacts.js";
import { isTsonicSourceProfileDeclarationPath } from "../../source-profile.js";
import { sourceCallableDefinitionIsDiscarded, sourceEnclosingCallable, sourceLexicalFunctionIsUnused,
  sourceNodesOutsideErasedSubtrees, sourceTransparentExpressionOperand } from "../../source-navigation/index.js";
import type { ResolvedSourceCallInfo, SourceFileSemantics, TargetSourceProgram } from "../../source-semantics/types.js";
import { createSourceDiagnosticSpanReader } from "../../source-semantics/diagnostic-spans.js";
import { createTargetGraphComponentQuery } from "../graph-component-query.js";
import type { SourceStorageBindings, SourceStorageBoundActivation, SourceStorageProducer,
  SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import type { SourceOwnershipBudget, SourceOwnershipUnresolved } from "./model.js";

export const sourceGenericAdoptionDiagnosticCode = "TSONIC_GENERIC_ASYNC_ADOPTION_UNSUPPORTED";
export const sourceGenericAdoptionDiagnosticMessage = "A generic async declaration would adopt this Promise-valued type argument (through an await, an async return or a Promise resolution). Generic Promise adoption is outside the approved native payload representation (capability C15, frozen). Await the Promise before passing it, or use a non-generic async function.";

export interface SourceGenericAdoptionIssue {
  readonly site: Node;
  readonly parameter: Node;
  readonly declaration: Node;
  readonly operation: Node;
  readonly sourceSpan: TargetDiagnosticSourceSpan;
  readonly evidence: readonly string[];
}

interface Parameter {
  readonly declaration: Node;
  readonly type: Type;
  readonly owner: Node;
  readonly neighbours: Set<Node>;
  operation: Node | undefined;
  unresolved: SourceOwnershipUnresolved | undefined;
}

interface Sensitivity {
  readonly operation: Node;
  readonly unresolved?: SourceOwnershipUnresolved;
}

interface Instantiation {
  readonly site: Node;
  readonly parameter: Node;
  readonly actual: Type;
  readonly sensitivity?: Sensitivity;
}

export function analyzeSourceGenericAdoption(input: {
  readonly source: TargetSourceProgram;
  readonly projectRoot: string;
  readonly nodes: readonly Node[];
  readonly storage: SourceStorageQueries;
  readonly budget: SourceOwnershipBudget;
  readonly exemptTypeParameter?: (parameter: Node) => boolean;
}): { readonly kind: "resolved"; readonly issues: readonly SourceGenericAdoptionIssue[] } | SourceOwnershipUnresolved {
  const { source, budget } = input;
  if (input.storage.source !== source) throw new Error("Generic adoption requires the identical checked source storage.");
  const { ast } = source;
  const domain = sourceNodesOutsideErasedSubtrees(ast, input.nodes, node =>
    ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node)
      ? sourceCallableDefinitionIsDiscarded(node, ast) : sourceLexicalFunctionIsUnused(node, ast, source.navigation));
  if (domain.kind === "unresolved") {
    const at = input.nodes[0] ?? source.sourceFiles[0];
    if (at === undefined) return Object.freeze({ kind: "resolved", issues: Object.freeze([]) });
    return Object.freeze({ kind: "unresolved", at, reason: domain.reason });
  }
  const nodes = domain.nodes;
  const parameters = new Map<Node, Parameter>();
  const instances: Instantiation[] = [];
  const sites = new Map<Node, Map<Node, Set<Type>>>();
  const rows = budget.createRows();
  let failure: SourceOwnershipUnresolved | undefined;
  const refuse = (at: Node, reason: string): undefined => {
    failure ??= Object.freeze({ kind: "unresolved", at, reason });
    return undefined;
  };
  const step = (at: Node): boolean => budget.step() ||
    refuse(at, budget.failure() ?? "Generic adoption requires its complete bounded source summary.") !== undefined;
  const primitive = (type: Type, semantics: SourceFileSemantics, active = new Set<Type>()): boolean => {
    if (!step(semantics.sourceFile) || active.has(type)) return false;
    if (semantics.types.isStringLike(type) || semantics.types.isNumberLike(type) || semantics.types.isBooleanLike(type) ||
      semantics.types.isBigIntLike(type) || semantics.types.isSymbolLike(type) || semantics.types.isNullish(type) ||
      semantics.types.isVoidLike(type) || semantics.types.isNever(type)) return true;
    if (!semantics.types.isUnion(type)) return false;
    active.add(type);
    const parts = semantics.types.unionOrIntersectionTypes(type);
    const selected = parts.length > 0 && parts.every(part => primitive(part, semantics, active));
    active.delete(type);
    return selected;
  };
  for (const node of nodes) {
    if (!step(node)) break;
    if (!ast.is.IsTypeParameterDeclaration(node) || !source.navigation.isProjectDeclaration(node) ||
      input.exemptTypeParameter?.(node) === true) continue;
    const owner = ast.parent(node);
    const semantics = source.semantics.forNode(node);
    const constraint = ast.as.AsTypeParameterDeclaration(node)?.Constraint;
    const constraintType = constraint === undefined ? undefined : semantics.types.authoredType(constraint);
    if (constraintType !== undefined && primitive(constraintType, semantics)) continue;
    const type = semantics.declarations.declaredType(node);
    if (owner === undefined || type === undefined) {
      refuse(node, "A generic adoption summary requires the actual checked parameter and its declaration.");
      break;
    }
    if (!rows.add(2)) { refuse(node, budget.failure()!); break; }
    parameters.set(node, { declaration: node, owner, type, neighbours: new Set(), operation: undefined, unresolved: undefined });
  }
  if (failure !== undefined) { rows.release(); return failure; }
  if (parameters.size === 0) { rows.release(); return Object.freeze({ kind: "resolved", issues: Object.freeze([]) }); }
  const topLevelParameters = (type: Type, semantics: SourceFileSemantics): ReadonlySet<Node> | undefined => {
    const found = new Set<Node>();
    const active = new Set<Type>();
    const visit = (selected: Type): void => {
      if (!step(semantics.sourceFile) || active.has(selected)) return;
      active.add(selected);
      const symbol = semantics.declarations.typeSymbol(selected);
      const declarations = symbol === undefined ? [] : semantics.declarations.symbolDeclarations(symbol);
      for (const declaration of declarations) if (parameters.has(declaration)) found.add(declaration);
      if (declarations.some(declaration => ast.is.IsTypeParameterDeclaration(declaration))) return;
      if (semantics.types.isUnion(selected)) {
        for (const part of semantics.types.unionOrIntersectionTypes(selected)) visit(part);
        return;
      }
      const awaited = semantics.types.awaitedType(selected);
      if (awaited === undefined) {
        refuse(semantics.sourceFile, "Generic adoption requires the checker's completed Awaited type.");
        return;
      }
      if (semantics.types.isIdentical(awaited, selected)) return;
      visit(awaited);
      const arguments_ = semantics.types.aliasApplication(selected)?.bindings.map(binding => binding.argument) ??
        semantics.types.typeArguments(selected);
      for (const argument of arguments_) {
        if (!step(semantics.sourceFile)) return;
        const awaitedArgument = semantics.types.awaitedType(argument);
        if (awaitedArgument !== undefined && semantics.types.isIdentical(awaitedArgument, awaited)) visit(argument);
      }
    };
    visit(type);
    return failure === undefined ? found : undefined;
  };
  const markType = (operation: Node, type: Type, semantics: SourceFileSemantics,
    unresolved?: SourceOwnershipUnresolved, exceptOwner?: Node): void => {
    for (const parameter of topLevelParameters(type, semantics) ?? []) {
      const selected = parameters.get(parameter)!;
      if (selected.owner === exceptOwner) continue;
      if (unresolved === undefined) selected.operation ??= operation;
      else selected.unresolved ??= unresolved;
    }
  };
  const mark = (operation: Node, expression: Node): void => {
    const semantics = source.semantics.forNode(expression);
    const type = semantics.types.expressionType(expression);
    if (type === undefined) { refuse(expression, "A generic adoption operation requires its checked value type."); return; }
    markType(operation, type, semantics);
  };
  const sourceParameter = (type: Type, semantics: SourceFileSemantics): Node | undefined => {
    const symbol = semantics.declarations.typeSymbol(type);
    return symbol === undefined ? undefined : semantics.declarations.symbolDeclarations(symbol).find(node => parameters.has(node));
  };
  const markContractResult = (operation: Node, type: Type, semantics: SourceFileSemantics): void => {
    if (sourceParameter(type, semantics) !== undefined) return;
    const awaited = semantics.types.awaitedType(type);
    if (awaited === undefined) {
      refuse(operation, "A generic receiver completion contract requires its checked Awaited type.");
      return;
    }
    if (!semantics.types.isIdentical(awaited, type)) markType(operation, type, semantics);
  };
  const addInstance = (site: Node, parameter: Node, actual: Type, sensitivity?: Sensitivity): void => {
    if (!parameters.has(parameter) || sensitivity === undefined && sites.get(site)?.get(parameter)?.has(actual)) return;
    if (!rows.add(1)) { refuse(site, budget.failure()!); return; }
    const selected = sites.get(site) ?? new Map<Node, Set<Type>>();
    const actuals = selected.get(parameter) ?? new Set<Type>();
    actuals.add(actual);
    selected.set(parameter, actuals);
    sites.set(site, selected);
    instances.push(Object.freeze({ site, parameter, actual, ...(sensitivity === undefined ? {} : { sensitivity }) }));
    const semantics = source.semantics.forNode(site);
    for (const forwarded of topLevelParameters(actual, semantics) ?? []) {
      const origin = parameters.get(forwarded)!;
      if (sensitivity === undefined) {
        if (!origin.neighbours.has(parameter) && !rows.add(1)) { refuse(site, budget.failure()!); return; }
        origin.neighbours.add(parameter);
      } else markType(sensitivity.operation, actual, semantics, sensitivity.unresolved);
    }
  };
  const receiverInstances = (site: Node, type: Type, active = new Set<Type>()): void => {
    if (!step(site) || active.has(type)) return;
    active.add(type);
    const semantics = source.semantics.forNode(site);
    if (semantics.types.isUnion(type) || semantics.types.isIntersection(type)) {
      for (const part of semantics.types.unionOrIntersectionTypes(type)) receiverInstances(site, part, active);
      return;
    }
    const bindings = semantics.types.typeArgumentBindings(type);
    const symbol = semantics.declarations.typeSymbol(type);
    const declarations = symbol === undefined ? [] : semantics.declarations.symbolDeclarations(symbol);
    if (bindings === undefined && declarations.some(declaration => source.navigation.isProjectDeclaration(declaration) &&
      (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration) || ast.is.IsInterfaceDeclaration(declaration)))) {
      refuse(site, "Generic receiver adoption requires its complete checked type argument bindings.");
      return;
    }
    for (const binding of bindings ?? [])
      addInstance(site, binding.declaration, binding.argumentType);
    if (!declarations.some(declaration => source.navigation.isProjectDeclaration(declaration) &&
      (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration) || ast.is.IsInterfaceDeclaration(declaration)))) return;
    const bases = semantics.types.instantiatedBaseTypes(type);
    if (bases === undefined) { refuse(site, "Generic receiver adoption requires its exact checked instantiated base types."); return; }
    for (const inherited of bases) receiverInstances(site, inherited, active);
  };
  const canonicalPromiseMember = (declaration: Node): string | undefined => {
    const fact = source.sourceFacts.getFact(declaration, providerVirtualDeclarationFactKey);
    if (fact?.providerId === "tsonic.js.source-virtual-modules" &&
      (fact.exportName === "Promise" || fact.exportName === "PromiseLike" || fact.exportName === "PromiseConstructor")) {
      return fact.memberKey?.kind === "property-key" ? fact.memberKey.name : fact.memberName ?? "construct";
    }
    const file = ast.getSourceFile(declaration);
    if (file === undefined || !ast.isDeclarationFile(file) || source.navigation.isProjectDeclaration(declaration) ||
      !(isTsonicSourceProfileDeclarationPath(ast.getFileName(file)) ||
        source.semantics.forNode(declaration).declarations.isDefaultLibraryDeclaration(declaration))) return undefined;
    const owner = ast.parent(declaration);
    const ownerName = ast.text(ast.name(owner));
    if (ownerName !== "Promise" && ownerName !== "PromiseLike" && ownerName !== "PromiseConstructor") return undefined;
    return ast.is.IsConstructSignatureDeclaration(declaration) ? "construct" : ast.text(ast.name(declaration));
  };
  const reactionBodies = new Set<Node>();
  const entries: { readonly producer: SourceStorageProducer; readonly declaration: Node;
    readonly resolver: SourceStorageSubject; readonly bindings: SourceStorageBindings }[] = [];
  const calls: { readonly node: Node; readonly selected: ResolvedSourceCallInfo; readonly declaration: Node }[] = [];
  for (const node of nodes) {
    if (!step(node)) break;
    if (!ast.is.IsCallExpression(node) && !ast.is.IsNewExpression(node)) continue;
    const semantics = source.semantics.forNode(node);
    const selected = semantics.operations.call(node);
    const declaration = selected?.sourceSelectedSignatureKind === "resolved"
      ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
    if (selected === undefined || declaration === undefined) continue;
    calls.push({ node, selected, declaration });
    const member = canonicalPromiseMember(declaration);
    if (member === "resolve") {
      const value = ast.arguments(node)[0];
      if (value !== undefined) mark(node, value);
    } else if (member === "construct") {
      const executor = ast.arguments(node)[0];
      if (executor !== undefined) {
        const lexical = input.storage.bindingsForLexicalOwner(node);
        const subject = input.storage.subjectFor(executor);
        const producers = lexical.kind === "unresolved" ? lexical : subject.kind === "unresolved" ? subject
          : input.storage.storageProducersFor(subject.subject, lexical.bindings);
        const generic = (topLevelParameters(selected.sourceResultType, semantics)?.size ?? 0) !== 0;
        if (producers.kind === "complete" && producers.producers.length === 0 && generic)
          markType(executor, selected.sourceResultType, semantics, Object.freeze({ kind: "unresolved", at: executor,
            reason: "A generic Promise executor requires its nonempty actual source producer domain." }));
        if (producers.kind !== "complete") {
          const reason = producers.kind === "unresolved" ? producers.reason
            : "A generic Promise executor requires its complete actual source producer domain.";
          if (input.storage.failureReason() !== undefined) refuse(executor, input.storage.failureReason()!);
          else if (generic) markType(executor, selected.sourceResultType, semantics,
            Object.freeze({ kind: "unresolved", at: executor, reason }));
          if (producers.kind === "unresolved") continue;
        }
        for (const producer of producers.producers) {
          const implementation = source.navigation.callableImplementation(producer.subject.node);
          if (implementation.kind !== "resolved") {
            if (generic) markType(executor, selected.sourceResultType, semantics, Object.freeze({ kind: "unresolved", at: executor,
              reason: "A generic Promise executor requires its actual source implementation, not a type-only signature." }));
            continue;
          }
          const owner = implementation.implementation.declaration;
          const resolve = ast.parameters(owner)[0];
          if (resolve !== undefined) {
            const selected = input.storage.subject(resolve, "input");
            if (selected.kind === "unresolved") refuse(resolve, selected.reason);
            else {
              const activation = input.storage.bindingsForDeclaration(owner, producer.bindings);
              if (activation.kind === "unresolved") { refuse(executor, activation.reason); continue; }
              if (!rows.add(1)) { refuse(executor, budget.failure()!); continue; }
              entries.push(Object.freeze({ producer, declaration: owner, resolver: selected.subject, bindings: activation.bindings }));
            }
          }
        }
      }
    } else if (member === "then" || member === "catch" || member === "finally") {
      for (const callback of ast.arguments(node)) {
        if (callback === undefined) continue;
        if (ast.body(callback) !== undefined) reactionBodies.add(callback);
        const type = semantics.types.expressionType(callback);
        if (type !== undefined) for (const signature of semantics.types.signatureInfos(type, "call"))
          if (signature.returnType !== undefined) markType(node, signature.returnType, semantics);
      }
    }
  }
  for (const node of nodes) {
    if (!step(node)) break;
    if ((ast.is.IsMethodDeclaration(node) || ast.is.IsMethodSignatureDeclaration(node) ||
      ast.is.IsGetAccessorDeclaration(node) || ast.is.IsPropertySignatureDeclaration(node) || ast.is.IsPropertyDeclaration(node)) &&
      source.navigation.isProjectDeclaration(node) &&
      (ast.is.IsPropertySignatureDeclaration(node) || ast.is.IsPropertyDeclaration(node) || ast.body(node) === undefined)) {
      const semantics = source.semantics.forNode(node);
      const callable = semantics.types.declarationSignatureInfo(node);
      if (callable?.returnType !== undefined) markContractResult(node, callable.returnType, semantics);
      else if (ast.is.IsPropertySignatureDeclaration(node) || ast.is.IsPropertyDeclaration(node)) {
        const value = semantics.declarations.declaredValueType(node);
        if (value !== undefined) for (const signature of semantics.types.signatureInfos(value, "call"))
          if (signature.returnType !== undefined) markContractResult(node, signature.returnType, semantics);
      }
    }
    if (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node)) {
      let operand = node;
      let parent = ast.parent(operand);
      while (parent !== undefined && sourceTransparentExpressionOperand(ast, parent) === operand) {
        if (!step(parent)) break;
        operand = parent;
        parent = ast.parent(operand);
      }
      if (parent !== undefined && ast.is.IsCallExpression(parent) &&
        ast.as.AsCallExpression(parent)?.Expression === operand) continue;
      const semantics = source.semantics.forNode(node);
      const access = ast.is.IsPropertyAccessExpression(node) ? semantics.operations.propertyAccess(node)
        : semantics.operations.elementAccess(node);
      if (access !== undefined) receiverInstances(node, access.receiver.type);
    }
    if (ast.is.IsAwaitExpression(node)) {
      const value = ast.as.AsAwaitExpression(node)?.Expression;
      if (value !== undefined) mark(node, value);
    } else if (ast.is.IsReturnStatement(node)) {
      const owner = sourceEnclosingCallable(node, ast);
      const value = ast.as.AsReturnStatement(node)?.Expression;
      if (owner !== undefined && value !== undefined && (ast.hasModifierKind(owner, "async") || reactionBodies.has(owner)))
        mark(node, value);
    } else if (ast.is.IsArrowFunction(node)) {
      const body = ast.body(node);
      if (body !== undefined && !ast.is.IsBlock(body) && (ast.hasModifierKind(node, "async") || reactionBodies.has(node)))
        mark(body, body);
    }
  }
  const resolverFor = (producer: Pick<SourceStorageProducer, "subject" | "bindings">): boolean | SourceOwnershipUnresolved => {
    let unknown: SourceOwnershipUnresolved | undefined;
    for (const entry of entries) {
      if (!step(producer.subject.node)) return Object.freeze({ kind: "unresolved", at: producer.subject.node, reason: budget.failure()! });
      if (producer.subject !== entry.resolver) continue;
      const selected = input.storage.boundActivationsFor(entry.declaration, producer.bindings);
      if (selected.kind === "resolved" && selected.activations.some(activation => activation.bindings === entry.bindings)) return true;
      unknown ??= Object.freeze({ kind: "unresolved", at: producer.subject.node, reason: selected.kind === "unresolved"
        ? selected.reason : "A resolver input requires its identical native callback entry activation." });
    }
    if (unknown !== undefined) return unknown;
    const declaration = producer.subject.node;
    if (producer.subject.kind === "value" && producer.subject.projection.length === 0 &&
      (ast.is.IsFunctionDeclaration(declaration) || ast.is.IsFunctionExpression(declaration) ||
        ast.is.IsArrowFunction(declaration) || ast.is.IsMethodDeclaration(declaration))) return false;
    return Object.freeze({ kind: "unresolved", at: declaration,
      reason: "A generic resolving call requires its exact source callable or canonical native resolver identity." });
  };
  const qualify = (operation: Node, argument: Node, activation: SourceStorageBoundActivation,
    unresolved?: SourceOwnershipUnresolved): void => {
    const sensitivity: Sensitivity = Object.freeze({ operation, ...(unresolved === undefined ? {} : { unresolved }) });
    const selected = input.storage.subjectFor(argument);
    const origins = selected.kind === "unresolved" ? selected : input.storage.boundOriginsFor(selected.subject, activation.bindings);
    if (origins.kind === "unresolved") {
      if (input.storage.failureReason() !== undefined) { refuse(operation, input.storage.failureReason()!); return; }
      const semantics = source.semantics.forNode(argument);
      const type = semantics.types.expressionType(argument);
      if (type === undefined) { refuse(operation, "A qualified resolver requires its exact checked argument type."); return; }
      markType(operation, type, semantics, unresolved ?? Object.freeze({ kind: "unresolved", at: operation, reason: origins.reason }),
        activation.kind === "invocation" ? activation.declaration : undefined);
    } else for (const origin of origins.subjects) {
      const type = input.storage.typeFor(origin);
      if (type.kind === "unresolved") { refuse(operation, type.reason); return; }
      markType(operation, type.type, source.semantics.forFile(type.sourceFile), unresolved,
        activation.kind === "invocation" ? activation.declaration : undefined);
    }
    if (activation.kind !== "invocation") return;
    const semantics = source.semantics.forNode(activation.invocation);
    const call = semantics.operations.call(activation.invocation);
    const declaration = call?.sourceSelectedSignatureKind === "resolved"
      ? semantics.declarations.signatureDeclaration(call.selectedSignature) : undefined;
    const implementation = declaration === undefined ? undefined : source.navigation.callableImplementation(declaration);
    const type = source.semantics.forNode(argument).types.expressionType(argument);
    if (declaration === undefined || implementation?.kind !== "resolved" ||
      implementation.implementation.declaration !== activation.declaration || type === undefined) {
      refuse(operation, "A qualified resolver requires its exact checked argument and invocation implementation."); return;
    }
    const affected = topLevelParameters(type, source.semantics.forNode(argument));
    const qualified = new Set<Node>();
    for (const actual of call?.sourceSelectedMethodTypeArguments ?? []) {
      const formal = sourceParameter(actual.typeParameter, semantics);
      const index = formal === undefined ? -1 : ast.typeParameters(declaration).indexOf(formal);
      const target = index < 0 ? undefined : ast.typeParameters(activation.declaration)[index];
      if (target === undefined || affected?.has(target) !== true) continue;
      qualified.add(target);
      addInstance(activation.invocation, target, actual.selectedType, sensitivity);
    }
    if ([...(affected ?? [])].some(parameter => parameters.get(parameter)?.owner === activation.declaration && !qualified.has(parameter)))
      refuse(operation, "A qualified generic resolver requires every affected parameter's exact checked invocation binding.");
  };
  for (const { node, selected, declaration } of calls) {
    if (!step(node)) break;
    const semantics = source.semantics.forNode(node);
    const callee = selected.sourceCallee.expression;
    const argument = ast.arguments(node)[0];
    const owner = sourceEnclosingCallable(node, ast);
    if (entries.length !== 0 && argument !== undefined && owner !== undefined && canonicalPromiseMember(declaration) === undefined) {
      const subject = input.storage.subjectFor(callee);
      if (subject.kind === "unresolved") { refuse(node, subject.reason); break; }
      for (const entry of entries) {
        const activations = input.storage.contributingActivationsFor(subject.subject, owner, entry.producer);
        if (activations.kind === "unresolved") {
          refuse(node, activations.reason);
          continue;
        }
        for (const activation of activations.activations) {
          const origins = input.storage.storageProducersFor(subject.subject, activation.bindings);
          if (origins.kind === "unresolved") {
            if (input.storage.failureReason() !== undefined) refuse(node, input.storage.failureReason()!);
            else qualify(node, argument, activation, Object.freeze({ kind: "unresolved", at: node, reason: origins.reason }));
            continue;
          }
          const resolvers: SourceStorageProducer[] = [];
          let unknown: SourceOwnershipUnresolved | undefined;
          for (const producer of origins.producers) {
            const selected = resolverFor(producer);
            if (selected === true) resolvers.push(producer);
            else if (selected !== false) unknown ??= selected;
          }
          if (resolvers.length !== 0) qualify(node, argument, activation);
          if (origins.kind === "open" && origins.boundaries.some(boundary => boundary.kind !== "external-input" ||
            !resolvers.some(producer => producer.subject === boundary.subject))) unknown ??= Object.freeze({ kind: "unresolved", at: node,
            reason: "A generic resolving call requires its complete same-activation callable provenance." });
          if (unknown !== undefined) qualify(node, argument, activation,
            Object.freeze({ kind: "unresolved", at: node, reason: unknown.reason }));
        }
      }
    }
    for (const argument of selected.sourceSelectedMethodTypeArguments ?? []) {
      const parameter = sourceParameter(argument.typeParameter, semantics);
      if (parameter !== undefined) addInstance(node, parameter, argument.selectedType);
    }
    if (ast.is.IsNewExpression(node)) for (const binding of semantics.types.typeArgumentBindings(selected.sourceResultType) ?? [])
      addInstance(node, binding.declaration, binding.argumentType);
    if (selected.sourceReceiver !== undefined) receiverInstances(node, selected.sourceReceiver.type);
    if (!source.navigation.isProjectDeclaration(declaration)) continue;
    const implementation = source.navigation.callableImplementation(declaration);
    if (implementation.kind !== "resolved") continue;
    const formals = ast.typeParameters(declaration);
    const targets = ast.typeParameters(implementation.implementation.declaration);
    for (const [index, formal] of formals.entries()) {
      const target = targets[index];
      if (formal !== undefined && target !== undefined && formal !== target && parameters.has(formal) && parameters.has(target)) {
        const neighbours = parameters.get(formal)!.neighbours;
        if (!neighbours.has(target) && !rows.add(1)) { refuse(node, budget.failure()!); break; }
        neighbours.add(target);
      }
    }
  }
  const sensitive = createTargetGraphComponentQuery<Node, Sensitivity | null, Sensitivity | null>(parameter => {
    const selected = parameters.get(parameter);
    if (selected === undefined || !step(parameter)) return undefined;
    const owner = selected.owner;
    const implementation = source.navigation.callableImplementation(owner);
    const bodyOwner = implementation.kind === "resolved" ? implementation.implementation.declaration : owner;
    const known = ast.body(bodyOwner) !== undefined || ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner) ||
      ast.is.IsInterfaceDeclaration(owner);
    const operation = selected.operation ?? (known ? undefined : owner);
    return { data: operation !== undefined ? Object.freeze({ operation }) : selected.unresolved === undefined ? null
      : Object.freeze({ operation: selected.unresolved.at, unresolved: selected.unresolved }), neighbours: selected.neighbours };
  }, members => {
    const selections = members.flatMap(member => [member.data, ...member.successors]);
    return selections.find(selection => selection !== null && selection.unresolved === undefined) ??
      selections.find(selection => selection !== null) ?? null;
  }, budget);
  const readSpan = createSourceDiagnosticSpanReader(ast);
  const sourceSpanFor = (node: Node): TargetDiagnosticSourceSpan | undefined => {
    const file = ast.getSourceFile(node);
    if (file === undefined || !source.semantics.includes(file)) return undefined;
    const span = readSpan(file, ast.pos(node), ast.end(node));
    if (span === undefined) return undefined;
    const fileName = (isAbsolute(span.fileName) ? relative(input.projectRoot, span.fileName) : span.fileName)
      .split("\\").join("/");
    return Object.freeze({ ...span, fileName });
  };
  const formatDiagnostic = (site: Node, declaration: Node, operation: Node) => {
    const sourceSpan = sourceSpanFor(site);
    const declarationSpan = sourceSpanFor(declaration);
    const operationSpan = sourceSpanFor(operation);
    if (sourceSpan === undefined || declarationSpan === undefined || operationSpan === undefined) return undefined;
    return Object.freeze({ sourceSpan, evidence: Object.freeze([
      `declaration ${declarationSpan.fileName}:${declarationSpan.line}:${declarationSpan.column}`,
      `first-sensitive-operation ${operationSpan.fileName}:${operationSpan.line}:${operationSpan.column}`,
    ]) });
  };
  const issues: SourceGenericAdoptionIssue[] = [];
  for (const instance of instances) {
    if (!step(instance.site)) break;
    const semantics = source.semantics.forNode(instance.site);
    if (semantics.types.isAny(instance.actual) || semantics.types.isUnknown(instance.actual)) continue;
    if (semantics.types.isUnion(instance.actual) || semantics.types.isIntersection(instance.actual)) {
      for (const part of semantics.types.unionOrIntersectionTypes(instance.actual)) addInstance(instance.site, instance.parameter, part, instance.sensitivity);
      continue;
    }
    if (sourceParameter(instance.actual, semantics) !== undefined) continue;
    const awaited = semantics.types.awaitedType(instance.actual);
    if (awaited === undefined) { refuse(instance.site, "Generic instantiation requires its completed native Awaited selection."); break; }
    if (semantics.types.isIdentical(awaited, instance.actual)) continue;
    const sensitivity = instance.sensitivity ?? sensitive(instance.parameter);
    if (sensitivity === undefined) { refuse(instance.site, budget.failure() ?? "The bounded generic adoption summary is incomplete."); break; }
    if (sensitivity === null || issues.some(issue => issue.site === instance.site)) continue;
    if (sensitivity.unresolved !== undefined) { failure = sensitivity.unresolved; break; }
    const operation = sensitivity.operation;
    const declaration = parameters.get(instance.parameter)!.owner;
    const formatted = formatDiagnostic(instance.site, declaration, operation);
    if (formatted === undefined) { refuse(instance.site, "Generic adoption diagnostics require their exact checked source spans."); break; }
    issues.push(Object.freeze({ site: instance.site, parameter: instance.parameter, declaration, operation,
      ...formatted }));
  }
  rows.release();
  return failure ?? Object.freeze({ kind: "resolved", issues: Object.freeze(issues) });
}
