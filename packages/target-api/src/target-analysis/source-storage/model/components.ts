import type { Node, SourceFile, Type } from "@tsonic/tsts";
import type { SourceFileSemantics, TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageProjection, SourceStorageSubject } from "./subjects.js";
import { sourceStorageIsMemberProjection } from "./subjects.js";
import { Node_Initializer, sourceEnclosingCallable } from "../../../source-navigation/index.js";
import { sourceArrayElementType } from "../../../source-semantics/array-types.js";

export function sourceStorageIsScalarType(type: Type, semantics: SourceFileSemantics): boolean {
  return semantics.types.isStringLike(type) || semantics.types.isNumberLike(type) || semantics.types.isBooleanLike(type) ||
    semantics.types.isBigIntLike(type) || semantics.types.isSymbolLike(type);
}

export function sourcePresentStorageType(type: Type, semantics: SourceFileSemantics): Type | undefined {
  if (!semantics.types.isUnion(type)) return type;
  const present = semantics.types.unionOrIntersectionTypes(type).filter(member => !semantics.types.isNullish(member));
  return present.length === 1 ? present[0] : undefined;
}

export function sourceStorageComponentType(
  type: Type,
  component: SourceStorageProjection,
  semantics: SourceFileSemantics,
): Type | undefined {
  const selected = sourcePresentStorageType(type, semantics);
  if (selected === undefined) return undefined;
  if (sourceStorageIsMemberProjection(component)) {
    const correspondence = semantics.types.structuralMembers(selected, selected);
    if (correspondence.kind !== "available") return undefined;
    const members = correspondence.members.filter(member => member.kind === "present" &&
      member.destination.read === (component.kind === "member" ? "property" : "method") &&
      member.destination.declarations.includes(component.declaration));
    return members.length === 1 ? members[0]!.destination.property.type : undefined;
  }
  if (component.kind === "tuple-element") {
    if (!semantics.types.isTuple(selected)) return undefined;
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
    const correspondence = semantics.types.structuralMembers(from, to);
    if (correspondence.kind !== "available") return [];
    return correspondence.members.flatMap(member => member.kind === "present" &&
      member.destination.read === (component.kind === "member" ? "property" : "method") &&
      (member.source.read === "property" || member.source.read === "method") &&
      member.destination.declarations.includes(component.declaration)
      ? member.source.declarations.map(declaration => ({
          kind: member.source.read === "method" ? "method-value" as const : "member" as const, declaration,
        })) : []);
  }
  return component.kind === "array-element" ? sourceStorageComponents(from, semantics)
    : [semantics.types.isTuple(from) ? component : { kind: "array-element" }];
}

export function* sourceStorageComponents(
  type: Type,
  semantics: SourceFileSemantics,
): Iterable<SourceStorageProjection> {
  const selected = sourcePresentStorageType(type, semantics);
  if (selected === undefined) return;
  if (semantics.types.isTuple(selected)) {
    for (const [index, element] of semantics.types.tupleElementInfos(selected).entries()) {
      if (element.elementKind === "required" || element.elementKind === "optional")
        yield { kind: "tuple-element", index };
    }
  } else if (sourceStorageComponentType(selected, { kind: "array-element" }, semantics) !== undefined)
    yield { kind: "array-element" };
}

export function sourceStorageSubjectType(source: TargetSourceProgram, value: SourceStorageSubject, sourceFile?: SourceFile): Type | undefined {
  const file = sourceFile ?? source.ast.getSourceFile(value.node);
  if (file === undefined || !source.semantics.includes(file)) return undefined;
  const semantics = source.semantics.forFile(file);
  const name = source.ast.name(value.node);
  const bindingContainer = name !== undefined && source.ast.is.IsVariableDeclaration(value.node) &&
    (source.ast.is.IsArrayBindingPattern(name) || source.ast.is.IsObjectBindingPattern(name));
  const initializer = bindingContainer ? Node_Initializer(source.ast, value.node) : undefined;
  const expressionValue = source.ast.is.IsObjectLiteralExpression(value.node) || source.ast.is.IsArrayLiteralExpression(value.node) ||
    value.kind === "value" && source.ast.is.IsIdentifier(value.node);
  const nodeType = bindingContainer ? initializer === undefined ? undefined : semantics.types.expressionType(initializer)
    : expressionValue ? semantics.types.expressionType(value.node)
      : semantics.declarations.declaredValueType(value.node) ?? semantics.types.expressionType(value.node);
  const signatures = value.kind !== "return" || nodeType === undefined ? [] : semantics.types.callSignatures(nodeType)
    .filter(signature => semantics.declarations.signatureDeclaration(signature) === value.node);
  let selected = value.kind === "return" ? signatures.length === 1 ? semantics.types.returnType(signatures[0]!) : undefined
    : value.kind === "receiver" ? sourceStorageReceiverType(source, value.node, semantics) : nodeType;
  for (const component of value.projection) {
    if (selected === undefined) return undefined;
    selected = sourceStorageComponentType(selected, component, semantics);
  }
  return selected;
}

function sourceStorageReceiverType(source: TargetSourceProgram, node: Node, semantics: SourceFileSemantics): Type | undefined {
  const visited = new Set<Node>();
  for (let depth = 0; depth < 128 && !visited.has(node); depth += 1) {
    visited.add(node);
    const explicit = semantics.types.declarationSignatureInfo(node)?.thisParameter?.type;
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
): SourceStorageProjection | undefined {
  const selected = sourcePresentStorageType(type, semantics);
  if (selected === undefined) return undefined;
  if (semantics.types.isTuple(selected)) {
    const indexType = index === undefined ? undefined : semantics.types.expressionType(index);
    const value = indexType === undefined ? undefined : semantics.types.numericLiteralValue(indexType);
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 &&
      sourceStorageComponentType(selected, { kind: "tuple-element", index: value }, semantics) !== undefined
      ? Object.freeze({ kind: "tuple-element", index: value }) : undefined;
  }
  return sourceStorageComponentType(selected, { kind: "array-element" }, semantics) === undefined
    ? undefined : Object.freeze({ kind: "array-element" });
}
