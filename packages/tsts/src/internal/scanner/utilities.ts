import type { bool, int } from "../../go/scalars.js";
import type { GoPtr } from "../../go/compat.js";
import { Builder, ContainsRune, TrimRightFunc } from "../../go/strings.js";
import { DecodeRuneInString, DecodeRuneInStringAt, StringByteAt, StringByteLen, StringByteSlice } from "../../go/unicode/utf8.js";
import { IsSpace } from "../../go/unicode.js";
import { Node_End, Node_KindString, Node_Pos } from "../ast/spine.js";
import type { Node, NodeList } from "../ast/spine.js";
import type { SourceFile } from "../ast/ast.js";
import { Node_Text, SourceFile_Text } from "../ast/ast.js";
import { GetSourceFileOfNode, NodeIsMissing } from "../ast/utilities.js";
import type { Identifier } from "../ast/generated/data.js";
import type { SourceFileNode } from "../ast/generated/unions.js";
import type { Kind } from "../ast/generated/kinds.js";
import { KindIdentifier, KindJSDocLink, KindJSDocLinkCode, KindJSDocLinkPlain, KindJSDocText, KindUnknown } from "../ast/generated/kinds.js";
import { IsIdentifier, IsStringLiteral } from "../ast/generated/predicates.js";
import { AsStringLiteral } from "../ast/generated/casts.js";
import { NodeFlagsReparserTransformedLiteral } from "../ast/generated/flags.js";
import { TokenFlagsSingleQuote } from "../ast/tokenflags.js";
import { FailBadSyntaxKind } from "../debug/debug.js";
import type { LanguageVariant } from "../core/languagevariant.js";
import { IsIdentifierPartEx, IsIdentifierStart, SkipTrivia, textToKeyword } from "./scanner.js";

// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length and
// slices like `name[i:]` operate on byte offsets. We mirror that contract by
// operating over the UTF-8 byte view of the JS string.
const byteLen = StringByteLen;
const byteSlice = StringByteSlice;

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
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::GetTextOfNodeFromSourceText","kind":"func","status":"implemented","sigHash":"50273fa97318ececf08f0e40b5aa9b625dc22ee36fa65aa43b3792df6e056025","bodyHash":"47a01b3f218bc6c7c312b4edaa3d3f249510a38fc1166397d5bf1723de48581b"}
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
 * 	if node.Flags&ast.NodeFlagsReparserTransformedLiteral != 0 {
 * 		// This is similar to `getLiteralTextOfNode` in the printer, but without the context of an `emitContext` to provide overrides
 * 		if ast.IsStringLiteral(node) {
 * 			if node.AsStringLiteral().TokenFlags&ast.TokenFlagsSingleQuote != 0 {
 * 				return "'" + text + "'"
 * 			}
 * 			return "\"" + text + "\""
 * 		} else if ast.IsIdentifier(node) {
 * 			return node.Text()
 * 		}
 * 		// Only the above node kinds are currently transformed into one another by the reparser, requiring the textual remapping.
 * 		// (Any reamppings done by emit transforms are handled by `getLiteralTextOfNode` in the printer)
 * 		// Fail on any other kinds.
 * 		debug.FailBadSyntaxKind(node, "Unexpected reparser-transformed node kind")
 * 	}
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
  const text = byteSlice(sourceText, pos, Node_End(node));
  if ((node!.Flags & NodeFlagsReparserTransformedLiteral) !== 0) {
    // This is similar to `getLiteralTextOfNode` in the printer, but without the context of an `emitContext` to provide overrides
    if (IsStringLiteral(node)) {
      if ((AsStringLiteral(node)!.TokenFlags & TokenFlagsSingleQuote) !== 0) {
        return "'" + text + "'";
      }
      return '"' + text + '"';
    } else if (IsIdentifier(node)) {
      return Node_Text(node);
    }
    // Only the above node kinds are currently transformed into one another by the reparser, requiring the textual remapping.
    // (Any reamppings done by emit transforms are handled by `getLiteralTextOfNode` in the printer)
    // Fail on any other kinds.
    FailBadSyntaxKind({ KindString: () => Node_KindString(node) }, "Unexpected reparser-transformed node kind");
  }
  // if (isJSDocTypeExpressionOrChild(node)) {
  //     // strip space + asterisk at line start
  //     text = text.split(/\r\n|\n|\r/).map(line => line.replace(/^\s*\* /, "").trimStart()).join("\n");
  // }
  return text;
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
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/scanner/utilities.go::func::GetTextOfJSDocComment","kind":"func","status":"implemented","sigHash":"c56e5529d44d70a1ad892f8b69253533bdf88fb199c093507075e44a673f0e1b","bodyHash":"923ac6ce0d7e1afddfa1d6492a52a8363a0b5b41bd95c9cdfc387ca8f2acc0dd"}
 *
 * Go source:
 * func GetTextOfJSDocComment(comment *ast.NodeList) string {
 * 	if comment == nil {
 * 		return ""
 * 	}
 * 	var b strings.Builder
 * 	for _, n := range comment.Nodes {
 * 		switch n.Kind {
 * 		case ast.KindJSDocText:
 * 			b.WriteString(n.Text())
 * 		case ast.KindJSDocLink, ast.KindJSDocLinkCode, ast.KindJSDocLinkPlain:
 * 			b.WriteString(GetTextOfNode(n))
 * 		}
 * 	}
 * 	return strings.TrimRightFunc(b.String(), unicode.IsSpace)
 * }
 */
export function GetTextOfJSDocComment(comment: GoPtr<NodeList>): string {
  if (comment === undefined) {
    return "";
  }
  const b = new Builder();
  for (const n of comment!.Nodes) {
    switch (n!.Kind) {
      case KindJSDocText:
        b.WriteString(Node_Text(n));
        break;
      case KindJSDocLink:
      case KindJSDocLinkCode:
      case KindJSDocLinkPlain:
        b.WriteString(GetTextOfNode(n));
        break;
    }
  }
  return TrimRightFunc(b.String(), IsSpace);
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
    const [ch2, sz] = DecodeRuneInStringAt(name, i);
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
  const nameLen = byteLen(name);
  const b0: int = nameLen !== 0 ? StringByteAt(name, 0) : 0;
  return nameLen !== 0 && ((b0 >= 0x61 && b0 <= 0x7a) || ContainsRune(name, 0x2d));
}
