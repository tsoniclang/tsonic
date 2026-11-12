import type { TokenFlag, NodeList, ModifierList, Identifier, PrivateIdentifier, QualifiedName, ComputedPropertyName, Decorator, ParameterDeclaration, OmittedExpression, KeywordExpression, StringLiteral, NumericLiteral, BigIntLiteral, RegularExpressionLiteral, NoSubstitutionTemplateLiteral, BinaryExpression, PrefixUnaryExpression, PostfixUnaryExpression, YieldExpression, ArrowFunction, FunctionExpression, AsExpression, SatisfiesExpression, ConditionalExpression, PropertyAccessExpression, ElementAccessExpression, CallExpression, NewExpression, MetaProperty, NonNullExpression, SpreadElement, TemplateExpression, TemplateSpan, TaggedTemplateExpression, ParenthesizedExpression, ArrayLiteralExpression, ObjectLiteralExpression, SpreadAssignment, PropertyAssignment, ShorthandPropertyAssignment, DeleteExpression, TypeOfExpression, VoidExpression, AwaitExpression, TypeAssertion, ExpressionWithTypeArguments, TemplateHead, TemplateMiddle, TemplateTail, PartiallyEmittedExpression, TypeParameterDeclaration, SyntheticReferenceExpression, Expression, TypeNode, BlockOrExpression, PropertyName, MemberName, EntityName, TemplateMiddleOrTail, TemplateLiteral, LeftHandSideExpression, ObjectLiteralElementLike, QuestionToken, ExclamationToken, ColonToken, EqualsToken, AsteriskToken, EqualsGreaterThanToken, QuestionDotToken, BinaryOperatorToken } from "../ir-hir/contract.js";
import type { TypedValue, TypedName, TypedPropertyKey, TypedString, TypedNumber, TypedBigInt, TypedKeyword, TypedBinary, TypedUnary, TypedPrefix, TypedUpdate, TypedConditional, TypedMember, TypedApplication, TypedProtocolValue, TypedSpread, TypedObjectSpread, TypedConstruction, TypedTemplate, TypedInstantiation, TypedProperty, TypedShorthand, TypedOmission, TypedDecorator, TypedClosure, TypedPhase } from "../ir-tir/contract.js";
import type { Cursor, TextStep } from "./parse-values.js";
import type { SyntaxValue, SyntaxReadPorts } from "./parse-syntax-values.js";
import { readString, readBoolean, readNull, readStringChoice, atomicText, fieldText, arrayText } from "./parse-values.js";
import { readTypedValueText } from "./parse-tir.js";
import { readTypedNameText, readTypedPropertyKeyText, readTypedDecoratorText, readTypedOmissionText, readTypedKeywordText, readTypedStringText, readTypedNumberText, readTypedBigIntText, readTypedBinaryText, readTypedPrefixText, readTypedUpdateText, readTypedProtocolValueText, readTypedClosureText, readTypedConditionalText, readTypedMemberText, readTypedApplicationText, readTypedSpreadText, readTypedTemplateText, readTypedConstructionText, readTypedObjectSpreadText, readTypedPropertyText, readTypedShorthandText, readTypedUnaryText, readTypedInstantiationText } from "./parse-phase.js";
import { resolveSyntaxValue, syntaxAlternatives, readSyntaxRecord, finishSyntaxRecord, readSyntaxReference, readNullableSyntax, readSyntaxList } from "./parse-syntax-values.js";

export function readIdentifierSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "Identifier", finish: (value: SyntaxValue<Identifier<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<string, Root>(cursor, fields, "text", (next, done) => atomicText(next, readString, done), textValue =>
    fieldText<TypedName, Root>(cursor, fields, "tsonic", readTypedNameText, tsonicValue =>
    finishSyntaxRecord<Identifier<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, text: textValue, tsonic: tsonicValue }),
    }, finish))));
}

export function readPrivateIdentifierSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "PrivateIdentifier", finish: (value: SyntaxValue<PrivateIdentifier<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<string, Root>(cursor, fields, "text", (next, done) => atomicText(next, readString, done), textValue =>
    fieldText<TypedName, Root>(cursor, fields, "tsonic", readTypedNameText, tsonicValue =>
    finishSyntaxRecord<PrivateIdentifier<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, text: textValue, tsonic: tsonicValue }),
    }, finish))));
}

