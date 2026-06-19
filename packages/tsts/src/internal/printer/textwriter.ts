import type { bool, int } from "../../go/scalars.js";
import type { GoPtr } from "../../go/compat.js";
import { Builder } from "../../go/strings.js";
import * as strings from "../../go/strings.js";
import * as utf8 from "../../go/unicode/utf8.js";
import type { Symbol } from "../ast/symbol.js";
import { ComputeECMALineStartsSeq, UTF16Len } from "../core/core.js";
import type { UTF16Offset } from "../core/core.js";
import type { TextPos } from "../core/text.js";
import { IsWhiteSpaceLike } from "../stringutil/util.js";
import type { EmitTextWriter } from "./emittextwriter.js";

// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length and
// byte slicing `s[i:]` operates on byte offsets. We mirror that contract by
// operating over the UTF-8 byte view and converting back at the boundaries.
const utf8Encoder: TextEncoder = new globalThis.TextEncoder();
const utf8Decoder: TextDecoder = new globalThis.TextDecoder("utf-8", { ignoreBOM: true });
const byteLen = (s: string): int => utf8Encoder.encode(s).length;
const byteSliceFrom = (s: string, start: int): string => {
  const bytes = utf8Encoder.encode(s);
  return utf8Decoder.decode(bytes.subarray(start));
};
const currentColumnByWriter = new WeakMap<textWriter, UTF16Offset>();
const textWriter_getCurrentColumn = (w: textWriter): UTF16Offset => currentColumnByWriter.get(w) ?? UTF16Len(byteSliceFrom(w.builder.String(), w.linePos));
const textWriter_setCurrentColumn = (w: textWriter, column: UTF16Offset): void => {
  currentColumnByWriter.set(w, column);
};
const textWriter_addCurrentColumn = (w: textWriter, text: string): void => {
  textWriter_setCurrentColumn(w, textWriter_getCurrentColumn(w) + UTF16Len(text));
};

