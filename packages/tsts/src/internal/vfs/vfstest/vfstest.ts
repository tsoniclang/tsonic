import type { bool, int } from "@tsonic/core/types.js";
import type { GoError, GoMap, GoPtr, GoSeq2, GoSlice } from "../../../go/compat.js";
import { AsType } from "../../../go/errors.js";
import { Sprintf, Errorf } from "../../../go/fmt.js";
import type { DirEntry, File, FileInfo, FileMode, FS as GoFS, ReadDirFile } from "../../../go/io/fs.js";
import { ErrNotExist, FileInfoToDirEntry, ModeDir, ModeSymlink } from "../../../go/io/fs.js";
import { RWMutex } from "../../../go/sync.js";
import type { MapFile, MapFS as MapFS_5332fda7 } from "../../../go/testing/fstest.js";
import { Now, Since, Time } from "../../../go/time.js";
import type { Duration } from "../../../go/time.js";
import type { RealpathFS, WritableFS } from "../iovfs/iofs.js";
import { From } from "../iovfs/iofs.js";
import type { FS } from "../vfs.js";
import { GetCanonicalFileName, IsRootedDiskPath, NormalizePath, PathIsAbsolute, RemoveTrailingDirectorySeparator } from "../../tspath/path.js";

// Internal runtime shape of a fstest.MapFile (opaque in the Go facade).
interface InternalMapFile {
  Data: Uint8Array;
  Mode: number;
  ModTime: Time;
  Sys: unknown;
}

// Internal runtime shape of a fstest.MapFS (opaque in the Go facade) = Map<string, InternalMapFile>.
type InternalMapFS = Map<string, InternalMapFile>;

// Internal runtime shape of a fs.FileInfo.
interface InternalFileInfo {
  Name(): string;
  Sys(): unknown;
  Mode(): number;
  IsDir(): bool;
  IsRegular(): bool;
}

// Internal runtime shape of a fs.File.
interface InternalFile {
  Stat(): [InternalFileInfo, GoError];
  Read(buffer: GoSlice<number>): [int, GoError];
  Close(): GoError;
}

// Internal runtime shape of a fs.ReadDirFile.
interface InternalReadDirFile extends InternalFile {
  ReadDir(n: int): [InternalDirEntry[], GoError];
}

