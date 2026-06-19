import type { bool } from "../../go/scalars.js";
import type { GoError, GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { DirEntry as DirEntry_697d4ab0, FileInfo as FileInfo_d0619f84, WalkDirFunc as WalkDirFunc_40040532 } from "../../go/io/fs.js";
import { ErrInvalid as fs_ErrInvalid, ErrPermission as fs_ErrPermission, ErrExist as fs_ErrExist, ErrNotExist as fs_ErrNotExist, ErrClosed as fs_ErrClosed, SkipAll as fs_SkipAll, SkipDir as fs_SkipDir } from "../../go/io/fs.js";
import type { Time } from "../../go/time.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfs.go::type::FS","kind":"type","status":"implemented","sigHash":"89aa29ea0662e3b87adfcbc18b9a591e0e13783d583d2f530d6fb511e1f67835","bodyHash":"8c6f880f74bf8699f2ba61150297a56173f1599e0c4befa33a3ed9b867bdcea0"}
 *
 * Go source:
 * FS interface {
 * 	// UseCaseSensitiveFileNames returns true if the file system is case-sensitive.
 * 	UseCaseSensitiveFileNames() bool
 * 
 * 	// FileExists returns true if the file exists.
 * 	FileExists(path string) bool
 * 
 * 	// ReadFile reads the file specified by path and returns the content.
 * 	// If the file fails to be read, ok will be false.
 * 	ReadFile(path string) (contents string, ok bool)
 * 
 * 	WriteFile(path string, data string) error
 * 
 * 	// AppendFile appends data to the file at path, creating it if it does not exist.
 * 	AppendFile(path string, data string) error
 * 
 * 	// Removes `path` and all its contents. Will return the first error it encounters.
 * 	Remove(path string) error
 * 
 * 	// Chtimes changes the access and modification times of the named
 * 	Chtimes(path string, aTime time.Time, mTime time.Time) error
 * 
 * 	// DirectoryExists returns true if the path is a directory.
 * 	DirectoryExists(path string) bool
 * 
 * 	// GetAccessibleEntries returns the files/directories in the specified directory.
 * 	// If any entry is a symlink, it will be followed.
 * 	GetAccessibleEntries(path string) Entries
 * 
 * 	Stat(path string) FileInfo
 * 
 * 	// WalkDir walks the file tree rooted at root, calling walkFn for each file or directory in the tree.
 * 	// It is has the same behavior as [fs.WalkDir], but with paths as [string].
 * 	WalkDir(root string, walkFn WalkDirFunc) error
 * 
 * 	// Realpath returns the "real path" of the specified path,
 * 	// following symlinks and correcting filename casing.
 * 	Realpath(path string) string
 * }
 */
export interface FS {
  UseCaseSensitiveFileNames(): bool;
  FileExists(path: string): bool;
  ReadFile(path: string): [string, bool];
  WriteFile(path: string, data: string): GoError;
  AppendFile(path: string, data: string): GoError;
  Remove(path: string): GoError;
  Chtimes(path: string, aTime: Time, mTime: Time): GoError;
  DirectoryExists(path: string): bool;
  GetAccessibleEntries(path: string): Entries;
  Stat(path: string): GoPtr<FileInfo>;
  WalkDir(root: string, walkFn: WalkDirFunc): GoError;
  Realpath(path: string): string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfs.go::type::Entries","kind":"type","status":"implemented","sigHash":"697650e259811d1d518f77cfdc2e2573468ae2dc5e9b906f4fd4bece634065aa","bodyHash":"370d83d54e45af72c9318f741d1517899e306581ae43cf20deb2bc52fab73202"}
 *
 * Go source:
 * Entries struct {
 * 	Files       []string
 * 	Directories []string
 * 	// Symlinks contains the names of entries in Files or Directories that were
 * 	// originally symbolic links (or reparse points) on disk. The names are the
 * 	// same as those in Files/Directories (i.e., the link name, not the target).
 * 	// nil means symlink information is not available and the entries may need
 * 	// to be re-checked for symlinks.
 * 	Symlinks map[string]struct{}
 * }
 */
export interface Entries {
  Files: GoSlice<string>;
  Directories: GoSlice<string>;
  Symlinks: GoPtr<GoMap<string, { readonly __tsgoEmpty?: never }>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfs.go::type::DirEntry","kind":"type","status":"implemented","sigHash":"707ed6017614567632eef95dd0ff07a4dd549047176522f016bfce2e17fdd2fd","bodyHash":"811d25b3ff97f926744aeb6a9cce608a4ebed001967733fbec630ee482aca9a6"}
 *
 * Go source:
 * DirEntry = fs.DirEntry
 */
export type DirEntry = DirEntry_697d4ab0;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfs.go::type::FileInfo","kind":"type","status":"implemented","sigHash":"acd13f9330866e2a01ca698480f28444a40f52bd5791b7b7ce6d44531a23e43f","bodyHash":"65d6fa77718a797c07b120885ceff3553880f99dc6f069884980616609d84036"}
 *
 * Go source:
 * FileInfo = fs.FileInfo
 */
export type FileInfo = FileInfo_d0619f84;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfs.go::varGroup::ErrInvalid+ErrPermission+ErrExist+ErrNotExist+ErrClosed","kind":"varGroup","status":"implemented","sigHash":"619ab6e5324629e1538c06ace75a19a241e5f289199bc672c21c2f7ec54e913e","bodyHash":"06981bc89cb10aef7c4797409efe3ac7990ec196df70e4ee6ffd4da9c4458c6c"}
 *
 * Go source:
 * var (
 * 	ErrInvalid    = fs.ErrInvalid    // "invalid argument"
 * 	ErrPermission = fs.ErrPermission // "permission denied"
 * 	ErrExist      = fs.ErrExist      // "file already exists"
 * 	ErrNotExist   = fs.ErrNotExist   // "file does not exist"
 * 	ErrClosed     = fs.ErrClosed     // "file already closed"
 * )
 */
export const ErrInvalid: GoError = fs_ErrInvalid;
export const ErrPermission: GoError = fs_ErrPermission;
export const ErrExist: GoError = fs_ErrExist;
export const ErrNotExist: GoError = fs_ErrNotExist;
export const ErrClosed: GoError = fs_ErrClosed;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfs.go::type::WalkDirFunc","kind":"type","status":"implemented","sigHash":"ca37042359f26a00fc83e50feccf63f10e2500b876459905c74a9bda2c1cfec2","bodyHash":"301672f78484847fa673dfaecd15ffeff4359409ae960949fe1be7b744fa8046"}
 *
 * Go source:
 * WalkDirFunc = fs.WalkDirFunc
 */
export type WalkDirFunc = WalkDirFunc_40040532;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfs.go::varGroup::SkipAll+SkipDir","kind":"varGroup","status":"implemented","sigHash":"bc3ace7a351bcb6cf431374ee4018465eed6be3178862ed702a0dcf643a0b86b","bodyHash":"ff93c6365facc26d4879bcc622f9d9bd5761c666ac1f01c53b38144d010dca21"}
 *
 * Go source:
 * var (
 * 	// SkipAll is [fs.SkipAll].
 * 	SkipAll = fs.SkipAll //nolint:errname
 * 
 * 	// SkipDir is [fs.SkipDir].
 * 	SkipDir = fs.SkipDir //nolint:errname
 * )
 */
export const SkipAll: GoError = fs_SkipAll;
export const SkipDir: GoError = fs_SkipDir;
