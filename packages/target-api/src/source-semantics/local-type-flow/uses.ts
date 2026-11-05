import { pointerOperationFactKey, type AstReader, type Node, type Type } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer } from "../../source-navigation/ast.js";
import { isSourceCallableBodyBoundary } from "../../source-navigation/callable-boundaries.js";
import type { ResolvedSourceCallInfo } from "../call-result-selection.js";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "../types.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import type {
  SourceTypeDescriptor, SourceTypeFlowAnalysisContext, SourceTypeFlowAssociation,
  SourceTypeFlowArgumentPlace, SourceTypeFlowGraph, SourceTypeFlowNode, SourceTypeFlowRefusalCode, SourceTypeFlowUse,
} from "./types.js";

const assignments = new Set([
  "KindEqualsToken", "KindPlusEqualsToken", "KindMinusEqualsToken",
  "KindAsteriskEqualsToken", "KindAsteriskAsteriskEqualsToken", "KindSlashEqualsToken",
  "KindPercentEqualsToken", "KindLessThanLessThanEqualsToken",
  "KindGreaterThanGreaterThanEqualsToken", "KindGreaterThanGreaterThanGreaterThanEqualsToken",
  "KindAmpersandEqualsToken", "KindBarEqualsToken", "KindCaretEqualsToken",
  "KindBarBarEqualsToken", "KindAmpersandAmpersandEqualsToken", "KindQuestionQuestionEqualsToken",
]);
const shifts = new Set([
  "KindLessThanLessThanToken", "KindGreaterThanGreaterThanToken",
  "KindGreaterThanGreaterThanGreaterThanToken",
]);

