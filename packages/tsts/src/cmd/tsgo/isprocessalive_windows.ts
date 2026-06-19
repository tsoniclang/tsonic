import type { bool, int } from "../../go/scalars.js";
import type { GoError } from "../../go/compat.js";
import * as syscall from "../../go/syscall.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/isprocessalive_windows.go::constGroup::processAliveSupported","kind":"constGroup","status":"implemented","sigHash":"cb51e9ea32c184706a4d2cd1cbcad16927646693ac9daad79dd8eb56c7420775","bodyHash":"44d379487a1e34452206b3b5a58e52ab694f4ba272ce279eee582e2ecf180d5f"}
 *
 * Go source:
 * const processAliveSupported = true
 */
export const processAliveSupported: bool = true as bool;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::cmd/tsgo/isprocessalive_windows.go::func::isProcessAlive","kind":"func","status":"implemented","sigHash":"6392fe1454e58a9159c27a3c8dc29bc5813958a73d2500e11e8c399dd44bca32","bodyHash":"db821ca119a6eeae4a6a18287db6d39849829c1d22da7c441478d88b432eb243"}
 *
 * Go source:
 * // isProcessAlive checks if a process with the given PID is still running.
 * // On Windows, we open the process with SYNCHRONIZE access and use
 * // WaitForSingleObject with a zero timeout. If the wait times out, the
 * // process is still running. If the object is signaled, it has exited.
 * func isProcessAlive(pid int) bool {
 * 	const SYNCHRONIZE = 0x00100000
 * 	handle, err := syscall.OpenProcess(SYNCHRONIZE, false, uint32(pid))
 * 	if err != nil {
 * 		return false
 * 	}
 * 	defer func() { _ = syscall.CloseHandle(handle) }()
 * 	ret, err := syscall.WaitForSingleObject(handle, 0)
 * 	if err != nil {
 * 		return false
 * 	}
 * 	const WAIT_TIMEOUT = 258
 * 	return ret == WAIT_TIMEOUT
 * }
 */
export function isProcessAlive(pid: int): bool {
  const SYNCHRONIZE = 0x00100000;
  const [handle, err] = syscall.OpenProcess(SYNCHRONIZE, false, pid >>> 0) as [unknown, GoError];
  if (err !== undefined) {
    return false as bool;
  }
  try {
    const [ret, waitErr] = syscall.WaitForSingleObject(handle, 0) as [int, GoError];
    if (waitErr !== undefined) {
      return false as bool;
    }
    const WAIT_TIMEOUT = 258;
    return (ret === WAIT_TIMEOUT) as bool;
  } finally {
    // defer func() { _ = syscall.CloseHandle(handle) }()
    syscall.CloseHandle(handle);
  }
}
