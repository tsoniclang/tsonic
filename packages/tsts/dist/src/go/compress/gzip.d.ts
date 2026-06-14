import type { byte, int } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "../compat.js";
import type { Reader as IoReader, Writer as IoWriter } from "../io.js";
export declare const BestCompression: int;
declare class gzipReader implements IoReader {
    private readonly data;
    private offset;
    constructor(data: Uint8Array);
    Read(p: GoSlice<byte>): [int, GoError];
    Close(): GoError;
}
declare class gzipWriter implements IoWriter {
    private readonly writer;
    private readonly level;
    private readonly chunks;
    constructor(writer: IoWriter, level: int);
    Write(p: GoSlice<byte>): [int, GoError];
    Close(): GoError;
}
export declare function NewReader(source: IoReader | GoSlice<byte> | Uint8Array | string): [gzipReader | undefined, GoError];
export declare function NewWriterLevel(writer: IoWriter, level: int): [gzipWriter | undefined, GoError];
export {};
//# sourceMappingURL=gzip.d.ts.map