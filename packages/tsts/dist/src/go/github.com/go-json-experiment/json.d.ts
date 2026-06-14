import type { byte, bool } from "@tsonic/core/types.js";
import type { GoError, GoPtr, GoSlice } from "../../compat.js";
import type { Reader, Writer } from "../../io.js";
import type { Decoder, Encoder, Option } from "./json/jsontext.js";
export interface Options extends Option {
    readonly __jsonOptions?: never;
}
export declare const JsonFieldNames: unique symbol;
export interface JsonFieldSpec {
    readonly name: string;
    readonly omitZero?: bool;
}
export type JsonFieldName = string | JsonFieldSpec;
export type JsonFieldNameMap = Record<string, JsonFieldName>;
export interface MarshalerTo {
    MarshalJSONTo(encoder: Encoder): GoError;
}
export interface UnmarshalerFrom {
    UnmarshalJSONFrom(decoder: Decoder): GoError;
}
export declare function Deterministic(value: bool): Options;
export declare function Marshal(value: unknown, ...opts: Array<Options>): [GoSlice<byte>, GoError];
export declare function MarshalEncode(encoder: GoPtr<Encoder>, value: unknown, ...opts: Array<Options>): GoError;
export declare function MarshalWrite(writer: Writer, value: unknown, ...opts: Array<Options>): GoError;
export declare function Unmarshal(data: GoSlice<byte>, out: unknown, ...opts: Array<Options>): GoError;
export declare function UnmarshalDecode(decoder: GoPtr<Decoder>, out: unknown, ...opts: Array<Options>): GoError;
export declare function UnmarshalRead(reader: Reader, out: unknown, ...opts: Array<Options>): GoError;
//# sourceMappingURL=json.d.ts.map