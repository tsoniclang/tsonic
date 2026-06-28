import type { bool, int, uint } from "../../go/scalars.js";
import type { GoPtr, GoSeq, GoSlice } from "../../go/compat.js";
import type { Node } from "../ast/spine.js";
import type { SourceFile } from "../ast/ast.js";
import type { EntityName, JsxChild } from "../ast/generated/unions.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import type { Symbol } from "../ast/symbol.js";
import type { Message } from "../diagnostics/diagnostics.js";
import type { Checker, CheckMode, InferenceContext } from "./checker/state.js";
import type { Relation } from "./relater.js";
import type { ContextFlags, Signature, Type } from "./types.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::type::JsxFlags","kind":"type","status":"implemented","sigHash":"bf33d850d9ce92d74d7ae47047276dff2682895a11571cf45456cd974c50ef00","bodyHash":"6beb053f234184782603299db6a5ebc5ec000ad404b32524fb1c92e5141e8b33"}
 *
 * Go source:
 * JsxFlags uint32
 */
export type JsxFlags = uint;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::constGroup::JsxFlagsNone+JsxFlagsIntrinsicNamedElement+JsxFlagsIntrinsicIndexedElement+JsxFlagsIntrinsicElement","kind":"constGroup","status":"implemented","sigHash":"7a9eeec3e804d8353742f875ba4a2dcd2218774fab234381fe8a31d6c49da6bd","bodyHash":"0dd251742629c9e8f0868e96a86efc568ba9f72c096c6a064713693b29b88022"}
 *
 * Go source:
 * const (
 * 	JsxFlagsNone                    JsxFlags = 0
 * 	JsxFlagsIntrinsicNamedElement   JsxFlags = 1 << 0 // An element from a named property of the JSX.IntrinsicElements interface
 * 	JsxFlagsIntrinsicIndexedElement JsxFlags = 1 << 1 // An element inferred from the string index signature of the JSX.IntrinsicElements interface
 * 	JsxFlagsIntrinsicElement        JsxFlags = JsxFlagsIntrinsicNamedElement | JsxFlagsIntrinsicIndexedElement
 * )
 */
export declare const JsxFlagsNone: JsxFlags;
export declare const JsxFlagsIntrinsicNamedElement: JsxFlags;
export declare const JsxFlagsIntrinsicIndexedElement: JsxFlags;
export declare const JsxFlagsIntrinsicElement: JsxFlags;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::type::JsxReferenceKind","kind":"type","status":"implemented","sigHash":"1fcb3c60296f4a6f995ef61b89118eded6ec4813661a4c5d11b4718a125dcd72","bodyHash":"3eedc6abaf27bb625328daffbc14cce3f3d5fb1cf9ebbc6ec634e40e62eb52e6"}
 *
 * Go source:
 * JsxReferenceKind int32
 */
export type JsxReferenceKind = int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::constGroup::JsxReferenceKindComponent+JsxReferenceKindFunction+JsxReferenceKindMixed","kind":"constGroup","status":"implemented","sigHash":"8395fc0dce29dcb7bb7e30875e0c6c5269bb68f922c8fd052117f4f21fd54c2e","bodyHash":"43403e0116a9645d9969cc7604c37db50249611b1d2c23d51c519363fcafd1d7"}
 *
 * Go source:
 * const (
 * 	JsxReferenceKindComponent JsxReferenceKind = iota
 * 	JsxReferenceKindFunction
 * 	JsxReferenceKindMixed
 * )
 */
export declare const JsxReferenceKindComponent: JsxReferenceKind;
export declare const JsxReferenceKindFunction: JsxReferenceKind;
export declare const JsxReferenceKindMixed: JsxReferenceKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::type::JsxElementLinks","kind":"type","status":"implemented","sigHash":"d81c56a8aa08a556972740152d03817c4738374e6bb8105a3547dd69b83d8dff","bodyHash":"10ee2170b598628808e9b8d5a0cf1123243f76c56275ccf73fb9c8a69b3efe8d"}
 *
 * Go source:
 * JsxElementLinks struct {
 * 	jsxFlags                         JsxFlags    // Flags for the JSX element
 * 	resolvedJsxElementAttributesType *Type       // Resolved element attributes type of a JSX opening-like element
 * 	jsxNamespace                     *ast.Symbol // Resolved JSX namespace symbol for this node
 * 	jsxImplicitImportContainer       *ast.Symbol // Resolved module symbol the implicit JSX import of this file should refer to
 * }
 */
