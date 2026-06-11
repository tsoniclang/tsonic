import type { GoError } from "../../../go/compat.js";
import { EvalSymlinks } from "../../../go/path/filepath.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/osvfs/realpath_other.go::func::realpath","kind":"func","status":"implemented","sigHash":"508722058bcc5fa76607b13bc59e8f966d9f9163f69d336a8e1b7975a4fdb721","bodyHash":"5db19f4474e924202350e44188aee19715fb7836eeea36e1c4bacb086154e348"}
 *
 * Go source:
 * func realpath(path string) (string, error) {
 * 	return filepath.EvalSymlinks(path)
 * }
 */
export function realpath(path: string): [string, GoError] {
  return EvalSymlinks(path);
}
