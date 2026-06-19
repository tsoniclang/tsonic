import type { int } from "../../go/scalars.js";
import type { GoPtr } from "../../go/compat.js";
import type { TextPos } from "../core/text.js";
import type { ECMALineStarts } from "../core/core.js";

// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length and
// slices like `s[pos:end]` operate on byte offsets. We mirror that contract by
// operating over the UTF-8 byte view and converting back to a JS string at the
// boundaries.
const utf8Encoder: TextEncoder = new globalThis.TextEncoder();
const utf8Decoder: TextDecoder = new globalThis.TextDecoder("utf-8");
const byteLen = (s: string): int => utf8Encoder.encode(s).length;
const byteSlice = (s: string, start: int, end: int): string => {
  const bytes: Uint8Array = utf8Encoder.encode(s);
  return utf8Decoder.decode(bytes.subarray(start, end));
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/lineinfo.go::type::ECMALineInfo","kind":"type","status":"implemented","sigHash":"d2a68ae5db0c5c56d4ec5688c7f74a32bf9ebc42fbc8b0ab4a191e893aefed1c","bodyHash":"01cd7006d538725a37e98a53e72437535db3cd37f80ff269033d3e610c904763"}
 *
 * Go source:
 * ECMALineInfo struct {
 * 	text       string
 * 	lineStarts core.ECMALineStarts
 * }
 */
export interface ECMALineInfo {
  text: string;
  lineStarts: ECMALineStarts;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/lineinfo.go::func::CreateECMALineInfo","kind":"func","status":"implemented","sigHash":"d871116961c0e7a57eaec9500e3ad1c3a8cc4c83bbe2b431f93d840fc31b6731","bodyHash":"7c16e2862c0db1e8130c3dd2f40b674513a2ac1584fb96f417f0cd9dbd8acbd6"}
 *
 * Go source:
 * func CreateECMALineInfo(text string, lineStarts core.ECMALineStarts) *ECMALineInfo {
 * 	return &ECMALineInfo{
 * 		text:       text,
 * 		lineStarts: lineStarts,
 * 	}
 * }
 */
export function CreateECMALineInfo(text: string, lineStarts: ECMALineStarts): GoPtr<ECMALineInfo> {
  return {
    text: text,
    lineStarts: lineStarts,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/lineinfo.go::method::ECMALineInfo.LineCount","kind":"method","status":"implemented","sigHash":"553217946163315b0c55711503228558d776ddb6410417eb04ca0ecf6667b5b5","bodyHash":"8a67f2324649a88b1a7c55f16b883c788bf81c7dfda9a8f48d195c0ba3051f19"}
 *
 * Go source:
 * func (li *ECMALineInfo) LineCount() int {
 * 	return len(li.lineStarts)
 * }
 */
export function ECMALineInfo_LineCount(receiver: GoPtr<ECMALineInfo>): int {
  const li: ECMALineInfo = receiver!;
  return li.lineStarts.length;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/lineinfo.go::method::ECMALineInfo.LineText","kind":"method","status":"implemented","sigHash":"2562d90d8a3681cbd552c5baef7f822d9951d59d98aa07e6a55a13e0778d7c9a","bodyHash":"cb3108bba58e86bcb57afe918474fa6105b77ad8fbed9fbd6c06a38e26675dec"}
 *
 * Go source:
 * func (li *ECMALineInfo) LineText(line int) string {
 * 	pos := li.lineStarts[line]
 * 	var end core.TextPos
 * 	if line+1 < len(li.lineStarts) {
 * 		end = li.lineStarts[line+1]
 * 	} else {
 * 		end = core.TextPos(len(li.text))
 * 	}
 * 	return li.text[pos:end]
 * }
 */
export function ECMALineInfo_LineText(receiver: GoPtr<ECMALineInfo>, line: int): string {
  const li: ECMALineInfo = receiver!;
  const pos: TextPos = li.lineStarts[line]!;
  let end: TextPos;
  if (line + 1 < li.lineStarts.length) {
    end = li.lineStarts[line + 1]!;
  } else {
    end = byteLen(li.text);
  }
  return byteSlice(li.text, pos, end);
}
