import type { bool, int } from "../../go/scalars.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::type::TextPos","kind":"type","status":"implemented","sigHash":"32169beeed0300bd857c14e2364f116101d40906268c86fd00602a0bfe522acf","bodyHash":"9ba11907f874e39d5ce16b8669b871bec3eccdaff1261066f48d23cd98b937f7"}
 *
 * Go source:
 * TextPos int32
 */
export type TextPos = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::type::TextRange","kind":"type","status":"implemented","sigHash":"20df3500cfc1becdb78986bc41b0917a155bab35fb0260afe1c1ee2b814a7741","bodyHash":"3b4a5663698cdc06ab549ca084111fee530eceece03d462868d2f82268a45a7c"}
 *
 * Go source:
 * TextRange struct {
 * 	pos TextPos
 * 	end TextPos
 * }
 */
export interface TextRange {
  pos: TextPos;
  end: TextPos;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::func::NewTextRange","kind":"func","status":"implemented","sigHash":"2c4d3516dcf5a77571daa77906c8945abeca5a7ea4a1ed896a0a933a8bc5389e","bodyHash":"e21b8254477c87b9b0702ad08b6692bdba321ab16a60f1cfd7895ea243e1f5aa"}
 *
 * Go source:
 * func NewTextRange(pos int, end int) TextRange {
 * 	return TextRange{pos: TextPos(pos), end: TextPos(end)}
 * }
 */
export function NewTextRange(pos: int, end: int): TextRange {
  return { pos: pos, end: end };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::func::UndefinedTextRange","kind":"func","status":"implemented","sigHash":"21cc2a442676184e9489e85a6f4a679fb6898a4c5eb65ea9456ef224118da455","bodyHash":"63b30dcf783a8b59eab1716b64b1164eb5651301b093c466fd2431650dd0e6a8"}
 *
 * Go source:
 * func UndefinedTextRange() TextRange {
 * 	return TextRange{pos: TextPos(-1), end: TextPos(-1)}
 * }
 */
export function UndefinedTextRange(): TextRange {
  return { pos: -1, end: -1 };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::method::TextRange.Pos","kind":"method","status":"implemented","sigHash":"042a668d5b785fe661b19a0c0c6473b2c254d6e1e91df7f71116583c25de113f","bodyHash":"c42639c656d5ba1967f4b8eeb4a1a3a6d2963350e790fb2b4e288b8e9f3069fd"}
 *
 * Go source:
 * func (t TextRange) Pos() int {
 * 	return int(t.pos)
 * }
 */
export function TextRange_Pos(receiver: TextRange): int {
  return receiver.pos;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::method::TextRange.End","kind":"method","status":"implemented","sigHash":"5824d3709a9febc92dda30ef70b237f697241103985e7a97390f1babaa7d226a","bodyHash":"945688064e0d093e5610ba835f5d1538d7f63e95fbc9eaf225581a46eb3a8bd6"}
 *
 * Go source:
 * func (t TextRange) End() int {
 * 	return int(t.end)
 * }
 */
export function TextRange_End(receiver: TextRange): int {
  return receiver.end;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::method::TextRange.Len","kind":"method","status":"implemented","sigHash":"8b537d8d4260740112bf374be87767586726278260fbc0bd197b265edd35a19f","bodyHash":"8de02b9c76f2e9f93839cccad80eed15491b7d18c806ba9b9bba0259eb0f6abe"}
 *
 * Go source:
 * func (t TextRange) Len() int {
 * 	return int(t.end - t.pos)
 * }
 */
export function TextRange_Len(receiver: TextRange): int {
  return receiver.end - receiver.pos;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::method::TextRange.IsValid","kind":"method","status":"implemented","sigHash":"e1481beda2a36c6f044c9edab4e367b6474e75093a7f1a06c1b1a1b43ffd1e4f","bodyHash":"938421fefc33be2549718093ff37d742495fe0da8eeda07c85fc3248d1d608ca"}
 *
 * Go source:
 * func (t TextRange) IsValid() bool {
 * 	return t.pos >= 0 || t.end >= 0
 * }
 */
export function TextRange_IsValid(receiver: TextRange): bool {
  return receiver.pos >= 0 || receiver.end >= 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::method::TextRange.Contains","kind":"method","status":"implemented","sigHash":"3035ac81a2baf7d5b7b9d950991955389e284ecbe6b59b15e7593e8e05bb26de","bodyHash":"a1e850c7c95f105966a5d200d829c40b8a2e37f5e4c4d5bfddb5347104a04e33"}
 *
 * Go source:
 * func (t TextRange) Contains(pos int) bool {
 * 	return pos >= int(t.pos) && pos < int(t.end)
 * }
 */
export function TextRange_Contains(receiver: TextRange, pos: int): bool {
  return pos >= receiver.pos && pos < receiver.end;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::method::TextRange.ContainsInclusive","kind":"method","status":"implemented","sigHash":"556f314af67c0938796cc5b2c98f3d2ae2f219edda6b43f226644f56baceb159","bodyHash":"6bbadc73f38d2b63c72786e176f149d7fe666bf44f25d7b459d200c13271b236"}
 *
 * Go source:
 * func (t TextRange) ContainsInclusive(pos int) bool {
 * 	return pos >= int(t.pos) && pos <= int(t.end)
 * }
 */
export function TextRange_ContainsInclusive(receiver: TextRange, pos: int): bool {
  return pos >= receiver.pos && pos <= receiver.end;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::method::TextRange.ContainsExclusive","kind":"method","status":"implemented","sigHash":"41bb999bf54f8d1a6d87105bf7155e62aafcfdc0fcb9c83dfc8168e36d79ca2a","bodyHash":"80a8e26d96dd93b9edcf418985f0e735d9167b7ca6534b250c4a8a6082fe03e4"}
 *
 * Go source:
 * func (t TextRange) ContainsExclusive(pos int) bool {
 * 	return int(t.pos) < pos && pos < int(t.end)
 * }
 */
export function TextRange_ContainsExclusive(receiver: TextRange, pos: int): bool {
  return receiver.pos < pos && pos < receiver.end;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::method::TextRange.WithPos","kind":"method","status":"implemented","sigHash":"98c84ae82ca14309ea00b915a694548bab00705cda0a29e80026fed162f732c8","bodyHash":"5ca2b004208ff58daaaa345eac5035c84ec6ca01af7171c45a56ecf0f5195a0f"}
 *
 * Go source:
 * func (t TextRange) WithPos(pos int) TextRange {
 * 	return TextRange{pos: TextPos(pos), end: t.end}
 * }
 */
export function TextRange_WithPos(receiver: TextRange, pos: int): TextRange {
  return { pos: pos, end: receiver.end };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::method::TextRange.WithEnd","kind":"method","status":"implemented","sigHash":"5e2909d924eed0d2a7d319c63fb59bca9870a754512ebd4b1d18804975334fc5","bodyHash":"9680028a595882599867f2fa4eec1df5f2aea72214742ca27bddccb41265a41e"}
 *
 * Go source:
 * func (t TextRange) WithEnd(end int) TextRange {
 * 	return TextRange{pos: t.pos, end: TextPos(end)}
 * }
 */
export function TextRange_WithEnd(receiver: TextRange, end: int): TextRange {
  return { pos: receiver.pos, end: end };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::method::TextRange.ContainedBy","kind":"method","status":"implemented","sigHash":"fe69174593969461f75bfe6e108c21c6527904b02f896b2b2ad1a35c828e5935","bodyHash":"a5bb0035a565fe13b63f186f0cfd1905224e37b1a24caf75523958d7895bf6a7"}
 *
 * Go source:
 * func (t TextRange) ContainedBy(t2 TextRange) bool {
 * 	return t2.pos <= t.pos && t2.end >= t.end
 * }
 */
export function TextRange_ContainedBy(receiver: TextRange, t2: TextRange): bool {
  return t2.pos <= receiver.pos && t2.end >= receiver.end;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::method::TextRange.Overlaps","kind":"method","status":"implemented","sigHash":"19deb396e435b697267facb495e0b591f05a067fa0774d4a69aac0da0d729f67","bodyHash":"39831c5a50ac9cc2421610d0cafa72a46cfeafdedf0dc0bc84ba8ffc16ba7e7b"}
 *
 * Go source:
 * func (t TextRange) Overlaps(t2 TextRange) bool {
 * 	start := max(t.pos, t2.pos)
 * 	end := min(t.end, t2.end)
 * 	return start < end
 * }
 */
export function TextRange_Overlaps(receiver: TextRange, t2: TextRange): bool {
  const start = Math.max(receiver.pos, t2.pos);
  const end = Math.min(receiver.end, t2.end);
  return start < end;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::method::TextRange.Intersects","kind":"method","status":"implemented","sigHash":"7a79448b5e75f4019be1e5ecfebaf2eec7c01d2f56c4214d064d5ec91e5d52cd","bodyHash":"9ad08ea8848a62c5ecd90fce411dde276f97cfca8e7cd7389d1c6839627e4077"}
 *
 * Go source:
 * func (t TextRange) Intersects(t2 TextRange) bool {
 * 	start := max(t.pos, t2.pos)
 * 	end := min(t.end, t2.end)
 * 	return start <= end
 * }
 */
export function TextRange_Intersects(receiver: TextRange, t2: TextRange): bool {
  const start = Math.max(receiver.pos, t2.pos);
  const end = Math.min(receiver.end, t2.end);
  return start <= end;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/text.go::func::CompareTextRanges","kind":"func","status":"implemented","sigHash":"20bfbbc454d8265dc6668fbe3368991e8c70d5f795288a61cc28b683807eb1bd","bodyHash":"e5004b79dee707c2df11fc6ce6719e67b2eb7796d9df97fc540371edc4d31ab3"}
 *
 * Go source:
 * func CompareTextRanges(r1 TextRange, r2 TextRange) int {
 * 	c := int(r1.pos) - int(r2.pos)
 * 	if c != 0 {
 * 		return c
 * 	}
 * 	return int(r1.end) - int(r2.end)
 * }
 */
export function CompareTextRanges(r1: TextRange, r2: TextRange): int {
  const c = r1.pos - r2.pos;
  if (c !== 0) {
    return c;
  }
  return r1.end - r2.end;
}
