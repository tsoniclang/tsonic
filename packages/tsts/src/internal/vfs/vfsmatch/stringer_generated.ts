import type { byte } from "../../../go/scalars.js";
import type { GoArray } from "../../../go/compat.js";
import type { Usage } from "./vfsmatch.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/stringer_generated.go::func::_","kind":"func","status":"implemented","sigHash":"c316d79b3f70efb48b99d2987b08743c8d4a739c9761bfa52b237422279585d6","bodyHash":"5ccb9e36608b937160f1f9749848eaba5e3733b89a5936dd8bd5b41e228e07f3"}
 *
 * Go source:
 * func _() {
 * 	// An "invalid array index" compiler error signifies that the constant values have changed.
 * 	// Re-run the stringer command to generate them again.
 * 	var x [1]struct{}
 * 	_ = x[UsageFiles-0]
 * 	_ = x[UsageDirectories-1]
 * 	_ = x[UsageExclude-2]
 * }
 */
export function _(): void {
  // Compile-time constant validation — no runtime behavior needed.
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/stringer_generated.go::constGroup::_Usage_name","kind":"constGroup","status":"implemented","sigHash":"59fbbd8db48a2ad3d4d1e03f6c7a4e947ec4011d02f7aa55fb61a2cfede30e01","bodyHash":"c5e6a092faa56e37ca59308e6fa3c1720b1bc806c604b97cc45858031195ac28"}
 *
 * Go source:
 * const _Usage_name = "FilesDirectoriesExclude"
 */
export const _Usage_name: string = "FilesDirectoriesExclude";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/stringer_generated.go::varGroup::_Usage_index","kind":"varGroup","status":"implemented","sigHash":"ed1d4dd54a16bc9b1cefb6df2d6e30e476802d09913974ef0872b1c87d875516","bodyHash":"c7ebe059109e86f9fdfd967a32c2779e56df1b96d04b20bc38d9194b2e0b75ca"}
 *
 * Go source:
 * var _Usage_index = [...]uint8{0, 5, 16, 23}
 */
export let _Usage_index: GoArray<byte, "..."> = [0, 5, 16, 23];

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmatch/stringer_generated.go::method::Usage.String","kind":"method","status":"implemented","sigHash":"d149a1f4f9c91fdc61cdbf0e026481329aad1a45c3f255873dcba36745ad7343","bodyHash":"4a85f21dd9a00442c37e2e5651a392010c0e4b3508a9dacaaaa45f6c785f1966"}
 *
 * Go source:
 * func (i Usage) String() string {
 * 	idx := int(i) - 0
 * 	if i < 0 || idx >= len(_Usage_index)-1 {
 * 		return "Usage(" + strconv.FormatInt(int64(i), 10) + ")"
 * 	}
 * 	return _Usage_name[_Usage_index[idx]:_Usage_index[idx+1]]
 * }
 */
export function Usage_String(receiver: Usage): string {
  const i = receiver;
  const idx = i - 0;
  if (i < 0 || idx >= _Usage_index.length - 1) {
    return "Usage(" + i.toString(10) + ")";
  }
  return _Usage_name.slice(_Usage_index[idx], _Usage_index[idx + 1]);
}
