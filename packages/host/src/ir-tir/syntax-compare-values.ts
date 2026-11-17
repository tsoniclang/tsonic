import type * as Hir from "../ir-hir/contract.js";
import { sameVector, sameNodeKind, sameNodeList, sameCommentDirective22, samePragma23, sameCheckJsDirective24 } from "./syntax-compare-common.js";

export function sameArrayLiteralExpression(left: Hir.ArrayLiteralExpression<Hir.Phase>, right: Hir.ArrayLiteralExpression<Hir.Phase>): boolean {
  return sameNodeList(left.elements, right.elements) &&
    Object.is(left.multiLine, right.multiLine);
}

export function sameArrowFunction(left: Hir.ArrowFunction<Hir.Phase>, right: Hir.ArrowFunction<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeList(left.parameters, right.parameters) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.fullSignature === null ? right.fullSignature === null : right.fullSignature !== null && sameNodeKind(left.fullSignature, right.fullSignature)) &&
    ((left.asteriskToken === null) === (right.asteriskToken === null)) &&
    (left.body === null ? right.body === null : right.body !== null && sameNodeKind(left.body, right.body));
}

export function sameAsExpression(left: Hir.AsExpression<Hir.Phase>, right: Hir.AsExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression) &&
    sameNodeKind(left.type, right.type);
}

export function sameAwaitExpression(left: Hir.AwaitExpression<Hir.Phase>, right: Hir.AwaitExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function sameBigIntLiteral(left: Hir.BigIntLiteral<Hir.Phase>, right: Hir.BigIntLiteral<Hir.Phase>): boolean {
  return Object.is(left.text, right.text) &&
    sameVector(left.tokenFlags, right.tokenFlags, Object.is);
}

export function sameBinaryExpression(left: Hir.BinaryExpression<Hir.Phase>, right: Hir.BinaryExpression<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    sameNodeKind(left.left, right.left) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    sameNodeKind(left.operatorToken, right.operatorToken) &&
    sameNodeKind(left.right, right.right);
}

export function sameBlock(left: Hir.Block<Hir.Phase>, right: Hir.Block<Hir.Phase>): boolean {
  return sameNodeList(left.statements, right.statements) &&
    Object.is(left.multiLine, right.multiLine);
}

export function sameCallExpression(left: Hir.CallExpression<Hir.Phase>, right: Hir.CallExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression) &&
    ((left.questionDotToken === null) === (right.questionDotToken === null)) &&
    (left.typeArguments === null ? right.typeArguments === null : right.typeArguments !== null && sameNodeList(left.typeArguments, right.typeArguments)) &&
    sameNodeList(left.arguments, right.arguments);
}

export function sameClassDeclaration(left: Hir.ClassDeclaration<Hir.Phase>, right: Hir.ClassDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    ((left.name === null) === (right.name === null)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    (left.heritageClauses === null ? right.heritageClauses === null : right.heritageClauses !== null && sameNodeList(left.heritageClauses, right.heritageClauses)) &&
    sameNodeList(left.members, right.members);
}

export function sameClassExpression(left: Hir.ClassExpression<Hir.Phase>, right: Hir.ClassExpression<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    ((left.name === null) === (right.name === null)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    (left.heritageClauses === null ? right.heritageClauses === null : right.heritageClauses !== null && sameNodeList(left.heritageClauses, right.heritageClauses)) &&
    sameNodeList(left.members, right.members);
}

export function sameClassStaticBlockDeclaration(left: Hir.ClassStaticBlockDeclaration<Hir.Phase>, right: Hir.ClassStaticBlockDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers));
}

export function sameComputedPropertyName(left: Hir.ComputedPropertyName<Hir.Phase>, right: Hir.ComputedPropertyName<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function sameConditionalExpression(left: Hir.ConditionalExpression<Hir.Phase>, right: Hir.ConditionalExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.condition, right.condition) &&
    sameNodeKind(left.whenTrue, right.whenTrue) &&
    sameNodeKind(left.whenFalse, right.whenFalse);
}

