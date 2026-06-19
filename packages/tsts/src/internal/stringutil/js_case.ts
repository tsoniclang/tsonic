import type { bool, int } from "../../go/scalars.js";
import type { GoRune } from "../../go/compat.js";
import { Is, ToLower, ToUpper } from "../../go/unicode.js";
import { EncodeJSStringRune, IsSurrogate, SurrogatePairToCodePoint } from "./util.js";
import {
  specialCasingConditionFinalSigma,
  specialCasingMappings,
  unicodeCasedRanges,
  unicodeCaseIgnorableRanges,
} from "./generated/js_case_generated.js";

// Go iterates the input by UTF-8 byte offset (DecodeJSStringRune(str[i:]) + size).
// JS strings are UTF-16 code-unit strings and a re-encode through TextEncoder
// (the byte view used elsewhere) would map a lone surrogate to U+FFFD, so the
// loops here walk code units directly. decodeRuneAt is the code-unit-indexed
// equivalent of stringutil.DecodeJSStringRune: a high+low surrogate pair is one
// astral rune (2 code units), a lone surrogate is returned verbatim (1 code unit,
// IsSurrogate-true), and every other code unit is its own rune.
const decodeRuneAt = (str: string, i: int): [GoRune, int] => {
  const first = str.charCodeAt(i);
  if (first >= 0xd800 && first < 0xdc00) {
    const second = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
    if (second >= 0xdc00 && second <= 0xdfff) {
      return [SurrogatePairToCodePoint(first as GoRune, second as GoRune), 2];
    }
  }
  return [first as GoRune, 1];
};

// Append accumulator. Go uses a byte-oriented strings.Builder, but that buffer
// round-trips through TextEncoder/TextDecoder on String() and would destroy lone
// surrogate code units; a code-unit string accumulator preserves them.
const fromCodePoint = (r: GoRune): string => globalThis.String.fromCodePoint(r);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/js_case.go::func::ToLowerJS","kind":"func","status":"implemented","sigHash":"cd8ed802f5c1cfe38864641827bffcede83a8a90ebebfe9f83d5c90dafca3927","bodyHash":"5fbf8e670bae9fe1490b3c26ca1d20167c75d2c401dad1fbd1dcc05a82f60e67"}
 *
 * Go source:
 * func ToLowerJS(str string) string {
 * 	if ascii, ok := toLowerASCII(str); ok {
 * 		return ascii
 * 	}
 * 	var builder strings.Builder
 * 	builder.Grow(len(str))
 * 	casedBefore := false
 * 	for i := 0; i < len(str); {
 * 		r, size := DecodeJSStringRune(str[i:])
 * 		i += size
 * 		if IsSurrogate(r) {
 * 			builder.WriteString(EncodeJSStringRune(r))
 * 		} else if mapping, ok := specialCasingMappings[r]; ok {
 * 			if mapping.condition == specialCasingConditionFinalSigma && !isFinalSigmaContext(casedBefore, str, i) {
 * 				builder.WriteRune(unicode.ToLower(r))
 * 			} else {
 * 				builder.WriteString(mapping.lower)
 * 			}
 * 		} else {
 * 			builder.WriteRune(unicode.ToLower(r))
 * 		}
 * 		if !isUnicodeCaseIgnorable(r) {
 * 			casedBefore = isSigmaCased(r)
 * 		}
 * 	}
 * 	return builder.String()
 * }
 */
