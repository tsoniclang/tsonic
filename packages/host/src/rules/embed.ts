import type { NodeRef, Origin, TyId } from "../ids/contract.js";
import type { Result } from "../diag/contract.js";
import type { EmbeddingDecision, FlowRole, RuleWork } from "../ir-infer/contract.js";
import type { ExactRational, LiteralTypeValue, TypeComponent, TypeEvidence, TypePublicationStop } from "../ir-types/contract.js";
import { admitTypePublicationStep, exactFloat64LiteralFit, isNativeIntegerPrimitive, literalCompatibilityOf, optionalValueDomainOf,
  readType, refuseTypeConstruction, viewTypes } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { at, callerDefect, notDecidedYet, termName } from "./frontier.js";

export function fitsFloat64(deps: RulesDeps, value: ExactRational): boolean {
  const format = deps.selectedNativeFacts.floatingFormats.find(candidate => candidate.carrier === "float64");
  return format !== undefined && exactFloat64LiteralFit(value, format);
}

export function integerLiteralFit(deps: RulesDeps, literal: LiteralTypeValue, to: TyId, work: RuleWork):
  "literal-fit" | "lossy-numeric" | TypePublicationStop | null {
  let stop: TypePublicationStop | null = null;
  const fit = literalCompatibilityOf(viewTypes(deps.types), to, literal, deps.selectedNativeFacts, {
    numericRepresentation: "literal-operand", typeOf: type => readType(deps.types, type),
    admit: (steps, retained) => {
      stop ??= admitTypePublicationStep(work.typeWork, steps, retained);
      return stop === null;
    },
  });
  if (stop !== null) return stop;
  switch (fit.kind) {
    case "compatible": return "literal-fit";
    case "incompatible": return "lossy-numeric";
    case "needs-selected-evidence": return null;
    default: return callerDefect("literal fit requires its actual native destination and owning admission", null);
  }
}

export function embeddingForm(deps: RulesDeps, from: TyId, to: TyId, work: RuleWork):
  "identity" | "literal-fit" | "absence" | "union-injection" | "incompatible-domain" | "lossy-numeric" | TypePublicationStop | null {
  const stopped = admitTypePublicationStep(work.typeWork, 0);
  if (stopped !== null) return stopped;
  const source = readType(deps.types, from);
  if (from === to) return source.kind === "error" ? null : "identity";
  const target = readType(deps.types, to);
  if (source.kind === "literal" && (source.value.kind === "number" || source.value.kind === "bigint")
    && target.kind === "primitive" && isNativeIntegerPrimitive(target.primitive))
    return integerLiteralFit(deps, source.value, to, work);
  if (source.kind === "literal" && source.base === to) {
    return (source.value.kind === "boolean" && target.kind === "primitive" && target.primitive === "bool"
      || source.value.kind === "string" && target.kind === "string"
      || source.value.kind === "number" && target.kind === "primitive" && target.primitive === "float64"
        && fitsFloat64(deps, source.value.value)) ? "literal-fit" : null;
  }
  const absent = source.kind === "intrinsic" && source.intrinsic === "absence";
  const boolean = source.kind === "primitive" && source.primitive === "bool" ? from
    : source.kind === "literal" && source.value.kind === "boolean" ? source.base : null;
  const numericLiteral = source.kind === "literal" && source.value.kind === "number" ? source.value.value : null;
  const number = source.kind === "primitive" && source.primitive === "float64" ? from
    : source.kind === "literal" && numericLiteral !== null ? source.base : null;
  const text = source.kind === "string" ? from
    : source.kind === "literal" && source.value.kind === "string" ? source.base : null;
  const integer = source.kind === "primitive" && isNativeIntegerPrimitive(source.primitive) ? from : null;
  if (!absent && boolean === null && number === null && text === null && integer === null) return null;
  if (absent && target.kind === "primitive" && target.primitive === "bool") return "incompatible-domain";
  if (target.kind !== "optional") return null;
  const domain = optionalValueDomainOf(target, value => readType(deps.types, value));
  if (domain.kind !== "optional-value") return null;
  if (absent) return "absence";
  if (isNativeIntegerPrimitive(domain.payload)) return integer === domain.present ? "union-injection" : null;
  if (domain.payload === "float64" && numericLiteral !== null && number === domain.present && !fitsFloat64(deps, numericLiteral)) return null;
  return (domain.payload === "boolean" ? boolean : domain.payload === "float64" ? number : text) === domain.present
    ? "union-injection" : null;
}

export function decideEmbedding(deps: RulesDeps, from: TypeEvidence, to: TypeEvidence, role: FlowRole | "bound", occurrence: NodeRef, origin: Origin, work: RuleWork)
  : Result<EmbeddingDecision> {
  return decideComponentEmbedding(deps, { type: from.type, at: { root: from.component, path: [] } },
    { type: to.type, at: { root: to.component, path: [] } }, role, occurrence, origin, work);
}

interface EmbeddingEndpoint {
  readonly type: TyId;
  readonly at: TypeComponent;
}

export function decideComponentEmbedding(deps: RulesDeps, from: EmbeddingEndpoint, to: EmbeddingEndpoint,
  role: FlowRole | "bound", occurrence: NodeRef, origin: Origin, work: RuleWork): Result<EmbeddingDecision> {
  const form = embeddingForm(deps, from.type, to.type, work);
  const ok = (value: EmbeddingDecision): Result<EmbeddingDecision> => ({ kind: "ok", value, diagnostics: [] });
  if (form === "identity") return ok({ kind: "identity" });
  if (form === "incompatible-domain" || form === "lossy-numeric") return ok({ kind: "refused", reason: form });
  if (form !== null) {
    if (typeof form !== "string") return refuseTypeConstruction(work.typeWork, form, origin, work.unit);
    return ok({ kind: "conversion", conversion: form, check: { kind: "none" },
      proof: { steps: [{ from: from.at, to: to.at, rule: form, premises: [] }], conclusion: 0 } });
  }
  const source = readType(deps.types, from.type);
  const target = readType(deps.types, to.type);
  return notDecidedYet(`the embedding of ${termName(source)} into ${termName(target)} (${role}) at ${at(occurrence)}`, origin);
}
