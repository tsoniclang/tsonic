import type { int } from "../../go/scalars.js";
import * as strings from "../../go/strings.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/modulespecifiers/compare.go::func::CountPathComponents","kind":"func","status":"implemented","sigHash":"e0e173cf13767ad6c33c266f0b780e58bfd0caf89fd6b11091b23d1869fb7ad1","bodyHash":"7acb66a0c0c908aee20f43bca7777a522f270188d2d112c7aa68410f5214abe0"}
 *
 * Go source:
 * func CountPathComponents(path string) int {
 * 	initial := 0
 * 	if strings.HasPrefix(path, "./") {
 * 		initial = 2
 * 	}
 * 	return strings.Count(path[initial:], "/")
 * }
 */
export function CountPathComponents(path: string): int {
  const initial: int = strings.HasPrefix(path, "./") ? 2 : 0;
  return strings.Count(path.slice(initial), "/");
}
