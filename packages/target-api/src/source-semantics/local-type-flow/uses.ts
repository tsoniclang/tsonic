import { pointerOperationFactKey, type AstReader, type Node } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer } from "../../source-model/ast.js";
import { isSourceCallableBodyBoundary } from "../../source-model/callable-boundaries.js";
import type { SourceHostArgumentBinding, SourceHostCall, SourceHostComponent, SourceHostQueries } from "../../host-input/queries.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import { sourceTypeFlowLinkAdjacency, sourceTypeFlowReachableVariables } from "./links.js";
import { sourceTypeFlowConstructionSlot } from "./construction-slots.js";
import { sourceTypeDescriptorIsTop, sourceTypeDescriptorStructure, sourceTypeDescriptorsEqual } from "./terms.js";
import { sourceTypeFlowAssignmentPattern } from "./value-syntax.js";
import { sourceTypeFlowAuthoredAwaitedArgument } from "./awaited.js";
import { sourceTypeFlowAssignmentTokens, sourceTypeFlowShiftTokens } from "./operators.js";
import { createSourceTypeFlowDeclaredSlotReader } from "./declared-slots.js";
import type {
  SourceTypeDescriptor, SourceTypeFlowAnalysisContext, SourceTypeFlowAssociation,
  SourceTypeFlowArgumentPlace, SourceTypeFlowGraph, SourceTypeFlowNode, SourceTypeFlowRefusalCode, SourceTypeFlowUse, SourceTypeFlowVariable,
} from "./types.js";


export function sourceTypeFlowIsBroadSlot(type: SourceTypeDescriptor): boolean {
  return sourceTypeFlowBroadSlotKind(type) !== undefined;
}

/**
 * Whether a descriptor constrains its values (R4: the one classifier). "top": any or unknown (no value is excluded);
 * "type-parameter": a type parameter reference (its values are fixed only per instantiation); "closed": everything
 * else, including unions and options, whose arms are classified one by one. Each site asks its own question through
 * this classifier: a test on an arm is undecided when the arm is not "closed"; a value with a "top" arm may be absent.
 */
export function sourceTypeDescriptorOpenness(ast: Pick<AstReader, "is">, type: SourceTypeDescriptor):
  "top" | "type-parameter" | "closed" {
  const structure = sourceTypeDescriptorStructure(type);
  if (sourceTypeDescriptorIsTop(type)) return "top";
  return structure.kind === "declared" && ast.is.IsTypeParameterDeclaration(structure.declaration) ? "type-parameter" : "closed";
}

export function sourceTypeFlowBroadSlotKind(type: SourceTypeDescriptor): "unknown" | "any" | "object" | "void" | undefined {
  const broad = (type: SourceTypeDescriptor, absorbing: boolean): "unknown" | "any" | "object" | "void" | undefined => {
    const selected = sourceTypeDescriptorStructure(type);
    if (selected.kind === "optional") return broad(selected.value, absorbing);
    if (selected.kind === "union") {
      const members = selected.types.map(member => broad(member, true));
      return members.includes("any") ? "any" : members.includes("unknown") ? "unknown" : undefined;
    }
    return selected.kind === "intrinsic" && (selected.intrinsic === "unknown" || selected.intrinsic === "any" ||
      !absorbing && (selected.intrinsic === "object" || selected.intrinsic === "void")) ? selected.intrinsic : undefined;
  };
  return broad(type, false);
}

