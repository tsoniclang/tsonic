import { ErrNotExist, ModeDir, Stat } from "../io/fs.js";
import { Time } from "../time.js";
export function MapFS_as_FS(map) {
    return {
        Open: (name) => Open(map, name),
    };
}
export function TestFS(fsys, ...expected) {
    for (const path of expected) {
        if (fsys.Open === undefined) {
            const [info, statErr] = Stat(fsys, path);
            if (statErr !== undefined) {
                return statErr;
            }
            if (path.endsWith("/") && !info.IsDir()) {
                return new globalThis.Error(`fstest.TestFS: ${path} is not a directory`);
            }
            continue;
        }
        const [file, err] = fsys.Open(path);
        if (err !== undefined) {
            return err;
        }
        const [info, statErr] = file.Stat();
        if (statErr !== undefined) {
            return statErr;
        }
        if (path.endsWith("/") && !info.IsDir()) {
            return new globalThis.Error(`fstest.TestFS: ${path} is not a directory`);
        }
    }
    return undefined;
}
export function Open(map, name) {
    const normalizedName = normalizeName(name);
    const file = map.get(normalizedName);
    if (file === undefined && !hasDirectory(map, normalizedName)) {
        return [undefined, ErrNotExist];
    }
    const isSyntheticDirectory = file === undefined;
    const mode = isSyntheticDirectory ? ModeDir : file.Mode ?? 0;
    const bytes = isSyntheticDirectory ? new Uint8Array() : bytesForFile(file);
    let offset = 0;
    const mapFile = {
        Stat() {
            return [{
                    Name: () => baseName(normalizedName),
                    IsDir: () => ((mode & ModeDir) !== 0),
                    Mode: () => mode,
                    Size: () => bytes.length,
                    ModTime: () => modTimeToDate(file?.ModTime),
                    Sys: () => file?.Sys,
                }, undefined];
        },
        ReadDir(n) {
            if ((mode & ModeDir) === 0) {
                return [[], ErrNotExist];
            }
            const entries = directoryEntries(map, normalizedName);
            return [n >= 0 ? entries.slice(0, n) : entries, undefined];
        },
        Read(buffer) {
            const remaining = bytes.length - offset;
            const count = Math.max(0, Math.min(buffer.length, remaining));
            for (let index = 0; index < count; index += 1) {
                buffer[index] = bytes[offset + index];
            }
            offset += count;
            return [count, undefined];
        },
        Close() {
            return undefined;
        },
    };
    return [mapFile, undefined];
}
function normalizeName(name) {
    if (name === "." || name === "") {
        return ".";
    }
    return name.replace(/^\.\/+/, "").replace(/\/+$/, "");
}
function hasDirectory(map, name) {
    if (name === ".") {
        return map.size > 0;
    }
    const prefix = `${name}/`;
    for (const path of map.keys()) {
        if (path.startsWith(prefix)) {
            return true;
        }
    }
    return false;
}
function directoryEntries(map, name) {
    const prefix = name === "." ? "" : `${name}/`;
    const childNames = new Map();
    for (const [path, file] of map.entries()) {
        if (!path.startsWith(prefix)) {
            continue;
        }
        const remainder = path.slice(prefix.length);
        if (remainder === "") {
            continue;
        }
        const slash = remainder.indexOf("/");
        if (slash < 0) {
            childNames.set(remainder, file.Mode ?? 0);
        }
        else {
            childNames.set(remainder.slice(0, slash), ModeDir);
        }
    }
    return Array.from(childNames.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([childName, mode]) => {
        const isDir = ((mode & ModeDir) !== 0);
        const info = {
            Name: () => childName,
            IsDir: () => isDir,
            Mode: () => mode,
            Size: () => 0,
            ModTime: () => new Date(0),
            Sys: () => undefined,
        };
        return {
            Name: () => childName,
            IsDir: () => isDir,
            Type: () => mode,
            Info: () => [info, undefined],
        };
    });
}
function baseName(name) {
    if (name === ".") {
        return ".";
    }
    return name.split("/").pop() ?? name;
}
function bytesForFile(file) {
    if (file.Data === undefined) {
        return new Uint8Array();
    }
    if (typeof file.Data === "string") {
        return new TextEncoder().encode(file.Data);
    }
    if (file.Data instanceof Uint8Array) {
        return file.Data;
    }
    return Uint8Array.from(file.Data);
}
function modTimeToDate(value) {
    if (value === undefined) {
        return new Date(0);
    }
    return value instanceof Time ? value.ToDate() : value;
}
//# sourceMappingURL=fstest.js.map