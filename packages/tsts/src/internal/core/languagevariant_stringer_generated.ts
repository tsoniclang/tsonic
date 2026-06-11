import type { byte, int, long } from "@tsonic/core/types.js";
import type { GoArray } from "../../go/compat.js";
import { FormatInt } from "../../go/strconv.js";
import { LanguageVariantJSX, LanguageVariantStandard } from "./languagevariant.js";
import type { LanguageVariant } from "./languagevariant.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/languagevariant_stringer_generated.go::func::_","kind":"func","status":"implemented","sigHash":"c316d79b3f70efb48b99d2987b08743c8d4a739c9761bfa52b237422279585d6","bodyHash":"8d8225962a9f4a1890546f96ac3bc2cac5bd36fe7930ca4bbd8786a1ae583c79"}
 *
 * Go source:
 * func _() {
 * 	// An "invalid array index" compiler error signifies that the constant values have changed.
 * 	// Re-run the stringer command to generate them again.
 * 	var x [1]struct{}
 * 	_ = x[LanguageVariantStandard-0]
 * 	_ = x[LanguageVariantJSX-1]
 * }
 */
export function _(): void {
  // An "invalid array index" compiler error signifies that the constant values have changed.
  // Re-run the stringer command to generate them again.
  const x: GoArray<Record<string, never>, "1"> = [{}];
  void x[LanguageVariantStandard - 0];
  void x[LanguageVariantJSX - 1];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/languagevariant_stringer_generated.go::constGroup::_LanguageVariant_name","kind":"constGroup","status":"implemented","sigHash":"65263c32898c725fcd8a8b9178dfae3a5d1aaa3af8950d657179b7e9934f8476","bodyHash":"8cf5127acb5b1b9328fb35097ceb7fdba9f9ebc8ac996d49d1e3dbf0790722d7"}
 *
 * Go source:
 * const _LanguageVariant_name = "LanguageVariantStandardLanguageVariantJSX"
 */
export const _LanguageVariant_name: string = "LanguageVariantStandardLanguageVariantJSX";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/languagevariant_stringer_generated.go::varGroup::_LanguageVariant_index","kind":"varGroup","status":"implemented","sigHash":"4e14c483a3cce0c893193ac8e724bc697a27c0634ae7fbf1db1a1fb324a576c5","bodyHash":"e1011fb9f423629913cae02a2933e06af7e52bdc699e4e0e61260b580db94828"}
 *
 * Go source:
 * var _LanguageVariant_index = [...]uint8{0, 23, 41}
 */
export let _LanguageVariant_index: GoArray<byte, "..."> = [0, 23, 41];

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/languagevariant_stringer_generated.go::method::LanguageVariant.String","kind":"method","status":"implemented","sigHash":"4ce505d9da83893055f9726103d7dbce9384e90de63121b28291e5e0cdc306ce","bodyHash":"e8b34ad2c7a0f1dfb0165e4b9610177f4958ce11d95a58a2f46c7a252e42bade"}
 *
 * Go source:
 * func (i LanguageVariant) String() string {
 * 	idx := int(i) - 0
 * 	if i < 0 || idx >= len(_LanguageVariant_index)-1 {
 * 		return "LanguageVariant(" + strconv.FormatInt(int64(i), 10) + ")"
 * 	}
 * 	return _LanguageVariant_name[_LanguageVariant_index[idx]:_LanguageVariant_index[idx+1]]
 * }
 */
export function LanguageVariant_String(receiver: LanguageVariant): string {
  const i: LanguageVariant = receiver;
  const idx: int = (i as int) - 0;
  if (i < 0 || idx >= _LanguageVariant_index.length - 1) {
    return "LanguageVariant(" + FormatInt(i as long, 10) + ")";
  }
  return _LanguageVariant_name.slice(_LanguageVariant_index[idx]!, _LanguageVariant_index[idx + 1]!);
}
