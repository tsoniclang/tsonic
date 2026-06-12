import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { ModifierList, Node, NodeList } from "../../ast/spine.js";
import { NodeFactory_NewModifierList, NodeFactory_NewNodeList } from "../../ast/spine.js";
import type { Kind } from "../../ast/generated/kinds.js";
import {
  KindAsteriskToken,
  KindCaseKeyword,
  KindCloseBraceToken,
  KindCloseBracketToken,
  KindCloseParenToken,
  KindCommaToken,
  KindConstKeyword,
  KindDefaultKeyword,
  KindDotDotDotToken,
  KindDotToken,
  KindEndOfFile,
  KindEqualsGreaterThanToken,
  KindExtendsKeyword,
  KindFromKeyword,
  KindGreaterThanToken,
  KindImplementsKeyword,
  KindInKeyword,
  KindLessThanToken,
  KindOfKeyword,
  KindOpenBraceToken,
  KindOpenBracketToken,
  KindOpenParenToken,
  KindSemicolonToken,
  KindSlashToken,
  KindStringLiteral,
} from "../../ast/generated/kinds.js";
import { NodeFlagsAwaitContext, NodeFlagsYieldContext } from "../../ast/generated/flags.js";
import { IsJSTypeAliasDeclaration, IsJSImportDeclaration } from "../../ast/generated/predicates.js";
import { Some } from "../../core/core.js";
import { Arena_Clone } from "../../core/arena.js";
import type { Arena } from "../../core/arena.js";
import type { TextRange } from "../../core/text.js";
import { NewTextRange } from "../../core/text.js";
import { An_enum_member_name_must_be_followed_by_a_or } from "../../diagnostics/generated/messages.js";
import type { ParseFlags } from "../types.js";
import { ParseFlagsAwait, ParseFlagsType, ParseFlagsYield } from "../types.js";
import { tokenIsIdentifierOrKeyword } from "../utilities.js";
import {
  Parser_isLiteralPropertyName,
  Parser_isStartOfExpression,
  Parser_isStartOfLeftHandSideExpression,
  Parser_nextTokenIsTokenStringLiteral,
  Parser_parseArgumentExpression,
  Parser_scanClassMemberStart,
} from "./expressions.js";
import {
  Parser_canParseSemicolon,
  Parser_checkJSSyntax,
  Parser_isStartOfParameter,
  Parser_lookAhead,
  Parser_nodePos,
  Parser_parseOptional,
  Parser_parseParameterEx,
  isAsyncModifier,
} from "./support.js";
import {
  Parser_hasPrecedingLineBreak,
  Parser_isImportAttributeName,
  Parser_isStartOfStatement,
} from "./statements-declarations.js";
import {
  Parser_isBindingIdentifierOrPrivateIdentifierOrPattern,
  Parser_isIdentifier,
  Parser_isInSomeParsingContext,
  Parser_nextToken,
  Parser_nextTokenIsSlash,
  Parser_parseErrorAtCurrentToken,
  Parser_parseExpected,
  Parser_parsingContextErrors,
  Parser_setContextFlags,
} from "./tokens-speculation.js";
import {
  Parser_isHeritageClause,
  Parser_isHeritageClauseExtendsOrImplementsKeyword,
  Parser_isStartOfType,
  Parser_isValidHeritageClauseObjectLiteral,
  Parser_scanTypeMemberStart,
} from "./types.js";
import type { Parser, ParsingContext } from "./state.js";
import {
  missingListNodes,
  PCArgumentExpressions,
  PCArrayBindingElements,
  PCArrayLiteralMembers,
  PCBlockStatements,
  PCClassMembers,
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
} from "./state.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::isMissingNodeList","kind":"func","status":"implemented","sigHash":"ef01f56717a6fef68fa90b7c8e0d0661d60d9b4e006200f3148352792a8db128","bodyHash":"b53c8f6553b7a6726bb00719752ad20830f42dca147da8eb3d665c6e7c603bb6"}
 *
 * Go source:
 * func isMissingNodeList(list *ast.NodeList) bool {
 * 	return list != nil && cap(list.Nodes) == 1 && &list.Nodes[:1][0] == &missingListNodes[:1][0]
 * }
 */
