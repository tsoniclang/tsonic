import type { SourcePointerOperationRecord } from "../../public/source/selections.js";
import { type Node, type SourceFile } from "@tsonic/tsts";
import type { SourceInstantiationFacts, SourceRefusal, SourceRelationFacts, SourceSumFacts, SourceValueFacts } from "../../public/source/facts.js";
import type { SourceHostInput } from "../../host-input/index.js";
import type { SourceObligation } from "../../public/source/analyses.js";
import type { SourceTypeFlowSource } from "./types.js";
/** Host record of a native pointer marker operation: the Legacy fact with every checker Type replaced by a descriptor. */
export type { SourcePointerOperationRecord };
export interface SourceValueModelFacts {
    readonly values: SourceValueFacts;
    readonly sums: SourceSumFacts;
    readonly relations: SourceRelationFacts;
    readonly instantiations: SourceInstantiationFacts;
    /** Native pointer operations (request to B: publish as `selections.pointerOperation` or a values member). */
    pointerOperation(call: Node): SourcePointerOperationRecord | SourceRefusal | undefined;
    /** The solver's obligations (interface, read-only, constraint, literal admission, write fit), checker-free and frozen. */
    obligations(): readonly SourceObligation[];
    refusals(): readonly SourceRefusal[];
}
/**
 * Builds the value-model facts of one program view. Called once by the SourceProgramFacts assembly (writer B).
 * `programSourceFiles` is the program file order that fixes authored-first sum order (C-2459). `input` is the program's
 * one host-input adapter (created once by the program builder and shared with the selection witnesses, R4/I3).
 */
export declare function buildSourceValueModelFacts(source: SourceTypeFlowSource, programSourceFiles: readonly SourceFile[], input: SourceHostInput): SourceValueModelFacts;
//# sourceMappingURL=program-facts.d.ts.map