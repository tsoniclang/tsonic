import type { Origin } from "../ids/contract.js";
import type { MirSite, MirUnwind } from "../ir-mir/contract.js";
import type { OperationIdentity } from "../ir-infer/contract.js";
import type { ConstValue, NativeIntegerGeometryResult, NativeIntegerOperation, NativeOverflowLaw, NativePrimitive, NativeRounding } from "../ir-types/contract.js";
import { isNativeBinaryFloatPrimitive, nativeCarrierOf, nativeIntegerGeometryOf } from "../ir-types/index.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { EvaluateDeps } from "./contract.js";
import type { Machine as EvaluationMachine } from "./pause.js";
import { arithmetic, limit, selectedFloatingWidth } from "./budget.js";
import { compareFloating, compareOrdered, floatingSignBit, isNumericComparison } from "./comparison.js";
import { enterUnwind } from "./execution.js";

type Machine = EvaluationMachine<EvaluateDeps>;
type NativeNumericSelection = Extract<OperationIdentity, { readonly kind: "native-operator" }>;
const fail = (message: string, origin: Origin): never => throwInvariant({ owner: "evaluate", query: null, origin, message });

function integerValue(
  machine: Machine, value: ConstValue, carrier: NativePrimitive,
  geometry: Extract<NativeIntegerGeometryResult, { readonly kind: "integer" }>, site: MirSite,
): bigint | null {
  const selected = nativeCarrierOf(machine.deps.types, value.type, type => {
    if (!arithmetic(machine, 1, site.origin)) return null;
    return machine.deps.typeOf(type);
  });
  if (selected.kind === "resource-stop") return null;
  if (selected.kind !== "primitive" || selected.primitive !== carrier)
    return fail("A selected integer operation requires its actual operand carrier association.", site.origin);
  const integer = value.kind === "bigint" ? value.value
    : value.kind === "number" && value.value.denominator === 1n && !value.value.negativeZero ? value.value.numerator : null;
  if (integer === null) return fail("A selected integer operation requires its actual integral operand.", site.origin);
  if (!arithmetic(machine, geometry.bits, site.origin) || !arithmetic(machine, geometry.bits, site.origin)) return null;
  if (integer < geometry.minimum || integer > geometry.maximum)
    return fail("A selected integer operation operand must fit its supplied native carrier.", site.origin);
  return integer;
}

function compareNumbers(
  machine: Machine, operation: Extract<OperationIdentity, { readonly kind: "native-operator" }>,
  result: ConstValue["type"], site: MirSite, values: readonly ConstValue[],
): ConstValue | null {
  if (!isNumericComparison(operation.operator))
    return fail("Evaluate needs the actual selected native operation law.", site.origin);
  if (values.length !== 2)
    return fail("A selected integer comparison requires its two actual operands.", site.origin);
  const left = requirePresent(values[0], { owner: "evaluate", query: null, origin: site.origin, message: "The comparison has its actual left operand." });
  const right = requirePresent(values[1], { owner: "evaluate", query: null, origin: site.origin, message: "The comparison has its actual right operand." });
  if (isNativeBinaryFloatPrimitive(operation.carrier))
    return compareFloating(machine, operation.operator, operation.carrier, result, site, left, right);
  const geometry = nativeIntegerGeometryOf(operation.carrier, machine.deps.selectedNativeFacts, (work, bits) => {
    if (!arithmetic(machine, work, site.origin)) return false;
    return bits <= machine.deps.limits.maximumIntermediateBits || limit(machine, "maximumIntermediateBits", site.origin);
  });
  if (geometry.kind === "resource-stop") return null;
  if (geometry.kind !== "integer") return fail("Evaluate requires the actual selected integer comparison geometry.", site.origin);
  const first = integerValue(machine, left, operation.carrier, geometry, site);
  if (first === null) return null;
  const second = integerValue(machine, right, operation.carrier, geometry, site);
  if (second === null || !arithmetic(machine, geometry.bits, site.origin)) return null;
  return { kind: "boolean", type: result, value: compareOrdered(operation.operator, first, second) };
}

