import type { bool, int } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { Node, NodeList } from "../ast/spine.js";
import { Node_End, Node_Pos, Node_Name, NodeFactory_NewNodeList } from "../ast/spine.js";
import type { BindingElement, BindingPattern, VariableDeclaration } from "../ast/generated/data.js";
import {
  NewArrayLiteralExpression,
  NewObjectLiteralExpression,
  NewOmittedExpression,
  NewPropertyAssignment,
  NewShorthandPropertyAssignment,
  NewSpreadAssignment,
  NewSpreadElement,
  NewSyntaxList,
  NewToken,
} from "../ast/generated/factory.js";
import type { Expression, IdentifierNode, ObjectLiteralElement, Statement } from "../ast/generated/unions.js";
import type { Kind } from "../ast/generated/kinds.js";
import {
  KindAmpersandAmpersandEqualsToken,
  KindAmpersandAmpersandToken,
  KindAmpersandEqualsToken,
  KindAmpersandToken,
  KindArrowFunction,
  KindArrayLiteralExpression,
  KindAsteriskAsteriskEqualsToken,
  KindAsteriskAsteriskToken,
  KindAsteriskEqualsToken,
  KindAsteriskToken,
  KindAwaitExpression,
  KindAsExpression,
  KindBarBarEqualsToken,
  KindBarBarToken,
  KindBarEqualsToken,
  KindBarToken,
  KindBinaryExpression,
  KindBindingElement,
  KindCallExpression,
  KindCaretEqualsToken,
  KindCaretToken,
  KindCaseClause,
  KindComputedPropertyName,
  KindConditionalExpression,
  KindDecorator,
  KindDeleteExpression,
  KindDoStatement,
  KindElementAccessExpression,
  KindEnumMember,
  KindEqualsToken,
  KindExportAssignment,
  KindExpressionStatement,
  KindExpressionWithTypeArguments,
  KindForInStatement,
  KindForOfStatement,
  KindForStatement,
  KindGreaterThanGreaterThanEqualsToken,
  KindGreaterThanGreaterThanGreaterThanEqualsToken,
  KindGreaterThanGreaterThanGreaterThanToken,
  KindGreaterThanGreaterThanToken,
  KindIfStatement,
  KindImportAttribute,
  KindJsxAttribute,
  KindJsxClosingElement,
  KindJsxExpression,
  KindJsxOpeningElement,
  KindJsxSelfClosingElement,
  KindJsxSpreadAttribute,
  KindLessThanLessThanEqualsToken,
  KindLessThanLessThanToken,
  KindMinusEqualsToken,
  KindMinusToken,
  KindNewExpression,
  KindNonNullExpression,
  KindParameter,
  KindParenthesizedExpression,
  KindPartiallyEmittedExpression,
  KindPercentEqualsToken,
  KindPercentToken,
  KindPlusEqualsToken,
  KindPlusToken,
  KindPostfixUnaryExpression,
  KindPrefixUnaryExpression,
  KindPropertyAccessExpression,
  KindPropertyAssignment,
  KindPropertyDeclaration,
  KindPropertySignature,
  KindQuestionQuestionEqualsToken,
  KindQuestionQuestionToken,
  KindReturnStatement,
  KindSatisfiesExpression,
  KindShorthandPropertyAssignment,
  KindSlashEqualsToken,
  KindSlashToken,
  KindSpreadAssignment,
  KindSpreadElement,
  KindSwitchStatement,
  KindTaggedTemplateExpression,
  KindTemplateSpan,
  KindThrowStatement,
  KindTypeAssertionExpression,
  KindTypeOfExpression,
  KindVariableDeclaration,
  KindVoidExpression,
  KindWhileStatement,
  KindWithStatement,
  KindYieldExpression,
  KindImportEqualsDeclaration,
  KindArrayBindingPattern,
  KindObjectBindingPattern,
} from "../ast/generated/kinds.js";
import {
  IsDecorator,
  IsExpressionStatement,
  IsIdentifier,
  IsKeywordKind,
  IsMethodDeclaration,
  IsNumericLiteral,
  IsPropertyDeclaration,
  IsTryStatement,
} from "../ast/generated/predicates.js";
import {
  AsBindingElement,
  AsBindingPattern,
  AsConditionalExpression,
  AsForStatement,
  AsImportAttribute,
  AsImportEqualsDeclaration,
  AsShorthandPropertyAssignment,
  AsTaggedTemplateExpression,
  AsTryStatement,
  AsVariableDeclaration,
} from "../ast/generated/casts.js";
import {
  CanHaveModifiers,
  GetSourceFileOfNode,
  IsBindingPattern,
  IsStringLiteralLike,
  IsSuperCall,
  PositionIsSynthesized,
  SkipParentheses,
} from "../ast/utilities.js";
import type { SourceFile } from "../ast/ast.js";
import {
  Node_Arguments,
  Node_Body,
  Node_Expression,
  Node_Initializer,
  Node_ModifierNodes,
  Node_Statements,
  Node_TagName,
  SourceFile_ECMALineMap,
  SourceFile_Text,
} from "../ast/ast.js";
import { FindLast, LastOrNil } from "../core/core.js";
import { GetECMALineOfPosition } from "../scanner/scanner.js";
import type { TextRange } from "../core/text.js";
import { NewTextRange } from "../core/text.js";
import type { EmitContext } from "../printer/emitcontext.js";
import {
  EmitContext_AssignCommentAndSourceMapRanges,
  EmitContext_EmitFlags,
  EmitContext_HasAutoGenerateInfo,
  EmitContext_MostOriginal,
  EmitContext_SetOriginal,
} from "../printer/emitcontext.js";
import { EFExportName, EFHelperName, EFLocalName } from "../printer/emitflags.js";
import type { NodeFactory } from "../printer/factory.js";
import { NodeFactory_NewAssignmentExpression } from "../printer/factory.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::IsGeneratedIdentifier","kind":"func","status":"implemented","sigHash":"89b194486f69ad37d24c7661662a26d9ae8d9d5f19a36185615b0c10f61bf8c8","bodyHash":"a2f0859edccfba196fe5bcc1bc7dda1d71aa8b81c69b25b4ffee4aec52b7845d"}
 *
 * Go source:
 * func IsGeneratedIdentifier(emitContext *printer.EmitContext, name *ast.IdentifierNode) bool {
 * 	return emitContext.HasAutoGenerateInfo(name)
 * }
 */
