import * as nodeFs from "node:fs";
import * as nodeOs from "node:os";
import * as nodePath from "node:path";
import process from "node:process";
import { NodeFS } from "./io/fs.js";
import { toNodeBytes } from "./nodebytes.js";
export const Args = [process.argv[1] ?? process.argv[0] ?? "node", ...process.argv.slice(2)];
export const Interrupt = "SIGINT";
export const PathError = Error;
export const O_APPEND = nodeFs.constants.O_APPEND;
export const O_CREATE = nodeFs.constants.O_CREAT;
export const O_TRUNC = nodeFs.constants.O_TRUNC;
export const O_WRONLY = nodeFs.constants.O_WRONLY;
class NodeFile {
    fd;
    constructor(fd) {
        this.fd = fd;
    }
    Write(p) {
        try {
            const bytes = toNodeBytes(p);
            return [
                nodeFs.writeSync(this.fd, bytes, 0, bytes.length),
                undefined,
            ];
        }
        catch (error) {
            return [0, normalizeError(error)];
        }
    }
    WriteString(s) {
        try {
            return [nodeFs.writeSync(this.fd, s, undefined, "utf8"), undefined];
        }
        catch (error) {
            return [0, normalizeError(error)];
        }
    }
    Close() {
        try {
            nodeFs.closeSync(this.fd);
            return undefined;
        }
        catch (error) {
            return normalizeError(error);
        }
    }
    Fd() {
        return this.fd;
    }
}
// Go's os.File.Write blocks until every byte is written (or fails). Node's
// fs.writeSync on a piped stdio fd can perform short writes and raise EAGAIN when the
// pipe buffer is full (the fd is non-blocking under the libuv event loop), which would
// silently truncate compiler output. Loop to full completion to keep Go semantics.
function writeFullySync(fd, bytes) {
    let offset = 0;
    while (offset < bytes.length) {
        try {
            offset += nodeFs.writeSync(fd, bytes, offset, bytes.length - offset);
        }
        catch (error) {
            if (error.code === "EAGAIN") {
                continue;
            }
            throw error;
        }
    }
}
class stdioFile {
    stream;
    fd;
    constructor(stream, fd) {
        this.stream = stream;
        this.fd = fd;
    }
    Write(p) {
        try {
            const bytes = toNodeBytes(p);
            if (this.fd >= 0) {
                writeFullySync(this.fd, bytes);
                return [bytes.length, undefined];
            }
            this.stream.write(bytes);
            return [bytes.length, undefined];
        }
        catch (error) {
            return [0, normalizeError(error)];
        }
    }
    WriteString(s) {
        try {
            const bytes = toNodeBytes(s);
            if (this.fd >= 0) {
                writeFullySync(this.fd, bytes);
                return [bytes.length, undefined];
            }
            this.stream.write(bytes);
            return [bytes.length, undefined];
        }
        catch (error) {
            return [0, normalizeError(error)];
        }
    }
    Close() {
        return undefined;
    }
    Fd() {
        return this.fd;
    }
}
export const Stdin = new stdioFile(process.stdin, 0);
export const Stdout = new stdioFile(process.stdout, 1);
export const Stderr = new stdioFile(process.stderr, 2);
export function DirFS(root) {
    return NodeFS(root);
}
export function Environ() {
    return Object.entries(process.env).map(([key, value]) => `${key}=${value ?? ""}`);
}
export function Executable() {
    return [process.execPath, undefined];
}
export function Exit(code) {
    process.exit(code);
}
export function Getenv(key) {
    return process.env[key] ?? "";
}
export function Getpid() {
    return process.pid;
}
export function Getwd() {
    try {
        return [process.cwd(), undefined];
    }
    catch (error) {
        return ["", normalizeError(error)];
    }
}
export function IsNotExist(err) {
    return err !== undefined && err.code === "ENOENT";
}
export function MkdirAll(path, perm) {
    try {
        nodeFs.mkdirSync(path, { mode: perm, recursive: true });
        return undefined;
    }
    catch (error) {
        return normalizeError(error);
    }
}
export function Open(path) {
    return OpenFile(path, nodeFs.constants.O_RDONLY, 0);
}
export function OpenFile(path, flag, perm) {
    try {
        return [new NodeFile(nodeFs.openSync(path, flag, perm)), undefined];
    }
    catch (error) {
        return [undefined, normalizeError(error)];
    }
}
export function Create(path) {
    return OpenFile(path, (nodeFs.constants.O_CREAT | nodeFs.constants.O_TRUNC | nodeFs.constants.O_WRONLY), 0o666);
}
export function ReadDir(path) {
    try {
        return [nodeFs.readdirSync(path, { withFileTypes: true }), undefined];
    }
    catch (error) {
        return [[], normalizeError(error)];
    }
}
export function ReadFile(path) {
    try {
        return [nodeFs.readFileSync(path, "utf8"), undefined];
    }
    catch (error) {
        return ["", normalizeError(error)];
    }
}
export function Remove(path) {
    try {
        nodeFs.rmSync(path, { force: true });
        return undefined;
    }
    catch (error) {
        return normalizeError(error);
    }
}
export function RemoveAll(path) {
    try {
        nodeFs.rmSync(path, { force: true, recursive: true });
        return undefined;
    }
    catch (error) {
        return normalizeError(error);
    }
}
export function Stat(path) {
    try {
        const stats = nodeFs.statSync(path);
        return [{
                Name: () => nodePath.basename(path),
                Size: () => stats.size,
                Mode: () => (stats.isDirectory() ? 0x80000000 : (stats.mode & 0o777)),
                ModTime: () => stats.mtime,
                IsDir: () => stats.isDirectory(),
                Sys: () => stats,
            }, undefined];
    }
    catch (error) {
        return [undefined, normalizeError(error)];
    }
}
export function Symlink(oldname, newname) {
    try {
        nodeFs.symlinkSync(oldname, newname);
        return undefined;
    }
    catch (error) {
        return normalizeError(error);
    }
}
export function TempDir() {
    return nodeOs.tmpdir();
}
export function UserCacheDir() {
    const cacheRoot = process.env.XDG_CACHE_HOME ?? nodePath.join(nodeOs.homedir(), ".cache");
    return [cacheRoot, undefined];
}
export function UserHomeDir() {
    return [nodeOs.homedir(), undefined];
}
export function WriteFile(path, data, perm) {
    try {
        nodeFs.writeFileSync(path, data, { encoding: "utf8", mode: perm });
        return undefined;
    }
    catch (error) {
        return normalizeError(error);
    }
}
export function Chtimes(path, aTime, mTime) {
    try {
        nodeFs.utimesSync(path, toDate(aTime), toDate(mTime));
        return undefined;
    }
    catch (error) {
        return normalizeError(error);
    }
}
function toDate(value) {
    return value instanceof Date ? value : new Date();
}
function normalizeError(error) {
    if (error instanceof globalThis.Error) {
        return error;
    }
    return new globalThis.Error(String(error));
}
//# sourceMappingURL=os.js.map