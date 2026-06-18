import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { Node, NodeList } from "../ast/spine.js";
import type { Kind } from "../ast/generated/kinds.js";
import type { EntityName, IdentifierNode, SourceFileNode, TypeNode, TypeParameterList } from "../ast/generated/unions.js";
import type { Message } from "../diagnostics/diagnostics.js";
import type { jsdocScannerInfo, Parser } from "./parser/state.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::func::init","kind":"func","status":"implemented","sigHash":"deadcfe2223147229491ed97a5eb1b413a0acb92061a6dd7ca510eb6614543db","bodyHash":"96bfb6b01644ae8c4357bfbcdc48104efcf247c2ce7785580737940d751be6d3"}
 *
 * Go source:
 * func init() {
 * 	ast.SetParseJSDocForNode(parseJSDocForNode)
 * }
 */
export declare function init(): void;
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
export declare function parseJSDocForNode(sourceFile: GoPtr<SourceFileNode>, node: GoPtr<Node>): GoSlice<GoPtr<Node>>;
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
export declare const jsdocStateBeginningOfLine: jsdocState;
export declare const jsdocStateSawAsterisk: jsdocState;
export declare const jsdocStateSavingComments: jsdocState;
export declare const jsdocStateSavingBackticks: jsdocState;
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
export declare const propertyLikeParseProperty: propertyLikeParse;
export declare const propertyLikeParseParameter: propertyLikeParse;
export declare const propertyLikeParseCallbackParameter: propertyLikeParse;
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
export declare function Parser_withJSDoc(receiver: GoPtr<Parser>, node: GoPtr<Node>, info: jsdocScannerInfo): GoSlice<GoPtr<Node>>;
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
export declare function Parser_parseJSDocTypeExpression(receiver: GoPtr<Parser>, mayOmitBraces: bool): GoPtr<Node>;
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
export declare function Parser_parseJSDocNameReference(receiver: GoPtr<Parser>): GoPtr<Node>;
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
export declare function Parser_parseJSDocComment(receiver: GoPtr<Parser>, parent: GoPtr<Node>, start: int, end: int, fullStart: int): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseJSDocCommentWorker","kind":"method","status":"implemented","sigHash":"582b0878c098492c9c6a9465058d854952b30789e43eb30c927c01a586bce4d8","bodyHash":"2e5b02f24d4f490f8fdd684eb0c6bf7aa2a163e1c5e4e1d98783a6cc97f51027"}
 *
 * Go source:
 * func (p *Parser) parseJSDocCommentWorker(start int, end int, fullStart int, indent int) *ast.Node {
 * 	... (uses p.parseTag, arena-cloned string slices)
 * }
 */
export declare function Parser_parseJSDocCommentWorker(receiver: GoPtr<Parser>, start: int, end: int, fullStart: int, indent: int): GoPtr<Node>;
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
export declare function removeLeadingNewlines(comments: GoSlice<string>): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::func::trimEnd","kind":"func","status":"implemented","sigHash":"ce781437375976cf04417be31bb79492e7fed9f51fe4fd9c1aab9c93dce32275","bodyHash":"e0bb299e072db21fbbcb34fe0f87641a230a868497110d5fcd25eaf8522fe6dc"}
 *
 * Go source:
 * func trimEnd(s string) string {
 * 	return strings.TrimRightFunc(s, stringutil.IsWhiteSpaceLike)
 * }
 */
