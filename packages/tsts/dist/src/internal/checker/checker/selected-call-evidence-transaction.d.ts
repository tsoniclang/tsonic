import type { Checker, InferenceContext } from "./state.js";
import type { Signature, SignatureLinks, Type } from "../types.js";
import type { Node } from "../../ast/spine.js";
import type { SelectedCallInferenceJournal } from "./selected-call-inference-evidence.js";
export type SelectedCallEvidenceFrameKind = "signature-resolution" | "overload-candidate" | "discard";
export interface SelectedCallEvidenceFrame {
    readonly kind: SelectedCallEvidenceFrameKind;
    readonly depth: number;
}
interface SignatureLinksSnapshot {
    readonly links: SignatureLinks;
    readonly resolvedSignature: SignatureLinks["resolvedSignature"];
    readonly checkedCallSelectionSeed: SignatureLinks["checkedCallSelectionSeed"];
    readonly resolvedCallSelectionEvidence: SignatureLinks["resolvedCallSelectionEvidence"];
    readonly resolvedCallEvidence: SignatureLinks["resolvedCallEvidence"];
}
interface SelectedCallEvidenceFrameRecord extends SelectedCallEvidenceFrame {
    settled: boolean;
    readonly snapshots: SignatureLinksSnapshot[];
    candidate: Signature | undefined;
    readonly contexts: InferenceContext[];
    readonly defaults: SelectedDefaultContribution[];
    readonly inference: SelectedCallInferenceJournal;
}
interface SelectedDefaultContribution {
    readonly context: InferenceContext | undefined;
    readonly parameter: Type;
    readonly selectedType: Type;
    readonly defaultTypeNode: Node;
}
export interface SelectedCallEvidenceTransactionState {
    failed: boolean;
    readonly frames: SelectedCallEvidenceFrameRecord[];
    entryCount: number;
    inferenceEntryCount: number;
}
export declare function beginSelectedCallEvidenceFrame(checker: Checker, kind: SelectedCallEvidenceFrameKind): SelectedCallEvidenceFrame | undefined;
export declare function commitSelectedCallEvidenceFrame(checker: Checker, frame: SelectedCallEvidenceFrame | undefined): void;
export declare function rollbackSelectedCallEvidenceFrame(checker: Checker, frame: SelectedCallEvidenceFrame | undefined): void;
export declare function journalSelectedCallEvidence(checker: Checker, links: SignatureLinks): void;
export declare function bindSelectedCallDefaultOwner(checker: Checker, frame: SelectedCallEvidenceFrame | undefined, candidate: Signature): void;
export declare function bindSelectedCallDefaultContext(checker: Checker, frame: SelectedCallEvidenceFrame | undefined, context: InferenceContext): void;
export declare function retainSelectedCallDefault(checker: Checker, context: InferenceContext | undefined, parameter: Type, selectedType: Type, defaultTypeNode: Node | undefined): void;
export declare function selectedCallDefaultNode(checker: Checker, context: InferenceContext | undefined, parameter: Type, selectedType: Type): Node | undefined;
export declare function copySelectedCallDefaults(checker: Checker, source: InferenceContext, destination: InferenceContext): void;
export declare function selectedCallInferenceJournal(checker: Checker, inferences: InferenceContext["inferences"]): SelectedCallInferenceJournal | undefined;
export {};
//# sourceMappingURL=selected-call-evidence-transaction.d.ts.map