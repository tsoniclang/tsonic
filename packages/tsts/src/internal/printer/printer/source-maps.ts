import type { bool, int } from "../../../go/scalars.js";
import type { GoError, GoMap, GoPtr } from "../../../go/compat.js";
import { ContainsFunc } from "../../../go/slices.js";
import type { Node, NodeList } from "../../ast/spine.js";
import { NodeDefault_AsNode, NodeList_End, NodeList_Pos, Node_Pos, Node_End } from "../../ast/spine.js";
import type { CommentRange, SourceFile } from "../../ast/ast.js";
import { SourceFile_Text } from "../../ast/ast.js";
import type { IdentifierNode } from "../../ast/ast_generated.js";
import type { Block, PartiallyEmittedExpression, TemplateLiteralTypeSpan, TemplateSpan } from "../../ast/generated/data.js";
import type { Expression, TemplateLiteralTypeSpanNode, TemplateSpanNode, Statement } from "../../ast/generated/unions.js";
import { AsTemplateLiteralTypeSpan, AsTemplateSpan, AsPartiallyEmittedExpression } from "../../ast/generated/casts.js";
import type { Kind } from "../../ast/generated/kinds.js";
import { KindCloseBraceToken, KindJsxText, KindOpenBraceToken, KindSingleLineCommentTrivia } from "../../ast/generated/kinds.js";
import { IsInJsonFile, NodeIsSynthesized, PositionIsSynthesized } from "../../ast/utilities.js";
import { IsNotEmittedStatement, IsParenthesizedExpression, IsPartiallyEmittedExpression, IsSourceFile } from "../../ast/generated/predicates.js";
import type { TextRange } from "../../core/text.js";
import { NewTextRange, TextRange_End, TextRange_Pos } from "../../core/text.js";
import { FirstOrNil, LastOrNil } from "../../core/core.js";
import { ScriptKindJSON } from "../../core/scriptkind.js";
import type { Source } from "../../sourcemap/source.js";
import { Generator_AddSource, Generator_SetSourceContent } from "../../sourcemap/generator.js";
import { SplitLines, GuessIndentation } from "../../stringutil/util.js";
import { FileExtensionIs } from "../../tspath/path.js";
import { ExtensionJson } from "../../tspath/extension.js";
import { SkipTrivia, GetLeadingCommentRanges, GetTrailingCommentRanges } from "../../scanner/scanner.js";
import { NodeFactory_AsNodeFactory } from "../../ast/spine.js";
import { EmitContext_EmitFlags, EmitContext_GetSyntheticLeadingComments, EmitContext_MostOriginal, EmitContext_ParseNode, EmitContext_SourceMapRange, EmitContext_TokenSourceMapRange, EmitContext_GetExternalHelpersModuleName } from "../emitcontext.js";
import type { SynthesizedComment } from "../emitcontext.js";
import { EFExternalHelpers, EFMultiLine, EFNoLeadingSourceMap, EFNoNestedSourceMaps, EFNoTokenLeadingSourceMaps, EFNoTokenTrailingSourceMaps, EFNoTrailingSourceMap, EFSingleLine, EFStartOnNewLine } from "../emitflags.js";
import { newLineCharacterCache, greatestEnd, getLinesBetweenRangeEndAndRangeStart, getLinesBetweenPositionAndPrecedingNonWhitespaceCharacter, getLinesBetweenPositionAndNextNonWhitespaceCharacter, originalNodesHaveSameParent, rangeEndIsOnSameLineAsRangeStart, rangeEndPositionsAreOnSameLine, RangeStartPositionsAreOnSameLine, RangeIsOnSingleLine, siblingNodePositionsAreComparable, skipSynthesizedParentheses } from "../utilities.js";
import { Arena_New } from "../../core/arena.js";
import type { Arena } from "../../core/arena.js";
import {
  Printer_emitListItems,
  Printer_emitPos,
  Printer_Emit,
  Printer_enterNode,
  Printer_exitNode,
  Printer_hasTrailingComma,
  Printer_increaseIndent,
  Printer_pushNameGenerationScope,
  Printer_popNameGenerationScope,
  Printer_generateAllNames,
  Printer_shouldElideIndentation,
  Printer_emitHelpers,
  Printer_write,
  Printer_writePunctuation,
  Printer_writeSpace,
} from "./emit-core.js";
import { Printer_emitLeadingComments, Printer_emitTrailingComments, Printer_syntheticCommentWillEmitNewLine, Printer_emitPrologueDirectives, Printer_emitTripleSlashDirectives, Printer_emitDetachedCommentsBeforeStatementList, Printer_emitDetachedCommentsAfterStatementList } from "./comments.js";
import { Printer_emitTemplateMiddleTail, Printer_emitExpression } from "./expressions.js";
import { Printer_emitTypeNodeOutsideExtends } from "./types.js";
import { Printer_emitStatement, Printer_emitShebangIfNeeded } from "./statements-declarations.js";
import { getClosingBracket, getOpeningBracket } from "./support.js";
import type { ListFormat, Printer, sourceMapState, tokenEmitFlags } from "./state.js";
import {
  commentSeparatorBefore,
  LFBracketsMask,
  LFMultiLine,
  LFNoSpaceIfEmpty,
  LFNone,
  LFOptionalIfEmpty,
  LFOptionalIfNil,
  LFPreferNewLine,
  LFPreserveLines,
  LFNoTrailingNewLine,
  LFSpaceBetweenBraces,
  tefNoSourceMaps,
} from "./state.js";
import { OperatorPrecedenceComma } from "../../ast/precedence.js";

