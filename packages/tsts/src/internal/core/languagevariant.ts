import type { int } from "../../go/scalars.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/languagevariant.go::type::LanguageVariant","kind":"type","status":"implemented","sigHash":"ed0ac3c2af951c8bd909555490be1c982b05b09cf06f64c8ff0aaa661065105b","bodyHash":"07cf3a4062d0d59ae35779e1c52cb692592314aa8f3d1375c3c56721c781600c"}
 *
 * Go source:
 * LanguageVariant int32
 */
export type LanguageVariant = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/languagevariant.go::constGroup::LanguageVariantStandard+LanguageVariantJSX","kind":"constGroup","status":"implemented","sigHash":"ba4c3e9216ea4121c8c0181ccbe91c706e95482f5aa7159c53619176953e8b46","bodyHash":"3309b8953b46b7f065742f80f58c7b792436870f060e50b6563dcebac6a81ad5"}
 *
 * Go source:
 * const (
 * 	LanguageVariantStandard LanguageVariant = iota
 * 	LanguageVariantJSX
 * )
 */
export const LanguageVariantStandard: LanguageVariant = 0;
export const LanguageVariantJSX: LanguageVariant = 1;