function integerFault(machine: Machine, law: Exclude<NativeOverflowLaw, "wrap">, unwind: MirUnwind | null, site: MirSite,
  reason: "overflow" | "division-by-zero" | "remainder-by-zero" | "invalid-shift-count"): null {
  const fault = reason === "overflow" ? "integer overflow"
    : reason === "division-by-zero" ? "integer division by zero"
    : reason === "remainder-by-zero" ? "integer remainder by zero" : "invalid integer shift count";
  if (unwind === null || unwind.kind === "none") return fail(`An ${fault} reached an operation marked unable to fail.`, site.origin);
  if ((law === "abort") !== (unwind.kind === "abort")) return fail(`The ${fault} and its selected failure arm disagree.`, site.origin);
  enterUnwind(machine, unwind, site, fault);
  return null;
}

function carrierRow<Row extends { readonly carrier: NativePrimitive | "bigint" }>(machine: Machine, rows: readonly Row[],
  carrier: NativePrimitive, name: string, site: MirSite): Row | null {
  for (let position = 0; position < rows.length; position += 1) {
    if (!arithmetic(machine, 1, site.origin)) return null;
    const row = rows[position];
    if (row === undefined) return fail(`Evaluate needs the complete selected ${name} relation.`, site.origin);
    if (row.carrier === carrier) return row;
  }
  return fail(`Evaluate needs the actual selected ${name} law.`, site.origin);
}

function quadraticWork(machine: Machine, width: number, site: MirSite): boolean {
  if (width > Math.floor((machine.deps.limits.maximumArithmeticWork - machine.arithmetic) / width))
    return limit(machine, "maximumArithmeticWork", site.origin);
  return arithmetic(machine, width * width, site.origin);
}

function shiftCount(machine: Machine, carrier: NativePrimitive, bits: number, right: bigint, site: MirSite,
  unwind: MirUnwind | null): bigint | null {
  const row = carrierRow(machine, machine.deps.selectedNativeFacts.invalidShiftCount, carrier, "integer shift count", site);
  if (row === null || !arithmetic(machine, bits, site.origin)) return null;
  const width = BigInt(bits);
  const negative = right < 0n;
  if (!negative && !arithmetic(machine, bits, site.origin)) return null;
  let count = right;
  if (negative || count >= width) {
    const law = row.law;
    if (law.kind === "fail") return integerFault(machine, law.failure, unwind, site, "invalid-shift-count");
    if (!arithmetic(machine, bits, site.origin)) return null;
    if (law.mask < 0n || BigInt.asUintN(bits, law.mask) !== law.mask)
      return fail("An integer shift requires its supplied mask to fit the selected carrier.", site.origin);
    if (!arithmetic(machine, bits, site.origin)) return null;
    count &= law.mask;
    if (!arithmetic(machine, bits, site.origin)) return null;
    if (count >= width) return fail("The supplied shift-count mask does not produce a valid count.", site.origin);
  }
  return count;
}

function rightShiftValue(machine: Machine, left: bigint, count: bigint, bits: number, signedZeroFill: boolean, site: MirSite): bigint | null {
  if (!arithmetic(machine, bits, site.origin)) return null;
  if (!signedZeroFill) return left >> count;
  if (count === 0n) return left;
  if (!arithmetic(machine, bits, site.origin)) return null;
  const encoded = BigInt.asUintN(bits, left);
  return arithmetic(machine, bits, site.origin) ? encoded >> count : null;
}

