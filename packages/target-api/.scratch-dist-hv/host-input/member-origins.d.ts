import { type AstReader, type Node, type Type, type TypePropertyInfo } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./semantics-types.js";
import type { SourceMemberKey, SourceTypeDescriptorMember } from "../source-semantics/descriptor-model.js";
type Origin = SourceTypeDescriptorMember["origin"];
export declare function sourceTypeDescriptorMemberKey(type: Type, queries: SourceFileSemantics): SourceMemberKey | undefined;
export type SourceMemberOriginResult = {
    readonly kind: "resolved";
    readonly origin: Origin;
} | {
    readonly kind: "refused";
    readonly owner: Node;
    readonly name: string;
};
export declare function sourceTypeDescriptorMemberOrigin(source: {
    readonly ast: AstReader;
}, queries: SourceFileSemantics, property: TypePropertyInfo, receiver: Type): SourceMemberOriginResult | undefined;
export {};
//# sourceMappingURL=member-origins.d.ts.map