export function collectSourceTypeFlowUses(
  context: SourceTypeFlowAnalysisContext,
  graph: SourceTypeFlowGraph,
): readonly SourceTypeFlowUse[] {
  const { ast } = context.source;
  const declaredSlots = createSourceTypeFlowDeclaredSlotReader(context);
  const nodes = new Map<Node, SourceTypeFlowNode>();
  for (const node of graph.nodes) {
    if (node.kind !== "binder" && node.publish) {
      if (nodes.has(node.node)) throw new Error("Local type uses require one published variable for each exact occurrence.");
      nodes.set(node.node, node);
    }
  }
  const calls = new Map(graph.calls.map(call => [call.node, call]));
  const derivedValues = new Set(graph.derived.map(derived => derived.node));
  function isDerivedValue(node: Node): boolean {
    let value = node;
    while (ast.is.IsParenthesizedExpression(value) || ast.is.IsNonNullExpression(value)) {
      const operand = Node_Expression(ast, value);
      if (operand === undefined) return false;
      value = operand;
    }
    return derivedValues.has(value);
  }
  const aliasLinks = sourceTypeFlowLinkAdjacency(graph.links);
  const homomorphicResults = new Map<SourceTypeFlowVariable, SourceTypeFlowVariable>();
  for (const call of graph.calls) {
    const term = nodes.get(call.node)?.term;
    if (call.result === undefined || term?.kind !== "declared" || term.source === undefined) continue;
    const queries = context.input.at(call.node);
    const declaration = queries.typeDeclaration(term.source.selectedType, term.source.authoredTypeNode);
    if (declaration !== term.declaration) continue;
    const input = queries.homomorphicInput(term.source.selectedType, term.source.authoredTypeNode);
    const parameter = input === undefined ? undefined : queries.typeDeclaration(input);
    const binder = [...call.receiver, ...call.method].find(binder => binder.declaration === parameter);
    if (binder === undefined) continue;
    const children = term.typeArguments.filter(argument => sourceTypeFlowReachableVariables([argument], aliasLinks).has(binder.variable));
    if (children.length === 1) homomorphicResults.set(call.result, binder.variable);
  }
  const familyLinks = new Map(aliasLinks);
  for (const [result, input] of homomorphicResults) familyLinks.set(input, [...familyLinks.get(input) ?? [], result]);
  const constructionAliases = sourceTypeFlowReachableVariables(graph.nodes.filter(record =>
    record.term?.kind === "fixed" && aliasLinks.has(record.variable) &&
    (ast.is.IsArrayLiteralExpression(record.node) || ast.is.IsObjectLiteralExpression(record.node))).map(record => record.variable), aliasLinks);
  const constructionRecords = graph.nodes.filter(record => record.publish &&
    (ast.is.IsArrayLiteralExpression(record.node) || ast.is.IsObjectLiteralExpression(record.node)) &&
    !sourceTypeFlowAssignmentPattern(ast, record.node));
  const constructionFamilies = new Map<SourceTypeFlowNode["variable"], readonly SourceTypeFlowNode[]>();
  for (const construction of constructionRecords) {
    if (constructionFamilies.has(construction.variable)) continue;
    const reached = sourceTypeFlowReachableVariables([construction.variable], familyLinks);
    const family = Object.freeze(constructionRecords.filter(record => reached.has(record.variable)));
    for (const variable of reached) constructionFamilies.set(variable, family);
  }
  // Retained argument places are validated before any occurrence is classified (C28).
  for (const call of graph.calls) for (const place of call.argumentPlaces) {
    if (callAssociation(context, place.value.node, call.source, place.binding).parameter !== place.parameter) {
      throw new Error("Local type uses require the same retained argument-place parameter.");
    }
  }
  // A value's own declared slot (C30) fills its group exactly as an authored component would, except that broad slots
  // (unknown, any, object, void) never fill, as in requiredUse.
  function declaredSlotFill(record: SourceTypeFlowNode, site: Node, association: SourceTypeFlowAssociation): SourceTypeFlowUse | undefined {
    const slot = declaredSlots.get(record.node);
    if (slot?.authority !== "declared" || slot.type === undefined || slot.refusal !== undefined) return undefined;
    if (sourceTypeFlowIsBroadSlot(slot.type)) return undefined;
    const retained = slot.component === undefined ? association : Object.freeze({ ...association, component: slot.component });
    const selected = constructionFamilySlot(context, record, constructionFamilies.get(record.variable) ?? [], slot.type);
    if (selected.kind === "refused") return Object.freeze({ kind: "refused", site: selected.site,
      variable: record.variable, association: retained, refusal: selected });
    // The one view rule applies to declared slots too (K-2449): a read-only parameter checks an aliased group and never
    // fills its width; only a construction placed directly in that parameter takes the declared slot.
    const direct = constructionFamilies.get(record.variable)?.some(construction => construction.node === record.node) ?? false;
    if (readOnlyParameterView(selected.type, retained, direct)) {
      return Object.freeze({ kind: "check", site, variable: record.variable, check: "read-only", type: selected.type,
        required: association.component?.declaration ?? association.component?.authoredTypeNode ?? site, association: retained });
    }
    return Object.freeze({ kind: "fill", site, variable: record.variable, type: selected.type, authority: "declared", association: retained });
  }
  const uses: SourceTypeFlowUse[] = [];
  for (const record of nodes.values()) {
    if (!graph.roots.includes(record.root) || !withinInferenceRoot(ast, record.node, record.root)) {
      throw new Error("Local type uses require an occurrence in its original inference root.");
    }
    if (ast.is.IsArrowFunction(record.node) ||
      ast.is.IsFunctionExpression(record.node) || ast.is.IsVariableDeclaration(record.node) ||
      ast.is.IsParameterDeclaration(record.node)) continue;
    uses.push(...classify(record).filter(use => use.kind !== "fill" || !isDerivedValue(record.node)));
  }
  for (const call of graph.calls) {
    assertRetainedCall(context, call.node, call.source);
    const receiver = call.source.sourceReceiver;
    const receiverNode = receiver === undefined ? undefined : nodes.get(receiver.expression);
    if (receiverNode === undefined) continue;
    const receiverBinders = new Map(call.receiver.map(binder => [binder.declaration, binder]));
    if (call.method.some(binder => receiverBinders.has(binder.declaration))) {
      throw new Error("Local type uses require distinct receiver and method binder owners.");
    }
    const bindings = new Map<SourceHostArgumentBinding, SourceTypeFlowArgumentPlace[]>();
    for (const place of call.argumentPlaces) {
      const association = callAssociation(context, place.value.node, call.source, place.binding);
      if (association.parameter !== place.parameter) {
        throw new Error("Local type uses require the same retained argument-place parameter.");
      }
      let places = bindings.get(place.binding);
      if (places === undefined) bindings.set(place.binding, places = []);
      places.push(place);
    }
    for (const places of bindings.values()) {
      if (!places.every(place => receiverBinders.has(place.binder))) continue;
      for (const place of places) {
        uses.push(Object.freeze({ kind: "write", site: call.node, variable: receiverBinders.get(place.binder)!.variable,
          value: place.value.node, valueVariable: place.value,
          required: place.parameter.parameterDeclaration ?? place.parameter.authoredTypeNode ?? call.node,
          association: callAssociation(context, place.value.node, call.source, place.binding) }));
      }
    }
  }
  const declarations = new Set<Node>();
  for (const record of nodes.values()) {
    const declaration = record.declaration;
    if (declaration === undefined || declarations.has(declaration) || record.kind === "fixed") continue;
    declarations.add(declaration);
    const allReferences = context.source.navigation.declarationUses(declaration);
    const references = allReferences.filter(reference => withinInferenceRoot(ast, reference.reference, record.root));
    if (references.length > 1024) {
      uses.push(refusal(record, references[1024]!.reference, "TSONIC_LOCAL_TYPE_LIMIT"));
      continue;
    }
    for (const reference of references) {
      if (reference.kind !== "type-only" || !withinInferenceRoot(ast, reference.reference, record.root)) continue;
      const parent = ast.parent(reference.reference);
      if (parent !== undefined && ast.is.IsTypeQueryNode(parent)) {
        uses.push(refusal(record, parent, "TSONIC_LOCAL_TYPE_UNSUPPORTED"));
      }
    }
    for (const reference of allReferences) {
      if (!reference.captured || withinInferenceRoot(ast, reference.reference, record.root)) continue;
      let stored = false;
      let discarded = false;
      for (let owner = ast.parent(reference.reference); owner !== undefined; owner = ast.parent(owner)) {
        if (owner === record.root) break;
        if (ast.is.IsArrowFunction(owner) || ast.is.IsFunctionExpression(owner)) {
          stored = context.source.navigation.expressionResultDisposition(owner).kind !== "discarded";
          discarded = !stored;
          break;
        }
      }
      if (discarded) continue;
      if (stored) {
        uses.push(refusal(record, reference.reference, "TSONIC_LOCAL_TYPE_SELF_REFERENCE"));
        continue;
      }
      const captured = { ...record, node: reference.reference };
      for (const use of classify(captured, true)) {
        uses.push(use.kind === "none" || use.kind === "write" ? use
          : refusal(record, use.association?.call?.call ?? use.site, "TSONIC_LOCAL_TYPE_SELF_REFERENCE", use.association));
      }
    }
  }
  uses.sort((left, right) => {
    const leftOrder = context.order(left.site), rightOrder = context.order(right.site);
    return leftOrder.start - rightOrder.start || leftOrder.preorder - rightOrder.preorder;
  });
  return Object.freeze(uses);

  function required(record: SourceTypeFlowNode, site: Node, component: SourceHostComponent | undefined,
    check = false, retained?: SourceTypeFlowAssociation, projected?: SourceTypeDescriptor): SourceTypeFlowUse {
    const input = homomorphicResults.get(record.variable);
    const use = requiredUse(context, record, site, component, check, retained, constructionFamilies.get(record.variable) ?? [], projected, input);
    return use.kind === "fill" && use.type.kind === "intrinsic" && use.type.intrinsic === "object" && input !== undefined
      ? Object.freeze({ ...use, variable: input }) : use;
  }

  function classify(record: SourceTypeFlowNode, captured = false): readonly SourceTypeFlowUse[] {
    let value = record.node;
    let parent = ast.parent(value);
    while (parent !== undefined && transparentOperand(ast, parent, value)) {
      if (!captured && nodes.has(parent)) return [];
      value = parent;
      parent = ast.parent(value);
    }
    if (parent === undefined) return [];
    const fixed = record.kind === "fixed" || record.term?.kind === "fixed";
    const operator = ast.operatorKindName(parent) ?? "";
    if (!captured && fixed && !constructionAliases.has(record.variable)) {
      const assignment = ast.is.IsBinaryExpression(parent) && ast.as.AsBinaryExpression(parent)?.Left === value &&
        sourceTypeFlowAssignmentTokens.has(operator);
      const update = (ast.is.IsPrefixUnaryExpression(parent) || ast.is.IsPostfixUnaryExpression(parent)) &&
        (operator === "KindPlusPlusToken" || operator === "KindMinusMinusToken");
      if (!assignment && !update) return [];
    }
    if ((ast.is.IsAsExpression(parent) || ast.is.IsTypeAssertion(parent) || ast.is.IsSatisfiesExpression(parent)) &&
      Node_Expression(ast, parent) === value && !ast.isConstAssertion(parent)) {
      const queries = context.input.at(record.node);
      return [required(record, parent, authoredComponent(context, parent, queries), ast.is.IsSatisfiesExpression(parent))];
    }
    if ((ast.is.IsVariableDeclaration(parent) || ast.is.IsPropertyDeclaration(parent) || ast.is.IsParameterDeclaration(parent)) &&
      Node_Initializer(ast, parent) === value) {
      if (ast.typeNode(parent) === undefined) return captured
        ? [refusal(record, parent, "TSONIC_LOCAL_TYPE_SELF_REFERENCE")] : [];
      const queries = context.input.at(record.node);
      return [required(record, parent, authoredComponent(context, parent, queries))];
    }
    if (ast.is.IsReturnStatement(parent) || ast.is.IsArrowFunction(parent) && ast.body(parent) === value) {
      const owner = ast.is.IsArrowFunction(parent) ? parent : containingCallable(ast, parent);
      if (owner !== undefined && ast.typeNode(owner) === undefined && !captured) {
        // C30: a callable without a return annotation whose contextual signature has an authored result (a typed
        // callback variable or parameter) makes its returned value a declared slot of that result.
        const fill = declaredSlotFill(record, parent, sourceAssociation(context, record.node));
        if (fill !== undefined) return [fill];
      }
      if (owner === undefined || ast.typeNode(owner) === undefined) return captured
        ? [refusal(record, parent, "TSONIC_LOCAL_TYPE_SELF_REFERENCE")] : [];
      const queries = context.input.at(record.node);
      let component = authoredComponent(context, owner, queries);
      if (component !== undefined && ast.hasModifierKind(owner, "async")) {
        component = awaitedReturnComponent(context, component, queries);
      }
      return [required(record, parent, component)];
    }
    if (ast.is.IsBinaryExpression(parent)) {
      const binary = ast.as.AsBinaryExpression(parent);
      if (sourceTypeFlowAssignmentTokens.has(operator) && binary?.Left !== undefined && binary.Right !== undefined) {
        if (binary.Left === value) {
          if (sourceTypeFlowShiftTokens.has(operator) || fixed && operator !== "KindEqualsToken") return [write(record, parent, parent, value)];
          if (!captured && operator !== "KindEqualsToken" && ast.is.IsIdentifier(value)) {
            const component = declaredValueComponent(context, binary.Right);
            if (component !== undefined) return [required(record, parent, component)];
          }
          return [write(record, parent, binary.Right, value)];
        }
        if (operator === "KindEqualsToken" && binary.Right === value) {
          const destination = nodes.get(binary.Left);
          if (destination !== undefined && destination.kind !== "fixed") return [];
          const component = declaredStorageComponent(context, binary.Left);
          return component === undefined ? [] : [required(record, parent, component)];
        }
        return [];
      }
      return [];
    }
    if ((ast.is.IsPrefixUnaryExpression(parent) || ast.is.IsPostfixUnaryExpression(parent)) &&
      (ast.operatorKindName(parent) === "KindPlusPlusToken" || ast.operatorKindName(parent) === "KindMinusMinusToken")) {
      return [write(record, parent, parent, value)];
    }
    if (ast.is.IsDeleteExpression(parent)) return [refusal(record, parent, "TSONIC_LOCAL_TYPE_UNSUPPORTED")];
    if (ast.is.IsYieldExpression(parent) && ast.as.AsYieldExpression(parent)?.AsteriskToken !== undefined) {
      return [refusal(record, parent, "TSONIC_LOCAL_TYPE_UNSUPPORTED")];
    }
    if (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) return callUses(record, value, parent);
    if (ast.is.IsSpreadElement(parent)) {
      const owner = ast.parent(parent);
      if (owner !== undefined && (ast.is.IsCallExpression(owner) || ast.is.IsNewExpression(owner))) return callUses(record, parent, owner);
    }
    return [];
  }

  function callUses(record: SourceTypeFlowNode, argument: Node, node: Node): readonly SourceTypeFlowUse[] {
    const retained = calls.get(node);
    const call = retained?.source ?? context.input.at(node).call(node);
    if (call === undefined) return [refusal(record, node, "TSONIC_LOCAL_TYPE_UNSUPPORTED")];
    assertRetainedCall(context, node, call);
    const pointer = context.source.sourceFacts.getFact(node, pointerOperationFactKey);
    if (pointer?.operation === "address-of" && pointer.storageExpression === argument) {
      return [refusal(record, node, "TSONIC_LOCAL_TYPE_ADDRESS")];
    }
    const index = call.sourceArguments.findIndex(value => value.expression === argument);
    if (index < 0 || call.sourceSelectedSignatureKind !== "resolved") return [];
    const bindings = call.sourceArgumentBindings.filter(binding => binding.sourceArgumentIndex === index);
    if (bindings.length === 0) return [refusal(record, node, "TSONIC_LOCAL_TYPE_GENERIC")];
    return bindings.map(binding => {
      const association = callAssociation(context, record.node, call, binding);
      const component = association.component!;
      if (retained?.argumentPlaces.some(place => place.binding === binding)) {
        const binders = new Set(retained.argumentPlaces.filter(place => place.binding === binding).map(place => place.binder));
        return (declaredSlots.authoredBinding(node, binders) ? declaredSlotFill(record, node, association) : undefined) ??
          Object.freeze({ kind: "none", site: node, variable: record.variable, association });
      }
      if (component.authoredTypeNode !== undefined && containsTypeVariables(context, component.authoredTypeNode)) {
        return declaredSlotFill(record, argument, association) ?? refusal(record, argument, "TSONIC_LOCAL_TYPE_GENERIC", association);
      }
      if (ambiguousNumericOverload(context, call, binding)) return refusal(record, argument, "TSONIC_LOCAL_TYPE_UNSUPPORTED", association);
      const projected = binding.sourceParameterForm === "rest-element" ? declaredSlots.get(record.node) : undefined;
      if (binding.sourceParameterForm === "rest-element" &&
        (projected?.authority !== "declared" || projected.refusal !== undefined || projected.type === undefined)) {
        return refusal(record, argument, "TSONIC_LOCAL_TYPE_UNSUPPORTED", association);
      }
      return required(record, argument, component, false, association,
        projected?.authority === "declared" && projected.refusal === undefined ? projected.type : undefined);
    });
  }
}

