import type { byte } from "../../go/scalars.js";
import type { GoArray } from "../../go/compat.js";
import type { SignatureKind } from "./types.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/stringer_generated.go::func::_","kind":"func","status":"implemented","sigHash":"c316d79b3f70efb48b99d2987b08743c8d4a739c9761bfa52b237422279585d6","bodyHash":"f4d7a3b9fccf1308be78905118caf1eddd810ab78fc8e26fd115ad89bbef748d"}
 *
 * Go source:
 * func _() {
 * 	// An "invalid array index" compiler error signifies that the constant values have changed.
 * 	// Re-run the stringer command to generate them again.
 * 	var x [1]struct{}
 * 	_ = x[SignatureKindCall-0]
 * 	_ = x[SignatureKindConstruct-1]
 * }
 */
export function _(): void {
  // An "invalid array index" compiler error signifies that the constant values have changed.
  // Re-run the stringer command to generate them again.
  // (Compile-time index assertions in Go; no runtime effect.)
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/stringer_generated.go::constGroup::_SignatureKind_name","kind":"constGroup","status":"implemented","sigHash":"4302a5c0a64d4ddc3ebb17197733f3e9f494457d4546eb78879641a21beaa056","bodyHash":"9188bcfb794dfab7387d4a6c6006d60840bc345029c33a96a77b625429bdf19a"}
 *
 * Go source:
 * const _SignatureKind_name = "SignatureKindCallSignatureKindConstruct"
 */
export const _SignatureKind_name: string = "SignatureKindCallSignatureKindConstruct";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/stringer_generated.go::varGroup::_SignatureKind_index","kind":"varGroup","status":"implemented","sigHash":"633e965e44938dfaaa7378c28e779e06e31450da5fb813371fcc9c50de517d54","bodyHash":"f18ef83c448cea16227a3d4242099db3e508ed643e0e72a9b43e317e065e3d25"}
 *
 * Go source:
 * var _SignatureKind_index = [...]uint8{0, 17, 39}
 */
export let _SignatureKind_index: GoArray<byte, "..."> = [0, 17, 39] as GoArray<byte, "...">;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/stringer_generated.go::method::SignatureKind.String","kind":"method","status":"implemented","sigHash":"9c05bce595039d33dc85ac4993e7e65c8e1d135f000e0b65576ddae97eff31f0","bodyHash":"4cf085bcadf3ed1b1d792d8d5122d33338c2d9096e87bc60d210226bd11a2b8c"}
 *
 * Go source:
 * func (i SignatureKind) String() string {
 * 	idx := int(i) - 0
 * 	if i < 0 || idx >= len(_SignatureKind_index)-1 {
 * 		return "SignatureKind(" + strconv.FormatInt(int64(i), 10) + ")"
 * 	}
 * 	return _SignatureKind_name[_SignatureKind_index[idx]:_SignatureKind_index[idx+1]]
 * }
 */
export function SignatureKind_String(receiver: SignatureKind): string {
  const i = receiver;
  const idx = i - 0;
  if (i < 0 || idx >= _SignatureKind_index.length - 1) {
    return "SignatureKind(" + i.toString(10) + ")";
  }
  return _SignatureKind_name.slice(_SignatureKind_index[idx], _SignatureKind_index[idx + 1]);
}