// Go strings are immutable UTF-8 byte sequences; `s[i:j]` and `len(s)` operate
// on byte offsets. Mirror that contract by operating over the UTF-8 byte view
// (matching internal/stringutil/util.ts), converting back at the boundary.
const utf8Encoder: TextEncoder = new globalThis.TextEncoder();
const utf8Decoder: TextDecoder = new globalThis.TextDecoder();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeLine","kind":"method","status":"implemented","sigHash":"9277d5c0da9c1ecd86b5796e50d36b9519356984e3e63f002faed0bb8df3f53b","bodyHash":"4b166e13aa4dd1b35a2ae971ed193bdcb915d39e8842909418e337db2c7686ef"}
 *
 * Go source:
 * func (p *Printer) writeLine() {
 * 	p.writer.WriteLine()
 * }
 */
export function Printer_writeLine(receiver: GoPtr<Printer>): void {
  receiver!.writer.WriteLine();
}

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
export function Printer_writeLineRepeat(receiver: GoPtr<Printer>, count: int): void {
  const loop = (i: int): void => { if (i < count) { Printer_writeLine(receiver); loop((i + 1) as int); } };
  loop(0 as int);
}

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
export function Printer_writeLines(receiver: GoPtr<Printer>, text: string): void {
  const lines = SplitLines(text);
  const indentation = GuessIndentation(lines);
  for (const rawLine of lines) {
    // Go strings are UTF-8 byte sequences; `line[indentation:]` and `len(line)`
    // operate on byte offsets, so mirror that via the byte view.
    const lineBytes = utf8Encoder.encode(rawLine);
    const slicedBytes = indentation > 0 ? lineBytes.subarray(indentation) : lineBytes;
    const line = indentation > 0 ? utf8Decoder.decode(slicedBytes) : rawLine;
    if (slicedBytes.length > 0) {
      Printer_writeLine(receiver);
      Printer_write(receiver, line);
    }
  }
}

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
export function Printer_writeLineOrSpace(receiver: GoPtr<Printer>, parentNode: GoPtr<Node>, prevChildNode: GoPtr<Node>, nextChildNode: GoPtr<Node>): void {
  if (Printer_shouldEmitOnSingleLine(receiver, parentNode)) {
    Printer_writeSpace(receiver);
  } else if (receiver!.Options.PreserveSourceNewlines) {
    const lines = Printer_getLinesBetweenNodes(receiver, parentNode, prevChildNode, nextChildNode);
    if (lines > 0) {
      Printer_writeLineRepeat(receiver, lines);
    } else {
      Printer_writeSpace(receiver);
    }
  } else {
    Printer_writeLine(receiver);
  }
}

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
export function Printer_writeLinesAndIndent(receiver: GoPtr<Printer>, lineCount: int, writeSpaceIfNotIndenting: bool): void {
  if (lineCount > 0) {
    Printer_increaseIndent(receiver);
    Printer_writeLineRepeat(receiver, lineCount);
  } else if (writeSpaceIfNotIndenting) {
    Printer_writeSpace(receiver);
  }
}

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
export function Printer_writeLineSeparatorsAndIndentBefore(receiver: GoPtr<Printer>, node: GoPtr<Node>, parent: GoPtr<Node>): bool {
  if (receiver!.Options.PreserveSourceNewlines) {
    const leadingNewlines = Printer_getLeadingLineTerminatorCount(receiver, parent, node, LFNone);
    if (leadingNewlines > 0) {
      Printer_writeLinesAndIndent(receiver, leadingNewlines, false as bool);
      return true as bool;
    }
  }
  return false as bool;
}

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
export function Printer_writeLineSeparatorsAfter(receiver: GoPtr<Printer>, node: GoPtr<Node>, parent: GoPtr<Node>): void {
  if (receiver!.Options.PreserveSourceNewlines) {
    const trailingNewlines = Printer_getClosingLineTerminatorCount(receiver, parent, node, LFNone, NewTextRange(-1, -1));
    if (trailingNewlines > 0) {
      Printer_writeLineRepeat(receiver, trailingNewlines);
    }
  }
}

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
export function Printer_getLinesBetweenNodes(receiver: GoPtr<Printer>, parent: GoPtr<Node>, node1: GoPtr<Node>, node2: GoPtr<Node>): int {
  if (Printer_shouldElideIndentation(receiver, parent)) {
    return 0 as int;
  }

  const parentSkipped = skipSynthesizedParentheses(parent);
  const node1Skipped = skipSynthesizedParentheses(node1);
  const node2Skipped = skipSynthesizedParentheses(node2);

  // Always use a newline for synthesized code if the synthesizer desires it.
  if (Printer_shouldEmitOnNewLine(receiver, node2Skipped, LFNone)) {
    return 1 as int;
  }

  if (receiver!.currentSourceFile !== undefined && !NodeIsSynthesized(parentSkipped) && !NodeIsSynthesized(node1Skipped) && !NodeIsSynthesized(node2Skipped)) {
    if (receiver!.Options.PreserveSourceNewlines) {
      return Printer_getEffectiveLines(
        receiver,
        (includeComments: bool): int => getLinesBetweenRangeEndAndRangeStart(
          node1Skipped!.Loc,
          node2Skipped!.Loc,
          receiver!.currentSourceFile,
          includeComments,
        ),
      );
    }
    return (rangeEndIsOnSameLineAsRangeStart(node1Skipped!.Loc, node2Skipped!.Loc, receiver!.currentSourceFile) ? 0 : 1) as int;
  }

  return 0 as int;
}

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
export function Printer_getEffectiveLines(receiver: GoPtr<Printer>, getLineDifference: (includeComments: bool) => int): int {
  if (!receiver!.Options.PreserveSourceNewlines) {
    throw new globalThis.Error("Should not be called when preserveSourceNewlines is false");
  }
  const lines = getLineDifference(true as bool);
  if (lines === 0) {
    return getLineDifference(false as bool);
  }
  return lines;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.getLeadingLineTerminatorCount","kind":"method","status":"implemented","sigHash":"8b4eb3bf5b3f21870f677fb63723b281459580c99353ff0cd48a7272035b8d8f","bodyHash":"6c2ebdf1e2192adc8d2407991b7636dbbd4f4439d174374d180d728df554ee5d"}
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
 * 			return core.IfElse(RangeStartPositionsAreOnSameLine(parentNode.Loc, firstChild.Loc, p.currentSourceFile), 0, 1)
 * 		}
 * 		if p.shouldEmitOnNewLine(firstChild, format) {
 * 			return 1
 * 		}
 * 	}
 * 	return core.IfElse(format&LFMultiLine != 0, 1, 0)
 * }
 */
