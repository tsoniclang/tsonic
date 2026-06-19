import type { bool, int } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoRune, GoSlice } from "../../go/compat.js";
import * as maps from "../../go/maps.js";
import * as math from "../../go/math.js";
import * as strconv from "../../go/strconv.js";
import * as strings from "../../go/strings.js";
import * as utf8 from "../../go/unicode/utf8.js";
import * as utf16 from "../../go/unicode/utf16.js";
import * as debug from "../debug/debug.js";
import { ConcatenateSeq, GetSpellingSuggestionForStrings } from "../core/core.js";
import type { ScriptTarget } from "../core/compileroptions.js";
import {
  ScriptTargetES2018,
  ScriptTargetES2022,
  ScriptTargetES2024,
} from "../core/compileroptions.js";
import { ScriptTarget_String } from "../core/scripttarget_stringer_generated.js";
import type { Message } from "../diagnostics/diagnostics.js";
import {
  A_character_class_must_not_contain_a_reserved_double_punctuator_Did_you_mean_to_escape_it_with_backslash,
  A_character_class_range_must_not_be_bounded_by_another_character_class,
  Anything_that_would_possibly_match_more_than_a_single_character_is_invalid_inside_a_negated_character_class,
  Any_Unicode_property_that_would_possibly_match_more_than_a_single_character_is_only_available_when_the_Unicode_Sets_v_flag_is_set,
  Did_you_mean_0,
  Duplicate_regular_expression_flag,
  Expected_a_capturing_group_name,
  Expected_a_class_set_operand,
  Expected_a_Unicode_property_name,
  Expected_a_Unicode_property_name_or_value,
  Expected_a_Unicode_property_value,
  Incomplete_quantifier_Digit_expected,
  Named_capturing_groups_are_only_available_when_targeting_ES2018_or_later,
  Named_capturing_groups_with_the_same_name_must_be_mutually_exclusive_to_each_other,
  Numbers_out_of_order_in_quantifier,
  Operators_must_not_be_mixed_within_a_character_class_Wrap_it_in_a_nested_class_instead,
  Range_out_of_order_in_character_class,
  Subpattern_flags_must_be_present_when_there_is_a_minus_sign,
  There_is_no_capturing_group_named_0_in_this_regular_expression,
  There_is_nothing_available_for_repetition,
  This_backreference_refers_to_a_group_that_does_not_exist_There_are_no_capturing_groups_in_this_regular_expression,
  This_backreference_refers_to_a_group_that_does_not_exist_There_are_only_0_capturing_groups_in_this_regular_expression,
  This_regular_expression_flag_cannot_be_toggled_within_a_subpattern,
  This_regular_expression_flag_is_only_available_when_targeting_0_or_later,
  Undetermined_character_escape,
  Unicode_property_value_expressions_are_only_available_when_the_Unicode_u_flag_or_the_Unicode_Sets_v_flag_is_set,
  Unexpected_0_Did_you_mean_to_escape_it_with_backslash,
  Unknown_regular_expression_flag,
  Unknown_Unicode_property_name,
  Unknown_Unicode_property_name_or_value,
  Unknown_Unicode_property_value,
  X_0_expected,
  X_0_must_be_followed_by_a_Unicode_property_value_expression_enclosed_in_braces,
  X_c_must_be_followed_by_an_ASCII_letter,
  X_k_must_be_followed_by_a_capturing_group_name_enclosed_in_angle_brackets,
  X_q_is_only_available_inside_character_class,
  X_q_must_be_followed_by_string_alternatives_enclosed_in_braces,
} from "../diagnostics/generated/messages.js";
import * as stringutil from "../stringutil/util.js";
import { Set_Has, Set_Keys } from "../collections/set.js";
import {
  binaryUnicodeProperties,
  binaryUnicodePropertiesOfStrings,
  nonBinaryUnicodeProperties,
  valuesOfNonBinaryUnicodeProperties,
} from "./unicodeproperties.js";
import {
  EscapeSequenceScanningFlagsAnnexB,
  EscapeSequenceScanningFlagsAnyUnicodeMode,
  EscapeSequenceScanningFlagsAtomEscape,
  EscapeSequenceScanningFlagsRegularExpression,
  IsIdentifierPart,
  isWordCharacter,
  Scanner_char,
  Scanner_charAt,
  Scanner_errorAt,
  Scanner_languageVersion,
  Scanner_scanEscapeSequence,
  Scanner_scanIdentifier,
} from "./scanner.js";
import type { EscapeSequenceScanningFlags, Scanner } from "./scanner.js";
import { CodePointToSurrogatePair, DecodeJSStringRune, EncodeJSStringRune } from "../stringutil/util.js";

// Go strings are UTF-8 byte sequences; the regexp parser tracks byte offsets
// (p.pos()). These helpers reproduce Go's byte-indexed string operations.
const byteSlice = utf8.StringByteSlice;
const byteAt = utf8.StringByteAt;
const byteLen = utf8.StringByteLen;

// stringFromRune reproduces Go's `string(rune)`: the rune is UTF-8 encoded.
// String.fromCodePoint yields the JS string whose UTF-8 byte view matches.
const stringFromRune = (r: GoRune): string => globalThis.String.fromCodePoint(r);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::type::regularExpressionFlags","kind":"type","status":"implemented","sigHash":"74034cff6ae3f9b069c908bda20182d140cbf4a9f73aaea9f5b51d7b4fcdea7c","bodyHash":"fa0afa8b415c28b398154adb24a5b19cd4a4027093347db5feb53f6dad6b6bb2"}
 *
 * Go source:
 * regularExpressionFlags int32
 */
export type regularExpressionFlags = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::constGroup::regularExpressionFlagsNone+regularExpressionFlagsHasIndices+regularExpressionFlagsGlobal+regularExpressionFlagsIgnoreCase+regularExpressionFlagsMultiline+regularExpressionFlagsDotAll+regularExpressionFlagsUnicode+regularExpressionFlagsUnicodeSets+regularExpressionFlagsSticky+regularExpressionFlagsAnyUnicodeMode+regularExpressionFlagsModifiers","kind":"constGroup","status":"implemented","sigHash":"ab2cf843727ce785e6610fdbfbb1d4a06b114afef68fcdc671ce94a8d149749e","bodyHash":"04cb25c8e88a8d5f671ae143d41f368b7698e0ad6bf6635186100d960cac8a43"}
 *
 * Go source:
 * const (
 * 	regularExpressionFlagsNone           regularExpressionFlags = 0
 * 	regularExpressionFlagsHasIndices     regularExpressionFlags = 1 << 0 // d
 * 	regularExpressionFlagsGlobal         regularExpressionFlags = 1 << 1 // g
 * 	regularExpressionFlagsIgnoreCase     regularExpressionFlags = 1 << 2 // i
 * 	regularExpressionFlagsMultiline      regularExpressionFlags = 1 << 3 // m
 * 	regularExpressionFlagsDotAll         regularExpressionFlags = 1 << 4 // s
 * 	regularExpressionFlagsUnicode        regularExpressionFlags = 1 << 5 // u
 * 	regularExpressionFlagsUnicodeSets    regularExpressionFlags = 1 << 6 // v
 * 	regularExpressionFlagsSticky         regularExpressionFlags = 1 << 7 // y
 * 	regularExpressionFlagsAnyUnicodeMode regularExpressionFlags = regularExpressionFlagsUnicode | regularExpressionFlagsUnicodeSets
 * 	regularExpressionFlagsModifiers      regularExpressionFlags = regularExpressionFlagsIgnoreCase | regularExpressionFlagsMultiline | regularExpressionFlagsDotAll
 * )
 */
export const regularExpressionFlagsNone: regularExpressionFlags = 0;
export const regularExpressionFlagsHasIndices: regularExpressionFlags = 1 << 0; // d
export const regularExpressionFlagsGlobal: regularExpressionFlags = 1 << 1; // g
export const regularExpressionFlagsIgnoreCase: regularExpressionFlags = 1 << 2; // i
export const regularExpressionFlagsMultiline: regularExpressionFlags = 1 << 3; // m
export const regularExpressionFlagsDotAll: regularExpressionFlags = 1 << 4; // s
export const regularExpressionFlagsUnicode: regularExpressionFlags = 1 << 5; // u
export const regularExpressionFlagsUnicodeSets: regularExpressionFlags = 1 << 6; // v
export const regularExpressionFlagsSticky: regularExpressionFlags = 1 << 7; // y
export const regularExpressionFlagsAnyUnicodeMode: regularExpressionFlags =
  regularExpressionFlagsUnicode | regularExpressionFlagsUnicodeSets;
export const regularExpressionFlagsModifiers: regularExpressionFlags =
  regularExpressionFlagsIgnoreCase | regularExpressionFlagsMultiline | regularExpressionFlagsDotAll;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::varGroup::charCodeToRegExpFlag","kind":"varGroup","status":"implemented","sigHash":"8359cbb1adec61bf0d936dd4d464c8911bd7c478c931a6471e0ac1c1bb85931d","bodyHash":"dfbf79744913d1908e2f18d0c617e8e79b1ea96e30475f590887239ed9e0177a"}
 *
 * Go source:
 * var charCodeToRegExpFlag = map[rune]regularExpressionFlags{
 * 	'd': regularExpressionFlagsHasIndices,
 * 	'g': regularExpressionFlagsGlobal,
 * 	'i': regularExpressionFlagsIgnoreCase,
 * 	'm': regularExpressionFlagsMultiline,
 * 	's': regularExpressionFlagsDotAll,
 * 	'u': regularExpressionFlagsUnicode,
 * 	'v': regularExpressionFlagsUnicodeSets,
 * 	'y': regularExpressionFlagsSticky,
 * }
 */
export const charCodeToRegExpFlag: GoMap<GoRune, regularExpressionFlags> = new globalThis.Map<
  GoRune,
  regularExpressionFlags
>([
  ["d".codePointAt(0)!, regularExpressionFlagsHasIndices],
  ["g".codePointAt(0)!, regularExpressionFlagsGlobal],
  ["i".codePointAt(0)!, regularExpressionFlagsIgnoreCase],
  ["m".codePointAt(0)!, regularExpressionFlagsMultiline],
  ["s".codePointAt(0)!, regularExpressionFlagsDotAll],
  ["u".codePointAt(0)!, regularExpressionFlagsUnicode],
  ["v".codePointAt(0)!, regularExpressionFlagsUnicodeSets],
  ["y".codePointAt(0)!, regularExpressionFlagsSticky],
]);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::varGroup::regExpFlagToFirstAvailableLanguageVersion","kind":"varGroup","status":"implemented","sigHash":"40c242a13d94a669ea4a8e1b0891435297dec3276e77e12be80d747244c5c7f3","bodyHash":"5d3db9d60bcdd3402473bb671527b4923cd4341fa4c499312934520ff0636a5d"}
 *
 * Go source:
 * var regExpFlagToFirstAvailableLanguageVersion = map[regularExpressionFlags]core.ScriptTarget{
 * 	regularExpressionFlagsHasIndices:  core.ScriptTargetES2022,
 * 	regularExpressionFlagsDotAll:      core.ScriptTargetES2018,
 * 	regularExpressionFlagsUnicodeSets: core.ScriptTargetES2024,
 * }
 */
export const regExpFlagToFirstAvailableLanguageVersion: GoMap<regularExpressionFlags, ScriptTarget> =
  new globalThis.Map<regularExpressionFlags, ScriptTarget>([
    [regularExpressionFlagsHasIndices, ScriptTargetES2022],
    [regularExpressionFlagsDotAll, ScriptTargetES2018],
    [regularExpressionFlagsUnicodeSets, ScriptTargetES2024],
  ]);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::Scanner.checkRegularExpressionFlagAvailability","kind":"method","status":"implemented","sigHash":"84da4107dd2b2011aecc60d10c223b31d75ce9d08f34fb2fb3bad240c9e258f3","bodyHash":"df28d9b9f3de6dfd999f0b7ec3c0dff9c239440548d173168db981da443659ea"}
 *
 * Go source:
 * func (s *Scanner) checkRegularExpressionFlagAvailability(flag regularExpressionFlags, pos int, size int) {
 * 	if availableFrom, ok := regExpFlagToFirstAvailableLanguageVersion[flag]; ok && s.languageVersion() < availableFrom {
 * 		s.errorAt(diagnostics.This_regular_expression_flag_is_only_available_when_targeting_0_or_later, pos, size, strings.ToLower(availableFrom.String()))
 * 	}
 * }
 */
