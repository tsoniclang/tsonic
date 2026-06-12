import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import { NewNodeFactory, Node_ForEachChild } from "../../ast/spine.js";
import type { ModifierList, Node, NodeList } from "../../ast/spine.js";
// SourceFile, Pragma, CommentRange (structs) and NodeFactory_NewModifier (the
// hand-written factory wrapper, ast.go: (*NodeFactory).NewModifier -> NewToken) live
// in the hand-written AST core whose documented home is ../../ast/ast.ts (see
// ast/generated/data.ts: "SourceFile ... hand-written in ../ast.ts").
import type { CheckJsDirective, CommentRange, FileReference, Pragma, PragmaArgument, SourceFile } from "../../ast/ast.js";
import { AsSourceFile, NodeFactory_NewModifier, NodeFactory_NewSourceFile, Node_Body, Node_Elements, Node_Expression, Node_ImportClause, Node_IsTypeOnly, Node_ModifierNodes, Node_QuestionToken, Node_Type, Node_TypeArgumentList, Node_TypeParameterList } from "../../ast/ast.js";
import { Node_Modifiers, Node_Name } from "../../ast/spine.js";
import {
  NewArrayLiteralExpression,
  NewCaseOrDefaultClause,
  NewComputedPropertyName,
  NewDecorator,
  NewExpressionStatement,
  NewMethodSignatureDeclaration,
  NewParameterDeclaration,
  NewPropertySignatureDeclaration,
  NewQualifiedName,
} from "../../ast/generated/factory.js";
import type { NodeFactory } from "../../ast/generated/factory.js";
import type { Kind } from "../../ast/generated/kinds.js";
import {
  KindAsyncKeyword,
  KindAsteriskToken,
  KindAtToken,
  KindBigIntLiteral,
  KindCaseClause,
  KindCaseKeyword,
  KindCloseBraceToken,
  KindCloseBracketToken,
  KindColonToken,
  KindCommaToken,
  KindConstKeyword,
  KindDeclareKeyword,
  KindDefaultClause,
  KindDefaultKeyword,
  KindDotDotDotToken,
  KindDotToken,
  KindEndOfFile,
  KindEqualsToken,
  KindFirstReservedWord,
  KindImplementsKeyword,
  KindLastReservedWord,
  KindLessThanToken,
  KindNumericLiteral,
  KindOpenBraceToken,
  KindOpenBracketToken,
  KindOpenParenToken,
  KindPrivateIdentifier,
  KindQuestionToken,
  KindSemicolonToken,
  KindStaticKeyword,
  KindStringLiteral,
  KindThisKeyword,
  KindUnknown,
} from "../../ast/generated/kinds.js";
import { NodeFlagsAwaitContext, NodeFlagsDecoratorContext, NodeFlagsJSDoc, NodeFlagsJavaScriptFile, NodeFlagsJsonFile, NodeFlagsNone, NodeFlagsOptionalChain, NodeFlagsReparsed } from "../../ast/generated/flags.js";
import { IsClassDeclaration, IsDecorator, IsModifierKind, IsNonNullExpression } from "../../ast/generated/predicates.js";
import { ModuleKindCommonJS, ModuleKindESNext } from "../../core/compileroptions.js";
import type { ResolutionMode } from "../../core/compileroptions.js";
import { ScriptKindJS, ScriptKindJSX, ScriptKindJSON, ScriptKindUnknown } from "../../core/scriptkind.js";
import type { ScriptKind } from "../../core/scriptkind.js";
import type { ElementList, EntityName, Expression, TokenNode, TypeNode } from "../../ast/generated/unions.js";
import type { ObjectLiteralExpression } from "../../ast/generated/data.js";
import type { SourceFileParseOptions } from "../../ast/parseoptions.js";
import { NewTextRange, TextRange_Len } from "../../core/text.js";
import type { TextRange } from "../../core/text.js";
import {
  Cannot_start_a_function_call_in_a_type_annotation,
  Decorator_used_before_export_here,
  Decorators_are_not_valid_here,
  Decorators_may_not_appear_after_export_or_export_default_if_they_also_appear_before_export,
  Decorators_must_precede_the_name_and_all_keywords_of_property_declarations,
  Expected_for_property_initializer,
  Invalid_reference_directive_syntax,
  Neither_decorators_nor_modifiers_may_be_applied_to_this_parameters,
  Non_null_assertions_can_only_be_used_in_TypeScript_files,
  Parameter_modifiers_can_only_be_used_in_TypeScript_files,
  Private_identifiers_cannot_be_used_as_parameters,
  Property_assignment_expected,
  Property_value_can_only_be_string_literal_numeric_literal_true_false_null_object_literal_or_array_literal,
  Signature_declarations_can_only_be_used_in_TypeScript_files,
  String_literal_with_double_quotes_expected,
  The_0_modifier_can_only_be_used_in_TypeScript_files,
  Type_aliases_can_only_be_used_in_TypeScript_files,
  Type_annotations_can_only_be_used_in_TypeScript_files,
  Type_arguments_can_only_be_used_in_TypeScript_files,
  Type_assertion_expressions_can_only_be_used_in_TypeScript_files,
  Type_parameter_declarations_can_only_be_used_in_TypeScript_files,
  Type_satisfaction_expressions_can_only_be_used_in_TypeScript_files,
  Unexpected_token,
  X_0_declarations_can_only_be_used_in_TypeScript_files,
  X_0_expected,
  X_export_can_only_be_used_in_TypeScript_files,
  X_implements_clauses_can_only_be_used_in_TypeScript_files,
  X_import_can_only_be_used_in_TypeScript_files,
  X_resolution_mode_should_be_either_require_or_import,
} from "../../diagnostics/generated/messages.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import { GetLeadingCommentRanges, NewScanner, Scanner_Mark, Scanner_Reset, Scanner_Rewind, Scanner_SetLanguageVariant, Scanner_SetOnError, Scanner_SetText, Scanner_Token, Scanner_TokenFullStart, SkipTrivia } from "../../scanner/scanner.js";
import { TokenToString } from "../../scanner/scanner.js";
import { getLanguageVariant } from "../utilities.js";
import { Parser_withJSDoc } from "../jsdoc.js";
import { CanHaveDecorators, CanHaveIllegalDecorators, IsAccessExpression, IsFunctionLike, IsModifier, IsQuestionToken } from "../../ast/utilities.js";
import { AsExportAssignment, AsHeritageClause, AsModuleDeclaration, AsObjectLiteralExpression, AsPrefixUnaryExpression } from "../../ast/generated/casts.js";
import { FindIndex, Some } from "../../core/core.js";
import { ModifierFlagsJavaScript, ModifierToFlag } from "../../ast/modifierflags.js";
import { Diagnostic_AddRelatedInfo, NewDiagnostic } from "../../ast/diagnostic.js";
import { HasPrefix, Index, ToLower, TrimSuffix } from "../../../go/strings.js";
import { Parser_newModifierList } from "./lists.js";
import { Arena_Clone } from "../../core/arena.js";
import type { Arena } from "../../core/arena.js";
import { NewSetWithSizeHint } from "../../collections/set.js";
import type { Set } from "../../collections/set.js";
import {
  KindEnumDeclaration,
  KindInterfaceDeclaration,
  KindTypeAliasDeclaration,
  KindMultiLineCommentTrivia,
  KindSingleLineCommentTrivia,
  KindNonNullExpression,
  KindAsExpression,
  KindSatisfiesExpression,
  KindImportDeclaration,
  KindExportDeclaration,
  KindImportSpecifier,
  KindExportSpecifier,
  KindImportEqualsDeclaration,
  KindExportAssignment,
  KindHeritageClause,
  KindModuleDeclaration,
  KindParameter,
  KindPropertyDeclaration,
  KindMethodDeclaration,
  KindMethodSignature,
  KindConstructor,
  KindGetAccessor,
  KindSetAccessor,
  KindFunctionExpression,
  KindFunctionDeclaration,
  KindArrowFunction,
  KindVariableDeclaration,
  KindIndexSignature,
  KindClassDeclaration,
  KindClassExpression,
  KindVariableStatement,
  KindCallExpression,
  KindNewExpression,
  KindExpressionWithTypeArguments,
  KindJsxSelfClosingElement,
  KindJsxOpeningElement,
  KindTaggedTemplateExpression,
  KindPrefixUnaryExpression,
  KindObjectLiteralExpression,
  KindArrayLiteralExpression,
  KindDecorator,
  KindMinusToken,
  KindTrueKeyword,
  KindFalseKeyword,
  KindNullKeyword,
} from "../../ast/generated/kinds.js";
import {
  Parser_parseTypeAnnotation,
  Parser_parseReturnType,
  Parser_parseTypeMemberSemicolon,
  Parser_parseTypeParameters,
  Parser_isStartOfType,
} from "./types.js";
import {
  Parser_parseArrayLiteralExpression,
  Parser_parseAssignmentExpressionOrHigher,
  Parser_parseDecoratorExpression,
  Parser_parseExpressionAllowIn,
  Parser_isLiteralPropertyName,
  Parser_parseLiteralExpression,
  Parser_parseObjectLiteralExpression,
  Parser_parsePrefixUnaryExpression,
  Parser_validateJsonObjectLiteral,
} from "./expressions.js";
import { Parser_newNodeList, Parser_parseList, Parser_parseParameters } from "./lists.js";
import { ParseFlagsType } from "../types.js";
import { PCSwitchClauseStatements } from "./state.js";
import type { jsdocScannerInfo, Parser, ParserState, ParsingContexts } from "./state.js";
import {
  Parser_hasPrecedingLineBreak,
  Parser_finishNodeWithEnd,
  Parser_finishSourceFile,
  Parser_parseErrorForMissingSemicolonAfter,
  Parser_parseIdentifierNameWithDiagnostic,
  Parser_parseIdentifierOrPatternWithDiagnostic,
  Parser_parseIdentifierWithDiagnostic,
  Parser_parseRightSideOfDot,
  Parser_parseStatement,
  getErrorSpanForNode,
  isDoubleQuotedString,
  isExportModifier,
} from "./statements-declarations.js";
import {
  Parser_createIdentifier,
  Parser_isBindingIdentifier,
  Parser_isIdentifier,
  Parser_isBindingIdentifierOrPrivateIdentifierOrPattern,
  Parser_jsdocScannerInfo,
  Parser_nextToken,
  Parser_nextTokenIsIdentifierOrKeyword,
  Parser_nextTokenIsOnSameLineAndCanFollowModifier,
  Parser_nextTokenIsOpenBrace,
  Parser_parseAnyContextualModifier,
  Parser_parseExpected,
  Parser_parseErrorAtCurrentToken,
  Parser_parseExpectedToken,
  Parser_parseIdentifierName,
  Parser_parseIdentifierOrPattern,
  Parser_parseOptionalToken,
  Parser_parsePrivateIdentifier,
  Parser_parseTokenNode,
  Parser_setContextFlags,
  doInContext,
} from "./tokens-speculation.js";
import { Parser_jsErrorAtRange, Parser_parseErrorAt, Parser_parseErrorAtRange, Parser_scanError } from "./errors-recovery.js";
import { parserPool, viableKeywordSuggestions } from "./state.js";

const utf8Encoder: TextEncoder = new globalThis.TextEncoder();
const utf8Decoder: TextDecoder = new globalThis.TextDecoder("utf-8");

