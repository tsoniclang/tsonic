import type * as Hir from "../ir-hir/contract.js";
import { sameNodeKind, sameNodeList } from "./syntax-compare-common.js";

export function sameArrayTypeNode(left: Hir.ArrayTypeNode<Hir.Phase>, right: Hir.ArrayTypeNode<Hir.Phase>): boolean {
  return sameNodeKind(left.elementType, right.elementType);
}

export function sameCallSignatureDeclaration(left: Hir.CallSignatureDeclaration<Hir.Phase>, right: Hir.CallSignatureDeclaration<Hir.Phase>): boolean {
  return (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeList(left.parameters, right.parameters) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.fullSignature === null ? right.fullSignature === null : right.fullSignature !== null && sameNodeKind(left.fullSignature, right.fullSignature));
}

export function sameConditionalTypeNode(left: Hir.ConditionalTypeNode<Hir.Phase>, right: Hir.ConditionalTypeNode<Hir.Phase>): boolean {
  return sameNodeKind(left.checkType, right.checkType) &&
    sameNodeKind(left.extendsType, right.extendsType) &&
    sameNodeKind(left.trueType, right.trueType) &&
    sameNodeKind(left.falseType, right.falseType);
}

export function sameConstructSignatureDeclaration(left: Hir.ConstructSignatureDeclaration<Hir.Phase>, right: Hir.ConstructSignatureDeclaration<Hir.Phase>): boolean {
  return (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeList(left.parameters, right.parameters) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.fullSignature === null ? right.fullSignature === null : right.fullSignature !== null && sameNodeKind(left.fullSignature, right.fullSignature));
}

export function sameConstructorTypeNode(left: Hir.ConstructorTypeNode<Hir.Phase>, right: Hir.ConstructorTypeNode<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeList(left.parameters, right.parameters) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.fullSignature === null ? right.fullSignature === null : right.fullSignature !== null && sameNodeKind(left.fullSignature, right.fullSignature));
}

export function sameFunctionTypeNode(left: Hir.FunctionTypeNode<Hir.Phase>, right: Hir.FunctionTypeNode<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeList(left.parameters, right.parameters) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.fullSignature === null ? right.fullSignature === null : right.fullSignature !== null && sameNodeKind(left.fullSignature, right.fullSignature));
}

export function sameImportTypeNode(left: Hir.ImportTypeNode<Hir.Phase>, right: Hir.ImportTypeNode<Hir.Phase>): boolean {
  return (left.typeArguments === null ? right.typeArguments === null : right.typeArguments !== null && sameNodeList(left.typeArguments, right.typeArguments)) &&
    Object.is(left.isTypeOf, right.isTypeOf) &&
    sameNodeKind(left.argument, right.argument) &&
    ((left.attributes === null) === (right.attributes === null)) &&
    (left.qualifier === null ? right.qualifier === null : right.qualifier !== null && sameNodeKind(left.qualifier, right.qualifier));
}

export function sameIndexSignatureDeclaration(left: Hir.IndexSignatureDeclaration<Hir.Phase>, right: Hir.IndexSignatureDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeList(left.parameters, right.parameters) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.fullSignature === null ? right.fullSignature === null : right.fullSignature !== null && sameNodeKind(left.fullSignature, right.fullSignature));
}

export function sameIndexedAccessTypeNode(left: Hir.IndexedAccessTypeNode<Hir.Phase>, right: Hir.IndexedAccessTypeNode<Hir.Phase>): boolean {
  return sameNodeKind(left.objectType, right.objectType) &&
    sameNodeKind(left.indexType, right.indexType);
}

export function sameIntersectionTypeNode(left: Hir.IntersectionTypeNode<Hir.Phase>, right: Hir.IntersectionTypeNode<Hir.Phase>): boolean {
  return sameNodeList(left.types, right.types);
}

export function sameLiteralTypeNode(left: Hir.LiteralTypeNode<Hir.Phase>, right: Hir.LiteralTypeNode<Hir.Phase>): boolean {
  return sameNodeKind(left.literal, right.literal);
}

export function sameMappedTypeNode(left: Hir.MappedTypeNode<Hir.Phase>, right: Hir.MappedTypeNode<Hir.Phase>): boolean {
  return (left.readonlyToken === null ? right.readonlyToken === null : right.readonlyToken !== null && sameNodeKind(left.readonlyToken, right.readonlyToken)) &&
    (left.nameType === null ? right.nameType === null : right.nameType !== null && sameNodeKind(left.nameType, right.nameType)) &&
    (left.questionToken === null ? right.questionToken === null : right.questionToken !== null && sameNodeKind(left.questionToken, right.questionToken)) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.members === null ? right.members === null : right.members !== null && sameNodeList(left.members, right.members));
}

