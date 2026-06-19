import type { bool } from "../../../go/scalars.js";
import type { GoError, GoPtr } from "../../../go/compat.js";
import type { Time } from "../../../go/time.js";
import type { Entries, FileInfo, FS, WalkDirFunc } from "../vfs.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::type::Replacements","kind":"type","status":"implemented","sigHash":"cefb899fcad2162eeb3a014e97c0b2fea8ff4e05a236a6d42cbe1e62aea57bf7","bodyHash":"38f6b3682164b5d419adb0f02146de4e16cc857e03bb44d66a66e059c0aa3cb9"}
 *
 * Go source:
 * Replacements struct {
 * 	UseCaseSensitiveFileNames func() bool
 * 	FileExists                func(string) bool
 * 	ReadFile                  func(string) (string, bool)
 * 	WriteFile                 func(string, string) error
 * 	AppendFile                func(string, string) error
 * 	Remove                    func(string) error
 * 	Chtimes                   func(string, time.Time, time.Time) error
 * 	DirectoryExists           func(string) bool
 * 	GetAccessibleEntries      func(string) vfs.Entries
 * 	Stat                      func(string) vfs.FileInfo
 * 	WalkDir                   func(string, vfs.WalkDirFunc) error
 * 	Realpath                  func(string) string
 * }
 */