export function Printer_getLeadingLineTerminatorCount(receiver: GoPtr<Printer>, parentNode: GoPtr<Node>, firstChild: GoPtr<Node>, format: ListFormat): int {
  if ((format & LFPreserveLines) !== 0 || receiver!.Options.PreserveSourceNewlines) {
    if ((format & LFPreferNewLine) !== 0) {
      return 1 as int;
    }

    if (firstChild === undefined) {
      return (parentNode === undefined || (receiver!.currentSourceFile !== undefined && RangeIsOnSingleLine(parentNode!.Loc, receiver!.currentSourceFile)) ? 0 : 1) as int;
    }
    if (receiver!.nextListElementPos > 0 && Node_Pos(firstChild) === receiver!.nextListElementPos) {
      return 0 as int;
    }
    if (firstChild!.Kind === KindJsxText) {
      return 0 as int;
    }
    if (receiver!.currentSourceFile !== undefined && parentNode !== undefined &&
      !PositionIsSynthesized(Node_Pos(parentNode)) &&
      !NodeIsSynthesized(firstChild) &&
      (firstChild!.Parent === undefined /*|| getOriginalNode(firstChild.Parent) == getOriginalNode(parentNode)*/)) {
      if (receiver!.Options.PreserveSourceNewlines) {
        return Printer_getEffectiveLines(
          receiver,
          (includeComments: bool): int => getLinesBetweenPositionAndPrecedingNonWhitespaceCharacter(
            Node_Pos(firstChild),
            Node_Pos(parentNode),
            receiver!.currentSourceFile,
            includeComments,
          ),
        );
      }
      return (RangeStartPositionsAreOnSameLine(parentNode!.Loc, firstChild!.Loc, receiver!.currentSourceFile) ? 0 : 1) as int;
    }
    if (Printer_shouldEmitOnNewLine(receiver, firstChild, format)) {
      return 1 as int;
    }
  }
  return ((format & LFMultiLine) !== 0 ? 1 : 0) as int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.getSeparatingLineTerminatorCount","kind":"method","status":"implemented","sigHash":"c773105a2f5c575c9b94183a664bf9cdbf1674b395c88db4fddce2c553a200ec","bodyHash":"eb6e09ab47e130dfda77a07b1aaf5fd56c641e56ec67a501a1c0e40c6f2aea5c"}
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
 * 			if p.Options.PreserveSourceNewlines && siblingNodePositionsAreComparable(p.emitContext, previousNode, nextNode) {
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
 * 			} else if !p.Options.PreserveSourceNewlines && originalNodesHaveSameParent(p.emitContext, previousNode, nextNode) {
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
export function Printer_getSeparatingLineTerminatorCount(receiver: GoPtr<Printer>, previousNode: GoPtr<Node>, nextNode: GoPtr<Node>, format: ListFormat): int {
  if ((format & LFPreserveLines) !== 0 || receiver!.Options.PreserveSourceNewlines) {
    if (previousNode === undefined || nextNode === undefined) {
      return 0 as int;
    }
    if (nextNode!.Kind === KindJsxText) {
      return 0 as int;
    } else if (receiver!.currentSourceFile !== undefined && !NodeIsSynthesized(previousNode) && !NodeIsSynthesized(nextNode)) {
      if (receiver!.Options.PreserveSourceNewlines && siblingNodePositionsAreComparable(receiver!.emitContext, previousNode, nextNode)) {
        return Printer_getEffectiveLines(
          receiver,
          (includeComments: bool): int => getLinesBetweenRangeEndAndRangeStart(
            previousNode!.Loc,
            nextNode!.Loc,
            receiver!.currentSourceFile,
            includeComments,
          ),
        );
      } else if (!receiver!.Options.PreserveSourceNewlines && originalNodesHaveSameParent(receiver!.emitContext, previousNode, nextNode)) {
        return (rangeEndIsOnSameLineAsRangeStart(previousNode!.Loc, nextNode!.Loc, receiver!.currentSourceFile) ? 0 : 1) as int;
      }
      // If the two nodes are not comparable, add a line terminator based on the format that can indicate
      // whether new lines are preferred or not.
      return ((format & LFPreferNewLine) !== 0 ? 1 : 0) as int;
    } else if (Printer_shouldEmitOnNewLine(receiver, previousNode, format) || Printer_shouldEmitOnNewLine(receiver, nextNode, format)) {
      return 1 as int;
    }
  } else if (Printer_shouldEmitOnNewLine(receiver, nextNode, LFNone)) {
    return 1 as int;
  }
  return ((format & LFMultiLine) !== 0 ? 1 : 0) as int;
}

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
export function Printer_getClosingLineTerminatorCount(receiver: GoPtr<Printer>, parentNode: GoPtr<Node>, lastChild: GoPtr<Node>, format: ListFormat, childrenTextRange: TextRange): int {
  if ((format & LFPreserveLines) !== 0 || receiver!.Options.PreserveSourceNewlines) {
    if ((format & LFPreferNewLine) !== 0) {
      return 1 as int;
    }
    if (lastChild === undefined) {
      return (parentNode === undefined || (receiver!.currentSourceFile !== undefined && RangeIsOnSingleLine(parentNode!.Loc, receiver!.currentSourceFile)) ? 0 : 1) as int;
    }
    if (receiver!.currentSourceFile !== undefined && parentNode !== undefined && !PositionIsSynthesized(Node_Pos(parentNode)) && !NodeIsSynthesized(lastChild) && (lastChild!.Parent === undefined || lastChild!.Parent === parentNode)) {
      if (receiver!.Options.PreserveSourceNewlines) {
        const lastChildEnd = Node_End(lastChild);
        const childrenTextRangeEnd = TextRange_End(childrenTextRange);
        const end = (lastChildEnd > childrenTextRangeEnd ? lastChildEnd : childrenTextRangeEnd) as int;
        return Printer_getEffectiveLines(
          receiver,
          (includeComments: bool): int => getLinesBetweenPositionAndNextNonWhitespaceCharacter(
            end,
            Node_End(parentNode),
            receiver!.currentSourceFile,
            includeComments,
          ),
        );
      }
      return (rangeEndPositionsAreOnSameLine(parentNode!.Loc, lastChild!.Loc, receiver!.currentSourceFile) ? 0 : 1) as int;
    }
    if (Printer_shouldEmitOnNewLine(receiver, lastChild, format)) {
      return 1 as int;
    }
  }
  if ((format & LFMultiLine) !== 0 && (format & LFNoTrailingNewLine) === 0) {
    return 1 as int;
  }
  return 0 as int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitOnSingleLine","kind":"method","status":"implemented","sigHash":"5d2520ee5ac13cb82db76c40e677a41adf256a408949d172e5ef7e8840e05d3e","bodyHash":"b83e5894a3b9ba42e958585c71d7720b8b79293c25bfbd854a4c23537d30a30e"}
 *
 * Go source:
 * func (p *Printer) shouldEmitOnSingleLine(node *ast.Node) bool {
 * 	return p.emitContext.EmitFlags(node)&EFSingleLine != 0
 * }
 */
export function Printer_shouldEmitOnSingleLine(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool {
  return ((EmitContext_EmitFlags(receiver!.emitContext, node) & EFSingleLine) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitOnMultipleLines","kind":"method","status":"implemented","sigHash":"8195885dc238eb26f1d8f6204a483f87f0d6c72f54f98672372c071fd64104f6","bodyHash":"8d8887a9c274c7804ab9754b715cc87ad90a51c6d454fbc2dfde00954b5f7ec7"}
 *
 * Go source:
 * func (p *Printer) shouldEmitOnMultipleLines(node *ast.Node) bool {
 * 	return p.emitContext.EmitFlags(node)&EFMultiLine != 0
 * }
 */
export function Printer_shouldEmitOnMultipleLines(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool {
  return ((EmitContext_EmitFlags(receiver!.emitContext, node) & EFMultiLine) !== 0) as bool;
}

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
export function Printer_shouldEmitBlockFunctionBodyOnSingleLine(receiver: GoPtr<Printer>, body: GoPtr<Block>): bool {
  if (Printer_shouldEmitOnSingleLine(receiver, NodeDefault_AsNode(body))) {
    return true as bool;
  }

  if (body!.MultiLine) {
    return false as bool;
  }

  if (!NodeIsSynthesized(NodeDefault_AsNode(body)) && receiver!.currentSourceFile !== undefined && !RangeIsOnSingleLine(body!.Loc, receiver!.currentSourceFile)) {
    return false as bool;
  }

  if (Printer_getLeadingLineTerminatorCount(receiver, NodeDefault_AsNode(body), FirstOrNil(body!.Statements!.Nodes) as GoPtr<Node>, LFPreserveLines) > 0 ||
    Printer_getClosingLineTerminatorCount(receiver, NodeDefault_AsNode(body), LastOrNil(body!.Statements!.Nodes) as GoPtr<Node>, LFPreserveLines, body!.Statements!.Loc) > 0) {
    return false as bool;
  }

  let previousStatement: GoPtr<Node> = undefined;
  for (const statement of body!.Statements!.Nodes) {
    if (Printer_getSeparatingLineTerminatorCount(receiver, previousStatement, statement as GoPtr<Node>, LFPreserveLines) > 0) {
      return false as bool;
    }
    previousStatement = statement as GoPtr<Node>;
  }

  return true as bool;
}

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
export function Printer_shouldEmitOnNewLine(receiver: GoPtr<Printer>, node: GoPtr<Node>, format: ListFormat): bool {
  if ((EmitContext_EmitFlags(receiver!.emitContext, node) & EFStartOnNewLine) !== 0) {
    return true as bool;
  }
  return ((format & LFPreferNewLine) !== 0) as bool;
}

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
export function Printer_shouldEmitSourceMaps(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool {
  return (!receiver!.sourceMapsDisabled &&
    receiver!.sourceMapSource !== undefined &&
    !IsSourceFile(node) &&
    !IsInJsonFile(node)) as bool;
}

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
export function Printer_shouldEmitTokenSourceMaps(receiver: GoPtr<Printer>, token: Kind, pos: int, contextNode: GoPtr<Node>, flags: tokenEmitFlags): bool {
  return (((flags & tefNoSourceMaps) === 0) &&
    Printer_shouldEmitSourceMaps(receiver, contextNode) &&
    !receiver!.Options.OmitBraceSourceMapPositions && (token === KindOpenBraceToken || token === KindCloseBraceToken)) as bool;
}

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
export function Printer_emitTemplateTypeSpan(receiver: GoPtr<Printer>, node: GoPtr<TemplateLiteralTypeSpan>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitTypeNodeOutsideExtends(receiver, node!.Type);
  Printer_emitTemplateMiddleTail(receiver, node!.Literal);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTemplateTypeSpanNode","kind":"method","status":"implemented","sigHash":"ca2c2f8bc4747638761c346dfe31567aa06bb6ff46ccfad75425b298c3a1ca3d","bodyHash":"46f563823df8438d302a35fe46b048f86c4cde1ae64455b0cca23fe165fe17e4"}
 *
 * Go source:
 * func (p *Printer) emitTemplateTypeSpanNode(node *ast.TemplateLiteralTypeSpanNode) {
 * 	p.emitTemplateTypeSpan(node.AsTemplateLiteralTypeSpan())
 * }
 */
export function Printer_emitTemplateTypeSpanNode(receiver: GoPtr<Printer>, node: GoPtr<TemplateLiteralTypeSpanNode>): void {
  Printer_emitTemplateTypeSpan(receiver, AsTemplateLiteralTypeSpan(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.commentWillEmitNewLine","kind":"method","status":"implemented","sigHash":"9e3eb39606e4ddbd2414f308417d597aabb7251d51caecc8d00b18323fb0617a","bodyHash":"a37b15d828ffe4371725d3f58ec2c8478096eee30bc0950ffcbf178baf8e7108"}
 *
 * Go source:
 * func (p *Printer) commentWillEmitNewLine(comment ast.CommentRange) bool {
 * 	return comment.Kind == ast.KindSingleLineCommentTrivia || comment.HasTrailingNewLine
 * }
 */
export function Printer_commentWillEmitNewLine(receiver: GoPtr<Printer>, comment: CommentRange): bool {
  return (comment.Kind === KindSingleLineCommentTrivia || comment.HasTrailingNewLine) as bool;
}

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
export function Printer_willEmitLeadingNewLine(receiver: GoPtr<Printer>, node: GoPtr<Expression>): bool {
  if (receiver!.currentSourceFile === undefined) {
    return false as bool;
  }
  let hasLeadingCommentRanges = false;
  let hasNewLineComment = false;
  GetLeadingCommentRanges(NodeFactory_AsNodeFactory(receiver!.emitContext!.Factory!.__tsgoEmbedded0), SourceFile_Text(receiver!.currentSourceFile), Node_Pos(node as GoPtr<Node>))((comment: CommentRange): bool => {
    hasLeadingCommentRanges = true;
    if (Printer_commentWillEmitNewLine(receiver, comment)) {
      hasNewLineComment = true;
    }
    return true as bool; // continue iterating
  });
  if (hasLeadingCommentRanges) {
    const parseNode = EmitContext_ParseNode(receiver!.emitContext, node as GoPtr<Node>);
    if (parseNode !== undefined && IsParenthesizedExpression(parseNode!.Parent)) {
      return true as bool;
    }
  }
  if (hasNewLineComment) {
    return true as bool;
  }
  if (ContainsFunc(EmitContext_GetSyntheticLeadingComments(receiver!.emitContext, node as GoPtr<Node>), (comment: SynthesizedComment): bool => Printer_syntheticCommentWillEmitNewLine(receiver, comment))) {
    return true as bool;
  }
  if (IsPartiallyEmittedExpression(node as GoPtr<Node>)) {
    const pee = AsPartiallyEmittedExpression(node as GoPtr<Node>);
    if (Node_Pos(node as GoPtr<Node>) !== Node_Pos(pee!.Expression as GoPtr<Node>)) {
      let foundNewLineComment = false;
      GetTrailingCommentRanges(NodeFactory_AsNodeFactory(receiver!.emitContext!.Factory!.__tsgoEmbedded0), SourceFile_Text(receiver!.currentSourceFile), Node_Pos(pee!.Expression as GoPtr<Node>))((comment: CommentRange): bool => {
        if (Printer_commentWillEmitNewLine(receiver, comment)) {
          foundNewLineComment = true;
          return false as bool; // stop iterating (like Go's return)
        }
        return true as bool; // continue
      });
      if (foundNewLineComment) {
        return true as bool;
      }
    }
    return Printer_willEmitLeadingNewLine(receiver, pee!.Expression);
  }
  return false as bool;
}

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
export function Printer_emitTemplateSpan(receiver: GoPtr<Printer>, node: GoPtr<TemplateSpan>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceComma);
  Printer_emitTemplateMiddleTail(receiver, node!.Literal);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTemplateSpanNode","kind":"method","status":"implemented","sigHash":"a005d6fc749b973a2c094211c702ec5d3a11f02bc73d88bd69bc95f4e1223794","bodyHash":"59d00ba8236c62669d07697f18d03456aff3e011df7075f185f769ce184c2a18"}
 *
 * Go source:
 * func (p *Printer) emitTemplateSpanNode(node *ast.TemplateSpanNode) {
 * 	p.emitTemplateSpan(node.AsTemplateSpan())
 * }
 */
export function Printer_emitTemplateSpanNode(receiver: GoPtr<Printer>, node: GoPtr<TemplateSpanNode>): void {
  Printer_emitTemplateSpan(receiver, AsTemplateSpan(node));
}

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
export function Printer_emitSourceFile(receiver: GoPtr<Printer>, node: GoPtr<SourceFile>): void {
  const savedCurrentSourceFile = receiver!.currentSourceFile;
  const savedCommentsDisabled = receiver!.commentsDisabled;
  receiver!.currentSourceFile = node;

  Printer_writeLine(receiver);

  Printer_pushNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_generateAllNames(receiver, node!.Statements);

  let index = 0 as int;
  let state = undefined;
  if (node!.ScriptKind !== ScriptKindJSON) {
    Printer_emitShebangIfNeeded(receiver, node);
    index = Printer_emitPrologueDirectives(receiver, node!.Statements);
    if (!receiver!.writer.IsAtStartOfLine()) {
      Printer_writeLine(receiver);
    }
    state = Printer_emitDetachedCommentsBeforeStatementList(receiver, NodeDefault_AsNode(node), node!.Statements!.Loc);
    Printer_emitHelpers(receiver, NodeDefault_AsNode(node));
    if (node!.IsDeclarationFile) {
      Printer_emitTripleSlashDirectives(receiver, node);
    }
  } else {
    state = Printer_emitDetachedCommentsBeforeStatementList(receiver, NodeDefault_AsNode(node), node!.Statements!.Loc);
  }

  // !!! Emit triple-slash directives
  Printer_emitListRange(
    receiver,
    Printer_emitStatement as (p: GoPtr<Printer>, node: GoPtr<Node>) => void,
    NodeDefault_AsNode(node),
    node!.Statements,
    LFMultiLine,
    index,
    -1 as int, /*count*/
  );
  Printer_popNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_emitDetachedCommentsAfterStatementList(receiver, NodeDefault_AsNode(node), node!.Statements!.Loc, state);
  receiver!.currentSourceFile = savedCurrentSourceFile;
  receiver!.commentsDisabled = savedCommentsDisabled;
}

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
export function Printer_emitListRange(receiver: GoPtr<Printer>, emit: (p: GoPtr<Printer>, node: GoPtr<Node>) => void, parentNode: GoPtr<Node>, children: GoPtr<NodeList>, format: ListFormat, start: int, count: int): void {
  const isNil = children === undefined;

  const length = isNil ? 0 : children!.Nodes.length;

  const startResolved = start < 0 ? 0 : start;

  const countResolved = count < 0 ? length - startResolved : count;

  if (isNil && (format & LFOptionalIfNil) !== 0) {
    return;
  }

  const onBeforeEmitNodeList = receiver!.__tsgoEmbedded0?.OnBeforeEmitNodeList;
  const onAfterEmitNodeList = receiver!.__tsgoEmbedded0?.OnAfterEmitNodeList;

  const isEmpty = isNil || startResolved >= length || countResolved <= 0;
  if (isEmpty && (format & LFOptionalIfEmpty) !== 0) {
    if (onBeforeEmitNodeList !== undefined) {
      onBeforeEmitNodeList(children);
    }
    if (onAfterEmitNodeList !== undefined) {
      onAfterEmitNodeList(children);
    }
    return;
  }

  if ((format & LFBracketsMask) !== 0) {
    Printer_writePunctuation(receiver, getOpeningBracket(format));
    if (isEmpty && !isNil) {
      Printer_emitTrailingComments(receiver, NodeList_Pos(children), commentSeparatorBefore);
    }
  }

  if (onBeforeEmitNodeList !== undefined) {
    onBeforeEmitNodeList(children);
  }

  if (isEmpty) {
    if ((format & LFMultiLine) !== 0 && !(receiver!.Options.PreserveSourceNewlines && (parentNode === undefined || (receiver!.currentSourceFile !== undefined && RangeIsOnSingleLine(parentNode!.Loc, receiver!.currentSourceFile))))) {
      Printer_writeLine(receiver);
    } else if ((format & LFSpaceBetweenBraces) !== 0 && (format & LFNoSpaceIfEmpty) === 0) {
      Printer_writeSpace(receiver);
    }
  } else {
    const end = Math.min(startResolved + countResolved, length);

    Printer_emitListItems(receiver, emit, parentNode, children!.Nodes.slice(startResolved, end), format, Printer_hasTrailingComma(receiver, parentNode, children), children!.Loc);
  }

  if (onAfterEmitNodeList !== undefined) {
    onAfterEmitNodeList(children);
  }

  if ((format & LFBracketsMask) !== 0) {
    if (isEmpty && !isNil) {
      Printer_emitLeadingComments(receiver, NodeList_End(children), false as bool);
    }
    Printer_writePunctuation(receiver, getClosingBracket(format));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.EmitSourceFile","kind":"method","status":"implemented","sigHash":"a33c96bbc1c93092255a57a87ebdb0df473d55a68b4b962d049abdfe09baed7b","bodyHash":"f13d8186adbd4262971400287a199a9f5855f92716038b64c1ccc495e77633d2"}
 *
 * Go source:
 * func (p *Printer) EmitSourceFile(sourceFile *ast.SourceFile) string {
 * 	return p.Emit(sourceFile.AsNode(), sourceFile)
 * }
 */
export function Printer_EmitSourceFile(receiver: GoPtr<Printer>, sourceFile: GoPtr<SourceFile>): string {
  return Printer_Emit(receiver, NodeDefault_AsNode(sourceFile), sourceFile);
}

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
export function Printer_setSourceFile(receiver: GoPtr<Printer>, sourceFile: GoPtr<SourceFile>): void {
  receiver!.currentSourceFile = sourceFile;
  receiver!.uniqueHelperNames = undefined;
  receiver!.externalHelpersModuleName = undefined;
  if (sourceFile !== undefined) {
    if ((EmitContext_EmitFlags(receiver!.emitContext, EmitContext_MostOriginal(receiver!.emitContext, NodeDefault_AsNode(sourceFile))) & EFExternalHelpers) !== 0) {
      receiver!.uniqueHelperNames = new globalThis.Map<string, GoPtr<IdentifierNode>>();
    }
    receiver!.externalHelpersModuleName = EmitContext_GetExternalHelpersModuleName(receiver!.emitContext, sourceFile);
    Printer_setSourceMapSource(receiver, sourceFile as unknown as Source);
  }

  // !!!
}

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
export function Printer_setSourceMapSource(receiver: GoPtr<Printer>, source: Source): void {
  if (receiver!.sourceMapsDisabled) {
    return;
  }

  receiver!.sourceMapSource = source;
  receiver!.sourceMapLineCharCache = newLineCharacterCache(source);
  if (receiver!.mostRecentSourceMapSource === source) {
    receiver!.sourceMapSourceIndex = receiver!.mostRecentSourceMapSourceIndex;
    return;
  }

  receiver!.sourceMapSourceIsJson = FileExtensionIs(source.FileName(), ExtensionJson);
  if (receiver!.sourceMapSourceIsJson) {
    return;
  }

  receiver!.sourceMapSourceIndex = Generator_AddSource(receiver!.sourceMapGenerator, source.FileName());
  if (receiver!.Options.InlineSources) {
    const err: GoError = Generator_SetSourceContent(receiver!.sourceMapGenerator, receiver!.sourceMapSourceIndex, source.Text());
    if (err !== undefined) {
      throw err;
    }
  }

  receiver!.mostRecentSourceMapSource = source;
  receiver!.mostRecentSourceMapSourceIndex = receiver!.sourceMapSourceIndex;
}

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
export function Printer_emitSourcePos(receiver: GoPtr<Printer>, source: Source, pos: int): void {
  if (source !== receiver!.sourceMapSource) {
    const savedSourceMapSource = receiver!.sourceMapSource;
    const savedSourceMapSourceIndex = receiver!.sourceMapSourceIndex;
    const savedSourceMapLineCharCache = receiver!.sourceMapLineCharCache;
    Printer_setSourceMapSource(receiver, source);
    Printer_emitPos(receiver, pos);
    receiver!.sourceMapSource = savedSourceMapSource;
    receiver!.sourceMapSourceIndex = savedSourceMapSourceIndex;
    receiver!.sourceMapLineCharCache = savedSourceMapLineCharCache;
  } else {
    Printer_emitPos(receiver, pos);
  }
}

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
export function Printer_emitSourceMapsBeforeNode(receiver: GoPtr<Printer>, node: GoPtr<Node>): GoPtr<sourceMapState> {
  if (!Printer_shouldEmitSourceMaps(receiver, node)) {
    return undefined;
  }

  const emitFlags = EmitContext_EmitFlags(receiver!.emitContext, node);
  const loc = EmitContext_SourceMapRange(receiver!.emitContext, node);

  if (!IsNotEmittedStatement(node) &&
    (emitFlags & EFNoLeadingSourceMap) === 0 &&
    receiver!.currentSourceFile !== undefined &&
    !PositionIsSynthesized(TextRange_Pos(loc))) {
    Printer_emitSourcePos(receiver, receiver!.sourceMapSource, SkipTrivia(SourceFile_Text(receiver!.currentSourceFile), TextRange_Pos(loc)));
  }

  if ((emitFlags & EFNoNestedSourceMaps) !== 0) {
    receiver!.sourceMapsDisabled = true as bool;
  }

  const state = Arena_New<sourceMapState>(receiver!.sourceMapStateArena as Arena<sourceMapState>);
  state!.emitFlags = emitFlags;
  state!.sourceMapRange = loc;
  state!.hasTokenSourceMapRange = false as bool;
  return state;
}

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
export function Printer_emitSourceMapsAfterNode(receiver: GoPtr<Printer>, node: GoPtr<Node>, previousState: GoPtr<sourceMapState>): void {
  if (previousState === undefined) {
    return;
  }

  const emitFlags = previousState.emitFlags;
  const loc = previousState.sourceMapRange;

  if ((emitFlags & EFNoNestedSourceMaps) !== 0) {
    receiver!.sourceMapsDisabled = false as bool;
  }

  if (!IsNotEmittedStatement(node) &&
    (emitFlags & EFNoTrailingSourceMap) === 0 &&
    !PositionIsSynthesized(TextRange_End(loc))) {
    Printer_emitSourcePos(receiver, receiver!.sourceMapSource, TextRange_End(loc));
  }
}

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
export function Printer_emitSourceMapsBeforeToken(receiver: GoPtr<Printer>, token: Kind, pos: int, contextNode: GoPtr<Node>, flags: tokenEmitFlags): GoPtr<sourceMapState> {
  if (!Printer_shouldEmitTokenSourceMaps(receiver, token, pos, contextNode, flags)) {
    return undefined;
  }

  const emitFlags = EmitContext_EmitFlags(receiver!.emitContext, contextNode);
  const [loc, hasLoc] = EmitContext_TokenSourceMapRange(receiver!.emitContext, contextNode, token);
  let posResolved = pos;
  if (hasLoc) {
    posResolved = TextRange_Pos(loc);
  }
  if (posResolved >= 0 && receiver!.currentSourceFile !== undefined) {
    posResolved = SkipTrivia(SourceFile_Text(receiver!.currentSourceFile), posResolved);
  }
  if ((emitFlags & EFNoTokenLeadingSourceMaps) === 0 && posResolved >= 0) {
    Printer_emitSourcePos(receiver, receiver!.sourceMapSource, posResolved);
  }

  const state = Arena_New<sourceMapState>(receiver!.sourceMapStateArena as Arena<sourceMapState>);
  state!.emitFlags = emitFlags;
  state!.sourceMapRange = loc;
  state!.hasTokenSourceMapRange = hasLoc as bool;
  return state;
}

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
export function Printer_emitSourceMapsAfterToken(receiver: GoPtr<Printer>, token: Kind, pos: int, contextNode: GoPtr<Node>, previousState: GoPtr<sourceMapState>): void {
  if (previousState === undefined) {
    return;
  }

  const emitFlags = previousState.emitFlags;
  const loc = previousState.sourceMapRange;
  const hasLoc = previousState.hasTokenSourceMapRange;
  if ((emitFlags & EFNoTokenTrailingSourceMaps) === 0) {
    const posResolved = hasLoc ? TextRange_End(loc) : pos;
    if (posResolved >= 0) {
      Printer_emitSourcePos(receiver, receiver!.sourceMapSource, posResolved);
    }
  }
}