export declare function trimEnd(s: string): string;
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
export declare function removeTrailingWhitespace(comments: GoSlice<string>): GoSlice<string>;
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
export declare function Parser_isNextNonwhitespaceTokenEndOfFile(receiver: GoPtr<Parser>): bool;
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
export declare function Parser_skipWhitespace(receiver: GoPtr<Parser>): void;
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
export declare function Parser_skipWhitespaceOrAsterisk(receiver: GoPtr<Parser>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTag","kind":"method","status":"implemented","sigHash":"2ee0b49974131ada9371d804ff8e3483a96aa1072a602069013b40ca94176289","bodyHash":"90f6984f17d8de2caadd8238904bbb638a8194b85326c65dc1e4343742e10350"}
 *
 * Go source: (uses tagName.Text() and many trailing-tag-comment parsers)
 */
export declare function Parser_parseTag(receiver: GoPtr<Parser>, tags: GoSlice<GoPtr<Node>>, margin: int): GoPtr<Node>;
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
export declare function Parser_parseTrailingTagComments(receiver: GoPtr<Parser>, pos: int, end: int, margin: int, indentText: string): GoPtr<NodeList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTagComments","kind":"method","status":"implemented","sigHash":"a6864a465e146657c734aa711bdc59d3613d2e8f704e4664fec203229f84a8dc","bodyHash":"647eaacbdc98b3b54ebf4b55b046e2e13120102953445e8bf90e31a96fe61b26"}
 *
 * Go source: (uses arena-cloned string slices: p.stringSliceArena.Clone / p.nodeSliceArena.Clone)
 */
export declare function Parser_parseTagComments(receiver: GoPtr<Parser>, indent: int, initialMargin: GoPtr<string>): GoPtr<NodeList>;
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
export declare function Parser_parseJSDocLink(receiver: GoPtr<Parser>, start: int): GoPtr<Node>;
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
export declare function Parser_parseJSDocLinkName(receiver: GoPtr<Parser>): GoPtr<Node>;
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
export declare function Parser_parseJSDocLinkPrefix(receiver: GoPtr<Parser>): [string, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::func::isJSDocLinkTag","kind":"func","status":"implemented","sigHash":"c88b158d1d4c22c5b0ee9b66cd59a796172d3c5981c7e209d3911afd19e02751","bodyHash":"a5161ba955b750f56346df645e27757881457928f2fd96300dd97f555d048730"}
 *
 * Go source:
 * func isJSDocLinkTag(kind string) bool {
 * 	return kind == "link" || kind == "linkcode" || kind == "linkplain"
 * }
 */
export declare function isJSDocLinkTag(kind: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseUnknownTag","kind":"method","status":"implemented","sigHash":"2b707fde5fd22a2da2889c5858421791e05030e180ccf2c63edb62bfd0cab53e","bodyHash":"eee1fabff869c41b7bcfaaba19155115b7c05e471bb17c666f68b1947440d9bf"}
 *
 * Go source:
 * func (p *Parser) parseUnknownTag(start int, tagName *ast.IdentifierNode, indent int, indentText string) *ast.Node {
 * 	return p.finishNode(p.factory.NewJSDocUnknownTag(tagName, p.parseTrailingTagComments(start, p.nodePos(), indent, indentText)), start)
 * }
 */
export declare function Parser_parseUnknownTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node>;
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
export declare function Parser_tryParseTypeExpression(receiver: GoPtr<Parser>): GoPtr<Node>;
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
export declare function Parser_parseBracketNameInPropertyAndParamTag(receiver: GoPtr<Parser>, target: propertyLikeParse): [GoPtr<EntityName>, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::func::isObjectOrObjectArrayTypeReference","kind":"func","status":"implemented","sigHash":"4f5c566c07833aef7e31cb0628afaf73e9484fbb2f97c9df8b806eb8698f503e","bodyHash":"1b9cdc562b578359bf0502d602e06010c436a8393f30af3c4b2e74b6b5e6ea65"}
 *
 * Go source: (uses node.AsArrayTypeNode().ElementType and ref.TypeName.Text())
 */
export declare function isObjectOrObjectArrayTypeReference(node: GoPtr<TypeNode>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseParameterOrPropertyTag","kind":"method","status":"implemented","sigHash":"c1d527e4a71c31007f5c504d9092b440cde7dcccd669fa80eba50fc8120b8124","bodyHash":"7db3c9dda9860fa53ae971f9d0471db4e2a2e10c7a688cc645d268dcb2903952"}
 *
 * Go source: (uses parseNestedTypeLiteral / parseTrailingTagComments)
 */
export declare function Parser_parseParameterOrPropertyTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, target: propertyLikeParse, indent: int): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseNestedTypeLiteral","kind":"method","status":"implemented","sigHash":"c59f7ee0382abe1caaa8c28de790420f33b055e596509f4c07e5afe2158c6605","bodyHash":"181b731dcb1b3b23c609d5668fe01800f089662b49db9d166793efb4746130b8"}
 *
 * Go source: (uses typeExpression.Type() and child.TagName().Loc)
 */
export declare function Parser_parseNestedTypeLiteral(receiver: GoPtr<Parser>, typeExpression: GoPtr<Node>, name: GoPtr<EntityName>, target: propertyLikeParse, indent: int): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseReturnTag","kind":"method","status":"implemented","sigHash":"6491578673ceb6108907c2a933952d4fa68d38ec3348d7937d05ad2e29474dad","bodyHash":"b03d7195134d9d1cfb0499e1e04d90543f376a2aa13d27e3b5e9e43465fbc1f2"}
 *
 * Go source: (uses tagName.Text() and parseTrailingTagComments)
 */
export declare function Parser_parseReturnTag(receiver: GoPtr<Parser>, previousTags: GoSlice<GoPtr<Node>>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTypeTag","kind":"method","status":"implemented","sigHash":"2349d1317667067c0b7600b02473eb3e8b9dffd31b847f37bec66fd38c5bffc3","bodyHash":"59d07509d6201d922b971412447c5b015828c71f14bf46d9b2ff52a6635e33c4"}
 *
 * Go source: (uses tagName.Text() and parseTrailingTagComments)
 */
export declare function Parser_parseTypeTag(receiver: GoPtr<Parser>, previousTags: GoSlice<GoPtr<Node>>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseSeeTag","kind":"method","status":"implemented","sigHash":"f733cbb444adbbbe3e9593eea39b9aca5c2d0ae808423d3e644eaa3566cca2c4","bodyHash":"2304947e2f6b8486b4fb6a3009b312188cd67a7a9e8fd314fe150d8dd45397ac"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export declare function Parser_parseSeeTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseImplementsTag","kind":"method","status":"implemented","sigHash":"06875622725a4ceeec31288b6b045de012dcde0067beeb1f6662ddedfd360e79","bodyHash":"b1541afcf22b034b580c942a65c26fa4effc6fd5c9682f3106b179d6684ada91"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export declare function Parser_parseImplementsTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, margin: int, indentText: string): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseAugmentsTag","kind":"method","status":"implemented","sigHash":"f1279fcea9b5213917cc93294df2eee310e33254c84254f1060a79da8fa9c53f","bodyHash":"54cd3659041908d0ed05c3449c799bf98fb90abf695085e7368344fd11495348"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export declare function Parser_parseAugmentsTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, margin: int, indentText: string): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseSatisfiesTag","kind":"method","status":"implemented","sigHash":"01d516ec22ee779accaa39283ed15a76cf1bffdb2b167d5c63b610d45bec7483","bodyHash":"36c8e0356b3282f6fd1d6911a684e2f6b52ed69ae6fbd55e3e96970b5d3a8e1b"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export declare function Parser_parseSatisfiesTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, margin: int, indentText: string): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseThrowsTag","kind":"method","status":"implemented","sigHash":"6e6a885e0f2ae2822e5f24f917c1475bd6ddc38010d00a619a07f67a280510de","bodyHash":"dd555f80f274b9bacab720bc59cfd589ea60c06a53128e006b0cbd075b496dcf"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export declare function Parser_parseThrowsTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, margin: int, indentText: string): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseImportTag","kind":"method","status":"implemented","sigHash":"3fee6b8292a484a3fb35f9e880b3e68bfa9348b036c10cd5d675f0eb8a7a8a38","bodyHash":"ca679c17c1c517daf81d1bb0fe9fca67e44c97936f3ddfc324edd2710f92174f"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export declare function Parser_parseImportTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, margin: int, indentText: string): GoPtr<Node>;
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
export declare function Parser_parseExpressionWithTypeArgumentsForAugments(receiver: GoPtr<Parser>): GoPtr<Node>;
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
export declare function Parser_parsePropertyAccessEntityNameExpression(receiver: GoPtr<Parser>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseSimpleTag","kind":"method","status":"implemented","sigHash":"0fa7d14d798a66fe0ddb91610d0b26e1dffb43851310f682b2ede94a8cadf1e8","bodyHash":"d76afe493cc550dc21eea24d88085626c8c150332a5ee1eaad94a592f7349286"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export declare function Parser_parseSimpleTag(receiver: GoPtr<Parser>, start: int, createTag: (tagName: GoPtr<IdentifierNode>, comment: GoPtr<NodeList>) => GoPtr<Node>, tagName: GoPtr<IdentifierNode>, margin: int, indentText: string): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseThisTag","kind":"method","status":"implemented","sigHash":"f1ce0385f28356b3d02dc3020e1b166e28245756ab72d43dd2000fb903786213","bodyHash":"ee85f94bfb60ec08ef5846d576d9188bc51247deab23898acad919f823499f51"}
 *
 * Go source: (uses parseTrailingTagComments)
 */
export declare function Parser_parseThisTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, margin: int, indentText: string): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTypedefTag","kind":"method","status":"implemented","sigHash":"5d56ed9fa8a5d4d2f7d04ebb717d03b62cf3d34b70138e46b4967dc3679b000f","bodyHash":"0de048995e261c2102341aa3968b1694c2e9c965775b5dd1f3ac210b6dc38f59"}
 *
 * Go source: (uses isObjectOrObjectArrayTypeReference / typeExpression.Type() / parseTagComments)
 */
export declare function Parser_parseTypedefTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseCallbackTagParameters","kind":"method","status":"implemented","sigHash":"4ad87430b3330f13901ca974355508fb4e1cc79ddc839f284d7d84e57f2f282a","bodyHash":"102319cc2b565326e13425dd05e36bd6ffbb497dfdbad1a74908e02ce1efb41a"}
 *
 * Go source: (uses parseChildParameterOrPropertyTag / child.TagName().Loc)
 */
export declare function Parser_parseCallbackTagParameters(receiver: GoPtr<Parser>, indent: int): GoPtr<NodeList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseJSDocSignature","kind":"method","status":"implemented","sigHash":"3904620168ad3f97031ea33815eb4b184215bf6de3e5ee72f49a7b5cb519ae8d","bodyHash":"f22fc90581ca99e6f85674a30d8cedf86afc3e05cded37d223ff0c667d934297"}
 *
 * Go source: (uses parseCallbackTagParameters / parseTag)
 */
export declare function Parser_parseJSDocSignature(receiver: GoPtr<Parser>, start: int, indent: int): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseCallbackTag","kind":"method","status":"implemented","sigHash":"cb3bc6c00bfc192275c96cf7ba0b68de671626f1b38670fec99b97c57b7c6055","bodyHash":"cf909d9bdecb1892bc658acb2b220c629fee98631d55ceedaf90686c034e6125"}
 *
 * Go source: (uses parseTagComments / parseJSDocSignature)
 */
export declare function Parser_parseCallbackTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseOverloadTag","kind":"method","status":"implemented","sigHash":"386780e260b3597c399fe60ab174d15f5b4ec704302ff81c9e8e6a229034aa13","bodyHash":"b0c7c256c9ae1e4902582b80ccda679646183fde0f496ba67c3e042f46f6f393"}
 *
 * Go source: (uses parseTagComments / parseJSDocSignature)
 */
export declare function Parser_parseOverloadTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::func::textsEqual","kind":"func","status":"implemented","sigHash":"187dca3f1d3c550954abc643ba1eb68a6b9953e48f7cc80140fd3ffc097176a6","bodyHash":"8e643117b3c5cb1f51eebec1125b468d5e8a5a77b7b3965081244ca0cc7b2578"}
 *
 * Go source: (uses a.AsQualifiedName().Right.Text() and a.Text())
 */
export declare function textsEqual(a: GoPtr<EntityName>, b: GoPtr<EntityName>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseChildPropertyTag","kind":"method","status":"implemented","sigHash":"862487a9029694223b51e19e6c98331b659f6968ab2d83f2a1151ff1b838ecdf","bodyHash":"2d2d102ce12c56d7cf1ee81957726275e477a9a779af49ff1c5ebeacd66faa49"}
 *
 * Go source:
 * func (p *Parser) parseChildPropertyTag(indent int) *ast.Node {
 * 	return p.parseChildParameterOrPropertyTag(propertyLikeParseProperty, indent, nil)
 * }
 */
export declare function Parser_parseChildPropertyTag(receiver: GoPtr<Parser>, indent: int): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseChildParameterOrPropertyTag","kind":"method","status":"implemented","sigHash":"efe568b14a7e0a40fef1206589beb4ebc3c02fba71293ffd1166550dc373b576","bodyHash":"4d5217b6ea6215a821af142031eda4489c8325706c4e2402d3c9a95190d50fba"}
 *
 * Go source: (uses textsEqual / child.Name() / child.Kind)
 */
export declare function Parser_parseChildParameterOrPropertyTag(receiver: GoPtr<Parser>, target: propertyLikeParse, indent: int, name: GoPtr<EntityName>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.tryParseChildTag","kind":"method","status":"implemented","sigHash":"88dc5cb321a70b88417f72c9f69f1ad92c234c6259bea3da55a5e75b80f33aa7","bodyHash":"6a3ff17a7e2e7c1fcda5a9ca09f3b5334761661e0d52b3d64f2f52b420a10cf4"}
 *
 * Go source: (uses tagName.Text())
 */
export declare function Parser_tryParseChildTag(receiver: GoPtr<Parser>, target: propertyLikeParse, indent: int): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTemplateTagTypeParameter","kind":"method","status":"implemented","sigHash":"deef519dbbae989e3c31f9127b46ef873cfc760ae17a5c1cf76f420790a1673c","bodyHash":"c25356eb0bd20e24a4445930ddb67922d4af9e200e50d32eb0da87d38ca9c2bd"}
 *
 * Go source: (uses ast.NodeIsMissing -- not yet ported in the AST layer)
 */
export declare function Parser_parseTemplateTagTypeParameter(receiver: GoPtr<Parser>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTemplateTagTypeParameters","kind":"method","status":"implemented","sigHash":"85b9f38c4f8ba05631dae52ecfcee50aa5b829d336c11d99025c5231abd22590","bodyHash":"9d79d578b7413d7a68d177821b1d93e3a06471fd46b247836bd586aa07120974"}
 *
 * Go source: (uses parseTemplateTagTypeParameter)
 */
export declare function Parser_parseTemplateTagTypeParameters(receiver: GoPtr<Parser>): GoPtr<TypeParameterList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/jsdoc.go::method::Parser.parseTemplateTag","kind":"method","status":"implemented","sigHash":"c25858bf3d7381a0a8a3f24800807ebf870458f1ac65bd2c845b9151a9ad131a","bodyHash":"da1d54ce2dc9878a9207beb30a1b0c50a50404b56c9696de8117fd2fea62f862"}
 *
 * Go source: (uses parseTemplateTagTypeParameters / parseTrailingTagComments)
 */
export declare function Parser_parseTemplateTag(receiver: GoPtr<Parser>, start: int, tagName: GoPtr<IdentifierNode>, indent: int, indentText: string): GoPtr<Node>;
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
export declare function Parser_parseOptionalJsdoc(receiver: GoPtr<Parser>, t: Kind): bool;
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
export declare function Parser_parseJSDocEntityName(receiver: GoPtr<Parser>, diagnosticMessage: GoPtr<Message>): GoPtr<EntityName>;
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
export declare function Parser_parseJSDocIdentifierName(receiver: GoPtr<Parser>, diagnosticMessage: GoPtr<Message>): GoPtr<IdentifierNode>;
//# sourceMappingURL=jsdoc.d.ts.map