export function readQualifiedNameSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "QualifiedName", finish: (value: SyntaxValue<QualifiedName<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<EntityName<TypedPhase>>, Root>(cursor, fields, "left", (next, done) => readSyntaxReference(next, ports.EntityName, done), leftValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "right", (next, done) => readSyntaxReference(next, ports.Identifier, done), rightValue =>
    fieldText<TypedName, Root>(cursor, fields, "tsonic", readTypedNameText, tsonicValue =>
    finishSyntaxRecord<QualifiedName<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(leftValue, leftResolved => resolveSyntaxValue(rightValue, rightResolved => ({ ...header, kind, left: leftResolved, right: rightResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readComputedPropertyNameSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ComputedPropertyName", finish: (value: SyntaxValue<ComputedPropertyName<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<TypedPropertyKey, Root>(cursor, fields, "tsonic", readTypedPropertyKeyText, tsonicValue =>
    finishSyntaxRecord<ComputedPropertyName<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readDecoratorSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "Decorator", finish: (value: SyntaxValue<Decorator<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<LeftHandSideExpression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.LeftHandSideExpression, done), expressionValue =>
    fieldText<TypedDecorator, Root>(cursor, fields, "tsonic", readTypedDecoratorText, tsonicValue =>
    finishSyntaxRecord<Decorator<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readOmittedExpressionSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "OmittedExpression", finish: (value: SyntaxValue<OmittedExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<TypedOmission, Root>(cursor, fields, "tsonic", readTypedOmissionText, tsonicValue =>
    finishSyntaxRecord<OmittedExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, tsonic: tsonicValue }),
    }, finish)));
}

export function readKeywordExpressionSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "NullKeyword" | "TrueKeyword" | "FalseKeyword" | "ThisKeyword" | "SuperKeyword" | "ImportKeyword", finish: (value: SyntaxValue<KeywordExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<TypedKeyword, Root>(cursor, fields, "tsonic", readTypedKeywordText, tsonicValue =>
    finishSyntaxRecord<KeywordExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, tsonic: tsonicValue }),
    }, finish)));
}

export function readStringLiteralSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "StringLiteral", finish: (value: SyntaxValue<StringLiteral<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<string, Root>(cursor, fields, "text", (next, done) => atomicText(next, readString, done), textValue =>
    fieldText<readonly TokenFlag[], Root>(cursor, fields, "tokenFlags", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"]), done), done), tokenFlagsValue =>
    fieldText<TypedString, Root>(cursor, fields, "tsonic", readTypedStringText, tsonicValue =>
    finishSyntaxRecord<StringLiteral<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, text: textValue, tokenFlags: tokenFlagsValue, tsonic: tsonicValue }),
    }, finish)))));
}

export function readNumericLiteralSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "NumericLiteral", finish: (value: SyntaxValue<NumericLiteral<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<string, Root>(cursor, fields, "text", (next, done) => atomicText(next, readString, done), textValue =>
    fieldText<readonly TokenFlag[], Root>(cursor, fields, "tokenFlags", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"]), done), done), tokenFlagsValue =>
    fieldText<TypedNumber, Root>(cursor, fields, "tsonic", readTypedNumberText, tsonicValue =>
    finishSyntaxRecord<NumericLiteral<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, text: textValue, tokenFlags: tokenFlagsValue, tsonic: tsonicValue }),
    }, finish)))));
}

export function readBigIntLiteralSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "BigIntLiteral", finish: (value: SyntaxValue<BigIntLiteral<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<string, Root>(cursor, fields, "text", (next, done) => atomicText(next, readString, done), textValue =>
    fieldText<readonly TokenFlag[], Root>(cursor, fields, "tokenFlags", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"]), done), done), tokenFlagsValue =>
    fieldText<TypedBigInt, Root>(cursor, fields, "tsonic", readTypedBigIntText, tsonicValue =>
    finishSyntaxRecord<BigIntLiteral<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, text: textValue, tokenFlags: tokenFlagsValue, tsonic: tsonicValue }),
    }, finish)))));
}

export function readRegularExpressionLiteralSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "RegularExpressionLiteral", finish: (value: SyntaxValue<RegularExpressionLiteral<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<string, Root>(cursor, fields, "text", (next, done) => atomicText(next, readString, done), textValue =>
    fieldText<readonly TokenFlag[], Root>(cursor, fields, "tokenFlags", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"]), done), done), tokenFlagsValue =>
    fieldText<TypedValue, Root>(cursor, fields, "tsonic", readTypedValueText, tsonicValue =>
    finishSyntaxRecord<RegularExpressionLiteral<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, text: textValue, tokenFlags: tokenFlagsValue, tsonic: tsonicValue }),
    }, finish)))));
}

export function readNoSubstitutionTemplateLiteralSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "NoSubstitutionTemplateLiteral", finish: (value: SyntaxValue<NoSubstitutionTemplateLiteral<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<string, Root>(cursor, fields, "text", (next, done) => atomicText(next, readString, done), textValue =>
    fieldText<readonly TokenFlag[], Root>(cursor, fields, "tokenFlags", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"]), done), done), tokenFlagsValue =>
    fieldText<string, Root>(cursor, fields, "rawText", (next, done) => atomicText(next, readString, done), rawTextValue =>
    fieldText<readonly TokenFlag[], Root>(cursor, fields, "templateFlags", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"]), done), done), templateFlagsValue =>
    fieldText<TypedString, Root>(cursor, fields, "tsonic", readTypedStringText, tsonicValue =>
    finishSyntaxRecord<NoSubstitutionTemplateLiteral<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, text: textValue, tokenFlags: tokenFlagsValue, rawText: rawTextValue, templateFlags: templateFlagsValue, tsonic: tsonicValue }),
    }, finish)))))));
}

