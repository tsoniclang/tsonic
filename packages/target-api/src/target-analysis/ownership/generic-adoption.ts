import { providerVirtualDeclarationFactKey, type Node, type Type } from "@tsonic/tsts";
import type { TargetDiagnosticSourceSpan } from "../../artifacts.js";
import { isTsonicSourceProfileDeclarationPath } from "../../source-profile.js";
import {
  Node_Expression, Node_Initializer,
  sourceCallableDefinitionIsDiscarded, sourceEnclosingCallable, sourceLexicalFunctionIsUnused,
  sourceNodesOutsideErasedSubtrees, sourceTransparentExpressionOperand,
} from "../../source-navigation/index.js";
import type { ResolvedSourceCallInfo } from "../../source-semantics/call-result-selection.js";
import type { SourceFileSemantics, TargetSourceProgram } from "../../source-semantics/types.js";
import { createTargetGraphComponentQuery } from "../graph-component-query.js";
import type {
  SourceStorageBindings, SourceStorageBoundActivation, SourceStorageProducer, SourceStorageQueries,
  SourceStorageProducersSelection,
} from "../source-storage/model/types.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import { sourceStorageSelectedInputSlots, sourceStorageNativeInputSlots } from "../source-storage/graph/invocation-inputs.js";
import type { SourceOwnershipBudget, SourceOwnershipUnresolved } from "./model.js";
import { createSourceGenericAdoptionDiagnostics } from "./generic-adoption-diagnostics.js";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipPremises,
  SourceDeclarationOwnershipUnresolved } from "./model.js";
