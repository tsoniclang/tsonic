import type { bool } from "@tsonic/core/types.js";
import type { GoSlice } from "../../go/compat.js";
import * as strings from "../../go/strings.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/ignoredpaths.go::varGroup::ignoredPaths","kind":"varGroup","status":"implemented","sigHash":"cbc3fa9c91a10ef0e895e56c60144ef999ac95e79d0ab2679d0631c4b8832b18","bodyHash":"eea072212cfb9487f258a1219e1c9cc47eb2028d4bab3e70c330b5e193df0fca"}
 *
 * Go source:
 * var ignoredPaths = []string{
 * 	"/node_modules/.",
 * 	"/.git",
 * 	".#",
 * }
 */
export const ignoredPaths: GoSlice<string> = ["/node_modules/.", "/.git", ".#"];

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tspath/ignoredpaths.go::func::ContainsIgnoredPath","kind":"func","status":"implemented","sigHash":"0ab7ac9a02a1bf077778f62fc167cb887d2b5bb911c5896f0b12b231c7a449fa","bodyHash":"23db57a167eec4cf40c8b75c6af67bfa9e7db3ceb9e20b5b7ee9869c878d150c"}
 *
 * Go source:
 * func ContainsIgnoredPath(path string) bool {
 * 	for _, pattern := range ignoredPaths {
 * 		if strings.Contains(path, pattern) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function ContainsIgnoredPath(path: string): bool {
  for (const pattern of ignoredPaths) {
    if (strings.Contains(path, pattern)) {
      return true;
    }
  }
  return false;
}
