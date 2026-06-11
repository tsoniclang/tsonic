// Faithful TypeScript port of Go's `unicode` package (the subset that
// typescript-go references). Runes are code points (Go `rune`).

import type { bool, int } from "@tsonic/core/types.js";
import type { GoRune } from "./compat.js";

// MaxASCII is the maximum ASCII value (U+007F).
export const MaxASCII: GoRune = 0x7f;

// MaxLatin1 is the maximum Latin-1 value (U+00FF).
export const MaxLatin1: GoRune = 0xff;

// MaxRune is the maximum valid Unicode code point.
export const MaxRune: GoRune = 0x10ffff;

// ReplacementChar represents invalid code points (U+FFFD).
export const ReplacementChar: GoRune = 0xfffd;

// A Range16 represents a range of 16-bit Unicode code points, matching Go's
// unicode.Range16. The range runs from Lo to Hi inclusive, stepping by Stride.
export type Range16 = {
  readonly Lo: int;
  readonly Hi: int;
  readonly Stride: int;
};

// A Range32 represents a range of code points above 0xFFFF.
export type Range32 = {
  readonly Lo: int;
  readonly Hi: int;
  readonly Stride: int;
};

// A RangeTable defines a set of Unicode code points, matching unicode.RangeTable.
export type RangeTable = {
  readonly R16: ReadonlyArray<Range16>;
  readonly R32: ReadonlyArray<Range32>;
  readonly LatinOffset: int;
};

const inRange16 = (ranges: ReadonlyArray<Range16>, r: int): bool => {
  for (const range of ranges) {
    if (r < range.Lo) {
      return false;
    }
    if (r <= range.Hi) {
      return (r - range.Lo) % range.Stride === 0;
    }
  }
  return false;
};

const inRange32 = (ranges: ReadonlyArray<Range32>, r: int): bool => {
  for (const range of ranges) {
    if (r < range.Lo) {
      return false;
    }
    if (r <= range.Hi) {
      return (r - range.Lo) % range.Stride === 0;
    }
  }
  return false;
};

// Is reports whether the rune is in the specified table of ranges.
export function Is(rangeTab: RangeTable, r: GoRune): bool {
  if (rangeTab.R16.length > 0 && r <= rangeTab.R16[rangeTab.R16.length - 1]!.Hi) {
    return inRange16(rangeTab.R16, r);
  }
  if (rangeTab.R32.length > 0 && r >= rangeTab.R32[0]!.Lo) {
    return inRange32(rangeTab.R32, r);
  }
  return false;
}

// Zs is the set of Unicode characters in category Zs (Separator, space).
export const Zs: RangeTable = {
  R16: [
    { Lo: 0x0020, Hi: 0x0020, Stride: 1 },
    { Lo: 0x00a0, Hi: 0x00a0, Stride: 1 },
    { Lo: 0x1680, Hi: 0x1680, Stride: 1 },
    { Lo: 0x2000, Hi: 0x200a, Stride: 1 },
    { Lo: 0x202f, Hi: 0x202f, Stride: 1 },
    { Lo: 0x205f, Hi: 0x205f, Stride: 1 },
    { Lo: 0x3000, Hi: 0x3000, Stride: 1 },
  ],
  R32: [],
  LatinOffset: 2,
};

// White_Space is the set of Unicode characters with property White_Space.
export const White_Space: RangeTable = {
  R16: [
    { Lo: 0x0009, Hi: 0x000d, Stride: 1 },
    { Lo: 0x0020, Hi: 0x0020, Stride: 1 },
    { Lo: 0x0085, Hi: 0x0085, Stride: 1 },
    { Lo: 0x00a0, Hi: 0x00a0, Stride: 1 },
    { Lo: 0x1680, Hi: 0x1680, Stride: 1 },
    { Lo: 0x2000, Hi: 0x200a, Stride: 1 },
    { Lo: 0x2028, Hi: 0x2029, Stride: 1 },
    { Lo: 0x202f, Hi: 0x202f, Stride: 1 },
    { Lo: 0x205f, Hi: 0x205f, Stride: 1 },
    { Lo: 0x3000, Hi: 0x3000, Stride: 1 },
  ],
  R32: [],
  LatinOffset: 4,
};

const runeToString = (r: GoRune): string =>
  r >= 0 && r <= MaxRune && !(r >= 0xd800 && r <= 0xdfff)
    ? String.fromCodePoint(r)
    : String.fromCodePoint(ReplacementChar);

// IsDigit reports whether the rune is a decimal digit.
export function IsDigit(r: GoRune): bool {
  if (r <= MaxLatin1) {
    return r >= 0x30 && r <= 0x39;
  }
  // Unicode Nd category membership via JS regex on the code point.
  return /\p{Nd}/u.test(runeToString(r));
}

// IsLetter reports whether the rune is a letter (category L).
export function IsLetter(r: GoRune): bool {
  if (r <= MaxLatin1) {
    return (r >= 0x41 && r <= 0x5a) || (r >= 0x61 && r <= 0x7a) || r === 0xaa || r === 0xb5 || r === 0xba || (r >= 0xc0 && r <= 0xff && r !== 0xd7 && r !== 0xf7);
  }
  return /\p{L}/u.test(runeToString(r));
}

// IsLower reports whether the rune is a lower case letter.
export function IsLower(r: GoRune): bool {
  if (r <= MaxLatin1) {
    return (r >= 0x61 && r <= 0x7a) || r === 0xb5 || (r >= 0xdf && r <= 0xff && r !== 0xf7);
  }
  return /\p{Ll}/u.test(runeToString(r));
}

// IsSpace reports whether the rune is a space character as defined by Unicode's
// White Space property.
export function IsSpace(r: GoRune): bool {
  if (r <= MaxLatin1) {
    switch (r) {
      case 0x09:
      case 0x0a:
      case 0x0b:
      case 0x0c:
      case 0x0d:
      case 0x20:
      case 0x85:
      case 0xa0:
        return true;
      default:
        return false;
    }
  }
  return Is(White_Space, r);
}

// IsUpper reports whether the rune is an upper case letter.
export function IsUpper(r: GoRune): bool {
  if (r <= MaxLatin1) {
    return (r >= 0x41 && r <= 0x5a) || (r >= 0xc0 && r <= 0xde && r !== 0xd7);
  }
  return /\p{Lu}/u.test(runeToString(r));
}

// ToLower maps the rune to lower case.
export function ToLower(r: GoRune): GoRune {
  if (r <= MaxASCII) {
    return r >= 0x41 && r <= 0x5a ? r + 32 : r;
  }
  const lowered = runeToString(r).toLowerCase();
  const cp = lowered.codePointAt(0);
  return cp === undefined ? r : cp;
}

// ToUpper maps the rune to upper case.
export function ToUpper(r: GoRune): GoRune {
  if (r <= MaxASCII) {
    return r >= 0x61 && r <= 0x7a ? r - 32 : r;
  }
  const upper = runeToString(r).toUpperCase();
  const cp = upper.codePointAt(0);
  return cp === undefined ? r : cp;
}
