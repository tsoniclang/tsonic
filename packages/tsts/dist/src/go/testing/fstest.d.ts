import type { byte } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "../compat.js";
import type { File, FileMode, FS } from "../io/fs.js";
import { Time } from "../time.js";
export interface MapFile {
    Data?: GoSlice<byte> | Uint8Array | string;
    Mode?: FileMode;
    ModTime?: Date | Time;
    Sys?: unknown;
}
export type MapFS = Map<string, MapFile>;
export declare function MapFS_as_FS(map: MapFS): FS;
export declare function TestFS(fsys: FS, ...expected: GoSlice<string>): GoError;
export declare function Open(map: MapFS, name: string): [File, GoError];
//# sourceMappingURL=fstest.d.ts.map