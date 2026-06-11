import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";
import type { Symbol } from "../ast/symbol.js";
import type { UTF16Offset } from "../core/core.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emittextwriter.go::type::EmitTextWriter","kind":"type","status":"implemented","sigHash":"e60d200b49433cda0c2093cde1749e3c969fb07be990c2aecf3f32eb48d9c0ef","bodyHash":"e5bb7b56ed83c931445ccd2de855d12d53ba0a02494302c79f28ca34916cb112"}
 *
 * Go source:
 * EmitTextWriter interface {
 * 	Write(s string)
 * 	WriteTrailingSemicolon(text string)
 * 	WriteComment(text string)
 * 	WriteKeyword(text string)
 * 	WriteOperator(text string)
 * 	WritePunctuation(text string)
 * 	WriteSpace(text string)
 * 	WriteStringLiteral(text string)
 * 	WriteParameter(text string)
 * 	WriteProperty(text string)
 * 	WriteSymbol(text string, symbol *ast.Symbol)
 * 	WriteLine()
 * 	WriteLineForce(force bool)
 * 	IncreaseIndent()
 * 	DecreaseIndent()
 * 	Clear()
 * 	String() string
 * 	RawWrite(s string)
 * 	WriteLiteral(s string)
 * 	GetTextPos() int
 * 	GetLine() int
 * 	GetColumn() core.UTF16Offset
 * 	GetIndent() int
 * 	IsAtStartOfLine() bool
 * 	HasTrailingComment() bool
 * 	HasTrailingWhitespace() bool
 * }
 */
export interface EmitTextWriter {
  Write(s: string): void;
  WriteTrailingSemicolon(text: string): void;
  WriteComment(text: string): void;
  WriteKeyword(text: string): void;
  WriteOperator(text: string): void;
  WritePunctuation(text: string): void;
  WriteSpace(text: string): void;
  WriteStringLiteral(text: string): void;
  WriteParameter(text: string): void;
  WriteProperty(text: string): void;
  WriteSymbol(text: string, symbol_: GoPtr<Symbol>): void;
  WriteLine(): void;
  WriteLineForce(force: bool): void;
  IncreaseIndent(): void;
  DecreaseIndent(): void;
  Clear(): void;
  String(): string;
  RawWrite(s: string): void;
  WriteLiteral(s: string): void;
  GetTextPos(): int;
  GetLine(): int;
  GetColumn(): UTF16Offset;
  GetIndent(): int;
  IsAtStartOfLine(): bool;
  HasTrailingComment(): bool;
  HasTrailingWhitespace(): bool;
}
