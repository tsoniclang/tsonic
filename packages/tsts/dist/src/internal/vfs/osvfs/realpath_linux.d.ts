import type { bool } from "../../../go/scalars.js";
import type { GoError } from "../../../go/compat.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/realpath_linux.go::constGroup::_procSelfFD","kind":"constGroup","status":"implemented","sigHash":"91f52da369124eda157655cdefd8adf58bf3db47f012efcaa8aa27af5aa3a184","bodyHash":"cb954cedd01898122ff5f4e66abd8344cecc872e881ac8aea86612e8fd10c55f"}
 *
 * Go source:
 * const _procSelfFD = "/proc/self/fd/"
 */
export declare const _procSelfFD: string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/realpath_linux.go::varGroup::hasProcSelfFD","kind":"varGroup","status":"implemented","sigHash":"fa50ebb74a38bb74213095f710ab17ecc5bcb43fe79851afd819c0b1639a3233","bodyHash":"167bc9acff221338d8a8cf37c697c0655a0006bd54bcd25664f930d0e88922d5"}
 *
 * Go source:
 * var hasProcSelfFD = sync.OnceValue(func() bool {
 * 	var stat unix.Stat_t
 * 	return unix.Stat(_procSelfFD, &stat) == nil
 * })
 */
export declare const hasProcSelfFD: () => bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/realpath_linux.go::func::realpath","kind":"func","status":"implemented","sigHash":"508722058bcc5fa76607b13bc59e8f966d9f9163f69d336a8e1b7975a4fdb721","bodyHash":"2383a412fe65f7a82fa90d20b62f8ba29b05f1060d405e60a545f1e122358a4f"}
 *
 * Go source:
 * func realpath(path string) (string, error) {
 * 	if !hasProcSelfFD() {
 * 		return filepath.EvalSymlinks(path)
 * 	}
 *
 * 	fd, err := ignoringEINTR(func() (int, error) {
 * 		return unix.Open(path, unix.O_CLOEXEC|unix.O_PATH, 0)
 * 	})
 * 	if err != nil {
 * 		return "", &os.PathError{Op: "open", Path: path, Err: err}
 * 	}
 * 	defer unix.Close(fd)
 *
 * 	var procBuf [len(_procSelfFD) + 20]byte // 20 digits is enough for any int64 fd
 * 	n := copy(procBuf[:], _procSelfFD)
 * 	n += copy(procBuf[n:], strconv.Itoa(fd))
 * 	procPath := string(procBuf[:n])
 *
 * 	buf := make([]byte, 256)
 * 	for {
 * 		nn, err := ignoringEINTR(func() (int, error) {
 * 			return unix.Readlink(procPath, buf)
 * 		})
 * 		if err != nil {
 * 			return "", &os.PathError{Op: "readlink", Path: path, Err: err}
 * 		}
 * 		if nn < len(buf) {
 * 			return string(buf[:nn]), nil
 * 		}
 * 		buf = make([]byte, len(buf)*2)
 * 	}
 * }
 */
export declare function realpath(path: string): [string, GoError];
//# sourceMappingURL=realpath_linux.d.ts.map