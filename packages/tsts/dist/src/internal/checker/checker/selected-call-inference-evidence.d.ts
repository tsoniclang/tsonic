import type { InferenceContext, InferenceInfo } from "./state.js";
import type { Type, ResolvedCallInferenceContribution, ResolvedCallInferenceEvidence, ResolvedCallInferenceOrigin, ResolvedCallInferencePathPart } from "../types.js";
interface SelectedInferenceTrace {
    readonly context: InferenceContext;
    readonly origin: ResolvedCallInferenceOrigin;
    sourceType: Type;
    formalType: Type;
    sourcePath: readonly ResolvedCallInferencePathPart[];
    formalPath: readonly ResolvedCallInferencePathPart[];
    complete: boolean;
    typeArguments: SelectedInferenceTypeArgumentOwners | undefined;
}
interface SelectedInferenceTypeArgumentOwners {
    readonly source: Type;
    readonly formal: Type;
    readonly sourceArray: boolean;
    readonly formalArray: boolean;
}
interface SelectedInferenceCandidate {
    readonly context: InferenceContext;
    readonly parameter: Type;
    readonly candidate: Type;
    readonly priority: number;
    readonly contravariant: boolean;
    readonly contribution: ResolvedCallInferenceContribution | undefined;
}
export interface SelectedCallInferenceJournal {
    readonly contexts: readonly InferenceContext[];
    readonly records: SelectedInferenceCandidate[];
    readonly traces: SelectedInferenceTrace[];
    readonly complete: boolean;
    readonly reserve: () => boolean;
    readonly release: () => void;
}
export declare function createSelectedCallInferenceJournal(contexts: readonly InferenceContext[], reserve: () => boolean, release: () => void): SelectedCallInferenceJournal;
export declare function withSelectedCallInferenceOrigin<Output>(journal: SelectedCallInferenceJournal | undefined, context: InferenceContext, origin: ResolvedCallInferenceOrigin, sourceType: Type, formalType: Type, operation: () => Output): Output;
export declare function withSelectedCallInferenceProjection<Output>(journal: SelectedCallInferenceJournal | undefined, inferences: InferenceContext["inferences"], sourceType: Type, formalType: Type, sourcePart: ResolvedCallInferencePathPart | null | undefined, formalPart: ResolvedCallInferencePathPart | null | undefined, operation: () => Output): Output;
export declare function withSelectedCallInferenceFrame<Output>(journal: SelectedCallInferenceJournal | undefined, inferences: InferenceContext["inferences"], operation: () => Output): Output;
export declare function selectCallInferenceProjection(journal: SelectedCallInferenceJournal | undefined, inferences: InferenceContext["inferences"], sourceType: Type, formalType: Type, sourcePart: ResolvedCallInferencePathPart | null | undefined, formalPart: ResolvedCallInferencePathPart | null | undefined): void;
export declare function selectedCallInferencePosition(journal: SelectedCallInferenceJournal | undefined, inferences: InferenceContext["inferences"]): {
    readonly sourceType: Type;
    readonly formalType: Type;
} | undefined;
export declare function withSelectedCallInferenceTypeArguments<Output>(journal: SelectedCallInferenceJournal | undefined, inferences: InferenceContext["inferences"], owners: SelectedInferenceTypeArgumentOwners, operation: () => Output): Output;
export declare function selectedCallInferenceTypeArguments(journal: SelectedCallInferenceJournal | undefined, inferences: InferenceContext["inferences"]): SelectedInferenceTypeArgumentOwners | undefined;
export declare function retainSelectedCallInferenceCandidate(journal: SelectedCallInferenceJournal | undefined, inferences: InferenceContext["inferences"], inference: InferenceInfo, sourceType: Type, formalType: Type, candidate: Type, priority: number, contravariant: boolean): void;
export declare function copySelectedCallInferenceContext(journal: SelectedCallInferenceJournal, source: InferenceContext, destination: InferenceContext): void;
export declare function selectedCallInferenceEvidence(journal: SelectedCallInferenceJournal | undefined, context: InferenceContext | undefined): ResolvedCallInferenceEvidence;
export {};
//# sourceMappingURL=selected-call-inference-evidence.d.ts.map