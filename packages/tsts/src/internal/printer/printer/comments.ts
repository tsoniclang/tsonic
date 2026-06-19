import type { bool, int } from "../../../go/scalars.js";
import type { GoPtr, GoSeq, GoSlice } from "../../../go/compat.js";
// CommentRange, FileReference, SourceFile are hand-written AST struct types that are
// not yet ported into the spine/generated split; they live in the canonical ../../ast/ast.js
// barrel (see internal/ast/ast.go). Units whose signatures reference them remain stubs.
import type { CommentRange, FileReference, SourceFile } from "../../ast/ast.js";
import { AsSourceFile, SourceFile_Text, SourceFile_ECMALineMap } from "../../ast/ast.js";
import { Node_End, Node_Pos, NodeFactory_AsNodeFactory } from "../../ast/spine.js";
import type { Node } from "../../ast/spine.js";
import type { NodeFactory } from "../factory.js";
import { KindJsxExpression, KindJsxText, KindMultiLineCommentTrivia, KindNotEmittedStatement, KindSingleLineCommentTrivia, KindVariableDeclarationList } from "../../ast/generated/kinds.js";
import type { Kind } from "../../ast/generated/kinds.js";
import type { StatementList } from "../../ast/generated/unions.js";
import { IsSourceFile } from "../../ast/generated/predicates.js";
import { IsPrologueDirective, NodeIsSynthesized, PositionIsSynthesized } from "../../ast/utilities.js";
import { ComputeECMALineStarts, IfElse, LastOrNil } from "../../core/core.js";
import { Arena_New } from "../../core/arena.js";
import { Stack_Len, Stack_Peek, Stack_Pop, Stack_Push } from "../../core/stack.js";
import type { Stack } from "../../core/stack.js";
import { NewTextRange, TextRange_End, TextRange_Pos } from "../../core/text.js";
import type { TextPos, TextRange } from "../../core/text.js";
import { TSFalse, TSTrue, TSUnknown } from "../../core/tristate.js";
import type { Tristate } from "../../core/tristate.js";
import { ResolutionModeESM, ResolutionModeNone } from "../../core/compileroptions.js";
import { ComputeLineOfPosition, GetLeadingCommentRanges, GetTrailingCommentRanges, SkipTrivia } from "../../scanner/scanner.js";
import { Collect } from "../../../go/slices.js";
import { DecodeRuneInString } from "../../../go/unicode/utf8.js";
import { IsLineBreak } from "../../stringutil/util.js";
import { TrimSpace } from "../../../go/strings.js";
import { EmitContext_CommentRange, EmitContext_EmitFlags, EmitContext_GetSyntheticLeadingComments, EmitContext_GetSyntheticTrailingComments, EmitContext_GetTypeNode, EmitContext_ParseNode } from "../emitcontext.js";
import type { SynthesizedComment } from "../emitcontext.js";
import { EFNoLeadingComments, EFNoNestedComments, EFNoTrailingComments } from "../emitflags.js";
import type { EmitFlags } from "../emitflags.js";
import { GetDefaultIndentSize, getIndentString } from "../textwriter.js";
import { byteLen, byteSlice, calculateIndent, IsRecognizedTripleSlashComment, IsPinnedComment, isJSDocLikeText, PositionsAreOnSameLine } from "../utilities.js";
import { Printer_writeLine } from "./source-maps.js";
import { Printer_emitPos } from "./emit-core.js";
import { commentSeparatorAfter, commentSeparatorBefore, commentSeparatorNone, tefIndentLeadingComments, tefNoComments } from "./state.js";
import type { commentSeparator, commentState, detachedCommentsInfo, Printer, tokenEmitFlags } from "./state.js";
import { Printer_increaseIndentIf, Printer_decreaseIndentIf } from "./statements-declarations.js";
import { Printer_writeSpace } from "./emit-core.js";
import { Printer_emitStatement } from "./statements-declarations.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeComment","kind":"method","status":"implemented","sigHash":"c1c0f51ed3a37c19cd84555c6211889787f344841f7bac42a41c0747c3f1cc06","bodyHash":"087765f5405559f37cd07886a1f62de5307a386db5b1a9b6837f33a09612f2b7"}
 *
 * Go source:
 * func (p *Printer) writeComment(text string) {
 * 	p.writer.WriteComment(text)
 * }
 */
