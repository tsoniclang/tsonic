import type { Origin } from "../ids/contract.js";
import type { MirSite, MirUnwind } from "../ir-mir/contract.js";
import type { OperationIdentity } from "../ir-infer/contract.js";
import type { ConstValue, NativeIntegerGeometryResult, NativeOverflowLaw, NativePrimitive } from "../ir-types/contract.js";
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

function overflowFault(machine: Machine, law: Exclude<NativeOverflowLaw, "wrap">, unwind: MirUnwind | null, site: MirSite): null {
  if (unwind === null || unwind.kind === "none") return fail("An integer overflow reached an operation marked unable to fail.", site.origin);
  if ((law === "abort") !== (unwind.kind === "abort")) return fail("The integer overflow and its selected failure arm disagree.", site.origin);
  if (law === "abort") {
    evaluationFault(machine, site.origin, "A process-ending integer overflow occurred during constant evaluation.");
    return null;
  }
  let next: MirUnwind = unwind;
  for (let position = machine.frames.length - 1;; position -= 1) {
    if (!arithmetic(machine, 1, site.origin)) return null;
    if (next.kind === "handler") return fail("Evaluate needs the actual selected overflow fault value for its handler.", site.origin);
    if (next.kind !== "escape") return fail("A call's overflow continuation must retain its actual unwinding arm.", site.origin);
    const frame = requirePresent(machine.frames[position], { owner: "evaluate", query: null, origin: site.origin,
      message: "An escaping overflow retains its actual caller frame." });
    if (frame.caller === null) {
      evaluationFault(machine, site.origin, "An integer overflow escaped constant evaluation.");
      return null;
    }
    next = frame.caller.unwind;
  }
}

function overflowLaw(machine: Machine, carrier: NativePrimitive, result: NativePrimitive, operation: "add" | "subtract" | "negate",
  site: MirSite): NativeOverflowLaw | null {
  const rows = machine.deps.selectedNativeFacts.integerOverflow;
  for (let position = 0; position < rows.length; position += 1) {
    if (!arithmetic(machine, 1, site.origin)) return null;
    const row = rows[position];
    if (row === undefined) return fail("Evaluate needs the complete selected integer overflow relation.", site.origin);
    if (row.carrier === carrier && row.operation === operation && row.result === result) return row.law;
  }
  return fail(`Evaluate needs the actual selected native operation law for integer ${operation === "add" ? "addition"
    : operation === "subtract" ? "subtraction" : "negation"}.`, site.origin);
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
    if (law !== "wrap") return overflowFault(machine, law, unwind, site);
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

function binaryIntegers(
  machine: Machine, operation: Extract<OperationIdentity, { readonly kind: "native-operator" }>,
  result: ConstValue["type"], site: MirSite, unwind: MirUnwind | null, values: readonly ConstValue[],
): ConstValue | null {
  const subtract = operation.operator === "-";
  const selected = nativeCarrierOf(machine.deps.types, result, type => {
    if (!arithmetic(machine, 1, site.origin)) return null;
    return machine.deps.typeOf(type);
  });
  if (selected.kind === "resource-stop") return null;
  if (selected.kind !== "primitive") return fail("Evaluate needs the actual selected integer result carrier association.", site.origin);
  const law = overflowLaw(machine, operation.carrier, selected.primitive, subtract ? "subtract" : "add", site);
  if (law === null) return null;
  if (values.length !== 2) return fail("A selected binary integer operation requires its two actual operands.", site.origin);
  const geometryOf = (carrier: NativePrimitive): NativeIntegerGeometryResult => nativeIntegerGeometryOf(carrier, machine.deps.selectedNativeFacts, (work, bits) => {
    if (!arithmetic(machine, work, site.origin)) return false;
    return bits <= machine.deps.limits.maximumIntermediateBits || limit(machine, "maximumIntermediateBits", site.origin);
  });
  const input = geometryOf(operation.carrier);
  if (input.kind === "resource-stop") return null;
  if (input.kind !== "integer") return fail(`Evaluate needs the actual selected integer ${subtract ? "subtraction" : "addition"} geometry.`, site.origin);
  let left = integerValue(machine, requirePresent(values[0], { owner: "evaluate", query: null, origin: site.origin,
    message: "The binary integer operation has its actual left operand." }), operation.carrier, input, site);
  if (left === null) return null;
  let right = integerValue(machine, requirePresent(values[1], { owner: "evaluate", query: null, origin: site.origin,
    message: "The binary integer operation has its actual right operand." }), operation.carrier, input, site);
  if (right === null) return null;
  const output = selected.primitive === operation.carrier ? input : geometryOf(selected.primitive);
  if (output.kind === "resource-stop") return null;
  if (output.kind !== "integer") return fail("Evaluate needs the actual selected integer result geometry.", site.origin);
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
          if (below) return overflowFault(machine, law, unwind, site);
          if (!arithmetic(machine, width, site.origin)) return null;
          if (integer > output.maximum) return overflowFault(machine, law, unwind, site);
          return { kind: "number", type: result, value: { numerator: integer, denominator: 1n, negativeZero: false } };
        }
        if (!arithmetic(machine, width, site.origin)) return null;
        const firstOutside = firstPositive ? left > output.maximum : left < output.minimum;
        if (firstOutside) return overflowFault(machine, law, unwind, site);
        if (!arithmetic(machine, width, site.origin)) return null;
        const secondOutside = secondPositive ? right > output.maximum : right < output.minimum;
        if (secondOutside) return overflowFault(machine, law, unwind, site);
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
    if (law !== "wrap") return overflowFault(machine, law, unwind, site);
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
  return operation.operator === "-" && values.length === 1
    ? negateInteger(machine, operation, result, site, unwind, requirePresent(values[0], {
      owner: "evaluate", query: null, origin: site.origin, message: "The negation has its actual operand." }))
    : operation.operator === "+" || operation.operator === "-" ? binaryIntegers(machine, operation, result, site, unwind, values)
    : compareIntegers(machine, operation, result, site, values);
}