function refusal(record: SourceTypeFlowNode, site: Node, code: SourceTypeFlowRefusalCode,
  association?: SourceTypeFlowAssociation): SourceTypeFlowUse {
  return Object.freeze({ kind: "refused", site, variable: record.variable,
    ...(association === undefined ? {} : { association }), refusal: createSourceTypeFlowRefusal(code, site, record.declaration) });
}

function write(record: SourceTypeFlowNode, site: Node, value: Node, required: Node): SourceTypeFlowUse {
  return Object.freeze({ kind: "write", site, variable: record.variable, value, required, association: record.association });
}

function constructionFamilySlot(context: SourceTypeFlowAnalysisContext, record: SourceTypeFlowNode,
  constructions: readonly SourceTypeFlowNode[], type: SourceTypeDescriptor):
  { readonly kind: "resolved"; readonly type: SourceTypeDescriptor } | import("./types.js").SourceTypeFlowRefusal {
  let chosen: SourceTypeDescriptor | undefined;
  for (const construction of constructions) {
    const selected = construction.declaredSlotRefusal === undefined
      ? sourceTypeFlowConstructionSlot(context.source.ast, construction.node, type, "declared")
      : { refusal: construction.declaredSlotRefusal };
    if (selected.refusal !== undefined) return selected.refusal;
    const candidate = "type" in selected ? selected.type : undefined;
    if (candidate === undefined) throw new Error("A selected construction slot requires its descriptor.");
    if (chosen !== undefined && !sourceTypeDescriptorsEqual(chosen, candidate)) {
      return createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_CONFLICT", construction.node, record.declaration);
    }
    chosen = candidate;
  }
  return { kind: "resolved", type: chosen ?? type };
}

