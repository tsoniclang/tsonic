import type { bool, byte, double, int, long } from "../../go/scalars.js";
import type { GoError, GoRune } from "../../go/compat.js";
import * as math from "../../go/math.js";
import { New as errors_New, Is as errors_Is } from "../../go/errors.js";
import { FormatInt, ParseFloat, ParseInt, ErrRange } from "../../go/strconv.js";
import { Builder, Cut, CutPrefix, HasPrefix, HasSuffix, IndexAny, TrimFunc, TrimLeft, TrimRight } from "../../go/strings.js";
import { Is as unicode_Is, Zs } from "../../go/unicode.js";
import { DecodeRuneInString, DecodeRuneInStringAt, DecodeRuneInStringViewAt, GetStringByteView, StringByteLen, StringByteSlice, StringByteViewLen } from "../../go/unicode/utf8.js";
import { Marshal } from "../json/json.js";
import { IsDigit, IsHexDigit, IsOctalDigit } from "../stringutil/util.js";
import { Inf, MaxSafeInteger, MinSafeInteger, NaN, Number_IsInf, Number_IsNaN } from "./jsnum.js";
import type { Number } from "./jsnum.js";

const utf8Decoder: TextDecoder = new globalThis.TextDecoder("utf-8");
const byteLen = StringByteLen;
const byteSlice = StringByteSlice;
// `string([]byte)` reinterprets the byte slice as a UTF-8 string.
const BytesToString = (b: ReadonlyArray<byte>): string => utf8Decoder.decode(globalThis.Uint8Array.from(b));
// `for _, r := range s` iterates the UTF-8 byte view, decoding one rune per
// step and advancing by the rune's byte size, mirroring Go's range-over-string.
function* rangeRunes(s: string): Generator<GoRune> {
  const view = GetStringByteView(s);
  const length = StringByteViewLen(s, view);
  let i = 0;
  while (i < length) {
    const [r, size] = DecodeRuneInStringViewAt(s, view, i);
    yield r;
    i += size === 0 ? 1 : size;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::method::Number.String","kind":"method","status":"implemented","sigHash":"85837c5f07b57c31a06f77adb1f019dc796d72c87338cf5849ce3b4b05fb1bf0","bodyHash":"4c9056c5e4b8dbdb2241be2b1375f2de564d7849219a3aad14fd47f7bf0c822e"}
 *
 * Go source:
 * func (n Number) String() string {
 * 	switch {
 * 	case n.IsNaN():
 * 		return "NaN"
 * 	case n.IsInf():
 * 		if n < 0 {
 * 			return "-Infinity"
 * 		}
 * 		return "Infinity"
 * 	}
 *
 * 	// Fast path: for safe integers, directly convert to string.
 * 	if MinSafeInteger <= n && n <= MaxSafeInteger {
 * 		if i := int64(n); float64(i) == float64(n) {
 * 			return strconv.FormatInt(i, 10)
 * 		}
 * 	}
 *
 * 	// Otherwise, the Go json package handles this correctly.
 * 	b, _ := json.Marshal(float64(n))
 * 	return string(b)
 * }
 */
export function Number_String(receiver: Number): string {
  switch (true) {
    case Number_IsNaN(receiver):
      return "NaN";
    case Number_IsInf(receiver):
      if (receiver < 0) {
        return "-Infinity";
      }
      return "Infinity";
  }

  // Fast path: for safe integers, directly convert to string.
  if (MinSafeInteger <= receiver && receiver <= MaxSafeInteger) {
    const i: long = globalThis.Math.trunc(receiver as double) as long;
    if ((i as double) === (receiver as double)) {
      return FormatInt(i, 10);
    }
  }

  // Otherwise, the Go json package handles this correctly.
  const [b] = Marshal(receiver as double);
  return BytesToString(b);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::func::FromString","kind":"func","status":"implemented","sigHash":"b9851dc3e956098f0c4483c4d0108a4bae66c5f58c33c723d074d1f162926fe5","bodyHash":"0a909ee676f52dc32914cd5e5260fe7125a23f162fdfdb9db9603c5748bd50d9"}
 *
 * Go source:
 * func FromString(s string) Number {
 * 	// Implementing StringToNumber exactly as written in the spec involves
 * 	// writing a parser, along with the conversion of the parsed AST into the
 * 	// actual value.
 * 	//
 * 	// We've already implemented a number parser in the scanner, but we can't
 * 	// import it here. We also do not have the conversion implemented since we
 * 	// previously just wrote `+literal` and let the runtime handle it.
 * 	//
 * 	// The strategy below is to instead break the number apart and fix it up
 * 	// such that Go's own parsing functionality can handle it. This won't be
 * 	// the fastest method, but it saves us from writing the full parser and
 * 	// conversion logic.
 * 
 * 	s = strings.TrimFunc(s, isStrWhiteSpace)
 * 
 * 	switch s {
 * 	case "":
 * 		return 0
 * 	case "Infinity", "+Infinity":
 * 		return Inf(1)
 * 	case "-Infinity":
 * 		return Inf(-1)
 * 	}
 * 
 * 	for _, r := range s {
 * 		if !isNumberRune(r) {
 * 			return NaN()
 * 		}
 * 	}
 * 
 * 	if n, ok := tryParseInt(s); ok {
 * 		return n
 * 	}
 * 
 * 	// Cut this off first so we can ensure -0 is returned as -0.
 * 	s, negative := strings.CutPrefix(s, "-")
 * 
 * 	if !negative {
 * 		s, _ = strings.CutPrefix(s, "+")
 * 	}
 * 
 * 	if first, _ := utf8.DecodeRuneInString(s); !stringutil.IsDigit(first) && first != '.' {
 * 		return NaN()
 * 	}
 * 
 * 	f := parseFloatString(s)
 * 	if math.IsNaN(f) {
 * 		return NaN()
 * 	}
 * 
 * 	sign := 1.0
 * 	if negative {
 * 		sign = -1.0
 * 	}
 * 	return Number(math.Copysign(f, sign))
 * }
 */
export function FromString(s: string): Number {
  // Implementing StringToNumber exactly as written in the spec involves
  // writing a parser, along with the conversion of the parsed AST into the
  // actual value.
  //
  // We've already implemented a number parser in the scanner, but we can't
  // import it here. We also do not have the conversion implemented since we
  // previously just wrote `+literal` and let the runtime handle it.
  //
  // The strategy below is to instead break the number apart and fix it up
  // such that Go's own parsing functionality can handle it. This won't be
  // the fastest method, but it saves us from writing the full parser and
  // conversion logic.

  s = TrimFunc(s, isStrWhiteSpace);

  switch (s) {
    case "":
      return 0 as Number;
    case "Infinity":
    case "+Infinity":
      return Inf(1);
    case "-Infinity":
      return Inf(-1);
  }

  for (const r of rangeRunes(s)) {
    if (!isNumberRune(r)) {
      return NaN();
    }
  }

  {
    const [n, ok] = tryParseInt(s);
    if (ok) {
      return n;
    }
  }

  // Cut this off first so we can ensure -0 is returned as -0.
  let negative: bool;
  [s, negative] = CutPrefix(s, "-");

  if (!negative) {
    [s] = CutPrefix(s, "+");
  }

  {
    const [first] = DecodeRuneInString(s);
    if (!IsDigit(first) && first !== ".".charCodeAt(0)) {
      return NaN();
    }
  }

  const f = parseFloatString(s);
  if (math.IsNaN(f)) {
    return NaN();
  }

  let sign = 1.0;
  if (negative) {
    sign = -1.0;
  }
  return math.Copysign(f, sign) as Number;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::func::isStrWhiteSpace","kind":"func","status":"implemented","sigHash":"5edd2eb63ab31225f5e694f03448794f9f914ca4e04e16ff6d41c75dae85c428","bodyHash":"712fe8f4f125b8e97a44ea5bbea0a5b7a0a135df14258c6d59f65e1b4c08659e"}
 *
 * Go source:
 * func isStrWhiteSpace(r rune) bool {
 * 	// This is different than stringutil.IsWhiteSpaceLike.
 *
 * 	// https://tc39.es/ecma262/2024/multipage/ecmascript-language-lexical-grammar.html#prod-LineTerminator
 * 	// https://tc39.es/ecma262/2024/multipage/ecmascript-language-lexical-grammar.html#prod-WhiteSpace
 *
 * 	switch r {
 * 	// LineTerminator
 * 	case '\n', '\r', 0x2028, 0x2029:
 * 		return true
 * 	// WhiteSpace
 * 	case '\t', '\v', '\f', 0xFEFF:
 * 		return true
 * 	}
 *
 * 	// WhiteSpace
 * 	return unicode.Is(unicode.Zs, r)
 * }
 */
export function isStrWhiteSpace(r: GoRune): bool {
  // This is different than stringutil.IsWhiteSpaceLike.

  // https://tc39.es/ecma262/2024/multipage/ecmascript-language-lexical-grammar.html#prod-LineTerminator
  // https://tc39.es/ecma262/2024/multipage/ecmascript-language-lexical-grammar.html#prod-WhiteSpace

  switch (r) {
    // LineTerminator
    case 0x0a: // '\n'
    case 0x0d: // '\r'
    case 0x2028:
    case 0x2029:
      return true;
    // WhiteSpace
    case 0x09: // '\t'
    case 0x0b: // '\v'
    case 0x0c: // '\f'
    case 0xfeff:
      return true;
  }

  // WhiteSpace
  return unicode_Is(Zs, r);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::varGroup::errUnknownPrefix","kind":"varGroup","status":"implemented","sigHash":"df22c667042dad784e643fa0ee7ec7fe4c2d764c56518bb6cee437f6f27ae2ff","bodyHash":"fbe33c7fa968290b9ecd4d8351d8e9fe1a5b5a5142809c1878c272e4ebfe0e41"}
 *
 * Go source:
 * var errUnknownPrefix = errors.New("unknown number prefix")
 */
export let errUnknownPrefix: GoError = errors_New("unknown number prefix");

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::func::tryParseInt","kind":"func","status":"implemented","sigHash":"65f4d9e2cf198633f067545126beaa144ac71d34bc3271659af155413470de0e","bodyHash":"f9423630e7ad7f01f90b34a23a1713f2fdbc362a62e0677b9a9d86900f26b89d"}
 *
 * Go source:
 * func tryParseInt(s string) (Number, bool) {
 * 	var i int64
 * 	var err error
 * 	var hasIntResult bool
 * 
 * 	if len(s) > 2 {
 * 		prefix, rest := s[:2], s[2:]
 * 		switch prefix {
 * 		case "0b", "0B":
 * 			if !isAllBinaryDigits(rest) {
 * 				return NaN(), true
 * 			}
 * 			i, err = strconv.ParseInt(rest, 2, 64)
 * 			hasIntResult = true
 * 		case "0o", "0O":
 * 			if !isAllOctalDigits(rest) {
 * 				return NaN(), true
 * 			}
 * 			i, err = strconv.ParseInt(rest, 8, 64)
 * 			hasIntResult = true
 * 		case "0x", "0X":
 * 			if !isAllHexDigits(rest) {
 * 				return NaN(), true
 * 			}
 * 			i, err = strconv.ParseInt(rest, 16, 64)
 * 			hasIntResult = true
 * 		}
 * 	}
 * 
 * 	if !hasIntResult {
 * 		// StringToNumber does not parse leading zeros as octal.
 * 		s = trimLeadingZeros(s)
 * 		if !isAllDigits(s) {
 * 			return 0, false
 * 		}
 * 		i, err = strconv.ParseInt(s, 10, 64)
 * 		hasIntResult = true
 * 	}
 * 
 * 	if hasIntResult && err == nil {
 * 		return Number(i), true
 * 	}
 * 
 * 	// Using this to parse large integers.
 * 	bi, ok := new(big.Int).SetString(s, 0)
 * 	if !ok {
 * 		return NaN(), true
 * 	}
 * 
 * 	f, _ := bi.Float64()
 * 	return Number(f), true
 * }
 */
export function tryParseInt(s: string): [Number, bool] {
  let i: long = 0 as long;
  let err: GoError = undefined;
  let hasIntResult: bool = false;

  if (byteLen(s) > 2) {
    const prefix = byteSlice(s, 0, 2);
    const rest = byteSlice(s, 2);
    switch (prefix) {
      case "0b":
      case "0B":
        if (!isAllBinaryDigits(rest)) {
          return [NaN(), true];
        }
        [i, err] = ParseInt(rest, 2, 64);
        hasIntResult = true;
        break;
      case "0o":
      case "0O":
        if (!isAllOctalDigits(rest)) {
          return [NaN(), true];
        }
        [i, err] = ParseInt(rest, 8, 64);
        hasIntResult = true;
        break;
      case "0x":
      case "0X":
        if (!isAllHexDigits(rest)) {
          return [NaN(), true];
        }
        [i, err] = ParseInt(rest, 16, 64);
        hasIntResult = true;
        break;
    }
  }

  if (!hasIntResult) {
    // StringToNumber does not parse leading zeros as octal.
    s = trimLeadingZeros(s);
    if (!isAllDigits(s)) {
      return [0 as Number, false];
    }
    [i, err] = ParseInt(s, 10, 64);
    hasIntResult = true;
  }

  if (hasIntResult && err === undefined) {
    return [i as Number, true];
  }

  // Using this to parse large integers.
  // `new(big.Int).SetString(s, 0)` parses with base inference; every string that
  // reaches here is a positive, separator-free, prefix-validated integer literal,
  // so native BigInt parses it identically. A malformed string would throw rather
  // than report ok=false, but those are filtered out by the isAll*Digits guards
  // above, so the bigint parse always succeeds.
  const bi: bigint = globalThis.BigInt(s);

  // `bi.Float64()` returns the nearest float64 with round-to-nearest-even, which
  // is exactly the ECMAScript BigInt-to-Number conversion.
  const f = globalThis.Number(bi);
  return [f as Number, true];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::func::parseFloatString","kind":"func","status":"implemented","sigHash":"da1a29c51c6f24300e3bdd61c19faeb83360e709e10111541878e9f67abd43fa","bodyHash":"af5c2a45a7d46e8ae4232c38d3d7646ba525b31782028ec02a624e151158cc1d"}
 *
 * Go source:
 * func parseFloatString(s string) float64 {
 * 	var hasDot, hasExp bool
 * 
 * 	// <a>
 * 	// <a>.<b>
 * 	// <a>.<b>e<c>
 * 	// <a>e<c>
 * 	var a, b, c, rest string
 * 
 * 	a, rest, hasDot = strings.Cut(s, ".")
 * 	if hasDot {
 * 		// <a>.<b>
 * 		// <a>.<b>e<c>
 * 		b, c, hasExp = cutAny(rest, "eE")
 * 	} else {
 * 		// <a>
 * 		// <a>e<c>
 * 		a, c, hasExp = cutAny(s, "eE")
 * 	}
 * 
 * 	var sb strings.Builder
 * 	sb.Grow(len(a) + len(b) + len(c) + 3)
 * 
 * 	if a == "" {
 * 		if hasDot && b == "" {
 * 			return math.NaN()
 * 		}
 * 		if hasExp && c == "" {
 * 			return math.NaN()
 * 		}
 * 		sb.WriteString("0")
 * 	} else {
 * 		a = trimLeadingZeros(a)
 * 		if !isAllDigits(a) {
 * 			return math.NaN()
 * 		}
 * 		sb.WriteString(a)
 * 	}
 * 
 * 	if hasDot {
 * 		sb.WriteString(".")
 * 		if b == "" {
 * 			sb.WriteString("0")
 * 		} else {
 * 			b = trimTrailingZeros(b)
 * 			if !isAllDigits(b) {
 * 				return math.NaN()
 * 			}
 * 			sb.WriteString(b)
 * 		}
 * 	}
 * 
 * 	if hasExp {
 * 		sb.WriteString("e")
 * 
 * 		c, negative := strings.CutPrefix(c, "-")
 * 		if negative {
 * 			sb.WriteString("-")
 * 		} else {
 * 			c, _ = strings.CutPrefix(c, "+")
 * 		}
 * 		c = trimLeadingZeros(c)
 * 		if !isAllDigits(c) {
 * 			return math.NaN()
 * 		}
 * 		sb.WriteString(c)
 * 	}
 * 
 * 	return stringToFloat64(sb.String())
 * }
 */
export function parseFloatString(s: string): double {
  let hasDot: bool;
  let hasExp: bool = false;

  // <a>
  // <a>.<b>
  // <a>.<b>e<c>
  // <a>e<c>
  let a: string;
  let b: string = "";
  let c: string = "";
  let rest: string;

  [a, rest, hasDot] = Cut(s, ".");
  if (hasDot) {
    // <a>.<b>
    // <a>.<b>e<c>
    [b, c, hasExp] = cutAny(rest, "eE");
  } else {
    // <a>
    // <a>e<c>
    [a, c, hasExp] = cutAny(s, "eE");
  }

  const sb = new Builder();
  sb.Grow(byteLen(a) + byteLen(b) + byteLen(c) + 3);

  if (a === "") {
    if (hasDot && b === "") {
      return math.NaN();
    }
    if (hasExp && c === "") {
      return math.NaN();
    }
    sb.WriteString("0");
  } else {
    a = trimLeadingZeros(a);
    if (!isAllDigits(a)) {
      return math.NaN();
    }
    sb.WriteString(a);
  }

  if (hasDot) {
    sb.WriteString(".");
    if (b === "") {
      sb.WriteString("0");
    } else {
      b = trimTrailingZeros(b);
      if (!isAllDigits(b)) {
        return math.NaN();
      }
      sb.WriteString(b);
    }
  }

  if (hasExp) {
    sb.WriteString("e");

    let negative: bool;
    [c, negative] = CutPrefix(c, "-");
    if (negative) {
      sb.WriteString("-");
    } else {
      [c] = CutPrefix(c, "+");
    }
    c = trimLeadingZeros(c);
    if (!isAllDigits(c)) {
      return math.NaN();
    }
    sb.WriteString(c);
  }

  return stringToFloat64(sb.String());
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::func::cutAny","kind":"func","status":"implemented","sigHash":"bf997525c3ca144465aa6b6430b2732cddc8e1ccae8fb2e5e211f75881dc7bf4","bodyHash":"5d54bf96461cdb9b9af81f021765025c5426cef3281d4582956f6e53dd12953a"}
 *
 * Go source:
 * func cutAny(s string, cutset string) (before, after string, found bool) {
 * 	if i := strings.IndexAny(s, cutset); i >= 0 {
 * 		before = s[:i]
 * 		afterAndFound := s[i:]
 * 		_, size := utf8.DecodeRuneInString(afterAndFound)
 * 		after = afterAndFound[size:]
 * 		return before, after, true
 * 	}
 * 	return s, "", false
 * }
 */
export function cutAny(s: string, cutset: string): [string, string, bool] {
  const i = IndexAny(s, cutset);
  if (i >= 0) {
    const before = byteSlice(s, 0, i);
    const [, size] = DecodeRuneInStringAt(s, i);
    const after = byteSlice(s, i + size);
    return [before, after, true];
  }
  return [s, "", false];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::func::trimLeadingZeros","kind":"func","status":"implemented","sigHash":"a42bbc5ea42c49b75eb3e6842e7e29fdf455d99d37b49b15a281de25e144631e","bodyHash":"41900ef2f395024dc309c1dcb8c3b3d3262a95fcb78de8ab3bab3fe7244698cf"}
 *
 * Go source:
 * func trimLeadingZeros(s string) string {
 * 	if strings.HasPrefix(s, "0") {
 * 		s = strings.TrimLeft(s, "0")
 * 		if s == "" {
 * 			return "0"
 * 		}
 * 	}
 * 	return s
 * }
 */
export function trimLeadingZeros(s: string): string {
  if (HasPrefix(s, "0")) {
    s = TrimLeft(s, "0");
    if (s === "") {
      return "0";
    }
  }
  return s;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::func::trimTrailingZeros","kind":"func","status":"implemented","sigHash":"e6b97c796d62737272ec7a5f3b68f82e240cc6d1fad9c02ac4e37f37f9f7a95b","bodyHash":"c7940dbaaef0dfc31733240bdd483db504df923561a862e2f14550f928a71d5b"}
 *
 * Go source:
 * func trimTrailingZeros(s string) string {
 * 	if strings.HasSuffix(s, "0") {
 * 		s = strings.TrimRight(s, "0")
 * 		if s == "" {
 * 			return "0"
 * 		}
 * 	}
 * 	return s
 * }
 */
export function trimTrailingZeros(s: string): string {
  if (HasSuffix(s, "0")) {
    s = TrimRight(s, "0");
    if (s === "") {
      return "0";
    }
  }
  return s;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::func::stringToFloat64","kind":"func","status":"implemented","sigHash":"9f713a39ad5c1bc18e2602d0bdd29d831419a03f9ea65cee5f4842619c72ca08","bodyHash":"cd960b1026d93ec13c7ac912bc0740b87d42bd2f19c2a635dc2722feb553eff9"}
 *
 * Go source:
 * func stringToFloat64(s string) float64 {
 * 	if f, err := strconv.ParseFloat(s, 64); err == nil {
 * 		return f
 * 	} else {
 * 		if errors.Is(err, strconv.ErrRange) {
 * 			return f
 * 		}
 * 	}
 * 	return math.NaN()
 * }
 */
export function stringToFloat64(s: string): double {
  const [f, err] = ParseFloat(s, 64);
  if (err === undefined) {
    return f as double;
  } else {
    if (errors_Is(err, ErrRange)) {
      return f as double;
    }
  }
  return math.NaN();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::func::isAllDigits","kind":"func","status":"implemented","sigHash":"8fbdd67e86fae2133199ae0543a168feabb1f20153234b63a243c7cd9f72ba18","bodyHash":"afd5ff3c98a4f2d6ded8b9c12125ab29df2e77f170a864f4a9f50899e8c74257"}
 *
 * Go source:
 * func isAllDigits(s string) bool {
 * 	for _, r := range s {
 * 		if !stringutil.IsDigit(r) {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function isAllDigits(s: string): bool {
  for (const r of rangeRunes(s)) {
    if (!IsDigit(r)) {
      return false;
    }
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::func::isAllBinaryDigits","kind":"func","status":"implemented","sigHash":"16ddbb644d49c4542a89db7a92c6c1d75ae34ffe123610729e0f972fc0ad80ae","bodyHash":"b88bef73a0e5d9a499d1bb817d130197c1c6f9bac117f192ee1128d0bc0c5ce2"}
 *
 * Go source:
 * func isAllBinaryDigits(s string) bool {
 * 	for _, r := range s {
 * 		if r != '0' && r != '1' {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function isAllBinaryDigits(s: string): bool {
  for (const r of rangeRunes(s)) {
    if (r !== 0x30 /* '0' */ && r !== 0x31 /* '1' */) {
      return false;
    }
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::func::isAllOctalDigits","kind":"func","status":"implemented","sigHash":"dc8fa846f6709c6516e50213e0438e8c3bba29fcbbe9c7905e6eb87a70866a8e","bodyHash":"b4d6d1a4a181df80875b7feb45f74a67664379479a9af669f6ce7e2fedb03191"}
 *
 * Go source:
 * func isAllOctalDigits(s string) bool {
 * 	for _, r := range s {
 * 		if !stringutil.IsOctalDigit(r) {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function isAllOctalDigits(s: string): bool {
  for (const r of rangeRunes(s)) {
    if (!IsOctalDigit(r)) {
      return false;
    }
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::func::isAllHexDigits","kind":"func","status":"implemented","sigHash":"82c57160ac3580055a220f076698ffeead42dccaf55633c289b2d92eb0065e7c","bodyHash":"d19f560ff2b936a848534fd257d2b44c0acbd8d8f27a54afa376eeea001d8a78"}
 *
 * Go source:
 * func isAllHexDigits(s string) bool {
 * 	for _, r := range s {
 * 		if !stringutil.IsHexDigit(r) {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function isAllHexDigits(s: string): bool {
  for (const r of rangeRunes(s)) {
    if (!IsHexDigit(r)) {
      return false;
    }
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/string.go::func::isNumberRune","kind":"func","status":"implemented","sigHash":"d6a0f332901222a82dda0f5e97b0e66a104a445adf94a156389c56943866d6f2","bodyHash":"0d518bc413910c9b95732bfec0913bb096144a698a59f3987cae54cff46c5b57"}
 *
 * Go source:
 * func isNumberRune(r rune) bool {
 * 	if stringutil.IsDigit(r) {
 * 		return true
 * 	}
 *
 * 	if 'a' <= r && r <= 'f' {
 * 		return true
 * 	}
 *
 * 	if 'A' <= r && r <= 'F' {
 * 		return true
 * 	}
 *
 * 	switch r {
 * 	case '.', '-', '+', 'x', 'X', 'o', 'O':
 * 		return true
 * 	}
 *
 * 	return false
 * }
 */
export function isNumberRune(r: GoRune): bool {
  if (IsDigit(r)) {
    return true;
  }

  if (0x61 /* 'a' */ <= r && r <= 0x66 /* 'f' */) {
    return true;
  }

  if (0x41 /* 'A' */ <= r && r <= 0x46 /* 'F' */) {
    return true;
  }

  switch (r) {
    case 0x2e /* '.' */:
    case 0x2d /* '-' */:
    case 0x2b /* '+' */:
    case 0x78 /* 'x' */:
    case 0x58 /* 'X' */:
    case 0x6f /* 'o' */:
    case 0x4f /* 'O' */:
      return true;
  }

  return false;
}
