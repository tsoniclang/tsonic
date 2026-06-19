import type { byte, int, long } from "../../go/scalars.js";
import type { GoArray } from "../../go/compat.js";
import { FormatInt } from "../../go/strconv.js";
import { TSFalse, TSTrue, TSUnknown } from "./tristate.js";
import type { Tristate } from "./tristate.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate_stringer_generated.go::func::_","kind":"func","status":"implemented","sigHash":"c316d79b3f70efb48b99d2987b08743c8d4a739c9761bfa52b237422279585d6","bodyHash":"38864ad16535dd5de07fdd8c54b56e986d2755dce54b26f61dba18a9d1baa6ef"}
 *
 * Go source:
 * func _() {
 * 	// An "invalid array index" compiler error signifies that the constant values have changed.
 * 	// Re-run the stringer command to generate them again.
 * 	var x [1]struct{}
 * 	_ = x[TSUnknown-0]
 * 	_ = x[TSFalse-1]
 * 	_ = x[TSTrue-2]
 * }
 */
export function _(): void {
  // An "invalid array index" compiler error signifies that the constant values have changed.
  // Re-run the stringer command to generate them again.
  const x: GoArray<Record<string, never>, "1"> = [{}];
  void x[TSUnknown - 0];
  void x[TSFalse - 1];
  void x[TSTrue - 2];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate_stringer_generated.go::constGroup::_Tristate_name","kind":"constGroup","status":"implemented","sigHash":"dcf6d5ff93293e544ad6aea1868f996fc3597c832a9c3566226ebd2354dac8cb","bodyHash":"be4afed3595dee3df5186d3f3385d6589cadb35b7d9990a1479a92b7711db83b"}
 *
 * Go source:
 * const _Tristate_name = "TSUnknownTSFalseTSTrue"
 */
export const _Tristate_name: string = "TSUnknownTSFalseTSTrue";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate_stringer_generated.go::varGroup::_Tristate_index","kind":"varGroup","status":"implemented","sigHash":"1a0dd53935750af8cb9c15648a0870d2092ad9631e65c132299e2a25569a4048","bodyHash":"09b3f420830623343b80b6011fc7465cdfc5add1e87e3a367050a3bc3236d5e2"}
 *
 * Go source:
 * var _Tristate_index = [...]uint8{0, 9, 16, 22}
 */
export let _Tristate_index: GoArray<byte, "..."> = [0, 9, 16, 22];

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate_stringer_generated.go::method::Tristate.String","kind":"method","status":"implemented","sigHash":"84afbd18fe2faba0a015cf2bb386824ef2422b824f3f6b4c93d389637118b956","bodyHash":"dbcc2fcee22d9cbeae79dca426ff5f9b324cc9bd8df99b02b5df058d91719369"}
 *
 * Go source:
 * func (i Tristate) String() string {
 * 	idx := int(i) - 0
 * 	if i < 0 || idx >= len(_Tristate_index)-1 {
 * 		return "Tristate(" + strconv.FormatInt(int64(i), 10) + ")"
 * 	}
 * 	return _Tristate_name[_Tristate_index[idx]:_Tristate_index[idx+1]]
 * }
 */
export function Tristate_String(receiver: Tristate): string {
  const i: Tristate = receiver;
  const idx: int = (i as int) - 0;
  if (i < 0 || idx >= _Tristate_index.length - 1) {
    return "Tristate(" + FormatInt(i as long, 10) + ")";
  }
  return _Tristate_name.slice(_Tristate_index[idx]!, _Tristate_index[idx + 1]!);
}
