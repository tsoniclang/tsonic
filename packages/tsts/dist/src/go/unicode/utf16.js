// Faithful TypeScript port of Go's `unicode/utf16` package (the subset that
// typescript-go references).
// replacementChar is U+FFFD, the Unicode replacement character.
const replacementChar = 0xfffd;
// maxRune is the maximum valid Unicode code point.
const maxRune = 0x10ffff;
const surr1 = 0xd800;
const surr2 = 0xdc00;
const surr3 = 0xe000;
const surrSelf = 0x10000;
// AppendRune appends the UTF-16 encoding of rune r to the slice a and returns
// the extended slice. Mutation-free style: returns a new slice like Go append.
export function AppendRune(a, r) {
    if (r >= 0 && r < surrSelf) {
        if (r >= surr1 && r < surr3) {
            // Surrogate-half value: not a valid scalar; emit replacement.
            return [...a, replacementChar];
        }
        return [...a, r];
    }
    if (r >= surrSelf && r <= maxRune) {
        const v = r - surrSelf;
        const r1 = surr1 + ((v >> 10) & 0x3ff);
        const r2 = surr2 + (v & 0x3ff);
        return [...a, r1, r2];
    }
    return [...a, replacementChar];
}
// Decode returns the Unicode code points represented by the UTF-16 encoding s.
// Unpaired surrogates are decoded as the replacement character.
export function Decode(s) {
    const result = [];
    let i = 0;
    const n = s.length;
    while (i < n) {
        const r = s[i];
        if (r < surr1 || surr3 <= r) {
            // Normal rune (not a surrogate half).
            result.push(r);
            i++;
        }
        else if (surr1 <= r && r < surr2 && i + 1 < n && surr2 <= s[i + 1] && s[i + 1] < surr3) {
            // Valid surrogate pair.
            const r2 = s[i + 1];
            const dec = (r - surr1) * 0x400 + (r2 - surr2) + surrSelf;
            result.push(dec);
            i += 2;
        }
        else {
            // Invalid surrogate sequence.
            result.push(replacementChar);
            i++;
        }
    }
    return result;
}
// Encode returns the UTF-16 encoding of the Unicode code point sequence s.
export function Encode(s) {
    let out = [];
    for (const r of s) {
        out = AppendRune(out, r);
    }
    return out;
}
// RuneLen returns the number of 16-bit words in the UTF-16 encoding of the rune.
// It returns -1 if the rune is not a valid value to encode in UTF-16.
export function RuneLen(r) {
    if ((0 <= r && r < surr1) || (surr3 <= r && r < surrSelf)) {
        return 1;
    }
    if (surrSelf <= r && r <= maxRune) {
        return 2;
    }
    return -1;
}
// IsSurrogate reports whether the specified Unicode code point can appear in a
// surrogate pair.
export function IsSurrogate(r) {
    return surr1 <= r && r < surr3;
}
// DecodeRune returns the UTF-16 decoding of a surrogate pair. If the pair is
// not a valid UTF-16 surrogate pair, DecodeRune returns the replacement char.
export function DecodeRune(r1, r2) {
    if (surr1 <= r1 && r1 < surr2 && surr2 <= r2 && r2 < surr3) {
        return (r1 - surr1) * 0x400 + (r2 - surr2) + surrSelf;
    }
    return replacementChar;
}
// EncodeRune returns the UTF-16 surrogate pair r1, r2 for the given rune. If
// the rune is not a valid Unicode code point or does not need encoding,
// EncodeRune returns [replacementChar, replacementChar].
export function EncodeRune(r) {
    if (r < surrSelf || r > maxRune) {
        return [replacementChar, replacementChar];
    }
    const v = r - surrSelf;
    return [surr1 + ((v >> 10) & 0x3ff), surr2 + (v & 0x3ff)];
}
//# sourceMappingURL=utf16.js.map