import type { bool, int } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import { Contains, HasPrefix, HasSuffix, Index } from "../../go/strings.js";

// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length and
// slices like `s[i:j]` operate on byte offsets. The strings facade returns byte
// offsets (e.g. Index), so we mirror that contract by operating over the UTF-8
// byte view and converting back to a JS string at the boundaries.
const utf8Encoder: TextEncoder = new globalThis.TextEncoder();
const utf8Decoder: TextDecoder = new globalThis.TextDecoder("utf-8");
const byteLen = (s: string): int => utf8Encoder.encode(s).length;
const byteSlice = (s: string, start: int, end?: int): string => {
  const bytes = utf8Encoder.encode(s);
  return utf8Decoder.decode(bytes.subarray(start, end));
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/pattern.go::type::Pattern","kind":"type","status":"implemented","sigHash":"dd03a266349ffcf77c90546d0a6342b073443c33b70aa03df6d2d76f28737166","bodyHash":"5fd75a7ccfe7ddd30cc5a7bcc8d9b1201ccda54850f42e5a7c187db17951f7fa"}
 *
 * Go source:
 * Pattern struct {
 * 	Text      string
 * 	StarIndex int // -1 for exact match
 * }
 */
export interface Pattern {
  Text: string;
  StarIndex: int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/pattern.go::func::TryParsePattern","kind":"func","status":"implemented","sigHash":"02725d3904ee7a8ca695073dcea673da0b21e54761ff7d0f241fa669d83b003d","bodyHash":"b2ae1e0a8f7cb3a2ec540050eb12483e73b523bb2304befb5c5b075b99176c3a"}
 *
 * Go source:
 * func TryParsePattern(pattern string) Pattern {
 * 	starIndex := strings.Index(pattern, "*")
 * 	if starIndex == -1 || !strings.Contains(pattern[starIndex+1:], "*") {
 * 		return Pattern{Text: pattern, StarIndex: starIndex}
 * 	}
 * 	return Pattern{}
 * }
 */
export function TryParsePattern(pattern: string): Pattern {
  const starIndex = Index(pattern, "*");
  if (starIndex === -1 || !Contains(byteSlice(pattern, starIndex + 1), "*")) {
    return { Text: pattern, StarIndex: starIndex };
  }
  return { Text: "", StarIndex: 0 };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/pattern.go::method::Pattern.IsValid","kind":"method","status":"implemented","sigHash":"2a53381f9e629d07c93e254ff97380fa4001e02d13cde6d16c96e35cb6458070","bodyHash":"30e8f5fdea9f2df45be4676fd8157ff1fd8de602cd12cd217bc79e701ffce50c"}
 *
 * Go source:
 * func (p *Pattern) IsValid() bool {
 * 	return p.StarIndex == -1 || p.StarIndex < len(p.Text)
 * }
 */
export function Pattern_IsValid(receiver: GoPtr<Pattern>): bool {
  const p = receiver!;
  return p.StarIndex === -1 || p.StarIndex < byteLen(p.Text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/pattern.go::method::Pattern.Matches","kind":"method","status":"implemented","sigHash":"a3ec44c05de1eded892f96c3debcb3682317b700dd7c6d323cd34416002d4f54","bodyHash":"4bd59eb093ea857f03dee4e2059e8fcc22c101d546eb80bd48b119ea97a8bde0"}
 *
 * Go source:
 * func (p *Pattern) Matches(candidate string) bool {
 * 	if p.StarIndex == -1 {
 * 		return p.Text == candidate
 * 	}
 * 	return len(candidate) >= len(p.Text)-1 &&
 * 		strings.HasPrefix(candidate, p.Text[:p.StarIndex]) &&
 * 		strings.HasSuffix(candidate, p.Text[p.StarIndex+1:])
 * }
 */
export function Pattern_Matches(receiver: GoPtr<Pattern>, candidate: string): bool {
  const p = receiver!;
  if (p.StarIndex === -1) {
    return p.Text === candidate;
  }
  return (
    byteLen(candidate) >= byteLen(p.Text) - 1 &&
    HasPrefix(candidate, byteSlice(p.Text, 0, p.StarIndex)) &&
    HasSuffix(candidate, byteSlice(p.Text, p.StarIndex + 1))
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/pattern.go::method::Pattern.MatchedText","kind":"method","status":"implemented","sigHash":"5935931459d8f837801507ed9bcdb7778e7fc5005e73d33740ae11ee5c24da81","bodyHash":"c5f7998631855961bb7430aa3947689a5fa6a9ad30d75d8ec4c215d3c9f2bf4b"}
 *
 * Go source:
 * func (p *Pattern) MatchedText(candidate string) string {
 * 	if !p.Matches(candidate) {
 * 		panic("candidate does not match pattern")
 * 	}
 * 	if p.StarIndex == -1 {
 * 		return ""
 * 	}
 * 	return candidate[p.StarIndex : len(candidate)-len(p.Text)+p.StarIndex+1]
 * }
 */
export function Pattern_MatchedText(receiver: GoPtr<Pattern>, candidate: string): string {
  const p = receiver!;
  if (!Pattern_Matches(p, candidate)) {
    throw new globalThis.Error("candidate does not match pattern");
  }
  if (p.StarIndex === -1) {
    return "";
  }
  return byteSlice(candidate, p.StarIndex, byteLen(candidate) - byteLen(p.Text) + p.StarIndex + 1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/pattern.go::func::FindBestPatternMatch","kind":"func","status":"implemented","sigHash":"ee5f33df4d5e42a42ee65593218eaeb0eefa4c62b87d10f487d894afc491329c","bodyHash":"733cfbb1e35126d494633f02fe8a128cd6f84f0500b2dd5e316ec73e547de4c9"}
 *
 * Go source:
 * func FindBestPatternMatch[T any](values []T, getPattern func(v T) Pattern, candidate string) T {
 * 	var bestPattern T
 * 	longestMatchPrefixLength := -1
 * 	for _, value := range values {
 * 		pattern := getPattern(value)
 * 		if (pattern.StarIndex == -1 || pattern.StarIndex > longestMatchPrefixLength) && pattern.Matches(candidate) {
 * 			bestPattern = value
 * 			longestMatchPrefixLength = pattern.StarIndex
 * 		}
 * 	}
 * 	return bestPattern
 * }
 */
export function FindBestPatternMatch<T>(values: GoSlice<T>, getPattern: (v: T) => Pattern, candidate: string): T {
  let bestPattern = undefined as T;
  let longestMatchPrefixLength = -1;
  for (const value of values) {
    const pattern = getPattern(value);
    if ((pattern.StarIndex === -1 || pattern.StarIndex > longestMatchPrefixLength) && Pattern_Matches(pattern, candidate)) {
      bestPattern = value;
      longestMatchPrefixLength = pattern.StarIndex;
    }
  }
  return bestPattern;
}