function requiredUse(
  context: SourceTypeFlowAnalysisContext,
  record: SourceTypeFlowNode,
  site: Node,
  component: SourceHostComponent | undefined,
  check = false,
  retained?: SourceTypeFlowAssociation,
  constructions: readonly SourceTypeFlowNode[] = [],
  projected?: SourceTypeDescriptor,
  homomorphicInput?: SourceTypeFlowVariable,
): SourceTypeFlowUse {
  if (component === undefined) return refusal(record, site, "TSONIC_LOCAL_TYPE_UNSUPPORTED", retained);
  const queries = context.input.at(record.node);
  const association = retained ?? sourceAssociation(context, record.node, component);
  const none = (): SourceTypeFlowUse => Object.freeze({ kind: "none", site, variable: record.variable, association });
  // A declared `object` slot fills only a generic call's result binder (B2: the instantiation becomes concrete). It never
  // fills an ordinary value group: a literal stored there keeps its own construction (C-2246), and an unannotated empty
  // literal keeps its own refusal (28j').
  if (component.authoredTypeNode !== undefined && containsTypeVariables(context, component.authoredTypeNode)) return none();
  const rawUnion = constructions.length === 0 && queries.isUnion(component.selectedType) && !queries.isBooleanLike(component.selectedType);
  let type = projected ?? context.describe(record.node, component);
  if (type === undefined) return refusal(record, site, rawUnion ? "TSONIC_LOCAL_TYPE_UNION" : "TSONIC_LOCAL_TYPE_UNSUPPORTED", association);
  const structure = sourceTypeDescriptorStructure(type);
  if (sourceTypeFlowBroadSlotKind(type) === "object" && homomorphicInput === undefined &&
    !constructions.some(construction => construction.node === record.node)) {
    const ast = context.source.ast;
    if (!(ast.is.IsCallExpression(record.node) || ast.is.IsNewExpression(record.node)) ||
      record.term?.kind !== "shape" && record.term?.kind !== "array" && record.term?.kind !== "tuple") return none();
    return Object.freeze({ kind: "fill", site, variable: record.variable, type, association });
  }
  if (sourceTypeFlowIsBroadSlot(type) && !(structure.kind === "intrinsic" && structure.intrinsic === "object" &&
    homomorphicInput !== undefined)) return none();
  if (rawUnion) return refusal(record, site, "TSONIC_LOCAL_TYPE_UNION", association);
  if (constructions.length > 0) {
    const selected = constructionFamilySlot(context, record, constructions, type);
    if (selected.kind === "refused") return Object.freeze({ kind: "refused", site: selected.site,
      variable: record.variable, association, refusal: selected });
    type = selected.type;
  } else if (type.kind === "optional") return refusal(record, site, "TSONIC_LOCAL_TYPE_UNION", association);
  const readOnly = readOnlyDescriptor(type);
  const assertion = context.source.ast.is.IsAsExpression(site) || context.source.ast.is.IsTypeAssertion(site);
  const direct = constructions.some(construction => construction.node === record.node);
  if (check || readOnlyParameterView(type, association, direct) || assertion &&
    type.kind === "declared" && context.source.ast.is.IsInterfaceDeclaration(type.declaration)) {
    return Object.freeze({ kind: "check", site, variable: record.variable, check: readOnly ? "read-only" : "interface",
      type, required: component.declaration ?? component.authoredTypeNode ?? site, association });
  }
  return Object.freeze({ kind: "fill", site, variable: record.variable, type, association });
}