export function sameConstructorDeclaration(left: Hir.ConstructorDeclaration<Hir.Phase>, right: Hir.ConstructorDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeList(left.parameters, right.parameters) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.fullSignature === null ? right.fullSignature === null : right.fullSignature !== null && sameNodeKind(left.fullSignature, right.fullSignature)) &&
    ((left.asteriskToken === null) === (right.asteriskToken === null)) &&
    (left.body === null ? right.body === null : right.body !== null && sameNodeKind(left.body, right.body));
}

export function sameDecorator(left: Hir.Decorator<Hir.Phase>, right: Hir.Decorator<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function sameDeleteExpression(left: Hir.DeleteExpression<Hir.Phase>, right: Hir.DeleteExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function sameElementAccessExpression(left: Hir.ElementAccessExpression<Hir.Phase>, right: Hir.ElementAccessExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression) &&
    ((left.questionDotToken === null) === (right.questionDotToken === null)) &&
    sameNodeKind(left.argumentExpression, right.argumentExpression);
}

export function sameEnumDeclaration(left: Hir.EnumDeclaration<Hir.Phase>, right: Hir.EnumDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    sameNodeList(left.members, right.members);
}

export function sameEnumMember(left: Hir.EnumMember<Hir.Phase>, right: Hir.EnumMember<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    sameNodeKind(left.name, right.name) &&
    (left.postfixToken === null ? right.postfixToken === null : right.postfixToken !== null && sameNodeKind(left.postfixToken, right.postfixToken)) &&
    (left.initializer === null ? right.initializer === null : right.initializer !== null && sameNodeKind(left.initializer, right.initializer));
}

export function sameExpressionWithTypeArguments(left: Hir.ExpressionWithTypeArguments<Hir.Phase>, right: Hir.ExpressionWithTypeArguments<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression) &&
    (left.typeArguments === null ? right.typeArguments === null : right.typeArguments !== null && sameNodeList(left.typeArguments, right.typeArguments));
}

export function sameExternalModuleReference(left: Hir.ExternalModuleReference<Hir.Phase>, right: Hir.ExternalModuleReference<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function sameFunctionDeclaration(left: Hir.FunctionDeclaration<Hir.Phase>, right: Hir.FunctionDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeList(left.parameters, right.parameters) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.fullSignature === null ? right.fullSignature === null : right.fullSignature !== null && sameNodeKind(left.fullSignature, right.fullSignature)) &&
    ((left.asteriskToken === null) === (right.asteriskToken === null)) &&
    (left.body === null ? right.body === null : right.body !== null && sameNodeKind(left.body, right.body)) &&
    ((left.name === null) === (right.name === null));
}

export function sameFunctionExpression(left: Hir.FunctionExpression<Hir.Phase>, right: Hir.FunctionExpression<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeList(left.parameters, right.parameters) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.fullSignature === null ? right.fullSignature === null : right.fullSignature !== null && sameNodeKind(left.fullSignature, right.fullSignature)) &&
    ((left.asteriskToken === null) === (right.asteriskToken === null)) &&
    (left.body === null ? right.body === null : right.body !== null && sameNodeKind(left.body, right.body)) &&
    ((left.name === null) === (right.name === null));
}

export function sameGetAccessorDeclaration(left: Hir.GetAccessorDeclaration<Hir.Phase>, right: Hir.GetAccessorDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    sameNodeKind(left.name, right.name) &&
    (left.postfixToken === null ? right.postfixToken === null : right.postfixToken !== null && sameNodeKind(left.postfixToken, right.postfixToken)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeList(left.parameters, right.parameters) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.fullSignature === null ? right.fullSignature === null : right.fullSignature !== null && sameNodeKind(left.fullSignature, right.fullSignature)) &&
    ((left.asteriskToken === null) === (right.asteriskToken === null)) &&
    (left.body === null ? right.body === null : right.body !== null && sameNodeKind(left.body, right.body));
}

export function sameHeritageClause(left: Hir.HeritageClause<Hir.Phase>, right: Hir.HeritageClause<Hir.Phase>): boolean {
  return Object.is(left.token, right.token) &&
    sameNodeList(left.types, right.types);
}

