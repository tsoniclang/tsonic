import type { Node } from "@tsonic/tsts";
import { sourceTypeFlowConstructionSlot } from "./construction-slots.js";
import { Node_Expression, Node_Initializer } from "../../source-model/ast.js";
import { sourceNodeHasRole } from "../../source-model/callable-boundaries.js";
import type { SourceHostComponent, SourceHostQueries } from "../../host-input/queries.js";
import { sourceTypeDescriptorMemberOriginsEqual } from "./member-origins.js";
import { sourceTypeDescriptorAwaitedPayload, sourceTypeFlowAuthoredAwaitedArgument } from "./awaited.js";
import { sourceTypeDescriptorOptional, sourceTypeDescriptorHasTypeVariables, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorTupleValue, sourceTypeDescriptorUnion } from "./terms.js";
import type { SourceTypeDescriptor, SourceTypeDescriptorSignature, SourceTypeFlowAnalysisContext, SourceTypeFlowRefusal } from "./types.js";

export interface SourceTypeFlowDeclaredSlot {
  readonly authority: "declared" | "inferred";
  readonly component?: SourceHostComponent;
  readonly type?: SourceTypeDescriptor;
  readonly refusal?: SourceTypeFlowRefusal;
}

interface AuthoredBinding {
  readonly type: SourceTypeDescriptor;
  readonly component?: SourceHostComponent;
}

