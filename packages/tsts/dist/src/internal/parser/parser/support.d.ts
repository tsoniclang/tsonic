import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { ModifierList, Node } from "../../ast/spine.js";
import type { CommentRange, Pragma, SourceFile } from "../../ast/ast.js";
import type { NodeFactory } from "../../ast/generated/factory.js";
import type { Kind } from "../../ast/generated/kinds.js";
import type { ResolutionMode } from "../../core/compileroptions.js";
import type { ScriptKind } from "../../core/scriptkind.js";
import type { EntityName, Expression, TypeNode } from "../../ast/generated/unions.js";
import type { SourceFileParseOptions } from "../../ast/parseoptions.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import type { jsdocScannerInfo, Parser, ParserState } from "./state.js";
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
export declare function newParser(): GoPtr<Parser>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::getParser","kind":"func","status":"implemented","sigHash":"78d7c4f910a3907e78fe0ff833535921ed57de947a1d9563f3d4b36008850cca","bodyHash":"409ea3c275529d58b9d335b8d3fd8b40a6b20d1d82aa20d9f3b16b7ad798d25e"}
 *
 * Go source:
 * func getParser() *Parser {
 * 	return parserPool.Get().(*Parser)
 * }
 */
export declare function getParser(): GoPtr<Parser>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::putParser","kind":"func","status":"implemented","sigHash":"46535a4faafd64b5af22ad73bba3dd1e339b74bb27c8d98f1f4432faaf94d116","bodyHash":"ca76b718da02842e1ebe182d957c74cbed96e619d90a7aebe732e1ca3d3ddc65"}
 *
 * Go source:
 * func putParser(p *Parser) {
 * 	*p = Parser{scanner: p.scanner, setParentFromContext: p.setParentFromContext}
 * 	parserPool.Put(p)
 * }
 */
