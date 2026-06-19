import type { bool, int } from "../../go/scalars.js";
import { Compare, EqualFold, HasPrefix as stringsHasPrefix, HasSuffix as stringsHasSuffix, ToLower } from "../../go/strings.js";
import { ToLower as unicodeToLower } from "../../go/unicode.js";
import { DecodeRuneInStringViewAt, GetStringByteView, StringByteLen, StringByteSlice } from "../../go/unicode/utf8.js";

// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length and
// slices like `s[i:j]` operate on byte offsets. The standard-library facades
// (strings/utf8) follow that contract, so we mirror it here by operating over
// the UTF-8 byte view and converting back to a JS string at the boundaries.
const byteLen = StringByteLen;
const byteSlice = StringByteSlice;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/compare.go::func::EquateStringCaseInsensitive","kind":"func","status":"implemented","sigHash":"284949f704df7913456cab1010135bb5e23c8c347f244220d90a0321ec45440e","bodyHash":"bfc3b1322927adbeb1f54b6db4219b5d185cbe7279a84a86da460abe86703d33"}
 *
 * Go source:
 * func EquateStringCaseInsensitive(a, b string) bool {
 * 	// !!!
 * 	// return a == b || strings.ToUpper(a) == strings.ToUpper(b)
 * 	return strings.EqualFold(a, b)
 * }
 */
