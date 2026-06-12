import type { bool, int, long } from "@tsonic/core/types.js";
import { Buffer } from "node:buffer";
import type { GoError, GoPtr, GoSlice } from "../../go/compat.js";
import type { DirEntry, FileInfo as FileInfo_2d3efe16, FileMode } from "../../go/io/fs.js";
import { ModeDir, ModeIrregular, ModeSymlink, SkipAll as fs_SkipAll, SkipDir as fs_SkipDir } from "../../go/io/fs.js";
import { Time } from "../../go/time.js";
import * as strings from "../../go/strings.js";
import type { Entries, FileInfo, FS, WalkDirFunc } from "../vfs/vfs.js";
import { embeddedContents } from "./embed_generated.js";
import { LibNames } from "./libs_generated.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::constGroup::embedded","kind":"constGroup","status":"implemented","sigHash":"4c71f07d139be967c63073fca793530940c74775bb8902e2816a1d12ec2bd08f","bodyHash":"f575317f85db3dd4eeaa72c8c6480e2c2ffc1c7e96da5bb19215a3cd91d55649"}
 *
 * Go source:
 * const embedded = true
 */
export const embedded: bool = true;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::constGroup::scheme","kind":"constGroup","status":"implemented","sigHash":"9047b547a181961326430026263dae91a62be7a27c4e20c3eac32940617a36fb","bodyHash":"63100f2f96137829748042797a36cc0ad18b3e04618773bbcfdd7b903798f0d0"}
 *
 * Go source:
 * const scheme = "bundled:///"
 */
export const scheme: string = "bundled:///";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::func::splitPath","kind":"func","status":"implemented","sigHash":"b34d3f162d5152485f427f64af78d7661ceca2d4e8f2de2880c926c234dd3d60","bodyHash":"67396d4a361b65c9e6329010eb75b38031f622e51670558c72ec16e868d8b548"}
 *
 * Go source:
 * func splitPath(path string) (rest string, ok bool) {
 * 	return strings.CutPrefix(path, scheme)
 * }
 */
