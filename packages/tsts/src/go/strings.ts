// Faithful TypeScript port of Go's `strings` package.
//
// Go strings are immutable UTF-8 byte sequences. Functions that return an
// index (Index, IndexByte, IndexRune, LastIndex, Count, ...) return BYTE
// offsets, and callers slice the string by those byte offsets. To keep that
// contract self-consistent we operate over the UTF-8 byte view of the string
// and convert back to a JavaScript string at the boundaries.

import type { bool, int, byte } from "@tsonic/core/types.js";
import type { GoRune, GoSlice } from "./compat.js";

const utf8Encoder: TextEncoder = new globalThis.TextEncoder();
const utf8Decoder: TextDecoder = new globalThis.TextDecoder("utf-8");

const encode = (s: string): Uint8Array => utf8Encoder.encode(s);
const decode = (bytes: Uint8Array): string => utf8Decoder.decode(bytes);

// RuneError mirrors unicode/utf8.RuneError (U+FFFD, the replacement char).
const RuneErrorValue: GoRune = 0xfffd;
const RuneSelfValue: int = 0x80;
const MaxRune: GoRune = 0x10ffff;

// decodeRune decodes the UTF-8 rune starting at byte offset i in bytes and
// returns [rune, sizeInBytes], matching utf8.DecodeRune semantics.
const decodeRune = (bytes: Uint8Array, i: int): [GoRune, int] => {
  const n = bytes.length;
  if (i >= n) {
    return [RuneErrorValue, 0];
  }
  const b0 = bytes[i]!;
  if (b0 < 0x80) {
    return [b0, 1];
  }
  if ((b0 & 0xe0) === 0xc0) {
    if (i + 1 >= n) {
      return [RuneErrorValue, 1];
    }
    const b1 = bytes[i + 1]!;
    if ((b1 & 0xc0) !== 0x80) {
      return [RuneErrorValue, 1];
    }
    const r = ((b0 & 0x1f) << 6) | (b1 & 0x3f);
    if (r < 0x80) {
      return [RuneErrorValue, 1];
    }
    return [r, 2];
  }
  if ((b0 & 0xf0) === 0xe0) {
    if (i + 2 >= n) {
      return [RuneErrorValue, 1];
    }
    const b1 = bytes[i + 1]!;
    const b2 = bytes[i + 2]!;
    if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) {
      return [RuneErrorValue, 1];
    }
    const r = ((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f);
    if (r < 0x800 || (r >= 0xd800 && r <= 0xdfff)) {
      return [RuneErrorValue, 1];
    }
    return [r, 3];
  }
  if ((b0 & 0xf8) === 0xf0) {
    if (i + 3 >= n) {
      return [RuneErrorValue, 1];
    }
    const b1 = bytes[i + 1]!;
    const b2 = bytes[i + 2]!;
    const b3 = bytes[i + 3]!;
    if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80 || (b3 & 0xc0) !== 0x80) {
      return [RuneErrorValue, 1];
    }
    const r =
      ((b0 & 0x07) << 18) |
      ((b1 & 0x3f) << 12) |
      ((b2 & 0x3f) << 6) |
      (b3 & 0x3f);
    if (r < 0x10000 || r > MaxRune) {
      return [RuneErrorValue, 1];
    }
    return [r, 4];
  }
  return [RuneErrorValue, 1];
};

// runeLen returns the number of bytes required to encode rune r as UTF-8.
const runeLen = (r: GoRune): int => {
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
};

