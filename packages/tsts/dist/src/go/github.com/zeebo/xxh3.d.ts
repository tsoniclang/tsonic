import type { bool, byte, int } from "../../scalars.js";
import type { GoError, GoSlice } from "../../compat.js";
export interface Hasher {
    Write(p: GoSlice<byte>): [int, GoError];
    WriteString(s: string): [int, GoError];
    Sum64(): bigint;
    Sum128(): Uint128;
    Reset(): void;
}
export interface Uint128 {
    Hi: bigint;
    Lo: bigint;
    Bytes(): GoSlice<byte>;
    IsZero(): bool;
    String(): string;
}
export declare function HashString128(s: string): Uint128;
export declare function New(): Hasher;
//# sourceMappingURL=xxh3.d.ts.map