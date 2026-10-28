import type { AstReader, Node, SourceFile, Type } from "@tsonic/tsts";
import type { SourceFileSemantics, TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageProjection, SourceStorageSubject } from "./subjects.js";
import { sourceStorageIsDataMember, sourceStorageIsMemberProjection, sourceStorageIsMethodMember } from "./subjects.js";
import { ForInOrOfStatement_Initializer, Node_Expression, Node_Initializer, VariableDeclarationList_Declarations, sourceEnclosingCallable } from "../../../source-navigation/index.js";
import { sourceArrayElementType } from "../../../source-semantics/array-types.js";

export function sourceStorageIsScalarType(type: Type, semantics: SourceFileSemantics): boolean {
  return semantics.types.isStringLike(type) || semantics.types.isNumberLike(type) || semantics.types.isBooleanLike(type) ||
    semantics.types.isBigIntLike(type) || semantics.types.isSymbolLike(type);
}

export function sourcePresentStorageType(type: Type, semantics: SourceFileSemantics): Type | undefined {
  if (!semantics.types.isUnion(type)) return type;
  const present = semantics.types.nonNullableType(type);
  return present === undefined || semantics.types.isNever(present) ? undefined : present;
}

function sourceStorageIsTupleType(type: Type, semantics: SourceFileSemantics): boolean {
  const selected = sourcePresentStorageType(type, semantics);
  if (selected === undefined) return false;
  if (semantics.types.isTuple(selected)) return true;
  if (!semantics.types.isUnion(selected)) return false;
  const alternatives = semantics.types.unionOrIntersectionTypes(selected);
  return alternatives.length > 0 && alternatives.every(alternative => semantics.types.isTuple(alternative));
}

export function sourceStorageAccessDeclarations(source: TargetSourceProgram, access: Node,
  mode: "read" | "write"): readonly Node[] | undefined {
  const { ast } = source;
  const semantics = source.semantics.forNode(access);
  const property = ast.is.IsPropertyAccessExpression(access) ? semantics.operations.propertyAccess(access) : undefined;
  const selected = property ?? (ast.is.IsElementAccessExpression(access) ? semantics.operations.elementAccess(access) : undefined);
  if (selected === undefined) return undefined;
  if (mode === "read" ? selected.accessMode === "write" : selected.accessMode === "read") return Object.freeze([]);
  const direct = mode === "read" ? property?.selectedReadDeclaration ?? selected.selectedDeclaration
    : property?.selectedWriteDeclaration ?? selected.selectedDeclaration;
  const readable = (node: Node): boolean => sourceStorageIsDataMember(node, ast) || sourceStorageIsMethodMember(node, ast) ||
    (mode === "read" ? ast.is.IsGetAccessorDeclaration(node) : ast.is.IsSetAccessorDeclaration(node));
  if (direct !== undefined && readable(direct)) return Object.freeze([direct]);
  if (selected.selectedSymbol === undefined) return undefined;
  const declarations = [...new Set(semantics.declarations.symbolDeclarations(selected.selectedSymbol).filter(readable))];
  return declarations.length === 0 ? undefined : Object.freeze(declarations);
}

export function sourceStorageDynamicMemberKey(source: TargetSourceProgram, access: Node): string | undefined {
  const { ast } = source;
  const semantics = source.semantics.forNode(access);
  const property = ast.is.IsPropertyAccessExpression(access) ? semantics.operations.propertyAccess(access) : undefined;
  const element = ast.is.IsElementAccessExpression(access) ? semantics.operations.elementAccess(access) : undefined;
  const selected = property ?? element;
  if (selected === undefined || !semantics.types.isAny(selected.receiver.type)) return undefined;
  if (property !== undefined) {
    const name = ast.name(access);
    if (name === undefined || !ast.is.IsIdentifier(name)) return undefined;
    return semantics.operations.propertyName(name)?.name;
  }
  if (element === undefined) return undefined;
  const text = semantics.types.stringLiteralValue(element.argument.type);
  if (text !== undefined) return text;
  const numeric = semantics.types.numericLiteralValue(element.argument.type);
  return numeric === undefined ? undefined : String(numeric);
}

export function sourceStorageDynamicMemberDeclarations(source: TargetSourceProgram, receiver: SourceStorageSubject,
  key: string, mode: "read" | "write", step: () => boolean):
  { readonly type: Type; readonly declarations: readonly Node[] } | undefined {
  const type = sourceStorageSubjectType(source, receiver);
  const context = source.semantics.forNode(receiver.node);
  if (type === undefined || context.types.isAny(type) || context.types.isUnknown(type)) return undefined;
  const originals = new Set<Node>();
  for (const property of context.types.propertyInfos(type)) {
    if (!step()) return undefined;
    if (property.name !== key) continue;
    for (const symbol of [property.symbol, ...property.rootSymbols]) {
      for (const declaration of context.declarations.symbolDeclarations(symbol)) {
        if (!step()) return undefined;
        if (sourceStorageIsDataMember(declaration, source.ast) || sourceStorageIsMethodMember(declaration, source.ast) ||
          (mode === "read" ? source.ast.is.IsGetAccessorDeclaration(declaration) : source.ast.is.IsSetAccessorDeclaration(declaration)))
          originals.add(declaration);
      }
    }
  }
  return originals.size === 0 ? undefined : Object.freeze({ type, declarations: Object.freeze([...originals]) });
}

