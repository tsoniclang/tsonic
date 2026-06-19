// Faithful TypeScript port of Go's `fmt` standard library package (the subset used
// by typescript-go): Sprintf/Errorf/Fprintf/Fprint/Fprintln/Println/Sprint and a
// single-target Sscanf.
//
// The core is a Go-compatible verb engine supporting the verbs and flags that
// typescript-go actually emits: %v %+v %#v %s %q %d %b %o %x %X %c %U %t %e %E %f
// %g %G %p %T %% and the flags + - # space 0, plus width/precision (including the
// `*`/`.*` argument forms). Operands are JavaScript values; Go's Stringer and error
// interfaces are honoured structurally (a value with String()/Error() methods).
//
// Multiple returns map to tuples; Errorf returns a GoError. The %w verb wraps an
// operand error so errors.Is/Unwrap see it (matching Go's fmt.wrapError).

import type { bool, byte, int } from "./scalars.js";
import type { GoError, GoSlice } from "./compat.js";

// fmt.Stringer: any value with a String() string method participates in %v/%s
// formatting. Represented structurally so plain ported objects satisfy it.
export interface Stringer {
  String(): string;
}

// Structural shape of an io.Writer target accepted by Fprint*: it consumes a byte
// slice. Defined structurally here to avoid coupling fmt to the io module.
interface Writer {
  Write(p: GoSlice<byte>): [int, GoError];
}

// An error that wraps another error via the %w verb, exposing Unwrap() so the
// errors package can traverse it. Mirrors fmt's internal *wrapError.
class wrapError extends globalThis.Error {
  readonly wrapped: GoError;
  constructor(message: string, wrapped: GoError) {
    super(message);
    this.name = "wrapError";
    this.wrapped = wrapped;
  }
  Unwrap(): GoError {
    return this.wrapped;
  }
}

// ---------------------------------------------------------------------------
// Operand inspection helpers (Stringer / error / type name).
// ---------------------------------------------------------------------------

function hasStringMethod(v: unknown): v is Stringer {
  return v !== null && typeof v === "object" && typeof (v as { String?: unknown }).String === "function";
}

function hasErrorMethod(v: unknown): v is { Error(): string } {
  return v !== null && typeof v === "object" && typeof (v as { Error?: unknown }).Error === "function";
}

// Returns the Go-style error message for a value if it is an error: a JS Error uses
// its message; a Go-style value uses its Error() method.
function errorMessageOf(v: unknown): string | undefined {
  if (v instanceof globalThis.Error) {
    return v.message;
  }
  if (hasErrorMethod(v)) {
    return v.Error();
  }
  return undefined;
}

// Best-effort Go-style type name for %T. Primitive JS types map onto their Go
// equivalents where unambiguous; objects fall back to their constructor name.
function typeName(v: unknown): string {
  if (v === undefined || v === null) {
    return "<nil>";
  }
  switch (typeof v) {
    case "string":
      return "string";
    case "boolean":
      return "bool";
    case "bigint":
      return "int64";
    case "number":
      return globalThis.Number.isInteger(v) ? "int" : "float64";
    case "object": {
      if (globalThis.Array.isArray(v)) {
        return "[]interface {}";
      }
      const ctor = (v as { constructor?: { name?: string } }).constructor;
      return ctor && ctor.name ? ctor.name : "object";
    }
    default:
      return typeof v;
  }
}

// ---------------------------------------------------------------------------
// Default (%v) formatting.
// ---------------------------------------------------------------------------

function formatBool(b: bool): string {
  return b ? "true" : "false";
}

function defaultString(v: unknown, plusV: bool, goSyntax: bool): string {
  if (v === undefined || v === null) {
    return goSyntax ? "<nil>" : "<nil>";
  }
  // Stringer / error take precedence (Go calls them for %v unless %#v).
  if (!goSyntax) {
    const errMsg = errorMessageOf(v);
    if (errMsg !== undefined) {
      return errMsg;
    }
    if (hasStringMethod(v)) {
      return v.String();
    }
  }
  switch (typeof v) {
    case "string":
      return goSyntax ? quoteString(v) : v;
    case "boolean":
      return formatBool(v);
    case "number":
      return numberToString(v);
    case "bigint":
      return v.toString();
    case "object": {
      if (globalThis.Array.isArray(v)) {
        return "[" + v.map((e) => defaultString(e, plusV, goSyntax)).join(" ") + "]";
      }
      if (v instanceof globalThis.Map) {
        const entries: string[] = [];
        for (const [k, val] of v.entries()) {
          entries.push(defaultString(k, plusV, goSyntax) + ":" + defaultString(val, plusV, goSyntax));
        }
        return "map[" + entries.join(" ") + "]";
      }
      return formatStruct(v as Record<string, unknown>, plusV, goSyntax);
    }
    default:
      return globalThis.String(v);
  }
}

