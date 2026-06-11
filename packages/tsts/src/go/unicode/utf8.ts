// Faithful TypeScript port of Go's `unicode/utf8` package (the subset that
// typescript-go references).
//
// Go strings are UTF-8 byte sequences and DecodeRuneInString / friends return
// byte sizes. We decode the UTF-8 byte view of the JS string so the returned
// sizes are consistent with byte-offset slicing in the ported Go code.

import type { int } from "@tsonic/core/types.js";
import type { GoRune } from "../compat.js";

// RuneError is the "error" Rune or "Unicode replacement character" (U+FFFD).
export const RuneError: GoRune = 0xfffd;

// RuneSelf is the rune below which UTF-8 encoding is a single byte (0x80).
export const RuneSelf: int = 0x80;

// MaxRune is the maximum valid Unicode code point.
export const MaxRune: GoRune = 0x10ffff;

// UTFMax is the maximum number of bytes of a UTF-8 encoded Unicode character.
export const UTFMax: int = 4;

const encoder: TextEncoder = new globalThis.TextEncoder();
const decoder: TextDecoder = new globalThis.TextDecoder("utf-8");

const encode = (s: string): Uint8Array => encoder.encode(s);

// decodeRuneBytes decodes the rune at byte offset i within bytes, returning
// [rune, sizeInBytes]. Matches utf8.DecodeRune semantics for invalid input.
const decodeRuneBytes = (bytes: Uint8Array, i: int): [GoRune, int] => {
  const n = bytes.length;
  if (i >= n) {
    return [RuneError, 0];
  }
  const b0 = bytes[i]!;
  if (b0 < 0x80) {
    return [b0, 1];
  }
  if ((b0 & 0xe0) === 0xc0) {
    if (i + 1 >= n) {
      return [RuneError, 1];
    }
    const b1 = bytes[i + 1]!;
    if ((b1 & 0xc0) !== 0x80) {
      return [RuneError, 1];
    }
    const r = ((b0 & 0x1f) << 6) | (b1 & 0x3f);
    if (r < 0x80) {
      return [RuneError, 1];
    }
    return [r, 2];
  }
  if ((b0 & 0xf0) === 0xe0) {
    if (i + 2 >= n) {
      return [RuneError, 1];
    }
    const b1 = bytes[i + 1]!;
    const b2 = bytes[i + 2]!;
    if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) {
      return [RuneError, 1];
    }
    const r = ((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f);
    if (r < 0x800 || (r >= 0xd800 && r <= 0xdfff)) {
      return [RuneError, 1];
    }
    return [r, 3];
  }
  if ((b0 & 0xf8) === 0xf0) {
    if (i + 3 >= n) {
      return [RuneError, 1];
    }
    const b1 = bytes[i + 1]!;
    const b2 = bytes[i + 2]!;
    const b3 = bytes[i + 3]!;
    if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80 || (b3 & 0xc0) !== 0x80) {
      return [RuneError, 1];
    }
    const r =
      ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
    if (r < 0x10000 || r > MaxRune) {
      return [RuneError, 1];
    }
    return [r, 4];
  }
  return [RuneError, 1];
};

export function DecodeRuneInBytesAt(bytes: Uint8Array, i: int): [GoRune, int] {
  return decodeRuneBytes(bytes, i);
}

export function DecodeLastRuneInBytesBefore(bytes: Uint8Array, end: int): [GoRune, int] {
  if (end <= 0) {
    return [RuneError, 0];
  }
  let start = end - 1;
  const b0 = bytes[start]!;
  if (b0 < RuneSelf) {
    return [b0, 1];
  }
  let lim = end - UTFMax;
  if (lim < 0) {
    lim = 0;
  }
  for (start = end - 1; start >= lim; start--) {
    if ((bytes[start]! & 0xc0) !== 0x80) {
      break;
    }
  }
  if (start < lim) {
    start = lim;
  }
  const [r, size] = decodeRuneBytes(bytes, start);
  if (start + size !== end) {
    return [RuneError, 1];
  }
  return [r, size];
}

// DecodeRuneInString unpacks the first UTF-8 encoding in s and returns the rune
// and its width in bytes. For an empty string returns [RuneError, 0]; for an
// invalid encoding returns [RuneError, 1].
export function DecodeRuneInString(s: string): [GoRune, int] {
  if (s.length === 0) {
    return [RuneError, 0];
  }
  const bytes = encode(s);
  return decodeRuneBytes(bytes, 0);
}

// DecodeLastRuneInString unpacks the last UTF-8 encoding in s and returns the
// rune and its width in bytes.
export function DecodeLastRuneInString(s: string): [GoRune, int] {
  const bytes = encode(s);
  return DecodeLastRuneInBytesBefore(bytes, bytes.length);
}

// RuneCountInString returns the number of runes in s. Erroneous and short
// encodings are treated as single runes of width 1 byte.
export function RuneCountInString(s: string): int {
  const bytes = encode(s);
  let count = 0;
  let i = 0;
  while (i < bytes.length) {
    const [, size] = decodeRuneBytes(bytes, i);
    i += size === 0 ? 1 : size;
    count++;
  }
  return count;
}

// RuneLen returns the number of bytes required to encode the rune. Returns -1
// if the rune is not a valid value to encode in UTF-8.
export function RuneLen(r: GoRune): int {
  if (r < 0) {
    return -1;
  }
  if (r < 0x80) {
    return 1;
  }
  if (r < 0x800) {
    return 2;
  }
  if (r >= 0xd800 && r <= 0xdfff) {
    return -1;
  }
  if (r <= 0xffff) {
    return 3;
  }
  if (r <= MaxRune) {
    return 4;
  }
  return -1;
}
