import type { bool, int, uint } from "@tsonic/core/types.js";
import type { GoPtr, GoSeq, GoSlice } from "../../go/compat.js";
import { Values as SliceValues } from "../../go/slices.js";
import { Node_DeclarationData, Node_ForEachChild, Node_Name } from "../ast/spine.js";
import type { Node } from "../ast/spine.js";
import type { SourceFile } from "../ast/ast.js";
import { Node_Text, SourceFile_Path, Node_Attributes, Node_Properties, Node_Children, Node_TagName, Node_Expression, Node_Initializer, Node_Symbol, Node_TypeArguments, Node_TypeArgumentList } from "../ast/ast.js";
import type { EntityName, JsxChild } from "../ast/generated/unions.js";
import { KindJsxElement, KindJsxExpression, KindJsxFragment, KindJsxSelfClosingElement, KindJsxText } from "../ast/generated/kinds.js";
import { IsJsxOpeningFragment, IsJsxElement, IsJsxAttribute, IsJsxOpeningElement, IsIdentifier, IsJsxNamespacedName, IsJsxText, IsJsxExpression, IsJsxSpreadAttribute, IsJsxSelfClosingElement, IsJsxFragment } from "../ast/generated/predicates.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import { Diagnostic_AddRelatedInfo, DiagnosticsCollection_Add, NewDiagnostic, NewDiagnosticChain } from "../ast/diagnostic.js";
import type { Symbol } from "../ast/symbol.js";
import { SymbolFlagsType, SymbolFlagsNamespace, SymbolFlagsValue, SymbolFlagsAlias, SymbolFlagsBlockScopedVariable, SymbolFlagsEnum, SymbolFlagsTypeAlias, SymbolFlagsFunctionScopedVariable, SymbolFlagsOptional, SymbolFlagsProperty } from "../ast/symbolflags.js";
import type { SymbolFlags } from "../ast/symbolflags.js";
import type { SymbolTable } from "../ast/symbol.js";
import type { Message } from "../diagnostics/diagnostics.js";
import { NewTextRange } from "../core/text.js";
import { JsxEmitReactJSX, JsxEmitReactJSXDev, JsxEmitReact, JsxEmitPreserve, JsxEmitReactNative, JsxEmitNone, CompilerOptions_GetJSXTransformEnabled } from "../core/compileroptions.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import { LinkStore_Get } from "../core/linkstore.js";
import { GetSourceFileOfNode, GetFirstIdentifier, GetPragmaFromSourceFile, GetPragmaArgument, IsInJSFile, IsJsxAttributeLike, GetSemanticJsxChildren, GetNodeId, IsJsxOpeningLikeElement } from "../ast/utilities.js";
import { InternalSymbolNameMissing, SymbolName } from "../ast/symbol.js";
import { ParseIsolatedEntityName } from "../parser/parser/support.js";
import { OrElse, IfElse, Find, Map } from "../core/core.js";
import { NewIdentifier, NewPropertySignatureDeclaration, NewQualifiedName } from "../ast/generated/factory.js";
import { AsJsxElement, AsJsxExpression, AsJsxFragment, AsJsxText } from "../ast/generated/casts.js";
import { The_global_type_JSX_0_may_not_have_more_than_one_property, This_JSX_tag_requires_the_module_path_0_to_exist_but_none_could_be_found_Make_sure_you_have_types_for_the_appropriate_package_installed, Using_JSX_fragments_requires_fragment_factory_0_to_be_in_scope_but_it_could_not_be_found, JSX_element_class_does_not_support_attributes_because_it_does_not_have_a_0_property, Cannot_use_JSX_unless_the_jsx_flag_is_provided, JSX_element_implicitly_has_type_any_because_the_global_type_JSX_Element_does_not_exist, JSX_element_implicitly_has_type_any_because_no_interface_JSX_0_exists, Property_0_does_not_exist_on_type_1, JSX_spread_child_must_be_an_array_type, The_jsxFragmentFactory_compiler_option_must_be_provided_to_use_JSX_fragments_with_the_jsxFactory_compiler_option, An_jsxFrag_pragma_is_required_when_using_an_jsx_pragma_with_JSX_fragments, This_JSX_tag_s_0_prop_expects_a_single_child_of_type_1_but_multiple_children_were_provided, This_JSX_tag_s_0_prop_expects_type_1_which_requires_multiple_children_but_only_a_single_child_was_provided, X_0_components_don_t_accept_text_as_child_elements_Text_in_JSX_has_the_type_string_but_the_expected_type_of_1_is_2, Type_0_is_not_assignable_to_type_1_with_exactOptionalPropertyTypes_Colon_true_Consider_adding_undefined_to_the_type_of_the_target, Its_type_0_is_not_a_valid_JSX_element_type, JSX_element_type_0_does_not_have_any_construct_or_call_signatures, Tag_0_expects_at_least_1_arguments_but_the_JSX_factory_2_provides_at_most_3, X_0_is_declared_here, Expected_0_type_arguments_but_got_1, Spread_types_may_only_be_created_from_object_types, X_0_are_specified_twice_The_attribute_named_0_will_be_overwritten } from "../diagnostics/generated/messages.js";
import { Its_element_type_0_is_not_a_valid_JSX_element, Its_instance_type_0_is_not_a_valid_JSX_element, Its_return_type_0_is_not_a_valid_JSX_element, X_0_cannot_be_used_as_a_JSX_component } from "../diagnostics/generated/messages.js";
import { GetTextOfNode } from "../scanner/utilities.js";
import { IsTypeAny, isJsxIntrinsicTagName, NewDiagnosticForNode, entityNameToString } from "./utilities.js";
import { newTypeMapper } from "./mapper.js";
import { Checker_isErrorType, Checker_checkDeprecatedSignature, Checker_resolveErrorCall, Checker_addDeprecatedSuggestion, Checker_isDeprecatedSymbol } from "./checker/diagnostics.js";
import { Checker_checkGrammarJsxExpression, Checker_checkGrammarJsxElement } from "./grammarchecks.js";
import { Checker_getPropertyOfType, Checker_getIndexTypeOfType, Checker_getTypeOfPropertyOfType, Checker_getIndexedAccessTypeOrUndefined, Checker_getPropertyNameFromIndex, Checker_markJsxAliasReferenced, Checker_isExactOptionalPropertyMismatch, Checker_resolveEntityName, Checker_getSymbolAtLocation } from "./checker/symbols.js";
import { Checker_getUnionType, Checker_createTypeReference, Checker_intersectTypes, Checker_getIntersectionType, Checker_instantiateType, Checker_getPropertiesOfType, Checker_getContextualType, Checker_getApparentTypeOfContextualType, Checker_isArrayLikeType, Checker_getNumberLiteralType, Checker_mapTypeEx, Checker_getApparentType, Checker_getStringLiteralType, Checker_isArrayType, Checker_checkExpressionWithContextualType, ObjectLiteralDiscriminator_len, ObjectLiteralDiscriminator_name, ObjectLiteralDiscriminator_matches, Checker_filterType, Checker_createIterableType, Checker_isArrayOrTupleLikeType, Checker_createTupleType, Checker_removeMissingType, Checker_getIterationTypeOfIterable, Checker_getRegularTypeOfObjectLiteral, Checker_getSpreadType, Checker_getReducedType, Checker_isValidSpreadType, Checker_newAnonymousType, Checker_getPropagatingFlagsOfTypes, Checker_createArrayType, Checker_isTupleLikeType } from "./checker/types.js";
import type { Checker, CheckMode, InferenceContext, DiscriminatedContextualTypeKey, ObjectLiteralDiscriminator } from "./checker/state.js";
import { getStringLiteralValue, CheckModeInferential, CheckModeNormal, CheckModeSkipContextSensitive, InferencePriorityNone, Checker_getSourceFileLinks, IterationUseForOf, IterationTypeKindYield, createDiagnosticForNode, someType } from "./checker/state.js";
import { Checker_error } from "./checker/support.js";
import { Checker_checkSourceElements } from "./checker/support.js";
import { Checker_getSymbol, Checker_getDeclaredTypeOfSymbol, Checker_getExportsOfSymbol, Checker_resolveSymbol, Checker_getMergedSymbol, Checker_getGlobalSymbol, Checker_getTypeOfSymbol, Checker_resolveAlias, Checker_getSpellingSuggestionForName, Checker_getTypeOfPropertyOfContextualType, Checker_getIndexedAccessType, Checker_newSymbol } from "./checker/symbols.js";
import { Checker_resolveExternalModule } from "./checker/modules.js";
import { Checker_findContextualNode, Checker_checkExpression, Checker_checkExpressionCached, Checker_checkNodeDeferred, Checker_checkExpressionEx, Checker_checkExpressionForMutableLocation } from "./checker/syntax-checking.js";
import { Checker_fillMissingTypeArguments, Checker_getReturnTypeOfSignature, Checker_getMinTypeArgumentCount, Checker_getLocalTypeParametersOfClassOrInterfaceOrTypeAlias, Checker_getTypeOfFirstParameterOfSignatureWithFallback, Checker_getContextualTypeForArgumentAtIndex, Checker_getSignaturesOfType, Checker_newSignature, Checker_getApplicableIndexInfoForName, Checker_getApplicableIndexSymbol, Checker_getTypeOfPropertyOrIndexSignatureOfType, Checker_getOrCreateTypeFromSignature, Checker_getUnionSignatures, Checker_getResolvedSignature, Checker_resolveCall, Checker_resolveUntypedCall, Checker_isUntypedFunctionCall } from "./checker/signatures.js";
import { Checker_getInferenceContext, Checker_getTypeAliasInstantiation } from "./checker/inference.js";
import { Checker_addIntraExpressionInferenceSite, Checker_inferTypes, Checker_getInferredTypes } from "./inference.js";
import { Checker_isContextSensitive } from "./checker/support-queries.js";
import { Checker_checkSpreadPropOverrides } from "./checker/classes.js";
import { Checker_isPossiblyDiscriminantValue } from "./checker/flow-narrowing.js";
import { Checker_TypeToString } from "./printer.js";
import type { SourceFileLinks, TypeAliasLinks, InterfaceType, ValueSymbolLinks, SymbolNodeLinks } from "./types.js";
import { Type_AsInterfaceType, InterfaceType_TypeParameters, SignatureFlagsNone } from "./types.js";
import type { Relation } from "./relater.js";
import { Checker_checkTypeRelatedToEx, Checker_isTypeAssignableTo, Checker_checkTypeRelatedTo, Checker_reportDiagnostic, Checker_elaborateError, Checker_getBestMatchIndexedAccessTypeOrUndefined, Checker_checkExpressionForMutableLocationWithContextualType, Checker_elaborateElement, Checker_isDiscriminantProperty, Checker_discriminateTypeByDiscriminableItems, isHyphenatedJsxName, Checker_checkTypeAssignableToAndOptionallyElaborate, Checker_checkTypeRelatedToAndOptionallyElaborate, Checker_getTypeAtPosition, Checker_hasEffectiveRestParameter, Checker_getParameterCount, Checker_getMinArgumentCount } from "./relater.js";
import { ContextFlagsNone, ContextFlagsIgnoreNodeInferences, SignatureKindCall, SignatureKindConstruct, TypeFlagsString, TypeFlagsStringLiteral, TypeFlagsUnion, Type_Types, TypeFlagsNever, TypeFlagsIndexedAccess, AccessFlagsNone, ObjectFlagsJsxAttributes, ObjectFlagsFreshLiteral, ObjectFlagsObjectLiteral, ObjectFlagsContainsObjectOrArrayLiteral, ObjectFlagsPropagatingFlags, TypeFlagsNone } from "./types.js";
import type { ContextFlags, ObjectFlags, Signature, Type } from "./types.js";

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
export const JsxFlagsNone: JsxFlags = 0;
export const JsxFlagsIntrinsicNamedElement: JsxFlags = 1 << 0; // An element from a named property of the JSX.IntrinsicElements interface
export const JsxFlagsIntrinsicIndexedElement: JsxFlags = 1 << 1; // An element inferred from the string index signature of the JSX.IntrinsicElements interface
export const JsxFlagsIntrinsicElement: JsxFlags = JsxFlagsIntrinsicNamedElement | JsxFlagsIntrinsicIndexedElement;

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
export const JsxReferenceKindComponent: JsxReferenceKind = 0;
export const JsxReferenceKindFunction: JsxReferenceKind = 1;
export const JsxReferenceKindMixed: JsxReferenceKind = 2;

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
export const JsxNames: { JSX: string; IntrinsicElements: string; ElementClass: string; ElementAttributesPropertyNameContainer: string; ElementChildrenAttributeNameContainer: string; Element: string; ElementType: string; IntrinsicAttributes: string; IntrinsicClassAttributes: string; LibraryManagedAttributes: string } = {
  JSX: "JSX",
  IntrinsicElements: "IntrinsicElements",
  ElementClass: "ElementClass",
  ElementAttributesPropertyNameContainer: "ElementAttributesProperty",
  ElementChildrenAttributeNameContainer: "ElementChildrenAttribute",
  Element: "Element",
  ElementType: "ElementType",
  IntrinsicAttributes: "IntrinsicAttributes",
  IntrinsicClassAttributes: "IntrinsicClassAttributes",
  LibraryManagedAttributes: "LibraryManagedAttributes",
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
export const ReactNames: { Fragment: string } = {
  Fragment: "Fragment",
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
export function Checker_checkJsxElement(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  Checker_checkNodeDeferred(receiver, node);
  return Checker_getJsxElementTypeAt(receiver, node);
}

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
export function Checker_checkJsxElementDeferred(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const jsxElement = AsJsxElement(node);
  Checker_checkJsxOpeningLikeElementOrOpeningFragment(receiver, jsxElement!.OpeningElement);
  // Perform resolution on the closing tag so that rename/go to definition/etc work
  if (isJsxIntrinsicTagName(Node_TagName(jsxElement!.ClosingElement))) {
    Checker_getIntrinsicTagSymbol(receiver, jsxElement!.ClosingElement);
  } else {
    Checker_checkExpression(receiver, Node_TagName(jsxElement!.ClosingElement));
  }
  Checker_checkJsxChildren(receiver, node, CheckModeNormal);
}

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
export function Checker_checkJsxExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  Checker_checkGrammarJsxExpression(receiver, AsJsxExpression(node));
  if (Node_Expression(node) === undefined) {
    return receiver!.errorType;
  }
  const t = Checker_checkExpressionEx(receiver, Node_Expression(node), checkMode);
  if (AsJsxExpression(node)!.DotDotDotToken !== undefined && t !== receiver!.anyType && !Checker_isArrayType(receiver, t)) {
    Checker_error(receiver, node, JSX_spread_child_must_be_an_array_type);
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxSelfClosingElement","kind":"method","status":"implemented","sigHash":"84e12a25933dc97a674f04b4c96df1fc2c80105336a887455d8f2fac392bb9d7","bodyHash":"bcc1693324e67d97653041e48548dfd475bda24e78cbc565202a53b8974a8266"}
 *
 * Go source:
 * func (c *Checker) checkJsxSelfClosingElement(node *ast.Node, checkMode CheckMode) *Type {
 * 	c.checkNodeDeferred(node)
 * 	return c.getJsxElementTypeAt(node)
 * }
 */
export function Checker_checkJsxSelfClosingElement(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  Checker_checkNodeDeferred(receiver, node);
  return Checker_getJsxElementTypeAt(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxSelfClosingElementDeferred","kind":"method","status":"implemented","sigHash":"93519f6e6e8483084d9f3095878752a2b33e272941b3c21a3563332c951c9859","bodyHash":"5724601ecebedd7197aa957e89297297a3170d0c239dca0366be989cec2ae1c5"}
 *
 * Go source:
 * func (c *Checker) checkJsxSelfClosingElementDeferred(node *ast.Node) {
 * 	c.checkJsxOpeningLikeElementOrOpeningFragment(node)
 * }
 */
export function Checker_checkJsxSelfClosingElementDeferred(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  Checker_checkJsxOpeningLikeElementOrOpeningFragment(receiver, node);
}

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
export function Checker_checkJsxFragment(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  Checker_checkJsxOpeningLikeElementOrOpeningFragment(receiver, AsJsxFragment(node)!.OpeningFragment);
  // by default, jsx:'react' will use jsxFactory = React.createElement and jsxFragmentFactory = React.Fragment
  // if jsxFactory compiler option is provided, ensure jsxFragmentFactory compiler option or @jsxFrag pragma is provided too
  const nodeSourceFile = GetSourceFileOfNode(node);
  if (CompilerOptions_GetJSXTransformEnabled(receiver!.compilerOptions) && (receiver!.compilerOptions!.JsxFactory !== "" || GetPragmaFromSourceFile(nodeSourceFile, "jsx") !== undefined) && receiver!.compilerOptions!.JsxFragmentFactory === "" && GetPragmaFromSourceFile(nodeSourceFile, "jsxfrag") === undefined) {
    const message = IfElse(receiver!.compilerOptions!.JsxFactory !== "",
      The_jsxFragmentFactory_compiler_option_must_be_provided_to_use_JSX_fragments_with_the_jsxFactory_compiler_option,
      An_jsxFrag_pragma_is_required_when_using_an_jsx_pragma_with_JSX_fragments);
    Checker_error(receiver, node, message);
  }
  Checker_checkJsxChildren(receiver, node, CheckModeNormal);
  const t = Checker_getJsxElementTypeAt(receiver, node);
  return IfElse(Checker_isErrorType(receiver, t), receiver!.anyType, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxAttributes","kind":"method","status":"implemented","sigHash":"82416eae2418c55e1a0f7f3222f2d070c3b0cbfed5abeb68787bfc07f2ca3819","bodyHash":"58d8b3cfbeab9a72599ab3596e5d7f3aaa6ebac01682916987a7d442a3349226"}
 *
 * Go source:
 * func (c *Checker) checkJsxAttributes(node *ast.Node, checkMode CheckMode) *Type {
 * 	return c.createJsxAttributesTypeFromAttributesProperty(node.Parent, checkMode)
 * }
 */
export function Checker_checkJsxAttributes(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  return Checker_createJsxAttributesTypeFromAttributesProperty(receiver, node!.Parent, checkMode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxOpeningLikeElementOrOpeningFragment","kind":"method","status":"implemented","sigHash":"852b0e25ae1ce9d3e69d23da4363182b2320bbe3eaebb580f52961acc5299a85","bodyHash":"9d69d13053b9601997eb45afa19351da3aae214f162c74a958e479062ef44426"}
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
 * 				c.diagnostics.Add(ast.NewDiagnosticChain(diags[0], diagnostics.X_0_cannot_be_used_as_a_JSX_component, scanner.GetTextOfNode(tagName)))
 * 			}
 * 		} else {
 * 			c.checkJsxReturnAssignableToAppropriateBound(c.getJsxReferenceKind(node), c.getReturnTypeOfSignature(sig), node)
 * 		}
 * 	}
 * }
 */
export function Checker_checkJsxOpeningLikeElementOrOpeningFragment(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const isNodeOpeningLikeElement = IsJsxOpeningLikeElement(node);
  if (isNodeOpeningLikeElement) {
    Checker_checkGrammarJsxElement(receiver, node);
  }
  Checker_checkJsxPreconditions(receiver, node);
  Checker_markJsxAliasReferenced(receiver, node);
  const sig = Checker_getResolvedSignature(receiver, node, undefined, CheckModeNormal);
  Checker_checkDeprecatedSignature(receiver, sig, node);
  if (isNodeOpeningLikeElement) {
    const elementTypeConstraint = Checker_getJsxElementTypeTypeAt(receiver, node);
    if (elementTypeConstraint !== undefined) {
      const tagName = Node_TagName(node);
      let tagType: GoPtr<Type>;
      if (isJsxIntrinsicTagName(tagName)) {
        tagType = Checker_getStringLiteralType(receiver, Node_Text(tagName));
      } else {
        tagType = Checker_checkExpression(receiver, tagName);
      }
      const diagnostics: GoSlice<GoPtr<Diagnostic>> = [];
      if (!Checker_checkTypeRelatedToEx(receiver, tagType, elementTypeConstraint, receiver!.assignableRelation, tagName, Its_type_0_is_not_a_valid_JSX_element_type, diagnostics)) {
        DiagnosticsCollection_Add(receiver!.diagnostics, NewDiagnosticChain(diagnostics[0], X_0_cannot_be_used_as_a_JSX_component, GetTextOfNode(tagName)));
      }
    } else {
      Checker_checkJsxReturnAssignableToAppropriateBound(receiver, Checker_getJsxReferenceKind(receiver, node), Checker_getReturnTypeOfSignature(receiver, sig), node);
    }
  }
}

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
export function Checker_checkJsxPreconditions(receiver: GoPtr<Checker>, errorNode: GoPtr<Node>): void {
  // Preconditions for using JSX
  if (receiver!.compilerOptions!.Jsx === JsxEmitNone) {
    Checker_error(receiver, errorNode, Cannot_use_JSX_unless_the_jsx_flag_is_provided);
  }
  if (receiver!.noImplicitAny && Checker_getJsxElementTypeAt(receiver, errorNode) === undefined) {
    Checker_error(receiver, errorNode, JSX_element_implicitly_has_type_any_because_the_global_type_JSX_Element_does_not_exist);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.checkJsxReturnAssignableToAppropriateBound","kind":"method","status":"implemented","sigHash":"136c323163f21b619e5969f01bb526f508fa742f03f0f7ae7fd983c1abc51441","bodyHash":"472ee60f55d460eaccd8dd828da10bf68746b1762886ddc84cff7f14ee1e1c34"}
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
 * 		c.diagnostics.Add(ast.NewDiagnosticChain(diags[0], diagnostics.X_0_cannot_be_used_as_a_JSX_component, scanner.GetTextOfNode(openingLikeElement.TagName())))
 * 	}
 * }
 */
export function Checker_checkJsxReturnAssignableToAppropriateBound(receiver: GoPtr<Checker>, refKind: JsxReferenceKind, elemInstanceType: GoPtr<Type>, openingLikeElement: GoPtr<Node>): void {
  const diags: GoSlice<GoPtr<Diagnostic>> = [];
  switch (refKind) {
    case JsxReferenceKindFunction: {
      const sfcReturnConstraint = Checker_getJsxStatelessElementTypeAt(receiver, openingLikeElement);
      if (sfcReturnConstraint !== undefined) {
        Checker_checkTypeRelatedToEx(receiver, elemInstanceType, sfcReturnConstraint, receiver!.assignableRelation, Node_TagName(openingLikeElement), Its_return_type_0_is_not_a_valid_JSX_element, diags);
      }
      break;
    }
    case JsxReferenceKindComponent: {
      const classConstraint = Checker_getJsxElementClassTypeAt(receiver, openingLikeElement);
      if (classConstraint !== undefined) {
        // Issue an error if this return type isn't assignable to JSX.ElementClass, failing that
        Checker_checkTypeRelatedToEx(receiver, elemInstanceType, classConstraint, receiver!.assignableRelation, Node_TagName(openingLikeElement), Its_instance_type_0_is_not_a_valid_JSX_element, diags);
      }
      break;
    }
    default: {
      const sfcReturnConstraint = Checker_getJsxStatelessElementTypeAt(receiver, openingLikeElement);
      const classConstraint = Checker_getJsxElementClassTypeAt(receiver, openingLikeElement);
      if (sfcReturnConstraint === undefined || classConstraint === undefined) {
        return;
      }
      const combined = Checker_getUnionType(receiver, [sfcReturnConstraint, classConstraint]);
      Checker_checkTypeRelatedToEx(receiver, elemInstanceType, combined, receiver!.assignableRelation, Node_TagName(openingLikeElement), Its_element_type_0_is_not_a_valid_JSX_element, diags);
      break;
    }
  }
  if (diags.length !== 0) {
    DiagnosticsCollection_Add(receiver!.diagnostics, NewDiagnosticChain(diags[0], X_0_cannot_be_used_as_a_JSX_component, GetTextOfNode(Node_TagName(openingLikeElement))));
  }
}

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
export function Checker_inferJsxTypeArguments(receiver: GoPtr<Checker>, node: GoPtr<Node>, signature: GoPtr<Signature>, checkMode: CheckMode, context: GoPtr<InferenceContext>): GoSlice<GoPtr<Type>> {
  const paramType = Checker_getEffectiveFirstArgumentForJsxSignature(receiver, signature, node);
  const checkAttrType = Checker_checkExpressionWithContextualType(receiver, Node_Attributes(node), paramType, context, checkMode);
  Checker_inferTypes(receiver, context!.inferences, checkAttrType, paramType, InferencePriorityNone, false);
  return Checker_getInferredTypes(receiver, context);
}

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
export function Checker_getContextualTypeForJsxExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, contextFlags: ContextFlags): GoPtr<Type> {
  if (IsJsxAttributeLike(node!.Parent)) {
    return Checker_getContextualType(receiver, node, contextFlags);
  }
  if (IsJsxElement(node!.Parent)) {
    return Checker_getContextualTypeForChildJsxExpression(receiver, node!.Parent, node as GoPtr<JsxChild>, contextFlags);
  }
  return undefined;
}

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
export function Checker_getContextualTypeForJsxAttribute(receiver: GoPtr<Checker>, attribute: GoPtr<Node>, contextFlags: ContextFlags): GoPtr<Type> {
  // When we trying to resolve JsxOpeningLikeElement as a stateless function element, we will already give its attributes a contextual type
  // which is a type of the parameter of the signature we are trying out.
  // If there is no contextual type (e.g. we are trying to resolve stateful component), get attributes type from resolving element's tagName
  if (IsJsxAttribute(attribute)) {
    const attributesType = Checker_getApparentTypeOfContextualType(receiver, attribute!.Parent, contextFlags);
    if (attributesType === undefined || IsTypeAny(attributesType)) {
      return undefined;
    }
    return Checker_getTypeOfPropertyOfContextualType(receiver, attributesType, Node_Text(Node_Name(attribute)));
  }
  return Checker_getContextualType(receiver, attribute!.Parent, contextFlags);
}

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
export function Checker_getContextualJsxElementAttributesType(receiver: GoPtr<Checker>, node: GoPtr<Node>, contextFlags: ContextFlags): GoPtr<Type> {
  if (IsJsxOpeningElement(node) && contextFlags !== ContextFlagsIgnoreNodeInferences) {
    const index = Checker_findContextualNode(receiver, node!.Parent, contextFlags === ContextFlagsNone);
    if (index >= 0) {
      // Contextually applied type is moved from attributes up to the outer jsx attributes so when walking up from the children they get hit
      // _However_ to hit them from the _attributes_ we must look for them here; otherwise we'll used the declared type
      // (as below) instead!
      return receiver!.contextualInfos[index]!.t;
    }
  }
  return Checker_getContextualTypeForArgumentAtIndex(receiver, node, 0);
}

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
export function Checker_getContextualTypeForChildJsxExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, child: GoPtr<JsxChild>, contextFlags: ContextFlags): GoPtr<Type> {
  const attributesType = Checker_getApparentTypeOfContextualType(receiver, Node_Attributes(AsJsxElement(node)!.OpeningElement), contextFlags);
  // JSX expression is in children of JSX Element, we will look for an "children" attribute (we get the name from JSX.ElementAttributesProperty)
  const jsxChildrenPropertyName = Checker_getJsxElementChildrenPropertyName(receiver, Checker_getJsxNamespaceAt(receiver, node));
  if (!(attributesType !== undefined && !IsTypeAny(attributesType) && jsxChildrenPropertyName !== InternalSymbolNameMissing && jsxChildrenPropertyName !== "")) {
    return undefined;
  }
  const realChildren = GetSemanticJsxChildren(Node_Children(node)!.Nodes);
  const childIndex = realChildren.indexOf(child);
  const childFieldType = Checker_getTypeOfPropertyOfContextualType(receiver, attributesType, jsxChildrenPropertyName);
  if (childFieldType === undefined) {
    return undefined;
  }
  if (realChildren.length === 1) {
    return childFieldType;
  }
  return Checker_mapTypeEx(receiver, childFieldType, (t) => {
    if (Checker_isArrayLikeType(receiver, t)) {
      return Checker_getIndexedAccessType(receiver, t, Checker_getNumberLiteralType(receiver, childIndex));
    }
    return t;
  }, true as bool);
}

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
export function Checker_discriminateContextualTypeByJSXAttributes(receiver: GoPtr<Checker>, node: GoPtr<Node>, contextualType: GoPtr<Type>): GoPtr<Type> {
  const key: DiscriminatedContextualTypeKey = { nodeId: GetNodeId(node), typeId: contextualType!.id };
  const cachedDiscriminated = receiver!.discriminatedContextualTypes.get(key);
  if (cachedDiscriminated !== undefined) {
    return cachedDiscriminated;
  }
  const jsxChildrenPropertyName = Checker_getJsxElementChildrenPropertyName(receiver, Checker_getJsxNamespaceAt(receiver, node));
  const discriminantProperties = (Node_Properties(node) ?? []).filter((property) => {
    const symbol = Node_Symbol(property);
    if (symbol === undefined || !IsJsxAttribute(property)) {
      return false;
    }
    const initializer = Node_Initializer(property);
    return (initializer === undefined || Checker_isPossiblyDiscriminantValue(receiver, initializer)) && Checker_isDiscriminantProperty(receiver, contextualType, symbol.Name);
  });
  const jsxAttributesSymbol = Node_Symbol(node);
  const discriminantMembers = Checker_getPropertiesOfType(receiver, contextualType).filter((symbol) => {
    if ((symbol!.Flags & SymbolFlagsOptional) === 0 || jsxAttributesSymbol === undefined) {
      return false;
    }
    const element = node!.Parent!.Parent;
    if (symbol!.Name === jsxChildrenPropertyName && IsJsxElement(element) && GetSemanticJsxChildren(Node_Children(element)!.Nodes).length !== 0) {
      return false;
    }
    return jsxAttributesSymbol!.Members?.get(symbol!.Name) === undefined && Checker_isDiscriminantProperty(receiver, contextualType, symbol!.Name);
  });
  const discriminatorData: ObjectLiteralDiscriminator = { c: receiver, props: discriminantProperties, members: discriminantMembers };
  const discriminator = {
    len: () => ObjectLiteralDiscriminator_len(discriminatorData),
    name: (index: int) => ObjectLiteralDiscriminator_name(discriminatorData, index),
    matches: (index: int, target: GoPtr<Type>) => ObjectLiteralDiscriminator_matches(discriminatorData, index, target),
  };
  const discriminated = Checker_discriminateTypeByDiscriminableItems(receiver, contextualType, discriminator);
  receiver!.discriminatedContextualTypes.set(key, discriminated);
  return discriminated;
}

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
export function Checker_elaborateJsxComponents(receiver: GoPtr<Checker>, node: GoPtr<Node>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool {
  let reportedError = false;
  for (const prop of Node_Properties(node) ?? []) {
    if (!IsJsxSpreadAttribute(prop) && !isHyphenatedJsxName(Node_Text(Node_Name(prop)))) {
      const nameType = Checker_getStringLiteralType(receiver, Node_Text(Node_Name(prop)));
      if (nameType !== undefined && (nameType!.flags & TypeFlagsNever) === 0) {
        reportedError = Checker_elaborateElement(receiver, source, target, relation, Node_Name(prop), Node_Initializer(prop), nameType, undefined, undefined, diagnosticOutput) || reportedError;
      }
    }
  }
  if (IsJsxOpeningElement(node!.Parent) && IsJsxElement(node!.Parent!.Parent)) {
    const containingElement = node!.Parent!.Parent;
    let childrenPropName = Checker_getJsxElementChildrenPropertyName(receiver, Checker_getJsxNamespaceAt(receiver, node));
    if (childrenPropName === InternalSymbolNameMissing) {
      childrenPropName = "children";
    }
    const childrenNameType = Checker_getStringLiteralType(receiver, childrenPropName);
    const childrenTargetType = Checker_getIndexedAccessType(receiver, target, childrenNameType);
    const validChildren = GetSemanticJsxChildren(Node_Children(containingElement)!.Nodes);
    if (validChildren.length === 0) {
      return reportedError;
    }
    const moreThanOneRealChildren = validChildren.length > 1;
    let arrayLikeTargetParts: GoPtr<Type>;
    let nonArrayLikeTargetParts: GoPtr<Type>;
    const iterableType = receiver!.getGlobalIterableType();
    if (iterableType !== receiver!.emptyGenericType) {
      const anyIterable = Checker_createIterableType(receiver, receiver!.anyType);
      arrayLikeTargetParts = Checker_filterType(receiver, childrenTargetType, (candidate) => Checker_isTypeAssignableTo(receiver, candidate, anyIterable));
      nonArrayLikeTargetParts = Checker_filterType(receiver, childrenTargetType, (candidate) => !Checker_isTypeAssignableTo(receiver, candidate, anyIterable));
    } else {
      arrayLikeTargetParts = Checker_filterType(receiver, childrenTargetType, (candidate) => Checker_isArrayOrTupleLikeType(receiver, candidate));
      nonArrayLikeTargetParts = Checker_filterType(receiver, childrenTargetType, (candidate) => !Checker_isArrayOrTupleLikeType(receiver, candidate));
    }
    let invalidTextDiagnostic: GoPtr<Message>;
    let invalidTextDiagnosticArgs: GoSlice<unknown> = [];
    const getInvalidTextualChildDiagnostic = (): [GoPtr<Message>, GoSlice<unknown>] => {
      if (invalidTextDiagnostic === undefined) {
        const tagNameText = GetTextOfNode(Node_TagName(node!.Parent));
        invalidTextDiagnostic = X_0_components_don_t_accept_text_as_child_elements_Text_in_JSX_has_the_type_string_but_the_expected_type_of_1_is_2;
        invalidTextDiagnosticArgs = [tagNameText, childrenPropName, Checker_TypeToString(receiver, childrenTargetType)];
      }
      return [invalidTextDiagnostic, invalidTextDiagnosticArgs];
    };
    if (moreThanOneRealChildren) {
      if (arrayLikeTargetParts !== receiver!.neverType) {
        const realSource = Checker_createTupleType(receiver, Checker_checkJsxChildren(receiver, containingElement, CheckModeNormal));
        const children = Checker_generateJsxChildren(receiver, containingElement, getInvalidTextualChildDiagnostic);
        reportedError = Checker_elaborateIterableOrArrayLikeTargetElementwise(receiver, children, realSource, arrayLikeTargetParts, relation, diagnosticOutput) || reportedError;
      } else if (!Checker_checkTypeRelatedTo(receiver, Checker_getIndexedAccessType(receiver, source, childrenNameType), childrenTargetType, relation, undefined)) {
        const diagnostic = Checker_error(receiver, Node_TagName(AsJsxElement(containingElement)!.OpeningElement), This_JSX_tag_s_0_prop_expects_a_single_child_of_type_1_but_multiple_children_were_provided, childrenPropName, Checker_TypeToString(receiver, childrenTargetType));
        Checker_reportDiagnostic(receiver, diagnostic, diagnosticOutput);
        reportedError = true;
      }
    } else if (nonArrayLikeTargetParts !== receiver!.neverType) {
      const child = validChildren[0];
      const element = Checker_getElaborationElementForJsxChild(receiver, child, childrenNameType, getInvalidTextualChildDiagnostic);
      if (element.errorNode !== undefined) {
        reportedError = Checker_elaborateElement(receiver, source, target, relation, element.errorNode, element.innerExpression, element.nameType, undefined, element.createDiagnostic, diagnosticOutput) || reportedError;
      }
    } else if (!Checker_checkTypeRelatedTo(receiver, Checker_getIndexedAccessType(receiver, source, childrenNameType), childrenTargetType, relation, undefined)) {
      const diagnostic = Checker_error(receiver, Node_TagName(AsJsxElement(containingElement)!.OpeningElement), This_JSX_tag_s_0_prop_expects_type_1_which_requires_multiple_children_but_only_a_single_child_was_provided, childrenPropName, Checker_TypeToString(receiver, childrenTargetType));
      Checker_reportDiagnostic(receiver, diagnostic, diagnosticOutput);
      reportedError = true;
    }
  }
  return reportedError;
}

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
export function Checker_generateJsxChildren(receiver: GoPtr<Checker>, node: GoPtr<Node>, getInvalidTextDiagnostic: () => [GoPtr<Message>, GoSlice<unknown>]): GoSeq<JsxElaborationElement> {
  return (yieldValue) => {
    let memberOffset = 0;
    const children = Node_Children(node)!.Nodes;
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      const nameType = Checker_getNumberLiteralType(receiver, i - memberOffset);
      const element = Checker_getElaborationElementForJsxChild(receiver, child, nameType, getInvalidTextDiagnostic);
      if (element.errorNode !== undefined) {
        if (!yieldValue(element)) {
          return;
        }
      } else {
        memberOffset++;
      }
    }
  };
}

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
export function Checker_getElaborationElementForJsxChild(receiver: GoPtr<Checker>, child: GoPtr<Node>, nameType: GoPtr<Type>, getInvalidTextDiagnostic: () => [GoPtr<Message>, GoSlice<unknown>]): JsxElaborationElement {
  switch (child!.Kind) {
    case KindJsxExpression:
      // child is of the type of the expression
      return { errorNode: child, innerExpression: Node_Expression(child), nameType, createDiagnostic: undefined };
    case KindJsxText:
      if (AsJsxText(child)!.ContainsOnlyTriviaWhiteSpaces) {
        // Whitespace only jsx text isn't real jsx text
        return { errorNode: undefined, innerExpression: undefined, nameType: undefined, createDiagnostic: undefined };
      }
      // child is a string
      return {
        errorNode: child,
        innerExpression: undefined,
        nameType,
        createDiagnostic: (prop: GoPtr<Node>): GoPtr<Diagnostic> => {
          const [errorMessage, errorArgs] = getInvalidTextDiagnostic();
          return NewDiagnosticForNode(prop, errorMessage, ...errorArgs);
        },
      };
    case KindJsxElement:
    case KindJsxSelfClosingElement:
    case KindJsxFragment:
      // child is of type JSX.Element
      return { errorNode: child, innerExpression: child, nameType, createDiagnostic: undefined };
  }
  throw new globalThis.Error("Unhandled case in getElaborationElementForJsxChild");
}

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
export function Checker_elaborateIterableOrArrayLikeTargetElementwise(receiver: GoPtr<Checker>, iterator: GoSeq<JsxElaborationElement>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool {
  const tupleOrArrayLikeTargetParts = Checker_filterType(receiver, target, (candidate) => Checker_isArrayOrTupleLikeType(receiver, candidate));
  const nonTupleOrArrayLikeTargetParts = Checker_filterType(receiver, target, (candidate) => !Checker_isArrayOrTupleLikeType(receiver, candidate));
  let iterationType: GoPtr<Type>;
  if (nonTupleOrArrayLikeTargetParts !== receiver!.neverType) {
    iterationType = Checker_getIterationTypeOfIterable(receiver, IterationUseForOf, IterationTypeKindYield, nonTupleOrArrayLikeTargetParts, undefined);
  }
  let reportedError = false;
  iterator((element) => {
    const prop = element.errorNode;
    const next = element.innerExpression;
    const nameType = element.nameType;
    let targetPropType = iterationType;
    let targetIndexedPropType: GoPtr<Type>;
    if (tupleOrArrayLikeTargetParts !== receiver!.neverType) {
      targetIndexedPropType = Checker_getBestMatchIndexedAccessTypeOrUndefined(receiver, source, tupleOrArrayLikeTargetParts, nameType);
    }
    if (targetIndexedPropType !== undefined && (targetIndexedPropType!.flags & TypeFlagsIndexedAccess) === 0) {
      if (iterationType !== undefined) {
        targetPropType = Checker_getUnionType(receiver, [iterationType, targetIndexedPropType]);
      } else {
        targetPropType = targetIndexedPropType;
      }
    }
    if (targetPropType === undefined) {
      return true;
    }
    let sourcePropType = Checker_getIndexedAccessTypeOrUndefined(receiver, source, nameType, AccessFlagsNone, undefined, undefined);
    if (sourcePropType === undefined) {
      return true;
    }
    const propName = Checker_getPropertyNameFromIndex(receiver, nameType, undefined);
    if (!Checker_checkTypeRelatedTo(receiver, sourcePropType, targetPropType, relation, undefined)) {
      const elaborated = next !== undefined && Checker_elaborateError(receiver, next, sourcePropType, targetPropType, relation, undefined, diagnosticOutput);
      reportedError = true;
      if (!elaborated) {
        let specificSource: GoPtr<Type> = sourcePropType;
        if (next !== undefined) {
          specificSource = Checker_checkExpressionForMutableLocationWithContextualType(receiver, next, sourcePropType);
        }
        if (element.createDiagnostic !== undefined) {
          Checker_reportDiagnostic(receiver, element.createDiagnostic(prop), diagnosticOutput);
        } else if (receiver!.exactOptionalPropertyTypes && Checker_isExactOptionalPropertyMismatch(receiver, specificSource, targetPropType)) {
          const diagnostic = createDiagnosticForNode(prop, Type_0_is_not_assignable_to_type_1_with_exactOptionalPropertyTypes_Colon_true_Consider_adding_undefined_to_the_type_of_the_target, Checker_TypeToString(receiver, specificSource), Checker_TypeToString(receiver, targetPropType));
          Checker_reportDiagnostic(receiver, diagnostic, diagnosticOutput);
        } else {
          const targetIsOptional = propName !== InternalSymbolNameMissing && (OrElse(Checker_getPropertyOfType(receiver, tupleOrArrayLikeTargetParts, propName), receiver!.unknownSymbol)!.Flags & SymbolFlagsOptional) !== 0;
          const sourceIsOptional = propName !== InternalSymbolNameMissing && (OrElse(Checker_getPropertyOfType(receiver, source, propName), receiver!.unknownSymbol)!.Flags & SymbolFlagsOptional) !== 0;
          targetPropType = Checker_removeMissingType(receiver, targetPropType, targetIsOptional);
          sourcePropType = Checker_removeMissingType(receiver, sourcePropType, targetIsOptional && sourceIsOptional);
          const result = Checker_checkTypeRelatedToEx(receiver, specificSource, targetPropType, relation, prop, undefined, diagnosticOutput);
          if (result && specificSource !== sourcePropType) {
            Checker_checkTypeRelatedToEx(receiver, sourcePropType, targetPropType, relation, prop, undefined, diagnosticOutput);
          }
        }
      }
    }
    return true;
  });
  return reportedError;
}

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
export function Checker_getSuggestedSymbolForNonexistentJSXAttribute(receiver: GoPtr<Checker>, name: string, containingType: GoPtr<Type>): GoPtr<Symbol> {
  const properties = Checker_getPropertiesOfType(receiver, containingType);
  let jsxSpecific: GoPtr<Symbol>;
  switch (name) {
    case "for":
      jsxSpecific = Find(properties, (x) => SymbolName(x) === "htmlFor");
      break;
    case "class":
      jsxSpecific = Find(properties, (x) => SymbolName(x) === "className");
      break;
  }
  if (jsxSpecific !== undefined) {
    return jsxSpecific;
  }
  return Checker_getSpellingSuggestionForName(receiver, name, SliceValues(properties), SymbolFlagsValue);
}

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
export function Checker_getJSXFragmentType(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const links = Checker_getSourceFileLinks(receiver, GetSourceFileOfNode(node));
  if (links!.jsxFragmentType !== undefined) {
    return links!.jsxFragmentType;
  }
  const jsxFragmentFactoryName = Checker_getJsxNamespace(receiver, node);
  const shouldResolveFactoryReference = (receiver!.compilerOptions!.Jsx === JsxEmitReact || receiver!.compilerOptions!.JsxFragmentFactory !== "") && jsxFragmentFactoryName !== "null";
  if (!shouldResolveFactoryReference) {
    links!.jsxFragmentType = receiver!.anyType;
    return links!.jsxFragmentType;
  }
  let jsxFactorySymbol = Checker_getJsxNamespaceContainerForImplicitImport(receiver, node);
  if (jsxFactorySymbol === undefined) {
    const shouldModuleRefErr = receiver!.compilerOptions!.Jsx !== JsxEmitPreserve && receiver!.compilerOptions!.Jsx !== JsxEmitReactNative;
    let flags = SymbolFlagsValue;
    if (!shouldModuleRefErr) {
      flags = flags & ~SymbolFlagsEnum;
    }
    jsxFactorySymbol = receiver!.resolveName(node, jsxFragmentFactoryName, flags as SymbolFlags, Using_JSX_fragments_requires_fragment_factory_0_to_be_in_scope_but_it_could_not_be_found, true as bool, false as bool);
  }
  if (jsxFactorySymbol === undefined) {
    links!.jsxFragmentType = receiver!.errorType;
    return links!.jsxFragmentType;
  }
  if (jsxFactorySymbol!.Name === ReactNames.Fragment) {
    links!.jsxFragmentType = Checker_getTypeOfSymbol(receiver, jsxFactorySymbol);
    return links!.jsxFragmentType;
  }
  let resolvedAlias: GoPtr<Symbol> = jsxFactorySymbol;
  if ((jsxFactorySymbol!.Flags & SymbolFlagsAlias) !== 0) {
    resolvedAlias = Checker_resolveAlias(receiver, jsxFactorySymbol);
  }
  const reactExports = Checker_getExportsOfSymbol(receiver, resolvedAlias);
  const typeSymbol = Checker_getSymbol(receiver, reactExports, ReactNames.Fragment, SymbolFlagsBlockScopedVariable);
  if (typeSymbol !== undefined) {
    links!.jsxFragmentType = Checker_getTypeOfSymbol(receiver, typeSymbol);
  } else {
    links!.jsxFragmentType = receiver!.errorType;
  }
  return links!.jsxFragmentType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.resolveJsxOpeningLikeElement","kind":"method","status":"implemented","sigHash":"97d39fe2690ff55486fee1520811a27e5874f5021f686d7444e1a9ba3792b1b9","bodyHash":"2b097e2d078317909f5d558b6a1fb7b1bb263834e9ed10e99808d22280fb2814"}
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
 * 				c.diagnostics.Add(ast.NewDiagnostic(ast.GetSourceFileOfNode(node), node.TypeArgumentList().Loc, diagnostics.Expected_0_type_arguments_but_got_1, 0, len(typeArguments)))
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
export function Checker_resolveJsxOpeningLikeElement(receiver: GoPtr<Checker>, node: GoPtr<Node>, candidatesOutArray: GoPtr<GoSlice<GoPtr<Signature>>>, checkMode: CheckMode): GoPtr<Signature> {
  const isJsxOpenFragment = IsJsxOpeningFragment(node);
  let exprTypes: GoPtr<Type>;
  if (!isJsxOpenFragment) {
    if (isJsxIntrinsicTagName(Node_TagName(node))) {
      const result = Checker_getIntrinsicAttributesTypeFromJsxOpeningLikeElement(receiver, node);
      const fakeSignature = Checker_createSignatureForJSXIntrinsic(receiver, node, result);
      Checker_checkTypeAssignableToAndOptionallyElaborate(
        receiver,
        Checker_checkExpressionWithContextualType(receiver, Node_Attributes(node), Checker_getEffectiveFirstArgumentForJsxSignature(receiver, fakeSignature, node), undefined, CheckModeNormal),
        result,
        Node_TagName(node),
        Node_Attributes(node),
        undefined,
        undefined,
      );
      const typeArguments = Node_TypeArguments(node) ?? [];
      if (typeArguments.length !== 0) {
        Checker_checkSourceElements(receiver, typeArguments);
        DiagnosticsCollection_Add(receiver!.diagnostics, NewDiagnostic(GetSourceFileOfNode(node), Node_TypeArgumentList(node)!.Loc, Expected_0_type_arguments_but_got_1, 0, typeArguments.length));
      }
      return fakeSignature;
    }
    exprTypes = Checker_checkExpression(receiver, Node_TagName(node));
  } else {
    exprTypes = Checker_getJSXFragmentType(receiver, node);
  }
  const apparentType = Checker_getApparentType(receiver, exprTypes);
  if (Checker_isErrorType(receiver, apparentType)) {
    return Checker_resolveErrorCall(receiver, node);
  }
  const signatures = Checker_getUninstantiatedJsxSignaturesOfType(receiver, exprTypes, node);
  if (Checker_isUntypedFunctionCall(receiver, exprTypes, apparentType, signatures.length, 0)) {
    return Checker_resolveUntypedCall(receiver, node);
  }
  if (signatures.length === 0) {
    if (isJsxOpenFragment) {
      Checker_error(receiver, node, JSX_element_type_0_does_not_have_any_construct_or_call_signatures, GetTextOfNode(node));
    } else {
      Checker_error(receiver, Node_TagName(node), JSX_element_type_0_does_not_have_any_construct_or_call_signatures, GetTextOfNode(Node_TagName(node)));
    }
    return Checker_resolveErrorCall(receiver, node);
  }
  return Checker_resolveCall(receiver, node, signatures, candidatesOutArray, checkMode, SignatureFlagsNone, undefined);
}

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
export function Checker_checkApplicableSignatureForJsxCallLikeElement(receiver: GoPtr<Checker>, node: GoPtr<Node>, signature: GoPtr<Signature>, relation: GoPtr<Relation>, checkMode: CheckMode, reportErrors: bool, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool {
  const paramType = Checker_getEffectiveFirstArgumentForJsxSignature(receiver, signature, node);
  let attributesType: GoPtr<Type>;
  if (IsJsxOpeningFragment(node)) {
    attributesType = Checker_createJsxAttributesTypeFromAttributesProperty(receiver, node, CheckModeNormal);
  } else {
    attributesType = Checker_checkExpressionWithContextualType(receiver, Node_Attributes(node), paramType, undefined, checkMode);
  }
  let checkAttributesType: GoPtr<Type>;
  const checkTagNameDoesNotExpectTooManyArguments = (): bool => {
    if (Checker_getJsxNamespaceContainerForImplicitImport(receiver, node) !== undefined) {
      return true;
    }
    let tagType: GoPtr<Type>;
    if ((IsJsxOpeningElement(node) || IsJsxSelfClosingElement(node)) && !(isJsxIntrinsicTagName(Node_TagName(node)) || IsJsxNamespacedName(Node_TagName(node)))) {
      tagType = Checker_checkExpression(receiver, Node_TagName(node));
    }
    if (tagType === undefined) {
      return true;
    }
    const tagCallSignatures = Checker_getSignaturesOfType(receiver, tagType, SignatureKindCall);
    if (tagCallSignatures.length === 0) {
      return true;
    }
    const factory = Checker_getJsxFactoryEntity(receiver, node);
    if (factory === undefined) {
      return true;
    }
    const factorySymbol = Checker_resolveEntityName(receiver, factory, SymbolFlagsValue, true, false, node);
    if (factorySymbol === undefined) {
      return true;
    }
    const factoryType = Checker_getTypeOfSymbol(receiver, factorySymbol);
    const callSignatures = Checker_getSignaturesOfType(receiver, factoryType, SignatureKindCall);
    if (callSignatures.length === 0) {
      return true;
    }
    let hasFirstParamSignatures = false;
    let maxParamCount = 0;
    for (const sig of callSignatures) {
      const firstParam = Checker_getTypeAtPosition(receiver, sig, 0);
      const signaturesOfParam = Checker_getSignaturesOfType(receiver, firstParam, SignatureKindCall);
      if (signaturesOfParam.length === 0) {
        continue;
      }
      for (const paramSig of signaturesOfParam) {
        hasFirstParamSignatures = true;
        if (Checker_hasEffectiveRestParameter(receiver, paramSig)) {
          return true;
        }
        const paramCount = Checker_getParameterCount(receiver, paramSig);
        if (paramCount > maxParamCount) {
          maxParamCount = paramCount;
        }
      }
    }
    if (!hasFirstParamSignatures) {
      return true;
    }
    let absoluteMinArgCount = Number.MAX_SAFE_INTEGER as int;
    for (const tagSig of tagCallSignatures) {
      const tagRequiredArgCount = Checker_getMinArgumentCount(receiver, tagSig);
      if (tagRequiredArgCount < absoluteMinArgCount) {
        absoluteMinArgCount = tagRequiredArgCount;
      }
    }
    if (absoluteMinArgCount <= maxParamCount) {
      return true;
    }
    if (reportErrors) {
      const tagName = Node_TagName(node);
      const diagnostic = NewDiagnosticForNode(tagName, Tag_0_expects_at_least_1_arguments_but_the_JSX_factory_2_provides_at_most_3, entityNameToString(tagName), absoluteMinArgCount, entityNameToString(factory), maxParamCount);
      const tagNameSymbol = Checker_getSymbolAtLocation(receiver, tagName, false);
      if (tagNameSymbol !== undefined && tagNameSymbol!.ValueDeclaration !== undefined) {
        Diagnostic_AddRelatedInfo(diagnostic, NewDiagnosticForNode(tagNameSymbol!.ValueDeclaration, X_0_is_declared_here, entityNameToString(tagName)));
      }
      Checker_reportDiagnostic(receiver, diagnostic, diagnosticOutput);
    }
    return false;
  };
  if ((checkMode & CheckModeSkipContextSensitive) !== 0) {
    checkAttributesType = Checker_getRegularTypeOfObjectLiteral(receiver, attributesType);
  } else {
    checkAttributesType = attributesType;
  }
  if (!checkTagNameDoesNotExpectTooManyArguments()) {
    return false;
  }
  let errorNode: GoPtr<Node>;
  if (reportErrors) {
    if (IsJsxOpeningFragment(node)) {
      errorNode = node;
    } else {
      errorNode = Node_TagName(node);
    }
  }
  let attributes: GoPtr<Node>;
  if (!IsJsxOpeningFragment(node)) {
    attributes = Node_Attributes(node);
  }
  return Checker_checkTypeRelatedToAndOptionallyElaborate(receiver, checkAttributesType, paramType, relation, errorNode, attributes, undefined, diagnosticOutput);
}

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
export function Checker_createJsxAttributesTypeFromAttributesProperty(receiver: GoPtr<Checker>, openingLikeElement: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  let allAttributesTable: GoPtr<SymbolTable>;
  if (receiver!.strictNullChecks) {
    allAttributesTable = new globalThis.Map();
  }
  let attributesTable: SymbolTable = new globalThis.Map();
  let attributesSymbol: GoPtr<Symbol>;
  let attributeParent = openingLikeElement;
  let spread = receiver!.emptyJsxObjectType;
  let hasSpreadAnyType = false;
  let typeToIntersect: GoPtr<Type>;
  let explicitlySpecifyChildrenAttribute = false;
  let objectFlags: ObjectFlags = ObjectFlagsJsxAttributes;
  const createJsxAttributesType = (): GoPtr<Type> => {
    objectFlags = (objectFlags | ObjectFlagsFreshLiteral) as ObjectFlags;
    const result = Checker_newAnonymousType(receiver, attributesSymbol, attributesTable, [], [], []);
    result!.objectFlags = (result!.objectFlags | objectFlags | ObjectFlagsObjectLiteral | ObjectFlagsContainsObjectOrArrayLiteral) as ObjectFlags;
    return result;
  };
  const jsxChildrenPropertyName = Checker_getJsxElementChildrenPropertyName(receiver, Checker_getJsxNamespaceAt(receiver, openingLikeElement));
  const isJsxOpenFragment = IsJsxOpeningFragment(openingLikeElement);
  if (!isJsxOpenFragment) {
    const attributes = Node_Attributes(openingLikeElement);
    attributesSymbol = Node_Symbol(attributes);
    attributeParent = attributes;
    const contextualType = Checker_getContextualType(receiver, attributes, ContextFlagsNone);
    for (const attributeDecl of Node_Properties(attributes) ?? []) {
      const member = Node_Symbol(attributeDecl);
      if (IsJsxAttribute(attributeDecl)) {
        const exprType = Checker_checkJsxAttribute(receiver, attributeDecl, checkMode);
        objectFlags = (objectFlags | (exprType!.objectFlags & ObjectFlagsPropagatingFlags)) as ObjectFlags;
        const attributeSymbol = Checker_newSymbol(receiver, (SymbolFlagsProperty | member!.Flags) as SymbolFlags, member!.Name);
        attributeSymbol!.Declarations = member!.Declarations;
        attributeSymbol!.Parent = member!.Parent;
        if (member!.ValueDeclaration !== undefined) {
          attributeSymbol!.ValueDeclaration = member!.ValueDeclaration;
        }
        const links = LinkStore_Get(receiver!.valueSymbolLinks, attributeSymbol) as GoPtr<ValueSymbolLinks>;
        links!.resolvedType = exprType;
        links!.target = member;
        attributesTable.set(attributeSymbol!.Name, attributeSymbol);
        if (allAttributesTable !== undefined) {
          allAttributesTable.set(attributeSymbol!.Name, attributeSymbol);
        }
        if (Node_Text(Node_Name(attributeDecl)) === jsxChildrenPropertyName) {
          explicitlySpecifyChildrenAttribute = true;
        }
        if (contextualType !== undefined) {
          const prop = Checker_getPropertyOfType(receiver, contextualType, member!.Name);
          if (prop !== undefined && prop!.Declarations !== undefined && Checker_isDeprecatedSymbol(receiver, prop) && IsIdentifier(Node_Name(attributeDecl))) {
            Checker_addDeprecatedSuggestion(receiver, Node_Name(attributeDecl), prop!.Declarations, Node_Text(Node_Name(attributeDecl)));
          }
        }
        if (contextualType !== undefined && (checkMode & CheckModeInferential) !== 0 && (checkMode & CheckModeSkipContextSensitive) === 0 && Checker_isContextSensitive(receiver, attributeDecl)) {
          const inferenceContext = Checker_getInferenceContext(receiver, attributes);
          const inferenceNode = Node_Expression(Node_Initializer(attributeDecl));
          Checker_addIntraExpressionInferenceSite(receiver, inferenceContext, inferenceNode, exprType);
        }
      } else {
        if (attributesTable.size !== 0) {
          spread = Checker_getSpreadType(receiver, spread, createJsxAttributesType(), attributesSymbol, objectFlags, false);
          attributesTable = new globalThis.Map();
        }
        const exprType = Checker_getReducedType(receiver, Checker_checkExpressionEx(receiver, Node_Expression(attributeDecl), (checkMode & CheckModeInferential) as CheckMode));
        if (IsTypeAny(exprType)) {
          hasSpreadAnyType = true;
        }
        if (Checker_isValidSpreadType(receiver, exprType)) {
          spread = Checker_getSpreadType(receiver, spread, exprType, attributesSymbol, objectFlags, false);
          if (allAttributesTable !== undefined) {
            Checker_checkSpreadPropOverrides(receiver, exprType, allAttributesTable, attributeDecl);
          }
        } else {
          Checker_error(receiver, Node_Expression(attributeDecl), Spread_types_may_only_be_created_from_object_types);
          if (typeToIntersect !== undefined) {
            typeToIntersect = Checker_getIntersectionType(receiver, [typeToIntersect, exprType]);
          } else {
            typeToIntersect = exprType;
          }
        }
      }
    }
    if (!hasSpreadAnyType && attributesTable.size !== 0) {
      spread = Checker_getSpreadType(receiver, spread, createJsxAttributesType(), attributesSymbol, objectFlags, false);
    }
  }
  const parentHasSemanticJsxChildren = (element: GoPtr<Node>): bool => {
    const parent = element!.Parent;
    if (parent === undefined) {
      return false;
    }
    let children: GoSlice<GoPtr<Node>> = [];
    if (IsJsxElement(parent)) {
      if (AsJsxElement(parent)!.OpeningElement === element) {
        children = Node_Children(parent)!.Nodes;
      }
    } else if (IsJsxFragment(parent)) {
      if (AsJsxFragment(parent)!.OpeningFragment === element) {
        children = Node_Children(parent)!.Nodes;
      }
    }
    return GetSemanticJsxChildren(children).length !== 0;
  };
  if (parentHasSemanticJsxChildren(openingLikeElement)) {
    const childTypes = Checker_checkJsxChildren(receiver, openingLikeElement!.Parent, checkMode);
    if (!hasSpreadAnyType && jsxChildrenPropertyName !== InternalSymbolNameMissing && jsxChildrenPropertyName !== "") {
      if (explicitlySpecifyChildrenAttribute) {
        Checker_error(receiver, attributeParent, X_0_are_specified_twice_The_attribute_named_0_will_be_overwritten, jsxChildrenPropertyName);
      }
      let childrenContextualType: GoPtr<Type>;
      if (IsJsxOpeningElement(openingLikeElement)) {
        const contextualType = Checker_getApparentTypeOfContextualType(receiver, Node_Attributes(openingLikeElement), ContextFlagsNone);
        if (contextualType !== undefined) {
          childrenContextualType = Checker_getTypeOfPropertyOfContextualType(receiver, contextualType, jsxChildrenPropertyName);
        }
      }
      const childrenPropSymbol = Checker_newSymbol(receiver, SymbolFlagsProperty, jsxChildrenPropertyName);
      const links = LinkStore_Get(receiver!.valueSymbolLinks, childrenPropSymbol) as GoPtr<ValueSymbolLinks>;
      if (childTypes.length === 1) {
        links!.resolvedType = childTypes[0];
      } else if (childrenContextualType !== undefined && someType(childrenContextualType, (candidate) => Checker_isTupleLikeType(receiver, candidate))) {
        links!.resolvedType = Checker_createTupleType(receiver, childTypes);
      } else {
        links!.resolvedType = Checker_createArrayType(receiver, Checker_getUnionType(receiver, childTypes));
      }
      childrenPropSymbol!.ValueDeclaration = NewPropertySignatureDeclaration(receiver!.factory, undefined, NewIdentifier(receiver!.factory, jsxChildrenPropertyName), undefined, undefined, undefined);
      childrenPropSymbol!.ValueDeclaration!.Parent = attributeParent;
      (Node_DeclarationData(childrenPropSymbol!.ValueDeclaration) as unknown as { Symbol?: GoPtr<Symbol> }).Symbol = childrenPropSymbol;
      const childPropMap: SymbolTable = new globalThis.Map();
      childPropMap.set(jsxChildrenPropertyName, childrenPropSymbol);
      spread = Checker_getSpreadType(
        receiver,
        spread,
        Checker_newAnonymousType(receiver, attributesSymbol, childPropMap, [], [], []),
        attributesSymbol,
        (objectFlags | Checker_getPropagatingFlagsOfTypes(receiver, childTypes, TypeFlagsNone)) as ObjectFlags,
        false,
      );
    }
  }
  if (hasSpreadAnyType) {
    return receiver!.anyType;
  }
  if (typeToIntersect !== undefined) {
    if (spread !== receiver!.emptyJsxObjectType) {
      return Checker_getIntersectionType(receiver, [typeToIntersect, spread]);
    }
    return typeToIntersect;
  }
  if (spread === receiver!.emptyJsxObjectType) {
    return createJsxAttributesType();
  }
  return spread;
}

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
export function Checker_checkJsxAttribute(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  if (Node_Initializer(node) !== undefined) {
    return Checker_checkExpressionForMutableLocation(receiver, Node_Initializer(node), checkMode);
  }
  // <Elem attr /> is sugar for <Elem attr={true} />
  return receiver!.trueType;
}

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
export function Checker_checkJsxChildren(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoSlice<GoPtr<Type>> {
  const childTypes: GoSlice<GoPtr<Type>> = [];
  for (const child of Node_Children(node)!.Nodes) {
    // In React, JSX text that contains only whitespaces will be ignored so we don't want to type-check that
    // because then type of children property will have constituent of string type.
    if (IsJsxText(child)) {
      if (!AsJsxText(child)!.ContainsOnlyTriviaWhiteSpaces) {
        childTypes.push(receiver!.stringType);
      }
    } else if (IsJsxExpression(child) && Node_Expression(child) === undefined) {
      // empty jsx expressions don't *really* count as present children
      continue;
    } else {
      childTypes.push(Checker_checkExpressionForMutableLocation(receiver, child, checkMode));
    }
  }
  return childTypes;
}

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
export function Checker_getUninstantiatedJsxSignaturesOfType(receiver: GoPtr<Checker>, elementType: GoPtr<Type>, caller: GoPtr<Node>): GoSlice<GoPtr<Signature>> {
  if ((elementType!.flags & TypeFlagsString) !== 0) {
    return [receiver!.anySignature];
  }
  if ((elementType!.flags & TypeFlagsStringLiteral) !== 0) {
    const intrinsicType = Checker_getIntrinsicAttributesTypeFromStringLiteralType(receiver, elementType, caller);
    if (intrinsicType === undefined) {
      Checker_error(receiver, caller, Property_0_does_not_exist_on_type_1, getStringLiteralValue(elementType), `JSX.${JsxNames.IntrinsicElements}`);
      return [];
    }
    const fakeSignature = Checker_createSignatureForJSXIntrinsic(receiver, caller, intrinsicType);
    return [fakeSignature];
  }
  const apparentElemType = Checker_getApparentType(receiver, elementType);
  // Resolve the signatures, preferring constructor
  let signatures = Checker_getSignaturesOfType(receiver, apparentElemType, SignatureKindConstruct);
  if (signatures.length === 0) {
    // No construct signatures, try call signatures
    signatures = Checker_getSignaturesOfType(receiver, apparentElemType, SignatureKindCall);
  }
  if (signatures.length === 0 && (apparentElemType!.flags & TypeFlagsUnion) !== 0) {
    // If each member has some combination of new/call signatures; make a union signature list for those
    signatures = Checker_getUnionSignatures(receiver, Map(Type_Types(apparentElemType), (t: GoPtr<Type>): GoSlice<GoPtr<Signature>> => {
      return Checker_getUninstantiatedJsxSignaturesOfType(receiver, t, caller);
    }));
  }
  return signatures;
}

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
export function Checker_getEffectiveFirstArgumentForJsxSignature(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, node: GoPtr<Node>): GoPtr<Type> {
  if (IsJsxOpeningFragment(node) || Checker_getJsxReferenceKind(receiver, node) !== JsxReferenceKindComponent) {
    return Checker_getJsxPropsTypeFromCallSignature(receiver, signature, node);
  }
  return Checker_getJsxPropsTypeFromClassType(receiver, signature, node);
}

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
export function Checker_getJsxPropsTypeFromCallSignature(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, context: GoPtr<Node>): GoPtr<Type> {
  let propsType = Checker_getTypeOfFirstParameterOfSignatureWithFallback(receiver, sig, receiver!.unknownType);
  propsType = Checker_getJsxManagedAttributesFromLocatedAttributes(receiver, context, Checker_getJsxNamespaceAt(receiver, context), propsType);
  const intrinsicAttribs = Checker_getJsxType(receiver, JsxNames.IntrinsicAttributes, context);
  if (!Checker_isErrorType(receiver, intrinsicAttribs)) {
    propsType = Checker_intersectTypes(receiver, intrinsicAttribs, propsType);
  }
  return propsType;
}

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
export function Checker_getJsxPropsTypeFromClassType(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, context: GoPtr<Node>): GoPtr<Type> {
  const ns = Checker_getJsxNamespaceAt(receiver, context);
  const forcedLookupLocation = Checker_getJsxElementPropertiesName(receiver, ns);
  let attributesType: GoPtr<Type>;
  if (forcedLookupLocation === InternalSymbolNameMissing) {
    attributesType = Checker_getTypeOfFirstParameterOfSignatureWithFallback(receiver, sig, receiver!.unknownType);
  } else if (forcedLookupLocation === "") {
    attributesType = Checker_getReturnTypeOfSignature(receiver, sig);
  } else {
    attributesType = Checker_getJsxPropsTypeForSignatureFromMember(receiver, sig, forcedLookupLocation);
    if (attributesType === undefined && (Node_Properties(Node_Attributes(context))?.length ?? 0) !== 0) {
      // There is no property named 'props' on this instance type
      Checker_error(receiver, context, JSX_element_class_does_not_support_attributes_because_it_does_not_have_a_0_property, forcedLookupLocation);
    }
  }
  if (attributesType === undefined) {
    return receiver!.unknownType;
  }
  attributesType = Checker_getJsxManagedAttributesFromLocatedAttributes(receiver, context, ns, attributesType);
  if (IsTypeAny(attributesType)) {
    // Props is of type 'any' or unknown
    return attributesType;
  }
  // Normal case -- add in IntrinsicClassAttributes<T> and IntrinsicAttributes
  let apparentAttributesType = attributesType;
  const intrinsicClassAttribs = Checker_getJsxType(receiver, JsxNames.IntrinsicClassAttributes, context);
  if (!Checker_isErrorType(receiver, intrinsicClassAttribs)) {
    const typeParams = Checker_getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(receiver, intrinsicClassAttribs!.symbol);
    const hostClassType = Checker_getReturnTypeOfSignature(receiver, sig);
    let libraryManagedAttributeType: GoPtr<Type>;
    if (typeParams !== undefined && typeParams.length > 0) {
      // apply JSX.IntrinsicClassAttributes<hostClassType, ...>
      const inferredArgs = Checker_fillMissingTypeArguments(receiver, [hostClassType], typeParams, Checker_getMinTypeArgumentCount(receiver, typeParams), IsInJSFile(context));
      libraryManagedAttributeType = Checker_instantiateType(receiver, intrinsicClassAttribs, newTypeMapper(typeParams, inferredArgs));
    } else {
      libraryManagedAttributeType = intrinsicClassAttribs;
    }
    apparentAttributesType = Checker_intersectTypes(receiver, libraryManagedAttributeType, apparentAttributesType);
  }
  const intrinsicAttribs = Checker_getJsxType(receiver, JsxNames.IntrinsicAttributes, context);
  if (!Checker_isErrorType(receiver, intrinsicAttribs)) {
    apparentAttributesType = Checker_intersectTypes(receiver, intrinsicAttribs, apparentAttributesType);
  }
  return apparentAttributesType;
}

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
export function Checker_getJsxPropsTypeForSignatureFromMember(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, forcedLookupLocation: string): GoPtr<Type> {
  if (sig!.composite !== undefined) {
    // JSX Elements using the legacy `props`-field based lookup (eg, react class components) need to treat the `props` member as an input
    // instead of an output position when resolving the signature. We need to go back to the input signatures of the composite signature,
    // get the type of `props` on each return type individually, and then _intersect them_, rather than union them (as would normally occur
    // for a union signature). It's an unfortunate quirk of looking in the output of the signature for the type we want to use for the input.
    // The default behavior of `getTypeOfFirstParameterOfSignatureWithFallback` when no `props` member name is defined is much more sane.
    const results: GoPtr<Type>[] = [];
    for (const signature of sig!.composite!.signatures) {
      const instance = Checker_getReturnTypeOfSignature(receiver, signature);
      if (IsTypeAny(instance)) {
        return instance;
      }
      const propType = Checker_getTypeOfPropertyOfType(receiver, instance, forcedLookupLocation);
      if (propType === undefined) {
        return undefined;
      }
      results.push(propType);
    }
    return Checker_getIntersectionType(receiver, results);
    // Same result for both union and intersection signatures
  }
  const instanceType = Checker_getReturnTypeOfSignature(receiver, sig);
  if (IsTypeAny(instanceType)) {
    return instanceType;
  }
  return Checker_getTypeOfPropertyOfType(receiver, instanceType, forcedLookupLocation);
}

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
export function Checker_getJsxManagedAttributesFromLocatedAttributes(receiver: GoPtr<Checker>, context: GoPtr<Node>, ns: GoPtr<Symbol>, attributesType: GoPtr<Type>): GoPtr<Type> {
  const managedSym = Checker_getJsxLibraryManagedAttributes(receiver, ns);
  if (managedSym !== undefined) {
    const ctorType = Checker_getStaticTypeOfReferencedJsxConstructor(receiver, context);
    const result = Checker_instantiateAliasOrInterfaceWithDefaults(receiver, managedSym, [ctorType, attributesType], IsInJSFile(context));
    if (result !== undefined) {
      return result;
    }
  }
  return attributesType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.instantiateAliasOrInterfaceWithDefaults","kind":"method","status":"implemented","sigHash":"2c5fb9ea101c19494e0b3f14fb32b8b0a3c40082f874baa2a32245863d47095b","bodyHash":"8a9a97e23d16a68bd1d09d4ed2704c418ea1bac3cd4e5c0a46afec447bce67a2"}
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
 * 	if len(declaredManagedType.AsInterfaceType().TypeParameters()) >= len(typeArguments) {
 * 		args := c.fillMissingTypeArguments(typeArguments, declaredManagedType.AsInterfaceType().TypeParameters(), len(typeArguments), inJavaScript)
 * 		return c.createTypeReference(declaredManagedType, args)
 * 	}
 * 	return nil
 * }
 */
export function Checker_instantiateAliasOrInterfaceWithDefaults(receiver: GoPtr<Checker>, managedSym: GoPtr<Symbol>, typeArguments: GoSlice<GoPtr<Type>>, inJavaScript: bool): GoPtr<Type> {
  const declaredManagedType = Checker_getDeclaredTypeOfSymbol(receiver, managedSym);
  // fetches interface type, or initializes symbol links type parameters
  if (managedSym!.Flags & SymbolFlagsTypeAlias) {
    const params = (LinkStore_Get(receiver!.typeAliasLinks, managedSym) as GoPtr<TypeAliasLinks>)!.typeParameters;
    // Go len(nil) == 0: a non-generic alias has a nil typeParameters slice.
    if ((params ?? []).length >= typeArguments.length) {
      const args = Checker_fillMissingTypeArguments(receiver, typeArguments, params, typeArguments.length, inJavaScript);
      if (args.length === 0) {
        return declaredManagedType;
      }
      return Checker_getTypeAliasInstantiation(receiver, managedSym, args, undefined);
    }
  }
  if (InterfaceType_TypeParameters(Type_AsInterfaceType(declaredManagedType)).length >= typeArguments.length) {
    const args = Checker_fillMissingTypeArguments(receiver, typeArguments, InterfaceType_TypeParameters(Type_AsInterfaceType(declaredManagedType)), typeArguments.length, inJavaScript);
    return Checker_createTypeReference(receiver, declaredManagedType, args);
  }
  return undefined;
}

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
export function Checker_getJsxLibraryManagedAttributes(receiver: GoPtr<Checker>, jsxNamespace: GoPtr<Symbol>): GoPtr<Symbol> {
  if (jsxNamespace !== undefined) {
    return Checker_getSymbol(receiver, jsxNamespace!.Exports as SymbolTable, JsxNames.LibraryManagedAttributes, SymbolFlagsType);
  }
  return undefined;
}

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
export function Checker_getJsxElementTypeSymbol(receiver: GoPtr<Checker>, jsxNamespace: GoPtr<Symbol>): GoPtr<Symbol> {
  if (jsxNamespace !== undefined) {
    return Checker_getSymbol(receiver, jsxNamespace!.Exports as SymbolTable, JsxNames.ElementType, SymbolFlagsType);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxElementPropertiesName","kind":"method","status":"implemented","sigHash":"7af944361b07b95426e6d76d8de7c102d44a94b013868d82976b1dbc48e44b39","bodyHash":"6859cef2c9e5f0082b1d6aa9f286ec38e08309d430d300a65fcc208237790798"}
 *
 * Go source:
 * func (c *Checker) getJsxElementPropertiesName(jsxNamespace *ast.Symbol) string {
 * 	return c.getNameFromJsxElementAttributesContainer(JsxNames.ElementAttributesPropertyNameContainer, jsxNamespace)
 * }
 */
export function Checker_getJsxElementPropertiesName(receiver: GoPtr<Checker>, jsxNamespace: GoPtr<Symbol>): string {
  return Checker_getNameFromJsxElementAttributesContainer(receiver, JsxNames.ElementAttributesPropertyNameContainer, jsxNamespace);
}

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
export function Checker_getJsxElementChildrenPropertyName(receiver: GoPtr<Checker>, jsxNamespace: GoPtr<Symbol>): string {
  if (receiver!.compilerOptions!.Jsx === JsxEmitReactJSX || receiver!.compilerOptions!.Jsx === JsxEmitReactJSXDev) {
    return "children";
  }
  return Checker_getNameFromJsxElementAttributesContainer(receiver, JsxNames.ElementChildrenAttributeNameContainer, jsxNamespace);
}

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
export function Checker_getNameFromJsxElementAttributesContainer(receiver: GoPtr<Checker>, nameOfAttribPropContainer: string, jsxNamespace: GoPtr<Symbol>): string {
  if (jsxNamespace !== undefined) {
    const jsxElementAttribPropInterfaceSym = Checker_getSymbol(receiver, jsxNamespace!.Exports as SymbolTable, nameOfAttribPropContainer, SymbolFlagsType);
    if (jsxElementAttribPropInterfaceSym !== undefined) {
      const jsxElementAttribPropInterfaceType = Checker_getDeclaredTypeOfSymbol(receiver, jsxElementAttribPropInterfaceSym);
      const propertiesOfJsxElementAttribPropInterface = Checker_getPropertiesOfType(receiver, jsxElementAttribPropInterfaceType);
      if (propertiesOfJsxElementAttribPropInterface!.length === 0) {
        return "";
      }
      if (propertiesOfJsxElementAttribPropInterface!.length === 1) {
        return propertiesOfJsxElementAttribPropInterface![0]!.Name;
      }
      if (propertiesOfJsxElementAttribPropInterface!.length > 1 && jsxElementAttribPropInterfaceSym!.Declarations !== undefined && jsxElementAttribPropInterfaceSym!.Declarations!.length !== 0) {
        Checker_error(receiver, jsxElementAttribPropInterfaceSym!.Declarations![0], The_global_type_JSX_0_may_not_have_more_than_one_property, nameOfAttribPropContainer);
      }
    }
  }
  return InternalSymbolNameMissing;
}

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
export function Checker_getStaticTypeOfReferencedJsxConstructor(receiver: GoPtr<Checker>, context: GoPtr<Node>): GoPtr<Type> {
  if (IsJsxOpeningFragment(context)) {
    return Checker_getJSXFragmentType(receiver, context);
  }
  if (isJsxIntrinsicTagName(Node_TagName(context))) {
    const result = Checker_getIntrinsicAttributesTypeFromJsxOpeningLikeElement(receiver, context);
    const fakeSignature = Checker_createSignatureForJSXIntrinsic(receiver, context, result);
    return Checker_getOrCreateTypeFromSignature(receiver, fakeSignature);
  }
  const tagType = Checker_checkExpressionCached(receiver, Node_TagName(context));
  if (tagType!.flags & TypeFlagsStringLiteral) {
    const result = Checker_getIntrinsicAttributesTypeFromStringLiteralType(receiver, tagType, context);
    if (result === undefined) {
      return receiver!.errorType;
    }
    const fakeSignature = Checker_createSignatureForJSXIntrinsic(receiver, context, result);
    return Checker_getOrCreateTypeFromSignature(receiver, fakeSignature);
  }
  return tagType;
}

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
export function Checker_getIntrinsicAttributesTypeFromStringLiteralType(receiver: GoPtr<Checker>, t: GoPtr<Type>, location: GoPtr<Node>): GoPtr<Type> {
  const intrinsicElementsType = Checker_getJsxType(receiver, JsxNames.IntrinsicElements, location);
  if (!Checker_isErrorType(receiver, intrinsicElementsType)) {
    const stringLiteralTypeName = getStringLiteralValue(t);
    const intrinsicProp = Checker_getPropertyOfType(receiver, intrinsicElementsType, stringLiteralTypeName);
    if (intrinsicProp !== undefined) {
      return Checker_getTypeOfSymbol(receiver, intrinsicProp);
    }
    const indexSignatureType = Checker_getIndexTypeOfType(receiver, intrinsicElementsType, receiver!.stringType);
    if (indexSignatureType !== undefined) {
      return indexSignatureType;
    }
    return undefined;
  }
  return receiver!.anyType;
}

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
export function Checker_getJsxReferenceKind(receiver: GoPtr<Checker>, node: GoPtr<Node>): JsxReferenceKind {
  if (isJsxIntrinsicTagName(Node_TagName(node))) {
    return JsxReferenceKindMixed;
  }
  const tagType = Checker_getApparentType(receiver, Checker_checkExpression(receiver, Node_TagName(node)));
  if (Checker_getSignaturesOfType(receiver, tagType, SignatureKindConstruct).length !== 0) {
    return JsxReferenceKindComponent;
  }
  if (Checker_getSignaturesOfType(receiver, tagType, SignatureKindCall).length !== 0) {
    return JsxReferenceKindFunction;
  }
  return JsxReferenceKindMixed;
}

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
export function Checker_createSignatureForJSXIntrinsic(receiver: GoPtr<Checker>, node: GoPtr<Node>, result: GoPtr<Type>): GoPtr<Signature> {
  let elementType = receiver!.errorType;
  const namespace = Checker_getJsxNamespaceAt(receiver, node);
  if (namespace !== undefined) {
    const typeSymbol = Checker_getSymbol(receiver, Checker_getExportsOfSymbol(receiver, namespace), JsxNames.Element, SymbolFlagsType);
    if (typeSymbol !== undefined) {
      elementType = Checker_getDeclaredTypeOfSymbol(receiver, typeSymbol);
    }
  }
  // returnNode := typeSymbol && c.nodeBuilder.symbolToEntityName(typeSymbol, ast.SymbolFlagsType, node)
  // declaration := factory.createFunctionTypeNode(...)
  const parameterSymbol = Checker_newSymbol(receiver, SymbolFlagsFunctionScopedVariable as SymbolFlags, "props");
  (LinkStore_Get(receiver!.valueSymbolLinks, parameterSymbol) as GoPtr<ValueSymbolLinks>)!.resolvedType = result;
  return Checker_newSignature(receiver, SignatureFlagsNone, undefined, [], undefined, [parameterSymbol], elementType, undefined, 1);
}

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
export function Checker_getIntrinsicAttributesTypeFromJsxOpeningLikeElement(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  // debug.Assert(isJsxIntrinsicTagName(node.TagName()))
  const links = LinkStore_Get(receiver!.jsxElementLinks, node) as GoPtr<JsxElementLinks>;
  if (links!.resolvedJsxElementAttributesType !== undefined) {
    return links!.resolvedJsxElementAttributesType;
  }
  const symbol = Checker_getIntrinsicTagSymbol(receiver, node);
  if (links!.jsxFlags & JsxFlagsIntrinsicNamedElement) {
    links!.resolvedJsxElementAttributesType = OrElse(Checker_getTypeOfSymbol(receiver, symbol), receiver!.errorType);
    return links!.resolvedJsxElementAttributesType;
  }
  if (links!.jsxFlags & JsxFlagsIntrinsicIndexedElement) {
    const indexInfo = Checker_getApplicableIndexInfoForName(receiver, Checker_getJsxType(receiver, JsxNames.IntrinsicElements, node), Node_Text(Node_TagName(node)));
    if (indexInfo !== undefined) {
      links!.resolvedJsxElementAttributesType = indexInfo!.valueType;
      return links!.resolvedJsxElementAttributesType;
    }
  }
  links!.resolvedJsxElementAttributesType = receiver!.errorType;
  return links!.resolvedJsxElementAttributesType;
}

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
export function Checker_getIntrinsicTagSymbol(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol> {
  const links = LinkStore_Get(receiver!.symbolNodeLinks, node) as GoPtr<SymbolNodeLinks>;
  if (links!.resolvedSymbol !== undefined) {
    return links!.resolvedSymbol;
  }
  const intrinsicElementsType = Checker_getJsxType(receiver, JsxNames.IntrinsicElements, node);
  if (!Checker_isErrorType(receiver, intrinsicElementsType)) {
    // Property case
    const tagName = Node_TagName(node);
    if (!IsIdentifier(tagName) && !IsJsxNamespacedName(tagName)) {
      throw new globalThis.Error("Invalid tag name");
    }
    const propName = Node_Text(tagName);
    const intrinsicProp = Checker_getPropertyOfType(receiver, intrinsicElementsType, propName);
    if (intrinsicProp !== undefined) {
      (LinkStore_Get(receiver!.jsxElementLinks, node) as GoPtr<JsxElementLinks>)!.jsxFlags |= JsxFlagsIntrinsicNamedElement;
      links!.resolvedSymbol = intrinsicProp;
      return links!.resolvedSymbol;
    }
    // Intrinsic string indexer case
    const indexSymbol = Checker_getApplicableIndexSymbol(receiver, intrinsicElementsType, Checker_getStringLiteralType(receiver, propName));
    if (indexSymbol !== undefined) {
      (LinkStore_Get(receiver!.jsxElementLinks, node) as GoPtr<JsxElementLinks>)!.jsxFlags |= JsxFlagsIntrinsicIndexedElement;
      links!.resolvedSymbol = indexSymbol;
      return links!.resolvedSymbol;
    }
    if (Checker_getTypeOfPropertyOrIndexSignatureOfType(receiver, intrinsicElementsType, propName) !== undefined) {
      (LinkStore_Get(receiver!.jsxElementLinks, node) as GoPtr<JsxElementLinks>)!.jsxFlags |= JsxFlagsIntrinsicIndexedElement;
      links!.resolvedSymbol = intrinsicElementsType!["symbol"];
      return links!.resolvedSymbol;
    }
    // Wasn't found
    Checker_error(receiver, node, Property_0_does_not_exist_on_type_1, Node_Text(tagName), "JSX." + JsxNames.IntrinsicElements);
    links!.resolvedSymbol = receiver!.unknownSymbol;
    return links!.resolvedSymbol;
  }
  if (receiver!.noImplicitAny) {
    Checker_error(receiver, node, JSX_element_implicitly_has_type_any_because_no_interface_JSX_0_exists, JsxNames.IntrinsicElements);
  }
  links!.resolvedSymbol = receiver!.unknownSymbol;
  return links!.resolvedSymbol;
}

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
export function Checker_getJsxStatelessElementTypeAt(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Type> {
  const jsxElementType = Checker_getJsxElementTypeAt(receiver, location);
  if (jsxElementType === undefined) {
    return undefined;
  }
  return Checker_getUnionType(receiver, [jsxElementType, receiver!.nullType]);
}

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
export function Checker_getJsxElementClassTypeAt(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Type> {
  const t = Checker_getJsxType(receiver, JsxNames.ElementClass, location);
  if (Checker_isErrorType(receiver, t)) {
    return undefined;
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJsxElementTypeAt","kind":"method","status":"implemented","sigHash":"d63e42785400ff1a4236db566fd27627f1479ab046d88ce32091178e0d7ff3c5","bodyHash":"2fab698e3c6ccd7df906d98d8a3a0214f0c39436c9a8c48822e36c5d3d31f7ea"}
 *
 * Go source:
 * func (c *Checker) getJsxElementTypeAt(location *ast.Node) *Type {
 * 	return c.getJsxType(JsxNames.Element, location)
 * }
 */
export function Checker_getJsxElementTypeAt(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Type> {
  return Checker_getJsxType(receiver, JsxNames.Element, location);
}

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
export function Checker_getJsxElementTypeTypeAt(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Type> {
  const ns = Checker_getJsxNamespaceAt(receiver, location);
  if (ns === undefined) {
    return undefined;
  }
  const sym = Checker_getJsxElementTypeSymbol(receiver, ns);
  if (sym === undefined) {
    return undefined;
  }
  const t = Checker_instantiateAliasOrInterfaceWithDefaults(receiver, sym, [], IsInJSFile(location));
  if (t === undefined || Checker_isErrorType(receiver, t)) {
    return undefined;
  }
  return t;
}

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
export function Checker_getJsxType(receiver: GoPtr<Checker>, name: string, location: GoPtr<Node>): GoPtr<Type> {
  const namespace = Checker_getJsxNamespaceAt(receiver, location);
  if (namespace !== undefined) {
    const exports = Checker_getExportsOfSymbol(receiver, namespace);
    if (exports !== undefined) {
      const typeSymbol = Checker_getSymbol(receiver, exports, name, SymbolFlagsType);
      if (typeSymbol !== undefined) {
        return Checker_getDeclaredTypeOfSymbol(receiver, typeSymbol);
      }
    }
  }
  return receiver!.errorType;
}

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
export function Checker_getJsxNamespaceAt(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Symbol> {
  let links: GoPtr<JsxElementLinks>;
  if (location !== undefined) {
    links = LinkStore_Get(receiver!.jsxElementLinks, location) as GoPtr<JsxElementLinks>;
  }
  if (links !== undefined && links!.jsxNamespace !== undefined && links!.jsxNamespace !== receiver!.unknownSymbol) {
    return links!.jsxNamespace;
  }
  if (links === undefined || links!.jsxNamespace !== receiver!.unknownSymbol) {
    let resolvedNamespace = Checker_getJsxNamespaceContainerForImplicitImport(receiver, location);
    if (resolvedNamespace === undefined || resolvedNamespace === receiver!.unknownSymbol) {
      const namespaceName = Checker_getJsxNamespace(receiver, location);
      resolvedNamespace = receiver!.resolveName(location, namespaceName, SymbolFlagsNamespace as SymbolFlags, undefined, false as bool, false as bool);
    }
    if (resolvedNamespace !== undefined) {
      const candidate = Checker_resolveSymbol(receiver, Checker_getSymbol(receiver, Checker_getExportsOfSymbol(receiver, Checker_resolveSymbol(receiver, resolvedNamespace)), JsxNames.JSX, SymbolFlagsNamespace));
      if (candidate !== undefined && candidate !== receiver!.unknownSymbol) {
        if (links !== undefined) {
          links!.jsxNamespace = candidate;
        }
        return candidate;
      }
    }
    if (links !== undefined) {
      links!.jsxNamespace = receiver!.unknownSymbol;
    }
  }
  // JSX global fallback
  const s = Checker_resolveSymbol(receiver, Checker_getGlobalSymbol(receiver, JsxNames.JSX, SymbolFlagsNamespace, undefined));
  if (s === receiver!.unknownSymbol) {
    return undefined;
  }
  return s;
}

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
export function Checker_getJsxNamespace(receiver: GoPtr<Checker>, location: GoPtr<Node>): string {
  if (location !== undefined) {
    const file = GetSourceFileOfNode(location);
    if (file !== undefined) {
      const links = Checker_getSourceFileLinks(receiver, file);
      if (IsJsxOpeningFragment(location)) {
        if (links!.localJsxFragmentNamespace !== "") {
          return links!.localJsxFragmentNamespace;
        }
        const jsxFragmentPragma = GetPragmaFromSourceFile(file, "jsxfrag");
        if (jsxFragmentPragma !== undefined) {
          links!.localJsxFragmentFactory = Checker_parseIsolatedEntityName(receiver, GetPragmaArgument(jsxFragmentPragma, "factory")) as GoPtr<EntityName>;
          if (links!.localJsxFragmentFactory !== undefined) {
            links!.localJsxFragmentNamespace = Node_Text(GetFirstIdentifier(links!.localJsxFragmentFactory));
            return links!.localJsxFragmentNamespace;
          }
        }
        const entity = Checker_getJsxFragmentFactoryEntity(receiver, location);
        if (entity !== undefined) {
          links!.localJsxFragmentFactory = entity;
          links!.localJsxFragmentNamespace = Node_Text(GetFirstIdentifier(entity));
          return links!.localJsxFragmentNamespace;
        }
      } else {
        const localJsxNamespace = Checker_getLocalJsxNamespace(receiver, file);
        if (localJsxNamespace !== "") {
          links!.localJsxNamespace = localJsxNamespace;
          return links!.localJsxNamespace;
        }
      }
    }
  }
  if (receiver!._jsxNamespace === "") {
    receiver!._jsxNamespace = "React";
    if (receiver!.compilerOptions!.JsxFactory !== "") {
      receiver!._jsxFactoryEntity = Checker_parseIsolatedEntityName(receiver, receiver!.compilerOptions!.JsxFactory);
      if (receiver!._jsxFactoryEntity !== undefined) {
        receiver!._jsxNamespace = Node_Text(GetFirstIdentifier(receiver!._jsxFactoryEntity));
      }
    } else if (receiver!.compilerOptions!.ReactNamespace !== "") {
      receiver!._jsxNamespace = receiver!.compilerOptions!.ReactNamespace;
    }
  }
  if (receiver!._jsxFactoryEntity === undefined) {
    receiver!._jsxFactoryEntity = NewQualifiedName(receiver!.factory, NewIdentifier(receiver!.factory, receiver!._jsxNamespace) as GoPtr<EntityName>, NewIdentifier(receiver!.factory, "createElement"));
  }
  return receiver!._jsxNamespace;
}

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
export function Checker_getLocalJsxNamespace(receiver: GoPtr<Checker>, file: GoPtr<SourceFile>): string {
  const links = Checker_getSourceFileLinks(receiver, file);
  if (links!.localJsxNamespace !== "") {
    return links!.localJsxNamespace;
  }
  const jsxPragma = GetPragmaFromSourceFile(file, "jsx");
  if (jsxPragma !== undefined) {
    links!.localJsxFactory = Checker_parseIsolatedEntityName(receiver, GetPragmaArgument(jsxPragma, "factory"));
    if (links!.localJsxFactory !== undefined) {
      links!.localJsxNamespace = Node_Text(GetFirstIdentifier(links!.localJsxFactory));
      return links!.localJsxNamespace;
    }
  }
  return "";
}

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
export function Checker_getJsxFactoryEntity(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Node> {
  if (location !== undefined) {
    Checker_getJsxNamespace(receiver, location);
    const localJsxFactory = Checker_getSourceFileLinks(receiver, GetSourceFileOfNode(location))!.localJsxFactory;
    if (localJsxFactory !== undefined) {
      return localJsxFactory;
    }
  }
  return receiver!._jsxFactoryEntity;
}

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
export function Checker_getJsxFragmentFactoryEntity(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<EntityName> {
  if (location !== undefined) {
    const file = GetSourceFileOfNode(location);
    if (file !== undefined) {
      const links = Checker_getSourceFileLinks(receiver, file);
      if (links!.localJsxFragmentFactory !== undefined) {
        return links!.localJsxFragmentFactory;
      }
      const jsxFragPragma = GetPragmaFromSourceFile(file, "jsxfrag");
      if (jsxFragPragma !== undefined) {
        links!.localJsxFragmentFactory = Checker_parseIsolatedEntityName(receiver, GetPragmaArgument(jsxFragPragma, "factory")) as GoPtr<EntityName>;
        return links!.localJsxFragmentFactory;
      }
    }
  }
  if (receiver!.compilerOptions!.JsxFragmentFactory !== "") {
    return Checker_parseIsolatedEntityName(receiver, receiver!.compilerOptions!.JsxFragmentFactory) as GoPtr<EntityName>;
  }
  return undefined;
}

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
export function Checker_parseIsolatedEntityName(receiver: GoPtr<Checker>, name: string): GoPtr<Node> {
  const result = ParseIsolatedEntityName(name);
  if (result !== undefined) {
    markAsSynthetic(result);
  }
  return result;
}

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
export function markAsSynthetic(node: GoPtr<Node>): bool {
  node!.Loc = NewTextRange(-1, -1);
  Node_ForEachChild(node, markAsSynthetic);
  return false as bool;
}

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
export function Checker_getJsxNamespaceContainerForImplicitImport(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Symbol> {
  let file: GoPtr<SourceFile>;
  let links: GoPtr<JsxElementLinks>;
  if (location !== undefined) {
    file = GetSourceFileOfNode(location);
    if (file !== undefined) {
      links = LinkStore_Get(receiver!.jsxElementLinks, file as GoPtr<Node>) as GoPtr<JsxElementLinks>;
    }
  }
  if (links !== undefined && links!.jsxImplicitImportContainer !== undefined) {
    return IfElse(links!.jsxImplicitImportContainer === receiver!.unknownSymbol, undefined, links!.jsxImplicitImportContainer);
  }
  const [moduleReference, specifier] = Checker_getJSXRuntimeImportSpecifier(receiver, file);
  if (moduleReference === "") {
    return undefined;
  }
  const errorMessage = This_JSX_tag_requires_the_module_path_0_to_exist_but_none_could_be_found_Make_sure_you_have_types_for_the_appropriate_package_installed;
  const mod = Checker_resolveExternalModule(receiver, OrElse(specifier, location), moduleReference, errorMessage, location, false as bool);
  let result: GoPtr<Symbol>;
  if (mod !== undefined && mod !== receiver!.unknownSymbol) {
    result = Checker_getMergedSymbol(receiver, Checker_resolveSymbol(receiver, mod));
  }
  if (links !== undefined) {
    links!.jsxImplicitImportContainer = OrElse(result, receiver!.unknownSymbol);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsx.go::method::Checker.getJSXRuntimeImportSpecifier","kind":"method","status":"implemented","sigHash":"099c021238c98a63ca106641b947a8b3943e9cbe7cc725526df50576f98342b0","bodyHash":"083244663a6a40269a7ed0e581687e8ab77167027a11c3c266602bb4e20159ab"}
 *
 * Go source:
 * func (c *Checker) getJSXRuntimeImportSpecifier(file *ast.SourceFile) (moduleReference string, specifier *ast.Node) {
 * 	return c.program.GetJSXRuntimeImportSpecifier(file.Path())
 * }
 */
export function Checker_getJSXRuntimeImportSpecifier(receiver: GoPtr<Checker>, file: GoPtr<SourceFile>): [string, GoPtr<Node>] {
  return receiver!.program.GetJSXRuntimeImportSpecifier(SourceFile_Path(file));
}
