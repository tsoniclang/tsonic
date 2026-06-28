/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/js_case.go::func::ToLowerJS","kind":"func","status":"implemented","sigHash":"cd8ed802f5c1cfe38864641827bffcede83a8a90ebebfe9f83d5c90dafca3927","bodyHash":"5fbf8e670bae9fe1490b3c26ca1d20167c75d2c401dad1fbd1dcc05a82f60e67"}
 *
 * Go source:
 * func ToLowerJS(str string) string {
 * 	if ascii, ok := toLowerASCII(str); ok {
 * 		return ascii
 * 	}
 * 	var builder strings.Builder
 * 	builder.Grow(len(str))
 * 	casedBefore := false
 * 	for i := 0; i < len(str); {
 * 		r, size := DecodeJSStringRune(str[i:])
 * 		i += size
 * 		if IsSurrogate(r) {
 * 			builder.WriteString(EncodeJSStringRune(r))
 * 		} else if mapping, ok := specialCasingMappings[r]; ok {
 * 			if mapping.condition == specialCasingConditionFinalSigma && !isFinalSigmaContext(casedBefore, str, i) {
 * 				builder.WriteRune(unicode.ToLower(r))
 * 			} else {
 * 				builder.WriteString(mapping.lower)
 * 			}
 * 		} else {
 * 			builder.WriteRune(unicode.ToLower(r))
 * 		}
 * 		if !isUnicodeCaseIgnorable(r) {
 * 			casedBefore = isSigmaCased(r)
 * 		}
 * 	}
 * 	return builder.String()
 * }
 */
export declare function ToLowerJS(str: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/js_case.go::func::ToUpperJS","kind":"func","status":"implemented","sigHash":"30f4ab61ad8a8a0201d284e9c8a312b61139335b5d26428bd5f7393da2ec3aa9","bodyHash":"f5a2289ccba23250edd6a31fcfab536be500d291d0a680a2d517b349ed47f8ae"}
 *
 * Go source:
 * func ToUpperJS(str string) string {
 * 	if ascii, ok := toUpperASCII(str); ok {
 * 		return ascii
 * 	}
 * 	var builder strings.Builder
 * 	builder.Grow(len(str))
 * 	for i := 0; i < len(str); {
 * 		r, size := DecodeJSStringRune(str[i:])
 * 		if IsSurrogate(r) {
 * 			builder.WriteString(str[i : i+size])
 * 		} else if mapping, ok := specialCasingMappings[r]; ok {
 * 			builder.WriteString(mapping.upper)
 * 		} else {
 * 			builder.WriteRune(unicode.ToUpper(r))
 * 		}
 * 		i += size
 * 	}
 * 	return builder.String()
 * }
 */
export declare function ToUpperJS(str: string): string;
//# sourceMappingURL=js_case.d.ts.map