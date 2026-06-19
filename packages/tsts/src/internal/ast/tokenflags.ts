import type { int } from "../../go/scalars.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/tokenflags.go::type::TokenFlags","kind":"type","status":"implemented","sigHash":"5f971a4f8bf155cc8fd940637f9d354a0828e487ebf251e3c5fee6aac31e7a07","bodyHash":"82663d444698724fc5a6de890d248ba49b35702ba44c068f0f683a413bb80e25"}
 *
 * Go source:
 * TokenFlags int32
 */
export type TokenFlags = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/tokenflags.go::constGroup::TokenFlagsNone+TokenFlagsPrecedingLineBreak+TokenFlagsPrecedingJSDocComment+TokenFlagsUnterminated+TokenFlagsExtendedUnicodeEscape+TokenFlagsScientific+TokenFlagsOctal+TokenFlagsHexSpecifier+TokenFlagsBinarySpecifier+TokenFlagsOctalSpecifier+TokenFlagsContainsSeparator+TokenFlagsUnicodeEscape+TokenFlagsContainsInvalidEscape+TokenFlagsHexEscape+TokenFlagsContainsLeadingZero+TokenFlagsContainsInvalidSeparator+TokenFlagsPrecedingJSDocLeadingAsterisks+TokenFlagsSingleQuote+TokenFlagsPrecedingJSDocWithDeprecated+TokenFlagsPrecedingJSDocWithSeeOrLink+TokenFlagsBinaryOrOctalSpecifier+TokenFlagsWithSpecifier+TokenFlagsStringLiteralFlags+TokenFlagsNumericLiteralFlags+TokenFlagsTemplateLiteralLikeFlags+TokenFlagsRegularExpressionLiteralFlags+TokenFlagsIsInvalid","kind":"constGroup","status":"implemented","sigHash":"d8d6f0a2ae7f681077fcffcd94f90a0891b3a8450e1ffcefe055f99105ba1d04","bodyHash":"3d1612d9c773e27fcbd4d0dd8f7fab8c1b81e32551076b4a93792ce5a6887152"}
 *
 * Go source:
 * const (
 * 	TokenFlagsNone                           TokenFlags = 0
 * 	TokenFlagsPrecedingLineBreak             TokenFlags = 1 << 0
 * 	TokenFlagsPrecedingJSDocComment          TokenFlags = 1 << 1
 * 	TokenFlagsUnterminated                   TokenFlags = 1 << 2
 * 	TokenFlagsExtendedUnicodeEscape          TokenFlags = 1 << 3  // e.g. `\u{10ffff}`
 * 	TokenFlagsScientific                     TokenFlags = 1 << 4  // e.g. `10e2`
 * 	TokenFlagsOctal                          TokenFlags = 1 << 5  // e.g. `0777`
 * 	TokenFlagsHexSpecifier                   TokenFlags = 1 << 6  // e.g. `0x00000000`
 * 	TokenFlagsBinarySpecifier                TokenFlags = 1 << 7  // e.g. `0b0110010000000000`
 * 	TokenFlagsOctalSpecifier                 TokenFlags = 1 << 8  // e.g. `0o777`
 * 	TokenFlagsContainsSeparator              TokenFlags = 1 << 9  // e.g. `0b1100_0101`
 * 	TokenFlagsUnicodeEscape                  TokenFlags = 1 << 10 // e.g. `\u00a0`
 * 	TokenFlagsContainsInvalidEscape          TokenFlags = 1 << 11 // e.g. `\uhello`
 * 	TokenFlagsHexEscape                      TokenFlags = 1 << 12 // e.g. `\xa0`
 * 	TokenFlagsContainsLeadingZero            TokenFlags = 1 << 13 // e.g. `0888`
 * 	TokenFlagsContainsInvalidSeparator       TokenFlags = 1 << 14 // e.g. `0_1`
 * 	TokenFlagsPrecedingJSDocLeadingAsterisks TokenFlags = 1 << 15
 * 	TokenFlagsSingleQuote                    TokenFlags = 1 << 16 // e.g. `'abc'`
 * 	TokenFlagsPrecedingJSDocWithDeprecated   TokenFlags = 1 << 17 // Preceding JSDoc comment contains @deprecated
 * 	TokenFlagsPrecedingJSDocWithSeeOrLink    TokenFlags = 1 << 18 // Preceding JSDoc comment contains @see or @link
 * 	TokenFlagsBinaryOrOctalSpecifier         TokenFlags = TokenFlagsBinarySpecifier | TokenFlagsOctalSpecifier
 * 	TokenFlagsWithSpecifier                  TokenFlags = TokenFlagsHexSpecifier | TokenFlagsBinaryOrOctalSpecifier
 * 	TokenFlagsStringLiteralFlags             TokenFlags = TokenFlagsUnterminated | TokenFlagsHexEscape | TokenFlagsUnicodeEscape | TokenFlagsExtendedUnicodeEscape | TokenFlagsContainsInvalidEscape | TokenFlagsSingleQuote
 * 	TokenFlagsNumericLiteralFlags            TokenFlags = TokenFlagsScientific | TokenFlagsOctal | TokenFlagsContainsLeadingZero | TokenFlagsWithSpecifier | TokenFlagsContainsSeparator | TokenFlagsContainsInvalidSeparator
 * 	TokenFlagsTemplateLiteralLikeFlags       TokenFlags = TokenFlagsUnterminated | TokenFlagsHexEscape | TokenFlagsUnicodeEscape | TokenFlagsExtendedUnicodeEscape | TokenFlagsContainsInvalidEscape
 * 	TokenFlagsRegularExpressionLiteralFlags  TokenFlags = TokenFlagsUnterminated
 * 	TokenFlagsIsInvalid                      TokenFlags = TokenFlagsOctal | TokenFlagsContainsLeadingZero | TokenFlagsContainsInvalidSeparator | TokenFlagsContainsInvalidEscape
 * )
 */
