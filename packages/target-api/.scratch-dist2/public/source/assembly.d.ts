import type { AstReader, Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import type { SourceProgramDocuments } from "../../source-semantics/documents-model.js";
import type { SourceInstantiationFacts, SourceProgramFacts, SourceRefusal, SourceRelationFacts, SourceSumFacts, SourceTypeofCategoryName, SourceValueFacts } from "./facts.js";
import type { SourceTypeDescriptor } from "../../source-semantics/descriptor-model.js";
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
    /** The present arms of a descriptor in authored order (the one classifier, source-semantics/descriptor-arms.ts). */
    presentArms(type: SourceTypeDescriptor): readonly SourceTypeDescriptor[];
    /** The type-level typeof category of a descriptor (N3', source-semantics/descriptor-categories.ts); undefined: none proven. */
    typeofCategory(type: SourceTypeDescriptor): Exclude<SourceTypeofCategoryName, "undefined"> | undefined;
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
export declare function assembleSourceProgramFacts(parts: SourceProgramFactsParts): SourceProgramFacts;
//# sourceMappingURL=assembly.d.ts.map