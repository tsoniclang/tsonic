import type { bool, int } from "@tsonic/core/types.js";
import type { GoRune } from "./compat.js";
export declare const MaxASCII: GoRune;
export declare const MaxLatin1: GoRune;
export declare const MaxRune: GoRune;
export declare const ReplacementChar: GoRune;
export type Range16 = {
    readonly Lo: int;
    readonly Hi: int;
    readonly Stride: int;
};
export type Range32 = {
    readonly Lo: int;
    readonly Hi: int;
    readonly Stride: int;
};
export type RangeTable = {
    readonly R16: ReadonlyArray<Range16>;
    readonly R32: ReadonlyArray<Range32>;
    readonly LatinOffset: int;
};
export declare function Is(rangeTab: RangeTable, r: GoRune): bool;
export declare const Zs: RangeTable;
export declare const White_Space: RangeTable;
export declare function IsDigit(r: GoRune): bool;
export declare function IsLetter(r: GoRune): bool;
export declare function IsLower(r: GoRune): bool;
export declare function IsSpace(r: GoRune): bool;
export declare function IsUpper(r: GoRune): bool;
export declare function ToLower(r: GoRune): GoRune;
export declare function ToUpper(r: GoRune): GoRune;
//# sourceMappingURL=unicode.d.ts.map