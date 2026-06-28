import type { int } from "../scalars.js";
import type { GoRune, GoSlice } from "../compat.js";
export declare function AppendRune(a: GoSlice<int>, r: GoRune): GoSlice<int>;
export declare function Decode(s: GoSlice<int>): GoSlice<GoRune>;
export declare function Encode(s: GoSlice<GoRune>): GoSlice<int>;
export declare function RuneLen(r: GoRune): int;
export declare function IsSurrogate(r: GoRune): boolean;
export declare function DecodeRune(r1: GoRune, r2: GoRune): GoRune;
export declare function EncodeRune(r: GoRune): [GoRune, GoRune];
//# sourceMappingURL=utf16.d.ts.map