export function readBinaryExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "BinaryExpression", finish: (value: SyntaxValue<BinaryExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "left", (next, done) => readSyntaxReference(next, ports.Expression, done), leftValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<BinaryOperatorToken<TypedPhase>>, Root>(cursor, fields, "operatorToken", (next, done) => readSyntaxReference(next, ports.BinaryOperatorToken, done), operatorTokenValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "right", (next, done) => readSyntaxReference(next, ports.Expression, done), rightValue =>
    fieldText<TypedBinary, Root>(cursor, fields, "tsonic", readTypedBinaryText, tsonicValue =>
    finishSyntaxRecord<BinaryExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(leftValue, leftResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(operatorTokenValue, operatorTokenResolved => resolveSyntaxValue(rightValue, rightResolved => ({ ...header, kind, modifiers: modifiersResolved, left: leftResolved, type: typeResolved, operatorToken: operatorTokenResolved, right: rightResolved, tsonic: tsonicValue })))))),
    }, finish))))))));
}

export function readPrefixUnaryExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "PrefixUnaryExpression", finish: (value: SyntaxValue<PrefixUnaryExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<"PlusToken" | "MinusToken" | "TildeToken" | "ExclamationToken" | "PlusPlusToken" | "MinusMinusToken", Root>(cursor, fields, "operator", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PlusToken","MinusToken","TildeToken","ExclamationToken","PlusPlusToken","MinusMinusToken"]), done), operatorValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "operand", (next, done) => readSyntaxReference(next, ports.Expression, done), operandValue =>
    fieldText<TypedPrefix, Root>(cursor, fields, "tsonic", readTypedPrefixText, tsonicValue =>
    finishSyntaxRecord<PrefixUnaryExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(operandValue, operandResolved => ({ ...header, kind, operator: operatorValue, operand: operandResolved, tsonic: tsonicValue })),
    }, finish)))));
}

export function readPostfixUnaryExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "PostfixUnaryExpression", finish: (value: SyntaxValue<PostfixUnaryExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "operand", (next, done) => readSyntaxReference(next, ports.Expression, done), operandValue =>
    fieldText<"PlusPlusToken" | "MinusMinusToken", Root>(cursor, fields, "operator", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PlusPlusToken","MinusMinusToken"]), done), operatorValue =>
    fieldText<TypedUpdate, Root>(cursor, fields, "tsonic", readTypedUpdateText, tsonicValue =>
    finishSyntaxRecord<PostfixUnaryExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(operandValue, operandResolved => ({ ...header, kind, operand: operandResolved, operator: operatorValue, tsonic: tsonicValue })),
    }, finish)))));
}

export function readYieldExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "YieldExpression", finish: (value: SyntaxValue<YieldExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<AsteriskToken<TypedPhase> | null>, Root>(cursor, fields, "asteriskToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.AsteriskToken, done), done), asteriskTokenValue =>
    fieldText<SyntaxValue<Expression<TypedPhase> | null>, Root>(cursor, fields, "expression", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Expression, done), done), expressionValue =>
    fieldText<TypedProtocolValue, Root>(cursor, fields, "tsonic", readTypedProtocolValueText, tsonicValue =>
    finishSyntaxRecord<YieldExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(asteriskTokenValue, asteriskTokenResolved => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, asteriskToken: asteriskTokenResolved, expression: expressionResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readArrowFunctionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ArrowFunction", finish: (value: SyntaxValue<ArrowFunction<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<ParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "parameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ParameterDeclaration, done), "NodeList", done), parametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "fullSignature", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), fullSignatureValue =>
    fieldText<SyntaxValue<AsteriskToken<TypedPhase> | null>, Root>(cursor, fields, "asteriskToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.AsteriskToken, done), done), asteriskTokenValue =>
    fieldText<SyntaxValue<BlockOrExpression<TypedPhase> | null>, Root>(cursor, fields, "body", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.BlockOrExpression, done), done), bodyValue =>
    fieldText<SyntaxValue<EqualsGreaterThanToken<TypedPhase>>, Root>(cursor, fields, "equalsGreaterThanToken", (next, done) => readSyntaxReference(next, ports.EqualsGreaterThanToken, done), equalsGreaterThanTokenValue =>
    fieldText<TypedClosure, Root>(cursor, fields, "tsonic", readTypedClosureText, tsonicValue =>
    finishSyntaxRecord<ArrowFunction<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(parametersValue, parametersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(fullSignatureValue, fullSignatureResolved => resolveSyntaxValue(asteriskTokenValue, asteriskTokenResolved => resolveSyntaxValue(bodyValue, bodyResolved => resolveSyntaxValue(equalsGreaterThanTokenValue, equalsGreaterThanTokenResolved => ({ ...header, kind, modifiers: modifiersResolved, typeParameters: typeParametersResolved, parameters: parametersResolved, type: typeResolved, fullSignature: fullSignatureResolved, asteriskToken: asteriskTokenResolved, body: bodyResolved, equalsGreaterThanToken: equalsGreaterThanTokenResolved, tsonic: tsonicValue }))))))))),
    }, finish)))))))))));
}