export function sameIdentifier(left: Hir.Identifier<Hir.Phase>, right: Hir.Identifier<Hir.Phase>): boolean {
  return Object.is(left.text, right.text);
}

export function sameInterfaceDeclaration(left: Hir.InterfaceDeclaration<Hir.Phase>, right: Hir.InterfaceDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    (left.heritageClauses === null ? right.heritageClauses === null : right.heritageClauses !== null && sameNodeList(left.heritageClauses, right.heritageClauses)) &&
    sameNodeList(left.members, right.members);
}

export function sameMetaProperty(left: Hir.MetaProperty<Hir.Phase>, right: Hir.MetaProperty<Hir.Phase>): boolean {
  return Object.is(left.keywordToken, right.keywordToken);
}

export function sameMethodDeclaration(left: Hir.MethodDeclaration<Hir.Phase>, right: Hir.MethodDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    sameNodeKind(left.name, right.name) &&
    (left.postfixToken === null ? right.postfixToken === null : right.postfixToken !== null && sameNodeKind(left.postfixToken, right.postfixToken)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeList(left.parameters, right.parameters) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.fullSignature === null ? right.fullSignature === null : right.fullSignature !== null && sameNodeKind(left.fullSignature, right.fullSignature)) &&
    ((left.asteriskToken === null) === (right.asteriskToken === null)) &&
    (left.body === null ? right.body === null : right.body !== null && sameNodeKind(left.body, right.body));
}

export function sameNewExpression(left: Hir.NewExpression<Hir.Phase>, right: Hir.NewExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression) &&
    (left.typeArguments === null ? right.typeArguments === null : right.typeArguments !== null && sameNodeList(left.typeArguments, right.typeArguments)) &&
    (left.arguments === null ? right.arguments === null : right.arguments !== null && sameNodeList(left.arguments, right.arguments));
}

export function sameNoSubstitutionTemplateLiteral(left: Hir.NoSubstitutionTemplateLiteral<Hir.Phase>, right: Hir.NoSubstitutionTemplateLiteral<Hir.Phase>): boolean {
  return Object.is(left.text, right.text) &&
    sameVector(left.tokenFlags, right.tokenFlags, Object.is) &&
    Object.is(left.rawText, right.rawText) &&
    sameVector(left.templateFlags, right.templateFlags, Object.is);
}

export function sameNonNullExpression(left: Hir.NonNullExpression<Hir.Phase>, right: Hir.NonNullExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function sameNumericLiteral(left: Hir.NumericLiteral<Hir.Phase>, right: Hir.NumericLiteral<Hir.Phase>): boolean {
  return Object.is(left.text, right.text) &&
    sameVector(left.tokenFlags, right.tokenFlags, Object.is);
}

export function sameObjectLiteralExpression(left: Hir.ObjectLiteralExpression<Hir.Phase>, right: Hir.ObjectLiteralExpression<Hir.Phase>): boolean {
  return sameNodeList(left.properties, right.properties) &&
    Object.is(left.multiLine, right.multiLine);
}

export function sameParenthesizedExpression(left: Hir.ParenthesizedExpression<Hir.Phase>, right: Hir.ParenthesizedExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function samePartiallyEmittedExpression(left: Hir.PartiallyEmittedExpression<Hir.Phase>, right: Hir.PartiallyEmittedExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function samePostfixUnaryExpression(left: Hir.PostfixUnaryExpression<Hir.Phase>, right: Hir.PostfixUnaryExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.operand, right.operand) &&
    Object.is(left.operator, right.operator);
}

export function samePrefixUnaryExpression(left: Hir.PrefixUnaryExpression<Hir.Phase>, right: Hir.PrefixUnaryExpression<Hir.Phase>): boolean {
  return Object.is(left.operator, right.operator) &&
    sameNodeKind(left.operand, right.operand);
}

export function samePrivateIdentifier(left: Hir.PrivateIdentifier<Hir.Phase>, right: Hir.PrivateIdentifier<Hir.Phase>): boolean {
  return Object.is(left.text, right.text);
}

export function samePropertyAccessExpression(left: Hir.PropertyAccessExpression<Hir.Phase>, right: Hir.PropertyAccessExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression) &&
    ((left.questionDotToken === null) === (right.questionDotToken === null)) &&
    sameNodeKind(left.name, right.name);
}

export function samePropertyAssignment(left: Hir.PropertyAssignment<Hir.Phase>, right: Hir.PropertyAssignment<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    sameNodeKind(left.name, right.name) &&
    (left.postfixToken === null ? right.postfixToken === null : right.postfixToken !== null && sameNodeKind(left.postfixToken, right.postfixToken)) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    sameNodeKind(left.initializer, right.initializer);
}

export function sameQualifiedName(left: Hir.QualifiedName<Hir.Phase>, right: Hir.QualifiedName<Hir.Phase>): boolean {
  return sameNodeKind(left.left, right.left);
}

export function sameRegularExpressionLiteral(left: Hir.RegularExpressionLiteral<Hir.Phase>, right: Hir.RegularExpressionLiteral<Hir.Phase>): boolean {
  return Object.is(left.text, right.text) &&
    sameVector(left.tokenFlags, right.tokenFlags, Object.is);
}

export function sameSatisfiesExpression(left: Hir.SatisfiesExpression<Hir.Phase>, right: Hir.SatisfiesExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression) &&
    sameNodeKind(left.type, right.type);
}

