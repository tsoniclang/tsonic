import type { byte, int } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";
import { CutPrefix, HasPrefix, TrimLeftFunc, TrimRightFunc } from "../../go/strings.js";
import { IsSpace } from "../../go/unicode.js";
import { IsLineBreak } from "../stringutil/util.js";
import { ECMALineInfo_LineCount, ECMALineInfo_LineText } from "./lineinfo.js";
import type { ECMALineInfo } from "./lineinfo.js";

// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length and
// `s[i]` is a byte. We mirror that contract by operating over the UTF-8 byte
// view of the string.
const utf8Encoder: TextEncoder = new globalThis.TextEncoder();
const utf8Decoder: TextDecoder = new globalThis.TextDecoder("utf-8");
const byteLen = (s: string): int => utf8Encoder.encode(s).length;
const byteAt = (s: string, i: int): byte => utf8Encoder.encode(s)[i]!;
// byteSliceFrom returns s[start:] using the UTF-8 byte view, mirroring Go's
// byte-offset string slicing.
const byteSliceFrom = (s: string, start: int): string => {
  const bytes: Uint8Array = utf8Encoder.encode(s);
  return utf8Decoder.decode(bytes.subarray(start));
};

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
export function TryGetSourceMappingURL(lineInfo: GoPtr<ECMALineInfo>): string {
  if (lineInfo !== undefined) {
    for (let index = ECMALineInfo_LineCount(lineInfo) - 1; index >= 0; index--) {
      let line = ECMALineInfo_LineText(lineInfo, index);
      line = TrimLeftFunc(line, IsSpace);
      line = TrimRightFunc(line, IsLineBreak);
      if (byteLen(line) === 0) {
        continue;
      }
      if (byteLen(line) < 4 || !HasPrefix(line, "//") || (byteAt(line, 2) !== 0x23 /* '#' */ && byteAt(line, 2) !== 0x40 /* '@' */) || byteAt(line, 3) !== 0x20 /* ' ' */) {
        break;
      }
      const [url, ok] = CutPrefix(byteSliceFrom(line, 4), "sourceMappingURL=");
      if (ok) {
        return TrimRightFunc(url, IsSpace);
      }
    }
  }
  return "";
}