function bitwiseIntegers(machine: Machine, operation: NativeNumericSelection, result: ConstValue["type"], site: MirSite, unwind: MirUnwind | null,
  values: readonly ConstValue[]): ConstValue | null {
  const unary = operation.operator === "~";
  if (values.length !== (unary ? 1 : 2)) return fail("A selected integer bitwise operation requires its actual operand inventory.", site.origin);
  const selected = nativeCarrierOf(machine.deps.types, result, type => {
    if (!arithmetic(machine, 1, site.origin)) return null;
    return machine.deps.typeOf(type);
  });
  if (selected.kind === "resource-stop") return null;
  if (selected.kind !== "primitive") return fail("Evaluate needs the actual selected integer result carrier association.", site.origin);
  if (selected.primitive !== operation.carrier)
    return fail("Evaluate needs the actual Rules-selected integer bitwise result conversion association.", site.origin);
  const input = nativeIntegerGeometryOf(operation.carrier, machine.deps.selectedNativeFacts, (work, bits) => {
    if (!arithmetic(machine, work, site.origin)) return false;
    return bits <= machine.deps.limits.maximumIntermediateBits || limit(machine, "maximumIntermediateBits", site.origin);
  });
  if (input.kind === "resource-stop") return null;
  if (input.kind !== "integer") return fail("Evaluate needs the actual selected integer bitwise geometry.", site.origin);
  const left = integerValue(machine, requirePresent(values[0], { owner: "evaluate", query: null, origin: site.origin,
    message: "The bitwise integer operation has its actual first operand." }), operation.carrier, input, site);
  if (left === null) return null;
  let integer: bigint;
  if (unary) {
    if (!arithmetic(machine, input.bits, site.origin)) return null;
    integer = input.signed ? ~left : input.maximum ^ left;
  } else {
    const right = integerValue(machine, requirePresent(values[1], { owner: "evaluate", query: null, origin: site.origin,
      message: "The bitwise integer operation has its actual second operand." }), operation.carrier, input, site);
    if (right === null) return null;
    if (operation.operator === ">>" || operation.operator === ">>>") {
      const count = shiftCount(machine, operation.carrier, input.bits, right, site, unwind);
      if (count === null) return null;
      const shifted = rightShiftValue(machine, left, count, input.bits, operation.operator === ">>>" && input.signed, site);
      if (shifted === null) return null;
      integer = shifted;
    } else {
      if (!arithmetic(machine, input.bits, site.origin) || !arithmetic(machine, input.bits, site.origin)) return null;
      integer = operation.operator === "&" ? left & right : operation.operator === "|" ? left | right : left ^ right;
    }
  }
  return { kind: "number", type: result, value: { numerator: integer, denominator: 1n, negativeZero: false } };
}

function roundQuotient(machine: Machine, quotient: bigint, left: bigint, right: bigint, width: number,
  rounding: NativeRounding, site: MirSite): bigint | null {
  switch (rounding) {
    case "toward-zero": return quotient;
    case "floor": case "ceiling": case "nearest-even": case "nearest-away": break;
    default: return fail("Evaluate needs the actual selected integer division rounding law.", site.origin);
  }
  if (!quadraticWork(machine, width, site)) return null;
  const remainder = left % right;
  if (!arithmetic(machine, width, site.origin)) return null;
  if (remainder === 0n) return quotient;
  if (!arithmetic(machine, width, site.origin)) return null;
  const leftNegative = left < 0n;
  if (!arithmetic(machine, width, site.origin)) return null;
  const rightNegative = right < 0n;
  const negative = leftNegative !== rightNegative;
  let away: boolean;
  if (rounding === "floor") away = negative;
  else if (rounding === "ceiling") away = !negative;
  else {
    let residual = remainder;
    if (leftNegative) {
      if (!arithmetic(machine, width, site.origin)) return null;
      residual = -residual;
    }
    let divisor = right;
    if (rightNegative) {
      if (!arithmetic(machine, width, site.origin)) return null;
      divisor = -divisor;
    }
    if (!arithmetic(machine, width, site.origin)) return null;
    const complement = divisor - residual;
    if (!arithmetic(machine, width, site.origin)) return null;
    if (residual < complement) return quotient;
    if (!arithmetic(machine, width, site.origin)) return null;
    away = residual > complement;
    if (!away) {
      if (rounding === "nearest-away") away = true;
      else {
        if (!arithmetic(machine, width, site.origin)) return null;
        const parity = quotient & 1n;
        if (!arithmetic(machine, 1, site.origin)) return null;
        away = parity !== 0n;
      }
    }
  }
  if (!away) return quotient;
  if (!arithmetic(machine, width, site.origin)) return null;
  return negative ? quotient - 1n : quotient + 1n;
}

