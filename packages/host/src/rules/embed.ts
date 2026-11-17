import type { NodeRef, Origin } from "../ids/contract.js";
import type { EmbeddingDecision, FlowRole } from "../ir-infer/contract.js";
import type { TypeEvidence } from "../ir-types/contract.js";
import { readType } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { at, notDecidedYet, termName } from "./frontier.js";

export function decideEmbedding(deps: RulesDeps, from: TypeEvidence, to: TypeEvidence, role: FlowRole | "bound", occurrence: NodeRef, origin: Origin | null)
  : EmbeddingDecision {
  const source = readType(deps.types, from.type);
  if (from.type === to.type && source.kind !== "error") return { kind: "identity" };
  const target = readType(deps.types, to.type);
  if (source.kind === "literal" && source.base === to.type &&
    (source.value.kind === "boolean" && target.kind === "primitive" && target.primitive === "bool"
      || source.value.kind === "string" && target.kind === "string")) {
    return { kind: "conversion", conversion: "literal-fit", check: { kind: "none" },
      proof: { steps: [{ from: { root: from.component, path: [] }, to: { root: to.component, path: [] },
        rule: "literal-fit", premises: [] }], conclusion: 0 } };
  }
  return notDecidedYet(`the embedding of ${termName(source)} into ${termName(target)} (${role}) at ${at(occurrence)}`, origin);
}
