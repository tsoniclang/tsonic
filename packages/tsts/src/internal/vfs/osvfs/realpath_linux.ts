import type { bool, int } from "../../../go/scalars.js";
import type { GoError } from "../../../go/compat.js";
import { EvalSymlinks } from "../../../go/path/filepath.js";
import { Itoa } from "../../../go/strconv.js";
import { OnceValue } from "../../../go/sync.js";
import * as unix from "../../../go/golang.org/x/sys/unix.js";
import { ignoringEINTR } from "./eintr_unix.js";

// On Linux, we use the O_PATH + /proc/self/fd trick to resolve the canonical
// path in O(1) syscalls (open + readlink + close) instead of Go's
// filepath.EvalSymlinks which does an lstat per path component — O(depth).
//
// This is the approach libuv/Node.js could use, though libuv currently just
// calls C realpath(3) which itself does a readlink per component. On the Go
// side, the per-component approach is even more expensive because each
// os.Lstat call involves goroutine scheduling overhead (entersyscall /
// exitsyscall).
//
// How it works:
//   - open(path, O_PATH|O_CLOEXEC) gives us a lightweight fd that follows all
//     symlinks to the final target. O_PATH requires only search permission on
//     directories (same as lstat), and works for both files and directories.
//   - readlink("/proc/self/fd/<fd>") returns the fully resolved canonical path
//     that the kernel computed during the open.
//
// Falls back to filepath.EvalSymlinks if /proc is not available (e.g. containers
// or chroots without procfs mounted).

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/realpath_linux.go::constGroup::_procSelfFD","kind":"constGroup","status":"implemented","sigHash":"91f52da369124eda157655cdefd8adf58bf3db47f012efcaa8aa27af5aa3a184","bodyHash":"cb954cedd01898122ff5f4e66abd8344cecc872e881ac8aea86612e8fd10c55f"}
 *
 * Go source:
 * const _procSelfFD = "/proc/self/fd/"
 */
export const _procSelfFD: string = "/proc/self/fd/";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/realpath_linux.go::varGroup::hasProcSelfFD","kind":"varGroup","status":"implemented","sigHash":"fa50ebb74a38bb74213095f710ab17ecc5bcb43fe79851afd819c0b1639a3233","bodyHash":"167bc9acff221338d8a8cf37c697c0655a0006bd54bcd25664f930d0e88922d5"}
 *
 * Go source:
 * var hasProcSelfFD = sync.OnceValue(func() bool {
 * 	var stat unix.Stat_t
 * 	return unix.Stat(_procSelfFD, &stat) == nil
 * })
 */
export const hasProcSelfFD: () => bool = OnceValue<bool>((): bool => {
  const stat: unknown = {}; // var stat unix.Stat_t
  return (unix.Stat(_procSelfFD, stat) === undefined) as bool;
});

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
export function realpath(path: string): [string, GoError] {
  if (!hasProcSelfFD()) {
    return EvalSymlinks(path);
  }

  const [fd, err] = ignoringEINTR<int>((): [int, GoError] => {
    return unix.Open(path, (unix.O_CLOEXEC as number) | (unix.O_PATH as number), 0) as [int, GoError];
  });
  if (err !== undefined) {
    return ["", new globalThis.Error(`open ${path}: ${err.message}`)];
  }
  try {
    // var procBuf [len(_procSelfFD) + 20]byte; n := copy(procBuf[:], _procSelfFD);
    // n += copy(procBuf[n:], strconv.Itoa(fd)); procPath := string(procBuf[:n])
    const procPath = _procSelfFD + Itoa(fd);

    let buf = new Uint8Array(256);
    for (;;) {
      const [nn, readlinkErr] = ignoringEINTR<int>((): [int, GoError] => {
        return unix.Readlink(procPath, buf) as [int, GoError];
      });
      if (readlinkErr !== undefined) {
        return ["", new globalThis.Error(`readlink ${path}: ${readlinkErr.message}`)];
      }
      if ((nn as number) < buf.length) {
        return [new TextDecoder("utf-8").decode(buf.subarray(0, nn as number)), undefined];
      }
      buf = new Uint8Array(buf.length * 2);
    }
  } finally {
    unix.Close(fd);
  }
}