function formatStruct(obj: Record<string, unknown>, plusV: bool, goSyntax: bool): string {
  const keys = globalThis.Object.keys(obj);
  const body = keys
    .map((k) => {
      const valueStr = defaultString(obj[k], plusV, goSyntax);
      if (goSyntax) {
        return `${k}:${valueStr}`;
      }
      if (plusV) {
        return `${k}:${valueStr}`;
      }
      return valueStr;
    })
    .join(" ");
  if (goSyntax) {
    const name = (obj as { constructor?: { name?: string } }).constructor?.name ?? "";
    return `${name}{${body}}`;
  }
  return `{${body}}`;
}

function numberToString(n: number): string {
  if (globalThis.Number.isNaN(n)) {
    return "NaN";
  }
  if (n === globalThis.Infinity) {
    return "+Inf";
  }
  if (n === -globalThis.Infinity) {
    return "-Inf";
  }
  return n.toString();
}

// ---------------------------------------------------------------------------
// Quoting (%q) — Go-style double-quoted string with escapes.
// ---------------------------------------------------------------------------

function quoteString(s: string): string {
  const out: string[] = ['"'];
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    switch (ch) {
      case '"':
        out.push('\\"');
        break;
      case "\\":
        out.push("\\\\");
        break;
      case "\n":
        out.push("\\n");
        break;
      case "\t":
        out.push("\\t");
        break;
      case "\r":
        out.push("\\r");
        break;
      default:
        if (code < 0x20) {
          out.push("\\x" + code.toString(16).padStart(2, "0"));
        } else {
          out.push(ch);
        }
    }
  }
  out.push('"');
  return out.join("");
}

// ---------------------------------------------------------------------------
// Integer / float verb rendering.
// ---------------------------------------------------------------------------

interface Spec {
  readonly minus: bool;
  readonly plus: bool;
  readonly space: bool;
  readonly hash: bool;
  readonly zero: bool;
  readonly width: int | undefined;
  readonly precision: int | undefined;
  readonly verb: string;
}

function toInteger(v: unknown): number {
  if (typeof v === "bigint") {
    return globalThis.Number(v);
  }
  if (typeof v === "number") {
    return globalThis.Math.trunc(v);
  }
  if (typeof v === "boolean") {
    return v ? 1 : 0;
  }
  return globalThis.Number.NaN;
}

function renderInteger(v: unknown, base: int, upper: bool, spec: Spec): string {
  const n = toInteger(v);
  if (globalThis.Number.isNaN(n)) {
    return `%!${spec.verb}(${typeName(v)}=${defaultString(v, false, false)})`;
  }
  const negative = n < 0;
  const magnitude = globalThis.Math.abs(n);
  let digits = magnitude.toString(base);
  if (upper) {
    digits = digits.toUpperCase();
  }
  const prefix = signPrefix(negative, spec) + altIntPrefix(base, upper, spec);
  return padNumeric(prefix, digits, spec);
}

function signPrefix(negative: bool, spec: Spec): string {
  if (negative) {
    return "-";
  }
  if (spec.plus) {
    return "+";
  }
  if (spec.space) {
    return " ";
  }
  return "";
}

function altIntPrefix(base: int, upper: bool, spec: Spec): string {
  if (!spec.hash) {
    return "";
  }
  if (base === 16) {
    return upper ? "0X" : "0x";
  }
  if (base === 8) {
    return "0";
  }
  if (base === 2) {
    return "0b";
  }
  return "";
}

// Pads a numeric rendering honouring width, the '-' (left) and '0' (zero) flags.
// Zero padding goes between the sign/prefix and the digits, matching Go.
function padNumeric(prefix: string, digits: string, spec: Spec): string {
  const core = prefix + digits;
  if (spec.width === undefined || core.length >= spec.width) {
    return core;
  }
  const padLen = spec.width - core.length;
  if (spec.minus) {
    return core + " ".repeat(padLen);
  }
  if (spec.zero) {
    return prefix + "0".repeat(padLen) + digits;
  }
  return " ".repeat(padLen) + core;
}