function divideIntegers(machine: Machine, operation: NativeNumericSelection, result: ConstValue["type"], site: MirSite,
  unwind: MirUnwind | null, values: readonly ConstValue[]): ConstValue | null {
  if (values.length !== 2) return fail("A selected integer division requires its two actual operands.", site.origin);
  const selected = nativeCarrierOf(machine.deps.types, result, type => {
    if (!arithmetic(machine, 1, site.origin)) return null;
    return machine.deps.typeOf(type);
  });
  if (selected.kind === "resource-stop") return null;
  if (selected.kind !== "primitive") return fail("Evaluate needs the actual selected integer result carrier association.", site.origin);
  if (selected.primitive !== operation.carrier)
    return fail("Evaluate needs the actual Rules-selected integer quotient result conversion association.", site.origin);
  const input = nativeIntegerGeometryOf(operation.carrier, machine.deps.selectedNativeFacts, (work, bits) => {
    if (!arithmetic(machine, work, site.origin)) return false;
    return bits <= machine.deps.limits.maximumIntermediateBits || limit(machine, "maximumIntermediateBits", site.origin);
  });
  if (input.kind === "resource-stop") return null;
  if (input.kind !== "integer") return fail("Evaluate needs the actual selected integer division geometry.", site.origin);
  const left = integerValue(machine, requirePresent(values[0], { owner: "evaluate", query: null, origin: site.origin,
    message: "The integer division has its actual left operand." }), operation.carrier, input, site);
  if (left === null) return null;
  const right = integerValue(machine, requirePresent(values[1], { owner: "evaluate", query: null, origin: site.origin,
    message: "The integer division has its actual right operand." }), operation.carrier, input, site);
  if (right === null || !arithmetic(machine, input.bits, site.origin)) return null;
  if (right === 0n) {
    const zero = carrierRow(machine, machine.deps.selectedNativeFacts.divisionByZero, operation.carrier, "integer division-by-zero", site);
    if (zero === null) return null;
    if (zero.law === "ieee754") return fail("Evaluate needs the actual selected integer division-by-zero law.", site.origin);
    return integerFault(machine, zero.law, unwind, site, "division-by-zero");
  }
  if (input.signed) {
    if (!arithmetic(machine, input.bits, site.origin)) return null;
    const minimum = left === input.minimum;
    if (minimum) {
      if (!arithmetic(machine, input.bits, site.origin)) return null;
      if (right === -1n) {
        const overflow = carrierRow(machine, machine.deps.selectedNativeFacts.signedQuotientOverflow,
          operation.carrier, "signed integer quotient overflow", site);
        if (overflow === null) return null;
        if (overflow.law !== "wrap") return integerFault(machine, overflow.law, unwind, site, "overflow");
        return { kind: "number", type: result, value: { numerator: input.minimum, denominator: 1n, negativeZero: false } };
      }
    }
  }
  const rounding = carrierRow(machine, machine.deps.selectedNativeFacts.divisionRounding, operation.carrier, "integer division rounding", site);
  if (rounding === null || !quadraticWork(machine, input.bits, site)) return null;
  const quotient = roundQuotient(machine, left / right, left, right, input.bits, rounding.rounding, site);
  if (quotient === null) return null;
  return { kind: "number", type: result, value: { numerator: quotient, denominator: 1n, negativeZero: false } };
}

function remainderIntegers(machine: Machine, operation: NativeNumericSelection, result: ConstValue["type"], site: MirSite,
  unwind: MirUnwind | null, values: readonly ConstValue[]): ConstValue | null {
  if (values.length !== 2) return fail("A selected integer remainder requires its two actual operands.", site.origin);
  const selected = nativeCarrierOf(machine.deps.types, result, type => {
    if (!arithmetic(machine, 1, site.origin)) return null;
    return machine.deps.typeOf(type);
  });
  if (selected.kind === "resource-stop") return null;
  if (selected.kind !== "primitive") return fail("Evaluate needs the actual selected integer result carrier association.", site.origin);
  if (selected.primitive !== operation.carrier)
    return fail("Evaluate needs the actual Rules-selected integer remainder result conversion association.", site.origin);
  const input = nativeIntegerGeometryOf(operation.carrier, machine.deps.selectedNativeFacts, (work, bits) => {
    if (!arithmetic(machine, work, site.origin)) return false;
    return bits <= machine.deps.limits.maximumIntermediateBits || limit(machine, "maximumIntermediateBits", site.origin);
  });
  if (input.kind === "resource-stop") return null;
  if (input.kind !== "integer") return fail("Evaluate needs the actual selected integer remainder geometry.", site.origin);
  const left = integerValue(machine, requirePresent(values[0], { owner: "evaluate", query: null, origin: site.origin,
    message: "The integer remainder has its actual left operand." }), operation.carrier, input, site);
  if (left === null) return null;
  const right = integerValue(machine, requirePresent(values[1], { owner: "evaluate", query: null, origin: site.origin,
    message: "The integer remainder has its actual right operand." }), operation.carrier, input, site);
  if (right === null || !arithmetic(machine, input.bits, site.origin)) return null;
  if (right === 0n) {
    const zero = carrierRow(machine, machine.deps.selectedNativeFacts.remainderByZero, operation.carrier, "integer remainder-by-zero", site);
    if (zero === null) return null;
    if (zero.law === "ieee754") return fail("Evaluate needs the actual selected integer remainder-by-zero law.", site.origin);
    return integerFault(machine, zero.law, unwind, site, "remainder-by-zero");
  }
  const row = carrierRow(machine, machine.deps.selectedNativeFacts.remainderSign, operation.carrier, "integer remainder sign", site);
  if (row === null) return null;
  const sign = row.sign;
  if (sign !== "dividend" && sign !== "divisor" && sign !== "nonnegative")
    return fail("Evaluate needs the actual selected integer remainder sign law.", site.origin);
  if (!quadraticWork(machine, input.bits, site)) return null;
  let integer = left % right;
  if (sign !== "dividend") {
    if (!arithmetic(machine, input.bits, site.origin)) return null;
    if (integer !== 0n) {
      if (!arithmetic(machine, input.bits, site.origin)) return null;
      const negative = integer < 0n;
      if (sign === "divisor") {
        if (!arithmetic(machine, input.bits, site.origin)) return null;
        if (negative !== (right < 0n)) {
          if (!arithmetic(machine, input.bits, site.origin)) return null;
          integer += right;
        }
      } else if (negative) {
        if (!arithmetic(machine, input.bits, site.origin)) return null;
        let divisor = right;
        if (divisor < 0n) {
          if (!arithmetic(machine, input.bits, site.origin)) return null;
          divisor = -divisor;
        }
        if (!arithmetic(machine, input.bits, site.origin)) return null;
        integer += divisor;
      }
    }
  }
  return { kind: "number", type: result, value: { numerator: integer, denominator: 1n, negativeZero: false } };
}

