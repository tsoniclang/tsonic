import type { byte, long } from "../../go/scalars.js";
import type { GoArray } from "../../go/compat.js";
import { FormatInt } from "../../go/strconv.js";
import {
  ModuleKindAMD,
  ModuleKindCommonJS,
  ModuleKindES2015,
  ModuleKindES2020,
  ModuleKindES2022,
  ModuleKindESNext,
  ModuleKindNode16,
  ModuleKindNode18,
  ModuleKindNode20,
  ModuleKindNodeNext,
  ModuleKindNone,
  ModuleKindPreserve,
  ModuleKindSystem,
  ModuleKindUMD,
} from "./compileroptions.js";
import type { ModuleKind } from "./compileroptions.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/modulekind_stringer_generated.go::func::_","kind":"func","status":"implemented","sigHash":"c316d79b3f70efb48b99d2987b08743c8d4a739c9761bfa52b237422279585d6","bodyHash":"e16ef510b7522f68ed731bd455decf0ad16d54d442a4189e1189eee117234fd8"}
 *
 * Go source:
 * func _() {
 * 	// An "invalid array index" compiler error signifies that the constant values have changed.
 * 	// Re-run the stringer command to generate them again.
 * 	var x [1]struct{}
 * 	_ = x[ModuleKindNone-0]
 * 	_ = x[ModuleKindCommonJS-1]
 * 	_ = x[ModuleKindAMD-2]
 * 	_ = x[ModuleKindUMD-3]
 * 	_ = x[ModuleKindSystem-4]
 * 	_ = x[ModuleKindES2015-5]
 * 	_ = x[ModuleKindES2020-6]
 * 	_ = x[ModuleKindES2022-7]
 * 	_ = x[ModuleKindESNext-99]
 * 	_ = x[ModuleKindNode16-100]
 * 	_ = x[ModuleKindNode18-101]
 * 	_ = x[ModuleKindNode20-102]
 * 	_ = x[ModuleKindNodeNext-199]
 * 	_ = x[ModuleKindPreserve-200]
 * }
 */
export function _(): void {
  // An "invalid array index" compiler error signifies that the constant values have changed.
  // Re-run the stringer command to generate them again.
  const x: GoArray<Record<string, never>, "1"> = [{}];
  void x[ModuleKindNone - 0];
  void x[ModuleKindCommonJS - 1];
  void x[ModuleKindAMD - 2];
  void x[ModuleKindUMD - 3];
  void x[ModuleKindSystem - 4];
  void x[ModuleKindES2015 - 5];
  void x[ModuleKindES2020 - 6];
  void x[ModuleKindES2022 - 7];
  void x[ModuleKindESNext - 99];
  void x[ModuleKindNode16 - 100];
  void x[ModuleKindNode18 - 101];
  void x[ModuleKindNode20 - 102];
  void x[ModuleKindNodeNext - 199];
  void x[ModuleKindPreserve - 200];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/modulekind_stringer_generated.go::constGroup::_ModuleKind_name_0+_ModuleKind_name_1+_ModuleKind_name_2","kind":"constGroup","status":"implemented","sigHash":"56c7707ab8862bc45ebb0154f450d1d645e43bb9961428ebbe1dcc1ffb13fd40","bodyHash":"9238b2a6e3937082ea7766a1824a889292e60d5915c2e3faf1a62a47bc8b0b82"}
 *
 * Go source:
 * const (
 * 	_ModuleKind_name_0 = "NoneCommonJSAMDUMDSystemES2015ES2020ES2022"
 * 	_ModuleKind_name_1 = "ESNextNode16Node18Node20"
 * 	_ModuleKind_name_2 = "NodeNextPreserve"
 * )
 */
export const _ModuleKind_name_0: string = "NoneCommonJSAMDUMDSystemES2015ES2020ES2022";
export const _ModuleKind_name_1: string = "ESNextNode16Node18Node20";
export const _ModuleKind_name_2: string = "NodeNextPreserve";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/modulekind_stringer_generated.go::varGroup::_ModuleKind_index_0+_ModuleKind_index_1+_ModuleKind_index_2","kind":"varGroup","status":"implemented","sigHash":"35366ea9281031227a960aa4cea4c9efe6645aa17ef400a181490950471f184f","bodyHash":"7e1a207ee360928469ca1c9ece4d1575823446b33186c710b54e3b07fca5de7d"}
 *
 * Go source:
 * var (
 * 	_ModuleKind_index_0 = [...]uint8{0, 4, 12, 15, 18, 24, 30, 36, 42}
 * 	_ModuleKind_index_1 = [...]uint8{0, 6, 12, 18, 24}
 * 	_ModuleKind_index_2 = [...]uint8{0, 8, 16}
 * )
 */
export let _ModuleKind_index_0: GoArray<byte, "..."> = [0, 4, 12, 15, 18, 24, 30, 36, 42];
export let _ModuleKind_index_1: GoArray<byte, "..."> = [0, 6, 12, 18, 24];
export let _ModuleKind_index_2: GoArray<byte, "..."> = [0, 8, 16];

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/modulekind_stringer_generated.go::method::ModuleKind.String","kind":"method","status":"implemented","sigHash":"8aa7f80eb17c3c5d757a999866a748b612aa92bb32ff7ec95524e5bd82572456","bodyHash":"1628b9c62c47d51c4b7851bd3be691fa93295be250c495864973c0c2e64c9c7b"}
 *
 * Go source:
 * func (i ModuleKind) String() string {
 * 	switch {
 * 	case 0 <= i && i <= 7:
 * 		return _ModuleKind_name_0[_ModuleKind_index_0[i]:_ModuleKind_index_0[i+1]]
 * 	case 99 <= i && i <= 102:
 * 		i -= 99
 * 		return _ModuleKind_name_1[_ModuleKind_index_1[i]:_ModuleKind_index_1[i+1]]
 * 	case 199 <= i && i <= 200:
 * 		i -= 199
 * 		return _ModuleKind_name_2[_ModuleKind_index_2[i]:_ModuleKind_index_2[i+1]]
 * 	default:
 * 		return "ModuleKind(" + strconv.FormatInt(int64(i), 10) + ")"
 * 	}
 * }
 */
export function ModuleKind_String(receiver: ModuleKind): string {
  let i: ModuleKind = receiver;
  switch (true) {
    case 0 <= i && i <= 7:
      return _ModuleKind_name_0.slice(_ModuleKind_index_0[i]!, _ModuleKind_index_0[i + 1]!);
    case 99 <= i && i <= 102:
      i -= 99;
      return _ModuleKind_name_1.slice(_ModuleKind_index_1[i]!, _ModuleKind_index_1[i + 1]!);
    case 199 <= i && i <= 200:
      i -= 199;
      return _ModuleKind_name_2.slice(_ModuleKind_index_2[i]!, _ModuleKind_index_2[i + 1]!);
    default:
      return "ModuleKind(" + FormatInt(i as long, 10) + ")";
  }
}
