import type { KeywordTypeNode, UnionTypeNode, IntersectionTypeNode, ConditionalTypeNode, TypeOperatorNode, InferTypeNode, ArrayTypeNode, IndexedAccessTypeNode, TypeReferenceNode, LiteralTypeNode, ThisTypeNode, TypePredicateNode, ImportAttribute, ImportAttributes, TypeQueryNode, MappedTypeNode, TypeLiteralNode, TupleTypeNode, NamedTupleMember, OptionalTypeNode, RestTypeNode, ParenthesizedTypeNode, FunctionTypeNode, ConstructorTypeNode, TemplateLiteralTypeNode, TemplateLiteralTypeSpan, TypeParameterDeclaration } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { SyntaxTextContext, TextWork } from "./text-values.js";
import { textSyntaxHeader, field, record, token, text, boolean, textNodeList } from "./text-values.js";
import { textTypedType, textTypedPredicate, textTypedTypeParameter } from "./text-phase-declarations.js";

export function printKeywordTypeNode(node: KeywordTypeNode<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printUnionTypeNode(node: UnionTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("types", textNodeList(node.types, context)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printIntersectionTypeNode(node: IntersectionTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("types", textNodeList(node.types, context)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printConditionalTypeNode(node: ConditionalTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("checkType", context.reference(node.checkType)),
    field("extendsType", context.reference(node.extendsType)),
    field("trueType", context.reference(node.trueType)),
    field("falseType", context.reference(node.falseType)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printTypeOperatorNode(node: TypeOperatorNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("operator", text(node.operator)),
    field("type", context.reference(node.type)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printInferTypeNode(node: InferTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("typeParameter", context.reference(node.typeParameter)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printArrayTypeNode(node: ArrayTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("elementType", context.reference(node.elementType)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printIndexedAccessTypeNode(node: IndexedAccessTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("objectType", context.reference(node.objectType)),
    field("indexType", context.reference(node.indexType)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printTypeReferenceNode(node: TypeReferenceNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("typeArguments", (node.typeArguments === null ? token("null") : textNodeList(node.typeArguments, context))),
    field("typeName", context.reference(node.typeName)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printLiteralTypeNode(node: LiteralTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("literal", context.reference(node.literal)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printThisTypeNode(node: ThisTypeNode<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printTypePredicateNode(node: TypePredicateNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("assertsModifier", (node.assertsModifier === null ? token("null") : context.reference(node.assertsModifier))),
    field("parameterName", context.reference(node.parameterName)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("tsonic", textTypedPredicate(node.tsonic)),
  ]);
}

export function printImportAttribute(node: ImportAttribute<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("name", context.reference(node.name)),
    field("value", context.reference(node.value)),
    field("tsonic", token("null")),
  ]);
}

export function printImportAttributes(node: ImportAttributes<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("token", text(node.token)),
    field("attributes", textNodeList(node.attributes, context)),
    field("multiLine", boolean(node.multiLine)),
    field("tsonic", token("null")),
  ]);
}

export function printTypeQueryNode(node: TypeQueryNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("typeArguments", (node.typeArguments === null ? token("null") : textNodeList(node.typeArguments, context))),
    field("exprName", context.reference(node.exprName)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printMappedTypeNode(node: MappedTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("readonlyToken", (node.readonlyToken === null ? token("null") : context.reference(node.readonlyToken))),
    field("typeParameter", context.reference(node.typeParameter)),
    field("nameType", (node.nameType === null ? token("null") : context.reference(node.nameType))),
    field("questionToken", (node.questionToken === null ? token("null") : context.reference(node.questionToken))),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("members", (node.members === null ? token("null") : textNodeList(node.members, context))),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printTypeLiteralNode(node: TypeLiteralNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("members", textNodeList(node.members, context)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printTupleTypeNode(node: TupleTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("elements", textNodeList(node.elements, context)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printNamedTupleMember(node: NamedTupleMember<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("dotDotDotToken", (node.dotDotDotToken === null ? token("null") : context.reference(node.dotDotDotToken))),
    field("name", context.reference(node.name)),
    field("questionToken", (node.questionToken === null ? token("null") : context.reference(node.questionToken))),
    field("type", context.reference(node.type)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printOptionalTypeNode(node: OptionalTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("type", context.reference(node.type)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printRestTypeNode(node: RestTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("type", context.reference(node.type)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printParenthesizedTypeNode(node: ParenthesizedTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("type", context.reference(node.type)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printFunctionTypeNode(node: FunctionTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("parameters", textNodeList(node.parameters, context)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("fullSignature", (node.fullSignature === null ? token("null") : context.reference(node.fullSignature))),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printConstructorTypeNode(node: ConstructorTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("parameters", textNodeList(node.parameters, context)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("fullSignature", (node.fullSignature === null ? token("null") : context.reference(node.fullSignature))),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printTemplateLiteralTypeNode(node: TemplateLiteralTypeNode<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("head", context.reference(node.head)),
    field("templateSpans", textNodeList(node.templateSpans, context)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printTemplateLiteralTypeSpan(node: TemplateLiteralTypeSpan<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("type", context.reference(node.type)),
    field("literal", context.reference(node.literal)),
    field("tsonic", textTypedType(node.tsonic)),
  ]);
}

export function printTypeParameterDeclaration(node: TypeParameterDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", context.reference(node.name)),
    field("constraint", (node.constraint === null ? token("null") : context.reference(node.constraint))),
    field("expression", (node.expression === null ? token("null") : context.reference(node.expression))),
    field("defaultType", (node.defaultType === null ? token("null") : context.reference(node.defaultType))),
    field("tsonic", textTypedTypeParameter(node.tsonic)),
  ]);
}
