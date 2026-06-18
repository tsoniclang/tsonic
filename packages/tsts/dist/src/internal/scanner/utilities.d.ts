import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoRune } from "../../go/compat.js";
import type { Node } from "../ast/spine.js";
import type { Identifier } from "../ast/generated/data.js";
import type { SourceFileNode } from "../ast/generated/unions.js";
import type { Kind } from "../ast/generated/kinds.js";
import type { LanguageVariant } from "../core/languagevariant.js";
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
export declare const surr1: int;
export declare const surr2: int;
export declare const surr3: int;
export declare const surrSelf: int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::codePointIsHighSurrogate","kind":"func","status":"implemented","sigHash":"f7a44a51c8fbd010ccbba85f29b852c6564c375015a7e33101f7b073ee3b9a0c","bodyHash":"81f2e22ab2c0b827b5c5501bcad1a19b1ca5152f7113a965ad1c2361f66c78bd"}
 *
 * Go source:
 * func codePointIsHighSurrogate(r rune) bool {
 * 	return surr1 <= r && r < surr2
 * }
 */
export declare function codePointIsHighSurrogate(r: GoRune): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::codePointIsLowSurrogate","kind":"func","status":"implemented","sigHash":"825bbbe7cf5701993b3ac56d641001a11829341ea0b29d669485a87a7911ce92","bodyHash":"c98568c49fe4f03652e8c37c70c4d753e25dc2ef582f83d722f0392bf71e0d02"}
 *
 * Go source:
 * func codePointIsLowSurrogate(r rune) bool {
 * 	return surr2 <= r && r < surr3
 * }
 */
export declare function codePointIsLowSurrogate(r: GoRune): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::surrogatePairToCodepoint","kind":"func","status":"implemented","sigHash":"22f8a9877c5fc258538d63447f9914d64e2067ac7c1988b9c53afd7311678663","bodyHash":"36bd782ea3b3621a270b64583270fa1e54823ded9ecfa4cee20f86026b3621c0"}
 *
 * Go source:
 * func surrogatePairToCodepoint(r1, r2 rune) rune {
 * 	return (r1-surr1)<<10 | (r2 - surr2) + surrSelf
 * }
 */
export declare function surrogatePairToCodepoint(r1: GoRune, r2: GoRune): GoRune;
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
export declare function encodeSurrogate(r: GoRune): string;
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
export declare function decodeClassAtomRune(s: string): [GoRune, int];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::tokenIsIdentifierOrKeyword","kind":"func","status":"implemented","sigHash":"538026bcddd56581a52c2d4c5ae6b1f36ef3386ee89dd8f7605ba57f9f21df7d","bodyHash":"b09ca2afbed17046efb355bbc5fa534f58fc7cb9b3b212c37a3ba8428a1b3726"}
 *
 * Go source:
 * func tokenIsIdentifierOrKeyword(token ast.Kind) bool {
 * 	return token >= ast.KindIdentifier
 * }
 */
export declare function tokenIsIdentifierOrKeyword(token: Kind): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::IdentifierToKeywordKind","kind":"func","status":"implemented","sigHash":"6172c94e106da8d5ca81160eaab6e3895741c910f74ce84d4ab539648cc9f6da","bodyHash":"d09bed88ec9b94ec73b361dc4e469f91335a1c646edd53b2070b725af8ed357a"}
 *
 * Go source:
 * func IdentifierToKeywordKind(node *ast.Identifier) ast.Kind {
 * 	return textToKeyword[node.Text]
 * }
 */
export declare function IdentifierToKeywordKind(node: GoPtr<Identifier>): Kind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::GetSourceTextOfNodeFromSourceFile","kind":"func","status":"implemented","sigHash":"b7cca8022b228202419ff6a10aae646430a4663efa578392cfb257ad13cb8c4a","bodyHash":"3ad2719a98901b75c3c09a0e86e2f00a2b42f0ba823f317b37fbb5288d36d508"}
 *
 * Go source:
 * func GetSourceTextOfNodeFromSourceFile(sourceFile *ast.SourceFile, node *ast.Node, includeTrivia bool) string {
 * 	return GetTextOfNodeFromSourceText(sourceFile.Text(), node, includeTrivia)
 * }
 */
export declare function GetSourceTextOfNodeFromSourceFile(sourceFile: GoPtr<SourceFileNode>, node: GoPtr<Node>, includeTrivia: bool): string;
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
export declare function GetTextOfNodeFromSourceText(sourceText: string, node: GoPtr<Node>, includeTrivia: bool): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::GetTextOfNode","kind":"func","status":"implemented","sigHash":"af3b3d5af10aba571189fe45de3a202f5979647ea5666587041cb14941e3fcd4","bodyHash":"806427f325bde31538bfa18fb5dbaadc6dca3040796c8a64c45254d5eaa414b8"}
 *
 * Go source:
 * func GetTextOfNode(node *ast.Node) string {
 * 	return GetSourceTextOfNodeFromSourceFile(ast.GetSourceFileOfNode(node), node, false /*includeTrivia* /)
 * }
 */
export declare function GetTextOfNode(node: GoPtr<Node>): string;
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
export declare function DeclarationNameToString(name: GoPtr<Node>): string;
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
export declare function IsIdentifierText(name: string, languageVariant: LanguageVariant): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::IsIntrinsicJsxName","kind":"func","status":"implemented","sigHash":"7cf3e81e7a4af8bd5623e3fb0ed2679987e21e4a6e17e28069f6028cbd3ce225","bodyHash":"531253eef38befaa611f654ca8f59419dccc473ab55b52fffe4929a12ca0dfea"}
 *
 * Go source:
 * func IsIntrinsicJsxName(name string) bool {
 * 	return len(name) != 0 && (name[0] >= 'a' && name[0] <= 'z' || strings.ContainsRune(name, '-'))
 * }
 */
export declare function IsIntrinsicJsxName(name: string): bool;
//# sourceMappingURL=utilities.d.ts.map