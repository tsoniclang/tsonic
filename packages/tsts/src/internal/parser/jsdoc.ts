import type { bool, int } from "../../go/scalars.js";
import type { GoPtr, GoRune, GoSlice } from "../../go/compat.js";
import { TrimLeft, TrimRightFunc } from "../../go/strings.js";
import { byteLen, hasAsciiPrefixAt, isJSDocLikeTextAt, lastNewlineBefore } from "./utilities.js";
import { Node_End, Node_Name, Node_Pos } from "../ast/spine.js";
import type { Node, NodeList } from "../ast/spine.js";
import { SetParseJSDocForNode, Node_TagName, Node_Text, Node_Type } from "../ast/ast.js";
import type { SourceFile } from "../ast/ast.js";
import {
  NewExpressionWithTypeArguments,
  NewJSDoc,
  NewJSDocAugmentsTag,
  NewJSDocCallbackTag,
  NewJSDocDeprecatedTag,
  NewJSDocImplementsTag,
  NewJSDocImportTag,
  NewJSDocLink,
  NewJSDocLinkCode,
  NewJSDocLinkPlain,
  NewJSDocNameReference,
  NewJSDocOverloadTag,
  NewJSDocOverrideTag,
  NewJSDocParameterOrPropertyTag,
  NewJSDocPrivateTag,
  NewJSDocProtectedTag,
  NewJSDocPublicTag,
  NewJSDocReadonlyTag,
  NewJSDocReturnTag,
  NewJSDocSatisfiesTag,
  NewJSDocSeeTag,
  NewJSDocSignature,
  NewJSDocTemplateTag,
  NewJSDocText,
  NewJSDocThisTag,
  NewJSDocThrowsTag,
  NewJSDocTypeLiteral,
  NewJSDocTypeExpression,
  NewJSDocTypeTag,
  NewJSDocTypedefTag,
  NewJSDocUnknownTag,
  NewModuleDeclaration,
  NewPropertyAccessExpression,
  NewQualifiedName,
  NewTypeParameterDeclaration,
} from "../ast/generated/factory.js";
import type { Kind } from "../ast/generated/kinds.js";
import {
  KindArrayType,
  KindAsteriskToken,
  KindAtToken,
  KindBacktickToken,
  KindCloseBraceToken,
  KindCloseBracketToken,
  KindCommaToken,
  KindDotToken,
  KindEqualsToken,
  KindEndOfFile,
  KindIdentifier,
  KindJSDocCommentTextToken,
  KindJSDocParameterTag,
  KindJSDocPropertyTag,
  KindJSDocReturnTag,
  KindJSDocTemplateTag,
  KindJSDocTypeTag,
  KindNamespaceKeyword,
  KindNewLineTrivia,
  KindObjectKeyword,
  KindOpenBraceToken,
  KindOpenBracketToken,
  KindPrivateIdentifier,
  KindTypeKeyword,
  KindWhitespaceTrivia,
} from "../ast/generated/kinds.js";
import {
  NodeFlagsHasAsyncFunctions,
  NodeFlagsHasJSDoc,
  NodeFlagsIdentifierIsInJSDocNamespace,
  NodeFlagsJavaScriptFile,
  NodeFlagsJSDoc,
  NodeFlagsNestedNamespace,
  NodeFlagsNone,
  NodeFlagsOptionalChain,
  NodeFlagsPossiblyContainsDeprecatedTag,
} from "../ast/generated/flags.js";
import type { EntityName, IdentifierNode, SourceFileNode, TypeNode, TypeParameterList } from "../ast/generated/unions.js";
import { Some, IfElse } from "../core/core.js";
import {
  A_JSDoc_template_tag_may_not_follow_a_typedef_callback_or_overload_tag,
  A_JSDoc_typedef_comment_may_not_contain_multiple_type_tags,
  Identifier_expected,
  Identifier_expected_0_is_a_reserved_word_that_cannot_be_used_here,
  The_tag_was_first_specified_here,
  Unexpected_token_A_type_parameter_name_was_expected_without_curly_braces,
  X_0_tag_already_specified,
} from "../diagnostics/generated/messages.js";
import type { Message } from "../diagnostics/diagnostics.js";
import { NewDiagnostic, Diagnostic_AddRelatedInfo } from "../ast/diagnostic.js";
import { IsIdentifier, IsJSDocParameterTag, IsJSDocPropertyTag, IsJSDocReturnTag, IsJSDocTemplateTag, IsJSDocTypeTag, IsTypeReferenceNode } from "../ast/generated/predicates.js";
import { AsArrayTypeNode, AsJSDocTypeTag, AsQualifiedName, AsTypeReferenceNode } from "../ast/generated/casts.js";
import { NodeIsMissing } from "../ast/utilities.js";
import { IsWhiteSpaceLike } from "../stringutil/util.js";
import { NewTextRange } from "../core/text.js";
import { Arena_Clone, Arena_NewSlice } from "../core/arena.js";
import type { Arena } from "../core/arena.js";
import type { ScannerState } from "../scanner/scanner.js";
import {
  Scanner_CanFollowJSDocAt,
  Scanner_HasPrecedingLineBreak,
  Scanner_Mark,
  Scanner_Rewind,
  Scanner_ResetPos,
  Scanner_ReScanHashToken,
  Scanner_SetSkipJSDocLeadingAsterisks,
  Scanner_SetTextEnd,
  Scanner_TokenEnd,
  Scanner_TokenFullStart,
  Scanner_TokenStart,
  Scanner_TokenText,
  Scanner_TokenValue,
} from "../scanner/scanner.js";
import { Parser_parseExpression } from "./parser/expressions.js";
import { Parser_nextJSDocCommentTextToken, Parser_parseExpectedJSDoc, Parser_parseExpectedTokenJSDoc, Parser_parseJSDocType, Parser_nextTokenJSDoc } from "./parser/jsx-jsdoc.js";
import {
  Parser_finishNode,
  Parser_initializeState,
  Parser_isJavaScript,
  Parser_lookAhead,
  Parser_mark,
  Parser_nodePos,
  Parser_parseModifiersEx,
  Parser_parseOptional,
  Parser_rewind,
  getParser,
  isReservedWord,
  putParser,
} from "./parser/support.js";
import { Parser_finishNodeWithEnd, Parser_parseModuleSpecifier, Parser_tryParseImportAttributes, Parser_tryParseImportClause } from "./parser/statements-declarations.js";
import {
  Parser_createMissingIdentifier,
  Parser_internIdentifier,
  Parser_isIdentifier,
  Parser_newIdentifier,
  Parser_nextTokenIsIdentifierOrKeyword,
  Parser_parseErrorAtCurrentToken,
  Parser_parseExpected,
  Parser_parseIdentifier,
  Parser_parseIdentifierName,
  Parser_parseOptionalToken,
  Parser_setContextFlags,
} from "./parser/tokens-speculation.js";
import { Parser_parseErrorAt, Parser_parseErrorAtRange } from "./parser/errors-recovery.js";
import { Parser_newNodeList } from "./parser/lists.js";
import { Parser_parseTypeArguments } from "./parser/types.js";
import type { jsdocScannerInfo, JSDocInfo, Parser } from "./parser/state.js";
import { jsdocScannerInfoHasDeprecated, jsdocScannerInfoHasJSDoc, jsdocScannerInfoHasSeeOrLink, PCJSDocComment } from "./parser/state.js";
import { GetJSDocCommentRanges, tokenIsIdentifierOrKeyword } from "./utilities.js";
import { Parser_reparseTags } from "./reparser.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::func::init","kind":"func","status":"implemented","sigHash":"deadcfe2223147229491ed97a5eb1b413a0acb92061a6dd7ca510eb6614543db","bodyHash":"96bfb6b01644ae8c4357bfbcdc48104efcf247c2ce7785580737940d751be6d3"}
 *
 * Go source:
 * func init() {
 * 	ast.SetParseJSDocForNode(parseJSDocForNode)
 * }
 */
