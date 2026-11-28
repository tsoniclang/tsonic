import type { Node } from "../../ast/spine.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import type { Symbol } from "../../ast/symbol.js";
import { type Checker, type CheckMode } from "./state.js";
import type { IndexedTypeReadSource, Signature, Type } from "../types.js";
export declare class DeclaredIndexReadSource {
    #private;
    readonly annotation: Node;
    readonly receiver: Type;
    readonly index: Type;
    readonly result: Type;
    readonly kind: "declared-index-read";
    private constructor();
    get declaration(): Node;
    static retain(annotation: Node, receiver: Type, index: Type, declaration: Node, result: Type): DeclaredIndexReadSource;
    static owns(value: object): value is DeclaredIndexReadSource;
}
export declare function hasDeclaredIndexReadEvidence(value: unknown): value is DeclaredIndexReadSource;
export interface ResolvedSourceTypeInfo {
    readonly type: Type;
    readonly causes: readonly Diagnostic[];
    readonly typeSource?: Node;
    readonly indexedRead?: IndexedTypeReadSource;
    readonly projectedReturn?: SelectedSignatureReturnProjection;
}
export interface SelectedSignatureReturnProjection {
    readonly kind: "parameter" | "receiver";
    readonly declaration: Node;
    readonly annotation: Node;
    readonly original: Type;
    readonly selected: Type;
}
type BorrowedTypeSource = Node | readonly [Node, Node];
export interface SourceTypeAnswer extends ResolvedSourceTypeInfo {
    readonly borrowedFrom?: BorrowedTypeSource;
}
export interface SourceTypeAnswerOutput {
    value: SourceTypeAnswer | undefined;
}
export type CheckerDiagnosticMembership = (diagnostic: Diagnostic) => boolean;
export declare function sourceTypeAnswer(checker: Checker | undefined, node: Node | undefined, type: Type | undefined, admits?: CheckerDiagnosticMembership): SourceTypeAnswer | undefined;
export declare function borrowedSourceTypeAnswer(checker: Checker, anchor: Node, type: Type, admits: CheckerDiagnosticMembership | undefined): SourceTypeAnswer;
export declare function retainDirectErrorSource(checker: Checker, result: Node, cause: Diagnostic): void;
export declare function completedCallErrorAnswer(checker: Checker, node: Node | undefined, admits: CheckerDiagnosticMembership | undefined): SourceTypeAnswer | undefined;
export declare function retainErrorOperandSource(checker: Checker, result: Node | undefined, mode: CheckMode, left: Node | undefined, right?: Node): void;
export declare function completedRequiredPropertySource(checker: Checker, property: Symbol, type: Type): Node | undefined;
export declare function completedAnnotationSource(checker: Checker, annotation: Node | undefined, type: Type): Node | undefined;
export declare function originalSignatureDeclaration(checker: Checker, signature: Signature): Node | undefined;
export declare function signatureReturnAnswer(checker: Checker | undefined, signature: Signature | undefined, type: Type | undefined, admits?: CheckerDiagnosticMembership): SourceTypeAnswer | undefined;
export declare function directTypeSource(checker: Checker, node: Node | undefined, type: Type): Node | undefined;
export {};
//# sourceMappingURL=source-type-answers.d.ts.map