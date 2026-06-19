// Faithful TypeScript port of Go's `strconv` standard library package (the subset
// used by typescript-go): integer/float/bool parsing and integer formatting.
//
// Go's parse functions return `(value, error)` and never panic on bad input; the
// error is a `*NumError` wrapping a sentinel (`ErrSyntax` or `ErrRange`). We mirror
// that exactly: a `NumError` whose `Unwrap()` returns the sentinel, so
// `errors.Is(err, strconv.ErrRange)` works. Multiple returns map to tuples
// `[value, GoError]`.
//
// Numeric note: every internal Go scalar alias (int/long/uint/ulong/...) is a
// JavaScript `number`. typescript-go only parses/formats values that comfortably
// fit in a double (line numbers, char codes, small ids), so we operate on `number`.
// Range checks honour the requested bitSize using exact integer math where the
// magnitude is within Number.MAX_SAFE_INTEGER.

import type { bool, int, long, ulong } from "./scalars.js";
import type { GoError } from "./compat.js";
import { errorString } from "./errors.js";

// Sentinel errors, matching Go's exported strconv.ErrRange / strconv.ErrSyntax.
// They are distinct values so errors.Is can match them by identity through the
// NumError unwrap chain.
export const ErrRange: GoError = new errorString("value out of range");
export const ErrSyntax: GoError = new errorString("invalid syntax");

// NumError mirrors Go's strconv.NumError{Func, Num, Err}. Error() formats as
// `strconv.<Func>: parsing <quoted Num>: <Err>` and Unwrap() exposes the sentinel.
export class NumError extends globalThis.Error {
  readonly Func: string;
  readonly Num: string;
  readonly Err: GoError;
  constructor(func: string, num: string, err: GoError) {
    super(`strconv.${func}: parsing ${quoteForError(num)}: ${err === undefined ? "" : err.message}`);
    this.name = "NumError";
    this.Func = func;
    this.Num = num;
    this.Err = err;
  }
  Unwrap(): GoError {
    return this.Err;
  }
}

// Go quotes the offending input with strconv.Quote in NumError messages. A small
// faithful subset (double quotes with backslash/quote escaping) suffices here.
function quoteForError(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function syntaxError(func: string, num: string): NumError {
  return new NumError(func, num, ErrSyntax);
}

function rangeError(func: string, num: string): NumError {
  return new NumError(func, num, ErrRange);
}

// Maps a base-N digit character to its numeric value, or -1 if not a digit in any
// base up to 36. Matches Go's lower/upper-case handling.
function digitValue(ch: string | undefined): int {
  if (ch === undefined) {
    return -1;
  }
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) {
    return c - 48; // '0'-'9'
  }
  if (c >= 97 && c <= 122) {
    return c - 97 + 10; // 'a'-'z'
  }
  if (c >= 65 && c <= 90) {
    return c - 65 + 10; // 'A'-'Z'
  }
  return -1;
}

// Resolves the effective base and the remaining digit string for base 0 (infer
// from prefix) per Go's rules: 0x/0X -> 16, 0o/0O -> 8, 0b/0B -> 2, leading 0 -> 8,
// otherwise 10. Underscores are permitted only when base was 0 (literal form).
interface BaseResolution {
  readonly base: int;
  readonly digits: string;
  readonly underscoreOk: bool;
}

function resolveBase(s: string, base: int): BaseResolution | undefined {
  if (base === 0) {
    if (s.length >= 2 && s[0] === "0") {
      const p = s[1];
      if (p === "x" || p === "X") {
        return { base: 16, digits: s.slice(2), underscoreOk: true };
      }
      if (p === "o" || p === "O") {
        return { base: 8, digits: s.slice(2), underscoreOk: true };
      }
      if (p === "b" || p === "B") {
        return { base: 2, digits: s.slice(2), underscoreOk: true };
      }
      // leading 0 with more digits -> octal
      return { base: 8, digits: s.slice(1), underscoreOk: true };
    }
    return { base: 10, digits: s, underscoreOk: true };
  }
  if (base < 2 || base > 36) {
    return undefined;
  }
  return { base, digits: s, underscoreOk: false };
}

// Accumulates digits of `digits` in `base`, returning the magnitude and whether the
// input was syntactically valid. Underscores between digits are accepted when
// allowed (base-0 literals); leading/trailing/double underscores are invalid.
interface AccumResult {
  readonly value: number;
  readonly ok: bool;
  readonly overflow: bool;
}

