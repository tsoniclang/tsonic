import type { byte, int } from "./scalars.js";
import type { GoError, GoSlice } from "./compat.js";
import * as nodeFs from "node:fs";
import * as nodeOs from "node:os";
import * as nodePath from "node:path";
import process from "node:process";
import type { Writable } from "node:stream";
import { NodeFS } from "./io/fs.js";
import type { FileInfo, FS } from "./io/fs.js";
import type { Writer } from "./io.js";

export const Args: GoSlice<string> = [process.argv[1] ?? process.argv[0] ?? "node", ...process.argv.slice(2)];
export const Interrupt = "SIGINT";
export const PathError = Error;

export const O_APPEND: int = nodeFs.constants.O_APPEND as int;
export const O_CREATE: int = nodeFs.constants.O_CREAT as int;
export const O_TRUNC: int = nodeFs.constants.O_TRUNC as int;
export const O_WRONLY: int = nodeFs.constants.O_WRONLY as int;

export interface File extends Writer {
  WriteString(s: string): [int, GoError];
  Close(): GoError;
  Fd(): int;
}

class NodeFile implements File {
  constructor(private readonly fd: int) {}

  Write(p: GoSlice<byte>): [int, GoError] {
    try {
      return [nodeFs.writeSync(this.fd, Buffer.from(p), 0, p.length) as int, undefined];
    } catch (error) {
      return [0 as int, normalizeError(error)];
    }
  }

  WriteString(s: string): [int, GoError] {
    try {
      return [nodeFs.writeSync(this.fd, s, undefined, "utf8") as int, undefined];
    } catch (error) {
      return [0 as int, normalizeError(error)];
    }
  }

  Close(): GoError {
    try {
      nodeFs.closeSync(this.fd);
      return undefined;
    } catch (error) {
      return normalizeError(error);
    }
  }

  Fd(): int {
    return this.fd;
  }
}

// Go's os.File.Write blocks until every byte is written (or fails). Node's
// fs.writeSync on a piped stdio fd can perform short writes and raise EAGAIN when the
// pipe buffer is full (the fd is non-blocking under the libuv event loop), which would
// silently truncate compiler output. Loop to full completion to keep Go semantics.
function writeFullySync(fd: int, bytes: Buffer): void {
  let offset = 0;
  while (offset < bytes.length) {
    try {
      offset += nodeFs.writeSync(fd, bytes, offset, bytes.length - offset);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EAGAIN") {
        continue;
      }
      throw error;
    }
  }
}

class stdioFile implements File {
  constructor(private readonly stream: Writable, private readonly fd: int) {}

  Write(p: GoSlice<byte>): [int, GoError] {
    try {
      const bytes = Buffer.from(p);
      if (this.fd >= 0) {
        writeFullySync(this.fd, bytes);
        return [bytes.length as int, undefined];
      }
      this.stream.write(bytes);
      return [bytes.length as int, undefined];
    } catch (error) {
      return [0 as int, normalizeError(error)];
    }
  }

  WriteString(s: string): [int, GoError] {
    try {
      const bytes = Buffer.from(s, "utf8");
      if (this.fd >= 0) {
        writeFullySync(this.fd, bytes);
        return [bytes.length as int, undefined];
      }
      this.stream.write(bytes);
      return [bytes.length as int, undefined];
    } catch (error) {
      return [0 as int, normalizeError(error)];
    }
  }

  Close(): GoError {
    return undefined;
  }

  Fd(): int {
    return this.fd;
  }
}

export const Stdin: File = new stdioFile(process.stdin, 0 as int);
export const Stdout: File = new stdioFile(process.stdout, 1 as int);
export const Stderr: File = new stdioFile(process.stderr, 2 as int);

export function DirFS(root: string): FS {
  return NodeFS(root);
}

export function Environ(): GoSlice<string> {
  return Object.entries(process.env).map(([key, value]) => `${key}=${value ?? ""}`);
}

export function Executable(): [string, GoError] {
  return [process.execPath, undefined];
}

export function Exit(code: int): never {
  process.exit(code);
}