// encodeRune writes rune r as UTF-8 into out, returning the number of bytes.
const encodeRune = (out: Array<byte>, r: GoRune): int => {
  const cp = r < 0 || r > MaxRune || (r >= 0xd800 && r <= 0xdfff) ? RuneErrorValue : r;
  if (cp < 0x80) {
    out.push(cp);
    return 1;
  }
  if (cp < 0x800) {
    out.push(0xc0 | (cp >> 6));
    out.push(0x80 | (cp & 0x3f));
    return 2;
  }
  if (cp < 0x10000) {
    out.push(0xe0 | (cp >> 12));
    out.push(0x80 | ((cp >> 6) & 0x3f));
    out.push(0x80 | (cp & 0x3f));
    return 3;
  }
  out.push(0xf0 | (cp >> 18));
  out.push(0x80 | ((cp >> 12) & 0x3f));
  out.push(0x80 | ((cp >> 6) & 0x3f));
  out.push(0x80 | (cp & 0x3f));
  return 4;
};

// runeToString converts a single rune to its UTF-8 string (Go's string(rune)).
const runeToString = (r: GoRune): string => {
  const out: Array<byte> = [];
  encodeRune(out, r);
  return decode(Uint8Array.from(out));
};

// indexOfBytes returns the byte offset of the first occurrence of needle in
// haystack, or -1. Both are UTF-8 byte arrays.
const indexOfBytes = (haystack: Uint8Array, needle: Uint8Array): int => {
  const hn = haystack.length;
  const nn = needle.length;
  if (nn === 0) {
    return 0;
  }
  if (nn > hn) {
    return -1;
  }
  for (let i = 0; i <= hn - nn; i++) {
    let match = true;
    for (let j = 0; j < nn; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return i;
    }
  }
  return -1;
};

const lastIndexOfBytes = (haystack: Uint8Array, needle: Uint8Array): int => {
  const hn = haystack.length;
  const nn = needle.length;
  if (nn === 0) {
    return hn;
  }
  if (nn > hn) {
    return -1;
  }
  for (let i = hn - nn; i >= 0; i--) {
    let match = true;
    for (let j = 0; j < nn; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return i;
    }
  }
  return -1;
};

// Builder is Go's strings.Builder: a mutable accumulator of bytes that yields
// a string via String().
export class Builder {
  private buf: Array<byte> = [];

  String(): string {
    return decode(Uint8Array.from(this.buf));
  }

  Len(): int {
    return this.buf.length;
  }

  Reset(): void {
    this.buf = [];
  }

  // Grow is a capacity hint in Go; a no-op here is faithful (it only affects
  // allocation, never observable contents).
  Grow(_n: int): void {
    // no-op: capacity reservation has no observable effect
  }

  WriteString(s: string): [int, Error | undefined] {
    const bytes = encode(s);
    for (const b of bytes) {
      this.buf.push(b);
    }
    return [bytes.length, undefined];
  }

  WriteByte(c: byte): Error | undefined {
    this.buf.push(c & 0xff);
    return undefined;
  }

  WriteRune(r: GoRune): [int, Error | undefined] {
    const before = this.buf.length;
    encodeRune(this.buf, r);
    return [this.buf.length - before, undefined];
  }

  Write(p: GoSlice<byte>): [int, Error | undefined] {
    for (const b of p) {
      this.buf.push(b & 0xff);
    }
    return [p.length, undefined];
  }
}

// Clone returns a copy of s. JS strings are immutable so this returns s.
export function Clone(s: string): string {
  return s;
}

// Compare returns -1, 0, or 1 comparing a and b as byte sequences.
export function Compare(a: string, b: string): int {
  if (a === b) {
    return 0;
  }
  const ab = encode(a);
  const bb = encode(b);
  const n = Math.min(ab.length, bb.length);
  for (let i = 0; i < n; i++) {
    const x = ab[i]!;
    const y = bb[i]!;
    if (x < y) {
      return -1;
    }
    if (x > y) {
      return 1;
    }
  }
  if (ab.length < bb.length) {
    return -1;
  }
  if (ab.length > bb.length) {
    return 1;
  }
  return 0;
}

export function Contains(s: string, substr: string): bool {
  return Index(s, substr) >= 0;
}

export function ContainsAny(s: string, chars: string): bool {
  return IndexAny(s, chars) >= 0;
}

export function ContainsRune(s: string, r: GoRune): bool {
  return IndexRune(s, r) >= 0;
}