export function sameSetAccessorDeclaration(left: Hir.SetAccessorDeclaration<Hir.Phase>, right: Hir.SetAccessorDeclaration<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    sameNodeKind(left.name, right.name) &&
    (left.postfixToken === null ? right.postfixToken === null : right.postfixToken !== null && sameNodeKind(left.postfixToken, right.postfixToken)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeList(left.parameters, right.parameters) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    (left.fullSignature === null ? right.fullSignature === null : right.fullSignature !== null && sameNodeKind(left.fullSignature, right.fullSignature)) &&
    ((left.asteriskToken === null) === (right.asteriskToken === null)) &&
    (left.body === null ? right.body === null : right.body !== null && sameNodeKind(left.body, right.body));
}

export function sameShorthandPropertyAssignment(left: Hir.ShorthandPropertyAssignment<Hir.Phase>, right: Hir.ShorthandPropertyAssignment<Hir.Phase>): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    sameNodeKind(left.name, right.name) &&
    (left.postfixToken === null ? right.postfixToken === null : right.postfixToken !== null && sameNodeKind(left.postfixToken, right.postfixToken)) &&
    (left.type === null ? right.type === null : right.type !== null && sameNodeKind(left.type, right.type)) &&
    ((left.equalsToken === null) === (right.equalsToken === null)) &&
    (left.objectAssignmentInitializer === null ? right.objectAssignmentInitializer === null : right.objectAssignmentInitializer !== null && sameNodeKind(left.objectAssignmentInitializer, right.objectAssignmentInitializer));
}

export function sameSourceFile(left: Hir.SourceFile<Hir.Phase>, right: Hir.SourceFile<Hir.Phase>): boolean {
  return sameNodeList(left.statements, right.statements) &&
    Object.is(left.languageVariant, right.languageVariant) &&
    Object.is(left.scriptKind, right.scriptKind) &&
    sameVector(left.commentDirectives, right.commentDirectives, sameCommentDirective22) &&
    sameVector(left.pragmas, right.pragmas, samePragma23) &&
    (left.checkJsDirective === null ? right.checkJsDirective === null : right.checkJsDirective !== null && sameCheckJsDirective24(left.checkJsDirective, right.checkJsDirective));
}