export function readFunctionExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "FunctionExpression", finish: (value: SyntaxValue<FunctionExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<NodeList<TypeParameterDeclaration<TypedPhase>> | null>, Root>(cursor, fields, "typeParameters", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeParameterDeclaration, done), "NodeList", done), done), typeParametersValue =>
    fieldText<SyntaxValue<NodeList<ParameterDeclaration<TypedPhase>>>, Root>(cursor, fields, "parameters", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ParameterDeclaration, done), "NodeList", done), parametersValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "fullSignature", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), fullSignatureValue =>
    fieldText<SyntaxValue<AsteriskToken<TypedPhase> | null>, Root>(cursor, fields, "asteriskToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.AsteriskToken, done), done), asteriskTokenValue =>
    fieldText<SyntaxValue<BlockOrExpression<TypedPhase> | null>, Root>(cursor, fields, "body", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.BlockOrExpression, done), done), bodyValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase> | null>, Root>(cursor, fields, "name", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Identifier, done), done), nameValue =>
    fieldText<TypedClosure, Root>(cursor, fields, "tsonic", readTypedClosureText, tsonicValue =>
    finishSyntaxRecord<FunctionExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(typeParametersValue, typeParametersResolved => resolveSyntaxValue(parametersValue, parametersResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(fullSignatureValue, fullSignatureResolved => resolveSyntaxValue(asteriskTokenValue, asteriskTokenResolved => resolveSyntaxValue(bodyValue, bodyResolved => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, modifiers: modifiersResolved, typeParameters: typeParametersResolved, parameters: parametersResolved, type: typeResolved, fullSignature: fullSignatureResolved, asteriskToken: asteriskTokenResolved, body: bodyResolved, name: nameResolved, tsonic: tsonicValue }))))))))),
    }, finish)))))))))));
}

