import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoRune } from "../../go/compat.js";
import { ContainsRune } from "../../go/strings.js";
import { DecodeRuneInString } from "../../go/unicode/utf8.js";
import { Node_End, Node_Pos } from "../ast/spine.js";
import type { Node } from "../ast/spine.js";
import type { SourceFile } from "../ast/ast.js";
import { SourceFile_Text } from "../ast/ast.js";
import { GetSourceFileOfNode, NodeIsMissing } from "../ast/utilities.js";
import type { Identifier } from "../ast/generated/data.js";
import type { SourceFileNode } from "../ast/generated/unions.js";
import type { Kind } from "../ast/generated/kinds.js";
import { KindIdentifier, KindUnknown } from "../ast/generated/kinds.js";
import type { LanguageVariant } from "../core/languagevariant.js";
import { IsIdentifierPartEx, IsIdentifierStart, SkipTrivia, textToKeyword } from "./scanner.js";

// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length and
// slices like `name[i:]` operate on byte offsets. We mirror that contract by
// operating over the UTF-8 byte view of the JS string.
const utf8Encoder: TextEncoder = new globalThis.TextEncoder();
const utf8Decoder: TextDecoder = new globalThis.TextDecoder("utf-8");
type Utf8ByteInfo = { ascii: bool; bytes: Uint8Array };
const utf8ByteInfoCache = new globalThis.Map<string, Utf8ByteInfo>();

const getUtf8ByteInfo = (s: string): Utf8ByteInfo => {
  const cached = utf8ByteInfoCache.get(s);
  if (cached !== undefined) {
    return cached;
  }
  let ascii = true;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) >= 0x80) {
      ascii = false;
      break;
    }
  }
  const info: Utf8ByteInfo = {
    ascii,
    bytes: ascii ? undefined as unknown as Uint8Array : utf8Encoder.encode(s),
  };
  if (s.length >= 4096) {
    utf8ByteInfoCache.set(s, info);
  }
  return info;
};

