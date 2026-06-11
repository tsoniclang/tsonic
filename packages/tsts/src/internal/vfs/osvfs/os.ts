import type { bool, int } from "@tsonic/core/types.js";
import type { GoError, GoPtr } from "../../../go/compat.js";
import { Pool } from "../../../go/sync.js";
import type { DirEntry } from "../../../go/io/fs.js";
import type { Time } from "../../../go/time.js";
import * as goOs from "../../../go/os.js";
import * as runtime from "../../../go/runtime.js";
import { Abs as import_filepath_Abs } from "../../../go/path/filepath.js";
import { NormalizePath as tspathNormalizePath, GetDirectoryPath, NormalizeSlashes } from "../../tspath/path.js";
import { NewLimitedSemaphore } from "../../core/semaphore.js";
import type { LimitedSemaphore } from "../../core/semaphore.js";
import { Common_ReadFile, Common_DirectoryExists, Common_FileExists, Common_GetAccessibleEntries, Common_Stat, Common_WalkDir, RootLength } from "../internal/internal.js";
import type { Common } from "../internal/internal.js";
import { realpath } from "./realpath_other.js";
import { isReparsePoint } from "./reparsepoint_other.js";
import { VersionMajorMinor } from "../../core/version.js";
import { CombinePaths } from "../../tspath/path.js";
import type { Entries, FileInfo, FS as FS_a37200a9, WalkDirFunc } from "../vfs.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::varGroup::blockingOpSema+readSema+writeSema","kind":"varGroup","status":"implemented","sigHash":"8ca24dac47eb68e250738b5a02087ad16e286c3e26827f2d686625869672031b","bodyHash":"8ee8a7b59dd6ba06780e43c1fe018043b4cf2bb99b253a10769597f2a0799fd6"}
 *
 * Go source:
 * var (
 * 	// Semaphore for operations that are effectively blocking syscalls.
 * 	blockingOpSema = core.NewLimitedSemaphore(128)
 * 	// Semaphore for file reads.
 * 	readSema = core.NewLimitedSemaphore(128)
 * 	// Semaphore for file writes.
 * 	writeSema = core.NewLimitedSemaphore(32)
 * )
 */
export let blockingOpSema: LimitedSemaphore = NewLimitedSemaphore(128 as int)!;
export let readSema: LimitedSemaphore = NewLimitedSemaphore(128 as int)!;
export let writeSema: LimitedSemaphore = NewLimitedSemaphore(32 as int)!;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::func::FS","kind":"func","status":"implemented","sigHash":"669d6932edc66d4ae7f33b93dab185415c4c4934d0a52dc971e87a956312ddc0","bodyHash":"ea9152abb403b54a8516180fb60411ae882b406b48ff568ff753aaa6ed8499dc"}
 *
 * Go source:
 * func FS() vfs.FS {
 * 	return osVFS
 * }
 */