function withinInferenceRoot(ast: AstReader, node: Node, root: Node): boolean {
  for (let current: Node | undefined = node; current !== undefined; current = ast.parent(current)) {
    if (current === root) return true;
    if (!isSourceCallableBodyBoundary(ast, current)) continue;
    if (!ast.is.IsArrowFunction(current) && !ast.is.IsFunctionExpression(current)) return false;
    let expression = current;
    let parent = ast.parent(expression);
    while (parent !== undefined && (ast.is.IsParenthesizedExpression(parent) ||
      ast.is.IsAsExpression(parent) || ast.is.IsSatisfiesExpression(parent))) {
      if (Node_Expression(ast, parent) !== expression) return false;
      expression = parent;
      parent = ast.parent(expression);
    }
    if (parent === undefined || !(ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) ||
      !ast.arguments(parent).includes(expression)) return false;
  }
  return false;
}

function transparentOperand(ast: AstReader, parent: Node, value: Node): boolean {
  if (ast.is.IsParenthesizedExpression(parent) || ast.is.IsNonNullExpression(parent) || ast.is.IsAwaitExpression(parent)) {
    return Node_Expression(ast, parent) === value;
  }
  if (ast.is.IsConditionalExpression(parent)) {
    const conditional = ast.as.AsConditionalExpression(parent);
    return conditional?.WhenTrue === value || conditional?.WhenFalse === value;
  }
  return false;
}

