// Faithful TypeScript port of Go's `unicode/utf8` package (the subset that
// typescript-go references).
//
// Go strings are UTF-8 byte sequences and DecodeRuneInString / friends return
// byte sizes. We decode the UTF-8 byte view of the JS string so the returned
// sizes are consistent with byte-offset slicing in the ported Go code.

import type { int } from "../scalars.js";
import type { GoRune } from "../compat.js";

// RuneError is the "error" Rune or "Unicode replacement character" (U+FFFD).
export const RuneError: GoRune = 0xfffd;

// RuneSelf is the rune below which UTF-8 encoding is a single byte (0x80).
export const RuneSelf: int = 0x80;

// MaxRune is the maximum valid Unicode code point.
export const MaxRune: GoRune = 0x10ffff;

// UTFMax is the maximum number of bytes of a UTF-8 encoded Unicode character.
export const UTFMax: int = 4;

const decoder: TextDecoder = new globalThis.TextDecoder("utf-8", { ignoreBOM: true });
const nonASCII = /[^\x00-\x7F]/;
const surrogate = /[\uD800-\uDFFF]/;

const encodeScalar = (bytes: Array<number>, codePoint: number): void => {
  if (codePoint < 0x80) {
    bytes.push(codePoint);
  } else if (codePoint < 0x800) {
    bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
  } else if (codePoint < 0x10000) {
    bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
  } else {
    bytes.push(
      0xf0 | (codePoint >> 18),
      0x80 | ((codePoint >> 12) & 0x3f),
      0x80 | ((codePoint >> 6) & 0x3f),
      0x80 | (codePoint & 0x3f),
    );
  }
};

const encode = (s: string): Uint8Array => {
  const bytes: Array<number> = [];
  for (let i = 0; i < s.length; i++) {
    const first = s.charCodeAt(i);
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (second >= 0xdc00 && second <= 0xdfff) {
        encodeScalar(bytes, 0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00));
        i++;
        continue;
      }
    }
    encodeScalar(bytes, first);
  }
  return globalThis.Uint8Array.from(bytes);
};

const decodeBytesToString = (bytes: Uint8Array): string => {
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const [r, size] = decodeRuneBytes(bytes, i);
    if (size === 0) {
      break;
    }
    if (r !== RuneError || bytes[i] === 0xef && i + 2 < bytes.length && bytes[i + 1] === 0xbf && bytes[i + 2] === 0xbd) {
      result += globalThis.String.fromCodePoint(r);
      i += size;
      continue;
    }
    if (i + 2 < bytes.length && bytes[i] === 0xed && bytes[i + 1]! >= 0xa0 && bytes[i + 1]! <= 0xbf && bytes[i + 2]! >= 0x80 && bytes[i + 2]! <= 0xbf) {
      const ch = 0xd000 | ((bytes[i + 1]! & 0x3f) << 6) | (bytes[i + 2]! & 0x3f);
      result += globalThis.String.fromCharCode(ch);
      i += 3;
      continue;
    }
    result += "\ufffd";
    i += size;
  }
  return result;
};

export type StringByteView = { ascii: boolean; bytes?: Uint8Array; hasSurrogate?: boolean };
const asciiStringByteView: StringByteView = { ascii: true };
const stringByteViewCache = new globalThis.Map<string, StringByteView>();
const stringByteViewCacheBudget = 64 * 1024 * 1024;
const stringByteViewCacheState = { bytes: 0 };

export function GetStringByteView(s: string): StringByteView {
  const cached = stringByteViewCache.get(s);
  if (cached !== undefined) {
    return cached;
  }
  const ascii = !nonASCII.test(s);
  const hasSurrogate = !ascii && surrogate.test(s);
  const view: StringByteView = ascii ? asciiStringByteView : { ascii, bytes: encode(s), hasSurrogate };
  if (s.length >= 4096) {
    const cost = ascii ? s.length : view.bytes!.length;
    if (stringByteViewCacheState.bytes + cost > stringByteViewCacheBudget) {
      stringByteViewCache.clear();
      stringByteViewCacheState.bytes = 0;
    }
    stringByteViewCache.set(s, view);
    stringByteViewCacheState.bytes += cost;
  }
  return view;
}

export function StringByteLen(s: string): int {
  const view = GetStringByteView(s);
  return StringByteViewLen(s, view);
}

export function StringByteViewLen(s: string, view: StringByteView): int {
  return view.ascii ? s.length : view.bytes!.length;
}

export function StringByteAt(s: string, i: int): int {
  const view = GetStringByteView(s);
  return StringByteViewAt(s, view, i);
}

