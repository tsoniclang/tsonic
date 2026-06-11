import type { uint } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";
import { IfElse } from "../core/core.js";
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
// Facts
// - Flags used to indicate that a node or subtree contains syntax relevant to a specific transform
export const SubtreeContainsTypeScript: SubtreeFacts = 1 << 0;
export const SubtreeContainsJsx: SubtreeFacts = 1 << 1;
export const SubtreeContainsESDecorators: SubtreeFacts = 1 << 2;
export const SubtreeContainsUsing: SubtreeFacts = 1 << 3;
export const SubtreeContainsClassStaticBlocks: SubtreeFacts = 1 << 4;
export const SubtreeContainsESClassFields: SubtreeFacts = 1 << 5;
export const SubtreeContainsLogicalAssignments: SubtreeFacts = 1 << 6;
export const SubtreeContainsNullishCoalescing: SubtreeFacts = 1 << 7;
export const SubtreeContainsOptionalChaining: SubtreeFacts = 1 << 8;
export const SubtreeContainsMissingCatchClauseVariable: SubtreeFacts = 1 << 9;
export const SubtreeContainsESObjectRestOrSpread: SubtreeFacts = 1 << 10; // subtree has a `...` somewhere inside it, never cleared
export const SubtreeContainsForAwaitOrAsyncGenerator: SubtreeFacts = 1 << 11;
export const SubtreeContainsAnyAwait: SubtreeFacts = 1 << 12;
export const SubtreeContainsExponentiationOperator: SubtreeFacts = 1 << 13;

// Markers
// - Flags used to indicate that a node or subtree contains a particular kind of syntax.
export const SubtreeContainsLexicalThis: SubtreeFacts = 1 << 14;
export const SubtreeContainsLexicalSuper: SubtreeFacts = 1 << 15;
export const SubtreeContainsRestOrSpread: SubtreeFacts = 1 << 16; // marker on any `...` - cleared on binding pattern exit
export const SubtreeContainsObjectRestOrSpread: SubtreeFacts = 1 << 17; // marker on any `{...x}` - cleared on most scope exits
export const SubtreeContainsAwait: SubtreeFacts = 1 << 18;
export const SubtreeContainsDynamicImport: SubtreeFacts = 1 << 19;
export const SubtreeContainsClassFields: SubtreeFacts = 1 << 20;
export const SubtreeContainsDecorators: SubtreeFacts = 1 << 21;
export const SubtreeContainsIdentifier: SubtreeFacts = 1 << 22;
export const SubtreeContainsPrivateIdentifierInExpression: SubtreeFacts = 1 << 23;
export const SubtreeContainsInvalidTemplateEscape: SubtreeFacts = 1 << 24;

export const SubtreeFactsComputed: SubtreeFacts = 1 << 25; // NOTE: This should always be last
export const SubtreeFactsNone: SubtreeFacts = 0;

// Aliases (unused, for documentation purposes only - correspond to combinations in transformers/estransforms/definitions.go)
export const SubtreeContainsESNext: SubtreeFacts = (SubtreeContainsESDecorators | SubtreeContainsUsing) >>> 0;
export const SubtreeContainsES2022: SubtreeFacts = (SubtreeContainsClassStaticBlocks | SubtreeContainsESClassFields) >>> 0;
export const SubtreeContainsES2021: SubtreeFacts = SubtreeContainsLogicalAssignments;
export const SubtreeContainsES2020: SubtreeFacts = (SubtreeContainsNullishCoalescing | SubtreeContainsOptionalChaining) >>> 0;
export const SubtreeContainsES2019: SubtreeFacts = SubtreeContainsMissingCatchClauseVariable;
export const SubtreeContainsES2018: SubtreeFacts = (SubtreeContainsESObjectRestOrSpread | SubtreeContainsForAwaitOrAsyncGenerator | SubtreeContainsInvalidTemplateEscape) >>> 0;
export const SubtreeContainsES2017: SubtreeFacts = SubtreeContainsAnyAwait;
export const SubtreeContainsES2016: SubtreeFacts = SubtreeContainsExponentiationOperator;

