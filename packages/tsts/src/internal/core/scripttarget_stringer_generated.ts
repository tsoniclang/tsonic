import type { byte, long } from "../../go/scalars.js";
import type { GoArray } from "../../go/compat.js";
import { FormatInt } from "../../go/strconv.js";
import {
  ScriptTargetES5,
  ScriptTargetES2015,
  ScriptTargetES2016,
  ScriptTargetES2017,
  ScriptTargetES2018,
  ScriptTargetES2019,
  ScriptTargetES2020,
  ScriptTargetES2021,
  ScriptTargetES2022,
  ScriptTargetES2023,
  ScriptTargetES2024,
  ScriptTargetES2025,
  ScriptTargetESNext,
  ScriptTargetJSON,
  ScriptTargetLatest,
  ScriptTargetLatestStandard,
  ScriptTargetNone,
} from "./compileroptions.js";
import type { ScriptTarget } from "./compileroptions.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/scripttarget_stringer_generated.go::func::_","kind":"func","status":"implemented","sigHash":"c316d79b3f70efb48b99d2987b08743c8d4a739c9761bfa52b237422279585d6","bodyHash":"d3a78d1ec15b6182626af68613a0e2ac8f1421c63adca5aebb63dc98b31caa38"}
 *
 * Go source:
 * func _() {
 * 	// An "invalid array index" compiler error signifies that the constant values have changed.
 * 	// Re-run the stringer command to generate them again.
 * 	var x [1]struct{}
 * 	_ = x[ScriptTargetNone-0]
 * 	_ = x[ScriptTargetES5-1]
 * 	_ = x[ScriptTargetES2015-2]
 * 	_ = x[ScriptTargetES2016-3]
 * 	_ = x[ScriptTargetES2017-4]
 * 	_ = x[ScriptTargetES2018-5]
 * 	_ = x[ScriptTargetES2019-6]
 * 	_ = x[ScriptTargetES2020-7]
 * 	_ = x[ScriptTargetES2021-8]
 * 	_ = x[ScriptTargetES2022-9]
 * 	_ = x[ScriptTargetES2023-10]
 * 	_ = x[ScriptTargetES2024-11]
 * 	_ = x[ScriptTargetES2025-12]
 * 	_ = x[ScriptTargetESNext-99]
 * 	_ = x[ScriptTargetJSON-100]
 * 	_ = x[ScriptTargetLatest-99]
 * 	_ = x[ScriptTargetLatestStandard-12]
 * }
 */
export function _(): void {
  // An "invalid array index" compiler error signifies that the constant values have changed.
  // Re-run the stringer command to generate them again.
  const x: GoArray<Record<string, never>, "1"> = [{}];
  void x[ScriptTargetNone - 0];
  void x[ScriptTargetES5 - 1];
  void x[ScriptTargetES2015 - 2];
  void x[ScriptTargetES2016 - 3];
  void x[ScriptTargetES2017 - 4];
  void x[ScriptTargetES2018 - 5];
  void x[ScriptTargetES2019 - 6];
  void x[ScriptTargetES2020 - 7];
  void x[ScriptTargetES2021 - 8];
  void x[ScriptTargetES2022 - 9];
  void x[ScriptTargetES2023 - 10];
  void x[ScriptTargetES2024 - 11];
  void x[ScriptTargetES2025 - 12];
  void x[ScriptTargetESNext - 99];
  void x[ScriptTargetJSON - 100];
  void x[ScriptTargetLatest - 99];
  void x[ScriptTargetLatestStandard - 12];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/scripttarget_stringer_generated.go::constGroup::_ScriptTarget_name_0+_ScriptTarget_name_1","kind":"constGroup","status":"implemented","sigHash":"9791fc737dc1459c7419746611ff4c9be676d3954a4ae8fc0d7b01ef28a1992f","bodyHash":"6c7906c9bbe21baf6f81a21218498302e1276400fc7cb8288550746fa8c5e61e"}
 *
 * Go source:
 * const (
 * 	_ScriptTarget_name_0 = "NoneES5ES2015ES2016ES2017ES2018ES2019ES2020ES2021ES2022ES2023ES2024ES2025"
 * 	_ScriptTarget_name_1 = "ESNextJSON"
 * )
 */
export const _ScriptTarget_name_0: string = "NoneES5ES2015ES2016ES2017ES2018ES2019ES2020ES2021ES2022ES2023ES2024ES2025";
export const _ScriptTarget_name_1: string = "ESNextJSON";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/scripttarget_stringer_generated.go::varGroup::_ScriptTarget_index_0+_ScriptTarget_index_1","kind":"varGroup","status":"implemented","sigHash":"f5e04a97b44f1dbc3169843e4b9f7b3efaf16e02e19839409e9986a027c426a2","bodyHash":"f52b28c0970890426671aa40f23d53e78846eb83a5facfc5c4f13f17a797c699"}
 *
 * Go source:
 * var (
 * 	_ScriptTarget_index_0 = [...]uint8{0, 4, 7, 13, 19, 25, 31, 37, 43, 49, 55, 61, 67, 73}
 * 	_ScriptTarget_index_1 = [...]uint8{0, 6, 10}
 * )
 */
export let _ScriptTarget_index_0: GoArray<byte, "..."> = [0, 4, 7, 13, 19, 25, 31, 37, 43, 49, 55, 61, 67, 73];
export let _ScriptTarget_index_1: GoArray<byte, "..."> = [0, 6, 10];

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/scripttarget_stringer_generated.go::method::ScriptTarget.String","kind":"method","status":"implemented","sigHash":"41a4d4874a348e3d33b91377d73aa247ca1205a90cb390cf81018469cf2f5a74","bodyHash":"f267713df21bf54ce8a4e43a52e4d557b9812f1812defe9dbd88465cd3694c38"}
 *
 * Go source:
 * func (i ScriptTarget) String() string {
 * 	switch {
 * 	case 0 <= i && i <= 12:
 * 		return _ScriptTarget_name_0[_ScriptTarget_index_0[i]:_ScriptTarget_index_0[i+1]]
 * 	case 99 <= i && i <= 100:
 * 		i -= 99
 * 		return _ScriptTarget_name_1[_ScriptTarget_index_1[i]:_ScriptTarget_index_1[i+1]]
 * 	default:
 * 		return "ScriptTarget(" + strconv.FormatInt(int64(i), 10) + ")"
 * 	}
 * }
 */
export function ScriptTarget_String(receiver: ScriptTarget): string {
  let i: ScriptTarget = receiver;
  switch (true) {
    case 0 <= i && i <= 12:
      return _ScriptTarget_name_0.slice(_ScriptTarget_index_0[i]!, _ScriptTarget_index_0[i + 1]!);
    case 99 <= i && i <= 100:
      i -= 99;
      return _ScriptTarget_name_1.slice(_ScriptTarget_index_1[i]!, _ScriptTarget_index_1[i + 1]!);
    default:
      return "ScriptTarget(" + FormatInt(i as long, 10) + ")";
  }
}
