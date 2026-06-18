import type { bool, int, byte } from "@tsonic/core/types.js";
import type { GoRune, GoSlice } from "./compat.js";
export declare class Builder {
    private buf;
    String(): string;
    Len(): int;
    Reset(): void;
    Grow(_n: int): void;
    WriteString(s: string): [int, Error | undefined];
    WriteByte(c: byte): Error | undefined;
    WriteRune(r: GoRune): [int, Error | undefined];
    Write(p: GoSlice<byte>): [int, Error | undefined];
}
export declare function Clone(s: string): string;
export declare function Compare(a: string, b: string): int;
export declare function Contains(s: string, substr: string): bool;
export declare function ContainsAny(s: string, chars: string): bool;
export declare function ContainsRune(s: string, r: GoRune): bool;
export declare function Count(s: string, substr: string): int;
export declare function Cut(s: string, sep: string): [string, string, bool];
export declare function CutPrefix(s: string, prefix: string): [string, bool];
export declare function CutSuffix(s: string, suffix: string): [string, bool];
export declare function EqualFold(s: string, t: string): bool;
export declare function Fields(s: string): GoSlice<string>;
export declare function FieldsFunc(s: string, f: (r: GoRune) => bool): GoSlice<string>;
export declare function HasPrefix(s: string, prefix: string): bool;
export declare function HasSuffix(s: string, suffix: string): bool;
export declare function Index(s: string, substr: string): int;
export declare function IndexAny(s: string, chars: string): int;
export declare function IndexByte(s: string, c: byte): int;
export declare function IndexFunc(s: string, f: (r: GoRune) => bool): int;
export declare function IndexRune(s: string, r: GoRune): int;
export declare function Join(elems: GoSlice<string>, sep: string): string;
export declare function LastIndex(s: string, substr: string): int;
export declare function LastIndexByte(s: string, c: byte): int;
export declare function LastIndexFunc(s: string, f: (r: GoRune) => bool): int;
export declare function Lines(s: string): (yieldValue: (line: string) => bool) => void;
export declare function Map(mapping: (r: GoRune) => GoRune, s: string): string;
export declare class Reader {
    private readonly s;
    private readonly bytes;
    private pos;
    constructor(s: string);
    Len(): int;
    Size(): int;
    ReadByte(): [byte, Error | undefined];
    ReadRune(): [GoRune, int, Error | undefined];
    String(): string;
}
export declare function NewReader(s: string): Reader;
export declare class Replacer {
    private readonly pairs;
    constructor(oldnew: GoSlice<string>);
    Replace(s: string): string;
}
export declare function NewReplacer(...oldnew: Array<string>): Replacer;
export declare function Repeat(s: string, count: int): string;
export declare function Replace(s: string, oldStr: string, newStr: string, n: int): string;
export declare function ReplaceAll(s: string, oldStr: string, newStr: string): string;
export declare function Split(s: string, sep: string): GoSlice<string>;
export declare function SplitN(s: string, sep: string, n: int): GoSlice<string>;
export declare function SplitSeq(s: string, sep: string): (yieldValue: (v: string) => bool) => void;
export declare function ToLower(s: string): string;
export declare function ToUpper(s: string): string;
export declare function ToValidUTF8(s: string, replacement: string): string;
export declare function Trim(s: string, cutset: string): string;
export declare function TrimFunc(s: string, f: (r: GoRune) => bool): string;
export declare function TrimLeft(s: string, cutset: string): string;
export declare function TrimLeftFunc(s: string, f: (r: GoRune) => bool): string;
export declare function TrimPrefix(s: string, prefix: string): string;
export declare function TrimRight(s: string, cutset: string): string;
export declare function TrimRightFunc(s: string, f: (r: GoRune) => bool): string;
export declare function TrimSpace(s: string): string;
export declare function TrimSuffix(s: string, suffix: string): string;
//# sourceMappingURL=strings.d.ts.map