import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr } from "../../../go/compat.js";
import type { Node, NodeList } from "../../ast/spine.js";
import type { CommentRange, SourceFile } from "../../ast/ast.js";
import type { Block, TemplateLiteralTypeSpan, TemplateSpan } from "../../ast/generated/data.js";
import type { Expression, TemplateLiteralTypeSpanNode, TemplateSpanNode } from "../../ast/generated/unions.js";
import type { Kind } from "../../ast/generated/kinds.js";
import type { TextRange } from "../../core/text.js";
import type { Source } from "../../sourcemap/source.js";
import type { ListFormat, Printer, sourceMapState, tokenEmitFlags } from "./state.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeLine","kind":"method","status":"implemented","sigHash":"9277d5c0da9c1ecd86b5796e50d36b9519356984e3e63f002faed0bb8df3f53b","bodyHash":"4b166e13aa4dd1b35a2ae971ed193bdcb915d39e8842909418e337db2c7686ef"}
 *
 * Go source:
 * func (p *Printer) writeLine() {
 * 	p.writer.WriteLine()
 * }
 */
export declare function Printer_writeLine(receiver: GoPtr<Printer>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeLineRepeat","kind":"method","status":"implemented","sigHash":"6e2c05ca45aff64dd3f010f768a57f254578a8898a25fb00ddc9f32ddd1822a1","bodyHash":"8663591f68c0164c715648dabc10042688cee6e0f4078768958c0a1936dcd841"}
 *
 * Go source:
 * func (p *Printer) writeLineRepeat(count int) {
 * 	for range count {
 * 		p.writeLine()
 * 	}
 * }
 */
export declare function Printer_writeLineRepeat(receiver: GoPtr<Printer>, count: int): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeLines","kind":"method","status":"implemented","sigHash":"655b6f0ebf49a096af67b3f994705403c12e5396c3e92b194e24e3863e89a34f","bodyHash":"46b9017bcdfb4962017102f4d19df9c5a2a07a881830e1b27a5217056821fbbf"}
 *
 * Go source:
 * func (p *Printer) writeLines(text string) {
 * 	lines := stringutil.SplitLines(text)
 * 	indentation := stringutil.GuessIndentation(lines)
 * 	for _, line := range lines {
 * 		if indentation > 0 {
 * 			line = line[indentation:]
 * 		}
 * 		if len(line) > 0 {
 * 			p.writeLine()
 * 			p.write(line)
 * 		}
 * 	}
 * }
 */
export declare function Printer_writeLines(receiver: GoPtr<Printer>, text: string): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeLineOrSpace","kind":"method","status":"implemented","sigHash":"7a7dc071c8d77c4797f3d7a67e439eae691e1c5877f141480dc3bb4c1371d76e","bodyHash":"088ca2cb77aa03cf9fd44515cd1786a095851f8dc4266d9abba8e0bbd12ae5ee"}
 *
 * Go source:
 * func (p *Printer) writeLineOrSpace(parentNode *ast.Node, prevChildNode *ast.Node, nextChildNode *ast.Node) {
 * 	if p.shouldEmitOnSingleLine(parentNode) {
 * 		p.writeSpace()
 * 	} else if p.Options.PreserveSourceNewlines {
 * 		lines := p.getLinesBetweenNodes(parentNode, prevChildNode, nextChildNode)
 * 		if lines > 0 {
 * 			p.writeLineRepeat(lines)
 * 		} else {
 * 			p.writeSpace()
 * 		}
 * 	} else {
 * 		p.writeLine()
 * 	}
 * }
 */
export declare function Printer_writeLineOrSpace(receiver: GoPtr<Printer>, parentNode: GoPtr<Node>, prevChildNode: GoPtr<Node>, nextChildNode: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeLinesAndIndent","kind":"method","status":"implemented","sigHash":"58c4cabbb08e4014d7bb6e2a56b77d630eff1b26b45b3387ffd901aa96fc18dd","bodyHash":"92975d87d6193af872b819ede8972ffa2716111dab85e25f8d81c8794e03dc77"}
 *
 * Go source:
 * func (p *Printer) writeLinesAndIndent(lineCount int, writeSpaceIfNotIndenting bool) {
 * 	if lineCount > 0 {
 * 		p.increaseIndent()
 * 		p.writeLineRepeat(lineCount)
 * 	} else if writeSpaceIfNotIndenting {
 * 		p.writeSpace()
 * 	}
 * }
 */
export declare function Printer_writeLinesAndIndent(receiver: GoPtr<Printer>, lineCount: int, writeSpaceIfNotIndenting: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeLineSeparatorsAndIndentBefore","kind":"method","status":"implemented","sigHash":"8f5276872abbdde1e7c4c4ab43c53df6ebe749dc663b95f0e5c8c57234431b71","bodyHash":"8a831a06f2fdff76f21fb4bb4d93021cd35885c6b4003b0d675b6b6b18c305e6"}
 *
 * Go source:
 * func (p *Printer) writeLineSeparatorsAndIndentBefore(node *ast.Node, parent *ast.Node) bool {
 * 	if p.Options.PreserveSourceNewlines {
 * 		leadingNewlines := p.getLeadingLineTerminatorCount(parent, node, LFNone)
 * 		if leadingNewlines > 0 {
 * 			p.writeLinesAndIndent(leadingNewlines, false) // writeSpaceIfNotIndenting=false
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Printer_writeLineSeparatorsAndIndentBefore(receiver: GoPtr<Printer>, node: GoPtr<Node>, parent: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeLineSeparatorsAfter","kind":"method","status":"implemented","sigHash":"5bc9450bb80b295906c6ffb58d9f5e87f1e44e6cf16337a3667f8d799b1bc201","bodyHash":"6f07abfdf083b2c7ea29bfddbead5db9d8c9cfbdb016ece7e04cefd92a087732"}
 *
 * Go source:
 * func (p *Printer) writeLineSeparatorsAfter(node *ast.Node, parent *ast.Node) {
 * 	if p.Options.PreserveSourceNewlines {
 * 		trailingNewlines := p.getClosingLineTerminatorCount(parent, node, LFNone, core.NewTextRange(-1, -1) /*childrenTextRange* /)
 * 		if trailingNewlines > 0 {
 * 			p.writeLineRepeat(trailingNewlines)
 * 		}
 * 	}
 * }
 */
export declare function Printer_writeLineSeparatorsAfter(receiver: GoPtr<Printer>, node: GoPtr<Node>, parent: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.getLinesBetweenNodes","kind":"method","status":"implemented","sigHash":"7efc48d3ae154a180f17dd7d30243e670708b9b371861308381b86dcb16b8384","bodyHash":"2d76a074daaabc7547427de2ebf5fdd093f490363d2e558f650e21fe90efd0b9"}
 *
 * Go source:
 * func (p *Printer) getLinesBetweenNodes(parent *ast.Node, node1 *ast.Node, node2 *ast.Node) int {
 * 	if p.shouldElideIndentation(parent) {
 * 		return 0
 * 	}
 *
 * 	parent = skipSynthesizedParentheses(parent)
 * 	node1 = skipSynthesizedParentheses(node1)
 * 	node2 = skipSynthesizedParentheses(node2)
 *
 * 	// Always use a newline for synthesized code if the synthesizer desires it.
 * 	if p.shouldEmitOnNewLine(node2, LFNone) {
 * 		return 1
 * 	}
 *
 * 	if p.currentSourceFile != nil && !ast.NodeIsSynthesized(parent) && !ast.NodeIsSynthesized(node1) && !ast.NodeIsSynthesized(node2) {
 * 		if p.Options.PreserveSourceNewlines {
 * 			return p.getEffectiveLines(
 * 				func(includeComments bool) int {
 * 					return getLinesBetweenRangeEndAndRangeStart(
 * 						node1.Loc,
 * 						node2.Loc,
 * 						p.currentSourceFile,
 * 						includeComments,
 * 					)
 * 				},
 * 			)
 * 		}
 * 		return core.IfElse(rangeEndIsOnSameLineAsRangeStart(node1.Loc, node2.Loc, p.currentSourceFile), 0, 1)
 * 	}
 *
 * 	return 0
 * }
 */
export declare function Printer_getLinesBetweenNodes(receiver: GoPtr<Printer>, parent: GoPtr<Node>, node1: GoPtr<Node>, node2: GoPtr<Node>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.getEffectiveLines","kind":"method","status":"implemented","sigHash":"f689f6da8c20fd391ebf83d8a15ad147a501f28f5a427def1f72f9c1174eae5b","bodyHash":"c613c8cea0bf3884be5e896f970da0dcf2c0769e4f21c77744df36c2ec97ad1a"}
 *
 * Go source:
 * func (p *Printer) getEffectiveLines(getLineDifference func(includeComments bool) int) int {
 * 	// If 'preserveSourceNewlines' is disabled, we should never call this function
 * 	// because it could be more expensive than alternative approximations.
 * 	if !p.Options.PreserveSourceNewlines {
 * 		panic("Should not be called when preserveSourceNewlines is false")
 * 	}
 * 	// We start by measuring the line difference from a position to its adjacent comments,
 * 	// so that this is counted as a one-line difference, not two:
 * 	//
 * 	//   node1;
 * 	//   // NODE2 COMMENT
 * 	//   node2;
 * 	lines := getLineDifference( /*includeComments* / true)
 * 	if lines == 0 {
 * 		// However, if the line difference considering comments was 0, we might have this:
 * 		//
 * 		//   node1; // NODE2 COMMENT
 * 		//   node2;
 * 		//
 * 		// in which case we should be ignoring node2's comment, so this too is counted as
 * 		// a one-line difference, not zero.
 * 		return getLineDifference( /*includeComments* / false)
 * 	}
 * 	return lines
 * }
 */
export declare function Printer_getEffectiveLines(receiver: GoPtr<Printer>, getLineDifference: (includeComments: bool) => int): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.getLeadingLineTerminatorCount","kind":"method","status":"implemented","sigHash":"8b4eb3bf5b3f21870f677fb63723b281459580c99353ff0cd48a7272035b8d8f","bodyHash":"26c245cb9b11e375579e6ee45412772a2a625d653a32b1a5d3aa7aed546f2d0b"}
 *
 * Go source:
 * func (p *Printer) getLeadingLineTerminatorCount(parentNode *ast.Node, firstChild *ast.Node, format ListFormat) int {
 * 	if format&LFPreserveLines != 0 || p.Options.PreserveSourceNewlines {
 * 		if format&LFPreferNewLine != 0 {
 * 			return 1
 * 		}
 *
 * 		if firstChild == nil {
 * 			return core.IfElse(parentNode == nil || p.currentSourceFile != nil && RangeIsOnSingleLine(parentNode.Loc, p.currentSourceFile), 0, 1)
 * 		}
 * 		if p.nextListElementPos > 0 && firstChild.Pos() == p.nextListElementPos {
 * 			// If this child starts at the beginning of a list item in a parent list, its leading
 * 			// line terminators have already been written as the separating line terminators of the
 * 			// parent list. Example:
 * 			//
 * 			// class Foo {
 * 			//   constructor() {}
 * 			//   public foo() {}
 * 			// }
 * 			//
 * 			// The outer list is the list of class members, with one line terminator between the
 * 			// constructor and the method. The constructor is written, the separating line terminator
 * 			// is written, and then we start emitting the method. Its modifiers ([public]) constitute an inner
 * 			// list, so we look for its leading line terminators. If we didn't know that we had already
 * 			// written a newline as part of the parent list, it would appear that we need to write a
 * 			// leading newline to start the modifiers.
 * 			return 0
 * 		}
 * 		if firstChild.Kind == ast.KindJsxText {
 * 			// JsxText will be written with its leading whitespace, so don't add more manually.
 * 			return 0
 * 		}
 * 		if p.currentSourceFile != nil && parentNode != nil &&
 * 			!ast.PositionIsSynthesized(parentNode.Pos()) &&
 * 			!ast.NodeIsSynthesized(firstChild) &&
 * 			(firstChild.Parent == nil /*|| getOriginalNode(firstChild.Parent) == getOriginalNode(parentNode)* /) {
 * 			if p.Options.PreserveSourceNewlines {
 * 				return p.getEffectiveLines(
 * 					func(includeComments bool) int {
 * 						return getLinesBetweenPositionAndPrecedingNonWhitespaceCharacter(
 * 							firstChild.Pos(),
 * 							parentNode.Pos(),
 * 							p.currentSourceFile,
 * 							includeComments,
 * 						)
 * 					},
 * 				)
 * 			}
 * 			return core.IfElse(rangeStartPositionsAreOnSameLine(parentNode.Loc, firstChild.Loc, p.currentSourceFile), 0, 1)
 * 		}
 * 		if p.shouldEmitOnNewLine(firstChild, format) {
 * 			return 1
 * 		}
 * 	}
 * 	return core.IfElse(format&LFMultiLine != 0, 1, 0)
 * }
 */
export declare function Printer_getLeadingLineTerminatorCount(receiver: GoPtr<Printer>, parentNode: GoPtr<Node>, firstChild: GoPtr<Node>, format: ListFormat): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.getSeparatingLineTerminatorCount","kind":"method","status":"implemented","sigHash":"c773105a2f5c575c9b94183a664bf9cdbf1674b395c88db4fddce2c553a200ec","bodyHash":"aa3aea2222f98a508e5dd448c8599107222997564e3f3cf76ad313743404f054"}
 *
 * Go source:
 * func (p *Printer) getSeparatingLineTerminatorCount(previousNode *ast.Node, nextNode *ast.Node, format ListFormat) int {
 * 	if format&LFPreserveLines != 0 || p.Options.PreserveSourceNewlines {
 * 		if previousNode == nil || nextNode == nil {
 * 			return 0
 * 		}
 * 		if nextNode.Kind == ast.KindJsxText {
 * 			// JsxText will be written with its leading whitespace, so don't add more manually.
 * 			return 0
 * 		} else if p.currentSourceFile != nil && !ast.NodeIsSynthesized(previousNode) && !ast.NodeIsSynthesized(nextNode) {
 * 			if p.Options.PreserveSourceNewlines && siblingNodePositionsAreComparable(previousNode, nextNode) {
 * 				return p.getEffectiveLines(
 * 					func(includeComments bool) int {
 * 						return getLinesBetweenRangeEndAndRangeStart(
 * 							previousNode.Loc,
 * 							nextNode.Loc,
 * 							p.currentSourceFile,
 * 							includeComments,
 * 						)
 * 					},
 * 				)
 * 			} else if !p.Options.PreserveSourceNewlines && originalNodesHaveSameParent(previousNode, nextNode) {
 * 				// If `preserveSourceNewlines` is `false` we do not intend to preserve the effective lines between the
 * 				// previous and next node. Instead we naively check whether nodes are on separate lines within the
 * 				// same node parent. If so, we intend to preserve a single line terminator. This is less precise and
 * 				// expensive than checking with `preserveSourceNewlines` as above, but the goal is not to preserve the
 * 				// effective source lines between two sibling nodes.
 * 				return core.IfElse(rangeEndIsOnSameLineAsRangeStart(previousNode.Loc, nextNode.Loc, p.currentSourceFile), 0, 1)
 * 			}
 * 			// If the two nodes are not comparable, add a line terminator based on the format that can indicate
 * 			// whether new lines are preferred or not.
 * 			return core.IfElse(format&LFPreferNewLine != 0, 1, 0)
 * 		} else if p.shouldEmitOnNewLine(previousNode, format) || p.shouldEmitOnNewLine(nextNode, format) {
 * 			return 1
 * 		}
 * 	} else if p.shouldEmitOnNewLine(nextNode, LFNone) {
 * 		return 1
 * 	}
 * 	return core.IfElse(format&LFMultiLine != 0, 1, 0)
 * }
 */
export declare function Printer_getSeparatingLineTerminatorCount(receiver: GoPtr<Printer>, previousNode: GoPtr<Node>, nextNode: GoPtr<Node>, format: ListFormat): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.getClosingLineTerminatorCount","kind":"method","status":"implemented","sigHash":"ec50f337724492ef38775af24d2906378de68d6b8a37ce19e6975057ea4c8493","bodyHash":"101f06f2f12d9c23589a94d4180d262bd98505bcb58d056725b9f02a546d5b91"}
 *
 * Go source:
 * func (p *Printer) getClosingLineTerminatorCount(parentNode *ast.Node, lastChild *ast.Node, format ListFormat, childrenTextRange core.TextRange) int {
 * 	if format&LFPreserveLines != 0 || p.Options.PreserveSourceNewlines {
 * 		if format&LFPreferNewLine != 0 {
 * 			return 1
 * 		}
 * 		if lastChild == nil {
 * 			return core.IfElse(parentNode == nil || p.currentSourceFile != nil && RangeIsOnSingleLine(parentNode.Loc, p.currentSourceFile), 0, 1)
 * 		}
 * 		if p.currentSourceFile != nil && parentNode != nil && !ast.PositionIsSynthesized(parentNode.Pos()) && !ast.NodeIsSynthesized(lastChild) && (lastChild.Parent == nil || lastChild.Parent == parentNode) {
 * 			if p.Options.PreserveSourceNewlines {
 * 				end := greatestEnd(lastChild.End(), childrenTextRange)
 * 				return p.getEffectiveLines(
 * 					func(includeComments bool) int {
 * 						return getLinesBetweenPositionAndNextNonWhitespaceCharacter(
 * 							end,
 * 							parentNode.End(),
 * 							p.currentSourceFile,
 * 							includeComments,
 * 						)
 * 					},
 * 				)
 * 			}
 * 			return core.IfElse(rangeEndPositionsAreOnSameLine(parentNode.Loc, lastChild.Loc, p.currentSourceFile), 0, 1)
 * 		}
 * 		if p.shouldEmitOnNewLine(lastChild, format) {
 * 			return 1
 * 		}
 * 	}
 * 	if format&LFMultiLine != 0 && format&LFNoTrailingNewLine == 0 {
 * 		return 1
 * 	}
 * 	return 0
 * }
 */
export declare function Printer_getClosingLineTerminatorCount(receiver: GoPtr<Printer>, parentNode: GoPtr<Node>, lastChild: GoPtr<Node>, format: ListFormat, childrenTextRange: TextRange): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitOnSingleLine","kind":"method","status":"implemented","sigHash":"5d2520ee5ac13cb82db76c40e677a41adf256a408949d172e5ef7e8840e05d3e","bodyHash":"b83e5894a3b9ba42e958585c71d7720b8b79293c25bfbd854a4c23537d30a30e"}
 *
 * Go source:
 * func (p *Printer) shouldEmitOnSingleLine(node *ast.Node) bool {
 * 	return p.emitContext.EmitFlags(node)&EFSingleLine != 0
 * }
 */
export declare function Printer_shouldEmitOnSingleLine(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitOnMultipleLines","kind":"method","status":"implemented","sigHash":"8195885dc238eb26f1d8f6204a483f87f0d6c72f54f98672372c071fd64104f6","bodyHash":"8d8887a9c274c7804ab9754b715cc87ad90a51c6d454fbc2dfde00954b5f7ec7"}
 *
 * Go source:
 * func (p *Printer) shouldEmitOnMultipleLines(node *ast.Node) bool {
 * 	return p.emitContext.EmitFlags(node)&EFMultiLine != 0
 * }
 */
export declare function Printer_shouldEmitOnMultipleLines(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitBlockFunctionBodyOnSingleLine","kind":"method","status":"implemented","sigHash":"847c3c3411bed444282620cfe6d3272562663c485d525793a993758cff4c768d","bodyHash":"b4ced921f91cd2acd201f7fd3eb6d9023c486ed801a27bff2ae416572e2ffe08"}
 *
 * Go source:
 * func (p *Printer) shouldEmitBlockFunctionBodyOnSingleLine(body *ast.Block) bool {
 * 	// We must emit a function body as a single-line body in the following case:
 * 	// * The body has NodeEmitFlags.SingleLine specified.
 *
 * 	// We must emit a function body as a multi-line body in the following cases:
 * 	// * The body is explicitly marked as multi-line.
 * 	// * A non-synthesized body's start and end position are on different lines.
 * 	// * Any statement in the body starts on a new line.
 *
 * 	if p.shouldEmitOnSingleLine(body.AsNode()) {
 * 		return true
 * 	}
 *
 * 	if body.MultiLine {
 * 		return false
 * 	}
 *
 * 	if !ast.NodeIsSynthesized(body.AsNode()) && p.currentSourceFile != nil && !RangeIsOnSingleLine(body.Loc, p.currentSourceFile) {
 * 		return false
 * 	}
 *
 * 	if p.getLeadingLineTerminatorCount(body.AsNode(), core.FirstOrNil(body.Statements.Nodes), LFPreserveLines) > 0 ||
 * 		p.getClosingLineTerminatorCount(body.AsNode(), core.LastOrNil(body.Statements.Nodes), LFPreserveLines, body.Statements.Loc) > 0 {
 * 		return false
 * 	}
 *
 * 	var previousStatement *ast.Statement
 * 	for _, statement := range body.Statements.Nodes {
 * 		if p.getSeparatingLineTerminatorCount(previousStatement, statement, LFPreserveLines) > 0 {
 * 			return false
 * 		}
 *
 * 		previousStatement = statement
 * 	}
 *
 * 	return true
 * }
 */
export declare function Printer_shouldEmitBlockFunctionBodyOnSingleLine(receiver: GoPtr<Printer>, body: GoPtr<Block>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitOnNewLine","kind":"method","status":"implemented","sigHash":"1685014da7e4722c107293a32fab3e19952cf2f4f9eaa29a0f8bd3e8de7bfc0b","bodyHash":"33b0280d00a2e8deff37fc1398dc2e87badca8e124b486449ff7fbb85175a7fc"}
 *
 * Go source:
 * func (p *Printer) shouldEmitOnNewLine(node *ast.Node, format ListFormat) bool {
 * 	if p.emitContext.EmitFlags(node)&EFStartOnNewLine != 0 {
 * 		return true
 * 	}
 * 	return format&LFPreferNewLine != 0
 * }
 */
export declare function Printer_shouldEmitOnNewLine(receiver: GoPtr<Printer>, node: GoPtr<Node>, format: ListFormat): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitSourceMaps","kind":"method","status":"implemented","sigHash":"8aa31e75d3e5632c8806a7e74df14c5fd0a7c4732113654cfcea59728ffe3de3","bodyHash":"c0036f386e2ae2071ade40722850fbdb210b2a1de2517bfc41fdc334ad9eff41"}
 *
 * Go source:
 * func (p *Printer) shouldEmitSourceMaps(node *ast.Node) bool {
 * 	return !p.sourceMapsDisabled &&
 * 		p.sourceMapSource != nil &&
 * 		!ast.IsSourceFile(node) &&
 * 		!ast.IsInJsonFile(node)
 * }
 */
export declare function Printer_shouldEmitSourceMaps(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitTokenSourceMaps","kind":"method","status":"implemented","sigHash":"f2904be748f5c32162cf997f0d00ef5a08b485fdaa5a7ebd1b05f2c47988eb22","bodyHash":"f519a20944d4db3517d60b1269ac2847164dc9c916207755b847e2d6324e11e0"}
 *
 * Go source:
 * func (p *Printer) shouldEmitTokenSourceMaps(token ast.Kind, pos int, contextNode *ast.Node, flags tokenEmitFlags) bool {
 * 	// We don't emit source positions for most tokens as it tends to be quite noisy, however
 * 	// we need to emit source positions for open and close braces so that tools like istanbul
 * 	// can map branches for code coverage. However, we still omit brace source positions when
 * 	// the output is a declaration file.
 * 	return flags&tefNoSourceMaps == 0 &&
 * 		p.shouldEmitSourceMaps(contextNode) &&
 * 		!p.Options.OmitBraceSourceMapPositions && (token == ast.KindOpenBraceToken || token == ast.KindCloseBraceToken)
 * }
 */
export declare function Printer_shouldEmitTokenSourceMaps(receiver: GoPtr<Printer>, token: Kind, pos: int, contextNode: GoPtr<Node>, flags: tokenEmitFlags): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTemplateTypeSpan","kind":"method","status":"implemented","sigHash":"f9ae25c44edb1bcf5af9ead0cb8d7e0ad3c0903df199b8b6f55648d192591ff8","bodyHash":"9272faa7e6832a05ce0fed2871abe83851131e39d102b8c5c77ad72c1bc2714b"}
 *
 * Go source:
 * func (p *Printer) emitTemplateTypeSpan(node *ast.TemplateLiteralTypeSpan) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitTypeNodeOutsideExtends(node.Type)
 * 	p.emitTemplateMiddleTail(node.Literal)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitTemplateTypeSpan(receiver: GoPtr<Printer>, node: GoPtr<TemplateLiteralTypeSpan>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTemplateTypeSpanNode","kind":"method","status":"implemented","sigHash":"ca2c2f8bc4747638761c346dfe31567aa06bb6ff46ccfad75425b298c3a1ca3d","bodyHash":"46f563823df8438d302a35fe46b048f86c4cde1ae64455b0cca23fe165fe17e4"}
 *
 * Go source:
 * func (p *Printer) emitTemplateTypeSpanNode(node *ast.TemplateLiteralTypeSpanNode) {
 * 	p.emitTemplateTypeSpan(node.AsTemplateLiteralTypeSpan())
 * }
 */
export declare function Printer_emitTemplateTypeSpanNode(receiver: GoPtr<Printer>, node: GoPtr<TemplateLiteralTypeSpanNode>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.commentWillEmitNewLine","kind":"method","status":"implemented","sigHash":"9e3eb39606e4ddbd2414f308417d597aabb7251d51caecc8d00b18323fb0617a","bodyHash":"a37b15d828ffe4371725d3f58ec2c8478096eee30bc0950ffcbf178baf8e7108"}
 *
 * Go source:
 * func (p *Printer) commentWillEmitNewLine(comment ast.CommentRange) bool {
 * 	return comment.Kind == ast.KindSingleLineCommentTrivia || comment.HasTrailingNewLine
 * }
 */
export declare function Printer_commentWillEmitNewLine(receiver: GoPtr<Printer>, comment: CommentRange): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.willEmitLeadingNewLine","kind":"method","status":"implemented","sigHash":"65eaaaa7ef48aca870d502b817724b18b8dc2663e9537c0de8749820d8c6dd87","bodyHash":"de29dff73cbf345ebaea71e36b2797045237e89538a2aec2f3d8becd66d6ffa3"}
 *
 * Go source:
 * func (p *Printer) willEmitLeadingNewLine(node *ast.Expression) bool {
 * 	if p.currentSourceFile == nil {
 * 		return false
 * 	}
 * 	hasLeadingCommentRanges := false
 * 	hasNewLineComment := false
 * 	for comment := range scanner.GetLeadingCommentRanges(p.emitContext.Factory.AsNodeFactory(), p.currentSourceFile.Text(), node.Pos()) {
 * 		hasLeadingCommentRanges = true
 * 		if p.commentWillEmitNewLine(comment) {
 * 			hasNewLineComment = true
 * 		}
 * 	}
 * 	if hasLeadingCommentRanges {
 * 		parseNode := p.emitContext.ParseNode(node)
 * 		if parseNode != nil && ast.IsParenthesizedExpression(parseNode.Parent) {
 * 			return true
 * 		}
 * 	}
 * 	if hasNewLineComment {
 * 		return true
 * 	}
 * 	if slices.ContainsFunc(p.emitContext.GetSyntheticLeadingComments(node), p.syntheticCommentWillEmitNewLine) {
 * 		return true
 * 	}
 * 	if ast.IsPartiallyEmittedExpression(node) {
 * 		pee := node.AsPartiallyEmittedExpression()
 * 		if node.Pos() != pee.Expression.Pos() {
 * 			for comment := range scanner.GetTrailingCommentRanges(p.emitContext.Factory.AsNodeFactory(), p.currentSourceFile.Text(), pee.Expression.Pos()) {
 * 				if p.commentWillEmitNewLine(comment) {
 * 					return true
 * 				}
 * 			}
 * 		}
 * 		return p.willEmitLeadingNewLine(pee.Expression)
 * 	}
 * 	return false
 * }
 */
export declare function Printer_willEmitLeadingNewLine(receiver: GoPtr<Printer>, node: GoPtr<Expression>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTemplateSpan","kind":"method","status":"implemented","sigHash":"5bf7a8e5c5bc9f68002ebb9e1d925f743c8212ef6a1e8a524821244072d20b3e","bodyHash":"c312297ef625a4d040b5e5f9fdbdc2c830052434990ec4fa531499d1b2afd928"}
 *
 * Go source:
 * func (p *Printer) emitTemplateSpan(node *ast.TemplateSpan) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceComma)
 * 	p.emitTemplateMiddleTail(node.Literal)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export declare function Printer_emitTemplateSpan(receiver: GoPtr<Printer>, node: GoPtr<TemplateSpan>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTemplateSpanNode","kind":"method","status":"implemented","sigHash":"a005d6fc749b973a2c094211c702ec5d3a11f02bc73d88bd69bc95f4e1223794","bodyHash":"59d00ba8236c62669d07697f18d03456aff3e011df7075f185f769ce184c2a18"}
 *
 * Go source:
 * func (p *Printer) emitTemplateSpanNode(node *ast.TemplateSpanNode) {
 * 	p.emitTemplateSpan(node.AsTemplateSpan())
 * }
 */
export declare function Printer_emitTemplateSpanNode(receiver: GoPtr<Printer>, node: GoPtr<TemplateSpanNode>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitSourceFile","kind":"method","status":"implemented","sigHash":"3e0e753be69a58d4d53ac116b17da3cf2fea3d3a166c83054579f5c7ffec1928","bodyHash":"408910302e01208c1535c57c3367cce8fb65331ec987ea16a7ea1281761f040a"}
 *
 * Go source:
 * func (p *Printer) emitSourceFile(node *ast.SourceFile) {
 * 	savedCurrentSourceFile := p.currentSourceFile
 * 	savedCommentsDisabled := p.commentsDisabled
 * 	p.currentSourceFile = node
 *
 * 	p.writeLine()
 *
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	p.generateAllNames(node.Statements)
 *
 * 	index := 0
 * 	var state *commentState
 * 	if node.ScriptKind != core.ScriptKindJSON {
 * 		p.emitShebangIfNeeded(node)
 * 		index = p.emitPrologueDirectives(node.Statements)
 * 		if !p.writer.IsAtStartOfLine() {
 * 			p.writeLine()
 * 		}
 * 		state = p.emitDetachedCommentsBeforeStatementList(node.AsNode(), node.Statements.Loc)
 * 		p.emitHelpers(node.AsNode())
 * 		if node.IsDeclarationFile {
 * 			p.emitTripleSlashDirectives(node)
 * 		}
 * 	} else {
 * 		state = p.emitDetachedCommentsBeforeStatementList(node.AsNode(), node.Statements.Loc)
 * 	}
 *
 * 	// !!! Emit triple-slash directives
 * 	p.emitListRange(
 * 		(*Printer).emitStatement,
 * 		node.AsNode(),
 * 		node.Statements,
 * 		LFMultiLine,
 * 		index,
 * 		-1, /*count* /
 * 	)
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.emitDetachedCommentsAfterStatementList(node.AsNode(), node.Statements.Loc, state)
 * 	p.currentSourceFile = savedCurrentSourceFile
 * 	p.commentsDisabled = savedCommentsDisabled
 * }
 */
export declare function Printer_emitSourceFile(receiver: GoPtr<Printer>, node: GoPtr<SourceFile>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitListRange","kind":"method","status":"implemented","sigHash":"bd4c868fee30ba142a219133368730f6796241eede82c32fcd4afaf280b540aa","bodyHash":"d36a28083d621ff23ae989bfb2c095030c99c5b157d20d15e2d8bc6de4343011"}
 *
 * Go source:
 * func (p *Printer) emitListRange(emit func(p *Printer, node *ast.Node), parentNode *ast.Node, children *ast.NodeList, format ListFormat, start int, count int) {
 * 	isNil := children == nil
 *
 * 	length := 0
 * 	if !isNil {
 * 		length = len(children.Nodes)
 * 	}
 *
 * 	if start < 0 {
 * 		start = 0
 * 	}
 *
 * 	if count < 0 {
 * 		count = length - start
 * 	}
 *
 * 	if isNil && format&LFOptionalIfNil != 0 {
 * 		return
 * 	}
 *
 * 	isEmpty := isNil || start >= length || count <= 0
 * 	if isEmpty && format&LFOptionalIfEmpty != 0 {
 * 		if p.OnBeforeEmitNodeList != nil {
 * 			p.OnBeforeEmitNodeList(children)
 * 		}
 * 		if p.OnAfterEmitNodeList != nil {
 * 			p.OnAfterEmitNodeList(children)
 * 		}
 * 		return
 * 	}
 *
 * 	if format&LFBracketsMask != 0 {
 * 		p.writePunctuation(getOpeningBracket(format))
 * 		if isEmpty && !isNil {
 * 			p.emitTrailingComments(children.Pos(), commentSeparatorBefore) // Emit comments within empty lists
 * 		}
 * 	}
 *
 * 	if p.OnBeforeEmitNodeList != nil {
 * 		p.OnBeforeEmitNodeList(children)
 * 	}
 *
 * 	if isEmpty {
 * 		// Write a line terminator if the parent node was multi-line
 * 		if format&LFMultiLine != 0 && !(p.Options.PreserveSourceNewlines && (parentNode == nil || p.currentSourceFile != nil && RangeIsOnSingleLine(parentNode.Loc, p.currentSourceFile))) {
 * 			p.writeLine()
 * 		} else if format&LFSpaceBetweenBraces != 0 && format&LFNoSpaceIfEmpty == 0 {
 * 			p.writeSpace()
 * 		}
 * 	} else {
 * 		end := min(start+count, length)
 *
 * 		p.emitListItems(emit, parentNode, children.Nodes[start:end], format, p.hasTrailingComma(parentNode, children), children.Loc)
 * 	}
 *
 * 	if p.OnAfterEmitNodeList != nil {
 * 		p.OnAfterEmitNodeList(children)
 * 	}
 *
 * 	if format&LFBracketsMask != 0 {
 * 		if isEmpty && !isNil {
 * 			p.emitLeadingComments(children.End(), false /*elided* /) // Emit comments within empty lists
 * 		}
 * 		p.writePunctuation(getClosingBracket(format))
 * 	}
 * }
 */
export declare function Printer_emitListRange(receiver: GoPtr<Printer>, emit: (p: GoPtr<Printer>, node: GoPtr<Node>) => void, parentNode: GoPtr<Node>, children: GoPtr<NodeList>, format: ListFormat, start: int, count: int): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.EmitSourceFile","kind":"method","status":"implemented","sigHash":"a33c96bbc1c93092255a57a87ebdb0df473d55a68b4b962d049abdfe09baed7b","bodyHash":"f13d8186adbd4262971400287a199a9f5855f92716038b64c1ccc495e77633d2"}
 *
 * Go source:
 * func (p *Printer) EmitSourceFile(sourceFile *ast.SourceFile) string {
 * 	return p.Emit(sourceFile.AsNode(), sourceFile)
 * }
 */
export declare function Printer_EmitSourceFile(receiver: GoPtr<Printer>, sourceFile: GoPtr<SourceFile>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.setSourceFile","kind":"method","status":"implemented","sigHash":"f82e7e0cc559acfdd92e8697bf4c34c2b287f5c74db25eba87897abdf475240a","bodyHash":"097dcc59308a507383f9c5e790b6940a5ac28294ea3d5069bc320d9c3d411ff0"}
 *
 * Go source:
 * func (p *Printer) setSourceFile(sourceFile *ast.SourceFile) {
 * 	p.currentSourceFile = sourceFile
 * 	p.uniqueHelperNames = nil
 * 	p.externalHelpersModuleName = nil
 * 	if sourceFile != nil {
 * 		if p.emitContext.EmitFlags(p.emitContext.MostOriginal(sourceFile.AsNode()))&EFExternalHelpers != 0 {
 * 			p.uniqueHelperNames = make(map[string]*ast.IdentifierNode)
 * 		}
 * 		p.externalHelpersModuleName = p.emitContext.GetExternalHelpersModuleName(sourceFile)
 * 		p.setSourceMapSource(sourceFile)
 * 	}
 *
 * 	// !!!
 * }
 */
export declare function Printer_setSourceFile(receiver: GoPtr<Printer>, sourceFile: GoPtr<SourceFile>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.setSourceMapSource","kind":"method","status":"implemented","sigHash":"7184b191ed213ed84424db503879334617b91628af5c0b2fb34cd70bf1c080a3","bodyHash":"66f415b380757d247c5297bde83d8e0bc249f69208d341bb6eb0d66f986c4e2e"}
 *
 * Go source:
 * func (p *Printer) setSourceMapSource(source sourcemap.Source) {
 * 	if p.sourceMapsDisabled {
 * 		return
 * 	}
 *
 * 	p.sourceMapSource = source
 * 	p.sourceMapLineCharCache = newLineCharacterCache(source)
 * 	if p.mostRecentSourceMapSource == source {
 * 		p.sourceMapSourceIndex = p.mostRecentSourceMapSourceIndex
 * 		return
 * 	}
 *
 * 	p.sourceMapSourceIsJson = tspath.FileExtensionIs(source.FileName(), tspath.ExtensionJson)
 * 	if p.sourceMapSourceIsJson {
 * 		return
 * 	}
 *
 * 	p.sourceMapSourceIndex = p.sourceMapGenerator.AddSource(source.FileName())
 * 	if p.Options.InlineSources {
 * 		if err := p.sourceMapGenerator.SetSourceContent(p.sourceMapSourceIndex, source.Text()); err != nil {
 * 			panic(err)
 * 		}
 * 	}
 *
 * 	p.mostRecentSourceMapSource = source
 * 	p.mostRecentSourceMapSourceIndex = p.sourceMapSourceIndex
 * }
 */
export declare function Printer_setSourceMapSource(receiver: GoPtr<Printer>, source: Source): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitSourcePos","kind":"method","status":"implemented","sigHash":"b4afca77a7ae651513fb24adf061ab395294e51008585a585eb1c10c8d7dd9b1","bodyHash":"154f727efa07cae05e14d619fc58817ec38d1a8d33648a23010e8f4f171c7c60"}
 *
 * Go source:
 * func (p *Printer) emitSourcePos(source sourcemap.Source, pos int) {
 * 	if source != p.sourceMapSource {
 * 		savedSourceMapSource := p.sourceMapSource
 * 		savedSourceMapSourceIndex := p.sourceMapSourceIndex
 * 		savedSourceMapLineCharCache := p.sourceMapLineCharCache
 * 		p.setSourceMapSource(source)
 * 		p.emitPos(pos)
 * 		p.sourceMapSource = savedSourceMapSource
 * 		p.sourceMapSourceIndex = savedSourceMapSourceIndex
 * 		p.sourceMapLineCharCache = savedSourceMapLineCharCache
 * 	} else {
 * 		p.emitPos(pos)
 * 	}
 * }
 */
export declare function Printer_emitSourcePos(receiver: GoPtr<Printer>, source: Source, pos: int): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitSourceMapsBeforeNode","kind":"method","status":"implemented","sigHash":"964d0c1f817b171f4972287f0cfd3b08dc8d3b2c23addbc57aa6764321c2b0d0","bodyHash":"e1f35648cd413efee1a7ddab742db0429ae189e16bd964a763ec6ee6792b9668"}
 *
 * Go source:
 * func (p *Printer) emitSourceMapsBeforeNode(node *ast.Node) *sourceMapState {
 * 	if !p.shouldEmitSourceMaps(node) {
 * 		return nil
 * 	}
 *
 * 	emitFlags := p.emitContext.EmitFlags(node)
 * 	loc := p.emitContext.SourceMapRange(node)
 *
 * 	if !ast.IsNotEmittedStatement(node) &&
 * 		emitFlags&EFNoLeadingSourceMap == 0 &&
 * 		p.currentSourceFile != nil &&
 * 		!ast.PositionIsSynthesized(loc.Pos()) {
 * 		p.emitSourcePos(p.sourceMapSource, scanner.SkipTrivia(p.currentSourceFile.Text(), loc.Pos()))
 * 	}
 *
 * 	if emitFlags&EFNoNestedSourceMaps != 0 {
 * 		p.sourceMapsDisabled = true
 * 	}
 *
 * 	state := p.sourceMapStateArena.New()
 * 	*state = sourceMapState{emitFlags, loc, false}
 * 	return state
 * }
 */
export declare function Printer_emitSourceMapsBeforeNode(receiver: GoPtr<Printer>, node: GoPtr<Node>): GoPtr<sourceMapState>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitSourceMapsAfterNode","kind":"method","status":"implemented","sigHash":"94c7310c6b4a347deb2f586459aaace1128d68b7f9743ccae143ca204e91e12a","bodyHash":"b101149252f3d0b554c90876e4a5e0a48a4953490656e38e2cc965b9dfe5438c"}
 *
 * Go source:
 * func (p *Printer) emitSourceMapsAfterNode(node *ast.Node, previousState *sourceMapState) {
 * 	if previousState == nil {
 * 		return
 * 	}
 *
 * 	emitFlags := previousState.emitFlags
 * 	loc := previousState.sourceMapRange
 *
 * 	if emitFlags&EFNoNestedSourceMaps != 0 {
 * 		p.sourceMapsDisabled = false
 * 	}
 *
 * 	if !ast.IsNotEmittedStatement(node) &&
 * 		emitFlags&EFNoTrailingSourceMap == 0 &&
 * 		!ast.PositionIsSynthesized(loc.End()) {
 * 		p.emitSourcePos(p.sourceMapSource, loc.End())
 * 	}
 * }
 */
export declare function Printer_emitSourceMapsAfterNode(receiver: GoPtr<Printer>, node: GoPtr<Node>, previousState: GoPtr<sourceMapState>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitSourceMapsBeforeToken","kind":"method","status":"implemented","sigHash":"718f9c4d62de22decd6668551ac0ba04f460de7846262fe234ca25e2f06b247d","bodyHash":"720029105c3955a6501bf9c2d47a2d1c35ca84de060ff5dbb875a97cfccf8b26"}
 *
 * Go source:
 * func (p *Printer) emitSourceMapsBeforeToken(token ast.Kind, pos int, contextNode *ast.Node, flags tokenEmitFlags) *sourceMapState {
 * 	if !p.shouldEmitTokenSourceMaps(token, pos, contextNode, flags) {
 * 		return nil
 * 	}
 *
 * 	emitFlags := p.emitContext.EmitFlags(contextNode)
 * 	loc, hasLoc := p.emitContext.TokenSourceMapRange(contextNode, token)
 * 	if hasLoc {
 * 		pos = loc.Pos()
 * 	}
 * 	if pos >= 0 && p.currentSourceFile != nil {
 * 		pos = scanner.SkipTrivia(p.currentSourceFile.Text(), pos)
 * 	}
 * 	if emitFlags&EFNoTokenLeadingSourceMaps == 0 && pos >= 0 {
 * 		p.emitSourcePos(p.sourceMapSource, pos)
 * 	}
 *
 * 	state := p.sourceMapStateArena.New()
 * 	*state = sourceMapState{emitFlags, loc, hasLoc}
 * 	return state
 * }
 */
export declare function Printer_emitSourceMapsBeforeToken(receiver: GoPtr<Printer>, token: Kind, pos: int, contextNode: GoPtr<Node>, flags: tokenEmitFlags): GoPtr<sourceMapState>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitSourceMapsAfterToken","kind":"method","status":"implemented","sigHash":"f571a5fa3c31411ef2cf5ccbdd461cac23b63c38f4088c7223dea06eca044acc","bodyHash":"e8a9af94aad5d4e95dd6aa6014a2d02f83966adb4f7a2b3fe80d21d92bd79039"}
 *
 * Go source:
 * func (p *Printer) emitSourceMapsAfterToken(token ast.Kind, pos int, contextNode *ast.Node, previousState *sourceMapState) {
 * 	if previousState == nil {
 * 		return
 * 	}
 *
 * 	emitFlags := previousState.emitFlags
 * 	loc := previousState.sourceMapRange
 * 	hasLoc := previousState.hasTokenSourceMapRange
 * 	if emitFlags&EFNoTokenTrailingSourceMaps == 0 {
 * 		if hasLoc {
 * 			pos = loc.End()
 * 		}
 * 		if pos >= 0 {
 * 			p.emitSourcePos(p.sourceMapSource, pos)
 * 		}
 * 	}
 * }
 */
export declare function Printer_emitSourceMapsAfterToken(receiver: GoPtr<Printer>, token: Kind, pos: int, contextNode: GoPtr<Node>, previousState: GoPtr<sourceMapState>): void;
//# sourceMappingURL=source-maps.d.ts.map