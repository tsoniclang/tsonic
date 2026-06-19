import type { bool, int } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoRune, GoSlice } from "../../go/compat.js";
import { FormatUint } from "../../go/strconv.js";
import { Builder, ToUpper } from "../../go/strings.js";
import { DecodeRuneInString, DecodeRuneInStringAt, RuneError, StringByteLen, StringByteSlice, StringUtf8Bytes } from "../../go/unicode/utf8.js";
import type { CommentRange, SourceFile, SourceFileLike } from "../ast/ast.js";
import { SourceFile_Text, SourceFile_ECMALineMap, AsSourceFile } from "../ast/ast.js";
import type { Node, NodeList } from "../ast/spine.js";
import type { Kind } from "../ast/generated/kinds.js";
import {
  KindClassDeclaration,
  KindClassExpression,
  KindGetAccessor,
  KindMethodDeclaration,
  KindParameter,
  KindPropertyDeclaration,
  KindSetAccessor,
  KindAmpersandAmpersandToken,
  KindBarBarToken,
  KindQuestionQuestionToken,
  KindParenthesizedExpression,
  KindBinaryExpression,
  KindNewExpression,
  KindSingleLineCommentTrivia,
  KindMultiLineCommentTrivia,
  KindBigIntLiteral,
  KindNoSubstitutionTemplateLiteral,
  KindTemplateHead,
  KindTemplateMiddle,
  KindTemplateTail,
  KindStringLiteral,
  KindNumericLiteral,
  KindRegularExpressionLiteral,
  KindTypeParameter,
  KindTemplateLiteralTypeSpan,
  KindTemplateSpan,
  KindDecorator,
  KindHeritageClause,
  KindTypeLiteral,
  KindInterfaceDeclaration,
  KindUnionType,
  KindIntersectionType,
  KindArrayLiteralExpression,
  KindTupleType,
  KindNamedImports,
  KindNamedExports,
  KindObjectLiteralExpression,
  KindJsxAttributes,
  KindCallExpression,
  KindJsxElement,
  KindJsxFragment,
  KindJsxOpeningElement,
  KindJsxSelfClosingElement,
  KindBlock,
  KindModuleBlock,
  KindCaseClause,
  KindDefaultClause,
  KindCaseBlock,
  KindEnumDeclaration,
  KindSourceFile,
} from "../ast/generated/kinds.js";
import {
  IsCallExpression,
  IsArrowFunction,
  IsFunctionExpression,
  IsInterfaceDeclaration,
  IsEnumMember,
  IsInferTypeNode,
} from "../ast/generated/predicates.js";
import {
  AsBinaryExpression,
  AsCaseBlock,
  AsCallExpression,
  AsNewExpression,
  AsUnionTypeNode,
  AsIntersectionTypeNode,
  AsTemplateExpression,
  AsTemplateLiteralTypeNode,
  AsInterfaceDeclaration,
  AsStringLiteral,
  AsNumericLiteral,
  AsNoSubstitutionTemplateLiteral,
  AsTemplateHead,
  AsTemplateMiddle,
  AsTemplateTail,
} from "../ast/generated/casts.js";
import {
  IsPrologueDirective,
  PositionIsSynthesized,
  NodeIsSynthesized,
  SkipPartiallyEmittedExpressions,
  IsFunctionLike,
  IsClassLike,
  IsClassElement,
  IsTypeElement,
  IsJsxChild,
  IsStatement,
  IsTypeNode,
  IsModifier,
  IsUnterminatedLiteral,
  IsFunctionExpressionOrArrowFunction,
} from "../ast/utilities.js";
import { IsTypeOrJSTypeAliasDeclaration } from "../ast/ast.js";
import { Node_Expression, Node_ArgumentList, Node_TypeParameterList, Node_MemberList, Node_StatementList, Node_TypeArgumentList, Node_ElementList, Node_PropertyList, Node_Children, Node_Text, Node_RawText } from "../ast/ast.js";
import { Node_Pos, Node_End, NodeList_End, Node_ClassLikeData, Node_FunctionLikeData, Node_Modifiers } from "../ast/spine.js";
import type { Expression, LiteralLikeNode, SourceFileNode } from "../ast/generated/unions.js";
import { UTF16Len, IfElse } from "../core/core.js";
import type { UTF16Offset } from "../core/core.js";
import type { TextPos } from "../core/text.js";
import { TextRange_Pos, TextRange_End } from "../core/text.js";
import type { TextRange } from "../core/text.js";
import { ComputeLineOfPosition, GetECMALineStarts, SkipTriviaEx } from "../scanner/scanner.js";
import type { SkipTriviaOptions } from "../scanner/scanner.js";
import { GetSourceTextOfNodeFromSourceFile } from "../scanner/utilities.js";
import type { Source } from "../sourcemap/source.js";
import { IsASCIILetter, IsDigit, IsWhiteSpaceSingleLine, IsWhiteSpaceLike, DecodeJSStringRune } from "../stringutil/util.js";
import { GetBaseFileName } from "../tspath/path.js";
import type { EmitContext } from "./emitcontext.js";
import { EmitContext_MostOriginal } from "./emitcontext.js";
import { GetDefaultIndentSize } from "./textwriter.js";
import { TokenFlagsIsInvalid, TokenFlagsContainsSeparator, TokenFlagsSingleQuote } from "../ast/tokenflags.js";

export const byteLen = StringByteLen;
export const byteSlice = StringByteSlice;
const decodeRuneInStringAt = DecodeRuneInStringAt;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::type::getLiteralTextFlags","kind":"type","status":"implemented","sigHash":"dd5ef391e67032e911741fa2b5a893b18cdeda34ef28edcdc7be3ee3f98a83ee","bodyHash":"fd241e9091d827869df9118dcbbf9c87f924afcc23e8bb011f1f273eadc26aa7"}
 *
 * Go source:
 * getLiteralTextFlags int
 */
export type getLiteralTextFlags = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::constGroup::getLiteralTextFlagsNone+getLiteralTextFlagsNeverAsciiEscape+getLiteralTextFlagsJsxAttributeEscape+getLiteralTextFlagsTerminateUnterminatedLiterals+getLiteralTextFlagsAllowNumericSeparator","kind":"constGroup","status":"implemented","sigHash":"159c57af9b4fb76cf394a9ff05a9c2fe39907fab3c9392f26d4141936b4f3f7c","bodyHash":"955d9e5376bfc7d04d11345d50383649db63687cf9d66295d78958787d382207"}
 *
 * Go source:
 * const (
 * 	getLiteralTextFlagsNone                          getLiteralTextFlags = 0
 * 	getLiteralTextFlagsNeverAsciiEscape              getLiteralTextFlags = 1 << 0
 * 	getLiteralTextFlagsJsxAttributeEscape            getLiteralTextFlags = 1 << 1
 * 	getLiteralTextFlagsTerminateUnterminatedLiterals getLiteralTextFlags = 1 << 2
 * 	getLiteralTextFlagsAllowNumericSeparator         getLiteralTextFlags = 1 << 3
 * )
 */
export const getLiteralTextFlagsNone: getLiteralTextFlags = 0;
export const getLiteralTextFlagsNeverAsciiEscape: getLiteralTextFlags = 1 << 0;
export const getLiteralTextFlagsJsxAttributeEscape: getLiteralTextFlags = 1 << 1;
export const getLiteralTextFlagsTerminateUnterminatedLiterals: getLiteralTextFlags = 1 << 2;
export const getLiteralTextFlagsAllowNumericSeparator: getLiteralTextFlags = 1 << 3;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::type::QuoteChar","kind":"type","status":"implemented","sigHash":"f7429f2bb13619055d667a61bea5a72a80aed51a0c2b5cd77a5696a380f2fa5e","bodyHash":"14e60fd039b02997ad0f16ca5ab7fb7ed8753a7519c6cf0a680d2a64b63e1c80"}
 *
 * Go source:
 * QuoteChar rune
 */
export type QuoteChar = GoRune;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::constGroup::QuoteCharSingleQuote+QuoteCharDoubleQuote+QuoteCharBacktick","kind":"constGroup","status":"implemented","sigHash":"ccb54a9db37196fc86c271c06a7657b69a6e7bd437ad9d360b9efff86d10a965","bodyHash":"b9f7014e51a1cdae5cbfc2ea50b488de6eb402604897767a428a965265e92d05"}
 *
 * Go source:
 * const (
 * 	QuoteCharSingleQuote QuoteChar = '\''
 * 	QuoteCharDoubleQuote QuoteChar = '"'
 * 	QuoteCharBacktick    QuoteChar = '`'
 * )
 */
export const QuoteCharSingleQuote: QuoteChar = 0x27; // '\''
export const QuoteCharDoubleQuote: QuoteChar = 0x22; // '"'
export const QuoteCharBacktick: QuoteChar = 0x60; // '`'

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::varGroup::jsxEscapedCharsMap","kind":"varGroup","status":"implemented","sigHash":"62dc9b5888913cc630fc4ac903c60e93ede3ccc04027877331039c3b9968adc7","bodyHash":"99bf56ced84e07bc54148d0100c6e15b8afc31a74bca5815e27e32780b8e3c45"}
 *
 * Go source:
 * var jsxEscapedCharsMap = map[rune]string{
 * 	'"':  "&quot;",
 * 	'\'': "&apos;",
 * }
 */
export const jsxEscapedCharsMap: GoMap<GoRune, string> = new globalThis.Map<GoRune, string>([
  [0x22 /* '"' */, "&quot;"],
  [0x27 /* '\'' */, "&apos;"],
]);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::varGroup::escapedCharsMap","kind":"varGroup","status":"implemented","sigHash":"ae486ec67093ca226af539dc9b1aeec0fcfc32885c9226cc17a66893169c9cbc","bodyHash":"d8ccf53d09958a879ce59117626b040669db567f2a4d1fba5d0baf9d8eb934b7"}
 *
 * Go source:
 * var escapedCharsMap = map[rune]string{
 * 	'\t':     `\t`,
 * 	'\v':     `\v`,
 * 	'\f':     `\f`,
 * 	'\b':     `\b`,
 * 	'\r':     `\r`,
 * 	'\n':     `\n`,
 * 	'\\':     `\\`,
 * 	'"':      `\"`,
 * 	'\'':     `\'`,
 * 	'`':      "\\`",
 * 	'$':      `\$`,     // when quoteChar == '`'
 * 	'\u2028': `\u2028`, // lineSeparator
 * 	'\u2029': `\u2029`, // paragraphSeparator
 * 	'\u0085': `\u0085`, // nextLine
 * }
 */
export const escapedCharsMap: GoMap<GoRune, string> = new globalThis.Map<GoRune, string>([
  [0x09 /* '\t' */, "\\t"],
  [0x0b /* '\v' */, "\\v"],
  [0x0c /* '\f' */, "\\f"],
  [0x08 /* '\b' */, "\\b"],
  [0x0d /* '\r' */, "\\r"],
  [0x0a /* '\n' */, "\\n"],
  [0x5c /* '\\' */, "\\\\"],
  [0x22 /* '"' */, "\\\""],
  [0x27 /* '\'' */, "\\'"],
  [0x60 /* '`' */, "\\`"],
  [0x24 /* '$' */, "\\$"], // when quoteChar == '`'
  [0x2028 /* '\u2028' */, "\\u2028"], // lineSeparator
  [0x2029 /* '\u2029' */, "\\u2029"], // paragraphSeparator
  [0x0085 /* '\u0085' */, "\\u0085"], // nextLine
]);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::encodeJsxCharacterEntity","kind":"func","status":"implemented","sigHash":"468d0fa3b5fa953994065a54dd8458f61a3a8b6af26f960214b496f237862eeb","bodyHash":"486ecede4cce3b89e379b1bba0cfcd01d5915192467cd3405c14ee386f5289f6"}
 *
 * Go source:
 * func encodeJsxCharacterEntity(b *strings.Builder, charCode rune) {
 * 	hexCharCode := strings.ToUpper(strconv.FormatUint(uint64(charCode), 16))
 * 	b.WriteString("&#x")
 * 	b.WriteString(hexCharCode)
 * 	b.WriteByte(';')
 * }
 */
