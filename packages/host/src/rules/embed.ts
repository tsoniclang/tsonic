import type { NodeRef, Origin, TyId } from "../ids/contract.js";
import type { EmbeddingDecision, FlowRole } from "../ir-infer/contract.js";
import { readType } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { at, notDecidedYet, termName } from "./frontier.js";

export function decideEmbedding(deps: RulesDeps, from: TyId, to: TyId, role: FlowRole | "bound", occurrence: NodeRef, origin: Origin | null)
  : EmbeddingDecision {
  const source = readType(deps.types, from);
  if (from !== to || source.kind === "error")
    return notDecidedYet(`the embedding of ${termName(source)} into ${termName(readType(deps.types, to))} (${role}) at ${at(occurrence)}`, origin);
  return { kind: "identity" };
}
