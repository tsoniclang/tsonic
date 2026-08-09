export interface TargetAstEncodingLimits {
    readonly maximumNodeRows: number;
    readonly maximumDepth: number;
    readonly maximumStringCount: number;
    readonly maximumStringBytes: number;
    readonly maximumSingleStringBytes: number;
    readonly maximumExtendedWords: number;
    readonly maximumStructuredBytes: number;
    readonly maximumEncodedBytes: number;
}
export declare const defaultTargetAstEncodingLimits: TargetAstEncodingLimits;
export declare class TargetAstResourceLimitError extends Error {
    constructor(message: string);
}
export declare class TargetAstResourceBudget {
    #private;
    constructor(limits: TargetAstEncodingLimits);
    reserveNodeRows(count: number): void;
    requireDepth(depth: number): void;
    reserveString(byteLength: number): void;
    reserveExtendedWords(count: number): void;
    reserveStructuredBytes(count: number): void;
    requireEncodedBytes(count: number): void;
}
//# sourceMappingURL=target-ast-resource-budget.d.ts.map