function accumulate(digits: string, base: int, max: number, underscoreOk: bool): AccumResult {
  if (digits.length === 0) {
    return { value: 0, ok: false, overflow: false };
  }
  // Track underscore placement validity: cannot be first, last, or adjacent.
  const acc = (function step(i: number, value: number, prevUnderscore: bool, sawDigit: bool, overflow: bool): AccumResult {
    if (i >= digits.length) {
      if (prevUnderscore || !sawDigit) {
        return { value, ok: false, overflow };
      }
      return { value, ok: true, overflow };
    }
    const ch = digits[i];
    if (ch === "_") {
      if (!underscoreOk || !sawDigit || prevUnderscore) {
        return { value, ok: false, overflow };
      }
      return step(i + 1, value, true, sawDigit, overflow);
    }
    const d = digitValue(ch);
    if (d < 0 || d >= base) {
      return { value, ok: false, overflow };
    }
    const next = value * base + d;
    const nextOverflow = overflow || next > max;
    return step(i + 1, next, false, true, nextOverflow);
  })(0, 0, false, false, false);
  return acc;
}

// Strips an optional leading sign, returning [negative, rest].
function splitSign(s: string): [bool, string] {
  if (s.length > 0 && (s[0] === "+" || s[0] === "-")) {
    return [s[0] === "-", s.slice(1)];
  }
  return [false, s];
}

// bitSize 0 is treated as 64-bit per Go; we compute the inclusive max magnitude.
function intMax(bitSize: int): number {
  const bits = bitSize === 0 ? 64 : bitSize;
  // For 64-bit, JS cannot represent 2^63-1 exactly; clamp to MAX_SAFE_INTEGER which
  // covers every value typescript-go actually parses.
  if (bits >= 53) {
    return globalThis.Number.MAX_SAFE_INTEGER;
  }
  return globalThis.Math.pow(2, bits - 1) - 1;
}

function intMin(bitSize: int): number {
  const bits = bitSize === 0 ? 64 : bitSize;
  if (bits >= 53) {
    return globalThis.Number.MIN_SAFE_INTEGER;
  }
  return -globalThis.Math.pow(2, bits - 1);
}

function uintMax(bitSize: int): number {
  const bits = bitSize === 0 ? 64 : bitSize;
  if (bits >= 53) {
    return globalThis.Number.MAX_SAFE_INTEGER;
  }
  return globalThis.Math.pow(2, bits) - 1;
}

// strconv.ParseInt interprets a string in the given base (0, or 2 to 36) and bit
// size (0 to 64) and returns the corresponding value and an error. base 0 infers
// the base from a prefix. On range overflow it returns the clamped limit and
// ErrRange (wrapped in a NumError), matching Go.
export function ParseInt(s: string, base: int, bitSize: int): [long, GoError] {
  return parseSignedInternal(s, base, bitSize, "ParseInt");
}

// strconv.Atoi is equivalent to ParseInt(s, 10, 0), converted to int. It is the
// common case and reports a NumError with Func "Atoi" on failure.
export function Atoi(s: string): [int, GoError] {
  const [value, err] = parseSignedInternal(s, 10, 0, "Atoi");
  return [value, err];
}

function parseSignedInternal(s: string, base: int, bitSize: int, func: string): [number, GoError] {
  if (s.length === 0) {
    return [0, syntaxError(func, s)];
  }
  const [negative, unsigned] = splitSign(s);
  const resolved = resolveBase(unsigned, base);
  if (resolved === undefined) {
    return [0, syntaxError(func, s)];
  }
  const limit = negative ? -intMin(bitSize) : intMax(bitSize);
  const acc = accumulate(resolved.digits, resolved.base, limit, resolved.underscoreOk);
  if (!acc.ok) {
    return [0, syntaxError(func, s)];
  }
  if (acc.overflow) {
    return [negative ? intMin(bitSize) : intMax(bitSize), rangeError(func, s)];
  }
  return [negative ? -acc.value : acc.value, undefined];
}