export function collectSourceTypeFlowUses(
  context: SourceTypeFlowAnalysisContext,
  graph: SourceTypeFlowGraph,
): readonly SourceTypeFlowUse[] {
  const { ast } = context.source;
  const nodes = new Map<Node, SourceTypeFlowNode>();
  for (const node of graph.nodes) {
    if (node.kind !== "binder" && node.publish) {
      if (nodes.has(node.node)) throw new Error("Local type uses require one published variable for each exact occurrence.");
      nodes.set(node.node, node);
    }
  }
  const calls = new Map(graph.calls.map(call => [call.node, call]));
  const uses: SourceTypeFlowUse[] = [];
  for (const record of nodes.values()) {
    if (!graph.roots.includes(record.root) || !withinInferenceRoot(ast, record.node, record.root)) {
      throw new Error("Local type uses require an occurrence in its original inference root.");
    }
    const fixedType = record.term?.kind === "fixed" ? record.term.type : undefined;
    const aggregate = fixedType?.kind === "array" || fixedType?.kind === "tuple" || fixedType?.kind === "shape" ||
      fixedType?.kind === "declared";
    if ((record.kind === "fixed" || record.term?.kind === "fixed") && !aggregate || ast.is.IsArrowFunction(record.node) ||
      ast.is.IsFunctionExpression(record.node) || ast.is.IsVariableDeclaration(record.node) ||
      ast.is.IsParameterDeclaration(record.node)) continue;
    uses.push(...classify(record));
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
    const bindings = new Map<ResolvedSourceCallInfo["sourceArgumentBindings"][number], SourceTypeFlowArgumentPlace[]>();
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

  function classify(record: SourceTypeFlowNode, captured = false): readonly SourceTypeFlowUse[] {
    let value = record.node;
    let parent = ast.parent(value);
    while (parent !== undefined && transparentOperand(ast, parent, value)) {
      if (!captured && nodes.has(parent)) return [];
      value = parent;
      parent = ast.parent(value);
    }
    if (parent === undefined) return [];
    if ((ast.is.IsAsExpression(parent) || ast.is.IsTypeAssertion(parent) || ast.is.IsSatisfiesExpression(parent)) &&
      Node_Expression(ast, parent) === value && !ast.isConstAssertion(parent)) {
      const queries = context.source.semantics.forNode(record.node);
      return [requiredUse(context, record, parent, authoredComponent(context, parent, queries), ast.is.IsSatisfiesExpression(parent))];
    }
    if ((ast.is.IsVariableDeclaration(parent) || ast.is.IsPropertyDeclaration(parent) || ast.is.IsParameterDeclaration(parent)) &&
      Node_Initializer(ast, parent) === value) {
      if (ast.typeNode(parent) === undefined) return captured
        ? [refusal(record, parent, "TSONIC_LOCAL_TYPE_SELF_REFERENCE")] : [];
      const queries = context.source.semantics.forNode(record.node);
      return [requiredUse(context, record, parent, authoredComponent(context, parent, queries))];
    }
    if (ast.is.IsReturnStatement(parent) || ast.is.IsArrowFunction(parent) && ast.body(parent) === value) {
      const owner = ast.is.IsArrowFunction(parent) ? parent : containingCallable(ast, parent);
      if (owner === undefined || ast.typeNode(owner) === undefined) return captured
        ? [refusal(record, parent, "TSONIC_LOCAL_TYPE_SELF_REFERENCE")] : [];
      const queries = context.source.semantics.forNode(record.node);
      let component = authoredComponent(context, owner, queries);
      if (component !== undefined && ast.hasModifierKind(owner, "async")) {
        component = awaitedReturnComponent(context, component, queries);
      }
      return [requiredUse(context, record, parent, component)];
    }
    if (ast.is.IsBinaryExpression(parent)) {
      const binary = ast.as.AsBinaryExpression(parent);
      const operator = ast.operatorKindName(parent) ?? "";
      if (assignments.has(operator) && binary?.Left !== undefined && binary.Right !== undefined) {
        if (binary.Left === value) {
          if (!captured && operator !== "KindEqualsToken" && ast.is.IsIdentifier(value)) {
            const component = declaredValueComponent(context, binary.Right);
            if (component !== undefined) return [requiredUse(context, record, parent, component)];
          }
          return [write(record, parent, binary.Right, value)];
        }
        if (operator === "KindEqualsToken" && binary.Right === value) {
          const destination = nodes.get(binary.Left);
          if (destination !== undefined && destination.kind !== "fixed") return [];
          const component = declaredStorageComponent(context, binary.Left);
          return component === undefined ? [] : [requiredUse(context, record, parent, component)];
        }
        return [];
      }
      if (shifts.has(operator) && binary?.Right === value) {
        return [Object.freeze({ kind: "fill", site: parent, variable: record.variable,
          type: Object.freeze({ kind: "primitive", primitive: "int32" }), association: sourceAssociation(context, record.node) })];
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
    const call = retained?.source ?? context.source.semantics.forNode(node).operations.call(node);
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
        return Object.freeze({ kind: "none", site: node, variable: record.variable, association });
      }
      if (component.authoredTypeNode !== undefined && containsTypeVariables(context, component.authoredTypeNode)) {
        return refusal(record, argument, "TSONIC_LOCAL_TYPE_GENERIC", association);
      }
      if (ambiguousNumericOverload(context, call, binding)) return refusal(record, argument, "TSONIC_LOCAL_TYPE_UNSUPPORTED", association);
      return requiredUse(context, record, argument, component, false, association);
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

function requiredUse(
  context: SourceTypeFlowAnalysisContext,
  record: SourceTypeFlowNode,
  site: Node,
  component: SourceTypeComponentEvidence | undefined,
  check = false,
  retained?: SourceTypeFlowAssociation,
): SourceTypeFlowUse {
  if (component === undefined) return refusal(record, site, "TSONIC_LOCAL_TYPE_UNSUPPORTED", retained);
  const queries = context.source.semantics.forNode(record.node);
  const association = retained ?? sourceAssociation(context, record.node, component);
  const none = (): SourceTypeFlowUse => Object.freeze({ kind: "none", site, variable: record.variable, association });
  if (queries.types.isUnknown(component.selectedType) || queries.types.isAny(component.selectedType)) return none();
  if (queries.types.isNonPrimitive(component.selectedType)) {
    if (record.term?.kind !== "shape" && record.term?.kind !== "array" && record.term?.kind !== "tuple") return none();
    const type = context.describe(record.node, component);
    return type === undefined ? refusal(record, site, "TSONIC_LOCAL_TYPE_UNSUPPORTED", association)
      : Object.freeze({ kind: "fill", site, variable: record.variable, type, association });
  }
  if (component.authoredTypeNode !== undefined && containsTypeVariables(context, component.authoredTypeNode)) return none();
  if (queries.types.isUnion(component.selectedType) && !queries.types.isBooleanLike(component.selectedType)) {
    return refusal(record, site, "TSONIC_LOCAL_TYPE_UNION", association);
  }
  const type = context.describe(record.node, component);
  if (type === undefined) return refusal(record, site, "TSONIC_LOCAL_TYPE_UNSUPPORTED", association);
  if (type.kind === "optional") return refusal(record, site, "TSONIC_LOCAL_TYPE_UNION", association);
  const readOnly = type.kind === "array" && type.readonly || type.kind === "tuple" && type.readonly;
  const assertion = context.source.ast.is.IsAsExpression(site) || context.source.ast.is.IsTypeAssertion(site);
  if (check || readOnly && association.parameter !== undefined || assertion &&
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

function declaredStorageComponent(context: SourceTypeFlowAnalysisContext, expression: Node): SourceTypeComponentEvidence | undefined {
  const { ast, semantics } = context.source;
  if (ast.is.IsPropertyAccessExpression(expression)) {
    const queries = semantics.forNode(expression);
    const access = queries.operations.propertyAccess(expression);
    const declaration = access?.selectedWriteDeclaration ?? access?.selectedDeclaration;
    if (declaration !== undefined && ast.is.IsSetAccessorDeclaration(declaration)) {
      const parameter = ast.parameters(declaration);
      return parameter.length === 1 && parameter[0] !== undefined ? authoredComponent(context, parameter[0], queries, access?.sourceWriteType) : undefined;
    }
    if (declaration !== undefined) return authoredComponent(context, declaration, queries, access?.sourceWriteType);
  }
  return declaredValueComponent(context, expression);
}

function awaitedReturnComponent(context: SourceTypeFlowAnalysisContext,
  component: SourceTypeComponentEvidence, queries: SourceFileSemantics): SourceTypeComponentEvidence | undefined {
  const { ast, navigation } = context.source;
  const root = component.authoredTypeNode;
  if (root === undefined) return undefined;
  const awaited = queries.types.awaitedType(component.selectedType);
  if (awaited === undefined) return undefined;
  const visited = new Set<Node>();
  let node: Node | undefined = root;
  while (node !== undefined && !visited.has(node)) {
    visited.add(node);
    if (ast.is.IsParenthesizedTypeNode(node)) {
      node = ast.as.AsParenthesizedTypeNode(node)?.Type;
      continue;
    }
    if (!ast.is.IsTypeReferenceNode(node)) return undefined;
    const candidates = ast.typeArguments(node).filter((argument): argument is Node => {
      if (argument === undefined) return false;
      const selected = queries.types.authoredType(argument);
      return selected !== undefined && queries.types.isIdentical(selected, awaited);
    });
    if (candidates.length === 1) return Object.freeze({ ...component, selectedType: awaited, authoredTypeNode: candidates[0]! });
    if (candidates.length !== 0) return undefined;
    const declaration = navigation.sourceReferenceFor(ast.as.AsTypeReferenceNode(node)?.TypeName)?.declaration;
    node = declaration !== undefined && ast.is.IsTypeAliasDeclaration(declaration) && ast.typeParameters(declaration).length === 0
      ? ast.typeNode(declaration) : undefined;
  }
  return undefined;
}

function sourceAssociation(
  context: SourceTypeFlowAnalysisContext,
  occurrence: Node,
  component?: SourceTypeComponentEvidence,
): SourceTypeFlowAssociation {
  const sourceFile = context.source.ast.getSourceFile(occurrence);
  if (sourceFile === undefined || !context.source.semantics.includes(sourceFile)) {
    throw new Error("Local type uses require their exact checked source-file owner.");
  }
  return Object.freeze({ occurrence, sourceFile, ...(component === undefined ? {} : { component }) });
}

function authoredComponent(
  context: SourceTypeFlowAnalysisContext,
  declaration: Node,
  queries: SourceFileSemantics,
  selectedType?: Type,
): SourceTypeComponentEvidence | undefined {
  const authoredTypeNode = context.source.ast.typeNode(declaration);
  if (authoredTypeNode === undefined) return undefined;
  const selected = selectedType ?? queries.types.authoredType(authoredTypeNode);
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

function assertRetainedCall(context: SourceTypeFlowAnalysisContext, node: Node, call: ResolvedSourceCallInfo): void {
  const { ast } = context.source;
  if (call.call !== node || call.sourceCallee.expression !== Node_Expression(ast, node)) {
    throw new Error("Local type uses require the exact retained selected call.");
  }
  if (context.source.semantics.forNode(node).operations.call(node) !== call) {
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
): SourceTypeComponentEvidence | undefined {
  const { ast, navigation, semantics } = context.source;
  const queries = semantics.forNode(expression);
  let node = expression;
  while (ast.is.IsParenthesizedExpression(node) || ast.is.IsNonNullExpression(node)) {
    const inner = Node_Expression(ast, node);
    if (inner === undefined) return undefined;
    node = inner;
  }
  let declaration: Node | undefined;
  let selectedType: Type | undefined;
  if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) {
    const call = queries.operations.call(node);
    if (call?.sourceSelectedSignatureKind !== "resolved") return undefined;
    declaration = queries.declarations.signatureDeclaration(call.selectedSignature);
    selectedType = call.sourceResultType;
  } else if (ast.is.IsPropertyAccessExpression(node)) {
    const access = queries.operations.propertyAccess(node);
    declaration = access?.selectedReadDeclaration ?? access?.selectedDeclaration;
    selectedType = access?.sourceReadType;
  } else if (ast.is.IsElementAccessExpression(node)) {
    const access = queries.operations.elementAccess(node);
    declaration = access?.selectedDeclaration;
    selectedType = access?.sourceReadType;
  } else if (ast.is.IsIdentifier(node)) {
    declaration = navigation.sourceReferenceFor(node)?.declaration;
  }
  if (declaration === undefined || !(ast.is.IsParameterDeclaration(declaration) ||
    ast.is.IsVariableDeclaration(declaration) || ast.is.IsPropertyDeclaration(declaration) ||
    ast.is.IsPropertySignatureDeclaration(declaration) || ast.is.IsGetAccessorDeclaration(declaration) ||
    isSourceCallableBodyBoundary(ast, declaration) || ast.is.IsMethodSignatureDeclaration(declaration) ||
    ast.is.IsCallSignatureDeclaration(declaration) || ast.is.IsConstructSignatureDeclaration(declaration))) return undefined;
  const component = authoredComponent(context, declaration, queries, selectedType);
  return component?.authoredTypeNode !== undefined && !containsTypeVariables(context, component.authoredTypeNode)
    ? component : undefined;
}

function callAssociation(
  context: SourceTypeFlowAnalysisContext,
  occurrence: Node,
  call: ResolvedSourceCallInfo,
  binding: ResolvedSourceCallInfo["sourceArgumentBindings"][number],
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
    else if (value.kind === "tuple") value.elements.forEach((element, index) => visit(element, `${key}[${index}]`));
    else if (value.kind === "shape") for (const member of value.members) visit(member.type, `${key}.${member.name}`);
    else if (value.kind === "declared") value.typeArguments.forEach((argument, index) => visit(argument, `${key}<${index}>`));
    else if (value.kind === "optional") visit(value.value, `${key}?`);
  };
  visit(type, path);
  return widths;
}

function ambiguousNumericOverload(
  context: SourceTypeFlowAnalysisContext,
  call: ResolvedSourceCallInfo,
  binding: ResolvedSourceCallInfo["sourceArgumentBindings"][number],
): boolean {
  const { ast, semantics } = context.source;
  const queries = semantics.forNode(call.call);
  const signatures = queries.types.signatureInfos(call.sourceCallee.type, ast.is.IsNewExpression(call.call) ? "construct" : "call");
  if (signatures.length < 2) return false;
  const seen = new Map<string, string>();
  for (const signature of signatures) {
    const parameter = signature.parameters[binding.sourceParameterIndex];
    if (parameter === undefined) continue;
    const component: SourceTypeComponentEvidence = Object.freeze({ selectedType: parameter.type,
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