export function splitPath(path: string): [string, bool] {
  return strings.CutPrefix(path, scheme);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::func::libPath","kind":"func","status":"implemented","sigHash":"b88b4905dc1a9125df9a61712813c49a58a1686cc06cffaf1c72d4a41f7d9b49","bodyHash":"2d2015e00ec281b6c667fd69d942c89bb35af7268e9df7094121cb71b0349b78"}
 *
 * Go source:
 * func libPath() string {
 * 	return scheme + "libs"
 * }
 */
export function libPath(): string {
  return scheme + "libs";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::func::IsBundled","kind":"func","status":"implemented","sigHash":"3f477cfe9b05ddb51898d09813758cfacd213c1117616d19ee277dc5e15bc096","bodyHash":"cea6c7a7aaab233e206af17cccb2d9d677b5e46973ccf749950318301f4fcab9"}
 *
 * Go source:
 * func IsBundled(path string) bool {
 * 	_, ok := splitPath(path)
 * 	return ok
 * }
 */
export function IsBundled(path: string): bool {
  const [, ok] = splitPath(path);
  return ok;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::type::wrappedFS","kind":"type","status":"implemented","sigHash":"c574ef0310576d4c8e7dbf20af7dc5332b6edbc4b02bcc0aedb58bf4f2aeefb0","bodyHash":"a856bba3c14d2993d64916f190fd31505679a5fe2a06fb22094a2262cabb19fe"}
 *
 * Go source:
 * wrappedFS struct {
 * 	fs vfs.FS
 * }
 */
export interface wrappedFS {
  fs: FS;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"f1cb3516ddeee1dbf535730beeadf76270080ca3a749b3cac850570bfeeb5bcb"}
 *
 * Go source:
 * var _ vfs.FS = (*wrappedFS)(nil)
 */
export let __eb693fb3_0: FS = wrappedFS_as_vfs_FS(undefined);

export function wrappedFS_as_vfs_FS(receiver: GoPtr<wrappedFS>): FS {
  return {
    UseCaseSensitiveFileNames: () => wrappedFS_UseCaseSensitiveFileNames(receiver),
    FileExists: (path: string) => wrappedFS_FileExists(receiver, path),
    ReadFile: (path: string) => wrappedFS_ReadFile(receiver, path),
    WriteFile: (path: string, data: string) => wrappedFS_WriteFile(receiver, path, data),
    AppendFile: (path: string, data: string) => wrappedFS_AppendFile(receiver, path, data),
    Remove: (path: string) => wrappedFS_Remove(receiver, path),
    Chtimes: (path: string, aTime: Time, mTime: Time) => wrappedFS_Chtimes(receiver, path, aTime, mTime),
    DirectoryExists: (path: string) => wrappedFS_DirectoryExists(receiver, path),
    GetAccessibleEntries: (path: string) => wrappedFS_GetAccessibleEntries(receiver, path),
    Stat: (path: string) => wrappedFS_Stat(receiver, path),
    WalkDir: (root: string, walkFn: WalkDirFunc) => wrappedFS_WalkDir(receiver, root, walkFn),
    Realpath: (path: string) => wrappedFS_Realpath(receiver, path),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::func::wrapFS","kind":"func","status":"implemented","sigHash":"47cfe8da7e0cd5cc2c1c0216f3222db8d8e58c9f41164fe2c18174a5c0f956af","bodyHash":"3b618fc8f3a6e3ba6dfdfd96b6150bd885c8d229bad285f4722c071568f1140a"}
 *
 * Go source:
 * func wrapFS(fs vfs.FS) vfs.FS {
 * 	return &wrappedFS{fs: fs}
 * }
 */
export function wrapFS(fsArg: FS): FS {
  return wrappedFS_as_vfs_FS({ fs: fsArg });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::wrappedFS.UseCaseSensitiveFileNames","kind":"method","status":"implemented","sigHash":"a3b946fc50fe37e33374b955049a0fe1812bad4035ce5050c51b6b27a2377b0d","bodyHash":"c795fa64b3071d570322a93801035440473945a227c87030ca637d720df0ef21"}
 *
 * Go source:
 * func (vfs *wrappedFS) UseCaseSensitiveFileNames() bool {
 * 	return vfs.fs.UseCaseSensitiveFileNames()
 * }
 */
export function wrappedFS_UseCaseSensitiveFileNames(receiver: GoPtr<wrappedFS>): bool {
  return receiver!.fs.UseCaseSensitiveFileNames();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::wrappedFS.FileExists","kind":"method","status":"implemented","sigHash":"2a83bbbe163ad755cd2423de30ffe0725a22b62c6a3b27102930ab4bdfc2b71e","bodyHash":"49ee110cae83f6281ca077636ea2b5ae80582ecd7912475c7e401c5946bb3860"}
 *
 * Go source:
 * func (vfs *wrappedFS) FileExists(path string) bool {
 * 	if rest, ok := splitPath(path); ok {
 * 		_, ok := embeddedContents[rest]
 * 		return ok
 * 	}
 * 	return vfs.fs.FileExists(path)
 * }
 */
export function wrappedFS_FileExists(receiver: GoPtr<wrappedFS>, path: string): bool {
  const [rest, ok] = splitPath(path);
  if (ok) {
    return embeddedContents.has(rest) as bool;
  }
  return receiver!.fs.FileExists(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::wrappedFS.ReadFile","kind":"method","status":"implemented","sigHash":"1d775f9fdff56dd025c7493a1f5a9b240b49268c7068d2b9a258b74790c1e1bd","bodyHash":"bb0bc83495d0792adb9326b259b7d2abee71b292b7b78165c299a3d05ae80afe"}
 *
 * Go source:
 * func (vfs *wrappedFS) ReadFile(path string) (contents string, ok bool) {
 * 	if rest, ok := splitPath(path); ok {
 * 		contents, ok = embeddedContents[rest]
 * 		return contents, ok
 * 	}
 * 	return vfs.fs.ReadFile(path)
 * }
 */
export function wrappedFS_ReadFile(receiver: GoPtr<wrappedFS>, path: string): [string, bool] {
  const [rest, ok] = splitPath(path);
  if (ok) {
    const contents = embeddedContents.get(rest);
    return [contents ?? "", (contents !== undefined) as bool];
  }
  return receiver!.fs.ReadFile(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::wrappedFS.DirectoryExists","kind":"method","status":"implemented","sigHash":"d94b36574c82c0841d83a226295dda292757126c7be8d7fbc72d33f74d2dbe03","bodyHash":"b96d6ca88683f3ec7650fc92a1c9a92d732298d52cac602bb4f70f0ce727e18f"}
 *
 * Go source:
 * func (vfs *wrappedFS) DirectoryExists(path string) bool {
 * 	if rest, ok := splitPath(path); ok {
 * 		return rest == "libs"
 * 	}
 * 	return vfs.fs.DirectoryExists(path)
 * }
 */
export function wrappedFS_DirectoryExists(receiver: GoPtr<wrappedFS>, path: string): bool {
  const [rest, ok] = splitPath(path);
  if (ok) {
    return rest === "libs";
  }
  return receiver!.fs.DirectoryExists(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::wrappedFS.GetAccessibleEntries","kind":"method","status":"implemented","sigHash":"e99f64b4766e3582fa3942ca76a41f41bc95920b9f6ddc644d419d6ef1365cfa","bodyHash":"19e4f4262a90cb2f9665d06166aed5fda4c646a25a0f8a3490f40ef1d5f8f240"}
 *
 * Go source:
 * func (vfs *wrappedFS) GetAccessibleEntries(path string) (result vfs.Entries) {
 * 	if rest, ok := splitPath(path); ok {
 * 		if rest == "" {
 * 			result.Directories = []string{"libs"}
 * 		} else if rest == "libs" {
 * 			result.Files = LibNames
 * 		}
 * 		return result
 * 	}
 * 	return vfs.fs.GetAccessibleEntries(path)
 * }
 */
export function wrappedFS_GetAccessibleEntries(receiver: GoPtr<wrappedFS>, path: string): Entries {
  const [rest, ok] = splitPath(path);
  if (ok) {
    const result: Entries = { Files: [], Directories: [], Symlinks: undefined };
    if (rest === "") {
      result.Directories = ["libs"];
    } else if (rest === "libs") {
      result.Files = [...LibNames];
    }
    return result;
  }
  return receiver!.fs.GetAccessibleEntries(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::varGroup::rootEntries","kind":"varGroup","status":"implemented","sigHash":"91248ebfac2d91c9488a21e76f600fafcbf25a1045742439f0ae09fa44bc7c5a","bodyHash":"3a31a266dd5e8c633ec45d76a25047c191651032f7aa2c9723e5fd6c900bb8ed"}
 *
 * Go source:
 * var rootEntries = []fs.DirEntry{
 * 	fs.FileInfoToDirEntry(&fileInfo{name: "libs", mode: fs.ModeDir}),
 * }
 */
export let rootEntries: GoSlice<DirEntry> = [
  fileInfo_as_io_fs_DirEntry({ name: "libs", mode: ModeDir, size: 0 as long }),
];

export let libsEntries: GoSlice<DirEntry> = LibNames.map((name): DirEntry =>
  fileInfo_as_io_fs_DirEntry({
    name,
    mode: 0 as FileMode,
    size: Buffer.byteLength(embeddedContents.get(`libs/${name}`) ?? "", "utf8") as long,
  })
);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::wrappedFS.Stat","kind":"method","status":"implemented","sigHash":"812fc06d7c7368a66cc078e05e801c33874b41a18a50a41a0436c8d2a6478b7c","bodyHash":"7eb7a34e0d03deb3152762e4fb37f11ef61849f8ca35f1e8d015f2e66a29743d"}
 *
 * Go source:
 * func (vfs *wrappedFS) Stat(path string) vfs.FileInfo {
 * 	if rest, ok := splitPath(path); ok {
 * 		if rest == "" || rest == "libs" {
 * 			return &fileInfo{name: rest, mode: fs.ModeDir}
 * 		}
 * 		if lib, ok := embeddedContents[rest]; ok {
 * 			libName, _ := strings.CutPrefix(rest, "libs/")
 * 			return &fileInfo{name: libName, size: int64(len(lib))}
 * 		}
 * 		return nil
 * 	}
 * 	return vfs.fs.Stat(path)
 * }
 */
export function wrappedFS_Stat(receiver: GoPtr<wrappedFS>, path: string): GoPtr<FileInfo> {
  const [rest, ok] = splitPath(path);
  if (ok) {
    if (rest === "" || rest === "libs") {
      return fileInfo_as_io_fs_FileInfo({ name: rest, mode: ModeDir, size: 0 as long });
    }
    const lib = embeddedContents.get(rest);
    if (lib !== undefined) {
      const [libName] = strings.CutPrefix(rest, "libs/");
      return fileInfo_as_io_fs_FileInfo({ name: libName, mode: 0 as FileMode, size: Buffer.byteLength(lib, "utf8") as long });
    }
    return undefined;
  }
  return receiver!.fs.Stat(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::wrappedFS.WalkDir","kind":"method","status":"implemented","sigHash":"c4becc19e9de52b3fac992f8d905437452088dbffb56c7d765be774af42e0071","bodyHash":"a5331ec088797be4c909de3d765c7656930583441e63ded8cdb923d26c52e1a5"}
 *
 * Go source:
 * func (vfs *wrappedFS) WalkDir(root string, walkFn vfs.WalkDirFunc) error {
 * 	if rest, ok := splitPath(root); ok {
 * 		if err := vfs.walkDir(rest, walkFn); err != nil {
 * 			if err == fs.SkipAll { //nolint:errorlint
 * 				return nil
 * 			}
 * 			return err
 * 		}
 * 		return nil
 * 	}
 * 	return vfs.fs.WalkDir(root, walkFn)
 * }
 */
export function wrappedFS_WalkDir(receiver: GoPtr<wrappedFS>, root: string, walkFn: WalkDirFunc): GoError {
  const [rest, ok] = splitPath(root);
  if (ok) {
    const err = wrappedFS_walkDir(receiver, rest, walkFn);
    if (err !== undefined) {
      if (err === fs_SkipAll) {
        return undefined;
      }
      return err;
    }
    return undefined;
  }
  return receiver!.fs.WalkDir(root, walkFn);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::wrappedFS.walkDir","kind":"method","status":"implemented","sigHash":"aa8ab6f5cbf2b5cd56578cd2e6712e63034cb34aaddb23e553f99cd1b9f8da51","bodyHash":"f168130a4528be08845f43767875a6577a6d3afddf95e50901aeb97362a01fb3"}
 *
 * Go source:
 * func (vfs *wrappedFS) walkDir(rest string, walkFn vfs.WalkDirFunc) error {
 * 	var entries []fs.DirEntry
 * 	switch rest {
 * 	case "":
 * 		entries = rootEntries
 * 	case "libs":
 * 		entries = libsEntries
 * 	default:
 * 		return nil
 * 	}
 * 
 * 	for _, entry := range entries {
 * 		name := rest + "/" + entry.Name()
 * 
 * 		if err := walkFn(scheme+name, entry, nil); err != nil {
 * 			if err == fs.SkipAll { //nolint:errorlint
 * 				return fs.SkipAll
 * 			}
 * 			if err == fs.SkipDir { //nolint:errorlint
 * 				continue
 * 			}
 * 			return err
 * 		}
 * 		if entry.IsDir() {
 * 			if err := vfs.walkDir(strings.TrimPrefix(name, "/"), walkFn); err != nil {
 * 				return err
 * 			}
 * 		}
 * 	}
 * 
 * 	return nil
 * }
 */
export function wrappedFS_walkDir(receiver: GoPtr<wrappedFS>, rest: string, walkFn: WalkDirFunc): GoError {
  let entries: GoSlice<DirEntry>;
  switch (rest) {
    case "":
      entries = rootEntries;
      break;
    case "libs":
      entries = libsEntries;
      break;
    default:
      return undefined;
  }

  for (const entry of entries) {
    const name = `${rest}/${entry.Name()}`;
    const err = walkFn(`${scheme}${name}`, entry, undefined);
    if (err !== undefined) {
      if (err === fs_SkipAll) {
        return fs_SkipAll;
      }
      if (err === fs_SkipDir) {
        continue;
      }
      return err;
    }
    if (entry.IsDir()) {
      const childErr = wrappedFS_walkDir(receiver, strings.TrimPrefix(name, "/"), walkFn);
      if (childErr !== undefined) {
        return childErr;
      }
    }
  }

  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::wrappedFS.Realpath","kind":"method","status":"implemented","sigHash":"f4797cd87f8c6f24f9205cef35b869a75d5d50b0d30ace3c707071b4c61511c2","bodyHash":"eb6d9d6e9225c598527cb3dbe5d5aab7009ab6afeb45f8ba41f046434d31c925"}
 *
 * Go source:
 * func (vfs *wrappedFS) Realpath(path string) string {
 * 	if _, ok := splitPath(path); ok {
 * 		return path
 * 	}
 * 	return vfs.fs.Realpath(path)
 * }
 */
export function wrappedFS_Realpath(receiver: GoPtr<wrappedFS>, path: string): string {
  const [, ok] = splitPath(path);
  if (ok) {
    return path;
  }
  return receiver!.fs.Realpath(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::wrappedFS.WriteFile","kind":"method","status":"implemented","sigHash":"6ad29e8712048f2db85f838b6ed6a2743484f7f3e884a74fcce17fd27132a5a6","bodyHash":"12a1b61e1e35cd2e622a571452396169cdeef50e8e27a3666c8aa5c806f5bb0d"}
 *
 * Go source:
 * func (vfs *wrappedFS) WriteFile(path string, data string) error {
 * 	if _, ok := splitPath(path); ok {
 * 		panic("cannot write to embedded file system")
 * 	}
 * 	return vfs.fs.WriteFile(path, data)
 * }
 */
export function wrappedFS_WriteFile(receiver: GoPtr<wrappedFS>, path: string, data: string): GoError {
  const [, ok] = splitPath(path);
  if (ok) {
    throw new globalThis.Error("cannot write to embedded file system");
  }
  return receiver!.fs.WriteFile(path, data);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::wrappedFS.AppendFile","kind":"method","status":"implemented","sigHash":"38dc300d0994c0c084550b6d6ab736dd508b63230aa6f56d62ec95f8de3a6e56","bodyHash":"ce5a53103bfe3d2e0a15626f8e9995ec1e51ba57b318c972d0f07d8f96c8f66f"}
 *
 * Go source:
 * func (vfs *wrappedFS) AppendFile(path string, data string) error {
 * 	if _, ok := splitPath(path); ok {
 * 		panic("cannot write to embedded file system")
 * 	}
 * 	return vfs.fs.AppendFile(path, data)
 * }
 */
export function wrappedFS_AppendFile(receiver: GoPtr<wrappedFS>, path: string, data: string): GoError {
  const [, ok] = splitPath(path);
  if (ok) {
    throw new globalThis.Error("cannot write to embedded file system");
  }
  return receiver!.fs.AppendFile(path, data);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::wrappedFS.Remove","kind":"method","status":"implemented","sigHash":"0f1d30eeb7c94cffb6ccee90b18322f6572a6284c3454baf134e8e64a702f6b8","bodyHash":"a43bc86885d8990186165e66fe2f002ca0563faa870b82e0d7f2fc2c48b5ead0"}
 *
 * Go source:
 * func (vfs *wrappedFS) Remove(path string) error {
 * 	if _, ok := splitPath(path); ok {
 * 		panic("cannot remove from embedded file system")
 * 	}
 * 	return vfs.fs.Remove(path)
 * }
 */
export function wrappedFS_Remove(receiver: GoPtr<wrappedFS>, path: string): GoError {
  const [, ok] = splitPath(path);
  if (ok) {
    throw new globalThis.Error("cannot remove from embedded file system");
  }
  return receiver!.fs.Remove(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::wrappedFS.Chtimes","kind":"method","status":"implemented","sigHash":"2e86263484ee73d07d1c6a28d4942d1983f5dfa4544b5bf6d48f9279148c2619","bodyHash":"1cf908568c558d6edc6f9184b7fe0578f0c9e1ab808fa421d677125bea1cbf67"}
 *
 * Go source:
 * func (vfs *wrappedFS) Chtimes(path string, aTime time.Time, mTime time.Time) error {
 * 	if _, ok := splitPath(path); ok {
 * 		panic("cannot change times on embedded file system")
 * 	}
 * 	return vfs.fs.Chtimes(path, aTime, mTime)
 * }
 */
export function wrappedFS_Chtimes(receiver: GoPtr<wrappedFS>, path: string, aTime: Time, mTime: Time): GoError {
  const [, ok] = splitPath(path);
  if (ok) {
    throw new globalThis.Error("cannot change times on embedded file system");
  }
  return receiver!.fs.Chtimes(path, aTime, mTime);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::type::fileInfo","kind":"type","status":"implemented","sigHash":"faa9b0357889cb408ff2e938cc4e7f875987a9454f9d36a1c5d4d1b821973e4c","bodyHash":"00e29ed3ce3b8a5cd7b8d64ba2c87468ab7bb911444ec32c649337fb8259fa70"}
 *
 * Go source:
 * fileInfo struct {
 * 	mode fs.FileMode
 * 	name string
 * 	size int64
 * }
 */
export interface fileInfo {
  mode: FileMode;
  name: string;
  size: long;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::varGroup::_+_","kind":"varGroup","status":"implemented","sigHash":"606a448813ea549ca7a41fa67189d5c616eb07aa6693c9028679d4b9a5b43602","bodyHash":"911c2736c3ebb120b6cc6debded2c620e4aa45ceaf307f33e3827bf2bf4c202e"}
 *
 * Go source:
 * var (
 * 	_ fs.FileInfo = (*fileInfo)(nil)
 * 	_ fs.DirEntry = (*fileInfo)(nil)
 * )
 */
export let ____85348954_0: FileInfo_2d3efe16 = fileInfo_as_io_fs_FileInfo(undefined);
export let ____85348954_1: DirEntry = fileInfo_as_io_fs_DirEntry(undefined);

export function fileInfo_as_io_fs_FileInfo(receiver: GoPtr<fileInfo>): FileInfo_2d3efe16 {
  return {
    Name: (): string => fileInfo_Name(receiver),
    Size: (): int => fileInfo_Size(receiver) as unknown as int,
    Mode: (): FileMode => fileInfo_Mode(receiver),
    ModTime: (): Date => fileInfo_ModTime(receiver) as unknown as Date,
    IsDir: (): bool => fileInfo_IsDir(receiver),
    Sys: (): unknown => fileInfo_Sys(receiver),
  };
}

export function fileInfo_as_io_fs_DirEntry(receiver: GoPtr<fileInfo>): DirEntry {
  return {
    Name: (): string => fileInfo_Name(receiver),
    IsDir: (): bool => fileInfo_IsDir(receiver),
    Type: (): FileMode => fileInfo_Type(receiver),
    Info: (): [FileInfo_2d3efe16, GoError] => fileInfo_Info(receiver),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::fileInfo.IsDir","kind":"method","status":"implemented","sigHash":"46e731976895c34cc5422d5bd1aa06a85d77b6eaa86166775cb7680bb89c7ad5","bodyHash":"815c7b929b4ed799d69fb78ea6e8e3d65bdbf6bd06e3709d5320c485fb7e7c88"}
 *
 * Go source:
 * func (fi *fileInfo) IsDir() bool {
 * 	return fi.mode.IsDir()
 * }
 */
export function fileInfo_IsDir(receiver: GoPtr<fileInfo>): bool {
  return (((receiver!.mode as unknown as number) & (ModeDir as unknown as number)) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::fileInfo.ModTime","kind":"method","status":"implemented","sigHash":"539dddec1cf50cc71ed36d2b062062641aa4668450382abbc535f855f6eebd6c","bodyHash":"ea22b05b4a496350a554d9eac2407d359295d653e237f22008a1a1eb000fc8d5"}
 *
 * Go source:
 * func (fi *fileInfo) ModTime() time.Time {
 * 	return time.Time{}
 * }
 */
export function fileInfo_ModTime(_receiver: GoPtr<fileInfo>): Time {
  return new Time();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::fileInfo.Mode","kind":"method","status":"implemented","sigHash":"7f698306266a71a6417f56476c9b1e2ca8cdc1cddf328c4df69076eefb3ac444","bodyHash":"d4ef8a4775326129d3823ca914481e7bd857bf973e67b8b4ccdab0326a64c0eb"}
 *
 * Go source:
 * func (fi *fileInfo) Mode() fs.FileMode {
 * 	return fi.mode
 * }
 */
export function fileInfo_Mode(receiver: GoPtr<fileInfo>): FileMode {
  return receiver!.mode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::fileInfo.Name","kind":"method","status":"implemented","sigHash":"d69e71b95abc2221c07d0623044cc610a96870cbd335f1136939d8529c7141bd","bodyHash":"f5b8cbc5109072911ec85f47ba0f41e249663a4b3bd8342286063c104d3fd725"}
 *
 * Go source:
 * func (fi *fileInfo) Name() string {
 * 	return fi.name
 * }
 */
export function fileInfo_Name(receiver: GoPtr<fileInfo>): string {
  return receiver!.name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::fileInfo.Size","kind":"method","status":"implemented","sigHash":"997d58a0d60aad706d28f279189c25b815ab4cd1153cd910ab1b2c19c3b95489","bodyHash":"3d56a87a92e12c72c22e22b17e3561392c718168abb3fd843e2b938581bf76c7"}
 *
 * Go source:
 * func (fi *fileInfo) Size() int64 {
 * 	return fi.size
 * }
 */
export function fileInfo_Size(receiver: GoPtr<fileInfo>): long {
  return receiver!.size;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::fileInfo.Sys","kind":"method","status":"implemented","sigHash":"1ec93078d669789ba7f6751ba05c91294f7e23794ffe4e6e571826b386756bef","bodyHash":"60e52c753893fee17160dbe585b3133803f8e8ff8fa7b90f712118999cb1a253"}
 *
 * Go source:
 * func (fi *fileInfo) Sys() any {
 * 	return nil
 * }
 */
export function fileInfo_Sys(_receiver: GoPtr<fileInfo>): unknown {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::fileInfo.Info","kind":"method","status":"implemented","sigHash":"642d4aafd0cb54dd77f811579bd744d2c7408c130b7860ce29645e349a5abda7","bodyHash":"9e66324e2562a3109ceaee83ff357472caacbb2dba083bca517499522721c35b"}
 *
 * Go source:
 * func (fi *fileInfo) Info() (fs.FileInfo, error) {
 * 	return fi, nil
 * }
 */
export function fileInfo_Info(receiver: GoPtr<fileInfo>): [FileInfo_2d3efe16, GoError] {
  return [fileInfo_as_io_fs_FileInfo(receiver), undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/bundled/embed.go::method::fileInfo.Type","kind":"method","status":"implemented","sigHash":"55f045ae359e7cf8151611d367765f52d6b3cd17ec1460b68beeeba06ce64696","bodyHash":"a89264aaeca1beb408e80e03ca64dca8d10ca89fb21ffc237d1bbadbb1698c5d"}
 *
 * Go source:
 * func (fi *fileInfo) Type() fs.FileMode {
 * 	return fi.mode.Type()
 * }
 */
export function fileInfo_Type(receiver: GoPtr<fileInfo>): FileMode {
  return ((receiver!.mode as unknown as number) & ((ModeDir as unknown as number) | (ModeSymlink as unknown as number) | (ModeIrregular as unknown as number))) as unknown as FileMode;
}
