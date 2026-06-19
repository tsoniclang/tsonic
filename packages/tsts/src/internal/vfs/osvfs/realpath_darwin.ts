import type { bool, byte, int, nuint } from "../../../go/scalars.js";
import type { GoArray, GoError, GoPtr } from "../../../go/compat.js";
import { EvalSymlinks } from "../../../go/path/filepath.js";
import { OnceValue } from "../../../go/sync.js";
import * as unix from "../../../go/golang.org/x/sys/unix.js";
import { ignoringEINTR } from "./eintr_unix.js";

// On macOS, we use open + fcntl(F_GETPATH) to resolve the canonical path in
// O(1) syscalls instead of Go's filepath.EvalSymlinks which does an lstat per
// path component — O(depth).
//
// How it works:
//   - open(path, O_EVTONLY|O_NONBLOCK|O_CLOEXEC) follows all symlinks and gives
//     us a lightweight fd. O_EVTONLY is macOS's event-only descriptor — it
//     doesn't require read permission (similar to Linux's O_PATH) but still
//     references the vnode. O_NONBLOCK prevents blocking on FIFOs.
//   - fcntl(fd, F_GETPATH, buf) asks the kernel for the canonical path of the
//     open file descriptor, written into a MAXPATHLEN buffer.
//
// unix.FcntlInt takes an int arg, so call it through a uintptr-escaping wrapper
// to keep the buffer pointer valid until fcntl returns.

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/realpath_darwin.go::varGroup::hasFGetPath","kind":"varGroup","status":"implemented","sigHash":"f4e17646e1758a2d23a07ea132bb3f55306c277449040f55e927305c55ac339d","bodyHash":"268fa367db46bb9fb61bde71616c82c0269d146ac8b687d3e6c4500b15550724"}
 *
 * Go source:
 * var hasFGetPath = sync.OnceValue(func() bool {
 * 	// Verify that F_GETPATH is supported by this kernel version.
 * 	var buf [unix.PathMax]byte
 * 	fd, err := unix.Open(".", unix.O_EVTONLY|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
 * 	if err != nil {
 * 		return false
 * 	}
 * 	defer unix.Close(fd)
 * 	_, err = fcntlGetPath(fd, &buf)
 * 	return err == nil
 * })
 */
export const hasFGetPath: () => bool = OnceValue<bool>((): bool => {
  // Verify that F_GETPATH is supported by this kernel version.
  const buf = new globalThis.Array<byte>(unix.PathMax as number).fill(0 as byte) as GoArray<byte, "unix.PathMax">;
  const [fd, err] = unix.Open(".", (unix.O_EVTONLY as number) | (unix.O_NONBLOCK as number) | (unix.O_CLOEXEC as number), 0) as [int, GoError];
  if (err !== undefined) {
    return false as bool;
  }
  try {
    const [, getPathErr] = fcntlGetPath(fd, buf);
    return (getPathErr === undefined) as bool;
  } finally {
    unix.Close(fd);
  }
});

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/realpath_darwin.go::func::fcntlGetPath","kind":"func","status":"implemented","sigHash":"c3d32af16bd092e200e33ccc3925ac84d2a44b88d463d453c5e3698e86c508ad","bodyHash":"d9d0fca21af8a869d2c617adc3c9d55fee94fa1c2d2afe9185e35f7199040670"}
 *
 * Go source:
 * func fcntlGetPath(fd int, buf *[unix.PathMax]byte) (int, error) {
 * 	return ignoringEINTR(func() (int, error) {
 * 		return fcntlGetPathPtr(uintptr(fd), uintptr(unsafe.Pointer(&buf[0])))
 * 	})
 * }
 */
export function fcntlGetPath(fd: int, buf: GoPtr<GoArray<byte, "unix.PathMax">>): [int, GoError] {
  return ignoringEINTR<int>((): [int, GoError] => {
    return fcntlGetPathPtr(fd as unknown as nuint, buf as unknown as nuint);
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/realpath_darwin.go::func::fcntlGetPathPtr","kind":"func","status":"implemented","sigHash":"6f0ed32d566aee9ecfefe783c459dee2ef92415c70ef92a26ee2287c93d56894","bodyHash":"2621b3257db693b9327da532483f60ed62ac21fd8fb4d069f5b26a25aca7db23"}
 *
 * Go source:
 * //go:uintptrescapes
 * func fcntlGetPathPtr(fd uintptr, buf uintptr) (int, error) {
 * 	return unix.FcntlInt(fd, unix.F_GETPATH, int(buf))
 * }
 */
export function fcntlGetPathPtr(fd: nuint, buf: nuint): [int, GoError] {
  return unix.FcntlInt(fd, unix.F_GETPATH, buf) as [int, GoError];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/realpath_darwin.go::func::realpath","kind":"func","status":"implemented","sigHash":"508722058bcc5fa76607b13bc59e8f966d9f9163f69d336a8e1b7975a4fdb721","bodyHash":"7417fa9555cf3652ea6b215e09e0e2cf846ebe633004918cce221bf81b7be18d"}
 *
 * Go source:
 * func realpath(path string) (string, error) {
 * 	if !hasFGetPath() {
 * 		return filepath.EvalSymlinks(path)
 * 	}
 *
 * 	fd, err := unix.Open(path, unix.O_EVTONLY|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
 * 	if err != nil {
 * 		return "", err
 * 	}
 * 	defer unix.Close(fd)
 *
 * 	var buf [unix.PathMax]byte
 * 	if _, err := fcntlGetPath(fd, &buf); err != nil {
 * 		return "", err
 * 	}
 *
 * 	return unix.ByteSliceToString(buf[:]), nil
 * }
 */
export function realpath(path: string): [string, GoError] {
  if (!hasFGetPath()) {
    return EvalSymlinks(path);
  }

  const [fd, err] = unix.Open(path, (unix.O_EVTONLY as number) | (unix.O_NONBLOCK as number) | (unix.O_CLOEXEC as number), 0) as [int, GoError];
  if (err !== undefined) {
    return ["", err];
  }
  try {
    const buf = new globalThis.Array<byte>(unix.PathMax as number).fill(0 as byte) as GoArray<byte, "unix.PathMax">;
    const [, getPathErr] = fcntlGetPath(fd, buf);
    if (getPathErr !== undefined) {
      return ["", getPathErr];
    }

    return [unix.ByteSliceToString(buf) as string, undefined];
  } finally {
    unix.Close(fd);
  }
}
