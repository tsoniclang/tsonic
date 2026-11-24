import type { Diagnostic } from "../diag/contract.js";
import { resourceLimitDiagnostic } from "../diag/index.js";
import type { ModuleId, Origin } from "../ids/contract.js";
import type { LiteralTypeValue } from "../ir-types/contract.js";
import type { LiteralCaptureLimits, RawNumericLiteral } from "./contract.js";

export interface LiteralStop {
  readonly kind: "literal-limit";
  readonly diagnostic: Diagnostic;
}

export type LiteralResult<Value> = { readonly kind: "complete"; readonly value: Value } | LiteralStop;
export type LiteralLoweringQuery = "captureModule" | "lowerModule" | "lowerModuleExports";
type ParsedNumber = LiteralResult<Extract<LiteralTypeValue, { readonly kind: "number" }>>;
type ParsedBigint = LiteralResult<Extract<LiteralTypeValue, { readonly kind: "bigint" }>>;

type LiteralLimit = keyof LiteralCaptureLimits;

interface LiteralWork {
  readonly maximumIntermediateBits: number;
  remaining: number;
}

interface SizedInteger {
  readonly value: bigint;
  readonly bits: number;
}

function stop(origin: Origin, module: ModuleId, limit: LiteralLimit, maximum: number, query: LiteralLoweringQuery = "lowerModule"): LiteralStop {
  return { kind: "literal-limit", diagnostic: resourceLimitDiagnostic({ owner: "front", limit: `front.literalCapture.${limit}`,
    maximum, site: { kind: "source", origin },
    unit: { request: { query, key: module }, position: { kind: "result" } } }) };
}

function validateLimits(limits: LiteralCaptureLimits): void {
  if (![limits.maximumIntermediateBits, limits.maximumResultBits, limits.maximumArithmeticWork]
    .every(limit => Number.isSafeInteger(limit) && limit >= 0 && !Object.is(limit, -0)))
    throw new TypeError("front: numeric capture limits must be nonnegative safe integers");
}

function digitBounds(text: string, digit: RegExp): void {
  for (let index = text.indexOf("_"); index !== -1; index = text.indexOf("_", index + 1)) {
    if (!digit.test(text.charAt(index - 1)) || !digit.test(text.charAt(index + 1)))
      throw new TypeError("front: an authored numeric separator must join actual digits");
  }
}

function scaleOf(text: string): number {
  const negative = text.startsWith("-");
  let magnitude = 0;
  for (let index = negative || text.startsWith("+") ? 1 : 0; index < text.length; index += 1) {
    const digit = text.charCodeAt(index) - 48;
    if (magnitude > Math.floor((Number.MAX_SAFE_INTEGER - digit) / 10)) return negative ? -Infinity : Infinity;
    magnitude = magnitude * 10 + digit;
  }
  return negative ? -magnitude : magnitude;
}

function charge(work: LiteralWork, bits: number, count = 1): boolean {
  if (bits !== 0 && count > Math.floor(work.remaining / bits)) return false;
  work.remaining -= bits * count;
  return true;
}

function boundedWidth(groups: number, width: number, tail: number, maximum: number): number | null {
  return groups > Math.floor((maximum - tail) / width) ? null : groups * width + tail;
}

function coefficientBound(coefficient: string, radixBits: number, maximum: number): number | null {
  const digits = coefficient.length;
  if (digits === 0) return 0;
  if (radixBits === 0 && digits > 1) {
    const tail = Math.ceil((digits % 500) * 1661 / 500);
    return boundedWidth(Math.floor(digits / 500), 1661, tail, maximum);
  }
  const leading = Number.parseInt(coefficient.charAt(0), radixBits === 0 ? 10 : 2 ** radixBits);
  return boundedWidth(digits - 1, radixBits || 1, 32 - Math.clz32(leading), maximum);
}

function sized(value: bigint): SizedInteger {
  return { value, bits: value === 0n ? 0 : value.toString(2).length };
}