// Scope Exclusions
// - Bitmasks that exclude flags from propagating out of a specific context
//   into the subtree flags of their container.
export const SubtreeExclusionsNode: SubtreeFacts = SubtreeFactsComputed;
export const SubtreeExclusionsEraseable: SubtreeFacts = (~SubtreeContainsTypeScript) >>> 0;
export const SubtreeExclusionsOuterExpression: SubtreeFacts = SubtreeExclusionsNode;
export const SubtreeExclusionsPropertyAccess: SubtreeFacts = SubtreeExclusionsNode;
export const SubtreeExclusionsElementAccess: SubtreeFacts = SubtreeExclusionsNode;
export const SubtreeExclusionsArrowFunction: SubtreeFacts = (SubtreeExclusionsNode | SubtreeContainsAwait | SubtreeContainsObjectRestOrSpread) >>> 0;
export const SubtreeExclusionsFunction: SubtreeFacts = (SubtreeExclusionsNode | SubtreeContainsLexicalThis | SubtreeContainsLexicalSuper | SubtreeContainsAwait | SubtreeContainsObjectRestOrSpread) >>> 0;
export const SubtreeExclusionsConstructor: SubtreeFacts = (SubtreeExclusionsNode | SubtreeContainsLexicalThis | SubtreeContainsLexicalSuper | SubtreeContainsAwait | SubtreeContainsObjectRestOrSpread) >>> 0;
export const SubtreeExclusionsMethod: SubtreeFacts = (SubtreeExclusionsNode | SubtreeContainsLexicalThis | SubtreeContainsLexicalSuper | SubtreeContainsAwait | SubtreeContainsObjectRestOrSpread) >>> 0;
export const SubtreeExclusionsAccessor: SubtreeFacts = (SubtreeExclusionsNode | SubtreeContainsLexicalThis | SubtreeContainsLexicalSuper | SubtreeContainsAwait | SubtreeContainsObjectRestOrSpread) >>> 0;
export const SubtreeExclusionsProperty: SubtreeFacts = (SubtreeExclusionsNode | SubtreeContainsLexicalThis | SubtreeContainsLexicalSuper) >>> 0;
export const SubtreeExclusionsClass: SubtreeFacts = SubtreeExclusionsNode;
export const SubtreeExclusionsModule: SubtreeFacts = (SubtreeExclusionsNode | SubtreeContainsLexicalThis | SubtreeContainsLexicalSuper) >>> 0;
export const SubtreeExclusionsObjectLiteral: SubtreeFacts = (SubtreeExclusionsNode | SubtreeContainsObjectRestOrSpread) >>> 0;
export const SubtreeExclusionsArrayLiteral: SubtreeFacts = SubtreeExclusionsNode;
export const SubtreeExclusionsCall: SubtreeFacts = SubtreeExclusionsNode;
export const SubtreeExclusionsNew: SubtreeFacts = SubtreeExclusionsNode;
export const SubtreeExclusionsVariableDeclarationList: SubtreeFacts = (SubtreeExclusionsNode | SubtreeContainsObjectRestOrSpread) >>> 0;
export const SubtreeExclusionsParameter: SubtreeFacts = SubtreeExclusionsNode;
export const SubtreeExclusionsCatchClause: SubtreeFacts = (SubtreeExclusionsNode | SubtreeContainsObjectRestOrSpread) >>> 0;
export const SubtreeExclusionsBindingPattern: SubtreeFacts = (SubtreeExclusionsNode | SubtreeContainsRestOrSpread) >>> 0;