function padString(s: string, spec: Spec): string {
  if (spec.precision !== undefined && s.length > spec.precision) {
    s = s.slice(0, spec.precision);
  }
  if (spec.width === undefined || s.length >= spec.width) {
    return s;
  }
  const padLen = spec.width - s.length;
  return spec.minus ? s + " ".repeat(padLen) : " ".repeat(padLen) + s;
}

function renderFloat(v: unknown, spec: Spec): string {
  const n = typeof v === "bigint" ? globalThis.Number(v) : (v as number);
  if (typeof n !== "number" || globalThis.Number.isNaN(n)) {
    if (typeof n === "number") {
      return padString("NaN", spec);
    }
    return `%!${spec.verb}(${typeName(v)}=${defaultString(v, false, false)})`;
  }
  if (!globalThis.Number.isFinite(n)) {
    const inf = n > 0 ? signPrefix(false, spec) + "Inf" : "-Inf";
    return padString(inf, spec);
  }
  const prec = spec.precision;
  const negative = n < 0 || globalThis.Object.is(n, -0);
  const magnitude = globalThis.Math.abs(n);
  let body: string;
  switch (spec.verb) {
    case "e":
    case "E": {
      body = magnitude.toExponential(prec ?? 6);
      body = normalizeExponent(body, spec.verb === "E");
      break;
    }
    case "f":
    case "F":
      body = magnitude.toFixed(prec ?? 6);
      break;
    case "g":
    case "G":
    default: {
      body = formatG(magnitude, prec, spec.verb === "G");
      break;
    }
  }
  const prefix = signPrefix(negative, spec);
  return padNumeric(prefix, body, spec);
}

// Go pads the exponent to at least two digits (e.g. 1e+05). JS uses a single digit
// (1e+5), so normalise. Optionally upper-cases the 'E'.
function normalizeExponent(s: string, upper: bool): string {
  const normalized = s.replace(/e([+-])(\d+)/i, (_m, sign: string, exp: string) => {
    const padded = exp.length < 2 ? exp.padStart(2, "0") : exp;
    return `e${sign}${padded}`;
  });
  return upper ? normalized.replace("e", "E") : normalized;
}

function formatG(magnitude: number, precision: int | undefined, upper: bool): string {
  // %g uses %e for large exponents and %f otherwise, with trailing zeros removed.
  // JS Number.prototype.toString already follows this shortest-form policy; when a
  // precision is given we approximate via toPrecision.
  let out: string;
  if (precision !== undefined && precision > 0) {
    out = magnitude.toPrecision(precision);
    if (out.includes("e")) {
      out = normalizeExponent(out, false);
    } else if (out.includes(".")) {
      out = out.replace(/\.?0+$/, "");
    }
  } else {
    out = magnitude.toString();
    if (out.includes("e")) {
      out = normalizeExponent(out, false);
    }
  }
  return upper ? out.toUpperCase() : out;
}

// ---------------------------------------------------------------------------
// Verb dispatch.
// ---------------------------------------------------------------------------

interface VerbResult {
  readonly text: string;
  // For %w: the operand error captured for wrapping (consumed by Errorf).
  readonly wrapped?: GoError;
}

