import { sourcePrimitiveFactKey, type ExtensionFactSubject, type Node, type SourcePrimitiveKind, type Type } from "@tsonic/tsts";
import { sourceArrayElementType } from "../array-types.js";
import { analyzeSourceLiteralValues } from "../literal-values.js";
import type { SourceLiteralValue } from "../literal-values-model.js";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "../types.js";
import { freezeSourceTypeDescriptor, sourceTypeDescriptorsEqual } from "./terms.js";
import type {
  SourceTypeDescriptor, SourceTypeDescriptorMember, SourceTypeFlowAnalysisContext,
  SourceTypeFlowFixedRule, SourceTypeFlowSource,
} from "./types.js";

export interface SourceTypeFlowDefaults {
  readonly context: SourceTypeFlowAnalysisContext;
  readonly nodes: readonly Node[];
  fixedRule(node: Node): SourceTypeFlowFixedRule | undefined;
  hasDeclaredSourceType(node: Node): boolean;
}

export function createSourceTypeFlowAnalysisContext(source: SourceTypeFlowSource): SourceTypeFlowDefaults {
  const { ast, semantics, navigation, sourceFacts } = source;
  const literals = analyzeSourceLiteralValues(ast, source.sourceFiles).literalValue;
  const nodes: Node[] = [];
  const ordinals = new WeakMap<Node, number>();
  const counters = new WeakMap<Node, SourceTypeFlowFixedRule>();
  const pending: Node[] = [];
  for (let index = source.sourceFiles.length - 1; index >= 0; index -= 1) {
    const file = source.sourceFiles[index]!;
    if (!ast.isDeclarationFile(file)) pending.push(file);
  }
  while (pending.length > 0) {
    const node = pending.pop()!;
    ordinals.set(node, nodes.length);
    nodes.push(node);
    const children = ast.children(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child !== undefined) pending.push(child);
    }
  }
  const cache = new WeakMap<Node, SourceTypeDescriptor>();
  const active = new Set<Node>();

  function primitive(subjects: readonly ExtensionFactSubject[]): SourceTypeDescriptor | undefined {
    for (const subject of subjects) {
      const fact = sourceFacts.getFact(subject, sourcePrimitiveFactKey);
      if (fact !== undefined) return { kind: "primitive", primitive: fact.kind };
    }
    return undefined;
  }

  function declarationFor(node: Node): Node | undefined {
    if (ast.is.IsPropertyAccessExpression(node)) {
      const access = semantics.forNode(node).operations.propertyAccess(node);
      const declaration = access?.selectedReadDeclaration ?? access?.selectedDeclaration;
      return declaration !== undefined && ast.is.IsMethodDeclaration(declaration) ? undefined : declaration;
    }
    if (ast.is.IsElementAccessExpression(node)) return semantics.forNode(node).operations.elementAccess(node)?.selectedDeclaration;
    const declaration = navigation.sourceReferenceFor(node)?.declaration;
    if (declaration !== undefined && (ast.is.IsFunctionDeclaration(declaration) || ast.is.IsMethodDeclaration(declaration))) return undefined;
    return declaration ??
      (ast.is.IsVariableDeclaration(node) || ast.is.IsParameterDeclaration(node) ||
        ast.is.IsPropertyDeclaration(node) || ast.is.IsPropertySignatureDeclaration(node) ? node : undefined);
  }

  function fixedRule(node: Node): SourceTypeFlowFixedRule | undefined {
    const declaration = declarationFor(node);
    if (declaration === undefined || !ast.is.IsVariableDeclaration(declaration)) return undefined;
    if (ast.typeNode(declaration) !== undefined) return undefined;
    const existing = counters.get(declaration);
    if (existing !== undefined) return existing;
    const list = ast.parent(declaration);
    const loop = list === undefined ? undefined : ast.parent(list);
    if (loop === undefined || !ast.is.IsForStatement(loop) ||
      ast.as.AsForStatement(loop)?.Initializer !== list) return undefined;
    const initializer = ast.as.AsVariableDeclaration(declaration)?.Initializer;
    if (initializer === undefined || literals.get(initializer)?.integer === undefined) return undefined;
    const rule: SourceTypeFlowFixedRule = Object.freeze({ kind: "loop-counter", declaration });
    counters.set(declaration, rule);
    return rule;
  }

  function initializerOf(node: Node): Node | undefined {
    if (ast.is.IsVariableDeclaration(node)) return ast.as.AsVariableDeclaration(node)?.Initializer;
    if (ast.is.IsParameterDeclaration(node)) return ast.as.AsParameterDeclaration(node)?.Initializer;
    if (ast.is.IsPropertyDeclaration(node)) return ast.as.AsPropertyDeclaration(node)?.Initializer;
    if (ast.is.IsPropertyAssignment(node)) return ast.as.AsPropertyAssignment(node)?.Initializer;
    return undefined;
  }

  function describeSyntax(node: Node, queries: SourceFileSemantics, depth: number): SourceTypeDescriptor | undefined {
    if (depth > 4) return undefined;
    const direct = primitive([node]);
    if (direct !== undefined) return direct;
    const parenthesized = ast.is.IsParenthesizedTypeNode(node) ? ast.as.AsParenthesizedTypeNode(node)?.Type : undefined;
    if (parenthesized !== undefined) return describeSyntax(parenthesized, queries, depth);
    const array = ast.is.IsArrayTypeNode(node) ? ast.as.AsArrayTypeNode(node)?.ElementType : undefined;
    if (array !== undefined) {
      const element = describeSyntax(array, queries, depth + 1);
      return element === undefined ? undefined : { kind: "array", readonly: false, element };
    }
    const operated = ast.is.IsTypeOperatorNode(node) ? ast.as.AsTypeOperatorNode(node)?.Type : undefined;
    if (operated !== undefined && ast.operatorKindName(node) === "KindReadonlyKeyword") {
      const value = describeSyntax(operated, queries, depth);
      return value?.kind === "array" || value?.kind === "tuple" ? { ...value, readonly: true } : value;
    }
    const tuple = ast.is.IsTupleTypeNode(node) ? ast.as.AsTupleTypeNode(node) : undefined;
    if (tuple !== undefined) {
      const elements = ast.elements(node);
      if (elements.length !== 2 || elements[0] === undefined || elements[1] === undefined) return undefined;
      const first = describeSyntax(ast.is.IsNamedTupleMember(elements[0]) ? ast.as.AsNamedTupleMember(elements[0])!.Type! : elements[0], queries, depth + 1);
      const second = describeSyntax(ast.is.IsNamedTupleMember(elements[1]) ? ast.as.AsNamedTupleMember(elements[1])!.Type! : elements[1], queries, depth + 1);
      return first === undefined || second === undefined ? undefined
        : { kind: "tuple", readonly: false, elements: [first, second] };
    }
    if (ast.is.IsUnionTypeNode(node)) {
      const members = ast.children(node).filter((child): child is Node => child !== undefined);
      const present = members.filter(child => {
        const type = queries.types.authoredType(child);
        return type !== undefined && !queries.types.isNullish(type);
      });
      if (present.length !== 1 || present.length === members.length) return undefined;
      const value = describeSyntax(present[0]!, queries, depth + 1);
      return value === undefined ? undefined : { kind: "optional", value };
    }
    if (ast.is.IsImportTypeNode(node) && ast.typeArguments(node).length === 0) {
      const importedPrimitive = primitive(queries.facts.authoredTypeSubjects(node));
      if (importedPrimitive !== undefined) return importedPrimitive;
    }
    const type = queries.types.authoredType(node);
    if (type === undefined) return undefined;
    const referenceName = ast.is.IsTypeReferenceNode(node) ? ast.as.AsTypeReferenceNode(node)?.TypeName
      : ast.is.IsImportTypeNode(node) ? ast.as.AsImportTypeNode(node)?.Qualifier : undefined;
    if (referenceName !== undefined) {
      const symbol = queries.declarations.typeAliasSymbol(type) ?? queries.declarations.typeSymbol(type);
      const declaration = navigation.sourceReferenceFor(referenceName)?.declaration ??
        (symbol === undefined ? undefined : queries.declarations.primarySymbolDeclaration(symbol));
      if (declaration !== undefined) {
        const declaredPrimitive = primitive([declaration, ...queries.facts.selectedSubjects(undefined, declaration)]);
        if (declaredPrimitive !== undefined) return declaredPrimitive;
      }
      if (declaration !== undefined && ast.is.IsTypeAliasDeclaration(declaration) && ast.typeParameters(declaration).length === 0) {
        const body = ast.as.AsTypeAliasDeclaration(declaration)?.Type;
        if (body !== undefined && body !== node && !active.has(declaration)) {
          active.add(declaration);
          const result = describeSyntax(body, queries, depth);
          active.delete(declaration);
          if (result !== undefined) return result;
        }
      }
      const arguments_ = ast.typeArguments(node);
      if (declaration !== undefined && !ast.is.IsTypeAliasDeclaration(declaration) && arguments_.length > 0) {
        const values: SourceTypeDescriptor[] = [];
        for (const argument of arguments_) {
          const value = argument === undefined ? undefined : describeSyntax(argument, queries, depth + 1);
          if (value === undefined) return undefined;
          values.push(value);
        }
        if (queries.types.isArrayLike(type) && values.length === 1) {
          return { kind: "array", readonly: queries.types.indexInfos(type).some(info => info.readonly), element: values[0]! };
        }
        return { kind: "declared", declaration, typeArguments: values,
          source: Object.freeze({ selectedType: type, declaration, authoredTypeNode: node }) };
      }
    }
    return describeType(type, queries, { selectedType: type, authoredTypeNode: node }, depth, true);
  }

  function describeType(type: Type, queries: SourceFileSemantics, component: SourceTypeComponentEvidence,
    depth: number, declared: boolean): SourceTypeDescriptor | undefined {
    if (depth > 4 || queries.types.isAny(type) || queries.types.isUnknown(type) || queries.types.isNonPrimitive(type) ||
      queries.types.isNever(type) || queries.types.isIntersection(type)) return undefined;
    const direct = primitive(queries.facts.typeSubjects(type));
    if (direct !== undefined) return direct;
    if (queries.types.isBooleanLike(type)) return { kind: "primitive", primitive: "bool" };
    if (queries.types.isUnion(type)) {
      const parts = queries.types.unionOrIntersectionTypes(type);
      const present = parts.filter(part => !queries.types.isNullish(part));
      if (declared && present.length === 1 && present.length < parts.length) {
        const value = describeType(present[0]!, queries, { ...component, selectedType: present[0]! }, depth + 1, true);
        return value === undefined ? undefined : { kind: "optional", value };
      }
      return undefined;
    }
    if (queries.types.isNumberLike(type)) return { kind: "primitive", primitive: "float64" };
    if (queries.types.isStringLike(type)) return { kind: "string" };
    if (queries.types.isBigIntLike(type) || queries.types.isVoidLike(type) || queries.types.isNullish(type)) return undefined;
    if (queries.types.isTuple(type)) {
      const elements = queries.types.tupleElementInfos(type);
      if (elements.length !== 2) return undefined;
      const values = elements.map(element => {
        const syntax = element.declaration === undefined ? undefined : ast.typeNode(element.declaration);
        return syntax === undefined ? describeType(element.type, queries, { selectedType: element.type }, depth + 1, declared)
          : describeSyntax(syntax, queries, depth + 1);
      });
      return values[0] === undefined || values[1] === undefined ? undefined
        : { kind: "tuple", readonly: queries.types.indexInfos(type).some(info => info.readonly), elements: [values[0], values[1]] };
    }
    const elementType = sourceArrayElementType(type, queries);
    if (elementType !== undefined) {
      const element = describeType(elementType, queries, { selectedType: elementType }, depth + 1, declared);
      return element === undefined ? undefined
        : { kind: "array", readonly: queries.types.indexInfos(type).some(info => info.readonly), element };
    }
    const symbol = queries.declarations.typeSymbol(type);
    const declaration = symbol === undefined ? undefined : queries.declarations.primarySymbolDeclaration(symbol);
    if (declaration !== undefined && (ast.is.IsClassDeclaration(declaration) || ast.is.IsInterfaceDeclaration(declaration) ||
      ast.is.IsEnumDeclaration(declaration) || ast.is.IsTypeParameterDeclaration(declaration))) {
      const values: SourceTypeDescriptor[] = [];
      const bindings = queries.types.typeArgumentBindings(type);
      for (const argument of bindings?.map(binding => binding.argumentType) ?? queries.types.typeArguments(type)) {
        const value = describeType(argument, queries, { selectedType: argument }, depth + 1, declared);
        if (value === undefined) return undefined;
        values.push(value);
      }
      return { kind: "declared", declaration, typeArguments: values, source: component };
    }
    if (queries.types.callSignatures(type).length > 0 || queries.types.constructSignatures(type).length > 0) return undefined;
    if (queries.types.indexInfos(type).length > 0) return undefined;
    const members: SourceTypeDescriptorMember[] = [];
    for (const property of queries.types.propertyInfos(type)) {
      const selected = queries.declarations.primarySymbolDeclaration(property.symbol);
      if (selected === undefined || ast.is.IsMethodDeclaration(selected) || ast.is.IsMethodSignatureDeclaration(selected) ||
        ast.is.IsGetAccessorDeclaration(selected) || ast.is.IsSetAccessorDeclaration(selected)) return undefined;
      const annotation = ast.typeNode(selected);
      const value = annotation === undefined
        ? describeType(property.type, queries, { selectedType: property.type, declaration: selected }, depth + 1, declared)
        : describeSyntax(annotation, queries, depth + 1);
      if (value === undefined) return undefined;
      members.push({ name: property.name, optional: property.optional, type: property.optional && value.kind !== "optional"
        ? { kind: "optional", value } : value, declaration: selected, readonly: property.readonly });
    }
    return { kind: "shape", members };
  }

  function ownLiteral(node: Node, depth: number): SourceTypeDescriptor | undefined {
    if (depth > 4) return undefined;
    const literal = literals.get(node);
    if (literal?.form === "numeric" || literal?.form === "prefix-unary" || literal?.form === "parenthesized" || literal?.form === "binary") {
      if (literal.numeric?.kind === "authored") return { kind: "primitive", primitive: sourceTypeFlowNumericLiteralKind(literal) };
      if (literal.numeric?.kind === "checked-float64") return { kind: "primitive", primitive: "float64" };
    }
    if (literal?.form === "true" || literal?.form === "false") return { kind: "primitive", primitive: "bool" };
    if (literal?.form === "string" || literal?.form === "template") return { kind: "string" };
    if (ast.is.IsArrayLiteralExpression(node)) {
      let selected: SourceTypeDescriptor | undefined;
      for (const element of ast.elements(node)) {
        const value = element === undefined ? undefined : describe(element, undefined, depth + 1);
        if (value === undefined || selected !== undefined && !sourceTypeDescriptorsEqual(selected, value)) return undefined;
        selected = value;
      }
      return selected === undefined ? undefined : { kind: "array", readonly: false, element: selected };
    }
    if (ast.is.IsObjectLiteralExpression(node)) {
      const queries = semantics.forNode(node);
      const selectedType = queries.types.expressionType(node);
      if (selectedType === undefined) return undefined;
      const selectedMembers = queries.types.propertyInfos(selectedType);
      const members: SourceTypeDescriptorMember[] = [];
      for (const property of ast.properties(node)) {
        if (property === undefined) return undefined;
        const nameNode = ast.name(property);
        if (nameNode === undefined || ast.is.IsComputedPropertyName(nameNode)) return undefined;
        const initializer = (ast.is.IsPropertyAssignment(property) ? ast.as.AsPropertyAssignment(property)?.Initializer : undefined) ??
          (ast.is.IsShorthandPropertyAssignment(property) ? nameNode : undefined);
        const value = initializer === undefined ? undefined : describe(initializer, undefined, depth + 1);
        if (value === undefined) return undefined;
        const name = queries.propertyNames.get(nameNode);
        const selected = name?.kind !== "resolved" ? undefined : selectedMembers.find(member => member.name === name.name);
        if (selected === undefined) return undefined;
        members.push({ name: selected.name, optional: selected.optional, type: value, declaration: property });
      }
      return members.length === 0 ? undefined : { kind: "shape", members };
    }
    return undefined;
  }

  function describe(node: Node, component?: SourceTypeComponentEvidence, depth = 0,
    consumer?: SourceFileSemantics): SourceTypeDescriptor | undefined {
    if (depth > 4 || active.has(node)) return undefined;
    if (component === undefined) {
      const cached = cache.get(node);
      if (cached !== undefined) return cached;
    }
    const queries = consumer ?? semantics.forNode(node);
    active.add(node);
    let result: SourceTypeDescriptor | undefined;
    const rule = fixedRule(node);
    if (rule !== undefined && (component === undefined || component.declaration === rule.declaration)) {
      result = { kind: "primitive", primitive: "int64" };
    }
    const declaration = component?.declaration ?? declarationFor(node);
    const annotation = component?.authoredTypeNode ?? (declaration === undefined ? undefined : ast.typeNode(declaration));
    if (result === undefined && annotation !== undefined) result = describeSyntax(annotation, queries, depth);
    if (result === undefined && annotation !== undefined) {
      active.delete(node);
      return undefined;
    }
    if (result === undefined) result = primitive([...(component === undefined ? [node] : []),
      ...queries.facts.selectedSubjects(undefined, declaration),
      ...(component === undefined ? [] : queries.facts.typeSubjects(component.selectedType))]);
    const declarationFile = declaration === undefined ? undefined : ast.getSourceFile(declaration);
    const includedDeclaration = declarationFile !== undefined && semantics.includes(declarationFile);
    if (result === undefined && component === undefined && declaration !== undefined && declaration !== node && includedDeclaration) {
      result = describe(declaration, undefined, depth, queries);
    }
    if (result === undefined && component === undefined) {
      const initializer = initializerOf(node);
      if (initializer !== undefined) result = describe(initializer, undefined, depth, queries);
      else result = ownLiteral(node, depth);
    }
    if (result === undefined && annotation === undefined && component?.declaration !== undefined &&
      component.declaration === declarationFor(node) && includedDeclaration) {
      const initializer = initializerOf(component.declaration);
      if (initializer !== undefined) result = describe(initializer, undefined, depth, queries);
    }
    if (result === undefined) {
      const type = component?.selectedType ?? queries.types.expressionType(node) ??
        (declaration === undefined ? undefined : queries.declarations.declaredValueType(declaration));
      if (type !== undefined) result = describeType(type, queries, component ?? { selectedType: type,
        ...(declaration === undefined ? {} : { declaration }) }, depth, declaration !== undefined || component !== undefined);
    }
    if (result !== undefined && result.kind !== "optional" && declaration !== undefined && ast.questionToken(declaration) !== undefined) {
      const type = component?.selectedType ?? queries.types.expressionType(node);
      if (node === declaration || type !== undefined && queries.types.isUnion(type)) result = { kind: "optional", value: result };
    }
    if (result !== undefined && result.kind !== "optional" && component !== undefined &&
      queries.types.isUnion(component.selectedType) && queries.types.unionOrIntersectionTypes(component.selectedType)
        .some(type => queries.types.isNullish(type))) {
      result = { kind: "optional", value: result };
    }
    if (result?.kind === "optional" && declaration !== undefined && node !== declaration &&
      declaration === declarationFor(node)) {
      const selected = component?.selectedType ?? queries.types.expressionType(node);
      if (selected !== undefined && !queries.types.isUnion(selected) && !queries.types.isNullish(selected)) result = result.value;
    }
    active.delete(node);
    if (result === undefined) return undefined;
    const frozen = freezeSourceTypeDescriptor(result);
    if (component === undefined) cache.set(node, frozen);
    return frozen;
  }

  function hasDeclaredSourceType(node: Node): boolean {
    const declaration = declarationFor(node);
    const annotation = declaration === undefined ? undefined : ast.typeNode(declaration);
    const queries = semantics.forNode(node);
    return primitive([node, ...queries.facts.selectedSubjects(undefined, declaration),
      ...(annotation === undefined ? [] : queries.facts.authoredTypeSubjects(annotation))]) !== undefined;
  }

  const context: SourceTypeFlowAnalysisContext = Object.freeze({ source, describe,
    literal: (node: Node) => literals.get(node),
    order: (node: Node) => {
      const range = ast.authoredRange(node);
      return { start: range.kind === "authored" ? range.start : ast.pos(node), preorder: ordinals.get(node) ?? nodes.length };
    } });
  return Object.freeze({ context, nodes: Object.freeze(nodes), fixedRule, hasDeclaredSourceType });
}