export interface Replacements {
  UseCaseSensitiveFileNames: () => bool;
  FileExists: (arg0: string) => bool;
  ReadFile: (arg0: string) => [string, bool];
  WriteFile: (arg0: string, arg1: string) => GoError;
  AppendFile: (arg0: string, arg1: string) => GoError;
  Remove: (arg0: string) => GoError;
  Chtimes: (arg0: string, arg1: Time, arg2: Time) => GoError;
  DirectoryExists: (arg0: string) => bool;
  GetAccessibleEntries: (arg0: string) => Entries;
  Stat: (arg0: string) => GoPtr<FileInfo>;
  WalkDir: (arg0: string, arg1: WalkDirFunc) => GoError;
  Realpath: (arg0: string) => string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::func::Wrap","kind":"func","status":"implemented","sigHash":"f7080c63bde43ead409ae534899aa90352977d432e1ca320a8ed6dc053fed746","bodyHash":"7b37cf4be8a00dc0fd33328a5fe5b9bac8de3c743cd8ba9499892845babf03c9"}
 *
 * Go source:
 * func Wrap(fs vfs.FS, replacements Replacements) vfs.FS {
 * 	return &wrappedFS{
 * 		fs:           fs,
 * 		replacements: replacements,
 * 	}
 * }
 */
export function Wrap(fs: FS, replacements: Replacements): FS {
  const w: wrappedFS = { fs, replacements };
  return wrappedFS_as_vfs_FS(w);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::type::wrappedFS","kind":"type","status":"implemented","sigHash":"c574ef0310576d4c8e7dbf20af7dc5332b6edbc4b02bcc0aedb58bf4f2aeefb0","bodyHash":"cc3c5df3b97c93352813c694b8314865647cc6350ea3a9adf832c7d033bc82c0"}
 *
 * Go source:
 * wrappedFS struct {
 * 	fs           vfs.FS
 * 	replacements Replacements
 * }
 */
export interface wrappedFS {
  fs: FS;
  replacements: Replacements;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::method::wrappedFS.UseCaseSensitiveFileNames","kind":"method","status":"implemented","sigHash":"36a6d4224df9eceb63912b0f4bb4c2cf2350dbf5bf4105c9829dc588f27c6b66","bodyHash":"d2a3e14da1d315fb78bffe8001d9312c3a5d621a9f871ec3c0677f2a1b796f25"}
 *
 * Go source:
 * func (w *wrappedFS) UseCaseSensitiveFileNames() bool {
 * 	if w.replacements.UseCaseSensitiveFileNames != nil {
 * 		return w.replacements.UseCaseSensitiveFileNames()
 * 	}
 * 	return w.fs.UseCaseSensitiveFileNames()
 * }
 */
export function wrappedFS_UseCaseSensitiveFileNames(receiver: GoPtr<wrappedFS>): bool {
  if (receiver!.replacements.UseCaseSensitiveFileNames !== undefined) {
    return receiver!.replacements.UseCaseSensitiveFileNames();
  }
  return receiver!.fs.UseCaseSensitiveFileNames();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::method::wrappedFS.FileExists","kind":"method","status":"implemented","sigHash":"70e9465488de5481939662ccd2947380cb354e1e70e68ca5654224fb66c9989a","bodyHash":"c97a206aa53f173157adc7dc8f697fd04da48d8a49c421a60ece0541386f1c60"}
 *
 * Go source:
 * func (w *wrappedFS) FileExists(path string) bool {
 * 	if w.replacements.FileExists != nil {
 * 		return w.replacements.FileExists(path)
 * 	}
 * 	return w.fs.FileExists(path)
 * }
 */
export function wrappedFS_FileExists(receiver: GoPtr<wrappedFS>, path: string): bool {
  if (receiver!.replacements.FileExists !== undefined) {
    return receiver!.replacements.FileExists(path);
  }
  return receiver!.fs.FileExists(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::method::wrappedFS.ReadFile","kind":"method","status":"implemented","sigHash":"f5ab4ff07601bc21a5e254d0410e13b931d2b80edc9d6a0cc378ed6afd751120","bodyHash":"bfb2661c109f90100499337448609c2cea01111552a152ddb1d46a00db95a43f"}
 *
 * Go source:
 * func (w *wrappedFS) ReadFile(path string) (contents string, ok bool) {
 * 	if w.replacements.ReadFile != nil {
 * 		return w.replacements.ReadFile(path)
 * 	}
 * 	return w.fs.ReadFile(path)
 * }
 */
export function wrappedFS_ReadFile(receiver: GoPtr<wrappedFS>, path: string): [string, bool] {
  if (receiver!.replacements.ReadFile !== undefined) {
    return receiver!.replacements.ReadFile(path);
  }
  return receiver!.fs.ReadFile(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::method::wrappedFS.WriteFile","kind":"method","status":"implemented","sigHash":"ef26456b10e18fda46bda87037ddd8d56d379bf581f5594c522c5231ffa88c4b","bodyHash":"d745e56c8a31599f728c808adf028f736d70f100abf6a5f2793b527ae8bd0560"}
 *
 * Go source:
 * func (w *wrappedFS) WriteFile(path string, data string) error {
 * 	if w.replacements.WriteFile != nil {
 * 		return w.replacements.WriteFile(path, data)
 * 	}
 * 	return w.fs.WriteFile(path, data)
 * }
 */
export function wrappedFS_WriteFile(receiver: GoPtr<wrappedFS>, path: string, data: string): GoError {
  if (receiver!.replacements.WriteFile !== undefined) {
    return receiver!.replacements.WriteFile(path, data);
  }
  return receiver!.fs.WriteFile(path, data);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::method::wrappedFS.AppendFile","kind":"method","status":"implemented","sigHash":"93cea65476ec8d884a32f0d25af6a4b3015f5402c168c2a571cba5572cc734f1","bodyHash":"b4dd7aee58e9e1e43d7eb5c1365709d8123a88e47fb8a5c196f227b0b5deebb0"}
 *
 * Go source:
 * func (w *wrappedFS) AppendFile(path string, data string) error {
 * 	if w.replacements.AppendFile != nil {
 * 		return w.replacements.AppendFile(path, data)
 * 	}
 * 	return w.fs.AppendFile(path, data)
 * }
 */
export function wrappedFS_AppendFile(receiver: GoPtr<wrappedFS>, path: string, data: string): GoError {
  if (receiver!.replacements.AppendFile !== undefined) {
    return receiver!.replacements.AppendFile(path, data);
  }
  return receiver!.fs.AppendFile(path, data);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::method::wrappedFS.Remove","kind":"method","status":"implemented","sigHash":"1e4b7f20a06d444a73ffcef4a8170439c071257c5e17202f48db6ea94ca5eb27","bodyHash":"0960e71b02cbab8447f42bc260c28e739de5e8dff2a64f449218dcecfbf7a6c9"}
 *
 * Go source:
 * func (w *wrappedFS) Remove(path string) error {
 * 	if w.replacements.Remove != nil {
 * 		return w.replacements.Remove(path)
 * 	}
 * 	return w.fs.Remove(path)
 * }
 */
export function wrappedFS_Remove(receiver: GoPtr<wrappedFS>, path: string): GoError {
  if (receiver!.replacements.Remove !== undefined) {
    return receiver!.replacements.Remove(path);
  }
  return receiver!.fs.Remove(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::method::wrappedFS.Chtimes","kind":"method","status":"implemented","sigHash":"c3314c3de39dfe9b8aed75849dac08305f208087a5a5c92a00363abc0289e0d6","bodyHash":"b5b5fea843137530fde85c89aeb23b57b545f713eafd2a099da28290fece5cde"}
 *
 * Go source:
 * func (w *wrappedFS) Chtimes(path string, aTime time.Time, mTime time.Time) error {
 * 	if w.replacements.Chtimes != nil {
 * 		return w.replacements.Chtimes(path, aTime, mTime)
 * 	}
 * 	return w.fs.Chtimes(path, aTime, mTime)
 * }
 */
export function wrappedFS_Chtimes(receiver: GoPtr<wrappedFS>, path: string, aTime: Time, mTime: Time): GoError {
  if (receiver!.replacements.Chtimes !== undefined) {
    return receiver!.replacements.Chtimes(path, aTime, mTime);
  }
  return receiver!.fs.Chtimes(path, aTime, mTime);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::method::wrappedFS.DirectoryExists","kind":"method","status":"implemented","sigHash":"3db938aff540a387608e290e47a5e83f522bead9ef231d83f2ffab013d6bb99a","bodyHash":"d901bc0666efb0fa8d84c58b679f9dab9aa8234619a37d4a0db0679cfc65a5bf"}
 *
 * Go source:
 * func (w *wrappedFS) DirectoryExists(path string) bool {
 * 	if w.replacements.DirectoryExists != nil {
 * 		return w.replacements.DirectoryExists(path)
 * 	}
 * 	return w.fs.DirectoryExists(path)
 * }
 */
export function wrappedFS_DirectoryExists(receiver: GoPtr<wrappedFS>, path: string): bool {
  if (receiver!.replacements.DirectoryExists !== undefined) {
    return receiver!.replacements.DirectoryExists(path);
  }
  return receiver!.fs.DirectoryExists(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::method::wrappedFS.GetAccessibleEntries","kind":"method","status":"implemented","sigHash":"9c47b52da1a0df560dcf5d2b30c9ef822d929f8273ecf24209745f8506df3a25","bodyHash":"bcc159f23799722621fec416cdbaca3dcb14e5ccf7abae18a4e84b4f95934f02"}
 *
 * Go source:
 * func (w *wrappedFS) GetAccessibleEntries(path string) vfs.Entries {
 * 	if w.replacements.GetAccessibleEntries != nil {
 * 		return w.replacements.GetAccessibleEntries(path)
 * 	}
 * 	return w.fs.GetAccessibleEntries(path)
 * }
 */
export function wrappedFS_GetAccessibleEntries(receiver: GoPtr<wrappedFS>, path: string): Entries {
  if (receiver!.replacements.GetAccessibleEntries !== undefined) {
    return receiver!.replacements.GetAccessibleEntries(path);
  }
  return receiver!.fs.GetAccessibleEntries(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::method::wrappedFS.Stat","kind":"method","status":"implemented","sigHash":"5c157652effdcdd8b326af2172ec92fcf456cb2ed9c2da1ba60cd77ed53c7398","bodyHash":"7c85b10eb6f1783892e66f696815906ca17bf177250e80cbc7ebc1db1bb16377"}
 *
 * Go source:
 * func (w *wrappedFS) Stat(path string) vfs.FileInfo {
 * 	if w.replacements.Stat != nil {
 * 		return w.replacements.Stat(path)
 * 	}
 * 	return w.fs.Stat(path)
 * }
 */
export function wrappedFS_Stat(receiver: GoPtr<wrappedFS>, path: string): GoPtr<FileInfo> {
  if (receiver!.replacements.Stat !== undefined) {
    return receiver!.replacements.Stat(path);
  }
  return receiver!.fs.Stat(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::method::wrappedFS.WalkDir","kind":"method","status":"implemented","sigHash":"712990931e59a4982b158d2203881ceeabaf4470375a0db1138fc6dad19ae158","bodyHash":"310ec5c1dbd03d4c4e65dec40ed42f613005dec8df8044188b21caaca2fc3c79"}
 *
 * Go source:
 * func (w *wrappedFS) WalkDir(root string, walkFn vfs.WalkDirFunc) error {
 * 	if w.replacements.WalkDir != nil {
 * 		return w.replacements.WalkDir(root, walkFn)
 * 	}
 * 	return w.fs.WalkDir(root, walkFn)
 * }
 */
export function wrappedFS_WalkDir(receiver: GoPtr<wrappedFS>, root: string, walkFn: WalkDirFunc): GoError {
  if (receiver!.replacements.WalkDir !== undefined) {
    return receiver!.replacements.WalkDir(root, walkFn);
  }
  return receiver!.fs.WalkDir(root, walkFn);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::method::wrappedFS.Realpath","kind":"method","status":"implemented","sigHash":"b9d37c6acae6ba86e0f76be91834fbda4ae214358c2f78d2efd6e570ccc9500b","bodyHash":"94aac08127d5e5e20a6000b86d9987e6cb9ddf41c8608f7e1e75dbaa9f0c7a3a"}
 *
 * Go source:
 * func (w *wrappedFS) Realpath(path string) string {
 * 	if w.replacements.Realpath != nil {
 * 		return w.replacements.Realpath(path)
 * 	}
 * 	return w.fs.Realpath(path)
 * }
 */
export function wrappedFS_Realpath(receiver: GoPtr<wrappedFS>, path: string): string {
  if (receiver!.replacements.Realpath !== undefined) {
    return receiver!.replacements.Realpath(path);
  }
  return receiver!.fs.Realpath(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/wrapvfs/wrapvfs.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"f1cb3516ddeee1dbf535730beeadf76270080ca3a749b3cac850570bfeeb5bcb"}
 *
 * Go source:
 * var _ vfs.FS = (*wrappedFS)(nil)
 */
export let __f805346f_0: FS = wrappedFS_as_vfs_FS(undefined);

export function wrappedFS_as_vfs_FS(receiver: GoPtr<wrappedFS>): FS {
  return {
    UseCaseSensitiveFileNames: (): bool => wrappedFS_UseCaseSensitiveFileNames(receiver),
    FileExists: (path: string): bool => wrappedFS_FileExists(receiver, path),
    ReadFile: (path: string): [string, bool] => wrappedFS_ReadFile(receiver, path),
    WriteFile: (path: string, data: string): GoError => wrappedFS_WriteFile(receiver, path, data),
    AppendFile: (path: string, data: string): GoError => wrappedFS_AppendFile(receiver, path, data),
    Remove: (path: string): GoError => wrappedFS_Remove(receiver, path),
    Chtimes: (path: string, aTime: Time, mTime: Time): GoError => wrappedFS_Chtimes(receiver, path, aTime, mTime),
    DirectoryExists: (path: string): bool => wrappedFS_DirectoryExists(receiver, path),
    GetAccessibleEntries: (path: string): Entries => wrappedFS_GetAccessibleEntries(receiver, path),
    Stat: (path: string): GoPtr<FileInfo> => wrappedFS_Stat(receiver, path),
    WalkDir: (root: string, walkFn: WalkDirFunc): GoError => wrappedFS_WalkDir(receiver, root, walkFn),
    Realpath: (path: string): string => wrappedFS_Realpath(receiver, path),
  };
}
