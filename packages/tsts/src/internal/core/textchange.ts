import type { int } from "@tsonic/core/types.js";
import type { GoSlice } from "../../go/compat.js";
import { Builder } from "../../go/strings.js";
import type { TextRange } from "./text.js";
import { TextRange_End, TextRange_Pos } from "./text.js";

// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length and
// slices like `s[i:j]` operate on byte offsets. TextRange positions are byte
// offsets, so we mirror that contract by operating over the UTF-8 byte view and
// converting back to a JS string at the boundaries.
const utf8Encoder: TextEncoder = new globalThis.TextEncoder();
const utf8Decoder: TextDecoder = new globalThis.TextDecoder("utf-8");
const byteSlice = (s: string, start: int, end?: int): string => {
  const bytes = utf8Encoder.encode(s);
  return utf8Decoder.decode(bytes.subarray(start, end));
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/textchange.go::type::TextChange","kind":"type","status":"implemented","sigHash":"b049bf647ae26cab28c3e1c063c93092ba5cc5e955068c0a012594dcb316ffaf","bodyHash":"b4a3fce95804d6f2984d42ecc6bb1e3e94a64454b9cc9b5ed9455d288db2e5b6"}
 *
 * Go source:
 * TextChange struct {
 * 	TextRange
 * 	NewText string
 * }
 */
export interface TextChange {
  readonly __tsgoEmbedded0?: TextRange;
  NewText: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/textchange.go::method::TextChange.ApplyTo","kind":"method","status":"implemented","sigHash":"a2a7a632bba018f7b3fd8d5257f74c1b5c7ed3936c93b0b853bafd480c184016","bodyHash":"7331686d511ba8b5d01573ea62c9008264c8912b52a3595e20de9982c03702aa"}
 *
 * Go source:
 * func (t TextChange) ApplyTo(text string) string {
 * 	return text[:t.Pos()] + t.NewText + text[t.End():]
 * }
 */
export function TextChange_ApplyTo(receiver: TextChange, text: string): string {
  const t = receiver.__tsgoEmbedded0!;
  return byteSlice(text, 0, TextRange_Pos(t)) + receiver.NewText + byteSlice(text, TextRange_End(t));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/textchange.go::func::ApplyBulkEdits","kind":"func","status":"implemented","sigHash":"714f348d25088c038e285bb5e4733959fc7009bc2f6e184afbd6f04ddced4ee7","bodyHash":"4962240e5c26ce73f39d4d05f517043a9f0c8aa57b5c88815c7e22215afca975"}
 *
 * Go source:
 * func ApplyBulkEdits(text string, edits []TextChange) string {
 * 	b := strings.Builder{}
 * 	b.Grow(len(text))
 * 	lastEnd := 0
 * 	for _, e := range edits {
 * 		start := e.TextRange.Pos()
 * 		if start != lastEnd {
 * 			b.WriteString(text[lastEnd:e.TextRange.Pos()])
 * 		}
 * 		b.WriteString(e.NewText)
 *
 * 		lastEnd = e.TextRange.End()
 * 	}
 * 	b.WriteString(text[lastEnd:])
 *
 * 	return b.String()
 * }
 */
export function ApplyBulkEdits(text: string, edits: GoSlice<TextChange>): string {
  const b = new Builder();
  b.Grow(utf8Encoder.encode(text).length);
  let lastEnd = 0;
  for (const e of edits) {
    const start = TextRange_Pos(e.__tsgoEmbedded0!);
    if (start !== lastEnd) {
      b.WriteString(byteSlice(text, lastEnd, TextRange_Pos(e.__tsgoEmbedded0!)));
    }
    b.WriteString(e.NewText);

    lastEnd = TextRange_End(e.__tsgoEmbedded0!);
  }
  b.WriteString(byteSlice(text, lastEnd));

  return b.String();
}
