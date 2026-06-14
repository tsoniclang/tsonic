import type { bool, byte, int } from "@tsonic/core/types.js";
import type { GoComparable, GoMap, GoPtr, GoRune, GoSeq, GoSlice } from "../../go/compat.js";
import * as fmt from "../../go/fmt.js";
import * as strconv from "../../go/strconv.js";
import * as strings from "../../go/strings.js";
import { Builder } from "../../go/strings.js";
import * as unicode from "../../go/unicode.js";
import * as utf16 from "../../go/unicode/utf16.js";
import * as utf8 from "../../go/unicode/utf8.js";
// SourceFile, SourceFileLike, CommentDirective and CommentRange are hand-written
// AST aggregator types that are not yet ported into the spine/generated split;
// they live in the canonical (not-yet-created) `../ast/ast.js` module, mirroring
// the import convention used by every other ported file (parser, printer).
import type { CommentDirective, CommentDirectiveKind, CommentRange, SourceFile, SourceFileLike } from "../ast/ast.js";
import {
  CommentDirectiveKindExpectError,
  CommentDirectiveKindIgnore,
  Node_Body,
  Node_JSDoc,
  Node_Statements,
  NodeFactory_NewCommentRange,
  SourceFile_ECMALineMap,
  SourceFile_Text,
} from "../ast/ast.js";
import type { Node } from "../ast/spine.js";
import { Node_End, Node_Pos } from "../ast/spine.js";
import { GetNameOfDeclaration, IsJSDocNode, NodeIsMissing, PositionIsSynthesized } from "../ast/utilities.js";
import { IsJsxText } from "../ast/generated/predicates.js";
import { AsSatisfiesExpression } from "../ast/generated/casts.js";
import { NodeFlagsJSDoc, NodeFlagsReparsed } from "../ast/generated/flags.js";
import * as kinds from "../ast/generated/kinds.js";
import type { NodeFactory } from "../ast/generated/factory.js";
import type { Kind } from "../ast/generated/kinds.js";
import {
  KindAmpersandAmpersandEqualsToken,
  KindAmpersandAmpersandToken,
  KindAmpersandEqualsToken,
  KindAmpersandToken,
  KindAsteriskAsteriskEqualsToken,
  KindAsteriskAsteriskToken,
  KindAsteriskEqualsToken,
  KindAsteriskToken,
  KindAtToken,
  KindBacktickToken,
  KindBarBarEqualsToken,
  KindBarBarToken,
  KindBarEqualsToken,
  KindBarToken,
  KindBigIntLiteral,
  KindCaretEqualsToken,
  KindCaretToken,
  KindCloseBraceToken,
  KindCloseBracketToken,
  KindCloseParenToken,
  KindColonToken,
  KindCommaToken,
  KindConflictMarkerTrivia,
  KindDotDotDotToken,
  KindDotToken,
  KindEqualsEqualsEqualsToken,
  KindEqualsEqualsToken,
  KindEqualsGreaterThanToken,
  KindEqualsToken,
  KindEndOfFile,
  KindExclamationEqualsEqualsToken,
  KindExclamationEqualsToken,
  KindExclamationToken,
  KindGreaterThanEqualsToken,
  KindGreaterThanGreaterThanEqualsToken,
  KindGreaterThanGreaterThanGreaterThanEqualsToken,
  KindGreaterThanGreaterThanGreaterThanToken,
  KindGreaterThanGreaterThanToken,
  KindGreaterThanToken,
  KindHashToken,
  KindIdentifier,
  KindJSDocCommentTextToken,
  KindJsxText,
  KindJsxTextAllWhiteSpaces,
  KindLessThanEqualsToken,
  KindLessThanLessThanEqualsToken,
  KindLessThanLessThanToken,
  KindLessThanSlashToken,
  KindLessThanToken,
  KindMinusEqualsToken,
  KindMinusMinusToken,
  KindMinusToken,
  KindMultiLineCommentTrivia,
  KindNewLineTrivia,
  KindNonTextFileMarkerTrivia,
  KindNoSubstitutionTemplateLiteral,
  KindNumericLiteral,
  KindOpenBraceToken,
  KindOpenBracketToken,
  KindOpenParenToken,
  KindPercentEqualsToken,
  KindPercentToken,
  KindPlusEqualsToken,
  KindPlusPlusToken,
  KindPlusToken,
  KindPrivateIdentifier,
  KindQuestionDotToken,
  KindQuestionQuestionEqualsToken,
  KindQuestionQuestionToken,
  KindQuestionToken,
  KindRegularExpressionLiteral,
  KindSemicolonToken,
  KindSingleLineCommentTrivia,
  KindSlashEqualsToken,
  KindSlashToken,
  KindStringLiteral,
  KindTemplateHead,
  KindTemplateMiddle,
  KindTemplateTail,
  KindTildeToken,
  KindUnknown,
  KindWhitespaceTrivia,
} from "../ast/generated/kinds.js";
import {
  TokenFlagsBinaryOrOctalSpecifier,
  TokenFlagsBinarySpecifier,
  TokenFlagsContainsInvalidEscape,
  TokenFlagsContainsInvalidSeparator,
  TokenFlagsContainsLeadingZero,
  TokenFlagsContainsSeparator,
  TokenFlagsExtendedUnicodeEscape,
  TokenFlagsHexEscape,
  TokenFlagsHexSpecifier,
  TokenFlagsNone,
  TokenFlagsOctal,
  TokenFlagsOctalSpecifier,
  TokenFlagsPrecedingJSDocComment,
  TokenFlagsPrecedingJSDocLeadingAsterisks,
  TokenFlagsPrecedingJSDocWithDeprecated,
  TokenFlagsPrecedingJSDocWithSeeOrLink,
  TokenFlagsPrecedingLineBreak,
  TokenFlagsScientific,
  TokenFlagsSingleQuote,
  TokenFlagsUnicodeEscape,
  TokenFlagsUnterminated,
} from "../ast/tokenflags.js";
import type { TokenFlags as TokenFlags_4c7e9c27 } from "../ast/tokenflags.js";
import { IfElse, UTF16Len } from "../core/core.js";
import type { UTF16Offset } from "../core/core.js";
import { ScriptTargetLatest, ScriptTargetNone } from "../core/compileroptions.js";
import type { ScriptTarget } from "../core/compileroptions.js";
import { LanguageVariantJSX, LanguageVariantStandard } from "../core/languagevariant.js";
import type { LanguageVariant } from "../core/languagevariant.js";
import * as debug from "../debug/debug.js";
import { NewTextRange } from "../core/text.js";
import type { TextPos, TextRange } from "../core/text.js";
import type { Message } from "../diagnostics/diagnostics.js";
import {
  An_extended_Unicode_escape_value_must_be_between_0x0_and_0x10FFFF_inclusive,
  Asterisk_Slash_expected,
  A_bigint_literal_cannot_use_exponential_notation,
  A_bigint_literal_must_be_an_integer,
  Binary_digit_expected,
  Decimal_escape_sequences_and_backreferences_are_not_allowed_in_a_character_class,
  Decimals_with_leading_zeros_are_not_allowed,
  Digit_expected,
  Duplicate_regular_expression_flag,
  Escape_sequence_0_is_not_allowed,
  File_appears_to_be_binary,
  Hexadecimal_digit_expected,
  Invalid_character,
  Merge_conflict_marker_encountered,
  Multiple_consecutive_numeric_separators_are_not_permitted,
  Numeric_separators_are_not_allowed_here,
  Octal_digit_expected,
  Octal_escape_sequences_and_backreferences_are_not_allowed_in_a_character_class_If_this_was_intended_as_an_escape_sequence_use_the_syntax_0_instead,
  Octal_escape_sequences_are_not_allowed_Use_the_syntax_0,
  Octal_literals_are_not_allowed_Use_the_syntax_0,
  The_Unicode_u_flag_and_the_Unicode_Sets_v_flag_cannot_be_set_simultaneously,
  This_character_cannot_be_escaped_in_a_regular_expression,
  Unexpected_end_of_text,
  Unexpected_token_Did_you_mean_or_gt,
  Unexpected_token_Did_you_mean_or_rbrace,
  Unicode_escape_sequences_are_only_available_when_the_Unicode_u_flag_or_the_Unicode_Sets_v_flag_is_set,
  Unknown_regular_expression_flag,
  Unterminated_regular_expression_literal,
  Unterminated_string_literal,
  Unterminated_template_literal,
  Unterminated_Unicode_escape_sequence,
  An_identifier_or_keyword_cannot_immediately_follow_a_numeric_literal,
  X_can_only_be_used_at_the_start_of_a_file,
} from "../diagnostics/generated/messages.js";
import { FromString, Number_String } from "../jsnum/string.js";
import { ParsePseudoBigInt } from "../jsnum/pseudobigint.js";
import {
  IsASCIILetter,
  IsDigit,
  IsHexDigit,
  IsLineBreak,
  IsOctalDigit,
  IsWhiteSpaceLike,
  IsWhiteSpaceSingleLine,
} from "../stringutil/util.js";
import {
  charCodeToRegExpFlag,
  regExpParser_run,
  regularExpressionFlagsAnyUnicodeMode,
  regularExpressionFlagsUnicodeSets,
  Scanner_checkRegularExpressionFlagAvailability,
} from "./regexp.js";
import type { regExpParser, regularExpressionFlags } from "./regexp.js";
import {
  codePointIsHighSurrogate,
  codePointIsLowSurrogate,
  encodeSurrogate,
  surrogatePairToCodepoint,
  tokenIsIdentifierOrKeyword,
} from "./utilities.js";

// Go strings are UTF-8 byte sequences; the scanner tracks byte offsets (s.pos).
// These helpers reproduce Go's byte-indexed string operations so positions and
// sizes returned by utf8.* / strings.* match the byte-offset slicing semantics.
// The encoded-view cache is byte-budgeted: unbounded caching retains a full
// byte copy of every distinct large non-ASCII string a long-lived process
// touches (multiple GB on an in-process full-lib check).
const utf8Encoder: TextEncoder = new globalThis.TextEncoder();
const utf8Decoder: TextDecoder = new globalThis.TextDecoder("utf-8");
type Utf8ByteInfo = { ascii: bool; bytes: Uint8Array };
const utf8ByteInfoCache = new globalThis.Map<string, Utf8ByteInfo>();
const utf8ByteInfoCacheBudget = 64 * 1024 * 1024; // total cached bytes
const utf8ByteInfoCacheState = { bytes: 0 };

const getUtf8ByteInfo = (s: string): Utf8ByteInfo => {
  const cached = utf8ByteInfoCache.get(s);
  if (cached !== undefined) {
    return cached;
  }
  let ascii = true;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) >= utf8.RuneSelf) {
      ascii = false;
      break;
    }
  }
  const info: Utf8ByteInfo = {
    ascii,
    bytes: ascii ? undefined as unknown as Uint8Array : utf8Encoder.encode(s),
  };
  if (s.length >= 4096) {
    const cost = ascii ? s.length : info.bytes.length;
    if (utf8ByteInfoCacheState.bytes + cost > utf8ByteInfoCacheBudget) {
      utf8ByteInfoCache.clear();
      utf8ByteInfoCacheState.bytes = 0;
    }
    utf8ByteInfoCache.set(s, info);
    utf8ByteInfoCacheState.bytes += cost;
  }
  return info;
};

const byteSlice = (s: string, start: int, end?: int): string => {
  const info = getUtf8ByteInfo(s);
  if (info.ascii) {
    return s.slice(start, end);
  }
  return utf8Decoder.decode(info.bytes.subarray(start, end));
};

const byteAt = (s: string, i: int): int => {
  const info = getUtf8ByteInfo(s);
  return info.ascii ? s.charCodeAt(i) : info.bytes[i]!;
};

const byteLen = (s: string): int => {
  const info = getUtf8ByteInfo(s);
  return info.ascii ? s.length : info.bytes.length;
};

const decodeRuneInStringAt = (s: string, pos: int): [GoRune, int] => {
  const info = getUtf8ByteInfo(s);
  if (info.ascii) {
    return pos >= s.length ? [utf8.RuneError, 0] : [s.charCodeAt(pos), 1 as int];
  }
  return utf8.DecodeRuneInBytesAt(info.bytes, pos);
};

const decodeLastRuneInStringBefore = (s: string, end: int): [GoRune, int] => {
  const info = getUtf8ByteInfo(s);
  if (info.ascii) {
    return end <= 0 ? [utf8.RuneError, 0] : [s.charCodeAt(end - 1), 1 as int];
  }
  return utf8.DecodeLastRuneInBytesBefore(info.bytes, end);
};

// stringFromRune reproduces Go's `string(rune)`: the rune is UTF-8 encoded.
const stringFromRune = (r: GoRune): string => globalThis.String.fromCodePoint(r);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::type::EscapeSequenceScanningFlags","kind":"type","status":"implemented","sigHash":"945576f942128ce3405a91fe648e1822285ca48c016cae349df227738097bc86","bodyHash":"189b74d9bf24455a01aaf8068fc46a6d76864423aaaf881ad7c6c6ed62c2f944"}
 *
 * Go source:
 * EscapeSequenceScanningFlags int32
 */
export type EscapeSequenceScanningFlags = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::constGroup::EscapeSequenceScanningFlagsString+EscapeSequenceScanningFlagsReportErrors+EscapeSequenceScanningFlagsRegularExpression+EscapeSequenceScanningFlagsAnnexB+EscapeSequenceScanningFlagsAnyUnicodeMode+EscapeSequenceScanningFlagsAtomEscape+EscapeSequenceScanningFlagsReportInvalidEscapeErrors+EscapeSequenceScanningFlagsAllowExtendedUnicodeEscape","kind":"constGroup","status":"implemented","sigHash":"1ecea2d4d4c1df9823101696a98f6ae8a51ca05fb78196d94b8ca52a135c7f27","bodyHash":"1e173eb967e290fc5a0b5906cebff3c799c18e39a48a3322bc0cdde94e7ea7ae"}
 *
 * Go source:
 * const (
 * 	EscapeSequenceScanningFlagsString                     EscapeSequenceScanningFlags = 1 << 0
 * 	EscapeSequenceScanningFlagsReportErrors               EscapeSequenceScanningFlags = 1 << 1
 * 	EscapeSequenceScanningFlagsRegularExpression          EscapeSequenceScanningFlags = 1 << 2
 * 	EscapeSequenceScanningFlagsAnnexB                     EscapeSequenceScanningFlags = 1 << 3
 * 	EscapeSequenceScanningFlagsAnyUnicodeMode             EscapeSequenceScanningFlags = 1 << 4
 * 	EscapeSequenceScanningFlagsAtomEscape                 EscapeSequenceScanningFlags = 1 << 5
 * 	EscapeSequenceScanningFlagsReportInvalidEscapeErrors  EscapeSequenceScanningFlags = EscapeSequenceScanningFlagsRegularExpression | EscapeSequenceScanningFlagsReportErrors
 * 	EscapeSequenceScanningFlagsAllowExtendedUnicodeEscape EscapeSequenceScanningFlags = EscapeSequenceScanningFlagsString | EscapeSequenceScanningFlagsAnyUnicodeMode
 * )
 */
export const EscapeSequenceScanningFlagsString: EscapeSequenceScanningFlags = 1 << 0;
export const EscapeSequenceScanningFlagsReportErrors: EscapeSequenceScanningFlags = 1 << 1;
export const EscapeSequenceScanningFlagsRegularExpression: EscapeSequenceScanningFlags = 1 << 2;
export const EscapeSequenceScanningFlagsAnnexB: EscapeSequenceScanningFlags = 1 << 3;
export const EscapeSequenceScanningFlagsAnyUnicodeMode: EscapeSequenceScanningFlags = 1 << 4;
export const EscapeSequenceScanningFlagsAtomEscape: EscapeSequenceScanningFlags = 1 << 5;
export const EscapeSequenceScanningFlagsReportInvalidEscapeErrors: EscapeSequenceScanningFlags =
  EscapeSequenceScanningFlagsRegularExpression | EscapeSequenceScanningFlagsReportErrors;
export const EscapeSequenceScanningFlagsAllowExtendedUnicodeEscape: EscapeSequenceScanningFlags =
  EscapeSequenceScanningFlagsString | EscapeSequenceScanningFlagsAnyUnicodeMode;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::type::ErrorCallback","kind":"type","status":"implemented","sigHash":"69b0f8115ebc75a05611a6c5a179822a0476e75d3eecd96a146b252dc35fb56b","bodyHash":"ed14b0d85dd6b0b2e4553c01940c44527a87a9c8bcb098a0c9a7d1fdebed31c5"}
 *
 * Go source:
 * ErrorCallback func(diagnostic *diagnostics.Message, start, length int, args ...any)
 */
export type ErrorCallback = (diagnostic: GoPtr<Message>, start: int, length: int, ...args: Array<unknown>) => void;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::varGroup::textToKeyword","kind":"varGroup","status":"implemented","sigHash":"331eacad0b2c162c7810c59d097fe133a4d1ef5e2c07a09e8a2a5615d9f318e1","bodyHash":"3220721dff60605944e18f6d604dedb6ce0318fd667afb0498e21652bc6d6ca4"}
 *
 * Go source:
 * var textToKeyword = map[string]ast.Kind{
 * 	"abstract":    ast.KindAbstractKeyword,
 * 	"accessor":    ast.KindAccessorKeyword,
 * 	"any":         ast.KindAnyKeyword,
 * 	"as":          ast.KindAsKeyword,
 * 	"asserts":     ast.KindAssertsKeyword,
 * 	"assert":      ast.KindAssertKeyword,
 * 	"bigint":      ast.KindBigIntKeyword,
 * 	"boolean":     ast.KindBooleanKeyword,
 * 	"break":       ast.KindBreakKeyword,
 * 	"case":        ast.KindCaseKeyword,
 * 	"catch":       ast.KindCatchKeyword,
 * 	"class":       ast.KindClassKeyword,
 * 	"continue":    ast.KindContinueKeyword,
 * 	"const":       ast.KindConstKeyword,
 * 	"constructor": ast.KindConstructorKeyword,
 * 	"debugger":    ast.KindDebuggerKeyword,
 * 	"declare":     ast.KindDeclareKeyword,
 * 	"default":     ast.KindDefaultKeyword,
 * 	"defer":       ast.KindDeferKeyword,
 * 	"delete":      ast.KindDeleteKeyword,
 * 	"do":          ast.KindDoKeyword,
 * 	"else":        ast.KindElseKeyword,
 * 	"enum":        ast.KindEnumKeyword,
 * 	"export":      ast.KindExportKeyword,
 * 	"extends":     ast.KindExtendsKeyword,
 * 	"false":       ast.KindFalseKeyword,
 * 	"finally":     ast.KindFinallyKeyword,
 * 	"for":         ast.KindForKeyword,
 * 	"from":        ast.KindFromKeyword,
 * 	"function":    ast.KindFunctionKeyword,
 * 	"get":         ast.KindGetKeyword,
 * 	"if":          ast.KindIfKeyword,
 * 	"immediate":   ast.KindImmediateKeyword,
 * 	"implements":  ast.KindImplementsKeyword,
 * 	"import":      ast.KindImportKeyword,
 * 	"in":          ast.KindInKeyword,
 * 	"infer":       ast.KindInferKeyword,
 * 	"instanceof":  ast.KindInstanceOfKeyword,
 * 	"interface":   ast.KindInterfaceKeyword,
 * 	"intrinsic":   ast.KindIntrinsicKeyword,
 * 	"is":          ast.KindIsKeyword,
 * 	"keyof":       ast.KindKeyOfKeyword,
 * 	"let":         ast.KindLetKeyword,
 * 	"module":      ast.KindModuleKeyword,
 * 	"namespace":   ast.KindNamespaceKeyword,
 * 	"never":       ast.KindNeverKeyword,
 * 	"new":         ast.KindNewKeyword,
 * 	"null":        ast.KindNullKeyword,
 * 	"number":      ast.KindNumberKeyword,
 * 	"object":      ast.KindObjectKeyword,
 * 	"package":     ast.KindPackageKeyword,
 * 	"private":     ast.KindPrivateKeyword,
 * 	"protected":   ast.KindProtectedKeyword,
 * 	"public":      ast.KindPublicKeyword,
 * 	"override":    ast.KindOverrideKeyword,
 * 	"out":         ast.KindOutKeyword,
 * 	"readonly":    ast.KindReadonlyKeyword,
 * 	"require":     ast.KindRequireKeyword,
 * 	"global":      ast.KindGlobalKeyword,
 * 	"return":      ast.KindReturnKeyword,
 * 	"satisfies":   ast.KindSatisfiesKeyword,
 * 	"set":         ast.KindSetKeyword,
 * 	"static":      ast.KindStaticKeyword,
 * 	"string":      ast.KindStringKeyword,
 * 	"super":       ast.KindSuperKeyword,
 * 	"switch":      ast.KindSwitchKeyword,
 * 	"symbol":      ast.KindSymbolKeyword,
 * 	"this":        ast.KindThisKeyword,
 * 	"throw":       ast.KindThrowKeyword,
 * 	"true":        ast.KindTrueKeyword,
 * 	"try":         ast.KindTryKeyword,
 * 	"type":        ast.KindTypeKeyword,
 * 	"typeof":      ast.KindTypeOfKeyword,
 * 	"undefined":   ast.KindUndefinedKeyword,
 * 	"unique":      ast.KindUniqueKeyword,
 * 	"unknown":     ast.KindUnknownKeyword,
 * 	"using":       ast.KindUsingKeyword,
 * 	"var":         ast.KindVarKeyword,
 * 	"void":        ast.KindVoidKeyword,
 * 	"while":       ast.KindWhileKeyword,
 * 	"with":        ast.KindWithKeyword,
 * 	"yield":       ast.KindYieldKeyword,
 * 	"async":       ast.KindAsyncKeyword,
 * 	"await":       ast.KindAwaitKeyword,
 * 	"of":          ast.KindOfKeyword,
 * }
 */
export const textToKeyword: GoMap<string, Kind> = new globalThis.Map<string, Kind>([
  ["abstract", kinds.KindAbstractKeyword],
  ["accessor", kinds.KindAccessorKeyword],
  ["any", kinds.KindAnyKeyword],
  ["as", kinds.KindAsKeyword],
  ["asserts", kinds.KindAssertsKeyword],
  ["assert", kinds.KindAssertKeyword],
  ["bigint", kinds.KindBigIntKeyword],
  ["boolean", kinds.KindBooleanKeyword],
  ["break", kinds.KindBreakKeyword],
  ["case", kinds.KindCaseKeyword],
  ["catch", kinds.KindCatchKeyword],
  ["class", kinds.KindClassKeyword],
  ["continue", kinds.KindContinueKeyword],
  ["const", kinds.KindConstKeyword],
  ["constructor", kinds.KindConstructorKeyword],
  ["debugger", kinds.KindDebuggerKeyword],
  ["declare", kinds.KindDeclareKeyword],
  ["default", kinds.KindDefaultKeyword],
  ["defer", kinds.KindDeferKeyword],
  ["delete", kinds.KindDeleteKeyword],
  ["do", kinds.KindDoKeyword],
  ["else", kinds.KindElseKeyword],
  ["enum", kinds.KindEnumKeyword],
  ["export", kinds.KindExportKeyword],
  ["extends", kinds.KindExtendsKeyword],
  ["false", kinds.KindFalseKeyword],
  ["finally", kinds.KindFinallyKeyword],
  ["for", kinds.KindForKeyword],
  ["from", kinds.KindFromKeyword],
  ["function", kinds.KindFunctionKeyword],
  ["get", kinds.KindGetKeyword],
  ["if", kinds.KindIfKeyword],
  ["immediate", kinds.KindImmediateKeyword],
  ["implements", kinds.KindImplementsKeyword],
  ["import", kinds.KindImportKeyword],
  ["in", kinds.KindInKeyword],
  ["infer", kinds.KindInferKeyword],
  ["instanceof", kinds.KindInstanceOfKeyword],
  ["interface", kinds.KindInterfaceKeyword],
  ["intrinsic", kinds.KindIntrinsicKeyword],
  ["is", kinds.KindIsKeyword],
  ["keyof", kinds.KindKeyOfKeyword],
  ["let", kinds.KindLetKeyword],
  ["module", kinds.KindModuleKeyword],
  ["namespace", kinds.KindNamespaceKeyword],
  ["never", kinds.KindNeverKeyword],
  ["new", kinds.KindNewKeyword],
  ["null", kinds.KindNullKeyword],
  ["number", kinds.KindNumberKeyword],
  ["object", kinds.KindObjectKeyword],
  ["package", kinds.KindPackageKeyword],
  ["private", kinds.KindPrivateKeyword],
  ["protected", kinds.KindProtectedKeyword],
  ["public", kinds.KindPublicKeyword],
  ["override", kinds.KindOverrideKeyword],
  ["out", kinds.KindOutKeyword],
  ["readonly", kinds.KindReadonlyKeyword],
  ["require", kinds.KindRequireKeyword],
  ["global", kinds.KindGlobalKeyword],
  ["return", kinds.KindReturnKeyword],
  ["satisfies", kinds.KindSatisfiesKeyword],
  ["set", kinds.KindSetKeyword],
  ["static", kinds.KindStaticKeyword],
  ["string", kinds.KindStringKeyword],
  ["super", kinds.KindSuperKeyword],
  ["switch", kinds.KindSwitchKeyword],
  ["symbol", kinds.KindSymbolKeyword],
  ["this", kinds.KindThisKeyword],
  ["throw", kinds.KindThrowKeyword],
  ["true", kinds.KindTrueKeyword],
  ["try", kinds.KindTryKeyword],
  ["type", kinds.KindTypeKeyword],
  ["typeof", kinds.KindTypeOfKeyword],
  ["undefined", kinds.KindUndefinedKeyword],
  ["unique", kinds.KindUniqueKeyword],
  ["unknown", kinds.KindUnknownKeyword],
  ["using", kinds.KindUsingKeyword],
  ["var", kinds.KindVarKeyword],
  ["void", kinds.KindVoidKeyword],
  ["while", kinds.KindWhileKeyword],
  ["with", kinds.KindWithKeyword],
  ["yield", kinds.KindYieldKeyword],
  ["async", kinds.KindAsyncKeyword],
  ["await", kinds.KindAwaitKeyword],
  ["of", kinds.KindOfKeyword],
]);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::varGroup::textToToken","kind":"varGroup","status":"implemented","sigHash":"c4f61348f15a5aae11a5bae3120128df5529cf9ec7396baf3c1e652c421f648b","bodyHash":"920ca8aa9cb1454437c16812a89c2f43bcdff4076a0e9cf607e77ea103ba0fe4"}
 *
 * Go source:
 * var textToToken = func() map[string]ast.Kind {
 * 	m := map[string]ast.Kind{
 * 		"{":    ast.KindOpenBraceToken,
 * 		"}":    ast.KindCloseBraceToken,
 * 		"(":    ast.KindOpenParenToken,
 * 		")":    ast.KindCloseParenToken,
 * 		"[":    ast.KindOpenBracketToken,
 * 		"]":    ast.KindCloseBracketToken,
 * 		".":    ast.KindDotToken,
 * 		"...":  ast.KindDotDotDotToken,
 * 		";":    ast.KindSemicolonToken,
 * 		",":    ast.KindCommaToken,
 * 		"<":    ast.KindLessThanToken,
 * 		">":    ast.KindGreaterThanToken,
 * 		"<=":   ast.KindLessThanEqualsToken,
 * 		">=":   ast.KindGreaterThanEqualsToken,
 * 		"==":   ast.KindEqualsEqualsToken,
 * 		"!=":   ast.KindExclamationEqualsToken,
 * 		"===":  ast.KindEqualsEqualsEqualsToken,
 * 		"!==":  ast.KindExclamationEqualsEqualsToken,
 * 		"=>":   ast.KindEqualsGreaterThanToken,
 * 		"+":    ast.KindPlusToken,
 * 		"-":    ast.KindMinusToken,
 * 		"**":   ast.KindAsteriskAsteriskToken,
 * 		"*":    ast.KindAsteriskToken,
 * 		"/":    ast.KindSlashToken,
 * 		"%":    ast.KindPercentToken,
 * 		"++":   ast.KindPlusPlusToken,
 * 		"--":   ast.KindMinusMinusToken,
 * 		"<<":   ast.KindLessThanLessThanToken,
 * 		"</":   ast.KindLessThanSlashToken,
 * 		">>":   ast.KindGreaterThanGreaterThanToken,
 * 		">>>":  ast.KindGreaterThanGreaterThanGreaterThanToken,
 * 		"&":    ast.KindAmpersandToken,
 * 		"|":    ast.KindBarToken,
 * 		"^":    ast.KindCaretToken,
 * 		"!":    ast.KindExclamationToken,
 * 		"~":    ast.KindTildeToken,
 * 		"&&":   ast.KindAmpersandAmpersandToken,
 * 		"||":   ast.KindBarBarToken,
 * 		"?":    ast.KindQuestionToken,
 * 		"??":   ast.KindQuestionQuestionToken,
 * 		"?.":   ast.KindQuestionDotToken,
 * 		":":    ast.KindColonToken,
 * 		"=":    ast.KindEqualsToken,
 * 		"+=":   ast.KindPlusEqualsToken,
 * 		"-=":   ast.KindMinusEqualsToken,
 * 		"*=":   ast.KindAsteriskEqualsToken,
 * 		"**=":  ast.KindAsteriskAsteriskEqualsToken,
 * 		"/=":   ast.KindSlashEqualsToken,
 * 		"%=":   ast.KindPercentEqualsToken,
 * 		"<<=":  ast.KindLessThanLessThanEqualsToken,
 * 		">>=":  ast.KindGreaterThanGreaterThanEqualsToken,
 * 		">>>=": ast.KindGreaterThanGreaterThanGreaterThanEqualsToken,
 * 		"&=":   ast.KindAmpersandEqualsToken,
 * 		"|=":   ast.KindBarEqualsToken,
 * 		"^=":   ast.KindCaretEqualsToken,
 * 		"||=":  ast.KindBarBarEqualsToken,
 * 		"&&=":  ast.KindAmpersandAmpersandEqualsToken,
 * 		"??=":  ast.KindQuestionQuestionEqualsToken,
 * 		"@":    ast.KindAtToken,
 * 		"#":    ast.KindHashToken,
 * 		"`":    ast.KindBacktickToken,
 * 	}
 * 	maps.Copy(m, textToKeyword)
 * 	return m
 * }()
 */
export const textToToken: GoMap<string, Kind> = ((): GoMap<string, Kind> => {
  const m = new globalThis.Map<string, Kind>([
    ["{", KindOpenBraceToken],
    ["}", KindCloseBraceToken],
    ["(", KindOpenParenToken],
    [")", KindCloseParenToken],
    ["[", KindOpenBracketToken],
    ["]", KindCloseBracketToken],
    [".", KindDotToken],
    ["...", KindDotDotDotToken],
    [";", KindSemicolonToken],
    [",", KindCommaToken],
    ["<", KindLessThanToken],
    [">", KindGreaterThanToken],
    ["<=", KindLessThanEqualsToken],
    [">=", KindGreaterThanEqualsToken],
    ["==", KindEqualsEqualsToken],
    ["!=", KindExclamationEqualsToken],
    ["===", KindEqualsEqualsEqualsToken],
    ["!==", KindExclamationEqualsEqualsToken],
    ["=>", KindEqualsGreaterThanToken],
    ["+", KindPlusToken],
    ["-", KindMinusToken],
    ["**", KindAsteriskAsteriskToken],
    ["*", KindAsteriskToken],
    ["/", KindSlashToken],
    ["%", KindPercentToken],
    ["++", KindPlusPlusToken],
    ["--", KindMinusMinusToken],
    ["<<", KindLessThanLessThanToken],
    ["</", KindLessThanSlashToken],
    [">>", KindGreaterThanGreaterThanToken],
    [">>>", KindGreaterThanGreaterThanGreaterThanToken],
    ["&", KindAmpersandToken],
    ["|", KindBarToken],
    ["^", KindCaretToken],
    ["!", KindExclamationToken],
    ["~", KindTildeToken],
    ["&&", KindAmpersandAmpersandToken],
    ["||", KindBarBarToken],
    ["?", KindQuestionToken],
    ["??", KindQuestionQuestionToken],
    ["?.", KindQuestionDotToken],
    [":", KindColonToken],
    ["=", KindEqualsToken],
    ["+=", KindPlusEqualsToken],
    ["-=", KindMinusEqualsToken],
    ["*=", KindAsteriskEqualsToken],
    ["**=", KindAsteriskAsteriskEqualsToken],
    ["/=", KindSlashEqualsToken],
    ["%=", KindPercentEqualsToken],
    ["<<=", KindLessThanLessThanEqualsToken],
    [">>=", KindGreaterThanGreaterThanEqualsToken],
    [">>>=", KindGreaterThanGreaterThanGreaterThanEqualsToken],
    ["&=", KindAmpersandEqualsToken],
    ["|=", KindBarEqualsToken],
    ["^=", KindCaretEqualsToken],
    ["||=", KindBarBarEqualsToken],
    ["&&=", KindAmpersandAmpersandEqualsToken],
    ["??=", KindQuestionQuestionEqualsToken],
    ["@", KindAtToken],
    ["#", KindHashToken],
    ["`", KindBacktickToken],
  ]);
  for (const [text, kind] of textToKeyword) {
    m.set(text, kind);
  }
  return m;
})();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::varGroup::unicodeESNextIdentifierStart+unicodeESNextIdentifierPart","kind":"varGroup","status":"implemented","sigHash":"9019d7b800b8836fa77bd210bb03e2bfa03a174d6ec696ac334fab8ccfaee29b","bodyHash":"a3aa6548db861d1ffa48b4894c33977e06345d58ba0b74ecaff49fb50b820e67"}
 *
 * Go source:
 * var (
 * 	unicodeESNextIdentifierStart = []rune{65, 90, 97, 122, 170, 170, 181, 181, 186, 186, 192, 214, 216, 246, 248, 705, 710, 721, 736, 740, 748, 748, 750, 750, 880, 884, 886, 887, 890, 893, 895, 895, 902, 902, 904, 906, 908, 908, 910, 929, 931, 1013, 1015, 1153, 1162, 1327, 1329, 1366, 1369, 1369, 1376, 1416, 1488, 1514, 1519, 1522, 1568, 1610, 1646, 1647, 1649, 1747, 1749, 1749, 1765, 1766, 1774, 1775, 1786, 1788, 1791, 1791, 1808, 1808, 1810, 1839, 1869, 1957, 1969, 1969, 1994, 2026, 2036, 2037, 2042, 2042, 2048, 2069, 2074, 2074, 2084, 2084, 2088, 2088, 2112, 2136, 2144, 2154, 2160, 2183, 2185, 2190, 2208, 2249, 2308, 2361, 2365, 2365, 2384, 2384, 2392, 2401, 2417, 2432, 2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482, 2486, 2489, 2493, 2493, 2510, 2510, 2524, 2525, 2527, 2529, 2544, 2545, 2556, 2556, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608, 2610, 2611, 2613, 2614, 2616, 2617, 2649, 2652, 2654, 2654, 2674, 2676, 2693, 2701, 2703, 2705, 2707, 2728, 2730, 2736, 2738, 2739, 2741, 2745, 2749, 2749, 2768, 2768, 2784, 2785, 2809, 2809, 2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867, 2869, 2873, 2877, 2877, 2908, 2909, 2911, 2913, 2929, 2929, 2947, 2947, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970, 2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 3001, 3024, 3024, 3077, 3084, 3086, 3088, 3090, 3112, 3114, 3129, 3133, 3133, 3160, 3162, 3165, 3165, 3168, 3169, 3200, 3200, 3205, 3212, 3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3261, 3261, 3293, 3294, 3296, 3297, 3313, 3314, 3332, 3340, 3342, 3344, 3346, 3386, 3389, 3389, 3406, 3406, 3412, 3414, 3423, 3425, 3450, 3455, 3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526, 3585, 3632, 3634, 3635, 3648, 3654, 3713, 3714, 3716, 3716, 3718, 3722, 3724, 3747, 3749, 3749, 3751, 3760, 3762, 3763, 3773, 3773, 3776, 3780, 3782, 3782, 3804, 3807, 3840, 3840, 3904, 3911, 3913, 3948, 3976, 3980, 4096, 4138, 4159, 4159, 4176, 4181, 4186, 4189, 4193, 4193, 4197, 4198, 4206, 4208, 4213, 4225, 4238, 4238, 4256, 4293, 4295, 4295, 4301, 4301, 4304, 4346, 4348, 4680, 4682, 4685, 4688, 4694, 4696, 4696, 4698, 4701, 4704, 4744, 4746, 4749, 4752, 4784, 4786, 4789, 4792, 4798, 4800, 4800, 4802, 4805, 4808, 4822, 4824, 4880, 4882, 4885, 4888, 4954, 4992, 5007, 5024, 5109, 5112, 5117, 5121, 5740, 5743, 5759, 5761, 5786, 5792, 5866, 5870, 5880, 5888, 5905, 5919, 5937, 5952, 5969, 5984, 5996, 5998, 6000, 6016, 6067, 6103, 6103, 6108, 6108, 6176, 6264, 6272, 6312, 6314, 6314, 6320, 6389, 6400, 6430, 6480, 6509, 6512, 6516, 6528, 6571, 6576, 6601, 6656, 6678, 6688, 6740, 6823, 6823, 6917, 6963, 6981, 6988, 7043, 7072, 7086, 7087, 7098, 7141, 7168, 7203, 7245, 7247, 7258, 7293, 7296, 7304, 7312, 7354, 7357, 7359, 7401, 7404, 7406, 7411, 7413, 7414, 7418, 7418, 7424, 7615, 7680, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061, 8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140, 8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188, 8305, 8305, 8319, 8319, 8336, 8348, 8450, 8450, 8455, 8455, 8458, 8467, 8469, 8469, 8472, 8477, 8484, 8484, 8486, 8486, 8488, 8488, 8490, 8505, 8508, 8511, 8517, 8521, 8526, 8526, 8544, 8584, 11264, 11492, 11499, 11502, 11506, 11507, 11520, 11557, 11559, 11559, 11565, 11565, 11568, 11623, 11631, 11631, 11648, 11670, 11680, 11686, 11688, 11694, 11696, 11702, 11704, 11710, 11712, 11718, 11720, 11726, 11728, 11734, 11736, 11742, 12293, 12295, 12321, 12329, 12337, 12341, 12344, 12348, 12353, 12438, 12443, 12447, 12449, 12538, 12540, 12543, 12549, 12591, 12593, 12686, 12704, 12735, 12784, 12799, 13312, 19903, 19968, 42124, 42192, 42237, 42240, 42508, 42512, 42527, 42538, 42539, 42560, 42606, 42623, 42653, 42656, 42735, 42775, 42783, 42786, 42888, 42891, 42954, 42960, 42961, 42963, 42963, 42965, 42969, 42994, 43009, 43011, 43013, 43015, 43018, 43020, 43042, 43072, 43123, 43138, 43187, 43250, 43255, 43259, 43259, 43261, 43262, 43274, 43301, 43312, 43334, 43360, 43388, 43396, 43442, 43471, 43471, 43488, 43492, 43494, 43503, 43514, 43518, 43520, 43560, 43584, 43586, 43588, 43595, 43616, 43638, 43642, 43642, 43646, 43695, 43697, 43697, 43701, 43702, 43705, 43709, 43712, 43712, 43714, 43714, 43739, 43741, 43744, 43754, 43762, 43764, 43777, 43782, 43785, 43790, 43793, 43798, 43808, 43814, 43816, 43822, 43824, 43866, 43868, 43881, 43888, 44002, 44032, 55203, 55216, 55238, 55243, 55291, 63744, 64109, 64112, 64217, 64256, 64262, 64275, 64279, 64285, 64285, 64287, 64296, 64298, 64310, 64312, 64316, 64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433, 64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019, 65136, 65140, 65142, 65276, 65313, 65338, 65345, 65370, 65382, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500, 65536, 65547, 65549, 65574, 65576, 65594, 65596, 65597, 65599, 65613, 65616, 65629, 65664, 65786, 65856, 65908, 66176, 66204, 66208, 66256, 66304, 66335, 66349, 66378, 66384, 66421, 66432, 66461, 66464, 66499, 66504, 66511, 66513, 66517, 66560, 66717, 66736, 66771, 66776, 66811, 66816, 66855, 66864, 66915, 66928, 66938, 66940, 66954, 66956, 66962, 66964, 66965, 66967, 66977, 66979, 66993, 66995, 67001, 67003, 67004, 67072, 67382, 67392, 67413, 67424, 67431, 67456, 67461, 67463, 67504, 67506, 67514, 67584, 67589, 67592, 67592, 67594, 67637, 67639, 67640, 67644, 67644, 67647, 67669, 67680, 67702, 67712, 67742, 67808, 67826, 67828, 67829, 67840, 67861, 67872, 67897, 67968, 68023, 68030, 68031, 68096, 68096, 68112, 68115, 68117, 68119, 68121, 68149, 68192, 68220, 68224, 68252, 68288, 68295, 68297, 68324, 68352, 68405, 68416, 68437, 68448, 68466, 68480, 68497, 68608, 68680, 68736, 68786, 68800, 68850, 68864, 68899, 69248, 69289, 69296, 69297, 69376, 69404, 69415, 69415, 69424, 69445, 69488, 69505, 69552, 69572, 69600, 69622, 69635, 69687, 69745, 69746, 69749, 69749, 69763, 69807, 69840, 69864, 69891, 69926, 69956, 69956, 69959, 69959, 69968, 70002, 70006, 70006, 70019, 70066, 70081, 70084, 70106, 70106, 70108, 70108, 70144, 70161, 70163, 70187, 70207, 70208, 70272, 70278, 70280, 70280, 70282, 70285, 70287, 70301, 70303, 70312, 70320, 70366, 70405, 70412, 70415, 70416, 70419, 70440, 70442, 70448, 70450, 70451, 70453, 70457, 70461, 70461, 70480, 70480, 70493, 70497, 70656, 70708, 70727, 70730, 70751, 70753, 70784, 70831, 70852, 70853, 70855, 70855, 71040, 71086, 71128, 71131, 71168, 71215, 71236, 71236, 71296, 71338, 71352, 71352, 71424, 71450, 71488, 71494, 71680, 71723, 71840, 71903, 71935, 71942, 71945, 71945, 71948, 71955, 71957, 71958, 71960, 71983, 71999, 71999, 72001, 72001, 72096, 72103, 72106, 72144, 72161, 72161, 72163, 72163, 72192, 72192, 72203, 72242, 72250, 72250, 72272, 72272, 72284, 72329, 72349, 72349, 72368, 72440, 72704, 72712, 72714, 72750, 72768, 72768, 72818, 72847, 72960, 72966, 72968, 72969, 72971, 73008, 73030, 73030, 73056, 73061, 73063, 73064, 73066, 73097, 73112, 73112, 73440, 73458, 73474, 73474, 73476, 73488, 73490, 73523, 73648, 73648, 73728, 74649, 74752, 74862, 74880, 75075, 77712, 77808, 77824, 78895, 78913, 78918, 82944, 83526, 92160, 92728, 92736, 92766, 92784, 92862, 92880, 92909, 92928, 92975, 92992, 92995, 93027, 93047, 93053, 93071, 93760, 93823, 93952, 94026, 94032, 94032, 94099, 94111, 94176, 94177, 94179, 94179, 94208, 100343, 100352, 101589, 101632, 101640, 110576, 110579, 110581, 110587, 110589, 110590, 110592, 110882, 110898, 110898, 110928, 110930, 110933, 110933, 110948, 110951, 110960, 111355, 113664, 113770, 113776, 113788, 113792, 113800, 113808, 113817, 119808, 119892, 119894, 119964, 119966, 119967, 119970, 119970, 119973, 119974, 119977, 119980, 119982, 119993, 119995, 119995, 119997, 120003, 120005, 120069, 120071, 120074, 120077, 120084, 120086, 120092, 120094, 120121, 120123, 120126, 120128, 120132, 120134, 120134, 120138, 120144, 120146, 120485, 120488, 120512, 120514, 120538, 120540, 120570, 120572, 120596, 120598, 120628, 120630, 120654, 120656, 120686, 120688, 120712, 120714, 120744, 120746, 120770, 120772, 120779, 122624, 122654, 122661, 122666, 122928, 122989, 123136, 123180, 123191, 123197, 123214, 123214, 123536, 123565, 123584, 123627, 124112, 124139, 124896, 124902, 124904, 124907, 124909, 124910, 124912, 124926, 124928, 125124, 125184, 125251, 125259, 125259, 126464, 126467, 126469, 126495, 126497, 126498, 126500, 126500, 126503, 126503, 126505, 126514, 126516, 126519, 126521, 126521, 126523, 126523, 126530, 126530, 126535, 126535, 126537, 126537, 126539, 126539, 126541, 126543, 126545, 126546, 126548, 126548, 126551, 126551, 126553, 126553, 126555, 126555, 126557, 126557, 126559, 126559, 126561, 126562, 126564, 126564, 126567, 126570, 126572, 126578, 126580, 126583, 126585, 126588, 126590, 126590, 126592, 126601, 126603, 126619, 126625, 126627, 126629, 126633, 126635, 126651, 131072, 173791, 173824, 177977, 177984, 178205, 178208, 183969, 183984, 191456, 191472, 192093, 194560, 195101, 196608, 201546, 201552, 205743}
 * 	unicodeESNextIdentifierPart  = []rune{48, 57, 65, 90, 95, 95, 97, 122, 170, 170, 181, 181, 183, 183, 186, 186, 192, 214, 216, 246, 248, 705, 710, 721, 736, 740, 748, 748, 750, 750, 768, 884, 886, 887, 890, 893, 895, 895, 902, 906, 908, 908, 910, 929, 931, 1013, 1015, 1153, 1155, 1159, 1162, 1327, 1329, 1366, 1369, 1369, 1376, 1416, 1425, 1469, 1471, 1471, 1473, 1474, 1476, 1477, 1479, 1479, 1488, 1514, 1519, 1522, 1552, 1562, 1568, 1641, 1646, 1747, 1749, 1756, 1759, 1768, 1770, 1788, 1791, 1791, 1808, 1866, 1869, 1969, 1984, 2037, 2042, 2042, 2045, 2045, 2048, 2093, 2112, 2139, 2144, 2154, 2160, 2183, 2185, 2190, 2200, 2273, 2275, 2403, 2406, 2415, 2417, 2435, 2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482, 2486, 2489, 2492, 2500, 2503, 2504, 2507, 2510, 2519, 2519, 2524, 2525, 2527, 2531, 2534, 2545, 2556, 2556, 2558, 2558, 2561, 2563, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608, 2610, 2611, 2613, 2614, 2616, 2617, 2620, 2620, 2622, 2626, 2631, 2632, 2635, 2637, 2641, 2641, 2649, 2652, 2654, 2654, 2662, 2677, 2689, 2691, 2693, 2701, 2703, 2705, 2707, 2728, 2730, 2736, 2738, 2739, 2741, 2745, 2748, 2757, 2759, 2761, 2763, 2765, 2768, 2768, 2784, 2787, 2790, 2799, 2809, 2815, 2817, 2819, 2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867, 2869, 2873, 2876, 2884, 2887, 2888, 2891, 2893, 2901, 2903, 2908, 2909, 2911, 2915, 2918, 2927, 2929, 2929, 2946, 2947, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970, 2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 3001, 3006, 3010, 3014, 3016, 3018, 3021, 3024, 3024, 3031, 3031, 3046, 3055, 3072, 3084, 3086, 3088, 3090, 3112, 3114, 3129, 3132, 3140, 3142, 3144, 3146, 3149, 3157, 3158, 3160, 3162, 3165, 3165, 3168, 3171, 3174, 3183, 3200, 3203, 3205, 3212, 3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3260, 3268, 3270, 3272, 3274, 3277, 3285, 3286, 3293, 3294, 3296, 3299, 3302, 3311, 3313, 3315, 3328, 3340, 3342, 3344, 3346, 3396, 3398, 3400, 3402, 3406, 3412, 3415, 3423, 3427, 3430, 3439, 3450, 3455, 3457, 3459, 3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526, 3530, 3530, 3535, 3540, 3542, 3542, 3544, 3551, 3558, 3567, 3570, 3571, 3585, 3642, 3648, 3662, 3664, 3673, 3713, 3714, 3716, 3716, 3718, 3722, 3724, 3747, 3749, 3749, 3751, 3773, 3776, 3780, 3782, 3782, 3784, 3790, 3792, 3801, 3804, 3807, 3840, 3840, 3864, 3865, 3872, 3881, 3893, 3893, 3895, 3895, 3897, 3897, 3902, 3911, 3913, 3948, 3953, 3972, 3974, 3991, 3993, 4028, 4038, 4038, 4096, 4169, 4176, 4253, 4256, 4293, 4295, 4295, 4301, 4301, 4304, 4346, 4348, 4680, 4682, 4685, 4688, 4694, 4696, 4696, 4698, 4701, 4704, 4744, 4746, 4749, 4752, 4784, 4786, 4789, 4792, 4798, 4800, 4800, 4802, 4805, 4808, 4822, 4824, 4880, 4882, 4885, 4888, 4954, 4957, 4959, 4969, 4977, 4992, 5007, 5024, 5109, 5112, 5117, 5121, 5740, 5743, 5759, 5761, 5786, 5792, 5866, 5870, 5880, 5888, 5909, 5919, 5940, 5952, 5971, 5984, 5996, 5998, 6000, 6002, 6003, 6016, 6099, 6103, 6103, 6108, 6109, 6112, 6121, 6155, 6157, 6159, 6169, 6176, 6264, 6272, 6314, 6320, 6389, 6400, 6430, 6432, 6443, 6448, 6459, 6470, 6509, 6512, 6516, 6528, 6571, 6576, 6601, 6608, 6618, 6656, 6683, 6688, 6750, 6752, 6780, 6783, 6793, 6800, 6809, 6823, 6823, 6832, 6845, 6847, 6862, 6912, 6988, 6992, 7001, 7019, 7027, 7040, 7155, 7168, 7223, 7232, 7241, 7245, 7293, 7296, 7304, 7312, 7354, 7357, 7359, 7376, 7378, 7380, 7418, 7424, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061, 8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140, 8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188, 8204, 8205, 8255, 8256, 8276, 8276, 8305, 8305, 8319, 8319, 8336, 8348, 8400, 8412, 8417, 8417, 8421, 8432, 8450, 8450, 8455, 8455, 8458, 8467, 8469, 8469, 8472, 8477, 8484, 8484, 8486, 8486, 8488, 8488, 8490, 8505, 8508, 8511, 8517, 8521, 8526, 8526, 8544, 8584, 11264, 11492, 11499, 11507, 11520, 11557, 11559, 11559, 11565, 11565, 11568, 11623, 11631, 11631, 11647, 11670, 11680, 11686, 11688, 11694, 11696, 11702, 11704, 11710, 11712, 11718, 11720, 11726, 11728, 11734, 11736, 11742, 11744, 11775, 12293, 12295, 12321, 12335, 12337, 12341, 12344, 12348, 12353, 12438, 12441, 12447, 12449, 12543, 12549, 12591, 12593, 12686, 12704, 12735, 12784, 12799, 13312, 19903, 19968, 42124, 42192, 42237, 42240, 42508, 42512, 42539, 42560, 42607, 42612, 42621, 42623, 42737, 42775, 42783, 42786, 42888, 42891, 42954, 42960, 42961, 42963, 42963, 42965, 42969, 42994, 43047, 43052, 43052, 43072, 43123, 43136, 43205, 43216, 43225, 43232, 43255, 43259, 43259, 43261, 43309, 43312, 43347, 43360, 43388, 43392, 43456, 43471, 43481, 43488, 43518, 43520, 43574, 43584, 43597, 43600, 43609, 43616, 43638, 43642, 43714, 43739, 43741, 43744, 43759, 43762, 43766, 43777, 43782, 43785, 43790, 43793, 43798, 43808, 43814, 43816, 43822, 43824, 43866, 43868, 43881, 43888, 44010, 44012, 44013, 44016, 44025, 44032, 55203, 55216, 55238, 55243, 55291, 63744, 64109, 64112, 64217, 64256, 64262, 64275, 64279, 64285, 64296, 64298, 64310, 64312, 64316, 64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433, 64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019, 65024, 65039, 65056, 65071, 65075, 65076, 65101, 65103, 65136, 65140, 65142, 65276, 65296, 65305, 65313, 65338, 65343, 65343, 65345, 65370, 65381, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500, 65536, 65547, 65549, 65574, 65576, 65594, 65596, 65597, 65599, 65613, 65616, 65629, 65664, 65786, 65856, 65908, 66045, 66045, 66176, 66204, 66208, 66256, 66272, 66272, 66304, 66335, 66349, 66378, 66384, 66426, 66432, 66461, 66464, 66499, 66504, 66511, 66513, 66517, 66560, 66717, 66720, 66729, 66736, 66771, 66776, 66811, 66816, 66855, 66864, 66915, 66928, 66938, 66940, 66954, 66956, 66962, 66964, 66965, 66967, 66977, 66979, 66993, 66995, 67001, 67003, 67004, 67072, 67382, 67392, 67413, 67424, 67431, 67456, 67461, 67463, 67504, 67506, 67514, 67584, 67589, 67592, 67592, 67594, 67637, 67639, 67640, 67644, 67644, 67647, 67669, 67680, 67702, 67712, 67742, 67808, 67826, 67828, 67829, 67840, 67861, 67872, 67897, 67968, 68023, 68030, 68031, 68096, 68099, 68101, 68102, 68108, 68115, 68117, 68119, 68121, 68149, 68152, 68154, 68159, 68159, 68192, 68220, 68224, 68252, 68288, 68295, 68297, 68326, 68352, 68405, 68416, 68437, 68448, 68466, 68480, 68497, 68608, 68680, 68736, 68786, 68800, 68850, 68864, 68903, 68912, 68921, 69248, 69289, 69291, 69292, 69296, 69297, 69373, 69404, 69415, 69415, 69424, 69456, 69488, 69509, 69552, 69572, 69600, 69622, 69632, 69702, 69734, 69749, 69759, 69818, 69826, 69826, 69840, 69864, 69872, 69881, 69888, 69940, 69942, 69951, 69956, 69959, 69968, 70003, 70006, 70006, 70016, 70084, 70089, 70092, 70094, 70106, 70108, 70108, 70144, 70161, 70163, 70199, 70206, 70209, 70272, 70278, 70280, 70280, 70282, 70285, 70287, 70301, 70303, 70312, 70320, 70378, 70384, 70393, 70400, 70403, 70405, 70412, 70415, 70416, 70419, 70440, 70442, 70448, 70450, 70451, 70453, 70457, 70459, 70468, 70471, 70472, 70475, 70477, 70480, 70480, 70487, 70487, 70493, 70499, 70502, 70508, 70512, 70516, 70656, 70730, 70736, 70745, 70750, 70753, 70784, 70853, 70855, 70855, 70864, 70873, 71040, 71093, 71096, 71104, 71128, 71133, 71168, 71232, 71236, 71236, 71248, 71257, 71296, 71352, 71360, 71369, 71424, 71450, 71453, 71467, 71472, 71481, 71488, 71494, 71680, 71738, 71840, 71913, 71935, 71942, 71945, 71945, 71948, 71955, 71957, 71958, 71960, 71989, 71991, 71992, 71995, 72003, 72016, 72025, 72096, 72103, 72106, 72151, 72154, 72161, 72163, 72164, 72192, 72254, 72263, 72263, 72272, 72345, 72349, 72349, 72368, 72440, 72704, 72712, 72714, 72758, 72760, 72768, 72784, 72793, 72818, 72847, 72850, 72871, 72873, 72886, 72960, 72966, 72968, 72969, 72971, 73014, 73018, 73018, 73020, 73021, 73023, 73031, 73040, 73049, 73056, 73061, 73063, 73064, 73066, 73102, 73104, 73105, 73107, 73112, 73120, 73129, 73440, 73462, 73472, 73488, 73490, 73530, 73534, 73538, 73552, 73561, 73648, 73648, 73728, 74649, 74752, 74862, 74880, 75075, 77712, 77808, 77824, 78895, 78912, 78933, 82944, 83526, 92160, 92728, 92736, 92766, 92768, 92777, 92784, 92862, 92864, 92873, 92880, 92909, 92912, 92916, 92928, 92982, 92992, 92995, 93008, 93017, 93027, 93047, 93053, 93071, 93760, 93823, 93952, 94026, 94031, 94087, 94095, 94111, 94176, 94177, 94179, 94180, 94192, 94193, 94208, 100343, 100352, 101589, 101632, 101640, 110576, 110579, 110581, 110587, 110589, 110590, 110592, 110882, 110898, 110898, 110928, 110930, 110933, 110933, 110948, 110951, 110960, 111355, 113664, 113770, 113776, 113788, 113792, 113800, 113808, 113817, 113821, 113822, 118528, 118573, 118576, 118598, 119141, 119145, 119149, 119154, 119163, 119170, 119173, 119179, 119210, 119213, 119362, 119364, 119808, 119892, 119894, 119964, 119966, 119967, 119970, 119970, 119973, 119974, 119977, 119980, 119982, 119993, 119995, 119995, 119997, 120003, 120005, 120069, 120071, 120074, 120077, 120084, 120086, 120092, 120094, 120121, 120123, 120126, 120128, 120132, 120134, 120134, 120138, 120144, 120146, 120485, 120488, 120512, 120514, 120538, 120540, 120570, 120572, 120596, 120598, 120628, 120630, 120654, 120656, 120686, 120688, 120712, 120714, 120744, 120746, 120770, 120772, 120779, 120782, 120831, 121344, 121398, 121403, 121452, 121461, 121461, 121476, 121476, 121499, 121503, 121505, 121519, 122624, 122654, 122661, 122666, 122880, 122886, 122888, 122904, 122907, 122913, 122915, 122916, 122918, 122922, 122928, 122989, 123023, 123023, 123136, 123180, 123184, 123197, 123200, 123209, 123214, 123214, 123536, 123566, 123584, 123641, 124112, 124153, 124896, 124902, 124904, 124907, 124909, 124910, 124912, 124926, 124928, 125124, 125136, 125142, 125184, 125259, 125264, 125273, 126464, 126467, 126469, 126495, 126497, 126498, 126500, 126500, 126503, 126503, 126505, 126514, 126516, 126519, 126521, 126521, 126523, 126523, 126530, 126530, 126535, 126535, 126537, 126537, 126539, 126539, 126541, 126543, 126545, 126546, 126548, 126548, 126551, 126551, 126553, 126553, 126555, 126555, 126557, 126557, 126559, 126559, 126561, 126562, 126564, 126564, 126567, 126570, 126572, 126578, 126580, 126583, 126585, 126588, 126590, 126590, 126592, 126601, 126603, 126619, 126625, 126627, 126629, 126633, 126635, 126651, 130032, 130041, 131072, 173791, 173824, 177977, 177984, 178205, 178208, 183969, 183984, 191456, 191472, 192093, 194560, 195101, 196608, 201546, 201552, 205743, 917760, 917999}
 * )
 */
export const unicodeESNextIdentifierStart: GoSlice<GoRune> = [
  65, 90, 97, 122, 170, 170, 181, 181, 186, 186, 192, 214, 216, 246, 248, 705, 710, 721, 736, 740, 748, 748, 750, 750, 880, 884, 886, 887, 890, 893, 895, 895, 902, 902, 904, 906, 908, 908, 910, 929, 931, 1013, 1015, 1153, 1162, 1327, 1329, 1366, 1369, 1369, 1376, 1416, 1488, 1514, 1519, 1522, 1568, 1610, 1646, 1647, 1649, 1747, 1749, 1749, 1765, 1766, 1774, 1775, 1786, 1788, 1791, 1791, 1808, 1808, 1810, 1839, 1869, 1957, 1969, 1969, 1994, 2026, 2036, 2037, 2042, 2042, 2048, 2069, 2074, 2074, 2084, 2084, 2088, 2088, 2112, 2136, 2144, 2154, 2160, 2183, 2185, 2190, 2208, 2249, 2308, 2361, 2365, 2365, 2384, 2384, 2392, 2401, 2417, 2432, 2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482, 2486, 2489, 2493, 2493, 2510, 2510, 2524, 2525, 2527, 2529, 2544, 2545, 2556, 2556, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608, 2610, 2611, 2613, 2614, 2616, 2617, 2649, 2652, 2654, 2654, 2674, 2676, 2693, 2701, 2703, 2705, 2707, 2728, 2730, 2736, 2738, 2739, 2741, 2745, 2749, 2749, 2768, 2768, 2784, 2785, 2809, 2809, 2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867, 2869, 2873, 2877, 2877, 2908, 2909, 2911, 2913, 2929, 2929, 2947, 2947, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970, 2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 3001, 3024, 3024, 3077, 3084, 3086, 3088, 3090, 3112, 3114, 3129, 3133, 3133, 3160, 3162, 3165, 3165, 3168, 3169, 3200, 3200, 3205, 3212, 3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3261, 3261, 3293, 3294, 3296, 3297, 3313, 3314, 3332, 3340, 3342, 3344, 3346, 3386, 3389, 3389, 3406, 3406, 3412, 3414, 3423, 3425, 3450, 3455, 3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526, 3585, 3632, 3634, 3635, 3648, 3654, 3713, 3714, 3716, 3716, 3718, 3722, 3724, 3747, 3749, 3749, 3751, 3760, 3762, 3763, 3773, 3773, 3776, 3780, 3782, 3782, 3804, 3807, 3840, 3840, 3904, 3911, 3913, 3948, 3976, 3980, 4096, 4138, 4159, 4159, 4176, 4181, 4186, 4189, 4193, 4193, 4197, 4198, 4206, 4208, 4213, 4225, 4238, 4238, 4256, 4293, 4295, 4295, 4301, 4301, 4304, 4346, 4348, 4680, 4682, 4685, 4688, 4694, 4696, 4696, 4698, 4701, 4704, 4744, 4746, 4749, 4752, 4784, 4786, 4789, 4792, 4798, 4800, 4800, 4802, 4805, 4808, 4822, 4824, 4880, 4882, 4885, 4888, 4954, 4992, 5007, 5024, 5109, 5112, 5117, 5121, 5740, 5743, 5759, 5761, 5786, 5792, 5866, 5870, 5880, 5888, 5905, 5919, 5937, 5952, 5969, 5984, 5996, 5998, 6000, 6016, 6067, 6103, 6103, 6108, 6108, 6176, 6264, 6272, 6312, 6314, 6314, 6320, 6389, 6400, 6430, 6480, 6509, 6512, 6516, 6528, 6571, 6576, 6601, 6656, 6678, 6688, 6740, 6823, 6823, 6917, 6963, 6981, 6988, 7043, 7072, 7086, 7087, 7098, 7141, 7168, 7203, 7245, 7247, 7258, 7293, 7296, 7304, 7312, 7354, 7357, 7359, 7401, 7404, 7406, 7411, 7413, 7414, 7418, 7418, 7424, 7615, 7680, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061, 8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140, 8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188, 8305, 8305, 8319, 8319, 8336, 8348, 8450, 8450, 8455, 8455, 8458, 8467, 8469, 8469, 8472, 8477, 8484, 8484, 8486, 8486, 8488, 8488, 8490, 8505, 8508, 8511, 8517, 8521, 8526, 8526, 8544, 8584, 11264, 11492, 11499, 11502, 11506, 11507, 11520, 11557, 11559, 11559, 11565, 11565, 11568, 11623, 11631, 11631, 11648, 11670, 11680, 11686, 11688, 11694, 11696, 11702, 11704, 11710, 11712, 11718, 11720, 11726, 11728, 11734, 11736, 11742, 12293, 12295, 12321, 12329, 12337, 12341, 12344, 12348, 12353, 12438, 12443, 12447, 12449, 12538, 12540, 12543, 12549, 12591, 12593, 12686, 12704, 12735, 12784, 12799, 13312, 19903, 19968, 42124, 42192, 42237, 42240, 42508, 42512, 42527, 42538, 42539, 42560, 42606, 42623, 42653, 42656, 42735, 42775, 42783, 42786, 42888, 42891, 42954, 42960, 42961, 42963, 42963, 42965, 42969, 42994, 43009, 43011, 43013, 43015, 43018, 43020, 43042, 43072, 43123, 43138, 43187, 43250, 43255, 43259, 43259, 43261, 43262, 43274, 43301, 43312, 43334, 43360, 43388, 43396, 43442, 43471, 43471, 43488, 43492, 43494, 43503, 43514, 43518, 43520, 43560, 43584, 43586, 43588, 43595, 43616, 43638, 43642, 43642, 43646, 43695, 43697, 43697, 43701, 43702, 43705, 43709, 43712, 43712, 43714, 43714, 43739, 43741, 43744, 43754, 43762, 43764, 43777, 43782, 43785, 43790, 43793, 43798, 43808, 43814, 43816, 43822, 43824, 43866, 43868, 43881, 43888, 44002, 44032, 55203, 55216, 55238, 55243, 55291, 63744, 64109, 64112, 64217, 64256, 64262, 64275, 64279, 64285, 64285, 64287, 64296, 64298, 64310, 64312, 64316, 64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433, 64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019, 65136, 65140, 65142, 65276, 65313, 65338, 65345, 65370, 65382, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500, 65536, 65547, 65549, 65574, 65576, 65594, 65596, 65597, 65599, 65613, 65616, 65629, 65664, 65786, 65856, 65908, 66176, 66204, 66208, 66256, 66304, 66335, 66349, 66378, 66384, 66421, 66432, 66461, 66464, 66499, 66504, 66511, 66513, 66517, 66560, 66717, 66736, 66771, 66776, 66811, 66816, 66855, 66864, 66915, 66928, 66938, 66940, 66954, 66956, 66962, 66964, 66965, 66967, 66977, 66979, 66993, 66995, 67001, 67003, 67004, 67072, 67382, 67392, 67413, 67424, 67431, 67456, 67461, 67463, 67504, 67506, 67514, 67584, 67589, 67592, 67592, 67594, 67637, 67639, 67640, 67644, 67644, 67647, 67669, 67680, 67702, 67712, 67742, 67808, 67826, 67828, 67829, 67840, 67861, 67872, 67897, 67968, 68023, 68030, 68031, 68096, 68096, 68112, 68115, 68117, 68119, 68121, 68149, 68192, 68220, 68224, 68252, 68288, 68295, 68297, 68324, 68352, 68405, 68416, 68437, 68448, 68466, 68480, 68497, 68608, 68680, 68736, 68786, 68800, 68850, 68864, 68899, 69248, 69289, 69296, 69297, 69376, 69404, 69415, 69415, 69424, 69445, 69488, 69505, 69552, 69572, 69600, 69622, 69635, 69687, 69745, 69746, 69749, 69749, 69763, 69807, 69840, 69864, 69891, 69926, 69956, 69956, 69959, 69959, 69968, 70002, 70006, 70006, 70019, 70066, 70081, 70084, 70106, 70106, 70108, 70108, 70144, 70161, 70163, 70187, 70207, 70208, 70272, 70278, 70280, 70280, 70282, 70285, 70287, 70301, 70303, 70312, 70320, 70366, 70405, 70412, 70415, 70416, 70419, 70440, 70442, 70448, 70450, 70451, 70453, 70457, 70461, 70461, 70480, 70480, 70493, 70497, 70656, 70708, 70727, 70730, 70751, 70753, 70784, 70831, 70852, 70853, 70855, 70855, 71040, 71086, 71128, 71131, 71168, 71215, 71236, 71236, 71296, 71338, 71352, 71352, 71424, 71450, 71488, 71494, 71680, 71723, 71840, 71903, 71935, 71942, 71945, 71945, 71948, 71955, 71957, 71958, 71960, 71983, 71999, 71999, 72001, 72001, 72096, 72103, 72106, 72144, 72161, 72161, 72163, 72163, 72192, 72192, 72203, 72242, 72250, 72250, 72272, 72272, 72284, 72329, 72349, 72349, 72368, 72440, 72704, 72712, 72714, 72750, 72768, 72768, 72818, 72847, 72960, 72966, 72968, 72969, 72971, 73008, 73030, 73030, 73056, 73061, 73063, 73064, 73066, 73097, 73112, 73112, 73440, 73458, 73474, 73474, 73476, 73488, 73490, 73523, 73648, 73648, 73728, 74649, 74752, 74862, 74880, 75075, 77712, 77808, 77824, 78895, 78913, 78918, 82944, 83526, 92160, 92728, 92736, 92766, 92784, 92862, 92880, 92909, 92928, 92975, 92992, 92995, 93027, 93047, 93053, 93071, 93760, 93823, 93952, 94026, 94032, 94032, 94099, 94111, 94176, 94177, 94179, 94179, 94208, 100343, 100352, 101589, 101632, 101640, 110576, 110579, 110581, 110587, 110589, 110590, 110592, 110882, 110898, 110898, 110928, 110930, 110933, 110933, 110948, 110951, 110960, 111355, 113664, 113770, 113776, 113788, 113792, 113800, 113808, 113817, 119808, 119892, 119894, 119964, 119966, 119967, 119970, 119970, 119973, 119974, 119977, 119980, 119982, 119993, 119995, 119995, 119997, 120003, 120005, 120069, 120071, 120074, 120077, 120084, 120086, 120092, 120094, 120121, 120123, 120126, 120128, 120132, 120134, 120134, 120138, 120144, 120146, 120485, 120488, 120512, 120514, 120538, 120540, 120570, 120572, 120596, 120598, 120628, 120630, 120654, 120656, 120686, 120688, 120712, 120714, 120744, 120746, 120770, 120772, 120779, 122624, 122654, 122661, 122666, 122928, 122989, 123136, 123180, 123191, 123197, 123214, 123214, 123536, 123565, 123584, 123627, 124112, 124139, 124896, 124902, 124904, 124907, 124909, 124910, 124912, 124926, 124928, 125124, 125184, 125251, 125259, 125259, 126464, 126467, 126469, 126495, 126497, 126498, 126500, 126500, 126503, 126503, 126505, 126514, 126516, 126519, 126521, 126521, 126523, 126523, 126530, 126530, 126535, 126535, 126537, 126537, 126539, 126539, 126541, 126543, 126545, 126546, 126548, 126548, 126551, 126551, 126553, 126553, 126555, 126555, 126557, 126557, 126559, 126559, 126561, 126562, 126564, 126564, 126567, 126570, 126572, 126578, 126580, 126583, 126585, 126588, 126590, 126590, 126592, 126601, 126603, 126619, 126625, 126627, 126629, 126633, 126635, 126651, 131072, 173791, 173824, 177977, 177984, 178205, 178208, 183969, 183984, 191456, 191472, 192093, 194560, 195101, 196608, 201546, 201552, 205743,
];
export const unicodeESNextIdentifierPart: GoSlice<GoRune> = [
  48, 57, 65, 90, 95, 95, 97, 122, 170, 170, 181, 181, 183, 183, 186, 186, 192, 214, 216, 246, 248, 705, 710, 721, 736, 740, 748, 748, 750, 750, 768, 884, 886, 887, 890, 893, 895, 895, 902, 906, 908, 908, 910, 929, 931, 1013, 1015, 1153, 1155, 1159, 1162, 1327, 1329, 1366, 1369, 1369, 1376, 1416, 1425, 1469, 1471, 1471, 1473, 1474, 1476, 1477, 1479, 1479, 1488, 1514, 1519, 1522, 1552, 1562, 1568, 1641, 1646, 1747, 1749, 1756, 1759, 1768, 1770, 1788, 1791, 1791, 1808, 1866, 1869, 1969, 1984, 2037, 2042, 2042, 2045, 2045, 2048, 2093, 2112, 2139, 2144, 2154, 2160, 2183, 2185, 2190, 2200, 2273, 2275, 2403, 2406, 2415, 2417, 2435, 2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482, 2486, 2489, 2492, 2500, 2503, 2504, 2507, 2510, 2519, 2519, 2524, 2525, 2527, 2531, 2534, 2545, 2556, 2556, 2558, 2558, 2561, 2563, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608, 2610, 2611, 2613, 2614, 2616, 2617, 2620, 2620, 2622, 2626, 2631, 2632, 2635, 2637, 2641, 2641, 2649, 2652, 2654, 2654, 2662, 2677, 2689, 2691, 2693, 2701, 2703, 2705, 2707, 2728, 2730, 2736, 2738, 2739, 2741, 2745, 2748, 2757, 2759, 2761, 2763, 2765, 2768, 2768, 2784, 2787, 2790, 2799, 2809, 2815, 2817, 2819, 2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867, 2869, 2873, 2876, 2884, 2887, 2888, 2891, 2893, 2901, 2903, 2908, 2909, 2911, 2915, 2918, 2927, 2929, 2929, 2946, 2947, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970, 2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 3001, 3006, 3010, 3014, 3016, 3018, 3021, 3024, 3024, 3031, 3031, 3046, 3055, 3072, 3084, 3086, 3088, 3090, 3112, 3114, 3129, 3132, 3140, 3142, 3144, 3146, 3149, 3157, 3158, 3160, 3162, 3165, 3165, 3168, 3171, 3174, 3183, 3200, 3203, 3205, 3212, 3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3260, 3268, 3270, 3272, 3274, 3277, 3285, 3286, 3293, 3294, 3296, 3299, 3302, 3311, 3313, 3315, 3328, 3340, 3342, 3344, 3346, 3396, 3398, 3400, 3402, 3406, 3412, 3415, 3423, 3427, 3430, 3439, 3450, 3455, 3457, 3459, 3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526, 3530, 3530, 3535, 3540, 3542, 3542, 3544, 3551, 3558, 3567, 3570, 3571, 3585, 3642, 3648, 3662, 3664, 3673, 3713, 3714, 3716, 3716, 3718, 3722, 3724, 3747, 3749, 3749, 3751, 3773, 3776, 3780, 3782, 3782, 3784, 3790, 3792, 3801, 3804, 3807, 3840, 3840, 3864, 3865, 3872, 3881, 3893, 3893, 3895, 3895, 3897, 3897, 3902, 3911, 3913, 3948, 3953, 3972, 3974, 3991, 3993, 4028, 4038, 4038, 4096, 4169, 4176, 4253, 4256, 4293, 4295, 4295, 4301, 4301, 4304, 4346, 4348, 4680, 4682, 4685, 4688, 4694, 4696, 4696, 4698, 4701, 4704, 4744, 4746, 4749, 4752, 4784, 4786, 4789, 4792, 4798, 4800, 4800, 4802, 4805, 4808, 4822, 4824, 4880, 4882, 4885, 4888, 4954, 4957, 4959, 4969, 4977, 4992, 5007, 5024, 5109, 5112, 5117, 5121, 5740, 5743, 5759, 5761, 5786, 5792, 5866, 5870, 5880, 5888, 5909, 5919, 5940, 5952, 5971, 5984, 5996, 5998, 6000, 6002, 6003, 6016, 6099, 6103, 6103, 6108, 6109, 6112, 6121, 6155, 6157, 6159, 6169, 6176, 6264, 6272, 6314, 6320, 6389, 6400, 6430, 6432, 6443, 6448, 6459, 6470, 6509, 6512, 6516, 6528, 6571, 6576, 6601, 6608, 6618, 6656, 6683, 6688, 6750, 6752, 6780, 6783, 6793, 6800, 6809, 6823, 6823, 6832, 6845, 6847, 6862, 6912, 6988, 6992, 7001, 7019, 7027, 7040, 7155, 7168, 7223, 7232, 7241, 7245, 7293, 7296, 7304, 7312, 7354, 7357, 7359, 7376, 7378, 7380, 7418, 7424, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061, 8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140, 8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188, 8204, 8205, 8255, 8256, 8276, 8276, 8305, 8305, 8319, 8319, 8336, 8348, 8400, 8412, 8417, 8417, 8421, 8432, 8450, 8450, 8455, 8455, 8458, 8467, 8469, 8469, 8472, 8477, 8484, 8484, 8486, 8486, 8488, 8488, 8490, 8505, 8508, 8511, 8517, 8521, 8526, 8526, 8544, 8584, 11264, 11492, 11499, 11507, 11520, 11557, 11559, 11559, 11565, 11565, 11568, 11623, 11631, 11631, 11647, 11670, 11680, 11686, 11688, 11694, 11696, 11702, 11704, 11710, 11712, 11718, 11720, 11726, 11728, 11734, 11736, 11742, 11744, 11775, 12293, 12295, 12321, 12335, 12337, 12341, 12344, 12348, 12353, 12438, 12441, 12447, 12449, 12543, 12549, 12591, 12593, 12686, 12704, 12735, 12784, 12799, 13312, 19903, 19968, 42124, 42192, 42237, 42240, 42508, 42512, 42539, 42560, 42607, 42612, 42621, 42623, 42737, 42775, 42783, 42786, 42888, 42891, 42954, 42960, 42961, 42963, 42963, 42965, 42969, 42994, 43047, 43052, 43052, 43072, 43123, 43136, 43205, 43216, 43225, 43232, 43255, 43259, 43259, 43261, 43309, 43312, 43347, 43360, 43388, 43392, 43456, 43471, 43481, 43488, 43518, 43520, 43574, 43584, 43597, 43600, 43609, 43616, 43638, 43642, 43714, 43739, 43741, 43744, 43759, 43762, 43766, 43777, 43782, 43785, 43790, 43793, 43798, 43808, 43814, 43816, 43822, 43824, 43866, 43868, 43881, 43888, 44010, 44012, 44013, 44016, 44025, 44032, 55203, 55216, 55238, 55243, 55291, 63744, 64109, 64112, 64217, 64256, 64262, 64275, 64279, 64285, 64296, 64298, 64310, 64312, 64316, 64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433, 64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019, 65024, 65039, 65056, 65071, 65075, 65076, 65101, 65103, 65136, 65140, 65142, 65276, 65296, 65305, 65313, 65338, 65343, 65343, 65345, 65370, 65381, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500, 65536, 65547, 65549, 65574, 65576, 65594, 65596, 65597, 65599, 65613, 65616, 65629, 65664, 65786, 65856, 65908, 66045, 66045, 66176, 66204, 66208, 66256, 66272, 66272, 66304, 66335, 66349, 66378, 66384, 66426, 66432, 66461, 66464, 66499, 66504, 66511, 66513, 66517, 66560, 66717, 66720, 66729, 66736, 66771, 66776, 66811, 66816, 66855, 66864, 66915, 66928, 66938, 66940, 66954, 66956, 66962, 66964, 66965, 66967, 66977, 66979, 66993, 66995, 67001, 67003, 67004, 67072, 67382, 67392, 67413, 67424, 67431, 67456, 67461, 67463, 67504, 67506, 67514, 67584, 67589, 67592, 67592, 67594, 67637, 67639, 67640, 67644, 67644, 67647, 67669, 67680, 67702, 67712, 67742, 67808, 67826, 67828, 67829, 67840, 67861, 67872, 67897, 67968, 68023, 68030, 68031, 68096, 68099, 68101, 68102, 68108, 68115, 68117, 68119, 68121, 68149, 68152, 68154, 68159, 68159, 68192, 68220, 68224, 68252, 68288, 68295, 68297, 68326, 68352, 68405, 68416, 68437, 68448, 68466, 68480, 68497, 68608, 68680, 68736, 68786, 68800, 68850, 68864, 68903, 68912, 68921, 69248, 69289, 69291, 69292, 69296, 69297, 69373, 69404, 69415, 69415, 69424, 69456, 69488, 69509, 69552, 69572, 69600, 69622, 69632, 69702, 69734, 69749, 69759, 69818, 69826, 69826, 69840, 69864, 69872, 69881, 69888, 69940, 69942, 69951, 69956, 69959, 69968, 70003, 70006, 70006, 70016, 70084, 70089, 70092, 70094, 70106, 70108, 70108, 70144, 70161, 70163, 70199, 70206, 70209, 70272, 70278, 70280, 70280, 70282, 70285, 70287, 70301, 70303, 70312, 70320, 70378, 70384, 70393, 70400, 70403, 70405, 70412, 70415, 70416, 70419, 70440, 70442, 70448, 70450, 70451, 70453, 70457, 70459, 70468, 70471, 70472, 70475, 70477, 70480, 70480, 70487, 70487, 70493, 70499, 70502, 70508, 70512, 70516, 70656, 70730, 70736, 70745, 70750, 70753, 70784, 70853, 70855, 70855, 70864, 70873, 71040, 71093, 71096, 71104, 71128, 71133, 71168, 71232, 71236, 71236, 71248, 71257, 71296, 71352, 71360, 71369, 71424, 71450, 71453, 71467, 71472, 71481, 71488, 71494, 71680, 71738, 71840, 71913, 71935, 71942, 71945, 71945, 71948, 71955, 71957, 71958, 71960, 71989, 71991, 71992, 71995, 72003, 72016, 72025, 72096, 72103, 72106, 72151, 72154, 72161, 72163, 72164, 72192, 72254, 72263, 72263, 72272, 72345, 72349, 72349, 72368, 72440, 72704, 72712, 72714, 72758, 72760, 72768, 72784, 72793, 72818, 72847, 72850, 72871, 72873, 72886, 72960, 72966, 72968, 72969, 72971, 73014, 73018, 73018, 73020, 73021, 73023, 73031, 73040, 73049, 73056, 73061, 73063, 73064, 73066, 73102, 73104, 73105, 73107, 73112, 73120, 73129, 73440, 73462, 73472, 73488, 73490, 73530, 73534, 73538, 73552, 73561, 73648, 73648, 73728, 74649, 74752, 74862, 74880, 75075, 77712, 77808, 77824, 78895, 78912, 78933, 82944, 83526, 92160, 92728, 92736, 92766, 92768, 92777, 92784, 92862, 92864, 92873, 92880, 92909, 92912, 92916, 92928, 92982, 92992, 92995, 93008, 93017, 93027, 93047, 93053, 93071, 93760, 93823, 93952, 94026, 94031, 94087, 94095, 94111, 94176, 94177, 94179, 94180, 94192, 94193, 94208, 100343, 100352, 101589, 101632, 101640, 110576, 110579, 110581, 110587, 110589, 110590, 110592, 110882, 110898, 110898, 110928, 110930, 110933, 110933, 110948, 110951, 110960, 111355, 113664, 113770, 113776, 113788, 113792, 113800, 113808, 113817, 113821, 113822, 118528, 118573, 118576, 118598, 119141, 119145, 119149, 119154, 119163, 119170, 119173, 119179, 119210, 119213, 119362, 119364, 119808, 119892, 119894, 119964, 119966, 119967, 119970, 119970, 119973, 119974, 119977, 119980, 119982, 119993, 119995, 119995, 119997, 120003, 120005, 120069, 120071, 120074, 120077, 120084, 120086, 120092, 120094, 120121, 120123, 120126, 120128, 120132, 120134, 120134, 120138, 120144, 120146, 120485, 120488, 120512, 120514, 120538, 120540, 120570, 120572, 120596, 120598, 120628, 120630, 120654, 120656, 120686, 120688, 120712, 120714, 120744, 120746, 120770, 120772, 120779, 120782, 120831, 121344, 121398, 121403, 121452, 121461, 121461, 121476, 121476, 121499, 121503, 121505, 121519, 122624, 122654, 122661, 122666, 122880, 122886, 122888, 122904, 122907, 122913, 122915, 122916, 122918, 122922, 122928, 122989, 123023, 123023, 123136, 123180, 123184, 123197, 123200, 123209, 123214, 123214, 123536, 123566, 123584, 123641, 124112, 124153, 124896, 124902, 124904, 124907, 124909, 124910, 124912, 124926, 124928, 125124, 125136, 125142, 125184, 125259, 125264, 125273, 126464, 126467, 126469, 126495, 126497, 126498, 126500, 126500, 126503, 126503, 126505, 126514, 126516, 126519, 126521, 126521, 126523, 126523, 126530, 126530, 126535, 126535, 126537, 126537, 126539, 126539, 126541, 126543, 126545, 126546, 126548, 126548, 126551, 126551, 126553, 126553, 126555, 126555, 126557, 126557, 126559, 126559, 126561, 126562, 126564, 126564, 126567, 126570, 126572, 126578, 126580, 126583, 126585, 126588, 126590, 126590, 126592, 126601, 126603, 126619, 126625, 126627, 126629, 126633, 126635, 126651, 130032, 130041, 131072, 173791, 173824, 177977, 177984, 178205, 178208, 183969, 183984, 191456, 191472, 192093, 194560, 195101, 196608, 201546, 201552, 205743, 917760, 917999,
];

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::type::ScannerState","kind":"type","status":"implemented","sigHash":"5a6d7a1b33afe89cf08d37854b783f21a9d22902036c0d5dff41054116c01c93","bodyHash":"6a02a4f43a82bf9d2971e2b646a0e3e98084f73f3181693c65c1f5dde6ea669c"}
 *
 * Go source:
 * ScannerState struct {
 * 	pos                       int            // Current position in text (and ending position of current token)
 * 	fullStartPos              int            // Starting position of current token including preceding whitespace
 * 	tokenStart                int            // Starting position of non-whitespace part of current token
 * 	token                     ast.Kind       // Kind of current token
 * 	tokenValue                string         // Parsed value of current token
 * 	tokenFlags                ast.TokenFlags // Flags for current token
 * 	commentDirectives         []ast.CommentDirective
 * 	skipJSDocLeadingAsterisks int // Leading asterisks to skip when scanning types inside JSDoc. Should be 0 outside JSDoc
 * }
 */
export interface ScannerState {
  pos: int;
  fullStartPos: int;
  tokenStart: int;
  token: Kind;
  tokenValue: string;
  tokenFlags: TokenFlags_4c7e9c27;
  commentDirectives: GoSlice<CommentDirective>;
  skipJSDocLeadingAsterisks: int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::type::Scanner","kind":"type","status":"implemented","sigHash":"9f0b7073bc0be77a5365f2b16cac66b6b860e1e1c00db26a05eef18bc7028a1b","bodyHash":"fa2395147c39a85112b471d4e2826f03161db93c99a6f2e9bef286b7184e4a9d"}
 *
 * Go source:
 * Scanner struct {
 * 	text            string
 * 	end             int
 * 	languageVariant core.LanguageVariant
 * 	scriptTarget    core.ScriptTarget
 * 	onError         ErrorCallback
 * 	skipTrivia      bool
 * 	ScannerState
 * 
 * 	containsNonASCII bool
 * 	numberCache      map[string]string
 * 	hexNumberCache   map[string]string
 * 	hexDigitCache    map[string]string
 * }
 */
export interface Scanner {
  text: string;
  end: int;
  languageVariant: LanguageVariant;
  scriptTarget: ScriptTarget;
  onError: ErrorCallback;
  skipTrivia: bool;
  __tsgoEmbedded0: ScannerState;
  containsNonASCII: bool;
  numberCache: GoMap<string, string>;
  hexNumberCache: GoMap<string, string>;
  hexDigitCache: GoMap<string, string>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::defaultScanner","kind":"func","status":"implemented","sigHash":"dc520b43edcfb4fa19b84a67ae3ac9213384fa5a843b109459810bd8dd3d5bb6","bodyHash":"2e15eefec61dfa69544b74ba92f9bbfc0a2ace53846cb08276dc28fe8311fa7c"}
 *
 * Go source:
 * func defaultScanner() Scanner {
 * 	// Using a function rather than a global is intentional; this function is
 * 	// inlined as pure code (zeroing + moves), whereas a global requires write
 * 	// barriers since the memory is mutable.
 * 	return Scanner{skipTrivia: true}
 * }
 */
export function defaultScanner(): Scanner {
  // Using a function rather than a global is intentional; this function is
  // inlined as pure code (zeroing + moves), whereas a global requires write
  // barriers since the memory is mutable.
  return {
    text: "",
    end: 0,
    languageVariant: LanguageVariantStandard,
    scriptTarget: ScriptTargetNone,
    onError: undefined as unknown as ErrorCallback,
    skipTrivia: true,
    __tsgoEmbedded0: newScannerState(),
    containsNonASCII: false,
    numberCache: undefined as unknown as GoMap<string, string>,
    hexNumberCache: undefined as unknown as GoMap<string, string>,
    hexDigitCache: undefined as unknown as GoMap<string, string>,
  };
}

// newScannerState reproduces Go's zero-valued ScannerState struct.
function newScannerState(): ScannerState {
  return {
    pos: 0,
    fullStartPos: 0,
    tokenStart: 0,
    token: KindUnknown,
    tokenValue: "",
    tokenFlags: TokenFlagsNone,
    commentDirectives: [],
    skipJSDocLeadingAsterisks: 0,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::NewScanner","kind":"func","status":"implemented","sigHash":"824b1c9d119d384513dbe8e8500292ae2b0912e2e0124cfaf3d35b98c8f0cc98","bodyHash":"b29c1c3cb784062067e024e16fe037df35c271d0c93d52216a840ff293e52d7a"}
 *
 * Go source:
 * func NewScanner() *Scanner {
 * 	s := defaultScanner()
 * 	return &s
 * }
 */
export function NewScanner(): GoPtr<Scanner> {
  const s = defaultScanner();
  return s;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.Reset","kind":"method","status":"implemented","sigHash":"81860126af7e9c4c3c1d20c1029c54c99c301e87d978c5bec8e14b1fe7606692","bodyHash":"8c3d03f7f94175f228f39c4a2cb37fff21f92508e0316b2e73711854e57deaa6"}
 *
 * Go source:
 * func (s *Scanner) Reset() {
 * 	numberCache := cleared(s.numberCache)
 * 	hexNumberCache := cleared(s.hexNumberCache)
 * 	hexDigitCache := cleared(s.hexDigitCache)
 * 	*s = defaultScanner()
 * 	s.numberCache = numberCache
 * 	s.hexNumberCache = hexNumberCache
 * 	s.hexDigitCache = hexDigitCache
 * }
 */
export function Scanner_Reset(receiver: GoPtr<Scanner>): void {
  const s = receiver!;
  const numberCache = cleared(s.numberCache);
  const hexNumberCache = cleared(s.hexNumberCache);
  const hexDigitCache = cleared(s.hexDigitCache);
  // *s = defaultScanner(): replace every field in place to mirror the Go
  // whole-struct assignment without rebinding the receiver reference.
  const d = defaultScanner();
  s.text = d.text;
  s.end = d.end;
  s.languageVariant = d.languageVariant;
  s.scriptTarget = d.scriptTarget;
  s.onError = d.onError;
  s.skipTrivia = d.skipTrivia;
  s.__tsgoEmbedded0 = d.__tsgoEmbedded0;
  s.containsNonASCII = d.containsNonASCII;
  s.numberCache = numberCache;
  s.hexNumberCache = hexNumberCache;
  s.hexDigitCache = hexDigitCache;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::cleared","kind":"func","status":"implemented","sigHash":"1bbfef56d8cf46b679e2e91d918ef70872a3ec40711d7e517cb02f3d0ac2c96f","bodyHash":"ace5d48e3d2b43b2444e6f6c612d580a68927f07eb3e48b041a49a8126cdaf20"}
 *
 * Go source:
 * func cleared[M ~map[K]V, K comparable, V any](m M) M {
 * 	clear(m)
 * 	return m
 * }
 */
export function cleared<K extends GoComparable, V, M extends GoMap<K, V> | undefined>(m: M): M {
  // Go's clear(nil) is a no-op; mirror that by guarding against the nil map.
  if (m !== undefined) {
    m.clear();
  }
  return m;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.Text","kind":"method","status":"implemented","sigHash":"7a04356c5b198a952bcc4b2cd44f1f25290b6071dfe09eab5b8f6ddc786d8c0a","bodyHash":"0db52043412d99d2fe776ce9cd0dff226125303b5248ff4ce263294ebb444a8e"}
 *
 * Go source:
 * func (s *Scanner) Text() string {
 * 	return s.text
 * }
 */
export function Scanner_Text(receiver: GoPtr<Scanner>): string {
  return receiver!.text;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.Token","kind":"method","status":"implemented","sigHash":"329b864e3dee67eb1fcca8c61564dc3a640ab22e7325fc00a198e81ab68946f4","bodyHash":"ef1a2ab696454d878f4f80c06c1783adf9692e1e34a046ff231b251cd4bf52fc"}
 *
 * Go source:
 * func (s *Scanner) Token() ast.Kind {
 * 	return s.token
 * }
 */
export function Scanner_Token(receiver: GoPtr<Scanner>): Kind {
  return receiver!.__tsgoEmbedded0.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.TokenFlags","kind":"method","status":"implemented","sigHash":"d958025732a7ade0566c5597387342a6716fe320fd6c1f6ebdeaf650bf4ef41b","bodyHash":"345ae5241abe5355a545e6cc72cfffe5a81560a059210dcd1c7722bffb169eed"}
 *
 * Go source:
 * func (s *Scanner) TokenFlags() ast.TokenFlags {
 * 	return s.tokenFlags
 * }
 */
export function Scanner_TokenFlags(receiver: GoPtr<Scanner>): TokenFlags_4c7e9c27 {
  return receiver!.__tsgoEmbedded0.tokenFlags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.TokenFullStart","kind":"method","status":"implemented","sigHash":"7d79759df5df93f37b42202bdd7ee1c8c16bc8ee5a633059cbffa59c1d322fa1","bodyHash":"5e98ab038e14adc612c16b063227b44f7dff8a17044c5b2a0350a528867d89d6"}
 *
 * Go source:
 * func (s *Scanner) TokenFullStart() int {
 * 	return s.fullStartPos
 * }
 */
export function Scanner_TokenFullStart(receiver: GoPtr<Scanner>): int {
  return receiver!.__tsgoEmbedded0.fullStartPos;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.TokenStart","kind":"method","status":"implemented","sigHash":"9e27e4896173256750d66506eba0ae5d52b776ae2bdb3191c76df9e23a9b75f5","bodyHash":"c1f81dadca37007c9b54f96b67055a46ca77435424d093666552e84f729d9ce2"}
 *
 * Go source:
 * func (s *Scanner) TokenStart() int {
 * 	return s.tokenStart
 * }
 */
export function Scanner_TokenStart(receiver: GoPtr<Scanner>): int {
  return receiver!.__tsgoEmbedded0.tokenStart;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.TokenEnd","kind":"method","status":"implemented","sigHash":"f894c4872fe8bc212c65409f3cdb53aa9476894b6854b83307ca6fcf63038143","bodyHash":"f3a1df33f5fac1150eabc66b383aa8aab7a88a44c315da1d5449b463c824d7d7"}
 *
 * Go source:
 * func (s *Scanner) TokenEnd() int {
 * 	return s.pos
 * }
 */
export function Scanner_TokenEnd(receiver: GoPtr<Scanner>): int {
  return receiver!.__tsgoEmbedded0.pos;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.TokenText","kind":"method","status":"implemented","sigHash":"ccfc66dd051d6e9cf4d55f15be6a0271cdeea0c397ebac3160a504fffd8f2f8c","bodyHash":"674c308611e10f1afffacebcf558f312ee8402f6b4aec9f1c55252e92fe0fbae"}
 *
 * Go source:
 * func (s *Scanner) TokenText() string {
 * 	return s.text[s.tokenStart:s.pos]
 * }
 */
export function Scanner_TokenText(receiver: GoPtr<Scanner>): string {
  const s = receiver!;
  return byteSlice(s.text, s.__tsgoEmbedded0.tokenStart, s.__tsgoEmbedded0.pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.TokenValue","kind":"method","status":"implemented","sigHash":"22ef3e4949cd0abc50983e77fc5b8b7821e4c14c0a3b90f8bd4067af43c40f4f","bodyHash":"e34257d6be24f5aa1f92875f646234a2006d0e9b2db8f6350d5c2d663ec131d3"}
 *
 * Go source:
 * func (s *Scanner) TokenValue() string {
 * 	return s.tokenValue
 * }
 */
export function Scanner_TokenValue(receiver: GoPtr<Scanner>): string {
  return receiver!.__tsgoEmbedded0.tokenValue;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.TokenRange","kind":"method","status":"implemented","sigHash":"5846d9e2a986f56a70c871937a8d467b406f6a05dfe0b844d177e955ea5f14f9","bodyHash":"cb0ecfce338a5730f1b445a3a934a07dab73e60d78556e5a2094120c4e0da190"}
 *
 * Go source:
 * func (s *Scanner) TokenRange() core.TextRange {
 * 	return core.NewTextRange(s.tokenStart, s.pos)
 * }
 */
export function Scanner_TokenRange(receiver: GoPtr<Scanner>): TextRange {
  const s = receiver!;
  return NewTextRange(s.__tsgoEmbedded0.tokenStart, s.__tsgoEmbedded0.pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.CommentDirectives","kind":"method","status":"implemented","sigHash":"8bb177e3a622bf30aa8985f59c1c890e83c4a31f1431e05d0d5fcd0a5decd32c","bodyHash":"b4020ed76da9fed40c4ab1ff9ccca8fcdd482829f4916eed4cc49b1e6fac1778"}
 *
 * Go source:
 * func (s *Scanner) CommentDirectives() []ast.CommentDirective {
 * 	return s.commentDirectives
 * }
 */
export function Scanner_CommentDirectives(receiver: GoPtr<Scanner>): GoSlice<CommentDirective> {
  return receiver!.__tsgoEmbedded0.commentDirectives;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.Mark","kind":"method","status":"implemented","sigHash":"bfa17a5c7a0c803fb17cf30ceb243ee8e3f82c5464e2f6483b95a69916cbe9b7","bodyHash":"d9d7447aab40ac0c27e15852ac332c11d726b42592c5e0e17dd1aa66422bf899"}
 *
 * Go source:
 * func (s *Scanner) Mark() ScannerState {
 * 	return s.ScannerState
 * }
 */
export function Scanner_Mark(receiver: GoPtr<Scanner>): ScannerState {
  // Go returns a copy of the embedded ScannerState (value semantics); mirror
  // that with a shallow copy so the caller's snapshot is independent.
  const st = receiver!.__tsgoEmbedded0;
  return {
    pos: st.pos,
    fullStartPos: st.fullStartPos,
    tokenStart: st.tokenStart,
    token: st.token,
    tokenValue: st.tokenValue,
    tokenFlags: st.tokenFlags,
    commentDirectives: st.commentDirectives,
    skipJSDocLeadingAsterisks: st.skipJSDocLeadingAsterisks,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.Rewind","kind":"method","status":"implemented","sigHash":"77e2ac1ac2f64f14a99e68f5148d7a85c4ad48956dcc1ae409555acb66f2a549","bodyHash":"3ba534c3a8d73a6647aed5a34d4eb30dd030b9e9d607eb46bcee2ea896c62ec5"}
 *
 * Go source:
 * func (s *Scanner) Rewind(state ScannerState) {
 * 	s.ScannerState = state
 * }
 */
export function Scanner_Rewind(receiver: GoPtr<Scanner>, state: ScannerState): void {
  // s.ScannerState = state: replace the embedded state fields in place.
  const st = receiver!.__tsgoEmbedded0;
  st.pos = state.pos;
  st.fullStartPos = state.fullStartPos;
  st.tokenStart = state.tokenStart;
  st.token = state.token;
  st.tokenValue = state.tokenValue;
  st.tokenFlags = state.tokenFlags;
  st.commentDirectives = state.commentDirectives;
  st.skipJSDocLeadingAsterisks = state.skipJSDocLeadingAsterisks;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ResetPos","kind":"method","status":"implemented","sigHash":"b5e28b8c9fe788cb27cde990a89a636486b9961927b9503da2618f5be1a6a92b","bodyHash":"f99dc3e5d9adb1afb1e05f6f1c6f20dd3b81d4cd04cd97ed949ae6e7b5d88977"}
 *
 * Go source:
 * func (s *Scanner) ResetPos(pos int) {
 * 	if pos < 0 {
 * 		panic("Cannot reset token state to negative position")
 * 	}
 * 	s.pos = pos
 * 	s.fullStartPos = pos
 * 	s.tokenStart = pos
 * }
 */
export function Scanner_ResetPos(receiver: GoPtr<Scanner>, pos: int): void {
  const st = receiver!.__tsgoEmbedded0;
  if (pos < 0) {
    throw new globalThis.Error("Cannot reset token state to negative position");
  }
  st.pos = pos;
  st.fullStartPos = pos;
  st.tokenStart = pos;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ResetTokenState","kind":"method","status":"implemented","sigHash":"38e040605eacfc1462d6a7340e4f21d0eed1393d704c08e2eb9ef242e525544f","bodyHash":"a177f998203aef101fff593618f06ce04ad0b774d89f0dfad66ca01be494c504"}
 *
 * Go source:
 * func (s *Scanner) ResetTokenState(pos int) {
 * 	s.ResetPos(pos)
 * 	s.token = ast.KindUnknown
 * 	s.tokenValue = ""
 * 	s.tokenFlags = ast.TokenFlagsNone
 * }
 */
export function Scanner_ResetTokenState(receiver: GoPtr<Scanner>, pos: int): void {
  const s = receiver!;
  Scanner_ResetPos(s, pos);
  s.__tsgoEmbedded0.token = KindUnknown;
  s.__tsgoEmbedded0.tokenValue = "";
  s.__tsgoEmbedded0.tokenFlags = TokenFlagsNone;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.SetSkipJSDocLeadingAsterisks","kind":"method","status":"implemented","sigHash":"cf226a2e45752b631ff0153462a3ce7cbb4362920679a29e386ef36f456a5dd9","bodyHash":"217ceb0b0d9a261ef8075a65171c2f08dbba9759086a1beb6fd965d405c1a559"}
 *
 * Go source:
 * func (scanner *Scanner) SetSkipJSDocLeadingAsterisks(skip bool) {
 * 	if skip {
 * 		scanner.skipJSDocLeadingAsterisks += 1
 * 	} else {
 * 		scanner.skipJSDocLeadingAsterisks += -1
 * 	}
 * }
 */
export function Scanner_SetSkipJSDocLeadingAsterisks(receiver: GoPtr<Scanner>, skip: bool): void {
  const scanner = receiver!;
  if (skip) {
    scanner.__tsgoEmbedded0.skipJSDocLeadingAsterisks += 1;
  } else {
    scanner.__tsgoEmbedded0.skipJSDocLeadingAsterisks += -1;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.SetSkipTrivia","kind":"method","status":"implemented","sigHash":"370f0069c53ca628b07503812c5084d7d9308a0bac141190d68535e6efdd3fc0","bodyHash":"0e350d937d15c613811778d1870840ebc3c2dc5f5be85be3d2660fef7305360f"}
 *
 * Go source:
 * func (scanner *Scanner) SetSkipTrivia(skip bool) {
 * 	scanner.skipTrivia = skip
 * }
 */
export function Scanner_SetSkipTrivia(receiver: GoPtr<Scanner>, skip: bool): void {
  receiver!.skipTrivia = skip;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.HasUnicodeEscape","kind":"method","status":"implemented","sigHash":"d0297f607c7a34e71cddd75bfdd159cf83e15df7a9102cffb9929b030688e62d","bodyHash":"9cd141fca9df4a1b9181caa9147259cd389dccedc23f85109328d2732221fac1"}
 *
 * Go source:
 * func (s *Scanner) HasUnicodeEscape() bool {
 * 	return s.tokenFlags&ast.TokenFlagsUnicodeEscape != 0
 * }
 */
export function Scanner_HasUnicodeEscape(receiver: GoPtr<Scanner>): bool {
  return (receiver!.__tsgoEmbedded0.tokenFlags & TokenFlagsUnicodeEscape) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ContainsNonASCII","kind":"method","status":"implemented","sigHash":"b04200be91535e223f441fbc251d17ec7598ef5a6b85d85941c11340aa0a04a7","bodyHash":"1110d61df2722e9c33441156bdc07be89a08f97221c20d71ef96a3084ed07f1d"}
 *
 * Go source:
 * func (s *Scanner) ContainsNonASCII() bool {
 * 	return s.containsNonASCII
 * }
 */
export function Scanner_ContainsNonASCII(receiver: GoPtr<Scanner>): bool {
  return receiver!.containsNonASCII;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.HasExtendedUnicodeEscape","kind":"method","status":"implemented","sigHash":"1cf07172b4f52e545a091ae5604d2011d9d80094c65b4e922cdadbd9594af624","bodyHash":"c5607772d1520784d04019847c8dc39aebbaac7fda2c3b42c5e286fc6f027470"}
 *
 * Go source:
 * func (s *Scanner) HasExtendedUnicodeEscape() bool {
 * 	return s.tokenFlags&ast.TokenFlagsExtendedUnicodeEscape != 0
 * }
 */
export function Scanner_HasExtendedUnicodeEscape(receiver: GoPtr<Scanner>): bool {
  return (receiver!.__tsgoEmbedded0.tokenFlags & TokenFlagsExtendedUnicodeEscape) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.HasPrecedingLineBreak","kind":"method","status":"implemented","sigHash":"abaee7c2f90d4c1a373960a7e0b044115f98711471a6a7b2917e4ecb5e7fd739","bodyHash":"4b9b2a0b1d51030cf26005d8939f1196bdbf1bdc0fe8c8c8339cd16064c674af"}
 *
 * Go source:
 * func (s *Scanner) HasPrecedingLineBreak() bool {
 * 	return s.tokenFlags&ast.TokenFlagsPrecedingLineBreak != 0
 * }
 */
export function Scanner_HasPrecedingLineBreak(receiver: GoPtr<Scanner>): bool {
  return (receiver!.__tsgoEmbedded0.tokenFlags & TokenFlagsPrecedingLineBreak) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.HasPrecedingJSDocComment","kind":"method","status":"implemented","sigHash":"8babfeec8b6321396b713e2fec6cc96366618056605b9c9fb07aed62dbc8ec29","bodyHash":"e8a1c68420075f88865ef26714e19a5fbca1e090edc46749f4276773bea34c37"}
 *
 * Go source:
 * func (s *Scanner) HasPrecedingJSDocComment() bool {
 * 	return s.tokenFlags&ast.TokenFlagsPrecedingJSDocComment != 0
 * }
 */
export function Scanner_HasPrecedingJSDocComment(receiver: GoPtr<Scanner>): bool {
  return (receiver!.__tsgoEmbedded0.tokenFlags & TokenFlagsPrecedingJSDocComment) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.HasPrecedingJSDocLeadingAsterisks","kind":"method","status":"implemented","sigHash":"200f836560264d0279a4a4ff0ddcb9046016f5bdfd25e2741a629bc4ee333f0b","bodyHash":"5ab74eee58e8afda8b930d859e9b7edbdc6c61bf9a512f6b5fb5ecc3ce70eab6"}
 *
 * Go source:
 * func (s *Scanner) HasPrecedingJSDocLeadingAsterisks() bool {
 * 	return s.tokenFlags&ast.TokenFlagsPrecedingJSDocLeadingAsterisks != 0
 * }
 */
export function Scanner_HasPrecedingJSDocLeadingAsterisks(receiver: GoPtr<Scanner>): bool {
  return (receiver!.__tsgoEmbedded0.tokenFlags & TokenFlagsPrecedingJSDocLeadingAsterisks) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.HasPrecedingJSDocWithDeprecatedTag","kind":"method","status":"implemented","sigHash":"8504cc5c13882cbf020176f1d592d183b851f13711ba3adaa3f159b59fe60b73","bodyHash":"58bd65937d917082008c85281cb6fd7bf2b533f19604bf32aa81ce36f4215ec1"}
 *
 * Go source:
 * func (s *Scanner) HasPrecedingJSDocWithDeprecatedTag() bool {
 * 	return s.tokenFlags&ast.TokenFlagsPrecedingJSDocWithDeprecated != 0
 * }
 */
export function Scanner_HasPrecedingJSDocWithDeprecatedTag(receiver: GoPtr<Scanner>): bool {
  return (receiver!.__tsgoEmbedded0.tokenFlags & TokenFlagsPrecedingJSDocWithDeprecated) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.HasPrecedingJSDocWithSeeOrLink","kind":"method","status":"implemented","sigHash":"c8e9349d53fe928267efa23da778974a7e23ab0e94fd3380be31a84a71281f93","bodyHash":"33cc49ffe1989bd6881708eae1739661a1504408b1d22c2f4480805024b6c936"}
 *
 * Go source:
 * func (s *Scanner) HasPrecedingJSDocWithSeeOrLink() bool {
 * 	return s.tokenFlags&ast.TokenFlagsPrecedingJSDocWithSeeOrLink != 0
 * }
 */
export function Scanner_HasPrecedingJSDocWithSeeOrLink(receiver: GoPtr<Scanner>): bool {
  return (receiver!.__tsgoEmbedded0.tokenFlags & TokenFlagsPrecedingJSDocWithSeeOrLink) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanJSDocCommentForTags","kind":"method","status":"implemented","sigHash":"6bdaeea7925c4dc0dd4e55cc5c1b1b46e28041eb30226cbdde9795967bb0aecc","bodyHash":"7870ae49e2dc423db3a1be445482732ce20feeaebf8021e8f0ea5a585f6bf827"}
 *
 * Go source:
 * func (s *Scanner) scanJSDocCommentForTags(commentText string) {
 * 	for {
 * 		i := strings.IndexByte(commentText, '@')
 * 		if i < 0 {
 * 			return
 * 		}
 * 		commentText = commentText[i+1:]
 * 		if s.tokenFlags&ast.TokenFlagsPrecedingJSDocWithDeprecated == 0 && hasJSDocTag(commentText, "deprecated") {
 * 			s.tokenFlags |= ast.TokenFlagsPrecedingJSDocWithDeprecated
 * 		}
 * 		if s.tokenFlags&ast.TokenFlagsPrecedingJSDocWithSeeOrLink == 0 && hasJSDocTag(commentText, "see", "link", "linkcode", "linkplain") {
 * 			s.tokenFlags |= ast.TokenFlagsPrecedingJSDocWithSeeOrLink
 * 		}
 * 		if s.tokenFlags&(ast.TokenFlagsPrecedingJSDocWithDeprecated|ast.TokenFlagsPrecedingJSDocWithSeeOrLink) ==
 * 			(ast.TokenFlagsPrecedingJSDocWithDeprecated | ast.TokenFlagsPrecedingJSDocWithSeeOrLink) {
 * 			return
 * 		}
 * 	}
 * }
 */
export function Scanner_scanJSDocCommentForTags(receiver: GoPtr<Scanner>, commentText: string): void {
  const s = receiver!;
  for (;;) {
    const i = strings.IndexByte(commentText, "@".charCodeAt(0) as byte);
    if (i < 0) {
      return;
    }
    commentText = byteSlice(commentText, i + 1);
    if (
      (s.__tsgoEmbedded0.tokenFlags & TokenFlagsPrecedingJSDocWithDeprecated) === 0 &&
      hasJSDocTag(commentText, "deprecated")
    ) {
      s.__tsgoEmbedded0.tokenFlags |= TokenFlagsPrecedingJSDocWithDeprecated;
    }
    if (
      (s.__tsgoEmbedded0.tokenFlags & TokenFlagsPrecedingJSDocWithSeeOrLink) === 0 &&
      hasJSDocTag(commentText, "see", "link", "linkcode", "linkplain")
    ) {
      s.__tsgoEmbedded0.tokenFlags |= TokenFlagsPrecedingJSDocWithSeeOrLink;
    }
    if (
      (s.__tsgoEmbedded0.tokenFlags & (TokenFlagsPrecedingJSDocWithDeprecated | TokenFlagsPrecedingJSDocWithSeeOrLink)) ===
      (TokenFlagsPrecedingJSDocWithDeprecated | TokenFlagsPrecedingJSDocWithSeeOrLink)
    ) {
      return;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::hasJSDocTag","kind":"func","status":"implemented","sigHash":"f361aaea4875a620ff76aa9e159099efa0daae87a2b07cf5f788d1bd3193644f","bodyHash":"a50eb36fef5eb098eed434da4e02ef6301ad7e75a778885cfa3a4617b8dd5f8c"}
 *
 * Go source:
 * func hasJSDocTag(text string, tags ...string) bool {
 * 	for _, tag := range tags {
 * 		if !strings.HasPrefix(text, tag) {
 * 			continue
 * 		}
 * 		if len(text) == len(tag) {
 * 			return true
 * 		}
 * 		ch := text[len(tag)]
 * 		if ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r' || ch == '}' || ch == '*' {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function hasJSDocTag(text: string, ...tags: Array<string>): bool {
  for (const tag of tags) {
    if (!strings.HasPrefix(text, tag)) {
      continue;
    }
    if (byteLen(text) === byteLen(tag)) {
      return true;
    }
    const ch = byteAt(text, byteLen(tag));
    if (
      ch === " ".charCodeAt(0) ||
      ch === "\t".charCodeAt(0) ||
      ch === "\n".charCodeAt(0) ||
      ch === "\r".charCodeAt(0) ||
      ch === "}".charCodeAt(0) ||
      ch === "*".charCodeAt(0)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.SetText","kind":"method","status":"implemented","sigHash":"82064155a55a75a9b3e24e3a8f91ca17729da58c43eff21848500a222365a84d","bodyHash":"030d02a7218ce8c7b38b60179e3e24b52733498c775852828ae24d4d467da653"}
 *
 * Go source:
 * func (s *Scanner) SetText(text string) {
 * 	s.text = text
 * 	s.end = len(text)
 * 	s.ScannerState = ScannerState{}
 * }
 */
export function Scanner_SetText(receiver: GoPtr<Scanner>, text: string): void {
  const s = receiver!;
  s.text = text;
  s.end = byteLen(text);
  // s.ScannerState = ScannerState{}: reset the embedded state to its zero value.
  s.__tsgoEmbedded0 = newScannerState();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.SetOnError","kind":"method","status":"implemented","sigHash":"33f9cebd2e8da0068aed6e5b299560100d6ad16e9a316af88af10c492035f3c3","bodyHash":"0ec53962dcc084ae4daa010a4f07ce3faaa6f5d542546bddec182cd9da9597d7"}
 *
 * Go source:
 * func (s *Scanner) SetOnError(errorCallback ErrorCallback) {
 * 	s.onError = errorCallback
 * }
 */
export function Scanner_SetOnError(receiver: GoPtr<Scanner>, errorCallback: ErrorCallback): void {
  receiver!.onError = errorCallback;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.SetLanguageVariant","kind":"method","status":"implemented","sigHash":"754cd5ac3da7f60d7b89e6022e474772a3d61540c5f6b6f2f2fb7a20a00ef229","bodyHash":"9300bb4c06a2880a461305f873ca65e5cbec838d714267189834b73d7b859cd3"}
 *
 * Go source:
 * func (s *Scanner) SetLanguageVariant(languageVariant core.LanguageVariant) {
 * 	s.languageVariant = languageVariant
 * }
 */
export function Scanner_SetLanguageVariant(receiver: GoPtr<Scanner>, languageVariant: LanguageVariant): void {
  receiver!.languageVariant = languageVariant;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.SetScriptTarget","kind":"method","status":"implemented","sigHash":"72a7461df5cd26ebc8f0b90786c550656d17125747f282e042bd954f250f7de6","bodyHash":"aaa721ebf1c0d7f61d5be7f6894547308e66ea674957f1b8b9f9b25604b0573c"}
 *
 * Go source:
 * func (s *Scanner) SetScriptTarget(scriptTarget core.ScriptTarget) {
 * 	s.scriptTarget = scriptTarget
 * }
 */
export function Scanner_SetScriptTarget(receiver: GoPtr<Scanner>, scriptTarget: ScriptTarget): void {
  receiver!.scriptTarget = scriptTarget;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.languageVersion","kind":"method","status":"implemented","sigHash":"b28eb96c1084e588d4b113d6dea4fba23da0af63aafb67520bbfad17446802be","bodyHash":"84fa3e5182144c507ebf4ef270c6bde053c14882a3bd5f3b7ece8f27bb4a9d90"}
 *
 * Go source:
 * func (s *Scanner) languageVersion() core.ScriptTarget {
 * 	if s.scriptTarget == core.ScriptTargetNone {
 * 		return core.ScriptTargetLatest
 * 	}
 * 	return s.scriptTarget
 * }
 */
export function Scanner_languageVersion(receiver: GoPtr<Scanner>): ScriptTarget {
  const s = receiver!;
  if (s.scriptTarget === ScriptTargetNone) {
    return ScriptTargetLatest;
  }
  return s.scriptTarget;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.error","kind":"method","status":"implemented","sigHash":"784bcbad7386c574324f7251fe56a241a8431adcf7ca5ea01a5c5d2a53c30009","bodyHash":"43ecff846b340a0f690accf50efb47fbd3444b2cfd054b007bec3cb9ab8a14aa"}
 *
 * Go source:
 * func (s *Scanner) error(diagnostic *diagnostics.Message) {
 * 	s.errorAt(diagnostic, s.pos, 0)
 * }
 */
export function Scanner_error(receiver: GoPtr<Scanner>, diagnostic: GoPtr<Message>): void {
  const s = receiver!;
  Scanner_errorAt(s, diagnostic, s.__tsgoEmbedded0.pos, 0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.errorAt","kind":"method","status":"implemented","sigHash":"9463ec0f6ed593e9acc1b266d10a3116c4bf7487b261c511ade254a62c19b8e9","bodyHash":"3d88616823e42f77e82af113b743bf2538612a6b2384ccc1396efa5ac0ca2178"}
 *
 * Go source:
 * func (s *Scanner) errorAt(diagnostic *diagnostics.Message, pos int, length int, args ...any) {
 * 	if s.onError != nil {
 * 		s.onError(diagnostic, pos, length, args...)
 * 	}
 * }
 */
export function Scanner_errorAt(receiver: GoPtr<Scanner>, diagnostic: GoPtr<Message>, pos: int, length: int, ...args: Array<unknown>): void {
  const s = receiver!;
  if (s.onError !== undefined) {
    s.onError(diagnostic, pos, length, ...args);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.char","kind":"method","status":"implemented","sigHash":"83b9f5c499d55cb42ecff92a9698b5d07b83e98bfc19ce7e8d9464bd49aed11a","bodyHash":"04dd1c9c3c4cc4876bb9b349ade0eb577fc352a2d398cf992b1021424fdbdd3c"}
 *
 * Go source:
 * func (s *Scanner) char() rune {
 * 	if s.pos < s.end {
 * 		return rune(s.text[s.pos])
 * 	}
 * 	return -1
 * }
 */
export function Scanner_char(receiver: GoPtr<Scanner>): GoRune {
  const s = receiver!;
  if (s.__tsgoEmbedded0.pos < s.end) {
    return byteAt(s.text, s.__tsgoEmbedded0.pos);
  }
  return -1;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.charAt","kind":"method","status":"implemented","sigHash":"da7fb8267c9d51bb48b7ab642034a5e6b9ba11614d5be412238c0917f439a26f","bodyHash":"8899ba70b7386f7e6861ef2dc2af29fb0f6af0ab77b551e389197d02b078966f"}
 *
 * Go source:
 * func (s *Scanner) charAt(offset int) rune {
 * 	if s.pos+offset < s.end {
 * 		return rune(s.text[s.pos+offset])
 * 	}
 * 	return -1
 * }
 */
export function Scanner_charAt(receiver: GoPtr<Scanner>, offset: int): GoRune {
  const s = receiver!;
  if (s.__tsgoEmbedded0.pos + offset < s.end) {
    return byteAt(s.text, s.__tsgoEmbedded0.pos + offset);
  }
  return -1;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.charAndSize","kind":"method","status":"implemented","sigHash":"8d18d5c2ed40b33c06f101da083e5d47474d596fca8274aeebe218283733a06e","bodyHash":"5f1e888178685ec5ba51e9faee8205d8a1d7f0fcd5244327530fe9cd8264157c"}
 *
 * Go source:
 * func (s *Scanner) charAndSize() (rune, int) {
 * 	r, size := utf8.DecodeRuneInString(s.text[s.pos:])
 * 	if size > 1 {
 * 		s.containsNonASCII = true
 * 	}
 * 	return r, size
 * }
 */
export function Scanner_charAndSize(receiver: GoPtr<Scanner>): [GoRune, int] {
  const s = receiver!;
  const [r, size] = decodeRuneInStringAt(s.text, s.__tsgoEmbedded0.pos);
  if (size > 1) {
    s.containsNonASCII = true;
  }
  return [r, size];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.Scan","kind":"method","status":"implemented","sigHash":"4b2d16399efbd4afd7ee8c9b9dfeec6408ed7100a1a83bcded650f8c210392b0","bodyHash":"c49148d2c806e9259d2e45f9027f71f52b1297cb0bebd8e0c7d483cd8013ffc8"}
 *
 * Go source:
 * func (s *Scanner) Scan() ast.Kind {
 * 	s.fullStartPos = s.pos
 * 	s.tokenFlags = ast.TokenFlagsNone
 * 	for {
 * 		s.tokenStart = s.pos
 * 		ch := s.char()
 * 
 * 		switch ch {
 * 		case '\t', '\v', '\f', ' ':
 * 			s.pos++
 * 			if s.skipTrivia {
 * 				continue
 * 			}
 * 			for {
 * 				ch, size := s.charAndSize()
 * 				if !stringutil.IsWhiteSpaceSingleLine(ch) {
 * 					break
 * 				}
 * 				s.pos += size
 * 			}
 * 			s.token = ast.KindWhitespaceTrivia
 * 		case '\n', '\r':
 * 			s.tokenFlags |= ast.TokenFlagsPrecedingLineBreak
 * 			if s.skipTrivia {
 * 				s.pos++
 * 				continue
 * 			}
 * 			if ch == '\r' && s.charAt(1) == '\n' {
 * 				s.pos += 2
 * 			} else {
 * 				s.pos++
 * 			}
 * 			s.token = ast.KindNewLineTrivia
 * 		case '!':
 * 			if s.charAt(1) == '=' {
 * 				if s.charAt(2) == '=' {
 * 					s.pos += 3
 * 					s.token = ast.KindExclamationEqualsEqualsToken
 * 				} else {
 * 					s.pos += 2
 * 					s.token = ast.KindExclamationEqualsToken
 * 				}
 * 			} else {
 * 				s.pos++
 * 				s.token = ast.KindExclamationToken
 * 			}
 * 		case '"', '\'':
 * 			s.tokenValue = s.scanString(false /*jsxAttributeString* /)
 * 			s.token = ast.KindStringLiteral
 * 		case '`':
 * 			s.token = s.scanTemplateAndSetTokenValue(false /*shouldEmitInvalidEscapeError* /)
 * 		case '%':
 * 			if s.charAt(1) == '=' {
 * 				s.pos += 2
 * 				s.token = ast.KindPercentEqualsToken
 * 			} else {
 * 				s.pos++
 * 				s.token = ast.KindPercentToken
 * 			}
 * 		case '&':
 * 			if s.charAt(1) == '&' {
 * 				if s.charAt(2) == '=' {
 * 					s.pos += 3
 * 					s.token = ast.KindAmpersandAmpersandEqualsToken
 * 				} else {
 * 					s.pos += 2
 * 					s.token = ast.KindAmpersandAmpersandToken
 * 				}
 * 			} else if s.charAt(1) == '=' {
 * 				s.pos += 2
 * 				s.token = ast.KindAmpersandEqualsToken
 * 			} else {
 * 				s.pos++
 * 				s.token = ast.KindAmpersandToken
 * 			}
 * 		case '(':
 * 			s.pos++
 * 			s.token = ast.KindOpenParenToken
 * 		case ')':
 * 			s.pos++
 * 			s.token = ast.KindCloseParenToken
 * 		case '*':
 * 			if s.charAt(1) == '=' {
 * 				s.pos += 2
 * 				s.token = ast.KindAsteriskEqualsToken
 * 			} else if s.charAt(1) == '*' {
 * 				if s.charAt(2) == '=' {
 * 					s.pos += 3
 * 					s.token = ast.KindAsteriskAsteriskEqualsToken
 * 				} else {
 * 					s.pos += 2
 * 					s.token = ast.KindAsteriskAsteriskToken
 * 				}
 * 			} else {
 * 				s.pos++
 * 				if s.skipJSDocLeadingAsterisks != 0 &&
 * 					(s.tokenFlags&ast.TokenFlagsPrecedingJSDocLeadingAsterisks) == 0 &&
 * 					(s.tokenFlags&ast.TokenFlagsPrecedingLineBreak) != 0 {
 * 					s.tokenFlags |= ast.TokenFlagsPrecedingJSDocLeadingAsterisks
 * 					continue
 * 				}
 * 				s.token = ast.KindAsteriskToken
 * 			}
 * 		case '+':
 * 			if s.charAt(1) == '=' {
 * 				s.pos += 2
 * 				s.token = ast.KindPlusEqualsToken
 * 			} else if s.charAt(1) == '+' {
 * 				s.pos += 2
 * 				s.token = ast.KindPlusPlusToken
 * 			} else {
 * 				s.pos++
 * 				s.token = ast.KindPlusToken
 * 			}
 * 		case ',':
 * 			s.pos++
 * 			s.token = ast.KindCommaToken
 * 		case '-':
 * 			if s.charAt(1) == '=' {
 * 				s.pos += 2
 * 				s.token = ast.KindMinusEqualsToken
 * 			} else if s.charAt(1) == '-' {
 * 				s.pos += 2
 * 				s.token = ast.KindMinusMinusToken
 * 			} else {
 * 				s.pos++
 * 				s.token = ast.KindMinusToken
 * 			}
 * 		case '.':
 * 			if stringutil.IsDigit(s.charAt(1)) {
 * 				s.token = s.scanNumber()
 * 			} else if s.charAt(1) == '.' && s.charAt(2) == '.' {
 * 				s.pos += 3
 * 				s.token = ast.KindDotDotDotToken
 * 			} else {
 * 				s.pos++
 * 				s.token = ast.KindDotToken
 * 			}
 * 		case '/':
 * 			// Single-line comment
 * 			if s.charAt(1) == '/' {
 * 				s.pos += 2
 * 
 * 				for {
 * 					ch1, size := s.charAndSize()
 * 					if size == 0 || stringutil.IsLineBreak(ch1) {
 * 						break
 * 					}
 * 					s.pos += size
 * 				}
 * 
 * 				s.processCommentDirective(s.tokenStart, s.pos, false)
 * 
 * 				if s.skipTrivia {
 * 					continue
 * 				}
 * 				s.token = ast.KindSingleLineCommentTrivia
 * 				return s.token
 * 			}
 * 			// Multi-line comment
 * 			if s.charAt(1) == '*' {
 * 				s.pos += 2
 * 				isJSDoc := s.char() == '*' && s.charAt(1) != '/'
 * 
 * 				commentClosed := false
 * 				lastLineStart := s.tokenStart
 * 				for {
 * 					ch1, size := s.charAndSize()
 * 					if size == 0 {
 * 						break
 * 					}
 * 
 * 					if ch1 == '*' && s.charAt(1) == '/' {
 * 						s.pos += 2
 * 						commentClosed = true
 * 						break
 * 					}
 * 
 * 					s.pos += size
 * 
 * 					if stringutil.IsLineBreak(ch1) {
 * 						lastLineStart = s.pos
 * 						s.tokenFlags |= ast.TokenFlagsPrecedingLineBreak
 * 					}
 * 				}
 * 
 * 				if isJSDoc {
 * 					s.tokenFlags |= ast.TokenFlagsPrecedingJSDocComment
 * 					s.scanJSDocCommentForTags(s.text[s.tokenStart:s.pos])
 * 				}
 * 
 * 				s.processCommentDirective(lastLineStart, s.pos, true)
 * 
 * 				if !commentClosed {
 * 					s.error(diagnostics.Asterisk_Slash_expected)
 * 				}
 * 
 * 				if s.skipTrivia {
 * 					continue
 * 				}
 * 
 * 				if !commentClosed {
 * 					s.tokenFlags |= ast.TokenFlagsUnterminated
 * 				}
 * 				s.token = ast.KindMultiLineCommentTrivia
 * 				return s.token
 * 			}
 * 			if s.charAt(1) == '=' {
 * 				s.pos += 2
 * 				s.token = ast.KindSlashEqualsToken
 * 			} else {
 * 				s.pos++
 * 				s.token = ast.KindSlashToken
 * 			}
 * 		case '0':
 * 			if s.charAt(1) == 'X' || s.charAt(1) == 'x' {
 * 				start := s.pos
 * 				s.pos += 2
 * 				digits := s.scanHexDigits(1, true, true)
 * 				if digits == "" {
 * 					s.error(diagnostics.Hexadecimal_digit_expected)
 * 					digits = "0"
 * 				}
 * 				if s.hexNumberCache == nil {
 * 					s.hexNumberCache = make(map[string]string)
 * 				}
 * 				if cachedValue, ok := s.hexNumberCache[digits]; ok {
 * 					s.tokenValue = cachedValue
 * 				} else {
 * 					rawText := s.text[start:s.pos]
 * 					if strings.HasPrefix(rawText, "0x") && rawText[2:] == digits {
 * 						s.tokenValue = rawText
 * 					} else {
 * 						s.tokenValue = "0x" + digits
 * 					}
 * 					s.hexNumberCache[digits] = s.tokenValue
 * 				}
 * 				s.tokenFlags |= ast.TokenFlagsHexSpecifier
 * 				s.token = s.scanBigIntSuffix()
 * 				break
 * 			}
 * 			if s.charAt(1) == 'B' || s.charAt(1) == 'b' {
 * 				s.pos += 2
 * 				digits := s.scanBinaryOrOctalDigits(2)
 * 				if digits == "" {
 * 					s.error(diagnostics.Binary_digit_expected)
 * 					digits = "0"
 * 				}
 * 				s.tokenValue = "0b" + digits
 * 				s.tokenFlags |= ast.TokenFlagsBinarySpecifier
 * 				s.token = s.scanBigIntSuffix()
 * 				break
 * 			}
 * 			if s.charAt(1) == 'O' || s.charAt(1) == 'o' {
 * 				s.pos += 2
 * 				digits := s.scanBinaryOrOctalDigits(8)
 * 				if digits == "" {
 * 					s.error(diagnostics.Octal_digit_expected)
 * 					digits = "0"
 * 				}
 * 				s.tokenValue = "0o" + digits
 * 				s.tokenFlags |= ast.TokenFlagsOctalSpecifier
 * 				s.token = s.scanBigIntSuffix()
 * 				break
 * 			}
 * 			fallthrough
 * 		case '1', '2', '3', '4', '5', '6', '7', '8', '9':
 * 			s.token = s.scanNumber()
 * 		case ':':
 * 			s.pos++
 * 			s.token = ast.KindColonToken
 * 		case ';':
 * 			s.pos++
 * 			s.token = ast.KindSemicolonToken
 * 		case '<':
 * 			if isConflictMarkerTrivia(s.text, s.pos) {
 * 				s.pos = scanConflictMarkerTrivia(s.text, s.pos, s.errorAt)
 * 				if s.skipTrivia {
 * 					continue
 * 				} else {
 * 					s.token = ast.KindConflictMarkerTrivia
 * 					return s.token
 * 				}
 * 			}
 * 			if s.charAt(1) == '<' {
 * 				if s.charAt(2) == '=' {
 * 					s.pos += 3
 * 					s.token = ast.KindLessThanLessThanEqualsToken
 * 				} else {
 * 					s.pos += 2
 * 					s.token = ast.KindLessThanLessThanToken
 * 				}
 * 			} else if s.charAt(1) == '=' {
 * 				s.pos += 2
 * 				s.token = ast.KindLessThanEqualsToken
 * 			} else if s.languageVariant == core.LanguageVariantJSX && s.charAt(1) == '/' && s.charAt(2) != '*' {
 * 				s.pos += 2
 * 				s.token = ast.KindLessThanSlashToken
 * 			} else {
 * 				s.pos++
 * 				s.token = ast.KindLessThanToken
 * 			}
 * 		case '=':
 * 			if isConflictMarkerTrivia(s.text, s.pos) {
 * 				s.pos = scanConflictMarkerTrivia(s.text, s.pos, s.errorAt)
 * 				if s.skipTrivia {
 * 					continue
 * 				} else {
 * 					s.token = ast.KindConflictMarkerTrivia
 * 					return s.token
 * 				}
 * 			}
 * 			if s.charAt(1) == '=' {
 * 				if s.charAt(2) == '=' {
 * 					s.pos += 3
 * 					s.token = ast.KindEqualsEqualsEqualsToken
 * 				} else {
 * 					s.pos += 2
 * 					s.token = ast.KindEqualsEqualsToken
 * 				}
 * 			} else if s.charAt(1) == '>' {
 * 				s.pos += 2
 * 				s.token = ast.KindEqualsGreaterThanToken
 * 			} else {
 * 				s.pos++
 * 				s.token = ast.KindEqualsToken
 * 			}
 * 		case '>':
 * 			if isConflictMarkerTrivia(s.text, s.pos) {
 * 				s.pos = scanConflictMarkerTrivia(s.text, s.pos, s.errorAt)
 * 				if s.skipTrivia {
 * 					continue
 * 				} else {
 * 					s.token = ast.KindConflictMarkerTrivia
 * 					return s.token
 * 				}
 * 			}
 * 			s.pos++
 * 			s.token = ast.KindGreaterThanToken
 * 		case '?':
 * 			if s.charAt(1) == '.' && !stringutil.IsDigit(s.charAt(2)) {
 * 				s.pos += 2
 * 				s.token = ast.KindQuestionDotToken
 * 			} else if s.charAt(1) == '?' {
 * 				if s.charAt(2) == '=' {
 * 					s.pos += 3
 * 					s.token = ast.KindQuestionQuestionEqualsToken
 * 				} else {
 * 					s.pos += 2
 * 					s.token = ast.KindQuestionQuestionToken
 * 				}
 * 			} else {
 * 				s.pos++
 * 				s.token = ast.KindQuestionToken
 * 			}
 * 		case '[':
 * 			s.pos++
 * 			s.token = ast.KindOpenBracketToken
 * 		case ']':
 * 			s.pos++
 * 			s.token = ast.KindCloseBracketToken
 * 		case '^':
 * 			if s.charAt(1) == '=' {
 * 				s.pos += 2
 * 				s.token = ast.KindCaretEqualsToken
 * 			} else {
 * 				s.pos++
 * 				s.token = ast.KindCaretToken
 * 			}
 * 		case '{':
 * 			s.pos++
 * 			s.token = ast.KindOpenBraceToken
 * 		case '|':
 * 			if isConflictMarkerTrivia(s.text, s.pos) {
 * 				s.pos = scanConflictMarkerTrivia(s.text, s.pos, s.errorAt)
 * 				if s.skipTrivia {
 * 					continue
 * 				} else {
 * 					s.token = ast.KindConflictMarkerTrivia
 * 					return s.token
 * 				}
 * 			}
 * 			if s.charAt(1) == '|' {
 * 				if s.charAt(2) == '=' {
 * 					s.pos += 3
 * 					s.token = ast.KindBarBarEqualsToken
 * 				} else {
 * 					s.pos += 2
 * 					s.token = ast.KindBarBarToken
 * 				}
 * 			} else if s.charAt(1) == '=' {
 * 				s.pos += 2
 * 				s.token = ast.KindBarEqualsToken
 * 			} else {
 * 				s.pos++
 * 				s.token = ast.KindBarToken
 * 			}
 * 		case '}':
 * 			s.pos++
 * 			s.token = ast.KindCloseBraceToken
 * 		case '~':
 * 			s.pos++
 * 			s.token = ast.KindTildeToken
 * 		case '@':
 * 			s.pos++
 * 			s.token = ast.KindAtToken
 * 		case '\\':
 * 			cp := s.peekUnicodeEscape()
 * 			if cp >= 0 && IsIdentifierStart(cp) {
 * 				s.tokenValue = string(s.scanUnicodeEscape(true)) + s.scanIdentifierParts()
 * 				s.token = GetIdentifierToken(s.tokenValue)
 * 			} else {
 * 				s.scanInvalidCharacter()
 * 			}
 * 		case '#':
 * 			if s.charAt(1) == '!' {
 * 				if s.pos == 0 {
 * 					s.pos += 2
 * 					for ch, size := s.charAndSize(); size > 0 && !stringutil.IsLineBreak(ch); ch, size = s.charAndSize() {
 * 						s.pos += size
 * 					}
 * 					continue
 * 				}
 * 				s.errorAt(diagnostics.X_can_only_be_used_at_the_start_of_a_file, s.pos, 2)
 * 				s.pos++
 * 				s.token = ast.KindUnknown
 * 				break
 * 			}
 * 			if s.charAt(1) == '\\' {
 * 				s.pos++
 * 				cp := s.peekUnicodeEscape()
 * 				if cp >= 0 && IsIdentifierStart(cp) {
 * 					s.tokenValue = "#" + string(s.scanUnicodeEscape(true)) + s.scanIdentifierParts()
 * 					s.token = ast.KindPrivateIdentifier
 * 					break
 * 				}
 * 				s.pos--
 * 			}
 * 			if !s.scanIdentifier(1) {
 * 				s.errorAt(diagnostics.Invalid_character, s.pos-1, 1)
 * 				s.tokenValue = "#"
 * 			}
 * 			s.token = ast.KindPrivateIdentifier
 * 		default:
 * 			if ch < 0 {
 * 				s.token = ast.KindEndOfFile
 * 				break
 * 			}
 * 			if s.scanIdentifier(0) {
 * 				s.token = GetIdentifierToken(s.tokenValue)
 * 				break
 * 			}
 * 			ch, size := s.charAndSize()
 * 			if ch == utf8.RuneError {
 * 				s.errorAt(diagnostics.File_appears_to_be_binary, 0, 0)
 * 				s.pos = len(s.text)
 * 				s.token = ast.KindNonTextFileMarkerTrivia
 * 				break
 * 			}
 * 			if stringutil.IsWhiteSpaceSingleLine(ch) {
 * 				s.pos += size
 * 
 * 				// If we get here and it's not 0x0085 (nextLine), then we're handling non-ASCII whitespace.
 * 				// Handle skipTrivia like we do in the space case above.
 * 				if ch == 0x0085 || s.skipTrivia {
 * 					continue
 * 				}
 * 
 * 				for {
 * 					ch, size = s.charAndSize()
 * 					if !stringutil.IsWhiteSpaceSingleLine(ch) {
 * 						break
 * 					}
 * 					s.pos += size
 * 				}
 * 				s.token = ast.KindWhitespaceTrivia
 * 				return s.token
 * 			}
 * 			if stringutil.IsLineBreak(ch) {
 * 				s.tokenFlags |= ast.TokenFlagsPrecedingLineBreak
 * 				s.pos += size
 * 				continue
 * 			}
 * 			s.scanInvalidCharacter()
 * 		}
 * 		return s.token
 * 	}
 * }
 */
export function Scanner_Scan(receiver: GoPtr<Scanner>): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  st.fullStartPos = st.pos;
  st.tokenFlags = TokenFlagsNone;
  for (;;) {
    st.tokenStart = st.pos;
    const ch = Scanner_char(s);

    switch (ch) {
      case "\t".charCodeAt(0):
      case "\v".charCodeAt(0):
      case "\f".charCodeAt(0):
      case " ".charCodeAt(0): {
        st.pos++;
        if (s.skipTrivia) {
          continue;
        }
        for (;;) {
          const [ch2, size] = Scanner_charAndSize(s);
          if (!IsWhiteSpaceSingleLine(ch2)) {
            break;
          }
          st.pos += size;
        }
        st.token = KindWhitespaceTrivia;
        break;
      }
      case "\n".charCodeAt(0):
      case "\r".charCodeAt(0): {
        st.tokenFlags |= TokenFlagsPrecedingLineBreak;
        if (s.skipTrivia) {
          st.pos++;
          continue;
        }
        if (ch === "\r".charCodeAt(0) && Scanner_charAt(s, 1) === "\n".charCodeAt(0)) {
          st.pos += 2;
        } else {
          st.pos++;
        }
        st.token = KindNewLineTrivia;
        break;
      }
      case "!".charCodeAt(0): {
        if (Scanner_charAt(s, 1) === "=".charCodeAt(0)) {
          if (Scanner_charAt(s, 2) === "=".charCodeAt(0)) {
            st.pos += 3;
            st.token = KindExclamationEqualsEqualsToken;
          } else {
            st.pos += 2;
            st.token = KindExclamationEqualsToken;
          }
        } else {
          st.pos++;
          st.token = KindExclamationToken;
        }
        break;
      }
      case '"'.charCodeAt(0):
      case "'".charCodeAt(0): {
        st.tokenValue = Scanner_scanString(s, false /*jsxAttributeString*/);
        st.token = KindStringLiteral;
        break;
      }
      case "`".charCodeAt(0): {
        st.token = Scanner_scanTemplateAndSetTokenValue(s, false /*shouldEmitInvalidEscapeError*/);
        break;
      }
      case "%".charCodeAt(0): {
        if (Scanner_charAt(s, 1) === "=".charCodeAt(0)) {
          st.pos += 2;
          st.token = KindPercentEqualsToken;
        } else {
          st.pos++;
          st.token = KindPercentToken;
        }
        break;
      }
      case "&".charCodeAt(0): {
        if (Scanner_charAt(s, 1) === "&".charCodeAt(0)) {
          if (Scanner_charAt(s, 2) === "=".charCodeAt(0)) {
            st.pos += 3;
            st.token = KindAmpersandAmpersandEqualsToken;
          } else {
            st.pos += 2;
            st.token = KindAmpersandAmpersandToken;
          }
        } else if (Scanner_charAt(s, 1) === "=".charCodeAt(0)) {
          st.pos += 2;
          st.token = KindAmpersandEqualsToken;
        } else {
          st.pos++;
          st.token = KindAmpersandToken;
        }
        break;
      }
      case "(".charCodeAt(0): {
        st.pos++;
        st.token = KindOpenParenToken;
        break;
      }
      case ")".charCodeAt(0): {
        st.pos++;
        st.token = KindCloseParenToken;
        break;
      }
      case "*".charCodeAt(0): {
        if (Scanner_charAt(s, 1) === "=".charCodeAt(0)) {
          st.pos += 2;
          st.token = KindAsteriskEqualsToken;
        } else if (Scanner_charAt(s, 1) === "*".charCodeAt(0)) {
          if (Scanner_charAt(s, 2) === "=".charCodeAt(0)) {
            st.pos += 3;
            st.token = KindAsteriskAsteriskEqualsToken;
          } else {
            st.pos += 2;
            st.token = KindAsteriskAsteriskToken;
          }
        } else {
          st.pos++;
          if (
            st.skipJSDocLeadingAsterisks !== 0 &&
            (st.tokenFlags & TokenFlagsPrecedingJSDocLeadingAsterisks) === 0 &&
            (st.tokenFlags & TokenFlagsPrecedingLineBreak) !== 0
          ) {
            st.tokenFlags |= TokenFlagsPrecedingJSDocLeadingAsterisks;
            continue;
          }
          st.token = KindAsteriskToken;
        }
        break;
      }
      case "+".charCodeAt(0): {
        if (Scanner_charAt(s, 1) === "=".charCodeAt(0)) {
          st.pos += 2;
          st.token = KindPlusEqualsToken;
        } else if (Scanner_charAt(s, 1) === "+".charCodeAt(0)) {
          st.pos += 2;
          st.token = KindPlusPlusToken;
        } else {
          st.pos++;
          st.token = KindPlusToken;
        }
        break;
      }
      case ",".charCodeAt(0): {
        st.pos++;
        st.token = KindCommaToken;
        break;
      }
      case "-".charCodeAt(0): {
        if (Scanner_charAt(s, 1) === "=".charCodeAt(0)) {
          st.pos += 2;
          st.token = KindMinusEqualsToken;
        } else if (Scanner_charAt(s, 1) === "-".charCodeAt(0)) {
          st.pos += 2;
          st.token = KindMinusMinusToken;
        } else {
          st.pos++;
          st.token = KindMinusToken;
        }
        break;
      }
      case ".".charCodeAt(0): {
        if (IsDigit(Scanner_charAt(s, 1))) {
          st.token = Scanner_scanNumber(s);
        } else if (Scanner_charAt(s, 1) === ".".charCodeAt(0) && Scanner_charAt(s, 2) === ".".charCodeAt(0)) {
          st.pos += 3;
          st.token = KindDotDotDotToken;
        } else {
          st.pos++;
          st.token = KindDotToken;
        }
        break;
      }
      case "/".charCodeAt(0): {
        // Single-line comment
        if (Scanner_charAt(s, 1) === "/".charCodeAt(0)) {
          st.pos += 2;

          for (;;) {
            const [ch1, size] = Scanner_charAndSize(s);
            if (size === 0 || IsLineBreak(ch1)) {
              break;
            }
            st.pos += size;
          }

          Scanner_processCommentDirective(s, st.tokenStart, st.pos, false);

          if (s.skipTrivia) {
            continue;
          }
          st.token = KindSingleLineCommentTrivia;
          return st.token;
        }
        // Multi-line comment
        if (Scanner_charAt(s, 1) === "*".charCodeAt(0)) {
          st.pos += 2;
          const isJSDoc = Scanner_char(s) === "*".charCodeAt(0) && Scanner_charAt(s, 1) !== "/".charCodeAt(0);

          let commentClosed = false;
          let lastLineStart = st.tokenStart;
          for (;;) {
            const [ch1, size] = Scanner_charAndSize(s);
            if (size === 0) {
              break;
            }

            if (ch1 === "*".charCodeAt(0) && Scanner_charAt(s, 1) === "/".charCodeAt(0)) {
              st.pos += 2;
              commentClosed = true;
              break;
            }

            st.pos += size;

            if (IsLineBreak(ch1)) {
              lastLineStart = st.pos;
              st.tokenFlags |= TokenFlagsPrecedingLineBreak;
            }
          }

          if (isJSDoc) {
            st.tokenFlags |= TokenFlagsPrecedingJSDocComment;
            Scanner_scanJSDocCommentForTags(s, byteSlice(s.text, st.tokenStart, st.pos));
          }

          Scanner_processCommentDirective(s, lastLineStart, st.pos, true);

          if (!commentClosed) {
            Scanner_error(s, Asterisk_Slash_expected);
          }

          if (s.skipTrivia) {
            continue;
          }

          if (!commentClosed) {
            st.tokenFlags |= TokenFlagsUnterminated;
          }
          st.token = KindMultiLineCommentTrivia;
          return st.token;
        }
        if (Scanner_charAt(s, 1) === "=".charCodeAt(0)) {
          st.pos += 2;
          st.token = KindSlashEqualsToken;
        } else {
          st.pos++;
          st.token = KindSlashToken;
        }
        break;
      }
      case "0".charCodeAt(0): {
        if (Scanner_charAt(s, 1) === "X".charCodeAt(0) || Scanner_charAt(s, 1) === "x".charCodeAt(0)) {
          const start = st.pos;
          st.pos += 2;
          let digits = Scanner_scanHexDigits(s, 1, true, true);
          if (digits === "") {
            Scanner_error(s, Hexadecimal_digit_expected);
            digits = "0";
          }
          if (s.hexNumberCache === (undefined as unknown as GoMap<string, string>)) {
            s.hexNumberCache = new globalThis.Map<string, string>();
          }
          const cachedValue = s.hexNumberCache.get(digits);
          if (cachedValue !== undefined) {
            st.tokenValue = cachedValue;
          } else {
            const rawText = byteSlice(s.text, start, st.pos);
            if (strings.HasPrefix(rawText, "0x") && byteSlice(rawText, 2) === digits) {
              st.tokenValue = rawText;
            } else {
              st.tokenValue = "0x" + digits;
            }
            s.hexNumberCache.set(digits, st.tokenValue);
          }
          st.tokenFlags |= TokenFlagsHexSpecifier;
          st.token = Scanner_scanBigIntSuffix(s);
          break;
        }
        if (Scanner_charAt(s, 1) === "B".charCodeAt(0) || Scanner_charAt(s, 1) === "b".charCodeAt(0)) {
          st.pos += 2;
          let digits = Scanner_scanBinaryOrOctalDigits(s, 2);
          if (digits === "") {
            Scanner_error(s, Binary_digit_expected);
            digits = "0";
          }
          st.tokenValue = "0b" + digits;
          st.tokenFlags |= TokenFlagsBinarySpecifier;
          st.token = Scanner_scanBigIntSuffix(s);
          break;
        }
        if (Scanner_charAt(s, 1) === "O".charCodeAt(0) || Scanner_charAt(s, 1) === "o".charCodeAt(0)) {
          st.pos += 2;
          let digits = Scanner_scanBinaryOrOctalDigits(s, 8);
          if (digits === "") {
            Scanner_error(s, Octal_digit_expected);
            digits = "0";
          }
          st.tokenValue = "0o" + digits;
          st.tokenFlags |= TokenFlagsOctalSpecifier;
          st.token = Scanner_scanBigIntSuffix(s);
          break;
        }
        // fallthrough
        st.token = Scanner_scanNumber(s);
        break;
      }
      case "1".charCodeAt(0):
      case "2".charCodeAt(0):
      case "3".charCodeAt(0):
      case "4".charCodeAt(0):
      case "5".charCodeAt(0):
      case "6".charCodeAt(0):
      case "7".charCodeAt(0):
      case "8".charCodeAt(0):
      case "9".charCodeAt(0): {
        st.token = Scanner_scanNumber(s);
        break;
      }
      case ":".charCodeAt(0): {
        st.pos++;
        st.token = KindColonToken;
        break;
      }
      case ";".charCodeAt(0): {
        st.pos++;
        st.token = KindSemicolonToken;
        break;
      }
      case "<".charCodeAt(0): {
        if (isConflictMarkerTrivia(s.text, st.pos)) {
          st.pos = scanConflictMarkerTrivia(s.text, st.pos, (diag, pos, length, ...args) => Scanner_errorAt(s, diag, pos, length, ...args));
          if (s.skipTrivia) {
            continue;
          } else {
            st.token = KindConflictMarkerTrivia;
            return st.token;
          }
        }
        if (Scanner_charAt(s, 1) === "<".charCodeAt(0)) {
          if (Scanner_charAt(s, 2) === "=".charCodeAt(0)) {
            st.pos += 3;
            st.token = KindLessThanLessThanEqualsToken;
          } else {
            st.pos += 2;
            st.token = KindLessThanLessThanToken;
          }
        } else if (Scanner_charAt(s, 1) === "=".charCodeAt(0)) {
          st.pos += 2;
          st.token = KindLessThanEqualsToken;
        } else if (s.languageVariant === LanguageVariantJSX && Scanner_charAt(s, 1) === "/".charCodeAt(0) && Scanner_charAt(s, 2) !== "*".charCodeAt(0)) {
          st.pos += 2;
          st.token = KindLessThanSlashToken;
        } else {
          st.pos++;
          st.token = KindLessThanToken;
        }
        break;
      }
      case "=".charCodeAt(0): {
        if (isConflictMarkerTrivia(s.text, st.pos)) {
          st.pos = scanConflictMarkerTrivia(s.text, st.pos, (diag, pos, length, ...args) => Scanner_errorAt(s, diag, pos, length, ...args));
          if (s.skipTrivia) {
            continue;
          } else {
            st.token = KindConflictMarkerTrivia;
            return st.token;
          }
        }
        if (Scanner_charAt(s, 1) === "=".charCodeAt(0)) {
          if (Scanner_charAt(s, 2) === "=".charCodeAt(0)) {
            st.pos += 3;
            st.token = KindEqualsEqualsEqualsToken;
          } else {
            st.pos += 2;
            st.token = KindEqualsEqualsToken;
          }
        } else if (Scanner_charAt(s, 1) === ">".charCodeAt(0)) {
          st.pos += 2;
          st.token = KindEqualsGreaterThanToken;
        } else {
          st.pos++;
          st.token = KindEqualsToken;
        }
        break;
      }
      case ">".charCodeAt(0): {
        if (isConflictMarkerTrivia(s.text, st.pos)) {
          st.pos = scanConflictMarkerTrivia(s.text, st.pos, (diag, pos, length, ...args) => Scanner_errorAt(s, diag, pos, length, ...args));
          if (s.skipTrivia) {
            continue;
          } else {
            st.token = KindConflictMarkerTrivia;
            return st.token;
          }
        }
        st.pos++;
        st.token = KindGreaterThanToken;
        break;
      }
      case "?".charCodeAt(0): {
        if (Scanner_charAt(s, 1) === ".".charCodeAt(0) && !IsDigit(Scanner_charAt(s, 2))) {
          st.pos += 2;
          st.token = KindQuestionDotToken;
        } else if (Scanner_charAt(s, 1) === "?".charCodeAt(0)) {
          if (Scanner_charAt(s, 2) === "=".charCodeAt(0)) {
            st.pos += 3;
            st.token = KindQuestionQuestionEqualsToken;
          } else {
            st.pos += 2;
            st.token = KindQuestionQuestionToken;
          }
        } else {
          st.pos++;
          st.token = KindQuestionToken;
        }
        break;
      }
      case "[".charCodeAt(0): {
        st.pos++;
        st.token = KindOpenBracketToken;
        break;
      }
      case "]".charCodeAt(0): {
        st.pos++;
        st.token = KindCloseBracketToken;
        break;
      }
      case "^".charCodeAt(0): {
        if (Scanner_charAt(s, 1) === "=".charCodeAt(0)) {
          st.pos += 2;
          st.token = KindCaretEqualsToken;
        } else {
          st.pos++;
          st.token = KindCaretToken;
        }
        break;
      }
      case "{".charCodeAt(0): {
        st.pos++;
        st.token = KindOpenBraceToken;
        break;
      }
      case "|".charCodeAt(0): {
        if (isConflictMarkerTrivia(s.text, st.pos)) {
          st.pos = scanConflictMarkerTrivia(s.text, st.pos, (diag, pos, length, ...args) => Scanner_errorAt(s, diag, pos, length, ...args));
          if (s.skipTrivia) {
            continue;
          } else {
            st.token = KindConflictMarkerTrivia;
            return st.token;
          }
        }
        if (Scanner_charAt(s, 1) === "|".charCodeAt(0)) {
          if (Scanner_charAt(s, 2) === "=".charCodeAt(0)) {
            st.pos += 3;
            st.token = KindBarBarEqualsToken;
          } else {
            st.pos += 2;
            st.token = KindBarBarToken;
          }
        } else if (Scanner_charAt(s, 1) === "=".charCodeAt(0)) {
          st.pos += 2;
          st.token = KindBarEqualsToken;
        } else {
          st.pos++;
          st.token = KindBarToken;
        }
        break;
      }
      case "}".charCodeAt(0): {
        st.pos++;
        st.token = KindCloseBraceToken;
        break;
      }
      case "~".charCodeAt(0): {
        st.pos++;
        st.token = KindTildeToken;
        break;
      }
      case "@".charCodeAt(0): {
        st.pos++;
        st.token = KindAtToken;
        break;
      }
      case "\\".charCodeAt(0): {
        const cp = Scanner_peekUnicodeEscape(s);
        if (cp >= 0 && IsIdentifierStart(cp)) {
          st.tokenValue = stringFromRune(Scanner_scanUnicodeEscape(s, true)) + Scanner_scanIdentifierParts(s);
          st.token = GetIdentifierToken(st.tokenValue);
        } else {
          Scanner_scanInvalidCharacter(s);
        }
        break;
      }
      case "#".charCodeAt(0): {
        if (Scanner_charAt(s, 1) === "!".charCodeAt(0)) {
          if (st.pos === 0) {
            st.pos += 2;
            for (let [ch1, size] = Scanner_charAndSize(s); size > 0 && !IsLineBreak(ch1); [ch1, size] = Scanner_charAndSize(s)) {
              st.pos += size;
            }
            continue;
          }
          Scanner_errorAt(s, X_can_only_be_used_at_the_start_of_a_file, st.pos, 2);
          st.pos++;
          st.token = KindUnknown;
          break;
        }
        if (Scanner_charAt(s, 1) === "\\".charCodeAt(0)) {
          st.pos++;
          const cp = Scanner_peekUnicodeEscape(s);
          if (cp >= 0 && IsIdentifierStart(cp)) {
            st.tokenValue = "#" + stringFromRune(Scanner_scanUnicodeEscape(s, true)) + Scanner_scanIdentifierParts(s);
            st.token = KindPrivateIdentifier;
            break;
          }
          st.pos--;
        }
        if (!Scanner_scanIdentifier(s, 1)) {
          Scanner_errorAt(s, Invalid_character, st.pos - 1, 1);
          st.tokenValue = "#";
        }
        st.token = KindPrivateIdentifier;
        break;
      }
      default: {
        if (ch < 0) {
          st.token = KindEndOfFile;
          break;
        }
        if (Scanner_scanIdentifier(s, 0)) {
          st.token = GetIdentifierToken(st.tokenValue);
          break;
        }
        const [ch2, size] = Scanner_charAndSize(s);
        if (ch2 === utf8.RuneError) {
          Scanner_errorAt(s, File_appears_to_be_binary, 0, 0);
          st.pos = byteLen(s.text);
          st.token = KindNonTextFileMarkerTrivia;
          break;
        }
        if (IsWhiteSpaceSingleLine(ch2)) {
          st.pos += size;

          // If we get here and it's not 0x0085 (nextLine), then we're handling non-ASCII whitespace.
          // Handle skipTrivia like we do in the space case above.
          if (ch2 === 0x0085 || s.skipTrivia) {
            continue;
          }

          for (;;) {
            const [ch3, size2] = Scanner_charAndSize(s);
            if (!IsWhiteSpaceSingleLine(ch3)) {
              break;
            }
            st.pos += size2;
          }
          st.token = KindWhitespaceTrivia;
          return st.token;
        }
        if (IsLineBreak(ch2)) {
          st.tokenFlags |= TokenFlagsPrecedingLineBreak;
          st.pos += size;
          continue;
        }
        Scanner_scanInvalidCharacter(s);
        break;
      }
    }
    return st.token;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.processCommentDirective","kind":"method","status":"implemented","sigHash":"7c2edc7a657dd3296e46f228cc02e076147ea57685be63dcb6e56dd6cb1a9317","bodyHash":"14449bf543d4745d8e2d1234c9fa3321dbde6aa7ec6e0bab84cd3bb5b6e8b579"}
 *
 * Go source:
 * func (s *Scanner) processCommentDirective(start int, end int, multiline bool) {
 * 	// Skip starting slashes and whitespace
 * 	pos := start
 * 	if multiline {
 * 		// Skip whitespace
 * 		for pos < end && (s.text[pos] == ' ' || s.text[pos] == '\t') {
 * 			pos++
 * 		}
 * 		// Skip combinations of / and *
 * 		for pos < end && (s.text[pos] == '/' || s.text[pos] == '*') {
 * 			pos++
 * 		}
 * 	} else {
 * 		// Skip opening //
 * 		pos += 2
 * 		// Skip another / if present
 * 		for pos < end && s.text[pos] == '/' {
 * 			pos++
 * 		}
 * 	}
 * 	// Skip whitespace
 * 	for pos < end && (s.text[pos] == ' ' || s.text[pos] == '\t') {
 * 		pos++
 * 	}
 * 	// Directive must start with '@'
 * 	if !(pos < end && s.text[pos] == '@') {
 * 		return
 * 	}
 * 	pos++
 * 	var kind ast.CommentDirectiveKind
 * 	switch {
 * 	case strings.HasPrefix(s.text[pos:], "ts-expect-error"):
 * 		kind = ast.CommentDirectiveKindExpectError
 * 	case strings.HasPrefix(s.text[pos:], "ts-ignore"):
 * 		kind = ast.CommentDirectiveKindIgnore
 * 	default:
 * 		return
 * 	}
 * 	s.commentDirectives = append(s.commentDirectives, ast.CommentDirective{Loc: core.NewTextRange(start, end), Kind: kind})
 * }
 */
export function Scanner_processCommentDirective(receiver: GoPtr<Scanner>, start: int, end: int, multiline: bool): void {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  // Skip starting slashes and whitespace
  let pos = start;
  if (multiline) {
    // Skip whitespace
    while (pos < end && (byteAt(s.text, pos) === " ".charCodeAt(0) || byteAt(s.text, pos) === "\t".charCodeAt(0))) {
      pos++;
    }
    // Skip combinations of / and *
    while (pos < end && (byteAt(s.text, pos) === "/".charCodeAt(0) || byteAt(s.text, pos) === "*".charCodeAt(0))) {
      pos++;
    }
  } else {
    // Skip opening //
    pos += 2;
    // Skip another / if present
    while (pos < end && byteAt(s.text, pos) === "/".charCodeAt(0)) {
      pos++;
    }
  }
  // Skip whitespace
  while (pos < end && (byteAt(s.text, pos) === " ".charCodeAt(0) || byteAt(s.text, pos) === "\t".charCodeAt(0))) {
    pos++;
  }
  // Directive must start with '@'
  if (!(pos < end && byteAt(s.text, pos) === "@".charCodeAt(0))) {
    return;
  }
  pos++;
  let kind: CommentDirectiveKind;
  if (strings.HasPrefix(byteSlice(s.text, pos), "ts-expect-error")) {
    kind = CommentDirectiveKindExpectError;
  } else if (strings.HasPrefix(byteSlice(s.text, pos), "ts-ignore")) {
    kind = CommentDirectiveKindIgnore;
  } else {
    return;
  }
  st.commentDirectives.push({ Loc: NewTextRange(start, end), Kind: kind });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ReScanLessThanToken","kind":"method","status":"implemented","sigHash":"8cf6ad70255e4cd535eca193d008aeedcb3beda8e14d6e02e9e5a4e4125a42ac","bodyHash":"941a44d95965ae74a363719be105cfd5279efa7e0c1d6c8b6bf49d1355c11bc5"}
 *
 * Go source:
 * func (s *Scanner) ReScanLessThanToken() ast.Kind {
 * 	if s.token == ast.KindLessThanLessThanToken {
 * 		s.pos = s.tokenStart + 1
 * 		s.token = ast.KindLessThanToken
 * 	}
 * 	return s.token
 * }
 */
export function Scanner_ReScanLessThanToken(receiver: GoPtr<Scanner>): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  if (st.token === KindLessThanLessThanToken) {
    st.pos = st.tokenStart + 1;
    st.token = KindLessThanToken;
  }
  return st.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ReScanGreaterThanToken","kind":"method","status":"implemented","sigHash":"e452c833a215e1071dd6e67ed4d5d6e080aa43f1e384e4f804f3b55dcf712c63","bodyHash":"e2a64fd91ac3d9cc0ffc6fade23b5481bf78267231de2310e104d4fb539dbef9"}
 *
 * Go source:
 * func (s *Scanner) ReScanGreaterThanToken() ast.Kind {
 * 	if s.token == ast.KindGreaterThanToken {
 * 		s.pos = s.tokenStart + 1
 * 		if s.char() == '>' {
 * 			if s.charAt(1) == '>' {
 * 				if s.charAt(2) == '=' {
 * 					s.pos += 3
 * 					s.token = ast.KindGreaterThanGreaterThanGreaterThanEqualsToken
 * 				} else {
 * 					s.pos += 2
 * 					s.token = ast.KindGreaterThanGreaterThanGreaterThanToken
 * 				}
 * 			} else if s.charAt(1) == '=' {
 * 				s.pos += 2
 * 				s.token = ast.KindGreaterThanGreaterThanEqualsToken
 * 			} else {
 * 				s.pos++
 * 				s.token = ast.KindGreaterThanGreaterThanToken
 * 			}
 * 		} else if s.char() == '=' {
 * 			s.pos++
 * 			s.token = ast.KindGreaterThanEqualsToken
 * 		}
 * 	}
 * 	return s.token
 * }
 */
export function Scanner_ReScanGreaterThanToken(receiver: GoPtr<Scanner>): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  if (st.token === KindGreaterThanToken) {
    st.pos = st.tokenStart + 1;
    if (Scanner_char(s) === ">".charCodeAt(0)) {
      if (Scanner_charAt(s, 1) === ">".charCodeAt(0)) {
        if (Scanner_charAt(s, 2) === "=".charCodeAt(0)) {
          st.pos += 3;
          st.token = KindGreaterThanGreaterThanGreaterThanEqualsToken;
        } else {
          st.pos += 2;
          st.token = KindGreaterThanGreaterThanGreaterThanToken;
        }
      } else if (Scanner_charAt(s, 1) === "=".charCodeAt(0)) {
        st.pos += 2;
        st.token = KindGreaterThanGreaterThanEqualsToken;
      } else {
        st.pos++;
        st.token = KindGreaterThanGreaterThanToken;
      }
    } else if (Scanner_char(s) === "=".charCodeAt(0)) {
      st.pos++;
      st.token = KindGreaterThanEqualsToken;
    }
  }
  return st.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ReScanTemplateToken","kind":"method","status":"implemented","sigHash":"083c9ae0db1a9fb2d185d1669816a650909628ffa48c736ab8d00d2cd2c5e629","bodyHash":"27beeea676b50f58831d7207690e118c9d72206cc29d3212ce58b5267c8e9285"}
 *
 * Go source:
 * func (s *Scanner) ReScanTemplateToken(isTaggedTemplate bool) ast.Kind {
 * 	s.pos = s.tokenStart
 * 	s.token = s.scanTemplateAndSetTokenValue(!isTaggedTemplate)
 * 	return s.token
 * }
 */
export function Scanner_ReScanTemplateToken(receiver: GoPtr<Scanner>, isTaggedTemplate: bool): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  st.pos = st.tokenStart;
  st.token = Scanner_scanTemplateAndSetTokenValue(s, !isTaggedTemplate);
  return st.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ReScanAsteriskEqualsToken","kind":"method","status":"implemented","sigHash":"682da5630dd5128de5d5d104a3731209cf0f493ad25eedd84291179a789d9efa","bodyHash":"2a362590bead42bdaf22b241b57484d020d04df2af70ee5ca044418e365aead3"}
 *
 * Go source:
 * func (s *Scanner) ReScanAsteriskEqualsToken() ast.Kind {
 * 	if s.token != ast.KindAsteriskEqualsToken {
 * 		panic("'ReScanAsteriskEqualsToken' should only be called on a '*='")
 * 	}
 * 	s.pos = s.tokenStart + 1
 * 	s.token = ast.KindEqualsToken
 * 	return s.token
 * }
 */
export function Scanner_ReScanAsteriskEqualsToken(receiver: GoPtr<Scanner>): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  if (st.token !== KindAsteriskEqualsToken) {
    throw new globalThis.Error("'ReScanAsteriskEqualsToken' should only be called on a '*='");
  }
  st.pos = st.tokenStart + 1;
  st.token = KindEqualsToken;
  return st.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ReScanSlashToken","kind":"method","status":"implemented","sigHash":"c030ae5fe9eab8eea38f59894a51ca09228c4c0c0edca7d66aa337f821508214","bodyHash":"11f78a7268cacca312bafd26ee99f480df8bee733ec5360d03f64e9859cf6cf2"}
 *
 * Go source:
 * func (s *Scanner) ReScanSlashToken(reportErrors ...bool) ast.Kind {
 * 	shouldReportErrors := len(reportErrors) > 0 && reportErrors[0]
 * 	if s.token == ast.KindSlashToken || s.token == ast.KindSlashEqualsToken {
 * 		// Quickly get to the end of regex such that we know the flags
 * 		startOfRegExpBody := s.tokenStart + 1
 * 		p := startOfRegExpBody
 * 		inEscape := false
 * 		namedCaptureGroups := false
 * 		// Although nested character classes are allowed in Unicode Sets mode,
 * 		// an unescaped slash is nevertheless invalid even in a character class in any Unicode mode.
 * 		// This is indicated by Section 12.9.5 Regular Expression Literals of the specification,
 * 		// where nested character classes are not considered at all. (A `[` RegularExpressionClassChar
 * 		// does nothing in a RegularExpressionClass, and a `]` always closes the class.)
 * 		// Additionally, parsing nested character classes will misinterpret regexes like `/[[]/`
 * 		// as unterminated, consuming characters beyond the slash. (This even applies to `/[[]/v`,
 * 		// which should be parsed as a well-terminated regex with an incomplete character class.)
 * 		// Thus we must not handle nested character classes in the first pass.
 * 		inCharacterClass := false
 * 	loop:
 * 		for {
 * 			// If we reach the end of a file, or hit a newline, then this is an unterminated
 * 			// regex. Report error and return what we have so far.
 * 			if p >= s.end {
 * 				s.tokenFlags |= ast.TokenFlagsUnterminated
 * 				break loop
 * 			}
 * 			ch := rune(s.text[p])
 * 			switch {
 * 			case stringutil.IsLineBreak(ch):
 * 				s.tokenFlags |= ast.TokenFlagsUnterminated
 * 				break loop
 * 			case inEscape:
 * 				// Parsing an escape character;
 * 				// reset the flag and just advance to the next char.
 * 				inEscape = false
 * 			case ch == '/' && !inCharacterClass:
 * 				// A slash within a character class is permissible,
 * 				// but in general it signals the end of the regexp literal.
 * 				break loop
 * 			case ch == '[':
 * 				inCharacterClass = true
 * 			case ch == '\\':
 * 				inEscape = true
 * 			case ch == ']':
 * 				inCharacterClass = false
 * 			case !inCharacterClass && ch == '(' &&
 * 				p+1 < s.end && s.text[p+1] == '?' &&
 * 				p+2 < s.end && s.text[p+2] == '<' &&
 * 				(p+3 >= s.end || (s.text[p+3] != '=' && s.text[p+3] != '!')):
 * 				namedCaptureGroups = true
 * 			}
 * 			p++
 * 		}
 * 
 * 		endOfRegExpBody := p
 * 		if s.tokenFlags&ast.TokenFlagsUnterminated != 0 {
 * 			// Search for the nearest unbalanced bracket for better recovery. Since the expression is
 * 			// invalid anyways, we take nested square brackets into consideration for the best guess.
 * 			p = startOfRegExpBody
 * 			inEscape = false
 * 			characterClassDepth := 0
 * 			inDecimalQuantifier := false
 * 			groupDepth := 0
 * 			for p < endOfRegExpBody {
 * 				ch := rune(s.text[p])
 * 				if inEscape {
 * 					inEscape = false
 * 				} else if ch == '\\' {
 * 					inEscape = true
 * 				} else if ch == '[' {
 * 					characterClassDepth++
 * 				} else if ch == ']' && characterClassDepth != 0 {
 * 					characterClassDepth--
 * 				} else if characterClassDepth == 0 {
 * 					if ch == '{' {
 * 						inDecimalQuantifier = true
 * 					} else if ch == '}' && inDecimalQuantifier {
 * 						inDecimalQuantifier = false
 * 					} else if !inDecimalQuantifier {
 * 						if ch == '(' {
 * 							groupDepth++
 * 						} else if ch == ')' && groupDepth != 0 {
 * 							groupDepth--
 * 						} else if ch == ')' || ch == ']' || ch == '}' {
 * 							// We encountered an unbalanced bracket outside a character class. Treat this position as the end of regex.
 * 							break
 * 						}
 * 					}
 * 				}
 * 				p++
 * 			}
 * 			// Whitespaces and semicolons at the end are not likely to be part of the regex
 * 			for p > startOfRegExpBody {
 * 				ch, size := utf8.DecodeLastRuneInString(s.text[:p])
 * 				if stringutil.IsWhiteSpaceLike(ch) || ch == ';' {
 * 					p -= size
 * 				} else {
 * 					break
 * 				}
 * 			}
 * 			s.errorAt(diagnostics.Unterminated_regular_expression_literal, s.tokenStart, p-s.tokenStart)
 * 		} else {
 * 			// Consume the slash character
 * 			p++
 * 			var regExpFlags regularExpressionFlags
 * 			for p < s.end {
 * 				ch, size := utf8.DecodeRuneInString(s.text[p:])
 * 				if ch == utf8.RuneError || !IsIdentifierPart(ch) {
 * 					break
 * 				}
 * 				if shouldReportErrors {
 * 					flag, ok := charCodeToRegExpFlag[ch]
 * 					if !ok {
 * 						s.errorAt(diagnostics.Unknown_regular_expression_flag, p, size)
 * 					} else if regExpFlags&flag != 0 {
 * 						s.errorAt(diagnostics.Duplicate_regular_expression_flag, p, size)
 * 					} else if (regExpFlags|flag)&regularExpressionFlagsAnyUnicodeMode == regularExpressionFlagsAnyUnicodeMode {
 * 						s.errorAt(diagnostics.The_Unicode_u_flag_and_the_Unicode_Sets_v_flag_cannot_be_set_simultaneously, p, size)
 * 					} else {
 * 						regExpFlags |= flag
 * 						s.checkRegularExpressionFlagAvailability(flag, p, size)
 * 					}
 * 				}
 * 				p += size
 * 			}
 * 			if shouldReportErrors {
 * 				s.pos = startOfRegExpBody
 * 				saveEnd := s.end
 * 				saveTokenPos := s.tokenStart
 * 				saveTokenFlags := s.tokenFlags
 * 				s.end = endOfRegExpBody
 * 				parser := &regExpParser{
 * 					scanner:            s,
 * 					end:                endOfRegExpBody,
 * 					regExpFlags:        regExpFlags,
 * 					anyUnicodeMode:     regExpFlags&regularExpressionFlagsAnyUnicodeMode != 0,
 * 					unicodeSetsMode:    regExpFlags&regularExpressionFlagsUnicodeSets != 0,
 * 					annexB:             true,
 * 					namedCaptureGroups: namedCaptureGroups,
 * 					groupSpecifiers:    make(map[string]bool),
 * 				}
 * 				parser.run()
 * 				s.end = saveEnd
 * 				s.pos = p
 * 				s.tokenStart = saveTokenPos
 * 				s.tokenFlags = saveTokenFlags
 * 			} else {
 * 				s.pos = p
 * 			}
 * 		}
 * 
 * 		s.pos = p
 * 		s.tokenValue = s.text[s.tokenStart:s.pos]
 * 		s.token = ast.KindRegularExpressionLiteral
 * 	}
 * 	return s.token
 * }
 */
export function Scanner_ReScanSlashToken(receiver: GoPtr<Scanner>, ...reportErrors: Array<bool>): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  const shouldReportErrors = reportErrors.length > 0 && reportErrors[0]!;
  if (st.token === KindSlashToken || st.token === KindSlashEqualsToken) {
    // Quickly get to the end of regex such that we know the flags
    const startOfRegExpBody = st.tokenStart + 1;
    let p = startOfRegExpBody;
    let inEscape = false;
    let namedCaptureGroups = false;
    // Although nested character classes are allowed in Unicode Sets mode,
    // an unescaped slash is nevertheless invalid even in a character class in any Unicode mode.
    // This is indicated by Section 12.9.5 Regular Expression Literals of the specification,
    // where nested character classes are not considered at all. (A `[` RegularExpressionClassChar
    // does nothing in a RegularExpressionClass, and a `]` always closes the class.)
    // Additionally, parsing nested character classes will misinterpret regexes like `/[[]/`
    // as unterminated, consuming characters beyond the slash. (This even applies to `/[[]/v`,
    // which should be parsed as a well-terminated regex with an incomplete character class.)
    // Thus we must not handle nested character classes in the first pass.
    let inCharacterClass = false;
    for (;;) {
      // If we reach the end of a file, or hit a newline, then this is an unterminated
      // regex. Report error and return what we have so far.
      if (p >= s.end) {
        st.tokenFlags |= TokenFlagsUnterminated;
        break;
      }
      const ch = byteAt(s.text, p);
      if (IsLineBreak(ch)) {
        st.tokenFlags |= TokenFlagsUnterminated;
        break;
      } else if (inEscape) {
        // Parsing an escape character;
        // reset the flag and just advance to the next char.
        inEscape = false;
      } else if (ch === "/".charCodeAt(0) && !inCharacterClass) {
        // A slash within a character class is permissible,
        // but in general it signals the end of the regexp literal.
        break;
      } else if (ch === "[".charCodeAt(0)) {
        inCharacterClass = true;
      } else if (ch === "\\".charCodeAt(0)) {
        inEscape = true;
      } else if (ch === "]".charCodeAt(0)) {
        inCharacterClass = false;
      } else if (
        !inCharacterClass &&
        ch === "(".charCodeAt(0) &&
        p + 1 < s.end &&
        byteAt(s.text, p + 1) === "?".charCodeAt(0) &&
        p + 2 < s.end &&
        byteAt(s.text, p + 2) === "<".charCodeAt(0) &&
        (p + 3 >= s.end || (byteAt(s.text, p + 3) !== "=".charCodeAt(0) && byteAt(s.text, p + 3) !== "!".charCodeAt(0)))
      ) {
        namedCaptureGroups = true;
      }
      p++;
    }

    const endOfRegExpBody = p;
    if ((st.tokenFlags & TokenFlagsUnterminated) !== 0) {
      // Search for the nearest unbalanced bracket for better recovery. Since the expression is
      // invalid anyways, we take nested square brackets into consideration for the best guess.
      p = startOfRegExpBody;
      inEscape = false;
      let characterClassDepth = 0;
      let inDecimalQuantifier = false;
      let groupDepth = 0;
      while (p < endOfRegExpBody) {
        const ch = byteAt(s.text, p);
        if (inEscape) {
          inEscape = false;
        } else if (ch === "\\".charCodeAt(0)) {
          inEscape = true;
        } else if (ch === "[".charCodeAt(0)) {
          characterClassDepth++;
        } else if (ch === "]".charCodeAt(0) && characterClassDepth !== 0) {
          characterClassDepth--;
        } else if (characterClassDepth === 0) {
          if (ch === "{".charCodeAt(0)) {
            inDecimalQuantifier = true;
          } else if (ch === "}".charCodeAt(0) && inDecimalQuantifier) {
            inDecimalQuantifier = false;
          } else if (!inDecimalQuantifier) {
            if (ch === "(".charCodeAt(0)) {
              groupDepth++;
            } else if (ch === ")".charCodeAt(0) && groupDepth !== 0) {
              groupDepth--;
            } else if (ch === ")".charCodeAt(0) || ch === "]".charCodeAt(0) || ch === "}".charCodeAt(0)) {
              // We encountered an unbalanced bracket outside a character class. Treat this position as the end of regex.
              break;
            }
          }
        }
        p++;
      }
      // Whitespaces and semicolons at the end are not likely to be part of the regex
      while (p > startOfRegExpBody) {
        const [ch, size] = decodeLastRuneInStringBefore(s.text, p);
        if (IsWhiteSpaceLike(ch) || ch === ";".charCodeAt(0)) {
          p -= size;
        } else {
          break;
        }
      }
      Scanner_errorAt(s, Unterminated_regular_expression_literal, st.tokenStart, p - st.tokenStart);
    } else {
      // Consume the slash character
      p++;
      let regExpFlags: regularExpressionFlags = 0;
      while (p < s.end) {
        const [ch, size] = decodeRuneInStringAt(s.text, p);
        if (ch === utf8.RuneError || !IsIdentifierPart(ch)) {
          break;
        }
        if (shouldReportErrors) {
          const flag = charCodeToRegExpFlag.get(ch);
          if (flag === undefined) {
            Scanner_errorAt(s, Unknown_regular_expression_flag, p, size);
          } else if ((regExpFlags & flag) !== 0) {
            Scanner_errorAt(s, Duplicate_regular_expression_flag, p, size);
          } else if (((regExpFlags | flag) & regularExpressionFlagsAnyUnicodeMode) === regularExpressionFlagsAnyUnicodeMode) {
            Scanner_errorAt(s, The_Unicode_u_flag_and_the_Unicode_Sets_v_flag_cannot_be_set_simultaneously, p, size);
          } else {
            regExpFlags |= flag;
            Scanner_checkRegularExpressionFlagAvailability(s, flag, p, size);
          }
        }
        p += size;
      }
      if (shouldReportErrors) {
        st.pos = startOfRegExpBody;
        const saveEnd = s.end;
        const saveTokenPos = st.tokenStart;
        const saveTokenFlags = st.tokenFlags;
        s.end = endOfRegExpBody;
        const parser: regExpParser = {
          scanner: s,
          end: endOfRegExpBody,
          regExpFlags: regExpFlags,
          anyUnicodeMode: (regExpFlags & regularExpressionFlagsAnyUnicodeMode) !== 0,
          unicodeSetsMode: (regExpFlags & regularExpressionFlagsUnicodeSets) !== 0,
          annexB: true,
          anyUnicodeModeOrNonAnnexB: false,
          namedCaptureGroups: namedCaptureGroups,
          mayContainStrings: false,
          numberOfCapturingGroups: 0,
          groupSpecifiers: new globalThis.Map<string, bool>(),
          groupNameReferences: [],
          decimalEscapes: [],
          namedCapturingGroups: [],
          pendingLowSurrogate: 0,
        };
        regExpParser_run(parser);
        s.end = saveEnd;
        st.pos = p;
        st.tokenStart = saveTokenPos;
        st.tokenFlags = saveTokenFlags;
      } else {
        st.pos = p;
      }
    }

    st.pos = p;
    st.tokenValue = byteSlice(s.text, st.tokenStart, st.pos);
    st.token = KindRegularExpressionLiteral;
  }
  return st.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ReScanJsxToken","kind":"method","status":"implemented","sigHash":"09636accd75be5e1365f4f770f4dd13b0e52b284452b375604596c1f7c3dfe72","bodyHash":"1a89eb3b4f1088a13b9588a9368a4f9224846ff0ac4a05e122f3429c58844ad8"}
 *
 * Go source:
 * func (s *Scanner) ReScanJsxToken(allowMultilineJsxText bool) ast.Kind {
 * 	s.pos = s.fullStartPos
 * 	s.tokenStart = s.fullStartPos
 * 	s.token = s.ScanJsxTokenEx(allowMultilineJsxText)
 * 	return s.token
 * }
 */
export function Scanner_ReScanJsxToken(receiver: GoPtr<Scanner>, allowMultilineJsxText: bool): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  st.pos = st.fullStartPos;
  st.tokenStart = st.fullStartPos;
  st.token = Scanner_ScanJsxTokenEx(s, allowMultilineJsxText);
  return st.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ReScanHashToken","kind":"method","status":"implemented","sigHash":"56dc450f40a2391260769db80f10e14c8ed5ec1fc99afa1e2c0a67037f3146cf","bodyHash":"eb0ea335360b7ec0300fbb55233cd7e643984d5280085325c56143d41f1031a8"}
 *
 * Go source:
 * func (s *Scanner) ReScanHashToken() ast.Kind {
 * 	if s.token == ast.KindPrivateIdentifier {
 * 		s.pos = s.tokenStart + 1
 * 		s.token = ast.KindHashToken
 * 	}
 * 	return s.token
 * }
 */
export function Scanner_ReScanHashToken(receiver: GoPtr<Scanner>): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  if (st.token === KindPrivateIdentifier) {
    st.pos = st.tokenStart + 1;
    st.token = KindHashToken;
  }
  return st.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ReScanQuestionToken","kind":"method","status":"implemented","sigHash":"7db444f3b3124362bd223b468fe84e290b845c2b51f14cf1d30dbc22c914822f","bodyHash":"a6d190e6c647d9f4ccadce0715b2f4b8199081ecf15c0e56ded9cc05e2d1783b"}
 *
 * Go source:
 * func (s *Scanner) ReScanQuestionToken() ast.Kind {
 * 	if s.token != ast.KindQuestionQuestionToken {
 * 		panic("'reScanQuestionToken' should only be called on a '??'")
 * 	}
 * 	s.pos = s.tokenStart + 1
 * 	s.token = ast.KindQuestionToken
 * 	return s.token
 * }
 */
export function Scanner_ReScanQuestionToken(receiver: GoPtr<Scanner>): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  if (st.token !== KindQuestionQuestionToken) {
    throw new globalThis.Error("'reScanQuestionToken' should only be called on a '??'");
  }
  st.pos = st.tokenStart + 1;
  st.token = KindQuestionToken;
  return st.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ScanJsxToken","kind":"method","status":"implemented","sigHash":"cb0adce9446e1ee158b3c22735a4ff3ccd6f92d9ca657debfb6514a277d766fb","bodyHash":"977508030592620fb4d65f84afcfaaa3865cbc0813531c2990eca4a11ee1e050"}
 *
 * Go source:
 * func (s *Scanner) ScanJsxToken() ast.Kind {
 * 	return s.ScanJsxTokenEx(true /*allowMultilineJsxText* /)
 * }
 */
export function Scanner_ScanJsxToken(receiver: GoPtr<Scanner>): Kind {
  return Scanner_ScanJsxTokenEx(receiver, true /*allowMultilineJsxText*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ScanJsxTokenEx","kind":"method","status":"implemented","sigHash":"d4be52292dd57b50a63a124ceccaded2017f4f7eeda633eeb2149aba4bdad483","bodyHash":"72bd2d9481ea3eacf4a34bff5b81614d371da56d31152b9bf323b16ee39fc109"}
 *
 * Go source:
 * func (s *Scanner) ScanJsxTokenEx(allowMultilineJsxText bool) ast.Kind {
 * 	s.fullStartPos = s.pos
 * 	s.tokenStart = s.pos
 * 	ch := s.char()
 * 	switch {
 * 	case ch < 0:
 * 		s.token = ast.KindEndOfFile
 * 	case ch == '<':
 * 		if s.charAt(1) == '/' {
 * 			s.pos += 2
 * 			s.token = ast.KindLessThanSlashToken
 * 		} else {
 * 			s.pos++
 * 			s.token = ast.KindLessThanToken
 * 		}
 * 	case ch == '{':
 * 		s.pos++
 * 		s.token = ast.KindOpenBraceToken
 * 	default:
 * 		// First non-whitespace character on this line.
 * 		firstNonWhitespace := 0
 * 		// These initial values are special because the first line is:
 * 		// firstNonWhitespace = 0 to indicate that we want leading whitespace
 * 		for {
 * 			ch, size := s.charAndSize()
 * 			if size == 0 || ch == '{' {
 * 				break
 * 			}
 * 			if ch == '<' {
 * 				if isConflictMarkerTrivia(s.text, s.pos) {
 * 					s.pos = scanConflictMarkerTrivia(s.text, s.pos, s.errorAt)
 * 					s.token = ast.KindConflictMarkerTrivia
 * 					return s.token
 * 				}
 * 				break
 * 			}
 * 			if ch == '>' {
 * 				s.errorAt(diagnostics.Unexpected_token_Did_you_mean_or_gt, s.pos, 1)
 * 			} else if ch == '}' {
 * 				s.errorAt(diagnostics.Unexpected_token_Did_you_mean_or_rbrace, s.pos, 1)
 * 			}
 * 			// FirstNonWhitespace is 0, then we only see whitespaces so far. If we see a linebreak, we want to ignore that whitespaces.
 * 			// i.e (- : whitespace)
 * 			//      <div>----
 * 			//      </div> becomes <div></div>
 * 			//
 * 			//      <div>----</div> becomes <div>----</div>
 * 			if stringutil.IsLineBreak(ch) && firstNonWhitespace == 0 {
 * 				firstNonWhitespace = -1
 * 			} else if !allowMultilineJsxText && stringutil.IsLineBreak(ch) && firstNonWhitespace > 0 {
 * 				// Stop JsxText on each line during formatting. This allows the formatter to
 * 				// indent each line correctly.
 * 				break
 * 			} else if !stringutil.IsWhiteSpaceLike(ch) {
 * 				firstNonWhitespace = s.pos
 * 			}
 * 			s.pos += size
 * 		}
 * 		s.tokenValue = s.text[s.fullStartPos:s.pos]
 * 		s.token = ast.KindJsxText
 * 		if firstNonWhitespace == -1 {
 * 			s.token = ast.KindJsxTextAllWhiteSpaces
 * 		}
 * 	}
 * 	return s.token
 * }
 */
export function Scanner_ScanJsxTokenEx(receiver: GoPtr<Scanner>, allowMultilineJsxText: bool): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  st.fullStartPos = st.pos;
  st.tokenStart = st.pos;
  const ch = Scanner_char(s);
  if (ch < 0) {
    st.token = KindEndOfFile;
  } else if (ch === "<".charCodeAt(0)) {
    if (Scanner_charAt(s, 1) === "/".charCodeAt(0)) {
      st.pos += 2;
      st.token = KindLessThanSlashToken;
    } else {
      st.pos++;
      st.token = KindLessThanToken;
    }
  } else if (ch === "{".charCodeAt(0)) {
    st.pos++;
    st.token = KindOpenBraceToken;
  } else {
    // First non-whitespace character on this line.
    let firstNonWhitespace = 0;
    // These initial values are special because the first line is:
    // firstNonWhitespace = 0 to indicate that we want leading whitespace
    for (;;) {
      const [ch1, size] = Scanner_charAndSize(s);
      if (size === 0 || ch1 === "{".charCodeAt(0)) {
        break;
      }
      if (ch1 === "<".charCodeAt(0)) {
        if (isConflictMarkerTrivia(s.text, st.pos)) {
          st.pos = scanConflictMarkerTrivia(s.text, st.pos, (diag, pos, length, ...args) => Scanner_errorAt(s, diag, pos, length, ...args));
          st.token = KindConflictMarkerTrivia;
          return st.token;
        }
        break;
      }
      if (ch1 === ">".charCodeAt(0)) {
        Scanner_errorAt(s, Unexpected_token_Did_you_mean_or_gt, st.pos, 1);
      } else if (ch1 === "}".charCodeAt(0)) {
        Scanner_errorAt(s, Unexpected_token_Did_you_mean_or_rbrace, st.pos, 1);
      }
      // FirstNonWhitespace is 0, then we only see whitespaces so far. If we see a linebreak, we want to ignore that whitespaces.
      // i.e (- : whitespace)
      //      <div>----
      //      </div> becomes <div></div>
      //
      //      <div>----</div> becomes <div>----</div>
      if (IsLineBreak(ch1) && firstNonWhitespace === 0) {
        firstNonWhitespace = -1;
      } else if (!allowMultilineJsxText && IsLineBreak(ch1) && firstNonWhitespace > 0) {
        // Stop JsxText on each line during formatting. This allows the formatter to
        // indent each line correctly.
        break;
      } else if (!IsWhiteSpaceLike(ch1)) {
        firstNonWhitespace = st.pos;
      }
      st.pos += size;
    }
    st.tokenValue = byteSlice(s.text, st.fullStartPos, st.pos);
    st.token = KindJsxText;
    if (firstNonWhitespace === -1) {
      st.token = KindJsxTextAllWhiteSpaces;
    }
  }
  return st.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ScanJsxIdentifier","kind":"method","status":"implemented","sigHash":"0255ddbdedb241450e4ad55230021e8972070f21741c176e28c245f44208c87f","bodyHash":"c77aff5547fc32199b92ff7c21b43ccfadcd6596d0cd6533a2d8766adc73c894"}
 *
 * Go source:
 * func (s *Scanner) ScanJsxIdentifier() ast.Kind {
 * 	if tokenIsIdentifierOrKeyword(s.token) {
 * 		// An identifier or keyword has already been parsed - check for a `-` or a single instance of `:` and then append it and
 * 		// everything after it to the token
 * 		// Do note that this means that `scanJsxIdentifier` effectively _mutates_ the visible token without advancing to a new token
 * 		// Any caller should be expecting this behavior and should only read the pos or token value after calling it.
 * 		for {
 * 			ch := s.char()
 * 			if ch < 0 {
 * 				break
 * 			}
 * 			if ch == '-' {
 * 				s.tokenValue += "-"
 * 				s.pos++
 * 				continue
 * 			}
 * 			oldPos := s.pos
 * 			s.tokenValue += s.scanIdentifierParts() // reuse `scanIdentifierParts` so unicode escapes are handled
 * 			if s.pos == oldPos {
 * 				break
 * 			}
 * 		}
 * 		s.token = GetIdentifierToken(s.tokenValue)
 * 	}
 * 	return s.token
 * }
 */
export function Scanner_ScanJsxIdentifier(receiver: GoPtr<Scanner>): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  if (tokenIsIdentifierOrKeyword(st.token)) {
    // An identifier or keyword has already been parsed - check for a `-` or a single instance of `:` and then append it and
    // everything after it to the token
    // Do note that this means that `scanJsxIdentifier` effectively _mutates_ the visible token without advancing to a new token
    // Any caller should be expecting this behavior and should only read the pos or token value after calling it.
    for (;;) {
      const ch = Scanner_char(s);
      if (ch < 0) {
        break;
      }
      if (ch === "-".charCodeAt(0)) {
        st.tokenValue += "-";
        st.pos++;
        continue;
      }
      const oldPos = st.pos;
      st.tokenValue += Scanner_scanIdentifierParts(s); // reuse `scanIdentifierParts` so unicode escapes are handled
      if (st.pos === oldPos) {
        break;
      }
    }
    st.token = GetIdentifierToken(st.tokenValue);
  }
  return st.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ScanJsxAttributeValue","kind":"method","status":"implemented","sigHash":"067ad1668467a4fd2547060e2f63aea42d97e6d5af1c20221e0f17aeb19944fc","bodyHash":"3b6fdb367f3c1fa198c18469466b5dc27ab5484537dab88b01a5b4d1bb67fc9f"}
 *
 * Go source:
 * func (s *Scanner) ScanJsxAttributeValue() ast.Kind {
 * 	s.fullStartPos = s.pos
 * 	// Skip whitespace between '=' and the value so tokenStart lands on the
 * 	// opening quote, not on trivia.
 * 	for ch, size := s.charAndSize(); size > 0 && stringutil.IsWhiteSpaceLike(ch); ch, size = s.charAndSize() {
 * 		s.pos += size
 * 	}
 * 	s.tokenStart = s.pos
 * 	switch s.char() {
 * 	case '"', '\'':
 * 		s.tokenValue = s.scanString(true /*jsxAttributeString* /)
 * 		s.token = ast.KindStringLiteral
 * 		return s.token
 * 	default:
 * 		// If this scans anything other than `{`, it's a parse error.
 * 		return s.Scan()
 * 	}
 * }
 */
export function Scanner_ScanJsxAttributeValue(receiver: GoPtr<Scanner>): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  st.fullStartPos = st.pos;
  // Skip whitespace between '=' and the value so tokenStart lands on the
  // opening quote, not on trivia.
  for (let [ch, size] = Scanner_charAndSize(s); size > 0 && IsWhiteSpaceLike(ch); [ch, size] = Scanner_charAndSize(s)) {
    st.pos += size;
  }
  st.tokenStart = st.pos;
  switch (Scanner_char(s)) {
    case '"'.charCodeAt(0):
    case "'".charCodeAt(0):
      st.tokenValue = Scanner_scanString(s, true /*jsxAttributeString*/);
      st.token = KindStringLiteral;
      return st.token;
    default:
      // If this scans anything other than `{`, it's a parse error.
      return Scanner_Scan(s);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ReScanJsxAttributeValue","kind":"method","status":"implemented","sigHash":"c41ce8a593390d023792191f693ef9b39da3510ee122118ab373a2ffebfbbadf","bodyHash":"72ebc966acd2c453ec969014e03c38f431bcfc197630cfe06733b1394a918346"}
 *
 * Go source:
 * func (s *Scanner) ReScanJsxAttributeValue() ast.Kind {
 * 	s.pos = s.fullStartPos
 * 	s.tokenStart = s.fullStartPos
 * 	return s.ScanJsxAttributeValue()
 * }
 */
export function Scanner_ReScanJsxAttributeValue(receiver: GoPtr<Scanner>): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  st.pos = st.fullStartPos;
  st.tokenStart = st.fullStartPos;
  return Scanner_ScanJsxAttributeValue(s);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ScanJSDocCommentTextToken","kind":"method","status":"implemented","sigHash":"b25724dcb2e01691a417a9380986cfe33b8f7de6f690579a3796a93b7d5faac1","bodyHash":"8da06f84d8bc2c4d92e4b94e9345637ef702a4dbcf0481db3b31d3f88df0c58e"}
 *
 * Go source:
 * func (s *Scanner) ScanJSDocCommentTextToken(inBackticks bool) ast.Kind {
 * 	s.fullStartPos = s.pos
 * 	s.tokenFlags = ast.TokenFlagsNone
 * 	if s.pos >= len(s.text) {
 * 		s.token = ast.KindEndOfFile
 * 		return s.token
 * 	}
 * 	s.tokenStart = s.pos
 * 	for ch, size := s.charAndSize(); s.pos < len(s.text) && !stringutil.IsLineBreak(ch) && ch != '`'; ch, size = s.charAndSize() {
 * 		if !inBackticks {
 * 			if ch == '{' {
 * 				break
 * 			} else if ch == '@' && s.pos >= 0 {
 * 				// @ doesn't start a new tag inside ``, and elsewhere, only after whitespace and before identifier
 * 				previous, _ := utf8.DecodeLastRuneInString(s.text[:s.pos])
 * 				if stringutil.IsWhiteSpaceSingleLine(previous) {
 * 					next, _ := utf8.DecodeRuneInString(s.text[s.pos+size:])
 * 					if IsIdentifierStart(next) {
 * 						break
 * 					}
 * 				}
 * 			}
 * 		}
 * 		s.pos += size
 * 	}
 * 	if s.pos == s.tokenStart {
 * 		return s.ScanJSDocToken()
 * 	}
 * 	s.tokenValue = s.text[s.tokenStart:s.pos]
 * 	s.token = ast.KindJSDocCommentTextToken
 * 	return s.token
 * }
 */
export function Scanner_ScanJSDocCommentTextToken(receiver: GoPtr<Scanner>, inBackticks: bool): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  st.fullStartPos = st.pos;
  st.tokenFlags = TokenFlagsNone;
  if (st.pos >= byteLen(s.text)) {
    st.token = KindEndOfFile;
    return st.token;
  }
  st.tokenStart = st.pos;
  for (
    let [ch, size] = Scanner_charAndSize(s);
    st.pos < byteLen(s.text) && !IsLineBreak(ch) && ch !== "`".charCodeAt(0);
    [ch, size] = Scanner_charAndSize(s)
  ) {
    if (!inBackticks) {
      if (ch === "{".charCodeAt(0)) {
        break;
      } else if (ch === "@".charCodeAt(0) && st.pos >= 0) {
        // @ doesn't start a new tag inside ``, and elsewhere, only after whitespace and before identifier
        const [previous] = decodeLastRuneInStringBefore(s.text, st.pos);
        if (IsWhiteSpaceSingleLine(previous)) {
          const [next] = decodeRuneInStringAt(s.text, st.pos + size);
          if (IsIdentifierStart(next)) {
            break;
          }
        }
      }
    }
    st.pos += size;
  }
  if (st.pos === st.tokenStart) {
    return Scanner_ScanJSDocToken(s);
  }
  st.tokenValue = byteSlice(s.text, st.tokenStart, st.pos);
  st.token = KindJSDocCommentTextToken;
  return st.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.CanFollowJSDocAt","kind":"method","status":"implemented","sigHash":"4a27df09b7ff46d72e20dd20d9e9c6749399088a951da1439b55faf85e9555f9","bodyHash":"f9b1b1446a237af9c0261e86533b4faf99c768083ac1e6ece80c32a451cd67cb"}
 *
 * Go source:
 * func (s *Scanner) CanFollowJSDocAt() bool {
 * 	if s.pos >= len(s.text) {
 * 		return true
 * 	}
 * 	ch, _ := utf8.DecodeRuneInString(s.text[s.pos:])
 * 	return IsIdentifierStart(ch) || stringutil.IsWhiteSpaceSingleLine(ch) || stringutil.IsLineBreak(ch)
 * }
 */
export function Scanner_CanFollowJSDocAt(receiver: GoPtr<Scanner>): bool {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  if (st.pos >= byteLen(s.text)) {
    return true;
  }
  const [ch] = decodeRuneInStringAt(s.text, st.pos);
  return IsIdentifierStart(ch) || IsWhiteSpaceSingleLine(ch) || IsLineBreak(ch);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ScanJSDocToken","kind":"method","status":"implemented","sigHash":"6b4ef73eabac22e1f1fefd885de1a646dca34c8bf9791d541412fd6726a1e0ac","bodyHash":"f2dfddd5e40e6dd75d42d8cad12ca959b62d59d104e0e22375ae89e2674ff0f9"}
 *
 * Go source:
 * func (s *Scanner) ScanJSDocToken() ast.Kind {
 * 	s.fullStartPos = s.pos
 * 	s.tokenFlags = ast.TokenFlagsNone
 * 	if s.pos >= len(s.text) {
 * 		s.token = ast.KindEndOfFile
 * 		return s.token
 * 	}
 * 
 * 	s.tokenStart = s.pos
 * 	ch, size := s.charAndSize()
 * 	s.pos += size
 * 	switch ch {
 * 	case '\t', '\v', '\f', ' ':
 * 		for ch2, size2 := s.charAndSize(); size2 > 0 && stringutil.IsWhiteSpaceSingleLine(ch2); ch2, size2 = s.charAndSize() {
 * 			s.pos += size2
 * 		}
 * 		s.token = ast.KindWhitespaceTrivia
 * 		return s.token
 * 	case '@':
 * 		s.token = ast.KindAtToken
 * 		return s.token
 * 	case '\r':
 * 		if s.char() == '\n' {
 * 			s.pos++
 * 		}
 * 		fallthrough
 * 	case '\n':
 * 		s.tokenFlags |= ast.TokenFlagsPrecedingLineBreak
 * 		s.token = ast.KindNewLineTrivia
 * 		return s.token
 * 	case '*':
 * 		s.token = ast.KindAsteriskToken
 * 		return s.token
 * 	case '{':
 * 		s.token = ast.KindOpenBraceToken
 * 		return s.token
 * 	case '}':
 * 		s.token = ast.KindCloseBraceToken
 * 		return s.token
 * 	case '[':
 * 		s.token = ast.KindOpenBracketToken
 * 		return s.token
 * 	case ']':
 * 		s.token = ast.KindCloseBracketToken
 * 		return s.token
 * 	case '(':
 * 		s.token = ast.KindOpenParenToken
 * 		return s.token
 * 	case ')':
 * 		s.token = ast.KindCloseParenToken
 * 		return s.token
 * 	case '<':
 * 		s.token = ast.KindLessThanToken
 * 		return s.token
 * 	case '>':
 * 		s.token = ast.KindGreaterThanToken
 * 		return s.token
 * 	case '=':
 * 		s.token = ast.KindEqualsToken
 * 		return s.token
 * 	case ',':
 * 		s.token = ast.KindCommaToken
 * 		return s.token
 * 	case '.':
 * 		s.token = ast.KindDotToken
 * 		return s.token
 * 	case '`':
 * 		s.token = ast.KindBacktickToken
 * 		return s.token
 * 	case '#':
 * 		s.token = ast.KindHashToken
 * 		return s.token
 * 	case '\\':
 * 		s.pos--
 * 		cp := s.peekUnicodeEscape()
 * 		if cp >= 0 && IsIdentifierStart(cp) {
 * 			s.tokenValue = string(s.scanUnicodeEscape(true)) + s.scanIdentifierParts()
 * 			s.token = GetIdentifierToken(s.tokenValue)
 * 		} else {
 * 			s.pos++
 * 			s.token = ast.KindUnknown
 * 		}
 * 		return s.token
 * 	}
 * 
 * 	if IsIdentifierStart(ch) {
 * 		char := ch
 * 		for {
 * 			if s.pos >= len(s.text) {
 * 				break
 * 			}
 * 			char, size = s.charAndSize()
 * 			if !IsIdentifierPart(char) && char != '-' {
 * 				break
 * 			}
 * 			s.pos += size
 * 		}
 * 		s.tokenValue = s.text[s.tokenStart:s.pos]
 * 		if char == '\\' {
 * 			s.tokenValue += s.scanIdentifierParts()
 * 		}
 * 		s.token = GetIdentifierToken(s.tokenValue)
 * 		return s.token
 * 	} else {
 * 		s.token = ast.KindUnknown
 * 		return s.token
 * 	}
 * }
 */
export function Scanner_ScanJSDocToken(receiver: GoPtr<Scanner>): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  st.fullStartPos = st.pos;
  st.tokenFlags = TokenFlagsNone;
  if (st.pos >= byteLen(s.text)) {
    st.token = KindEndOfFile;
    return st.token;
  }

  st.tokenStart = st.pos;
  let [ch, size] = Scanner_charAndSize(s);
  st.pos += size;
  switch (ch) {
    case "\t".charCodeAt(0):
    case "\v".charCodeAt(0):
    case "\f".charCodeAt(0):
    case " ".charCodeAt(0): {
      for (let [ch2, size2] = Scanner_charAndSize(s); size2 > 0 && IsWhiteSpaceSingleLine(ch2); [ch2, size2] = Scanner_charAndSize(s)) {
        st.pos += size2;
      }
      st.token = KindWhitespaceTrivia;
      return st.token;
    }
    case "@".charCodeAt(0):
      st.token = KindAtToken;
      return st.token;
    case "\r".charCodeAt(0): {
      if (Scanner_char(s) === "\n".charCodeAt(0)) {
        st.pos++;
      }
      // fallthrough to '\n'
      st.tokenFlags |= TokenFlagsPrecedingLineBreak;
      st.token = KindNewLineTrivia;
      return st.token;
    }
    case "\n".charCodeAt(0):
      st.tokenFlags |= TokenFlagsPrecedingLineBreak;
      st.token = KindNewLineTrivia;
      return st.token;
    case "*".charCodeAt(0):
      st.token = KindAsteriskToken;
      return st.token;
    case "{".charCodeAt(0):
      st.token = KindOpenBraceToken;
      return st.token;
    case "}".charCodeAt(0):
      st.token = KindCloseBraceToken;
      return st.token;
    case "[".charCodeAt(0):
      st.token = KindOpenBracketToken;
      return st.token;
    case "]".charCodeAt(0):
      st.token = KindCloseBracketToken;
      return st.token;
    case "(".charCodeAt(0):
      st.token = KindOpenParenToken;
      return st.token;
    case ")".charCodeAt(0):
      st.token = KindCloseParenToken;
      return st.token;
    case "<".charCodeAt(0):
      st.token = KindLessThanToken;
      return st.token;
    case ">".charCodeAt(0):
      st.token = KindGreaterThanToken;
      return st.token;
    case "=".charCodeAt(0):
      st.token = KindEqualsToken;
      return st.token;
    case ",".charCodeAt(0):
      st.token = KindCommaToken;
      return st.token;
    case ".".charCodeAt(0):
      st.token = KindDotToken;
      return st.token;
    case "`".charCodeAt(0):
      st.token = KindBacktickToken;
      return st.token;
    case "#".charCodeAt(0):
      st.token = KindHashToken;
      return st.token;
    case "\\".charCodeAt(0): {
      st.pos--;
      const cp = Scanner_peekUnicodeEscape(s);
      if (cp >= 0 && IsIdentifierStart(cp)) {
        st.tokenValue = stringFromRune(Scanner_scanUnicodeEscape(s, true)) + Scanner_scanIdentifierParts(s);
        st.token = GetIdentifierToken(st.tokenValue);
      } else {
        st.pos++;
        st.token = KindUnknown;
      }
      return st.token;
    }
  }

  if (IsIdentifierStart(ch)) {
    let char = ch;
    for (;;) {
      if (st.pos >= byteLen(s.text)) {
        break;
      }
      [char, size] = Scanner_charAndSize(s);
      if (!IsIdentifierPart(char) && char !== "-".charCodeAt(0)) {
        break;
      }
      st.pos += size;
    }
    st.tokenValue = byteSlice(s.text, st.tokenStart, st.pos);
    if (char === "\\".charCodeAt(0)) {
      st.tokenValue += Scanner_scanIdentifierParts(s);
    }
    st.token = GetIdentifierToken(st.tokenValue);
    return st.token;
  } else {
    st.token = KindUnknown;
    return st.token;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanIdentifier","kind":"method","status":"implemented","sigHash":"8d0b6ebcb4ea537e635fa8157441f3c091dc975721578bcc8957a7d672b26a75","bodyHash":"523fbd9aa998110ee9bd1144779b0871344f8c2eabd3d910b7f5531828cae9dc"}
 *
 * Go source:
 * func (s *Scanner) scanIdentifier(prefixLength int) bool {
 * 	start := s.pos
 * 	s.pos += prefixLength
 * 	ch := s.char()
 * 	// Fast path for simple ASCII identifiers
 * 	if stringutil.IsASCIILetter(ch) || ch == '_' || ch == '$' {
 * 		for {
 * 			s.pos++
 * 			ch = s.char()
 * 			if !(isWordCharacter(ch) || ch == '$') {
 * 				break
 * 			}
 * 		}
 * 		if ch < utf8.RuneSelf && ch != '\\' {
 * 			s.tokenValue = s.text[start:s.pos]
 * 			return true
 * 		}
 * 		s.pos = start + prefixLength
 * 	}
 * 	ch, size := s.charAndSize()
 * 	if IsIdentifierStart(ch) {
 * 		for {
 * 			s.pos += size
 * 			ch, size = s.charAndSize()
 * 			if !IsIdentifierPart(ch) {
 * 				break
 * 			}
 * 		}
 * 		s.tokenValue = s.text[start:s.pos]
 * 		if ch == '\\' {
 * 			s.tokenValue += s.scanIdentifierParts()
 * 		}
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Scanner_scanIdentifier(receiver: GoPtr<Scanner>, prefixLength: int): bool {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  const start = st.pos;
  st.pos += prefixLength;
  let ch = Scanner_char(s);
  // Fast path for simple ASCII identifiers
  if (IsASCIILetter(ch) || ch === "_".charCodeAt(0) || ch === "$".charCodeAt(0)) {
    for (;;) {
      st.pos++;
      ch = Scanner_char(s);
      if (!(isWordCharacter(ch) || ch === "$".charCodeAt(0))) {
        break;
      }
    }
    if (ch < utf8.RuneSelf && ch !== "\\".charCodeAt(0)) {
      st.tokenValue = byteSlice(s.text, start, st.pos);
      return true;
    }
    st.pos = start + prefixLength;
  }
  let size: int;
  [ch, size] = Scanner_charAndSize(s);
  if (IsIdentifierStart(ch)) {
    for (;;) {
      st.pos += size;
      [ch, size] = Scanner_charAndSize(s);
      if (!IsIdentifierPart(ch)) {
        break;
      }
    }
    st.tokenValue = byteSlice(s.text, start, st.pos);
    if (ch === "\\".charCodeAt(0)) {
      st.tokenValue += Scanner_scanIdentifierParts(s);
    }
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanIdentifierParts","kind":"method","status":"implemented","sigHash":"0a7d8fb99511f040ab34d0ad3591ef186e84aef7e98d7af97eea5781856eacc5","bodyHash":"264d1bc94929fff862234c00e3f9b633702cd0cf97e431678130d92036a1481b"}
 *
 * Go source:
 * func (s *Scanner) scanIdentifierParts() string {
 * 	var sb strings.Builder
 * 	start := s.pos
 * 	for {
 * 		ch, size := s.charAndSize()
 * 		if IsIdentifierPart(ch) {
 * 			s.pos += size
 * 			continue
 * 		}
 * 		if ch == '\\' {
 * 			escaped := s.peekUnicodeEscape()
 * 			if escaped >= 0 && IsIdentifierPart(escaped) {
 * 				sb.WriteString(s.text[start:s.pos])
 * 				sb.WriteRune(s.scanUnicodeEscape(true))
 * 				start = s.pos
 * 				continue
 * 			}
 * 		}
 * 		break
 * 	}
 * 	sb.WriteString(s.text[start:s.pos])
 * 	return sb.String()
 * }
 */
export function Scanner_scanIdentifierParts(receiver: GoPtr<Scanner>): string {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  const sb = new Builder();
  let start = st.pos;
  for (;;) {
    const [ch, size] = Scanner_charAndSize(s);
    if (IsIdentifierPart(ch)) {
      st.pos += size;
      continue;
    }
    if (ch === "\\".charCodeAt(0)) {
      const escaped = Scanner_peekUnicodeEscape(s);
      if (escaped >= 0 && IsIdentifierPart(escaped)) {
        sb.WriteString(byteSlice(s.text, start, st.pos));
        sb.WriteRune(Scanner_scanUnicodeEscape(s, true));
        start = st.pos;
        continue;
      }
    }
    break;
  }
  sb.WriteString(byteSlice(s.text, start, st.pos));
  return sb.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanString","kind":"method","status":"implemented","sigHash":"4bd87ff6951a51fbdfe3e56c4f24684dec346fba5ba02c9830f4be9c6ba11379","bodyHash":"1c8c44333fc0d8acc0c2be7680bc12ceae31d0b7b4271bf8688b738cc45d5e4c"}
 *
 * Go source:
 * func (s *Scanner) scanString(jsxAttributeString bool) string {
 * 	quote := s.char()
 * 	if quote == '\'' {
 * 		s.tokenFlags |= ast.TokenFlagsSingleQuote
 * 	}
 * 	s.pos++
 * 	// Fast path for simple strings without escape sequences.
 * 	strLen := strings.IndexRune(s.text[s.pos:], quote)
 * 	if strLen == 0 {
 * 		s.pos++
 * 		return ""
 * 	}
 * 	if strLen > 0 {
 * 		str := s.text[s.pos : s.pos+strLen]
 * 		if !jsxAttributeString && !strings.ContainsAny(str, "\r\n\\") {
 * 			s.pos += strLen + 1
 * 			return str
 * 		}
 * 	}
 * 	var sb strings.Builder
 * 	start := s.pos
 * 	for {
 * 		ch := s.char()
 * 		if ch < 0 {
 * 			sb.WriteString(s.text[start:s.pos])
 * 			s.tokenFlags |= ast.TokenFlagsUnterminated
 * 			s.error(diagnostics.Unterminated_string_literal)
 * 			break
 * 		}
 * 		if ch == quote {
 * 			sb.WriteString(s.text[start:s.pos])
 * 			s.pos++
 * 			break
 * 		}
 * 		if ch == '\\' && !jsxAttributeString {
 * 			sb.WriteString(s.text[start:s.pos])
 * 			sb.WriteString(s.scanEscapeSequence(EscapeSequenceScanningFlagsString | EscapeSequenceScanningFlagsReportErrors))
 * 			start = s.pos
 * 			continue
 * 		}
 * 		if (ch == '\n' || ch == '\r') && !jsxAttributeString {
 * 			sb.WriteString(s.text[start:s.pos])
 * 			s.tokenFlags |= ast.TokenFlagsUnterminated
 * 			s.error(diagnostics.Unterminated_string_literal)
 * 			break
 * 		}
 * 		s.pos++
 * 	}
 * 	return sb.String()
 * }
 */
export function Scanner_scanString(receiver: GoPtr<Scanner>, jsxAttributeString: bool): string {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  const quote = Scanner_char(s);
  if (quote === "'".charCodeAt(0)) {
    st.tokenFlags |= TokenFlagsSingleQuote;
  }
  st.pos++;
  // Fast path for simple strings without escape sequences.
  const strLen = strings.IndexRune(byteSlice(s.text, st.pos), quote);
  if (strLen === 0) {
    st.pos++;
    return "";
  }
  if (strLen > 0) {
    const str = byteSlice(s.text, st.pos, st.pos + strLen);
    if (!jsxAttributeString && !strings.ContainsAny(str, "\r\n\\")) {
      st.pos += strLen + 1;
      return str;
    }
  }
  const sb = new Builder();
  let start = st.pos;
  for (;;) {
    const ch = Scanner_char(s);
    if (ch < 0) {
      sb.WriteString(byteSlice(s.text, start, st.pos));
      st.tokenFlags |= TokenFlagsUnterminated;
      Scanner_error(s, Unterminated_string_literal);
      break;
    }
    if (ch === quote) {
      sb.WriteString(byteSlice(s.text, start, st.pos));
      st.pos++;
      break;
    }
    if (ch === "\\".charCodeAt(0) && !jsxAttributeString) {
      sb.WriteString(byteSlice(s.text, start, st.pos));
      sb.WriteString(Scanner_scanEscapeSequence(s, EscapeSequenceScanningFlagsString | EscapeSequenceScanningFlagsReportErrors));
      start = st.pos;
      continue;
    }
    if ((ch === "\n".charCodeAt(0) || ch === "\r".charCodeAt(0)) && !jsxAttributeString) {
      sb.WriteString(byteSlice(s.text, start, st.pos));
      st.tokenFlags |= TokenFlagsUnterminated;
      Scanner_error(s, Unterminated_string_literal);
      break;
    }
    st.pos++;
  }
  return sb.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanTemplateAndSetTokenValue","kind":"method","status":"implemented","sigHash":"cdb72c37603e1f52d47695665dc1968c946dc859b904297162a536d5ddaede2e","bodyHash":"f5e1e77671ad2709ee424134f7327f337206cd1e0e47971ab21fa419c460a63d"}
 *
 * Go source:
 * func (s *Scanner) scanTemplateAndSetTokenValue(shouldEmitInvalidEscapeError bool) ast.Kind {
 * 	startedWithBacktick := s.char() == '`'
 * 	s.pos++
 * 	start := s.pos
 * 	parts := make([]string, 0, 4)
 * 	var token ast.Kind
 * 	for {
 * 		ch := s.char()
 * 		if ch < 0 || ch == '`' {
 * 			parts = append(parts, s.text[start:s.pos])
 * 			if ch == '`' {
 * 				s.pos++
 * 			} else {
 * 				s.tokenFlags |= ast.TokenFlagsUnterminated
 * 				s.error(diagnostics.Unterminated_template_literal)
 * 			}
 * 			token = core.IfElse(startedWithBacktick, ast.KindNoSubstitutionTemplateLiteral, ast.KindTemplateTail)
 * 			break
 * 		}
 * 		if ch == '$' && s.charAt(1) == '{' {
 * 			parts = append(parts, s.text[start:s.pos])
 * 			s.pos += 2
 * 			token = core.IfElse(startedWithBacktick, ast.KindTemplateHead, ast.KindTemplateMiddle)
 * 			break
 * 		}
 * 		if ch == '\\' {
 * 			parts = append(parts, s.text[start:s.pos])
 * 			parts = append(parts, s.scanEscapeSequence(EscapeSequenceScanningFlagsString|core.IfElse(shouldEmitInvalidEscapeError, EscapeSequenceScanningFlagsReportErrors, 0)))
 * 			start = s.pos
 * 			continue
 * 		}
 * 		// Speculated ECMAScript 6 Spec 11.8.6.1:
 * 		// <CR><LF> and <CR> LineTerminatorSequences are normalized to <LF> for Template Values
 * 		if ch == '\r' {
 * 			parts = append(parts, s.text[start:s.pos])
 * 			s.pos++
 * 			if s.char() == '\n' {
 * 				s.pos++
 * 			}
 * 			parts = append(parts, "\n")
 * 			start = s.pos
 * 			continue
 * 		}
 * 		s.pos++
 * 	}
 * 	s.tokenValue = strings.Join(parts, "")
 * 	return token
 * }
 */
export function Scanner_scanTemplateAndSetTokenValue(receiver: GoPtr<Scanner>, shouldEmitInvalidEscapeError: bool): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  const startedWithBacktick = Scanner_char(s) === "`".charCodeAt(0);
  st.pos++;
  let start = st.pos;
  const parts: GoSlice<string> = [];
  let token: Kind = KindUnknown;
  for (;;) {
    const ch = Scanner_char(s);
    if (ch < 0 || ch === "`".charCodeAt(0)) {
      parts.push(byteSlice(s.text, start, st.pos));
      if (ch === "`".charCodeAt(0)) {
        st.pos++;
      } else {
        st.tokenFlags |= TokenFlagsUnterminated;
        Scanner_error(s, Unterminated_template_literal);
      }
      token = IfElse(startedWithBacktick, KindNoSubstitutionTemplateLiteral, KindTemplateTail);
      break;
    }
    if (ch === "$".charCodeAt(0) && Scanner_charAt(s, 1) === "{".charCodeAt(0)) {
      parts.push(byteSlice(s.text, start, st.pos));
      st.pos += 2;
      token = IfElse(startedWithBacktick, KindTemplateHead, KindTemplateMiddle);
      break;
    }
    if (ch === "\\".charCodeAt(0)) {
      parts.push(byteSlice(s.text, start, st.pos));
      parts.push(Scanner_scanEscapeSequence(s, EscapeSequenceScanningFlagsString | IfElse(shouldEmitInvalidEscapeError, EscapeSequenceScanningFlagsReportErrors, 0)));
      start = st.pos;
      continue;
    }
    // Speculated ECMAScript 6 Spec 11.8.6.1:
    // <CR><LF> and <CR> LineTerminatorSequences are normalized to <LF> for Template Values
    if (ch === "\r".charCodeAt(0)) {
      parts.push(byteSlice(s.text, start, st.pos));
      st.pos++;
      if (Scanner_char(s) === "\n".charCodeAt(0)) {
        st.pos++;
      }
      parts.push("\n");
      start = st.pos;
      continue;
    }
    st.pos++;
  }
  st.tokenValue = strings.Join(parts, "");
  return token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanEscapeSequence","kind":"method","status":"implemented","sigHash":"ee4e8e838a412353a31302b798a09ce4608c22fbd9cf5e6cbad8cb37cac4df06","bodyHash":"103bfd6aed1874f7135de2c06ae8eeee440e1ff940c9a1d4632d880382d29db3"}
 *
 * Go source:
 * func (s *Scanner) scanEscapeSequence(flags EscapeSequenceScanningFlags) string {
 * 	start := s.pos
 * 	s.pos++
 * 	ch := s.char()
 * 	if ch < 0 {
 * 		s.error(diagnostics.Unexpected_end_of_text)
 * 		return ""
 * 	}
 * 	s.pos++
 * 	switch ch {
 * 	case '0':
 * 		// Although '0' preceding any digit is treated as LegacyOctalEscapeSequence,
 * 		// '\08' should separately be interpreted as '\0' + '8'.
 * 		if !stringutil.IsDigit(s.char()) {
 * 			return "\x00"
 * 		}
 * 		// '\01', '\011'
 * 		fallthrough
 * 	case '1', '2', '3':
 * 		// '\1', '\17', '\177'
 * 		if stringutil.IsOctalDigit(s.char()) {
 * 			s.pos++
 * 		}
 * 		// '\17', '\177'
 * 		fallthrough
 * 	case '4', '5', '6', '7':
 * 		// '\4', '\47' but not '\477'
 * 		if stringutil.IsOctalDigit(s.char()) {
 * 			s.pos++
 * 		}
 * 		// '\47'
 * 		s.tokenFlags |= ast.TokenFlagsContainsInvalidEscape
 * 		if flags&EscapeSequenceScanningFlagsReportInvalidEscapeErrors != 0 {
 * 			code, _ := strconv.ParseInt(s.text[start+1:s.pos], 8, 32)
 * 			if flags&EscapeSequenceScanningFlagsRegularExpression != 0 && flags&EscapeSequenceScanningFlagsAtomEscape == 0 && ch != '0' {
 * 				s.errorAt(diagnostics.Octal_escape_sequences_and_backreferences_are_not_allowed_in_a_character_class_If_this_was_intended_as_an_escape_sequence_use_the_syntax_0_instead, start, s.pos-start, fmt.Sprintf("\\x%02x", code))
 * 			} else {
 * 				s.errorAt(diagnostics.Octal_escape_sequences_are_not_allowed_Use_the_syntax_0, start, s.pos-start, fmt.Sprintf("\\x%02x", code))
 * 			}
 * 			return string(rune(code))
 * 		}
 * 		return s.text[start:s.pos]
 * 	case '8', '9':
 * 		// the invalid '\8' and '\9'
 * 		s.tokenFlags |= ast.TokenFlagsContainsInvalidEscape
 * 		if flags&EscapeSequenceScanningFlagsReportInvalidEscapeErrors != 0 {
 * 			if flags&EscapeSequenceScanningFlagsRegularExpression != 0 && flags&EscapeSequenceScanningFlagsAtomEscape == 0 {
 * 				s.errorAt(diagnostics.Decimal_escape_sequences_and_backreferences_are_not_allowed_in_a_character_class, start, s.pos-start)
 * 			} else {
 * 				s.errorAt(diagnostics.Escape_sequence_0_is_not_allowed, start, s.pos-start, s.text[start:s.pos])
 * 			}
 * 			return string(ch)
 * 		}
 * 		return s.text[start:s.pos]
 * 	case 'b':
 * 		return "\b"
 * 	case 't':
 * 		return "\t"
 * 	case 'n':
 * 		return "\n"
 * 	case 'v':
 * 		return "\v"
 * 	case 'f':
 * 		return "\f"
 * 	case 'r':
 * 		return "\r"
 * 	case '\'':
 * 		return "'"
 * 	case '"':
 * 		return "\""
 * 	case 'u':
 * 		// '\uDDDD' and '\u{DDDDDD}'
 * 		extended := s.char() == '{'
 * 		s.pos -= 2
 * 		codePoint := s.scanUnicodeEscape(flags&EscapeSequenceScanningFlagsReportInvalidEscapeErrors != 0)
 * 		if extended {
 * 			if flags&EscapeSequenceScanningFlagsAllowExtendedUnicodeEscape == 0 {
 * 				s.tokenFlags |= ast.TokenFlagsContainsInvalidEscape
 * 				if flags&EscapeSequenceScanningFlagsReportInvalidEscapeErrors != 0 {
 * 					s.errorAt(diagnostics.Unicode_escape_sequences_are_only_available_when_the_Unicode_u_flag_or_the_Unicode_Sets_v_flag_is_set, start, s.pos-start)
 * 				}
 * 			}
 * 			if codePoint < 0 {
 * 				return s.text[start:s.pos]
 * 			}
 * 			return string(codePoint)
 * 		}
 * 		if codePoint < 0 {
 * 			return s.text[start:s.pos]
 * 		} else if codePointIsHighSurrogate(codePoint) &&
 * 			(flags&EscapeSequenceScanningFlagsRegularExpression == 0 || flags&EscapeSequenceScanningFlagsAnyUnicodeMode != 0) &&
 * 			s.char() == '\\' && s.charAt(1) == 'u' && s.charAt(2) != '{' {
 * 			// Combine \uHigh\uLow into a single code point in string literals (always) and
 * 			// in regex AnyUnicodeMode. In non-unicode regex mode they are separate atoms.
 * 			savedPos := s.pos
 * 			nextCodePoint := s.scanUnicodeEscape(flags&EscapeSequenceScanningFlagsReportInvalidEscapeErrors != 0)
 * 			if codePointIsLowSurrogate(nextCodePoint) {
 * 				return string(surrogatePairToCodepoint(codePoint, nextCodePoint))
 * 			}
 * 			s.pos = savedPos
 * 			if flags&EscapeSequenceScanningFlagsRegularExpression != 0 {
 * 				return encodeSurrogate(codePoint)
 * 			}
 * 		} else if (codePointIsHighSurrogate(codePoint) || codePointIsLowSurrogate(codePoint)) &&
 * 			flags&EscapeSequenceScanningFlagsRegularExpression != 0 {
 * 			// Lone surrogate inside a non-unicode regex: encode as CESU-8 so scanClassRanges
 * 			// can compare surrogates numerically. Must NOT apply to string literals.
 * 			return encodeSurrogate(codePoint)
 * 		}
 * 		return string(codePoint)
 * 	case 'x':
 * 		// '\xDD'
 * 		for ; s.pos < start+4; s.pos++ {
 * 			if !stringutil.IsHexDigit(s.char()) {
 * 				s.tokenFlags |= ast.TokenFlagsContainsInvalidEscape
 * 				if flags&EscapeSequenceScanningFlagsReportInvalidEscapeErrors != 0 {
 * 					s.error(diagnostics.Hexadecimal_digit_expected)
 * 				}
 * 				return s.text[start:s.pos]
 * 			}
 * 		}
 * 		s.tokenFlags |= ast.TokenFlagsHexEscape
 * 		escapedValue, _ := strconv.ParseInt(s.text[start+2:s.pos], 16, 32)
 * 		return string(rune(escapedValue))
 * 	case '\r':
 * 		// when encountering a LineContinuation (i.e. a backslash and a line terminator sequence),
 * 		// the line terminator is interpreted to be "the empty code unit sequence".
 * 		if s.char() == '\n' {
 * 			s.pos++
 * 		}
 * 		fallthrough
 * 	case '\n':
 * 		// case CharacterCodes.lineSeparator !!!
 * 		// case CharacterCodes.paragraphSeparator !!!
 * 		return ""
 * 	default:
 * 		if flags&EscapeSequenceScanningFlagsAnyUnicodeMode != 0 || flags&EscapeSequenceScanningFlagsRegularExpression != 0 && flags&EscapeSequenceScanningFlagsAnnexB == 0 && IsIdentifierPart(ch) {
 * 			s.errorAt(diagnostics.This_character_cannot_be_escaped_in_a_regular_expression, s.pos-2, 2)
 * 		}
 * 		return string(ch)
 * 	}
 * }
 */
export function Scanner_scanEscapeSequence(receiver: GoPtr<Scanner>, flags: EscapeSequenceScanningFlags): string {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  const start = st.pos;
  st.pos++;
  const ch = Scanner_char(s);
  if (ch < 0) {
    Scanner_error(s, Unexpected_end_of_text);
    return "";
  }
  st.pos++;
  // Octal-escape tail shared by cases '0'..'7' via Go fallthrough.
  // octalStage tracks how far through the fallthrough chain we entered:
  // 0 -> entered at '0' (and was followed by a digit), 1 -> entered at '1'..'3',
  // 4 -> entered at '4'..'7'.
  const scanOctalTail = (): string => {
    // '\4', '\47' but not '\477' (final octal digit consumption)
    if (IsOctalDigit(Scanner_char(s))) {
      st.pos++;
    }
    // '\47'
    st.tokenFlags |= TokenFlagsContainsInvalidEscape;
    if ((flags & EscapeSequenceScanningFlagsReportInvalidEscapeErrors) !== 0) {
      const [code] = strconv.ParseInt(byteSlice(s.text, start + 1, st.pos), 8, 32);
      if ((flags & EscapeSequenceScanningFlagsRegularExpression) !== 0 && (flags & EscapeSequenceScanningFlagsAtomEscape) === 0 && ch !== "0".charCodeAt(0)) {
        Scanner_errorAt(s, Octal_escape_sequences_and_backreferences_are_not_allowed_in_a_character_class_If_this_was_intended_as_an_escape_sequence_use_the_syntax_0_instead, start, st.pos - start, fmt.Sprintf("\\x%02x", code));
      } else {
        Scanner_errorAt(s, Octal_escape_sequences_are_not_allowed_Use_the_syntax_0, start, st.pos - start, fmt.Sprintf("\\x%02x", code));
      }
      return stringFromRune(code);
    }
    return byteSlice(s.text, start, st.pos);
  };
  switch (ch) {
    case "0".charCodeAt(0): {
      // Although '0' preceding any digit is treated as LegacyOctalEscapeSequence,
      // '\08' should separately be interpreted as '\0' + '8'.
      if (!IsDigit(Scanner_char(s))) {
        return "\x00";
      }
      // '\01', '\011' -> fallthrough to '1','2','3'
      // '\1', '\17', '\177'
      if (IsOctalDigit(Scanner_char(s))) {
        st.pos++;
      }
      // '\17', '\177' -> fallthrough to '4'..'7'
      return scanOctalTail();
    }
    case "1".charCodeAt(0):
    case "2".charCodeAt(0):
    case "3".charCodeAt(0): {
      // '\1', '\17', '\177'
      if (IsOctalDigit(Scanner_char(s))) {
        st.pos++;
      }
      // '\17', '\177' -> fallthrough to '4'..'7'
      return scanOctalTail();
    }
    case "4".charCodeAt(0):
    case "5".charCodeAt(0):
    case "6".charCodeAt(0):
    case "7".charCodeAt(0): {
      return scanOctalTail();
    }
    case "8".charCodeAt(0):
    case "9".charCodeAt(0): {
      // the invalid '\8' and '\9'
      st.tokenFlags |= TokenFlagsContainsInvalidEscape;
      if ((flags & EscapeSequenceScanningFlagsReportInvalidEscapeErrors) !== 0) {
        if ((flags & EscapeSequenceScanningFlagsRegularExpression) !== 0 && (flags & EscapeSequenceScanningFlagsAtomEscape) === 0) {
          Scanner_errorAt(s, Decimal_escape_sequences_and_backreferences_are_not_allowed_in_a_character_class, start, st.pos - start);
        } else {
          Scanner_errorAt(s, Escape_sequence_0_is_not_allowed, start, st.pos - start, byteSlice(s.text, start, st.pos));
        }
        return stringFromRune(ch);
      }
      return byteSlice(s.text, start, st.pos);
    }
    case "b".charCodeAt(0):
      return "\b";
    case "t".charCodeAt(0):
      return "\t";
    case "n".charCodeAt(0):
      return "\n";
    case "v".charCodeAt(0):
      return "\v";
    case "f".charCodeAt(0):
      return "\f";
    case "r".charCodeAt(0):
      return "\r";
    case "'".charCodeAt(0):
      return "'";
    case '"'.charCodeAt(0):
      return '"';
    case "u".charCodeAt(0): {
      // '\uDDDD' and '\u{DDDDDD}'
      const extended = Scanner_char(s) === "{".charCodeAt(0);
      st.pos -= 2;
      const codePoint = Scanner_scanUnicodeEscape(s, (flags & EscapeSequenceScanningFlagsReportInvalidEscapeErrors) !== 0);
      if (extended) {
        if ((flags & EscapeSequenceScanningFlagsAllowExtendedUnicodeEscape) === 0) {
          st.tokenFlags |= TokenFlagsContainsInvalidEscape;
          if ((flags & EscapeSequenceScanningFlagsReportInvalidEscapeErrors) !== 0) {
            Scanner_errorAt(s, Unicode_escape_sequences_are_only_available_when_the_Unicode_u_flag_or_the_Unicode_Sets_v_flag_is_set, start, st.pos - start);
          }
        }
        if (codePoint < 0) {
          return byteSlice(s.text, start, st.pos);
        }
        return stringFromRune(codePoint);
      }
      if (codePoint < 0) {
        return byteSlice(s.text, start, st.pos);
      } else if (
        codePointIsHighSurrogate(codePoint) &&
        ((flags & EscapeSequenceScanningFlagsRegularExpression) === 0 || (flags & EscapeSequenceScanningFlagsAnyUnicodeMode) !== 0) &&
        Scanner_char(s) === "\\".charCodeAt(0) &&
        Scanner_charAt(s, 1) === "u".charCodeAt(0) &&
        Scanner_charAt(s, 2) !== "{".charCodeAt(0)
      ) {
        // Combine \uHigh\uLow into a single code point in string literals (always) and
        // in regex AnyUnicodeMode. In non-unicode regex mode they are separate atoms.
        const savedPos = st.pos;
        const nextCodePoint = Scanner_scanUnicodeEscape(s, (flags & EscapeSequenceScanningFlagsReportInvalidEscapeErrors) !== 0);
        if (codePointIsLowSurrogate(nextCodePoint)) {
          return stringFromRune(surrogatePairToCodepoint(codePoint, nextCodePoint));
        }
        st.pos = savedPos;
        if ((flags & EscapeSequenceScanningFlagsRegularExpression) !== 0) {
          return encodeSurrogate(codePoint);
        }
      } else if ((codePointIsHighSurrogate(codePoint) || codePointIsLowSurrogate(codePoint)) && (flags & EscapeSequenceScanningFlagsRegularExpression) !== 0) {
        // Lone surrogate inside a non-unicode regex: encode as CESU-8 so scanClassRanges
        // can compare surrogates numerically. Must NOT apply to string literals.
        return encodeSurrogate(codePoint);
      }
      return stringFromRune(codePoint);
    }
    case "x".charCodeAt(0): {
      // '\xDD'
      for (; st.pos < start + 4; st.pos++) {
        if (!IsHexDigit(Scanner_char(s))) {
          st.tokenFlags |= TokenFlagsContainsInvalidEscape;
          if ((flags & EscapeSequenceScanningFlagsReportInvalidEscapeErrors) !== 0) {
            Scanner_error(s, Hexadecimal_digit_expected);
          }
          return byteSlice(s.text, start, st.pos);
        }
      }
      st.tokenFlags |= TokenFlagsHexEscape;
      const [escapedValue] = strconv.ParseInt(byteSlice(s.text, start + 2, st.pos), 16, 32);
      return stringFromRune(escapedValue);
    }
    case "\r".charCodeAt(0): {
      // when encountering a LineContinuation (i.e. a backslash and a line terminator sequence),
      // the line terminator is interpreted to be "the empty code unit sequence".
      if (Scanner_char(s) === "\n".charCodeAt(0)) {
        st.pos++;
      }
      // fallthrough to '\n'
      // case CharacterCodes.lineSeparator !!!
      // case CharacterCodes.paragraphSeparator !!!
      return "";
    }
    case "\n".charCodeAt(0): {
      // case CharacterCodes.lineSeparator !!!
      // case CharacterCodes.paragraphSeparator !!!
      return "";
    }
    default: {
      if (
        (flags & EscapeSequenceScanningFlagsAnyUnicodeMode) !== 0 ||
        ((flags & EscapeSequenceScanningFlagsRegularExpression) !== 0 && (flags & EscapeSequenceScanningFlagsAnnexB) === 0 && IsIdentifierPart(ch))
      ) {
        Scanner_errorAt(s, This_character_cannot_be_escaped_in_a_regular_expression, st.pos - 2, 2);
      }
      return stringFromRune(ch);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanUnicodeEscape","kind":"method","status":"implemented","sigHash":"80e7172552dfdaccf7aef6dc5cc1c0310c3a707e33be09874e88077b19f2ae58","bodyHash":"8de13559085196d477ed33d55edf2b5d0db3f15b1bcdd845b58dbd80317641b6"}
 *
 * Go source:
 * func (s *Scanner) scanUnicodeEscape(shouldEmitInvalidEscapeError bool) rune {
 * 	s.pos += 2
 * 	start := s.pos
 * 	extended := s.char() == '{'
 * 	var hexDigits string
 * 	if extended {
 * 		s.pos++
 * 		hexDigits = s.scanHexDigits(1, true, false)
 * 	} else {
 * 		s.tokenFlags |= ast.TokenFlagsUnicodeEscape
 * 		hexDigits = s.scanHexDigits(4, false, false)
 * 	}
 * 	if hexDigits == "" {
 * 		s.tokenFlags |= ast.TokenFlagsContainsInvalidEscape
 * 		if shouldEmitInvalidEscapeError {
 * 			s.error(diagnostics.Hexadecimal_digit_expected)
 * 		}
 * 		return -1
 * 	}
 * 	hexValue, _ := strconv.ParseInt(hexDigits, 16, 32)
 * 	if extended {
 * 		isInvalidExtendedEscape := false
 * 		if hexValue > 0x10FFFF {
 * 			if shouldEmitInvalidEscapeError {
 * 				s.errorAt(diagnostics.An_extended_Unicode_escape_value_must_be_between_0x0_and_0x10FFFF_inclusive, start+1, s.pos-start-1)
 * 			}
 * 			isInvalidExtendedEscape = true
 * 		}
 * 		if s.pos >= s.end {
 * 			if shouldEmitInvalidEscapeError {
 * 				s.error(diagnostics.Unexpected_end_of_text)
 * 			}
 * 			isInvalidExtendedEscape = true
 * 		} else if s.char() == '}' {
 * 			s.pos++
 * 		} else {
 * 			if shouldEmitInvalidEscapeError {
 * 				s.error(diagnostics.Unterminated_Unicode_escape_sequence)
 * 			}
 * 			isInvalidExtendedEscape = true
 * 		}
 * 		if isInvalidExtendedEscape {
 * 			s.tokenFlags |= ast.TokenFlagsContainsInvalidEscape
 * 			return -1
 * 		}
 * 		s.tokenFlags |= ast.TokenFlagsExtendedUnicodeEscape
 * 	}
 * 	return rune(hexValue)
 * }
 */
export function Scanner_scanUnicodeEscape(receiver: GoPtr<Scanner>, shouldEmitInvalidEscapeError: bool): GoRune {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  st.pos += 2;
  const start = st.pos;
  const extended = Scanner_char(s) === "{".charCodeAt(0);
  let hexDigits: string;
  if (extended) {
    st.pos++;
    hexDigits = Scanner_scanHexDigits(s, 1, true, false);
  } else {
    st.tokenFlags |= TokenFlagsUnicodeEscape;
    hexDigits = Scanner_scanHexDigits(s, 4, false, false);
  }
  if (hexDigits === "") {
    st.tokenFlags |= TokenFlagsContainsInvalidEscape;
    if (shouldEmitInvalidEscapeError) {
      Scanner_error(s, Hexadecimal_digit_expected);
    }
    return -1;
  }
  const [hexValue] = strconv.ParseInt(hexDigits, 16, 32);
  if (extended) {
    let isInvalidExtendedEscape = false;
    if (hexValue > 0x10ffff) {
      if (shouldEmitInvalidEscapeError) {
        Scanner_errorAt(s, An_extended_Unicode_escape_value_must_be_between_0x0_and_0x10FFFF_inclusive, start + 1, st.pos - start - 1);
      }
      isInvalidExtendedEscape = true;
    }
    if (st.pos >= s.end) {
      if (shouldEmitInvalidEscapeError) {
        Scanner_error(s, Unexpected_end_of_text);
      }
      isInvalidExtendedEscape = true;
    } else if (Scanner_char(s) === "}".charCodeAt(0)) {
      st.pos++;
    } else {
      if (shouldEmitInvalidEscapeError) {
        Scanner_error(s, Unterminated_Unicode_escape_sequence);
      }
      isInvalidExtendedEscape = true;
    }
    if (isInvalidExtendedEscape) {
      st.tokenFlags |= TokenFlagsContainsInvalidEscape;
      return -1;
    }
    st.tokenFlags |= TokenFlagsExtendedUnicodeEscape;
  }
  return hexValue as GoRune;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.peekUnicodeEscape","kind":"method","status":"implemented","sigHash":"fa10a4a7af22d4c808e531c19fc17954c9991281da5bb3a3d4a4dd871e8329d1","bodyHash":"e250ce068130aa8b0286a47ede7bf5e8bc7697d6dac3d5fbd0466bbb4ad86ffd"}
 *
 * Go source:
 * func (s *Scanner) peekUnicodeEscape() rune {
 * 	if s.charAt(1) == 'u' {
 * 		savePos := s.pos
 * 		saveTokenFlags := s.tokenFlags
 * 		codePoint := s.scanUnicodeEscape(false)
 * 		s.pos = savePos
 * 		s.tokenFlags = saveTokenFlags
 * 		return codePoint
 * 	}
 * 	return -1
 * }
 */
export function Scanner_peekUnicodeEscape(receiver: GoPtr<Scanner>): GoRune {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  if (Scanner_charAt(s, 1) === "u".charCodeAt(0)) {
    const savePos = st.pos;
    const saveTokenFlags = st.tokenFlags;
    const codePoint = Scanner_scanUnicodeEscape(s, false);
    st.pos = savePos;
    st.tokenFlags = saveTokenFlags;
    return codePoint;
  }
  return -1;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanNumber","kind":"method","status":"implemented","sigHash":"a0b8ba021d0a5a9d013b09bd9ee72e7ba3553b04884ed0e7d4ef270d962646e5","bodyHash":"cabdc220c190914901a813149e1a3630c87fdd06fd132934c4a1768af0d7da0b"}
 *
 * Go source:
 * func (s *Scanner) scanNumber() ast.Kind {
 * 	start := s.pos
 * 	var fixedPart string
 * 	if s.char() == '0' {
 * 		s.pos++
 * 		if s.char() == '_' {
 * 			s.tokenFlags |= ast.TokenFlagsContainsSeparator | ast.TokenFlagsContainsInvalidSeparator
 * 			s.errorAt(diagnostics.Numeric_separators_are_not_allowed_here, s.pos, 1)
 * 			s.pos = start
 * 			fixedPart = s.scanNumberFragment()
 * 		} else {
 * 			digits, isOctal := s.scanDigits()
 * 			if digits == "" {
 * 				fixedPart = "0"
 * 			} else if !isOctal {
 * 				s.tokenFlags |= ast.TokenFlagsContainsLeadingZero
 * 				fixedPart = digits
 * 			} else {
 * 				val, _ := strconv.ParseInt(digits, 8, 64)
 * 				s.tokenValue = strconv.FormatInt(val, 10)
 * 				s.tokenFlags |= ast.TokenFlagsOctal
 * 				withMinus := s.token == ast.KindMinusToken
 * 				literal := core.IfElse(withMinus, "-", "") + "0o" + strconv.FormatInt(val, 8)
 * 				if withMinus {
 * 					start--
 * 				}
 * 				s.errorAt(diagnostics.Octal_literals_are_not_allowed_Use_the_syntax_0, start, s.pos-start, literal)
 * 				return ast.KindNumericLiteral
 * 			}
 * 		}
 * 	} else {
 * 		fixedPart = s.scanNumberFragment()
 * 	}
 * 	fixedPartEnd := s.pos
 * 	fractionalPart := ""
 * 	exponentPreamble := ""
 * 	exponentPart := ""
 * 	if s.char() == '.' {
 * 		s.pos++
 * 		fractionalPart = s.scanNumberFragment()
 * 	}
 * 	end := s.pos
 * 	if s.char() == 'E' || s.char() == 'e' {
 * 		s.pos++
 * 		s.tokenFlags |= ast.TokenFlagsScientific
 * 		if s.char() == '+' || s.char() == '-' {
 * 			s.pos++
 * 		}
 * 		startNumericPart := s.pos
 * 		exponentPart = s.scanNumberFragment()
 * 		if exponentPart == "" {
 * 			s.error(diagnostics.Digit_expected)
 * 		} else {
 * 			exponentPreamble = s.text[end:startNumericPart]
 * 			end = s.pos
 * 		}
 * 	}
 * 	if s.tokenFlags&ast.TokenFlagsContainsSeparator != 0 {
 * 		s.tokenValue = fixedPart
 * 		if fractionalPart != "" {
 * 			s.tokenValue += "." + fractionalPart
 * 		}
 * 		if exponentPart != "" {
 * 			s.tokenValue += exponentPreamble + exponentPart
 * 		}
 * 	} else {
 * 		s.tokenValue = s.text[start:end]
 * 	}
 * 	if s.tokenFlags&ast.TokenFlagsContainsLeadingZero != 0 {
 * 		s.errorAt(diagnostics.Decimals_with_leading_zeros_are_not_allowed, start, s.pos-start)
 * 		s.tokenValue = jsnum.FromString(s.tokenValue).String()
 * 		return ast.KindNumericLiteral
 * 	}
 * 	var result ast.Kind
 * 	if fixedPartEnd == s.pos {
 * 		result = s.scanBigIntSuffix()
 * 	} else {
 * 		s.tokenValue = jsnum.FromString(s.tokenValue).String()
 * 		result = ast.KindNumericLiteral
 * 	}
 * 	ch, _ := s.charAndSize()
 * 	if IsIdentifierStart(ch) {
 * 		idStart := s.pos
 * 		id := s.scanIdentifierParts()
 * 		if result != ast.KindBigIntLiteral && len(id) == 1 && s.text[idStart] == 'n' {
 * 			if s.tokenFlags&ast.TokenFlagsScientific != 0 {
 * 				s.errorAt(diagnostics.A_bigint_literal_cannot_use_exponential_notation, start, s.pos-start)
 * 				return result
 * 			}
 * 			if fixedPartEnd < idStart {
 * 				s.errorAt(diagnostics.A_bigint_literal_must_be_an_integer, start, s.pos-start)
 * 				return result
 * 			}
 * 		}
 * 		s.errorAt(diagnostics.An_identifier_or_keyword_cannot_immediately_follow_a_numeric_literal, idStart, s.pos-idStart)
 * 		s.pos = idStart
 * 	}
 * 	return result
 * }
 */
export function Scanner_scanNumber(receiver: GoPtr<Scanner>): Kind {
  const s = receiver!;
  const st = s.__tsgoEmbedded0;
  let start = st.pos;
  let fixedPart = "";
  if (Scanner_char(s) === "0".charCodeAt(0)) {
    st.pos++;
    if (Scanner_char(s) === "_".charCodeAt(0)) {
      st.tokenFlags |= TokenFlagsContainsSeparator | TokenFlagsContainsInvalidSeparator;
      Scanner_errorAt(s, Numeric_separators_are_not_allowed_here, st.pos, 1);
      st.pos = start;
      fixedPart = Scanner_scanNumberFragment(s);
    } else {
      const [digits, isOctal] = Scanner_scanDigits(s);
      if (digits === "") {
        fixedPart = "0";
      } else if (!isOctal) {
        st.tokenFlags |= TokenFlagsContainsLeadingZero;
        fixedPart = digits;
      } else {
        const [val] = strconv.ParseInt(digits, 8, 64);
        st.tokenValue = strconv.FormatInt(val, 10);
        st.tokenFlags |= TokenFlagsOctal;
        const withMinus = st.token === KindMinusToken;
        const literal = IfElse(withMinus, "-", "") + "0o" + strconv.FormatInt(val, 8);
        if (withMinus) {
          start--;
        }
        Scanner_errorAt(s, Octal_literals_are_not_allowed_Use_the_syntax_0, start, st.pos - start, literal);
        return KindNumericLiteral;
      }
    }
  } else {
    fixedPart = Scanner_scanNumberFragment(s);
  }
  const fixedPartEnd = st.pos;
  let fractionalPart = "";
  let exponentPreamble = "";
  let exponentPart = "";
  if (Scanner_char(s) === ".".charCodeAt(0)) {
    st.pos++;
    fractionalPart = Scanner_scanNumberFragment(s);
  }
  let end = st.pos;
  if (Scanner_char(s) === "E".charCodeAt(0) || Scanner_char(s) === "e".charCodeAt(0)) {
    st.pos++;
    st.tokenFlags |= TokenFlagsScientific;
    if (Scanner_char(s) === "+".charCodeAt(0) || Scanner_char(s) === "-".charCodeAt(0)) {
      st.pos++;
    }
    const startNumericPart = st.pos;
    exponentPart = Scanner_scanNumberFragment(s);
    if (exponentPart === "") {
      Scanner_error(s, Digit_expected);
    } else {
      exponentPreamble = byteSlice(s.text, end, startNumericPart);
      end = st.pos;
    }
  }
  if ((st.tokenFlags & TokenFlagsContainsSeparator) !== 0) {
    st.tokenValue = fixedPart;
    if (fractionalPart !== "") {
      st.tokenValue += "." + fractionalPart;
    }
    if (exponentPart !== "") {
      st.tokenValue += exponentPreamble + exponentPart;
    }
  } else {
    st.tokenValue = byteSlice(s.text, start, end);
  }
  if ((st.tokenFlags & TokenFlagsContainsLeadingZero) !== 0) {
    Scanner_errorAt(s, Decimals_with_leading_zeros_are_not_allowed, start, st.pos - start);
    st.tokenValue = Number_String(FromString(st.tokenValue));
    return KindNumericLiteral;
  }
  let result: Kind;
  if (fixedPartEnd === st.pos) {
    result = Scanner_scanBigIntSuffix(s);
  } else {
    st.tokenValue = Number_String(FromString(st.tokenValue));
    result = KindNumericLiteral;
  }
  const [ch] = Scanner_charAndSize(s);
  if (IsIdentifierStart(ch)) {
    const idStart = st.pos;
    const id = Scanner_scanIdentifierParts(s);
    if (result !== KindBigIntLiteral && byteLen(id) === 1 && byteAt(s.text, idStart) === "n".charCodeAt(0)) {
      if ((st.tokenFlags & TokenFlagsScientific) !== 0) {
        Scanner_errorAt(s, A_bigint_literal_cannot_use_exponential_notation, start, st.pos - start);
        return result;
      }
      if (fixedPartEnd < idStart) {
        Scanner_errorAt(s, A_bigint_literal_must_be_an_integer, start, st.pos - start);
        return result;
      }
    }
    Scanner_errorAt(s, An_identifier_or_keyword_cannot_immediately_follow_a_numeric_literal, idStart, st.pos - idStart);
    st.pos = idStart;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanNumberFragment","kind":"method","status":"implemented","sigHash":"107eac2d2e9ee776e96ea451d6cfc0c5ece86f77f0bb651ff35be1e39a2a99ed","bodyHash":"6ffe2275c03f3889a5c253c5c1c834999f86004dcb32f9a99bbdf8210c3a1b8c"}
 *
 * Go source:
 * func (s *Scanner) scanNumberFragment() string {
 * 	start := s.pos
 * 	allowSeparator := false
 * 	isPreviousTokenSeparator := false
 * 	var result strings.Builder
 * 	for {
 * 		ch := s.char()
 * 		if ch == '_' {
 * 			s.tokenFlags |= ast.TokenFlagsContainsSeparator
 * 			if allowSeparator {
 * 				allowSeparator = false
 * 				isPreviousTokenSeparator = true
 * 				result.WriteString(s.text[start:s.pos])
 * 			} else {
 * 				s.tokenFlags |= ast.TokenFlagsContainsInvalidSeparator
 * 				if isPreviousTokenSeparator {
 * 					s.errorAt(diagnostics.Multiple_consecutive_numeric_separators_are_not_permitted, s.pos, 1)
 * 				} else {
 * 					s.errorAt(diagnostics.Numeric_separators_are_not_allowed_here, s.pos, 1)
 * 				}
 * 			}
 * 			s.pos++
 * 			start = s.pos
 * 			continue
 * 		}
 * 		if stringutil.IsDigit(ch) {
 * 			allowSeparator = true
 * 			isPreviousTokenSeparator = false
 * 			s.pos++
 * 			continue
 * 		}
 * 		break
 * 	}
 * 	if isPreviousTokenSeparator {
 * 		s.tokenFlags |= ast.TokenFlagsContainsInvalidSeparator
 * 		s.errorAt(diagnostics.Numeric_separators_are_not_allowed_here, s.pos-1, 1)
 * 	}
 * 	result.WriteString(s.text[start:s.pos])
 * 	return result.String()
 * }
 */
export function Scanner_scanNumberFragment(receiver: GoPtr<Scanner>): string {
  const s = receiver!;
  let start = s.__tsgoEmbedded0.pos;
  let allowSeparator = false;
  let isPreviousTokenSeparator = false;
  const result = new Builder();
  for (;;) {
    const ch = Scanner_char(s);
    if (ch === "_".charCodeAt(0)) {
      s.__tsgoEmbedded0.tokenFlags |= TokenFlagsContainsSeparator;
      if (allowSeparator) {
        allowSeparator = false;
        isPreviousTokenSeparator = true;
        result.WriteString(byteSlice(s.text, start, s.__tsgoEmbedded0.pos));
      } else {
        s.__tsgoEmbedded0.tokenFlags |= TokenFlagsContainsInvalidSeparator;
        if (isPreviousTokenSeparator) {
          Scanner_errorAt(s, Multiple_consecutive_numeric_separators_are_not_permitted, s.__tsgoEmbedded0.pos, 1);
        } else {
          Scanner_errorAt(s, Numeric_separators_are_not_allowed_here, s.__tsgoEmbedded0.pos, 1);
        }
      }
      s.__tsgoEmbedded0.pos++;
      start = s.__tsgoEmbedded0.pos;
      continue;
    }
    if (IsDigit(ch)) {
      allowSeparator = true;
      isPreviousTokenSeparator = false;
      s.__tsgoEmbedded0.pos++;
      continue;
    }
    break;
  }
  if (isPreviousTokenSeparator) {
    s.__tsgoEmbedded0.tokenFlags |= TokenFlagsContainsInvalidSeparator;
    Scanner_errorAt(s, Numeric_separators_are_not_allowed_here, s.__tsgoEmbedded0.pos - 1, 1);
  }
  result.WriteString(byteSlice(s.text, start, s.__tsgoEmbedded0.pos));
  return result.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanDigits","kind":"method","status":"implemented","sigHash":"5173f46cb2963cb6535aa7efb7e0ec4dbc04157729d125e168f751140a6e2f59","bodyHash":"72c187e377a6c821768510e1f0301dda005e33d972cbd597993d673c91f8a0ac"}
 *
 * Go source:
 * func (s *Scanner) scanDigits() (string, bool) {
 * 	start := s.pos
 * 	isOctal := true
 * 	for stringutil.IsDigit(s.char()) {
 * 		if !stringutil.IsOctalDigit(s.char()) {
 * 			isOctal = false
 * 		}
 * 		s.pos++
 * 	}
 * 	return s.text[start:s.pos], isOctal
 * }
 */
export function Scanner_scanDigits(receiver: GoPtr<Scanner>): [string, bool] {
  const s = receiver!;
  const start = s.__tsgoEmbedded0.pos;
  let isOctal = true;
  while (IsDigit(Scanner_char(s))) {
    if (!IsOctalDigit(Scanner_char(s))) {
      isOctal = false;
    }
    s.__tsgoEmbedded0.pos++;
  }
  return [byteSlice(s.text, start, s.__tsgoEmbedded0.pos), isOctal];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanHexDigits","kind":"method","status":"implemented","sigHash":"c50827184f304547ec3ed0bbcc255bc50ec34bfdbea3c6ec9a8caf9170c281c0","bodyHash":"cb1f92a2a61fbcbe7e944ebe4e1180b242737db1f53d25adc1299246b6be676f"}
 *
 * Go source:
 * func (s *Scanner) scanHexDigits(minCount int, scanAsManyAsPossible bool, canHaveSeparators bool) string {
 * 	digitCount := 0
 * 	start := s.pos
 * 	allowSeparator := false
 * 	isPreviousTokenSeparator := false
 * 	for digitCount < minCount || scanAsManyAsPossible {
 * 		ch := s.char()
 * 		if stringutil.IsHexDigit(ch) {
 * 			allowSeparator = canHaveSeparators
 * 			isPreviousTokenSeparator = false
 * 			digitCount++
 * 		} else if canHaveSeparators && ch == '_' {
 * 			s.tokenFlags |= ast.TokenFlagsContainsSeparator
 * 			if allowSeparator {
 * 				allowSeparator = false
 * 				isPreviousTokenSeparator = true
 * 			} else if isPreviousTokenSeparator {
 * 				s.errorAt(diagnostics.Multiple_consecutive_numeric_separators_are_not_permitted, s.pos, 1)
 * 			} else {
 * 				s.errorAt(diagnostics.Numeric_separators_are_not_allowed_here, s.pos, 1)
 * 			}
 * 		} else {
 * 			break
 * 		}
 * 		s.pos++
 * 	}
 * 	if isPreviousTokenSeparator {
 * 		s.errorAt(diagnostics.Numeric_separators_are_not_allowed_here, s.pos-1, 1)
 * 	}
 * 	if digitCount < minCount {
 * 		return ""
 * 	}
 * 	digits := s.text[start:s.pos]
 * 	if s.hexDigitCache == nil {
 * 		s.hexDigitCache = make(map[string]string)
 * 	}
 * 	if cached, ok := s.hexDigitCache[digits]; ok {
 * 		return cached
 * 	} else {
 * 		original := digits
 * 		if s.tokenFlags&ast.TokenFlagsContainsSeparator != 0 {
 * 			digits = strings.ReplaceAll(digits, "_", "")
 * 		}
 * 		digits = strings.ToLower(digits) // standardize hex literals to lowercase
 * 		s.hexDigitCache[original] = digits
 * 		return digits
 * 	}
 * }
 */
export function Scanner_scanHexDigits(receiver: GoPtr<Scanner>, minCount: int, scanAsManyAsPossible: bool, canHaveSeparators: bool): string {
  const s = receiver!;
  let digitCount = 0;
  const start = s.__tsgoEmbedded0.pos;
  let allowSeparator = false;
  let isPreviousTokenSeparator = false;
  while (digitCount < minCount || scanAsManyAsPossible) {
    const ch = Scanner_char(s);
    if (IsHexDigit(ch)) {
      allowSeparator = canHaveSeparators;
      isPreviousTokenSeparator = false;
      digitCount++;
    } else if (canHaveSeparators && ch === "_".charCodeAt(0)) {
      s.__tsgoEmbedded0.tokenFlags |= TokenFlagsContainsSeparator;
      if (allowSeparator) {
        allowSeparator = false;
        isPreviousTokenSeparator = true;
      } else if (isPreviousTokenSeparator) {
        Scanner_errorAt(s, Multiple_consecutive_numeric_separators_are_not_permitted, s.__tsgoEmbedded0.pos, 1);
      } else {
        Scanner_errorAt(s, Numeric_separators_are_not_allowed_here, s.__tsgoEmbedded0.pos, 1);
      }
    } else {
      break;
    }
    s.__tsgoEmbedded0.pos++;
  }
  if (isPreviousTokenSeparator) {
    Scanner_errorAt(s, Numeric_separators_are_not_allowed_here, s.__tsgoEmbedded0.pos - 1, 1);
  }
  if (digitCount < minCount) {
    return "";
  }
  let digits = byteSlice(s.text, start, s.__tsgoEmbedded0.pos);
  if (s.hexDigitCache === (undefined as unknown as GoMap<string, string>)) {
    s.hexDigitCache = new globalThis.Map<string, string>();
  }
  const cached = s.hexDigitCache.get(digits);
  if (cached !== undefined) {
    return cached;
  } else {
    const original = digits;
    if ((s.__tsgoEmbedded0.tokenFlags & TokenFlagsContainsSeparator) !== 0) {
      digits = strings.ReplaceAll(digits, "_", "");
    }
    digits = strings.ToLower(digits); // standardize hex literals to lowercase
    s.hexDigitCache.set(original, digits);
    return digits;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanBinaryOrOctalDigits","kind":"method","status":"implemented","sigHash":"ad6e8ca7a23e3a771a31fabeea1ea7447749212e9a0094f14cea30d10a7fedbc","bodyHash":"191a9f75561933ea01c0d6a35d46676528bc351ca7fc539f18a679328a86de3e"}
 *
 * Go source:
 * func (s *Scanner) scanBinaryOrOctalDigits(base int32) string {
 * 	var sb strings.Builder
 * 	allowSeparator := false
 * 	isPreviousTokenSeparator := false
 * 	for {
 * 		ch := s.char()
 * 		if stringutil.IsDigit(ch) && ch-'0' < base {
 * 			sb.WriteByte(byte(ch))
 * 			allowSeparator = true
 * 			isPreviousTokenSeparator = false
 * 		} else if ch == '_' {
 * 			s.tokenFlags |= ast.TokenFlagsContainsSeparator
 * 			if allowSeparator {
 * 				allowSeparator = false
 * 				isPreviousTokenSeparator = true
 * 			} else if isPreviousTokenSeparator {
 * 				s.errorAt(diagnostics.Multiple_consecutive_numeric_separators_are_not_permitted, s.pos, 1)
 * 			} else {
 * 				s.errorAt(diagnostics.Numeric_separators_are_not_allowed_here, s.pos, 1)
 * 			}
 * 		} else {
 * 			break
 * 		}
 * 		s.pos++
 * 	}
 * 	if isPreviousTokenSeparator {
 * 		s.errorAt(diagnostics.Numeric_separators_are_not_allowed_here, s.pos-1, 1)
 * 	}
 * 	return sb.String()
 * }
 */
export function Scanner_scanBinaryOrOctalDigits(receiver: GoPtr<Scanner>, base: int): string {
  const s = receiver!;
  const sb = new Builder();
  let allowSeparator = false;
  let isPreviousTokenSeparator = false;
  for (;;) {
    const ch = Scanner_char(s);
    if (IsDigit(ch) && ch - "0".charCodeAt(0) < base) {
      sb.WriteByte((ch & 0xff) as byte);
      allowSeparator = true;
      isPreviousTokenSeparator = false;
    } else if (ch === "_".charCodeAt(0)) {
      s.__tsgoEmbedded0.tokenFlags |= TokenFlagsContainsSeparator;
      if (allowSeparator) {
        allowSeparator = false;
        isPreviousTokenSeparator = true;
      } else if (isPreviousTokenSeparator) {
        Scanner_errorAt(s, Multiple_consecutive_numeric_separators_are_not_permitted, s.__tsgoEmbedded0.pos, 1);
      } else {
        Scanner_errorAt(s, Numeric_separators_are_not_allowed_here, s.__tsgoEmbedded0.pos, 1);
      }
    } else {
      break;
    }
    s.__tsgoEmbedded0.pos++;
  }
  if (isPreviousTokenSeparator) {
    Scanner_errorAt(s, Numeric_separators_are_not_allowed_here, s.__tsgoEmbedded0.pos - 1, 1);
  }
  return sb.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanBigIntSuffix","kind":"method","status":"implemented","sigHash":"e95bb479091bc5d6c9e3a91662339b84a77f4403395003bcd1c8a2a36685966f","bodyHash":"38dfd43db86635a06346fe07523d45b21d9664d78335a82e3b081d04267e3490"}
 *
 * Go source:
 * func (s *Scanner) scanBigIntSuffix() ast.Kind {
 * 	if s.char() == 'n' {
 * 		s.tokenValue += "n"
 * 		if s.tokenFlags&ast.TokenFlagsBinaryOrOctalSpecifier != 0 {
 * 			s.tokenValue = jsnum.ParsePseudoBigInt(s.tokenValue) + "n"
 * 		}
 * 		s.pos++
 * 		return ast.KindBigIntLiteral
 * 	}
 * 	if s.numberCache == nil {
 * 		s.numberCache = make(map[string]string)
 * 	}
 * 	if cached, ok := s.numberCache[s.tokenValue]; ok {
 * 		s.tokenValue = cached
 * 	} else {
 * 		tokenValue := jsnum.FromString(s.tokenValue).String()
 * 		if tokenValue == s.tokenValue {
 * 			tokenValue = s.tokenValue
 * 		}
 * 		s.numberCache[s.tokenValue] = tokenValue
 * 		s.tokenValue = tokenValue
 * 	}
 * 	return ast.KindNumericLiteral
 * }
 */
export function Scanner_scanBigIntSuffix(receiver: GoPtr<Scanner>): Kind {
  const s = receiver!;
  if (Scanner_char(s) === "n".charCodeAt(0)) {
    s.__tsgoEmbedded0.tokenValue += "n";
    if ((s.__tsgoEmbedded0.tokenFlags & TokenFlagsBinaryOrOctalSpecifier) !== 0) {
      s.__tsgoEmbedded0.tokenValue = ParsePseudoBigInt(s.__tsgoEmbedded0.tokenValue) + "n";
    }
    s.__tsgoEmbedded0.pos++;
    return KindBigIntLiteral;
  }
  if (s.numberCache === (undefined as unknown as GoMap<string, string>)) {
    s.numberCache = new globalThis.Map<string, string>();
  }
  const cached = s.numberCache.get(s.__tsgoEmbedded0.tokenValue);
  if (cached !== undefined) {
    s.__tsgoEmbedded0.tokenValue = cached;
  } else {
    let tokenValue = Number_String(FromString(s.__tsgoEmbedded0.tokenValue));
    if (tokenValue === s.__tsgoEmbedded0.tokenValue) {
      tokenValue = s.__tsgoEmbedded0.tokenValue;
    }
    s.numberCache.set(s.__tsgoEmbedded0.tokenValue, tokenValue);
    s.__tsgoEmbedded0.tokenValue = tokenValue;
  }
  return KindNumericLiteral;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanInvalidCharacter","kind":"method","status":"implemented","sigHash":"c99739e486c38e56db4be3f3b8ca30c5a1074b7803f962d5e03e3622cf003a5e","bodyHash":"803ea138f96033afdfe1ffe2cd224465ee69f5078d33dea05704e34857fa513b"}
 *
 * Go source:
 * func (s *Scanner) scanInvalidCharacter() {
 * 	_, size := s.charAndSize()
 * 	s.errorAt(diagnostics.Invalid_character, s.pos, size)
 * 	s.pos += size
 * 	s.token = ast.KindUnknown
 * }
 */
export function Scanner_scanInvalidCharacter(receiver: GoPtr<Scanner>): void {
  const s = receiver!;
  const [, size] = Scanner_charAndSize(s);
  Scanner_errorAt(s, Invalid_character, s.__tsgoEmbedded0.pos, size);
  s.__tsgoEmbedded0.pos += size;
  s.__tsgoEmbedded0.token = KindUnknown;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetIdentifierToken","kind":"func","status":"implemented","sigHash":"a5e7f979cfd8a669e6b4be3494c2953ad7fbec7fd2e111b3f38f2ee61f5282c7","bodyHash":"dc7293fe327a8e8093c2e5907803c5adb9f824f233ad6b49fc63e45e6ef5d0b6"}
 *
 * Go source:
 * func GetIdentifierToken(str string) ast.Kind {
 * 	if len(str) >= 2 && len(str) <= 12 && str[0] >= 'a' && str[0] <= 'z' {
 * 		keyword := textToKeyword[str]
 * 		if keyword != ast.KindUnknown {
 * 			return keyword
 * 		}
 * 	}
 * 	return ast.KindIdentifier
 * }
 */
export function GetIdentifierToken(str: string): Kind {
  if (byteLen(str) >= 2 && byteLen(str) <= 12 && byteAt(str, 0) >= "a".charCodeAt(0) && byteAt(str, 0) <= "z".charCodeAt(0)) {
    const keyword = textToKeyword.get(str);
    if (keyword !== undefined && keyword !== KindUnknown) {
      return keyword;
    }
  }
  return KindIdentifier;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::IsValidIdentifier","kind":"func","status":"implemented","sigHash":"6f2f2e0fa3f0726fd3acac525f61e6739551580772c0110f3bd049ad7184f931","bodyHash":"1f4836c7935e22c71a33ca860a69db1ea8df3d4edde0f6f1d0c30e22989fdee7"}
 *
 * Go source:
 * func IsValidIdentifier(s string) bool {
 * 	if len(s) == 0 {
 * 		return false
 * 	}
 * 	for i, ch := range s {
 * 		if i == 0 && !IsIdentifierStart(ch) || i != 0 && !IsIdentifierPart(ch) {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function IsValidIdentifier(s: string): bool {
  if (byteLen(s) === 0) {
    return false;
  }
  // `for i, ch := range s` iterates Unicode code points with their byte index.
  let i = 0;
  for (;;) {
    const rest = byteSlice(s, i);
    if (byteLen(rest) === 0) {
      break;
    }
    const [ch, size] = utf8.DecodeRuneInString(rest);
    if ((i === 0 && !IsIdentifierStart(ch)) || (i !== 0 && !IsIdentifierPart(ch))) {
      return false;
    }
    i += size;
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::isWordCharacter","kind":"func","status":"implemented","sigHash":"a654575bb78b2151379e65a1996036e6071b2d19af09613b101e52e9673f9c66","bodyHash":"e457db9e8c427e744c523582f2d654aaf938dbd5c56c3ffc9de48e4b85c5f50e"}
 *
 * Go source:
 * func isWordCharacter(ch rune) bool {
 * 	return stringutil.IsASCIILetter(ch) || stringutil.IsDigit(ch) || ch == '_'
 * }
 */
export function isWordCharacter(ch: GoRune): bool {
  return IsASCIILetter(ch) || IsDigit(ch) || ch === "_".charCodeAt(0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::IsIdentifierStart","kind":"func","status":"implemented","sigHash":"8b0307f4d91cd33861040bbfc48694a01347ba78919e2991be6d068aec5dccbe","bodyHash":"2cfcb3674185ad0827975ff98a35d7303e70591e85a044b990617e946bcba693"}
 *
 * Go source:
 * func IsIdentifierStart(ch rune) bool {
 * 	return stringutil.IsASCIILetter(ch) || ch == '_' || ch == '$' || ch >= utf8.RuneSelf && isUnicodeIdentifierStart(ch)
 * }
 */
export function IsIdentifierStart(ch: GoRune): bool {
  return IsASCIILetter(ch) || ch === "_".charCodeAt(0) || ch === "$".charCodeAt(0) || (ch >= utf8.RuneSelf && isUnicodeIdentifierStart(ch));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::IsIdentifierPart","kind":"func","status":"implemented","sigHash":"cea9d76e44b84d6f31e6a1068929975367984f606075f3fa68621c45548ec513","bodyHash":"aad3ed98a58a301217522a5d19d89f94d9b1b6175439dbea905d355895116d10"}
 *
 * Go source:
 * func IsIdentifierPart(ch rune) bool {
 * 	return IsIdentifierPartEx(ch, core.LanguageVariantStandard)
 * }
 */
export function IsIdentifierPart(ch: GoRune): bool {
  return IsIdentifierPartEx(ch, LanguageVariantStandard);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::IsIdentifierPartEx","kind":"func","status":"implemented","sigHash":"fe71015c9adb72b3bb73c5f06c60928a8091d9c42fd9756c58f8521c8354da5a","bodyHash":"c94b73c9df6ace61ff27ef6548f6bf30e335def7aa95f62695af5b89cf6853fb"}
 *
 * Go source:
 * func IsIdentifierPartEx(ch rune, languageVariant core.LanguageVariant) bool {
 * 	return isWordCharacter(ch) || ch == '$' ||
 * 		ch >= utf8.RuneSelf && isUnicodeIdentifierPart(ch) ||
 * 		languageVariant == core.LanguageVariantJSX && (ch == '-' || ch == ':') // "-" and ":" are valid in JSX Identifiers
 * }
 */
export function IsIdentifierPartEx(ch: GoRune, languageVariant: LanguageVariant): bool {
  return (
    isWordCharacter(ch) ||
    ch === "$".charCodeAt(0) ||
    (ch >= utf8.RuneSelf && isUnicodeIdentifierPart(ch)) ||
    (languageVariant === LanguageVariantJSX && (ch === "-".charCodeAt(0) || ch === ":".charCodeAt(0))) // "-" and ":" are valid in JSX Identifiers
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::isUnicodeIdentifierStart","kind":"func","status":"implemented","sigHash":"0261414c25b3f025541228f43816ebb0b4c474543110219a5efd1b5d530f252c","bodyHash":"82b4eca57a541fe68d2c6bea0f45f2758fdcb2d55fc59080f0652027dc144d6b"}
 *
 * Go source:
 * func isUnicodeIdentifierStart(ch rune) bool {
 * 	return isInUnicodeRanges(ch, unicodeESNextIdentifierStart)
 * }
 */
export function isUnicodeIdentifierStart(ch: GoRune): bool {
  return isInUnicodeRanges(ch, unicodeESNextIdentifierStart);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::isUnicodeIdentifierPart","kind":"func","status":"implemented","sigHash":"17d99c11e046582e064fa646c82082c1f94dd63b05b0d666062abfcf29bdb80a","bodyHash":"c47693ad71bdc13e7b13e45a19ff039c520d2cdab0c32ff5e7783d8df57490e2"}
 *
 * Go source:
 * func isUnicodeIdentifierPart(ch rune) bool {
 * 	return isInUnicodeRanges(ch, unicodeESNextIdentifierPart)
 * }
 */
export function isUnicodeIdentifierPart(ch: GoRune): bool {
  return isInUnicodeRanges(ch, unicodeESNextIdentifierPart);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::isInUnicodeRanges","kind":"func","status":"implemented","sigHash":"115b800334f036b0b6aaf36bc51e62fd99fe647f8927f6b2de0c08aae002eb2f","bodyHash":"8dac6be31403e9718fdf9383ac262dc6623f985f589c04439f0a6a032e889dc9"}
 *
 * Go source:
 * func isInUnicodeRanges(cp rune, ranges []rune) bool {
 * 	// Bail out quickly if it couldn't possibly be in the map
 * 	if cp < ranges[0] {
 * 		return false
 * 	}
 * 	// Perform binary search in one of the Unicode range maps
 * 	lo := 0
 * 	hi := len(ranges)
 * 	for lo+1 < hi {
 * 		mid := lo + (hi-lo)/2
 * 		// mid has to be even to catch beginning of a range
 * 		mid -= mid % 2
 * 		if ranges[mid] <= cp && cp <= ranges[mid+1] {
 * 			return true
 * 		}
 * 		if cp < ranges[mid] {
 * 			hi = mid
 * 		} else {
 * 			lo = mid + 2
 * 		}
 * 	}
 * 	return false
 * }
 */
export function isInUnicodeRanges(cp: GoRune, ranges: GoSlice<GoRune>): bool {
  // Bail out quickly if it couldn't possibly be in the map
  if (cp < ranges[0]!) {
    return false;
  }
  // Perform binary search in one of the Unicode range maps
  let lo = 0;
  let hi = ranges.length;
  while (lo + 1 < hi) {
    let mid = lo + Math.trunc((hi - lo) / 2);
    // mid has to be even to catch beginning of a range
    mid -= mid % 2;
    if (ranges[mid]! <= cp && cp <= ranges[mid + 1]!) {
      return true;
    }
    if (cp < ranges[mid]!) {
      hi = mid;
    } else {
      lo = mid + 2;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::varGroup::tokenToText","kind":"varGroup","status":"implemented","sigHash":"e5a9cc66c2b51098cc72bf196270817ff6bf88bbb8ec9025dbde20e7a35e777d","bodyHash":"52b81e82b1334903d601a1d60aa3a6cd3718942acf382b43ebdcbc28e05894cb"}
 *
 * Go source:
 * var tokenToText = func() [ast.KindCount]string {
 * 	var result [ast.KindCount]string
 * 	for text, kind := range textToToken {
 * 		result[kind] = text
 * 	}
 * 	return result
 * }()
 */
// Go models this as a dense `[ast.KindCount]string` array indexed by token kind,
// with the unset slots holding the zero value "". `ast.KindCount` is not exported
// by the ported kinds module, so we mirror the same total kind->string mapping as a
// GoMap (the identical representation already used for textToToken/textToKeyword);
// TokenToString supplies the "" default for unmapped kinds, matching the array.
export const tokenToText: GoMap<Kind, string> = ((): GoMap<Kind, string> => {
  const result = new globalThis.Map<Kind, string>();
  for (const [text, kind] of textToToken) {
    result.set(kind, text);
  }
  return result;
})();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::TokenToString","kind":"func","status":"implemented","sigHash":"20e1dd05f8e7d661bc30b7bc2c31b7f60320e11ca0802d131982fbd836fedd0c","bodyHash":"52506d4929d1e6f06f0153607170bf52a154bf0c78525acb62e62f1b84b64079"}
 *
 * Go source:
 * func TokenToString(token ast.Kind) string {
 * 	return tokenToText[token]
 * }
 */
export function TokenToString(token: Kind): string {
  // tokenToText is a total kind->string map; unmapped kinds hold the array zero
  // value "", which the `?? ""` reproduces.
  return tokenToText.get(token) ?? "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::StringToToken","kind":"func","status":"implemented","sigHash":"4c20e171dbdbb1ff97fcba7ee0de6b02588c190c1ed6a58b5256fa15765d473d","bodyHash":"77c5a1fc35d161b3d865f201e1353e57338ade7c04077238c4b5a3ae65bffa5a"}
 *
 * Go source:
 * func StringToToken(s string) ast.Kind {
 * 	kind, ok := textToToken[s]
 * 	if ok {
 * 		return kind
 * 	}
 * 	return ast.KindUnknown
 * }
 */
export function StringToToken(s: string): Kind {
  const kind = textToToken.get(s);
  if (kind !== undefined) {
    return kind;
  }
  return KindUnknown;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetViableKeywordSuggestions","kind":"func","status":"implemented","sigHash":"2f2d9a13c7823044eb44954bbb1819c3dcbd5330409dfa78eecb621e2db5f4aa","bodyHash":"422d3fc9fc9ccfe49fbcdbc352848b0bef738ffc6fa33768ccc4c34912926595"}
 *
 * Go source:
 * func GetViableKeywordSuggestions() []string {
 * 	result := make([]string, 0, len(textToKeyword))
 * 	for text := range textToKeyword {
 * 		if len(text) > 2 {
 * 			result = append(result, text)
 * 		}
 * 	}
 * 	return result
 * }
 */
export function GetViableKeywordSuggestions(): GoSlice<string> {
  const result: GoSlice<string> = [];
  for (const text of textToKeyword.keys()) {
    if (byteLen(text) > 2) {
      result.push(text);
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::couldStartTrivia","kind":"func","status":"implemented","sigHash":"d345ca05aa62f5a74debe24692e3fde8362eed27d9bca1df1354f50ce92eb8a2","bodyHash":"bbe1e47534757cd4b79b01b8f4beb80a516802cef31a9b53c2991716f9656cf3"}
 *
 * Go source:
 * func couldStartTrivia(text string, pos int) bool {
 * 	// Keep in sync with skipTrivia
 * 	switch ch := text[pos]; ch {
 * 	// Characters that could start normal trivia
 * 	case '\r', '\n', '\t', '\v', '\f', ' ', '/',
 * 		// Characters that could start conflict marker trivia
 * 		'<', '|', '=', '>':
 * 		return true
 * 	case '#':
 * 		// Only if its the beginning can we have #! trivia
 * 		return pos == 0
 * 	default:
 * 		return ch > maxAsciiCharacter
 * 	}
 * }
 */
export function couldStartTrivia(text: string, pos: int): bool {
  // Keep in sync with skipTrivia
  const ch = byteAt(text, pos);
  switch (ch) {
    // Characters that could start normal trivia
    case "\r".charCodeAt(0):
    case "\n".charCodeAt(0):
    case "\t".charCodeAt(0):
    case "\v".charCodeAt(0):
    case "\f".charCodeAt(0):
    case " ".charCodeAt(0):
    case "/".charCodeAt(0):
    // Characters that could start conflict marker trivia
    case "<".charCodeAt(0):
    case "|".charCodeAt(0):
    case "=".charCodeAt(0):
    case ">".charCodeAt(0):
      return true;
    case "#".charCodeAt(0):
      // Only if its the beginning can we have #! trivia
      return pos === 0;
    default:
      return ch > maxAsciiCharacter;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::type::SkipTriviaOptions","kind":"type","status":"implemented","sigHash":"373bc82db9112bc86f2ed42563f285ee9cbbabe64b90797332e1b257258e8d6a","bodyHash":"05f5c7befbfc7e6f070207a16d483124b96b9e04ddbe228c1ace1844fefe503d"}
 *
 * Go source:
 * SkipTriviaOptions struct {
 * 	StopAfterLineBreak bool
 * 	StopAtComments     bool
 * 	InJSDoc            bool
 * }
 */
export interface SkipTriviaOptions {
  StopAfterLineBreak: bool;
  StopAtComments: bool;
  InJSDoc: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::SkipTrivia","kind":"func","status":"implemented","sigHash":"d1e1b780a1d61f6ba5b5d4214f3c70e7196a14c34a708e8161ead0e56ec45045","bodyHash":"256084d1efc752f6e877a256bb5a7afdb9ec523631c5df64b6867316915b1286"}
 *
 * Go source:
 * func SkipTrivia(text string, pos int) int {
 * 	return SkipTriviaEx(text, pos, nil)
 * }
 */
export function SkipTrivia(text: string, pos: int): int {
  return SkipTriviaEx(text, pos, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::SkipTriviaEx","kind":"func","status":"implemented","sigHash":"f42acfbbaab25a2aa14a08e991389f62a5072c61df54c5805c5d6b51e941080e","bodyHash":"8a743779d6ccf684f4076b85acf341470fcffa4732805e6564184860a2bea3dc"}
 *
 * Go source:
 * func SkipTriviaEx(text string, pos int, options *SkipTriviaOptions) int {
 * 	if ast.PositionIsSynthesized(pos) {
 * 		return pos
 * 	}
 * 	if options == nil {
 * 		options = &SkipTriviaOptions{}
 * 	}
 * 
 * 	textLen := len(text)
 * 	canConsumeStar := false
 * 	// Keep in sync with couldStartTrivia
 * 	for {
 * 		ch, size := utf8.DecodeRuneInString(text[pos:])
 * 		switch ch {
 * 		case '\r':
 * 			if pos+1 < textLen && text[pos+1] == '\n' {
 * 				pos++
 * 			}
 * 			fallthrough
 * 		case '\n':
 * 			pos++
 * 			if options.StopAfterLineBreak {
 * 				return pos
 * 			}
 * 			canConsumeStar = options.InJSDoc
 * 			continue
 * 		case '\t', '\v', '\f', ' ':
 * 			pos++
 * 			continue
 * 		case '/':
 * 			if options.StopAtComments {
 * 				break
 * 			}
 * 			if pos+1 < textLen {
 * 				if text[pos+1] == '/' {
 * 					pos += 2
 * 					for pos < textLen {
 * 						ch, size := utf8.DecodeRuneInString(text[pos:])
 * 						if stringutil.IsLineBreak(ch) {
 * 							break
 * 						}
 * 						pos += size
 * 					}
 * 					canConsumeStar = false
 * 					continue
 * 				}
 * 				if text[pos+1] == '*' {
 * 					pos += 2
 * 					for pos < textLen {
 * 						if text[pos] == '*' && (pos+1 < textLen) && text[pos+1] == '/' {
 * 							pos += 2
 * 							break
 * 						}
 * 						_, size := utf8.DecodeRuneInString(text[pos:])
 * 						pos += size
 * 					}
 * 					canConsumeStar = false
 * 					continue
 * 				}
 * 			}
 * 		case '<', '|', '=', '>':
 * 			if isConflictMarkerTrivia(text, pos) {
 * 				pos = scanConflictMarkerTrivia(text, pos, nil)
 * 				canConsumeStar = false
 * 				continue
 * 			}
 * 		case '#':
 * 			if pos == 0 && isShebangTrivia(text, pos) {
 * 				pos = scanShebangTrivia(text, pos)
 * 				canConsumeStar = false
 * 				continue
 * 			}
 * 		case '*':
 * 			if canConsumeStar {
 * 				pos++
 * 				canConsumeStar = false
 * 				continue
 * 			}
 * 		default:
 * 			if ch > rune(maxAsciiCharacter) && stringutil.IsWhiteSpaceLike(ch) {
 * 				pos += size
 * 				continue
 * 			}
 * 		}
 * 		return pos
 * 	}
 * }
 */
export function SkipTriviaEx(text: string, pos: int, options: GoPtr<SkipTriviaOptions>): int {
  if (PositionIsSynthesized(pos)) {
    return pos;
  }
  let opts = options;
  if (opts === undefined) {
    opts = { StopAfterLineBreak: false, StopAtComments: false, InJSDoc: false };
  }

  const textLen = byteLen(text);
  let canConsumeStar = false;
  // Keep in sync with couldStartTrivia
  for (;;) {
    const [ch, size] = decodeRuneInStringAt(text, pos);
    switch (ch) {
      case "\r".charCodeAt(0): {
        if (pos + 1 < textLen && byteAt(text, pos + 1) === "\n".charCodeAt(0)) {
          pos++;
        }
        // fallthrough to '\n'
        pos++;
        if (opts.StopAfterLineBreak) {
          return pos;
        }
        canConsumeStar = opts.InJSDoc;
        continue;
      }
      case "\n".charCodeAt(0): {
        pos++;
        if (opts.StopAfterLineBreak) {
          return pos;
        }
        canConsumeStar = opts.InJSDoc;
        continue;
      }
      case "\t".charCodeAt(0):
      case "\v".charCodeAt(0):
      case "\f".charCodeAt(0):
      case " ".charCodeAt(0):
        pos++;
        continue;
      case "/".charCodeAt(0): {
        if (opts.StopAtComments) {
          break;
        }
        if (pos + 1 < textLen) {
          if (byteAt(text, pos + 1) === "/".charCodeAt(0)) {
            pos += 2;
            while (pos < textLen) {
              const [ch2, size2] = decodeRuneInStringAt(text, pos);
              if (IsLineBreak(ch2)) {
                break;
              }
              pos += size2;
            }
            canConsumeStar = false;
            continue;
          }
          if (byteAt(text, pos + 1) === "*".charCodeAt(0)) {
            pos += 2;
            while (pos < textLen) {
              if (byteAt(text, pos) === "*".charCodeAt(0) && pos + 1 < textLen && byteAt(text, pos + 1) === "/".charCodeAt(0)) {
                pos += 2;
                break;
              }
              const [, size2] = decodeRuneInStringAt(text, pos);
              pos += size2;
            }
            canConsumeStar = false;
            continue;
          }
        }
        break;
      }
      case "<".charCodeAt(0):
      case "|".charCodeAt(0):
      case "=".charCodeAt(0):
      case ">".charCodeAt(0): {
        if (isConflictMarkerTrivia(text, pos)) {
          pos = scanConflictMarkerTrivia(text, pos, undefined);
          canConsumeStar = false;
          continue;
        }
        break;
      }
      case "#".charCodeAt(0): {
        if (pos === 0 && isShebangTrivia(text, pos)) {
          pos = scanShebangTrivia(text, pos);
          canConsumeStar = false;
          continue;
        }
        break;
      }
      case "*".charCodeAt(0): {
        if (canConsumeStar) {
          pos++;
          canConsumeStar = false;
          continue;
        }
        break;
      }
      default: {
        if (ch > (maxAsciiCharacter as GoRune) && IsWhiteSpaceLike(ch)) {
          pos += size;
          continue;
        }
      }
    }
    return pos;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::varGroup::mergeConflictMarkerLength+maxAsciiCharacter","kind":"varGroup","status":"implemented","sigHash":"596b779c4bc35b59555559243640f5e7a78883f0513cbae3302e688bc6cdf3f6","bodyHash":"106ca23fde3a90a8e95f79369042b88d1ce5a7cf294d673355f01f7acf6a30e6"}
 *
 * Go source:
 * var (
 * 	mergeConflictMarkerLength      = len("<<<<<<<")
 * 	maxAsciiCharacter         byte = 127
 * )
 */
export const mergeConflictMarkerLength: int = byteLen("<<<<<<<");
export const maxAsciiCharacter: byte = 127 as byte;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::isConflictMarkerTrivia","kind":"func","status":"implemented","sigHash":"9ea6f9f957b7886eeeb5b9323e900e44d6ace7d03a8b8a1b27df3442b47addc4","bodyHash":"10f97fc1b93d039660e15bcd28c64ff359a39737351374ed9ba6a693432f34c8"}
 *
 * Go source:
 * func isConflictMarkerTrivia(text string, pos int) bool {
 * 	if pos < 0 {
 * 		panic("pos < 0")
 * 	}
 * 
 * 	// Conflict markers must be at the start of a line.
 * 	var prev rune
 * 	if pos >= 2 {
 * 		prev, _ = utf8.DecodeLastRuneInString(text[:pos-2])
 * 	}
 * 	if pos == 0 || stringutil.IsLineBreak(prev) || pos >= 1 && stringutil.IsLineBreak(rune(text[pos-1])) {
 * 		ch := text[pos]
 * 
 * 		if (pos + mergeConflictMarkerLength) < len(text) {
 * 			for i := range mergeConflictMarkerLength {
 * 				if text[pos+i] != ch {
 * 					return false
 * 				}
 * 			}
 * 
 * 			return ch == '=' || text[pos+mergeConflictMarkerLength] == ' '
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function isConflictMarkerTrivia(text: string, pos: int): bool {
  if (pos < 0) {
    throw new globalThis.Error("pos < 0");
  }

  // Conflict markers must be at the start of a line.
  let prev: GoRune = 0;
  if (pos >= 2) {
    [prev] = decodeLastRuneInStringBefore(text, pos - 2);
  }
  if (pos === 0 || IsLineBreak(prev) || (pos >= 1 && IsLineBreak(byteAt(text, pos - 1)))) {
    const ch = byteAt(text, pos);

    if (pos + mergeConflictMarkerLength < byteLen(text)) {
      for (let i = 0; i < mergeConflictMarkerLength; i++) {
        if (byteAt(text, pos + i) !== ch) {
          return false;
        }
      }

      return ch === "=".charCodeAt(0) || byteAt(text, pos + mergeConflictMarkerLength) === " ".charCodeAt(0);
    }
  }

  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::scanConflictMarkerTrivia","kind":"func","status":"implemented","sigHash":"b334ec17533056d478a1cc632d556d9373722284c91f77eccfd35b2de2441b8f","bodyHash":"8e7392f3a0929d4bc5030cde3ff4a9fb144ec5f40f98c402d6bb8e9dc53aef7a"}
 *
 * Go source:
 * func scanConflictMarkerTrivia(text string, pos int, reportError func(diag *diagnostics.Message, pos int, length int, args ...any)) int {
 * 	if reportError != nil {
 * 		reportError(diagnostics.Merge_conflict_marker_encountered, pos, mergeConflictMarkerLength)
 * 	}
 * 	ch, size := utf8.DecodeRuneInString(text[pos:])
 * 	length := len(text)
 * 
 * 	if ch == '<' || ch == '>' {
 * 		for pos < length && !stringutil.IsLineBreak(ch) {
 * 			pos += size
 * 			ch, size = utf8.DecodeRuneInString(text[pos:])
 * 		}
 * 	} else {
 * 		if ch != '|' && ch != '=' {
 * 			panic("Assertion failed: ch must be either '|' or '='")
 * 		}
 * 		// Consume everything from the start of a ||||||| or ======= marker to the start
 * 		// of the next ======= or >>>>>>> marker.
 * 		for pos < length {
 * 			currentChar := text[pos]
 * 			if (currentChar == '=' || currentChar == '>') && rune(currentChar) != ch && isConflictMarkerTrivia(text, pos) {
 * 				break
 * 			}
 * 
 * 			pos++
 * 		}
 * 	}
 * 
 * 	return pos
 * }
 */
export function scanConflictMarkerTrivia(
  text: string,
  pos: int,
  reportError: ((diag: GoPtr<Message>, pos: int, length: int, ...args: Array<unknown>) => void) | undefined,
): int {
  if (reportError !== undefined) {
    reportError(Merge_conflict_marker_encountered, pos, mergeConflictMarkerLength);
  }
  let [ch, size] = decodeRuneInStringAt(text, pos);
  const length = byteLen(text);

  if (ch === "<".charCodeAt(0) || ch === ">".charCodeAt(0)) {
    while (pos < length && !IsLineBreak(ch)) {
      pos += size;
      [ch, size] = decodeRuneInStringAt(text, pos);
    }
  } else {
    if (ch !== "|".charCodeAt(0) && ch !== "=".charCodeAt(0)) {
      throw new globalThis.Error("Assertion failed: ch must be either '|' or '='");
    }
    // Consume everything from the start of a ||||||| or ======= marker to the start
    // of the next ======= or >>>>>>> marker.
    while (pos < length) {
      const currentChar = byteAt(text, pos);
      if (
        (currentChar === "=".charCodeAt(0) || currentChar === ">".charCodeAt(0)) &&
        currentChar !== ch &&
        isConflictMarkerTrivia(text, pos)
      ) {
        break;
      }

      pos++;
    }
  }

  return pos;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::isShebangTrivia","kind":"func","status":"implemented","sigHash":"a4154018edaa22762f18889ebf0f1c21a75488c8c3de3256b4e4be0248f9fafc","bodyHash":"2a727f4711cee1e5105f083045903c6bb65019b3e1b6365bdbf58abf6f47aad3"}
 *
 * Go source:
 * func isShebangTrivia(text string, pos int) bool {
 * 	if len(text) < 2 {
 * 		return false
 * 	}
 * 	if pos != 0 {
 * 		panic("Shebangs check must only be done at the start of the file")
 * 	}
 * 	return text[0] == '#' && text[1] == '!'
 * }
 */
export function isShebangTrivia(text: string, pos: int): bool {
  if (byteLen(text) < 2) {
    return false;
  }
  if (pos !== 0) {
    throw new globalThis.Error("Shebangs check must only be done at the start of the file");
  }
  return byteAt(text, 0) === "#".charCodeAt(0) && byteAt(text, 1) === "!".charCodeAt(0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::scanShebangTrivia","kind":"func","status":"implemented","sigHash":"28a213d56556961662565da12a7916edcd4b0948db4de4d905b125da462ac792","bodyHash":"c6a44a836eaea90164d2a1a90c89562e49ebc0b7187ddbea8e43e4fc0b8ee98c"}
 *
 * Go source:
 * func scanShebangTrivia(text string, pos int) int {
 * 	pos += 2
 * 	for pos < len(text) {
 * 		ch, size := utf8.DecodeRuneInString(text[pos:])
 * 		if stringutil.IsLineBreak(ch) {
 * 			break
 * 		}
 * 		pos += size
 * 	}
 * 	return pos
 * }
 */
export function scanShebangTrivia(text: string, pos: int): int {
  pos += 2;
  while (pos < byteLen(text)) {
    const [ch, size] = decodeRuneInStringAt(text, pos);
    if (IsLineBreak(ch)) {
      break;
    }
    pos += size;
  }
  return pos;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetShebang","kind":"func","status":"implemented","sigHash":"db88210c534669395c1be1b7fdcf4e87d71c243d8f28773915e7b3f066ac9375","bodyHash":"ac529f036b1bd89b33b2e5988b968145e34cad5ec9f30852e0d19bb9d7a22164"}
 *
 * Go source:
 * func GetShebang(text string) string {
 * 	if !isShebangTrivia(text, 0) {
 * 		return ""
 * 	}
 * 
 * 	end := scanShebangTrivia(text, 0)
 * 	return text[:end]
 * }
 */
export function GetShebang(text: string): string {
  if (!isShebangTrivia(text, 0)) {
    return "";
  }

  const end = scanShebangTrivia(text, 0);
  return byteSlice(text, 0, end);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetScannerForSourceFile","kind":"func","status":"implemented","sigHash":"720bc4aa046156e241c1cc279919d890b8d4aab6a56c0fd5ec1af0aa9b3b8865","bodyHash":"79c2d6bc1c53a79f5b5e9f483ec10e0c80925451b7647df913bf3740b36200dd"}
 *
 * Go source:
 * func GetScannerForSourceFile(sourceFile *ast.SourceFile, pos int) *Scanner {
 * 	s := NewScanner()
 * 	s.text = sourceFile.Text()
 * 	s.pos = pos
 * 	s.end = len(s.text)
 * 	s.languageVariant = sourceFile.LanguageVariant
 * 	s.Scan()
 * 	return s
 * }
 */
export function GetScannerForSourceFile(sourceFile: GoPtr<SourceFile>, pos: int): GoPtr<Scanner> {
  const s = NewScanner();
  s!.text = SourceFile_Text(sourceFile);
  s!.__tsgoEmbedded0.pos = pos;
  s!.end = byteLen(s!.text);
  s!.languageVariant = sourceFile!.LanguageVariant;
  Scanner_Scan(s);
  return s;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::ScanTokenAtPosition","kind":"func","status":"implemented","sigHash":"82ccdc5191586c5ff3bb3565403b3e6a80285e94fd4c2bba2eeca7f22893777b","bodyHash":"f6658dac6f33b211b2aa210418c83d4389a503692d4e52f8141ae92db047817e"}
 *
 * Go source:
 * func ScanTokenAtPosition(sourceFile *ast.SourceFile, pos int) ast.Kind {
 * 	s := GetScannerForSourceFile(sourceFile, pos)
 * 	return s.token
 * }
 */
export function ScanTokenAtPosition(sourceFile: GoPtr<SourceFile>, pos: int): Kind {
  const s = GetScannerForSourceFile(sourceFile, pos);
  return s!.__tsgoEmbedded0.token;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetRangeOfTokenAtPosition","kind":"func","status":"implemented","sigHash":"fee4ce249dbcf24159eca90bfad4e9f7d734e179a86d55d4dd332444d36166de","bodyHash":"66dc75483bc7287529bb85f6dde614d20cc57dda7b27db195444d12cfcdfa6a0"}
 *
 * Go source:
 * func GetRangeOfTokenAtPosition(sourceFile *ast.SourceFile, pos int) core.TextRange {
 * 	s := GetScannerForSourceFile(sourceFile, pos)
 * 	return core.NewTextRange(s.tokenStart, s.pos)
 * }
 */
export function GetRangeOfTokenAtPosition(sourceFile: GoPtr<SourceFile>, pos: int): TextRange {
  const s = GetScannerForSourceFile(sourceFile, pos);
  return NewTextRange(s!.__tsgoEmbedded0.tokenStart, s!.__tsgoEmbedded0.pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetTokenPosOfNode","kind":"func","status":"implemented","sigHash":"330a29f50e4ee95a9d06155e051769eb55062293a4081c031a75e1bf1255fae4","bodyHash":"13003ccba4e9233d74642a7e76a8fa56a56b9cc7f24ac1e9f0407a02c61461f3"}
 *
 * Go source:
 * func GetTokenPosOfNode(node *ast.Node, sourceFile *ast.SourceFile, includeJSDoc bool) int {
 * 	// With nodes that have no width (i.e. 'Missing' nodes), we actually *don't*
 * 	// want to skip trivia because this will launch us forward to the next token.
 * 	if ast.NodeIsMissing(node) {
 * 		return node.Pos()
 * 	}
 * 	if ast.IsJSDocNode(node) || node.Kind == ast.KindJsxText {
 * 		// JsxText cannot actually contain comments, even though the scanner will think it sees comments
 * 		return SkipTriviaEx(sourceFile.Text(), node.Pos(), &SkipTriviaOptions{StopAtComments: true})
 * 	}
 * 	if includeJSDoc && len(node.JSDoc(sourceFile)) > 0 {
 * 		return GetTokenPosOfNode(node.JSDoc(sourceFile)[0], sourceFile, false /*includeJSDoc* /)
 * 	}
 * 	return SkipTriviaEx(sourceFile.Text(), node.Pos(), &SkipTriviaOptions{InJSDoc: node.Flags&ast.NodeFlagsJSDoc != 0})
 * }
 */
export function GetTokenPosOfNode(node: GoPtr<Node>, sourceFile: GoPtr<SourceFile>, includeJSDoc: bool): int {
  // With nodes that have no width (i.e. 'Missing' nodes), we actually *don't*
  // want to skip trivia because this will launch us forward to the next token.
  if (NodeIsMissing(node)) {
    return Node_Pos(node);
  }
  if (IsJSDocNode(node) || node!.Kind === KindJsxText) {
    // JsxText cannot actually contain comments, even though the scanner will think it sees comments
    return SkipTriviaEx(SourceFile_Text(sourceFile), Node_Pos(node), { StopAfterLineBreak: false, StopAtComments: true, InJSDoc: false });
  }
  if (includeJSDoc && Node_JSDoc(node, sourceFile).length > 0) {
    return GetTokenPosOfNode(Node_JSDoc(node, sourceFile)[0]!, sourceFile, false /*includeJSDoc*/);
  }
  return SkipTriviaEx(SourceFile_Text(sourceFile), Node_Pos(node), {
    StopAfterLineBreak: false,
    StopAtComments: false,
    InJSDoc: (node!.Flags & NodeFlagsJSDoc) !== 0,
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::getErrorRangeForArrowFunction","kind":"func","status":"implemented","sigHash":"745fd8ac0c5c82cb873015ab0fb22adbf0a6e10bc1810f5afe445cd1711f1c94","bodyHash":"c3cb3621a2c15d043b28e466edb101b57952189f1f91736414eb3e88a00dbe50"}
 *
 * Go source:
 * func getErrorRangeForArrowFunction(sourceFile *ast.SourceFile, node *ast.Node) core.TextRange {
 * 	pos := SkipTrivia(sourceFile.Text(), node.Pos())
 * 	body := node.Body()
 * 	if body != nil && body.Kind == ast.KindBlock {
 * 		startLine := GetECMALineOfPosition(sourceFile, body.Pos())
 * 		endLine := GetECMALineOfPosition(sourceFile, body.End())
 * 		if startLine < endLine {
 * 			// The arrow function spans multiple lines, make the error span be the first line, inclusive.
 * 			return core.NewTextRange(pos, GetECMAEndLinePosition(sourceFile, startLine)+1)
 * 		}
 * 	}
 * 	return core.NewTextRange(pos, node.End())
 * }
 */
export function getErrorRangeForArrowFunction(sourceFile: GoPtr<SourceFile>, node: GoPtr<Node>): TextRange {
  const like = sourceFileLikeFromSourceFile(sourceFile);
  const pos = SkipTrivia(SourceFile_Text(sourceFile), Node_Pos(node));
  const body = Node_Body(node);
  if (body !== undefined && body!.Kind === kinds.KindBlock) {
    const startLine = GetECMALineOfPosition(like, Node_Pos(body));
    const endLine = GetECMALineOfPosition(like, Node_End(body));
    if (startLine < endLine) {
      // The arrow function spans multiple lines, make the error span be the first line, inclusive.
      return NewTextRange(pos, GetECMAEndLinePosition(sourceFile, startLine) + 1);
    }
  }
  return NewTextRange(pos, Node_End(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetErrorRangeForNode","kind":"func","status":"implemented","sigHash":"2c7127c8ae87742dba321bd9edcb696827cf7e18cf6b86504269b47f981d0b8f","bodyHash":"7b9ce38bff67175709274732d2df11020c319dda1d26757821905f0f8fed6e21"}
 *
 * Go source:
 * func GetErrorRangeForNode(sourceFile *ast.SourceFile, node *ast.Node) core.TextRange {
 * 	errorNode := node
 * 	switch node.Kind {
 * 	case ast.KindSourceFile:
 * 		pos := SkipTrivia(sourceFile.Text(), 0)
 * 		if pos == len(sourceFile.Text()) {
 * 			return core.NewTextRange(0, 0)
 * 		}
 * 		return GetRangeOfTokenAtPosition(sourceFile, pos)
 * 	// This list is a work in progress. Add missing node kinds to improve their error spans
 * 	case ast.KindFunctionDeclaration, ast.KindMethodDeclaration:
 * 		if node.Flags&ast.NodeFlagsReparsed != 0 {
 * 			errorNode = node
 * 			break
 * 		}
 * 		fallthrough
 * 	case ast.KindVariableDeclaration, ast.KindBindingElement, ast.KindClassDeclaration, ast.KindClassExpression, ast.KindInterfaceDeclaration,
 * 		ast.KindModuleDeclaration, ast.KindEnumDeclaration, ast.KindEnumMember, ast.KindFunctionExpression,
 * 		ast.KindGetAccessor, ast.KindSetAccessor, ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration, ast.KindPropertyDeclaration,
 * 		ast.KindPropertySignature, ast.KindNamespaceImport:
 * 		errorNode = ast.GetNameOfDeclaration(node)
 * 	case ast.KindArrowFunction:
 * 		return getErrorRangeForArrowFunction(sourceFile, node)
 * 	case ast.KindCaseClause, ast.KindDefaultClause:
 * 		start := SkipTrivia(sourceFile.Text(), node.Pos())
 * 		end := node.End()
 * 		statements := node.Statements()
 * 		if len(statements) != 0 {
 * 			end = statements[0].Pos()
 * 		}
 * 		return core.NewTextRange(start, end)
 * 	case ast.KindReturnStatement, ast.KindYieldExpression:
 * 		pos := SkipTrivia(sourceFile.Text(), node.Pos())
 * 		return GetRangeOfTokenAtPosition(sourceFile, pos)
 * 	case ast.KindSatisfiesExpression:
 * 		pos := SkipTrivia(sourceFile.Text(), node.AsSatisfiesExpression().Expression.End())
 * 		return GetRangeOfTokenAtPosition(sourceFile, pos)
 * 	case ast.KindConstructor:
 * 		if node.Flags&ast.NodeFlagsReparsed != 0 {
 * 			errorNode = node
 * 			break
 * 		}
 * 		scanner := GetScannerForSourceFile(sourceFile, node.Pos())
 * 		start := scanner.TokenStart()
 * 		for scanner.Token() != ast.KindConstructorKeyword && scanner.Token() != ast.KindStringLiteral && scanner.Token() != ast.KindEndOfFile {
 * 			scanner.Scan()
 * 		}
 * 		return core.NewTextRange(start, scanner.TokenEnd())
 * 		// !!!
 * 		// case KindJSDocSatisfiesTag:
 * 		// 	pos := scanner.SkipTrivia(sourceFile.Text(), node.tagName.pos)
 * 		// 	return scanner.GetRangeOfTokenAtPosition(sourceFile, pos)
 * 	}
 * 	if errorNode == nil {
 * 		// If we don't have a better node, then just set the error on the first token of
 * 		// construct.
 * 		return GetRangeOfTokenAtPosition(sourceFile, node.Pos())
 * 	}
 * 	pos := errorNode.Pos()
 * 	if !ast.NodeIsMissing(errorNode) && !ast.IsJsxText(errorNode) {
 * 		pos = SkipTrivia(sourceFile.Text(), pos)
 * 	}
 * 	return core.NewTextRange(pos, errorNode.End())
 * }
 */
export function GetErrorRangeForNode(sourceFile: GoPtr<SourceFile>, node: GoPtr<Node>): TextRange {
  let errorNode: GoPtr<Node> = node;
  // The Go switch mixes `break`, fallthrough, and early `return`. We mirror the
  // control flow with explicit branches; `fellThroughToDeclarationName` carries
  // the FunctionDeclaration/MethodDeclaration fallthrough into the name-of-
  // declaration group.
  let handled = false;
  let fellThroughToDeclarationName = false;
  const kind = node!.Kind;
  if (kind === kinds.KindSourceFile) {
    const pos = SkipTrivia(SourceFile_Text(sourceFile), 0);
    if (pos === byteLen(SourceFile_Text(sourceFile))) {
      return NewTextRange(0, 0);
    }
    return GetRangeOfTokenAtPosition(sourceFile, pos);
    // This list is a work in progress. Add missing node kinds to improve their error spans
  } else if (kind === kinds.KindFunctionDeclaration || kind === kinds.KindMethodDeclaration) {
    if ((node!.Flags & NodeFlagsReparsed) !== 0) {
      errorNode = node;
      handled = true;
    } else {
      fellThroughToDeclarationName = true;
    }
  }

  if (
    fellThroughToDeclarationName ||
    kind === kinds.KindVariableDeclaration ||
    kind === kinds.KindBindingElement ||
    kind === kinds.KindClassDeclaration ||
    kind === kinds.KindClassExpression ||
    kind === kinds.KindInterfaceDeclaration ||
    kind === kinds.KindModuleDeclaration ||
    kind === kinds.KindEnumDeclaration ||
    kind === kinds.KindEnumMember ||
    kind === kinds.KindFunctionExpression ||
    kind === kinds.KindGetAccessor ||
    kind === kinds.KindSetAccessor ||
    kind === kinds.KindTypeAliasDeclaration ||
    kind === kinds.KindJSTypeAliasDeclaration ||
    kind === kinds.KindPropertyDeclaration ||
    kind === kinds.KindPropertySignature ||
    kind === kinds.KindNamespaceImport
  ) {
    if (!handled) {
      errorNode = GetNameOfDeclaration(node);
      handled = true;
    }
  } else if (!handled && kind === kinds.KindArrowFunction) {
    return getErrorRangeForArrowFunction(sourceFile, node);
  } else if (!handled && (kind === kinds.KindCaseClause || kind === kinds.KindDefaultClause)) {
    const start = SkipTrivia(SourceFile_Text(sourceFile), Node_Pos(node));
    let end = Node_End(node);
    const statements = Node_Statements(node);
    if (statements !== undefined && statements.length !== 0) {
      end = Node_Pos(statements[0]!);
    }
    return NewTextRange(start, end);
  } else if (!handled && (kind === kinds.KindReturnStatement || kind === kinds.KindYieldExpression)) {
    const pos = SkipTrivia(SourceFile_Text(sourceFile), Node_Pos(node));
    return GetRangeOfTokenAtPosition(sourceFile, pos);
  } else if (!handled && kind === kinds.KindSatisfiesExpression) {
    const pos = SkipTrivia(SourceFile_Text(sourceFile), Node_End(AsSatisfiesExpression(node)!.Expression));
    return GetRangeOfTokenAtPosition(sourceFile, pos);
  } else if (!handled && kind === kinds.KindConstructor) {
    if ((node!.Flags & NodeFlagsReparsed) !== 0) {
      errorNode = node;
    } else {
      const scanner = GetScannerForSourceFile(sourceFile, Node_Pos(node));
      const start = Scanner_TokenStart(scanner);
      while (
        Scanner_Token(scanner) !== kinds.KindConstructorKeyword &&
        Scanner_Token(scanner) !== KindStringLiteral &&
        Scanner_Token(scanner) !== KindEndOfFile
      ) {
        Scanner_Scan(scanner);
      }
      return NewTextRange(start, Scanner_TokenEnd(scanner));
      // !!!
      // case KindJSDocSatisfiesTag:
      // 	pos := scanner.SkipTrivia(sourceFile.Text(), node.tagName.pos)
      // 	return scanner.GetRangeOfTokenAtPosition(sourceFile, pos)
    }
  }

  if (errorNode === undefined) {
    // If we don't have a better node, then just set the error on the first token of
    // construct.
    return GetRangeOfTokenAtPosition(sourceFile, Node_Pos(node));
  }
  let pos = Node_Pos(errorNode);
  if (!NodeIsMissing(errorNode) && !IsJsxText(errorNode)) {
    pos = SkipTrivia(SourceFile_Text(sourceFile), pos);
  }
  return NewTextRange(pos, Node_End(errorNode));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::ComputeLineOfPosition","kind":"func","status":"implemented","sigHash":"88aee24aadc9fee51b18945d924462217cd2d3ca5d7f51b5b9b2a079992b9d24","bodyHash":"764b1ee024cb311ad085dc669b89910580a23f7fec50ad294b43d99713d13337"}
 *
 * Go source:
 * func ComputeLineOfPosition(lineStarts []core.TextPos, pos int) int {
 * 	low := 0
 * 	high := len(lineStarts) - 1
 * 	for low <= high {
 * 		middle := low + ((high - low) >> 1)
 * 		value := int(lineStarts[middle])
 * 		if value < pos {
 * 			low = middle + 1
 * 		} else if value > pos {
 * 			high = middle - 1
 * 		} else {
 * 			return middle
 * 		}
 * 	}
 * 	return low - 1
 * }
 */
export function ComputeLineOfPosition(lineStarts: GoSlice<TextPos>, pos: int): int {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const middle = low + ((high - low) >> 1);
    const value = lineStarts[middle]!;
    if (value < pos) {
      low = middle + 1;
    } else if (value > pos) {
      high = middle - 1;
    } else {
      return middle;
    }
  }
  return low - 1;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetECMALineStarts","kind":"func","status":"implemented","sigHash":"ed4ce1b156e7490182553431e03280dc4a9e7948b41e879866d7454a65588567","bodyHash":"27d07300345f770e0006749b31460320dc91ef8271a0dba726abcc19d73b7cd0"}
 *
 * Go source:
 * func GetECMALineStarts(sourceFile ast.SourceFileLike) []core.TextPos {
 * 	return sourceFile.ECMALineMap()
 * }
 */
export function GetECMALineStarts(sourceFile: SourceFileLike): GoSlice<TextPos> {
  return sourceFile.ECMALineMap();
}

// sourceFileLikeFromSourceFile adapts a *ast.SourceFile to the SourceFileLike
// interface (Go: *SourceFile satisfies SourceFileLike via its Text/ECMALineMap
// methods). Methods become free functions in the port, so the adapter forwards.
const sourceFileLikeFromSourceFile = (sourceFile: GoPtr<SourceFile>): SourceFileLike => ({
  Text: (): string => SourceFile_Text(sourceFile),
  ECMALineMap: (): GoSlice<TextPos> => SourceFile_ECMALineMap(sourceFile),
});

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetECMALineOfPosition","kind":"func","status":"implemented","sigHash":"d32a3b05d4d0452e2e07144c3f04c3be049398a4866fefb9db3f221359cd21c4","bodyHash":"eb81450ca1ea59c13e4f9ed5ab4f277828e40aa2a05d5f92f30f0cffd555fc93"}
 *
 * Go source:
 * func GetECMALineOfPosition(sourceFile ast.SourceFileLike, pos int) int {
 * 	lineMap := GetECMALineStarts(sourceFile)
 * 	return ComputeLineOfPosition(lineMap, pos)
 * }
 */
export function GetECMALineOfPosition(sourceFile: SourceFileLike, pos: int): int {
  const lineMap = GetECMALineStarts(sourceFile);
  return ComputeLineOfPosition(lineMap, pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetECMALineAndUTF16CharacterOfPosition","kind":"func","status":"implemented","sigHash":"3053c689ece6d87b64937f35b03ebebae053b2951b4d2af6800fa0daf5c7dead","bodyHash":"b473bc8093a3b6dc2f0ce2e3e5a9180336e485fc25ba5f5b9167002d895587dd"}
 *
 * Go source:
 * func GetECMALineAndUTF16CharacterOfPosition(sourceFile ast.SourceFileLike, pos int) (line int, character core.UTF16Offset) {
 * 	lineMap := GetECMALineStarts(sourceFile)
 * 	line = ComputeLineOfPosition(lineMap, pos)
 * 	character = core.UTF16Len(sourceFile.Text()[lineMap[line]:pos])
 * 	return line, character
 * }
 */
export function GetECMALineAndUTF16CharacterOfPosition(sourceFile: SourceFileLike, pos: int): [int, UTF16Offset] {
  const lineMap = GetECMALineStarts(sourceFile);
  const line = ComputeLineOfPosition(lineMap, pos);
  const character = UTF16Len(byteSlice(sourceFile.Text(), lineMap[line]!, pos));
  return [line, character];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetECMALineAndByteOffsetOfPosition","kind":"func","status":"implemented","sigHash":"fb3e96156b62bc4b0ea02c48ec19961d1f3e4431cfd767069f7c41deed622348","bodyHash":"1659cb494be9d83aa84d3fb6846b08c2b6bb74fb6544f7ec2a342a7978f089fd"}
 *
 * Go source:
 * func GetECMALineAndByteOffsetOfPosition(sourceFile ast.SourceFileLike, pos int) (line int, byteOffset int) {
 * 	lineMap := GetECMALineStarts(sourceFile)
 * 	line = ComputeLineOfPosition(lineMap, pos)
 * 	byteOffset = pos - int(lineMap[line])
 * 	return line, byteOffset
 * }
 */
export function GetECMALineAndByteOffsetOfPosition(sourceFile: SourceFileLike, pos: int): [int, int] {
  const lineMap = GetECMALineStarts(sourceFile);
  const line = ComputeLineOfPosition(lineMap, pos);
  const byteOffset = pos - (lineMap[line]! as int);
  return [line, byteOffset];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetECMAEndLinePosition","kind":"func","status":"implemented","sigHash":"e9bc917e99ad20417260f3e011d7986e87ef43699ac88a31609c73348c8fa402","bodyHash":"1c1df8983c27fb7061f0e192636903a00da9f78b0fb6decdf8c671b8a800e2fd"}
 *
 * Go source:
 * func GetECMAEndLinePosition(sourceFile *ast.SourceFile, line int) int {
 * 	pos := int(GetECMALineStarts(sourceFile)[line])
 * 	for {
 * 		ch, size := utf8.DecodeRuneInString(sourceFile.Text()[pos:])
 * 		if size == 0 || stringutil.IsLineBreak(ch) {
 * 			return pos - 1
 * 		}
 * 		pos += size
 * 	}
 * }
 */
export function GetECMAEndLinePosition(sourceFile: GoPtr<SourceFile>, line: int): int {
  const like = sourceFileLikeFromSourceFile(sourceFile);
  let pos = GetECMALineStarts(like)[line]! as int;
  for (;;) {
    const [ch, size] = decodeRuneInStringAt(SourceFile_Text(sourceFile), pos);
    if (size === 0 || IsLineBreak(ch)) {
      return pos - 1;
    }
    pos += size;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetECMAPositionOfLineAndUTF16Character","kind":"func","status":"implemented","sigHash":"9c46ed1e97225af0e454c95cf844604ae34723ba8140f37c87281bd6b9bb2cf3","bodyHash":"12c608b1d33dac1b9c65145f6a73c5f50535294d4c5d82013bedefe8cf2b3ab6"}
 *
 * Go source:
 * func GetECMAPositionOfLineAndUTF16Character(sourceFile ast.SourceFileLike, line int, character core.UTF16Offset) int {
 * 	lineStarts := GetECMALineStarts(sourceFile)
 * 	return ComputePositionOfLineAndUTF16Character(lineStarts, line, character, sourceFile.Text(), false)
 * }
 */
export function GetECMAPositionOfLineAndUTF16Character(sourceFile: SourceFileLike, line: int, character: UTF16Offset): int {
  const lineStarts = GetECMALineStarts(sourceFile);
  return ComputePositionOfLineAndUTF16Character(lineStarts, line, character, sourceFile.Text(), false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetECMAPositionOfLineAndByteOffset","kind":"func","status":"implemented","sigHash":"8423e812ccd80b66f50668ad4d5b4480b0c2313e978c547282ad4e68ae4ee9ab","bodyHash":"09b5eb4fcc89560d57f20eca44f493c91a0b4e59612bacc1c7dc02440fe262b5"}
 *
 * Go source:
 * func GetECMAPositionOfLineAndByteOffset(sourceFile ast.SourceFileLike, line int, byteOffset int) int {
 * 	return ComputePositionOfLineAndByteOffset(GetECMALineStarts(sourceFile), line, byteOffset)
 * }
 */
export function GetECMAPositionOfLineAndByteOffset(sourceFile: SourceFileLike, line: int, byteOffset: int): int {
  return ComputePositionOfLineAndByteOffset(GetECMALineStarts(sourceFile), line, byteOffset);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::ComputePositionOfLineAndByteOffset","kind":"func","status":"implemented","sigHash":"4822b86373efe37c98ba76ff97d16394b8908f5f9cc04b281081339673f14d53","bodyHash":"f2a4e7b3081d1f78e844e68753a821ca47201c2a66e0959bb862649da20db993"}
 *
 * Go source:
 * func ComputePositionOfLineAndByteOffset(lineStarts []core.TextPos, line int, byteOffset int) int {
 * 	if line < 0 || line >= len(lineStarts) {
 * 		panic(fmt.Sprintf("Bad line number. Line: %d, lineStarts.length: %d.", line, len(lineStarts)))
 * 	}
 * 	return int(lineStarts[line]) + byteOffset
 * }
 */
export function ComputePositionOfLineAndByteOffset(lineStarts: GoSlice<TextPos>, line: int, byteOffset: int): int {
  if (line < 0 || line >= lineStarts.length) {
    throw new globalThis.Error(fmt.Sprintf("Bad line number. Line: %d, lineStarts.length: %d.", line, lineStarts.length));
  }
  return lineStarts[line]! + byteOffset;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::ComputePositionOfLineAndUTF16Character","kind":"func","status":"implemented","sigHash":"910342beb68a483b42495f22eba79f0b6c7939153374e904f166b3d67c23ebb0","bodyHash":"50534c9b9097fb08b686b54f4f8483349cc3cd6202152d8e25ccda8833767520"}
 *
 * Go source:
 * func ComputePositionOfLineAndUTF16Character(lineStarts []core.TextPos, line int, character core.UTF16Offset, text string, allowEdits bool) int {
 * 	if line < 0 || line >= len(lineStarts) {
 * 		if allowEdits {
 * 			// Clamp line to nearest allowable value
 * 			if line < 0 {
 * 				line = 0
 * 			} else if line >= len(lineStarts) {
 * 				line = len(lineStarts) - 1
 * 			}
 * 		} else {
 * 			panic(fmt.Sprintf("Bad line number. Line: %d, lineStarts.length: %d.", line, len(lineStarts)))
 * 		}
 * 	}
 * 
 * 	lineStart := int(lineStarts[line])
 * 
 * 	if character > 0 {
 * 		// UTF-16 character offset: scan from line start counting UTF-16 code units.
 * 		lineEnd := len(text)
 * 		if line+1 < len(lineStarts) {
 * 			lineEnd = int(lineStarts[line+1])
 * 		}
 * 		utf16Count := core.UTF16Offset(0)
 * 		pos := lineStart
 * 		for pos < lineEnd {
 * 			if utf16Count >= character {
 * 				break
 * 			}
 * 			r, size := utf8.DecodeRuneInString(text[pos:])
 * 			utf16Count += core.UTF16Offset(utf16.RuneLen(r))
 * 			pos += size
 * 		}
 * 		if !allowEdits {
 * 			if pos == lineEnd && utf16Count < character {
 * 				panic(fmt.Sprintf("Bad UTF-16 character offset. Line: %d, character: %d.", line, character))
 * 			}
 * 			debug.Assert(pos <= len(text))
 * 			return pos
 * 		}
 * 		if pos > len(text) {
 * 			return len(text)
 * 		}
 * 		return pos
 * 	}
 * 
 * 	// Character is 0: line start position.
 * 	res := lineStart
 * 
 * 	if allowEdits {
 * 		if res > len(text) {
 * 			return len(text)
 * 		}
 * 		return res
 * 	}
 * 	debug.Assert(res <= len(text)) // Allow single character overflow for trailing newline
 * 	return res
 * }
 */
export function ComputePositionOfLineAndUTF16Character(lineStarts: GoSlice<TextPos>, line: int, character: UTF16Offset, text: string, allowEdits: bool): int {
  if (line < 0 || line >= lineStarts.length) {
    if (allowEdits) {
      // Clamp line to nearest allowable value
      if (line < 0) {
        line = 0;
      } else if (line >= lineStarts.length) {
        line = lineStarts.length - 1;
      }
    } else {
      throw new globalThis.Error(fmt.Sprintf("Bad line number. Line: %d, lineStarts.length: %d.", line, lineStarts.length));
    }
  }

  const lineStart = lineStarts[line]!;

  if (character > 0) {
    // UTF-16 character offset: scan from line start counting UTF-16 code units.
    let lineEnd = byteLen(text);
    if (line + 1 < lineStarts.length) {
      lineEnd = lineStarts[line + 1]!;
    }
    let utf16Count: UTF16Offset = 0;
    let pos = lineStart;
    while (pos < lineEnd) {
      if (utf16Count >= character) {
        break;
      }
      const [r, size] = decodeRuneInStringAt(text, pos);
      utf16Count += utf16.RuneLen(r);
      pos += size;
    }
    if (!allowEdits) {
      if (pos === lineEnd && utf16Count < character) {
        throw new globalThis.Error(fmt.Sprintf("Bad UTF-16 character offset. Line: %d, character: %d.", line, character));
      }
      debug.Assert(pos <= byteLen(text));
      return pos;
    }
    if (pos > byteLen(text)) {
      return byteLen(text);
    }
    return pos;
  }

  // Character is 0: line start position.
  const res = lineStart;

  if (allowEdits) {
    if (res > byteLen(text)) {
      return byteLen(text);
    }
    return res;
  }
  debug.Assert(res <= byteLen(text)); // Allow single character overflow for trailing newline
  return res;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetLeadingCommentRanges","kind":"func","status":"implemented","sigHash":"4117676ed75986086d2dd9450cd26fe8d9a9eecdbdbd80583e2bc89d7e5e39c0","bodyHash":"be8a468f55a9af19e50b8aff0cf4e089e90be2f851830bd8b0f2556e07a705aa"}
 *
 * Go source:
 * func GetLeadingCommentRanges(f *ast.NodeFactory, text string, pos int) iter.Seq[ast.CommentRange] {
 * 	return iterateCommentRanges(f, text, pos, false)
 * }
 */
export function GetLeadingCommentRanges(f: GoPtr<NodeFactory>, text: string, pos: int): GoSeq<CommentRange> {
  return iterateCommentRanges(f, text, pos, false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetTrailingCommentRanges","kind":"func","status":"implemented","sigHash":"2c082fe2bb6a864d99ada3c874fa0f5549a00c5ef6be9741275ec867204c28c7","bodyHash":"954192d0ab9acd599d22664b82a7d003a936f1ea7975b35faa2a73473c5fde32"}
 *
 * Go source:
 * func GetTrailingCommentRanges(f *ast.NodeFactory, text string, pos int) iter.Seq[ast.CommentRange] {
 * 	return iterateCommentRanges(f, text, pos, true)
 * }
 */
export function GetTrailingCommentRanges(f: GoPtr<NodeFactory>, text: string, pos: int): GoSeq<CommentRange> {
  return iterateCommentRanges(f, text, pos, true);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::iterateCommentRanges","kind":"func","status":"implemented","sigHash":"950d4c94afbed592bb044975542a6dc636ee1a5bc0c42042a973550e0ba2d3ec","bodyHash":"d35ea916207f1295b8ec7b311ca6c0bdd811dd4c13ec5294eb4b7b77dcc30963"}
 *
 * Go source:
 * func iterateCommentRanges(f *ast.NodeFactory, text string, pos int, trailing bool) iter.Seq[ast.CommentRange] {
 * 	return func(yield func(ast.CommentRange) bool) {
 * 		var pendingPos int
 * 		var pendingEnd int
 * 		var pendingKind ast.Kind
 * 		var pendingHasTrailingNewLine bool
 * 		hasPendingCommentRange := false
 * 		collecting := trailing
 * 		if pos == 0 {
 * 			collecting = true
 * 			if isShebangTrivia(text, pos) {
 * 				pos = scanShebangTrivia(text, pos)
 * 			}
 * 		}
 * 	scan:
 * 		for pos >= 0 && pos < len(text) {
 * 			ch, size := utf8.DecodeRuneInString(text[pos:])
 * 			switch ch {
 * 			case '\r':
 * 				if pos+1 < len(text) && text[pos+1] == '\n' {
 * 					pos++
 * 				}
 * 				fallthrough
 * 			case '\n':
 * 				pos++
 * 				if trailing {
 * 					break scan
 * 				}
 * 
 * 				collecting = true
 * 				if hasPendingCommentRange {
 * 					pendingHasTrailingNewLine = true
 * 				}
 * 
 * 				continue
 * 			case '\t', '\v', '\f', ' ':
 * 				pos++
 * 				continue
 * 			case '/':
 * 				var nextChar byte
 * 				if pos+1 < len(text) {
 * 					nextChar = text[pos+1]
 * 				}
 * 				hasTrailingNewLine := false
 * 				if nextChar == '/' || nextChar == '*' {
 * 					var kind ast.Kind
 * 					if nextChar == '/' {
 * 						kind = ast.KindSingleLineCommentTrivia
 * 					} else {
 * 						kind = ast.KindMultiLineCommentTrivia
 * 					}
 * 
 * 					startPos := pos
 * 					pos += 2
 * 					if nextChar == '/' {
 * 						for pos < len(text) {
 * 							c, s := utf8.DecodeRuneInString(text[pos:])
 * 							if stringutil.IsLineBreak(c) {
 * 								hasTrailingNewLine = true
 * 								break
 * 							}
 * 							pos += s
 * 						}
 * 					} else {
 * 						for pos < len(text) {
 * 							c, s := utf8.DecodeRuneInString(text[pos:])
 * 							if c == '*' && pos+1 < len(text) && text[pos+1] == '/' {
 * 								pos += 2
 * 								break
 * 							}
 * 							pos += s
 * 						}
 * 					}
 * 
 * 					if collecting {
 * 						if hasPendingCommentRange {
 * 							if !yield(f.NewCommentRange(pendingKind, pendingPos, pendingEnd, pendingHasTrailingNewLine)) {
 * 								return
 * 							}
 * 						}
 * 
 * 						pendingPos = startPos
 * 						pendingEnd = pos
 * 						pendingKind = kind
 * 						pendingHasTrailingNewLine = hasTrailingNewLine
 * 						hasPendingCommentRange = true
 * 					}
 * 
 * 					continue
 * 				}
 * 				break scan
 * 			default:
 * 				if ch > unicode.MaxASCII && (stringutil.IsWhiteSpaceLike(ch)) {
 * 					if hasPendingCommentRange && stringutil.IsLineBreak(ch) {
 * 						pendingHasTrailingNewLine = true
 * 					}
 * 					pos += size
 * 					continue
 * 				}
 * 				break scan
 * 			}
 * 		}
 * 
 * 		if hasPendingCommentRange {
 * 			yield(f.NewCommentRange(pendingKind, pendingPos, pendingEnd, pendingHasTrailingNewLine))
 * 		}
 * 	}
 * }
 */
export function iterateCommentRanges(f: GoPtr<NodeFactory>, text: string, pos: int, trailing: bool): GoSeq<CommentRange> {
  return (yield_: (value: CommentRange) => bool): void => {
    let pendingPos = 0;
    let pendingEnd = 0;
    let pendingKind: Kind = KindUnknown;
    let pendingHasTrailingNewLine = false;
    let hasPendingCommentRange = false;
    let collecting = trailing;
    if (pos === 0) {
      collecting = true;
      if (isShebangTrivia(text, pos)) {
        pos = scanShebangTrivia(text, pos);
      }
    }
    scan: for (; pos >= 0 && pos < byteLen(text); ) {
      const [ch, size] = decodeRuneInStringAt(text, pos);
      switch (ch) {
        case "\r".charCodeAt(0):
        case "\n".charCodeAt(0): {
          if (ch === "\r".charCodeAt(0)) {
            if (pos + 1 < byteLen(text) && byteAt(text, pos + 1) === "\n".charCodeAt(0)) {
              pos++;
            }
            // fallthrough to '\n'
          }
          pos++;
          if (trailing) {
            break scan;
          }

          collecting = true;
          if (hasPendingCommentRange) {
            pendingHasTrailingNewLine = true;
          }

          continue;
        }
        case "\t".charCodeAt(0):
        case "\v".charCodeAt(0):
        case "\f".charCodeAt(0):
        case " ".charCodeAt(0):
          pos++;
          continue;
        case "/".charCodeAt(0): {
          let nextChar: byte = 0 as byte;
          if (pos + 1 < byteLen(text)) {
            nextChar = byteAt(text, pos + 1) as byte;
          }
          let hasTrailingNewLine = false;
          if (nextChar === "/".charCodeAt(0) || nextChar === "*".charCodeAt(0)) {
            let kind: Kind;
            if (nextChar === "/".charCodeAt(0)) {
              kind = KindSingleLineCommentTrivia;
            } else {
              kind = KindMultiLineCommentTrivia;
            }

            const startPos = pos;
            pos += 2;
            if (nextChar === "/".charCodeAt(0)) {
              while (pos < byteLen(text)) {
                const [c, sz] = decodeRuneInStringAt(text, pos);
                if (IsLineBreak(c)) {
                  hasTrailingNewLine = true;
                  break;
                }
                pos += sz;
              }
            } else {
              while (pos < byteLen(text)) {
                const [c, sz] = decodeRuneInStringAt(text, pos);
                if (c === "*".charCodeAt(0) && pos + 1 < byteLen(text) && byteAt(text, pos + 1) === "/".charCodeAt(0)) {
                  pos += 2;
                  break;
                }
                pos += sz;
              }
            }

            if (collecting) {
              if (hasPendingCommentRange) {
                if (!yield_(NodeFactory_NewCommentRange(f, pendingKind, pendingPos, pendingEnd, pendingHasTrailingNewLine))) {
                  return;
                }
              }

              pendingPos = startPos;
              pendingEnd = pos;
              pendingKind = kind;
              pendingHasTrailingNewLine = hasTrailingNewLine;
              hasPendingCommentRange = true;
            }

            continue;
          }
          break scan;
        }
        default: {
          if (ch > unicode.MaxASCII && IsWhiteSpaceLike(ch)) {
            if (hasPendingCommentRange && IsLineBreak(ch)) {
              pendingHasTrailingNewLine = true;
            }
            pos += size;
            continue;
          }
          break scan;
        }
      }
    }

    if (hasPendingCommentRange) {
      yield_(NodeFactory_NewCommentRange(f, pendingKind, pendingPos, pendingEnd, pendingHasTrailingNewLine));
    }
  };
}