export function Scanner_checkRegularExpressionFlagAvailability(receiver: GoPtr<Scanner>, flag: regularExpressionFlags, pos: int, size: int): void {
  const availableFrom = regExpFlagToFirstAvailableLanguageVersion.get(flag);
  const ok = regExpFlagToFirstAvailableLanguageVersion.has(flag);
  if (ok && Scanner_languageVersion(receiver) < availableFrom!) {
    Scanner_errorAt(
      receiver,
      This_regular_expression_flag_is_only_available_when_targeting_0_or_later,
      pos,
      size,
      strings.ToLower(ScriptTarget_String(availableFrom!)),
    );
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::type::classSetExpressionType","kind":"type","status":"implemented","sigHash":"55fa6056c91ab597c32b76a6e7df25ea33fc4ab36ae8a051bbbf2a7a82d24037","bodyHash":"327130feffaef09ce63259106adc7c5161ac56dbdc625cb2173c7c4e091d0950"}
 *
 * Go source:
 * classSetExpressionType int
 */
export type classSetExpressionType = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::constGroup::classSetExpressionTypeUnknown+classSetExpressionTypeClassUnion+classSetExpressionTypeClassIntersection+classSetExpressionTypeClassSubtraction","kind":"constGroup","status":"implemented","sigHash":"89a0d06996deb14515d637ac581a597d44523ebd90874d98ed8eee90e3e923b0","bodyHash":"1d7b192a4d44fd0b7de99d19f178f182cc9ebd45aef2caaed5d14b7bbffd8b74"}
 *
 * Go source:
 * const (
 * 	classSetExpressionTypeUnknown classSetExpressionType = iota
 * 	classSetExpressionTypeClassUnion
 * 	classSetExpressionTypeClassIntersection
 * 	classSetExpressionTypeClassSubtraction
 * )
 */
export const classSetExpressionTypeUnknown: classSetExpressionType = 0;
export const classSetExpressionTypeClassUnion: classSetExpressionType = 1;
export const classSetExpressionTypeClassIntersection: classSetExpressionType = 2;
export const classSetExpressionTypeClassSubtraction: classSetExpressionType = 3;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::type::groupNameReference","kind":"type","status":"implemented","sigHash":"61cea0fe7bef177baf8b7cfe9d0610dfd15dc0450f9389afd304d0c108a636dd","bodyHash":"e4e91aea40a2c7f1799ecd70ccb7052d5534e5d7b3b2d3f7104639d99ce1d970"}
 *
 * Go source:
 * groupNameReference struct {
 * 	pos  int
 * 	end  int
 * 	name string
 * }
 */
export interface groupNameReference {
  pos: int;
  end: int;
  name: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::type::decimalEscapeValue","kind":"type","status":"implemented","sigHash":"57bb9f713b3c9c16c150340068a58ac6fa7452f81a9241b20a9e7827247c52e2","bodyHash":"0380996d80e80b030340eab29aefe634ea2f58c95371bbffdae72823ca86893a"}
 *
 * Go source:
 * decimalEscapeValue struct {
 * 	pos   int
 * 	end   int
 * 	value int
 * }
 */
export interface decimalEscapeValue {
  pos: int;
  end: int;
  value: int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::type::regExpParser","kind":"type","status":"implemented","sigHash":"bd9ab5c9e0767af1609ffca7d47cfee1d20b6d8d642415720862b85f84290698","bodyHash":"bba66f13ff4c67d20240bc8f0e028d67a4f25465ca6cc40aae259d89c7ce1f54"}
 *
 * Go source:
 * regExpParser struct {
 * 	scanner         *Scanner
 * 	end             int
 * 	regExpFlags     regularExpressionFlags
 * 	anyUnicodeMode  bool
 * 	unicodeSetsMode bool
 * 	annexB          bool
 * 
 * 	anyUnicodeModeOrNonAnnexB bool
 * 	namedCaptureGroups        bool
 * 
 * 	// See scanClassSetExpression.
 * 	mayContainStrings bool
 * 	// The number of all (named and unnamed) capturing groups defined in the regex.
 * 	numberOfCapturingGroups int
 * 	// All named capturing groups defined in the regex.
 * 	groupSpecifiers map[string]bool
 * 	// All references to named capturing groups in the regex.
 * 	groupNameReferences []groupNameReference
 * 	// All numeric backreferences within the regex.
 * 	decimalEscapes []decimalEscapeValue
 * 	// A stack of scopes for named capturing groups. See scanGroupName.
 * 	namedCapturingGroups []map[string]bool
 * 
 * 	// pendingLowSurrogate holds the low surrogate to emit on the next
 * 	// scanSourceCharacter call when Corsa has to split a non-BMP rune into
 * 	// UTF-16 surrogate code units in non-unicode mode. Strada did not need
 * 	// this bookkeeping because its source text was already indexed as UTF-16.
 * 	pendingLowSurrogate rune
 * }
 */
export interface regExpParser {
  scanner: GoPtr<Scanner>;
  end: int;
  regExpFlags: regularExpressionFlags;
  anyUnicodeMode: bool;
  unicodeSetsMode: bool;
  annexB: bool;
  anyUnicodeModeOrNonAnnexB: bool;
  namedCaptureGroups: bool;
  mayContainStrings: bool;
  numberOfCapturingGroups: int;
  groupSpecifiers: GoMap<string, bool>;
  groupNameReferences: GoSlice<groupNameReference>;
  decimalEscapes: GoSlice<decimalEscapeValue>;
  namedCapturingGroups: GoSlice<GoMap<string, bool>>;
  pendingLowSurrogate: GoRune;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.pos","kind":"method","status":"implemented","sigHash":"8e33479f1ebc7fcc461a5b58b98e36f77638dbc7a4c4e6dc4aec1f867665d702","bodyHash":"c6ad8dc33fba969b4525743e2d2e710ed74d90bc661b4b34b493e66040241df2"}
 *
 * Go source:
 * func (p *regExpParser) pos() int {
 * 	return p.scanner.pos
 * }
 */
export function regExpParser_pos(receiver: GoPtr<regExpParser>): int {
  return receiver!.scanner!.__tsgoEmbedded0!.pos;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.setPos","kind":"method","status":"implemented","sigHash":"0de1093fea3ff54bcc1550f6bd2bc0125a7cec7b87b4dc4a974e0f7158f1447a","bodyHash":"6919d876a487ebd164b35b2d41363c8be5577399b0aa034b288c2e8f7074cb2c"}
 *
 * Go source:
 * func (p *regExpParser) setPos(v int) {
 * 	p.scanner.pos = v
 * }
 */
export function regExpParser_setPos(receiver: GoPtr<regExpParser>, v: int): void {
  receiver!.scanner!.__tsgoEmbedded0!.pos = v;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.incPos","kind":"method","status":"implemented","sigHash":"74134f9183584bef101f89384014b2ad6a34f37a1ab1587746901189402d2679","bodyHash":"8124a34981440e9fbb07a76c94369ee2f84c731594ef9b4cccb580b6ce522492"}
 *
 * Go source:
 * func (p *regExpParser) incPos(n int) {
 * 	p.scanner.pos += n
 * }
 */
export function regExpParser_incPos(receiver: GoPtr<regExpParser>, n: int): void {
  receiver!.scanner!.__tsgoEmbedded0!.pos += n;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.char","kind":"method","status":"implemented","sigHash":"0d72df4585b3ba5cf08092ce1b082453c8c66486427955449be2abed40bec090","bodyHash":"5f161db09a5d2210e476eb1d6c9d2cdfaa3d67ff63216c87753b059308f32152"}
 *
 * Go source:
 * func (p *regExpParser) char() rune {
 * 	return p.scanner.char()
 * }
 */
export function regExpParser_char(receiver: GoPtr<regExpParser>): GoRune {
  return Scanner_char(receiver!.scanner);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.charAt","kind":"method","status":"implemented","sigHash":"903bebc4cfd536ee98299b55234574348a83fd9e9e7ebcd237023549bf8b1c5d","bodyHash":"d16cb2757688ac037f04a8c44c813603ab83f22bed338c6759d8af73bd496f37"}
 *
 * Go source:
 * func (p *regExpParser) charAt(pos int) rune {
 * 	return p.scanner.charAt(pos - p.pos())
 * }
 */
export function regExpParser_charAt(receiver: GoPtr<regExpParser>, pos: int): GoRune {
  return Scanner_charAt(receiver!.scanner, pos - regExpParser_pos(receiver));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.error","kind":"method","status":"implemented","sigHash":"c82b369dfef6fd83eed4e077335ca020efb9b09906b88b13751452fe9e9027ed","bodyHash":"dbe334b841fe27149a19aa03bbee1261049c867b2d3243d0e2ce6ee4d10d2ea7"}
 *
 * Go source:
 * func (p *regExpParser) error(msg *diagnostics.Message, pos int, length int, args ...any) {
 * 	p.scanner.errorAt(msg, pos, length, args...)
 * }
 */
export function regExpParser_error(receiver: GoPtr<regExpParser>, msg: GoPtr<Message>, pos: int, length: int, ...args: Array<unknown>): void {
  Scanner_errorAt(receiver!.scanner, msg, pos, length, ...args);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.text","kind":"method","status":"implemented","sigHash":"e79564dfb511ff56ef0047763b00519aee5439eeb44b18ad3a0bcf3b87a52f30","bodyHash":"4aae977eb8dc168369c04461246a7d6434b68a697e6737e0cb61c3776fd348e4"}
 *
 * Go source:
 * func (p *regExpParser) text() string {
 * 	return p.scanner.text
 * }
 */
export function regExpParser_text(receiver: GoPtr<regExpParser>): string {
  return receiver!.scanner!.text;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::func::compareDecimalStrings","kind":"func","status":"implemented","sigHash":"816c94b5e453eb058bb6afd5b782868364ba1848db76c9e6691d7adddda028ac","bodyHash":"38497341bb621811faa459877c30a9c7a116a532984830c62991fa85fa852d55"}
 *
 * Go source:
 * func compareDecimalStrings(a string, b string) int {
 * 	a = strings.TrimLeft(a, "0")
 * 	b = strings.TrimLeft(b, "0")
 * 	if a == "" {
 * 		a = "0"
 * 	}
 * 	if b == "" {
 * 		b = "0"
 * 	}
 * 	if len(a) != len(b) {
 * 		if len(a) < len(b) {
 * 			return -1
 * 		}
 * 		return 1
 * 	}
 * 	return strings.Compare(a, b)
 * }
 */
export function compareDecimalStrings(a: string, b: string): int {
  const aTrimmed0 = strings.TrimLeft(a, "0");
  const bTrimmed0 = strings.TrimLeft(b, "0");
  const aResolved = aTrimmed0 === "" ? "0" : aTrimmed0;
  const bResolved = bTrimmed0 === "" ? "0" : bTrimmed0;
  if (aResolved.length !== bResolved.length) {
    if (aResolved.length < bResolved.length) {
      return -1;
    }
    return 1;
  }
  return strings.Compare(aResolved, bResolved);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanDisjunction","kind":"method","status":"implemented","sigHash":"0e24999276ea4dffbf00a616761c9e0d3171d6da578e114d933d0b08a490a888","bodyHash":"ee8494a3c9ba11e23d5a51288a1ec5d5593d388ab7f51a759e2527182ca51b3e"}
 *
 * Go source:
 * func (p *regExpParser) scanDisjunction(isInGroup bool) {
 * 	for {
 * 		p.namedCapturingGroups = append(p.namedCapturingGroups, make(map[string]bool))
 * 		p.scanAlternative(isInGroup)
 * 		p.namedCapturingGroups = p.namedCapturingGroups[:len(p.namedCapturingGroups)-1]
 * 		if p.char() != '|' {
 * 			return
 * 		}
 * 		p.incPos(1)
 * 	}
 * }
 */
export function regExpParser_scanDisjunction(receiver: GoPtr<regExpParser>, isInGroup: bool): void {
  for (;;) {
    receiver!.namedCapturingGroups = [
      ...receiver!.namedCapturingGroups,
      new globalThis.Map<string, bool>(),
    ];
    regExpParser_scanAlternative(receiver, isInGroup);
    receiver!.namedCapturingGroups = receiver!.namedCapturingGroups.slice(
      0,
      receiver!.namedCapturingGroups.length - 1,
    );
    if (regExpParser_char(receiver) !== "|".codePointAt(0)!) {
      return;
    }
    regExpParser_incPos(receiver, 1);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanAlternative","kind":"method","status":"implemented","sigHash":"1629c422970127df87d3a89f2daea057bdc90fc2589df4626b42ce05fb6d9e8f","bodyHash":"126fc2d73b9fafd11706096226c0c0de04a04f73b7b25248b09b2c71b2454fda"}
 *
 * Go source:
 * func (p *regExpParser) scanAlternative(isInGroup bool) {
 * 	isPreviousTermQuantifiable := false
 * 	for p.pos() < p.end {
 * 		start := p.pos()
 * 		ch := p.char()
 * 		switch ch {
 * 		case '^', '$':
 * 			p.incPos(1)
 * 			isPreviousTermQuantifiable = false
 * 		case '\\':
 * 			p.incPos(1)
 * 			switch p.char() {
 * 			case 'b', 'B':
 * 				p.incPos(1)
 * 				isPreviousTermQuantifiable = false
 * 			default:
 * 				p.scanAtomEscape()
 * 				isPreviousTermQuantifiable = true
 * 			}
 * 		case '(':
 * 			p.incPos(1)
 * 			if p.char() == '?' {
 * 				p.incPos(1)
 * 				switch p.char() {
 * 				case '=', '!':
 * 					p.incPos(1)
 * 					// In Annex B, `(?=Disjunction)` and `(?!Disjunction)` are quantifiable
 * 					isPreviousTermQuantifiable = !p.anyUnicodeModeOrNonAnnexB
 * 				case '<':
 * 					groupNameStart := p.pos()
 * 					p.incPos(1)
 * 					switch p.char() {
 * 					case '=', '!':
 * 						p.incPos(1)
 * 						isPreviousTermQuantifiable = false
 * 					default:
 * 						p.scanGroupName(false /*isReference* /)
 * 						p.scanExpectedChar('>')
 * 						if p.scanner.languageVersion() < core.ScriptTargetES2018 {
 * 							p.error(diagnostics.Named_capturing_groups_are_only_available_when_targeting_ES2018_or_later, groupNameStart, p.pos()-groupNameStart)
 * 						}
 * 						p.numberOfCapturingGroups++
 * 						isPreviousTermQuantifiable = true
 * 					}
 * 				default:
 * 					flagsStart := p.pos()
 * 					setFlags := p.scanPatternModifiers(regularExpressionFlagsNone)
 * 					if p.char() == '-' {
 * 						p.incPos(1)
 * 						p.scanPatternModifiers(setFlags)
 * 						if p.pos() == flagsStart+1 {
 * 							p.error(diagnostics.Subpattern_flags_must_be_present_when_there_is_a_minus_sign, flagsStart, p.pos()-flagsStart)
 * 						}
 * 					}
 * 					p.scanExpectedChar(':')
 * 					isPreviousTermQuantifiable = true
 * 				}
 * 			} else {
 * 				p.numberOfCapturingGroups++
 * 				isPreviousTermQuantifiable = true
 * 			}
 * 			p.scanDisjunction(true /*isInGroup* /)
 * 			p.scanExpectedChar(')')
 * 		case '{':
 * 			p.incPos(1)
 * 			digitsStart := p.pos()
 * 			p.scanDigits()
 * 			minStr := p.scanner.tokenValue
 * 			if !p.anyUnicodeModeOrNonAnnexB && minStr == "" {
 * 				isPreviousTermQuantifiable = true
 * 				continue
 * 			}
 * 			if p.char() == ',' {
 * 				p.incPos(1)
 * 				p.scanDigits()
 * 				maxStr := p.scanner.tokenValue
 * 				if minStr == "" {
 * 					if maxStr != "" || p.char() == '}' {
 * 						p.error(diagnostics.Incomplete_quantifier_Digit_expected, digitsStart, 0)
 * 					} else {
 * 						p.error(diagnostics.Unexpected_0_Did_you_mean_to_escape_it_with_backslash, start, 1, string(ch))
 * 						isPreviousTermQuantifiable = true
 * 						continue
 * 					}
 * 				} else if maxStr != "" {
 * 					if compareDecimalStrings(minStr, maxStr) > 0 && (p.anyUnicodeModeOrNonAnnexB || p.char() == '}') {
 * 						p.error(diagnostics.Numbers_out_of_order_in_quantifier, digitsStart, p.pos()-digitsStart)
 * 					}
 * 				}
 * 			} else if minStr == "" {
 * 				if p.anyUnicodeModeOrNonAnnexB {
 * 					p.error(diagnostics.Unexpected_0_Did_you_mean_to_escape_it_with_backslash, start, 1, string(ch))
 * 				}
 * 				isPreviousTermQuantifiable = true
 * 				continue
 * 			}
 * 			if p.char() != '}' {
 * 				if p.anyUnicodeModeOrNonAnnexB {
 * 					p.error(diagnostics.X_0_expected, p.pos(), 0, "}")
 * 					p.incPos(-1)
 * 				} else {
 * 					isPreviousTermQuantifiable = true
 * 					continue
 * 				}
 * 			}
 * 			fallthrough
 * 		case '*', '+', '?':
 * 			p.incPos(1)
 * 			if p.char() == '?' {
 * 				// Non-greedy
 * 				p.incPos(1)
 * 			}
 * 			if !isPreviousTermQuantifiable {
 * 				p.error(diagnostics.There_is_nothing_available_for_repetition, start, p.pos()-start)
 * 			}
 * 			isPreviousTermQuantifiable = false
 * 		case '.':
 * 			p.incPos(1)
 * 			isPreviousTermQuantifiable = true
 * 		case '[':
 * 			p.incPos(1)
 * 			if p.unicodeSetsMode {
 * 				p.scanClassSetExpression()
 * 			} else {
 * 				p.scanClassRanges()
 * 				p.pendingLowSurrogate = 0
 * 			}
 * 			p.scanExpectedChar(']')
 * 			isPreviousTermQuantifiable = true
 * 		case ')':
 * 			if isInGroup {
 * 				return
 * 			}
 * 			fallthrough
 * 		case ']', '}':
 * 			if p.anyUnicodeModeOrNonAnnexB || ch == ')' {
 * 				p.error(diagnostics.Unexpected_0_Did_you_mean_to_escape_it_with_backslash, p.pos(), 1, string(ch))
 * 			}
 * 			p.incPos(1)
 * 			isPreviousTermQuantifiable = true
 * 		case '/', '|':
 * 			return
 * 		default:
 * 			p.scanSourceCharacter()
 * 			isPreviousTermQuantifiable = true
 * 		}
 * 	}
 * }
 */
export function regExpParser_scanAlternative(receiver: GoPtr<regExpParser>, isInGroup: bool): void {
  let isPreviousTermQuantifiable: bool = false;
  while (regExpParser_pos(receiver) < receiver!.end) {
    const start = regExpParser_pos(receiver);
    const ch = regExpParser_char(receiver);
    if (ch === "^".codePointAt(0)! || ch === "$".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      isPreviousTermQuantifiable = false;
    } else if (ch === "\\".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      const escCh = regExpParser_char(receiver);
      if (escCh === "b".codePointAt(0)! || escCh === "B".codePointAt(0)!) {
        regExpParser_incPos(receiver, 1);
        isPreviousTermQuantifiable = false;
      } else {
        regExpParser_scanAtomEscape(receiver);
        isPreviousTermQuantifiable = true;
      }
    } else if (ch === "(".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      if (regExpParser_char(receiver) === "?".codePointAt(0)!) {
        regExpParser_incPos(receiver, 1);
        const groupCh = regExpParser_char(receiver);
        if (groupCh === "=".codePointAt(0)! || groupCh === "!".codePointAt(0)!) {
          regExpParser_incPos(receiver, 1);
          // In Annex B, `(?=Disjunction)` and `(?!Disjunction)` are quantifiable
          isPreviousTermQuantifiable = !receiver!.anyUnicodeModeOrNonAnnexB;
        } else if (groupCh === "<".codePointAt(0)!) {
          const groupNameStart = regExpParser_pos(receiver);
          regExpParser_incPos(receiver, 1);
          const lookCh = regExpParser_char(receiver);
          if (lookCh === "=".codePointAt(0)! || lookCh === "!".codePointAt(0)!) {
            regExpParser_incPos(receiver, 1);
            isPreviousTermQuantifiable = false;
          } else {
            regExpParser_scanGroupName(receiver, false /*isReference*/);
            regExpParser_scanExpectedChar(receiver, ">".codePointAt(0)!);
            if (Scanner_languageVersion(receiver!.scanner) < ScriptTargetES2018) {
              regExpParser_error(
                receiver,
                Named_capturing_groups_are_only_available_when_targeting_ES2018_or_later,
                groupNameStart,
                regExpParser_pos(receiver) - groupNameStart,
              );
            }
            receiver!.numberOfCapturingGroups++;
            isPreviousTermQuantifiable = true;
          }
        } else {
          const flagsStart = regExpParser_pos(receiver);
          const setFlags = regExpParser_scanPatternModifiers(receiver, regularExpressionFlagsNone);
          if (regExpParser_char(receiver) === "-".codePointAt(0)!) {
            regExpParser_incPos(receiver, 1);
            regExpParser_scanPatternModifiers(receiver, setFlags);
            if (regExpParser_pos(receiver) === flagsStart + 1) {
              regExpParser_error(
                receiver,
                Subpattern_flags_must_be_present_when_there_is_a_minus_sign,
                flagsStart,
                regExpParser_pos(receiver) - flagsStart,
              );
            }
          }
          regExpParser_scanExpectedChar(receiver, ":".codePointAt(0)!);
          isPreviousTermQuantifiable = true;
        }
      } else {
        receiver!.numberOfCapturingGroups++;
        isPreviousTermQuantifiable = true;
      }
      regExpParser_scanDisjunction(receiver, true /*isInGroup*/);
      regExpParser_scanExpectedChar(receiver, ")".codePointAt(0)!);
    } else if (
      ch === "{".codePointAt(0)! ||
      ch === "*".codePointAt(0)! ||
      ch === "+".codePointAt(0)! ||
      ch === "?".codePointAt(0)!
    ) {
      // fallsThroughToQuantifier mirrors Go's `fallthrough` from the '{' case
      // into the '*'/'+'/'?' case. It is true unless the '{' handling hit a
      // `continue` (modeled here as `quantifierContinue`).
      let fallsThroughToQuantifier: bool = true;
      let quantifierContinue: bool = false;
      if (ch === "{".codePointAt(0)!) {
        regExpParser_incPos(receiver, 1);
        const digitsStart = regExpParser_pos(receiver);
        regExpParser_scanDigits(receiver);
        const minStr = receiver!.scanner!.__tsgoEmbedded0!.tokenValue;
        if (!receiver!.anyUnicodeModeOrNonAnnexB && minStr === "") {
          isPreviousTermQuantifiable = true;
          quantifierContinue = true;
        } else {
          if (regExpParser_char(receiver) === ",".codePointAt(0)!) {
            regExpParser_incPos(receiver, 1);
            regExpParser_scanDigits(receiver);
            const maxStr = receiver!.scanner!.__tsgoEmbedded0!.tokenValue;
            if (minStr === "") {
              if (maxStr !== "" || regExpParser_char(receiver) === "}".codePointAt(0)!) {
                regExpParser_error(receiver, Incomplete_quantifier_Digit_expected, digitsStart, 0);
              } else {
                regExpParser_error(
                  receiver,
                  Unexpected_0_Did_you_mean_to_escape_it_with_backslash,
                  start,
                  1,
                  stringFromRune(ch),
                );
                isPreviousTermQuantifiable = true;
                quantifierContinue = true;
              }
            } else if (maxStr !== "") {
              if (
                compareDecimalStrings(minStr, maxStr) > 0 &&
                (receiver!.anyUnicodeModeOrNonAnnexB || regExpParser_char(receiver) === "}".codePointAt(0)!)
              ) {
                regExpParser_error(
                  receiver,
                  Numbers_out_of_order_in_quantifier,
                  digitsStart,
                  regExpParser_pos(receiver) - digitsStart,
                );
              }
            }
          } else if (minStr === "") {
            if (receiver!.anyUnicodeModeOrNonAnnexB) {
              regExpParser_error(
                receiver,
                Unexpected_0_Did_you_mean_to_escape_it_with_backslash,
                start,
                1,
                stringFromRune(ch),
              );
            }
            isPreviousTermQuantifiable = true;
            quantifierContinue = true;
          }
          if (!quantifierContinue) {
            if (regExpParser_char(receiver) !== "}".codePointAt(0)!) {
              if (receiver!.anyUnicodeModeOrNonAnnexB) {
                regExpParser_error(receiver, X_0_expected, regExpParser_pos(receiver), 0, "}");
                regExpParser_incPos(receiver, -1);
              } else {
                isPreviousTermQuantifiable = true;
                quantifierContinue = true;
              }
            }
          }
        }
        if (quantifierContinue) {
          fallsThroughToQuantifier = false;
        }
      }
      if (fallsThroughToQuantifier) {
        regExpParser_incPos(receiver, 1);
        if (regExpParser_char(receiver) === "?".codePointAt(0)!) {
          // Non-greedy
          regExpParser_incPos(receiver, 1);
        }
        if (!isPreviousTermQuantifiable) {
          regExpParser_error(
            receiver,
            There_is_nothing_available_for_repetition,
            start,
            regExpParser_pos(receiver) - start,
          );
        }
        isPreviousTermQuantifiable = false;
      }
    } else if (ch === ".".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      isPreviousTermQuantifiable = true;
    } else if (ch === "[".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      if (receiver!.unicodeSetsMode) {
        regExpParser_scanClassSetExpression(receiver);
      } else {
        regExpParser_scanClassRanges(receiver);
        receiver!.pendingLowSurrogate = 0;
      }
      regExpParser_scanExpectedChar(receiver, "]".codePointAt(0)!);
      isPreviousTermQuantifiable = true;
    } else if (
      ch === ")".codePointAt(0)! ||
      ch === "]".codePointAt(0)! ||
      ch === "}".codePointAt(0)!
    ) {
      // ')' returns when in a group; otherwise it falls through (in Go) to the
      // shared ']' / '}' handling below.
      if (ch === ")".codePointAt(0)! && isInGroup) {
        return;
      }
      if (receiver!.anyUnicodeModeOrNonAnnexB || ch === ")".codePointAt(0)!) {
        regExpParser_error(
          receiver,
          Unexpected_0_Did_you_mean_to_escape_it_with_backslash,
          regExpParser_pos(receiver),
          1,
          stringFromRune(ch),
        );
      }
      regExpParser_incPos(receiver, 1);
      isPreviousTermQuantifiable = true;
    } else if (ch === "/".codePointAt(0)! || ch === "|".codePointAt(0)!) {
      return;
    } else {
      regExpParser_scanSourceCharacter(receiver);
      isPreviousTermQuantifiable = true;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanPatternModifiers","kind":"method","status":"implemented","sigHash":"c33b20b79d458bb8b6dbafba074f7fbcc7bd8a895a99c5c1048117787142702d","bodyHash":"a0aa4b7a800aca500bd437ce56c9fe020741fbb729e60252b9527e6a54d0c549"}
 *
 * Go source:
 * func (p *regExpParser) scanPatternModifiers(currFlags regularExpressionFlags) regularExpressionFlags {
 * 	for p.pos() < p.end {
 * 		ch, size := utf8.DecodeRuneInString(p.text()[p.pos():])
 * 		if ch == utf8.RuneError || !IsIdentifierPart(ch) {
 * 			break
 * 		}
 * 		flag, ok := charCodeToRegExpFlag[ch]
 * 		if !ok {
 * 			p.error(diagnostics.Unknown_regular_expression_flag, p.pos(), size)
 * 		} else if currFlags&flag != 0 {
 * 			p.error(diagnostics.Duplicate_regular_expression_flag, p.pos(), size)
 * 		} else if flag&regularExpressionFlagsModifiers == 0 {
 * 			p.error(diagnostics.This_regular_expression_flag_cannot_be_toggled_within_a_subpattern, p.pos(), size)
 * 		} else {
 * 			currFlags |= flag
 * 			p.scanner.checkRegularExpressionFlagAvailability(flag, p.pos(), size)
 * 		}
 * 		p.incPos(size)
 * 	}
 * 	return currFlags
 * }
 */
export function regExpParser_scanPatternModifiers(receiver: GoPtr<regExpParser>, currFlags: regularExpressionFlags): regularExpressionFlags {
  let currFlagsLocal: regularExpressionFlags = currFlags;
  while (regExpParser_pos(receiver) < receiver!.end) {
    const [ch, size] = utf8.DecodeRuneInStringAt(regExpParser_text(receiver), regExpParser_pos(receiver));
    if (ch === utf8.RuneError || !IsIdentifierPart(ch)) {
      break;
    }
    const flag = charCodeToRegExpFlag.get(ch);
    const ok = charCodeToRegExpFlag.has(ch);
    if (!ok) {
      regExpParser_error(receiver, Unknown_regular_expression_flag, regExpParser_pos(receiver), size);
    } else if ((currFlagsLocal & flag!) !== 0) {
      regExpParser_error(receiver, Duplicate_regular_expression_flag, regExpParser_pos(receiver), size);
    } else if ((flag! & regularExpressionFlagsModifiers) === 0) {
      regExpParser_error(
        receiver,
        This_regular_expression_flag_cannot_be_toggled_within_a_subpattern,
        regExpParser_pos(receiver),
        size,
      );
    } else {
      currFlagsLocal |= flag!;
      Scanner_checkRegularExpressionFlagAvailability(receiver!.scanner, flag!, regExpParser_pos(receiver), size);
    }
    regExpParser_incPos(receiver, size);
  }
  return currFlagsLocal;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanAtomEscape","kind":"method","status":"implemented","sigHash":"136cda4b9ce095082a907a6cf38224320dd663b4aa1837600adf3d5789c751a8","bodyHash":"294b4f5b10d3ffcbbe3501d5ddc3ed95f9bf8069d0f9a33211bf8655b0b7c3aa"}
 *
 * Go source:
 * func (p *regExpParser) scanAtomEscape() {
 * 	debug.Assert(p.pos() > 0 && p.text()[p.pos()-1] == '\\')
 * 	switch p.char() {
 * 	case 'k':
 * 		p.incPos(1)
 * 		if p.char() == '<' {
 * 			p.incPos(1)
 * 			p.scanGroupName(true /*isReference* /)
 * 			p.scanExpectedChar('>')
 * 		} else if p.anyUnicodeModeOrNonAnnexB || p.namedCaptureGroups {
 * 			p.error(diagnostics.X_k_must_be_followed_by_a_capturing_group_name_enclosed_in_angle_brackets, p.pos()-2, 2)
 * 		}
 * 	case 'q':
 * 		if p.unicodeSetsMode {
 * 			p.incPos(1)
 * 			p.error(diagnostics.X_q_is_only_available_inside_character_class, p.pos()-2, 2)
 * 			return
 * 		}
 * 		fallthrough
 * 	default:
 * 		if !p.scanCharacterClassEscape() && !p.scanDecimalEscape() {
 * 			// Regex literals cannot contain line breaks here, so a character escape must consume something.
 * 			debug.Assert(p.scanCharacterEscape(true /*atomEscape* /) != "")
 * 		}
 * 	}
 * }
 */
export function regExpParser_scanAtomEscape(receiver: GoPtr<regExpParser>): void {
  debug.Assert(regExpParser_pos(receiver) > 0 && byteAt(regExpParser_text(receiver), regExpParser_pos(receiver) - 1) === "\\".codePointAt(0)!);
  const ch = regExpParser_char(receiver);
  if (ch === "k".codePointAt(0)!) {
    regExpParser_incPos(receiver, 1);
    if (regExpParser_char(receiver) === "<".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      regExpParser_scanGroupName(receiver, true /*isReference*/);
      regExpParser_scanExpectedChar(receiver, ">".codePointAt(0)!);
    } else if (receiver!.anyUnicodeModeOrNonAnnexB || receiver!.namedCaptureGroups) {
      regExpParser_error(
        receiver,
        X_k_must_be_followed_by_a_capturing_group_name_enclosed_in_angle_brackets,
        regExpParser_pos(receiver) - 2,
        2,
      );
    }
    return;
  }
  if (ch === "q".codePointAt(0)! && receiver!.unicodeSetsMode) {
    // The 'q' case only short-circuits here in unicodeSetsMode; otherwise it
    // falls through (in Go) to the default handling below.
    regExpParser_incPos(receiver, 1);
    regExpParser_error(receiver, X_q_is_only_available_inside_character_class, regExpParser_pos(receiver) - 2, 2);
    return;
  }
  // default (also reached via fallthrough from a non-unicodeSetsMode 'q')
  if (!regExpParser_scanCharacterClassEscape(receiver) && !regExpParser_scanDecimalEscape(receiver)) {
    // Regex literals cannot contain line breaks here, so a character escape must consume something.
    debug.Assert(regExpParser_scanCharacterEscape(receiver, true /*atomEscape*/) !== "");
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanDecimalEscape","kind":"method","status":"implemented","sigHash":"d762b77b903e8bc83528a4fff20977065a8b4153998e9f1c7e712b04f368b4a7","bodyHash":"2ab0fe3a7bdcd00640f58a7f050f1f61b29dff5c1c2502e0ce7f4ed7dddc1629"}
 *
 * Go source:
 * func (p *regExpParser) scanDecimalEscape() bool {
 * 	debug.Assert(p.pos() > 0 && p.text()[p.pos()-1] == '\\')
 * 	ch := p.char()
 * 	if ch >= '1' && ch <= '9' {
 * 		start := p.pos()
 * 		p.scanDigits()
 * 		val, err := strconv.Atoi(p.scanner.tokenValue)
 * 		if err != nil {
 * 			val = math.MaxInt
 * 		}
 * 		p.decimalEscapes = append(p.decimalEscapes, decimalEscapeValue{pos: start, end: p.pos(), value: val})
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function regExpParser_scanDecimalEscape(receiver: GoPtr<regExpParser>): bool {
  debug.Assert(regExpParser_pos(receiver) > 0 && byteAt(regExpParser_text(receiver), regExpParser_pos(receiver) - 1) === "\\".codePointAt(0)!);
  const ch = regExpParser_char(receiver);
  if (ch >= "1".codePointAt(0)! && ch <= "9".codePointAt(0)!) {
    const start = regExpParser_pos(receiver);
    regExpParser_scanDigits(receiver);
    const [atoiValue, err] = strconv.Atoi(receiver!.scanner!.__tsgoEmbedded0!.tokenValue);
    const val = err !== undefined ? math.MaxInt : atoiValue;
    receiver!.decimalEscapes = [
      ...receiver!.decimalEscapes,
      { pos: start, end: regExpParser_pos(receiver), value: val },
    ];
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanCharacterEscape","kind":"method","status":"implemented","sigHash":"3b9293684f3ea4945129fc2aa88322c75ee250e428a1af895eb24c0eea7303b6","bodyHash":"700751fd315c7aa380ccf86f79599793324be335fca6572dbbdea36c953f8275"}
 *
 * Go source:
 * func (p *regExpParser) scanCharacterEscape(atomEscape bool) string {
 * 	debug.Assert(p.pos() > 0 && p.text()[p.pos()-1] == '\\')
 * 	ch := p.char()
 * 	switch ch {
 * 	case -1:
 * 		p.error(diagnostics.Undetermined_character_escape, p.pos()-1, 1)
 * 		return "\\"
 * 	case 'c':
 * 		p.incPos(1)
 * 		ch = p.char()
 * 		if stringutil.IsASCIILetter(ch) {
 * 			p.incPos(1)
 * 			return string(ch & 0x1f)
 * 		}
 * 		if p.anyUnicodeModeOrNonAnnexB {
 * 			p.error(diagnostics.X_c_must_be_followed_by_an_ASCII_letter, p.pos()-2, 2)
 * 		} else if atomEscape {
 * 			p.incPos(-1)
 * 			return "\\"
 * 		}
 * 		return string(ch)
 * 	case '^', '$', '/', '\\', '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|':
 * 		p.incPos(1)
 * 		return string(ch)
 * 	default:
 * 		p.incPos(-1) // back up to include the backslash for scanEscapeSequence
 * 		flags := EscapeSequenceScanningFlagsRegularExpression
 * 		if p.annexB {
 * 			flags |= EscapeSequenceScanningFlagsAnnexB
 * 		}
 * 		if p.anyUnicodeMode {
 * 			flags |= EscapeSequenceScanningFlagsAnyUnicodeMode
 * 		}
 * 		if atomEscape {
 * 			flags |= EscapeSequenceScanningFlagsAtomEscape
 * 		}
 * 		return p.scanner.scanEscapeSequence(flags)
 * 	}
 * }
 */
export function regExpParser_scanCharacterEscape(receiver: GoPtr<regExpParser>, atomEscape: bool): string {
  debug.Assert(regExpParser_pos(receiver) > 0 && byteAt(regExpParser_text(receiver), regExpParser_pos(receiver) - 1) === "\\".codePointAt(0)!);
  const ch = regExpParser_char(receiver);
  if (ch === -1) {
    regExpParser_error(receiver, Undetermined_character_escape, regExpParser_pos(receiver) - 1, 1);
    return "\\";
  }
  if (ch === "c".codePointAt(0)!) {
    regExpParser_incPos(receiver, 1);
    const ctrlCh = regExpParser_char(receiver);
    if (stringutil.IsASCIILetter(ctrlCh)) {
      regExpParser_incPos(receiver, 1);
      return stringFromRune(ctrlCh & 0x1f);
    }
    if (receiver!.anyUnicodeModeOrNonAnnexB) {
      regExpParser_error(receiver, X_c_must_be_followed_by_an_ASCII_letter, regExpParser_pos(receiver) - 2, 2);
    } else if (atomEscape) {
      regExpParser_incPos(receiver, -1);
      return "\\";
    }
    return stringFromRune(ctrlCh);
  }
  if (
    ch === "^".codePointAt(0)! ||
    ch === "$".codePointAt(0)! ||
    ch === "/".codePointAt(0)! ||
    ch === "\\".codePointAt(0)! ||
    ch === ".".codePointAt(0)! ||
    ch === "*".codePointAt(0)! ||
    ch === "+".codePointAt(0)! ||
    ch === "?".codePointAt(0)! ||
    ch === "(".codePointAt(0)! ||
    ch === ")".codePointAt(0)! ||
    ch === "[".codePointAt(0)! ||
    ch === "]".codePointAt(0)! ||
    ch === "{".codePointAt(0)! ||
    ch === "}".codePointAt(0)! ||
    ch === "|".codePointAt(0)!
  ) {
    regExpParser_incPos(receiver, 1);
    return stringFromRune(ch);
  }
  regExpParser_incPos(receiver, -1); // back up to include the backslash for scanEscapeSequence
  let flags: EscapeSequenceScanningFlags = EscapeSequenceScanningFlagsRegularExpression;
  if (receiver!.annexB) {
    flags |= EscapeSequenceScanningFlagsAnnexB;
  }
  if (receiver!.anyUnicodeMode) {
    flags |= EscapeSequenceScanningFlagsAnyUnicodeMode;
  }
  if (atomEscape) {
    flags |= EscapeSequenceScanningFlagsAtomEscape;
  }
  return Scanner_scanEscapeSequence(receiver!.scanner, flags);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanGroupName","kind":"method","status":"implemented","sigHash":"320d5fd12bf09936eefd4022d0b5b66c909f7f8deb1a339446af98cdcc3f8d60","bodyHash":"0adac641694beae598f76bca933838cf34329f056cf7bc41576bfa6df84d16d3"}
 *
 * Go source:
 * func (p *regExpParser) scanGroupName(isReference bool) {
 * 	debug.Assert(p.pos() > 0 && p.text()[p.pos()-1] == '<')
 * 	p.scanner.tokenStart = p.pos()
 * 	p.scanner.scanIdentifier(0)
 * 	if p.pos() == p.scanner.tokenStart {
 * 		p.error(diagnostics.Expected_a_capturing_group_name, p.pos(), 0)
 * 	} else if isReference {
 * 		p.groupNameReferences = append(p.groupNameReferences, groupNameReference{pos: p.scanner.tokenStart, end: p.pos(), name: p.scanner.tokenValue})
 * 	} else if p.namedCapturingGroupsContains(p.scanner.tokenValue) {
 * 		p.error(diagnostics.Named_capturing_groups_with_the_same_name_must_be_mutually_exclusive_to_each_other, p.scanner.tokenStart, p.pos()-p.scanner.tokenStart)
 * 	} else {
 * 		if len(p.namedCapturingGroups) > 0 {
 * 			p.namedCapturingGroups[len(p.namedCapturingGroups)-1][p.scanner.tokenValue] = true
 * 		}
 * 		p.groupSpecifiers[p.scanner.tokenValue] = true
 * 	}
 * }
 */
export function regExpParser_scanGroupName(receiver: GoPtr<regExpParser>, isReference: bool): void {
  debug.Assert(regExpParser_pos(receiver) > 0 && byteAt(regExpParser_text(receiver), regExpParser_pos(receiver) - 1) === "<".codePointAt(0)!);
  receiver!.scanner!.__tsgoEmbedded0!.tokenStart = regExpParser_pos(receiver);
  Scanner_scanIdentifier(receiver!.scanner, 0);
  if (regExpParser_pos(receiver) === receiver!.scanner!.__tsgoEmbedded0!.tokenStart) {
    regExpParser_error(receiver, Expected_a_capturing_group_name, regExpParser_pos(receiver), 0);
  } else if (isReference) {
    receiver!.groupNameReferences = [
      ...receiver!.groupNameReferences,
      {
        pos: receiver!.scanner!.__tsgoEmbedded0!.tokenStart,
        end: regExpParser_pos(receiver),
        name: receiver!.scanner!.__tsgoEmbedded0!.tokenValue,
      },
    ];
  } else if (regExpParser_namedCapturingGroupsContains(receiver, receiver!.scanner!.__tsgoEmbedded0!.tokenValue)) {
    regExpParser_error(
      receiver,
      Named_capturing_groups_with_the_same_name_must_be_mutually_exclusive_to_each_other,
      receiver!.scanner!.__tsgoEmbedded0!.tokenStart,
      regExpParser_pos(receiver) - receiver!.scanner!.__tsgoEmbedded0!.tokenStart,
    );
  } else {
    if (receiver!.namedCapturingGroups.length > 0) {
      receiver!.namedCapturingGroups[receiver!.namedCapturingGroups.length - 1]!.set(
        receiver!.scanner!.__tsgoEmbedded0!.tokenValue,
        true,
      );
    }
    receiver!.groupSpecifiers.set(receiver!.scanner!.__tsgoEmbedded0!.tokenValue, true);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.namedCapturingGroupsContains","kind":"method","status":"implemented","sigHash":"006df0bdfeac3e6a8724aeabb98602dc3f29e9ed8ecd2094ced5ef47f4eb921e","bodyHash":"18cc8f910a47f8ba4f389ab8f467a2b37fdc1fdc658a1887cc34155b614a862c"}
 *
 * Go source:
 * func (p *regExpParser) namedCapturingGroupsContains(name string) bool {
 * 	for _, group := range p.namedCapturingGroups {
 * 		if group[name] {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function regExpParser_namedCapturingGroupsContains(receiver: GoPtr<regExpParser>, name: string): bool {
  for (const group of receiver!.namedCapturingGroups) {
    if (group.get(name) === true) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.isClassContentExit","kind":"method","status":"implemented","sigHash":"5d631edfe8def583138bf66fe276d348e52df1c4eef4557ea82c6102cccb76e9","bodyHash":"f92ba9560004fd4481ee91ccfcccb2e63d23b72b0d1e718317a0876a016932de"}
 *
 * Go source:
 * func (p *regExpParser) isClassContentExit(ch rune) bool {
 * 	return ch == ']' || p.pos() >= p.end
 * }
 */
export function regExpParser_isClassContentExit(receiver: GoPtr<regExpParser>, ch: GoRune): bool {
  return ch === "]".codePointAt(0)! || regExpParser_pos(receiver) >= receiver!.end;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanClassRanges","kind":"method","status":"implemented","sigHash":"f7bcabf986710d45aeb12c850faf420b68c5d3d4ea5c108c5ec09242de1198ad","bodyHash":"35cce273bc802b68f56bccd6a79c0ff5941ca326502f8522ad4e907e0a0806a8"}
 *
 * Go source:
 * func (p *regExpParser) scanClassRanges() {
 * 	debug.Assert(p.pos() > 0 && p.text()[p.pos()-1] == '[')
 * 	p.pendingLowSurrogate = 0
 * 	if p.char() == '^' {
 * 		p.incPos(1)
 * 	}
 * 	for p.pos() < p.end {
 * 		ch := p.char()
 * 		if p.isClassContentExit(ch) {
 * 			return
 * 		}
 * 		minStart := p.pos()
 * 		minCharacter := p.scanClassAtom()
 * 		if p.char() == '-' {
 * 			p.incPos(1)
 * 			ch = p.char()
 * 			if p.isClassContentExit(ch) {
 * 				return
 * 			}
 * 			if minCharacter == "" && p.anyUnicodeModeOrNonAnnexB {
 * 				p.error(diagnostics.A_character_class_range_must_not_be_bounded_by_another_character_class, minStart, p.pos()-1-minStart)
 * 			}
 * 			maxStart := p.pos()
 * 			maxCharacter := p.scanClassAtom()
 * 			if maxCharacter == "" && p.anyUnicodeModeOrNonAnnexB {
 * 				p.error(diagnostics.A_character_class_range_must_not_be_bounded_by_another_character_class, maxStart, p.pos()-maxStart)
 * 				continue
 * 			}
 * 			if minCharacter == "" {
 * 				continue
 * 			}
 * 			minCharacterValue, minSize := stringutil.DecodeJSStringRune(minCharacter)
 * 			maxCharacterValue, maxSize := stringutil.DecodeJSStringRune(maxCharacter)
 * 			if len(minCharacter) == minSize && len(maxCharacter) == maxSize && minCharacterValue > maxCharacterValue {
 * 				p.error(diagnostics.Range_out_of_order_in_character_class, minStart, p.pos()-minStart)
 * 			}
 * 		}
 * 	}
 * }
 */
export function regExpParser_scanClassRanges(receiver: GoPtr<regExpParser>): void {
  debug.Assert(regExpParser_pos(receiver) > 0 && byteAt(regExpParser_text(receiver), regExpParser_pos(receiver) - 1) === "[".codePointAt(0)!);
  receiver!.pendingLowSurrogate = 0;
  if (regExpParser_char(receiver) === "^".codePointAt(0)!) {
    regExpParser_incPos(receiver, 1);
  }
  while (regExpParser_pos(receiver) < receiver!.end) {
    const ch = regExpParser_char(receiver);
    if (regExpParser_isClassContentExit(receiver, ch)) {
      return;
    }
    const minStart = regExpParser_pos(receiver);
    const minCharacter = regExpParser_scanClassAtom(receiver);
    if (regExpParser_char(receiver) === "-".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      const dashCh = regExpParser_char(receiver);
      if (regExpParser_isClassContentExit(receiver, dashCh)) {
        return;
      }
      if (minCharacter === "" && receiver!.anyUnicodeModeOrNonAnnexB) {
        regExpParser_error(
          receiver,
          A_character_class_range_must_not_be_bounded_by_another_character_class,
          minStart,
          regExpParser_pos(receiver) - 1 - minStart,
        );
      }
      const maxStart = regExpParser_pos(receiver);
      const maxCharacter = regExpParser_scanClassAtom(receiver);
      if (maxCharacter === "" && receiver!.anyUnicodeModeOrNonAnnexB) {
        regExpParser_error(
          receiver,
          A_character_class_range_must_not_be_bounded_by_another_character_class,
          maxStart,
          regExpParser_pos(receiver) - maxStart,
        );
        continue;
      }
      if (minCharacter === "") {
        continue;
      }
      const [minCharacterValue, minSize] = DecodeJSStringRune(minCharacter);
      const [maxCharacterValue, maxSize] = DecodeJSStringRune(maxCharacter);
      if (
        byteLen(minCharacter) === minSize &&
        byteLen(maxCharacter) === maxSize &&
        minCharacterValue > maxCharacterValue
      ) {
        regExpParser_error(
          receiver,
          Range_out_of_order_in_character_class,
          minStart,
          regExpParser_pos(receiver) - minStart,
        );
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanClassSetExpression","kind":"method","status":"implemented","sigHash":"dd5fdcc7a108cff164185462aa3735e64e2014ac82f2717e9e09b2f5d8ad25b2","bodyHash":"35c8efa6d603b16581a36206d0025dbc3a68142a17887a9b73b22e6f87913bbe"}
 *
 * Go source:
 * func (p *regExpParser) scanClassSetExpression() {
 * 	debug.Assert(p.pos() > 0 && p.text()[p.pos()-1] == '[')
 * 	isCharacterComplement := false
 * 	if p.char() == '^' {
 * 		p.incPos(1)
 * 		isCharacterComplement = true
 * 	}
 * 	expressionMayContainStrings := false
 * 	ch := p.char()
 * 	if p.isClassContentExit(ch) {
 * 		return
 * 	}
 * 	start := p.pos()
 * 	var operand string
 * 	twoChars := ""
 * 	if p.pos()+1 < p.end {
 * 		twoChars = p.text()[p.pos() : p.pos()+2]
 * 	}
 * 	switch twoChars {
 * 	case "--", "&&":
 * 		p.error(diagnostics.Expected_a_class_set_operand, p.pos(), 0)
 * 		p.mayContainStrings = false
 * 	default:
 * 		operand = p.scanClassSetOperand()
 * 	}
 * 	switch p.char() {
 * 	case '-':
 * 		if p.pos()+1 < p.end && p.charAt(p.pos()+1) == '-' {
 * 			if isCharacterComplement && p.mayContainStrings {
 * 				p.error(diagnostics.Anything_that_would_possibly_match_more_than_a_single_character_is_invalid_inside_a_negated_character_class, start, p.pos()-start)
 * 			}
 * 			expressionMayContainStrings = p.mayContainStrings
 * 			p.scanClassSetSubExpression(classSetExpressionTypeClassSubtraction)
 * 			p.mayContainStrings = !isCharacterComplement && expressionMayContainStrings
 * 			return
 * 		}
 * 	case '&':
 * 		if p.pos()+1 < p.end && p.charAt(p.pos()+1) == '&' {
 * 			p.scanClassSetSubExpression(classSetExpressionTypeClassIntersection)
 * 			if isCharacterComplement && p.mayContainStrings {
 * 				p.error(diagnostics.Anything_that_would_possibly_match_more_than_a_single_character_is_invalid_inside_a_negated_character_class, start, p.pos()-start)
 * 			}
 * 			expressionMayContainStrings = p.mayContainStrings
 * 			p.mayContainStrings = !isCharacterComplement && expressionMayContainStrings
 * 			return
 * 		} else {
 * 			p.error(diagnostics.Unexpected_0_Did_you_mean_to_escape_it_with_backslash, p.pos(), 1, string(ch))
 * 		}
 * 	default:
 * 		if isCharacterComplement && p.mayContainStrings {
 * 			p.error(diagnostics.Anything_that_would_possibly_match_more_than_a_single_character_is_invalid_inside_a_negated_character_class, start, p.pos()-start)
 * 		}
 * 		expressionMayContainStrings = p.mayContainStrings
 * 	}
 * 	for p.pos() < p.end {
 * 		ch = p.char()
 * 		switch ch {
 * 		case '-':
 * 			p.incPos(1)
 * 			ch = p.char()
 * 			if p.isClassContentExit(ch) {
 * 				p.mayContainStrings = !isCharacterComplement && expressionMayContainStrings
 * 				return
 * 			}
 * 			if ch == '-' {
 * 				p.incPos(1)
 * 				p.error(diagnostics.Operators_must_not_be_mixed_within_a_character_class_Wrap_it_in_a_nested_class_instead, p.pos()-2, 2)
 * 				start = p.pos() - 2
 * 				operand = p.text()[start:p.pos()]
 * 				continue
 * 			} else {
 * 				if operand == "" {
 * 					p.error(diagnostics.A_character_class_range_must_not_be_bounded_by_another_character_class, start, p.pos()-1-start)
 * 				}
 * 				secondStart := p.pos()
 * 				secondOperand := p.scanClassSetOperand()
 * 				if isCharacterComplement && p.mayContainStrings {
 * 					p.error(diagnostics.Anything_that_would_possibly_match_more_than_a_single_character_is_invalid_inside_a_negated_character_class, secondStart, p.pos()-secondStart)
 * 				}
 * 				expressionMayContainStrings = expressionMayContainStrings || p.mayContainStrings
 * 				if secondOperand == "" {
 * 					p.error(diagnostics.A_character_class_range_must_not_be_bounded_by_another_character_class, secondStart, p.pos()-secondStart)
 * 				} else if operand != "" {
 * 					minCharacterValue, minSize := stringutil.DecodeJSStringRune(operand)
 * 					maxCharacterValue, maxSize := stringutil.DecodeJSStringRune(secondOperand)
 * 					if len(operand) == minSize && len(secondOperand) == maxSize && minCharacterValue > maxCharacterValue {
 * 						p.error(diagnostics.Range_out_of_order_in_character_class, start, p.pos()-start)
 * 					}
 * 				}
 * 			}
 * 		case '&':
 * 			start = p.pos()
 * 			p.incPos(1)
 * 			if p.char() == '&' {
 * 				p.incPos(1)
 * 				p.error(diagnostics.Operators_must_not_be_mixed_within_a_character_class_Wrap_it_in_a_nested_class_instead, p.pos()-2, 2)
 * 				if p.char() == '&' {
 * 					p.error(diagnostics.Unexpected_0_Did_you_mean_to_escape_it_with_backslash, p.pos(), 1, string(ch))
 * 					p.incPos(1)
 * 				}
 * 			} else {
 * 				p.error(diagnostics.Unexpected_0_Did_you_mean_to_escape_it_with_backslash, p.pos()-1, 1, string(ch))
 * 			}
 * 			operand = p.text()[start:p.pos()]
 * 			continue
 * 		}
 * 		if p.isClassContentExit(p.char()) {
 * 			break
 * 		}
 * 		start = p.pos()
 * 		twoChars = ""
 * 		if p.pos()+1 < p.end {
 * 			twoChars = p.text()[p.pos() : p.pos()+2]
 * 		}
 * 		switch twoChars {
 * 		case "--", "&&":
 * 			p.error(diagnostics.Operators_must_not_be_mixed_within_a_character_class_Wrap_it_in_a_nested_class_instead, p.pos(), 2)
 * 			p.incPos(2)
 * 			operand = p.text()[start:p.pos()]
 * 		default:
 * 			operand = p.scanClassSetOperand()
 * 		}
 * 	}
 * 	p.mayContainStrings = !isCharacterComplement && expressionMayContainStrings
 * }
 */
export function regExpParser_scanClassSetExpression(receiver: GoPtr<regExpParser>): void {
  debug.Assert(regExpParser_pos(receiver) > 0 && byteAt(regExpParser_text(receiver), regExpParser_pos(receiver) - 1) === "[".codePointAt(0)!);
  let isCharacterComplement: bool = false;
  if (regExpParser_char(receiver) === "^".codePointAt(0)!) {
    regExpParser_incPos(receiver, 1);
    isCharacterComplement = true;
  }
  let expressionMayContainStrings: bool = false;
  const ch0 = regExpParser_char(receiver);
  if (regExpParser_isClassContentExit(receiver, ch0)) {
    return;
  }
  let start = regExpParser_pos(receiver);
  let operand = "";
  let twoChars = "";
  if (regExpParser_pos(receiver) + 1 < receiver!.end) {
    twoChars = byteSlice(regExpParser_text(receiver), regExpParser_pos(receiver), regExpParser_pos(receiver) + 2);
  }
  if (twoChars === "--" || twoChars === "&&") {
    regExpParser_error(receiver, Expected_a_class_set_operand, regExpParser_pos(receiver), 0);
    receiver!.mayContainStrings = false;
  } else {
    operand = regExpParser_scanClassSetOperand(receiver);
  }
  const firstCh = regExpParser_char(receiver);
  if (firstCh === "-".codePointAt(0)!) {
    if (regExpParser_pos(receiver) + 1 < receiver!.end && regExpParser_charAt(receiver, regExpParser_pos(receiver) + 1) === "-".codePointAt(0)!) {
      if (isCharacterComplement && receiver!.mayContainStrings) {
        regExpParser_error(
          receiver,
          Anything_that_would_possibly_match_more_than_a_single_character_is_invalid_inside_a_negated_character_class,
          start,
          regExpParser_pos(receiver) - start,
        );
      }
      expressionMayContainStrings = receiver!.mayContainStrings;
      regExpParser_scanClassSetSubExpression(receiver, classSetExpressionTypeClassSubtraction);
      receiver!.mayContainStrings = !isCharacterComplement && expressionMayContainStrings;
      return;
    }
  } else if (firstCh === "&".codePointAt(0)!) {
    if (regExpParser_pos(receiver) + 1 < receiver!.end && regExpParser_charAt(receiver, regExpParser_pos(receiver) + 1) === "&".codePointAt(0)!) {
      regExpParser_scanClassSetSubExpression(receiver, classSetExpressionTypeClassIntersection);
      if (isCharacterComplement && receiver!.mayContainStrings) {
        regExpParser_error(
          receiver,
          Anything_that_would_possibly_match_more_than_a_single_character_is_invalid_inside_a_negated_character_class,
          start,
          regExpParser_pos(receiver) - start,
        );
      }
      expressionMayContainStrings = receiver!.mayContainStrings;
      receiver!.mayContainStrings = !isCharacterComplement && expressionMayContainStrings;
      return;
    } else {
      regExpParser_error(
        receiver,
        Unexpected_0_Did_you_mean_to_escape_it_with_backslash,
        regExpParser_pos(receiver),
        1,
        stringFromRune(ch0),
      );
    }
  } else {
    if (isCharacterComplement && receiver!.mayContainStrings) {
      regExpParser_error(
        receiver,
        Anything_that_would_possibly_match_more_than_a_single_character_is_invalid_inside_a_negated_character_class,
        start,
        regExpParser_pos(receiver) - start,
      );
    }
    expressionMayContainStrings = receiver!.mayContainStrings;
  }
  while (regExpParser_pos(receiver) < receiver!.end) {
    let ch = regExpParser_char(receiver);
    let loopContinue: bool = false;
    if (ch === "-".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      ch = regExpParser_char(receiver);
      if (regExpParser_isClassContentExit(receiver, ch)) {
        receiver!.mayContainStrings = !isCharacterComplement && expressionMayContainStrings;
        return;
      }
      if (ch === "-".codePointAt(0)!) {
        regExpParser_incPos(receiver, 1);
        regExpParser_error(
          receiver,
          Operators_must_not_be_mixed_within_a_character_class_Wrap_it_in_a_nested_class_instead,
          regExpParser_pos(receiver) - 2,
          2,
        );
        start = regExpParser_pos(receiver) - 2;
        operand = byteSlice(regExpParser_text(receiver), start, regExpParser_pos(receiver));
        loopContinue = true;
      } else {
        if (operand === "") {
          regExpParser_error(
            receiver,
            A_character_class_range_must_not_be_bounded_by_another_character_class,
            start,
            regExpParser_pos(receiver) - 1 - start,
          );
        }
        const secondStart = regExpParser_pos(receiver);
        const secondOperand = regExpParser_scanClassSetOperand(receiver);
        if (isCharacterComplement && receiver!.mayContainStrings) {
          regExpParser_error(
            receiver,
            Anything_that_would_possibly_match_more_than_a_single_character_is_invalid_inside_a_negated_character_class,
            secondStart,
            regExpParser_pos(receiver) - secondStart,
          );
        }
        expressionMayContainStrings = expressionMayContainStrings || receiver!.mayContainStrings;
        if (secondOperand === "") {
          regExpParser_error(
            receiver,
            A_character_class_range_must_not_be_bounded_by_another_character_class,
            secondStart,
            regExpParser_pos(receiver) - secondStart,
          );
        } else if (operand !== "") {
          const [minCharacterValue, minSize] = DecodeJSStringRune(operand);
          const [maxCharacterValue, maxSize] = DecodeJSStringRune(secondOperand);
          if (
            byteLen(operand) === minSize &&
            byteLen(secondOperand) === maxSize &&
            minCharacterValue > maxCharacterValue
          ) {
            regExpParser_error(
              receiver,
              Range_out_of_order_in_character_class,
              start,
              regExpParser_pos(receiver) - start,
            );
          }
        }
      }
    } else if (ch === "&".codePointAt(0)!) {
      start = regExpParser_pos(receiver);
      regExpParser_incPos(receiver, 1);
      if (regExpParser_char(receiver) === "&".codePointAt(0)!) {
        regExpParser_incPos(receiver, 1);
        regExpParser_error(
          receiver,
          Operators_must_not_be_mixed_within_a_character_class_Wrap_it_in_a_nested_class_instead,
          regExpParser_pos(receiver) - 2,
          2,
        );
        if (regExpParser_char(receiver) === "&".codePointAt(0)!) {
          regExpParser_error(
            receiver,
            Unexpected_0_Did_you_mean_to_escape_it_with_backslash,
            regExpParser_pos(receiver),
            1,
            stringFromRune(ch),
          );
          regExpParser_incPos(receiver, 1);
        }
      } else {
        regExpParser_error(
          receiver,
          Unexpected_0_Did_you_mean_to_escape_it_with_backslash,
          regExpParser_pos(receiver) - 1,
          1,
          stringFromRune(ch),
        );
      }
      operand = byteSlice(regExpParser_text(receiver), start, regExpParser_pos(receiver));
      loopContinue = true;
    }
    if (loopContinue) {
      continue;
    }
    if (regExpParser_isClassContentExit(receiver, regExpParser_char(receiver))) {
      break;
    }
    start = regExpParser_pos(receiver);
    twoChars = "";
    if (regExpParser_pos(receiver) + 1 < receiver!.end) {
      twoChars = byteSlice(regExpParser_text(receiver), regExpParser_pos(receiver), regExpParser_pos(receiver) + 2);
    }
    if (twoChars === "--" || twoChars === "&&") {
      regExpParser_error(
        receiver,
        Operators_must_not_be_mixed_within_a_character_class_Wrap_it_in_a_nested_class_instead,
        regExpParser_pos(receiver),
        2,
      );
      regExpParser_incPos(receiver, 2);
      operand = byteSlice(regExpParser_text(receiver), start, regExpParser_pos(receiver));
    } else {
      operand = regExpParser_scanClassSetOperand(receiver);
    }
  }
  receiver!.mayContainStrings = !isCharacterComplement && expressionMayContainStrings;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanClassSetSubExpression","kind":"method","status":"implemented","sigHash":"eea8aab0d5f477821bbd08d8d0252af9c2bec6b4992c739bf75cd5fc79500420","bodyHash":"dcd5911ade4fabe99ad9f8e61b566f21042919406fa673768f4f3862a91d83c7"}
 *
 * Go source:
 * func (p *regExpParser) scanClassSetSubExpression(expressionType classSetExpressionType) {
 * 	expressionMayContainStrings := p.mayContainStrings
 * 	for p.pos() < p.end {
 * 		ch := p.char()
 * 		if p.isClassContentExit(ch) {
 * 			break
 * 		}
 * 		switch ch {
 * 		case '-':
 * 			p.incPos(1)
 * 			if p.char() == '-' {
 * 				p.incPos(1)
 * 				if expressionType != classSetExpressionTypeClassSubtraction {
 * 					p.error(diagnostics.Operators_must_not_be_mixed_within_a_character_class_Wrap_it_in_a_nested_class_instead, p.pos()-2, 2)
 * 				}
 * 			} else {
 * 				p.error(diagnostics.Operators_must_not_be_mixed_within_a_character_class_Wrap_it_in_a_nested_class_instead, p.pos()-1, 1)
 * 			}
 * 		case '&':
 * 			p.incPos(1)
 * 			if p.char() == '&' {
 * 				p.incPos(1)
 * 				if expressionType != classSetExpressionTypeClassIntersection {
 * 					p.error(diagnostics.Operators_must_not_be_mixed_within_a_character_class_Wrap_it_in_a_nested_class_instead, p.pos()-2, 2)
 * 				}
 * 				if p.char() == '&' {
 * 					p.error(diagnostics.Unexpected_0_Did_you_mean_to_escape_it_with_backslash, p.pos(), 1, string(ch))
 * 					p.incPos(1)
 * 				}
 * 			} else {
 * 				p.error(diagnostics.Unexpected_0_Did_you_mean_to_escape_it_with_backslash, p.pos()-1, 1, string(ch))
 * 			}
 * 		default:
 * 			switch expressionType {
 * 			case classSetExpressionTypeClassSubtraction:
 * 				p.error(diagnostics.X_0_expected, p.pos(), 0, "--")
 * 			case classSetExpressionTypeClassIntersection:
 * 				p.error(diagnostics.X_0_expected, p.pos(), 0, "&&")
 * 			}
 * 		}
 * 		ch = p.char()
 * 		if p.isClassContentExit(ch) {
 * 			p.error(diagnostics.Expected_a_class_set_operand, p.pos(), 0)
 * 			break
 * 		}
 * 		p.scanClassSetOperand()
 * 		if expressionType == classSetExpressionTypeClassIntersection {
 * 			expressionMayContainStrings = expressionMayContainStrings && p.mayContainStrings
 * 		}
 * 	}
 * 	p.mayContainStrings = expressionMayContainStrings
 * }
 */
export function regExpParser_scanClassSetSubExpression(receiver: GoPtr<regExpParser>, expressionType: classSetExpressionType): void {
  let expressionMayContainStrings: bool = receiver!.mayContainStrings;
  while (regExpParser_pos(receiver) < receiver!.end) {
    let ch = regExpParser_char(receiver);
    if (regExpParser_isClassContentExit(receiver, ch)) {
      break;
    }
    if (ch === "-".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      if (regExpParser_char(receiver) === "-".codePointAt(0)!) {
        regExpParser_incPos(receiver, 1);
        if (expressionType !== classSetExpressionTypeClassSubtraction) {
          regExpParser_error(
            receiver,
            Operators_must_not_be_mixed_within_a_character_class_Wrap_it_in_a_nested_class_instead,
            regExpParser_pos(receiver) - 2,
            2,
          );
        }
      } else {
        regExpParser_error(
          receiver,
          Operators_must_not_be_mixed_within_a_character_class_Wrap_it_in_a_nested_class_instead,
          regExpParser_pos(receiver) - 1,
          1,
        );
      }
    } else if (ch === "&".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      if (regExpParser_char(receiver) === "&".codePointAt(0)!) {
        regExpParser_incPos(receiver, 1);
        if (expressionType !== classSetExpressionTypeClassIntersection) {
          regExpParser_error(
            receiver,
            Operators_must_not_be_mixed_within_a_character_class_Wrap_it_in_a_nested_class_instead,
            regExpParser_pos(receiver) - 2,
            2,
          );
        }
        if (regExpParser_char(receiver) === "&".codePointAt(0)!) {
          regExpParser_error(
            receiver,
            Unexpected_0_Did_you_mean_to_escape_it_with_backslash,
            regExpParser_pos(receiver),
            1,
            stringFromRune(ch),
          );
          regExpParser_incPos(receiver, 1);
        }
      } else {
        regExpParser_error(
          receiver,
          Unexpected_0_Did_you_mean_to_escape_it_with_backslash,
          regExpParser_pos(receiver) - 1,
          1,
          stringFromRune(ch),
        );
      }
    } else {
      if (expressionType === classSetExpressionTypeClassSubtraction) {
        regExpParser_error(receiver, X_0_expected, regExpParser_pos(receiver), 0, "--");
      } else if (expressionType === classSetExpressionTypeClassIntersection) {
        regExpParser_error(receiver, X_0_expected, regExpParser_pos(receiver), 0, "&&");
      }
    }
    ch = regExpParser_char(receiver);
    if (regExpParser_isClassContentExit(receiver, ch)) {
      regExpParser_error(receiver, Expected_a_class_set_operand, regExpParser_pos(receiver), 0);
      break;
    }
    regExpParser_scanClassSetOperand(receiver);
    if (expressionType === classSetExpressionTypeClassIntersection) {
      expressionMayContainStrings = expressionMayContainStrings && receiver!.mayContainStrings;
    }
  }
  receiver!.mayContainStrings = expressionMayContainStrings;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanClassSetOperand","kind":"method","status":"implemented","sigHash":"dee0167068649da805a5d7d9ee53d4b8e96ad6e652c01ed25e2fd5f51b65c923","bodyHash":"68660ed447eedfd532e16ab6631aed1d9dcc382565e54f4cf21983f12e2b3615"}
 *
 * Go source:
 * func (p *regExpParser) scanClassSetOperand() string {
 * 	p.mayContainStrings = false
 * 	switch p.char() {
 * 	case '[':
 * 		p.incPos(1)
 * 		p.scanClassSetExpression()
 * 		p.scanExpectedChar(']')
 * 		return ""
 * 	case '\\':
 * 		p.incPos(1)
 * 		if p.scanCharacterClassEscape() {
 * 			return ""
 * 		} else if p.char() == 'q' {
 * 			p.incPos(1)
 * 			if p.char() == '{' {
 * 				p.incPos(1)
 * 				p.scanClassStringDisjunctionContents()
 * 				p.scanExpectedChar('}')
 * 				return ""
 * 			} else {
 * 				p.error(diagnostics.X_q_must_be_followed_by_string_alternatives_enclosed_in_braces, p.pos()-2, 2)
 * 				return "q"
 * 			}
 * 		}
 * 		p.incPos(-1)
 * 		fallthrough
 * 	default:
 * 		return p.scanClassSetCharacter()
 * 	}
 * }
 */
export function regExpParser_scanClassSetOperand(receiver: GoPtr<regExpParser>): string {
  receiver!.mayContainStrings = false;
  const ch = regExpParser_char(receiver);
  if (ch === "[".codePointAt(0)!) {
    regExpParser_incPos(receiver, 1);
    regExpParser_scanClassSetExpression(receiver);
    regExpParser_scanExpectedChar(receiver, "]".codePointAt(0)!);
    return "";
  }
  if (ch === "\\".codePointAt(0)!) {
    regExpParser_incPos(receiver, 1);
    if (regExpParser_scanCharacterClassEscape(receiver)) {
      return "";
    } else if (regExpParser_char(receiver) === "q".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      if (regExpParser_char(receiver) === "{".codePointAt(0)!) {
        regExpParser_incPos(receiver, 1);
        regExpParser_scanClassStringDisjunctionContents(receiver);
        regExpParser_scanExpectedChar(receiver, "}".codePointAt(0)!);
        return "";
      } else {
        regExpParser_error(receiver, X_q_must_be_followed_by_string_alternatives_enclosed_in_braces, regExpParser_pos(receiver) - 2, 2);
        return "q";
      }
    }
    regExpParser_incPos(receiver, -1);
    // fallthrough to default
  }
  // default (also reached via fallthrough from the '\\' case)
  return regExpParser_scanClassSetCharacter(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanClassStringDisjunctionContents","kind":"method","status":"implemented","sigHash":"914082b50d1bfff6e928c6b13d07535a68fa5d1c807034a8568fe2f9db9ff552","bodyHash":"a857d0f6d3e0c75ca42d45b3ca39fa425b96159f77460d4ce5d5cc1832543eaa"}
 *
 * Go source:
 * func (p *regExpParser) scanClassStringDisjunctionContents() {
 * 	debug.Assert(p.pos() > 0 && p.text()[p.pos()-1] == '{')
 * 	characterCount := 0
 * 	for p.pos() < p.end {
 * 		ch := p.char()
 * 		switch ch {
 * 		case '}':
 * 			if characterCount != 1 {
 * 				p.mayContainStrings = true
 * 			}
 * 			return
 * 		case '|':
 * 			if characterCount != 1 {
 * 				p.mayContainStrings = true
 * 			}
 * 			p.incPos(1)
 * 			characterCount = 0
 * 		default:
 * 			p.scanClassSetCharacter()
 * 			characterCount++
 * 		}
 * 	}
 * }
 */
export function regExpParser_scanClassStringDisjunctionContents(receiver: GoPtr<regExpParser>): void {
  debug.Assert(regExpParser_pos(receiver) > 0 && byteAt(regExpParser_text(receiver), regExpParser_pos(receiver) - 1) === "{".codePointAt(0)!);
  let characterCount: int = 0;
  while (regExpParser_pos(receiver) < receiver!.end) {
    const ch = regExpParser_char(receiver);
    if (ch === "}".codePointAt(0)!) {
      if (characterCount !== 1) {
        receiver!.mayContainStrings = true;
      }
      return;
    } else if (ch === "|".codePointAt(0)!) {
      if (characterCount !== 1) {
        receiver!.mayContainStrings = true;
      }
      regExpParser_incPos(receiver, 1);
      characterCount = 0;
    } else {
      regExpParser_scanClassSetCharacter(receiver);
      characterCount++;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanClassSetCharacter","kind":"method","status":"implemented","sigHash":"4a655c7ae13d346b34822f8fd6c773436d4ca775b3006a52266014a28ae7a8d6","bodyHash":"ee34a2f2c3541245898e219d657545793034533faf2e9a6d68c0efb9d6e245a2"}
 *
 * Go source:
 * func (p *regExpParser) scanClassSetCharacter() string {
 * 	ch := p.char()
 * 	if ch == '\\' {
 * 		p.incPos(1)
 * 		innerCh := p.char()
 * 		switch innerCh {
 * 		case 'b':
 * 			p.incPos(1)
 * 			return "\b"
 * 		case '&', '-', '!', '#', '%', ',', ':', ';', '<', '=', '>', '@', '`', '~':
 * 			p.incPos(1)
 * 			return string(innerCh)
 * 		default:
 * 			return p.scanCharacterEscape(false /*atomEscape* /)
 * 		}
 * 	} else if p.pos()+1 < p.end && ch == p.charAt(p.pos()+1) {
 * 		switch ch {
 * 		case '&', '!', '#', '%', '*', '+', ',', '.', ':', ';', '<', '=', '>', '?', '@', '`', '~':
 * 			p.error(diagnostics.A_character_class_must_not_contain_a_reserved_double_punctuator_Did_you_mean_to_escape_it_with_backslash, p.pos(), 2)
 * 			p.incPos(2)
 * 			return p.text()[p.pos()-2 : p.pos()]
 * 		}
 * 	}
 * 	switch ch {
 * 	case '/', '(', ')', '[', ']', '{', '}', '-', '|':
 * 		p.error(diagnostics.Unexpected_0_Did_you_mean_to_escape_it_with_backslash, p.pos(), 1, string(ch))
 * 		p.incPos(1)
 * 		return string(ch)
 * 	}
 * 	return p.scanSourceCharacter()
 * }
 */
export function regExpParser_scanClassSetCharacter(receiver: GoPtr<regExpParser>): string {
  const ch = regExpParser_char(receiver);
  if (ch === "\\".codePointAt(0)!) {
    regExpParser_incPos(receiver, 1);
    const innerCh = regExpParser_char(receiver);
    if (innerCh === "b".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      return "\b";
    }
    if (
      innerCh === "&".codePointAt(0)! ||
      innerCh === "-".codePointAt(0)! ||
      innerCh === "!".codePointAt(0)! ||
      innerCh === "#".codePointAt(0)! ||
      innerCh === "%".codePointAt(0)! ||
      innerCh === ",".codePointAt(0)! ||
      innerCh === ":".codePointAt(0)! ||
      innerCh === ";".codePointAt(0)! ||
      innerCh === "<".codePointAt(0)! ||
      innerCh === "=".codePointAt(0)! ||
      innerCh === ">".codePointAt(0)! ||
      innerCh === "@".codePointAt(0)! ||
      innerCh === "`".codePointAt(0)! ||
      innerCh === "~".codePointAt(0)!
    ) {
      regExpParser_incPos(receiver, 1);
      return stringFromRune(innerCh);
    }
    return regExpParser_scanCharacterEscape(receiver, false /*atomEscape*/);
  } else if (regExpParser_pos(receiver) + 1 < receiver!.end && ch === regExpParser_charAt(receiver, regExpParser_pos(receiver) + 1)) {
    if (
      ch === "&".codePointAt(0)! ||
      ch === "!".codePointAt(0)! ||
      ch === "#".codePointAt(0)! ||
      ch === "%".codePointAt(0)! ||
      ch === "*".codePointAt(0)! ||
      ch === "+".codePointAt(0)! ||
      ch === ",".codePointAt(0)! ||
      ch === ".".codePointAt(0)! ||
      ch === ":".codePointAt(0)! ||
      ch === ";".codePointAt(0)! ||
      ch === "<".codePointAt(0)! ||
      ch === "=".codePointAt(0)! ||
      ch === ">".codePointAt(0)! ||
      ch === "?".codePointAt(0)! ||
      ch === "@".codePointAt(0)! ||
      ch === "`".codePointAt(0)! ||
      ch === "~".codePointAt(0)!
    ) {
      regExpParser_error(
        receiver,
        A_character_class_must_not_contain_a_reserved_double_punctuator_Did_you_mean_to_escape_it_with_backslash,
        regExpParser_pos(receiver),
        2,
      );
      regExpParser_incPos(receiver, 2);
      return byteSlice(regExpParser_text(receiver), regExpParser_pos(receiver) - 2, regExpParser_pos(receiver));
    }
  }
  if (
    ch === "/".codePointAt(0)! ||
    ch === "(".codePointAt(0)! ||
    ch === ")".codePointAt(0)! ||
    ch === "[".codePointAt(0)! ||
    ch === "]".codePointAt(0)! ||
    ch === "{".codePointAt(0)! ||
    ch === "}".codePointAt(0)! ||
    ch === "-".codePointAt(0)! ||
    ch === "|".codePointAt(0)!
  ) {
    regExpParser_error(
      receiver,
      Unexpected_0_Did_you_mean_to_escape_it_with_backslash,
      regExpParser_pos(receiver),
      1,
      stringFromRune(ch),
    );
    regExpParser_incPos(receiver, 1);
    return stringFromRune(ch);
  }
  return regExpParser_scanSourceCharacter(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanClassAtom","kind":"method","status":"implemented","sigHash":"46354b236d3936a3ce51ab49d507e646bfcb48a3f9131f76d811f82ffd336504","bodyHash":"2d02663134633cde9381bffbe4d4363ead4200f42f8f9e82e39d6f93c0ae4b95"}
 *
 * Go source:
 * func (p *regExpParser) scanClassAtom() string {
 * 	if p.char() == '\\' {
 * 		p.incPos(1)
 * 		ch := p.char()
 * 		switch ch {
 * 		case 'b':
 * 			p.incPos(1)
 * 			return "\b"
 * 		case '-':
 * 			p.incPos(1)
 * 			return string(ch)
 * 		default:
 * 			if p.scanCharacterClassEscape() {
 * 				return ""
 * 			}
 * 			return p.scanCharacterEscape(false /*atomEscape* /)
 * 		}
 * 	} else {
 * 		return p.scanSourceCharacter()
 * 	}
 * }
 */
export function regExpParser_scanClassAtom(receiver: GoPtr<regExpParser>): string {
  if (regExpParser_char(receiver) === "\\".codePointAt(0)!) {
    regExpParser_incPos(receiver, 1);
    const ch = regExpParser_char(receiver);
    if (ch === "b".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      return "\b";
    }
    if (ch === "-".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      return stringFromRune(ch);
    }
    if (regExpParser_scanCharacterClassEscape(receiver)) {
      return "";
    }
    return regExpParser_scanCharacterEscape(receiver, false /*atomEscape*/);
  } else {
    return regExpParser_scanSourceCharacter(receiver);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanCharacterClassEscape","kind":"method","status":"implemented","sigHash":"30922b31e906b75a790d501771f479c1886823a4959594728b420fd44d1da14a","bodyHash":"ea473fa286bbe2389511aa2e9f5906389f6e2a42ace08e0205b8e08f9222093c"}
 *
 * Go source:
 * func (p *regExpParser) scanCharacterClassEscape() bool {
 * 	debug.Assert(p.pos() > 0 && p.text()[p.pos()-1] == '\\')
 * 	isCharacterComplement := false
 * 	start := p.pos() - 1
 * 	ch := p.char()
 * 	switch ch {
 * 	case 'd', 'D', 's', 'S', 'w', 'W':
 * 		p.incPos(1)
 * 		return true
 * 	case 'P':
 * 		isCharacterComplement = true
 * 		fallthrough
 * 	case 'p':
 * 		p.incPos(1)
 * 		if p.char() == '{' {
 * 			p.incPos(1)
 * 			propertyNameOrValueStart := p.pos()
 * 			propertyNameOrValue := p.scanWordCharacters()
 * 			if p.char() == '=' {
 * 				propertyName := nonBinaryUnicodeProperties[propertyNameOrValue]
 * 				if p.pos() == propertyNameOrValueStart {
 * 					p.error(diagnostics.Expected_a_Unicode_property_name, p.pos(), 0)
 * 				} else if propertyName == "" {
 * 					p.error(diagnostics.Unknown_Unicode_property_name, propertyNameOrValueStart, p.pos()-propertyNameOrValueStart)
 * 					suggestion := p.getSpellingSuggestionForUnicodePropertyName(propertyNameOrValue)
 * 					if suggestion != "" {
 * 						p.error(diagnostics.Did_you_mean_0, propertyNameOrValueStart, p.pos()-propertyNameOrValueStart, suggestion)
 * 					}
 * 				}
 * 				p.incPos(1)
 * 				propertyValueStart := p.pos()
 * 				propertyValue := p.scanWordCharacters()
 * 				if p.pos() == propertyValueStart {
 * 					p.error(diagnostics.Expected_a_Unicode_property_value, p.pos(), 0)
 * 				} else if propertyName != "" {
 * 					values := valuesOfNonBinaryUnicodeProperties[propertyName]
 * 					if values != nil && !values.Has(propertyValue) {
 * 						p.error(diagnostics.Unknown_Unicode_property_value, propertyValueStart, p.pos()-propertyValueStart)
 * 						suggestion := p.getSpellingSuggestionForUnicodePropertyValue(propertyName, propertyValue)
 * 						if suggestion != "" {
 * 							p.error(diagnostics.Did_you_mean_0, propertyValueStart, p.pos()-propertyValueStart, suggestion)
 * 						}
 * 					}
 * 				}
 * 			} else {
 * 				if p.pos() == propertyNameOrValueStart {
 * 					p.error(diagnostics.Expected_a_Unicode_property_name_or_value, p.pos(), 0)
 * 				} else if binaryUnicodePropertiesOfStrings.Has(propertyNameOrValue) {
 * 					if !p.unicodeSetsMode {
 * 						p.error(diagnostics.Any_Unicode_property_that_would_possibly_match_more_than_a_single_character_is_only_available_when_the_Unicode_Sets_v_flag_is_set, propertyNameOrValueStart, p.pos()-propertyNameOrValueStart)
 * 					} else if isCharacterComplement {
 * 						p.error(diagnostics.Anything_that_would_possibly_match_more_than_a_single_character_is_invalid_inside_a_negated_character_class, propertyNameOrValueStart, p.pos()-propertyNameOrValueStart)
 * 					} else {
 * 						p.mayContainStrings = true
 * 					}
 * 				} else if !valuesOfNonBinaryUnicodeProperties["General_Category"].Has(propertyNameOrValue) && !binaryUnicodeProperties.Has(propertyNameOrValue) {
 * 					p.error(diagnostics.Unknown_Unicode_property_name_or_value, propertyNameOrValueStart, p.pos()-propertyNameOrValueStart)
 * 					suggestion := p.getSpellingSuggestionForUnicodePropertyNameOrValue(propertyNameOrValue)
 * 					if suggestion != "" {
 * 						p.error(diagnostics.Did_you_mean_0, propertyNameOrValueStart, p.pos()-propertyNameOrValueStart, suggestion)
 * 					}
 * 				}
 * 			}
 * 			p.scanExpectedChar('}')
 * 			if !p.anyUnicodeMode {
 * 				p.error(diagnostics.Unicode_property_value_expressions_are_only_available_when_the_Unicode_u_flag_or_the_Unicode_Sets_v_flag_is_set, start, p.pos()-start)
 * 			}
 * 		} else if p.anyUnicodeModeOrNonAnnexB {
 * 			p.error(diagnostics.X_0_must_be_followed_by_a_Unicode_property_value_expression_enclosed_in_braces, p.pos()-2, 2, string(ch))
 * 		} else {
 * 			p.incPos(-1)
 * 			return false
 * 		}
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function regExpParser_scanCharacterClassEscape(receiver: GoPtr<regExpParser>): bool {
  debug.Assert(regExpParser_pos(receiver) > 0 && byteAt(regExpParser_text(receiver), regExpParser_pos(receiver) - 1) === "\\".codePointAt(0)!);
  let isCharacterComplement = false;
  const start = regExpParser_pos(receiver) - 1;
  const ch = regExpParser_char(receiver);
  if (ch === "d".codePointAt(0)! || ch === "D".codePointAt(0)! || ch === "s".codePointAt(0)! || ch === "S".codePointAt(0)! || ch === "w".codePointAt(0)! || ch === "W".codePointAt(0)!) {
    regExpParser_incPos(receiver, 1);
    return true;
  }
  if (ch === "P".codePointAt(0)! || ch === "p".codePointAt(0)!) {
    if (ch === "P".codePointAt(0)!) {
      isCharacterComplement = true;
    }
    regExpParser_incPos(receiver, 1);
    if (regExpParser_char(receiver) === "{".codePointAt(0)!) {
      regExpParser_incPos(receiver, 1);
      const propertyNameOrValueStart = regExpParser_pos(receiver);
      const propertyNameOrValue = regExpParser_scanWordCharacters(receiver);
      if (regExpParser_char(receiver) === "=".codePointAt(0)!) {
        const propertyName = nonBinaryUnicodeProperties.get(propertyNameOrValue) ?? "";
        if (regExpParser_pos(receiver) === propertyNameOrValueStart) {
          regExpParser_error(receiver, Expected_a_Unicode_property_name, regExpParser_pos(receiver), 0);
        } else if (propertyName === "") {
          regExpParser_error(receiver, Unknown_Unicode_property_name, propertyNameOrValueStart, regExpParser_pos(receiver) - propertyNameOrValueStart);
          const suggestion = regExpParser_getSpellingSuggestionForUnicodePropertyName(receiver, propertyNameOrValue);
          if (suggestion !== "") {
            regExpParser_error(receiver, Did_you_mean_0, propertyNameOrValueStart, regExpParser_pos(receiver) - propertyNameOrValueStart, suggestion);
          }
        }
        regExpParser_incPos(receiver, 1);
        const propertyValueStart = regExpParser_pos(receiver);
        const propertyValue = regExpParser_scanWordCharacters(receiver);
        if (regExpParser_pos(receiver) === propertyValueStart) {
          regExpParser_error(receiver, Expected_a_Unicode_property_value, regExpParser_pos(receiver), 0);
        } else if (propertyName !== "") {
          const values = valuesOfNonBinaryUnicodeProperties.get(propertyName);
          if (values !== undefined && !Set_Has(values, propertyValue)) {
            regExpParser_error(receiver, Unknown_Unicode_property_value, propertyValueStart, regExpParser_pos(receiver) - propertyValueStart);
            const suggestion = regExpParser_getSpellingSuggestionForUnicodePropertyValue(receiver, propertyName, propertyValue);
            if (suggestion !== "") {
              regExpParser_error(receiver, Did_you_mean_0, propertyValueStart, regExpParser_pos(receiver) - propertyValueStart, suggestion);
            }
          }
        }
      } else {
        if (regExpParser_pos(receiver) === propertyNameOrValueStart) {
          regExpParser_error(receiver, Expected_a_Unicode_property_name_or_value, regExpParser_pos(receiver), 0);
        } else if (Set_Has(binaryUnicodePropertiesOfStrings, propertyNameOrValue)) {
          if (!receiver!.unicodeSetsMode) {
            regExpParser_error(receiver, Any_Unicode_property_that_would_possibly_match_more_than_a_single_character_is_only_available_when_the_Unicode_Sets_v_flag_is_set, propertyNameOrValueStart, regExpParser_pos(receiver) - propertyNameOrValueStart);
          } else if (isCharacterComplement) {
            regExpParser_error(receiver, Anything_that_would_possibly_match_more_than_a_single_character_is_invalid_inside_a_negated_character_class, propertyNameOrValueStart, regExpParser_pos(receiver) - propertyNameOrValueStart);
          } else {
            receiver!.mayContainStrings = true;
          }
        } else if (!Set_Has(valuesOfNonBinaryUnicodeProperties.get("General_Category"), propertyNameOrValue) && !Set_Has(binaryUnicodeProperties, propertyNameOrValue)) {
          regExpParser_error(receiver, Unknown_Unicode_property_name_or_value, propertyNameOrValueStart, regExpParser_pos(receiver) - propertyNameOrValueStart);
          const suggestion = regExpParser_getSpellingSuggestionForUnicodePropertyNameOrValue(receiver, propertyNameOrValue);
          if (suggestion !== "") {
            regExpParser_error(receiver, Did_you_mean_0, propertyNameOrValueStart, regExpParser_pos(receiver) - propertyNameOrValueStart, suggestion);
          }
        }
      }
      regExpParser_scanExpectedChar(receiver, "}".codePointAt(0)!);
      if (!receiver!.anyUnicodeMode) {
        regExpParser_error(receiver, Unicode_property_value_expressions_are_only_available_when_the_Unicode_u_flag_or_the_Unicode_Sets_v_flag_is_set, start, regExpParser_pos(receiver) - start);
      }
    } else if (receiver!.anyUnicodeModeOrNonAnnexB) {
      regExpParser_error(receiver, X_0_must_be_followed_by_a_Unicode_property_value_expression_enclosed_in_braces, regExpParser_pos(receiver) - 2, 2, globalThis.String.fromCodePoint(ch));
    } else {
      regExpParser_incPos(receiver, -1);
      return false;
    }
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.getSpellingSuggestionForUnicodePropertyName","kind":"method","status":"implemented","sigHash":"c355120ac53223beec340c3c29316c8e998f9a2bacc5f98b357485765c635c12","bodyHash":"0352b36ca30937facda18eaa721b103ce3bd66226d358545d3a3d17dfba4b80f"}
 *
 * Go source:
 * func (p *regExpParser) getSpellingSuggestionForUnicodePropertyName(name string) string {
 * 	return core.GetSpellingSuggestionForStrings(name, maps.Keys(nonBinaryUnicodeProperties))
 * }
 */
export function regExpParser_getSpellingSuggestionForUnicodePropertyName(receiver: GoPtr<regExpParser>, name: string): string {
  return GetSpellingSuggestionForStrings(name, maps.Keys(nonBinaryUnicodeProperties));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.getSpellingSuggestionForUnicodePropertyValue","kind":"method","status":"implemented","sigHash":"7e20e1f90a9f719614c0b30fc8bc132a606c4664a72876670d3d988f4942fc40","bodyHash":"1dddf9fef11a78ea59480baef3442b0bf3b3db6857c275ae5fd8efb0c6a986b2"}
 *
 * Go source:
 * func (p *regExpParser) getSpellingSuggestionForUnicodePropertyValue(propertyName string, value string) string {
 * 	values := valuesOfNonBinaryUnicodeProperties[propertyName]
 * 	if values == nil {
 * 		return ""
 * 	}
 * 	return core.GetSpellingSuggestionForStrings(value, maps.Keys(values.Keys()))
 * }
 */
export function regExpParser_getSpellingSuggestionForUnicodePropertyValue(receiver: GoPtr<regExpParser>, propertyName: string, value: string): string {
  const values = valuesOfNonBinaryUnicodeProperties.get(propertyName);
  if (values === undefined) {
    return "";
  }
  return GetSpellingSuggestionForStrings(value, maps.Keys(Set_Keys(values)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.getSpellingSuggestionForUnicodePropertyNameOrValue","kind":"method","status":"implemented","sigHash":"e9d8d44cdc6837e1739a3992bf4ef9c50c031c0e63e9a9d08f6092ff42bb696f","bodyHash":"a99dc13aa9a86753cb8c61ff75fe1a3c958493082802de1ae64f22b5f054fa3d"}
 *
 * Go source:
 * func (p *regExpParser) getSpellingSuggestionForUnicodePropertyNameOrValue(name string) string {
 * 	return core.GetSpellingSuggestionForStrings(name, core.ConcatenateSeq(
 * 		maps.Keys(valuesOfNonBinaryUnicodeProperties["General_Category"].Keys()),
 * 		maps.Keys(binaryUnicodeProperties.Keys()),
 * 		maps.Keys(binaryUnicodePropertiesOfStrings.Keys()),
 * 	))
 * }
 */
export function regExpParser_getSpellingSuggestionForUnicodePropertyNameOrValue(receiver: GoPtr<regExpParser>, name: string): string {
  return GetSpellingSuggestionForStrings(name, ConcatenateSeq(
    maps.Keys(Set_Keys(valuesOfNonBinaryUnicodeProperties.get("General_Category"))),
    maps.Keys(Set_Keys(binaryUnicodeProperties)),
    maps.Keys(Set_Keys(binaryUnicodePropertiesOfStrings)),
  ));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanWordCharacters","kind":"method","status":"implemented","sigHash":"f742aad9860dec1dd80771e46967cf83e3d60e5407c1f1ae07b80a7f39e040b1","bodyHash":"a157444b25f8554a477881d556cfa475c9a9438f1421644183a39ab4b9787198"}
 *
 * Go source:
 * func (p *regExpParser) scanWordCharacters() string {
 * 	start := p.pos()
 * 	for p.pos() < p.end {
 * 		ch := p.char()
 * 		if !isWordCharacter(ch) {
 * 			break
 * 		}
 * 		p.incPos(1)
 * 	}
 * 	return p.text()[start:p.pos()]
 * }
 */
export function regExpParser_scanWordCharacters(receiver: GoPtr<regExpParser>): string {
  const start = regExpParser_pos(receiver);
  while (regExpParser_pos(receiver) < receiver!.end) {
    const ch = regExpParser_char(receiver);
    if (!isWordCharacter(ch)) {
      break;
    }
    regExpParser_incPos(receiver, 1);
  }
  return byteSlice(regExpParser_text(receiver), start, regExpParser_pos(receiver));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanSourceCharacter","kind":"method","status":"implemented","sigHash":"4886092fd3251310387b20b0ffa7a3a72f11175a51e4554f685ebcdf01da237e","bodyHash":"d4891c7b21213c52fcb450efc6f5ab6b478640cacdeaf39eb7bee927ab03094b"}
 *
 * Go source:
 * func (p *regExpParser) scanSourceCharacter() string {
 * 	if p.pos() >= p.end {
 * 		return ""
 * 	}
 * 	if !p.anyUnicodeMode {
 * 		if p.pendingLowSurrogate != 0 {
 * 			// Second of two surrogate code units for the same non-BMP character.
 * 			// Now advance past the full UTF-8 sequence (the high surrogate call did not advance).
 * 			_, size := utf8.DecodeRuneInString(p.text()[p.pos():])
 * 			p.incPos(size)
 * 			low := p.pendingLowSurrogate
 * 			p.pendingLowSurrogate = 0
 * 			return stringutil.EncodeJSStringRune(low)
 * 		}
 * 		ch, size := utf8.DecodeRuneInString(p.text()[p.pos():])
 * 		if ch == utf8.RuneError || size == 0 {
 * 			// Not a valid rune; consume one raw byte.
 * 			p.incPos(1)
 * 			return string(p.text()[p.pos()-1])
 * 		}
 * 		if utf16.RuneLen(ch) == 2 {
 * 			// Non-BMP character: emit the high surrogate first WITHOUT advancing.
 * 			// The low surrogate will be emitted on the next call, which also advances.
 * 			high, low := stringutil.CodePointToSurrogatePair(ch)
 * 			p.pendingLowSurrogate = low
 * 			return stringutil.EncodeJSStringRune(high)
 * 		}
 * 		p.incPos(size)
 * 		return string(ch)
 * 	}
 * 	ch, size := utf8.DecodeRuneInString(p.text()[p.pos():])
 * 	if size == 0 {
 * 		return ""
 * 	}
 * 	if ch == utf8.RuneError {
 * 		// Invalid UTF-8; consume the byte to avoid infinite loops.
 * 		p.incPos(size)
 * 		return ""
 * 	}
 * 	p.incPos(size)
 * 	return string(ch)
 * }
 */
export function regExpParser_scanSourceCharacter(receiver: GoPtr<regExpParser>): string {
  if (regExpParser_pos(receiver) >= receiver!.end) {
    return "";
  }
  if (!receiver!.anyUnicodeMode) {
    if (receiver!.pendingLowSurrogate !== 0) {
      // Second of two surrogate code units for the same non-BMP character.
      // Now advance past the full UTF-8 sequence (the high surrogate call did not advance).
      const [, size] = utf8.DecodeRuneInStringAt(regExpParser_text(receiver), regExpParser_pos(receiver));
      regExpParser_incPos(receiver, size);
      const low = receiver!.pendingLowSurrogate;
      receiver!.pendingLowSurrogate = 0;
      return EncodeJSStringRune(low);
    }
    const [ch, size] = utf8.DecodeRuneInStringAt(regExpParser_text(receiver), regExpParser_pos(receiver));
    if (ch === utf8.RuneError || size === 0) {
      // Not a valid rune; consume one raw byte.
      regExpParser_incPos(receiver, 1);
      return stringFromRune(byteAt(regExpParser_text(receiver), regExpParser_pos(receiver) - 1));
    }
    if (utf16.RuneLen(ch) === 2) {
      // Non-BMP character: emit the high surrogate first WITHOUT advancing.
      // The low surrogate will be emitted on the next call, which also advances.
      const [high, low] = CodePointToSurrogatePair(ch);
      receiver!.pendingLowSurrogate = low;
      return EncodeJSStringRune(high);
    }
    regExpParser_incPos(receiver, size);
    return stringFromRune(ch);
  }
  const [ch, size] = utf8.DecodeRuneInStringAt(regExpParser_text(receiver), regExpParser_pos(receiver));
  if (size === 0) {
    return "";
  }
  if (ch === utf8.RuneError) {
    // Invalid UTF-8; consume the byte to avoid infinite loops.
    regExpParser_incPos(receiver, size);
    return "";
  }
  regExpParser_incPos(receiver, size);
  return stringFromRune(ch);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanExpectedChar","kind":"method","status":"implemented","sigHash":"c9713ce09c1fca74cf1e76a236708ee237d90ce3e9d0a5a06c4273c43c966891","bodyHash":"ea628c8d62b06daa49a7736fe6d0b8584df8b571c9b3f588f4275aa57a46d4f6"}
 *
 * Go source:
 * func (p *regExpParser) scanExpectedChar(ch rune) {
 * 	if p.char() == ch {
 * 		p.incPos(1)
 * 	} else {
 * 		p.error(diagnostics.X_0_expected, p.pos(), 0, string(ch))
 * 	}
 * }
 */
export function regExpParser_scanExpectedChar(receiver: GoPtr<regExpParser>, ch: GoRune): void {
  if (regExpParser_char(receiver) === ch) {
    regExpParser_incPos(receiver, 1);
  } else {
    regExpParser_error(receiver, X_0_expected, regExpParser_pos(receiver), 0, stringFromRune(ch));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.scanDigits","kind":"method","status":"implemented","sigHash":"d6698f95057ef673ccb864538926de696ec9ac67b3e7b00397ff7b14bdea4490","bodyHash":"6ce06c81737be07b58511b562fa6f3b140f4fec840e1f1d8febfa81809830cb5"}
 *
 * Go source:
 * func (p *regExpParser) scanDigits() {
 * 	start := p.pos()
 * 	for p.pos() < p.end && stringutil.IsDigit(p.char()) {
 * 		p.incPos(1)
 * 	}
 * 	p.scanner.tokenValue = p.text()[start:p.pos()]
 * }
 */
export function regExpParser_scanDigits(receiver: GoPtr<regExpParser>): void {
  const start = regExpParser_pos(receiver);
  while (regExpParser_pos(receiver) < receiver!.end && stringutil.IsDigit(regExpParser_char(receiver))) {
    regExpParser_incPos(receiver, 1);
  }
  receiver!.scanner!.__tsgoEmbedded0!.tokenValue = byteSlice(regExpParser_text(receiver), start, regExpParser_pos(receiver));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/regexp.go::method::regExpParser.run","kind":"method","status":"implemented","sigHash":"5f34b1a731fe7927697f58a124294860539d591c426ac511b58578a3d974a734","bodyHash":"e0c7d7c9526ecd3908b72c5f60c4ce9d9906e7db8b6c2db970f127438a6669de"}
 *
 * Go source:
 * func (p *regExpParser) run() {
 * 	// Regular expressions are checked more strictly when either in 'u' or 'v' mode, or
 * 	// when not using the looser interpretation of the syntax from ECMA-262 Annex B.
 * 	p.anyUnicodeModeOrNonAnnexB = p.anyUnicodeMode || !p.annexB
 * 
 * 	p.scanDisjunction(false /*isInGroup* /)
 * 
 * 	for _, reference := range p.groupNameReferences {
 * 		if !p.groupSpecifiers[reference.name] {
 * 			p.error(diagnostics.There_is_no_capturing_group_named_0_in_this_regular_expression, reference.pos, reference.end-reference.pos, reference.name)
 * 			if len(p.groupSpecifiers) > 0 {
 * 				suggestion := core.GetSpellingSuggestionForStrings(reference.name, maps.Keys(p.groupSpecifiers))
 * 				if suggestion != "" {
 * 					p.error(diagnostics.Did_you_mean_0, reference.pos, reference.end-reference.pos, suggestion)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	for _, escape := range p.decimalEscapes {
 * 		// Although a DecimalEscape with a value greater than the number of capturing groups
 * 		// is treated as either a LegacyOctalEscapeSequence or an IdentityEscape in Annex B,
 * 		// an error is nevertheless reported since it's most likely a mistake.
 * 		if escape.value > p.numberOfCapturingGroups {
 * 			if p.numberOfCapturingGroups > 0 {
 * 				p.error(diagnostics.This_backreference_refers_to_a_group_that_does_not_exist_There_are_only_0_capturing_groups_in_this_regular_expression, escape.pos, escape.end-escape.pos, p.numberOfCapturingGroups)
 * 			} else {
 * 				p.error(diagnostics.This_backreference_refers_to_a_group_that_does_not_exist_There_are_no_capturing_groups_in_this_regular_expression, escape.pos, escape.end-escape.pos)
 * 			}
 * 		}
 * 	}
 * }
 */
export function regExpParser_run(receiver: GoPtr<regExpParser>): void {
  // Regular expressions are checked more strictly when either in 'u' or 'v' mode, or
  // when not using the looser interpretation of the syntax from ECMA-262 Annex B.
  receiver!.anyUnicodeModeOrNonAnnexB = receiver!.anyUnicodeMode || !receiver!.annexB;

  regExpParser_scanDisjunction(receiver, false /*isInGroup*/);

  for (const reference of receiver!.groupNameReferences) {
    if (receiver!.groupSpecifiers.get(reference.name) !== true) {
      regExpParser_error(
        receiver,
        There_is_no_capturing_group_named_0_in_this_regular_expression,
        reference.pos,
        reference.end - reference.pos,
        reference.name,
      );
      if (receiver!.groupSpecifiers.size > 0) {
        const suggestion = GetSpellingSuggestionForStrings(reference.name, maps.Keys(receiver!.groupSpecifiers));
        if (suggestion !== "") {
          regExpParser_error(receiver, Did_you_mean_0, reference.pos, reference.end - reference.pos, suggestion);
        }
      }
    }
  }
  for (const escape of receiver!.decimalEscapes) {
    // Although a DecimalEscape with a value greater than the number of capturing groups
    // is treated as either a LegacyOctalEscapeSequence or an IdentityEscape in Annex B,
    // an error is nevertheless reported since it's most likely a mistake.
    if (escape.value > receiver!.numberOfCapturingGroups) {
      if (receiver!.numberOfCapturingGroups > 0) {
        regExpParser_error(
          receiver,
          This_backreference_refers_to_a_group_that_does_not_exist_There_are_only_0_capturing_groups_in_this_regular_expression,
          escape.pos,
          escape.end - escape.pos,
          receiver!.numberOfCapturingGroups,
        );
      } else {
        regExpParser_error(
          receiver,
          This_backreference_refers_to_a_group_that_does_not_exist_There_are_no_capturing_groups_in_this_regular_expression,
          escape.pos,
          escape.end - escape.pos,
        );
      }
    }
  }
}
