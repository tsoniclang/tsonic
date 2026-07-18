import type { TargetParameter, TargetTypeRef } from "./facts.js";
export declare function substituteTargetParameter(parameter: TargetParameter, substitutions: ReadonlyMap<string, TargetTypeRef>): TargetParameter;
export declare function substituteTargetTypeRef(root: TargetTypeRef, substitutions: ReadonlyMap<string, TargetTypeRef>): TargetTypeRef;
//# sourceMappingURL=target-type-ref-substitution.d.ts.map