export function sourceStorageComponentType(
  type: Type,
  component: SourceStorageProjection,
  semantics: SourceFileSemantics,
  ast: AstReader,
): Type | undefined {
  const selected = sourcePresentStorageType(type, semantics);
  if (selected === undefined) return undefined;
  if (sourceStorageIsMemberProjection(component)) {
    if (component.kind === "method-value" ? !sourceStorageIsMethodMember(component.declaration, ast)
      : !sourceStorageIsDataMember(component.declaration, ast) && !ast.is.IsGetAccessorDeclaration(component.declaration)) return undefined;
    const properties = semantics.types.propertyInfos(selected).filter(property => [property.symbol, ...property.rootSymbols]
      .some(symbol => semantics.declarations.symbolDeclarations(symbol).includes(component.declaration)));
    return properties.length === 1 ? properties[0]!.type : undefined;
  }
  if (component.kind === "tuple-element") {
    if (!sourceStorageIsTupleType(selected, semantics)) return undefined;
    if (semantics.types.isUnion(selected)) {
      const properties = semantics.types.propertyInfos(selected).filter(property => property.name === String(component.index));
      return properties.length === 1 ? properties[0]!.type : undefined;
    }
    const elements = semantics.types.tupleElementInfos(selected);
    const element = elements[component.index];
    return element?.elementKind === "required" || element?.elementKind === "optional" ? element.type : undefined;
  }
  return sourceArrayElementType(selected, semantics);
}

export function sourceStorageOriginalComponents(
  from: Type,
  to: Type,
  component: SourceStorageProjection,
  semantics: SourceFileSemantics,
): Iterable<SourceStorageProjection> {
  if (sourceStorageIsMemberProjection(component)) {
    if (from === to) return [component];
    const member = semantics.types.structuralMember(from, to, component.declaration, "read");
    if (member?.kind !== "present" || member.source.read === "unavailable" ||
      (component.kind === "method-value" ? member.destination.read !== "method"
        : member.destination.read !== "property" && member.destination.read !== "accessor")) return [];
    return (member.source.read === "accessor" ? member.source.getters : member.source.declarations).map(declaration => ({
      kind: member.source.read === "method" ? "method-value" as const : "member" as const, declaration,
    }));
  }
  return component.kind === "array-element" ? sourceStorageComponents(from, semantics)
    : [sourceStorageIsTupleType(from, semantics) ? component : { kind: "array-element" }];
}

export function* sourceStorageComponents(
  type: Type,
  semantics: SourceFileSemantics,
): Iterable<SourceStorageProjection> {
  const selected = sourcePresentStorageType(type, semantics);
  if (selected === undefined) return;
  if (sourceStorageIsTupleType(selected, semantics)) {
    const alternatives = semantics.types.isUnion(selected) ? semantics.types.unionOrIntersectionTypes(selected) : [selected];
    const indexes = new Set<number>();
    for (const alternative of alternatives) for (const [index, element] of semantics.types.tupleElementInfos(alternative).entries()) {
      if (element.elementKind === "required" || element.elementKind === "optional") indexes.add(index);
    }
    for (const index of indexes) yield { kind: "tuple-element", index };
  } else if (sourceArrayElementType(selected, semantics) !== undefined)
    yield { kind: "array-element" };
}

