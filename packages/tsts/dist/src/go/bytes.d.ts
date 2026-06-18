import type { int } from "@tsonic/core/types.js";
type ByteSlice = Uint8Array | Array<number>;
export interface Buffer {
    Write(bytes: ByteSlice): [int, Error | undefined];
    WriteByte(byte: number): Error | undefined;
    WriteString(text: string): [int, Error | undefined];
    String(): string;
    Bytes(): Uint8Array;
    Len(): int;
    Reset(): void;
}
export declare function Cut(source: ByteSlice, separator: ByteSlice): [Uint8Array, Uint8Array, boolean];
export declare function Equal(left: ByteSlice, right: ByteSlice): boolean;
export declare function NewBuffer(bytes: ByteSlice): Buffer;
export declare function NewReader(bytes: ByteSlice): Uint8Array;
export declare function ReplaceAll(source: ByteSlice, oldValue: ByteSlice, newValue: ByteSlice): Uint8Array;
export declare function Split(source: ByteSlice, separator: ByteSlice): Array<Uint8Array>;
export declare function TrimSpace(source: ByteSlice): Uint8Array;
export {};
//# sourceMappingURL=bytes.d.ts.map