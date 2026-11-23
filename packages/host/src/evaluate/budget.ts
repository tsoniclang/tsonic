import type { Diagnostic, DiagnosticIdentity, UnitRef } from "../diag/contract.js";
import { hostDiagnosticCode, resourceLimitDiagnostic } from "../diag/index.js";
import type { Origin, TyId } from "../ids/contract.js";
import type { ConstValue, NativeFloatingFormat, NativePrimitive, OptionalValueDomain } from "../ir-types/contract.js";
import { floatingBitsFit, floatingFormatWidth, isNativeBinaryFloatPrimitive, nativeCarrierOf, optionalValueDomainOf } from "../ir-types/index.js";
import type { EvaluateDeps, EvaluatorLimits } from "./contract.js";
import type { Machine as EvaluationMachine } from "./pause.js";

type Machine = EvaluationMachine<EvaluateDeps>;

export function validateLimits(limits: EvaluatorLimits): void {
  maximum(limits.maximumSteps, "maximumSteps");
  maximum(limits.maximumIntermediateBits, "maximumIntermediateBits");
  maximum(limits.maximumResultBits, "maximumResultBits");
  maximum(limits.maximumArithmeticWork, "maximumArithmeticWork");
}

function maximum(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new TypeError(`evaluate.${name} must be a nonnegative safe integer`);
}

export function limit(machine: Machine, field: keyof Machine["deps"]["limits"], origin: Origin): false {
  const diagnostic = resourceLimitDiagnostic({ owner: "evaluate", limit: `evaluation.${field}`, maximum: machine.deps.limits[field],
    site: { kind: "source", origin }, unit: { request: machine.unit, position: { kind: "result" } } });
  machine.result ??= { kind: "refused", diagnostics: [diagnostic] };
  return false;
}

export function step(machine: Machine, origin: Origin): boolean {
  if (machine.steps >= machine.deps.limits.maximumSteps) return limit(machine, "maximumSteps", origin);
  machine.steps += 1;
  return true;
}

export function arithmetic(machine: Machine, work: number, origin: Origin): boolean {
  if (work > machine.deps.limits.maximumArithmeticWork - machine.arithmetic) return limit(machine, "maximumArithmeticWork", origin);
  machine.arithmetic += work;
  return true;
}

function integerBits(value: bigint, maximum: number): number | null {
  if (BigInt.asIntN(maximum === Number.MAX_SAFE_INTEGER ? maximum : maximum + 1, value) !== value) return null;
  const magnitude = value < 0n ? -value : value;
  const bits = magnitude === 0n ? 0 : magnitude.toString(2).length;
  return bits <= maximum ? bits : null;
}

export function selectedFloatingFormat(machine: Machine, carrier: NativePrimitive, origin: Origin): NativeFloatingFormat | null {
  const formats = machine.deps.selectedNativeFacts.floatingFormats;
  for (let index = 0; index < formats.length; index += 1) {
    if (!arithmetic(machine, 1, origin)) return null;
    const row = formats[index];
    if (row === undefined) throw new TypeError("Evaluate floating values require the complete selected carrier format relation");
    if (row.carrier === carrier) return row;
  }
  throw new TypeError("Evaluate floating values require the selected carrier format");
}

export function selectedFloatingWidth(machine: Machine, carrier: NativePrimitive, bits: bigint, origin: Origin): 16 | 32 | 64 | null {
  const row = selectedFloatingFormat(machine, carrier, origin);
  if (row === null) return null;
  const width = floatingFormatWidth(row);
  if (width === null || !floatingBitsFit(bits, row)) throw new TypeError("Evaluate floating values require a valid selected encoding");
  return width;
}

export function selectedOptionalDomain(machine: Machine, type: TyId, origin: Origin): OptionalValueDomain {
  const read = (id: TyId) => arithmetic(machine, 1, origin) ? machine.deps.typeOf(id) : null;
  const term = read(type);
  return term === null ? { kind: "resource-stop" } : optionalValueDomainOf(term, read);
}

export function valueFits(machine: Machine, value: ConstValue, field: "maximumIntermediateBits" | "maximumResultBits", origin: Origin): boolean {
  if (machine.result !== null) return false;
  const maximum = machine.deps.limits[field];
  let fits: boolean;
  switch (value.kind) {
    case "error": case "absence": fits = true; break;
    case "boolean": fits = maximum >= 1; break;
    case "string": fits = value.value.length <= Math.floor(maximum / 16); break;
    case "unique-symbol": fits = value.declaration.length <= Math.floor(maximum / 16); break;
    case "bigint": fits = integerBits(value.value, maximum) !== null; break;
    case "floating": {
      const selected = nativeCarrierOf(machine.deps.types, value.type, type => {
        if (!arithmetic(machine, 1, origin)) return null;
        return machine.deps.typeOf(type);
      });
      if (selected.kind === "resource-stop") return false;
      let carrier: NativePrimitive | null = null;
      if (selected.kind === "primitive") carrier = selected.primitive;
      else {
        const optional = selectedOptionalDomain(machine, selected.type, origin);
        if (optional.kind === "resource-stop") return false;
        if (optional.kind === "optional-value" && optional.payload === "float64") carrier = "float64";
      }
      if (carrier === null || !isNativeBinaryFloatPrimitive(carrier)) {
        throw new TypeError("Evaluate floating values require their actual selected native carrier");
      }
      const width = selectedFloatingWidth(machine, carrier, value.bits, origin);
      if (width === null) return false;
      fits = width <= maximum;
      break;
    }
    case "number": {
      const numerator = integerBits(value.value.numerator, maximum);
      const denominator = numerator === null ? null : integerBits(value.value.denominator, maximum - numerator);
      fits = denominator !== null;
      break;
    }
  }
  return fits || limit(machine, field, origin);
}

export function evaluationFault(machine: Machine, origin: Origin, message: string): void {
  const code = hostDiagnosticCode("TSONIC_CONSTANT_EVALUATION_FAILED");
  const unit: UnitRef = { request: machine.unit, position: { kind: "result" } };
  const identity: DiagnosticIdentity = { kind: "host", unit, code };
  const diagnostic: Diagnostic = { code: { kind: "host", name: code, rendered: code }, severity: "error", site: { kind: "source", origin },
    source: "evaluate", evidence: [], message, arguments: [], related: [], fix: null };
  const body = machine.frames[0];
  machine.result = { kind: "ok", value: { kind: "value", value: { kind: "error", type: body.body.result } }, diagnostics: [diagnostic],
    positions: [{ position: unit.position, error: { kind: "error", causes: [{ kind: "diagnostic", diagnostic: identity }] } }],
    emissions: [{ identity, diagnostic }] };
}
