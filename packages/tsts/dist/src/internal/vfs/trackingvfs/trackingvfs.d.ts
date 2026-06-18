import type { bool } from "@tsonic/core/types.js";
import type { GoError, GoPtr } from "../../../go/compat.js";
import type { Time } from "../../../go/time.js";
import type { SyncSet } from "../../collections/syncset.js";
import type { Entries, FileInfo, FS as FS_2329d319, WalkDirFunc } from "../vfs.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/trackingvfs/trackingvfs.go::type::FS","kind":"type","status":"implemented","sigHash":"4ab1e95f0000b741e0a1207c003511f4aa44319f6dc8e9c634f57d33c3b0afa4","bodyHash":"30053028ff3bfe5aabf6bdf1e75cb3da747df28dd72f5cc762348189001806e2"}
 *
 * Go source:
 * FS struct {
 * 	Inner     vfs.FS
 * 	SeenFiles collections.SyncSet[string]
 * }
 */
export interface FS {
    Inner: FS_2329d319;
    SeenFiles: SyncSet;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/trackingvfs/trackingvfs.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"56c7355c9f6a8b3a02b0f81e66f6b3e4b9f10476c06641ddd7459f367652293d"}
 *
 * Go source:
 * var _ vfs.FS = (*FS)(nil)
 */
export declare let __325b3fb8_0: FS_2329d319;
export declare function FS_as_vfs_FS(receiver: GoPtr<FS>): FS_2329d319;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/trackingvfs/trackingvfs.go::method::FS.ReadFile","kind":"method","status":"implemented","sigHash":"0fc65c4feba146a08be237f67aa3407d02685a8b5ce626ef8567c64d2dd24daf","bodyHash":"701bb50657959b0bad726bcfe1411d9eadf9568f2d03e77b5dd125e59543eaaa"}
 *
 * Go source:
 * func (fs *FS) ReadFile(path string) (string, bool) {
 * 	fs.SeenFiles.Add(path)
 * 	return fs.Inner.ReadFile(path)
 * }
 */
