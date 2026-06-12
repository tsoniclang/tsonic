import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { Node } from "../ast/spine.js";
import type { IdentifierNode, TypeNode, TypePredicateNodeNode } from "../ast/generated/unions.js";
import { type SymbolFlags, SymbolFlagsAll } from "../ast/generated/flags.js";
import type { Kind } from "../ast/generated/kinds.js";
import {
  KindCallSignature,
  KindConstructorType,
  KindConstructSignature,
  KindFunctionType,
  KindSourceFile,
} from "../ast/generated/kinds.js";
import type { Symbol } from "../ast/symbol.js";
import type { SourceFile } from "../ast/ast.js";
import { GetSourceFileOfNode } from "../ast/utilities.js";
import type { UTF16Offset } from "../core/core.js";
import { TSTrue } from "../core/tristate.js";
import {
  type Flags,
  FlagsIgnoreErrors,
  FlagsNoTruncation,
  FlagsUseAliasDefinedOutsideCurrentScope,
  FlagsUseOnlyExternalAliasing,
  FlagsWriteTypeParametersInQualifiedName,
  type InternalFlags,
  InternalFlagsDoNotIncludeSymbolChain,
  InternalFlagsNone,
  InternalFlagsWriteComputedProps,
} from "../nodebuilder/types.js";
import type { EmitContext } from "../printer/emitcontext.js";
import type { EmitTextWriter } from "../printer/emittextwriter.js";
import { NewPrinter } from "../printer/printer/expressions.js";
import { Printer_Emit, Printer_Write } from "../printer/printer/emit-core.js";
import type { Printer } from "../printer/printer/state.js";
import { GetSingleLineStringWriter } from "../printer/singlelinestringwriter.js";
import { NewTextWriter } from "../printer/textwriter.js";
import type { Checker } from "./checker/state.js";
import { Checker_getBaseTypeOfEnumLikeType, Checker_getRegularTypeOfLiteralType } from "./checker/types.js";
import {
  Checker_getNodeBuilder,
  Checker_getNodeBuilderEx,
  NodeBuilder_EmitContext,
  NodeBuilder_ExpandSymbolForHover,
  NodeBuilder_SignatureToSignatureDeclaration,
  NodeBuilder_SymbolToEntityName,
  NodeBuilder_SymbolToNode,
  NodeBuilder_TypeParameterToDeclaration,
  NodeBuilder_TypePredicateToTypePredicateNode,
  NodeBuilder_TypeToTypeNode,
  type VerbosityContext,
} from "./nodebuilder.js";
import { defaultMaximumTruncationLength, noTruncationMaximumTruncationLength } from "./nodebuilderimpl.js";
import { ValueToString } from "./utilities.js";
import {
  type Signature,
  SignatureFlagsConstruct,
  SymbolFormatFlagsAllowAnyNodeKind,
  type SymbolFormatFlags,
  SymbolFormatFlagsDoNotIncludeSymbolChain,
  SymbolFormatFlagsUseAliasDefinedOutsideCurrentScope,
  SymbolFormatFlagsUseOnlyExternalAliasing,
  SymbolFormatFlagsWriteComputedProps,
  SymbolFormatFlagsWriteTypeParametersOrArguments,
  type Type,
  type TypeFlags,
  TypeFlagsBooleanLiteral,
  TypeFlagsEnumLike,
  TypeFlagsNull,
  TypeFlagsNullable,
  TypeFlagsUndefined,
  TypeFlagsUnion,
  TypeFormatFlagsAllowUniqueESSymbolType,
  type TypeFormatFlags,
  TypeFormatFlagsMultilineObjectLiterals,
  TypeFormatFlagsNodeBuilderFlagsMask,
  TypeFormatFlagsNone,
  TypeFormatFlagsNoTruncation,
  TypeFormatFlagsUseAliasDefinedOutsideCurrentScope,
  TypeFormatFlagsWriteArrowStyleSignature,
  TypeFormatFlagsWriteCallStyleSignature,
  type TypePredicate,
  Type_Types,
} from "./types.js";

