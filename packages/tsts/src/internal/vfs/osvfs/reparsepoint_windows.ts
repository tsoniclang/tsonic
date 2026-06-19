import type { bool, int } from "../../../go/scalars.js";
import * as syscall from "../../../go/syscall.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/reparsepoint_windows.go::func::isReparsePoint","kind":"func","status":"implemented","sigHash":"d4bef745351fcd4ddf809d58eb14bebafb475ab0154b95d6c3969a6ec92e71bf","bodyHash":"dcf9f8c184b13f68d067fdb90b4621efef48f2e8baf886eadb395db347772506"}
 *
 * Go source:
 * func isReparsePoint(path string) bool {
 * 	if len(path) >= 248 {
 * 		path = `\\?\` + path
 * 	}
 *
 * 	pathUTF16, err := syscall.UTF16PtrFromString(path)
 * 	if err != nil {
 * 		return false
 * 	}
 *
 * 	var data syscall.Win32FileAttributeData
 * 	err = syscall.GetFileAttributesEx(
 * 		pathUTF16,
 * 		syscall.GetFileExInfoStandard,
 * 		(*byte)(unsafe.Pointer(&data)),
 * 	)
 * 	if err != nil {
 * 		return false
 * 	}
 *
 * 	return data.FileAttributes&syscall.FILE_ATTRIBUTE_REPARSE_POINT != 0
 * }
 */
export function isReparsePoint(path: string): bool {
  let p = path;
  if (p.length >= 248) {
    p = "\\\\?\\" + p;
  }

  const [pathUTF16, pathUTF16Err] = syscall.UTF16PtrFromString(p) as [unknown, { message: string } | undefined];
  if (pathUTF16Err !== undefined) {
    return false as bool;
  }

  const data = { FileAttributes: 0 as int };
  const getAttrErr = syscall.GetFileAttributesEx(
    pathUTF16,
    syscall.GetFileExInfoStandard,
    data,
  ) as { message: string } | undefined;
  if (getAttrErr !== undefined) {
    return false as bool;
  }

  return ((data.FileAttributes & (syscall.FILE_ATTRIBUTE_REPARSE_POINT as int)) !== 0) as bool;
}
