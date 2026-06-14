import type { bool, byte } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "../../../compat.js";
import type { Reader, Writer } from "../../../io.js";
export interface Option {
    readonly name: string;
    readonly value: unknown;
}
export declare function AllowDuplicateNames(allow: bool): Option;
export declare function AllowInvalidUTF8(allow: bool): Option;
export declare class Kind {
    #private;
    constructor(value: string);
    Kind(): string;
    String(): string;
}
export declare const BeginArray: Kind;
export declare const BeginObject: Kind;
export declare const EndArray: Kind;
export declare const EndObject: Kind;
export declare const Null: Kind;
export type Value = GoSlice<byte>;
export interface Decoder {
    PeekKind(): string;
    ReadToken(): [Kind, GoError];
    ReadValue(): [unknown, GoError];
}
export interface Encoder {
    WriteToken(kind: Kind): GoError;
    WriteValue(value: unknown): GoError;
    Bytes(): GoSlice<byte>;
}
export declare function NewDecoder(reader: Reader | GoSlice<byte> | string): Decoder;
export declare function NewEncoder(): Encoder;
export declare function WithIndent(indent: string): Option;
export declare function WithIndentPrefix(prefix: string): Option;
export declare const writeTo: (writer: Writer, bytes: GoSlice<byte>) => GoError;
//# sourceMappingURL=jsontext.d.ts.map