function applyVerb(spec: Spec, arg: unknown, hasArg: bool): VerbResult {
  if (!hasArg) {
    return { text: `%!${spec.verb}(MISSING)` };
  }
  switch (spec.verb) {
    case "v":
      return { text: padString(defaultString(arg, spec.plus, spec.hash), spec) };
    case "s": {
      const errMsg = errorMessageOf(arg);
      if (errMsg !== undefined) {
        return { text: padString(errMsg, spec) };
      }
      if (hasStringMethod(arg)) {
        return { text: padString(arg.String(), spec) };
      }
      if (typeof arg === "string") {
        return { text: padString(arg, spec) };
      }
      return { text: padString(defaultString(arg, spec.plus, false), spec) };
    }
    case "q": {
      if (typeof arg === "number" || typeof arg === "bigint") {
        // %q on an integer prints the single-quoted rune.
        const code = toInteger(arg);
        return { text: padString(`'${globalThis.String.fromCodePoint(code)}'`, spec) };
      }
      const str = typeof arg === "string" ? arg : defaultString(arg, false, false);
      return { text: padString(quoteString(str), spec) };
    }
    case "d":
      return { text: renderInteger(arg, 10, false, spec) };
    case "b":
      return { text: renderInteger(arg, 2, false, spec) };
    case "o":
    case "O":
      return { text: renderInteger(arg, 8, false, spec) };
    case "x":
      return { text: renderHex(arg, false, spec) };
    case "X":
      return { text: renderHex(arg, true, spec) };
    case "c": {
      const code = toInteger(arg);
      return { text: padString(globalThis.String.fromCodePoint(code), spec) };
    }
    case "U": {
      const code = toInteger(arg);
      const hex = code.toString(16).toUpperCase().padStart(4, "0");
      const alt = spec.hash ? ` '${globalThis.String.fromCodePoint(code)}'` : "";
      return { text: padString(`U+${hex}${alt}`, spec) };
    }
    case "t":
      return { text: padString(formatBool(arg === true), spec) };
    case "e":
    case "E":
    case "f":
    case "F":
    case "g":
    case "G":
      return { text: renderFloat(arg, spec) };
    case "p": {
      // Go prints a pointer address; in this port we have no addresses. nil pointers
      // print as <nil>; everything else gets a stable synthetic handle.
      if (arg === undefined || arg === null) {
        return { text: padString("<nil>", spec) };
      }
      return { text: padString("0x" + pointerHandle(arg).toString(16), spec) };
    }
    case "T":
      return { text: padString(typeName(arg), spec) };
    case "w": {
      const errMsg = errorMessageOf(arg);
      const text = errMsg ?? defaultString(arg, false, false);
      const wrapped: GoError = arg instanceof globalThis.Error ? arg : hasErrorMethod(arg) ? toGoError(arg) : undefined;
      return { text: padString(text, spec), wrapped };
    }
    default:
      return { text: `%!${spec.verb}(${typeName(arg)}=${defaultString(arg, false, false)})` };
  }
}

function renderHex(arg: unknown, upper: bool, spec: Spec): string {
  // %x on a string/byte-slice hex-encodes its bytes; on a number it is base-16.
  if (typeof arg === "string") {
    const bytes = utf8Bytes(arg);
    const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
    return padString(upper ? hex.toUpperCase() : hex, spec);
  }
  if (globalThis.Array.isArray(arg)) {
    const hex = (arg as number[]).map((b) => (b & 0xff).toString(16).padStart(2, "0")).join("");
    return padString(upper ? hex.toUpperCase() : hex, spec);
  }
  return renderInteger(arg, 16, upper, spec);
}

// Synthetic, stable per-object handle used only for %p so repeated formatting of
// the same object yields the same text. No real address semantics are implied.
const pointerHandles = new globalThis.WeakMap<object, number>();
let pointerCounter = 0xc000000000;
function pointerHandle(v: unknown): number {
  if (typeof v !== "object" || v === null) {
    return 0;
  }
  const existing = pointerHandles.get(v);
  if (existing !== undefined) {
    return existing;
  }
  pointerCounter = pointerCounter + 0x20;
  pointerHandles.set(v, pointerCounter);
  return pointerCounter;
}

// ---------------------------------------------------------------------------
// Format string parser + core Sprintf.
// ---------------------------------------------------------------------------

interface FormatOutput {
  readonly text: string;
  readonly wrapped: GoError | undefined;
}

// Reports whether the character at position i in s is an ASCII decimal digit.
function isAsciiDigitAt(s: string, i: int): bool {
  const ch = s[i];
  return ch !== undefined && ch >= "0" && ch <= "9";
}

