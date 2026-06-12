import type { bool } from "@tsonic/core/types.js";
import type { GoError, GoPtr } from "../../../go/compat.js";
import type { FileMode, FS } from "../../../go/io/fs.js";
import { Sub as fs_Sub } from "../../../go/io/fs.js";
import type { Time } from "../../../go/time.js";
import type { Common } from "../internal/internal.js";
import { Common_DirectoryExists, Common_FileExists, Common_GetAccessibleEntries, Common_Stat, Common_ReadFile, Common_WalkDir, RootLength, SplitPath } from "../internal/internal.js";
import { GetDirectoryPath, IsUrl, NormalizePath, RemoveTrailingDirectorySeparator } from "../../tspath/path.js";
import type { Entries, FileInfo, FS as FS_f717df58, WalkDirFunc } from "../vfs.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::type::RealpathFS","kind":"type","status":"implemented","sigHash":"76ddb6e93f7dad5be898b3b18f1ba22aa1dfc580f92fb7545edfb26a2713e621","bodyHash":"15614cdd3fb827948194860908c43827aed8cd4a3973cbb98a578549b0f79b4e"}
 *
 * Go source:
 * RealpathFS interface {
 * 	fs.FS
 * 	Realpath(path string) (string, error)
 * }
 */
export interface RealpathFS {
  readonly __tsgoEmbedded0?: FS;
  Realpath(path: string): [string, GoError];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::type::WritableFS","kind":"type","status":"implemented","sigHash":"6ce04594308ab5fa0ebbf08aa3fd990ca8e1e160e7bb1fd9c39b7d20f80dbde4","bodyHash":"c5aae079c6bececaecce6e640856380c307a270cf0199c73ae72154f15a97f18"}
 *
 * Go source:
 * WritableFS interface {
 * 	fs.FS
 * 	WriteFile(path string, data string, perm fs.FileMode) error
 * 	AppendFile(path string, data string, perm fs.FileMode) error
 * 	MkdirAll(path string, perm fs.FileMode) error
 * 	// Removes `path` and all its contents. Will return the first error it encounters.
 * 	Remove(path string) error
 * 	Chtimes(path string, aTime time.Time, mTime time.Time) error
 * }
 */
export interface WritableFS {
  readonly __tsgoEmbedded0?: FS;
  WriteFile(path: string, data: string, perm: FileMode): GoError;
  AppendFile(path: string, data: string, perm: FileMode): GoError;
  MkdirAll(path: string, perm: FileMode): GoError;
  Remove(path: string): GoError;
  Chtimes(path: string, aTime: Time, mTime: Time): GoError;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::type::FsWithSys","kind":"type","status":"implemented","sigHash":"a4f7395d1d5e7a021a5851aed59db62000930987923d6a1d0c7a64dfbd864ef2","bodyHash":"b0cc740fae0aa3b8c5b1888541e702074fc95c7b953bcede968c218e271bcfb0"}
 *
 * Go source:
 * FsWithSys interface {
 * 	vfs.FS
 * 	FSys() fs.FS
 * }
 */
export interface FsWithSys extends FS_f717df58 {
  FSys(): FS;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::func::From","kind":"func","status":"implemented","sigHash":"c9c32302129a5b9ff936d581edf737c2c714b403d118a05d392b48f43430357c","bodyHash":"21982e1bcd22d97919310f4bfa7a22868b7de7b2ce4da5fd5462962134ac4051"}
 *
 * Go source:
 * func From(fsys fs.FS, useCaseSensitiveFileNames bool) FsWithSys {
 * 	var realpath func(path string) (string, error)
 * 	if fsys, ok := fsys.(RealpathFS); ok {
 * 		realpath = func(path string) (string, error) {
 * 			rest, hadSlash := strings.CutPrefix(path, "/")
 * 			rp, err := fsys.Realpath(rest)
 * 			if err != nil {
 * 				return "", err
 * 			}
 * 			if hadSlash {
 * 				return "/" + rp, nil
 * 			}
 * 			return rp, nil
 * 		}
 * 	} else {
 * 		realpath = func(path string) (string, error) {
 * 			return path, nil
 * 		}
 * 	}
 *
 * 	var writeFile func(path string, content string) error
 * 	var appendFile func(path string, content string) error
 * 	var mkdirAll func(path string) error
 * 	var remove func(path string) error
 * 	var chtimes func(path string, aTime time.Time, mTime time.Time) error
 * 	if fsys, ok := fsys.(WritableFS); ok {
 * 		writeFile = func(path string, content string) error {
 * 			rest, _ := strings.CutPrefix(path, "/")
 * 			return fsys.WriteFile(rest, content, 0o666)
 * 		}
 * 		appendFile = func(path string, content string) error {
 * 			rest, _ := strings.CutPrefix(path, "/")
 * 			return fsys.AppendFile(rest, content, 0o666)
 * 		}
 * 		mkdirAll = func(path string) error {
 * 			rest, _ := strings.CutPrefix(path, "/")
 * 			return fsys.MkdirAll(rest, 0o777)
 * 		}
 * 		remove = func(path string) error {
 * 			rest, _ := strings.CutPrefix(path, "/")
 * 			return fsys.Remove(rest)
 * 		}
 * 		chtimes = func(path string, aTime time.Time, mTime time.Time) error {
 * 			rest, _ := strings.CutPrefix(path, "/")
 * 			return fsys.Chtimes(rest, aTime, mTime)
 * 		}
 * 	} else {
 * 		writeFile = func(string, string) error {
 * 			panic("writeFile not supported")
 * 		}
 * 		appendFile = func(string, string) error {
 * 			panic("appendFile not supported")
 * 		}
 * 		mkdirAll = func(string) error {
 * 			panic("mkdirAll not supported")
 * 		}
 * 		remove = func(string) error {
 * 			panic("remove not supported")
 * 		}
 * 		chtimes = func(string, time.Time, time.Time) error {
 * 			panic("chtimes not supported")
 * 		}
 * 	}
 *
 * 	return &ioFS{
 * 		common: internal.Common{
 * 			RootFor: func(root string) fs.FS {
 * 				if root == "/" {
 * 					return fsys
 * 				}
 *
 * 				p := tspath.RemoveTrailingDirectorySeparator(root)
 * 				sub, err := fs.Sub(fsys, p)
 * 				if err != nil {
 * 					if tspath.IsUrl(root) {
 * 						return nil
 * 					}
 * 					panic(fmt.Sprintf("vfs: failed to create sub file system for %q: %v", p, err))
 * 				}
 * 				return sub
 * 			},
 * 		},
 * 		useCaseSensitiveFileNames: useCaseSensitiveFileNames,
 * 		realpath:                  realpath,
 * 		writeFile:                 writeFile,
 * 		appendFile:                appendFile,
 * 		mkdirAll:                  mkdirAll,
 * 		remove:                    remove,
 * 		chtimes:                   chtimes,
 * 		fsys:                      fsys,
 * 	}
 * }
 */
export function From(fsys: FS, useCaseSensitiveFileNames: bool): FsWithSys {
  let realpath: (path: string) => [string, GoError];
  const realpathFsys = fsys as unknown as RealpathFS;
  if (realpathFsys.Realpath !== undefined) {
    realpath = (path: string): [string, GoError] => {
      const hadSlash = path.startsWith("/");
      const rest = hadSlash ? path.slice(1) : path;
      const [rp, err] = realpathFsys.Realpath(rest);
      if (err !== undefined) {
        return ["", err];
      }
      if (hadSlash) {
        return ["/" + rp, undefined];
      }
      return [rp, undefined];
    };
  } else {
    realpath = (path: string): [string, GoError] => {
      return [path, undefined];
    };
  }

  let writeFile: (path: string, content: string) => GoError;
  let appendFile: (path: string, content: string) => GoError;
  let mkdirAll: (path: string) => GoError;
  let remove: (path: string) => GoError;
  let chtimes: (path: string, aTime: Time, mTime: Time) => GoError;
  const writableFsys = fsys as unknown as WritableFS;
  if (writableFsys.WriteFile !== undefined) {
    writeFile = (path: string, content: string): GoError => {
      const rest = path.startsWith("/") ? path.slice(1) : path;
      return writableFsys.WriteFile(rest, content, 0o666 as unknown as FileMode);
    };
    appendFile = (path: string, content: string): GoError => {
      const rest = path.startsWith("/") ? path.slice(1) : path;
      return writableFsys.AppendFile(rest, content, 0o666 as unknown as FileMode);
    };
    mkdirAll = (path: string): GoError => {
      const rest = path.startsWith("/") ? path.slice(1) : path;
      return writableFsys.MkdirAll(rest, 0o777 as unknown as FileMode);
    };
    remove = (path: string): GoError => {
      const rest = path.startsWith("/") ? path.slice(1) : path;
      return writableFsys.Remove(rest);
    };
    chtimes = (path: string, aTime: Time, mTime: Time): GoError => {
      const rest = path.startsWith("/") ? path.slice(1) : path;
      return writableFsys.Chtimes(rest, aTime, mTime);
    };
  } else {
    writeFile = (_path: string, _content: string): GoError => {
      throw new globalThis.Error("writeFile not supported");
    };
    appendFile = (_path: string, _content: string): GoError => {
      throw new globalThis.Error("appendFile not supported");
    };
    mkdirAll = (_path: string): GoError => {
      throw new globalThis.Error("mkdirAll not supported");
    };
    remove = (_path: string): GoError => {
      throw new globalThis.Error("remove not supported");
    };
    chtimes = (_path: string, _aTime: Time, _mTime: Time): GoError => {
      throw new globalThis.Error("chtimes not supported");
    };
  }

  const result: ioFS = {
    common: {
      RootFor: (root: string): FS => {
        if (root === "/") {
          return fsys;
        }
        const p = RemoveTrailingDirectorySeparator(root);
        const [sub, err] = fs_Sub(fsys, p);
        if (err !== undefined) {
          if (IsUrl(root)) {
            return undefined as unknown as FS;
          }
          throw new globalThis.Error(`vfs: failed to create sub file system for ${JSON.stringify(p)}: ${err.message}`);
        }
        return sub;
      },
      IsReparsePoint: undefined as unknown as (path: string) => bool,
    },
    useCaseSensitiveFileNames,
    realpath,
    writeFile,
    appendFile,
    mkdirAll,
    remove,
    chtimes,
    fsys,
  };
  return ioFS_as_FsWithSys(result);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::type::ioFS","kind":"type","status":"implemented","sigHash":"c23b6ead9b463c20231d0c25d72369a607c5d1665dc5671ddac01f359c6ebb1f","bodyHash":"4ad44ab4d2811468b7431604d4a56bac03456c47acdff3bfdcc5c7c766770f47"}
 *
 * Go source:
 * ioFS struct {
 * 	common internal.Common
 * 
 * 	useCaseSensitiveFileNames bool
 * 	realpath                  func(path string) (string, error)
 * 	writeFile                 func(path string, content string) error
 * 	appendFile                func(path string, content string) error
 * 	mkdirAll                  func(path string) error
 * 	remove                    func(path string) error
 * 	chtimes                   func(path string, aTime time.Time, mTime time.Time) error
 * 	fsys                      fs.FS
 * }
 */
export interface ioFS {
  common: Common;
  useCaseSensitiveFileNames: bool;
  realpath: (path: string) => [string, GoError];
  writeFile: (path: string, content: string) => GoError;
  appendFile: (path: string, content: string) => GoError;
  mkdirAll: (path: string) => GoError;
  remove: (path: string) => GoError;
  chtimes: (path: string, aTime: Time, mTime: Time) => GoError;
  fsys: FS;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"023410109c89679104b8e7f9320817f5a3a5332db28e25dc0c947f9a063a5e22"}
 *
 * Go source:
 * var _ FsWithSys = (*ioFS)(nil)
 */
export const __90decee0_0: FsWithSys = ioFS_as_FsWithSys(undefined);

export function ioFS_as_vfs_FS(receiver: GoPtr<ioFS>): FS_f717df58 {
  return {
    UseCaseSensitiveFileNames: (): bool => ioFS_UseCaseSensitiveFileNames(receiver),
    FileExists: (path: string): bool => ioFS_FileExists(receiver, path),
    ReadFile: (path: string): [string, bool] => ioFS_ReadFile(receiver, path),
    WriteFile: (path: string, data: string): GoError => ioFS_WriteFile(receiver, path, data),
    AppendFile: (path: string, data: string): GoError => ioFS_AppendFile(receiver, path, data),
    Remove: (path: string): GoError => ioFS_Remove(receiver, path),
    Chtimes: (path: string, aTime: Time, mTime: Time): GoError => ioFS_Chtimes(receiver, path, aTime, mTime),
    DirectoryExists: (path: string): bool => ioFS_DirectoryExists(receiver, path),
    GetAccessibleEntries: (path: string): Entries => ioFS_GetAccessibleEntries(receiver, path),
    Stat: (path: string): GoPtr<FileInfo> => ioFS_Stat(receiver, path),
    WalkDir: (root: string, walkFn: WalkDirFunc): GoError => ioFS_WalkDir(receiver, root, walkFn),
    Realpath: (path: string): string => ioFS_Realpath(receiver, path),
  };
}

export function ioFS_as_FsWithSys(receiver: GoPtr<ioFS>): FsWithSys {
  return {
    ...ioFS_as_vfs_FS(receiver),
    FSys: (): FS => ioFS_FSys(receiver),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::method::ioFS.UseCaseSensitiveFileNames","kind":"method","status":"implemented","sigHash":"81df6f6759fef0aa41afeeb986d4e25141847b8799dd8ed704195a2bb8c42839","bodyHash":"536622fb3cbb19cad130e8b6234afc2739624b6069af48f202c0e5f9fc334446"}
 *
 * Go source:
 * func (vfs *ioFS) UseCaseSensitiveFileNames() bool {
 * 	return vfs.useCaseSensitiveFileNames
 * }
 */
export function ioFS_UseCaseSensitiveFileNames(receiver: GoPtr<ioFS>): bool {
  return receiver!.useCaseSensitiveFileNames;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::method::ioFS.DirectoryExists","kind":"method","status":"implemented","sigHash":"8ee043f22d06ab08f6e7a2c9a613ee122abe66bd9fe2395080ecc2c55f6eed03","bodyHash":"9a0472543c8ff23105c55b9aad9b01a220b80b35f9542b3c3d457beac5e75422"}
 *
 * Go source:
 * func (vfs *ioFS) DirectoryExists(path string) bool {
 * 	return vfs.common.DirectoryExists(path)
 * }
 */
export function ioFS_DirectoryExists(receiver: GoPtr<ioFS>, path: string): bool {
  return Common_DirectoryExists(receiver!.common, path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::method::ioFS.FileExists","kind":"method","status":"implemented","sigHash":"70099b15a076fbba4b804acd8744d08ebb194f4407714ad885686c3d3e7e63b8","bodyHash":"f0b11994566058b62f6dbcf96346390383955c39ea4b76a744cca7a7a69fea24"}
 *
 * Go source:
 * func (vfs *ioFS) FileExists(path string) bool {
 * 	return vfs.common.FileExists(path)
 * }
 */
export function ioFS_FileExists(receiver: GoPtr<ioFS>, path: string): bool {
  return Common_FileExists(receiver!.common, path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::method::ioFS.GetAccessibleEntries","kind":"method","status":"implemented","sigHash":"6d4c664e824e358d52fc1799e937259c0b97a9194a1d0e055d61ba8a87025dbd","bodyHash":"61ff1a6a50d65cb4aa4389401aed97e657d394b877ae02bf5d3a77cfcb271ce4"}
 *
 * Go source:
 * func (vfs *ioFS) GetAccessibleEntries(path string) vfs.Entries {
 * 	return vfs.common.GetAccessibleEntries(path)
 * }
 */
export function ioFS_GetAccessibleEntries(receiver: GoPtr<ioFS>, path: string): Entries {
  return Common_GetAccessibleEntries(receiver!.common, path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::method::ioFS.Stat","kind":"method","status":"implemented","sigHash":"cc9ed4bdaa06db574da15f9e8889a50bc57c76d53a64db4404bacf1a590950f9","bodyHash":"ff34b3eb521a95c3f59707c40ed8e3c25a90b64cdd7abbf9f603f91e1e3621b9"}
 *
 * Go source:
 * func (vfs *ioFS) Stat(path string) vfs.FileInfo {
 * 	_ = internal.RootLength(path) // Assert path is rooted
 * 	return vfs.common.Stat(path)
 * }
 */
export function ioFS_Stat(receiver: GoPtr<ioFS>, path: string): GoPtr<FileInfo> {
  void RootLength(path); // Assert path is rooted
  return Common_Stat(receiver!.common, path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::method::ioFS.ReadFile","kind":"method","status":"implemented","sigHash":"13e6d859ff995185067f192a767e06264b4f8f2c98d971e7eaa9579c9df3b4db","bodyHash":"4782381b2984122e3b7174d673cdff8052bf1f0063f22ea9a733bd605e03ed20"}
 *
 * Go source:
 * func (vfs *ioFS) ReadFile(path string) (contents string, ok bool) {
 * 	return vfs.common.ReadFile(path)
 * }
 */
export function ioFS_ReadFile(receiver: GoPtr<ioFS>, path: string): [string, bool] {
  return Common_ReadFile(receiver!.common, path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::method::ioFS.WalkDir","kind":"method","status":"implemented","sigHash":"795c72a332832757c5d4ffa6fc3cd52dd286aa3e8488616cd4b9a820f0ad2ef8","bodyHash":"770ff0563c57857495385e1b43afd5eff541cc36713a604f02c287b722fd8a7e"}
 *
 * Go source:
 * func (vfs *ioFS) WalkDir(root string, walkFn vfs.WalkDirFunc) error {
 * 	return vfs.common.WalkDir(root, walkFn)
 * }
 */
export function ioFS_WalkDir(receiver: GoPtr<ioFS>, root: string, walkFn: WalkDirFunc): GoError {
  return Common_WalkDir(receiver!.common, root, walkFn);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::method::ioFS.Remove","kind":"method","status":"implemented","sigHash":"a1af85e10ff3b93fe381607556a5a66bf54e125eacf30be825fc37e7bc91f065","bodyHash":"5641a9bbb865f015bd1f5ceef1b894f72433bced44fbc9189401009e7978906d"}
 *
 * Go source:
 * func (vfs *ioFS) Remove(path string) error {
 * 	_ = internal.RootLength(path) // Assert path is rooted
 * 	return vfs.remove(path)
 * }
 */
export function ioFS_Remove(receiver: GoPtr<ioFS>, path: string): GoError {
  void RootLength(path); // Assert path is rooted
  return receiver!.remove(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::method::ioFS.Chtimes","kind":"method","status":"implemented","sigHash":"1d69b76ffeff85c51a64d327335aed7e35dab6a0acc0913dc3c18002f2393542","bodyHash":"4d8a9493706243542f611e07e952396004fe413e5e4b2e3d12cdbbf3b2f183eb"}
 *
 * Go source:
 * func (vfs *ioFS) Chtimes(path string, aTime time.Time, mTime time.Time) error {
 * 	_ = internal.RootLength(path) // Assert path is rooted
 * 	return vfs.chtimes(path, aTime, mTime)
 * }
 */
export function ioFS_Chtimes(receiver: GoPtr<ioFS>, path: string, aTime: Time, mTime: Time): GoError {
  void RootLength(path); // Assert path is rooted
  return receiver!.chtimes(path, aTime, mTime);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::method::ioFS.Realpath","kind":"method","status":"implemented","sigHash":"18a4a859efe0c3edae994f659c0a801ad5b6e4cf59fa3a67822950fc10411942","bodyHash":"0c681dc9c95285b44a70a3b79f7db1a14fb0a767d14b57efe3e6611f2a0be30e"}
 *
 * Go source:
 * func (vfs *ioFS) Realpath(path string) string {
 * 	root, rest := internal.SplitPath(path)
 * 	// splitPath normalizes the path into parts (e.g. "c:/foo/bar" -> "c:/", "foo/bar")
 * 	// Put them back together to call realpath.
 * 	realpath, err := vfs.realpath(root + rest)
 * 	if err != nil {
 * 		return path
 * 	}
 * 	return realpath
 * }
 */
export function ioFS_Realpath(receiver: GoPtr<ioFS>, path: string): string {
  const [root, rest] = SplitPath(path);
  const [realpathResult, err] = receiver!.realpath(root + rest);
  if (err !== undefined) {
    return path;
  }
  return realpathResult;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::method::ioFS.writeFileEnsuringDir","kind":"method","status":"implemented","sigHash":"6eac3eaa1093296c29d932bf2f8a10d665dcb18b2b35fbf71979093ea4c1f8e5","bodyHash":"e08bec271bfb216dfaea44ce9e4b3a0b5624163b10d18fa14257a93204c7983b"}
 *
 * Go source:
 * func (vfs *ioFS) writeFileEnsuringDir(path string, content string, write func(path, content string) error) error {
 * 	_ = internal.RootLength(path) // Assert path is rooted
 * 	if err := write(path, content); err == nil {
 * 		return nil
 * 	}
 * 	if err := vfs.mkdirAll(tspath.GetDirectoryPath(tspath.NormalizePath(path))); err != nil {
 * 		return err
 * 	}
 * 	return write(path, content)
 * }
 */
export function ioFS_writeFileEnsuringDir(receiver: GoPtr<ioFS>, path: string, content: string, write: (path: string, content: string) => GoError): GoError {
  void RootLength(path); // Assert path is rooted
  const err = write(path, content);
  if (err === undefined) {
    return undefined;
  }
  const mkdirErr = receiver!.mkdirAll(GetDirectoryPath(NormalizePath(path)));
  if (mkdirErr !== undefined) {
    return mkdirErr;
  }
  return write(path, content);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::method::ioFS.WriteFile","kind":"method","status":"implemented","sigHash":"c28a99d306da8fe0adb6a1c745a1af22a8001db5530be5bf49b31e84c117962c","bodyHash":"b08e0c72c6f462ac4e400fcf1a159a5e39239b48903bd6e4ccc0d0e836ff34e5"}
 *
 * Go source:
 * func (vfs *ioFS) WriteFile(path string, content string) error {
 * 	return vfs.writeFileEnsuringDir(path, content, vfs.writeFile)
 * }
 */
export function ioFS_WriteFile(receiver: GoPtr<ioFS>, path: string, content: string): GoError {
  return ioFS_writeFileEnsuringDir(receiver, path, content, receiver!.writeFile);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::method::ioFS.AppendFile","kind":"method","status":"implemented","sigHash":"975ba3f205d540d2213cd55a4844c33c84fcb58b9c21742fb0e046fbeb4eb72d","bodyHash":"d9c21f0efb4f548cd7d0cb843ad933622986ced388fa24ac3cd9268852173106"}
 *
 * Go source:
 * func (vfs *ioFS) AppendFile(path string, content string) error {
 * 	return vfs.writeFileEnsuringDir(path, content, vfs.appendFile)
 * }
 */
export function ioFS_AppendFile(receiver: GoPtr<ioFS>, path: string, content: string): GoError {
  return ioFS_writeFileEnsuringDir(receiver, path, content, receiver!.appendFile);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/iovfs/iofs.go::method::ioFS.FSys","kind":"method","status":"implemented","sigHash":"be5f1951e8becfe2bd5d1ee5f3c8250ca9ebeadbb863606ad2935b0393e0e432","bodyHash":"44f73c0727a35287681d2565ac5e8f8db91beadcc887732f1707aecece5a19f9"}
 *
 * Go source:
 * func (vfs *ioFS) FSys() fs.FS {
 * 	return vfs.fsys
 * }
 */
export function ioFS_FSys(receiver: GoPtr<ioFS>): FS {
  return receiver!.fsys;
}
