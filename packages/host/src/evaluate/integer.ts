import type { Origin } from "../ids/contract.js";
import type { MirSite, MirUnwind } from "../ir-mir/contract.js";
import type { OperationIdentity } from "../ir-infer/contract.js";
import type { ConstValue, NativeIntegerGeometryResult, NativeOverflowLaw, NativePrimitive, NativeRounding } from "../ir-types/contract.js";
import { nativeCarrierOf, nativeIntegerGeometryOf } from "../ir-types/index.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { EvaluateDeps } from "./contract.js";
import type { Machine as EvaluationMachine } from "./pause.js";
import { arithmetic, evaluationFault, limit } from "./budget.js";

type Machine = EvaluationMachine<EvaluateDeps>;
type IntegerOperation = Extract<OperationIdentity, { readonly kind: "native-operator" }>;
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

function compareIntegers(
  machine: Machine, operation: Extract<OperationIdentity, { readonly kind: "native-operator" }>,
  result: ConstValue["type"], site: MirSite, values: readonly ConstValue[],
): ConstValue | null {
  if (operation.operator !== "==" && operation.operator !== "!=" && operation.operator !== "===" && operation.operator !== "!=="
    && operation.operator !== "<" && operation.operator !== "<=" && operation.operator !== ">" && operation.operator !== ">=")
    return fail("Evaluate needs the actual selected native operation law.", site.origin);
  if (values.length !== 2)
    return fail("A selected integer comparison requires its two actual operands.", site.origin);
  const left = requirePresent(values[0], { owner: "evaluate", query: null, origin: site.origin, message: "The comparison has its actual left operand." });
  const right = requirePresent(values[1], { owner: "evaluate", query: null, origin: site.origin, message: "The comparison has its actual right operand." });
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
  const value = operation.operator === "==" || operation.operator === "===" ? first === second
    : operation.operator === "!=" || operation.operator === "!==" ? first !== second
      : operation.operator === "<" ? first < second : operation.operator === "<=" ? first <= second
        : operation.operator === ">" ? first > second : first >= second;
  return { kind: "boolean", type: result, value };
}

