import type { GoPtr } from "../../go/compat.js";
import type { ECMALineInfo } from "./lineinfo.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/util.go::func::TryGetSourceMappingURL","kind":"func","status":"implemented","sigHash":"09086edeefb94b9c830c2bb219653b54a96b00863c1bcf54355811074edb81e3","bodyHash":"e686535550d886a6f0d911cc1f9408eecc5c6483943fae340110ebe8522fbd06"}
 *
 * Go source:
 * func TryGetSourceMappingURL(lineInfo *ECMALineInfo) string {
 * 	if lineInfo != nil {
 * 		for index := lineInfo.LineCount() - 1; index >= 0; index-- {
 * 			line := lineInfo.LineText(index)
 * 			line = strings.TrimLeftFunc(line, unicode.IsSpace)
 * 			line = strings.TrimRightFunc(line, stringutil.IsLineBreak)
 * 			if len(line) == 0 {
 * 				continue
 * 			}
 * 			if len(line) < 4 || !strings.HasPrefix(line, "//") || line[2] != '#' && line[2] != '@' || line[3] != ' ' {
 * 				break
 * 			}
 * 			if url, ok := strings.CutPrefix(line[4:], "sourceMappingURL="); ok {
 * 				return strings.TrimRightFunc(url, unicode.IsSpace)
 * 			}
 * 		}
 * 	}
 * 	return ""
 * }
 */
export declare function TryGetSourceMappingURL(lineInfo: GoPtr<ECMALineInfo>): string;
//# sourceMappingURL=util.d.ts.map