export function sameMethodSignatureDeclaration(left: Hir.MethodSignatureDeclaration<Hir.Phase>, right: Hir.MethodSignatureDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    sameNodeKind(left.name, right.name) &&
    (left.postfixToken === null ? right.postfixToken === null : right.postfixToken !== null && sameNodeKind(left.postfixToken, right.postfixToken)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeList(left.parameters, right.parameters) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.fullSignature === null ? right.fullSignature === null : right.fullSignature !== null && sameNodeKind(left.fullSignature, right.fullSignature));
}

export function sameNamedTupleMember(left: Hir.NamedTupleMember<Hir.Phase>, right: Hir.NamedTupleMember<Hir.Phase>): boolean {
  return ((left.dotDotDotToken === null) === (right.dotDotDotToken === null)) &&
    ((left.questionToken === null) === (right.questionToken === null)) &&
    sameNodeKind(left.type, right.type);
}

export function sameOptionalTypeNode(left: Hir.OptionalTypeNode<Hir.Phase>, right: Hir.OptionalTypeNode<Hir.Phase>): boolean {
  return sameNodeKind(left.type, right.type);
}

export function sameParenthesizedTypeNode(left: Hir.ParenthesizedTypeNode<Hir.Phase>, right: Hir.ParenthesizedTypeNode<Hir.Phase>): boolean {
  return sameNodeKind(left.type, right.type);
}

export function samePropertySignatureDeclaration(left: Hir.PropertySignatureDeclaration<Hir.Phase>, right: Hir.PropertySignatureDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    sameNodeKind(left.name, right.name) &&
    (left.postfixToken === null ? right.postfixToken === null : right.postfixToken !== null && sameNodeKind(left.postfixToken, right.postfixToken)) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.initializer === null ? right.initializer === null : right.initializer !== null && sameNodeKind(left.initializer, right.initializer));
}

export function sameRestTypeNode(left: Hir.RestTypeNode<Hir.Phase>, right: Hir.RestTypeNode<Hir.Phase>): boolean {
  return sameNodeKind(left.type, right.type);
}

export function sameTemplateLiteralTypeNode(left: Hir.TemplateLiteralTypeNode<Hir.Phase>, right: Hir.TemplateLiteralTypeNode<Hir.Phase>): boolean {
  return sameNodeList(left.templateSpans, right.templateSpans);
}

export function sameTupleTypeNode(left: Hir.TupleTypeNode<Hir.Phase>, right: Hir.TupleTypeNode<Hir.Phase>): boolean {
  return sameNodeList(left.elements, right.elements);
}

export function sameTypeAssertion(left: Hir.TypeAssertion<Hir.Phase>, right: Hir.TypeAssertion<Hir.Phase>): boolean {
  return sameNodeKind(left.type, right.type) &&
    sameNodeKind(left.expression, right.expression);
}

export function sameTypeLiteralNode(left: Hir.TypeLiteralNode<Hir.Phase>, right: Hir.TypeLiteralNode<Hir.Phase>): boolean {
  return sameNodeList(left.members, right.members);
}

export function sameTypeOperatorNode(left: Hir.TypeOperatorNode<Hir.Phase>, right: Hir.TypeOperatorNode<Hir.Phase>): boolean {
  return Object.is(left.operator, right.operator) &&
    sameNodeKind(left.type, right.type);
}

export function sameTypeParameterDeclaration(left: Hir.TypeParameterDeclaration<Hir.Phase>, right: Hir.TypeParameterDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    (left.constraint === null ? right.constraint === null : right.constraint !== null && sameNodeKind(left.constraint, right.constraint)) &&
    (left.expression === null ? right.expression === null : right.expression !== null && sameNodeKind(left.expression, right.expression)) &&
    (left.defaultType === null ? right.defaultType === null : right.defaultType !== null && sameNodeKind(left.defaultType, right.defaultType));
}

export function sameTypePredicateNode(left: Hir.TypePredicateNode<Hir.Phase>, right: Hir.TypePredicateNode<Hir.Phase>): boolean {
  return ((left.assertsModifier === null) === (right.assertsModifier === null)) &&
    sameNodeKind(left.parameterName, right.parameterName) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type));
}

export function sameTypeQueryNode(left: Hir.TypeQueryNode<Hir.Phase>, right: Hir.TypeQueryNode<Hir.Phase>): boolean {
  return (left.typeArguments === null ? right.typeArguments === null : right.typeArguments !== null && sameNodeList(left.typeArguments, right.typeArguments)) &&
    sameNodeKind(left.exprName, right.exprName);
}

export function sameTypeReferenceNode(left: Hir.TypeReferenceNode<Hir.Phase>, right: Hir.TypeReferenceNode<Hir.Phase>): boolean {
  return (left.typeArguments === null ? right.typeArguments === null : right.typeArguments !== null && sameNodeList(left.typeArguments, right.typeArguments)) &&
    sameNodeKind(left.typeName, right.typeName);
}

export function sameUnionTypeNode(left: Hir.UnionTypeNode<Hir.Phase>, right: Hir.UnionTypeNode<Hir.Phase>): boolean {
  return sameNodeList(left.types, right.types);
}