// Count counts non-overlapping instances of substr in s. The empty substr
// matches at every rune boundary plus the end, returning runeCount+1.
export function Count(s: string, substr: string): int {
  if (substr.length === 0) {
    return runeCount(s) + 1;
  }
  const sb = encode(s);
  const subb = encode(substr);
  let n = 0;
  let from = 0;
  for (;;) {
    const idx = indexOfBytes(sb.subarray(from), subb);
    if (idx < 0) {
      return n;
    }
    n++;
    from += idx + subb.length;
  }
}

const runeCount = (s: string): int => {
  const bytes = encode(s);
  let count = 0;
  let i = 0;
  while (i < bytes.length) {
    const [, size] = decodeRune(bytes, i);
    i += size === 0 ? 1 : size;
    count++;
  }
  return count;
};

// Cut slices s around the first instance of sep, returning [before, after, found].
export function Cut(s: string, sep: string): [string, string, bool] {
  const i = Index(s, sep);
  if (i >= 0) {
    const bytes = encode(s);
    const before = decode(bytes.subarray(0, i));
    const after = decode(bytes.subarray(i + encode(sep).length));
    return [before, after, true];
  }
  return [s, "", false];
}

export function CutPrefix(s: string, prefix: string): [string, bool] {
  if (!HasPrefix(s, prefix)) {
    return [s, false];
  }
  return [TrimPrefix(s, prefix), true];
}

export function CutSuffix(s: string, suffix: string): [string, bool] {
  if (!HasSuffix(s, suffix)) {
    return [s, false];
  }
  return [TrimSuffix(s, suffix), true];
}

// EqualFold reports whether s and t are equal under simple Unicode case-folding.
export function EqualFold(s: string, t: string): bool {
  const sb = encode(s);
  const tb = encode(t);
  let i = 0;
  let j = 0;
  for (;;) {
    if (i >= sb.length || j >= tb.length) {
      return i === sb.length && j === tb.length;
    }
    const [sr, sSize] = decodeRune(sb, i);
    const [tr, tSize] = decodeRune(tb, j);
    i += sSize === 0 ? 1 : sSize;
    j += tSize === 0 ? 1 : tSize;
    if (sr === tr) {
      continue;
    }
    if (simpleFold(sr) !== simpleFold(tr)) {
      return false;
    }
  }
}

// simpleFold maps a rune to a canonical case-folded form (lower case here,
// which is sufficient for the ASCII/BMP comparisons typescript-go relies on).
const simpleFold = (r: GoRune): GoRune => {
  const lowered = runeToString(r).toLowerCase();
  const cp = lowered.codePointAt(0);
  return cp === undefined ? r : cp;
};

const isSpaceRune = (r: GoRune): bool => {
  switch (r) {
    case 0x09: // \t
    case 0x0a: // \n
    case 0x0b: // \v
    case 0x0c: // \f
    case 0x0d: // \r
    case 0x20: // space
    case 0x85: // NEL
    case 0xa0: // NBSP
      return true;
    default:
      break;
  }
  if (r < 0x2000) {
    return false;
  }
  switch (r) {
    case 0x1680:
    case 0x2000:
    case 0x2001:
    case 0x2002:
    case 0x2003:
    case 0x2004:
    case 0x2005:
    case 0x2006:
    case 0x2007:
    case 0x2008:
    case 0x2009:
    case 0x200a:
    case 0x2028:
    case 0x2029:
    case 0x202f:
    case 0x205f:
    case 0x3000:
      return true;
    default:
      return false;
  }
};

// Fields splits s around runs of whitespace, returning the resulting slice.
export function Fields(s: string): GoSlice<string> {
  return FieldsFunc(s, isSpaceRune);
}

