
import type { NodeList, ModifierList, Identifier, ParameterDeclaration, KeywordTypeNode, UnionTypeNode, IntersectionTypeNode, ConditionalTypeNode, TypeOperatorNode, InferTypeNode, ArrayTypeNode, IndexedAccessTypeNode, TypeReferenceNode, LiteralTypeNode, LiteralTypeChild, ThisTypeNode, TypePredicateNode, ImportAttribute, ImportAttributes, TypeQueryNode, MappedTypeNode, TypeLiteralNode, TupleTypeNode, NamedTupleMember, OptionalTypeNode, RestTypeNode, ParenthesizedTypeNode, FunctionTypeNode, ConstructorTypeNode, TemplateHead, TemplateLiteralTypeNode, TemplateLiteralTypeSpan, TypeParameterDeclaration, Expression, TypeNode, EntityName, TemplateMiddleOrTail, TypePredicateParameterName, ImportAttributeName, TypeElement, DotDotDotToken, QuestionToken, PlusToken, MinusToken, AssertsKeyword, ReadonlyKeyword } from "../ir-hir/contract.js";
import type { TypedType, TypedPredicate, TypedTypeParameter, TypedPhase } from "../ir-tir/contract.js";
import type { Cursor, TextStep } from "./parse-values.js";
import type { SyntaxValue, SyntaxReadPorts } from "./parse-syntax-values.js";
import { readBoolean, readNull, readStringChoice, atomicText, fieldText } from "./parse-values.js";
import { readTypedTypeText, readTypedPredicateText, readTypedTypeParameterText } from "./parse-phase-declarations.js";
import { resolveSyntaxValue, syntaxAlternatives, readSyntaxRecord, finishSyntaxRecord, readSyntaxReference, readNullableSyntax, readSyntaxList } from "./parse-syntax-values.js";

export function readKeywordTypeNodeSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "AnyKeyword" | "BigIntKeyword" | "BooleanKeyword" | "IntrinsicKeyword" | "NeverKeyword" | "NumberKeyword" | "ObjectKeyword" | "StringKeyword" | "SymbolKeyword" | "UndefinedKeyword" | "UnknownKeyword" | "VoidKeyword", finish: (value: SyntaxValue<KeywordTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<KeywordTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, tsonic: tsonicValue }),
    }, finish)));
}

export function readUnionTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "UnionType", finish: (value: SyntaxValue<UnionTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<TypeNode<TypedPhase>>>, Root>(cursor, fields, "types", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), "NodeList", done), typesValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<UnionTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typesValue, typesResolved => ({ ...header, kind, types: typesResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readIntersectionTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "IntersectionType", finish: (value: SyntaxValue<IntersectionTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<TypeNode<TypedPhase>>>, Root>(cursor, fields, "types", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), "NodeList", done), typesValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<IntersectionTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typesValue, typesResolved => ({ ...header, kind, types: typesResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readConditionalTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ConditionalType", finish: (value: SyntaxValue<ConditionalTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "checkType", (next, done) => readSyntaxReference(next, ports.TypeNode, done), checkTypeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "extendsType", (next, done) => readSyntaxReference(next, ports.TypeNode, done), extendsTypeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "trueType", (next, done) => readSyntaxReference(next, ports.TypeNode, done), trueTypeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "falseType", (next, done) => readSyntaxReference(next, ports.TypeNode, done), falseTypeValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<ConditionalTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(checkTypeValue, checkTypeResolved => resolveSyntaxValue(extendsTypeValue, extendsTypeResolved => resolveSyntaxValue(trueTypeValue, trueTypeResolved => resolveSyntaxValue(falseTypeValue, falseTypeResolved => ({ ...header, kind, checkType: checkTypeResolved, extendsType: extendsTypeResolved, trueType: trueTypeResolved, falseType: falseTypeResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readTypeOperatorNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TypeOperator", finish: (value: SyntaxValue<TypeOperatorNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<"KeyOfKeyword" | "ReadonlyKeyword" | "UniqueKeyword", Root>(cursor, fields, "operator", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["KeyOfKeyword","ReadonlyKeyword","UniqueKeyword"]), done), operatorValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<TypeOperatorNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeValue, typeResolved => ({ ...header, kind, operator: operatorValue, type: typeResolved, tsonic: tsonicValue })),
    }, finish)))));
}