function overflowLaw(machine: Machine, carrier: NativePrimitive, result: NativePrimitive, operation: NativeIntegerOperation,
  site: MirSite): NativeOverflowLaw | null {
  const rows = machine.deps.selectedNativeFacts.integerOverflow;
  for (let position = 0; position < rows.length; position += 1) {
    if (!arithmetic(machine, 1, site.origin)) return null;
    const row = rows[position];
    if (row === undefined) return fail("Evaluate needs the complete selected integer overflow relation.", site.origin);
    if (row.carrier === carrier && row.operation === operation && row.result === result) return row.law;
  }
  return fail(`Evaluate needs the actual selected native operation law for integer ${operation === "add" ? "addition"
    : operation === "subtract" ? "subtraction" : operation === "multiply" ? "multiplication"
      : operation === "negate" ? "negation" : operation === "left-shift" ? "left-shift overflow" : operation}.`, site.origin);
}

function boundedInteger(machine: Machine, integer: bigint, width: number,
  output: Extract<NativeIntegerGeometryResult, { readonly kind: "integer" }>, result: ConstValue["type"],
  law: NativeOverflowLaw, site: MirSite, unwind: MirUnwind | null): ConstValue | null {
  if (!arithmetic(machine, width, site.origin)) return null;
  let outside = integer < output.minimum;
  if (!outside) {
    if (!arithmetic(machine, width, site.origin)) return null;
    outside = integer > output.maximum;
  }
  if (outside) {
    if (law !== "wrap") return integerFault(machine, law, unwind, site, "overflow");
    if (!arithmetic(machine, output.bits, site.origin)) return null;
    integer = output.signed ? BigInt.asIntN(output.bits, integer) : BigInt.asUintN(output.bits, integer);
  }
  return { kind: "number", type: result, value: { numerator: integer, denominator: 1n, negativeZero: false } };
}

function shiftLeft(machine: Machine, left: bigint, count: bigint, inputBits: number,
  output: Extract<NativeIntegerGeometryResult, { readonly kind: "integer" }>, law: NativeOverflowLaw,
  site: MirSite, unwind: MirUnwind | null): bigint | null {
  const remaining = output.bits - Number(count);
  const paid = (): boolean => arithmetic(machine, Math.max(inputBits, output.bits), site.origin);
  if (remaining <= 0) {
    if (law === "wrap") return 0n;
    if (!paid()) return null;
    return left === 0n ? 0n : integerFault(machine, law, unwind, site, "overflow");
  }
  if (law === "wrap") {
    if (!paid() || !paid()) return null;
    const shifted = BigInt.asUintN(remaining, left) << count;
    return !output.signed ? shifted : paid() ? BigInt.asIntN(output.bits, shifted) : null;
  }
  if (!paid() || !paid()) return null;
  if (left < (output.minimum >> count)) return integerFault(machine, law, unwind, site, "overflow");
  if (!paid() || !paid()) return null;
  if (left > (output.maximum >> count)) return integerFault(machine, law, unwind, site, "overflow");
  return paid() ? left << count : null;
}