// Masks
// - Additional bitmasks
export const SubtreeContainsLexicalThisOrSuper: SubtreeFacts = (SubtreeContainsLexicalThis | SubtreeContainsLexicalSuper) >>> 0;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/subtreefacts.go::func::propagateEraseableSyntaxListSubtreeFacts","kind":"func","status":"implemented","sigHash":"16690848884935dacb7466b8e6cc1c202db7d61e6f08ea9dbc6faadf1abef5a1","bodyHash":"a323188389843a460c88cff80dc38fb937f060679097b4a0beee3b2e4928725f"}
 *
 * Go source:
 * func propagateEraseableSyntaxListSubtreeFacts(children *TypeArgumentList) SubtreeFacts {
 * 	return core.IfElse(children != nil, SubtreeContainsTypeScript, SubtreeFactsNone)
 * }
 */
export function propagateEraseableSyntaxListSubtreeFacts(children: GoPtr<TypeArgumentList>): SubtreeFacts {
  return IfElse(children !== undefined, SubtreeContainsTypeScript, SubtreeFactsNone);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/subtreefacts.go::func::propagateEraseableSyntaxSubtreeFacts","kind":"func","status":"implemented","sigHash":"bd7a9a020cf7ce66d2044b02c742cdecab1f0767e01502446485b5dd09e76ba7","bodyHash":"a8ea4df099b68b4027450a617352eacf989a99f17fbb5d8bf1bbaf16a572c544"}
 *
 * Go source:
 * func propagateEraseableSyntaxSubtreeFacts(child *TypeNode) SubtreeFacts {
 * 	return core.IfElse(child != nil, SubtreeContainsTypeScript, SubtreeFactsNone)
 * }
 */
export function propagateEraseableSyntaxSubtreeFacts(child: GoPtr<TypeNode>): SubtreeFacts {
  return IfElse(child !== undefined, SubtreeContainsTypeScript, SubtreeFactsNone);
}

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
export function propagateObjectBindingElementSubtreeFacts(child: GoPtr<BindingElementNode>): SubtreeFacts {
  let facts = propagateSubtreeFacts(child);
  if ((facts & SubtreeContainsRestOrSpread) !== 0) {
    facts = (facts & ~SubtreeContainsRestOrSpread) >>> 0;
    facts = (facts | SubtreeContainsObjectRestOrSpread | SubtreeContainsESObjectRestOrSpread) >>> 0;
  }
  return facts;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/subtreefacts.go::func::propagateBindingElementSubtreeFacts","kind":"func","status":"implemented","sigHash":"1c353e399673d38bbf4a5ba1a828d1338756f5533b6cc0f146d4c5d8372cc99e","bodyHash":"2026cca058da363f6c3ad1fc8ea2d44e1467e30830967446814c3c6a36c36d03"}
 *
 * Go source:
 * func propagateBindingElementSubtreeFacts(child *BindingElementNode) SubtreeFacts {
 * 	return propagateSubtreeFacts(child) & ^SubtreeContainsRestOrSpread
 * }
 */
export function propagateBindingElementSubtreeFacts(child: GoPtr<BindingElementNode>): SubtreeFacts {
  return (propagateSubtreeFacts(child) & ~SubtreeContainsRestOrSpread) >>> 0;
}

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
export function propagateSubtreeFacts(child: GoPtr<Node>): SubtreeFacts {
  if (child === undefined) {
    return SubtreeFactsNone;
  }
  return child.data.propagateSubtreeFacts();
}

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
export function propagateNodeListSubtreeFacts(children: GoPtr<NodeList>, propagate: (child: GoPtr<Node>) => SubtreeFacts): SubtreeFacts {
  if (children === undefined) {
    return SubtreeFactsNone;
  }
  let facts = SubtreeFactsNone;
  for (const child of children.Nodes) {
    facts = (facts | propagate(child)) >>> 0;
  }
  return facts;
}

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
export function propagateModifierListSubtreeFacts(children: GoPtr<ModifierList>): SubtreeFacts {
  if (children === undefined) {
    return SubtreeFactsNone;
  }
  return propagateNodeListSubtreeFacts(children, propagateSubtreeFacts);
}
