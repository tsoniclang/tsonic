import type { bool, int } from "../scalars.js";
import type { GoError, GoSlice } from "../compat.js";
export type FileMode = number;
export declare const ModeDir: FileMode;
export declare const ModeSymlink: FileMode;
export declare const ModeIrregular: FileMode;
export declare const ModePerm: FileMode;
export declare function FileMode_IsDir(mode: FileMode): bool;
export declare function FileMode_IsRegular(mode: FileMode): bool;
export declare const ErrInvalid: Error;
export declare const ErrPermission: Error;
export declare const ErrExist: Error;
export declare const ErrNotExist: Error;
export declare const ErrClosed: Error;
export declare const SkipDir: Error;
export declare const SkipAll: Error;
export interface FileInfo {
    Name(): string;
    Size(): int;
    Mode(): FileMode;
    ModTime(): Date;
    IsDir(): bool;
    Sys(): unknown;
}
export interface DirEntry {
    Name(): string;
    IsDir(): bool;
    Type(): FileMode;
    Info(): [FileInfo, GoError];
}
export interface File {
    Stat(): [FileInfo, GoError];
    Read(buffer: GoSlice<number>): [int, GoError];
    Close(): GoError;
}
export interface ReadDirFile extends File {
    ReadDir(n: int): [GoSlice<DirEntry>, GoError];
}
export interface FS {
    readonly root?: string;
    Open?(name: string): [File, GoError];
}
export type WalkDirFunc = (path: string, d: DirEntry, err: GoError) => GoError;
export declare function NodeFS(root: string): FS;
export declare function FileExists(fsys: FS, name: string): bool;
export declare function DirectoryExists(fsys: FS, name: string): bool;
export declare function GetAccessibleEntries(fsys: FS, name: string): unknown;
export declare function ReadFile(fsys: FS, name: string): [string, GoError];
export declare function ReadFileBytes(fsys: FS, name: string): [Uint8Array, GoError];
export declare function ReadDir(fsys: FS, name: string): [GoSlice<DirEntry>, GoError];
export declare function Stat(fsys: FS, name: string): [FileInfo, GoError];
export declare function WalkDir(fsys: FS, root: string, walkFn: WalkDirFunc): GoError;
export declare function FileInfoToDirEntry(info: unknown): DirEntry;
export declare function Sub(fsys: FS, dir: string): [FS, GoError];
export declare function UseCaseSensitiveFileNames(_fsys: FS): bool;
export declare function Realpath(fsys: FS, name: string): [string, GoError];
export declare function WriteFile(fsys: FS, name: string, data: string, _perm?: FileMode): GoError;
export declare function Remove(fsys: FS, name: string): GoError;
export declare function Outputs(..._args: Array<unknown>): unknown;
//# sourceMappingURL=fs.d.ts.map