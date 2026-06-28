/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/pseudochecker/checker.go::func::NewPseudoChecker","kind":"func","status":"implemented","sigHash":"d9fde7ff94de774ba27210e1b6eaa6080e99a3b774e4900c81d8fdb9f8ddfc53","bodyHash":"852ad537b4bfb93515e079973073821ad3f3acbd3a819b72a5ba1a33511b450c"}
 *
 * Go source:
 * func NewPseudoChecker(strictNullChecks bool, exactOptionalPropertyTypes bool) *PseudoChecker {
 * 	return &PseudoChecker{strictNullChecks: strictNullChecks, exactOptionalPropertyTypes: exactOptionalPropertyTypes}
 * }
 */
export function NewPseudoChecker(strictNullChecks, exactOptionalPropertyTypes) {
    return { strictNullChecks: strictNullChecks, exactOptionalPropertyTypes: exactOptionalPropertyTypes };
}
//# sourceMappingURL=checker.js.map