import { sourceDeclarationOwnershipContractProblem, sourceDeclarationOwnershipUnresolved } from "./contracts.js";

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
      ? sourceCallableDefinitionIsDiscarded(node, ast, source.navigation) : sourceLexicalFunctionIsUnused(node, ast, source.navigation));
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
    unresolved?: SourceOwnershipUnresolved): void => {
    for (const parameter of topLevelParameters(type, semantics) ?? []) {
      const selected = parameters.get(parameter)!;
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
    // The static side of a class, such as the receiver of `Generic.ready` or `Generic.GetHashCode()`, is the class
    // constructor type. Static members cannot use the class type parameters, so it has no receiver instances to adopt.
    const constructorType = symbol === undefined ? undefined : semantics.types.typeOfSymbol(symbol);
    if (constructorType !== undefined && semantics.types.isIdentical(type, constructorType) &&
      declarations.some(declaration => ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration))) return;
    // The polymorphic `this` of a class or interface is constrained by its declared instance type; its receiver
    // instances are those of that declared type.
    const apparent = bindings === undefined ? semantics.types.apparentType(type) : undefined;
    if (apparent !== undefined && !semantics.types.isIdentical(apparent, type) && declarations.some(declaration => {
      const declared = semantics.declarations.declaredType(declaration);
      return declared !== undefined && semantics.types.isIdentical(declared, apparent);
    })) { receiverInstances(site, apparent, active); return; }
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
  const reactionBodies = new Set<Node>();
  const entries: { readonly producer: SourceStorageProducer; readonly declaration: Node;
    readonly resolver: SourceStorageSubject; readonly bindings: SourceStorageBindings; readonly resultType: Type }[] = [];
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
    const member = sourceGenericAdoptionPromiseMember(source, declaration, semantics);
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
          const callbacks = input.storage.nativeCallbackArgumentsFor(node);
          const actual = input.storage.subjectFor(executor);
          const callback = callbacks.kind === "unresolved" || actual.kind === "unresolved" ? undefined
            : callbacks.arguments.find(argument => argument.actual === actual.subject);
          const selection = callback === undefined ? undefined : input.storage.invocationImplementationsFor(node, lexical.kind === "resolved"
            ? lexical.bindings : undefined, callback);
          const inputs = selection?.kind === "resolved" ? selection.inputs.find(input => input.kind === "native-callback") : undefined;
          const slots = sourceStorageSelectedInputSlots(inputs, owner);
          const resolve = slots?.find(slot => slot.effectiveIndex === 0);
          if (slots === undefined || resolve !== undefined && (resolve.repeated || resolve.projection === undefined)) {
            if (generic) markType(executor, selected.sourceResultType, semantics, Object.freeze({ kind: "unresolved", at: executor,
              reason: "A generic Promise executor requires its exact checked resolver input slot." }));
          } else if (resolve !== undefined) {
            const resolver = input.storage.subject(resolve.parameter, "input", resolve.projection);
            if (resolver.kind === "unresolved") refuse(resolve.parameter, resolver.reason);
            else {
              const activation = input.storage.bindingsForDeclaration(owner, producer.bindings);
              if (activation.kind === "unresolved") { refuse(executor, activation.reason); continue; }
              if (!rows.add(1)) { refuse(executor, budget.failure()!); continue; }
              entries.push(Object.freeze({ producer, declaration: owner, resolver: resolver.subject, bindings: activation.bindings,
                resultType: selected.sourceResultType }));
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
  const nonResolver = (subject: SourceStorageSubject): boolean => subject.kind === "value" && subject.projection.length === 0 &&
    (ast.is.IsFunctionDeclaration(subject.node) || ast.is.IsFunctionExpression(subject.node) ||
      ast.is.IsArrowFunction(subject.node) || ast.is.IsMethodDeclaration(subject.node));
  const resolverFor = (producer: Pick<SourceStorageProducer, "subject" | "bindings">,
    entry: (typeof entries)[number]): boolean | SourceOwnershipUnresolved => {
    if (producer.subject === entry.resolver) {
      if (!step(producer.subject.node)) return Object.freeze({ kind: "unresolved", at: producer.subject.node, reason: budget.failure()! });
      const selected = input.storage.boundActivationsFor(entry.declaration, producer.bindings);
      if (selected.kind === "resolved" && selected.activations.some(activation => activation.bindings === entry.bindings)) return true;
      return Object.freeze({ kind: "unresolved", at: producer.subject.node, reason: selected.kind === "unresolved"
        ? selected.reason : "A resolver input requires its identical native callback entry activation." });
    }
    const declaration = producer.subject.node;
    if (nonResolver(producer.subject)) return false;
    return Object.freeze({ kind: "unresolved", at: declaration,
      reason: "A generic resolving call requires its exact source callable or canonical native resolver identity." });
  };
  const qualify = (operation: Node, argument: Node, bindings: SourceStorageBindings,
    knownResolverResult: Type | undefined, unresolved?: SourceOwnershipUnresolved): void => {
    const selected = input.storage.subjectFor(argument);
    const origins = selected.kind === "unresolved" ? selected : input.storage.storageProducersFor(selected.subject, bindings);
    if (origins.kind === "unresolved" || origins.producers.length === 0) {
      if (input.storage.failureReason() !== undefined) { refuse(operation, input.storage.failureReason()!); return; }
      const semantics = source.semantics.forNode(argument);
      const type = semantics.types.expressionType(argument);
      if (type === undefined) { refuse(operation, "A qualified resolver requires its exact checked argument type."); return; }
      qualifyBoundType(operation, type, semantics, bindings, unresolved ?? Object.freeze({ kind: "unresolved", at: operation,
        reason: origins.kind === "unresolved" ? origins.reason : "A qualified resolver requires a nonempty original value domain." }));
      if (knownResolverResult !== undefined && (semantics.types.isAny(type) || semantics.types.isUnknown(type)))
        markType(operation, knownResolverResult, semantics, Object.freeze({ kind: "unresolved", at: operation,
          reason: "An actual native resolver requires a completed checked argument bound." }));
    } else for (const producer of origins.producers) {
      const origin = producer.subject;
      let selectedTypes: readonly Type[] = [producer.type];
      let selectedSemantics = source.semantics.forFile(producer.sourceFile);
      if (origin.kind === "input" && ast.is.IsParameterDeclaration(origin.node)) {
        const owner = ast.parent(origin.node);
        const owning = owner === undefined ? undefined : input.storage.boundActivationsFor(owner, producer.bindings);
        if (owning?.kind === "unresolved" && input.storage.failureReason() !== undefined) {
          refuse(operation, input.storage.failureReason()!); return;
        }
        const ownerActivation = owning?.kind === "resolved" && owning.activations.length === 1 ? owning.activations[0] : undefined;
        const entry = ownerActivation?.kind === "declaration" ? ownerActivation.nativeEntry : undefined;
        if (entry !== undefined) {
          selectedSemantics = source.semantics.forNode(entry.invocation);
          const selection = input.storage.invocationImplementationsFor(entry.invocation, entry.callerBindings, entry.argument);
          const inputs = selection.kind === "resolved" ? selection.inputs.find(input => input.kind === "native-callback") : undefined;
          const nativeInputs = sourceStorageNativeInputSlots(source, owner!, origin,
            inputs, selectedSemantics, () => step(operation));
          if (nativeInputs === undefined || nativeInputs.some(input => !input.absent && input.type === undefined)) {
            markType(operation, knownResolverResult ?? producer.type, source.semantics.forFile(producer.sourceFile), Object.freeze({ kind: "unresolved", at: operation,
              reason: "A native resolver callback requires its exact checked input component type bound." }));
          }
          selectedTypes = (nativeInputs ?? []).flatMap(input => !input.absent && input.type !== undefined ? [input.type] : []);
        }
      }
      for (const selectedType of selectedTypes) {
        if (knownResolverResult !== undefined && (selectedSemantics.types.isAny(selectedType) || selectedSemantics.types.isUnknown(selectedType))) {
          markType(operation, knownResolverResult, selectedSemantics, Object.freeze({ kind: "unresolved", at: operation,
            reason: "An actual native resolver requires a completed checked argument bound." }));
          continue;
        }
        qualifyBoundType(operation, selectedType, selectedSemantics, producer.bindings, unresolved);
      }
    }
  };
  const qualifyInstantiation = (operation: Node, type: Type, inputSemantics: SourceFileSemantics,
    activation: SourceStorageBoundActivation, sensitivity: Sensitivity): void => {
    if (activation.kind !== "invocation") return;
    const semantics = source.semantics.forNode(activation.invocation);
    const call = semantics.operations.call(activation.invocation);
    const declaration = call?.sourceSelectedSignatureKind === "resolved"
      ? semantics.declarations.signatureDeclaration(call.selectedSignature) : undefined;
    const implementation = declaration === undefined ? undefined : source.navigation.callableImplementation(declaration);
    if (declaration === undefined || implementation?.kind !== "resolved" ||
      implementation.implementation.declaration !== activation.declaration) {
      refuse(operation, "A qualified resolver requires its exact checked argument and invocation implementation."); return;
    }
    const affected = topLevelParameters(type, inputSemantics);
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
  const qualifyBoundType = (operation: Node, type: Type, semantics: SourceFileSemantics, bindings: SourceStorageBindings,
    unresolved?: SourceOwnershipUnresolved): void => {
    const owners = new Set<Node>();
    for (const parameter of topLevelParameters(type, semantics) ?? []) {
      const selected = parameters.get(parameter)!;
      const activations = ast.body(selected.owner) === undefined ? undefined : input.storage.boundActivationsFor(selected.owner, bindings);
      if (activations?.kind === "unresolved") {
        selected.unresolved ??= Object.freeze({ kind: "unresolved", at: operation, reason: activations.reason });
        continue;
      }
      if (activations?.kind === "resolved") {
        if (!owners.has(selected.owner)) {
          owners.add(selected.owner);
          for (const activation of activations.activations) qualifyInstantiation(operation, type, semantics, activation,
            Object.freeze({ operation, ...(unresolved === undefined ? {} : { unresolved }) }));
        }
        if (activations.activations.length === 0) {
          selected.unresolved ??= Object.freeze({ kind: "unresolved", at: operation,
            reason: "A qualified generic value requires its nonempty actual owning activation domain." });
          continue;
        }
        if (activations.activations.every(activation => activation.kind === "invocation")) continue;
      }
      if (unresolved === undefined) selected.operation ??= operation;
      else selected.unresolved ??= unresolved;
    }
  };
  const executionContexts = (operation: Node, owner: Node,
    selection: Exclude<SourceStorageProducersSelection, { readonly kind: "unresolved" }>, unknown: (reason: string) => void) => {
    const contexts = new Map<SourceStorageBindings, boolean>();
    const retain = (bindings: SourceStorageBindings, uncertain: boolean): boolean => {
      if (!step(operation)) return false;
      const previous = contexts.get(bindings);
      if (previous === undefined && !rows.add(1)) { refuse(operation, budget.failure()!); return false; }
      contexts.set(bindings, previous === true || uncertain);
      return true;
    };
    for (const producer of selection.producers) {
      if (!step(operation)) return undefined;
      const activations = input.storage.boundActivationsFor(owner, producer.bindings);
      if (activations.kind === "unresolved") { refuse(operation, activations.reason); return undefined; }
      for (const activation of activations.activations) if (!retain(activation.bindings, false)) return undefined;
    }
    const producingBindings = [...contexts.keys()];
    if (selection.kind === "open") for (const boundary of selection.boundaries) {
      if (!step(operation)) return undefined;
      const owning = input.storage.boundActivationsFor(owner, boundary.bindings);
      if (owning.kind === "unresolved") {
        if (producingBindings.length === 0 || input.storage.failureReason() !== undefined) { unknown(owning.reason); continue; }
        for (const bindings of producingBindings) if (!retain(bindings, true)) return undefined;
        continue;
      }
      if (owning.activations.length === 0) { unknown("An open source execution requires its nonempty demanded-owner activation domain."); continue; }
      for (const activation of owning.activations) if (!retain(activation.bindings, true)) return undefined;
    }
    return Object.freeze([...contexts].map(([bindings, uncertain]) => Object.freeze({ bindings, uncertain })));
  };
  const unknownArgument = (operation: Node, argument: Node, reason: string): void => {
    if (input.storage.failureReason() !== undefined) { refuse(operation, input.storage.failureReason()!); return; }
    const semantics = source.semantics.forNode(argument);
    const type = semantics.types.expressionType(argument);
    if (type === undefined) { refuse(operation, "An unresolved resolver demand requires its checked argument type."); return; }
    markType(operation, type, semantics, Object.freeze({ kind: "unresolved", at: operation, reason }));
  };
  const unknownNativeInput = (operation: Node, callback: Type, reason: string): void => {
    if (input.storage.failureReason() !== undefined) { refuse(operation, input.storage.failureReason()!); return; }
    const semantics = source.semantics.forNode(operation);
    const type = semantics.types.nonNullableType(callback);
    const signatures = type === undefined ? [] : semantics.types.callSignatures(type);
    if (signatures.length === 0) { refuse(operation, "An unresolved native callback requires its checked input type bounds."); return; }
    for (const signature of signatures) {
      const parameter = semantics.types.signatureParameterInfos(signature)[0];
      if (parameter !== undefined) markType(operation, parameter.type, semantics,
        Object.freeze({ kind: "unresolved", at: operation, reason }));
    }
  };
  for (const { node, selected, declaration } of calls) {
    if (!step(node)) break;
    const semantics = source.semantics.forNode(node);
    const callee = selected.sourceCallee.expression;
    const argument = ast.arguments(node)[0];
    const owner = sourceEnclosingCallable(node, ast);
    if (entries.length !== 0 && argument !== undefined && owner !== undefined && sourceGenericAdoptionPromiseMember(source, declaration, semantics) === undefined) {
      const subject = input.storage.subjectFor(callee);
      if (subject.kind === "unresolved") { refuse(node, subject.reason); break; }
      for (const entry of entries) {
        const executions = input.storage.contributingExecutionsFor(subject.subject, owner, entry.producer);
        if (executions.kind === "unresolved") {
          unknownArgument(node, argument, executions.reason);
          continue;
        }
        const contexts = executionContexts(node, owner, executions, reason => unknownArgument(node, argument, reason));
        if (contexts === undefined) continue;
        for (const context of contexts) {
          const origins = input.storage.storageProducersFor(subject.subject, context.bindings);
          if (origins.kind === "unresolved") {
            if (input.storage.failureReason() !== undefined) refuse(node, input.storage.failureReason()!);
            else qualify(node, argument, context.bindings, undefined, Object.freeze({ kind: "unresolved", at: node, reason: origins.reason }));
            continue;
          }
          const resolvers: SourceStorageProducer[] = [];
          let unknown: SourceOwnershipUnresolved | undefined;
          for (const producer of origins.producers) {
            const selected = resolverFor(producer, entry);
            if (selected === true) resolvers.push(producer);
            else if (selected !== false) unknown ??= selected;
          }
          if (resolvers.length !== 0) qualify(node, argument, context.bindings, entry.resultType, context.uncertain
            ? Object.freeze({ kind: "unresolved", at: node, reason: "A relevant callback execution remains open." }) : undefined);
          if (origins.kind === "open" && origins.boundaries.some(boundary => boundary.kind !== "external-input" ||
            !resolvers.some(producer => producer.subject === boundary.subject))) unknown ??= Object.freeze({ kind: "unresolved", at: node,
            reason: "A generic resolving call requires its complete same-activation callable provenance." });
          if (unknown !== undefined) qualify(node, argument, context.bindings, undefined,
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
  if (entries.length !== 0) for (const { node, selected } of calls) {
    if (!step(node)) break;
    const owner = sourceEnclosingCallable(node, ast);
    if (owner === undefined) continue;
    const semantics = source.semantics.forNode(node);
    const callee = selected.sourceCallee.expression;
    const callbacks = input.storage.nativeCallbackArgumentsFor(node);
    if (callbacks.kind === "unresolved") {
      if (input.storage.failureReason() !== undefined) refuse(node, input.storage.failureReason()!);
      else for (const binding of selected.sourceArgumentBindings) {
        const type = semantics.types.nonNullableType(binding.selectedParameterType);
        if (type !== undefined && semantics.types.callSignatures(type).length !== 0)
          unknownNativeInput(node, binding.selectedParameterType, callbacks.reason);
      }
    }
    if (callbacks.kind !== "unresolved" && callbacks.arguments.length !== 0) {
      const subject = input.storage.subjectFor(callee);
      if (subject.kind === "unresolved") { refuse(node, subject.reason); break; }
      for (const entry of entries) {
        const executions = input.storage.contributingExecutionsFor(subject.subject, owner, entry.producer);
        if (executions.kind === "unresolved") {
          for (const callback of callbacks.arguments) unknownNativeInput(node, callback.binding.selectedParameterType, executions.reason);
          continue;
        }
        const contexts = executionContexts(node, owner, executions, reason => {
          for (const callback of callbacks.arguments) unknownNativeInput(node, callback.binding.selectedParameterType, reason);
        });
        if (contexts === undefined) continue;
        for (const context of contexts) {
          for (const callback of callbacks.arguments) {
            const origins = input.storage.storageProducersFor(callback.actual, context.bindings);
            if (origins.kind === "unresolved") { unknownNativeInput(node, callback.binding.selectedParameterType, origins.reason); continue; }
            const resolvers: SourceStorageProducer[] = [];
            let unresolved: SourceOwnershipUnresolved | undefined;
            for (const producer of origins.producers) {
              const identity = resolverFor(producer, entry);
              if (identity === true) resolvers.push(producer);
              else if (identity !== false) unresolved ??= identity;
            }
            if (resolvers.length === 0 && unresolved === undefined) continue;
            const openOrigins = origins.kind === "open" && origins.boundaries.some(boundary => boundary.kind !== "external-input" ||
              !resolvers.some(producer => producer.subject === boundary.subject));
            if (callbacks.kind === "open" || context.uncertain || openOrigins) unresolved ??=
              Object.freeze({ kind: "unresolved", at: node, reason: "A native resolver callback requires its complete same-activation execution and identity." });
            const type = semantics.types.nonNullableType(callback.binding.selectedParameterType);
            const signatures = type === undefined ? [] : semantics.types.callSignatures(type);
            if (signatures.length !== 1) { unknownNativeInput(node, callback.binding.selectedParameterType,
              "A native resolver callback requires its exact checked contextual signature."); continue; }
            const parameter = semantics.types.signatureParameterInfos(signatures[0]!)[0];
            if (parameter === undefined) continue;
            if (resolvers.length !== 0 && (semantics.types.isAny(parameter.type) || semantics.types.isUnknown(parameter.type))) {
              markType(node, entry.resultType, semantics, Object.freeze({ kind: "unresolved", at: node,
                reason: "An actual native resolver requires a completed checked native input bound." }));
              continue;
            }
            qualifyBoundType(node, parameter.type, semantics, context.bindings, unresolved);
          }
        }
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
  const formatDiagnostic = createSourceGenericAdoptionDiagnostics(source, input.projectRoot);
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

function sourceGenericAdoptionPromiseMember(source: TargetSourceProgram, declaration: Node,
  semantics: SourceFileSemantics): string | undefined {
  const fact = source.sourceFacts.getFact(declaration, providerVirtualDeclarationFactKey);
  if (fact?.providerId === "tsonic.js.source-virtual-modules" &&
    (fact.exportName === "Promise" || fact.exportName === "PromiseLike" || fact.exportName === "PromiseConstructor"))
    return fact.memberKey?.kind === "property-key" ? fact.memberKey.name : fact.memberName ?? "construct";
  const { ast } = source;
  const file = ast.getSourceFile(declaration);
  if (file === undefined || !ast.isDeclarationFile(file) || source.navigation.isProjectDeclaration(declaration) ||
    !(isTsonicSourceProfileDeclarationPath(ast.getFileName(file)) ||
      semantics.declarations.isDefaultLibraryDeclaration(declaration))) return undefined;
  const owner = ast.parent(declaration);
  const ownerName = ast.text(ast.name(owner));
  if (ownerName !== "Promise" && ownerName !== "PromiseLike" && ownerName !== "PromiseConstructor") return undefined;
  return ast.is.IsConstructSignatureDeclaration(declaration) ? "construct" : ast.text(ast.name(declaration));
}

export function analyzeSourceDeclarationGenericAdoption(input: {
  readonly source: TargetSourceProgram;
  readonly projectRoot: string;
  readonly nodes: readonly Node[];
  readonly premises: Pick<SourceDeclarationOwnershipPremises, "completionFor">;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly exemptTypeParameter?: (parameter: Node) => boolean;
}): { readonly kind: "resolved"; readonly issues: readonly SourceGenericAdoptionIssue[] }
  | SourceDeclarationOwnershipUnresolved {
  const { source, budget } = input;
  const { ast } = source;
  const root = input.nodes[0] ?? source.sourceFiles[0];
  if (root === undefined) return Object.freeze({ kind: "resolved", issues: Object.freeze([]) });
  const domain = sourceNodesOutsideErasedSubtrees(ast, input.nodes, node =>
    ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node)
      ? sourceCallableDefinitionIsDiscarded(node, ast, source.navigation)
      : sourceLexicalFunctionIsUnused(node, ast, source.navigation));
  if (domain.kind === "unresolved") return sourceDeclarationOwnershipUnresolved(root, domain.reason);
  const rows = budget.createRows(root);
  const parameters = new Map<Node, { readonly owner: Node; readonly neighbours: Set<Node>; operation: Node | undefined }>();
  const calls: { readonly node: Node; readonly selected: ResolvedSourceCallInfo; readonly declaration: Node }[] = [];
  const instances: { readonly site: Node; readonly parameter: Node; readonly actual: Type; readonly operation?: Node }[] = [];
  const resolverParameters = new Set<Node>();
  const callbackRelations = new Map<Node, Map<Node, Node>>();
  const instanceSites = new Map<Node, Map<Node, Map<Type, Set<Node | undefined>>>>();
  const parameterTypes = new Map<Type, ReadonlySet<Node>>();
  let failure: SourceDeclarationOwnershipUnresolved | undefined;
  const step = (node: Node): boolean => {
    if (budget.step(node)) return true;
    failure ??= budget.failure();
    return false;
  };
  const parametersIn = (type: Type, semantics: SourceFileSemantics): ReadonlySet<Node> => {
    const existing = parameterTypes.get(type);
    if (existing !== undefined) return existing;
    const found = new Set<Node>();
    const pending = [type];
    const visited = new Set<Type>();
    while (pending.length !== 0) {
      if (!step(semantics.sourceFile)) break;
      const selected = pending.pop()!;
      if (visited.has(selected)) continue;
      if (!rows.add(1)) { failure ??= budget.failure(); break; }
      visited.add(selected);
      const symbol = semantics.declarations.typeSymbol(selected);
      const declarations = symbol === undefined ? [] : semantics.declarations.symbolDeclarations(symbol);
      for (const declaration of declarations) if (parameters.has(declaration)) found.add(declaration);
      if (declarations.some(declaration => ast.is.IsTypeParameterDeclaration(declaration))) continue;
      if (semantics.types.isUnion(selected) || semantics.types.isIntersection(selected)) {
        pending.push(...semantics.types.unionOrIntersectionTypes(selected));
        continue;
      }
      const awaited = semantics.types.awaitedType(selected);
      if (awaited === undefined) {
        failure ??= sourceDeclarationOwnershipUnresolved(semantics.sourceFile,
          "A declared generic relation requires its completed checked Awaited component.");
        break;
      }
      if (awaited !== undefined && !semantics.types.isIdentical(awaited, selected)) pending.push(awaited);
    }
    if (failure === undefined && rows.add(1)) parameterTypes.set(type, found);
    else failure ??= budget.failure();
    return found;
  };
  const mark = (operation: Node, type: Type, semantics: SourceFileSemantics): void => {
    for (const declaration of parametersIn(type, semantics)) parameters.get(declaration)!.operation ??= operation;
  };
  const referenceDeclaration = (node: Node): Node | undefined => {
    if (ast.is.IsParameterDeclaration(node)) return node;
    const direct = source.navigation.sourceReferenceFor(node)?.declaration;
    if (direct === undefined || !ast.is.IsVariableDeclaration(direct) || ast.variableDeclarationKind(direct) !== "const")
      return direct;
    const initializer = Node_Initializer(ast, direct);
    return initializer === undefined ? direct : source.navigation.sourceReferenceFor(initializer)?.declaration ?? direct;
  };
  const relation = (callback: Node, parameter: Node, operation: Node): boolean => {
    const previous = callbackRelations.get(callback);
    if (previous?.has(parameter)) return false;
    if (!rows.add(previous === undefined ? 2 : 1)) { failure ??= budget.failure(); return false; }
    const selected = previous ?? new Map<Node, Node>();
    selected.set(parameter, operation);
    callbackRelations.set(callback, selected);
    return true;
  };
  const instance = (site: Node, parameter: Node, actual: Type, operation?: Node): void => {
    if (!parameters.has(parameter)) return;
    const byParameter = instanceSites.get(site);
    const byActual = byParameter?.get(parameter);
    const operations = byActual?.get(actual);
    if (operations?.has(operation)) return;
    if (!rows.add(1 + (byParameter === undefined ? 1 : 0) + (byActual === undefined ? 1 : 0) +
      (operations === undefined ? 1 : 0))) { failure ??= budget.failure(); return; }
    const parameterSites = byParameter ?? new Map<Node, Map<Type, Set<Node | undefined>>>();
    const actualSites = byActual ?? new Map<Type, Set<Node | undefined>>();
    const operationSites = operations ?? new Set<Node | undefined>();
    operationSites.add(operation);
    actualSites.set(actual, operationSites);
    parameterSites.set(parameter, actualSites);
    instanceSites.set(site, parameterSites);
    instances.push(Object.freeze({ site, parameter, actual, ...(operation === undefined ? {} : { operation }) }));
    for (const forwarded of parametersIn(actual, source.semantics.forNode(site))) {
      const selected = parameters.get(forwarded)!;
      if (operation !== undefined) selected.operation ??= operation;
      else if (!selected.neighbours.has(parameter)) {
        if (!rows.add(1)) { failure ??= budget.failure(); return; }
        selected.neighbours.add(parameter);
      }
    }
  };
  try {
    for (const node of domain.nodes) {
      if (!step(node)) break;
      if (!ast.is.IsTypeParameterDeclaration(node) || !source.navigation.isProjectDeclaration(node) ||
        input.exemptTypeParameter?.(node) === true) continue;
      const owner = ast.parent(node);
      const type = source.semantics.forNode(node).declarations.declaredType(node);
      if (owner === undefined || type === undefined)
        return sourceDeclarationOwnershipUnresolved(node, "Generic adoption requires the exact checked formal declaration.");
      if (!rows.add(2)) return budget.failure()!;
      parameters.set(node, { owner, neighbours: new Set(), operation: undefined });
    }
    for (const node of domain.nodes) {
      if (!step(node)) break;
      const semantics = source.semantics.forNode(node);
      if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) {
        const selected = semantics.operations.call(node);
        const declaration = selected?.sourceSelectedSignatureKind === "resolved"
          ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
        if (selected === undefined || declaration === undefined) continue;
        if (!rows.add(1)) return budget.failure()!;
        calls.push(Object.freeze({ node, selected, declaration }));
        const completion = input.premises.completionFor(node, selected);
        if (completion.kind === "unresolved") return completion;
        if (completion.kind === "async") {
          const problem = sourceDeclarationOwnershipContractProblem(source, node,
            { selectedType: selected.sourceResultType }, completion.contract);
          if (problem !== undefined) return sourceDeclarationOwnershipUnresolved(node, problem);
        }
        const member = sourceGenericAdoptionPromiseMember(source, declaration, semantics);
        const argument = ast.arguments(node)[0];
        if (member === "resolve" && argument !== undefined) {
          const type = semantics.types.expressionType(argument);
          if (type === undefined) return sourceDeclarationOwnershipUnresolved(argument, "A native resolver requires its completed checked input component.");
          mark(node, type, semantics);
        }
        if (member === "construct" && argument !== undefined) {
          const executor = semantics.types.expressionType(argument);
          const signatures = executor === undefined ? [] : semantics.types.signatureInfos(executor, "call");
          const resolver = signatures.length === 1 ? signatures[0]!.parameters[0]?.declaration : undefined;
          if (resolver === undefined)
            return sourceDeclarationOwnershipUnresolved(argument, "A native Promise executor requires its exact checked resolver parameter contract.");
          if (!rows.add(1)) return budget.failure()!;
          resolverParameters.add(resolver);
        } else if (member === "then" || member === "catch" || member === "finally") {
          for (const callback of ast.arguments(node)) {
            if (callback === undefined) continue;
            if (!step(callback)) break;
            const type = semantics.types.expressionType(callback);
            if (type === undefined)
              return sourceDeclarationOwnershipUnresolved(callback, "A native reaction requires its exact checked callback result contract.");
            for (const signature of semantics.types.signatureInfos(type, "call")) {
              if (!step(callback)) break;
              if (signature.returnType !== undefined) mark(node, signature.returnType, semantics);
            }
          }
        }
        for (const argument of selected.sourceSelectedMethodTypeArguments ?? []) {
          const symbol = semantics.declarations.typeSymbol(argument.typeParameter);
          const parameter = symbol === undefined ? undefined : semantics.declarations.symbolDeclarations(symbol)
            .find(candidate => parameters.has(candidate));
          if (parameter !== undefined) instance(node, parameter, argument.selectedType);
        }
        for (const type of [selected.sourceReceiver?.type,
          ...(ast.is.IsNewExpression(node) ? [selected.sourceResultType] : [])]) {
          if (type === undefined) continue;
          for (const binding of semantics.types.typeArgumentBindings(type) ?? [])
            instance(node, binding.declaration, binding.argumentType);
        }
      }
      const expression = ast.is.IsAwaitExpression(node) || ast.is.IsReturnStatement(node) ? Node_Expression(ast, node)
        : ast.is.IsArrowFunction(node) && ast.body(node) !== undefined && !ast.is.IsBlock(ast.body(node)) ? ast.body(node) : undefined;
      if (expression === undefined) continue;
      const owner = ast.is.IsArrowFunction(node) ? node : sourceEnclosingCallable(node, ast);
      if (!ast.is.IsAwaitExpression(node) && (owner === undefined || !ast.hasModifierKind(owner, "async"))) continue;
      const type = semantics.types.expressionType(expression);
      if (type === undefined) return sourceDeclarationOwnershipUnresolved(expression, "Generic completion requires its exact checked result component.");
      mark(node, type, semantics);
    }
    for (const { node, selected } of calls) {
      if (!step(node)) break;
      const callback = referenceDeclaration(selected.sourceCallee.expression);
      const argument = ast.arguments(node)[0];
      if (callback === undefined || argument === undefined || !ast.is.IsParameterDeclaration(callback)) continue;
      const semantics = source.semantics.forNode(argument);
      const type = semantics.types.expressionType(argument);
      if (type === undefined) return sourceDeclarationOwnershipUnresolved(argument, "A declared callback relation requires its checked input type.");
      if (resolverParameters.has(callback)) mark(node, type, semantics);
      else for (const parameter of parametersIn(type, semantics)) relation(callback, parameter, node);
    }
    let changed = true;
    while (changed && failure === undefined) {
      changed = false;
      for (const { node, selected, declaration } of calls) {
        if (!step(node)) break;
        const semantics = source.semantics.forNode(node);
        for (const binding of selected.sourceArgumentBindings) {
          if (!step(node)) break;
          const formal = ast.parameters(declaration)[binding.sourceParameterIndex];
          const actual = ast.arguments(node)[binding.sourceArgumentIndex];
          if (formal === undefined || actual === undefined) continue;
          const constraints = callbackRelations.get(formal);
          if (constraints === undefined) continue;
          const callback = referenceDeclaration(actual);
          if (callback === undefined) continue;
          for (const [parameter, operation] of constraints) {
            const selectedArgument = selected.sourceSelectedMethodTypeArguments?.find(argument => {
              const symbol = semantics.declarations.typeSymbol(argument.typeParameter);
              return symbol !== undefined && semantics.declarations.symbolDeclarations(symbol).includes(parameter);
            });
            const receiverArgument = selected.sourceReceiver === undefined ? undefined
              : semantics.types.typeArgumentBindings(selected.sourceReceiver.type)?.find(argument => argument.declaration === parameter);
            const parameterOwner = parameters.get(parameter)!.owner;
            let lexical: Node | undefined = declaration;
            const visited = new Set<Node>();
            while (lexical !== undefined && lexical !== parameterOwner) {
              if (!step(node)) break;
              if (visited.has(lexical))
                return sourceDeclarationOwnershipUnresolved(node, "A declared callback binding has cyclic checked ancestry.");
              visited.add(lexical);
              lexical = ast.parent(lexical);
            }
            const lexicalType = lexical === parameterOwner && declaration !== parameterOwner &&
                !ast.is.IsClassDeclaration(parameterOwner) && !ast.is.IsClassExpression(parameterOwner)
              ? semantics.declarations.declaredType(parameter) : undefined;
            const argumentType = selectedArgument?.selectedType ?? receiverArgument?.argumentType ?? lexicalType;
            if (argumentType === undefined) continue;
            if (resolverParameters.has(callback)) instance(node, parameter, argumentType, operation);
            else if (ast.is.IsParameterDeclaration(callback)) for (const forwarded of parametersIn(argumentType, semantics))
              changed = relation(callback, forwarded, operation) || changed;
          }
        }
      }
    }
    if (failure !== undefined) return failure;
    const sensitive = createTargetGraphComponentQuery<Node, Node | undefined, Node | null>(parameter => {
      if (!step(parameter)) return undefined;
      const selected = parameters.get(parameter);
      return selected === undefined ? undefined : { data: selected.operation, neighbours: selected.neighbours };
    }, members => members.find(member => member.data !== undefined)?.data ??
      members.flatMap(member => member.successors).find(operation => operation !== null) ?? null,
    { step: () => step(root), createRows: () => budget.createRows(root) });
    const format = createSourceGenericAdoptionDiagnostics(source, input.projectRoot);
    const issues: SourceGenericAdoptionIssue[] = [];
    const issuedSites = new Set<Node>();
    for (let index = 0; index < instances.length; index += 1) {
      const entry = instances[index]!;
      if (!step(entry.site)) break;
      const semantics = source.semantics.forNode(entry.site);
      if (semantics.types.isAny(entry.actual) || semantics.types.isUnknown(entry.actual)) continue;
      const actualSymbol = semantics.declarations.typeSymbol(entry.actual);
      if (actualSymbol !== undefined && semantics.declarations.symbolDeclarations(actualSymbol)
        .some(declaration => parameters.has(declaration))) continue;
      if (semantics.types.isUnion(entry.actual) || semantics.types.isIntersection(entry.actual)) {
        for (const part of semantics.types.unionOrIntersectionTypes(entry.actual)) instance(entry.site, entry.parameter, part, entry.operation);
        continue;
      }
      const awaited = semantics.types.awaitedType(entry.actual);
      if (awaited === undefined) return sourceDeclarationOwnershipUnresolved(entry.site, "Generic completion requires its exact checked native result relation.");
      if (semantics.types.isIdentical(awaited, entry.actual)) continue;
      const operation = entry.operation ?? sensitive(entry.parameter);
      if (operation === undefined) return failure ?? budget.failure() ??
        sourceDeclarationOwnershipUnresolved(entry.site, "The finite declared generic relation is incomplete.");
      if (operation === null || issuedSites.has(entry.site)) continue;
      const declaration = parameters.get(entry.parameter)!.owner;
      const formatted = format(entry.site, declaration, operation);
      if (formatted === undefined) return sourceDeclarationOwnershipUnresolved(entry.site, "Generic diagnostics require their original checked spans.");
      if (!rows.add(1)) return budget.failure()!;
      issuedSites.add(entry.site);
      issues.push(Object.freeze({ site: entry.site, parameter: entry.parameter, declaration, operation, ...formatted }));
    }
    return failure ?? Object.freeze({ kind: "resolved", issues: Object.freeze(issues) });
  } finally { rows.release(); }
}
