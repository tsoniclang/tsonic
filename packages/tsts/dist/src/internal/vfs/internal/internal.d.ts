import type { bool, int } from "@tsonic/core/types.js";
import type { GoError, GoPtr, GoSlice } from "../../../go/compat.js";
import type { ByteOrder } from "../../../go/encoding/binary.js";
import type { FS, WalkDirFunc } from "../../../go/io/fs.js";
import type { DirEntry, Entries, FileInfo } from "../vfs.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/internal/internal.go::type::Common","kind":"type","status":"implemented","sigHash":"cc65d17e65e9de241504cec36dc63839e4025fb80c1511fe3b145c1cdb1af9ba","bodyHash":"83ca938ae0a7f2ee0c5582ef0ae8cf46aec5dbe5c930ac981b04a7300526f448"}
 *
 * Go source:
 * Common struct {
 * 	RootFor        func(root string) fs.FS
 * 	IsReparsePoint func(path string) bool
 * }
 */
export interface Common {
    RootFor: (root: string) => FS;
    IsReparsePoint: (path: string) => bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/internal/internal.go::func::RootLength","kind":"func","status":"implemented","sigHash":"fc7b90436434eabc47c57f8ee3e62dc90978c1018b4bc4435774e46857e62f34","bodyHash":"d1f7eff9fe5241386fa42be443898631fc0c20b5283b24723a4fee54e9c70f26"}
 *
 * Go source:
 * func RootLength(p string) int {
 * 	l := tspath.GetEncodedRootLength(p)
 * 	if l == 0 {
 * 		panic(fmt.Sprintf("vfs: path %q is not absolute", p))
 * 	} else if l < 0 {
 * 		return ^l
 * 	}
 * 	return l
 * }
 */
export declare function RootLength(p: string): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/internal/internal.go::func::SplitPath","kind":"func","status":"implemented","sigHash":"a5a17233797ab1b25132f7e015fe8ae6f704d9a4aff08bd374ee02e94cdfee07","bodyHash":"32e8bcd8145b9d78ad50a7f3a58da43dee9c8bbf1bcedb07988ffe15f2ed5c9f"}
 *
 * Go source:
 * func SplitPath(p string) (rootName, rest string) {
 * 	p = tspath.NormalizePath(p)
 * 	l := RootLength(p)
 * 	rootName, rest = p[:l], p[l:]
 * 	rest = tspath.RemoveTrailingDirectorySeparator(rest)
 * 	return rootName, rest
 * }
 */
export declare function SplitPath(p: string): [string, string];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/internal/internal.go::method::Common.RootAndPath","kind":"method","status":"implemented","sigHash":"b3f8aae815d288096eb17f609907dacb1623b82e97e4682920e10be2d957f51a","bodyHash":"2a68d64cb141d674340c23aa703c0e623a11206c153ac7ab55787d0327c05209"}
 *
 * Go source:
 * func (vfs *Common) RootAndPath(path string) (fsys fs.FS, rootName string, rest string) {
 * 	rootName, rest = SplitPath(path)
 * 	if rest == "" {
 * 		rest = "."
 * 	}
 * 	return vfs.RootFor(rootName), rootName, rest
 * }
 */
export declare function Common_RootAndPath(receiver: GoPtr<Common>, path: string): [FS, string, string];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/internal/internal.go::method::Common.Stat","kind":"method","status":"implemented","sigHash":"951163363ad8a28632591eeefa8e79f0b36c7a9fc637f8be4ef01a2ed52c4b71","bodyHash":"bded9b36166fce959dc50e2c6380d0c410d5d96333d0c4c0fd337ac4cf2bd61c"}
 *
 * Go source:
 * func (vfs *Common) Stat(path string) vfs.FileInfo {
 * 	fsys, _, rest := vfs.RootAndPath(path)
 * 	if fsys == nil {
 * 		return nil
 * 	}
 * 	stat, err := fs.Stat(fsys, rest)
 * 	if err != nil {
 * 		return nil
 * 	}
 * 	return stat
 * }
 */
export declare function Common_Stat(receiver: GoPtr<Common>, path: string): FileInfo | undefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/internal/internal.go::method::Common.FileExists","kind":"method","status":"implemented","sigHash":"6abe3180444423ce071a28896566dca2b6620e650de67c187eccc978d24b341f","bodyHash":"b129d244d59d1930959457b9bff41a725216ba426872039e312300601a4167f5"}
 *
 * Go source:
 * func (vfs *Common) FileExists(path string) bool {
 * 	stat := vfs.Stat(path)
 * 	return stat != nil && !stat.IsDir()
 * }
 */
export declare function Common_FileExists(receiver: GoPtr<Common>, path: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/internal/internal.go::method::Common.DirectoryExists","kind":"method","status":"implemented","sigHash":"1e1b84df8968e040f81b2c5073357a60dd8e80b5e83cc2e94492a4cafa41637e","bodyHash":"21bcbd2e829e97ba0821e3cd77c8b4cae3d73cdf953a71e6bd7a1bbbe7485e1e"}
 *
 * Go source:
 * func (vfs *Common) DirectoryExists(path string) bool {
 * 	stat := vfs.Stat(path)
 * 	return stat != nil && stat.IsDir()
 * }
 */
export declare function Common_DirectoryExists(receiver: GoPtr<Common>, path: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/internal/internal.go::method::Common.GetAccessibleEntries","kind":"method","status":"implemented","sigHash":"4ce17bf0db936b6644e90a870c7903b113d2149b6311cf70d940cd57887404e9","bodyHash":"5aa78b714a83c93411cfb81ed9440e9a8c2051243cb2277e22ba177a12ba343b"}
 *
 * Go source:
 * func (vfs *Common) GetAccessibleEntries(path string) (result vfs.Entries) {
 * 	addToResult := func(name string, mode fs.FileMode) (added bool) {
 * 		if mode.IsDir() {
 * 			result.Directories = append(result.Directories, name)
 * 			return true
 * 		}
 *
 * 		if mode.IsRegular() {
 * 			result.Files = append(result.Files, name)
 * 			return true
 * 		}
 *
 * 		return false
 * 	}
 *
 * 	for _, entry := range vfs.getEntries(path) {
 * 		entryType := entry.Type()
 *
 * 		if addToResult(entry.Name(), entryType) {
 * 			continue
 * 		}
 *
 * 		if entryType&fs.ModeSymlink != 0 {
 * 			// Easy case; UNIX-like system will clearly mark symlinks.
 * 			if stat := vfs.Stat(path + "/" + entry.Name()); stat != nil {
 * 				addToResult(entry.Name(), stat.Mode())
 * 			}
 * 			continue
 * 		}
 *
 * 		if entryType&fs.ModeIrregular != 0 && vfs.IsReparsePoint != nil {
 * 			// Could be a Windows junction or other reparse point.
 * 			// Check using the OS-specific helper.
 * 			fullPath := path + "/" + entry.Name()
 * 			if vfs.IsReparsePoint(fullPath) {
 * 				if stat := vfs.Stat(fullPath); stat != nil {
 * 					addToResult(entry.Name(), stat.Mode())
 * 				}
 * 			}
 * 			continue
 * 		}
 * 	}
 *
 * 	return result
 * }
 */
export declare function Common_GetAccessibleEntries(receiver: GoPtr<Common>, path: string): Entries;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/internal/internal.go::method::Common.getEntries","kind":"method","status":"implemented","sigHash":"336e429681bc0336d7d9c6d7b6475cbfb287354614f3c8bf8485f0fdeb36275f","bodyHash":"7a9202bbaed3eac081705eb5ddc2a9ced9d7187f45e69903dc239c8fb53e1602"}
 *
 * Go source:
 * func (vfs *Common) getEntries(path string) []vfs.DirEntry {
 * 	fsys, _, rest := vfs.RootAndPath(path)
 * 	if fsys == nil {
 * 		return nil
 * 	}
 *
 * 	entries, err := fs.ReadDir(fsys, rest)
 * 	if err != nil {
 * 		return nil
 * 	}
 *
 * 	return entries
 * }
 */
export declare function Common_getEntries(receiver: GoPtr<Common>, path: string): GoSlice<DirEntry>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/internal/internal.go::method::Common.WalkDir","kind":"method","status":"implemented","sigHash":"46ecf525c13012a883b2d6b823dcc844931e2ae7cebac10ea906b1c1e2858ea7","bodyHash":"93cd9bf43520e6842dfbd3a4200c35ee4d1c3306556ea7776d4fffd8076c16c0"}
 *
 * Go source:
 * func (vfs *Common) WalkDir(root string, walkFn fs.WalkDirFunc) error {
 * 	fsys, rootName, rest := vfs.RootAndPath(root)
 * 	if fsys == nil {
 * 		return nil
 * 	}
 * 	return fs.WalkDir(fsys, rest, func(path string, d fs.DirEntry, err error) error {
 * 		if path == "." {
 * 			path = ""
 * 		}
 * 		return walkFn(rootName+path, d, err)
 * 	})
 * }
 */
export declare function Common_WalkDir(receiver: GoPtr<Common>, root: string, walkFn: WalkDirFunc): GoError;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/internal/internal.go::method::Common.ReadFile","kind":"method","status":"implemented","sigHash":"26bd9d609af222a179a5f57a83bb78d5b9d133c2201ada15e860c682709e2b4f","bodyHash":"bc3d2c210d1a3e271e8d14cfe3951d780455458e12b24b3ad01b60459900db05"}
 *
 * Go source:
 * func (vfs *Common) ReadFile(path string) (contents string, ok bool) {
 * 	fsys, _, rest := vfs.RootAndPath(path)
 * 	if fsys == nil {
 * 		return "", false
 * 	}
 *
 * 	b, err := fs.ReadFile(fsys, rest)
 * 	if err != nil {
 * 		return "", false
 * 	}
 *
 * 	// An invariant of any underlying filesystem is that the bytes returned
 * 	// are immutable, otherwise anyone using the filesystem would end up
 * 	// with data races.
 * 	//
 * 	// This means that we can safely convert the bytes to a string directly,
 * 	// saving a copy.
 * 	if len(b) == 0 {
 * 		return "", true
 * 	}
 *
 * 	s := unsafe.String(&b[0], len(b))
 *
 * 	return decodeBytes(s)
 * }
 */
export declare function Common_ReadFile(receiver: GoPtr<Common>, path: string): [string, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/internal/internal.go::func::decodeBytes","kind":"func","status":"implemented","sigHash":"9af05afe32155426111b5e882975ba3b71cad643d996fdd1a70e42a2c2c650e4","bodyHash":"8da55d6ba04e2489956add989d5912f09dd7a416d6ecd40259d9a0982b569827"}
 *
 * Go source:
 * func decodeBytes(s string) (contents string, ok bool) {
 * 	var bom [2]byte
 * 	if len(s) >= 2 {
 * 		bom = [2]byte{s[0], s[1]}
 * 		switch bom {
 * 		case [2]byte{0xFF, 0xFE}:
 * 			return decodeUtf16(s[2:], binary.LittleEndian), true
 * 		case [2]byte{0xFE, 0xFF}:
 * 			return decodeUtf16(s[2:], binary.BigEndian), true
 * 		}
 * 	}
 * 	if len(s) >= 3 && s[0] == 0xEF && s[1] == 0xBB && s[2] == 0xBF {
 * 		s = s[3:]
 * 	}
 *
 * 	return s, true
 * }
 */
export declare function decodeBytes(s: string): [string, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/internal/internal.go::func::decodeUtf16","kind":"func","status":"implemented","sigHash":"9a2464e1ae656956db538b4fe310ed91a6ef82b2f3ac7783eca09717f4a3ab84","bodyHash":"bef28f3056dc277d3a4a5ae1f0199ff9987f5779cb4aee263ffe30cb2ef1cc51"}
 *
 * Go source:
 * func decodeUtf16(s string, order binary.ByteOrder) string {
 * 	ints := make([]uint16, len(s)/2)
 * 	if err := binary.Read(strings.NewReader(s), order, &ints); err != nil {
 * 		return ""
 * 	}
 * 	return string(utf16.Decode(ints))
 * }
 */
export declare function decodeUtf16(bytes: Uint8Array, order: ByteOrder): string;
//# sourceMappingURL=internal.d.ts.map