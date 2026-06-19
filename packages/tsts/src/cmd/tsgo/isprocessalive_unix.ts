import type { bool, int } from "../../go/scalars.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/isprocessalive_unix.go::constGroup::processAliveSupported","kind":"constGroup","status":"implemented","sigHash":"cb51e9ea32c184706a4d2cd1cbcad16927646693ac9daad79dd8eb56c7420775","bodyHash":"44d379487a1e34452206b3b5a58e52ab694f4ba272ce279eee582e2ecf180d5f"}
 *
 * Go source:
 * const processAliveSupported = true
 */
export const processAliveSupported: bool = true as bool;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/isprocessalive_unix.go::func::isProcessAlive","kind":"func","status":"implemented","sigHash":"4cb1671d222cb526d146d2dc7e6921cc7207fa92aa5d1b7ece754caae97fd9fd","bodyHash":"8e087031586389014f61558b5b0c4823526de53d45d50c84dd0f68ea42458bae"}
 *
 * Go source:
 * // isProcessAlive checks if a process with the given PID is still running.
 * // On Unix, FindProcess always succeeds, so we send signal 0 to probe the
 * // process. If the signal returns nil or EPERM, the process exists (EPERM
 * // means it exists but we lack permission to signal it). ESRCH or any
 * // other error indicates the process is gone.
 * func isProcessAlive(pid int) bool {
 * 	proc, err := os.FindProcess(pid)
 * 	if err != nil {
 * 		return false
 * 	}
 * 	err = proc.Signal(syscall.Signal(0))
 * 	return err == nil || errors.Is(err, syscall.EPERM)
 * }
 */
// NOTE: A faithful body requires os.FindProcess + (*os.Process).Signal, which are
// not provided by the go/os facade in src/. The only consumer (cmd/tsgo/lsp.go) is
// not ported, so this is stubbed as unimplemented (matching the platform-stub
// precedent in cmd/tsgo/enablevtprocessing_windows.ts) pending facade support.
export function isProcessAlive(pid: int): bool {
  throw new globalThis.Error("TSGO_EXTERNAL_FACADE_UNIMPLEMENTED os.FindProcess / (*os.Process).Signal");
}