function declaredStorageComponent(context: SourceTypeFlowAnalysisContext, expression: Node): SourceHostComponent | undefined {
  const { ast } = context.source;
  if (ast.is.IsPropertyAccessExpression(expression)) {
    const queries = context.input.at(expression);
    const access = queries.propertyAccess(expression);
    const declaration = access?.selectedWriteDeclaration ?? access?.selectedDeclaration;
    if (declaration !== undefined && ast.is.IsSetAccessorDeclaration(declaration)) {
      const parameter = ast.parameters(declaration);
      return parameter.length === 1 && parameter[0] !== undefined ? authoredComponent(context, parameter[0], queries) : undefined;
    }
    if (declaration !== undefined) return authoredComponent(context, declaration, queries);
  }
  return declaredValueComponent(context, expression);
}

// The returned value of an annotated async callable fills the authored payload argument of its return annotation
// (awaited.ts, the one awaited owner; declaration input only, R3).
function awaitedReturnComponent(context: SourceTypeFlowAnalysisContext,
  component: SourceHostComponent, queries: SourceHostQueries): SourceHostComponent | undefined {
  const { ast, navigation } = context.source;
  const root = component.authoredTypeNode;
  const argument = root === undefined ? undefined : sourceTypeFlowAuthoredAwaitedArgument(ast, navigation, root);
  const selectedType = argument === undefined ? undefined : queries.authoredType(argument);
  return argument === undefined || selectedType === undefined ? undefined
    : Object.freeze({ ...component, selectedType, authoredTypeNode: argument });
}

