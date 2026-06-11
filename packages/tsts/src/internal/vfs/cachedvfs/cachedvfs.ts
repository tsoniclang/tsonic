import type { bool } from "@tsonic/core/types.js";
import type { GoError, GoPtr } from "../../../go/compat.js";
import { Map as SyncGoMap } from "../../../go/sync.js";
import { Bool } from "../../../go/sync/atomic.js";
import type { Time } from "../../../go/time.js";
import { SyncMap_Clear, SyncMap_Load, SyncMap_Store } from "../../collections/syncmap.js";
import type { SyncMap } from "../../collections/syncmap.js";
import type { Entries, FileInfo, FS as FS_296ac81f, WalkDirFunc } from "../vfs.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::type::FS","kind":"type","status":"implemented","sigHash":"4ab1e95f0000b741e0a1207c003511f4aa44319f6dc8e9c634f57d33c3b0afa4","bodyHash":"3bdbd7415c67215a30a19c2aea69fc8f9ae4c754c629b781144ac763012aa85d"}
 *
 * Go source:
 * FS struct {
 * 	fs      vfs.FS
 * 	enabled atomic.Bool
 * 
 * 	directoryExistsCache      collections.SyncMap[string, bool]
 * 	fileExistsCache           collections.SyncMap[string, bool]
 * 	getAccessibleEntriesCache collections.SyncMap[string, vfs.Entries]
 * 	realpathCache             collections.SyncMap[string, string]
 * 	statCache                 collections.SyncMap[string, vfs.FileInfo]
 * }
 */
export interface FS {
  fs: FS_296ac81f;
  enabled: Bool;
  directoryExistsCache: SyncMap;
  fileExistsCache: SyncMap;
  getAccessibleEntriesCache: SyncMap;
  realpathCache: SyncMap;
  statCache: SyncMap;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"56c7355c9f6a8b3a02b0f81e66f6b3e4b9f10476c06641ddd7459f367652293d"}
 *
 * Go source:
 * var _ vfs.FS = (*FS)(nil)
 */
export let __2bea44dc_0: FS_296ac81f = FS_as_vfs_FS(undefined);

export function FS_as_vfs_FS(receiver: GoPtr<FS>): FS_296ac81f {
  return {
    UseCaseSensitiveFileNames: (): bool => FS_UseCaseSensitiveFileNames(receiver),
    FileExists: (path: string): bool => FS_FileExists(receiver, path),
    ReadFile: (path: string): [string, bool] => FS_ReadFile(receiver, path),
    WriteFile: (path: string, data: string): GoError => FS_WriteFile(receiver, path, data),
    AppendFile: (path: string, data: string): GoError => FS_AppendFile(receiver, path, data),
    Remove: (path: string): GoError => FS_Remove(receiver, path),
    Chtimes: (path: string, aTime: Time, mTime: Time): GoError => FS_Chtimes(receiver, path, aTime, mTime),
    DirectoryExists: (path: string): bool => FS_DirectoryExists(receiver, path),
    GetAccessibleEntries: (path: string): Entries => FS_GetAccessibleEntries(receiver, path),
    Stat: (path: string): GoPtr<FileInfo> => FS_Stat(receiver, path),
    WalkDir: (root: string, walkFn: WalkDirFunc): GoError => FS_WalkDir(receiver, root, walkFn),
    Realpath: (path: string): string => FS_Realpath(receiver, path),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::func::From","kind":"func","status":"implemented","sigHash":"abe992f0d6b4b9496524ff64cb3c8b9bbdffea5043020f715dac57fe89cfba95","bodyHash":"98bf79e8b8f29fe54e2bb36576e14d7edd93ba918777024d5a8e944ecbe65af5"}
 *
 * Go source:
 * func From(fs vfs.FS) *FS {
 * 	fsys := &FS{fs: fs}
 * 	fsys.enabled.Store(true)
 * 	return fsys
 * }
 */
export function From(fs: FS_296ac81f): GoPtr<FS> {
  const fsys: FS = {
    fs: fs,
    enabled: new Bool(),
    directoryExistsCache: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncGoMap() } as SyncMap<string, bool>,
    fileExistsCache: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncGoMap() } as SyncMap<string, bool>,
    getAccessibleEntriesCache: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncGoMap() } as SyncMap<string, Entries>,
    realpathCache: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncGoMap() } as SyncMap<string, string>,
    statCache: { __tsgoBlank0: [], __tsgoBlank1: [], m: new SyncGoMap() } as SyncMap<string, FileInfo>,
  };
  fsys.enabled.Store(true as bool);
  return fsys;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.DisableAndClearCache","kind":"method","status":"implemented","sigHash":"6186f14992ee42819a61ccba286672c3ccb7005ceecf6e3f953fcfa4d045ecc3","bodyHash":"af539af39d2d848a6c69b7c975e485f9692bb228e2d07c33cf163fa0fe998f9b"}
 *
 * Go source:
 * func (fsys *FS) DisableAndClearCache() {
 * 	if fsys.enabled.CompareAndSwap(true, false) {
 * 		fsys.ClearCache()
 * 	}
 * }
 */
