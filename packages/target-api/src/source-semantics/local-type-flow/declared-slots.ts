import type { Node } from "@tsonic/tsts";
import { sourceTypeFlowConstructionSlot } from "./construction-slots.js";
import { Node_Expression, Node_Initializer } from "../../source-navigation/ast.js";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "../types.js";
import { sourceObjectLiteralDestinationMember } from "../object-literal-correspondence.js";
import { sourceArrayElementType } from "../array-types.js";
import { sourceTypeDescriptorMemberOrigin, sourceTypeDescriptorMemberOriginsEqual } from "./member-origins.js";
import { sourceTypeDescriptorHasTypeVariables, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorTupleValue, sourceTypeDescriptorUnion } from "./terms.js";
import type { SourceTypeDescriptor, SourceTypeDescriptorSignature, SourceTypeFlowAnalysisContext, SourceTypeFlowRefusal } from "./types.js";

export interface SourceTypeFlowDeclaredSlot {
  readonly authority: "declared" | "inferred";
  readonly component?: SourceTypeComponentEvidence;
  readonly type?: SourceTypeDescriptor;
  readonly refusal?: SourceTypeFlowRefusal;
}

interface AuthoredBinding {
  readonly type: SourceTypeDescriptor;
  readonly component?: SourceTypeComponentEvidence;
}

