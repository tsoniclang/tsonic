import { throwInvariant } from "../diag/index.js";
import type { Origin, TyId } from "../ids/contract.js";
import type { MirSite } from "../ir-mir/contract.js";
import type { ConstValue, NativeBinaryFloatPrimitive, NativeFloatingFormat } from "../ir-types/contract.js";
import { floatingBitsFit, nativeCarrierOf } from "../ir-types/index.js";
import { arithmetic, selectedFloatingFormat, selectedFloatingWidth } from "./budget.js";
import { packFloat64Literal } from "./conversions.js";
import type { EvaluateDeps } from "./contract.js";
import type { Machine as EvaluationMachine } from "./pause.js";

type Machine = EvaluationMachine<EvaluateDeps>;
type NumericComparison = "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=";

export function floatingSignBit(width: 16 | 32 | 64): bigint {
  return width === 16 ? 0x8000n : width === 32 ? 0x80000000n : 0x8000000000000000n;
}

export function isNumericComparison(operator: string): operator is NumericComparison {
  return operator === "==" || operator === "!=" || operator === "===" || operator === "!=="
    || operator === "<" || operator === "<=" || operator === ">" || operator === ">=";
}

export function compareOrdered(operator: NumericComparison, left: bigint, right: bigint): boolean {
  return operator === "==" || operator === "===" ? left === right
    : operator === "!=" || operator === "!==" ? left !== right
      : operator === "<" ? left < right : operator === "<=" ? left <= right
        : operator === ">" ? left > right : left >= right;
}

function orderingKey(machine: Machine, width: 16 | 32 | 64, bits: bigint, origin: Origin): bigint | "unordered" | null {
  if (!arithmetic(machine, width, origin)) return null;
  const mask = width === 16 ? 0x7fffn : width === 32 ? 0x7fffffffn : 0x7fffffffffffffffn;
  const absolute = bits & mask;
  if (!arithmetic(machine, width, origin)) return null;
  const infinity = width === 16 ? 0x7c00n : width === 32 ? 0x7f800000n : 0x7ff0000000000000n;
  if (absolute > infinity) return "unordered";
  if (!arithmetic(machine, width, origin)) return null;
  if (bits < floatingSignBit(width)) return absolute;
  return arithmetic(machine, width, origin) ? -absolute : null;
}

function operandCarrier(machine: Machine, value: ConstValue, carrier: NativeBinaryFloatPrimitive, origin: Origin): TyId | null {
  const selected = nativeCarrierOf(machine.deps.types, value.type,
    type => arithmetic(machine, 1, origin) ? machine.deps.typeOf(type) : null);
  if (selected.kind === "resource-stop") return null;
  if (selected.kind !== "primitive" || selected.primitive !== carrier)
    return throwInvariant({ owner: "evaluate", query: null, origin, message: "A selected floating comparison requires both actual operand carriers." });
  return selected.type;
}

function exactFloat64Operands(machine: Machine, left: ConstValue, right: ConstValue, site: MirSite): readonly [bigint, bigint] | null {
  const { origin } = site;
  let base: TyId | null = null;
  let format: NativeFloatingFormat | null = null;
  const formatOf = () => format ??= selectedFloatingFormat(machine, "float64", origin);
  const wrongCarrier = (): never => throwInvariant({ owner: "evaluate", query: null, origin, message: "A selected floating comparison requires both actual operand carriers." });
  const bitsOf = (value: ConstValue): bigint | null => {
    if (!arithmetic(machine, 1, origin)) return null;
    if (value.kind === "floating") {
      if (value.type !== base) {
        const selected = operandCarrier(machine, value, "float64", origin);
        if (selected === null) return null;
        if (base !== null && base !== selected) return wrongCarrier();
        base = selected;
      }
      const row = formatOf();
      if (row === null) return null;
      const bits = value.bits;
      if (!floatingBitsFit(bits, row)) throw new TypeError("Evaluate floating values require a valid selected encoding");
      return bits;
    }
    if (value.kind === "number") {
      if (!arithmetic(machine, 1, origin)) return null;
      const literal = machine.deps.typeOf(value.type);
      if (literal.kind === "literal" && literal.value.kind === "number") {
        if (base === null) {
          if (!arithmetic(machine, 1, origin)) return null;
          const term = machine.deps.typeOf(literal.base);
          if (term.kind !== "primitive" || term.primitive !== "float64") return wrongCarrier();
          base = literal.base;
        } else if (base !== literal.base) return wrongCarrier();
        const row = formatOf();
        return row === null ? null : packFloat64Literal(machine, value.value, literal.value.value, site, row);
      }
    }
    return throwInvariant({ owner: "evaluate", query: null, origin, message: "A selected floating comparison requires both exact floating bit values." });
  };
  const leftBits = bitsOf(left);
  if (leftBits === null) return null;
  const rightBits = bitsOf(right);
  return rightBits === null ? null : [leftBits, rightBits];
}

export function compareFloating(machine: Machine, operator: NumericComparison, carrier: NativeBinaryFloatPrimitive,
  result: TyId, site: MirSite, left: ConstValue, right: ConstValue): ConstValue | null {
  const origin = site.origin;
  let leftBits: bigint;
  let rightBits: bigint;
  let width: 16 | 32 | 64;
  if (left.kind === "floating" && right.kind === "floating") {
    if (operandCarrier(machine, left, carrier, origin) === null || operandCarrier(machine, right, carrier, origin) === null) return null;
    const selected = selectedFloatingWidth(machine, carrier, left.bits, origin);
    if (selected === null) return null;
    width = selected;
    leftBits = left.bits;
    rightBits = right.bits;
  } else {
    if (carrier !== "float64")
      return throwInvariant({ owner: "evaluate", query: null, origin, message: "A selected floating comparison requires both exact floating bit values." });
    const bits = exactFloat64Operands(machine, left, right, site);
    if (bits === null) return null;
    [leftBits, rightBits] = bits;
    width = 64;
  }
  const first = orderingKey(machine, width, leftBits, origin);
  if (first === null) return null;
  const second = first === "unordered" ? "unordered" : orderingKey(machine, width, rightBits, origin);
  if (second === null) return null;
  if (first === "unordered" || second === "unordered")
    return { kind: "boolean", type: result, value: operator === "!=" || operator === "!==" };
  return arithmetic(machine, width, origin) ? { kind: "boolean", type: result, value: compareOrdered(operator, first, second) } : null;
}
