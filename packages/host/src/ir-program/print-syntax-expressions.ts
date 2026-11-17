import type { Identifier, PrivateIdentifier, QualifiedName, ComputedPropertyName, Decorator, OmittedExpression, KeywordExpression, StringLiteral, NumericLiteral, BigIntLiteral, RegularExpressionLiteral, NoSubstitutionTemplateLiteral, BinaryExpression, PrefixUnaryExpression, PostfixUnaryExpression, YieldExpression, ArrowFunction, FunctionExpression, AsExpression, SatisfiesExpression, ConditionalExpression, PropertyAccessExpression, ElementAccessExpression, CallExpression, NewExpression, MetaProperty, NonNullExpression, SpreadElement, TemplateExpression, TemplateSpan, TaggedTemplateExpression, ParenthesizedExpression, ArrayLiteralExpression, ObjectLiteralExpression, SpreadAssignment, PropertyAssignment, ShorthandPropertyAssignment, DeleteExpression, TypeOfExpression, VoidExpression, AwaitExpression, TypeAssertion, ExpressionWithTypeArguments, TemplateHead, TemplateMiddle, TemplateTail, PartiallyEmittedExpression, SyntheticReferenceExpression } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { SyntaxTextContext, TextWork } from "./text-values.js";
import { textSyntaxHeader, field, record, sequence, token, text, boolean, textNodeList } from "./text-values.js";
import { textTypedName, textTypedPropertyKey, textTypedDecorator, textTypedOmission, textTypedKeyword, textTypedString, textTypedNumber, textTypedBigInt, textTypedBinary, textTypedPrefix, textTypedUpdate, textTypedProtocolValue, textTypedClosure, textTypedConditional, textTypedMember, textTypedApplication, textTypedSpread, textTypedTemplate, textTypedConstruction, textTypedObjectSpread, textTypedProperty, textTypedShorthand, textTypedUnary, textTypedInstantiation } from "./text-phase.js";
import { textTypedValue } from "./text-tir.js";

export function printIdentifier(node: Identifier<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", text(node.text)),
    field("tsonic", textTypedName(node.tsonic)),
  ]);
}

export function printPrivateIdentifier(node: PrivateIdentifier<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", text(node.text)),
    field("tsonic", textTypedName(node.tsonic)),
  ]);
}

export function printQualifiedName(node: QualifiedName<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("left", context.reference(node.left)),
    field("right", context.reference(node.right)),
    field("tsonic", textTypedName(node.tsonic)),
  ]);
}

export function printComputedPropertyName(node: ComputedPropertyName<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", textTypedPropertyKey(node.tsonic)),
  ]);
}

export function printDecorator(node: Decorator<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", textTypedDecorator(node.tsonic)),
  ]);
}

export function printOmittedExpression(node: OmittedExpression<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tsonic", textTypedOmission(node.tsonic)),
  ]);
}

export function printKeywordExpression(node: KeywordExpression<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tsonic", textTypedKeyword(node.tsonic)),
  ]);
}

export function printStringLiteral(node: StringLiteral<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", text(node.text)),
    field("tokenFlags", sequence(node.tokenFlags, entry => text(entry))),
    field("tsonic", textTypedString(node.tsonic)),
  ]);
}

export function printNumericLiteral(node: NumericLiteral<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", text(node.text)),
    field("tokenFlags", sequence(node.tokenFlags, entry => text(entry))),
    field("tsonic", textTypedNumber(node.tsonic)),
  ]);
}

export function printBigIntLiteral(node: BigIntLiteral<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", text(node.text)),
    field("tokenFlags", sequence(node.tokenFlags, entry => text(entry))),
    field("tsonic", textTypedBigInt(node.tsonic)),
  ]);
}

export function printRegularExpressionLiteral(node: RegularExpressionLiteral<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", text(node.text)),
    field("tokenFlags", sequence(node.tokenFlags, entry => text(entry))),
    field("tsonic", textTypedValue(node.tsonic)),
  ]);
}

export function printNoSubstitutionTemplateLiteral(node: NoSubstitutionTemplateLiteral<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", text(node.text)),
    field("tokenFlags", sequence(node.tokenFlags, entry => text(entry))),
    field("rawText", text(node.rawText)),
    field("templateFlags", sequence(node.templateFlags, entry => text(entry))),
    field("tsonic", textTypedString(node.tsonic)),
  ]);
}

export function printBinaryExpression(node: BinaryExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("left", context.reference(node.left)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("operatorToken", context.reference(node.operatorToken)),
    field("right", context.reference(node.right)),
    field("tsonic", textTypedBinary(node.tsonic)),
  ]);
}