function unaryIntegerArithmetic(machine: Machine, operation: NativeNumericSelection, result: ConstValue["type"],
  site: MirSite, unwind: MirUnwind | null, value: ConstValue): ConstValue | null {
  const selected = nativeCarrierOf(machine.deps.types, result, type => {
    if (!arithmetic(machine, 1, site.origin)) return null;
    return machine.deps.typeOf(type);
  });
  if (selected.kind === "resource-stop") return null;
  if (selected.kind !== "primitive") return fail("Evaluate needs the actual selected integer result carrier association.", site.origin);
  const family = operation.operator === "++" ? "increment" : operation.operator === "--" ? "decrement" : "negate";
  if (family !== "negate" && selected.primitive !== operation.carrier)
    return fail("An integer update requires its exact read and write carrier.", site.origin);
  const law = overflowLaw(machine, operation.carrier, selected.primitive, family, site);
  if (law === null) return null;
  const geometryOf = (carrier: NativePrimitive): NativeIntegerGeometryResult => nativeIntegerGeometryOf(carrier, machine.deps.selectedNativeFacts, (work, bits) => {
    if (!arithmetic(machine, work, site.origin)) return false;
    return bits <= machine.deps.limits.maximumIntermediateBits || limit(machine, "maximumIntermediateBits", site.origin);
  });
  const input = geometryOf(operation.carrier);
  if (input.kind === "resource-stop") return null;
  if (input.kind !== "integer") return fail(`Evaluate needs the actual selected integer ${family === "negate" ? "negation" : family} geometry.`, site.origin);
  const operand = integerValue(machine, value, operation.carrier, input, site);
  if (operand === null) return null;
  if (family !== "negate") {
    const increment = family === "increment";
    if (!arithmetic(machine, input.bits, site.origin)) return null;
    let integer: bigint;
    if (operand === (increment ? input.maximum : input.minimum)) {
      if (law !== "wrap") return integerFault(machine, law, unwind, site, "overflow");
      integer = increment ? input.minimum : input.maximum;
    } else {
      if (!arithmetic(machine, input.bits, site.origin)) return null;
      integer = increment ? operand + 1n : operand - 1n;
    }
    return { kind: "number", type: result, value: { numerator: integer, denominator: 1n, negativeZero: false } };
  }
  const output = selected.primitive === operation.carrier ? input : geometryOf(selected.primitive);
  if (output.kind === "resource-stop") return null;
  if (output.kind !== "integer") return fail("Evaluate needs the actual selected integer result geometry.", site.origin);
  if (!arithmetic(machine, input.bits, site.origin)) return null;
  return boundedInteger(machine, -operand, Math.max(input.bits, output.bits), output, result, law, site, unwind);
}

function unaryNumber(machine: Machine, operation: NativeNumericSelection, result: ConstValue["type"],
  site: MirSite, value: ConstValue): ConstValue | null {
  const selected = nativeCarrierOf(machine.deps.types, result, type => {
    if (!arithmetic(machine, 1, site.origin)) return null;
    return machine.deps.typeOf(type);
  });
  if (selected.kind === "resource-stop") return null;
  const family = value.kind === "floating" ? "floating" : "integer";
  if (selected.kind !== "primitive") return fail(`Evaluate needs the actual selected ${family} result carrier association.`, site.origin);
  if (selected.primitive !== operation.carrier)
    return fail(`Evaluate needs the actual Rules-selected unary ${family} result conversion association.`, site.origin);
  if (value.kind === "floating") {
    if (value.type !== result) {
      const input = nativeCarrierOf(machine.deps.types, value.type, type => {
        if (!arithmetic(machine, 1, site.origin)) return null;
        return machine.deps.typeOf(type);
      });
      if (input.kind === "resource-stop") return null;
      if (input.kind !== "primitive" || input.type !== selected.type)
        return fail("A selected unary floating operation requires the actual unchanged operand carrier.", site.origin);
    }
    if (operation.operator === "+") return value.type === result ? value : { ...value, type: result };
    const width = selectedFloatingWidth(machine, selected.primitive, value.bits, site.origin);
    if (width === null || !arithmetic(machine, width, site.origin)) return null;
    return { kind: "floating", type: result, bits: value.bits ^ floatingSignBit(width) };
  }
  const geometry = nativeIntegerGeometryOf(operation.carrier, machine.deps.selectedNativeFacts, (work, bits) => {
    if (!arithmetic(machine, work, site.origin)) return false;
    return bits <= machine.deps.limits.maximumIntermediateBits || limit(machine, "maximumIntermediateBits", site.origin);
  });
  if (geometry.kind === "resource-stop") return null;
  if (geometry.kind !== "integer") return fail("Evaluate needs the actual selected unary integer geometry.", site.origin);
  const integer = integerValue(machine, value, operation.carrier, geometry, site);
  return integer === null ? null : { kind: "number", type: result,
    value: { numerator: integer, denominator: 1n, negativeZero: false } };
}

