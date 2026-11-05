import type { Node, Type } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer } from "../../source-navigation/ast.js";
import { selectSourcePropertyDeclaration, selectedSourcePropertyDeclarations } from "../selected-property-declarations.js";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "../types.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import type { SourceTypeDescriptor, SourceTypeFlowAnalysisContext, SourceTypeFlowRefusal } from "./types.js";

export interface SourceTypeFlowDeclaredSlot {
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

  function syntaxFor(selected: Type, original: Node | undefined, query: SourceFileSemantics): Node | undefined {
    const pending = original === undefined ? [] : [original];
    const seen = new Set<Node>();
    while (pending.length > 0) {
      const node = pending.shift()!;
      if (seen.has(node)) continue;
      seen.add(node);
      const type = query.types.authoredType(node);
      if (type !== undefined && query.types.isIdentical(type, selected)) return node;
      if (ast.is.IsUnionTypeNode(node) || ast.is.IsParenthesizedTypeNode(node)) {
        for (const child of ast.children(node)) if (child !== undefined) pending.push(child);
      } else if (ast.is.IsTypeReferenceNode(node)) {
        const declaration = navigation.sourceReferenceFor(ast.as.AsTypeReferenceNode(node)?.TypeName)?.declaration;
        const body = declaration !== undefined && ast.is.IsTypeAliasDeclaration(declaration) ? ast.typeNode(declaration) : undefined;
        if (body !== undefined) pending.push(body);
      }
    }
    return undefined;
  }

  function matches(node: Node, selected: Type, query: SourceFileSemantics): boolean {
    if (query.types.isAny(selected) || query.types.isUnknown(selected) || query.types.isNonPrimitive(selected)) return true;
    if (ast.is.IsArrayLiteralExpression(node)) return query.types.isArrayLike(selected) || query.types.isTuple(selected);
    if (ast.is.IsObjectLiteralExpression(node)) return !query.types.isArrayLike(selected) && !query.types.isTuple(selected) &&
      !query.types.isNumberLike(selected) && !query.types.isStringLike(selected) && !query.types.isBooleanLike(selected) &&
      !query.types.isBigIntLike(selected) && !query.types.isNullish(selected) && !query.types.isVoidLike(selected);
    return false;
  }