function sourceAssociation(
  context: SourceTypeFlowAnalysisContext,
  occurrence: Node,
  component?: SourceHostComponent,
): SourceTypeFlowAssociation {
  const sourceFile = context.source.ast.getSourceFile(occurrence);
  if (sourceFile === undefined || !context.input.includes(occurrence)) {
    throw new Error("Local type uses require their exact checked source-file owner.");
  }
  return Object.freeze({ occurrence, sourceFile, ...(component === undefined ? {} : { component }) });
}

// The authored annotation of a declaration as a component: declaration input only (R3). A use whose annotation names
// a type variable fills nothing (requiredUse), so no instantiated checker read, write or result type is needed here.
function authoredComponent(
  context: SourceTypeFlowAnalysisContext,
  declaration: Node,
  queries: SourceHostQueries,
): SourceHostComponent | undefined {
  const authoredTypeNode = context.source.ast.typeNode(declaration);
  if (authoredTypeNode === undefined) return undefined;
  const selected = queries.authoredType(authoredTypeNode);
  return selected === undefined ? undefined : Object.freeze({ selectedType: selected, declaration, authoredTypeNode });
}

function containsTypeVariables(context: SourceTypeFlowAnalysisContext, typeNode: Node): boolean {
  const { ast, navigation } = context.source;
  const pending = [typeNode];
  while (pending.length !== 0) {
    const node = pending.pop()!;
    if (ast.is.IsTypeReferenceNode(node)) {
      const declaration = navigation.sourceReferenceFor(ast.as.AsTypeReferenceNode(node)?.TypeName)?.declaration;
      if (declaration !== undefined && ast.is.IsTypeParameterDeclaration(declaration)) return true;
    }
    ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  return false;
}

function assertRetainedCall(context: SourceTypeFlowAnalysisContext, node: Node, call: SourceHostCall): void {
  const { ast } = context.source;
  if (call.call !== node || call.sourceCallee.expression !== Node_Expression(ast, node)) {
    throw new Error("Local type uses require the exact retained selected call.");
  }
  if (context.input.at(node).call(node) !== call) {
    throw new Error("Local type uses require the exact retained call argument and selected parameter association.");
  }
  const arguments_ = ast.arguments(node);
  if (call.sourceArguments.length !== arguments_.length) throw new Error("Local type uses require the exact retained call argument vector.");
  for (let index = 0; index < arguments_.length; index += 1) {
    if (call.sourceArguments[index]?.expression !== arguments_[index] || arguments_[index] === undefined) {
      throw new Error("Local type uses require the exact retained call argument vector.");
    }
  }
}

function declaredValueComponent(
  context: SourceTypeFlowAnalysisContext,
  expression: Node,
): SourceHostComponent | undefined {
  const { ast, navigation } = context.source;
  const queries = context.input.at(expression);
  let node = expression;
  while (ast.is.IsParenthesizedExpression(node) || ast.is.IsNonNullExpression(node)) {
    const inner = Node_Expression(ast, node);
    if (inner === undefined) return undefined;
    node = inner;
  }
  let declaration: Node | undefined;
  if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) {
    const call = queries.call(node);
    if (call?.sourceSelectedSignatureKind !== "resolved") return undefined;
    declaration = queries.callSignature(call);
  } else if (ast.is.IsPropertyAccessExpression(node)) {
    const access = queries.propertyAccess(node);
    declaration = access?.selectedReadDeclaration ?? access?.selectedDeclaration;
  } else if (ast.is.IsElementAccessExpression(node)) {
    const access = queries.elementAccess(node);
    declaration = access?.selectedDeclaration;
  } else if (ast.is.IsIdentifier(node)) {
    declaration = navigation.sourceReferenceFor(node)?.declaration;
  }
  if (declaration === undefined || !(ast.is.IsParameterDeclaration(declaration) ||
    ast.is.IsVariableDeclaration(declaration) || ast.is.IsPropertyDeclaration(declaration) ||
    ast.is.IsPropertySignatureDeclaration(declaration) || ast.is.IsGetAccessorDeclaration(declaration) ||
    isSourceCallableBodyBoundary(ast, declaration) || ast.is.IsMethodSignatureDeclaration(declaration) ||
    ast.is.IsCallSignatureDeclaration(declaration) || ast.is.IsConstructSignatureDeclaration(declaration))) return undefined;
  const component = authoredComponent(context, declaration, queries);
  return component?.authoredTypeNode !== undefined && !containsTypeVariables(context, component.authoredTypeNode)
    ? component : undefined;
}

