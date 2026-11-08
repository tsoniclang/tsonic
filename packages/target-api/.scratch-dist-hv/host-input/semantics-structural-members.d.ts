import type { AstReader, Node, Signature, Type, TypeCheckerQueries, TypeIndexInfo, TypePropertyInfo, TypeShapeQueries } from "@tsonic/tsts";
export interface SourceStructuralMember {
    readonly receiverType: Type;
    readonly property: TypePropertyInfo;
    readonly declarations: readonly Node[];
    readonly getters: readonly Node[];
    readonly setters: readonly Node[];
    readonly read: "property" | "accessor" | "method" | "unavailable";
}
export type SourceStructuralMemberPair = {
    readonly kind: "present";
    readonly destination: SourceStructuralMember;
    readonly source: SourceStructuralMember;
} | {
    readonly kind: "absent";
    readonly destination: SourceStructuralMember;
};
export interface SourceStructuralTypeMembers {
    readonly type: Type;
    readonly calls: readonly Signature[];
    readonly constructs: readonly Signature[];
    readonly indexes: readonly TypeIndexInfo[];
}
export type SourceStructuralMemberCorrespondence = {
    readonly kind: "available";
    readonly source: SourceStructuralTypeMembers;
    readonly destination: SourceStructuralTypeMembers;
    readonly members: readonly SourceStructuralMemberPair[];
} | {
    readonly kind: "unavailable";
    readonly reason: "unresolved-shape" | "missing-required-member" | "inconsistent-member" | "unreadable-member" | "disjoint-shape";
};
export declare function createSourceStructuralMemberQueries(ast: AstReader, checker: TypeCheckerQueries, types: TypeShapeQueries): {
    readonly structuralMembers: (source: Type, destination: Type, purpose: "correspondence" | "read") => SourceStructuralMemberCorrespondence;
    readonly structuralMember: (source: Type, destination: Type, selectedDeclaration: Node, purpose: "correspondence" | "read") => SourceStructuralMemberPair | undefined;
};
//# sourceMappingURL=semantics-structural-members.d.ts.map