// textWriter_as_EmitTextWriter adapts a *textWriter to the EmitTextWriter
// interface by delegating each method to the corresponding free function
// (Go interface satisfaction -> method-bearing adapter).
function textWriter_as_EmitTextWriter(receiver: GoPtr<textWriter>): EmitTextWriter {
  const w = receiver as textWriter;
  return {
    Write: (s: string): void => textWriter_Write(w, s),
    WriteTrailingSemicolon: (text: string): void => textWriter_WriteTrailingSemicolon(w, text),
    WriteComment: (text: string): void => textWriter_WriteComment(w, text),
    WriteKeyword: (text: string): void => textWriter_WriteKeyword(w, text),
    WriteOperator: (text: string): void => textWriter_WriteOperator(w, text),
    WritePunctuation: (text: string): void => textWriter_WritePunctuation(w, text),
    WriteSpace: (text: string): void => textWriter_WriteSpace(w, text),
    WriteStringLiteral: (text: string): void => textWriter_WriteStringLiteral(w, text),
    WriteParameter: (text: string): void => textWriter_WriteParameter(w, text),
    WriteProperty: (text: string): void => textWriter_WriteProperty(w, text),
    WriteSymbol: (text: string, symbol_: GoPtr<Symbol>): void => textWriter_WriteSymbol(w, text, symbol_),
    WriteLine: (): void => textWriter_WriteLine(w),
    WriteLineForce: (force: bool): void => textWriter_WriteLineForce(w, force),
    IncreaseIndent: (): void => textWriter_IncreaseIndent(w),
    DecreaseIndent: (): void => textWriter_DecreaseIndent(w),
    Clear: (): void => textWriter_Clear(w),
    String: (): string => textWriter_String(w),
    RawWrite: (s: string): void => textWriter_RawWrite(w, s),
    WriteLiteral: (s: string): void => textWriter_WriteLiteral(w, s),
    GetTextPos: (): int => textWriter_GetTextPos(w),
    GetLine: (): int => textWriter_GetLine(w),
    GetColumn: (): UTF16Offset => textWriter_GetColumn(w),
    GetIndent: (): int => textWriter_GetIndent(w),
    IsAtStartOfLine: (): bool => textWriter_IsAtStartOfLine(w),
    HasTrailingComment: (): bool => textWriter_HasTrailingComment(w),
    HasTrailingWhitespace: (): bool => textWriter_HasTrailingWhitespace(w),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"855d8d7d655c62a442034b8e537e7500cc4150c31040a5a2f60c0b4c6eead963"}
 *
 * Go source:
 * var _ EmitTextWriter = &textWriter{}
 */
export const __f8aeeddb_0: EmitTextWriter = textWriter_as_EmitTextWriter({
  newLine: "",
  indentSize: 0,
  builder: new Builder(),
  lastWritten: "",
  indent: 0,
  lineStart: false,
  lineCount: 0,
  linePos: 0,
  hasTrailingCommentState: false,
});

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::type::textWriter","kind":"type","status":"implemented","sigHash":"4e621145b7a6bb028cfe1dec2270c1ea771a49c3b841542f1a4d96f0a3c1a725","bodyHash":"5b7d02e461c16c75dc024540b94107eacc06421cf4b1e7215f5aebc20f8fbc3a"}
 *
 * Go source:
 * textWriter struct {
 * 	newLine                 string
 * 	indentSize              int
 * 	builder                 strings.Builder
 * 	lastWritten             string
 * 	indent                  int
 * 	lineStart               bool
 * 	lineCount               int
 * 	linePos                 int
 * 	hasTrailingCommentState bool
 * }
 */
export interface textWriter {
  newLine: string;
  indentSize: int;
  builder: Builder;
  lastWritten: string;
  indent: int;
  lineStart: bool;
  lineCount: int;
  linePos: int;
  hasTrailingCommentState: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.Clear","kind":"method","status":"implemented","sigHash":"ab3b0b0c3481f7b73b2c80d37ab75356a332aa9186e3116a8e30f5675af6f795","bodyHash":"e3f5a2d56f37224a5e5c9ac65f77cef630fb158d01a7caef56efabc1d1711e3c"}
 *
 * Go source:
 * func (w *textWriter) Clear() {
 * 	*w = textWriter{newLine: w.newLine, indentSize: w.indentSize, lineStart: true}
 * }
 */
export function textWriter_Clear(receiver: GoPtr<textWriter>): void {
  const w = receiver as textWriter;
  // *w = textWriter{...}: reset every field to its zero value, preserving the
  // pointer identity, except for the explicitly initialized fields.
  w.builder = new Builder();
  w.lastWritten = "";
  w.indent = 0;
  w.lineStart = true;
  w.lineCount = 0;
  w.linePos = 0;
  w.hasTrailingCommentState = false;
  textWriter_setCurrentColumn(w, 0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.Grow","kind":"method","status":"implemented","sigHash":"a7d4436faebfa14f1c3b53f0d11c58133095e50c45fe0abce76016c28d7426ae","bodyHash":"5c7736b5121b025a7a92aa9bb8022a975b3a58b8514cede500d2a0fef030d6b6"}
 *
 * Go source:
 * func (w *textWriter) Grow(n int) {
 * 	w.builder.Grow(n)
 * }
 */
export function textWriter_Grow(receiver: GoPtr<textWriter>, n: int): void {
  const w = receiver as textWriter;
  w.builder.Grow(n);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.DecreaseIndent","kind":"method","status":"implemented","sigHash":"85ea5c2ae626809f054edef76806b814313e7503f2a61801cd51aafd98874de7","bodyHash":"efc79f35162ffb243dba830865c5894ce417de3021b7d90a83dee7c80389a3c2"}
 *
 * Go source:
 * func (w *textWriter) DecreaseIndent() {
 * 	w.indent--
 * }
 */
export function textWriter_DecreaseIndent(receiver: GoPtr<textWriter>): void {
  const w = receiver as textWriter;
  w.indent--;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.GetColumn","kind":"method","status":"implemented","sigHash":"b5027d54637756e8405fb98e314c56bd8df83e1bbfa00a0a193f76db205f2435","bodyHash":"ad49f09606db7a6cf6be4df9ee308eecad8e79be7900d446d683e3e7beb90c78"}
 *
 * Go source:
 * func (w *textWriter) GetColumn() core.UTF16Offset {
 * 	if w.lineStart {
 * 		return core.UTF16Offset(w.indent * w.indentSize)
 * 	}
 * 	// Count UTF-16 code units from the last line start.
 * 	// For ASCII-only output (the common case), this equals the byte count.
 * 	return core.UTF16Len(w.builder.String()[w.linePos:])
 * }
 */
export function textWriter_GetColumn(receiver: GoPtr<textWriter>): UTF16Offset {
  const w = receiver as textWriter;
  if (w.lineStart) {
    return w.indent * w.indentSize;
  }
  return textWriter_getCurrentColumn(w);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.GetIndent","kind":"method","status":"implemented","sigHash":"5dbfac29ed9e38949e9599462dc139699860a9a4d70ee83fc71e7d10da6e8bac","bodyHash":"cd6448e348d8fcc1346a8fad57ce57a34a57aa3937413a0f3b188cc1f5b5d6dc"}
 *
 * Go source:
 * func (w *textWriter) GetIndent() int {
 * 	return w.indent
 * }
 */
export function textWriter_GetIndent(receiver: GoPtr<textWriter>): int {
  const w = receiver as textWriter;
  return w.indent;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.GetLine","kind":"method","status":"implemented","sigHash":"9daae312918d01307c1fd0044831580af6218e66bb9a6a090bb28829f7c2a723","bodyHash":"4666af597743b5445d91d9a0cb1b5eb91507be0e32c7664337af60b0d7c319b0"}
 *
 * Go source:
 * func (w *textWriter) GetLine() int {
 * 	return w.lineCount
 * }
 */
export function textWriter_GetLine(receiver: GoPtr<textWriter>): int {
  const w = receiver as textWriter;
  return w.lineCount;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.String","kind":"method","status":"implemented","sigHash":"66cf00865513ca1e723dc46bb92ef5397dd57fb6e94c2a5f82a898b2b53df4d8","bodyHash":"783f36a3bfdc53b960392550d746836da99609c6f0e4e84e4a8771a23f55adbb"}
 *
 * Go source:
 * func (w *textWriter) String() string {
 * 	return w.builder.String()
 * }
 */
export function textWriter_String(receiver: GoPtr<textWriter>): string {
  const w = receiver as textWriter;
  return w.builder.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.GetTextPos","kind":"method","status":"implemented","sigHash":"54cef23912d6edad3bcb39915e0742f92a7f03a63c360e161f056f9e02d85357","bodyHash":"7f7b8889607dc13719ea9f8dcac7afa9de6d019c2f72d2fc8fbeae06de89524f"}
 *
 * Go source:
 * func (w *textWriter) GetTextPos() int {
 * 	return w.builder.Len()
 * }
 */
export function textWriter_GetTextPos(receiver: GoPtr<textWriter>): int {
  const w = receiver as textWriter;
  return w.builder.Len();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.HasTrailingComment","kind":"method","status":"implemented","sigHash":"065e326dbc6e4c2ab2286833040948767e32b9d29dd63f40c43dabd43934fe04","bodyHash":"0fd3bd9a969e9ceeae9cb2f651f67e39767ec3be257425e517772a46ffb3e00e"}
 *
 * Go source:
 * func (w textWriter) HasTrailingComment() bool {
 * 	return w.hasTrailingCommentState
 * }
 */
export function textWriter_HasTrailingComment(receiver: textWriter): bool {
  const w = receiver;
  return w.hasTrailingCommentState;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.HasTrailingWhitespace","kind":"method","status":"implemented","sigHash":"54288402615189548e78da205ea489601b0d13f3e0d7d8fa7570350cb94fad88","bodyHash":"1ef552fa97c0a7488366926fcbbfe084e8595f47f54a07df578172a54b817f44"}
 *
 * Go source:
 * func (w *textWriter) HasTrailingWhitespace() bool {
 * 	if w.builder.Len() == 0 {
 * 		return false
 * 	}
 * 	ch, _ := utf8.DecodeLastRuneInString(w.lastWritten)
 * 	if ch == utf8.RuneError {
 * 		return false
 * 	}
 * 	return stringutil.IsWhiteSpaceLike(ch)
 * }
 */
export function textWriter_HasTrailingWhitespace(receiver: GoPtr<textWriter>): bool {
  const w = receiver as textWriter;
  if (w.builder.Len() === 0) {
    return false;
  }
  const [ch] = utf8.DecodeLastRuneInString(w.lastWritten);
  if (ch === utf8.RuneError) {
    return false;
  }
  return IsWhiteSpaceLike(ch);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.IncreaseIndent","kind":"method","status":"implemented","sigHash":"71c09eef928fbb45eb95ba4516b82bd1a0dc6c30b115c4ef68173cf563b6802b","bodyHash":"73d01d2b97d886e0eafb012bf8f94f3e1fb9ec911443be9336683013c68f2364"}
 *
 * Go source:
 * func (w *textWriter) IncreaseIndent() {
 * 	w.indent++
 * }
 */
export function textWriter_IncreaseIndent(receiver: GoPtr<textWriter>): void {
  const w = receiver as textWriter;
  w.indent++;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.IsAtStartOfLine","kind":"method","status":"implemented","sigHash":"90493b68e2b8e88b98c99e22b855c0c84f34e6670fd42a65ce8fdfcfcee75d2b","bodyHash":"9f714abec760e81f9349fabd002ca49296ebc89a7be78a300d1cfbb7e0917f26"}
 *
 * Go source:
 * func (w *textWriter) IsAtStartOfLine() bool {
 * 	return w.lineStart
 * }
 */
export function textWriter_IsAtStartOfLine(receiver: GoPtr<textWriter>): bool {
  const w = receiver as textWriter;
  return w.lineStart;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.RawWrite","kind":"method","status":"implemented","sigHash":"6304b412aa6829a57dd4b94b53f82a9e846366a08040d949aeb094f75c98e3a2","bodyHash":"97df85d13a2dc6f88ae67262c0644a65e374d173e559905fbddd8a3d80a0f11f"}
 *
 * Go source:
 * func (w *textWriter) RawWrite(s string) {
 * 	if s != "" {
 * 		w.builder.WriteString(s)
 * 		w.lastWritten = s
 * 		w.hasTrailingCommentState = false
 * 	}
 * 	w.updateLineCountAndPosFor(s)
 * }
 */
export function textWriter_RawWrite(receiver: GoPtr<textWriter>, s: string): void {
  const w = receiver as textWriter;
  if (s !== "") {
    w.builder.WriteString(s);
    w.lastWritten = s;
    w.hasTrailingCommentState = false;
  }
  textWriter_updateLineCountAndPosFor(w, s);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.updateLineCountAndPosFor","kind":"method","status":"implemented","sigHash":"174082f705bbdc6771b15d0def6ae7053e933044fa2e91fbd8603102d0c633fa","bodyHash":"e778f799fecd97b25b79254d0e1720589ed2667abe824ee446b0d5161d83a241"}
 *
 * Go source:
 * func (w *textWriter) updateLineCountAndPosFor(s string) {
 * 	var count int
 * 	var lastLineStart core.TextPos
 *
 * 	for lineStart := range core.ComputeECMALineStartsSeq(s) {
 * 		count++
 * 		lastLineStart = lineStart
 * 	}
 *
 * 	if count > 1 {
 * 		w.lineCount += count - 1
 * 		curLen := w.builder.Len()
 * 		w.linePos = curLen - len(s) + int(lastLineStart)
 * 		w.lineStart = (w.linePos - curLen) == 0
 * 		return
 * 	}
 * 	w.lineStart = false
 * }
 */
export function textWriter_updateLineCountAndPosFor(receiver: GoPtr<textWriter>, s: string): void {
  const w = receiver as textWriter;
  let count: int = 0;
  let lastLineStart: TextPos = 0;

  ComputeECMALineStartsSeq(s)((lineStart: TextPos): bool => {
    count++;
    lastLineStart = lineStart;
    return true;
  });

  if (count > 1) {
    w.lineCount += count - 1;
    const curLen = w.builder.Len();
    w.linePos = curLen - byteLen(s) + lastLineStart;
    w.lineStart = w.linePos - curLen === 0;
    textWriter_setCurrentColumn(w, UTF16Len(byteSliceFrom(s, lastLineStart)));
    return;
  }
  w.lineStart = false;
  textWriter_addCurrentColumn(w, s);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::constGroup::defaultIndentSize","kind":"constGroup","status":"implemented","sigHash":"29a0fc9dbed45a121f530f681695392dc15ae85f54a80de6eb8d8d4f7981e840","bodyHash":"f2e5af8d09407334b79e40c47c92fe2fc2f7f08928efac05521524d9b11fd661"}
 *
 * Go source:
 * const defaultIndentSize = 4
 */
export const defaultIndentSize: int = 4;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::func::GetDefaultIndentSize","kind":"func","status":"implemented","sigHash":"c731418a0dac8850bee9bcd0efb89deaaae4e412f8adf4afa1d0f466ca7b8928","bodyHash":"56a2cee214293973bd69cc6460c7e5c89efb31a9b4a5df46f3f85bf04b2577af"}
 *
 * Go source:
 * func GetDefaultIndentSize() int {
 * 	return defaultIndentSize
 * }
 */
export function GetDefaultIndentSize(): int {
  return defaultIndentSize;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::func::getIndentString","kind":"func","status":"implemented","sigHash":"5469cd8f9295c2f8c5162bfb7500b11f65cba5037b2b52aea2e4408e8e9cf59f","bodyHash":"56d2b7411642db2adb72ee34d0b9041d2674a16b514de8ca8eaa50d22a4ab404"}
 *
 * Go source:
 * func getIndentString(indent int, indentSize int) string {
 * 	if indent == 0 {
 * 		return ""
 * 	}
 * 	// TODO: This is cached in tsc - should it be cached here?
 * 	return strings.Repeat(" ", indent*indentSize)
 * }
 */
export function getIndentString(indent: int, indentSize: int): string {
  if (indent === 0) {
    return "";
  }
  // TODO: This is cached in tsc - should it be cached here?
  return strings.Repeat(" ", indent * indentSize);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.writeText","kind":"method","status":"implemented","sigHash":"d4fe21bb182596314a99a02d7ecff1a912d254114d67c61a45c96ed37bfadb14","bodyHash":"e53340534ac56327573892f5581582d892d5f41d73cf56b04fbc5bb27479b9fa"}
 *
 * Go source:
 * func (w *textWriter) writeText(s string) {
 * 	if s != "" {
 * 		if w.lineStart {
 * 			w.builder.WriteString(getIndentString(w.indent, w.indentSize))
 * 			w.lineStart = false
 * 		}
 * 		w.builder.WriteString(s)
 * 		w.lastWritten = s
 * 		w.updateLineCountAndPosFor(s)
 * 	}
 * }
 */
export function textWriter_writeText(receiver: GoPtr<textWriter>, s: string): void {
  const w = receiver as textWriter;
  if (s !== "") {
    if (w.lineStart) {
      const indentText = getIndentString(w.indent, w.indentSize);
      w.builder.WriteString(indentText);
      textWriter_setCurrentColumn(w, UTF16Len(indentText));
      w.lineStart = false;
    }
    w.builder.WriteString(s);
    w.lastWritten = s;
    textWriter_updateLineCountAndPosFor(w, s);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.Write","kind":"method","status":"implemented","sigHash":"cfa8d2d0df6550f8bd22a5a0b1a855f7ca11e26bf7111b971fbd813af580ee7b","bodyHash":"644100b5b795ff4c50686e13598e31ba5ebce233dd1c24b82701939bf8b89666"}
 *
 * Go source:
 * func (w *textWriter) Write(s string) {
 * 	if s != "" {
 * 		w.hasTrailingCommentState = false
 * 	}
 * 	w.writeText(s)
 * }
 */
export function textWriter_Write(receiver: GoPtr<textWriter>, s: string): void {
  const w = receiver as textWriter;
  if (s !== "") {
    w.hasTrailingCommentState = false;
  }
  textWriter_writeText(w, s);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.WriteComment","kind":"method","status":"implemented","sigHash":"be1306da9d678ba39ea4992d0f93537c52e11049c11cd4148eaa8b3902bbcba9","bodyHash":"a05cb5054b8d7fb406f0b86b7e6b95eac42e6e769989bf39901d6b82b6f06300"}
 *
 * Go source:
 * func (w *textWriter) WriteComment(text string) {
 * 	if text != "" {
 * 		w.hasTrailingCommentState = true
 * 	}
 * 	w.writeText(text)
 * }
 */
export function textWriter_WriteComment(receiver: GoPtr<textWriter>, text: string): void {
  const w = receiver as textWriter;
  if (text !== "") {
    w.hasTrailingCommentState = true;
  }
  textWriter_writeText(w, text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.WriteKeyword","kind":"method","status":"implemented","sigHash":"4977cf4822f79877e71378cfb0136fad16d82b13a08826e2301eb25c58b8801d","bodyHash":"d73378690faad8233edf7bd01d0aefdf97aa523b0d0b25dd02840a86e25c9a18"}
 *
 * Go source:
 * func (w *textWriter) WriteKeyword(text string) {
 * 	w.Write(text)
 * }
 */
export function textWriter_WriteKeyword(receiver: GoPtr<textWriter>, text: string): void {
  const w = receiver as textWriter;
  textWriter_Write(w, text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.writeLineRaw","kind":"method","status":"implemented","sigHash":"79509198f6f07b92f3abe9860a6447fe1b1b67293a1ccb25bbe7753a1e46754d","bodyHash":"689d588a2d590d1555fc0ef8848c38afbd42de7b4f5562f59dba48ab97469185"}
 *
 * Go source:
 * func (w *textWriter) writeLineRaw() {
 * 	w.builder.WriteString(w.newLine)
 * 	w.lastWritten = w.newLine
 * 	w.lineCount++
 * 	w.linePos = w.builder.Len()
 * 	w.lineStart = true
 * 	w.hasTrailingCommentState = false
 * }
 */
export function textWriter_writeLineRaw(receiver: GoPtr<textWriter>): void {
  const w = receiver as textWriter;
  w.builder.WriteString(w.newLine);
  w.lastWritten = w.newLine;
  w.lineCount++;
  w.linePos = w.builder.Len();
  w.lineStart = true;
  w.hasTrailingCommentState = false;
  textWriter_setCurrentColumn(w, 0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.WriteLine","kind":"method","status":"implemented","sigHash":"6adde329b5c7910430e925d2a3e2ab097cb9ff359d9183eecd45a89e12797d30","bodyHash":"b87a243e699d18c82e37c6bb5160ab91d3fdf71c63197703577c75a506f6ab98"}
 *
 * Go source:
 * func (w *textWriter) WriteLine() {
 * 	if !w.lineStart {
 * 		w.writeLineRaw()
 * 	}
 * }
 */
export function textWriter_WriteLine(receiver: GoPtr<textWriter>): void {
  const w = receiver as textWriter;
  if (!w.lineStart) {
    textWriter_writeLineRaw(w);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.WriteLineForce","kind":"method","status":"implemented","sigHash":"f9a436e85288a19d7bfbe4ba63503fc9827ce5f31d7d97a30ae56e7432fc0846","bodyHash":"1f861c50e57afabd23ccc5eba8de8ec7ae56854c2e31a597b10745feef6e74cf"}
 *
 * Go source:
 * func (w *textWriter) WriteLineForce(force bool) {
 * 	if !w.lineStart || force {
 * 		w.writeLineRaw()
 * 	}
 * }
 */
export function textWriter_WriteLineForce(receiver: GoPtr<textWriter>, force: bool): void {
  const w = receiver as textWriter;
  if (!w.lineStart || force) {
    textWriter_writeLineRaw(w);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.WriteLiteral","kind":"method","status":"implemented","sigHash":"bd8c132dd0ae9330c068a903f2552f9d4bdd7708f54188a9014427db66faff14","bodyHash":"29abc417b576620ead19010d4810cf3140729ce9179ed0e20bd671e549bafd15"}
 *
 * Go source:
 * func (w *textWriter) WriteLiteral(s string) {
 * 	w.Write(s)
 * }
 */
export function textWriter_WriteLiteral(receiver: GoPtr<textWriter>, s: string): void {
  const w = receiver as textWriter;
  textWriter_Write(w, s);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.WriteOperator","kind":"method","status":"implemented","sigHash":"639fdcfe8bb10fd5106e53dbe51af22d4076733d7e5cf1309e22919caaf2c108","bodyHash":"21e339b04d7cf5c8ccbfe57a696c7a2d7aa243f4bb7f09981aac7adfc78bc110"}
 *
 * Go source:
 * func (w *textWriter) WriteOperator(text string) {
 * 	w.Write(text)
 * }
 */
export function textWriter_WriteOperator(receiver: GoPtr<textWriter>, text: string): void {
  const w = receiver as textWriter;
  textWriter_Write(w, text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.WriteParameter","kind":"method","status":"implemented","sigHash":"c9e7e05aa73c12cc8bec92bb5b05af25ada22aed3a88d184fbd0a9279f24cff9","bodyHash":"5b64967fa6942a8b37b96aceb710f642fe3020b722c4fc0952019ee075251060"}
 *
 * Go source:
 * func (w *textWriter) WriteParameter(text string) {
 * 	w.Write(text)
 * }
 */
export function textWriter_WriteParameter(receiver: GoPtr<textWriter>, text: string): void {
  const w = receiver as textWriter;
  textWriter_Write(w, text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.WriteProperty","kind":"method","status":"implemented","sigHash":"22779c53bdbdc5395b9b9105c0d3f17203c21c919857ab98f8d4f11b0a5306e5","bodyHash":"c091f29af95352e68a076defde32c1f51e549e69821f87b66cbfe109814d8965"}
 *
 * Go source:
 * func (w *textWriter) WriteProperty(text string) {
 * 	w.Write(text)
 * }
 */
export function textWriter_WriteProperty(receiver: GoPtr<textWriter>, text: string): void {
  const w = receiver as textWriter;
  textWriter_Write(w, text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.WritePunctuation","kind":"method","status":"implemented","sigHash":"acb1153e38ce2862b12f66610028637b179f9a1273819c317fb516eee5ffb3a3","bodyHash":"116e781a14186cef849171be81d65bcb4d564bad3b35a2141a940914e634587f"}
 *
 * Go source:
 * func (w *textWriter) WritePunctuation(text string) {
 * 	w.Write(text)
 * }
 */
export function textWriter_WritePunctuation(receiver: GoPtr<textWriter>, text: string): void {
  const w = receiver as textWriter;
  textWriter_Write(w, text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.WriteSpace","kind":"method","status":"implemented","sigHash":"9bfe0e0e1d41661130eb01105e65e497b8d1d35eba21ce9d3b3132000d824ead","bodyHash":"fb01b7f0e4c2ebfda0c259537a265ea050ebbb9c31f93b50ea4991e0b1132661"}
 *
 * Go source:
 * func (w *textWriter) WriteSpace(text string) {
 * 	w.Write(text)
 * }
 */
export function textWriter_WriteSpace(receiver: GoPtr<textWriter>, text: string): void {
  const w = receiver as textWriter;
  textWriter_Write(w, text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.WriteStringLiteral","kind":"method","status":"implemented","sigHash":"4f677177614b3a17f6954a89e96f5709a223aaa11aed2b6bbb099485bfd6507d","bodyHash":"6473c9bb4323d83301bd905b873554e96b7be559de71f852ba5fb4aaa0842685"}
 *
 * Go source:
 * func (w *textWriter) WriteStringLiteral(text string) {
 * 	w.Write(text)
 * }
 */
export function textWriter_WriteStringLiteral(receiver: GoPtr<textWriter>, text: string): void {
  const w = receiver as textWriter;
  textWriter_Write(w, text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.WriteSymbol","kind":"method","status":"implemented","sigHash":"11d0b212e0c31df7f8276d0c5cee6f6275d43a45a1b39832c207479800247814","bodyHash":"9a7965d3bebd9f28bf59eb3b14fde7a003a6f46470c782306df3b33bfcdd49d4"}
 *
 * Go source:
 * func (w *textWriter) WriteSymbol(text string, symbol *ast.Symbol) {
 * 	w.Write(text)
 * }
 */
export function textWriter_WriteSymbol(receiver: GoPtr<textWriter>, text: string, symbol_: GoPtr<Symbol>): void {
  const w = receiver as textWriter;
  textWriter_Write(w, text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::method::textWriter.WriteTrailingSemicolon","kind":"method","status":"implemented","sigHash":"78c4b38a6ef9f6ed8dd4d4ada6a818f3a304fc610c948c64fe845c4839242e9c","bodyHash":"203a3c3513df1e47cd507f854f9a2f2604cb72b822d26271e0c174834e04b40b"}
 *
 * Go source:
 * func (w *textWriter) WriteTrailingSemicolon(text string) {
 * 	w.Write(text)
 * }
 */
export function textWriter_WriteTrailingSemicolon(receiver: GoPtr<textWriter>, text: string): void {
  const w = receiver as textWriter;
  textWriter_Write(w, text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/textwriter.go::func::NewTextWriter","kind":"func","status":"implemented","sigHash":"bb5045d2682ef2a42811da365a37cebb78bbf716ad2ddac2979b6e000af14857","bodyHash":"f1f3d62ab3f131eb1cea9accc003197474c945b77542b6c54be9f6bd9d0a020a"}
 *
 * Go source:
 * func NewTextWriter(newLine string, indentSize int) EmitTextWriter {
 * 	if indentSize <= 0 {
 * 		indentSize = 4
 * 	}
 * 	var w textWriter
 * 	w.newLine = newLine
 * 	w.indentSize = indentSize
 * 	w.Clear()
 * 	return &w
 * }
 */
export function NewTextWriter(newLine: string, indentSize: int): EmitTextWriter {
  if (indentSize <= 0) {
    indentSize = 4;
  }
  // var w textWriter: zero-value struct.
  const w: textWriter = {
    newLine: "",
    indentSize: 0,
    builder: new Builder(),
    lastWritten: "",
    indent: 0,
    lineStart: false,
    lineCount: 0,
    linePos: 0,
    hasTrailingCommentState: false,
  };
  w.newLine = newLine;
  w.indentSize = indentSize;
  textWriter_Clear(w);
  return textWriter_as_EmitTextWriter(w);
}
