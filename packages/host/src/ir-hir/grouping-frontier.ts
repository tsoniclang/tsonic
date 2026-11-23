import type { TyId } from "../ids/contract.js";
import type { CapturedFact, CheckedGroupingFrontierOf } from "./contract.js";

function hasOriginalCheckerError(fact: CapturedFact<TyId>): boolean {
  return fact.kind === "unavailable" && fact.reason === "checker-error" && fact.causes.length !== 0;
}

export const checkedGroupingFrontierOf: CheckedGroupingFrontierOf = node => {
  if (node.kind === "Identifier") {
    const name = node.tsonic;
    return name.role === "value" && name.resolution.kind === "unavailable" && hasOriginalCheckerError(name.value.views.read);
  }
  const phase = node.tsonic;
  return phase !== null && "referencedDefinitions" in phase && hasOriginalCheckerError(phase.type);
};
