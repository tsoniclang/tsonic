import { throwInvariant } from "../diag/index.js";
import type { Origin, TyId } from "../ids/contract.js";
import type { OperationIdentity } from "../ir-infer/contract.js";
import type { MirSite } from "../ir-mir/contract.js";
import type { ConstValue, ExactRational, LiteralCompatibilityReader, NativeFloatingFormat, TypeTerm } from "../ir-types/contract.js";
import { exactFloat64LiteralFit, literalCompatibilityOf } from "../ir-types/index.js";
import { arithmetic, limit, selectedFloatingFormat, selectedOptionalDomain } from "./budget.js";
import type { EvaluateDeps } from "./contract.js";
import type { Machine as EvaluationMachine } from "./pause.js";

type Machine = EvaluationMachine<EvaluateDeps>;
const fail = (message: string, origin: Origin): never => throwInvariant({ owner: "evaluate", query: null, origin, message });

export function packFloat64Literal(machine: Machine, value: ExactRational, authored: ExactRational,
  site: MirSite, format: NativeFloatingFormat): bigint | null {
  const float64FractionBits = 52;
  const float64Bias = 1023;
  const float64SmallestExponent = 1 - float64Bias;
  const float64SubnormalExponent = float64SmallestExponent - float64FractionBits;
  const float64Width = 64;
  const float64LiteralWork = float64Bias + 1 - float64SubnormalExponent + 1 + float64Width;
  if (!arithmetic(machine, float64LiteralWork, site.origin)) return null;
  const { numerator, denominator, negativeZero } = value;
  if (numerator !== authored.numerator || denominator !== authored.denominator || negativeZero !== authored.negativeZero
    || !exactFloat64LiteralFit(value, format))
    return fail("A selected Float64 materialization requires the unchanged, exactly representable literal payload.", site.origin);
  if (machine.deps.limits.maximumIntermediateBits < float64Width) {
    limit(machine, "maximumIntermediateBits", site.origin);
    return null;
  }
  const sign = numerator < 0n || negativeZero ? 0x8000000000000000n : 0n;
  if (numerator === 0n) return sign;
  const absolute = numerator < 0n ? -numerator : numerator;
  const numeratorWidth = absolute.toString(2).length;
  const denominatorExponent = denominator.toString(2).length - 1;
  const exponent = numeratorWidth - 1 - denominatorExponent;
  const shift = exponent < float64SmallestExponent ? -float64SubnormalExponent - denominatorExponent : float64FractionBits + 1 - numeratorWidth;
  const significand = shift < 0 ? absolute >> BigInt(-shift) : absolute << BigInt(shift);
  const exponentField = exponent < float64SmallestExponent ? 0n : BigInt(exponent + float64Bias) << BigInt(float64FractionBits);
  return sign | exponentField | (significand & 0xfffffffffffffn);
}

export function selectedConversion(machine: Machine, operation: Extract<OperationIdentity, { readonly kind: "conversion" }>,
  result: TyId, site: MirSite, operands: readonly ConstValue[]): ConstValue | null {
  if (!arithmetic(machine, 1, site.origin)) return null;
  const value = operands[0];
  if (operands.length !== 1 || value?.type !== operation.from || result !== operation.to)
    return fail("A selected conversion retains its actual source value and destination type.", site.origin);
  const embedding = operation.embedding;
  if (embedding.kind === "identity") {
    if (operation.from !== operation.to) return fail("An identity embedding retains the same selected type.", site.origin);
    return value;
  }
  if (embedding.kind !== "conversion" || embedding.check.kind !== "none")
    return fail("Evaluate requires the actual selected conversion check and its failure execution.", site.origin);
  const read = (type: TyId) => arithmetic(machine, 1, site.origin) ? machine.deps.typeOf(type) : null;
  let sourceLiteral: TypeTerm | undefined;
  let literalDestination: TypeTerm | undefined;
  const reader: LiteralCompatibilityReader = {
    numericRepresentation: "preserve-payload",
    typeOf: id => id === operation.from && sourceLiteral !== undefined ? sourceLiteral
      : id === operation.to && literalDestination !== undefined ? literalDestination : read(id),
    admit: (work, entries) => arithmetic(machine, work, site.origin) && arithmetic(machine, entries, site.origin),
  };
  const held = (type: TyId, payload: Exclude<ConstValue, { readonly kind: "floating" | "error" }>, source?: TypeTerm): boolean => {
    const selected = literalCompatibilityOf(machine.deps.types, type, payload, machine.deps.selectedNativeFacts,
      source === undefined ? reader : { ...reader, typeOf: id => id === type ? source : read(id) });
    if (selected.kind === "resource-stop") return false;
    if (selected.kind === "needs-selected-evidence")
      return fail(`Evaluate requires actual selected ${selected.requirement} evidence for literal conversion at type ${selected.type}.`, site.origin);
    if (selected.kind !== "compatible")
      return fail("A selected literal-fit conversion retains its exact payload and resolved source/destination domains.", site.origin);
    return true;
  };
  if (embedding.conversion === "absence" || embedding.conversion === "union-injection") {
    const domain = selectedOptionalDomain(machine, result, site.origin);
    if (domain.kind === "resource-stop") return null;
    if (domain.kind !== "optional-value")
      return fail("Evaluate requires the actual selected optional value domain.", site.origin);
    if (embedding.conversion === "absence") {
      const source = read(value.type);
      if (source === null) return null;
      if (value.kind !== "absence" || source?.kind !== "intrinsic" || source.intrinsic !== "absence")
        return fail("An absence embedding requires the selected native absence payload and type.", site.origin);
    } else {
      switch (value.kind) {
        case "floating":
          if (domain.payload !== "float64" || value.type !== domain.present)
            return fail("A floating embedding requires the actual selected present type.", site.origin);
          break;
        case "boolean": case "string":
          if (domain.payload !== value.kind)
            return fail("An optional embedding must retain its actual selected present payload.", site.origin);
          if (value.type !== domain.present) {
            const source = read(value.type);
            if (source === null) return null;
            if (source?.kind !== "literal" || source.base !== domain.present)
              return fail("An optional embedding must retain its actual selected present type.", site.origin);
            if (!held(operation.from, value, source)) return null;
          }
          break;
        default: return fail("Evaluate requires the actual selected representation transformation for this conversion.", site.origin);
      }
    }
    return { ...value, type: result };
  }
  if (embedding.conversion !== "literal-fit" || value.kind === "floating" || value.kind === "error")
    return fail("Evaluate requires the actual selected representation transformation for this conversion.", site.origin);
  if (value.kind === "number") {
    const source = read(operation.from);
    if (source === null) return null;
    sourceLiteral = source;
    if (source.kind === "literal" && source.base === operation.to && source.value.kind === "number") {
      const destination = read(operation.to);
      if (destination === null) return null;
      literalDestination = destination;
      if (destination.kind === "primitive" && destination.primitive === "float64") {
        const format = selectedFloatingFormat(machine, "float64", site.origin);
        if (format === null) return null;
        const bits = packFloat64Literal(machine, value.value, source.value.value, site, format);
        return bits === null ? null : { kind: "floating", type: result, bits };
      }
    }
  }
  if (!held(operation.from, value) || !held(operation.to, value)) return null;
  return { ...value, type: result };
}