export interface JsxElementLinks {
    jsxFlags: JsxFlags;
    resolvedJsxElementAttributesType: GoPtr<Type>;
    jsxNamespace: GoPtr<Symbol>;
    jsxImplicitImportContainer: GoPtr<Symbol>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::varGroup::JsxNames","kind":"varGroup","status":"implemented","sigHash":"dca4d24c3bd7db61e7f749fb11091e88ec54d6fcfae458c0c4b1b94ada65f173","bodyHash":"0af300b61fb82f1e86c6f0a27b1bd915e397ae5727f268035789eb365e998856"}
 *
 * Go source:
 * var JsxNames = struct {
 * 	JSX                                    string
 * 	IntrinsicElements                      string
 * 	ElementClass                           string
 * 	ElementAttributesPropertyNameContainer string
 * 	ElementChildrenAttributeNameContainer  string
 * 	Element                                string
 * 	ElementType                            string
 * 	IntrinsicAttributes                    string
 * 	IntrinsicClassAttributes               string
 * 	LibraryManagedAttributes               string
 * }{
 * 	JSX:                                    "JSX",
 * 	IntrinsicElements:                      "IntrinsicElements",
 * 	ElementClass:                           "ElementClass",
 * 	ElementAttributesPropertyNameContainer: "ElementAttributesProperty",
 * 	ElementChildrenAttributeNameContainer:  "ElementChildrenAttribute",
 * 	Element:                                "Element",
 * 	ElementType:                            "ElementType",
 * 	IntrinsicAttributes:                    "IntrinsicAttributes",
 * 	IntrinsicClassAttributes:               "IntrinsicClassAttributes",
 * 	LibraryManagedAttributes:               "LibraryManagedAttributes",
 * }
 */
export declare const JsxNames: {
    JSX: string;
    IntrinsicElements: string;
    ElementClass: string;
    ElementAttributesPropertyNameContainer: string;
    ElementChildrenAttributeNameContainer: string;
    Element: string;
    ElementType: string;
    IntrinsicAttributes: string;
    IntrinsicClassAttributes: string;
    LibraryManagedAttributes: string;
};
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::varGroup::ReactNames","kind":"varGroup","status":"implemented","sigHash":"5615270f6b4ccbaee444c95866486e1c6d7cdef97592ced0c2b4ba9166185b44","bodyHash":"2cd0d1c72c2573a72915556bb05a2818f9bfb8e7b23c82ea526bd6385922caa0"}
 *
 * Go source:
 * var ReactNames = struct {
 * 	Fragment string
 * }{
 * 	Fragment: "Fragment",
 * }
 */
export declare const ReactNames: {
    Fragment: string;
};
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxElement","kind":"method","status":"implemented","sigHash":"e093a24af5a87fcca323c5071144df7899f4409d34c04dd60a9d108d8cb7f5cf","bodyHash":"b6cd338af822f02712d611c3196706b3c3b11d2cad33ce6bf643866933e39b8e"}
 *
 * Go source:
 * func (c *Checker) checkJsxElement(node *ast.Node, checkMode CheckMode) *Type {
 * 	c.checkNodeDeferred(node)
 * 	return c.getJsxElementTypeAt(node)
 * }
 */
export declare function Checker_checkJsxElement(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxElementDeferred","kind":"method","status":"implemented","sigHash":"a7e02d168cee553a3c3c07e2b0ffe8ee4d886ecc25a78c27dd752d800fe92857","bodyHash":"451589fd0bbca8f111705d25784870940f0ca91fde677ba9668d90e623874b85"}
 *
 * Go source:
 * func (c *Checker) checkJsxElementDeferred(node *ast.Node) {
 * 	jsxElement := node.AsJsxElement()
 * 	c.checkJsxOpeningLikeElementOrOpeningFragment(jsxElement.OpeningElement)
 * 	// Perform resolution on the closing tag so that rename/go to definition/etc work
 * 	if isJsxIntrinsicTagName(jsxElement.ClosingElement.TagName()) {
 * 		c.getIntrinsicTagSymbol(jsxElement.ClosingElement)
 * 	} else {
 * 		c.checkExpression(jsxElement.ClosingElement.TagName())
 * 	}
 * 	c.checkJsxChildren(node, CheckModeNormal)
 * }
 */
export declare function Checker_checkJsxElementDeferred(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxExpression","kind":"method","status":"implemented","sigHash":"642441e383ca2157826529cd8807460e7d728bfc87f09b266cd108a9fa33d574","bodyHash":"b6e7b9c13078a64dae3193ef8115c5af2c166b7a9ade2c4b83fef36c88549133"}
 *
 * Go source:
 * func (c *Checker) checkJsxExpression(node *ast.Node, checkMode CheckMode) *Type {
 * 	c.checkGrammarJsxExpression(node.AsJsxExpression())
 * 	if node.Expression() == nil {
 * 		return c.errorType
 * 	}
 * 	t := c.checkExpressionEx(node.Expression(), checkMode)
 * 	if node.AsJsxExpression().DotDotDotToken != nil && t != c.anyType && !c.isArrayType(t) {
 * 		c.error(node, diagnostics.JSX_spread_child_must_be_an_array_type)
 * 	}
 * 	return t
 * }
 */
export declare function Checker_checkJsxExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxSelfClosingElement","kind":"method","status":"implemented","sigHash":"84e12a25933dc97a674f04b4c96df1fc2c80105336a887455d8f2fac392bb9d7","bodyHash":"bcc1693324e67d97653041e48548dfd475bda24e78cbc565202a53b8974a8266"}
 *
 * Go source:
 * func (c *Checker) checkJsxSelfClosingElement(node *ast.Node, checkMode CheckMode) *Type {
 * 	c.checkNodeDeferred(node)
 * 	return c.getJsxElementTypeAt(node)
 * }
 */
export declare function Checker_checkJsxSelfClosingElement(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxSelfClosingElementDeferred","kind":"method","status":"implemented","sigHash":"93519f6e6e8483084d9f3095878752a2b33e272941b3c21a3563332c951c9859","bodyHash":"5724601ecebedd7197aa957e89297297a3170d0c239dca0366be989cec2ae1c5"}
 *
 * Go source:
 * func (c *Checker) checkJsxSelfClosingElementDeferred(node *ast.Node) {
 * 	c.checkJsxOpeningLikeElementOrOpeningFragment(node)
 * }
 */
export declare function Checker_checkJsxSelfClosingElementDeferred(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxFragment","kind":"method","status":"implemented","sigHash":"726a1f3d86fbe9a9e0abdf623bb03a0b13d9471a53a65a0da48adbc68728e256","bodyHash":"6879d8646c38020b6f59868853d2f69e2e5ba88449f30855d364905967c8b1ed"}
 *
 * Go source:
 * func (c *Checker) checkJsxFragment(node *ast.Node) *Type {
 * 	c.checkJsxOpeningLikeElementOrOpeningFragment(node.AsJsxFragment().OpeningFragment)
 * 	// by default, jsx:'react' will use jsxFactory = React.createElement and jsxFragmentFactory = React.Fragment
 * 	// if jsxFactory compiler option is provided, ensure jsxFragmentFactory compiler option or @jsxFrag pragma is provided too
 * 	nodeSourceFile := ast.GetSourceFileOfNode(node)
 * 	if c.compilerOptions.GetJSXTransformEnabled() && (c.compilerOptions.JsxFactory != "" || ast.GetPragmaFromSourceFile(nodeSourceFile, "jsx") != nil) && c.compilerOptions.JsxFragmentFactory == "" && ast.GetPragmaFromSourceFile(nodeSourceFile, "jsxfrag") == nil {
 * 		message := core.IfElse(c.compilerOptions.JsxFactory != "",
 * 			diagnostics.The_jsxFragmentFactory_compiler_option_must_be_provided_to_use_JSX_fragments_with_the_jsxFactory_compiler_option,
 * 			diagnostics.An_jsxFrag_pragma_is_required_when_using_an_jsx_pragma_with_JSX_fragments)
 * 		c.error(node, message)
 * 	}
 * 	c.checkJsxChildren(node, CheckModeNormal)
 * 	t := c.getJsxElementTypeAt(node)
 * 	return core.IfElse(c.isErrorType(t), c.anyType, t)
 * }
 */
export declare function Checker_checkJsxFragment(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxAttributes","kind":"method","status":"implemented","sigHash":"82416eae2418c55e1a0f7f3222f2d070c3b0cbfed5abeb68787bfc07f2ca3819","bodyHash":"58d8b3cfbeab9a72599ab3596e5d7f3aaa6ebac01682916987a7d442a3349226"}
 *
 * Go source:
 * func (c *Checker) checkJsxAttributes(node *ast.Node, checkMode CheckMode) *Type {
 * 	return c.createJsxAttributesTypeFromAttributesProperty(node.Parent, checkMode)
 * }
 */
export declare function Checker_checkJsxAttributes(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxOpeningLikeElementOrOpeningFragment","kind":"method","status":"implemented","sigHash":"852b0e25ae1ce9d3e69d23da4363182b2320bbe3eaebb580f52961acc5299a85","bodyHash":"bd09d8264da69690fd3da9831f49626368e7ac652f25374100063e3243a08716"}
 *
 * Go source:
 * func (c *Checker) checkJsxOpeningLikeElementOrOpeningFragment(node *ast.Node) {
 * 	isNodeOpeningLikeElement := ast.IsJsxOpeningLikeElement(node)
 * 	if isNodeOpeningLikeElement {
 * 		c.checkGrammarJsxElement(node)
 * 	}
 * 	c.checkJsxPreconditions(node)
 * 	c.markJsxAliasReferenced(node)
 * 	sig := c.getResolvedSignature(node, nil, CheckModeNormal)
 * 	c.checkDeprecatedSignature(sig, node)
 * 	if isNodeOpeningLikeElement {
 * 		elementTypeConstraint := c.getJsxElementTypeTypeAt(node)
 * 		if elementTypeConstraint != nil {
 * 			tagName := node.TagName()
 * 			var tagType *Type
 * 			if isJsxIntrinsicTagName(tagName) {
 * 				tagType = c.getStringLiteralType(tagName.Text())
 * 			} else {
 * 				tagType = c.checkExpression(tagName)
 * 			}
 * 			var diags []*ast.Diagnostic
 * 			if !c.checkTypeRelatedToEx(tagType, elementTypeConstraint, c.assignableRelation, tagName, diagnostics.Its_type_0_is_not_a_valid_JSX_element_type, &diags) {
 * 				c.addDiagnostic(ast.NewDiagnosticChain(diags[0], diagnostics.X_0_cannot_be_used_as_a_JSX_component, scanner.GetTextOfNode(tagName)))
 * 			}
 * 		} else {
 * 			c.checkJsxReturnAssignableToAppropriateBound(c.getJsxReferenceKind(node), c.getReturnTypeOfSignature(sig), node)
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkJsxOpeningLikeElementOrOpeningFragment(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxPreconditions","kind":"method","status":"implemented","sigHash":"56b00c0d7bded8adfd1acbfa47aeafeb4fda138a79650b572f85d792e9881819","bodyHash":"3161db6a4f7983a8a39451b7201d4a4f80b9b113d863f059f8678a87fd60db1b"}
 *
 * Go source:
 * func (c *Checker) checkJsxPreconditions(errorNode *ast.Node) {
 * 	// Preconditions for using JSX
 * 	if c.compilerOptions.Jsx == core.JsxEmitNone {
 * 		c.error(errorNode, diagnostics.Cannot_use_JSX_unless_the_jsx_flag_is_provided)
 * 	}
 * 	if c.noImplicitAny && c.getJsxElementTypeAt(errorNode) == nil {
 * 		c.error(errorNode, diagnostics.JSX_element_implicitly_has_type_any_because_the_global_type_JSX_Element_does_not_exist)
 * 	}
 * }
 */
export declare function Checker_checkJsxPreconditions(receiver: GoPtr<Checker>, errorNode: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxReturnAssignableToAppropriateBound","kind":"method","status":"implemented","sigHash":"136c323163f21b619e5969f01bb526f508fa742f03f0f7ae7fd983c1abc51441","bodyHash":"c36333fbf3b07c60d311f5c5b1e9032c1ff71e5b92b94c255aa73abde57e3621"}
 *
 * Go source:
 * func (c *Checker) checkJsxReturnAssignableToAppropriateBound(refKind JsxReferenceKind, elemInstanceType *Type, openingLikeElement *ast.Node) {
 * 	var diags []*ast.Diagnostic
 * 	switch refKind {
 * 	case JsxReferenceKindFunction:
 * 		sfcReturnConstraint := c.getJsxStatelessElementTypeAt(openingLikeElement)
 * 		if sfcReturnConstraint != nil {
 * 			c.checkTypeRelatedToEx(elemInstanceType, sfcReturnConstraint, c.assignableRelation, openingLikeElement.TagName(), diagnostics.Its_return_type_0_is_not_a_valid_JSX_element, &diags)
 * 		}
 * 	case JsxReferenceKindComponent:
 * 		classConstraint := c.getJsxElementClassTypeAt(openingLikeElement)
 * 		if classConstraint != nil {
 * 			// Issue an error if this return type isn't assignable to JSX.ElementClass, failing that
 * 			c.checkTypeRelatedToEx(elemInstanceType, classConstraint, c.assignableRelation, openingLikeElement.TagName(), diagnostics.Its_instance_type_0_is_not_a_valid_JSX_element, &diags)
 * 		}
 * 	default:
 * 		sfcReturnConstraint := c.getJsxStatelessElementTypeAt(openingLikeElement)
 * 		classConstraint := c.getJsxElementClassTypeAt(openingLikeElement)
 * 		if sfcReturnConstraint == nil || classConstraint == nil {
 * 			return
 * 		}
 * 		combined := c.getUnionType([]*Type{sfcReturnConstraint, classConstraint})
 * 		c.checkTypeRelatedToEx(elemInstanceType, combined, c.assignableRelation, openingLikeElement.TagName(), diagnostics.Its_element_type_0_is_not_a_valid_JSX_element, &diags)
 * 	}
 * 	if len(diags) != 0 {
 * 		c.addDiagnostic(ast.NewDiagnosticChain(diags[0], diagnostics.X_0_cannot_be_used_as_a_JSX_component, scanner.GetTextOfNode(openingLikeElement.TagName())))
 * 	}
 * }
 */
export declare function Checker_checkJsxReturnAssignableToAppropriateBound(receiver: GoPtr<Checker>, refKind: JsxReferenceKind, elemInstanceType: GoPtr<Type>, openingLikeElement: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.inferJsxTypeArguments","kind":"method","status":"implemented","sigHash":"ad8d59d71522d4d08c4fa957a96368be3bbe0e8a8104d6ec7d8e0c0375625102","bodyHash":"20174532fdbd2a02cf9e4286d4f514f1d9ae294d7d10c761caf1be42cce6c20d"}
 *
 * Go source:
 * func (c *Checker) inferJsxTypeArguments(node *ast.Node, signature *Signature, checkMode CheckMode, context *InferenceContext) []*Type {
 * 	paramType := c.getEffectiveFirstArgumentForJsxSignature(signature, node)
 * 	checkAttrType := c.checkExpressionWithContextualType(node.Attributes(), paramType, context, checkMode)
 * 	c.inferTypes(context.inferences, checkAttrType, paramType, InferencePriorityNone, false)
 * 	return c.getInferredTypes(context)
 * }
 */
export declare function Checker_inferJsxTypeArguments(receiver: GoPtr<Checker>, node: GoPtr<Node>, signature: GoPtr<Signature>, checkMode: CheckMode, context: GoPtr<InferenceContext>): GoSlice<GoPtr<Type>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getContextualTypeForJsxExpression","kind":"method","status":"implemented","sigHash":"9bbb93ae013d74d55e40cb0fdf3793bc7a05b76af917194e0cbf7dbf743d792e","bodyHash":"b13c10fd3b9ba407cfb05577125421aed34d9c98cb540ad9e8b9d149207fe940"}
 *
 * Go source:
 * func (c *Checker) getContextualTypeForJsxExpression(node *ast.Node, contextFlags ContextFlags) *Type {
 * 	switch {
 * 	case ast.IsJsxAttributeLike(node.Parent):
 * 		return c.getContextualType(node, contextFlags)
 * 	case ast.IsJsxElement(node.Parent):
 * 		return c.getContextualTypeForChildJsxExpression(node.Parent, node, contextFlags)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getContextualTypeForJsxExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, contextFlags: ContextFlags): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getContextualTypeForJsxAttribute","kind":"method","status":"implemented","sigHash":"e7232c6fc47c24b1399b1aee875ee432bffc847dcc3d0c000b77eeabe367b0e7","bodyHash":"a65e1cf31a8f1efe8d91c8118a6c24e0b557feb9d623c3ec832f3ce78b911934"}
 *
 * Go source:
 * func (c *Checker) getContextualTypeForJsxAttribute(attribute *ast.Node, contextFlags ContextFlags) *Type {
 * 	// When we trying to resolve JsxOpeningLikeElement as a stateless function element, we will already give its attributes a contextual type
 * 	// which is a type of the parameter of the signature we are trying out.
 * 	// If there is no contextual type (e.g. we are trying to resolve stateful component), get attributes type from resolving element's tagName
 * 	if ast.IsJsxAttribute(attribute) {
 * 		attributesType := c.getApparentTypeOfContextualType(attribute.Parent, contextFlags)
 * 		if attributesType == nil || IsTypeAny(attributesType) {
 * 			return nil
 * 		}
 * 		return c.getTypeOfPropertyOfContextualType(attributesType, attribute.Name().Text())
 * 	}
 * 	return c.getContextualType(attribute.Parent, contextFlags)
 * }
 */
export declare function Checker_getContextualTypeForJsxAttribute(receiver: GoPtr<Checker>, attribute: GoPtr<Node>, contextFlags: ContextFlags): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getContextualJsxElementAttributesType","kind":"method","status":"implemented","sigHash":"e73be151003692a4f183b6ea3f1f455ed9bad316db58c9aa054a6b940567614e","bodyHash":"ddba78fb6d90a5210ca93f9450ab04b3286a9570af5d234dabaa9e7e96745acd"}
 *
 * Go source:
 * func (c *Checker) getContextualJsxElementAttributesType(node *ast.Node, contextFlags ContextFlags) *Type {
 * 	if ast.IsJsxOpeningElement(node) && contextFlags != ContextFlagsIgnoreNodeInferences {
 * 		index := c.findContextualNode(node.Parent, contextFlags == ContextFlagsNone)
 * 		if index >= 0 {
 * 			// Contextually applied type is moved from attributes up to the outer jsx attributes so when walking up from the children they get hit
 * 			// _However_ to hit them from the _attributes_ we must look for them here; otherwise we'll used the declared type
 * 			// (as below) instead!
 * 			return c.contextualInfos[index].t
 * 		}
 * 	}
 * 	return c.getContextualTypeForArgumentAtIndex(node, 0)
 * }
 */
export declare function Checker_getContextualJsxElementAttributesType(receiver: GoPtr<Checker>, node: GoPtr<Node>, contextFlags: ContextFlags): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getContextualTypeForChildJsxExpression","kind":"method","status":"implemented","sigHash":"882c3475fc496d740d9b969161159595b69dd080b1bb30cd4fa5289b323700ce","bodyHash":"2f5a1afcf48397c01929f29ec5dfa44dccef78dfe5a952890ac932ab9cc1f930"}
 *
 * Go source:
 * func (c *Checker) getContextualTypeForChildJsxExpression(node *ast.Node, child *ast.JsxChild, contextFlags ContextFlags) *Type {
 * 	attributesType := c.getApparentTypeOfContextualType(node.AsJsxElement().OpeningElement.Attributes(), contextFlags)
 * 	// JSX expression is in children of JSX Element, we will look for an "children" attribute (we get the name from JSX.ElementAttributesProperty)
 * 	jsxChildrenPropertyName := c.getJsxElementChildrenPropertyName(c.getJsxNamespaceAt(node))
 * 	if !(attributesType != nil && !IsTypeAny(attributesType) && jsxChildrenPropertyName != ast.InternalSymbolNameMissing && jsxChildrenPropertyName != "") {
 * 		return nil
 * 	}
 * 	realChildren := ast.GetSemanticJsxChildren(node.Children().Nodes)
 * 	childIndex := slices.Index(realChildren, child)
 * 	childFieldType := c.getTypeOfPropertyOfContextualType(attributesType, jsxChildrenPropertyName)
 * 	if childFieldType == nil {
 * 		return nil
 * 	}
 * 	if len(realChildren) == 1 {
 * 		return childFieldType
 * 	}
 * 	return c.mapTypeEx(childFieldType, func(t *Type) *Type {
 * 		if c.isArrayLikeType(t) {
 * 			return c.getIndexedAccessType(t, c.getNumberLiteralType(jsnum.Number(childIndex)))
 * 		}
 * 		return t
 * 	}, true /*noReductions* /)
 * }
 */
export declare function Checker_getContextualTypeForChildJsxExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, child: GoPtr<JsxChild>, contextFlags: ContextFlags): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.discriminateContextualTypeByJSXAttributes","kind":"method","status":"implemented","sigHash":"080f008bcde6844d0a881a7365fce752c271c4d2dc0eee32b4b7f9463238dbbb","bodyHash":"8c200baa7afd6095b10f5e1638d9fa7e82a31d9c3c624806074584802781f266"}
 *
 * Go source:
 * func (c *Checker) discriminateContextualTypeByJSXAttributes(node *ast.Node, contextualType *Type) *Type {
 * 	key := DiscriminatedContextualTypeKey{nodeId: ast.GetNodeId(node), typeId: contextualType.id}
 * 	if discriminated := c.discriminatedContextualTypes[key]; discriminated != nil {
 * 		return discriminated
 * 	}
 * 	jsxChildrenPropertyName := c.getJsxElementChildrenPropertyName(c.getJsxNamespaceAt(node))
 * 	discriminantProperties := core.Filter(node.Properties(), func(p *ast.Node) bool {
 * 		symbol := p.Symbol()
 * 		if symbol == nil || !ast.IsJsxAttribute(p) {
 * 			return false
 * 		}
 * 		initializer := p.Initializer()
 * 		return (initializer == nil || c.isPossiblyDiscriminantValue(initializer)) && c.isDiscriminantProperty(contextualType, symbol.Name)
 * 	})
 * 	discriminantMembers := core.Filter(c.getPropertiesOfType(contextualType), func(s *ast.Symbol) bool {
 * 		if s.Flags&ast.SymbolFlagsOptional == 0 || node.Symbol() == nil {
 * 			return false
 * 		}
 * 		element := node.Parent.Parent
 * 		if s.Name == jsxChildrenPropertyName && ast.IsJsxElement(element) && len(ast.GetSemanticJsxChildren(element.Children().Nodes)) != 0 {
 * 			return false
 * 		}
 * 		return node.Symbol().Members[s.Name] == nil && c.isDiscriminantProperty(contextualType, s.Name)
 * 	})
 * 	discriminator := &ObjectLiteralDiscriminator{c: c, props: discriminantProperties, members: discriminantMembers}
 * 	discriminated := c.discriminateTypeByDiscriminableItems(contextualType, discriminator)
 * 	c.discriminatedContextualTypes[key] = discriminated
 * 	return discriminated
 * }
 */
export declare function Checker_discriminateContextualTypeByJSXAttributes(receiver: GoPtr<Checker>, node: GoPtr<Node>, contextualType: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.elaborateJsxComponents","kind":"method","status":"implemented","sigHash":"fdb4c5ff5495c4adc0249f62b1b3552a14f6fdfb14afed9304ba0942825fb7b4","bodyHash":"870408902dc7c2885dda20a0428d5858581b6817c9fe69362e49403b7116481f"}
 *
 * Go source:
 * func (c *Checker) elaborateJsxComponents(node *ast.Node, source *Type, target *Type, relation *Relation, diagnosticOutput *[]*ast.Diagnostic) bool {
 * 	reportedError := false
 * 	for _, prop := range node.Properties() {
 * 		if !ast.IsJsxSpreadAttribute(prop) && !isHyphenatedJsxName(prop.Name().Text()) {
 * 			nameType := c.getStringLiteralType(prop.Name().Text())
 * 			if nameType != nil && nameType.flags&TypeFlagsNever == 0 {
 * 				reportedError = c.elaborateElement(source, target, relation, prop.Name(), prop.Initializer(), nameType, nil, nil, diagnosticOutput) || reportedError
 * 			}
 * 		}
 * 	}
 * 	if ast.IsJsxOpeningElement(node.Parent) && ast.IsJsxElement(node.Parent.Parent) {
 * 		containingElement := node.Parent.Parent // Containing JSXElement
 * 		childrenPropName := c.getJsxElementChildrenPropertyName(c.getJsxNamespaceAt(node))
 * 		if childrenPropName == ast.InternalSymbolNameMissing {
 * 			childrenPropName = "children"
 * 		}
 * 		childrenNameType := c.getStringLiteralType(childrenPropName)
 * 		childrenTargetType := c.getIndexedAccessType(target, childrenNameType)
 * 		validChildren := ast.GetSemanticJsxChildren(containingElement.Children().Nodes)
 * 		if len(validChildren) == 0 {
 * 			return reportedError
 * 		}
 * 		moreThanOneRealChildren := len(validChildren) > 1
 * 		var arrayLikeTargetParts *Type
 * 		var nonArrayLikeTargetParts *Type
 * 		iterableType := c.getGlobalIterableType()
 * 		if iterableType != c.emptyGenericType {
 * 			anyIterable := c.createIterableType(c.anyType)
 * 			arrayLikeTargetParts = c.filterType(childrenTargetType, func(t *Type) bool { return c.isTypeAssignableTo(t, anyIterable) })
 * 			nonArrayLikeTargetParts = c.filterType(childrenTargetType, func(t *Type) bool { return !c.isTypeAssignableTo(t, anyIterable) })
 * 		} else {
 * 			arrayLikeTargetParts = c.filterType(childrenTargetType, c.isArrayOrTupleLikeType)
 * 			nonArrayLikeTargetParts = c.filterType(childrenTargetType, func(t *Type) bool { return !c.isArrayOrTupleLikeType(t) })
 * 		}
 * 		var invalidTextDiagnostic *diagnostics.Message
 * 		var invalidTextDiagnosticArgs []any
 * 		getInvalidTextualChildDiagnostic := func() (*diagnostics.Message, []any) {
 * 			if invalidTextDiagnostic == nil {
 * 				tagNameText := scanner.GetTextOfNode(node.Parent.TagName())
 * 				invalidTextDiagnostic = diagnostics.X_0_components_don_t_accept_text_as_child_elements_Text_in_JSX_has_the_type_string_but_the_expected_type_of_1_is_2
 * 				invalidTextDiagnosticArgs = []any{tagNameText, childrenPropName, c.TypeToString(childrenTargetType)}
 * 			}
 * 			return invalidTextDiagnostic, invalidTextDiagnosticArgs
 * 		}
 * 		if moreThanOneRealChildren {
 * 			if arrayLikeTargetParts != c.neverType {
 * 				realSource := c.createTupleType(c.checkJsxChildren(containingElement, CheckModeNormal))
 * 				children := c.generateJsxChildren(containingElement, getInvalidTextualChildDiagnostic)
 * 				reportedError = c.elaborateIterableOrArrayLikeTargetElementwise(children, realSource, arrayLikeTargetParts, relation, diagnosticOutput) || reportedError
 * 			} else if !c.isTypeRelatedTo(c.getIndexedAccessType(source, childrenNameType), childrenTargetType, relation) {
 * 				// arity mismatch
 * 				diag := c.error(containingElement.AsJsxElement().OpeningElement.TagName(), diagnostics.This_JSX_tag_s_0_prop_expects_a_single_child_of_type_1_but_multiple_children_were_provided, childrenPropName, c.TypeToString(childrenTargetType))
 * 				c.reportDiagnostic(diag, diagnosticOutput)
 * 				reportedError = true
 * 			}
 * 		} else {
 * 			if nonArrayLikeTargetParts != c.neverType {
 * 				child := validChildren[0]
 * 				e := c.getElaborationElementForJsxChild(child, childrenNameType, getInvalidTextualChildDiagnostic)
 * 				if e.errorNode != nil {
 * 					reportedError = c.elaborateElement(source, target, relation, e.errorNode, e.innerExpression, e.nameType, nil, e.createDiagnostic, diagnosticOutput) || reportedError
 * 				}
 * 			} else if !c.isTypeRelatedTo(c.getIndexedAccessType(source, childrenNameType), childrenTargetType, relation) {
 * 				// arity mismatch
 * 				diag := c.error(containingElement.AsJsxElement().OpeningElement.TagName(), diagnostics.This_JSX_tag_s_0_prop_expects_type_1_which_requires_multiple_children_but_only_a_single_child_was_provided, childrenPropName, c.TypeToString(childrenTargetType))
 * 				c.reportDiagnostic(diag, diagnosticOutput)
 * 				reportedError = true
 * 			}
 * 		}
 * 	}
 * 	return reportedError
 * }
 */
export declare function Checker_elaborateJsxComponents(receiver: GoPtr<Checker>, node: GoPtr<Node>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::type::JsxElaborationElement","kind":"type","status":"implemented","sigHash":"763107e270ca9709f579aa66ea96e1afd98e47a75dd1edea618bb89d40c0916b","bodyHash":"a23946421a908d1e0e2a0c2cd50666f690b349d58c01c69d702bca27833d0e48"}
 *
 * Go source:
 * JsxElaborationElement struct {
 * 	errorNode        *ast.Node
 * 	innerExpression  *ast.Node
 * 	nameType         *Type
 * 	createDiagnostic func(prop *ast.Node) *ast.Diagnostic // Optional: creates a custom diagnostic for this element
 * }
 */
export interface JsxElaborationElement {
    errorNode: GoPtr<Node>;
    innerExpression: GoPtr<Node>;
    nameType: GoPtr<Type>;
    createDiagnostic: GoPtr<(prop: GoPtr<Node>) => GoPtr<Diagnostic>>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.generateJsxChildren","kind":"method","status":"implemented","sigHash":"b0b9288d1d9fe6cb71fd998f70c09c2fe066733ab276593900c3e4eb6afb202c","bodyHash":"77c725595328ecf8a43861623fca68bfaaf1132889a73bfd45d52a7b63a59f20"}
 *
 * Go source:
 * func (c *Checker) generateJsxChildren(node *ast.Node, getInvalidTextDiagnostic func() (*diagnostics.Message, []any)) iter.Seq[JsxElaborationElement] {
 * 	return func(yield func(JsxElaborationElement) bool) {
 * 		memberOffset := 0
 * 		for i, child := range node.Children().Nodes {
 * 			nameType := c.getNumberLiteralType(jsnum.Number(i - memberOffset))
 * 			e := c.getElaborationElementForJsxChild(child, nameType, getInvalidTextDiagnostic)
 * 			if e.errorNode != nil {
 * 				if !yield(e) {
 * 					return
 * 				}
 * 			} else {
 * 				memberOffset++
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_generateJsxChildren(receiver: GoPtr<Checker>, node: GoPtr<Node>, getInvalidTextDiagnostic: () => [GoPtr<Message>, GoSlice<unknown>]): GoSeq<JsxElaborationElement>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getElaborationElementForJsxChild","kind":"method","status":"implemented","sigHash":"cfcaf07f3e077794d0dba0009a45bd038dfafa42dbb6a55125b2b36bab290e2d","bodyHash":"2629f5d69170ac491f374875c47fce5a9c2742a5e29c84cc42a516660ef4c7fc"}
 *
 * Go source:
 * func (c *Checker) getElaborationElementForJsxChild(child *ast.Node, nameType *Type, getInvalidTextDiagnostic func() (*diagnostics.Message, []any)) JsxElaborationElement {
 * 	switch child.Kind {
 * 	case ast.KindJsxExpression:
 * 		// child is of the type of the expression
 * 		return JsxElaborationElement{errorNode: child, innerExpression: child.Expression(), nameType: nameType}
 * 	case ast.KindJsxText:
 * 		if child.AsJsxText().ContainsOnlyTriviaWhiteSpaces {
 * 			// Whitespace only jsx text isn't real jsx text
 * 			return JsxElaborationElement{}
 * 		}
 * 		// child is a string
 * 		return JsxElaborationElement{
 * 			errorNode:       child,
 * 			innerExpression: nil,
 * 			nameType:        nameType,
 * 			createDiagnostic: func(prop *ast.Node) *ast.Diagnostic {
 * 				errorMessage, errorArgs := getInvalidTextDiagnostic()
 * 				return NewDiagnosticForNode(prop, errorMessage, errorArgs...)
 * 			},
 * 		}
 * 	case ast.KindJsxElement, ast.KindJsxSelfClosingElement, ast.KindJsxFragment:
 * 		// child is of type JSX.Element
 * 		return JsxElaborationElement{errorNode: child, innerExpression: child, nameType: nameType}
 * 	}
 * 	panic("Unhandled case in getElaborationElementForJsxChild")
 * }
 */
export declare function Checker_getElaborationElementForJsxChild(receiver: GoPtr<Checker>, child: GoPtr<Node>, nameType: GoPtr<Type>, getInvalidTextDiagnostic: () => [GoPtr<Message>, GoSlice<unknown>]): JsxElaborationElement;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.elaborateIterableOrArrayLikeTargetElementwise","kind":"method","status":"implemented","sigHash":"fbf41ffb15006925c2ca4e737bfa290ed00be17bfa98e667b9059860572f981e","bodyHash":"7cda1252005d6e8487dfca7c692b8ac78e882cb116e210a1516624cd74c35ec6"}
 *
 * Go source:
 * func (c *Checker) elaborateIterableOrArrayLikeTargetElementwise(iterator iter.Seq[JsxElaborationElement], source *Type, target *Type, relation *Relation, diagnosticOutput *[]*ast.Diagnostic) bool {
 * 	tupleOrArrayLikeTargetParts := c.filterType(target, c.isArrayOrTupleLikeType)
 * 	nonTupleOrArrayLikeTargetParts := c.filterType(target, func(t *Type) bool { return !c.isArrayOrTupleLikeType(t) })
 * 	// If `nonTupleOrArrayLikeTargetParts` is not `never`, then that should mean `Iterable` is defined.
 * 	var iterationType *Type
 * 	if nonTupleOrArrayLikeTargetParts != c.neverType {
 * 		iterationType = c.getIterationTypeOfIterable(IterationUseForOf, IterationTypeKindYield, nonTupleOrArrayLikeTargetParts, nil /*errorNode* /)
 * 	}
 * 	reportedError := false
 * 	for e := range iterator {
 * 		prop := e.errorNode
 * 		next := e.innerExpression
 * 		nameType := e.nameType
 * 		targetPropType := iterationType
 * 		var targetIndexedPropType *Type
 * 		if tupleOrArrayLikeTargetParts != c.neverType {
 * 			targetIndexedPropType = c.getBestMatchIndexedAccessTypeOrUndefined(source, tupleOrArrayLikeTargetParts, nameType)
 * 		}
 * 		if targetIndexedPropType != nil && targetIndexedPropType.flags&TypeFlagsIndexedAccess == 0 {
 * 			if iterationType != nil {
 * 				targetPropType = c.getUnionType([]*Type{iterationType, targetIndexedPropType})
 * 			} else {
 * 				targetPropType = targetIndexedPropType
 * 			}
 * 		}
 * 		if targetPropType == nil {
 * 			continue
 * 		}
 * 		sourcePropType := c.getIndexedAccessTypeOrUndefined(source, nameType, AccessFlagsNone, nil, nil)
 * 		if sourcePropType == nil {
 * 			continue
 * 		}
 * 		propName := c.getPropertyNameFromIndex(nameType, nil /*accessNode* /)
 * 		if !c.checkTypeRelatedTo(sourcePropType, targetPropType, relation, nil /*errorNode* /) {
 * 			elaborated := next != nil && c.elaborateError(next, sourcePropType, targetPropType, relation, nil /*headMessage* /, diagnosticOutput)
 * 			reportedError = true
 * 			if !elaborated {
 * 				// Issue error on the prop itself, since the prop couldn't elaborate the error. Use the expression type, if available.
 * 				specificSource := sourcePropType
 * 				if next != nil {
 * 					specificSource = c.checkExpressionForMutableLocationWithContextualType(next, sourcePropType)
 * 				}
 * 				if e.createDiagnostic != nil {
 * 					// Use the custom diagnostic factory if provided (e.g., for JSX text children with dynamic error messages)
 * 					c.reportDiagnostic(e.createDiagnostic(prop), diagnosticOutput)
 * 				} else if c.exactOptionalPropertyTypes && c.isExactOptionalPropertyMismatch(specificSource, targetPropType) {
 * 					diag := createDiagnosticForNode(prop, diagnostics.Type_0_is_not_assignable_to_type_1_with_exactOptionalPropertyTypes_Colon_true_Consider_adding_undefined_to_the_type_of_the_target, c.TypeToString(specificSource), c.TypeToString(targetPropType))
 * 					c.reportDiagnostic(diag, diagnosticOutput)
 * 				} else {
 * 					targetIsOptional := propName != ast.InternalSymbolNameMissing && core.OrElse(c.getPropertyOfType(tupleOrArrayLikeTargetParts, propName), c.unknownSymbol).Flags&ast.SymbolFlagsOptional != 0
 * 					sourceIsOptional := propName != ast.InternalSymbolNameMissing && core.OrElse(c.getPropertyOfType(source, propName), c.unknownSymbol).Flags&ast.SymbolFlagsOptional != 0
 * 					targetPropType = c.removeMissingType(targetPropType, targetIsOptional)
 * 					sourcePropType = c.removeMissingType(sourcePropType, targetIsOptional && sourceIsOptional)
 * 					result := c.checkTypeRelatedToEx(specificSource, targetPropType, relation, prop, nil, diagnosticOutput)
 * 					if result && specificSource != sourcePropType {
 * 						// If for whatever reason the expression type doesn't yield an error, make sure we still issue an error on the sourcePropType
 * 						c.checkTypeRelatedToEx(sourcePropType, targetPropType, relation, prop, nil, diagnosticOutput)
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return reportedError
 * }
 */
export declare function Checker_elaborateIterableOrArrayLikeTargetElementwise(receiver: GoPtr<Checker>, iterator: GoSeq<JsxElaborationElement>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getSuggestedSymbolForNonexistentJSXAttribute","kind":"method","status":"implemented","sigHash":"5ed45ea8b4c54a6be9bb80c1b28aeb6039c500d5495a6cf2ee9ac93671fbf3bb","bodyHash":"33276b8de3bfd12a576ab4698dd3a3b1c860406f999e098bdfb1514d5c9b2855"}
 *
 * Go source:
 * func (c *Checker) getSuggestedSymbolForNonexistentJSXAttribute(name string, containingType *Type) *ast.Symbol {
 * 	properties := c.getPropertiesOfType(containingType)
 * 	var jsxSpecific *ast.Symbol
 * 	switch name {
 * 	case "for":
 * 		jsxSpecific = core.Find(properties, func(x *ast.Symbol) bool { return ast.SymbolName(x) == "htmlFor" })
 * 	case "class":
 * 		jsxSpecific = core.Find(properties, func(x *ast.Symbol) bool { return ast.SymbolName(x) == "className" })
 * 	}
 * 	if jsxSpecific != nil {
 * 		return jsxSpecific
 * 	}
 * 	return c.getSpellingSuggestionForName(name, slices.Values(properties), ast.SymbolFlagsValue)
 * }
 */
export declare function Checker_getSuggestedSymbolForNonexistentJSXAttribute(receiver: GoPtr<Checker>, name: string, containingType: GoPtr<Type>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJSXFragmentType","kind":"method","status":"implemented","sigHash":"77ea16688774cdad4fdb6c48280b094b58be6bfc2c6ef14cd24f28c2da973086","bodyHash":"21621091cbe027655aa939b3051d85248f03914815783b8c1a2fcd49e95fdb19"}
 *
 * Go source:
 * func (c *Checker) getJSXFragmentType(node *ast.Node) *Type {
 * 	// An opening fragment is required in order for `getJsxNamespace` to give the fragment factory
 * 	links := c.sourceFileLinks.Get(ast.GetSourceFileOfNode(node))
 * 	if links.jsxFragmentType != nil {
 * 		return links.jsxFragmentType
 * 	}
 * 	jsxFragmentFactoryName := c.getJsxNamespace(node)
 * 	// #38720/60122, allow null as jsxFragmentFactory
 * 	shouldResolveFactoryReference := (c.compilerOptions.Jsx == core.JsxEmitReact || c.compilerOptions.JsxFragmentFactory != "") && jsxFragmentFactoryName != "null"
 * 	if !shouldResolveFactoryReference {
 * 		links.jsxFragmentType = c.anyType
 * 		return links.jsxFragmentType
 * 	}
 * 	jsxFactorySymbol := c.getJsxNamespaceContainerForImplicitImport(node)
 * 	if jsxFactorySymbol == nil {
 * 		shouldModuleRefErr := c.compilerOptions.Jsx != core.JsxEmitPreserve && c.compilerOptions.Jsx != core.JsxEmitReactNative
 * 		flags := ast.SymbolFlagsValue
 * 		if !shouldModuleRefErr {
 * 			flags &^= ast.SymbolFlagsEnum
 * 		}
 * 		jsxFactorySymbol = c.resolveName(node, jsxFragmentFactoryName, flags, diagnostics.Using_JSX_fragments_requires_fragment_factory_0_to_be_in_scope_but_it_could_not_be_found, true /*isUse* /, false /*excludeGlobals* /)
 * 	}
 * 	if jsxFactorySymbol == nil {
 * 		links.jsxFragmentType = c.errorType
 * 		return links.jsxFragmentType
 * 	}
 * 	if jsxFactorySymbol.Name == ReactNames.Fragment {
 * 		links.jsxFragmentType = c.getTypeOfSymbol(jsxFactorySymbol)
 * 		return links.jsxFragmentType
 * 	}
 * 	resolvedAlias := jsxFactorySymbol
 * 	if jsxFactorySymbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 		resolvedAlias = c.resolveAlias(jsxFactorySymbol)
 * 	}
 *
 * 	reactExports := c.getExportsOfSymbol(resolvedAlias)
 * 	typeSymbol := c.getSymbol(reactExports, ReactNames.Fragment, ast.SymbolFlagsBlockScopedVariable)
 * 	if typeSymbol != nil {
 * 		links.jsxFragmentType = c.getTypeOfSymbol(typeSymbol)
 * 	} else {
 * 		links.jsxFragmentType = c.errorType
 * 	}
 * 	return links.jsxFragmentType
 * }
 */
export declare function Checker_getJSXFragmentType(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.resolveJsxOpeningLikeElement","kind":"method","status":"implemented","sigHash":"97d39fe2690ff55486fee1520811a27e5874f5021f686d7444e1a9ba3792b1b9","bodyHash":"f0d05870cc795a0298e7de4b62bc99ae48664d3a9bf2526a78f340e55b0b065f"}
 *
 * Go source:
 * func (c *Checker) resolveJsxOpeningLikeElement(node *ast.Node, candidatesOutArray *[]*Signature, checkMode CheckMode) *Signature {
 * 	isJsxOpenFragment := ast.IsJsxOpeningFragment(node)
 * 	var exprTypes *Type
 * 	if !isJsxOpenFragment {
 * 		if isJsxIntrinsicTagName(node.TagName()) {
 * 			result := c.getIntrinsicAttributesTypeFromJsxOpeningLikeElement(node)
 * 			fakeSignature := c.createSignatureForJSXIntrinsic(node, result)
 * 			c.checkTypeAssignableToAndOptionallyElaborate(c.checkExpressionWithContextualType(node.Attributes(), c.getEffectiveFirstArgumentForJsxSignature(fakeSignature, node), nil /*inferenceContext* /, CheckModeNormal), result, node.TagName(), node.Attributes(), nil, nil)
 * 			typeArguments := node.TypeArguments()
 * 			if len(typeArguments) != 0 {
 * 				c.checkSourceElements(typeArguments)
 * 				sourceFile := ast.GetSourceFileOfNode(node)
 * 				typeArgumentList := node.TypeArgumentList()
 * 				loc := core.NewTextRange(scanner.SkipTrivia(sourceFile.Text(), typeArgumentList.Loc.Pos()), typeArgumentList.Loc.End())
 * 				c.addDiagnostic(ast.NewDiagnostic(sourceFile, loc, diagnostics.Expected_0_type_arguments_but_got_1, 0, len(typeArguments)))
 * 			}
 * 			return fakeSignature
 * 		}
 * 		exprTypes = c.checkExpression(node.TagName())
 * 	} else {
 * 		exprTypes = c.getJSXFragmentType(node)
 * 	}
 * 	apparentType := c.getApparentType(exprTypes)
 * 	if c.isErrorType(apparentType) {
 * 		return c.resolveErrorCall(node)
 * 	}
 * 	signatures := c.getUninstantiatedJsxSignaturesOfType(exprTypes, node)
 * 	if c.isUntypedFunctionCall(exprTypes, apparentType, len(signatures), 0 /*constructSignatures* /) {
 * 		return c.resolveUntypedCall(node)
 * 	}
 * 	if len(signatures) == 0 {
 * 		// We found no signatures at all, which is an error
 * 		if isJsxOpenFragment {
 * 			c.error(node, diagnostics.JSX_element_type_0_does_not_have_any_construct_or_call_signatures, scanner.GetTextOfNode(node))
 * 		} else {
 * 			c.error(node.TagName(), diagnostics.JSX_element_type_0_does_not_have_any_construct_or_call_signatures, scanner.GetTextOfNode(node.TagName()))
 * 		}
 * 		return c.resolveErrorCall(node)
 * 	}
 * 	return c.resolveCall(node, signatures, candidatesOutArray, checkMode, SignatureFlagsNone, nil)
 * }
 */
export declare function Checker_resolveJsxOpeningLikeElement(receiver: GoPtr<Checker>, node: GoPtr<Node>, candidatesOutArray: GoPtr<GoSlice<GoPtr<Signature>>>, checkMode: CheckMode): GoPtr<Signature>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkApplicableSignatureForJsxCallLikeElement","kind":"method","status":"implemented","sigHash":"fb19b1b335b7f42e456af28cbdc31670e45022224800bd79b38f1a896fe986e0","bodyHash":"0f1c831ad8b7bbb5626c05e117b889664970b3b598bc63bf8ec933fb542aa9d2"}
 *
 * Go source:
 * func (c *Checker) checkApplicableSignatureForJsxCallLikeElement(node *ast.Node, signature *Signature, relation *Relation, checkMode CheckMode, reportErrors bool, diagnosticOutput *[]*ast.Diagnostic) bool {
 * 	// Stateless function components can have maximum of three arguments: "props", "context", and "updater".
 * 	// However "context" and "updater" are implicit and can't be specify by users. Only the first parameter, props,
 * 	// can be specified by users through attributes property.
 * 	paramType := c.getEffectiveFirstArgumentForJsxSignature(signature, node)
 * 	var attributesType *Type
 * 	if ast.IsJsxOpeningFragment(node) {
 * 		attributesType = c.createJsxAttributesTypeFromAttributesProperty(node, CheckModeNormal)
 * 	} else {
 * 		attributesType = c.checkExpressionWithContextualType(node.Attributes(), paramType, nil /*inferenceContext* /, checkMode)
 * 	}
 * 	var checkAttributesType *Type
 * 	checkTagNameDoesNotExpectTooManyArguments := func() bool {
 * 		if c.getJsxNamespaceContainerForImplicitImport(node) != nil {
 * 			return true // factory is implicitly jsx/jsxdev - assume it fits the bill, since we don't strongly look for the jsx/jsxs/jsxDEV factory APIs anywhere else (at least not yet)
 * 		}
 * 		// We assume fragments have the correct arity since the node does not have attributes
 * 		var tagType *Type
 * 		if (ast.IsJsxOpeningElement(node) || ast.IsJsxSelfClosingElement(node)) && !(isJsxIntrinsicTagName(node.TagName()) || ast.IsJsxNamespacedName(node.TagName())) {
 * 			tagType = c.checkExpression(node.TagName())
 * 		}
 * 		if tagType == nil {
 * 			return true
 * 		}
 * 		tagCallSignatures := c.getSignaturesOfType(tagType, SignatureKindCall)
 * 		if len(tagCallSignatures) == 0 {
 * 			return true
 * 		}
 * 		factory := c.getJsxFactoryEntity(node)
 * 		if factory == nil {
 * 			return true
 * 		}
 * 		factorySymbol := c.resolveEntityName(factory, ast.SymbolFlagsValue, true /*ignoreErrors* /, false /*dontResolveAlias* /, node)
 * 		if factorySymbol == nil {
 * 			return true
 * 		}
 *
 * 		factoryType := c.getTypeOfSymbol(factorySymbol)
 * 		callSignatures := c.getSignaturesOfType(factoryType, SignatureKindCall)
 * 		if len(callSignatures) == 0 {
 * 			return true
 * 		}
 * 		hasFirstParamSignatures := false
 * 		maxParamCount := 0
 * 		// Check that _some_ first parameter expects a FC-like thing, and that some overload of the SFC expects an acceptable number of arguments
 * 		for _, sig := range callSignatures {
 * 			firstparam := c.getTypeAtPosition(sig, 0)
 * 			signaturesOfParam := c.getSignaturesOfType(firstparam, SignatureKindCall)
 * 			if len(signaturesOfParam) == 0 {
 * 				continue
 * 			}
 * 			for _, paramSig := range signaturesOfParam {
 * 				hasFirstParamSignatures = true
 * 				if c.hasEffectiveRestParameter(paramSig) {
 * 					return true // some signature has a rest param, so function components can have an arbitrary number of arguments
 * 				}
 * 				paramCount := c.getParameterCount(paramSig)
 * 				if paramCount > maxParamCount {
 * 					maxParamCount = paramCount
 * 				}
 * 			}
 * 		}
 * 		if !hasFirstParamSignatures {
 * 			// Not a single signature had a first parameter which expected a signature - for back compat, and
 * 			// to guard against generic factories which won't have signatures directly, do not error
 * 			return true
 * 		}
 * 		absoluteMinArgCount := math.MaxInt
 * 		for _, tagSig := range tagCallSignatures {
 * 			tagRequiredArgCount := c.getMinArgumentCount(tagSig)
 * 			if tagRequiredArgCount < absoluteMinArgCount {
 * 				absoluteMinArgCount = tagRequiredArgCount
 * 			}
 * 		}
 * 		if absoluteMinArgCount <= maxParamCount {
 * 			return true // some signature accepts the number of arguments the function component provides
 * 		}
 * 		if reportErrors {
 * 			tagName := node.TagName()
 * 			// We will not report errors in this function for fragments, since we do not check them in this function
 * 			diag := NewDiagnosticForNode(tagName, diagnostics.Tag_0_expects_at_least_1_arguments_but_the_JSX_factory_2_provides_at_most_3, entityNameToString(tagName), absoluteMinArgCount, entityNameToString(factory), maxParamCount)
 * 			tagNameSymbol := c.getSymbolAtLocation(tagName, false)
 * 			if tagNameSymbol != nil && tagNameSymbol.ValueDeclaration != nil {
 * 				diag.AddRelatedInfo(NewDiagnosticForNode(tagNameSymbol.ValueDeclaration, diagnostics.X_0_is_declared_here, entityNameToString(tagName)))
 * 			}
 * 			c.reportDiagnostic(diag, diagnosticOutput)
 * 		}
 * 		return false
 * 	}
 * 	if checkMode&CheckModeSkipContextSensitive != 0 {
 * 		checkAttributesType = c.getRegularTypeOfObjectLiteral(attributesType)
 * 	} else {
 * 		checkAttributesType = attributesType
 * 	}
 * 	if !checkTagNameDoesNotExpectTooManyArguments() {
 * 		return false
 * 	}
 * 	var errorNode *ast.Node
 * 	if reportErrors {
 * 		if ast.IsJsxOpeningFragment(node) {
 * 			errorNode = node
 * 		} else {
 * 			errorNode = node.TagName()
 * 		}
 * 	}
 * 	var attributes *ast.Node
 * 	if !ast.IsJsxOpeningFragment(node) {
 * 		attributes = node.Attributes()
 * 	}
 * 	return c.checkTypeRelatedToAndOptionallyElaborate(checkAttributesType, paramType, relation, errorNode, attributes, nil, diagnosticOutput)
 * }
 */
export declare function Checker_checkApplicableSignatureForJsxCallLikeElement(receiver: GoPtr<Checker>, node: GoPtr<Node>, signature: GoPtr<Signature>, relation: GoPtr<Relation>, checkMode: CheckMode, reportErrors: bool, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.createJsxAttributesTypeFromAttributesProperty","kind":"method","status":"implemented","sigHash":"7d0913e9a7b6a76d1c36bd936c78f6bc486c9d896cb991a3f02a52dea850cc94","bodyHash":"36cc949a1bd0733901e68380c392d08b1634c465ea17f1b09f192e6ebef40c6d"}
 *
 * Go source:
 * func (c *Checker) createJsxAttributesTypeFromAttributesProperty(openingLikeElement *ast.Node, checkMode CheckMode) *Type {
 * 	var allAttributesTable ast.SymbolTable
 * 	if c.strictNullChecks {
 * 		allAttributesTable = make(ast.SymbolTable)
 * 	}
 * 	attributesTable := make(ast.SymbolTable)
 * 	var attributesSymbol *ast.Symbol
 * 	attributeParent := openingLikeElement
 * 	spread := c.emptyJsxObjectType
 * 	var hasSpreadAnyType bool
 * 	var typeToIntersect *Type
 * 	var explicitlySpecifyChildrenAttribute bool
 * 	objectFlags := ObjectFlagsJsxAttributes
 * 	createJsxAttributesType := func() *Type {
 * 		objectFlags |= ObjectFlagsFreshLiteral
 * 		result := c.newAnonymousType(attributesSymbol, attributesTable, nil, nil, nil)
 * 		result.objectFlags |= objectFlags | ObjectFlagsObjectLiteral | ObjectFlagsContainsObjectOrArrayLiteral
 * 		return result
 * 	}
 * 	jsxChildrenPropertyName := c.getJsxElementChildrenPropertyName(c.getJsxNamespaceAt(openingLikeElement))
 * 	isJsxOpenFragment := ast.IsJsxOpeningFragment(openingLikeElement)
 * 	if !isJsxOpenFragment {
 * 		attributes := openingLikeElement.Attributes()
 * 		attributesSymbol = attributes.Symbol()
 * 		attributeParent = attributes
 * 		contextualType := c.getContextualType(attributes, ContextFlagsNone)
 * 		// Create anonymous type from given attributes symbol table.
 * 		// @param symbol a symbol of JsxAttributes containing attributes corresponding to attributesTable
 * 		// @param attributesTable a symbol table of attributes property
 * 		for _, attributeDecl := range attributes.Properties() {
 * 			member := attributeDecl.Symbol()
 * 			if ast.IsJsxAttribute(attributeDecl) {
 * 				exprType := c.checkJsxAttribute(attributeDecl, checkMode)
 * 				objectFlags |= exprType.objectFlags & ObjectFlagsPropagatingFlags
 * 				attributeSymbol := c.newSymbol(ast.SymbolFlagsProperty|member.Flags, member.Name)
 * 				attributeSymbol.Declarations = member.Declarations
 * 				attributeSymbol.Parent = member.Parent
 * 				if member.ValueDeclaration != nil {
 * 					attributeSymbol.ValueDeclaration = member.ValueDeclaration
 * 				}
 * 				links := c.valueSymbolLinks.Get(attributeSymbol)
 * 				links.resolvedType = exprType
 * 				links.target = member
 * 				attributesTable[attributeSymbol.Name] = attributeSymbol
 * 				if allAttributesTable != nil {
 * 					allAttributesTable[attributeSymbol.Name] = attributeSymbol
 * 				}
 * 				if attributeDecl.Name().Text() == jsxChildrenPropertyName {
 * 					explicitlySpecifyChildrenAttribute = true
 * 				}
 * 				if contextualType != nil {
 * 					prop := c.getPropertyOfType(contextualType, member.Name)
 * 					if prop != nil && prop.Declarations != nil && c.isDeprecatedSymbol(prop) && ast.IsIdentifier(attributeDecl.Name()) {
 * 						c.addDeprecatedSuggestion(attributeDecl.Name(), prop.Declarations, attributeDecl.Name().Text())
 * 					}
 * 				}
 * 				if contextualType != nil && checkMode&CheckModeInferential != 0 && checkMode&CheckModeSkipContextSensitive == 0 && c.isContextSensitive(attributeDecl) {
 * 					inferenceContext := c.getInferenceContext(attributes)
 * 					debug.Assert(inferenceContext != nil)
 * 					// In CheckMode.Inferential we should always have an inference context
 * 					inferenceNode := attributeDecl.Initializer().Expression()
 * 					c.addIntraExpressionInferenceSite(inferenceContext, inferenceNode, exprType)
 * 				}
 * 			} else {
 * 				debug.Assert(attributeDecl.Kind == ast.KindJsxSpreadAttribute)
 * 				if len(attributesTable) != 0 {
 * 					spread = c.getSpreadType(spread, createJsxAttributesType(), attributesSymbol, objectFlags, false /*readonly* /)
 * 					attributesTable = make(ast.SymbolTable)
 * 				}
 * 				exprType := c.getReducedType(c.checkExpressionEx(attributeDecl.Expression(), checkMode&CheckModeInferential))
 * 				if IsTypeAny(exprType) {
 * 					hasSpreadAnyType = true
 * 				}
 * 				if c.isValidSpreadType(exprType) {
 * 					spread = c.getSpreadType(spread, exprType, attributesSymbol, objectFlags, false /*readonly* /)
 * 					if allAttributesTable != nil {
 * 						c.checkSpreadPropOverrides(exprType, allAttributesTable, attributeDecl)
 * 					}
 * 				} else {
 * 					c.error(attributeDecl.Expression(), diagnostics.Spread_types_may_only_be_created_from_object_types)
 * 					if typeToIntersect != nil {
 * 						typeToIntersect = c.getIntersectionType([]*Type{typeToIntersect, exprType})
 * 					} else {
 * 						typeToIntersect = exprType
 * 					}
 * 				}
 * 			}
 * 		}
 * 		if !hasSpreadAnyType {
 * 			if len(attributesTable) != 0 {
 * 				spread = c.getSpreadType(spread, createJsxAttributesType(), attributesSymbol, objectFlags, false /*readonly* /)
 * 			}
 * 		}
 * 	}
 * 	parentHasSemanticJsxChildren := func(openingLikeElement *ast.Node) bool {
 * 		// Handle children attribute
 * 		parent := openingLikeElement.Parent
 * 		if parent == nil {
 * 			return false
 * 		}
 * 		var children []*ast.Node
 *
 * 		switch {
 * 		case ast.IsJsxElement(parent):
 * 			// We have to check that openingElement of the parent is the one we are visiting as this may not be true for selfClosingElement
 * 			if parent.AsJsxElement().OpeningElement == openingLikeElement {
 * 				children = parent.Children().Nodes
 * 			}
 * 		case ast.IsJsxFragment(parent):
 * 			if parent.AsJsxFragment().OpeningFragment == openingLikeElement {
 * 				children = parent.Children().Nodes
 * 			}
 * 		}
 * 		return len(ast.GetSemanticJsxChildren(children)) != 0
 * 	}
 * 	if parentHasSemanticJsxChildren(openingLikeElement) {
 * 		var childTypes []*Type = c.checkJsxChildren(openingLikeElement.Parent, checkMode)
 * 		if !hasSpreadAnyType && jsxChildrenPropertyName != ast.InternalSymbolNameMissing && jsxChildrenPropertyName != "" {
 * 			// Error if there is a attribute named "children" explicitly specified and children element.
 * 			// This is because children element will overwrite the value from attributes.
 * 			// Note: we will not warn "children" attribute overwritten if "children" attribute is specified in object spread.
 * 			if explicitlySpecifyChildrenAttribute {
 * 				c.error(attributeParent, diagnostics.X_0_are_specified_twice_The_attribute_named_0_will_be_overwritten, jsxChildrenPropertyName)
 * 			}
 * 			var childrenContextualType *Type
 * 			if ast.IsJsxOpeningElement(openingLikeElement) {
 * 				if contextualType := c.getApparentTypeOfContextualType(openingLikeElement.Attributes(), ContextFlagsNone); contextualType != nil {
 * 					childrenContextualType = c.getTypeOfPropertyOfContextualType(contextualType, jsxChildrenPropertyName)
 * 				}
 * 			}
 * 			// If there are children in the body of JSX element, create dummy attribute "children" with the union of children types so that it will pass the attribute checking process
 * 			childrenPropSymbol := c.newSymbol(ast.SymbolFlagsProperty, jsxChildrenPropertyName)
 * 			links := c.valueSymbolLinks.Get(childrenPropSymbol)
 * 			switch {
 * 			case len(childTypes) == 1:
 * 				links.resolvedType = childTypes[0]
 * 			case childrenContextualType != nil && someType(childrenContextualType, c.isTupleLikeType):
 * 				links.resolvedType = c.createTupleType(childTypes)
 * 			default:
 * 				links.resolvedType = c.createArrayType(c.getUnionType(childTypes))
 * 			}
 * 			// Fake up a property declaration for the children
 * 			childrenPropSymbol.ValueDeclaration = c.factory.NewPropertySignatureDeclaration(nil, c.factory.NewIdentifier(jsxChildrenPropertyName), nil /*postfixToken* /, nil /*type* /, nil /*initializer* /)
 * 			childrenPropSymbol.ValueDeclaration.Parent = attributeParent
 * 			childrenPropSymbol.ValueDeclaration.AsPropertySignatureDeclaration().Symbol = childrenPropSymbol
 * 			childPropMap := make(ast.SymbolTable)
 * 			childPropMap[jsxChildrenPropertyName] = childrenPropSymbol
 * 			spread = c.getSpreadType(spread, c.newAnonymousType(attributesSymbol, childPropMap, nil, nil, nil), attributesSymbol, objectFlags|c.getPropagatingFlagsOfTypes(childTypes, TypeFlagsNone), false /*readonly* /)
 * 		}
 * 	}
 * 	if hasSpreadAnyType {
 * 		return c.anyType
 * 	}
 * 	if typeToIntersect != nil {
 * 		if spread != c.emptyJsxObjectType {
 * 			return c.getIntersectionType([]*Type{typeToIntersect, spread})
 * 		}
 * 		return typeToIntersect
 * 	}
 * 	if spread == c.emptyJsxObjectType {
 * 		return createJsxAttributesType()
 * 	}
 * 	return spread
 * }
 */
export declare function Checker_createJsxAttributesTypeFromAttributesProperty(receiver: GoPtr<Checker>, openingLikeElement: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxAttribute","kind":"method","status":"implemented","sigHash":"2164d246ecc35ce2c2e9d56e13303a966a481af44b9fdc96f636ec553ce72dd3","bodyHash":"4503d6dd87c16cd6bd3f163626097723e1411dd9723368e38cba4c344c3bc4fd"}
 *
 * Go source:
 * func (c *Checker) checkJsxAttribute(node *ast.Node, checkMode CheckMode) *Type {
 * 	if node.Initializer() != nil {
 * 		return c.checkExpressionForMutableLocation(node.Initializer(), checkMode)
 * 	}
 * 	// <Elem attr /> is sugar for <Elem attr={true} />
 * 	return c.trueType
 * }
 */
export declare function Checker_checkJsxAttribute(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxChildren","kind":"method","status":"implemented","sigHash":"4b2fe9b4dc465980084cfd63023a446a4dd3909c317874225160c8ef8beb39a9","bodyHash":"fd91d770e52747679b729e2e11ca54f8bcf6c2c4628bfbc20a50158acec92430"}
 *
 * Go source:
 * func (c *Checker) checkJsxChildren(node *ast.Node, checkMode CheckMode) []*Type {
 * 	var childTypes []*Type
 * 	for _, child := range node.Children().Nodes {
 * 		// In React, JSX text that contains only whitespaces will be ignored so we don't want to type-check that
 * 		// because then type of children property will have constituent of string type.
 * 		if ast.IsJsxText(child) {
 * 			if !child.AsJsxText().ContainsOnlyTriviaWhiteSpaces {
 * 				childTypes = append(childTypes, c.stringType)
 * 			}
 * 		} else if ast.IsJsxExpression(child) && child.Expression() == nil {
 * 			// empty jsx expressions don't *really* count as present children
 * 			continue
 * 		} else {
 * 			childTypes = append(childTypes, c.checkExpressionForMutableLocation(child, checkMode))
 * 		}
 * 	}
 * 	return childTypes
 * }
 */
export declare function Checker_checkJsxChildren(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoSlice<GoPtr<Type>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getUninstantiatedJsxSignaturesOfType","kind":"method","status":"implemented","sigHash":"b221f9824a63e36f8f29b3b19c401bfd294187381de96d86fe8a192d3ef0f296","bodyHash":"0de4734eee222b49d4a5b6299d2651198c7dc940a76f8a2f67ea20685764a671"}
 *
 * Go source:
 * func (c *Checker) getUninstantiatedJsxSignaturesOfType(elementType *Type, caller *ast.Node) []*Signature {
 * 	if elementType.flags&TypeFlagsString != 0 {
 * 		return []*Signature{c.anySignature}
 * 	}
 * 	if elementType.flags&TypeFlagsStringLiteral != 0 {
 * 		intrinsicType := c.getIntrinsicAttributesTypeFromStringLiteralType(elementType, caller)
 * 		if intrinsicType == nil {
 * 			c.error(caller, diagnostics.Property_0_does_not_exist_on_type_1, getStringLiteralValue(elementType), "JSX."+JsxNames.IntrinsicElements)
 * 			return nil
 * 		}
 * 		fakeSignature := c.createSignatureForJSXIntrinsic(caller, intrinsicType)
 * 		return []*Signature{fakeSignature}
 * 	}
 * 	apparentElemType := c.getApparentType(elementType)
 * 	// Resolve the signatures, preferring constructor
 * 	signatures := c.getSignaturesOfType(apparentElemType, SignatureKindConstruct)
 * 	if len(signatures) == 0 {
 * 		// No construct signatures, try call signatures
 * 		signatures = c.getSignaturesOfType(apparentElemType, SignatureKindCall)
 * 	}
 * 	if len(signatures) == 0 && apparentElemType.flags&TypeFlagsUnion != 0 {
 * 		// If each member has some combination of new/call signatures; make a union signature list for those
 * 		signatures = c.getUnionSignatures(core.Map(apparentElemType.Types(), func(t *Type) []*Signature {
 * 			return c.getUninstantiatedJsxSignaturesOfType(t, caller)
 * 		}))
 * 	}
 * 	return signatures
 * }
 */
export declare function Checker_getUninstantiatedJsxSignaturesOfType(receiver: GoPtr<Checker>, elementType: GoPtr<Type>, caller: GoPtr<Node>): GoSlice<GoPtr<Signature>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getEffectiveFirstArgumentForJsxSignature","kind":"method","status":"implemented","sigHash":"9d83ddd1166797a5cccc23f7703d7524f5c304684dff0b1e7a9add4b6a85c426","bodyHash":"295bdf9e42d624bbe827a9708278fa8e19cec6602d5fe47263c378b61a5f0734"}
 *
 * Go source:
 * func (c *Checker) getEffectiveFirstArgumentForJsxSignature(signature *Signature, node *ast.Node) *Type {
 * 	if ast.IsJsxOpeningFragment(node) || c.getJsxReferenceKind(node) != JsxReferenceKindComponent {
 * 		return c.getJsxPropsTypeFromCallSignature(signature, node)
 * 	}
 * 	return c.getJsxPropsTypeFromClassType(signature, node)
 * }
 */
export declare function Checker_getEffectiveFirstArgumentForJsxSignature(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxPropsTypeFromCallSignature","kind":"method","status":"implemented","sigHash":"dc0a70e58c258c8b8bfa7fbe3ef28343b9dcaae6c237e137eed9841b66ae6649","bodyHash":"90f18b46342679f0663dc38957600099235a850ad9fc109b8ecc5fdfd0951e52"}
 *
 * Go source:
 * func (c *Checker) getJsxPropsTypeFromCallSignature(sig *Signature, context *ast.Node) *Type {
 * 	propsType := c.getTypeOfFirstParameterOfSignatureWithFallback(sig, c.unknownType)
 * 	propsType = c.getJsxManagedAttributesFromLocatedAttributes(context, c.getJsxNamespaceAt(context), propsType)
 * 	intrinsicAttribs := c.getJsxType(JsxNames.IntrinsicAttributes, context)
 * 	if !c.isErrorType(intrinsicAttribs) {
 * 		propsType = c.intersectTypes(intrinsicAttribs, propsType)
 * 	}
 * 	return propsType
 * }
 */
export declare function Checker_getJsxPropsTypeFromCallSignature(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, context: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxPropsTypeFromClassType","kind":"method","status":"implemented","sigHash":"b9d19a2382da043f267e814000900dfff1d5a587913a87bf8c54e9bc525679d8","bodyHash":"9ee861da827f16d43005b14c49afbc9a5aaf881b1d35bcc0c24fae6152377b3e"}
 *
 * Go source:
 * func (c *Checker) getJsxPropsTypeFromClassType(sig *Signature, context *ast.Node) *Type {
 * 	ns := c.getJsxNamespaceAt(context)
 * 	forcedLookupLocation := c.getJsxElementPropertiesName(ns)
 * 	var attributesType *Type
 * 	switch forcedLookupLocation {
 * 	case ast.InternalSymbolNameMissing:
 * 		attributesType = c.getTypeOfFirstParameterOfSignatureWithFallback(sig, c.unknownType)
 * 	case "":
 * 		attributesType = c.getReturnTypeOfSignature(sig)
 * 	default:
 * 		attributesType = c.getJsxPropsTypeForSignatureFromMember(sig, forcedLookupLocation)
 * 		if attributesType == nil && len(context.Attributes().Properties()) != 0 {
 * 			// There is no property named 'props' on this instance type
 * 			c.error(context, diagnostics.JSX_element_class_does_not_support_attributes_because_it_does_not_have_a_0_property, forcedLookupLocation)
 * 		}
 * 	}
 * 	if attributesType == nil {
 * 		return c.unknownType
 * 	}
 * 	attributesType = c.getJsxManagedAttributesFromLocatedAttributes(context, ns, attributesType)
 * 	if IsTypeAny(attributesType) {
 * 		// Props is of type 'any' or unknown
 * 		return attributesType
 * 	}
 * 	// Normal case -- add in IntrinsicClassAttributes<T> and IntrinsicAttributes
 * 	apparentAttributesType := attributesType
 * 	intrinsicClassAttribs := c.getJsxType(JsxNames.IntrinsicClassAttributes, context)
 * 	if !c.isErrorType(intrinsicClassAttribs) {
 * 		typeParams := c.getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(intrinsicClassAttribs.symbol)
 * 		hostClassType := c.getReturnTypeOfSignature(sig)
 * 		var libraryManagedAttributeType *Type
 * 		if typeParams != nil {
 * 			// apply JSX.IntrinsicClassAttributes<hostClassType, ...>
 * 			inferredArgs := c.fillMissingTypeArguments([]*Type{hostClassType}, typeParams, c.getMinTypeArgumentCount(typeParams), ast.IsInJSFile(context))
 * 			libraryManagedAttributeType = c.instantiateType(intrinsicClassAttribs, newTypeMapper(typeParams, inferredArgs))
 * 		} else {
 * 			libraryManagedAttributeType = intrinsicClassAttribs
 * 		}
 * 		apparentAttributesType = c.intersectTypes(libraryManagedAttributeType, apparentAttributesType)
 * 	}
 * 	intrinsicAttribs := c.getJsxType(JsxNames.IntrinsicAttributes, context)
 * 	if !c.isErrorType(intrinsicAttribs) {
 * 		apparentAttributesType = c.intersectTypes(intrinsicAttribs, apparentAttributesType)
 * 	}
 * 	return apparentAttributesType
 * }
 */
export declare function Checker_getJsxPropsTypeFromClassType(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, context: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxPropsTypeForSignatureFromMember","kind":"method","status":"implemented","sigHash":"04efed6f16af5c285ddbf0f182f3c8236a90a9a6ab0753650d35b6b2df50f3cf","bodyHash":"149aad248d56467c0c5254ed2703cc3c57e269f9c7b1d539156a74620a81ef64"}
 *
 * Go source:
 * func (c *Checker) getJsxPropsTypeForSignatureFromMember(sig *Signature, forcedLookupLocation string) *Type {
 * 	if sig.composite != nil {
 * 		// JSX Elements using the legacy `props`-field based lookup (eg, react class components) need to treat the `props` member as an input
 * 		// instead of an output position when resolving the signature. We need to go back to the input signatures of the composite signature,
 * 		// get the type of `props` on each return type individually, and then _intersect them_, rather than union them (as would normally occur
 * 		// for a union signature). It's an unfortunate quirk of looking in the output of the signature for the type we want to use for the input.
 * 		// The default behavior of `getTypeOfFirstParameterOfSignatureWithFallback` when no `props` member name is defined is much more sane.
 * 		var results []*Type
 * 		for _, signature := range sig.composite.signatures {
 * 			instance := c.getReturnTypeOfSignature(signature)
 * 			if IsTypeAny(instance) {
 * 				return instance
 * 			}
 * 			propType := c.getTypeOfPropertyOfType(instance, forcedLookupLocation)
 * 			if propType == nil {
 * 				return nil
 * 			}
 * 			results = append(results, propType)
 * 		}
 * 		return c.getIntersectionType(results)
 * 		// Same result for both union and intersection signatures
 * 	}
 * 	instanceType := c.getReturnTypeOfSignature(sig)
 * 	if IsTypeAny(instanceType) {
 * 		return instanceType
 * 	}
 * 	return c.getTypeOfPropertyOfType(instanceType, forcedLookupLocation)
 * }
 */
export declare function Checker_getJsxPropsTypeForSignatureFromMember(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, forcedLookupLocation: string): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxManagedAttributesFromLocatedAttributes","kind":"method","status":"implemented","sigHash":"84a0090e3e787ebd6cae8c3af37f968bfcf0ca780af65b85b33581222a346c77","bodyHash":"edf05f261e97701ddb0f4c94ebe3521877a485f069b3c9701e99fb60e2252d6e"}
 *
 * Go source:
 * func (c *Checker) getJsxManagedAttributesFromLocatedAttributes(context *ast.Node, ns *ast.Symbol, attributesType *Type) *Type {
 * 	managedSym := c.getJsxLibraryManagedAttributes(ns)
 * 	if managedSym != nil {
 * 		ctorType := c.getStaticTypeOfReferencedJsxConstructor(context)
 * 		result := c.instantiateAliasOrInterfaceWithDefaults(managedSym, []*Type{ctorType, attributesType}, ast.IsInJSFile(context))
 * 		if result != nil {
 * 			return result
 * 		}
 * 	}
 * 	return attributesType
 * }
 */
export declare function Checker_getJsxManagedAttributesFromLocatedAttributes(receiver: GoPtr<Checker>, context: GoPtr<Node>, ns: GoPtr<Symbol>, attributesType: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.instantiateAliasOrInterfaceWithDefaults","kind":"method","status":"implemented","sigHash":"2c5fb9ea101c19494e0b3f14fb32b8b0a3c40082f874baa2a32245863d47095b","bodyHash":"527e9a6cdc423ee173ce39cec603dd058c829b44eeed4ce86ba637fda05fbbc3"}
 *
 * Go source:
 * func (c *Checker) instantiateAliasOrInterfaceWithDefaults(managedSym *ast.Symbol, typeArguments []*Type, inJavaScript bool) *Type {
 * 	declaredManagedType := c.getDeclaredTypeOfSymbol(managedSym)
 * 	// fetches interface type, or initializes symbol links type parameters
 * 	if managedSym.Flags&ast.SymbolFlagsTypeAlias != 0 {
 * 		params := c.typeAliasLinks.Get(managedSym).typeParameters
 * 		if len(params) >= len(typeArguments) {
 * 			args := c.fillMissingTypeArguments(typeArguments, params, len(typeArguments), inJavaScript)
 * 			if len(args) == 0 {
 * 				return declaredManagedType
 * 			}
 * 			return c.getTypeAliasInstantiation(managedSym, args, nil)
 * 		}
 * 	}
 * 	if declaredManagedType.objectFlags&ObjectFlagsClassOrInterface != 0 && len(declaredManagedType.AsInterfaceType().TypeParameters()) >= len(typeArguments) {
 * 		args := c.fillMissingTypeArguments(typeArguments, declaredManagedType.AsInterfaceType().TypeParameters(), len(typeArguments), inJavaScript)
 * 		return c.createTypeReference(declaredManagedType, args)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_instantiateAliasOrInterfaceWithDefaults(receiver: GoPtr<Checker>, managedSym: GoPtr<Symbol>, typeArguments: GoSlice<GoPtr<Type>>, inJavaScript: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxLibraryManagedAttributes","kind":"method","status":"implemented","sigHash":"947ab254d781e129b3fe0778fb90d6fd40df3babe91f38fdfb5677ba18abc0a8","bodyHash":"72d9652a32eb4959b3a452b140a272c60db938f2ebc8f5fcf343695c52cc21e4"}
 *
 * Go source:
 * func (c *Checker) getJsxLibraryManagedAttributes(jsxNamespace *ast.Symbol) *ast.Symbol {
 * 	if jsxNamespace != nil {
 * 		return c.getSymbol(jsxNamespace.Exports, JsxNames.LibraryManagedAttributes, ast.SymbolFlagsType)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getJsxLibraryManagedAttributes(receiver: GoPtr<Checker>, jsxNamespace: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxElementTypeSymbol","kind":"method","status":"implemented","sigHash":"e2761a879f89c06b650455d7e805a8673126a9d051af2af37bb9aeadf240cecf","bodyHash":"0c13707cd1637b313083f3296786477d73c22059afe670157e2f4cea94f52f55"}
 *
 * Go source:
 * func (c *Checker) getJsxElementTypeSymbol(jsxNamespace *ast.Symbol) *ast.Symbol {
 * 	// JSX.ElementType [symbol]
 * 	if jsxNamespace != nil {
 * 		return c.getSymbol(jsxNamespace.Exports, JsxNames.ElementType, ast.SymbolFlagsType)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getJsxElementTypeSymbol(receiver: GoPtr<Checker>, jsxNamespace: GoPtr<Symbol>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxElementPropertiesName","kind":"method","status":"implemented","sigHash":"7af944361b07b95426e6d76d8de7c102d44a94b013868d82976b1dbc48e44b39","bodyHash":"6859cef2c9e5f0082b1d6aa9f286ec38e08309d430d300a65fcc208237790798"}
 *
 * Go source:
 * func (c *Checker) getJsxElementPropertiesName(jsxNamespace *ast.Symbol) string {
 * 	return c.getNameFromJsxElementAttributesContainer(JsxNames.ElementAttributesPropertyNameContainer, jsxNamespace)
 * }
 */
export declare function Checker_getJsxElementPropertiesName(receiver: GoPtr<Checker>, jsxNamespace: GoPtr<Symbol>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxElementChildrenPropertyName","kind":"method","status":"implemented","sigHash":"efab044b8cd7acfbcb49200e5d8bde56d4fe8d3bc5c998643abc74a3bcadf215","bodyHash":"eb42261790dc9f9d631e297e7960d6b18276e8467e4042af54ee3bc601c4a08e"}
 *
 * Go source:
 * func (c *Checker) getJsxElementChildrenPropertyName(jsxNamespace *ast.Symbol) string {
 * 	if c.compilerOptions.Jsx == core.JsxEmitReactJSX || c.compilerOptions.Jsx == core.JsxEmitReactJSXDev {
 * 		// In these JsxEmit modes the children property is fixed to 'children'
 * 		return "children"
 * 	}
 * 	return c.getNameFromJsxElementAttributesContainer(JsxNames.ElementChildrenAttributeNameContainer, jsxNamespace)
 * }
 */
export declare function Checker_getJsxElementChildrenPropertyName(receiver: GoPtr<Checker>, jsxNamespace: GoPtr<Symbol>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getNameFromJsxElementAttributesContainer","kind":"method","status":"implemented","sigHash":"97d202914c4acbdc8a24f33a3f395bd8fa49b88b40ffd056fa6da42ed495e508","bodyHash":"a00583785f29b343c9b03bbc23bfcb7ac2ddd4274ee91d6986dcb2ad5eb41fc4"}
 *
 * Go source:
 * func (c *Checker) getNameFromJsxElementAttributesContainer(nameOfAttribPropContainer string, jsxNamespace *ast.Symbol) string {
 * 	// JSX.ElementAttributesProperty | JSX.ElementChildrenAttribute [symbol]
 * 	if jsxNamespace != nil {
 * 		jsxElementAttribPropInterfaceSym := c.getSymbol(jsxNamespace.Exports, nameOfAttribPropContainer, ast.SymbolFlagsType)
 * 		if jsxElementAttribPropInterfaceSym != nil {
 * 			jsxElementAttribPropInterfaceType := c.getDeclaredTypeOfSymbol(jsxElementAttribPropInterfaceSym)
 * 			propertiesOfJsxElementAttribPropInterface := c.getPropertiesOfType(jsxElementAttribPropInterfaceType)
 * 			// Element Attributes has zero properties, so the element attributes type will be the class instance type
 * 			if len(propertiesOfJsxElementAttribPropInterface) == 0 {
 * 				return ""
 * 			}
 * 			if len(propertiesOfJsxElementAttribPropInterface) == 1 {
 * 				return propertiesOfJsxElementAttribPropInterface[0].Name
 * 			}
 * 			if len(propertiesOfJsxElementAttribPropInterface) > 1 && len(jsxElementAttribPropInterfaceSym.Declarations) != 0 {
 * 				// More than one property on ElementAttributesProperty is an error
 * 				c.error(jsxElementAttribPropInterfaceSym.Declarations[0], diagnostics.The_global_type_JSX_0_may_not_have_more_than_one_property, nameOfAttribPropContainer)
 * 			}
 * 		}
 * 	}
 * 	return ast.InternalSymbolNameMissing
 * }
 */
export declare function Checker_getNameFromJsxElementAttributesContainer(receiver: GoPtr<Checker>, nameOfAttribPropContainer: string, jsxNamespace: GoPtr<Symbol>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getStaticTypeOfReferencedJsxConstructor","kind":"method","status":"implemented","sigHash":"954126eee445e9b4ea85f12ac0f26e9dd10a77fb2b7d02151f86199b0656617a","bodyHash":"f9d373c4da80341d04222c8975e5f8bfd8a2b42c44c14aa9cff3358d0a2d6e38"}
 *
 * Go source:
 * func (c *Checker) getStaticTypeOfReferencedJsxConstructor(context *ast.Node) *Type {
 * 	if ast.IsJsxOpeningFragment(context) {
 * 		return c.getJSXFragmentType(context)
 * 	}
 * 	if isJsxIntrinsicTagName(context.TagName()) {
 * 		result := c.getIntrinsicAttributesTypeFromJsxOpeningLikeElement(context)
 * 		fakeSignature := c.createSignatureForJSXIntrinsic(context, result)
 * 		return c.getOrCreateTypeFromSignature(fakeSignature)
 * 	}
 * 	tagType := c.checkExpressionCached(context.TagName())
 * 	if tagType.flags&TypeFlagsStringLiteral != 0 {
 * 		result := c.getIntrinsicAttributesTypeFromStringLiteralType(tagType, context)
 * 		if result == nil {
 * 			return c.errorType
 * 		}
 * 		fakeSignature := c.createSignatureForJSXIntrinsic(context, result)
 * 		return c.getOrCreateTypeFromSignature(fakeSignature)
 * 	}
 * 	return tagType
 * }
 */
export declare function Checker_getStaticTypeOfReferencedJsxConstructor(receiver: GoPtr<Checker>, context: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getIntrinsicAttributesTypeFromStringLiteralType","kind":"method","status":"implemented","sigHash":"4aaca5a95b4f56cc1af348109435106f12e1f7653f906458857fa8ee4836a16d","bodyHash":"4f53bd550febdaca9e461ce5bd12fd2a2a0d7914ee55b9ef7b63440c618303f1"}
 *
 * Go source:
 * func (c *Checker) getIntrinsicAttributesTypeFromStringLiteralType(t *Type, location *ast.Node) *Type {
 * 	// If the elemType is a stringLiteral type, we can then provide a check to make sure that the string literal type is one of the Jsx intrinsic element type
 * 	// For example:
 * 	//      var CustomTag: "h1" = "h1";
 * 	//      <CustomTag> Hello World </CustomTag>
 * 	intrinsicElementsType := c.getJsxType(JsxNames.IntrinsicElements, location)
 * 	if !c.isErrorType(intrinsicElementsType) {
 * 		stringLiteralTypeName := getStringLiteralValue(t)
 * 		intrinsicProp := c.getPropertyOfType(intrinsicElementsType, stringLiteralTypeName)
 * 		if intrinsicProp != nil {
 * 			return c.getTypeOfSymbol(intrinsicProp)
 * 		}
 * 		indexSignatureType := c.getIndexTypeOfType(intrinsicElementsType, c.stringType)
 * 		if indexSignatureType != nil {
 * 			return indexSignatureType
 * 		}
 * 		return nil
 * 	}
 * 	// If we need to report an error, we already done so here. So just return any to prevent any more error downstream
 * 	return c.anyType
 * }
 */
export declare function Checker_getIntrinsicAttributesTypeFromStringLiteralType(receiver: GoPtr<Checker>, t: GoPtr<Type>, location: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxReferenceKind","kind":"method","status":"implemented","sigHash":"606fdd55ebcb1761241f81eacccadc7345505e588ee5a3f85947bfeae581fa36","bodyHash":"ea6208927aa1849b98142048d49389f22c66fb6ab5c2ab3cfc27b0a167e853ce"}
 *
 * Go source:
 * func (c *Checker) getJsxReferenceKind(node *ast.Node) JsxReferenceKind {
 * 	if isJsxIntrinsicTagName(node.TagName()) {
 * 		return JsxReferenceKindMixed
 * 	}
 * 	tagType := c.getApparentType(c.checkExpression(node.TagName()))
 * 	if len(c.getSignaturesOfType(tagType, SignatureKindConstruct)) != 0 {
 * 		return JsxReferenceKindComponent
 * 	}
 * 	if len(c.getSignaturesOfType(tagType, SignatureKindCall)) != 0 {
 * 		return JsxReferenceKindFunction
 * 	}
 * 	return JsxReferenceKindMixed
 * }
 */
export declare function Checker_getJsxReferenceKind(receiver: GoPtr<Checker>, node: GoPtr<Node>): JsxReferenceKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.createSignatureForJSXIntrinsic","kind":"method","status":"implemented","sigHash":"a70781bce242ba67d5421d91500ffa2736c6858a85eba9c4de6ba6047b00597a","bodyHash":"1a7d81a1c076491239e2f5aed3ec6c1eb6b260947aa232c09a6c9ab1dcaf2018"}
 *
 * Go source:
 * func (c *Checker) createSignatureForJSXIntrinsic(node *ast.Node, result *Type) *Signature {
 * 	elementType := c.errorType
 * 	if namespace := c.getJsxNamespaceAt(node); namespace != nil {
 * 		if typeSymbol := c.getSymbol(c.getExportsOfSymbol(namespace), JsxNames.Element, ast.SymbolFlagsType); typeSymbol != nil {
 * 			elementType = c.getDeclaredTypeOfSymbol(typeSymbol)
 * 		}
 * 	}
 * 	// returnNode := typeSymbol && c.nodeBuilder.symbolToEntityName(typeSymbol, ast.SymbolFlagsType, node)
 * 	// declaration := factory.createFunctionTypeNode(nil, []ParameterDeclaration{factory.createParameterDeclaration(nil, nil /*dotDotDotToken* /, "props", nil /*questionToken* /, c.nodeBuilder.typeToTypeNode(result, node))}, ifElse(returnNode != nil, factory.createTypeReferenceNode(returnNode, nil /*typeArguments* /), factory.createKeywordTypeNode(ast.KindAnyKeyword)))
 * 	parameterSymbol := c.newSymbol(ast.SymbolFlagsFunctionScopedVariable, "props")
 * 	c.valueSymbolLinks.Get(parameterSymbol).resolvedType = result
 * 	return c.newSignature(SignatureFlagsNone, nil, nil, nil, []*ast.Symbol{parameterSymbol}, elementType, nil, 1)
 * }
 */
export declare function Checker_createSignatureForJSXIntrinsic(receiver: GoPtr<Checker>, node: GoPtr<Node>, result: GoPtr<Type>): GoPtr<Signature>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getIntrinsicAttributesTypeFromJsxOpeningLikeElement","kind":"method","status":"implemented","sigHash":"29e3be6469930ce3ba51c0f4958a577be88e4bba16d0fbb71a3817b6bbc1866e","bodyHash":"3d074b6b267651537229248017388a13cef0d42cadb68f5a7c2e5ec1004ed5a5"}
 *
 * Go source:
 * func (c *Checker) getIntrinsicAttributesTypeFromJsxOpeningLikeElement(node *ast.Node) *Type {
 * 	debug.Assert(isJsxIntrinsicTagName(node.TagName()))
 * 	links := c.jsxElementLinks.Get(node)
 * 	if links.resolvedJsxElementAttributesType != nil {
 * 		return links.resolvedJsxElementAttributesType
 * 	}
 * 	symbol := c.getIntrinsicTagSymbol(node)
 * 	if links.jsxFlags&JsxFlagsIntrinsicNamedElement != 0 {
 * 		links.resolvedJsxElementAttributesType = core.OrElse(c.getTypeOfSymbol(symbol), c.errorType)
 * 		return links.resolvedJsxElementAttributesType
 * 	}
 * 	if links.jsxFlags&JsxFlagsIntrinsicIndexedElement != 0 {
 * 		indexInfo := c.getApplicableIndexInfoForName(c.getJsxType(JsxNames.IntrinsicElements, node), node.TagName().Text())
 * 		if indexInfo != nil {
 * 			links.resolvedJsxElementAttributesType = indexInfo.valueType
 * 			return links.resolvedJsxElementAttributesType
 * 		}
 * 	}
 * 	links.resolvedJsxElementAttributesType = c.errorType
 * 	return links.resolvedJsxElementAttributesType
 * }
 */
export declare function Checker_getIntrinsicAttributesTypeFromJsxOpeningLikeElement(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getIntrinsicTagSymbol","kind":"method","status":"implemented","sigHash":"8c2d4aa9a6eae60cdb430adae6151234e3d41d583ea4d0f03075439367458c77","bodyHash":"6e61020629021364f0db9e5e947e8f7bf6fcd82fa6288bc64c9df17c48d3a69d"}
 *
 * Go source:
 * func (c *Checker) getIntrinsicTagSymbol(node *ast.Node) *ast.Symbol {
 * 	links := c.symbolNodeLinks.Get(node)
 * 	if links.resolvedSymbol != nil {
 * 		return links.resolvedSymbol
 * 	}
 * 	intrinsicElementsType := c.getJsxType(JsxNames.IntrinsicElements, node)
 * 	if !c.isErrorType(intrinsicElementsType) {
 * 		// Property case
 * 		tagName := node.TagName()
 * 		if !ast.IsIdentifier(tagName) && !ast.IsJsxNamespacedName(tagName) {
 * 			panic("Invalid tag name")
 * 		}
 * 		propName := tagName.Text()
 * 		intrinsicProp := c.getPropertyOfType(intrinsicElementsType, propName)
 * 		if intrinsicProp != nil {
 * 			c.jsxElementLinks.Get(node).jsxFlags |= JsxFlagsIntrinsicNamedElement
 * 			links.resolvedSymbol = intrinsicProp
 * 			return links.resolvedSymbol
 * 		}
 * 		// Intrinsic string indexer case
 * 		indexSymbol := c.getApplicableIndexSymbol(intrinsicElementsType, c.getStringLiteralType(propName))
 * 		if indexSymbol != nil {
 * 			c.jsxElementLinks.Get(node).jsxFlags |= JsxFlagsIntrinsicIndexedElement
 * 			links.resolvedSymbol = indexSymbol
 * 			return links.resolvedSymbol
 * 		}
 * 		if c.getTypeOfPropertyOrIndexSignatureOfType(intrinsicElementsType, propName) != nil {
 * 			c.jsxElementLinks.Get(node).jsxFlags |= JsxFlagsIntrinsicIndexedElement
 * 			links.resolvedSymbol = intrinsicElementsType.symbol
 * 			return links.resolvedSymbol
 * 		}
 * 		// Wasn't found
 * 		c.error(node, diagnostics.Property_0_does_not_exist_on_type_1, tagName.Text(), "JSX."+JsxNames.IntrinsicElements)
 * 		links.resolvedSymbol = c.unknownSymbol
 * 		return links.resolvedSymbol
 * 	}
 * 	if c.noImplicitAny {
 * 		c.error(node, diagnostics.JSX_element_implicitly_has_type_any_because_no_interface_JSX_0_exists, JsxNames.IntrinsicElements)
 * 	}
 * 	links.resolvedSymbol = c.unknownSymbol
 * 	return links.resolvedSymbol
 * }
 */
export declare function Checker_getIntrinsicTagSymbol(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxStatelessElementTypeAt","kind":"method","status":"implemented","sigHash":"ab86987c90270e83abd1264a0fe16f7e95f48310c13b5aed54d11ecac003064b","bodyHash":"15f035e2932e227cc36455a437fc673ed8bf1fbefd742d6025f4a273ffd97347"}
 *
 * Go source:
 * func (c *Checker) getJsxStatelessElementTypeAt(location *ast.Node) *Type {
 * 	jsxElementType := c.getJsxElementTypeAt(location)
 * 	if jsxElementType == nil {
 * 		return nil
 * 	}
 * 	return c.getUnionType([]*Type{jsxElementType, c.nullType})
 * }
 */
export declare function Checker_getJsxStatelessElementTypeAt(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxElementClassTypeAt","kind":"method","status":"implemented","sigHash":"3871a7d74bdcb43c6957800d8f85949f3b56ea3db9eb13883d69cbc7ca1453ec","bodyHash":"20cfff63e745a91580dbb87357a6c664ea9fad1a361b6a8138a4bc97a2c90a69"}
 *
 * Go source:
 * func (c *Checker) getJsxElementClassTypeAt(location *ast.Node) *Type {
 * 	t := c.getJsxType(JsxNames.ElementClass, location)
 * 	if c.isErrorType(t) {
 * 		return nil
 * 	}
 * 	return t
 * }
 */
export declare function Checker_getJsxElementClassTypeAt(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxElementTypeAt","kind":"method","status":"implemented","sigHash":"d63e42785400ff1a4236db566fd27627f1479ab046d88ce32091178e0d7ff3c5","bodyHash":"2fab698e3c6ccd7df906d98d8a3a0214f0c39436c9a8c48822e36c5d3d31f7ea"}
 *
 * Go source:
 * func (c *Checker) getJsxElementTypeAt(location *ast.Node) *Type {
 * 	return c.getJsxType(JsxNames.Element, location)
 * }
 */
export declare function Checker_getJsxElementTypeAt(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxElementTypeTypeAt","kind":"method","status":"implemented","sigHash":"bd88e72517b694cd7e59131748f448873117a5e72ceb3f947f47ed2766b98659","bodyHash":"20c1dc9bbc1760e238008eb5c0babfc222114ad6b54d10b5efcf8188c0fcc3a3"}
 *
 * Go source:
 * func (c *Checker) getJsxElementTypeTypeAt(location *ast.Node) *Type {
 * 	ns := c.getJsxNamespaceAt(location)
 * 	if ns == nil {
 * 		return nil
 * 	}
 * 	sym := c.getJsxElementTypeSymbol(ns)
 * 	if sym == nil {
 * 		return nil
 * 	}
 * 	t := c.instantiateAliasOrInterfaceWithDefaults(sym, nil, ast.IsInJSFile(location))
 * 	if t == nil || c.isErrorType(t) {
 * 		return nil
 * 	}
 * 	return t
 * }
 */
export declare function Checker_getJsxElementTypeTypeAt(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxType","kind":"method","status":"implemented","sigHash":"e6a4933036053cd3f95a58171cd20acae0280ab3055339321bc3e81d7faaecaa","bodyHash":"8e34c402bca341e5c9b6bdfd6079739627c3fb0d03b3faf5ab5bec21c39f033e"}
 *
 * Go source:
 * func (c *Checker) getJsxType(name string, location *ast.Node) *Type {
 * 	if namespace := c.getJsxNamespaceAt(location); namespace != nil {
 * 		if exports := c.getExportsOfSymbol(namespace); exports != nil {
 * 			if typeSymbol := c.getSymbol(exports, name, ast.SymbolFlagsType); typeSymbol != nil {
 * 				return c.getDeclaredTypeOfSymbol(typeSymbol)
 * 			}
 * 		}
 * 	}
 * 	return c.errorType
 * }
 */
export declare function Checker_getJsxType(receiver: GoPtr<Checker>, name: string, location: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxNamespaceAt","kind":"method","status":"implemented","sigHash":"be30bd826150c3a3e41be5aece72fc7b02833f87338ed9c1e2d9963d3c8988be","bodyHash":"94b879bfe3e882dd9e4e8d3a2452a54f49f5f79f061aaffc42af68f7fb48faf7"}
 *
 * Go source:
 * func (c *Checker) getJsxNamespaceAt(location *ast.Node) *ast.Symbol {
 * 	var links *JsxElementLinks
 * 	if location != nil {
 * 		links = c.jsxElementLinks.Get(location)
 * 	}
 * 	if links != nil && links.jsxNamespace != nil && links.jsxNamespace != c.unknownSymbol {
 * 		return links.jsxNamespace
 * 	}
 * 	if links == nil || links.jsxNamespace != c.unknownSymbol {
 * 		resolvedNamespace := c.getJsxNamespaceContainerForImplicitImport(location)
 * 		if resolvedNamespace == nil || resolvedNamespace == c.unknownSymbol {
 * 			namespaceName := c.getJsxNamespace(location)
 * 			resolvedNamespace = c.resolveName(location, namespaceName, ast.SymbolFlagsNamespace, nil /*nameNotFoundMessage* /, false /*isUse* /, false /*excludeGlobals* /)
 * 		}
 * 		if resolvedNamespace != nil {
 * 			candidate := c.resolveSymbol(c.getSymbol(c.getExportsOfSymbol(c.resolveSymbol(resolvedNamespace)), JsxNames.JSX, ast.SymbolFlagsNamespace))
 * 			if candidate != nil && candidate != c.unknownSymbol {
 * 				if links != nil {
 * 					links.jsxNamespace = candidate
 * 				}
 * 				return candidate
 * 			}
 * 		}
 * 		if links != nil {
 * 			links.jsxNamespace = c.unknownSymbol
 * 		}
 * 	}
 * 	// JSX global fallback
 * 	s := c.resolveSymbol(c.getGlobalSymbol(JsxNames.JSX, ast.SymbolFlagsNamespace, nil /*diagnostic* /))
 * 	if s == c.unknownSymbol {
 * 		return nil
 * 	}
 * 	return s
 * }
 */
export declare function Checker_getJsxNamespaceAt(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxNamespace","kind":"method","status":"implemented","sigHash":"3ff6fb85815fe02b68adab7c862ad2dcf4dfac8f07f503aef154e77077bf4c8f","bodyHash":"4fceb733a934848fb207d3c404110bf77aa054f1ce3f5dbc85ac9f0497a27fbd"}
 *
 * Go source:
 * func (c *Checker) getJsxNamespace(location *ast.Node) string {
 * 	if location != nil {
 * 		file := ast.GetSourceFileOfNode(location)
 * 		if file != nil {
 * 			links := c.sourceFileLinks.Get(file)
 * 			if ast.IsJsxOpeningFragment(location) {
 * 				if links.localJsxFragmentNamespace != "" {
 * 					return links.localJsxFragmentNamespace
 * 				}
 * 				jsxFragmentPragma := ast.GetPragmaFromSourceFile(file, "jsxfrag")
 * 				if jsxFragmentPragma != nil {
 * 					links.localJsxFragmentFactory = c.parseIsolatedEntityName(jsxFragmentPragma.Args["factory"].Value)
 * 					if links.localJsxFragmentFactory != nil {
 * 						links.localJsxFragmentNamespace = ast.GetFirstIdentifier(links.localJsxFragmentFactory).Text()
 * 						return links.localJsxFragmentNamespace
 * 					}
 * 				}
 * 				entity := c.getJsxFragmentFactoryEntity(location)
 * 				if entity != nil {
 * 					links.localJsxFragmentFactory = entity
 * 					links.localJsxFragmentNamespace = ast.GetFirstIdentifier(entity).Text()
 * 					return links.localJsxFragmentNamespace
 * 				}
 * 			} else {
 * 				localJsxNamespace := c.getLocalJsxNamespace(file)
 * 				if localJsxNamespace != "" {
 * 					links.localJsxNamespace = localJsxNamespace
 * 					return links.localJsxNamespace
 * 				}
 * 			}
 * 		}
 * 	}
 * 	if c._jsxNamespace == "" {
 * 		c._jsxNamespace = "React"
 * 		if c.compilerOptions.JsxFactory != "" {
 * 			c._jsxFactoryEntity = c.parseIsolatedEntityName(c.compilerOptions.JsxFactory)
 * 			if c._jsxFactoryEntity != nil {
 * 				c._jsxNamespace = ast.GetFirstIdentifier(c._jsxFactoryEntity).Text()
 * 			}
 * 		} else if c.compilerOptions.ReactNamespace != "" {
 * 			c._jsxNamespace = c.compilerOptions.ReactNamespace
 * 		}
 * 	}
 * 	if c._jsxFactoryEntity == nil {
 * 		c._jsxFactoryEntity = c.factory.NewQualifiedName(c.factory.NewIdentifier(c._jsxNamespace), c.factory.NewIdentifier("createElement"))
 * 	}
 * 	return c._jsxNamespace
 * }
 */
export declare function Checker_getJsxNamespace(receiver: GoPtr<Checker>, location: GoPtr<Node>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getLocalJsxNamespace","kind":"method","status":"implemented","sigHash":"0193d8ce8faba3eebd2392363d3366f6d0e959bbdb3db5646a45081ee948e697","bodyHash":"e496eda9f830959a8b2ee6d4d9214eca903aee543b223be4ab93d2729c8df2cd"}
 *
 * Go source:
 * func (c *Checker) getLocalJsxNamespace(file *ast.SourceFile) string {
 * 	links := c.sourceFileLinks.Get(file)
 * 	if links.localJsxNamespace != "" {
 * 		return links.localJsxNamespace
 * 	}
 * 	jsxPragma := ast.GetPragmaFromSourceFile(file, "jsx")
 * 	if jsxPragma != nil {
 * 		links.localJsxFactory = c.parseIsolatedEntityName(jsxPragma.Args["factory"].Value)
 * 		if links.localJsxFactory != nil {
 * 			links.localJsxNamespace = ast.GetFirstIdentifier(links.localJsxFactory).Text()
 * 			return links.localJsxNamespace
 * 		}
 * 	}
 * 	return ""
 * }
 */
export declare function Checker_getLocalJsxNamespace(receiver: GoPtr<Checker>, file: GoPtr<SourceFile>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxFactoryEntity","kind":"method","status":"implemented","sigHash":"3e2b426635e24d55b10fa40958a6a6ff7d94a58d9671a0124b546e8f46f945f0","bodyHash":"e40033931978e14d0813decc073080d6cda382b271ce65fcffe857234777d522"}
 *
 * Go source:
 * func (c *Checker) getJsxFactoryEntity(location *ast.Node) *ast.Node {
 * 	if location != nil {
 * 		c.getJsxNamespace(location)
 * 		if localJsxFactory := c.sourceFileLinks.Get(ast.GetSourceFileOfNode(location)).localJsxFactory; localJsxFactory != nil {
 * 			return localJsxFactory
 * 		}
 * 	}
 * 	return c._jsxFactoryEntity
 * }
 */
export declare function Checker_getJsxFactoryEntity(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxFragmentFactoryEntity","kind":"method","status":"implemented","sigHash":"ce5eae41a3fde2392dc09ed36cdd7e244c3a78cca68354a727dbd72b0e332749","bodyHash":"9732c8ecf4f1d8e9dcc81b91597a25d3b679e84e449834aad4eae3069760af76"}
 *
 * Go source:
 * func (c *Checker) getJsxFragmentFactoryEntity(location *ast.Node) *ast.EntityName {
 * 	if location != nil {
 * 		file := ast.GetSourceFileOfNode(location)
 * 		if file != nil {
 * 			links := c.sourceFileLinks.Get(file)
 * 			if links.localJsxFragmentFactory != nil {
 * 				return links.localJsxFragmentFactory
 * 			}
 * 			jsxFragPragma := ast.GetPragmaFromSourceFile(file, "jsxfrag")
 * 			if jsxFragPragma != nil {
 * 				links.localJsxFragmentFactory = c.parseIsolatedEntityName(jsxFragPragma.Args["factory"].Value)
 * 				return links.localJsxFragmentFactory
 * 			}
 * 		}
 * 	}
 * 	if c.compilerOptions.JsxFragmentFactory != "" {
 * 		return c.parseIsolatedEntityName(c.compilerOptions.JsxFragmentFactory)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getJsxFragmentFactoryEntity(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<EntityName>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.parseIsolatedEntityName","kind":"method","status":"implemented","sigHash":"1376eafb693ff906e32328c9ac475526174d6931789aaf6a63cc68d248525269","bodyHash":"f1d7affd9be46a3db416e7ec5a6ad876d6d3e1f48b9ef08c3e8d9e19d50b33d6"}
 *
 * Go source:
 * func (c *Checker) parseIsolatedEntityName(name string) *ast.Node {
 * 	result := parser.ParseIsolatedEntityName(name)
 * 	if result != nil {
 * 		markAsSynthetic(result)
 * 	}
 * 	return result
 * }
 */
export declare function Checker_parseIsolatedEntityName(receiver: GoPtr<Checker>, name: string): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::func::markAsSynthetic","kind":"func","status":"implemented","sigHash":"80b06cd1a434e82058c4c058ef673dadeae7a908bc201562e00ab41abd372ba8","bodyHash":"399a045673ad88b23634330e710f1d636fb89d63f88201c04f633094bb56569c"}
 *
 * Go source:
 * func markAsSynthetic(node *ast.Node) bool {
 * 	node.Loc = core.NewTextRange(-1, -1)
 * 	node.ForEachChild(markAsSynthetic)
 * 	return false
 * }
 */
export declare function markAsSynthetic(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxNamespaceContainerForImplicitImport","kind":"method","status":"implemented","sigHash":"18edcf6b972559a539175b87408ba4ae1cd2eb7736408d4d6cdef0812f3d4992","bodyHash":"2636c0f4926529ea4e90c747d2370f3c78beee080d81e9f7b4798e43e1fe45b2"}
 *
 * Go source:
 * func (c *Checker) getJsxNamespaceContainerForImplicitImport(location *ast.Node) *ast.Symbol {
 * 	var file *ast.SourceFile
 * 	var links *JsxElementLinks
 * 	if location != nil {
 * 		if file = ast.GetSourceFileOfNode(location); file != nil {
 * 			links = c.jsxElementLinks.Get(file.AsNode())
 * 		}
 * 	}
 * 	if links != nil && links.jsxImplicitImportContainer != nil {
 * 		return core.IfElse(links.jsxImplicitImportContainer == c.unknownSymbol, nil, links.jsxImplicitImportContainer)
 * 	}
 * 	moduleReference, specifier := c.getJSXRuntimeImportSpecifier(file)
 * 	if moduleReference == "" {
 * 		return nil
 * 	}
 * 	errorMessage := diagnostics.This_JSX_tag_requires_the_module_path_0_to_exist_but_none_could_be_found_Make_sure_you_have_types_for_the_appropriate_package_installed
 * 	mod := c.resolveExternalModule(core.OrElse(specifier, location), moduleReference, errorMessage, location, false)
 * 	var result *ast.Symbol
 * 	if mod != nil && mod != c.unknownSymbol {
 * 		result = c.getMergedSymbol(c.resolveSymbol(mod))
 * 	}
 * 	if links != nil {
 * 		links.jsxImplicitImportContainer = core.OrElse(result, c.unknownSymbol)
 * 	}
 * 	return result
 * }
 */
export declare function Checker_getJsxNamespaceContainerForImplicitImport(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJSXRuntimeImportSpecifier","kind":"method","status":"implemented","sigHash":"099c021238c98a63ca106641b947a8b3943e9cbe7cc725526df50576f98342b0","bodyHash":"083244663a6a40269a7ed0e581687e8ab77167027a11c3c266602bb4e20159ab"}
 *
 * Go source:
 * func (c *Checker) getJSXRuntimeImportSpecifier(file *ast.SourceFile) (moduleReference string, specifier *ast.Node) {
 * 	return c.program.GetJSXRuntimeImportSpecifier(file.Path())
 * }
 */
export declare function Checker_getJSXRuntimeImportSpecifier(receiver: GoPtr<Checker>, file: GoPtr<SourceFile>): [string, GoPtr<Node>];
//# sourceMappingURL=jsx.d.ts.map