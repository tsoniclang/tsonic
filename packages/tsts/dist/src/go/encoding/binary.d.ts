import type { byte, int } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "../compat.js";
export interface ByteOrder {
    Uint16(bytes: GoSlice<byte>): int;
    PutUint16(bytes: GoSlice<byte>, value: int): void;
}
export declare const BigEndian: ByteOrder;
export declare const LittleEndian: ByteOrder;
export declare function Append(buf: GoSlice<byte>, order: ByteOrder, data: int | GoSlice<int>): [GoSlice<byte>, GoError];
export declare function Read(reader: unknown, order: ByteOrder, data: GoSlice<int>): GoError;
export declare function Write(writer: unknown, order: ByteOrder, data: int | GoSlice<int>): GoError;
//# sourceMappingURL=binary.d.ts.map