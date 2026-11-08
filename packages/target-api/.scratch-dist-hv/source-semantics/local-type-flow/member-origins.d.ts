import type { SourceMemberKey, SourceTypeDescriptorMember } from "../descriptor-model.js";
type Origin = SourceTypeDescriptorMember["origin"];
export declare function sourceTypeDescriptorMemberOriginsEqual(left: Origin, right: Origin): boolean;
export declare function sourceTypeDescriptorMemberKeysEqual(left: SourceMemberKey, right: SourceMemberKey): boolean;
export declare function freezeSourceTypeDescriptorMemberOrigin(origin: Origin): Origin;
export {};
//# sourceMappingURL=member-origins.d.ts.map