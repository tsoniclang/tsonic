import type { int } from "@tsonic/core/types.js";
export declare class Int {
    private value;
    constructor(value?: bigint | number | string);
    Set(x: Int): Int;
    SetInt64(x: bigint | number): Int;
    Int64(): bigint;
    Sign(): int;
    Cmp(y: Int): int;
    Add(x: Int, y: Int): Int;
    Sub(x: Int, y: Int): Int;
    Mul(x: Int, y: Int): Int;
    Quo(x: Int, y: Int): Int;
    Rem(x: Int, y: Int): Int;
    String(): string;
}
export declare class Float {
    readonly value: number;
    constructor(value?: number);
    String(): string;
}
export declare function NewInt(value: bigint | number): Int;
//# sourceMappingURL=big.d.ts.map