function integerFault(machine: Machine, law: Exclude<NativeOverflowLaw, "wrap">, unwind: MirUnwind | null, site: MirSite,
  reason: "overflow" | "division-by-zero" | "remainder-by-zero"): null {
  const fault = reason === "overflow" ? "integer overflow"
    : reason === "division-by-zero" ? "integer division by zero" : "integer remainder by zero";
  if (unwind === null || unwind.kind === "none") return fail(`An ${fault} reached an operation marked unable to fail.`, site.origin);
  if ((law === "abort") !== (unwind.kind === "abort")) return fail(`The ${fault} and its selected failure arm disagree.`, site.origin);
  if (law === "abort") {
    evaluationFault(machine, site.origin, `A process-ending ${fault} occurred during constant evaluation.`);
    return null;
  }
  let next: MirUnwind = unwind;
  for (let position = machine.frames.length - 1;; position -= 1) {
    if (!arithmetic(machine, 1, site.origin)) return null;
    if (next.kind === "handler") return fail(`Evaluate needs the actual selected ${reason} fault value for its handler.`, site.origin);
    if (next.kind !== "escape") return fail(`A call's ${reason} continuation must retain its actual unwinding arm.`, site.origin);
    const frame = requirePresent(machine.frames[position], { owner: "evaluate", query: null, origin: site.origin,
      message: `An escaping ${reason} retains its actual caller frame.` });
    if (frame.caller === null) {
      evaluationFault(machine, site.origin, `An ${fault} escaped constant evaluation.`);
      return null;
    }
    next = frame.caller.unwind;
  }
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

function bitwiseIntegers(machine: Machine, operation: IntegerOperation, result: ConstValue["type"], site: MirSite,
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
    if (right === null || !arithmetic(machine, input.bits, site.origin) || !arithmetic(machine, input.bits, site.origin)) return null;
    integer = operation.operator === "&" ? left & right : operation.operator === "|" ? left | right : left ^ right;
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

function divideIntegers(machine: Machine, operation: IntegerOperation, result: ConstValue["type"], site: MirSite,
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

function remainderIntegers(machine: Machine, operation: IntegerOperation, result: ConstValue["type"], site: MirSite,
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

function overflowLaw(machine: Machine, carrier: NativePrimitive, result: NativePrimitive, operation: "add" | "subtract" | "multiply" | "negate",
  site: MirSite): NativeOverflowLaw | null {
  const rows = machine.deps.selectedNativeFacts.integerOverflow;
  for (let position = 0; position < rows.length; position += 1) {
    if (!arithmetic(machine, 1, site.origin)) return null;
    const row = rows[position];
    if (row === undefined) return fail("Evaluate needs the complete selected integer overflow relation.", site.origin);
    if (row.carrier === carrier && row.operation === operation && row.result === result) return row.law;
  }
  return fail(`Evaluate needs the actual selected native operation law for integer ${operation === "add" ? "addition"
    : operation === "subtract" ? "subtraction" : operation === "multiply" ? "multiplication" : "negation"}.`, site.origin);
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

function negateInteger(machine: Machine, operation: IntegerOperation, result: ConstValue["type"],
  site: MirSite, unwind: MirUnwind | null, value: ConstValue): ConstValue | null {
  const selected = nativeCarrierOf(machine.deps.types, result, type => {
    if (!arithmetic(machine, 1, site.origin)) return null;
    return machine.deps.typeOf(type);
  });
  if (selected.kind === "resource-stop") return null;
  if (selected.kind !== "primitive") return fail("Evaluate needs the actual selected integer result carrier association.", site.origin);
  const law = overflowLaw(machine, operation.carrier, selected.primitive, "negate", site);
  if (law === null) return null;
  const geometryOf = (carrier: NativePrimitive): NativeIntegerGeometryResult => nativeIntegerGeometryOf(carrier, machine.deps.selectedNativeFacts, (work, bits) => {
    if (!arithmetic(machine, work, site.origin)) return false;
    return bits <= machine.deps.limits.maximumIntermediateBits || limit(machine, "maximumIntermediateBits", site.origin);
  });
  const input = geometryOf(operation.carrier);
  if (input.kind === "resource-stop") return null;
  if (input.kind !== "integer") return fail("Evaluate needs the actual selected integer negation geometry.", site.origin);
  const operand = integerValue(machine, value, operation.carrier, input, site);
  if (operand === null) return null;
  const output = selected.primitive === operation.carrier ? input : geometryOf(selected.primitive);
  if (output.kind === "resource-stop") return null;
  if (output.kind !== "integer") return fail("Evaluate needs the actual selected integer result geometry.", site.origin);
  if (!arithmetic(machine, input.bits, site.origin)) return null;
  return boundedInteger(machine, -operand, Math.max(input.bits, output.bits), output, result, law, site, unwind);
}

function identityInteger(machine: Machine, operation: IntegerOperation, result: ConstValue["type"],
  site: MirSite, value: ConstValue): ConstValue | null {
  const selected = nativeCarrierOf(machine.deps.types, result, type => {
    if (!arithmetic(machine, 1, site.origin)) return null;
    return machine.deps.typeOf(type);
  });
  if (selected.kind === "resource-stop") return null;
  if (selected.kind !== "primitive") return fail("Evaluate needs the actual selected integer result carrier association.", site.origin);
  if (selected.primitive !== operation.carrier)
    return fail("Evaluate needs the actual Rules-selected unary integer result conversion association.", site.origin);
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
  const selected = nativeCarrierOf(machine.deps.types, result, type => {
    if (!arithmetic(machine, 1, site.origin)) return null;
    return machine.deps.typeOf(type);
  });
  if (selected.kind === "resource-stop") return null;
  if (selected.kind !== "primitive") return fail("Evaluate needs the actual selected integer result carrier association.", site.origin);
  const law = overflowLaw(machine, operation.carrier, selected.primitive, multiply ? "multiply" : subtract ? "subtract" : "add", site);
  if (law === null) return null;
  if (values.length !== 2) return fail("A selected binary integer operation requires its two actual operands.", site.origin);
  const geometryOf = (carrier: NativePrimitive): NativeIntegerGeometryResult => nativeIntegerGeometryOf(carrier, machine.deps.selectedNativeFacts, (work, bits) => {
    if (!arithmetic(machine, work, site.origin)) return false;
    return bits <= machine.deps.limits.maximumIntermediateBits || limit(machine, "maximumIntermediateBits", site.origin);
  });
  const input = geometryOf(operation.carrier);
  if (input.kind === "resource-stop") return null;
  if (input.kind !== "integer") return fail(`Evaluate needs the actual selected integer ${multiply ? "multiplication"
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

export function integerOperation(machine: Machine, operation: IntegerOperation, result: ConstValue["type"],
  site: MirSite, unwind: MirUnwind | null, values: readonly ConstValue[]): ConstValue | null {
  return operation.operator === "+" && values.length === 1
    ? identityInteger(machine, operation, result, site, requirePresent(values[0], {
      owner: "evaluate", query: null, origin: site.origin, message: "The unary identity has its actual operand." }))
    : operation.operator === "-" && values.length === 1
    ? negateInteger(machine, operation, result, site, unwind, requirePresent(values[0], {
      owner: "evaluate", query: null, origin: site.origin, message: "The negation has its actual operand." }))
    : operation.operator === "+" || operation.operator === "-" || operation.operator === "*"
      ? binaryIntegers(machine, operation, result, site, unwind, values)
    : operation.operator === "/" ? divideIntegers(machine, operation, result, site, unwind, values)
    : operation.operator === "%" ? remainderIntegers(machine, operation, result, site, unwind, values)
    : operation.operator === "&" || operation.operator === "|" || operation.operator === "^" || operation.operator === "~"
      ? bitwiseIntegers(machine, operation, result, site, values)
    : compareIntegers(machine, operation, result, site, values);
}