export function encodeJsxCharacterEntity(b: GoPtr<Builder>, charCode: GoRune): void {
  const hexCharCode = ToUpper(FormatUint(charCode, 16));
  b!.WriteString("&#x");
  b!.WriteString(hexCharCode);
  b!.WriteByte(0x3b /* ';' */);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::encodeUtf16EscapeSequence","kind":"func","status":"implemented","sigHash":"6b444f96c51332915cdde7d4fbdeacf1bfd18ecda76add5117b55771c29d1045","bodyHash":"a38636f566c880bf35830e70689b392827be0e5870276664cf23818e5865e9e7"}
 *
 * Go source:
 * func encodeUtf16EscapeSequence(b *strings.Builder, charCode rune) {
 * 	hexCharCode := strings.ToUpper(strconv.FormatUint(uint64(charCode), 16))
 * 	b.WriteString(`\u`)
 * 	for i := len(hexCharCode); i < 4; i++ {
 * 		b.WriteByte('0')
 * 	}
 * 	b.WriteString(hexCharCode)
 * }
 */
export function encodeUtf16EscapeSequence(b: GoPtr<Builder>, charCode: GoRune): void {
  const hexCharCode = ToUpper(FormatUint(charCode, 16));
  b!.WriteString("\\u");
  for (let i = byteLen(hexCharCode); i < 4; i++) {
    b!.WriteByte(0x30 /* '0' */);
  }
  b!.WriteString(hexCharCode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::escapeStringWorker","kind":"func","status":"implemented","sigHash":"eb2b5c4a2b880d584c5ce2b0dde3e2aea9fe3514277db53d2c3a9b0bec5c0d15","bodyHash":"3da67c067821ee936714667696238b8a1a40d0c5ef8f221a3503f7eb74a883e6"}
 *
 * Go source:
 * func escapeStringWorker(s string, quoteChar QuoteChar, flags getLiteralTextFlags, b *strings.Builder) {
 * 	pos := 0
 * 	i := 0
 * 	for i < len(s) {
 * 		ch, size := stringutil.DecodeJSStringRune(s[i:])
 *
 * 		escape := false
 * 		if ch >= 0xD800 && ch <= 0xDFFF {
 * 			escape = true
 * 		} else if ch == utf8.RuneError && size == 1 {
 * 			// A stray byte that is not valid UTF-8 (for example, a fragment of a
 * 			// surrogate sentinel left behind by code that sliced the string by
 * 			// byte). Escape it as the Unicode replacement character so the output
 * 			// is always well-formed rather than containing raw invalid bytes.
 * 			escape = true
 * 		}
 *
 * 		// This consists of the first 19 unprintable ASCII characters, canonical escapes, lineSeparator,
 * 		// paragraphSeparator, and nextLine. The latter three are just desirable to suppress new lines in
 * 		// the language service. These characters should be escaped when printing, and if any characters are added,
 * 		// `escapedCharsMap` and/or `jsxEscapedCharsMap` must be updated. Note that this *does not* include the 'delete'
 * 		// character. There is no reason for this other than that JSON.stringify does not handle it either.
 * 		switch ch {
 * 		case '\\':
 * 			if flags&getLiteralTextFlagsJsxAttributeEscape == 0 {
 * 				escape = true
 * 			}
 * 		case '$':
 * 			if quoteChar == QuoteCharBacktick && i+1 < len(s) && s[i+1] == '{' {
 * 				escape = true
 * 			}
 * 		case rune(quoteChar), '\u2028', '\u2029', '\u0085', '\r':
 * 			escape = true
 * 		case '\n':
 * 			if quoteChar != QuoteCharBacktick {
 * 				// Template strings preserve simple LF newlines, still encode CRLF (or CR).
 * 				escape = true
 * 			}
 * 		default:
 * 			if ch <= '\u001f' || flags&getLiteralTextFlagsNeverAsciiEscape == 0 && ch > '\u007f' {
 * 				escape = true
 * 			}
 * 		}
 * 
 * 		if escape {
 * 			if pos < i {
 * 				// Write string up to this point
 * 				b.WriteString(s[pos:i])
 * 			}
 * 
 * 			switch {
 * 			case flags&getLiteralTextFlagsJsxAttributeEscape != 0:
 * 				if ch == 0 {
 * 					b.WriteString("&#0;")
 * 				} else if match, ok := jsxEscapedCharsMap[ch]; ok {
 * 					b.WriteString(match)
 * 				} else {
 * 					encodeJsxCharacterEntity(b, ch)
 * 				}
 * 
 * 			default:
 * 				if ch == '\r' && quoteChar == QuoteCharBacktick && i+1 < len(s) && s[i+1] == '\n' {
 * 					// Template strings preserve simple LF newlines, but still must escape CRLF. Left alone, the
 * 					// above cases for `\r` and `\n` would inadvertently escape CRLF as two independent characters.
 * 					size++
 * 					b.WriteString(`\r\n`)
 * 				} else if ch > 0xffff {
 * 					// encode as surrogate pair
 * 					ch -= 0x10000
 * 					encodeUtf16EscapeSequence(b, (ch&0b11111111110000000000>>10)+0xD800)
 * 					encodeUtf16EscapeSequence(b, (ch&0b00000000001111111111)+0xDC00)
 * 				} else if ch >= 0xD800 && ch <= 0xDFFF {
 * 					encodeUtf16EscapeSequence(b, ch)
 * 				} else if ch == 0 {
 * 					if i+1 < len(s) && stringutil.IsDigit(rune(s[i+1])) {
 * 						// If the null character is followed by digits, print as a hex escape to prevent the result from
 * 						// parsing as an octal (which is forbidden in strict mode)
 * 						b.WriteString(`\x00`)
 * 					} else {
 * 						// Otherwise, keep printing a literal \0 for the null character
 * 						b.WriteString(`\0`)
 * 					}
 * 				} else {
 * 					if match, ok := escapedCharsMap[ch]; ok {
 * 						b.WriteString(match)
 * 					} else {
 * 						encodeUtf16EscapeSequence(b, ch)
 * 					}
 * 				}
 * 			}
 * 			pos = i + size
 * 		}
 * 
 * 		i += size
 * 	}
 * 
 * 	if pos < i {
 * 		b.WriteString(s[pos:])
 * 	}
 * }
 */
export function escapeStringWorker(s: string, quoteChar: QuoteChar, flags: getLiteralTextFlags, b: GoPtr<Builder>): void {
  const sBytes = StringUtf8Bytes(s);
  const sLen = sBytes.length;
  let pos = 0;
  let i = 0;
  while (i < sLen) {
    let [ch, size] = DecodeJSStringRune(byteSlice(s, i));

    let escape = false;
    if (ch >= 0xd800 && ch <= 0xdfff) {
      escape = true;
    } else if (ch === RuneError && size === 1) {
      // A stray byte that is not valid UTF-8 (for example, a fragment of a
      // surrogate sentinel left behind by code that sliced the string by
      // byte). Escape it as the Unicode replacement character so the output
      // is always well-formed rather than containing raw invalid bytes.
      escape = true;
    }

    // This consists of the first 19 unprintable ASCII characters, canonical escapes, lineSeparator,
    // paragraphSeparator, and nextLine. The latter three are just desirable to suppress new lines in
    // the language service. These characters should be escaped when printing, and if any characters are added,
    // `escapedCharsMap` and/or `jsxEscapedCharsMap` must be updated. Note that this *does not* include the 'delete'
    // character. There is no reason for this other than that JSON.stringify does not handle it either.
    switch (ch) {
      case 0x5c /* '\\' */:
        if ((flags & getLiteralTextFlagsJsxAttributeEscape) === 0) {
          escape = true;
        }
        break;
      case 0x24 /* '$' */:
        if (quoteChar === QuoteCharBacktick && i + 1 < sLen && sBytes[i + 1] === 0x7b /* '{' */) {
          escape = true;
        }
        break;
      case quoteChar:
      case 0x2028 /* ' ' */:
      case 0x2029 /* ' ' */:
      case 0x0085 /* '' */:
      case 0x0d /* '\r' */:
        escape = true;
        break;
      case 0x0a /* '\n' */:
        if (quoteChar !== QuoteCharBacktick) {
          // Template strings preserve simple LF newlines, still encode CRLF (or CR).
          escape = true;
        }
        break;
      default:
        if (ch <= 0x1f || ((flags & getLiteralTextFlagsNeverAsciiEscape) === 0 && ch > 0x7f)) {
          escape = true;
        }
        break;
    }

    if (escape) {
      if (pos < i) {
        // Write string up to this point
        b!.WriteString(byteSlice(s, pos, i));
      }

      if ((flags & getLiteralTextFlagsJsxAttributeEscape) !== 0) {
        if (ch === 0) {
          b!.WriteString("&#0;");
        } else {
          const match = jsxEscapedCharsMap.get(ch);
          if (match !== undefined) {
            b!.WriteString(match);
          } else {
            encodeJsxCharacterEntity(b, ch);
          }
        }
      } else {
        if (ch === 0x0d /* '\r' */ && quoteChar === QuoteCharBacktick && i + 1 < sLen && sBytes[i + 1] === 0x0a /* '\n' */) {
          // Template strings preserve simple LF newlines, but still must escape CRLF. Left alone, the
          // above cases for `\r` and `\n` would inadvertently escape CRLF as two independent characters.
          size++;
          b!.WriteString("\\r\\n");
        } else if (ch > 0xffff) {
          // encode as surrogate pair
          ch -= 0x10000;
          encodeUtf16EscapeSequence(b, ((ch & 0b11111111110000000000) >> 10) + 0xd800);
          encodeUtf16EscapeSequence(b, (ch & 0b00000000001111111111) + 0xdc00);
        } else if (ch >= 0xd800 && ch <= 0xdfff) {
          encodeUtf16EscapeSequence(b, ch);
        } else if (ch === 0) {
          if (i + 1 < sLen && IsDigit(sBytes[i + 1]!)) {
            // If the null character is followed by digits, print as a hex escape to prevent the result from
            // parsing as an octal (which is forbidden in strict mode)
            b!.WriteString("\\x00");
          } else {
            // Otherwise, keep printing a literal \0 for the null character
            b!.WriteString("\\0");
          }
        } else {
          const match = escapedCharsMap.get(ch);
          if (match !== undefined) {
            b!.WriteString(match);
          } else {
            encodeUtf16EscapeSequence(b, ch);
          }
        }
      }
      pos = i + size;
    }

    i += size;
  }

  if (pos < i) {
    b!.WriteString(byteSlice(s, pos));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::EscapeString","kind":"func","status":"implemented","sigHash":"72638e9cc2cce5cbe4de6199b987c9a60e0ee5941b672d1ec1c6b512a07f66cd","bodyHash":"91e78e092049269a11ddc55d04e298ca4a822d597122e01b6a122fe746c32d36"}
 *
 * Go source:
 * func EscapeString(s string, quoteChar QuoteChar) string {
 * 	var b strings.Builder
 * 	b.Grow(len(s) + 2)
 * 	escapeStringWorker(s, quoteChar, getLiteralTextFlagsNeverAsciiEscape, &b)
 * 	return b.String()
 * }
 */
export function EscapeString(s: string, quoteChar: QuoteChar): string {
  const b = new Builder();
  b.Grow(byteLen(s) + 2);
  escapeStringWorker(s, quoteChar, getLiteralTextFlagsNeverAsciiEscape, b);
  return b.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::escapeNonAsciiString","kind":"func","status":"implemented","sigHash":"c8e2d50b2168397ae6127a88fc929cd4f7fed6485bf93ca472584076ad1cf70a","bodyHash":"09b3d8d1fb953fffacf001fcc513ecfad86417faba0c0e69dda093ce340fbd66"}
 *
 * Go source:
 * func escapeNonAsciiString(s string, quoteChar QuoteChar) string {
 * 	var b strings.Builder
 * 	b.Grow(len(s) + 2)
 * 	escapeStringWorker(s, quoteChar, getLiteralTextFlagsNone, &b)
 * 	return b.String()
 * }
 */
export function escapeNonAsciiString(s: string, quoteChar: QuoteChar): string {
  const b = new Builder();
  b.Grow(byteLen(s) + 2);
  escapeStringWorker(s, quoteChar, getLiteralTextFlagsNone, b);
  return b.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::escapeJsxAttributeString","kind":"func","status":"implemented","sigHash":"9efabdf930fbc199d6fe5c763a3c7106fd3f93bee80c35a64ecd96213a620a3b","bodyHash":"889bbe73d96d9620290e20cbc39eb462a7cbfb6a2abdb0ca1df56f8df772a8c5"}
 *
 * Go source:
 * func escapeJsxAttributeString(s string, quoteChar QuoteChar) string {
 * 	var b strings.Builder
 * 	b.Grow(len(s) + 2)
 * 	escapeStringWorker(s, quoteChar, getLiteralTextFlagsJsxAttributeEscape|getLiteralTextFlagsNeverAsciiEscape, &b)
 * 	return b.String()
 * }
 */
export function escapeJsxAttributeString(s: string, quoteChar: QuoteChar): string {
  const b = new Builder();
  b.Grow(byteLen(s) + 2);
  escapeStringWorker(s, quoteChar, getLiteralTextFlagsJsxAttributeEscape | getLiteralTextFlagsNeverAsciiEscape, b);
  return b.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::canUseOriginalText","kind":"func","status":"implemented","sigHash":"bc91b05b7aaa1a85db354109acc35beace7e2d0a9086c088f1b6d151435e36c2","bodyHash":"439b0f856244743bbdfa69eed16faa60dc33493689ab68743ec2ee957003fc11"}
 *
 * Go source:
 * func canUseOriginalText(node *ast.LiteralLikeNode, flags getLiteralTextFlags) bool {
 * 	// A synthetic node has no original text, nor does a node without a parent as we would be unable to find the
 * 	// containing SourceFile. We also cannot use the original text if the literal was unterminated and the caller has
 * 	// requested proper termination of unterminated literals
 * 	if ast.NodeIsSynthesized(node) || node.Parent == nil || flags&getLiteralTextFlagsTerminateUnterminatedLiterals != 0 && ast.IsUnterminatedLiteral(node) {
 * 		return false
 * 	}
 * 
 * 	if node.Kind == ast.KindNumericLiteral {
 * 		tokenFlags := node.AsNumericLiteral().TokenFlags
 * 		// For a numeric literal, we cannot use the original text if the original text was an invalid literal
 * 		if tokenFlags&ast.TokenFlagsIsInvalid != 0 {
 * 			return false
 * 		}
 * 		// We also cannot use the original text if the literal contains numeric separators, but numeric separators
 * 		// are not permitted
 * 		if tokenFlags&ast.TokenFlagsContainsSeparator != 0 {
 * 			return flags&getLiteralTextFlagsAllowNumericSeparator != 0
 * 		}
 * 	}
 * 
 * 	// Finally, we do not use the original text of a BigInt literal
 * 	// TODO(rbuckton): The reason as to why we do not use the original text for bigints is not mentioned in the
 * 	// original compiler source. It could be that this is no longer necessary, in which case bigint literals should
 * 	// use the same code path as numeric literals, above
 * 	return node.Kind != ast.KindBigIntLiteral
 * }
 */
export function canUseOriginalText(node: GoPtr<LiteralLikeNode>, flags: getLiteralTextFlags): bool {
  // A synthetic node has no original text, nor does a node without a parent as we would be unable to find the
  // containing SourceFile. We also cannot use the original text if the literal was unterminated and the caller has
  // requested proper termination of unterminated literals
  if (NodeIsSynthesized(node) || node!.Parent === undefined || ((flags & getLiteralTextFlagsTerminateUnterminatedLiterals) !== 0 && IsUnterminatedLiteral(node))) {
    return false;
  }

  if (node!.Kind === KindNumericLiteral) {
    const tokenFlags = AsNumericLiteral(node)!.TokenFlags;
    // For a numeric literal, we cannot use the original text if the original text was an invalid literal
    if ((tokenFlags & TokenFlagsIsInvalid) !== 0) {
      return false;
    }
    // We also cannot use the original text if the literal contains numeric separators, but numeric separators
    // are not permitted
    if ((tokenFlags & TokenFlagsContainsSeparator) !== 0) {
      return (flags & getLiteralTextFlagsAllowNumericSeparator) !== 0;
    }
  }

  // Finally, we do not use the original text of a BigInt literal
  return node!.Kind !== KindBigIntLiteral;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::getLiteralText","kind":"func","status":"implemented","sigHash":"01453942aa321c406e4c0c8cdf4e99794293fc418649e0e3041bd46575fdd171","bodyHash":"9e5d323e94611264290ce3a9fe2948233107c8216880604a0f143482c4fdb3b8"}
 *
 * Go source:
 * func getLiteralText(node *ast.LiteralLikeNode, sourceFile *ast.SourceFile, flags getLiteralTextFlags) string {
 * 	// If we don't need to downlevel and we can reach the original source text using
 * 	// the node's parent reference, then simply get the text as it was originally written.
 * 	if sourceFile != nil && canUseOriginalText(node, flags) {
 * 		return scanner.GetSourceTextOfNodeFromSourceFile(sourceFile, node, false /*includeTrivia* /)
 * 	}
 * 
 * 	// If we can't reach the original source text, use the canonical form if it's a number,
 * 	// or a (possibly escaped) quoted form of the original text if it's string-like.
 * 	switch node.Kind {
 * 	case ast.KindStringLiteral:
 * 		var b strings.Builder
 * 		var quoteChar QuoteChar
 * 		if node.AsStringLiteral().TokenFlags&ast.TokenFlagsSingleQuote != 0 {
 * 			quoteChar = QuoteCharSingleQuote
 * 		} else {
 * 			quoteChar = QuoteCharDoubleQuote
 * 		}
 * 
 * 		text := node.Text()
 * 
 * 		// Write leading quote character
 * 		b.Grow(len(text) + 2)
 * 		b.WriteRune(rune(quoteChar))
 * 
 * 		// Write text
 * 		escapeStringWorker(text, quoteChar, flags, &b)
 * 
 * 		// Write trailing quote character
 * 		b.WriteRune(rune(quoteChar))
 * 		return b.String()
 * 
 * 	case ast.KindNoSubstitutionTemplateLiteral,
 * 		ast.KindTemplateHead,
 * 		ast.KindTemplateMiddle,
 * 		ast.KindTemplateTail:
 * 
 * 		// If a NoSubstitutionTemplateLiteral appears to have a substitution in it, the original text
 * 		// had to include a backslash: `not \${a} substitution`.
 * 		var b strings.Builder
 * 		text := node.Text()
 * 		rawText := node.TemplateLiteralLikeData().RawText
 * 		raw := len(rawText) > 0 || len(text) == 0
 * 
 * 		var textLen int
 * 		if raw {
 * 			textLen = len(rawText)
 * 		} else {
 * 			textLen = len(text)
 * 		}
 * 
 * 		// Write leading quote character
 * 		switch node.Kind {
 * 		case ast.KindNoSubstitutionTemplateLiteral:
 * 			b.Grow(2 + textLen)
 * 			b.WriteRune('`')
 * 		case ast.KindTemplateHead:
 * 			b.Grow(3 + textLen)
 * 			b.WriteRune('`')
 * 		case ast.KindTemplateMiddle:
 * 			b.Grow(3 + textLen)
 * 			b.WriteRune('}')
 * 		case ast.KindTemplateTail:
 * 			b.Grow(2 + textLen)
 * 			b.WriteRune('}')
 * 		}
 * 
 * 		// Write text
 * 		switch {
 * 		case len(rawText) > 0 || len(text) == 0:
 * 			// If rawText is set, it is expected to be valid.
 * 			b.WriteString(rawText)
 * 		default:
 * 			escapeStringWorker(text, QuoteCharBacktick, flags, &b)
 * 		}
 * 
 * 		// Write trailing quote character
 * 		switch node.Kind {
 * 		case ast.KindNoSubstitutionTemplateLiteral:
 * 			b.WriteRune('`')
 * 		case ast.KindTemplateHead:
 * 			b.WriteString("${")
 * 		case ast.KindTemplateMiddle:
 * 			b.WriteString("${")
 * 		case ast.KindTemplateTail:
 * 			b.WriteRune('`')
 * 		}
 * 		return b.String()
 * 
 * 	case ast.KindNumericLiteral, ast.KindBigIntLiteral:
 * 		return node.Text()
 * 
 * 	case ast.KindRegularExpressionLiteral:
 * 		if flags&getLiteralTextFlagsTerminateUnterminatedLiterals != 0 && ast.IsUnterminatedLiteral(node) {
 * 			var b strings.Builder
 * 			text := node.Text()
 * 			if len(text) > 0 && text[len(text)-1] == '\\' {
 * 				b.Grow(2 + len(text))
 * 				b.WriteString(text)
 * 				b.WriteString(" /")
 * 			} else {
 * 				b.Grow(1 + len(text))
 * 				b.WriteString(text)
 * 				b.WriteString("/")
 * 			}
 * 			return b.String()
 * 		}
 * 		return node.Text()
 * 
 * 	default:
 * 		panic("Unsupported LiteralLikeNode")
 * 	}
 * }
 */
export function getLiteralText(node: GoPtr<LiteralLikeNode>, sourceFile: GoPtr<SourceFileNode>, flags: getLiteralTextFlags): string {
  // If we don't need to downlevel and we can reach the original source text using
  // the node's parent reference, then simply get the text as it was originally written.
  if (sourceFile !== undefined && canUseOriginalText(node, flags)) {
    return GetSourceTextOfNodeFromSourceFile(sourceFile as unknown as GoPtr<SourceFile>, node, false /*includeTrivia*/);
  }

  // If we can't reach the original source text, use the canonical form if it's a number,
  // or a (possibly escaped) quoted form of the original text if it's string-like.
  switch (node!.Kind) {
    case KindStringLiteral: {
      const b = new Builder();
      const quoteChar: QuoteChar = (AsStringLiteral(node)!.TokenFlags & TokenFlagsSingleQuote) !== 0
        ? QuoteCharSingleQuote
        : QuoteCharDoubleQuote;

      const text = Node_Text(node);

      // Write leading quote character
      b.Grow(byteLen(text) + 2);
      b.WriteRune(quoteChar);

      // Write text
      escapeStringWorker(text, quoteChar, flags, b);

      // Write trailing quote character
      b.WriteRune(quoteChar);
      return b.String();
    }

    case KindNoSubstitutionTemplateLiteral:
    case KindTemplateHead:
    case KindTemplateMiddle:
    case KindTemplateTail: {
      // If a NoSubstitutionTemplateLiteral appears to have a substitution in it, the original text
      // had to include a backslash: `not \${a} substitution`.
      const b = new Builder();
      const text = Node_Text(node);
      const rawText = node!.Kind === KindNoSubstitutionTemplateLiteral
        ? AsNoSubstitutionTemplateLiteral(node)!.RawText
        : node!.Kind === KindTemplateHead
          ? AsTemplateHead(node)!.RawText
          : node!.Kind === KindTemplateMiddle
            ? AsTemplateMiddle(node)!.RawText
            : AsTemplateTail(node)!.RawText;
      const raw = byteLen(rawText) > 0 || byteLen(text) === 0;

      const textLen = raw ? byteLen(rawText) : byteLen(text);

      // Write leading quote character
      switch (node!.Kind) {
        case KindNoSubstitutionTemplateLiteral:
          b.Grow(2 + textLen);
          b.WriteRune(0x60 /* '`' */);
          break;
        case KindTemplateHead:
          b.Grow(3 + textLen);
          b.WriteRune(0x60 /* '`' */);
          break;
        case KindTemplateMiddle:
          b.Grow(3 + textLen);
          b.WriteRune(0x7d /* '}' */);
          break;
        case KindTemplateTail:
          b.Grow(2 + textLen);
          b.WriteRune(0x7d /* '}' */);
          break;
      }

      // Write text
      if (byteLen(rawText) > 0 || byteLen(text) === 0) {
        // If rawText is set, it is expected to be valid.
        b.WriteString(rawText);
      } else {
        escapeStringWorker(text, QuoteCharBacktick, flags, b);
      }

      // Write trailing quote character
      switch (node!.Kind) {
        case KindNoSubstitutionTemplateLiteral:
          b.WriteRune(0x60 /* '`' */);
          break;
        case KindTemplateHead:
          b.WriteString("${");
          break;
        case KindTemplateMiddle:
          b.WriteString("${");
          break;
        case KindTemplateTail:
          b.WriteRune(0x60 /* '`' */);
          break;
      }
      return b.String();
    }

    case KindNumericLiteral:
    case KindBigIntLiteral:
      return Node_Text(node);

    case KindRegularExpressionLiteral:
      if ((flags & getLiteralTextFlagsTerminateUnterminatedLiterals) !== 0 && IsUnterminatedLiteral(node)) {
        const b = new Builder();
        const text = Node_Text(node);
        const textBytes = StringUtf8Bytes(text);
        if (byteLen(text) > 0 && textBytes[byteLen(text) - 1] === 0x5c /* '\\' */) {
          b.Grow(2 + byteLen(text));
          b.WriteString(text);
          b.WriteString(" /");
        } else {
          b.Grow(1 + byteLen(text));
          b.WriteString(text);
          b.WriteString("/");
        }
        return b.String();
      }
      return Node_Text(node);

    default:
      throw new globalThis.Error("Unsupported LiteralLikeNode");
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::isNotPrologueDirective","kind":"func","status":"implemented","sigHash":"97a47820c666d00e8fc0cff13f569c307a5066814162b082dc8cad3c34a48719","bodyHash":"81d21249fedcd689cd2f0176bd170a90a0640b27e61ba4ac0afbcccc7c6eadfc"}
 *
 * Go source:
 * func isNotPrologueDirective(node *ast.Node) bool {
 * 	return !ast.IsPrologueDirective(node)
 * }
 */
export function isNotPrologueDirective(node: GoPtr<Node>): bool {
  return !IsPrologueDirective(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::RangeIsOnSingleLine","kind":"func","status":"implemented","sigHash":"4a23d1c36f9cd4971f2e96982e28fb516c907ddd744a152e44422db8eae2c684","bodyHash":"3c86b619a076acf663ea64e6d0538e4cfaaad497f0f0a600953d557a92e0b007"}
 *
 * Go source:
 * func RangeIsOnSingleLine(r core.TextRange, sourceFile *ast.SourceFile) bool {
 * 	return rangeStartIsOnSameLineAsRangeEnd(r, r, sourceFile)
 * }
 */
export function RangeIsOnSingleLine(r: TextRange, sourceFile: GoPtr<SourceFileNode>): bool {
  return rangeStartIsOnSameLineAsRangeEnd(r, r, sourceFile);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::RangeStartPositionsAreOnSameLine","kind":"func","status":"implemented","sigHash":"27d81e7eda65f533be8ae0702ada3c1867fe8601f505ca8dac9e705d2830ecfa","bodyHash":"c97cd2bec6081e88db65365024b020d72032458a2f1241ba14347cb7f39ec6c2"}
 *
 * Go source:
 * func RangeStartPositionsAreOnSameLine(range1 core.TextRange, range2 core.TextRange, sourceFile *ast.SourceFile) bool {
 * 	return PositionsAreOnSameLine(
 * 		getStartPositionOfRange(range1, sourceFile, false /*includeComments* /),
 * 		getStartPositionOfRange(range2, sourceFile, false /*includeComments* /),
 * 		sourceFile,
 * 	)
 * }
 */
export function RangeStartPositionsAreOnSameLine(range1: TextRange, range2: TextRange, sourceFile: GoPtr<SourceFileNode>): bool {
  return PositionsAreOnSameLine(
    getStartPositionOfRange(range1, sourceFile, false /*includeComments*/),
    getStartPositionOfRange(range2, sourceFile, false /*includeComments*/),
    sourceFile,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::rangeEndPositionsAreOnSameLine","kind":"func","status":"implemented","sigHash":"ab9974b9b7a74219dc3ce533e44d8dee466f8ae3cf76695bb259b30fb7ce0f93","bodyHash":"07d7c003905cfa832e39f8a7f029e7d884f664ae884873195eca6ef80868195f"}
 *
 * Go source:
 * func rangeEndPositionsAreOnSameLine(range1 core.TextRange, range2 core.TextRange, sourceFile *ast.SourceFile) bool {
 * 	return PositionsAreOnSameLine(range1.End(), range2.End(), sourceFile)
 * }
 */
export function rangeEndPositionsAreOnSameLine(range1: TextRange, range2: TextRange, sourceFile: GoPtr<SourceFileNode>): bool {
  return PositionsAreOnSameLine(TextRange_End(range1), TextRange_End(range2), sourceFile);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::rangeStartIsOnSameLineAsRangeEnd","kind":"func","status":"implemented","sigHash":"64e9342ac586a7398df7afe8f03c5f0d0888550f08afc38162c8972aed2eb696","bodyHash":"76bf5bb8a6c11bd6356f04c00cfbe6ec4eb0bdd8807d3188f1d3b1813f4f827f"}
 *
 * Go source:
 * func rangeStartIsOnSameLineAsRangeEnd(range1 core.TextRange, range2 core.TextRange, sourceFile *ast.SourceFile) bool {
 * 	return PositionsAreOnSameLine(getStartPositionOfRange(range1, sourceFile, false /*includeComments* /), range2.End(), sourceFile)
 * }
 */
export function rangeStartIsOnSameLineAsRangeEnd(range1: TextRange, range2: TextRange, sourceFile: GoPtr<SourceFileNode>): bool {
  return PositionsAreOnSameLine(getStartPositionOfRange(range1, sourceFile, false /*includeComments*/), TextRange_End(range2), sourceFile);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::rangeEndIsOnSameLineAsRangeStart","kind":"func","status":"implemented","sigHash":"88985d7f331aebb608fcfedeb3774e883fb15a4e5dd2d7225fe22cfce207b78f","bodyHash":"4ee5f57538aaebf4be10d223c2c5bc8a0e6d17f155a18ac6b78b9364a42bd1c8"}
 *
 * Go source:
 * func rangeEndIsOnSameLineAsRangeStart(range1 core.TextRange, range2 core.TextRange, sourceFile *ast.SourceFile) bool {
 * 	return PositionsAreOnSameLine(range1.End(), getStartPositionOfRange(range2, sourceFile, false /*includeComments* /), sourceFile)
 * }
 */
export function rangeEndIsOnSameLineAsRangeStart(range1: TextRange, range2: TextRange, sourceFile: GoPtr<SourceFileNode>): bool {
  return PositionsAreOnSameLine(TextRange_End(range1), getStartPositionOfRange(range2, sourceFile, false /*includeComments*/), sourceFile);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::getStartPositionOfRange","kind":"func","status":"implemented","sigHash":"7cd05030d609cfc1ee98cbba73739656a65ead3cc3fa02ba423c3db46865c7df","bodyHash":"4da7ecdecf78fbe7e7aa385521f956a88c9fcc192e18069055c35ab6813675da"}
 *
 * Go source:
 * func getStartPositionOfRange(r core.TextRange, sourceFile *ast.SourceFile, includeComments bool) int {
 * 	if ast.PositionIsSynthesized(r.Pos()) {
 * 		return -1
 * 	}
 * 	return scanner.SkipTriviaEx(sourceFile.Text(), r.Pos(), &scanner.SkipTriviaOptions{StopAtComments: includeComments})
 * }
 */
export function getStartPositionOfRange(r: TextRange, sourceFile: GoPtr<SourceFileNode>, includeComments: bool): int {
  if (PositionIsSynthesized(TextRange_Pos(r))) {
    return -1 as int;
  }
  return SkipTriviaEx(SourceFile_Text(AsSourceFile(sourceFile)!), TextRange_Pos(r), { StopAfterLineBreak: false, StopAtComments: includeComments, InJSDoc: false });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::PositionsAreOnSameLine","kind":"func","status":"implemented","sigHash":"503fa61979168bb6c74fc94a61ce428de6658d36927a2e796327fbd6062d137e","bodyHash":"aad63cb75637c22e368c84aabf6f6cad89f37bcfed2346fcc53c459e80e96253"}
 *
 * Go source:
 * func PositionsAreOnSameLine(pos1 int, pos2 int, sourceFile *ast.SourceFile) bool {
 * 	return GetLinesBetweenPositions(sourceFile, pos1, pos2) == 0
 * }
 */
export function PositionsAreOnSameLine(pos1: int, pos2: int, sourceFile: GoPtr<SourceFileNode>): bool {
  return GetLinesBetweenPositions(sourceFile, pos1, pos2) === 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::GetLinesBetweenPositions","kind":"func","status":"implemented","sigHash":"60560499c058aa9dca9d5b48aab3772ccc28cdb33fdbecc78610bcec41cd47fa","bodyHash":"054df492283cc0ba19901955441d91eeb459fdd36254d20d5e3407dd6e7b6654"}
 *
 * Go source:
 * func GetLinesBetweenPositions(sourceFile *ast.SourceFile, pos1 int, pos2 int) int {
 * 	if pos1 == pos2 {
 * 		return 0
 * 	}
 * 	lineStarts := scanner.GetECMALineStarts(sourceFile)
 * 	lower := core.IfElse(pos1 < pos2, pos1, pos2)
 * 	isNegative := lower == pos2
 * 	upper := core.IfElse(isNegative, pos1, pos2)
 * 	lowerLine := scanner.ComputeLineOfPosition(lineStarts, lower)
 * 	upperLine := lowerLine + scanner.ComputeLineOfPosition(lineStarts[lowerLine:], upper)
 * 	if isNegative {
 * 		return lowerLine - upperLine
 * 	} else {
 * 		return upperLine - lowerLine
 * 	}
 * }
 */
export function GetLinesBetweenPositions(sourceFile: GoPtr<SourceFileNode>, pos1: int, pos2: int): int {
  if (pos1 === pos2) {
    return 0 as int;
  }
  const sf = AsSourceFile(sourceFile);
  const lineStarts = GetECMALineStarts({
    Text: () => SourceFile_Text(sf),
    ECMALineMap: () => SourceFile_ECMALineMap(sf),
  });
  const lower = IfElse(pos1 < pos2, pos1, pos2);
  const isNegative = lower === pos2;
  const upper = IfElse(isNegative, pos1, pos2);
  const lowerLine = ComputeLineOfPosition(lineStarts, lower);
  const upperLine = lowerLine + ComputeLineOfPosition(lineStarts.slice(lowerLine), upper);
  if (isNegative) {
    return (lowerLine - upperLine) as int;
  } else {
    return (upperLine - lowerLine) as int;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::getLinesBetweenRangeEndAndRangeStart","kind":"func","status":"implemented","sigHash":"c09b4378069c7eb00fec78ffbe6f19723025b16b862da2a278125989dd496d8d","bodyHash":"dd7963df3cdd81226b526f436b3f8c66c769b46d0405ba90ce530dfad948a903"}
 *
 * Go source:
 * func getLinesBetweenRangeEndAndRangeStart(range1 core.TextRange, range2 core.TextRange, sourceFile *ast.SourceFile, includeSecondRangeComments bool) int {
 * 	range2Start := getStartPositionOfRange(range2, sourceFile, includeSecondRangeComments)
 * 	return GetLinesBetweenPositions(sourceFile, range1.End(), range2Start)
 * }
 */
export function getLinesBetweenRangeEndAndRangeStart(range1: TextRange, range2: TextRange, sourceFile: GoPtr<SourceFileNode>, includeSecondRangeComments: bool): int {
  const range2Start = getStartPositionOfRange(range2, sourceFile, includeSecondRangeComments);
  return GetLinesBetweenPositions(sourceFile, TextRange_End(range1), range2Start);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::getLinesBetweenPositionAndPrecedingNonWhitespaceCharacter","kind":"func","status":"implemented","sigHash":"950607840592060a275ba5d76980a8b0bec53f3e1d7a139e1bfcea9835eeb0f0","bodyHash":"c5bbcf5cd3e6f50eee5461139c445e6cae6f82306d08d0bd5701ad1158035fc7"}
 *
 * Go source:
 * func getLinesBetweenPositionAndPrecedingNonWhitespaceCharacter(pos int, stopPos int, sourceFile *ast.SourceFile, includeComments bool) int {
 * 	startPos := scanner.SkipTriviaEx(sourceFile.Text(), pos, &scanner.SkipTriviaOptions{StopAtComments: includeComments})
 * 	prevPos := getPreviousNonWhitespacePosition(startPos, stopPos, sourceFile)
 * 	return GetLinesBetweenPositions(sourceFile, core.IfElse(prevPos >= 0, prevPos, stopPos), startPos)
 * }
 */
export function getLinesBetweenPositionAndPrecedingNonWhitespaceCharacter(pos: int, stopPos: int, sourceFile: GoPtr<SourceFileNode>, includeComments: bool): int {
  const startPos = SkipTriviaEx(SourceFile_Text(AsSourceFile(sourceFile)!), pos, { StopAfterLineBreak: false, StopAtComments: includeComments, InJSDoc: false });
  const prevPos = getPreviousNonWhitespacePosition(startPos, stopPos, sourceFile);
  return GetLinesBetweenPositions(sourceFile, IfElse(prevPos >= 0, prevPos, stopPos), startPos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::getLinesBetweenPositionAndNextNonWhitespaceCharacter","kind":"func","status":"implemented","sigHash":"f01c0c09d85e46b9421d15da6e44ffac90ff28e384e81c604548eae513885619","bodyHash":"9beb5cca291c546b06a85c0180642a94200a6ac2f472e256580591cbb09030d9"}
 *
 * Go source:
 * func getLinesBetweenPositionAndNextNonWhitespaceCharacter(pos int, stopPos int, sourceFile *ast.SourceFile, includeComments bool) int {
 * 	nextPos := scanner.SkipTriviaEx(sourceFile.Text(), pos, &scanner.SkipTriviaOptions{StopAtComments: includeComments})
 * 	return GetLinesBetweenPositions(sourceFile, pos, core.IfElse(stopPos < nextPos, stopPos, nextPos))
 * }
 */
export function getLinesBetweenPositionAndNextNonWhitespaceCharacter(pos: int, stopPos: int, sourceFile: GoPtr<SourceFileNode>, includeComments: bool): int {
  const nextPos = SkipTriviaEx(SourceFile_Text(AsSourceFile(sourceFile)!), pos, { StopAfterLineBreak: false, StopAtComments: includeComments, InJSDoc: false });
  return GetLinesBetweenPositions(sourceFile, pos, IfElse(stopPos < nextPos, stopPos, nextPos));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::getPreviousNonWhitespacePosition","kind":"func","status":"implemented","sigHash":"4d9067c10420424d9e98f5b6cd3919c097fea68d5a8b5d43cfe21dd9e09a8272","bodyHash":"c3fd890c2f1a94414a696a91621dc77444df4004cd0bdfea7e0e0aabe419116f"}
 *
 * Go source:
 * func getPreviousNonWhitespacePosition(pos int, stopPos int, sourceFile *ast.SourceFile) int {
 * 	for ; pos >= stopPos; pos-- {
 * 		if !stringutil.IsWhiteSpaceLike(rune(sourceFile.Text()[pos])) {
 * 			return pos
 * 		}
 * 	}
 * 	return -1
 * }
 */
export function getPreviousNonWhitespacePosition(pos: int, stopPos: int, sourceFile: GoPtr<SourceFileNode>): int {
  const text = SourceFile_Text(AsSourceFile(sourceFile)!);
  const textBytes = StringUtf8Bytes(text);
  for (let p = pos; p >= stopPos; p--) {
    if (!IsWhiteSpaceLike(textBytes[p]!)) {
      return p as int;
    }
  }
  return -1 as int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::siblingNodePositionsAreComparable","kind":"func","status":"implemented","sigHash":"d17fc940d17e3947ef638ed7788f5c1afd2fff4a69d34ede0cc4a577a925e1bb","bodyHash":"d4e09e2b711de2c61dca98bd93062560fd11fa9d83c834bbbc2e9bef8d8aaf78"}
 *
 * Go source:
 * func siblingNodePositionsAreComparable(emitContext *EmitContext, previousNode *ast.Node, nextNode *ast.Node) bool {
 * 	if nextNode.Pos() < previousNode.End() {
 * 		return false
 * 	}
 *
 * 	previousNode = emitContext.MostOriginal(previousNode)
 * 	nextNode = emitContext.MostOriginal(nextNode)
 * 	parent := previousNode.Parent
 * 	if parent == nil || parent != nextNode.Parent {
 * 		return false
 * 	}
 *
 * 	parentNodeArray := getContainingNodeArray(previousNode)
 * 	if parentNodeArray != nil {
 * 		prevNodeIndex := slices.Index(parentNodeArray.Nodes, previousNode)
 * 		return prevNodeIndex >= 0 && slices.Index(parentNodeArray.Nodes, nextNode) == prevNodeIndex+1
 * 	}
 *
 * 	return false
 * }
 */
export function siblingNodePositionsAreComparable(emitContext: GoPtr<EmitContext>, previousNode: GoPtr<Node>, nextNode: GoPtr<Node>): bool {
  if (Node_Pos(nextNode) < Node_End(previousNode)) {
    return false;
  }

  previousNode = EmitContext_MostOriginal(emitContext, previousNode);
  nextNode = EmitContext_MostOriginal(emitContext, nextNode);
  const parent = previousNode!.Parent;
  if (parent === undefined || parent !== nextNode!.Parent) {
    return false;
  }

  const parentNodeArray = getContainingNodeArray(previousNode);
  if (parentNodeArray !== undefined) {
    const prevNodeIndex = parentNodeArray!.Nodes.indexOf(previousNode);
    return prevNodeIndex >= 0 && parentNodeArray!.Nodes.indexOf(nextNode) === prevNodeIndex + 1;
  }

  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::getContainingNodeArray","kind":"func","status":"implemented","sigHash":"e3433cbd3881b78d7b101ff43f3d320e73c26d65506c3eccba2e7d6ea77a9c6b","bodyHash":"2381bf9c044b6d2c614292d83e1f943836c3328489899054b995aff516d4fcee"}
 *
 * Go source:
 * func getContainingNodeArray(node *ast.Node) *ast.NodeList {
 * 	parent := node.Parent
 * 	if parent == nil {
 * 		return nil
 * 	}
 * 
 * 	switch node.Kind {
 * 	case ast.KindTypeParameter:
 * 		switch {
 * 		case ast.IsFunctionLike(parent) || ast.IsClassLike(parent) || ast.IsInterfaceDeclaration(parent) || ast.IsTypeOrJSTypeAliasDeclaration(parent):
 * 			return parent.TypeParameterList()
 * 		case ast.IsInferTypeNode(parent):
 * 			break
 * 		default:
 * 			panic(fmt.Sprintf("Unexpected TypeParameter parent: %#v", parent.Kind))
 * 		}
 * 
 * 	case ast.KindParameter:
 * 		return node.Parent.FunctionLikeData().Parameters
 * 	case ast.KindTemplateLiteralTypeSpan:
 * 		return node.Parent.AsTemplateLiteralTypeNode().TemplateSpans
 * 	case ast.KindTemplateSpan:
 * 		return node.Parent.AsTemplateExpression().TemplateSpans
 * 	case ast.KindDecorator:
 * 		if canHaveDecorators(node.Parent) {
 * 			if modifiers := node.Parent.Modifiers(); modifiers != nil {
 * 				return &modifiers.NodeList
 * 			}
 * 		}
 * 		return nil
 * 	case ast.KindHeritageClause:
 * 		if ast.IsClassLike(node.Parent) {
 * 			return node.Parent.ClassLikeData().HeritageClauses
 * 		} else {
 * 			return node.Parent.AsInterfaceDeclaration().HeritageClauses
 * 		}
 * 	}
 * 
 * 	// TODO(rbuckton)
 * 	// if ast.IsJSDocTag(node) {
 * 	//     if ast.IsJSDocTypeLiteral(node.parent) {
 * 	// 		return nil
 * 	// 	 }
 * 	// 	 return node.parent.tags
 * 	// }
 * 
 * 	switch parent.Kind {
 * 	case ast.KindTypeLiteral, ast.KindInterfaceDeclaration:
 * 		if ast.IsTypeElement(node) {
 * 			return parent.MemberList()
 * 		}
 * 	case ast.KindUnionType:
 * 		return parent.AsUnionTypeNode().Types
 * 	case ast.KindIntersectionType:
 * 		return parent.AsIntersectionTypeNode().Types
 * 	case ast.KindArrayLiteralExpression, ast.KindTupleType, ast.KindNamedImports, ast.KindNamedExports:
 * 		return parent.ElementList()
 * 	case ast.KindObjectLiteralExpression, ast.KindJsxAttributes:
 * 		return parent.PropertyList()
 * 	case ast.KindCallExpression:
 * 		p := parent.AsCallExpression()
 * 		switch {
 * 		case ast.IsTypeNode(node):
 * 			return p.TypeArguments
 * 		case node != p.Expression:
 * 			return p.Arguments
 * 		}
 * 	case ast.KindNewExpression:
 * 		p := parent.AsNewExpression()
 * 		switch {
 * 		case ast.IsTypeNode(node):
 * 			return p.TypeArguments
 * 		case node != p.Expression:
 * 			return p.Arguments
 * 		}
 * 	case ast.KindJsxElement, ast.KindJsxFragment:
 * 		if ast.IsJsxChild(node) {
 * 			return parent.Children()
 * 		}
 * 	case ast.KindJsxOpeningElement, ast.KindJsxSelfClosingElement:
 * 		if ast.IsTypeNode(node) {
 * 			return parent.TypeArgumentList()
 * 		}
 * 	case ast.KindBlock, ast.KindModuleBlock, ast.KindCaseClause, ast.KindDefaultClause:
 * 		return parent.StatementList()
 * 	case ast.KindCaseBlock:
 * 		return parent.AsCaseBlock().Clauses
 * 	case ast.KindClassDeclaration, ast.KindClassExpression:
 * 		if ast.IsClassElement(node) {
 * 			return parent.MemberList()
 * 		}
 * 	case ast.KindEnumDeclaration:
 * 		if ast.IsEnumMember(node) {
 * 			return parent.MemberList()
 * 		}
 * 	case ast.KindSourceFile:
 * 		if ast.IsStatement(node) {
 * 			return parent.StatementList()
 * 		}
 * 	}
 * 
 * 	if ast.IsModifier(node) {
 * 		if modifiers := parent.Modifiers(); modifiers != nil {
 * 			return &modifiers.NodeList
 * 		}
 * 	}
 * 
 * 	return nil
 * }
 */
export function getContainingNodeArray(node: GoPtr<Node>): GoPtr<NodeList> {
  const parent = node!.Parent;
  if (parent === undefined) {
    return undefined;
  }

  switch (node!.Kind) {
    case KindTypeParameter:
      if (IsFunctionLike(parent) || IsClassLike(parent) || IsInterfaceDeclaration(parent) || IsTypeOrJSTypeAliasDeclaration(parent)) {
        return Node_TypeParameterList(parent);
      } else if (IsInferTypeNode(parent)) {
        break; // no containing array for infer type's type parameter
      } else {
        throw new globalThis.Error(`Unexpected TypeParameter parent: ${parent!.Kind}`);
      }
      break;
    case KindParameter:
      return Node_FunctionLikeData(node!.Parent)!.Parameters;
    case KindTemplateLiteralTypeSpan:
      return AsTemplateLiteralTypeNode(node!.Parent)!.TemplateSpans;
    case KindTemplateSpan:
      return AsTemplateExpression(node!.Parent)!.TemplateSpans;
    case KindDecorator:
      if (canHaveDecorators(parent)) {
        const modifiers = Node_Modifiers(parent);
        if (modifiers !== undefined) {
          return modifiers;
        }
      }
      return undefined;
    case KindHeritageClause:
      if (IsClassLike(parent)) {
        return Node_ClassLikeData(parent)!.HeritageClauses;
      } else {
        return AsInterfaceDeclaration(parent)!.HeritageClauses;
      }
  }

  // TODO(rbuckton)
  // if (ast.IsJSDocTag(node)) { ... }

  switch (parent!.Kind) {
    case KindTypeLiteral:
    case KindInterfaceDeclaration:
      if (IsTypeElement(node)) {
        return Node_MemberList(parent);
      }
      break;
    case KindUnionType:
      return AsUnionTypeNode(parent)!.Types;
    case KindIntersectionType:
      return AsIntersectionTypeNode(parent)!.Types;
    case KindArrayLiteralExpression:
    case KindTupleType:
    case KindNamedImports:
    case KindNamedExports:
      return Node_ElementList(parent);
    case KindObjectLiteralExpression:
    case KindJsxAttributes:
      return Node_PropertyList(parent);
    case KindCallExpression: {
      const p = AsCallExpression(parent)!;
      if (IsTypeNode(node)) {
        return p.TypeArguments;
      } else if (node !== p.Expression) {
        return p.Arguments;
      }
      break;
    }
    case KindNewExpression: {
      const p = AsNewExpression(parent)!;
      if (IsTypeNode(node)) {
        return p.TypeArguments;
      } else if (node !== p.Expression) {
        return p.Arguments;
      }
      break;
    }
    case KindJsxElement:
    case KindJsxFragment:
      if (IsJsxChild(node)) {
        return Node_Children(parent);
      }
      break;
    case KindJsxOpeningElement:
    case KindJsxSelfClosingElement:
      if (IsTypeNode(node)) {
        return Node_TypeArgumentList(parent);
      }
      break;
    case KindBlock:
    case KindModuleBlock:
    case KindCaseClause:
    case KindDefaultClause:
      return Node_StatementList(parent);
    case KindCaseBlock:
      return AsCaseBlock(parent)!.Clauses;
    case KindClassDeclaration:
    case KindClassExpression:
      if (IsClassElement(node)) {
        return Node_MemberList(parent);
      }
      break;
    case KindEnumDeclaration:
      if (IsEnumMember(node)) {
        return Node_MemberList(parent);
      }
      break;
    case KindSourceFile:
      if (IsStatement(node)) {
        return Node_StatementList(parent);
      }
      break;
  }

  if (IsModifier(node)) {
    const modifiers = Node_Modifiers(parent);
    if (modifiers !== undefined) {
      return modifiers;
    }
  }

  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::canHaveDecorators","kind":"func","status":"implemented","sigHash":"dee5a32d1f414ee2f611040db4a183fd5a4c8a8caa837b312716666ed00b23bb","bodyHash":"ef4f9cd85c7e45f8e1c399b489a627166b2ad3023eaf78701e7839ad665ec61f"}
 *
 * Go source:
 * func canHaveDecorators(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindParameter,
 * 		ast.KindPropertyDeclaration,
 * 		ast.KindMethodDeclaration,
 * 		ast.KindGetAccessor,
 * 		ast.KindSetAccessor,
 * 		ast.KindClassExpression,
 * 		ast.KindClassDeclaration:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function canHaveDecorators(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindParameter:
    case KindPropertyDeclaration:
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindClassExpression:
    case KindClassDeclaration:
      return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::originalNodesHaveSameParent","kind":"func","status":"implemented","sigHash":"02540eeece2548f667d164b675c56c541d9a39f728bea01c4e995750456e1418","bodyHash":"4260594061bd650883f3c9168c41eb58aa5e3639969299ce5d75c4c5a0937852"}
 *
 * Go source:
 * func originalNodesHaveSameParent(emitContext *EmitContext, nodeA *ast.Node, nodeB *ast.Node) bool {
 * 	nodeA = emitContext.MostOriginal(nodeA)
 * 	if nodeA.Parent != nil {
 * 		// For performance, do not call `MostOriginal` for `nodeB` if `nodeA` doesn't even
 * 		// have a parent node.
 * 		nodeB = emitContext.MostOriginal(nodeB)
 * 		return nodeA.Parent == nodeB.Parent
 * 	}
 * 	return false
 * }
 */
export function originalNodesHaveSameParent(emitContext: GoPtr<EmitContext>, nodeA: GoPtr<Node>, nodeB: GoPtr<Node>): bool {
  nodeA = EmitContext_MostOriginal(emitContext, nodeA);
  if (nodeA!.Parent !== undefined) {
    // For performance, do not call `MostOriginal` for `nodeB` if `nodeA` doesn't even
    // have a parent node.
    nodeB = EmitContext_MostOriginal(emitContext, nodeB);
    return nodeA!.Parent === nodeB!.Parent;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::tryGetEnd","kind":"func","status":"implemented","sigHash":"439864f5813b13771cded08ce99e19c30efa2523953389e9efffb11b127849c6","bodyHash":"615bd358fab126f695aaea9f1aca6770475bb317b206c860bfc278365b339e1e"}
 *
 * Go source:
 * func tryGetEnd(node interface{ End() int }) (int, bool) {
 * 	// avoid using reflect (via core.IsNil) for common cases
 * 	switch v := node.(type) {
 * 	case (*ast.Node):
 * 		if v != nil {
 * 			return v.End(), true
 * 		}
 * 	case (*ast.NodeList):
 * 		if v != nil {
 * 			return v.End(), true
 * 		}
 * 	case (*ast.ModifierList):
 * 		if v != nil {
 * 			return v.End(), true
 * 		}
 * 	case (*core.TextRange):
 * 		if v != nil {
 * 			return v.End(), true
 * 		}
 * 	case core.TextRange:
 * 		return v.End(), true
 * 	default:
 * 		panic(fmt.Sprintf("unhandled type: %T", node))
 * 	}
 * 	return 0, false
 * }
 */
export function tryGetEnd(node: { End: () => int }): [int, bool] {
  if (node === undefined) {
    return [0 as int, false];
  }
  const value = node as unknown as Record<string, unknown>;
  if (typeof value["End"] === "function") {
    return [(node as { End: () => int }).End(), true];
  }
  if (value["Kind"] !== undefined) {
    return [Node_End(node as unknown as GoPtr<Node>), true];
  }
  if (value["Nodes"] !== undefined) {
    return [NodeList_End(node as unknown as GoPtr<NodeList>), true];
  }
  if (value["end"] !== undefined) {
    return [TextRange_End(node as unknown as TextRange), true];
  }
  throw new globalThis.Error(`unhandled type in tryGetEnd`);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::greatestEnd","kind":"func","status":"implemented","sigHash":"066c64a3add51f22c104776d4779bd53a697d898ed43dbaff3ad2dff4fe9c516","bodyHash":"d7fb8e969c1969a04f25be6199f4140cf1b16a35f409f997c1c4b9c4402e4563"}
 *
 * Go source:
 * func greatestEnd(end int, nodes ...interface{ End() int }) int {
 * 	for i := len(nodes) - 1; i >= 0; i-- {
 * 		node := nodes[i]
 * 		if nodeEnd, ok := tryGetEnd(node); ok && end < nodeEnd {
 * 			end = nodeEnd
 * 		}
 * 	}
 * 	return end
 * }
 */
export function greatestEnd(end: int, ...nodes: Array<{ End: () => int }>): int {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]!;
    const [nodeEnd, ok] = tryGetEnd(node);
    if (ok && (end as number) < (nodeEnd as number)) {
      end = nodeEnd;
    }
  }
  return end;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::skipSynthesizedParentheses","kind":"func","status":"implemented","sigHash":"24c84225806b102bfb9b5b469149712d78d03af4102bbcd5a2dee8b6a9db6887","bodyHash":"21ff7d88b7ab16f32120f7b9b472dde456ae02472b6c0cab383edd18724c7607"}
 *
 * Go source:
 * func skipSynthesizedParentheses(node *ast.Node) *ast.Node {
 * 	for node.Kind == ast.KindParenthesizedExpression && ast.NodeIsSynthesized(node) {
 * 		node = node.Expression()
 * 	}
 * 	return node
 * }
 */
export function skipSynthesizedParentheses(node: GoPtr<Node>): GoPtr<Node> {
  while (node!.Kind === KindParenthesizedExpression && NodeIsSynthesized(node)) {
    node = Node_Expression(node);
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::isNewExpressionWithoutArguments","kind":"func","status":"implemented","sigHash":"1e350dccdb2b9578dc557afd6c93de62f56c8d01d4c6fdaec6d28a6d762f43da","bodyHash":"304e2d20f40a0878863580e90fdb93c24e95744582cdcff3eb21dd845ddd6b97"}
 *
 * Go source:
 * func isNewExpressionWithoutArguments(node *ast.Node) bool {
 * 	return node.Kind == ast.KindNewExpression && node.ArgumentList() == nil
 * }
 */
export function isNewExpressionWithoutArguments(node: GoPtr<Node>): bool {
  return node!.Kind === KindNewExpression && Node_ArgumentList(node) === undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::isBinaryOperation","kind":"func","status":"implemented","sigHash":"0506a7ca356ba016f2783c05c73829a0ded0c3c12b412ce2f5b454389949e0f3","bodyHash":"a9e7c16af2d51b21df165d189a0ecb3989e895c737765f8926cde4c24a41b431"}
 *
 * Go source:
 * func isBinaryOperation(node *ast.Node, token ast.Kind) bool {
 * 	node = ast.SkipPartiallyEmittedExpressions(node)
 * 	return node.Kind == ast.KindBinaryExpression &&
 * 		node.AsBinaryExpression().OperatorToken.Kind == token
 * }
 */
export function isBinaryOperation(node: GoPtr<Node>, token: Kind): bool {
  node = SkipPartiallyEmittedExpressions(node);
  return node!.Kind === KindBinaryExpression && AsBinaryExpression(node)!.OperatorToken!.Kind === token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::mixingBinaryOperatorsRequiresParentheses","kind":"func","status":"implemented","sigHash":"bf1461cd2a6d12ae3f36c215541e9f63c1f838c9bd10f47a21abb46d7c06e6aa","bodyHash":"f5d9f8b32c86bbdf25fa989db55f0eec704d2e4c43c71175190af939e9c79b90"}
 *
 * Go source:
 * func mixingBinaryOperatorsRequiresParentheses(a ast.Kind, b ast.Kind) bool {
 * 	if a == ast.KindQuestionQuestionToken {
 * 		return b == ast.KindAmpersandAmpersandToken || b == ast.KindBarBarToken
 * 	}
 * 	if b == ast.KindQuestionQuestionToken {
 * 		return a == ast.KindAmpersandAmpersandToken || a == ast.KindBarBarToken
 * 	}
 * 	return false
 * }
 */
export function mixingBinaryOperatorsRequiresParentheses(a: Kind, b: Kind): bool {
  if (a === KindQuestionQuestionToken) {
    return b === KindAmpersandAmpersandToken || b === KindBarBarToken;
  }
  if (b === KindQuestionQuestionToken) {
    return a === KindAmpersandAmpersandToken || a === KindBarBarToken;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::isImmediatelyInvokedFunctionExpressionOrArrowFunction","kind":"func","status":"implemented","sigHash":"d591a512474c140ba8b369cf5fa07b65daf67417a4176e941e5504a85a29ff73","bodyHash":"3986d20eff18afc18d16c163afe580f9567368a8cd69529f3b5982a544e5fa5b"}
 *
 * Go source:
 * func isImmediatelyInvokedFunctionExpressionOrArrowFunction(node *ast.Expression) bool {
 * 	node = ast.SkipPartiallyEmittedExpressions(node)
 * 	if !ast.IsCallExpression(node) {
 * 		return false
 * 	}
 * 	node = ast.SkipPartiallyEmittedExpressions(node.Expression())
 * 	return ast.IsFunctionExpression(node) || ast.IsArrowFunction(node)
 * }
 */
export function isImmediatelyInvokedFunctionExpressionOrArrowFunction(node: GoPtr<Expression>): bool {
  node = SkipPartiallyEmittedExpressions(node);
  if (!IsCallExpression(node)) {
    return false;
  }
  node = SkipPartiallyEmittedExpressions(Node_Expression(node));
  return IsFunctionExpression(node) || IsArrowFunction(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::IsFileLevelUniqueName","kind":"func","status":"implemented","sigHash":"ea52aa7bb8bb4fa10dd521f946807cfe1027d209a1b682ecc409772f7c7bb724","bodyHash":"923abe2a9ba6ffd690249a85c3f7c6a53a06372df87c32833bba213c477cf7e1"}
 *
 * Go source:
 * func IsFileLevelUniqueName(sourceFile *ast.SourceFile, name string, hasGlobalName func(string) bool) bool {
 * 	if hasGlobalName != nil && hasGlobalName(name) {
 * 		return false
 * 	}
 * 	_, ok := sourceFile.Identifiers[name]
 * 	return !ok
 * }
 */
export function IsFileLevelUniqueName(sourceFile: GoPtr<SourceFileNode>, name: string, hasGlobalName: ((arg0: string) => bool) | undefined): bool {
  if (hasGlobalName !== undefined && hasGlobalName(name)) {
    return false;
  }
  return !(AsSourceFile(sourceFile)!.Identifiers?.has(name) ?? false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::hasLeadingHash","kind":"func","status":"implemented","sigHash":"0a9910a7dcb8e5498ea6835bded5b4fb36197283bc9fe7c303f6ac6684583885","bodyHash":"7045925f5d3f89de3678bf2df7c0c6d32dd0bf4b4f749c9b27b8e4d21561b3e7"}
 *
 * Go source:
 * func hasLeadingHash(text string) bool {
 * 	return len(text) > 0 && text[0] == '#'
 * }
 */
export function hasLeadingHash(text: string): bool {
  const bytes = StringUtf8Bytes(text);
  return bytes.length > 0 && bytes[0] === 0x23 /* '#' */;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::removeLeadingHash","kind":"func","status":"implemented","sigHash":"21e3a6cf2c9ec618d5eeece76a8b2d2015e4b36a6a3dad2eff68ed9bddc8d7a9","bodyHash":"ab3881976a8047239906288df9ba5b86dcfa667b135ac8f238bfbd722154900e"}
 *
 * Go source:
 * func removeLeadingHash(text string) string {
 * 	if hasLeadingHash(text) {
 * 		return text[1:]
 * 	} else {
 * 		return text
 * 	}
 * }
 */
export function removeLeadingHash(text: string): string {
  if (hasLeadingHash(text)) {
    return byteSlice(text, 1);
  } else {
    return text;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::ensureLeadingHash","kind":"func","status":"implemented","sigHash":"d7fa577bdc800c2c0e6f480bbb61625af0108c7cfac3259f62d8c7838c2ce740","bodyHash":"cfbca60c532148f5f55c93776596a1d16245f8cac5c4c89a755817d7eb1e0cbb"}
 *
 * Go source:
 * func ensureLeadingHash(text string) string {
 * 	if hasLeadingHash(text) {
 * 		return text
 * 	} else {
 * 		return "#" + text
 * 	}
 * }
 */
export function ensureLeadingHash(text: string): string {
  if (hasLeadingHash(text)) {
    return text;
  } else {
    return "#" + text;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::FormatGeneratedName","kind":"func","status":"implemented","sigHash":"94e8c8fbaab409be98f7208b6c5469dd6d28eca515a85ef79019048663944d1f","bodyHash":"a9bbe48d354c4cb0c33855aa47c9f75dadd64ef5e5bdeafc7ebc55a0e9bd54f9"}
 *
 * Go source:
 * func FormatGeneratedName(privateName bool, prefix string, base string, suffix string) string {
 * 	name := removeLeadingHash(prefix) + removeLeadingHash(base) + removeLeadingHash(suffix)
 * 	if privateName {
 * 		return ensureLeadingHash(name)
 * 	}
 * 	return name
 * }
 */
export function FormatGeneratedName(privateName: bool, prefix: string, base: string, suffix: string): string {
  const name = removeLeadingHash(prefix) + removeLeadingHash(base) + removeLeadingHash(suffix);
  if (privateName) {
    return ensureLeadingHash(name);
  }
  return name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::isASCIIWordCharacter","kind":"func","status":"implemented","sigHash":"71e315b03ad663c8899245c436c5634c6c690c8dfa0d9ff705be05b3234188e6","bodyHash":"40f5a76541717fd7d1da0953761e978f89ebd37c8387d97cd52cf8a14c3d3c99"}
 *
 * Go source:
 * func isASCIIWordCharacter(ch rune) bool {
 * 	return stringutil.IsASCIILetter(ch) || stringutil.IsDigit(ch) || ch == '_'
 * }
 */
export function isASCIIWordCharacter(ch: GoRune): bool {
  return IsASCIILetter(ch) || IsDigit(ch) || ch === 0x5f /* '_' */;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::makeIdentifierFromModuleName","kind":"func","status":"implemented","sigHash":"4011bb240d6f843053750a65dd189e562fde7a539ae4edcb522013e13bc2e043","bodyHash":"dcb7b4aaf9af867dfc92292293d99919c88d23055df38c8d26b059951d014e73"}
 *
 * Go source:
 * func makeIdentifierFromModuleName(moduleName string) string {
 * 	moduleName = tspath.GetBaseFileName(moduleName)
 * 	var builder strings.Builder
 * 	start := 0
 * 	pos := 0
 * 	for pos < len(moduleName) {
 * 		ch := rune(moduleName[pos])
 * 		if pos == 0 && stringutil.IsDigit(ch) {
 * 			builder.WriteByte('_')
 * 		} else if !isASCIIWordCharacter(ch) {
 * 			if start < pos {
 * 				builder.WriteString(moduleName[start:pos])
 * 			}
 * 			builder.WriteByte('_')
 * 			start = pos + 1
 * 		}
 * 		pos++
 * 	}
 * 	if start < pos {
 * 		builder.WriteString(moduleName[start:pos])
 * 	}
 * 	return builder.String()
 * }
 */
export function makeIdentifierFromModuleName(moduleName: string): string {
  moduleName = GetBaseFileName(moduleName);
  const moduleNameBytes = StringUtf8Bytes(moduleName);
  const builder = new Builder();
  let start = 0;
  let pos = 0;
  while (pos < moduleNameBytes.length) {
    const ch = moduleNameBytes[pos]!;
    if (pos === 0 && IsDigit(ch)) {
      builder.WriteByte(0x5f /* '_' */);
    } else if (!isASCIIWordCharacter(ch)) {
      if (start < pos) {
        builder.WriteString(byteSlice(moduleName, start, pos));
      }
      builder.WriteByte(0x5f /* '_' */);
      start = pos + 1;
    }
    pos++;
  }
  if (start < pos) {
    builder.WriteString(byteSlice(moduleName, start, pos));
  }
  return builder.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::findSpanEndWithEmitContext","kind":"func","status":"implemented","sigHash":"06f2364671f6bb4e517996d81b80bd0d68da80a4dff0d85cc92e3f0ee9645299","bodyHash":"7d0e1fc36ab67adcd91dced6eb3244c87809a070fad16251ff7432f033e6c6d8"}
 *
 * Go source:
 * func findSpanEndWithEmitContext[T any](c *EmitContext, array []T, test func(c *EmitContext, value T) bool, start int) int {
 * 	i := start
 * 	for i < len(array) && test(c, array[i]) {
 * 		i++
 * 	}
 * 	return i
 * }
 */
export function findSpanEndWithEmitContext<T>(c: GoPtr<EmitContext>, array: GoSlice<T>, test: (c: GoPtr<EmitContext>, value: T) => bool, start: int): int {
  let i = start;
  while (i < array.length && test(c, array[i]!)) {
    i++;
  }
  return i;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::findSpanEnd","kind":"func","status":"implemented","sigHash":"ba96c8d9823ba67dcb4175d95c9c21559153a50d829799fcf113b8ea286e8952","bodyHash":"3cb2f7e4885d452327746241b2022f3017ec0a377328fde1dfd73163fe7617ca"}
 *
 * Go source:
 * func findSpanEnd[T any](array []T, test func(value T) bool, start int) int {
 * 	i := start
 * 	for i < len(array) && test(array[i]) {
 * 		i++
 * 	}
 * 	return i
 * }
 */
export function findSpanEnd<T>(array: GoSlice<T>, test: (value: T) => bool, start: int): int {
  let i = start;
  while (i < array.length && test(array[i]!)) {
    i++;
  }
  return i;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::skipWhiteSpaceSingleLine","kind":"func","status":"implemented","sigHash":"ecba82faecbca07ff9f5252ae5cf38ab3ed7616cc793543de05184d4f04288ff","bodyHash":"2f0b9115ba968760bdc66bc849744728ff8bcfa4e81bdcd3c57b5ee525cb68e4"}
 *
 * Go source:
 * func skipWhiteSpaceSingleLine(text string, pos *int) {
 * 	for *pos < len(text) {
 * 		ch, size := utf8.DecodeRuneInString(text[*pos:])
 * 		if !stringutil.IsWhiteSpaceSingleLine(ch) {
 * 			break
 * 		}
 * 		*pos += size
 * 	}
 * }
 */
// Note: GoPtr<int> for pos is used here to match the porter's generated signature for Go's *int.
// Callers within this file pass a { v: int } box cast as GoPtr<int>. This works because
// GoPtr<int> = int | undefined and at runtime the actual value is a mutable object box.
export function skipWhiteSpaceSingleLine(text: string, pos: GoPtr<int>): void {
  const box = pos as unknown as { v: int };
  const textLen = byteLen(text);
  while ((box.v as number) < textLen) {
    const [ch, size] = decodeRuneInStringAt(text, box.v);
    if (!IsWhiteSpaceSingleLine(ch)) {
      break;
    }
    box.v = ((box.v as number) + size) as int;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::matchWhiteSpaceSingleLine","kind":"func","status":"implemented","sigHash":"c72d18a95e2e67716a42025cf4edf6fff671d737bd689748f1078d4f0707ab21","bodyHash":"7a7e9deab53358fad07530b3c63258cbe7d810f7650bc6c9a2d779b75e96a907"}
 *
 * Go source:
 * func matchWhiteSpaceSingleLine(text string, pos *int) bool {
 * 	startPos := *pos
 * 	skipWhiteSpaceSingleLine(text, pos)
 * 	return *pos != startPos
 * }
 */
export function matchWhiteSpaceSingleLine(text: string, pos: GoPtr<int>): bool {
  const box = pos as unknown as { v: int };
  const startPos = box.v;
  skipWhiteSpaceSingleLine(text, pos);
  return box.v !== startPos;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::matchRune","kind":"func","status":"implemented","sigHash":"5be5809e31c266605347800f3fe9bdac7eb1866d83a3451bc53d6a74e9516c78","bodyHash":"28f95cba26bb5ffb980b81c2a276b69a8466d16278a5cbc6c7fcf52320a45d4d"}
 *
 * Go source:
 * func matchRune(text string, pos *int, expected rune) bool {
 * 	ch, size := utf8.DecodeRuneInString(text[*pos:])
 * 	if ch == expected {
 * 		*pos += size
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function matchRune(text: string, pos: GoPtr<int>, expected: GoRune): bool {
  const box = pos as unknown as { v: int };
  const [ch, size] = decodeRuneInStringAt(text, box.v);
  if (ch === expected) {
    box.v = ((box.v as number) + size) as int;
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::matchString","kind":"func","status":"implemented","sigHash":"0d34383b231a1f5641cb7a53f19293ff996ce9cb7678a49f03efb61c549304f5","bodyHash":"ef8f80f21c703dc78891b6b225c6f7bf254236d99190b9b5a01fe802c1556a0f"}
 *
 * Go source:
 * func matchString(text string, pos *int, expected string) bool {
 * 	textPos := *pos
 * 	expectedPos := 0
 * 	for expectedPos < len(expected) {
 * 		if textPos >= len(text) {
 * 			return false
 * 		}
 * 
 * 		expectedRune, expectedSize := utf8.DecodeRuneInString(expected[expectedPos:])
 * 		if !matchRune(text, &textPos, expectedRune) {
 * 			return false
 * 		}
 * 
 * 		expectedPos += expectedSize
 * 	}
 * 
 * 	*pos = textPos
 * 	return true
 * }
 */
export function matchString(text: string, pos: GoPtr<int>, expected: string): bool {
  const box = pos as unknown as { v: int };
  const textLen = byteLen(text);
  const expectedLen = byteLen(expected);
  let textPos = box.v as number;
  let expectedPos = 0;
  while (expectedPos < expectedLen) {
    if (textPos >= textLen) {
      return false;
    }
    const [expectedRune, expectedSize] = decodeRuneInStringAt(expected, expectedPos);
    const tempBox = { v: textPos as int };
    if (!matchRune(text, tempBox as unknown as GoPtr<int>, expectedRune)) {
      return false;
    }
    textPos = tempBox.v as number;
    expectedPos += expectedSize;
  }
  box.v = textPos as int;
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::matchQuotedString","kind":"func","status":"implemented","sigHash":"b13ed415a5fb632f44fac8a8cc9d67060a518180e5b8a6a1dae86566a1dcab27","bodyHash":"1beec3c8545cd5fb4797124ad7bc4c20669fd68dd24ec315d55aa5fb5b6ce755"}
 *
 * Go source:
 * func matchQuotedString(text string, pos *int) bool {
 * 	textPos := *pos
 * 	var quoteChar rune
 * 	switch {
 * 	case matchRune(text, &textPos, '\''):
 * 		quoteChar = '\''
 * 	case matchRune(text, &textPos, '"'):
 * 		quoteChar = '"'
 * 	default:
 * 		return false
 * 	}
 * 	for textPos < len(text) {
 * 		ch, size := utf8.DecodeRuneInString(text[textPos:])
 * 		textPos += size
 * 		if ch == quoteChar {
 * 			*pos = textPos
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function matchQuotedString(text: string, pos: GoPtr<int>): bool {
  const box = pos as unknown as { v: int };
  let textPos = box.v as number;
  const textLen = byteLen(text);
  let quoteChar: GoRune;
  const tempBox1 = { v: textPos as int };
  if (matchRune(text, tempBox1 as unknown as GoPtr<int>, 0x27 /* '\'' */)) {
    textPos = tempBox1.v as number;
    quoteChar = 0x27;
  } else {
    const tempBox2 = { v: textPos as int };
    if (matchRune(text, tempBox2 as unknown as GoPtr<int>, 0x22 /* '"' */)) {
      textPos = tempBox2.v as number;
      quoteChar = 0x22;
    } else {
      return false;
    }
  }
  while (textPos < textLen) {
    const [ch, size] = decodeRuneInStringAt(text, textPos);
    textPos += size;
    if (ch === quoteChar) {
      box.v = textPos as int;
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::IsRecognizedTripleSlashComment","kind":"func","status":"implemented","sigHash":"cdbfa7b5df6917ee38733aa0cf2b0e0d8ce34c1266cad81feb7bfc8be6198979","bodyHash":"6748dfa1f26a9242cac72501fd4dbf0803749454f89cb2bf9d8dab4638df6b18"}
 *
 * Go source:
 * func IsRecognizedTripleSlashComment(text string, commentRange ast.CommentRange) bool {
 * 	if commentRange.Kind == ast.KindSingleLineCommentTrivia &&
 * 		commentRange.Len() > 2 &&
 * 		text[commentRange.Pos()+1] == '/' &&
 * 		text[commentRange.Pos()+2] == '/' {
 * 		text = text[commentRange.Pos()+3 : commentRange.End()]
 * 		pos := 0
 * 		skipWhiteSpaceSingleLine(text, &pos)
 * 		if !matchRune(text, &pos, '<') {
 * 			return false
 * 		}
 * 		switch {
 * 		case matchString(text, &pos, "reference"):
 * 			if !matchWhiteSpaceSingleLine(text, &pos) {
 * 				return false
 * 			}
 * 			if !matchString(text, &pos, "path") &&
 * 				!matchString(text, &pos, "types") &&
 * 				!matchString(text, &pos, "lib") &&
 * 				!matchString(text, &pos, "no-default-lib") {
 * 				return false
 * 			}
 * 			skipWhiteSpaceSingleLine(text, &pos)
 * 			if !matchRune(text, &pos, '=') {
 * 				return false
 * 			}
 * 			skipWhiteSpaceSingleLine(text, &pos)
 * 			if !matchQuotedString(text, &pos) {
 * 				return false
 * 			}
 * 		case matchString(text, &pos, "amd-dependency"):
 * 			if !matchWhiteSpaceSingleLine(text, &pos) {
 * 				return false
 * 			}
 * 			if !matchString(text, &pos, "path") {
 * 				return false
 * 			}
 * 			skipWhiteSpaceSingleLine(text, &pos)
 * 			if !matchRune(text, &pos, '=') {
 * 				return false
 * 			}
 * 			skipWhiteSpaceSingleLine(text, &pos)
 * 			if !matchQuotedString(text, &pos) {
 * 				return false
 * 			}
 * 		case matchString(text, &pos, "amd-module"):
 * 			skipWhiteSpaceSingleLine(text, &pos)
 * 		default:
 * 			return false
 * 		}
 * 		index := strings.Index(text[pos:], "/>")
 * 		return index != -1
 * 	}
 * 
 * 	return false
 * }
 */
export function IsRecognizedTripleSlashComment(text: string, commentRange: CommentRange): bool {
  const textBytes = StringUtf8Bytes(text);
  if (
    commentRange.Kind === KindSingleLineCommentTrivia &&
    (TextRange_End(commentRange) - TextRange_Pos(commentRange)) > 2 &&
    textBytes[TextRange_Pos(commentRange) + 1] === 0x2f /* '/' */ &&
    textBytes[TextRange_Pos(commentRange) + 2] === 0x2f /* '/' */
  ) {
    const sub = byteSlice(text, TextRange_Pos(commentRange) + 3, TextRange_End(commentRange));
    const posBox = { v: 0 as int };
    const posRef = posBox as unknown as GoPtr<int>;
    skipWhiteSpaceSingleLine(sub, posRef);
    if (!matchRune(sub, posRef, 0x3c /* '<' */)) {
      return false;
    }
    if (matchString(sub, posRef, "reference")) {
      if (!matchWhiteSpaceSingleLine(sub, posRef)) {
        return false;
      }
      if (
        !matchString(sub, posRef, "path") &&
        !matchString(sub, posRef, "types") &&
        !matchString(sub, posRef, "lib") &&
        !matchString(sub, posRef, "no-default-lib")
      ) {
        return false;
      }
      skipWhiteSpaceSingleLine(sub, posRef);
      if (!matchRune(sub, posRef, 0x3d /* '=' */)) {
        return false;
      }
      skipWhiteSpaceSingleLine(sub, posRef);
      if (!matchQuotedString(sub, posRef)) {
        return false;
      }
    } else if (matchString(sub, posRef, "amd-dependency")) {
      if (!matchWhiteSpaceSingleLine(sub, posRef)) {
        return false;
      }
      if (!matchString(sub, posRef, "path")) {
        return false;
      }
      skipWhiteSpaceSingleLine(sub, posRef);
      if (!matchRune(sub, posRef, 0x3d /* '=' */)) {
        return false;
      }
      skipWhiteSpaceSingleLine(sub, posRef);
      if (!matchQuotedString(sub, posRef)) {
        return false;
      }
    } else if (matchString(sub, posRef, "amd-module")) {
      skipWhiteSpaceSingleLine(sub, posRef);
    } else {
      return false;
    }
    const remaining = byteSlice(sub, posBox.v);
    return remaining.indexOf("/>") !== -1;
  }

  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::isJSDocLikeText","kind":"func","status":"implemented","sigHash":"2b14d01e19d5ff159443b15cdb7fccdbb06ebca822307bcc3c2985024449c93c","bodyHash":"0feb48356daac675a5bdf75ab45600ad412dda05c2600cfd8a3dd3b9404bba37"}
 *
 * Go source:
 * func isJSDocLikeText(text string, comment ast.CommentRange) bool {
 * 	return comment.Kind == ast.KindMultiLineCommentTrivia &&
 * 		comment.Len() >= 5 &&
 * 		text[comment.Pos()+2] == '*' &&
 * 		text[comment.Pos()+3] != '/'
 * }
 */
export function isJSDocLikeText(text: string, comment: CommentRange): bool {
  const textBytes = StringUtf8Bytes(text);
  return comment.Kind === KindMultiLineCommentTrivia &&
    (TextRange_End(comment) - TextRange_Pos(comment)) >= 5 &&
    textBytes[TextRange_Pos(comment) + 2] === 0x2a /* '*' */ &&
    textBytes[TextRange_Pos(comment) + 3] !== 0x2f /* '/' */;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::IsPinnedComment","kind":"func","status":"implemented","sigHash":"b9d6d4cab6b28a8c4d5f89536342fa81ffc2d492b07a4c38fba0f26f104a7f7a","bodyHash":"3e56281ff0c32f5657533e9bc8b0e26f9fe821de0e3b5839ad6dd2d7532b7ff8"}
 *
 * Go source:
 * func IsPinnedComment(text string, comment ast.CommentRange) bool {
 * 	return comment.Kind == ast.KindMultiLineCommentTrivia &&
 * 		comment.Len() > 5 &&
 * 		text[comment.Pos()+2] == '!'
 * }
 */
export function IsPinnedComment(text: string, comment: CommentRange): bool {
  const textBytes = StringUtf8Bytes(text);
  return comment.Kind === KindMultiLineCommentTrivia &&
    (TextRange_End(comment) - TextRange_Pos(comment)) > 5 &&
    textBytes[TextRange_Pos(comment) + 2] === 0x21 /* '!' */;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::calculateIndent","kind":"func","status":"implemented","sigHash":"1665279bb4ec524bbd85f1d4fb546be790a501724438d02e041da161681a007b","bodyHash":"3d4f1c5468fdb4e83a51187fb36bff19047863c702273a96d60ad7e5768cd636"}
 *
 * Go source:
 * func calculateIndent(text string, pos int, end int) int {
 * 	currentLineIndent := 0
 * 	indentSize := GetDefaultIndentSize()
 * 	for pos < end {
 * 		ch, size := utf8.DecodeRuneInString(text[pos:])
 * 		if !stringutil.IsWhiteSpaceSingleLine(ch) {
 * 			break
 * 		}
 * 		if ch == '\t' {
 * 			// Tabs = TabSize = indent size and go to next tabStop
 * 			currentLineIndent += indentSize - (currentLineIndent % indentSize)
 * 		} else {
 * 			// Single space
 * 			currentLineIndent++
 * 		}
 * 		pos += size
 * 	}
 *
 * 	return currentLineIndent
 * }
 */
export function calculateIndent(text: string, pos: int, end: int): int {
  let currentLineIndent = 0;
  const indentSize = GetDefaultIndentSize();
  while (pos < end) {
    const [ch, size] = decodeRuneInStringAt(text, pos);
    if (!IsWhiteSpaceSingleLine(ch)) {
      break;
    }
    if (ch === 0x09 /* '\t' */) {
      // Tabs = TabSize = indent size and go to next tabStop
      currentLineIndent += indentSize - (currentLineIndent % indentSize);
    } else {
      // Single space
      currentLineIndent++;
    }
    pos += size;
  }

  return currentLineIndent;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::type::lineCharacterCache","kind":"type","status":"implemented","sigHash":"67a43002b0c756f658d971a9fc787c0a2d05db7169b8b9910f6305254f6ef1c3","bodyHash":"210459b189681b315414052e3e6ac10a270328d5856d30c89e160c5c1a401a7e"}
 *
 * Go source:
 * lineCharacterCache struct {
 * 	lineMap    []core.TextPos
 * 	text       string
 * 	cachedLine int
 * 	cachedPos  int
 * 	cachedChar core.UTF16Offset
 * 	hasCached  bool
 * }
 */
export interface lineCharacterCache {
  lineMap: GoSlice<TextPos>;
  text: string;
  cachedLine: int;
  cachedPos: int;
  cachedChar: UTF16Offset;
  hasCached: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::func::newLineCharacterCache","kind":"func","status":"implemented","sigHash":"81408723d3fe11cab827f94b339cbfd5ad655e8ec55a90794860c57185a1b95c","bodyHash":"48fc88ec5a92fbf5344b1856cbec2a7aacd246342d142e0e64a3317563070fc7"}
 *
 * Go source:
 * func newLineCharacterCache(source sourcemap.Source) *lineCharacterCache {
 * 	return &lineCharacterCache{
 * 		lineMap: source.ECMALineMap(),
 * 		text:    source.Text(),
 * 	}
 * }
 */
export function newLineCharacterCache(source: Source): GoPtr<lineCharacterCache> {
  return {
    lineMap: source.ECMALineMap(),
    text: source.Text(),
    cachedLine: 0,
    cachedPos: 0,
    cachedChar: 0,
    hasCached: false,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/utilities.go::method::lineCharacterCache.getLineAndCharacter","kind":"method","status":"implemented","sigHash":"6250c3321fe67359c2d3eb790514455a992d22b4010fc53d07d21b97964c9925","bodyHash":"c499b8a577f2b0d0f3ee3a3e26bd7455ec03717c9dcf6ce22a76b4a12cf4322f"}
 *
 * Go source:
 * func (c *lineCharacterCache) getLineAndCharacter(pos int) (line int, character core.UTF16Offset) {
 * 	line = scanner.ComputeLineOfPosition(c.lineMap, pos)
 * 	lineStart := int(c.lineMap[line])
 * 	// When pos is beyond the source text (e.g., for error-recovery tokens like
 * 	// missing closing braces), we can't slice past the text end. Compute the
 * 	// UTF-16 length up to EOF and add the remaining byte offset arithmetically,
 * 	// matching TypeScript's computeLineAndCharacterOfPosition which uses
 * 	// arithmetic (position - lineStarts[lineNumber]) and handles this implicitly.
 * 	endPos := min(pos, len(c.text))
 * 	if c.hasCached && line == c.cachedLine && endPos >= c.cachedPos {
 * 		// Incremental: only count UTF-16 code units from the last cached position.
 * 		character = c.cachedChar + core.UTF16Len(c.text[c.cachedPos:endPos])
 * 	} else {
 * 		// Full computation from line start.
 * 		character = core.UTF16Len(c.text[lineStart:endPos])
 * 	}
 * 	cachedChar := character
 * 	character += core.UTF16Offset(pos - endPos)
 * 	c.cachedLine = line
 * 	c.cachedPos = endPos
 * 	c.cachedChar = cachedChar
 * 	c.hasCached = true
 * 	return line, character
 * }
 */
export function lineCharacterCache_getLineAndCharacter(receiver: GoPtr<lineCharacterCache>, pos: int): [int, UTF16Offset] {
  const line = ComputeLineOfPosition(receiver!.lineMap, pos);
  const lineStart = receiver!.lineMap[line]!;
  // When pos is beyond the source text (e.g., for error-recovery tokens like
  // missing closing braces), we can't slice past the text end. Compute the
  // UTF-16 length up to EOF and add the remaining byte offset arithmetically,
  // matching TypeScript's computeLineAndCharacterOfPosition which uses
  // arithmetic (position - lineStarts[lineNumber]) and handles this implicitly.
  const endPos = globalThis.Math.min(pos, byteLen(receiver!.text));
  let character: UTF16Offset;
  if (receiver!.hasCached && line === receiver!.cachedLine && endPos >= receiver!.cachedPos) {
    // Incremental: only count UTF-16 code units from the last cached position.
    character = receiver!.cachedChar + UTF16Len(byteSlice(receiver!.text, receiver!.cachedPos, endPos));
  } else {
    // Full computation from line start.
    character = UTF16Len(byteSlice(receiver!.text, lineStart, endPos));
  }
  const cachedChar = character;
  character += (pos - endPos) as UTF16Offset;
  receiver!.cachedLine = line;
  receiver!.cachedPos = endPos;
  receiver!.cachedChar = cachedChar;
  receiver!.hasCached = true;
  return [line, character];
}