export function Printer_writeComment(receiver: GoPtr<Printer>, text: string): void {
  receiver!.writer.WriteComment(text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeCommentRange","kind":"method","status":"implemented","sigHash":"35c1d9b5383ccdfaaf5d7870bc472bfeca70cb9859453660a3877e226144db37","bodyHash":"d0687c24c902735749418e4611bd07473c701106eee1abed0523a873c3025362"}
 *
 * Go source:
 * func (p *Printer) writeCommentRange(comment ast.CommentRange) {
 * 	if p.currentSourceFile == nil {
 * 		return
 * 	}
 * 
 * 	text := p.currentSourceFile.Text()
 * 	lineMap := p.currentSourceFile.ECMALineMap()
 * 	p.writeCommentRangeWorker(text, lineMap, comment.Kind, comment.TextRange)
 * }
 */
export function Printer_writeCommentRange(receiver: GoPtr<Printer>, comment: CommentRange): void {
  if (receiver!.currentSourceFile === undefined) {
    return;
  }

  const text = SourceFile_Text(receiver!.currentSourceFile);
  const lineMap = SourceFile_ECMALineMap(receiver!.currentSourceFile);
  Printer_writeCommentRangeWorker(receiver, text, lineMap, comment.Kind, comment);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeCommentRangeWorker","kind":"method","status":"implemented","sigHash":"f978eed47ae2f82119e024b7f69fe0c5b38c3315ffab8cd8af1a6608ba2e1fa4","bodyHash":"4f5404a76b44587b30dd11f19e42eefe9dc30f663af2f4504c6d7079fa2c4ba0"}
 *
 * Go source:
 * func (p *Printer) writeCommentRangeWorker(text string, lineMap []core.TextPos, kind ast.Kind, loc core.TextRange) {
 * 	if kind == ast.KindMultiLineCommentTrivia {
 * 		indentSize := GetDefaultIndentSize()
 * 		firstLine := scanner.ComputeLineOfPosition(lineMap, loc.Pos())
 * 		lineCount := len(lineMap)
 * 		firstCommentLineIndent := -1
 * 		pos := loc.Pos()
 * 		currentLine := firstLine
 * 		for ; pos < loc.End(); currentLine++ {
 * 			var nextLineStart int
 * 			if currentLine+1 == lineCount {
 * 				nextLineStart = len(text) + 1
 * 			} else {
 * 				nextLineStart = int(lineMap[currentLine+1])
 * 			}
 * 
 * 			if pos != loc.Pos() {
 * 				// If we are not emitting first line, we need to write the spaces to adjust the alignment
 * 				if firstCommentLineIndent == -1 {
 * 					firstCommentLineIndent = calculateIndent(text, int(lineMap[firstLine]), loc.Pos())
 * 				}
 * 
 * 				// These are number of spaces writer is going to write at current indent
 * 				currentWriterIndentSpacing := p.writer.GetIndent() * indentSize
 * 
 * 				// Number of spaces we want to be writing
 * 				// eg: Assume writer indent
 * 				// module m {
 * 				//         /* starts at character 9 this is line 1
 * 				//    * starts at character pos 4 line                        --1  = 8 - 8 + 3
 * 				//   More left indented comment * /                            --2  = 8 - 8 + 2
 * 				//     class c { }
 * 				// }
 * 				// module m {
 * 				//     /* this is line 1 -- Assume current writer indent 8
 * 				//      * line                                                --3 = 8 - 4 + 5
 * 				//            More right indented comment * /                  --4 = 8 - 4 + 11
 * 				//     class c { }
 * 				// }
 * 				spacesToEmit := currentWriterIndentSpacing - firstCommentLineIndent + calculateIndent(text, pos, nextLineStart)
 * 				if spacesToEmit > 0 {
 * 					numberOfSingleSpacesToEmit := spacesToEmit % indentSize
 * 					indentSizeSpaceString := getIndentString((spacesToEmit-numberOfSingleSpacesToEmit)/indentSize, indentSize)
 * 
 * 					// Write indent size string ( in eg 1: = "", 2: "" , 3: string with 8 spaces 4: string with 12 spaces
 * 					p.writer.RawWrite(indentSizeSpaceString)
 * 
 * 					// Emit the single spaces (in eg: 1: 3 spaces, 2: 2 spaces, 3: 1 space, 4: 3 spaces)
 * 					for numberOfSingleSpacesToEmit > 0 {
 * 						p.writer.RawWrite(" ")
 * 						numberOfSingleSpacesToEmit--
 * 					}
 * 				} else {
 * 					// No spaces to emit write empty string
 * 					p.writer.RawWrite("")
 * 				}
 * 			}
 * 
 * 			// Write the comment line text
 * 			end := min(loc.End(), nextLineStart)
 * 			for scan := pos; scan < end; {
 * 				ch, size := utf8.DecodeRuneInString(text[scan:end])
 * 				if size == 0 {
 * 					break
 * 				}
 * 				if stringutil.IsLineBreak(ch) {
 * 					end = scan
 * 					break
 * 				}
 * 				scan += size
 * 			}
 * 			currentLineText := strings.TrimSpace(text[pos:end])
 * 			if len(currentLineText) > 0 {
 * 				p.writeComment(currentLineText)
 * 				if end != loc.End() {
 * 					p.writeLine()
 * 				}
 * 			} else {
 * 				// Empty string - make sure we write empty line
 * 				p.writer.WriteLineForce(true)
 * 			}
 * 
 * 			pos = nextLineStart
 * 		}
 * 	} else {
 * 		// Single line comment of style //....
 * 		p.writeComment(text[loc.Pos():loc.End()])
 * 	}
 * }
 */
export function Printer_writeCommentRangeWorker(receiver: GoPtr<Printer>, text: string, lineMap: GoSlice<TextPos>, kind: Kind, loc: TextRange): void {
  if (kind === KindMultiLineCommentTrivia) {
    const indentSize = GetDefaultIndentSize();
    const firstLine = ComputeLineOfPosition(lineMap, TextRange_Pos(loc));
    const lineCount = lineMap.length;
    let firstCommentLineIndent = -1;
    let pos = TextRange_Pos(loc);
    let currentLine = firstLine;
    for (; pos < TextRange_End(loc); currentLine++) {
      const nextLineStart =
        currentLine + 1 === lineCount ? byteLen(text) + 1 : lineMap[currentLine + 1]!;

      if (pos !== TextRange_Pos(loc)) {
        // If we are not emitting first line, we need to write the spaces to adjust the alignment
        if (firstCommentLineIndent === -1) {
          firstCommentLineIndent = calculateIndent(text, lineMap[firstLine]!, TextRange_Pos(loc));
        }

        // These are number of spaces writer is going to write at current indent
        const currentWriterIndentSpacing = receiver!.writer.GetIndent() * indentSize;

        // Number of spaces we want to be writing
        // eg: Assume writer indent
        // module m {
        //         /* starts at character 9 this is line 1
        //    * starts at character pos 4 line                        --1  = 8 - 8 + 3
        //   More left indented comment */                            --2  = 8 - 8 + 2
        //     class c { }
        // }
        // module m {
        //     /* this is line 1 -- Assume current writer indent 8
        //      * line                                                --3 = 8 - 4 + 5
        //            More right indented comment */                  --4 = 8 - 4 + 11
        //     class c { }
        // }
        const spacesToEmit = currentWriterIndentSpacing - firstCommentLineIndent + calculateIndent(text, pos, nextLineStart);
        if (spacesToEmit > 0) {
          let numberOfSingleSpacesToEmit = spacesToEmit % indentSize;
          const indentSizeSpaceString = getIndentString((spacesToEmit - numberOfSingleSpacesToEmit) / indentSize, indentSize);

          // Write indent size string ( in eg 1: = "", 2: "" , 3: string with 8 spaces 4: string with 12 spaces
          receiver!.writer.RawWrite(indentSizeSpaceString);

          // Emit the single spaces (in eg: 1: 3 spaces, 2: 2 spaces, 3: 1 space, 4: 3 spaces)
          for (; numberOfSingleSpacesToEmit > 0; ) {
            receiver!.writer.RawWrite(" ");
            numberOfSingleSpacesToEmit--;
          }
        } else {
          // No spaces to emit write empty string
          receiver!.writer.RawWrite("");
        }
      }

      // Write the comment line text
      let end = globalThis.Math.min(TextRange_End(loc), nextLineStart);
      for (let scan = pos; scan < end; ) {
        const [ch, size] = DecodeRuneInString(byteSlice(text, scan, end));
        if (size === 0) {
          break;
        }
        if (IsLineBreak(ch)) {
          end = scan;
          break;
        }
        scan += size;
      }
      const currentLineText = TrimSpace(byteSlice(text, pos, end));
      if (currentLineText.length > 0) {
        Printer_writeComment(receiver, currentLineText);
        if (end !== TextRange_End(loc)) {
          Printer_writeLine(receiver);
        }
      } else {
        // Empty string - make sure we write empty line
        receiver!.writer.WriteLineForce(true);
      }

      pos = nextLineStart;
    }
  } else {
    // Single line comment of style //....
    Printer_writeComment(receiver, byteSlice(text, TextRange_Pos(loc), TextRange_End(loc)));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitComments","kind":"method","status":"implemented","sigHash":"5bb92d9e55d1528a4e092943e2f8a2d01a9555a01fd1cff9add688eceb8437cc","bodyHash":"b2fbd137f6e8bb8c6acaadbbeee692a7ad98ea1fe5456b1ac68c7611e8d8ccce"}
 *
 * Go source:
 * func (p *Printer) shouldEmitComments(node *ast.Node) bool {
 * 	return !p.commentsDisabled &&
 * 		p.currentSourceFile != nil &&
 * 		!ast.IsSourceFile(node)
 * }
 */
export function Printer_shouldEmitComments(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool {
  return (!receiver!.commentsDisabled &&
    receiver!.currentSourceFile !== undefined &&
    !IsSourceFile(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldWriteComment","kind":"method","status":"implemented","sigHash":"9c5293c6fd4c88ee753cef22c0285087da694fdba9523709ac9e664ee511aa2b","bodyHash":"490def3ae79ac5e1be6f357351076d6f52efb176773793802a376fdbbdf85c95"}
 *
 * Go source:
 * func (p *Printer) shouldWriteComment(comment ast.CommentRange) bool {
 * 	return !p.Options.OnlyPrintJSDocStyle ||
 * 		p.currentSourceFile != nil && isJSDocLikeText(p.currentSourceFile.Text(), comment) ||
 * 		p.currentSourceFile != nil && IsPinnedComment(p.currentSourceFile.Text(), comment)
 * }
 */
export function Printer_shouldWriteComment(receiver: GoPtr<Printer>, comment: CommentRange): bool {
  return (!receiver!.Options.OnlyPrintJSDocStyle ||
    (receiver!.currentSourceFile !== undefined && isJSDocLikeText(SourceFile_Text(receiver!.currentSourceFile), comment)) ||
    (receiver!.currentSourceFile !== undefined && IsPinnedComment(SourceFile_Text(receiver!.currentSourceFile), comment))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitLeadingComments","kind":"method","status":"implemented","sigHash":"4f395468414efedbd1bd79a274c866bfb206dac5b8ed564e5540fc5e44052d7c","bodyHash":"19dbc26cc52295f1cf9b6946826952a9f57de31ddeb85968c562e5101c0bd5f6"}
 *
 * Go source:
 * func (p *Printer) shouldEmitLeadingComments(node *ast.Node) bool {
 * 	return p.emitContext.EmitFlags(node)&EFNoLeadingComments == 0
 * }
 */
export function Printer_shouldEmitLeadingComments(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool {
  return ((EmitContext_EmitFlags(receiver!.emitContext, node) & EFNoLeadingComments) === 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitTrailingComments","kind":"method","status":"implemented","sigHash":"d38b62e055ccbd7450002e0eacdee97e957707fa1abaef50502c7d8bed0df750","bodyHash":"dde19f81637b4683af039d1cd3ef87b6ff862c97400b452d53110a5f2ef7ef0c"}
 *
 * Go source:
 * func (p *Printer) shouldEmitTrailingComments(node *ast.Node) bool {
 * 	return p.emitContext.EmitFlags(node)&EFNoTrailingComments == 0
 * }
 */
export function Printer_shouldEmitTrailingComments(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool {
  return ((EmitContext_EmitFlags(receiver!.emitContext, node) & EFNoTrailingComments) === 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitNestedComments","kind":"method","status":"implemented","sigHash":"fb8f632099759a9231e93625fdbb9f8f6c8c6d332644c4b1c084f4c72677d650","bodyHash":"057ef611d527e02c3ddfc6b9deac943e14280b9ed596b652cff700c2ebadef62"}
 *
 * Go source:
 * func (p *Printer) shouldEmitNestedComments(node *ast.Node) bool {
 * 	return p.emitContext.EmitFlags(node)&EFNoNestedComments == 0
 * }
 */
export function Printer_shouldEmitNestedComments(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool {
  return ((EmitContext_EmitFlags(receiver!.emitContext, node) & EFNoNestedComments) === 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitDetachedComments","kind":"method","status":"implemented","sigHash":"2b6d76da7938cd992bd51a729d6d99e73ad4d1e544f2831190f3efe453e008cc","bodyHash":"f19c0ddf7d224c6a66fe012cb823c9394f82bd488dc2e6362ea1753d8a1ff082"}
 *
 * Go source:
 * func (p *Printer) shouldEmitDetachedComments(node *ast.Node) bool {
 * 	if !ast.IsSourceFile(node) {
 * 		return true
 * 	}
 * 
 * 	file := node.AsSourceFile()
 * 
 * 	// Emit detached comment if there are no prologue directives or if the first node is synthesized.
 * 	// The synthesized node will have no leading comment so some comments may be missed.
 * 	return len(file.Statements.Nodes) == 0 ||
 * 		!ast.IsPrologueDirective(file.Statements.Nodes[0]) ||
 * 		ast.NodeIsSynthesized(file.Statements.Nodes[0])
 * }
 */
export function Printer_shouldEmitDetachedComments(receiver: GoPtr<Printer>, node: GoPtr<Node>): bool {
  if (!IsSourceFile(node)) {
    return true as bool;
  }

  const file = AsSourceFile(node);

  // Emit detached comment if there are no prologue directives or if the first node is synthesized.
  // The synthesized node will have no leading comment so some comments may be missed.
  return (file!.Statements!.Nodes.length === 0 ||
    !IsPrologueDirective(file!.Statements!.Nodes[0]) ||
    NodeIsSynthesized(file!.Statements!.Nodes[0])) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.hasCommentsAtPosition","kind":"method","status":"implemented","sigHash":"cff65e5dd6746419dfec8b01599ac4c284d5e26a14e956f055a8366a3f30aec0","bodyHash":"1ce8ffb6d315578a2f77077fe0f0ea1e8fd06d6dc9bf4c576b28909b6e50ed5c"}
 *
 * Go source:
 * func (p *Printer) hasCommentsAtPosition(pos int) bool {
 * 	if p.currentSourceFile == nil {
 * 		return false
 * 	}
 * 
 * 	for range scanner.GetTrailingCommentRanges(p.emitContext.Factory.AsNodeFactory(), p.currentSourceFile.Text(), pos+1) {
 * 		return true
 * 	}
 * 	for range scanner.GetLeadingCommentRanges(p.emitContext.Factory.AsNodeFactory(), p.currentSourceFile.Text(), pos+1) {
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Printer_hasCommentsAtPosition(receiver: GoPtr<Printer>, pos: int): bool {
  if (receiver!.currentSourceFile === undefined) {
    return false as bool;
  }
  const nf = NodeFactory_AsNodeFactory(receiver!.emitContext!.Factory!.__tsgoEmbedded0);
  const text = SourceFile_Text(receiver!.currentSourceFile);
  let found = false;
  GetTrailingCommentRanges(nf, text, pos + 1)((_comment: CommentRange): bool => {
    found = true;
    return false as bool;
  });
  if (found) {
    return true as bool;
  }
  GetLeadingCommentRanges(nf, text, pos + 1)((_comment: CommentRange): bool => {
    found = true;
    return false as bool;
  });
  return found as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.syntheticCommentWillEmitNewLine","kind":"method","status":"implemented","sigHash":"d4dee52383fc38bfcb36dc86293e834e51912a67244fda019aefcf91610c6752","bodyHash":"ca170a6ee19cfa7b3f96acecd8e590cc4f261937e0006cb934b7635a9c917f2b"}
 *
 * Go source:
 * func (p *Printer) syntheticCommentWillEmitNewLine(comment SynthesizedComment) bool {
 * 	return comment.Kind == ast.KindSingleLineCommentTrivia || comment.HasTrailingNewLine
 * }
 */
export function Printer_syntheticCommentWillEmitNewLine(receiver: GoPtr<Printer>, comment: SynthesizedComment): bool {
  return (comment.Kind === KindSingleLineCommentTrivia || comment.HasTrailingNewLine) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitPrologueDirectives","kind":"method","status":"implemented","sigHash":"3b43c307e5dcdcf983e1f8ffeb4ffe2b08dd85908e890166b591227ef8c29eb7","bodyHash":"5c72580ab4c0e7fb39c67251e214a37233615cb84ab0e23c5ed43ea58a160073"}
 *
 * Go source:
 * func (p *Printer) emitPrologueDirectives(statements *ast.StatementList) int {
 * 	for i, statement := range statements.Nodes {
 * 		if ast.IsPrologueDirective(statement) {
 * 			p.writeLine()
 * 			p.emitStatement(statement)
 * 		} else {
 * 			return i
 * 		}
 * 	}
 * 	return len(statements.Nodes)
 * }
 */
export function Printer_emitPrologueDirectives(receiver: GoPtr<Printer>, statements: GoPtr<StatementList>): int {
  for (let i = 0; i < statements!.Nodes.length; i++) {
    const statement = statements!.Nodes[i];
    if (IsPrologueDirective(statement)) {
      Printer_writeLine(receiver);
      Printer_emitStatement(receiver, statement);
    } else {
      return i as int;
    }
  }
  return statements!.Nodes.length as int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTripleSlashDirectives","kind":"method","status":"implemented","sigHash":"1722f38c6218724e58dcf741d0591ec872b2cfd35d2cd666cdab482f1bed0452","bodyHash":"9232692574b324de073b27b0ca3a92f223d1324b9b36137e671db0bd4c799e4f"}
 *
 * Go source:
 * func (p *Printer) emitTripleSlashDirectives(node *ast.SourceFile) {
 * 	p.emitDirective("path", node.ReferencedFiles)
 * 	p.emitDirective("types", node.TypeReferenceDirectives)
 * 	p.emitDirective("lib", node.LibReferenceDirectives)
 * }
 */
export function Printer_emitTripleSlashDirectives(receiver: GoPtr<Printer>, node: GoPtr<SourceFile>): void {
  Printer_emitDirective(receiver, "path", node!.ReferencedFiles);
  Printer_emitDirective(receiver, "types", node!.TypeReferenceDirectives);
  Printer_emitDirective(receiver, "lib", node!.LibReferenceDirectives);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitDirective","kind":"method","status":"implemented","sigHash":"adcb8b9127be0870b7f73d54dc59907644331111574e177d5c9b1de5d090fe7e","bodyHash":"c67b2008d5687f058992946aa7c5fb9ada1e56d4b85f3bf0e9fa2a74124fd7d8"}
 *
 * Go source:
 * func (p *Printer) emitDirective(kind string, refs []*ast.FileReference) {
 * 	for _, ref := range refs {
 * 		var resolutionMode string
 * 		if ref.ResolutionMode != core.ResolutionModeNone {
 * 			resolutionMode = fmt.Sprintf(`resolution-mode="%s" `, core.IfElse(ref.ResolutionMode == core.ResolutionModeESM, "import", "require"))
 * 		}
 * 		p.writeComment(fmt.Sprintf("/// <reference %s=\"%s\" %s%s/>", kind, ref.FileName, resolutionMode, core.IfElse(ref.Preserve, `preserve="true" `, "")))
 * 		p.writeLine()
 * 	}
 * }
 */
export function Printer_emitDirective(receiver: GoPtr<Printer>, kind: string, refs: GoSlice<GoPtr<FileReference>>): void {
  for (const ref of refs) {
    let resolutionMode = "";
    if (ref!.ResolutionMode !== ResolutionModeNone) {
      resolutionMode = `resolution-mode="${IfElse(ref!.ResolutionMode === ResolutionModeESM, "import", "require")}" `;
    }
    Printer_writeComment(receiver, `/// <reference ${kind}="${ref!.FileName}" ${resolutionMode}${IfElse(ref!.Preserve, `preserve="true" `, "")}/>` as string);
    Printer_writeLine(receiver);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitCommentsBeforeNode","kind":"method","status":"implemented","sigHash":"f6f302aa893f8d55d08f86adee488c6944f940474285e0c37027ec63ac443dee","bodyHash":"1877a66f688501ecc4355a7738e586a12a48cf2b56a226cf3d152409b6cc9c32"}
 *
 * Go source:
 * func (p *Printer) emitCommentsBeforeNode(node *ast.Node) *commentState {
 * 	if !p.shouldEmitComments(node) {
 * 		return nil
 * 	}
 * 
 * 	emitFlags := p.emitContext.EmitFlags(node)
 * 	commentRange := p.emitContext.CommentRange(node)
 * 	containerPos := p.containerPos
 * 	containerEnd := p.containerEnd
 * 	declarationListContainerEnd := p.declarationListContainerEnd
 * 
 * 	// Emit leading comments
 * 	p.emitLeadingCommentsOfNode(node, emitFlags, commentRange)
 * 	p.emitLeadingSyntheticCommentsOfNode(node, emitFlags)
 * 	if emitFlags&EFNoNestedComments != 0 {
 * 		p.commentsDisabled = true
 * 	}
 * 
 * 	c := p.commentStateArena.New()
 * 	*c = commentState{emitFlags, commentRange, containerPos, containerEnd, declarationListContainerEnd}
 * 	return c
 * }
 */
export function Printer_emitCommentsBeforeNode(receiver: GoPtr<Printer>, node: GoPtr<Node>): GoPtr<commentState> {
  if (!Printer_shouldEmitComments(receiver, node)) {
    return undefined;
  }

  const emitFlags = EmitContext_EmitFlags(receiver!.emitContext, node);
  const commentRange = EmitContext_CommentRange(receiver!.emitContext, node);
  const containerPos = receiver!.containerPos;
  const containerEnd = receiver!.containerEnd;
  const declarationListContainerEnd = receiver!.declarationListContainerEnd;

  // Emit leading comments
  Printer_emitLeadingCommentsOfNode(receiver, node, emitFlags, commentRange);
  Printer_emitLeadingSyntheticCommentsOfNode(receiver, node, emitFlags);
  if ((emitFlags & EFNoNestedComments) !== 0) {
    receiver!.commentsDisabled = true;
  }

  const c = Arena_New(receiver!.commentStateArena) as GoPtr<commentState>;
  c!.emitFlags = emitFlags;
  c!.commentRange = commentRange;
  c!.containerPos = containerPos;
  c!.containerEnd = containerEnd;
  c!.declarationListContainerEnd = declarationListContainerEnd;
  return c;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitCommentsAfterNode","kind":"method","status":"implemented","sigHash":"f699e0f99a8f1785766a481daff2b8f07d1927628383bb83fd930e7a077ed866","bodyHash":"5fe98206d39fb57ec46c2aef6809b20be9e78fc1f5d64296a6f82ffd5effb3d7"}
 *
 * Go source:
 * func (p *Printer) emitCommentsAfterNode(node *ast.Node, state *commentState) {
 * 	if state == nil {
 * 		return
 * 	}
 *
 * 	emitFlags := state.emitFlags
 * 	commentRange := state.commentRange
 * 	containerPos := state.containerPos
 * 	containerEnd := state.containerEnd
 * 	declarationListContainerEnd := state.declarationListContainerEnd
 *
 * 	// Emit trailing comments
 * 	if emitFlags&EFNoNestedComments != 0 {
 * 		p.commentsDisabled = false
 * 	}
 *
 * 	p.emitTrailingSyntheticCommentsOfNode(node, emitFlags)
 * 	p.emitTrailingCommentsOfNode(node, emitFlags, commentRange, containerPos, containerEnd, declarationListContainerEnd)
 *
 * 	// Preserve comments from erased type annotation
 * 	if typeNode := p.emitContext.GetTypeNode(node); typeNode != nil {
 * 		p.emitTrailingCommentsOfNode(node, emitFlags, typeNode.Loc, containerPos, containerEnd, declarationListContainerEnd)
 * 	}
 * }
 */
export function Printer_emitCommentsAfterNode(receiver: GoPtr<Printer>, node: GoPtr<Node>, state: GoPtr<commentState>): void {
  if (state === undefined) {
    return;
  }

  const emitFlags = state.emitFlags;
  const commentRange = state.commentRange;
  const containerPos = state.containerPos;
  const containerEnd = state.containerEnd;
  const declarationListContainerEnd = state.declarationListContainerEnd;

  // Emit trailing comments
  if ((emitFlags & EFNoNestedComments) !== 0) {
    receiver!.commentsDisabled = false;
  }

  Printer_emitTrailingSyntheticCommentsOfNode(receiver, node, emitFlags);
  Printer_emitTrailingCommentsOfNode(receiver, node, emitFlags, commentRange, containerPos, containerEnd, declarationListContainerEnd);

  // Preserve comments from erased type annotation
  const typeNode = EmitContext_GetTypeNode(receiver!.emitContext, node);
  if (typeNode !== undefined) {
    Printer_emitTrailingCommentsOfNode(receiver, node, emitFlags, typeNode.Loc, containerPos, containerEnd, declarationListContainerEnd);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitCommentsBeforeToken","kind":"method","status":"implemented","sigHash":"a135fcec3a7652dced2ba8d5ebb74b532d58859a6bed75b4ffbdad2d69bb18c8","bodyHash":"a4c6088f78d5b1775f186b7054f72203c9706280689ad31392856d3437bbb6ff"}
 *
 * Go source:
 * func (p *Printer) emitCommentsBeforeToken(token ast.Kind, pos int, contextNode *ast.Node, flags tokenEmitFlags) (*commentState, int) {
 * 	if flags&tefNoComments != 0 || p.commentsDisabled {
 * 		// Still skip trivia so that the returned pos correctly identifies the token position.
 * 		// This is needed for trailing source map positions (writeTokenText advances pos by token length).
 * 		if p.currentSourceFile != nil && !ast.PositionIsSynthesized(pos) {
 * 			pos = scanner.SkipTrivia(p.currentSourceFile.Text(), pos)
 * 		}
 * 		return nil, pos
 * 	}
 * 
 * 	startPos := pos
 * 	if p.currentSourceFile != nil {
 * 		pos = scanner.SkipTrivia(p.currentSourceFile.Text(), startPos)
 * 	}
 * 
 * 	node := p.emitContext.ParseNode(contextNode)
 * 	isSimilarNode := node != nil && node.Kind == contextNode.Kind
 * 	if !isSimilarNode {
 * 		return nil, pos
 * 	}
 * 
 * 	if contextNode.Pos() != startPos {
 * 		indentLeading := flags&tefIndentLeadingComments != 0
 * 		needsIndent := indentLeading && p.currentSourceFile != nil && !PositionsAreOnSameLine(startPos, pos, p.currentSourceFile)
 * 		p.increaseIndentIf(needsIndent)
 * 		p.emitLeadingComments(startPos, false /*elided* /)
 * 		p.decreaseIndentIf(needsIndent)
 * 	}
 * 
 * 	return p.commentStateArena.New(), pos
 * }
 */
export function Printer_emitCommentsBeforeToken(receiver: GoPtr<Printer>, _token: Kind, pos: int, contextNode: GoPtr<Node>, flags: tokenEmitFlags): [GoPtr<commentState>, int] {
  if ((flags & tefNoComments) !== 0 || receiver!.commentsDisabled) {
    // Still skip trivia so that the returned pos correctly identifies the token position.
    // This is needed for trailing source map positions (writeTokenText advances pos by token length).
    if (receiver!.currentSourceFile !== undefined && !PositionIsSynthesized(pos)) {
      pos = SkipTrivia(SourceFile_Text(receiver!.currentSourceFile), pos) as int;
    }
    return [undefined, pos];
  }

  const startPos = pos;
  if (receiver!.currentSourceFile !== undefined) {
    pos = SkipTrivia(SourceFile_Text(receiver!.currentSourceFile), startPos) as int;
  }

  const node = EmitContext_ParseNode(receiver!.emitContext, contextNode);
  const isSimilarNode = node !== undefined && node!.Kind === contextNode!.Kind;
  if (!isSimilarNode) {
    return [undefined, pos];
  }

  if (Node_Pos(contextNode) !== startPos) {
    const indentLeading = (flags & tefIndentLeadingComments) !== 0;
    const needsIndent = (indentLeading && receiver!.currentSourceFile !== undefined && !PositionsAreOnSameLine(startPos, pos, receiver!.currentSourceFile as unknown as GoPtr<Node>)) as bool;
    Printer_increaseIndentIf(receiver, needsIndent);
    Printer_emitLeadingComments(receiver, startPos, false as bool);
    Printer_decreaseIndentIf(receiver, needsIndent);
  }

  return [Arena_New(receiver!.commentStateArena) as GoPtr<commentState>, pos];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitCommentsAfterToken","kind":"method","status":"implemented","sigHash":"f6b3129c3566811646ffdb597e8b915e3fb147f6beca56769d58ac8be257f7b7","bodyHash":"695f28d2140df2bb4818217e62856d62bb84f7dca1cb11b07238489ff39f00f6"}
 *
 * Go source:
 * func (p *Printer) emitCommentsAfterToken(token ast.Kind, pos int, contextNode *ast.Node, state *commentState) {
 * 	if state == nil {
 * 		return
 * 	}
 *
 * 	if contextNode.End() != pos {
 * 		isJsxExprContext := contextNode.Kind == ast.KindJsxExpression
 * 		p.emitTrailingComments(pos, core.IfElse(isJsxExprContext, commentSeparatorNone, commentSeparatorBefore))
 * 	}
 * }
 */
export function Printer_emitCommentsAfterToken(receiver: GoPtr<Printer>, token: Kind, pos: int, contextNode: GoPtr<Node>, state: GoPtr<commentState>): void {
  if (state === undefined) {
    return;
  }

  if (Node_End(contextNode) !== pos) {
    const isJsxExprContext = (contextNode!.Kind === KindJsxExpression) as bool;
    Printer_emitTrailingComments(receiver, pos, IfElse(isJsxExprContext, commentSeparatorNone, commentSeparatorBefore));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitDetachedCommentsBeforeStatementList","kind":"method","status":"implemented","sigHash":"8de68f13464dea8ba8668362c5789bc6a02df0d734f6ab01e1834642c061568b","bodyHash":"a693d2764f88d07455e7a3167353143258e3f7f809657d21e197830df56f63c3"}
 *
 * Go source:
 * func (p *Printer) emitDetachedCommentsBeforeStatementList(node *ast.Node, detachedRange core.TextRange) *commentState {
 * 	if !p.shouldEmitDetachedComments(node) {
 * 		return nil
 * 	}
 * 
 * 	emitFlags := p.emitContext.EmitFlags(node)
 * 	containerPos := p.containerPos
 * 	containerEnd := p.containerEnd
 * 	declarationListContainerEnd := p.declarationListContainerEnd
 * 	skipLeadingComments := ast.PositionIsSynthesized(detachedRange.Pos()) || emitFlags&EFNoLeadingComments != 0
 * 
 * 	if !skipLeadingComments {
 * 		p.emitDetachedCommentsAndUpdateCommentsInfo(detachedRange)
 * 	}
 * 
 * 	if emitFlags&EFNoNestedComments != 0 {
 * 		p.commentsDisabled = true
 * 	}
 * 
 * 	return &commentState{emitFlags, detachedRange, containerPos, containerEnd, declarationListContainerEnd}
 * }
 */
export function Printer_emitDetachedCommentsBeforeStatementList(receiver: GoPtr<Printer>, node: GoPtr<Node>, detachedRange: TextRange): GoPtr<commentState> {
  if (!Printer_shouldEmitDetachedComments(receiver, node)) {
    return undefined;
  }

  const emitFlags = EmitContext_EmitFlags(receiver!.emitContext, node);
  const containerPos = receiver!.containerPos;
  const containerEnd = receiver!.containerEnd;
  const declarationListContainerEnd = receiver!.declarationListContainerEnd;
  const skipLeadingComments = PositionIsSynthesized(TextRange_Pos(detachedRange)) || (emitFlags & EFNoLeadingComments) !== 0;

  if (!skipLeadingComments) {
    Printer_emitDetachedCommentsAndUpdateCommentsInfo(receiver, detachedRange);
  }

  if ((emitFlags & EFNoNestedComments) !== 0) {
    receiver!.commentsDisabled = true;
  }

  return { emitFlags, commentRange: detachedRange, containerPos, containerEnd, declarationListContainerEnd };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitDetachedCommentsAfterStatementList","kind":"method","status":"implemented","sigHash":"d0a7ae1b6665370a7ac60918e3d6297af65c45ac989c5f49d065f1a1e749abab","bodyHash":"a9ccdef733176166bd42f1c03b173971f5b5cf31e11ff86b40d2dcc73a84c1a9"}
 *
 * Go source:
 * func (p *Printer) emitDetachedCommentsAfterStatementList(node *ast.Node, detachedRange core.TextRange, state *commentState) {
 * 	if state == nil {
 * 		return
 * 	}
 * 
 * 	emitFlags := state.emitFlags
 * 	skipTrailingComments := p.commentsDisabled || ast.PositionIsSynthesized(detachedRange.End()) || emitFlags&EFNoTrailingComments != 0
 * 
 * 	if !skipTrailingComments {
 * 		hasWrittenComment := p.emitLeadingComments(detachedRange.End(), false /*elided* /)
 * 		if hasWrittenComment && !p.writer.IsAtStartOfLine() {
 * 			p.writeLine()
 * 		}
 * 	}
 * }
 */
export function Printer_emitDetachedCommentsAfterStatementList(receiver: GoPtr<Printer>, _node: GoPtr<Node>, detachedRange: TextRange, state: GoPtr<commentState>): void {
  if (state === undefined) {
    return;
  }

  const emitFlags = state!.emitFlags;
  const skipTrailingComments = receiver!.commentsDisabled || PositionIsSynthesized(TextRange_End(detachedRange)) || (emitFlags & EFNoTrailingComments) !== 0;

  if (!skipTrailingComments) {
    const hasWrittenComment = Printer_emitLeadingComments(receiver, TextRange_End(detachedRange), false as bool);
    if (hasWrittenComment && !receiver!.writer.IsAtStartOfLine()) {
      Printer_writeLine(receiver);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitLeadingCommentsOfNode","kind":"method","status":"implemented","sigHash":"e51951addd31d0128cb36d97b7d6db27d6faf0a3e0e423a8ed4f1f4c898dee4c","bodyHash":"8e01d85cbe6823320a9e15283a9bfb8f17816e4bf4b66f8bd915e45f9d7d8fd0"}
 *
 * Go source:
 * func (p *Printer) emitLeadingCommentsOfNode(node *ast.Node, emitFlags EmitFlags, commentRange core.TextRange) {
 * 	pos := commentRange.Pos()
 * 	end := commentRange.End()
 * 
 * 	// Save current container state on the stack.
 * 	if (!ast.PositionIsSynthesized(pos) || !ast.PositionIsSynthesized(end)) && pos != end {
 * 		// We have to explicitly check that the node is JsxText because if the compilerOptions.jsx is "preserve" we will not do any transformation.
 * 		// It is expensive to walk entire tree just to set one kind of node to have no comments.
 * 		skipLeadingComments := ast.PositionIsSynthesized(pos) || emitFlags&EFNoLeadingComments != 0 || node.Kind == ast.KindJsxText
 * 		skipTrailingComments := ast.PositionIsSynthesized(end) || emitFlags&EFNoTrailingComments != 0 || node.Kind == ast.KindJsxText
 * 
 * 		// Emit leading comments if the position is not synthesized and the node
 * 		// has not opted out from emitting leading comments.
 * 		if !skipLeadingComments {
 * 			p.emitLeadingComments(pos, node.Kind == ast.KindNotEmittedStatement /*elided* /)
 * 		}
 * 
 * 		if !skipLeadingComments || (pos >= 0 && (emitFlags&EFNoLeadingComments) != 0) {
 * 			// Advance the container position if comments get emitted or if they've been disabled explicitly using NoLeadingComments.
 * 			p.containerPos = pos
 * 		}
 * 
 * 		if !skipTrailingComments || (end >= 0 && (emitFlags&EFNoTrailingComments) != 0) {
 * 			// Advance the container end if comments get emitted or if they've been disabled explicitly using NoTrailingComments.
 * 			p.containerEnd = end
 * 
 * 			// To avoid invalid comment emit in a down-level binding pattern, we
 * 			// keep track of the last declaration list container's end
 * 			if node.Kind == ast.KindVariableDeclarationList {
 * 				p.declarationListContainerEnd = end
 * 			}
 * 		}
 * 	}
 * }
 */
export function Printer_emitLeadingCommentsOfNode(receiver: GoPtr<Printer>, node: GoPtr<Node>, emitFlags: EmitFlags, commentRange: TextRange): void {
  const pos = TextRange_Pos(commentRange);
  const end = TextRange_End(commentRange);

  // Save current container state on the stack.
  if ((!PositionIsSynthesized(pos) || !PositionIsSynthesized(end)) && pos !== end) {
    // We have to explicitly check that the node is JsxText because if the compilerOptions.jsx is "preserve" we will not do any transformation.
    // It is expensive to walk entire tree just to set one kind of node to have no comments.
    const skipLeadingComments = PositionIsSynthesized(pos) || (emitFlags & EFNoLeadingComments) !== 0 || node!.Kind === KindJsxText;
    const skipTrailingComments = PositionIsSynthesized(end) || (emitFlags & EFNoTrailingComments) !== 0 || node!.Kind === KindJsxText;

    // Emit leading comments if the position is not synthesized and the node
    // has not opted out from emitting leading comments.
    if (!skipLeadingComments) {
      Printer_emitLeadingComments(receiver, pos, (node!.Kind === KindNotEmittedStatement) as bool);
    }

    if (!skipLeadingComments || (pos >= 0 && (emitFlags & EFNoLeadingComments) !== 0)) {
      // Advance the container position if comments get emitted or if they've been disabled explicitly using NoLeadingComments.
      receiver!.containerPos = pos as int;
    }

    if (!skipTrailingComments || (end >= 0 && (emitFlags & EFNoTrailingComments) !== 0)) {
      // Advance the container end if comments get emitted or if they've been disabled explicitly using NoTrailingComments.
      receiver!.containerEnd = end as int;

      // To avoid invalid comment emit in a down-level binding pattern, we
      // keep track of the last declaration list container's end
      if (node!.Kind === KindVariableDeclarationList) {
        receiver!.declarationListContainerEnd = end as int;
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTrailingCommentsOfNode","kind":"method","status":"implemented","sigHash":"b4cb55d9a6870ebe92001fde98b8bf456c7a9a35f8cd024627fe838656253cd1","bodyHash":"6642745af255586cf8d7d92ca3e42063898f7c0200aeb8bfc80c4daa4d658f16"}
 *
 * Go source:
 * func (p *Printer) emitTrailingCommentsOfNode(node *ast.Node, emitFlags EmitFlags, commentRange core.TextRange, containerPos int, containerEnd int, declarationListContainerEnd int) {
 * 	pos := commentRange.Pos()
 * 	end := commentRange.End()
 * 	skipTrailingComments := end < 0 || (emitFlags&EFNoTrailingComments) != 0 || node.Kind == ast.KindJsxText
 * 	if (!ast.PositionIsSynthesized(pos) || !ast.PositionIsSynthesized(end)) && pos != end {
 * 		// Restore previous container state.
 * 		p.containerPos = containerPos
 * 		p.containerEnd = containerEnd
 * 		p.declarationListContainerEnd = declarationListContainerEnd
 * 
 * 		// Emit trailing comments if the position is not synthesized and the node
 * 		// has not opted out from emitting leading comments and is an emitted node.
 * 		if !skipTrailingComments && node.Kind != ast.KindNotEmittedStatement {
 * 			p.emitTrailingComments(end, commentSeparatorBefore)
 * 		}
 * 	}
 * }
 */
export function Printer_emitTrailingCommentsOfNode(receiver: GoPtr<Printer>, node: GoPtr<Node>, emitFlags: EmitFlags, commentRange: TextRange, containerPos: int, containerEnd: int, declarationListContainerEnd: int): void {
  const pos = TextRange_Pos(commentRange);
  const end = TextRange_End(commentRange);
  const skipTrailingComments = end < 0 || (emitFlags & EFNoTrailingComments) !== 0 || node!.Kind === KindJsxText;
  if ((!PositionIsSynthesized(pos) || !PositionIsSynthesized(end)) && pos !== end) {
    // Restore previous container state.
    receiver!.containerPos = containerPos;
    receiver!.containerEnd = containerEnd;
    receiver!.declarationListContainerEnd = declarationListContainerEnd;

    // Emit trailing comments if the position is not synthesized and the node
    // has not opted out from emitting leading comments and is an emitted node.
    if (!skipTrailingComments && node!.Kind !== KindNotEmittedStatement) {
      Printer_emitTrailingComments(receiver, end, commentSeparatorBefore);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitLeadingSyntheticCommentsOfNode","kind":"method","status":"implemented","sigHash":"a47a46c279591ac7e7c3a790b69b12dc90869c1dac874d8f04d3ff3bc10ea391","bodyHash":"325a56df8825fb890f9b2ad3d68409ce055444521549012cb3c4b25e8a56470a"}
 *
 * Go source:
 * func (p *Printer) emitLeadingSyntheticCommentsOfNode(node *ast.Node, emitFlags EmitFlags) {
 * 	if emitFlags&EFNoLeadingComments != 0 {
 * 		return
 * 	}
 * 	synth := p.emitContext.GetSyntheticLeadingComments(node)
 * 	for _, c := range synth {
 * 		p.emitLeadingSynthesizedComment(c)
 * 	}
 * }
 */
export function Printer_emitLeadingSyntheticCommentsOfNode(receiver: GoPtr<Printer>, node: GoPtr<Node>, emitFlags: EmitFlags): void {
  if ((emitFlags & EFNoLeadingComments) !== 0) {
    return;
  }
  const synth = EmitContext_GetSyntheticLeadingComments(receiver!.emitContext, node);
  for (const c of synth) {
    Printer_emitLeadingSynthesizedComment(receiver, c);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitLeadingSynthesizedComment","kind":"method","status":"implemented","sigHash":"b97367fc3dc6d78cc45e6af2adb3f52cdf3dbbe82744abbc87825ba3da328855","bodyHash":"a39fb2e2e15cf70e60ff488b5c9ad6569b9db2575ad8f6e7015fbe6a2bcb8353"}
 *
 * Go source:
 * func (p *Printer) emitLeadingSynthesizedComment(comment SynthesizedComment) {
 * 	if comment.HasLeadingNewLine || comment.Kind == ast.KindSingleLineCommentTrivia {
 * 		p.writer.WriteLine()
 * 	}
 * 	p.writeSynthesizedComment(comment)
 * 	if comment.HasTrailingNewLine || comment.Kind == ast.KindSingleLineCommentTrivia {
 * 		p.writer.WriteLine()
 * 	} else {
 * 		p.writer.WriteSpace(" ")
 * 	}
 * }
 */
export function Printer_emitLeadingSynthesizedComment(receiver: GoPtr<Printer>, comment: SynthesizedComment): void {
  if (comment.HasLeadingNewLine || comment.Kind === KindSingleLineCommentTrivia) {
    receiver!.writer.WriteLine();
  }
  Printer_writeSynthesizedComment(receiver, comment);
  if (comment.HasTrailingNewLine || comment.Kind === KindSingleLineCommentTrivia) {
    receiver!.writer.WriteLine();
  } else {
    receiver!.writer.WriteSpace(" ");
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTrailingSyntheticCommentsOfNode","kind":"method","status":"implemented","sigHash":"f0facb359c5a69939c2961bdef1afae3903b7b5af394b83f475c762cb76339b6","bodyHash":"6f2d183b2f8c518a71f17e683ccc57f4a6fae2b45b2ffb83f7114f89f957cea5"}
 *
 * Go source:
 * func (p *Printer) emitTrailingSyntheticCommentsOfNode(node *ast.Node, emitFlags EmitFlags) {
 * 	if emitFlags&EFNoTrailingComments != 0 {
 * 		return
 * 	}
 * 	synth := p.emitContext.GetSyntheticTrailingComments(node)
 * 	for _, c := range synth {
 * 		p.emitTrailingSynthesizedComment(c)
 * 	}
 * }
 */
export function Printer_emitTrailingSyntheticCommentsOfNode(receiver: GoPtr<Printer>, node: GoPtr<Node>, emitFlags: EmitFlags): void {
  if ((emitFlags & EFNoTrailingComments) !== 0) {
    return;
  }
  const synth = EmitContext_GetSyntheticTrailingComments(receiver!.emitContext, node);
  for (const c of synth) {
    Printer_emitTrailingSynthesizedComment(receiver, c);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTrailingSynthesizedComment","kind":"method","status":"implemented","sigHash":"7f6b329bd96550f2d9a529cf33a5105148f4234be191f967930f0018a2ffdbb7","bodyHash":"54d8fc940123e521fec43362d1b89d7d9c529a92c131fd344feb6aa206c23262"}
 *
 * Go source:
 * func (p *Printer) emitTrailingSynthesizedComment(comment SynthesizedComment) {
 * 	if !p.writer.IsAtStartOfLine() {
 * 		p.writer.WriteSpace(" ")
 * 	}
 * 	p.writeSynthesizedComment(comment)
 * 	if comment.HasTrailingNewLine {
 * 		p.writer.WriteLine()
 * 	}
 * }
 */
export function Printer_emitTrailingSynthesizedComment(receiver: GoPtr<Printer>, comment: SynthesizedComment): void {
  if (!receiver!.writer.IsAtStartOfLine()) {
    receiver!.writer.WriteSpace(" ");
  }
  Printer_writeSynthesizedComment(receiver, comment);
  if (comment.HasTrailingNewLine) {
    receiver!.writer.WriteLine();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::func::formatSynthesizedComment","kind":"func","status":"implemented","sigHash":"11f32dfc76d6fc54abc46114416650bf60e098509417d3873c176258f66ec4f7","bodyHash":"37864d56397a0f03a3561a2fe28b91f32682ba0b6666bd78c5edacccddf74011"}
 *
 * Go source:
 * func formatSynthesizedComment(comment SynthesizedComment) string {
 * 	if comment.Kind == ast.KindMultiLineCommentTrivia {
 * 		return "/*" + comment.Text + "*\/"
 * 	}
 * 	return "//" + comment.Text
 * }
 */
export function formatSynthesizedComment(comment: SynthesizedComment): string {
  if (comment.Kind === KindMultiLineCommentTrivia) {
    return "/*" + comment.Text + "*/";
  }
  return "//" + comment.Text;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.writeSynthesizedComment","kind":"method","status":"implemented","sigHash":"c53e9686ec734a1a4c626025fa3554fcfdb746de416bfe5f39a084d343b62a8a","bodyHash":"640c3b678e15c02de526be0de5364a47fb2e830a38084c626c758c3a31969150"}
 *
 * Go source:
 * func (p *Printer) writeSynthesizedComment(comment SynthesizedComment) {
 * 	text := formatSynthesizedComment(comment)
 * 	var lineMap []core.TextPos
 * 	if comment.Kind == ast.KindMultiLineCommentTrivia {
 * 		lineMap = core.ComputeECMALineStarts(text)
 * 	}
 * 	p.writeCommentRangeWorker(text, lineMap, comment.Kind, core.NewTextRange(0, len(text)))
 * }
 */
export function Printer_writeSynthesizedComment(receiver: GoPtr<Printer>, comment: SynthesizedComment): void {
  const text = formatSynthesizedComment(comment);
  const lineMap: GoSlice<TextPos> = comment.Kind === KindMultiLineCommentTrivia ? ComputeECMALineStarts(text) : [];
  Printer_writeCommentRangeWorker(receiver, text, lineMap, comment.Kind, NewTextRange(0, byteLen(text)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitLeadingComments","kind":"method","status":"implemented","sigHash":"2b2a0229b569efe285b46de48a76c1dbcee816c2da5de60fdd273d62ba23c279","bodyHash":"1a738a10e70e231931849ae9f4773de804c887a68de6b97387249375a9a0589a"}
 *
 * Go source:
 * func (p *Printer) emitLeadingComments(pos int, elided bool) bool {
 * 	// Emit the leading comments only if the container's pos doesn't match because the container should take care of emitting these comments
 * 	if p.commentsDisabled || p.currentSourceFile == nil || ast.PositionIsSynthesized(pos) || pos == p.containerPos {
 * 		return false
 * 	}
 * 
 * 	tripleSlash := core.TSUnknown
 * 	if !elided {
 * 		if pos == 0 && p.currentSourceFile != nil && p.currentSourceFile.IsDeclarationFile {
 * 			tripleSlash = core.TSFalse
 * 		}
 * 	} else if pos == 0 {
 * 		// If the node will not be emitted in JS, remove all the comments(normal, pinned and ///) associated with the node,
 * 		// unless it is a triple slash comment at the top of the file.
 * 		// For Example:
 * 		//      /// <reference-path ...>
 * 		//      declare var x;
 * 		//      /// <reference-path ...>
 * 		//      interface F {}
 * 		//  The first /// will NOT be removed while the second one will be removed even though both node will not be emitted
 * 		tripleSlash = core.TSTrue
 * 	} else {
 * 		return false
 * 	}
 * 
 * 	// skip detached comments
 * 	if p.detachedCommentsInfo.Len() > 0 {
 * 		if info := p.detachedCommentsInfo.Peek(); info.nodePos == pos {
 * 			pos = p.detachedCommentsInfo.Pop().detachedCommentEndPos
 * 		}
 * 	}
 * 
 * 	var comments []ast.CommentRange
 * 	for comment := range scanner.GetLeadingCommentRanges(p.emitContext.Factory.AsNodeFactory(), p.currentSourceFile.Text(), pos) {
 * 		if p.shouldWriteComment(comment) && p.shouldEmitCommentIfTripleSlash(comment, tripleSlash) {
 * 			comments = append(comments, comment)
 * 		}
 * 	}
 * 
 * 	if len(comments) > 0 && p.shouldEmitNewLineBeforeLeadingCommentOfPosition(pos, comments[0].Pos()) {
 * 		p.writeLine()
 * 	}
 * 
 * 	// Leading comments are emitted as /*leading comment1* /space/*leading comment* /space
 * 	return p.emitComments(comments, commentSeparatorAfter)
 * }
 */
export function Printer_emitLeadingComments(receiver: GoPtr<Printer>, pos: int, elided: bool): bool {
  // Emit the leading comments only if the container's pos doesn't match because the container should take care of emitting these comments
  if (receiver!.commentsDisabled || receiver!.currentSourceFile === undefined || PositionIsSynthesized(pos) || pos === receiver!.containerPos) {
    return false as bool;
  }

  let tripleSlash: Tristate = TSUnknown;
  if (!elided) {
    if (pos === 0 && receiver!.currentSourceFile !== undefined && AsSourceFile(receiver!.currentSourceFile)!.IsDeclarationFile) {
      tripleSlash = TSFalse;
    }
  } else if (pos === 0) {
    // If the node will not be emitted in JS, remove all the comments(normal, pinned and ///) associated with the node,
    // unless it is a triple slash comment at the top of the file.
    tripleSlash = TSTrue;
  } else {
    return false as bool;
  }

  // skip detached comments
  const detachedStack = receiver!.detachedCommentsInfo as Stack<detachedCommentsInfo>;
  let adjustedPos = pos;
  if (Stack_Len(detachedStack) > 0) {
    const info = Stack_Peek(detachedStack) as detachedCommentsInfo;
    if (info.nodePos === adjustedPos) {
      adjustedPos = (Stack_Pop(detachedStack) as detachedCommentsInfo).detachedCommentEndPos;
    }
  }

  const nf = NodeFactory_AsNodeFactory(receiver!.emitContext!.Factory!.__tsgoEmbedded0);
  const text = SourceFile_Text(receiver!.currentSourceFile);
  const comments: CommentRange[] = [];
  GetLeadingCommentRanges(nf, text, adjustedPos)((comment) => {
    if (Printer_shouldWriteComment(receiver, comment) && Printer_shouldEmitCommentIfTripleSlash(receiver, comment, tripleSlash)) {
      comments.push(comment);
    }
    return true as bool;
  });

  if (comments.length > 0 && Printer_shouldEmitNewLineBeforeLeadingCommentOfPosition(receiver, adjustedPos, TextRange_Pos(comments[0]!))) {
    Printer_writeLine(receiver);
  }

  // Leading comments are emitted as /*leading comment1*/space/*leading comment*/space
  return Printer_emitComments(receiver, comments, commentSeparatorAfter);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitCommentIfTripleSlash","kind":"method","status":"implemented","sigHash":"c59e3bafc22bbc11c1dc7ebdd9c93b5fa0d3b31fda77365375b9c1f7bef8ab94","bodyHash":"a7ba28c8fce978543a6c2826d30e782c8699e5ea3156de4a181a1af64f8bc75e"}
 *
 * Go source:
 * func (p *Printer) shouldEmitCommentIfTripleSlash(comment ast.CommentRange, tripleSlash core.Tristate) bool {
 * 	switch tripleSlash {
 * 	case core.TSTrue:
 * 		return p.isTripleSlashComment(comment)
 * 	case core.TSFalse:
 * 		return !p.isTripleSlashComment(comment)
 * 	default:
 * 		return true
 * 	}
 * }
 */
export function Printer_shouldEmitCommentIfTripleSlash(receiver: GoPtr<Printer>, comment: CommentRange, tripleSlash: Tristate): bool {
  switch (tripleSlash) {
    case TSTrue:
      return Printer_isTripleSlashComment(receiver, comment);
    case TSFalse:
      return !Printer_isTripleSlashComment(receiver, comment);
    default:
      return true as bool;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.shouldEmitNewLineBeforeLeadingCommentOfPosition","kind":"method","status":"implemented","sigHash":"ca7354e9d884ea2371b6a24462a0ebc55f1be2981a70f2f6bbd965a965b229d9","bodyHash":"58253c378cc1eece6d1fea0cc6bf81d0050f1b59aab8db44f6bf293df9b2dd25"}
 *
 * Go source:
 * func (p *Printer) shouldEmitNewLineBeforeLeadingCommentOfPosition(pos int, commentPos int) bool {
 * 	// If the leading comments start on different line than the start of node, write new line
 * 	return p.currentSourceFile != nil &&
 * 		pos != commentPos &&
 * 		scanner.ComputeLineOfPosition(p.currentSourceFile.ECMALineMap(), pos) != scanner.ComputeLineOfPosition(p.currentSourceFile.ECMALineMap(), commentPos)
 * }
 */
export function Printer_shouldEmitNewLineBeforeLeadingCommentOfPosition(receiver: GoPtr<Printer>, pos: int, commentPos: int): bool {
  // If the leading comments start on different line than the start of node, write new line
  return (receiver!.currentSourceFile !== undefined &&
    pos !== commentPos &&
    ComputeLineOfPosition(SourceFile_ECMALineMap(receiver!.currentSourceFile), pos) !== ComputeLineOfPosition(SourceFile_ECMALineMap(receiver!.currentSourceFile), commentPos)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitLeadingCommentsOfPosition","kind":"method","status":"implemented","sigHash":"c2bc065a6f71e0799558a923ac12fe9504aa006a87c5bb0304c3b31c18c01cba","bodyHash":"67c6707474912d1e147e82b4b3d7e817ebb4d0098605f1f156785f07186e2624"}
 *
 * Go source:
 * func (p *Printer) emitLeadingCommentsOfPosition(pos int) {
 * 	if p.commentsDisabled || pos == -1 {
 * 		return
 * 	}
 * 
 * 	p.emitLeadingComments(pos, false /*elided* /)
 * }
 */
export function Printer_emitLeadingCommentsOfPosition(receiver: GoPtr<Printer>, pos: int): void {
  if (receiver!.commentsDisabled || pos === -1) {
    return;
  }
  Printer_emitLeadingComments(receiver, pos, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTrailingComments","kind":"method","status":"implemented","sigHash":"7d12128ec2a75dc3addc00c9a901a26b76fc0cb6cc84d6547412ad812373e2e1","bodyHash":"f6be74e8c27285a1e09af54407f4c3bfecde9d76bb6e86473cf631848ba7c52c"}
 *
 * Go source:
 * func (p *Printer) emitTrailingComments(pos int, commentSeparator commentSeparator) {
 * 	if p.commentsDisabled {
 * 		return
 * 	}
 * 	// Emit the trailing comments only if the container's end doesn't match because the container should take care of emitting these comments
 * 	if p.commentsDisabled || p.currentSourceFile == nil || p.containerEnd != -1 && (pos == p.containerEnd || pos == p.declarationListContainerEnd) {
 * 		return
 * 	}
 * 
 * 	var comments []ast.CommentRange
 * 	for comment := range scanner.GetTrailingCommentRanges(p.emitContext.Factory.AsNodeFactory(), p.currentSourceFile.Text(), pos) {
 * 		if p.shouldWriteComment(comment) {
 * 			comments = append(comments, comment)
 * 		}
 * 	}
 * 
 * 	// trailing comments are normally emitted as space/*trailing comment1* /space/*trailing comment2* /
 * 	p.emitComments(comments, commentSeparator)
 * }
 */
export function Printer_emitTrailingComments(receiver: GoPtr<Printer>, pos: int, commentSeparator: commentSeparator): void {
  if (receiver!.commentsDisabled) {
    return;
  }
  // Emit the trailing comments only if the container's end doesn't match because the container should take care of emitting these comments
  if (receiver!.commentsDisabled || receiver!.currentSourceFile === undefined || (receiver!.containerEnd !== -1 && (pos === receiver!.containerEnd || pos === receiver!.declarationListContainerEnd))) {
    return;
  }

  const nf = NodeFactory_AsNodeFactory(receiver!.emitContext!.Factory!.__tsgoEmbedded0);
  const text = SourceFile_Text(receiver!.currentSourceFile);
  const comments: CommentRange[] = [];
  GetTrailingCommentRanges(nf, text, pos)((comment) => {
    if (Printer_shouldWriteComment(receiver, comment)) {
      comments.push(comment);
    }
    return true as bool;
  });

  // trailing comments are normally emitted as space/*trailing comment1*/space/*trailing comment2*/
  Printer_emitComments(receiver, comments, commentSeparator);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTrailingCommentsOfPosition","kind":"method","status":"implemented","sigHash":"12a70c06fe739de9ae43ac275044439de89fb5169a7a182888088469a500d6a1","bodyHash":"99486e47600d5f8cca41f50ae96c21f55a72e528ac76c36ddf0979a71f2786b2"}
 *
 * Go source:
 * func (p *Printer) emitTrailingCommentsOfPosition(pos int, prefixSpace bool, forceNoNewline bool) {
 * 	if p.commentsDisabled || p.currentSourceFile == nil {
 * 		return
 * 	}
 * 	if p.containerEnd != -1 && (pos == p.containerEnd || pos == p.declarationListContainerEnd) {
 * 		return
 * 	}
 * 
 * 	var comments []ast.CommentRange
 * 	for comment := range scanner.GetTrailingCommentRanges(p.emitContext.Factory.AsNodeFactory(), p.currentSourceFile.Text(), pos) {
 * 		comments = append(comments, comment)
 * 	}
 * 	if len(comments) == 0 {
 * 		return
 * 	}
 * 
 * 	for _, comment := range comments {
 * 		if prefixSpace {
 * 			if !p.shouldWriteComment(comment) {
 * 				continue
 * 			}
 * 			if !p.writer.IsAtStartOfLine() {
 * 				p.writeSpace()
 * 			}
 * 			p.emitComment(comment)
 * 			if comment.HasTrailingNewLine {
 * 				p.writeLine()
 * 			}
 * 			continue
 * 		}
 * 
 * 		p.emitComment(comment)
 * 		switch {
 * 		case forceNoNewline:
 * 			if comment.Kind == ast.KindSingleLineCommentTrivia {
 * 				p.writeLine()
 * 			}
 * 		case comment.HasTrailingNewLine:
 * 			p.writeLine()
 * 		default:
 * 			p.writeSpace()
 * 		}
 * 	}
 * }
 */
export function Printer_emitTrailingCommentsOfPosition(receiver: GoPtr<Printer>, pos: int, prefixSpace: bool, forceNoNewline: bool): void {
  if (receiver!.commentsDisabled || receiver!.currentSourceFile === undefined) {
    return;
  }
  if (receiver!.containerEnd !== -1 && (pos === receiver!.containerEnd || pos === receiver!.declarationListContainerEnd)) {
    return;
  }

  const nf = NodeFactory_AsNodeFactory(receiver!.emitContext!.Factory!.__tsgoEmbedded0);
  const text = SourceFile_Text(receiver!.currentSourceFile);
  const comments: CommentRange[] = [];
  GetTrailingCommentRanges(nf, text, pos)((comment) => {
    comments.push(comment);
    return true as bool;
  });
  if (comments.length === 0) {
    return;
  }

  for (const comment of comments) {
    if (prefixSpace) {
      if (!Printer_shouldWriteComment(receiver, comment)) {
        continue;
      }
      if (!receiver!.writer.IsAtStartOfLine()) {
        Printer_writeSpace(receiver);
      }
      Printer_emitComment(receiver, comment);
      if (comment.HasTrailingNewLine) {
        Printer_writeLine(receiver);
      }
      continue;
    }

    Printer_emitComment(receiver, comment);
    if (forceNoNewline) {
      if (comment.Kind === KindSingleLineCommentTrivia) {
        Printer_writeLine(receiver);
      }
    } else if (comment.HasTrailingNewLine) {
      Printer_writeLine(receiver);
    } else {
      Printer_writeSpace(receiver);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitDetachedCommentsAndUpdateCommentsInfo","kind":"method","status":"implemented","sigHash":"c705621b8322fe06a853bdbf85335654e4aa0c68c632603b53c009b25f83b72e","bodyHash":"f7ef6ed760dbca39bbc645af961e0a11b3a163257254526e09b85c21cbe3bdee"}
 *
 * Go source:
 * func (p *Printer) emitDetachedCommentsAndUpdateCommentsInfo(textRange core.TextRange) {
 * 	if p.currentSourceFile == nil {
 * 		return
 * 	}
 * 	if currentDetachedCommentInfo, ok := p.emitDetachedComments(textRange); ok {
 * 		p.detachedCommentsInfo.Push(currentDetachedCommentInfo)
 * 	}
 * }
 */
export function Printer_emitDetachedCommentsAndUpdateCommentsInfo(receiver: GoPtr<Printer>, textRange: TextRange): void {
  if (receiver!.currentSourceFile === undefined) {
    return;
  }
  const [currentDetachedCommentInfo, ok] = Printer_emitDetachedComments(receiver, textRange);
  if (ok) {
    Stack_Push(receiver!.detachedCommentsInfo as Stack<detachedCommentsInfo>, currentDetachedCommentInfo);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitDetachedComments","kind":"method","status":"implemented","sigHash":"7531fa69d5938caf08c9f867369da9e2788fec366ed37ba09f8843def4e3acc7","bodyHash":"61e62e8362d1b42e78b26f5d75f289e6bf471bc93c8ad76769628277381923c4"}
 *
 * Go source:
 * func (p *Printer) emitDetachedComments(textRange core.TextRange) (result detachedCommentsInfo, hasResult bool) {
 * 	if p.currentSourceFile == nil {
 * 		return result, hasResult
 * 	}
 * 
 * 	text := p.currentSourceFile.Text()
 * 	lineMap := p.currentSourceFile.ECMALineMap()
 * 
 * 	var leadingComments []ast.CommentRange
 * 	if p.commentsDisabled {
 * 		// removeComments is true, only reserve pinned comment at the top of file
 * 		// For example:
 * 		//      /*! Pinned Comment * /
 * 		//
 * 		//      var x = 10;
 * 		if textRange.Pos() == 0 {
 * 			for comment := range scanner.GetLeadingCommentRanges(p.emitContext.Factory.AsNodeFactory(), text, textRange.Pos()) {
 * 				if IsPinnedComment(text, comment) {
 * 					leadingComments = append(leadingComments, comment)
 * 				}
 * 			}
 * 		}
 * 	} else {
 * 		// removeComments is false, just get detached as normal and bypass the process to filter comment
 * 		leadingComments = slices.Collect(scanner.GetLeadingCommentRanges(p.emitContext.Factory.AsNodeFactory(), text, textRange.Pos()))
 * 	}
 * 
 * 	if len(leadingComments) > 0 {
 * 		var detachedComments []ast.CommentRange
 * 		var lastComment ast.CommentRange
 * 		for i, comment := range leadingComments {
 * 			if i > 0 {
 * 				lastCommentLine := scanner.ComputeLineOfPosition(lineMap, lastComment.End())
 * 				commentLine := scanner.ComputeLineOfPosition(lineMap, comment.Pos())
 * 
 * 				if commentLine >= lastCommentLine+2 {
 * 					// There was a blank line between the last comment and this comment.  This
 * 					// comment is not part of the copyright comments.  Return what we have so
 * 					// far.
 * 					break
 * 				}
 * 			}
 * 
 * 			detachedComments = append(detachedComments, comment)
 * 			lastComment = comment
 * 		}
 * 
 * 		if len(detachedComments) > 0 {
 * 			// All comments look like they could have been part of the copyright header.  Make
 * 			// sure there is at least one blank line between it and the node.  If not, it's not
 * 			// a copyright header.
 * 			lastCommentLine := scanner.ComputeLineOfPosition(lineMap, core.LastOrNil(detachedComments).End())
 * 			nodeLine := scanner.ComputeLineOfPosition(lineMap, scanner.SkipTrivia(text, textRange.Pos()))
 * 			if nodeLine >= lastCommentLine+2 {
 * 				// Valid detachedComments
 *
 * 				// Filter to only comments that should be written (e.g., JSDoc-style in declaration emit)
 * 				var commentsToEmit []ast.CommentRange
 * 				for _, comment := range detachedComments {
 * 					if p.shouldWriteComment(comment) {
 * 						commentsToEmit = append(commentsToEmit, comment)
 * 					}
 * 				}
 *
 * 				if len(commentsToEmit) > 0 {
 * 					if p.shouldEmitNewLineBeforeLeadingCommentOfPosition(textRange.Pos(), commentsToEmit[0].Pos()) {
 * 						p.writeLine()
 * 					}
 *
 * 					p.emitComments(commentsToEmit, commentSeparatorAfter)
 * 				}
 * 				result = detachedCommentsInfo{nodePos: textRange.Pos(), detachedCommentEndPos: core.LastOrNil(detachedComments).End()}
 * 				hasResult = true
 * 			}
 * 		}
 * 	}
 * 	return result, hasResult
 * }
 */
export function Printer_emitDetachedComments(receiver: GoPtr<Printer>, textRange: TextRange): [detachedCommentsInfo, bool] {
  const result: detachedCommentsInfo = { nodePos: 0 as int, detachedCommentEndPos: 0 as int };
  let hasResult = false as bool;

  if (receiver!.currentSourceFile === undefined) {
    return [result, hasResult];
  }

  const nf = NodeFactory_AsNodeFactory(receiver!.emitContext!.Factory!.__tsgoEmbedded0);
  const text = SourceFile_Text(receiver!.currentSourceFile);
  const lineMap = SourceFile_ECMALineMap(receiver!.currentSourceFile);

  const leadingComments: CommentRange[] = [];
  if (receiver!.commentsDisabled) {
    // removeComments is true, only reserve pinned comment at the top of file
    if (TextRange_Pos(textRange) === 0) {
      GetLeadingCommentRanges(nf, text, TextRange_Pos(textRange))((comment) => {
        if (IsPinnedComment(text, comment)) {
          leadingComments.push(comment);
        }
        return true as bool;
      });
    }
  } else {
    // removeComments is false, just get detached as normal and bypass the process to filter comment
    GetLeadingCommentRanges(nf, text, TextRange_Pos(textRange))((comment) => {
      leadingComments.push(comment);
      return true as bool;
    });
  }

  if (leadingComments.length > 0) {
    const detachedComments: CommentRange[] = [];
    let lastComment: CommentRange = undefined!;
    for (let i = 0; i < leadingComments.length; i++) {
      const comment = leadingComments[i]!;
      if (i > 0) {
        const lastCommentLine = ComputeLineOfPosition(lineMap, TextRange_End(lastComment));
        const commentLine = ComputeLineOfPosition(lineMap, TextRange_Pos(comment));
        if (commentLine >= lastCommentLine + 2) {
          // There was a blank line between the last comment and this comment. This
          // comment is not part of the copyright comments. Return what we have so far.
          break;
        }
      }

      detachedComments.push(comment);
      lastComment = comment;
    }

    if (detachedComments.length > 0) {
      // All comments look like they could have been part of the copyright header. Make
      // sure there is at least one blank line between it and the node. If not, it's not
      // a copyright header.
      const lastDetachedComment = LastOrNil(detachedComments) as CommentRange;
      const lastCommentLine = ComputeLineOfPosition(lineMap, TextRange_End(lastDetachedComment));
      const nodeLine = ComputeLineOfPosition(lineMap, SkipTrivia(text, TextRange_Pos(textRange)));
      if (nodeLine >= lastCommentLine + 2) {
        // Valid detachedComments

        // Filter to only comments that should be written (e.g., JSDoc-style in declaration emit)
        const commentsToEmit: CommentRange[] = [];
        for (const comment of detachedComments) {
          if (Printer_shouldWriteComment(receiver, comment)) {
            commentsToEmit.push(comment);
          }
        }

        if (commentsToEmit.length > 0) {
          if (Printer_shouldEmitNewLineBeforeLeadingCommentOfPosition(receiver, TextRange_Pos(textRange), TextRange_Pos(commentsToEmit[0]!))) {
            Printer_writeLine(receiver);
          }

          Printer_emitComments(receiver, commentsToEmit, commentSeparatorAfter);
        }
        result.nodePos = TextRange_Pos(textRange);
        result.detachedCommentEndPos = TextRange_End(lastDetachedComment);
        hasResult = true as bool;
      }
    }
  }

  return [result, hasResult];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitComments","kind":"method","status":"implemented","sigHash":"ee4dca1240d1529f064ad788c45e1303c19f404e393dccdec4d1301977f48791","bodyHash":"f874d9f09fe4c7f0b48c95f25d4581ee77d0de9b8c00f122f0fd65afbe1af909"}
 *
 * Go source:
 * func (p *Printer) emitComments(comments []ast.CommentRange, commentSeparator commentSeparator) bool {
 * 	interveningSeparator := false
 * 	if len(comments) == 0 {
 * 		return false
 * 	}
 * 
 * 	if commentSeparator == commentSeparatorBefore {
 * 		p.writeSpace()
 * 	}
 * 
 * 	for _, comment := range comments {
 * 		if interveningSeparator {
 * 			p.writeSpace()
 * 			interveningSeparator = false
 * 		}
 * 
 * 		p.emitComment(comment)
 * 
 * 		if comment.Kind == ast.KindSingleLineCommentTrivia || comment.HasTrailingNewLine && commentSeparator != commentSeparatorNone {
 * 			p.writeLine()
 * 		} else {
 * 			interveningSeparator = commentSeparator != commentSeparatorNone
 * 		}
 * 	}
 * 
 * 	if interveningSeparator && commentSeparator == commentSeparatorAfter {
 * 		p.writeSpace()
 * 	}
 * 
 * 	return true
 * }
 */
export function Printer_emitComments(receiver: GoPtr<Printer>, comments: GoSlice<CommentRange>, commentSeparator: commentSeparator): bool {
  let interveningSeparator = false as bool;
  if (comments.length === 0) {
    return false as bool;
  }

  if (commentSeparator === commentSeparatorBefore) {
    Printer_writeSpace(receiver);
  }

  for (const comment of comments) {
    if (interveningSeparator) {
      Printer_writeSpace(receiver);
      interveningSeparator = false as bool;
    }

    Printer_emitComment(receiver, comment);

    if (comment.Kind === KindSingleLineCommentTrivia || (comment.HasTrailingNewLine && commentSeparator !== commentSeparatorNone)) {
      Printer_writeLine(receiver);
    } else {
      interveningSeparator = (commentSeparator !== commentSeparatorNone) as bool;
    }
  }

  if (interveningSeparator && commentSeparator === commentSeparatorAfter) {
    Printer_writeSpace(receiver);
  }

  return true as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitComment","kind":"method","status":"implemented","sigHash":"7eb5e75a7fa4efc872a596fc2feed034c874140c7ca3e803e89e54b3c8c73782","bodyHash":"b05ed65ec79755201ecbaf54a68040b776dfacf4c061da85893cd726bba2eed6"}
 *
 * Go source:
 * func (p *Printer) emitComment(comment ast.CommentRange) {
 * 	p.emitPos(comment.Pos())
 * 	p.writeCommentRange(comment)
 * 	p.emitPos(comment.End())
 * }
 */
export function Printer_emitComment(receiver: GoPtr<Printer>, comment: CommentRange): void {
  Printer_emitPos(receiver, TextRange_Pos(comment));
  Printer_writeCommentRange(receiver, comment);
  Printer_emitPos(receiver, TextRange_End(comment));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.isTripleSlashComment","kind":"method","status":"implemented","sigHash":"87b97553cc331814a2d6882cf851b74cce8cb4049c0c734232a0ec8b3c8fbf76","bodyHash":"bb1f353e38a458ceaa9a967e071dc7e4a2b6f178b728a6ffaa328fb6ec55785f"}
 *
 * Go source:
 * func (p *Printer) isTripleSlashComment(comment ast.CommentRange) bool {
 * 	return p.currentSourceFile != nil &&
 * 		IsRecognizedTripleSlashComment(p.currentSourceFile.Text(), comment)
 * }
 */
export function Printer_isTripleSlashComment(receiver: GoPtr<Printer>, comment: CommentRange): bool {
  return (receiver!.currentSourceFile !== undefined &&
    IsRecognizedTripleSlashComment(SourceFile_Text(receiver!.currentSourceFile), comment)) as bool;
}
