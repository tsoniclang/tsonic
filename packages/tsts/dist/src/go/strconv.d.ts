import type { bool, int, long, ulong } from "./scalars.js";
import type { GoError } from "./compat.js";
export declare const ErrRange: GoError;
export declare const ErrSyntax: GoError;
export declare class NumError extends globalThis.Error {
    readonly Func: string;
    readonly Num: string;
    readonly Err: GoError;
    constructor(func: string, num: string, err: GoError);
    Unwrap(): GoError;
}
export declare function ParseInt(s: string, base: int, bitSize: int): [long, GoError];
export declare function Atoi(s: string): [int, GoError];
export declare function ParseUint(s: string, base: int, bitSize: int): [ulong, GoError];
export declare function ParseFloat(s: string, bitSize: int): [number, GoError];
export declare function ParseBool(s: string): [bool, GoError];
export declare function FormatInt(i: long, base: int): string;
export declare function FormatUint(i: ulong, base: int): string;
export declare function Itoa(i: int): string;
//# sourceMappingURL=strconv.d.ts.map