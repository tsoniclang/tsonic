import type { bool, int } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { ModifierList, Node, NodeList } from "../../ast/spine.js";
import type { ObjectLiteralExpression } from "../../ast/generated/data.js";
import type { Expression, Statement, TypeNode } from "../../ast/generated/unions.js";
import type { SourceFile } from "../../ast/ast.js";
import type { Kind } from "../../ast/generated/kinds.js";
import type { OperatorPrecedence } from "../../ast/precedence.js";
import type { Tristate } from "../../core/tristate.js";
import type { jsdocScannerInfo, Parser } from "./state.js";
import { PCArrayBindingElements, PCArrayLiteralMembers, PCClassMembers, PCObjectBindingElements, PCObjectLiteralMembers } from "./state.js";
import { jsdocScannerInfoHasJSDoc } from "./state.js";
import { FindIndex, IfElse, Some } from "../../core/core.js";
import { NewTextRange } from "../../core/text.js";
import { LanguageVariantJSX } from "../../core/languagevariant.js";
import { TSFalse, TSTrue, TSUnknown } from "../../core/tristate.js";
import {
  KindArrayBindingPattern,
  KindAsKeyword,
  KindAsteriskAsteriskToken,
  KindAsteriskToken,
  KindAsyncKeyword,
  KindAtToken,
  KindAwaitKeyword,
  KindBigIntLiteral,
  KindClassExpression,
  KindClassKeyword,
  KindCallSignature,
  KindClassDeclaration,
  KindCloseBraceToken,
  KindCloseBracketToken,
  KindCloseParenToken,
  KindColonToken,
  KindCommaToken,
  KindConstKeyword,
  KindConstructSignature,
  KindDeleteKeyword,
  KindDotDotDotToken,
  KindDotToken,
  KindEqualsGreaterThanToken,
  KindEqualsToken,
  KindEndOfFile,
  KindExclamationToken,
  KindExpressionWithTypeArguments,
  KindExtendsKeyword,
  KindFalseKeyword,
  KindFunctionKeyword,
  KindGetAccessor,
  KindGetKeyword,
  KindGreaterThanToken,
  KindIdentifier,
  KindImportKeyword,
  KindInKeyword,
  KindAssertKeyword,
  KindWithKeyword,
  KindLessThanToken,
  KindMinusMinusToken,
  KindMinusToken,
  KindNewKeyword,
  KindNoSubstitutionTemplateLiteral,
  KindNullKeyword,
  KindNumericLiteral,
  KindObjectBindingPattern,
  KindOpenBraceToken,
  KindOpenBracketToken,
  KindOpenParenToken,
  KindPlusPlusToken,
  KindPlusToken,
  KindConstructorType,
  KindFunctionType,
  KindParenthesizedType,
  KindPrivateIdentifier,
  KindPropertyAssignment,
  KindQuestionDotToken,
  KindQuestionToken,
  KindTypeReference,
  KindRegularExpressionLiteral,
  KindSatisfiesKeyword,
  KindSemicolonToken,
  KindSetAccessor,
  KindSetKeyword,
  KindSlashEqualsToken,
  KindSlashToken,
  KindStringLiteral,
  KindSuperKeyword,
  KindTemplateHead,
  KindTemplateMiddle,
  KindThisKeyword,
  KindTildeToken,
  KindTrueKeyword,
  KindTypeAssertionExpression,
  KindTypeOfKeyword,
  KindUnknown,
  KindUsingKeyword,
  KindVoidKeyword,
  KindYieldKeyword,
} from "../../ast/generated/kinds.js";
import {
  NodeFlagsAwaitContext,
  NodeFlagsDecoratorContext,
  NodeFlagsDisallowInContext,
  NodeFlagsJavaScriptFile,
  NodeFlagsNone,
  NodeFlagsOptionalChain,
  NodeFlagsPossiblyContainsDynamicImport,
  NodeFlagsPossiblyContainsImportMeta,
  NodeFlagsYieldContext,
} from "../../ast/generated/flags.js";
import { TokenFlagsIsInvalid, TokenFlagsNone, TokenFlagsUnterminated } from "../../ast/tokenflags.js";
import {
  NewArrayLiteralExpression,
  NewArrowFunction,
  NewAsExpression,
  NewAwaitExpression,
  NewBigIntLiteral,
  NewBinaryExpression,
  NewBindingElement,
  NewBindingPattern,
  NewCallExpression,
  NewCallSignatureDeclaration,
  NewClassDeclaration,
  NewClassExpression,
  NewConditionalExpression,
  NewConstructSignatureDeclaration,
  NewDeleteExpression,
  NewElementAccessExpression,
  NewEnumMember,
  NewExpressionStatement,
  NewExpressionWithTypeArguments,
  NewFunctionExpression,
  NewKeywordExpression,
  NewLabeledStatement,
  NewMetaProperty,
  NewMissingDeclaration,
  NewNewExpression,
  NewNonNullExpression,
  NewNoSubstitutionTemplateLiteral,
  NewNumericLiteral,
  NewObjectLiteralExpression,
  NewOmittedExpression,
  NewParameterDeclaration,
  NewParenthesizedExpression,
  NewPostfixUnaryExpression,
  NewPrefixUnaryExpression,
  NewPropertyAccessExpression,
  NewPropertyAssignment,
  NewRegularExpressionLiteral,
  NewSatisfiesExpression,
  NewShorthandPropertyAssignment,
  NewSpreadAssignment,
  NewSpreadElement,
  NewStringLiteral,
  NewTaggedTemplateExpression,
  NewTemplateExpression,
  NewTemplateHead,
  NewTemplateMiddle,
  NewTemplateSpan,
  NewTemplateTail,
  NewVoidExpression,
  NewYieldExpression,
} from "../../ast/generated/factory.js";
import { AsBinaryExpression, AsExpressionWithTypeArguments, AsHeritageClause, AsPropertyAssignment, AsStringLiteral, AsNumericLiteral, AsNoSubstitutionTemplateLiteral, AsTemplateSpan, AsTypeReferenceNode } from "../../ast/generated/casts.js";
import { IsBinaryExpression, IsExpressionWithTypeArguments, IsModifierKind, IsPrivateIdentifier, IsAssignmentOperator } from "../../ast/generated/predicates.js";
import { Set_Add, Set_Has } from "../../collections/set.js";
import { Assert } from "../../debug/debug.js";
import { ModifierFlagsAmbient, ModifiersToFlags } from "../../ast/modifierflags.js";
import { Node_End, Node_Pos, Node_Name, Node_FunctionLikeData, NodeList_Pos, NodeList_End } from "../../ast/spine.js";
import { Scanner_ReScanTemplateToken, Scanner_ResetPos, Scanner_TokenFlags, Scanner_TokenFullStart, Scanner_TokenStart, Scanner_TokenText, Scanner_TokenValue, SkipTrivia, TokenToString } from "../../scanner/scanner.js";
import { tokenIsIdentifierOrKeyword, GetTextOfNodeFromSourceText } from "../../scanner/utilities.js";
import { isKeywordOrPunctuation } from "../../parser/utilities.js";
import {
  An_element_access_expression_should_take_an_argument,
  An_instantiation_expression_cannot_be_followed_by_a_property_access,
  An_optional_chain_cannot_contain_private_identifiers,
  An_unary_expression_with_the_0_operator_is_not_allowed_in_the_left_hand_side_of_an_exponentiation_expression_Consider_enclosing_the_expression_in_parentheses,
  A_type_assertion_expression_is_not_allowed_in_the_left_hand_side_of_an_exponentiation_expression_Consider_enclosing_the_expression_in_parentheses,
  Expression_expected,
  Identifier_expected,
  Invalid_optional_chain_from_new_expression_Did_you_mean_to_call_0,
  Property_assignment_expected,
  String_literal_with_double_quotes_expected,
  X_0_expected,
  X_super_may_not_use_type_arguments,
  X_super_must_be_followed_by_an_argument_list_or_member_access,
} from "../../diagnostics/generated/messages.js";
import { Diagnostic_Pos, NewDiagnostic } from "../../ast/diagnostic.js";
import { GetBinaryOperatorPrecedence, OperatorPrecedenceHighest, OperatorPrecedenceInvalid, OperatorPrecedenceLowest } from "../../ast/precedence.js";
import { IsLeftHandSideExpression, IsKeyword, IsClassMemberModifier, NodeIsMissing, NodeIsPresent } from "../../ast/utilities.js";
import { NodeFactory_NewModifier, Node_Text, Node_TypeArgumentList, Node_Type, NodeFactory_NewSourceFile, SourceFile_ParseOptions } from "../../ast/ast.js";
import { Arena_NewSlice1, Arena_Clone } from "../../core/arena.js";
import { getErrorSpanForNode, isDoubleQuotedString } from "./statements-declarations.js";
import { isMissingNodeList, Parser_parseParametersWorker } from "./lists.js";
import { Parser_tryReparseOptionalChain, Parser_canParseSemicolon, Parser_validateJsonValue } from "./support.js";
import { ParseFlagsAwait, ParseFlagsIgnoreMissingOpenBrace, ParseFlagsNone, ParseFlagsType, ParseFlagsYield } from "../types.js";
import {
  Parser_createMissingList,
  Parser_newModifierList,
  Parser_newNodeList,
  Parser_parseArgumentList,
  Parser_parseDelimitedList,
  Parser_parseList,
  Parser_parseParameters,
  modifierListHasAsync,
} from "./lists.js";
import {
  Parser_checkJSSyntax,
  Parser_finishNode,
  Parser_isImplementsClause,
  Parser_lookAhead,
  Parser_mark,
  Parser_nodePos,
  Parser_parseInitializer,
  Parser_parseModifiers,
  Parser_parseModifiersEx,
  Parser_parseOptional,
  Parser_parsePropertyName,
  Parser_rewind,
  Parser_tryParseSemicolon,
} from "./support.js";
import {
  Parser_parseHeritageClauses,
  Parser_parseReturnType,
  Parser_parseType,
  Parser_parseTypeAssertion,
  Parser_parseTypeOfExpression,
  Parser_parseTypeMemberSemicolon,
  Parser_parseTypeParameters,
  Parser_tryParseTypeArgumentsInExpression,
  Parser_unparseExpressionWithTypeArguments,
} from "./types.js";
import { Parser_parseErrorAt, Parser_parseErrorAtRange } from "./errors-recovery.js";
import { Parser_parseJsxElementOrSelfClosingElementOrFragment } from "./jsx-jsdoc.js";
import { Parser_withJSDoc } from "../jsdoc.js";
import {
  isExportModifier,
  Parser_hasPrecedingLineBreak,
  Parser_isNextTokenOpenParenOrLessThanOrDot,
  Parser_isStartOfStatement,
  Parser_nextTokenIsDot,
  Parser_nextTokenIsFunctionKeywordOnSameLine,
  Parser_parseAccessorDeclaration,
  Parser_parseClassElement,
  Parser_parseErrorForMissingSemicolonAfter,
  Parser_parseFunctionBlock,
  Parser_parseIdentifierWithDiagnostic,
  Parser_parseMethodDeclaration,
  Parser_parseRightSideOfDot,
  Parser_parseStatement,
} from "./statements-declarations.js";
import {
  doInContext,
  Parser_createIdentifier,
  Parser_createMissingIdentifier,
  Parser_internIdentifier,
  Parser_isBindingIdentifier,
  Parser_isIdentifier,
  Parser_jsdocScannerInfo,
  Parser_nextToken,
  Parser_nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLine,
  Parser_nextTokenIsIdentifier,
  Parser_nextTokenIsIdentifierOrKeyword,
  Parser_nextTokenIsIdentifierOrKeywordOrGreaterThan,
  Parser_nextTokenIsOpenParenOrLessThan,
  Parser_parseContextualModifier,
  Parser_parseErrorAtCurrentToken,
  Parser_parseExpected,
  Parser_parseExpectedMatchingBrackets,
  Parser_parseExpectedToken,
  Parser_parseIdentifierName,
  Parser_parseIdentifierOrPattern,
  Parser_parseOptionalBindingIdentifier,
  Parser_parseOptionalToken,
  Parser_parsePrivateIdentifier,
  Parser_parseIdentifier,
  Parser_parseTokenNode,
  Parser_reScanGreaterThanToken,
  Parser_reScanSlashToken,
  Parser_setContextFlags,
  Parser_skipRangeTrivia,
  Parser_inDisallowInContext,
  Parser_inDecoratorContext,
} from "./tokens-speculation.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.validateJsonObjectLiteral","kind":"method","status":"implemented","sigHash":"f01a1bda1ead0947ae5574a95580d2f2a6a265643ed170dc100ee4223f5e2bad","bodyHash":"928e2f23d89f22da40a31344df8c35a9bd7a0ffd4276d1dcf3683abf69882bcc"}
 *
 * Go source:
 * func (p *Parser) validateJsonObjectLiteral(sourceFile *ast.SourceFile, node *ast.ObjectLiteralExpression) {
 * 	for _, element := range node.Properties.Nodes {
 * 		if element.Kind != ast.KindPropertyAssignment {
 * 			p.diagnostics = append(p.diagnostics, ast.NewDiagnostic(sourceFile, getErrorSpanForNode(p.sourceText, element), diagnostics.Property_assignment_expected))
 * 			continue
 * 		}
 * 		if element.Name() != nil && !isDoubleQuotedString(element.Name()) {
 * 			p.diagnostics = append(p.diagnostics, ast.NewDiagnostic(sourceFile, getErrorSpanForNode(p.sourceText, element.Name()), diagnostics.String_literal_with_double_quotes_expected))
 * 		}
 * 		p.validateJsonValue(sourceFile, element.AsPropertyAssignment().Initializer)
 * 	}
 * }
 */
