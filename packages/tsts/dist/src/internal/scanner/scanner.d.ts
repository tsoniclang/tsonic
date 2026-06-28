import type { bool, byte, int } from "../../go/scalars.js";
import type { GoArray, GoComparable, GoConstraint, GoMap, GoPtr, GoRune, GoSeq, GoSlice } from "../../go/compat.js";
import * as utf8 from "../../go/unicode/utf8.js";
import type { CommentDirective, CommentRange, SourceFile, SourceFileLike } from "../ast/ast.js";
import type { Node } from "../ast/spine.js";
import type { NodeFactory } from "../ast/generated/factory.js";
import type { Kind } from "../ast/generated/kinds.js";
import type { TokenFlags as TokenFlags_4c7e9c27 } from "../ast/tokenflags.js";
import type { UTF16Offset } from "../core/core.js";
import type { ScriptTarget } from "../core/compileroptions.js";
import type { LanguageVariant } from "../core/languagevariant.js";
import type { TextPos, TextRange } from "../core/text.js";
import type { Message } from "../diagnostics/diagnostics.js";
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
export declare const EscapeSequenceScanningFlagsString: EscapeSequenceScanningFlags;
export declare const EscapeSequenceScanningFlagsReportErrors: EscapeSequenceScanningFlags;
export declare const EscapeSequenceScanningFlagsRegularExpression: EscapeSequenceScanningFlags;
export declare const EscapeSequenceScanningFlagsAnnexB: EscapeSequenceScanningFlags;
export declare const EscapeSequenceScanningFlagsAnyUnicodeMode: EscapeSequenceScanningFlags;
export declare const EscapeSequenceScanningFlagsAtomEscape: EscapeSequenceScanningFlags;
export declare const EscapeSequenceScanningFlagsReportInvalidEscapeErrors: EscapeSequenceScanningFlags;
export declare const EscapeSequenceScanningFlagsAllowExtendedUnicodeEscape: EscapeSequenceScanningFlags;
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
export declare const textToKeyword: GoMap<string, Kind>;
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
export declare const textToToken: GoMap<string, Kind>;
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
 * @tsgo-override {
 *   "category": "runtime-performance",
 *   "allow": ["signature"],
 *   "reason": "Carry one scanner-local source byte view as a runtime cache; this is not TS-Go semantic state and keeps public scanner behavior unchanged.",
 *   "goSignature": "interface{CanFollowJSDocAt?:()=>packages/tsts/src/go/scalars.ts::bool;CommentDirectives?:()=>packages/tsts/src/go/compat.ts::GoSlice<packages/tsts/src/internal/ast/ast.ts::CommentDirective>;ContainsNonASCII?:()=>packages/tsts/src/go/scalars.ts::bool;HasExtendedUnicodeEscape?:()=>packages/tsts/src/go/scalars.ts::bool;HasPrecedingJSDocComment?:()=>packages/tsts/src/go/scalars.ts::bool;HasPrecedingJSDocLeadingAsterisks?:()=>packages/tsts/src/go/scalars.ts::bool;HasPrecedingJSDocWithDeprecatedTag?:()=>packages/tsts/src/go/scalars.ts::bool;HasPrecedingJSDocWithSeeOrLink?:()=>packages/tsts/src/go/scalars.ts::bool;HasPrecedingLineBreak?:()=>packages/tsts/src/go/scalars.ts::bool;HasUnicodeEscape?:()=>packages/tsts/src/go/scalars.ts::bool;Mark?:()=>packages/tsts/src/internal/scanner/scanner.ts::ScannerState;ReScanAsteriskEqualsToken?:()=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;ReScanGreaterThanToken?:()=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;ReScanHashToken?:()=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;ReScanJsxAttributeValue?:()=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;ReScanJsxToken?:(packages/tsts/src/go/scalars.ts::bool)=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;ReScanLessThanToken?:()=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;ReScanQuestionToken?:()=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;ReScanSlashToken?:(...packages/tsts/src/go/scalars.ts::bool[])=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;ReScanTemplateToken?:(packages/tsts/src/go/scalars.ts::bool)=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;Reset?:()=>void;ResetPos?:(packages/tsts/src/go/scalars.ts::int)=>void;ResetTokenState?:(packages/tsts/src/go/scalars.ts::int)=>void;Rewind?:(packages/tsts/src/internal/scanner/scanner.ts::ScannerState)=>void;Scan?:()=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;ScanJSDocCommentTextToken?:(packages/tsts/src/go/scalars.ts::bool)=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;ScanJSDocToken?:()=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;ScanJsxAttributeValue?:()=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;ScanJsxIdentifier?:()=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;ScanJsxToken?:()=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;ScanJsxTokenEx?:(packages/tsts/src/go/scalars.ts::bool)=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;SetLanguageVariant?:(packages/tsts/src/internal/core/languagevariant.ts::LanguageVariant)=>void;SetOnError?:(packages/tsts/src/internal/scanner/scanner.ts::ErrorCallback)=>void;SetScriptTarget?:(packages/tsts/src/internal/core/compileroptions.ts::ScriptTarget)=>void;SetSkipJSDocLeadingAsterisks?:(packages/tsts/src/go/scalars.ts::bool)=>void;SetSkipTrivia?:(packages/tsts/src/go/scalars.ts::bool)=>void;SetText?:(string)=>void;Text?:()=>string;Token?:()=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;TokenEnd?:()=>packages/tsts/src/go/scalars.ts::int;TokenFlags?:()=>packages/tsts/src/internal/ast/tokenflags.ts::TokenFlags;TokenFullStart?:()=>packages/tsts/src/go/scalars.ts::int;TokenRange?:()=>packages/tsts/src/internal/core/text.ts::TextRange;TokenStart?:()=>packages/tsts/src/go/scalars.ts::int;TokenText?:()=>string;TokenValue?:()=>string;__tsgoEmbedded0?:packages/tsts/src/internal/scanner/scanner.ts::ScannerState;char?:()=>packages/tsts/src/go/compat.ts::GoRune;charAndSize?:()=>[packages/tsts/src/go/compat.ts::GoRune,packages/tsts/src/go/scalars.ts::int];charAt?:(packages/tsts/src/go/scalars.ts::int)=>packages/tsts/src/go/compat.ts::GoRune;checkRegularExpressionFlagAvailability?:(packages/tsts/src/internal/scanner/regexp.ts::regularExpressionFlags,packages/tsts/src/go/scalars.ts::int,packages/tsts/src/go/scalars.ts::int)=>void;containsNonASCII:packages/tsts/src/go/scalars.ts::bool;end:packages/tsts/src/go/scalars.ts::int;error?:(packages/tsts/src/go/compat.ts::GoPtr<packages/tsts/src/internal/diagnostics/diagnostics.ts::Message>)=>void;errorAt?:(packages/tsts/src/go/compat.ts::GoPtr<packages/tsts/src/internal/diagnostics/diagnostics.ts::Message>,packages/tsts/src/go/scalars.ts::int,packages/tsts/src/go/scalars.ts::int,...unknown[])=>void;hexDigitCache:packages/tsts/src/go/compat.ts::GoMap<string,string>;hexNumberCache:packages/tsts/src/go/compat.ts::GoMap<string,string>;languageVariant:packages/tsts/src/internal/core/languagevariant.ts::LanguageVariant;languageVersion?:()=>packages/tsts/src/internal/core/compileroptions.ts::ScriptTarget;numberCache:packages/tsts/src/go/compat.ts::GoMap<string,string>;onError:packages/tsts/src/internal/scanner/scanner.ts::ErrorCallback;peekUnicodeEscape?:()=>packages/tsts/src/go/compat.ts::GoRune;processCommentDirective?:(packages/tsts/src/go/scalars.ts::int,packages/tsts/src/go/scalars.ts::int,packages/tsts/src/go/scalars.ts::bool)=>void;reScanGreaterThanTokenInner?:()=>void;scanASCIIWhile?:((packages/tsts/src/go/scalars.ts::byte)=>packages/tsts/src/go/scalars.ts::bool)=>void;scanBigIntSuffix?:()=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;scanBinaryOrOctalDigits?:(packages/tsts/src/go/scalars.ts::int)=>string;scanDigits?:()=>[string,packages/tsts/src/go/scalars.ts::bool];scanEscapeSequence?:(packages/tsts/src/internal/scanner/scanner.ts::EscapeSequenceScanningFlags)=>string;scanHexDigits?:(packages/tsts/src/go/scalars.ts::int,packages/tsts/src/go/scalars.ts::bool,packages/tsts/src/go/scalars.ts::bool)=>string;scanIdentifier?:(packages/tsts/src/go/scalars.ts::int)=>packages/tsts/src/go/scalars.ts::bool;scanIdentifierParts?:()=>string;scanInvalidCharacter?:()=>void;scanJSDocCommentForTags?:(string)=>void;scanLowSurrogateEscape?:(packages/tsts/src/go/compat.ts::GoRune)=>[packages/tsts/src/go/compat.ts::GoRune,packages/tsts/src/go/scalars.ts::bool];scanNumber?:()=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;scanNumberFragment?:()=>string;scanString?:(packages/tsts/src/go/scalars.ts::bool)=>string;scanTemplateAndSetTokenValue?:(packages/tsts/src/go/scalars.ts::bool)=>packages/tsts/src/internal/ast/generated/kinds.ts::Kind;scanUnicodeEscape?:(packages/tsts/src/go/scalars.ts::bool)=>packages/tsts/src/go/compat.ts::GoRune;scriptTarget:packages/tsts/src/internal/core/compileroptions.ts::ScriptTarget;skipTrivia:packages/tsts/src/go/scalars.ts::bool;text:string}",
 *   "tsSignature": "interface{__tsgoEmbedded0:packages/tsts/src/internal/scanner/scanner.ts::ScannerState;containsNonASCII:packages/tsts/src/go/scalars.ts::bool;end:packages/tsts/src/go/scalars.ts::int;hexDigitCache:packages/tsts/src/go/compat.ts::GoMap<string,string>;hexNumberCache:packages/tsts/src/go/compat.ts::GoMap<string,string>;languageVariant:packages/tsts/src/internal/core/languagevariant.ts::LanguageVariant;numberCache:packages/tsts/src/go/compat.ts::GoMap<string,string>;onError:packages/tsts/src/internal/scanner/scanner.ts::ErrorCallback;scriptTarget:packages/tsts/src/internal/core/compileroptions.ts::ScriptTarget;skipTrivia:packages/tsts/src/go/scalars.ts::bool;sourceByteView:packages/tsts/src/go/unicode/utf8.ts::StringByteView;text:string}"
 * }
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
    sourceByteView: utf8.StringByteView;
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
export declare function defaultScanner(): Scanner;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::NewScanner","kind":"func","status":"implemented","sigHash":"824b1c9d119d384513dbe8e8500292ae2b0912e2e0124cfaf3d35b98c8f0cc98","bodyHash":"b29c1c3cb784062067e024e16fe037df35c271d0c93d52216a840ff293e52d7a"}
 *
 * Go source:
 * func NewScanner() *Scanner {
 * 	s := defaultScanner()
 * 	return &s
 * }
 */
