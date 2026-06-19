// Faithful TypeScript port of the forward-slash (POSIX) subset of Go's
// `path/filepath` package that typescript-go relies on.
//
// typescript-go always operates on forward-slash ("/") paths, so this facade
// fixes Separator == '/'. On unix the leading volume name length is always 0
// (volumeNameLen returns 0), which means:
//   - VolumeName always returns ""
//   - ToSlash / FromSlash are the identity (Separator is already '/')
//   - postClean is a no-op
// The lexical routines (Clean, Join, Ext, Base, Dir, IsAbs, Rel) are direct
// ports of internal/filepathlite + path/filepath/path_unix.go.
//
// Because Separator and the only structural characters ('/', '.') are ASCII,
// indexing by JavaScript string units matches Go's byte indexing here.

import type { bool, int } from "../scalars.js";
import type { GoError, GoSlice } from "../compat.js";
import * as nodeFs from "node:fs";
import * as nodePath from "node:path";
import * as strings from "../strings.js";

// Separator is the OS path separator. typescript-go targets forward-slash
// paths, matching unix (filepathlite.Separator == '/').
export const Separator: string = "/";

// IsPathSeparator reports whether c is a path separator character.
const IsPathSeparator = (c: string): bool => c === Separator;

// volumeNameLen returns the length of the leading volume name. It is always 0
// off Windows (internal/filepathlite/path_unix.go).
const volumeNameLen = (_path: string): int => 0;

// ToSlash returns path unchanged because Separator is already '/'.
export function ToSlash(path: string): string {
  return path;
}

// FromSlash returns path unchanged because Separator is already '/'.
export function FromSlash(path: string): string {
  return path;
}

// VolumeName returns the leading volume name. Off Windows this is always "".
export function VolumeName(path: string): string {
  return FromSlash(path.slice(0, volumeNameLen(path)));
}

// VolumeNameLen returns the length of the leading volume name (0 off Windows).
export function VolumeNameLen(path: string): int {
  return volumeNameLen(path);
}

// IsAbs reports whether the path is absolute (path_unix.go: prefix "/").
export function IsAbs(path: string): bool {
  return strings.HasPrefix(path, "/");
}

// Clean returns the shortest path name equivalent to path by purely lexical
// processing. Faithful port of internal/filepathlite.Clean for Separator '/'.
export function Clean(path: string): string {
  const originalPath = path;
  const volLen = volumeNameLen(path);
  path = path.slice(volLen);
  if (path === "") {
    if (volLen > 1 && IsPathSeparator(originalPath[0]!) && IsPathSeparator(originalPath[1]!)) {
      // should be UNC
      return FromSlash(originalPath);
    }
    return originalPath + ".";
  }
  const rooted = IsPathSeparator(path[0]!);

  // Invariants:
  //   reading from path; r is index of next byte to process.
  //   writing to out; out.w is index of next byte to write.
  //   dotdot is index in out where .. must stop, either because it is the
  //     leading slash or it is a leading ../../.. prefix.
  const n = path.length;
  const out = new LazyBuf(path, originalPath, volLen);
  let r = 0;
  let dotdot = 0;
  if (rooted) {
    out.append(Separator);
    r = 1;
    dotdot = 1;
  }

  while (r < n) {
    if (IsPathSeparator(path[r]!)) {
      // empty path element
      r++;
    } else if (path[r] === "." && (r + 1 === n || IsPathSeparator(path[r + 1]!))) {
      // . element
      r++;
    } else if (path[r] === "." && path[r + 1] === "." && (r + 2 === n || IsPathSeparator(path[r + 2]!))) {
      // .. element: remove to last separator
      r += 2;
      if (out.w > dotdot) {
        // can backtrack
        out.w--;
        while (out.w > dotdot && !IsPathSeparator(out.index(out.w))) {
          out.w--;
        }
      } else if (!rooted) {
        // cannot backtrack, but not rooted, so append .. element.
        if (out.w > 0) {
          out.append(Separator);
        }
        out.append(".");
        out.append(".");
        dotdot = out.w;
      }
    } else {
      // real path element.
      // add slash if needed
      if ((rooted && out.w !== 1) || (!rooted && out.w !== 0)) {
        out.append(Separator);
      }
      // copy element
      for (; r < n && !IsPathSeparator(path[r]!); r++) {
        out.append(path[r]!);
      }
    }
  }

  // Turn empty string into "."
  if (out.w === 0) {
    out.append(".");
  }

  // postClean is a no-op off Windows.
  return FromSlash(out.string());
}

