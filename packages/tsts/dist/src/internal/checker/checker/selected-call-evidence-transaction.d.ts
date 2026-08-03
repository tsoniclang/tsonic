import type { Checker } from "./state.js";
import type { SignatureLinks } from "../types.js";
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
}
export interface SelectedCallEvidenceTransactionState {
    failed: boolean;
    readonly frames: SelectedCallEvidenceFrameRecord[];
    snapshotCount: number;
}
export declare function beginSelectedCallEvidenceFrame(checker: Checker, kind: SelectedCallEvidenceFrameKind): SelectedCallEvidenceFrame | undefined;
export declare function commitSelectedCallEvidenceFrame(checker: Checker, frame: SelectedCallEvidenceFrame | undefined): void;
export declare function rollbackSelectedCallEvidenceFrame(checker: Checker, frame: SelectedCallEvidenceFrame | undefined): void;
export declare function journalSelectedCallEvidence(checker: Checker, links: SignatureLinks): void;
export {};
//# sourceMappingURL=selected-call-evidence-transaction.d.ts.map