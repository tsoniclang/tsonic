import type { SourceFile } from "../internal/ast/ast.js";
import type { Node } from "../internal/ast/spine.js";
import type { Kind } from "../internal/ast/generated/kinds.js";
import type { CheckedFlowSourceUse } from "./observations.js";
import type { Symbol } from "../internal/ast/symbol.js";
import type { Checker } from "../internal/checker/checker/state.js";
import type { ExtensionCheckedIterationSelection } from "./checker-iteration-selection.js";
import type { ResolvedCallEvidence, SignatureLinks, Type, TypeNodeLinks } from "../internal/checker/types.js";
export type ExtensionSourceDecisionEvent = {
    readonly kind: "checked-call";
    readonly origin: Node;
    readonly resolvedCallEvidence: ResolvedCallEvidence;
} | {
    readonly kind: "checked-property";
    readonly origin: Node;
    readonly selectedSymbol: Symbol | undefined;
    readonly selectedDeclaration: Node | undefined;
    readonly resultType: Type;
    readonly receiverType: Type;
    readonly selectionMode: "read" | "write";
    readonly accessMode: "read" | "write" | "read-write" | "delete";
    readonly callCallee: boolean;
} | {
    readonly kind: "checked-element";
    readonly origin: Node;
    readonly selectedSymbol: Symbol | undefined;
    readonly selectedDeclaration: Node | undefined;
    readonly resultType: Type;
    readonly selectedElementIndex: number | undefined;
    readonly receiverType: Type;
    readonly argumentType: Type;
    readonly accessMode: "read" | "write" | "read-write" | "delete";
    readonly callCallee: boolean;
} | {
    readonly kind: "checked-operator";
    readonly origin: Node;
    readonly operator: Kind;
    readonly left: Node;
    readonly right: Node | undefined;
    readonly sourceLeftType: Type;
    readonly sourceRightType: Type | undefined;
    readonly sourceResultType: Type;
} | {
    readonly kind: "checked-iteration";
    readonly origin: Node;
    readonly selection: ExtensionCheckedIterationSelection;
} | {
    readonly kind: "assertion-conversion";
    readonly origin: Node;
    readonly sourceExpression: Node;
    readonly explicitTargetTypeNode: Node;
    readonly sourceType: Type;
    readonly targetType: Type;
    readonly assertionKind: "as" | "angle-bracket" | "jsdoc";
    readonly sourceSelectedSymbol?: Symbol;
    readonly sourceSelectedDeclaration?: Node;
    readonly sourceSelectedDeclarationTypeNode?: Node;
} | {
    readonly kind: "target-constraint";
    readonly origin: Node;
    readonly symbol: Symbol;
} | {
    readonly kind: "runtime-carrier";
    readonly origin: Node;
    readonly type: Type;
    readonly symbol: Symbol | undefined;
} | {
    readonly kind: "contextual-target";
    readonly origin: Node;
    readonly contextualType: Type;
} | {
    readonly kind: "post-assignability";
    readonly origin: Node;
    readonly source: Type;
    readonly target: Type;
    readonly errorNode: Node | undefined;
    readonly expression: Node | undefined;
    readonly relation: "assignment" | "constraint" | "return" | "argument" | undefined;
} | {
    readonly kind: "flow-use";
    readonly origin: Node;
    readonly symbol: Symbol;
    readonly sourceUse: CheckedFlowSourceUse;
};
export type ExtensionSourceDecisionPhase = "idle" | "source" | "publishing" | "failed";
export type ExtensionSourceDecisionFrameKind = "source-file" | "signature-resolution" | "overload-candidate" | "discard";
export type ExtensionSourceDecisionEventBatch = readonly ExtensionSourceDecisionEvent[];
export interface ExtensionSourceDecisionFrame {
    readonly kind: ExtensionSourceDecisionFrameKind;
    readonly eventMark: number;
    readonly depth: number;
    readonly ownerSourceFile: SourceFile;
}
export interface PreparedExtensionSourceDecision {
    readonly batch: ExtensionSourceDecisionEventBatch;
    readonly frame: ExtensionSourceDecisionFrame;
    active: boolean;
}
interface SignatureLinksSnapshot {
    readonly links: SignatureLinks;
    readonly checkedCallSelectionSeed: SignatureLinks["checkedCallSelectionSeed"];
    readonly resolvedCallSelectionEvidence: SignatureLinks["resolvedCallSelectionEvidence"];
    readonly resolvedCallEvidence: SignatureLinks["resolvedCallEvidence"];
    readonly extensionSourceDecisionOwner: SignatureLinks["extensionSourceDecisionOwner"];
}
interface TypeNodeLinksSnapshot {
    readonly links: TypeNodeLinks;
    readonly extensionSourceDecisionOwner: TypeNodeLinks["extensionSourceDecisionOwner"];
}
interface ExtensionSourceDecisionFrameRecord extends ExtensionSourceDecisionFrame {
    settled: boolean;
    readonly eventInsertions: ExtensionSourceDecisionEvent[];
    readonly signatureLinksSnapshots: SignatureLinksSnapshot[];
    readonly typeNodeLinksSnapshots: TypeNodeLinksSnapshot[];
}
export interface ExtensionSourceDecisionState {
    phase: ExtensionSourceDecisionPhase;
    readonly events: ExtensionSourceDecisionEvent[];
    readonly frames: ExtensionSourceDecisionFrameRecord[];
    readonly eventsByOrigin: Map<Node, Map<ExtensionSourceDecisionEvent["kind"], ExtensionSourceDecisionEvent[]>>;
    signatureLinksSnapshotCount: number;
    typeNodeLinksSnapshotCount: number;
}
export declare function beginSourceDecisionFrame(checker: Checker, kind: ExtensionSourceDecisionFrameKind, ownerSourceFile?: SourceFile): ExtensionSourceDecisionFrame | undefined;
export declare function commitSourceDecisionFrame(checker: Checker, frame: ExtensionSourceDecisionFrame | undefined): void;
export declare function prepareSourceDecisionFrame(checker: Checker, frame: ExtensionSourceDecisionFrame | undefined): PreparedExtensionSourceDecision | undefined;
export declare function commitPreparedSourceDecision(checker: Checker, prepared: PreparedExtensionSourceDecision | undefined): void;
export declare function rollbackPreparedSourceDecision(checker: Checker, prepared: PreparedExtensionSourceDecision | undefined): void;
export declare function rollbackSourceDecisionFrame(checker: Checker, frame: ExtensionSourceDecisionFrame | undefined): void;
export declare function rollbackDiscardSourceDecisionFrame(checker: Checker, frame: ExtensionSourceDecisionFrame | undefined): void;
export declare function journalSignatureLinks(checker: Checker, links: SignatureLinks): void;
export declare function journalTypeNodeLinks(checker: Checker, links: TypeNodeLinks): void;
export declare function appendEvent(checker: Checker, event: ExtensionSourceDecisionEvent): void;
export declare function sourceDecisionRecordingActive(checker: Checker): boolean;
export declare function sourceDecisionOwner(checker: Checker): SourceFile | undefined;
export declare function sourceDecisionDiscardActive(checker: Checker): boolean;
export declare function disableSourceDecisionRecording(checker: Checker): void;
export {};
//# sourceMappingURL=checker-source-decisions.d.ts.map