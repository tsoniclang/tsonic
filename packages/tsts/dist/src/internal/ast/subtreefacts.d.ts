import type { uint } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";
import type { ModifierList, Node, NodeList } from "./spine.js";
import type { BindingElementNode, TypeArgumentList, TypeNode } from "./generated/unions.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/subtreefacts.go::type::SubtreeFacts","kind":"type","status":"implemented","sigHash":"8f0fe631eec94e4ce88656c0643f0b256cb736f62c69243cc74dfaa5b3312d94","bodyHash":"6498a6b3e19a4606500cbe0758c0b3f1ddb5317ab94ee8a32106b0f2b37553dc"}
 *
 * Go source:
 * SubtreeFacts uint32
 */
export type SubtreeFacts = uint;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/subtreefacts.go::constGroup::SubtreeContainsTypeScript+SubtreeContainsJsx+SubtreeContainsESDecorators+SubtreeContainsUsing+SubtreeContainsClassStaticBlocks+SubtreeContainsESClassFields+SubtreeContainsLogicalAssignments+SubtreeContainsNullishCoalescing+SubtreeContainsOptionalChaining+SubtreeContainsMissingCatchClauseVariable+SubtreeContainsESObjectRestOrSpread+SubtreeContainsForAwaitOrAsyncGenerator+SubtreeContainsAnyAwait+SubtreeContainsExponentiationOperator+SubtreeContainsLexicalThis+SubtreeContainsLexicalSuper+SubtreeContainsRestOrSpread+SubtreeContainsObjectRestOrSpread+SubtreeContainsAwait+SubtreeContainsDynamicImport+SubtreeContainsClassFields+SubtreeContainsDecorators+SubtreeContainsIdentifier+SubtreeContainsPrivateIdentifierInExpression+SubtreeContainsInvalidTemplateEscape+SubtreeFactsComputed+SubtreeFactsNone+SubtreeContainsESNext+SubtreeContainsES2022+SubtreeContainsES2021+SubtreeContainsES2020+SubtreeContainsES2019+SubtreeContainsES2018+SubtreeContainsES2017+SubtreeContainsES2016+SubtreeExclusionsNode+SubtreeExclusionsEraseable+SubtreeExclusionsOuterExpression+SubtreeExclusionsPropertyAccess+SubtreeExclusionsElementAccess+SubtreeExclusionsArrowFunction+SubtreeExclusionsFunction+SubtreeExclusionsConstructor+SubtreeExclusionsMethod+SubtreeExclusionsAccessor+SubtreeExclusionsProperty+SubtreeExclusionsClass+SubtreeExclusionsModule+SubtreeExclusionsObjectLiteral+SubtreeExclusionsArrayLiteral+SubtreeExclusionsCall+SubtreeExclusionsNew+SubtreeExclusionsVariableDeclarationList+SubtreeExclusionsParameter+SubtreeExclusionsCatchClause+SubtreeExclusionsBindingPattern+SubtreeContainsLexicalThisOrSuper","kind":"constGroup","status":"implemented","sigHash":"67abaf6e7a488fa0b69a8e1adfb609de04baeaaf97876cc8b01993175c6d46f2","bodyHash":"c2260d4b53d45cccccc36f4f0a6655e2ad7e5b69d0972a3576f1b4064ffe062d"}
 *
 * Go source:
 * const (
 * 	// Facts
 * 	// - Flags used to indicate that a node or subtree contains syntax relevant to a specific transform
 *
 * 	SubtreeContainsTypeScript SubtreeFacts = 1 << iota
 * 	SubtreeContainsJsx
 * 	SubtreeContainsESDecorators
 * 	SubtreeContainsUsing
 * 	SubtreeContainsClassStaticBlocks
 * 	SubtreeContainsESClassFields
 * 	SubtreeContainsLogicalAssignments
 * 	SubtreeContainsNullishCoalescing
 * 	SubtreeContainsOptionalChaining
 * 	SubtreeContainsMissingCatchClauseVariable
 * 	SubtreeContainsESObjectRestOrSpread // subtree has a `...` somewhere inside it, never cleared
 * 	SubtreeContainsForAwaitOrAsyncGenerator
 * 	SubtreeContainsAnyAwait
 * 	SubtreeContainsExponentiationOperator
 *
 * 	// Markers
 * 	// - Flags used to indicate that a node or subtree contains a particular kind of syntax.
 *
 * 	SubtreeContainsLexicalThis
 * 	SubtreeContainsLexicalSuper
 * 	SubtreeContainsRestOrSpread       // marker on any `...` - cleared on binding pattern exit
 * 	SubtreeContainsObjectRestOrSpread // marker on any `{...x}` - cleared on most scope exits
 * 	SubtreeContainsAwait
 * 	SubtreeContainsDynamicImport
 * 	SubtreeContainsClassFields
 * 	SubtreeContainsDecorators
 * 	SubtreeContainsIdentifier
 * 	SubtreeContainsPrivateIdentifierInExpression
 * 	SubtreeContainsInvalidTemplateEscape
 *
 * 	SubtreeFactsComputed              // NOTE: This should always be last
 * 	SubtreeFactsNone     SubtreeFacts = 0
 *
 * 	// Aliases (unused, for documentation purposes only - correspond to combinations in transformers/estransforms/definitions.go)
 *
 * 	SubtreeContainsESNext = SubtreeContainsESDecorators | SubtreeContainsUsing
 * 	SubtreeContainsES2022 = SubtreeContainsClassStaticBlocks | SubtreeContainsESClassFields
 * 	SubtreeContainsES2021 = SubtreeContainsLogicalAssignments
 * 	SubtreeContainsES2020 = SubtreeContainsNullishCoalescing | SubtreeContainsOptionalChaining
 * 	SubtreeContainsES2019 = SubtreeContainsMissingCatchClauseVariable
 * 	SubtreeContainsES2018 = SubtreeContainsESObjectRestOrSpread | SubtreeContainsForAwaitOrAsyncGenerator | SubtreeContainsInvalidTemplateEscape
 * 	SubtreeContainsES2017 = SubtreeContainsAnyAwait
 * 	SubtreeContainsES2016 = SubtreeContainsExponentiationOperator
 *
 * 	// Scope Exclusions
 * 	// - Bitmasks that exclude flags from propagating out of a specific context
 * 	//   into the subtree flags of their container.
 *
 * 	SubtreeExclusionsNode                    = SubtreeFactsComputed
 * 	SubtreeExclusionsEraseable               = ^SubtreeContainsTypeScript
 * 	SubtreeExclusionsOuterExpression         = SubtreeExclusionsNode
 * 	SubtreeExclusionsPropertyAccess          = SubtreeExclusionsNode
 * 	SubtreeExclusionsElementAccess           = SubtreeExclusionsNode
 * 	SubtreeExclusionsArrowFunction           = SubtreeExclusionsNode | SubtreeContainsAwait | SubtreeContainsObjectRestOrSpread
 * 	SubtreeExclusionsFunction                = SubtreeExclusionsNode | SubtreeContainsLexicalThis | SubtreeContainsLexicalSuper | SubtreeContainsAwait | SubtreeContainsObjectRestOrSpread
 * 	SubtreeExclusionsConstructor             = SubtreeExclusionsNode | SubtreeContainsLexicalThis | SubtreeContainsLexicalSuper | SubtreeContainsAwait | SubtreeContainsObjectRestOrSpread
 * 	SubtreeExclusionsMethod                  = SubtreeExclusionsNode | SubtreeContainsLexicalThis | SubtreeContainsLexicalSuper | SubtreeContainsAwait | SubtreeContainsObjectRestOrSpread
 * 	SubtreeExclusionsAccessor                = SubtreeExclusionsNode | SubtreeContainsLexicalThis | SubtreeContainsLexicalSuper | SubtreeContainsAwait | SubtreeContainsObjectRestOrSpread
 * 	SubtreeExclusionsProperty                = SubtreeExclusionsNode | SubtreeContainsLexicalThis | SubtreeContainsLexicalSuper
 * 	SubtreeExclusionsClass                   = SubtreeExclusionsNode
 * 	SubtreeExclusionsModule                  = SubtreeExclusionsNode | SubtreeContainsLexicalThis | SubtreeContainsLexicalSuper
 * 	SubtreeExclusionsObjectLiteral           = SubtreeExclusionsNode | SubtreeContainsObjectRestOrSpread
 * 	SubtreeExclusionsArrayLiteral            = SubtreeExclusionsNode
 * 	SubtreeExclusionsCall                    = SubtreeExclusionsNode
 * 	SubtreeExclusionsNew                     = SubtreeExclusionsNode
 * 	SubtreeExclusionsVariableDeclarationList = SubtreeExclusionsNode | SubtreeContainsObjectRestOrSpread
 * 	SubtreeExclusionsParameter               = SubtreeExclusionsNode
 * 	SubtreeExclusionsCatchClause             = SubtreeExclusionsNode | SubtreeContainsObjectRestOrSpread
 * 	SubtreeExclusionsBindingPattern          = SubtreeExclusionsNode | SubtreeContainsRestOrSpread
 *
 * 	// Masks
 * 	// - Additional bitmasks
 *
 * 	SubtreeContainsLexicalThisOrSuper = SubtreeContainsLexicalThis | SubtreeContainsLexicalSuper
 * )
 */
