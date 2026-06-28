import { DecodeRuneInStringAt, RuneSelf, StringByteAt, StringByteLen } from "../../go/unicode/utf8.js";
// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length,
// `s[i]` reads a byte, and slices like `s[i:]` operate on byte offsets. We
// mirror that contract by operating over the UTF-8 byte view of the JS string.
const byteLen = StringByteLen;
const byteAt = StringByteAt;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/positionmap.go::func::ComputePositionMap","kind":"func","status":"implemented","sigHash":"fff86f76341e89022ab461dc09de223a2c9e92843e134094017d124b9fd2c221","bodyHash":"0e718a3bcab5bea0b8a36e8348be3f3195be41f2ee72b897913a3f85a5e9ef15"}
 *
 * Go source:
 * func ComputePositionMap(text string) *PositionMap {
 * 	pm := &PositionMap{}
 * 	delta := 0
 * 	for i := 0; i < len(text); {
 * 		b := text[i]
 * 		if b < utf8.RuneSelf {
 * 			i++
 * 			continue
 * 		}
 * 		r, size := utf8.DecodeRuneInString(text[i:])
 * 		utf16Size := 1
 * 		if r >= 0x10000 {
 * 			utf16Size = 2
 * 		}
 * 		delta += size - utf16Size
 * 		pm.entries = append(pm.entries, positionMapEntry{utf8Pos: i + size, delta: delta})
 * 		i += size
 * 	}
 * 	pm.asciiOnly = len(pm.entries) == 0
 * 	return pm
 * }
 */
export function ComputePositionMap(text) {
    const entries = [];
    let delta = 0;
    let i = 0;
    const n = byteLen(text);
    while (i < n) {
        const b = byteAt(text, i);
        if (b < RuneSelf) {
            i++;
            continue;
        }
        const [r, size] = DecodeRuneInStringAt(text, i);
        let utf16Size = 1;
        if (r >= 0x10000) {
            utf16Size = 2;
        }
        delta += size - utf16Size;
        entries.push({ utf8Pos: i + size, delta: delta });
        i += size;
    }
    const pm = {
        asciiOnly: entries.length === 0,
        entries: entries,
    };
    return pm;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/positionmap.go::method::PositionMap.IsAsciiOnly","kind":"method","status":"implemented","sigHash":"3ca6e7a255b0bda5f4a4905f20447b628326a55271f6b6aae5309186ffff9786","bodyHash":"964995c6fd9041f3f12f53d1bd679a566c9da369b54095bd9136c5f16543b56f"}
 *
 * Go source:
 * func (pm *PositionMap) IsAsciiOnly() bool {
 * 	return pm.asciiOnly
 * }
 */
export function PositionMap_IsAsciiOnly(receiver) {
    return receiver.asciiOnly;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/positionmap.go::method::PositionMap.UTF8ToUTF16","kind":"method","status":"implemented","sigHash":"ec6d98013f62f40cfe05a12d91f9b5db522abda6a71167adee816ba96db7897c","bodyHash":"1d8b1ed4fb218a77f02494dff26037bfeeb7c760c22f21818ed22f621bff04eb"}
 *
 * Go source:
 * func (pm *PositionMap) UTF8ToUTF16(utf8Offset int) int {
 * 	if pm.asciiOnly {
 * 		return utf8Offset
 * 	}
 * 	// Binary search: find the last entry where utf8Pos <= utf8Offset
 * 	lo, hi := 0, len(pm.entries)
 * 	for lo < hi {
 * 		mid := lo + (hi-lo)/2
 * 		if pm.entries[mid].utf8Pos <= utf8Offset {
 * 			lo = mid + 1
 * 		} else {
 * 			hi = mid
 * 		}
 * 	}
 * 	if lo == 0 {
 * 		// Before any multi-byte character
 * 		return utf8Offset
 * 	}
 * 	return utf8Offset - pm.entries[lo-1].delta
 * }
 */
export function PositionMap_UTF8ToUTF16(receiver, utf8Offset) {
    if (receiver.asciiOnly) {
        return utf8Offset;
    }
    // Binary search: find the last entry where utf8Pos <= utf8Offset
    let lo = 0;
    let hi = receiver.entries.length;
    while (lo < hi) {
        const mid = lo + Math.trunc((hi - lo) / 2);
        if (receiver.entries[mid].utf8Pos <= utf8Offset) {
            lo = mid + 1;
        }
        else {
            hi = mid;
        }
    }
    if (lo === 0) {
        // Before any multi-byte character
        return utf8Offset;
    }
    return utf8Offset - receiver.entries[lo - 1].delta;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/positionmap.go::method::PositionMap.UTF16ToUTF8","kind":"method","status":"implemented","sigHash":"8d4c98ac64241c4ce3e00e20529e6736fdb1f59747a8972425bf0d9a0d8726ce","bodyHash":"20de00b26bea07006a2628c1d0ebba09e8c0015880626cd464f33fd382ac26dc"}
 *
 * Go source:
 * func (pm *PositionMap) UTF16ToUTF8(utf16Offset int) int {
 * 	if pm.asciiOnly {
 * 		return utf16Offset
 * 	}
 * 	// We need the last entry where (utf8Pos - delta) <= utf16Offset.
 * 	// (utf8Pos - delta) is the UTF-16 offset of that entry's character.
 * 	lo, hi := 0, len(pm.entries)
 * 	for lo < hi {
 * 		mid := lo + (hi-lo)/2
 * 		utf16Pos := pm.entries[mid].utf8Pos - pm.entries[mid].delta
 * 		if utf16Pos <= utf16Offset {
 * 			lo = mid + 1
 * 		} else {
 * 			hi = mid
 * 		}
 * 	}
 * 	if lo == 0 {
 * 		return utf16Offset
 * 	}
 * 	return utf16Offset + pm.entries[lo-1].delta
 * }
 */
export function PositionMap_UTF16ToUTF8(receiver, utf16Offset) {
    if (receiver.asciiOnly) {
        return utf16Offset;
    }
    // We need the last entry where (utf8Pos - delta) <= utf16Offset.
    // (utf8Pos - delta) is the UTF-16 offset of that entry's character.
    let lo = 0;
    let hi = receiver.entries.length;
    while (lo < hi) {
        const mid = lo + Math.trunc((hi - lo) / 2);
        const utf16Pos = receiver.entries[mid].utf8Pos - receiver.entries[mid].delta;
        if (utf16Pos <= utf16Offset) {
            lo = mid + 1;
        }
        else {
            hi = mid;
        }
    }
    if (lo === 0) {
        return utf16Offset;
    }
    return utf16Offset + receiver.entries[lo - 1].delta;
}
//# sourceMappingURL=positionmap.js.map