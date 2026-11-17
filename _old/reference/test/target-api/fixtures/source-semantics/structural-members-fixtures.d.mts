import { type Node, type Type } from "@tsonic/tsts";
declare function inspect(text: string, files?: Record<string, string>): {
    results: ({
        readonly kind: "available";
        readonly source: import("../../../../packages/target-api/src/source-semantics/structural-members.js").SourceStructuralTypeMembers;
        readonly destination: import("../../../../packages/target-api/src/source-semantics/structural-members.js").SourceStructuralTypeMembers;
        readonly members: readonly import("../../../../packages/target-api/src/source-semantics/structural-members.js").SourceStructuralMemberPair[];
    } | {
        readonly kind: "unavailable";
        readonly reason: "unresolved-shape" | "missing-required-member" | "inconsistent-member" | "unreadable-member" | "disjoint-shape";
    })[];
    source: import("../../../../packages/target-api/src/source-model/program.js").TargetSourceProgram;
    semantics: import("../../../../packages/target-api/src/source-semantics/types.js").SourceFileSemantics;
    argumentTypes: Type[];
    checked: import("@tsonic/tsts").CheckedSourceProgram;
    file: import("@tsonic/tsts").SourceFile;
};
declare function check(text: string, files?: Record<string, string>): ({
    readonly kind: "available";
    readonly source: import("../../../../packages/target-api/src/source-semantics/structural-members.js").SourceStructuralTypeMembers;
    readonly destination: import("../../../../packages/target-api/src/source-semantics/structural-members.js").SourceStructuralTypeMembers;
    readonly members: readonly import("../../../../packages/target-api/src/source-semantics/structural-members.js").SourceStructuralMemberPair[];
} | {
    readonly kind: "unavailable";
    readonly reason: "unresolved-shape" | "missing-required-member" | "inconsistent-member" | "unreadable-member" | "disjoint-shape";
})[];
declare function memberDeclaration(current: ReturnType<typeof inspect>, type: Type, name: string): Node;
export { inspect, check, memberDeclaration };