export function init(): void {
  SetParseJSDocForNode(parseJSDocForNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::func::parseJSDocForNode","kind":"func","status":"implemented","sigHash":"aaa76ebc73eade1cba544f6a0b246a3bb0e95f4bc627a3eff5ac4666ac433093","bodyHash":"17bbecbd63e34176aee3841adcb8a0f816a4476d4f1de3d8b01f67dfac6db430"}
 *
 * Go source:
 * func parseJSDocForNode(sourceFile *ast.SourceFile, node *ast.Node) []*ast.Node {
 * 	p := getParser()
 * 	defer putParser(p)
 * 	p.initializeState(sourceFile.ParseOptions(), sourceFile.Text(), sourceFile.ScriptKind)
 * 	ranges := GetJSDocCommentRanges(&p.factory, nil, node, sourceFile.Text())
 * 	if len(ranges) == 0 {
 * 		return nil
 * 	}
 * 	jsdoc := make([]*ast.Node, 0, len(ranges))
 * 	pos := node.Pos()
 * 	for _, comment := range ranges {
 * 		if parsed := p.parseJSDocComment(node, comment.Pos(), comment.End(), pos); parsed != nil {
 * 			parsed.Parent = node
 * 			jsdoc = append(jsdoc, parsed)
 * 			pos = parsed.End()
 * 		}
 * 	}
 * 	return jsdoc
 * }
 */
export function parseJSDocForNode(sourceFile: GoPtr<SourceFileNode>, node: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  const sf = sourceFile as unknown as GoPtr<SourceFile>;
  const p = getParser();
  try {
    Parser_initializeState(p, sf!.parseOptions, sf!.text, sf!.ScriptKind);
    const ranges = GetJSDocCommentRanges(p!.factory, [], node, sf!.text);
    if (ranges.length === 0) {
      return undefined!;
    }
    const jsdoc: GoSlice<GoPtr<Node>> = [];
    let pos = Node_Pos(node);
    for (const comment of ranges) {
      const parsed = Parser_parseJSDocComment(p, node, comment.pos, comment.end, pos);
      if (parsed !== undefined) {
        parsed!.Parent = node;
        jsdoc.push(parsed);
        pos = Node_End(parsed);
      }
    }
    return jsdoc;
  } finally {
    putParser(p);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::type::jsdocState","kind":"type","status":"implemented","sigHash":"6d3ac3a19dc9e8764433bfb10dd91e08a5b99f1df162cf75d5e18dfb0cda7779","bodyHash":"390d1787ac3c3cd74f6b2061bb9976cf7800cbdbcdf4f7e50480f1cb5c43d222"}
 *
 * Go source:
 * jsdocState int32
 */
export type jsdocState = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::constGroup::jsdocStateBeginningOfLine+jsdocStateSawAsterisk+jsdocStateSavingComments+jsdocStateSavingBackticks","kind":"constGroup","status":"implemented","sigHash":"eb2f716060a6543364093d10a0357836ed1574963f648bd1996da8ec2a38b092","bodyHash":"9d7fc94d379e493535ea849c6290ada5efe9fa859b6764ce7d836acadbdac358"}
 *
 * Go source:
 * const (
 * 	jsdocStateBeginningOfLine jsdocState = iota
 * 	jsdocStateSawAsterisk
 * 	jsdocStateSavingComments
 * 	jsdocStateSavingBackticks
 * )
 */
export const jsdocStateBeginningOfLine: jsdocState = 0;
export const jsdocStateSawAsterisk: jsdocState = 1;
export const jsdocStateSavingComments: jsdocState = 2;
export const jsdocStateSavingBackticks: jsdocState = 3;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::type::propertyLikeParse","kind":"type","status":"implemented","sigHash":"98f72ca32892f7f4f8800b310650468649848ede075c181f48f20018256502e5","bodyHash":"c9afe9ed8f0d9da867930b487b6752957f3d7e4c8b91e01e720c2f1a256c3769"}
 *
 * Go source:
 * propertyLikeParse int32
 */
export type propertyLikeParse = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::constGroup::propertyLikeParseProperty+propertyLikeParseParameter+propertyLikeParseCallbackParameter","kind":"constGroup","status":"implemented","sigHash":"4a824230f213e3a640025d56fe9d5b08f380337d2aa53ff855c641e350e52de5","bodyHash":"ad6b6ed6a1c2f8c5db900057571a72af92c86ceff0b47bbcc79ee7169649101c"}
 *
 * Go source:
 * const (
 * 	propertyLikeParseProperty propertyLikeParse = 1 << iota
 * 	propertyLikeParseParameter
 * 	propertyLikeParseCallbackParameter
 * )
 */
export const propertyLikeParseProperty: propertyLikeParse = 1 << 0;
export const propertyLikeParseParameter: propertyLikeParse = 1 << 1;
export const propertyLikeParseCallbackParameter: propertyLikeParse = 1 << 2;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.withJSDoc","kind":"method","status":"implemented","sigHash":"0f34ce66e38dcebcdffa165bf7113e2875854e913938acb86fed0d0dd8cb89f1","bodyHash":"622962271bc540cda6b499e44af31cae57f21d534af6855a254880c68a7789c2"}
 *
 * Go source:
 * func (p *Parser) withJSDoc(node *ast.Node, info jsdocScannerInfo) []*ast.Node {
 * 	if info&jsdocScannerInfoHasJSDoc == 0 {
 * 		return nil
 * 	}
 *
 * 	// For TS/TSX files, defer JSDoc parsing to first access, unless the comment
 * 	// contains @see/@link (needed for unused-identifier checks).
 * 	// @deprecated is detected via cheap text scan to set PossiblyContainsDeprecatedTag;
 * 	// callers must confirm via JSDoc lookup.
 * 	if !p.isJavaScript() {
 * 		node.Flags |= ast.NodeFlagsHasJSDoc
 * 		if info&jsdocScannerInfoHasDeprecated != 0 {
 * 			node.Flags |= ast.NodeFlagsPossiblyContainsDeprecatedTag
 * 		}
 * 		if info&jsdocScannerInfoHasSeeOrLink == 0 {
 * 			return nil
 * 		}
 * 		// Fall through to eager parse for @see/@link
 * 	}
 *
 * 	ranges := GetJSDocCommentRanges(&p.factory, p.jsdocCommentRangesSpace, node, p.sourceText)
 * 	p.jsdocCommentRangesSpace = ranges[:0]
 *
 * 	// Should only be called once per node
 * 	p.hasDeprecatedTag = false
 * 	jsdoc := p.nodeSliceArena.NewSlice(len(ranges))[:0]
 * 	pos := node.Pos()
 * 	for _, comment := range ranges {
 * 		if parsed := p.parseJSDocComment(node, comment.Pos(), comment.End(), pos); parsed != nil {
 * 			parsed.Parent = node
 * 			jsdoc = append(jsdoc, parsed)
 * 			pos = parsed.End()
 * 		}
 * 	}
 * 	if len(jsdoc) != 0 {
 * 		if node.Flags&ast.NodeFlagsHasJSDoc == 0 {
 * 			node.Flags |= ast.NodeFlagsHasJSDoc
 * 		}
 * 		if p.hasDeprecatedTag {
 * 			p.hasDeprecatedTag = false
 * 			node.Flags |= ast.NodeFlagsPossiblyContainsDeprecatedTag
 * 		}
 * 		if p.isJavaScript() {
 * 			p.reparseTags(node, jsdoc)
 * 		}
 * 		p.jsdocInfos = append(p.jsdocInfos, JSDocInfo{parent: node, jsDocs: jsdoc})
 * 		return jsdoc
 * 	}
 * 	return nil
 * }
 */
export function Parser_withJSDoc(receiver: GoPtr<Parser>, node: GoPtr<Node>, info: jsdocScannerInfo): GoSlice<GoPtr<Node>> {
  if ((info & jsdocScannerInfoHasJSDoc) === 0) {
    return undefined!;
  }

  // For TS/TSX files, defer JSDoc parsing to first access, unless the comment
  // contains @see/@link (needed for unused-identifier checks).
  // @deprecated is detected via cheap text scan to set PossiblyContainsDeprecatedTag;
  // callers must confirm via JSDoc lookup.
  if (!Parser_isJavaScript(receiver)) {
    node!.Flags |= NodeFlagsHasJSDoc;
    if ((info & jsdocScannerInfoHasDeprecated) !== 0) {
      node!.Flags |= NodeFlagsPossiblyContainsDeprecatedTag;
    }
    if ((info & jsdocScannerInfoHasSeeOrLink) === 0) {
      return undefined!;
    }
    // Fall through to eager parse for @see/@link
  }

  const ranges = GetJSDocCommentRanges(receiver!.factory, receiver!.jsdocCommentRangesSpace, node, receiver!.sourceText);
  receiver!.jsdocCommentRangesSpace = ranges.slice(0, 0);

  // Should only be called once per node
  receiver!.hasDeprecatedTag = false;
  const jsdoc: GoSlice<GoPtr<Node>> = Arena_NewSlice(receiver!.nodeSliceArena as GoPtr<Arena<GoPtr<Node>>>, ranges.length).slice(0, 0);
  let pos = Node_Pos(node);
  for (const comment of ranges) {
    const parsed = Parser_parseJSDocComment(receiver, node, comment.pos, comment.end, pos);
    if (parsed !== undefined) {
      parsed!.Parent = node;
      jsdoc.push(parsed);
      pos = Node_End(parsed);
    }
  }
  if (jsdoc.length !== 0) {
    if ((node!.Flags & NodeFlagsHasJSDoc) === 0) {
      node!.Flags |= NodeFlagsHasJSDoc;
    }
    if (receiver!.hasDeprecatedTag) {
      receiver!.hasDeprecatedTag = false;
      node!.Flags |= NodeFlagsPossiblyContainsDeprecatedTag;
    }
    if (Parser_isJavaScript(receiver)) {
      Parser_reparseTags(receiver, node, jsdoc);
    }
    receiver!.jsdocInfos = [...receiver!.jsdocInfos, { parent: node, jsDocs: jsdoc } as JSDocInfo];
    return jsdoc;
  }
  return undefined!;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseJSDocTypeExpression","kind":"method","status":"implemented","sigHash":"aa63d63046fc51977dd32a0279568eb684ac880be4384c9f82617bb1a661ef46","bodyHash":"79a32474c85423253d2ba57247c1cf28f3b22b36d6c8632a332bc09b60a07dca"}
 *
 * Go source:
 * func (p *Parser) parseJSDocTypeExpression(mayOmitBraces bool) *ast.Node {
 * 	pos := p.nodePos()
 * 	var hasBrace bool
 * 	if mayOmitBraces {
 * 		hasBrace = p.parseOptional(ast.KindOpenBraceToken)
 * 	} else {
 * 		hasBrace = p.parseExpected(ast.KindOpenBraceToken)
 * 	}
 * 	saveContextFlags := p.contextFlags
 * 	p.setContextFlags(ast.NodeFlagsJSDoc, true)
 * 	t := p.parseJSDocType()
 * 	p.contextFlags = saveContextFlags
 * 	if hasBrace {
 * 		p.parseExpectedJSDoc(ast.KindCloseBraceToken)
 * 	}
 *
 * 	return p.finishNode(p.factory.NewJSDocTypeExpression(t), pos)
 * }
 */
export function Parser_parseJSDocTypeExpression(receiver: GoPtr<Parser>, mayOmitBraces: bool): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  let hasBrace: bool;
  if (mayOmitBraces) {
    hasBrace = Parser_parseOptional(receiver, KindOpenBraceToken);
  } else {
    hasBrace = Parser_parseExpected(receiver, KindOpenBraceToken);
  }
  const saveContextFlags = receiver!.contextFlags;
  Parser_setContextFlags(receiver, NodeFlagsJSDoc, true);
  const t = Parser_parseJSDocType(receiver);
  receiver!.contextFlags = saveContextFlags;
  if (hasBrace) {
    Parser_parseExpectedJSDoc(receiver, KindCloseBraceToken);
  }

  return Parser_finishNode(receiver, NewJSDocTypeExpression(receiver!.factory, t), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseJSDocNameReference","kind":"method","status":"implemented","sigHash":"b6c7fd23096b304740510dc6bacaf5013190e83601b9dde733f93170087b9113","bodyHash":"623f4811eb9c3be313c25e6e567b10554dcfc448d09246ca66ada733df639750"}
 *
 * Go source:
 * func (p *Parser) parseJSDocNameReference() *ast.Node {
 * 	pos := p.nodePos()
 * 	hasBrace := p.parseOptional(ast.KindOpenBraceToken)
 * 	entityName := p.parseJSDocLinkName()
 * 	if hasBrace {
 * 		p.parseExpectedJSDoc(ast.KindCloseBraceToken)
 * 	}
 * 	p.scanner.ResetPos(p.scanner.TokenFullStart())
 * 	p.nextTokenJSDoc()
 * 	return p.finishNode(p.factory.NewJSDocNameReference(entityName), pos)
 * }
 */
export function Parser_parseJSDocNameReference(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  const hasBrace = Parser_parseOptional(receiver, KindOpenBraceToken);
  const entityName = Parser_parseJSDocLinkName(receiver);
  if (hasBrace) {
    Parser_parseExpectedJSDoc(receiver, KindCloseBraceToken);
  }
  Scanner_ResetPos(receiver!.scanner, Scanner_TokenFullStart(receiver!.scanner));
  Parser_nextTokenJSDoc(receiver);
  return Parser_finishNode(receiver, NewJSDocNameReference(receiver!.factory, entityName), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseJSDocComment","kind":"method","status":"implemented","sigHash":"f880ad6115e4280140e1ce6a6199952ac8a0553d21fc56174a701697e2792d8e","bodyHash":"2680decdbd77a2ff602d6e6fa5da12d48d863f5e9e483af93903822ef6078086"}
 *
 * Go source:
 * func (p *Parser) parseJSDocComment(parent *ast.Node, start int, end int, fullStart int) *ast.Node {
 * 	if end == -1 {
 * 		end = len(p.sourceText)
 * 	}
 * 	// Check for /** (JSDoc opening part)
 * 	if !isJSDocLikeText(p.sourceText[start:]) {
 * 		// TODO: This should be a panic, unless parseSingleJSDocComment is calling this (not ported yet)
 * 		return nil
 * 	}
 *
 * 	saveSourceText := p.sourceText
 * 	saveToken := p.token
 * 	saveContextFlags := p.contextFlags
 * 	saveParsingContexts := p.parsingContexts
 * 	saveScannerState := p.scanner.Mark()
 * 	saveDiagnosticsLength := len(p.diagnostics)
 * 	saveHasParseError := p.hasParseError
 * 	saveHasAwaitIdentifier := p.statementHasAwaitIdentifier
 *
 * 	// initial indent is start+4 to account for leading `/** `
 * 	// + 1 because \n is one character before the first character in the line and,
 * 	// if there is no \n before start, -1 is one index before the first character in the string
 * 	initialIndent := start + 4 - (strings.LastIndex(p.sourceText[:start], "\n") + 1)
 * 	// -2 for trailing `* /`
 * 	p.sourceText = p.sourceText[:end-2]
 * 	p.scanner.SetText(p.sourceText)
 * 	// +3 for leading `/**`
 * 	p.scanner.ResetPos(start + 3)
 * 	p.setContextFlags(ast.NodeFlagsJSDoc, true)
 * 	p.parsingContexts |= 1 << PCJSDocComment
 *
 * 	comment := p.parseJSDocCommentWorker(start, end, fullStart, initialIndent)
 * 	// move jsdoc diagnostics to jsdocDiagnostics -- for JS files only
 * 	if p.contextFlags&ast.NodeFlagsJavaScriptFile != 0 {
 * 		p.jsdocDiagnostics = append(p.jsdocDiagnostics, p.diagnostics[saveDiagnosticsLength:]...)
 * 	}
 * 	p.diagnostics = p.diagnostics[0:saveDiagnosticsLength]
 *
 * 	p.sourceText = saveSourceText
 * 	p.scanner.SetText(p.sourceText)
 * 	p.parsingContexts = saveParsingContexts
 * 	p.contextFlags = saveContextFlags
 * 	p.scanner.Rewind(saveScannerState)
 * 	p.token = saveToken
 * 	p.hasParseError = saveHasParseError
 * 	p.statementHasAwaitIdentifier = saveHasAwaitIdentifier
 *
 * 	return comment
 * }
 */
export function Parser_parseJSDocComment(receiver: GoPtr<Parser>, parent: GoPtr<Node>, start: int, end: int, fullStart: int): GoPtr<Node> {
  if (end === -1) {
    end = byteLen(receiver!.sourceText);
  }
  // Check for /** (JSDoc opening part) — read in place: a materialized tail
  // slice costs a multi-MB decode on lib-sized non-ASCII files.
  if (!isJSDocLikeTextAt(receiver!.sourceText, start)) {
    // TODO: This should be a panic, unless parseSingleJSDocComment is calling this (not ported yet)
    return undefined;
  }

  const saveSourceText = receiver!.sourceText;
  const saveToken = receiver!.token;
  const saveContextFlags = receiver!.contextFlags;
  const saveParsingContexts = receiver!.parsingContexts;
  const saveScannerState: ScannerState = Scanner_Mark(receiver!.scanner);
  const saveScannerEnd = receiver!.scanner!.end;
  const saveDiagnosticsLength = receiver!.diagnostics.length;
  const saveHasParseError = receiver!.hasParseError;
  const saveHasAwaitIdentifier = receiver!.statementHasAwaitIdentifier;

  // initial indent is start+4 to account for leading `/** `
  // + 1 because \n is one character before the first character in the line and,
  // if there is no \n before start, -1 is one index before the first character in the string
  const initialIndent = start + 4 - (lastNewlineBefore(receiver!.sourceText, start) + 1);
  // -2 for trailing `*/`. Keep the original source string/view and narrow only
  // the scanner's active byte end; this mirrors p.sourceText[:end-2] without
  // materializing a prefix string or rebuilding the UTF-8 byte view per JSDoc.
  Scanner_SetTextEnd(receiver!.scanner, receiver!.sourceText, end - 2);
  // +3 for leading `/**`
  Scanner_ResetPos(receiver!.scanner, start + 3);
  Parser_setContextFlags(receiver, NodeFlagsJSDoc, true);
  receiver!.parsingContexts |= 1 << PCJSDocComment;

  const comment = Parser_parseJSDocCommentWorker(receiver, start, end, fullStart, initialIndent);
  // move jsdoc diagnostics to jsdocDiagnostics -- for JS files only
  if ((receiver!.contextFlags & NodeFlagsJavaScriptFile) !== 0) {
    receiver!.jsdocDiagnostics = [...receiver!.jsdocDiagnostics, ...receiver!.diagnostics.slice(saveDiagnosticsLength)];
  }
  receiver!.diagnostics = receiver!.diagnostics.slice(0, saveDiagnosticsLength);

  receiver!.sourceText = saveSourceText;
  Scanner_SetTextEnd(receiver!.scanner, receiver!.sourceText, saveScannerEnd);
  receiver!.parsingContexts = saveParsingContexts;
  receiver!.contextFlags = saveContextFlags;
  Scanner_Rewind(receiver!.scanner, saveScannerState);
  receiver!.token = saveToken;
  receiver!.hasParseError = saveHasParseError;
  receiver!.statementHasAwaitIdentifier = saveHasAwaitIdentifier;

  return comment;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseJSDocCommentWorker","kind":"method","status":"implemented","sigHash":"582b0878c098492c9c6a9465058d854952b30789e43eb30c927c01a586bce4d8","bodyHash":"99ed47ed48785a05be396ce95f68b27835c8993b893ad4b5b50b1e2568de8b58"}
 *
 * Go source:
 * func (p *Parser) parseJSDocCommentWorker(start int, end int, fullStart int, indent int) *ast.Node {
 * 	... (uses p.parseTag, arena-cloned string slices)
 * }
 */
export function Parser_parseJSDocCommentWorker(receiver: GoPtr<Parser>, start: int, end: int, fullStart: int, indent: int): GoPtr<Node> {
  // Initially we can parse out a tag.  We also have seen a starting asterisk.
  // This is so that /** * @type */ doesn't parse.
  let tags: GoSlice<GoPtr<Node>> = Arena_NewSlice(receiver!.nodeSliceArena as GoPtr<Arena<GoPtr<Node>>>, 1).slice(0, 0);
  let tagsPos = -1;
  let tagsEnd = -1;
  let state: jsdocState = jsdocStateSawAsterisk;
  let backtickCount = 0;
  let inFencedCodeBlock = false;
  let commentParts: GoSlice<GoPtr<Node>> = Arena_NewSlice(receiver!.nodeSliceArena as GoPtr<Arena<GoPtr<Node>>>, 1).slice(0, 0);
  let comments: GoSlice<string> = receiver!.jsdocCommentsSpace;
  let commentsPos = -1;
  let linkEnd = start;
  let margin = -1;
  const pushComment = (text: string): void => {
    if (margin === -1) {
      margin = indent;
    }
    comments.push(text);
    indent += text.length;
  };

  Parser_nextTokenJSDoc(receiver);
  while (Parser_parseOptionalJsdoc(receiver, KindWhitespaceTrivia)) {
    // skip
  }
  if (Parser_parseOptionalJsdoc(receiver, KindNewLineTrivia)) {
    state = jsdocStateBeginningOfLine;
    indent = 0;
  }

  loop: for (;;) {
    // Detect fenced code blocks by counting consecutive backtick tokens.
    // Three or more consecutive backticks toggle the fenced code block state.
    if (receiver!.token !== KindBacktickToken && backtickCount > 0) {
      if (backtickCount >= 3) {
        inFencedCodeBlock = !inFencedCodeBlock;
      }
      backtickCount = 0;
    }
    switch (receiver!.token) {
      case KindAtToken:
        if (inFencedCodeBlock || !Scanner_CanFollowJSDocAt(receiver!.scanner)) {
          if (inFencedCodeBlock) {
            state = jsdocStateSavingBackticks;
          } else {
            state = jsdocStateSavingComments;
          }
          pushComment(Scanner_TokenText(receiver!.scanner));
          break;
        }
        comments = removeTrailingWhitespace(comments);
        if (commentsPos === -1) {
          commentsPos = Parser_nodePos(receiver);
        }
        {
          const tag = Parser_parseTag(receiver, tags, indent);
          if (tagsPos === -1) {
            tagsPos = Node_Pos(tag);
          }
          tags.push(tag);
          tagsEnd = Node_End(tag);
        }
        // NOTE: According to usejsdoc.org, a tag goes to end of line, except the last tag.
        state = jsdocStateBeginningOfLine;
        margin = -1;
        break;
      case KindNewLineTrivia:
        comments.push(Scanner_TokenText(receiver!.scanner));
        state = jsdocStateBeginningOfLine;
        indent = 0;
        break;
      case KindAsteriskToken: {
        const asterisk = Scanner_TokenText(receiver!.scanner);
        if (state === jsdocStateSawAsterisk) {
          // If we've already seen an asterisk, then we can no longer parse a tag on this line
          state = jsdocStateSavingComments;
          pushComment(asterisk);
        } else {
          // Ignore the first asterisk on a line
          state = jsdocStateSawAsterisk;
          indent += asterisk.length;
        }
        break;
      }
      case KindWhitespaceTrivia: {
        // only collect whitespace if we're already saving comments or have just crossed the comment indent margin
        const whitespace = Scanner_TokenText(receiver!.scanner);
        if (margin > -1 && indent + whitespace.length > margin) {
          let existingIndent = margin - indent;
          if (existingIndent < 0) {
            existingIndent += whitespace.length;
          }
          if (existingIndent < 0) {
            existingIndent = 0;
          }
          comments.push(whitespace.slice(existingIndent));
        }
        indent += whitespace.length;
        break;
      }
      case KindEndOfFile:
        break loop;
      case KindJSDocCommentTextToken:
        if (state !== jsdocStateSavingBackticks) {
          if (inFencedCodeBlock) {
            state = jsdocStateSavingBackticks;
          } else {
            state = jsdocStateSavingComments;
          }
        }
        pushComment(Scanner_TokenValue(receiver!.scanner));
        break;
      case KindBacktickToken:
        backtickCount++;
        if (state === jsdocStateSavingBackticks) {
          state = jsdocStateSavingComments;
        } else {
          state = jsdocStateSavingBackticks;
        }
        pushComment(Scanner_TokenText(receiver!.scanner));
        break;
      case KindOpenBraceToken: {
        if (inFencedCodeBlock) {
          state = jsdocStateSavingBackticks;
          pushComment(Scanner_TokenText(receiver!.scanner));
          break;
        }
        state = jsdocStateSavingComments;
        const commentEnd = Scanner_TokenFullStart(receiver!.scanner);
        const linkStart = Scanner_TokenEnd(receiver!.scanner) - 1;
        const link = Parser_parseJSDocLink(receiver, linkStart);
        if (link !== undefined) {
          if (linkEnd === start) {
            comments = removeLeadingNewlines(comments);
          }
          const jsdocText = Parser_finishNodeWithEnd(receiver, NewJSDocText(receiver!.factory, Arena_Clone(receiver!.stringSliceArena as GoPtr<Arena<string>>, comments)), linkEnd, commentEnd);
          commentParts.push(jsdocText!);
          commentParts.push(link!);
          comments = comments.slice(0, 0);
          linkEnd = Scanner_TokenEnd(receiver!.scanner);
          break;
        }
        // fallthrough to default
        if (state !== jsdocStateSavingBackticks) {
          if (inFencedCodeBlock) {
            state = jsdocStateSavingBackticks;
          } else {
            state = jsdocStateSavingComments;
          }
        }
        pushComment(Scanner_TokenText(receiver!.scanner));
        break;
      }
      default:
        // Anything else is doc comment text. We just save it. Because it
        // wasn't a tag, we can no longer parse a tag on this line until we hit the next
        // line break.
        if (state !== jsdocStateSavingBackticks) {
          if (inFencedCodeBlock) {
            state = jsdocStateSavingBackticks;
          } else {
            state = jsdocStateSavingComments;
          }
        }
        pushComment(Scanner_TokenText(receiver!.scanner));
        break;
    }
    if (state === jsdocStateSavingComments || state === jsdocStateSavingBackticks) {
      Parser_nextJSDocCommentTextToken(receiver, state === jsdocStateSavingBackticks);
    } else {
      Parser_nextTokenJSDoc(receiver);
    }
  }

  receiver!.jsdocCommentsSpace = comments.slice(0, 0); // Reuse this slice for further parses
  if (commentsPos === -1) {
    commentsPos = Scanner_TokenFullStart(receiver!.scanner);
  }

  if (comments.length > 0) {
    comments[comments.length - 1] = comments[comments.length - 1]!.replace(/\s+$/, "");
    const jsdocText = Parser_finishNodeWithEnd(receiver, NewJSDocText(receiver!.factory, Arena_Clone(receiver!.stringSliceArena as GoPtr<Arena<string>>, comments)), linkEnd, commentsPos);
    commentParts.push(jsdocText!);
  }

  let tagsNodeList: GoPtr<NodeList>;
  if (tagsPos !== -1) {
    tagsNodeList = Parser_newNodeList(receiver, NewTextRange(tagsPos, tagsEnd), tags);
  }

  const jsdocComment = NewJSDoc(receiver!.factory, Parser_newNodeList(receiver, NewTextRange(start, commentsPos), commentParts), tagsNodeList!);
  return Parser_finishNodeWithEnd(receiver, jsdocComment, fullStart, end);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::func::removeLeadingNewlines","kind":"func","status":"implemented","sigHash":"e53d4458ccab413fe97f6b76340d4510be498d3511e51ff5d4b8f15224331b19","bodyHash":"daba3f872841552753a1682b954fb6e50549e91ea48d8d21377e4ccad02343e2"}
 *
 * Go source:
 * func removeLeadingNewlines(comments []string) []string {
 * 	i := 0
 * 	for i < len(comments) && strings.TrimLeft(comments[i], "\r\n") == "" {
 * 		i++
 * 	}
 * 	return comments[i:]
 * }
 */
export function removeLeadingNewlines(comments: GoSlice<string>): GoSlice<string> {
  let i = 0;
  while (i < comments.length && TrimLeft(comments[i]!, "\r\n") === "") {
    i++;
  }
  return comments.slice(i);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::func::trimEnd","kind":"func","status":"implemented","sigHash":"ce781437375976cf04417be31bb79492e7fed9f51fe4fd9c1aab9c93dce32275","bodyHash":"e0bb299e072db21fbbcb34fe0f87641a230a868497110d5fcd25eaf8522fe6dc"}
 *
 * Go source:
 * func trimEnd(s string) string {
 * 	return strings.TrimRightFunc(s, stringutil.IsWhiteSpaceLike)
 * }
 */
export function trimEnd(s: string): string {
  return TrimRightFunc(s, (r: GoRune): bool => IsWhiteSpaceLike(r));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::func::removeTrailingWhitespace","kind":"func","status":"implemented","sigHash":"72419d161f6097cd49ab9a59e1f108736447ad32a9812536557606483e202231","bodyHash":"7b28a499c2f6eb126ae244230e49e8d5a92f83801643dbb94998f19c89de9df0"}
 *
 * Go source:
 * func removeTrailingWhitespace(comments []string) []string {
 * 	end := len(comments)
 * 	for i := len(comments) - 1; i >= 0; i-- {
 * 		trimmed := trimEnd(comments[i])
 * 		if trimmed == "" {
 * 			end = i
 * 		} else {
 * 			comments[i] = trimmed
 * 			break
 * 		}
 * 	}
 * 	return comments[:end]
 * }
 */
export function removeTrailingWhitespace(comments: GoSlice<string>): GoSlice<string> {
  let end = comments.length;
  for (let i = comments.length - 1; i >= 0; i--) {
    const trimmed = trimEnd(comments[i]!);
    if (trimmed === "") {
      end = i;
    } else {
      comments[i] = trimmed;
      break;
    }
  }
  return comments.slice(0, end);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.isNextNonwhitespaceTokenEndOfFile","kind":"method","status":"implemented","sigHash":"8d3a7830fa8ac05ef8b2bf0e9e3c7c17023df2f9a78b10916c8f33c380379903","bodyHash":"8ffa2f52f2880c804dc74c19c10c2a40cbb9b605c9eb46faf98ca91b47a79c8e"}
 *
 * Go source:
 * func (p *Parser) isNextNonwhitespaceTokenEndOfFile() bool {
 * 	// We must use infinite lookahead, as there could be any number of newlines :(
 * 	for {
 * 		p.nextTokenJSDoc()
 * 		if p.token == ast.KindEndOfFile {
 * 			return true
 * 		}
 * 		if !(p.token == ast.KindWhitespaceTrivia || p.token == ast.KindNewLineTrivia) {
 * 			return false
 * 		}
 * 	}
 * }
 */
export function Parser_isNextNonwhitespaceTokenEndOfFile(receiver: GoPtr<Parser>): bool {
  for (;;) {
    Parser_nextTokenJSDoc(receiver);
    if (receiver!.token === KindEndOfFile) {
      return true;
    }
    if (!(receiver!.token === KindWhitespaceTrivia || receiver!.token === KindNewLineTrivia)) {
      return false;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.skipWhitespace","kind":"method","status":"implemented","sigHash":"3560d64c88c513ca168edb18846de9112f1e9d7048ced6c35e75e8d12eaf4c0b","bodyHash":"142398e8b6d8634e866d1f94d6a85f1120d22dfb3f075d50eade6a7d7034e452"}
 *
 * Go source:
 * func (p *Parser) skipWhitespace() {
 * 	if p.token == ast.KindWhitespaceTrivia || p.token == ast.KindNewLineTrivia {
 * 		if p.lookAhead((*Parser).isNextNonwhitespaceTokenEndOfFile) {
 * 			return
 * 			// Don't skip whitespace prior to EoF (or end of comment) - that shouldn't be included in any node's range
 * 		}
 * 	}
 * 	for p.token == ast.KindWhitespaceTrivia || p.token == ast.KindNewLineTrivia {
 * 		p.nextTokenJSDoc()
 * 	}
 * }
 */
export function Parser_skipWhitespace(receiver: GoPtr<Parser>): void {
  if (receiver!.token === KindWhitespaceTrivia || receiver!.token === KindNewLineTrivia) {
    if (Parser_lookAhead(receiver, (p: GoPtr<Parser>): bool => Parser_isNextNonwhitespaceTokenEndOfFile(p))) {
      return;
      // Don't skip whitespace prior to EoF (or end of comment) - that shouldn't be included in any node's range
    }
  }
  while (receiver!.token === KindWhitespaceTrivia || receiver!.token === KindNewLineTrivia) {
    Parser_nextTokenJSDoc(receiver);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.skipWhitespaceOrAsterisk","kind":"method","status":"implemented","sigHash":"0de042524ab666570be5e488a44332482da4c05ad4f6e712dd498e4999384ae3","bodyHash":"43fd335ccfdc45b660bdb85c2722fa774ee453da80122617d2908ebe661c3647"}
 *
 * Go source:
 * func (p *Parser) skipWhitespaceOrAsterisk() string {
 * 	if p.token == ast.KindWhitespaceTrivia || p.token == ast.KindNewLineTrivia {
 * 		if p.lookAhead((*Parser).isNextNonwhitespaceTokenEndOfFile) {
 * 			return ""
 * 			// Don't skip whitespace prior to EoF (or end of comment) - that shouldn't be included in any node's range
 * 		}
 * 	}
 *
 * 	precedingLineBreak := p.scanner.HasPrecedingLineBreak()
 * 	seenLineBreak := false
 * 	indents := make([]string, 0, 4)
 * 	for (precedingLineBreak && p.token == ast.KindAsteriskToken) || p.token == ast.KindWhitespaceTrivia || p.token == ast.KindNewLineTrivia {
 * 		indents = append(indents, p.scanner.TokenText())
 * 		if p.token == ast.KindNewLineTrivia {
 * 			precedingLineBreak = true
 * 			seenLineBreak = true
 * 			indents = indents[:0]
 * 		} else if p.token == ast.KindAsteriskToken {
 * 			precedingLineBreak = false
 * 		}
 * 		p.nextTokenJSDoc()
 * 	}
 * 	if seenLineBreak {
 * 		return strings.Join(indents, "")
 * 	} else {
 * 		return ""
 * 	}
 * }
 */
export function Parser_skipWhitespaceOrAsterisk(receiver: GoPtr<Parser>): string {
  if (receiver!.token === KindWhitespaceTrivia || receiver!.token === KindNewLineTrivia) {
    if (Parser_lookAhead(receiver, (p: GoPtr<Parser>): bool => Parser_isNextNonwhitespaceTokenEndOfFile(p))) {
      return "";
      // Don't skip whitespace prior to EoF (or end of comment) - that shouldn't be included in any node's range
    }
  }

  let precedingLineBreak = Scanner_HasPrecedingLineBreak(receiver!.scanner);
  let seenLineBreak = false;
  let indents: GoSlice<string> = [];
  while ((precedingLineBreak && receiver!.token === KindAsteriskToken) || receiver!.token === KindWhitespaceTrivia || receiver!.token === KindNewLineTrivia) {
    indents.push(Scanner_TokenText(receiver!.scanner));
    if (receiver!.token === KindNewLineTrivia) {
      precedingLineBreak = true;
      seenLineBreak = true;
      indents = indents.slice(0, 0);
    } else if (receiver!.token === KindAsteriskToken) {
      precedingLineBreak = false;
    }
    Parser_nextTokenJSDoc(receiver);
  }
  if (seenLineBreak) {
    return indents.join("");
  } else {
    return "";
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTag","kind":"method","status":"implemented","sigHash":"2ee0b49974131ada9371d804ff8e3483a96aa1072a602069013b40ca94176289","bodyHash":"90f6984f17d8de2caadd8238904bbb638a8194b85326c65dc1e4343742e10350"}
 *
 * Go source: (uses tagName.Text() and many trailing-tag-comment parsers)
 */
export function Parser_parseTag(receiver: GoPtr<Parser>, tags: GoSlice<GoPtr<Node>>, margin: int): GoPtr<Node> {
  const start = Scanner_TokenStart(receiver!.scanner);
  Parser_nextTokenJSDoc(receiver);

  const tagName = Parser_parseJSDocIdentifierName(receiver, Identifier_expected);
  const indentText = Parser_skipWhitespaceOrAsterisk(receiver);

  let tag: GoPtr<Node>;
  switch (Node_Text(tagName)) {
    case "implements":
      tag = Parser_parseImplementsTag(receiver, start, tagName, margin, indentText);
      break;
    case "augments":
    case "extends":
      tag = Parser_parseAugmentsTag(receiver, start, tagName, margin, indentText);
      break;
    case "public":
      tag = Parser_parseSimpleTag(receiver, start, (tn: GoPtr<IdentifierNode>, comments: GoPtr<NodeList>) => NewJSDocPublicTag(receiver!.factory, tn, comments), tagName, margin, indentText);
      break;
    case "private":
      tag = Parser_parseSimpleTag(receiver, start, (tn: GoPtr<IdentifierNode>, comments: GoPtr<NodeList>) => NewJSDocPrivateTag(receiver!.factory, tn, comments), tagName, margin, indentText);
      break;
    case "protected":
      tag = Parser_parseSimpleTag(receiver, start, (tn: GoPtr<IdentifierNode>, comments: GoPtr<NodeList>) => NewJSDocProtectedTag(receiver!.factory, tn, comments), tagName, margin, indentText);
      break;
    case "readonly":
      tag = Parser_parseSimpleTag(receiver, start, (tn: GoPtr<IdentifierNode>, comments: GoPtr<NodeList>) => NewJSDocReadonlyTag(receiver!.factory, tn, comments), tagName, margin, indentText);
      break;
    case "override":
      tag = Parser_parseSimpleTag(receiver, start, (tn: GoPtr<IdentifierNode>, comments: GoPtr<NodeList>) => NewJSDocOverrideTag(receiver!.factory, tn, comments), tagName, margin, indentText);
      break;
    case "deprecated":
      receiver!.hasDeprecatedTag = true;
      tag = Parser_parseSimpleTag(receiver, start, (tn: GoPtr<IdentifierNode>, comments: GoPtr<NodeList>) => NewJSDocDeprecatedTag(receiver!.factory, tn, comments), tagName, margin, indentText);
      break;
    case "this":
      tag = Parser_parseThisTag(receiver, start, tagName, margin, indentText);
      break;
    case "arg":
    case "argument":
    case "param":
      tag = Parser_parseParameterOrPropertyTag(receiver, start, tagName, propertyLikeParseParameter, margin);
      break;
    case "return":
    case "returns":
      tag = Parser_parseReturnTag(receiver, tags, start, tagName, margin, indentText);
      break;
    case "template":
      tag = Parser_parseTemplateTag(receiver, start, tagName, margin, indentText);
      break;
    case "type":
      tag = Parser_parseTypeTag(receiver, tags, start, tagName, margin, indentText);
      break;
    case "typedef":
      tag = Parser_parseTypedefTag(receiver, start, tagName, margin, indentText);
      break;
    case "callback":
      tag = Parser_parseCallbackTag(receiver, start, tagName, margin, indentText);
      break;
    case "overload":
      tag = Parser_parseOverloadTag(receiver, start, tagName, margin, indentText);
      break;
    case "satisfies":
      tag = Parser_parseSatisfiesTag(receiver, start, tagName, margin, indentText);
      break;
    case "see":
      tag = Parser_parseSeeTag(receiver, start, tagName, margin, indentText);
      break;
    case "exception":
    case "throws":
      tag = Parser_parseThrowsTag(receiver, start, tagName, margin, indentText);
      break;
    case "import":
      tag = Parser_parseImportTag(receiver, start, tagName, margin, indentText);
      break;
    default:
      tag = Parser_parseUnknownTag(receiver, start, tagName, margin, indentText);
      break;
  }
  return tag!;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTrailingTagComments","kind":"method","status":"implemented","sigHash":"6f864dc164bc0675b0ed1041623b193560130368935e57c822c9c48d7e8ba62f","bodyHash":"bdeb3e5e8d0d9e531525c9727734190f87ba9c7b5eeca0163fd6723673374e29"}
 *
 * Go source:
 * func (p *Parser) parseTrailingTagComments(pos int, end int, margin int, indentText string) *ast.NodeList {
 * 	// some tags, like typedef and callback, have already parsed their comments earlier
 * 	if len(indentText) == 0 {
 * 		margin += end - pos
 * 	}
 * 	var initialMargin string
 * 	if margin < len(indentText) {
 * 		initialMargin = indentText[margin:]
 * 	}
 * 	return p.parseTagComments(margin, &initialMargin)
 * }
 */
export function Parser_parseTrailingTagComments(receiver: GoPtr<Parser>, pos: int, end: int, margin: int, indentText: string): GoPtr<NodeList> {
  // some tags, like typedef and callback, have already parsed their comments earlier
  let m = margin;
  if (indentText.length === 0) {
    m += end - pos;
  }
  let initialMargin: string | undefined;
  if (m < indentText.length) {
    initialMargin = indentText.slice(m);
  }
  return Parser_parseTagComments(receiver, m, initialMargin);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTagComments","kind":"method","status":"implemented","sigHash":"a6864a465e146657c734aa711bdc59d3613d2e8f704e4664fec203229f84a8dc","bodyHash":"3efea51ab5f10f26b19a8657cd641c241ff4a097d7dd8c4b9274ec32cabd2748"}
 *
 * Go source: (uses arena-cloned string slices: p.stringSliceArena.Clone / p.nodeSliceArena.Clone)
 */
export function Parser_parseTagComments(receiver: GoPtr<Parser>, indent: int, initialMargin: GoPtr<string>): GoPtr<NodeList> {
  const commentsPos = Parser_nodePos(receiver);
  let comments: GoSlice<string> = receiver!.jsdocTagCommentsSpace;
  receiver!.jsdocTagCommentsSpace = [];
  let parts: GoSlice<GoPtr<Node>> = receiver!.jsdocTagCommentsPartsSpace;
  receiver!.jsdocTagCommentsPartsSpace = [];
  let linkEnd = -1;
  let state: jsdocState = jsdocStateBeginningOfLine;
  let backtickCount = 0;
  let inFencedCodeBlock = false;
  let margin = -1;
  const pushComment = (text: string): void => {
    if (margin === -1) {
      margin = indent;
    }
    comments.push(text);
    indent += text.length;
  };

  if (initialMargin !== undefined) {
    // jump straight to saving comments if there is some initial indentation
    if (initialMargin !== "") {
      pushComment(initialMargin);
    }
    state = jsdocStateSawAsterisk;
  }
  let tok = receiver!.token;

  loop: for (;;) {
    // Detect fenced code blocks by counting consecutive backtick tokens.
    // Three or more consecutive backticks toggle the fenced code block state.
    if (tok !== KindBacktickToken && backtickCount > 0) {
      if (backtickCount >= 3) {
        inFencedCodeBlock = !inFencedCodeBlock;
      }
      backtickCount = 0;
    }
    switch (tok) {
      case KindNewLineTrivia:
        state = jsdocStateBeginningOfLine;
        // don't use pushComment here because we want to keep the margin unchanged
        comments.push(Scanner_TokenText(receiver!.scanner));
        indent = 0;
        break;
      case KindAtToken:
        if (!inFencedCodeBlock && Scanner_CanFollowJSDocAt(receiver!.scanner)) {
          Scanner_ResetPos(receiver!.scanner, Scanner_TokenEnd(receiver!.scanner) - 1);
          break loop;
        }
        if (inFencedCodeBlock) {
          state = jsdocStateSavingBackticks;
        } else {
          state = jsdocStateSavingComments;
        }
        pushComment(Scanner_TokenText(receiver!.scanner));
        break;
      case KindEndOfFile:
        // Done
        break loop;
      case KindWhitespaceTrivia: {
        const whitespace = Scanner_TokenText(receiver!.scanner);
        // if the whitespace crosses the margin, take only the whitespace that passes the margin
        if (margin > -1 && indent + whitespace.length > margin) {
          comments.push(whitespace.slice(Math.max(margin - indent, 0)));
          if (inFencedCodeBlock) {
            state = jsdocStateSavingBackticks;
          } else {
            state = jsdocStateSavingComments;
          }
        }
        indent += whitespace.length;
        break;
      }
      case KindOpenBraceToken: {
        if (inFencedCodeBlock) {
          state = jsdocStateSavingBackticks;
          pushComment(Scanner_TokenText(receiver!.scanner));
          break;
        }
        state = jsdocStateSavingComments;
        const commentEnd = Scanner_TokenFullStart(receiver!.scanner);
        const linkStart = Scanner_TokenEnd(receiver!.scanner) - 1;
        const link = Parser_parseJSDocLink(receiver, linkStart);
        if (link !== undefined) {
          const commentStart = linkEnd > -1 ? linkEnd : commentsPos;
          const text = Parser_finishNodeWithEnd(receiver, NewJSDocText(receiver!.factory, Arena_Clone(receiver!.stringSliceArena as GoPtr<Arena<string>>, comments)), commentStart, commentEnd);
          parts.push(text!);
          parts.push(link!);
          comments = comments.slice(0, 0);
          linkEnd = Scanner_TokenEnd(receiver!.scanner);
        } else {
          pushComment(Scanner_TokenText(receiver!.scanner));
        }
        break;
      }
      case KindBacktickToken:
        backtickCount++;
        if (state === jsdocStateSavingBackticks) {
          state = jsdocStateSavingComments;
        } else {
          state = jsdocStateSavingBackticks;
        }
        pushComment(Scanner_TokenText(receiver!.scanner));
        break;
      case KindJSDocCommentTextToken:
        if (state !== jsdocStateSavingBackticks) {
          if (inFencedCodeBlock) {
            state = jsdocStateSavingBackticks;
          } else {
            state = jsdocStateSavingComments;
          }
          // leading identifiers start recording as well
        }
        pushComment(Scanner_TokenValue(receiver!.scanner));
        break;
      case KindAsteriskToken:
        if (state === jsdocStateBeginningOfLine) {
          // leading asterisks start recording on the *next* (non-whitespace) token
          state = jsdocStateSawAsterisk;
          indent += 1;
          break;
        }
        // record the * as a comment
        // fallthrough to default
        if (state !== jsdocStateSavingBackticks) {
          if (inFencedCodeBlock) {
            state = jsdocStateSavingBackticks;
          } else {
            state = jsdocStateSavingComments;
          }
          // leading identifiers start recording as well
        }
        pushComment(Scanner_TokenText(receiver!.scanner));
        break;
      default:
        if (state !== jsdocStateSavingBackticks) {
          if (inFencedCodeBlock) {
            state = jsdocStateSavingBackticks;
          } else {
            state = jsdocStateSavingComments;
          }
          // leading identifiers start recording as well
        }
        pushComment(Scanner_TokenText(receiver!.scanner));
        break;
    }
    if (state === jsdocStateSavingComments || state === jsdocStateSavingBackticks) {
      tok = Parser_nextJSDocCommentTextToken(receiver, state === jsdocStateSavingBackticks);
    } else {
      tok = Parser_nextTokenJSDoc(receiver);
    }
  }

  receiver!.jsdocTagCommentsSpace = comments.slice(0, 0);

  comments = removeLeadingNewlines(comments);
  if (comments.length > 0) {
    const commentStart = linkEnd > -1 ? linkEnd : commentsPos;
    const text = Parser_finishNode(receiver, NewJSDocText(receiver!.factory, Arena_Clone(receiver!.stringSliceArena as GoPtr<Arena<string>>, comments)), commentStart);
    parts.push(text!);
  }

  receiver!.jsdocTagCommentsPartsSpace = parts.slice(0, 0);

  if (parts.length > 0) {
    return Parser_newNodeList(receiver, NewTextRange(commentsPos, Scanner_TokenEnd(receiver!.scanner)), Arena_Clone(receiver!.nodeSliceArena as GoPtr<Arena<GoPtr<Node>>>, parts));
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseJSDocLink","kind":"method","status":"implemented","sigHash":"c6fc4ca70a557927d8391673fff125326a8768d0cda99ce14c7e57d807ec0c95","bodyHash":"d9fbdedf2a08c2b7cba2529cf91c10d1dae2cc63b747b6bbbdf88a1b40777ea4"}
 *
 * Go source:
 * func (p *Parser) parseJSDocLink(start int) *ast.Node {
 * 	state := p.mark()
 * 	linkType, ok := p.parseJSDocLinkPrefix()
 * 	if !ok {
 * 		p.rewind(state)
 * 		return nil
 * 	}
 * 	p.nextTokenJSDoc()
 * 	// start at token after link, then skip any whitespace
 * 	p.skipWhitespace()
 * 	name := p.parseJSDocLinkName()
 * 	var text []string
 * 	for p.token != ast.KindCloseBraceToken && p.token != ast.KindNewLineTrivia && p.token != ast.KindEndOfFile {
 * 		text = append(text, p.scanner.TokenText())
 * 		p.nextTokenJSDoc() // Couldn't this be nextTokenCommentJSDoc?
 * 	}
 * 	var create *ast.Node
 * 	switch linkType {
 * 	case "link":
 * 		create = p.factory.NewJSDocLink(name, text)
 * 	case "linkcode":
 * 		create = p.factory.NewJSDocLinkCode(name, text)
 * 	default:
 * 		create = p.factory.NewJSDocLinkPlain(name, text)
 * 	}
 * 	return p.finishNodeWithEnd(create, start, p.scanner.TokenEnd())
 * }
 */
export function Parser_parseJSDocLink(receiver: GoPtr<Parser>, start: int): GoPtr<Node> {
  const state = Parser_mark(receiver);
  const [linkType, ok] = Parser_parseJSDocLinkPrefix(receiver);
  if (!ok) {
    Parser_rewind(receiver, state);
    return undefined;
  }
  Parser_nextTokenJSDoc(receiver);
  // start at token after link, then skip any whitespace
  Parser_skipWhitespace(receiver);
  const name = Parser_parseJSDocLinkName(receiver);
  const text: GoSlice<string> = [];
  while (receiver!.token !== KindCloseBraceToken && receiver!.token !== KindNewLineTrivia && receiver!.token !== KindEndOfFile) {
    text.push(Scanner_TokenText(receiver!.scanner));
    Parser_nextTokenJSDoc(receiver); // Couldn't this be nextTokenCommentJSDoc?
  }
  let create: GoPtr<Node>;
  switch (linkType) {
    case "link":
      create = NewJSDocLink(receiver!.factory, name, text);
      break;
    case "linkcode":
      create = NewJSDocLinkCode(receiver!.factory, name, text);
      break;
    default:
      create = NewJSDocLinkPlain(receiver!.factory, name, text);
  }
  return Parser_finishNodeWithEnd(receiver, create, start, Scanner_TokenEnd(receiver!.scanner));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseJSDocLinkName","kind":"method","status":"implemented","sigHash":"c5d23009a627225ad71d305c3ddb682c24dce33ebf810522a0b4cc8ef3e716f6","bodyHash":"b95933686f5bf08c99f37130f630ec7bb4a4cf3c042049c6c7b9323a1d641731"}
 *
 * Go source:
 * func (p *Parser) parseJSDocLinkName() *ast.Node {
 * 	if tokenIsIdentifierOrKeyword(p.token) {
 * 		pos := p.nodePos()
 * 		name := p.parseIdentifierName()
 * 		for p.parseOptional(ast.KindDotToken) {
 * 			var right *ast.IdentifierNode
 * 			if p.token == ast.KindPrivateIdentifier {
 * 				right = p.createMissingIdentifier()
 * 			} else {
 * 				right = p.parseIdentifierName()
 * 			}
 * 			name = p.finishNode(p.factory.NewQualifiedName(name, right), pos)
 * 		}
 * 		for p.token == ast.KindPrivateIdentifier {
 * 			p.scanner.ReScanHashToken()
 * 			p.nextTokenJSDoc()
 * 			name = p.finishNode(p.factory.NewQualifiedName(name, p.parseIdentifier()), pos)
 * 		}
 * 		return name
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseJSDocLinkName(receiver: GoPtr<Parser>): GoPtr<Node> {
  if (tokenIsIdentifierOrKeyword(receiver!.token)) {
    const pos = Parser_nodePos(receiver);
    let name = Parser_parseIdentifierName(receiver);
    while (Parser_parseOptional(receiver, KindDotToken)) {
      let right: GoPtr<IdentifierNode>;
      if (receiver!.token === KindPrivateIdentifier) {
        right = Parser_createMissingIdentifier(receiver);
      } else {
        right = Parser_parseIdentifierName(receiver);
      }
      name = Parser_finishNode(receiver, NewQualifiedName(receiver!.factory, name, right), pos);
    }
    while (receiver!.token === KindPrivateIdentifier) {
      Scanner_ReScanHashToken(receiver!.scanner);
      Parser_nextTokenJSDoc(receiver);
      name = Parser_finishNode(receiver, NewQualifiedName(receiver!.factory, name, Parser_parseIdentifier(receiver)), pos);
    }
    return name;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseJSDocLinkPrefix","kind":"method","status":"implemented","sigHash":"4862a147060ed3324447ee7f359217ef3c8bb0b3c0a13c408b4b6ee3f5c68877","bodyHash":"83823574d4d41fda6055989894cd5e42febd7add94dad0a652fc77a031e09829"}
 *
 * Go source:
 * func (p *Parser) parseJSDocLinkPrefix() (string, bool) {
 * 	p.skipWhitespaceOrAsterisk()
 * 	if p.token == ast.KindOpenBraceToken && p.nextTokenJSDoc() == ast.KindAtToken && tokenIsIdentifierOrKeyword(p.nextTokenJSDoc()) {
 * 		kind := p.scanner.TokenValue()
 * 		if isJSDocLinkTag(kind) {
 * 			return kind, true
 * 		}
 * 	}
 * 	return "NONE", false
 * }
 */
export function Parser_parseJSDocLinkPrefix(receiver: GoPtr<Parser>): [string, bool] {
  Parser_skipWhitespaceOrAsterisk(receiver);
  if (receiver!.token === KindOpenBraceToken && Parser_nextTokenJSDoc(receiver) === KindAtToken && tokenIsIdentifierOrKeyword(Parser_nextTokenJSDoc(receiver))) {
    const kind = Scanner_TokenValue(receiver!.scanner);
    if (isJSDocLinkTag(kind)) {
      return [kind, true];
    }
  }
  return ["NONE", false];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::func::isJSDocLinkTag","kind":"func","status":"implemented","sigHash":"c88b158d1d4c22c5b0ee9b66cd59a796172d3c5981c7e209d3911afd19e02751","bodyHash":"a5161ba955b750f56346df645e27757881457928f2fd96300dd97f555d048730"}
 *
 * Go source:
 * func isJSDocLinkTag(kind string) bool {
 * 	return kind == "link" || kind == "linkcode" || kind == "linkplain"
 * }
 */
export function isJSDocLinkTag(kind: string): bool {
  return kind === "link" || kind === "linkcode" || kind === "linkplain";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseUnknownTag","kind":"method","status":"implemented","sigHash":"2b707fde5fd22a2da2889c5858421791e05030e180ccf2c63edb62bfd0cab53e","bodyHash":"eee1fabff869c41b7bcfaaba19155115b7c05e471bb17c666f68b1947440d9bf"}
 *
 * Go source:
 * func (p *Parser) parseUnknownTag(start int, tagName *ast.IdentifierNode, indent int, indentText string) *ast.Node {
 * 	return p.finishNode(p.factory.NewJSDocUnknownTag(tagName, p.parseTrailingTagComments(start, p.nodePos(), indent, indentText)), start)
 * }
 */
export function Parser_parseUnknownTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node> {
  return Parser_finishNode(receiver, NewJSDocUnknownTag(receiver!.factory, tagName, Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), indent, indentText)), start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.tryParseTypeExpression","kind":"method","status":"implemented","sigHash":"ace483611f687cac140624910efbcc1ce9db260b16bce5b209c07b5928582f1a","bodyHash":"3370e6a49cb226ef10dde01ccec5a1191ffb7f5efe42c168bfbdebf6a9fb3e6a"}
 *
 * Go source:
 * func (p *Parser) tryParseTypeExpression() *ast.Node {
 * 	p.skipWhitespaceOrAsterisk()
 * 	if p.token == ast.KindOpenBraceToken {
 * 		return p.parseJSDocTypeExpression(false /*mayOmitBraces* /)
 * 	} else {
 * 		return nil
 * 	}
 * }
 */
export function Parser_tryParseTypeExpression(receiver: GoPtr<Parser>): GoPtr<Node> {
  Parser_skipWhitespaceOrAsterisk(receiver);
  if (receiver!.token === KindOpenBraceToken) {
    return Parser_parseJSDocTypeExpression(receiver, false /*mayOmitBraces*/);
  } else {
    return undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseBracketNameInPropertyAndParamTag","kind":"method","status":"implemented","sigHash":"4afd9600c22b223bb36973d0871d9d3cee4de93aada4e34187d5b76e252c97c8","bodyHash":"901c6124a0b14d47142ad3f06562cccb34d60518d7df172688d35e066a47c15c"}
 *
 * Go source:
 * func (p *Parser) parseBracketNameInPropertyAndParamTag(target propertyLikeParse) (name *ast.EntityName, isBracketed bool) {
 * 	// Looking for something like '[foo]', 'foo', '[foo.bar]' or 'foo.bar'
 * 	isBracketed = p.parseOptionalJsdoc(ast.KindOpenBracketToken)
 * 	if isBracketed {
 * 		p.skipWhitespace()
 * 	}
 * 	// a markdown-quoted name: `arg` is not legal jsdoc, but occurs in the wild
 * 	isBackquoted := p.parseOptionalJsdoc(ast.KindBacktickToken)
 * 	name = p.parseJSDocEntityName(core.IfElse(target == propertyLikeParseParameter, nil, diagnostics.Identifier_expected))
 * 	if isBackquoted {
 * 		p.parseExpectedTokenJSDoc(ast.KindBacktickToken)
 * 	}
 * 	if isBracketed {
 * 		p.skipWhitespace()
 * 		// May have an optional default, e.g. '[foo = 42]'
 * 		if p.parseOptionalToken(ast.KindEqualsToken) != nil {
 * 			p.parseExpression()
 * 		}
 *
 * 		p.parseExpected(ast.KindCloseBracketToken)
 * 	}
 *
 * 	return name, isBracketed
 * }
 */
export function Parser_parseBracketNameInPropertyAndParamTag(receiver: GoPtr<Parser>, target: propertyLikeParse): [GoPtr<EntityName>, bool] {
  // Looking for something like '[foo]', 'foo', '[foo.bar]' or 'foo.bar'
  const isBracketed = Parser_parseOptionalJsdoc(receiver, KindOpenBracketToken);
  if (isBracketed) {
    Parser_skipWhitespace(receiver);
  }
  // a markdown-quoted name: `arg` is not legal jsdoc, but occurs in the wild
  const isBackquoted = Parser_parseOptionalJsdoc(receiver, KindBacktickToken);
  const name = Parser_parseJSDocEntityName(receiver, IfElse<GoPtr<Message>>(target === propertyLikeParseParameter, undefined, Identifier_expected));
  if (isBackquoted) {
    Parser_parseExpectedTokenJSDoc(receiver, KindBacktickToken);
  }
  if (isBracketed) {
    Parser_skipWhitespace(receiver);
    // May have an optional default, e.g. '[foo = 42]'
    if (Parser_parseOptionalToken(receiver, KindEqualsToken) !== undefined) {
      Parser_parseExpression(receiver);
    }

    Parser_parseExpected(receiver, KindCloseBracketToken);
  }

  return [name, isBracketed];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::func::isObjectOrObjectArrayTypeReference","kind":"func","status":"implemented","sigHash":"4f5c566c07833aef7e31cb0628afaf73e9484fbb2f97c9df8b806eb8698f503e","bodyHash":"1b9cdc562b578359bf0502d602e06010c436a8393f30af3c4b2e74b6b5e6ea65"}
 *
 * Go source: (uses node.AsArrayTypeNode().ElementType and ref.TypeName.Text())
 */
export function isObjectOrObjectArrayTypeReference(node: GoPtr<TypeNode>): bool {
  switch (node!.Kind) {
    case KindObjectKeyword:
      return true;
    case KindArrayType:
      return isObjectOrObjectArrayTypeReference(AsArrayTypeNode(node)!.ElementType as GoPtr<TypeNode>);
    default:
      if (IsTypeReferenceNode(node)) {
        const ref = AsTypeReferenceNode(node);
        return IsIdentifier(ref!.TypeName) && Node_Text(ref!.TypeName) === "Object" && ref!.TypeArguments === undefined;
      }
      return false;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseParameterOrPropertyTag","kind":"method","status":"implemented","sigHash":"c1d527e4a71c31007f5c504d9092b440cde7dcccd669fa80eba50fc8120b8124","bodyHash":"7db3c9dda9860fa53ae971f9d0471db4e2a2e10c7a688cc645d268dcb2903952"}
 *
 * Go source: (uses parseNestedTypeLiteral / parseTrailingTagComments)
 */
export function Parser_parseParameterOrPropertyTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, target: propertyLikeParse, indent: int): GoPtr<Node> {
  let typeExpression = Parser_tryParseTypeExpression(receiver);
  const isNameFirst = typeExpression === undefined;
  Parser_skipWhitespaceOrAsterisk(receiver);

  const [name, isBracketed] = Parser_parseBracketNameInPropertyAndParamTag(receiver, target);
  const indentText = Parser_skipWhitespaceOrAsterisk(receiver);

  if (isNameFirst && Parser_lookAhead(receiver, (p: GoPtr<Parser>): bool => { const [, ok] = Parser_parseJSDocLinkPrefix(p); return !ok; })) {
    typeExpression = Parser_tryParseTypeExpression(receiver);
  }

  const comment = Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), indent, indentText);

  const nestedTypeLiteral = Parser_parseNestedTypeLiteral(receiver, typeExpression, name, target, indent);
  if (nestedTypeLiteral !== undefined) {
    typeExpression = nestedTypeLiteral;
  }
  const kind: Kind = IfElse<Kind>(target === propertyLikeParseProperty, KindJSDocPropertyTag, KindJSDocParameterTag);
  const result = NewJSDocParameterOrPropertyTag(receiver!.factory, kind, tagName, name, isBracketed, typeExpression as GoPtr<TypeNode>, isNameFirst || nestedTypeLiteral !== undefined, comment);
  return Parser_finishNode(receiver, result, start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseNestedTypeLiteral","kind":"method","status":"implemented","sigHash":"c59f7ee0382abe1caaa8c28de790420f33b055e596509f4c07e5afe2158c6605","bodyHash":"fd2ed57948639a75af3d91dec125a270ab24b1a8e0aba16ada818f1b952fd449"}
 *
 * Go source: (uses typeExpression.Type() and child.TagName().Loc)
 */
export function Parser_parseNestedTypeLiteral(receiver: GoPtr<Parser>, typeExpression: GoPtr<Node>, name: GoPtr<EntityName>, target: propertyLikeParse, indent: int): GoPtr<Node> {
  if (typeExpression !== undefined && isObjectOrObjectArrayTypeReference(Node_Type(typeExpression) as GoPtr<TypeNode>)) {
    const pos = Parser_nodePos(receiver);
    const children: GoSlice<GoPtr<Node>> = [];
    for (;;) {
      const state = Parser_mark(receiver);
      const child = Parser_parseChildParameterOrPropertyTag(receiver, target, indent, name);
      if (child === undefined) {
        Parser_rewind(receiver, state);
        break;
      }
      switch (child!.Kind) {
        case KindJSDocParameterTag:
        case KindJSDocPropertyTag:
          children.push(child);
          break;
        case KindJSDocTemplateTag:
          Parser_parseErrorAtRange(receiver, Node_TagName(child)!.Loc, A_JSDoc_template_tag_may_not_follow_a_typedef_callback_or_overload_tag);
          break;
      }
    }
    if (children.length > 0) {
      const literal = Parser_finishNode(receiver, NewJSDocTypeLiteral(receiver!.factory, children, Node_Type(typeExpression)!.Kind === KindArrayType), pos);
      return Parser_finishNode(receiver, NewJSDocTypeExpression(receiver!.factory, literal as GoPtr<TypeNode>), pos);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseReturnTag","kind":"method","status":"implemented","sigHash":"6491578673ceb6108907c2a933952d4fa68d38ec3348d7937d05ad2e29474dad","bodyHash":"b03d7195134d9d1cfb0499e1e04d90543f376a2aa13d27e3b5e9e43465fbc1f2"}
 *
 * Go source: (uses tagName.Text() and parseTrailingTagComments)
 */
export function Parser_parseReturnTag(receiver: GoPtr<Parser>, previousTags: GoSlice<GoPtr<Node>>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node> {
  if (Some(previousTags, IsJSDocReturnTag)) {
    Parser_parseErrorAt(receiver, Node_Pos(tagName), Scanner_TokenStart(receiver!.scanner), X_0_tag_already_specified, Node_Text(tagName));
  }

  const typeExpression = Parser_tryParseTypeExpression(receiver);
  return Parser_finishNode(receiver, NewJSDocReturnTag(receiver!.factory, tagName, typeExpression as GoPtr<TypeNode>, Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), indent, indentText)), start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTypeTag","kind":"method","status":"implemented","sigHash":"2349d1317667067c0b7600b02473eb3e8b9dffd31b847f37bec66fd38c5bffc3","bodyHash":"59d07509d6201d922b971412447c5b015828c71f14bf46d9b2ff52a6635e33c4"}
 *
 * Go source: (uses tagName.Text() and parseTrailingTagComments)
 */
export function Parser_parseTypeTag(receiver: GoPtr<Parser>, previousTags: GoSlice<GoPtr<Node>>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node> {
  if (Some(previousTags, IsJSDocTypeTag)) {
    Parser_parseErrorAt(receiver, Node_Pos(tagName), Scanner_TokenStart(receiver!.scanner), X_0_tag_already_specified, Node_Text(tagName));
  }

  const typeExpression = Parser_parseJSDocTypeExpression(receiver, true);
  let comments: GoPtr<NodeList>;
  if (indent !== -1) {
    comments = Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), indent, indentText);
  }
  return Parser_finishNode(receiver, NewJSDocTypeTag(receiver!.factory, tagName, typeExpression, comments!), start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseSeeTag","kind":"method","status":"implemented","sigHash":"f733cbb444adbbbe3e9593eea39b9aca5c2d0ae808423d3e644eaa3566cca2c4","bodyHash":"2304947e2f6b8486b4fb6a3009b312188cd67a7a9e8fd314fe150d8dd45397ac"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export function Parser_parseSeeTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node> {
  const hasNameReference = (Parser_isIdentifier(receiver) && !hasAsciiPrefixAt(receiver!.sourceText, Scanner_TokenEnd(receiver!.scanner), "://")) ||
    (receiver!.token === KindOpenBraceToken && Parser_lookAhead(receiver, (p: GoPtr<Parser>): bool => Parser_nextTokenIsIdentifierOrKeyword(p)));
  let nameExpression: GoPtr<Node>;
  if (hasNameReference) {
    nameExpression = Parser_parseJSDocNameReference(receiver);
  }
  const comments = Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), indent, indentText);
  return Parser_finishNode(receiver, NewJSDocSeeTag(receiver!.factory, tagName, nameExpression as GoPtr<TypeNode>, comments!), start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseImplementsTag","kind":"method","status":"implemented","sigHash":"06875622725a4ceeec31288b6b045de012dcde0067beeb1f6662ddedfd360e79","bodyHash":"b1541afcf22b034b580c942a65c26fa4effc6fd5c9682f3106b179d6684ada91"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export function Parser_parseImplementsTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, margin: int, indentText: string): GoPtr<Node> {
  const className = Parser_parseExpressionWithTypeArgumentsForAugments(receiver);
  return Parser_finishNode(receiver, NewJSDocImplementsTag(receiver!.factory, tagName, className, Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), margin, indentText)!), start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseAugmentsTag","kind":"method","status":"implemented","sigHash":"f1279fcea9b5213917cc93294df2eee310e33254c84254f1060a79da8fa9c53f","bodyHash":"54cd3659041908d0ed05c3449c799bf98fb90abf695085e7368344fd11495348"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export function Parser_parseAugmentsTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, margin: int, indentText: string): GoPtr<Node> {
  const className = Parser_parseExpressionWithTypeArgumentsForAugments(receiver);
  return Parser_finishNode(receiver, NewJSDocAugmentsTag(receiver!.factory, tagName, className, Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), margin, indentText)!), start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseSatisfiesTag","kind":"method","status":"implemented","sigHash":"01d516ec22ee779accaa39283ed15a76cf1bffdb2b167d5c63b610d45bec7483","bodyHash":"36c8e0356b3282f6fd1d6911a684e2f6b52ed69ae6fbd55e3e96970b5d3a8e1b"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export function Parser_parseSatisfiesTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, margin: int, indentText: string): GoPtr<Node> {
  const typeExpression = Parser_parseJSDocTypeExpression(receiver, false);
  const comments = Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), margin, indentText);
  return Parser_finishNode(receiver, NewJSDocSatisfiesTag(receiver!.factory, tagName, typeExpression as GoPtr<TypeNode>, comments!), start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseThrowsTag","kind":"method","status":"implemented","sigHash":"6e6a885e0f2ae2822e5f24f917c1475bd6ddc38010d00a619a07f67a280510de","bodyHash":"dd555f80f274b9bacab720bc59cfd589ea60c06a53128e006b0cbd075b496dcf"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export function Parser_parseThrowsTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, margin: int, indentText: string): GoPtr<Node> {
  const typeExpression = Parser_tryParseTypeExpression(receiver);
  const comment = Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), margin, indentText);
  return Parser_finishNode(receiver, NewJSDocThrowsTag(receiver!.factory, tagName, typeExpression as GoPtr<TypeNode>, comment!), start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseImportTag","kind":"method","status":"implemented","sigHash":"3fee6b8292a484a3fb35f9e880b3e68bfa9348b036c10cd5d675f0eb8a7a8a38","bodyHash":"ca679c17c1c517daf81d1bb0fe9fca67e44c97936f3ddfc324edd2710f92174f"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export function Parser_parseImportTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, margin: int, indentText: string): GoPtr<Node> {
  const afterImportTagPos = Scanner_TokenFullStart(receiver!.scanner);

  let identifier: GoPtr<IdentifierNode>;
  if (Parser_isIdentifier(receiver)) {
    identifier = Parser_parseIdentifier(receiver) as GoPtr<IdentifierNode>;
  }

  const importClause = Parser_tryParseImportClause(receiver, identifier, afterImportTagPos, KindTypeKeyword, true /*skipJSDocLeadingAsterisks*/);
  const moduleSpecifier = Parser_parseModuleSpecifier(receiver);
  const attributes = Parser_tryParseImportAttributes(receiver);

  const comments = Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), margin, indentText);
  return Parser_finishNode(receiver, NewJSDocImportTag(receiver!.factory, tagName, importClause, moduleSpecifier, attributes, comments!), start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseExpressionWithTypeArgumentsForAugments","kind":"method","status":"implemented","sigHash":"3dabfe18e8283922a13028de155010bc9d872fc4af33364a2c0d2a2158dc3227","bodyHash":"c1185201a6261fb44c81faa6663b3b5ac2170427f4a2a164726e7abdeb95fccb"}
 *
 * Go source:
 * func (p *Parser) parseExpressionWithTypeArgumentsForAugments() *ast.Node {
 * 	usedBrace := p.parseOptional(ast.KindOpenBraceToken)
 * 	pos := p.nodePos()
 * 	expression := p.parsePropertyAccessEntityNameExpression()
 * 	p.scanner.SetSkipJSDocLeadingAsterisks(true)
 * 	typeArguments := p.parseTypeArguments()
 * 	p.scanner.SetSkipJSDocLeadingAsterisks(false)
 * 	node := p.finishNode(p.factory.NewExpressionWithTypeArguments(expression, typeArguments), pos)
 * 	if usedBrace {
 * 		p.skipWhitespace()
 * 		p.parseExpected(ast.KindCloseBraceToken)
 * 	}
 * 	return node
 * }
 */
export function Parser_parseExpressionWithTypeArgumentsForAugments(receiver: GoPtr<Parser>): GoPtr<Node> {
  const usedBrace = Parser_parseOptional(receiver, KindOpenBraceToken);
  const pos = Parser_nodePos(receiver);
  const expression = Parser_parsePropertyAccessEntityNameExpression(receiver);
  Scanner_SetSkipJSDocLeadingAsterisks(receiver!.scanner, true);
  const typeArguments = Parser_parseTypeArguments(receiver);
  Scanner_SetSkipJSDocLeadingAsterisks(receiver!.scanner, false);
  const node = Parser_finishNode(receiver, NewExpressionWithTypeArguments(receiver!.factory, expression, typeArguments), pos);
  if (usedBrace) {
    Parser_skipWhitespace(receiver);
    Parser_parseExpected(receiver, KindCloseBraceToken);
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parsePropertyAccessEntityNameExpression","kind":"method","status":"implemented","sigHash":"70502df77a1cd713f9a0182d7d6432ac90657d3554c87ee93df2968120cdd8e9","bodyHash":"612a3bf1c3c2fd92c318a79f1fc71885c8c7d18a246e307a80b1e617cc57d621"}
 *
 * Go source:
 * func (p *Parser) parsePropertyAccessEntityNameExpression() *ast.Node {
 * 	pos := p.nodePos()
 * 	node := p.parseJSDocIdentifierName(diagnostics.Identifier_expected)
 * 	for p.parseOptional(ast.KindDotToken) {
 * 		name := p.parseJSDocIdentifierName(diagnostics.Identifier_expected)
 * 		node = p.finishNode(p.factory.NewPropertyAccessExpression(node, nil, name, ast.NodeFlagsNone), pos)
 * 	}
 * 	return node
 * }
 */
export function Parser_parsePropertyAccessEntityNameExpression(receiver: GoPtr<Parser>): GoPtr<Node> {
  const pos = Parser_nodePos(receiver);
  let node = Parser_parseJSDocIdentifierName(receiver, Identifier_expected);
  while (Parser_parseOptional(receiver, KindDotToken)) {
    const name = Parser_parseJSDocIdentifierName(receiver, Identifier_expected);
    node = Parser_finishNode(receiver, NewPropertyAccessExpression(receiver!.factory, node, undefined, name, NodeFlagsNone), pos);
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseSimpleTag","kind":"method","status":"implemented","sigHash":"0fa7d14d798a66fe0ddb91610d0b26e1dffb43851310f682b2ede94a8cadf1e8","bodyHash":"d76afe493cc550dc21eea24d88085626c8c150332a5ee1eaad94a592f7349286"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export function Parser_parseSimpleTag(receiver: GoPtr<Parser>, start: int, createTag: (tagName: GoPtr<IdentifierNode>, comment: GoPtr<NodeList>) => GoPtr<Node>, tagName: GoPtr<IdentifierNode>, margin: int, indentText: string): GoPtr<Node> {
  return Parser_finishNode(receiver, createTag(tagName, Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), margin, indentText)!), start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseThisTag","kind":"method","status":"implemented","sigHash":"f1ce0385f28356b3d02dc3020e1b166e28245756ab72d43dd2000fb903786213","bodyHash":"ee85f94bfb60ec08ef5846d576d9188bc51247deab23898acad919f823499f51"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export function Parser_parseThisTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, margin: int, indentText: string): GoPtr<Node> {
  const typeExpression = Parser_parseJSDocTypeExpression(receiver, true);
  Parser_skipWhitespace(receiver);
  const result = NewJSDocThisTag(receiver!.factory, tagName, typeExpression as GoPtr<TypeNode>, Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), margin, indentText)!);
  return Parser_finishNode(receiver, result, start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseJSDocTypeNameWithNamespace","kind":"method","status":"implemented","sigHash":"8cf37a6d3032c3b8f7a3e4e1abfa3a0d3187da60c74289a8386701edf1d18cab","bodyHash":"530eed71be2bef460028c9bdb2762ce678082c8cafd3ee661740e7ec35b3485e"}
 *
 * Go source:
 * func (p *Parser) parseJSDocTypeNameWithNamespace(nested bool) *ast.Node {
 * 	start := p.scanner.TokenStart()
 * 	if !tokenIsIdentifierOrKeyword(p.token) {
 * 		return nil
 * 	}
 * 	typeNameOrNamespaceName := p.parseJSDocIdentifierName(nil)
 * 	if p.parseOptionalJsdoc(ast.KindDotToken) {
 * 		body := p.parseJSDocTypeNameWithNamespace(true /*nested* /)
 * 		jsDocNamespaceNode := p.factory.NewModuleDeclaration(
 * 			nil,                      /*modifiers* /
 * 			ast.KindNamespaceKeyword, /*keyword* /
 * 			typeNameOrNamespaceName,
 * 			body,
 * 		)
 * 		if nested {
 * 			jsDocNamespaceNode.Flags |= ast.NodeFlagsNestedNamespace
 * 		}
 * 		return p.finishNode(jsDocNamespaceNode, start)
 * 	}
 * 	if nested {
 * 		typeNameOrNamespaceName.Flags |= ast.NodeFlagsIdentifierIsInJSDocNamespace
 * 	}
 * 	return typeNameOrNamespaceName
 * }
 */
export function Parser_parseJSDocTypeNameWithNamespace(receiver: GoPtr<Parser>, nested: bool): GoPtr<Node> {
  const start = Scanner_TokenStart(receiver!.scanner);
  if (!tokenIsIdentifierOrKeyword(receiver!.token)) {
    return undefined;
  }
  const typeNameOrNamespaceName = Parser_parseJSDocIdentifierName(receiver, undefined);
  if (Parser_parseOptionalJsdoc(receiver, KindDotToken)) {
    const body = Parser_parseJSDocTypeNameWithNamespace(receiver, true as bool);
    const jsDocNamespaceNode = NewModuleDeclaration(
      receiver!.factory,
      undefined, // modifiers
      KindNamespaceKeyword, // keyword
      typeNameOrNamespaceName,
      body,
    );
    if (nested) {
      jsDocNamespaceNode!.Flags |= NodeFlagsNestedNamespace;
    }
    return Parser_finishNode(receiver, jsDocNamespaceNode, start);
  }
  if (nested) {
    typeNameOrNamespaceName!.Flags |= NodeFlagsIdentifierIsInJSDocNamespace;
  }
  return typeNameOrNamespaceName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTypedefTag","kind":"method","status":"implemented","sigHash":"5d56ed9fa8a5d4d2f7d04ebb717d03b62cf3d34b70138e46b4967dc3679b000f","bodyHash":"a75b3f14dd0bf0c60d37616bce7822a8f51b99e212b535fc7a7c027d044a3197"}
 *
 * Go source: (uses parseJSDocTypeNameWithNamespace / isObjectOrObjectArrayTypeReference / typeExpression.Type() / parseTagComments)
 */
export function Parser_parseTypedefTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node> {
  let typeExpression = Parser_tryParseTypeExpression(receiver);
  Parser_skipWhitespaceOrAsterisk(receiver);
  let fullName = Parser_parseJSDocTypeNameWithNamespace(receiver, false as bool);
  if (fullName === undefined) {
    fullName = Parser_parseJSDocIdentifierName(receiver, Identifier_expected);
  }
  Parser_skipWhitespace(receiver);
  const comment = Parser_parseTagComments(receiver, indent, undefined);

  let end = -1;
  let hasChildren = false;
  if (typeExpression === undefined || isObjectOrObjectArrayTypeReference(Node_Type(typeExpression) as GoPtr<TypeNode>)) {
    let child: GoPtr<Node>;
    let childTypeTag: GoPtr<ReturnType<typeof AsJSDocTypeTag>>;
    let jsdocPropertyTags: GoSlice<GoPtr<Node>> = [];
    for (;;) {
      const state = Parser_mark(receiver);
      child = Parser_parseChildPropertyTag(receiver, indent);
      if (child === undefined) {
        Parser_rewind(receiver, state);
        break;
      }
      hasChildren = true;
      switch (child!.Kind) {
        case KindJSDocTemplateTag:
          Parser_parseErrorAtRange(receiver, Node_TagName(child)!.Loc, A_JSDoc_template_tag_may_not_follow_a_typedef_callback_or_overload_tag);
          break;
        case KindJSDocTypeTag:
          if (childTypeTag === undefined) {
            childTypeTag = AsJSDocTypeTag(child);
          } else {
            const lastError = Parser_parseErrorAtCurrentToken(receiver, A_JSDoc_typedef_comment_may_not_contain_multiple_type_tags);
            if (lastError !== undefined) {
              const related = NewDiagnostic(undefined, NewTextRange(0, 0), The_tag_was_first_specified_here);
              Diagnostic_AddRelatedInfo(lastError, related);
            }
          }
          break;
        default:
          jsdocPropertyTags.push(child!);
          break;
      }
    }
    if (hasChildren) {
      const isArrayType = typeExpression !== undefined && Node_Type(typeExpression)!.Kind === KindArrayType;
      const jsdocTypeLiteral = NewJSDocTypeLiteral(receiver!.factory, jsdocPropertyTags, isArrayType);
      if (childTypeTag !== undefined && childTypeTag!.TypeExpression !== undefined && !isObjectOrObjectArrayTypeReference(Node_Type(childTypeTag!.TypeExpression) as GoPtr<TypeNode>)) {
        typeExpression = childTypeTag!.TypeExpression;
      } else {
        // !!! This differs from Strada but prevents a crash
        let pos = start;
        if (jsdocPropertyTags.length > 0) {
          pos = Node_Pos(jsdocPropertyTags[0]);
        }
        typeExpression = Parser_finishNode(receiver, jsdocTypeLiteral, pos);
      }
      end = Node_End(typeExpression);
    }
  }

  // Only include the characters between the name end and the next token if a comment was actually parsed out
  if (end === -1) {
    if (hasChildren && typeExpression !== undefined) {
      end = Node_End(typeExpression);
    } else if (comment !== undefined) {
      end = Parser_nodePos(receiver);
    } else if (fullName !== undefined) {
      end = Node_End(fullName);
    } else if (typeExpression !== undefined) {
      end = Node_End(typeExpression);
    } else {
      end = Node_End(tagName);
    }
  }

  let finalComment: GoPtr<NodeList> = comment;
  if (comment === undefined) {
    finalComment = Parser_parseTrailingTagComments(receiver, start, end, indent, indentText);
  }

  const typedefTag = Parser_finishNodeWithEnd(receiver, NewJSDocTypedefTag(receiver!.factory, tagName, typeExpression, fullName, finalComment!), start, end);
  if (typeExpression !== undefined) {
    typeExpression!.Parent = typedefTag; // forcibly overwrite parent potentially set by inner type expression parse
  }
  return typedefTag;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseCallbackTagParameters","kind":"method","status":"implemented","sigHash":"4ad87430b3330f13901ca974355508fb4e1cc79ddc839f284d7d84e57f2f282a","bodyHash":"0102bd38e054b7f7c44ca0230f09d97bfc5c458d0db48ebd43d28354cca92da3"}
 *
 * Go source: (uses parseChildParameterOrPropertyTag / child.TagName().Loc)
 */
export function Parser_parseCallbackTagParameters(receiver: GoPtr<Parser>, indent: int): GoPtr<NodeList> {
  let child: GoPtr<Node>;
  const parameters: GoSlice<GoPtr<Node>> = [];
  const pos = Parser_nodePos(receiver);
  for (;;) {
    const state = Parser_mark(receiver);
    child = Parser_parseChildParameterOrPropertyTag(receiver, propertyLikeParseCallbackParameter, indent, undefined);
    if (child === undefined) {
      Parser_rewind(receiver, state);
      break;
    }
    if (child.Kind === KindJSDocTemplateTag) {
      Parser_parseErrorAtRange(receiver, Node_TagName(child)!.Loc, A_JSDoc_template_tag_may_not_follow_a_typedef_callback_or_overload_tag);
    } else {
      parameters.push(child);
    }
  }
  return Parser_newNodeList(receiver, NewTextRange(pos, Parser_nodePos(receiver)), parameters);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseJSDocSignature","kind":"method","status":"implemented","sigHash":"3904620168ad3f97031ea33815eb4b184215bf6de3e5ee72f49a7b5cb519ae8d","bodyHash":"f22fc90581ca99e6f85674a30d8cedf86afc3e05cded37d223ff0c667d934297"}
 *
 * Go source: (uses parseCallbackTagParameters / parseTag)
 */
export function Parser_parseJSDocSignature(receiver: GoPtr<Parser>, start: int, indent: int): GoPtr<Node> {
  const parameters = Parser_parseCallbackTagParameters(receiver, indent);
  let returnTag: GoPtr<Node>;
  const state = Parser_mark(receiver);
  if (Parser_parseOptionalJsdoc(receiver, KindAtToken)) {
    const tag = Parser_parseTag(receiver, [], indent);
    if (tag!.Kind === KindJSDocReturnTag) {
      returnTag = tag;
    }
  }
  if (returnTag === undefined) {
    Parser_rewind(receiver, state);
  }
  return Parser_finishNode(receiver, NewJSDocSignature(receiver!.factory, undefined, parameters as GoPtr<NodeList>, returnTag as GoPtr<TypeNode>), start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseCallbackTag","kind":"method","status":"implemented","sigHash":"cb3bc6c00bfc192275c96cf7ba0b68de671626f1b38670fec99b97c57b7c6055","bodyHash":"51304a04839e0d8aacc720954895beb55637dbca463aa979d56090a8b7103ad4"}
 *
 * Go source: (uses parseJSDocTypeNameWithNamespace / parseTagComments / parseJSDocSignature)
 */
export function Parser_parseCallbackTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node> {
  let fullName = Parser_parseJSDocTypeNameWithNamespace(receiver, false as bool);
  if (fullName === undefined) {
    fullName = Parser_parseJSDocIdentifierName(receiver, Identifier_expected);
  }
  Parser_skipWhitespace(receiver);
  let comment = Parser_parseTagComments(receiver, indent, undefined);
  const typeExpression = Parser_parseJSDocSignature(receiver, Parser_nodePos(receiver), indent);
  if (comment === undefined) {
    comment = Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), indent, indentText);
  }
  const end = comment !== undefined ? Parser_nodePos(receiver) : Node_End(typeExpression);
  return Parser_finishNodeWithEnd(receiver, NewJSDocCallbackTag(receiver!.factory, tagName, typeExpression as GoPtr<TypeNode>, fullName, comment!), start, end);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseOverloadTag","kind":"method","status":"implemented","sigHash":"386780e260b3597c399fe60ab174d15f5b4ec704302ff81c9e8e6a229034aa13","bodyHash":"b0c7c256c9ae1e4902582b80ccda679646183fde0f496ba67c3e042f46f6f393"}
 *
 * Go source: (uses parseTagComments / parseJSDocSignature)
 */
export function Parser_parseOverloadTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node> {
  Parser_skipWhitespace(receiver);
  let comment = Parser_parseTagComments(receiver, indent, undefined);
  const typeExpression = Parser_parseJSDocSignature(receiver, start, indent);
  if (comment === undefined) {
    comment = Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), indent, indentText);
  }
  const end = comment !== undefined ? Parser_nodePos(receiver) : Node_End(typeExpression);
  return Parser_finishNodeWithEnd(receiver, NewJSDocOverloadTag(receiver!.factory, tagName, typeExpression as GoPtr<TypeNode>, comment!), start, end);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::func::textsEqual","kind":"func","status":"implemented","sigHash":"187dca3f1d3c550954abc643ba1eb68a6b9953e48f7cc80140fd3ffc097176a6","bodyHash":"8e643117b3c5cb1f51eebec1125b468d5e8a5a77b7b3965081244ca0cc7b2578"}
 *
 * Go source: (uses a.AsQualifiedName().Right.Text() and a.Text())
 */
export function textsEqual(a: GoPtr<EntityName>, b: GoPtr<EntityName>): bool {
  for (;;) {
    if (!IsIdentifier(a) || !IsIdentifier(b)) {
      if (!IsIdentifier(a) && !IsIdentifier(b) && Node_Text(AsQualifiedName(a)!.Right) === Node_Text(AsQualifiedName(b)!.Right)) {
        a = AsQualifiedName(a)!.Left;
        b = AsQualifiedName(b)!.Left;
      } else {
        return false as bool;
      }
    } else {
      break;
    }
  }
  return (Node_Text(a) === Node_Text(b)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseChildPropertyTag","kind":"method","status":"implemented","sigHash":"862487a9029694223b51e19e6c98331b659f6968ab2d83f2a1151ff1b838ecdf","bodyHash":"2d2d102ce12c56d7cf1ee81957726275e477a9a779af49ff1c5ebeacd66faa49"}
 *
 * Go source:
 * func (p *Parser) parseChildPropertyTag(indent int) *ast.Node {
 * 	return p.parseChildParameterOrPropertyTag(propertyLikeParseProperty, indent, nil)
 * }
 */
export function Parser_parseChildPropertyTag(receiver: GoPtr<Parser>, indent: int): GoPtr<Node> {
  return Parser_parseChildParameterOrPropertyTag(receiver, propertyLikeParseProperty, indent, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseChildParameterOrPropertyTag","kind":"method","status":"implemented","sigHash":"efe568b14a7e0a40fef1206589beb4ebc3c02fba71293ffd1166550dc373b576","bodyHash":"4d5217b6ea6215a821af142031eda4489c8325706c4e2402d3c9a95190d50fba"}
 *
 * Go source: (uses textsEqual / child.Name() / child.Kind)
 */
export function Parser_parseChildParameterOrPropertyTag(receiver: GoPtr<Parser>, target: propertyLikeParse, indent: int, name: GoPtr<EntityName>): GoPtr<Node> {
  let canParseTag = true;
  let seenAsterisk = false;
  for (;;) {
    switch (Parser_nextTokenJSDoc(receiver)) {
      case KindAtToken:
        if (canParseTag && Scanner_CanFollowJSDocAt(receiver!.scanner)) {
          const child = Parser_tryParseChildTag(receiver, target, indent);
          if (child !== undefined && name !== undefined &&
            (child.Kind === KindJSDocParameterTag || child.Kind === KindJSDocPropertyTag) &&
            (IsIdentifier(Node_Name(child)) || !textsEqual(name, AsQualifiedName(Node_Name(child))!.Left))) {
            return undefined;
          }
          return child;
        }
        seenAsterisk = false;
        break;
      case KindNewLineTrivia:
        canParseTag = true;
        seenAsterisk = false;
        break;
      case KindAsteriskToken:
        if (seenAsterisk) {
          canParseTag = false;
        }
        seenAsterisk = true;
        break;
      case KindIdentifier:
        canParseTag = false;
        break;
      case KindEndOfFile:
        return undefined;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.tryParseChildTag","kind":"method","status":"implemented","sigHash":"88dc5cb321a70b88417f72c9f69f1ad92c234c6259bea3da55a5e75b80f33aa7","bodyHash":"6a3ff17a7e2e7c1fcda5a9ca09f3b5334761661e0d52b3d64f2f52b420a10cf4"}
 *
 * Go source: (uses tagName.Text())
 */
export function Parser_tryParseChildTag(receiver: GoPtr<Parser>, target: propertyLikeParse, indent: int): GoPtr<Node> {
  if (receiver!.token !== KindAtToken) {
    throw new globalThis.Error("should only be called when at @");
  }
  const start = Scanner_TokenFullStart(receiver!.scanner);
  Parser_nextTokenJSDoc(receiver);

  const tagName = Parser_parseJSDocIdentifierName(receiver, Identifier_expected);
  const indentText = Parser_skipWhitespaceOrAsterisk(receiver);
  let t: propertyLikeParse;
  switch (Node_Text(tagName)) {
    case "type":
      if (target === propertyLikeParseProperty) {
        return Parser_parseTypeTag(receiver, [], start, tagName, -1, "");
      }
      break;
    case "prop":
    case "property":
      t = propertyLikeParseProperty;
      break;
    case "arg":
    case "argument":
    case "param":
      t = propertyLikeParseParameter | propertyLikeParseCallbackParameter;
      break;
    case "template":
      return Parser_parseTemplateTag(receiver, start, tagName, indent, indentText);
    case "this":
      return Parser_parseThisTag(receiver, start, tagName, indent, indentText);
    default:
      return undefined;
  }
  if ((target & t!) === 0) {
    return undefined;
  }
  return Parser_parseParameterOrPropertyTag(receiver, start, tagName, target, indent);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTemplateTagTypeParameter","kind":"method","status":"implemented","sigHash":"deef519dbbae989e3c31f9127b46ef873cfc760ae17a5c1cf76f420790a1673c","bodyHash":"c25356eb0bd20e24a4445930ddb67922d4af9e200e50d32eb0da87d38ca9c2bd"}
 *
 * Go source: (uses ast.NodeIsMissing -- not yet ported in the AST layer)
 */
export function Parser_parseTemplateTagTypeParameter(receiver: GoPtr<Parser>): GoPtr<Node> {
  const typeParameterPos = Parser_nodePos(receiver);
  const isBracketed = Parser_parseOptionalJsdoc(receiver, KindOpenBracketToken);
  if (isBracketed) {
    Parser_skipWhitespace(receiver);
  }

  const modifiers = Parser_parseModifiersEx(receiver, false, true, false);
  const name = Parser_parseJSDocIdentifierName(receiver, Unexpected_token_A_type_parameter_name_was_expected_without_curly_braces);
  let defaultType: GoPtr<Node>;
  if (isBracketed) {
    Parser_skipWhitespace(receiver);
    Parser_parseExpected(receiver, KindEqualsToken);
    const saveContextFlags = receiver!.contextFlags;
    Parser_setContextFlags(receiver, NodeFlagsJSDoc, true);
    defaultType = Parser_parseJSDocType(receiver);
    receiver!.contextFlags = saveContextFlags;
    Parser_parseExpected(receiver, KindCloseBracketToken);
  }

  if (NodeIsMissing(name)) {
    return undefined;
  }
  return Parser_finishNode(receiver, NewTypeParameterDeclaration(receiver!.factory, modifiers, name, undefined, undefined, defaultType as GoPtr<TypeNode>), typeParameterPos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTemplateTagTypeParameters","kind":"method","status":"implemented","sigHash":"85b9f38c4f8ba05631dae52ecfcee50aa5b829d336c11d99025c5231abd22590","bodyHash":"9d79d578b7413d7a68d177821b1d93e3a06471fd46b247836bd586aa07120974"}
 *
 * Go source: (uses parseTemplateTagTypeParameter)
 */
export function Parser_parseTemplateTagTypeParameters(receiver: GoPtr<Parser>): GoPtr<TypeParameterList> {
  const pos = Parser_nodePos(receiver);
  const nodes: GoSlice<GoPtr<Node>> = [];
  do {
    Parser_skipWhitespace(receiver);
    const node = Parser_parseTemplateTagTypeParameter(receiver);
    if (node !== undefined) {
      nodes.push(node);
    }
    Parser_skipWhitespaceOrAsterisk(receiver);
  } while (Parser_parseOptionalJsdoc(receiver, KindCommaToken));
  return Parser_newNodeList(receiver, NewTextRange(pos, Parser_nodePos(receiver)), nodes) as GoPtr<TypeParameterList>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTemplateTag","kind":"method","status":"implemented","sigHash":"c25858bf3d7381a0a8a3f24800807ebf870458f1ac65bd2c845b9151a9ad131a","bodyHash":"da1d54ce2dc9878a9207beb30a1b0c50a50404b56c9696de8117fd2fea62f862"}
 *
 * Go source: (uses parseTemplateTagTypeParameters / parseTrailingTagComments)
 */
export function Parser_parseTemplateTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node> {
  let constraint: GoPtr<Node>;
  if (receiver!.token === KindOpenBraceToken) {
    constraint = Parser_parseJSDocTypeExpression(receiver, false);
  }
  const typeParameters = Parser_parseTemplateTagTypeParameters(receiver);
  const result = NewJSDocTemplateTag(receiver!.factory, tagName, constraint, typeParameters, Parser_parseTrailingTagComments(receiver, start, Parser_nodePos(receiver), indent, indentText));
  return Parser_finishNode(receiver, result, start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseOptionalJsdoc","kind":"method","status":"implemented","sigHash":"952acb5e21493cf936681b28cc21f21b73666328d82dd2efcf312dac2948f408","bodyHash":"936330d17cd554cb4a3b674dce9f163e2314e49d6de02abfe2601c9e767d210c"}
 *
 * Go source:
 * func (p *Parser) parseOptionalJsdoc(t ast.Kind) bool {
 * 	if p.token == t {
 * 		p.nextTokenJSDoc()
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Parser_parseOptionalJsdoc(receiver: GoPtr<Parser>, t: Kind): bool {
  if (receiver!.token === t) {
    Parser_nextTokenJSDoc(receiver);
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseJSDocEntityName","kind":"method","status":"implemented","sigHash":"da0001ef6ec58eab4ce7bf0d9b8fa7b1d871c1d7cbd20cf8c46560c05ac3bda5","bodyHash":"f668e975482bfda197d6f7cb1779c057b49fb9fe3d0c58dfef98765b1a9278d9"}
 *
 * Go source:
 * func (p *Parser) parseJSDocEntityName(diagnosticMessage *diagnostics.Message) *ast.EntityName {
 * 	var entity *ast.EntityName = p.parseJSDocIdentifierName(diagnosticMessage)
 * 	if p.parseOptional(ast.KindOpenBracketToken) {
 * 		p.parseExpected(ast.KindCloseBracketToken)
 * 		// Note that y[] is accepted as an entity name, but the postfix brackets are not saved for checking.
 * 		// Technically usejsdoc.org requires them for specifying a property of a type equivalent to Array<{ x: ...}>
 * 		// but it's not worth it to enforce that restriction.
 * 	}
 * 	for p.parseOptional(ast.KindDotToken) {
 * 		name := p.parseJSDocIdentifierName(diagnostics.Identifier_expected)
 * 		if p.parseOptional(ast.KindOpenBracketToken) {
 * 			p.parseExpected(ast.KindCloseBracketToken)
 * 		}
 * 		pos := entity.Pos()
 * 		entity = p.finishNode(p.factory.NewQualifiedName(entity, name), pos)
 * 	}
 * 	return entity
 * }
 */
export function Parser_parseJSDocEntityName(receiver: GoPtr<Parser>, diagnosticMessage: GoPtr<Message>): GoPtr<EntityName> {
  let entity: GoPtr<EntityName> = Parser_parseJSDocIdentifierName(receiver, diagnosticMessage);
  if (Parser_parseOptional(receiver, KindOpenBracketToken)) {
    Parser_parseExpected(receiver, KindCloseBracketToken);
    // Note that y[] is accepted as an entity name, but the postfix brackets are not saved for checking.
    // Technically usejsdoc.org requires them for specifying a property of a type equivalent to Array<{ x: ...}>
    // but it's not worth it to enforce that restriction.
  }
  while (Parser_parseOptional(receiver, KindDotToken)) {
    const name = Parser_parseJSDocIdentifierName(receiver, Identifier_expected);
    if (Parser_parseOptional(receiver, KindOpenBracketToken)) {
      Parser_parseExpected(receiver, KindCloseBracketToken);
    }
    const pos = Node_Pos(entity);
    entity = Parser_finishNode(receiver, NewQualifiedName(receiver!.factory, entity, name), pos);
  }
  return entity;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseJSDocIdentifierName","kind":"method","status":"implemented","sigHash":"240b1f89a198d3da528ea84d549ceff2422c09700dfc9389d7cfbe4e18b7c993","bodyHash":"fcaba98d153235a4695fc8f94167b93ae89ff3283b8d8b3acaa7ebadb48ebf48"}
 *
 * Go source:
 * func (p *Parser) parseJSDocIdentifierName(diagnosticMessage *diagnostics.Message) *ast.IdentifierNode {
 * 	if !tokenIsIdentifierOrKeyword(p.token) {
 * 		if diagnosticMessage != nil {
 * 			p.parseErrorAtCurrentToken(diagnosticMessage)
 * 		} else if isReservedWord(p.token) {
 * 			p.parseErrorAtCurrentToken(diagnostics.Identifier_expected_0_is_a_reserved_word_that_cannot_be_used_here, p.scanner.TokenText())
 * 		}
 * 		return p.finishNode(p.newIdentifier(""), p.nodePos())
 * 	}
 * 	pos := p.scanner.TokenStart()
 * 	end := p.scanner.TokenEnd()
 * 	text := p.scanner.TokenValue()
 * 	p.internIdentifier(text)
 * 	p.nextTokenJSDoc()
 * 	return p.finishNodeWithEnd(p.newIdentifier(text), pos, end)
 * }
 */
export function Parser_parseJSDocIdentifierName(receiver: GoPtr<Parser>, diagnosticMessage: GoPtr<Message>): GoPtr<IdentifierNode> {
  if (!tokenIsIdentifierOrKeyword(receiver!.token)) {
    if (diagnosticMessage !== undefined) {
      Parser_parseErrorAtCurrentToken(receiver, diagnosticMessage);
    } else if (isReservedWord(receiver!.token)) {
      Parser_parseErrorAtCurrentToken(receiver, Identifier_expected_0_is_a_reserved_word_that_cannot_be_used_here, Scanner_TokenText(receiver!.scanner));
    }
    return Parser_finishNode(receiver, Parser_newIdentifier(receiver, ""), Parser_nodePos(receiver));
  }
  const pos = Scanner_TokenStart(receiver!.scanner);
  const end = Scanner_TokenEnd(receiver!.scanner);
  const text = Scanner_TokenValue(receiver!.scanner);
  Parser_internIdentifier(receiver, text);
  Parser_nextTokenJSDoc(receiver);
  return Parser_finishNodeWithEnd(receiver, Parser_newIdentifier(receiver, text), pos, end);
}
