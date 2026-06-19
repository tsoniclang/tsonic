import type { GoError } from "../../../go/compat.js";
import * as syscall from "../../../go/syscall.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/eintr_unix.go::func::ignoringEINTR","kind":"func","status":"implemented","sigHash":"b54227a8a566449ab9c02f449467da8b54f1f1c00eb0c61afc7e083e4f39ee87","bodyHash":"52efdfd3c4a04a1efd20e01d7a3ab8233aa14e9c58949ff9b25855a53c03cc93"}
 *
 * Go source:
 * func ignoringEINTR[T any](fn func() (T, error)) (T, error) {
 * 	for {
 * 		v, err := fn()
 * 		if err != syscall.EINTR { //nolint:errorlint // syscall functions return raw syscall.Errno, never wrapped
 * 			return v, err
 * 		}
 * 	}
 * }
 */
export function ignoringEINTR<T>(fn: () => [T, GoError]): [T, GoError] {
  for (;;) {
    const [v, err] = fn();
    if (err !== (syscall.EINTR as GoError)) {
      // syscall functions return raw syscall.Errno, never wrapped
      return [v, err];
    }
  }
}