export declare function NewScanner(): GoPtr<Scanner>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.Reset","kind":"method","status":"implemented","sigHash":"81860126af7e9c4c3c1d20c1029c54c99c301e87d978c5bec8e14b1fe7606692","bodyHash":"8c3d03f7f94175f228f39c4a2cb37fff21f92508e0316b2e73711854e57deaa6"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Clear the scanner-local source byte-view cache when the scanner text is reset; the observable Scanner state remains TS-Go exact."}
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
export declare function Scanner_Reset(receiver: GoPtr<Scanner>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::cleared","kind":"func","status":"implemented","sigHash":"1bbfef56d8cf46b679e2e91d918ef70872a3ec40711d7e517cb02f3d0ac2c96f","bodyHash":"ace5d48e3d2b43b2444e6f6c612d580a68927f07eb3e48b041a49a8126cdaf20"}
 *
 * Go source:
 * func cleared[M ~map[K]V, K comparable, V any](m M) M {
 * 	clear(m)
 * 	return m
 * }
 */
export declare function cleared<M extends GoConstraint<"~map[K]V"> & GoMap<K, V>, K extends GoComparable, V>(m: M): M;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.Text","kind":"method","status":"implemented","sigHash":"7a04356c5b198a952bcc4b2cd44f1f25290b6071dfe09eab5b8f6ddc786d8c0a","bodyHash":"0db52043412d99d2fe776ce9cd0dff226125303b5248ff4ce263294ebb444a8e"}
 *
 * Go source:
 * func (s *Scanner) Text() string {
 * 	return s.text
 * }
 */
export declare function Scanner_Text(receiver: GoPtr<Scanner>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.Token","kind":"method","status":"implemented","sigHash":"329b864e3dee67eb1fcca8c61564dc3a640ab22e7325fc00a198e81ab68946f4","bodyHash":"ef1a2ab696454d878f4f80c06c1783adf9692e1e34a046ff231b251cd4bf52fc"}
 *
 * Go source:
 * func (s *Scanner) Token() ast.Kind {
 * 	return s.token
 * }
 */
export declare function Scanner_Token(receiver: GoPtr<Scanner>): Kind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.TokenFlags","kind":"method","status":"implemented","sigHash":"d958025732a7ade0566c5597387342a6716fe320fd6c1f6ebdeaf650bf4ef41b","bodyHash":"345ae5241abe5355a545e6cc72cfffe5a81560a059210dcd1c7722bffb169eed"}
 *
 * Go source:
 * func (s *Scanner) TokenFlags() ast.TokenFlags {
 * 	return s.tokenFlags
 * }
 */
export declare function Scanner_TokenFlags(receiver: GoPtr<Scanner>): TokenFlags_4c7e9c27;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.TokenFullStart","kind":"method","status":"implemented","sigHash":"7d79759df5df93f37b42202bdd7ee1c8c16bc8ee5a633059cbffa59c1d322fa1","bodyHash":"5e98ab038e14adc612c16b063227b44f7dff8a17044c5b2a0350a528867d89d6"}
 *
 * Go source:
 * func (s *Scanner) TokenFullStart() int {
 * 	return s.fullStartPos
 * }
 */
export declare function Scanner_TokenFullStart(receiver: GoPtr<Scanner>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.TokenStart","kind":"method","status":"implemented","sigHash":"9e27e4896173256750d66506eba0ae5d52b776ae2bdb3191c76df9e23a9b75f5","bodyHash":"c1f81dadca37007c9b54f96b67055a46ca77435424d093666552e84f729d9ce2"}
 *
 * Go source:
 * func (s *Scanner) TokenStart() int {
 * 	return s.tokenStart
 * }
 */
export declare function Scanner_TokenStart(receiver: GoPtr<Scanner>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.TokenEnd","kind":"method","status":"implemented","sigHash":"f894c4872fe8bc212c65409f3cdb53aa9476894b6854b83307ca6fcf63038143","bodyHash":"f3a1df33f5fac1150eabc66b383aa8aab7a88a44c315da1d5449b463c824d7d7"}
 *
 * Go source:
 * func (s *Scanner) TokenEnd() int {
 * 	return s.pos
 * }
 */
export declare function Scanner_TokenEnd(receiver: GoPtr<Scanner>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.TokenText","kind":"method","status":"implemented","sigHash":"ccfc66dd051d6e9cf4d55f15be6a0271cdeea0c397ebac3160a504fffd8f2f8c","bodyHash":"674c308611e10f1afffacebcf558f312ee8402f6b4aec9f1c55252e92fe0fbae"}
 *
 * Go source:
 * func (s *Scanner) TokenText() string {
 * 	return s.text[s.tokenStart:s.pos]
 * }
 */
export declare function Scanner_TokenText(receiver: GoPtr<Scanner>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.TokenValue","kind":"method","status":"implemented","sigHash":"22ef3e4949cd0abc50983e77fc5b8b7821e4c14c0a3b90f8bd4067af43c40f4f","bodyHash":"e34257d6be24f5aa1f92875f646234a2006d0e9b2db8f6350d5c2d663ec131d3"}
 *
 * Go source:
 * func (s *Scanner) TokenValue() string {
 * 	return s.tokenValue
 * }
 */
export declare function Scanner_TokenValue(receiver: GoPtr<Scanner>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.TokenRange","kind":"method","status":"implemented","sigHash":"5846d9e2a986f56a70c871937a8d467b406f6a05dfe0b844d177e955ea5f14f9","bodyHash":"cb0ecfce338a5730f1b445a3a934a07dab73e60d78556e5a2094120c4e0da190"}
 *
 * Go source:
 * func (s *Scanner) TokenRange() core.TextRange {
 * 	return core.NewTextRange(s.tokenStart, s.pos)
 * }
 */
export declare function Scanner_TokenRange(receiver: GoPtr<Scanner>): TextRange;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.CommentDirectives","kind":"method","status":"implemented","sigHash":"8bb177e3a622bf30aa8985f59c1c890e83c4a31f1431e05d0d5fcd0a5decd32c","bodyHash":"b4020ed76da9fed40c4ab1ff9ccca8fcdd482829f4916eed4cc49b1e6fac1778"}
 *
 * Go source:
 * func (s *Scanner) CommentDirectives() []ast.CommentDirective {
 * 	return s.commentDirectives
 * }
 */
export declare function Scanner_CommentDirectives(receiver: GoPtr<Scanner>): GoSlice<CommentDirective>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.Mark","kind":"method","status":"implemented","sigHash":"bfa17a5c7a0c803fb17cf30ceb243ee8e3f82c5464e2f6483b95a69916cbe9b7","bodyHash":"d9d7447aab40ac0c27e15852ac332c11d726b42592c5e0e17dd1aa66422bf899"}
 *
 * Go source:
 * func (s *Scanner) Mark() ScannerState {
 * 	return s.ScannerState
 * }
 */
export declare function Scanner_Mark(receiver: GoPtr<Scanner>): ScannerState;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.Rewind","kind":"method","status":"implemented","sigHash":"77e2ac1ac2f64f14a99e68f5148d7a85c4ad48956dcc1ae409555acb66f2a549","bodyHash":"3ba534c3a8d73a6647aed5a34d4eb30dd030b9e9d607eb46bcee2ea896c62ec5"}
 *
 * Go source:
 * func (s *Scanner) Rewind(state ScannerState) {
 * 	s.ScannerState = state
 * }
 */
export declare function Scanner_Rewind(receiver: GoPtr<Scanner>, state: ScannerState): void;
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
export declare function Scanner_ResetPos(receiver: GoPtr<Scanner>, pos: int): void;
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
export declare function Scanner_ResetTokenState(receiver: GoPtr<Scanner>, pos: int): void;
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
export declare function Scanner_SetSkipJSDocLeadingAsterisks(receiver: GoPtr<Scanner>, skip: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.SetSkipTrivia","kind":"method","status":"implemented","sigHash":"370f0069c53ca628b07503812c5084d7d9308a0bac141190d68535e6efdd3fc0","bodyHash":"0e350d937d15c613811778d1870840ebc3c2dc5f5be85be3d2660fef7305360f"}
 *
 * Go source:
 * func (scanner *Scanner) SetSkipTrivia(skip bool) {
 * 	scanner.skipTrivia = skip
 * }
 */
export declare function Scanner_SetSkipTrivia(receiver: GoPtr<Scanner>, skip: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.HasUnicodeEscape","kind":"method","status":"implemented","sigHash":"d0297f607c7a34e71cddd75bfdd159cf83e15df7a9102cffb9929b030688e62d","bodyHash":"9cd141fca9df4a1b9181caa9147259cd389dccedc23f85109328d2732221fac1"}
 *
 * Go source:
 * func (s *Scanner) HasUnicodeEscape() bool {
 * 	return s.tokenFlags&ast.TokenFlagsUnicodeEscape != 0
 * }
 */
export declare function Scanner_HasUnicodeEscape(receiver: GoPtr<Scanner>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ContainsNonASCII","kind":"method","status":"implemented","sigHash":"b04200be91535e223f441fbc251d17ec7598ef5a6b85d85941c11340aa0a04a7","bodyHash":"1110d61df2722e9c33441156bdc07be89a08f97221c20d71ef96a3084ed07f1d"}
 *
 * Go source:
 * func (s *Scanner) ContainsNonASCII() bool {
 * 	return s.containsNonASCII
 * }
 */
export declare function Scanner_ContainsNonASCII(receiver: GoPtr<Scanner>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.HasExtendedUnicodeEscape","kind":"method","status":"implemented","sigHash":"1cf07172b4f52e545a091ae5604d2011d9d80094c65b4e922cdadbd9594af624","bodyHash":"c5607772d1520784d04019847c8dc39aebbaac7fda2c3b42c5e286fc6f027470"}
 *
 * Go source:
 * func (s *Scanner) HasExtendedUnicodeEscape() bool {
 * 	return s.tokenFlags&ast.TokenFlagsExtendedUnicodeEscape != 0
 * }
 */
export declare function Scanner_HasExtendedUnicodeEscape(receiver: GoPtr<Scanner>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.HasPrecedingLineBreak","kind":"method","status":"implemented","sigHash":"abaee7c2f90d4c1a373960a7e0b044115f98711471a6a7b2917e4ecb5e7fd739","bodyHash":"4b9b2a0b1d51030cf26005d8939f1196bdbf1bdc0fe8c8c8339cd16064c674af"}
 *
 * Go source:
 * func (s *Scanner) HasPrecedingLineBreak() bool {
 * 	return s.tokenFlags&ast.TokenFlagsPrecedingLineBreak != 0
 * }
 */
export declare function Scanner_HasPrecedingLineBreak(receiver: GoPtr<Scanner>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.HasPrecedingJSDocComment","kind":"method","status":"implemented","sigHash":"8babfeec8b6321396b713e2fec6cc96366618056605b9c9fb07aed62dbc8ec29","bodyHash":"e8a1c68420075f88865ef26714e19a5fbca1e090edc46749f4276773bea34c37"}
 *
 * Go source:
 * func (s *Scanner) HasPrecedingJSDocComment() bool {
 * 	return s.tokenFlags&ast.TokenFlagsPrecedingJSDocComment != 0
 * }
 */
export declare function Scanner_HasPrecedingJSDocComment(receiver: GoPtr<Scanner>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.HasPrecedingJSDocLeadingAsterisks","kind":"method","status":"implemented","sigHash":"200f836560264d0279a4a4ff0ddcb9046016f5bdfd25e2741a629bc4ee333f0b","bodyHash":"5ab74eee58e8afda8b930d859e9b7edbdc6c61bf9a512f6b5fb5ecc3ce70eab6"}
 *
 * Go source:
 * func (s *Scanner) HasPrecedingJSDocLeadingAsterisks() bool {
 * 	return s.tokenFlags&ast.TokenFlagsPrecedingJSDocLeadingAsterisks != 0
 * }
 */
export declare function Scanner_HasPrecedingJSDocLeadingAsterisks(receiver: GoPtr<Scanner>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.HasPrecedingJSDocWithDeprecatedTag","kind":"method","status":"implemented","sigHash":"8504cc5c13882cbf020176f1d592d183b851f13711ba3adaa3f159b59fe60b73","bodyHash":"58bd65937d917082008c85281cb6fd7bf2b533f19604bf32aa81ce36f4215ec1"}
 *
 * Go source:
 * func (s *Scanner) HasPrecedingJSDocWithDeprecatedTag() bool {
 * 	return s.tokenFlags&ast.TokenFlagsPrecedingJSDocWithDeprecated != 0
 * }
 */
export declare function Scanner_HasPrecedingJSDocWithDeprecatedTag(receiver: GoPtr<Scanner>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.HasPrecedingJSDocWithSeeOrLink","kind":"method","status":"implemented","sigHash":"c8e9349d53fe928267efa23da778974a7e23ab0e94fd3380be31a84a71281f93","bodyHash":"33cc49ffe1989bd6881708eae1739661a1504408b1d22c2f4480805024b6c936"}
 *
 * Go source:
 * func (s *Scanner) HasPrecedingJSDocWithSeeOrLink() bool {
 * 	return s.tokenFlags&ast.TokenFlagsPrecedingJSDocWithSeeOrLink != 0
 * }
 */
export declare function Scanner_HasPrecedingJSDocWithSeeOrLink(receiver: GoPtr<Scanner>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanJSDocCommentForTags","kind":"method","status":"implemented","sigHash":"6bdaeea7925c4dc0dd4e55cc5c1b1b46e28041eb30226cbdde9795967bb0aecc","bodyHash":"7870ae49e2dc423db3a1be445482732ce20feeaebf8021e8f0ea5a585f6bf827"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Scan the existing UTF-8 byte view by range instead of repeatedly slicing and re-encoding JSDoc comment text; tag detection and TS-Go byte-offset semantics are unchanged."}
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
export declare function Scanner_scanJSDocCommentForTags(receiver: GoPtr<Scanner>, commentText: string): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::hasJSDocTag","kind":"func","status":"implemented","sigHash":"f361aaea4875a620ff76aa9e159099efa0daae87a2b07cf5f788d1bd3193644f","bodyHash":"a50eb36fef5eb098eed434da4e02ef6301ad7e75a778885cfa3a4617b8dd5f8c"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Share the UTF-8 byte-view prefix check used by scanner JSDoc range scanning, avoiding temporary substring views while preserving TS-Go tag-boundary behavior."}
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
export declare function hasJSDocTag(text: string, ...tags: Array<string>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.SetText","kind":"method","status":"implemented","sigHash":"82064155a55a75a9b3e24e3a8f91ca17729da58c43eff21848500a222365a84d","bodyHash":"030d02a7218ce8c7b38b60179e3e24b52733498c775852828ae24d4d467da653"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Pin one UTF-8 byte view per scanner source text so byte-offset scanning does not repeatedly reclassify the same JS/.NET UTF-16 string."}
 *
 * Go source:
 * func (s *Scanner) SetText(text string) {
 * 	s.text = text
 * 	s.end = len(text)
 * 	s.ScannerState = ScannerState{}
 * }
 */
export declare function Scanner_SetText(receiver: GoPtr<Scanner>, text: string): void;
export declare function Scanner_SetTextEnd(receiver: GoPtr<Scanner>, text: string, end: int): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.SetOnError","kind":"method","status":"implemented","sigHash":"33f9cebd2e8da0068aed6e5b299560100d6ad16e9a316af88af10c492035f3c3","bodyHash":"0ec53962dcc084ae4daa010a4f07ce3faaa6f5d542546bddec182cd9da9597d7"}
 *
 * Go source:
 * func (s *Scanner) SetOnError(errorCallback ErrorCallback) {
 * 	s.onError = errorCallback
 * }
 */
export declare function Scanner_SetOnError(receiver: GoPtr<Scanner>, errorCallback: ErrorCallback): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.SetLanguageVariant","kind":"method","status":"implemented","sigHash":"754cd5ac3da7f60d7b89e6022e474772a3d61540c5f6b6f2f2fb7a20a00ef229","bodyHash":"9300bb4c06a2880a461305f873ca65e5cbec838d714267189834b73d7b859cd3"}
 *
 * Go source:
 * func (s *Scanner) SetLanguageVariant(languageVariant core.LanguageVariant) {
 * 	s.languageVariant = languageVariant
 * }
 */
export declare function Scanner_SetLanguageVariant(receiver: GoPtr<Scanner>, languageVariant: LanguageVariant): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.SetScriptTarget","kind":"method","status":"implemented","sigHash":"72a7461df5cd26ebc8f0b90786c550656d17125747f282e042bd954f250f7de6","bodyHash":"aaa721ebf1c0d7f61d5be7f6894547308e66ea674957f1b8b9f9b25604b0573c"}
 *
 * Go source:
 * func (s *Scanner) SetScriptTarget(scriptTarget core.ScriptTarget) {
 * 	s.scriptTarget = scriptTarget
 * }
 */
export declare function Scanner_SetScriptTarget(receiver: GoPtr<Scanner>, scriptTarget: ScriptTarget): void;
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
export declare function Scanner_languageVersion(receiver: GoPtr<Scanner>): ScriptTarget;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.error","kind":"method","status":"implemented","sigHash":"784bcbad7386c574324f7251fe56a241a8431adcf7ca5ea01a5c5d2a53c30009","bodyHash":"43ecff846b340a0f690accf50efb47fbd3444b2cfd054b007bec3cb9ab8a14aa"}
 *
 * Go source:
 * func (s *Scanner) error(diagnostic *diagnostics.Message) {
 * 	s.errorAt(diagnostic, s.pos, 0)
 * }
 */
export declare function Scanner_error(receiver: GoPtr<Scanner>, diagnostic: GoPtr<Message>): void;
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
export declare function Scanner_errorAt(receiver: GoPtr<Scanner>, diagnostic: GoPtr<Message>, pos: int, length: int, ...args: Array<unknown>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.char","kind":"method","status":"implemented","sigHash":"83b9f5c499d55cb42ecff92a9698b5d07b83e98bfc19ce7e8d9464bd49aed11a","bodyHash":"04dd1c9c3c4cc4876bb9b349ade0eb577fc352a2d398cf992b1021424fdbdd3c"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Read from the scanner-local source byte view instead of recomputing a string byte view on every byte access."}
 *
 * Go source:
 * func (s *Scanner) char() rune {
 * 	if s.pos < s.end {
 * 		return rune(s.text[s.pos])
 * 	}
 * 	return -1
 * }
 */
export declare function Scanner_char(receiver: GoPtr<Scanner>): GoRune;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.charAt","kind":"method","status":"implemented","sigHash":"da7fb8267c9d51bb48b7ab642034a5e6b9ba11614d5be412238c0917f439a26f","bodyHash":"8899ba70b7386f7e6861ef2dc2af29fb0f6af0ab77b551e389197d02b078966f"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Read from the scanner-local source byte view instead of recomputing a string byte view on every offset probe."}
 *
 * Go source:
 * func (s *Scanner) charAt(offset int) rune {
 * 	if s.pos+offset < s.end {
 * 		return rune(s.text[s.pos+offset])
 * 	}
 * 	return -1
 * }
 */
export declare function Scanner_charAt(receiver: GoPtr<Scanner>, offset: int): GoRune;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.charAndSize","kind":"method","status":"implemented","sigHash":"8d18d5c2ed40b33c06f101da083e5d47474d596fca8274aeebe218283733a06e","bodyHash":"53999882a6597734c93b240d0823bd51399ff1732381f6aa94eaff838eee7084"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Decode from the scanner-local source byte view while preserving TS-Go byte-offset rune size semantics."}
 *
 * Go source:
 * func (s *Scanner) charAndSize() (rune, int) {
 * 	// Fast path: a single ASCII byte. The vast majority of source bytes are
 * 	// ASCII; handling them here avoids constructing a string slice header and
 * 	// calling the non-inlined utf8.DecodeRuneInString on every byte.
 * 	if s.pos < s.end {
 * 		if b := s.text[s.pos]; b < utf8.RuneSelf {
 * 			return rune(b), 1
 * 		}
 * 	}
 * 	r, size := utf8.DecodeRuneInString(s.text[s.pos:])
 * 	if size > 1 {
 * 		s.containsNonASCII = true
 * 	}
 * 	return r, size
 * }
 */
export declare function Scanner_charAndSize(receiver: GoPtr<Scanner>): [GoRune, int];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanASCIIWhile","kind":"method","status":"implemented","sigHash":"43b4e929d6def6f9ba2bd93f8ceb888db4e5dffbbc6a805e447a79074d942f12","bodyHash":"b98fd457d9e43cde7e81a876f1b69058c8e0c77a94321c20ef8a6df042cc8c3e"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Scan directly over the scanner-local source byte view instead of materializing Go-style string slices; byte advancement remains TS-Go exact."}
 *
 * Go source:
 * // scanASCIIWhile advances s.pos over the longest run of ASCII bytes for which
 * // pred returns true. It stops at end-of-text, the first non-ASCII byte, or the
 * // first byte where pred is false.
 * func (s *Scanner) scanASCIIWhile(pred func(byte) bool) {
 * 	text := s.text[s.pos:s.end]
 * 	i := 0
 * 	for i < len(text) {
 * 		b := text[i]
 * 		if b >= utf8.RuneSelf || !pred(b) {
 * 			break
 * 		}
 * 		i++
 * 	}
 * 	s.pos += i
 * }
 */
export declare function Scanner_scanASCIIWhile(receiver: GoPtr<Scanner>, pred: (b: byte) => bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.Scan","kind":"method","status":"implemented","sigHash":"4b2d16399efbd4afd7ee8c9b9dfeec6408ed7100a1a83bcded650f8c210392b0","bodyHash":"3310d5907b0bb6c2ef92faecb27f889f73ca4449ae4e85910506c86198763186"}
 *
 * Go source:
 * func (s *Scanner) Scan() ast.Kind {
 * 	s.fullStartPos = s.pos
 * 	s.tokenFlags = ast.TokenFlagsNone
 * 	for {
 * 		ch := s.char()
 * 		s.tokenStart = s.pos
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
 * 				s.scanASCIIWhile(func(b byte) bool {
 * 					return b == ' ' || (b >= '\t' && b <= '\r')
 * 				})
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
 * 			next := s.charAt(1)
 * 			if next == '&' {
 * 				if s.charAt(2) == '=' {
 * 					s.pos += 3
 * 					s.token = ast.KindAmpersandAmpersandEqualsToken
 * 				} else {
 * 					s.pos += 2
 * 					s.token = ast.KindAmpersandAmpersandToken
 * 				}
 * 			} else if next == '=' {
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
 * 			next := s.charAt(1)
 * 			if next == '=' {
 * 				s.pos += 2
 * 				s.token = ast.KindAsteriskEqualsToken
 * 			} else if next == '*' {
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
 * 			next := s.charAt(1)
 * 			if next == '=' {
 * 				s.pos += 2
 * 				s.token = ast.KindPlusEqualsToken
 * 			} else if next == '+' {
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
 * 			next := s.charAt(1)
 * 			if next == '=' {
 * 				s.pos += 2
 * 				s.token = ast.KindMinusEqualsToken
 * 			} else if next == '-' {
 * 				s.pos += 2
 * 				s.token = ast.KindMinusMinusToken
 * 			} else {
 * 				s.pos++
 * 				s.token = ast.KindMinusToken
 * 			}
 * 		case '.':
 * 			next := s.charAt(1)
 * 			if stringutil.IsDigit(next) {
 * 				s.token = s.scanNumber()
 * 			} else if next == '.' && s.charAt(2) == '.' {
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
 * 					s.scanASCIIWhile(func(b byte) bool {
 * 						return b != '\n' && b != '\r'
 * 					})
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
 * 					s.scanASCIIWhile(func(b byte) bool {
 * 						return b != '*' && b != '\n' && b != '\r'
 * 					})
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
 * 			if s.charAt(1) == '<' && isConflictMarkerTrivia(s.text, s.pos) {
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
 * 			if s.charAt(1) == '=' && isConflictMarkerTrivia(s.text, s.pos) {
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
 * 			if s.charAt(1) == '>' && isConflictMarkerTrivia(s.text, s.pos) {
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
 * 			if s.charAt(1) == '|' && isConflictMarkerTrivia(s.text, s.pos) {
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
export declare function Scanner_Scan(receiver: GoPtr<Scanner>): Kind;
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
export declare function Scanner_processCommentDirective(receiver: GoPtr<Scanner>, start: int, end: int, multiline: bool): void;
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
export declare function Scanner_ReScanLessThanToken(receiver: GoPtr<Scanner>): Kind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ReScanGreaterThanToken","kind":"method","status":"implemented","sigHash":"e452c833a215e1071dd6e67ed4d5d6e080aa43f1e384e4f804f3b55dcf712c63","bodyHash":"d103f60b7c6a59146fcfdd513cb65b1ada6ef5f9a94163dda0b3cf3f47c3b1e4"}
 *
 * Go source:
 * func (s *Scanner) ReScanGreaterThanToken() ast.Kind {
 * 	if s.token == ast.KindGreaterThanToken {
 * 		s.reScanGreaterThanTokenInner()
 * 	}
 * 	return s.token
 * }
 */
export declare function Scanner_ReScanGreaterThanToken(receiver: GoPtr<Scanner>): Kind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.reScanGreaterThanTokenInner","kind":"method","status":"implemented","sigHash":"83fdb65bf3205c4b65e3ba8d5a6d39937fd378d6db8b228392c45d6914b4ec8b","bodyHash":"0e4311dcb2931d8e0f3722e86b5340855665e00e2bc63042f1303d1bab7098b5"}
 *
 * Go source:
 * func (s *Scanner) reScanGreaterThanTokenInner() {
 * 	s.pos = s.tokenStart + 1
 * 	if s.char() == '>' {
 * 		if s.charAt(1) == '>' {
 * 			if s.charAt(2) == '=' {
 * 				s.pos += 3
 * 				s.token = ast.KindGreaterThanGreaterThanGreaterThanEqualsToken
 * 			} else {
 * 				s.pos += 2
 * 				s.token = ast.KindGreaterThanGreaterThanGreaterThanToken
 * 			}
 * 		} else if s.charAt(1) == '=' {
 * 			s.pos += 2
 * 			s.token = ast.KindGreaterThanGreaterThanEqualsToken
 * 		} else {
 * 			s.pos++
 * 			s.token = ast.KindGreaterThanGreaterThanToken
 * 		}
 * 	} else if s.char() == '=' {
 * 		s.pos++
 * 		s.token = ast.KindGreaterThanEqualsToken
 * 	}
 * }
 */
export declare function Scanner_reScanGreaterThanTokenInner(receiver: GoPtr<Scanner>): void;
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
export declare function Scanner_ReScanTemplateToken(receiver: GoPtr<Scanner>, isTaggedTemplate: bool): Kind;
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
export declare function Scanner_ReScanAsteriskEqualsToken(receiver: GoPtr<Scanner>): Kind;
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
export declare function Scanner_ReScanSlashToken(receiver: GoPtr<Scanner>, ...reportErrors: Array<bool>): Kind;
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
export declare function Scanner_ReScanJsxToken(receiver: GoPtr<Scanner>, allowMultilineJsxText: bool): Kind;
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
export declare function Scanner_ReScanHashToken(receiver: GoPtr<Scanner>): Kind;
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
export declare function Scanner_ReScanQuestionToken(receiver: GoPtr<Scanner>): Kind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.ScanJsxToken","kind":"method","status":"implemented","sigHash":"cb0adce9446e1ee158b3c22735a4ff3ccd6f92d9ca657debfb6514a277d766fb","bodyHash":"977508030592620fb4d65f84afcfaaa3865cbc0813531c2990eca4a11ee1e050"}
 *
 * Go source:
 * func (s *Scanner) ScanJsxToken() ast.Kind {
 * 	return s.ScanJsxTokenEx(true /*allowMultilineJsxText* /)
 * }
 */
export declare function Scanner_ScanJsxToken(receiver: GoPtr<Scanner>): Kind;
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
export declare function Scanner_ScanJsxTokenEx(receiver: GoPtr<Scanner>, allowMultilineJsxText: bool): Kind;
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
export declare function Scanner_ScanJsxIdentifier(receiver: GoPtr<Scanner>): Kind;
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
export declare function Scanner_ScanJsxAttributeValue(receiver: GoPtr<Scanner>): Kind;
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
export declare function Scanner_ReScanJsxAttributeValue(receiver: GoPtr<Scanner>): Kind;
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
export declare function Scanner_ScanJSDocCommentTextToken(receiver: GoPtr<Scanner>, inBackticks: bool): Kind;
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
export declare function Scanner_CanFollowJSDocAt(receiver: GoPtr<Scanner>): bool;
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
export declare function Scanner_ScanJSDocToken(receiver: GoPtr<Scanner>): Kind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanIdentifier","kind":"method","status":"implemented","sigHash":"8d0b6ebcb4ea537e635fa8157441f3c091dc975721578bcc8957a7d672b26a75","bodyHash":"f12c4d9842d62c237d4883ecea3e245508588b1c84863882c896100aa3061341"}
 *
 * Go source:
 * func (s *Scanner) scanIdentifier(prefixLength int) bool {
 * 	start := s.pos
 * 	s.pos += prefixLength
 * 	ch := s.char()
 * 	// Fast path for simple ASCII identifiers
 * 	if stringutil.IsASCIILetter(ch) || ch == '_' || ch == '$' {
 * 		s.pos++
 * 		s.scanASCIIWhile(func(b byte) bool {
 * 			return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9') || b == '_' || b == '$'
 * 		})
 * 		ch = s.char()
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
export declare function Scanner_scanIdentifier(receiver: GoPtr<Scanner>, prefixLength: int): bool;
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
export declare function Scanner_scanIdentifierParts(receiver: GoPtr<Scanner>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanString","kind":"method","status":"implemented","sigHash":"4bd87ff6951a51fbdfe3e56c4f24684dec346fba5ba02c9830f4be9c6ba11379","bodyHash":"bb449bb53dae2ba8d795d9e8e7189db93174c6e4dec732213aa8d523afef69af"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Scan the simple-string fast path over the scanner byte view before materializing token text; Go string slices are O(1), but JS/.NET text slices allocate."}
 *
 * Go source:
 * func (s *Scanner) scanString(jsxAttributeString bool) string {
 * 	quote := s.char()
 * 	if quote == '\'' {
 * 		s.tokenFlags |= ast.TokenFlagsSingleQuote
 * 	}
 * 	s.pos++
 * 	// Fast path for simple strings without escape sequences.
 * 	strLen := strings.IndexByte(s.text[s.pos:], byte(quote))
 * 	if strLen == 0 {
 * 		s.pos++
 * 		return ""
 * 	}
 * 	if strLen > 0 {
 * 		str := s.text[s.pos : s.pos+strLen]
 * 		if jsxAttributeString ||
 * 			strings.IndexByte(str, '\\') < 0 && strings.IndexByte(str, '\r') < 0 && strings.IndexByte(str, '\n') < 0 {
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
export declare function Scanner_scanString(receiver: GoPtr<Scanner>, jsxAttributeString: bool): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanTemplateAndSetTokenValue","kind":"method","status":"implemented","sigHash":"cdb72c37603e1f52d47695665dc1968c946dc859b904297162a536d5ddaede2e","bodyHash":"62f48bfa5164a51de3d0cd7e724084d49342619564ded3af874aba58d63e52a1"}
 *
 * Go source:
 * func (s *Scanner) scanTemplateAndSetTokenValue(shouldEmitInvalidEscapeError bool) ast.Kind {
 * 	startedWithBacktick := s.char() == '`'
 * 	s.pos++
 * 	start := s.pos
 * 	parts := make([]string, 0, 4)
 * 	var token ast.Kind
 * 	for {
 * 		s.scanASCIIWhile(func(b byte) bool {
 * 			return b != '`' && b != '$' && b != '\\' && b != '\r'
 * 		})
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
export declare function Scanner_scanTemplateAndSetTokenValue(receiver: GoPtr<Scanner>, shouldEmitInvalidEscapeError: bool): Kind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanEscapeSequence","kind":"method","status":"implemented","sigHash":"ee4e8e838a412353a31302b798a09ce4608c22fbd9cf5e6cbad8cb37cac4df06","bodyHash":"2ccbc32f98cb965c5cdc6211ee737c03a0023357b7748131c63e8269d97ccab1"}
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
 * 			// In string literals, a high surrogate \u{...} followed by a low
 * 			// surrogate escape forms a single code point, exactly as adjacent
 * 			// UTF-16 code units would in a JavaScript string.
 * 			if flags&EscapeSequenceScanningFlagsRegularExpression == 0 && stringutil.IsHighSurrogate(codePoint) {
 * 				if combined, ok := s.scanLowSurrogateEscape(codePoint); ok {
 * 					return string(combined)
 * 				}
 * 			}
 * 			return stringutil.EncodeJSStringRune(codePoint)
 * 		}
 * 		if codePoint < 0 {
 * 			return s.text[start:s.pos]
 * 		} else if stringutil.IsHighSurrogate(codePoint) {
 * 			if flags&EscapeSequenceScanningFlagsRegularExpression == 0 {
 * 				// Combine \uHigh followed by any low surrogate escape (\uLow or
 * 				// \u{Low}) into a single code point in string literals, matching
 * 				// how adjacent UTF-16 code units pair in a JavaScript string.
 * 				if combined, ok := s.scanLowSurrogateEscape(codePoint); ok {
 * 					return string(combined)
 * 				}
 * 			} else if flags&EscapeSequenceScanningFlagsAnyUnicodeMode != 0 &&
 * 				s.char() == '\\' && s.charAt(1) == 'u' && s.charAt(2) != '{' {
 * 				// In regex AnyUnicodeMode, combine \uHigh\uLow so scanClassRanges
 * 				// can compare the pair numerically. In non-unicode regex mode they
 * 				// are separate atoms, and extended \u{...} escapes never combine.
 * 				savedPos := s.pos
 * 				nextCodePoint := s.scanUnicodeEscape(flags&EscapeSequenceScanningFlagsReportInvalidEscapeErrors != 0)
 * 				if stringutil.IsLowSurrogate(nextCodePoint) {
 * 					return string(stringutil.SurrogatePairToCodePoint(codePoint, nextCodePoint))
 * 				}
 * 				s.pos = savedPos
 * 			}
 * 		}
 * 		// Lone surrogate: encode as CESU-8 so it survives losslessly. In a
 * 		// non-unicode regex this also lets scanClassRanges compare it numerically.
 * 		return stringutil.EncodeJSStringRune(codePoint)
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
 * 		return ""
 * 	default:
 * 		// ch was read as a single byte; for multi-byte UTF-8 characters,
 * 		// we need to decode the full rune and advance past all its bytes.
 * 		if ch >= utf8.RuneSelf {
 * 			s.pos-- // back up past the single-byte advance
 * 			var size int
 * 			ch, size = utf8.DecodeRuneInString(s.text[s.pos:])
 * 			s.pos += size
 * 			s.containsNonASCII = true
 * 		}
 * 		// LineContinuation: a backslash followed by a line terminator is "the empty code unit sequence".
 * 		if ch == '
' || ch == '
' {
 * 			return ""
 * 		}
 * 		if flags&EscapeSequenceScanningFlagsAnyUnicodeMode != 0 || flags&EscapeSequenceScanningFlagsRegularExpression != 0 && flags&EscapeSequenceScanningFlagsAnnexB == 0 && IsIdentifierPart(ch) {
 * 			s.errorAt(diagnostics.This_character_cannot_be_escaped_in_a_regular_expression, start, s.pos-start)
 * 		}
 * 		return string(ch)
 * 	}
 * }
 */
export declare function Scanner_scanEscapeSequence(receiver: GoPtr<Scanner>, flags: EscapeSequenceScanningFlags): string;
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
export declare function Scanner_scanUnicodeEscape(receiver: GoPtr<Scanner>, shouldEmitInvalidEscapeError: bool): GoRune;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanLowSurrogateEscape","kind":"method","status":"implemented","sigHash":"1cc0ef6e3a6fda2e3c88bbe9114b88806bc07575d62f0b08ff659e3e4420aaac","bodyHash":"0005d0e7cc211fda4de147fc36afd044b608695c776466939ab77a00c334b01e"}
 *
 * Go source:
 * // scanLowSurrogateEscape attempts to consume a low-surrogate Unicode escape
 * // (either '\uLow' or '\u{Low}') immediately following an already-scanned high
 * // surrogate and combine them into a single supplementary code point. This
 * // mirrors how adjacent UTF-16 code units form a surrogate pair in a JavaScript
 * // string, regardless of which escape syntax produced each half. On success it
 * // returns the combined code point and true; otherwise it restores the scanner
 * // position and returns false.
 * func (s *Scanner) scanLowSurrogateEscape(high rune) (rune, bool) {
 * 	if s.char() != '\\' || s.charAt(1) != 'u' {
 * 		return 0, false
 * 	}
 * 	savedPos := s.pos
 * 	savedTokenFlags := s.tokenFlags
 * 	// Speculatively scan the escape with diagnostics suppressed: if it isn't a
 * 	// low surrogate we rewind below, and the caller re-scans the same escape and
 * 	// reports any error then, so reporting here would duplicate diagnostics.
 * 	low := s.scanUnicodeEscape(false)
 * 	if stringutil.IsLowSurrogate(low) {
 * 		return stringutil.SurrogatePairToCodePoint(high, low), true
 * 	}
 * 	s.pos = savedPos
 * 	s.tokenFlags = savedTokenFlags
 * 	return 0, false
 * }
 */
export declare function Scanner_scanLowSurrogateEscape(receiver: GoPtr<Scanner>, high: GoRune): [GoRune, bool];
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
export declare function Scanner_peekUnicodeEscape(receiver: GoPtr<Scanner>): GoRune;
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
export declare function Scanner_scanNumber(receiver: GoPtr<Scanner>): Kind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::method::Scanner.scanNumberFragment","kind":"method","status":"implemented","sigHash":"107eac2d2e9ee776e96ea451d6cfc0c5ece86f77f0bb651ff35be1e39a2a99ed","bodyHash":"87edd40884f034481fed14d577944801df0fff461a2abab496bac20045fe0376"}
 *
 * Go source:
 * func (s *Scanner) scanNumberFragment() string {
 * 	start := s.pos
 * 	allowSeparator := false
 * 	isPreviousTokenSeparator := false
 * 	var result strings.Builder
 * 	for {
 * 		before := s.pos
 * 		s.scanASCIIWhile(func(b byte) bool {
 * 			return b >= '0' && b <= '9'
 * 		})
 * 		if s.pos > before {
 * 			allowSeparator = true
 * 			isPreviousTokenSeparator = false
 * 		}
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
 * 		break
 * 	}
 * 	if isPreviousTokenSeparator {
 * 		s.tokenFlags |= ast.TokenFlagsContainsInvalidSeparator
 * 		s.errorAt(diagnostics.Numeric_separators_are_not_allowed_here, s.pos-1, 1)
 * 	}
 * 	if result.Len() == 0 {
 * 		return s.text[start:s.pos]
 * 	}
 * 	result.WriteString(s.text[start:s.pos])
 * 	return result.String()
 * }
 */
export declare function Scanner_scanNumberFragment(receiver: GoPtr<Scanner>): string;
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
export declare function Scanner_scanDigits(receiver: GoPtr<Scanner>): [string, bool];
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
export declare function Scanner_scanHexDigits(receiver: GoPtr<Scanner>, minCount: int, scanAsManyAsPossible: bool, canHaveSeparators: bool): string;
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
export declare function Scanner_scanBinaryOrOctalDigits(receiver: GoPtr<Scanner>, base: int): string;
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
export declare function Scanner_scanBigIntSuffix(receiver: GoPtr<Scanner>): Kind;
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
export declare function Scanner_scanInvalidCharacter(receiver: GoPtr<Scanner>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetIdentifierToken","kind":"func","status":"implemented","sigHash":"a5e7f979cfd8a669e6b4be3494c2953ad7fbec7fd2e111b3f38f2ee61f5282c7","bodyHash":"dc7293fe327a8e8093c2e5907803c5adb9f824f233ad6b49fc63e45e6ef5d0b6"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Keyword spellings are ASCII-only, so JS/.NET UTF-16 length and first code unit are sufficient to decide whether a textToKeyword probe can succeed; non-ASCII identifiers cannot equal a keyword and do not need UTF-8 byte-view materialization."}
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
export declare function GetIdentifierToken(str: string): Kind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::IsValidIdentifier","kind":"func","status":"implemented","sigHash":"6f2f2e0fa3f0726fd3acac525f61e6739551580772c0110f3bd049ad7184f931","bodyHash":"1f4836c7935e22c71a33ca860a69db1ea8df3d4edde0f6f1d0c30e22989fdee7"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Decode identifier text by byte offset over one UTF-8 byte view; Go's s[i:] slice is O(1), but JS substring/decode would allocate each iteration."}
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
export declare function IsValidIdentifier(s: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::isWordCharacter","kind":"func","status":"implemented","sigHash":"a654575bb78b2151379e65a1996036e6071b2d19af09613b101e52e9673f9c66","bodyHash":"e457db9e8c427e744c523582f2d654aaf938dbd5c56c3ffc9de48e4b85c5f50e"}
 *
 * Go source:
 * func isWordCharacter(ch rune) bool {
 * 	return stringutil.IsASCIILetter(ch) || stringutil.IsDigit(ch) || ch == '_'
 * }
 */
export declare function isWordCharacter(ch: GoRune): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::IsIdentifierStart","kind":"func","status":"implemented","sigHash":"8b0307f4d91cd33861040bbfc48694a01347ba78919e2991be6d068aec5dccbe","bodyHash":"5b5021d10d577795d4dc138041b2d15e3f733761c824d43edf887426082048f8"}
 *
 * Go source:
 * func IsIdentifierStart(ch rune) bool {
 * 	return stringutil.IsASCIILetter(ch) || ch == '_' || ch == '$' || ch >= utf8.RuneSelf && stringutil.IsUnicodeIdentifierStart(ch)
 * }
 */
export declare function IsIdentifierStart(ch: GoRune): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::IsIdentifierPart","kind":"func","status":"implemented","sigHash":"cea9d76e44b84d6f31e6a1068929975367984f606075f3fa68621c45548ec513","bodyHash":"aad3ed98a58a301217522a5d19d89f94d9b1b6175439dbea905d355895116d10"}
 *
 * Go source:
 * func IsIdentifierPart(ch rune) bool {
 * 	return IsIdentifierPartEx(ch, core.LanguageVariantStandard)
 * }
 */
export declare function IsIdentifierPart(ch: GoRune): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::IsIdentifierPartEx","kind":"func","status":"implemented","sigHash":"fe71015c9adb72b3bb73c5f06c60928a8091d9c42fd9756c58f8521c8354da5a","bodyHash":"eace31691b6c6e12063796c0021f59dbd74f65116e27112ab506b93a1ad922d3"}
 *
 * Go source:
 * func IsIdentifierPartEx(ch rune, languageVariant core.LanguageVariant) bool {
 * 	return isWordCharacter(ch) || ch == '$' ||
 * 		ch >= utf8.RuneSelf && stringutil.IsUnicodeIdentifierPart(ch) ||
 * 		languageVariant == core.LanguageVariantJSX && (ch == '-' || ch == ':') // "-" and ":" are valid in JSX Identifiers
 * }
 */
export declare function IsIdentifierPartEx(ch: GoRune, languageVariant: LanguageVariant): bool;
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
export declare const tokenToText: GoArray<string, "ast.KindCount">;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::TokenToString","kind":"func","status":"implemented","sigHash":"20e1dd05f8e7d661bc30b7bc2c31b7f60320e11ca0802d131982fbd836fedd0c","bodyHash":"52506d4929d1e6f06f0153607170bf52a154bf0c78525acb62e62f1b84b64079"}
 *
 * Go source:
 * func TokenToString(token ast.Kind) string {
 * 	return tokenToText[token]
 * }
 */
export declare function TokenToString(token: Kind): string;
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
export declare function StringToToken(s: string): Kind;
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
export declare function GetViableKeywordSuggestions(): GoSlice<string>;
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
export declare function couldStartTrivia(text: string, pos: int): bool;
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
export declare function SkipTrivia(text: string, pos: int): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::SkipTriviaEx","kind":"func","status":"implemented","sigHash":"f42acfbbaab25a2aa14a08e991389f62a5072c61df54c5805c5d6b51e941080e","bodyHash":"264f0ba89784e8af4179e796b7094804838591eb6ee18f155ed929dacf112ada"}
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
 * 		if pos >= textLen {
 * 			return pos
 * 		}
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
export declare function SkipTriviaEx(text: string, pos: int, options: GoPtr<SkipTriviaOptions>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::varGroup::mergeConflictMarkerLength+maxAsciiCharacter","kind":"varGroup","status":"implemented","sigHash":"596b779c4bc35b59555559243640f5e7a78883f0513cbae3302e688bc6cdf3f6","bodyHash":"106ca23fde3a90a8e95f79369042b88d1ce5a7cf294d673355f01f7acf6a30e6"}
 *
 * Go source:
 * var (
 * 	mergeConflictMarkerLength      = len("<<<<<<<")
 * 	maxAsciiCharacter         byte = 127
 * )
 */
export declare const mergeConflictMarkerLength: int;
export declare const maxAsciiCharacter: byte;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::isConflictMarkerTrivia","kind":"func","status":"implemented","sigHash":"9ea6f9f957b7886eeeb5b9323e900e44d6ace7d03a8b8a1b27df3442b47addc4","bodyHash":"8d05e9232b29f7976a75551535369a390faa47616116f73064629084f3a2ae3e"}
 *
 * Go source:
 * func isConflictMarkerTrivia(text string, pos int) bool {
 * 	if pos < 0 {
 * 		panic("pos < 0")
 * 	}
 *
 * 	// Fast reject: a conflict marker is the same byte repeated seven times. If the
 * 	// second byte differs (the overwhelmingly common case for `<`, `>`, `=`, `|`
 * 	// tokens), it cannot be a marker, so skip the line-start check entirely.
 * 	if pos+1 >= len(text) || text[pos+1] != text[pos] {
 * 		return false
 * 	}
 *
 * 	// Conflict markers must be at the start of a line.
 * 	atLineStart := pos == 0 || stringutil.IsLineBreak(rune(text[pos-1]))
 * 	if !atLineStart && pos >= 2 {
 * 		prev, _ := utf8.DecodeLastRuneInString(text[:pos-2])
 * 		atLineStart = stringutil.IsLineBreak(prev)
 * 	}
 * 	if atLineStart {
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
export declare function isConflictMarkerTrivia(text: string, pos: int): bool;
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
export declare function scanConflictMarkerTrivia(text: string, pos: int, reportError: ((diag: GoPtr<Message>, pos: int, length: int, ...args: Array<unknown>) => void) | undefined): int;
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
export declare function isShebangTrivia(text: string, pos: int): bool;
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
export declare function scanShebangTrivia(text: string, pos: int): int;
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
export declare function GetShebang(text: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetScannerForSourceFile","kind":"func","status":"implemented","sigHash":"720bc4aa046156e241c1cc279919d890b8d4aab6a56c0fd5ec1af0aa9b3b8865","bodyHash":"79c2d6bc1c53a79f5b5e9f483ec10e0c80925451b7647df913bf3740b36200dd"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Route source-file scanner initialization through SetText so the scanner-local source byte-view cache is refreshed with the new text."}
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
export declare function GetScannerForSourceFile(sourceFile: GoPtr<SourceFile>, pos: int): GoPtr<Scanner>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::ScanTokenAtPosition","kind":"func","status":"implemented","sigHash":"82ccdc5191586c5ff3bb3565403b3e6a80285e94fd4c2bba2eeca7f22893777b","bodyHash":"f6658dac6f33b211b2aa210418c83d4389a503692d4e52f8141ae92db047817e"}
 *
 * Go source:
 * func ScanTokenAtPosition(sourceFile *ast.SourceFile, pos int) ast.Kind {
 * 	s := GetScannerForSourceFile(sourceFile, pos)
 * 	return s.token
 * }
 */
export declare function ScanTokenAtPosition(sourceFile: GoPtr<SourceFile>, pos: int): Kind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetRangeOfTokenAtPosition","kind":"func","status":"implemented","sigHash":"fee4ce249dbcf24159eca90bfad4e9f7d734e179a86d55d4dd332444d36166de","bodyHash":"66dc75483bc7287529bb85f6dde614d20cc57dda7b27db195444d12cfcdfa6a0"}
 *
 * Go source:
 * func GetRangeOfTokenAtPosition(sourceFile *ast.SourceFile, pos int) core.TextRange {
 * 	s := GetScannerForSourceFile(sourceFile, pos)
 * 	return core.NewTextRange(s.tokenStart, s.pos)
 * }
 */
export declare function GetRangeOfTokenAtPosition(sourceFile: GoPtr<SourceFile>, pos: int): TextRange;
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
export declare function GetTokenPosOfNode(node: GoPtr<Node>, sourceFile: GoPtr<SourceFile>, includeJSDoc: bool): int;
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
export declare function getErrorRangeForArrowFunction(sourceFile: GoPtr<SourceFile>, node: GoPtr<Node>): TextRange;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::findOriginatingJSDocSatisfiesTag","kind":"func","status":"implemented","sigHash":"cb7d7bf439f1a032ef71624184dc920359f82a46e1b6df8d58a6c02c1159a8fd","bodyHash":"3411ad91775919a51e6e33233327d4794b8e65f625db168c8de4ffe526eeec47"}
 *
 * Go source:
 * func findOriginatingJSDocSatisfiesTag(sourceFile *ast.SourceFile, node *ast.Node) *ast.Node {
 * 	targetType := node.AsSatisfiesExpression().Type
 * 	if targetType.Flags&ast.NodeFlagsReparsed == 0 {
 * 		return nil
 * 	}
 * 	for current := node.Parent; current != nil; current = current.Parent {
 * 		if current.Flags&ast.NodeFlagsHasJSDoc == 0 {
 * 			continue
 * 		}
 * 		var firstSatisfiesTag *ast.Node
 * 		for _, jsDoc := range current.EagerJSDoc(sourceFile) {
 * 			if tags := jsDoc.AsJSDoc().Tags; tags != nil {
 * 				for _, tag := range tags.Nodes {
 * 					if !ast.IsJSDocSatisfiesTag(tag) {
 * 						continue
 * 					}
 * 					if firstSatisfiesTag == nil {
 * 						firstSatisfiesTag = tag
 * 					}
 * 					if typeExpr := tag.AsJSDocSatisfiesTag().TypeExpression; typeExpr != nil {
 * 						if t := typeExpr.Type(); t != nil && t.Loc == targetType.Loc {
 * 							return tag
 * 						}
 * 					}
 * 				}
 * 			}
 * 		}
 * 		return firstSatisfiesTag
 * 	}
 * 	return nil
 * }
 */
export declare function findOriginatingJSDocSatisfiesTag(sourceFile: GoPtr<SourceFile>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetErrorRangeForNode","kind":"func","status":"implemented","sigHash":"2c7127c8ae87742dba321bd9edcb696827cf7e18cf6b86504269b47f981d0b8f","bodyHash":"fcafd548fdbaf5609f0e3b840e8df366db40b15113be48581aa4fbbe9cf15763"}
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
 * 	case ast.KindVariableDeclaration, ast.KindBindingElement, ast.KindClassDeclaration, ast.KindInterfaceDeclaration,
 * 		ast.KindModuleDeclaration, ast.KindEnumDeclaration, ast.KindEnumMember, ast.KindFunctionExpression,
 * 		ast.KindGetAccessor, ast.KindSetAccessor, ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration, ast.KindPropertyDeclaration,
 * 		ast.KindPropertySignature, ast.KindNamespaceImport:
 * 		errorNode = ast.GetNameOfDeclaration(node)
 * 	case ast.KindClassExpression:
 * 		errorNode = node.Name()
 *
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
 * 		if jsDocSatisfiesTag := findOriginatingJSDocSatisfiesTag(sourceFile, node); jsDocSatisfiesTag != nil {
 * 			pos := SkipTrivia(sourceFile.Text(), jsDocSatisfiesTag.TagName().Pos())
 * 			return GetRangeOfTokenAtPosition(sourceFile, pos)
 * 		}
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
export declare function GetErrorRangeForNode(sourceFile: GoPtr<SourceFile>, node: GoPtr<Node>): TextRange;
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
export declare function ComputeLineOfPosition(lineStarts: GoSlice<TextPos>, pos: int): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetECMALineStarts","kind":"func","status":"implemented","sigHash":"ed4ce1b156e7490182553431e03280dc4a9e7948b41e879866d7454a65588567","bodyHash":"27d07300345f770e0006749b31460320dc91ef8271a0dba726abcc19d73b7cd0"}
 *
 * Go source:
 * func GetECMALineStarts(sourceFile ast.SourceFileLike) []core.TextPos {
 * 	return sourceFile.ECMALineMap()
 * }
 */
export declare function GetECMALineStarts(sourceFile: SourceFileLike): GoSlice<TextPos>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetECMALineOfPosition","kind":"func","status":"implemented","sigHash":"d32a3b05d4d0452e2e07144c3f04c3be049398a4866fefb9db3f221359cd21c4","bodyHash":"eb81450ca1ea59c13e4f9ed5ab4f277828e40aa2a05d5f92f30f0cffd555fc93"}
 *
 * Go source:
 * func GetECMALineOfPosition(sourceFile ast.SourceFileLike, pos int) int {
 * 	lineMap := GetECMALineStarts(sourceFile)
 * 	return ComputeLineOfPosition(lineMap, pos)
 * }
 */
export declare function GetECMALineOfPosition(sourceFile: SourceFileLike, pos: int): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetECMALineAndUTF16CharacterOfPosition","kind":"func","status":"implemented","sigHash":"3053c689ece6d87b64937f35b03ebebae053b2951b4d2af6800fa0daf5c7dead","bodyHash":"b473bc8093a3b6dc2f0ce2e3e5a9180336e485fc25ba5f5b9167002d895587dd"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Compute UTF-16 length for a byte range over the source byte view instead of allocating sourceFile.Text()[lineStart:pos]."}
 *
 * Go source:
 * func GetECMALineAndUTF16CharacterOfPosition(sourceFile ast.SourceFileLike, pos int) (line int, character core.UTF16Offset) {
 * 	lineMap := GetECMALineStarts(sourceFile)
 * 	line = ComputeLineOfPosition(lineMap, pos)
 * 	character = core.UTF16Len(sourceFile.Text()[lineMap[line]:pos])
 * 	return line, character
 * }
 */
export declare function GetECMALineAndUTF16CharacterOfPosition(sourceFile: SourceFileLike, pos: int): [int, UTF16Offset];
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
export declare function GetECMALineAndByteOffsetOfPosition(sourceFile: SourceFileLike, pos: int): [int, int];
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
export declare function GetECMAEndLinePosition(sourceFile: GoPtr<SourceFile>, line: int): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetECMAPositionOfLineAndUTF16Character","kind":"func","status":"implemented","sigHash":"9c46ed1e97225af0e454c95cf844604ae34723ba8140f37c87281bd6b9bb2cf3","bodyHash":"12c608b1d33dac1b9c65145f6a73c5f50535294d4c5d82013bedefe8cf2b3ab6"}
 *
 * Go source:
 * func GetECMAPositionOfLineAndUTF16Character(sourceFile ast.SourceFileLike, line int, character core.UTF16Offset) int {
 * 	lineStarts := GetECMALineStarts(sourceFile)
 * 	return ComputePositionOfLineAndUTF16Character(lineStarts, line, character, sourceFile.Text(), false)
 * }
 */
export declare function GetECMAPositionOfLineAndUTF16Character(sourceFile: SourceFileLike, line: int, character: UTF16Offset): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetECMAPositionOfLineAndByteOffset","kind":"func","status":"implemented","sigHash":"8423e812ccd80b66f50668ad4d5b4480b0c2313e978c547282ad4e68ae4ee9ab","bodyHash":"09b5eb4fcc89560d57f20eca44f493c91a0b4e59612bacc1c7dc02440fe262b5"}
 *
 * Go source:
 * func GetECMAPositionOfLineAndByteOffset(sourceFile ast.SourceFileLike, line int, byteOffset int) int {
 * 	return ComputePositionOfLineAndByteOffset(GetECMALineStarts(sourceFile), line, byteOffset)
 * }
 */
export declare function GetECMAPositionOfLineAndByteOffset(sourceFile: SourceFileLike, line: int, byteOffset: int): int;
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
export declare function ComputePositionOfLineAndByteOffset(lineStarts: GoSlice<TextPos>, line: int, byteOffset: int): int;
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
export declare function ComputePositionOfLineAndUTF16Character(lineStarts: GoSlice<TextPos>, line: int, character: UTF16Offset, text: string, allowEdits: bool): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetLeadingCommentRanges","kind":"func","status":"implemented","sigHash":"4117676ed75986086d2dd9450cd26fe8d9a9eecdbdbd80583e2bc89d7e5e39c0","bodyHash":"be8a468f55a9af19e50b8aff0cf4e089e90be2f851830bd8b0f2556e07a705aa"}
 *
 * Go source:
 * func GetLeadingCommentRanges(f *ast.NodeFactory, text string, pos int) iter.Seq[ast.CommentRange] {
 * 	return iterateCommentRanges(f, text, pos, false)
 * }
 */
export declare function GetLeadingCommentRanges(f: GoPtr<NodeFactory>, text: string, pos: int): GoSeq<CommentRange>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::GetTrailingCommentRanges","kind":"func","status":"implemented","sigHash":"2c082fe2bb6a864d99ada3c874fa0f5549a00c5ef6be9741275ec867204c28c7","bodyHash":"954192d0ab9acd599d22664b82a7d003a936f1ea7975b35faa2a73473c5fde32"}
 *
 * Go source:
 * func GetTrailingCommentRanges(f *ast.NodeFactory, text string, pos int) iter.Seq[ast.CommentRange] {
 * 	return iterateCommentRanges(f, text, pos, true)
 * }
 */
export declare function GetTrailingCommentRanges(f: GoPtr<NodeFactory>, text: string, pos: int): GoSeq<CommentRange>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/scanner.go::func::iterateCommentRanges","kind":"func","status":"implemented","sigHash":"950d4c94afbed592bb044975542a6dc636ee1a5bc0c42042a973550e0ba2d3ec","bodyHash":"f132c9ea9991faeac70e2d456bd494f5c398097f236bb1040bb7b1fbe7b6ab24"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Search comment terminators and test bounds against a cached byte view instead of materializing text[pos:] slices; comment ranges remain TS-Go byte-offset exact."}
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
 * 						if i := strings.Index(text[pos:], "* /"); i >= 0 {
 * 							pos += i + 2
 * 						} else {
 * 							pos = len(text)
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
 * 				if ch > unicode.MaxASCII && stringutil.IsWhiteSpaceLike(ch) {
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
export declare function iterateCommentRanges(f: GoPtr<NodeFactory>, text: string, pos: int, trailing: bool): GoSeq<CommentRange>;
//# sourceMappingURL=scanner.d.ts.map