export declare const SubtreeContainsTypeScript: SubtreeFacts;
export declare const SubtreeContainsJsx: SubtreeFacts;
export declare const SubtreeContainsESDecorators: SubtreeFacts;
export declare const SubtreeContainsUsing: SubtreeFacts;
export declare const SubtreeContainsClassStaticBlocks: SubtreeFacts;
export declare const SubtreeContainsESClassFields: SubtreeFacts;
export declare const SubtreeContainsLogicalAssignments: SubtreeFacts;
export declare const SubtreeContainsNullishCoalescing: SubtreeFacts;
export declare const SubtreeContainsOptionalChaining: SubtreeFacts;
export declare const SubtreeContainsMissingCatchClauseVariable: SubtreeFacts;
export declare const SubtreeContainsESObjectRestOrSpread: SubtreeFacts;
export declare const SubtreeContainsForAwaitOrAsyncGenerator: SubtreeFacts;
export declare const SubtreeContainsAnyAwait: SubtreeFacts;
export declare const SubtreeContainsExponentiationOperator: SubtreeFacts;
export declare const SubtreeContainsLexicalThis: SubtreeFacts;
export declare const SubtreeContainsLexicalSuper: SubtreeFacts;
export declare const SubtreeContainsRestOrSpread: SubtreeFacts;
export declare const SubtreeContainsObjectRestOrSpread: SubtreeFacts;
export declare const SubtreeContainsAwait: SubtreeFacts;
export declare const SubtreeContainsDynamicImport: SubtreeFacts;
export declare const SubtreeContainsClassFields: SubtreeFacts;
export declare const SubtreeContainsDecorators: SubtreeFacts;
export declare const SubtreeContainsIdentifier: SubtreeFacts;
export declare const SubtreeContainsPrivateIdentifierInExpression: SubtreeFacts;
export declare const SubtreeContainsInvalidTemplateEscape: SubtreeFacts;
export declare const SubtreeFactsComputed: SubtreeFacts;
export declare const SubtreeFactsNone: SubtreeFacts;
export declare const SubtreeContainsESNext: SubtreeFacts;
export declare const SubtreeContainsES2022: SubtreeFacts;
export declare const SubtreeContainsES2021: SubtreeFacts;
export declare const SubtreeContainsES2020: SubtreeFacts;
export declare const SubtreeContainsES2019: SubtreeFacts;
export declare const SubtreeContainsES2018: SubtreeFacts;
export declare const SubtreeContainsES2017: SubtreeFacts;
export declare const SubtreeContainsES2016: SubtreeFacts;
export declare const SubtreeExclusionsNode: SubtreeFacts;
export declare const SubtreeExclusionsEraseable: SubtreeFacts;
export declare const SubtreeExclusionsOuterExpression: SubtreeFacts;
export declare const SubtreeExclusionsPropertyAccess: SubtreeFacts;
export declare const SubtreeExclusionsElementAccess: SubtreeFacts;
export declare const SubtreeExclusionsArrowFunction: SubtreeFacts;
export declare const SubtreeExclusionsFunction: SubtreeFacts;
export declare const SubtreeExclusionsConstructor: SubtreeFacts;
export declare const SubtreeExclusionsMethod: SubtreeFacts;
export declare const SubtreeExclusionsAccessor: SubtreeFacts;
export declare const SubtreeExclusionsProperty: SubtreeFacts;
export declare const SubtreeExclusionsClass: SubtreeFacts;
export declare const SubtreeExclusionsModule: SubtreeFacts;
export declare const SubtreeExclusionsObjectLiteral: SubtreeFacts;
export declare const SubtreeExclusionsArrayLiteral: SubtreeFacts;
export declare const SubtreeExclusionsCall: SubtreeFacts;
export declare const SubtreeExclusionsNew: SubtreeFacts;
export declare const SubtreeExclusionsVariableDeclarationList: SubtreeFacts;
export declare const SubtreeExclusionsParameter: SubtreeFacts;
export declare const SubtreeExclusionsCatchClause: SubtreeFacts;
export declare const SubtreeExclusionsBindingPattern: SubtreeFacts;
export declare const SubtreeContainsLexicalThisOrSuper: SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/subtreefacts.go::func::propagateEraseableSyntaxListSubtreeFacts","kind":"func","status":"implemented","sigHash":"16690848884935dacb7466b8e6cc1c202db7d61e6f08ea9dbc6faadf1abef5a1","bodyHash":"a323188389843a460c88cff80dc38fb937f060679097b4a0beee3b2e4928725f"}
 *
 * Go source:
 * func propagateEraseableSyntaxListSubtreeFacts(children *TypeArgumentList) SubtreeFacts {
 * 	return core.IfElse(children != nil, SubtreeContainsTypeScript, SubtreeFactsNone)
 * }
 */
