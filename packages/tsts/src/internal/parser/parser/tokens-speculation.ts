import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import { NewDiagnostic } from "../../ast/diagnostic.js";
import { Diagnostic_AddRelatedInfo } from "../../ast/diagnostic.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import type { Kind } from "../../ast/generated/kinds.js";
import {
  KindAbstractKeyword,
  KindAsyncKeyword,
  KindAtToken,
  KindAwaitKeyword,
  KindClassKeyword,
  KindCloseParenToken,
  KindColonToken,
  KindConstKeyword,
  KindDefaultKeyword,
  KindEnumKeyword,
  KindEqualsToken,
  KindExportKeyword,
  KindFromKeyword,
  KindFunctionKeyword,
  KindGetKeyword,
  KindIdentifier,
  KindInterfaceKeyword,
  KindLastReservedWord,
  KindLessThanToken,
  KindOfKeyword,
  KindOpenBraceToken,
  KindOpenBracketToken,
  KindOpenParenToken,
  KindPrivateIdentifier,
  KindQuestionToken,
  KindSemicolonToken,
  KindSetKeyword,
  KindSlashToken,
  KindStaticKeyword,
  KindTypeKeyword,
  KindYieldKeyword,
} from "../../ast/generated/kinds.js";
import { NewIdentifier, NewPrivateIdentifier, NewToken } from "../../ast/generated/factory.js";
import { IsModifierKind } from "../../ast/generated/predicates.js";
import type { NodeFlags } from "../../ast/generated/flags.js";
import { NodeFlagsDecoratorContext, NodeFlagsDisallowInContext } from "../../ast/generated/flags.js";
import type { TextRange } from "../../core/text.js";
import { NewTextRange, TextRange_End, TextRange_Pos } from "../../core/text.js";
import * as debug from "../../debug/debug.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import {
  An_enum_member_name_must_be_followed_by_a_or,
  Array_element_destructuring_pattern_expected,
  Argument_expression_expected,
  Declaration_or_statement_expected,
  Enum_member_expected,
  Expression_expected,
  Expression_or_comma_expected,
  Identifier_expected,
  Identifier_or_string_literal_expected,
  Keywords_cannot_contain_escape_characters,
  Parameter_declaration_expected,
  Property_assignment_expected,
  Property_destructuring_pattern_expected,
  Property_or_signature_expected,
  Statement_expected,
  The_parser_expected_to_find_a_1_to_match_the_0_token_here,
  Type_argument_expected,
  Type_expected,
  Type_parameter_declaration_expected,
  Unexpected_token_A_constructor_method_accessor_or_property_was_expected,
  Unexpected_token_expected,
  Unicode_escape_sequence_cannot_appear_here,
  Variable_declaration_expected,
  X_0_expected,
  X_0_is_not_allowed_as_a_parameter_name,
  X_0_is_not_allowed_as_a_variable_declaration_name,
  X_case_or_default_expected,
} from "../../diagnostics/generated/messages.js";
import { SkipTrivia, Scanner_HasExtendedUnicodeEscape, Scanner_HasPrecedingJSDocComment, Scanner_HasPrecedingJSDocWithDeprecatedTag, Scanner_HasPrecedingJSDocWithSeeOrLink, Scanner_HasUnicodeEscape, Scanner_ReScanGreaterThanToken, Scanner_ReScanLessThanToken, Scanner_ReScanSlashToken, Scanner_Scan, Scanner_TokenRange, Scanner_TokenValue, TokenToString } from "../../scanner/scanner.js";
import { IsKeyword } from "../../ast/utilities.js";
import { Parser_parseErrorAtRange } from "./errors-recovery.js";
import { tokenIsIdentifierOrKeyword, tokenIsIdentifierOrKeywordOrGreaterThan } from "../utilities.js";
import { Parser_canFollowExportModifier, Parser_createIdentifierWithDiagnostic, Parser_hasPrecedingLineBreak, Parser_nextTokenCanFollowExportModifier, Parser_nextTokenIsClassKeywordOnSameLine, Parser_nextTokenIsFunctionKeywordOnSameLine, Parser_parseBindingIdentifierWithDiagnostic, Parser_parseExpectedWithDiagnostic, Parser_parseIdentifierNameWithDiagnostic, Parser_parseIdentifierOrPatternWithDiagnostic, Parser_parseIdentifierWithDiagnostic } from "./statements-declarations.js";
import { Parser_inAwaitContext, Parser_inYieldContext, Parser_isLiteralPropertyName } from "./expressions.js";
import { Parser_isListElement, Parser_isListTerminator } from "./lists.js";
import { Parser_canFollowModifier, Parser_canParseSemicolon, Parser_finishNode, Parser_lookAhead, Parser_mark, Parser_nodePos, Parser_rewind } from "./support.js";
import {
  jsdocScannerInfoHasDeprecated,
  jsdocScannerInfoHasJSDoc,
  jsdocScannerInfoHasSeeOrLink,
  PCArgumentExpressions,
  PCArrayBindingElements,
  PCArrayLiteralMembers,
  PCBlockStatements,
  PCClassMembers,
  PCCount,
  PCEnumMembers,
  PCHeritageClauseElement,
  PCHeritageClauses,
  PCImportAttributes,
  PCImportOrExportSpecifiers,
  PCJSDocComment,
  PCJSDocParameters,
  PCJsxAttributes,
  PCJsxChildren,
  PCObjectBindingElements,
  PCObjectLiteralMembers,
  PCParameters,
  PCRestProperties,
  PCSourceElements,
  PCSwitchClauseStatements,
  PCSwitchClauses,
  PCTupleElementTypes,
  PCTypeArguments,
  PCTypeMembers,
  PCTypeParameters,
  PCVariableDeclarations,
  type jsdocScannerInfo as jsdocScannerInfo_b29c74de,
  type Parser,
  type ParsingContext,
} from "./state.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseErrorAtCurrentToken","kind":"method","status":"implemented","sigHash":"f2d34a403aacf239cc93f5ba8717d403b65a24ca42165837cd603e415203fbfc","bodyHash":"1f1d8bbdea0e03d20124fa1ae618f929ae4c699bff82b051cfbf09ca2df14d19"}
 *
 * Go source:
 * func (p *Parser) parseErrorAtCurrentToken(message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 	return p.parseErrorAtRange(p.scanner.TokenRange(), message, args...)
 * }
 */