function binaryIntegers(
  machine: Machine, operation: Extract<OperationIdentity, { readonly kind: "native-operator" }>,
  result: ConstValue["type"], site: MirSite, unwind: MirUnwind | null, values: readonly ConstValue[],
): ConstValue | null {
  const subtract = operation.operator === "-";
  const multiply = operation.operator === "*";
  const shift = operation.operator === "<<";
  const selected = nativeCarrierOf(machine.deps.types, result, type => {
    if (!arithmetic(machine, 1, site.origin)) return null;
    return machine.deps.typeOf(type);
  });
  if (selected.kind === "resource-stop") return null;
  if (selected.kind !== "primitive") return fail("Evaluate needs the actual selected integer result carrier association.", site.origin);
  const law = overflowLaw(machine, operation.carrier, selected.primitive,
    shift ? "left-shift" : multiply ? "multiply" : subtract ? "subtract" : "add", site);
  if (law === null) return null;
  if (values.length !== 2) return fail("A selected binary integer operation requires its two actual operands.", site.origin);
  const geometryOf = (carrier: NativePrimitive): NativeIntegerGeometryResult => nativeIntegerGeometryOf(carrier, machine.deps.selectedNativeFacts, (work, bits) => {
    if (!arithmetic(machine, work, site.origin)) return false;
    return bits <= machine.deps.limits.maximumIntermediateBits || limit(machine, "maximumIntermediateBits", site.origin);
  });
  const input = geometryOf(operation.carrier);
  if (input.kind === "resource-stop") return null;
  if (input.kind !== "integer") return fail(`Evaluate needs the actual selected integer ${shift ? "left-shift" : multiply ? "multiplication"
    : subtract ? "subtraction" : "addition"} geometry.`, site.origin);
  let left = integerValue(machine, requirePresent(values[0], { owner: "evaluate", query: null, origin: site.origin,
    message: "The binary integer operation has its actual left operand." }), operation.carrier, input, site);
  if (left === null) return null;
  let right = integerValue(machine, requirePresent(values[1], { owner: "evaluate", query: null, origin: site.origin,
    message: "The binary integer operation has its actual right operand." }), operation.carrier, input, site);
  if (right === null) return null;
  const output = selected.primitive === operation.carrier ? input : geometryOf(selected.primitive);
  if (output.kind === "resource-stop") return null;
  if (output.kind !== "integer") return fail("Evaluate needs the actual selected integer result geometry.", site.origin);
  if (shift) {
    const count = shiftCount(machine, operation.carrier, input.bits, right, site, unwind);
    if (count === null) return null;
    const integer = shiftLeft(machine, left, count, input.bits, output, law, site, unwind);
    return integer === null ? null : { kind: "number", type: result, value: { numerator: integer, denominator: 1n, negativeZero: false } };
  }
  if (multiply) {
    if (input.bits > Math.floor(machine.deps.limits.maximumIntermediateBits / 2)) {
      limit(machine, "maximumIntermediateBits", site.origin);
      return null;
    }
    if (!quadraticWork(machine, input.bits, site)) return null;
    return boundedInteger(machine, left * right, Math.max(input.bits * 2, output.bits), output, result, law, site, unwind);
  }
  if (subtract) {
    if (!arithmetic(machine, input.bits, site.origin)) return null;
    return boundedInteger(machine, left - right, Math.max(input.bits, output.bits), output, result, law, site, unwind);
  }
  if (output !== input) {
    const width = Math.max(output.bits, input.bits);
    if (!arithmetic(machine, width, site.origin)) return null;
    let narrower = output.minimum > input.minimum;
    if (!narrower) {
      if (!arithmetic(machine, width, site.origin)) return null;
      narrower = output.maximum < input.maximum;
    }
    if (narrower) {
      if (law === "wrap") {
        if (!arithmetic(machine, input.bits, site.origin) || !arithmetic(machine, output.bits, site.origin)) return null;
        left = output.signed ? BigInt.asIntN(output.bits, left) : BigInt.asUintN(output.bits, left);
        if (!arithmetic(machine, input.bits, site.origin) || !arithmetic(machine, output.bits, site.origin)) return null;
        right = output.signed ? BigInt.asIntN(output.bits, right) : BigInt.asUintN(output.bits, right);
      } else {
        if (!arithmetic(machine, input.bits, site.origin)) return null;
        const firstPositive = left >= 0n;
        if (!arithmetic(machine, input.bits, site.origin)) return null;
        const secondPositive = right >= 0n;
        if (firstPositive !== secondPositive) {
          if (!arithmetic(machine, input.bits, site.origin)) return null;
          const integer = left + right;
          if (!arithmetic(machine, width, site.origin)) return null;
          const below = integer < output.minimum;
          if (below) return integerFault(machine, law, unwind, site, "overflow");
          if (!arithmetic(machine, width, site.origin)) return null;
          if (integer > output.maximum) return integerFault(machine, law, unwind, site, "overflow");
          return { kind: "number", type: result, value: { numerator: integer, denominator: 1n, negativeZero: false } };
        }
        if (!arithmetic(machine, width, site.origin)) return null;
        const firstOutside = firstPositive ? left > output.maximum : left < output.minimum;
        if (firstOutside) return integerFault(machine, law, unwind, site, "overflow");
        if (!arithmetic(machine, width, site.origin)) return null;
        const secondOutside = secondPositive ? right > output.maximum : right < output.minimum;
        if (secondOutside) return integerFault(machine, law, unwind, site, "overflow");
      }
    }
  }
  const paid = (): boolean => arithmetic(machine, output.bits, site.origin);
  if (!paid()) return null;
  const positive = right >= 0n;
  if (!paid()) return null;
  const threshold = positive ? output.maximum - right : output.minimum - right;
  if (!paid()) return null;
  const overflow = positive ? left > threshold : left < threshold;
  let integer: bigint;
  if (overflow) {
    if (law !== "wrap") return integerFault(machine, law, unwind, site, "overflow");
    if (!paid()) return null;
    const distance = positive ? left - threshold : threshold - left;
    if (!paid()) return null;
    const offset = distance - 1n;
    if (!paid()) return null;
    integer = positive ? output.minimum + offset : output.maximum - offset;
  } else {
    if (!paid()) return null;
    integer = left + right;
  }
  return { kind: "number", type: result, value: { numerator: integer, denominator: 1n, negativeZero: false } };
}