function multiply(work: LiteralWork, left: SizedInteger, right: SizedInteger): SizedInteger | LiteralLimit {
  if (left.bits > work.maximumIntermediateBits - right.bits) return "maximumIntermediateBits";
  if (!charge(work, left.bits, right.bits)) return "maximumArithmeticWork";
  return sized(left.value * right.value);
}

function powerOfTen(work: LiteralWork, exponent: number): SizedInteger | LiteralLimit {
  let factor: SizedInteger = { value: 10n, bits: 4 };
  let selected: SizedInteger = { value: 1n, bits: 1 };
  for (let remaining = exponent; remaining > 0;) {
    if (remaining % 2 === 1) {
      const next = selected.bits === 1 ? factor : multiply(work, selected, factor);
      if (typeof next === "string") return next;
      selected = next;
    }
    remaining = Math.floor(remaining / 2);
    if (remaining !== 0) {
      const next = multiply(work, factor, factor);
      if (typeof next === "string") return next;
      factor = next;
    }
  }
  return selected;
}

function reduce(work: LiteralWork, numerator: SizedInteger, denominator: SizedInteger):
  { readonly numerator: SizedInteger; readonly denominator: SizedInteger } | LiteralLimit {
  const ordered = numerator.bits >= denominator.bits;
  let dividend = ordered ? numerator : denominator;
  let divisor = ordered ? denominator : numerator;
  while (divisor.bits > 1) {
    if (!charge(work, dividend.bits, divisor.bits)) return "maximumArithmeticWork";
    const remainder = sized(dividend.value % divisor.value);
    if (remainder.bits === 0) break;
    dividend = divisor;
    divisor = remainder;
  }
  if (divisor.bits <= 1) return { numerator, denominator };
  if (!charge(work, numerator.bits, divisor.bits)) return "maximumArithmeticWork";
  const reducedNumerator = sized(numerator.value / divisor.value);
  if (!charge(work, denominator.bits, divisor.bits)) return "maximumArithmeticWork";
  return { numerator: reducedNumerator, denominator: sized(denominator.value / divisor.value) };
}

export function captureNumericLiteral(limits: LiteralCaptureLimits, literal: RawNumericLiteral, query: LiteralLoweringQuery = "lowerModule"): ParsedNumber {
  return captureAuthoredNumeric(limits, literal, "number", query);
}

export function captureBigintLiteral(limits: LiteralCaptureLimits, literal: RawNumericLiteral): ParsedBigint {
  return captureAuthoredNumeric(limits, literal, "bigint", "lowerModule");
}

function captureAuthoredNumeric(limits: LiteralCaptureLimits, literal: RawNumericLiteral,
  kind: "number", query: LiteralLoweringQuery): ParsedNumber;
function captureAuthoredNumeric(limits: LiteralCaptureLimits, literal: RawNumericLiteral,
  kind: "bigint", query: LiteralLoweringQuery): ParsedBigint;