export function EquateStringCaseInsensitive(a: string, b: string): bool {
  // !!!
  // return a == b || strings.ToUpper(a) == strings.ToUpper(b)
  return EqualFold(a, b);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/compare.go::func::EquateStringCaseSensitive","kind":"func","status":"implemented","sigHash":"38f4b81aeb4fc44bf88ad525e86f1acbaaf213a63ba2a308733150e08ac4e55a","bodyHash":"aa4c36b679c2769000312758e2dfb818bd427be1f40b0162f980e9d463aa4d40"}
 *
 * Go source:
 * func EquateStringCaseSensitive(a, b string) bool {
 * 	return a == b
 * }
 */
export function EquateStringCaseSensitive(a: string, b: string): bool {
  return a === b;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/compare.go::func::GetStringEqualityComparer","kind":"func","status":"implemented","sigHash":"c947ebb615552c68869a35b2d225d0850ccd8eb2888ba41e2977119544e7278d","bodyHash":"2685ce6ac4ac86dc48156efb4508e2a9565594a086deca6f5520f0e2fd47e8a2"}
 *
 * Go source:
 * func GetStringEqualityComparer(ignoreCase bool) func(a, b string) bool {
 * 	if ignoreCase {
 * 		return EquateStringCaseInsensitive
 * 	}
 * 	return EquateStringCaseSensitive
 * }
 */
export function GetStringEqualityComparer(ignoreCase: bool): (a: string, b: string) => bool {
  if (ignoreCase) {
    return EquateStringCaseInsensitive;
  }
  return EquateStringCaseSensitive;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/compare.go::type::Comparison","kind":"type","status":"implemented","sigHash":"1ee9cefb60fd8cb12f867e0920e9a14eb3c776ce253bc2f776efbd1535ec367d","bodyHash":"99ab707b7926c29386ab1a73e8519c4eeef59796b71aa1a1cac47ae231263f2c"}
 *
 * Go source:
 * Comparison = int
 */
export type Comparison = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/compare.go::constGroup::ComparisonLessThan+ComparisonEqual+ComparisonGreaterThan","kind":"constGroup","status":"implemented","sigHash":"2fbcb79b7e8b984bba29095979085fb72a90896a429dad4983862cd935221b3b","bodyHash":"4057bf6a0ec608b931f4116a49d58c69b9663de4f4a1536c2301d436ffd8ced9"}
 *
 * Go source:
 * const (
 * 	ComparisonLessThan    Comparison = -1
 * 	ComparisonEqual       Comparison = 0
 * 	ComparisonGreaterThan Comparison = 1
 * )
 */
export const ComparisonLessThan: Comparison = -1;
export const ComparisonEqual: Comparison = 0;
export const ComparisonGreaterThan: Comparison = 1;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/compare.go::func::CompareStringsCaseInsensitive","kind":"func","status":"implemented","sigHash":"ac591ad324210bd22e25893f024961237ad3030219a6084cb964a51e7cc883b6","bodyHash":"6f0bb123594b125f6c64e7cdc6b7ebc1ba6acd4d34888dea5f61d26a3fe93a43"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Walk cached UTF-8 byte views by offset instead of repeatedly materializing suffix strings; comparison order and byte-sized rune advances remain TS-Go exact."}
 *
 * Go source:
 * func CompareStringsCaseInsensitive(a string, b string) Comparison {
 * 	if a == b {
 * 		return ComparisonEqual
 * 	}
 * 	for {
 * 		ca, sa := utf8.DecodeRuneInString(a)
 * 		cb, sb := utf8.DecodeRuneInString(b)
 * 		if sa == 0 {
 * 			if sb == 0 {
 * 				return ComparisonEqual
 * 			}
 * 			return ComparisonLessThan
 * 		}
 * 		if sb == 0 {
 * 			return ComparisonGreaterThan
 * 		}
 * 		lca := unicode.ToLower(ca)
 * 		lcb := unicode.ToLower(cb)
 * 		if lca != lcb {
 * 			if lca < lcb {
 * 				return ComparisonLessThan
 * 			}
 * 			return ComparisonGreaterThan
 * 		}
 * 		a = a[sa:]
 * 		b = b[sb:]
 * 	}
 * }
 */
export function CompareStringsCaseInsensitive(a: string, b: string): Comparison {
  if (a === b) {
    return ComparisonEqual;
  }
  const aView = GetStringByteView(a);
  const bView = GetStringByteView(b);
  let aPos = 0;
  let bPos = 0;
  for (;;) {
    const [ca, sa] = DecodeRuneInStringViewAt(a, aView, aPos);
    const [cb, sb] = DecodeRuneInStringViewAt(b, bView, bPos);
    if (sa === 0) {
      if (sb === 0) {
        return ComparisonEqual;
      }
      return ComparisonLessThan;
    }
    if (sb === 0) {
      return ComparisonGreaterThan;
    }
    const lca = unicodeToLower(ca);
    const lcb = unicodeToLower(cb);
    if (lca !== lcb) {
      if (lca < lcb) {
        return ComparisonLessThan;
      }
      return ComparisonGreaterThan;
    }
    aPos += sa;
    bPos += sb;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/compare.go::func::CompareStringsCaseSensitive","kind":"func","status":"implemented","sigHash":"b9971f54fe4386aa97f9f049e4189bef241d2d78a850136b97a4f52f958e65c5","bodyHash":"ab2e8666fc6dec125681dd67ec509173c74c76c73d45da75a7f82159cfa61d84"}
 *
 * Go source:
 * func CompareStringsCaseSensitive(a string, b string) Comparison {
 * 	return strings.Compare(a, b)
 * }
 */
export function CompareStringsCaseSensitive(a: string, b: string): Comparison {
  return Compare(a, b);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/compare.go::func::GetStringComparer","kind":"func","status":"implemented","sigHash":"90e49d772b19c5c18b3e4b76c8cb065275723bd44046861239e811327803a653","bodyHash":"4c47601c29eb2ce3f6a3f40ded533af44d08f5c9a6af21ea176da13756daad9c"}
 *
 * Go source:
 * func GetStringComparer(ignoreCase bool) func(a, b string) Comparison {
 * 	if ignoreCase {
 * 		return CompareStringsCaseInsensitive
 * 	}
 * 	return CompareStringsCaseSensitive
 * }
 */
export function GetStringComparer(ignoreCase: bool): (a: string, b: string) => Comparison {
  if (ignoreCase) {
    return CompareStringsCaseInsensitive;
  }
  return CompareStringsCaseSensitive;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/compare.go::func::HasPrefix","kind":"func","status":"implemented","sigHash":"3aec1bc2e2b086e450456497dd628dd36120fc3a0eb58a19c868875df77db322","bodyHash":"7b0cdd4b28cccd3431a4354d5e0eedbcf29cbf13684516b4cc2d2e425d79071f"}
 *
 * Go source:
 * func HasPrefix(s string, prefix string, caseSensitive bool) bool {
 * 	if caseSensitive {
 * 		return strings.HasPrefix(s, prefix)
 * 	}
 * 	if len(prefix) > len(s) {
 * 		return false
 * 	}
 * 	return strings.EqualFold(s[0:len(prefix)], prefix)
 * }
 */
export function HasPrefix(s: string, prefix: string, caseSensitive: bool): bool {
  if (caseSensitive) {
    return stringsHasPrefix(s, prefix);
  }
  if (byteLen(prefix) > byteLen(s)) {
    return false;
  }
  return EqualFold(byteSlice(s, 0, byteLen(prefix)), prefix);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/compare.go::func::HasSuffix","kind":"func","status":"implemented","sigHash":"9d42e86e86fe77ce4997a9218e755c3f72bf407f8bab2f09c8530f46e5a25b06","bodyHash":"a9b6daec56f7ecc11b0592b4810b9423f72f162ee7aef4f4b5ffdb0b24ca4d38"}
 *
 * Go source:
 * func HasSuffix(s string, suffix string, caseSensitive bool) bool {
 * 	if caseSensitive {
 * 		return strings.HasSuffix(s, suffix)
 * 	}
 * 	if len(suffix) > len(s) {
 * 		return false
 * 	}
 * 	return strings.EqualFold(s[len(s)-len(suffix):], suffix)
 * }
 */
export function HasSuffix(s: string, suffix: string, caseSensitive: bool): bool {
  if (caseSensitive) {
    return stringsHasSuffix(s, suffix);
  }
  if (byteLen(suffix) > byteLen(s)) {
    return false;
  }
  return EqualFold(byteSlice(s, byteLen(s) - byteLen(suffix)), suffix);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/compare.go::func::HasPrefixAndSuffixWithoutOverlap","kind":"func","status":"implemented","sigHash":"5e8d62c91cfa6feacb2c5be6647f9c4da3de3df7e17ff7326b6be16598a0111e","bodyHash":"67363b599e4b5c5ec4c1f906797c7897b48f60e61fce0ab0712293851328a04c"}
 *
 * Go source:
 * func HasPrefixAndSuffixWithoutOverlap(s string, prefix string, suffix string, caseSensitive bool) bool {
 * 	if len(prefix)+len(suffix) > len(s) {
 * 		return false
 * 	}
 * 
 * 	return HasPrefix(s, prefix, caseSensitive) && HasSuffix(s, suffix, caseSensitive)
 * }
 */
export function HasPrefixAndSuffixWithoutOverlap(s: string, prefix: string, suffix: string, caseSensitive: bool): bool {
  if (byteLen(prefix) + byteLen(suffix) > byteLen(s)) {
    return false;
  }

  return HasPrefix(s, prefix, caseSensitive) && HasSuffix(s, suffix, caseSensitive);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/compare.go::func::CompareStringsCaseInsensitiveThenSensitive","kind":"func","status":"implemented","sigHash":"01a432c5f45bd781971f304ceff94be9f254e524b91acb63b1bd289afb261262","bodyHash":"a849004fd8f5be82485e9153d2a6715adb24228cd7dd36958c60ad043f1c75e8"}
 *
 * Go source:
 * func CompareStringsCaseInsensitiveThenSensitive(a, b string) Comparison {
 * 	cmp := CompareStringsCaseInsensitive(a, b)
 * 	if cmp != ComparisonEqual {
 * 		return cmp
 * 	}
 * 	return CompareStringsCaseSensitive(a, b)
 * }
 */
export function CompareStringsCaseInsensitiveThenSensitive(a: string, b: string): Comparison {
  const cmp = CompareStringsCaseInsensitive(a, b);
  if (cmp !== ComparisonEqual) {
    return cmp;
  }
  return CompareStringsCaseSensitive(a, b);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/compare.go::func::CompareStringsCaseInsensitiveEslintCompatible","kind":"func","status":"implemented","sigHash":"012c38f98fb0864426d10fc6dc60657f740684d788847c5a15c44c7b2c34da00","bodyHash":"c46fd6519933a78bcbf81f662ce1769f499e2acfacc3ec80f7918eca2eaea75e"}
 *
 * Go source:
 * func CompareStringsCaseInsensitiveEslintCompatible(a, b string) Comparison {
 * 	if a == b {
 * 		return ComparisonEqual
 * 	}
 * 	a = strings.ToLower(a)
 * 	b = strings.ToLower(b)
 * 	return strings.Compare(a, b)
 * }
 */
export function CompareStringsCaseInsensitiveEslintCompatible(a: string, b: string): Comparison {
  if (a === b) {
    return ComparisonEqual;
  }
  a = ToLower(a);
  b = ToLower(b);
  return Compare(a, b);
}