export function FieldsFunc(s: string, f: (r: GoRune) => bool): GoSlice<string> {
  const bytes = encode(s);
  const result: Array<string> = [];
  let i = 0;
  let start = -1;
  while (i < bytes.length) {
    const [r, size] = decodeRune(bytes, i);
    const adv = size === 0 ? 1 : size;
    if (f(r)) {
      if (start >= 0) {
        result.push(decode(bytes.subarray(start, i)));
        start = -1;
      }
    } else if (start < 0) {
      start = i;
    }
    i += adv;
  }
  if (start >= 0) {
    result.push(decode(bytes.subarray(start, bytes.length)));
  }
  return result;
}

export function HasPrefix(s: string, prefix: string): bool {
  return s.startsWith(prefix);
}

export function HasSuffix(s: string, suffix: string): bool {
  return s.endsWith(suffix);
}

// Index returns the byte index of the first instance of substr in s, or -1.
export function Index(s: string, substr: string): int {
  return indexOfBytes(encode(s), encode(substr));
}

// IndexAny returns the byte index of the first occurrence in s of any rune in chars.
export function IndexAny(s: string, chars: string): int {
  if (chars.length === 0) {
    return -1;
  }
  const charsSet = new Set<GoRune>();
  const cb = encode(chars);
  {
    let i = 0;
    while (i < cb.length) {
      const [r, size] = decodeRune(cb, i);
      charsSet.add(r);
      i += size === 0 ? 1 : size;
    }
  }
  const bytes = encode(s);
  let i = 0;
  while (i < bytes.length) {
    const [r, size] = decodeRune(bytes, i);
    if (charsSet.has(r)) {
      return i;
    }
    i += size === 0 ? 1 : size;
  }
  return -1;
}

// IndexByte returns the byte index of the first instance of byte c in s, or -1.
export function IndexByte(s: string, c: byte): int {
  const bytes = encode(s);
  const target = c & 0xff;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === target) {
      return i;
    }
  }
  return -1;
}

// IndexFunc returns the byte index of the first rune satisfying f, or -1.
export function IndexFunc(s: string, f: (r: GoRune) => bool): int {
  const bytes = encode(s);
  let i = 0;
  while (i < bytes.length) {
    const [r, size] = decodeRune(bytes, i);
    if (f(r)) {
      return i;
    }
    i += size === 0 ? 1 : size;
  }
  return -1;
}

// IndexRune returns the byte index of the first instance of rune r in s, or -1.
export function IndexRune(s: string, r: GoRune): int {
  if (r === RuneErrorValue) {
    const bytes = encode(s);
    let i = 0;
    while (i < bytes.length) {
      const [rr, size] = decodeRune(bytes, i);
      if (rr === RuneErrorValue) {
        return i;
      }
      i += size === 0 ? 1 : size;
    }
    return -1;
  }
  return Index(s, runeToString(r));
}

// Join concatenates elements of elems, inserting sep between them.
export function Join(elems: GoSlice<string>, sep: string): string {
  return elems.join(sep);
}

// LastIndex returns the byte index of the last instance of substr in s, or -1.
export function LastIndex(s: string, substr: string): int {
  return lastIndexOfBytes(encode(s), encode(substr));
}

export function LastIndexByte(s: string, c: byte): int {
  const bytes = encode(s);
  const target = c & 0xff;
  for (let i = bytes.length - 1; i >= 0; i--) {
    if (bytes[i] === target) {
      return i;
    }
  }
  return -1;
}

// LastIndexFunc returns the byte index of the last rune satisfying f, or -1.
export function LastIndexFunc(s: string, f: (r: GoRune) => bool): int {
  const bytes = encode(s);
  let last = -1;
  let i = 0;
  while (i < bytes.length) {
    const [r, size] = decodeRune(bytes, i);
    if (f(r)) {
      last = i;
    }
    i += size === 0 ? 1 : size;
  }
  return last;
}