export const TokenFlagsNone: TokenFlags = 0;
export const TokenFlagsPrecedingLineBreak: TokenFlags = 1 << 0;
export const TokenFlagsPrecedingJSDocComment: TokenFlags = 1 << 1;
export const TokenFlagsUnterminated: TokenFlags = 1 << 2;
export const TokenFlagsExtendedUnicodeEscape: TokenFlags = 1 << 3; // e.g. `\u{10ffff}`
export const TokenFlagsScientific: TokenFlags = 1 << 4; // e.g. `10e2`
export const TokenFlagsOctal: TokenFlags = 1 << 5; // e.g. `0777`
export const TokenFlagsHexSpecifier: TokenFlags = 1 << 6; // e.g. `0x00000000`
export const TokenFlagsBinarySpecifier: TokenFlags = 1 << 7; // e.g. `0b0110010000000000`
export const TokenFlagsOctalSpecifier: TokenFlags = 1 << 8; // e.g. `0o777`
export const TokenFlagsContainsSeparator: TokenFlags = 1 << 9; // e.g. `0b1100_0101`
export const TokenFlagsUnicodeEscape: TokenFlags = 1 << 10; // e.g. ` `
export const TokenFlagsContainsInvalidEscape: TokenFlags = 1 << 11; // e.g. `\uhello`
export const TokenFlagsHexEscape: TokenFlags = 1 << 12; // e.g. `\xa0`
export const TokenFlagsContainsLeadingZero: TokenFlags = 1 << 13; // e.g. `0888`
export const TokenFlagsContainsInvalidSeparator: TokenFlags = 1 << 14; // e.g. `0_1`
export const TokenFlagsPrecedingJSDocLeadingAsterisks: TokenFlags = 1 << 15;
export const TokenFlagsSingleQuote: TokenFlags = 1 << 16; // e.g. `'abc'`
export const TokenFlagsPrecedingJSDocWithDeprecated: TokenFlags = 1 << 17; // Preceding JSDoc comment contains @deprecated
export const TokenFlagsPrecedingJSDocWithSeeOrLink: TokenFlags = 1 << 18; // Preceding JSDoc comment contains @see or @link
export const TokenFlagsBinaryOrOctalSpecifier: TokenFlags = TokenFlagsBinarySpecifier | TokenFlagsOctalSpecifier;
export const TokenFlagsWithSpecifier: TokenFlags = TokenFlagsHexSpecifier | TokenFlagsBinaryOrOctalSpecifier;
export const TokenFlagsStringLiteralFlags: TokenFlags = TokenFlagsUnterminated | TokenFlagsHexEscape | TokenFlagsUnicodeEscape | TokenFlagsExtendedUnicodeEscape | TokenFlagsContainsInvalidEscape | TokenFlagsSingleQuote;
export const TokenFlagsNumericLiteralFlags: TokenFlags = TokenFlagsScientific | TokenFlagsOctal | TokenFlagsContainsLeadingZero | TokenFlagsWithSpecifier | TokenFlagsContainsSeparator | TokenFlagsContainsInvalidSeparator;
export const TokenFlagsTemplateLiteralLikeFlags: TokenFlags = TokenFlagsUnterminated | TokenFlagsHexEscape | TokenFlagsUnicodeEscape | TokenFlagsExtendedUnicodeEscape | TokenFlagsContainsInvalidEscape;
export const TokenFlagsRegularExpressionLiteralFlags: TokenFlags = TokenFlagsUnterminated;
export const TokenFlagsIsInvalid: TokenFlags = TokenFlagsOctal | TokenFlagsContainsLeadingZero | TokenFlagsContainsInvalidSeparator | TokenFlagsContainsInvalidEscape;
