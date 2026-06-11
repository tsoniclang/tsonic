import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { ModifierList, Node, NodeList } from "../../ast/spine.js";
import {
  NewArrayTypeNode,
  NewConditionalTypeNode,
  NewConstructorTypeNode,
  NewExpressionWithTypeArguments,
  NewFunctionTypeNode,
  NewHeritageClause,
  NewImportTypeNode,
  NewIndexedAccessTypeNode,
  NewInferTypeNode,
  NewIntersectionTypeNode,
  NewJSDocNonNullableType,
  NewJSDocNullableType,
  NewKeywordTypeNode,
  NewLiteralTypeNode,
  NewMappedTypeNode,
  NewNamedTupleMember,
  NewParenthesizedTypeNode,
  NewPrefixUnaryExpression,
  NewRestTypeNode,
  NewTemplateLiteralTypeNode,
  NewTemplateLiteralTypeSpan,
  NewThisTypeNode,
  NewTupleTypeNode,
  NewTypeAliasDeclaration,
  NewTypeAssertion,
  NewTypeLiteralNode,
  NewTypeOfExpression,
  NewTypeOperatorNode,
  NewTypeParameterDeclaration,
  NewTypePredicateNode,
  NewTypeQueryNode,
  NewTypeReferenceNode,
  NewOptionalTypeNode,
  NewUnionTypeNode,
} from "../../ast/generated/factory.js";
import { KindAbstractKeyword, KindAmpersandToken, KindAnyKeyword, KindAssertKeyword, KindAssertsKeyword, KindAsKeyword, KindAsteriskEqualsToken, KindAsteriskToken, KindBarToken, KindBigIntKeyword, KindBigIntLiteral, KindBooleanKeyword, KindCallSignature, KindCloseBraceToken, KindCloseBracketToken, KindCloseParenToken, KindColonToken, KindCommaToken, KindConstructSignature, KindDotToken, KindDotDotDotToken, KindEqualsGreaterThanToken, KindEqualsToken, KindExclamationToken, KindExtendsKeyword, KindFalseKeyword, KindFunctionKeyword, KindFunctionType, KindGetAccessor, KindGetKeyword, KindGreaterThanToken, KindImplementsKeyword, KindImportKeyword, KindInKeyword, KindInferKeyword, KindIntrinsicKeyword, KindIsKeyword, KindKeyOfKeyword, KindLessThanToken, KindMinusToken, KindNeverKeyword, KindNewKeyword, KindNullKeyword, KindNumberKeyword, KindNumericLiteral, KindNoSubstitutionTemplateLiteral, KindObjectKeyword, KindOpenBraceToken, KindOpenBracketToken, KindOpenParenToken, KindPlusToken, KindQuestionToken, KindQuestionQuestionToken, KindReadonlyKeyword, KindSetAccessor, KindSetKeyword, KindStringKeyword, KindStringLiteral, KindSymbolKeyword, KindTemplateHead, KindTemplateMiddle, KindThisKeyword, KindTrueKeyword, KindTypeKeyword, KindTypeOfKeyword, KindUndefinedKeyword, KindUniqueKeyword, KindUnknownKeyword, KindVoidKeyword, KindWithKeyword } from "../../ast/generated/kinds.js";
import type { Kind } from "../../ast/generated/kinds.js";
import { NodeFlagsDisallowConditionalTypesContext, NodeFlagsJavaScriptFile, NodeFlagsPossiblyContainsDynamicImport, NodeFlagsTypeExcludesFlags } from "../../ast/generated/flags.js";
import { IsExpressionWithTypeArguments, IsJSDocNullableType, IsModifierKind } from "../../ast/generated/predicates.js";
import type { TypeNode } from "../../ast/generated/unions.js";
import { Node_Pos } from "../../ast/spine.js";
import { Node_Type, NodeFactory_NewModifier } from "../../ast/ast.js";
import { Assert } from "../../debug/debug.js";
import { Diagnostic_AddRelatedInfo, Diagnostic_Code, NewDiagnostic } from "../../ast/diagnostic.js";
import { IfElse } from "../../core/core.js";
import { NewTextRange } from "../../core/text.js";
import { Arena_Clone, Arena_NewSlice1 } from "../../core/arena.js";
import type { Arena } from "../../core/arena.js";
import { LanguageVariantJSX } from "../../core/languagevariant.js";
import { Constructor_type_notation_must_be_parenthesized_when_used_in_a_union_type, Constructor_type_notation_must_be_parenthesized_when_used_in_an_intersection_type, Function_type_notation_must_be_parenthesized_when_used_in_a_union_type, Function_type_notation_must_be_parenthesized_when_used_in_an_intersection_type, Import_assertions_have_been_replaced_by_import_attributes_Use_with_instead_of_assert, Line_break_not_permitted_here, The_parser_expected_to_find_a_1_to_match_the_0_token_here, Type_expected, X_0_expected } from "../../diagnostics/generated/messages.js";
import { Scanner_TokenStart, TokenToString } from "../../scanner/scanner.js";
import { tokenIsIdentifierOrKeyword } from "../../scanner/utilities.js";
import { ParseFlagsType } from "../types.js";
import { Parser_withJSDoc } from "../jsdoc.js";
import { Parser_canParseSemicolon, Parser_checkJSSyntax, Parser_finishNode, Parser_isIndexSignature, Parser_isStartOfParameter, Parser_lookAhead, Parser_mark, Parser_nodePos, Parser_parseEntityName, Parser_parseModifiers, Parser_parseModifiersEx, Parser_parseOptional, Parser_parsePropertyOrMethodSignature, Parser_parseSemicolon, Parser_rewind, Parser_skipParameterStart } from "./support.js";
import { Parser_createMissingList, Parser_newModifierList, Parser_newNodeList, Parser_parseBracketedList, Parser_parseDelimitedList, Parser_parseList, Parser_parseParameters } from "./lists.js";
import { Parser_isIdentifier, Parser_jsdocScannerInfo, Parser_parseContextualModifier, Parser_parseErrorAtCurrentToken, Parser_parseExpected, Parser_parseExpectedToken, Parser_parseIdentifier, Parser_parseIdentifierName, Parser_parseOptionalToken, Parser_parseTokenNode, Parser_reScanGreaterThanToken, Parser_reScanLessThanToken, Parser_nextToken, Parser_nextTokenIsIdentifier, Parser_nextTokenIsColonOrQuestionColon, Parser_nextTokenIsIdentifierOrKeywordOnSameLine, Parser_nextTokenIsOpenParenOrLessThan, Parser_setContextFlags, doInContext } from "./tokens-speculation.js";
import { Parser_isBinaryOperator, Parser_isLiteralPropertyName, Parser_isStartOfExpression, Parser_nextIsStartOfExpression, Parser_nextTokenIsNewKeyword, Parser_nextTokenIsNumericOrBigIntLiteral, Parser_parseKeywordExpression, Parser_parseLeftHandSideExpressionOrHigher, Parser_parseLiteralExpression, Parser_parseLiteralOfTemplateSpan, Parser_parseSignatureMember, Parser_parseSimpleUnaryExpression, Parser_parseTemplateHead, Parser_parseUnaryExpressionOrHigher } from "./expressions.js";
import { Parser_hasPrecedingLineBreak, Parser_nextIsNotDot, Parser_parseAccessorDeclaration, Parser_parseImportAttributes, Parser_parseIndexSignatureDeclaration } from "./statements-declarations.js";
import { Parser_parseErrorAtRange } from "./errors-recovery.js";
import { AsTemplateLiteralTypeSpan } from "../../ast/generated/casts.js";
import { Parser_parseJSDocAllType, Parser_parseJSDocNonNullableType, Parser_parseJSDocNullableType } from "./jsx-jsdoc.js";
import { Scanner_ReScanAsteriskEqualsToken, Scanner_ReScanQuestionToken } from "../../scanner/scanner.js";
import { PCHeritageClauseElement, PCHeritageClauses, PCTupleElementTypes, PCTypeArguments, PCTypeMembers, PCTypeParameters } from "./state.js";
import type { Parser, jsdocScannerInfo } from "./state.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeAnnotation","kind":"method","status":"implemented","sigHash":"adeb19ed0f33f094ab8118ef44389341fcde713436a0c4f851edefe8318f7b75","bodyHash":"ffe2e6ac91a5266071191731e503f90b71c785e29183a83e3b67c9775406205d"}
 *
 * Go source:
 * func (p *Parser) parseTypeAnnotation() *ast.TypeNode {
 * 	if p.parseOptional(ast.KindColonToken) {
 * 		return p.parseType()
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseTypeAnnotation(receiver: GoPtr<Parser>): GoPtr<TypeNode> {
  if (Parser_parseOptional(receiver, KindColonToken)) {
    return Parser_parseType(receiver);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseHeritageClauses","kind":"method","status":"implemented","sigHash":"1f4fcd6c0caf110ba652571c3d83a2bc9b98791367f15e24b6a736349a91788f","bodyHash":"d4e81922beb5124024c73ccb36b4053a0cbdab12a0a84ef87ef4a3b744bb3d1d"}
 *
 * Go source:
 * func (p *Parser) parseHeritageClauses() *ast.NodeList {
 * 	// ClassTail[Yield,Await] : (Modified) See 14.5
 * 	//      ClassHeritage[?Yield,?Await]opt { ClassBody[?Yield,?Await]opt }
 * 	if p.isHeritageClause() {
 * 		return p.parseList(PCHeritageClauses, (*Parser).parseHeritageClause)
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseHeritageClauses(receiver: GoPtr<Parser>): GoPtr<NodeList> {
  // ClassTail[Yield,Await] : (Modified) See 14.5
  //      ClassHeritage[?Yield,?Await]opt { ClassBody[?Yield,?Await]opt }
  if (Parser_isHeritageClause(receiver)) {
    return Parser_parseList(receiver, PCHeritageClauses, Parser_parseHeritageClause);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseHeritageClause","kind":"method","status":"implemented","sigHash":"f7d53d301e8c3d5b2b02767b97566dac1a048f2b4966ce416125c112496a271d","bodyHash":"b5341c3cea425bd58f4df1efbf2c3f8ac8af66b541e0e97cc619ebe8a40e8933"}
 *
 * Go source:
 * func (p *Parser) parseHeritageClause() *ast.Node {
 * 	pos := p.nodePos()
 * 	kind := p.token
 * 	p.nextToken()
 * 	types := p.parseDelimitedList(PCHeritageClauseElement, (*Parser).parseExpressionWithTypeArguments)
 * 	return p.checkJSSyntax(p.finishNode(p.factory.NewHeritageClause(kind, types), pos))
 * }
 */
export function Parser_parseHeritageClause(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const kind = receiver!.token;
  Parser_nextToken(receiver);
  const types = Parser_parseDelimitedList(receiver, PCHeritageClauseElement, Parser_parseExpressionWithTypeArguments);
  return Parser_checkJSSyntax(receiver, Parser_finishNode(receiver, NewHeritageClause(receiver!.factory, kind, types), pos));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExpressionWithTypeArguments","kind":"method","status":"implemented","sigHash":"407e3135e39eccc0de1437dac616de675e9024a77f367dfb8446c9e38a87e32e","bodyHash":"6ebfa1ddd47ab7ebab8871899585e95a0ba0a199274963a0caec38f4866c550a"}
 *
 * Go source:
 * func (p *Parser) parseExpressionWithTypeArguments() *ast.Node {
 * 	pos := p.nodePos()
 * 	expression := p.parseLeftHandSideExpressionOrHigher()
 * 	if ast.IsExpressionWithTypeArguments(expression) {
 * 		return expression
 * 	}
 * 	typeArguments := p.parseTypeArguments()
 * 	return p.finishNode(p.factory.NewExpressionWithTypeArguments(expression, typeArguments), pos)
 * }
 */
export function Parser_parseExpressionWithTypeArguments(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const expression = Parser_parseLeftHandSideExpressionOrHigher(receiver);
  if (IsExpressionWithTypeArguments(expression)) {
    return expression;
  }
  const typeArguments = Parser_parseTypeArguments(receiver);
  return Parser_finishNode(receiver, NewExpressionWithTypeArguments(receiver!.factory, expression, typeArguments), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeAliasDeclaration","kind":"method","status":"implemented","sigHash":"df7b275cbfe0d4b22c7a57a30fd25321034239708e503cb4c267534c5ba27521","bodyHash":"36dd7d6bb9e1c1bcb1507d24645d837dcd3e74eb6aa162e70547b6176f9ec38e"}
 *
 * Go source:
 * func (p *Parser) parseTypeAliasDeclaration(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	p.parseExpected(ast.KindTypeKeyword)
 * 	if p.hasPrecedingLineBreak() {
 * 		p.parseErrorAtCurrentToken(diagnostics.Line_break_not_permitted_here)
 * 	}
 * 	name := p.parseIdentifier()
 * 	typeParameters := p.parseTypeParameters()
 * 	p.parseExpected(ast.KindEqualsToken)
 * 	var typeNode *ast.TypeNode
 * 	if p.token == ast.KindIntrinsicKeyword && p.lookAhead((*Parser).nextIsNotDot) {
 * 		typeNode = p.parseKeywordTypeNode()
 * 	} else {
 * 		typeNode = p.parseType()
 * 	}
 * 	p.parseSemicolon()
 * 	result := p.finishNode(p.factory.NewTypeAliasDeclaration(modifiers, name, typeParameters, typeNode), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	return result
 * }
 */
export function Parser_parseTypeAliasDeclaration(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  Parser_parseExpected(receiver, KindTypeKeyword);
  if (Parser_hasPrecedingLineBreak(receiver)) {
    Parser_parseErrorAtCurrentToken(receiver, Line_break_not_permitted_here);
  }
  const name = Parser_parseIdentifier(receiver);
  const typeParameters = Parser_parseTypeParameters(receiver);
  Parser_parseExpected(receiver, KindEqualsToken);
  const typeNode = receiver!.token === KindIntrinsicKeyword && Parser_lookAhead(receiver, Parser_nextIsNotDot)
    ? Parser_parseKeywordTypeNode(receiver)
    : Parser_parseType(receiver);
  Parser_parseSemicolon(receiver);
  const result = Parser_finishNode(receiver, NewTypeAliasDeclaration(receiver!.factory, modifiers, name, typeParameters, typeNode), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseType","kind":"method","status":"implemented","sigHash":"c0cbc137688617b677624edfa4b077357c4b724a73030b679e3e186d5142a13c","bodyHash":"b21a021c8ef341454c062e6e7a38e79703dcf60fbab34789d2f7421600de7ffe"}
 *
 * Go source:
 * func (p *Parser) parseType() *ast.TypeNode {
 * 	saveContextFlags := p.contextFlags
 * 	p.setContextFlags(ast.NodeFlagsTypeExcludesFlags, false)
 * 	var typeNode *ast.TypeNode
 * 	if p.isStartOfFunctionTypeOrConstructorType() {
 * 		typeNode = p.parseFunctionOrConstructorType()
 * 	} else {
 * 		pos := p.nodePos()
 * 		typeNode = p.parseUnionTypeOrHigher()
 * 		if !p.inDisallowConditionalTypesContext() && !p.hasPrecedingLineBreak() && p.parseOptional(ast.KindExtendsKeyword) {
 * 			// The type following 'extends' is not permitted to be another conditional type
 * 			extendsType := doInContext(p, ast.NodeFlagsDisallowConditionalTypesContext, true, (*Parser).parseType)
 * 			p.parseExpected(ast.KindQuestionToken)
 * 			trueType := doInContext(p, ast.NodeFlagsDisallowConditionalTypesContext, false, (*Parser).parseType)
 * 			p.parseExpected(ast.KindColonToken)
 * 			falseType := doInContext(p, ast.NodeFlagsDisallowConditionalTypesContext, false, (*Parser).parseType)
 * 			conditionalType := p.factory.NewConditionalTypeNode(typeNode, extendsType, trueType, falseType)
 * 			p.finishNode(conditionalType, pos)
 * 			typeNode = conditionalType
 * 		}
 * 	}
 * 	p.contextFlags = saveContextFlags
 * 	return typeNode
 * }
 */
export function Parser_parseType(receiver: GoPtr<Parser>): GoPtr<TypeNode> {
  const saveContextFlags = receiver!.contextFlags;
  Parser_setContextFlags(receiver, NodeFlagsTypeExcludesFlags, false);
  const typeNode = Parser_isStartOfFunctionTypeOrConstructorType(receiver)
    ? Parser_parseFunctionOrConstructorType(receiver)
    : ((): GoPtr<TypeNode> => {
        const pos = Parser_nodePos(receiver);
        const unionType = Parser_parseUnionTypeOrHigher(receiver);
        if (!Parser_inDisallowConditionalTypesContext(receiver) && !Parser_hasPrecedingLineBreak(receiver) && Parser_parseOptional(receiver, KindExtendsKeyword)) {
          // The type following 'extends' is not permitted to be another conditional type
          const extendsType = doInContext(receiver, NodeFlagsDisallowConditionalTypesContext, true, Parser_parseType);
          Parser_parseExpected(receiver, KindQuestionToken);
          const trueType = doInContext(receiver, NodeFlagsDisallowConditionalTypesContext, false, Parser_parseType);
          Parser_parseExpected(receiver, KindColonToken);
          const falseType = doInContext(receiver, NodeFlagsDisallowConditionalTypesContext, false, Parser_parseType);
          const conditionalType = NewConditionalTypeNode(receiver!.factory, unionType, extendsType, trueType, falseType);
          Parser_finishNode(receiver, conditionalType, pos);
          return conditionalType;
        }
        return unionType;
      })();
  receiver!.contextFlags = saveContextFlags;
  return typeNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseUnionTypeOrHigher","kind":"method","status":"implemented","sigHash":"4d6523fba2165c7d4ac18ee1028da7f31693c3df8770f5ee94d110195e2d2b20","bodyHash":"5a707ffe35bd21ab76d7b8569b31f3716c6257e581339794ca4bf206af625e14"}
 *
 * Go source:
 * func (p *Parser) parseUnionTypeOrHigher() *ast.TypeNode {
 * 	return p.parseUnionOrIntersectionType(ast.KindBarToken, (*Parser).parseIntersectionTypeOrHigher)
 * }
 */
export function Parser_parseUnionTypeOrHigher(receiver: GoPtr<Parser>): GoPtr<TypeNode> {
  return Parser_parseUnionOrIntersectionType(receiver, KindBarToken, Parser_parseIntersectionTypeOrHigher);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseIntersectionTypeOrHigher","kind":"method","status":"implemented","sigHash":"1e2cfbd7e713597579a4ed5495a61822e6429c8c6cde547b985bc2b44aabdb55","bodyHash":"b6cec451f8f92214d9326321f54ae58da61723ebc5beb1af743b3007de9088ec"}
 *
 * Go source:
 * func (p *Parser) parseIntersectionTypeOrHigher() *ast.TypeNode {
 * 	return p.parseUnionOrIntersectionType(ast.KindAmpersandToken, (*Parser).parseTypeOperatorOrHigher)
 * }
 */
export function Parser_parseIntersectionTypeOrHigher(receiver: GoPtr<Parser>): GoPtr<TypeNode> {
  return Parser_parseUnionOrIntersectionType(receiver, KindAmpersandToken, Parser_parseTypeOperatorOrHigher);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseUnionOrIntersectionType","kind":"method","status":"implemented","sigHash":"c5e4f659e3adf4835e26bd3485c799f4cc22981e030407def2d659f7d90d6f75","bodyHash":"43f396b9d05906147a42ce417a37229e7885c140d0c67bfee49dd32a546e0c81"}
 *
 * Go source:
 * func (p *Parser) parseUnionOrIntersectionType(operator ast.Kind, parseConstituentType func(p *Parser) *ast.TypeNode) *ast.TypeNode {
 * 	pos := p.nodePos()
 * 	isUnionType := operator == ast.KindBarToken
 * 	hasLeadingOperator := p.parseOptional(operator)
 * 	var typeNode *ast.TypeNode
 * 	if hasLeadingOperator {
 * 		typeNode = p.parseFunctionOrConstructorTypeToError(isUnionType, parseConstituentType)
 * 	} else {
 * 		typeNode = parseConstituentType(p)
 * 	}
 * 	if p.token == operator || hasLeadingOperator {
 * 		types := make([]*ast.Node, 1, 8)
 * 		types[0] = typeNode
 * 		for p.parseOptional(operator) {
 * 			types = append(types, p.parseFunctionOrConstructorTypeToError(isUnionType, parseConstituentType))
 * 		}
 * 		typeNode = p.createUnionOrIntersectionTypeNode(operator, p.newNodeList(core.NewTextRange(pos, p.nodePos()), p.nodeSliceArena.Clone(types)))
 * 		p.finishNode(typeNode, pos)
 * 	}
 * 	return typeNode
 * }
 */
export function Parser_parseUnionOrIntersectionType(receiver: GoPtr<Parser>, operator: Kind, parseConstituentType: (p: GoPtr<Parser>) => GoPtr<TypeNode>): GoPtr<TypeNode> {
  const pos = Parser_nodePos(receiver);
  const isUnionType = operator === KindBarToken;
  const hasLeadingOperator = Parser_parseOptional(receiver, operator);
  let typeNode: GoPtr<TypeNode>;
  if (hasLeadingOperator) {
    typeNode = Parser_parseFunctionOrConstructorTypeToError(receiver, isUnionType, parseConstituentType);
  } else {
    typeNode = parseConstituentType(receiver);
  }
  if (receiver!.token === operator || hasLeadingOperator) {
    const types: GoSlice<GoPtr<Node>> = [typeNode as GoPtr<Node>];
    while (Parser_parseOptional(receiver, operator)) {
      types.push(Parser_parseFunctionOrConstructorTypeToError(receiver, isUnionType, parseConstituentType) as GoPtr<Node>);
    }
    typeNode = Parser_finishNode(
      receiver,
      Parser_createUnionOrIntersectionTypeNode(
        receiver,
        operator,
        Parser_newNodeList(receiver, NewTextRange(pos, Parser_nodePos(receiver)), Arena_Clone(receiver!.nodeSliceArena as GoPtr<Arena<GoPtr<Node>>>, types)),
      ),
      pos,
    );
  }
  return typeNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.createUnionOrIntersectionTypeNode","kind":"method","status":"implemented","sigHash":"ac0ee874c901e47ccf55d664f5d1f82a39b94d87e0cb3a262cd6d42372819f35","bodyHash":"7b2cfea113eaf2423d97a130b087ac01703b648844cfd16975c69c475d22b4cb"}
 *
 * Go source:
 * func (p *Parser) createUnionOrIntersectionTypeNode(operator ast.Kind, types *ast.NodeList) *ast.Node {
 * 	switch operator {
 * 	case ast.KindBarToken:
 * 		return p.factory.NewUnionTypeNode(types)
 * 	case ast.KindAmpersandToken:
 * 		return p.factory.NewIntersectionTypeNode(types)
 * 	default:
 * 		panic("Unhandled case in createUnionOrIntersectionType")
 * 	}
 * }
 */
export function Parser_createUnionOrIntersectionTypeNode(receiver: GoPtr<Parser>, operator: Kind, types: GoPtr<NodeList>): GoPtr<Node> {
  switch (operator) {
    case KindBarToken:
      return NewUnionTypeNode(receiver!.factory, types);
    case KindAmpersandToken:
      return NewIntersectionTypeNode(receiver!.factory, types);
    default:
      throw new globalThis.Error("Unhandled case in createUnionOrIntersectionType");
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeOperatorOrHigher","kind":"method","status":"implemented","sigHash":"8ca8779be7ab389c5ed90bcd53ce0fe50b4bf2cd881322ef844023c8e5cfc456","bodyHash":"5d0822c1f768c202f6fee870238da286f96f7ab00e30cd40c0074128b212ca47"}
 *
 * Go source:
 * func (p *Parser) parseTypeOperatorOrHigher() *ast.TypeNode {
 * 	operator := p.token
 * 	switch operator {
 * 	case ast.KindKeyOfKeyword, ast.KindUniqueKeyword, ast.KindReadonlyKeyword:
 * 		return p.parseTypeOperator(operator)
 * 	case ast.KindInferKeyword:
 * 		return p.parseInferType()
 * 	}
 * 	return doInContext(p, ast.NodeFlagsDisallowConditionalTypesContext, false, (*Parser).parsePostfixTypeOrHigher)
 * }
 */
export function Parser_parseTypeOperatorOrHigher(receiver: GoPtr<Parser>): GoPtr<TypeNode> {
  const operator = receiver!.token;
  switch (operator) {
    case KindKeyOfKeyword:
    case KindUniqueKeyword:
    case KindReadonlyKeyword:
      return Parser_parseTypeOperator(receiver, operator);
    case KindInferKeyword:
      return Parser_parseInferType(receiver);
  }
  return doInContext(receiver, NodeFlagsDisallowConditionalTypesContext, false, Parser_parsePostfixTypeOrHigher);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeOperator","kind":"method","status":"implemented","sigHash":"c3ada9b871f144b530cc78d43e1dfcd8d6369ed036ce8d9afcf4f7c2aaa61cb1","bodyHash":"c2fa37a04682a90bb4b4e7a91d6a336b8ea03926f4cadf2b0bade6c03ba00732"}
 *
 * Go source:
 * func (p *Parser) parseTypeOperator(operator ast.Kind) *ast.Node {
 * 	pos := p.nodePos()
 * 	p.parseExpected(operator)
 * 	return p.finishNode(p.factory.NewTypeOperatorNode(operator, p.parseTypeOperatorOrHigher()), pos)
 * }
 */
export function Parser_parseTypeOperator(receiver: GoPtr<Parser>, operator: Kind): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, operator);
  return Parser_finishNode(receiver, NewTypeOperatorNode(receiver!.factory, operator, Parser_parseTypeOperatorOrHigher(receiver)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseInferType","kind":"method","status":"implemented","sigHash":"f12de2c712227a5914312b5fb3cf8af363db518fad183cd2131b6b7e6f39f7cc","bodyHash":"2788621a155666951e35260c6897e4fa69cf79aaa4d2db7ccb9daefc2842bbd6"}
 *
 * Go source:
 * func (p *Parser) parseInferType() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindInferKeyword)
 * 	return p.finishNode(p.factory.NewInferTypeNode(p.parseTypeParameterOfInferType()), pos)
 * }
 */
export function Parser_parseInferType(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindInferKeyword);
  return Parser_finishNode(receiver, NewInferTypeNode(receiver!.factory, Parser_parseTypeParameterOfInferType(receiver)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeParameterOfInferType","kind":"method","status":"implemented","sigHash":"dd48ba96f238f65727b6fa09cfded538ef10d975cbaef769f209df3357758433","bodyHash":"70e117bcd4fa33dc7e5c94d5c033e72f7169641cb28377963edfe2eefff65b65"}
 *
 * Go source:
 * func (p *Parser) parseTypeParameterOfInferType() *ast.Node {
 * 	pos := p.nodePos()
 * 	name := p.parseIdentifier()
 * 	constraint := p.tryParseConstraintOfInferType()
 * 	return p.finishNode(p.factory.NewTypeParameterDeclaration(nil /*modifiers* /, name, constraint, nil /*expression* /, nil /*defaultType* /), pos)
 * }
 */
export function Parser_parseTypeParameterOfInferType(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const name = Parser_parseIdentifier(receiver);
  const constraint = Parser_tryParseConstraintOfInferType(receiver);
  return Parser_finishNode(receiver, NewTypeParameterDeclaration(receiver!.factory, undefined /*modifiers*/, name, constraint, undefined /*expression*/, undefined /*defaultType*/), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.tryParseConstraintOfInferType","kind":"method","status":"implemented","sigHash":"48ee9b2002c6be4fb3f67742a57b14c4a8ce7d7445b3fda80caac75c4a8b5254","bodyHash":"283de16e9ba3d2c5b456fb60fb29f0c9660de9d9a6e76390f95c78c02ce2d0a8"}
 *
 * Go source:
 * func (p *Parser) tryParseConstraintOfInferType() *ast.Node {
 * 	state := p.mark()
 * 	if p.parseOptional(ast.KindExtendsKeyword) {
 * 		constraint := doInContext(p, ast.NodeFlagsDisallowConditionalTypesContext, true, (*Parser).parseType)
 * 		if p.inDisallowConditionalTypesContext() || p.token != ast.KindQuestionToken {
 * 			return constraint
 * 		}
 * 	}
 * 	p.rewind(state)
 * 	return nil
 * }
 */
export function Parser_tryParseConstraintOfInferType(receiver: GoPtr<Parser>): GoPtr<Node> {
  const state = Parser_mark(receiver);
  if (Parser_parseOptional(receiver, KindExtendsKeyword)) {
    const constraint = doInContext(receiver, NodeFlagsDisallowConditionalTypesContext, true, Parser_parseType);
    if (Parser_inDisallowConditionalTypesContext(receiver) || receiver!.token !== KindQuestionToken) {
      return constraint;
    }
  }
  Parser_rewind(receiver, state);
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parsePostfixTypeOrHigher","kind":"method","status":"implemented","sigHash":"4183c9e99ea10850c6b958e47126e177b4dae53b883bece909fe540efdb8267a","bodyHash":"3d1ed3cd231561a63af3edcbc653c51be0a8d3e2ff5196a109c6e80e122d5fe0"}
 *
 * Go source:
 * func (p *Parser) parsePostfixTypeOrHigher() *ast.Node {
 * 	pos := p.nodePos()
 * 	typeNode := p.parseNonArrayType()
 * 	for !p.hasPrecedingLineBreak() {
 * 		switch p.token {
 * 		case ast.KindExclamationToken:
 * 			p.nextToken()
 * 			typeNode = p.finishNode(p.factory.NewJSDocNonNullableType(typeNode), pos)
 * 		case ast.KindQuestionToken:
 * 			// If next token is start of a type we have a conditional type
 * 			if p.lookAhead((*Parser).nextIsStartOfType) {
 * 				return typeNode
 * 			}
 * 			p.nextToken()
 * 			typeNode = p.finishNode(p.factory.NewJSDocNullableType(typeNode), pos)
 * 		case ast.KindOpenBracketToken:
 * 			p.parseExpected(ast.KindOpenBracketToken)
 * 			if p.isStartOfType(false /*isStartOfParameter* /) {
 * 				indexType := p.parseType()
 * 				p.parseExpected(ast.KindCloseBracketToken)
 * 				typeNode = p.finishNode(p.factory.NewIndexedAccessTypeNode(typeNode, indexType), pos)
 * 			} else {
 * 				p.parseExpected(ast.KindCloseBracketToken)
 * 				typeNode = p.finishNode(p.factory.NewArrayTypeNode(typeNode), pos)
 * 			}
 * 		default:
 * 			return typeNode
 * 		}
 * 	}
 * 	return typeNode
 * }
 */
export function Parser_parsePostfixTypeOrHigher(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const loop = (typeNode: GoPtr<Node>): GoPtr<Node> => {
    if (Parser_hasPrecedingLineBreak(receiver)) {
      return typeNode;
    }
    switch (receiver!.token) {
      case KindExclamationToken:
        Parser_nextToken(receiver);
        return loop(Parser_finishNode(receiver, NewJSDocNonNullableType(receiver!.factory, typeNode), pos));
      case KindQuestionToken:
        // If next token is start of a type we have a conditional type
        if (Parser_lookAhead(receiver, Parser_nextIsStartOfType)) {
          return typeNode;
        }
        Parser_nextToken(receiver);
        return loop(Parser_finishNode(receiver, NewJSDocNullableType(receiver!.factory, typeNode), pos));
      case KindOpenBracketToken: {
        Parser_parseExpected(receiver, KindOpenBracketToken);
        if (Parser_isStartOfType(receiver, false /*isStartOfParameter*/)) {
          const indexType = Parser_parseType(receiver);
          Parser_parseExpected(receiver, KindCloseBracketToken);
          return loop(Parser_finishNode(receiver, NewIndexedAccessTypeNode(receiver!.factory, typeNode, indexType), pos));
        }
        Parser_parseExpected(receiver, KindCloseBracketToken);
        return loop(Parser_finishNode(receiver, NewArrayTypeNode(receiver!.factory, typeNode), pos));
      }
      default:
        return typeNode;
    }
  };
  return loop(Parser_parseNonArrayType(receiver));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextIsStartOfType","kind":"method","status":"implemented","sigHash":"a52bc39135e2bfcef4f5e9ca73e9de40c4ca0641f5f5d8ac32d0bf381ac09bf3","bodyHash":"e12dd9afc6c5abb195ca8c378a5f2193f3080344bcec8b2b28038881ceaa5b59"}
 *
 * Go source:
 * func (p *Parser) nextIsStartOfType() bool {
 * 	p.nextToken()
 * 	return p.isStartOfType(false /*inStartOfParameter* /)
 * }
 */
export function Parser_nextIsStartOfType(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  return Parser_isStartOfType(receiver, false /*inStartOfParameter*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseNonArrayType","kind":"method","status":"implemented","sigHash":"a2982b76091086dff39bbfbb6e906f9503e7a19fa306ae2d7aae28c762cc55ab","bodyHash":"dba6195e30ff8e392cd8a8dfbd89efe5b2d8715fc0cff597927182a5b7a5a552"}
 *
 * Go source:
 * func (p *Parser) parseNonArrayType() *ast.Node {
 * 	switch p.token {
 * 	case ast.KindAnyKeyword, ast.KindUnknownKeyword, ast.KindStringKeyword, ast.KindNumberKeyword, ast.KindBigIntKeyword,
 * 		ast.KindSymbolKeyword, ast.KindBooleanKeyword, ast.KindUndefinedKeyword, ast.KindNeverKeyword, ast.KindObjectKeyword:
 * 		state := p.mark()
 * 		keywordTypeNode := p.parseKeywordTypeNode()
 * 		// If these are followed by a dot then parse these out as a dotted type reference instead
 * 		if p.token != ast.KindDotToken {
 * 			return keywordTypeNode
 * 		}
 * 		p.rewind(state)
 * 		return p.parseTypeReference()
 * 	case ast.KindAsteriskEqualsToken:
 * 		// If there is '*=', treat it as * followed by postfix =
 * 		p.scanner.ReScanAsteriskEqualsToken()
 * 		fallthrough
 * 	case ast.KindAsteriskToken:
 * 		return p.parseJSDocAllType()
 * 	case ast.KindQuestionQuestionToken:
 * 		// If there is '??', treat it as prefix-'?' in JSDoc type.
 * 		p.scanner.ReScanQuestionToken()
 * 		fallthrough
 * 	case ast.KindQuestionToken:
 * 		return p.parseJSDocNullableType()
 * 	case ast.KindExclamationToken:
 * 		return p.parseJSDocNonNullableType()
 * 	case ast.KindNoSubstitutionTemplateLiteral, ast.KindStringLiteral, ast.KindNumericLiteral, ast.KindBigIntLiteral, ast.KindTrueKeyword,
 * 		ast.KindFalseKeyword, ast.KindNullKeyword:
 * 		return p.parseLiteralTypeNode(false /*negative* /)
 * 	case ast.KindMinusToken:
 * 		if p.lookAhead((*Parser).nextTokenIsNumericOrBigIntLiteral) {
 * 			return p.parseLiteralTypeNode(true /*negative* /)
 * 		}
 * 		return p.parseTypeReference()
 * 	case ast.KindVoidKeyword:
 * 		return p.parseKeywordTypeNode()
 * 	case ast.KindThisKeyword:
 * 		thisKeyword := p.parseThisTypeNode()
 * 		if p.token == ast.KindIsKeyword && !p.hasPrecedingLineBreak() {
 * 			return p.parseThisTypePredicate(thisKeyword)
 * 		}
 * 		return thisKeyword
 * 	case ast.KindTypeOfKeyword:
 * 		if p.lookAhead((*Parser).nextIsStartOfTypeOfImportType) {
 * 			return p.parseImportType()
 * 		}
 * 		return p.parseTypeQuery()
 * 	case ast.KindOpenBraceToken:
 * 		if p.lookAhead((*Parser).nextIsStartOfMappedType) {
 * 			return p.parseMappedType()
 * 		}
 * 		return p.parseTypeLiteral()
 * 	case ast.KindOpenBracketToken:
 * 		return p.parseTupleType()
 * 	case ast.KindOpenParenToken:
 * 		return p.parseParenthesizedType()
 * 	case ast.KindImportKeyword:
 * 		return p.parseImportType()
 * 	case ast.KindAssertsKeyword:
 * 		if p.lookAhead((*Parser).nextTokenIsIdentifierOrKeywordOnSameLine) {
 * 			return p.parseAssertsTypePredicate()
 * 		}
 * 		return p.parseTypeReference()
 * 	case ast.KindTemplateHead:
 * 		return p.parseTemplateType()
 * 	default:
 * 		return p.parseTypeReference()
 * 	}
 * }
 */
export function Parser_parseNonArrayType(receiver: GoPtr<Parser>): GoPtr<Node> {
  switch (receiver!.token) {
    case KindAnyKeyword:
    case KindUnknownKeyword:
    case KindStringKeyword:
    case KindNumberKeyword:
    case KindBigIntKeyword:
    case KindSymbolKeyword:
    case KindBooleanKeyword:
    case KindUndefinedKeyword:
    case KindNeverKeyword:
    case KindObjectKeyword: {
      const state = Parser_mark(receiver);
      const keywordTypeNode = Parser_parseKeywordTypeNode(receiver);
      // If these are followed by a dot then parse these out as a dotted type reference instead
      if (receiver!.token !== KindDotToken) {
        return keywordTypeNode;
      }
      Parser_rewind(receiver, state);
      return Parser_parseTypeReference(receiver);
    }
    case KindAsteriskEqualsToken:
      // If there is '*=', treat it as * followed by postfix =
      Scanner_ReScanAsteriskEqualsToken(receiver!.scanner);
      // fallthrough
      return Parser_parseJSDocAllType(receiver);
    case KindAsteriskToken:
      return Parser_parseJSDocAllType(receiver);
    case KindQuestionQuestionToken:
      // If there is '??', treat it as prefix-'?' in JSDoc type.
      Scanner_ReScanQuestionToken(receiver!.scanner);
      // fallthrough
      return Parser_parseJSDocNullableType(receiver);
    case KindQuestionToken:
      return Parser_parseJSDocNullableType(receiver);
    case KindExclamationToken:
      return Parser_parseJSDocNonNullableType(receiver);
    case KindNoSubstitutionTemplateLiteral:
    case KindStringLiteral:
    case KindNumericLiteral:
    case KindBigIntLiteral:
    case KindTrueKeyword:
    case KindFalseKeyword:
    case KindNullKeyword:
      return Parser_parseLiteralTypeNode(receiver, false /*negative*/);
    case KindMinusToken:
      if (Parser_lookAhead(receiver, Parser_nextTokenIsNumericOrBigIntLiteral)) {
        return Parser_parseLiteralTypeNode(receiver, true /*negative*/);
      }
      return Parser_parseTypeReference(receiver);
    case KindVoidKeyword:
      return Parser_parseKeywordTypeNode(receiver);
    case KindThisKeyword: {
      const thisKeyword = Parser_parseThisTypeNode(receiver);
      if (receiver!.token === KindIsKeyword && !Parser_hasPrecedingLineBreak(receiver)) {
        return Parser_parseThisTypePredicate(receiver, thisKeyword);
      }
      return thisKeyword;
    }
    case KindTypeOfKeyword:
      if (Parser_lookAhead(receiver, Parser_nextIsStartOfTypeOfImportType)) {
        return Parser_parseImportType(receiver);
      }
      return Parser_parseTypeQuery(receiver);
    case KindOpenBraceToken:
      if (Parser_lookAhead(receiver, Parser_nextIsStartOfMappedType)) {
        return Parser_parseMappedType(receiver);
      }
      return Parser_parseTypeLiteral(receiver);
    case KindOpenBracketToken:
      return Parser_parseTupleType(receiver);
    case KindOpenParenToken:
      return Parser_parseParenthesizedType(receiver);
    case KindImportKeyword:
      return Parser_parseImportType(receiver);
    case KindAssertsKeyword:
      if (Parser_lookAhead(receiver, Parser_nextTokenIsIdentifierOrKeywordOnSameLine)) {
        return Parser_parseAssertsTypePredicate(receiver);
      }
      return Parser_parseTypeReference(receiver);
    case KindTemplateHead:
      return Parser_parseTemplateType(receiver);
    default:
      return Parser_parseTypeReference(receiver);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseKeywordTypeNode","kind":"method","status":"implemented","sigHash":"9d5c32602fabc633eca230dcb04f9d4136bc8cb73270b9f6376a57893846b553","bodyHash":"40f5e9888d61be75c0f2cd6588e394985c9aa16e5b0e2d7c769e0a29f57dd891"}
 *
 * Go source:
 * func (p *Parser) parseKeywordTypeNode() *ast.Node {
 * 	pos := p.nodePos()
 * 	result := p.factory.NewKeywordTypeNode(p.token)
 * 	p.nextToken()
 * 	return p.finishNode(result, pos)
 * }
 */
export function Parser_parseKeywordTypeNode(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const result = NewKeywordTypeNode(receiver!.factory, receiver!.token);
  Parser_nextToken(receiver);
  return Parser_finishNode(receiver, result, pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseThisTypeNode","kind":"method","status":"implemented","sigHash":"d76ce3d5803fa56931a9327593d2d4cdb5aa2bc8b1135cc4960fa5b6f5842f13","bodyHash":"e1f609ae6407531853dafc28d0df070516ad2638f1f13eb75c9f891f8f250af3"}
 *
 * Go source:
 * func (p *Parser) parseThisTypeNode() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.nextToken()
 * 	return p.finishNode(p.factory.NewThisTypeNode(), pos)
 * }
 */
export function Parser_parseThisTypeNode(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_nextToken(receiver);
  return Parser_finishNode(receiver, NewThisTypeNode(receiver!.factory), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseThisTypePredicate","kind":"method","status":"implemented","sigHash":"b69dad875d81e5a1411362969995722bdb3b2a0e8d23496fa85b186d219e6d78","bodyHash":"e83873b251b65c4f7ce6efa89917f6ed80013dff070ddcbd3f27e742b74ffd1e"}
 *
 * Go source:
 * func (p *Parser) parseThisTypePredicate(lhs *ast.Node) *ast.Node {
 * 	p.nextToken()
 * 	return p.finishNode(p.factory.NewTypePredicateNode(nil /*assertsModifier* /, lhs, p.parseType()), lhs.Pos())
 * }
 */
export function Parser_parseThisTypePredicate(receiver: GoPtr<Parser>, lhs: GoPtr<Node>): GoPtr<Node> {
  Parser_nextToken(receiver);
  return Parser_finishNode(receiver, NewTypePredicateNode(receiver!.factory, undefined /*assertsModifier*/, lhs, Parser_parseType(receiver)), Node_Pos(lhs));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseLiteralTypeNode","kind":"method","status":"implemented","sigHash":"11b565d0ca1aa305d7253e04073b1132c8280f9ba882f02532be1d46ba5fe315","bodyHash":"696b99eca6cf6df16e03fa9b82fc74a652591190c0dbfb258f4cb43fce8e757f"}
 *
 * Go source:
 * func (p *Parser) parseLiteralTypeNode(negative bool) *ast.Node {
 * 	pos := p.nodePos()
 * 	if negative {
 * 		p.nextToken()
 * 	}
 * 	var expression *ast.Expression
 * 	if p.token == ast.KindTrueKeyword || p.token == ast.KindFalseKeyword || p.token == ast.KindNullKeyword {
 * 		expression = p.parseKeywordExpression()
 * 	} else {
 * 		expression = p.parseLiteralExpression(false /*intern* /)
 * 	}
 * 	if negative {
 * 		expression = p.finishNode(p.factory.NewPrefixUnaryExpression(ast.KindMinusToken, expression), pos)
 * 	}
 * 	return p.finishNode(p.factory.NewLiteralTypeNode(expression), pos)
 * }
 */
export function Parser_parseLiteralTypeNode(receiver: GoPtr<Parser>, negative: bool): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  if (negative) {
    Parser_nextToken(receiver);
  }
  const baseExpression = (receiver!.token === KindTrueKeyword || receiver!.token === KindFalseKeyword || receiver!.token === KindNullKeyword)
    ? Parser_parseKeywordExpression(receiver)
    : Parser_parseLiteralExpression(receiver, false /*intern*/);
  const expression = negative
    ? Parser_finishNode(receiver, NewPrefixUnaryExpression(receiver!.factory, KindMinusToken, baseExpression), pos)
    : baseExpression;
  return Parser_finishNode(receiver, NewLiteralTypeNode(receiver!.factory, expression), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeReference","kind":"method","status":"implemented","sigHash":"789acda469c23c6e4b3f002539a4e4759747e69c4342f55384a6fd61ee6f042b","bodyHash":"ac10a8229d58b78832d5ca3f10f1b8db5965d385695c9ab1d01118675bfc6bdc"}
 *
 * Go source:
 * func (p *Parser) parseTypeReference() *ast.Node {
 * 	pos := p.nodePos()
 * 	return p.finishNode(p.factory.NewTypeReferenceNode(p.parseEntityNameOfTypeReference(), p.parseTypeArgumentsOfTypeReference()), pos)
 * }
 */
export function Parser_parseTypeReference(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  return Parser_finishNode(receiver, NewTypeReferenceNode(receiver!.factory, Parser_parseEntityNameOfTypeReference(receiver), Parser_parseTypeArgumentsOfTypeReference(receiver)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseEntityNameOfTypeReference","kind":"method","status":"implemented","sigHash":"f440a0d94c0a764a14579fc2bf4d6b0382cc8cce9087bc480deb03a4e28a0950","bodyHash":"7f158bf2c697d27f52ca18698c531d79b669edce154be664689d278b3a50d1d6"}
 *
 * Go source:
 * func (p *Parser) parseEntityNameOfTypeReference() *ast.Node {
 * 	return p.parseEntityName(true /*allowReservedWords* /, diagnostics.Type_expected)
 * }
 */
export function Parser_parseEntityNameOfTypeReference(receiver: GoPtr<Parser>): GoPtr<Node> {
  return Parser_parseEntityName(receiver, true /*allowReservedWords*/, Type_expected);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeArgumentsOfTypeReference","kind":"method","status":"implemented","sigHash":"c0c5de2ab3f65e6814d30d9b31bd44d29617c4ad568e01b27bf0a6009fe6f0c2","bodyHash":"bd85ff7d0d3e38d01eaacc577292112a63f16496a3f609379b9593e68ad74f8d"}
 *
 * Go source:
 * func (p *Parser) parseTypeArgumentsOfTypeReference() *ast.NodeList {
 * 	if !p.hasPrecedingLineBreak() && p.reScanLessThanToken() == ast.KindLessThanToken {
 * 		return p.parseTypeArguments()
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseTypeArgumentsOfTypeReference(receiver: GoPtr<Parser>): GoPtr<NodeList> {
  if (!Parser_hasPrecedingLineBreak(receiver) && Parser_reScanLessThanToken(receiver) === KindLessThanToken) {
    return Parser_parseTypeArguments(receiver);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeArguments","kind":"method","status":"implemented","sigHash":"abf61d1cbb0366fb2e8990af136461925e0f5528108776c7000678f4db7250dd","bodyHash":"bfe85034641f49110c268fbe1b066b85603e723417c9e31b0e7576aacd69cd75"}
 *
 * Go source:
 * func (p *Parser) parseTypeArguments() *ast.NodeList {
 * 	if p.token == ast.KindLessThanToken {
 * 		return p.parseBracketedList(PCTypeArguments, (*Parser).parseType, ast.KindLessThanToken, ast.KindGreaterThanToken)
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseTypeArguments(receiver: GoPtr<Parser>): GoPtr<NodeList> {
  if (receiver!.token === KindLessThanToken) {
    return Parser_parseBracketedList(receiver, PCTypeArguments, Parser_parseType, KindLessThanToken, KindGreaterThanToken);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextIsStartOfTypeOfImportType","kind":"method","status":"implemented","sigHash":"4135015cd5afb83ecb39be211aa0f8e8ea2c2bc7fb6037f0f554e5764af3da14","bodyHash":"cc699c2b5deb1a6e4d3cf31e6140647bb4e58112fd435ea65dcf1306107f9da7"}
 *
 * Go source:
 * func (p *Parser) nextIsStartOfTypeOfImportType() bool {
 * 	p.nextToken()
 * 	return p.token == ast.KindImportKeyword
 * }
 */
export function Parser_nextIsStartOfTypeOfImportType(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  return receiver!.token === KindImportKeyword;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseImportType","kind":"method","status":"implemented","sigHash":"060cd712d896172049f57be48497ee621aff213e1ec71d763d20a7b8aa4f957b","bodyHash":"ce7fedc3cc43dc159706348122e1333269b37eb65174947a779b321ca6ff6b2f"}
 *
 * Go source:
 * func (p *Parser) parseImportType() *ast.Node {
 * 	p.sourceFlags |= ast.NodeFlagsPossiblyContainsDynamicImport
 * 	pos := p.nodePos()
 * 	isTypeOf := p.parseOptional(ast.KindTypeOfKeyword)
 * 	p.parseExpected(ast.KindImportKeyword)
 * 	p.parseExpected(ast.KindOpenParenToken)
 * 	typeNode := p.parseType()
 * 	var attributes *ast.Node
 * 	if p.parseOptional(ast.KindCommaToken) {
 * 		openBracePosition := p.scanner.TokenStart()
 * 		p.parseExpected(ast.KindOpenBraceToken)
 * 		currentToken := p.token
 * 		if currentToken == ast.KindWithKeyword || currentToken == ast.KindAssertKeyword {
 * 			if currentToken == ast.KindAssertKeyword {
 * 				p.parseErrorAtCurrentToken(diagnostics.Import_assertions_have_been_replaced_by_import_attributes_Use_with_instead_of_assert)
 * 			}
 * 			p.nextToken()
 * 		} else {
 * 			p.parseErrorAtCurrentToken(diagnostics.X_0_expected, scanner.TokenToString(ast.KindWithKeyword))
 * 		}
 * 		p.parseExpected(ast.KindColonToken)
 * 		attributes = p.parseImportAttributes(currentToken, true /*skipKeyword* /)
 * 		p.parseOptional(ast.KindCommaToken)
 * 		if !p.parseExpected(ast.KindCloseBraceToken) {
 * 			if len(p.diagnostics) != 0 {
 * 				lastDiagnostic := p.diagnostics[len(p.diagnostics)-1]
 * 				if lastDiagnostic.Code() == diagnostics.X_0_expected.Code() {
 * 					related := ast.NewDiagnostic(nil, core.NewTextRange(openBracePosition, openBracePosition), diagnostics.The_parser_expected_to_find_a_1_to_match_the_0_token_here, "{", "}")
 * 					lastDiagnostic.AddRelatedInfo(related)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	p.parseExpected(ast.KindCloseParenToken)
 * 	var qualifier *ast.Node
 * 	if p.parseOptional(ast.KindDotToken) {
 * 		qualifier = p.parseEntityNameOfTypeReference()
 * 	}
 * 	typeArguments := p.parseTypeArgumentsOfTypeReference()
 * 	return p.finishNode(p.factory.NewImportTypeNode(isTypeOf, typeNode, attributes, qualifier, typeArguments), pos)
 * }
 */
export function Parser_parseImportType(receiver: GoPtr<Parser>): GoPtr<Node> {
  receiver!.sourceFlags |= NodeFlagsPossiblyContainsDynamicImport;
  const pos = Parser_nodePos(receiver);
  const isTypeOf = Parser_parseOptional(receiver, KindTypeOfKeyword);
  Parser_parseExpected(receiver, KindImportKeyword);
  Parser_parseExpected(receiver, KindOpenParenToken);
  const typeNode = Parser_parseType(receiver);
  let attributes: GoPtr<Node> = undefined;
  if (Parser_parseOptional(receiver, KindCommaToken)) {
    const openBracePosition = Scanner_TokenStart(receiver!.scanner);
    Parser_parseExpected(receiver, KindOpenBraceToken);
    const currentToken = receiver!.token;
    if (currentToken === KindWithKeyword || currentToken === KindAssertKeyword) {
      if (currentToken === KindAssertKeyword) {
        Parser_parseErrorAtCurrentToken(receiver, Import_assertions_have_been_replaced_by_import_attributes_Use_with_instead_of_assert);
      }
      Parser_nextToken(receiver);
    } else {
      Parser_parseErrorAtCurrentToken(receiver, X_0_expected, TokenToString(KindWithKeyword));
    }
    Parser_parseExpected(receiver, KindColonToken);
    attributes = Parser_parseImportAttributes(receiver, currentToken, true /*skipKeyword*/);
    Parser_parseOptional(receiver, KindCommaToken);
    if (!Parser_parseExpected(receiver, KindCloseBraceToken)) {
      if (receiver!.diagnostics.length !== 0) {
        const lastDiagnostic = receiver!.diagnostics[receiver!.diagnostics.length - 1];
        if (Diagnostic_Code(lastDiagnostic) === X_0_expected.code) {
          const related = NewDiagnostic(undefined, NewTextRange(openBracePosition, openBracePosition), The_parser_expected_to_find_a_1_to_match_the_0_token_here, "{", "}");
          Diagnostic_AddRelatedInfo(lastDiagnostic, related);
        }
      }
    }
  }
  Parser_parseExpected(receiver, KindCloseParenToken);
  let qualifier: GoPtr<Node> = undefined;
  if (Parser_parseOptional(receiver, KindDotToken)) {
    qualifier = Parser_parseEntityNameOfTypeReference(receiver);
  }
  const typeArguments = Parser_parseTypeArgumentsOfTypeReference(receiver);
  return Parser_finishNode(receiver, NewImportTypeNode(receiver!.factory, isTypeOf, typeNode, attributes, qualifier, typeArguments), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeQuery","kind":"method","status":"implemented","sigHash":"f5e12a36c1d7cd961e33dfddc62356b39eeb0bb62a34bebccdbf92aa484f0c47","bodyHash":"b7caeb496af5828837471b642efbd6921b55127994d0e8a270029ec6fd5f1afe"}
 *
 * Go source:
 * func (p *Parser) parseTypeQuery() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindTypeOfKeyword)
 * 	entityName := p.parseEntityName(true /*allowReservedWords* /, nil)
 * 	// Make sure we perform ASI to prevent parsing the next line's type arguments as part of an instantiation expression
 * 	var typeArguments *ast.NodeList
 * 	if !p.hasPrecedingLineBreak() {
 * 		typeArguments = p.parseTypeArguments()
 * 	}
 * 	return p.finishNode(p.factory.NewTypeQueryNode(entityName, typeArguments), pos)
 * }
 */
export function Parser_parseTypeQuery(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindTypeOfKeyword);
  const entityName = Parser_parseEntityName(receiver, true /*allowReservedWords*/, undefined);
  // Make sure we perform ASI to prevent parsing the next line's type arguments as part of an instantiation expression
  const typeArguments = !Parser_hasPrecedingLineBreak(receiver) ? Parser_parseTypeArguments(receiver) : undefined;
  return Parser_finishNode(receiver, NewTypeQueryNode(receiver!.factory, entityName, typeArguments), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextIsStartOfMappedType","kind":"method","status":"implemented","sigHash":"1e84c99ced97bceece77c2cdd2544134f88bd53408949854411c53c8fc74cac6","bodyHash":"ce422cd673fd913fa119fe0ae02f148ad13abaf286c939b96118c991de51041a"}
 *
 * Go source:
 * func (p *Parser) nextIsStartOfMappedType() bool {
 * 	p.nextToken()
 * 	if p.token == ast.KindPlusToken || p.token == ast.KindMinusToken {
 * 		return p.nextToken() == ast.KindReadonlyKeyword
 * 	}
 * 	if p.token == ast.KindReadonlyKeyword {
 * 		p.nextToken()
 * 	}
 * 	return p.token == ast.KindOpenBracketToken && p.nextTokenIsIdentifier() && p.nextToken() == ast.KindInKeyword
 * }
 */
export function Parser_nextIsStartOfMappedType(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  if (receiver!.token === KindPlusToken || receiver!.token === KindMinusToken) {
    return Parser_nextToken(receiver) === KindReadonlyKeyword;
  }
  if (receiver!.token === KindReadonlyKeyword) {
    Parser_nextToken(receiver);
  }
  return receiver!.token === KindOpenBracketToken && Parser_nextTokenIsIdentifier(receiver) && Parser_nextToken(receiver) === KindInKeyword;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseMappedType","kind":"method","status":"implemented","sigHash":"84aec40c47662e5f7644e30573521e5b4493f11250fee618a4f95f359f07f018","bodyHash":"5496eb7357f22a0eb983a77d6d9484e25e894d4d56292aab4a295b06bdf3afc2"}
 *
 * Go source:
 * func (p *Parser) parseMappedType() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindOpenBraceToken)
 * 	var readonlyToken *ast.Node // ReadonlyKeyword | PlusToken | MinusToken
 * 	if p.token == ast.KindReadonlyKeyword || p.token == ast.KindPlusToken || p.token == ast.KindMinusToken {
 * 		readonlyToken = p.parseTokenNode()
 * 		if readonlyToken.Kind != ast.KindReadonlyKeyword {
 * 			p.parseExpected(ast.KindReadonlyKeyword)
 * 		}
 * 	}
 * 	p.parseExpected(ast.KindOpenBracketToken)
 * 	typeParameter := p.parseMappedTypeParameter()
 * 	var nameType *ast.TypeNode
 * 	if p.parseOptional(ast.KindAsKeyword) {
 * 		nameType = p.parseType()
 * 	}
 * 	p.parseExpected(ast.KindCloseBracketToken)
 * 	var questionToken *ast.Node // QuestionToken | PlusToken | MinusToken
 * 	if p.token == ast.KindQuestionToken || p.token == ast.KindPlusToken || p.token == ast.KindMinusToken {
 * 		questionToken = p.parseTokenNode()
 * 		if questionToken.Kind != ast.KindQuestionToken {
 * 			p.parseExpected(ast.KindQuestionToken)
 * 		}
 * 	}
 * 	typeNode := p.parseTypeAnnotation()
 * 	p.parseSemicolon()
 * 	members := p.parseList(PCTypeMembers, (*Parser).parseTypeMember)
 * 	p.parseExpected(ast.KindCloseBraceToken)
 * 	return p.finishNode(p.factory.NewMappedTypeNode(readonlyToken, typeParameter, nameType, questionToken, typeNode, members), pos)
 * }
 */
export function Parser_parseMappedType(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindOpenBraceToken);
  // ReadonlyKeyword | PlusToken | MinusToken
  const readonlyToken = (receiver!.token === KindReadonlyKeyword || receiver!.token === KindPlusToken || receiver!.token === KindMinusToken)
    ? ((): GoPtr<Node> => {
        const tok = Parser_parseTokenNode(receiver);
        if (tok!.Kind !== KindReadonlyKeyword) {
          Parser_parseExpected(receiver, KindReadonlyKeyword);
        }
        return tok;
      })()
    : undefined;
  Parser_parseExpected(receiver, KindOpenBracketToken);
  const typeParameter = Parser_parseMappedTypeParameter(receiver);
  const nameType = Parser_parseOptional(receiver, KindAsKeyword) ? Parser_parseType(receiver) : undefined;
  Parser_parseExpected(receiver, KindCloseBracketToken);
  // QuestionToken | PlusToken | MinusToken
  const questionToken = (receiver!.token === KindQuestionToken || receiver!.token === KindPlusToken || receiver!.token === KindMinusToken)
    ? ((): GoPtr<Node> => {
        const tok = Parser_parseTokenNode(receiver);
        if (tok!.Kind !== KindQuestionToken) {
          Parser_parseExpected(receiver, KindQuestionToken);
        }
        return tok;
      })()
    : undefined;
  const typeNode = Parser_parseTypeAnnotation(receiver);
  Parser_parseSemicolon(receiver);
  const members = Parser_parseList(receiver, PCTypeMembers, Parser_parseTypeMember);
  Parser_parseExpected(receiver, KindCloseBraceToken);
  return Parser_finishNode(receiver, NewMappedTypeNode(receiver!.factory, readonlyToken, typeParameter, nameType, questionToken, typeNode, members), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseMappedTypeParameter","kind":"method","status":"implemented","sigHash":"d79fe72af52c5aa65f827e7d69a0323f61ac3ba44fff4558d5c7854dbef508b7","bodyHash":"5d531e4a973964eef3d2bbfc25da18b9d9bd2ab7199be802bd30c88b1938486f"}
 *
 * Go source:
 * func (p *Parser) parseMappedTypeParameter() *ast.Node {
 * 	pos := p.nodePos()
 * 	name := p.parseIdentifierName()
 * 	p.parseExpected(ast.KindInKeyword)
 * 	typeNode := p.parseType()
 * 	return p.finishNode(p.factory.NewTypeParameterDeclaration(nil /*modifiers* /, name, typeNode, nil /*expression* /, nil /*defaultType* /), pos)
 * }
 */
export function Parser_parseMappedTypeParameter(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const name = Parser_parseIdentifierName(receiver);
  Parser_parseExpected(receiver, KindInKeyword);
  const typeNode = Parser_parseType(receiver);
  return Parser_finishNode(receiver, NewTypeParameterDeclaration(receiver!.factory, undefined /*modifiers*/, name, typeNode, undefined /*expression*/, undefined /*defaultType*/), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeMember","kind":"method","status":"implemented","sigHash":"ce30080f31172901a347411ac9f22979b928ef3a6b8582262ff90d70e8fb5ce6","bodyHash":"7637c61fff88178870aaf4c9daa4ec33caef508ec26bcb8193b18d74487e375f"}
 *
 * Go source:
 * func (p *Parser) parseTypeMember() *ast.Node {
 * 	if p.token == ast.KindOpenParenToken || p.token == ast.KindLessThanToken {
 * 		return p.parseSignatureMember(ast.KindCallSignature)
 * 	}
 * 	if p.token == ast.KindNewKeyword && p.lookAhead((*Parser).nextTokenIsOpenParenOrLessThan) {
 * 		return p.parseSignatureMember(ast.KindConstructSignature)
 * 	}
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	modifiers := p.parseModifiers()
 * 	if p.parseContextualModifier(ast.KindGetKeyword) {
 * 		return p.parseAccessorDeclaration(pos, jsdoc, modifiers, ast.KindGetAccessor, ParseFlagsType)
 * 	}
 * 	if p.parseContextualModifier(ast.KindSetKeyword) {
 * 		return p.parseAccessorDeclaration(pos, jsdoc, modifiers, ast.KindSetAccessor, ParseFlagsType)
 * 	}
 * 	if p.isIndexSignature() {
 * 		return p.parseIndexSignatureDeclaration(pos, jsdoc, modifiers)
 * 	}
 * 	return p.parsePropertyOrMethodSignature(pos, jsdoc, modifiers)
 * }
 */
export function Parser_parseTypeMember(receiver: GoPtr<Parser>): GoPtr<Node> {
  if (receiver!.token === KindOpenParenToken || receiver!.token === KindLessThanToken) {
    return Parser_parseSignatureMember(receiver, KindCallSignature);
  }
  if (receiver!.token === KindNewKeyword && Parser_lookAhead(receiver, Parser_nextTokenIsOpenParenOrLessThan)) {
    return Parser_parseSignatureMember(receiver, KindConstructSignature);
  }
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  const modifiers = Parser_parseModifiers(receiver);
  if (Parser_parseContextualModifier(receiver, KindGetKeyword)) {
    return Parser_parseAccessorDeclaration(receiver, pos, jsdoc, modifiers, KindGetAccessor, ParseFlagsType);
  }
  if (Parser_parseContextualModifier(receiver, KindSetKeyword)) {
    return Parser_parseAccessorDeclaration(receiver, pos, jsdoc, modifiers, KindSetAccessor, ParseFlagsType);
  }
  if (Parser_isIndexSignature(receiver)) {
    return Parser_parseIndexSignatureDeclaration(receiver, pos, jsdoc, modifiers);
  }
  return Parser_parsePropertyOrMethodSignature(receiver, pos, jsdoc, modifiers);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeParameters","kind":"method","status":"implemented","sigHash":"6d79a138441d501be0fec8807d2ed88a48c589f9922e716d217c65fc33818426","bodyHash":"0ec2acd766f4b02d9d6a6a4a7e1c13b0e6081c209d81dbe02a5e709d99ce8330"}
 *
 * Go source:
 * func (p *Parser) parseTypeParameters() *ast.NodeList {
 * 	if p.token == ast.KindLessThanToken {
 * 		return p.parseBracketedList(PCTypeParameters, (*Parser).parseTypeParameter, ast.KindLessThanToken, ast.KindGreaterThanToken)
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseTypeParameters(receiver: GoPtr<Parser>): GoPtr<NodeList> {
  if (receiver!.token === KindLessThanToken) {
    return Parser_parseBracketedList(receiver, PCTypeParameters, Parser_parseTypeParameter, KindLessThanToken, KindGreaterThanToken);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeParameter","kind":"method","status":"implemented","sigHash":"5a5e10f416423b7f4e799aaf7d5c329c82467298115d69fdf838c17d04b0ee53","bodyHash":"92abc90c0b476db7a11459b3127910056ad63c482171796c8672a9db9f21d5f2"}
 *
 * Go source:
 * func (p *Parser) parseTypeParameter() *ast.Node {
 * 	pos := p.nodePos()
 * 	modifiers := p.parseModifiersEx(false /*allowDecorators* /, true /*permitConstAsModifier* /, false /*stopOnStartOfClassStaticBlock* /)
 * 	name := p.parseIdentifier()
 * 	var constraint *ast.TypeNode
 * 	var expression *ast.Expression
 * 	if p.parseOptional(ast.KindExtendsKeyword) {
 * 		// It's not uncommon for people to write improper constraints to a generic.  If the
 * 		// user writes a constraint that is an expression and not an actual type, then parse
 * 		// it out as an expression (so we can recover well), but report that a type is needed
 * 		// instead.
 * 		if p.isStartOfType(false /*inStartOfParameter* /) || !p.isStartOfExpression() {
 * 			constraint = p.parseType()
 * 		} else {
 * 			// It was not a type, and it looked like an expression.  Parse out an expression
 * 			// here so we recover well.  Note: it is important that we call parseUnaryExpression
 * 			// and not parseExpression here.  If the user has:
 * 			//
 * 			//      <T extends "">
 * 			//
 * 			// We do *not* want to consume the `>` as we're consuming the expression for "".
 * 			expression = p.parseUnaryExpressionOrHigher()
 * 		}
 * 	}
 * 	var defaultType *ast.TypeNode
 * 	if p.parseOptional(ast.KindEqualsToken) {
 * 		defaultType = p.parseType()
 * 	}
 * 	result := p.factory.NewTypeParameterDeclaration(modifiers, name, constraint, expression, defaultType)
 * 	return p.finishNode(result, pos)
 * }
 */
export function Parser_parseTypeParameter(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const modifiers = Parser_parseModifiersEx(receiver, false /*allowDecorators*/, true /*permitConstAsModifier*/, false /*stopOnStartOfClassStaticBlock*/);
  const name = Parser_parseIdentifier(receiver);
  // It's not uncommon for people to write improper constraints to a generic.  If the
  // user writes a constraint that is an expression and not an actual type, then parse
  // it out as an expression (so we can recover well), but report that a type is needed
  // instead.
  const constraintAndExpression: readonly [GoPtr<TypeNode>, GoPtr<Node>] = Parser_parseOptional(receiver, KindExtendsKeyword)
    ? (Parser_isStartOfType(receiver, false /*inStartOfParameter*/) || !Parser_isStartOfExpression(receiver)
        ? [Parser_parseType(receiver), undefined]
        // It was not a type, and it looked like an expression.  Parse out an expression
        // here so we recover well.  Note: it is important that we call parseUnaryExpression
        // and not parseExpression here.  If the user has:
        //
        //      <T extends "">
        //
        // We do *not* want to consume the `>` as we're consuming the expression for "".
        : [undefined, Parser_parseUnaryExpressionOrHigher(receiver)])
    : [undefined, undefined];
  const constraint = constraintAndExpression[0];
  const expression = constraintAndExpression[1];
  const defaultType = Parser_parseOptional(receiver, KindEqualsToken) ? Parser_parseType(receiver) : undefined;
  const result = NewTypeParameterDeclaration(receiver!.factory, modifiers, name, constraint, expression, defaultType);
  return Parser_finishNode(receiver, result, pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseReturnType","kind":"method","status":"implemented","sigHash":"95e5a21298b8c520ff636bcc91bc083f41d05c4d4b7de58851d58398bec98c7b","bodyHash":"70fc14727a011d346c336946f20e0bd590a018b90de6841d46866ccebc2425d8"}
 *
 * Go source:
 * func (p *Parser) parseReturnType(returnToken ast.Kind, isType bool) *ast.TypeNode {
 * 	if p.shouldParseReturnType(returnToken, isType) {
 * 		return doInContext(p, ast.NodeFlagsDisallowConditionalTypesContext, false, (*Parser).parseTypeOrTypePredicate)
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseReturnType(receiver: GoPtr<Parser>, returnToken: Kind, isType: bool): GoPtr<TypeNode> {
  if (Parser_shouldParseReturnType(receiver, returnToken, isType)) {
    return doInContext(receiver, NodeFlagsDisallowConditionalTypesContext, false, Parser_parseTypeOrTypePredicate);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.shouldParseReturnType","kind":"method","status":"implemented","sigHash":"d7dd74dd468df7b98466b692547093c7cade89b7610f033fc0155d6e61629f79","bodyHash":"481c1070023a99e73e6ff4f32d41a75595290a555bcdba7034a373df15e5ca56"}
 *
 * Go source:
 * func (p *Parser) shouldParseReturnType(returnToken ast.Kind, isType bool) bool {
 * 	if returnToken == ast.KindEqualsGreaterThanToken {
 * 		p.parseExpected(returnToken)
 * 		return true
 * 	} else if p.parseOptional(ast.KindColonToken) {
 * 		return true
 * 	} else if isType && p.token == ast.KindEqualsGreaterThanToken {
 * 		// This is easy to get backward, especially in type contexts, so parse the type anyway
 * 		p.parseErrorAtCurrentToken(diagnostics.X_0_expected, scanner.TokenToString(ast.KindColonToken))
 * 		p.nextToken()
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Parser_shouldParseReturnType(receiver: GoPtr<Parser>, returnToken: Kind, isType: bool): bool {
  if (returnToken === KindEqualsGreaterThanToken) {
    Parser_parseExpected(receiver, returnToken);
    return true;
  } else if (Parser_parseOptional(receiver, KindColonToken)) {
    return true;
  } else if (isType && receiver!.token === KindEqualsGreaterThanToken) {
    // This is easy to get backward, especially in type contexts, so parse the type anyway
    Parser_parseErrorAtCurrentToken(receiver, X_0_expected, TokenToString(KindColonToken));
    Parser_nextToken(receiver);
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeOrTypePredicate","kind":"method","status":"implemented","sigHash":"148ca9e1eb1221465b8cf5807aa51b1cba627515e07ea4911a49ab287e1dcee3","bodyHash":"b3bad09c0953f37afe0f76149390c5a2f0b864a9df83eb16cee3f37a32937c0e"}
 *
 * Go source:
 * func (p *Parser) parseTypeOrTypePredicate() *ast.TypeNode {
 * 	if p.isIdentifier() {
 * 		state := p.mark()
 * 		pos := p.nodePos()
 * 		id := p.parseIdentifier()
 * 		if p.token == ast.KindIsKeyword && !p.hasPrecedingLineBreak() {
 * 			p.nextToken()
 * 			return p.finishNode(p.factory.NewTypePredicateNode(nil /*assertsModifier* /, id, p.parseType()), pos)
 * 		}
 * 		p.rewind(state)
 * 	}
 * 	return p.parseType()
 * }
 */
export function Parser_parseTypeOrTypePredicate(receiver: GoPtr<Parser>): GoPtr<TypeNode> {
  if (Parser_isIdentifier(receiver)) {
    const state = Parser_mark(receiver);
    const pos = Parser_nodePos(receiver);
    const id = Parser_parseIdentifier(receiver);
    if (receiver!.token === KindIsKeyword && !Parser_hasPrecedingLineBreak(receiver)) {
      Parser_nextToken(receiver);
      return Parser_finishNode(receiver, NewTypePredicateNode(receiver!.factory, undefined /*assertsModifier*/, id, Parser_parseType(receiver)), pos);
    }
    Parser_rewind(receiver, state);
  }
  return Parser_parseType(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeMemberSemicolon","kind":"method","status":"implemented","sigHash":"763451950c02dcaf1bcd3ce966c3bed577eae62769ee37a109c442dba1af9bd5","bodyHash":"d20d400b95066d556757517732109be9972f26af5cc0b6532ecca1f2bc1b7863"}
 *
 * Go source:
 * func (p *Parser) parseTypeMemberSemicolon() {
 * 	// We allow type members to be separated by commas or (possibly ASI) semicolons.
 * 	// First check if it was a comma.  If so, we're done with the member.
 * 	if p.parseOptional(ast.KindCommaToken) {
 * 		return
 * 	}
 * 	// Didn't have a comma.  We must have a (possible ASI) semicolon.
 * 	p.parseSemicolon()
 * }
 */
export function Parser_parseTypeMemberSemicolon(receiver: GoPtr<Parser>): void {
  // We allow type members to be separated by commas or (possibly ASI) semicolons.
  // First check if it was a comma.  If so, we're done with the member.
  if (Parser_parseOptional(receiver, KindCommaToken)) {
    return;
  }
  // Didn't have a comma.  We must have a (possible ASI) semicolon.
  Parser_parseSemicolon(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeLiteral","kind":"method","status":"implemented","sigHash":"61cad9356b53c4e3c87880b2bb6f72414131233da99715bc7157f235758e6568","bodyHash":"3873ff4dfc3abbeb3a236df7fbdd5a0e8ce91b736040ba5f38e234411e4cab81"}
 *
 * Go source:
 * func (p *Parser) parseTypeLiteral() *ast.Node {
 * 	pos := p.nodePos()
 * 	result := p.finishNode(p.factory.NewTypeLiteralNode(p.parseObjectTypeMembers()), pos)
 * 	return result
 * }
 */
export function Parser_parseTypeLiteral(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const result = Parser_finishNode(receiver, NewTypeLiteralNode(receiver!.factory, Parser_parseObjectTypeMembers(receiver)), pos);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseObjectTypeMembers","kind":"method","status":"implemented","sigHash":"f12cee1a0c6b4374db7e283d4d475fc3daff9fa975e60690de5a155ab494ad68","bodyHash":"ad7a407a18ed742224c74efc54dc259c16733ce227abee2c857fde9c5afba9a9"}
 *
 * Go source:
 * func (p *Parser) parseObjectTypeMembers() *ast.NodeList {
 * 	if p.parseExpected(ast.KindOpenBraceToken) {
 * 		members := p.parseList(PCTypeMembers, (*Parser).parseTypeMember)
 * 		p.parseExpected(ast.KindCloseBraceToken)
 * 		return members
 * 	}
 * 	return p.createMissingList()
 * }
 */
export function Parser_parseObjectTypeMembers(receiver: GoPtr<Parser>): GoPtr<NodeList> {
  if (Parser_parseExpected(receiver, KindOpenBraceToken)) {
    const members = Parser_parseList(receiver, PCTypeMembers, Parser_parseTypeMember);
    Parser_parseExpected(receiver, KindCloseBraceToken);
    return members;
  }
  return Parser_createMissingList(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTupleType","kind":"method","status":"implemented","sigHash":"ef43b1d02a81443af6ff671142a239c3a7c603521abf8a3adc900be4936498ff","bodyHash":"aad5dc730dfc2118fcb5b7ed936e17ad303afe96bea42a66cbfe4c3cd2c338e4"}
 *
 * Go source:
 * func (p *Parser) parseTupleType() *ast.Node {
 * 	pos := p.nodePos()
 * 	return p.finishNode(p.factory.NewTupleTypeNode(p.parseBracketedList(PCTupleElementTypes, (*Parser).parseTupleElementNameOrTupleElementType, ast.KindOpenBracketToken, ast.KindCloseBracketToken)), pos)
 * }
 */
export function Parser_parseTupleType(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  return Parser_finishNode(receiver, NewTupleTypeNode(receiver!.factory, Parser_parseBracketedList(receiver, PCTupleElementTypes, Parser_parseTupleElementNameOrTupleElementType, KindOpenBracketToken, KindCloseBracketToken)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTupleElementNameOrTupleElementType","kind":"method","status":"implemented","sigHash":"df44890c8495486caf734fd5412844af08d0cada600aeae1c01d5b084f5bff22","bodyHash":"98f17a2625adf0d1517447a1ae90f2f83d16de1baaa4ffdae6c1d800564472b6"}
 *
 * Go source:
 * func (p *Parser) parseTupleElementNameOrTupleElementType() *ast.Node {
 * 	if p.lookAhead((*Parser).scanStartOfNamedTupleElement) {
 * 		pos := p.nodePos()
 * 		jsdoc := p.jsdocScannerInfo()
 * 		dotDotDotToken := p.parseOptionalToken(ast.KindDotDotDotToken)
 * 		name := p.parseIdentifierName()
 * 		questionToken := p.parseOptionalToken(ast.KindQuestionToken)
 * 		p.parseExpected(ast.KindColonToken)
 * 		typeNode := p.parseTupleElementType()
 * 		result := p.finishNode(p.factory.NewNamedTupleMember(dotDotDotToken, name, questionToken, typeNode), pos)
 * 		p.withJSDoc(result, jsdoc)
 * 		return result
 * 	}
 * 	return p.parseTupleElementType()
 * }
 */
export function Parser_parseTupleElementNameOrTupleElementType(receiver: GoPtr<Parser>): GoPtr<Node> {
  if (Parser_lookAhead(receiver, Parser_scanStartOfNamedTupleElement)) {
    const pos = Parser_nodePos(receiver);
    const jsdoc = Parser_jsdocScannerInfo(receiver);
    const dotDotDotToken = Parser_parseOptionalToken(receiver, KindDotDotDotToken);
    const name = Parser_parseIdentifierName(receiver);
    const questionToken = Parser_parseOptionalToken(receiver, KindQuestionToken);
    Parser_parseExpected(receiver, KindColonToken);
    const typeNode = Parser_parseTupleElementType(receiver);
    const result = Parser_finishNode(receiver, NewNamedTupleMember(receiver!.factory, dotDotDotToken, name, questionToken, typeNode), pos);
    Parser_withJSDoc(receiver, result, jsdoc);
    return result;
  }
  return Parser_parseTupleElementType(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.scanStartOfNamedTupleElement","kind":"method","status":"implemented","sigHash":"1dd21262c0ae17e675f88a9724b6a6ae04b9fd17c39839f08610a93ebd0822f8","bodyHash":"731ef602dcfb20ab4f5c3551ec66d4be721eaf681592576078d9cdd73af74fb0"}
 *
 * Go source:
 * func (p *Parser) scanStartOfNamedTupleElement() bool {
 * 	if p.token == ast.KindDotDotDotToken {
 * 		return tokenIsIdentifierOrKeyword(p.nextToken()) && p.nextTokenIsColonOrQuestionColon()
 * 	}
 * 	return tokenIsIdentifierOrKeyword(p.token) && p.nextTokenIsColonOrQuestionColon()
 * }
 */
export function Parser_scanStartOfNamedTupleElement(receiver: GoPtr<Parser>): bool {
  if (receiver!.token === KindDotDotDotToken) {
    return tokenIsIdentifierOrKeyword(Parser_nextToken(receiver)) && Parser_nextTokenIsColonOrQuestionColon(receiver);
  }
  return tokenIsIdentifierOrKeyword(receiver!.token) && Parser_nextTokenIsColonOrQuestionColon(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTupleElementType","kind":"method","status":"implemented","sigHash":"090ec58db3d8c317f82993166a39fababe629ce4b02eb77c6efc15266f751849","bodyHash":"bbb669d4e437dab100fbb2353d7f7a33f02841f062f1fcd32d05599c3904aafc"}
 *
 * Go source:
 * func (p *Parser) parseTupleElementType() *ast.TypeNode {
 * 	pos := p.nodePos()
 * 	if p.parseOptional(ast.KindDotDotDotToken) {
 * 		return p.finishNode(p.factory.NewRestTypeNode(p.parseType()), pos)
 * 	}
 * 	typeNode := p.parseType()
 * 	if ast.IsJSDocNullableType(typeNode) && typeNode.Pos() == typeNode.Type().Pos() {
 * 		node := p.factory.NewOptionalTypeNode(typeNode.Type())
 * 		node.Flags = typeNode.Flags
 * 		node.Loc = typeNode.Loc
 * 		typeNode.Type().Parent = node
 * 		return node
 * 	}
 * 	return typeNode
 * }
 */
export function Parser_parseTupleElementType(receiver: GoPtr<Parser>): GoPtr<TypeNode> {
  const pos = Parser_nodePos(receiver);
  if (Parser_parseOptional(receiver, KindDotDotDotToken)) {
    return Parser_finishNode(receiver, NewRestTypeNode(receiver!.factory, Parser_parseType(receiver)), pos);
  }
  const typeNode = Parser_parseType(receiver);
  if (IsJSDocNullableType(typeNode) && Node_Pos(typeNode) === Node_Pos(Node_Type(typeNode))) {
    const node = NewOptionalTypeNode(receiver!.factory, Node_Type(typeNode));
    node!.Flags = typeNode!.Flags;
    node!.Loc = typeNode!.Loc;
    Node_Type(typeNode)!.Parent = node;
    return node;
  }
  return typeNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseParenthesizedType","kind":"method","status":"implemented","sigHash":"f685bbbd0320d9ce74267bc8eda6c7a407bf1c2529a25c2852156eae55f31961","bodyHash":"51f10bd0daecde356a52b1ec0b7bcad47f53ffe2684fae3b660b8648642feffb"}
 *
 * Go source:
 * func (p *Parser) parseParenthesizedType() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindOpenParenToken)
 * 	typeNode := p.parseType()
 * 	p.parseExpected(ast.KindCloseParenToken)
 * 	return p.finishNode(p.factory.NewParenthesizedTypeNode(typeNode), pos)
 * }
 */
export function Parser_parseParenthesizedType(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindOpenParenToken);
  const typeNode = Parser_parseType(receiver);
  Parser_parseExpected(receiver, KindCloseParenToken);
  return Parser_finishNode(receiver, NewParenthesizedTypeNode(receiver!.factory, typeNode), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseAssertsTypePredicate","kind":"method","status":"implemented","sigHash":"6f854b1c7837b89f19b826e85bc569ca8c0656dc8551ded85047d6242961306d","bodyHash":"2b9f1a1620c3e87d4f340705e5d36ed4a00e9ffce39804ff2a8da081ba0c0efb"}
 *
 * Go source:
 * func (p *Parser) parseAssertsTypePredicate() *ast.TypeNode {
 * 	pos := p.nodePos()
 * 	assertsModifier := p.parseExpectedToken(ast.KindAssertsKeyword)
 * 	var parameterName *ast.Node
 * 	if p.token == ast.KindThisKeyword {
 * 		parameterName = p.parseThisTypeNode()
 * 	} else {
 * 		parameterName = p.parseIdentifier()
 * 	}
 * 	var typeNode *ast.TypeNode
 * 	if p.parseOptional(ast.KindIsKeyword) {
 * 		typeNode = p.parseType()
 * 	}
 * 	return p.finishNode(p.factory.NewTypePredicateNode(assertsModifier, parameterName, typeNode), pos)
 * }
 */
export function Parser_parseAssertsTypePredicate(receiver: GoPtr<Parser>): GoPtr<TypeNode> {
  const pos = Parser_nodePos(receiver);
  const assertsModifier = Parser_parseExpectedToken(receiver, KindAssertsKeyword);
  const parameterName = receiver!.token === KindThisKeyword
    ? Parser_parseThisTypeNode(receiver)
    : Parser_parseIdentifier(receiver);
  const typeNode = Parser_parseOptional(receiver, KindIsKeyword) ? Parser_parseType(receiver) : undefined;
  return Parser_finishNode(receiver, NewTypePredicateNode(receiver!.factory, assertsModifier, parameterName, typeNode), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTemplateType","kind":"method","status":"implemented","sigHash":"1c7cc0cf3ca5f1bfdf8c15eca7ee6d7f9eff85a8bfca2068f09d44410e2a6b7e","bodyHash":"92c5616ef3a8b654fac89668873a7a0afc0c78c0eb94f253b655c5d9400dd0db"}
 *
 * Go source:
 * func (p *Parser) parseTemplateType() *ast.Node {
 * 	pos := p.nodePos()
 * 	return p.finishNode(p.factory.NewTemplateLiteralTypeNode(p.parseTemplateHead(false /*isTaggedTemplate* /), p.parseTemplateTypeSpans()), pos)
 * }
 */
export function Parser_parseTemplateType(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  return Parser_finishNode(receiver, NewTemplateLiteralTypeNode(receiver!.factory, Parser_parseTemplateHead(receiver, false /*isTaggedTemplate*/), Parser_parseTemplateTypeSpans(receiver)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTemplateTypeSpans","kind":"method","status":"implemented","sigHash":"97f8f366e1f5f81f2c0f71f469d147ac745276993d94928d01c0dd710d65bee0","bodyHash":"f449ff6cf13f58c0624e115edd8394f620b229ced1d1a3a71f412e69593a4705"}
 *
 * Go source:
 * func (p *Parser) parseTemplateTypeSpans() *ast.NodeList {
 * 	pos := p.nodePos()
 * 	var list []*ast.Node
 * 	for {
 * 		span := p.parseTemplateTypeSpan()
 * 		list = append(list, span)
 * 		if span.AsTemplateLiteralTypeSpan().Literal.Kind != ast.KindTemplateMiddle {
 * 			break
 * 		}
 * 	}
 * 	return p.newNodeList(core.NewTextRange(pos, p.nodePos()), list)
 * }
 */
export function Parser_parseTemplateTypeSpans(receiver: GoPtr<Parser>): GoPtr<NodeList> {
  const pos = Parser_nodePos(receiver);
  const accumulate = (list: GoSlice<GoPtr<Node>>): GoSlice<GoPtr<Node>> => {
    const span = Parser_parseTemplateTypeSpan(receiver);
    const next = [...list, span];
    if (AsTemplateLiteralTypeSpan(span)!.Literal!.Kind !== KindTemplateMiddle) {
      return next;
    }
    return accumulate(next);
  };
  const list = accumulate([]);
  return Parser_newNodeList(receiver, NewTextRange(pos, Parser_nodePos(receiver)), list);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTemplateTypeSpan","kind":"method","status":"implemented","sigHash":"4ac0dcc17f545a561d3355e67b506e5de6424e9b3a8f01d52a82a541ca90ab6c","bodyHash":"2069a3f3ad50febc0b794f4501e4c0ba10a6a6a7c0c43748b46806eb78d8ee5e"}
 *
 * Go source:
 * func (p *Parser) parseTemplateTypeSpan() *ast.Node {
 * 	pos := p.nodePos()
 * 	return p.finishNode(p.factory.NewTemplateLiteralTypeSpan(p.parseType(), p.parseLiteralOfTemplateSpan(false /*isTaggedTemplate* /)), pos)
 * }
 */
export function Parser_parseTemplateTypeSpan(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  return Parser_finishNode(receiver, NewTemplateLiteralTypeSpan(receiver!.factory, Parser_parseType(receiver), Parser_parseLiteralOfTemplateSpan(receiver, false /*isTaggedTemplate*/)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseFunctionOrConstructorTypeToError","kind":"method","status":"implemented","sigHash":"3bd417d52d3672ac2c9bde3f67220f35113519bd780c53c0fb3fb04b01a51b24","bodyHash":"019c686cb1a6752fc0e905a5e5a30768abcaf8a687eefd7a0f5d539b7d35a804"}
 *
 * Go source:
 * func (p *Parser) parseFunctionOrConstructorTypeToError(isInUnionType bool, parseConstituentType func(p *Parser) *ast.TypeNode) *ast.TypeNode {
 * 	// the function type and constructor type shorthand notation
 * 	// are not allowed directly in unions and intersections, but we'll
 * 	// try to parse them gracefully and issue a helpful message.
 * 	if p.isStartOfFunctionTypeOrConstructorType() {
 * 		typeNode := p.parseFunctionOrConstructorType()
 * 		var diagnostic *diagnostics.Message
 * 		if typeNode.Kind == ast.KindFunctionType {
 * 			diagnostic = core.IfElse(isInUnionType,
 * 				diagnostics.Function_type_notation_must_be_parenthesized_when_used_in_a_union_type,
 * 				diagnostics.Function_type_notation_must_be_parenthesized_when_used_in_an_intersection_type)
 * 		} else {
 * 			diagnostic = core.IfElse(isInUnionType,
 * 				diagnostics.Constructor_type_notation_must_be_parenthesized_when_used_in_a_union_type,
 * 				diagnostics.Constructor_type_notation_must_be_parenthesized_when_used_in_an_intersection_type)
 * 		}
 * 		p.parseErrorAtRange(typeNode.Loc, diagnostic)
 * 		return typeNode
 * 	}
 * 	return parseConstituentType(p)
 * }
 */
export function Parser_parseFunctionOrConstructorTypeToError(receiver: GoPtr<Parser>, isInUnionType: bool, parseConstituentType: (p: GoPtr<Parser>) => GoPtr<TypeNode>): GoPtr<TypeNode> {
  // the function type and constructor type shorthand notation
  // are not allowed directly in unions and intersections, but we'll
  // try to parse them gracefully and issue a helpful message.
  if (Parser_isStartOfFunctionTypeOrConstructorType(receiver)) {
    const typeNode = Parser_parseFunctionOrConstructorType(receiver);
    const diagnostic = typeNode!.Kind === KindFunctionType
      ? IfElse(isInUnionType,
          Function_type_notation_must_be_parenthesized_when_used_in_a_union_type,
          Function_type_notation_must_be_parenthesized_when_used_in_an_intersection_type)
      : IfElse(isInUnionType,
          Constructor_type_notation_must_be_parenthesized_when_used_in_a_union_type,
          Constructor_type_notation_must_be_parenthesized_when_used_in_an_intersection_type);
    Parser_parseErrorAtRange(receiver, typeNode!.Loc, diagnostic);
    return typeNode;
  }
  return parseConstituentType(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isStartOfFunctionTypeOrConstructorType","kind":"method","status":"implemented","sigHash":"5e26b84b0591424b7dd9691a85e4dec0e9bb2da3707cc019b60d0130be2ffe94","bodyHash":"4906a3c403e4bb805601b9a9b222ff2e210a98e6d6463b8b3163d84c44d61359"}
 *
 * Go source:
 * func (p *Parser) isStartOfFunctionTypeOrConstructorType() bool {
 * 	return p.token == ast.KindLessThanToken ||
 * 		p.token == ast.KindOpenParenToken && p.lookAhead((*Parser).nextIsUnambiguouslyStartOfFunctionType) ||
 * 		p.token == ast.KindNewKeyword ||
 * 		p.token == ast.KindAbstractKeyword && p.lookAhead((*Parser).nextTokenIsNewKeyword)
 * }
 */
export function Parser_isStartOfFunctionTypeOrConstructorType(receiver: GoPtr<Parser>): bool {
  return receiver!.token === KindLessThanToken ||
    (receiver!.token === KindOpenParenToken && Parser_lookAhead(receiver, Parser_nextIsUnambiguouslyStartOfFunctionType)) ||
    receiver!.token === KindNewKeyword ||
    (receiver!.token === KindAbstractKeyword && Parser_lookAhead(receiver, Parser_nextTokenIsNewKeyword));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseFunctionOrConstructorType","kind":"method","status":"implemented","sigHash":"36f55b9d6f4c24e31c414e411cf21216baf32845e2b93199b9770f4eb2737d87","bodyHash":"8791fd2198e91804f2620f616b1bb0cb9b4ce0473e53d07027aa2531a2ae4f43"}
 *
 * Go source:
 * func (p *Parser) parseFunctionOrConstructorType() *ast.TypeNode {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	modifiers := p.parseModifiersForConstructorType()
 * 	isConstructorType := p.parseOptional(ast.KindNewKeyword)
 * 	debug.Assert(modifiers == nil || isConstructorType, "Per isStartOfFunctionOrConstructorType, a function type cannot have modifiers.")
 * 	typeParameters := p.parseTypeParameters()
 * 	parameters := p.parseParameters(ParseFlagsType)
 * 	returnType := p.parseReturnType(ast.KindEqualsGreaterThanToken, false /*isType* /)
 * 	var result *ast.TypeNode
 * 	if isConstructorType {
 * 		result = p.factory.NewConstructorTypeNode(modifiers, typeParameters, parameters, returnType)
 * 	} else {
 * 		result = p.factory.NewFunctionTypeNode(typeParameters, parameters, returnType)
 * 	}
 * 	p.finishNode(result, pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseFunctionOrConstructorType(receiver: GoPtr<Parser>): GoPtr<TypeNode> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  const modifiers = Parser_parseModifiersForConstructorType(receiver);
  const isConstructorType = Parser_parseOptional(receiver, KindNewKeyword);
  Assert(modifiers === undefined || isConstructorType, "Per isStartOfFunctionOrConstructorType, a function type cannot have modifiers.");
  const typeParameters = Parser_parseTypeParameters(receiver);
  const parameters = Parser_parseParameters(receiver, ParseFlagsType);
  const returnType = Parser_parseReturnType(receiver, KindEqualsGreaterThanToken, false /*isType*/);
  const result = isConstructorType
    ? NewConstructorTypeNode(receiver!.factory, modifiers, typeParameters, parameters, returnType)
    : NewFunctionTypeNode(receiver!.factory, typeParameters, parameters, returnType);
  Parser_finishNode(receiver, result, pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseModifiersForConstructorType","kind":"method","status":"implemented","sigHash":"2de5cbee9e81ff31a4a6b4b8b79b4ef03b184794f2a1735d04dace6e7381d33b","bodyHash":"8e56507912607fe9c326ae74c3222eb73438e252394910cdede49bca6ece878b"}
 *
 * Go source:
 * func (p *Parser) parseModifiersForConstructorType() *ast.ModifierList {
 * 	if p.token == ast.KindAbstractKeyword {
 * 		pos := p.nodePos()
 * 		modifier := p.factory.NewModifier(p.token)
 * 		p.nextToken()
 * 		p.finishNode(modifier, pos)
 * 		return p.newModifierList(modifier.Loc, p.nodeSliceArena.NewSlice1(modifier))
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseModifiersForConstructorType(receiver: GoPtr<Parser>): GoPtr<ModifierList> {
  if (receiver!.token === KindAbstractKeyword) {
    const pos = Parser_nodePos(receiver);
    const modifier = NodeFactory_NewModifier(receiver!.factory, receiver!.token);
    Parser_nextToken(receiver);
    Parser_finishNode(receiver, modifier, pos);
    return Parser_newModifierList(receiver, modifier!.Loc, Arena_NewSlice1(receiver!.nodeSliceArena as GoPtr<Arena<GoPtr<Node>>>, modifier));
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextIsUnambiguouslyStartOfFunctionType","kind":"method","status":"implemented","sigHash":"f5d2f71f8542c44bd72419b4434d762456bdacb301769583b726a1cfd4423a54","bodyHash":"bda92c388bc535274b00ef7e07a7fc9dd9fb6678fc67abd4ede77ef760d9bfb0"}
 *
 * Go source:
 * func (p *Parser) nextIsUnambiguouslyStartOfFunctionType() bool {
 * 	p.nextToken()
 * 	if p.token == ast.KindCloseParenToken || p.token == ast.KindDotDotDotToken {
 * 		// ( )
 * 		// ( ...
 * 		return true
 * 	}
 * 	if p.skipParameterStart() {
 * 		// We successfully skipped modifiers (if any) and an identifier or binding pattern,
 * 		// now see if we have something that indicates a parameter declaration
 * 		if p.token == ast.KindColonToken || p.token == ast.KindCommaToken || p.token == ast.KindQuestionToken || p.token == ast.KindEqualsToken {
 * 			// ( xxx :
 * 			// ( xxx ,
 * 			// ( xxx ?
 * 			// ( xxx =
 * 			return true
 * 		}
 * 		if p.token == ast.KindCloseParenToken && p.nextToken() == ast.KindEqualsGreaterThanToken {
 * 			// ( xxx ) =>
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Parser_nextIsUnambiguouslyStartOfFunctionType(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  if (receiver!.token === KindCloseParenToken || receiver!.token === KindDotDotDotToken) {
    // ( )
    // ( ...
    return true;
  }
  if (Parser_skipParameterStart(receiver)) {
    // We successfully skipped modifiers (if any) and an identifier or binding pattern,
    // now see if we have something that indicates a parameter declaration
    if (receiver!.token === KindColonToken || receiver!.token === KindCommaToken || receiver!.token === KindQuestionToken || receiver!.token === KindEqualsToken) {
      // ( xxx :
      // ( xxx ,
      // ( xxx ?
      // ( xxx =
      return true;
    }
    if (receiver!.token === KindCloseParenToken && Parser_nextToken(receiver) === KindEqualsGreaterThanToken) {
      // ( xxx ) =>
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeOfExpression","kind":"method","status":"implemented","sigHash":"e23e8d09f24c31026c87bd46458562c3e7b836fcb1fe8550aead6010d7260939","bodyHash":"d3c3cd9564b986281b36c0cf904efe830f9953dcdc102f6f085b09c4f2c354c4"}
 *
 * Go source:
 * func (p *Parser) parseTypeOfExpression() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.nextToken()
 * 	return p.finishNode(p.factory.NewTypeOfExpression(p.parseSimpleUnaryExpression()), pos)
 * }
 */
export function Parser_parseTypeOfExpression(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_nextToken(receiver);
  return Parser_finishNode(receiver, NewTypeOfExpression(receiver!.factory, Parser_parseSimpleUnaryExpression(receiver)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTypeAssertion","kind":"method","status":"implemented","sigHash":"91881793bbaffc98dfbd3c7b9a1944fbbf7d341393e08ebf6c9f5e317b08cac2","bodyHash":"11501b4e9a3be8f7a116aa83afdbdaf9dda9301ad8828001becb97ca96831b39"}
 *
 * Go source:
 * func (p *Parser) parseTypeAssertion() *ast.Node {
 * 	debug.Assert(p.languageVariant != core.LanguageVariantJSX, "Type assertions should never be parsed in JSX; they should be parsed as comparisons or JSX elements/fragments.")
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindLessThanToken)
 * 	typeNode := p.parseType()
 * 	p.parseExpected(ast.KindGreaterThanToken)
 * 	expression := p.parseSimpleUnaryExpression()
 * 	return p.finishNode(p.factory.NewTypeAssertion(typeNode, expression), pos)
 * }
 */
export function Parser_parseTypeAssertion(receiver: GoPtr<Parser>): GoPtr<Node> {
  Assert(receiver!.languageVariant !== LanguageVariantJSX, "Type assertions should never be parsed in JSX; they should be parsed as comparisons or JSX elements/fragments.");
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindLessThanToken);
  const typeNode = Parser_parseType(receiver);
  Parser_parseExpected(receiver, KindGreaterThanToken);
  const expression = Parser_parseSimpleUnaryExpression(receiver);
  return Parser_finishNode(receiver, NewTypeAssertion(receiver!.factory, typeNode, expression), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.tryParseTypeArgumentsInExpression","kind":"method","status":"implemented","sigHash":"9b04580cfab0194752ab9a6b573e7be4da14ae1d4e0937eda724306306b4adb8","bodyHash":"960b024e0d34f97103d4479757259933c5356f872d5b6afba628975c00473fe8"}
 *
 * Go source:
 * func (p *Parser) tryParseTypeArgumentsInExpression() *ast.NodeList {
 * 	// TypeArguments must not be parsed in JavaScript files to avoid ambiguity with binary operators.
 * 	state := p.mark()
 * 	if p.contextFlags&ast.NodeFlagsJavaScriptFile == 0 && p.reScanLessThanToken() == ast.KindLessThanToken {
 * 		p.nextToken()
 * 		typeArguments := p.parseDelimitedList(PCTypeArguments, (*Parser).parseType)
 * 		// If it doesn't have the closing `>` then it's definitely not an type argument list.
 * 		if p.reScanGreaterThanToken() == ast.KindGreaterThanToken {
 * 			p.nextToken()
 * 			// We successfully parsed a type argument list. The next token determines whether we want to
 * 			// treat it as such. If the type argument list is followed by `(` or a template literal, as in
 * 			// `f<number>(42)`, we favor the type argument interpretation even though JavaScript would view
 * 			// it as a relational expression.
 * 			if p.canFollowTypeArgumentsInExpression() {
 * 				return typeArguments
 * 			}
 * 		}
 * 	}
 * 	p.rewind(state)
 * 	return nil
 * }
 */
export function Parser_tryParseTypeArgumentsInExpression(receiver: GoPtr<Parser>): GoPtr<NodeList> {
  // TypeArguments must not be parsed in JavaScript files to avoid ambiguity with binary operators.
  const state = Parser_mark(receiver);
  if ((receiver!.contextFlags & NodeFlagsJavaScriptFile) === 0 && Parser_reScanLessThanToken(receiver) === KindLessThanToken) {
    Parser_nextToken(receiver);
    const typeArguments = Parser_parseDelimitedList(receiver, PCTypeArguments, Parser_parseType);
    // If it doesn't have the closing `>` then it's definitely not an type argument list.
    if (Parser_reScanGreaterThanToken(receiver) === KindGreaterThanToken) {
      Parser_nextToken(receiver);
      // We successfully parsed a type argument list. The next token determines whether we want to
      // treat it as such. If the type argument list is followed by `(` or a template literal, as in
      // `f<number>(42)`, we favor the type argument interpretation even though JavaScript would view
      // it as a relational expression.
      if (Parser_canFollowTypeArgumentsInExpression(receiver)) {
        return typeArguments;
      }
    }
  }
  Parser_rewind(receiver, state);
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.canFollowTypeArgumentsInExpression","kind":"method","status":"implemented","sigHash":"627c9a5ec393c472a4cae708506562dc739282e762c0fa4a8ab48dabf5782d0f","bodyHash":"7e71bc6ffc03c2718d071f8b6ad9bfb15e737dc6b6767cb85c4b61365e5f498e"}
 *
 * Go source:
 * func (p *Parser) canFollowTypeArgumentsInExpression() bool {
 * 	switch p.token {
 * 	// These tokens can follow a type argument list in a call expression:
 * 	// foo<x>(
 * 	// foo<T> `...`
 * 	// foo<T> `...${100}...`
 * 	case ast.KindOpenParenToken, ast.KindNoSubstitutionTemplateLiteral, ast.KindTemplateHead:
 * 		return true
 * 	// A type argument list followed by `<` never makes sense, and a type argument list followed
 * 	// by `>` is ambiguous with a (re-scanned) `>>` operator, so we disqualify both. Also, in
 * 	// this context, `+` and `-` are unary operators, not binary operators.
 * 	case ast.KindLessThanToken, ast.KindGreaterThanToken, ast.KindPlusToken, ast.KindMinusToken:
 * 		return false
 * 	}
 * 	// We favor the type argument list interpretation when it is immediately followed by
 * 	// a line break, a binary operator, or something that can't start an expression.
 * 	return p.hasPrecedingLineBreak() || p.isBinaryOperator() || !p.isStartOfExpression()
 * }
 */
export function Parser_canFollowTypeArgumentsInExpression(receiver: GoPtr<Parser>): bool {
  switch (receiver!.token) {
    // These tokens can follow a type argument list in a call expression:
    // foo<x>(
    // foo<T> `...`
    // foo<T> `...${100}...`
    case KindOpenParenToken:
    case KindNoSubstitutionTemplateLiteral:
    case KindTemplateHead:
      return true;
    // A type argument list followed by `<` never makes sense, and a type argument list followed
    // by `>` is ambiguous with a (re-scanned) `>>` operator, so we disqualify both. Also, in
    // this context, `+` and `-` are unary operators, not binary operators.
    case KindLessThanToken:
    case KindGreaterThanToken:
    case KindPlusToken:
    case KindMinusToken:
      return false;
  }
  // We favor the type argument list interpretation when it is immediately followed by
  // a line break, a binary operator, or something that can't start an expression.
  return Parser_hasPrecedingLineBreak(receiver) || Parser_isBinaryOperator(receiver) || !Parser_isStartOfExpression(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.unparseExpressionWithTypeArguments","kind":"method","status":"implemented","sigHash":"f8cadf0ec6a679561bd8f4f59d954136c700bfc993c556e01b4f023e0232de60","bodyHash":"30c8a335feb191a1986631c7b86108d03f956b1ba789482e271efd887c18852b"}
 *
 * Go source:
 * func (p *Parser) unparseExpressionWithTypeArguments(expression *ast.Node, typeArguments *ast.NodeList, result *ast.Node) {
 * 	// force overwrite the `.Parent` of the expression and type arguments to erase the fact that they may have originally been parsed as an ExpressionWithTypeArguments and be parented to such
 * 	if expression != nil {
 * 		expression.Parent = result
 * 	}
 * 	if typeArguments != nil {
 * 		for _, a := range typeArguments.Nodes {
 * 			a.Parent = result
 * 		}
 * 	}
 * }
 */
export function Parser_unparseExpressionWithTypeArguments(receiver: GoPtr<Parser>, expression: GoPtr<Node>, typeArguments: GoPtr<NodeList>, result: GoPtr<Node>): void {
  // force overwrite the `.Parent` of the expression and type arguments to erase the fact that they may have originally been parsed as an ExpressionWithTypeArguments and be parented to such
  if (expression !== undefined) {
    expression.Parent = result;
  }
  if (typeArguments !== undefined) {
    for (const a of typeArguments.Nodes) {
      a!.Parent = result;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.scanTypeMemberStart","kind":"method","status":"implemented","sigHash":"9010c670e4bc733f1914b40769dee62dbb8722bc6fa27e51be6c3f20d95dbcea","bodyHash":"b1aa5f25dac544c500ec0bd9e42dae7251a5bc0dd7b66e7010b058e192c92829"}
 *
 * Go source:
 * func (p *Parser) scanTypeMemberStart() bool {
 * 	// Return true if we have the start of a signature member
 * 	if p.token == ast.KindOpenParenToken || p.token == ast.KindLessThanToken || p.token == ast.KindGetKeyword || p.token == ast.KindSetKeyword {
 * 		return true
 * 	}
 * 	idToken := false
 * 	// Eat up all modifiers, but hold on to the last one in case it is actually an identifier
 * 	for ast.IsModifierKind(p.token) {
 * 		idToken = true
 * 		p.nextToken()
 * 	}
 * 	// Index signatures and computed property names are type members
 * 	if p.token == ast.KindOpenBracketToken {
 * 		return true
 * 	}
 * 	// Try to get the first property-like token following all modifiers
 * 	if p.isLiteralPropertyName() {
 * 		idToken = true
 * 		p.nextToken()
 * 	}
 * 	// If we were able to get any potential identifier, check that it is
 * 	// the start of a member declaration
 * 	if idToken {
 * 		return p.token == ast.KindOpenParenToken || p.token == ast.KindLessThanToken || p.token == ast.KindQuestionToken || p.token == ast.KindColonToken || p.token == ast.KindCommaToken || p.canParseSemicolon()
 * 	}
 * 	return false
 * }
 */
export function Parser_scanTypeMemberStart(receiver: GoPtr<Parser>): bool {
  // Return true if we have the start of a signature member
  if (receiver!.token === KindOpenParenToken || receiver!.token === KindLessThanToken || receiver!.token === KindGetKeyword || receiver!.token === KindSetKeyword) {
    return true;
  }
  // Eat up all modifiers, but hold on to the last one in case it is actually an identifier
  const eatModifiers = (sawModifier: bool): bool => {
    if (IsModifierKind(receiver!.token)) {
      Parser_nextToken(receiver);
      return eatModifiers(true);
    }
    return sawModifier;
  };
  const idTokenAfterModifiers = eatModifiers(false);
  // Index signatures and computed property names are type members
  if (receiver!.token === KindOpenBracketToken) {
    return true;
  }
  // Try to get the first property-like token following all modifiers
  const idToken = ((): bool => {
    if (Parser_isLiteralPropertyName(receiver)) {
      Parser_nextToken(receiver);
      return true;
    }
    return idTokenAfterModifiers;
  })();
  // If we were able to get any potential identifier, check that it is
  // the start of a member declaration
  if (idToken) {
    return receiver!.token === KindOpenParenToken || receiver!.token === KindLessThanToken || receiver!.token === KindQuestionToken || receiver!.token === KindColonToken || receiver!.token === KindCommaToken || Parser_canParseSemicolon(receiver);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isStartOfType","kind":"method","status":"implemented","sigHash":"339358066939617e97c0d25786fcb02f29553a77614b6112be8f203f247143a5","bodyHash":"1b8fff8c23bbcd0e881dd7e314186cb5558cf21024eebfefd3941abb23eb8eab"}
 *
 * Go source:
 * func (p *Parser) isStartOfType(inStartOfParameter bool) bool {
 * 	switch p.token {
 * 	case ast.KindAnyKeyword, ast.KindUnknownKeyword, ast.KindStringKeyword, ast.KindNumberKeyword, ast.KindBigIntKeyword,
 * 		ast.KindBooleanKeyword, ast.KindReadonlyKeyword, ast.KindSymbolKeyword, ast.KindUniqueKeyword, ast.KindVoidKeyword,
 * 		ast.KindUndefinedKeyword, ast.KindNullKeyword, ast.KindThisKeyword, ast.KindTypeOfKeyword, ast.KindNeverKeyword,
 * 		ast.KindOpenBraceToken, ast.KindOpenBracketToken, ast.KindLessThanToken, ast.KindBarToken, ast.KindAmpersandToken,
 * 		ast.KindNewKeyword, ast.KindStringLiteral, ast.KindNumericLiteral, ast.KindBigIntLiteral, ast.KindTrueKeyword,
 * 		ast.KindFalseKeyword, ast.KindObjectKeyword, ast.KindAsteriskToken, ast.KindQuestionToken, ast.KindExclamationToken,
 * 		ast.KindDotDotDotToken, ast.KindInferKeyword, ast.KindImportKeyword, ast.KindAssertsKeyword, ast.KindNoSubstitutionTemplateLiteral,
 * 		ast.KindTemplateHead:
 * 		return true
 * 	case ast.KindFunctionKeyword:
 * 		return !inStartOfParameter
 * 	case ast.KindMinusToken:
 * 		return !inStartOfParameter && p.lookAhead((*Parser).nextTokenIsNumericOrBigIntLiteral)
 * 	case ast.KindOpenParenToken:
 * 		// Only consider '(' the start of a type if followed by ')', '...', an identifier, a modifier,
 * 		// or something that starts a type. We don't want to consider things like '(1)' a type.
 * 		return !inStartOfParameter && p.lookAhead((*Parser).nextIsParenthesizedOrFunctionType)
 * 	}
 * 	return p.isIdentifier()
 * }
 */
export function Parser_isStartOfType(receiver: GoPtr<Parser>, inStartOfParameter: bool): bool {
  switch (receiver!.token) {
    case KindAnyKeyword:
    case KindUnknownKeyword:
    case KindStringKeyword:
    case KindNumberKeyword:
    case KindBigIntKeyword:
    case KindBooleanKeyword:
    case KindReadonlyKeyword:
    case KindSymbolKeyword:
    case KindUniqueKeyword:
    case KindVoidKeyword:
    case KindUndefinedKeyword:
    case KindNullKeyword:
    case KindThisKeyword:
    case KindTypeOfKeyword:
    case KindNeverKeyword:
    case KindOpenBraceToken:
    case KindOpenBracketToken:
    case KindLessThanToken:
    case KindBarToken:
    case KindAmpersandToken:
    case KindNewKeyword:
    case KindStringLiteral:
    case KindNumericLiteral:
    case KindBigIntLiteral:
    case KindTrueKeyword:
    case KindFalseKeyword:
    case KindObjectKeyword:
    case KindAsteriskToken:
    case KindQuestionToken:
    case KindExclamationToken:
    case KindDotDotDotToken:
    case KindInferKeyword:
    case KindImportKeyword:
    case KindAssertsKeyword:
    case KindNoSubstitutionTemplateLiteral:
    case KindTemplateHead:
      return true;
    case KindFunctionKeyword:
      return !inStartOfParameter;
    case KindMinusToken:
      return !inStartOfParameter && Parser_lookAhead(receiver, Parser_nextTokenIsNumericOrBigIntLiteral);
    case KindOpenParenToken:
      // Only consider '(' the start of a type if followed by ')', '...', an identifier, a modifier,
      // or something that starts a type. We don't want to consider things like '(1)' a type.
      return !inStartOfParameter && Parser_lookAhead(receiver, Parser_nextIsParenthesizedOrFunctionType);
  }
  return Parser_isIdentifier(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextIsParenthesizedOrFunctionType","kind":"method","status":"implemented","sigHash":"a7319e26199b3a1b62e720df258e4dd271645e578f9138a934a88f65357545e6","bodyHash":"6920a58397c5e2a2bc23a134c3c4d3534033fa762b2dc36a4153b7c89b4ee888"}
 *
 * Go source:
 * func (p *Parser) nextIsParenthesizedOrFunctionType() bool {
 * 	p.nextToken()
 * 	return p.token == ast.KindCloseParenToken || p.isStartOfParameter(false /*isJSDocParameter* /) || p.isStartOfType(false /*inStartOfParameter* /)
 * }
 */
export function Parser_nextIsParenthesizedOrFunctionType(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  return receiver!.token === KindCloseParenToken || Parser_isStartOfParameter(receiver, false /*isJSDocParameter*/) || Parser_isStartOfType(receiver, false /*inStartOfParameter*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isValidHeritageClauseObjectLiteral","kind":"method","status":"implemented","sigHash":"a8dcc392f80e7d01de1e86e6e85289cc016bb969abed717d04a965ce46f66cbc","bodyHash":"1f73de089c811e83172832b2b7427cf92bf75d30d46ca2e52e36f06798873a62"}
 *
 * Go source:
 * func (p *Parser) isValidHeritageClauseObjectLiteral() bool {
 * 	return p.lookAhead((*Parser).nextIsValidHeritageClauseObjectLiteral)
 * }
 */
export function Parser_isValidHeritageClauseObjectLiteral(receiver: GoPtr<Parser>): bool {
  return Parser_lookAhead(receiver, Parser_nextIsValidHeritageClauseObjectLiteral);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextIsValidHeritageClauseObjectLiteral","kind":"method","status":"implemented","sigHash":"3a942296f848e52a59d3d99c9593daf3ae4d42ad531e7591cf12f356d232fb4a","bodyHash":"3eaf7ac0326e6a357889c5f4a1bd1f7fd517e5f744f08ae7a9d002d58097ee20"}
 *
 * Go source:
 * func (p *Parser) nextIsValidHeritageClauseObjectLiteral() bool {
 * 	if p.nextToken() == ast.KindCloseBraceToken {
 * 		// if we see "extends {}" then only treat the {} as what we're extending (and not
 * 		// the class body) if we have:
 * 		//
 * 		//      extends {} {
 * 		//      extends {},
 * 		//      extends {} extends
 * 		//      extends {} implements
 * 		next := p.nextToken()
 * 		return next == ast.KindCommaToken || next == ast.KindOpenBraceToken || next == ast.KindExtendsKeyword || next == ast.KindImplementsKeyword
 * 	}
 * 	return true
 * }
 */
export function Parser_nextIsValidHeritageClauseObjectLiteral(receiver: GoPtr<Parser>): bool {
  if (Parser_nextToken(receiver) === KindCloseBraceToken) {
    // if we see "extends {}" then only treat the {} as what we're extending (and not
    // the class body) if we have:
    //
    //      extends {} {
    //      extends {},
    //      extends {} extends
    //      extends {} implements
    const next = Parser_nextToken(receiver);
    return next === KindCommaToken || next === KindOpenBraceToken || next === KindExtendsKeyword || next === KindImplementsKeyword;
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isHeritageClause","kind":"method","status":"implemented","sigHash":"900309f8436adc4f9054498c01865ae6837663143012d90d4407061f15ba6f33","bodyHash":"076b0abc3a43411a61cee855887b52e5bb4609c8da4e9fa17ed3ac71925f75e9"}
 *
 * Go source:
 * func (p *Parser) isHeritageClause() bool {
 * 	return p.token == ast.KindExtendsKeyword || p.token == ast.KindImplementsKeyword
 * }
 */
export function Parser_isHeritageClause(receiver: GoPtr<Parser>): bool {
  return receiver!.token === KindExtendsKeyword || receiver!.token === KindImplementsKeyword;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isHeritageClauseExtendsOrImplementsKeyword","kind":"method","status":"implemented","sigHash":"5d8aae22ee61f969b0b25a5154755d1219a193d11f9cc10020b1c1154b94a822","bodyHash":"948e75b7fd4f4a0fa804fc2fb482213a5b41aaaf29eeb103e2a7801e3ae3f9a7"}
 *
 * Go source:
 * func (p *Parser) isHeritageClauseExtendsOrImplementsKeyword() bool {
 * 	return p.isHeritageClause() && p.lookAhead((*Parser).nextIsStartOfExpression)
 * }
 */
export function Parser_isHeritageClauseExtendsOrImplementsKeyword(receiver: GoPtr<Parser>): bool {
  return Parser_isHeritageClause(receiver) && Parser_lookAhead(receiver, Parser_nextIsStartOfExpression);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.inDisallowConditionalTypesContext","kind":"method","status":"implemented","sigHash":"26ceabbb8531c529dd095830b7fa5b0659bc7c5561fde92b04f78c63cd2020f1","bodyHash":"f3be4003b00a9c968b3247f4f0859bda5f37634cb289ca54cfc92b484a1572ef"}
 *
 * Go source:
 * func (p *Parser) inDisallowConditionalTypesContext() bool {
 * 	return p.contextFlags&ast.NodeFlagsDisallowConditionalTypesContext != 0
 * }
 */
export function Parser_inDisallowConditionalTypesContext(receiver: GoPtr<Parser>): bool {
  return (receiver!.contextFlags & NodeFlagsDisallowConditionalTypesContext) !== 0;
}
