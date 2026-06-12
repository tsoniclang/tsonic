import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/checker.go::type::PseudoChecker","kind":"type","status":"implemented","sigHash":"f50524d10dc220ff3d196d78db53a518e5ed226dde376c688a4c72fc7d583dcc","bodyHash":"e3773d3b25f9379611016a09580a78b684002700ca373a2c37e8de65284b193f"}
 *
 * Go source:
 * PseudoChecker struct {
 * 	strictNullChecks           bool
 * 	exactOptionalPropertyTypes bool
 * }
 */
export interface PseudoChecker {
  strictNullChecks: bool;
  exactOptionalPropertyTypes: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/checker.go::func::NewPseudoChecker","kind":"func","status":"implemented","sigHash":"d9fde7ff94de774ba27210e1b6eaa6080e99a3b774e4900c81d8fdb9f8ddfc53","bodyHash":"852ad537b4bfb93515e079973073821ad3f3acbd3a819b72a5ba1a33511b450c"}
 *
 * Go source:
 * func NewPseudoChecker(strictNullChecks bool, exactOptionalPropertyTypes bool) *PseudoChecker {
 * 	return &PseudoChecker{strictNullChecks: strictNullChecks, exactOptionalPropertyTypes: exactOptionalPropertyTypes}
 * }
 */
export function NewPseudoChecker(strictNullChecks: bool, exactOptionalPropertyTypes: bool): GoPtr<PseudoChecker> {
  return { strictNullChecks: strictNullChecks, exactOptionalPropertyTypes: exactOptionalPropertyTypes };
}