export function StringByteViewAt(s: string, view: StringByteView, i: int): int {
  return view.ascii ? s.charCodeAt(i) : view.bytes![i]!;
}

export function StringByteSlice(s: string, start: int, end?: int): string {
  const view = GetStringByteView(s);
  return StringByteViewSlice(s, view, start, end);
}

export function StringByteViewSlice(s: string, view: StringByteView, start: int, end?: int): string {
  if (view.ascii) {
    return s.slice(start, end);
  }
  const bytes = view.bytes!.subarray(start, end);
  return view.hasSurrogate ? decodeBytesToString(bytes) : decoder.decode(bytes);
}

export function StringByteViewHasPrefix(s: string, view: StringByteView, start: int, prefix: string): boolean {
  const prefixView = GetStringByteView(prefix);
  const prefixLength = StringByteViewLen(prefix, prefixView);
  if (start + prefixLength > StringByteViewLen(s, view)) {
    return false;
  }
  for (let i = 0; i < prefixLength; i++) {
    if (StringByteViewAt(s, view, start + i) !== StringByteViewAt(prefix, prefixView, i)) {
      return false;
    }
  }
  return true;
}

export function StringByteViewIndexByte(s: string, view: StringByteView, start: int, b: int): int {
  if (view.ascii) {
    return s.indexOf(globalThis.String.fromCharCode(b), start) as int;
  }
  const bytes = view.bytes!;
  for (let i = start; i < bytes.length; i++) {
    if (bytes[i] === b) {
      return i as int;
    }
  }
  return -1 as int;
}

export function StringByteViewIndex(s: string, view: StringByteView, start: int, needle: string): int {
  const needleView = GetStringByteView(needle);
  const needleLength = StringByteViewLen(needle, needleView);
  if (needleLength === 0) {
    return start;
  }
  if (view.ascii && needleView.ascii) {
    return s.indexOf(needle, start) as int;
  }
  const end = StringByteViewLen(s, view) - needleLength;
  for (let i = start; i <= end; i++) {
    let matched = true;
    for (let j = 0; j < needleLength; j++) {
      if (StringByteViewAt(s, view, i + j) !== StringByteViewAt(needle, needleView, j)) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return i as int;
    }
  }
  return -1 as int;
}

export function StringByteViewUTF16Len(s: string, view: StringByteView, start: int, end: int): int {
  if (view.ascii) {
    return (end - start) as int;
  }
  let length: int = 0;
  let pos = start;
  while (pos < end) {
    const [r, size] = DecodeRuneInStringViewAt(s, view, pos);
    if (size === 0) {
      break;
    }
    length += r >= 0x10000 ? 2 : 1;
    pos += size;
  }
  return length;
}

export function StringUtf8Bytes(s: string): Uint8Array {
  const view = GetStringByteView(s);
  if (!view.ascii) {
    return view.bytes!;
  }
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    bytes[i] = s.charCodeAt(i);
  }
  return bytes;
}

export function StringFromUtf8Bytes(bytes: Uint8Array): string {
  return decodeBytesToString(bytes);
}

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
  return DecodeRuneInStringAt(s, 0);
}

export function DecodeRuneInStringAt(s: string, i: int): [GoRune, int] {
  const view = GetStringByteView(s);
  return DecodeRuneInStringViewAt(s, view, i);
}

export function DecodeRuneInStringViewAt(s: string, view: StringByteView, i: int): [GoRune, int] {
  if (view.ascii) {
    return i >= s.length ? [RuneError, 0] : [s.charCodeAt(i), 1];
  }
  return decodeRuneBytes(view.bytes!, i);
}

// DecodeLastRuneInString unpacks the last UTF-8 encoding in s and returns the
// rune and its width in bytes.
export function DecodeLastRuneInString(s: string): [GoRune, int] {
  return DecodeLastRuneInStringBefore(s, StringByteLen(s));
}

export function DecodeLastRuneInStringBefore(s: string, end: int): [GoRune, int] {
  const view = GetStringByteView(s);
  return DecodeLastRuneInStringViewBefore(s, view, end);
}

export function DecodeLastRuneInStringViewBefore(s: string, view: StringByteView, end: int): [GoRune, int] {
  if (view.ascii) {
    return end <= 0 ? [RuneError, 0] : [s.charCodeAt(end - 1), 1];
  }
  return DecodeLastRuneInBytesBefore(view.bytes!, end);
}

// RuneCountInString returns the number of runes in s. Erroneous and short
// encodings are treated as single runes of width 1 byte.
export function RuneCountInString(s: string): int {
  const bytes = StringUtf8Bytes(s);
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
