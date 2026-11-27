import type { NodeRef, Origin, TyId } from "../ids/contract.js";
import type { EmbeddingDecision, FlowRole } from "../ir-infer/contract.js";
import type { ExactRational, TypeComponent, TypeEvidence } from "../ir-types/contract.js";
import { exactFloat64LiteralFit, optionalValueDomainOf, readType } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { at, notDecidedYet, termName } from "./frontier.js";

export function fitsFloat64(deps: RulesDeps, value: ExactRational): boolean {
  const format = deps.selectedNativeFacts.floatingFormats.find(candidate => candidate.carrier === "float64");
  return format !== undefined && exactFloat64LiteralFit(value, format);
}

export function embeddingForm(deps: RulesDeps, from: TyId, to: TyId):
  "identity" | "literal-fit" | "absence" | "union-injection" | "incompatible-domain" | null {
  const source = readType(deps.types, from);
  if (from === to) return source.kind === "error" ? null : "identity";
  if (source.kind === "literal" && source.base === to) {
    const target = readType(deps.types, to);
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
  if (!absent && boolean === null && number === null && text === null) return null;
  const target = readType(deps.types, to);
  if (absent && target.kind === "primitive" && target.primitive === "bool") return "incompatible-domain";
  if (target.kind !== "optional") return null;
  const domain = optionalValueDomainOf(target, value => readType(deps.types, value));
  if (domain.kind !== "optional-value") return null;
  if (absent) return "absence";
  if (domain.payload === "float64" && numericLiteral !== null && number === domain.present && !fitsFloat64(deps, numericLiteral)) return null;
  return (domain.payload === "boolean" ? boolean : domain.payload === "float64" ? number : text) === domain.present
    ? "union-injection" : null;
}

export function decideEmbedding(deps: RulesDeps, from: TypeEvidence, to: TypeEvidence, role: FlowRole | "bound", occurrence: NodeRef, origin: Origin | null)
  : EmbeddingDecision {
  return decideComponentEmbedding(deps, { type: from.type, at: { root: from.component, path: [] } },
    { type: to.type, at: { root: to.component, path: [] } }, role, occurrence, origin);
}

interface EmbeddingEndpoint {
  readonly type: TyId;
  readonly at: TypeComponent;
}

export function decideComponentEmbedding(deps: RulesDeps, from: EmbeddingEndpoint, to: EmbeddingEndpoint,
  role: FlowRole | "bound", occurrence: NodeRef, origin: Origin | null): EmbeddingDecision {
  const form = embeddingForm(deps, from.type, to.type);
  if (form === "identity") return { kind: "identity" };
  if (form === "incompatible-domain") return { kind: "refused", reason: form };
  if (form !== null) {
    return { kind: "conversion", conversion: form, check: { kind: "none" },
      proof: { steps: [{ from: from.at, to: to.at, rule: form, premises: [] }], conclusion: 0 } };
  }
  const source = readType(deps.types, from.type);
  const target = readType(deps.types, to.type);
  return notDecidedYet(`the embedding of ${termName(source)} into ${termName(target)} (${role}) at ${at(occurrence)}`, origin);
}