function formatCore(format: string, args: readonly unknown[]): FormatOutput {
  const out: string[] = [];
  let argIndex = 0;
  let wrapped: GoError | undefined = undefined;
  let i = 0;
  while (i < format.length) {
    const ch = format[i];
    if (ch !== "%") {
      out.push(ch ?? "");
      i++;
      continue;
    }
    // Parse a verb starting at i.
    i++;
    if (i >= format.length) {
      out.push("%!(NOVERB)");
      break;
    }
    if (format[i] === "%") {
      out.push("%");
      i++;
      continue;
    }
    // Flags.
    let minus = false;
    let plus = false;
    let space = false;
    let hash = false;
    let zero = false;
    let parsingFlags = true;
    while (parsingFlags && i < format.length) {
      switch (format[i]) {
        case "-":
          minus = true;
          i++;
          break;
        case "+":
          plus = true;
          i++;
          break;
        case " ":
          space = true;
          i++;
          break;
        case "#":
          hash = true;
          i++;
          break;
        case "0":
          zero = true;
          i++;
          break;
        default:
          parsingFlags = false;
      }
    }
    // Width (number or '*').
    let width: int | undefined = undefined;
    if (format[i] === "*") {
      width = toInteger(args[argIndex]);
      argIndex++;
      i++;
      if (width !== undefined && width < 0) {
        minus = true;
        width = -width;
      }
    } else {
      const start = i;
      while (i < format.length && isAsciiDigitAt(format, i)) {
        i++;
      }
      if (i > start) {
        width = globalThis.parseInt(format.slice(start, i), 10);
      }
    }
    // Precision (.number or .*).
    let precision: int | undefined = undefined;
    if (format[i] === ".") {
      i++;
      if (format[i] === "*") {
        precision = toInteger(args[argIndex]);
        argIndex++;
        i++;
      } else {
        const start = i;
        while (i < format.length && isAsciiDigitAt(format, i)) {
          i++;
        }
        precision = i > start ? globalThis.parseInt(format.slice(start, i), 10) : 0;
      }
    }
    if (i >= format.length) {
      out.push("%!(NOVERB)");
      break;
    }
    const verb = format[i] ?? "";
    i++;
    const spec: Spec = { minus, plus, space, hash, zero, width, precision, verb };
    const hasArg = argIndex < args.length;
    const result = applyVerb(spec, hasArg ? args[argIndex] : undefined, hasArg);
    if (hasArg) {
      argIndex++;
    }
    if (result.wrapped !== undefined) {
      wrapped = result.wrapped;
    }
    out.push(result.text);
  }
  // Go appends %!(EXTRA ...) for unconsumed operands.
  if (argIndex < args.length) {
    const extras = args
      .slice(argIndex)
      .map((a) => `${typeName(a)}=${defaultString(a, false, false)}`)
      .join(", ");
    out.push(`%!(EXTRA ${extras})`);
  }
  return { text: out.join(""), wrapped };
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

// fmt.Sprintf formats according to a format specifier and returns the resulting
// string.
export function Sprintf(format: string, ...args: unknown[]): string {
  return formatCore(format, args).text;
}

// fmt.Errorf formats according to a format specifier and returns the string as a
// value that satisfies error. If the format includes a %w verb, the returned error
// wraps the corresponding operand error and Unwrap() exposes it.
export function Errorf(format: string, ...args: unknown[]): GoError {
  const { text, wrapped } = formatCore(format, args);
  if (wrapped !== undefined) {
    return new wrapError(text, wrapped);
  }
  return new globalThis.Error(text);
}

// Operands for Sprint/Fprint/Println are formatted with the default (%v) verb.
function defaultOperand(v: unknown): string {
  return defaultString(v, false, false);
}

// fmt.Sprint formats using the default formats for its operands and returns the
// resulting string. Spaces are added between operands when neither is a string.
export function Sprint(...args: unknown[]): string {
  return joinOperands(args, false);
}

// fmt.Sprintln formats using the default formats for its operands and returns the
// resulting string. Spaces are always added between operands and a newline is
// appended.
export function Sprintln(...args: unknown[]): string {
  return joinOperands(args, true) + "\n";
}

function joinOperands(args: readonly unknown[], alwaysSpace: bool): string {
  const out: string[] = [];
  for (let idx = 0; idx < args.length; idx++) {
    const cur = defaultOperand(args[idx]);
    if (idx > 0) {
      const prevIsString = typeof args[idx - 1] === "string";
      const curIsString = typeof args[idx] === "string";
      if (alwaysSpace || (!prevIsString && !curIsString)) {
        out.push(" ");
      }
    }
    out.push(cur);
  }
  return out.join("");
}

// fmt.Println formats using the default formats for its operands and writes to
// standard output. Spaces are always added between operands and a newline is
// appended. Returns [bytesWritten, error] per Go.
export function Println(...args: unknown[]): [int, GoError] {
  const text = joinOperands(args, true) + "\n";
  globalThis.console.log(joinOperands(args, true));
  return [utf8Bytes(text).length, undefined];
}

// fmt.Fprint formats using the default formats for its operands and writes to w.
// Spaces are added between operands when neither is a string. Returns the number of
// bytes written and any write error.
export function Fprint(w: Writer, ...args: unknown[]): [int, GoError] {
  return writeToWriter(w, joinOperands(args, false));
}

// fmt.Fprintf formats according to a format specifier and writes to w. Returns the
// number of bytes written and any write error.
export function Fprintf(w: Writer, format: string, ...args: unknown[]): [int, GoError] {
  return writeToWriter(w, formatCore(format, args).text);
}

// fmt.Fprintln formats using the default formats for its operands and writes to w.
// Spaces are always added between operands and a newline is appended.
export function Fprintln(w: Writer, ...args: unknown[]): [int, GoError] {
  return writeToWriter(w, joinOperands(args, true) + "\n");
}

function writeToWriter(w: Writer, text: string): [int, GoError] {
  const bytes = utf8Bytes(text);
  const [, err] = w.Write(bytes);
  return [bytes.length, err];
}

// ---------------------------------------------------------------------------
// Sscanf — minimal, faithful to the single typescript-go call site:
//   fmt.Sscanf(str, "@@ -%d,%d +%d,%d @@", &a, &b, &c, &d)
// Scan targets are settable boxes (Go's &x out-pointers). Supports the verbs
// actually scanned (%d) plus literal matching; reports parsed count and error.
// ---------------------------------------------------------------------------

// A settable scan target standing in for Go's `&variable` pointer argument.
export interface ScanTarget {
  set(value: unknown): void;
}

export function Sscanf(str: string, format: string, ...targets: ScanTarget[]): [int, GoError] {
  let si = 0; // index into str
  let fi = 0; // index into format
  let targetIndex = 0;
  let count = 0;
  while (fi < format.length) {
    const fch = format[fi];
    if (fch === "%") {
      fi++;
      if (fi >= format.length) {
        return [count, new globalThis.Error("fmt: Sscanf: trailing % in format")];
      }
      // Skip optional width digits (e.g. %2d).
      while (fi < format.length && isAsciiDigitAt(format, fi)) {
        fi++;
      }
      const verb = format[fi];
      fi++;
      if (verb === "%") {
        if (str[si] !== "%") {
          return [count, syntaxScanError(str, si)];
        }
        si++;
        continue;
      }
      if (verb !== "d") {
        return [count, new globalThis.Error(`fmt: Sscanf: unsupported verb %${verb}`)];
      }
      // Skip leading spaces in input before a number (Go's behaviour).
      while (si < str.length && str[si] === " ") {
        si++;
      }
      const start = si;
      if (si < str.length && (str[si] === "+" || str[si] === "-")) {
        si++;
      }
      while (si < str.length && isAsciiDigitAt(str, si)) {
        si++;
      }
      if (si === start || (si === start + 1 && (str[start] === "+" || str[start] === "-"))) {
        return [count, new globalThis.Error("fmt: Sscanf: expected integer")];
      }
      const target = targets[targetIndex];
      targetIndex++;
      if (target === undefined) {
        return [count, new globalThis.Error("fmt: Sscanf: too few arguments for format")];
      }
      target.set(globalThis.parseInt(str.slice(start, si), 10));
      count++;
      continue;
    }
    if (fch === " ") {
      // A space in the format matches zero or more spaces in the input.
      fi++;
      while (si < str.length && str[si] === " ") {
        si++;
      }
      continue;
    }
    // Literal character must match.
    if (str[si] !== fch) {
      return [count, syntaxScanError(str, si)];
    }
    si++;
    fi++;
  }
  return [count, undefined];
}

function syntaxScanError(str: string, pos: int): GoError {
  return new globalThis.Error(`fmt: Sscanf: input does not match format at position ${pos} (${JSON.stringify(str.slice(pos, pos + 8))})`);
}

// ---------------------------------------------------------------------------
// Shared helpers.
// ---------------------------------------------------------------------------

// Wraps a Go-style value with an Error() method into a GoError (JS Error) so it can
// flow through errors.Is/Unwrap. The original is preserved as a non-enumerable ref.
function toGoError(v: { Error(): string }): GoError {
  if (v instanceof globalThis.Error) {
    return v;
  }
  const wrapped = new globalThis.Error(v.Error());
  (wrapped as unknown as { source: unknown }).source = v;
  return wrapped;
}

const encoder = new globalThis.TextEncoder();

function utf8Bytes(s: string): GoSlice<byte> {
  return globalThis.Array.from(encoder.encode(s));
}
