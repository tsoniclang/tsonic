import type { bool, ulong } from "@tsonic/core/types.js";
import type { GoSlice } from "../compat.js";
export type ValueKind = number;
export declare const KindBad: ValueKind;
export declare const KindUint64: ValueKind;
export declare const KindFloat64: ValueKind;
export declare const KindFloat64Histogram: ValueKind;
export interface Description {
    Name: string;
    Description: string;
    Kind: ValueKind;
    Cumulative: bool;
}
export interface Float64Histogram {
    Counts: GoSlice<ulong>;
    Buckets: GoSlice<number>;
}
export declare class Value {
    private readonly kind;
    private readonly payload;
    private constructor();
    static Uint64(value: ulong): Value;
    static Float64(value: number): Value;
    static Histogram(value: Float64Histogram): Value;
    Kind(): ValueKind;
    Uint64(): ulong;
    Float64(): number;
    Float64Histogram(): Float64Histogram | undefined;
}
export interface Sample {
    Name: string;
    Value: Value;
}
export declare function All(): GoSlice<Description>;
export declare function Read(samples: GoSlice<Sample>): void;
//# sourceMappingURL=metrics.d.ts.map