export function sourceStorageSubjectType(source: TargetSourceProgram, value: SourceStorageSubject, sourceFile?: SourceFile): Type | undefined {
  const file = sourceFile ?? source.ast.getSourceFile(value.node);
  if (file === undefined || !source.semantics.includes(file)) return undefined;
  const semantics = source.semantics.forFile(file);
  let selected: Type | undefined;
  if (value.kind === "return") {
    const signature = semantics.types.declarationSignatureInfo(value.node);
    selected = signature?.returnType !== undefined && semantics.declarations.signatureDeclaration(signature.signature) === value.node
      ? source.ast.hasModifierKind(value.node, "async")
        ? semantics.types.awaitedType(signature.returnType)
        : signature.returnType
      : undefined;
  } else if (value.kind === "receiver") {
    selected = sourceStorageReceiverType(source, value.node, semantics);
  } else if (value.kind === "value" && source.ast.is.IsSpreadElement(value.node)) {
    const operand = Node_Expression(source.ast, value.node);
    selected = operand === undefined ? undefined : semantics.types.expressionType(operand);
  } else {
    const name = source.ast.name(value.node);
    const bindingContainer = name !== undefined && (source.ast.is.IsVariableDeclaration(value.node) ||
      source.ast.is.IsParameterDeclaration(value.node)) &&
      (source.ast.is.IsArrayBindingPattern(name) || source.ast.is.IsObjectBindingPattern(name));
    const initializer = bindingContainer ? Node_Initializer(source.ast, value.node) : undefined;
    const containerType = bindingContainer ? source.ast.typeNode(value.node) : undefined;
    const declarationList = bindingContainer && source.ast.is.IsVariableDeclaration(value.node) ? source.ast.parent(value.node) : undefined;
    const declarations = declarationList !== undefined && source.ast.is.IsVariableDeclarationList(declarationList)
      ? VariableDeclarationList_Declarations(source.ast, declarationList) : undefined;
    const loop = declarationList === undefined ? undefined : source.ast.parent(declarationList);
    const iteration = loop !== undefined && declarations?.length === 1 && declarations[0] === value.node &&
      (source.ast.is.IsForOfStatement(loop) || source.ast.is.IsForInStatement(loop)) &&
      ForInOrOfStatement_Initializer(source.ast, loop) === declarationList ? loop : undefined;
    const expressionValue = source.ast.is.IsObjectLiteralExpression(value.node) || source.ast.is.IsArrayLiteralExpression(value.node) ||
      value.kind === "value" && (source.ast.is.IsIdentifier(value.node) || source.ast.is.IsPropertyAccessExpression(value.node) ||
        source.ast.is.IsElementAccessExpression(value.node) || source.ast.kindName(value.node) === "KindThisKeyword");
    selected = bindingContainer ? iteration !== undefined ? semantics.operations.iteration(iteration)?.sourceElementType
        : containerType !== undefined ? semantics.types.authoredType(containerType)
        : initializer !== undefined ? semantics.types.expressionType(initializer)
          : source.ast.is.IsParameterDeclaration(value.node) ? semantics.types.expressionType(value.node) : undefined
      : expressionValue ? semantics.types.expressionType(value.node)
        : semantics.declarations.declaredValueType(value.node) ?? semantics.types.expressionType(value.node);
  }
  for (const component of value.projection) {
    if (selected === undefined) return undefined;
    selected = sourceStorageComponentType(selected, component, semantics, source.ast);
  }
  return selected;
}

function sourceStorageReceiverType(source: TargetSourceProgram, node: Node, semantics: SourceFileSemantics): Type | undefined {
  const visited = new Set<Node>();
  for (let depth = 0; depth < 128 && !visited.has(node); depth += 1) {
    visited.add(node);
    const signature = semantics.declarations.declarationSignature(node);
    const explicit = signature === undefined ? undefined : semantics.types.signatureThisParameterInfo(signature)?.type;
    if (explicit !== undefined) return explicit;
    if (source.ast.is.IsArrowFunction(node)) {
      const owner = sourceEnclosingCallable(source.ast.parent(node), source.ast);
      if (owner === undefined) return undefined;
      node = owner;
      continue;
    }
    const owner = source.ast.parent(node);
    if (owner !== undefined && source.ast.is.IsObjectLiteralExpression(owner)) {
      const element = semantics.operations.objectLiteralElement(node);
      const kind = source.ast.is.IsMethodDeclaration(node) ? "method"
        : source.ast.is.IsGetAccessorDeclaration(node) ? "get" : source.ast.is.IsSetAccessorDeclaration(node) ? "set" : undefined;
      return element?.element === node && element.objectLiteral === owner && element.elementKind === kind && kind !== undefined
        ? element.contextualType ?? element.objectLiteralType : undefined;
    }
    if (source.ast.is.IsClassDeclaration(node) || source.ast.is.IsClassExpression(node) || source.ast.is.IsInterfaceDeclaration(node))
      return semantics.declarations.declaredType(node);
    if (owner !== undefined && (source.ast.is.IsClassDeclaration(owner) || source.ast.is.IsClassExpression(owner) ||
      source.ast.is.IsInterfaceDeclaration(owner))) return source.ast.hasModifierKind(node, "static")
        ? semantics.declarations.declaredValueType(owner) : semantics.declarations.declaredType(owner);
    return undefined;
  }
  return undefined;
}

export function sourceIndexedStorageProjection(
  type: Type,
  index: Node | undefined,
  semantics: SourceFileSemantics,
  ast: AstReader,
): SourceStorageProjection | undefined {
  const selected = sourcePresentStorageType(type, semantics);
  if (selected === undefined) return undefined;
  if (sourceStorageIsTupleType(selected, semantics)) {
    const indexType = index === undefined ? undefined : semantics.types.expressionType(index);
    const value = indexType === undefined ? undefined : semantics.types.numericLiteralValue(indexType);
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 &&
      sourceStorageComponentType(selected, { kind: "tuple-element", index: value }, semantics, ast) !== undefined
      ? Object.freeze({ kind: "tuple-element", index: value }) : undefined;
  }
  if (sourceStorageComponentType(selected, { kind: "array-element" }, semantics, ast) !== undefined)
    return Object.freeze({ kind: "array-element" });
  return undefined;
}
