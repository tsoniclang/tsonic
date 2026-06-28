import type { uint } from "../../../go/scalars.js";
import type { GoRune } from "../../../go/compat.js";
import type { RangeTable } from "../../../go/unicode.js";
export type specialCasingCondition = uint;
export declare const specialCasingConditionNone: specialCasingCondition;
export declare const specialCasingConditionFinalSigma: specialCasingCondition;
export interface specialCasingMapping {
    lower: string;
    upper: string;
    condition: specialCasingCondition;
}
export declare const specialCasingMappings: ReadonlyMap<GoRune, specialCasingMapping>;
export declare const unicodeCasedRanges: RangeTable;
export declare const unicodeCaseIgnorableRanges: RangeTable;
//# sourceMappingURL=js_case_generated.d.ts.map