export function ToLowerJS(str: string): string {
  const [ascii, ok] = toLowerASCII(str);
  if (ok) {
    return ascii;
  }

  const builder: string[] = [];
  // casedBefore tracks whether the most recent non-Case_Ignorable code point is
  // "cased", the backward half of the Final_Sigma context, accumulated as we
  // stream so we never scan backwards.
  let casedBefore: bool = false as bool;
  let i = 0;
  while (i < str.length) {
    const [r, advance] = decodeRuneAt(str, i);
    i += advance;
    if (IsSurrogate(r)) {
      // A lone surrogate has no case mapping; preserve it verbatim, matching
      // String.prototype.toLowerCase.
      builder.push(EncodeJSStringRune(r));
    } else {
      const mapping = specialCasingMappings.get(r);
      if (mapping !== undefined) {
        if (mapping.condition === specialCasingConditionFinalSigma && !isFinalSigmaContext(casedBefore, str, i)) {
          builder.push(fromCodePoint(ToLower(r)));
        } else {
          builder.push(mapping.lower);
        }
      } else {
        builder.push(fromCodePoint(ToLower(r)));
      }
    }
    if (!isUnicodeCaseIgnorable(r)) {
      casedBefore = isSigmaCased(r);
    }
  }
  return builder.join("");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/js_case.go::func::ToUpperJS","kind":"func","status":"implemented","sigHash":"30f4ab61ad8a8a0201d284e9c8a312b61139335b5d26428bd5f7393da2ec3aa9","bodyHash":"f5a2289ccba23250edd6a31fcfab536be500d291d0a680a2d517b349ed47f8ae"}
 *
 * Go source:
 * func ToUpperJS(str string) string {
 * 	if ascii, ok := toUpperASCII(str); ok {
 * 		return ascii
 * 	}
 * 	var builder strings.Builder
 * 	builder.Grow(len(str))
 * 	for i := 0; i < len(str); {
 * 		r, size := DecodeJSStringRune(str[i:])
 * 		if IsSurrogate(r) {
 * 			builder.WriteString(str[i : i+size])
 * 		} else if mapping, ok := specialCasingMappings[r]; ok {
 * 			builder.WriteString(mapping.upper)
 * 		} else {
 * 			builder.WriteRune(unicode.ToUpper(r))
 * 		}
 * 		i += size
 * 	}
 * 	return builder.String()
 * }
 */
export function ToUpperJS(str: string): string {
  const [ascii, ok] = toUpperASCII(str);
  if (ok) {
    return ascii;
  }

  const builder: string[] = [];
  let i = 0;
  while (i < str.length) {
    const [r, advance] = decodeRuneAt(str, i);
    if (IsSurrogate(r)) {
      // A lone surrogate has no case mapping; copy it verbatim (Go copies the
      // sentinel bytes str[i:i+size]; here the single code unit is the same value).
      builder.push(str.substring(i, i + advance));
    } else {
      const mapping = specialCasingMappings.get(r);
      if (mapping !== undefined) {
        builder.push(mapping.upper);
      } else {
        builder.push(fromCodePoint(ToUpper(r)));
      }
    }
    i += advance;
  }
  return builder.join("");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/js_case.go::func::toLowerASCII","kind":"func","status":"implemented","sigHash":"d9e1302cc9923aa8b480164d1482868acaeb93ddac0d25f54bde406a4aeae6f7","bodyHash":"e92a7162d2e1692a205dd4aeec5c7f35fedff6150e23ba7127765793ba671a97"}
 *
 * Go source:
 * func toLowerASCII(str string) (string, bool) {
 * 	needsMapping := false
 * 	for i := range len(str) {
 * 		ch := str[i]
 * 		if ch >= utf8.RuneSelf {
 * 			return "", false
 * 		}
 * 		needsMapping = needsMapping || ('A' <= ch && ch <= 'Z')
 * 	}
 * 	if !needsMapping {
 * 		return str, true
 * 	}
 * 	buf := []byte(str)
 * 	for i, ch := range buf {
 * 		if 'A' <= ch && ch <= 'Z' {
 * 			buf[i] = ch + ('a' - 'A')
 * 		}
 * 	}
 * 	return string(buf), true
 * }
 */
function toLowerASCII(str: string): [string, bool] {
  // The loop bails on the first non-ASCII code unit, so for a pure-ASCII string
  // (the only case that returns ok=true) code units and Go's bytes coincide.
  let needsMapping = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    if (ch >= 0x80) {
      // utf8.RuneSelf
      return ["", false as bool];
    }
    needsMapping = needsMapping || (0x41 <= ch && ch <= 0x5a);
  }
  if (!needsMapping) {
    return [str, true as bool];
  }
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    result += globalThis.String.fromCharCode(0x41 <= ch && ch <= 0x5a ? ch + 0x20 : ch);
  }
  return [result, true as bool];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/js_case.go::func::toUpperASCII","kind":"func","status":"implemented","sigHash":"8ea898ecf2d2594d9bb53fa24466cfecd6e6294e2b6fcaa377aaab8c8b908d50","bodyHash":"d9e1556632044551c01221556e9d1c164bac279a6768b97ae6b48fe6d770948f"}
 *
 * Go source:
 * func toUpperASCII(str string) (string, bool) {
 * 	needsMapping := false
 * 	for i := range len(str) {
 * 		ch := str[i]
 * 		if ch >= utf8.RuneSelf {
 * 			return "", false
 * 		}
 * 		needsMapping = needsMapping || ('a' <= ch && ch <= 'z')
 * 	}
 * 	if !needsMapping {
 * 		return str, true
 * 	}
 * 	buf := []byte(str)
 * 	for i, ch := range buf {
 * 		if 'a' <= ch && ch <= 'z' {
 * 			buf[i] = ch - ('a' - 'A')
 * 		}
 * 	}
 * 	return string(buf), true
 * }
 */
function toUpperASCII(str: string): [string, bool] {
  let needsMapping = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    if (ch >= 0x80) {
      // utf8.RuneSelf
      return ["", false as bool];
    }
    needsMapping = needsMapping || (0x61 <= ch && ch <= 0x7a);
  }
  if (!needsMapping) {
    return [str, true as bool];
  }
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    result += globalThis.String.fromCharCode(0x61 <= ch && ch <= 0x7a ? ch - 0x20 : ch);
  }
  return [result, true as bool];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/js_case.go::func::isFinalSigmaContext","kind":"func","status":"implemented","sigHash":"166c32d717be37b0daadd1b44e39b6c5d384cd0d72a6bb4a9c41f382c85a3062","bodyHash":"64dae59bdbf97e04efc2840322f05253a5b135adc10114b7a5440be56615c625"}
 *
 * Go source:
 * func isFinalSigmaContext(casedBefore bool, str string, afterOffset int) bool {
 * 	return casedBefore && !hasSigmaCasedAfter(str, afterOffset)
 * }
 */
