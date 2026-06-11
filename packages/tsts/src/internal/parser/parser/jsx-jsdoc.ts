import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import { Node_End, NodeList_End, NodeList_Pos, Node_Pos } from "../../ast/spine.js";
import type { Node, NodeList } from "../../ast/spine.js";
import { Node_TagName, Node_Children } from "../../ast/ast.js";
import { AsJsxElement } from "../../ast/generated/casts.js";
import {
  NewBinaryExpression,
  NewJsxAttribute,
  NewJsxAttributes,
  NewJsxClosingElement,
  NewJsxClosingFragment,
  NewJsxElement,
  NewJsxExpression,
  NewJsxFragment,
  NewJsxNamespacedName,
  NewJsxOpeningElement,
  NewJsxOpeningFragment,
  NewJsxSelfClosingElement,
  NewJsxSpreadAttribute,
  NewJsxText,
  NewJSDocAllType,
  NewJSDocNonNullableType,
  NewJSDocNullableType,
  NewJSDocOptionalType,
  NewJSDocVariadicType,
  NewKeywordExpression,
  NewPropertyAccessExpression,
  NewToken,
} from "../../ast/generated/factory.js";
import { NodeFlagsJavaScriptFile, NodeFlagsNone } from "../../ast/generated/flags.js";
import {
  type Kind,
  KindCloseBraceToken,
  KindColonToken,
  KindCommaToken,
  KindConflictMarkerTrivia,
  KindDotDotDotToken,
  KindDotToken,
  KindEndOfFile,
  KindEqualsToken,
  KindGreaterThanToken,
  KindJsxElement,
  KindJsxOpeningElement,
  KindJsxOpeningFragment,
  KindJsxSelfClosingElement,
  KindJsxText,
  KindJsxTextAllWhiteSpaces,
  KindLessThanSlashToken,
  KindLessThanToken,
  KindOpenBraceToken,
  KindSlashToken,
  KindStringLiteral,
  KindThisKeyword,
} from "../../ast/generated/kinds.js";
import { IsJsxNamespacedName, IsJsxOpeningElement, IsJsxOpeningFragment } from "../../ast/generated/predicates.js";
import { TagNamesAreEquivalent } from "../../ast/utilities.js";
import { LastOrNil } from "../../core/core.js";
import type { Expression, TypeNode } from "../../ast/generated/unions.js";
import {
  Expected_corresponding_closing_tag_for_JSX_fragment,
  Expected_corresponding_JSX_closing_tag_for_0,
  JSX_element_0_has_no_corresponding_closing_tag,
  JSX_expressions_must_have_one_parent_element,
  JSX_fragment_has_no_corresponding_closing_tag,
  X_0_expected,
  X_or_JSX_element_expected,
} from "../../diagnostics/generated/messages.js";
import {
  GetTextOfNodeFromSourceText,
} from "../../scanner/utilities.js";
import {
  Scanner_ReScanJsxToken,
  Scanner_ScanJSDocCommentTextToken,
  Scanner_ScanJSDocToken,
  Scanner_ScanJsxAttributeValue,
  Scanner_ScanJsxIdentifier,
  Scanner_ScanJsxToken,
  Scanner_SetSkipJSDocLeadingAsterisks,
  Scanner_TokenValue,
  SkipTrivia,
  TokenToString,
} from "../../scanner/scanner.js";
import { isKeywordOrPunctuation } from "../utilities.js";
import { Parser_parseExpression, Parser_parseLiteralExpression } from "./expressions.js";
import { Parser_parseList } from "./lists.js";
import {
  Parser_finishNode,
  Parser_nodePos,
  Parser_parseOptional,
} from "./support.js";
import { Parser_newIdentifier } from "./tokens-speculation.js";
import { Parser_newNodeList } from "./lists.js";
import { Parser_finishNodeWithEnd } from "./statements-declarations.js";
import { Parser_parseErrorAt, Parser_parseErrorAtRange } from "./errors-recovery.js";
import { NewTextRange } from "../../core/text.js";
import {
  PCJsxAttributes,
  PCJsxChildren,
  type Parser,
} from "./state.js";
import {
  Parser_parseExpectedWithDiagnostic,
  Parser_parseExpectedWithoutAdvancing,
  Parser_parseRightSideOfDot,
} from "./statements-declarations.js";
import {
  Parser_nextToken,
  Parser_parseErrorAtCurrentToken,
  Parser_parseExpected,
  Parser_parseIdentifierNameErrorOnUnicodeEscapeSequence,
  Parser_parseOptionalToken,
  Parser_parseTokenNode,
} from "./tokens-speculation.js";
import {
  Parser_parseNonArrayType,
  Parser_parseType,
  Parser_parseTypeArguments,
  Parser_parseTypeOrTypePredicate,
} from "./types.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextTokenJSDoc","kind":"method","status":"implemented","sigHash":"258c75ae1865cb820212b1ae448ff677e4d7920eb545c9ae92a5946172319604","bodyHash":"af3c4f40c7e8d59c13afe1f4dfb016769e941013d70533c15a5bcb31a789da2d"}
 *
 * Go source:
 * func (p *Parser) nextTokenJSDoc() ast.Kind {
 * 	p.token = p.scanner.ScanJSDocToken()
 * 	return p.token
 * }
 */