export function readAsExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "AsExpression", finish: (value: SyntaxValue<AsExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<TypedValue, Root>(cursor, fields, "tsonic", readTypedValueText, tsonicValue =>
    finishSyntaxRecord<AsExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(typeValue, typeResolved => ({ ...header, kind, expression: expressionResolved, type: typeResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readSatisfiesExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "SatisfiesExpression", finish: (value: SyntaxValue<SatisfiesExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<TypedValue, Root>(cursor, fields, "tsonic", readTypedValueText, tsonicValue =>
    finishSyntaxRecord<SatisfiesExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(typeValue, typeResolved => ({ ...header, kind, expression: expressionResolved, type: typeResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readConditionalExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ConditionalExpression", finish: (value: SyntaxValue<ConditionalExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "condition", (next, done) => readSyntaxReference(next, ports.Expression, done), conditionValue =>
    fieldText<SyntaxValue<QuestionToken<TypedPhase>>, Root>(cursor, fields, "questionToken", (next, done) => readSyntaxReference(next, ports.QuestionToken, done), questionTokenValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "whenTrue", (next, done) => readSyntaxReference(next, ports.Expression, done), whenTrueValue =>
    fieldText<SyntaxValue<ColonToken<TypedPhase>>, Root>(cursor, fields, "colonToken", (next, done) => readSyntaxReference(next, ports.ColonToken, done), colonTokenValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "whenFalse", (next, done) => readSyntaxReference(next, ports.Expression, done), whenFalseValue =>
    fieldText<TypedConditional, Root>(cursor, fields, "tsonic", readTypedConditionalText, tsonicValue =>
    finishSyntaxRecord<ConditionalExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(conditionValue, conditionResolved => resolveSyntaxValue(questionTokenValue, questionTokenResolved => resolveSyntaxValue(whenTrueValue, whenTrueResolved => resolveSyntaxValue(colonTokenValue, colonTokenResolved => resolveSyntaxValue(whenFalseValue, whenFalseResolved => ({ ...header, kind, condition: conditionResolved, questionToken: questionTokenResolved, whenTrue: whenTrueResolved, colonToken: colonTokenResolved, whenFalse: whenFalseResolved, tsonic: tsonicValue })))))),
    }, finish))))))));
}

export function readPropertyAccessExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "PropertyAccessExpression", finish: (value: SyntaxValue<PropertyAccessExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<QuestionDotToken<TypedPhase> | null>, Root>(cursor, fields, "questionDotToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.QuestionDotToken, done), done), questionDotTokenValue =>
    fieldText<SyntaxValue<MemberName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.MemberName, done), nameValue =>
    fieldText<TypedMember, Root>(cursor, fields, "tsonic", readTypedMemberText, tsonicValue =>
    finishSyntaxRecord<PropertyAccessExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(questionDotTokenValue, questionDotTokenResolved => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, expression: expressionResolved, questionDotToken: questionDotTokenResolved, name: nameResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readElementAccessExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ElementAccessExpression", finish: (value: SyntaxValue<ElementAccessExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<QuestionDotToken<TypedPhase> | null>, Root>(cursor, fields, "questionDotToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.QuestionDotToken, done), done), questionDotTokenValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "argumentExpression", (next, done) => readSyntaxReference(next, ports.Expression, done), argumentExpressionValue =>
    fieldText<TypedMember, Root>(cursor, fields, "tsonic", readTypedMemberText, tsonicValue =>
    finishSyntaxRecord<ElementAccessExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(questionDotTokenValue, questionDotTokenResolved => resolveSyntaxValue(argumentExpressionValue, argumentExpressionResolved => ({ ...header, kind, expression: expressionResolved, questionDotToken: questionDotTokenResolved, argumentExpression: argumentExpressionResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readCallExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "CallExpression", finish: (value: SyntaxValue<CallExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<QuestionDotToken<TypedPhase> | null>, Root>(cursor, fields, "questionDotToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.QuestionDotToken, done), done), questionDotTokenValue =>
    fieldText<SyntaxValue<NodeList<TypeNode<TypedPhase>> | null>, Root>(cursor, fields, "typeArguments", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), "NodeList", done), done), typeArgumentsValue =>
    fieldText<SyntaxValue<NodeList<Expression<TypedPhase>>>, Root>(cursor, fields, "arguments", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.Expression, done), "NodeList", done), argumentsValue =>
    fieldText<TypedApplication, Root>(cursor, fields, "tsonic", readTypedApplicationText, tsonicValue =>
    finishSyntaxRecord<CallExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(questionDotTokenValue, questionDotTokenResolved => resolveSyntaxValue(typeArgumentsValue, typeArgumentsResolved => resolveSyntaxValue(argumentsValue, argumentsResolved => ({ ...header, kind, expression: expressionResolved, questionDotToken: questionDotTokenResolved, typeArguments: typeArgumentsResolved, arguments: argumentsResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readNewExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "NewExpression", finish: (value: SyntaxValue<NewExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<NodeList<TypeNode<TypedPhase>> | null>, Root>(cursor, fields, "typeArguments", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), "NodeList", done), done), typeArgumentsValue =>
    fieldText<SyntaxValue<NodeList<Expression<TypedPhase>> | null>, Root>(cursor, fields, "arguments", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.Expression, done), "NodeList", done), done), argumentsValue =>
    fieldText<TypedApplication, Root>(cursor, fields, "tsonic", readTypedApplicationText, tsonicValue =>
    finishSyntaxRecord<NewExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(typeArgumentsValue, typeArgumentsResolved => resolveSyntaxValue(argumentsValue, argumentsResolved => ({ ...header, kind, expression: expressionResolved, typeArguments: typeArgumentsResolved, arguments: argumentsResolved, tsonic: tsonicValue })))),
    }, finish))))));
}

export function readMetaPropertySyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "MetaProperty", finish: (value: SyntaxValue<MetaProperty<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<"ImportKeyword" | "NewKeyword", Root>(cursor, fields, "keywordToken", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["ImportKeyword","NewKeyword"]), done), keywordTokenValue =>
    fieldText<SyntaxValue<Identifier<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.Identifier, done), nameValue =>
    fieldText<TypedValue, Root>(cursor, fields, "tsonic", readTypedValueText, tsonicValue =>
    finishSyntaxRecord<MetaProperty<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(nameValue, nameResolved => ({ ...header, kind, keywordToken: keywordTokenValue, name: nameResolved, tsonic: tsonicValue })),
    }, finish)))));
}