export declare function putParser(p: GoPtr<Parser>): void;
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
export declare function Parser_initializeClosures(receiver: GoPtr<Parser>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isJavaScript","kind":"method","status":"implemented","sigHash":"7b01911127dc5f1dd58d3a9100774c49d670cc4bb258840ff35f252d8610a164","bodyHash":"38d6e622cb2ad9edc58b7dd997f4d9a48a2f4116c0ab6e104b655631ed283a44"}
 *
 * Go source:
 * func (p *Parser) isJavaScript() bool {
 * 	return p.scriptKind == core.ScriptKindJS || p.scriptKind == core.ScriptKindJSX
 * }
 */
export declare function Parser_isJavaScript(receiver: GoPtr<Parser>): bool;
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
export declare function Parser_parseJSONText(receiver: GoPtr<Parser>): GoPtr<SourceFile>;
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
export declare function Parser_validateJsonValue(receiver: GoPtr<Parser>, sourceFile: GoPtr<SourceFile>, valueExpression: GoPtr<Expression>): void;
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
export declare function ParseIsolatedEntityName(text: string): GoPtr<EntityName>;
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
export declare function Parser_initializeState(receiver: GoPtr<Parser>, opts: SourceFileParseOptions, sourceText: string, scriptKind: ScriptKind): void;
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
export declare function Parser_mark(receiver: GoPtr<Parser>): ParserState;
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
export declare function Parser_rewind(receiver: GoPtr<Parser>, state: ParserState): void;
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
export declare function Parser_lookAhead(receiver: GoPtr<Parser>, callback: (p: GoPtr<Parser>) => bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nodePos","kind":"method","status":"implemented","sigHash":"8a2611e00020e66e7b547b77a70acaa2e1f729218ee86df2df736c9194577094","bodyHash":"d766da3815e7cb072bf0886d368ebaebf14e0236fa659bcab441562f60965405"}
 *
 * Go source:
 * func (p *Parser) nodePos() int {
 * 	return p.scanner.TokenFullStart()
 * }
 */
export declare function Parser_nodePos(receiver: GoPtr<Parser>): int;
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
export declare function Parser_parseOptional(receiver: GoPtr<Parser>, token: Kind): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::isDeclareModifier","kind":"func","status":"implemented","sigHash":"c82aa644d413bd544b210f71e29c2f8dd49328e263e317820ddc4cb64a285c73","bodyHash":"1346adb17ff83d09f354848b6568790d7c0edb6ae459efdc51de115e7f7c6860"}
 *
 * Go source:
 * func isDeclareModifier(modifier *ast.Node) bool {
 * 	return modifier.Kind == ast.KindDeclareKeyword
 * }
 */
export declare function isDeclareModifier(modifier: GoPtr<Node>): bool;
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
export declare function Parser_parseCaseClause(receiver: GoPtr<Parser>): GoPtr<Node>;
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
export declare function Parser_parseDefaultClause(receiver: GoPtr<Parser>): GoPtr<Node>;
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
export declare function Parser_parseCaseOrDefaultClause(receiver: GoPtr<Parser>): GoPtr<Node>;
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
export declare function Parser_parseInitializer(receiver: GoPtr<Parser>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isImplementsClause","kind":"method","status":"implemented","sigHash":"3f1d6aa2af067edc8a95af273ed3c089c97847187ebccca88c7332d947601cc2","bodyHash":"092980f42f114eeaf1170513a7452e066811b7dd840b6ce7b64785702d72d31c"}
 *
 * Go source:
 * func (p *Parser) isImplementsClause() bool {
 * 	return p.token == ast.KindImplementsKeyword && p.lookAhead((*Parser).nextTokenIsIdentifierOrKeyword)
 * }
 */
export declare function Parser_isImplementsClause(receiver: GoPtr<Parser>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::isAsyncModifier","kind":"func","status":"implemented","sigHash":"7dbb6eebcc3a9775af92e0024dc8fa4208896c97329462a7d231bc9b9ae93a1e","bodyHash":"e92625755315939da645d816c408a55f4daf0419aa65b9f2dc2f468a0372d4b4"}
 *
 * Go source:
 * func isAsyncModifier(modifier *ast.Node) bool {
 * 	return modifier.Kind == ast.KindAsyncKeyword
 * }
 */
export declare function isAsyncModifier(modifier: GoPtr<Node>): bool;
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
export declare function Parser_parseSemicolonAfterPropertyName(receiver: GoPtr<Parser>, name: GoPtr<Node>, typeNode: GoPtr<TypeNode>, initializer: GoPtr<Expression>): void;
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
export declare function getSpaceSuggestion(expressionText: string): string;
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
export declare function Parser_parseEntityName(receiver: GoPtr<Parser>, allowReservedWords: bool, diagnosticMessage: GoPtr<Message>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseParameter","kind":"method","status":"implemented","sigHash":"d188380143a1cbc79da292b3bb7cc1b40bb5a157d3a2d40fae61c9e38784fcdd","bodyHash":"b5ef8c04a8f6d29eb9aeb79968f91b686431d45247794351694eea1b4a8148aa"}
 *
 * Go source:
 * func (p *Parser) parseParameter() *ast.Node {
 * 	return p.parseParameterEx(false /*inOuterAwaitContext* /, true /*allowAmbiguity* /)
 * }
 */
export declare function Parser_parseParameter(receiver: GoPtr<Parser>): GoPtr<Node>;
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
export declare function Parser_parseParameterEx(receiver: GoPtr<Parser>, inOuterAwaitContext: bool, allowAmbiguity: bool): GoPtr<Node>;
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
export declare function Parser_isParameterNameStart(receiver: GoPtr<Parser>): bool;
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
export declare function Parser_parseNameOfParameter(receiver: GoPtr<Parser>, modifiers: GoPtr<ModifierList>): GoPtr<Node>;
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
export declare function Parser_parsePropertyName(receiver: GoPtr<Parser>): GoPtr<Node>;
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
export declare function Parser_parsePropertyNameWorker(receiver: GoPtr<Parser>, allowComputedPropertyNames: bool): GoPtr<Node>;
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
export declare function Parser_parseComputedPropertyName(receiver: GoPtr<Parser>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isIndexSignature","kind":"method","status":"implemented","sigHash":"444d5c31aacc0a084b1862e2f90dd4819373289f04c8de766f090f5e53019166","bodyHash":"cfccd666880e75ec524c253c835d7ee93b448579cc3f26da5aefa373b292e8bc"}
 *
 * Go source:
 * func (p *Parser) isIndexSignature() bool {
 * 	return p.token == ast.KindOpenBracketToken && p.lookAhead((*Parser).nextIsUnambiguouslyIndexSignature)
 * }
 */
export declare function Parser_isIndexSignature(receiver: GoPtr<Parser>): bool;
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
export declare function Parser_nextIsUnambiguouslyIndexSignature(receiver: GoPtr<Parser>): bool;
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
export declare function Parser_parsePropertyOrMethodSignature(receiver: GoPtr<Parser>, pos: int, jsdoc: jsdocScannerInfo, modifiers: GoPtr<ModifierList>): GoPtr<Node>;
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
export declare function Parser_skipParameterStart(receiver: GoPtr<Parser>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseModifiers","kind":"method","status":"implemented","sigHash":"8c2ece67da34082745bfd7cac6fa4b71ac113cf50138dbdc1603be4d849197c4","bodyHash":"c2f9e76ef09ec0ff02ff2aff914a31f1e8e950cae8bdf25b15ca99ef2473b4cd"}
 *
 * Go source:
 * func (p *Parser) parseModifiers() *ast.ModifierList {
 * 	return p.parseModifiersEx(false, false, false)
 * }
 */
export declare function Parser_parseModifiers(receiver: GoPtr<Parser>): GoPtr<ModifierList>;
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
export declare function Parser_parseModifiersEx(receiver: GoPtr<Parser>, allowDecorators: bool, permitConstAsModifier: bool, stopOnStartOfClassStaticBlock: bool): GoPtr<ModifierList>;
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
export declare function Parser_parseDecorator(receiver: GoPtr<Parser>): GoPtr<Node>;
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
export declare function Parser_tryParseModifier(receiver: GoPtr<Parser>, hasSeenStaticModifier: bool, permitConstAsModifier: bool, stopOnStartOfClassStaticBlock: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.canFollowModifier","kind":"method","status":"implemented","sigHash":"d9af03e07613adfb57b5c104d241f9c3a60d8420ebd914c884ac1b32e99e3f52","bodyHash":"91c5c2d4d2bee9d19511ded68c2beb9017ad89a1f6e2b1d1cac7f77e6e712d65"}
 *
 * Go source:
 * func (p *Parser) canFollowModifier() bool {
 * 	return p.token == ast.KindOpenBracketToken || p.token == ast.KindOpenBraceToken || p.token == ast.KindAsteriskToken || p.token == ast.KindDotDotDotToken || p.isLiteralPropertyName()
 * }
 */
export declare function Parser_canFollowModifier(receiver: GoPtr<Parser>): bool;
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
export declare function Parser_tryReparseOptionalChain(receiver: GoPtr<Parser>, node: GoPtr<Expression>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.finishNode","kind":"method","status":"implemented","sigHash":"cea664d83bd51662f7fb68cb08ece474e14a5277c11ca2d1784d3d3729c410ca","bodyHash":"c36ccf67b8c80111cb942b982290fb9b63e7381055f9f2132154ef8fed2754c8"}
 *
 * Go source:
 * func (p *Parser) finishNode(node *ast.Node, pos int) *ast.Node {
 * 	return p.finishNodeWithEnd(node, pos, p.nodePos())
 * }
 */
export declare function Parser_finishNode(receiver: GoPtr<Parser>, node: GoPtr<Node>, pos: int): GoPtr<Node>;
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
export declare function Parser_overrideParentInImmediateChildren(receiver: GoPtr<Parser>, node: GoPtr<Node>): void;
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
export declare function Parser_canParseSemicolon(receiver: GoPtr<Parser>): bool;
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
export declare function Parser_tryParseSemicolon(receiver: GoPtr<Parser>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseSemicolon","kind":"method","status":"implemented","sigHash":"c07563ff7006fd7fe02e6dc9d0956e99072643379d649420252df54082b48e08","bodyHash":"48353a28ca0bf9175b898b7b5ac92628eb852bd7d32696a8c28468ff5b5e9156"}
 *
 * Go source:
 * func (p *Parser) parseSemicolon() bool {
 * 	return p.tryParseSemicolon() || p.parseExpected(ast.KindSemicolonToken)
 * }
 */
export declare function Parser_parseSemicolon(receiver: GoPtr<Parser>): bool;
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
export declare function Parser_isStartOfParameter(receiver: GoPtr<Parser>, isJSDocParameter: bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::isReservedWord","kind":"func","status":"implemented","sigHash":"70dd1c5bd10e6c11cc7848582f4d6bbbf92ef976df25b8e352bf0f754868cb8f","bodyHash":"ba4de5702aa6198f2587e2cc5525405c7770f8b535c262dfdfa9dc4ceb7b49f2"}
 *
 * Go source:
 * func isReservedWord(token ast.Kind) bool {
 * 	return ast.KindFirstReservedWord <= token && token <= ast.KindLastReservedWord
 * }
 */
export declare function isReservedWord(token: Kind): bool;
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
export declare function getCommentPragmas(f: GoPtr<NodeFactory>, sourceText: string): GoSlice<Pragma>;
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
export declare function extractPragmas(commentRange: CommentRange, text: string): GoSlice<Pragma>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::match","kind":"func","status":"implemented","sigHash":"10e9189641af2ba42d20fe68a3a22b891a6e39b3dbf24cac70b422b3eff82487","bodyHash":"21d2f4e8b37337a3c2dd78207c909839f20686cbbc85cf08d0861859f7048c43"}
 *
 * Go source:
 * func match(text string, pos int, s string) bool {
 * 	return strings.HasPrefix(text[pos:], s)
 * }
 */
export declare function match(text: string, pos: int, s: string): bool;
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
export declare function skipBlanks(text: string, pos: int): int;
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
export declare function skipNonBlanks(text: string, pos: int): int;
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
export declare function skipTo(text: string, pos: int, s: string): int;
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
export declare function extractName(text: string, pos: int): string;
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
export declare function extractQuotedString(text: string, pos: int): [string, bool];
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
export declare function Parser_processPragmasIntoFields(receiver: GoPtr<Parser>, context: GoPtr<SourceFile>): void;
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
export declare function Parser_parseResolutionMode(receiver: GoPtr<Parser>, mode: string, pos: int, end: int): ResolutionMode;
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
export declare function Parser_checkJSDecoratorSyntax(receiver: GoPtr<Parser>, node: GoPtr<Node>): void;
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
export declare function Parser_checkJSSyntax(receiver: GoPtr<Parser>, node: GoPtr<Node>): GoPtr<Node>;
//# sourceMappingURL=support.d.ts.map