export function Parser_nextTokenJSDoc(receiver: GoPtr<Parser>): Kind {
  const p: Parser = receiver!;
  p.token = Scanner_ScanJSDocToken(p.scanner);
  return p.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.nextJSDocCommentTextToken","kind":"method","status":"implemented","sigHash":"a5f060007443e752bc1c46ae4a9552ec57b81ee819de4a683434081cf0caf6a8","bodyHash":"132dddde3f7ef8a9bcc2e9017db5b42c91a8ef8a1f66164cd7948a97f90470f5"}
 *
 * Go source:
 * func (p *Parser) nextJSDocCommentTextToken(inBackticks bool) ast.Kind {
 * 	p.token = p.scanner.ScanJSDocCommentTextToken(inBackticks)
 * 	return p.token
 * }
 */
export function Parser_nextJSDocCommentTextToken(receiver: GoPtr<Parser>, inBackticks: bool): Kind {
  const p: Parser = receiver!;
  p.token = Scanner_ScanJSDocCommentTextToken(p.scanner, inBackticks);
  return p.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.createJSDocCache","kind":"method","status":"implemented","sigHash":"cd097910a1199802741885f894e8d67fac363135bfa301a397b1b274899d7b53","bodyHash":"16fb6abe5e9851689ffc8cf744676a80ca9678b5e3ca5d9be9e53773fa94a6bd"}
 *
 * Go source:
 * func (p *Parser) createJSDocCache() map[*ast.Node][]*ast.Node {
 * 	if len(p.jsdocInfos) == 0 {
 * 		return nil
 * 	}
 * 	result := make(map[*ast.Node][]*ast.Node, len(p.jsdocInfos))
 * 	for _, info := range p.jsdocInfos {
 * 		result[info.parent] = info.jsDocs
 * 	}
 * 	return result
 * }
 */
export function Parser_createJSDocCache(receiver: GoPtr<Parser>): GoMap<GoPtr<Node>, GoSlice<GoPtr<Node>>> | undefined {
  const p: Parser = receiver!;
  if (p.jsdocInfos.length === 0) {
    return undefined;
  }
  const result: GoMap<GoPtr<Node>, GoSlice<GoPtr<Node>>> = new globalThis.Map<GoPtr<Node>, GoSlice<GoPtr<Node>>>();
  for (const info of p.jsdocInfos) {
    result.set(info.parent, info.jsDocs);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExpectedJSDoc","kind":"method","status":"implemented","sigHash":"0b6039dc6e65811809b7d91c90600e4691391072f13e4876c9b0489356f6bf3f","bodyHash":"aa3fe791b416e278ded175c21732b7cf2fbb53004e794c2ad6215a48f79d361c"}
 *
 * Go source:
 * func (p *Parser) parseExpectedJSDoc(kind ast.Kind) bool {
 * 	if p.token == kind {
 * 		p.nextTokenJSDoc()
 * 		return true
 * 	}
 * 	if !isKeywordOrPunctuation(kind) {
 * 		panic("Invalid JSDoc kind: expected keyword or punctuation")
 * 	}
 * 	p.parseErrorAtCurrentToken(diagnostics.X_0_expected, scanner.TokenToString(kind))
 * 	return false
 * }
 */
export function Parser_parseExpectedJSDoc(receiver: GoPtr<Parser>, kind: Kind): bool {
  const p: Parser = receiver!;
  if (p.token === kind) {
    Parser_nextTokenJSDoc(p);
    return true;
  }
  if (!isKeywordOrPunctuation(kind)) {
    throw new globalThis.Error("Invalid JSDoc kind: expected keyword or punctuation");
  }
  Parser_parseErrorAtCurrentToken(p, X_0_expected, TokenToString(kind));
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseExpectedTokenJSDoc","kind":"method","status":"implemented","sigHash":"6739935e09920cfae17d2faaab950a63279bba865381e42bdfb8d32cb0e0e9d1","bodyHash":"1a05c6fbfad5c3af8e9eb5cd79165d3b2f2a237fd5b833181f50f5f21691df0f"}
 *
 * Go source:
 * func (p *Parser) parseExpectedTokenJSDoc(kind ast.Kind) *ast.Node {
 * 	optional := p.parseOptionalTokenJSDoc(kind)
 * 	if optional == nil {
 * 		if !isKeywordOrPunctuation(kind) {
 * 			panic("expected keyword or punctuation")
 * 		}
 * 		p.parseErrorAtCurrentToken(diagnostics.X_0_expected, scanner.TokenToString(kind))
 * 		optional = p.finishNode(p.factory.NewToken(kind), p.nodePos())
 * 	}
 * 	return optional
 * }
 */
export function Parser_parseExpectedTokenJSDoc(receiver: GoPtr<Parser>, kind: Kind): GoPtr<Node> {
  const p: Parser = receiver!;
  const optional: GoPtr<Node> = Parser_parseOptionalTokenJSDoc(p, kind);
  if (optional === undefined) {
    if (!isKeywordOrPunctuation(kind)) {
      throw new globalThis.Error("expected keyword or punctuation");
    }
    Parser_parseErrorAtCurrentToken(p, X_0_expected, TokenToString(kind));
    return Parser_finishNode(p, NewToken(p.factory, kind), Parser_nodePos(p));
  }
  return optional;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseOptionalTokenJSDoc","kind":"method","status":"implemented","sigHash":"a8e36fc73c964121139e4693217b9e95667e479ef5b8a8480b2413ea11bca569","bodyHash":"54192b2238cb5ed43d8413aa4c572fcb39004397a3915b49aabd0c69484a9084"}
 *
 * Go source:
 * func (p *Parser) parseOptionalTokenJSDoc(kind ast.Kind) *ast.Node {
 * 	if p.token == kind {
 * 		return p.parseTokenNode()
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseOptionalTokenJSDoc(receiver: GoPtr<Parser>, kind: Kind): GoPtr<Node> {
  const p: Parser = receiver!;
  if (p.token === kind) {
    return Parser_parseTokenNode(p);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJSDocAllType","kind":"method","status":"implemented","sigHash":"a7e53dba6db46d3c4c095188a4d8cb0972ad16acda48973a67cc87ea39978855","bodyHash":"567452a12d488b47c62b648eb3aa2339955f6bfb1e9fb8b9438d276eba185383"}
 *
 * Go source:
 * func (p *Parser) parseJSDocAllType() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.nextToken()
 * 	return p.finishNode(p.factory.NewJSDocAllType(), pos)
 * }
 */
export function Parser_parseJSDocAllType(receiver: GoPtr<Parser>): GoPtr<Node> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(p);
  Parser_nextToken(p);
  return Parser_finishNode(p, NewJSDocAllType(p.factory), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJSDocNonNullableType","kind":"method","status":"implemented","sigHash":"02dde96566a6320a7da8086b7f9fd5763595ba2537847b425f729cd146c2fa02","bodyHash":"f64086a1333ddf86baaa554a676bf86c236ad5735a0d0d099583c320a3ad432b"}
 *
 * Go source:
 * func (p *Parser) parseJSDocNonNullableType() *ast.TypeNode {
 * 	pos := p.nodePos()
 * 	p.nextToken()
 * 	return p.finishNode(p.factory.NewJSDocNonNullableType(p.parseNonArrayType()), pos)
 * }
 */
export function Parser_parseJSDocNonNullableType(receiver: GoPtr<Parser>): GoPtr<TypeNode> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(p);
  Parser_nextToken(p);
  return Parser_finishNode(p, NewJSDocNonNullableType(p.factory, Parser_parseNonArrayType(p)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJSDocNullableType","kind":"method","status":"implemented","sigHash":"43f41dcb9daca60458a02bf4e418da467f7bd3a551330bcf90abf4c641ed8698","bodyHash":"a1819efc2aa7bbf58547ea9e16976bf5994a159496865976d2c91dcf81084536"}
 *
 * Go source:
 * func (p *Parser) parseJSDocNullableType() *ast.Node {
 * 	pos := p.nodePos()
 * 	// skip the ?
 * 	p.nextToken()
 * 	return p.finishNode(p.factory.NewJSDocNullableType(p.parseType()), pos)
 * }
 */
export function Parser_parseJSDocNullableType(receiver: GoPtr<Parser>): GoPtr<Node> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(p);
  // skip the ?
  Parser_nextToken(p);
  return Parser_finishNode(p, NewJSDocNullableType(p.factory, Parser_parseType(p)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJSDocType","kind":"method","status":"implemented","sigHash":"553000b68a62924dcc522452adb89b39a76b07cdb61c181d99bcfa3dff9746ac","bodyHash":"0de5b1cabc988260e87504fa1bb103a0584e0d63a4daa36f2e0ab23f2bc7df6d"}
 *
 * Go source:
 * func (p *Parser) parseJSDocType() *ast.TypeNode {
 * 	p.scanner.SetSkipJSDocLeadingAsterisks(true)
 * 	pos := p.nodePos()
 *
 * 	hasDotDotDot := p.parseOptional(ast.KindDotDotDotToken)
 * 	t := p.parseTypeOrTypePredicate()
 * 	p.scanner.SetSkipJSDocLeadingAsterisks(false)
 * 	if hasDotDotDot {
 * 		t = p.finishNode(p.factory.NewJSDocVariadicType(t), pos)
 * 	}
 * 	if p.token == ast.KindEqualsToken {
 * 		p.nextToken()
 * 		return p.finishNode(p.factory.NewJSDocOptionalType(t), pos)
 * 	}
 * 	return t
 * }
 */
export function Parser_parseJSDocType(receiver: GoPtr<Parser>): GoPtr<TypeNode> {
  const p: Parser = receiver!;
  Scanner_SetSkipJSDocLeadingAsterisks(p.scanner, true);
  const pos: int = Parser_nodePos(p);

  const hasDotDotDot: bool = Parser_parseOptional(p, KindDotDotDotToken);
  const t: GoPtr<TypeNode> = Parser_parseTypeOrTypePredicate(p);
  Scanner_SetSkipJSDocLeadingAsterisks(p.scanner, false);
  const tWithVariadic: GoPtr<TypeNode> = hasDotDotDot
    ? Parser_finishNode(p, NewJSDocVariadicType(p.factory, t), pos)
    : t;
  if (p.token === KindEqualsToken) {
    Parser_nextToken(p);
    return Parser_finishNode(p, NewJSDocOptionalType(p.factory, tWithVariadic), pos);
  }
  return tWithVariadic;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxElementOrSelfClosingElementOrFragment","kind":"method","status":"implemented","sigHash":"abbf4435ab1117da4b194d4f1e3f682fe943410a957ba473b67165ea4709cf5a","bodyHash":"383f108006a50570638f31694537a1d166351413d0401a77cd6b91f0321749c8"}
 *
 * Go source:
 * func (p *Parser) parseJsxElementOrSelfClosingElementOrFragment(inExpressionContext bool, topInvalidNodePosition int, openingTag *ast.Node, mustBeUnary bool) *ast.Expression {
 * 	pos := p.nodePos()
 * 	opening := p.parseJsxOpeningOrSelfClosingElementOrOpeningFragment(inExpressionContext)
 * 	var result *ast.Expression
 * 	switch opening.Kind {
 * 	case ast.KindJsxOpeningElement:
 * 		children := p.parseJsxChildren(opening)
 * 		var closingElement *ast.Node
 * 		lastChild := core.LastOrNil(children.Nodes)
 * 		if lastChild != nil && lastChild.Kind == ast.KindJsxElement &&
 * 			!ast.TagNamesAreEquivalent(lastChild.AsJsxElement().OpeningElement.TagName(), lastChild.AsJsxElement().ClosingElement.TagName()) &&
 * 			ast.TagNamesAreEquivalent(opening.TagName(), lastChild.AsJsxElement().ClosingElement.TagName()) {
 * 			// when an unclosed JsxOpeningElement incorrectly parses its parent's JsxClosingElement,
 * 			// restructure (<div>(...<span>...</div>)) --> (<div>(...<span>...</>)</div>)
 * 			// (no need to error; the parent will error)
 * 			end := lastChild.Children().End()
 * 			missingIdentifier := p.finishNodeWithEnd(p.newIdentifier(""), end, end)
 * 			newClosingElement := p.finishNodeWithEnd(p.factory.NewJsxClosingElement(missingIdentifier), end, end)
 * 			newLast := p.finishNodeWithEnd(
 * 				p.factory.NewJsxElement(lastChild.AsJsxElement().OpeningElement, lastChild.Children(), newClosingElement),
 * 				lastChild.AsJsxElement().OpeningElement.Pos(),
 * 				end,
 * 			)
 * 			// force reset parent pointers from discarded parse result
 * 			if lastChild.AsJsxElement().OpeningElement != nil {
 * 				lastChild.AsJsxElement().OpeningElement.Parent = newLast
 * 			}
 * 			if lastChild.Children() != nil {
 * 				for _, c := range lastChild.Children().Nodes {
 * 					c.Parent = newLast
 * 				}
 * 			}
 * 			newClosingElement.Parent = newLast
 * 			children = p.newNodeList(core.NewTextRange(children.Pos(), newLast.End()), append(children.Nodes[0:len(children.Nodes)-1], newLast))
 * 			closingElement = lastChild.AsJsxElement().ClosingElement
 * 		} else {
 * 			closingElement = p.parseJsxClosingElement(opening, inExpressionContext)
 * 			if !ast.TagNamesAreEquivalent(opening.TagName(), closingElement.TagName()) {
 * 				if openingTag != nil && ast.IsJsxOpeningElement(openingTag) && ast.TagNamesAreEquivalent(closingElement.TagName(), openingTag.TagName()) {
 * 					// opening incorrectly matched with its parent's closing -- put error on opening
 * 					p.parseErrorAtRange(opening.TagName().Loc, diagnostics.JSX_element_0_has_no_corresponding_closing_tag, scanner.GetTextOfNodeFromSourceText(p.sourceText, opening.TagName(), false /*includeTrivia* /))
 * 				} else {
 * 					// other opening/closing mismatches -- put error on closing
 * 					p.parseErrorAtRange(closingElement.TagName().Loc, diagnostics.Expected_corresponding_JSX_closing_tag_for_0, scanner.GetTextOfNodeFromSourceText(p.sourceText, opening.TagName(), false /*includeTrivia* /))
 * 				}
 * 			}
 * 		}
 * 		result = p.finishNode(p.factory.NewJsxElement(opening, children, closingElement), pos)
 * 		closingElement.Parent = result // force reset parent pointers from possibly discarded parse result
 * 	case ast.KindJsxOpeningFragment:
 * 		result = p.finishNode(p.factory.NewJsxFragment(opening, p.parseJsxChildren(opening), p.parseJsxClosingFragment(inExpressionContext)), pos)
 * 	case ast.KindJsxSelfClosingElement:
 * 		// Nothing else to do for self-closing elements
 * 		result = opening
 * 	default:
 * 		panic("Unhandled case in parseJsxElementOrSelfClosingElementOrFragment")
 * 	}
 * 	// If the user writes the invalid code '<div></div><div></div>' in an expression context (i.e. not wrapped in
 * 	// an enclosing tag), we'll naively try to parse   ^ this as a 'less than' operator and the remainder of the tag
 * 	// as garbage, which will cause the formatter to badly mangle the JSX. Perform a speculative parse of a JSX
 * 	// element if we see a < token so that we can wrap it in a synthetic binary expression so the formatter
 * 	// does less damage and we can report a better error.
 * 	// Since JSX elements are invalid < operands anyway, this lookahead parse will only occur in error scenarios
 * 	// of one sort or another.
 * 	// If we are in a unary context, we can't do this recovery; the binary expression we return here is not
 * 	// a valid UnaryExpression and will cause problems later.
 * 	if !mustBeUnary && inExpressionContext && p.token == ast.KindLessThanToken {
 * 		topBadPos := topInvalidNodePosition
 * 		if topBadPos < 0 {
 * 			topBadPos = result.Pos()
 * 		}
 * 		invalidElement := p.parseJsxElementOrSelfClosingElementOrFragment( /*inExpressionContext* / true, topBadPos, nil, false)
 * 		operatorToken := p.factory.NewToken(ast.KindCommaToken)
 * 		operatorToken.Loc = core.NewTextRange(invalidElement.Pos(), invalidElement.Pos())
 * 		p.parseErrorAt(scanner.SkipTrivia(p.sourceText, topBadPos), invalidElement.End(), diagnostics.JSX_expressions_must_have_one_parent_element)
 * 		result = p.finishNode(p.factory.NewBinaryExpression(nil /*modifiers* /, result, nil /*typeNode* /, operatorToken, invalidElement), pos)
 * 	}
 * 	return result
 * }
 */
export function Parser_parseJsxElementOrSelfClosingElementOrFragment(receiver: GoPtr<Parser>, inExpressionContext: bool, topInvalidNodePosition: int, openingTag: GoPtr<Node>, mustBeUnary: bool): GoPtr<Expression> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(receiver);
  const opening: GoPtr<Expression> = Parser_parseJsxOpeningOrSelfClosingElementOrOpeningFragment(receiver, inExpressionContext);
  let result: GoPtr<Expression>;
  switch (opening!.Kind) {
    case KindJsxOpeningElement: {
      let children: GoPtr<NodeList> = Parser_parseJsxChildren(receiver, opening);
      let closingElement: GoPtr<Node>;
      const lastChild = LastOrNil(children!.Nodes);
      if (lastChild !== undefined && lastChild.Kind === KindJsxElement &&
        !TagNamesAreEquivalent(Node_TagName(AsJsxElement(lastChild)!.OpeningElement), Node_TagName(AsJsxElement(lastChild)!.ClosingElement)) &&
        TagNamesAreEquivalent(Node_TagName(opening), Node_TagName(AsJsxElement(lastChild)!.ClosingElement))) {
        // when an unclosed JsxOpeningElement incorrectly parses its parent's JsxClosingElement,
        // restructure (<div>(...<span>...</div>)) --> (<div>(...<span>...</>)</div>)
        // (no need to error; the parent will error)
        const end: int = NodeList_End(Node_Children(lastChild));
        const missingIdentifier = Parser_finishNodeWithEnd(receiver, Parser_newIdentifier(receiver, ""), end, end);
        const newClosingElement = Parser_finishNodeWithEnd(receiver, NewJsxClosingElement(p.factory, missingIdentifier), end, end);
        const newLast = Parser_finishNodeWithEnd(
          receiver,
          NewJsxElement(p.factory, AsJsxElement(lastChild)!.OpeningElement, Node_Children(lastChild), newClosingElement),
          Node_Pos(AsJsxElement(lastChild)!.OpeningElement),
          end,
        );
        // force reset parent pointers from discarded parse result
        if (AsJsxElement(lastChild)!.OpeningElement !== undefined) {
          AsJsxElement(lastChild)!.OpeningElement!.Parent = newLast;
        }
        if (Node_Children(lastChild) !== undefined) {
          for (const c of Node_Children(lastChild)!.Nodes) {
            c!.Parent = newLast;
          }
        }
        newClosingElement!.Parent = newLast;
        children = Parser_newNodeList(receiver, NewTextRange(NodeList_Pos(children), Node_End(newLast)), [...children!.Nodes.slice(0, children!.Nodes.length - 1), newLast]);
        closingElement = AsJsxElement(lastChild)!.ClosingElement;
      } else {
        closingElement = Parser_parseJsxClosingElement(receiver, opening, inExpressionContext);
        if (!TagNamesAreEquivalent(Node_TagName(opening), Node_TagName(closingElement))) {
          if (openingTag !== undefined && IsJsxOpeningElement(openingTag) && TagNamesAreEquivalent(Node_TagName(closingElement), Node_TagName(openingTag))) {
            // opening incorrectly matched with its parent's closing -- put error on opening
            Parser_parseErrorAtRange(receiver, Node_TagName(opening)!.Loc, JSX_element_0_has_no_corresponding_closing_tag, GetTextOfNodeFromSourceText(p.sourceText, Node_TagName(opening), false /*includeTrivia*/));
          } else {
            // other opening/closing mismatches -- put error on closing
            Parser_parseErrorAtRange(receiver, Node_TagName(closingElement)!.Loc, Expected_corresponding_JSX_closing_tag_for_0, GetTextOfNodeFromSourceText(p.sourceText, Node_TagName(opening), false /*includeTrivia*/));
          }
        }
      }
      result = Parser_finishNode(receiver, NewJsxElement(p.factory, opening, children, closingElement), pos);
      closingElement!.Parent = result; // force reset parent pointers from possibly discarded parse result
      break;
    }
    case KindJsxOpeningFragment:
      result = Parser_finishNode(receiver, NewJsxFragment(p.factory, opening, Parser_parseJsxChildren(receiver, opening), Parser_parseJsxClosingFragment(receiver, inExpressionContext)), pos);
      break;
    case KindJsxSelfClosingElement:
      // Nothing else to do for self-closing elements
      result = opening;
      break;
    default:
      throw new globalThis.Error("Unhandled case in parseJsxElementOrSelfClosingElementOrFragment");
  }
  // If the user writes the invalid code '<div></div><div></div>' in an expression context (i.e. not wrapped in
  // an enclosing tag), we'll naively try to parse   ^ this as a 'less than' operator and the remainder of the tag
  // as garbage, which will cause the formatter to badly mangle the JSX. Perform a speculative parse of a JSX
  // element if we see a < token so that we can wrap it in a synthetic binary expression so the formatter
  // does less damage and we can report a better error.
  // Since JSX elements are invalid < operands anyway, this lookahead parse will only occur in error scenarios
  // of one sort or another.
  // If we are in a unary context, we can't do this recovery; the binary expression we return here is not
  // a valid UnaryExpression and will cause problems later.
  if (!mustBeUnary && inExpressionContext && p.token === KindLessThanToken) {
    let topBadPos: int = topInvalidNodePosition;
    if (topBadPos < 0) {
      topBadPos = Node_Pos(result);
    }
    const invalidElement = Parser_parseJsxElementOrSelfClosingElementOrFragment(receiver, /*inExpressionContext*/ true as bool, topBadPos, undefined, false as bool);
    const operatorToken = NewToken(p.factory, KindCommaToken);
    operatorToken!.Loc = NewTextRange(Node_Pos(invalidElement), Node_Pos(invalidElement));
    Parser_parseErrorAt(receiver, SkipTrivia(p.sourceText, topBadPos), Node_End(invalidElement), JSX_expressions_must_have_one_parent_element);
    result = Parser_finishNode(receiver, NewBinaryExpression(p.factory, undefined /*modifiers*/, result, undefined /*typeNode*/, operatorToken, invalidElement), pos);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxChildren","kind":"method","status":"implemented","sigHash":"90bf0f624a07bfac1345bb43877b13a97a217017fecc09f07164692ee7b43105","bodyHash":"f494bf715725b1069c41abc04147d36948a42ae5672397d0c2537ca18e88ab90"}
 *
 * Go source:
 * func (p *Parser) parseJsxChildren(openingTag *ast.Expression) *ast.NodeList {
 * 	pos := p.nodePos()
 * 	saveParsingContexts := p.parsingContexts
 * 	p.parsingContexts |= 1 << PCJsxChildren
 * 	var list []*ast.Node
 * 	for {
 * 		currentToken := p.scanner.ReScanJsxToken(true /*allowMultilineJsxText* /)
 * 		child := p.parseJsxChild(openingTag, currentToken)
 * 		if child == nil {
 * 			break
 * 		}
 * 		list = append(list, child)
 * 		if ast.IsJsxOpeningElement(openingTag) && child.Kind == ast.KindJsxElement &&
 * 			!ast.TagNamesAreEquivalent(child.AsJsxElement().OpeningElement.TagName(), child.AsJsxElement().ClosingElement.TagName()) &&
 * 			ast.TagNamesAreEquivalent(openingTag.TagName(), child.AsJsxElement().ClosingElement.TagName()) {
 * 			// stop after parsing a mismatched child like <div>...(<span></div>) in order to reattach the </div> higher
 * 			break
 * 		}
 * 	}
 * 	p.parsingContexts = saveParsingContexts
 * 	return p.newNodeList(core.NewTextRange(pos, p.nodePos()), list)
 * }
 */
export function Parser_parseJsxChildren(receiver: GoPtr<Parser>, openingTag: GoPtr<Expression>): GoPtr<NodeList> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(receiver);
  const saveParsingContexts = p.parsingContexts;
  p.parsingContexts |= 1 << PCJsxChildren;
  let list: Array<GoPtr<Node>> = [];
  for (;;) {
    const currentToken = Scanner_ReScanJsxToken(p.scanner, true /*allowMultilineJsxText*/);
    const child = Parser_parseJsxChild(receiver, openingTag, currentToken);
    if (child === undefined) {
      break;
    }
    list.push(child);
    if (IsJsxOpeningElement(openingTag) && child.Kind === KindJsxElement &&
      !TagNamesAreEquivalent(Node_TagName(AsJsxElement(child)!.OpeningElement), Node_TagName(AsJsxElement(child)!.ClosingElement)) &&
      TagNamesAreEquivalent(Node_TagName(openingTag), Node_TagName(AsJsxElement(child)!.ClosingElement))) {
      // stop after parsing a mismatched child like <div>...(<span></div>) in order to reattach the </div> higher
      break;
    }
  }
  p.parsingContexts = saveParsingContexts;
  return Parser_newNodeList(receiver, NewTextRange(pos, Parser_nodePos(receiver)), list);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxChild","kind":"method","status":"implemented","sigHash":"0266eb4806f54066845d7c38fe307e0dea597eb73f98b135b4e295fb55b643fe","bodyHash":"0c2521a6dbcd26349066b2e9ca4e253cc3c66f4bc09368b72174ebdbef75be99"}
 *
 * Go source:
 * func (p *Parser) parseJsxChild(openingTag *ast.Node, token ast.Kind) *ast.Expression {
 * 	switch token {
 * 	case ast.KindEndOfFile:
 * 		// If we hit EOF, issue the error at the tag that lacks the closing element
 * 		// rather than at the end of the file (which is useless)
 * 		if ast.IsJsxOpeningFragment(openingTag) {
 * 			p.parseErrorAtRange(openingTag.Loc, diagnostics.JSX_fragment_has_no_corresponding_closing_tag)
 * 		} else {
 * 			// We want the error span to cover only 'Foo.Bar' in < Foo.Bar >
 * 			// or to cover only 'Foo' in < Foo >
 * 			tag := openingTag.TagName()
 * 			start := min(scanner.SkipTrivia(p.sourceText, tag.Pos()), tag.End())
 * 			p.parseErrorAt(start, tag.End(), diagnostics.JSX_element_0_has_no_corresponding_closing_tag,
 * 				scanner.GetTextOfNodeFromSourceText(p.sourceText, openingTag.TagName(), false /*includeTrivia* /))
 * 		}
 * 		return nil
 * 	case ast.KindLessThanSlashToken, ast.KindConflictMarkerTrivia:
 * 		return nil
 * 	case ast.KindJsxText, ast.KindJsxTextAllWhiteSpaces:
 * 		return p.parseJsxText()
 * 	case ast.KindOpenBraceToken:
 * 		return p.parseJsxExpression(false /*inExpressionContext* /)
 * 	case ast.KindLessThanToken:
 * 		return p.parseJsxElementOrSelfClosingElementOrFragment(false /*inExpressionContext* /, -1 /*topInvalidNodePosition* /, openingTag, false)
 * 	}
 * 	panic("Unhandled case in parseJsxChild")
 * }
 */
export function Parser_parseJsxChild(receiver: GoPtr<Parser>, openingTag: GoPtr<Node>, token: Kind): GoPtr<Expression> {
  const p: Parser = receiver!;
  switch (token) {
    case KindEndOfFile:
      // If we hit EOF, issue the error at the tag that lacks the closing element
      // rather than at the end of the file (which is useless)
      if (IsJsxOpeningFragment(openingTag)) {
        Parser_parseErrorAtRange(receiver, openingTag!.Loc, JSX_fragment_has_no_corresponding_closing_tag);
      } else {
        // We want the error span to cover only 'Foo.Bar' in < Foo.Bar >
        // or to cover only 'Foo' in < Foo >
        const tag = Node_TagName(openingTag);
        const start: int = Math.min(SkipTrivia(p.sourceText, Node_Pos(tag)), Node_End(tag));
        Parser_parseErrorAt(receiver, start, Node_End(tag), JSX_element_0_has_no_corresponding_closing_tag,
          GetTextOfNodeFromSourceText(p.sourceText, Node_TagName(openingTag), false /*includeTrivia*/));
      }
      return undefined;
    case KindLessThanSlashToken:
    case KindConflictMarkerTrivia:
      return undefined;
    case KindJsxText:
    case KindJsxTextAllWhiteSpaces:
      return Parser_parseJsxText(receiver);
    case KindOpenBraceToken:
      return Parser_parseJsxExpression(receiver, false /*inExpressionContext*/);
    case KindLessThanToken:
      return Parser_parseJsxElementOrSelfClosingElementOrFragment(receiver, false /*inExpressionContext*/, -1 /*topInvalidNodePosition*/, openingTag, false as bool);
  }
  throw new globalThis.Error("Unhandled case in parseJsxChild");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxText","kind":"method","status":"implemented","sigHash":"f8ca2f3f8dc63fa1a71e66ef56e1f3482476805cf4ebd0431ad461498a7af483","bodyHash":"325471745353c9bead68cc8834224beb9ccfc3499f4304cb0766851cbce8aacc"}
 *
 * Go source:
 * func (p *Parser) parseJsxText() *ast.Node {
 * 	pos := p.nodePos()
 * 	result := p.factory.NewJsxText(p.scanner.TokenValue(), p.token == ast.KindJsxTextAllWhiteSpaces)
 * 	p.scanJsxText()
 * 	return p.finishNode(result, pos)
 * }
 */
export function Parser_parseJsxText(receiver: GoPtr<Parser>): GoPtr<Node> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(p);
  const result: GoPtr<Node> = NewJsxText(p.factory, Scanner_TokenValue(p.scanner), p.token === KindJsxTextAllWhiteSpaces);
  Parser_scanJsxText(p);
  return Parser_finishNode(p, result, pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxExpression","kind":"method","status":"implemented","sigHash":"74901976b4593c8cdae3af659873202ab3e062ec19fcefeb2e9115aeab5fdac9","bodyHash":"b5f5ab141fc6dbe246fb6d570e32edbe6017721db37b348ecb9fe778d33904e0"}
 *
 * Go source:
 * func (p *Parser) parseJsxExpression(inExpressionContext bool) *ast.Node {
 * 	pos := p.nodePos()
 * 	if !p.parseExpected(ast.KindOpenBraceToken) {
 * 		return nil
 * 	}
 * 	var dotDotDotToken *ast.Node
 * 	var expression *ast.Expression
 * 	if p.token != ast.KindCloseBraceToken {
 * 		if !inExpressionContext {
 * 			dotDotDotToken = p.parseOptionalToken(ast.KindDotDotDotToken)
 * 		}
 * 		// Only an AssignmentExpression is valid here per the JSX spec,
 * 		// but we can unambiguously parse a comma sequence and provide
 * 		// a better error message in grammar checking.
 * 		expression = p.parseExpression()
 * 	}
 * 	if inExpressionContext {
 * 		p.parseExpected(ast.KindCloseBraceToken)
 * 	} else if p.parseExpectedWithoutAdvancing(ast.KindCloseBraceToken) {
 * 		p.scanJsxText()
 * 	}
 * 	return p.finishNode(p.factory.NewJsxExpression(dotDotDotToken, expression), pos)
 * }
 */
export function Parser_parseJsxExpression(receiver: GoPtr<Parser>, inExpressionContext: bool): GoPtr<Node> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(p);
  if (!Parser_parseExpected(p, KindOpenBraceToken)) {
    return undefined;
  }
  // TS-Go declares these as zero-value `var`s, then assigns conditionally.
  let dotDotDotToken: GoPtr<Node> = undefined;
  let expression: GoPtr<Expression> = undefined;
  if (p.token !== KindCloseBraceToken) {
    if (!inExpressionContext) {
      dotDotDotToken = Parser_parseOptionalToken(p, KindDotDotDotToken);
    }
    // Only an AssignmentExpression is valid here per the JSX spec,
    // but we can unambiguously parse a comma sequence and provide
    // a better error message in grammar checking.
    expression = Parser_parseExpression(p);
  }
  if (inExpressionContext) {
    Parser_parseExpected(p, KindCloseBraceToken);
  } else if (Parser_parseExpectedWithoutAdvancing(p, KindCloseBraceToken)) {
    Parser_scanJsxText(p);
  }
  return Parser_finishNode(p, NewJsxExpression(p.factory, dotDotDotToken, expression), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.scanJsxText","kind":"method","status":"implemented","sigHash":"0ef6fa0b91de9055e33c708ea53031afac90ae6b654f3b329b3723f6293e3bf2","bodyHash":"025df79aea1ec425573a51b8345db8ad0d05b6817689ffb13fa31786b3ffc2f2"}
 *
 * Go source:
 * func (p *Parser) scanJsxText() ast.Kind {
 * 	p.token = p.scanner.ScanJsxToken()
 * 	return p.token
 * }
 */
export function Parser_scanJsxText(receiver: GoPtr<Parser>): Kind {
  const p: Parser = receiver!;
  p.token = Scanner_ScanJsxToken(p.scanner);
  return p.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.scanJsxIdentifier","kind":"method","status":"implemented","sigHash":"f1bb3eae06f9a067013f8706496a3d6573632eadc5b1a78821d9d578fb0310ad","bodyHash":"1cb3fed64e76cc3d2430c0e3367289fe5f8eb8a4a23222eb90c4e54f9247420b"}
 *
 * Go source:
 * func (p *Parser) scanJsxIdentifier() ast.Kind {
 * 	p.token = p.scanner.ScanJsxIdentifier()
 * 	return p.token
 * }
 */
export function Parser_scanJsxIdentifier(receiver: GoPtr<Parser>): Kind {
  const p: Parser = receiver!;
  p.token = Scanner_ScanJsxIdentifier(p.scanner);
  return p.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.scanJsxAttributeValue","kind":"method","status":"implemented","sigHash":"9695bf13a154d4646564f090d970d7380cea55d3ea4d576bea4cc087f672e549","bodyHash":"1510a65dc8635144da0184343cc4363acd7a4d9ca29b9a5a682ab5cb7d6e232a"}
 *
 * Go source:
 * func (p *Parser) scanJsxAttributeValue() ast.Kind {
 * 	p.token = p.scanner.ScanJsxAttributeValue()
 * 	return p.token
 * }
 */
export function Parser_scanJsxAttributeValue(receiver: GoPtr<Parser>): Kind {
  const p: Parser = receiver!;
  p.token = Scanner_ScanJsxAttributeValue(p.scanner);
  return p.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxClosingElement","kind":"method","status":"implemented","sigHash":"04f9fa766133656c23b06f0ed927a6ab49d5861b498f7175559b36ec02c18d1c","bodyHash":"fbd2a15cad30edb55ed7d4c7d9d4a472bf09a00d07b196a73b423969a52eb690"}
 *
 * Go source:
 * func (p *Parser) parseJsxClosingElement(open *ast.Node, inExpressionContext bool) *ast.Node {
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindLessThanSlashToken)
 * 	tagName := p.parseJsxElementName()
 * 	if p.parseExpectedWithDiagnostic(ast.KindGreaterThanToken, nil /*diagnosticMessage* /, false /*shouldAdvance* /) {
 * 		// manually advance the scanner in order to look for jsx text inside jsx
 * 		if inExpressionContext || !ast.TagNamesAreEquivalent(open.TagName(), tagName) {
 * 			p.nextToken()
 * 		} else {
 * 			p.scanJsxText()
 * 		}
 * 	}
 * 	return p.finishNode(p.factory.NewJsxClosingElement(tagName), pos)
 * }
 */
export function Parser_parseJsxClosingElement(receiver: GoPtr<Parser>, open: GoPtr<Node>, inExpressionContext: bool): GoPtr<Node> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(receiver);
  Parser_parseExpected(receiver, KindLessThanSlashToken);
  const tagName: GoPtr<Expression> = Parser_parseJsxElementName(receiver);
  if (Parser_parseExpectedWithDiagnostic(receiver, KindGreaterThanToken, undefined /*diagnosticMessage*/, false /*shouldAdvance*/)) {
    // manually advance the scanner in order to look for jsx text inside jsx
    if (inExpressionContext || !TagNamesAreEquivalent(Node_TagName(open), tagName)) {
      Parser_nextToken(receiver);
    } else {
      Parser_scanJsxText(receiver);
    }
  }
  return Parser_finishNode(receiver, NewJsxClosingElement(p.factory, tagName), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxOpeningOrSelfClosingElementOrOpeningFragment","kind":"method","status":"implemented","sigHash":"97275088ece351fa5ba3cfd69ab443aa6a96e044d2cfb4cb932284ee64943bcf","bodyHash":"59e09ebcca318063f46f82fdc75345a47fc9df38663bf68adee0b76445bb652e"}
 *
 * Go source:
 * func (p *Parser) parseJsxOpeningOrSelfClosingElementOrOpeningFragment(inExpressionContext bool) *ast.Expression {
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindLessThanToken)
 * 	if p.token == ast.KindGreaterThanToken {
 * 		// See below for explanation of scanJsxText
 * 		p.scanJsxText()
 * 		return p.finishNode(p.factory.NewJsxOpeningFragment(), pos)
 * 	}
 * 	tagName := p.parseJsxElementName()
 * 	var typeArguments *ast.NodeList
 * 	if p.contextFlags&ast.NodeFlagsJavaScriptFile == 0 {
 * 		typeArguments = p.parseTypeArguments()
 * 	}
 * 	attributes := p.parseJsxAttributes()
 * 	var result *ast.Expression
 * 	if p.token == ast.KindGreaterThanToken {
 * 		// Closing tag, so scan the immediately-following text with the JSX scanning instead
 * 		// of regular scanning to avoid treating illegal characters (e.g. '#') as immediate
 * 		// scanning errors
 * 		p.scanJsxText()
 * 		result = p.factory.NewJsxOpeningElement(tagName, typeArguments, attributes)
 * 	} else {
 * 		p.parseExpected(ast.KindSlashToken)
 * 		if p.parseExpectedWithoutAdvancing(ast.KindGreaterThanToken) {
 * 			if inExpressionContext {
 * 				p.nextToken()
 * 			} else {
 * 				p.scanJsxText()
 * 			}
 * 		}
 * 		result = p.factory.NewJsxSelfClosingElement(tagName, typeArguments, attributes)
 * 	}
 * 	return p.finishNode(result, pos)
 * }
 */
export function Parser_parseJsxOpeningOrSelfClosingElementOrOpeningFragment(receiver: GoPtr<Parser>, inExpressionContext: bool): GoPtr<Expression> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(p);
  Parser_parseExpected(p, KindLessThanToken);
  if (p.token === KindGreaterThanToken) {
    // See below for explanation of scanJsxText
    Parser_scanJsxText(p);
    return Parser_finishNode(p, NewJsxOpeningFragment(p.factory), pos);
  }
  const tagName: GoPtr<Expression> = Parser_parseJsxElementName(p);
  const typeArguments: GoPtr<NodeList> =
    (p.contextFlags & NodeFlagsJavaScriptFile) === 0 ? Parser_parseTypeArguments(p) : undefined;
  const attributes: GoPtr<Node> = Parser_parseJsxAttributes(p);
  if (p.token === KindGreaterThanToken) {
    // Closing tag, so scan the immediately-following text with the JSX scanning instead
    // of regular scanning to avoid treating illegal characters (e.g. '#') as immediate
    // scanning errors
    Parser_scanJsxText(p);
    return Parser_finishNode(p, NewJsxOpeningElement(p.factory, tagName, typeArguments, attributes), pos);
  }
  Parser_parseExpected(p, KindSlashToken);
  if (Parser_parseExpectedWithoutAdvancing(p, KindGreaterThanToken)) {
    if (inExpressionContext) {
      Parser_nextToken(p);
    } else {
      Parser_scanJsxText(p);
    }
  }
  return Parser_finishNode(p, NewJsxSelfClosingElement(p.factory, tagName, typeArguments, attributes), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxElementName","kind":"method","status":"implemented","sigHash":"71e5968bb817818be8e29c1eea0238c7c5961f59264bd50da27c7deb2ad1c644","bodyHash":"3bd7cdb6c4ef44fd53f2a0cfe3170c09b2cd5750308f94d78c507ab70714c36f"}
 *
 * Go source:
 * func (p *Parser) parseJsxElementName() *ast.Expression {
 * 	pos := p.nodePos()
 * 	// JsxElement can have name in the form of
 * 	//      propertyAccessExpression
 * 	//      primaryExpression in the form of an identifier and "this" keyword
 * 	// We can't just simply use parseLeftHandSideExpressionOrHigher because then we will start consider class,function etc as a keyword
 * 	// We only want to consider "this" as a primaryExpression
 * 	initialExpression := p.parseJsxTagName()
 * 	if ast.IsJsxNamespacedName(initialExpression) {
 * 		return initialExpression // `a:b.c` is invalid syntax, don't even look for the `.` if we parse `a:b`, and let `parseAttribute` report "unexpected :" instead.
 * 	}
 * 	expression := initialExpression
 * 	for p.parseOptional(ast.KindDotToken) {
 * 		expression = p.finishNode(p.factory.NewPropertyAccessExpression(expression, nil, p.parseRightSideOfDot(true /*allowIdentifierNames* /, false /*allowPrivateIdentifiers* /, false /*allowUnicodeEscapeSequenceInIdentifierName* /), ast.NodeFlagsNone), pos)
 * 	}
 * 	return expression
 * }
 */
export function Parser_parseJsxElementName(receiver: GoPtr<Parser>): GoPtr<Expression> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(p);
  // JsxElement can have name in the form of
  //      propertyAccessExpression
  //      primaryExpression in the form of an identifier and "this" keyword
  // We can't just simply use parseLeftHandSideExpressionOrHigher because then we will start consider class,function etc as a keyword
  // We only want to consider "this" as a primaryExpression
  const initialExpression: GoPtr<Expression> = Parser_parseJsxTagName(p);
  if (IsJsxNamespacedName(initialExpression)) {
    return initialExpression; // `a:b.c` is invalid syntax, don't even look for the `.` if we parse `a:b`, and let `parseAttribute` report "unexpected :" instead.
  }
  // TS-Go reassigns `expression` across the loop (controlled in-place mutation).
  let expression: GoPtr<Expression> = initialExpression;
  while (Parser_parseOptional(p, KindDotToken)) {
    expression = Parser_finishNode(
      p,
      NewPropertyAccessExpression(
        p.factory,
        expression,
        undefined,
        Parser_parseRightSideOfDot(
          p,
          true /*allowIdentifierNames*/,
          false /*allowPrivateIdentifiers*/,
          false /*allowUnicodeEscapeSequenceInIdentifierName*/,
        ),
        NodeFlagsNone,
      ),
      pos,
    );
  }
  return expression;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxTagName","kind":"method","status":"implemented","sigHash":"7be0a9bb117eb9ef95d4df30211ef90be403c076c72062a3bf8f91588b782b42","bodyHash":"11ec71de6ab69c81efbb2e5c964384f569499c55cf40cb7a10599d99c4935b94"}
 *
 * Go source:
 * func (p *Parser) parseJsxTagName() *ast.Expression {
 * 	pos := p.nodePos()
 * 	p.scanJsxIdentifier()
 * 	isThis := p.token == ast.KindThisKeyword
 * 	tagName := p.parseIdentifierNameErrorOnUnicodeEscapeSequence()
 * 	if p.parseOptional(ast.KindColonToken) {
 * 		p.scanJsxIdentifier()
 * 		return p.finishNode(p.factory.NewJsxNamespacedName(tagName, p.parseIdentifierNameErrorOnUnicodeEscapeSequence()), pos)
 * 	}
 * 	if isThis {
 * 		result := p.factory.NewKeywordExpression(ast.KindThisKeyword)
 * 		return p.finishNode(result, pos)
 * 	}
 * 	return tagName
 * }
 */
export function Parser_parseJsxTagName(receiver: GoPtr<Parser>): GoPtr<Expression> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(p);
  Parser_scanJsxIdentifier(p);
  const isThis: bool = p.token === KindThisKeyword;
  const tagName: GoPtr<Node> = Parser_parseIdentifierNameErrorOnUnicodeEscapeSequence(p);
  if (Parser_parseOptional(p, KindColonToken)) {
    Parser_scanJsxIdentifier(p);
    return Parser_finishNode(p, NewJsxNamespacedName(p.factory, tagName, Parser_parseIdentifierNameErrorOnUnicodeEscapeSequence(p)), pos);
  }
  if (isThis) {
    const result: GoPtr<Node> = NewKeywordExpression(p.factory, KindThisKeyword);
    return Parser_finishNode(p, result, pos);
  }
  return tagName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxAttributes","kind":"method","status":"implemented","sigHash":"6d703c45aa9250bef9977372dc1919a06fa3b6c6a0784f616113d7a6c2371ef3","bodyHash":"84531db953347cac264d2b5d874dc2021559b07ada4c2055867904f8d959830e"}
 *
 * Go source:
 * func (p *Parser) parseJsxAttributes() *ast.Node {
 * 	pos := p.nodePos()
 * 	return p.finishNode(p.factory.NewJsxAttributes(p.parseList(PCJsxAttributes, (*Parser).parseJsxAttribute)), pos)
 * }
 */
export function Parser_parseJsxAttributes(receiver: GoPtr<Parser>): GoPtr<Node> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(p);
  return Parser_finishNode(p, NewJsxAttributes(p.factory, Parser_parseList(p, PCJsxAttributes, Parser_parseJsxAttribute)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxAttribute","kind":"method","status":"implemented","sigHash":"7aa694085fef1e34f8d5a230ec26b3e9ef79e519cff696955f13b335b7efc852","bodyHash":"a1588d50bd6416d74ff61210e241e0be9cf22d5a5d9a8f508bd2b3e55d0b28cc"}
 *
 * Go source:
 * func (p *Parser) parseJsxAttribute() *ast.Node {
 * 	if p.token == ast.KindOpenBraceToken {
 * 		return p.parseJsxSpreadAttribute()
 * 	}
 * 	pos := p.nodePos()
 * 	return p.finishNode(p.factory.NewJsxAttribute(p.parseJsxAttributeName(), p.parseJsxAttributeValue()), pos)
 * }
 */
export function Parser_parseJsxAttribute(receiver: GoPtr<Parser>): GoPtr<Node> {
  const p: Parser = receiver!;
  if (p.token === KindOpenBraceToken) {
    return Parser_parseJsxSpreadAttribute(p);
  }
  const pos: int = Parser_nodePos(p);
  return Parser_finishNode(p, NewJsxAttribute(p.factory, Parser_parseJsxAttributeName(p), Parser_parseJsxAttributeValue(p)), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxSpreadAttribute","kind":"method","status":"implemented","sigHash":"bb120821b85f5df4aee364a590fa12ef6de130daa56cc22f3b411e36ed42743b","bodyHash":"38ce6ab480b34c902999f1a2ee30a05b116cb6533efe18abd80cd2627660660f"}
 *
 * Go source:
 * func (p *Parser) parseJsxSpreadAttribute() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindOpenBraceToken)
 * 	p.parseExpected(ast.KindDotDotDotToken)
 * 	expression := p.parseExpression()
 * 	p.parseExpected(ast.KindCloseBraceToken)
 * 	return p.finishNode(p.factory.NewJsxSpreadAttribute(expression), pos)
 * }
 */
export function Parser_parseJsxSpreadAttribute(receiver: GoPtr<Parser>): GoPtr<Node> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(p);
  Parser_parseExpected(p, KindOpenBraceToken);
  Parser_parseExpected(p, KindDotDotDotToken);
  const expression: GoPtr<Expression> = Parser_parseExpression(p);
  Parser_parseExpected(p, KindCloseBraceToken);
  return Parser_finishNode(p, NewJsxSpreadAttribute(p.factory, expression), pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxAttributeName","kind":"method","status":"implemented","sigHash":"72b184b2fcaa4f9f6722403091982167e155fe5df03144545759773904233811","bodyHash":"0556e61417e3dc6f92e6ac227f95ffa3c5eff1f91165cef6f4eeaf9fa8b07d36"}
 *
 * Go source:
 * func (p *Parser) parseJsxAttributeName() *ast.Node {
 * 	pos := p.nodePos()
 * 	p.scanJsxIdentifier()
 * 	attrName := p.parseIdentifierNameErrorOnUnicodeEscapeSequence()
 * 	if p.parseOptional(ast.KindColonToken) {
 * 		p.scanJsxIdentifier()
 * 		return p.finishNode(p.factory.NewJsxNamespacedName(attrName, p.parseIdentifierNameErrorOnUnicodeEscapeSequence()), pos)
 * 	}
 * 	return attrName
 * }
 */
export function Parser_parseJsxAttributeName(receiver: GoPtr<Parser>): GoPtr<Node> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(p);
  Parser_scanJsxIdentifier(p);
  const attrName: GoPtr<Node> = Parser_parseIdentifierNameErrorOnUnicodeEscapeSequence(p);
  if (Parser_parseOptional(p, KindColonToken)) {
    Parser_scanJsxIdentifier(p);
    return Parser_finishNode(p, NewJsxNamespacedName(p.factory, attrName, Parser_parseIdentifierNameErrorOnUnicodeEscapeSequence(p)), pos);
  }
  return attrName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxAttributeValue","kind":"method","status":"implemented","sigHash":"08d7fe8e636efdc030192e2d9fbf6321f76f7cd3073848d0591be73a1a0e2e25","bodyHash":"58b7291d7c388945a8f2027be217fb2ebd4a56661f0bf1ee2a86dcc319f75046"}
 *
 * Go source:
 * func (p *Parser) parseJsxAttributeValue() *ast.Expression {
 * 	if p.token == ast.KindEqualsToken {
 * 		if p.scanJsxAttributeValue() == ast.KindStringLiteral {
 * 			return p.parseLiteralExpression(false /*intern* /)
 * 		}
 * 		if p.token == ast.KindOpenBraceToken {
 * 			return p.parseJsxExpression( /*inExpressionContext* / true)
 * 		}
 * 		if p.token == ast.KindLessThanToken {
 * 			return p.parseJsxElementOrSelfClosingElementOrFragment(true /*inExpressionContext* /, -1, nil, false)
 * 		}
 * 		p.parseErrorAtCurrentToken(diagnostics.X_or_JSX_element_expected)
 * 	}
 * 	return nil
 * }
 */
export function Parser_parseJsxAttributeValue(receiver: GoPtr<Parser>): GoPtr<Expression> {
  const p: Parser = receiver!;
  if (p.token === KindEqualsToken) {
    if (Parser_scanJsxAttributeValue(p) === KindStringLiteral) {
      return Parser_parseLiteralExpression(p, false /*intern*/);
    }
    if (p.token === KindOpenBraceToken) {
      return Parser_parseJsxExpression(p, /*inExpressionContext*/ true);
    }
    if (p.token === KindLessThanToken) {
      return Parser_parseJsxElementOrSelfClosingElementOrFragment(p, true /*inExpressionContext*/, -1, undefined, false);
    }
    Parser_parseErrorAtCurrentToken(p, X_or_JSX_element_expected);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseJsxClosingFragment","kind":"method","status":"implemented","sigHash":"4a318add214cf1da80c8edaa0751c371c412e2d5eb53010a54963e197d90eb31","bodyHash":"fb21ac33e8fb4370da65f38c274b1b63845c5f4bb0c348fbcb038c92936870fc"}
 *
 * Go source:
 * func (p *Parser) parseJsxClosingFragment(inExpressionContext bool) *ast.Node {
 * 	pos := p.nodePos()
 * 	p.parseExpected(ast.KindLessThanSlashToken)
 * 	if p.parseExpectedWithDiagnostic(ast.KindGreaterThanToken, diagnostics.Expected_corresponding_closing_tag_for_JSX_fragment, false /*shouldAdvance* /) {
 * 		// manually advance the scanner in order to look for jsx text inside jsx
 * 		if inExpressionContext {
 * 			p.nextToken()
 * 		} else {
 * 			p.scanJsxText()
 * 		}
 * 	}
 * 	return p.finishNode(p.factory.NewJsxClosingFragment(), pos)
 * }
 */
export function Parser_parseJsxClosingFragment(receiver: GoPtr<Parser>, inExpressionContext: bool): GoPtr<Node> {
  const p: Parser = receiver!;
  const pos: int = Parser_nodePos(p);
  Parser_parseExpected(p, KindLessThanSlashToken);
  if (Parser_parseExpectedWithDiagnostic(p, KindGreaterThanToken, Expected_corresponding_closing_tag_for_JSX_fragment, false /*shouldAdvance*/)) {
    // manually advance the scanner in order to look for jsx text inside jsx
    if (inExpressionContext) {
      Parser_nextToken(p);
    } else {
      Parser_scanJsxText(p);
    }
  }
  return Parser_finishNode(p, NewJsxClosingFragment(p.factory), pos);
}