export function readNonNullExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "NonNullExpression", finish: (value: SyntaxValue<NonNullExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<TypedValue, Root>(cursor, fields, "tsonic", readTypedValueText, tsonicValue =>
    finishSyntaxRecord<NonNullExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readSpreadElementSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "SpreadElement", finish: (value: SyntaxValue<SpreadElement<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<TypedSpread, Root>(cursor, fields, "tsonic", readTypedSpreadText, tsonicValue =>
    finishSyntaxRecord<SpreadElement<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readTemplateExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TemplateExpression", finish: (value: SyntaxValue<TemplateExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TemplateHead<TypedPhase>>, Root>(cursor, fields, "head", (next, done) => readSyntaxReference(next, ports.TemplateHead, done), headValue =>
    fieldText<SyntaxValue<NodeList<TemplateSpan<TypedPhase>>>, Root>(cursor, fields, "templateSpans", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TemplateSpan, done), "NodeList", done), templateSpansValue =>
    fieldText<TypedTemplate, Root>(cursor, fields, "tsonic", readTypedTemplateText, tsonicValue =>
    finishSyntaxRecord<TemplateExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(headValue, headResolved => resolveSyntaxValue(templateSpansValue, templateSpansResolved => ({ ...header, kind, head: headResolved, templateSpans: templateSpansResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readTemplateSpanSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TemplateSpan", finish: (value: SyntaxValue<TemplateSpan<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<TemplateMiddleOrTail<TypedPhase>>, Root>(cursor, fields, "literal", (next, done) => readSyntaxReference(next, ports.TemplateMiddleOrTail, done), literalValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<TemplateSpan<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(literalValue, literalResolved => ({ ...header, kind, expression: expressionResolved, literal: literalResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readTaggedTemplateExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TaggedTemplateExpression", finish: (value: SyntaxValue<TaggedTemplateExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "tag", (next, done) => readSyntaxReference(next, ports.Expression, done), tagValue =>
    fieldText<SyntaxValue<QuestionDotToken<TypedPhase> | null>, Root>(cursor, fields, "questionDotToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.QuestionDotToken, done), done), questionDotTokenValue =>
    fieldText<SyntaxValue<NodeList<TypeNode<TypedPhase>> | null>, Root>(cursor, fields, "typeArguments", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), "NodeList", done), done), typeArgumentsValue =>
    fieldText<SyntaxValue<TemplateLiteral<TypedPhase>>, Root>(cursor, fields, "template", (next, done) => readSyntaxReference(next, ports.TemplateLiteral, done), templateValue =>
    fieldText<TypedApplication, Root>(cursor, fields, "tsonic", readTypedApplicationText, tsonicValue =>
    finishSyntaxRecord<TaggedTemplateExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(tagValue, tagResolved => resolveSyntaxValue(questionDotTokenValue, questionDotTokenResolved => resolveSyntaxValue(typeArgumentsValue, typeArgumentsResolved => resolveSyntaxValue(templateValue, templateResolved => ({ ...header, kind, tag: tagResolved, questionDotToken: questionDotTokenResolved, typeArguments: typeArgumentsResolved, template: templateResolved, tsonic: tsonicValue }))))),
    }, finish)))))));
}

export function readParenthesizedExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ParenthesizedExpression", finish: (value: SyntaxValue<ParenthesizedExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<TypedValue, Root>(cursor, fields, "tsonic", readTypedValueText, tsonicValue =>
    finishSyntaxRecord<ParenthesizedExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readArrayLiteralExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ArrayLiteralExpression", finish: (value: SyntaxValue<ArrayLiteralExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<Expression<TypedPhase>>>, Root>(cursor, fields, "elements", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.Expression, done), "NodeList", done), elementsValue =>
    fieldText<boolean, Root>(cursor, fields, "multiLine", (next, done) => atomicText(next, readBoolean, done), multiLineValue =>
    fieldText<TypedConstruction, Root>(cursor, fields, "tsonic", readTypedConstructionText, tsonicValue =>
    finishSyntaxRecord<ArrayLiteralExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(elementsValue, elementsResolved => ({ ...header, kind, elements: elementsResolved, multiLine: multiLineValue, tsonic: tsonicValue })),
    }, finish)))));
}

export function readObjectLiteralExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ObjectLiteralExpression", finish: (value: SyntaxValue<ObjectLiteralExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<NodeList<ObjectLiteralElementLike<TypedPhase>>>, Root>(cursor, fields, "properties", (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ObjectLiteralElementLike, done), "NodeList", done), propertiesValue =>
    fieldText<boolean, Root>(cursor, fields, "multiLine", (next, done) => atomicText(next, readBoolean, done), multiLineValue =>
    fieldText<TypedConstruction, Root>(cursor, fields, "tsonic", readTypedConstructionText, tsonicValue =>
    finishSyntaxRecord<ObjectLiteralExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(propertiesValue, propertiesResolved => ({ ...header, kind, properties: propertiesResolved, multiLine: multiLineValue, tsonic: tsonicValue })),
    }, finish)))));
}