function callAssociation(
  context: SourceTypeFlowAnalysisContext,
  occurrence: Node,
  call: SourceHostCall,
  binding: SourceHostArgumentBinding,
): SourceTypeFlowAssociation {
  const { ast } = context.source;
  const parameter = call.sourceSelectedSignatureParameters[binding.sourceParameterIndex];
  const argument = call.sourceArguments[binding.sourceArgumentIndex];
  if (!call.sourceArgumentBindings.includes(binding) || parameter === undefined || argument === undefined ||
    parameter.parameterIndex !== binding.sourceParameterIndex ||
    ast.arguments(call.call)[binding.sourceArgumentIndex] !== argument.expression) {
    throw new Error("Local type uses require the exact retained call argument and selected parameter association.");
  }
  const component = Object.freeze({ selectedType: binding.selectedParameterType,
    ...(parameter.parameterDeclaration === undefined ? {} : { declaration: parameter.parameterDeclaration }),
    ...(parameter.authoredTypeNode === undefined ? {} : { authoredTypeNode: parameter.authoredTypeNode }),
    contextualCall: call });
  return Object.freeze({ ...sourceAssociation(context, occurrence, component), call, binding, parameter });
}

function numericWidths(type: SourceTypeDescriptor, path = ""): ReadonlyMap<string, string> {
  const widths = new Map<string, string>();
  const visit = (value: SourceTypeDescriptor, key: string): void => {
    if (value.kind === "primitive" && value.primitive !== "bool" && value.primitive !== "char") widths.set(key, value.primitive);
    else if (value.kind === "array") visit(value.element, `${key}[]`);
    else if (value.kind === "tuple") value.elements.forEach((element, index) => visit(element.type, `${key}[${index}]`));
    else if (value.kind === "shape") for (const member of value.members) visit(member.type, `${key}.${member.name}`);
    else if (value.kind === "declared") value.typeArguments.forEach((argument, index) => visit(argument, `${key}<${index}>`));
    else if (value.kind === "optional") visit(value.value, `${key}?`);
  };
  visit(type, path);
  return widths;
}

function ambiguousNumericOverload(
  context: SourceTypeFlowAnalysisContext,
  call: SourceHostCall,
  binding: SourceHostArgumentBinding,
): boolean {
  const { ast } = context.source;
  const queries = context.input.at(call.call);
  const signatures = queries.signatures(call.sourceCallee.type, ast.is.IsNewExpression(call.call) ? "construct" : "call");
  if (signatures.length < 2) return false;
  const seen = new Map<string, string>();
  for (const signature of signatures) {
    const parameter = signature.parameters[binding.sourceParameterIndex];
    if (parameter === undefined) continue;
    const component: SourceHostComponent = Object.freeze({ selectedType: parameter.type,
      ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration,
        ...(ast.typeNode(parameter.declaration) === undefined ? {} : { authoredTypeNode: ast.typeNode(parameter.declaration) }) }) });
    const type = context.describe(call.sourceArguments[binding.sourceArgumentIndex]!.expression, component);
    if (type === undefined) continue;
    for (const [path, width] of numericWidths(type)) {
      const prior = seen.get(path);
      if (prior !== undefined && prior !== width) return true;
      seen.set(path, width);
    }
  }
  return false;
}

function containingCallable(ast: AstReader, node: Node): Node | undefined {
  for (let current = ast.parent(node); current !== undefined; current = ast.parent(current)) {
    if (isSourceCallableBodyBoundary(ast, current)) return current;
  }
  return undefined;
}

// A read-only array or tuple, read through declared aliases (C-2263 keeps alias identity; the view is in its definition).
function readOnlyDescriptor(type: SourceTypeDescriptor): boolean {
  const structure = sourceTypeDescriptorStructure(type);
  return structure.kind === "array" && structure.readonly || structure.kind === "tuple" && structure.readonly;
}

// The one view rule (K-2449): a read-only parameter is a view of an existing group. It checks the group and never fills
// its width. Only a construction placed directly in that parameter takes the declared slot (C30 selection).
function readOnlyParameterView(type: SourceTypeDescriptor, association: SourceTypeFlowAssociation, direct: boolean): boolean {
  return !direct && association.parameter !== undefined && readOnlyDescriptor(type);
}