export function nativeNumericOperation(machine: Machine, operation: NativeNumericSelection, result: ConstValue["type"],
  site: MirSite, unwind: MirUnwind | null, values: readonly ConstValue[]): ConstValue | null {
  if (operation.operator === "++" || operation.operator === "--") {
    const operand = values.length === 1 ? values[0] : undefined;
    if (operand === undefined) return fail("A selected integer update requires its one actual operand.", site.origin);
    return unaryIntegerArithmetic(machine, operation, result, site, unwind, operand);
  }
  if ((operation.operator === "+" || operation.operator === "-") && values.length === 1) {
    const value = requirePresent(values[0], { owner: "evaluate", query: null, origin: site.origin, message: "The unary operation has its actual operand." });
    return operation.operator === "-" && value.kind !== "floating"
      ? unaryIntegerArithmetic(machine, operation, result, site, unwind, value) : unaryNumber(machine, operation, result, site, value);
  }
  return operation.operator === "+" || operation.operator === "-" || operation.operator === "*" || operation.operator === "<<"
      ? binaryIntegers(machine, operation, result, site, unwind, values)
    : operation.operator === "/" ? divideIntegers(machine, operation, result, site, unwind, values)
    : operation.operator === "%" ? remainderIntegers(machine, operation, result, site, unwind, values)
    : operation.operator === "&" || operation.operator === "|" || operation.operator === "^" || operation.operator === "~"
      || operation.operator === ">>" || operation.operator === ">>>"
      ? bitwiseIntegers(machine, operation, result, site, unwind, values)
    : compareNumbers(machine, operation, result, site, values);
}
