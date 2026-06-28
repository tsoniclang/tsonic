import type { byte, int } from "./scalars.js";
import type { GoError, GoSlice } from "./compat.js";
export declare const EOF: GoError;
export declare const ErrUnexpectedEOF: GoError;
export interface Closer {
    Close(): GoError;
}
export declare const Discard: Writer;
export interface ReadCloser extends Reader, Closer {
    readonly __tsgoEmpty?: never;
}
export interface Reader {
    Read(p: GoSlice<byte>): [int, GoError];
}
export declare function ReadFull(reader: Reader, buffer: GoSlice<byte>): [int, GoError];
export interface ReadWriteCloser extends Reader, Writer, Closer {
    readonly __tsgoEmpty?: never;
}
export interface ReadWriter extends Reader, Writer {
    readonly __tsgoEmpty?: never;
}
export interface WriteCloser extends Writer, Closer {
    readonly __tsgoEmpty?: never;
}
export interface Writer {
    Write(p: GoSlice<byte>): [int, GoError];
}
//# sourceMappingURL=io.d.ts.map