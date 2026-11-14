import type { InvariantFailure } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { NodeRef, Origin } from "../ids/contract.js";
import type { TypeTerm } from "../ir-types/contract.js";

const failure = (message: string, origin: Origin | null): InvariantFailure => ({ owner: "rules", query: null, origin, message });

export const notDecidedYet = (what: string, origin: Origin | null): never => throwInvariant(failure(`not decided yet: ${what}`, origin));

export const callerDefect = (what: string, origin: Origin | null): never => throwInvariant(failure(`caller defect: ${what}`, origin));

export function at(occurrence: NodeRef): string {
  return `node ${occurrence.node} of ${occurrence.body}`;
}

export function termName(term: TypeTerm): string {
  return term.kind === "primitive" ? term.primitive : term.kind;
}