export function createSourceTypeFlowDeclaredSlotReader(context: SourceTypeFlowAnalysisContext) {
  const { ast, semantics, navigation } = context.source;
  const cache = new WeakMap<Node, SourceTypeFlowDeclaredSlot | null>();
  const active = new Set<Node>();
  const activeParameters = new Set<Node>();

  function callable(node: Node): boolean {
    return ast.is.IsFunctionDeclaration(node) || ast.is.IsFunctionExpression(node) || ast.is.IsArrowFunction(node) ||
      ast.is.IsMethodDeclaration(node) || ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node);
  }

  function component(owner: Node, query: SourceFileSemantics): SourceTypeComponentEvidence | undefined {
    const authoredTypeNode = ast.typeNode(owner);
    const selectedType = authoredTypeNode === undefined ? undefined : query.types.authoredType(authoredTypeNode);
    return selectedType === undefined ? undefined : { selectedType, declaration: owner, authoredTypeNode };
  }

  function slot(node: Node, type: SourceTypeDescriptor, authority: SourceTypeFlowDeclaredSlot["authority"]): SourceTypeFlowDeclaredSlot {
    return sourceTypeFlowConstructionSlot(ast, node, type, authority);
  }

  function structural(type: SourceTypeDescriptor): SourceTypeDescriptor {
    let selected = type;
    while (selected.kind === "optional" || selected.kind === "declared" && selected.definition !== undefined) {
      selected = selected.kind === "optional" ? selected.value : sourceTypeDescriptorStructure(selected);
    }
    return selected;
  }

  function typeVariables(type: SourceTypeDescriptor, found = new Set<Node>()): Set<Node> {
    const visit = (selected: SourceTypeDescriptor): void => { typeVariables(selected, found); };
    if (type.kind === "declared") {
      if (ast.is.IsTypeParameterDeclaration(type.declaration)) found.add(type.declaration);
      type.typeArguments.forEach(visit);
      if (type.definition !== undefined) visit(type.definition);
    } else if (type.kind === "array") visit(type.element);
    else if (type.kind === "tuple") type.elements.forEach(element => visit(element.type));
    else if (type.kind === "optional") visit(type.value);
    else if (type.kind === "union") type.types.forEach(visit);
    else if (type.kind === "shape" || type.kind === "callable") {
      if (type.kind === "shape") { type.members.forEach(member => visit(member.type)); type.indexes.forEach(index => { visit(index.key); visit(index.value); }); }
      for (const signature of [...type.calls, ...type.constructs]) {
        const own = new Set(signature.typeParameters);
        const inner = new Set<Node>();
        signature.parameters.forEach(parameter => typeVariables(parameter.type, inner));
        typeVariables(signature.result, inner);
        for (const variable of inner) if (!own.has(variable)) found.add(variable);
      }
    }
    return found;
  }

  function authoredValue(node: Node, query: SourceFileSemantics): AuthoredBinding | undefined {
    let expression = node;
    while (ast.is.IsParenthesizedExpression(expression)) {
      const operand = Node_Expression(ast, expression);
      if (operand === undefined) return undefined;
      expression = operand;
    }
    if (ast.is.IsNewExpression(expression) && ast.typeArguments(expression).length > 0) {
      const type = context.describe(expression);
      return type === undefined ? undefined : { type };
    }
    const declaration = navigation.sourceReferenceFor(expression)?.declaration;
    if (declaration === undefined) return undefined;
    if (ast.typeNode(declaration) === undefined) {
      const initializer = Node_Initializer(ast, declaration);
      return initializer !== undefined && ast.is.IsNewExpression(initializer) && ast.typeArguments(initializer).length > 0
        ? authoredValue(initializer, query) : undefined;
    }
    const selected = component(declaration, query);
    const type = context.describe(expression, selected);
    return type === undefined ? undefined : { type, ...(selected === undefined ? {} : { component: selected }) };
  }

  function authoredBinding(callNode: Node | undefined, variables: ReadonlySet<Node>): ReadonlyMap<Node, AuthoredBinding> | undefined {
    if (variables.size === 0) return new Map();
    const query = callNode === undefined ? undefined : semantics.forNode(callNode);
    const call = callNode === undefined ? undefined : query?.operations.call(callNode);
    if (query === undefined || callNode === undefined || call?.sourceSelectedSignatureKind !== "resolved") return undefined;
    const receiver = call.sourceReceiver ?? call.sourceCallee;
    const receiverBindings = query.types.typeArgumentBindings(receiver.type) ?? [];
    const receiverType = authoredValue(receiver.expression, query)?.type;
    const authoredReceiver = new Map<Node, SourceTypeDescriptor>();
    if (receiverType?.kind === "declared" && receiverBindings.length === receiverType.typeArguments.length) {
      receiverBindings.forEach((binding, index) => authoredReceiver.set(binding.declaration, receiverType.typeArguments[index]!));
    } else if (receiverType?.kind === "array" && receiverBindings.length === 1) {
      authoredReceiver.set(receiverBindings[0]!.declaration, receiverType.element);
    }
    const inherited = context.authoredInheritedBindings(receiver.type, query, authoredReceiver);
    const methodBindings = (call.sourceSelectedMethodTypeArguments ?? []).flatMap(argument => {
      const symbol = query.declarations.typeSymbol(argument.typeParameter);
      return (symbol === undefined ? [] : query.declarations.symbolDeclarations(symbol)).flatMap(declaration => {
        if (!ast.is.IsTypeParameterDeclaration(declaration)) return [];
        const declared = query.declarations.declaredType(declaration);
        return declared !== undefined && query.types.isIdentical(declared, argument.typeParameter) ? [{ declaration, argument }] : [];
      });
    });
    const checked = new Set([...receiverBindings.map(binding => binding.declaration), ...inherited.keys(), ...methodBindings.map(binding => binding.declaration)]);
    if ([...variables].some(variable => !checked.has(variable))) return undefined;
    const bound = new Map<Node, AuthoredBinding>();
    const conflicts = new Set<Node>();
    const bind = (declaration: Node, type: SourceTypeDescriptor, component?: SourceTypeComponentEvidence): void => {
      if (!variables.has(declaration) || conflicts.has(declaration) || sourceTypeDescriptorHasTypeVariables(ast, type)) return;
      const previous = bound.get(declaration);
      if (previous !== undefined && !sourceTypeDescriptorsEqual(previous.type, type)) {
        bound.delete(declaration);
        conflicts.add(declaration);
      } else bound.set(declaration, previous ?? { type, ...(component === undefined ? {} : { component }) });
    };
    const positions = (formal: SourceTypeDescriptor, actual: SourceTypeDescriptor, component?: SourceTypeComponentEvidence): void => {
      if (formal.kind === "declared" && ast.is.IsTypeParameterDeclaration(formal.declaration)) {
        bind(formal.declaration, actual, component);
      } else if (formal.kind === "array" && actual.kind === "array") {
        const selectedType = component === undefined ? undefined : sourceArrayElementType(component.selectedType, query);
        positions(formal.element, actual.element, selectedType === undefined ? undefined : { selectedType });
      } else if (formal.kind === "optional" && actual.kind === "optional") {
        const selectedType = component === undefined ? undefined : query.types.nonNullableType(component.selectedType);
        positions(formal.value, actual.value, selectedType === undefined ? undefined : { selectedType });
      }
      else if (formal.kind === "tuple" && actual.kind === "tuple" && formal.elements.length === actual.elements.length) {
        formal.elements.forEach((element, index) => {
          const selected = actual.elements[index];
          const selectedType = component === undefined ? undefined : query.types.tupleElementInfos(component.selectedType)[index]?.type;
          if (selected?.kind === element.kind) positions(element.type, selected.type, selectedType === undefined ? undefined : { selectedType });
        });
      } else if (formal.kind === "declared" && actual.kind === "declared" && formal.declaration === actual.declaration &&
        formal.typeArguments.length === actual.typeArguments.length) {
        const application = component === undefined ? undefined : query.types.aliasApplication(component.selectedType);
        const arguments_ = application?.declaration === actual.declaration ? application.bindings.map(binding =>
          ({ declaration: binding.declaration, argumentType: binding.argument })) : component === undefined ? []
          : query.types.typeArgumentBindings(component.selectedType) ?? [];
        const parameters = ast.typeParameters(actual.declaration);
        formal.typeArguments.forEach((argument, index) => {
          const selectedType = arguments_.find(binding => binding.declaration === parameters[index])?.argumentType;
          const authoredTypeNode = component?.authoredTypeNode === undefined ? undefined : ast.typeArguments(component.authoredTypeNode)[index];
          positions(argument, actual.typeArguments[index]!, selectedType === undefined ? undefined : { selectedType,
            ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }) });
        });
      }
    };
    if (receiverType?.kind === "declared") {
      if (receiverBindings.length === receiverType.typeArguments.length) receiverBindings.forEach((binding, index) => bind(binding.declaration,
        receiverType.typeArguments[index]!, { selectedType: binding.argumentType }));
    } else if (receiverType?.kind === "array") {
      if (receiverBindings.length === 1) bind(receiverBindings[0]!.declaration, receiverType.element);
    }
    for (const [declaration, binding] of inherited) bind(declaration, binding.value, binding.authoredComponent);
    for (const { declaration, argument } of methodBindings) {
      if (argument.explicitTypeNode === undefined) continue;
      const type = context.describe(callNode, { selectedType: argument.selectedType, authoredTypeNode: argument.explicitTypeNode });
      if (type !== undefined) bind(declaration, type, { selectedType: argument.selectedType, authoredTypeNode: argument.explicitTypeNode });
    }
    for (const binding of call.sourceArgumentBindings) {
      const parameter = call.sourceSelectedSignatureParameters[binding.sourceParameterIndex]?.parameterDeclaration;
      const argument = call.sourceArguments[binding.sourceArgumentIndex]?.expression;
      const selected = parameter === undefined ? undefined : component(parameter, query);
      const actual = argument === undefined ? undefined : authoredValue(argument, query);
      const formal = selected === undefined ? undefined : context.describe(parameter!, selected);
      if (formal !== undefined && actual !== undefined) positions(formal, actual.type, actual.component);
    }
    const destination = read(callNode, query);
    const declaration = query.declarations.signatureDeclaration(call.selectedSignature);
    const selected = declaration === undefined ? undefined : component(declaration, query);
    const returned = selected === undefined ? undefined : context.describe(declaration!, selected);
    if (destination?.authority === "declared" && destination.type !== undefined && returned !== undefined) {
      positions(returned, destination.type, destination.component);
    }
    return [...variables].every(variable => bound.has(variable)) ? bound : undefined;
  }

  function selectSlot(node: Node, selected: SourceTypeComponentEvidence | undefined,
    concrete = false, callNode?: Node, parameterIndex?: number): SourceTypeFlowDeclaredSlot | undefined {
    if (selected === undefined) return Object.freeze({ authority: "declared" });
    let parameterKind: SourceTypeDescriptorSignature["parameters"][number]["kind"] | undefined;
    if (parameterIndex !== undefined) {
      const query = semantics.forNode(node);
      const type = query.types.nonNullableType(selected.selectedType);
      if (type === undefined || query.types.signatureInfos(type, "call").length !== 1) return undefined;
      const parameter = query.types.callable(type)?.parameters[parameterIndex];
      if (parameter === undefined) return undefined;
      parameterKind = parameter.parameterKind;
      const declaration = parameter.declaration;
      const authoredTypeNode = declaration === undefined ? undefined : ast.typeNode(declaration);
      selected = { selectedType: parameter.type,
        ...(declaration === undefined ? {} : { declaration }),
        ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
        ...(selected.contextualCall === undefined ? {} : { contextualCall: selected.contextualCall }) };
    }
    const formal = concrete && selected.contextualCall !== undefined ? {
      selectedType: selected.selectedType,
      ...(selected.declaration === undefined ? {} : { declaration: selected.declaration }),
      ...(selected.authoredTypeNode === undefined ? {} : { authoredTypeNode: selected.authoredTypeNode }),
    } : selected;
    const unbound = context.describe(node, formal);
    const bindings = unbound !== undefined && concrete && sourceTypeDescriptorHasTypeVariables(ast, unbound)
      ? authoredBinding(callNode, typeVariables(unbound)) : undefined;
    if (unbound !== undefined && concrete && sourceTypeDescriptorHasTypeVariables(ast, unbound) && bindings === undefined) return undefined;
    const described = formal === selected ? unbound : context.describe(node, selected,
      bindings === undefined ? undefined : [...bindings].map(([declaration, value]) => ({ declaration, type: value.type })));
    if (described !== undefined && concrete && sourceTypeDescriptorHasTypeVariables(ast, described)) return undefined;
    const origin = unbound?.kind === "declared" ? bindings?.get(unbound.declaration)?.component : undefined;
    const retained = origin === undefined ? selected : { ...origin,
      ...(selected.contextualCall === undefined ? {} : { contextualCall: selected.contextualCall }) };
    const projected = described === undefined ? undefined : parameterKind === "optional"
      ? sourceTypeDescriptorUnion([described, { kind: "intrinsic", intrinsic: "absence" }]) : described;
    return projected === undefined ? Object.freeze({ component: retained, authority: "declared" })
      : Object.freeze({ ...(parameterIndex === undefined ? slot(node, projected, "declared")
        : { type: projected, authority: "declared" as const }), component: retained });
  }


  function declaredCallable(node: Node, query: SourceFileSemantics): {
    readonly type: Extract<SourceTypeDescriptor, { readonly kind: "callable" | "shape" }>;
    readonly signature: SourceTypeDescriptorSignature;
  } | undefined {
    const method = ast.is.IsMethodDeclaration(node);
    if (!method && (!(ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node)) ||
      query.types.contextualType(node) === undefined)) return undefined;
    const selected = method ? contextualMember(node, query) : read(node, query)?.type;
    const type = selected === undefined ? undefined : structural(selected);
    return (type?.kind === "callable" || type?.kind === "shape") && type.calls.length === 1
      ? { type, signature: type.calls[0]! } : undefined;
  }

  function contextualMember(node: Node, query: SourceFileSemantics): SourceTypeDescriptor | undefined {
    const literal = ast.parent(node);
    if (literal === undefined || !ast.is.IsObjectLiteralExpression(literal)) return undefined;
    const slot = read(literal, query);
    if (slot?.authority !== "declared" || slot.type === undefined) return undefined;
    const selected = structural(slot.type);
    if (selected.kind !== "shape") return undefined;
    const element = query.operations.objectLiteralElement(node);
    if (element === undefined || element.element !== node || element.objectLiteral !== literal || element.contextualType === undefined) return undefined;
    const destination = sourceObjectLiteralDestinationMember(element, element.contextualType, query);
    if (destination === undefined) return undefined;
    const origin = sourceTypeDescriptorMemberOrigin(context.source, query, destination.property, destination.receiverType);
    if (origin?.kind !== "resolved") return undefined;
    const matches = selected.members.filter(member => sourceTypeDescriptorMemberOriginsEqual(member.origin, origin.origin));
    return matches?.length === 1 ? matches[0]!.type : undefined;
  }

  function parameter(node: Node, query: SourceFileSemantics): SourceTypeDescriptor | undefined {
    if (!ast.is.IsParameterDeclaration(node) || ast.typeNode(node) !== undefined) return undefined;
    const owner = ast.parent(node);
    if (owner === undefined) return undefined;
    if (ast.is.IsSetAccessorDeclaration(owner)) return contextualMember(owner, query);
    const index = query.types.declarationSignatureInfo(owner)?.parameters
      .findIndex(parameter => parameter.declaration === node) ?? -1;
    if (index < 0) return undefined;
    if (ast.is.IsMethodDeclaration(owner)) {
      const type = contextualMember(owner, query);
      return type === undefined ? undefined : parameterValue(node, callableParameter(type, index), query);
    }
    if (!(ast.is.IsArrowFunction(owner) || ast.is.IsFunctionExpression(owner)) || query.types.contextualType(owner) === undefined ||
      activeParameters.has(node)) return undefined;
    activeParameters.add(node);
    try { return parameterValue(node, classify(owner, query, index)?.type, query); }
    finally { activeParameters.delete(node); }
  }

  function callableParameter(type: SourceTypeDescriptor, index: number): SourceTypeDescriptor | undefined {
    const selected = structural(type);
    const parameter = (selected.kind === "callable" || selected.kind === "shape") && selected.calls.length === 1
      ? selected.calls[0]?.parameters[index] : undefined;
    return parameter?.kind === "optional"
      ? sourceTypeDescriptorUnion([parameter.type, { kind: "intrinsic", intrinsic: "absence" }]) : parameter?.type;
  }

  function parameterValue(node: Node, type: SourceTypeDescriptor | undefined, query: SourceFileSemantics): SourceTypeDescriptor | undefined {
    const initializer = Node_Initializer(ast, node);
    if (type?.kind !== "optional" || initializer === undefined) return type;
    const checked = query.types.expressionType(node);
    const present = checked === undefined ? undefined : query.types.withoutMissingOrUndefined(checked);
    const initial = query.types.expressionType(initializer);
    const absent = (selected: NonNullable<typeof checked>): boolean => query.types.isAny(selected) || query.types.isUnknown(selected) ||
      query.types.isNullish(selected) || query.types.isUnion(selected) && query.types.unionOrIntersectionTypes(selected).some(absent);
    return present !== undefined && initial !== undefined && !absent(present) && !absent(initial) ? type.value : type;
  }

  function returned(node: Node, query: SourceFileSemantics): SourceTypeDescriptor | undefined {
    if (ast.is.IsGetAccessorDeclaration(node)) return contextualMember(node, query);
    if (ast.is.IsSetAccessorDeclaration(node)) return { kind: "intrinsic", intrinsic: "void" };
    const signature = declaredCallable(node, query);
    if (signature === undefined) return undefined;
    const selected = ast.hasModifierKind(node, "async") && signature.signature.declaration !== undefined
      ? awaited(component(signature.signature.declaration, query), query) : undefined;
    const type = ast.hasModifierKind(node, "async")
      ? selected === undefined ? undefined : context.describe(node, selected) : signature.signature.result;
    const structure = type === undefined ? undefined : sourceTypeDescriptorStructure(type);
    return structure?.kind === "intrinsic" && ["unknown", "object", "any"].includes(structure.intrinsic) ? undefined : type;
  }

  function awaited(selected: SourceTypeComponentEvidence | undefined, query: SourceFileSemantics): SourceTypeComponentEvidence | undefined {
    if (selected === undefined) return undefined;
    const selectedType = query.types.awaitedType(selected.selectedType);
    if (selectedType === undefined) return undefined;
    const original = selected.authoredTypeNode;
    const argument = original !== undefined && (ast.is.IsTypeReferenceNode(original) || ast.is.IsImportTypeNode(original))
      ? ast.typeArguments(original).find(node => node !== undefined && (() => {
        const type = query.types.authoredType(node);
        return type !== undefined && query.types.isIdentical(type, selectedType);
      })()) : undefined;
    return { selectedType, ...(selected.declaration === undefined ? {} : { declaration: selected.declaration }),
      ...(argument === undefined ? {} : { authoredTypeNode: argument }) };
  }

  function read(node: Node, query: SourceFileSemantics): SourceTypeFlowDeclaredSlot | undefined {
    const cached = cache.get(node);
    if (cached !== undefined) return cached ?? undefined;
    if (active.has(node)) return undefined;
    active.add(node);
    const result = classify(node, query);
    active.delete(node);
    cache.set(node, result ?? null);
    return result;
  }

  function classify(node: Node, query: SourceFileSemantics, parameterIndex?: number): SourceTypeFlowDeclaredSlot | undefined {
    const select = (node: Node, selected: SourceTypeComponentEvidence | undefined, concrete = false, callNode?: Node) =>
      selectSlot(node, selected, concrete, callNode, parameterIndex);
    const projected = (node: Node, type: SourceTypeDescriptor, authority: SourceTypeFlowDeclaredSlot["authority"]) => {
      const selected = parameterIndex === undefined ? type : callableParameter(type, parameterIndex);
      return selected === undefined ? undefined : parameterIndex === undefined ? slot(node, selected, authority)
        : Object.freeze({ type: selected, authority });
    };
    let occurrence = node;
    let parent = ast.parent(occurrence);
    while (parent !== undefined) {
      if (ast.is.IsParenthesizedExpression(parent) && Node_Expression(ast, parent) === occurrence) {
        occurrence = parent;
      } else if (ast.is.IsBinaryExpression(parent) && ast.operatorKindName(parent) === "KindCommaToken" &&
        ast.as.AsBinaryExpression(parent)?.Right === occurrence) {
        occurrence = parent;
      } else if (ast.is.IsPrefixUnaryExpression(parent) && ast.as.AsPrefixUnaryExpression(parent)?.Operand === occurrence &&
        (ast.operatorKindName(parent) === "KindPlusToken" || ast.operatorKindName(parent) === "KindMinusToken") &&
        context.literal(parent)?.numeric?.kind === "authored") {
        occurrence = parent;
      } else if (ast.is.IsConditionalExpression(parent) &&
        (ast.as.AsConditionalExpression(parent)?.WhenTrue === occurrence || ast.as.AsConditionalExpression(parent)?.WhenFalse === occurrence)) {
        occurrence = parent;
      } else if (ast.is.IsBinaryExpression(parent) && (ast.operatorKindName(parent) === "KindQuestionQuestionToken" ||
        ast.operatorKindName(parent) === "KindBarBarToken") &&
        (ast.as.AsBinaryExpression(parent)?.Left === occurrence || ast.as.AsBinaryExpression(parent)?.Right === occurrence)) {
        // Either operand of `??` or `||` can be the expression's value, so both reach the slot.
        occurrence = parent;
      } else if (ast.is.IsBinaryExpression(parent) && ast.operatorKindName(parent) === "KindAmpersandAmpersandToken" &&
        ast.as.AsBinaryExpression(parent)?.Right === occurrence) {
        // Only the right operand of `&&` is a value that can reach the slot.
        occurrence = parent;
      } else if ((ast.is.IsAsExpression(parent) || ast.is.IsTypeAssertion(parent)) && ast.isConstAssertion(parent) &&
        Node_Expression(ast, parent) === occurrence) {
        // A const assertion narrows its own literal; the slot of `x as const` is x's slot.
        occurrence = parent;
      } else break;
      parent = ast.parent(occurrence);
    }
    if (parent === undefined) return undefined;
    if (ast.is.IsBinaryExpression(parent) && ast.operatorKindName(parent) === "KindEqualsToken" &&
      ast.as.AsBinaryExpression(parent)?.Right === occurrence && (ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node))) {
      const left = ast.as.AsBinaryExpression(parent)?.Left;
      if (left === undefined) return undefined;
      if (ast.is.IsIdentifier(left)) {
        const declaration = navigation.sourceReferenceFor(left)?.declaration;
        return declaration === undefined ? undefined : select(node, component(declaration, query));
      }
      const propertyAccess = ast.is.IsPropertyAccessExpression(left) ? query.operations.propertyAccess(left) : undefined;
      const access = propertyAccess ?? (ast.is.IsElementAccessExpression(left) ? query.operations.elementAccess(left) : undefined);
      if (access === undefined) return undefined;
      const declaration = propertyAccess?.selectedWriteDeclaration ?? access.selectedDeclaration;
      if (declaration !== undefined && ast.is.IsSetAccessorDeclaration(declaration)) {
        const parameters = ast.parameters(declaration);
        return parameters.length !== 1 || parameters[0] === undefined ? undefined : select(node, component(parameters[0], query));
      }
      const property = query.types.propertyInfos(access.receiver.type).find(property => property.symbol === access.selectedSymbol);
      const origin = property === undefined ? undefined : sourceTypeDescriptorMemberOrigin(context.source, query, property, access.receiver.type);
      const receiver = context.describe(access.receiver.expression);
      const shape = receiver === undefined ? undefined : structural(receiver);
      if (origin?.kind !== "resolved" || shape?.kind !== "shape") return undefined;
      const members = shape.members.filter(member => sourceTypeDescriptorMemberOriginsEqual(member.origin, origin.origin));
      const member = members.length === 1 ? members[0] : undefined;
      return member === undefined ? undefined : projected(node,
        member.optional ? { kind: "optional", value: member.type } : member.type, "declared");
    }
    if ((ast.is.IsVariableDeclaration(parent) || ast.is.IsParameterDeclaration(parent) || ast.is.IsPropertyDeclaration(parent)) &&
      Node_Initializer(ast, parent) === occurrence) {
      const name = ast.name(parent);
      if (name !== undefined && (ast.is.IsArrayBindingPattern(name) || ast.is.IsObjectBindingPattern(name)) &&
        ast.typeNode(parent) === undefined) return Object.freeze({ authority: "inferred" });
      if (ast.typeNode(parent) === undefined) {
        let owner = ast.parent(parent);
        while (owner !== undefined && !callable(owner) && !ast.is.IsSourceFile(owner)) owner = ast.parent(owner);
        const local = owner !== undefined && callable(owner) && ast.is.IsVariableDeclaration(parent) &&
          (ast.variableDeclarationKind(parent) === "const" || ast.variableDeclarationKind(parent) === "let") &&
          !navigation.declarationUseSummary(parent).exported;
        if (local) return undefined;
        const type = context.describe(parent);
        return type === undefined ? Object.freeze({ authority: "inferred" }) : projected(node, type, "inferred");
      }
      return select(node, component(parent, query));
    }
    if ((ast.is.IsAsExpression(parent) || ast.is.IsSatisfiesExpression(parent) || ast.is.IsTypeAssertion(parent)) &&
      Node_Expression(ast, parent) === occurrence && !ast.isConstAssertion(parent)) {
      const selected = component(parent, query);
      return select(node, selected, true);
    }
    if (ast.is.IsReturnStatement(parent) && Node_Expression(ast, parent) === occurrence ||
      ast.is.IsArrowFunction(parent) && ast.body(parent) === occurrence) {
      let owner: Node | undefined = ast.is.IsArrowFunction(parent) ? parent : ast.parent(parent);
      while (owner !== undefined && !callable(owner)) owner = ast.parent(owner);
      if (owner === undefined) return undefined;
      if (ast.typeNode(owner) === undefined) {
        const type = returned(owner, query);
        return type === undefined ? undefined : projected(node, type, "declared");
      }
      const declared = component(owner, query);
      return select(node, ast.hasModifierKind(owner, "async") ? awaited(declared, query) : declared);
    }
    if (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) {
      const call = query.operations.call(parent);
      if (call?.sourceSelectedSignatureKind !== "resolved") return undefined;
      const index = call.sourceArguments.findIndex(argument => argument.expression === occurrence);
      if (index < 0) return undefined;
      const bindings = call.sourceArgumentBindings.filter(binding => binding.sourceArgumentIndex === index);
      if (bindings.length !== 1) return undefined;
      const parameter = call.sourceSelectedSignatureParameters[bindings[0]!.sourceParameterIndex];
      const declared = parameter?.parameterDeclaration === undefined ? undefined : component(parameter.parameterDeclaration, query);
      if (declared === undefined) return undefined;
      return select(node, { ...declared, contextualCall: call }, true, parent);
    }
    if (ast.is.IsPropertyAssignment(parent) && Node_Initializer(ast, parent) === occurrence) {
      const literal = ast.parent(parent);
      const enclosing = literal !== undefined && ast.is.IsObjectLiteralExpression(literal) ? read(literal, query) : undefined;
      if (enclosing === undefined) return undefined;
      const name = ast.name(parent);
      const selected = name === undefined ? undefined : query.propertyNames.get(name);
      if (selected?.kind !== "resolved") return Object.freeze({ authority: enclosing.authority });
      const described = enclosing.type === undefined ? undefined : structural(enclosing.type);
      const shape = described?.kind === "shape" ? described : undefined;
      const numeric = selected.constant.kind === "numeric";
      const index = shape?.indexes.find(index => numeric && index.key.kind === "primitive" && index.key.primitive === "float64") ??
        shape?.indexes.find(index => index.key.kind === "string");
      const memberType = shape?.members.find(member => member.name === selected.name)?.type ?? index?.value;
      return memberType === undefined ? Object.freeze({ authority: enclosing.authority }) : projected(node, memberType, enclosing.authority);
    }
    if (ast.is.IsArrayLiteralExpression(parent)) {
      const enclosing = read(parent, query);
      if (enclosing === undefined) return undefined;
      const position = ast.elements(parent).indexOf(occurrence);
      const described = enclosing.type === undefined ? undefined : structural(enclosing.type);
      const elementType = described?.kind === "array" ? described.element
        : described?.kind === "tuple" ? sourceTypeDescriptorTupleValue(described, position) : undefined;
      return elementType === undefined ? Object.freeze({ authority: enclosing.authority }) : projected(node, elementType, enclosing.authority);
    }
    return undefined;
  }

  return Object.freeze({ get: (node: Node) => read(node, semantics.forNode(node)), authoredBinding,
    callable: declaredCallable, parameter, returned, retainFixedConstruction(node: Node, type: SourceTypeDescriptor,
    component?: SourceTypeComponentEvidence): void {
    if (read(node, semantics.forNode(node)) !== undefined) return;
    cache.set(node, Object.freeze({ type, authority: "inferred", ...(component === undefined ? {} : { component }) }));
  } });
}