export function isMissingNodeList(list: GoPtr<NodeList>): bool {
  return list !== undefined && list.Nodes === missingListNodes;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseListIndex","kind":"method","status":"implemented","sigHash":"1d1024ac238a1e697aeefe86d57f12bb4cacec3322cbbcc395f5234bae911a77","bodyHash":"86567cedd0ff7297dfbd74b9ec0e4d0146c770ea24602e14ba29fa6da7e6892a"}
 *
 * Go source:
 * func (p *Parser) parseListIndex(kind ParsingContext, parseElement func(p *Parser, index int) *ast.Node) []*ast.Node {
 * 	saveParsingContexts := p.parsingContexts
 * 	p.parsingContexts |= 1 << kind
 * 	outerReparseList := p.reparseList
 * 	p.reparseList = nil
 * 	list := make([]*ast.Node, 0, 16)
 * 	for i := 0; !p.isListTerminator(kind); i++ {
 * 		if p.isListElement(kind, false /*inErrorRecovery* /) {
 * 			elt := parseElement(p, len(list))
 * 			if len(p.reparseList) != 0 {
 * 				for _, e := range p.reparseList {
 * 					// Propagate @typedef type alias declarations outwards to a context that permits them.
 * 					if (ast.IsJSTypeAliasDeclaration(e) || ast.IsJSImportDeclaration(e)) && kind != PCSourceElements && kind != PCBlockStatements {
 * 						outerReparseList = append(outerReparseList, e)
 * 					} else {
 * 						list = append(list, e)
 * 					}
 * 				}
 * 				p.reparseList = nil
 * 			}
 * 			list = append(list, elt)
 * 			continue
 * 		}
 * 		if p.abortParsingListOrMoveToNextToken(kind) {
 * 			break
 * 		}
 * 	}
 * 	p.reparseList = outerReparseList
 * 	p.parsingContexts = saveParsingContexts
 * 	return p.nodeSliceArena.Clone(list)
 * }
 */
export function Parser_parseListIndex(receiver: GoPtr<Parser>, kind: ParsingContext, parseElement: (p: GoPtr<Parser>, index: int) => GoPtr<Node>): GoSlice<GoPtr<Node>> {
  const saveParsingContexts = receiver!.parsingContexts;
  receiver!.parsingContexts |= 1 << kind;
  const outerReparseList = receiver!.reparseList;
  receiver!.reparseList = [];
  let list: Array<GoPtr<Node>> = [];
  for (let i = 0; !Parser_isListTerminator(receiver, kind); i++) {
    if (Parser_isListElement(receiver, kind, false /*inErrorRecovery*/)) {
      const elt = parseElement(receiver, list.length);
      if (receiver!.reparseList.length !== 0) {
        for (const e of receiver!.reparseList) {
          // Propagate @typedef type alias declarations outwards to a context that permits them.
          if ((IsJSTypeAliasDeclaration(e) || IsJSImportDeclaration(e)) && kind !== PCSourceElements && kind !== PCBlockStatements) {
            outerReparseList.push(e);
          } else {
            list.push(e);
          }
        }
        receiver!.reparseList = [];
      }
      list.push(elt);
      continue;
    }
    if (Parser_abortParsingListOrMoveToNextToken(receiver, kind)) {
      break;
    }
  }
  receiver!.reparseList = outerReparseList;
  receiver!.parsingContexts = saveParsingContexts;
  return Arena_Clone(receiver!.nodeSliceArena as GoPtr<Arena<GoPtr<Node>>>, list);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseList","kind":"method","status":"implemented","sigHash":"63dbd3ed7db8673c7bd7ba4e100ecb3c3810f665b0c7ae1fa30a3d22372a4101","bodyHash":"0f7849bd39848f2d9f5e4add9248d3484cea9e66768683ae36937f2261928078"}
 *
 * Go source:
 * func (p *Parser) parseList(kind ParsingContext, parseElement func(p *Parser) *ast.Node) *ast.NodeList {
 * 	pos := p.nodePos()
 * 	nodes := p.parseListIndex(kind, func(p *Parser, _ int) *ast.Node { return parseElement(p) })
 * 	return p.newNodeList(core.NewTextRange(pos, p.nodePos()), nodes)
 * }
 */
export function Parser_parseList(receiver: GoPtr<Parser>, kind: ParsingContext, parseElement: (p: GoPtr<Parser>) => GoPtr<Node>): GoPtr<NodeList> {
  const pos = Parser_nodePos(receiver);
  const nodes = Parser_parseListIndex(receiver, kind, (p: GoPtr<Parser>, _index: int): GoPtr<Node> => parseElement(p));
  return Parser_newNodeList(receiver, NewTextRange(pos, Parser_nodePos(receiver)), nodes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseDelimitedList","kind":"method","status":"implemented","sigHash":"535b3a85ba41764406588faf13e3a1fd9335d6ae51b44086d6a294f9079abf54","bodyHash":"2f9ddfe81301f5e980596969bf910138bb1a6d5dbfea0d023e53d1bfc5dcdf8b"}
 *
 * Go source:
 * func (p *Parser) parseDelimitedList(kind ParsingContext, parseElement func(p *Parser) *ast.Node) *ast.NodeList {
 * 	pos := p.nodePos()
 * 	saveParsingContexts := p.parsingContexts
 * 	p.parsingContexts |= 1 << kind
 * 	list := make([]*ast.Node, 0, 16)
 * 	for {
 * 		if p.isListElement(kind, false /*inErrorRecovery* /) {
 * 			startPos := p.nodePos()
 * 			element := parseElement(p)
 * 			if element == nil {
 * 				p.parsingContexts = saveParsingContexts
 * 				// Return nil to indicate parseElement failed
 * 				return nil
 * 			}
 * 			list = append(list, element)
 * 			if p.parseOptional(ast.KindCommaToken) {
 * 				// No need to check for a zero length node since we know we parsed a comma
 * 				continue
 * 			}
 * 			if p.isListTerminator(kind) {
 * 				break
 * 			}
 * 			// We didn't get a comma, and the list wasn't terminated, explicitly parse
 * 			// out a comma so we give a good error message.
 * 			if p.token != ast.KindCommaToken && kind == PCEnumMembers {
 * 				p.parseErrorAtCurrentToken(diagnostics.An_enum_member_name_must_be_followed_by_a_or)
 * 			} else {
 * 				p.parseExpected(ast.KindCommaToken)
 * 			}
 * 			// If the token was a semicolon, and the caller allows that, then skip it and
 * 			// continue.  This ensures we get back on track and don't result in tons of
 * 			// parse errors.  For example, this can happen when people do things like use
 * 			// a semicolon to delimit object literal members.   Note: we'll have already
 * 			// reported an error when we called parseExpected above.
 * 			if (kind == PCObjectLiteralMembers || kind == PCImportAttributes) && p.token == ast.KindSemicolonToken && !p.hasPrecedingLineBreak() {
 * 				p.nextToken()
 * 			}
 * 			if startPos == p.nodePos() {
 * 				// What we're parsing isn't actually remotely recognizable as a element and we've consumed no tokens whatsoever
 * 				// Consume a token to advance the parser in some way and avoid an infinite loop
 * 				// This can happen when we're speculatively parsing parenthesized expressions which we think may be arrow functions,
 * 				// or when a modifier keyword which is disallowed as a parameter name (ie, `static` in strict mode) is supplied
 * 				p.nextToken()
 * 			}
 * 			continue
 * 		}
 * 		if p.isListTerminator(kind) {
 * 			break
 * 		}
 * 		if p.abortParsingListOrMoveToNextToken(kind) {
 * 			break
 * 		}
 * 	}
 * 	p.parsingContexts = saveParsingContexts
 * 	return p.newNodeList(core.NewTextRange(pos, p.nodePos()), p.nodeSliceArena.Clone(list))
 * }
 */
export function Parser_parseDelimitedList(receiver: GoPtr<Parser>, kind: ParsingContext, parseElement: (p: GoPtr<Parser>) => GoPtr<Node>): GoPtr<NodeList> {
  const pos = Parser_nodePos(receiver);
  const saveParsingContexts = receiver!.parsingContexts;
  receiver!.parsingContexts |= 1 << kind;
  let list: Array<GoPtr<Node>> = [];
  for (;;) {
    if (Parser_isListElement(receiver, kind, false /*inErrorRecovery*/)) {
      const startPos = Parser_nodePos(receiver);
      const element = parseElement(receiver);
      if (element === undefined) {
        receiver!.parsingContexts = saveParsingContexts;
        // Return nil to indicate parseElement failed
        return undefined;
      }
      list.push(element);
      if (Parser_parseOptional(receiver, KindCommaToken)) {
        // No need to check for a zero length node since we know we parsed a comma
        continue;
      }
      if (Parser_isListTerminator(receiver, kind)) {
        break;
      }
      // We didn't get a comma, and the list wasn't terminated, explicitly parse
      // out a comma so we give a good error message.
      if (receiver!.token !== KindCommaToken && kind === PCEnumMembers) {
        Parser_parseErrorAtCurrentToken(receiver, An_enum_member_name_must_be_followed_by_a_or);
      } else {
        Parser_parseExpected(receiver, KindCommaToken);
      }
      // If the token was a semicolon, and the caller allows that, then skip it and
      // continue.  This ensures we get back on track and don't result in tons of
      // parse errors.  For example, this can happen when people do things like use
      // a semicolon to delimit object literal members.   Note: we'll have already
      // reported an error when we called parseExpected above.
      if ((kind === PCObjectLiteralMembers || kind === PCImportAttributes) && receiver!.token === KindSemicolonToken && !Parser_hasPrecedingLineBreak(receiver)) {
        Parser_nextToken(receiver);
      }
      if (startPos === Parser_nodePos(receiver)) {
        // What we're parsing isn't actually remotely recognizable as a element and we've consumed no tokens whatsoever
        // Consume a token to advance the parser in some way and avoid an infinite loop
        // This can happen when we're speculatively parsing parenthesized expressions which we think may be arrow functions,
        // or when a modifier keyword which is disallowed as a parameter name (ie, `static` in strict mode) is supplied
        Parser_nextToken(receiver);
      }
      continue;
    }
    if (Parser_isListTerminator(receiver, kind)) {
      break;
    }
    if (Parser_abortParsingListOrMoveToNextToken(receiver, kind)) {
      break;
    }
  }
  receiver!.parsingContexts = saveParsingContexts;
  return Parser_newNodeList(receiver, NewTextRange(pos, Parser_nodePos(receiver)), Arena_Clone(receiver!.nodeSliceArena as GoPtr<Arena<GoPtr<Node>>>, list));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseBracketedList","kind":"method","status":"implemented","sigHash":"07036af7a3f3bf3b22bcc19333ef4da4b325369cbfded5339b717ab6b25c6baa","bodyHash":"e7d9182ee2b6b7e04fe1abae9f9f21996ed90979cbf8150b3ae74091315c1e4f"}
 *
 * Go source:
 * func (p *Parser) parseBracketedList(kind ParsingContext, parseElement func(p *Parser) *ast.Node, opening ast.Kind, closing ast.Kind) *ast.NodeList {
 * 	if p.parseExpected(opening) {
 * 		result := p.parseDelimitedList(kind, parseElement)
 * 		p.parseExpected(closing)
 * 		return result
 * 	}
 * 	return p.createMissingList()
 * }
 */
export function Parser_parseBracketedList(receiver: GoPtr<Parser>, kind: ParsingContext, parseElement: (p: GoPtr<Parser>) => GoPtr<Node>, opening: Kind, closing: Kind): GoPtr<NodeList> {
  if (Parser_parseExpected(receiver, opening)) {
    const result = Parser_parseDelimitedList(receiver, kind, parseElement);
    Parser_parseExpected(receiver, closing);
    return result;
  }
  return Parser_createMissingList(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseEmptyNodeList","kind":"method","status":"implemented","sigHash":"f0a2bb7854645c36d592d6fdc929b45f00e723690b48cbac72094c8e76401b8f","bodyHash":"ac2ff8b87d4a2763ee0db5811c2e90eccbac43c6554d9a19efdde39a582c248a"}
 *
 * Go source:
 * func (p *Parser) parseEmptyNodeList() *ast.NodeList {
 * 	return p.newNodeList(core.NewTextRange(p.nodePos(), p.nodePos()), nil)
 * }
 */
export function Parser_parseEmptyNodeList(receiver: GoPtr<Parser>): GoPtr<NodeList> {
  return Parser_newNodeList(receiver, NewTextRange(Parser_nodePos(receiver), Parser_nodePos(receiver)), []);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.createMissingList","kind":"method","status":"implemented","sigHash":"b12492fba945c25b89b51b6baa3f4adf7982bd2b1907367238dc406d7a895e1d","bodyHash":"d9c98cb6259a1a59bdcd046aae4aca0767dc3233f7f333f3af0660830ae73a89"}
 *
 * Go source:
 * func (p *Parser) createMissingList() *ast.NodeList {
 * 	result := p.parseEmptyNodeList()
 * 	result.Nodes = missingListNodes
 * 	return result
 * }
 */
export function Parser_createMissingList(receiver: GoPtr<Parser>): GoPtr<NodeList> {
  const result = Parser_parseEmptyNodeList(receiver);
  result!.Nodes = missingListNodes;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.abortParsingListOrMoveToNextToken","kind":"method","status":"implemented","sigHash":"8cadcb46e30521780f9d7774ed43145c8160d6bb30fc487b4c2ca9b4133558e1","bodyHash":"f196188cae24a17a29f7abfe450b424dd3a5c28aea7255b794f6e43e988f54ef"}
 *
 * Go source:
 * func (p *Parser) abortParsingListOrMoveToNextToken(kind ParsingContext) bool {
 * 	p.parsingContextErrors(kind)
 * 	if p.isInSomeParsingContext() {
 * 		return true
 * 	}
 * 	p.nextToken()
 * 	return false
 * }
 */
export function Parser_abortParsingListOrMoveToNextToken(receiver: GoPtr<Parser>, kind: ParsingContext): bool {
  Parser_parsingContextErrors(receiver, kind);
  if (Parser_isInSomeParsingContext(receiver)) {
    return true;
  }
  Parser_nextToken(receiver);
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isListElement","kind":"method","status":"implemented","sigHash":"35e90415b6599f8ea4ae8477fbdec61cf6e51d08ffca026b087ff07f1a2d2ffe","bodyHash":"2386183d422832b6152c45c35b1901d3e8fb2ae1c25f66133fc3ecfd02cf0ad6"}
 *
 * Go source:
 * func (p *Parser) isListElement(parsingContext ParsingContext, inErrorRecovery bool) bool {
 * 	switch parsingContext {
 * 	case PCSourceElements, PCBlockStatements, PCSwitchClauseStatements:
 * 		// If we're in error recovery, then we don't want to treat ';' as an empty statement.
 * 		// The problem is that ';' can show up in far too many contexts, and if we see one
 * 		// and assume it's a statement, then we may bail out inappropriately from whatever
 * 		// we're parsing.  For example, if we have a semicolon in the middle of a class, then
 * 		// we really don't want to assume the class is over and we're on a statement in the
 * 		// outer module.  We just want to consume and move on.
 * 		return !(p.token == ast.KindSemicolonToken && inErrorRecovery) && p.isStartOfStatement()
 * 	case PCSwitchClauses:
 * 		return p.token == ast.KindCaseKeyword || p.token == ast.KindDefaultKeyword
 * 	case PCTypeMembers:
 * 		return p.lookAhead((*Parser).scanTypeMemberStart)
 * 	case PCClassMembers:
 * 		// We allow semicolons as class elements (as specified by ES6) as long as we're
 * 		// not in error recovery.  If we're in error recovery, we don't want an errant
 * 		// semicolon to be treated as a class member (since they're almost always used
 * 		// for statements.
 * 		return p.lookAhead((*Parser).scanClassMemberStart) || p.token == ast.KindSemicolonToken && !inErrorRecovery
 * 	case PCEnumMembers:
 * 		// Include open bracket computed properties. This technically also lets in indexers,
 * 		// which would be a candidate for improved error reporting.
 * 		return p.token == ast.KindOpenBracketToken || p.isLiteralPropertyName()
 * 	case PCObjectLiteralMembers:
 * 		switch p.token {
 * 		case ast.KindOpenBracketToken, ast.KindAsteriskToken, ast.KindDotDotDotToken, ast.KindDotToken: // Not an object literal member, but don't want to close the object (see `tests/cases/fourslash/completionsDotInObjectLiteral.ts`)
 * 			return true
 * 		default:
 * 			return p.isLiteralPropertyName()
 * 		}
 * 	case PCRestProperties:
 * 		return p.isLiteralPropertyName()
 * 	case PCObjectBindingElements:
 * 		return p.token == ast.KindOpenBracketToken || p.token == ast.KindDotDotDotToken || p.isLiteralPropertyName()
 * 	case PCImportAttributes:
 * 		return p.isImportAttributeName()
 * 	case PCHeritageClauseElement:
 * 		// If we see `{ ... }` then only consume it as an expression if it is followed by `,` or `{`
 * 		// That way we won't consume the body of a class in its heritage clause.
 * 		if p.token == ast.KindOpenBraceToken {
 * 			return p.isValidHeritageClauseObjectLiteral()
 * 		}
 * 		if !inErrorRecovery {
 * 			return p.isStartOfLeftHandSideExpression() && !p.isHeritageClauseExtendsOrImplementsKeyword()
 * 		}
 * 		// If we're in error recovery we tighten up what we're willing to match.
 * 		// That way we don't treat something like "this" as a valid heritage clause
 * 		// element during recovery.
 * 		return p.isIdentifier() && !p.isHeritageClauseExtendsOrImplementsKeyword()
 * 	case PCVariableDeclarations:
 * 		return p.isBindingIdentifierOrPrivateIdentifierOrPattern()
 * 	case PCArrayBindingElements:
 * 		return p.token == ast.KindCommaToken || p.token == ast.KindDotDotDotToken || p.isBindingIdentifierOrPrivateIdentifierOrPattern()
 * 	case PCTypeParameters:
 * 		return p.token == ast.KindInKeyword || p.token == ast.KindConstKeyword || p.isIdentifier()
 * 	case PCArrayLiteralMembers:
 * 		// Not an array literal member, but don't want to close the array (see `tests/cases/fourslash/completionsDotInArrayLiteralInObjectLiteral.ts`)
 * 		if p.token == ast.KindCommaToken || p.token == ast.KindDotToken {
 * 			return true
 * 		}
 * 		fallthrough
 * 	case PCArgumentExpressions:
 * 		return p.token == ast.KindDotDotDotToken || p.isStartOfExpression()
 * 	case PCParameters:
 * 		return p.isStartOfParameter(false /*isJSDocParameter* /)
 * 	case PCJSDocParameters:
 * 		return p.isStartOfParameter(true /*isJSDocParameter* /)
 * 	case PCTypeArguments, PCTupleElementTypes:
 * 		return p.token == ast.KindCommaToken || p.isStartOfType(false /*inStartOfParameter* /)
 * 	case PCHeritageClauses:
 * 		return p.isHeritageClause()
 * 	case PCImportOrExportSpecifiers:
 * 		// bail out if the next token is [FromKeyword StringLiteral].
 * 		// That means we're in something like `import { from "mod"`. Stop here can give better error message.
 * 		if p.token == ast.KindFromKeyword && p.lookAhead((*Parser).nextTokenIsTokenStringLiteral) {
 * 			return false
 * 		}
 * 		if p.token == ast.KindStringLiteral {
 * 			return true // For "arbitrary module namespace identifiers"
 * 		}
 * 		return tokenIsIdentifierOrKeyword(p.token)
 * 	case PCJsxAttributes:
 * 		return tokenIsIdentifierOrKeyword(p.token) || p.token == ast.KindOpenBraceToken
 * 	case PCJsxChildren:
 * 		return true
 * 	case PCJSDocComment:
 * 		return true
 * 	}
 * 	panic("Unhandled case in isListElement")
 * }
 */
export function Parser_isListElement(receiver: GoPtr<Parser>, parsingContext: ParsingContext, inErrorRecovery: bool): bool {
  switch (parsingContext) {
    case PCSourceElements:
    case PCBlockStatements:
    case PCSwitchClauseStatements:
      // If we're in error recovery, then we don't want to treat ';' as an empty statement.
      // The problem is that ';' can show up in far too many contexts, and if we see one
      // and assume it's a statement, then we may bail out inappropriately from whatever
      // we're parsing.  For example, if we have a semicolon in the middle of a class, then
      // we really don't want to assume the class is over and we're on a statement in the
      // outer module.  We just want to consume and move on.
      return !(receiver!.token === KindSemicolonToken && inErrorRecovery) && Parser_isStartOfStatement(receiver);
    case PCSwitchClauses:
      return receiver!.token === KindCaseKeyword || receiver!.token === KindDefaultKeyword;
    case PCTypeMembers:
      return Parser_lookAhead(receiver, Parser_scanTypeMemberStart);
    case PCClassMembers:
      // We allow semicolons as class elements (as specified by ES6) as long as we're
      // not in error recovery.  If we're in error recovery, we don't want an errant
      // semicolon to be treated as a class member (since they're almost always used
      // for statements.
      return Parser_lookAhead(receiver, Parser_scanClassMemberStart) || (receiver!.token === KindSemicolonToken && !inErrorRecovery);
    case PCEnumMembers:
      // Include open bracket computed properties. This technically also lets in indexers,
      // which would be a candidate for improved error reporting.
      return receiver!.token === KindOpenBracketToken || Parser_isLiteralPropertyName(receiver);
    case PCObjectLiteralMembers:
      switch (receiver!.token) {
        case KindOpenBracketToken:
        case KindAsteriskToken:
        case KindDotDotDotToken:
        case KindDotToken: // Not an object literal member, but don't want to close the object (see `tests/cases/fourslash/completionsDotInObjectLiteral.ts`)
          return true;
        default:
          return Parser_isLiteralPropertyName(receiver);
      }
    case PCRestProperties:
      return Parser_isLiteralPropertyName(receiver);
    case PCObjectBindingElements:
      return receiver!.token === KindOpenBracketToken || receiver!.token === KindDotDotDotToken || Parser_isLiteralPropertyName(receiver);
    case PCImportAttributes:
      return Parser_isImportAttributeName(receiver);
    case PCHeritageClauseElement:
      // If we see `{ ... }` then only consume it as an expression if it is followed by `,` or `{`
      // That way we won't consume the body of a class in its heritage clause.
      if (receiver!.token === KindOpenBraceToken) {
        return Parser_isValidHeritageClauseObjectLiteral(receiver);
      }
      if (!inErrorRecovery) {
        return Parser_isStartOfLeftHandSideExpression(receiver) && !Parser_isHeritageClauseExtendsOrImplementsKeyword(receiver);
      }
      // If we're in error recovery we tighten up what we're willing to match.
      // That way we don't treat something like "this" as a valid heritage clause
      // element during recovery.
      return Parser_isIdentifier(receiver) && !Parser_isHeritageClauseExtendsOrImplementsKeyword(receiver);
    case PCVariableDeclarations:
      return Parser_isBindingIdentifierOrPrivateIdentifierOrPattern(receiver);
    case PCArrayBindingElements:
      return receiver!.token === KindCommaToken || receiver!.token === KindDotDotDotToken || Parser_isBindingIdentifierOrPrivateIdentifierOrPattern(receiver);
    case PCTypeParameters:
      return receiver!.token === KindInKeyword || receiver!.token === KindConstKeyword || Parser_isIdentifier(receiver);
    case PCArrayLiteralMembers:
      // Not an array literal member, but don't want to close the array (see `tests/cases/fourslash/completionsDotInArrayLiteralInObjectLiteral.ts`)
      if (receiver!.token === KindCommaToken || receiver!.token === KindDotToken) {
        return true;
      }
      // fallthrough
      return receiver!.token === KindDotDotDotToken || Parser_isStartOfExpression(receiver);
    case PCArgumentExpressions:
      return receiver!.token === KindDotDotDotToken || Parser_isStartOfExpression(receiver);
    case PCParameters:
      return Parser_isStartOfParameter(receiver, false /*isJSDocParameter*/);
    case PCJSDocParameters:
      return Parser_isStartOfParameter(receiver, true /*isJSDocParameter*/);
    case PCTypeArguments:
    case PCTupleElementTypes:
      return receiver!.token === KindCommaToken || Parser_isStartOfType(receiver, false /*inStartOfParameter*/);
    case PCHeritageClauses:
      return Parser_isHeritageClause(receiver);
    case PCImportOrExportSpecifiers:
      // bail out if the next token is [FromKeyword StringLiteral].
      // That means we're in something like `import { from "mod"`. Stop here can give better error message.
      if (receiver!.token === KindFromKeyword && Parser_lookAhead(receiver, Parser_nextTokenIsTokenStringLiteral)) {
        return false;
      }
      if (receiver!.token === KindStringLiteral) {
        return true; // For "arbitrary module namespace identifiers"
      }
      return tokenIsIdentifierOrKeyword(receiver!.token);
    case PCJsxAttributes:
      return tokenIsIdentifierOrKeyword(receiver!.token) || receiver!.token === KindOpenBraceToken;
    case PCJsxChildren:
      return true;
    case PCJSDocComment:
      return true;
  }
  throw new globalThis.Error("Unhandled case in isListElement");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.isListTerminator","kind":"method","status":"implemented","sigHash":"13905823b0e99a2d3d885493b0b8c7af34d08377f24c24810b537c75cb1aa434","bodyHash":"c93442572ecafb279cc89ff3d4460ae3f85ee7b7078f6e332dc4a75d5d7753c3"}
 *
 * Go source:
 * func (p *Parser) isListTerminator(kind ParsingContext) bool {
 * 	if p.token == ast.KindEndOfFile {
 * 		return true
 * 	}
 * 	switch kind {
 * 	case PCBlockStatements, PCSwitchClauses, PCTypeMembers, PCClassMembers, PCEnumMembers, PCObjectLiteralMembers,
 * 		PCObjectBindingElements, PCImportOrExportSpecifiers, PCImportAttributes:
 * 		return p.token == ast.KindCloseBraceToken
 * 	case PCSwitchClauseStatements:
 * 		return p.token == ast.KindCloseBraceToken || p.token == ast.KindCaseKeyword || p.token == ast.KindDefaultKeyword
 * 	case PCHeritageClauseElement:
 * 		return p.token == ast.KindOpenBraceToken || p.token == ast.KindExtendsKeyword || p.token == ast.KindImplementsKeyword
 * 	case PCVariableDeclarations:
 * 		// If we can consume a semicolon (either explicitly, or with ASI), then consider us done
 * 		// with parsing the list of variable declarators.
 * 		// In the case where we're parsing the variable declarator of a 'for-in' statement, we
 * 		// are done if we see an 'in' keyword in front of us. Same with for-of
 * 		// ERROR RECOVERY TWEAK:
 * 		// For better error recovery, if we see an '=>' then we just stop immediately.  We've got an
 * 		// arrow function here and it's going to be very unlikely that we'll resynchronize and get
 * 		// another variable declaration.
 * 		return p.canParseSemicolon() || p.token == ast.KindInKeyword || p.token == ast.KindOfKeyword || p.token == ast.KindEqualsGreaterThanToken
 * 	case PCTypeParameters:
 * 		// Tokens other than '>' are here for better error recovery
 * 		return p.token == ast.KindGreaterThanToken || p.token == ast.KindOpenParenToken || p.token == ast.KindOpenBraceToken || p.token == ast.KindExtendsKeyword || p.token == ast.KindImplementsKeyword
 * 	case PCArgumentExpressions:
 * 		// Tokens other than ')' are here for better error recovery
 * 		return p.token == ast.KindCloseParenToken || p.token == ast.KindSemicolonToken
 * 	case PCArrayLiteralMembers, PCTupleElementTypes, PCArrayBindingElements:
 * 		return p.token == ast.KindCloseBracketToken
 * 	case PCJSDocParameters, PCParameters, PCRestProperties:
 * 		// Tokens other than ')' and ']' (the latter for index signatures) are here for better error recovery
 * 		return p.token == ast.KindCloseParenToken || p.token == ast.KindCloseBracketToken /*|| token == ast.KindOpenBraceToken* /
 * 	case PCTypeArguments:
 * 		// All other tokens should cause the type-argument to terminate except comma token
 * 		return p.token != ast.KindCommaToken
 * 	case PCHeritageClauses:
 * 		return p.token == ast.KindOpenBraceToken || p.token == ast.KindCloseBraceToken
 * 	case PCJsxAttributes:
 * 		return p.token == ast.KindGreaterThanToken || p.token == ast.KindSlashToken
 * 	case PCJsxChildren:
 * 		return p.token == ast.KindLessThanToken && p.lookAhead((*Parser).nextTokenIsSlash)
 * 	}
 * 	return false
 * }
 */
export function Parser_isListTerminator(receiver: GoPtr<Parser>, kind: ParsingContext): bool {
  if (receiver!.token === KindEndOfFile) {
    return true;
  }
  switch (kind) {
    case PCBlockStatements:
    case PCSwitchClauses:
    case PCTypeMembers:
    case PCClassMembers:
    case PCEnumMembers:
    case PCObjectLiteralMembers:
    case PCObjectBindingElements:
    case PCImportOrExportSpecifiers:
    case PCImportAttributes:
      return receiver!.token === KindCloseBraceToken;
    case PCSwitchClauseStatements:
      return receiver!.token === KindCloseBraceToken || receiver!.token === KindCaseKeyword || receiver!.token === KindDefaultKeyword;
    case PCHeritageClauseElement:
      return receiver!.token === KindOpenBraceToken || receiver!.token === KindExtendsKeyword || receiver!.token === KindImplementsKeyword;
    case PCVariableDeclarations:
      // If we can consume a semicolon (either explicitly, or with ASI), then consider us done
      // with parsing the list of variable declarators.
      // In the case where we're parsing the variable declarator of a 'for-in' statement, we
      // are done if we see an 'in' keyword in front of us. Same with for-of
      // ERROR RECOVERY TWEAK:
      // For better error recovery, if we see an '=>' then we just stop immediately.  We've got an
      // arrow function here and it's going to be very unlikely that we'll resynchronize and get
      // another variable declaration.
      return Parser_canParseSemicolon(receiver) || receiver!.token === KindInKeyword || receiver!.token === KindOfKeyword || receiver!.token === KindEqualsGreaterThanToken;
    case PCTypeParameters:
      // Tokens other than '>' are here for better error recovery
      return receiver!.token === KindGreaterThanToken || receiver!.token === KindOpenParenToken || receiver!.token === KindOpenBraceToken || receiver!.token === KindExtendsKeyword || receiver!.token === KindImplementsKeyword;
    case PCArgumentExpressions:
      // Tokens other than ')' are here for better error recovery
      return receiver!.token === KindCloseParenToken || receiver!.token === KindSemicolonToken;
    case PCArrayLiteralMembers:
    case PCTupleElementTypes:
    case PCArrayBindingElements:
      return receiver!.token === KindCloseBracketToken;
    case PCJSDocParameters:
    case PCParameters:
    case PCRestProperties:
      // Tokens other than ')' and ']' (the latter for index signatures) are here for better error recovery
      return receiver!.token === KindCloseParenToken || receiver!.token === KindCloseBracketToken; /*|| token == ast.KindOpenBraceToken*/
    case PCTypeArguments:
      // All other tokens should cause the type-argument to terminate except comma token
      return receiver!.token !== KindCommaToken;
    case PCHeritageClauses:
      return receiver!.token === KindOpenBraceToken || receiver!.token === KindCloseBraceToken;
    case PCJsxAttributes:
      return receiver!.token === KindGreaterThanToken || receiver!.token === KindSlashToken;
    case PCJsxChildren:
      return receiver!.token === KindLessThanToken && Parser_lookAhead(receiver, Parser_nextTokenIsSlash);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::func::modifierListHasAsync","kind":"func","status":"implemented","sigHash":"3255ec3ff81e19c6800292dc3dbe125453cc5985ff0018f09677942566e38b3c","bodyHash":"22987060e26178e7ee0f46b293b814e06ea676d7f2cbb3acb5e5ee4508767362"}
 *
 * Go source:
 * func modifierListHasAsync(modifiers *ast.ModifierList) bool {
 * 	return modifiers != nil && core.Some(modifiers.Nodes, isAsyncModifier)
 * }
 */
export function modifierListHasAsync(modifiers: GoPtr<ModifierList>): bool {
  return modifiers !== undefined && Some(modifiers.Nodes, isAsyncModifier);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseParameters","kind":"method","status":"implemented","sigHash":"b5a86a362f8286de69cfe9e3d7c74329636de858bf8a59c8639a6b341f5fcd09","bodyHash":"60045d79a78448603d230e952e2f8efc2fdb7a28d7fae224c5820b4c5fbaf72b"}
 *
 * Go source:
 * func (p *Parser) parseParameters(flags ParseFlags) *ast.NodeList {
 * 	// FormalParameters [Yield,Await]: (modified)
 * 	//      [empty]
 * 	//      FormalParameterList[?Yield,Await]
 * 	//
 * 	// FormalParameter[Yield,Await]: (modified)
 * 	//      BindingElement[?Yield,Await]
 * 	//
 * 	// BindingElement [Yield,Await]: (modified)
 * 	//      SingleNameBinding[?Yield,?Await]
 * 	//      BindingPattern[?Yield,?Await]Initializer [In, ?Yield,?Await] opt
 * 	//
 * 	// SingleNameBinding [Yield,Await]:
 * 	//      BindingIdentifier[?Yield,?Await]Initializer [In, ?Yield,?Await] opt
 * 	if p.parseExpected(ast.KindOpenParenToken) {
 * 		parameters := p.parseParametersWorker(flags, true /*allowAmbiguity* /)
 * 		p.parseExpected(ast.KindCloseParenToken)
 * 		return parameters
 * 	}
 * 	return p.createMissingList()
 * }
 */
export function Parser_parseParameters(receiver: GoPtr<Parser>, flags: ParseFlags): GoPtr<NodeList> {
  // FormalParameters [Yield,Await]: (modified)
  //      [empty]
  //      FormalParameterList[?Yield,Await]
  //
  // FormalParameter[Yield,Await]: (modified)
  //      BindingElement[?Yield,Await]
  //
  // BindingElement [Yield,Await]: (modified)
  //      SingleNameBinding[?Yield,?Await]
  //      BindingPattern[?Yield,?Await]Initializer [In, ?Yield,?Await] opt
  //
  // SingleNameBinding [Yield,Await]:
  //      BindingIdentifier[?Yield,?Await]Initializer [In, ?Yield,?Await] opt
  if (Parser_parseExpected(receiver, KindOpenParenToken)) {
    const parameters = Parser_parseParametersWorker(receiver, flags, true /*allowAmbiguity*/);
    Parser_parseExpected(receiver, KindCloseParenToken);
    return parameters;
  }
  return Parser_createMissingList(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseParametersWorker","kind":"method","status":"implemented","sigHash":"91879b119b8189b32908c1983588977ffda60f16b9960e4bd32782a1c6b1ee1c","bodyHash":"a6d246e548f419e452a48b3394d48b86cdbf70b0950a176f35f27c3736c9bff2"}
 *
 * Go source:
 * func (p *Parser) parseParametersWorker(flags ParseFlags, allowAmbiguity bool) *ast.NodeList {
 * 	// FormalParameters [Yield,Await]: (modified)
 * 	//      [empty]
 * 	//      FormalParameterList[?Yield,Await]
 * 	//
 * 	// FormalParameter[Yield,Await]: (modified)
 * 	//      BindingElement[?Yield,Await]
 * 	//
 * 	// BindingElement [Yield,Await]: (modified)
 * 	//      SingleNameBinding[?Yield,?Await]
 * 	//      BindingPattern[?Yield,?Await]Initializer [In, ?Yield,?Await] opt
 * 	//
 * 	// SingleNameBinding [Yield,Await]:
 * 	//      BindingIdentifier[?Yield,?Await]Initializer [In, ?Yield,?Await] opt
 * 	inAwaitContext := p.contextFlags&ast.NodeFlagsAwaitContext != 0
 * 	saveContextFlags := p.contextFlags
 * 	p.setContextFlags(ast.NodeFlagsYieldContext, flags&ParseFlagsYield != 0)
 * 	p.setContextFlags(ast.NodeFlagsAwaitContext, flags&ParseFlagsAwait != 0)
 * 	parameters := p.parseDelimitedList(PCParameters, func(p *Parser) *ast.Node {
 * 		parameter := p.parseParameterEx(inAwaitContext, allowAmbiguity)
 * 		if parameter != nil && flags&ParseFlagsType == 0 {
 * 			p.checkJSSyntax(parameter)
 * 		}
 * 		return parameter
 * 	})
 * 	p.contextFlags = saveContextFlags
 * 	return parameters
 * }
 */
export function Parser_parseParametersWorker(receiver: GoPtr<Parser>, flags: ParseFlags, allowAmbiguity: bool): GoPtr<NodeList> {
  // FormalParameters [Yield,Await]: (modified)
  //      [empty]
  //      FormalParameterList[?Yield,Await]
  //
  // FormalParameter[Yield,Await]: (modified)
  //      BindingElement[?Yield,Await]
  //
  // BindingElement [Yield,Await]: (modified)
  //      SingleNameBinding[?Yield,?Await]
  //      BindingPattern[?Yield,?Await]Initializer [In, ?Yield,?Await] opt
  //
  // SingleNameBinding [Yield,Await]:
  //      BindingIdentifier[?Yield,?Await]Initializer [In, ?Yield,?Await] opt
  const inAwaitContext = (receiver!.contextFlags & NodeFlagsAwaitContext) !== 0;
  const saveContextFlags = receiver!.contextFlags;
  Parser_setContextFlags(receiver, NodeFlagsYieldContext, (flags & ParseFlagsYield) !== 0);
  Parser_setContextFlags(receiver, NodeFlagsAwaitContext, (flags & ParseFlagsAwait) !== 0);
  const parameters = Parser_parseDelimitedList(receiver, PCParameters, (p: GoPtr<Parser>): GoPtr<Node> => {
    const parameter = Parser_parseParameterEx(p, inAwaitContext, allowAmbiguity);
    if (parameter !== undefined && (flags & ParseFlagsType) === 0) {
      Parser_checkJSSyntax(p, parameter);
    }
    return parameter;
  });
  receiver!.contextFlags = saveContextFlags;
  return parameters;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.parseArgumentList","kind":"method","status":"implemented","sigHash":"ab4315505c00ca4e6676f4981544a74385b03f6ee76e485eef3f9a3b135c99b6","bodyHash":"35d627c7ffa705ff53a7a3492e6bd8b42eb54eb4aca51121a31dcc9ade91535b"}
 *
 * Go source:
 * func (p *Parser) parseArgumentList() *ast.NodeList {
 * 	p.parseExpected(ast.KindOpenParenToken)
 * 	result := p.parseDelimitedList(PCArgumentExpressions, (*Parser).parseArgumentExpression)
 * 	p.parseExpected(ast.KindCloseParenToken)
 * 	return result
 * }
 */
export function Parser_parseArgumentList(receiver: GoPtr<Parser>): GoPtr<NodeList> {
  Parser_parseExpected(receiver, KindOpenParenToken);
  const result = Parser_parseDelimitedList(receiver, PCArgumentExpressions, Parser_parseArgumentExpression);
  Parser_parseExpected(receiver, KindCloseParenToken);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.newNodeList","kind":"method","status":"implemented","sigHash":"f618ee4bcd2b10c3800dfc5e0fb29375f7c1baf8eeaa25e3bd10132a69b79a6c","bodyHash":"70c77f5b625e6ccf2938b58c07b82cf82ad5baffd94a47112c572fdf2cc5eb39"}
 *
 * Go source:
 * func (p *Parser) newNodeList(loc core.TextRange, nodes []*ast.Node) *ast.NodeList {
 * 	list := p.factory.NewNodeList(nodes)
 * 	list.Loc = loc
 * 	return list
 * }
 */
export function Parser_newNodeList(receiver: GoPtr<Parser>, loc: TextRange, nodes: GoSlice<GoPtr<Node>>): GoPtr<NodeList> {
  const list = NodeFactory_NewNodeList(receiver!.factory, nodes);
  list!.Loc = loc;
  return list;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::method::Parser.newModifierList","kind":"method","status":"implemented","sigHash":"421eedeeaff9c4d4153e8435ca7a6fef5172a9fdbade934476670ac6b7da3a04","bodyHash":"cc54a0c2f7716d27189edd2d524a96cf2b2c895341ad03ba495d2f336f4d2c21"}
 *
 * Go source:
 * func (p *Parser) newModifierList(loc core.TextRange, nodes []*ast.Node) *ast.ModifierList {
 * 	list := p.factory.NewModifierList(nodes)
 * 	list.Loc = loc
 * 	return list
 * }
 */
export function Parser_newModifierList(receiver: GoPtr<Parser>, loc: TextRange, nodes: GoSlice<GoPtr<Node>>): GoPtr<ModifierList> {
  const list = NodeFactory_NewModifierList(receiver!.factory, nodes);
  list!.Loc = loc;
  return list;
}