export function readSpreadAssignmentSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "SpreadAssignment", finish: (value: SyntaxValue<SpreadAssignment<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<TypedObjectSpread, Root>(cursor, fields, "tsonic", readTypedObjectSpreadText, tsonicValue =>
    finishSyntaxRecord<SpreadAssignment<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readPropertyAssignmentSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "PropertyAssignment", finish: (value: SyntaxValue<PropertyAssignment<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<PropertyName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.PropertyName, done), nameValue =>
    fieldText<SyntaxValue<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase> | null>, Root>(cursor, fields, "postfixToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, syntaxAlternatives<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase>>([ports.QuestionToken, ports.ExclamationToken]), done), done), postfixTokenValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "initializer", (next, done) => readSyntaxReference(next, ports.Expression, done), initializerValue =>
    fieldText<TypedProperty, Root>(cursor, fields, "tsonic", readTypedPropertyText, tsonicValue =>
    finishSyntaxRecord<PropertyAssignment<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(postfixTokenValue, postfixTokenResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(initializerValue, initializerResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, postfixToken: postfixTokenResolved, type: typeResolved, initializer: initializerResolved, tsonic: tsonicValue })))))),
    }, finish))))))));
}

export function readShorthandPropertyAssignmentSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ShorthandPropertyAssignment", finish: (value: SyntaxValue<ShorthandPropertyAssignment<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<ModifierList<TypedPhase> | null>, Root>(cursor, fields, "modifiers", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.ModifierLike, done), "ModifierList", done), done), modifiersValue =>
    fieldText<SyntaxValue<PropertyName<TypedPhase>>, Root>(cursor, fields, "name", (next, done) => readSyntaxReference(next, ports.PropertyName, done), nameValue =>
    fieldText<SyntaxValue<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase> | null>, Root>(cursor, fields, "postfixToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, syntaxAlternatives<QuestionToken<TypedPhase> | ExclamationToken<TypedPhase>>([ports.QuestionToken, ports.ExclamationToken]), done), done), postfixTokenValue =>
    fieldText<SyntaxValue<TypeNode<TypedPhase> | null>, Root>(cursor, fields, "type", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), done), typeValue =>
    fieldText<SyntaxValue<EqualsToken<TypedPhase> | null>, Root>(cursor, fields, "equalsToken", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.EqualsToken, done), done), equalsTokenValue =>
    fieldText<SyntaxValue<Expression<TypedPhase> | null>, Root>(cursor, fields, "objectAssignmentInitializer", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxReference(next, ports.Expression, done), done), objectAssignmentInitializerValue =>
    fieldText<TypedShorthand, Root>(cursor, fields, "tsonic", readTypedShorthandText, tsonicValue =>
    finishSyntaxRecord<ShorthandPropertyAssignment<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(modifiersValue, modifiersResolved => resolveSyntaxValue(nameValue, nameResolved => resolveSyntaxValue(postfixTokenValue, postfixTokenResolved => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(equalsTokenValue, equalsTokenResolved => resolveSyntaxValue(objectAssignmentInitializerValue, objectAssignmentInitializerResolved => ({ ...header, kind, modifiers: modifiersResolved, name: nameResolved, postfixToken: postfixTokenResolved, type: typeResolved, equalsToken: equalsTokenResolved, objectAssignmentInitializer: objectAssignmentInitializerResolved, tsonic: tsonicValue }))))))),
    }, finish)))))))));
}