// Lines returns an iterator over the newline-terminated lines of s, faithful
// to Go 1.24's strings.Lines (each yielded line includes its terminator).
export function Lines(s: string): (yieldValue: (line: string) => bool) => void {
  return (yieldValue: (line: string) => bool): void => {
    let rest = s;
    while (rest.length > 0) {
      const nl = rest.indexOf("\n");
      if (nl < 0) {
        yieldValue(rest);
        return;
      }
      const line = rest.substring(0, nl + 1);
      if (!yieldValue(line)) {
        return;
      }
      rest = rest.substring(nl + 1);
    }
  };
}

// Map returns a copy of s with each rune mapped by mapping; runes mapped to a
// negative value are dropped.
export function Map(mapping: (r: GoRune) => GoRune, s: string): string {
  const bytes = encode(s);
  const out: Array<byte> = [];
  let i = 0;
  while (i < bytes.length) {
    const [r, size] = decodeRune(bytes, i);
    const adv = size === 0 ? 1 : size;
    const mapped = mapping(r);
    if (mapped >= 0) {
      encodeRune(out, mapped);
    }
    i += adv;
  }
  return decode(Uint8Array.from(out));
}

// Reader is the value returned by NewReader: a read cursor over a string.
export class Reader {
  private readonly s: string;
  private readonly bytes: Uint8Array;
  private pos: int = 0;

  constructor(s: string) {
    this.s = s;
    this.bytes = encode(s);
  }

  Len(): int {
    if (this.pos >= this.bytes.length) {
      return 0;
    }
    return this.bytes.length - this.pos;
  }

  Size(): int {
    return this.bytes.length;
  }

  ReadByte(): [byte, Error | undefined] {
    if (this.pos >= this.bytes.length) {
      return [0, new globalThis.Error("EOF")];
    }
    const b = this.bytes[this.pos]!;
    this.pos++;
    return [b, undefined];
  }

  ReadRune(): [GoRune, int, Error | undefined] {
    if (this.pos >= this.bytes.length) {
      return [0, 0, new globalThis.Error("EOF")];
    }
    const [r, size] = decodeRune(this.bytes, this.pos);
    const adv = size === 0 ? 1 : size;
    this.pos += adv;
    return [r, adv, undefined];
  }

  String(): string {
    return this.s;
  }
}

export function NewReader(s: string): Reader {
  return new Reader(s);
}

// Replacer applies a set of string replacements via Replace.
export class Replacer {
  private readonly pairs: Array<[string, string]>;

  constructor(oldnew: GoSlice<string>) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i + 1 < oldnew.length; i += 2) {
      pairs.push([oldnew[i]!, oldnew[i + 1]!]);
    }
    this.pairs = pairs;
  }

  Replace(s: string): string {
    let i = 0;
    let result = "";
    outer: while (i < s.length) {
      for (const [from, to] of this.pairs) {
        if (from.length > 0 && s.startsWith(from, i)) {
          result += to;
          i += from.length;
          continue outer;
        }
      }
      result += s[i]!;
      i++;
    }
    return result;
  }
}

// NewReplacer takes pairs of old/new strings and returns a Replacer.
export function NewReplacer(...oldnew: Array<string>): Replacer {
  return new Replacer(oldnew);
}

// Repeat returns a new string consisting of count copies of s.
export function Repeat(s: string, count: int): string {
  if (count < 0) {
    throw new globalThis.Error("strings: negative Repeat count");
  }
  return s.repeat(count);
}

// Replace returns a copy of s with the first n non-overlapping instances of
// old replaced by replacement. n < 0 replaces all. Faithful port of Go's
// strings.Replace.
export function Replace(s: string, oldStr: string, newStr: string, n: int): string {
  const sb = encode(s);
  const ob = encode(oldStr);
  const nb = encode(newStr);

  // m is the number of replacements available given n.
  let m: int;
  if (oldStr === newStr) {
    m = 0;
  } else {
    m = countBytes(sb, ob);
  }
  if (m === 0) {
    return s; // no occurrences, return original
  }
  if (n < 0 || m < n) {
    n = m;
  }
  if (n === 0) {
    return s;
  }

  const out: Array<byte> = [];
  let start = 0;
  for (let i = 0; i < n; i++) {
    let j = start;
    if (ob.length === 0) {
      if (i > 0) {
        const [, wid] = decodeRune(sb, start);
        j += wid === 0 ? 1 : wid;
      }
    } else {
      const idx = indexOfBytes(sb.subarray(start), ob);
      // idx is guaranteed >= 0 because i < n <= m
      j += idx;
    }
    for (let k = start; k < j; k++) {
      out.push(sb[k]!);
    }
    for (const b of nb) {
      out.push(b);
    }
    start = j + ob.length;
  }
  for (let k = start; k < sb.length; k++) {
    out.push(sb[k]!);
  }
  return decode(Uint8Array.from(out));
}