export function Parser_parseErrorAtCurrentToken(receiver: GoPtr<Parser>, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic> {
  return Parser_parseErrorAtRange(receiver, Scanner_TokenRange(receiver!.scanner), message, ...args);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextToken","kind":"method","status":"implemented","sigHash":"9e2af53e708c081864e5829d09b2b1b6883882c906273996807250b604ac0b9c","bodyHash":"79d8e3e6b839bc6cbf1abd73b91ddca52144ca95d645d81fc6dfdbe733f445ae"}
 *
 * Go source:
 * func (p *Parser) nextToken() ast.Kind {
 * 	// if the keyword had an escape
 * 	if ast.IsKeyword(p.token) && (p.scanner.HasUnicodeEscape() || p.scanner.HasExtendedUnicodeEscape()) {
 * 		// issue a parse error for the escape
 * 		p.parseErrorAtCurrentToken(diagnostics.Keywords_cannot_contain_escape_characters)
 * 	}
 * 	p.token = p.scanner.Scan()
 * 	return p.token
 * }
 */
export function Parser_nextToken(receiver: GoPtr<Parser>): Kind {
  // if the keyword had an escape
  if (IsKeyword(receiver!.token) && (Scanner_HasUnicodeEscape(receiver!.scanner) || Scanner_HasExtendedUnicodeEscape(receiver!.scanner))) {
    // issue a parse error for the escape
    Parser_parseErrorAtCurrentToken(receiver, Keywords_cannot_contain_escape_characters);
  }
  receiver!.token = Scanner_Scan(receiver!.scanner);
  return receiver!.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.jsdocScannerInfo","kind":"method","status":"implemented","sigHash":"50836bd335d2c12cda6322e811529a87399104d5f7ce20482846d0e45e197a29","bodyHash":"4f88976c9146dd66d5a34b22003a287c3082b3f325146625a21aa1b996031698"}
 *
 * Go source:
 * func (p *Parser) jsdocScannerInfo() jsdocScannerInfo {
 * 	if !p.scanner.HasPrecedingJSDocComment() {
 * 		return 0
 * 	}
 * 	info := jsdocScannerInfoHasJSDoc
 * 	if p.scanner.HasPrecedingJSDocWithDeprecatedTag() {
 * 		info |= jsdocScannerInfoHasDeprecated
 * 	}
 * 	if p.scanner.HasPrecedingJSDocWithSeeOrLink() {
 * 		info |= jsdocScannerInfoHasSeeOrLink
 * 	}
 * 	return info
 * }
 */
export function Parser_jsdocScannerInfo(receiver: GoPtr<Parser>): jsdocScannerInfo_b29c74de {
  if (!Scanner_HasPrecedingJSDocComment(receiver!.scanner)) {
    return 0 as jsdocScannerInfo_b29c74de;
  }
  const info0 = jsdocScannerInfoHasJSDoc;
  const info1 = Scanner_HasPrecedingJSDocWithDeprecatedTag(receiver!.scanner) ? ((info0 | jsdocScannerInfoHasDeprecated) as jsdocScannerInfo_b29c74de) : info0;
  const info2 = Scanner_HasPrecedingJSDocWithSeeOrLink(receiver!.scanner) ? ((info1 | jsdocScannerInfoHasSeeOrLink) as jsdocScannerInfo_b29c74de) : info1;
  return info2;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isInSomeParsingContext","kind":"method","status":"implemented","sigHash":"fd09aa97dc96ad769acc8437d53fcd4895e54b1760faea9d70d2c0e483c4fb4d","bodyHash":"8e3cbd489aff643f8ec3d76e2d08d3db25bd8d9ae26932954a1ba0aeff2b9ba7"}
 *
 * Go source:
 * func (p *Parser) isInSomeParsingContext() bool {
 * 	// We should be in at least one parsing context, be it SourceElements while parsing
 * 	// a SourceFile, or JSDocComment when lazily parsing JSDoc.
 * 	debug.Assert(p.parsingContexts != 0, "Missing parsing context")
 * 	for kind := range PCCount {
 * 		if p.parsingContexts&(1<<kind) != 0 {
 * 			if p.isListElement(kind, true /*inErrorRecovery* /) || p.isListTerminator(kind) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Parser_isInSomeParsingContext(receiver: GoPtr<Parser>): bool {
  // We should be in at least one parsing context, be it SourceElements while parsing
  // a SourceFile, or JSDocComment when lazily parsing JSDoc.
  debug.Assert((receiver!.parsingContexts !== 0) as bool, "Missing parsing context");
  for (let kind = 0; kind < PCCount; kind++) {
    if ((receiver!.parsingContexts & (1 << kind)) !== 0) {
      if (Parser_isListElement(receiver, kind as ParsingContext, true as bool) || Parser_isListTerminator(receiver, kind as ParsingContext)) {
        return true as bool;
      }
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parsingContextErrors","kind":"method","status":"implemented","sigHash":"64c14fb89f6466ef6610038c9dd472361e7d23939c5331b4c52829623f3ee7f7","bodyHash":"1ecf55bb5758b6113ac1f8dacd2396292c39b4e77f89985bc2a16c83d588ed9d"}
 *
 * Go source:
 * func (p *Parser) parsingContextErrors(context ParsingContext) {
 * 	switch context {
 * 	case PCSourceElements:
 * 		if p.token == ast.KindDefaultKeyword {
 * 			p.parseErrorAtCurrentToken(diagnostics.X_0_expected, "export")
 * 		} else {
 * 			p.parseErrorAtCurrentToken(diagnostics.Declaration_or_statement_expected)
 * 		}
 * 	case PCBlockStatements:
 * 		p.parseErrorAtCurrentToken(diagnostics.Declaration_or_statement_expected)
 * 	case PCSwitchClauses:
 * 		p.parseErrorAtCurrentToken(diagnostics.X_case_or_default_expected)
 * 	case PCSwitchClauseStatements:
 * 		p.parseErrorAtCurrentToken(diagnostics.Statement_expected)
 * 	case PCRestProperties, PCTypeMembers:
 * 		p.parseErrorAtCurrentToken(diagnostics.Property_or_signature_expected)
 * 	case PCClassMembers:
 * 		p.parseErrorAtCurrentToken(diagnostics.Unexpected_token_A_constructor_method_accessor_or_property_was_expected)
 * 	case PCEnumMembers:
 * 		p.parseErrorAtCurrentToken(diagnostics.Enum_member_expected)
 * 	case PCHeritageClauseElement:
 * 		p.parseErrorAtCurrentToken(diagnostics.Expression_expected)
 * 	case PCVariableDeclarations:
 * 		if ast.IsKeyword(p.token) {
 * 			p.parseErrorAtCurrentToken(diagnostics.X_0_is_not_allowed_as_a_variable_declaration_name, scanner.TokenToString(p.token))
 * 		} else {
 * 			p.parseErrorAtCurrentToken(diagnostics.Variable_declaration_expected)
 * 		}
 * 	case PCObjectBindingElements:
 * 		p.parseErrorAtCurrentToken(diagnostics.Property_destructuring_pattern_expected)
 * 	case PCArrayBindingElements:
 * 		p.parseErrorAtCurrentToken(diagnostics.Array_element_destructuring_pattern_expected)
 * 	case PCArgumentExpressions:
 * 		p.parseErrorAtCurrentToken(diagnostics.Argument_expression_expected)
 * 	case PCObjectLiteralMembers:
 * 		p.parseErrorAtCurrentToken(diagnostics.Property_assignment_expected)
 * 	case PCArrayLiteralMembers:
 * 		p.parseErrorAtCurrentToken(diagnostics.Expression_or_comma_expected)
 * 	case PCJSDocParameters:
 * 		p.parseErrorAtCurrentToken(diagnostics.Parameter_declaration_expected)
 * 	case PCParameters:
 * 		if ast.IsKeyword(p.token) {
 * 			p.parseErrorAtCurrentToken(diagnostics.X_0_is_not_allowed_as_a_parameter_name, scanner.TokenToString(p.token))
 * 		} else {
 * 			p.parseErrorAtCurrentToken(diagnostics.Parameter_declaration_expected)
 * 		}
 * 	case PCTypeParameters:
 * 		p.parseErrorAtCurrentToken(diagnostics.Type_parameter_declaration_expected)
 * 	case PCTypeArguments:
 * 		p.parseErrorAtCurrentToken(diagnostics.Type_argument_expected)
 * 	case PCTupleElementTypes:
 * 		p.parseErrorAtCurrentToken(diagnostics.Type_expected)
 * 	case PCHeritageClauses:
 * 		p.parseErrorAtCurrentToken(diagnostics.Unexpected_token_expected)
 * 	case PCImportOrExportSpecifiers:
 * 		if p.token == ast.KindFromKeyword {
 * 			p.parseErrorAtCurrentToken(diagnostics.X_0_expected, "}")
 * 		} else {
 * 			p.parseErrorAtCurrentToken(diagnostics.Identifier_expected)
 * 		}
 * 	case PCJsxAttributes, PCJsxChildren, PCJSDocComment:
 * 		p.parseErrorAtCurrentToken(diagnostics.Identifier_expected)
 * 	case PCImportAttributes:
 * 		p.parseErrorAtCurrentToken(diagnostics.Identifier_or_string_literal_expected)
 * 	default:
 * 		panic("Unhandled case in parsingContextErrors")
 * 	}
 * }
 */
export function Parser_parsingContextErrors(receiver: GoPtr<Parser>, context: ParsingContext): void {
  switch (context) {
    case PCSourceElements:
      if (receiver!.token === KindDefaultKeyword) {
        Parser_parseErrorAtCurrentToken(receiver, X_0_expected, "export");
      } else {
        Parser_parseErrorAtCurrentToken(receiver, Declaration_or_statement_expected);
      }
      return;
    case PCBlockStatements:
      Parser_parseErrorAtCurrentToken(receiver, Declaration_or_statement_expected);
      return;
    case PCSwitchClauses:
      Parser_parseErrorAtCurrentToken(receiver, X_case_or_default_expected);
      return;
    case PCSwitchClauseStatements:
      Parser_parseErrorAtCurrentToken(receiver, Statement_expected);
      return;
    case PCRestProperties:
    case PCTypeMembers:
      Parser_parseErrorAtCurrentToken(receiver, Property_or_signature_expected);
      return;
    case PCClassMembers:
      Parser_parseErrorAtCurrentToken(receiver, Unexpected_token_A_constructor_method_accessor_or_property_was_expected);
      return;
    case PCEnumMembers:
      Parser_parseErrorAtCurrentToken(receiver, Enum_member_expected);
      return;
    case PCHeritageClauseElement:
      Parser_parseErrorAtCurrentToken(receiver, Expression_expected);
      return;
    case PCVariableDeclarations:
      if (IsKeyword(receiver!.token)) {
        Parser_parseErrorAtCurrentToken(receiver, X_0_is_not_allowed_as_a_variable_declaration_name, TokenToString(receiver!.token));
      } else {
        Parser_parseErrorAtCurrentToken(receiver, Variable_declaration_expected);
      }
      return;
    case PCObjectBindingElements:
      Parser_parseErrorAtCurrentToken(receiver, Property_destructuring_pattern_expected);
      return;
    case PCArrayBindingElements:
      Parser_parseErrorAtCurrentToken(receiver, Array_element_destructuring_pattern_expected);
      return;
    case PCArgumentExpressions:
      Parser_parseErrorAtCurrentToken(receiver, Argument_expression_expected);
      return;
    case PCObjectLiteralMembers:
      Parser_parseErrorAtCurrentToken(receiver, Property_assignment_expected);
      return;
    case PCArrayLiteralMembers:
      Parser_parseErrorAtCurrentToken(receiver, Expression_or_comma_expected);
      return;
    case PCJSDocParameters:
      Parser_parseErrorAtCurrentToken(receiver, Parameter_declaration_expected);
      return;
    case PCParameters:
      if (IsKeyword(receiver!.token)) {
        Parser_parseErrorAtCurrentToken(receiver, X_0_is_not_allowed_as_a_parameter_name, TokenToString(receiver!.token));
      } else {
        Parser_parseErrorAtCurrentToken(receiver, Parameter_declaration_expected);
      }
      return;
    case PCTypeParameters:
      Parser_parseErrorAtCurrentToken(receiver, Type_parameter_declaration_expected);
      return;
    case PCTypeArguments:
      Parser_parseErrorAtCurrentToken(receiver, Type_argument_expected);
      return;
    case PCTupleElementTypes:
      Parser_parseErrorAtCurrentToken(receiver, Type_expected);
      return;
    case PCHeritageClauses:
      Parser_parseErrorAtCurrentToken(receiver, Unexpected_token_expected);
      return;
    case PCImportOrExportSpecifiers:
      if (receiver!.token === KindFromKeyword) {
        Parser_parseErrorAtCurrentToken(receiver, X_0_expected, "}");
      } else {
        Parser_parseErrorAtCurrentToken(receiver, Identifier_expected);
      }
      return;
    case PCJsxAttributes:
    case PCJsxChildren:
    case PCJSDocComment:
      Parser_parseErrorAtCurrentToken(receiver, Identifier_expected);
      return;
    case PCImportAttributes:
      Parser_parseErrorAtCurrentToken(receiver, Identifier_or_string_literal_expected);
      return;
    default:
      throw new globalThis.Error("Unhandled case in parsingContextErrors");
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExpectedMatchingBrackets","kind":"method","status":"implemented","sigHash":"7339632e738cb9481fce26edc278572381116edb0a8b2107b7268e213f35e30c","bodyHash":"a67ebfc20e7a921d31542a3d3c04bd8a5335915e915d50a21f37587a160c4867"}
 *
 * Go source:
 * func (p *Parser) parseExpectedMatchingBrackets(openKind ast.Kind, closeKind ast.Kind, openParsed bool, openPosition int) {
 * 	if p.token == closeKind {
 * 		p.nextToken()
 * 		return
 * 	}
 * 	lastError := p.parseErrorAtCurrentToken(diagnostics.X_0_expected, scanner.TokenToString(closeKind))
 * 	if !openParsed {
 * 		return
 * 	}
 * 	if lastError != nil {
 * 		related := ast.NewDiagnostic(nil, core.NewTextRange(openPosition, openPosition), diagnostics.The_parser_expected_to_find_a_1_to_match_the_0_token_here, scanner.TokenToString(openKind), scanner.TokenToString(closeKind))
 * 		lastError.AddRelatedInfo(related)
 * 	}
 * }
 */
export function Parser_parseExpectedMatchingBrackets(receiver: GoPtr<Parser>, openKind: Kind, closeKind: Kind, openParsed: bool, openPosition: int): void {
  if (receiver!.token === closeKind) {
    Parser_nextToken(receiver);
    return;
  }
  const lastError = Parser_parseErrorAtCurrentToken(receiver, X_0_expected, TokenToString(closeKind));
  if (!openParsed) {
    return;
  }
  if (lastError !== undefined) {
    const related = NewDiagnostic(undefined, NewTextRange(openPosition, openPosition), The_parser_expected_to_find_a_1_to_match_the_0_token_here, TokenToString(openKind), TokenToString(closeKind));
    Diagnostic_AddRelatedInfo(lastError, related);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExpected","kind":"method","status":"implemented","sigHash":"f078c8c8c4a3ffb82b527e68ad474987812178b1bf110ebde36b9d7c5470af93","bodyHash":"f19c6da3525a600878983a3a5b20e340d3a77b7931c3e1cb4ced469467e0dd13"}
 *
 * Go source:
 * func (p *Parser) parseExpected(kind ast.Kind) bool {
 * 	return p.parseExpectedWithDiagnostic(kind, nil, true)
 * }
 */
export function Parser_parseExpected(receiver: GoPtr<Parser>, kind: Kind): bool {
  return Parser_parseExpectedWithDiagnostic(receiver, kind, undefined, true as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseTokenNode","kind":"method","status":"implemented","sigHash":"5121da5b0cc0c25b5680d754a2439ffd16ab39f224f55455a7bbc8a59494f26a","bodyHash":"4face622ffa723883584eac4cc5314c79a672f0ee9ef65c307afeb9c06c3b1aa"}
 *
 * Go source:
 * func (p *Parser) parseTokenNode() *ast.Node {
 * 	pos := p.nodePos()
 * 	kind := p.token
 * 	p.nextToken()
 * 	return p.finishNode(p.factory.NewToken(kind), pos)
 * }
 */
export function Parser_parseTokenNode(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const kind = receiver!.token;
  Parser_nextToken(receiver);
  return Parser_finishNode(receiver, NewToken(receiver!.factory, kind), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExpectedToken","kind":"method","status":"implemented","sigHash":"e4138a8a8cbc0b6a147c3df84acb706317162d9a3cb583ef276b0124e5476e12","bodyHash":"3b10775fc7cb22ba82b2fc5f07b35172f1396f5bfecc952670c3cd74eff6c3f7"}
 *
 * Go source:
 * func (p *Parser) parseExpectedToken(kind ast.Kind) *ast.Node {
 * 	token := p.parseOptionalToken(kind)
 * 	if token == nil {
 * 		p.parseErrorAtCurrentToken(diagnostics.X_0_expected, scanner.TokenToString(kind))
 * 		token = p.finishNode(p.factory.NewToken(kind), p.nodePos())
 * 	}
 * 	return token
 * }
 */
export function Parser_parseExpectedToken(receiver: GoPtr<Parser>, kind: Kind): GoPtr<Node> {
  const token0 = Parser_parseOptionalToken(receiver, kind);
  if (token0 === undefined) {
    Parser_parseErrorAtCurrentToken(receiver, X_0_expected, TokenToString(kind));
    const token1 = Parser_finishNode(receiver, NewToken(receiver!.factory, kind), Parser_nodePos(receiver));
    return token1;
  }
  return token0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseOptionalToken","kind":"method","status":"implemented","sigHash":"2427d9c3f6bfec0f1a08f8d1a9fc1bed09354470539830e3e3bac86737d4b241","bodyHash":"b87908445b48420fc04fc2bbaaebe79abfec6c5059cbfcf87815f2f1ef375b84"}
 *
 * Go source:
 * func (p *Parser) parseOptionalToken(kind ast.Kind) *ast.Node {
 * 	if p.token == kind {
 * 		return p.parseTokenNode()
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseOptionalToken(receiver: GoPtr<Parser>, kind: Kind): GoPtr<Node> {
  if (receiver!.token === kind) {
    return Parser_parseTokenNode(receiver);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsBindingIdentifierOrStartOfDestructuring","kind":"method","status":"implemented","sigHash":"e70df6551329bbcb4e075e3eea1cbb979b0d602b2f6c51f928bf68f09b2705b5","bodyHash":"bd81a7886a64c98c09a2fe6f09e1983d58ee8c57d70df18563ee117fd3809441"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsBindingIdentifierOrStartOfDestructuring() bool {
 * 	p.nextToken()
 * 	return p.isBindingIdentifier() || p.token == ast.KindOpenBraceToken || p.token == ast.KindOpenBracketToken
 * }
 */
export function Parser_nextTokenIsBindingIdentifierOrStartOfDestructuring(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  return (Parser_isBindingIdentifier(receiver) || receiver!.token === KindOpenBraceToken || receiver!.token === KindOpenBracketToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseIdentifierUnlessAtSemicolon","kind":"method","status":"implemented","sigHash":"ea82d0544d79bb901d0bd86aab80ed263a095d1ce45153f7082aac5a0747c820","bodyHash":"7eae80e3d22f56d8a604e70d1bac6db88e00c1fde22bf394087b4dc7608695f9"}
 *
 * Go source:
 * func (p *Parser) parseIdentifierUnlessAtSemicolon() *ast.Node {
 * 	if !p.canParseSemicolon() {
 * 		return p.parseIdentifier()
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseIdentifierUnlessAtSemicolon(receiver: GoPtr<Parser>): GoPtr<Node> {
  if (!Parser_canParseSemicolon(receiver)) {
    return Parser_parseIdentifier(receiver);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextIsIdentifierAndCloseParen","kind":"method","status":"implemented","sigHash":"e0ea5c5751b1d8ab76c032f4c03235a32673672ca3c6c7aedf3f2d12ff4542dc","bodyHash":"314b678a8f25b9d3a7a6d3a4c1af94a219684947c3fe3babf7e1bf52df5b98a9"}
 *
 * Go source:
 * func (p *Parser) nextIsIdentifierAndCloseParen() bool {
 * 	return p.nextTokenIsIdentifier() && p.nextToken() == ast.KindCloseParenToken
 * }
 */
export function Parser_nextIsIdentifierAndCloseParen(receiver: GoPtr<Parser>): bool {
  return (Parser_nextTokenIsIdentifier(receiver) && Parser_nextToken(receiver) === KindCloseParenToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsIdentifier","kind":"method","status":"implemented","sigHash":"27b17f40014290969c38cefab0a685eee7f7ebbf5010e5513599d7711563d23f","bodyHash":"9cb9b3c4045f44115a902529c03c3832749b5ec996f661d5a4d4a1252677dd4b"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsIdentifier() bool {
 * 	p.nextToken()
 * 	return p.isIdentifier()
 * }
 */
export function Parser_nextTokenIsIdentifier(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  return Parser_isIdentifier(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseIdentifierOrPattern","kind":"method","status":"implemented","sigHash":"e90a421c800c7c18b25d8cc2455a0b013cfd4290e8172191b723196db260ba1f","bodyHash":"d31bc2edb03ea1f88a98e033b7390f0c1a4eeeedef4c2eecd9dbb8bb6f6b85f5"}
 *
 * Go source:
 * func (p *Parser) parseIdentifierOrPattern() *ast.Node {
 * 	return p.parseIdentifierOrPatternWithDiagnostic(nil)
 * }
 */
export function Parser_parseIdentifierOrPattern(receiver: GoPtr<Parser>): GoPtr<Node> {
  return Parser_parseIdentifierOrPatternWithDiagnostic(receiver, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsOpenParen","kind":"method","status":"implemented","sigHash":"134cfe8e14efe324e04fd6d02f3b73b775d35f7179938b19475cdccb89dda4d3","bodyHash":"e8a78926ad40f8e0200fce6b47b628c01f363d6232b40dd2badfa7881f6c3799"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsOpenParen() bool {
 * 	return p.nextToken() == ast.KindOpenParenToken
 * }
 */
export function Parser_nextTokenIsOpenParen(receiver: GoPtr<Parser>): bool {
  return (Parser_nextToken(receiver) === KindOpenParenToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsFromKeywordOrEqualsToken","kind":"method","status":"implemented","sigHash":"e2940bf026b0242634f50830b9c70f8535cdd0d90b227a83d98c2651ac33e885","bodyHash":"be88ced1d447dd715cf8717214e994ccaf90f0d8d2a71fd7cdc0400f01dcfa08"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsFromKeywordOrEqualsToken() bool {
 * 	p.nextToken()
 * 	return p.token == ast.KindFromKeyword || p.token == ast.KindEqualsToken
 * }
 */
export function Parser_nextTokenIsFromKeywordOrEqualsToken(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  return (receiver!.token === KindFromKeyword || receiver!.token === KindEqualsToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.newIdentifier","kind":"method","status":"implemented","sigHash":"da600fdefed78f377aa94207a1ce157ef607b24c50d08ee3e512bf05379161aa","bodyHash":"3f625cfd7d092fa01f5b5f23fb2951543f385d5198db75a5a327d937202f3a37"}
 *
 * Go source:
 * func (p *Parser) newIdentifier(text string) *ast.Node {
 * 	p.identifierCount++
 * 	id := p.factory.NewIdentifier(text)
 * 	if text == "await" {
 * 		p.statementHasAwaitIdentifier = true
 * 	}
 * 	return id
 * }
 */
export function Parser_newIdentifier(receiver: GoPtr<Parser>, text: string): GoPtr<Node> {
  receiver!.identifierCount = (receiver!.identifierCount + 1) as int;
  const id = NewIdentifier(receiver!.factory, text);
  if (text === "await") {
    receiver!.statementHasAwaitIdentifier = true as bool;
  }
  return id;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.createMissingIdentifier","kind":"method","status":"implemented","sigHash":"802fb6be1ae4fef3a6de93d72ccbd18c1f0e9235ee4ddf04f7c33bcd49bd7f54","bodyHash":"3454d8f24e2d8efb294514107b70146dae28410c2db27822cd7d5b4e1e955e1b"}
 *
 * Go source:
 * func (p *Parser) createMissingIdentifier() *ast.Node {
 * 	return p.finishNode(p.newIdentifier(""), p.nodePos())
 * }
 */
export function Parser_createMissingIdentifier(receiver: GoPtr<Parser>): GoPtr<Node> {
  return Parser_finishNode(receiver, Parser_newIdentifier(receiver, ""), Parser_nodePos(receiver));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parsePrivateIdentifier","kind":"method","status":"implemented","sigHash":"d9c1a7befc2e8ae9b0db2e1bafe34fc8bcc9e50e056d1564445a9b92ed9f9815","bodyHash":"c2592c9aa02cbb52401ef8f2eeaf44427064d92f2b5b18791ecae34db4a7bdde"}
 *
 * Go source:
 * func (p *Parser) parsePrivateIdentifier() *ast.Node {
 * 	pos := p.nodePos()
 * 	text := p.scanner.TokenValue()
 * 	p.nextToken()
 * 	return p.finishNode(p.factory.NewPrivateIdentifier(p.internIdentifier(text)), pos)
 * }
 */
export function Parser_parsePrivateIdentifier(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const text = Scanner_TokenValue(receiver!.scanner);
  Parser_nextToken(receiver);
  return Parser_finishNode(receiver, NewPrivateIdentifier(receiver!.factory, Parser_internIdentifier(receiver, text)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.reScanLessThanToken","kind":"method","status":"implemented","sigHash":"485b86e12ffaf64c2b8b604010aaa7372e1693266bc6a049c026d2a06ded4b53","bodyHash":"e7bd97aad2bc5caa99cd1e097296ad897a5d47ff3970f0bb8efc8e64a2cc1672"}
 *
 * Go source:
 * func (p *Parser) reScanLessThanToken() ast.Kind {
 * 	p.token = p.scanner.ReScanLessThanToken()
 * 	return p.token
 * }
 */
export function Parser_reScanLessThanToken(receiver: GoPtr<Parser>): Kind {
  receiver!.token = Scanner_ReScanLessThanToken(receiver!.scanner);
  return receiver!.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.reScanGreaterThanToken","kind":"method","status":"implemented","sigHash":"15b93ef73078739bc229c48ee03a821af80a5d7562f1f01ce596015fc9c83856","bodyHash":"79afef3ab536b523cd447d5a3e2f836d5cabcc54dc668427c61a17c96e35833a"}
 *
 * Go source:
 * func (p *Parser) reScanGreaterThanToken() ast.Kind {
 * 	p.token = p.scanner.ReScanGreaterThanToken()
 * 	return p.token
 * }
 */
export function Parser_reScanGreaterThanToken(receiver: GoPtr<Parser>): Kind {
  receiver!.token = Scanner_ReScanGreaterThanToken(receiver!.scanner);
  return receiver!.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.reScanSlashToken","kind":"method","status":"implemented","sigHash":"8637213c722ce21f10493f1354f57691f62f8d730224e64e5ac50c8bc6b47467","bodyHash":"1fe4a57bc458efdeee3ad0a69cfe4d06d005c4344cd923b6600663f99cfc9cdd"}
 *
 * Go source:
 * func (p *Parser) reScanSlashToken() ast.Kind {
 * 	p.token = p.scanner.ReScanSlashToken()
 * 	return p.token
 * }
 */
export function Parser_reScanSlashToken(receiver: GoPtr<Parser>): Kind {
  receiver!.token = Scanner_ReScanSlashToken(receiver!.scanner);
  return receiver!.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsOpenParenOrLessThan","kind":"method","status":"implemented","sigHash":"3d704b092dc20e23e5f30b87f12eb3543c7bfc2e332bcbbc72381f16416350b9","bodyHash":"130bd7a6c0f841822603b0d241ad1fa500e618ce5e793891961d65cc1a5c9fe1"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsOpenParenOrLessThan() bool {
 * 	p.nextToken()
 * 	return p.token == ast.KindOpenParenToken || p.token == ast.KindLessThanToken
 * }
 */
export function Parser_nextTokenIsOpenParenOrLessThan(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  return (receiver!.token === KindOpenParenToken || receiver!.token === KindLessThanToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsColonOrQuestionColon","kind":"method","status":"implemented","sigHash":"6fc7e568adaac5943c3db9cdeb75586bed2f7769fabf6c25ab78bfe036633417","bodyHash":"900d01b49788abc40345cf20cf1f74dc6dd523b807f890a629516d281eaafba6"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsColonOrQuestionColon() bool {
 * 	return p.nextToken() == ast.KindColonToken || p.token == ast.KindQuestionToken && p.nextToken() == ast.KindColonToken
 * }
 */
export function Parser_nextTokenIsColonOrQuestionColon(receiver: GoPtr<Parser>): bool {
  return (Parser_nextToken(receiver) === KindColonToken || (receiver!.token === KindQuestionToken && Parser_nextToken(receiver) === KindColonToken)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseContextualModifier","kind":"method","status":"implemented","sigHash":"4edd0a1b7e526597814f3f8f895a47ad7739ce5d30e68ff6ef3a835a40700844","bodyHash":"402d1a96b43564a7f4346b8e959ffb1b124da7bcd389a3b3ed0c610228a550b5"}
 *
 * Go source:
 * func (p *Parser) parseContextualModifier(t ast.Kind) bool {
 * 	state := p.mark()
 * 	if p.token == t && p.nextTokenCanFollowModifier() {
 * 		return true
 * 	}
 * 	p.rewind(state)
 * 	return false
 * }
 */
export function Parser_parseContextualModifier(receiver: GoPtr<Parser>, t: Kind): bool {
  const state = Parser_mark(receiver);
  if (receiver!.token === t && Parser_nextTokenCanFollowModifier(receiver)) {
    return true as bool;
  }
  Parser_rewind(receiver, state);
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseAnyContextualModifier","kind":"method","status":"implemented","sigHash":"d3ed6105221808e5347523e518fc339730d1ac8f6f692cefc0eaec5295be709e","bodyHash":"b8599645a8fd284f9190186dfabd39dee8a696dc0563b84caf70ee2e054447af"}
 *
 * Go source:
 * func (p *Parser) parseAnyContextualModifier() bool {
 * 	state := p.mark()
 * 	if ast.IsModifierKind(p.token) && p.nextTokenCanFollowModifier() {
 * 		return true
 * 	}
 * 	p.rewind(state)
 * 	return false
 * }
 */
export function Parser_parseAnyContextualModifier(receiver: GoPtr<Parser>): bool {
  const state = Parser_mark(receiver);
  if (IsModifierKind(receiver!.token) && Parser_nextTokenCanFollowModifier(receiver)) {
    return true as bool;
  }
  Parser_rewind(receiver, state);
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenCanFollowModifier","kind":"method","status":"implemented","sigHash":"43b48255bc1e540fc227d4750cbe3bb858f6c17e840ede377c4e68280500d795","bodyHash":"fbabf1d366845366e7e9bdcc9f069ec5aa3c92fe6e400609d8616b7cdddb709e"}
 *
 * Go source:
 * func (p *Parser) nextTokenCanFollowModifier() bool {
 * 	switch p.token {
 * 	case ast.KindConstKeyword:
 * 		// 'const' is only a modifier if followed by 'enum'.
 * 		return p.nextToken() == ast.KindEnumKeyword
 * 	case ast.KindExportKeyword:
 * 		p.nextToken()
 * 		if p.token == ast.KindDefaultKeyword {
 * 			return p.lookAhead((*Parser).nextTokenCanFollowDefaultKeyword)
 * 		}
 * 		if p.token == ast.KindTypeKeyword {
 * 			return p.lookAhead((*Parser).nextTokenCanFollowExportModifier)
 * 		}
 * 		return p.canFollowExportModifier()
 * 	case ast.KindDefaultKeyword:
 * 		return p.nextTokenCanFollowDefaultKeyword()
 * 	case ast.KindStaticKeyword:
 * 		p.nextToken()
 * 		return p.canFollowModifier()
 * 	case ast.KindGetKeyword, ast.KindSetKeyword:
 * 		p.nextToken()
 * 		return p.canFollowGetOrSetKeyword()
 * 	default:
 * 		return p.nextTokenIsOnSameLineAndCanFollowModifier()
 * 	}
 * }
 */
export function Parser_nextTokenCanFollowModifier(receiver: GoPtr<Parser>): bool {
  switch (receiver!.token) {
    case KindConstKeyword:
      // 'const' is only a modifier if followed by 'enum'.
      return (Parser_nextToken(receiver) === KindEnumKeyword) as bool;
    case KindExportKeyword: {
      Parser_nextToken(receiver);
      if (receiver!.token === KindDefaultKeyword) {
        return Parser_lookAhead(receiver, Parser_nextTokenCanFollowDefaultKeyword);
      }
      if (receiver!.token === KindTypeKeyword) {
        return Parser_lookAhead(receiver, Parser_nextTokenCanFollowExportModifier);
      }
      return Parser_canFollowExportModifier(receiver);
    }
    case KindDefaultKeyword:
      return Parser_nextTokenCanFollowDefaultKeyword(receiver);
    case KindStaticKeyword:
      Parser_nextToken(receiver);
      return Parser_canFollowModifier(receiver);
    case KindGetKeyword:
    case KindSetKeyword:
      Parser_nextToken(receiver);
      return Parser_canFollowGetOrSetKeyword(receiver);
    default:
      return Parser_nextTokenIsOnSameLineAndCanFollowModifier(receiver);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenCanFollowDefaultKeyword","kind":"method","status":"implemented","sigHash":"3e1554ac64b57d0c2eab995453d9e3aa17c53a4747191f92cf47a9b14e304f5c","bodyHash":"a3e7ad9fa59d42a1c79b1498653f6eb93f56320d05f252982901bab245030b81"}
 *
 * Go source:
 * func (p *Parser) nextTokenCanFollowDefaultKeyword() bool {
 * 	switch p.nextToken() {
 * 	case ast.KindClassKeyword, ast.KindFunctionKeyword, ast.KindInterfaceKeyword, ast.KindAtToken:
 * 		return true
 * 	case ast.KindAbstractKeyword:
 * 		return p.lookAhead((*Parser).nextTokenIsClassKeywordOnSameLine)
 * 	case ast.KindAsyncKeyword:
 * 		return p.lookAhead((*Parser).nextTokenIsFunctionKeywordOnSameLine)
 * 	}
 * 	return false
 * }
 */
export function Parser_nextTokenCanFollowDefaultKeyword(receiver: GoPtr<Parser>): bool {
  switch (Parser_nextToken(receiver)) {
    case KindClassKeyword:
    case KindFunctionKeyword:
    case KindInterfaceKeyword:
    case KindAtToken:
      return true as bool;
    case KindAbstractKeyword:
      return Parser_lookAhead(receiver, Parser_nextTokenIsClassKeywordOnSameLine);
    case KindAsyncKeyword:
      return Parser_lookAhead(receiver, Parser_nextTokenIsFunctionKeywordOnSameLine);
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsIdentifierOrKeyword","kind":"method","status":"implemented","sigHash":"d77c2277024640c7e0d7d59dc96b0539c99ace2c2ec6bba84802dfae5b087724","bodyHash":"a16abad5cd48bf97cc56cd46952e62a61de33eaec9356554ab039a1bc9c67026"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsIdentifierOrKeyword() bool {
 * 	return tokenIsIdentifierOrKeyword(p.nextToken())
 * }
 */
export function Parser_nextTokenIsIdentifierOrKeyword(receiver: GoPtr<Parser>): bool {
  return tokenIsIdentifierOrKeyword(Parser_nextToken(receiver));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsIdentifierOrKeywordOrGreaterThan","kind":"method","status":"implemented","sigHash":"dc168285189cd70c73ec605426cb17a5ee1d60e5157ba3edaf0a9c1e1ac4ae09","bodyHash":"f9063e288191b4336cad596465ed6c575084b60336ecb8a81e0a578ca4fd956a"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsIdentifierOrKeywordOrGreaterThan() bool {
 * 	return tokenIsIdentifierOrKeywordOrGreaterThan(p.nextToken())
 * }
 */
export function Parser_nextTokenIsIdentifierOrKeywordOrGreaterThan(receiver: GoPtr<Parser>): bool {
  return tokenIsIdentifierOrKeywordOrGreaterThan(Parser_nextToken(receiver));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsIdentifierOrKeywordOnSameLine","kind":"method","status":"implemented","sigHash":"66fc17d6aa3d30532f739443b0a8854c7435a920451a675a3c1eaf974d8173bd","bodyHash":"7f56fbca4b25909b7a408dd8c1c960c3114e427ee9c4c94912b0c9195eab5a43"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsIdentifierOrKeywordOnSameLine() bool {
 * 	return p.nextTokenIsIdentifierOrKeyword() && !p.hasPrecedingLineBreak()
 * }
 */
export function Parser_nextTokenIsIdentifierOrKeywordOnSameLine(receiver: GoPtr<Parser>): bool {
  return (Parser_nextTokenIsIdentifierOrKeyword(receiver) && !Parser_hasPrecedingLineBreak(receiver)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.canFollowGetOrSetKeyword","kind":"method","status":"implemented","sigHash":"648042ce0ff520a99cfe584ecfb53ea8db8ebbd993452fe6ff62e6b80749eae2","bodyHash":"06a7dc32ac5280bcaa768ed64565f93d294a66fa6170bbc73a83e3f01710dfa4"}
 *
 * Go source:
 * func (p *Parser) canFollowGetOrSetKeyword() bool {
 * 	return p.token == ast.KindOpenBracketToken || p.isLiteralPropertyName()
 * }
 */
export function Parser_canFollowGetOrSetKeyword(receiver: GoPtr<Parser>): bool {
  return (receiver!.token === KindOpenBracketToken || Parser_isLiteralPropertyName(receiver)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsOnSameLineAndCanFollowModifier","kind":"method","status":"implemented","sigHash":"9dae8204a611916ed801fd8238e67112a6b2692b8bfabc61d623a79d7c92cc9d","bodyHash":"57f941244e2bf501451d772daa0dbe13e34946c549ec7638a9c4ae5ae4788925"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsOnSameLineAndCanFollowModifier() bool {
 * 	p.nextToken()
 * 	if p.hasPrecedingLineBreak() {
 * 		return false
 * 	}
 * 	return p.canFollowModifier()
 * }
 */
export function Parser_nextTokenIsOnSameLineAndCanFollowModifier(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  if (Parser_hasPrecedingLineBreak(receiver)) {
    return false as bool;
  }
  return Parser_canFollowModifier(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsOpenBrace","kind":"method","status":"implemented","sigHash":"8f2230c64ef7575eb25fecf36ef4e2806d3bccfaf1a6a2e51fe6714ab7554547","bodyHash":"e773a4d3ff1952f95fada798e3e63ad0cbeed59fad6d16a9720bea173973186e"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsOpenBrace() bool {
 * 	return p.nextToken() == ast.KindOpenBraceToken
 * }
 */
export function Parser_nextTokenIsOpenBrace(receiver: GoPtr<Parser>): bool {
  return (Parser_nextToken(receiver) === KindOpenBraceToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseOptionalBindingIdentifier","kind":"method","status":"implemented","sigHash":"d0aa7ad9cbda15412d5d1e4dad8aeec323e8b69e6d613b401878e92c41f1f059","bodyHash":"c303a2c02e2126c0df1eee212c1cbd832ce2ac9f82022951a50a1be466369769"}
 *
 * Go source:
 * func (p *Parser) parseOptionalBindingIdentifier() *ast.Node {
 * 	if p.isBindingIdentifier() {
 * 		return p.parseBindingIdentifier()
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseOptionalBindingIdentifier(receiver: GoPtr<Parser>): GoPtr<Node> {
  if (Parser_isBindingIdentifier(receiver)) {
    return Parser_parseBindingIdentifier(receiver);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseIdentifierNameErrorOnUnicodeEscapeSequence","kind":"method","status":"implemented","sigHash":"8b0faee65cc2de60c8842bd9c711639cd4e652e9e45f635d654ef41f3db6c281","bodyHash":"164c34f8da62eda1f2b891a053820141d744560764b31d57f84e613897101cc3"}
 *
 * Go source:
 * func (p *Parser) parseIdentifierNameErrorOnUnicodeEscapeSequence() *ast.Node {
 * 	if p.scanner.HasUnicodeEscape() || p.scanner.HasExtendedUnicodeEscape() {
 * 		p.parseErrorAtCurrentToken(diagnostics.Unicode_escape_sequence_cannot_appear_here)
 * 	}
 * 	return p.createIdentifier(tokenIsIdentifierOrKeyword(p.token))
 * }
 */
export function Parser_parseIdentifierNameErrorOnUnicodeEscapeSequence(receiver: GoPtr<Parser>): GoPtr<Node> {
  if (Scanner_HasUnicodeEscape(receiver!.scanner) || Scanner_HasExtendedUnicodeEscape(receiver!.scanner)) {
    Parser_parseErrorAtCurrentToken(receiver, Unicode_escape_sequence_cannot_appear_here);
  }
  return Parser_createIdentifier(receiver, tokenIsIdentifierOrKeyword(receiver!.token));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseBindingIdentifier","kind":"method","status":"implemented","sigHash":"209de95d5fb826e388243bb75b770544096bf3de7c93c95df6f807e14d5a6743","bodyHash":"96bbe03581529cecb05a80e311fc8559ad82a8490d0a6faf09b3f7125a8438a4"}
 *
 * Go source:
 * func (p *Parser) parseBindingIdentifier() *ast.Node {
 * 	return p.parseBindingIdentifierWithDiagnostic(nil)
 * }
 */
export function Parser_parseBindingIdentifier(receiver: GoPtr<Parser>): GoPtr<Node> {
  return Parser_parseBindingIdentifierWithDiagnostic(receiver, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseIdentifierName","kind":"method","status":"implemented","sigHash":"e8977ce809a70045a733b03ff0435e5febc29fb2e82ee47d5f9a948779f89c12","bodyHash":"cfbcb52677f0242a566f900019697c07387a08f1b2faf7b5a9272466f4910729"}
 *
 * Go source:
 * func (p *Parser) parseIdentifierName() *ast.Node {
 * 	return p.parseIdentifierNameWithDiagnostic(nil)
 * }
 */
export function Parser_parseIdentifierName(receiver: GoPtr<Parser>): GoPtr<Node> {
  return Parser_parseIdentifierNameWithDiagnostic(receiver, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseIdentifier","kind":"method","status":"implemented","sigHash":"ed117af8684bba804d1cab2a884e0bf1dc955cf1bf3a37b2f854a1ba309a479d","bodyHash":"b5d60ff0840f65ff87373c136d309bb936c7902a591d0b3233dd2aac547cafdc"}
 *
 * Go source:
 * func (p *Parser) parseIdentifier() *ast.Node {
 * 	return p.parseIdentifierWithDiagnostic(nil, nil)
 * }
 */
export function Parser_parseIdentifier(receiver: GoPtr<Parser>): GoPtr<Node> {
  return Parser_parseIdentifierWithDiagnostic(receiver, undefined, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.createIdentifier","kind":"method","status":"implemented","sigHash":"09c3f6a8be3839676e0aa768c134c7da67f7644366d035adc949717109429e04","bodyHash":"e210bf33362a39c374d105e5434f9e54ccc43dd6bf754f9b70a887e380c05f97"}
 *
 * Go source:
 * func (p *Parser) createIdentifier(isIdentifier bool) *ast.Node {
 * 	return p.createIdentifierWithDiagnostic(isIdentifier, nil, nil)
 * }
 */
export function Parser_createIdentifier(receiver: GoPtr<Parser>, isIdentifier: bool): GoPtr<Node> {
  return Parser_createIdentifierWithDiagnostic(receiver, isIdentifier, undefined, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.internIdentifier","kind":"method","status":"implemented","sigHash":"c15ecffe0c2c1ec045b943a5c2478888baf2de40d37e997a4c09a8c5c2c56ef4","bodyHash":"7b7ba05fcc425616aee78a8fc3e9d9e5c68e4fbeb485614d4ca34005007e7ff3"}
 *
 * Go source:
 * func (p *Parser) internIdentifier(text string) string {
 * 	if identifier, ok := p.identifiers[text]; ok {
 * 		return identifier
 * 	}
 * 	identifier := text
 * 	if p.identifiers == nil {
 * 		p.identifiers = make(map[string]string)
 * 	}
 * 	p.identifiers[identifier] = identifier
 * 	return identifier
 * }
 */
export function Parser_internIdentifier(receiver: GoPtr<Parser>, text: string): string {
  if (receiver!.identifiers !== undefined && receiver!.identifiers.has(text)) {
    return receiver!.identifiers.get(text)!;
  }
  const identifier = text;
  if (receiver!.identifiers === undefined) {
    receiver!.identifiers = new globalThis.Map<string, string>();
  }
  receiver!.identifiers.set(identifier, identifier);
  return identifier;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsSlash","kind":"method","status":"implemented","sigHash":"04fd36ec568cbd64477e2eff5b65595bf9d5e58c658657f366376d8966d6644f","bodyHash":"3d205f3f5f932054a63f125083a4905ddd1fe64c0663cf699391600bcdcf31ea"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsSlash() bool {
 * 	return p.nextToken() == ast.KindSlashToken
 * }
 */
export function Parser_nextTokenIsSlash(receiver: GoPtr<Parser>): bool {
  return (Parser_nextToken(receiver) === KindSlashToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isBindingIdentifierOrPrivateIdentifierOrPattern","kind":"method","status":"implemented","sigHash":"8e67f62e1690d415dbedb0056b996e058c86d207b7295d508822290be751494d","bodyHash":"43b4eabdfdf3318b1cfbe4f4b810b56b3d4119e603fb754a94959b1248b1fc0b"}
 *
 * Go source:
 * func (p *Parser) isBindingIdentifierOrPrivateIdentifierOrPattern() bool {
 * 	return p.token == ast.KindOpenBraceToken || p.token == ast.KindOpenBracketToken || p.token == ast.KindPrivateIdentifier || p.isBindingIdentifier()
 * }
 */
export function Parser_isBindingIdentifierOrPrivateIdentifierOrPattern(receiver: GoPtr<Parser>): bool {
  return (receiver!.token === KindOpenBraceToken || receiver!.token === KindOpenBracketToken || receiver!.token === KindPrivateIdentifier || Parser_isBindingIdentifier(receiver)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsIdentifierOnSameLine","kind":"method","status":"implemented","sigHash":"b2be3a36a23cede3b7adf48b5ae247d7b91d13ed07fa39f1c0e4aebbbb6dbbbd","bodyHash":"ca74d3cc2b08ff48d11f6a1b199bf9b4c9b6b48827951bfab50b40abe56bb2f9"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsIdentifierOnSameLine() bool {
 * 	p.nextToken()
 * 	return p.isIdentifier() && !p.hasPrecedingLineBreak()
 * }
 */
export function Parser_nextTokenIsIdentifierOnSameLine(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  return (Parser_isIdentifier(receiver) && !Parser_hasPrecedingLineBreak(receiver)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isIdentifier","kind":"method","status":"implemented","sigHash":"380e2eaed0327fcb5c0d11d19831449e227f1bc4372129ed7df8d338f0c02d05","bodyHash":"9862d31c1b0a6f4a38079be90eb98557718005313aac94ea5a77e0df1d7a2d90"}
 *
 * Go source:
 * func (p *Parser) isIdentifier() bool {
 * 	if p.token == ast.KindIdentifier {
 * 		return true
 * 	}
 * 	// If we have a 'yield' keyword, and we're in the [yield] context, then 'yield' is
 * 	// considered a keyword and is not an identifier.
 * 	// If we have a 'await' keyword, and we're in the [Await] context, then 'await' is
 * 	// considered a keyword and is not an identifier.
 * 	if p.token == ast.KindYieldKeyword && p.inYieldContext() || p.token == ast.KindAwaitKeyword && p.inAwaitContext() {
 * 		return false
 * 	}
 * 	return p.token > ast.KindLastReservedWord
 * }
 */
export function Parser_isIdentifier(receiver: GoPtr<Parser>): bool {
  if (receiver!.token === KindIdentifier) {
    return true as bool;
  }
  // If we have a 'yield' keyword, and we're in the [yield] context, then 'yield' is
  // considered a keyword and is not an identifier.
  // If we have a 'await' keyword, and we're in the [Await] context, then 'await' is
  // considered a keyword and is not an identifier.
  if ((receiver!.token === KindYieldKeyword && Parser_inYieldContext(receiver)) || (receiver!.token === KindAwaitKeyword && Parser_inAwaitContext(receiver))) {
    return false as bool;
  }
  return (receiver!.token > KindLastReservedWord) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isBindingIdentifier","kind":"method","status":"implemented","sigHash":"20e2c33b83c95cc405984d4233cd1e9c1f4ce073845fdd2ca69430780a2c8b13","bodyHash":"45300e5164d9a1e9f1f221c2cb205016e1b24880a24c7d2ece66f3ca3b117078"}
 *
 * Go source:
 * func (p *Parser) isBindingIdentifier() bool {
 * 	// `let await`/`let yield` in [Yield] or [Await] are allowed here and disallowed in the binder.
 * 	return p.token == ast.KindIdentifier || p.token > ast.KindLastReservedWord
 * }
 */
export function Parser_isBindingIdentifier(receiver: GoPtr<Parser>): bool {
  // `let await`/`let yield` in [Yield] or [Await] are allowed here and disallowed in the binder.
  return (receiver!.token === KindIdentifier || receiver!.token > KindLastReservedWord) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsEqualsOrSemicolonOrColonToken","kind":"method","status":"implemented","sigHash":"b2109b71c4277306ba6612b81f493ddf241a56cf7fe61ba7298c684ef6351418","bodyHash":"c60fd57ef838401887da8a9c723e9a61c2377b184be327e344a20e00cc2aa13f"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsEqualsOrSemicolonOrColonToken() bool {
 * 	p.nextToken()
 * 	return p.token == ast.KindEqualsToken || p.token == ast.KindSemicolonToken || p.token == ast.KindColonToken
 * }
 */
export function Parser_nextTokenIsEqualsOrSemicolonOrColonToken(receiver: GoPtr<Parser>): bool {
  Parser_nextToken(receiver);
  return (receiver!.token === KindEqualsToken || receiver!.token === KindSemicolonToken || receiver!.token === KindColonToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLine","kind":"method","status":"implemented","sigHash":"8dc13add40cf6df70a91c27cc80641041a87a33bbebcb540574b2c605a763ecc","bodyHash":"9f5492b8dca8f0e375685cd9ca4001ca6ecad308819b66610ce0c7124edd2316"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLine(disallowOf bool) bool {
 * 	p.nextToken()
 * 	if disallowOf && p.token == ast.KindOfKeyword {
 * 		return p.lookAhead((*Parser).nextTokenIsEqualsOrSemicolonOrColonToken)
 * 	}
 * 	return p.isBindingIdentifier() || p.token == ast.KindOpenBraceToken && !p.hasPrecedingLineBreak()
 * }
 */
export function Parser_nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLine(receiver: GoPtr<Parser>, disallowOf: bool): bool {
  Parser_nextToken(receiver);
  if (disallowOf && receiver!.token === KindOfKeyword) {
    return Parser_lookAhead(receiver, Parser_nextTokenIsEqualsOrSemicolonOrColonToken);
  }
  return (Parser_isBindingIdentifier(receiver) || (receiver!.token === KindOpenBraceToken && !Parser_hasPrecedingLineBreak(receiver))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLineDisallowOf","kind":"method","status":"implemented","sigHash":"88b30c0a5bb44db307b5ee52f872d5371208ffaacbaf64cf35c02882af9819fd","bodyHash":"fd570b58883d4f987f00e4c26c53791d11263594efb8a30dccd833ebdd0d8d10"}
 *
 * Go source:
 * func (p *Parser) nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLineDisallowOf() bool {
 * 	return p.nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLine( /*disallowOf* / true)
 * }
 */
export function Parser_nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLineDisallowOf(receiver: GoPtr<Parser>): bool {
  return Parser_nextTokenIsBindingIdentifierOrStartOfDestructuringOnSameLine(receiver, /*disallowOf*/ true as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.setContextFlags","kind":"method","status":"implemented","sigHash":"8a7093c53811e8433dc68584af8788ed670d8dc2d84703812561e2727329ca89","bodyHash":"4004e29b8d8924cc699de5f5410376db192113deb4a8e297945a817dc936beac"}
 *
 * Go source:
 * func (p *Parser) setContextFlags(flags ast.NodeFlags, value bool) {
 * 	if value {
 * 		p.contextFlags |= flags
 * 	} else {
 * 		p.contextFlags &^= flags
 * 	}
 * }
 */
export function Parser_setContextFlags(receiver: GoPtr<Parser>, flags: NodeFlags, value: bool): void {
  if (value) {
    receiver!.contextFlags = (receiver!.contextFlags | flags) as NodeFlags;
  } else {
    receiver!.contextFlags = (receiver!.contextFlags & ~flags) as NodeFlags;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::doInContext","kind":"func","status":"implemented","sigHash":"cd3b3026c853ac913415757a4568bad8250b5a17b28293dd0890bba81270f225","bodyHash":"cc5e2e1ffee958f2852290c136e50d8c05cdb664df24e9145dfd53ae90618b77"}
 *
 * Go source:
 * func doInContext[T any](p *Parser, flags ast.NodeFlags, value bool, f func(p *Parser) T) T {
 * 	saveContextFlags := p.contextFlags
 * 	p.setContextFlags(flags, value)
 * 	result := f(p)
 * 	p.contextFlags = saveContextFlags
 * 	return result
 * }
 */
export function doInContext<T>(p: GoPtr<Parser>, flags: NodeFlags, value: bool, f: (p: GoPtr<Parser>) => T): T {
  const saveContextFlags = p!.contextFlags;
  Parser_setContextFlags(p, flags, value);
  const result = f(p);
  p!.contextFlags = saveContextFlags;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.inDisallowInContext","kind":"method","status":"implemented","sigHash":"cf208ee0184896235e42430287ea20db30f3096a38c9184a29259ba1af5e722e","bodyHash":"228bede22703bdfa57b37f3f744c2056f2fa504557191fdd180acd756f009fcf"}
 *
 * Go source:
 * func (p *Parser) inDisallowInContext() bool {
 * 	return p.contextFlags&ast.NodeFlagsDisallowInContext != 0
 * }
 */
export function Parser_inDisallowInContext(receiver: GoPtr<Parser>): bool {
  return ((receiver!.contextFlags & NodeFlagsDisallowInContext) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.inDecoratorContext","kind":"method","status":"implemented","sigHash":"70ef10fb14860ace84a07d54370a7dee806dc7ad6a6121f2cd744b1914794ecf","bodyHash":"9844f0cd5eb997c6c643dfbbcbc2c04965f9dfe09858befe221554bd6bd5858d"}
 *
 * Go source:
 * func (p *Parser) inDecoratorContext() bool {
 * 	return p.contextFlags&ast.NodeFlagsDecoratorContext != 0
 * }
 */
export function Parser_inDecoratorContext(receiver: GoPtr<Parser>): bool {
  return ((receiver!.contextFlags & NodeFlagsDecoratorContext) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.skipRangeTrivia","kind":"method","status":"implemented","sigHash":"347ddcbce0e31e5145499fba3c5df19e9136ba5893c17af04fe20ba83468190a","bodyHash":"ba95c187ef316a3ce20452d8ff0207797d5150ccd7c1dfed086768016ad7f446"}
 *
 * Go source:
 * func (p *Parser) skipRangeTrivia(textRange core.TextRange) core.TextRange {
 * 	return core.NewTextRange(scanner.SkipTrivia(p.sourceText, textRange.Pos()), textRange.End())
 * }
 */
export function Parser_skipRangeTrivia(receiver: GoPtr<Parser>, textRange: TextRange): TextRange {
  return NewTextRange(SkipTrivia(receiver!.sourceText, TextRange_Pos(textRange)), TextRange_End(textRange));
}
