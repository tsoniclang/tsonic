import type { Node } from "@tsonic/tsts";
import type { SourceNavigationCall } from "../../../source-model/navigation-records.js";
import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import type { SourceCompletionSelection } from "../../../public/source/selections.js";
/** A generator callable: the published Host generator selection (facts.selections.generator), the one generator predicate (R4). */
export declare function sourceStorageIsGenerator(source: Pick<SourceAnalysisProgram, "facts">, callable: Node): boolean;
/** The member access a call selects its callee through (`r.m()`, `r[k]()`, parentheses skipped); undefined otherwise. */
export declare function sourceStorageCalleeAccess(source: Pick<SourceAnalysisProgram, "ast" | "navigation">, invocation: Node): Node | undefined;
/** The receiver expression of a member call (`o.m()` → `o`), from the callee's member witness. */
export declare function sourceStorageCallReceiver(source: Pick<SourceAnalysisProgram, "ast" | "navigation">, selected: SourceNavigationCall): Node | undefined;
/** The receiver expression of a member call at an invocation node (sourceStorageCallReceiver over its call witness). */
export declare function sourceStorageInvocationReceiver(source: Pick<SourceAnalysisProgram, "ast" | "navigation">, invocation: Node): Node | undefined;
interface PointerBase {
    readonly call: Node;
    /** Host descriptor of the selected pointee (the marker's pointee type argument). */
    readonly pointee: SourceTypeDescriptor;
    readonly result: SourceTypeDescriptor;
    readonly location?: Node;
}
/** A native pointer operation with its operands named by role (from facts.selections.pointerOperation, I1/I3). */
export type SourceStoragePointerOperation = PointerBase & ({
    readonly operation: "address-of";
    readonly storageExpression: Node;
    readonly storageDeclaration?: Node;
} | {
    readonly operation: "allocate";
    readonly initialExpression: Node;
} | {
    readonly operation: "load" | "hash-pointer";
    readonly pointerExpression: Node;
} | {
    readonly operation: "store";
    readonly pointerExpression: Node;
    readonly valueExpression: Node;
} | {
    readonly operation: "equal-pointer";
    readonly leftExpression: Node;
    readonly rightExpression: Node;
} | {
    readonly operation: "bind-pointer";
    readonly identityExpression: Node;
    readonly readExpression: Node;
    readonly writeExpression: Node;
} | {
    readonly operation: "project-pointer";
    readonly pointerExpression: Node;
    readonly fromSourceExpression: Node;
    readonly toSourceExpression: Node;
});
/**
 * The pointer operation of a marker call, operands by role (the record's operand order is the marker parameter order).
 * undefined: the node is no pointer marker call, or the Host refused it (the refusal is in facts.refusals()).
 */
export declare function sourceStoragePointerOperation(source: Pick<SourceAnalysisProgram, "facts">, call: Node | undefined): SourceStoragePointerOperation | undefined;
/** The source pointee of a `project-pointer` call: the first selected method type argument. */
export declare function sourceStorageProjectedSourcePointee(source: Pick<SourceAnalysisProgram, "facts">, call: Node): SourceTypeDescriptor | undefined;
/** Whether a callable body can complete normally (fall off its end): the Host completion selection (R-B4-9). */
export declare function sourceStorageCompletionFallsThrough(completion: SourceCompletionSelection): boolean;
/**
 * The indexed element slots of every present arm of a storage type, as their read-only flags: the element index of an
 * array or tuple arm (checker number index) and the index signatures of a shape arm (facts.objects.indexes).
 */
export declare function sourceStorageIndexes(source: Pick<SourceAnalysisProgram, "ast" | "facts">, type: SourceTypeDescriptor): readonly {
    readonly readonly: boolean;
}[];
/** The call and construct signature declarations of every present arm of a storage type (descriptor signatures). */
export declare function sourceStorageSignatureDeclarations(type: SourceTypeDescriptor): readonly Node[];
/** Whether a storage type has a call or construct signature in some present arm. */
export declare function sourceStorageHasSignatures(type: SourceTypeDescriptor): boolean;
export {};
//# sourceMappingURL=host-reads.d.ts.map