export function printPrefixUnaryExpression(node: PrefixUnaryExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("operator", text(node.operator)),
    field("operand", context.reference(node.operand)),
    field("tsonic", textTypedPrefix(node.tsonic)),
  ]);
}

export function printPostfixUnaryExpression(node: PostfixUnaryExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("operand", context.reference(node.operand)),
    field("operator", text(node.operator)),
    field("tsonic", textTypedUpdate(node.tsonic)),
  ]);
}

export function printYieldExpression(node: YieldExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("asteriskToken", (node.asteriskToken === null ? token("null") : context.reference(node.asteriskToken))),
    field("expression", (node.expression === null ? token("null") : context.reference(node.expression))),
    field("tsonic", textTypedProtocolValue(node.tsonic)),
  ]);
}

export function printArrowFunction(node: ArrowFunction<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("parameters", textNodeList(node.parameters, context)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("fullSignature", (node.fullSignature === null ? token("null") : context.reference(node.fullSignature))),
    field("asteriskToken", (node.asteriskToken === null ? token("null") : context.reference(node.asteriskToken))),
    field("body", (node.body === null ? token("null") : context.reference(node.body))),
    field("equalsGreaterThanToken", context.reference(node.equalsGreaterThanToken)),
    field("tsonic", textTypedClosure(node.tsonic)),
  ]);
}

export function printFunctionExpression(node: FunctionExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("parameters", textNodeList(node.parameters, context)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("fullSignature", (node.fullSignature === null ? token("null") : context.reference(node.fullSignature))),
    field("asteriskToken", (node.asteriskToken === null ? token("null") : context.reference(node.asteriskToken))),
    field("body", (node.body === null ? token("null") : context.reference(node.body))),
    field("name", (node.name === null ? token("null") : context.reference(node.name))),
    field("tsonic", textTypedClosure(node.tsonic)),
  ]);
}

export function printAsExpression(node: AsExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("type", context.reference(node.type)),
    field("tsonic", textTypedValue(node.tsonic)),
  ]);
}

export function printSatisfiesExpression(node: SatisfiesExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("type", context.reference(node.type)),
    field("tsonic", textTypedValue(node.tsonic)),
  ]);
}

export function printConditionalExpression(node: ConditionalExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("condition", context.reference(node.condition)),
    field("questionToken", context.reference(node.questionToken)),
    field("whenTrue", context.reference(node.whenTrue)),
    field("colonToken", context.reference(node.colonToken)),
    field("whenFalse", context.reference(node.whenFalse)),
    field("tsonic", textTypedConditional(node.tsonic)),
  ]);
}

export function printPropertyAccessExpression(node: PropertyAccessExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("questionDotToken", (node.questionDotToken === null ? token("null") : context.reference(node.questionDotToken))),
    field("name", context.reference(node.name)),
    field("tsonic", textTypedMember(node.tsonic)),
  ]);
}

export function printElementAccessExpression(node: ElementAccessExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("questionDotToken", (node.questionDotToken === null ? token("null") : context.reference(node.questionDotToken))),
    field("argumentExpression", context.reference(node.argumentExpression)),
    field("tsonic", textTypedMember(node.tsonic)),
  ]);
}

export function printCallExpression(node: CallExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("questionDotToken", (node.questionDotToken === null ? token("null") : context.reference(node.questionDotToken))),
    field("typeArguments", (node.typeArguments === null ? token("null") : textNodeList(node.typeArguments, context))),
    field("arguments", textNodeList(node.arguments, context)),
    field("tsonic", textTypedApplication(node.tsonic)),
  ]);
}

export function printNewExpression(node: NewExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("typeArguments", (node.typeArguments === null ? token("null") : textNodeList(node.typeArguments, context))),
    field("arguments", (node.arguments === null ? token("null") : textNodeList(node.arguments, context))),
    field("tsonic", textTypedApplication(node.tsonic)),
  ]);
}

export function printMetaProperty(node: MetaProperty<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("keywordToken", text(node.keywordToken)),
    field("name", context.reference(node.name)),
    field("tsonic", textTypedValue(node.tsonic)),
  ]);
}

export function printNonNullExpression(node: NonNullExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", textTypedValue(node.tsonic)),
  ]);
}

export function printSpreadElement(node: SpreadElement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", textTypedSpread(node.tsonic)),
  ]);
}

export function printTemplateExpression(node: TemplateExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("head", context.reference(node.head)),
    field("templateSpans", textNodeList(node.templateSpans, context)),
    field("tsonic", textTypedTemplate(node.tsonic)),
  ]);
}