export declare function FS_ReadFile(receiver: GoPtr<FS>, path: string): [string, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/trackingvfs/trackingvfs.go::method::FS.FileExists","kind":"method","status":"implemented","sigHash":"4022b97f73395261aafa72b8154213d8a0664c2bf2d7aeda4e51f6f2f198121b","bodyHash":"b7bdd9188c4ad11a7b4553947eb6718d294d564a80cdb9c4f6467cfffada0d40"}
 *
 * Go source:
 * func (fs *FS) FileExists(path string) bool {
 * 	fs.SeenFiles.Add(path)
 * 	return fs.Inner.FileExists(path)
 * }
 */
export declare function FS_FileExists(receiver: GoPtr<FS>, path: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/trackingvfs/trackingvfs.go::method::FS.UseCaseSensitiveFileNames","kind":"method","status":"implemented","sigHash":"3e6b7f37ac13432bcd08bf9336cfc069ebe66e9cd0c57541a812464b21178863","bodyHash":"6f7abc642afc9ca1ecde8f7d3aeb1f79a7ffb65c3bcb6c339205981fe13248f7"}
 *
 * Go source:
 * func (fs *FS) UseCaseSensitiveFileNames() bool { return fs.Inner.UseCaseSensitiveFileNames() }
 */
export declare function FS_UseCaseSensitiveFileNames(receiver: GoPtr<FS>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/trackingvfs/trackingvfs.go::method::FS.WriteFile","kind":"method","status":"implemented","sigHash":"ff6bdaaa6e7de5e996257800bed27ae1cd16b8ba95fbffb9327771be9fd9f49b","bodyHash":"509746f2f6ad87f440f774ba9168f673bf048aa59b932b93e1fed3acee830cef"}
 *
 * Go source:
 * func (fs *FS) WriteFile(path string, data string) error {
 * 	return fs.Inner.WriteFile(path, data)
 * }
 */
export declare function FS_WriteFile(receiver: GoPtr<FS>, path: string, data: string): GoError;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/trackingvfs/trackingvfs.go::method::FS.AppendFile","kind":"method","status":"implemented","sigHash":"96a8577216fce4419e4ffa6cf48f6c27c9dbe45f40c77ea3b13c4e37ce89f315","bodyHash":"a82588a141a68d8a689fb2bbd5aa9565e1478253811b77c578507f3b956cd5bf"}
 *
 * Go source:
 * func (fs *FS) AppendFile(path string, data string) error {
 * 	return fs.Inner.AppendFile(path, data)
 * }
 */
export declare function FS_AppendFile(receiver: GoPtr<FS>, path: string, data: string): GoError;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/trackingvfs/trackingvfs.go::method::FS.Remove","kind":"method","status":"implemented","sigHash":"beb2e4ec7a10333fcc76cb1088e8cc2c876a49229f487a8c1cc3cea62389bcde","bodyHash":"fc1b9cd0f290ec94c073b1ea800ba88e126c203e49b997db3f663c38e751944e"}
 *
 * Go source:
 * func (fs *FS) Remove(path string) error { return fs.Inner.Remove(path) }
 */
export declare function FS_Remove(receiver: GoPtr<FS>, path: string): GoError;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/trackingvfs/trackingvfs.go::method::FS.Chtimes","kind":"method","status":"implemented","sigHash":"a5b9b4a1995ff25b5ca57243527b590e986925f49c6217c7bc5db5285cd2bc9d","bodyHash":"665db232bc688aa09d5c70918013037275ff31b1a1d41051987d925b47e26617"}
 *
 * Go source:
 * func (fs *FS) Chtimes(path string, aTime time.Time, mTime time.Time) error {
 * 	return fs.Inner.Chtimes(path, aTime, mTime)
 * }
 */
export declare function FS_Chtimes(receiver: GoPtr<FS>, path: string, aTime: Time, mTime: Time): GoError;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/trackingvfs/trackingvfs.go::method::FS.DirectoryExists","kind":"method","status":"implemented","sigHash":"29417d9d9599bd399b156e6488a9401e2257d9cc45889c707bad1c23b192d099","bodyHash":"d7507c3eae1db070bc3cd4789d81fc6a018d3db0e108b1997071f07195bd8b1d"}
 *
 * Go source:
 * func (fs *FS) DirectoryExists(path string) bool {
 * 	fs.SeenFiles.Add(path)
 * 	return fs.Inner.DirectoryExists(path)
 * }
 */
export declare function FS_DirectoryExists(receiver: GoPtr<FS>, path: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/trackingvfs/trackingvfs.go::method::FS.GetAccessibleEntries","kind":"method","status":"implemented","sigHash":"cc54219e570f4c7a2928f279202d9588463e9007f2ab24e5c5245eb33d00039e","bodyHash":"232f2469fdb8af49f6aa4ecb1f749e9ad70da649a4e6b6aaff9da86949a29ff8"}
 *
 * Go source:
 * func (fs *FS) GetAccessibleEntries(path string) vfs.Entries {
 * 	fs.SeenFiles.Add(path)
 * 	return fs.Inner.GetAccessibleEntries(path)
 * }
 */
export declare function FS_GetAccessibleEntries(receiver: GoPtr<FS>, path: string): Entries;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/trackingvfs/trackingvfs.go::method::FS.Stat","kind":"method","status":"implemented","sigHash":"729186fb2718f26a75c0b4d37d399045bdae9c1b1dffe909c66f4dc2d2670821","bodyHash":"88b1bf1b6acfd6caafd17e8250e72f10f86059d98a883375641cb0f35aba2fea"}
 *
 * Go source:
 * func (fs *FS) Stat(path string) vfs.FileInfo {
 * 	fs.SeenFiles.Add(path)
 * 	return fs.Inner.Stat(path)
 * }
 */
export declare function FS_Stat(receiver: GoPtr<FS>, path: string): GoPtr<FileInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/trackingvfs/trackingvfs.go::method::FS.WalkDir","kind":"method","status":"implemented","sigHash":"1f36a47e0b58d1e515c8371bec0b0594669d1f19089ad8f4fa57d1f725ad5ea7","bodyHash":"61ff9a71f31de888dff96d32164896e4ab902266b304ef245ad0ecf27c305f59"}
 *
 * Go source:
 * func (fs *FS) WalkDir(root string, walkFn vfs.WalkDirFunc) error {
 * 	fs.SeenFiles.Add(root)
 * 	return fs.Inner.WalkDir(root, func(path string, d vfs.DirEntry, err error) error {
 * 		fs.SeenFiles.Add(path)
 * 		return walkFn(path, d, err)
 * 	})
 * }
 */
export declare function FS_WalkDir(receiver: GoPtr<FS>, root: string, walkFn: WalkDirFunc): GoError;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/trackingvfs/trackingvfs.go::method::FS.Realpath","kind":"method","status":"implemented","sigHash":"38ebf96e7dddd630abbd257354fcdf836352bbd9e9c028ed12f428a2df8969c7","bodyHash":"034e5913a1fe7ed89c37c3a9a180cbb36c93bfdaddcb26076199a011dc290c6c"}
 *
 * Go source:
 * func (fs *FS) Realpath(path string) string { return fs.Inner.Realpath(path) }
 */
export declare function FS_Realpath(receiver: GoPtr<FS>, path: string): string;
//# sourceMappingURL=trackingvfs.d.ts.map