export function readInferTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "InferType", finish: (value: SyntaxValue<InferTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TypeParameterDeclaration<TypedPhase>>, Root>(cursor, fields, "typeParameter", (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), typeParameterValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<InferTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeParameterValue, typeParameterResolved => ({ ...header, kind, typeParameter: typeParameterResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readArrayTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ArrayType", finish: (value: SyntaxValue<ArrayTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "elementType", (next, done) => readSyntaxReference(next, ports.TypeNode, done), elementTypeValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<ArrayTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(elementTypeValue, elementTypeResolved => ({ ...header, kind, elementType: elementTypeResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readIndexedAccessTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "IndexedAccessType", finish: (value: SyntaxValue<IndexedAccessTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "objectType", (next, done) => readSyntaxReference(next, ports.TypeNode, done), objectTypeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "indexType", (next, done) => readSyntaxReference(next, ports.TypeNode, done), indexTypeValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<IndexedAccessTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(objectTypeValue, objectTypeResolved => resolveSyntaxValue(indexTypeValue, indexTypeResolved => ({ ...header, kind, objectType: objectTypeResolved, indexType: indexTypeResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readTypeReferenceNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TypeReference", finish: (value: SyntaxValue<TypeReferenceNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<TypeNode<TypedPhase>> | null>, Root>(cursor, fields, "typeArguments", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), "NodeList", done), done), typeArgumentsValue =>
    fieldText<SyntaxValue<EntityName<TypedPhase>>, Root>(cursor, fields, "typeName", (next, done) => readSyntaxReference(next, ports.EntityName, done), typeNameValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<TypeReferenceNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeArgumentsValue, typeArgumentsResolved => resolveSyntaxValue(typeNameValue, typeNameResolved => ({ ...header, kind, typeArguments: typeArgumentsResolved, typeName: typeNameResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readLiteralTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "LiteralType", finish: (value: SyntaxValue<LiteralTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<LiteralTypeChild<TypedPhase>>, Root>(cursor, fields, "literal", (next, done) => readSyntaxReference(next, ports.LiteralTypeChild, done), literalValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<LiteralTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(literalValue, literalResolved => ({ ...header, kind, literal: literalResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readThisTypeNodeSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "ThisType", finish: (value: SyntaxValue<ThisTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<ThisTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, tsonic: tsonicValue }),
    }, finish)));
}

export function readTypePredicateNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TypePredicate", finish: (value: SyntaxValue<TypePredicateNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<AssertsKeyword<TypedPhase> | null>, Root>(cursor, fields, "assertsModifier", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.AssertsKeyword, done), done), assertsModifierValue =>
    fieldText<SyntaxValue<TypePredicateParameterName<TypedPhase>>, Root>(cursor, fields, "parameterName", (next, done) => readSyntaxReference(next, ports.TypePredicateParameterName, done), parameterNameValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<TypedPredicate, Root>(cursor, fields, "tsonic", readTypedPredicateText, tsonicValue =>
    finishSyntaxRecord<TypePredicateNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(assertsModifierValue, assertsModifierResolved => resolveSyntaxValue(parameterNameValue, parameterNameResolved => resolveSyntaxValue(typeValue, typeResolved => ({ ...header, kind, assertsModifier: assertsModifierResolved, parameterName: parameterNameResolved, type: typeResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readImportAttributeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ImportAttribute", finish: (value: SyntaxValue<ImportAttribute<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ImportAttributeName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.ImportAttributeName, done), nameValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "value", (next, done) => readSyntaxReference(next, ports.Expression, done), valueValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<ImportAttribute<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(valueValue, valueResolved => ({ ...header, kind, name: nameResolved, value: valueResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readImportAttributesSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ImportAttributes", finish: (value: SyntaxValue<ImportAttributes<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<"WithKeyword" | "AssertKeyword", Root>(cursor, fields, "token", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["WithKeyword","AssertKeyword"]), done), tokenValue =>
    fieldText<SyntaxValue<NodeList<ImportAttribute<TypedPhase>>>, Root>(cursor, fields, "attributes", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ImportAttribute, done), "NodeList", done), attributesValue =>
    fieldText<boolean, Root>(cursor, fields, "multiLine", (next, done) => atomicText(next, readBoolean, done), multiLineValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<ImportAttributes<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(attributesValue, attributesResolved => ({ ...header, kind, token: tokenValue, attributes: attributesResolved, multiLine: multiLineValue, tsonic: tsonicValue })),
    }, finish))))));
}

export function readTypeQueryNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TypeQuery", finish: (value: SyntaxValue<TypeQueryNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<TypeNode<TypedPhase>> | null>, Root>(cursor, fields, "typeArguments", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), "NodeList", done), done), typeArgumentsValue =>
    fieldText<SyntaxValue<EntityName<TypedPhase>>, Root>(cursor, fields, "exprName", (next, done) => readSyntaxReference(next, ports.EntityName, done), exprNameValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<TypeQueryNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeArgumentsValue, typeArgumentsResolved => resolveSyntaxValue(exprNameValue, exprNameResolved => ({ ...header, kind, typeArguments: typeArgumentsResolved, exprName: exprNameResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readMappedTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "MappedType", finish: (value: SyntaxValue<MappedTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ReadonlyKeyword<TypedPhase> | PlusToken<TypedPhase> | MinusToken<TypedPhase> | null>, Root>(cursor, fields, "readonlyToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, syntaxAlternatives<ReadonlyKeyword<TypedPhase> | PlusToken<TypedPhase> | MinusToken<TypedPhase>>([ports.ReadonlyKeyword, ports.PlusToken, ports.MinusToken]), done), done), readonlyTokenValue =>
    fieldText<SyntaxValue<TypeParameterDeclaration<TypedPhase>>, Root>(cursor, fields, "typeParameter", (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), typeParameterValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "nameType", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), nameTypeValue =>
    fieldText<SyntaxValue<QuestionToken<TypedPhase> | PlusToken<TypedPhase> | MinusToken<TypedPhase> | null>, Root>(cursor, fields, "questionToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, syntaxAlternatives<QuestionToken<TypedPhase> | PlusToken<TypedPhase> | MinusToken<TypedPhase>>([ports.QuestionToken, ports.PlusToken, ports.MinusToken]), done), done), questionTokenValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<NodeList<TypeElement<TypedPhase>> | null>, Root>(cursor, fields, "members", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeElement, done), "NodeList", done), done), membersValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<MappedTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(readonlyTokenValue, readonlyTokenResolved => resolveSyntaxValue(typeParameterValue, typeParameterResolved => resolveSyntaxValue(nameTypeValue, nameTypeResolved => resolveSyntaxValue(questionTokenValue, questionTokenResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(membersValue, membersResolved => ({ ...header, kind, readonlyToken: readonlyTokenResolved, typeParameter: typeParameterResolved, nameType: nameTypeResolved, questionToken: questionTokenResolved, type: typeResolved, members: membersResolved, tsonic: tsonicValue }))))))),
    }, finish)))))))));
}

export function readTypeLiteralNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TypeLiteral", finish: (value: SyntaxValue<TypeLiteralNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<TypeElement<TypedPhase>>>, Root>(cursor, fields, "members", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeElement, done), "NodeList", done), membersValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<TypeLiteralNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(membersValue, membersResolved => ({ ...header, kind, members: membersResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readTupleTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TupleType", finish: (value: SyntaxValue<TupleTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<TypeNode<TypedPhase>>>, Root>(cursor, fields, "elements", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), "NodeList", done), elementsValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<TupleTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(elementsValue, elementsResolved => ({ ...header, kind, elements: elementsResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readNamedTupleMemberSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "NamedTupleMember", finish: (value: SyntaxValue<NamedTupleMember<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<DotDotDotToken<TypedPhase> | null>, Root>(cursor, fields, "dotDotDotToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.DotDotDotToken, done), done), dotDotDotTokenValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.Identifier, done), nameValue =>
    fieldText<SyntaxValue<QuestionToken<TypedPhase> | null>, Root>(cursor, fields, "questionToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.QuestionToken, done), done), questionTokenValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<NamedTupleMember<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(dotDotDotTokenValue, dotDotDotTokenResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(questionTokenValue, questionTokenResolved => resolveSyntaxValue(typeValue, typeResolved => ({ ...header, kind, dotDotDotToken: dotDotDotTokenResolved, name: nameResolved, questionToken: questionTokenResolved, type: typeResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readOptionalTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "OptionalType", finish: (value: SyntaxValue<OptionalTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<OptionalTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeValue, typeResolved => ({ ...header, kind, type: typeResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readRestTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "RestType", finish: (value: SyntaxValue<RestTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<RestTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeValue, typeResolved => ({ ...header, kind, type: typeResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readParenthesizedTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ParenthesizedType", finish: (value: SyntaxValue<ParenthesizedTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<ParenthesizedTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeValue, typeResolved => ({ ...header, kind, type: typeResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readFunctionTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "FunctionType", finish: (value: SyntaxValue<FunctionTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<ParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "parameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ParameterDeclaration, done), "NodeList", done), parametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "fullSignature", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), fullSignatureValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<FunctionTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(parametersValue, parametersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(fullSignatureValue, fullSignatureResolved => ({ ...header, kind, modifiers: modifiersResolved, typeParameters: typeParametersResolved, parameters: parametersResolved, type: typeResolved, fullSignature: fullSignatureResolved, tsonic: tsonicValue })))))),
    }, finish))))))));
}

export function readConstructorTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ConstructorType", finish: (value: SyntaxValue<ConstructorTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<ParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "parameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ParameterDeclaration, done), "NodeList", done), parametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "fullSignature", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), fullSignatureValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<ConstructorTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(parametersValue, parametersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(fullSignatureValue, fullSignatureResolved => ({ ...header, kind, modifiers: modifiersResolved, typeParameters: typeParametersResolved, parameters: parametersResolved, type: typeResolved, fullSignature: fullSignatureResolved, tsonic: tsonicValue })))))),
    }, finish))))))));
}

export function readTemplateLiteralTypeNodeSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TemplateLiteralType", finish: (value: SyntaxValue<TemplateLiteralTypeNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TemplateHead<TypedPhase>>, Root>(cursor, fields, "head", (next, done) => readSyntaxReference(next, ports.TemplateHead, done), headValue =>
    fieldText<SyntaxValue<NodeList<TemplateLiteralTypeSpan<TypedPhase>>>, Root>(cursor, fields, "templateSpans", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TemplateLiteralTypeSpan, done), "NodeList", done), templateSpansValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<TemplateLiteralTypeNode<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(headValue, headResolved => resolveSyntaxValue(templateSpansValue, templateSpansResolved => ({ ...header, kind, head: headResolved, templateSpans: templateSpansResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readTemplateLiteralTypeSpanSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TemplateLiteralTypeSpan", finish: (value: SyntaxValue<TemplateLiteralTypeSpan<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<SyntaxValue<TemplateMiddleOrTail<TypedPhase>>, Root>(cursor, fields, "literal", (next, done) => readSyntaxReference(next, ports.TemplateMiddleOrTail, done), literalValue =>
    fieldText<TypedType, Root>(cursor, fields, "tsonic", readTypedTypeText, tsonicValue =>
    finishSyntaxRecord<TemplateLiteralTypeSpan<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(literalValue, literalResolved => ({ ...header, kind, type: typeResolved, literal: literalResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readTypeParameterDeclarationSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TypeParameter", finish: (value: SyntaxValue<TypeParameterDeclaration<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.Identifier, done), nameValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "constraint", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), constraintValue =>
    fieldText<SyntaxValue<Expression<TypedPhase> | null>, Root>(cursor, fields, "expression", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Expression, done), done), expressionValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "defaultType", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), defaultTypeValue =>
    fieldText<TypedTypeParameter, Root>(cursor, fields, "tsonic", readTypedTypeParameterText, tsonicValue =>
    finishSyntaxRecord<TypeParameterDeclaration<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(constraintValue, constraintResolved => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(defaultTypeValue, defaultTypeResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, constraint: constraintResolved, expression: expressionResolved, defaultType: defaultTypeResolved, tsonic: tsonicValue })))))),
    }, finish))))))));
}
