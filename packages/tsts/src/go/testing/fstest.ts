import type { byte, int } from "../scalars.js";
import type { GoError, GoSlice } from "../compat.js";
import type { DirEntry, File, FileInfo, FileMode, FS, ReadDirFile } from "../io/fs.js";
import { ErrNotExist, ModeDir, Stat } from "../io/fs.js";
import { Time } from "../time.js";

export interface MapFile {
  Data?: GoSlice<byte> | Uint8Array | string;
  Mode?: FileMode;
  ModTime?: Date | Time;
  Sys?: unknown;
}

export type MapFS = Map<string, MapFile>;

export function MapFS_as_FS(map: MapFS): FS {
  return {
    Open: (name: string): [File, GoError] => Open(map, name),
  };
}

export function TestFS(fsys: FS, ...expected: GoSlice<string>): GoError {
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

export function Open(map: MapFS, name: string): [File, GoError] {
  const normalizedName = normalizeName(name);
  const file = map.get(normalizedName);
  if (file === undefined && !hasDirectory(map, normalizedName)) {
    return [undefined as unknown as File, ErrNotExist];
  }
  const isSyntheticDirectory = file === undefined;
  const mode = isSyntheticDirectory ? ModeDir : file.Mode ?? 0 as FileMode;
  const bytes = isSyntheticDirectory ? new Uint8Array() : bytesForFile(file);
  let offset = 0;
  const mapFile: ReadDirFile = {
    Stat(): [FileInfo, GoError] {
      return [{
        Name: () => baseName(normalizedName),
        IsDir: () => (((mode as number) & (ModeDir as number)) !== 0) as boolean,
        Mode: () => mode,
        Size: () => bytes.length as int,
        ModTime: () => modTimeToDate(file?.ModTime),
        Sys: () => file?.Sys,
      }, undefined];
    },
    ReadDir(n: int): [GoSlice<DirEntry>, GoError] {
      if (((mode as number) & (ModeDir as number)) === 0) {
        return [[], ErrNotExist];
      }
      const entries = directoryEntries(map, normalizedName);
      return [n >= 0 ? entries.slice(0, n) : entries, undefined];
    },
    Read(buffer: GoSlice<number>): [int, GoError] {
      const remaining = bytes.length - offset;
      const count = Math.max(0, Math.min(buffer.length, remaining));
      for (let index = 0; index < count; index += 1) {
        buffer[index] = bytes[offset + index]!;
      }
      offset += count;
      return [count as int, undefined];
    },
    Close(): GoError {
      return undefined;
    },
  };
  return [mapFile, undefined];
}

function normalizeName(name: string): string {
  if (name === "." || name === "") {
    return ".";
  }
  return name.replace(/^\.\/+/, "").replace(/\/+$/, "");
}

function hasDirectory(map: MapFS, name: string): boolean {
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

function directoryEntries(map: MapFS, name: string): DirEntry[] {
  const prefix = name === "." ? "" : `${name}/`;
  const childNames = new Map<string, FileMode>();
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
      childNames.set(remainder, file.Mode ?? 0 as FileMode);
    } else {
      childNames.set(remainder.slice(0, slash), ModeDir);
    }
  }
  return Array.from(childNames.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([childName, mode]) => {
      const isDir = (((mode as number) & (ModeDir as number)) !== 0) as boolean;
      const info: FileInfo = {
        Name: () => childName,
        IsDir: () => isDir,
        Mode: () => mode,
        Size: () => 0 as int,
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

function baseName(name: string): string {
  if (name === ".") {
    return ".";
  }
  return name.split("/").pop() ?? name;
}

function bytesForFile(file: MapFile): Uint8Array {
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

function modTimeToDate(value: Date | Time | undefined): Date {
  if (value === undefined) {
    return new Date(0);
  }
  return value instanceof Time ? value.ToDate() : value;
}