export function printTemplateSpan(node: TemplateSpan<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("literal", context.reference(node.literal)),
    field("tsonic", token("null")),
  ]);
}

export function printTaggedTemplateExpression(node: TaggedTemplateExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tag", context.reference(node.tag)),
    field("questionDotToken", (node.questionDotToken === null ? token("null") : context.reference(node.questionDotToken))),
    field("typeArguments", (node.typeArguments === null ? token("null") : textNodeList(node.typeArguments, context))),
    field("template", context.reference(node.template)),
    field("tsonic", textTypedApplication(node.tsonic)),
  ]);
}

export function printParenthesizedExpression(node: ParenthesizedExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", textTypedValue(node.tsonic)),
  ]);
}

export function printArrayLiteralExpression(node: ArrayLiteralExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("elements", textNodeList(node.elements, context)),
    field("multiLine", boolean(node.multiLine)),
    field("tsonic", textTypedConstruction(node.tsonic)),
  ]);
}

export function printObjectLiteralExpression(node: ObjectLiteralExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("properties", textNodeList(node.properties, context)),
    field("multiLine", boolean(node.multiLine)),
    field("tsonic", textTypedConstruction(node.tsonic)),
  ]);
}

export function printSpreadAssignment(node: SpreadAssignment<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", textTypedObjectSpread(node.tsonic)),
  ]);
}

export function printPropertyAssignment(node: PropertyAssignment<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", context.reference(node.name)),
    field("postfixToken", (node.postfixToken === null ? token("null") : context.reference(node.postfixToken))),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("initializer", context.reference(node.initializer)),
    field("tsonic", textTypedProperty(node.tsonic)),
  ]);
}

export function printShorthandPropertyAssignment(node: ShorthandPropertyAssignment<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", context.reference(node.name)),
    field("postfixToken", (node.postfixToken === null ? token("null") : context.reference(node.postfixToken))),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("equalsToken", (node.equalsToken === null ? token("null") : context.reference(node.equalsToken))),
    field("objectAssignmentInitializer", (node.objectAssignmentInitializer === null ? token("null") : context.reference(node.objectAssignmentInitializer))),
    field("tsonic", textTypedShorthand(node.tsonic)),
  ]);
}

export function printDeleteExpression(node: DeleteExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", textTypedUnary(node.tsonic)),
  ]);
}

export function printTypeOfExpression(node: TypeOfExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", textTypedUnary(node.tsonic)),
  ]);
}

export function printVoidExpression(node: VoidExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", textTypedUnary(node.tsonic)),
  ]);
}

export function printAwaitExpression(node: AwaitExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", textTypedProtocolValue(node.tsonic)),
  ]);
}

export function printTypeAssertion(node: TypeAssertion<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("type", context.reference(node.type)),
    field("expression", context.reference(node.expression)),
    field("tsonic", textTypedValue(node.tsonic)),
  ]);
}

export function printExpressionWithTypeArguments(node: ExpressionWithTypeArguments<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("typeArguments", (node.typeArguments === null ? token("null") : textNodeList(node.typeArguments, context))),
    field("tsonic", textTypedInstantiation(node.tsonic)),
  ]);
}

export function printTemplateHead(node: TemplateHead<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", text(node.text)),
    field("tokenFlags", sequence(node.tokenFlags, entry => text(entry))),
    field("rawText", text(node.rawText)),
    field("templateFlags", sequence(node.templateFlags, entry => text(entry))),
    field("tsonic", token("null")),
  ]);
}

export function printTemplateMiddle(node: TemplateMiddle<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", text(node.text)),
    field("tokenFlags", sequence(node.tokenFlags, entry => text(entry))),
    field("rawText", text(node.rawText)),
    field("templateFlags", sequence(node.templateFlags, entry => text(entry))),
    field("tsonic", token("null")),
  ]);
}

export function printTemplateTail(node: TemplateTail<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("text", text(node.text)),
    field("tokenFlags", sequence(node.tokenFlags, entry => text(entry))),
    field("rawText", text(node.rawText)),
    field("templateFlags", sequence(node.templateFlags, entry => text(entry))),
    field("tsonic", token("null")),
  ]);
}

export function printPartiallyEmittedExpression(node: PartiallyEmittedExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", token("null")),
  ]);
}

export function printSyntheticReferenceExpression(node: SyntheticReferenceExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("thisArg", context.reference(node.thisArg)),
    field("tsonic", token("null")),
  ]);
}
