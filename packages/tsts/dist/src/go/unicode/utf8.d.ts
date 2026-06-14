import type { int } from "@tsonic/core/types.js";
import type { GoRune } from "../compat.js";
export declare const RuneError: GoRune;
export declare const RuneSelf: int;
export declare const MaxRune: GoRune;
export declare const UTFMax: int;
export declare function DecodeRuneInBytesAt(bytes: Uint8Array, i: int): [GoRune, int];
export declare function DecodeLastRuneInBytesBefore(bytes: Uint8Array, end: int): [GoRune, int];
export declare function DecodeRuneInString(s: string): [GoRune, int];
export declare function DecodeLastRuneInString(s: string): [GoRune, int];
export declare function RuneCountInString(s: string): int;
export declare function RuneLen(r: GoRune): int;
//# sourceMappingURL=utf8.d.ts.map