function isFinalSigmaContext(casedBefore: bool, str: string, afterOffset: int): bool {
  return (casedBefore && !hasSigmaCasedAfter(str, afterOffset)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/js_case.go::func::hasSigmaCasedAfter","kind":"func","status":"implemented","sigHash":"96943ca6b2a503684441480d9ddfe9470eeb090c443ea3814b2a4c05fb7a829e","bodyHash":"aeb7814736dd6664b303b839362490231516297d23db12f2c5ed6478a238c5db"}
 *
 * Go source:
 * func hasSigmaCasedAfter(str string, start int) bool {
 * 	for i := start; i < len(str); {
 * 		r, size := DecodeJSStringRune(str[i:])
 * 		i += size
 * 		if isUnicodeCaseIgnorable(r) {
 * 			continue
 * 		}
 * 		return isSigmaCased(r)
 * 	}
 * 	return false
 * }
 */
function hasSigmaCasedAfter(str: string, start: int): bool {
  let i = start;
  while (i < str.length) {
    const [r, advance] = decodeRuneAt(str, i);
    i += advance;
    if (isUnicodeCaseIgnorable(r)) {
      continue;
    }
    return isSigmaCased(r);
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/js_case.go::func::isSigmaCased","kind":"func","status":"implemented","sigHash":"e8d71cb5af1ad705d3d42ccfb7c680c798beb8581251f1c72edf59c8ee31f4fd","bodyHash":"929a8f717f3038a197d6c93fd35d53ec003bfcd475a5ece9318aaef1bbd5e07a"}
 *
 * Go source:
 * func isSigmaCased(r rune) bool {
 * 	return unicode.Is(unicodeCasedRanges, r)
 * }
 */
function isSigmaCased(r: GoRune): bool {
  return Is(unicodeCasedRanges, r);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/js_case.go::func::isUnicodeCaseIgnorable","kind":"func","status":"implemented","sigHash":"3e499f7110d6310aeede2f60016c817d3973c4e8000fd37a24dabe7a18935736","bodyHash":"24502edff7e1c844f35b0d2f09825229fb5812089638bfdae7ea11ebff3c0665"}
 *
 * Go source:
 * func isUnicodeCaseIgnorable(r rune) bool {
 * 	return unicode.Is(unicodeCaseIgnorableRanges, r)
 * }
 */
function isUnicodeCaseIgnorable(r: GoRune): bool {
  return Is(unicodeCaseIgnorableRanges, r);
}