// countBytes counts non-overlapping instances of needle in haystack. An empty
// needle matches at every rune boundary plus the end (runeCount+1), matching
// Go's strings.Count contract used by Replace.
const countBytes = (haystack: Uint8Array, needle: Uint8Array): int => {
  if (needle.length === 0) {
    let count = 0;
    let i = 0;
    while (i < haystack.length) {
      const [, size] = decodeRune(haystack, i);
      i += size === 0 ? 1 : size;
      count++;
    }
    return count + 1;
  }
  let n = 0;
  let from = 0;
  for (;;) {
    const idx = indexOfBytes(haystack.subarray(from), needle);
    if (idx < 0) {
      return n;
    }
    n++;
    from += idx + needle.length;
  }
};

// ReplaceAll replaces all non-overlapping instances of old with replacement.
export function ReplaceAll(s: string, oldStr: string, newStr: string): string {
  return Replace(s, oldStr, newStr, -1);
}

// Split slices s into all substrings separated by sep.
export function Split(s: string, sep: string): GoSlice<string> {
  return genSplit(s, sep, 0, -1);
}

// SplitN slices s into substrings separated by sep, at most n of them.
export function SplitN(s: string, sep: string, n: int): GoSlice<string> {
  return genSplit(s, sep, 0, n);
}

const genSplit = (s: string, sep: string, sepSave: int, n: int): GoSlice<string> => {
  if (n === 0) {
    return [];
  }
  if (sep === "") {
    return explode(s, n);
  }
  if (n < 0) {
    n = Count(s, sep) + 1;
  }
  const sb = encode(s);
  const sepb = encode(sep);
  const result: Array<string> = [];
  let from = 0;
  let count = 0;
  while (count < n - 1) {
    const idx = indexOfBytes(sb.subarray(from), sepb);
    if (idx < 0) {
      break;
    }
    const abs = from + idx;
    result.push(decode(sb.subarray(from, abs + sepSave)));
    from = abs + sepb.length;
    count++;
  }
  result.push(decode(sb.subarray(from)));
  return result;
};

// explode splits s into a slice of its runes (up to n).
const explode = (s: string, n: int): GoSlice<string> => {
  const bytes = encode(s);
  const result: Array<string> = [];
  let i = 0;
  let count = 0;
  while (i < bytes.length) {
    if (n > 0 && count >= n - 1) {
      break;
    }
    const [, size] = decodeRune(bytes, i);
    const adv = size === 0 ? 1 : size;
    result.push(decode(bytes.subarray(i, i + adv)));
    i += adv;
    count++;
  }
  if (i < bytes.length) {
    result.push(decode(bytes.subarray(i)));
  }
  return result;
};

// SplitSeq returns an iterator over substrings of s separated by sep.
export function SplitSeq(s: string, sep: string): (yieldValue: (v: string) => bool) => void {
  return (yieldValue: (v: string) => bool): void => {
    for (const part of Split(s, sep)) {
      if (!yieldValue(part)) {
        return;
      }
    }
  };
}

// ToLower returns s with all Unicode letters mapped to their lower case.
export function ToLower(s: string): string {
  return s.toLowerCase();
}

// ToUpper returns s with all Unicode letters mapped to their upper case.
export function ToUpper(s: string): string {
  return s.toUpperCase();
}