export function readDeleteExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "DeleteExpression", finish: (value: SyntaxValue<DeleteExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<TypedUnary, Root>(cursor, fields, "tsonic", readTypedUnaryText, tsonicValue =>
    finishSyntaxRecord<DeleteExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readTypeOfExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TypeOfExpression", finish: (value: SyntaxValue<TypeOfExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<TypedUnary, Root>(cursor, fields, "tsonic", readTypedUnaryText, tsonicValue =>
    finishSyntaxRecord<TypeOfExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readVoidExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "VoidExpression", finish: (value: SyntaxValue<VoidExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<TypedUnary, Root>(cursor, fields, "tsonic", readTypedUnaryText, tsonicValue =>
    finishSyntaxRecord<VoidExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readAwaitExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "AwaitExpression", finish: (value: SyntaxValue<AwaitExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<TypedProtocolValue, Root>(cursor, fields, "tsonic", readTypedProtocolValueText, tsonicValue =>
    finishSyntaxRecord<AwaitExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readTypeAssertionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "TypeAssertionExpression", finish: (value: SyntaxValue<TypeAssertion<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<TypeNode<TypedPhase>>, Root>(cursor, fields, "type", (next, done) => readSyntaxReference(next, ports.TypeNode, done), typeValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<TypedValue, Root>(cursor, fields, "tsonic", readTypedValueText, tsonicValue =>
    finishSyntaxRecord<TypeAssertion<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(typeValue, typeResolved => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, type: typeResolved, expression: expressionResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readExpressionWithTypeArgumentsSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "ExpressionWithTypeArguments", finish: (value: SyntaxValue<ExpressionWithTypeArguments<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<NodeList<TypeNode<TypedPhase>> | null>, Root>(cursor, fields, "typeArguments", (next, done) => readNullableSyntax(next, (next, done) => readSyntaxList(next, (next, done) => readSyntaxReference(next, ports.TypeNode, done), "NodeList", done), done), typeArgumentsValue =>
    fieldText<TypedInstantiation, Root>(cursor, fields, "tsonic", readTypedInstantiationText, tsonicValue =>
    finishSyntaxRecord<ExpressionWithTypeArguments<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(typeArgumentsValue, typeArgumentsResolved => ({ ...header, kind, expression: expressionResolved, typeArguments: typeArgumentsResolved, tsonic: tsonicValue }))),
    }, finish)))));
}

export function readTemplateHeadSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "TemplateHead", finish: (value: SyntaxValue<TemplateHead<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<string, Root>(cursor, fields, "text", (next, done) => atomicText(next, readString, done), textValue =>
    fieldText<readonly TokenFlag[], Root>(cursor, fields, "tokenFlags", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"]), done), done), tokenFlagsValue =>
    fieldText<string, Root>(cursor, fields, "rawText", (next, done) => atomicText(next, readString, done), rawTextValue =>
    fieldText<readonly TokenFlag[], Root>(cursor, fields, "templateFlags", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"]), done), done), templateFlagsValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<TemplateHead<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, text: textValue, tokenFlags: tokenFlagsValue, rawText: rawTextValue, templateFlags: templateFlagsValue, tsonic: tsonicValue }),
    }, finish)))))));
}

export function readTemplateMiddleSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "TemplateMiddle", finish: (value: SyntaxValue<TemplateMiddle<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<string, Root>(cursor, fields, "text", (next, done) => atomicText(next, readString, done), textValue =>
    fieldText<readonly TokenFlag[], Root>(cursor, fields, "tokenFlags", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"]), done), done), tokenFlagsValue =>
    fieldText<string, Root>(cursor, fields, "rawText", (next, done) => atomicText(next, readString, done), rawTextValue =>
    fieldText<readonly TokenFlag[], Root>(cursor, fields, "templateFlags", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"]), done), done), templateFlagsValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<TemplateMiddle<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, text: textValue, tokenFlags: tokenFlagsValue, rawText: rawTextValue, templateFlags: templateFlagsValue, tsonic: tsonicValue }),
    }, finish)))))));
}

export function readTemplateTailSyntax<Root>(cursor: Cursor, _ports: SyntaxReadPorts, kind: "TemplateTail", finish: (value: SyntaxValue<TemplateTail<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<string, Root>(cursor, fields, "text", (next, done) => atomicText(next, readString, done), textValue =>
    fieldText<readonly TokenFlag[], Root>(cursor, fields, "tokenFlags", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"]), done), done), tokenFlagsValue =>
    fieldText<string, Root>(cursor, fields, "rawText", (next, done) => atomicText(next, readString, done), rawTextValue =>
    fieldText<readonly TokenFlag[], Root>(cursor, fields, "templateFlags", (next, done) => arrayText(next, (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["PrecedingLineBreak","PrecedingJSDocComment","Unterminated","ExtendedUnicodeEscape","Scientific","Octal","HexSpecifier","BinarySpecifier","OctalSpecifier","ContainsSeparator","UnicodeEscape","ContainsInvalidEscape","HexEscape","ContainsLeadingZero","ContainsInvalidSeparator","PrecedingJSDocLeadingAsterisks","SingleQuote","PrecedingJSDocWithDeprecated","PrecedingJSDocWithSeeOrLink"]), done), done), templateFlagsValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<TemplateTail<TypedPhase>, Root>(cursor, fields, {
      resolve: () => ({ ...header, kind, text: textValue, tokenFlags: tokenFlagsValue, rawText: rawTextValue, templateFlags: templateFlagsValue, tsonic: tsonicValue }),
    }, finish)))))));
}

export function readPartiallyEmittedExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "PartiallyEmittedExpression", finish: (value: SyntaxValue<PartiallyEmittedExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<PartiallyEmittedExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => ({ ...header, kind, expression: expressionResolved, tsonic: tsonicValue })),
    }, finish))));
}

export function readSyntheticReferenceExpressionSyntax<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: "SyntheticReferenceExpression", finish: (value: SyntaxValue<SyntheticReferenceExpression<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "expression", (next, done) => readSyntaxReference(next, ports.Expression, done), expressionValue =>
    fieldText<SyntaxValue<Expression<TypedPhase>>, Root>(cursor, fields, "thisArg", (next, done) => readSyntaxReference(next, ports.Expression, done), thisArgValue =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonicValue =>
    finishSyntaxRecord<SyntheticReferenceExpression<TypedPhase>, Root>(cursor, fields, {
      resolve: () => resolveSyntaxValue(expressionValue, expressionResolved => resolveSyntaxValue(thisArgValue, thisArgResolved => ({ ...header, kind, expression: expressionResolved, thisArg: thisArgResolved, tsonic: tsonicValue }))),
    }, finish)))));
}