export function IsGeneratedIdentifier(emitContext: GoPtr<EmitContext>, name: GoPtr<IdentifierNode>): bool {
  return EmitContext_HasAutoGenerateInfo(emitContext, name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::IsHelperName","kind":"func","status":"implemented","sigHash":"fc6d94c942aed0bbeb19aa85622bb9b9bf6c37a3fbf79141f0f4fa3a58d6ba3f","bodyHash":"42fa45f922d6cc8b0fdee3e6b7109efcf56f73ca10620988da0253d9deee8f98"}
 *
 * Go source:
 * func IsHelperName(emitContext *printer.EmitContext, name *ast.IdentifierNode) bool {
 * 	return emitContext.EmitFlags(name)&printer.EFHelperName != 0
 * }
 */
export function IsHelperName(emitContext: GoPtr<EmitContext>, name: GoPtr<IdentifierNode>): bool {
  return ((EmitContext_EmitFlags(emitContext, name) & EFHelperName) >>> 0) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::IsLocalName","kind":"func","status":"implemented","sigHash":"d12a51db8828e768693b82e1a87dbd3e77e313149052a0090ba03e0bb3b6cc44","bodyHash":"b09aed4bfb23801d3cb63df01118e91a6eb2d00d90d9ecc1f5472e3ff96af36a"}
 *
 * Go source:
 * func IsLocalName(emitContext *printer.EmitContext, name *ast.IdentifierNode) bool {
 * 	return emitContext.EmitFlags(name)&printer.EFLocalName != 0
 * }
 */
export function IsLocalName(emitContext: GoPtr<EmitContext>, name: GoPtr<IdentifierNode>): bool {
  return ((EmitContext_EmitFlags(emitContext, name) & EFLocalName) >>> 0) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::IsExportName","kind":"func","status":"implemented","sigHash":"3727bc900c73f1a4e305fc30f39297b33dde1f5deadbe2fd8f14678bea8ded6d","bodyHash":"d7309fe5dab27ce13f2e1077afe2f30d7299712debb725e0c164ab112cc14aff"}
 *
 * Go source:
 * func IsExportName(emitContext *printer.EmitContext, name *ast.IdentifierNode) bool {
 * 	return emitContext.EmitFlags(name)&printer.EFExportName != 0
 * }
 */
export function IsExportName(emitContext: GoPtr<EmitContext>, name: GoPtr<IdentifierNode>): bool {
  return ((EmitContext_EmitFlags(emitContext, name) & EFExportName) >>> 0) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::IsIdentifierReference","kind":"func","status":"implemented","sigHash":"b6e5fc8d0502c6d60bfa0f602489341025ccbb87b981203c1a32f14123c64bda","bodyHash":"c446ea25f41e58e4fbae874d66ff67cc131caa463c5a88a5e1b82257d6b188f7"}
 *
 * Go source:
 * func IsIdentifierReference(name *ast.IdentifierNode, parent *ast.Node) bool {
 * 	switch parent.Kind {
 * 	case ast.KindBinaryExpression,
 * 		ast.KindPrefixUnaryExpression,
 * 		ast.KindPostfixUnaryExpression,
 * 		ast.KindYieldExpression,
 * 		ast.KindAsExpression,
 * 		ast.KindSatisfiesExpression,
 * 		ast.KindElementAccessExpression,
 * 		ast.KindNonNullExpression,
 * 		ast.KindSpreadElement,
 * 		ast.KindSpreadAssignment,
 * 		ast.KindParenthesizedExpression,
 * 		ast.KindArrayLiteralExpression,
 * 		ast.KindDeleteExpression,
 * 		ast.KindTypeOfExpression,
 * 		ast.KindVoidExpression,
 * 		ast.KindAwaitExpression,
 * 		ast.KindTypeAssertionExpression,
 * 		ast.KindExpressionWithTypeArguments,
 * 		ast.KindJsxSelfClosingElement,
 * 		ast.KindJsxSpreadAttribute,
 * 		ast.KindJsxExpression,
 * 		ast.KindPartiallyEmittedExpression:
 * 		// all immediate children that can be `Identifier` would be instances of `IdentifierReference`
 * 		return true
 * 	case ast.KindComputedPropertyName,
 * 		ast.KindDecorator,
 * 		ast.KindIfStatement,
 * 		ast.KindDoStatement,
 * 		ast.KindWhileStatement,
 * 		ast.KindWithStatement,
 * 		ast.KindReturnStatement,
 * 		ast.KindSwitchStatement,
 * 		ast.KindCaseClause,
 * 		ast.KindThrowStatement,
 * 		ast.KindExpressionStatement,
 * 		ast.KindExportAssignment,
 * 		ast.KindPropertyAccessExpression,
 * 		ast.KindTemplateSpan:
 * 		// only an `Expression()` child that can be `Identifier` would be an instance of `IdentifierReference`
 * 		return parent.Expression() == name
 * 	case ast.KindVariableDeclaration,
 * 		ast.KindParameter,
 * 		ast.KindBindingElement,
 * 		ast.KindPropertyDeclaration,
 * 		ast.KindPropertySignature,
 * 		ast.KindPropertyAssignment,
 * 		ast.KindEnumMember,
 * 		ast.KindJsxAttribute:
 * 		// only an `Initializer()` child that can be `Identifier` would be an instance of `IdentifierReference`
 * 		return parent.Initializer() == name
 * 	case ast.KindShorthandPropertyAssignment:
 * 		return parent.AsShorthandPropertyAssignment().ObjectAssignmentInitializer == name
 * 	case ast.KindForStatement:
 * 		return parent.Initializer() == name ||
 * 			parent.AsForStatement().Condition == name ||
 * 			parent.AsForStatement().Incrementor == name
 * 	case ast.KindForInStatement,
 * 		ast.KindForOfStatement:
 * 		return parent.Initializer() == name ||
 * 			parent.Expression() == name
 * 	case ast.KindImportEqualsDeclaration:
 * 		return parent.AsImportEqualsDeclaration().ModuleReference == name
 * 	case ast.KindArrowFunction:
 * 		return parent.Body() == name
 * 	case ast.KindConditionalExpression:
 * 		return parent.AsConditionalExpression().Condition == name ||
 * 			parent.AsConditionalExpression().WhenTrue == name ||
 * 			parent.AsConditionalExpression().WhenFalse == name
 * 	case ast.KindCallExpression, ast.KindNewExpression:
 * 		return parent.Expression() == name ||
 * 			slices.Contains(parent.Arguments(), name)
 * 	case ast.KindTaggedTemplateExpression:
 * 		return parent.AsTaggedTemplateExpression().Tag == name
 * 	case ast.KindImportAttribute:
 * 		return parent.AsImportAttribute().Value == name
 * 	case ast.KindJsxOpeningElement, ast.KindJsxClosingElement:
 * 		return parent.TagName() == name
 * 	default:
 * 		return false
 * 	}
 * }
 */
export function IsIdentifierReference(name: GoPtr<IdentifierNode>, parent: GoPtr<Node>): bool {
  switch (parent!.Kind) {
    case KindBinaryExpression:
    case KindPrefixUnaryExpression:
    case KindPostfixUnaryExpression:
    case KindYieldExpression:
    case KindAsExpression:
    case KindSatisfiesExpression:
    case KindElementAccessExpression:
    case KindNonNullExpression:
    case KindSpreadElement:
    case KindSpreadAssignment:
    case KindParenthesizedExpression:
    case KindArrayLiteralExpression:
    case KindDeleteExpression:
    case KindTypeOfExpression:
    case KindVoidExpression:
    case KindAwaitExpression:
    case KindTypeAssertionExpression:
    case KindExpressionWithTypeArguments:
    case KindJsxSelfClosingElement:
    case KindJsxSpreadAttribute:
    case KindJsxExpression:
    case KindPartiallyEmittedExpression:
      return true;
    case KindComputedPropertyName:
    case KindDecorator:
    case KindIfStatement:
    case KindDoStatement:
    case KindWhileStatement:
    case KindWithStatement:
    case KindReturnStatement:
    case KindSwitchStatement:
    case KindCaseClause:
    case KindThrowStatement:
    case KindExpressionStatement:
    case KindExportAssignment:
    case KindPropertyAccessExpression:
    case KindTemplateSpan:
      return Node_Expression(parent) === (name as unknown as GoPtr<Node>);
    case KindVariableDeclaration:
    case KindParameter:
    case KindBindingElement:
    case KindPropertyDeclaration:
    case KindPropertySignature:
    case KindPropertyAssignment:
    case KindEnumMember:
    case KindJsxAttribute:
      return Node_Initializer(parent) === (name as unknown as GoPtr<Node>);
    case KindShorthandPropertyAssignment:
      return AsShorthandPropertyAssignment(parent)!.ObjectAssignmentInitializer === (name as unknown as GoPtr<Node>);
    case KindForStatement:
      return (
        Node_Initializer(parent) === (name as unknown as GoPtr<Node>) ||
        AsForStatement(parent)!.Condition === (name as unknown as GoPtr<Node>) ||
        AsForStatement(parent)!.Incrementor === (name as unknown as GoPtr<Node>)
      );
    case KindForInStatement:
    case KindForOfStatement:
      return (
        Node_Initializer(parent) === (name as unknown as GoPtr<Node>) ||
        Node_Expression(parent) === (name as unknown as GoPtr<Node>)
      );
    case KindImportEqualsDeclaration:
      return AsImportEqualsDeclaration(parent)!.ModuleReference === (name as unknown as GoPtr<Node>);
    case KindArrowFunction:
      return Node_Body(parent) === (name as unknown as GoPtr<Node>);
    case KindConditionalExpression:
      return (
        AsConditionalExpression(parent)!.Condition === (name as unknown as GoPtr<Node>) ||
        AsConditionalExpression(parent)!.WhenTrue === (name as unknown as GoPtr<Node>) ||
        AsConditionalExpression(parent)!.WhenFalse === (name as unknown as GoPtr<Node>)
      );
    case KindCallExpression:
    case KindNewExpression: {
      const args = Node_Arguments(parent);
      return (
        Node_Expression(parent) === (name as unknown as GoPtr<Node>) ||
        (args !== undefined && args.includes(name as unknown as GoPtr<Node>))
      );
    }
    case KindTaggedTemplateExpression:
      return AsTaggedTemplateExpression(parent)!.Tag === (name as unknown as GoPtr<Node>);
    case KindImportAttribute:
      return AsImportAttribute(parent)!.Value === (name as unknown as GoPtr<Node>);
    case KindJsxOpeningElement:
    case KindJsxClosingElement:
      return Node_TagName(parent) === (name as unknown as GoPtr<Node>);
    default:
      return false;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::convertBindingElementToArrayAssignmentElement","kind":"func","status":"implemented","sigHash":"8ec740e4db353a95e857ecb7d30a93e9a6775d35da7e172abcda7fec5a29d39d","bodyHash":"0afd60149e984b89d837eeb21a381ee83211d2df590c1c2d70bdd0bc643985ed"}
 *
 * Go source:
 * func convertBindingElementToArrayAssignmentElement(emitContext *printer.EmitContext, element *ast.BindingElement) *ast.Expression {
 * 	if element.Name() == nil {
 * 		elision := emitContext.Factory.NewOmittedExpression()
 * 		emitContext.SetOriginal(elision, element.AsNode())
 * 		emitContext.AssignCommentAndSourceMapRanges(elision, element.AsNode())
 * 		return elision
 * 	}
 * 	if element.DotDotDotToken != nil {
 * 		spread := emitContext.Factory.NewSpreadElement(element.Name())
 * 		emitContext.SetOriginal(spread, element.AsNode())
 * 		emitContext.AssignCommentAndSourceMapRanges(spread, element.AsNode())
 * 		return spread
 * 	}
 * 	expression := convertBindingNameToAssignmentElementTarget(emitContext, element.Name())
 * 	if element.Initializer != nil {
 * 		assignment := emitContext.Factory.NewAssignmentExpression(expression, element.Initializer)
 * 		emitContext.SetOriginal(assignment, element.AsNode())
 * 		emitContext.AssignCommentAndSourceMapRanges(assignment, element.AsNode())
 * 		return assignment
 * 	}
 * 	return expression
 * }
 */
export function convertBindingElementToArrayAssignmentElement(emitContext: GoPtr<EmitContext>, element: GoPtr<BindingElement>): GoPtr<Expression> {
  const af = emitContext!.Factory!.__tsgoEmbedded0!;
  const elementNode = element as unknown as GoPtr<Node>;
  if (element!.name === undefined) {
    const elision = NewOmittedExpression(af);
    EmitContext_SetOriginal(emitContext, elision, elementNode);
    EmitContext_AssignCommentAndSourceMapRanges(emitContext, elision, elementNode);
    return elision as unknown as GoPtr<Expression>;
  }
  if (element!.DotDotDotToken !== undefined) {
    const spread = NewSpreadElement(af, element!.name as unknown as GoPtr<Expression>);
    EmitContext_SetOriginal(emitContext, spread, elementNode);
    EmitContext_AssignCommentAndSourceMapRanges(emitContext, spread, elementNode);
    return spread as unknown as GoPtr<Expression>;
  }
  const expression = convertBindingNameToAssignmentElementTarget(emitContext, element!.name as unknown as GoPtr<Node>);
  if (element!.Initializer !== undefined) {
    const assignment = NodeFactory_NewAssignmentExpression(emitContext!.Factory!, expression!, element!.Initializer);
    EmitContext_SetOriginal(emitContext, assignment as unknown as GoPtr<Node>, elementNode);
    EmitContext_AssignCommentAndSourceMapRanges(emitContext, assignment as unknown as GoPtr<Node>, elementNode);
    return assignment;
  }
  return expression;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::convertBindingElementToObjectAssignmentElement","kind":"func","status":"implemented","sigHash":"d80ec62d1a4b87d12528f8c0cd24bcec4488b55cece838c90c68fe0940aa9319","bodyHash":"94ad9d93b5da25e31ecce2ea8bcaae5c5346f5a912b0b4db8b0849e9109d2825"}
 *
 * Go source:
 * func convertBindingElementToObjectAssignmentElement(emitContext *printer.EmitContext, element *ast.BindingElement) *ast.ObjectLiteralElement {
 * 	if element.DotDotDotToken != nil {
 * 		spread := emitContext.Factory.NewSpreadAssignment(element.Name())
 * 		emitContext.SetOriginal(spread, element.AsNode())
 * 		emitContext.AssignCommentAndSourceMapRanges(spread, element.AsNode())
 * 		return spread
 * 	}
 * 	if element.PropertyName != nil {
 * 		expression := convertBindingNameToAssignmentElementTarget(emitContext, element.Name())
 * 		if element.Initializer != nil {
 * 			expression = emitContext.Factory.NewAssignmentExpression(expression, element.Initializer)
 * 		}
 * 		assignment := emitContext.Factory.NewPropertyAssignment(nil /*modifiers* /, element.PropertyName, nil /*postfixToken* /, nil /*typeNode* /, expression)
 * 		emitContext.SetOriginal(assignment, element.AsNode())
 * 		emitContext.AssignCommentAndSourceMapRanges(assignment, element.AsNode())
 * 		return assignment
 * 	}
 * 	var equalsToken *ast.TokenNode
 * 	if element.Initializer != nil {
 * 		equalsToken = emitContext.Factory.NewToken(ast.KindEqualsToken)
 * 	}
 * 	assignment := emitContext.Factory.NewShorthandPropertyAssignment(
 * 		nil, /*modifiers* /
 * 		element.Name(),
 * 		nil, /*postfixToken* /
 * 		nil, /*typeNode* /
 * 		equalsToken,
 * 		element.Initializer,
 * 	)
 * 	emitContext.SetOriginal(assignment, element.AsNode())
 * 	emitContext.AssignCommentAndSourceMapRanges(assignment, element.AsNode())
 * 	return assignment
 * }
 */
export function convertBindingElementToObjectAssignmentElement(emitContext: GoPtr<EmitContext>, element: GoPtr<BindingElement>): GoPtr<ObjectLiteralElement> {
  const af = emitContext!.Factory!.__tsgoEmbedded0!;
  const elementNode = element as unknown as GoPtr<Node>;
  if (element!.DotDotDotToken !== undefined) {
    const spread = NewSpreadAssignment(af, element!.name as unknown as GoPtr<Expression>);
    EmitContext_SetOriginal(emitContext, spread, elementNode);
    EmitContext_AssignCommentAndSourceMapRanges(emitContext, spread, elementNode);
    return spread as unknown as GoPtr<ObjectLiteralElement>;
  }
  if (element!.PropertyName !== undefined) {
    let expression: GoPtr<Expression> = convertBindingNameToAssignmentElementTarget(emitContext, element!.name as unknown as GoPtr<Node>);
    if (element!.Initializer !== undefined) {
      expression = NodeFactory_NewAssignmentExpression(emitContext!.Factory!, expression!, element!.Initializer);
    }
    const assignment = NewPropertyAssignment(af, undefined, element!.PropertyName, undefined, undefined, expression);
    EmitContext_SetOriginal(emitContext, assignment, elementNode);
    EmitContext_AssignCommentAndSourceMapRanges(emitContext, assignment, elementNode);
    return assignment as unknown as GoPtr<ObjectLiteralElement>;
  }
  const equalsToken = element!.Initializer !== undefined ? NewToken(af, KindEqualsToken) : undefined;
  const assignment = NewShorthandPropertyAssignment(af, undefined, element!.name as unknown as GoPtr<Expression>, undefined, undefined, equalsToken, element!.Initializer);
  EmitContext_SetOriginal(emitContext, assignment, elementNode);
  EmitContext_AssignCommentAndSourceMapRanges(emitContext, assignment, elementNode);
  return assignment as unknown as GoPtr<ObjectLiteralElement>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::ConvertBindingPatternToAssignmentPattern","kind":"func","status":"implemented","sigHash":"acd49ec13ab9a48882e668f919d01f09fac20e67bbb298fa9d182aebb9b92fb3","bodyHash":"7f12ddee7bf21ff0a85034ba6b3f5dc2b76f6af228ced142b0099ce311c027b2"}
 *
 * Go source:
 * func ConvertBindingPatternToAssignmentPattern(emitContext *printer.EmitContext, element *ast.BindingPattern) *ast.Expression {
 * 	switch element.Kind {
 * 	case ast.KindArrayBindingPattern:
 * 		return convertBindingElementToArrayAssignmentPattern(emitContext, element)
 * 	case ast.KindObjectBindingPattern:
 * 		return convertBindingElementToObjectAssignmentPattern(emitContext, element)
 * 	default:
 * 		panic("Unknown binding pattern")
 * 	}
 * }
 */
export function ConvertBindingPatternToAssignmentPattern(emitContext: GoPtr<EmitContext>, element: GoPtr<BindingPattern>): GoPtr<Expression> {
  switch ((element as unknown as GoPtr<Node>)!.Kind) {
    case KindArrayBindingPattern:
      return convertBindingElementToArrayAssignmentPattern(emitContext, element);
    case KindObjectBindingPattern:
      return convertBindingElementToObjectAssignmentPattern(emitContext, element);
    default:
      throw new globalThis.Error("Unknown binding pattern");
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::convertBindingElementToObjectAssignmentPattern","kind":"func","status":"implemented","sigHash":"48e025825653c19fac062b91ce9342e88193e6d6cd681aaea29763ff5ebb3f3a","bodyHash":"e0ab494fd7c5f5978c4ef827bee67e7bd372f796f317cb2936a56287978122e2"}
 *
 * Go source:
 * func convertBindingElementToObjectAssignmentPattern(emitContext *printer.EmitContext, element *ast.BindingPattern) *ast.Expression {
 * 	var properties []*ast.ObjectLiteralElement
 * 	for _, element := range element.Elements.Nodes {
 * 		properties = append(properties, convertBindingElementToObjectAssignmentElement(emitContext, element.AsBindingElement()))
 * 	}
 * 	propertyList := emitContext.Factory.NewNodeList(properties)
 * 	propertyList.Loc = element.Elements.Loc
 * 	object := emitContext.Factory.NewObjectLiteralExpression(propertyList, false /*multiLine* /)
 * 	emitContext.SetOriginal(object, element.AsNode())
 * 	emitContext.AssignCommentAndSourceMapRanges(object, element.AsNode())
 * 	return object
 * }
 */
export function convertBindingElementToObjectAssignmentPattern(emitContext: GoPtr<EmitContext>, element: GoPtr<BindingPattern>): GoPtr<Expression> {
  const af = emitContext!.Factory!.__tsgoEmbedded0!;
  const elementNode = element as unknown as GoPtr<Node>;
  const properties: GoSlice<GoPtr<ObjectLiteralElement>> = element!.Elements!.Nodes.map(
    (n: GoPtr<Node>): GoPtr<ObjectLiteralElement> => convertBindingElementToObjectAssignmentElement(emitContext, AsBindingElement(n))
  );
  const propertyList: GoPtr<NodeList> = NodeFactory_NewNodeList(af, properties as GoSlice<GoPtr<Node>>);
  propertyList!.Loc = element!.Elements!.Loc;
  const object = NewObjectLiteralExpression(af, propertyList, false);
  EmitContext_SetOriginal(emitContext, object, elementNode);
  EmitContext_AssignCommentAndSourceMapRanges(emitContext, object, elementNode);
  return object as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::convertBindingElementToArrayAssignmentPattern","kind":"func","status":"implemented","sigHash":"d68c5906819512d9d7be25f7e12356f30d1915771b4b7c399df4c60069ac9b74","bodyHash":"c778e9220d1333f428a724479a503c2c861687b3f3fc69f4ef6fb894518002bd"}
 *
 * Go source:
 * func convertBindingElementToArrayAssignmentPattern(emitContext *printer.EmitContext, element *ast.BindingPattern) *ast.Expression {
 * 	var elements []*ast.Expression
 * 	for _, element := range element.Elements.Nodes {
 * 		elements = append(elements, convertBindingElementToArrayAssignmentElement(emitContext, element.AsBindingElement()))
 * 	}
 * 	elementList := emitContext.Factory.NewNodeList(elements)
 * 	elementList.Loc = element.Elements.Loc
 * 	object := emitContext.Factory.NewArrayLiteralExpression(elementList, false /*multiLine* /)
 * 	emitContext.SetOriginal(object, element.AsNode())
 * 	emitContext.AssignCommentAndSourceMapRanges(object, element.AsNode())
 * 	return object
 * }
 */
export function convertBindingElementToArrayAssignmentPattern(emitContext: GoPtr<EmitContext>, element: GoPtr<BindingPattern>): GoPtr<Expression> {
  const af = emitContext!.Factory!.__tsgoEmbedded0!;
  const elementNode = element as unknown as GoPtr<Node>;
  const elements: GoSlice<GoPtr<Expression>> = element!.Elements!.Nodes.map(
    (n: GoPtr<Node>): GoPtr<Expression> => convertBindingElementToArrayAssignmentElement(emitContext, AsBindingElement(n))
  );
  const elementList: GoPtr<NodeList> = NodeFactory_NewNodeList(af, elements as GoSlice<GoPtr<Node>>);
  elementList!.Loc = element!.Elements!.Loc;
  const object = NewArrayLiteralExpression(af, elementList, false);
  EmitContext_SetOriginal(emitContext, object, elementNode);
  EmitContext_AssignCommentAndSourceMapRanges(emitContext, object, elementNode);
  return object as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::convertBindingNameToAssignmentElementTarget","kind":"func","status":"implemented","sigHash":"e3791f2d2288402efbedb1c3dff635c57703dda1eff8e097e9ad3478824d228e","bodyHash":"3fdc72c7c10434ff9ac4aa57ab66f5f8f95c5c9d467348fd92575d8b48e25ae2"}
 *
 * Go source:
 * func convertBindingNameToAssignmentElementTarget(emitContext *printer.EmitContext, element *ast.Node) *ast.Expression {
 * 	if ast.IsBindingPattern(element) {
 * 		return ConvertBindingPatternToAssignmentPattern(emitContext, element.AsBindingPattern())
 * 	}
 * 	return element
 * }
 */
export function convertBindingNameToAssignmentElementTarget(emitContext: GoPtr<EmitContext>, element: GoPtr<Node>): GoPtr<Expression> {
  if (IsBindingPattern(element)) {
    return ConvertBindingPatternToAssignmentPattern(emitContext, AsBindingPattern(element));
  }
  return element as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::ConvertVariableDeclarationToAssignmentExpression","kind":"func","status":"implemented","sigHash":"ce8b77782a32fefc66d14ee1226208da6e4207abbc208edb1f79b6645e48f77b","bodyHash":"5c0c4bb6e95b0d8e15e3920c16ee9eb32c1efe3f39b9f6b05362cc256139cff9"}
 *
 * Go source:
 * func ConvertVariableDeclarationToAssignmentExpression(emitContext *printer.EmitContext, element *ast.VariableDeclaration) *ast.Expression {
 * 	if element.Initializer == nil {
 * 		return nil
 * 	}
 * 	expression := convertBindingNameToAssignmentElementTarget(emitContext, element.Name())
 * 	assignment := emitContext.Factory.NewAssignmentExpression(expression, element.Initializer)
 * 	emitContext.SetOriginal(assignment, element.AsNode())
 * 	emitContext.AssignCommentAndSourceMapRanges(assignment, element.AsNode())
 * 	return assignment
 * }
 */
export function ConvertVariableDeclarationToAssignmentExpression(emitContext: GoPtr<EmitContext>, element: GoPtr<VariableDeclaration>): GoPtr<Expression> {
  if (element!.Initializer === undefined) {
    return undefined;
  }
  const expression = convertBindingNameToAssignmentElementTarget(emitContext, element!.name as unknown as GoPtr<Node>);
  const assignment = NodeFactory_NewAssignmentExpression(emitContext!.Factory!, expression!, element!.Initializer);
  EmitContext_SetOriginal(emitContext, assignment as unknown as GoPtr<Node>, element as unknown as GoPtr<Node>);
  EmitContext_AssignCommentAndSourceMapRanges(emitContext, assignment as unknown as GoPtr<Node>, element as unknown as GoPtr<Node>);
  return assignment;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::SingleOrMany","kind":"func","status":"implemented","sigHash":"cddfa4ce97dd905cf844b8a7a93df3aa13b96c7a2c829708e9003e7f149a56f1","bodyHash":"b40cf81412825da56d808a07e37958ec1887eb6fe0f795f2091600819bc94984"}
 *
 * Go source:
 * func SingleOrMany(nodes []*ast.Node, factory *printer.NodeFactory) *ast.Node {
 * 	if nodes == nil {
 * 		return nil
 * 	}
 * 	if len(nodes) == 1 {
 * 		return nodes[0]
 * 	}
 * 	return factory.NewSyntaxList(nodes)
 * }
 */
export function SingleOrMany(nodes: GoSlice<GoPtr<Node>> | undefined, factory: GoPtr<NodeFactory>): GoPtr<Node> {
  if (nodes === undefined) {
    return undefined;
  }
  if (nodes.length === 1) {
    return nodes[0];
  }
  return NewSyntaxList(factory!.__tsgoEmbedded0, nodes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::IsSimpleCopiableExpression","kind":"func","status":"implemented","sigHash":"dadb0d705d09414897911bb44f8f66e447b2b22c993dccd1d0081dc7e2fc9e58","bodyHash":"75a6c768813fe0711cb02ccbc69e28b23396c52fa56c5c47d253069d74b772f4"}
 *
 * Go source:
 * func IsSimpleCopiableExpression(expression *ast.Expression) bool {
 * 	return ast.IsStringLiteralLike(expression) ||
 * 		ast.IsNumericLiteral(expression) ||
 * 		ast.IsKeywordKind(expression.Kind) ||
 * 		ast.IsIdentifier(expression)
 * }
 */
export function IsSimpleCopiableExpression(expression: GoPtr<Expression>): bool {
  return (
    IsStringLiteralLike(expression as unknown as GoPtr<Node>) ||
    IsNumericLiteral(expression as unknown as GoPtr<Node>) ||
    IsKeywordKind((expression as unknown as GoPtr<Node>)!.Kind) ||
    IsIdentifier(expression as unknown as GoPtr<Node>)
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::IsOriginalNodeSingleLine","kind":"func","status":"implemented","sigHash":"26b015a14457cf5965cf2c8fe9b6e369ae16d29eb6ed263d016b9dbb9f97338f","bodyHash":"a3b0d7ad904b633c00f71bcaa3f8ca43429df0070831fb9c78faa325de03614a"}
 *
 * Go source:
 * func IsOriginalNodeSingleLine(emitContext *printer.EmitContext, node *ast.Node) bool {
 * 	if node == nil {
 * 		return false
 * 	}
 * 	original := emitContext.MostOriginal(node)
 * 	if original == nil {
 * 		return false
 * 	}
 * 	source := ast.GetSourceFileOfNode(original)
 * 	if source == nil {
 * 		return false
 * 	}
 * 	startLine := scanner.GetECMALineOfPosition(source, original.Loc.Pos())
 * 	endLine := scanner.GetECMALineOfPosition(source, original.Loc.End())
 * 	return startLine == endLine
 * }
 */
export function IsOriginalNodeSingleLine(emitContext: GoPtr<EmitContext>, node: GoPtr<Node>): bool {
  if (node === undefined) {
    return false;
  }
  const original = EmitContext_MostOriginal(emitContext, node);
  if (original === undefined) {
    return false;
  }
  const source = GetSourceFileOfNode(original);
  if (source === undefined) {
    return false;
  }
  const sourceFileLike = { Text: (): string => SourceFile_Text(source!), ECMALineMap: (): GoSlice<int> => SourceFile_ECMALineMap(source!) as GoSlice<int> };
  const startLine = GetECMALineOfPosition(sourceFileLike, Node_Pos(original));
  const endLine = GetECMALineOfPosition(sourceFileLike, Node_End(original));
  return startLine === endLine;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::IsSimpleInlineableExpression","kind":"func","status":"implemented","sigHash":"63052de82991e08086e0f7f61b9926ae944cef2a2aefdf41e05d4885f9d71b08","bodyHash":"b0cf373ae2fefa9d41ee4be6f2fac94cead8a45022797481327fb8ac152295d7"}
 *
 * Go source:
 * func IsSimpleInlineableExpression(expression *ast.Expression) bool {
 * 	return !ast.IsIdentifier(expression) && IsSimpleCopiableExpression(expression)
 * }
 */
export function IsSimpleInlineableExpression(expression: GoPtr<Expression>): bool {
  return !IsIdentifier(expression as unknown as GoPtr<Node>) && IsSimpleCopiableExpression(expression);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::FindSuperStatementIndexPath","kind":"func","status":"implemented","sigHash":"06a1a964ffba2254943ddd89593d332359c5daba36cd696e67af086050c8f98a","bodyHash":"52d08eedf70f43de9ec227529fb74d1b29765de19c08a616b60e18fff2e42649"}
 *
 * Go source:
 * func FindSuperStatementIndexPath(statements []*ast.Statement, start int) []int {
 * 	indices := findSuperStatementIndexPathWorker(statements, start, nil)
 * 	slices.Reverse(indices)
 * 	return indices
 * }
 */
export function FindSuperStatementIndexPath(statements: GoSlice<GoPtr<Statement>>, start: int): GoSlice<int> {
  const indices = findSuperStatementIndexPathWorker(statements, start, []);
  if (indices === undefined) {
    return [];
  }
  return [...indices].reverse();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::findSuperStatementIndexPathWorker","kind":"func","status":"implemented","sigHash":"1e6e07707b338822ea858ad0162a92f59155b8854f0f27786ee83fd02282dbac","bodyHash":"5d3c0b9647cb9064c7c2a1df75adf4b18d0c2791e5c0e2d52d85711cc1077e4d"}
 *
 * Go source:
 * func findSuperStatementIndexPathWorker(statements []*ast.Statement, start int, indices []int) []int {
 * 	for i := start; i < len(statements); i++ {
 * 		statement := statements[i]
 * 		if GetSuperCallFromStatement(statement) != nil {
 * 			return append(indices, i)
 * 		} else if ast.IsTryStatement(statement) {
 * 			if result := findSuperStatementIndexPathWorker(statement.AsTryStatement().TryBlock.Statements(), 0, indices); result != nil {
 * 				return append(result, i)
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function findSuperStatementIndexPathWorker(statements: GoSlice<GoPtr<Statement>>, start: int, indices: GoSlice<int>): GoSlice<int> {
  for (let i = start; i < statements.length; i++) {
    const statement = statements[i];
    if (GetSuperCallFromStatement(statement) !== undefined) {
      return [...indices, i];
    } else if (IsTryStatement(statement as unknown as GoPtr<Node>)) {
      const tryStmt = AsTryStatement(statement as unknown as GoPtr<Node>);
      const tryBlockStmts = Node_Statements(tryStmt!.TryBlock);
      if (tryBlockStmts !== undefined) {
        const result = findSuperStatementIndexPathWorker(tryBlockStmts as unknown as GoSlice<GoPtr<Statement>>, 0, indices);
        if (result !== undefined) {
          return [...result, i];
        }
      }
    }
  }
  return undefined!;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::GetSuperCallFromStatement","kind":"func","status":"implemented","sigHash":"251a76ee540a4a800c2ee02b12ad5a1e101d24ba7b962ba4b6a3cccb23b3ecb4","bodyHash":"f6aedf29f0133ff3696030a7d0fbbd480d9ff4e86fba0bec28290ecf229737ab"}
 *
 * Go source:
 * func GetSuperCallFromStatement(statement *ast.Statement) *ast.Node {
 * 	if !ast.IsExpressionStatement(statement) {
 * 		return nil
 * 	}
 * 	expression := ast.SkipParentheses(statement.Expression())
 * 	if ast.IsSuperCall(expression) {
 * 		return expression
 * 	}
 * 	return nil
 * }
 */
export function GetSuperCallFromStatement(statement: GoPtr<Statement>): GoPtr<Node> {
  if (!IsExpressionStatement(statement as unknown as GoPtr<Node>)) {
    return undefined;
  }
  const expression = SkipParentheses(Node_Expression(statement as unknown as GoPtr<Node>) as unknown as GoPtr<Expression>);
  if (IsSuperCall(expression as unknown as GoPtr<Node>)) {
    return expression as unknown as GoPtr<Node>;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::MoveRangePastModifiers","kind":"func","status":"implemented","sigHash":"a849b768e9f6d7159aaf524a7e9ed8937544fb7d4afda0aa942c69676e411092","bodyHash":"35ac1d1cd38ecb3166392d78ea983fc21b0ca68cec5fb3ba6c3b83b6235ece86"}
 *
 * Go source:
 * func MoveRangePastModifiers(node *ast.Node) core.TextRange {
 * 	if ast.IsPropertyDeclaration(node) || ast.IsMethodDeclaration(node) {
 * 		return core.NewTextRange(node.Name().Pos(), node.End())
 * 	}
 * 
 * 	var lastModifier *ast.Node
 * 	if ast.CanHaveModifiers(node) {
 * 		lastModifier = core.LastOrNil(node.ModifierNodes())
 * 	}
 * 
 * 	if lastModifier != nil && !ast.PositionIsSynthesized(lastModifier.End()) {
 * 		return core.NewTextRange(lastModifier.End(), node.End())
 * 	}
 * 	return MoveRangePastDecorators(node)
 * }
 */
export function MoveRangePastModifiers(node: GoPtr<Node>): TextRange {
  if (IsPropertyDeclaration(node) || IsMethodDeclaration(node)) {
    return NewTextRange(Node_Pos(Node_Name(node)!), Node_End(node));
  }
  let lastModifier: GoPtr<Node> = undefined;
  if (CanHaveModifiers(node)) {
    lastModifier = LastOrNil(Node_ModifierNodes(node) ?? []);
  }
  if (lastModifier !== undefined && !PositionIsSynthesized(Node_End(lastModifier))) {
    return NewTextRange(Node_End(lastModifier), Node_End(node));
  }
  return MoveRangePastDecorators(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::MoveRangePastDecorators","kind":"func","status":"implemented","sigHash":"eb03ee113a32994745a2e378e9ef5b5aa2a8a4f81b88fa926cb2605568766fa0","bodyHash":"377aee4ff173da1e0e18cbfe48e0eb046923c86a06fbd1775e0cd08966da4541"}
 *
 * Go source:
 * func MoveRangePastDecorators(node *ast.Node) core.TextRange {
 * 	var lastDecorator *ast.Node
 * 	if ast.CanHaveModifiers(node) {
 * 		nodes := node.ModifierNodes()
 * 		if nodes != nil {
 * 			lastDecorator = core.FindLast(nodes, ast.IsDecorator)
 * 		}
 * 	}
 * 
 * 	if lastDecorator != nil && !ast.PositionIsSynthesized(lastDecorator.End()) {
 * 		return core.NewTextRange(lastDecorator.End(), node.End())
 * 	}
 * 	return node.Loc
 * }
 */
export function MoveRangePastDecorators(node: GoPtr<Node>): TextRange {
  let lastDecorator: GoPtr<Node> = undefined;
  if (CanHaveModifiers(node)) {
    const nodes = Node_ModifierNodes(node);
    if (nodes !== undefined) {
      lastDecorator = FindLast(nodes, IsDecorator);
    }
  }
  if (lastDecorator !== undefined && !PositionIsSynthesized(Node_End(lastDecorator))) {
    return NewTextRange(Node_End(lastDecorator), Node_End(node));
  }
  return node!.Loc;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/utilities.go::func::GetNonAssignmentOperatorForCompoundAssignment","kind":"func","status":"implemented","sigHash":"b42d56ffea6071669475d40585658b1e67ae27ddbd197f85f7b094e4d4ebeb46","bodyHash":"bf69b3782109b37b0381262aacbcbde8461b4254d9b29c1c2f9b35e9fdf8207b"}
 *
 * Go source:
 * func GetNonAssignmentOperatorForCompoundAssignment(kind ast.Kind) ast.Kind {
 * 	switch kind {
 * 	case ast.KindPlusEqualsToken:
 * 		return ast.KindPlusToken
 * 	case ast.KindMinusEqualsToken:
 * 		return ast.KindMinusToken
 * 	case ast.KindAsteriskEqualsToken:
 * 		return ast.KindAsteriskToken
 * 	case ast.KindAsteriskAsteriskEqualsToken:
 * 		return ast.KindAsteriskAsteriskToken
 * 	case ast.KindSlashEqualsToken:
 * 		return ast.KindSlashToken
 * 	case ast.KindPercentEqualsToken:
 * 		return ast.KindPercentToken
 * 	case ast.KindLessThanLessThanEqualsToken:
 * 		return ast.KindLessThanLessThanToken
 * 	case ast.KindGreaterThanGreaterThanEqualsToken:
 * 		return ast.KindGreaterThanGreaterThanToken
 * 	case ast.KindGreaterThanGreaterThanGreaterThanEqualsToken:
 * 		return ast.KindGreaterThanGreaterThanGreaterThanToken
 * 	case ast.KindAmpersandEqualsToken:
 * 		return ast.KindAmpersandToken
 * 	case ast.KindBarEqualsToken:
 * 		return ast.KindBarToken
 * 	case ast.KindCaretEqualsToken:
 * 		return ast.KindCaretToken
 * 	case ast.KindBarBarEqualsToken:
 * 		return ast.KindBarBarToken
 * 	case ast.KindAmpersandAmpersandEqualsToken:
 * 		return ast.KindAmpersandAmpersandToken
 * 	case ast.KindQuestionQuestionEqualsToken:
 * 		return ast.KindQuestionQuestionToken
 * 	}
 * 	return kind
 * }
 */
export function GetNonAssignmentOperatorForCompoundAssignment(kind: Kind): Kind {
  switch (kind) {
    case KindPlusEqualsToken:
      return KindPlusToken;
    case KindMinusEqualsToken:
      return KindMinusToken;
    case KindAsteriskEqualsToken:
      return KindAsteriskToken;
    case KindAsteriskAsteriskEqualsToken:
      return KindAsteriskAsteriskToken;
    case KindSlashEqualsToken:
      return KindSlashToken;
    case KindPercentEqualsToken:
      return KindPercentToken;
    case KindLessThanLessThanEqualsToken:
      return KindLessThanLessThanToken;
    case KindGreaterThanGreaterThanEqualsToken:
      return KindGreaterThanGreaterThanToken;
    case KindGreaterThanGreaterThanGreaterThanEqualsToken:
      return KindGreaterThanGreaterThanGreaterThanToken;
    case KindAmpersandEqualsToken:
      return KindAmpersandToken;
    case KindBarEqualsToken:
      return KindBarToken;
    case KindCaretEqualsToken:
      return KindCaretToken;
    case KindBarBarEqualsToken:
      return KindBarBarToken;
    case KindAmpersandAmpersandEqualsToken:
      return KindAmpersandAmpersandToken;
    case KindQuestionQuestionEqualsToken:
      return KindQuestionQuestionToken;
  }
  return kind;
}