export declare function propagateEraseableSyntaxListSubtreeFacts(children: GoPtr<TypeArgumentList>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/subtreefacts.go::func::propagateEraseableSyntaxSubtreeFacts","kind":"func","status":"implemented","sigHash":"bd7a9a020cf7ce66d2044b02c742cdecab1f0767e01502446485b5dd09e76ba7","bodyHash":"a8ea4df099b68b4027450a617352eacf989a99f17fbb5d8bf1bbaf16a572c544"}
 *
 * Go source:
 * func propagateEraseableSyntaxSubtreeFacts(child *TypeNode) SubtreeFacts {
 * 	return core.IfElse(child != nil, SubtreeContainsTypeScript, SubtreeFactsNone)
 * }
 */
export declare function propagateEraseableSyntaxSubtreeFacts(child: GoPtr<TypeNode>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/subtreefacts.go::func::propagateObjectBindingElementSubtreeFacts","kind":"func","status":"implemented","sigHash":"4a0ac7f2524630929887fb55d5786b483f6a796c7fbe2bc1825e985fa8ff284c","bodyHash":"71de2b58795dab0f1600d489e96dec61b114eba1a1322c1276733e07b04fe7be"}
 *
 * Go source:
 * func propagateObjectBindingElementSubtreeFacts(child *BindingElementNode) SubtreeFacts {
 * 	facts := propagateSubtreeFacts(child)
 * 	if facts&SubtreeContainsRestOrSpread != 0 {
 * 		facts &^= SubtreeContainsRestOrSpread
 * 		facts |= SubtreeContainsObjectRestOrSpread | SubtreeContainsESObjectRestOrSpread
 * 	}
 * 	return facts
 * }
 */
export declare function propagateObjectBindingElementSubtreeFacts(child: GoPtr<BindingElementNode>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/subtreefacts.go::func::propagateBindingElementSubtreeFacts","kind":"func","status":"implemented","sigHash":"1c353e399673d38bbf4a5ba1a828d1338756f5533b6cc0f146d4c5d8372cc99e","bodyHash":"2026cca058da363f6c3ad1fc8ea2d44e1467e30830967446814c3c6a36c36d03"}
 *
 * Go source:
 * func propagateBindingElementSubtreeFacts(child *BindingElementNode) SubtreeFacts {
 * 	return propagateSubtreeFacts(child) & ^SubtreeContainsRestOrSpread
 * }
 */
export declare function propagateBindingElementSubtreeFacts(child: GoPtr<BindingElementNode>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/subtreefacts.go::func::propagateSubtreeFacts","kind":"func","status":"implemented","sigHash":"39fd03e71a1dc2565c8932de8e648c7cf6b1e7505a7d799abed5707d5cfe49c3","bodyHash":"ab0ef7a62b2c601f8a519077a66426da391ad03c5ea7164f314ddb7d9509db63"}
 *
 * Go source:
 * func propagateSubtreeFacts(child *Node) SubtreeFacts {
 * 	if child == nil {
 * 		return SubtreeFactsNone
 * 	}
 * 	return child.propagateSubtreeFacts()
 * }
 */
export declare function propagateSubtreeFacts(child: GoPtr<Node>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/subtreefacts.go::func::propagateNodeListSubtreeFacts","kind":"func","status":"implemented","sigHash":"3ffa0ed363234c0dfd2441a8c8497672e999eb4530fb5a9ce96de317fd33ed12","bodyHash":"c1618dee1af1901518ec709b2d276ec9622d585e3bcf9fd360fbdee5f6b4e97c"}
 *
 * Go source:
 * func propagateNodeListSubtreeFacts(children *NodeList, propagate func(*Node) SubtreeFacts) SubtreeFacts {
 * 	if children == nil {
 * 		return SubtreeFactsNone
 * 	}
 * 	facts := SubtreeFactsNone
 * 	for _, child := range children.Nodes {
 * 		facts |= propagate(child)
 * 	}
 * 	return facts
 * }
 */
export declare function propagateNodeListSubtreeFacts(children: GoPtr<NodeList>, propagate: (child: GoPtr<Node>) => SubtreeFacts): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/subtreefacts.go::func::propagateModifierListSubtreeFacts","kind":"func","status":"implemented","sigHash":"80dd333c36851aff85081eee4e9bcd0870716de6c27f5c0b0d53f718e76b64ac","bodyHash":"4aa0ac3883447f11e458f0a42cb8d58d0b5197c92034462702c2c0105c53afdb"}
 *
 * Go source:
 * func propagateModifierListSubtreeFacts(children *ModifierList) SubtreeFacts {
 * 	if children == nil {
 * 		return SubtreeFactsNone
 * 	}
 * 	return propagateNodeListSubtreeFacts(&children.NodeList, propagateSubtreeFacts)
 * }
 */
export declare function propagateModifierListSubtreeFacts(children: GoPtr<ModifierList>): SubtreeFacts;
//# sourceMappingURL=subtreefacts.d.ts.map