const byteLen = (s: string): int => utf8Encoder.encode(s).length;
const byteAt = (s: string, i: int): int => utf8Encoder.encode(s)[i]!;
const byteSlice = (s: string, start: int, end?: int): string => {
  const bytes = utf8Encoder.encode(s);
  return utf8Decoder.decode(bytes.subarray(start, end));
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::newParser","kind":"func","status":"implemented","sigHash":"e8799413d77acc7643df3b0c789d3524ab29dc535207b91246362c4eacd2aeb8","bodyHash":"b4fa9b078df3485406fee29b38d0132dedfa4b1351c81b1d99b15963d5fdf489"}
 *
 * Go source:
 * func newParser() *Parser {
 * 	res := &Parser{}
 * 	res.initializeClosures()
 * 	return res
 * }
 */
export function newParser(): GoPtr<Parser> {
  const res = {} as Parser;
  Parser_initializeClosures(res);
  return res;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::getParser","kind":"func","status":"implemented","sigHash":"78d7c4f910a3907e78fe0ff833535921ed57de947a1d9563f3d4b36008850cca","bodyHash":"409ea3c275529d58b9d335b8d3fd8b40a6b20d1d82aa20d9f3b16b7ad798d25e"}
 *
 * Go source:
 * func getParser() *Parser {
 * 	return parserPool.Get().(*Parser)
 * }
 */
export function getParser(): GoPtr<Parser> {
  if (parserPool.New === undefined) {
    parserPool.New = () => newParser() as Parser;
  }
  return parserPool.Get() as GoPtr<Parser>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::putParser","kind":"func","status":"implemented","sigHash":"46535a4faafd64b5af22ad73bba3dd1e339b74bb27c8d98f1f4432faaf94d116","bodyHash":"ca76b718da02842e1ebe182d957c74cbed96e619d90a7aebe732e1ca3d3ddc65"}
 *
 * Go source:
 * func putParser(p *Parser) {
 * 	*p = Parser{scanner: p.scanner, setParentFromContext: p.setParentFromContext}
 * 	parserPool.Put(p)
 * }
 */
export function putParser(p: GoPtr<Parser>): void {
  const savedScanner = p!.scanner;
  const savedSetParentFromContext = p!.setParentFromContext;
  for (const key of Object.keys(p!)) {
    delete (p as unknown as Record<string, unknown>)[key];
  }
  p!.scanner = savedScanner;
  p!.setParentFromContext = savedSetParentFromContext;
  parserPool.Put(p!);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.initializeClosures","kind":"method","status":"implemented","sigHash":"b6624f92f5b6144ac42f91d565baf28e7b841f6bce99f685c3ef11fa5361b903","bodyHash":"1c7757339066219bd2344794beef288f1129c6723fcc0467a2c434959c48b0d9"}
 *
 * Go source:
 * func (p *Parser) initializeClosures() {
 * 	p.setParentFromContext = func(n *ast.Node) bool {
 * 		n.Parent = p.currentParent
 * 		return false
 * 	}
 * }
 */
export function Parser_initializeClosures(receiver: GoPtr<Parser>): void {
  receiver!.setParentFromContext = (n: GoPtr<Node>): bool => {
    n!.Parent = receiver!.currentParent;
    return false;
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isJavaScript","kind":"method","status":"implemented","sigHash":"7b01911127dc5f1dd58d3a9100774c49d670cc4bb258840ff35f252d8610a164","bodyHash":"38d6e622cb2ad9edc58b7dd997f4d9a48a2f4116c0ab6e104b655631ed283a44"}
 *
 * Go source:
 * func (p *Parser) isJavaScript() bool {
 * 	return p.scriptKind == core.ScriptKindJS || p.scriptKind == core.ScriptKindJSX
 * }
 */
export function Parser_isJavaScript(receiver: GoPtr<Parser>): bool {
  return receiver!.scriptKind === ScriptKindJS || receiver!.scriptKind === ScriptKindJSX;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJSONText","kind":"method","status":"implemented","sigHash":"98992b7c14d10fe5b33b0718801829ff7d8cd1f02fdfbc7d69454a2439a4875e","bodyHash":"d02742f26321c84d92e026e40b1f4fa01df6a574c46d844432e118560674f01e"}
 *
 * Go source:
 * func (p *Parser) parseJSONText() *ast.SourceFile {
 * 	pos := p.nodePos()
 * 	var statements *ast.NodeList
 * 	var eof *ast.TokenNode
 * 
 * 	if p.token == ast.KindEndOfFile {
 * 		statements = p.newNodeList(core.NewTextRange(pos, p.nodePos()), nil)
 * 		eof = p.parseTokenNode()
 * 	} else {
 * 		var expressions any // []*ast.Expression | *ast.Expression
 * 
 * 		for p.token != ast.KindEndOfFile {
 * 			var expression *ast.Expression
 * 			switch p.token {
 * 			case ast.KindOpenBracketToken:
 * 				expression = p.parseArrayLiteralExpression()
 * 			case ast.KindTrueKeyword, ast.KindFalseKeyword, ast.KindNullKeyword:
 * 				expression = p.parseTokenNode()
 * 			case ast.KindMinusToken:
 * 				if p.lookAhead(func(p *Parser) bool {
 * 					return p.nextToken() == ast.KindNumericLiteral && p.nextToken() != ast.KindColonToken
 * 				}) {
 * 					expression = p.parsePrefixUnaryExpression()
 * 				} else {
 * 					expression = p.parseObjectLiteralExpression()
 * 				}
 * 			case ast.KindNumericLiteral, ast.KindStringLiteral:
 * 				if p.lookAhead(func(p *Parser) bool { return p.nextToken() != ast.KindColonToken }) {
 * 					expression = p.parseLiteralExpression(false /*intern* /)
 * 					break
 * 				}
 * 				fallthrough
 * 			default:
 * 				expression = p.parseObjectLiteralExpression()
 * 			}
 * 
 * 			// Error recovery: collect multiple top-level expressions
 * 			if expressions != nil {
 * 				if es, ok := expressions.([]*ast.Expression); ok {
 * 					expressions = append(es, expression)
 * 				} else {
 * 					expressions = []*ast.Expression{expressions.(*ast.Expression), expression}
 * 				}
 * 			} else {
 * 				expressions = expression
 * 				if p.token != ast.KindEndOfFile {
 * 					p.parseErrorAtCurrentToken(diagnostics.Unexpected_token)
 * 				}
 * 			}
 * 		}
 * 
 * 		var expression *ast.Expression
 * 		if es, ok := expressions.([]*ast.Expression); ok {
 * 			expression = p.finishNode(p.factory.NewArrayLiteralExpression(p.newNodeList(core.NewTextRange(pos, p.nodePos()), es), false), pos)
 * 		} else {
 * 			expression = expressions.(*ast.Expression)
 * 		}
 * 		statement := p.finishNode(p.factory.NewExpressionStatement(expression), pos)
 * 		statements = p.newNodeList(core.NewTextRange(pos, p.nodePos()), []*ast.Node{statement})
 * 		eof = p.parseExpectedToken(ast.KindEndOfFile)
 * 	}
 * 	node := p.finishNode(p.factory.NewSourceFile(p.opts, p.sourceText, statements, eof), pos)
 * 	result := node.AsSourceFile()
 * 	if len(result.Statements.Nodes) > 0 {
 * 		p.validateJsonValue(result, result.Statements.Nodes[0].Expression())
 * 	}
 * 	p.finishSourceFile(result, false)
 * 	return result
 * }
 */
export function Parser_parseJSONText(receiver: GoPtr<Parser>): GoPtr<SourceFile> {
  const pos = Parser_nodePos(receiver);
  let statements: GoPtr<NodeList>;
  let eof: GoPtr<TokenNode>;

  if (receiver!.token === KindEndOfFile) {
    statements = Parser_newNodeList(receiver, NewTextRange(pos, Parser_nodePos(receiver)), []);
    eof = Parser_parseTokenNode(receiver);
  } else {
    // expressions holds either GoPtr<Node> (single) or GoSlice<GoPtr<Node>> (multiple)
    let expressions: GoPtr<Node> | GoSlice<GoPtr<Node>> | undefined = undefined;

    while (receiver!.token !== KindEndOfFile) {
      let expression: GoPtr<Node>;
      switch (receiver!.token) {
        case KindOpenBracketToken:
          expression = Parser_parseArrayLiteralExpression(receiver);
          break;
        case KindTrueKeyword:
        case KindFalseKeyword:
        case KindNullKeyword:
          expression = Parser_parseTokenNode(receiver);
          break;
        case KindMinusToken:
          if (Parser_lookAhead(receiver, (p: GoPtr<Parser>): bool => {
            return Parser_nextToken(p) === KindNumericLiteral && Parser_nextToken(p) !== KindColonToken;
          })) {
            expression = Parser_parsePrefixUnaryExpression(receiver);
          } else {
            expression = Parser_parseObjectLiteralExpression(receiver);
          }
          break;
        case KindNumericLiteral:
        case KindStringLiteral:
          if (Parser_lookAhead(receiver, (p: GoPtr<Parser>): bool => Parser_nextToken(p) !== KindColonToken)) {
            expression = Parser_parseLiteralExpression(receiver, false /*intern*/);
            break;
          }
          // fallthrough to default
          expression = Parser_parseObjectLiteralExpression(receiver);
          break;
        default:
          expression = Parser_parseObjectLiteralExpression(receiver);
          break;
      }

      // Error recovery: collect multiple top-level expressions
      if (expressions !== undefined) {
        if (Array.isArray(expressions)) {
          (expressions as GoSlice<GoPtr<Node>>).push(expression);
        } else {
          expressions = [expressions as GoPtr<Node>, expression];
        }
      } else {
        expressions = expression;
        if (receiver!.token !== KindEndOfFile) {
          Parser_parseErrorAtCurrentToken(receiver, Unexpected_token);
        }
      }
    }

    let finalExpression: GoPtr<Node>;
    if (Array.isArray(expressions)) {
      finalExpression = Parser_finishNode(receiver, NewArrayLiteralExpression(receiver!.factory, Parser_newNodeList(receiver, NewTextRange(pos, Parser_nodePos(receiver)), expressions as GoSlice<GoPtr<Node>>), false), pos);
    } else {
      finalExpression = expressions as GoPtr<Node>;
    }
    const statement = Parser_finishNode(receiver, NewExpressionStatement(receiver!.factory, finalExpression), pos);
    statements = Parser_newNodeList(receiver, NewTextRange(pos, Parser_nodePos(receiver)), [statement]);
    eof = Parser_parseExpectedToken(receiver, KindEndOfFile);
  }
  const node = Parser_finishNode(receiver, NodeFactory_NewSourceFile(receiver!.factory, receiver!.opts, receiver!.sourceText, statements, eof), pos);
  const result = AsSourceFile(node);
  if ((result!.Statements!.Nodes ?? []).length > 0) {
    Parser_validateJsonValue(receiver, result, Node_Expression(result!.Statements!.Nodes[0]));
  }
  Parser_finishSourceFile(receiver, result, false);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.validateJsonValue","kind":"method","status":"implemented","sigHash":"c1bc63cc5d886fa49baaca003f0c8b1b2d30a513f713ae1258258211593f7a7d","bodyHash":"809548f13a1bd69b3a99b9fd72f84a3e3cfb37d75312b065f1bbb2dff2e13924"}
 *
 * Go source:
 * func (p *Parser) validateJsonValue(sourceFile *ast.SourceFile, valueExpression *ast.Expression) {
 * 	if valueExpression == nil {
 * 		return
 * 	}
 * 	switch valueExpression.Kind {
 * 	case ast.KindTrueKeyword, ast.KindFalseKeyword, ast.KindNullKeyword, ast.KindNumericLiteral:
 * 		return
 * 	case ast.KindStringLiteral:
 * 		if !isDoubleQuotedString(valueExpression) {
 * 			p.diagnostics = append(p.diagnostics, ast.NewDiagnostic(sourceFile, getErrorSpanForNode(p.sourceText, valueExpression), diagnostics.String_literal_with_double_quotes_expected))
 * 		}
 * 		return
 * 	case ast.KindPrefixUnaryExpression:
 * 		if valueExpression.AsPrefixUnaryExpression().Operator != ast.KindMinusToken || valueExpression.AsPrefixUnaryExpression().Operand.Kind != ast.KindNumericLiteral {
 * 			break // not valid JSON syntax
 * 		}
 * 		return
 * 	case ast.KindObjectLiteralExpression:
 * 		p.validateJsonObjectLiteral(sourceFile, valueExpression.AsObjectLiteralExpression())
 * 		return
 * 	case ast.KindArrayLiteralExpression:
 * 		for _, element := range valueExpression.Elements() {
 * 			p.validateJsonValue(sourceFile, element)
 * 		}
 * 		return
 * 	}
 * 	p.diagnostics = append(p.diagnostics, ast.NewDiagnostic(sourceFile, getErrorSpanForNode(p.sourceText, valueExpression), diagnostics.Property_value_can_only_be_string_literal_numeric_literal_true_false_null_object_literal_or_array_literal))
 * }
 */
export function Parser_validateJsonValue(receiver: GoPtr<Parser>, sourceFile: GoPtr<SourceFile>, valueExpression: GoPtr<Expression>): void {
  if (valueExpression === undefined) {
    return;
  }
  switch (valueExpression!.Kind) {
    case KindTrueKeyword:
    case KindFalseKeyword:
    case KindNullKeyword:
    case KindNumericLiteral:
      return;
    case KindStringLiteral:
      if (!isDoubleQuotedString(valueExpression)) {
        receiver!.diagnostics = [...receiver!.diagnostics, NewDiagnostic(sourceFile, getErrorSpanForNode(receiver!.sourceText, valueExpression), String_literal_with_double_quotes_expected)];
      }
      return;
    case KindPrefixUnaryExpression: {
      const prefixUnary = AsPrefixUnaryExpression(valueExpression);
      if (prefixUnary!.Operator !== KindMinusToken || prefixUnary!.Operand!.Kind !== KindNumericLiteral) {
        break; // not valid JSON syntax
      }
      return;
    }
    case KindObjectLiteralExpression:
      Parser_validateJsonObjectLiteral(receiver, sourceFile, AsObjectLiteralExpression(valueExpression));
      return;
    case KindArrayLiteralExpression:
      for (const element of (Node_Elements(valueExpression) ?? [])) {
        Parser_validateJsonValue(receiver, sourceFile, element);
      }
      return;
  }
  receiver!.diagnostics = [...receiver!.diagnostics, NewDiagnostic(sourceFile, getErrorSpanForNode(receiver!.sourceText, valueExpression), Property_value_can_only_be_string_literal_numeric_literal_true_false_null_object_literal_or_array_literal)];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::ParseIsolatedEntityName","kind":"func","status":"implemented","sigHash":"f3f6308ce9de35f5ecc741b1fc906c1dd662ef7bf3f986baeeb1e88c15f744ef","bodyHash":"f547f09680715774a994ffe5d834960dd3600bdc0fa713df3828fa00dade2fbe"}
 *
 * Go source:
 * func ParseIsolatedEntityName(text string) *ast.EntityName {
 * 	p := getParser()
 * 	defer putParser(p)
 * 	p.initializeState(ast.SourceFileParseOptions{}, text, core.ScriptKindJS)
 * 	p.nextToken()
 * 	entityName := p.parseEntityName(true, nil)
 * 	return core.IfElse(p.token == ast.KindEndOfFile && len(p.diagnostics) == 0, entityName, nil)
 * }
 */
export function ParseIsolatedEntityName(text: string): GoPtr<EntityName> {
  const p = getParser();
  // defer putParser(p) - handled via finally
  try {
    Parser_initializeState(p, {} as SourceFileParseOptions, text, ScriptKindJS);
    Parser_nextToken(p);
    const entityName = Parser_parseEntityName(p, true, undefined);
    return (p!.token === KindEndOfFile && p!.diagnostics.length === 0) ? entityName as GoPtr<EntityName> : undefined;
  } finally {
    putParser(p);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.initializeState","kind":"method","status":"implemented","sigHash":"78a1f5198066a26f6eac3eb82332c5acf3eae9fcf9c6688554bada36e8123da1","bodyHash":"07e2387a5f26833678c4537b2ce3d8e6bcbf260d3be73629536c6a66e72059a3"}
 *
 * Go source:
 * func (p *Parser) initializeState(opts ast.SourceFileParseOptions, sourceText string, scriptKind core.ScriptKind) {
 * 	if scriptKind == core.ScriptKindUnknown {
 * 		panic("ScriptKind must be specified when parsing source file: " + opts.FileName)
 * 	}
 * 
 * 	if p.scanner == nil {
 * 		p.scanner = scanner.NewScanner()
 * 	} else {
 * 		p.scanner.Reset()
 * 	}
 * 	p.opts = opts
 * 	p.sourceText = sourceText
 * 	p.scriptKind = scriptKind
 * 	p.languageVariant = getLanguageVariant(p.scriptKind)
 * 	switch p.scriptKind {
 * 	case core.ScriptKindJS, core.ScriptKindJSX:
 * 		p.contextFlags = ast.NodeFlagsJavaScriptFile
 * 	case core.ScriptKindJSON:
 * 		p.contextFlags = ast.NodeFlagsJavaScriptFile | ast.NodeFlagsJsonFile
 * 	default:
 * 		p.contextFlags = ast.NodeFlagsNone
 * 	}
 * 	p.scanner.SetText(p.sourceText)
 * 	p.scanner.SetOnError(p.scanError)
 * 	p.scanner.SetLanguageVariant(p.languageVariant)
 * }
 */
export function Parser_initializeState(receiver: GoPtr<Parser>, opts: SourceFileParseOptions, sourceText: string, scriptKind: ScriptKind): void {
  if (scriptKind === ScriptKindUnknown) {
    throw new globalThis.Error("ScriptKind must be specified when parsing source file: " + opts.FileName);
  }

  receiver!.factory = NewNodeFactory({})!;
  receiver!.diagnostics = [];
  receiver!.jsDiagnostics = [];
  receiver!.jsdocDiagnostics = [];
  receiver!.token = KindUnknown;
  receiver!.sourceFlags = NodeFlagsNone;
  receiver!.parsingContexts = 0 as ParsingContexts;
  receiver!.statementHasAwaitIdentifier = false;
  receiver!.hasDeprecatedTag = false;
  receiver!.hasParseError = false;
  receiver!.identifiers = undefined as unknown as GoMap<string, string>;
  receiver!.identifierCount = 0 as int;
  receiver!.notParenthesizedArrow = NewSetWithSizeHint<int>(0 as int) as Set;
  receiver!.nodeSliceArena = { data: [] } as Arena<GoPtr<Node>>;
  receiver!.stringSliceArena = { data: [] } as Arena<string>;
  receiver!.jsdocInfos = [];
  receiver!.possibleAwaitSpans = [];
  receiver!.jsdocCommentsSpace = [];
  receiver!.jsdocCommentRangesSpace = [];
  receiver!.jsdocTagCommentsSpace = [];
  receiver!.jsdocTagCommentsPartsSpace = [];
  receiver!.reparseList = [];
  receiver!.commonJSModuleIndicator = undefined;
  receiver!.currentParent = undefined;
  receiver!.reparsedClones = [];

  if (receiver!.scanner === undefined) {
    receiver!.scanner = NewScanner();
  } else {
    Scanner_Reset(receiver!.scanner);
  }
  receiver!.opts = opts;
  receiver!.sourceText = sourceText;
  receiver!.scriptKind = scriptKind;
  receiver!.languageVariant = getLanguageVariant(receiver!.scriptKind);
  switch (receiver!.scriptKind) {
    case ScriptKindJS:
    case ScriptKindJSX:
      receiver!.contextFlags = NodeFlagsJavaScriptFile;
      break;
    case ScriptKindJSON:
      receiver!.contextFlags = NodeFlagsJavaScriptFile | NodeFlagsJsonFile;
      break;
    default:
      receiver!.contextFlags = NodeFlagsNone;
  }
  Scanner_SetText(receiver!.scanner, receiver!.sourceText);
  Scanner_SetOnError(receiver!.scanner, (message: GoPtr<Message>, pos: int, length: int, ...args: Array<unknown>): void => Parser_scanError(receiver, message, pos, length, ...args));
  Scanner_SetLanguageVariant(receiver!.scanner, receiver!.languageVariant);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.mark","kind":"method","status":"implemented","sigHash":"95e83b549f3c36e10fa26404c03a10bad801b1d7394f11ab73aae5e388e01e50","bodyHash":"9091aca6f818a66049160fa432a7f339a55b2f531838c26c10937ac28622239d"}
 *
 * Go source:
 * func (p *Parser) mark() ParserState {
 * 	return ParserState{
 * 		scannerState:                p.scanner.Mark(),
 * 		contextFlags:                p.contextFlags,
 * 		diagnosticsLen:              len(p.diagnostics),
 * 		jsDiagnosticsLen:            len(p.jsDiagnostics),
 * 		jsdocInfosLen:               len(p.jsdocInfos),
 * 		reparsedClonesLen:           len(p.reparsedClones),
 * 		statementHasAwaitIdentifier: p.statementHasAwaitIdentifier,
 * 		hasParseError:               p.hasParseError,
 * 	}
 * }
 */
export function Parser_mark(receiver: GoPtr<Parser>): ParserState {
  return {
    scannerState: Scanner_Mark(receiver!.scanner),
    contextFlags: receiver!.contextFlags,
    diagnosticsLen: receiver!.diagnostics.length,
    jsDiagnosticsLen: receiver!.jsDiagnostics.length,
    jsdocInfosLen: receiver!.jsdocInfos.length,
    reparsedClonesLen: receiver!.reparsedClones.length,
    statementHasAwaitIdentifier: receiver!.statementHasAwaitIdentifier,
    hasParseError: receiver!.hasParseError,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.rewind","kind":"method","status":"implemented","sigHash":"73f3413f1640395dcc714c3f80423ad2553eca1ad6918b7dd132cc52485494b2","bodyHash":"b903af5255f9f00b7d9ff99503973d249414de78f3900c17bd2208d321dfcb17"}
 *
 * Go source:
 * func (p *Parser) rewind(state ParserState) {
 * 	p.scanner.Rewind(state.scannerState)
 * 	p.token = p.scanner.Token()
 * 	p.contextFlags = state.contextFlags
 * 	p.diagnostics = p.diagnostics[0:state.diagnosticsLen]
 * 	p.jsDiagnostics = p.jsDiagnostics[0:state.jsDiagnosticsLen]
 * 	p.jsdocInfos = p.jsdocInfos[0:state.jsdocInfosLen]
 * 	p.reparsedClones = p.reparsedClones[0:state.reparsedClonesLen]
 * 	p.statementHasAwaitIdentifier = state.statementHasAwaitIdentifier
 * 	p.hasParseError = state.hasParseError
 * }
 */
export function Parser_rewind(receiver: GoPtr<Parser>, state: ParserState): void {
  Scanner_Rewind(receiver!.scanner, state.scannerState);
  receiver!.token = Scanner_Token(receiver!.scanner);
  receiver!.contextFlags = state.contextFlags;
  receiver!.diagnostics = receiver!.diagnostics.slice(0, state.diagnosticsLen);
  receiver!.jsDiagnostics = receiver!.jsDiagnostics.slice(0, state.jsDiagnosticsLen);
  receiver!.jsdocInfos = receiver!.jsdocInfos.slice(0, state.jsdocInfosLen);
  receiver!.reparsedClones = receiver!.reparsedClones.slice(0, state.reparsedClonesLen);
  receiver!.statementHasAwaitIdentifier = state.statementHasAwaitIdentifier;
  receiver!.hasParseError = state.hasParseError;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.lookAhead","kind":"method","status":"implemented","sigHash":"da1c2cf0129680408d211b654352ca96cf961f5cddc36da5a52918d9a9aa4562","bodyHash":"370338f6b8bba780899ec770e4e231b8efb8409af0bb931c7700bba5fb156098"}
 *
 * Go source:
 * func (p *Parser) lookAhead(callback func(p *Parser) bool) bool {
 * 	state := p.mark()
 * 	result := callback(p)
 * 	p.rewind(state)
 * 	return result
 * }
 */
export function Parser_lookAhead(receiver: GoPtr<Parser>, callback: (p: GoPtr<Parser>) => bool): bool {
  const state = Parser_mark(receiver);
  const result = callback(receiver);
  Parser_rewind(receiver, state);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nodePos","kind":"method","status":"implemented","sigHash":"8a2611e00020e66e7b547b77a70acaa2e1f729218ee86df2df736c9194577094","bodyHash":"d766da3815e7cb072bf0886d368ebaebf14e0236fa659bcab441562f60965405"}
 *
 * Go source:
 * func (p *Parser) nodePos() int {
 * 	return p.scanner.TokenFullStart()
 * }
 */
export function Parser_nodePos(receiver: GoPtr<Parser>): int {
  return Scanner_TokenFullStart(receiver!.scanner);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseOptional","kind":"method","status":"implemented","sigHash":"2a77a2b081c34e53cc418e0719d1e7ef66ec8e86e6ce9e4e0eaa0f28ef14eecf","bodyHash":"9dcee26a937c1053c3110d6b17b7e56428e3d9a75262f287b6714ede7b8cf1eb"}
 *
 * Go source:
 * func (p *Parser) parseOptional(token ast.Kind) bool {
 * 	if p.token == token {
 * 		p.nextToken()
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Parser_parseOptional(receiver: GoPtr<Parser>, token: Kind): bool {
  if (receiver!.token === token) {
    Parser_nextToken(receiver);
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::isDeclareModifier","kind":"func","status":"implemented","sigHash":"c82aa644d413bd544b210f71e29c2f8dd49328e263e317820ddc4cb64a285c73","bodyHash":"1346adb17ff83d09f354848b6568790d7c0edb6ae459efdc51de115e7f7c6860"}
 *
 * Go source:
 * func isDeclareModifier(modifier *ast.Node) bool {
 * 	return modifier.Kind == ast.KindDeclareKeyword
 * }
 */
export function isDeclareModifier(modifier: GoPtr<Node>): bool {
  return modifier!.Kind === KindDeclareKeyword;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseCaseClause","kind":"method","status":"implemented","sigHash":"ff64633be2f41a8cb9b2683362e488f0f8a131f1370a369552d5bbb2ae47b0f1","bodyHash":"9839b4f80c007a5ec1a93aa655c379967f130f324e2e377800387fe8d1f85518"}
 *
 * Go source:
 * func (p *Parser) parseCaseClause() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindCaseKeyword)
 * 	expression := p.parseExpressionAllowIn()
 * 	p.parseExpected(ast.KindColonToken)
 * 	statements := p.parseList(PCSwitchClauseStatements, (*Parser).parseStatement)
 * 	result := p.finishNode(p.factory.NewCaseOrDefaultClause(ast.KindCaseClause, expression, statements), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseCaseClause(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindCaseKeyword);
  const expression = Parser_parseExpressionAllowIn(receiver);
  Parser_parseExpected(receiver, KindColonToken);
  const statements = Parser_parseList(receiver, PCSwitchClauseStatements, Parser_parseStatement);
  const result = Parser_finishNode(receiver, NewCaseOrDefaultClause(receiver!.factory, KindCaseClause, expression, statements), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseDefaultClause","kind":"method","status":"implemented","sigHash":"0b4ff7b0f7366dc9d9886aca46a9bb4e1179484bede6c84bd1def1f6f11768ab","bodyHash":"c38783da20da5049e816a61c1472e162b02efd20bfdba0e252b3a626a00ee4c3"}
 *
 * Go source:
 * func (p *Parser) parseDefaultClause() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindDefaultKeyword)
 * 	p.parseExpected(ast.KindColonToken)
 * 	statements := p.parseList(PCSwitchClauseStatements, (*Parser).parseStatement)
 * 	result := p.finishNode(p.factory.NewCaseOrDefaultClause(ast.KindDefaultClause, nil /*expression* /, statements), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseDefaultClause(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindDefaultKeyword);
  Parser_parseExpected(receiver, KindColonToken);
  const statements = Parser_parseList(receiver, PCSwitchClauseStatements, Parser_parseStatement);
  const result = Parser_finishNode(receiver, NewCaseOrDefaultClause(receiver!.factory, KindDefaultClause, undefined /*expression*/, statements), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseCaseOrDefaultClause","kind":"method","status":"implemented","sigHash":"e5fc6f6d3ed17ae0c02394747d33eef7dca2e5035164120b2d86bbdc5adcf33c","bodyHash":"abe5c75e5ad592a28ab591a78962dc7269f4d901da13bf272d537adc35f3d223"}
 *
 * Go source:
 * func (p *Parser) parseCaseOrDefaultClause() *ast.Node {
 * 	if p.token == ast.KindCaseKeyword {
 * 		return p.parseCaseClause()
 * 	}
 * 	return p.parseDefaultClause()
 * }
 */
export function Parser_parseCaseOrDefaultClause(receiver: GoPtr<Parser>): GoPtr<Node> {
  if (receiver!.token === KindCaseKeyword) {
    return Parser_parseCaseClause(receiver);
  }
  return Parser_parseDefaultClause(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseInitializer","kind":"method","status":"implemented","sigHash":"1f153a5b075594a3ff3ea952a3485157a7f40a0d62786d207a0a23a505481baf","bodyHash":"ffed2d0c5aa837ef45a7989d74e0d425b1d61bcace3fe9d6d22959ae17b4d1bd"}
 *
 * Go source:
 * func (p *Parser) parseInitializer() *ast.Expression {
 * 	if p.parseOptional(ast.KindEqualsToken) {
 * 		return p.parseAssignmentExpressionOrHigher()
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseInitializer(receiver: GoPtr<Parser>): GoPtr<Expression> {
  if (Parser_parseOptional(receiver, KindEqualsToken)) {
    return Parser_parseAssignmentExpressionOrHigher(receiver);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isImplementsClause","kind":"method","status":"implemented","sigHash":"3f1d6aa2af067edc8a95af273ed3c089c97847187ebccca88c7332d947601cc2","bodyHash":"092980f42f114eeaf1170513a7452e066811b7dd840b6ce7b64785702d72d31c"}
 *
 * Go source:
 * func (p *Parser) isImplementsClause() bool {
 * 	return p.token == ast.KindImplementsKeyword && p.lookAhead((*Parser).nextTokenIsIdentifierOrKeyword)
 * }
 */
export function Parser_isImplementsClause(receiver: GoPtr<Parser>): bool {
  return receiver!.token === KindImplementsKeyword && Parser_lookAhead(receiver, Parser_nextTokenIsIdentifierOrKeyword);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::isAsyncModifier","kind":"func","status":"implemented","sigHash":"7dbb6eebcc3a9775af92e0024dc8fa4208896c97329462a7d231bc9b9ae93a1e","bodyHash":"e92625755315939da645d816c408a55f4daf0419aa65b9f2dc2f468a0372d4b4"}
 *
 * Go source:
 * func isAsyncModifier(modifier *ast.Node) bool {
 * 	return modifier.Kind == ast.KindAsyncKeyword
 * }
 */
export function isAsyncModifier(modifier: GoPtr<Node>): bool {
  return modifier!.Kind === KindAsyncKeyword;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseSemicolonAfterPropertyName","kind":"method","status":"implemented","sigHash":"a4d5aa41e3aedfb69cd5061c723f6cf752626f7ff7aafe62b209d320901b3ba2","bodyHash":"e33fcda7de0de6129143a26ff20b227fee9e09ac69b54d3ce01d837a1f2e81cc"}
 *
 * Go source:
 * func (p *Parser) parseSemicolonAfterPropertyName(name *ast.Node, typeNode *ast.TypeNode, initializer *ast.Expression) {
 * 	if p.token == ast.KindAtToken && !p.hasPrecedingLineBreak() {
 * 		p.parseErrorAtCurrentToken(diagnostics.Decorators_must_precede_the_name_and_all_keywords_of_property_declarations)
 * 		return
 * 	}
 * 	if p.token == ast.KindOpenParenToken {
 * 		p.parseErrorAtCurrentToken(diagnostics.Cannot_start_a_function_call_in_a_type_annotation)
 * 		p.nextToken()
 * 		return
 * 	}
 * 	if typeNode != nil && !p.canParseSemicolon() {
 * 		if initializer != nil {
 * 			p.parseErrorAtCurrentToken(diagnostics.X_0_expected, scanner.TokenToString(ast.KindSemicolonToken))
 * 		} else {
 * 			p.parseErrorAtCurrentToken(diagnostics.Expected_for_property_initializer)
 * 		}
 * 		return
 * 	}
 * 	if p.tryParseSemicolon() {
 * 		return
 * 	}
 * 	if initializer != nil {
 * 		p.parseErrorAtCurrentToken(diagnostics.X_0_expected, scanner.TokenToString(ast.KindSemicolonToken))
 * 		return
 * 	}
 * 	p.parseErrorForMissingSemicolonAfter(name)
 * }
 */
export function Parser_parseSemicolonAfterPropertyName(receiver: GoPtr<Parser>, name: GoPtr<Node>, typeNode: GoPtr<TypeNode>, initializer: GoPtr<Expression>): void {
  if (receiver!.token === KindAtToken && !Parser_hasPrecedingLineBreak(receiver)) {
    Parser_parseErrorAtCurrentToken(receiver, Decorators_must_precede_the_name_and_all_keywords_of_property_declarations);
    return;
  }
  if (receiver!.token === KindOpenParenToken) {
    Parser_parseErrorAtCurrentToken(receiver, Cannot_start_a_function_call_in_a_type_annotation);
    Parser_nextToken(receiver);
    return;
  }
  if (typeNode !== undefined && !Parser_canParseSemicolon(receiver)) {
    if (initializer !== undefined) {
      Parser_parseErrorAtCurrentToken(receiver, X_0_expected, TokenToString(KindSemicolonToken));
    } else {
      Parser_parseErrorAtCurrentToken(receiver, Expected_for_property_initializer);
    }
    return;
  }
  if (Parser_tryParseSemicolon(receiver)) {
    return;
  }
  if (initializer !== undefined) {
    Parser_parseErrorAtCurrentToken(receiver, X_0_expected, TokenToString(KindSemicolonToken));
    return;
  }
  Parser_parseErrorForMissingSemicolonAfter(receiver, name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::getSpaceSuggestion","kind":"func","status":"implemented","sigHash":"38bffe1a1b4966d18c07ce04ddd3cc38150beaee03868afa33ef40bd60fceb3c","bodyHash":"b7c5d895b3ca1b9e9fb81faaeedc48cc2a93457a22ca0caa430b3e980c166bca"}
 *
 * Go source:
 * func getSpaceSuggestion(expressionText string) string {
 * 	for _, keyword := range viableKeywordSuggestions {
 * 		if len(expressionText) > len(keyword)+2 && strings.HasPrefix(expressionText, keyword) {
 * 			return keyword + " " + expressionText[len(keyword):]
 * 		}
 * 	}
 * 	return ""
 * }
 */
export function getSpaceSuggestion(expressionText: string): string {
  for (const keyword of viableKeywordSuggestions as GoSlice<string>) {
    if (expressionText.length > keyword.length + 2 && expressionText.startsWith(keyword)) {
      return keyword + " " + expressionText.slice(keyword.length);
    }
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseEntityName","kind":"method","status":"implemented","sigHash":"b89a1153139a9729fcfc99fd701e998114ae7544414d7075004097cba1874081","bodyHash":"595a1a34974091f19beba102c80c388cfb206d2c8819018afe3c76fadbfa2f8a"}
 *
 * Go source:
 * func (p *Parser) parseEntityName(allowReservedWords bool, diagnosticMessage *diagnostics.Message) *ast.Node {
 * 	pos := p.nodePos()
 * 	var entity *ast.Node
 * 	if allowReservedWords {
 * 		entity = p.parseIdentifierNameWithDiagnostic(diagnosticMessage)
 * 	} else {
 * 		entity = p.parseIdentifierWithDiagnostic(diagnosticMessage, nil)
 * 	}
 * 	for p.parseOptional(ast.KindDotToken) {
 * 		if p.token == ast.KindLessThanToken {
 * 			// The entity is part of a JSDoc-style generic. We will use the gap between `typeName` and
 * 			// `typeArguments` to report it as a grammar error in the checker.
 * 			break
 * 		}
 * 		entity = p.finishNode(p.factory.NewQualifiedName(entity, p.parseRightSideOfDot(allowReservedWords, false /*allowPrivateIdentifiers* /, true /*allowUnicodeEscapeSequenceInIdentifierName* /)), pos)
 * 	}
 * 	return entity
 * }
 */
export function Parser_parseEntityName(receiver: GoPtr<Parser>, allowReservedWords: bool, diagnosticMessage: GoPtr<Message>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  // entity is rebound through the qualified-name loop; Go reassigns the local.
  const initialEntity = allowReservedWords ? Parser_parseIdentifierNameWithDiagnostic(receiver, diagnosticMessage) : Parser_parseIdentifierWithDiagnostic(receiver, diagnosticMessage, undefined);
  const loop = (entity: GoPtr<Node>): GoPtr<Node> => {
    if (!Parser_parseOptional(receiver, KindDotToken)) {
      return entity;
    }
    if (receiver!.token === KindLessThanToken) {
      // The entity is part of a JSDoc-style generic. We will use the gap between `typeName` and
      // `typeArguments` to report it as a grammar error in the checker.
      return entity;
    }
    const next = Parser_finishNode(receiver, NewQualifiedName(receiver!.factory, entity, Parser_parseRightSideOfDot(receiver, allowReservedWords, false /*allowPrivateIdentifiers*/, true /*allowUnicodeEscapeSequenceInIdentifierName*/)), pos);
    return loop(next);
  };
  return loop(initialEntity);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseParameter","kind":"method","status":"implemented","sigHash":"d188380143a1cbc79da292b3bb7cc1b40bb5a157d3a2d40fae61c9e38784fcdd","bodyHash":"b5ef8c04a8f6d29eb9aeb79968f91b686431d45247794351694eea1b4a8148aa"}
 *
 * Go source:
 * func (p *Parser) parseParameter() *ast.Node {
 * 	return p.parseParameterEx(false /*inOuterAwaitContext* /, true /*allowAmbiguity* /)
 * }
 */
export function Parser_parseParameter(receiver: GoPtr<Parser>): GoPtr<Node> {
  return Parser_parseParameterEx(receiver, false /*inOuterAwaitContext*/, true /*allowAmbiguity*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseParameterEx","kind":"method","status":"implemented","sigHash":"72e2a56485b0a01916b2d77297834dffcc836341ee80eb96f3f183bd45ef6649","bodyHash":"20f161cd8c3add1388809b65ae0ffd0bdbe420c22dcee6d8183b1cf4333660fa"}
 *
 * Go source:
 * func (p *Parser) parseParameterEx(inOuterAwaitContext bool, allowAmbiguity bool) *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	// FormalParameter [Yield,Await]:
 * 	//      BindingElement[?Yield,?Await]
 * 	// Decorators are parsed in the outer [Await] context, the rest of the parameter is parsed in the function's [Await] context.
 * 	saveContextFlags := p.contextFlags
 * 	p.setContextFlags(ast.NodeFlagsAwaitContext, inOuterAwaitContext)
 * 	modifiers := p.parseModifiersEx(true /*allowDecorators* /, false /*permitConstAsModifier* /, false /*stopOnStartOfClassStaticBlock* /)
 * 	p.contextFlags = saveContextFlags
 * 	if p.token == ast.KindThisKeyword {
 * 		result := p.factory.NewParameterDeclaration(
 * 			modifiers,
 * 			nil, /*dotDotDotToken* /
 * 			p.createIdentifier(true /*isIdentifier* /),
 * 			nil, /*questionToken* /
 * 			p.parseTypeAnnotation(),
 * 			nil /*initializer* /)
 * 		if modifiers != nil {
 * 			p.parseErrorAtRange(modifiers.Nodes[0].Loc, diagnostics.Neither_decorators_nor_modifiers_may_be_applied_to_this_parameters)
 * 		}
 * 		p.withJSDoc(p.finishNode(result, pos), jsdoc)
 * 		return result
 * 	}
 * 	dotDotDotToken := p.parseOptionalToken(ast.KindDotDotDotToken)
 * 	if !allowAmbiguity && !p.isParameterNameStart() {
 * 		return nil
 * 	}
 * 	result := p.factory.NewParameterDeclaration(
 * 		modifiers,
 * 		dotDotDotToken,
 * 		p.parseNameOfParameter(modifiers),
 * 		p.parseOptionalToken(ast.KindQuestionToken),
 * 		p.parseTypeAnnotation(),
 * 		p.parseInitializer())
 * 	p.withJSDoc(p.finishNode(result, pos), jsdoc)
 * 	return result
 * }
 */
export function Parser_parseParameterEx(receiver: GoPtr<Parser>, inOuterAwaitContext: bool, allowAmbiguity: bool): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  // FormalParameter [Yield,Await]:
  //      BindingElement[?Yield,?Await]
  // Decorators are parsed in the outer [Await] context, the rest of the parameter is parsed in the function's [Await] context.
  const saveContextFlags = receiver!.contextFlags;
  Parser_setContextFlags(receiver, NodeFlagsAwaitContext, inOuterAwaitContext);
  const modifiers = Parser_parseModifiersEx(receiver, true /*allowDecorators*/, false /*permitConstAsModifier*/, false /*stopOnStartOfClassStaticBlock*/);
  receiver!.contextFlags = saveContextFlags;
  if (receiver!.token === KindThisKeyword) {
    const thisResult = NewParameterDeclaration(
      receiver!.factory,
      modifiers,
      undefined, /*dotDotDotToken*/
      Parser_createIdentifier(receiver, true /*isIdentifier*/),
      undefined, /*questionToken*/
      Parser_parseTypeAnnotation(receiver),
      undefined /*initializer*/,
    );
    if (modifiers !== undefined) {
      Parser_parseErrorAtRange(receiver, modifiers.Nodes[0]!.Loc, Neither_decorators_nor_modifiers_may_be_applied_to_this_parameters);
    }
    Parser_withJSDoc(receiver, Parser_finishNode(receiver, thisResult, pos), jsdoc);
    return thisResult;
  }
  const dotDotDotToken = Parser_parseOptionalToken(receiver, KindDotDotDotToken);
  if (!allowAmbiguity && !Parser_isParameterNameStart(receiver)) {
    return undefined;
  }
  const result = NewParameterDeclaration(
    receiver!.factory,
    modifiers,
    dotDotDotToken,
    Parser_parseNameOfParameter(receiver, modifiers),
    Parser_parseOptionalToken(receiver, KindQuestionToken),
    Parser_parseTypeAnnotation(receiver),
    Parser_parseInitializer(receiver),
  );
  Parser_withJSDoc(receiver, Parser_finishNode(receiver, result, pos), jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isParameterNameStart","kind":"method","status":"implemented","sigHash":"e402a2977349baac9d7b5f7f8d82b29791f4b90a4a58aec5799eff54c017ff52","bodyHash":"4e048ede754a9c3d3fd5e55e4fd246fd2ec480eb71534100f22a9d6a422dd78c"}
 *
 * Go source:
 * func (p *Parser) isParameterNameStart() bool {
 * 	// Be permissive about await and yield by calling isBindingIdentifier instead of isIdentifier; disallowing
 * 	// them during a speculative parse leads to many more follow-on errors than allowing the function to parse then later
 * 	// complaining about the use of the keywords.
 * 	return p.isBindingIdentifier() || p.token == ast.KindOpenBracketToken || p.token == ast.KindOpenBraceToken
 * }
 */
export function Parser_isParameterNameStart(receiver: GoPtr<Parser>): bool {
  // Be permissive about await and yield by calling isBindingIdentifier instead of isIdentifier; disallowing
  // them during a speculative parse leads to many more follow-on errors than allowing the function to parse then later
  // complaining about the use of the keywords.
  return Parser_isBindingIdentifier(receiver) || receiver!.token === KindOpenBracketToken || receiver!.token === KindOpenBraceToken;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseNameOfParameter","kind":"method","status":"implemented","sigHash":"3b7e4ad44747112a296b910e203673d0e1513f951ce8641a2b817ac3038f85f1","bodyHash":"ea1685b02af423cd85e25808ede126b442d6e13b383f054f62123f7de35c5b39"}
 *
 * Go source:
 * func (p *Parser) parseNameOfParameter(modifiers *ast.ModifierList) *ast.Node {
 * 	// FormalParameter [Yield,Await]:
 * 	//      BindingElement[?Yield,?Await]
 * 	name := p.parseIdentifierOrPatternWithDiagnostic(diagnostics.Private_identifiers_cannot_be_used_as_parameters)
 * 	if name.Loc.Len() == 0 && modifiers == nil && ast.IsModifierKind(p.token) {
 * 		// in cases like
 * 		// 'use strict'
 * 		// function foo(static)
 * 		// isParameter('static') == true, because of isModifier('static')
 * 		// however 'static' is not a legal identifier in a strict mode.
 * 		// so result of this function will be Parameter (flags = 0, name = missing, type = undefined, initializer = undefined)
 * 		// and current token will not change => parsing of the enclosing parameter list will last till the end of time (or OOM)
 * 		// to avoid this we'll advance cursor to the next token.
 * 		p.nextToken()
 * 	}
 * 	return name
 * }
 */
export function Parser_parseNameOfParameter(receiver: GoPtr<Parser>, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  // FormalParameter [Yield,Await]:
  //      BindingElement[?Yield,?Await]
  const name = Parser_parseIdentifierOrPatternWithDiagnostic(receiver, Private_identifiers_cannot_be_used_as_parameters);
  if (TextRange_Len(name!.Loc) === 0 && modifiers === undefined && IsModifierKind(receiver!.token)) {
    // in cases like
    // 'use strict'
    // function foo(static)
    // isParameter('static') == true, because of isModifier('static')
    // however 'static' is not a legal identifier in a strict mode.
    // so result of this function will be Parameter (flags = 0, name = missing, type = undefined, initializer = undefined)
    // and current token will not change => parsing of the enclosing parameter list will last till the end of time (or OOM)
    // to avoid this we'll advance cursor to the next token.
    Parser_nextToken(receiver);
  }
  return name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parsePropertyName","kind":"method","status":"implemented","sigHash":"96f1221e6d8d86b90361d0e43ef0ede995592792ac9f99eceb08baada4982a8b","bodyHash":"0e07bd2e119ccb23b558fea2b717b0c2175a58e821bbeb2e10e083fac276b668"}
 *
 * Go source:
 * func (p *Parser) parsePropertyName() *ast.Node {
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 	prop := p.parsePropertyNameWorker(true /*allowComputedPropertyNames* /)
 * 	p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 * 	return prop
 * }
 */
export function Parser_parsePropertyName(receiver: GoPtr<Parser>): GoPtr<Node> {
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
  const prop = Parser_parsePropertyNameWorker(receiver, true /*allowComputedPropertyNames*/);
  receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;
  return prop;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parsePropertyNameWorker","kind":"method","status":"implemented","sigHash":"81a22e7c064158a3704ba1bf7607cc5668c9416a0a44088e74ecce90d12420c4","bodyHash":"b9321c7f5c1f76a1f1c5d0750c30b0b14e9ca6ec91b124cf30ab60f88d6ceb97"}
 *
 * Go source:
 * func (p *Parser) parsePropertyNameWorker(allowComputedPropertyNames bool) *ast.Node {
 * 	if p.token == ast.KindStringLiteral || p.token == ast.KindNumericLiteral || p.token == ast.KindBigIntLiteral {
 * 		literal := p.parseLiteralExpression(true /*intern* /)
 * 		return literal
 * 	}
 * 	if allowComputedPropertyNames && p.token == ast.KindOpenBracketToken {
 * 		return p.parseComputedPropertyName()
 * 	}
 * 	if p.token == ast.KindPrivateIdentifier {
 * 		return p.parsePrivateIdentifier()
 * 	}
 * 	return p.parseIdentifierName()
 * }
 */
export function Parser_parsePropertyNameWorker(receiver: GoPtr<Parser>, allowComputedPropertyNames: bool): GoPtr<Node> {
  if (receiver!.token === KindStringLiteral || receiver!.token === KindNumericLiteral || receiver!.token === KindBigIntLiteral) {
    const literal = Parser_parseLiteralExpression(receiver, true /*intern*/);
    return literal;
  }
  if (allowComputedPropertyNames && receiver!.token === KindOpenBracketToken) {
    return Parser_parseComputedPropertyName(receiver);
  }
  if (receiver!.token === KindPrivateIdentifier) {
    return Parser_parsePrivateIdentifier(receiver);
  }
  return Parser_parseIdentifierName(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseComputedPropertyName","kind":"method","status":"implemented","sigHash":"7cc958c08f7b172729563b71540c1e370bffe6e5119fb0a1b0c4954e6fb14ad2","bodyHash":"a02131ab2578b570a303507678e81f12b7ff62967b3606533de9acc56254e8a5"}
 *
 * Go source:
 * func (p *Parser) parseComputedPropertyName() *ast.Node {
 * 	// PropertyName [Yield]:
 * 	//      LiteralPropertyName
 * 	//      ComputedPropertyName[?Yield]
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindOpenBracketToken)
 * 	// We parse any expression (including a comma expression). But the grammar
 * 	// says that only an assignment expression is allowed, so the grammar checker
 * 	// will error if it sees a comma expression.
 * 	expression := p.parseExpressionAllowIn()
 * 	p.parseExpected(ast.KindCloseBracketToken)
 * 	return p.finishNode(p.factory.NewComputedPropertyName(expression), pos)
 * }
 */
export function Parser_parseComputedPropertyName(receiver: GoPtr<Parser>): GoPtr<Node> {
  // PropertyName [Yield]:
  //      LiteralPropertyName
  //      ComputedPropertyName[?Yield]
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindOpenBracketToken);
  // We parse any expression (including a comma expression). But the grammar
  // says that only an assignment expression is allowed, so the grammar checker
  // will error if it sees a comma expression.
  const expression = Parser_parseExpressionAllowIn(receiver);
  Parser_parseExpected(receiver, KindCloseBracketToken);
  return Parser_finishNode(receiver, NewComputedPropertyName(receiver!.factory, expression), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isIndexSignature","kind":"method","status":"implemented","sigHash":"444d5c31aacc0a084b1862e2f90dd4819373289f04c8de766f090f5e53019166","bodyHash":"cfccd666880e75ec524c253c835d7ee93b448579cc3f26da5aefa373b292e8bc"}
 *
 * Go source:
 * func (p *Parser) isIndexSignature() bool {
 * 	return p.token == ast.KindOpenBracketToken && p.lookAhead((*Parser).nextIsUnambiguouslyIndexSignature)
 * }
 */
export function Parser_isIndexSignature(receiver: GoPtr<Parser>): bool {
  return receiver!.token === KindOpenBracketToken && Parser_lookAhead(receiver, Parser_nextIsUnambiguouslyIndexSignature);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextIsUnambiguouslyIndexSignature","kind":"method","status":"implemented","sigHash":"c01c7aa9edcd67345d0c0934e060733220b13333c37c0209cb59c7f8a497c921","bodyHash":"57c60b8ffd52029bf04ecc31dc5576623acbced86a278083cc9489774e60beb7"}
 *
 * Go source:
 * func (p *Parser) nextIsUnambiguouslyIndexSignature() bool {
 * 	// The only allowed sequence is:
 * 	//
 * 	//   [id:
 * 	//
 * 	// However, for error recovery, we also check the following cases:
 * 	//
 * 	//   [...
 * 	//   [id,
 * 	//   [id?,
 * 	//   [id?:
 * 	//   [id?]
 * 	//   [public id
 * 	//   [private id
 * 	//   [protected id
 * 	//   []
 * 	//
 * 	p.nextToken()
 * 	if p.token == ast.KindDotDotDotToken || p.token == ast.KindCloseBracketToken {
 * 		return true
 * 	}
 * 	if ast.IsModifierKind(p.token) {
 * 		p.nextToken()
 * 		if p.isIdentifier() {
 * 			return true
 * 		}
 * 	} else if !p.isIdentifier() {
 * 		return false
 * 	} else {
 * 		// Skip the identifier
 * 		p.nextToken()
 * 	}
 * 	// A colon signifies a well formed indexer
 * 	// A comma should be a badly formed indexer because comma expressions are not allowed
 * 	// in computed properties.
 * 	if p.token == ast.KindColonToken || p.token == ast.KindCommaToken {
 * 		return true
 * 	}
 * 	// Question mark could be an indexer with an optional property,
 * 	// or it could be a conditional expression in a computed property.
 * 	if p.token != ast.KindQuestionToken {
 * 		return false
 * 	}
 * 	// If any of the following tokens are after the question mark, it cannot
 * 	// be a conditional expression, so treat it as an indexer.
 * 	p.nextToken()
 * 	return p.token == ast.KindColonToken || p.token == ast.KindCommaToken || p.token == ast.KindCloseBracketToken
 * }
 */
export function Parser_nextIsUnambiguouslyIndexSignature(receiver: GoPtr<Parser>): bool {
  // The only allowed sequence is:
  //
  //   [id:
  //
  // However, for error recovery, we also check the following cases:
  //
  //   [...
  //   [id,
  //   [id?,
  //   [id?:
  //   [id?]
  //   [public id
  //   [private id
  //   [protected id
  //   []
  //
  Parser_nextToken(receiver);
  if (receiver!.token === KindDotDotDotToken || receiver!.token === KindCloseBracketToken) {
    return true;
  }
  if (IsModifierKind(receiver!.token)) {
    Parser_nextToken(receiver);
    if (Parser_isIdentifier(receiver)) {
      return true;
    }
  } else if (!Parser_isIdentifier(receiver)) {
    return false;
  } else {
    // Skip the identifier
    Parser_nextToken(receiver);
  }
  // A colon signifies a well formed indexer
  // A comma should be a badly formed indexer because comma expressions are not allowed
  // in computed properties.
  if (receiver!.token === KindColonToken || receiver!.token === KindCommaToken) {
    return true;
  }
  // Question mark could be an indexer with an optional property,
  // or it could be a conditional expression in a computed property.
  if (receiver!.token !== KindQuestionToken) {
    return false;
  }
  // If any of the following tokens are after the question mark, it cannot
  // be a conditional expression, so treat it as an indexer.
  Parser_nextToken(receiver);
  return receiver!.token === KindColonToken || receiver!.token === KindCommaToken || receiver!.token === KindCloseBracketToken;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parsePropertyOrMethodSignature","kind":"method","status":"implemented","sigHash":"6e27e42c83993800ebaf3ca0eaa454fdf78a804a6397012806ac9f078ed3112a","bodyHash":"45b95c8c375d2d0145563d77439e88ee697e09daf9cf785925d97f660e6a51ee"}
 *
 * Go source:
 * func (p *Parser) parsePropertyOrMethodSignature(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList) *ast.Node {
 * 	name := p.parsePropertyName()
 * 	questionToken := p.parseOptionalToken(ast.KindQuestionToken)
 * 	var result *ast.Node
 * 	if p.token == ast.KindOpenParenToken || p.token == ast.KindLessThanToken {
 * 		// Method signatures don't exist in expression contexts.  So they have neither
 * 		// [Yield] nor [Await]
 * 		typeParameters := p.parseTypeParameters()
 * 		parameters := p.parseParameters(ParseFlagsType)
 * 		returnType := p.parseReturnType(ast.KindColonToken /*isType* /, true)
 * 		result = p.factory.NewMethodSignatureDeclaration(modifiers, name, questionToken, typeParameters, parameters, returnType)
 * 	} else {
 * 		typeNode := p.parseTypeAnnotation()
 * 		// Although type literal properties cannot not have initializers, we attempt
 * 		// to parse an initializer so we can report in the checker that an interface
 * 		// property or type literal property cannot have an initializer.
 * 		var initializer *ast.Expression
 * 		if p.token == ast.KindEqualsToken {
 * 			initializer = p.parseInitializer()
 * 		}
 * 		result = p.factory.NewPropertySignatureDeclaration(modifiers, name, questionToken, typeNode, initializer)
 * 	}
 * 	p.parseTypeMemberSemicolon()
 * 	p.withJSDoc(p.finishNode(result, pos), jsdoc)
 * 	return result
 * }
 */
export function Parser_parsePropertyOrMethodSignature(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  const name = Parser_parsePropertyName(receiver);
  const questionToken = Parser_parseOptionalToken(receiver, KindQuestionToken);
  const result = ((): GoPtr<Node> => {
    if (receiver!.token === KindOpenParenToken || receiver!.token === KindLessThanToken) {
      // Method signatures don't exist in expression contexts.  So they have neither
      // [Yield] nor [Await]
      const typeParameters = Parser_parseTypeParameters(receiver);
      const parameters = Parser_parseParameters(receiver, ParseFlagsType);
      const returnType = Parser_parseReturnType(receiver, KindColonToken /*isType*/, true);
      return NewMethodSignatureDeclaration(receiver!.factory, modifiers, name, questionToken, typeParameters, parameters, returnType);
    }
    const typeNode = Parser_parseTypeAnnotation(receiver);
    // Although type literal properties cannot not have initializers, we attempt
    // to parse an initializer so we can report in the checker that an interface
    // property or type literal property cannot have an initializer.
    const initializer = receiver!.token === KindEqualsToken ? Parser_parseInitializer(receiver) : undefined;
    return NewPropertySignatureDeclaration(receiver!.factory, modifiers, name, questionToken, typeNode, initializer);
  })();
  Parser_parseTypeMemberSemicolon(receiver);
  Parser_withJSDoc(receiver, Parser_finishNode(receiver, result, pos), jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.skipParameterStart","kind":"method","status":"implemented","sigHash":"5c674a6dbf7cd6ae5b8673bc51efe8cce8fa7e102f8caaf6351d286ff950448f","bodyHash":"e1419c2b0777d2486e77b26134fce5ce6c0b1f85ead51fb9f0d480465473c9af"}
 *
 * Go source:
 * func (p *Parser) skipParameterStart() bool {
 * 	if ast.IsModifierKind(p.token) {
 * 		// Skip modifiers
 * 		p.parseModifiers()
 * 	}
 * 	p.parseOptional(ast.KindDotDotDotToken)
 * 	if p.isIdentifier() || p.token == ast.KindThisKeyword {
 * 		p.nextToken()
 * 		return true
 * 	}
 * 	if p.token == ast.KindOpenBracketToken || p.token == ast.KindOpenBraceToken {
 * 		// Return true if we can parse an array or object binding pattern with no errors
 * 		previousErrorCount := len(p.diagnostics)
 * 		p.parseIdentifierOrPattern()
 * 		return previousErrorCount == len(p.diagnostics)
 * 	}
 * 	return false
 * }
 */
export function Parser_skipParameterStart(receiver: GoPtr<Parser>): bool {
  if (IsModifierKind(receiver!.token)) {
    // Skip modifiers
    Parser_parseModifiers(receiver);
  }
  Parser_parseOptional(receiver, KindDotDotDotToken);
  if (Parser_isIdentifier(receiver) || receiver!.token === KindThisKeyword) {
    Parser_nextToken(receiver);
    return true;
  }
  if (receiver!.token === KindOpenBracketToken || receiver!.token === KindOpenBraceToken) {
    // Return true if we can parse an array or object binding pattern with no errors
    const previousErrorCount = receiver!.diagnostics.length;
    Parser_parseIdentifierOrPattern(receiver);
    return previousErrorCount === receiver!.diagnostics.length;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseModifiers","kind":"method","status":"implemented","sigHash":"8c2ece67da34082745bfd7cac6fa4b71ac113cf50138dbdc1603be4d849197c4","bodyHash":"c2f9e76ef09ec0ff02ff2aff914a31f1e8e950cae8bdf25b15ca99ef2473b4cd"}
 *
 * Go source:
 * func (p *Parser) parseModifiers() *ast.ModifierList {
 * 	return p.parseModifiersEx(false, false, false)
 * }
 */
export function Parser_parseModifiers(receiver: GoPtr<Parser>): GoPtr<ModifierList> {
  return Parser_parseModifiersEx(receiver, false, false, false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseModifiersEx","kind":"method","status":"implemented","sigHash":"bab179fa26eb8ebdb8ffadd8ad7b6c4b2878f46ff6c95db332a1a675e6c3cef2","bodyHash":"c661f7f30f47d437b657e8fc2d6a033ec7adfb8d27c0798600dd95c0cb06bf17"}
 *
 * Go source:
 * func (p *Parser) parseModifiersEx(allowDecorators bool, permitConstAsModifier bool, stopOnStartOfClassStaticBlock bool) *ast.ModifierList {
 * 	var hasLeadingModifier bool
 * 	var hasTrailingDecorator bool
 * 	var hasTrailingModifier bool
 * 	var hasStaticModifier bool
 * 	// Decorators should be contiguous in a list of modifiers but can potentially appear in two places (i.e., `[...leadingDecorators, ...leadingModifiers, ...trailingDecorators, ...trailingModifiers]`).
 * 	// The leading modifiers *should* only contain `export` and `default` when trailingDecorators are present, but we'll handle errors for any other leading modifiers in the checker.
 * 	// It is illegal to have both leadingDecorators and trailingDecorators, but we will report that as a grammar check in the checker.
 * 	// parse leading decorators
 * 	pos := p.nodePos()
 * 	list := make([]*ast.Node, 0, 16)
 * 	for {
 * 		if allowDecorators && p.token == ast.KindAtToken && !hasTrailingModifier {
 * 			decorator := p.parseDecorator()
 * 			list = append(list, decorator)
 * 			if hasLeadingModifier {
 * 				hasTrailingDecorator = true
 * 			}
 * 		} else {
 * 			modifier := p.tryParseModifier(hasStaticModifier, permitConstAsModifier, stopOnStartOfClassStaticBlock)
 * 			if modifier == nil {
 * 				break
 * 			}
 * 			if modifier.Kind == ast.KindStaticKeyword {
 * 				hasStaticModifier = true
 * 			}
 * 			list = append(list, modifier)
 * 			if hasTrailingDecorator {
 * 				hasTrailingModifier = true
 * 			} else {
 * 				hasLeadingModifier = true
 * 			}
 * 		}
 * 	}
 * 	if len(list) != 0 {
 * 		return p.newModifierList(core.NewTextRange(pos, p.nodePos()), p.nodeSliceArena.Clone(list))
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseModifiersEx(receiver: GoPtr<Parser>, allowDecorators: bool, permitConstAsModifier: bool, stopOnStartOfClassStaticBlock: bool): GoPtr<ModifierList> {
  let hasLeadingModifier = false;
  let hasTrailingDecorator = false;
  let hasTrailingModifier = false;
  let hasStaticModifier = false;
  // Decorators should be contiguous in a list of modifiers but can potentially appear in two places (i.e., `[...leadingDecorators, ...leadingModifiers, ...trailingDecorators, ...trailingModifiers]`).
  // The leading modifiers *should* only contain `export` and `default` when trailingDecorators are present, but we'll handle errors for any other leading modifiers in the checker.
  // It is illegal to have both leadingDecorators and trailingDecorators, but we will report that as a grammar check in the checker.
  // parse leading decorators
  const pos = Parser_nodePos(receiver);
  const list: GoSlice<GoPtr<Node>> = [];
  for (;;) {
    if (allowDecorators && receiver!.token === KindAtToken && !hasTrailingModifier) {
      const decorator = Parser_parseDecorator(receiver);
      list.push(decorator);
      if (hasLeadingModifier) {
        hasTrailingDecorator = true;
      }
    } else {
      const modifier = Parser_tryParseModifier(receiver, hasStaticModifier, permitConstAsModifier, stopOnStartOfClassStaticBlock);
      if (modifier === undefined) {
        break;
      }
      if (modifier!.Kind === KindStaticKeyword) {
        hasStaticModifier = true;
      }
      list.push(modifier);
      if (hasTrailingDecorator) {
        hasTrailingModifier = true;
      } else {
        hasLeadingModifier = true;
      }
    }
  }
  if (list.length !== 0) {
    return Parser_newModifierList(receiver, NewTextRange(pos, Parser_nodePos(receiver)), Arena_Clone(receiver!.nodeSliceArena as GoPtr<Arena<GoPtr<Node>>>, list));
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseDecorator","kind":"method","status":"implemented","sigHash":"9d1441c7ca3e878aaf5b263d86e80aafef6136d9a4c91d583ae9b1786c321207","bodyHash":"99d1a3ff6ba0bae7f89b71f294766367a53e3fa92831f298413045cb2501d921"}
 *
 * Go source:
 * func (p *Parser) parseDecorator() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindAtToken)
 * 	expression := doInContext(p, ast.NodeFlagsDecoratorContext, true, (*Parser).parseDecoratorExpression)
 * 	return p.finishNode(p.factory.NewDecorator(expression), pos)
 * }
 */
export function Parser_parseDecorator(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindAtToken);
  const expression = doInContext(receiver, NodeFlagsDecoratorContext, true, Parser_parseDecoratorExpression);
  return Parser_finishNode(receiver, NewDecorator(receiver!.factory, expression), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.tryParseModifier","kind":"method","status":"implemented","sigHash":"a8b4303378347ccc74e20fb08a0dee9588e577eea75be71ef556722fd41ab080","bodyHash":"d91a38208c4b93bbd1edd24fff6b8d9558a04df9efbd1ddaf681bf66a9525b5a"}
 *
 * Go source:
 * func (p *Parser) tryParseModifier(hasSeenStaticModifier bool, permitConstAsModifier bool, stopOnStartOfClassStaticBlock bool) *ast.Node {
 * 	pos := p.nodePos()
 * 	kind := p.token
 * 	if p.token == ast.KindConstKeyword && permitConstAsModifier {
 * 		// We need to ensure that any subsequent modifiers appear on the same line
 * 		// so that when 'const' is a standalone declaration, we don't issue an error.
 * 		if !p.lookAhead((*Parser).nextTokenIsOnSameLineAndCanFollowModifier) {
 * 			return nil
 * 		} else {
 * 			p.nextToken()
 * 		}
 * 	} else if stopOnStartOfClassStaticBlock && p.token == ast.KindStaticKeyword && p.lookAhead((*Parser).nextTokenIsOpenBrace) {
 * 		return nil
 * 	} else if hasSeenStaticModifier && p.token == ast.KindStaticKeyword {
 * 		return nil
 * 	} else {
 * 		if !p.parseAnyContextualModifier() {
 * 			return nil
 * 		}
 * 	}
 * 	return p.finishNode(p.factory.NewModifier(kind), pos)
 * }
 */
export function Parser_tryParseModifier(receiver: GoPtr<Parser>, hasSeenStaticModifier: bool, permitConstAsModifier: bool, stopOnStartOfClassStaticBlock: bool): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const kind = receiver!.token;
  if (receiver!.token === KindConstKeyword && permitConstAsModifier) {
    // We need to ensure that any subsequent modifiers appear on the same line
    // so that when 'const' is a standalone declaration, we don't issue an error.
    if (!Parser_lookAhead(receiver, Parser_nextTokenIsOnSameLineAndCanFollowModifier)) {
      return undefined;
    } else {
      Parser_nextToken(receiver);
    }
  } else if (stopOnStartOfClassStaticBlock && receiver!.token === KindStaticKeyword && Parser_lookAhead(receiver, Parser_nextTokenIsOpenBrace)) {
    return undefined;
  } else if (hasSeenStaticModifier && receiver!.token === KindStaticKeyword) {
    return undefined;
  } else {
    if (!Parser_parseAnyContextualModifier(receiver)) {
      return undefined;
    }
  }
  return Parser_finishNode(receiver, NodeFactory_NewModifier(receiver!.factory, kind), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.canFollowModifier","kind":"method","status":"implemented","sigHash":"d9af03e07613adfb57b5c104d241f9c3a60d8420ebd914c884ac1b32e99e3f52","bodyHash":"91c5c2d4d2bee9d19511ded68c2beb9017ad89a1f6e2b1d1cac7f77e6e712d65"}
 *
 * Go source:
 * func (p *Parser) canFollowModifier() bool {
 * 	return p.token == ast.KindOpenBracketToken || p.token == ast.KindOpenBraceToken || p.token == ast.KindAsteriskToken || p.token == ast.KindDotDotDotToken || p.isLiteralPropertyName()
 * }
 */
export function Parser_canFollowModifier(receiver: GoPtr<Parser>): bool {
  return receiver!.token === KindOpenBracketToken || receiver!.token === KindOpenBraceToken || receiver!.token === KindAsteriskToken || receiver!.token === KindDotDotDotToken || Parser_isLiteralPropertyName(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.tryReparseOptionalChain","kind":"method","status":"implemented","sigHash":"aaf07d11690746eb8e64e399707d6d9dce90f39896b32c64ee57b71d6c260ecb","bodyHash":"047b39df18b7d26b255f2356d70fc93fc6935ce2aa32445215377abbc25281b2"}
 *
 * Go source:
 * func (p *Parser) tryReparseOptionalChain(node *ast.Expression) bool {
 * 	if node.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 		return true
 * 	}
 * 	// check for an optional chain in a non-null expression
 * 	if ast.IsNonNullExpression(node) {
 * 		expr := node.Expression()
 * 		for ast.IsNonNullExpression(expr) && expr.Flags&ast.NodeFlagsOptionalChain == 0 {
 * 			expr = expr.Expression()
 * 		}
 * 		if expr.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 			// this is part of an optional chain. Walk down from `node` to `expression` and set the flag.
 * 			for ast.IsNonNullExpression(node) {
 * 				node.Flags |= ast.NodeFlagsOptionalChain
 * 				node = node.Expression()
 * 			}
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Parser_tryReparseOptionalChain(receiver: GoPtr<Parser>, node: GoPtr<Expression>): bool {
  if ((node!.Flags & NodeFlagsOptionalChain) !== 0) {
    return true;
  }
  // check for an optional chain in a non-null expression
  if (IsNonNullExpression(node)) {
    let expr = Node_Expression(node);
    while (IsNonNullExpression(expr) && (expr!.Flags & NodeFlagsOptionalChain) === 0) {
      expr = Node_Expression(expr);
    }
    if ((expr!.Flags & NodeFlagsOptionalChain) !== 0) {
      // this is part of an optional chain. Walk down from `node` to `expression` and set the flag.
      let current: GoPtr<Node> = node;
      while (IsNonNullExpression(current)) {
        current!.Flags |= NodeFlagsOptionalChain;
        current = Node_Expression(current);
      }
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.finishNode","kind":"method","status":"implemented","sigHash":"cea664d83bd51662f7fb68cb08ece474e14a5277c11ca2d1784d3d3729c410ca","bodyHash":"c36ccf67b8c80111cb942b982290fb9b63e7381055f9f2132154ef8fed2754c8"}
 *
 * Go source:
 * func (p *Parser) finishNode(node *ast.Node, pos int) *ast.Node {
 * 	return p.finishNodeWithEnd(node, pos, p.nodePos())
 * }
 */
export function Parser_finishNode(receiver: GoPtr<Parser>, node: GoPtr<Node>, pos: int): GoPtr<Node> {
  return Parser_finishNodeWithEnd(receiver, node, pos, Parser_nodePos(receiver));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.overrideParentInImmediateChildren","kind":"method","status":"implemented","sigHash":"0685618528ec329e5d1432722d4148c6bd529b9aaeb7e52002a4d6ddd9774a82","bodyHash":"76ad1cc3206a6a8f8aff2696d3e5f5993e3309842e64e7c6f5ad38f784d8b975"}
 *
 * Go source:
 * func (p *Parser) overrideParentInImmediateChildren(node *ast.Node) {
 * 	p.currentParent = node
 * 	node.ForEachChild(p.setParentFromContext)
 * 	p.currentParent = nil
 * }
 */
export function Parser_overrideParentInImmediateChildren(receiver: GoPtr<Parser>, node: GoPtr<Node>): void {
  receiver!.currentParent = node;
  Node_ForEachChild(node, receiver!.setParentFromContext);
  receiver!.currentParent = undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.canParseSemicolon","kind":"method","status":"implemented","sigHash":"8db4ff45fd9610e8cb8e0da85ff8a70c8ebfc01484cd8c46e190f77e24ebd89c","bodyHash":"a7e264f30f910edb3cdf54f0908c83d01b0571aab97682a1e3ebe1c41610a4eb"}
 *
 * Go source:
 * func (p *Parser) canParseSemicolon() bool {
 * 	// If there's a real semicolon, then we can always parse it out.
 * 	// We can parse out an optional semicolon in ASI cases in the following cases.
 * 	return p.token == ast.KindSemicolonToken || p.token == ast.KindCloseBraceToken || p.token == ast.KindEndOfFile || p.hasPrecedingLineBreak()
 * }
 */
export function Parser_canParseSemicolon(receiver: GoPtr<Parser>): bool {
  // If there's a real semicolon, then we can always parse it out.
  // We can parse out an optional semicolon in ASI cases in the following cases.
  return receiver!.token === KindSemicolonToken || receiver!.token === KindCloseBraceToken || receiver!.token === KindEndOfFile || Parser_hasPrecedingLineBreak(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.tryParseSemicolon","kind":"method","status":"implemented","sigHash":"d053f04a4dca50ee88099045656d9327a832d790865d9977653fb8813eea14ec","bodyHash":"177949f2a775731d010281f6b136336eb701aa98b5316091f37d4f3fefda0087"}
 *
 * Go source:
 * func (p *Parser) tryParseSemicolon() bool {
 * 	if !p.canParseSemicolon() {
 * 		return false
 * 	}
 * 	if p.token == ast.KindSemicolonToken {
 * 		// consume the semicolon if it was explicitly provided.
 * 		p.nextToken()
 * 	}
 * 	return true
 * }
 */
export function Parser_tryParseSemicolon(receiver: GoPtr<Parser>): bool {
  if (!Parser_canParseSemicolon(receiver)) {
    return false;
  }
  if (receiver!.token === KindSemicolonToken) {
    // consume the semicolon if it was explicitly provided.
    Parser_nextToken(receiver);
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseSemicolon","kind":"method","status":"implemented","sigHash":"c07563ff7006fd7fe02e6dc9d0956e99072643379d649420252df54082b48e08","bodyHash":"48353a28ca0bf9175b898b7b5ac92628eb852bd7d32696a8c28468ff5b5e9156"}
 *
 * Go source:
 * func (p *Parser) parseSemicolon() bool {
 * 	return p.tryParseSemicolon() || p.parseExpected(ast.KindSemicolonToken)
 * }
 */
export function Parser_parseSemicolon(receiver: GoPtr<Parser>): bool {
  return Parser_tryParseSemicolon(receiver) || Parser_parseExpected(receiver, KindSemicolonToken);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isStartOfParameter","kind":"method","status":"implemented","sigHash":"8c9fb230cc42d3619f89b062ae207339050359cf0faebd0fd863955501e403d9","bodyHash":"12d0f8ef4d4cdd59f9719cb92be924edc549ccea528adc0f29c1ebdd63cabfbc"}
 *
 * Go source:
 * func (p *Parser) isStartOfParameter(isJSDocParameter bool) bool {
 * 	return p.token == ast.KindDotDotDotToken ||
 * 		p.isBindingIdentifierOrPrivateIdentifierOrPattern() ||
 * 		ast.IsModifierKind(p.token) ||
 * 		p.token == ast.KindAtToken ||
 * 		p.isStartOfType(!isJSDocParameter /*inStartOfParameter* /)
 * }
 */
export function Parser_isStartOfParameter(receiver: GoPtr<Parser>, isJSDocParameter: bool): bool {
  return receiver!.token === KindDotDotDotToken ||
    Parser_isBindingIdentifierOrPrivateIdentifierOrPattern(receiver) ||
    IsModifierKind(receiver!.token) ||
    receiver!.token === KindAtToken ||
    Parser_isStartOfType(receiver, !isJSDocParameter /*inStartOfParameter*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::isReservedWord","kind":"func","status":"implemented","sigHash":"70dd1c5bd10e6c11cc7848582f4d6bbbf92ef976df25b8e352bf0f754868cb8f","bodyHash":"ba4de5702aa6198f2587e2cc5525405c7770f8b535c262dfdfa9dc4ceb7b49f2"}
 *
 * Go source:
 * func isReservedWord(token ast.Kind) bool {
 * 	return ast.KindFirstReservedWord <= token && token <= ast.KindLastReservedWord
 * }
 */
export function isReservedWord(token: Kind): bool {
  return KindFirstReservedWord <= token && token <= KindLastReservedWord;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::getCommentPragmas","kind":"func","status":"implemented","sigHash":"31fb140c784459eaa7b98325b7f2279a15ed085460fb5b39207cee64f99c057b","bodyHash":"5b2ade4c1195f04a9522f8e0fced7091ad94221bb1cc18a97ec3edbcd43a1b79"}
 *
 * Go source:
 * func getCommentPragmas(f *ast.NodeFactory, sourceText string) (pragmas []ast.Pragma) {
 * 	for commentRange := range scanner.GetLeadingCommentRanges(f, sourceText, 0) {
 * 		comment := sourceText[commentRange.Pos():commentRange.End()]
 * 		pragmas = append(pragmas, extractPragmas(commentRange, comment)...)
 * 	}
 * 	return pragmas
 * }
 */
export function getCommentPragmas(f: GoPtr<NodeFactory>, sourceText: string): GoSlice<Pragma> {
  let pragmas: GoSlice<Pragma> = [];
  GetLeadingCommentRanges(f as NodeFactory, sourceText, 0)((commentRange: CommentRange): bool => {
    const comment = byteSlice(sourceText, commentRange.pos, commentRange.end);
    pragmas = [...pragmas, ...extractPragmas(commentRange, comment)];
    return true;
  });
  return pragmas;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::extractPragmas","kind":"func","status":"implemented","sigHash":"35f0aecbddfdf5c151dd825a06917a646a38e20b6fe86e144e646c0931c8e3fe","bodyHash":"75dc878225bba1b959e7e297b2b4f38fde7db80beccffe983e84f2cdd9cc355a"}
 *
 * Go source:
 * func extractPragmas(commentRange ast.CommentRange, text string) []ast.Pragma {
 * 	if commentRange.Kind == ast.KindSingleLineCommentTrivia {
 * 		pos := 2
 * 		tripleSlash := match(text, pos, "/")
 * 		if tripleSlash {
 * 			pos++
 * 		}
 * 		pos = skipBlanks(text, pos)
 * 		if tripleSlash && match(text, pos, "<") {
 * 			tagName := extractName(text, pos+1)
 * 			if tagName != "reference" {
 * 				return nil
 * 			}
 * 			pos += 10
 * 			args := make(map[string]ast.PragmaArgument)
 * 			for {
 * 				pos = skipBlanks(text, pos)
 * 				if match(text, pos, "/>") {
 * 					break
 * 				}
 * 				argName := extractName(text, pos)
 * 				if argName == "" {
 * 					break
 * 				}
 * 				pos = skipBlanks(text, pos+len(argName))
 * 				if !match(text, pos, "=") {
 * 					break
 * 				}
 * 				pos = skipBlanks(text, pos+1)
 * 				value, ok := extractQuotedString(text, pos)
 * 				if !ok {
 * 					break
 * 				}
 * 				args[argName] = ast.PragmaArgument{
 * 					Name:      argName,
 * 					Value:     value,
 * 					TextRange: core.NewTextRange(commentRange.Pos()+pos+1, commentRange.Pos()+pos+1+len(value)),
 * 				}
 * 				pos += len(value) + 2
 * 			}
 * 			return []ast.Pragma{{
 * 				CommentRange: commentRange,
 * 				Name:         "reference",
 * 				Args:         args,
 * 			}}
 * 		}
 * 		if match(text, pos, "@") {
 * 			pos++
 * 			pragmaName := extractName(text, pos)
 * 			if !(pragmaName == "ts-check" || pragmaName == "ts-nocheck") {
 * 				return nil
 * 			}
 * 			return []ast.Pragma{{
 * 				CommentRange: commentRange,
 * 				Name:         pragmaName,
 * 			}}
 * 		}
 * 	}
 * 	if commentRange.Kind == ast.KindMultiLineCommentTrivia {
 * 		text = strings.TrimSuffix(text, "* /")
 * 		pos := 2
 * 		var pragmas []ast.Pragma
 * 		for {
 * 			if pos = skipTo(text, pos, "@"); pos < 0 {
 * 				break
 * 			}
 * 			pragmaName := extractName(text, pos+1)
 * 			if !(pragmaName == "jsx" || pragmaName == "jsxfrag" || pragmaName == "jsximportsource" || pragmaName == "jsxruntime") {
 * 				break
 * 			}
 * 			start := skipBlanks(text, pos+len(pragmaName)+1)
 * 			pos = skipNonBlanks(text, start)
 * 			if pos == start {
 * 				break
 * 			}
 * 			args := make(map[string]ast.PragmaArgument, 1)
 * 			args["factory"] = ast.PragmaArgument{
 * 				Name:      "factory",
 * 				Value:     text[start:pos],
 * 				TextRange: core.NewTextRange(commentRange.Pos()+start, commentRange.Pos()+pos),
 * 			}
 * 			pragmas = append(pragmas, ast.Pragma{
 * 				CommentRange: commentRange,
 * 				Name:         pragmaName,
 * 				Args:         args,
 * 			})
 * 		}
 * 		return pragmas
 * 	}
 * 	return nil
 * }
 */
export function extractPragmas(commentRange: CommentRange, text: string): GoSlice<Pragma> {
  if (commentRange.Kind === KindSingleLineCommentTrivia) {
    let pos = 2;
    const tripleSlash = match(text, pos, "/");
    if (tripleSlash) {
      pos++;
    }
    pos = skipBlanks(text, pos);
    if (tripleSlash && match(text, pos, "<")) {
      const tagName = extractName(text, pos + 1);
      if (tagName !== "reference") {
        return [];
      }
      pos += 10;
      const args = new globalThis.Map<string, Pragma["Args"] extends GoMap<string, infer T> ? T : never>();
      for (;;) {
        pos = skipBlanks(text, pos);
        if (match(text, pos, "/>")) {
          break;
        }
        const argName = extractName(text, pos);
        if (argName === "") {
          break;
        }
        pos = skipBlanks(text, pos + argName.length);
        if (!match(text, pos, "=")) {
          break;
        }
        pos = skipBlanks(text, pos + 1);
        const [value, ok] = extractQuotedString(text, pos);
        if (!ok) {
          break;
        }
        const argStart = commentRange.pos + pos + 1;
        const argEnd = commentRange.pos + pos + 1 + byteLen(value);
        args.set(argName, {
          pos: argStart,
          end: argEnd,
          Name: argName,
          Value: value,
        });
        pos += byteLen(value) + 2;
      }
      return [{
        ...commentRange,
        Name: "reference",
        Args: args,
      } as unknown as Pragma];
    }
    if (match(text, pos, "@")) {
      pos++;
      const pragmaName = extractName(text, pos);
      if (!(pragmaName === "ts-check" || pragmaName === "ts-nocheck")) {
        return [];
      }
      return [{
        ...commentRange,
        Name: pragmaName,
      } as unknown as Pragma];
    }
  }
  if (commentRange.Kind === KindMultiLineCommentTrivia) {
    const trimmed = TrimSuffix(text, "*/");
    let pos = 2;
    let pragmas: GoSlice<Pragma> = [];
    for (;;) {
      pos = skipTo(trimmed, pos, "@");
      if (pos < 0) {
        break;
      }
      const pragmaName = extractName(trimmed, pos + 1);
      if (!(pragmaName === "jsx" || pragmaName === "jsxfrag" || pragmaName === "jsximportsource" || pragmaName === "jsxruntime")) {
        break;
      }
      const start = skipBlanks(trimmed, pos + pragmaName.length + 1);
      pos = skipNonBlanks(trimmed, start);
      if (pos === start) {
        break;
      }
      const factoryStart = commentRange.pos + start;
      const factoryEnd = commentRange.pos + pos;
      const args = new globalThis.Map<string, Pragma["Args"] extends GoMap<string, infer T> ? T : never>();
      args.set("factory", {
          pos: factoryStart,
          end: factoryEnd,
          Name: "factory",
          Value: byteSlice(trimmed, start, pos),
        });
      pragmas = [...pragmas, {
        ...commentRange,
        Name: pragmaName,
        Args: args,
      } as unknown as Pragma];
    }
    return pragmas;
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::match","kind":"func","status":"implemented","sigHash":"10e9189641af2ba42d20fe68a3a22b891a6e39b3dbf24cac70b422b3eff82487","bodyHash":"21d2f4e8b37337a3c2dd78207c909839f20686cbbc85cf08d0861859f7048c43"}
 *
 * Go source:
 * func match(text string, pos int, s string) bool {
 * 	return strings.HasPrefix(text[pos:], s)
 * }
 */
export function match(text: string, pos: int, s: string): bool {
  return HasPrefix(byteSlice(text, pos), s);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::skipBlanks","kind":"func","status":"implemented","sigHash":"affb6dd2cfb352c50789cb57e3b826a42348cf9e8641b5ad00722ee3cb49e678","bodyHash":"19cc8a5b424bfa9cfdbcbd52e14354a59a9e7d46246a5c5f8ff2afa882162ae7"}
 *
 * Go source:
 * func skipBlanks(text string, pos int) int {
 * 	for pos < len(text) && (text[pos] == ' ' || text[pos] == '\t') {
 * 		pos++
 * 	}
 * 	return pos
 * }
 */
export function skipBlanks(text: string, pos: int): int {
  let p = pos;
  while (p < byteLen(text) && (byteAt(text, p) === " ".charCodeAt(0) || byteAt(text, p) === "\t".charCodeAt(0))) {
    p++;
  }
  return p;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::skipNonBlanks","kind":"func","status":"implemented","sigHash":"5bbe3f43e1670f621536fbb4e3a95189c714767fc9839196a67fd7e0ea26d590","bodyHash":"cf93ed231339c4bf36995d5002747d005197a37dcd33b8c4b8416df214eb0f7c"}
 *
 * Go source:
 * func skipNonBlanks(text string, pos int) int {
 * 	for pos < len(text) && (text[pos] != ' ' && text[pos] != '\t' && text[pos] != '\r' && text[pos] != '\n') {
 * 		pos++
 * 	}
 * 	return pos
 * }
 */
export function skipNonBlanks(text: string, pos: int): int {
  let p = pos;
  while (p < byteLen(text) &&
    byteAt(text, p) !== " ".charCodeAt(0) &&
    byteAt(text, p) !== "\t".charCodeAt(0) &&
    byteAt(text, p) !== "\r".charCodeAt(0) &&
    byteAt(text, p) !== "\n".charCodeAt(0)) {
    p++;
  }
  return p;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::skipTo","kind":"func","status":"implemented","sigHash":"b8e1406f7f6a3224da126638054a3af6eee0719ff4d3207b45ef57e6b6157db9","bodyHash":"39e4a5ac58ce922572b634b14fcfb8d7243ea31fa946ea0158baf5c195d3b007"}
 *
 * Go source:
 * func skipTo(text string, pos int, s string) int {
 * 	if pos >= len(text) {
 * 		return -1
 * 	}
 * 	i := strings.Index(text[pos:], s)
 * 	if i < 0 {
 * 		return -1
 * 	}
 * 	return pos + i
 * }
 */
export function skipTo(text: string, pos: int, s: string): int {
  if (pos >= byteLen(text)) {
    return -1;
  }
  const i = Index(byteSlice(text, pos), s);
  if (i < 0) {
    return -1;
  }
  return pos + i;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::extractName","kind":"func","status":"implemented","sigHash":"04cc4ed8f6d45d4166341f3b1616a6629f8e0e67d4ab54f7cbe7cbe31ef90469","bodyHash":"bcf5497c2dfaf5a6b7012f64d52707282713f5f5c59b0e5c4d23872433007977"}
 *
 * Go source:
 * func extractName(text string, pos int) string {
 * 	start := pos
 * 	for pos < len(text) && (text[pos] >= 'A' && text[pos] <= 'Z' || text[pos] >= 'a' && text[pos] <= 'z' || text[pos] == '-') {
 * 		pos++
 * 	}
 * 	return strings.ToLower(text[start:pos])
 * }
 */
export function extractName(text: string, pos: int): string {
  const start = pos;
  let p = pos;
  while (p < byteLen(text)) {
    const ch = byteAt(text, p);
    if (!((ch >= "A".charCodeAt(0) && ch <= "Z".charCodeAt(0)) ||
      (ch >= "a".charCodeAt(0) && ch <= "z".charCodeAt(0)) ||
      ch === "-".charCodeAt(0))) {
      break;
    }
    p++;
  }
  return ToLower(byteSlice(text, start, p));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::extractQuotedString","kind":"func","status":"implemented","sigHash":"df0cd1f8b9cd22b244213061398db13ee96712e4b301fa00f1ea74c0cae5e84d","bodyHash":"d86c15d2f1454d0d8443911aedea18e8e1ed618a14c52e00fcaaff4497e1cad1"}
 *
 * Go source:
 * func extractQuotedString(text string, pos int) (string, bool) {
 * 	if pos == len(text) {
 * 		return "", false
 * 	}
 * 	quote := text[pos]
 * 	if quote != '\'' && quote != '"' {
 * 		return "", false
 * 	}
 * 	pos++
 * 	start := pos
 * 	for pos < len(text) && text[pos] != quote {
 * 		pos++
 * 	}
 * 	if pos == len(text) {
 * 		return "", false
 * 	}
 * 	return text[start:pos], true
 * }
 */
export function extractQuotedString(text: string, pos: int): [string, bool] {
  if (pos === byteLen(text)) {
    return ["", false];
  }
  const quote = byteAt(text, pos);
  if (quote !== "'".charCodeAt(0) && quote !== '"'.charCodeAt(0)) {
    return ["", false];
  }
  let p = pos + 1;
  const start = p;
  while (p < byteLen(text) && byteAt(text, p) !== quote) {
    p++;
  }
  if (p === byteLen(text)) {
    return ["", false];
  }
  return [byteSlice(text, start, p), true];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.processPragmasIntoFields","kind":"method","status":"implemented","sigHash":"0383abe35ef6273fdc6527c622d3af35692993630f8235c6da38a68cb48a3cdd","bodyHash":"427043902322cc5df42654a2f6ea7058f06c545e153e02691f4662660615546e"}
 *
 * Go source:
 * func (p *Parser) processPragmasIntoFields(context *ast.SourceFile) {
 * 	context.CheckJsDirective = nil
 * 	context.ReferencedFiles = nil
 * 	context.TypeReferenceDirectives = nil
 * 	context.LibReferenceDirectives = nil
 * 	// context.AmdDependencies = nil
 * 	for _, pragma := range context.Pragmas {
 * 		switch pragma.Name {
 * 		case "reference":
 * 			types, typesOk := pragma.Args["types"]
 * 			lib, libOk := pragma.Args["lib"]
 * 			path, pathOk := pragma.Args["path"]
 * 			resolutionMode, resolutionModeOk := pragma.Args["resolution-mode"]
 * 			preserve, preserveOk := pragma.Args["preserve"]
 * 			noDefaultLib, noDefaultLibOk := pragma.Args["no-default-lib"]
 * 			switch {
 * 			case noDefaultLibOk && noDefaultLib.Value == "true":
 * 				// Ignored.
 * 			case typesOk:
 * 				var parsed core.ResolutionMode
 * 				if resolutionModeOk {
 * 					parsed = p.parseResolutionMode(resolutionMode.Value, resolutionMode.Pos(), resolutionMode.End())
 * 				}
 * 				context.TypeReferenceDirectives = append(context.TypeReferenceDirectives, &ast.FileReference{
 * 					TextRange:      types.TextRange,
 * 					FileName:       types.Value,
 * 					ResolutionMode: parsed,
 * 					Preserve:       preserveOk && preserve.Value == "true",
 * 				})
 * 			case libOk:
 * 				context.LibReferenceDirectives = append(context.LibReferenceDirectives, &ast.FileReference{
 * 					TextRange: lib.TextRange,
 * 					FileName:  lib.Value,
 * 					Preserve:  preserveOk && preserve.Value == "true",
 * 				})
 * 			case pathOk:
 * 				context.ReferencedFiles = append(context.ReferencedFiles, &ast.FileReference{
 * 					TextRange: path.TextRange,
 * 					FileName:  path.Value,
 * 					Preserve:  preserveOk && preserve.Value == "true",
 * 				})
 * 			default:
 * 				p.parseErrorAtRange(pragma.TextRange, diagnostics.Invalid_reference_directive_syntax)
 * 			}
 * 		case "ts-check", "ts-nocheck":
 * 			// _last_ of either nocheck or check in a file is the "winner"
 * 			for _, directive := range context.Pragmas {
 * 				if context.CheckJsDirective == nil || directive.TextRange.Pos() > context.CheckJsDirective.Range.Pos() {
 * 					context.CheckJsDirective = &ast.CheckJsDirective{
 * 						Enabled: directive.Name == "ts-check",
 * 						Range:   directive.CommentRange,
 * 					}
 * 				}
 * 			}
 * 		case "jsx", "jsxfrag", "jsximportsource", "jsxruntime":
 * 			// Nothing to do here
 * 		default:
 * 			panic("Unhandled pragma kind: " + pragma.Name)
 * 		}
 * 	}
 * }
 */
export function Parser_processPragmasIntoFields(receiver: GoPtr<Parser>, context: GoPtr<SourceFile>): void {
  context!.CheckJsDirective = undefined;
  context!.ReferencedFiles = [];
  context!.TypeReferenceDirectives = [];
  context!.LibReferenceDirectives = [];
  for (const pragma of (context!.Pragmas ?? [])) {
    switch (pragma.Name) {
      case "reference": {
        const types = pragma.Args?.get("types");
        const lib = pragma.Args?.get("lib");
        const path = pragma.Args?.get("path");
        const resolutionMode = pragma.Args?.get("resolution-mode");
        const preserve = pragma.Args?.get("preserve");
        const noDefaultLib = pragma.Args?.get("no-default-lib");
        if (noDefaultLib !== undefined && noDefaultLib.Value === "true") {
          // Ignored.
        } else if (types !== undefined) {
          let parsed: ResolutionMode = 0;
          if (resolutionMode !== undefined) {
            parsed = Parser_parseResolutionMode(receiver, resolutionMode.Value, resolutionMode.pos, resolutionMode.end);
          }
          context!.TypeReferenceDirectives = [...(context!.TypeReferenceDirectives ?? []), {
            pos: types.pos,
            end: types.end,
            FileName: types.Value,
            ResolutionMode: parsed,
            Preserve: preserve !== undefined && preserve.Value === "true",
          } as unknown as GoPtr<FileReference>];
        } else if (lib !== undefined) {
          context!.LibReferenceDirectives = [...(context!.LibReferenceDirectives ?? []), {
            pos: lib.pos,
            end: lib.end,
            FileName: lib.Value,
            // Go zero value: ResolutionModeNone (the printer emits the attribute for
            // any other value).
            ResolutionMode: 0 as ResolutionMode,
            Preserve: preserve !== undefined && preserve.Value === "true",
          } as unknown as GoPtr<FileReference>];
        } else if (path !== undefined) {
          context!.ReferencedFiles = [...(context!.ReferencedFiles ?? []), {
            pos: path.pos,
            end: path.end,
            FileName: path.Value,
            // Go zero value: ResolutionModeNone.
            ResolutionMode: 0 as ResolutionMode,
            Preserve: preserve !== undefined && preserve.Value === "true",
          } as unknown as GoPtr<FileReference>];
        } else {
          Parser_parseErrorAtRange(receiver, pragma, Invalid_reference_directive_syntax);
        }
        break;
      }
      case "ts-check":
      case "ts-nocheck":
        // _last_ of either nocheck or check in a file is the "winner"
        for (const directive of (context!.Pragmas ?? [])) {
          if (context!.CheckJsDirective === undefined || directive.pos > context!.CheckJsDirective.Range.pos) {
            context!.CheckJsDirective = {
              Enabled: directive.Name === "ts-check",
              Range: directive,
            } as CheckJsDirective;
          }
        }
        break;
      case "jsx":
      case "jsxfrag":
      case "jsximportsource":
      case "jsxruntime":
        // Nothing to do here
        break;
      default:
        throw new globalThis.Error("Unhandled pragma kind: " + pragma.Name);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseResolutionMode","kind":"method","status":"implemented","sigHash":"d2cfb64f89fbc2bf6a6a1234a78e97cca85ca651fc7eb362c4a3b95538f6bdc7","bodyHash":"fd06d742f66094528e4fcd8a855caf098c18dde7e74ce6e4bfcee5112433df49"}
 *
 * Go source:
 * func (p *Parser) parseResolutionMode(mode string, pos int, end int) (resolutionKind core.ResolutionMode) {
 * 	if mode == "import" {
 * 		resolutionKind = core.ModuleKindESNext
 * 		return resolutionKind
 * 	}
 * 	if mode == "require" {
 * 		resolutionKind = core.ModuleKindCommonJS
 * 		return resolutionKind
 * 	}
 * 	p.parseErrorAt(pos, end, diagnostics.X_resolution_mode_should_be_either_require_or_import)
 * 	return resolutionKind
 * }
 */
export function Parser_parseResolutionMode(receiver: GoPtr<Parser>, mode: string, pos: int, end: int): ResolutionMode {
  if (mode === "import") {
    const resolutionKind: ResolutionMode = ModuleKindESNext;
    return resolutionKind;
  }
  if (mode === "require") {
    const resolutionKind: ResolutionMode = ModuleKindCommonJS;
    return resolutionKind;
  }
  Parser_parseErrorAt(receiver, pos, end, X_resolution_mode_should_be_either_require_or_import);
  const resolutionKind: ResolutionMode = 0;
  return resolutionKind;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.checkJSDecoratorSyntax","kind":"method","status":"implemented","sigHash":"99b83978191ff62050d508b5fc1fc405240772db2b21060778b59053df4cf97a","bodyHash":"d60fcae33e25e7d2372c88f238ec3c93eaff5ea09f74f2d13bebc7acbb14d0f0"}
 *
 * Go source:
 * func (p *Parser) checkJSDecoratorSyntax(node *ast.Node) {
 * 	modifiers := node.ModifierNodes()
 * 	if len(modifiers) == 0 {
 * 		return
 * 	}
 * 
 * 	if ast.CanHaveIllegalDecorators(node) {
 * 		for _, modifier := range modifiers {
 * 			if ast.IsDecorator(modifier) {
 * 				p.jsErrorAtRange(modifier.Loc, diagnostics.Decorators_are_not_valid_here)
 * 				break
 * 			}
 * 		}
 * 	} else if ast.CanHaveDecorators(node) {
 * 		decoratorIndex := core.FindIndex(modifiers, ast.IsDecorator)
 * 		if decoratorIndex >= 0 {
 * 			if ast.IsClassDeclaration(node) {
 * 				exportIndex := core.FindIndex(modifiers, isExportModifier)
 * 				if exportIndex >= 0 {
 * 					defaultIndex := core.FindIndex(modifiers, func(m *ast.Node) bool {
 * 						return m.Kind == ast.KindDefaultKeyword
 * 					})
 * 					if decoratorIndex > exportIndex && defaultIndex >= 0 && decoratorIndex < defaultIndex {
 * 						// Decorator between `export` and `default`
 * 						p.jsErrorAtRange(modifiers[decoratorIndex].Loc, diagnostics.Decorators_are_not_valid_here)
 * 					} else if decoratorIndex < exportIndex {
 * 						// Find a trailing decorator after the export keyword
 * 						trailingDecoratorIndex := -1
 * 						for i := exportIndex; i < len(modifiers); i++ {
 * 							if ast.IsDecorator(modifiers[i]) {
 * 								trailingDecoratorIndex = i
 * 								break
 * 							}
 * 						}
 * 						if trailingDecoratorIndex >= 0 {
 * 							diag := ast.NewDiagnostic(
 * 								nil,
 * 								core.NewTextRange(scanner.SkipTrivia(p.sourceText, modifiers[trailingDecoratorIndex].Loc.Pos()), modifiers[trailingDecoratorIndex].Loc.End()),
 * 								diagnostics.Decorators_may_not_appear_after_export_or_export_default_if_they_also_appear_before_export,
 * 							)
 * 							diag.AddRelatedInfo(ast.NewDiagnostic(
 * 								nil,
 * 								core.NewTextRange(scanner.SkipTrivia(p.sourceText, modifiers[decoratorIndex].Loc.Pos()), modifiers[decoratorIndex].Loc.End()),
 * 								diagnostics.Decorator_used_before_export_here,
 * 							))
 * 							p.jsDiagnostics = append(p.jsDiagnostics, diag)
 * 						}
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * }
 */
export function Parser_checkJSDecoratorSyntax(receiver: GoPtr<Parser>, node: GoPtr<Node>): void {
  const modifiers = Node_ModifierNodes(node) ?? [];
  if (modifiers.length === 0) {
    return;
  }

  if (CanHaveIllegalDecorators(node)) {
    for (const modifier of modifiers) {
      if (IsDecorator(modifier)) {
        Parser_jsErrorAtRange(receiver, modifier!.Loc, Decorators_are_not_valid_here);
        break;
      }
    }
  } else if (CanHaveDecorators(node)) {
    const decoratorIndex = FindIndex(modifiers, IsDecorator);
    if (decoratorIndex >= 0) {
      if (IsClassDeclaration(node)) {
        const exportIndex = FindIndex(modifiers, isExportModifier);
        if (exportIndex >= 0) {
          const defaultIndex = FindIndex(modifiers, (m: GoPtr<Node>): bool => m!.Kind === KindDefaultKeyword);
          if (decoratorIndex > exportIndex && defaultIndex >= 0 && decoratorIndex < defaultIndex) {
            // Decorator between `export` and `default`
            Parser_jsErrorAtRange(receiver, modifiers[decoratorIndex]!.Loc, Decorators_are_not_valid_here);
          } else if (decoratorIndex < exportIndex) {
            // Find a trailing decorator after the export keyword
            let trailingDecoratorIndex = -1;
            for (let i = exportIndex; i < modifiers.length; i++) {
              if (IsDecorator(modifiers[i])) {
                trailingDecoratorIndex = i;
                break;
              }
            }
            if (trailingDecoratorIndex >= 0) {
              const diag = NewDiagnostic(
                undefined,
                NewTextRange(SkipTrivia(receiver!.sourceText, modifiers[trailingDecoratorIndex]!.Loc.pos), modifiers[trailingDecoratorIndex]!.Loc.end),
                Decorators_may_not_appear_after_export_or_export_default_if_they_also_appear_before_export,
              );
              Diagnostic_AddRelatedInfo(diag, NewDiagnostic(
                undefined,
                NewTextRange(SkipTrivia(receiver!.sourceText, modifiers[decoratorIndex]!.Loc.pos), modifiers[decoratorIndex]!.Loc.end),
                Decorator_used_before_export_here,
              ));
              receiver!.jsDiagnostics = [...receiver!.jsDiagnostics, diag];
            }
          }
        }
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.checkJSSyntax","kind":"method","status":"implemented","sigHash":"0c7b71c19cc460b919135e4b0f1ac9707f13497e44ba5d92c538096cc2bc3399","bodyHash":"8d1587cd028e7ec2ae4ccad37c3575dbbe3b970eb2ac8f7630b7030d1743a270"}
 *
 * Go source:
 * func (p *Parser) checkJSSyntax(node *ast.Node) *ast.Node {
 * 	if node.Flags&ast.NodeFlagsJavaScriptFile == 0 || node.Flags&(ast.NodeFlagsJSDoc|ast.NodeFlagsReparsed) != 0 {
 * 		return node
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindParameter, ast.KindPropertyDeclaration, ast.KindMethodDeclaration:
 * 		if token := node.QuestionToken(); token != nil && token.Flags&ast.NodeFlagsReparsed == 0 && ast.IsQuestionToken(token) {
 * 			p.jsErrorAtRange(token.Loc, diagnostics.The_0_modifier_can_only_be_used_in_TypeScript_files, "?")
 * 		}
 * 		fallthrough
 * 	case ast.KindMethodSignature, ast.KindConstructor, ast.KindGetAccessor, ast.KindSetAccessor, ast.KindFunctionExpression,
 * 		ast.KindFunctionDeclaration, ast.KindArrowFunction, ast.KindVariableDeclaration, ast.KindIndexSignature:
 * 		if ast.IsFunctionLike(node) && node.Body() == nil {
 * 			p.jsErrorAtRange(node.Loc, diagnostics.Signature_declarations_can_only_be_used_in_TypeScript_files)
 * 		} else if t := node.Type(); t != nil && t.Flags&ast.NodeFlagsReparsed == 0 {
 * 			p.jsErrorAtRange(t.Loc, diagnostics.Type_annotations_can_only_be_used_in_TypeScript_files)
 * 		}
 * 	case ast.KindImportDeclaration:
 * 		if clause := node.ImportClause(); clause != nil && clause.IsTypeOnly() {
 * 			p.jsErrorAtRange(node.Loc, diagnostics.X_0_declarations_can_only_be_used_in_TypeScript_files, "import type")
 * 		}
 * 	case ast.KindExportDeclaration:
 * 		if node.IsTypeOnly() {
 * 			p.jsErrorAtRange(node.Loc, diagnostics.X_0_declarations_can_only_be_used_in_TypeScript_files, "export type")
 * 		}
 * 	case ast.KindImportSpecifier:
 * 		if node.IsTypeOnly() {
 * 			p.jsErrorAtRange(node.Loc, diagnostics.X_0_declarations_can_only_be_used_in_TypeScript_files, "import...type")
 * 		}
 * 	case ast.KindExportSpecifier:
 * 		if node.IsTypeOnly() {
 * 			p.jsErrorAtRange(node.Loc, diagnostics.X_0_declarations_can_only_be_used_in_TypeScript_files, "export...type")
 * 		}
 * 	case ast.KindImportEqualsDeclaration:
 * 		p.jsErrorAtRange(node.Loc, diagnostics.X_import_can_only_be_used_in_TypeScript_files)
 * 	case ast.KindExportAssignment:
 * 		if node.AsExportAssignment().IsExportEquals {
 * 			p.jsErrorAtRange(node.Loc, diagnostics.X_export_can_only_be_used_in_TypeScript_files)
 * 		}
 * 	case ast.KindHeritageClause:
 * 		if node.AsHeritageClause().Token == ast.KindImplementsKeyword {
 * 			p.jsErrorAtRange(node.Loc, diagnostics.X_implements_clauses_can_only_be_used_in_TypeScript_files)
 * 		}
 * 	case ast.KindInterfaceDeclaration:
 * 		p.jsErrorAtRange(node.Name().Loc, diagnostics.X_0_declarations_can_only_be_used_in_TypeScript_files, "interface")
 * 	case ast.KindModuleDeclaration:
 * 		p.jsErrorAtRange(node.Name().Loc, diagnostics.X_0_declarations_can_only_be_used_in_TypeScript_files, scanner.TokenToString(node.AsModuleDeclaration().Keyword))
 * 	case ast.KindTypeAliasDeclaration:
 * 		p.jsErrorAtRange(node.Name().Loc, diagnostics.Type_aliases_can_only_be_used_in_TypeScript_files)
 * 	case ast.KindEnumDeclaration:
 * 		p.jsErrorAtRange(node.Name().Loc, diagnostics.X_0_declarations_can_only_be_used_in_TypeScript_files, "enum")
 * 	case ast.KindNonNullExpression:
 * 		p.jsErrorAtRange(node.Loc, diagnostics.Non_null_assertions_can_only_be_used_in_TypeScript_files)
 * 	case ast.KindAsExpression:
 * 		p.jsErrorAtRange(node.Type().Loc, diagnostics.Type_assertion_expressions_can_only_be_used_in_TypeScript_files)
 * 	case ast.KindSatisfiesExpression:
 * 		p.jsErrorAtRange(node.Type().Loc, diagnostics.Type_satisfaction_expressions_can_only_be_used_in_TypeScript_files)
 * 	}
 * 	// Check decorator placement in JS files
 * 	p.checkJSDecoratorSyntax(node)
 * 	// Check absence of type parameters, type arguments and non-JavaScript modifiers
 * 	switch node.Kind {
 * 	case ast.KindClassDeclaration, ast.KindClassExpression, ast.KindMethodDeclaration, ast.KindConstructor, ast.KindGetAccessor,
 * 		ast.KindSetAccessor, ast.KindFunctionExpression, ast.KindFunctionDeclaration, ast.KindArrowFunction:
 * 		if list := node.TypeParameterList(); list != nil && core.Some(list.Nodes, func(n *ast.Node) bool { return n.Flags&ast.NodeFlagsReparsed == 0 }) {
 * 			p.jsErrorAtRange(list.Loc, diagnostics.Type_parameter_declarations_can_only_be_used_in_TypeScript_files)
 * 		}
 * 		fallthrough
 * 	case ast.KindVariableStatement, ast.KindPropertyDeclaration:
 * 		for _, modifier := range node.ModifierNodes() {
 * 			if modifier.Flags&ast.NodeFlagsReparsed == 0 && modifier.Kind != ast.KindDecorator && ast.ModifierToFlag(modifier.Kind)&ast.ModifierFlagsJavaScript == 0 {
 * 				p.jsErrorAtRange(modifier.Loc, diagnostics.The_0_modifier_can_only_be_used_in_TypeScript_files, scanner.TokenToString(modifier.Kind))
 * 			}
 * 		}
 * 	case ast.KindParameter:
 * 		if core.Some(node.ModifierNodes(), ast.IsModifier) {
 * 			p.jsErrorAtRange(node.Modifiers().Loc, diagnostics.Parameter_modifiers_can_only_be_used_in_TypeScript_files)
 * 		}
 * 	case ast.KindCallExpression, ast.KindNewExpression, ast.KindExpressionWithTypeArguments, ast.KindJsxSelfClosingElement,
 * 		ast.KindJsxOpeningElement, ast.KindTaggedTemplateExpression:
 * 		if list := node.TypeArgumentList(); list != nil && core.Some(list.Nodes, func(n *ast.Node) bool { return n.Flags&ast.NodeFlagsReparsed == 0 }) {
 * 			p.jsErrorAtRange(list.Loc, diagnostics.Type_arguments_can_only_be_used_in_TypeScript_files)
 * 		}
 * 	}
 * 	return node
 * }
 */
export function Parser_checkJSSyntax(receiver: GoPtr<Parser>, node: GoPtr<Node>): GoPtr<Node> {
  if ((node!.Flags & NodeFlagsJavaScriptFile) === 0 || (node!.Flags & (NodeFlagsJSDoc | NodeFlagsReparsed)) !== 0) {
    return node;
  }
  switch (node!.Kind) {
    case KindParameter:
    case KindPropertyDeclaration:
    case KindMethodDeclaration: {
      const token = Node_QuestionToken(node);
      if (token !== undefined && (token!.Flags & NodeFlagsReparsed) === 0 && IsQuestionToken(token)) {
        Parser_jsErrorAtRange(receiver, token!.Loc, The_0_modifier_can_only_be_used_in_TypeScript_files, "?");
      }
    }
    // fallthrough
    // eslint-disable-next-line no-fallthrough
    case KindMethodSignature:
    case KindConstructor:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindFunctionExpression:
    case KindFunctionDeclaration:
    case KindArrowFunction:
    case KindVariableDeclaration:
    case KindIndexSignature:
      if (IsFunctionLike(node) && Node_Body(node) === undefined) {
        Parser_jsErrorAtRange(receiver, node!.Loc, Signature_declarations_can_only_be_used_in_TypeScript_files);
      } else {
        const t = Node_Type(node);
        if (t !== undefined && (t!.Flags & NodeFlagsReparsed) === 0) {
          Parser_jsErrorAtRange(receiver, t!.Loc, Type_annotations_can_only_be_used_in_TypeScript_files);
        }
      }
      break;
    case KindImportDeclaration: {
      const clause = Node_ImportClause(node);
      if (clause !== undefined && Node_IsTypeOnly(clause)) {
        Parser_jsErrorAtRange(receiver, node!.Loc, X_0_declarations_can_only_be_used_in_TypeScript_files, "import type");
      }
      break;
    }
    case KindExportDeclaration:
      if (Node_IsTypeOnly(node)) {
        Parser_jsErrorAtRange(receiver, node!.Loc, X_0_declarations_can_only_be_used_in_TypeScript_files, "export type");
      }
      break;
    case KindImportSpecifier:
      if (Node_IsTypeOnly(node)) {
        Parser_jsErrorAtRange(receiver, node!.Loc, X_0_declarations_can_only_be_used_in_TypeScript_files, "import...type");
      }
      break;
    case KindExportSpecifier:
      if (Node_IsTypeOnly(node)) {
        Parser_jsErrorAtRange(receiver, node!.Loc, X_0_declarations_can_only_be_used_in_TypeScript_files, "export...type");
      }
      break;
    case KindImportEqualsDeclaration:
      Parser_jsErrorAtRange(receiver, node!.Loc, X_import_can_only_be_used_in_TypeScript_files);
      break;
    case KindExportAssignment:
      if (AsExportAssignment(node)!.IsExportEquals) {
        Parser_jsErrorAtRange(receiver, node!.Loc, X_export_can_only_be_used_in_TypeScript_files);
      }
      break;
    case KindHeritageClause:
      if (AsHeritageClause(node)!.Token === KindImplementsKeyword) {
        Parser_jsErrorAtRange(receiver, node!.Loc, X_implements_clauses_can_only_be_used_in_TypeScript_files);
      }
      break;
    case KindInterfaceDeclaration:
      Parser_jsErrorAtRange(receiver, Node_Name(node)!.Loc, X_0_declarations_can_only_be_used_in_TypeScript_files, "interface");
      break;
    case KindModuleDeclaration:
      Parser_jsErrorAtRange(receiver, Node_Name(node)!.Loc, X_0_declarations_can_only_be_used_in_TypeScript_files, TokenToString(AsModuleDeclaration(node)!.Keyword));
      break;
    case KindTypeAliasDeclaration:
      Parser_jsErrorAtRange(receiver, Node_Name(node)!.Loc, Type_aliases_can_only_be_used_in_TypeScript_files);
      break;
    case KindEnumDeclaration:
      Parser_jsErrorAtRange(receiver, Node_Name(node)!.Loc, X_0_declarations_can_only_be_used_in_TypeScript_files, "enum");
      break;
    case KindNonNullExpression:
      Parser_jsErrorAtRange(receiver, node!.Loc, Non_null_assertions_can_only_be_used_in_TypeScript_files);
      break;
    case KindAsExpression:
      Parser_jsErrorAtRange(receiver, Node_Type(node)!.Loc, Type_assertion_expressions_can_only_be_used_in_TypeScript_files);
      break;
    case KindSatisfiesExpression:
      Parser_jsErrorAtRange(receiver, Node_Type(node)!.Loc, Type_satisfaction_expressions_can_only_be_used_in_TypeScript_files);
      break;
  }
  // Check decorator placement in JS files
  Parser_checkJSDecoratorSyntax(receiver, node);
  // Check absence of type parameters, type arguments and non-JavaScript modifiers
  switch (node!.Kind) {
    case KindClassDeclaration:
    case KindClassExpression:
    case KindMethodDeclaration:
    case KindConstructor:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindFunctionExpression:
    case KindFunctionDeclaration:
    case KindArrowFunction: {
      const list = Node_TypeParameterList(node);
      if (list !== undefined && Some(list.Nodes, (n: GoPtr<Node>): bool => (n!.Flags & NodeFlagsReparsed) === 0)) {
        Parser_jsErrorAtRange(receiver, list.Loc, Type_parameter_declarations_can_only_be_used_in_TypeScript_files);
      }
    }
    // fallthrough
    // eslint-disable-next-line no-fallthrough
    case KindVariableStatement:
    case KindPropertyDeclaration:
      for (const modifier of (Node_ModifierNodes(node) ?? [])) {
        if ((modifier!.Flags & NodeFlagsReparsed) === 0 && modifier!.Kind !== KindDecorator && (ModifierToFlag(modifier!.Kind) & ModifierFlagsJavaScript) === 0) {
          Parser_jsErrorAtRange(receiver, modifier!.Loc, The_0_modifier_can_only_be_used_in_TypeScript_files, TokenToString(modifier!.Kind));
        }
      }
      break;
    case KindParameter:
      if (Some(Node_ModifierNodes(node) ?? [], IsModifier)) {
        Parser_jsErrorAtRange(receiver, Node_Modifiers(node)!.Loc, Parameter_modifiers_can_only_be_used_in_TypeScript_files);
      }
      break;
    case KindCallExpression:
    case KindNewExpression:
    case KindExpressionWithTypeArguments:
    case KindJsxSelfClosingElement:
    case KindJsxOpeningElement:
    case KindTaggedTemplateExpression: {
      const list = Node_TypeArgumentList(node);
      if (list !== undefined && Some(list.Nodes, (n: GoPtr<Node>): bool => (n!.Flags & NodeFlagsReparsed) === 0)) {
        Parser_jsErrorAtRange(receiver, list.Loc, Type_arguments_can_only_be_used_in_TypeScript_files);
      }
      break;
    }
  }
  return node;
}
