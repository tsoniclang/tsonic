import * as nodeFs from "node:fs";
import * as nodePath from "node:path";
export const ModeDir = 0x80000000;
export const ModeSymlink = 0x08000000;
export const ModeIrregular = 0x00080000;
export const ModePerm = 0o777;
export function FileMode_IsDir(mode) {
    return ((mode & ModeDir) !== 0);
}
export function FileMode_IsRegular(mode) {
    return ((mode & (ModeDir | ModeSymlink | ModeIrregular)) === 0);
}
export const ErrInvalid = new globalThis.Error("invalid argument");
export const ErrPermission = new globalThis.Error("permission denied");
export const ErrExist = new globalThis.Error("file already exists");
export const ErrNotExist = new globalThis.Error("file does not exist");
export const ErrClosed = new globalThis.Error("file already closed");
export const SkipDir = new globalThis.Error("skip this directory");
export const SkipAll = new globalThis.Error("skip everything and stop the walk");
export function NodeFS(root) {
    return { root: nodePath.resolve(root) };
}
export function FileExists(fsys, name) {
    const [info, err] = Stat(fsys, name);
    return err === undefined && info !== undefined && !info.IsDir();
}
export function DirectoryExists(fsys, name) {
    const [info, err] = Stat(fsys, name);
    return err === undefined && info !== undefined && info.IsDir();
}
export function GetAccessibleEntries(fsys, name) {
    return ReadDir(fsys, name);
}
export function ReadFile(fsys, name) {
    const [bytes, err] = ReadFileBytes(fsys, name);
    if (err !== undefined) {
        return ["", err];
    }
    return [bytesToBinaryString(bytes), undefined];
}
export function ReadFileBytes(fsys, name) {
    if (fsys.Open !== undefined) {
        const [file, openErr] = fsys.Open(name);
        if (openErr !== undefined) {
            return [new Uint8Array(), openErr];
        }
        const chunks = [];
        const buffer = new globalThis.Array(8192).fill(0);
        for (;;) {
            const [count, readErr] = file.Read(buffer);
            if (readErr !== undefined) {
                const closeErr = file.Close();
                return [new Uint8Array(), readErr ?? closeErr];
            }
            if (count === 0) {
                break;
            }
            for (let index = 0; index < count; index += 1) {
                chunks.push(buffer[index]);
            }
            if (count < buffer.length) {
                break;
            }
        }
        const closeErr = file.Close();
        if (closeErr !== undefined) {
            return [new Uint8Array(), closeErr];
        }
        return [Uint8Array.from(chunks), undefined];
    }
    try {
        return [nodeFs.readFileSync(resolveFsPath(fsys, name)), undefined];
    }
    catch (error) {
        return [new Uint8Array(), normalizeFsError(error)];
    }
}
export function ReadDir(fsys, name) {
    if (fsys.Open !== undefined) {
        const [file, openErr] = fsys.Open(name);
        if (openErr !== undefined) {
            return [[], openErr];
        }
        const readDirFile = file;
        if (readDirFile.ReadDir === undefined) {
            const closeErr = file.Close();
            return [[], closeErr ?? ErrInvalid];
        }
        const [entries, readErr] = readDirFile.ReadDir(-1);
        const closeErr = file.Close();
        if (readErr !== undefined) {
            return [[], readErr];
        }
        if (closeErr !== undefined) {
            return [[], closeErr];
        }
        return [entries, undefined];
    }
    try {
        const dirents = nodeFs.readdirSync(resolveFsPath(fsys, name), { withFileTypes: true });
        return [dirents.map(dirEntryFromNodeDirent), undefined];
    }
    catch (error) {
        return [[], normalizeFsError(error)];
    }
}
export function Stat(fsys, name) {
    if (fsys.Open !== undefined) {
        const [file, openErr] = fsys.Open(name);
        if (openErr !== undefined) {
            return [undefined, openErr];
        }
        const [info, statErr] = file.Stat();
        const closeErr = file.Close();
        if (statErr !== undefined) {
            return [undefined, statErr];
        }
        if (closeErr !== undefined) {
            return [undefined, closeErr];
        }
        return [info, undefined];
    }
    try {
        const fullPath = resolveFsPath(fsys, name);
        return [fileInfoFromStats(nodePath.basename(fullPath), nodeFs.statSync(fullPath)), undefined];
    }
    catch (error) {
        return [undefined, normalizeFsError(error)];
    }
}
export function WalkDir(fsys, root, walkFn) {
    const walkPath = (relativePath) => {
        const [info, statErr] = Stat(fsys, relativePath);
        if (statErr !== undefined) {
            return walkFn(relativePath, undefined, statErr);
        }
        const entry = FileInfoToDirEntry(info);
        const visitErr = walkFn(relativePath, entry, undefined);
        if (visitErr === SkipAll) {
            return SkipAll;
        }
        if (visitErr === SkipDir) {
            return undefined;
        }
        if (visitErr !== undefined) {
            return visitErr;
        }
        if (!info.IsDir()) {
            return undefined;
        }
        const [entries, readErr] = ReadDir(fsys, relativePath);
        if (readErr !== undefined) {
            return walkFn(relativePath, entry, readErr);
        }
        for (const child of entries) {
            const childPath = relativePath === "." || relativePath === "" ? child.Name() : `${relativePath}/${child.Name()}`;
            const childErr = walkPath(childPath);
            if (childErr === SkipAll) {
                return SkipAll;
            }
            if (childErr !== undefined) {
                return childErr;
            }
        }
        return undefined;
    };
    const err = walkPath(root === "" ? "." : root);
    return err === SkipAll ? undefined : err;
}
export function FileInfoToDirEntry(info) {
    if (info === undefined) {
        throw ErrInvalid;
    }
    const fileInfo = info;
    return {
        Name: () => fileInfo.Name(),
        IsDir: () => fileInfo.IsDir(),
        Type: () => fileInfo.Mode(),
        Info: () => [fileInfo, undefined],
    };
}
export function Sub(fsys, dir) {
    if (fsys.Open !== undefined) {
        const prefix = dir.replace(/\/+$/, "");
        return [{
                Open(name) {
                    const childName = name === "." || name === "" ? prefix : `${prefix}/${name}`;
                    return fsys.Open(childName);
                },
            }, undefined];
    }
    try {
        return [NodeFS(resolveFsPath(fsys, dir)), undefined];
    }
    catch (error) {
        return [undefined, normalizeFsError(error)];
    }
}
export function UseCaseSensitiveFileNames(_fsys) {
    return process.platform !== "win32";
}
export function Realpath(fsys, name) {
    try {
        return [nodeFs.realpathSync(resolveFsPath(fsys, name)), undefined];
    }
    catch (error) {
        return ["", normalizeFsError(error)];
    }
}
export function WriteFile(fsys, name, data, _perm) {
    try {
        const fullPath = resolveFsPath(fsys, name);
        nodeFs.mkdirSync(nodePath.dirname(fullPath), { recursive: true });
        nodeFs.writeFileSync(fullPath, data, "utf8");
        return undefined;
    }
    catch (error) {
        return normalizeFsError(error);
    }
}
export function Remove(fsys, name) {
    try {
        nodeFs.rmSync(resolveFsPath(fsys, name), { force: true, recursive: true });
        return undefined;
    }
    catch (error) {
        return normalizeFsError(error);
    }
}
export function Outputs(..._args) {
    return undefined;
}
function resolveFsPath(fsys, name) {
    const root = fsys.root ?? "/";
    return name === "." ? root : nodePath.resolve(root, name);
}
function dirEntryFromNodeDirent(dirent) {
    const mode = modeFromDirent(dirent);
    return {
        Name: () => dirent.name,
        IsDir: () => dirent.isDirectory(),
        Type: () => mode,
        Info: () => {
            const parentlessInfo = {
                Name: () => dirent.name,
                Size: () => 0,
                Mode: () => mode,
                ModTime: () => new Date(0),
                IsDir: () => dirent.isDirectory(),
                Sys: () => dirent,
            };
            return [parentlessInfo, undefined];
        },
    };
}
function fileInfoFromStats(name, stats) {
    const mode = modeFromStats(stats);
    return {
        Name: () => name,
        Size: () => stats.size,
        Mode: () => mode,
        ModTime: () => stats.mtime,
        IsDir: () => stats.isDirectory(),
        Sys: () => stats,
    };
}
function modeFromDirent(dirent) {
    if (dirent.isDirectory()) {
        return ModeDir;
    }
    if (dirent.isSymbolicLink()) {
        return ModeSymlink;
    }
    if (dirent.isFile()) {
        return 0;
    }
    return ModeIrregular;
}
function modeFromStats(stats) {
    if (stats.isDirectory()) {
        return ModeDir;
    }
    if (stats.isSymbolicLink()) {
        return ModeSymlink;
    }
    if (stats.isFile()) {
        return (stats.mode & ModePerm);
    }
    return ModeIrregular;
}
function normalizeFsError(error) {
    if (error instanceof globalThis.Error) {
        return error;
    }
    return new globalThis.Error(String(error));
}
function bytesToBinaryString(bytes) {
    let result = "";
    const chunkSize = 8192;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        result += globalThis.String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return result;
}
//# sourceMappingURL=fs.js.map