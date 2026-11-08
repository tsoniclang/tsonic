import type { Node } from "@tsonic/tsts";
import type { SourceInputComponent } from "../../host-input/identities.js";
import type { SourceInputBackingConstraint, SourceInputCallCandidate, SourceInputDiagnosticIdentity } from "../../host-input/call-input.js";
import type { SourceApplication, SourceConstruction, SourceDeclaredSlot, SourceOperation, SourcePresence, SourceResult,
  SourceSignatureIdentity, SourceTypeBinding, SourceTypeEvidence, SourceUseDestination } from "../../public/source/contracts.js";
import type { SourceDescriptorProductionHooks, SourceProductionResult } from "../descriptor-contracts.js";
import { Node_Initializer } from "../../source-navigation/ast.js";
import { createSourceEnumFacts } from "../enum-facts.js";
import { sourceEnumDestination, sourceEnumValueDomain } from "../enum-numeric-uses.js";
import { createSourceTypeFlowAnalysisContext } from "./defaults.js";
import { collectSourceTypeFlowEdges } from "./edges.js";
import { collectSourceTypeFlowUses } from "./uses.js";
import { createSourceGraphSolver } from "./graph-solver.js";
import { createSourceTypeFlowDeclaredSlotReader } from "./declared-slots.js";
import { createSourceConstructionProduction } from "./construction-production.js";
import { createSourceProductionCache } from "./production-cache.js";
import { createSourceSolvedFacts } from "./publication.js";
import { createSourceLiteralDomainQueries } from "./literal-domains.js";
import { createSourceSolvedProtocolFacts } from "./protocol-production.js";
import { produceSourceApplication, type SourceApplicationProduction, type SourceProducedApplication } from "./applications.js";
import { produceSourceCallableSignature, produceSourceHeritageBindings } from "./callable-production.js";
import { produceSourceDeclaredComponent, produceSourceDeclaredSlot, produceSourceCallableCompletion,
  produceSourceMemberDestination, sourceUnresolvedDeclaration, type SourceDeclarationProduction } from "./declaration-production.js";
import { produceSourceOperation } from "./operation-production.js";
import { produceSourceValue } from "./value-production.js";
import { sourceEvidenceExtends } from "./evidence-relations.js";
import { sourcePrimitiveOperatorLiteralFits } from "./operator-decisions.js";
import { sourceSemanticRefusal } from "./semantic-production.js";
import { indexSource } from "./type-keys.js";
import { produceSourceArgumentContext, sourceArgumentContextSite } from "./argument-context.js";
import { produceSourceApplicationComponent } from "./component-production.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import type { SourceTypeFlowAnalysisContext, SourceTypeFlowSource } from "./types.js";

