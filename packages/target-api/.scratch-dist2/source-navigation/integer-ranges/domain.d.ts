export interface SourceIntegerRange {
    readonly minimum: number;
    readonly maximum: number;
}
export declare function integerRange(minimum: number, maximum?: number): SourceIntegerRange | undefined;
export declare function joinIntegerRanges(left: SourceIntegerRange | undefined, right: SourceIntegerRange | undefined): SourceIntegerRange | undefined;
export declare function binaryIntegerRange(operator: string, left: SourceIntegerRange, right: SourceIntegerRange): SourceIntegerRange | undefined;
//# sourceMappingURL=domain.d.ts.map