  function projected(node: Node, type: SourceTypeDescriptor, query: SourceFileSemantics): SourceTypeFlowDeclaredSlot {
    if (type.kind !== "union" || !(ast.is.IsArrayLiteralExpression(node) || ast.is.IsObjectLiteralExpression(node))) return Object.freeze({ type });
    const candidates = type.types.filter(type => descriptorMatches(node, type, query));
    return candidates.length === 1 ? Object.freeze({ type: candidates[0]! })
      : Object.freeze({ refusal: createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNION", node) });
  }

  function select(node: Node, selected: SourceTypeComponentEvidence | undefined,
    query: SourceFileSemantics): SourceTypeFlowDeclaredSlot {
    if (selected === undefined) return Object.freeze({});
    const described = context.describe(node, selected);
    if (!(ast.is.IsArrayLiteralExpression(node) || ast.is.IsObjectLiteralExpression(node))) {
      return Object.freeze({ component: selected, ...(described === undefined ? {} : { type: described }) });
    }
    if (described?.kind === "union") {
      const chosen = projected(node, described, query);
      if (chosen.refusal !== undefined) return chosen;
      if (!query.types.isUnion(selected.selectedType)) return Object.freeze({ ...chosen, component: selected });
    }
    if (!query.types.isUnion(selected.selectedType) || query.types.isBooleanLike(selected.selectedType)) {
      const type = context.describe(node, selected);
      return Object.freeze({ component: Object.freeze(selected), ...(type === undefined ? {} : { type }) });
    }
    const candidates = query.types.unionOrIntersectionTypes(selected.selectedType).filter(type => matches(node, type, query));
    if (candidates.length !== 1) return Object.freeze({ refusal: createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNION", node) });
    const selectedType = candidates[0]!;
    const authoredTypeNode = syntaxFor(selectedType, selected.authoredTypeNode, query);
    const selectedComponent = Object.freeze({ selectedType,
      ...(selected.declaration === undefined ? {} : { declaration: selected.declaration }),
      ...(selected.contextualCall === undefined ? {} : { contextualCall: selected.contextualCall }),
      ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }) });
    const type = context.describe(node, selectedComponent);
    return Object.freeze({ component: selectedComponent, ...(type === undefined ? {} : { type }) });
  }

  function descriptorMatches(node: Node, type: SourceTypeDescriptor, query: SourceFileSemantics): boolean {
    if (type.kind === "optional") return descriptorMatches(node, type.value, query);
    if (type.kind === "declared" && type.source !== undefined) return matches(node, type.source.selectedType, query);
    if (type.kind === "intrinsic") return type.intrinsic === "object" || type.intrinsic === "unknown" || type.intrinsic === "any";
    if (ast.is.IsArrayLiteralExpression(node)) return type.kind === "array" || type.kind === "tuple";
    if (ast.is.IsObjectLiteralExpression(node)) return type.kind === "shape";
    return false;
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

  function read(node: Node): SourceTypeFlowDeclaredSlot | undefined {
    const cached = cache.get(node);
    if (cached !== undefined) return cached ?? undefined;
    if (active.has(node)) return undefined;
    active.add(node);
    const result = classify(node);
    active.delete(node);
    cache.set(node, result ?? null);
    return result;
  }

  function classify(node: Node): SourceTypeFlowDeclaredSlot | undefined {
    const query = semantics.forNode(node);
    let occurrence = node;
    let parent = ast.parent(occurrence);
    while (parent !== undefined) {
      if (ast.is.IsParenthesizedExpression(parent) && Node_Expression(ast, parent) === occurrence) {
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
      if (name !== undefined && (ast.is.IsArrayBindingPattern(name) || ast.is.IsObjectBindingPattern(name))) return Object.freeze({});
      if (ast.typeNode(parent) === undefined) {
        let owner = ast.parent(parent);
        while (owner !== undefined && !callable(owner) && !ast.is.IsSourceFile(owner)) owner = ast.parent(owner);
        const local = owner !== undefined && callable(owner) && ast.is.IsVariableDeclaration(parent) &&
          (ast.variableDeclarationKind(parent) === "const" || ast.variableDeclarationKind(parent) === "let") &&
          !navigation.declarationUseSummary(parent).exported;
        if (local) return undefined;
        const type = context.describe(parent);
        return type === undefined ? Object.freeze({}) : Object.freeze({ type });
      }
      return select(node, component(parent, query), query);
    }
    if ((ast.is.IsAsExpression(parent) || ast.is.IsSatisfiesExpression(parent) || ast.is.IsTypeAssertion(parent)) &&
      Node_Expression(ast, parent) === occurrence && !ast.isConstAssertion(parent)) {
      const selected = component(parent, query);
      if (selected !== undefined && query.types.couldContainTypeVariables(selected.selectedType)) return undefined;
      return select(node, selected, query);
    }
    if (ast.is.IsReturnStatement(parent) && Node_Expression(ast, parent) === occurrence ||
      ast.is.IsArrowFunction(parent) && ast.body(parent) === occurrence) {
      let owner: Node | undefined = ast.is.IsArrowFunction(parent) ? parent : ast.parent(parent);
      while (owner !== undefined && !callable(owner)) owner = ast.parent(owner);
      if (owner === undefined || ast.typeNode(owner) === undefined) return undefined;
      const declared = component(owner, query);
      return select(node, ast.hasModifierKind(owner, "async") ? awaited(declared, query) : declared, query);
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
      if (declared === undefined || query.types.couldContainTypeVariables(declared.selectedType)) return undefined;
      return select(node, { ...declared, contextualCall: call }, query);
    }
    if (ast.is.IsPropertyAssignment(parent) && Node_Initializer(ast, parent) === occurrence) {
      const literal = ast.parent(parent);
      const enclosing = literal !== undefined && ast.is.IsObjectLiteralExpression(literal) ? read(literal) : undefined;
      if (enclosing === undefined) return undefined;
      const name = ast.name(parent);
      const selected = name === undefined ? undefined : query.propertyNames.get(name);
      if (selected?.kind !== "resolved") return Object.freeze({});
      const shape = enclosing.type?.kind === "shape" || enclosing.type?.kind === "declared" ? enclosing.type : undefined;
      const numeric = selected.constant.kind === "numeric";
      const index = shape?.indexes.find(index => numeric && index.key.kind === "primitive" && index.key.primitive === "float64") ??
        shape?.indexes.find(index => index.key.kind === "string");
      const memberType = shape?.members?.find(member => member.name === selected.name)?.type ?? index?.value;
      if (enclosing.component === undefined) return memberType === undefined ? Object.freeze({}) : projected(node, memberType, query);
      const property = query.types.propertyInfos(enclosing.component.selectedType).find(property => property.name === selected.name);
      if (property === undefined) return memberType === undefined ? Object.freeze({}) : projected(node, memberType, query);
      const declarations = selectedSourcePropertyDeclarations(query, undefined, property.symbol, [enclosing.component!.selectedType]);
      const declaration = declarations === undefined ? undefined : selectSourcePropertyDeclaration(ast, declarations, "read");
      const slot = select(node, { selectedType: property.type, ...(declaration === undefined ? {} : {
        declaration, ...(ast.typeNode(declaration) === undefined ? {} : { authoredTypeNode: ast.typeNode(declaration) }),
      }) }, query);
      return memberType === undefined ? slot : Object.freeze({ ...slot, ...projected(node, memberType, query) });
    }
    if (ast.is.IsArrayLiteralExpression(parent)) {
      const enclosing = read(parent);
      if (enclosing === undefined) return undefined;
      const position = ast.elements(parent).indexOf(occurrence);
      const elementType = enclosing.type?.kind === "array" ? enclosing.type.element
        : enclosing.type?.kind === "tuple" ? enclosing.type.elements[position] : undefined;
      if (enclosing.component === undefined) return elementType === undefined ? Object.freeze({}) : projected(node, elementType, query);
      const selectedType = enclosing.component.selectedType;
      const index = ast.elements(parent).indexOf(occurrence);
      const element = query.types.isTuple(selectedType) ? query.types.tupleElementInfos(selectedType)[index] : undefined;
      const type = element?.type ?? query.types.typeArguments(selectedType)[0] ?? query.types.indexInfos(selectedType)[0]?.valueType;
      if (type === undefined) return Object.freeze({});
      const declaration = element?.declaration;
      const slot = select(node, { selectedType: type, ...(declaration === undefined ? {} : { declaration,
        ...(ast.typeNode(declaration) === undefined ? {} : { authoredTypeNode: ast.typeNode(declaration) }) }) }, query);
      return elementType === undefined ? slot : Object.freeze({ ...slot, ...projected(node, elementType, query) });
    }
    return undefined;
  }

  return Object.freeze({ get: read, retainFixedConstruction(node: Node, type: SourceTypeDescriptor,
    component?: SourceTypeComponentEvidence): void {
    if (read(node) !== undefined) return;
    cache.set(node, Object.freeze({ type, ...(component === undefined ? {} : { component }) }));
  } });
}
