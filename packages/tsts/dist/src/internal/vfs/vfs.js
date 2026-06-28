import { ErrInvalid as fs_ErrInvalid, ErrPermission as fs_ErrPermission, ErrExist as fs_ErrExist, ErrNotExist as fs_ErrNotExist, ErrClosed as fs_ErrClosed, SkipAll as fs_SkipAll, SkipDir as fs_SkipDir } from "../../go/io/fs.js";
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
export const ErrInvalid = fs_ErrInvalid;
export const ErrPermission = fs_ErrPermission;
export const ErrExist = fs_ErrExist;
export const ErrNotExist = fs_ErrNotExist;
export const ErrClosed = fs_ErrClosed;
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
export const SkipAll = fs_SkipAll;
export const SkipDir = fs_SkipDir;
//# sourceMappingURL=vfs.js.map