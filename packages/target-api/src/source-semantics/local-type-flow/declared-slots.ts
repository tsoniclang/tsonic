import type { Node } from "@tsonic/tsts";
import { sourceTypeFlowConstructionSlot } from "./construction-slots.js";
import { Node_Expression, Node_Initializer } from "../../source-navigation/ast.js";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "../types.js";
import { sourceObjectLiteralDestinationMember } from "../object-literal-correspondence.js";
import { sourceTypeDescriptorMemberOrigin, sourceTypeDescriptorMemberOriginsEqual } from "./member-origins.js";
import { sourceTypeDescriptorHasTypeVariables, sourceTypeDescriptorStructure, sourceTypeDescriptorTupleValue } from "./terms.js";
import type { SourceTypeDescriptor, SourceTypeDescriptorSignature, SourceTypeFlowAnalysisContext, SourceTypeFlowRefusal } from "./types.js";

export interface SourceTypeFlowDeclaredSlot {
  readonly authority: "declared" | "inferred";
  readonly component?: SourceTypeComponentEvidence;
  readonly type?: SourceTypeDescriptor;
  readonly refusal?: SourceTypeFlowRefusal;
}

export function createSourceTypeFlowDeclaredSlotReader(context: SourceTypeFlowAnalysisContext) {
  const { ast, semantics, navigation } = context.source;
  const cache = new WeakMap<Node, SourceTypeFlowDeclaredSlot | null>();
  const active = new Set<Node>();

  function callable(node: Node): boolean {
    return ast.is.IsFunctionDeclaration(node) || ast.is.IsFunctionExpression(node) || ast.is.IsArrowFunction(node) ||
      ast.is.IsMethodDeclaration(node) || ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node);
  }

  function component(owner: Node, query: SourceFileSemantics): SourceTypeComponentEvidence | undefined {
    const authoredTypeNode = ast.typeNode(owner);
    const selectedType = authoredTypeNode === undefined ? undefined : query.types.authoredType(authoredTypeNode);
    return selectedType === undefined ? undefined : { selectedType, declaration: owner, authoredTypeNode };
  }

  function projected(node: Node, type: SourceTypeDescriptor, authority: SourceTypeFlowDeclaredSlot["authority"]): SourceTypeFlowDeclaredSlot {
    return sourceTypeFlowConstructionSlot(ast, node, type, authority);
  }

  function structural(type: SourceTypeDescriptor): SourceTypeDescriptor {
    let selected = type;
    while (selected.kind === "optional" || selected.kind === "declared" && selected.definition !== undefined) {
      selected = selected.kind === "optional" ? selected.value : sourceTypeDescriptorStructure(selected);
    }
    return selected;
  }

  function select(node: Node, selected: SourceTypeComponentEvidence | undefined,
    concrete = false): SourceTypeFlowDeclaredSlot | undefined {
    if (selected === undefined) return Object.freeze({ authority: "declared" });
    const formal = concrete && selected.contextualCall !== undefined ? {
      selectedType: selected.selectedType,
      ...(selected.declaration === undefined ? {} : { declaration: selected.declaration }),
      ...(selected.authoredTypeNode === undefined ? {} : { authoredTypeNode: selected.authoredTypeNode }),
    } : selected;
    const unbound = context.describe(node, formal);
    if (unbound !== undefined && concrete && sourceTypeDescriptorHasTypeVariables(ast, unbound)) return undefined;
    const described = formal === selected ? unbound : context.describe(node, selected);
    return described === undefined ? Object.freeze({ component: selected, authority: "declared" })
      : Object.freeze({ ...projected(node, described, "declared"), component: selected });
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
    const signature = declaredCallable(owner, query);
    if (signature === undefined) return undefined;
    const index = query.types.declarationSignatureInfo(owner)?.parameters
      .findIndex(parameter => parameter.declaration === node) ?? -1;
    return index < 0 ? undefined : signature.signature.parameters[index]?.type;
  }

  function returned(node: Node, query: SourceFileSemantics): SourceTypeDescriptor | undefined {
    if (ast.is.IsGetAccessorDeclaration(node)) return contextualMember(node, query);
    if (ast.is.IsSetAccessorDeclaration(node)) return { kind: "intrinsic", intrinsic: "void" };
    const signature = declaredCallable(node, query);
    if (signature === undefined) return undefined;
    if (!ast.hasModifierKind(node, "async")) return signature.signature.result;
    if (signature.signature.declaration === undefined) return undefined;
    const selected = awaited(component(signature.signature.declaration, query), query);
    return selected === undefined ? undefined : context.describe(node, selected);
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

  function classify(node: Node, query: SourceFileSemantics): SourceTypeFlowDeclaredSlot | undefined {
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
      } else if (ast.is.IsBinaryExpression(parent) && ast.operatorKindName(parent) === "KindQuestionQuestionToken" &&
        (ast.as.AsBinaryExpression(parent)?.Left === occurrence || ast.as.AsBinaryExpression(parent)?.Right === occurrence)) {
        occurrence = parent;
      } else break;
      parent = ast.parent(occurrence);
    }
    if (parent === undefined) return undefined;
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
        return type === undefined ? Object.freeze({ authority: "inferred" }) : Object.freeze({ type, authority: "inferred" });
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
      return select(node, { ...declared, contextualCall: call }, true);
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

  return Object.freeze({ get: (node: Node) => read(node, semantics.forNode(node)),
    callable: declaredCallable, parameter, returned, retainFixedConstruction(node: Node, type: SourceTypeDescriptor,
    component?: SourceTypeComponentEvidence): void {
    if (read(node, semantics.forNode(node)) !== undefined) return;
    cache.set(node, Object.freeze({ type, authority: "inferred", ...(component === undefined ? {} : { component }) }));
  } });
}