export function sameSpreadAssignment(left: Hir.SpreadAssignment<Hir.Phase>, right: Hir.SpreadAssignment<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function sameSpreadElement(left: Hir.SpreadElement<Hir.Phase>, right: Hir.SpreadElement<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function sameStringLiteral(left: Hir.StringLiteral<Hir.Phase>, right: Hir.StringLiteral<Hir.Phase>): boolean {
  return Object.is(left.text, right.text) &&
    sameVector(left.tokenFlags, right.tokenFlags, Object.is);
}

export function sameSyntaxList(left: Hir.SyntaxList<Hir.Phase>, right: Hir.SyntaxList<Hir.Phase>): boolean {
  return sameVector(left.children, right.children, sameNodeKind);
}

export function sameSyntheticReferenceExpression(left: Hir.SyntheticReferenceExpression<Hir.Phase>, right: Hir.SyntheticReferenceExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression) &&
    sameNodeKind(left.thisArg, right.thisArg);
}

export function sameTaggedTemplateExpression(left: Hir.TaggedTemplateExpression<Hir.Phase>, right: Hir.TaggedTemplateExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.tag, right.tag) &&
    ((left.questionDotToken === null) === (right.questionDotToken === null)) &&
    (left.typeArguments === null ? right.typeArguments === null : right.typeArguments !== null && sameNodeList(left.typeArguments, right.typeArguments)) &&
    sameNodeKind(left.template, right.template);
}

export function sameTemplateExpression(left: Hir.TemplateExpression<Hir.Phase>, right: Hir.TemplateExpression<Hir.Phase>): boolean {
  return sameNodeList(left.templateSpans, right.templateSpans);
}

export function sameTemplateHead(left: Hir.TemplateHead<Hir.Phase>, right: Hir.TemplateHead<Hir.Phase>): boolean {
  return Object.is(left.text, right.text) &&
    sameVector(left.tokenFlags, right.tokenFlags, Object.is) &&
    Object.is(left.rawText, right.rawText) &&
    sameVector(left.templateFlags, right.templateFlags, Object.is);
}

export function sameTemplateLiteralTypeSpan(left: Hir.TemplateLiteralTypeSpan<Hir.Phase>, right: Hir.TemplateLiteralTypeSpan<Hir.Phase>): boolean {
  return sameNodeKind(left.type, right.type) &&
    sameNodeKind(left.literal, right.literal);
}

export function sameTemplateMiddle(left: Hir.TemplateMiddle<Hir.Phase>, right: Hir.TemplateMiddle<Hir.Phase>): boolean {
  return Object.is(left.text, right.text) &&
    sameVector(left.tokenFlags, right.tokenFlags, Object.is) &&
    Object.is(left.rawText, right.rawText) &&
    sameVector(left.templateFlags, right.templateFlags, Object.is);
}

export function sameTemplateSpan(left: Hir.TemplateSpan<Hir.Phase>, right: Hir.TemplateSpan<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression) &&
    sameNodeKind(left.literal, right.literal);
}

export function sameTemplateTail(left: Hir.TemplateTail<Hir.Phase>, right: Hir.TemplateTail<Hir.Phase>): boolean {
  return Object.is(left.text, right.text) &&
    sameVector(left.tokenFlags, right.tokenFlags, Object.is) &&
    Object.is(left.rawText, right.rawText) &&
    sameVector(left.templateFlags, right.templateFlags, Object.is);
}

export function sameTypeAliasDeclaration(left: Hir.TypeAliasDeclaration<Hir.Phase, "JSTypeAliasDeclaration" | "TypeAliasDeclaration">, right: Hir.TypeAliasDeclaration<Hir.Phase, "JSTypeAliasDeclaration" | "TypeAliasDeclaration">): boolean {
  return (left.modifiers === null ? right.modifiers === null : right.modifiers !== null && sameNodeList(left.modifiers, right.modifiers)) &&
    (left.typeParameters === null ? right.typeParameters === null : right.typeParameters !== null && sameNodeList(left.typeParameters, right.typeParameters)) &&
    sameNodeKind(left.type, right.type);
}

export function sameTypeOfExpression(left: Hir.TypeOfExpression<Hir.Phase>, right: Hir.TypeOfExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function sameVoidExpression(left: Hir.VoidExpression<Hir.Phase>, right: Hir.VoidExpression<Hir.Phase>): boolean {
  return sameNodeKind(left.expression, right.expression);
}

export function sameYieldExpression(left: Hir.YieldExpression<Hir.Phase>, right: Hir.YieldExpression<Hir.Phase>): boolean {
  return ((left.asteriskToken === null) === (right.asteriskToken === null)) &&
    (left.expression === null ? right.expression === null : right.expression !== null && sameNodeKind(left.expression, right.expression));
}