export function Getenv(key: string): string {
  return process.env[key] ?? "";
}

export function Getpid(): int {
  return process.pid as int;
}

export function Getwd(): [string, GoError] {
  try {
    return [process.cwd(), undefined];
  } catch (error) {
    return ["", normalizeError(error)];
  }
}

export function IsNotExist(err: GoError): boolean {
  return err !== undefined && (err as NodeJS.ErrnoException).code === "ENOENT";
}

export function MkdirAll(path: string, perm: int): GoError {
  try {
    nodeFs.mkdirSync(path, { mode: perm, recursive: true });
    return undefined;
  } catch (error) {
    return normalizeError(error);
  }
}

export function Open(path: string): [File, GoError] {
  return OpenFile(path, nodeFs.constants.O_RDONLY as int, 0 as int);
}

export function OpenFile(path: string, flag: int, perm: int): [File, GoError] {
  try {
    return [new NodeFile(nodeFs.openSync(path, flag, perm) as int), undefined];
  } catch (error) {
    return [undefined as unknown as File, normalizeError(error)];
  }
}

export function Create(path: string): [File, GoError] {
  return OpenFile(path, (nodeFs.constants.O_CREAT | nodeFs.constants.O_TRUNC | nodeFs.constants.O_WRONLY) as int, 0o666 as int);
}

export function ReadDir(path: string): [GoSlice<nodeFs.Dirent>, GoError] {
  try {
    return [nodeFs.readdirSync(path, { withFileTypes: true }), undefined];
  } catch (error) {
    return [[], normalizeError(error)];
  }
}

export function ReadFile(path: string): [string, GoError] {
  try {
    return [nodeFs.readFileSync(path, "utf8"), undefined];
  } catch (error) {
    return ["", normalizeError(error)];
  }
}

export function Remove(path: string): GoError {
  try {
    nodeFs.rmSync(path, { force: true });
    return undefined;
  } catch (error) {
    return normalizeError(error);
  }
}

export function RemoveAll(path: string): GoError {
  try {
    nodeFs.rmSync(path, { force: true, recursive: true });
    return undefined;
  } catch (error) {
    return normalizeError(error);
  }
}

export function Stat(path: string): [FileInfo, GoError] {
  try {
    const stats = nodeFs.statSync(path);
    return [{
      Name: () => nodePath.basename(path),
      Size: () => stats.size as int,
      Mode: () => (stats.isDirectory() ? 0x80000000 : (stats.mode & 0o777)) as unknown as import("./io/fs.js").FileMode,
      ModTime: () => stats.mtime,
      IsDir: () => stats.isDirectory(),
      Sys: () => stats,
    }, undefined];
  } catch (error) {
    return [undefined as unknown as FileInfo, normalizeError(error)];
  }
}

export function Symlink(oldname: string, newname: string): GoError {
  try {
    nodeFs.symlinkSync(oldname, newname);
    return undefined;
  } catch (error) {
    return normalizeError(error);
  }
}

export function TempDir(): string {
  return nodeOs.tmpdir();
}

export function UserCacheDir(): [string, GoError] {
  const cacheRoot = process.env.XDG_CACHE_HOME ?? nodePath.join(nodeOs.homedir(), ".cache");
  return [cacheRoot, undefined];
}

export function UserHomeDir(): [string, GoError] {
  return [nodeOs.homedir(), undefined];
}

export function WriteFile(path: string, data: string, perm: int): GoError {
  try {
    nodeFs.writeFileSync(path, data, { encoding: "utf8", mode: perm });
    return undefined;
  } catch (error) {
    return normalizeError(error);
  }
}

export function Chtimes(path: string, aTime: unknown, mTime: unknown): GoError {
  try {
    nodeFs.utimesSync(path, toDate(aTime), toDate(mTime));
    return undefined;
  } catch (error) {
    return normalizeError(error);
  }
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date();
}

function normalizeError(error: unknown): GoError {
  if (error instanceof globalThis.Error) {
    return error;
  }
  return new globalThis.Error(String(error));
}