// LazyBuf mirrors internal/filepathlite.lazybuf. It accumulates the cleaned
// path, only allocating a backing buffer once output diverges from the input.
class LazyBuf {
  private readonly path: string;
  private buf: Array<string> | undefined = undefined;
  w: int = 0;
  private readonly volAndPath: string;
  private readonly volLen: int;

  constructor(path: string, volAndPath: string, volLen: int) {
    this.path = path;
    this.volAndPath = volAndPath;
    this.volLen = volLen;
  }

  index(i: int): string {
    if (this.buf !== undefined) {
      return this.buf[i]!;
    }
    return this.path[i]!;
  }

  append(c: string): void {
    if (this.buf === undefined) {
      if (this.w < this.path.length && this.path[this.w] === c) {
        this.w++;
        return;
      }
      const newBuf: Array<string> = new Array<string>(this.path.length).fill("");
      for (let i = 0; i < this.w; i++) {
        newBuf[i] = this.path[i]!;
      }
      this.buf = newBuf;
    }
    this.buf[this.w] = c;
    this.w++;
  }

  string(): string {
    if (this.buf === undefined) {
      return this.volAndPath.slice(0, this.volLen + this.w);
    }
    return this.volAndPath.slice(0, this.volLen) + this.buf.slice(0, this.w).join("");
  }
}

// Split splits path immediately following the final Separator, separating it
// into directory and file components such that path = dir + file.
export function Split(path: string): [string, string] {
  const vol = VolumeName(path);
  let i = path.length - 1;
  while (i >= vol.length && !IsPathSeparator(path[i]!)) {
    i--;
  }
  return [path.slice(0, i + 1), path.slice(i + 1)];
}

// Ext returns the file name extension used by path: the suffix beginning at the
// final dot in the final path element; empty if there is no dot.
export function Ext(path: string): string {
  for (let i = path.length - 1; i >= 0 && !IsPathSeparator(path[i]!); i--) {
    if (path[i] === ".") {
      return path.slice(i);
    }
  }
  return "";
}

// Base returns the last element of path. Trailing separators are removed before
// extracting the last element. Empty path returns "."; all-separator path
// returns a single separator.
export function Base(path: string): string {
  if (path === "") {
    return ".";
  }
  // Strip trailing slashes.
  while (path.length > 0 && IsPathSeparator(path[path.length - 1]!)) {
    path = path.slice(0, path.length - 1);
  }
  // Throw away volume name.
  path = path.slice(VolumeName(path).length);
  // Find the last element.
  let i = path.length - 1;
  while (i >= 0 && !IsPathSeparator(path[i]!)) {
    i--;
  }
  if (i >= 0) {
    path = path.slice(i + 1);
  }
  // If empty now, it had only slashes.
  if (path === "") {
    return Separator;
  }
  return path;
}

// Dir returns all but the last element of path, typically the path's directory.
// After dropping the final element, Dir calls Clean and trailing slashes are
// removed. Empty path returns "."; all-separator path returns a single separator.
export function Dir(path: string): string {
  const vol = VolumeName(path);
  let i = path.length - 1;
  while (i >= vol.length && !IsPathSeparator(path[i]!)) {
    i--;
  }
  const dir = Clean(path.slice(vol.length, i + 1));
  if (dir === "." && vol.length > 2) {
    // must be UNC
    return vol;
  }
  return vol + dir;
}

// Join joins any number of path elements into a single path, separating them
// with Separator. Empty elements are ignored. The result is Cleaned. If the
// argument list is empty or all elements are empty, Join returns "".
// (path/filepath/path_unix.go)
export function Join(...elem: Array<string>): string {
  for (let i = 0; i < elem.length; i++) {
    if (elem[i] !== "") {
      return Clean(strings.Join(elem.slice(i), Separator));
    }
  }
  return "";
}