export function analyzeSourceTypeFlow(source: SourceTypeFlowSource) {
  const { ast, input, descriptorBuilder: builder } = source;
  let context: SourceTypeFlowAnalysisContext;
  let graph: ReturnType<typeof createSourceGraphSolver> | undefined;
  let declarationProduction: SourceDeclarationProduction | undefined;
  let applicationProduction: SourceApplicationProduction | undefined;
  let slots: ReturnType<typeof createSourceTypeFlowDeclaredSlotReader> | undefined;
  let construction: ReturnType<typeof createSourceConstructionProduction> | undefined;
  let protocols: ReturnType<typeof createSourceSolvedProtocolFacts> | undefined;
  const demandedDeclarations = new Set<Node>();
  const signatures = new Set<SourceSignatureIdentity>();
  const signatureResults = new Map<SourceSignatureIdentity, SourceTypeEvidence>();
  const signatureRefusals = new Map<SourceSignatureIdentity, Extract<SourceResult<never>, { kind: "refused" }>>();
  const diagnostics = new Set<SourceInputDiagnosticIdentity>();
  const dependency = (node: Node) => builder.componentIdentity(node, []);
  const pending = (node: Node): SourceProductionResult<never> => ({ kind: "pending", dependencies: [dependency(node)] });
  const none = Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "none" }) } as const);

  const values = createSourceProductionCache<Node, SourceTypeEvidence>({ dependency,
    produce: (node, bindings) => {
      const result = produceSourceValue({ ...semantic(), context, inferred,
      expected, construction: occurrence => {
        if (construction === undefined) return pending(occurrence);
        const result = construction.produce(occurrence);
        return result.kind !== "resolved" ? result : { kind: "resolved", value: result.value.value };
      }, yielded: occurrence => {
        if (protocols === undefined) return pending(occurrence);
        const result = protocols.yield(occurrence);
        return result.kind !== "resolved" ? result : result.value.kind === "none"
          ? sourceSemanticRefusal(occurrence, "An original yield requires its canonical generator activation.")
          : { kind: "resolved", value: result.value.value.resumed };
      } }, node, bindings);
      if (result.kind === "resolved" && bindings.length === 0) observeHead(result.value);
      return result;
    } });
  const declarations = createSourceProductionCache<Node, SourceDeclaredSlot>({ dependency,
    produce(node, bindings) {
      if (declarationProduction === undefined) return pending(node);
      const result = produceSourceDeclaredSlot(declarationProduction, node, bindings);
      if (result.kind === "resolved" && bindings.length === 0) observeHead(result.value.type);
      return result;
    } });
  const completions = createSourceProductionCache<Node, SourceTypeEvidence>({ dependency,
    produce: (node, bindings) => declarationProduction === undefined ? pending(node) : produceSourceCallableCompletion(declarationProduction, node, bindings) });
  const returns = createSourceProductionCache<SourceSignatureIdentity, SourceTypeEvidence>({
    dependency: signature => dependency(signature.declaration ?? signature.owner),
    produce(signature, bindings) {
      signatures.add(signature);
      const published = signatureResults.get(signature);
      if (published !== undefined) return builder.substitute(published, bindings);
      if (signature.declaration === undefined) return sourceSemanticRefusal(signature.owner,
        "An original nonsyntax callable result requires its authenticated signature component.", "TSONIC_LOCAL_TYPE_SIGNATURE");
      return completions.query(signature.declaration, bindings);
    } });
  const applications = createSourceProductionCache<Node, SourceProducedApplication>({ dependency,
    produce(node) {
      if (applicationProduction === undefined) return pending(node);
      return produceSourceApplication(applicationProduction, node);
    } });
  const operations = createSourceProductionCache<Node, SourceOperation>({ dependency,
    produce(node) {
      return produceSourceOperation({ ...semantic(), value: occurrence => value(occurrence, []), literal: context.literal,
        unboundLiteral: occurrence => {
          const selected = graph?.expected(occurrence);
          return selected === undefined || selected.kind === "resolved" && selected.value.length === 0 ? context.literal(occurrence) : undefined;
        }, destination: occurrence => destination(occurrence, []), expected: occurrence => {
          const selected = expected(occurrence);
          if (selected.kind !== "resolved") return selected;
          return { kind: "resolved", value: selected.value?.type.kind === "primitive" ? selected.value.type.primitive : undefined };
        } }, node);
    } });
  const destinations = createSourceProductionCache<Node, SourcePresence<SourceUseDestination>>({ dependency,
    produce: (node, bindings) => slots === undefined ? pending(node) : slots.destination(node, bindings) });
  const enums = createSourceEnumFacts({ sourceFiles: source.sourceFiles, input, navigation: source.navigation, builder,
    componentIdentity: component => context.reader.componentIdentity(component) });

  function semantic() {
    return { ast, input, builder, reader: context.reader, objects: context.objects };
  }
  function observeHead(value: SourceTypeEvidence): void {
    if (value.sum !== undefined) { for (const arm of value.sum.arms) observeHead(arm); return; }
    if (value.type.kind !== "shape" && value.type.kind !== "callable") return;
    for (const signature of [...value.type.calls, ...value.type.constructs]) {
      const result = builder.component(value, { kind: "result", signature: signature.identity });
      if (result.kind === "refused") throw new Error("A published callable head must retain its authenticated original result edge.");
      signatures.add(signature.identity);
      if (!signatureResults.has(signature.identity)) signatureResults.set(signature.identity, result.value);
    }
  }
  function value(node: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence> {
    input.assertNode(node);
    return values.query(node, bindings);
  }
  function declared(node: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceDeclaredSlot> {
    input.assertNode(node);
    demandedDeclarations.add(node);
    return declarations.query(node, bindings);
  }
  function place(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence> {
    input.assertComponent(component);
    return context === undefined ? pending(component.root) : context.reader.describeComponent(component, bindings);
  }
  function destination(node: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourcePresence<SourceUseDestination>> {
    return destinations.query(node, bindings);
  }
  function application(node: Node): SourceProductionResult<SourceApplication> {
    const result = applications.query(node, []);
    return result.kind !== "resolved" ? result : { kind: "resolved", value: result.value.application };
  }
  function operation(node: Node): SourceProductionResult<SourceOperation> { return operations.query(node, []); }
  function completion(declaration: Node, bindings: readonly SourceTypeBinding[]) { return completions.query(declaration, bindings); }
  function callableReturn(signature: SourceSignatureIdentity, bindings: readonly SourceTypeBinding[]) { return returns.query(signature, bindings); }

  const hooks: SourceDescriptorProductionHooks = {
    declaredValue: (component, declaration, bindings) => declarationProduction === undefined ? pending(component.root)
      : produceSourceDeclaredComponent(declarationProduction, component, declaration, bindings),
    signatureRefusal: signature => signatureRefusals.get(signature),
    inheritedBindings(component, bindings) {
      if (declarationProduction === undefined) return pending(component.root);
      const facts = input.describe(component);
      const declaration = facts.definitionOwner ?? facts.declaration;
      return declaration === undefined || !(ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration) ||
        ast.is.IsInterfaceDeclaration(declaration)) ? { kind: "resolved", value: bindings }
        : produceSourceHeritageBindings(declarationProduction, declaration, bindings);
    },
  };
  context = createSourceTypeFlowAnalysisContext(source, { declared, value, place, destination, application, operation, callableReturn, hooks,
    syntaxValue(node, bindings) {
      const reference = source.navigation.sourceReferenceFor(node)?.declaration;
      if (reference !== undefined && (ast.is.IsVariableDeclaration(reference) || ast.is.IsEnumMember(reference))) {
        if (ast.is.IsEnumMember(reference)) {
          const selected = enums.facts.member(reference);
          return selected.kind === "refused" ? selected : { kind: "resolved", value: selected.value.value };
        }
        const initializer = Node_Initializer(ast, reference);
        if (initializer !== undefined && ast.variableDeclarationKind(reference) === "const") return value(initializer, bindings);
      }
      return context.reader.describeSyntax(node, bindings);
    },
    memberDestination: (occurrence, receiver, member) => declarationProduction === undefined ? pending(occurrence)
      : produceSourceMemberDestination(declarationProduction, occurrence, receiver, member),
    memberValue(occurrence, receiver, purpose, arms, optionalChain) {
      builder.assertEvidence(receiver);
      const values = [...arms];
      if (purpose === "read" && optionalChain && (receiver.type.kind === "optional" || receiver.sum?.arms.some(arm =>
        arm.type.kind === "intrinsic" && arm.type.intrinsic === "absence"))) values.push(builder.evidence({ type: builder.intrinsic("absence"),
        component: dependency(occurrence), category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined },
      [], undefined, { kind: "finite", values: [{ kind: "absence" }] },
      { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [occurrence] } }));
      return builder.join(dependency(occurrence), "inferred", values, undefined);
    },
  });
  slots = createSourceTypeFlowDeclaredSlotReader(context, expected);
  declarationProduction = { ...semantic(), context, navigation: source.navigation, value, place,
    parameter(component, declaration, _signature, index, bindings) {
      if (declaration === undefined) return place(component, bindings);
      const contextual = slots!.parameter(declaration, bindings);
      if (contextual.kind !== "resolved") return contextual;
      return contextual.value.kind === "present" ? { kind: "resolved", value: contextual.value.value }
        : sourceSemanticRefusal(declaration, `The original formal parameter at index ${index} has no authored or solved contextual component.`, "TSONIC_LOCAL_TYPE_SIGNATURE");
    }, completion, inferred, enumValue: enums.value,
    observeSignature(signature, result, bindings) {
      signatures.add(signature);
      if (bindings.length === 0 && !signatureResults.has(signature)) signatureResults.set(signature, result);
    },
    iteration(declaration) {
      let owner = ast.parent(declaration);
      if (owner !== undefined && ast.is.IsVariableDeclarationList(owner)) owner = ast.parent(owner);
      if (owner === undefined || !ast.is.IsForOfStatement(owner) && !ast.is.IsForInStatement(owner))
        return { kind: "resolved", value: undefined };
      if (protocols === undefined) return pending(owner);
      const selected = protocols.iteration(owner);
      return selected.kind !== "resolved" ? selected : { kind: "resolved", value: selected.value.kind === "present" ? selected.value.value.element : undefined };
    } };
  applicationProduction = { ...declarationProduction, profile: source.profile,
    component: (component, bindings, candidate) => produceSourceApplicationComponent(declarationProduction!, component, bindings, candidate),
    admits, proves };
  construction = createSourceConstructionProduction({ ...semantic(), value: node => value(node, []),
    completion: node => completion(node, []), propertyName: context.propertyName, destination: node => destination(node, []),
    element: (source, node) => protocols === undefined ? pending(node) : protocols.element(source, node) });
  for (const node of context.nodes) if (ast.is.IsObjectLiteralExpression(node) && !ast.getSourceFile(node)?.IsDeclarationFile)
    builder.registerConstruction(node, () => construction!.metadata(node));
  protocols = createSourceSolvedProtocolFacts({ ...declarationProduction, protocolInput: source.protocolInput,
    signature: (original, bindings) => produceSourceCallableSignature(declarationProduction!, original, bindings, undefined) });
  const collected = collectSourceTypeFlowEdges(context);
  graph = createSourceGraphSolver(context, collected, collectSourceTypeFlowUses(context, collected),
    node => value(node, []), node => contextual(node, []));

  function inferred(node: Node): SourceProductionResult<SourceTypeEvidence> {
    if (graph === undefined) return pending(node);
    if (ast.is.IsIdentifier(node)) {
      const reference = source.navigation.sourceReferenceFor(node)?.declaration;
      if (reference !== undefined && reference !== node && (ast.is.IsVariableDeclaration(reference) || ast.is.IsParameterDeclaration(reference) ||
        ast.is.IsBindingElement(reference) || ast.is.IsPropertyDeclaration(reference))) {
        const slot = declared(reference, []);
        if (slot.kind !== "resolved") return slot;
        if (ast.is.IsVariableDeclaration(reference) && ast.variableDeclarationKind(reference) === "const") {
          const initializer = Node_Initializer(ast, reference);
          if (initializer !== undefined) return value(initializer, []);
        }
        return { kind: "resolved", value: slot.value.type };
      }
    }
    const variable = graph.variable(node);
    return variable === undefined ? sourceUnresolvedDeclaration(declarationProduction!, node) : graph.resolve(variable);
  }
  function expected(node: Node, bindings: readonly SourceTypeBinding[] = []): SourceProductionResult<SourceTypeEvidence | undefined> {
    const selected = graph?.expected(node);
    if (selected !== undefined && selected.kind !== "resolved") return selected;
    const candidates = selected?.kind === "resolved" ? selected.value : [];
    if (candidates.length > 0) {
      if (!candidates.every(value => value.type === candidates[0]!.type)) return sourceSemanticRefusal(node,
        "This original Source value has conflicting declared destinations.", "TSONIC_LOCAL_TYPE_CONFLICT");
      return { kind: "resolved", value: candidates[0] };
    }
    return contextual(node, bindings);
  }
  function contextual(node: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence | undefined> {
    if (slots === undefined) return pending(node);
    const argument = sourceArgumentContextSite({ ast }, node);
    if (argument !== undefined) {
      if (declarationProduction === undefined) return pending(node);
      const selected = produceSourceArgumentContext(declarationProduction, argument.occurrence, argument.invocation);
      return selected.kind !== "resolved" ? selected : { kind: "resolved", value: selected.value.kind === "present" ? selected.value.value : undefined };
    }
    const selected = slots.destination(node, bindings);
    return selected.kind !== "resolved" ? selected : { kind: "resolved", value: selected.value.kind === "present" ? selected.value.value.applied : undefined };
  }
  function admits(actual: SourceTypeEvidence, required: SourceTypeEvidence, site: Node): SourceProductionResult<boolean> {
    const enumAdmission = sourceEnumDestination(semantic(), actual, required, site);
    if (enumAdmission.kind !== "resolved") return enumAdmission;
    const relation = sourceEvidenceExtends(semantic(), actual, required);
    if (relation.kind !== "resolved") return relation;
    if (relation.value === "deferred") return { kind: "pending", dependencies: [actual.component, required.component] };
    if (relation.value === "yes") return { kind: "resolved", value: true };
    const literal = context.literal(site);
    if (literal !== undefined && required.type.kind === "primitive" && actual.category.kind === "known" && actual.category.category === "number") {
      return { kind: "resolved", value: sourcePrimitiveOperatorLiteralFits(literal, required.type.primitive) };
    }
    return { kind: "resolved", value: false };
  }
  function proves(constraint: SourceInputBackingConstraint, bindings: readonly SourceTypeBinding[], candidate: SourceInputCallCandidate): SourceProductionResult<boolean> {
    if (constraint.application !== undefined && constraint.application !== candidate.application) return { kind: "resolved", value: false };
    if (constraint.kind === "write-fit") {
      const source = place(constraint.source, bindings), destination = place(constraint.destination, bindings);
      if (source.kind !== "resolved") return source;
      if (destination.kind !== "resolved") return destination;
      return admits(source.value, destination.value, constraint.site);
    }
    if (constraint.kind === "operator") {
      const result = operation(constraint.operation);
      return result.kind !== "resolved" ? result : { kind: "resolved", value: true };
    }
    const receiver = place(constraint.receiver, bindings), key = place(constraint.index, bindings);
    if (receiver.kind !== "resolved") return receiver;
    if (key.kind !== "resolved") return key;
    const result = indexSource(semantic(), receiver.value, key.value);
    return result.kind !== "resolved" ? result : { kind: "resolved", value: true };
  }

  const revision = () => values.revision() + declarations.revision() + completions.revision() + applications.revision() + operations.revision() + destinations.revision();
  let previous = -1;
  while (previous !== revision()) {
    previous = revision();
    for (const node of context.values) value(node, []);
    for (const node of context.nodes) {
      if (ast.getSourceFile(node)?.IsDeclarationFile) continue;
      if (ast.is.IsClassDeclaration(node) || ast.is.IsInterfaceDeclaration(node) || ast.is.IsTypeAliasDeclaration(node) ||
        ast.is.IsVariableDeclaration(node) || ast.is.IsParameterDeclaration(node) || ast.is.IsPropertyDeclaration(node) ||
        source.navigation.callableRoles(node).signature) declared(node, []);
      if (ast.is.IsForOfStatement(node) || ast.is.IsForInStatement(node) || ast.is.IsSpreadElement(node)) protocols.iteration(node);
      if (source.protocolInput.generator(node).kind === "present") protocols.generator(node);
      if (ast.is.IsYieldExpression(node)) protocols.yield(node);
    }
    for (const signature of signatures) callableReturn(signature, []);
    graph.invalidate();
  }

  const issues = new Set([...collected.refusals, ...enums.refusals()]);
  function settle<Value>(node: Node, result: SourceProductionResult<Value>): SourceResult<Value> {
    if (result.kind === "pending") {
      const refusal = createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_SELF_REFERENCE", node);
      issues.add(refusal);
      return refusal;
    }
    if (result.kind === "refused") issues.add(result);
    return result;
  }
  const types = new Map<Node, SourceResult<SourceTypeEvidence>>();
  for (const node of context.values) {
    let produced = value(node, []);
    if (produced.kind === "resolved") {
      const domain = sourceEnumValueDomain(semantic(), produced.value);
      if (domain.kind !== "resolved") produced = domain;
      else if (domain.value.possible.length > 0) {
        const selected = destination(node, []);
        if (selected.kind !== "resolved") produced = selected;
        else if (selected.value.kind === "present") {
          const parent = ast.parent(node) ?? node;
          const admission = sourceEnumDestination(semantic(), produced.value, selected.value.value.applied, parent);
          if (admission.kind !== "resolved") produced = admission;
        }
      }
    }
    const result = settle(node, produced);
    types.set(node, result);
    values.seed(node, [], result);
  }
  const slotFacts = new Map<Node, SourceResult<SourceDeclaredSlot>>();
  for (const node of demandedDeclarations) slotFacts.set(node, settle(node, declared(node, [])));
  const destinationFacts = new Map<Node, SourceResult<SourcePresence<SourceUseDestination>>>();
  const contextualFacts = new Map<Node, SourceResult<SourcePresence<SourceTypeEvidence>>>();
  const operationFacts = new Map<Node, SourceResult<SourceOperation>>();
  const constructionFacts = new Map<Node, SourceResult<SourcePresence<SourceConstruction>>>();
  const applicationFacts = new Map<Node, SourceResult<SourceApplication>>();
  for (const node of context.values) {
    const selected = settle(node, destination(node, []));
    destinationFacts.set(node, selected);
    contextualFacts.set(node, selected.kind === "refused" ? selected : { kind: "resolved", value: selected.value.kind === "none" ? selected.value
      : { kind: "present", value: selected.value.value.applied } });
    if (ast.is.IsConditionalExpression(node) || ast.is.IsBinaryExpression(node) || ast.is.IsPrefixUnaryExpression(node) ||
      ast.is.IsPostfixUnaryExpression(node) || ast.is.IsAwaitExpression(node)) operationFacts.set(node, settle(node, operation(node)));
    if (ast.is.IsArrayLiteralExpression(node) || ast.is.IsObjectLiteralExpression(node)) {
      const result = settle(node, construction.produce(node));
      constructionFacts.set(node, result.kind === "refused" ? result : { kind: "resolved", value: { kind: "present", value: result.value.construction } });
    } else constructionFacts.set(node, none);
    if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) {
      const result = settle(node, applications.query(node, []));
      applicationFacts.set(node, result.kind === "refused" ? result : { kind: "resolved", value: result.value.application });
      if (result.kind === "resolved") result.value.diagnostics.forEach(identity => diagnostics.add(identity));
    }
  }
  const returnFacts = new Map<SourceSignatureIdentity, SourceResult<SourceTypeEvidence>>();
  for (const signature of signatures) returnFacts.set(signature, settle(signature.declaration ?? signature.owner, callableReturn(signature, [])));
  const published = createSourceSolvedFacts(builder, { originals: context.nodes, occurrences: context.values,
    types, slots: slotFacts, contextual: contextualFacts, destinations: destinationFacts, operations: operationFacts,
    constructions: constructionFacts, applications: applicationFacts, returns: returnFacts, refusals: [...issues] });
  const domains = createSourceLiteralDomainQueries({ ast, input, builder, value: node => value(node, []), syntaxValue: node => {
    const reference = source.navigation.sourceReferenceFor(node)?.declaration;
    if (reference !== undefined && ast.is.IsVariableDeclaration(reference) && ast.variableDeclarationKind(reference) === "const") {
      const initializer = Node_Initializer(ast, reference);
      if (initializer !== undefined) return value(initializer, []);
    }
    return context.reader.describeSyntax(node, []);
  } });
  return Object.freeze({ ...published, ...domains, enums: enums.facts, protocols: protocols.facts,
    dischargedDiagnostics: Object.freeze([...diagnostics]) });
}
