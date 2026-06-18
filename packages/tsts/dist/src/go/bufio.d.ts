import type { byte, int } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "./compat.js";
import type { Reader as IoReader, Writer as IoWriter } from "./io.js";
export declare class Reader implements IoReader {
    private readonly source;
    private readonly buffer;
    constructor(source: IoReader);
    Read(p: GoSlice<byte>): [int, GoError];
    ReadByte(): [byte, GoError];
    ReadBytes(delim: byte): [GoSlice<byte>, GoError];
}
export declare class Writer implements IoWriter {
    private readonly target;
    private readonly buffer;
    constructor(target: IoWriter);
    Write(p: GoSlice<byte>): [int, GoError];
    WriteString(s: string): [int, GoError];
    Flush(): GoError;
}
export declare class Scanner {
    private readonly lines;
    private index;
    constructor(reader: IoReader);
    Scan(): boolean;
    Text(): string;
    Err(): GoError;
}
export declare function NewReader(reader: IoReader): Reader;
export declare function NewScanner(reader: IoReader): Scanner;
export declare function NewWriter(writer: IoWriter): Writer;
//# sourceMappingURL=bufio.d.ts.map