// ToValidUTF8 returns a copy of s with each run of invalid UTF-8 bytes replaced
// by replacement. JS strings are always valid UTF-16, so re-encoding to UTF-8
// is already valid; only the byte-level invalidity (impossible here) differs.
export function ToValidUTF8(s: string, replacement: string): string {
  const bytes = encode(s);
  const out: Array<byte> = [];
  const repBytes = encode(replacement);
  let i = 0;
  let invalid = false;
  while (i < bytes.length) {
    const [r, size] = decodeRune(bytes, i);
    if (r === RuneErrorValue && size <= 1) {
      if (!invalid) {
        for (const b of repBytes) {
          out.push(b);
        }
        invalid = true;
      }
      i += size === 0 ? 1 : size;
      continue;
    }
    invalid = false;
    const adv = size === 0 ? 1 : size;
    for (let k = 0; k < adv; k++) {
      out.push(bytes[i + k]!);
    }
    i += adv;
  }
  return decode(Uint8Array.from(out));
}

const makeCutset = (cutset: string): Set<GoRune> => {
  const set = new Set<GoRune>();
  const cb = encode(cutset);
  let i = 0;
  while (i < cb.length) {
    const [r, size] = decodeRune(cb, i);
    set.add(r);
    i += size === 0 ? 1 : size;
  }
  return set;
};

// Trim returns s with all leading and trailing runes in cutset removed.
export function Trim(s: string, cutset: string): string {
  const set = makeCutset(cutset);
  return TrimFunc(s, (r) => set.has(r));
}

// TrimFunc returns s with all leading and trailing runes satisfying f removed.
export function TrimFunc(s: string, f: (r: GoRune) => bool): string {
  return TrimRightFunc(TrimLeftFunc(s, f), f);
}

// TrimLeft returns s with all leading runes in cutset removed.
export function TrimLeft(s: string, cutset: string): string {
  const set = makeCutset(cutset);
  return TrimLeftFunc(s, (r) => set.has(r));
}

// TrimLeftFunc returns s with all leading runes satisfying f removed.
export function TrimLeftFunc(s: string, f: (r: GoRune) => bool): string {
  const bytes = encode(s);
  let i = 0;
  while (i < bytes.length) {
    const [r, size] = decodeRune(bytes, i);
    if (!f(r)) {
      break;
    }
    i += size === 0 ? 1 : size;
  }
  return decode(bytes.subarray(i));
}

// TrimPrefix returns s without the provided leading prefix string.
export function TrimPrefix(s: string, prefix: string): string {
  if (s.startsWith(prefix)) {
    return s.substring(prefix.length);
  }
  return s;
}

// TrimRight returns s with all trailing runes in cutset removed.
export function TrimRight(s: string, cutset: string): string {
  const set = makeCutset(cutset);
  return TrimRightFunc(s, (r) => set.has(r));
}

// TrimRightFunc returns s with all trailing runes satisfying f removed.
export function TrimRightFunc(s: string, f: (r: GoRune) => bool): string {
  const bytes = encode(s);
  let end = bytes.length;
  while (end > 0) {
    // find the start of the last rune before `end`
    let start = end - 1;
    while (start > 0 && (bytes[start]! & 0xc0) === 0x80) {
      start--;
    }
    const [r, size] = decodeRune(bytes, start);
    if (size === 0) {
      break;
    }
    if (!f(r)) {
      break;
    }
    end = start;
  }
  return decode(bytes.subarray(0, end));
}

// TrimSpace returns s with all leading and trailing whitespace removed.
export function TrimSpace(s: string): string {
  return TrimFunc(s, isSpaceRune);
}

// TrimSuffix returns s without the provided trailing suffix string.
export function TrimSuffix(s: string, suffix: string): string {
  if (suffix.length > 0 && s.endsWith(suffix)) {
    return s.substring(0, s.length - suffix.length);
  }
  return s;
}