export function sourceTypeFlowNumericLiteralKind(literal: SourceLiteralValue): "int32" | "float64" {
  const numeric = literal.numeric;
  return numeric?.kind === "checked-float64" || numeric?.kind === "authored" &&
    (numeric.token.negative && numeric.token.coefficient === 0n || /[.eE]/u.test(numeric.token.decimalText))
    ? "float64" : "int32";
}

export function sourceTypeFlowIntegerFits(value: bigint, kind: SourcePrimitiveKind): boolean {
  switch (kind) {
    case "int8": return value >= -128n && value <= 127n;
    case "uint8": return value >= 0n && value <= 255n;
    case "int16": return value >= -32768n && value <= 32767n;
    case "uint16": case "char": return value >= 0n && value <= 65535n;
    case "int32": return value >= -2147483648n && value <= 2147483647n;
    case "uint32": return value >= 0n && value <= 4294967295n;
    case "int64": return value >= -9223372036854775808n && value <= 9223372036854775807n;
    case "uint64": return value >= 0n && value <= 18446744073709551615n;
    case "float32": return Number.isFinite(Math.fround(Number(value)));
    case "float64": return Number.isFinite(Number(value));
    case "decimal": return value >= -79228162514264337593543950335n && value <= 79228162514264337593543950335n;
    default: return false;
  }
}