function captureAuthoredNumeric(limits: LiteralCaptureLimits, literal: RawNumericLiteral,
  kind: "number" | "bigint", query: LiteralLoweringQuery): ParsedNumber | ParsedBigint {
  validateLimits(limits);
  const { token, origin } = literal;
  const work: LiteralWork = { maximumIntermediateBits: limits.maximumIntermediateBits, remaining: limits.maximumArithmeticWork };
  if (!charge(work, token.length)) return stop(origin, origin.module, "maximumArithmeticWork", limits.maximumArithmeticWork, query);
  const negative = token.startsWith("-");
  const digitsStart = negative || token.startsWith("+") ? 1 : 0;
  if (kind === "bigint" && !token.endsWith("n")) throw new TypeError("front: an authored bigint requires its actual suffix");
  const unsigned = kind === "bigint" ? token.slice(digitsStart, -1) : token.slice(digitsStart);
  const prefix = unsigned.slice(0, 2).toLowerCase();
  const radixBits = prefix === "0x" ? 4 : prefix === "0o" ? 3 : prefix === "0b" ? 1 : 0;
  let coefficient: string;
  let scale = 0;
  if (radixBits !== 0) {
    const digit = radixBits === 4 ? /[0-9a-fA-F]/u : radixBits === 3 ? /[0-7]/u : /[01]/u;
    const full = radixBits === 4 ? /^[0-9a-fA-F]+$/u : radixBits === 3 ? /^[0-7]+$/u : /^[01]+$/u;
    const raw = unsigned.slice(2);
    digitBounds(raw, digit);
    coefficient = raw.replaceAll("_", "");
    if (!full.test(coefficient)) throw new TypeError("front: the authored numeric token is not in its actual radix");
  } else if (kind === "bigint") {
    digitBounds(unsigned, /[0-9]/u);
    coefficient = unsigned.replaceAll("_", "");
    if (!/^[0-9]+$/u.test(coefficient)) throw new TypeError("front: the authored bigint is not an integer token");
  } else {
    digitBounds(unsigned, /[0-9]/u);
    const parts = /^(?:([0-9]+)(?:\.([0-9]*))?|\.([0-9]+))(?:[eE]([+-]?[0-9]+))?$/u.exec(unsigned.replaceAll("_", ""));
    if (parts === null) throw new TypeError("front: the authored numeric token is not decimal");
    const fraction = parts[2] ?? parts[3] ?? "";
    coefficient = (parts[1] ?? "") + fraction;
    const authoredScale = scaleOf(parts[4] ?? "0");
    scale = authoredScale < fraction.length - Number.MAX_SAFE_INTEGER ? -Infinity : authoredScale - fraction.length;
  }
  coefficient = coefficient.replace(/^0+/u, "");
  const zero = coefficient.length === 0;
  if (zero) scale = 0;
  if (scale < 0) {
    let end = coefficient.length;
    while (scale < 0 && coefficient.charAt(end - 1) === "0") { end -= 1; scale += 1; }
    coefficient = coefficient.slice(0, end);
  }
  const exponent = Math.abs(scale);
  const coefficientBits = coefficientBound(coefficient, radixBits, limits.maximumIntermediateBits);
  if ((kind === "number" && (limits.maximumIntermediateBits === 0 || exponent > Math.floor((limits.maximumIntermediateBits - 1) / 3)))
    || coefficientBits === null)
    return stop(origin, origin.module, "maximumIntermediateBits", limits.maximumIntermediateBits, query);
  if (!zero && !charge(work, coefficientBits)) return stop(origin, origin.module, "maximumArithmeticWork", limits.maximumArithmeticWork, query);

  const magnitude = zero ? 0n : BigInt(radixBits === 0 ? coefficient : prefix + coefficient);
  let numerator = radixBits === 0 && coefficient.length > 1 ? sized(magnitude) : { value: magnitude, bits: coefficientBits };
  if (kind === "bigint") {
    if (numerator.bits > limits.maximumResultBits)
      return stop(origin, origin.module, "maximumResultBits", limits.maximumResultBits, query);
    if (negative && !charge(work, numerator.bits))
      return stop(origin, origin.module, "maximumArithmeticWork", limits.maximumArithmeticWork, query);
    return { kind: "complete", value: { kind, value: negative ? -magnitude : magnitude } };
  }
  let denominator: SizedInteger = { value: 1n, bits: 1 };
  if (scale !== 0) {
    const power = powerOfTen(work, exponent);
    if (typeof power === "string") return stop(origin, origin.module, power, limits[power], query);
    if (scale > 0) {
      const scaled = multiply(work, numerator, power);
      if (typeof scaled === "string") return stop(origin, origin.module, scaled, limits[scaled], query);
      numerator = scaled;
    } else {
      const reduced = reduce(work, numerator, power);
      if (typeof reduced === "string") return stop(origin, origin.module, reduced, limits[reduced], query);
      ({ numerator, denominator } = reduced);
    }
  }
  if (denominator.bits > limits.maximumResultBits - numerator.bits)
    return stop(origin, origin.module, "maximumResultBits", limits.maximumResultBits, query);
  const negate = negative && !zero;
  if (negate && !charge(work, numerator.bits)) return stop(origin, origin.module, "maximumArithmeticWork", limits.maximumArithmeticWork, query);
  return { kind: "complete", value: { kind: "number", value: { numerator: negate ? -numerator.value : numerator.value,
    denominator: denominator.value, negativeZero: negative && zero } } };
}

