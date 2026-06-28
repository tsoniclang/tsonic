import type { byte, int, long } from "../scalars.js";
import type { GoError, GoSlice } from "../compat.js";
import type { WriteCloser, Writer } from "../io.js";
export declare class CorruptInputError extends globalThis.Error {
    readonly offset: long;
    constructor(offset: long);
}
export declare class Encoding {
    private readonly encode;
    private readonly decodeMap;
    private padChar;
    private strict;
    constructor(encoder: string);
    EncodedLen(n: int): int;
    DecodedLen(n: int): int;
    Encode(dst: GoSlice<byte>, src: GoSlice<byte>): void;
    EncodeToString(src: GoSlice<byte>): string;
    DecodeString(s: string): [GoSlice<byte>, GoError];
    Decode(dst: GoSlice<byte>, src: GoSlice<byte>): [int, GoError];
    private decodeQuantum;
}
export declare const StdEncoding: Encoding;
export declare function NewEncoder(enc: Encoding, w: Writer): WriteCloser;
//# sourceMappingURL=base64.d.ts.map