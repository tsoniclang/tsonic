import type { byte, int } from "../scalars.js";
import type { GoError, GoSlice } from "../compat.js";
export interface Hash64 {
    Write(p: GoSlice<byte>): [int, GoError];
    Sum64(): bigint;
    Sum(p: GoSlice<byte>): GoSlice<byte>;
    Reset(): void;
}
export declare function New64a(): Hash64;
//# sourceMappingURL=fnv.d.ts.map