export function FS(): FS_a37200a9 {
  return osVFS;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::varGroup::osVFS","kind":"varGroup","status":"implemented","sigHash":"e849cf504ee652ab59180aee0eaa01d7359beab126ae59d5c18f4e161ac17464","bodyHash":"a0e2b523d735d73b927a6e0bef4cdcd95f635911b12a68cc5570c89c04122615"}
 *
 * Go source:
 * var osVFS vfs.FS = &osFS{
 * 	common: internal.Common{
 * 		RootFor:        os.DirFS,
 * 		IsReparsePoint: isReparsePoint,
 * 	},
 * }
 */
const _osFS: osFS = {
  common: {
    RootFor: goOs.DirFS as unknown as (root: string) => import("../../../go/io/fs.js").FS,
    IsReparsePoint: isReparsePoint as unknown as (path: string) => bool,
  },
};
export let osVFS: FS_a37200a9 = {
  UseCaseSensitiveFileNames: () => osFS_UseCaseSensitiveFileNames(_osFS),
  ReadFile: (path: string) => osFS_ReadFile(_osFS, path),
  DirectoryExists: (path: string) => osFS_DirectoryExists(_osFS, path),
  FileExists: (path: string) => osFS_FileExists(_osFS, path),
  GetAccessibleEntries: (path: string) => osFS_GetAccessibleEntries(_osFS, path),
  Stat: (path: string) => osFS_Stat(_osFS, path),
  WalkDir: (root: string, walkFn: WalkDirFunc) => osFS_WalkDir(_osFS, root, walkFn),
  Realpath: (path: string) => osFS_Realpath(_osFS, path),
  WriteFile: (path: string, content: string) => osFS_WriteFile(_osFS, path, content),
  AppendFile: (path: string, content: string) => osFS_AppendFile(_osFS, path, content),
  Remove: (path: string) => osFS_Remove(_osFS, path),
  Chtimes: (path: string, aTime: Time, mTime: Time) => osFS_Chtimes(_osFS, path, aTime, mTime),
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::type::osFS","kind":"type","status":"implemented","sigHash":"3a82f83ca59d7882da96b6b5265cbbe6638b1f06b9033dcc292b05f511557f3e","bodyHash":"f1d294754444f3c78597e1f4859fe1c1fd7653733695d28c9f96cc99068accff"}
 *
 * Go source:
 * osFS struct {
 * 	common internal.Common
 * }
 */
export interface osFS {
  common: Common;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::varGroup::isFileSystemCaseSensitive","kind":"varGroup","status":"implemented","sigHash":"1d811db1c8f7dfba5f508c6b54375fed884f4b3d8b1949fe5cb7dece3cafbfe6","bodyHash":"5696eb2cfa4a6aae523ed9c914b8f7631e6f94f40b38ad58587035223a4a7979"}
 *
 * Go source:
 * var isFileSystemCaseSensitive = func() bool {
 * 	// win32/win64 are case insensitive platforms
 * 	if runtime.GOOS == "windows" {
 * 		return false
 * 	}
 * 
 * 	if runtime.GOARCH == "wasm" {
 * 		// !!! Who knows; this depends on the host implementation.
 * 		return true
 * 	}
 * 
 * 	// As a proxy for case-insensitivity, we check if the current executable exists under a different case.
 * 	// This is not entirely correct, since different OSs can have differing case sensitivity in different paths,
 * 	// but this is largely good enough for our purposes (and what sys.ts used to do with __filename).
 * 	exe, err := os.Executable()
 * 	if err != nil {
 * 		panic(fmt.Sprintf("vfs: failed to get executable path: %v", err))
 * 	}
 * 
 * 	// If the current executable exists under a different case, we must be case-insensitive.
 * 	swapped := swapCase(exe)
 * 	if _, err := os.Stat(swapped); err != nil {
 * 		if os.IsNotExist(err) {
 * 			return true
 * 		}
 * 		panic(fmt.Sprintf("vfs: failed to stat %q: %v", swapped, err))
 * 	}
 * 	return false
 * }()
 */
export let isFileSystemCaseSensitive: bool = (process.platform !== "win32" && process.platform !== "darwin") as bool;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::func::swapCase","kind":"func","status":"implemented","sigHash":"30c3bfea8c42cbc4344fa0f76aeb35c8940c880093af4577fb5acef5a5365aa9","bodyHash":"3f589bf760347d711d58761cd1e95732503f228c0b6afdff0b7af3c1d2a9905f"}
 *
 * Go source:
 * func swapCase(str string) string {
 * 	return strings.Map(func(r rune) rune {
 * 		upper := unicode.ToUpper(r)
 * 		if upper == r {
 * 			return unicode.ToLower(r)
 * 		} else {
 * 			return upper
 * 		}
 * 	}, str)
 * }
 */
export function swapCase(str: string): string {
  return [...str].map((c) => {
    const upper = c.toUpperCase();
    if (upper === c) {
      return c.toLowerCase();
    } else {
      return upper;
    }
  }).join("");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.UseCaseSensitiveFileNames","kind":"method","status":"implemented","sigHash":"69a0c1b3de97d53ef5b9c73c2e07896a75c800f138f61b25f9764a11799a0f1a","bodyHash":"6b8ab037717c4ed71643d92ec049ffd7a5a9d15c80cb0deddb8a53ebc8b0214c"}
 *
 * Go source:
 * func (vfs *osFS) UseCaseSensitiveFileNames() bool {
 * 	return isFileSystemCaseSensitive
 * }
 */
export function osFS_UseCaseSensitiveFileNames(receiver: GoPtr<osFS>): bool {
  return isFileSystemCaseSensitive;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.ReadFile","kind":"method","status":"implemented","sigHash":"d2ad2fa3510ab051870506efe620ef75b63919eb58978bf10b6a18a4601099ab","bodyHash":"4eba651864cbe16fda835fcd3bf9b0bb648b2359406ea1ad800c24c0003c5143"}
 *
 * Go source:
 * func (vfs *osFS) ReadFile(path string) (contents string, ok bool) {
 * 	defer readSema.Acquire()()
 * 	return vfs.common.ReadFile(path)
 * }
 */
export function osFS_ReadFile(receiver: GoPtr<osFS>, path: string): [string, bool] {
  // defer readSema.Acquire()() — no-op in single-threaded TS
  return Common_ReadFile(receiver!.common, path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.DirectoryExists","kind":"method","status":"implemented","sigHash":"4df07d8e8ab53b7b87443aa87b48b4672831e4448427f200f6cba70739d7b2cd","bodyHash":"877678c80c9e8ddcf7c2f5f560d474d4dd4f691b8c4787773f395774a9ec01e8"}
 *
 * Go source:
 * func (vfs *osFS) DirectoryExists(path string) bool {
 * 	defer blockingOpSema.Acquire()()
 * 	return vfs.common.DirectoryExists(path)
 * }
 */
export function osFS_DirectoryExists(receiver: GoPtr<osFS>, path: string): bool {
  // defer blockingOpSema.Acquire()() — no-op in single-threaded TS
  return Common_DirectoryExists(receiver!.common, path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.FileExists","kind":"method","status":"implemented","sigHash":"5fcc1cc93022bcd84e1d8a93c90e3413b987ef4415c6d9762c1786a179dbfa3f","bodyHash":"2c8895ea7a690de237d62cb75cb60048762e0db1f70eae399cd00726a3271f3c"}
 *
 * Go source:
 * func (vfs *osFS) FileExists(path string) bool {
 * 	defer blockingOpSema.Acquire()()
 * 	return vfs.common.FileExists(path)
 * }
 */
export function osFS_FileExists(receiver: GoPtr<osFS>, path: string): bool {
  // defer blockingOpSema.Acquire()() — no-op in single-threaded TS
  return Common_FileExists(receiver!.common, path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.GetAccessibleEntries","kind":"method","status":"implemented","sigHash":"4e06ddfe3daee54de4072d4d1df59cd675a068aee6b34088cd6f1f69a764029d","bodyHash":"9b4cae0fd52bfcd7386ca31d4388c019da4e27324aa14714b9c6e69b1e2aa6f6"}
 *
 * Go source:
 * func (vfs *osFS) GetAccessibleEntries(path string) vfs.Entries {
 * 	defer blockingOpSema.Acquire()()
 * 	return vfs.common.GetAccessibleEntries(path)
 * }
 */
export function osFS_GetAccessibleEntries(receiver: GoPtr<osFS>, path: string): Entries {
  // defer blockingOpSema.Acquire()() — no-op in single-threaded TS
  return Common_GetAccessibleEntries(receiver!.common, path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.Stat","kind":"method","status":"implemented","sigHash":"39207f3817d8a8813d536d228c51775f21c18d54cb213f3944e3f3f0fd31a6c7","bodyHash":"cf18836334bbfa46686f1a5505a4912f6a37060ff215fdfb12caa735c83a61e5"}
 *
 * Go source:
 * func (vfs *osFS) Stat(path string) vfs.FileInfo {
 * 	defer blockingOpSema.Acquire()()
 * 	return vfs.common.Stat(path)
 * }
 */
export function osFS_Stat(receiver: GoPtr<osFS>, path: string): GoPtr<FileInfo> {
  // defer blockingOpSema.Acquire()() — no-op in single-threaded TS
  return Common_Stat(receiver!.common, path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::varGroup::limitedWalkDirFuncPool","kind":"varGroup","status":"implemented","sigHash":"64a6535a071e12d4a2fba9b3669975334d44ff7e548385f9cfd4591b546cb6d8","bodyHash":"4cc18dea792f7314aacf5986f039cd2d7ed21b17b3bc244220447196e45f7ac2"}
 *
 * Go source:
 * var limitedWalkDirFuncPool = sync.Pool{
 * 	New: func() any {
 * 		w := &limitedWalkDirFunc{}
 * 		w.walk = w.walker
 * 		return w
 * 	},
 * }
 */
export let limitedWalkDirFuncPool: Pool<limitedWalkDirFunc> = new Pool<limitedWalkDirFunc>();
limitedWalkDirFuncPool.New = () => {
  const w: limitedWalkDirFunc = { inner: undefined as never, walk: undefined as never };
  w.walk = ((path: string, d: DirEntry, err: GoError) => limitedWalkDirFunc_walker(w, path, d, err)) as unknown as WalkDirFunc;
  return w;
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::func::getLimitedWalkDirFunc","kind":"func","status":"implemented","sigHash":"d3129e0420e85b5a1fba19e882acf61f6c6c0bac7a5daf17abb331b520fcc24d","bodyHash":"d1c056cdf8f744048dd48f5751a0d093c485c0fb49896bb62c6c24cceccde480"}
 *
 * Go source:
 * func getLimitedWalkDirFunc(walkFn vfs.WalkDirFunc) *limitedWalkDirFunc {
 * 	w := limitedWalkDirFuncPool.Get().(*limitedWalkDirFunc)
 * 	w.inner = walkFn
 * 	return w
 * }
 */
export function getLimitedWalkDirFunc(walkFn: WalkDirFunc): GoPtr<limitedWalkDirFunc> {
  const w = limitedWalkDirFuncPool.Get() as limitedWalkDirFunc;
  w.inner = walkFn;
  return w;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::func::putLimitedWalkDirFunc","kind":"func","status":"implemented","sigHash":"dce6b27ffb42990cf05140727aca1e8969818433395e438a85c7e6ebed6c95c9","bodyHash":"302054dbf1a4c4b1889822e6500c06e370a727896b6fda3eab2c912698dcea07"}
 *
 * Go source:
 * func putLimitedWalkDirFunc(w *limitedWalkDirFunc) {
 * 	w.inner = nil
 * 	limitedWalkDirFuncPool.Put(w)
 * }
 */
export function putLimitedWalkDirFunc(w: GoPtr<limitedWalkDirFunc>): void {
  w!.inner = undefined as never;
  limitedWalkDirFuncPool.Put(w!);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::type::limitedWalkDirFunc","kind":"type","status":"implemented","sigHash":"bb5d5101cf5a9a2ed672d80b8ea774275b528cd7c7395c8b44ec0bc565643714","bodyHash":"78f1411d878844de94436beb425f56c11bf504c8a3e0ddcaaa576a5e82caa2f8"}
 *
 * Go source:
 * limitedWalkDirFunc struct {
 * 	inner vfs.WalkDirFunc
 * 	walk  vfs.WalkDirFunc
 * }
 */
export interface limitedWalkDirFunc {
  inner: WalkDirFunc;
  walk: WalkDirFunc;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::limitedWalkDirFunc.walker","kind":"method","status":"implemented","sigHash":"a95013a36876cac9fefdc79eee32ebe2236522abf21fc9b85529d2de92656a8a","bodyHash":"2d9475a1115d691d56a0674cbdd43727e767ae4d6bee64f53f9f545e68c1b322"}
 *
 * Go source:
 * func (w *limitedWalkDirFunc) walker(path string, d fs.DirEntry, err error) error {
 * 	defer blockingOpSema.Acquire()()
 * 	return w.inner(path, d, err)
 * }
 */
export function limitedWalkDirFunc_walker(receiver: GoPtr<limitedWalkDirFunc>, path: string, d: DirEntry, err: GoError): GoError {
  // defer blockingOpSema.Acquire()() — no-op in single-threaded TS
  return (receiver!.inner as unknown as (path: string, d: DirEntry, err: GoError) => GoError)(path, d, err);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.WalkDir","kind":"method","status":"implemented","sigHash":"c0f84899a8b41406e32a86d414d4f8cc57cef3cdcfac7155986529d6231f1dda","bodyHash":"2b48ffc3a907318505dcb7ee0c4901409a46934c0bdde5f6b9749e633066b032"}
 *
 * Go source:
 * func (vfs *osFS) WalkDir(root string, walkFn vfs.WalkDirFunc) error {
 * 	walker := getLimitedWalkDirFunc(walkFn)
 * 	defer putLimitedWalkDirFunc(walker)
 * 	return vfs.common.WalkDir(root, walker.walk)
 * }
 */
export function osFS_WalkDir(receiver: GoPtr<osFS>, root: string, walkFn: WalkDirFunc): GoError {
  const walker = getLimitedWalkDirFunc(walkFn);
  try {
    return Common_WalkDir(receiver!.common, root, walker!.walk);
  } finally {
    putLimitedWalkDirFunc(walker);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.Realpath","kind":"method","status":"implemented","sigHash":"c28e3f0f5a4bdacf10c178488bc5f1bd10021f1a65a68eb10e614c97fb5964a6","bodyHash":"008c7f1d136c784f007b98f00d6c7432ff82d33c54459aeacc8e78441eef01d8"}
 *
 * Go source:
 * func (vfs *osFS) Realpath(path string) string {
 * 	defer blockingOpSema.Acquire()()
 * 	return osFSRealpath(path)
 * }
 */
export function osFS_Realpath(receiver: GoPtr<osFS>, path: string): string {
  // defer blockingOpSema.Acquire()() — no-op in single-threaded TS
  return osFSRealpath(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::func::osFSRealpath","kind":"func","status":"implemented","sigHash":"b19f8c1d4ab8776f6232e1d3e138f311d85bf95f118333df579cdff837e1be6a","bodyHash":"a6d8b295f6b1cc641e13cecb96dbc0c7f7e8800c16ac7e985e7a43e95ebd112f"}
 *
 * Go source:
 * func osFSRealpath(path string) string {
 * 	_ = internal.RootLength(path) // Assert path is rooted
 *
 * 	orig := path
 * 	path = filepath.FromSlash(path)
 * 	path, err := realpath(path)
 * 	if err != nil {
 * 		return orig
 * 	}
 * 	path, err = filepath.Abs(path)
 * 	if err != nil {
 * 		return orig
 * 	}
 * 	return tspath.NormalizeSlashes(path)
 * }
 */
export function osFSRealpath(path: string): string {
  void RootLength(path); // Assert path is rooted
  const orig = path;
  // filepath.FromSlash is identity for forward-slash paths
  const [resolved, realpathErr] = realpath(path);
  if (realpathErr !== undefined) {
    return orig;
  }
  const [absPath, absErr] = import_filepath_Abs(resolved);
  if (absErr !== undefined) {
    return orig;
  }
  return NormalizeSlashes(absPath);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.writeFileWithFlag","kind":"method","status":"implemented","sigHash":"0ced6a54217320edfb02202d0179c6671d293870a5c13897d036bd06fa501811","bodyHash":"bdea41d37b23e39a83fa47f747f6496e517a68ffb518184303c557cd4dab3494"}
 *
 * Go source:
 * func (vfs *osFS) writeFileWithFlag(path string, content string, flag int) error {
 * 	defer writeSema.Acquire()()
 *
 * 	file, err := os.OpenFile(path, flag, 0o666)
 * 	if err != nil {
 * 		return err
 * 	}
 * 	defer file.Close()
 *
 * 	if _, err := file.WriteString(content); err != nil {
 * 		return err
 * 	}
 *
 * 	return nil
 * }
 */
export function osFS_writeFileWithFlag(receiver: GoPtr<osFS>, path: string, content: string, flag: int): GoError {
  // defer writeSema.Acquire()() — no-op in single-threaded TS
  const [file, openErr] = goOs.OpenFile(path, flag, 0o666) as [goOs.File, GoError];
  if (openErr !== undefined) {
    return openErr;
  }
  try {
    const [, writeErr] = (file as unknown as { WriteString: (s: string) => [number, GoError] }).WriteString(content);
    if (writeErr !== undefined) {
      return writeErr;
    }
    return undefined;
  } finally {
    (file as unknown as { Close: () => GoError }).Close();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.ensureDirectoryExists","kind":"method","status":"implemented","sigHash":"67bbf1b19d8a4930756f29083f3c83c0f435310ab2635a19579dadb133c400c1","bodyHash":"98ae3b9169b2ffa9751048c53dd597ee9aa34f1b1b41b50e26ca51fe1bee64c3"}
 *
 * Go source:
 * func (vfs *osFS) ensureDirectoryExists(directoryPath string) error {
 * 	defer blockingOpSema.Acquire()()
 * 	return os.MkdirAll(directoryPath, 0o777)
 * }
 */
export function osFS_ensureDirectoryExists(receiver: GoPtr<osFS>, directoryPath: string): GoError {
  // defer blockingOpSema.Acquire()() — no-op in single-threaded TS
  return goOs.MkdirAll(directoryPath, 0o777) as GoError;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.writeFileEnsuringDir","kind":"method","status":"implemented","sigHash":"75af3a003611cb6aadb123b6e3f0a8525a28ffbff30aa5baa8627347ac9ec9fe","bodyHash":"bd88b164e58156cc18cbff35895142321dde1ccb018569971f9951e3c053ed8c"}
 *
 * Go source:
 * func (vfs *osFS) writeFileEnsuringDir(path string, content string, flag int) error {
 * 	_ = internal.RootLength(path) // Assert path is rooted
 * 	if err := vfs.writeFileWithFlag(path, content, flag); err == nil {
 * 		return nil
 * 	}
 * 	if err := vfs.ensureDirectoryExists(tspath.GetDirectoryPath(tspath.NormalizePath(path))); err != nil {
 * 		return err
 * 	}
 * 	return vfs.writeFileWithFlag(path, content, flag)
 * }
 */
export function osFS_writeFileEnsuringDir(receiver: GoPtr<osFS>, path: string, content: string, flag: int): GoError {
  void RootLength(path); // Assert path is rooted
  const firstErr = osFS_writeFileWithFlag(receiver, path, content, flag);
  if (firstErr === undefined) {
    return undefined;
  }
  const dirErr = osFS_ensureDirectoryExists(receiver, GetDirectoryPath(tspathNormalizePath(path)));
  if (dirErr !== undefined) {
    return dirErr;
  }
  return osFS_writeFileWithFlag(receiver, path, content, flag);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.WriteFile","kind":"method","status":"implemented","sigHash":"8615e091845ff8a0e91f1dd3d20ac7e5acbb62cc4cd5730937ff6c34cb82a110","bodyHash":"d6318731888bbb6add0e7059d4511265a48c983528ec5176a75c558a9ef433a2"}
 *
 * Go source:
 * func (vfs *osFS) WriteFile(path string, content string) error {
 * 	return vfs.writeFileEnsuringDir(path, content, os.O_WRONLY|os.O_CREATE|os.O_TRUNC)
 * }
 */
export function osFS_WriteFile(receiver: GoPtr<osFS>, path: string, content: string): GoError {
  return osFS_writeFileEnsuringDir(receiver, path, content, ((goOs.O_WRONLY as int) | (goOs.O_CREATE as int) | (goOs.O_TRUNC as int)) as int);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.AppendFile","kind":"method","status":"implemented","sigHash":"9b0d17873207a631646dce470b6968d252cd76b56a3e90ab82cb52596779973d","bodyHash":"a99251a582a0c82a0ff5e9fe47ddc2863e598a30f972252f2037b10c0c2136cd"}
 *
 * Go source:
 * func (vfs *osFS) AppendFile(path string, content string) error {
 * 	return vfs.writeFileEnsuringDir(path, content, os.O_WRONLY|os.O_CREATE|os.O_APPEND)
 * }
 */
export function osFS_AppendFile(receiver: GoPtr<osFS>, path: string, content: string): GoError {
  return osFS_writeFileEnsuringDir(receiver, path, content, ((goOs.O_WRONLY as int) | (goOs.O_CREATE as int) | (goOs.O_APPEND as int)) as int);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.Remove","kind":"method","status":"implemented","sigHash":"f79339638aa9d6f80e930a151b88fcdc6fbf78b4e334f5764c138d0f69682250","bodyHash":"915ec3e706ae2ba698f4f1760913b148b9e9b022d3a5d1661f252ee0b2e0ab00"}
 *
 * Go source:
 * func (vfs *osFS) Remove(path string) error {
 * 	defer blockingOpSema.Acquire()()
 * 	// todo: #701 add retry mechanism?
 * 	return os.RemoveAll(path)
 * }
 */
export function osFS_Remove(receiver: GoPtr<osFS>, path: string): GoError {
  // defer blockingOpSema.Acquire()() — no-op in single-threaded TS
  return goOs.RemoveAll(path) as GoError;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::method::osFS.Chtimes","kind":"method","status":"implemented","sigHash":"343c6a2f4958833e29b78799b4b0148494b862eee464df510ad56b27768cefce","bodyHash":"4e92e7ff9f6342d7dffa4e4afb18dd52b0bdae385b4053d7d8da70cf618f1edb"}
 *
 * Go source:
 * func (vfs *osFS) Chtimes(path string, aTime time.Time, mTime time.Time) error {
 * 	defer blockingOpSema.Acquire()()
 * 	return os.Chtimes(path, aTime, mTime)
 * }
 */
export function osFS_Chtimes(receiver: GoPtr<osFS>, path: string, aTime: Time, mTime: Time): GoError {
  // defer blockingOpSema.Acquire()() — no-op in single-threaded TS
  return goOs.Chtimes(path, aTime, mTime) as GoError;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/os.go::func::GetGlobalTypingsCacheLocation","kind":"func","status":"implemented","sigHash":"2a04d017bbef349d30fce607216fea793fe789c0241ce9b578c65858067f52bb","bodyHash":"5abe23c2c6b324a696751f9f488b0860d1e7df59b163afa585b23e599c69cf7d"}
 *
 * Go source:
 * func GetGlobalTypingsCacheLocation() string {
 * 	cacheDir, err := os.UserCacheDir()
 * 	if err != nil {
 * 		cacheDir = os.TempDir()
 * 	}
 *
 * 	var subdir string
 * 	if runtime.GOOS == "windows" {
 * 		subdir = "Microsoft/TypeScript"
 * 	} else {
 * 		subdir = "typescript"
 * 	}
 * 	return tspath.CombinePaths(cacheDir, subdir, core.VersionMajorMinor())
 * }
 */
export function GetGlobalTypingsCacheLocation(): string {
  const [userCacheDir, userCacheDirErr] = goOs.UserCacheDir() as [string, GoError];
  const cacheDir = userCacheDirErr !== undefined ? (goOs.TempDir() as string) : userCacheDir;
  const subdir = (runtime.GOOS as string) === "windows" ? "Microsoft/TypeScript" : "typescript";
  return CombinePaths(cacheDir, subdir, VersionMajorMinor());
}