const byteLen = (s: string): int => {
  const info = getUtf8ByteInfo(s);
  return info.ascii ? s.length : info.bytes.length;
};
const byteSlice = (s: string, start: int, end?: int): string => {
  const info = getUtf8ByteInfo(s);
  return info.ascii ? s.slice(start, end) : utf8Decoder.decode(info.bytes.subarray(start, end));
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::constGroup::surr1+surr2+surr3+surrSelf","kind":"constGroup","status":"implemented","sigHash":"0e4cdbe5c1d322b9af95d6c77f69a05739bab0e45336667b992bf7c92fca7dd9","bodyHash":"67e1b31d0cceafb3e2707a399cfabd3f63f6e56d8193ce64954382028e3ce63b"}
 *
 * Go source:
 * const (
 * 	surr1    = 0xd800
 * 	surr2    = 0xdc00
 * 	surr3    = 0xe000
 * 	surrSelf = 0x10000
 * )
 */
export const surr1: int = 0xd800;
export const surr2: int = 0xdc00;
export const surr3: int = 0xe000;
export const surrSelf: int = 0x10000;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::codePointIsHighSurrogate","kind":"func","status":"implemented","sigHash":"f7a44a51c8fbd010ccbba85f29b852c6564c375015a7e33101f7b073ee3b9a0c","bodyHash":"81f2e22ab2c0b827b5c5501bcad1a19b1ca5152f7113a965ad1c2361f66c78bd"}
 *
 * Go source:
 * func codePointIsHighSurrogate(r rune) bool {
 * 	return surr1 <= r && r < surr2
 * }
 */
export function codePointIsHighSurrogate(r: GoRune): bool {
  return surr1 <= r && r < surr2;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::codePointIsLowSurrogate","kind":"func","status":"implemented","sigHash":"825bbbe7cf5701993b3ac56d641001a11829341ea0b29d669485a87a7911ce92","bodyHash":"c98568c49fe4f03652e8c37c70c4d753e25dc2ef582f83d722f0392bf71e0d02"}
 *
 * Go source:
 * func codePointIsLowSurrogate(r rune) bool {
 * 	return surr2 <= r && r < surr3
 * }
 */
export function codePointIsLowSurrogate(r: GoRune): bool {
  return surr2 <= r && r < surr3;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::surrogatePairToCodepoint","kind":"func","status":"implemented","sigHash":"22f8a9877c5fc258538d63447f9914d64e2067ac7c1988b9c53afd7311678663","bodyHash":"36bd782ea3b3621a270b64583270fa1e54823ded9ecfa4cee20f86026b3621c0"}
 *
 * Go source:
 * func surrogatePairToCodepoint(r1, r2 rune) rune {
 * 	return (r1-surr1)<<10 | (r2 - surr2) + surrSelf
 * }
 */
export function surrogatePairToCodepoint(r1: GoRune, r2: GoRune): GoRune {
  return ((r1 - surr1) << 10) | (r2 - surr2 + surrSelf);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::encodeSurrogate","kind":"func","status":"implemented","sigHash":"2b3f3c1d70db7cbc381e823a09fc809b955ffba8986d29998983627281329861","bodyHash":"3d338da63ad530763726641b11a1c6d2e2e6df3b5c5c495805536a303b9e4551"}
 *
 * Go source:
 * func encodeSurrogate(r rune) string {
 * 	return string([]byte{
 * 		0xED,
 * 		byte(0x80 | ((r >> 6) & 0x3F)),
 * 		byte(0x80 | (r & 0x3F)),
 * 	})
 * }
 */
export function encodeSurrogate(r: GoRune): string {
  // Go encodes the surrogate as a 3-byte CESU-8 sequence because Go strings
  // cannot hold surrogate code points via string(rune). JS strings hold lone
  // surrogate code units natively, so the sentinel is the unit itself;
  // TextDecoder would destroy the CESU-8 bytes (invalid UTF-8 -> U+FFFD).
  // byteLen of a lone surrogate is 3 (TextEncoder emits U+FFFD), matching
  // Go's len() of the CESU-8 sentinel for the class-range size checks.
  return globalThis.String.fromCharCode(r);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::decodeClassAtomRune","kind":"func","status":"implemented","sigHash":"048ab810c787cc11e24b6295a27752b82c19a2eff78ccbe45af38d1e22cfb704","bodyHash":"4f44ff79d920c9fbebbd0125eb47b01dbb7f6ab771f17fe2562903f349fb3e63"}
 *
 * Go source:
 * func decodeClassAtomRune(s string) (rune, int) {
 * 	if len(s) >= 3 && s[0] == 0xED && s[1] >= 0xA0 && s[1] <= 0xBF && s[2] >= 0x80 && s[2] <= 0xBF {
 * 		r := rune(0xD000) | rune(s[1]&0x3F)<<6 | rune(s[2]&0x3F)
 * 		return r, 3
 * 	}
 * 	return utf8.DecodeRuneInString(s)
 * }
 */
export function decodeClassAtomRune(s: string): [GoRune, int] {
  // The sentinel from encodeSurrogate is a lone surrogate code unit (Go: a
  // 3-byte CESU-8 sequence). A high surrogate followed by a matching low
  // surrogate is a real astral character (raw source text / combined \u
  // escapes; 4-byte UTF-8 in Go) and decodes as the full code point instead.
  const first = s.length > 0 ? s.charCodeAt(0) : 0;
  if (first >= 0xd800 && first <= 0xdfff) {
    const second = s.length > 1 ? s.charCodeAt(1) : 0;
    if (!(first < 0xdc00 && second >= 0xdc00 && second <= 0xdfff)) {
      return [first as GoRune, 3];
    }
  }
  return DecodeRuneInString(s);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::tokenIsIdentifierOrKeyword","kind":"func","status":"implemented","sigHash":"538026bcddd56581a52c2d4c5ae6b1f36ef3386ee89dd8f7605ba57f9f21df7d","bodyHash":"b09ca2afbed17046efb355bbc5fa534f58fc7cb9b3b212c37a3ba8428a1b3726"}
 *
 * Go source:
 * func tokenIsIdentifierOrKeyword(token ast.Kind) bool {
 * 	return token >= ast.KindIdentifier
 * }
 */
export function tokenIsIdentifierOrKeyword(token: Kind): bool {
  return token >= KindIdentifier;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::IdentifierToKeywordKind","kind":"func","status":"implemented","sigHash":"6172c94e106da8d5ca81160eaab6e3895741c910f74ce84d4ab539648cc9f6da","bodyHash":"d09bed88ec9b94ec73b361dc4e469f91335a1c646edd53b2070b725af8ed357a"}
 *
 * Go source:
 * func IdentifierToKeywordKind(node *ast.Identifier) ast.Kind {
 * 	return textToKeyword[node.Text]
 * }
 */
export function IdentifierToKeywordKind(node: GoPtr<Identifier>): Kind {
  return textToKeyword.get(node!.Text) ?? KindUnknown;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::GetSourceTextOfNodeFromSourceFile","kind":"func","status":"implemented","sigHash":"b7cca8022b228202419ff6a10aae646430a4663efa578392cfb257ad13cb8c4a","bodyHash":"3ad2719a98901b75c3c09a0e86e2f00a2b42f0ba823f317b37fbb5288d36d508"}
 *
 * Go source:
 * func GetSourceTextOfNodeFromSourceFile(sourceFile *ast.SourceFile, node *ast.Node, includeTrivia bool) string {
 * 	return GetTextOfNodeFromSourceText(sourceFile.Text(), node, includeTrivia)
 * }
 */
export function GetSourceTextOfNodeFromSourceFile(sourceFile: GoPtr<SourceFileNode>, node: GoPtr<Node>, includeTrivia: bool): string {
  return GetTextOfNodeFromSourceText(SourceFile_Text(sourceFile as GoPtr<SourceFile>), node, includeTrivia);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::GetTextOfNodeFromSourceText","kind":"func","status":"implemented","sigHash":"50273fa97318ececf08f0e40b5aa9b625dc22ee36fa65aa43b3792df6e056025","bodyHash":"ccc4594cd54e8aa853fdbe1e0f238807f30db56fdb1e3f3bfb45b888d0611196"}
 *
 * Go source:
 * func GetTextOfNodeFromSourceText(sourceText string, node *ast.Node, includeTrivia bool) string {
 * 	if ast.NodeIsMissing(node) {
 * 		return ""
 * 	}
 * 	pos := node.Pos()
 * 	if !includeTrivia {
 * 		pos = SkipTrivia(sourceText, pos)
 * 	}
 * 	text := sourceText[pos:node.End()]
 * 	// if (isJSDocTypeExpressionOrChild(node)) {
 * 	//     // strip space + asterisk at line start
 * 	//     text = text.split(/\r\n|\n|\r/).map(line => line.replace(/^\s*\* /, "").trimStart()).join("\n");
 * 	// }
 * 	return text
 * }
 */
export function GetTextOfNodeFromSourceText(sourceText: string, node: GoPtr<Node>, includeTrivia: bool): string {
  if (NodeIsMissing(node)) {
    return "";
  }
  const rawPos = Node_Pos(node);
  const pos = includeTrivia ? rawPos : SkipTrivia(sourceText, rawPos);
  return byteSlice(sourceText, pos, Node_End(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::GetTextOfNode","kind":"func","status":"implemented","sigHash":"af3b3d5af10aba571189fe45de3a202f5979647ea5666587041cb14941e3fcd4","bodyHash":"806427f325bde31538bfa18fb5dbaadc6dca3040796c8a64c45254d5eaa414b8"}
 *
 * Go source:
 * func GetTextOfNode(node *ast.Node) string {
 * 	return GetSourceTextOfNodeFromSourceFile(ast.GetSourceFileOfNode(node), node, false /*includeTrivia* /)
 * }
 */
export function GetTextOfNode(node: GoPtr<Node>): string {
  return GetSourceTextOfNodeFromSourceFile(GetSourceFileOfNode(node), node, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::DeclarationNameToString","kind":"func","status":"implemented","sigHash":"b94b736db3899ab68a72217ba50aa545c6dfd8ef5a9f71144ad3a5964b77e5ac","bodyHash":"232b64bb61a169e5aa06fa603b208229ec2b6966dad37e8c491db825c9881d07"}
 *
 * Go source:
 * func DeclarationNameToString(name *ast.Node) string {
 * 	if name == nil || name.Pos() == name.End() {
 * 		return "(Missing)"
 * 	}
 * 	return GetTextOfNode(name)
 * }
 */
export function DeclarationNameToString(name: GoPtr<Node>): string {
  if (name === undefined || Node_Pos(name) === Node_End(name)) {
    return "(Missing)";
  }
  return GetTextOfNode(name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::IsIdentifierText","kind":"func","status":"implemented","sigHash":"72f0796a8b0ce5a14a69ef9e4b1610a766c727298699028c24b6a5b777901bb3","bodyHash":"1cead4bdfd6e6cc977544d738b6fe5a127d56a7634b71cbeeb0b998b5273dce4"}
 *
 * Go source:
 * func IsIdentifierText(name string, languageVariant core.LanguageVariant) bool {
 * 	ch, size := utf8.DecodeRuneInString(name)
 * 	if !IsIdentifierStart(ch) {
 * 		return false
 * 	}
 * 	for i := size; i < len(name); {
 * 		ch, size = utf8.DecodeRuneInString(name[i:])
 * 		if !IsIdentifierPartEx(ch, languageVariant) {
 * 			return false
 * 		}
 * 		i += size
 * 	}
 * 	return true
 * }
 */
export function IsIdentifierText(name: string, languageVariant: LanguageVariant): bool {
  const [ch, size] = DecodeRuneInString(name);
  if (!IsIdentifierStart(ch)) {
    return false;
  }
  const loop = (i: int): bool => {
    if (i >= byteLen(name)) return true;
    const [ch2, sz] = DecodeRuneInString(byteSlice(name, i));
    if (!IsIdentifierPartEx(ch2, languageVariant)) return false;
    return loop((i + sz) as int);
  };
  return loop(size as int);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::IsIntrinsicJsxName","kind":"func","status":"implemented","sigHash":"7cf3e81e7a4af8bd5623e3fb0ed2679987e21e4a6e17e28069f6028cbd3ce225","bodyHash":"531253eef38befaa611f654ca8f59419dccc473ab55b52fffe4929a12ca0dfea"}
 *
 * Go source:
 * func IsIntrinsicJsxName(name string) bool {
 * 	return len(name) != 0 && (name[0] >= 'a' && name[0] <= 'z' || strings.ContainsRune(name, '-'))
 * }
 */
export function IsIntrinsicJsxName(name: string): bool {
  const nameBytes = utf8Encoder.encode(name);
  const b0: int = nameBytes.length !== 0 ? nameBytes[0]! : 0;
  return nameBytes.length !== 0 && ((b0 >= 0x61 && b0 <= 0x7a) || ContainsRune(name, 0x2d));
}
