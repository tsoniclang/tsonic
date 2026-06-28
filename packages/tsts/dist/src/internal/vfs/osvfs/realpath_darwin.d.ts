import type { bool, byte, int, nuint } from "../../../go/scalars.js";
import type { GoArray, GoError, GoPtr } from "../../../go/compat.js";
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
export declare const hasFGetPath: () => bool;
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
export declare function fcntlGetPath(fd: int, buf: GoPtr<GoArray<byte, "unix.PathMax">>): [int, GoError];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/realpath_darwin.go::func::fcntlGetPathPtr","kind":"func","status":"implemented","sigHash":"6f0ed32d566aee9ecfefe783c459dee2ef92415c70ef92a26ee2287c93d56894","bodyHash":"2621b3257db693b9327da532483f60ed62ac21fd8fb4d069f5b26a25aca7db23"}
 *
 * Go source:
 * //go:uintptrescapes
 * func fcntlGetPathPtr(fd uintptr, buf uintptr) (int, error) {
 * 	return unix.FcntlInt(fd, unix.F_GETPATH, int(buf))
 * }
 */
export declare function fcntlGetPathPtr(fd: nuint, buf: nuint): [int, GoError];
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
export declare function realpath(path: string): [string, GoError];
//# sourceMappingURL=realpath_darwin.d.ts.map