export function FS_DisableAndClearCache(receiver: GoPtr<FS>): void {
  if (receiver!.enabled.CompareAndSwap(true as bool, false as bool)) {
    FS_ClearCache(receiver);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.Enable","kind":"method","status":"implemented","sigHash":"d5072f2bc9c57194ae5866e3b5cebe64b9389ccc4ccceb8c6e7c6974238375e9","bodyHash":"b419404c069a5bae75980862a9ee2ed8113ff7cf1481bb3d0c33d5fd81494919"}
 *
 * Go source:
 * func (fsys *FS) Enable() {
 * 	fsys.enabled.Store(true)
 * }
 */
export function FS_Enable(receiver: GoPtr<FS>): void {
  receiver!.enabled.Store(true as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.ClearCache","kind":"method","status":"implemented","sigHash":"20a0d7694ff8afd728827282b004afce7da781305f5c72b28a858452621a8fff","bodyHash":"b3062faacb72badcd39e884a356c9d4848d6381d48f47dccdfd7783deb6ffc0a"}
 *
 * Go source:
 * func (fsys *FS) ClearCache() {
 * 	fsys.directoryExistsCache.Clear()
 * 	fsys.fileExistsCache.Clear()
 * 	fsys.getAccessibleEntriesCache.Clear()
 * 	fsys.realpathCache.Clear()
 * 	fsys.statCache.Clear()
 * }
 */
export function FS_ClearCache(receiver: GoPtr<FS>): void {
  SyncMap_Clear(receiver!.directoryExistsCache);
  SyncMap_Clear(receiver!.fileExistsCache);
  SyncMap_Clear(receiver!.getAccessibleEntriesCache);
  SyncMap_Clear(receiver!.realpathCache);
  SyncMap_Clear(receiver!.statCache);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.DirectoryExists","kind":"method","status":"implemented","sigHash":"46772efdb87f2631c018e78bb149aa483bf81fec8403cdde1d24f12a4a3f67b9","bodyHash":"0a68db97d0a95871f86d116a68df729b70d3c8bf7ae7500b3f0f16631c598f32"}
 *
 * Go source:
 * func (fsys *FS) DirectoryExists(path string) bool {
 * 	if fsys.enabled.Load() {
 * 		if ret, ok := fsys.directoryExistsCache.Load(path); ok {
 * 			return ret
 * 		}
 * 	}
 * 
 * 	ret := fsys.fs.DirectoryExists(path)
 * 
 * 	if fsys.enabled.Load() {
 * 		fsys.directoryExistsCache.Store(path, ret)
 * 	}
 * 
 * 	return ret
 * }
 */
export function FS_DirectoryExists(receiver: GoPtr<FS>, path: string): bool {
  if (receiver!.enabled.Load()) {
    const [ret, ok] = SyncMap_Load<string, bool>(receiver!.directoryExistsCache as unknown as SyncMap<string, bool>, path);
    if (ok) {
      return ret;
    }
  }
  const ret = receiver!.fs.DirectoryExists(path);
  if (receiver!.enabled.Load()) {
    SyncMap_Store<string, bool>(receiver!.directoryExistsCache as unknown as SyncMap<string, bool>, path, ret);
  }
  return ret;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.FileExists","kind":"method","status":"implemented","sigHash":"cb258fe98ae3554787a1ee69520c3a9f102796a6eb87aacac87515607c543653","bodyHash":"37016774bdadf7200a04cb0f8ba7f9246b0a5034b78ba09523869ffd530b15a8"}
 *
 * Go source:
 * func (fsys *FS) FileExists(path string) bool {
 * 	if fsys.enabled.Load() {
 * 		if ret, ok := fsys.fileExistsCache.Load(path); ok {
 * 			return ret
 * 		}
 * 	}
 * 
 * 	ret := fsys.fs.FileExists(path)
 * 
 * 	if fsys.enabled.Load() {
 * 		fsys.fileExistsCache.Store(path, ret)
 * 	}
 * 
 * 	return ret
 * }
 */
export function FS_FileExists(receiver: GoPtr<FS>, path: string): bool {
  if (receiver!.enabled.Load()) {
    const [ret, ok] = SyncMap_Load<string, bool>(receiver!.fileExistsCache as unknown as SyncMap<string, bool>, path);
    if (ok) {
      return ret;
    }
  }
  const ret = receiver!.fs.FileExists(path);
  if (receiver!.enabled.Load()) {
    SyncMap_Store<string, bool>(receiver!.fileExistsCache as unknown as SyncMap<string, bool>, path, ret);
  }
  return ret;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.GetAccessibleEntries","kind":"method","status":"implemented","sigHash":"de2d6af196ad24496f70ec618ed8bbe013487b5791271d1a88d37d18ef19f676","bodyHash":"a8ca63e46dda7bb583f0011df4411c43812409d9408fbe66927aaa117de1be62"}
 *
 * Go source:
 * func (fsys *FS) GetAccessibleEntries(path string) vfs.Entries {
 * 	if fsys.enabled.Load() {
 * 		if ret, ok := fsys.getAccessibleEntriesCache.Load(path); ok {
 * 			return ret
 * 		}
 * 	}
 * 
 * 	ret := fsys.fs.GetAccessibleEntries(path)
 * 
 * 	if fsys.enabled.Load() {
 * 		fsys.getAccessibleEntriesCache.Store(path, ret)
 * 	}
 * 
 * 	return ret
 * }
 */
export function FS_GetAccessibleEntries(receiver: GoPtr<FS>, path: string): Entries {
  if (receiver!.enabled.Load()) {
    const [ret, ok] = SyncMap_Load<string, Entries>(receiver!.getAccessibleEntriesCache as unknown as SyncMap<string, Entries>, path);
    if (ok) {
      return ret;
    }
  }
  const ret = receiver!.fs.GetAccessibleEntries(path);
  if (receiver!.enabled.Load()) {
    SyncMap_Store<string, Entries>(receiver!.getAccessibleEntriesCache as unknown as SyncMap<string, Entries>, path, ret);
  }
  return ret;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.ReadFile","kind":"method","status":"implemented","sigHash":"b7771b66d5df21db63dc180ae16a9553f02db00afe38e5bb052c0780e5d32a48","bodyHash":"f12f439fdb111995ab88bd83acbd8c50369c0bc883ae64172bce8d5442e4a82d"}
 *
 * Go source:
 * func (fsys *FS) ReadFile(path string) (contents string, ok bool) {
 * 	return fsys.fs.ReadFile(path)
 * }
 */
export function FS_ReadFile(receiver: GoPtr<FS>, path: string): [string, bool] {
  return receiver!.fs.ReadFile(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.Realpath","kind":"method","status":"implemented","sigHash":"b384719a70231106ba246bfd4161dedb467204c3ff763fccae77fe09962e89e6","bodyHash":"56763432bebb930f1c1d8da4825d8de4cadb21189b516f85360fa30458d32d53"}
 *
 * Go source:
 * func (fsys *FS) Realpath(path string) string {
 * 	if fsys.enabled.Load() {
 * 		if ret, ok := fsys.realpathCache.Load(path); ok {
 * 			return ret
 * 		}
 * 	}
 * 
 * 	ret := fsys.fs.Realpath(path)
 * 
 * 	if fsys.enabled.Load() {
 * 		fsys.realpathCache.Store(path, ret)
 * 	}
 * 
 * 	return ret
 * }
 */
export function FS_Realpath(receiver: GoPtr<FS>, path: string): string {
  if (receiver!.enabled.Load()) {
    const [ret, ok] = SyncMap_Load<string, string>(receiver!.realpathCache as unknown as SyncMap<string, string>, path);
    if (ok) {
      return ret;
    }
  }
  const ret = receiver!.fs.Realpath(path);
  if (receiver!.enabled.Load()) {
    SyncMap_Store<string, string>(receiver!.realpathCache as unknown as SyncMap<string, string>, path, ret);
  }
  return ret;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.Remove","kind":"method","status":"implemented","sigHash":"ca4e8ad85b7f71259b58f476bf02f5836785316ff3c4ae36c24711a6f9717ba7","bodyHash":"fc95aa3c02c156833bd3e5552642116504ce18a5a044bae1ea71cfd5f52ec1fd"}
 *
 * Go source:
 * func (fsys *FS) Remove(path string) error {
 * 	return fsys.fs.Remove(path)
 * }
 */
export function FS_Remove(receiver: GoPtr<FS>, path: string): GoError {
  return receiver!.fs.Remove(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.Chtimes","kind":"method","status":"implemented","sigHash":"cfc77bbdf1dc53eba8395ddcf207986a09756c34ed427944d7bd2ee3c7e301a6","bodyHash":"9c712ffcd826a530275d7f49a20766fd6e630d63d109f2c2d18d14919c7a1e22"}
 *
 * Go source:
 * func (fsys *FS) Chtimes(path string, aTime time.Time, mTime time.Time) error {
 * 	return fsys.fs.Chtimes(path, aTime, mTime)
 * }
 */
export function FS_Chtimes(receiver: GoPtr<FS>, path: string, aTime: Time, mTime: Time): GoError {
  return receiver!.fs.Chtimes(path, aTime, mTime);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.Stat","kind":"method","status":"implemented","sigHash":"38f3fd0a71f84a3986e7c4e8f8cf9d11f583e705fe843e262e644e0e44ef530b","bodyHash":"7d49b05fb89ea65cdca7a327f8b0b321f7c083cbb2a03082dc06eda5e2e63fe9"}
 *
 * Go source:
 * func (fsys *FS) Stat(path string) vfs.FileInfo {
 * 	if fsys.enabled.Load() {
 * 		if ret, ok := fsys.statCache.Load(path); ok {
 * 			return ret
 * 		}
 * 	}
 * 
 * 	ret := fsys.fs.Stat(path)
 * 
 * 	if fsys.enabled.Load() {
 * 		fsys.statCache.Store(path, ret)
 * 	}
 * 
 * 	return ret
 * }
 */
export function FS_Stat(receiver: GoPtr<FS>, path: string): GoPtr<FileInfo> {
  if (receiver!.enabled.Load()) {
    const [ret, ok] = SyncMap_Load<string, GoPtr<FileInfo>>(receiver!.statCache as unknown as SyncMap<string, GoPtr<FileInfo>>, path);
    if (ok) {
      return ret;
    }
  }
  const ret = receiver!.fs.Stat(path);
  if (receiver!.enabled.Load()) {
    SyncMap_Store<string, GoPtr<FileInfo>>(receiver!.statCache as unknown as SyncMap<string, GoPtr<FileInfo>>, path, ret);
  }
  return ret;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.UseCaseSensitiveFileNames","kind":"method","status":"implemented","sigHash":"eb2e68ccee0c340a6a58f0df058e817759849ff72bf8b39faf1b5ba971927c56","bodyHash":"461dcb5822959929dff58e070dd0b0927b8b8885a1ae8d501829c0dd53e6e4f5"}
 *
 * Go source:
 * func (fsys *FS) UseCaseSensitiveFileNames() bool {
 * 	return fsys.fs.UseCaseSensitiveFileNames()
 * }
 */
export function FS_UseCaseSensitiveFileNames(receiver: GoPtr<FS>): bool {
  return receiver!.fs.UseCaseSensitiveFileNames();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.WalkDir","kind":"method","status":"implemented","sigHash":"99af5f12094bb8403b4c4c3b13f325397b56ed36c40a0a747907a5421898cb44","bodyHash":"038e22782045ab7b2765544e31e65feefa378363ffc619e57f2b604c5cfab793"}
 *
 * Go source:
 * func (fsys *FS) WalkDir(root string, walkFn vfs.WalkDirFunc) error {
 * 	return fsys.fs.WalkDir(root, walkFn)
 * }
 */
export function FS_WalkDir(receiver: GoPtr<FS>, root: string, walkFn: WalkDirFunc): GoError {
  return receiver!.fs.WalkDir(root, walkFn);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.WriteFile","kind":"method","status":"implemented","sigHash":"237557a3917a50b74dc3d9d0f16ac1b9d628f1eb2b4e73d93877b8f70d165c0b","bodyHash":"6348000b00e9ffab0260e64a093ae8ab6a4a90363e8f99687a5207c19f6be88a"}
 *
 * Go source:
 * func (fsys *FS) WriteFile(path string, data string) error {
 * 	return fsys.fs.WriteFile(path, data)
 * }
 */
export function FS_WriteFile(receiver: GoPtr<FS>, path: string, data: string): GoError {
  return receiver!.fs.WriteFile(path, data);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/cachedvfs/cachedvfs.go::method::FS.AppendFile","kind":"method","status":"implemented","sigHash":"92f3ab899c545b408024cf34510e6d9971801d8b9eaed1afb0464669346e6d9c","bodyHash":"490705bc03cbb55f1006b6d21b8c0decef0411a64b270501bc3c0640a4c7c772"}
 *
 * Go source:
 * func (fsys *FS) AppendFile(path string, data string) error {
 * 	return fsys.fs.AppendFile(path, data)
 * }
 */
export function FS_AppendFile(receiver: GoPtr<FS>, path: string, data: string): GoError {
  return receiver!.fs.AppendFile(path, data);
}