// sameWord compares path words (path_unix.go: plain equality).
const sameWord = (a: string, b: string): bool => a === b;

// countSeparators counts occurrences of Separator in s (bytealg.CountString).
const countSeparators = (s: string): int => {
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === Separator) {
      count++;
    }
  }
  return count;
};

// Rel returns a relative path that is lexically equivalent to targPath when
// joined to basePath with an intervening separator. Faithful port of
// path/filepath.Rel for Separator '/'. Errors are returned as a GoError.
export function Rel(basePath: string, targPath: string): [string, GoError] {
  const baseVol = VolumeName(basePath);
  const targVol = VolumeName(targPath);
  let base = Clean(basePath);
  const targ = Clean(targPath);
  if (sameWord(targ, base)) {
    return [".", undefined];
  }
  base = base.slice(baseVol.length);
  const targSlice = targ.slice(targVol.length);
  if (base === ".") {
    base = "";
  } else if (base === "" && VolumeNameLen(baseVol) > 2 /* isUNC */) {
    // Treat any targetpath matching `\\host\share` basePath as absolute path.
    base = Separator;
  }

  // Can't use IsAbs - `\a` and `a` are both relative in Windows.
  const baseSlashed = base.length > 0 && base[0] === Separator;
  const targSlashed = targSlice.length > 0 && targSlice[0] === Separator;
  if (baseSlashed !== targSlashed || !sameWord(baseVol, targVol)) {
    return ["", new globalThis.Error("Rel: can't make " + targPath + " relative to " + basePath)];
  }
  // Position base[b0:bi] and targ[t0:ti] at the first differing elements.
  const bl = base.length;
  const tl = targSlice.length;
  let b0 = 0;
  let bi = 0;
  let t0 = 0;
  let ti = 0;
  for (;;) {
    while (bi < bl && base[bi] !== Separator) {
      bi++;
    }
    while (ti < tl && targSlice[ti] !== Separator) {
      ti++;
    }
    if (!sameWord(targSlice.slice(t0, ti), base.slice(b0, bi))) {
      break;
    }
    if (bi < bl) {
      bi++;
    }
    if (ti < tl) {
      ti++;
    }
    b0 = bi;
    t0 = ti;
  }
  if (base.slice(b0, bi) === "..") {
    return ["", new globalThis.Error("Rel: can't make " + targPath + " relative to " + basePath)];
  }
  if (b0 !== bl) {
    // Base elements left. Must go up before going down.
    const seps = countSeparators(base.slice(b0, bl));
    const parts: Array<string> = [".."];
    for (let i = 0; i < seps; i++) {
      parts.push(Separator);
      parts.push("..");
    }
    if (t0 !== tl) {
      parts.push(Separator);
      parts.push(targSlice.slice(t0));
    }
    return [Clean(parts.join("")), undefined];
  }
  return [targSlice.slice(t0), undefined];
}

// SkipAll is the WalkDir sentinel return value indicating all remaining files
// and directories should be skipped. It is host-native (depends on io/fs).
export const SkipAll: GoError = new globalThis.Error("HOST-NATIVE go/path/filepath.SkipAll");

// Abs is host-native: it requires the process working directory (os.Getwd).
export function Abs(path: string): [string, GoError] {
  try {
    return [ToSlash(nodePath.resolve(path)), undefined];
  } catch (error) {
    return ["", error instanceof Error ? error : new globalThis.Error(String(error))];
  }
}

// EvalSymlinks is host-native: it requires filesystem access (readlink/lstat).
export function EvalSymlinks(path: string): [string, GoError] {
  try {
    return [ToSlash(nodeFs.realpathSync.native(path)), undefined];
  } catch (error) {
    return ["", error instanceof Error ? error : new globalThis.Error(String(error))];
  }
}

// Glob is host-native: it enumerates the filesystem.
export function Glob(_pattern: string): [GoSlice<string>, GoError] {
  throw new globalThis.Error("HOST-NATIVE go/path/filepath.Glob");
}

// WalkDir is host-native: it walks the filesystem tree.
export function WalkDir(_root: string, _fn: unknown): GoError {
  throw new globalThis.Error("HOST-NATIVE go/path/filepath.WalkDir");
}