export function captureCheckerBigint(limits: LiteralCaptureLimits, value: bigint, origin: Origin, module: ModuleId): ParsedBigint {
  validateLimits(limits);
  const limit = limits.maximumIntermediateBits <= limits.maximumResultBits ? "maximumIntermediateBits" : "maximumResultBits";
  const maximum = limits[limit];
  if (value === 0n) return { kind: "complete", value: { kind: "bigint", value } };
  const work: LiteralWork = { maximumIntermediateBits: limits.maximumIntermediateBits, remaining: limits.maximumArithmeticWork };
  const negative = value < 0n;
  for (let width = Math.min(8, maximum); width !== 0; width += Math.min(width, maximum - width)) {
    if (!charge(work, width) || (negative && !charge(work, 1)))
      return stop(origin, module, "maximumArithmeticWork", limits.maximumArithmeticWork);
    if (negative ? BigInt.asIntN(width + 1, value) === value : BigInt.asUintN(width, value) === value) {
      if (!negative) return { kind: "complete", value: { kind: "bigint", value } };
      if (!charge(work, width)) return stop(origin, module, "maximumArithmeticWork", limits.maximumArithmeticWork);
      if (value !== -(1n << BigInt(width))) return { kind: "complete", value: { kind: "bigint", value } };
    }
    if (width === maximum) break;
  }
  return stop(origin, module, limit, maximum);
}

export function captureCheckerNumber(limits: LiteralCaptureLimits, value: number, origin: Origin, module: ModuleId,
  scratch: { checkerNumberBits: DataView | null }, query: LiteralLoweringQuery = "lowerModule"): ParsedNumber {
  validateLimits(limits);
  const decodingWork = 64;
  if (limits.maximumArithmeticWork < decodingWork)
    return stop(origin, module, "maximumArithmeticWork", limits.maximumArithmeticWork, query);
  if (!Number.isFinite(value)) throw new TypeError("front: a nonfinite checked number has no exact rational value");
  const checkerNumberBits = scratch.checkerNumberBits ??= new DataView(new ArrayBuffer(8));
  checkerNumberBits.setFloat64(0, value);
  const head = checkerNumberBits.getUint32(0);
  const tail = checkerNumberBits.getUint32(4);
  const exponent = head >>> 20 & 0x7ff;
  const high = (head & 0xfffff) + (exponent === 0 ? 0 : 0x100000);
  const width = high === 0 ? 32 - Math.clz32(tail) : 64 - Math.clz32(high);
  const zeroes = width === 0 ? 0 : tail === 0 ? 63 - Math.clz32(high & -high) : 31 - Math.clz32(tail & -tail);
  const scale = width === 0 ? 0 : exponent === 0 ? -1074 : exponent - 1075;
  const shift = scale + zeroes;
  const coefficientBits = width - zeroes;
  const numeratorBits = coefficientBits + Math.max(0, shift);
  const denominatorBits = 1 + Math.max(0, -shift);
  if (Math.max(numeratorBits, denominatorBits) > limits.maximumIntermediateBits)
    return stop(origin, module, "maximumIntermediateBits", limits.maximumIntermediateBits, query);
  if (numeratorBits + denominatorBits > limits.maximumResultBits)
    return stop(origin, module, "maximumResultBits", limits.maximumResultBits, query);
  const work = decodingWork + coefficientBits + denominatorBits + (shift > 0 ? numeratorBits : 0);
  if (work > limits.maximumArithmeticWork) return stop(origin, module, "maximumArithmeticWork", limits.maximumArithmeticWork, query);
  const negative = (head >>> 31) !== 0;
  const magnitude = (high * 0x100000000 + tail) / 2 ** zeroes;
  const coefficient = BigInt(negative ? -magnitude : magnitude);
  return { kind: "complete", value: { kind: "number", value: {
    numerator: shift > 0 ? coefficient << BigInt(shift) : coefficient,
    denominator: shift < 0 ? 1n << BigInt(-shift) : 1n, negativeZero: negative && width === 0,
  } } };
}