export function createSourceTypeFlowDeclaredSlotReader(context: SourceTypeFlowAnalysisContext) {
  const { ast, navigation } = context.source;
  const { input } = context;
  const cache = new WeakMap<Node, SourceTypeFlowDeclaredSlot | null>();
  const active = new Set<Node>();
  const activeParameters = new Set<Node>();

  function component(owner: Node, query: SourceHostQueries): SourceHostComponent | undefined {
    const authoredTypeNode = ast.typeNode(owner);
    const selectedType = authoredTypeNode === undefined ? undefined : query.authoredType(authoredTypeNode);
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

  function authoredValue(node: Node, query: SourceHostQueries): AuthoredBinding | undefined {
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

  function authoredVariables(type: SourceTypeDescriptor, component: SourceHostComponent | undefined): ReadonlySet<Node> | undefined {
    const variables = typeVariables(type);
    if (variables.size === 0 || component?.authoredTypeNode === undefined) return undefined;
    const references = new Set<Node>();
    const pending = [component.authoredTypeNode];
    while (pending.length > 0) {
      const node = pending.pop()!;
      const declaration = navigation.sourceReferenceFor(node)?.declaration;
      if (declaration !== undefined && ast.is.IsTypeParameterDeclaration(declaration)) references.add(declaration);
      if (declaration !== undefined && ast.is.IsTypeAliasDeclaration(declaration)) {
        const parent = ast.parent(node);
        const reference = ast.is.IsTypeReferenceNode(node) ? node : parent !== undefined &&
          ast.is.IsTypeReferenceNode(parent) && ast.as.AsTypeReferenceNode(parent)?.TypeName === node ? parent : undefined;
        const selectedType = reference === undefined ? undefined : input.at(reference).authoredType(reference);
        const described = reference === undefined || selectedType === undefined ? undefined
          : context.describe(reference, { selectedType, authoredTypeNode: reference });
        if (described !== undefined) for (const variable of typeVariables(described)) references.add(variable);
      }
      for (const child of ast.children(node)) if (child !== undefined) pending.push(child);
    }
    return [...variables].every(variable => references.has(variable)) ? variables : undefined;
  }

  function authoredBinding(callNode: Node | undefined, variables: ReadonlySet<Node>): ReadonlyMap<Node, AuthoredBinding> | undefined {
    if (variables.size === 0) return new Map();
    const query = callNode === undefined ? undefined : input.at(callNode);
    const call = callNode === undefined ? undefined : query?.call(callNode);
    if (query === undefined || callNode === undefined || call?.sourceSelectedSignatureKind !== "resolved") return undefined;
    const receiver = call.sourceReceiver ?? call.sourceCallee;
    const receiverBindings = query.typeArgumentBindings(receiver.type) ?? [];
    const receiverType = authoredValue(receiver.expression, query)?.type;
    const authoredReceiver = new Map<Node, SourceTypeDescriptor>();
    if (receiverType?.kind === "declared" && receiverBindings.length === receiverType.typeArguments.length) {
      receiverBindings.forEach((binding, index) => authoredReceiver.set(binding.declaration, receiverType.typeArguments[index]!));
    } else if (receiverType?.kind === "array" && receiverBindings.length === 1) {
      authoredReceiver.set(receiverBindings[0]!.declaration, receiverType.element);
    }
    const inherited = context.authoredInheritedBindings(receiver.type, query, authoredReceiver);
    const methodBindings = (call.sourceSelectedMethodTypeArguments ?? []).flatMap(argument => {
      const declaration = query.callTypeParameter(callNode, call, argument);
      return declaration === undefined ? [] : [{ declaration, argument }];
    });
    const checked = new Set([...receiverBindings.map(binding => binding.declaration), ...inherited.keys(), ...methodBindings.map(binding => binding.declaration)]);
    if ([...variables].some(variable => !checked.has(variable))) return undefined;
    const bound = new Map<Node, AuthoredBinding>();
    const conflicts = new Set<Node>();
    const bind = (declaration: Node, type: SourceTypeDescriptor, component?: SourceHostComponent): void => {
      if (!variables.has(declaration) || conflicts.has(declaration) || sourceTypeDescriptorHasTypeVariables(ast, type) &&
        authoredVariables(type, component) === undefined) return;
      const previous = bound.get(declaration);
      if (previous !== undefined && !sourceTypeDescriptorsEqual(previous.type, type)) {
        bound.delete(declaration);
        conflicts.add(declaration);
      } else bound.set(declaration, previous ?? { type, ...(component === undefined ? {} : { component }) });
    };
    const positions = (formal: SourceTypeDescriptor, actual: SourceTypeDescriptor, component?: SourceHostComponent): void => {
      if (formal.kind === "declared" && ast.is.IsTypeParameterDeclaration(formal.declaration)) {
        bind(formal.declaration, actual, component);
      } else if (formal.kind === "array" && actual.kind === "array") {
        const selectedType = component === undefined ? undefined : query.arrayElementType(component.selectedType);
        positions(formal.element, actual.element, selectedType === undefined ? undefined : { selectedType });
      } else if (formal.kind === "optional" && actual.kind === "optional") {
        const selectedType = component === undefined ? undefined : query.nonNullableType(component.selectedType);
        positions(formal.value, actual.value, selectedType === undefined ? undefined : { selectedType });
      }
      else if (formal.kind === "tuple" && actual.kind === "tuple" && formal.elements.length === actual.elements.length) {
        formal.elements.forEach((element, index) => {
          const selected = actual.elements[index];
          const selectedType = component === undefined ? undefined : query.tupleElements(component.selectedType)[index]?.type;
          if (selected?.kind === element.kind) positions(element.type, selected.type, selectedType === undefined ? undefined : { selectedType });
        });
      } else if (formal.kind === "declared" && actual.kind === "declared" && formal.declaration === actual.declaration &&
        formal.typeArguments.length === actual.typeArguments.length) {
        const application = component === undefined ? undefined : query.aliasApplication(component.selectedType);
        const arguments_ = application?.declaration === actual.declaration ? application.bindings.map(binding =>
          ({ declaration: binding.declaration, argumentType: binding.argument })) : component === undefined ? []
          : query.typeArgumentBindings(component.selectedType) ?? [];
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
    const declaration = query.callSignature(call);
    const selected = declaration === undefined ? undefined : component(declaration, query);
    const returned = selected === undefined ? undefined : context.describe(declaration!, selected);
    if (destination?.authority === "declared" && destination.type !== undefined && returned !== undefined) {
      positions(returned, destination.type, destination.component);
    }
    return [...variables].every(variable => bound.has(variable)) ? bound : undefined;
  }

  function selectSlot(node: Node, selected: SourceHostComponent | undefined,
    concrete = false, callNode?: Node, parameterIndex?: number): SourceTypeFlowDeclaredSlot | undefined {
    if (selected === undefined) return Object.freeze({ authority: "declared" });
    let parameterKind: SourceTypeDescriptorSignature["parameters"][number]["kind"] | undefined;
    if (parameterIndex !== undefined) {
      const query = input.at(node);
      const type = query.nonNullableType(selected.selectedType);
      if (type === undefined || query.signatures(type, "call").length !== 1) return undefined;
      const parameter = query.callable(type)?.parameters[parameterIndex];
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
    if (described !== undefined && concrete && sourceTypeDescriptorHasTypeVariables(ast, described)) {
      const retained = new Set<Node>();
      for (const binding of bindings?.values() ?? []) for (const variable of authoredVariables(binding.type, binding.component) ?? []) {
        retained.add(variable);
      }
      const variables = typeVariables(described);
      if (variables.size === 0 || [...variables].some(variable => !retained.has(variable))) return undefined;
    }
    const original = unbound === undefined ? undefined : structural(unbound);
    const origin = original?.kind === "declared" ? bindings?.get(original.declaration)?.component : undefined;
    const retained = origin === undefined ? selected : { ...origin,
      ...(selected.contextualCall === undefined ? {} : { contextualCall: selected.contextualCall }) };
    const projected = described === undefined ? undefined : parameterKind === "optional"
      ? sourceTypeDescriptorOptional(described) : described;
    return projected === undefined ? Object.freeze({ component: retained, authority: "declared" })
      : Object.freeze({ ...(parameterIndex === undefined ? slot(node, projected, "declared")
        : { type: projected, authority: "declared" as const }), component: retained });
  }


  function declaredCallable(node: Node, query: SourceHostQueries): {
    readonly type: Extract<SourceTypeDescriptor, { readonly kind: "callable" | "shape" }>;
    readonly signature: SourceTypeDescriptorSignature;
  } | undefined {
    const method = ast.is.IsMethodDeclaration(node);
    if (!method && (!(ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node)) ||
      !query.hasContextualType(node))) return undefined;
    const selected = method ? contextualMember(node, query) : read(node, query)?.type;
    const type = selected === undefined ? undefined : structural(selected);
    return (type?.kind === "callable" || type?.kind === "shape") && type.calls.length === 1
      ? { type, signature: type.calls[0]! } : undefined;
  }

  function contextualMember(node: Node, query: SourceHostQueries): SourceTypeDescriptor | undefined {
    const literal = ast.parent(node);
    if (literal === undefined || !ast.is.IsObjectLiteralExpression(literal)) return undefined;
    const slot = read(literal, query);
    if (slot?.authority !== "declared" || slot.type === undefined) return undefined;
    const selected = structural(slot.type);
    if (selected.kind !== "shape") return undefined;
    const element = query.objectLiteralElement(node);
    if (element === undefined || element.element !== node || element.objectLiteral !== literal || element.contextualType === undefined) return undefined;
    const origin = context.input.objectLiteralDestination(literal, node, {});
    if (origin?.kind !== "resolved") return undefined;
    const matches = selected.members.filter(member => sourceTypeDescriptorMemberOriginsEqual(member.origin, origin.origin));
    return matches?.length === 1 ? matches[0]!.type : undefined;
  }

  function parameter(node: Node, query: SourceHostQueries): SourceTypeDescriptor | undefined {
    if (!ast.is.IsParameterDeclaration(node) || ast.typeNode(node) !== undefined) return undefined;
    const owner = ast.parent(node);
    if (owner === undefined) return undefined;
    if (ast.is.IsSetAccessorDeclaration(owner)) return contextualMember(owner, query);
    const index = query.declarationSignature(owner)?.parameters
      .findIndex(parameter => parameter.declaration === node) ?? -1;
    if (index < 0) return undefined;
    if (ast.is.IsMethodDeclaration(owner)) {
      const type = contextualMember(owner, query);
      return type === undefined ? undefined : parameterValue(node, callableParameter(type, index), query);
    }
    if (!(ast.is.IsArrowFunction(owner) || ast.is.IsFunctionExpression(owner)) || !query.hasContextualType(owner) ||
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
      ? sourceTypeDescriptorUnion(context.unions, [parameter.type, { kind: "intrinsic", intrinsic: "absence" }]) : parameter?.type;
  }

  function parameterValue(node: Node, type: SourceTypeDescriptor | undefined, query: SourceHostQueries): SourceTypeDescriptor | undefined {
    const initializer = Node_Initializer(ast, node);
    if (type?.kind !== "optional" || initializer === undefined) return type;
    // A defaulted parameter is present in its body when neither its declared value nor its initializer can be absent.
    // Both answers are Host descriptors (R3): the declared slot value and the initializer description.
    void query;
    const initial = context.describe(initializer);
    const absent = (selected: SourceTypeDescriptor): boolean => {
      const structure = sourceTypeDescriptorStructure(selected);
      return structure.kind === "optional" || structure.kind === "intrinsic" &&
        ["any", "unknown", "absence", "void"].includes(structure.intrinsic) || structure.kind === "union" && structure.types.some(absent);
    };
    return initial !== undefined && !absent(type.value) && !absent(initial) ? type.value : type;
  }

  function returned(node: Node, query: SourceHostQueries): SourceTypeDescriptor | undefined {
    if (ast.is.IsGetAccessorDeclaration(node)) return contextualMember(node, query);
    if (ast.is.IsSetAccessorDeclaration(node)) return { kind: "intrinsic", intrinsic: "void" };
    const signature = declaredCallable(node, query);
    if (signature === undefined) return undefined;
    // An async callable returns the awaited payload of its destination signature's Host result (awaited.ts).
    const type = ast.hasModifierKind(node, "async")
      ? sourceTypeDescriptorAwaitedPayload(ast, context.unions, signature.signature.result) : signature.signature.result;
    const structure = type === undefined ? undefined : sourceTypeDescriptorStructure(type);
    return structure?.kind === "intrinsic" && ["unknown", "object", "any"].includes(structure.intrinsic) ? undefined : type;
  }

  // The authored payload argument of an async callable's return annotation (awaited.ts, the one awaited owner, R3).
  function awaited(selected: SourceHostComponent | undefined, query: SourceHostQueries): SourceHostComponent | undefined {
    const original = selected?.authoredTypeNode;
    const argument = original === undefined ? undefined : sourceTypeFlowAuthoredAwaitedArgument(ast, context.source.navigation, original);
    const selectedType = argument === undefined ? undefined : query.authoredType(argument);
    return selected === undefined || argument === undefined || selectedType === undefined ? undefined
      : { selectedType, ...(selected.declaration === undefined ? {} : { declaration: selected.declaration }), authoredTypeNode: argument };
  }

  function generatorReturnType(node: Node, generator: NonNullable<ReturnType<SourceHostQueries["generator"]>>,
    query: SourceHostQueries): SourceTypeDescriptor | undefined {
    const binding = generator.returnTypeBinding;
    const original = binding === undefined ? undefined : query.declaredType(binding.declaration);
    if (binding === undefined || original === undefined || !query.isIdentical(original, binding.parameterType)) return undefined;
    const selected = component(generator.declaration, query);
    let described = selected === undefined ? undefined : context.describe(node, selected);
    const bindings = new Map<Node, SourceTypeDescriptor>();
    const visited = new Set<SourceTypeDescriptor>();
    while (described?.kind === "declared" && !visited.has(described)) {
      visited.add(described);
      const parameters = ast.typeParameters(described.declaration);
      if (parameters.length !== described.typeArguments.length) return undefined;
      for (const [index, parameter] of parameters.entries()) {
        if (parameter === undefined) return undefined;
        const value = described.typeArguments[index]!;
        const previous = bindings.get(parameter);
        if (previous !== undefined && !sourceTypeDescriptorsEqual(previous, value)) return undefined;
        bindings.set(parameter, value);
      }
      const result = bindings.get(binding.declaration);
      if (result !== undefined) return result;
      described = described.definition;
    }
    return context.authoredInheritedBindings(generator.sourceReturnType, query, bindings).get(binding.declaration)?.value;
  }

  function read(node: Node, query: SourceHostQueries): SourceTypeFlowDeclaredSlot | undefined {
    const cached = cache.get(node);
    if (cached !== undefined) return cached ?? undefined;
    if (active.has(node)) return undefined;
    active.add(node);
    const result = classify(node, query);
    active.delete(node);
    cache.set(node, result ?? null);
    return result;
  }

  function classify(node: Node, query: SourceHostQueries, parameterIndex?: number): SourceTypeFlowDeclaredSlot | undefined {
    const select = (node: Node, selected: SourceHostComponent | undefined, concrete = false, callNode?: Node) =>
      selectSlot(node, selected, concrete, callNode, parameterIndex);
    const projected = (node: Node, type: SourceTypeDescriptor, authority: SourceTypeFlowDeclaredSlot["authority"]) => {
      let selected = parameterIndex === undefined ? type : callableParameter(type, parameterIndex);
      if (selected?.kind === "declared" && selected.cut === "recursion" && ast.is.IsTypeAliasDeclaration(selected.declaration)) {
        const reference = selected;
        const declaration = selected.declaration;
        const parameters = ast.typeParameters(declaration);
        const selectedType = query.declaredType(declaration);
        if (selectedType === undefined || parameters.length !== selected.typeArguments.length || parameters.some(parameter => parameter === undefined)) return undefined;
        const arguments_ = parameters.map((parameter, index) => ({ declaration: parameter!, type: reference.typeArguments[index]! }));
        selected = context.describe(declaration, { selectedType, declaration }, arguments_);
      }
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
      const propertyAccess = ast.is.IsPropertyAccessExpression(left) ? query.propertyAccess(left) : undefined;
      const access = propertyAccess ?? (ast.is.IsElementAccessExpression(left) ? query.elementAccess(left) : undefined);
      if (access === undefined) return undefined;
      const declaration = propertyAccess?.selectedWriteDeclaration ?? access.selectedDeclaration;
      if (declaration !== undefined && ast.is.IsSetAccessorDeclaration(declaration)) {
        const parameters = ast.parameters(declaration);
        return parameters.length !== 1 || parameters[0] === undefined ? undefined : select(node, component(parameters[0], query));
      }
      const property = query.properties(access.receiver.type).find(property => property.symbol === access.selectedSymbol);
      const origin = property === undefined ? undefined : query.memberOrigin(property, access.receiver.type);
      const receiver = context.describe(access.receiver.expression);
      const shape = receiver === undefined ? undefined : structural(receiver);
      if (origin?.kind !== "resolved" || shape?.kind !== "shape") return undefined;
      const members = shape.members.filter(member => sourceTypeDescriptorMemberOriginsEqual(member.origin, origin.origin));
      const member = members.length === 1 ? members[0] : undefined;
      return member === undefined ? undefined : projected(node,
        member.optional ? sourceTypeDescriptorOptional(member.type) : member.type, "declared");
    }
    if ((ast.is.IsVariableDeclaration(parent) || ast.is.IsParameterDeclaration(parent) || ast.is.IsPropertyDeclaration(parent)) &&
      Node_Initializer(ast, parent) === occurrence) {
      const name = ast.name(parent);
      if (name !== undefined && (ast.is.IsArrayBindingPattern(name) || ast.is.IsObjectBindingPattern(name)) &&
        ast.typeNode(parent) === undefined) return Object.freeze({ authority: "inferred" });
      if (ast.typeNode(parent) === undefined) {
        let owner = ast.parent(parent);
        // A local of an execution (a callable body or a class static block, E13 execution-barrier; F2-1).
        while (owner !== undefined && !sourceNodeHasRole(ast, owner, "execution-barrier") && !ast.is.IsSourceFile(owner)) owner = ast.parent(owner);
        const local = owner !== undefined && sourceNodeHasRole(ast, owner, "execution-barrier") && ast.is.IsVariableDeclaration(parent) &&
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
      while (owner !== undefined && !sourceNodeHasRole(ast, owner, "callable-body")) owner = ast.parent(owner);
      if (owner === undefined) return undefined;
      const generator = query.generator(owner);
      if (generator?.declaration === owner) {
        const type = generatorReturnType(node, generator, query);
        return type === undefined ? undefined : projected(node, type, "declared");
      }
      if (ast.typeNode(owner) === undefined) {
        const type = returned(owner, query);
        return type === undefined ? undefined : projected(node, type, "declared");
      }
      const declared = component(owner, query);
      return select(node, ast.hasModifierKind(owner, "async") ? awaited(declared, query) : declared);
    }
    if (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) {
      const call = query.call(parent);
      if (call?.sourceSelectedSignatureKind !== "resolved") return undefined;
      const index = call.sourceArguments.findIndex(argument => argument.expression === occurrence);
      if (index < 0) return undefined;
      const bindings = call.sourceArgumentBindings.filter(binding => binding.sourceArgumentIndex === index);
      if (bindings.length !== 1) return undefined;
      const binding = bindings[0]!;
      const parameter = call.sourceSelectedSignatureParameters[binding.sourceParameterIndex];
      const declared = parameter?.parameterDeclaration === undefined ? undefined : component(parameter.parameterDeclaration, query);
      if (declared === undefined) return undefined;
      if (binding.sourceParameterForm === "rest-element") {
        const complete = selectSlot(parameter!.parameterDeclaration!, { ...declared, contextualCall: call }, true, parent);
        const structure = complete?.type === undefined ? undefined : sourceTypeDescriptorStructure(complete.type);
        const element = structure?.kind === "array" ? structure.element : structure?.kind === "tuple"
          ? sourceTypeDescriptorTupleValue(structure, binding.effectiveArgumentIndex - binding.sourceParameterIndex) : undefined;
        return element === undefined ? undefined : projected(node, element, "declared");
      }
      return select(node, { ...declared, contextualCall: call }, true, parent);
    }
    if (ast.is.IsPropertyAssignment(parent) && Node_Initializer(ast, parent) === occurrence) {
      const literal = ast.parent(parent);
      const enclosing = literal !== undefined && ast.is.IsObjectLiteralExpression(literal) ? read(literal, query) : undefined;
      if (enclosing === undefined) return undefined;
      const name = ast.name(parent);
      const selected = name === undefined ? undefined : query.propertyName(name);
      if (selected?.kind !== "resolved") return Object.freeze({ authority: enclosing.authority });
      const described = enclosing.type === undefined ? undefined : structural(enclosing.type);
      const shape = described?.kind === "shape" ? described : undefined;
      const numeric = selected.constant.kind === "numeric";
      const index = shape?.indexes.find(index => numeric && index.key.kind === "primitive" && index.key.primitive === "float64") ??
        shape?.indexes.find(index => index.key.kind === "string");
      const member = shape?.members.find(member => member.name === selected.name);
      const memberType = member?.type ?? index?.value;
      if (memberType === undefined) return Object.freeze({ authority: enclosing.authority });
      const result = projected(node, memberType, enclosing.authority);
      const declaration = member?.origin.kind === "declared" ? member.origin.declaration : index?.declaration;
      const retained = declaration === undefined ? undefined : component(declaration, query);
      return result === undefined || retained === undefined ? result : Object.freeze({ ...result, component: retained });
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

  return Object.freeze({ get: (node: Node) => read(node, input.at(node)), authoredBinding,
    annotation(node: Node): SourceTypeDescriptor | undefined {
      const selected = component(node, input.at(node));
      return selected === undefined ? undefined : context.describe(node, selected);
    },
    callable: declaredCallable, parameter, returned, retainFixedConstruction(node: Node, type: SourceTypeDescriptor,
    component?: SourceHostComponent): void {
    if (read(node, input.at(node)) !== undefined) return;
    cache.set(node, Object.freeze({ type, authority: "inferred", ...(component === undefined ? {} : { component }) }));
  } });
}