export function Parser_validateJsonObjectLiteral(receiver: GoPtr<Parser>, sourceFile: GoPtr<SourceFile>, node: GoPtr<ObjectLiteralExpression>): void {
  for (const element of node!.Properties!.Nodes!) {
    if (element!.Kind !== KindPropertyAssignment) {
      receiver!.diagnostics.push(NewDiagnostic(sourceFile, getErrorSpanForNode(receiver!.sourceText, element), Property_assignment_expected));
      continue;
    }
    const elementName = Node_Name(element);
    if (elementName !== undefined && !isDoubleQuotedString(elementName)) {
      receiver!.diagnostics.push(NewDiagnostic(sourceFile, getErrorSpanForNode(receiver!.sourceText, elementName), String_literal_with_double_quotes_expected));
    }
    Parser_validateJsonValue(receiver, sourceFile, AsPropertyAssignment(element)!.Initializer);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.reparseTopLevelAwait","kind":"method","status":"implemented","sigHash":"f4549f86a14a062f75c0f2b6198d575d5462f7af6e004cfade6da41607e62ef9","bodyHash":"26d975b1fd4b242b40627eb175875595596cfe8ab77d1cc79e7bb2fd43ee837d"}
 *
 * Go source:
 * func (p *Parser) reparseTopLevelAwait(sourceFile *ast.SourceFile) *ast.Node {
 * 	if len(p.possibleAwaitSpans)%2 == 1 {
 * 		panic("possibleAwaitSpans malformed: odd number of indices, not paired into spans.")
 * 	}
 * 	statements := []*ast.Statement{}
 * 	savedParseDiagnostics := p.diagnostics
 * 	p.diagnostics = []*ast.Diagnostic{}
 * 
 * 	afterAwaitStatement := 0
 * 	for i := 0; i < len(p.possibleAwaitSpans); i += 2 {
 * 		nextAwaitStatement := p.possibleAwaitSpans[i]
 * 		// append all non-await statements between afterAwaitStatement and nextAwaitStatement
 * 		prevStatement := sourceFile.Statements.Nodes[afterAwaitStatement]
 * 		nextStatement := sourceFile.Statements.Nodes[nextAwaitStatement]
 * 		statements = append(statements, sourceFile.Statements.Nodes[afterAwaitStatement:nextAwaitStatement]...)
 * 
 * 		// append all diagnostics associated with the copied range
 * 		diagnosticStart := core.FindIndex(savedParseDiagnostics, func(diagnostic *ast.Diagnostic) bool {
 * 			return diagnostic.Pos() >= prevStatement.Pos()
 * 		})
 * 		var diagnosticEnd int
 * 		if diagnosticStart >= 0 {
 * 			diagnosticEnd = core.FindIndex(savedParseDiagnostics[diagnosticStart:], func(diagnostic *ast.Diagnostic) bool {
 * 				return diagnostic.Pos() >= nextStatement.Pos()
 * 			})
 * 		} else {
 * 			diagnosticEnd = -1
 * 		}
 * 		if diagnosticStart >= 0 {
 * 			var slice []*ast.Diagnostic
 * 			if diagnosticEnd >= 0 {
 * 				slice = savedParseDiagnostics[diagnosticStart : diagnosticStart+diagnosticEnd]
 * 			} else {
 * 				slice = savedParseDiagnostics[diagnosticStart:]
 * 			}
 * 			p.diagnostics = append(p.diagnostics, slice...)
 * 		}
 * 
 * 		state := p.mark()
 * 		// reparse all statements between start and pos. We skip existing diagnostics for the same range and allow the parser to generate new ones.
 * 		p.contextFlags |= ast.NodeFlagsAwaitContext
 * 		p.scanner.ResetPos(nextStatement.Pos())
 * 		p.nextToken()
 * 
 * 		afterAwaitStatement = p.possibleAwaitSpans[i+1]
 * 		for p.token != ast.KindEndOfFile {
 * 			startPos := p.scanner.TokenFullStart()
 * 			statement := p.parseStatement()
 * 			statements = append(statements, statement)
 * 			if startPos == p.scanner.TokenFullStart() {
 * 				p.nextToken()
 * 			}
 * 			if afterAwaitStatement < len(sourceFile.Statements.Nodes) {
 * 				lastAwaitStatement := sourceFile.Statements.Nodes[afterAwaitStatement-1]
 * 				if statement.End() == lastAwaitStatement.End() {
 * 					// done reparsing this section
 * 					break
 * 				}
 * 				if statement.End() > lastAwaitStatement.End() {
 * 					// we ate into the next statement, so we must continue reparsing the next span
 * 					i += 2
 * 					if i < len(p.possibleAwaitSpans) {
 * 						afterAwaitStatement = p.possibleAwaitSpans[i+1]
 * 					} else {
 * 						afterAwaitStatement = len(sourceFile.Statements.Nodes)
 * 					}
 * 				}
 * 			}
 * 		}
 * 
 * 		// Keep diagnostics from the reparse
 * 		state.diagnosticsLen = len(p.diagnostics)
 * 		p.rewind(state)
 * 	}
 * 
 * 	// append all statements between pos and the end of the list
 * 	if afterAwaitStatement < len(sourceFile.Statements.Nodes) {
 * 		prevStatement := sourceFile.Statements.Nodes[afterAwaitStatement]
 * 		statements = append(statements, sourceFile.Statements.Nodes[afterAwaitStatement:]...)
 * 
 * 		// append all diagnostics associated with the copied range
 * 		diagnosticStart := core.FindIndex(savedParseDiagnostics, func(diagnostic *ast.Diagnostic) bool {
 * 			return diagnostic.Pos() >= prevStatement.Pos()
 * 		})
 * 		if diagnosticStart >= 0 {
 * 			p.diagnostics = append(p.diagnostics, savedParseDiagnostics[diagnosticStart:]...)
 * 		}
 * 	}
 * 
 * 	result := p.factory.NewSourceFile(sourceFile.ParseOptions(), p.sourceText, p.newNodeList(sourceFile.Statements.Loc, statements), sourceFile.EndOfFileToken)
 * 	for _, s := range statements {
 * 		s.Parent = result.AsNode() // force (re)set parent to reparsed source file
 * 	}
 * 	return result
 * }
 */
export function Parser_reparseTopLevelAwait(receiver: GoPtr<Parser>, sourceFile: GoPtr<SourceFile>): GoPtr<Node> {
  if (receiver!.possibleAwaitSpans.length % 2 === 1) {
    throw new globalThis.Error("possibleAwaitSpans malformed: odd number of indices, not paired into spans.");
  }
  const statements: GoSlice<GoPtr<Node>> = [];
  const savedParseDiagnostics = receiver!.diagnostics;
  receiver!.diagnostics = [];

  let afterAwaitStatement = 0;
  for (let i = 0; i < receiver!.possibleAwaitSpans.length; i += 2) {
    const nextAwaitStatement = receiver!.possibleAwaitSpans[i];
    // append all non-await statements between afterAwaitStatement and nextAwaitStatement
    const prevStatement = sourceFile!.Statements!.Nodes[afterAwaitStatement];
    const nextStatement = sourceFile!.Statements!.Nodes[nextAwaitStatement!];
    statements.push(...sourceFile!.Statements!.Nodes.slice(afterAwaitStatement, nextAwaitStatement));

    // append all diagnostics associated with the copied range
    const diagnosticStart = FindIndex(savedParseDiagnostics, (diagnostic) => {
      return Diagnostic_Pos(diagnostic) >= Node_Pos(prevStatement);
    });
    let diagnosticEnd: int;
    if (diagnosticStart >= 0) {
      diagnosticEnd = FindIndex(savedParseDiagnostics.slice(diagnosticStart), (diagnostic) => {
        return Diagnostic_Pos(diagnostic) >= Node_Pos(nextStatement);
      });
    } else {
      diagnosticEnd = -1;
    }
    if (diagnosticStart >= 0) {
      if (diagnosticEnd >= 0) {
        receiver!.diagnostics.push(...savedParseDiagnostics.slice(diagnosticStart, diagnosticStart + diagnosticEnd));
      } else {
        receiver!.diagnostics.push(...savedParseDiagnostics.slice(diagnosticStart));
      }
    }

    const state = Parser_mark(receiver);
    // reparse all statements between start and pos. We skip existing diagnostics for the same range and allow the parser to generate new ones.
    receiver!.contextFlags |= NodeFlagsAwaitContext;
    Scanner_ResetPos(receiver!.scanner, Node_Pos(nextStatement));
    Parser_nextToken(receiver);

    afterAwaitStatement = receiver!.possibleAwaitSpans[i + 1]!;
    while (receiver!.token !== KindEndOfFile) {
      const startPos = Scanner_TokenFullStart(receiver!.scanner);
      const statement = Parser_parseStatement(receiver);
      statements.push(statement);
      if (startPos === Scanner_TokenFullStart(receiver!.scanner)) {
        Parser_nextToken(receiver);
      }
      if (afterAwaitStatement < sourceFile!.Statements!.Nodes.length) {
        const lastAwaitStatement = sourceFile!.Statements!.Nodes[afterAwaitStatement - 1];
        if (Node_End(statement) === Node_End(lastAwaitStatement)) {
          // done reparsing this section
          break;
        }
        if (Node_End(statement) > Node_End(lastAwaitStatement)) {
          // we ate into the next statement, so we must continue reparsing the next span
          i += 2;
          if (i < receiver!.possibleAwaitSpans.length) {
            afterAwaitStatement = receiver!.possibleAwaitSpans[i + 1]!;
          } else {
            afterAwaitStatement = sourceFile!.Statements!.Nodes.length;
          }
        }
      }
    }

    // Keep diagnostics from the reparse
    state.diagnosticsLen = receiver!.diagnostics.length;
    Parser_rewind(receiver, state);
  }

  // append all statements between pos and the end of the list
  if (afterAwaitStatement < sourceFile!.Statements!.Nodes.length) {
    const prevStatement2 = sourceFile!.Statements!.Nodes[afterAwaitStatement];
    statements.push(...sourceFile!.Statements!.Nodes.slice(afterAwaitStatement));

    // append all diagnostics associated with the copied range
    const diagnosticStart2 = FindIndex(savedParseDiagnostics, (diagnostic) => {
      return Diagnostic_Pos(diagnostic) >= Node_Pos(prevStatement2);
    });
    if (diagnosticStart2 >= 0) {
      receiver!.diagnostics.push(...savedParseDiagnostics.slice(diagnosticStart2));
    }
  }

  const result = NodeFactory_NewSourceFile(receiver!.factory, SourceFile_ParseOptions(sourceFile), receiver!.sourceText, Parser_newNodeList(receiver, sourceFile!.Statements!.Loc, statements), sourceFile!.EndOfFileToken);
  for (const s of statements) {
    s!.Parent = result;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExpressionOrLabeledStatement","kind":"method","status":"implemented","sigHash":"4b76b2e0ab17d3ae5d6b7c2a3ce7b9117931602f619267036ddaa4fe9ef176ba","bodyHash":"588406ecb0fb8bce88cf319885ef17e73acb058e96c56e65e575f45e70855bd8"}
 *
 * Go source:
 * func (p *Parser) parseExpressionOrLabeledStatement() *ast.Statement {
 * 	// Avoiding having to do the lookahead for a labeled statement by just trying to parse
 * 	// out an expression, seeing if it is identifier and then seeing if it is followed by
 * 	// a colon.
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	hasParen := p.token == ast.KindOpenParenToken
 * 	expression := p.parseExpression()
 * 
 * 	if expression.Kind == ast.KindIdentifier && p.parseOptional(ast.KindColonToken) {
 * 		result := p.finishNode(p.factory.NewLabeledStatement(expression, p.parseStatement()), pos)
 * 		p.withJSDoc(result, jsdoc)
 * 		return result
 * 	}
 * 
 * 	if !p.tryParseSemicolon() {
 * 		p.parseErrorForMissingSemicolonAfter(expression)
 * 	}
 * 	result := p.finishNode(p.factory.NewExpressionStatement(expression), pos)
 * 	if hasParen {
 * 		jsdoc &^= jsdocScannerInfoHasJSDoc
 * 	}
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseExpressionOrLabeledStatement(receiver: GoPtr<Parser>): GoPtr<Statement> {
  // Avoiding having to do the lookahead for a labeled statement by just trying to parse
  // out an expression, seeing if it is identifier and then seeing if it is followed by
  // a colon.
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  const hasParen = receiver!.token === KindOpenParenToken;
  const expression = Parser_parseExpression(receiver);

  if (expression!.Kind === KindIdentifier && Parser_parseOptional(receiver, KindColonToken)) {
    const labeledResult = Parser_finishNode(receiver, NewLabeledStatement(receiver!.factory, expression, Parser_parseStatement(receiver)), pos);
    Parser_withJSDoc(receiver, labeledResult, jsdoc);
    return labeledResult;
  }

  if (!Parser_tryParseSemicolon(receiver)) {
    Parser_parseErrorForMissingSemicolonAfter(receiver, expression);
  }
  const result = Parser_finishNode(receiver, NewExpressionStatement(receiver!.factory, expression), pos);
  const finalJsdoc = hasParen ? jsdoc & ~jsdocScannerInfoHasJSDoc : jsdoc;
  Parser_withJSDoc(receiver, result, finalJsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseArrayBindingPattern","kind":"method","status":"implemented","sigHash":"bb054a0e76e6d581038f6edd9548becd51e48587aa99483e927cdddcf14e66d6","bodyHash":"759e860920e4884eb31e30791097c34fd33c817466d10ed29f8da2a8c75ca2c0"}
 *
 * Go source:
 * func (p *Parser) parseArrayBindingPattern() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindOpenBracketToken)
 * 	saveContextFlags := p.contextFlags
 * 	p.setContextFlags(ast.NodeFlagsDisallowInContext, false)
 * 	elements := p.parseDelimitedList(PCArrayBindingElements, (*Parser).parseArrayBindingElement)
 * 	p.contextFlags = saveContextFlags
 * 	p.parseExpected(ast.KindCloseBracketToken)
 * 	return p.finishNode(p.factory.NewBindingPattern(ast.KindArrayBindingPattern, elements), pos)
 * }
 */
export function Parser_parseArrayBindingPattern(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindOpenBracketToken);
  const saveContextFlags = receiver!.contextFlags;
  Parser_setContextFlags(receiver, NodeFlagsDisallowInContext, false);
  const elements = Parser_parseDelimitedList(receiver, PCArrayBindingElements, Parser_parseArrayBindingElement);
  receiver!.contextFlags = saveContextFlags;
  Parser_parseExpected(receiver, KindCloseBracketToken);
  return Parser_finishNode(receiver, NewBindingPattern(receiver!.factory, KindArrayBindingPattern, elements), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseArrayBindingElement","kind":"method","status":"implemented","sigHash":"35a442d14100cf3fd4f6f7d1d0e555f6a6ffb818ba00c70f5f8d20fa8d205139","bodyHash":"e4f66c73ed092a1d81f4b3a6bff01e054185db8446929dd3d0f4ce77a328aa37"}
 *
 * Go source:
 * func (p *Parser) parseArrayBindingElement() *ast.Node {
 * 	pos := p.nodePos()
 * 	var dotDotDotToken *ast.Node
 * 	var name *ast.Node
 * 	var initializer *ast.Expression
 * 	if p.token != ast.KindCommaToken {
 * 		// These are all nil for a missing element
 * 		dotDotDotToken = p.parseOptionalToken(ast.KindDotDotDotToken)
 * 		name = p.parseIdentifierOrPattern()
 * 		initializer = p.parseInitializer()
 * 	}
 * 	return p.finishNode(p.factory.NewBindingElement(dotDotDotToken, nil /*propertyName* /, name, initializer), pos)
 * }
 */
export function Parser_parseArrayBindingElement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const isElement = receiver!.token !== KindCommaToken;
  // These are all nil for a missing element
  const dotDotDotToken = isElement ? Parser_parseOptionalToken(receiver, KindDotDotDotToken) : undefined;
  const name = isElement ? Parser_parseIdentifierOrPattern(receiver) : undefined;
  const initializer = isElement ? Parser_parseInitializer(receiver) : undefined;
  return Parser_finishNode(receiver, NewBindingElement(receiver!.factory, dotDotDotToken, undefined /*propertyName*/, name, initializer), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseObjectBindingPattern","kind":"method","status":"implemented","sigHash":"c71fd0f1526e452b5a5a72c3906bfbb97517803cc51770ff0d37704d966b3ebe","bodyHash":"27c71e2b634f2421499743ad0e136f24efc62aeab518081c56ba84ceb9d5a787"}
 *
 * Go source:
 * func (p *Parser) parseObjectBindingPattern() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindOpenBraceToken)
 * 	saveContextFlags := p.contextFlags
 * 	p.setContextFlags(ast.NodeFlagsDisallowInContext, false)
 * 	elements := p.parseDelimitedList(PCObjectBindingElements, (*Parser).parseObjectBindingElement)
 * 	p.contextFlags = saveContextFlags
 * 	p.parseExpected(ast.KindCloseBraceToken)
 * 	return p.finishNode(p.factory.NewBindingPattern(ast.KindObjectBindingPattern, elements), pos)
 * }
 */
export function Parser_parseObjectBindingPattern(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindOpenBraceToken);
  const saveContextFlags = receiver!.contextFlags;
  Parser_setContextFlags(receiver, NodeFlagsDisallowInContext, false);
  const elements = Parser_parseDelimitedList(receiver, PCObjectBindingElements, Parser_parseObjectBindingElement);
  receiver!.contextFlags = saveContextFlags;
  Parser_parseExpected(receiver, KindCloseBraceToken);
  return Parser_finishNode(receiver, NewBindingPattern(receiver!.factory, KindObjectBindingPattern, elements), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseObjectBindingElement","kind":"method","status":"implemented","sigHash":"30e2edf189291960970fc4f70034608f70724020825c3ce961e809468ed2aefa","bodyHash":"18f7169ed91994bb82152ea0c9b4bd32b72bb5d99a00f8ffb1c2919ba17f77a5"}
 *
 * Go source:
 * func (p *Parser) parseObjectBindingElement() *ast.Node {
 * 	pos := p.nodePos()
 * 	dotDotDotToken := p.parseOptionalToken(ast.KindDotDotDotToken)
 * 	tokenIsIdentifier := p.isBindingIdentifier()
 * 	propertyName := p.parsePropertyName()
 * 	var name *ast.Node
 * 	if tokenIsIdentifier && p.token != ast.KindColonToken {
 * 		name = propertyName
 * 		propertyName = nil
 * 	} else {
 * 		p.parseExpected(ast.KindColonToken)
 * 		name = p.parseIdentifierOrPattern()
 * 	}
 * 	initializer := p.parseInitializer()
 * 	return p.finishNode(p.factory.NewBindingElement(dotDotDotToken, propertyName, name, initializer), pos)
 * }
 */
export function Parser_parseObjectBindingElement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const dotDotDotToken = Parser_parseOptionalToken(receiver, KindDotDotDotToken);
  const tokenIsIdentifier = Parser_isBindingIdentifier(receiver);
  const propertyNameCandidate = Parser_parsePropertyName(receiver);
  const isShorthand = tokenIsIdentifier && receiver!.token !== KindColonToken;
  const propertyName: GoPtr<Node> = isShorthand ? undefined : propertyNameCandidate;
  const name = ((): GoPtr<Node> => {
    if (isShorthand) {
      return propertyNameCandidate;
    }
    Parser_parseExpected(receiver, KindColonToken);
    return Parser_parseIdentifierOrPattern(receiver);
  })();
  const initializer = Parser_parseInitializer(receiver);
  return Parser_finishNode(receiver, NewBindingElement(receiver!.factory, dotDotDotToken, propertyName, name, initializer), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseClassExpression","kind":"method","status":"implemented","sigHash":"918cc21865afefedfc1303dd1171550cba7ccab194c4d15ef339e0e2b07c4463","bodyHash":"c4137bc7a7bedfbb522749cb20622c0904c658089fb070e1b3bb83d7da9cd692"}
 *
 * Go source:
 * func (p *Parser) parseClassExpression() *ast.Node {
 * 	return p.parseClassDeclarationOrExpression(p.nodePos(), p.jsdocScannerInfo(), nil /*modifiers* /, ast.KindClassExpression)
 * }
 */
export function Parser_parseClassExpression(receiver: GoPtr<Parser>): GoPtr<Node> {
  return Parser_parseClassDeclarationOrExpression(receiver, Parser_nodePos(receiver), Parser_jsdocScannerInfo(receiver), undefined /*modifiers*/, KindClassExpression);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseClassDeclarationOrExpression","kind":"method","status":"implemented","sigHash":"3c801caba0c6d201affeeaf3ea48c79c743f5e1133c951615497a8de32bde912","bodyHash":"5778bbcb75d87d9b4210902a0bcea3b3a071dee044e475f43d694b7281d83123"}
 *
 * Go source:
 * func (p *Parser) parseClassDeclarationOrExpression(pos int, jsdoc jsdocScannerInfo, modifiers *ast.ModifierList, kind ast.Kind) *ast.Node {
 * 	saveContextFlags := p.contextFlags
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 	p.parseExpected(ast.KindClassKeyword)
 * 	// We don't parse the name here in await context, instead we will report a grammar error in the checker.
 * 	name := p.parseNameOfClassDeclarationOrExpression()
 * 	typeParameters := p.parseTypeParameters()
 * 	if modifiers != nil && core.Some(modifiers.Nodes, isExportModifier) {
 * 		p.setContextFlags(ast.NodeFlagsAwaitContext, true /*value* /)
 * 	}
 * 	heritageClauses := p.parseHeritageClauses()
 * 	var members *ast.NodeList
 * 	if p.parseExpected(ast.KindOpenBraceToken) {
 * 		// ClassTail[Yield,Await] : (Modified) See 14.5
 * 		//      ClassHeritage[?Yield,?Await]opt { ClassBody[?Yield,?Await]opt }
 * 		members = p.parseList(PCClassMembers, (*Parser).parseClassElement)
 * 		p.parseExpected(ast.KindCloseBraceToken)
 * 	} else {
 * 		members = p.createMissingList()
 * 	}
 * 	p.contextFlags = saveContextFlags
 * 	var result *ast.Node
 * 	if modifiers != nil && ast.ModifiersToFlags(modifiers.Nodes)&ast.ModifierFlagsAmbient != 0 {
 * 		p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 * 	}
 * 	if kind == ast.KindClassDeclaration {
 * 		result = p.factory.NewClassDeclaration(modifiers, name, typeParameters, heritageClauses, members)
 * 	} else {
 * 		result = p.factory.NewClassExpression(modifiers, name, typeParameters, heritageClauses, members)
 * 	}
 * 	p.finishNode(result, pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	if result.Flags&ast.NodeFlagsJavaScriptFile != 0 {
 * 		p.checkJSSyntax(result)
 * 		if heritageClauses != nil {
 * 			for _, clause := range heritageClauses.Nodes {
 * 				if clause.AsHeritageClause().Token == ast.KindExtendsKeyword {
 * 					for _, expr := range clause.AsHeritageClause().Types.Nodes {
 * 						p.checkJSSyntax(expr)
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Parser_parseClassDeclarationOrExpression(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>, kind: Kind): GoPtr<Node> {
  const saveContextFlags = receiver!.contextFlags;
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
  Parser_parseExpected(receiver, KindClassKeyword);
  // We don't parse the name here in await context, instead we will report a grammar error in the checker.
  const name = Parser_parseNameOfClassDeclarationOrExpression(receiver);
  const typeParameters = Parser_parseTypeParameters(receiver);
  if (modifiers !== undefined && Some(modifiers.Nodes, isExportModifier)) {
    Parser_setContextFlags(receiver, NodeFlagsAwaitContext, true /*value*/);
  }
  const heritageClauses = Parser_parseHeritageClauses(receiver);
  const members = ((): GoPtr<NodeList> => {
    if (Parser_parseExpected(receiver, KindOpenBraceToken)) {
      // ClassTail[Yield,Await] : (Modified) See 14.5
      //      ClassHeritage[?Yield,?Await]opt { ClassBody[?Yield,?Await]opt }
      const m = Parser_parseList(receiver, PCClassMembers, Parser_parseClassElement);
      Parser_parseExpected(receiver, KindCloseBraceToken);
      return m;
    }
    return Parser_createMissingList(receiver);
  })();
  receiver!.contextFlags = saveContextFlags;
  if (modifiers !== undefined && (ModifiersToFlags(modifiers.Nodes) & ModifierFlagsAmbient) !== 0) {
    receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;
  }
  const result =
    kind === KindClassDeclaration
      ? NewClassDeclaration(receiver!.factory, modifiers, name, typeParameters, heritageClauses, members)
      : NewClassExpression(receiver!.factory, modifiers, name, typeParameters, heritageClauses, members);
  Parser_finishNode(receiver, result, pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  if ((result!.Flags & NodeFlagsJavaScriptFile) !== 0) {
    Parser_checkJSSyntax(receiver, result);
    if (heritageClauses !== undefined) {
      for (const clause of heritageClauses.Nodes) {
        if (AsHeritageClause(clause)!.Token === KindExtendsKeyword) {
          for (const expr of AsHeritageClause(clause)!.Types!.Nodes) {
            Parser_checkJSSyntax(receiver, expr);
          }
        }
      }
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseNameOfClassDeclarationOrExpression","kind":"method","status":"implemented","sigHash":"067d33003ffd77584c1aabbc47b7a0fb0764414db788b4a8ae2bc4eb41cb7739","bodyHash":"83f52567b85529eb7900eecf1f3b0b1cc605a67f3cd3ab17e2307b27e04f0468"}
 *
 * Go source:
 * func (p *Parser) parseNameOfClassDeclarationOrExpression() *ast.Node {
 * 	// implements is a future reserved word so
 * 	// 'class implements' might mean either
 * 	// - class expression with omitted name, 'implements' starts heritage clause
 * 	// - class with name 'implements'
 * 	// 'isImplementsClause' helps to disambiguate between these two cases
 * 	if p.isBindingIdentifier() && !p.isImplementsClause() {
 * 		saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 * 		id := p.createIdentifier(p.isBindingIdentifier())
 * 		p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 * 		return id
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseNameOfClassDeclarationOrExpression(receiver: GoPtr<Parser>): GoPtr<Node> {
  // implements is a future reserved word so
  // 'class implements' might mean either
  // - class expression with omitted name, 'implements' starts heritage clause
  // - class with name 'implements'
  // 'isImplementsClause' helps to disambiguate between these two cases
  if (Parser_isBindingIdentifier(receiver) && !Parser_isImplementsClause(receiver)) {
    const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;
    const id = Parser_createIdentifier(receiver, Parser_isBindingIdentifier(receiver));
    receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;
    return id;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseEnumMember","kind":"method","status":"implemented","sigHash":"b1e025f88e33fffcecfb8e2d3765f0515a5e1e865ed6fea489a3440f9254431f","bodyHash":"b37597f458136f184c20af541b0f3fa65683c695d5ec2109893cfc3c495b077e"}
 *
 * Go source:
 * func (p *Parser) parseEnumMember() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	name := p.parsePropertyName()
 * 	initializer := doInContext(p, ast.NodeFlagsDisallowInContext, false, (*Parser).parseInitializer)
 * 	result := p.finishNode(p.factory.NewEnumMember(name, initializer), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseEnumMember(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  const name = Parser_parsePropertyName(receiver);
  const initializer = doInContext(receiver, NodeFlagsDisallowInContext, false, Parser_parseInitializer);
  const result = Parser_finishNode(receiver, NewEnumMember(receiver!.factory, name, initializer), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.reScanTemplateToken","kind":"method","status":"implemented","sigHash":"f909db3b541653f70066ae4ae55ee05706fc7cc3d48044c45d339adb5233d944","bodyHash":"df7887fc805eee5278b6e25a181d72c08dac171cdf559abb01e878d41cd1fac9"}
 *
 * Go source:
 * func (p *Parser) reScanTemplateToken(isTaggedTemplate bool) ast.Kind {
 * 	p.token = p.scanner.ReScanTemplateToken(isTaggedTemplate)
 * 	return p.token
 * }
 */
export function Parser_reScanTemplateToken(receiver: GoPtr<Parser>, isTaggedTemplate: bool): Kind {
  receiver!.token = Scanner_ReScanTemplateToken(receiver!.scanner, isTaggedTemplate);
  return receiver!.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseSignatureMember","kind":"method","status":"implemented","sigHash":"bbc92acb85b861fbf5d93bbd2002931d60b22a73268e8fa67f2e4f14a32a1bf2","bodyHash":"6ac3ffad8beed40a1f411acd62ee2009212290fc57b532ce0d707ccc13742246"}
 *
 * Go source:
 * func (p *Parser) parseSignatureMember(kind ast.Kind) *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	if kind == ast.KindConstructSignature {
 * 		p.parseExpected(ast.KindNewKeyword)
 * 	}
 * 	typeParameters := p.parseTypeParameters()
 * 	parameters := p.parseParameters(ParseFlagsType)
 * 	typeNode := p.parseReturnType(ast.KindColonToken /*isType* /, true)
 * 	p.parseTypeMemberSemicolon()
 * 	var result *ast.Node
 * 	if kind == ast.KindCallSignature {
 * 		result = p.factory.NewCallSignatureDeclaration(typeParameters, parameters, typeNode)
 * 	} else {
 * 		result = p.factory.NewConstructSignatureDeclaration(typeParameters, parameters, typeNode)
 * 	}
 * 	p.finishNode(result, pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseSignatureMember(receiver: GoPtr<Parser>, kind: Kind): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  if (kind === KindConstructSignature) {
    Parser_parseExpected(receiver, KindNewKeyword);
  }
  const typeParameters = Parser_parseTypeParameters(receiver);
  const parameters = Parser_parseParameters(receiver, ParseFlagsType);
  const typeNode = Parser_parseReturnType(receiver, KindColonToken, true /*isType*/);
  Parser_parseTypeMemberSemicolon(receiver);
  const result =
    kind === KindCallSignature
      ? NewCallSignatureDeclaration(receiver!.factory, typeParameters, parameters, typeNode)
      : NewConstructSignatureDeclaration(receiver!.factory, typeParameters, parameters, typeNode);
  Parser_finishNode(receiver, result, pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTemplateHead","kind":"method","status":"implemented","sigHash":"77bd8e5b9c17cbc2422d943fd5d4f9360121418204a32a516999b421256819a9","bodyHash":"152bed6c9d19251b2b63951981ce1ab8bee9a5fa2cfb050dd84091996bc37ce3"}
 *
 * Go source:
 * func (p *Parser) parseTemplateHead(isTaggedTemplate bool) *ast.Node {
 * 	if !isTaggedTemplate && p.scanner.TokenFlags()&ast.TokenFlagsIsInvalid != 0 {
 * 		p.reScanTemplateToken(false /*isTaggedTemplate* /)
 * 	}
 * 	pos := p.nodePos()
 * 	result := p.factory.NewTemplateHead(p.scanner.TokenValue(), p.getTemplateLiteralRawText(2 /*endLength* /), p.scanner.TokenFlags())
 * 	p.nextToken()
 * 	return p.finishNode(result, pos)
 * }
 */
export function Parser_parseTemplateHead(receiver: GoPtr<Parser>, isTaggedTemplate: bool): GoPtr<Node> {
  if (!isTaggedTemplate && (Scanner_TokenFlags(receiver!.scanner) & TokenFlagsIsInvalid) !== 0) {
    Parser_reScanTemplateToken(receiver, false /*isTaggedTemplate*/);
  }
  const pos = Parser_nodePos(receiver);
  const result = NewTemplateHead(receiver!.factory, Scanner_TokenValue(receiver!.scanner), Parser_getTemplateLiteralRawText(receiver, 2 /*endLength*/), Scanner_TokenFlags(receiver!.scanner));
  Parser_nextToken(receiver);
  return Parser_finishNode(receiver, result, pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.getTemplateLiteralRawText","kind":"method","status":"implemented","sigHash":"982353287090cfc305f68405ab5dcef07ac99e30629450fa0034ff059a6d33fb","bodyHash":"5afc26532dc7aefa36c2dd5a4c6da3b05d7172171796b36bccc03e2e3a7242dc"}
 *
 * Go source:
 * func (p *Parser) getTemplateLiteralRawText(endLength int) string {
 * 	tokenText := p.scanner.TokenText()
 * 	if p.scanner.TokenFlags()&ast.TokenFlagsUnterminated != 0 {
 * 		endLength = 0
 * 	}
 * 	return tokenText[1 : len(tokenText)-endLength]
 * }
 */
export function Parser_getTemplateLiteralRawText(receiver: GoPtr<Parser>, endLength: int): string {
  const tokenText = Scanner_TokenText(receiver!.scanner);
  const effectiveEndLength = (Scanner_TokenFlags(receiver!.scanner) & TokenFlagsUnterminated) !== 0 ? 0 : endLength;
  return tokenText.slice(1, tokenText.length - effectiveEndLength);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseLiteralOfTemplateSpan","kind":"method","status":"implemented","sigHash":"170945570c56dbf9a7a3e531e33b583ba6d9fa64113737ce748c011e7de195f3","bodyHash":"9a3e15896257c9a79439232991998bdfe910bef350970c6bedf7e928e8fbfc36"}
 *
 * Go source:
 * func (p *Parser) parseLiteralOfTemplateSpan(isTaggedTemplate bool) *ast.Node {
 * 	if p.token == ast.KindCloseBraceToken {
 * 		p.reScanTemplateToken(isTaggedTemplate)
 * 		return p.parseTemplateMiddleOrTail()
 * 	}
 * 	p.parseErrorAtCurrentToken(diagnostics.X_0_expected, scanner.TokenToString(ast.KindCloseBraceToken))
 * 	return p.finishNode(p.factory.NewTemplateTail("", "", ast.TokenFlagsNone), p.nodePos())
 * }
 */
export function Parser_parseLiteralOfTemplateSpan(receiver: GoPtr<Parser>, isTaggedTemplate: bool): GoPtr<Node> {
  if (receiver!.token === KindCloseBraceToken) {
    Parser_reScanTemplateToken(receiver, isTaggedTemplate);
    return Parser_parseTemplateMiddleOrTail(receiver);
  }
  Parser_parseErrorAtCurrentToken(receiver, X_0_expected, TokenToString(KindCloseBraceToken));
  return Parser_finishNode(receiver, NewTemplateTail(receiver!.factory, "", "", TokenFlagsNone), Parser_nodePos(receiver));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTemplateMiddleOrTail","kind":"method","status":"implemented","sigHash":"76957ef552bb0272b11e7852b15d954edf10f1950a316b01498c9fcf499168a2","bodyHash":"cdf6e9ccf65a2735ab5320c8052b4957d2191d08728b4b9e44617e64dbe15d12"}
 *
 * Go source:
 * func (p *Parser) parseTemplateMiddleOrTail() *ast.Node {
 * 	pos := p.nodePos()
 * 	var result *ast.Node
 * 	if p.token == ast.KindTemplateMiddle {
 * 		result = p.factory.NewTemplateMiddle(p.scanner.TokenValue(), p.getTemplateLiteralRawText(2 /*endLength* /), p.scanner.TokenFlags())
 * 	} else {
 * 		result = p.factory.NewTemplateTail(p.scanner.TokenValue(), p.getTemplateLiteralRawText(1 /*endLength* /), p.scanner.TokenFlags())
 * 	}
 * 	p.nextToken()
 * 	return p.finishNode(result, pos)
 * }
 */
export function Parser_parseTemplateMiddleOrTail(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const result =
    receiver!.token === KindTemplateMiddle
      ? NewTemplateMiddle(receiver!.factory, Scanner_TokenValue(receiver!.scanner), Parser_getTemplateLiteralRawText(receiver, 2 /*endLength*/), Scanner_TokenFlags(receiver!.scanner))
      : NewTemplateTail(receiver!.factory, Scanner_TokenValue(receiver!.scanner), Parser_getTemplateLiteralRawText(receiver, 1 /*endLength*/), Scanner_TokenFlags(receiver!.scanner));
  Parser_nextToken(receiver);
  return Parser_finishNode(receiver, result, pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsNewKeyword","kind":"method","status":"implemented","sigHash":"39c0da495378133fee143b6672ab68f98016d3c1f8952649ccf914b49f5fb554","bodyHash":"715d10613c9e09ddaa32d075159a3a8f932775fe8b92282ffa811ad195e27f1c"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsNewKeyword() bool {
 * 	return p.nextToken() == ast.KindNewKeyword
 * }
 */
export function Parser_nextTokenIsNewKeyword(receiver: GoPtr<Parser>): bool {
  return Parser_nextToken(receiver) === KindNewKeyword;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseDecoratorExpression","kind":"method","status":"implemented","sigHash":"b628d72e910ee30fe5dd50709282f206ad4e2f255d629389b1371676ba1a8eb5","bodyHash":"a16a20938332ad170408f531357836f5a5ef7ad2bffb29d33285c7a141f0b779"}
 *
 * Go source:
 * func (p *Parser) parseDecoratorExpression() *ast.Expression {
 * 	if p.inAwaitContext() && p.token == ast.KindAwaitKeyword {
 * 		// `@await` is disallowed in an [Await] context, but can cause parsing to go off the rails
 * 		// This simply parses the missing identifier and moves on.
 * 		pos := p.nodePos()
 * 		awaitExpression := p.parseIdentifierWithDiagnostic(diagnostics.Expression_expected, nil)
 * 		p.nextToken()
 * 		memberExpression := p.parseMemberExpressionRest(pos, awaitExpression /*allowOptionalChain* /, true)
 * 		return p.parseCallExpressionRest(pos, memberExpression)
 * 	}
 * 	return p.parseLeftHandSideExpressionOrHigher()
 * }
 */
export function Parser_parseDecoratorExpression(receiver: GoPtr<Parser>): GoPtr<Expression> {
  if (Parser_inAwaitContext(receiver) && receiver!.token === KindAwaitKeyword) {
    // `@await` is disallowed in an [Await] context, but can cause parsing to go off the rails
    // This simply parses the missing identifier and moves on.
    const pos = Parser_nodePos(receiver);
    const awaitExpression = Parser_parseIdentifierWithDiagnostic(receiver, Expression_expected, undefined);
    Parser_nextToken(receiver);
    const memberExpression = Parser_parseMemberExpressionRest(receiver, pos, awaitExpression, true /*allowOptionalChain*/);
    return Parser_parseCallExpressionRest(receiver, pos, memberExpression);
  }
  return Parser_parseLeftHandSideExpressionOrHigher(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsIdentifierOrKeywordOrLiteralOnSameLine","kind":"method","status":"implemented","sigHash":"4f8951f699cc5f9b6e8bcbb8bab504dd427e27ca4d4d1a80c04311c35e2f3ac1","bodyHash":"e5fe4390f287b28c55739fececa35d32395375204ae8b3554a81614144fb9cf8"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsIdentifierOrKeywordOrLiteralOnSameLine() bool {
 * 	return (p.nextTokenIsIdentifierOrKeyword() || p.token == ast.KindNumericLiteral || p.token == ast.KindBigIntLiteral || p.token == ast.KindStringLiteral) && !p.hasPrecedingLineBreak()
 * }
 */
export function Parser_nextTokenIsIdentifierOrKeywordOrLiteralOnSameLine(receiver: GoPtr<Parser>): bool {
  return (Parser_nextTokenIsIdentifierOrKeyword(receiver) || receiver!.token === KindNumericLiteral || receiver!.token === KindBigIntLiteral || receiver!.token === KindStringLiteral) && !Parser_hasPrecedingLineBreak(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExpression","kind":"method","status":"implemented","sigHash":"a7dc0019fcd9b254ccef4371f168cb97fb40714635331fed4a0e623cca7fb364","bodyHash":"66fff2a56f78a6d578ee3659673f40d8e66068e161c90d51ca2046c0e7cf7c21"}
 *
 * Go source:
 * func (p *Parser) parseExpression() *ast.Expression {
 * 	// Expression[in]:
 * 	//      AssignmentExpression[in]
 * 	//      Expression[in] , AssignmentExpression[in]
 * 
 * 	// clear the decorator context when parsing Expression, as it should be unambiguous when parsing a decorator
 * 	saveContextFlags := p.contextFlags
 * 	p.contextFlags &^= ast.NodeFlagsDecoratorContext
 * 	pos := p.nodePos()
 * 	expr := p.parseAssignmentExpressionOrHigher()
 * 	for {
 * 		operatorToken := p.parseOptionalToken(ast.KindCommaToken)
 * 		if operatorToken == nil {
 * 			break
 * 		}
 * 		expr = p.makeBinaryExpression(expr, operatorToken, p.parseAssignmentExpressionOrHigher(), pos)
 * 	}
 * 	p.contextFlags = saveContextFlags
 * 	return expr
 * }
 */
export function Parser_parseExpression(receiver: GoPtr<Parser>): GoPtr<Expression> {
  // Expression[in]:
  //      AssignmentExpression[in]
  //      Expression[in] , AssignmentExpression[in]

  // clear the decorator context when parsing Expression, as it should be unambiguous when parsing a decorator
  const saveContextFlags = receiver!.contextFlags;
  receiver!.contextFlags = receiver!.contextFlags & ~NodeFlagsDecoratorContext;
  const pos = Parser_nodePos(receiver);
  const exprResult = ((): GoPtr<Expression> => {
    const initial = Parser_parseAssignmentExpressionOrHigher(receiver);
    const loop = (expr: GoPtr<Expression>): GoPtr<Expression> => {
      const operatorToken = Parser_parseOptionalToken(receiver, KindCommaToken);
      if (operatorToken === undefined) {
        return expr;
      }
      return loop(Parser_makeBinaryExpression(receiver, expr, operatorToken, Parser_parseAssignmentExpressionOrHigher(receiver), pos));
    };
    return loop(initial);
  })();
  receiver!.contextFlags = saveContextFlags;
  return exprResult;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExpressionAllowIn","kind":"method","status":"implemented","sigHash":"ee2af7df4a0dc6ed8869e3c2fc2d28a71a70774cf09495e5735d89e17c877a9d","bodyHash":"32bc257014791aea4c4ff7543f8213d5da16a9c2f709c0ef75ff5549f459a83f"}
 *
 * Go source:
 * func (p *Parser) parseExpressionAllowIn() *ast.Expression {
 * 	return doInContext(p, ast.NodeFlagsDisallowInContext, false, (*Parser).parseExpression)
 * }
 */
export function Parser_parseExpressionAllowIn(receiver: GoPtr<Parser>): GoPtr<Expression> {
  return doInContext(receiver, NodeFlagsDisallowInContext, false, Parser_parseExpression);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseAssignmentExpressionOrHigher","kind":"method","status":"implemented","sigHash":"738399a56db6e578e313f2be474ecc4d0bf5dbb8eb0397eb97301a8c634cd7b9","bodyHash":"496d9e73bdfd85a6a60eaee02874092a5004825a8361b37db60f786a936a4d29"}
 *
 * Go source:
 * func (p *Parser) parseAssignmentExpressionOrHigher() *ast.Expression {
 * 	return p.parseAssignmentExpressionOrHigherWorker(true /*allowReturnTypeInArrowFunction* /)
 * }
 */
export function Parser_parseAssignmentExpressionOrHigher(receiver: GoPtr<Parser>): GoPtr<Expression> {
  return Parser_parseAssignmentExpressionOrHigherWorker(receiver, true /*allowReturnTypeInArrowFunction*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseAssignmentExpressionOrHigherWorker","kind":"method","status":"implemented","sigHash":"bc62b419ae6eb1319abb63784389f6f42cbb212a561ea79bfcd71195fa9f04be","bodyHash":"6dc18270f8292c8482900c70cf2d0e40f52b54d68d9c101b411f8265186f0fdb"}
 *
 * Go source:
 * func (p *Parser) parseAssignmentExpressionOrHigherWorker(allowReturnTypeInArrowFunction bool) *ast.Expression {
 * 	//  AssignmentExpression[in,yield]:
 * 	//      1) ConditionalExpression[?in,?yield]
 * 	//      2) LeftHandSideExpression = AssignmentExpression[?in,?yield]
 * 	//      3) LeftHandSideExpression AssignmentOperator AssignmentExpression[?in,?yield]
 * 	//      4) ArrowFunctionExpression[?in,?yield]
 * 	//      5) AsyncArrowFunctionExpression[in,yield,await]
 * 	//      6) [+Yield] YieldExpression[?In]
 * 	//
 * 	// Note: for ease of implementation we treat productions '2' and '3' as the same thing.
 * 	// (i.e. they're both BinaryExpressions with an assignment operator in it).
 * 	// First, do the simple check if we have a YieldExpression (production '6').
 * 	if p.isYieldExpression() {
 * 		return p.parseYieldExpression()
 * 	}
 * 	// Then, check if we have an arrow function (production '4' and '5') that starts with a parenthesized
 * 	// parameter list or is an async arrow function.
 * 	// AsyncArrowFunctionExpression:
 * 	//      1) async[no LineTerminator here]AsyncArrowBindingIdentifier[?Yield][no LineTerminator here]=>AsyncConciseBody[?In]
 * 	//      2) CoverCallExpressionAndAsyncArrowHead[?Yield, ?Await][no LineTerminator here]=>AsyncConciseBody[?In]
 * 	// Production (1) of AsyncArrowFunctionExpression is parsed in "tryParseAsyncSimpleArrowFunctionExpression".
 * 	// And production (2) is parsed in "tryParseParenthesizedArrowFunctionExpression".
 * 	//
 * 	// If we do successfully parse arrow-function, we must *not* recurse for productions 1, 2 or 3. An ArrowFunction is
 * 	// not a LeftHandSideExpression, nor does it start a ConditionalExpression.  So we are done
 * 	// with AssignmentExpression if we see one.
 * 	arrowExpression := p.tryParseParenthesizedArrowFunctionExpression(allowReturnTypeInArrowFunction)
 * 	if arrowExpression != nil {
 * 		return arrowExpression
 * 	}
 * 	arrowExpression = p.tryParseAsyncSimpleArrowFunctionExpression(allowReturnTypeInArrowFunction)
 * 	if arrowExpression != nil {
 * 		return arrowExpression
 * 	}
 * 	// arrowExpression2 := p.tryParseAsyncSimpleArrowFunctionExpression(allowReturnTypeInArrowFunction)
 * 	// if arrowExpression2 != nil {
 * 	// 	return arrowExpression2
 * 	// }
 * 	// Now try to see if we're in production '1', '2' or '3'.  A conditional expression can
 * 	// start with a LogicalOrExpression, while the assignment productions can only start with
 * 	// LeftHandSideExpressions.
 * 	//
 * 	// So, first, we try to just parse out a BinaryExpression.  If we get something that is a
 * 	// LeftHandSide or higher, then we can try to parse out the assignment expression part.
 * 	// Otherwise, we try to parse out the conditional expression bit.  We want to allow any
 * 	// binary expression here, so we pass in the 'lowest' precedence here so that it matches
 * 	// and consumes anything.
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	expr := p.parseBinaryExpressionOrHigher(ast.OperatorPrecedenceLowest)
 * 	// To avoid a look-ahead, we did not handle the case of an arrow function with a single un-parenthesized
 * 	// parameter ('x => ...') above. We handle it here by checking if the parsed expression was a single
 * 	// identifier and the current token is an arrow.
 * 	if expr.Kind == ast.KindIdentifier && p.token == ast.KindEqualsGreaterThanToken {
 * 		return p.parseSimpleArrowFunctionExpression(pos, expr, allowReturnTypeInArrowFunction, jsdoc, nil /*asyncModifier* /)
 * 	}
 * 	// Now see if we might be in cases '2' or '3'.
 * 	// If the expression was a LHS expression, and we have an assignment operator, then
 * 	// we're in '2' or '3'. Consume the assignment and return.
 * 	//
 * 	// Note: we call reScanGreaterToken so that we get an appropriately merged token
 * 	// for cases like `> > =` becoming `>>=`
 * 	if ast.IsLeftHandSideExpression(expr) && ast.IsAssignmentOperator(p.reScanGreaterThanToken()) {
 * 		return p.makeBinaryExpression(expr, p.parseTokenNode(), p.parseAssignmentExpressionOrHigherWorker(allowReturnTypeInArrowFunction), pos)
 * 	}
 * 	// It wasn't an assignment or a lambda.  This is a conditional expression:
 * 	return p.parseConditionalExpressionRest(expr, pos, allowReturnTypeInArrowFunction)
 * }
 */
export function Parser_parseAssignmentExpressionOrHigherWorker(receiver: GoPtr<Parser>, allowReturnTypeInArrowFunction: bool): GoPtr<Expression> {
  if (Parser_isYieldExpression(receiver)) {
    return Parser_parseYieldExpression(receiver);
  }
  const arrowExpression = Parser_tryParseParenthesizedArrowFunctionExpression(receiver, allowReturnTypeInArrowFunction);
  if (arrowExpression !== undefined) {
    return arrowExpression;
  }
  const arrowExpression2 = Parser_tryParseAsyncSimpleArrowFunctionExpression(receiver, allowReturnTypeInArrowFunction);
  if (arrowExpression2 !== undefined) {
    return arrowExpression2;
  }
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  const expr = Parser_parseBinaryExpressionOrHigher(receiver, OperatorPrecedenceLowest);
  if (expr!.Kind === KindIdentifier && receiver!.token === KindEqualsGreaterThanToken) {
    return Parser_parseSimpleArrowFunctionExpression(receiver, pos, expr, allowReturnTypeInArrowFunction, jsdoc, undefined /*asyncModifier*/);
  }
  if (IsLeftHandSideExpression(expr) && IsAssignmentOperator(Parser_reScanGreaterThanToken(receiver))) {
    return Parser_makeBinaryExpression(receiver, expr, Parser_parseTokenNode(receiver), Parser_parseAssignmentExpressionOrHigherWorker(receiver, allowReturnTypeInArrowFunction), pos);
  }
  return Parser_parseConditionalExpressionRest(receiver, expr, pos, allowReturnTypeInArrowFunction);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isYieldExpression","kind":"method","status":"implemented","sigHash":"e1945aacc099a8be537d64b4d98262138d7a203f7cb888490368c92fa3e7623b","bodyHash":"11caf4e7b2c4e5ecffe432bd8f49ff56225fcb87219c29e22e9f2f4afed64b44"}
 *
 * Go source:
 * func (p *Parser) isYieldExpression() bool {
 * 	if p.token == ast.KindYieldKeyword {
 * 		// If we have a 'yield' keyword, and this is a context where yield expressions are
 * 		// allowed, then definitely parse out a yield expression.
 * 		if p.inYieldContext() {
 * 			return true
 * 		}
 * 
 * 		// We're in a context where 'yield expr' is not allowed.  However, if we can
 * 		// definitely tell that the user was trying to parse a 'yield expr' and not
 * 		// just a normal expr that start with a 'yield' identifier, then parse out
 * 		// a 'yield expr'.  We can then report an error later that they are only
 * 		// allowed in generator expressions.
 * 		//
 * 		// for example, if we see 'yield(foo)', then we'll have to treat that as an
 * 		// invocation expression of something called 'yield'.  However, if we have
 * 		// 'yield foo' then that is not legal as a normal expression, so we can
 * 		// definitely recognize this as a yield expression.
 * 		//
 * 		// for now we just check if the next token is an identifier.  More heuristics
 * 		// can be added here later as necessary.  We just need to make sure that we
 * 		// don't accidentally consume something legal.
 * 		return p.lookAhead((*Parser).nextTokenIsIdentifierOrKeywordOrLiteralOnSameLine)
 * 	}
 * 	return false
 * }
 */
export function Parser_isYieldExpression(receiver: GoPtr<Parser>): bool {
  if (receiver!.token === KindYieldKeyword) {
    // If we have a 'yield' keyword, and this is a context where yield expressions are
    // allowed, then definitely parse out a yield expression.
    if (Parser_inYieldContext(receiver)) {
      return true;
    }
    return Parser_lookAhead(receiver, Parser_nextTokenIsIdentifierOrKeywordOrLiteralOnSameLine);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseYieldExpression","kind":"method","status":"implemented","sigHash":"7f3eef598122dc0c75df786a13d302c00e590a38be5726841bf9cd67747ac5a6","bodyHash":"5abe33f01b233f44a0033afc914d9b81ab6c55bac117744bae936809b1f3c104"}
 *
 * Go source:
 * func (p *Parser) parseYieldExpression() *ast.Node {
 * 	pos := p.nodePos()
 * 	// YieldExpression[In] :
 * 	//      yield
 * 	//      yield [no LineTerminator here] [Lexical goal InputElementRegExp]AssignmentExpression[?In, Yield]
 * 	//      yield [no LineTerminator here] * [Lexical goal InputElementRegExp]AssignmentExpression[?In, Yield]
 * 	p.nextToken()
 * 	var result *ast.Node
 * 	if !p.hasPrecedingLineBreak() && (p.token == ast.KindAsteriskToken || p.isStartOfExpression()) {
 * 		result = p.factory.NewYieldExpression(p.parseOptionalToken(ast.KindAsteriskToken), p.parseAssignmentExpressionOrHigher())
 * 	} else {
 * 		// if the next token is not on the same line as yield.  or we don't have an '*' or
 * 		// the start of an expression, then this is just a simple "yield" expression.
 * 		result = p.factory.NewYieldExpression(nil /*asteriskToken* /, nil /*expression* /)
 * 	}
 * 	return p.finishNode(result, pos)
 * }
 */
export function Parser_parseYieldExpression(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  // YieldExpression[In] :
  //      yield
  //      yield [no LineTerminator here] [Lexical goal InputElementRegExp]AssignmentExpression[?In, Yield]
  //      yield [no LineTerminator here] * [Lexical goal InputElementRegExp]AssignmentExpression[?In, Yield]
  Parser_nextToken(receiver);
  const result =
    !Parser_hasPrecedingLineBreak(receiver) && (receiver!.token === KindAsteriskToken || Parser_isStartOfExpression(receiver))
      ? NewYieldExpression(receiver!.factory, Parser_parseOptionalToken(receiver, KindAsteriskToken), Parser_parseAssignmentExpressionOrHigher(receiver))
      : // if the next token is not on the same line as yield.  or we don't have an '*' or
        // the start of an expression, then this is just a simple "yield" expression.
        NewYieldExpression(receiver!.factory, undefined /*asteriskToken*/, undefined /*expression*/);
  return Parser_finishNode(receiver, result, pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isParenthesizedArrowFunctionExpression","kind":"method","status":"implemented","sigHash":"70cc498146270e0759c27defec4676a267f772ac7dcefd46f3808851adec7ca6","bodyHash":"9a51b7f9be023c363f6bca1559367a73bafd5bc2409c69c1a2f0c5a4f5fa7f09"}
 *
 * Go source:
 * func (p *Parser) isParenthesizedArrowFunctionExpression() core.Tristate {
 * 	if p.token == ast.KindOpenParenToken || p.token == ast.KindLessThanToken || p.token == ast.KindAsyncKeyword {
 * 		state := p.mark()
 * 		result := p.nextIsParenthesizedArrowFunctionExpression()
 * 		p.rewind(state)
 * 		return result
 * 	}
 * 	if p.token == ast.KindEqualsGreaterThanToken {
 * 		// ERROR RECOVERY TWEAK:
 * 		// If we see a standalone => try to parse it as an arrow function expression as that's
 * 		// likely what the user intended to write.
 * 		return core.TSTrue
 * 	}
 * 	// Definitely not a parenthesized arrow function.
 * 	return core.TSFalse
 * }
 */
export function Parser_isParenthesizedArrowFunctionExpression(receiver: GoPtr<Parser>): Tristate {
  if (receiver!.token === KindOpenParenToken || receiver!.token === KindLessThanToken || receiver!.token === KindAsyncKeyword) {
    const state = Parser_mark(receiver);
    const result = Parser_nextIsParenthesizedArrowFunctionExpression(receiver);
    Parser_rewind(receiver, state);
    return result;
  }
  if (receiver!.token === KindEqualsGreaterThanToken) {
    // ERROR RECOVERY TWEAK:
    // If we see a standalone => try to parse it as an arrow function expression as that's
    // likely what the user intended to write.
    return TSTrue;
  }
  // Definitely not a parenthesized arrow function.
  return TSFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextIsParenthesizedArrowFunctionExpression","kind":"method","status":"implemented","sigHash":"e1ebb8a80615469bde1f98a887398b8bcf833c41241c67aea1f0a7a84def0690","bodyHash":"5da85e4c7e0bb969f4c5d7e552a25432bd47b104c53c079e33e056010bfb3686"}
 *
 * Go source:
 * func (p *Parser) nextIsParenthesizedArrowFunctionExpression() core.Tristate {
 * 	if p.token == ast.KindAsyncKeyword {
 * 		p.nextToken()
 * 		if p.hasPrecedingLineBreak() {
 * 			return core.TSFalse
 * 		}
 * 		if p.token != ast.KindOpenParenToken && p.token != ast.KindLessThanToken {
 * 			return core.TSFalse
 * 		}
 * 	}
 * 	first := p.token
 * 	second := p.nextToken()
 * 	if first == ast.KindOpenParenToken {
 * 		if second == ast.KindCloseParenToken {
 * 			// Simple cases: "() =>", "(): ", and "() {".
 * 			// This is an arrow function with no parameters.
 * 			// The last one is not actually an arrow function,
 * 			// but this is probably what the user intended.
 * 			third := p.nextToken()
 * 			switch third {
 * 			case ast.KindEqualsGreaterThanToken, ast.KindColonToken, ast.KindOpenBraceToken:
 * 				return core.TSTrue
 * 			}
 * 			return core.TSFalse
 * 		}
 * 		// If encounter "([" or "({", this could be the start of a binding pattern.
 * 		// Examples:
 * 		//      ([ x ]) => { }
 * 		//      ({ x }) => { }
 * 		//      ([ x ])
 * 		//      ({ x })
 * 		if second == ast.KindOpenBracketToken || second == ast.KindOpenBraceToken {
 * 			return core.TSUnknown
 * 		}
 * 		// Simple case: "(..."
 * 		// This is an arrow function with a rest parameter.
 * 		if second == ast.KindDotDotDotToken {
 * 			return core.TSTrue
 * 		}
 * 		// Check for "(xxx yyy", where xxx is a modifier and yyy is an identifier. This
 * 		// isn't actually allowed, but we want to treat it as a lambda so we can provide
 * 		// a good error message.
 * 		if ast.IsModifierKind(second) && second != ast.KindAsyncKeyword && p.lookAhead((*Parser).nextTokenIsIdentifier) {
 * 			if p.nextToken() == ast.KindAsKeyword {
 * 				// https://github.com/microsoft/TypeScript/issues/44466
 * 				return core.TSFalse
 * 			}
 * 			return core.TSTrue
 * 		}
 * 		// If we had "(" followed by something that's not an identifier,
 * 		// then this definitely doesn't look like a lambda.  "this" is not
 * 		// valid, but we want to parse it and then give a semantic error.
 * 		if !p.isIdentifier() && second != ast.KindThisKeyword {
 * 			return core.TSFalse
 * 		}
 * 		switch p.nextToken() {
 * 		case ast.KindColonToken:
 * 			// If we have something like "(a:", then we must have a
 * 			// type-annotated parameter in an arrow function expression.
 * 			return core.TSTrue
 * 		case ast.KindQuestionToken:
 * 			p.nextToken()
 * 			// If we have "(a?:" or "(a?," or "(a?=" or "(a?)" then it is definitely a lambda.
 * 			if p.token == ast.KindColonToken || p.token == ast.KindCommaToken || p.token == ast.KindEqualsToken || p.token == ast.KindCloseParenToken {
 * 				return core.TSTrue
 * 			}
 * 			// Otherwise it is definitely not a lambda.
 * 			return core.TSFalse
 * 		case ast.KindCommaToken, ast.KindEqualsToken, ast.KindCloseParenToken:
 * 			// If we have "(a," or "(a=" or "(a)" this *could* be an arrow function
 * 			return core.TSUnknown
 * 		}
 * 		// It is definitely not an arrow function
 * 		return core.TSFalse
 * 	} else {
 * 		debug.Assert(first == ast.KindLessThanToken)
 * 		// If we have "<" not followed by an identifier,
 * 		// then this definitely is not an arrow function.
 * 		if !p.isIdentifier() && p.token != ast.KindConstKeyword {
 * 			return core.TSFalse
 * 		}
 * 		// JSX overrides
 * 		if p.languageVariant == core.LanguageVariantJSX {
 * 			isArrowFunctionInJsx := p.lookAhead(func(p *Parser) bool {
 * 				p.parseOptional(ast.KindConstKeyword)
 * 				third := p.nextToken()
 * 				if third == ast.KindExtendsKeyword {
 * 					fourth := p.nextToken()
 * 					switch fourth {
 * 					case ast.KindEqualsToken, ast.KindGreaterThanToken, ast.KindSlashToken:
 * 						return false
 * 					}
 * 					return true
 * 				} else if third == ast.KindCommaToken || third == ast.KindEqualsToken {
 * 					return true
 * 				}
 * 				return false
 * 			})
 * 			if isArrowFunctionInJsx {
 * 				return core.TSTrue
 * 			}
 * 			return core.TSFalse
 * 		}
 * 		// This *could* be a parenthesized arrow function.
 * 		return core.TSUnknown
 * 	}
 * }
 */
export function Parser_nextIsParenthesizedArrowFunctionExpression(receiver: GoPtr<Parser>): Tristate {
  if (receiver!.token === KindAsyncKeyword) {
    Parser_nextToken(receiver);
    if (Parser_hasPrecedingLineBreak(receiver)) {
      return TSFalse;
    }
    if (receiver!.token !== KindOpenParenToken && receiver!.token !== KindLessThanToken) {
      return TSFalse;
    }
  }
  const first = receiver!.token;
  const second = Parser_nextToken(receiver);
  if (first === KindOpenParenToken) {
    if (second === KindCloseParenToken) {
      // Simple cases: "() =>", "(): ", and "() {".
      // This is an arrow function with no parameters.
      // The last one is not actually an arrow function,
      // but this is probably what the user intended.
      const third = Parser_nextToken(receiver);
      switch (third) {
        case KindEqualsGreaterThanToken:
        case KindColonToken:
        case KindOpenBraceToken:
          return TSTrue;
      }
      return TSFalse;
    }
    // If encounter "([" or "({", this could be the start of a binding pattern.
    // Examples:
    //      ([ x ]) => { }
    //      ({ x }) => { }
    //      ([ x ])
    //      ({ x })
    if (second === KindOpenBracketToken || second === KindOpenBraceToken) {
      return TSUnknown;
    }
    // Simple case: "(..."
    // This is an arrow function with a rest parameter.
    if (second === KindDotDotDotToken) {
      return TSTrue;
    }
    // Check for "(xxx yyy", where xxx is a modifier and yyy is an identifier. This
    // isn't actually allowed, but we want to treat it as a lambda so we can provide
    // a good error message.
    if (IsModifierKind(second) && second !== KindAsyncKeyword && Parser_lookAhead(receiver, Parser_nextTokenIsIdentifier)) {
      if (Parser_nextToken(receiver) === KindAsKeyword) {
        // https://github.com/microsoft/TypeScript/issues/44466
        return TSFalse;
      }
      return TSTrue;
    }
    // If we had "(" followed by something that's not an identifier,
    // then this definitely doesn't look like a lambda.  "this" is not
    // valid, but we want to parse it and then give a semantic error.
    if (!Parser_isIdentifier(receiver) && second !== KindThisKeyword) {
      return TSFalse;
    }
    switch (Parser_nextToken(receiver)) {
      case KindColonToken:
        // If we have something like "(a:", then we must have a
        // type-annotated parameter in an arrow function expression.
        return TSTrue;
      case KindQuestionToken:
        Parser_nextToken(receiver);
        // If we have "(a?:" or "(a?," or "(a?=" or "(a?)" then it is definitely a lambda.
        if (receiver!.token === KindColonToken || receiver!.token === KindCommaToken || receiver!.token === KindEqualsToken || receiver!.token === KindCloseParenToken) {
          return TSTrue;
        }
        // Otherwise it is definitely not a lambda.
        return TSFalse;
      case KindCommaToken:
      case KindEqualsToken:
      case KindCloseParenToken:
        // If we have "(a," or "(a=" or "(a)" this *could* be an arrow function
        return TSUnknown;
    }
    // It is definitely not an arrow function
    return TSFalse;
  } else {
    Assert(first === KindLessThanToken);
    // If we have "<" not followed by an identifier,
    // then this definitely is not an arrow function.
    if (!Parser_isIdentifier(receiver) && receiver!.token !== KindConstKeyword) {
      return TSFalse;
    }
    // JSX overrides
    if (receiver!.languageVariant === LanguageVariantJSX) {
      const isArrowFunctionInJsx = Parser_lookAhead(receiver, (p: GoPtr<Parser>): bool => {
        Parser_parseOptional(p, KindConstKeyword);
        const third = Parser_nextToken(p);
        if (third === KindExtendsKeyword) {
          const fourth = Parser_nextToken(p);
          switch (fourth) {
            case KindEqualsToken:
            case KindGreaterThanToken:
            case KindSlashToken:
              return false;
          }
          return true;
        } else if (third === KindCommaToken || third === KindEqualsToken) {
          return true;
        }
        return false;
      });
      if (isArrowFunctionInJsx) {
        return TSTrue;
      }
      return TSFalse;
    }
    // This *could* be a parenthesized arrow function.
    return TSUnknown;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.tryParseParenthesizedArrowFunctionExpression","kind":"method","status":"implemented","sigHash":"4215fc981193c404b1344ee7ec010a7338903b0b789e7608430b39e6249d5f6e","bodyHash":"a7bcb225af164fdcafac1c169b8fbc2312ffb3d83c78dff91afc787f6ab9e8ae"}
 *
 * Go source:
 * func (p *Parser) tryParseParenthesizedArrowFunctionExpression(allowReturnTypeInArrowFunction bool) *ast.Node {
 * 	tristate := p.isParenthesizedArrowFunctionExpression()
 * 	if tristate == core.TSFalse {
 * 		// It's definitely not a parenthesized arrow function expression.
 * 		return nil
 * 	}
 * 	// If we definitely have an arrow function, then we can just parse one, not requiring a
 * 	// following => or { token. Otherwise, we *might* have an arrow function.  Try to parse
 * 	// it out, but don't allow any ambiguity, and return 'undefined' if this could be an
 * 	// expression instead.
 * 	if tristate == core.TSTrue {
 * 		return p.parseParenthesizedArrowFunctionExpression(true /*allowAmbiguity* /, true /*allowReturnTypeInArrowFunction* /)
 * 	}
 * 	state := p.mark()
 * 	result := p.parsePossibleParenthesizedArrowFunctionExpression(allowReturnTypeInArrowFunction)
 * 	if result == nil {
 * 		p.rewind(state)
 * 	}
 * 	return result
 * }
 */
export function Parser_tryParseParenthesizedArrowFunctionExpression(receiver: GoPtr<Parser>, allowReturnTypeInArrowFunction: bool): GoPtr<Node> {
  const tristate = Parser_isParenthesizedArrowFunctionExpression(receiver);
  if (tristate === TSFalse) {
    // It's definitely not a parenthesized arrow function expression.
    return undefined;
  }
  // If we definitely have an arrow function, then we can just parse one, not requiring a
  // following => or { token. Otherwise, we *might* have an arrow function.  Try to parse
  // it out, but don't allow any ambiguity, and return 'undefined' if this could be an
  // expression instead.
  if (tristate === TSTrue) {
    return Parser_parseParenthesizedArrowFunctionExpression(receiver, true /*allowAmbiguity*/, true /*allowReturnTypeInArrowFunction*/);
  }
  const state = Parser_mark(receiver);
  const result = Parser_parsePossibleParenthesizedArrowFunctionExpression(receiver, allowReturnTypeInArrowFunction);
  if (result === undefined) {
    Parser_rewind(receiver, state);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseParenthesizedArrowFunctionExpression","kind":"method","status":"implemented","sigHash":"58cf94fa5104a3627c9a1f2841b59c9f32c12cd5fc9a65a67003420dc29647bf","bodyHash":"de119344d30ce1e4f978d19dd3a6b765c503b1494a3aab30c02c2c4b073c97cf"}
 *
 * Go source:
 * func (p *Parser) parseParenthesizedArrowFunctionExpression(allowAmbiguity bool, allowReturnTypeInArrowFunction bool) *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	modifiers := p.parseModifiersForArrowFunction()
 * 	isAsync := modifierListHasAsync(modifiers)
 * 	signatureFlags := core.IfElse(isAsync, ParseFlagsAwait, ParseFlagsNone)
 * 	// Arrow functions are never generators.
 * 	//
 * 	// If we're speculatively parsing a signature for a parenthesized arrow function, then
 * 	// we have to have a complete parameter list.  Otherwise we might see something like
 * 	// a => (b => c)
 * 	// And think that "(b =>" was actually a parenthesized arrow function with a missing
 * 	// close paren.
 * 	typeParameters := p.parseTypeParameters()
 * 	var parameters *ast.NodeList
 * 	if !p.parseExpected(ast.KindOpenParenToken) {
 * 		if !allowAmbiguity {
 * 			return nil
 * 		}
 * 		parameters = p.createMissingList()
 * 	} else {
 * 		if !allowAmbiguity {
 * 			maybeParameters := p.parseParametersWorker(signatureFlags, allowAmbiguity)
 * 			if maybeParameters == nil {
 * 				return nil
 * 			}
 * 			parameters = maybeParameters
 * 		} else {
 * 			parameters = p.parseParametersWorker(signatureFlags, allowAmbiguity)
 * 		}
 * 		if !p.parseExpected(ast.KindCloseParenToken) && !allowAmbiguity {
 * 			return nil
 * 		}
 * 	}
 * 	hasReturnColon := p.token == ast.KindColonToken
 * 	returnType := p.parseReturnType(ast.KindColonToken /*isType* /, false)
 * 	if returnType != nil && !allowAmbiguity && typeHasArrowFunctionBlockingParseError(returnType) {
 * 		return nil
 * 	}
 * 	// Parsing a signature isn't enough.
 * 	// Parenthesized arrow signatures often look like other valid expressions.
 * 	// For instance:
 * 	//  - "(x = 10)" is an assignment expression parsed as a signature with a default parameter value.
 * 	//  - "(x,y)" is a comma expression parsed as a signature with two parameters.
 * 	//  - "a ? (b): c" will have "(b):" parsed as a signature with a return type annotation.
 * 	//  - "a ? (b): function() {}" will too, since function() is a valid JSDoc function type.
 * 	//  - "a ? (b): (function() {})" as well, but inside of a parenthesized type with an arbitrary amount of nesting.
 * 	//
 * 	// So we need just a bit of lookahead to ensure that it can only be a signature.
 * 	unwrappedType := returnType
 * 	for unwrappedType != nil && unwrappedType.Kind == ast.KindParenthesizedType {
 * 		unwrappedType = unwrappedType.Type() // Skip parens if need be
 * 	}
 * 	if !allowAmbiguity && p.token != ast.KindEqualsGreaterThanToken && p.token != ast.KindOpenBraceToken {
 * 		// Returning undefined here will cause our caller to rewind to where we started from.
 * 		return nil
 * 	}
 * 	// If we have an arrow, then try to parse the body. Even if not, try to parse if we
 * 	// have an opening brace, just in case we're in an error state.
 * 	lastToken := p.token
 * 	equalsGreaterThanToken := p.parseExpectedToken(ast.KindEqualsGreaterThanToken)
 * 	var body *ast.Node
 * 	if lastToken == ast.KindEqualsGreaterThanToken || lastToken == ast.KindOpenBraceToken {
 * 		body = p.parseArrowFunctionExpressionBody(isAsync, allowReturnTypeInArrowFunction)
 * 	} else {
 * 		body = p.parseIdentifier()
 * 	}
 * 	// Given:
 * 	//     x ? y => ({ y }) : z => ({ z })
 * 	// We try to parse the body of the first arrow function by looking at:
 * 	//     ({ y }) : z => ({ z })
 * 	// This is a valid arrow function with "z" as the return type.
 * 	//
 * 	// But, if we're in the true side of a conditional expression, this colon
 * 	// terminates the expression, so we cannot allow a return type if we aren't
 * 	// certain whether or not the preceding text was parsed as a parameter list.
 * 	//
 * 	// For example,
 * 	//     a() ? (b: number, c?: string): void => d() : e
 * 	// is determined by isParenthesizedArrowFunctionExpression to unambiguously
 * 	// be an arrow expression, so we allow a return type.
 * 	if !allowReturnTypeInArrowFunction && hasReturnColon {
 * 		// However, if the arrow function we were able to parse is followed by another colon
 * 		// as in:
 * 		//     a ? (x): string => x : null
 * 		// Then allow the arrow function, and treat the second colon as terminating
 * 		// the conditional expression. It's okay to do this because this code would
 * 		// be a syntax error in JavaScript (as the second colon shouldn't be there).
 * 		if p.token != ast.KindColonToken {
 * 			return nil
 * 		}
 * 	}
 * 	result := p.finishNode(p.factory.NewArrowFunction(modifiers, typeParameters, parameters, returnType, nil /*fullSignature* /, equalsGreaterThanToken, body), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	return result
 * }
 */
export function Parser_parseParenthesizedArrowFunctionExpression(receiver: GoPtr<Parser>, allowAmbiguity: bool, allowReturnTypeInArrowFunction: bool): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  const modifiers = Parser_parseModifiersForArrowFunction(receiver);
  const isAsync = modifierListHasAsync(modifiers);
  const signatureFlags = IfElse(isAsync, ParseFlagsAwait, ParseFlagsNone);
  // Arrow functions are never generators.
  const typeParameters = Parser_parseTypeParameters(receiver);
  let parameters: GoPtr<NodeList>;
  if (!Parser_parseExpected(receiver, KindOpenParenToken)) {
    if (!allowAmbiguity) {
      return undefined;
    }
    parameters = Parser_createMissingList(receiver);
  } else {
    if (!allowAmbiguity) {
      const maybeParameters = Parser_parseParametersWorker(receiver, signatureFlags, allowAmbiguity);
      if (maybeParameters === undefined) {
        return undefined;
      }
      parameters = maybeParameters;
    } else {
      parameters = Parser_parseParametersWorker(receiver, signatureFlags, allowAmbiguity);
    }
    if (!Parser_parseExpected(receiver, KindCloseParenToken) && !allowAmbiguity) {
      return undefined;
    }
  }
  const hasReturnColon = receiver!.token === KindColonToken;
  const returnType = Parser_parseReturnType(receiver, KindColonToken /*isType*/, false);
  if (returnType !== undefined && !allowAmbiguity && typeHasArrowFunctionBlockingParseError(returnType)) {
    return undefined;
  }
  let unwrappedType: GoPtr<Node> = returnType;
  while (unwrappedType !== undefined && unwrappedType!.Kind === KindParenthesizedType) {
    unwrappedType = Node_Type(unwrappedType); // Skip parens if need be
  }
  if (!allowAmbiguity && receiver!.token !== KindEqualsGreaterThanToken && receiver!.token !== KindOpenBraceToken) {
    // Returning undefined here will cause our caller to rewind to where we started from.
    return undefined;
  }
  const lastToken = receiver!.token;
  const equalsGreaterThanToken = Parser_parseExpectedToken(receiver, KindEqualsGreaterThanToken);
  let body: GoPtr<Node>;
  if (lastToken === KindEqualsGreaterThanToken || lastToken === KindOpenBraceToken) {
    body = Parser_parseArrowFunctionExpressionBody(receiver, isAsync, allowReturnTypeInArrowFunction);
  } else {
    body = Parser_parseIdentifier(receiver);
  }
  if (!allowReturnTypeInArrowFunction && hasReturnColon) {
    if (receiver!.token !== KindColonToken) {
      return undefined;
    }
  }
  const result = Parser_finishNode(receiver, NewArrowFunction(receiver!.factory, modifiers, typeParameters, parameters, returnType, undefined /*fullSignature*/, equalsGreaterThanToken, body), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseModifiersForArrowFunction","kind":"method","status":"implemented","sigHash":"0e7d778d6b2cd83e7e4c385f7489a540a749fb456f978eb3532287801dbd13dc","bodyHash":"ebb7cc35b60e42c03926984826b502ade32bb82e600f65df3cc50a3cb0779dfe"}
 *
 * Go source:
 * func (p *Parser) parseModifiersForArrowFunction() *ast.ModifierList {
 * 	if p.token == ast.KindAsyncKeyword {
 * 		pos := p.nodePos()
 * 		p.nextToken()
 * 		modifier := p.finishNode(p.factory.NewModifier(ast.KindAsyncKeyword), pos)
 * 		return p.newModifierList(modifier.Loc, p.nodeSliceArena.NewSlice1(modifier))
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseModifiersForArrowFunction(receiver: GoPtr<Parser>): GoPtr<ModifierList> {
  if (receiver!.token === KindAsyncKeyword) {
    const pos = Parser_nodePos(receiver);
    Parser_nextToken(receiver);
    const modifier = Parser_finishNode(receiver, NodeFactory_NewModifier(receiver!.factory, KindAsyncKeyword), pos);
    return Parser_newModifierList(receiver, modifier!.Loc, Arena_NewSlice1(receiver!.nodeSliceArena, modifier) as GoSlice<GoPtr<Node>>);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::typeHasArrowFunctionBlockingParseError","kind":"func","status":"implemented","sigHash":"da8c560201537f86b76ddaaa2e69b7bc60b1ffa2a91c80331c9c12f775e541cf","bodyHash":"2f09077724f0a2e31ae13d60014ea83781f7126ed6f14b6aa6094743692b135e"}
 *
 * Go source:
 * func typeHasArrowFunctionBlockingParseError(node *ast.TypeNode) bool {
 * 	switch node.Kind {
 * 	case ast.KindTypeReference:
 * 		return ast.NodeIsMissing(node.AsTypeReferenceNode().TypeName)
 * 	case ast.KindFunctionType, ast.KindConstructorType:
 * 		return isMissingNodeList(node.FunctionLikeData().Parameters) || typeHasArrowFunctionBlockingParseError(node.Type())
 * 	case ast.KindParenthesizedType:
 * 		return typeHasArrowFunctionBlockingParseError(node.Type())
 * 	}
 * 	return false
 * }
 */
export function typeHasArrowFunctionBlockingParseError(node: GoPtr<TypeNode>): bool {
  switch (node!.Kind) {
    case KindTypeReference:
      return NodeIsMissing(AsTypeReferenceNode(node)!.TypeName) as bool;
    case KindFunctionType:
    case KindConstructorType:
      return (isMissingNodeList(Node_FunctionLikeData(node)!.Parameters) || typeHasArrowFunctionBlockingParseError(Node_Type(node))) as bool;
    case KindParenthesizedType:
      return typeHasArrowFunctionBlockingParseError(Node_Type(node));
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseArrowFunctionExpressionBody","kind":"method","status":"implemented","sigHash":"1bd5e30228b167af0cac8a953a9b81b25e423e8e1215f9b25bfba9b63571109d","bodyHash":"581015f9cd8c7f3551533f7478e7a09db2ce57cf28c5615d58042bb0cadc63e4"}
 *
 * Go source:
 * func (p *Parser) parseArrowFunctionExpressionBody(isAsync bool, allowReturnTypeInArrowFunction bool) *ast.Node {
 * 	if p.token == ast.KindOpenBraceToken {
 * 		return p.parseFunctionBlock(core.IfElse(isAsync, ParseFlagsAwait, ParseFlagsNone), nil /*diagnosticMessage* /)
 * 	}
 * 	if p.token != ast.KindSemicolonToken && p.token != ast.KindFunctionKeyword && p.token != ast.KindClassKeyword && p.isStartOfStatement() && !p.isStartOfExpressionStatement() {
 * 		// Check if we got a plain statement (i.e. no expression-statements, no function/class expressions/declarations)
 * 		//
 * 		// Here we try to recover from a potential error situation in the case where the
 * 		// user meant to supply a block. For example, if the user wrote:
 * 		//
 * 		//  a =>
 * 		//      let v = 0;
 * 		//  }
 * 		//
 * 		// they may be missing an open brace.  Check to see if that's the case so we can
 * 		// try to recover better.  If we don't do this, then the next close curly we see may end
 * 		// up preemptively closing the containing construct.
 * 		//
 * 		// Note: even when 'IgnoreMissingOpenBrace' is passed, parseBody will still error.
 * 		return p.parseFunctionBlock(ParseFlagsIgnoreMissingOpenBrace|core.IfElse(isAsync, ParseFlagsAwait, ParseFlagsNone), nil /*diagnosticMessage* /)
 * 	}
 * 	saveContextFlags := p.contextFlags
 * 	p.setContextFlags(ast.NodeFlagsAwaitContext, isAsync)
 * 	p.setContextFlags(ast.NodeFlagsYieldContext, false)
 * 	node := p.parseAssignmentExpressionOrHigherWorker(allowReturnTypeInArrowFunction)
 * 	p.contextFlags = saveContextFlags
 * 	return node
 * }
 */
export function Parser_parseArrowFunctionExpressionBody(receiver: GoPtr<Parser>, isAsync: bool, allowReturnTypeInArrowFunction: bool): GoPtr<Node> {
  if (receiver!.token === KindOpenBraceToken) {
    return Parser_parseFunctionBlock(receiver, IfElse(isAsync, ParseFlagsAwait, ParseFlagsNone), undefined /*diagnosticMessage*/);
  }
  if (receiver!.token !== KindSemicolonToken && receiver!.token !== KindFunctionKeyword && receiver!.token !== KindClassKeyword && Parser_isStartOfStatement(receiver) && !Parser_isStartOfExpressionStatement(receiver)) {
    // Check if we got a plain statement (i.e. no expression-statements, no function/class expressions/declarations)
    //
    // Here we try to recover from a potential error situation in the case where the
    // user meant to supply a block. For example, if the user wrote:
    //
    //  a =>
    //      let v = 0;
    //  }
    //
    // they may be missing an open brace.  Check to see if that's the case so we can
    // try to recover better.  If we don't do this, then the next close curly we see may end
    // up preemptively closing the containing construct.
    //
    // Note: even when 'IgnoreMissingOpenBrace' is passed, parseBody will still error.
    return Parser_parseFunctionBlock(receiver, ParseFlagsIgnoreMissingOpenBrace | IfElse(isAsync, ParseFlagsAwait, ParseFlagsNone), undefined /*diagnosticMessage*/);
  }
  const saveContextFlags = receiver!.contextFlags;
  Parser_setContextFlags(receiver, NodeFlagsAwaitContext, isAsync);
  Parser_setContextFlags(receiver, NodeFlagsYieldContext, false);
  const node = Parser_parseAssignmentExpressionOrHigherWorker(receiver, allowReturnTypeInArrowFunction);
  receiver!.contextFlags = saveContextFlags;
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isStartOfExpressionStatement","kind":"method","status":"implemented","sigHash":"0d6924080f4fbbcc1af1016944287f1ae23b11fb9fefcfe330d2ed03494156b6","bodyHash":"6af950998c53097f62d61147f092ff31e9e612b6b7162c2b5bd7061eebedd4ff"}
 *
 * Go source:
 * func (p *Parser) isStartOfExpressionStatement() bool {
 * 	// As per the grammar, none of '{' or 'function' or 'class' can start an expression statement.
 * 	return p.token != ast.KindOpenBraceToken && p.token != ast.KindFunctionKeyword && p.token != ast.KindClassKeyword && p.token != ast.KindAtToken && p.isStartOfExpression()
 * }
 */
export function Parser_isStartOfExpressionStatement(receiver: GoPtr<Parser>): bool {
  // As per the grammar, none of '{' or 'function' or 'class' can start an expression statement.
  return receiver!.token !== KindOpenBraceToken && receiver!.token !== KindFunctionKeyword && receiver!.token !== KindClassKeyword && receiver!.token !== KindAtToken && Parser_isStartOfExpression(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parsePossibleParenthesizedArrowFunctionExpression","kind":"method","status":"implemented","sigHash":"767ef30a4403484b15834fa3d3cdc8e4b7887c6cca97531497ba269a107a2e4f","bodyHash":"c649b84e88fcd251ddc5a7a43f4c0e60492b103c752cb884cd9b65255e0ea7c2"}
 *
 * Go source:
 * func (p *Parser) parsePossibleParenthesizedArrowFunctionExpression(allowReturnTypeInArrowFunction bool) *ast.Node {
 * 	tokenPos := p.scanner.TokenStart()
 * 	if p.notParenthesizedArrow.Has(tokenPos) {
 * 		return nil
 * 	}
 * 	result := p.parseParenthesizedArrowFunctionExpression(false /*allowAmbiguity* /, allowReturnTypeInArrowFunction)
 * 	if result == nil {
 * 		p.notParenthesizedArrow.Add(tokenPos)
 * 	}
 * 	return result
 * }
 */
export function Parser_parsePossibleParenthesizedArrowFunctionExpression(receiver: GoPtr<Parser>, allowReturnTypeInArrowFunction: bool): GoPtr<Node> {
  const tokenPos = Scanner_TokenStart(receiver!.scanner);
  if (Set_Has(receiver!.notParenthesizedArrow, tokenPos)) {
    return undefined;
  }
  const result = Parser_parseParenthesizedArrowFunctionExpression(receiver, false /*allowAmbiguity*/, allowReturnTypeInArrowFunction);
  if (result === undefined) {
    Set_Add(receiver!.notParenthesizedArrow, tokenPos);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.tryParseAsyncSimpleArrowFunctionExpression","kind":"method","status":"implemented","sigHash":"9fe519b72feb7acd7b4c55e264be03691ccf69fced3673f694cf768c4d730bb7","bodyHash":"8e6421d33c305e42b0f44da209ba19c0ca8224f9a80c857c581f29f00d9a9a97"}
 *
 * Go source:
 * func (p *Parser) tryParseAsyncSimpleArrowFunctionExpression(allowReturnTypeInArrowFunction bool) *ast.Node {
 * 	// We do a check here so that we won't be doing unnecessarily call to "lookAhead"
 * 	if p.token == ast.KindAsyncKeyword && p.lookAhead((*Parser).nextIsUnParenthesizedAsyncArrowFunction) {
 * 		pos := p.nodePos()
 * 		jsdoc := p.jsdocScannerInfo()
 * 		asyncModifier := p.parseModifiersForArrowFunction()
 * 		expr := p.parseBinaryExpressionOrHigher(ast.OperatorPrecedenceLowest)
 * 		return p.parseSimpleArrowFunctionExpression(pos, expr, allowReturnTypeInArrowFunction, jsdoc, asyncModifier)
 * 	}
 * 	return nil
 * }
 */
export function Parser_tryParseAsyncSimpleArrowFunctionExpression(receiver: GoPtr<Parser>, allowReturnTypeInArrowFunction: bool): GoPtr<Node> {
  // We do a check here so that we won't be doing unnecessarily call to "lookAhead"
  if (receiver!.token === KindAsyncKeyword && Parser_lookAhead(receiver, Parser_nextIsUnParenthesizedAsyncArrowFunction)) {
    const pos = Parser_nodePos(receiver);
    const jsdoc = Parser_jsdocScannerInfo(receiver);
    const asyncModifier = Parser_parseModifiersForArrowFunction(receiver);
    const expr = Parser_parseBinaryExpressionOrHigher(receiver, OperatorPrecedenceLowest);
    return Parser_parseSimpleArrowFunctionExpression(receiver, pos, expr, allowReturnTypeInArrowFunction, jsdoc, asyncModifier);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextIsUnParenthesizedAsyncArrowFunction","kind":"method","status":"implemented","sigHash":"575b1e76796dbaa5a3bbd4e21242b62c2903c61d4300e372b59501db4ec2d556","bodyHash":"c645e0cc05894b1f08c46f932139f6bc8635bf8f979cfa2cd81b66e223c6ed74"}
 *
 * Go source:
 * func (p *Parser) nextIsUnParenthesizedAsyncArrowFunction() bool {
 * 	// AsyncArrowFunctionExpression:
 * 	//      1) async[no LineTerminator here]AsyncArrowBindingIdentifier[?Yield][no LineTerminator here]=>AsyncConciseBody[?In]
 * 	//      2) CoverCallExpressionAndAsyncArrowHead[?Yield, ?Await][no LineTerminator here]=>AsyncConciseBody[?In]
 * 	if p.token == ast.KindAsyncKeyword {
 * 		p.nextToken()
 * 		// If the "async" is followed by "=>" token then it is not a beginning of an async arrow-function
 * 		// but instead a simple arrow-function which will be parsed inside "parseAssignmentExpressionOrHigher"
 * 		if p.hasPrecedingLineBreak() || p.token == ast.KindEqualsGreaterThanToken {
 * 			return false
 * 		}
 * 		// Check for un-parenthesized AsyncArrowFunction
 * 		expr := p.parseBinaryExpressionOrHigher(ast.OperatorPrecedenceLowest)
 * 		if !p.hasPrecedingLineBreak() && expr.Kind == ast.KindIdentifier && p.token == ast.KindEqualsGreaterThanToken {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Parser_nextIsUnParenthesizedAsyncArrowFunction(receiver: GoPtr<Parser>): bool {
  // AsyncArrowFunctionExpression:
  //      1) async[no LineTerminator here]AsyncArrowBindingIdentifier[?Yield][no LineTerminator here]=>AsyncConciseBody[?In]
  //      2) CoverCallExpressionAndAsyncArrowHead[?Yield, ?Await][no LineTerminator here]=>AsyncConciseBody[?In]
  if (receiver!.token === KindAsyncKeyword) {
    Parser_nextToken(receiver);
    // If the "async" is followed by "=>" token then it is not a beginning of an async arrow-function
    // but instead a simple arrow-function which will be parsed inside "parseAssignmentExpressionOrHigher"
    if (Parser_hasPrecedingLineBreak(receiver) || receiver!.token === KindEqualsGreaterThanToken) {
      return false as bool;
    }
    // Check for un-parenthesized AsyncArrowFunction
    const expr = Parser_parseBinaryExpressionOrHigher(receiver, OperatorPrecedenceLowest);
    if (!Parser_hasPrecedingLineBreak(receiver) && expr!.Kind === KindIdentifier && receiver!.token === KindEqualsGreaterThanToken) {
      return true as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseSimpleArrowFunctionExpression","kind":"method","status":"implemented","sigHash":"920a923c6ce0436b1c8fc6839a0a61cc492829c28a3327e1b4cfd14657451228","bodyHash":"aa6db99e4c239f41d4f2904045fc4df11aba30f5a7bd03015c54e8f012e0d30c"}
 *
 * Go source:
 * func (p *Parser) parseSimpleArrowFunctionExpression(pos int, identifier *ast.Node, allowReturnTypeInArrowFunction bool, jsdoc jsdocScannerInfo, asyncModifier *ast.ModifierList) *ast.Node {
 * 	debug.Assert(p.token == ast.KindEqualsGreaterThanToken, "parseSimpleArrowFunctionExpression should only have been called if we had a =>")
 * 	parameter := p.finishNode(p.factory.NewParameterDeclaration(nil /*modifiers* /, nil /*dotDotDotToken* /, identifier, nil /*questionToken* /, nil /*typeNode* /, nil /*initializer* /), identifier.Pos())
 * 	parameters := p.newNodeList(parameter.Loc, []*ast.Node{parameter})
 * 	equalsGreaterThanToken := p.parseExpectedToken(ast.KindEqualsGreaterThanToken)
 * 	body := p.parseArrowFunctionExpressionBody(asyncModifier != nil /*isAsync* /, allowReturnTypeInArrowFunction)
 * 	result := p.finishNode(p.factory.NewArrowFunction(asyncModifier, nil /*typeParameters* /, parameters, nil /*returnType* /, nil /*fullSignature* /, equalsGreaterThanToken, body), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseSimpleArrowFunctionExpression(receiver: GoPtr<Parser>, pos: int, identifier: GoPtr<Node>, allowReturnTypeInArrowFunction: bool, jsdoc: jsdocScannerInfo, asyncModifier: GoPtr<ModifierList>): GoPtr<Node> {
  Assert(receiver!.token === KindEqualsGreaterThanToken, "parseSimpleArrowFunctionExpression should only have been called if we had a =>");
  const parameter = Parser_finishNode(
    receiver,
    NewParameterDeclaration(receiver!.factory, undefined /*modifiers*/, undefined /*dotDotDotToken*/, identifier, undefined /*questionToken*/, undefined /*typeNode*/, undefined /*initializer*/),
    Node_Pos(identifier),
  );
  const parameters = Parser_newNodeList(receiver, parameter!.Loc, [parameter]);
  const equalsGreaterThanToken = Parser_parseExpectedToken(receiver, KindEqualsGreaterThanToken);
  const body = Parser_parseArrowFunctionExpressionBody(receiver, asyncModifier !== undefined /*isAsync*/, allowReturnTypeInArrowFunction);
  const result = Parser_finishNode(receiver, NewArrowFunction(receiver!.factory, asyncModifier, undefined /*typeParameters*/, parameters, undefined /*returnType*/, undefined /*fullSignature*/, equalsGreaterThanToken, body), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseConditionalExpressionRest","kind":"method","status":"implemented","sigHash":"006bfbf028b5f667142c905e7ed1e2fb6ba5eb15d89bde6ce28f681e5799bbd6","bodyHash":"3a639a3fa68bd656da9916b9eaf8987377945c22fc3a8a27fe9ee99131a64c34"}
 *
 * Go source:
 * func (p *Parser) parseConditionalExpressionRest(leftOperand *ast.Expression, pos int, allowReturnTypeInArrowFunction bool) *ast.Expression {
 * 	// Note: we are passed in an expression which was produced from parseBinaryExpressionOrHigher.
 * 	questionToken := p.parseOptionalToken(ast.KindQuestionToken)
 * 	if questionToken == nil {
 * 		return leftOperand
 * 	}
 * 	// Note: we explicitly 'allowIn' in the whenTrue part of the condition expression, and
 * 	// we do not that for the 'whenFalse' part.
 * 	saveContextFlags := p.contextFlags
 * 	p.setContextFlags(ast.NodeFlagsDisallowInContext, false)
 * 	trueExpression := p.parseAssignmentExpressionOrHigherWorker(false /*allowReturnTypeInArrowFunction* /)
 * 	p.contextFlags = saveContextFlags
 * 	colonToken := p.parseExpectedToken(ast.KindColonToken)
 * 	var falseExpression *ast.Expression
 * 	if ast.NodeIsPresent(colonToken) {
 * 		falseExpression = p.parseAssignmentExpressionOrHigherWorker(allowReturnTypeInArrowFunction)
 * 	} else {
 * 		falseExpression = p.createMissingIdentifier()
 * 	}
 * 	return p.finishNode(p.factory.NewConditionalExpression(leftOperand, questionToken, trueExpression, colonToken, falseExpression), pos)
 * }
 */
export function Parser_parseConditionalExpressionRest(receiver: GoPtr<Parser>, leftOperand: GoPtr<Expression>, pos: int, allowReturnTypeInArrowFunction: bool): GoPtr<Expression> {
  // Note: we are passed in an expression which was produced from parseBinaryExpressionOrHigher.
  const questionToken = Parser_parseOptionalToken(receiver, KindQuestionToken);
  if (questionToken === undefined) {
    return leftOperand;
  }
  // Note: we explicitly 'allowIn' in the whenTrue part of the condition expression, and
  // we do not that for the 'whenFalse' part.
  const saveContextFlags = receiver!.contextFlags;
  Parser_setContextFlags(receiver, NodeFlagsDisallowInContext, false);
  const trueExpression = Parser_parseAssignmentExpressionOrHigherWorker(receiver, false /*allowReturnTypeInArrowFunction*/);
  receiver!.contextFlags = saveContextFlags;
  const colonToken = Parser_parseExpectedToken(receiver, KindColonToken);
  let falseExpression: GoPtr<Node>;
  if (NodeIsPresent(colonToken)) {
    falseExpression = Parser_parseAssignmentExpressionOrHigherWorker(receiver, allowReturnTypeInArrowFunction);
  } else {
    falseExpression = Parser_createMissingIdentifier(receiver);
  }
  return Parser_finishNode(receiver, NewConditionalExpression(receiver!.factory, leftOperand, questionToken, trueExpression, colonToken, falseExpression), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseBinaryExpressionOrHigher","kind":"method","status":"implemented","sigHash":"5b6a713816518fea1175d9dcb90b49fb3508df02041f84a1f30049289218f430","bodyHash":"60cb3364ee5676c55c741fad156a418aa1d6fad33764413778d3e282c289797a"}
 *
 * Go source:
 * func (p *Parser) parseBinaryExpressionOrHigher(precedence ast.OperatorPrecedence) *ast.Expression {
 * 	pos := p.nodePos()
 * 	leftOperand := p.parseUnaryExpressionOrHigher()
 * 	return p.parseBinaryExpressionRest(precedence, leftOperand, pos)
 * }
 */
export function Parser_parseBinaryExpressionOrHigher(receiver: GoPtr<Parser>, precedence: OperatorPrecedence): GoPtr<Expression> {
  const pos = Parser_nodePos(receiver);
  const leftOperand = Parser_parseUnaryExpressionOrHigher(receiver);
  return Parser_parseBinaryExpressionRest(receiver, precedence, leftOperand, pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseBinaryExpressionRest","kind":"method","status":"implemented","sigHash":"fb10588a8e64dfb251a5e79476bb14c194d7d85f85e28f453922ed4e776e3c07","bodyHash":"2e3e2d192d0b5e8e4cbd76f2637349b3ef97f4cd5c9c5f2ea10c642c5343cb51"}
 *
 * Go source:
 * func (p *Parser) parseBinaryExpressionRest(precedence ast.OperatorPrecedence, leftOperand *ast.Expression, pos int) *ast.Expression {
 * 	lastOperand := leftOperand
 * 	for {
 * 		// We either have a binary operator here, or we're finished.  We call
 * 		// reScanGreaterToken so that we merge token sequences like > and = into >=
 * 		operator := p.reScanGreaterThanToken()
 * 		newPrecedence := ast.GetBinaryOperatorPrecedence(operator)
 * 		// Check the precedence to see if we should "take" this operator
 * 		// - For left associative operator (all operator but **), consume the operator,
 * 		//   recursively call the function below, and parse binaryExpression as a rightOperand
 * 		//   of the caller if the new precedence of the operator is greater then or equal to the current precedence.
 * 		//   For example:
 * 		//      a - b - c;
 * 		//            ^token; leftOperand = b. Return b to the caller as a rightOperand
 * 		//      a * b - c
 * 		//            ^token; leftOperand = b. Return b to the caller as a rightOperand
 * 		//      a - b * c;
 * 		//            ^token; leftOperand = b. Return b * c to the caller as a rightOperand
 * 		// - For right associative operator (**), consume the operator, recursively call the function
 * 		//   and parse binaryExpression as a rightOperand of the caller if the new precedence of
 * 		//   the operator is strictly grater than the current precedence
 * 		//   For example:
 * 		//      a ** b ** c;
 * 		//             ^^token; leftOperand = b. Return b ** c to the caller as a rightOperand
 * 		//      a - b ** c;
 * 		//            ^^token; leftOperand = b. Return b ** c to the caller as a rightOperand
 * 		//      a ** b - c
 * 		//             ^token; leftOperand = b. Return b to the caller as a rightOperand
 * 		var consumeCurrentOperator bool
 * 		if operator == ast.KindAsteriskAsteriskToken {
 * 			consumeCurrentOperator = newPrecedence >= precedence
 * 		} else {
 * 			consumeCurrentOperator = newPrecedence > precedence
 * 		}
 * 		if !consumeCurrentOperator {
 * 			break
 * 		}
 * 		if operator == ast.KindInKeyword && p.inDisallowInContext() {
 * 			break
 * 		}
 * 		if operator == ast.KindAsKeyword || operator == ast.KindSatisfiesKeyword {
 * 			// Make sure we *do* perform ASI for constructs like this:
 * 			//    var x = foo
 * 			//    as (Bar)
 * 			// This should be parsed as an initialized variable, followed
 * 			// by a function call to 'as' with the argument 'Bar'
 * 			if p.hasPrecedingLineBreak() {
 * 				break
 * 			} else {
 * 				p.nextToken()
 * 				// When we have 'a ## b as SomeType' or 'a ## b satisfies SomeType', where ## is some binary
 * 				// operator, we want to stop parsing on any following operator with a higher precedence than ##
 * 				// because continuing would make it impossible to erase the `as` or `satisfies` without changing
 * 				// the meaning of the expression. See https://github.com/microsoft/TypeScript/issues/63527.
 * 				lastPrecedence := ast.OperatorPrecedenceHighest
 * 				if ast.IsBinaryExpression(lastOperand) {
 * 					lastPrecedence = ast.GetBinaryOperatorPrecedence(lastOperand.AsBinaryExpression().OperatorToken.Kind)
 * 				}
 * 				if operator == ast.KindSatisfiesKeyword {
 * 					leftOperand = p.makeSatisfiesExpression(leftOperand, p.parseType())
 * 				} else {
 * 					leftOperand = p.makeAsExpression(leftOperand, p.parseType())
 * 				}
 * 				// Stop if the precedence of the next operator is too high.
 * 				if ast.GetBinaryOperatorPrecedence(p.reScanGreaterThanToken()) > lastPrecedence {
 * 					break
 * 				}
 * 			}
 * 		} else {
 * 			leftOperand = p.makeBinaryExpression(leftOperand, p.parseTokenNode(), p.parseBinaryExpressionOrHigher(newPrecedence), pos)
 * 			lastOperand = leftOperand
 * 		}
 * 	}
 * 	return leftOperand
 * }
 */
export function Parser_parseBinaryExpressionRest(receiver: GoPtr<Parser>, precedence: OperatorPrecedence, leftOperand: GoPtr<Expression>, pos: int): GoPtr<Expression> {
  let currentLeft: GoPtr<Expression> = leftOperand;
  let lastOperand: GoPtr<Expression> = currentLeft;
  while (true) {
    // We either have a binary operator here, or we're finished.  We call
    // reScanGreaterToken so that we merge token sequences like > and = into >=
    const operator = Parser_reScanGreaterThanToken(receiver);
    const newPrecedence = GetBinaryOperatorPrecedence(operator);
    // Check the precedence to see if we should "take" this operator
    let consumeCurrentOperator: bool;
    if (operator === KindAsteriskAsteriskToken) {
      consumeCurrentOperator = (newPrecedence >= precedence) as bool;
    } else {
      consumeCurrentOperator = (newPrecedence > precedence) as bool;
    }
    if (!consumeCurrentOperator) {
      break;
    }
    if (operator === KindInKeyword && Parser_inDisallowInContext(receiver)) {
      break;
    }
    if (operator === KindAsKeyword || operator === KindSatisfiesKeyword) {
      // Make sure we *do* perform ASI for constructs like this:
      //    var x = foo
      //    as (Bar)
      // This should be parsed as an initialized variable, followed
      // by a function call to 'as' with the argument 'Bar'
      if (Parser_hasPrecedingLineBreak(receiver)) {
        break;
      } else {
        Parser_nextToken(receiver);
        // When we have 'a ## b as SomeType' or 'a ## b satisfies SomeType', where ## is some binary
        // operator, we want to stop parsing on any following operator with a higher precedence than ##
        // because continuing would make it impossible to erase the `as` or `satisfies` without changing
        // the meaning of the expression. See https://github.com/microsoft/TypeScript/issues/63527.
        let lastPrecedence: OperatorPrecedence = OperatorPrecedenceHighest;
        if (IsBinaryExpression(lastOperand)) {
          lastPrecedence = GetBinaryOperatorPrecedence(AsBinaryExpression(lastOperand)!.OperatorToken!.Kind);
        }
        if (operator === KindSatisfiesKeyword) {
          currentLeft = Parser_makeSatisfiesExpression(receiver, currentLeft, Parser_parseType(receiver));
        } else {
          currentLeft = Parser_makeAsExpression(receiver, currentLeft, Parser_parseType(receiver));
        }
        // Stop if the precedence of the next operator is too high.
        if (GetBinaryOperatorPrecedence(Parser_reScanGreaterThanToken(receiver)) > lastPrecedence) {
          break;
        }
      }
    } else {
      currentLeft = Parser_makeBinaryExpression(receiver, currentLeft, Parser_parseTokenNode(receiver), Parser_parseBinaryExpressionOrHigher(receiver, newPrecedence), pos);
      lastOperand = currentLeft;
    }
  }
  return currentLeft;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.makeSatisfiesExpression","kind":"method","status":"implemented","sigHash":"0d79d8563efc6fea2e3c9992f00921e4fbd89b44ff5f1eeaeec887425632106d","bodyHash":"9e5dd4f44df72b2146f5b521d9a773ce0187a06febc0e069c260ef9659b24347"}
 *
 * Go source:
 * func (p *Parser) makeSatisfiesExpression(expression *ast.Expression, typeNode *ast.TypeNode) *ast.Node {
 * 	return p.checkJSSyntax(p.finishNode(p.factory.NewSatisfiesExpression(expression, typeNode), expression.Pos()))
 * }
 */
export function Parser_makeSatisfiesExpression(receiver: GoPtr<Parser>, expression: GoPtr<Expression>, typeNode: GoPtr<TypeNode>): GoPtr<Node> {
  return Parser_checkJSSyntax(receiver, Parser_finishNode(receiver, NewSatisfiesExpression(receiver!.factory, expression, typeNode), Node_Pos(expression)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.makeAsExpression","kind":"method","status":"implemented","sigHash":"23d0562f3bae915aa35b9ceaa9c26ab7d80854762ab0a2a235b797f75bfe8627","bodyHash":"96e3509eefa2a94c581cbe432f4b0b740b210d0b17ed7c0c15bd4a20e25ef601"}
 *
 * Go source:
 * func (p *Parser) makeAsExpression(left *ast.Expression, right *ast.TypeNode) *ast.Node {
 * 	return p.checkJSSyntax(p.finishNode(p.factory.NewAsExpression(left, right), left.Pos()))
 * }
 */
export function Parser_makeAsExpression(receiver: GoPtr<Parser>, left: GoPtr<Expression>, right: GoPtr<TypeNode>): GoPtr<Node> {
  return Parser_checkJSSyntax(receiver, Parser_finishNode(receiver, NewAsExpression(receiver!.factory, left, right), Node_Pos(left)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.makeBinaryExpression","kind":"method","status":"implemented","sigHash":"11b98b0fafc0275832f2d73790fe38a8c4659352fc14f04656423f725c2bf6ab","bodyHash":"66112149c3ceecd47d5e4dfa0787f24dfaa5d46d5b6e70974133496901e59eb6"}
 *
 * Go source:
 * func (p *Parser) makeBinaryExpression(left *ast.Expression, operatorToken *ast.Node, right *ast.Expression, pos int) *ast.Node {
 * 	return p.finishNode(p.factory.NewBinaryExpression(nil /*modifiers* /, left, nil /*typeNode* /, operatorToken, right), pos)
 * }
 */
export function Parser_makeBinaryExpression(receiver: GoPtr<Parser>, left: GoPtr<Expression>, operatorToken: GoPtr<Node>, right: GoPtr<Expression>, pos: int): GoPtr<Node> {
  return Parser_finishNode(receiver, NewBinaryExpression(receiver!.factory, undefined /*modifiers*/, left, undefined /*typeNode*/, operatorToken, right), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseUnaryExpressionOrHigher","kind":"method","status":"implemented","sigHash":"9837dbe97c2e626923ed0c221cf0cd1aab1aeb15c68bb7e10925ae6b37e2d54f","bodyHash":"ea1e49fb9a590acf81bfc04b9cabaa48b21714e70ebc495c7839e81b0145c6dd"}
 *
 * Go source:
 * func (p *Parser) parseUnaryExpressionOrHigher() *ast.Expression {
 * 	// ES7 UpdateExpression:
 * 	//      1) LeftHandSideExpression[?Yield]
 * 	//      2) LeftHandSideExpression[?Yield][no LineTerminator here]++
 * 	//      3) LeftHandSideExpression[?Yield][no LineTerminator here]--
 * 	//      4) ++UnaryExpression[?Yield]
 * 	//      5) --UnaryExpression[?Yield]
 * 	if p.isUpdateExpression() {
 * 		pos := p.nodePos()
 * 		updateExpression := p.parseUpdateExpression()
 * 		if p.token == ast.KindAsteriskAsteriskToken {
 * 			return p.parseBinaryExpressionRest(ast.GetBinaryOperatorPrecedence(p.token), updateExpression, pos)
 * 		}
 * 		return updateExpression
 * 	}
 * 	// ES7 UnaryExpression:
 * 	//      1) UpdateExpression[?yield]
 * 	//      2) delete UpdateExpression[?yield]
 * 	//      3) void UpdateExpression[?yield]
 * 	//      4) typeof UpdateExpression[?yield]
 * 	//      5) + UpdateExpression[?yield]
 * 	//      6) - UpdateExpression[?yield]
 * 	//      7) ~ UpdateExpression[?yield]
 * 	//      8) ! UpdateExpression[?yield]
 * 	unaryOperator := p.token
 * 	simpleUnaryExpression := p.parseSimpleUnaryExpression()
 * 	if p.token == ast.KindAsteriskAsteriskToken {
 * 		pos := scanner.SkipTrivia(p.sourceText, simpleUnaryExpression.Pos())
 * 		end := simpleUnaryExpression.End()
 * 		if simpleUnaryExpression.Kind == ast.KindTypeAssertionExpression {
 * 			p.parseErrorAt(pos, end, diagnostics.A_type_assertion_expression_is_not_allowed_in_the_left_hand_side_of_an_exponentiation_expression_Consider_enclosing_the_expression_in_parentheses)
 * 		} else {
 * 			debug.Assert(isKeywordOrPunctuation(unaryOperator))
 * 			p.parseErrorAt(pos, end, diagnostics.An_unary_expression_with_the_0_operator_is_not_allowed_in_the_left_hand_side_of_an_exponentiation_expression_Consider_enclosing_the_expression_in_parentheses, scanner.TokenToString(unaryOperator))
 * 		}
 * 	}
 * 	return simpleUnaryExpression
 * }
 */
export function Parser_parseUnaryExpressionOrHigher(receiver: GoPtr<Parser>): GoPtr<Expression> {
  // ES7 UpdateExpression:
  //      1) LeftHandSideExpression[?Yield]
  //      2) LeftHandSideExpression[?Yield][no LineTerminator here]++
  //      3) LeftHandSideExpression[?Yield][no LineTerminator here]--
  //      4) ++UnaryExpression[?Yield]
  //      5) --UnaryExpression[?Yield]
  if (Parser_isUpdateExpression(receiver)) {
    const pos = Parser_nodePos(receiver);
    const updateExpression = Parser_parseUpdateExpression(receiver);
    if (receiver!.token === KindAsteriskAsteriskToken) {
      return Parser_parseBinaryExpressionRest(receiver, GetBinaryOperatorPrecedence(receiver!.token), updateExpression, pos);
    }
    return updateExpression;
  }
  // ES7 UnaryExpression:
  //      1) UpdateExpression[?yield]
  //      2) delete UpdateExpression[?yield]
  //      3) void UpdateExpression[?yield]
  //      4) typeof UpdateExpression[?yield]
  //      5) + UpdateExpression[?yield]
  //      6) - UpdateExpression[?yield]
  //      7) ~ UpdateExpression[?yield]
  //      8) ! UpdateExpression[?yield]
  const unaryOperator = receiver!.token;
  const simpleUnaryExpression = Parser_parseSimpleUnaryExpression(receiver);
  if (receiver!.token === KindAsteriskAsteriskToken) {
    const suePos = SkipTrivia(receiver!.sourceText, Node_Pos(simpleUnaryExpression));
    const sueEnd = Node_End(simpleUnaryExpression);
    if (simpleUnaryExpression!.Kind === KindTypeAssertionExpression) {
      Parser_parseErrorAt(receiver, suePos, sueEnd, A_type_assertion_expression_is_not_allowed_in_the_left_hand_side_of_an_exponentiation_expression_Consider_enclosing_the_expression_in_parentheses);
    } else {
      Assert(isKeywordOrPunctuation(unaryOperator));
      Parser_parseErrorAt(receiver, suePos, sueEnd, An_unary_expression_with_the_0_operator_is_not_allowed_in_the_left_hand_side_of_an_exponentiation_expression_Consider_enclosing_the_expression_in_parentheses, TokenToString(unaryOperator));
    }
  }
  return simpleUnaryExpression;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isUpdateExpression","kind":"method","status":"implemented","sigHash":"036df4ef5aace5ae29537440458c2c1bc44a0e71ae585d334abc6690276a048e","bodyHash":"b7f44005fa95fbb782f8f497f64d40778c1f0f43c1f23ded5e72f541f9d2dc3d"}
 *
 * Go source:
 * func (p *Parser) isUpdateExpression() bool {
 * 	switch p.token {
 * 	case ast.KindPlusToken, ast.KindMinusToken, ast.KindTildeToken, ast.KindExclamationToken, ast.KindDeleteKeyword, ast.KindTypeOfKeyword, ast.KindVoidKeyword, ast.KindAwaitKeyword:
 * 		return false
 * 	case ast.KindLessThanToken:
 * 		return p.languageVariant == core.LanguageVariantJSX
 * 	}
 * 	return true
 * }
 */
export function Parser_isUpdateExpression(receiver: GoPtr<Parser>): bool {
  switch (receiver!.token) {
    case KindPlusToken:
    case KindMinusToken:
    case KindTildeToken:
    case KindExclamationToken:
    case KindDeleteKeyword:
    case KindTypeOfKeyword:
    case KindVoidKeyword:
    case KindAwaitKeyword:
      return false;
    case KindLessThanToken:
      return receiver!.languageVariant === LanguageVariantJSX;
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseUpdateExpression","kind":"method","status":"implemented","sigHash":"0c56f6f8320f5bff49a37c1d3056efa03835fbe5c72c6ddb0de8fe90b853b4c0","bodyHash":"fa8d17bd585e19cd05ba18b8fb0b3a67d782705b5865aaccac36612e4dcd7d10"}
 *
 * Go source:
 * func (p *Parser) parseUpdateExpression() *ast.Expression {
 * 	pos := p.nodePos()
 * 	if p.token == ast.KindPlusPlusToken || p.token == ast.KindMinusMinusToken {
 * 		operator := p.token
 * 		p.nextToken()
 * 		return p.finishNode(p.factory.NewPrefixUnaryExpression(operator, p.parseLeftHandSideExpressionOrHigher()), pos)
 * 	} else if p.languageVariant == core.LanguageVariantJSX && p.token == ast.KindLessThanToken && p.lookAhead((*Parser).nextTokenIsIdentifierOrKeywordOrGreaterThan) {
 * 		// JSXElement is part of primaryExpression
 * 		return p.parseJsxElementOrSelfClosingElementOrFragment(true /*inExpressionContext* /, -1 /*topInvalidNodePosition* /, nil /*openingTag* /, false /*mustBeUnary* /)
 * 	}
 * 	expression := p.parseLeftHandSideExpressionOrHigher()
 * 	if (p.token == ast.KindPlusPlusToken || p.token == ast.KindMinusMinusToken) && !p.hasPrecedingLineBreak() {
 * 		operator := p.token
 * 		p.nextToken()
 * 		return p.finishNode(p.factory.NewPostfixUnaryExpression(expression, operator), pos)
 * 	}
 * 	return expression
 * }
 */
export function Parser_parseUpdateExpression(receiver: GoPtr<Parser>): GoPtr<Expression> {
  const pos = Parser_nodePos(receiver);
  if (receiver!.token === KindPlusPlusToken || receiver!.token === KindMinusMinusToken) {
    const operator = receiver!.token;
    Parser_nextToken(receiver);
    return Parser_finishNode(receiver, NewPrefixUnaryExpression(receiver!.factory, operator, Parser_parseLeftHandSideExpressionOrHigher(receiver)), pos);
  } else if (receiver!.languageVariant === LanguageVariantJSX && receiver!.token === KindLessThanToken && Parser_lookAhead(receiver, Parser_nextTokenIsIdentifierOrKeywordOrGreaterThan)) {
    // JSXElement is part of primaryExpression
    return Parser_parseJsxElementOrSelfClosingElementOrFragment(receiver, true /*inExpressionContext*/, -1 /*topInvalidNodePosition*/, undefined /*openingTag*/, false /*mustBeUnary*/);
  }
  const expression = Parser_parseLeftHandSideExpressionOrHigher(receiver);
  if ((receiver!.token === KindPlusPlusToken || receiver!.token === KindMinusMinusToken) && !Parser_hasPrecedingLineBreak(receiver)) {
    const operator = receiver!.token;
    Parser_nextToken(receiver);
    return Parser_finishNode(receiver, NewPostfixUnaryExpression(receiver!.factory, expression, operator), pos);
  }
  return expression;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseSimpleUnaryExpression","kind":"method","status":"implemented","sigHash":"0087207c7f36939d2f68d7fb81485447673e5a7f6762b16e4afe55e4032b7c18","bodyHash":"24404e4678e71459d7312a97144c54627f7390dea081b37a08063b1051449ced"}
 *
 * Go source:
 * func (p *Parser) parseSimpleUnaryExpression() *ast.Expression {
 * 	switch p.token {
 * 	case ast.KindPlusToken, ast.KindMinusToken, ast.KindTildeToken, ast.KindExclamationToken:
 * 		return p.parsePrefixUnaryExpression()
 * 	case ast.KindDeleteKeyword:
 * 		return p.parseDeleteExpression()
 * 	case ast.KindTypeOfKeyword:
 * 		return p.parseTypeOfExpression()
 * 	case ast.KindVoidKeyword:
 * 		return p.parseVoidExpression()
 * 	case ast.KindLessThanToken:
 * 		// Just like in parseUpdateExpression, we need to avoid parsing type assertions when
 * 		// in JSX and we see an expression like "+ <foo> bar".
 * 		if p.languageVariant == core.LanguageVariantJSX {
 * 			return p.parseJsxElementOrSelfClosingElementOrFragment(true /*inExpressionContext* /, -1 /*topInvalidNodePosition* /, nil /*openingTag* /, true /*mustBeUnary* /)
 * 		}
 * 		// // This is modified UnaryExpression grammar in TypeScript
 * 		// //  UnaryExpression (modified):
 * 		// //      < type > UnaryExpression
 * 		return p.parseTypeAssertion()
 * 	case ast.KindAwaitKeyword:
 * 		if p.isAwaitExpression() {
 * 			return p.parseAwaitExpression()
 * 		}
 * 		fallthrough
 * 	default:
 * 		return p.parseUpdateExpression()
 * 	}
 * }
 */
export function Parser_parseSimpleUnaryExpression(receiver: GoPtr<Parser>): GoPtr<Expression> {
  switch (receiver!.token) {
    case KindPlusToken:
    case KindMinusToken:
    case KindTildeToken:
    case KindExclamationToken:
      return Parser_parsePrefixUnaryExpression(receiver);
    case KindDeleteKeyword:
      return Parser_parseDeleteExpression(receiver);
    case KindTypeOfKeyword:
      return Parser_parseTypeOfExpression(receiver);
    case KindVoidKeyword:
      return Parser_parseVoidExpression(receiver);
    case KindLessThanToken:
      // Just like in parseUpdateExpression, we need to avoid parsing type assertions when
      // in JSX and we see an expression like "+ <foo> bar".
      if (receiver!.languageVariant === LanguageVariantJSX) {
        return Parser_parseJsxElementOrSelfClosingElementOrFragment(receiver, true /*inExpressionContext*/, -1 /*topInvalidNodePosition*/, undefined /*openingTag*/, true /*mustBeUnary*/);
      }
      // // This is modified UnaryExpression grammar in TypeScript
      // //  UnaryExpression (modified):
      // //      < type > UnaryExpression
      return Parser_parseTypeAssertion(receiver);
    case KindAwaitKeyword:
      if (Parser_isAwaitExpression(receiver)) {
        return Parser_parseAwaitExpression(receiver);
      }
      return Parser_parseUpdateExpression(receiver);
    default:
      return Parser_parseUpdateExpression(receiver);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parsePrefixUnaryExpression","kind":"method","status":"implemented","sigHash":"da025b1b4a858ad52721163fec2614db50697fecc5dc6974f1ba460440d470be","bodyHash":"fad864839b345a66914e4824d5d9d9e838e264ff55c823a4915e215eb68e561f"}
 *
 * Go source:
 * func (p *Parser) parsePrefixUnaryExpression() *ast.Node {
 * 	pos := p.nodePos()
 * 	operator := p.token
 * 	p.nextToken()
 * 	return p.finishNode(p.factory.NewPrefixUnaryExpression(operator, p.parseSimpleUnaryExpression()), pos)
 * }
 */
export function Parser_parsePrefixUnaryExpression(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const operator = receiver!.token;
  Parser_nextToken(receiver);
  return Parser_finishNode(receiver, NewPrefixUnaryExpression(receiver!.factory, operator, Parser_parseSimpleUnaryExpression(receiver)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseDeleteExpression","kind":"method","status":"implemented","sigHash":"c2cb83f97e4a4e72c7d68ead238ec3edf42a537b2a4ba2edcaac24290bc2a344","bodyHash":"7a3f424fb56368ff90d93057baa855017da1e3e747056afbf6ad3c8162454e86"}
 *
 * Go source:
 * func (p *Parser) parseDeleteExpression() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.nextToken()
 * 	return p.finishNode(p.factory.NewDeleteExpression(p.parseSimpleUnaryExpression()), pos)
 * }
 */
export function Parser_parseDeleteExpression(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_nextToken(receiver);
  return Parser_finishNode(receiver, NewDeleteExpression(receiver!.factory, Parser_parseSimpleUnaryExpression(receiver)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseVoidExpression","kind":"method","status":"implemented","sigHash":"fcece2041c4173306c2c8d894e3a77bbc2d41d2caf1a21350775e827f76b3362","bodyHash":"d276f7d6f4bc736fd9092f4f30b6b51bc28fa3fd6dc01c0f4a6341afa9c26a91"}
 *
 * Go source:
 * func (p *Parser) parseVoidExpression() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.nextToken()
 * 	return p.finishNode(p.factory.NewVoidExpression(p.parseSimpleUnaryExpression()), pos)
 * }
 */
export function Parser_parseVoidExpression(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_nextToken(receiver);
  return Parser_finishNode(receiver, NewVoidExpression(receiver!.factory, Parser_parseSimpleUnaryExpression(receiver)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isAwaitExpression","kind":"method","status":"implemented","sigHash":"ba5df16c77ee7223f18edf66914fedc65c0d9258e410ebdfc97413673aa1b3aa","bodyHash":"807d20eaf08f6fb40cd0e186bece0cb43f4f82f803b11064b17fc56a8964d614"}
 *
 * Go source:
 * func (p *Parser) isAwaitExpression() bool {
 * 	if p.token == ast.KindAwaitKeyword {
 * 		if p.inAwaitContext() {
 * 			return true
 * 		}
 * 		// here we are using similar heuristics as 'isYieldExpression'
 * 		return p.lookAhead((*Parser).nextTokenIsIdentifierOrKeywordOrLiteralOnSameLine)
 * 	}
 * 	return false
 * }
 */
export function Parser_isAwaitExpression(receiver: GoPtr<Parser>): bool {
  if (receiver!.token === KindAwaitKeyword) {
    if (Parser_inAwaitContext(receiver)) {
      return true;
    }
    // here we are using similar heuristics as 'isYieldExpression'
    return Parser_lookAhead(receiver, Parser_nextTokenIsIdentifierOrKeywordOrLiteralOnSameLine);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseAwaitExpression","kind":"method","status":"implemented","sigHash":"9c460ad31ada6eb3f154be25fdd9df4f9ce8f5ddbcdb891760237016b9e547d8","bodyHash":"ebcc02eb358d6e24c28b058d831c7d3b71e0d66b3abf6ac45dd46e2ae745dc11"}
 *
 * Go source:
 * func (p *Parser) parseAwaitExpression() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.nextToken()
 * 	return p.finishNode(p.factory.NewAwaitExpression(p.parseSimpleUnaryExpression()), pos)
 * }
 */
export function Parser_parseAwaitExpression(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_nextToken(receiver);
  return Parser_finishNode(receiver, NewAwaitExpression(receiver!.factory, Parser_parseSimpleUnaryExpression(receiver)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseLeftHandSideExpressionOrHigher","kind":"method","status":"implemented","sigHash":"d987dda248b9864b454bb843859c9a446b792bbc7ddaa8cb79a5207c2b287b1c","bodyHash":"d7cb4a00149ba748ffa9235f0a09c197aa305b9fab867be10eb05e71a8d8ac4e"}
 *
 * Go source:
 * func (p *Parser) parseLeftHandSideExpressionOrHigher() *ast.Expression {
 * 	// Original Ecma:
 * 	// LeftHandSideExpression: See 11.2
 * 	//      NewExpression
 * 	//      CallExpression
 * 	//
 * 	// Our simplification:
 * 	//
 * 	// LeftHandSideExpression: See 11.2
 * 	//      MemberExpression
 * 	//      CallExpression
 * 	//
 * 	// See comment in parseMemberExpressionOrHigher on how we replaced NewExpression with
 * 	// MemberExpression to make our lives easier.
 * 	//
 * 	// to best understand the below code, it's important to see how CallExpression expands
 * 	// out into its own productions:
 * 	//
 * 	// CallExpression:
 * 	//      MemberExpression Arguments
 * 	//      CallExpression Arguments
 * 	//      CallExpression[Expression]
 * 	//      CallExpression.IdentifierName
 * 	//      import (AssignmentExpression)
 * 	//      super Arguments
 * 	//      super.IdentifierName
 * 	//
 * 	// Because of the recursion in these calls, we need to bottom out first. There are three
 * 	// bottom out states we can run into: 1) We see 'super' which must start either of
 * 	// the last two CallExpression productions. 2) We see 'import' which must start import call.
 * 	// 3)we have a MemberExpression which either completes the LeftHandSideExpression,
 * 	// or starts the beginning of the first four CallExpression productions.
 * 	pos := p.nodePos()
 * 	var expression *ast.Expression
 * 	if p.token == ast.KindImportKeyword {
 * 		if p.lookAhead((*Parser).nextTokenIsOpenParenOrLessThan) {
 * 			// We don't want to eagerly consume all import keyword as import call expression so we look ahead to find "("
 * 			// For example:
 * 			//      var foo3 = require("subfolder
 * 			//      import * as foo1 from "module-from-node
 * 			// We want this import to be a statement rather than import call expression
 * 			p.sourceFlags |= ast.NodeFlagsPossiblyContainsDynamicImport
 * 			expression = p.parseKeywordExpression()
 * 		} else if p.lookAhead((*Parser).nextTokenIsDot) {
 * 			// This is an 'import.*' metaproperty (i.e. 'import.meta')
 * 			p.nextToken() // advance past the 'import'
 * 			p.nextToken() // advance past the dot
 * 			expression = p.finishNode(p.factory.NewMetaProperty(ast.KindImportKeyword, p.parseIdentifierName()), pos)
 * 			if expression.Text() == "defer" {
 * 				if p.token == ast.KindOpenParenToken || p.token == ast.KindLessThanToken {
 * 					p.sourceFlags |= ast.NodeFlagsPossiblyContainsDynamicImport
 * 				}
 * 			} else {
 * 				p.sourceFlags |= ast.NodeFlagsPossiblyContainsImportMeta
 * 			}
 * 		} else {
 * 			expression = p.parseMemberExpressionOrHigher()
 * 		}
 * 	} else if p.token == ast.KindSuperKeyword {
 * 		expression = p.parseSuperExpression()
 * 	} else {
 * 		expression = p.parseMemberExpressionOrHigher()
 * 	}
 * 	// Now, we *may* be complete.  However, we might have consumed the start of a
 * 	// CallExpression or OptionalExpression.  As such, we need to consume the rest
 * 	// of it here to be complete.
 * 	return p.parseCallExpressionRest(pos, expression)
 * }
 */
export function Parser_parseLeftHandSideExpressionOrHigher(receiver: GoPtr<Parser>): GoPtr<Expression> {
  const pos = Parser_nodePos(receiver);
  let expression: GoPtr<Node>;
  if (receiver!.token === KindImportKeyword) {
    if (Parser_lookAhead(receiver, Parser_nextTokenIsOpenParenOrLessThan)) {
      // We don't want to eagerly consume all import keyword as import call expression so we look ahead to find "("
      receiver!.sourceFlags |= NodeFlagsPossiblyContainsDynamicImport;
      expression = Parser_parseKeywordExpression(receiver);
    } else if (Parser_lookAhead(receiver, Parser_nextTokenIsDot)) {
      // This is an 'import.*' metaproperty (i.e. 'import.meta')
      Parser_nextToken(receiver); // advance past the 'import'
      Parser_nextToken(receiver); // advance past the dot
      expression = Parser_finishNode(receiver, NewMetaProperty(receiver!.factory, KindImportKeyword, Parser_parseIdentifierName(receiver)), pos);
      if (Node_Text(expression) === "defer") {
        if (receiver!.token === KindOpenParenToken || receiver!.token === KindLessThanToken) {
          receiver!.sourceFlags |= NodeFlagsPossiblyContainsDynamicImport;
        }
      } else {
        receiver!.sourceFlags |= NodeFlagsPossiblyContainsImportMeta;
      }
    } else {
      expression = Parser_parseMemberExpressionOrHigher(receiver);
    }
  } else if (receiver!.token === KindSuperKeyword) {
    expression = Parser_parseSuperExpression(receiver);
  } else {
    expression = Parser_parseMemberExpressionOrHigher(receiver);
  }
  // Now, we *may* be complete.  However, we might have consumed the start of a
  // CallExpression or OptionalExpression.  As such, we need to consume the rest
  // of it here to be complete.
  return Parser_parseCallExpressionRest(receiver, pos, expression);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseSuperExpression","kind":"method","status":"implemented","sigHash":"e4ccab08465a1d9b3b30a6a44c2b5c0bc82e63aa6b2c79cdd5d769e38a8992e5","bodyHash":"09c1eb60adc0cf79ca4ba59ae0731980df303e210b5a094a3eb79bfa26e661ec"}
 *
 * Go source:
 * func (p *Parser) parseSuperExpression() *ast.Expression {
 * 	pos := p.nodePos()
 * 	expression := p.parseKeywordExpression()
 * 	if p.token == ast.KindLessThanToken {
 * 		startPos := p.nodePos()
 * 		typeArguments := p.tryParseTypeArgumentsInExpression()
 * 		if typeArguments != nil {
 * 			p.parseErrorAt(startPos, p.nodePos(), diagnostics.X_super_may_not_use_type_arguments)
 * 			if !p.isTemplateStartOfTaggedTemplate() {
 * 				expression = p.finishNode(p.factory.NewExpressionWithTypeArguments(expression, typeArguments), pos)
 * 			}
 * 		}
 * 	}
 * 	if p.token == ast.KindOpenParenToken || p.token == ast.KindDotToken || p.token == ast.KindOpenBracketToken {
 * 		return expression
 * 	}
 * 	// If we have seen "super" it must be followed by '(' or '.'.
 * 	// If it wasn't then just try to parse out a '.' and report an error.
 * 	p.parseErrorAtCurrentToken(diagnostics.X_super_must_be_followed_by_an_argument_list_or_member_access)
 * 	// private names will never work with `super` (`super.#foo`), but that's a semantic error, not syntactic
 * 	return p.finishNode(p.factory.NewPropertyAccessExpression(expression, nil /*questionDotToken* /, p.parseRightSideOfDot(true /*allowIdentifierNames* /, true /*allowPrivateIdentifiers* /, true /*allowUnicodeEscapeSequenceInIdentifierName* /), ast.NodeFlagsNone), pos)
 * }
 */
export function Parser_parseSuperExpression(receiver: GoPtr<Parser>): GoPtr<Expression> {
  const pos = Parser_nodePos(receiver);
  const expression = ((): GoPtr<Expression> => {
    const keyword = Parser_parseKeywordExpression(receiver);
    if (receiver!.token === KindLessThanToken) {
      const startPos = Parser_nodePos(receiver);
      const typeArguments = Parser_tryParseTypeArgumentsInExpression(receiver);
      if (typeArguments !== undefined) {
        Parser_parseErrorAt(receiver, startPos, Parser_nodePos(receiver), X_super_may_not_use_type_arguments);
        if (!Parser_isTemplateStartOfTaggedTemplate(receiver)) {
          return Parser_finishNode(receiver, NewExpressionWithTypeArguments(receiver!.factory, keyword, typeArguments), pos);
        }
      }
    }
    return keyword;
  })();
  if (receiver!.token === KindOpenParenToken || receiver!.token === KindDotToken || receiver!.token === KindOpenBracketToken) {
    return expression;
  }
  // If we have seen "super" it must be followed by '(' or '.'.
  // If it wasn't then just try to parse out a '.' and report an error.
  Parser_parseErrorAtCurrentToken(receiver, X_super_must_be_followed_by_an_argument_list_or_member_access);
  // private names will never work with `super` (`super.#foo`), but that's a semantic error, not syntactic
  return Parser_finishNode(
    receiver,
    NewPropertyAccessExpression(receiver!.factory, expression, undefined /*questionDotToken*/, Parser_parseRightSideOfDot(receiver, true /*allowIdentifierNames*/, true /*allowPrivateIdentifiers*/, true /*allowUnicodeEscapeSequenceInIdentifierName*/), NodeFlagsNone),
    pos,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isTemplateStartOfTaggedTemplate","kind":"method","status":"implemented","sigHash":"1b32297e0b8a8f4fd5c0cabe6bb21c9f34b3f025a5fab7e9e27536219791f22a","bodyHash":"8de389cb4a533ba8e2bfb80ba6f98d7b42a55e287853c44ef06fd71f64fe68d5"}
 *
 * Go source:
 * func (p *Parser) isTemplateStartOfTaggedTemplate() bool {
 * 	return p.token == ast.KindNoSubstitutionTemplateLiteral || p.token == ast.KindTemplateHead
 * }
 */
export function Parser_isTemplateStartOfTaggedTemplate(receiver: GoPtr<Parser>): bool {
  return receiver!.token === KindNoSubstitutionTemplateLiteral || receiver!.token === KindTemplateHead;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseMemberExpressionOrHigher","kind":"method","status":"implemented","sigHash":"80f20866a66e88d3556723a460a4471e213eca33afa2ccff30352fe976b1d1eb","bodyHash":"16bb394b928056fa66bd32451ef6d8456ff8a7a67b311830cb508cefdb0314fa"}
 *
 * Go source:
 * func (p *Parser) parseMemberExpressionOrHigher() *ast.Node {
 * 	// Note: to make our lives simpler, we decompose the NewExpression productions and
 * 	// place ObjectCreationExpression and FunctionExpression into PrimaryExpression.
 * 	// like so:
 * 	//
 * 	//   PrimaryExpression : See 11.1
 * 	//      this
 * 	//      Identifier
 * 	//      Literal
 * 	//      ArrayLiteral
 * 	//      ObjectLiteral
 * 	//      (Expression)
 * 	//      FunctionExpression
 * 	//      new MemberExpression Arguments?
 * 	//
 * 	//   MemberExpression : See 11.2
 * 	//      PrimaryExpression
 * 	//      MemberExpression[Expression]
 * 	//      MemberExpression.IdentifierName
 * 	//
 * 	//   CallExpression : See 11.2
 * 	//      MemberExpression
 * 	//      CallExpression Arguments
 * 	//      CallExpression[Expression]
 * 	//      CallExpression.IdentifierName
 * 	//
 * 	// Technically this is ambiguous.  i.e. CallExpression defines:
 * 	//
 * 	//   CallExpression:
 * 	//      CallExpression Arguments
 * 	//
 * 	// If you see: "new Foo()"
 * 	//
 * 	// Then that could be treated as a single ObjectCreationExpression, or it could be
 * 	// treated as the invocation of "new Foo".  We disambiguate that in code (to match
 * 	// the original grammar) by making sure that if we see an ObjectCreationExpression
 * 	// we always consume arguments if they are there. So we treat "new Foo()" as an
 * 	// object creation only, and not at all as an invocation.  Another way to think
 * 	// about this is that for every "new" that we see, we will consume an argument list if
 * 	// it is there as part of the *associated* object creation node.  Any additional
 * 	// argument lists we see, will become invocation expressions.
 * 	//
 * 	// Because there are no other places in the grammar now that refer to FunctionExpression
 * 	// or ObjectCreationExpression, it is safe to push down into the PrimaryExpression
 * 	// production.
 * 	//
 * 	// Because CallExpression and MemberExpression are left recursive, we need to bottom out
 * 	// of the recursion immediately.  So we parse out a primary expression to start with.
 * 	pos := p.nodePos()
 * 	expression := p.parsePrimaryExpression()
 * 	return p.parseMemberExpressionRest(pos, expression, true /*allowOptionalChain* /)
 * }
 */
export function Parser_parseMemberExpressionOrHigher(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const expression = Parser_parsePrimaryExpression(receiver);
  return Parser_parseMemberExpressionRest(receiver, pos, expression, true /*allowOptionalChain*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseMemberExpressionRest","kind":"method","status":"implemented","sigHash":"23c6dd4fa8b38f20be93c12e77494cc38f904c041c42f093208a880ac3896ece","bodyHash":"bcbe3ab932f3caf382f8a19f72dc75e4e0cebfb2de91cd14873c617a1254acaa"}
 *
 * Go source:
 * func (p *Parser) parseMemberExpressionRest(pos int, expression *ast.Expression, allowOptionalChain bool) *ast.Expression {
 * 	for {
 * 		var questionDotToken *ast.Node
 * 		isPropertyAccess := false
 * 		if allowOptionalChain && p.isStartOfOptionalPropertyOrElementAccessChain() {
 * 			questionDotToken = p.parseExpectedToken(ast.KindQuestionDotToken)
 * 			isPropertyAccess = tokenIsIdentifierOrKeyword(p.token)
 * 		} else {
 * 			isPropertyAccess = p.parseOptional(ast.KindDotToken)
 * 		}
 * 		if isPropertyAccess {
 * 			expression = p.parsePropertyAccessExpressionRest(pos, expression, questionDotToken)
 * 			continue
 * 		}
 * 		// when in the [Decorator] context, we do not parse ElementAccess as it could be part of a ComputedPropertyName
 * 		if (questionDotToken != nil || !p.inDecoratorContext()) && p.parseOptional(ast.KindOpenBracketToken) {
 * 			expression = p.parseElementAccessExpressionRest(pos, expression, questionDotToken)
 * 			continue
 * 		}
 * 		if p.isTemplateStartOfTaggedTemplate() {
 * 			// Absorb type arguments into TemplateExpression when preceding expression is ExpressionWithTypeArguments
 * 			if questionDotToken == nil && ast.IsExpressionWithTypeArguments(expression) {
 * 				original := expression.AsExpressionWithTypeArguments()
 * 				expression = p.parseTaggedTemplateRest(pos, original.Expression, questionDotToken, original.TypeArguments)
 * 				p.unparseExpressionWithTypeArguments(original.Expression, original.TypeArguments, expression)
 * 			} else {
 * 				expression = p.parseTaggedTemplateRest(pos, expression, questionDotToken, nil /*typeArguments* /)
 * 			}
 * 			continue
 * 		}
 * 		if questionDotToken == nil {
 * 			if p.token == ast.KindExclamationToken && !p.hasPrecedingLineBreak() {
 * 				p.nextToken()
 * 				expression = p.checkJSSyntax(p.finishNode(p.factory.NewNonNullExpression(expression, ast.NodeFlagsNone), pos))
 * 				continue
 * 			}
 * 			typeArguments := p.tryParseTypeArgumentsInExpression()
 * 			if typeArguments != nil {
 * 				expression = p.finishNode(p.factory.NewExpressionWithTypeArguments(expression, typeArguments), pos)
 * 				continue
 * 			}
 * 		}
 * 		return expression
 * 	}
 * }
 */
export function Parser_parseMemberExpressionRest(receiver: GoPtr<Parser>, pos: int, expression: GoPtr<Expression>, allowOptionalChain: bool): GoPtr<Expression> {
  let currentExpr: GoPtr<Expression> = expression;
  while (true) {
    let questionDotToken: GoPtr<Node> = undefined;
    let isPropertyAccess = false as bool;
    if (allowOptionalChain && Parser_isStartOfOptionalPropertyOrElementAccessChain(receiver)) {
      questionDotToken = Parser_parseExpectedToken(receiver, KindQuestionDotToken);
      isPropertyAccess = tokenIsIdentifierOrKeyword(receiver!.token) as bool;
    } else {
      isPropertyAccess = Parser_parseOptional(receiver, KindDotToken) as bool;
    }
    if (isPropertyAccess) {
      currentExpr = Parser_parsePropertyAccessExpressionRest(receiver, pos, currentExpr, questionDotToken);
      continue;
    }
    // when in the [Decorator] context, we do not parse ElementAccess as it could be part of a ComputedPropertyName
    if ((questionDotToken !== undefined || !Parser_inDecoratorContext(receiver)) && Parser_parseOptional(receiver, KindOpenBracketToken)) {
      currentExpr = Parser_parseElementAccessExpressionRest(receiver, pos, currentExpr, questionDotToken);
      continue;
    }
    if (Parser_isTemplateStartOfTaggedTemplate(receiver)) {
      // Absorb type arguments into TemplateExpression when preceding expression is ExpressionWithTypeArguments
      if (questionDotToken === undefined && IsExpressionWithTypeArguments(currentExpr)) {
        const original = AsExpressionWithTypeArguments(currentExpr)!;
        currentExpr = Parser_parseTaggedTemplateRest(receiver, pos, original.Expression, questionDotToken, original.TypeArguments);
        Parser_unparseExpressionWithTypeArguments(receiver, original.Expression, original.TypeArguments, currentExpr);
      } else {
        currentExpr = Parser_parseTaggedTemplateRest(receiver, pos, currentExpr, questionDotToken, undefined /*typeArguments*/);
      }
      continue;
    }
    if (questionDotToken === undefined) {
      if (receiver!.token === KindExclamationToken && !Parser_hasPrecedingLineBreak(receiver)) {
        Parser_nextToken(receiver);
        currentExpr = Parser_checkJSSyntax(receiver, Parser_finishNode(receiver, NewNonNullExpression(receiver!.factory, currentExpr, NodeFlagsNone), pos));
        continue;
      }
      const typeArguments = Parser_tryParseTypeArgumentsInExpression(receiver);
      if (typeArguments !== undefined) {
        currentExpr = Parser_finishNode(receiver, NewExpressionWithTypeArguments(receiver!.factory, currentExpr, typeArguments), pos);
        continue;
      }
    }
    return currentExpr;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isStartOfOptionalPropertyOrElementAccessChain","kind":"method","status":"implemented","sigHash":"bc1333f42b831ddd2577d23c075afa2e8569897570b498f748607c4c8e8ba0cc","bodyHash":"834c8304cc243b656c9bd231cc034ea2f27570a681d8730c31eb6b744e19ea5a"}
 *
 * Go source:
 * func (p *Parser) isStartOfOptionalPropertyOrElementAccessChain() bool {
 * 	return p.token == ast.KindQuestionDotToken && p.lookAhead((*Parser).nextTokenIsIdentifierOrKeywordOrOpenBracketOrTemplate)
 * }
 */
export function Parser_isStartOfOptionalPropertyOrElementAccessChain(receiver: GoPtr<Parser>): bool {
  return receiver!.token === KindQuestionDotToken && Parser_lookAhead(receiver, Parser_nextTokenIsIdentifierOrKeywordOrOpenBracketOrTemplate);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsIdentifierOrKeywordOrOpenBracketOrTemplate","kind":"method","status":"implemented","sigHash":"a1928fd67926ee56d6d284ebd1582a29053f7f4ead2ec4e1cbd3a2f36731139b","bodyHash":"f42b8fdee7aa38bcd85f5ee24e62352668a778ef759513b00e5b38958be6cda1"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsIdentifierOrKeywordOrOpenBracketOrTemplate() bool {
 * 	p.nextToken()
 * 	return tokenIsIdentifierOrKeyword(p.token) || p.token == ast.KindOpenBracketToken || p.isTemplateStartOfTaggedTemplate()
 * }
 */
export function Parser_nextTokenIsIdentifierOrKeywordOrOpenBracketOrTemplate(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  return tokenIsIdentifierOrKeyword(receiver!.token) || receiver!.token === KindOpenBracketToken || Parser_isTemplateStartOfTaggedTemplate(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parsePropertyAccessExpressionRest","kind":"method","status":"implemented","sigHash":"15de743051baa6d0d15319473945b7c0feb3b64e0d5a46fa422961db767d5f7b","bodyHash":"7744ac11b323ae49dcbf9f117a5ae80f0fd73e8921e661e7279d79577ba781bf"}
 *
 * Go source:
 * func (p *Parser) parsePropertyAccessExpressionRest(pos int, expression *ast.Expression, questionDotToken *ast.Node) *ast.Node {
 * 	name := p.parseRightSideOfDot(true /*allowIdentifierNames* /, true /*allowPrivateIdentifiers* /, true /*allowUnicodeEscapeSequenceInIdentifierName* /)
 * 	isOptionalChain := questionDotToken != nil || p.tryReparseOptionalChain(expression)
 * 	propertyAccess := p.factory.NewPropertyAccessExpression(expression, questionDotToken, name, core.IfElse(isOptionalChain, ast.NodeFlagsOptionalChain, ast.NodeFlagsNone))
 * 	if isOptionalChain && ast.IsPrivateIdentifier(name) {
 * 		p.parseErrorAtRange(p.skipRangeTrivia(name.Loc), diagnostics.An_optional_chain_cannot_contain_private_identifiers)
 * 	}
 * 	if ast.IsExpressionWithTypeArguments(expression) {
 * 		typeArguments := expression.TypeArgumentList()
 * 		if typeArguments != nil {
 * 			loc := core.NewTextRange(typeArguments.Pos()-1, scanner.SkipTrivia(p.sourceText, typeArguments.End())+1)
 * 			p.parseErrorAtRange(loc, diagnostics.An_instantiation_expression_cannot_be_followed_by_a_property_access)
 * 		}
 * 	}
 * 	return p.finishNode(propertyAccess, pos)
 * }
 */
export function Parser_parsePropertyAccessExpressionRest(receiver: GoPtr<Parser>, pos: int, expression: GoPtr<Expression>, questionDotToken: GoPtr<Node>): GoPtr<Node> {
  const name = Parser_parseRightSideOfDot(receiver, true /*allowIdentifierNames*/, true /*allowPrivateIdentifiers*/, true /*allowUnicodeEscapeSequenceInIdentifierName*/);
  const isOptionalChain = questionDotToken !== undefined || Parser_tryReparseOptionalChain(receiver, expression);
  const propertyAccess = NewPropertyAccessExpression(receiver!.factory, expression, questionDotToken, name, IfElse(isOptionalChain, NodeFlagsOptionalChain, NodeFlagsNone));
  if (isOptionalChain && IsPrivateIdentifier(name)) {
    Parser_parseErrorAtRange(receiver, Parser_skipRangeTrivia(receiver, name!.Loc), An_optional_chain_cannot_contain_private_identifiers);
  }
  if (IsExpressionWithTypeArguments(expression)) {
    const typeArguments = Node_TypeArgumentList(expression);
    if (typeArguments !== undefined) {
      const loc = NewTextRange(NodeList_Pos(typeArguments) - 1, SkipTrivia(receiver!.sourceText, NodeList_End(typeArguments)) + 1);
      Parser_parseErrorAtRange(receiver, loc, An_instantiation_expression_cannot_be_followed_by_a_property_access);
    }
  }
  return Parser_finishNode(receiver, propertyAccess, pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseElementAccessExpressionRest","kind":"method","status":"implemented","sigHash":"4288ea5c17c2bd47d3055aed3740aa6e940d567977fd987d8ffbb4a5e084e74b","bodyHash":"1060d126941f4842cb20974ba38258527ca8aaac00671724a94a45a14ce6931e"}
 *
 * Go source:
 * func (p *Parser) parseElementAccessExpressionRest(pos int, expression *ast.Expression, questionDotToken *ast.Node) *ast.Node {
 * 	var argumentExpression *ast.Expression
 * 	if p.token == ast.KindCloseBracketToken {
 * 		p.parseErrorAt(p.nodePos(), p.nodePos(), diagnostics.An_element_access_expression_should_take_an_argument)
 * 		argumentExpression = p.createMissingIdentifier()
 * 	} else {
 * 		argument := p.parseExpressionAllowIn()
 * 		switch argument.Kind {
 * 		case ast.KindStringLiteral:
 * 			argument.AsStringLiteral().Text = p.internIdentifier(argument.Text())
 * 		case ast.KindNoSubstitutionTemplateLiteral:
 * 			argument.AsNoSubstitutionTemplateLiteral().Text = p.internIdentifier(argument.Text())
 * 		case ast.KindNumericLiteral:
 * 			argument.AsNumericLiteral().Text = p.internIdentifier(argument.Text())
 * 		}
 * 		argumentExpression = argument
 * 	}
 * 	p.parseExpected(ast.KindCloseBracketToken)
 * 	isOptionalChain := questionDotToken != nil || p.tryReparseOptionalChain(expression)
 * 	return p.finishNode(p.factory.NewElementAccessExpression(expression, questionDotToken, argumentExpression, core.IfElse(isOptionalChain, ast.NodeFlagsOptionalChain, ast.NodeFlagsNone)), pos)
 * }
 */
export function Parser_parseElementAccessExpressionRest(receiver: GoPtr<Parser>, pos: int, expression: GoPtr<Expression>, questionDotToken: GoPtr<Node>): GoPtr<Node> {
  let argumentExpression: GoPtr<Node>;
  if (receiver!.token === KindCloseBracketToken) {
    Parser_parseErrorAt(receiver, Parser_nodePos(receiver), Parser_nodePos(receiver), An_element_access_expression_should_take_an_argument);
    argumentExpression = Parser_createMissingIdentifier(receiver);
  } else {
    const argument = Parser_parseExpressionAllowIn(receiver);
    switch (argument!.Kind) {
      case KindStringLiteral:
        AsStringLiteral(argument)!.Text = Parser_internIdentifier(receiver, Node_Text(argument));
        break;
      case KindNoSubstitutionTemplateLiteral:
        AsNoSubstitutionTemplateLiteral(argument)!.Text = Parser_internIdentifier(receiver, Node_Text(argument));
        break;
      case KindNumericLiteral:
        AsNumericLiteral(argument)!.Text = Parser_internIdentifier(receiver, Node_Text(argument));
        break;
    }
    argumentExpression = argument;
  }
  Parser_parseExpected(receiver, KindCloseBracketToken);
  const isOptionalChain = questionDotToken !== undefined || Parser_tryReparseOptionalChain(receiver, expression);
  return Parser_finishNode(receiver, NewElementAccessExpression(receiver!.factory, expression, questionDotToken, argumentExpression, IfElse(isOptionalChain, NodeFlagsOptionalChain, NodeFlagsNone)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseCallExpressionRest","kind":"method","status":"implemented","sigHash":"b83fc80526d07c6071f21d5300b9df510bae4e501e65468f68fa8f89d8c6c199","bodyHash":"5dbe50f20e840ce3456ce5fb246975a4ac40bb3a4c0b7f8363b1754b9c5e2829"}
 *
 * Go source:
 * func (p *Parser) parseCallExpressionRest(pos int, expression *ast.Expression) *ast.Expression {
 * 	for {
 * 		expression = p.parseMemberExpressionRest(pos, expression /*allowOptionalChain* /, true)
 * 		var typeArguments *ast.NodeList
 * 		questionDotToken := p.parseOptionalToken(ast.KindQuestionDotToken)
 * 		if questionDotToken != nil {
 * 			typeArguments = p.tryParseTypeArgumentsInExpression()
 * 			if p.isTemplateStartOfTaggedTemplate() {
 * 				expression = p.parseTaggedTemplateRest(pos, expression, questionDotToken, typeArguments)
 * 				continue
 * 			}
 * 		}
 * 		if typeArguments != nil || p.token == ast.KindOpenParenToken {
 * 			// Absorb type arguments into CallExpression when preceding expression is ExpressionWithTypeArguments
 * 			if questionDotToken == nil && expression.Kind == ast.KindExpressionWithTypeArguments {
 * 				typeArguments = expression.TypeArgumentList()
 * 				expression = expression.AsExpressionWithTypeArguments().Expression
 * 			}
 * 			inner := expression
 * 			argumentList := p.parseArgumentList()
 * 			isOptionalChain := questionDotToken != nil || p.tryReparseOptionalChain(expression)
 * 			expression = p.checkJSSyntax(p.finishNode(p.factory.NewCallExpression(expression, questionDotToken, typeArguments, argumentList, core.IfElse(isOptionalChain, ast.NodeFlagsOptionalChain, ast.NodeFlagsNone)), pos))
 * 			p.unparseExpressionWithTypeArguments(inner, typeArguments, expression)
 * 			continue
 * 		}
 * 		if questionDotToken != nil {
 * 			// We parsed `?.` but then failed to parse anything, so report a missing identifier here.
 * 			p.parseErrorAtCurrentToken(diagnostics.Identifier_expected)
 * 			name := p.createMissingIdentifier()
 * 			expression = p.finishNode(p.factory.NewPropertyAccessExpression(expression, questionDotToken, name, ast.NodeFlagsOptionalChain), pos)
 * 		}
 * 		break
 * 	}
 * 	return expression
 * }
 */
export function Parser_parseCallExpressionRest(receiver: GoPtr<Parser>, pos: int, expression: GoPtr<Expression>): GoPtr<Expression> {
  let currentExpr: GoPtr<Expression> = expression;
  while (true) {
    currentExpr = Parser_parseMemberExpressionRest(receiver, pos, currentExpr /*allowOptionalChain*/, true);
    let typeArguments: GoPtr<NodeList> = undefined;
    const questionDotToken = Parser_parseOptionalToken(receiver, KindQuestionDotToken);
    if (questionDotToken !== undefined) {
      typeArguments = Parser_tryParseTypeArgumentsInExpression(receiver);
      if (Parser_isTemplateStartOfTaggedTemplate(receiver)) {
        currentExpr = Parser_parseTaggedTemplateRest(receiver, pos, currentExpr, questionDotToken, typeArguments);
        continue;
      }
    }
    if (typeArguments !== undefined || receiver!.token === KindOpenParenToken) {
      // Absorb type arguments into CallExpression when preceding expression is ExpressionWithTypeArguments
      if (questionDotToken === undefined && currentExpr!.Kind === KindExpressionWithTypeArguments) {
        typeArguments = Node_TypeArgumentList(currentExpr);
        currentExpr = AsExpressionWithTypeArguments(currentExpr)!.Expression;
      }
      const inner = currentExpr;
      const argumentList = Parser_parseArgumentList(receiver);
      const isOptionalChain = questionDotToken !== undefined || Parser_tryReparseOptionalChain(receiver, currentExpr);
      currentExpr = Parser_checkJSSyntax(receiver, Parser_finishNode(receiver, NewCallExpression(receiver!.factory, currentExpr, questionDotToken, typeArguments, argumentList, IfElse(isOptionalChain, NodeFlagsOptionalChain, NodeFlagsNone)), pos));
      Parser_unparseExpressionWithTypeArguments(receiver, inner, typeArguments, currentExpr);
      continue;
    }
    if (questionDotToken !== undefined) {
      // We parsed `?.` but then failed to parse anything, so report a missing identifier here.
      Parser_parseErrorAtCurrentToken(receiver, Identifier_expected);
      const name = Parser_createMissingIdentifier(receiver);
      currentExpr = Parser_finishNode(receiver, NewPropertyAccessExpression(receiver!.factory, currentExpr, questionDotToken, name, NodeFlagsOptionalChain), pos);
    }
    break;
  }
  return currentExpr;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseArgumentExpression","kind":"method","status":"implemented","sigHash":"c4ba4a2995733265d8faff883deff81f4b37efc8c913441b39925276afb3c689","bodyHash":"8b71022713d8b6a58daf7ed9d8e25bf0094edf2e3143b266b5e5a39b0e7b5979"}
 *
 * Go source:
 * func (p *Parser) parseArgumentExpression() *ast.Expression {
 * 	return doInContext(p, ast.NodeFlagsDisallowInContext|ast.NodeFlagsDecoratorContext, false, (*Parser).parseArgumentOrArrayLiteralElement)
 * }
 */
export function Parser_parseArgumentExpression(receiver: GoPtr<Parser>): GoPtr<Expression> {
  return doInContext(receiver, NodeFlagsDisallowInContext | NodeFlagsDecoratorContext, false, Parser_parseArgumentOrArrayLiteralElement);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseArgumentOrArrayLiteralElement","kind":"method","status":"implemented","sigHash":"9c82b0dba253554cfe80e68a9b7c100e1079172a215eff337cffa5d5eed97216","bodyHash":"d37e5bca5797b88b1314336045cf088ac1c4d51f0b12b7fb9675eeb2b7148a50"}
 *
 * Go source:
 * func (p *Parser) parseArgumentOrArrayLiteralElement() *ast.Expression {
 * 	switch p.token {
 * 	case ast.KindDotDotDotToken:
 * 		return p.parseSpreadElement()
 * 	case ast.KindCommaToken:
 * 		return p.finishNode(p.factory.NewOmittedExpression(), p.nodePos())
 * 	}
 * 	return p.parseAssignmentExpressionOrHigher()
 * }
 */
export function Parser_parseArgumentOrArrayLiteralElement(receiver: GoPtr<Parser>): GoPtr<Expression> {
  switch (receiver!.token) {
    case KindDotDotDotToken:
      return Parser_parseSpreadElement(receiver);
    case KindCommaToken:
      return Parser_finishNode(receiver, NewOmittedExpression(receiver!.factory), Parser_nodePos(receiver));
  }
  return Parser_parseAssignmentExpressionOrHigher(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseSpreadElement","kind":"method","status":"implemented","sigHash":"a6589232fc15c828d700eabd98c26ebc88f69450b2a15299e8a0526d7e0d5af1","bodyHash":"42c348cfa47f4e63476ee075ce8b92ddcff0a9917bda3c9d4ac849a228af06bd"}
 *
 * Go source:
 * func (p *Parser) parseSpreadElement() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindDotDotDotToken)
 * 	expression := p.parseAssignmentExpressionOrHigher()
 * 	return p.finishNode(p.factory.NewSpreadElement(expression), pos)
 * }
 */
export function Parser_parseSpreadElement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindDotDotDotToken);
  const expression = Parser_parseAssignmentExpressionOrHigher(receiver);
  return Parser_finishNode(receiver, NewSpreadElement(receiver!.factory, expression), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTaggedTemplateRest","kind":"method","status":"implemented","sigHash":"c230c22255c4b8ecd984a033064f72d4969b87e865a75a4aa37181e6ee1a19e1","bodyHash":"d26b1f0a0fe6f4a8958d3fe6b09664b5b1d617be6ad3ce2b1ca3bfa14b5fcbb4"}
 *
 * Go source:
 * func (p *Parser) parseTaggedTemplateRest(pos int, tag *ast.Expression, questionDotToken *ast.Node, typeArguments *ast.NodeList) *ast.Node {
 * 	var template *ast.Expression
 * 	if p.token == ast.KindNoSubstitutionTemplateLiteral {
 * 		p.reScanTemplateToken(true /*isTaggedTemplate* /)
 * 		template = p.parseLiteralExpression(false /*intern* /)
 * 	} else {
 * 		template = p.parseTemplateExpression(true /*isTaggedTemplate* /)
 * 	}
 * 	isOptionalChain := questionDotToken != nil || tag.Flags&ast.NodeFlagsOptionalChain != 0
 * 	return p.checkJSSyntax(p.finishNode(p.factory.NewTaggedTemplateExpression(tag, questionDotToken, typeArguments, template, core.IfElse(isOptionalChain, ast.NodeFlagsOptionalChain, ast.NodeFlagsNone)), pos))
 * }
 */
export function Parser_parseTaggedTemplateRest(receiver: GoPtr<Parser>, pos: int, tag: GoPtr<Expression>, questionDotToken: GoPtr<Node>, typeArguments: GoPtr<NodeList>): GoPtr<Node> {
  let template: GoPtr<Node>;
  if (receiver!.token === KindNoSubstitutionTemplateLiteral) {
    Parser_reScanTemplateToken(receiver, true /*isTaggedTemplate*/);
    template = Parser_parseLiteralExpression(receiver, false /*intern*/);
  } else {
    template = Parser_parseTemplateExpression(receiver, true /*isTaggedTemplate*/);
  }
  const isOptionalChain = questionDotToken !== undefined || (tag!.Flags & NodeFlagsOptionalChain) !== 0;
  return Parser_checkJSSyntax(receiver, Parser_finishNode(receiver, NewTaggedTemplateExpression(receiver!.factory, tag, questionDotToken, typeArguments, template, IfElse(isOptionalChain, NodeFlagsOptionalChain, NodeFlagsNone)), pos));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTemplateExpression","kind":"method","status":"implemented","sigHash":"d346ccc19357ce47df9ff12178ae85e61d2888a0d0a511ea75e05be7497db14d","bodyHash":"93a70cf18d7bc790522646c36b4e9b96df036454d712dce43c5c6bccc86d038f"}
 *
 * Go source:
 * func (p *Parser) parseTemplateExpression(isTaggedTemplate bool) *ast.Expression {
 * 	pos := p.nodePos()
 * 	return p.finishNode(p.factory.NewTemplateExpression(p.parseTemplateHead(isTaggedTemplate), p.parseTemplateSpans(isTaggedTemplate)), pos)
 * }
 */
export function Parser_parseTemplateExpression(receiver: GoPtr<Parser>, isTaggedTemplate: bool): GoPtr<Expression> {
  const pos = Parser_nodePos(receiver);
  return Parser_finishNode(receiver, NewTemplateExpression(receiver!.factory, Parser_parseTemplateHead(receiver, isTaggedTemplate), Parser_parseTemplateSpans(receiver, isTaggedTemplate)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTemplateSpans","kind":"method","status":"implemented","sigHash":"fcd9fcd15b025ab56124f28dcb52a53af3e2729ce2b32d0c5fa9f76c2fe07c36","bodyHash":"d59b28a890604210c82e1f048f44e85529907dba259bb947aa7ca8ac77252304"}
 *
 * Go source:
 * func (p *Parser) parseTemplateSpans(isTaggedTemplate bool) *ast.NodeList {
 * 	pos := p.nodePos()
 * 	var list []*ast.Node
 * 	for {
 * 		span := p.parseTemplateSpan(isTaggedTemplate)
 * 		list = append(list, span)
 * 		if span.AsTemplateSpan().Literal.Kind != ast.KindTemplateMiddle {
 * 			break
 * 		}
 * 	}
 * 	return p.newNodeList(core.NewTextRange(pos, p.nodePos()), list)
 * }
 */
export function Parser_parseTemplateSpans(receiver: GoPtr<Parser>, isTaggedTemplate: bool): GoPtr<NodeList> {
  const pos = Parser_nodePos(receiver);
  const collect = (list: GoSlice<GoPtr<Node>>): GoSlice<GoPtr<Node>> => {
    const span = Parser_parseTemplateSpan(receiver, isTaggedTemplate);
    const next = [...list, span];
    if (AsTemplateSpan(span)!.Literal!.Kind !== KindTemplateMiddle) {
      return next;
    }
    return collect(next);
  };
  const list = collect([]);
  return Parser_newNodeList(receiver, NewTextRange(pos, Parser_nodePos(receiver)), list);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTemplateSpan","kind":"method","status":"implemented","sigHash":"981f61b9e317fd28f22116f78e49194099c04dbd6ca0bb9bc746b095f61f3dc7","bodyHash":"bc80c7bb6d9b98fb5a390f4db2cc6e4c09b0845ea4db0244e4ebf14b9e75add6"}
 *
 * Go source:
 * func (p *Parser) parseTemplateSpan(isTaggedTemplate bool) *ast.Node {
 * 	pos := p.nodePos()
 * 	expression := p.parseExpressionAllowIn()
 * 	literal := p.parseLiteralOfTemplateSpan(isTaggedTemplate)
 * 	return p.finishNode(p.factory.NewTemplateSpan(expression, literal), pos)
 * }
 */
export function Parser_parseTemplateSpan(receiver: GoPtr<Parser>, isTaggedTemplate: bool): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const expression = Parser_parseExpressionAllowIn(receiver);
  const literal = Parser_parseLiteralOfTemplateSpan(receiver, isTaggedTemplate);
  return Parser_finishNode(receiver, NewTemplateSpan(receiver!.factory, expression, literal), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parsePrimaryExpression","kind":"method","status":"implemented","sigHash":"fcf4e203b09bbf3450fa6718445e3fd7a3d4dd6079f6ef86ad6e1c0c847f3b73","bodyHash":"671cefaa00d96e1f7c5d8d7796b534fa7e68d0149ae271f5fb60e3a5ee27872a"}
 *
 * Go source:
 * func (p *Parser) parsePrimaryExpression() *ast.Expression {
 * 	switch p.token {
 * 	case ast.KindNoSubstitutionTemplateLiteral:
 * 		if p.scanner.TokenFlags()&ast.TokenFlagsIsInvalid != 0 {
 * 			p.reScanTemplateToken(false /*isTaggedTemplate* /)
 * 		}
 * 		fallthrough
 * 	case ast.KindNumericLiteral, ast.KindBigIntLiteral, ast.KindStringLiteral:
 * 		return p.parseLiteralExpression(false /*intern* /)
 * 	case ast.KindThisKeyword, ast.KindSuperKeyword, ast.KindNullKeyword, ast.KindTrueKeyword, ast.KindFalseKeyword:
 * 		return p.parseKeywordExpression()
 * 	case ast.KindOpenParenToken:
 * 		return p.parseParenthesizedExpression()
 * 	case ast.KindOpenBracketToken:
 * 		return p.parseArrayLiteralExpression()
 * 	case ast.KindOpenBraceToken:
 * 		return p.parseObjectLiteralExpression()
 * 	case ast.KindAsyncKeyword:
 * 		// Async arrow functions are parsed earlier in parseAssignmentExpressionOrHigher.
 * 		// If we encounter `async [no LineTerminator here] function` then this is an async
 * 		// function; otherwise, its an identifier.
 * 		if !p.lookAhead((*Parser).nextTokenIsFunctionKeywordOnSameLine) {
 * 			break
 * 		}
 * 		return p.parseFunctionExpression()
 * 	case ast.KindAtToken:
 * 		return p.parseDecoratedExpression()
 * 	case ast.KindClassKeyword:
 * 		return p.parseClassExpression()
 * 	case ast.KindFunctionKeyword:
 * 		return p.parseFunctionExpression()
 * 	case ast.KindNewKeyword:
 * 		return p.parseNewExpressionOrNewDotTarget()
 * 	case ast.KindSlashToken, ast.KindSlashEqualsToken:
 * 		if p.reScanSlashToken() == ast.KindRegularExpressionLiteral {
 * 			return p.parseLiteralExpression(false /*intern* /)
 * 		}
 * 	case ast.KindTemplateHead:
 * 		return p.parseTemplateExpression(false /*isTaggedTemplate* /)
 * 	case ast.KindPrivateIdentifier:
 * 		return p.parsePrivateIdentifier()
 * 	}
 * 	return p.parseIdentifierWithDiagnostic(diagnostics.Expression_expected, nil)
 * }
 */
export function Parser_parsePrimaryExpression(receiver: GoPtr<Parser>): GoPtr<Expression> {
  switch (receiver!.token) {
    case KindNoSubstitutionTemplateLiteral:
      if ((Scanner_TokenFlags(receiver!.scanner) & TokenFlagsIsInvalid) !== 0) {
        Parser_reScanTemplateToken(receiver, false /*isTaggedTemplate*/);
      }
      // fallthrough
      return Parser_parseLiteralExpression(receiver, false /*intern*/);
    case KindNumericLiteral:
    case KindBigIntLiteral:
    case KindStringLiteral:
      return Parser_parseLiteralExpression(receiver, false /*intern*/);
    case KindThisKeyword:
    case KindSuperKeyword:
    case KindNullKeyword:
    case KindTrueKeyword:
    case KindFalseKeyword:
      return Parser_parseKeywordExpression(receiver);
    case KindOpenParenToken:
      return Parser_parseParenthesizedExpression(receiver);
    case KindOpenBracketToken:
      return Parser_parseArrayLiteralExpression(receiver);
    case KindOpenBraceToken:
      return Parser_parseObjectLiteralExpression(receiver);
    case KindAsyncKeyword:
      // Async arrow functions are parsed earlier in parseAssignmentExpressionOrHigher.
      // If we encounter `async [no LineTerminator here] function` then this is an async
      // function; otherwise, its an identifier.
      if (!Parser_lookAhead(receiver, Parser_nextTokenIsFunctionKeywordOnSameLine)) {
        break;
      }
      return Parser_parseFunctionExpression(receiver);
    case KindAtToken:
      return Parser_parseDecoratedExpression(receiver);
    case KindClassKeyword:
      return Parser_parseClassExpression(receiver);
    case KindFunctionKeyword:
      return Parser_parseFunctionExpression(receiver);
    case KindNewKeyword:
      return Parser_parseNewExpressionOrNewDotTarget(receiver);
    case KindSlashToken:
    case KindSlashEqualsToken:
      if (Parser_reScanSlashToken(receiver) === KindRegularExpressionLiteral) {
        return Parser_parseLiteralExpression(receiver, false /*intern*/);
      }
      break;
    case KindTemplateHead:
      return Parser_parseTemplateExpression(receiver, false /*isTaggedTemplate*/);
    case KindPrivateIdentifier:
      return Parser_parsePrivateIdentifier(receiver);
  }
  return Parser_parseIdentifierWithDiagnostic(receiver, Expression_expected, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseParenthesizedExpression","kind":"method","status":"implemented","sigHash":"7c52df37fb29a3551e503fc2c6b7ab41128198b7e0911f321210dfd6c696684d","bodyHash":"ebf92139b878f64e2878755439e1f5b1831badce83b6b77c643b42bbfd2221df"}
 *
 * Go source:
 * func (p *Parser) parseParenthesizedExpression() *ast.Expression {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	p.parseExpected(ast.KindOpenParenToken)
 * 	expression := p.parseExpressionAllowIn()
 * 	p.parseExpected(ast.KindCloseParenToken)
 * 	result := p.finishNode(p.factory.NewParenthesizedExpression(expression), pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	return result
 * }
 */
export function Parser_parseParenthesizedExpression(receiver: GoPtr<Parser>): GoPtr<Expression> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  Parser_parseExpected(receiver, KindOpenParenToken);
  const expression = Parser_parseExpressionAllowIn(receiver);
  Parser_parseExpected(receiver, KindCloseParenToken);
  const result = Parser_finishNode(receiver, NewParenthesizedExpression(receiver!.factory, expression), pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseArrayLiteralExpression","kind":"method","status":"implemented","sigHash":"f8a3385aa270ace5192fe58dc372f017741e63ac3b8747a8ff0c4acaac152510","bodyHash":"e59ff20c21947a6a2558bd9a0376e18fe4a8096e3c32497cf92d57fcad9be881"}
 *
 * Go source:
 * func (p *Parser) parseArrayLiteralExpression() *ast.Expression {
 * 	pos := p.nodePos()
 * 	openBracketPosition := p.scanner.TokenStart()
 * 	openBracketParsed := p.parseExpected(ast.KindOpenBracketToken)
 * 	multiLine := p.hasPrecedingLineBreak()
 * 	elements := p.parseDelimitedList(PCArrayLiteralMembers, (*Parser).parseArgumentOrArrayLiteralElement)
 * 	p.parseExpectedMatchingBrackets(ast.KindOpenBracketToken, ast.KindCloseBracketToken, openBracketParsed, openBracketPosition)
 * 	return p.finishNode(p.factory.NewArrayLiteralExpression(elements, multiLine), pos)
 * }
 */
export function Parser_parseArrayLiteralExpression(receiver: GoPtr<Parser>): GoPtr<Expression> {
  const pos = Parser_nodePos(receiver);
  const openBracketPosition = Scanner_TokenStart(receiver!.scanner);
  const openBracketParsed = Parser_parseExpected(receiver, KindOpenBracketToken);
  const multiLine = Parser_hasPrecedingLineBreak(receiver);
  const elements = Parser_parseDelimitedList(receiver, PCArrayLiteralMembers, Parser_parseArgumentOrArrayLiteralElement);
  Parser_parseExpectedMatchingBrackets(receiver, KindOpenBracketToken, KindCloseBracketToken, openBracketParsed, openBracketPosition);
  return Parser_finishNode(receiver, NewArrayLiteralExpression(receiver!.factory, elements, multiLine), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseObjectLiteralExpression","kind":"method","status":"implemented","sigHash":"fd64b469868d64f7f2e7f7808f6f3732dc90f27cce644a5272a24c49a8eaa2b7","bodyHash":"a8b30353ef6d31599fe464fb964066cf3435c058390916c175f645f997dc339c"}
 *
 * Go source:
 * func (p *Parser) parseObjectLiteralExpression() *ast.Expression {
 * 	pos := p.nodePos()
 * 	openBracePosition := p.scanner.TokenStart()
 * 	openBraceParsed := p.parseExpected(ast.KindOpenBraceToken)
 * 	multiLine := p.hasPrecedingLineBreak()
 * 	properties := p.parseDelimitedList(PCObjectLiteralMembers, (*Parser).parseObjectLiteralElement)
 * 	p.parseExpectedMatchingBrackets(ast.KindOpenBraceToken, ast.KindCloseBraceToken, openBraceParsed, openBracePosition)
 * 	return p.finishNode(p.factory.NewObjectLiteralExpression(properties, multiLine), pos)
 * }
 */
export function Parser_parseObjectLiteralExpression(receiver: GoPtr<Parser>): GoPtr<Expression> {
  const pos = Parser_nodePos(receiver);
  const openBracePosition = Scanner_TokenStart(receiver!.scanner);
  const openBraceParsed = Parser_parseExpected(receiver, KindOpenBraceToken);
  const multiLine = Parser_hasPrecedingLineBreak(receiver);
  const properties = Parser_parseDelimitedList(receiver, PCObjectLiteralMembers, Parser_parseObjectLiteralElement);
  Parser_parseExpectedMatchingBrackets(receiver, KindOpenBraceToken, KindCloseBraceToken, openBraceParsed, openBracePosition);
  return Parser_finishNode(receiver, NewObjectLiteralExpression(receiver!.factory, properties, multiLine), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseObjectLiteralElement","kind":"method","status":"implemented","sigHash":"39026fbe254acd63e097de98afb1dcb95fe922ef3200bb9db1d95352f78b4cac","bodyHash":"43d08a3dbdb3e27e6685f84fc5ab1c261021ae1d57407fe5f682898d40b0d4ad"}
 *
 * Go source:
 * func (p *Parser) parseObjectLiteralElement() *ast.Node {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	if p.parseOptional(ast.KindDotDotDotToken) {
 * 		expression := p.parseAssignmentExpressionOrHigher()
 * 		result := p.finishNode(p.factory.NewSpreadAssignment(expression), pos)
 * 		p.withJSDoc(result, jsdoc)
 * 		return result
 * 	}
 * 	modifiers := p.parseModifiersEx(true /*allowDecorators* /, false /*permitConstAsModifier* /, false /*stopOnStartOfClassStaticBlock* /)
 * 	if p.parseContextualModifier(ast.KindGetKeyword) {
 * 		return p.parseAccessorDeclaration(pos, jsdoc, modifiers, ast.KindGetAccessor, ParseFlagsNone)
 * 	}
 * 	if p.parseContextualModifier(ast.KindSetKeyword) {
 * 		return p.parseAccessorDeclaration(pos, jsdoc, modifiers, ast.KindSetAccessor, ParseFlagsNone)
 * 	}
 * 	asteriskToken := p.parseOptionalToken(ast.KindAsteriskToken)
 * 	tokenIsIdentifier := p.isIdentifier()
 * 	name := p.parsePropertyName()
 * 	// Disallowing of optional property assignments and definite assignment assertion happens in the grammar checker.
 * 	postfixToken := p.parseOptionalToken(ast.KindQuestionToken)
 * 	// Decorators, Modifiers, questionToken, and exclamationToken are not supported by property assignments and are reported in the grammar checker
 * 	if postfixToken == nil {
 * 		postfixToken = p.parseOptionalToken(ast.KindExclamationToken)
 * 	}
 * 	if asteriskToken != nil || p.token == ast.KindOpenParenToken || p.token == ast.KindLessThanToken {
 * 		return p.parseMethodDeclaration(pos, jsdoc, modifiers, asteriskToken, name, postfixToken, nil /*diagnosticMessage* /)
 * 	}
 * 	// check if it is short-hand property assignment or normal property assignment
 * 	// NOTE: if token is EqualsToken it is interpreted as CoverInitializedName production
 * 	// CoverInitializedName[Yield] :
 * 	//     IdentifierReference[?Yield] Initializer[In, ?Yield]
 * 	// this is necessary because ObjectLiteral productions are also used to cover grammar for ObjectAssignmentPattern
 * 	var node *ast.Node
 * 	isShorthandPropertyAssignment := tokenIsIdentifier && p.token != ast.KindColonToken
 * 	if isShorthandPropertyAssignment {
 * 		equalsToken := p.parseOptionalToken(ast.KindEqualsToken)
 * 		var initializer *ast.Expression
 * 		if equalsToken != nil {
 * 			initializer = doInContext(p, ast.NodeFlagsDisallowInContext, false, (*Parser).parseAssignmentExpressionOrHigher)
 * 		}
 * 		node = p.factory.NewShorthandPropertyAssignment(modifiers, name, postfixToken, nil /*typeNode* /, equalsToken, initializer)
 * 	} else {
 * 		p.parseExpected(ast.KindColonToken)
 * 		initializer := doInContext(p, ast.NodeFlagsDisallowInContext, false, (*Parser).parseAssignmentExpressionOrHigher)
 * 		node = p.factory.NewPropertyAssignment(modifiers, name, postfixToken, nil /*typeNode* /, initializer)
 * 	}
 * 	p.finishNode(node, pos)
 * 	p.withJSDoc(node, jsdoc)
 * 	return node
 * }
 */
export function Parser_parseObjectLiteralElement(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  if (Parser_parseOptional(receiver, KindDotDotDotToken)) {
    const expression = Parser_parseAssignmentExpressionOrHigher(receiver);
    const result = Parser_finishNode(receiver, NewSpreadAssignment(receiver!.factory, expression), pos);
    Parser_withJSDoc(receiver, result, jsdoc);
    return result;
  }
  const modifiers = Parser_parseModifiersEx(receiver, true /*allowDecorators*/, false /*permitConstAsModifier*/, false /*stopOnStartOfClassStaticBlock*/);
  if (Parser_parseContextualModifier(receiver, KindGetKeyword)) {
    return Parser_parseAccessorDeclaration(receiver, pos, jsdoc, modifiers, KindGetAccessor, ParseFlagsNone);
  }
  if (Parser_parseContextualModifier(receiver, KindSetKeyword)) {
    return Parser_parseAccessorDeclaration(receiver, pos, jsdoc, modifiers, KindSetAccessor, ParseFlagsNone);
  }
  const asteriskToken = Parser_parseOptionalToken(receiver, KindAsteriskToken);
  const tokenIsIdentifier = Parser_isIdentifier(receiver);
  const name = Parser_parsePropertyName(receiver);
  // Disallowing of optional property assignments and definite assignment assertion happens in the grammar checker.
  let postfixToken = Parser_parseOptionalToken(receiver, KindQuestionToken);
  // Decorators, Modifiers, questionToken, and exclamationToken are not supported by property assignments and are reported in the grammar checker
  if (postfixToken === undefined) {
    postfixToken = Parser_parseOptionalToken(receiver, KindExclamationToken);
  }
  if (asteriskToken !== undefined || receiver!.token === KindOpenParenToken || receiver!.token === KindLessThanToken) {
    return Parser_parseMethodDeclaration(receiver, pos, jsdoc, modifiers, asteriskToken, name, postfixToken, undefined /*diagnosticMessage*/);
  }
  // check if it is short-hand property assignment or normal property assignment
  let node: GoPtr<Node>;
  const isShorthandPropertyAssignment = tokenIsIdentifier && receiver!.token !== KindColonToken;
  if (isShorthandPropertyAssignment) {
    const equalsToken = Parser_parseOptionalToken(receiver, KindEqualsToken);
    let initializer: GoPtr<Node> = undefined;
    if (equalsToken !== undefined) {
      initializer = doInContext(receiver, NodeFlagsDisallowInContext, false, Parser_parseAssignmentExpressionOrHigher);
    }
    node = NewShorthandPropertyAssignment(receiver!.factory, modifiers, name, postfixToken, undefined /*typeNode*/, equalsToken, initializer);
  } else {
    Parser_parseExpected(receiver, KindColonToken);
    const initializer = doInContext(receiver, NodeFlagsDisallowInContext, false, Parser_parseAssignmentExpressionOrHigher);
    node = NewPropertyAssignment(receiver!.factory, modifiers, name, postfixToken, undefined /*typeNode*/, initializer);
  }
  Parser_finishNode(receiver, node, pos);
  Parser_withJSDoc(receiver, node, jsdoc);
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseFunctionExpression","kind":"method","status":"implemented","sigHash":"54926de54f6c5622d27b37a9ff9ee6a43c6ade200049dbe72a8e5b28f28f680a","bodyHash":"46abc4e26b182dfba11953d9fe046ad1302898dd000a8edb293e5989866d22cf"}
 *
 * Go source:
 * func (p *Parser) parseFunctionExpression() *ast.Expression {
 * 	// GeneratorExpression:
 * 	//      function* BindingIdentifier [Yield][opt](FormalParameters[Yield]){ GeneratorBody }
 * 	//
 * 	// FunctionExpression:
 * 	//      function BindingIdentifier[opt](FormalParameters){ FunctionBody }
 * 	saveContexFlags := p.contextFlags
 * 	p.setContextFlags(ast.NodeFlagsDecoratorContext, false)
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	modifiers := p.parseModifiers()
 * 	p.parseExpected(ast.KindFunctionKeyword)
 * 	asteriskToken := p.parseOptionalToken(ast.KindAsteriskToken)
 * 	isGenerator := asteriskToken != nil
 * 	isAsync := modifierListHasAsync(modifiers)
 * 	signatureFlags := core.IfElse(isGenerator, ParseFlagsYield, ParseFlagsNone) | core.IfElse(isAsync, ParseFlagsAwait, ParseFlagsNone)
 * 	var name *ast.Node
 * 	switch {
 * 	case isGenerator && isAsync:
 * 		name = doInContext(p, ast.NodeFlagsYieldContext|ast.NodeFlagsAwaitContext, true, (*Parser).parseOptionalBindingIdentifier)
 * 	case isGenerator:
 * 		name = doInContext(p, ast.NodeFlagsYieldContext, true, (*Parser).parseOptionalBindingIdentifier)
 * 	case isAsync:
 * 		name = doInContext(p, ast.NodeFlagsAwaitContext, true, (*Parser).parseOptionalBindingIdentifier)
 * 	default:
 * 		name = p.parseOptionalBindingIdentifier()
 * 	}
 * 	typeParameters := p.parseTypeParameters()
 * 	parameters := p.parseParameters(signatureFlags)
 * 	returnType := p.parseReturnType(ast.KindColonToken, false /*isType* /)
 * 	body := p.parseFunctionBlock(signatureFlags, nil /*diagnosticMessage* /)
 * 	p.contextFlags = saveContexFlags
 * 	result := p.factory.NewFunctionExpression(modifiers, asteriskToken, name, typeParameters, parameters, returnType, nil /*fullSignature* /, body)
 * 	p.finishNode(result, pos)
 * 	p.withJSDoc(result, jsdoc)
 * 	p.checkJSSyntax(result)
 * 	return result
 * }
 */
export function Parser_parseFunctionExpression(receiver: GoPtr<Parser>): GoPtr<Expression> {
  // GeneratorExpression:
  //      function* BindingIdentifier [Yield][opt](FormalParameters[Yield]){ GeneratorBody }
  //
  // FunctionExpression:
  //      function BindingIdentifier[opt](FormalParameters){ FunctionBody }
  const saveContextFlags = receiver!.contextFlags;
  Parser_setContextFlags(receiver, NodeFlagsDecoratorContext, false);
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  const modifiers = Parser_parseModifiers(receiver);
  Parser_parseExpected(receiver, KindFunctionKeyword);
  const asteriskToken = Parser_parseOptionalToken(receiver, KindAsteriskToken);
  const isGenerator = asteriskToken !== undefined;
  const isAsync = modifierListHasAsync(modifiers);
  const signatureFlags = IfElse(isGenerator, ParseFlagsYield, ParseFlagsNone) | IfElse(isAsync, ParseFlagsAwait, ParseFlagsNone);
  let name: GoPtr<Node>;
  if (isGenerator && isAsync) {
    name = doInContext(receiver, NodeFlagsYieldContext | NodeFlagsAwaitContext, true, Parser_parseOptionalBindingIdentifier);
  } else if (isGenerator) {
    name = doInContext(receiver, NodeFlagsYieldContext, true, Parser_parseOptionalBindingIdentifier);
  } else if (isAsync) {
    name = doInContext(receiver, NodeFlagsAwaitContext, true, Parser_parseOptionalBindingIdentifier);
  } else {
    name = Parser_parseOptionalBindingIdentifier(receiver);
  }
  const typeParameters = Parser_parseTypeParameters(receiver);
  const parameters = Parser_parseParameters(receiver, signatureFlags);
  const returnType = Parser_parseReturnType(receiver, KindColonToken, false /*isType*/);
  const body = Parser_parseFunctionBlock(receiver, signatureFlags, undefined /*diagnosticMessage*/);
  receiver!.contextFlags = saveContextFlags;
  const result = NewFunctionExpression(receiver!.factory, modifiers, asteriskToken, name, typeParameters, parameters, returnType, undefined /*fullSignature*/, body);
  Parser_finishNode(receiver, result, pos);
  Parser_withJSDoc(receiver, result, jsdoc);
  Parser_checkJSSyntax(receiver, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseDecoratedExpression","kind":"method","status":"implemented","sigHash":"940ffe4276b51a4de677170a649c1e56049c4f835b2230c2742a078010cd0ef3","bodyHash":"23fa9be98d35441b397c2749f9d8e4a754bcf066658d3fe7082f0323f3ec2ddd"}
 *
 * Go source:
 * func (p *Parser) parseDecoratedExpression() *ast.Expression {
 * 	pos := p.nodePos()
 * 	jsdoc := p.jsdocScannerInfo()
 * 	modifiers := p.parseModifiersEx(true /*allowDecorators* /, false /*permitConstAsModifier* /, false /*stopOnStartOfClassStaticBlock* /)
 * 	if p.token == ast.KindClassKeyword {
 * 		return p.parseClassDeclarationOrExpression(pos, jsdoc, modifiers, ast.KindClassExpression)
 * 	}
 * 	p.parseErrorAt(p.nodePos(), p.nodePos(), diagnostics.Expression_expected)
 * 	return p.finishNode(p.factory.NewMissingDeclaration(modifiers), pos)
 * }
 */
export function Parser_parseDecoratedExpression(receiver: GoPtr<Parser>): GoPtr<Expression> {
  const pos = Parser_nodePos(receiver);
  const jsdoc = Parser_jsdocScannerInfo(receiver);
  const modifiers = Parser_parseModifiersEx(receiver, true /*allowDecorators*/, false /*permitConstAsModifier*/, false /*stopOnStartOfClassStaticBlock*/);
  if (receiver!.token === KindClassKeyword) {
    return Parser_parseClassDeclarationOrExpression(receiver, pos, jsdoc, modifiers, KindClassExpression);
  }
  Parser_parseErrorAt(receiver, Parser_nodePos(receiver), Parser_nodePos(receiver), Expression_expected);
  return Parser_finishNode(receiver, NewMissingDeclaration(receiver!.factory, modifiers), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseNewExpressionOrNewDotTarget","kind":"method","status":"implemented","sigHash":"cf19fdc906111384e494d8077a6d95cbf387dc5154628e10a1b4fd454913f1ef","bodyHash":"cd27eb189c48b09a75d325095394c6fa81b3a7ff71a6b17a1fa07a0d1fed93af"}
 *
 * Go source:
 * func (p *Parser) parseNewExpressionOrNewDotTarget() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindNewKeyword)
 * 	if p.parseOptional(ast.KindDotToken) {
 * 		name := p.parseIdentifierName()
 * 		return p.finishNode(p.factory.NewMetaProperty(ast.KindNewKeyword, name), pos)
 * 	}
 * 	expressionPos := p.nodePos()
 * 	expression := p.parseMemberExpressionRest(expressionPos, p.parsePrimaryExpression(), false /*allowOptionalChain* /)
 * 	var typeArguments *ast.NodeList
 * 	// Absorb type arguments into NewExpression when preceding expression is ExpressionWithTypeArguments
 * 	if expression.Kind == ast.KindExpressionWithTypeArguments {
 * 		typeArguments = expression.TypeArgumentList()
 * 		expression = expression.AsExpressionWithTypeArguments().Expression
 * 	}
 * 	if p.token == ast.KindQuestionDotToken {
 * 		p.parseErrorAtCurrentToken(diagnostics.Invalid_optional_chain_from_new_expression_Did_you_mean_to_call_0, scanner.GetTextOfNodeFromSourceText(p.sourceText, expression, false /*includeTrivia* /))
 * 	}
 * 	var argumentList *ast.NodeList
 * 	if p.token == ast.KindOpenParenToken {
 * 		argumentList = p.parseArgumentList()
 * 	}
 * 	result := p.checkJSSyntax(p.finishNode(p.factory.NewNewExpression(expression, typeArguments, argumentList), pos))
 * 	p.unparseExpressionWithTypeArguments(expression, typeArguments, result)
 * 	return result
 * }
 */
export function Parser_parseNewExpressionOrNewDotTarget(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindNewKeyword);
  if (Parser_parseOptional(receiver, KindDotToken)) {
    const name = Parser_parseIdentifierName(receiver);
    return Parser_finishNode(receiver, NewMetaProperty(receiver!.factory, KindNewKeyword, name), pos);
  }
  const expressionPos = Parser_nodePos(receiver);
  let expression: GoPtr<Expression> = Parser_parseMemberExpressionRest(receiver, expressionPos, Parser_parsePrimaryExpression(receiver), false /*allowOptionalChain*/);
  let typeArguments: GoPtr<NodeList> = undefined;
  // Absorb type arguments into NewExpression when preceding expression is ExpressionWithTypeArguments
  if (expression!.Kind === KindExpressionWithTypeArguments) {
    typeArguments = Node_TypeArgumentList(expression);
    expression = AsExpressionWithTypeArguments(expression)!.Expression;
  }
  if (receiver!.token === KindQuestionDotToken) {
    Parser_parseErrorAtCurrentToken(receiver, Invalid_optional_chain_from_new_expression_Did_you_mean_to_call_0, GetTextOfNodeFromSourceText(receiver!.sourceText, expression, false /*includeTrivia*/));
  }
  let argumentList: GoPtr<NodeList> = undefined;
  if (receiver!.token === KindOpenParenToken) {
    argumentList = Parser_parseArgumentList(receiver);
  }
  const result = Parser_checkJSSyntax(receiver, Parser_finishNode(receiver, NewNewExpression(receiver!.factory, expression, typeArguments, argumentList), pos));
  Parser_unparseExpressionWithTypeArguments(receiver, expression, typeArguments, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseKeywordExpression","kind":"method","status":"implemented","sigHash":"ebb9febe8415dea729c244cad1997385b27c7008b1c03d832b2e222fcc89a350","bodyHash":"c183c6b5e78902fd41d7e84e0e16fcca5178aa903c0393ca89061e7919b4d249"}
 *
 * Go source:
 * func (p *Parser) parseKeywordExpression() *ast.Node {
 * 	pos := p.nodePos()
 * 	result := p.factory.NewKeywordExpression(p.token)
 * 	p.nextToken()
 * 	return p.finishNode(result, pos)
 * }
 */
export function Parser_parseKeywordExpression(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const result = NewKeywordExpression(receiver!.factory, receiver!.token);
  Parser_nextToken(receiver);
  return Parser_finishNode(receiver, result, pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseLiteralExpression","kind":"method","status":"implemented","sigHash":"a7261f57767fd648dff6035c33f6e8e5ffaf2bbd2183eec2fabd4e3da63335b5","bodyHash":"58d4d701331a03ff01b176a43fa4aba537c7d5654957c6277b7a14e12669eb27"}
 *
 * Go source:
 * func (p *Parser) parseLiteralExpression(intern bool) *ast.Node {
 * 	pos := p.nodePos()
 * 	text := p.scanner.TokenValue()
 * 	if intern {
 * 		text = p.internIdentifier(text)
 * 	}
 * 	tokenFlags := p.scanner.TokenFlags()
 * 	var result *ast.Node
 * 	switch p.token {
 * 	case ast.KindStringLiteral:
 * 		result = p.factory.NewStringLiteral(text, tokenFlags)
 * 	case ast.KindNumericLiteral:
 * 		result = p.factory.NewNumericLiteral(text, tokenFlags)
 * 	case ast.KindBigIntLiteral:
 * 		result = p.factory.NewBigIntLiteral(text, tokenFlags)
 * 	case ast.KindRegularExpressionLiteral:
 * 		result = p.factory.NewRegularExpressionLiteral(text, tokenFlags)
 * 	case ast.KindNoSubstitutionTemplateLiteral:
 * 		result = p.factory.NewNoSubstitutionTemplateLiteral(text, tokenFlags)
 * 	default:
 * 		panic("Unhandled case in parseLiteralExpression")
 * 	}
 * 	p.nextToken()
 * 	return p.finishNode(result, pos)
 * }
 */
export function Parser_parseLiteralExpression(receiver: GoPtr<Parser>, intern: bool): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  let text = Scanner_TokenValue(receiver!.scanner);
  if (intern) {
    text = Parser_internIdentifier(receiver, text);
  }
  const tokenFlags = Scanner_TokenFlags(receiver!.scanner);
  let result: GoPtr<Node>;
  switch (receiver!.token) {
    case KindStringLiteral:
      result = NewStringLiteral(receiver!.factory, text, tokenFlags);
      break;
    case KindNumericLiteral:
      result = NewNumericLiteral(receiver!.factory, text, tokenFlags);
      break;
    case KindBigIntLiteral:
      result = NewBigIntLiteral(receiver!.factory, text, tokenFlags);
      break;
    case KindRegularExpressionLiteral:
      result = NewRegularExpressionLiteral(receiver!.factory, text, tokenFlags);
      break;
    case KindNoSubstitutionTemplateLiteral:
      result = NewNoSubstitutionTemplateLiteral(receiver!.factory, text, tokenFlags);
      break;
    default:
      throw new globalThis.Error("Unhandled case in parseLiteralExpression");
  }
  Parser_nextToken(receiver);
  return Parser_finishNode(receiver, result, pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.scanClassMemberStart","kind":"method","status":"implemented","sigHash":"d944f957685e52596d7220301110ea3c0b8b461d8f0e7ba817018d2c4bd2ed2b","bodyHash":"5b8086ca9a12c2a4a3491ba17912ff0d636759077cc2073017c6267ecf93e347"}
 *
 * Go source:
 * func (p *Parser) scanClassMemberStart() bool {
 * 	idToken := ast.KindUnknown
 * 	if p.token == ast.KindAtToken {
 * 		return true
 * 	}
 * 	// Eat up all modifiers, but hold on to the last one in case it is actually an identifier.
 * 	for ast.IsModifierKind(p.token) {
 * 		idToken = p.token
 * 		// If the idToken is a class modifier (protected, private, public, and static), it is
 * 		// certain that we are starting to parse class member. This allows better error recovery
 * 		// Example:
 * 		//      public foo() ...     // true
 * 		//      public @dec blah ... // true; we will then report an error later
 * 		//      export public ...    // true; we will then report an error later
 * 		if ast.IsClassMemberModifier(idToken) {
 * 			return true
 * 		}
 * 		p.nextToken()
 * 	}
 * 	if p.token == ast.KindAsteriskToken {
 * 		return true
 * 	}
 * 	// Try to get the first property-like token following all modifiers.
 * 	// This can either be an identifier or the 'get' or 'set' keywords.
 * 	if p.isLiteralPropertyName() {
 * 		idToken = p.token
 * 		p.nextToken()
 * 	}
 * 	// Index signatures and computed properties are class members; we can parse.
 * 	if p.token == ast.KindOpenBracketToken {
 * 		return true
 * 	}
 * 	// If we were able to get any potential identifier...
 * 	if idToken != ast.KindUnknown {
 * 		// If we have a non-keyword identifier, or if we have an accessor, then it's safe to parse.
 * 		if !ast.IsKeyword(idToken) || idToken == ast.KindSetKeyword || idToken == ast.KindGetKeyword {
 * 			return true
 * 		}
 * 		// If it *is* a keyword, but not an accessor, check a little farther along
 * 		// to see if it should actually be parsed as a class member.
 * 		switch p.token {
 * 		case ast.KindOpenParenToken, // Method declaration
 * 			ast.KindLessThanToken,    // Generic Method declaration
 * 			ast.KindExclamationToken, // Non-null assertion on property name
 * 			ast.KindColonToken,       // Type Annotation for declaration
 * 			ast.KindEqualsToken,      // Initializer for declaration
 * 			ast.KindQuestionToken:    // Not valid, but permitted so that it gets caught later on.
 * 			return true
 * 		}
 * 		// Covers
 * 		//  - Semicolons     (declaration termination)
 * 		//  - Closing braces (end-of-class, must be declaration)
 * 		//  - End-of-files   (not valid, but permitted so that it gets caught later on)
 * 		//  - Line-breaks    (enabling *automatic semicolon insertion*)
 * 		return p.canParseSemicolon()
 * 	}
 * 	return false
 * }
 */
export function Parser_scanClassMemberStart(receiver: GoPtr<Parser>): bool {
  let idToken: Kind = KindUnknown;
  if (receiver!.token === KindAtToken) {
    return true;
  }
  // Eat up all modifiers, but hold on to the last one in case it is actually an identifier.
  while (IsModifierKind(receiver!.token)) {
    idToken = receiver!.token;
    // If the idToken is a class modifier (protected, private, public, and static), it is
    // certain that we are starting to parse class member. This allows better error recovery
    // Example:
    //      public foo() ...     // true
    //      public @dec blah ... // true; we will then report an error later
    //      export public ...    // true; we will then report an error later
    if (IsClassMemberModifier(idToken)) {
      return true;
    }
    Parser_nextToken(receiver);
  }
  if (receiver!.token === KindAsteriskToken) {
    return true;
  }
  // Try to get the first property-like token following all modifiers.
  // This can either be an identifier or the 'get' or 'set' keywords.
  if (Parser_isLiteralPropertyName(receiver)) {
    idToken = receiver!.token;
    Parser_nextToken(receiver);
  }
  // Index signatures and computed properties are class members; we can parse.
  if (receiver!.token === KindOpenBracketToken) {
    return true;
  }
  // If we were able to get any potential identifier...
  if (idToken !== KindUnknown) {
    // If we have a non-keyword identifier, or if we have an accessor, then it's safe to parse.
    if (!IsKeyword(idToken) || idToken === KindSetKeyword || idToken === KindGetKeyword) {
      return true;
    }
    // If it *is* a keyword, but not an accessor, check a little farther along
    // to see if it should actually be parsed as a class member.
    switch (receiver!.token) {
      case KindOpenParenToken: // Method declaration
      case KindLessThanToken: // Generic Method declaration
      case KindExclamationToken: // Non-null assertion on property name
      case KindColonToken: // Type Annotation for declaration
      case KindEqualsToken: // Initializer for declaration
      case KindQuestionToken: // Not valid, but permitted so that it gets caught later on.
        return true;
    }
    // Covers
    //  - Semicolons     (declaration termination)
    //  - Closing braces (end-of-class, must be declaration)
    //  - End-of-files   (not valid, but permitted so that it gets caught later on)
    //  - Line-breaks    (enabling *automatic semicolon insertion*)
    return Parser_canParseSemicolon(receiver);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isLiteralPropertyName","kind":"method","status":"implemented","sigHash":"23427159cf29337a296638076342af937fd497bffab8dc92725ae66989ec04bb","bodyHash":"9d53d231e991d87a1ce4852dc4de514168d1cb90409a26a98a309f4f78605b4b"}
 *
 * Go source:
 * func (p *Parser) isLiteralPropertyName() bool {
 * 	return tokenIsIdentifierOrKeyword(p.token) || p.token == ast.KindStringLiteral || p.token == ast.KindNumericLiteral || p.token == ast.KindBigIntLiteral
 * }
 */
export function Parser_isLiteralPropertyName(receiver: GoPtr<Parser>): bool {
  return tokenIsIdentifierOrKeyword(receiver!.token) || receiver!.token === KindStringLiteral || receiver!.token === KindNumericLiteral || receiver!.token === KindBigIntLiteral;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isStartOfExpression","kind":"method","status":"implemented","sigHash":"97bfc9bf2799be994b2045feb72fa277cf58225e2f4b24944a2db0ef2ff30873","bodyHash":"fee9ce58d2d937fd2f46b1f5f429a5c243e19797b15e36d6436a53897ca30794"}
 *
 * Go source:
 * func (p *Parser) isStartOfExpression() bool {
 * 	if p.isStartOfLeftHandSideExpression() {
 * 		return true
 * 	}
 * 	switch p.token {
 * 	case ast.KindPlusToken, ast.KindMinusToken, ast.KindTildeToken, ast.KindExclamationToken, ast.KindDeleteKeyword,
 * 		ast.KindTypeOfKeyword, ast.KindVoidKeyword, ast.KindPlusPlusToken, ast.KindMinusMinusToken, ast.KindLessThanToken,
 * 		ast.KindAwaitKeyword, ast.KindYieldKeyword, ast.KindPrivateIdentifier, ast.KindAtToken:
 * 		// Yield/await always starts an expression.  Either it is an identifier (in which case
 * 		// it is definitely an expression).  Or it's a keyword (either because we're in
 * 		// a generator or async function, or in strict mode (or both)) and it started a yield or await expression.
 * 		return true
 * 	}
 * 	// Error tolerance.  If we see the start of some binary operator, we consider
 * 	// that the start of an expression.  That way we'll parse out a missing identifier,
 * 	// give a good message about an identifier being missing, and then consume the
 * 	// rest of the binary expression.
 * 	if p.isBinaryOperator() {
 * 		return true
 * 	}
 * 	return p.isIdentifier()
 * }
 */
export function Parser_isStartOfExpression(receiver: GoPtr<Parser>): bool {
  if (Parser_isStartOfLeftHandSideExpression(receiver)) {
    return true;
  }
  switch (receiver!.token) {
    case KindPlusToken:
    case KindMinusToken:
    case KindTildeToken:
    case KindExclamationToken:
    case KindDeleteKeyword:
    case KindTypeOfKeyword:
    case KindVoidKeyword:
    case KindPlusPlusToken:
    case KindMinusMinusToken:
    case KindLessThanToken:
    case KindAwaitKeyword:
    case KindYieldKeyword:
    case KindPrivateIdentifier:
    case KindAtToken:
      // Yield/await always starts an expression.  Either it is an identifier (in which case
      // it is definitely an expression).  Or it's a keyword (either because we're in
      // a generator or async function, or in strict mode (or both)) and it started a yield or await expression.
      return true;
  }
  // Error tolerance.  If we see the start of some binary operator, we consider
  // that the start of an expression.  That way we'll parse out a missing identifier,
  // give a good message about an identifier being missing, and then consume the
  // rest of the binary expression.
  if (Parser_isBinaryOperator(receiver)) {
    return true;
  }
  return Parser_isIdentifier(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isStartOfLeftHandSideExpression","kind":"method","status":"implemented","sigHash":"3c3c7b000f46655d27b5fe135187b05eacce4e280dfb3c60bd6e4ac890726814","bodyHash":"028337a3ab034a283eb96d7cbf0347a4dc4096ada3e4c297ebe663e0125eea09"}
 *
 * Go source:
 * func (p *Parser) isStartOfLeftHandSideExpression() bool {
 * 	switch p.token {
 * 	case ast.KindThisKeyword, ast.KindSuperKeyword, ast.KindNullKeyword, ast.KindTrueKeyword, ast.KindFalseKeyword,
 * 		ast.KindNumericLiteral, ast.KindBigIntLiteral, ast.KindStringLiteral, ast.KindNoSubstitutionTemplateLiteral, ast.KindTemplateHead,
 * 		ast.KindOpenParenToken, ast.KindOpenBracketToken, ast.KindOpenBraceToken, ast.KindFunctionKeyword, ast.KindClassKeyword,
 * 		ast.KindNewKeyword, ast.KindSlashToken, ast.KindSlashEqualsToken, ast.KindIdentifier:
 * 		return true
 * 	case ast.KindImportKeyword:
 * 		return p.isNextTokenOpenParenOrLessThanOrDot()
 * 	}
 * 	return p.isIdentifier()
 * }
 */
export function Parser_isStartOfLeftHandSideExpression(receiver: GoPtr<Parser>): bool {
  switch (receiver!.token) {
    case KindThisKeyword:
    case KindSuperKeyword:
    case KindNullKeyword:
    case KindTrueKeyword:
    case KindFalseKeyword:
    case KindNumericLiteral:
    case KindBigIntLiteral:
    case KindStringLiteral:
    case KindNoSubstitutionTemplateLiteral:
    case KindTemplateHead:
    case KindOpenParenToken:
    case KindOpenBracketToken:
    case KindOpenBraceToken:
    case KindFunctionKeyword:
    case KindClassKeyword:
    case KindNewKeyword:
    case KindSlashToken:
    case KindSlashEqualsToken:
    case KindIdentifier:
      return true;
    case KindImportKeyword:
      return Parser_isNextTokenOpenParenOrLessThanOrDot(receiver);
  }
  return Parser_isIdentifier(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsNumericOrBigIntLiteral","kind":"method","status":"implemented","sigHash":"206bac34f8bd7f329974ca55bfe4ffccf4e5e575d7e18e7e63335e3efc760fba","bodyHash":"3e6f65455d0c2e58cddc8b3d57714fdd5dc9fe43f382878ee8ea8c3efbe496ca"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsNumericOrBigIntLiteral() bool {
 * 	p.nextToken()
 * 	return p.token == ast.KindNumericLiteral || p.token == ast.KindBigIntLiteral
 * }
 */
export function Parser_nextTokenIsNumericOrBigIntLiteral(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  return receiver!.token === KindNumericLiteral || receiver!.token === KindBigIntLiteral;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsIdentifierOrStringLiteralOnSameLine","kind":"method","status":"implemented","sigHash":"8b676f39af41890ef50572f1f75e67d6be68f746ff58137028e5833c5af1634e","bodyHash":"319908f7f992d53450ea356fa2710b36130bba7988bee666df34e175af6da29c"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsIdentifierOrStringLiteralOnSameLine() bool {
 * 	p.nextToken()
 * 	return (p.isIdentifier() || p.token == ast.KindStringLiteral) && !p.hasPrecedingLineBreak()
 * }
 */
export function Parser_nextTokenIsIdentifierOrStringLiteralOnSameLine(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  return (Parser_isIdentifier(receiver) || receiver!.token === KindStringLiteral) && !Parser_hasPrecedingLineBreak(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isBinaryOperator","kind":"method","status":"implemented","sigHash":"0e9cfe53c2199e76e7a44d99fa4ea621bbafbe8fd068f8f0e361461d4dd429ae","bodyHash":"148786d83bd91b4ba9238c6212ce3c79c4d3bcc66ea29ce180facb39e73d23f7"}
 *
 * Go source:
 * func (p *Parser) isBinaryOperator() bool {
 * 	if p.inDisallowInContext() && p.token == ast.KindInKeyword {
 * 		return false
 * 	}
 * 	return ast.GetBinaryOperatorPrecedence(p.token) != ast.OperatorPrecedenceInvalid
 * }
 */
export function Parser_isBinaryOperator(receiver: GoPtr<Parser>): bool {
  if (Parser_inDisallowInContext(receiver) && receiver!.token === KindInKeyword) {
    return false;
  }
  return GetBinaryOperatorPrecedence(receiver!.token) !== OperatorPrecedenceInvalid;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextIsStartOfExpression","kind":"method","status":"implemented","sigHash":"4b5fdbc2587cbce4a63d2a62a7c9faae6f75a270f2bbd2bda201d880c306be47","bodyHash":"0bea022f203ecb9846397e0f804c9553cb2cd2b47c16a357fbd924c77f4130cf"}
 *
 * Go source:
 * func (p *Parser) nextIsStartOfExpression() bool {
 * 	p.nextToken()
 * 	return p.isStartOfExpression()
 * }
 */
export function Parser_nextIsStartOfExpression(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  return Parser_isStartOfExpression(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isAwaitUsingDeclaration","kind":"method","status":"implemented","sigHash":"ebd800e662b67dd57c364d3b177a97e47718cbad9a903f53ec595389041367b9","bodyHash":"072bca723c3e150e7ee8bddb4550bbea24f7fb9b5a295f5f07c3107a07046c3e"}
 *
 * Go source:
 * func (p *Parser) isAwaitUsingDeclaration() bool {
 * 	return p.lookAhead((*Parser).nextIsUsingKeywordThenBindingIdentifierOrStartOfObjectDestructuringOnSameLine)
 * }
 */
export function Parser_isAwaitUsingDeclaration(receiver: GoPtr<Parser>): bool {
  return Parser_lookAhead(receiver, Parser_nextIsUsingKeywordThenBindingIdentifierOrStartOfObjectDestructuringOnSameLine);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextIsUsingKeywordThenBindingIdentifierOrStartOfObjectDestructuringOnSameLine","kind":"method","status":"implemented","sigHash":"914d397d54d5770d35ca6754a95e2058650a6c32e61b4988f5fbbf74f0ac06f5","bodyHash":"2a4d56c7bb1a6d3e668d562036da4bccebe832f2fa9e924bde30787beb5599b6"}
 *
 * Go source:
 * func (p *Parser) nextIsUsingKeywordThenBindingIdentifierOrStartOfObjectDestructuringOnSameLine() bool {
 * 	return p.nextToken() == ast.KindUsingKeyword && p.nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLine( /*disallowOf* / false)
 * }
 */
export function Parser_nextIsUsingKeywordThenBindingIdentifierOrStartOfObjectDestructuringOnSameLine(receiver: GoPtr<Parser>): bool {
  return Parser_nextToken(receiver) === KindUsingKeyword && Parser_nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLine(receiver, false /*disallowOf*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsTokenStringLiteral","kind":"method","status":"implemented","sigHash":"00f09dc5be15976ce65681d126fb943bf5efc9d9801f7d7dae98b7bbc3c69ac4","bodyHash":"13f882f3a41d2d142ec38627183f528e16214e7bc0964f291380cd58f8e872fb"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsTokenStringLiteral() bool {
 * 	return p.nextToken() == ast.KindStringLiteral
 * }
 */
export function Parser_nextTokenIsTokenStringLiteral(receiver: GoPtr<Parser>): bool {
  return Parser_nextToken(receiver) === KindStringLiteral;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.inYieldContext","kind":"method","status":"implemented","sigHash":"a685ea072c1316081b8d4f0ee61691490e35352ceb8e9551e4b2462fa092bc9c","bodyHash":"ce52f0a8e97a65ab3d2982bdfb80559ba5f1cf6677f2180541c5d428370af08f"}
 *
 * Go source:
 * func (p *Parser) inYieldContext() bool {
 * 	return p.contextFlags&ast.NodeFlagsYieldContext != 0
 * }
 */
export function Parser_inYieldContext(receiver: GoPtr<Parser>): bool {
  return (receiver!.contextFlags & NodeFlagsYieldContext) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.inAwaitContext","kind":"method","status":"implemented","sigHash":"8166f8b13e3f1fe2a989e141b7853d283cc4b38db29bea898d5753cddf0f5078","bodyHash":"9428c1ff1d22c2af5f3e61f54158e87e888b877d7794e70e9fd01692d76b4cb2"}
 *
 * Go source:
 * func (p *Parser) inAwaitContext() bool {
 * 	return p.contextFlags&ast.NodeFlagsAwaitContext != 0
 * }
 */
export function Parser_inAwaitContext(receiver: GoPtr<Parser>): bool {
  return (receiver!.contextFlags & NodeFlagsAwaitContext) !== 0;
}