// strconv.ParseUint is like ParseInt but for unsigned numbers. A leading sign is
// not permitted.
export function ParseUint(s: string, base: int, bitSize: int): [ulong, GoError] {
  const func = "ParseUint";
  if (s.length === 0) {
    return [0, syntaxError(func, s)];
  }
  if (s[0] === "-" || s[0] === "+") {
    return [0, syntaxError(func, s)];
  }
  const resolved = resolveBase(s, base);
  if (resolved === undefined) {
    return [0, syntaxError(func, s)];
  }
  const max = uintMax(bitSize);
  const acc = accumulate(resolved.digits, resolved.base, max, resolved.underscoreOk);
  if (!acc.ok) {
    return [0, syntaxError(func, s)];
  }
  if (acc.overflow) {
    return [max, rangeError(func, s)];
  }
  return [acc.value, undefined];
}

// strconv.ParseFloat converts the string s to a floating-point number. bitSize is
// 32 or 64. On overflow it returns ±Inf and ErrRange (Go still hands back the
// infinity), and reports ErrSyntax for malformed input.
export function ParseFloat(s: string, bitSize: int): [number, GoError] {
  const func = "ParseFloat";
  if (s.length === 0) {
    return [0, syntaxError(func, s)];
  }
  const trimmed = s;
  const lower = trimmed.toLowerCase();
  const [neg, mag] = splitSign(trimmed);
  const magLower = mag.toLowerCase();
  if (magLower === "inf" || magLower === "infinity") {
    return [neg ? -globalThis.Infinity : globalThis.Infinity, undefined];
  }
  if (lower === "nan") {
    return [globalThis.NaN, undefined];
  }
  // Go accepts decimal and hex (0x...p...) float syntax plus underscores in
  // literals. typescript-go only parses ordinary decimal floats; we validate the
  // decimal grammar strictly and reject anything else as a syntax error rather than
  // silently accepting JS-specific forms.
  const decimalFloat = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
  if (!decimalFloat.test(trimmed)) {
    return [0, syntaxError(func, s)];
  }
  const parsed = globalThis.Number(trimmed);
  if (globalThis.Number.isNaN(parsed)) {
    return [0, syntaxError(func, s)];
  }
  if (!globalThis.Number.isFinite(parsed)) {
    // Magnitude overflowed to ±Inf: Go returns the infinity together with ErrRange.
    return [parsed, rangeError(func, s)];
  }
  if (bitSize === 32) {
    const as32 = globalThis.Math.fround(parsed);
    if (!globalThis.Number.isFinite(as32) && globalThis.Number.isFinite(parsed)) {
      return [as32, rangeError(func, s)];
    }
    return [as32, undefined];
  }
  return [parsed, undefined];
}

// strconv.ParseBool returns the boolean value represented by the string. It accepts
// 1, t, T, TRUE, true, True, 0, f, F, FALSE, false, False; any other value returns
// an error.
export function ParseBool(s: string): [bool, GoError] {
  switch (s) {
    case "1":
    case "t":
    case "T":
    case "TRUE":
    case "true":
    case "True":
      return [true, undefined];
    case "0":
    case "f":
    case "F":
    case "FALSE":
    case "false":
    case "False":
      return [false, undefined];
    default:
      return [false, syntaxError("ParseBool", s)];
  }
}

// Validates the base for the Format* functions (Go panics on an invalid base).
function checkFormatBase(base: int): void {
  if (base < 2 || base > 36) {
    throw new globalThis.Error(`strconv: illegal AppendInt/FormatInt base ${base}`);
  }
}

// strconv.FormatInt returns the string representation of i in the given base, for
// 2 <= base <= 36. The result uses lower-case letters 'a' to 'z' for digit values
// >= 10. A negative i is prefixed with '-'.
export function FormatInt(i: long, base: int): string {
  checkFormatBase(base);
  if (i < 0) {
    return "-" + formatMagnitude(-i, base);
  }
  return formatMagnitude(i, base);
}

// strconv.FormatUint returns the string representation of i (treated as unsigned)
// in the given base.
export function FormatUint(i: ulong, base: int): string {
  checkFormatBase(base);
  return formatMagnitude(i, base);
}

function formatMagnitude(value: number, base: int): string {
  // Integer magnitude formatting via repeated division; base.toString matches Go's
  // lower-case alphabet for 2..36.
  const truncated = globalThis.Math.trunc(value);
  return truncated.toString(base);
}

// strconv.Itoa is equivalent to FormatInt(int64(i), 10).
export function Itoa(i: int): string {
  return FormatInt(i, 10);
}