// Internal runtime shape of a fs.DirEntry.
interface InternalDirEntry {
  Info(): [InternalFileInfo, GoError];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::type::MapFS","kind":"type","status":"implemented","sigHash":"6c94b2005c0abcef9d22a4886a0e069ad71049c8b5a935e0d5f83d1ada83ab57","bodyHash":"bb709e825decba5b85d9b274ba5504d03603336f4c9e9d3fb42ed2bd0edee950"}
 *
 * Go source:
 * MapFS struct {
 * 	// mu protects m.
 * 	// A single mutex is sufficient as we only use fstest.Map's Open method.
 * 	mu sync.RWMutex
 * 
 * 	// keys in m are canonicalPaths
 * 	m fstest.MapFS
 * 
 * 	useCaseSensitiveFileNames bool
 * 
 * 	symlinks map[canonicalPath]canonicalPath
 * 
 * 	clock Clock
 * }
 */
export interface MapFS {
  mu: RWMutex;
  m: MapFS_5332fda7;
  useCaseSensitiveFileNames: bool;
  symlinks: GoMap<canonicalPath, canonicalPath>;
  clock: Clock;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::type::Clock","kind":"type","status":"implemented","sigHash":"4ac06c2c3578215667c72f823065dc84e355d14e84a95b14fd5bd62839701ab9","bodyHash":"48dc298b4bcb2e460ae834e45480fdda95621240a428c7965105d5d45fa14b03"}
 *
 * Go source:
 * Clock interface {
 * 	Now() time.Time
 * 	SinceStart() time.Duration
 * }
 */
export interface Clock {
  Now(): Time;
  SinceStart(): Duration;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::type::clockImpl","kind":"type","status":"implemented","sigHash":"4f86d3efb63febf12658b4f015ec4117d518b308d08545c393fdb756e4e025a7","bodyHash":"bd5c6163824f9b56e503998c438305aad8855687d81aa8d5324712b40170abce"}
 *
 * Go source:
 * clockImpl struct {
 * 	start time.Time
 * }
 */
export interface clockImpl {
  start: Time;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::clockImpl.Now","kind":"method","status":"implemented","sigHash":"a951902e113d1268d038d6c7a2c0c34783436acd0106a0f7ff64826a670d2c10","bodyHash":"c7a92e8bd8322b4f7f309f1823b96a52f4660f8f13f5c796113059efc51571b9"}
 *
 * Go source:
 * func (c *clockImpl) Now() time.Time {
 * 	return time.Now()
 * }
 */
export function clockImpl_Now(receiver: GoPtr<clockImpl>): Time {
  return Now() as unknown as Time;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::clockImpl.SinceStart","kind":"method","status":"implemented","sigHash":"4bb1fe4ee9febe9b7eaf5ef71c8acbf82d6f5634f970c92d30c06181b5d93691","bodyHash":"656b3a008190a1c6a863361cc01aba6d91a312e495ab02f78b9bb1a38ab82c4d"}
 *
 * Go source:
 * func (c *clockImpl) SinceStart() time.Duration {
 * 	return time.Since(c.start)
 * }
 */
export function clockImpl_SinceStart(receiver: GoPtr<clockImpl>): Duration {
  return Since(receiver!.start) as unknown as Duration;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::varGroup::_+_","kind":"varGroup","status":"implemented","sigHash":"606a448813ea549ca7a41fa67189d5c616eb07aa6693c9028679d4b9a5b43602","bodyHash":"541a11433e2ff0c97212414e3dc5ebcbdc37e69ddcb8070b181b98fd12761cdd"}
 *
 * Go source:
 * var (
 * 	_ iovfs.RealpathFS = (*MapFS)(nil)
 * 	_ iovfs.WritableFS = (*MapFS)(nil)
 * )
 */
export let ____34464f57_0: RealpathFS = MapFS_as_iovfs_RealpathFS(undefined);
export let ____34464f57_1: WritableFS = MapFS_as_iovfs_WritableFS(undefined);

export function MapFS_as_io_fs_FS(receiver: GoPtr<MapFS>): GoFS {
  return {
    Open: (name: string): [File, GoError] => MapFS_Open(receiver, name),
  };
}

export function MapFS_as_iovfs_RealpathFS(receiver: GoPtr<MapFS>): RealpathFS {
  return {
    ...MapFS_as_io_fs_FS(receiver),
    Realpath: (path: string): [string, GoError] => MapFS_Realpath(receiver, path),
  };
}

export function MapFS_as_iovfs_WritableFS(receiver: GoPtr<MapFS>): WritableFS {
  return {
    ...MapFS_as_io_fs_FS(receiver),
    WriteFile: (path: string, data: string, perm: FileMode): GoError => MapFS_WriteFile(receiver, path, data, perm),
    AppendFile: (path: string, data: string, perm: FileMode): GoError => MapFS_AppendFile(receiver, path, data, perm),
    MkdirAll: (path: string, perm: FileMode): GoError => MapFS_MkdirAll(receiver, path, perm),
    Remove: (path: string): GoError => MapFS_Remove(receiver, path),
    Chtimes: (path: string, aTime: Time, mTime: Time): GoError => MapFS_Chtimes(receiver, path, aTime, mTime),
  };
}

function MapFS_as_iovfs_FS(receiver: GoPtr<MapFS>): GoFS & RealpathFS & WritableFS {
  return {
    ...MapFS_as_iovfs_RealpathFS(receiver),
    ...MapFS_as_iovfs_WritableFS(receiver),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::type::sys","kind":"type","status":"implemented","sigHash":"9643e898f78e27ee306cb9ad0c75737bc14358e54daba45c5da7585f2dc64feb","bodyHash":"272946b4766f48910da800b95c0bc83949f9b7cd9f504067f7e1c885f8038d1a"}
 *
 * Go source:
 * sys struct {
 * 	original any
 * 	realpath string
 * }
 */
export interface sys {
  original: unknown;
  realpath: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::func::FromMap","kind":"func","status":"implemented","sigHash":"e6f4b7684503c04f34b5dc11874c135c0aa0829c3e5f32703750c8e20bff1705","bodyHash":"f9ffe02001c6040065f85c08a647c7131838d4af18364311886fa3ea219d58d8"}
 *
 * Go source:
 * func FromMap[File any](m map[string]File, useCaseSensitiveFileNames bool) vfs.FS {
 * 	return FromMapWithClock(m, useCaseSensitiveFileNames, &clockImpl{start: time.Now()})
 * }
 */
export function FromMap<File>(m: GoMap<string, File>, useCaseSensitiveFileNames: bool): FS {
  const clockObj: clockImpl = { start: Now() as unknown as Time };
  return FromMapWithClock(m, useCaseSensitiveFileNames, {
    Now(): Time { return clockImpl_Now(clockObj); },
    SinceStart(): Duration { return clockImpl_SinceStart(clockObj); },
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::func::FromMapWithClock","kind":"func","status":"implemented","sigHash":"fbc52924438d85839ff9af691a2e378734168074cb9f039a54a26fcbcba459d8","bodyHash":"1409cdee2cf53b4873f7bac63b8da3a215f9e3fd23cc1ec24220aaf686dbba68"}
 *
 * Go source:
 * func FromMapWithClock[File any](m map[string]File, useCaseSensitiveFileNames bool, clock Clock) vfs.FS {
 * 	posix := false
 * 	windows := false
 *
 * 	checkPath := func(p string) {
 * 		if !tspath.IsRootedDiskPath(p) {
 * 			panic(fmt.Sprintf("non-rooted path %q", p))
 * 		}
 *
 * 		if normal := tspath.RemoveTrailingDirectorySeparator(tspath.NormalizePath(p)); normal != p {
 * 			panic(fmt.Sprintf("non-normalized path %q", p))
 * 		}
 *
 * 		if strings.HasPrefix(p, "/") {
 * 			posix = true
 * 		} else {
 * 			windows = true
 * 		}
 * 	}
 *
 * 	mfs := make(fstest.MapFS, len(m))
 * 	// Sorted creation to ensure times are always guaranteed to be in order.
 * 	keys := slices.Collect(maps.Keys(m))
 * 	slices.SortFunc(keys, comparePathsByParts)
 * 	for _, p := range keys {
 * 		f := m[p]
 * 		checkPath(p)
 *
 * 		var file *fstest.MapFile
 * 		switch f := any(f).(type) {
 * 		case string:
 * 			file = &fstest.MapFile{Data: []byte(f), ModTime: clock.Now()}
 * 		case []byte:
 * 			file = &fstest.MapFile{Data: f, ModTime: clock.Now()}
 * 		case *fstest.MapFile:
 * 			fCopy := *f
 * 			fCopy.ModTime = clock.Now()
 * 			file = &fCopy
 * 		default:
 * 			panic(fmt.Sprintf("invalid file type %T", f))
 * 		}
 *
 * 		if file.Mode&fs.ModeSymlink != 0 {
 * 			target := string(file.Data)
 * 			checkPath(target)
 *
 * 			target, _ = strings.CutPrefix(target, "/")
 * 			fileCopy := *file
 * 			fileCopy.Data = []byte(target)
 * 			file = &fileCopy
 * 		}
 *
 * 		p, _ = strings.CutPrefix(p, "/")
 * 		mfs[p] = file
 * 	}
 *
 * 	if posix && windows {
 * 		panic("mixed posix and windows paths")
 * 	}
 *
 * 	return iovfs.From(convertMapFS(mfs, useCaseSensitiveFileNames, clock), useCaseSensitiveFileNames)
 * }
 */
export function FromMapWithClock<File>(m: GoMap<string, File>, useCaseSensitiveFileNames: bool, clock: Clock): FS {
  let posix = false;
  let windows = false;

  const checkPath = (p: string): void => {
    if (!IsRootedDiskPath(p)) {
      throw new globalThis.Error(Sprintf("non-rooted path %q", p));
    }
    const normal = RemoveTrailingDirectorySeparator(NormalizePath(p));
    if (normal !== p) {
      throw new globalThis.Error(Sprintf("non-normalized path %q", p));
    }
    if (p.startsWith("/")) {
      posix = true;
    } else {
      windows = true;
    }
  };

  const mfs = new Map<string, InternalMapFile>();
  // Sorted creation to ensure times are always guaranteed to be in order.
  const keys = globalThis.Array.from(m.keys());
  keys.sort(comparePathsByParts);
  for (const p0 of keys) {
    let p = p0;
    const f = m.get(p) as unknown;
    checkPath(p);

    let file: InternalMapFile;
    if (typeof f === "string") {
      file = { Data: new TextEncoder().encode(f), Mode: 0, ModTime: clock.Now(), Sys: undefined };
    } else if (f instanceof Uint8Array) {
      file = { Data: f, Mode: 0, ModTime: clock.Now(), Sys: undefined };
    } else if (f !== null && typeof f === "object" && "Data" in f) {
      const fCopy = f as InternalMapFile;
      file = { Data: fCopy.Data, Mode: fCopy.Mode, ModTime: clock.Now(), Sys: fCopy.Sys };
    } else {
      throw new globalThis.Error(Sprintf("invalid file type %T", f));
    }

    if ((file.Mode & (ModeSymlink as unknown as number)) !== 0) {
      const target = new TextDecoder().decode(file.Data);
      checkPath(target);
      const cutTarget = target.startsWith("/") ? target.slice(1) : target;
      file = { Data: new TextEncoder().encode(cutTarget), Mode: file.Mode, ModTime: file.ModTime, Sys: file.Sys };
    }

    p = p.startsWith("/") ? p.slice(1) : p;
    mfs.set(p, file);
  }

  if (posix && windows) {
    throw new globalThis.Error("mixed posix and windows paths");
  }

  return From(MapFS_as_iovfs_FS(convertMapFS(mfs as unknown as MapFS_5332fda7, useCaseSensitiveFileNames, clock)), useCaseSensitiveFileNames);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::func::convertMapFS","kind":"func","status":"implemented","sigHash":"56142f9df215def3e07032885d4fd0913893bc80567bd7598853daba6abe4f5d","bodyHash":"90a2d9f373c6d40de03e6bb2c0cc20cb0689ea62c428fe904d4d6c28b4bc439a"}
 *
 * Go source:
 * func convertMapFS(input fstest.MapFS, useCaseSensitiveFileNames bool, clock Clock) *MapFS {
 * 	if clock == nil {
 * 		clock = &clockImpl{start: time.Now()}
 * 	}
 * 	m := &MapFS{
 * 		m:                         make(fstest.MapFS, len(input)),
 * 		useCaseSensitiveFileNames: useCaseSensitiveFileNames,
 * 		clock:                     clock,
 * 	}
 *
 * 	// Verify that the input is well-formed.
 * 	canonicalPaths := make(map[canonicalPath]string, len(input))
 * 	for path := range input {
 * 		canonical := m.getCanonicalPath(path)
 * 		if other, ok := canonicalPaths[canonical]; ok {
 * 			// Ensure consistent panic messages
 * 			path, other = min(path, other), max(path, other)
 * 			panic(fmt.Sprintf("duplicate path: %q and %q have the same canonical path", path, other))
 * 		}
 * 		canonicalPaths[canonical] = path
 * 	}
 *
 * 	// Sort the input by depth and path so we ensure parent dirs are created
 * 	// before their children, if explicitly specified by the input.
 * 	inputKeys := slices.Collect(maps.Keys(input))
 * 	slices.SortFunc(inputKeys, comparePathsByParts)
 *
 * 	for _, p := range inputKeys {
 * 		file := input[p]
 *
 * 		// Create all missing intermediate directories so we can attach the realpath to each of them.
 * 		// fstest.MapFS doesn't require this as it synthesizes directories on the fly, but it's a lot
 * 		// harder to reapply a realpath onto those when we're deep in some FileInfo method.
 * 		if dir := dirName(p); dir != "" {
 * 			if err := m.mkdirAll(dir, 0o777); err != nil {
 * 				panic(fmt.Sprintf("failed to create intermediate directories for %q: %v", p, err))
 * 			}
 * 		}
 * 		m.setEntry(p, m.getCanonicalPath(p), *file)
 * 	}
 *
 * 	return m
 * }
 */
export function convertMapFS(input: MapFS_5332fda7, useCaseSensitiveFileNames: bool, clock: Clock): GoPtr<MapFS> {
  const clockObj: clockImpl = { start: Now() as unknown as Time };
  const clockVal: Clock = (clock as unknown) !== undefined ? clock : {
    Now(): Time { return clockImpl_Now(clockObj); },
    SinceStart(): Duration { return clockImpl_SinceStart(clockObj); },
  };
  const m: MapFS = {
    mu: new RWMutex(),
    m: new Map<string, InternalMapFile>() as unknown as MapFS_5332fda7,
    useCaseSensitiveFileNames,
    symlinks: new Map<canonicalPath, canonicalPath>(),
    clock: clockVal,
  };

  const inputMap = input as unknown as InternalMapFS;

  // Verify that the input is well-formed.
  const canonicalPaths = new Map<canonicalPath, string>();
  for (const path0 of inputMap.keys()) {
    const canonical = MapFS_getCanonicalPath(m, path0);
    if (canonicalPaths.has(canonical)) {
      let pathVar = path0;
      let other = canonicalPaths.get(canonical)!;
      // Ensure consistent panic messages: min/max ordering
      if (pathVar > other) {
        const tmp = pathVar;
        pathVar = other;
        other = tmp;
      }
      throw new globalThis.Error(Sprintf("duplicate path: %q and %q have the same canonical path", pathVar, other));
    }
    canonicalPaths.set(canonical, path0);
  }

  // Sort the input by depth and path so we ensure parent dirs are created
  // before their children, if explicitly specified by the input.
  const inputKeys = globalThis.Array.from(inputMap.keys());
  inputKeys.sort(comparePathsByParts);

  for (const p of inputKeys) {
    const file = inputMap.get(p)!;

    // Create all missing intermediate directories
    const dir = dirName(p);
    if (dir !== "") {
      const err = MapFS_mkdirAll(m, dir, 0o777 as unknown as FileMode);
      if (err !== undefined) {
        throw new globalThis.Error(Sprintf("failed to create intermediate directories for %q: %v", p, err));
      }
    }
    MapFS_setEntry(m, p, MapFS_getCanonicalPath(m, p), file as unknown as MapFile);
  }

  return m;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::func::comparePathsByParts","kind":"func","status":"implemented","sigHash":"4586f6c031afbb8aacf39ed29d3647ec8bc10fc41e84007f92cee34a2668819a","bodyHash":"2a1b16bcb3893da55c2835856a091c9326675e99b3785998997d1f7f06a303a7"}
 *
 * Go source:
 * func comparePathsByParts(a, b string) int {
 * 	for {
 * 		aStart, aEnd, aOk := strings.Cut(a, "/")
 * 		bStart, bEnd, bOk := strings.Cut(b, "/")
 *
 * 		if !aOk || !bOk {
 * 			return strings.Compare(a, b)
 * 		}
 *
 * 		if r := strings.Compare(aStart, bStart); r != 0 {
 * 			return r
 * 		}
 *
 * 		a, b = aEnd, bEnd
 * 	}
 * }
 */
export function comparePathsByParts(a: string, b: string): int {
  let aVar = a;
  let bVar = b;
  for (;;) {
    const aSlash = aVar.indexOf("/");
    const bSlash = bVar.indexOf("/");
    const aOk = aSlash >= 0;
    const bOk = bSlash >= 0;

    if (!aOk || !bOk) {
      if (aVar < bVar) return -1;
      if (aVar > bVar) return 1;
      return 0;
    }

    const aStart = aVar.slice(0, aSlash);
    const bStart = bVar.slice(0, bSlash);
    let r: int;
    if (aStart < bStart) {
      r = -1;
    } else if (aStart > bStart) {
      r = 1;
    } else {
      r = 0;
    }
    if (r !== 0) {
      return r;
    }

    aVar = aVar.slice(aSlash + 1);
    bVar = bVar.slice(bSlash + 1);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::type::canonicalPath","kind":"type","status":"implemented","sigHash":"61d7bc3bb35db91324774f1830bfc2fd30aacec9994763b8a905e0cdf1e69f21","bodyHash":"cd15c3585bbafa104c0e20e7aabb8b4e16fdf3ac1b545984dab0f40ea4beae70"}
 *
 * Go source:
 * canonicalPath string
 */
export type canonicalPath = string;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.getCanonicalPath","kind":"method","status":"implemented","sigHash":"c64491157ec13675173e041c3550bf75cd51f4e934e0c0e74a035a45dc07df8e","bodyHash":"7f008344fb86ee1a7efa6f0d01994f1afe3df4cf87b40c013ae356b0b566fe33"}
 *
 * Go source:
 * func (m *MapFS) getCanonicalPath(p string) canonicalPath {
 * 	return canonicalPath(tspath.GetCanonicalFileName(p, m.useCaseSensitiveFileNames))
 * }
 */
export function MapFS_getCanonicalPath(receiver: GoPtr<MapFS>, p: string): canonicalPath {
  return GetCanonicalFileName(p, receiver!.useCaseSensitiveFileNames);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.open","kind":"method","status":"implemented","sigHash":"fa415d3349bbf5a6c21c7c294669f0bf3d9d212b756d19056ae997d1750f3b11","bodyHash":"d6be64eb8fbd7dcfa19ef3d28f2b56cc47fa3f68ae01166f42ea34343d4bc222"}
 *
 * Go source:
 * func (m *MapFS) open(p canonicalPath) (fs.File, error) {
 * 	return m.m.Open(string(p))
 * }
 */
export function MapFS_open(receiver: GoPtr<MapFS>, p: canonicalPath): [File, GoError] {
  const internalMap = receiver!.m as unknown as InternalMapFS;
  let file = internalMap.get(p);
  if (file === undefined) {
    // Go's fstest.MapFS synthesizes directories on the fly: opening "." (the root) or
    // any path that prefixes existing entries yields a directory file even without an
    // explicit map entry. convertMapFS creates intermediate directories explicitly, but
    // the root never gets an entry, so synthesize it here like the Go stdlib does.
    const isRoot = p === "." || p === "";
    const prefix = isRoot ? "" : `${p}/`;
    let isSyntheticDir = isRoot && internalMap.size > 0;
    if (!isSyntheticDir) {
      for (const key of internalMap.keys()) {
        if (key.startsWith(prefix)) {
          isSyntheticDir = true;
          break;
        }
      }
    }
    if (!isSyntheticDir) {
      return [undefined as unknown as File, ErrNotExist as unknown as GoError];
    }
    file = { Data: new Uint8Array(0), Mode: ModeDir as unknown as number, ModTime: undefined as never, Sys: undefined };
  }
  let offset = 0;
  const bytes = file.Data;
  // Build a synthetic fs.File backed by the internal map file.
  const fi: InternalFileInfo = {
    Name(): string { return baseName(p); },
    Sys(): unknown { return file.Sys; },
    Mode(): number { return file.Mode; },
    IsDir(): bool { return (file.Mode & (ModeDir as unknown as number)) !== 0; },
    IsRegular(): bool { return (file.Mode & ((ModeDir as unknown as number) | (ModeSymlink as unknown as number))) === 0; },
  };
  const f: InternalReadDirFile = {
    Stat(): [InternalFileInfo, GoError] { return [fi, undefined]; },
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
    ReadDir(_n: int): [InternalDirEntry[], GoError] {
      // fstest.MapFS uses "." for the root directory; its children carry bare keys.
      const prefix = p === "" || p === "." ? "" : p + "/";
      const entries: InternalDirEntry[] = [];
      for (const [k, v] of internalMap.entries()) {
        if (k !== p && k.startsWith(prefix) && k.slice(prefix.length).indexOf("/") < 0) {
          const entryFile = v;
          const entryName = k.slice(prefix.length);
          const entryFi: InternalFileInfo = {
            Name(): string { return entryName; },
            Sys(): unknown { return entryFile.Sys; },
            Mode(): number { return entryFile.Mode; },
            IsDir(): bool { return (entryFile.Mode & (ModeDir as unknown as number)) !== 0; },
            IsRegular(): bool { return (entryFile.Mode & ((ModeDir as unknown as number) | (ModeSymlink as unknown as number))) === 0; },
          };
          entries.push({
            Info(): [InternalFileInfo, GoError] { return [entryFi, undefined]; },
          });
        }
      }
      return [entries, undefined];
    },
  };
  return [f as unknown as File, undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.remove","kind":"method","status":"implemented","sigHash":"67bbbadae64dd3c27df584e31f46028086bd5a3a1aa5e848912aaed8e45a01e1","bodyHash":"53bf4e60e9e44186ca61503202b317c041f7b8e4e275ca55f157311a0dae133e"}
 *
 * Go source:
 * func (m *MapFS) remove(path string) error {
 * 	canonical := m.getCanonicalPath(path)
 * 	canonicalString := string(canonical)
 * 	fileInfo := m.m[canonicalString]
 * 	if fileInfo == nil {
 * 		// file does not exist
 * 		return nil
 * 	}
 * 	delete(m.m, canonicalString)
 * 	delete(m.symlinks, canonical)
 *
 * 	if fileInfo.Mode.IsDir() {
 * 		canonicalString += "/"
 * 		for path := range m.m {
 * 			if strings.HasPrefix(path, canonicalString) {
 * 				delete(m.m, path)
 * 				delete(m.symlinks, canonicalPath(path))
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function MapFS_remove(receiver: GoPtr<MapFS>, path: string): GoError {
  const canonical = MapFS_getCanonicalPath(receiver, path);
  const canonicalString = canonical;
  const internalMap = receiver!.m as unknown as InternalMapFS;
  const fileInfo = internalMap.get(canonicalString);
  if (fileInfo === undefined) {
    // file does not exist
    return undefined;
  }
  internalMap.delete(canonicalString);
  receiver!.symlinks.delete(canonical);

  if ((fileInfo.Mode & (ModeDir as unknown as number)) !== 0) {
    const prefix = canonicalString + "/";
    const keysToDelete: string[] = [];
    for (const p of internalMap.keys()) {
      if (p.startsWith(prefix)) {
        keysToDelete.push(p);
      }
    }
    for (const k of keysToDelete) {
      internalMap.delete(k);
      receiver!.symlinks.delete(k as canonicalPath);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::func::Symlink","kind":"func","status":"implemented","sigHash":"06bd580e51abf09138dc4dd1fbd2023e797f90a833daa61a84cfc832b78530ea","bodyHash":"fba1f84bad13305b179001bdaa47b1a47935024566a6f8bf015224b70536c779"}
 *
 * Go source:
 * func Symlink(target string) *fstest.MapFile {
 * 	return &fstest.MapFile{
 * 		Data: []byte(target),
 * 		Mode: fs.ModeSymlink,
 * 	}
 * }
 */
export function Symlink(target: string): GoPtr<MapFile> {
  const f: InternalMapFile = {
    Data: new TextEncoder().encode(target),
    Mode: ModeSymlink as unknown as number,
    ModTime: new Time(),
    Sys: undefined,
  };
  return f as unknown as MapFile;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.getFollowingSymlinks","kind":"method","status":"implemented","sigHash":"a5d60c7dc84a0ce7ca0820b32dac931d43ee946c53d65742f91efd79ff666bcb","bodyHash":"6f0a52a95df1647504520879ffa3139003860adc657379e0582384f58494194b"}
 *
 * Go source:
 * func (m *MapFS) getFollowingSymlinks(p canonicalPath) (*fstest.MapFile, canonicalPath, error) {
 * 	return m.getFollowingSymlinksWorker(p, "", "")
 * }
 */
export function MapFS_getFollowingSymlinks(receiver: GoPtr<MapFS>, p: canonicalPath): [GoPtr<MapFile>, canonicalPath, GoError] {
  return MapFS_getFollowingSymlinksWorker(receiver, p, "", "");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::type::brokenSymlinkError","kind":"type","status":"implemented","sigHash":"ebca66a1a5be05d7c8c0cb4edfd97b7a7be08e14bf72c368a461bea5e0c3259b","bodyHash":"bb96955116781aae2db99c0f6ef55c13e9de235ffca0b9e128a72e7a76ce9d2a"}
 *
 * Go source:
 * brokenSymlinkError struct {
 * 	from, to canonicalPath
 * }
 */
export interface brokenSymlinkError {
  "from": canonicalPath;
  to: canonicalPath;
}

// Concrete Error subclass so brokenSymlinkError values satisfy GoError and can be type-tested with AsType.
class BrokenSymlinkErrorImpl extends globalThis.Error implements brokenSymlinkError {
  readonly "from": canonicalPath;
  readonly to: canonicalPath;
  constructor(from: canonicalPath, to: canonicalPath) {
    super(Sprintf("broken symlink %q -> %q", from, to));
    this.name = "brokenSymlinkError";
    this.from = from;
    this.to = to;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::brokenSymlinkError.Error","kind":"method","status":"implemented","sigHash":"407d7038b42bb6585fd13107753d815b6483a419ddbac0aabef9b4ff9051a486","bodyHash":"01192f1a15d4a34bc66ae7919f2404f71112ac2eeb40306e1f0cbfd69391f491"}
 *
 * Go source:
 * func (e *brokenSymlinkError) Error() string {
 * 	return fmt.Sprintf("broken symlink %q -> %q", e.from, e.to)
 * }
 */
export function brokenSymlinkError_Error(receiver: GoPtr<brokenSymlinkError>): string {
  return Sprintf("broken symlink %q -> %q", receiver!.from, receiver!.to);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::func::isBrokenSymlinkError","kind":"func","status":"implemented","sigHash":"68145a7638ad45768fb135446948ad58531271295feda358137ea046bfdb2a36","bodyHash":"1281f47add5629d106a63834c52de8b6b8f30c936083e6fb03a619c59ee1fbc5"}
 *
 * Go source:
 * func isBrokenSymlinkError(err error) bool {
 * 	_, ok := errors.AsType[*brokenSymlinkError](err)
 * 	return ok
 * }
 */
export function isBrokenSymlinkError(err: GoError): bool {
  const [, ok] = AsType(err, (e): e is BrokenSymlinkErrorImpl & GoError => e instanceof BrokenSymlinkErrorImpl);
  return ok;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.getFollowingSymlinksWorker","kind":"method","status":"implemented","sigHash":"60092842c12cf88be7c72d98a052555257705b06c81df67f07d4654dbcf0de97","bodyHash":"5f831b6e9b8092fe19eb22891a034753397aeb58125764aa4fa3f007d7b0ae40"}
 *
 * Go source:
 * func (m *MapFS) getFollowingSymlinksWorker(p canonicalPath, symlinkFrom, symlinkTo canonicalPath) (*fstest.MapFile, canonicalPath, error) {
 * 	if file, ok := m.m[string(p)]; ok && file.Mode&fs.ModeSymlink == 0 {
 * 		return file, p, nil
 * 	}
 *
 * 	if target, ok := m.symlinks[p]; ok {
 * 		return m.getFollowingSymlinksWorker(target, p, target)
 * 	}
 *
 * 	// This could be a path underneath a symlinked directory.
 * 	for other, target := range m.symlinks {
 * 		if len(other) < len(p) && other == p[:len(other)] && p[len(other)] == '/' {
 * 			return m.getFollowingSymlinksWorker(target+p[len(other):], other, target)
 * 		}
 * 	}
 *
 * 	err := fs.ErrNotExist
 * 	if symlinkFrom != "" {
 * 		err = &brokenSymlinkError{symlinkFrom, symlinkTo}
 * 	}
 * 	return nil, p, err
 * }
 */
export function MapFS_getFollowingSymlinksWorker(receiver: GoPtr<MapFS>, p: canonicalPath, symlinkFrom: canonicalPath, symlinkTo: canonicalPath): [GoPtr<MapFile>, canonicalPath, GoError] {
  const internalMap = receiver!.m as unknown as InternalMapFS;
  const file = internalMap.get(p);
  if (file !== undefined && (file.Mode & (ModeSymlink as unknown as number)) === 0) {
    return [file as unknown as MapFile, p, undefined];
  }

  const target = receiver!.symlinks.get(p);
  if (target !== undefined) {
    return MapFS_getFollowingSymlinksWorker(receiver, target, p, target);
  }

  // This could be a path underneath a symlinked directory.
  for (const [other, symTarget] of receiver!.symlinks.entries()) {
    if (other.length < p.length && other === p.slice(0, other.length) && p[other.length] === "/") {
      return MapFS_getFollowingSymlinksWorker(receiver, (symTarget + p.slice(other.length)) as canonicalPath, other, symTarget);
    }
  }

  let err: GoError = ErrNotExist as unknown as GoError;
  if (symlinkFrom !== "") {
    err = new BrokenSymlinkErrorImpl(symlinkFrom, symlinkTo);
  }
  return [undefined, p, err];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.set","kind":"method","status":"implemented","sigHash":"edc43e97aacbec0eda73a7f057024320caabf6244e9e85217e3f998f79a1f301","bodyHash":"cd4127dcf71f7dbd88cc7a8138a585a186a733aa9329c4e6b62cb4ea8f07657d"}
 *
 * Go source:
 * func (m *MapFS) set(p canonicalPath, file *fstest.MapFile) {
 * 	m.m[string(p)] = file
 * }
 */
export function MapFS_set(receiver: GoPtr<MapFS>, p: canonicalPath, file: GoPtr<MapFile>): void {
  const internalMap = receiver!.m as unknown as InternalMapFS;
  internalMap.set(p, file as unknown as InternalMapFile);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.setEntry","kind":"method","status":"implemented","sigHash":"02e0dee11ac9a2b2c44e59390463c5b75c220165957b1ad03b93edc6a1df1030","bodyHash":"45d4474fdaceb8ee963265b6ada4f74dfe5ffcc9cac0de84b5c4bb327ebf9c3d"}
 *
 * Go source:
 * func (m *MapFS) setEntry(realpath string, canonical canonicalPath, file fstest.MapFile) {
 * 	if realpath == "" || canonical == "" {
 * 		panic("empty path")
 * 	}
 *
 * 	file.Sys = &sys{
 * 		original: file.Sys,
 * 		realpath: realpath,
 * 	}
 * 	m.set(canonical, &file)
 *
 * 	if file.Mode&fs.ModeSymlink != 0 {
 * 		if m.symlinks == nil {
 * 			m.symlinks = make(map[canonicalPath]canonicalPath)
 * 		}
 * 		m.symlinks[canonical] = m.getCanonicalPath(string(file.Data))
 * 	}
 * }
 */
export function MapFS_setEntry(receiver: GoPtr<MapFS>, realpath: string, canonical: canonicalPath, file: MapFile): void {
  if (realpath === "" || canonical === "") {
    throw new globalThis.Error("empty path");
  }
  const internalFile = file as unknown as InternalMapFile;
  const fileCopy: InternalMapFile = {
    Data: internalFile.Data,
    Mode: internalFile.Mode,
    ModTime: internalFile.ModTime,
    Sys: { original: internalFile.Sys, realpath } satisfies sys,
  };
  MapFS_set(receiver, canonical, fileCopy as unknown as MapFile);

  if ((fileCopy.Mode & (ModeSymlink as unknown as number)) !== 0) {
    if (receiver!.symlinks === undefined) {
      receiver!.symlinks = new Map<canonicalPath, canonicalPath>();
    }
    const dataStr = new TextDecoder().decode(fileCopy.Data);
    receiver!.symlinks.set(canonical, MapFS_getCanonicalPath(receiver, dataStr));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::func::splitPath","kind":"func","status":"implemented","sigHash":"b54a015d6087dd6c05976fb8aef71d74f67451da45151ef5cad13f8731c1e257","bodyHash":"daf170b847bc34373d71fde2241ccbdc6b7b9dab3b398c7cf5b0c07124487f81"}
 *
 * Go source:
 * func splitPath(s string, offset int) (before, after string) {
 * 	idx := strings.IndexByte(s[offset:], '/')
 * 	if idx < 0 {
 * 		return s, ""
 * 	}
 * 	return s[:idx+offset], s[idx+1+offset:]
 * }
 */
export function splitPath(s: string, offset: int): [string, string] {
  const idx = s.indexOf("/", offset);
  if (idx < 0) {
    return [s, ""];
  }
  return [s.slice(0, idx), s.slice(idx + 1)];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::func::dirName","kind":"func","status":"implemented","sigHash":"764574b3019172bba3c7eafc42f162a2d5d6a6b30a38ddab501da040b04c008a","bodyHash":"245a5bffbc069894062b65dc64765f4dba4556285526e1445e1917980eef04b7"}
 *
 * Go source:
 * func dirName(p string) string {
 * 	dir, _ := path.Split(p)
 * 	return strings.TrimSuffix(dir, "/")
 * }
 */
export function dirName(p: string): string {
  const lastSlash = p.lastIndexOf("/");
  if (lastSlash < 0) {
    return "";
  }
  const dir = p.slice(0, lastSlash + 1);
  // TrimSuffix(dir, "/")
  return dir.endsWith("/") ? dir.slice(0, dir.length - 1) : dir;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::func::baseName","kind":"func","status":"implemented","sigHash":"650eb2b039188773e1d4e455bca921cd4332bb440231ea759d99dcfd0b71776a","bodyHash":"f2112a35265ef7c9806cf78f70df5b5eaf0b08c283e67809eb245f3b308e148a"}
 *
 * Go source:
 * func baseName(p string) string {
 * 	_, file := path.Split(p)
 * 	return file
 * }
 */
export function baseName(p: string): string {
  const lastSlash = p.lastIndexOf("/");
  if (lastSlash < 0) {
    return p;
  }
  return p.slice(lastSlash + 1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.mkdirAll","kind":"method","status":"implemented","sigHash":"b9a5279891cb62f5f65fcef571a50858a19ce0a790157171402b865bb2d59c62","bodyHash":"25b4ff3221d6078c0e30253cd99bf37bb2fe7c192757b637f83921b3af68be1a"}
 *
 * Go source:
 * func (m *MapFS) mkdirAll(p string, perm fs.FileMode) error {
 * 	if p == "" {
 * 		panic("empty path")
 * 	}
 *
 * 	// Fast path; already exists.
 * 	if other, _, err := m.getFollowingSymlinks(m.getCanonicalPath(p)); err == nil {
 * 		if !other.Mode.IsDir() {
 * 			return fmt.Errorf("mkdir %q: path exists but is not a directory", p)
 * 		}
 * 		return nil
 * 	}
 *
 * 	var toCreate []string
 * 	offset := 0
 * 	for {
 * 		dir, rest := splitPath(p, offset)
 * 		canonical := m.getCanonicalPath(dir)
 * 		other, otherPath, err := m.getFollowingSymlinks(canonical)
 * 		if err != nil {
 * 			if !errors.Is(err, fs.ErrNotExist) {
 * 				return err
 * 			}
 * 			toCreate = append(toCreate, dir)
 * 		} else {
 * 			if !other.Mode.IsDir() {
 * 				return fmt.Errorf("mkdir %q: path exists but is not a directory", otherPath)
 * 			}
 * 			if canonical != otherPath {
 * 				// We have a symlinked parent, reset and start again.
 * 				p = other.Sys.(*sys).realpath + "/" + rest
 * 				toCreate = toCreate[:0]
 * 				offset = 0
 * 				continue
 * 			}
 * 		}
 * 		if rest == "" {
 * 			break
 * 		}
 * 		offset = len(dir) + 1
 * 	}
 *
 * 	for _, dir := range toCreate {
 * 		m.setEntry(dir, m.getCanonicalPath(dir), fstest.MapFile{
 * 			Mode:    fs.ModeDir | perm&^umask,
 * 			ModTime: m.clock.Now(),
 * 		})
 * 	}
 *
 * 	return nil
 * }
 */
export function MapFS_mkdirAll(receiver: GoPtr<MapFS>, p: string, perm: FileMode): GoError {
  if (p === "") {
    throw new globalThis.Error("empty path");
  }

  // Fast path; already exists.
  const [fastOther, , fastErr] = MapFS_getFollowingSymlinks(receiver, MapFS_getCanonicalPath(receiver, p));
  if (fastErr === undefined) {
    const fastFile = fastOther as unknown as InternalMapFile;
    if ((fastFile.Mode & (ModeDir as unknown as number)) === 0) {
      return Errorf("mkdir %q: path exists but is not a directory", p);
    }
    return undefined;
  }

  const toCreate: string[] = [];
  let pVar = p;
  let offset = 0;
  for (;;) {
    const [dir, rest] = splitPath(pVar, offset);
    const canonical = MapFS_getCanonicalPath(receiver, dir);
    const [other, otherPath, err] = MapFS_getFollowingSymlinks(receiver, canonical);
    if (err !== undefined) {
      // Check if it's ErrNotExist - compare by identity or message
      if (err !== (ErrNotExist as unknown as GoError) && err.message !== (ErrNotExist as unknown as { message?: string })?.message) {
        return err;
      }
      toCreate.push(dir);
    } else {
      const otherFile = other as unknown as InternalMapFile;
      if ((otherFile.Mode & (ModeDir as unknown as number)) === 0) {
        return Errorf("mkdir %q: path exists but is not a directory", otherPath);
      }
      if (canonical !== otherPath) {
        // We have a symlinked parent, reset and start again.
        const sysData = otherFile.Sys as sys;
        pVar = sysData.realpath + "/" + rest;
        toCreate.length = 0;
        offset = 0;
        continue;
      }
    }
    if (rest === "") {
      break;
    }
    offset = dir.length + 1;
  }

  for (const dirToCreate of toCreate) {
    const dirFile: InternalMapFile = {
      Data: new Uint8Array(0),
      Mode: (ModeDir as unknown as number) | ((perm as unknown as number) & ~umask),
      ModTime: receiver!.clock.Now(),
      Sys: undefined,
    };
    MapFS_setEntry(receiver, dirToCreate, MapFS_getCanonicalPath(receiver, dirToCreate), dirFile as unknown as MapFile);
  }

  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::type::fileInfo","kind":"type","status":"implemented","sigHash":"faa9b0357889cb408ff2e938cc4e7f875987a9454f9d36a1c5d4d1b821973e4c","bodyHash":"2e0bfefd6c28e47790e27a51c4e10310649624cdfad9b72519288fa955c3072f"}
 *
 * Go source:
 * fileInfo struct {
 * 	fs.FileInfo
 * 	sys      any
 * 	realpath string
 * }
 */
export interface fileInfo {
  readonly __tsgoEmbedded0?: FileInfo;
  sys: unknown;
  realpath: string;
  Name(): string;
  Size(): int;
  Mode(): FileMode;
  ModTime(): Date;
  IsDir(): bool;
  Sys(): unknown;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::fileInfo.Name","kind":"method","status":"implemented","sigHash":"d69e71b95abc2221c07d0623044cc610a96870cbd335f1136939d8529c7141bd","bodyHash":"304d534ea8c2223006aa543a8b24652d58471dd85eed579b6c545f5d3c3d70cb"}
 *
 * Go source:
 * func (fi *fileInfo) Name() string {
 * 	return baseName(fi.realpath)
 * }
 */
export function fileInfo_Name(receiver: GoPtr<fileInfo>): string {
  return baseName(receiver!.realpath);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::fileInfo.Sys","kind":"method","status":"implemented","sigHash":"1ec93078d669789ba7f6751ba05c91294f7e23794ffe4e6e571826b386756bef","bodyHash":"febaa0b744f2fbca3dbc12c537b80d52b2012a732dbaa9f4b1659cc0766c4ec0"}
 *
 * Go source:
 * func (fi *fileInfo) Sys() any {
 * 	return fi.sys
 * }
 */
export function fileInfo_Sys(receiver: GoPtr<fileInfo>): unknown {
  return receiver!.sys;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::type::file","kind":"type","status":"implemented","sigHash":"daaad1169872972388df5d5272a4b8cb79e411706b30d17017d24f615b082832","bodyHash":"f297c6d65a8894f54d5ea81196bcff4176b8f09a3b869027a678cbe0b1d3286d"}
 *
 * Go source:
 * file struct {
 * 	fs.File
 * 	fileInfo *fileInfo
 * }
 */
export interface file {
  readonly __tsgoEmbedded0?: File;
  fileInfo: GoPtr<fileInfo>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::file.Stat","kind":"method","status":"implemented","sigHash":"51cf8cee71cbfd6f3fd192f75f334f40b079ecf916cc72fd9dbd7872668bf6ed","bodyHash":"4d604d90b09098cf5cb2df348be23596450fe7a587392fba4a6ef806c9b65c44"}
 *
 * Go source:
 * func (f *file) Stat() (fs.FileInfo, error) {
 * 	return f.fileInfo, nil
 * }
 */
export function file_Stat(receiver: GoPtr<file>): [FileInfo, GoError] {
  return [receiver!.fileInfo as unknown as FileInfo, undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::type::readDirFile","kind":"type","status":"implemented","sigHash":"45fde7ad396c60accf3165338847b2cd69fb9058d7b34ec47a031ec1904238c8","bodyHash":"45a536f37fec0b0b53d1b7385230eaa8388c8609b507858afa1b0633fb2d55c5"}
 *
 * Go source:
 * readDirFile struct {
 * 	fs.ReadDirFile
 * 	fileInfo *fileInfo
 * }
 */
export interface readDirFile {
  readonly __tsgoEmbedded0?: ReadDirFile;
  fileInfo: GoPtr<fileInfo>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::readDirFile.Stat","kind":"method","status":"implemented","sigHash":"4928aa4cac42b5cb417610579c9428230c3fdf40077038c9405f6add5435cd2b","bodyHash":"fb1106c69bb4cdb9240841b7b58c92df6e79cbe693ace3ff47325ddc96dd6450"}
 *
 * Go source:
 * func (f *readDirFile) Stat() (fs.FileInfo, error) {
 * 	return f.fileInfo, nil
 * }
 */
export function readDirFile_Stat(receiver: GoPtr<readDirFile>): [FileInfo, GoError] {
  return [receiver!.fileInfo as unknown as FileInfo, undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::readDirFile.ReadDir","kind":"method","status":"implemented","sigHash":"c1888b32caa44315c3a9cf0848b9651d7acc04f63653a58f24ef17de9b7c7476","bodyHash":"95b94337aa40c9a0616fc3590dc4da8bfc77443f4aebe1d10d9a6fa5c940510c"}
 *
 * Go source:
 * func (f *readDirFile) ReadDir(n int) ([]fs.DirEntry, error) {
 * 	list, err := f.ReadDirFile.ReadDir(n)
 * 	if err != nil {
 * 		return nil, err
 * 	}
 *
 * 	entries := make([]fs.DirEntry, len(list))
 * 	for i, entry := range list {
 * 		info := must(entry.Info())
 * 		newInfo, ok := convertInfo(info)
 * 		if !ok {
 * 			panic(fmt.Sprintf("unexpected synthesized dir: %q", info.Name()))
 * 		}
 * 		entries[i] = fs.FileInfoToDirEntry(newInfo)
 * 	}
 *
 * 	return entries, nil
 * }
 */
export function readDirFile_ReadDir(receiver: GoPtr<readDirFile>, n: int): [GoSlice<DirEntry>, GoError] {
  const embedded = receiver!.__tsgoEmbedded0 as unknown as InternalReadDirFile;
  const [list, err] = embedded.ReadDir(n);
  if (err !== undefined) {
    return [[], err];
  }

  const entries: DirEntry[] = new globalThis.Array(list.length);
  for (let i = 0; i < list.length; i++) {
    const entry = list[i]!;
    const [infoVal, infoErr] = entry.Info();
    const info = must(infoVal as unknown as FileInfo, infoErr as unknown as GoError);
    const [newInfo, ok] = convertInfo(info);
    if (!ok) {
      const infoInternal = info as unknown as InternalFileInfo;
      throw new globalThis.Error(Sprintf("unexpected synthesized dir: %q", infoInternal.Name()));
    }
    entries[i] = FileInfoToDirEntry(newInfo) as unknown as DirEntry;
  }

  return [entries, undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.Open","kind":"method","status":"implemented","sigHash":"07b3ba9f92bc1fc7a16b73e29e7a31e1f899074798c70ad11a0de5842973ee72","bodyHash":"27808be6e686a2282e16e72e1e67fd7f23610e05fedc5a12910290dd13b0c504"}
 *
 * Go source:
 * func (m *MapFS) Open(name string) (fs.File, error) {
 * 	m.mu.RLock()
 * 	defer m.mu.RUnlock()
 *
 * 	_, cp, _ := m.getFollowingSymlinks(m.getCanonicalPath(name))
 * 	f, err := m.open(cp)
 * 	if err != nil {
 * 		return nil, err
 * 	}
 *
 * 	info := must(f.Stat())
 *
 * 	newInfo, ok := convertInfo(info)
 * 	if !ok {
 * 		// This is a synthesized dir.
 * 		if name != "." {
 * 			panic(fmt.Sprintf("unexpected synthesized dir: %q", name))
 * 		}
 *
 * 		return &readDirFile{
 * 			ReadDirFile: f.(fs.ReadDirFile),
 * 			fileInfo: &fileInfo{
 * 				FileInfo: info,
 * 				sys:      info.Sys(),
 * 				realpath: ".",
 * 			},
 * 		}, nil
 * 	}
 *
 * 	if f, ok := f.(fs.ReadDirFile); ok {
 * 		return &readDirFile{
 * 			ReadDirFile: f,
 * 			fileInfo:    newInfo,
 * 		}, nil
 * 	}
 *
 * 	return &file{
 * 		File:     f,
 * 		fileInfo: newInfo,
 * 	}, nil
 * }
 */
export function MapFS_Open(receiver: GoPtr<MapFS>, name: string): [File, GoError] {
  receiver!.mu.RLock();
  try {
    const [, cp] = MapFS_getFollowingSymlinks(receiver, MapFS_getCanonicalPath(receiver, name));
    const [f, err] = MapFS_open(receiver, cp);
    if (err !== undefined) {
      return [undefined as unknown as File, err];
    }

    const internalF = f as unknown as InternalFile;
    const [statVal, statErr] = internalF.Stat();
    const info = must(statVal as unknown as FileInfo, statErr as unknown as GoError);
    const infoForConvert = info as unknown as FileInfo;

    const [newInfo, ok] = convertInfo(infoForConvert);
    if (!ok) {
      // This is a synthesized dir.
      if (name !== ".") {
        throw new globalThis.Error(Sprintf("unexpected synthesized dir: %q", name));
      }
      const internalInfo = info as unknown as InternalFileInfo;
      const fileInfoResult = makeFileInfo(infoForConvert, internalInfo.Sys(), ".");
      const rdfResult: readDirFile & ReadDirFile = {
        __tsgoEmbedded0: f as unknown as ReadDirFile,
        fileInfo: fileInfoResult,
        Stat: (): [FileInfo, GoError] => readDirFile_Stat(rdfResult),
        Read: (buffer: GoSlice<number>): [int, GoError] => (f as unknown as File).Read(buffer),
        Close: (): GoError => (f as unknown as File).Close(),
        ReadDir: (n: int): [GoSlice<DirEntry>, GoError] => readDirFile_ReadDir(rdfResult, n),
      };
      return [rdfResult as unknown as File, undefined];
    }

    // Check if f is a ReadDirFile (has ReadDir method)
    const internalRdf = f as unknown as Partial<InternalReadDirFile>;
    if (typeof internalRdf.ReadDir === "function") {
      const rdfResult: readDirFile & ReadDirFile = {
        __tsgoEmbedded0: f as unknown as ReadDirFile,
        fileInfo: newInfo!,
        Stat: (): [FileInfo, GoError] => readDirFile_Stat(rdfResult),
        Read: (buffer: GoSlice<number>): [int, GoError] => (f as unknown as File).Read(buffer),
        Close: (): GoError => (f as unknown as File).Close(),
        ReadDir: (n: int): [GoSlice<DirEntry>, GoError] => readDirFile_ReadDir(rdfResult, n),
      };
      return [rdfResult as unknown as File, undefined];
    }

    const fileResult: file & File = {
      __tsgoEmbedded0: f,
      fileInfo: newInfo!,
      Stat: (): [FileInfo, GoError] => file_Stat(fileResult),
      Read: (buffer: GoSlice<number>): [int, GoError] => (f as unknown as File).Read(buffer),
      Close: (): GoError => (f as unknown as File).Close(),
    };
    return [fileResult as unknown as File, undefined];
  } finally {
    receiver!.mu.RUnlock();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.Realpath","kind":"method","status":"implemented","sigHash":"3314a390c734f8b8403530195bcd261f336d530ffa859a238e3bc0ce480767e5","bodyHash":"ea7a3310836393eba50dc238ddc0485b3089e5de53896223df7092367c26d7fd"}
 *
 * Go source:
 * func (m *MapFS) Realpath(name string) (string, error) {
 * 	m.mu.RLock()
 * 	defer m.mu.RUnlock()
 *
 * 	file, _, err := m.getFollowingSymlinks(m.getCanonicalPath(name))
 * 	if err != nil {
 * 		return "", err
 * 	}
 * 	return file.Sys.(*sys).realpath, nil
 * }
 */
export function MapFS_Realpath(receiver: GoPtr<MapFS>, name: string): [string, GoError] {
  receiver!.mu.RLock();
  try {
    const [file, , err] = MapFS_getFollowingSymlinks(receiver, MapFS_getCanonicalPath(receiver, name));
    if (err !== undefined) {
      return ["", err];
    }
    const internalFile = file as unknown as InternalMapFile;
    const sysData = internalFile.Sys as sys;
    return [sysData.realpath, undefined];
  } finally {
    receiver!.mu.RUnlock();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::func::convertInfo","kind":"func","status":"implemented","sigHash":"4229cbddc4370f6d072bacec72aed9dfdf6cdaaa2a923e17cac136efe9d9d2df","bodyHash":"8ee4e96db5351dad9ce06c1e5a16e644fbca5629f1fc1dcb12028e402b22f2db"}
 *
 * Go source:
 * func convertInfo(info fs.FileInfo) (*fileInfo, bool) {
 * 	sys, ok := info.Sys().(*sys)
 * 	if !ok {
 * 		return nil, false
 * 	}
 * 	return &fileInfo{
 * 		FileInfo: info,
 * 		sys:      sys.original,
 * 		realpath: sys.realpath,
 * 	}, true
 * }
 */
export function convertInfo(info: FileInfo): [GoPtr<fileInfo>, bool] {
  const internalInfo = info as unknown as InternalFileInfo;
  const sysVal = internalInfo.Sys();
  // Check if sysVal is a sys (has realpath and original fields)
  if (sysVal === null || sysVal === undefined || typeof sysVal !== "object") {
    return [undefined, false];
  }
  const sysObj = sysVal as Partial<sys>;
  if (!("realpath" in sysObj)) {
    return [undefined, false];
  }
  const typedSys = sysObj as sys;
  return [makeFileInfo(info, typedSys.original, typedSys.realpath), true];
}

function makeFileInfo(info: FileInfo, sysValue: unknown, realpath: string): fileInfo {
  const result: fileInfo = {
    __tsgoEmbedded0: info,
    sys: sysValue,
    realpath,
    Name: (): string => fileInfo_Name(result),
    Size: (): int => info.Size(),
    Mode: (): FileMode => info.Mode(),
    ModTime: (): Date => info.ModTime(),
    IsDir: (): bool => info.IsDir(),
    Sys: (): unknown => fileInfo_Sys(result),
  };
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::constGroup::umask","kind":"constGroup","status":"implemented","sigHash":"6739de9433325eaa175a2f30d6eb401f8015e3697df32c2f0ffaf9b2f9ed814a","bodyHash":"ba93dc3ade17357e673f4409cecb6146ff3a1e8170db2affbc0b7997d0c37333"}
 *
 * Go source:
 * const umask = 0o022
 */
export const umask: int = 0o022;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.MkdirAll","kind":"method","status":"implemented","sigHash":"f2b6b949f089389a7a054c1d991acbc12bca625ec88d5751be7485d3f5de88d2","bodyHash":"e4c81e7166a9798fc8d6f6b944f7d8dba53efbbbf5fe9d89daff65a809885f6b"}
 *
 * Go source:
 * func (m *MapFS) MkdirAll(path string, perm fs.FileMode) error {
 * 	m.mu.Lock()
 * 	defer m.mu.Unlock()
 *
 * 	return m.mkdirAll(path, perm)
 * }
 */
export function MapFS_MkdirAll(receiver: GoPtr<MapFS>, path: string, perm: FileMode): GoError {
  receiver!.mu.Lock();
  try {
    return MapFS_mkdirAll(receiver, path, perm);
  } finally {
    receiver!.mu.Unlock();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.AddSymlink","kind":"method","status":"implemented","sigHash":"6dfff83751285b2554e3af5e365c57f4cf0bcbd1b807c3a7903d4d0a91f947e2","bodyHash":"6a4ff8ffbab44a91d89fdb0ee97029bf405c814559c8301025a14d6d563f06b8"}
 *
 * Go source:
 * func (m *MapFS) AddSymlink(path string, target string) {
 * 	m.mu.Lock()
 * 	defer m.mu.Unlock()
 *
 * 	canonical := m.getCanonicalPath(path)
 * 	m.setEntry(path, canonical, fstest.MapFile{
 * 		Data: []byte(target),
 * 		Mode: fs.ModeSymlink,
 * 	})
 * }
 */
export function MapFS_AddSymlink(receiver: GoPtr<MapFS>, path: string, target: string): void {
  receiver!.mu.Lock();
  try {
    const canonical = MapFS_getCanonicalPath(receiver, path);
    const f: InternalMapFile = {
      Data: new TextEncoder().encode(target),
      Mode: ModeSymlink as unknown as number,
      ModTime: new Time(),
      Sys: undefined,
    };
    MapFS_setEntry(receiver, path, canonical, f as unknown as MapFile);
  } finally {
    receiver!.mu.Unlock();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.WriteFile","kind":"method","status":"implemented","sigHash":"5658182b998150c8bf197a0d6d02cf5a2bf07cbf69d200725ade1330ec76b4bf","bodyHash":"17ad77bccc095c2e5f15fc8332672b765f79ae317c38bfb7d89f3487455d78d8"}
 *
 * Go source:
 * func (m *MapFS) WriteFile(path string, data string, perm fs.FileMode) error {
 * 	m.mu.Lock()
 * 	defer m.mu.Unlock()
 *
 * 	if parent := dirName(path); parent != "" {
 * 		canonical := m.getCanonicalPath(parent)
 * 		parentFile, _, err := m.getFollowingSymlinks(canonical)
 * 		if err != nil {
 * 			return fmt.Errorf("write %q: %w", path, err)
 * 		}
 * 		if !parentFile.Mode.IsDir() {
 * 			return fmt.Errorf("write %q: parent path exists but is not a directory", path)
 * 		}
 * 	}
 *
 * 	file, cp, err := m.getFollowingSymlinks(m.getCanonicalPath(path))
 * 	if err != nil {
 * 		if !errors.Is(err, fs.ErrNotExist) && !isBrokenSymlinkError(err) {
 * 			// No other errors are possible.
 * 			panic(err)
 * 		}
 * 	} else {
 * 		if !file.Mode.IsRegular() {
 * 			return fmt.Errorf("write %q: path exists but is not a regular file", path)
 * 		}
 * 	}
 *
 * 	m.setEntry(path, cp, fstest.MapFile{
 * 		Data:    unsafe.Slice(unsafe.StringData(data), len(data)),
 * 		ModTime: m.clock.Now(),
 * 		Mode:    perm &^ umask,
 * 	})
 *
 * 	return nil
 * }
 */
export function MapFS_WriteFile(receiver: GoPtr<MapFS>, path: string, data: string, perm: FileMode): GoError {
  receiver!.mu.Lock();
  try {
    const parent = dirName(path);
    if (parent !== "") {
      const canonical = MapFS_getCanonicalPath(receiver, parent);
      const [parentFile, , parentErr] = MapFS_getFollowingSymlinks(receiver, canonical);
      if (parentErr !== undefined) {
        return Errorf("write %q: %w", path, parentErr);
      }
      const parentInternal = parentFile as unknown as InternalMapFile;
      if ((parentInternal.Mode & (ModeDir as unknown as number)) === 0) {
        return Errorf("write %q: parent path exists but is not a directory", path);
      }
    }

    const [file, cp, err] = MapFS_getFollowingSymlinks(receiver, MapFS_getCanonicalPath(receiver, path));
    if (err !== undefined) {
      if (err !== (ErrNotExist as unknown as GoError) && !isBrokenSymlinkError(err)) {
        // No other errors are possible.
        throw err;
      }
    } else {
      const fileInternal = file as unknown as InternalMapFile;
      if ((fileInternal.Mode & ((ModeDir as unknown as number) | (ModeSymlink as unknown as number))) !== 0) {
        return Errorf("write %q: path exists but is not a regular file", path);
      }
    }

    const newFile: InternalMapFile = {
      Data: new TextEncoder().encode(data),
      ModTime: receiver!.clock.Now(),
      Mode: (perm as unknown as number) & ~umask,
      Sys: undefined,
    };
    MapFS_setEntry(receiver, path, cp, newFile as unknown as MapFile);

    return undefined;
  } finally {
    receiver!.mu.Unlock();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.AppendFile","kind":"method","status":"implemented","sigHash":"03f75a6c125c1736653a20aa84f386c3ce7efca70484843631634f8c2986d849","bodyHash":"78b4ecb8d7063a628ab8a4959b752964720c246ea72668b7972db32b8ea4ea7d"}
 *
 * Go source:
 * func (m *MapFS) AppendFile(path string, data string, perm fs.FileMode) error {
 * 	m.mu.Lock()
 * 	defer m.mu.Unlock()
 *
 * 	if parent := dirName(path); parent != "" {
 * 		canonical := m.getCanonicalPath(parent)
 * 		parentFile, _, err := m.getFollowingSymlinks(canonical)
 * 		if err != nil {
 * 			return fmt.Errorf("append %q: %w", path, err)
 * 		}
 * 		if !parentFile.Mode.IsDir() {
 * 			return fmt.Errorf("append %q: parent path exists but is not a directory", path)
 * 		}
 * 	}
 *
 * 	var existing []byte
 * 	var existingMode fs.FileMode
 * 	file, cp, err := m.getFollowingSymlinks(m.getCanonicalPath(path))
 * 	if err != nil {
 * 		if !errors.Is(err, fs.ErrNotExist) && !isBrokenSymlinkError(err) {
 * 			// No other errors are possible.
 * 			panic(err)
 * 		}
 * 	} else {
 * 		if !file.Mode.IsRegular() {
 * 			return fmt.Errorf("append %q: path exists but is not a regular file", path)
 * 		}
 * 		existing = file.Data
 * 		existingMode = file.Mode
 * 	}
 *
 * 	combined := make([]byte, 0, len(existing)+len(data))
 * 	combined = append(combined, existing...)
 * 	combined = append(combined, data...)
 *
 * 	mode := existingMode
 * 	if mode == 0 {
 * 		mode = perm &^ umask
 * 	}
 *
 * 	m.setEntry(path, cp, fstest.MapFile{
 * 		Data:    combined,
 * 		ModTime: m.clock.Now(),
 * 		Mode:    mode,
 * 	})
 *
 * 	return nil
 * }
 */
export function MapFS_AppendFile(receiver: GoPtr<MapFS>, path: string, data: string, perm: FileMode): GoError {
  receiver!.mu.Lock();
  try {
    const parent = dirName(path);
    if (parent !== "") {
      const canonical = MapFS_getCanonicalPath(receiver, parent);
      const [parentFile, , parentErr] = MapFS_getFollowingSymlinks(receiver, canonical);
      if (parentErr !== undefined) {
        return Errorf("append %q: %w", path, parentErr);
      }
      const parentInternal = parentFile as unknown as InternalMapFile;
      if ((parentInternal.Mode & (ModeDir as unknown as number)) === 0) {
        return Errorf("append %q: parent path exists but is not a directory", path);
      }
    }

    let existing: Uint8Array = new Uint8Array(0);
    let existingMode: number = 0;
    const [file, cp, err] = MapFS_getFollowingSymlinks(receiver, MapFS_getCanonicalPath(receiver, path));
    if (err !== undefined) {
      if (err !== (ErrNotExist as unknown as GoError) && !isBrokenSymlinkError(err)) {
        // No other errors are possible.
        throw err;
      }
    } else {
      const fileInternal = file as unknown as InternalMapFile;
      if ((fileInternal.Mode & ((ModeDir as unknown as number) | (ModeSymlink as unknown as number))) !== 0) {
        return Errorf("append %q: path exists but is not a regular file", path);
      }
      existing = fileInternal.Data;
      existingMode = fileInternal.Mode;
    }

    const dataBytes = new TextEncoder().encode(data);
    const combined = new Uint8Array(existing.length + dataBytes.length);
    combined.set(existing, 0);
    combined.set(dataBytes, existing.length);

    let mode = existingMode;
    if (mode === 0) {
      mode = (perm as unknown as number) & ~umask;
    }

    const newFile: InternalMapFile = {
      Data: combined,
      ModTime: receiver!.clock.Now(),
      Mode: mode,
      Sys: undefined,
    };
    MapFS_setEntry(receiver, path, cp, newFile as unknown as MapFile);

    return undefined;
  } finally {
    receiver!.mu.Unlock();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.Remove","kind":"method","status":"implemented","sigHash":"47e9f80b9077489068995cfd673a0d4fa4a7a90a824a2dd7ea2165303da6e68c","bodyHash":"de91b60176ed11eabcb16fb61e3e49914450cca16d10dece7ddd4dc32e4ce716"}
 *
 * Go source:
 * func (m *MapFS) Remove(path string) error {
 * 	m.mu.Lock()
 * 	defer m.mu.Unlock()
 *
 * 	return m.remove(path)
 * }
 */
export function MapFS_Remove(receiver: GoPtr<MapFS>, path: string): GoError {
  receiver!.mu.Lock();
  try {
    return MapFS_remove(receiver, path);
  } finally {
    receiver!.mu.Unlock();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.Chtimes","kind":"method","status":"implemented","sigHash":"ecab499d0f13c889cbbd9b07cb471252d16a623c34e1f3782de0204c52484be1","bodyHash":"b5800a62591bbf2e823e6090449f9976a30b4b87738fb54a6e6907648d532088"}
 *
 * Go source:
 * func (m *MapFS) Chtimes(path string, aTime time.Time, mTime time.Time) error {
 * 	m.mu.Lock()
 * 	defer m.mu.Unlock()
 * 	canonical := m.getCanonicalPath(path)
 * 	canonicalString := string(canonical)
 * 	fileInfo := m.m[canonicalString]
 * 	if fileInfo == nil {
 * 		// file does not exist
 * 		return fs.ErrNotExist
 * 	}
 * 	fileInfo.ModTime = mTime
 * 	return nil
 * }
 */
export function MapFS_Chtimes(receiver: GoPtr<MapFS>, path: string, aTime: Time, mTime: Time): GoError {
  receiver!.mu.Lock();
  try {
    const canonical = MapFS_getCanonicalPath(receiver, path);
    const internalMap = receiver!.m as unknown as InternalMapFS;
    const fileInfo = internalMap.get(canonical);
    if (fileInfo === undefined) {
      // file does not exist
      return ErrNotExist as unknown as GoError;
    }
    fileInfo.ModTime = mTime;
    return undefined;
  } finally {
    receiver!.mu.Unlock();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.GetTargetOfSymlink","kind":"method","status":"implemented","sigHash":"93d5d2b9e094f26d8ce2e401662d2f871edaa0c30637b1109222650ab8f6fc0c","bodyHash":"d46dbaf53bb6847f069e6420da6e64a8a298fabee79d05a88b7d451fa911bfa8"}
 *
 * Go source:
 * func (m *MapFS) GetTargetOfSymlink(path string) (string, bool) {
 * 	path, _ = strings.CutPrefix(path, "/")
 * 	m.mu.RLock()
 * 	defer m.mu.RUnlock()
 * 	canonical := m.getCanonicalPath(path)
 * 	canonicalString := string(canonical)
 * 	if fileInfo, ok := m.m[canonicalString]; ok {
 * 		if fileInfo.Mode&fs.ModeSymlink != 0 {
 * 			return "/" + string(fileInfo.Data), true
 * 		}
 * 	}
 * 	return "", false
 * }
 */
export function MapFS_GetTargetOfSymlink(receiver: GoPtr<MapFS>, path: string): [string, bool] {
  let pathVar = path.startsWith("/") ? path.slice(1) : path;
  receiver!.mu.RLock();
  try {
    const canonical = MapFS_getCanonicalPath(receiver, pathVar);
    const internalMap = receiver!.m as unknown as InternalMapFS;
    const fileInfo = internalMap.get(canonical);
    if (fileInfo !== undefined) {
      if ((fileInfo.Mode & (ModeSymlink as unknown as number)) !== 0) {
        return ["/" + new TextDecoder().decode(fileInfo.Data), true];
      }
    }
    return ["", false];
  } finally {
    receiver!.mu.RUnlock();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.GetModTime","kind":"method","status":"implemented","sigHash":"9f058671b7dbb856c49fd1e1340e108c366f396632b6326d98794adfb361ab4b","bodyHash":"99160a6458503a7e486f4a77268e4eeaca744fce55d4b313324102bf82ca719b"}
 *
 * Go source:
 * func (m *MapFS) GetModTime(path string) time.Time {
 * 	path, _ = strings.CutPrefix(path, "/")
 * 	m.mu.RLock()
 * 	defer m.mu.RUnlock()
 * 	canonical := m.getCanonicalPath(path)
 * 	canonicalString := string(canonical)
 * 	if fileInfo, ok := m.m[canonicalString]; ok {
 * 		return fileInfo.ModTime
 * 	}
 * 	return time.Time{}
 * }
 */
export function MapFS_GetModTime(receiver: GoPtr<MapFS>, path: string): Time {
  const pathVar = path.startsWith("/") ? path.slice(1) : path;
  receiver!.mu.RLock();
  try {
    const canonical = MapFS_getCanonicalPath(receiver, pathVar);
    const internalMap = receiver!.m as unknown as InternalMapFS;
    const fileInfo = internalMap.get(canonical);
    if (fileInfo !== undefined) {
      return fileInfo.ModTime;
    }
    return new Time();
  } finally {
    receiver!.mu.RUnlock();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.Entries","kind":"method","status":"implemented","sigHash":"da6e3e7cff83ee771d32a53de19a1332f10548e1df4ce9b054abf00a3680050d","bodyHash":"2af0ba7073ca66e15daf70408072056b8dfb4de529333d3dd5b10a026ffd4df5"}
 *
 * Go source:
 * func (m *MapFS) Entries() iter.Seq2[string, *fstest.MapFile] {
 * 	return func(yield func(string, *fstest.MapFile) bool) {
 * 		m.mu.RLock()
 * 		defer m.mu.RUnlock()
 * 		inputKeys := slices.Collect(maps.Keys(m.m))
 * 		slices.SortFunc(inputKeys, comparePathsByParts)
 *
 * 		for _, p := range inputKeys {
 * 			file := m.m[p]
 * 			path := file.Sys.(*sys).realpath
 * 			if !tspath.PathIsAbsolute(path) {
 * 				path = "/" + path
 * 			}
 * 			if !yield(path, file) {
 * 				break
 * 			}
 * 		}
 * 	}
 * }
 */
export function MapFS_Entries(receiver: GoPtr<MapFS>): GoSeq2<string, GoPtr<MapFile>> {
  return (yieldValue: (key: string, value: GoPtr<MapFile>) => bool): void => {
    receiver!.mu.RLock();
    try {
      const internalMap = receiver!.m as unknown as InternalMapFS;
      const inputKeys = globalThis.Array.from(internalMap.keys());
      inputKeys.sort(comparePathsByParts);

      for (const p of inputKeys) {
        const file = internalMap.get(p)!;
        const sysData = file.Sys as sys;
        let path = sysData.realpath;
        if (!PathIsAbsolute(path)) {
          path = "/" + path;
        }
        if (!yieldValue(path, file as unknown as MapFile)) {
          break;
        }
      }
    } finally {
      receiver!.mu.RUnlock();
    }
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::method::MapFS.GetFileInfo","kind":"method","status":"implemented","sigHash":"ed68755e3460c041185315e8cb09241f9c6838a2984e375321e7c6d98d746e40","bodyHash":"640361ecce0dc222fb8513996a647138c754822979cf2de101b01fc2e3c9a501"}
 *
 * Go source:
 * func (m *MapFS) GetFileInfo(path string) *fstest.MapFile {
 * 	path, _ = strings.CutPrefix(path, "/")
 * 	m.mu.RLock()
 * 	defer m.mu.RUnlock()
 * 	canonical := m.getCanonicalPath(path)
 * 	canonicalString := string(canonical)
 * 	return m.m[canonicalString]
 * }
 */
export function MapFS_GetFileInfo(receiver: GoPtr<MapFS>, path: string): GoPtr<MapFile> {
  const pathVar = path.startsWith("/") ? path.slice(1) : path;
  receiver!.mu.RLock();
  try {
    const canonical = MapFS_getCanonicalPath(receiver, pathVar);
    const internalMap = receiver!.m as unknown as InternalMapFS;
    return internalMap.get(canonical) as unknown as MapFile | undefined;
  } finally {
    receiver!.mu.RUnlock();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfstest/vfstest.go::func::must","kind":"func","status":"implemented","sigHash":"6dce35f752c1cde278853456247f9d37b280c58bd9270a8a78f69989ef1bf168","bodyHash":"e56dcaf6731438bcefd3603f1787d61f25a09d7522b45e2d04d8622ccf9166e8"}
 *
 * Go source:
 * func must[T any](v T, err error) T {
 * 	if err != nil {
 * 		panic(err)
 * 	}
 * 	return v
 * }
 */
export function must<T>(v: T, err: GoError): T {
  if (err !== undefined) {
    throw err;
  }
  return v;
}
