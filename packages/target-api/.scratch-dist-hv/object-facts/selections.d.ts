import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceInstantiationFacts, SourceRefusal, SourceSumFacts, SourceTypeOutcome, SourceValueFacts } from "../public/source/facts.js";
import type { SourceSelectionFacts, SourceCallSignatureParameter } from "../public/source/selections.js";
import type { HostCheckerInput } from "../host-input/objects.js";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
export interface SourceSelectionInput {
    readonly ast: AstReader;
    readonly witnesses: HostCheckerInput;
    readonly values: SourceValueFacts;
    readonly instantiations: SourceInstantiationFacts;
    /** The native pointer operation records of the value model (writer A2, program-facts.ts). */
    readonly pointerOperation: SourceSelectionFacts["pointerOperation"];
    /** The one union builder and the sole substitution of the value model (I6). */
    readonly sums: Pick<SourceSumFacts, "join" | "substitute">;
    readonly navigation: Pick<SourceProgramNavigation, "isProjectDeclaration" | "mergedDeclarations" | "declaredHeritage">;
}
/** A refused value outcome as a Source refusal (code, message, site unchanged). */
export declare function sourceRefusalOfOutcome(outcome: Extract<SourceTypeOutcome, {
    readonly kind: "refused";
}>): SourceRefusal;
export declare function createSourceSelectionFacts(input: SourceSelectionInput): SourceSelectionFacts & {
    /** Every selection refusal raised so far, in first-request order (B's share of SourceProgramFacts.refusals()). */
    refusals(): readonly SourceRefusal[];
    /**
     * The Source refusal of the iteration protocol at a for-of statement or spread element (the checker witness: untyped
     * or per-arm-mixed iteration), raised into refusals(); undefined when the protocol is admitted. Asks no value fact,
     * so the eager census never queries a node outside the value domain (a SpreadElement is not a value node).
     */
    iterationProtocolRefusal(site: Node): SourceRefusal | undefined;
    /**
     * The value-parameter slots of a signature declaration (analyses.signatureParameters, FX-CC #13): the same slots, by
     * the same translation, as SourceCallSelection.signatureParameters of every call selecting it; undefined for a node
     * that is not a signature declaration.
     */
    signatureParameters(signature: Node): readonly SourceCallSignatureParameter[] | undefined;
};
//# sourceMappingURL=selections.d.ts.map