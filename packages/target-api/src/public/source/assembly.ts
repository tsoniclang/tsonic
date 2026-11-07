// SourceProgramFacts assembly: one frozen object per program view, built once by the Host program owner (I5).
// Producers: the value model (writer A2), the role model, object facts and selections (B), the JS profile (D18).
import type { AstReader, Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import type { SourceProgramDocuments } from "../../source-semantics/types.js";
import type { SourceInstantiationFacts, SourceProgramFacts, SourceRefusal, SourceRelationFacts, SourceSumFacts,
  SourceValueFacts } from "./facts.js";
import type { SourceAnalysisFacts, SourceObligation } from "./analyses.js";
import type { SourceJsApiFacts, SourceObjectFacts } from "./objects.js";
import type { SourceRoleModel } from "./roles.js";
import type { SourceSelectionFacts } from "./selections.js";

/** What a JS API profile builder reads. Declarations and site keys only (I1). */
export interface SourceJsApiFactsInput {
  readonly ast: AstReader;
  readonly sourceFacts: ReadonlySourceFactResolver;
  /** Well-known symbol named by a computed member name (`Symbol.iterator` ...), from the selections. */
  wellKnownSymbol(node: Node): string | undefined;
}

/** Supplied by the composition root (host) from js-source-profile; target-api does not depend on the profile package. */
export type SourceJsApiFactsFactory = (input: SourceJsApiFactsInput) => SourceJsApiFacts;

export interface SourceProgramFactsParts {
  readonly documents: SourceProgramDocuments;
  readonly values: SourceValueFacts;
  readonly sums: SourceSumFacts;
  readonly relations: SourceRelationFacts;
  readonly instantiations: SourceInstantiationFacts;
  readonly selections: SourceSelectionFacts;
  readonly navigation: SourceRoleModel;
  readonly objects: SourceObjectFacts;
  readonly profile: SourceJsApiFacts;
  readonly analyses: SourceAnalysisFacts;
  /** The value model obligation list (writer A: SourceValueModelFacts.obligations). */
  readonly obligations: () => readonly SourceObligation[];
  /** Every producer's refusal collection, in producer order: value model, selections, objects. */
  readonly refusalSources: readonly (() => readonly SourceRefusal[])[];
}

export function assembleSourceProgramFacts(parts: SourceProgramFactsParts): SourceProgramFacts {
  const { refusalSources } = parts;
  return Object.freeze({
    documents: parts.documents,
    values: parts.values,
    sums: parts.sums,
    relations: parts.relations,
    instantiations: parts.instantiations,
    selections: parts.selections,
    navigation: parts.navigation,
    objects: parts.objects,
    profile: parts.profile,
    analyses: parts.analyses,
    obligations: parts.obligations,
    refusals(): readonly SourceRefusal[] {
      const seen = new Set<SourceRefusal>();
      const all: SourceRefusal[] = [];
      for (const source of refusalSources) {
        for (const refusal of source()) {
          if (seen.has(refusal) || all.some(entry => entry.code === refusal.code && entry.site === refusal.site)) continue;
          seen.add(refusal);
          all.push(refusal);
        }
      }
      return Object.freeze(all);
    },
  });
}