// semicolonRemoverWriter_as_EmitTextWriter adapts a *semicolonRemoverWriter to
// the EmitTextWriter interface by delegating each method to the corresponding
// free function (Go interface satisfaction -> method-bearing adapter).
function semicolonRemoverWriter_as_EmitTextWriter(
  receiver: GoPtr<semicolonRemoverWriter>,
): EmitTextWriter {
  const s = receiver as semicolonRemoverWriter;
  return {
    Write: (s1: string): void => semicolonRemoverWriter_Write(s, s1),
    WriteTrailingSemicolon: (text: string): void =>
      semicolonRemoverWriter_WriteTrailingSemicolon(s, text),
    WriteComment: (text: string): void => semicolonRemoverWriter_WriteComment(s, text),
    WriteKeyword: (text: string): void => semicolonRemoverWriter_WriteKeyword(s, text),
    WriteOperator: (text: string): void => semicolonRemoverWriter_WriteOperator(s, text),
    WritePunctuation: (text: string): void =>
      semicolonRemoverWriter_WritePunctuation(s, text),
    WriteSpace: (text: string): void => semicolonRemoverWriter_WriteSpace(s, text),
    WriteStringLiteral: (text: string): void =>
      semicolonRemoverWriter_WriteStringLiteral(s, text),
    WriteParameter: (text: string): void => semicolonRemoverWriter_WriteParameter(s, text),
    WriteProperty: (text: string): void => semicolonRemoverWriter_WriteProperty(s, text),
    WriteSymbol: (text: string, symbol_: GoPtr<Symbol>): void =>
      semicolonRemoverWriter_WriteSymbol(s, text, symbol_),
    WriteLine: (): void => semicolonRemoverWriter_WriteLine(s),
    WriteLineForce: (force: bool): void => semicolonRemoverWriter_WriteLineForce(s, force),
    IncreaseIndent: (): void => semicolonRemoverWriter_IncreaseIndent(s),
    DecreaseIndent: (): void => semicolonRemoverWriter_DecreaseIndent(s),
    Clear: (): void => semicolonRemoverWriter_Clear(s),
    String: (): string => semicolonRemoverWriter_String(s),
    RawWrite: (s1: string): void => semicolonRemoverWriter_RawWrite(s, s1),
    WriteLiteral: (s1: string): void => semicolonRemoverWriter_WriteLiteral(s, s1),
    GetTextPos: (): int => semicolonRemoverWriter_GetTextPos(s),
    GetLine: (): int => semicolonRemoverWriter_GetLine(s),
    GetColumn: (): UTF16Offset => semicolonRemoverWriter_GetColumn(s),
    GetIndent: (): int => semicolonRemoverWriter_GetIndent(s),
    IsAtStartOfLine: (): bool => semicolonRemoverWriter_IsAtStartOfLine(s),
    HasTrailingComment: (): bool => semicolonRemoverWriter_HasTrailingComment(s),
    HasTrailingWhitespace: (): bool => semicolonRemoverWriter_HasTrailingWhitespace(s),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::func::createPrinterWithDefaults","kind":"func","status":"implemented","sigHash":"b0e99e4aac87cd803240e4fb6052e4d56ca8741de90fa3c742234c097250ef54","bodyHash":"837650bfbd3edbafc6e2815cef6d1535cfaed34eb000fbf9ee066307db5352e8"}
 *
 * Go source:
 * func createPrinterWithDefaults(emitContext *printer.EmitContext) *printer.Printer {
 * 	return printer.NewPrinter(printer.PrinterOptions{}, printer.PrintHandlers{}, emitContext)
 * }
 */
export function createPrinterWithDefaults(emitContext: GoPtr<EmitContext>): GoPtr<Printer> {
  return NewPrinter({}, {}, emitContext);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::func::createPrinterWithRemoveComments","kind":"func","status":"implemented","sigHash":"aedf07f8226ded30c11589f6db0cb0542fed24811ae7c22b119580aa11d4c4eb","bodyHash":"ef854b67d3947bf5dfc19f386e07138e67adc2cb0beb1109efd5c23c68bcf43e"}
 *
 * Go source:
 * func createPrinterWithRemoveComments(emitContext *printer.EmitContext) *printer.Printer {
 * 	return printer.NewPrinter(printer.PrinterOptions{RemoveComments: true}, printer.PrintHandlers{}, emitContext)
 * }
 */
export function createPrinterWithRemoveComments(emitContext: GoPtr<EmitContext>): GoPtr<Printer> {
  return NewPrinter({ RemoveComments: true }, {}, emitContext);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::func::createPrinterWithRemoveCommentsOmitTrailingSemicolonNeverAsciiEscape","kind":"func","status":"implemented","sigHash":"e9e0496f9d454042ff3b93d735e220dc4dfecf630f2bfa0160607bb5972cc642","bodyHash":"d7b7e1c77fa97cdebbf1898cf25e569137e35a80d676742dc9553d311dbba2ac"}
 *
 * Go source:
 * func createPrinterWithRemoveCommentsOmitTrailingSemicolonNeverAsciiEscape(emitContext *printer.EmitContext) *printer.Printer {
 * 	// TODO: OmitTrailingSemicolon support
 * 	return printer.NewPrinter(printer.PrinterOptions{
 * 		RemoveComments:   true,
 * 		NeverAsciiEscape: true,
 * 	}, printer.PrintHandlers{}, emitContext)
 * }
 */
export function createPrinterWithRemoveCommentsOmitTrailingSemicolonNeverAsciiEscape(emitContext: GoPtr<EmitContext>): GoPtr<Printer> {
  // TODO: OmitTrailingSemicolon support
  return NewPrinter({ RemoveComments: true, NeverAsciiEscape: true }, {}, emitContext);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::func::createPrinterWithRemoveCommentsNeverAsciiEscape","kind":"func","status":"implemented","sigHash":"7641f0f3fb6a54f494d6f06c640696e7f1f9e6de3fad7bbf753120fd94c7972a","bodyHash":"a9c521877814141fb4aca3e59bd293ed047f7742debb81b0686042b8ca3824ab"}
 *
 * Go source:
 * func createPrinterWithRemoveCommentsNeverAsciiEscape(emitContext *printer.EmitContext) *printer.Printer {
 * 	return printer.NewPrinter(printer.PrinterOptions{
 * 		RemoveComments:   true,
 * 		NeverAsciiEscape: true,
 * 	}, printer.PrintHandlers{}, emitContext)
 * }
 */
export function createPrinterWithRemoveCommentsNeverAsciiEscape(emitContext: GoPtr<EmitContext>): GoPtr<Printer> {
  return NewPrinter({ RemoveComments: true, NeverAsciiEscape: true }, {}, emitContext);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::type::semicolonRemoverWriter","kind":"type","status":"implemented","sigHash":"7a216135612f5869d2ce8a5907db5c91a0932ea6f7353ebf46e714c0d29d3817","bodyHash":"595a72733470815a9973d595c6c6d4f5bb13f572c45753aedc46f2c7589d22b4"}
 *
 * Go source:
 * semicolonRemoverWriter struct {
 * 	hasPendingSemicolon bool
 * 	inner               printer.EmitTextWriter
 * }
 */
export interface semicolonRemoverWriter {
  hasPendingSemicolon: bool;
  inner: EmitTextWriter;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.commitSemicolon","kind":"method","status":"implemented","sigHash":"a2fde3d16d6b05771ab1d890dad7f6c65e67dc8d97ef7d569e08d828864655b3","bodyHash":"6aa9843eaee904e0641c1e52b4f77d3b0de4cf44ddb700a535070a7a6d354104"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) commitSemicolon() {
 * 	if s.hasPendingSemicolon {
 * 		s.inner.WriteTrailingSemicolon(";")
 * 		s.hasPendingSemicolon = false
 * 	}
 * }
 */
export function semicolonRemoverWriter_commitSemicolon(receiver: GoPtr<semicolonRemoverWriter>): void {
  const s = receiver as semicolonRemoverWriter;
  if (s.hasPendingSemicolon) {
    s.inner.WriteTrailingSemicolon(";");
    s.hasPendingSemicolon = false;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.Clear","kind":"method","status":"implemented","sigHash":"054c7d7235fd9794b612a71011b4fb7b9f37eed1b06b8baa2ed3ee43e5e7fad7","bodyHash":"28502c018a3c913ef1fafb5a990920d891d33be240ff27edb480dbe5d3ccf43f"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) Clear() {
 * 	s.inner.Clear()
 * }
 */
export function semicolonRemoverWriter_Clear(receiver: GoPtr<semicolonRemoverWriter>): void {
  const s = receiver as semicolonRemoverWriter;
  s.inner.Clear();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.DecreaseIndent","kind":"method","status":"implemented","sigHash":"5df0b50d2aaf18f02d33d79b22fd7007620f57401b9c8a1bf3e626a76577eaf4","bodyHash":"5bd19eeb2ff0c2f28efbc481e67a6f91e2faed2b497f3f189363f22df6985db9"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) DecreaseIndent() {
 * 	s.commitSemicolon()
 * 	s.inner.DecreaseIndent()
 * }
 */
export function semicolonRemoverWriter_DecreaseIndent(receiver: GoPtr<semicolonRemoverWriter>): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.DecreaseIndent();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.GetColumn","kind":"method","status":"implemented","sigHash":"d5cba14b718415266ae18898e034c51e2adb4fbee523b9be3c58073187706bae","bodyHash":"3126215c6472c4326e628791e904fa73333717cac915a92f484f5849ba6e70ce"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) GetColumn() core.UTF16Offset {
 * 	return s.inner.GetColumn()
 * }
 */
export function semicolonRemoverWriter_GetColumn(receiver: GoPtr<semicolonRemoverWriter>): UTF16Offset {
  const s = receiver as semicolonRemoverWriter;
  return s.inner.GetColumn();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.GetIndent","kind":"method","status":"implemented","sigHash":"26db095931010010db67618bcfa77ada9783e4ede99c3c0cece82907fdb60a49","bodyHash":"e868234f9b2e25044c6941d698409f91b448fc52c394add88c4a0c8a2df5dde6"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) GetIndent() int {
 * 	return s.inner.GetIndent()
 * }
 */
export function semicolonRemoverWriter_GetIndent(receiver: GoPtr<semicolonRemoverWriter>): int {
  const s = receiver as semicolonRemoverWriter;
  return s.inner.GetIndent();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.GetLine","kind":"method","status":"implemented","sigHash":"160731c04ed2487dce61b9d0f863e9f1df01370c1292868d2295754472c82b05","bodyHash":"4c46fe02cdc989c7e6eb87f0da67802a077a0fdf3ba56b3e1d8f679f080646ce"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) GetLine() int {
 * 	return s.inner.GetLine()
 * }
 */
export function semicolonRemoverWriter_GetLine(receiver: GoPtr<semicolonRemoverWriter>): int {
  const s = receiver as semicolonRemoverWriter;
  return s.inner.GetLine();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.GetTextPos","kind":"method","status":"implemented","sigHash":"4a434fa78a3d3eac5a589103c8d84d5715c8cede8ea128fd364bcac7e6cf1bb1","bodyHash":"6f4ab1cfb4b9c4c205a98bdb6eda48cedcb441a0041615b7fc6ead9676b4442c"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) GetTextPos() int {
 * 	return s.inner.GetTextPos()
 * }
 */
export function semicolonRemoverWriter_GetTextPos(receiver: GoPtr<semicolonRemoverWriter>): int {
  const s = receiver as semicolonRemoverWriter;
  return s.inner.GetTextPos();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.HasTrailingComment","kind":"method","status":"implemented","sigHash":"f6a05aff18f45ae7ed522897e8547dd43f34dfcbca4fa672b41807424772f6ca","bodyHash":"b94cff7f0b795ec3d183fd293907d40c5cc18f4acf1be497d0c4fc850a00bd59"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) HasTrailingComment() bool {
 * 	return s.inner.HasTrailingComment()
 * }
 */
export function semicolonRemoverWriter_HasTrailingComment(receiver: GoPtr<semicolonRemoverWriter>): bool {
  const s = receiver as semicolonRemoverWriter;
  return s.inner.HasTrailingComment();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.HasTrailingWhitespace","kind":"method","status":"implemented","sigHash":"169fe109ae561b7fda94b2af424e30fc8b626d3ebabfdb783064822894f80e17","bodyHash":"dadad410175d392f8f2bc8ddc39fbfbdb1e2622bdb8b61b0e2b22a4cf0bc9d63"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) HasTrailingWhitespace() bool {
 * 	return s.inner.HasTrailingWhitespace()
 * }
 */
export function semicolonRemoverWriter_HasTrailingWhitespace(receiver: GoPtr<semicolonRemoverWriter>): bool {
  const s = receiver as semicolonRemoverWriter;
  return s.inner.HasTrailingWhitespace();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.IncreaseIndent","kind":"method","status":"implemented","sigHash":"d7945e6d184fb0374fad237107777211113f622ecd4c6b330cb32c3ecebb7689","bodyHash":"345dd72e2543c5ccd1d113b095ee0f193e0ead30fdb4b59853f1ab19f5eb92f6"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) IncreaseIndent() {
 * 	s.commitSemicolon()
 * 	s.inner.IncreaseIndent()
 * }
 */
export function semicolonRemoverWriter_IncreaseIndent(receiver: GoPtr<semicolonRemoverWriter>): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.IncreaseIndent();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.IsAtStartOfLine","kind":"method","status":"implemented","sigHash":"8c4756a234387be5cc618b79ea1e77faa547178b968c3bf43618e81fca3d027c","bodyHash":"5f2908ec36092bac7d8fe9797dad5e3ad532400def5a5aca75e8acf0dd90dafd"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) IsAtStartOfLine() bool {
 * 	return s.inner.IsAtStartOfLine()
 * }
 */
export function semicolonRemoverWriter_IsAtStartOfLine(receiver: GoPtr<semicolonRemoverWriter>): bool {
  const s = receiver as semicolonRemoverWriter;
  return s.inner.IsAtStartOfLine();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.RawWrite","kind":"method","status":"implemented","sigHash":"c98d0201adc14713085b1376cdaea749dd891e781fb97b02aa0e0f8cfc8e3397","bodyHash":"59a2911f092f28ba9ea52da4686f7a9078d29144e1e88c053caf473dc6be8aa9"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) RawWrite(s1 string) {
 * 	s.commitSemicolon()
 * 	s.inner.RawWrite(s1)
 * }
 */
export function semicolonRemoverWriter_RawWrite(receiver: GoPtr<semicolonRemoverWriter>, s1: string): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.RawWrite(s1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.String","kind":"method","status":"implemented","sigHash":"c1abe1858d49897dd068507cd8721ffefd3a89b20943fd409d89e9ccf2667348","bodyHash":"d672ddbb33f75b1730a3b07977e5bdc7f9d5a8b02457d29d6f9925da842e8504"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) String() string {
 * 	s.commitSemicolon()
 * 	return s.inner.String()
 * }
 */
export function semicolonRemoverWriter_String(receiver: GoPtr<semicolonRemoverWriter>): string {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  return s.inner.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.Write","kind":"method","status":"implemented","sigHash":"de66cd219aa9b76f30191c18a37e69b95bde372fa85ebb8524547f2504a6e90d","bodyHash":"5b3eed44ac9e1b0d613a25f52b7ec1906ef1e7da457d5af1914328b0f29abaf8"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) Write(s1 string) {
 * 	s.commitSemicolon()
 * 	s.inner.Write(s1)
 * }
 */
export function semicolonRemoverWriter_Write(receiver: GoPtr<semicolonRemoverWriter>, s1: string): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.Write(s1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.WriteComment","kind":"method","status":"implemented","sigHash":"a27122e08105588efd2b0e52ce8f7f8577182845cb2c64e1d900a91590f4cb4e","bodyHash":"12ad27973095345b4691fb9f1b148c10768914cc21f52c676c72b42fced59b19"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) WriteComment(text string) {
 * 	s.commitSemicolon()
 * 	s.inner.WriteComment(text)
 * }
 */
export function semicolonRemoverWriter_WriteComment(receiver: GoPtr<semicolonRemoverWriter>, text: string): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.WriteComment(text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.WriteKeyword","kind":"method","status":"implemented","sigHash":"37baa12a4e0f26fe46d93b1446a27db86076fa9ca071edf2c7b68ce6f040bdcf","bodyHash":"dbc88c4410f72953626be962530668948ee26d333784d88d66ed5998ce68bebb"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) WriteKeyword(text string) {
 * 	s.commitSemicolon()
 * 	s.inner.WriteKeyword(text)
 * }
 */
export function semicolonRemoverWriter_WriteKeyword(receiver: GoPtr<semicolonRemoverWriter>, text: string): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.WriteKeyword(text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.WriteLine","kind":"method","status":"implemented","sigHash":"fd74fee523eaf1a8ab5e1721e1951541832ba847aea34b421b0ea51a7f22b392","bodyHash":"5389e5c343754fa47bcc72ef56f828d64f89c69b2519f1e8244430febaf8993f"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) WriteLine() {
 * 	s.commitSemicolon()
 * 	s.inner.WriteLine()
 * }
 */
export function semicolonRemoverWriter_WriteLine(receiver: GoPtr<semicolonRemoverWriter>): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.WriteLine();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.WriteLineForce","kind":"method","status":"implemented","sigHash":"07ecb1cc856f22922c470a2a363c4356de9143fb48eb92c41f64e14c2071e974","bodyHash":"1936e7aa63ef96ebbbd7ed31de77d2bade31cfe617c8dbceb0aeeb57b4b2adaf"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) WriteLineForce(force bool) {
 * 	s.commitSemicolon()
 * 	s.inner.WriteLineForce(force)
 * }
 */
export function semicolonRemoverWriter_WriteLineForce(receiver: GoPtr<semicolonRemoverWriter>, force: bool): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.WriteLineForce(force);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.WriteLiteral","kind":"method","status":"implemented","sigHash":"79ab15dbbf2afcbf0739c342640f69093781a4c60457d59d4a82fbb71186d4fb","bodyHash":"97097c75fd234da905eb793afa494cea87113647bf031b2905e86741cfb620c3"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) WriteLiteral(s1 string) {
 * 	s.commitSemicolon()
 * 	s.inner.WriteLiteral(s1)
 * }
 */
export function semicolonRemoverWriter_WriteLiteral(receiver: GoPtr<semicolonRemoverWriter>, s1: string): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.WriteLiteral(s1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.WriteOperator","kind":"method","status":"implemented","sigHash":"21558da69613f1c61e0800b20c71d753a4ad4cf3089e99c84c0d431e6eca3b10","bodyHash":"99fd6577998503289670b657df225a0ec2be9c9418e0583600c087d2b0b06c88"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) WriteOperator(text string) {
 * 	s.commitSemicolon()
 * 	s.inner.WriteOperator(text)
 * }
 */
export function semicolonRemoverWriter_WriteOperator(receiver: GoPtr<semicolonRemoverWriter>, text: string): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.WriteOperator(text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.WriteParameter","kind":"method","status":"implemented","sigHash":"b647086a2f62f5f54eba1944df5182ba5d11e8ab16fbd8606c2de769950e45cc","bodyHash":"f67a33a6388798911d3b4a07feadad502c4cb0011729bdffed720a2c649c5ae8"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) WriteParameter(text string) {
 * 	s.commitSemicolon()
 * 	s.inner.WriteParameter(text)
 * }
 */
export function semicolonRemoverWriter_WriteParameter(receiver: GoPtr<semicolonRemoverWriter>, text: string): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.WriteParameter(text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.WriteProperty","kind":"method","status":"implemented","sigHash":"903f4a201c0d3d0bb26e26491c5935a725775de510844aafcea7b8526bdc118e","bodyHash":"8593178e5502c79d0eef373edf607f617f3519e5b866fc3ae16911a0f2da119d"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) WriteProperty(text string) {
 * 	s.commitSemicolon()
 * 	s.inner.WriteProperty(text)
 * }
 */
export function semicolonRemoverWriter_WriteProperty(receiver: GoPtr<semicolonRemoverWriter>, text: string): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.WriteProperty(text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.WritePunctuation","kind":"method","status":"implemented","sigHash":"68fb72d6b7d022fda18ae3ff8d369b152e12faefda18b0bdfbd6e7266ad37ecb","bodyHash":"3a08f250d0b21dc86a9df31dfe60cb7c562a75a83363b827ce48b9c9e25eae07"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) WritePunctuation(text string) {
 * 	s.commitSemicolon()
 * 	s.inner.WritePunctuation(text)
 * }
 */
export function semicolonRemoverWriter_WritePunctuation(receiver: GoPtr<semicolonRemoverWriter>, text: string): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.WritePunctuation(text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.WriteSpace","kind":"method","status":"implemented","sigHash":"923f6cf4ef931aa57063fd965d749afeef44cc2d6f19b9b1eac61457f7c9386d","bodyHash":"41d07259277728916a02b1af47f6f4046861204a70c15fdd223a6a8e0d3f5262"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) WriteSpace(text string) {
 * 	s.commitSemicolon()
 * 	s.inner.WriteSpace(text)
 * }
 */
export function semicolonRemoverWriter_WriteSpace(receiver: GoPtr<semicolonRemoverWriter>, text: string): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.WriteSpace(text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.WriteStringLiteral","kind":"method","status":"implemented","sigHash":"253151aade1ef3e813d1636d4f4c65b4a2b54f17ebfcaf686a8be6fa4fd4f1af","bodyHash":"2a6d31b0e23710503e3d96a5c41402766ae98534df2617746efadde8ccd3402c"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) WriteStringLiteral(text string) {
 * 	s.commitSemicolon()
 * 	s.inner.WriteStringLiteral(text)
 * }
 */
export function semicolonRemoverWriter_WriteStringLiteral(receiver: GoPtr<semicolonRemoverWriter>, text: string): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.WriteStringLiteral(text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.WriteSymbol","kind":"method","status":"implemented","sigHash":"0eb94bf9b77dc4df5fdc15b6d8261bd6565dcc45b714907c1376208879775b7e","bodyHash":"e4856dd92dbdbf250a499db0d91bcab55e1d0f6d14dae56b3aa12ba3b6041378"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) WriteSymbol(text string, symbol *ast.Symbol) {
 * 	s.commitSemicolon()
 * 	s.inner.WriteSymbol(text, symbol)
 * }
 */
export function semicolonRemoverWriter_WriteSymbol(receiver: GoPtr<semicolonRemoverWriter>, text: string, symbol_: GoPtr<Symbol>): void {
  const s = receiver as semicolonRemoverWriter;
  semicolonRemoverWriter_commitSemicolon(s);
  s.inner.WriteSymbol(text, symbol_);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::semicolonRemoverWriter.WriteTrailingSemicolon","kind":"method","status":"implemented","sigHash":"0dd245b299715995dacb73fd1d57117501a6d9fcd173400d375865f75927aeed","bodyHash":"3cf9bbc1338a1f6eccf373bc8856a3c8adfb095baf66653bd4241fa214ba8f18"}
 *
 * Go source:
 * func (s *semicolonRemoverWriter) WriteTrailingSemicolon(text string) {
 * 	s.hasPendingSemicolon = true
 * }
 */
export function semicolonRemoverWriter_WriteTrailingSemicolon(receiver: GoPtr<semicolonRemoverWriter>, text: string): void {
  const s = receiver as semicolonRemoverWriter;
  s.hasPendingSemicolon = true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::func::getTrailingSemicolonDeferringWriter","kind":"func","status":"implemented","sigHash":"ce0f3daa7f1e7c0a7490d7ad4cbd00808c9f6ea71f8441732494af1193aa8253","bodyHash":"b6f2d214ba17cfcfaa47656f5be08000795f3b501b23091205179aeffe75bc73"}
 *
 * Go source:
 * func getTrailingSemicolonDeferringWriter(writer printer.EmitTextWriter) printer.EmitTextWriter {
 * 	return &semicolonRemoverWriter{false, writer}
 * }
 */
export function getTrailingSemicolonDeferringWriter(writer: EmitTextWriter): EmitTextWriter {
  return semicolonRemoverWriter_as_EmitTextWriter({
    hasPendingSemicolon: false,
    inner: writer,
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.TypeToString","kind":"method","status":"implemented","sigHash":"8fe8596af99793ccd3bebd1f22b768a783c59a0eadf38cdc7ce1c3cde5445d71","bodyHash":"c6797a1dfa216d834259cb0ca62efdea411a75e5eb5eee2a8b159eb02890e8dc"}
 *
 * Go source:
 * func (c *Checker) TypeToString(t *Type) string {
 * 	return c.typeToString(t, nil)
 * }
 */
export function Checker_TypeToString(receiver: GoPtr<Checker>, t: GoPtr<Type>): string {
  return Checker_typeToString(receiver, t, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.typeToString","kind":"method","status":"implemented","sigHash":"b9a21458a2fbd9062ce8e15f0033ef85dfea58ddd4ab341681627a164ba06188","bodyHash":"291104950f4c69e8d2b7bae5eb6da0aa0cc46919ff98e1625a367422c2c0a468"}
 *
 * Go source:
 * func (c *Checker) typeToString(t *Type, enclosingDeclaration *ast.Node) string {
 * 	return c.typeToStringEx(t, enclosingDeclaration, TypeFormatFlagsAllowUniqueESSymbolType|TypeFormatFlagsUseAliasDefinedOutsideCurrentScope, nil)
 * }
 */
export function Checker_typeToString(receiver: GoPtr<Checker>, t: GoPtr<Type>, enclosingDeclaration: GoPtr<Node>): string {
  return Checker_typeToStringEx(
    receiver,
    t,
    enclosingDeclaration,
    (TypeFormatFlagsAllowUniqueESSymbolType | TypeFormatFlagsUseAliasDefinedOutsideCurrentScope) >>> 0,
    undefined,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::func::toNodeBuilderFlags","kind":"func","status":"implemented","sigHash":"e2d4002b95356ba89e149cbdbbe088be55f93dcfca614a773069eeb8bfc3b053","bodyHash":"090f9f320b18614f0c71a7a8e6fa3d5bb95716fec9efbe4d1f43cb95ec24df1c"}
 *
 * Go source:
 * func toNodeBuilderFlags(flags TypeFormatFlags) nodebuilder.Flags {
 * 	return nodebuilder.Flags(flags & TypeFormatFlagsNodeBuilderFlagsMask)
 * }
 */
export function toNodeBuilderFlags(flags: TypeFormatFlags): Flags {
  return (flags & TypeFormatFlagsNodeBuilderFlagsMask) >>> 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.TypeToStringEx","kind":"method","status":"implemented","sigHash":"67dc425d8a4e4b89aa0e752f5be659e2301aebb6bc43151c01a49fabbd069491","bodyHash":"137dfba6934c25c90fee5a835724e4631a4bafdc487d0bdd8667070a81023855"}
 *
 * Go source:
 * func (c *Checker) TypeToStringEx(t *Type, enclosingDeclaration *ast.Node, flags TypeFormatFlags, vc *VerbosityContext) string {
 * 	return c.typeToStringEx(t, enclosingDeclaration, flags, vc)
 * }
 */
export function Checker_TypeToStringEx(receiver: GoPtr<Checker>, t: GoPtr<Type>, enclosingDeclaration: GoPtr<Node>, flags: TypeFormatFlags, vc: GoPtr<VerbosityContext>): string {
  return Checker_typeToStringEx(receiver, t, enclosingDeclaration, flags, vc);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.typeToStringEx","kind":"method","status":"implemented","sigHash":"3e47a901a8692ae677c394ff74f227bfe286d7b0dcc6c17979e30a793458758d","bodyHash":"9daf9d40883840b046fe949ff2b317e9ae6a5837d429e42d54cfa9b70340ff00"}
 *
 * Go source:
 * func (c *Checker) typeToStringEx(t *Type, enclosingDeclaration *ast.Node, flags TypeFormatFlags, vc *VerbosityContext) string {
 * 	newLine := ""
 * 	if flags&TypeFormatFlagsMultilineObjectLiterals != 0 {
 * 		newLine = "\n"
 * 	}
 * 	writer := printer.NewTextWriter(newLine, 0)
 * 	noTruncation := ((vc == nil || vc.MaxTruncationLength == 0) && c.compilerOptions.NoErrorTruncation == core.TSTrue) || (flags&TypeFormatFlagsNoTruncation != 0)
 * 	combinedFlags := toNodeBuilderFlags(flags) | nodebuilder.FlagsIgnoreErrors
 * 	if noTruncation {
 * 		combinedFlags = combinedFlags | nodebuilder.FlagsNoTruncation
 * 	}
 * 	nodeBuilder := c.getNodeBuilder()
 * 	if vc != nil {
 * 		nodeBuilder.verbosity = vc
 * 	}
 * 	typeNode := nodeBuilder.TypeToTypeNode(t, enclosingDeclaration, combinedFlags, nodebuilder.InternalFlagsNone, nil)
 * 	if typeNode == nil {
 * 		panic("should always get typenode")
 * 	}
 * 	// The unresolved type gets a synthesized comment on `any` to hint to users that it's not a plain `any`.
 * 	// Otherwise, we always strip comments out.
 * 	var p *printer.Printer
 * 	if t == c.unresolvedType {
 * 		p = createPrinterWithDefaults(nodeBuilder.EmitContext())
 * 	} else {
 * 		p = createPrinterWithRemoveComments(nodeBuilder.EmitContext())
 * 	}
 * 	var sourceFile *ast.SourceFile
 * 	if enclosingDeclaration != nil {
 * 		sourceFile = ast.GetSourceFileOfNode(enclosingDeclaration)
 * 	}
 * 	p.Write(typeNode, sourceFile, writer, nil)
 * 	result := writer.String()
 * 
 * 	maxLength := defaultMaximumTruncationLength * 2
 * 	if vc != nil && vc.MaxTruncationLength > 0 {
 * 		maxLength = vc.MaxTruncationLength * 10 // hard cutoff matching Strada's absoluteMaximumLength
 * 	}
 * 	if noTruncation {
 * 		maxLength = noTruncationMaximumTruncationLength * 2
 * 	}
 * 	if maxLength > 0 && result != "" && len(result) >= maxLength {
 * 		if vc != nil {
 * 			vc.Truncated = true
 * 		}
 * 		return result[0:maxLength-len("...")] + "..."
 * 	}
 * 	return result
 * }
 */
export function Checker_typeToStringEx(receiver: GoPtr<Checker>, t: GoPtr<Type>, enclosingDeclaration: GoPtr<Node>, flags: TypeFormatFlags, vc: GoPtr<VerbosityContext>): string {
  const newLine = (flags & TypeFormatFlagsMultilineObjectLiterals) !== 0 ? "\n" : "";
  const writer = NewTextWriter(newLine, 0);
  const noTruncation =
    ((vc === undefined || vc.MaxTruncationLength === 0) && receiver!.compilerOptions!.NoErrorTruncation === TSTrue) ||
    (flags & TypeFormatFlagsNoTruncation) !== 0;
  let combinedFlags = (toNodeBuilderFlags(flags) | FlagsIgnoreErrors) >>> 0;
  if (noTruncation) {
    combinedFlags = (combinedFlags | FlagsNoTruncation) >>> 0;
  }
  const nodeBuilder = Checker_getNodeBuilder(receiver);
  if (vc !== undefined) {
    nodeBuilder!.verbosity = vc;
  }
  const typeNode = NodeBuilder_TypeToTypeNode(nodeBuilder, t, enclosingDeclaration, combinedFlags, InternalFlagsNone, undefined);
  if (typeNode === undefined) {
    throw new globalThis.Error("should always get typenode");
  }
  let p: GoPtr<Printer>;
  if (t === receiver!.unresolvedType) {
    p = createPrinterWithDefaults(NodeBuilder_EmitContext(nodeBuilder));
  } else {
    p = createPrinterWithRemoveComments(NodeBuilder_EmitContext(nodeBuilder));
  }
  let sourceFile: GoPtr<SourceFile> = undefined;
  if (enclosingDeclaration !== undefined) {
    sourceFile = GetSourceFileOfNode(enclosingDeclaration);
  }
  Printer_Write(p, typeNode, sourceFile, writer, undefined);
  const result = writer.String();

  let maxLength = defaultMaximumTruncationLength * 2;
  if (vc !== undefined && vc.MaxTruncationLength > 0) {
    maxLength = vc.MaxTruncationLength * 10;
  }
  if (noTruncation) {
    maxLength = noTruncationMaximumTruncationLength * 2;
  }
  if (maxLength > 0 && result !== "" && result.length >= maxLength) {
    if (vc !== undefined) {
      vc.Truncated = true;
    }
    return result.slice(0, maxLength - "...".length) + "...";
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.SymbolToString","kind":"method","status":"implemented","sigHash":"016d9673a3e69a95538735b198118ac5aed63aa2675f1faa1bc037effa2a0202","bodyHash":"3dc6d2f8ce5e6ddd77d71fd85bf42e536b4f0bd6f2facde647893989ef0f3380"}
 *
 * Go source:
 * func (c *Checker) SymbolToString(s *ast.Symbol) string {
 * 	return c.symbolToString(s)
 * }
 */
export function Checker_SymbolToString(receiver: GoPtr<Checker>, s: GoPtr<Symbol>): string {
  return Checker_symbolToString(receiver, s);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.symbolToString","kind":"method","status":"implemented","sigHash":"6c93ba58853adafe84e8687a5e2e83d754885a5349272450e62e4249db711901","bodyHash":"30010ca4e799ff45efcedd4b2ebe94709cf2682b78fda80b3dcc57f51a0a115a"}
 *
 * Go source:
 * func (c *Checker) symbolToString(symbol *ast.Symbol) string {
 * 	return c.symbolToStringEx(symbol, nil, ast.SymbolFlagsAll, SymbolFormatFlagsAllowAnyNodeKind)
 * }
 */
export function Checker_symbolToString(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): string {
  return Checker_symbolToStringEx(
    receiver,
    symbol_,
    undefined,
    SymbolFlagsAll,
    SymbolFormatFlagsAllowAnyNodeKind,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.SymbolToStringEx","kind":"method","status":"implemented","sigHash":"cb6707c7f4149453ad38a7e6d5e59cd1763293f017d82ae290a38135f7346275","bodyHash":"a4f8565c0410321e415ce5aff44c3ad38011395a5093b5a4bb472d8e2ff0adc1"}
 *
 * Go source:
 * func (c *Checker) SymbolToStringEx(symbol *ast.Symbol, enclosingDeclaration *ast.Node, meaning ast.SymbolFlags, flags SymbolFormatFlags) string {
 * 	return c.symbolToStringEx(symbol, enclosingDeclaration, meaning, flags)
 * }
 */
export function Checker_SymbolToStringEx(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, meaning: SymbolFlags, flags: SymbolFormatFlags): string {
  return Checker_symbolToStringEx(receiver, symbol_, enclosingDeclaration, meaning, flags);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.symbolToStringEx","kind":"method","status":"implemented","sigHash":"160d46046728c584ad91eb84e05dbbad353c8b88b8430426e4850068a4c9cca2","bodyHash":"c4fdbdff3000131d0289e7e924d95efaf0a1e6b2d6af4df293485c64a2d2d7e7"}
 *
 * Go source:
 * func (c *Checker) symbolToStringEx(symbol *ast.Symbol, enclosingDeclaration *ast.Node, meaning ast.SymbolFlags, flags SymbolFormatFlags) string {
 * 	writer, putWriter := printer.GetSingleLineStringWriter()
 * 	defer putWriter()
 * 
 * 	nodeFlags := nodebuilder.FlagsIgnoreErrors
 * 	internalNodeFlags := nodebuilder.InternalFlagsNone
 * 	if flags&SymbolFormatFlagsUseOnlyExternalAliasing != 0 {
 * 		nodeFlags |= nodebuilder.FlagsUseOnlyExternalAliasing
 * 	}
 * 	if flags&SymbolFormatFlagsWriteTypeParametersOrArguments != 0 {
 * 		nodeFlags |= nodebuilder.FlagsWriteTypeParametersInQualifiedName
 * 	}
 * 	if flags&SymbolFormatFlagsUseAliasDefinedOutsideCurrentScope != 0 {
 * 		nodeFlags |= nodebuilder.FlagsUseAliasDefinedOutsideCurrentScope
 * 	}
 * 	if flags&SymbolFormatFlagsDoNotIncludeSymbolChain != 0 {
 * 		internalNodeFlags |= nodebuilder.InternalFlagsDoNotIncludeSymbolChain
 * 	}
 * 	if flags&SymbolFormatFlagsWriteComputedProps != 0 {
 * 		internalNodeFlags |= nodebuilder.InternalFlagsWriteComputedProps
 * 	}
 * 
 * 	nodeBuilder := c.getNodeBuilder()
 * 	var sourceFile *ast.SourceFile
 * 	if enclosingDeclaration != nil {
 * 		sourceFile = ast.GetSourceFileOfNode(enclosingDeclaration)
 * 	}
 * 	var printer_ *printer.Printer
 * 	// add neverAsciiEscape for GH#39027
 * 	if enclosingDeclaration != nil && enclosingDeclaration.Kind == ast.KindSourceFile {
 * 		printer_ = createPrinterWithRemoveCommentsNeverAsciiEscape(nodeBuilder.EmitContext())
 * 	} else {
 * 		printer_ = createPrinterWithRemoveComments(nodeBuilder.EmitContext())
 * 	}
 * 
 * 	var builder func(symbol *ast.Symbol, meaning ast.SymbolFlags, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node
 * 	if flags&SymbolFormatFlagsAllowAnyNodeKind != 0 {
 * 		builder = nodeBuilder.SymbolToNode
 * 	} else {
 * 		builder = nodeBuilder.SymbolToEntityName
 * 	}
 * 	entity := builder(symbol, meaning, enclosingDeclaration, nodeFlags, internalNodeFlags, nil)         // TODO: GH#18217
 * 	printer_.Write(entity /*sourceFile* /, sourceFile, getTrailingSemicolonDeferringWriter(writer), nil) // TODO: GH#18217
 * 	return writer.String()
 * }
 */
export function Checker_symbolToStringEx(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, meaning: SymbolFlags, flags: SymbolFormatFlags): string {
  const [writer, putWriter] = GetSingleLineStringWriter();

  let nodeFlags = FlagsIgnoreErrors as Flags;
  let internalNodeFlags = InternalFlagsNone;
  if ((flags & SymbolFormatFlagsUseOnlyExternalAliasing) !== 0) {
    nodeFlags = (nodeFlags | FlagsUseOnlyExternalAliasing) >>> 0;
  }
  if ((flags & SymbolFormatFlagsWriteTypeParametersOrArguments) !== 0) {
    nodeFlags = (nodeFlags | FlagsWriteTypeParametersInQualifiedName) >>> 0;
  }
  if ((flags & SymbolFormatFlagsUseAliasDefinedOutsideCurrentScope) !== 0) {
    nodeFlags = (nodeFlags | FlagsUseAliasDefinedOutsideCurrentScope) >>> 0;
  }
  if ((flags & SymbolFormatFlagsDoNotIncludeSymbolChain) !== 0) {
    internalNodeFlags = (internalNodeFlags | InternalFlagsDoNotIncludeSymbolChain) >>> 0;
  }
  if ((flags & SymbolFormatFlagsWriteComputedProps) !== 0) {
    internalNodeFlags = (internalNodeFlags | InternalFlagsWriteComputedProps) >>> 0;
  }

  const nodeBuilder = Checker_getNodeBuilder(receiver);
  let sourceFile: GoPtr<SourceFile> = undefined;
  if (enclosingDeclaration !== undefined) {
    sourceFile = GetSourceFileOfNode(enclosingDeclaration);
  }
  let printer_: GoPtr<Printer>;
  // add neverAsciiEscape for GH#39027
  if (enclosingDeclaration !== undefined && enclosingDeclaration!.Kind === KindSourceFile) {
    printer_ = createPrinterWithRemoveCommentsNeverAsciiEscape(NodeBuilder_EmitContext(nodeBuilder));
  } else {
    printer_ = createPrinterWithRemoveComments(NodeBuilder_EmitContext(nodeBuilder));
  }

  let entity: GoPtr<Node>;
  if ((flags & SymbolFormatFlagsAllowAnyNodeKind) !== 0) {
    entity = NodeBuilder_SymbolToNode(nodeBuilder, symbol_, meaning, enclosingDeclaration, nodeFlags, internalNodeFlags, undefined); // TODO: GH#18217
  } else {
    entity = NodeBuilder_SymbolToEntityName(nodeBuilder, symbol_, meaning, enclosingDeclaration, nodeFlags, internalNodeFlags, undefined); // TODO: GH#18217
  }
  Printer_Write(printer_, entity, sourceFile, getTrailingSemicolonDeferringWriter(writer), undefined); // TODO: GH#18217
  const result = writer.String();
  putWriter();
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.signatureToString","kind":"method","status":"implemented","sigHash":"d67a57d1947553ff45216a0576ca04ae30f4a02c3a7bfa13780d9736ed9d0092","bodyHash":"a44e6c073cd2a8acc70f95ed4579216bc14fa933b46376713df901cb3b6a8e9f"}
 *
 * Go source:
 * func (c *Checker) signatureToString(signature *Signature) string {
 * 	return c.signatureToStringEx(signature, nil, TypeFormatFlagsNone, nil)
 * }
 */
export function Checker_signatureToString(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): string {
  return Checker_signatureToStringEx(receiver, signature, undefined, TypeFormatFlagsNone, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.SignatureToStringEx","kind":"method","status":"implemented","sigHash":"3d7fc99f392227c2404418dcf2899dca4920e57e961bef07ff50a3ec19da4d30","bodyHash":"3e20bbde20c5c48df27d1fec2782c89823a4a384f005fff221214fc74b817dae"}
 *
 * Go source:
 * func (c *Checker) SignatureToStringEx(signature *Signature, enclosingDeclaration *ast.Node, flags TypeFormatFlags, vc *VerbosityContext) string {
 * 	return c.signatureToStringEx(signature, enclosingDeclaration, flags, vc)
 * }
 */
export function Checker_SignatureToStringEx(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, enclosingDeclaration: GoPtr<Node>, flags: TypeFormatFlags, vc: GoPtr<VerbosityContext>): string {
  return Checker_signatureToStringEx(receiver, signature, enclosingDeclaration, flags, vc);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.signatureToStringEx","kind":"method","status":"implemented","sigHash":"1847ac6f0789b15f1ae1847f8507a7c4a5e885c63ee2fb4979e18e6b1db33726","bodyHash":"59a8bac89850f6808fe9fb19fe110d431ab859e2340514db56ecb0336eee0beb"}
 *
 * Go source:
 * func (c *Checker) signatureToStringEx(signature *Signature, enclosingDeclaration *ast.Node, flags TypeFormatFlags, vc *VerbosityContext) string {
 * 	isConstructor := signature.flags&SignatureFlagsConstruct != 0 && flags&TypeFormatFlagsWriteCallStyleSignature == 0
 * 	var sigOutput ast.Kind
 * 	if flags&TypeFormatFlagsWriteArrowStyleSignature != 0 {
 * 		if isConstructor {
 * 			sigOutput = ast.KindConstructorType
 * 		} else {
 * 			sigOutput = ast.KindFunctionType
 * 		}
 * 	} else {
 * 		if isConstructor {
 * 			sigOutput = ast.KindConstructSignature
 * 		} else {
 * 			sigOutput = ast.KindCallSignature
 * 		}
 * 	}
 * 
 * 	nodeBuilder := c.getNodeBuilder()
 * 	if vc != nil {
 * 		nodeBuilder.verbosity = vc
 * 	}
 * 	combinedFlags := toNodeBuilderFlags(flags) | nodebuilder.FlagsIgnoreErrors | nodebuilder.FlagsWriteTypeParametersInQualifiedName
 * 	sig := nodeBuilder.SignatureToSignatureDeclaration(signature, sigOutput, enclosingDeclaration, combinedFlags, nodebuilder.InternalFlagsNone, nil)
 * 	p := createPrinterWithRemoveCommentsOmitTrailingSemicolonNeverAsciiEscape(nodeBuilder.EmitContext())
 * 	var sourceFile *ast.SourceFile
 * 	if enclosingDeclaration != nil {
 * 		sourceFile = ast.GetSourceFileOfNode(enclosingDeclaration)
 * 	}
 * 	if flags&TypeFormatFlagsMultilineObjectLiterals != 0 {
 * 		writer := printer.NewTextWriter("\n", 0)
 * 		p.Write(sig, sourceFile, getTrailingSemicolonDeferringWriter(writer), nil)
 * 		return writer.String()
 * 	}
 * 	writer, putWriter := printer.GetSingleLineStringWriter()
 * 	defer putWriter()
 * 	p.Write(sig, sourceFile, getTrailingSemicolonDeferringWriter(writer), nil)
 * 	return writer.String()
 * }
 */
export function Checker_signatureToStringEx(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, enclosingDeclaration: GoPtr<Node>, flags: TypeFormatFlags, vc: GoPtr<VerbosityContext>): string {
  const isConstructor = (signature!.flags & SignatureFlagsConstruct) !== 0 && (flags & TypeFormatFlagsWriteCallStyleSignature) === 0;
  let sigOutput: Kind;
  if ((flags & TypeFormatFlagsWriteArrowStyleSignature) !== 0) {
    sigOutput = isConstructor ? KindConstructorType : KindFunctionType;
  } else {
    sigOutput = isConstructor ? KindConstructSignature : KindCallSignature;
  }

  const nodeBuilder = Checker_getNodeBuilder(receiver);
  if (vc !== undefined) {
    nodeBuilder!.verbosity = vc;
  }
  const combinedFlags = (toNodeBuilderFlags(flags) | FlagsIgnoreErrors | FlagsWriteTypeParametersInQualifiedName) >>> 0;
  const sig = NodeBuilder_SignatureToSignatureDeclaration(nodeBuilder, signature, sigOutput, enclosingDeclaration, combinedFlags, InternalFlagsNone, undefined);
  const p = createPrinterWithRemoveCommentsOmitTrailingSemicolonNeverAsciiEscape(NodeBuilder_EmitContext(nodeBuilder));
  let sourceFile: GoPtr<SourceFile> = undefined;
  if (enclosingDeclaration !== undefined) {
    sourceFile = GetSourceFileOfNode(enclosingDeclaration);
  }
  if ((flags & TypeFormatFlagsMultilineObjectLiterals) !== 0) {
    const writer = NewTextWriter("\n", 0);
    Printer_Write(p, sig, sourceFile, getTrailingSemicolonDeferringWriter(writer), undefined);
    return writer.String();
  }
  const [writer, putWriter] = GetSingleLineStringWriter();
  Printer_Write(p, sig, sourceFile, getTrailingSemicolonDeferringWriter(writer), undefined);
  const result = writer.String();
  putWriter();
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.typePredicateToString","kind":"method","status":"implemented","sigHash":"e2054984d35734e50e5a5a492e31f5e3c81dee2bd9c9a8478dc6ca1258a30b6b","bodyHash":"077f08a240d77b4a1fa96a4df4edb8073d61a43a28378840944420bfb43ad7ea"}
 *
 * Go source:
 * func (c *Checker) typePredicateToString(typePredicate *TypePredicate) string {
 * 	return c.typePredicateToStringEx(typePredicate, nil, TypeFormatFlagsUseAliasDefinedOutsideCurrentScope)
 * }
 */
export function Checker_typePredicateToString(receiver: GoPtr<Checker>, typePredicate: GoPtr<TypePredicate>): string {
  return Checker_typePredicateToStringEx(
    receiver,
    typePredicate,
    undefined,
    TypeFormatFlagsUseAliasDefinedOutsideCurrentScope,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.typePredicateToStringEx","kind":"method","status":"implemented","sigHash":"a105208e1418bf27198898f0e83ef9d845b7f085617bb553145450ca5b67d47a","bodyHash":"10382e649b6bfadfb55496bf7673ef3a8a6de0b049c85c25b11f1ea7dff0bd0f"}
 *
 * Go source:
 * func (c *Checker) typePredicateToStringEx(typePredicate *TypePredicate, enclosingDeclaration *ast.Node, flags TypeFormatFlags) string {
 * 	writer, putWriter := printer.GetSingleLineStringWriter()
 * 	defer putWriter()
 * 	nodeBuilder := c.getNodeBuilder()
 * 	combinedFlags := toNodeBuilderFlags(flags) | nodebuilder.FlagsIgnoreErrors | nodebuilder.FlagsWriteTypeParametersInQualifiedName
 * 	predicate := nodeBuilder.TypePredicateToTypePredicateNode(typePredicate, enclosingDeclaration, combinedFlags, nodebuilder.InternalFlagsNone, nil) // TODO: GH#18217
 * 	printer_ := createPrinterWithRemoveComments(nodeBuilder.EmitContext())
 * 	var sourceFile *ast.SourceFile
 * 	if enclosingDeclaration != nil {
 * 		sourceFile = ast.GetSourceFileOfNode(enclosingDeclaration)
 * 	}
 * 	printer_.Write(predicate /*sourceFile* /, sourceFile, writer, nil)
 * 	return writer.String()
 * }
 */
export function Checker_typePredicateToStringEx(receiver: GoPtr<Checker>, typePredicate: GoPtr<TypePredicate>, enclosingDeclaration: GoPtr<Node>, flags: TypeFormatFlags): string {
  const [writer, putWriter] = GetSingleLineStringWriter();
  const nodeBuilder = Checker_getNodeBuilder(receiver);
  const combinedFlags = (toNodeBuilderFlags(flags) | FlagsIgnoreErrors | FlagsWriteTypeParametersInQualifiedName) >>> 0;
  const predicate = NodeBuilder_TypePredicateToTypePredicateNode(nodeBuilder, typePredicate, enclosingDeclaration, combinedFlags, InternalFlagsNone, undefined); // TODO: GH#18217
  const printer_ = createPrinterWithRemoveComments(NodeBuilder_EmitContext(nodeBuilder));
  let sourceFile: GoPtr<SourceFile> = undefined;
  if (enclosingDeclaration !== undefined) {
    sourceFile = GetSourceFileOfNode(enclosingDeclaration);
  }
  Printer_Write(printer_, predicate, sourceFile, writer, undefined);
  const result = writer.String();
  putWriter();
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.valueToString","kind":"method","status":"implemented","sigHash":"68dfe5b34d04da7a39cbb0ff8deee94bcb1777d7b9d0c3cc022be3f2853bbfcb","bodyHash":"3bd792c76e3d31ee74432466094a156d03530a8d43de338c4bd3baa11df3f9b1"}
 *
 * Go source:
 * func (c *Checker) valueToString(value any) string {
 * 	return ValueToString(value)
 * }
 */
export function Checker_valueToString(receiver: GoPtr<Checker>, value: unknown): string {
  return ValueToString(value);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.formatUnionTypes","kind":"method","status":"implemented","sigHash":"a35bf869964e0e1302471ca053a5bf815ee8dd5621aa234719e61947c1d12e62","bodyHash":"cb3f6e35893d08364caaa2994944b74c3b333459e6e4af3720fb39dc88a4d260"}
 *
 * Go source:
 * func (c *Checker) formatUnionTypes(types []*Type, expandingEnum bool) []*Type {
 * 	var result []*Type
 * 	var flags TypeFlags
 * 	for i := 0; i < len(types); i++ {
 * 		t := types[i]
 * 		flags |= t.flags
 * 		if t.flags&TypeFlagsNullable == 0 {
 * 			if t.flags&TypeFlagsBooleanLiteral != 0 || (!expandingEnum && t.flags&TypeFlagsEnumLike != 0) {
 * 				var baseType *Type
 * 				if t.flags&TypeFlagsBooleanLiteral != 0 {
 * 					baseType = c.booleanType
 * 				} else {
 * 					baseType = c.getBaseTypeOfEnumLikeType(t)
 * 				}
 * 				if baseType.flags&TypeFlagsUnion != 0 {
 * 					count := len(baseType.AsUnionType().types)
 * 					if i+count <= len(types) && c.getRegularTypeOfLiteralType(types[i+count-1]) == c.getRegularTypeOfLiteralType(baseType.AsUnionType().types[count-1]) {
 * 						result = append(result, baseType)
 * 						i += count - 1
 * 						continue
 * 					}
 * 				}
 * 			}
 * 			result = append(result, t)
 * 		}
 * 	}
 * 	if flags&TypeFlagsNull != 0 {
 * 		result = append(result, c.nullType)
 * 	}
 * 	if flags&TypeFlagsUndefined != 0 {
 * 		result = append(result, c.undefinedType)
 * 	}
 * 	return result
 * }
 */
export function Checker_formatUnionTypes(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>, expandingEnum: bool): GoSlice<GoPtr<Type>> {
  const result: GoPtr<Type>[] = [];
  let flags: TypeFlags = 0;
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    flags = (flags | t!.flags) as TypeFlags;
    if ((t!.flags & TypeFlagsNullable) === 0) {
      if ((t!.flags & TypeFlagsBooleanLiteral) !== 0 || (!expandingEnum && (t!.flags & TypeFlagsEnumLike) !== 0)) {
        let baseType: GoPtr<Type>;
        if ((t!.flags & TypeFlagsBooleanLiteral) !== 0) {
          baseType = receiver!.booleanType;
        } else {
          baseType = Checker_getBaseTypeOfEnumLikeType(receiver, t);
        }
        if ((baseType!.flags & TypeFlagsUnion) !== 0) {
          const baseTypes = Type_Types(baseType)!;
          const count = baseTypes.length;
          if (
            i + count <= types.length &&
            Checker_getRegularTypeOfLiteralType(receiver, types[i + count - 1]) ===
              Checker_getRegularTypeOfLiteralType(receiver, baseTypes[count - 1])
          ) {
            result.push(baseType);
            i += count - 1;
            continue;
          }
        }
      }
      result.push(t);
    }
  }
  if ((flags & TypeFlagsNull) !== 0) {
    result.push(receiver!.nullType);
  }
  if ((flags & TypeFlagsUndefined) !== 0) {
    result.push(receiver!.undefinedType);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.TypeToTypeNode","kind":"method","status":"implemented","sigHash":"5578e0b4de78b8a94ab1e88dc6a2234f08f1f7898611a316a19bed63329da563","bodyHash":"9ab56ff1f7ecf7e1c4cb37158bd466d9fe2dcd5a41c4f5ef062b6b69c96feb43"}
 *
 * Go source:
 * func (c *Checker) TypeToTypeNode(t *Type, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, idToSymbol map[*ast.IdentifierNode]*ast.Symbol) *ast.TypeNode {
 * 	nodeBuilder := c.getNodeBuilderEx(idToSymbol)
 * 	return nodeBuilder.TypeToTypeNode(t, enclosingDeclaration, flags, nodebuilder.InternalFlagsNone, nil)
 * }
 */
export function Checker_TypeToTypeNode(receiver: GoPtr<Checker>, t: GoPtr<Type>, enclosingDeclaration: GoPtr<Node>, flags: Flags, idToSymbol: GoMap<GoPtr<IdentifierNode>, GoPtr<Symbol>>): GoPtr<TypeNode> {
  const nodeBuilder = Checker_getNodeBuilderEx(receiver, idToSymbol);
  return NodeBuilder_TypeToTypeNode(nodeBuilder, t, enclosingDeclaration, flags, InternalFlagsNone, undefined) as GoPtr<TypeNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.ExpandSymbolForHover","kind":"method","status":"implemented","sigHash":"75529e298e54666d4ca9b4b239701473f9850540d08e01fd74eada6bfae4667e","bodyHash":"26618e0966f5da204a4654dd9e26fbcd6a2c65c3f80136190e6661095a672893"}
 *
 * Go source:
 * func (c *Checker) ExpandSymbolForHover(symbol *ast.Symbol, meaning ast.SymbolFlags, vc *VerbosityContext) string {
 * 	nodeBuilder := c.getNodeBuilder()
 * 	nodeBuilder.verbosity = vc
 * 	nodes := nodeBuilder.ExpandSymbolForHover(symbol, meaning)
 * 	if len(nodes) == 0 {
 * 		return ""
 * 	}
 * 	p := createPrinterWithRemoveComments(nodeBuilder.EmitContext())
 * 	var sourceFile *ast.SourceFile
 * 	if symbol.ValueDeclaration != nil {
 * 		sourceFile = ast.GetSourceFileOfNode(symbol.ValueDeclaration)
 * 	}
 * 	var b strings.Builder
 * 	for i, node := range nodes {
 * 		if i > 0 {
 * 			b.WriteString("\n")
 * 		}
 * 		b.WriteString(p.Emit(node, sourceFile))
 * 	}
 * 	return b.String()
 * }
 */
export function Checker_ExpandSymbolForHover(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, meaning: SymbolFlags, vc: GoPtr<VerbosityContext>): string {
  const nodeBuilder = Checker_getNodeBuilder(receiver);
  nodeBuilder!.verbosity = vc;
  const nodes = NodeBuilder_ExpandSymbolForHover(nodeBuilder, symbol_, meaning);
  if (nodes.length === 0) {
    return "";
  }
  const p = createPrinterWithRemoveComments(NodeBuilder_EmitContext(nodeBuilder));
  let sourceFile: GoPtr<SourceFile> = undefined;
  if (symbol_!.ValueDeclaration !== undefined) {
    sourceFile = GetSourceFileOfNode(symbol_!.ValueDeclaration);
  }
  let b = "";
  for (let i = 0; i < nodes.length; i++) {
    if (i > 0) {
      b += "\n";
    }
    b += Printer_Emit(p, nodes[i], sourceFile);
  }
  return b;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.TypeParameterToStringEx","kind":"method","status":"implemented","sigHash":"c8c226b537af1260d08bfd906d86ed141afe0aa1170be56b1d14df0824210ff7","bodyHash":"fa5a686c2dffaca91697022afee90614f209bc390a60f5b9cdad8d3782e4fb6c"}
 *
 * Go source:
 * func (c *Checker) TypeParameterToStringEx(t *Type, enclosingDeclaration *ast.Node, vc *VerbosityContext) string {
 * 	nodeBuilder := c.getNodeBuilder()
 * 	nodeBuilder.verbosity = vc
 * 	typeParamNode := nodeBuilder.TypeParameterToDeclaration(t, enclosingDeclaration, nodebuilder.FlagsIgnoreErrors, nodebuilder.InternalFlagsNone, nil)
 * 	if typeParamNode == nil {
 * 		return c.TypeToString(t)
 * 	}
 * 	p := createPrinterWithRemoveComments(nodeBuilder.EmitContext())
 * 	var sourceFile *ast.SourceFile
 * 	if enclosingDeclaration != nil {
 * 		sourceFile = ast.GetSourceFileOfNode(enclosingDeclaration)
 * 	}
 * 	return p.Emit(typeParamNode, sourceFile)
 * }
 */
export function Checker_TypeParameterToStringEx(receiver: GoPtr<Checker>, t: GoPtr<Type>, enclosingDeclaration: GoPtr<Node>, vc: GoPtr<VerbosityContext>): string {
  const nodeBuilder = Checker_getNodeBuilder(receiver);
  nodeBuilder!.verbosity = vc;
  const typeParamNode = NodeBuilder_TypeParameterToDeclaration(nodeBuilder, t, enclosingDeclaration, FlagsIgnoreErrors, InternalFlagsNone, undefined);
  if (typeParamNode === undefined) {
    return Checker_TypeToString(receiver, t);
  }
  const p = createPrinterWithRemoveComments(NodeBuilder_EmitContext(nodeBuilder));
  let sourceFile: GoPtr<SourceFile> = undefined;
  if (enclosingDeclaration !== undefined) {
    sourceFile = GetSourceFileOfNode(enclosingDeclaration);
  }
  return Printer_Emit(p, typeParamNode, sourceFile);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.TypeToTypeNodeEx","kind":"method","status":"implemented","sigHash":"6762c56c158f38000e5082405cdf1920d21200d4bca67c67ff16e07c4d7f1d5e","bodyHash":"4380f5a1c5b11612e59130e1a8ea12b0f20555c143f4960d859c1b0ef53453d3"}
 *
 * Go source:
 * func (c *Checker) TypeToTypeNodeEx(t *Type, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, idToSymbol map[*ast.IdentifierNode]*ast.Symbol) *ast.TypeNode {
 * 	nodeBuilder := c.getNodeBuilderEx(idToSymbol)
 * 	return nodeBuilder.TypeToTypeNode(t, enclosingDeclaration, flags, internalFlags, nil)
 * }
 */
export function Checker_TypeToTypeNodeEx(receiver: GoPtr<Checker>, t: GoPtr<Type>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, idToSymbol: GoMap<GoPtr<IdentifierNode>, GoPtr<Symbol>>): GoPtr<TypeNode> {
  const nodeBuilder = Checker_getNodeBuilderEx(receiver, idToSymbol);
  return NodeBuilder_TypeToTypeNode(nodeBuilder, t, enclosingDeclaration, flags, internalFlags, undefined) as GoPtr<TypeNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/printer.go::method::Checker.TypePredicateToTypePredicateNode","kind":"method","status":"implemented","sigHash":"854a133b25e03725f4ec44d1364fac5e53331efd51745285fe92bd2e9802dfa6","bodyHash":"8b9a23d7a8ed3b3ace2ca824a60cb50de30b5638ab74903b6d69d1afd400fd9b"}
 *
 * Go source:
 * func (c *Checker) TypePredicateToTypePredicateNode(t *TypePredicate, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, idToSymbol map[*ast.IdentifierNode]*ast.Symbol) *ast.TypePredicateNodeNode {
 * 	nodeBuilder := c.getNodeBuilderEx(idToSymbol)
 * 	return nodeBuilder.TypePredicateToTypePredicateNode(t, enclosingDeclaration, flags, nodebuilder.InternalFlagsNone, nil)
 * }
 */
export function Checker_TypePredicateToTypePredicateNode(receiver: GoPtr<Checker>, t: GoPtr<TypePredicate>, enclosingDeclaration: GoPtr<Node>, flags: Flags, idToSymbol: GoMap<GoPtr<IdentifierNode>, GoPtr<Symbol>>): GoPtr<TypePredicateNodeNode> {
  const nodeBuilder = Checker_getNodeBuilderEx(receiver, idToSymbol);
  return NodeBuilder_TypePredicateToTypePredicateNode(nodeBuilder, t, enclosingDeclaration, flags, InternalFlagsNone, undefined) as GoPtr<TypePredicateNodeNode>;
}
