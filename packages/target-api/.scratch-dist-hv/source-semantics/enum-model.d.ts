import type { Node } from "@tsonic/tsts";
export type SourceEnumConstantSelection = {
    readonly kind: "resolved";
    readonly declaration: Node;
    readonly value: bigint | string;
} | {
    readonly kind: "rejected";
    readonly declaration: Node;
    readonly reason: string;
    readonly failure: "source" | "resource";
};
export type SourceEnumIntegerWidthSelection = {
    readonly kind: "resolved";
    readonly declaration: Node;
    readonly integerWidth: 32 | 64;
} | {
    readonly kind: "rejected";
    readonly declaration: Node;
    readonly member: Node;
    readonly reason: string;
    readonly failure: "source" | "resource";
    readonly admissionIssue?: SourceEnumAdmissionIssue;
};
export interface SourceEnumConstantIndex {
    readonly entries: readonly SourceEnumConstantSelection[];
    readonly issues: readonly SourceEnumAdmissionIssue[];
    get(member: Node): SourceEnumConstantSelection | undefined;
    integerWidth(declaration: Node): SourceEnumIntegerWidthSelection | undefined;
}
export interface SourceEnumAdmissionIssue {
    readonly code: "TSONIC_ENUM_MERGED_DECLARATIONS_NOT_SUPPORTED" | "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED";
    readonly category: "error";
    readonly source: "tsonic";
    readonly sourceNode: Node;
    readonly message: string;
}
//# sourceMappingURL=enum-model.d.ts.map