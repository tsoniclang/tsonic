import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Node, NodeList } from "../../ast/spine.js";
import type { BinaryExpression } from "../../ast/generated/data.js";
import type { Declaration } from "../../ast/generated/unions.js";
import type { Kind } from "../../ast/generated/kinds.js";
import type { Symbol } from "../../ast/symbol.js";
import type { Type, TypeFlags } from "../types.js";
import type { AssignmentKind } from "../utilities.js";
import type { Checker, CheckMode } from "./state.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkInheritedPropertiesAreIdentical","kind":"method","status":"implemented","sigHash":"2cfdd4534d57cdaa28eedef2c8073db14c95a2a1a0272411d5330d0b99cd43bc","bodyHash":"a2bfcbf871d67df8aa0e9343ba29c3d6446fc3fa9134814f54f111036d6c2a81"}
 *
 * Go source:
 * func (c *Checker) checkInheritedPropertiesAreIdentical(t *Type, typeNode *ast.Node) bool {
 * 	baseTypes := c.getBaseTypes(t)
 * 	if len(baseTypes) < 2 {
 * 		return true
 * 	}
 * 	seen := make(map[string]InheritanceInfo)
 * 	for id, p := range c.resolveDeclaredMembers(t).declaredMembers {
 * 		if c.isNamedMember(p, id) {
 * 			seen[p.Name] = InheritanceInfo{prop: p, containingType: t}
 * 		}
 * 	}
 * 	identical := true
 * 	for _, base := range baseTypes {
 * 		properties := c.getPropertiesOfType(c.getTypeWithThisArgument(base, t.AsInterfaceType().thisType, false))
 * 		for _, prop := range properties {
 * 			if existing, ok := seen[prop.Name]; !ok {
 * 				seen[prop.Name] = InheritanceInfo{prop: prop, containingType: base}
 * 			} else {
 * 				isInheritedProperty := existing.containingType != t
 * 				if isInheritedProperty && !c.isPropertyIdenticalTo(existing.prop, prop) {
 * 					identical = false
 * 					typeName1 := c.TypeToString(existing.containingType)
 * 					typeName2 := c.TypeToString(base)
 * 					errorInfo := NewDiagnosticForNode(typeNode, diagnostics.Named_property_0_of_types_1_and_2_are_not_identical, c.symbolToString(prop), typeName1, typeName2)
 * 					c.diagnostics.Add(ast.NewDiagnosticChain(errorInfo, diagnostics.Interface_0_cannot_simultaneously_extend_types_1_and_2, c.TypeToString(t), typeName1, typeName2))
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return identical
 * }
 */
export declare function Checker_checkInheritedPropertiesAreIdentical(receiver: GoPtr<Checker>, t: GoPtr<Type>, typeNode: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isPropertyIdenticalTo","kind":"method","status":"implemented","sigHash":"578bd58756cb448b6d4f02d3f72beb3a6bcf54392f9e12fcc782e0481b453676","bodyHash":"eda6ce5e33399402099106e8ab0c3b954a688591baa557fbb0d9fb9bd2f7d83a"}
 *
 * Go source:
 * func (c *Checker) isPropertyIdenticalTo(sourceProp *ast.Symbol, targetProp *ast.Symbol) bool {
 * 	return c.compareProperties(sourceProp, targetProp, c.compareTypesIdentical) != TernaryFalse
 * }
 */
export declare function Checker_isPropertyIdenticalTo(receiver: GoPtr<Checker>, sourceProp: GoPtr<Symbol>, targetProp: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExportAssignment","kind":"method","status":"implemented","sigHash":"8647fcd90827c72b016ee65ada58aaafe1d46e8fd192af5b230196c7b153d0cd","bodyHash":"d10973e150e0cd073a9a726b3105993702e07d479cd80546521445b2db081868"}
 *
 * Go source:
 * func (c *Checker) checkExportAssignment(node *ast.Node) {
 * 	isExportEquals := node.AsExportAssignment().IsExportEquals
 * 	illegalContextMessage := core.IfElse(isExportEquals,
 * 		diagnostics.An_export_assignment_must_be_at_the_top_level_of_a_file_or_module_declaration,
 * 		diagnostics.A_default_export_must_be_at_the_top_level_of_a_file_or_module_declaration)
 * 	if c.checkGrammarModuleElementContext(node, illegalContextMessage) {
 * 		return // If we hit an export assignment in an illegal context, just bail out to avoid cascading errors.
 * 	}
 * 	if c.shouldCheckErasableSyntax(node) && node.AsExportAssignment().IsExportEquals && node.Flags&ast.NodeFlagsAmbient == 0 {
 * 		c.error(node, diagnostics.This_syntax_is_not_allowed_when_erasableSyntaxOnly_is_enabled)
 * 	}
 * 	container := node.Parent
 * 	if !ast.IsSourceFile(container) {
 * 		container = container.Parent
 * 	}
 * 	if ast.IsModuleDeclaration(container) && !ast.IsAmbientModule(container) {
 * 		// TODO(danielr): should these be grammar errors?
 * 		if isExportEquals {
 * 			c.error(node, diagnostics.An_export_assignment_cannot_be_used_in_a_namespace)
 * 		} else {
 * 			c.error(node, diagnostics.A_default_export_can_only_be_used_in_an_ECMAScript_style_module)
 * 		}
 * 		return
 * 	}
 * 	if !c.checkGrammarModifiers(node) && ast.IsExportAssignment(node) && node.AsExportAssignment().Modifiers() != nil {
 * 		c.grammarErrorOnFirstToken(node, diagnostics.An_export_assignment_cannot_have_modifiers)
 * 	}
 * 	isIllegalExportDefaultInCJS := !isExportEquals && node.Flags&ast.NodeFlagsAmbient == 0 && c.compilerOptions.VerbatimModuleSyntax.IsTrue() && c.program.GetEmitModuleFormatOfFile(ast.GetSourceFileOfNode(node)) == core.ModuleKindCommonJS
 * 	if ast.IsIdentifier(node.Expression()) {
 * 		id := node.Expression()
 * 		sym := c.getExportSymbolOfValueSymbolIfExported(c.resolveEntityName(id, ast.SymbolFlagsAll, true /*ignoreErrors* /, true /*dontResolveAlias* /, node))
 * 		if sym != nil {
 * 			c.markLinkedReferences(node, ReferenceHintExportAssignment, nil, nil)
 * 			typeOnlyDeclaration := c.getTypeOnlyAliasDeclarationEx(sym, ast.SymbolFlagsValue)
 * 			// If not a value, we're interpreting the identifier as a type export, along the lines of (`export { Id as default }`)
 * 			if c.getSymbolFlags(sym)&ast.SymbolFlagsValue != 0 {
 * 				// However if it is a value, we need to check it's being used correctly
 * 				c.checkExpressionCached(id)
 * 				if !isIllegalExportDefaultInCJS && node.Flags&ast.NodeFlagsAmbient == 0 && c.compilerOptions.VerbatimModuleSyntax.IsTrue() && typeOnlyDeclaration != nil {
 * 					message := core.IfElse(isExportEquals,
 * 						diagnostics.An_export_declaration_must_reference_a_real_value_when_verbatimModuleSyntax_is_enabled_but_0_resolves_to_a_type_only_declaration,
 * 						diagnostics.An_export_default_must_reference_a_real_value_when_verbatimModuleSyntax_is_enabled_but_0_resolves_to_a_type_only_declaration)
 * 					c.error(id, message, id.Text())
 * 				}
 * 			} else if !isIllegalExportDefaultInCJS && node.Flags&ast.NodeFlagsAmbient == 0 && c.compilerOptions.VerbatimModuleSyntax.IsTrue() {
 * 				message := core.IfElse(isExportEquals,
 * 					diagnostics.An_export_declaration_must_reference_a_value_when_verbatimModuleSyntax_is_enabled_but_0_only_refers_to_a_type,
 * 					diagnostics.An_export_default_must_reference_a_value_when_verbatimModuleSyntax_is_enabled_but_0_only_refers_to_a_type)
 * 				c.error(id, message, id.Text())
 * 			}
 * 			if !isIllegalExportDefaultInCJS && node.Flags&ast.NodeFlagsAmbient == 0 && c.compilerOptions.GetIsolatedModules() && sym.Flags&ast.SymbolFlagsValue == 0 {
 * 				nonLocalMeanings := c.getSymbolFlagsEx(sym, false /*excludeTypeOnlyMeanings* /, true /*excludeLocalMeanings* /)
 * 				if sym.Flags&ast.SymbolFlagsAlias != 0 && nonLocalMeanings&ast.SymbolFlagsType != 0 && nonLocalMeanings&ast.SymbolFlagsValue == 0 && (typeOnlyDeclaration == nil || ast.GetSourceFileOfNode(typeOnlyDeclaration) != ast.GetSourceFileOfNode(node)) {
 * 					// import { SomeType } from "./someModule";
 * 					// export default SomeType; OR
 * 					// export = SomeType;
 * 					message := core.IfElse(isExportEquals,
 * 						diagnostics.X_0_resolves_to_a_type_and_must_be_marked_type_only_in_this_file_before_re_exporting_when_1_is_enabled_Consider_using_import_type_where_0_is_imported,
 * 						diagnostics.X_0_resolves_to_a_type_and_must_be_marked_type_only_in_this_file_before_re_exporting_when_1_is_enabled_Consider_using_export_type_0_as_default)
 * 					c.error(id, message, id.Text(), c.getIsolatedModulesLikeFlagName())
 * 				} else if typeOnlyDeclaration != nil && ast.GetSourceFileOfNode(typeOnlyDeclaration) != ast.GetSourceFileOfNode(node) {
 * 					// import { SomeTypeOnlyValue } from "./someModule";
 * 					// export default SomeTypeOnlyValue; OR
 * 					// export = SomeTypeOnlyValue;
 * 					message := core.IfElse(isExportEquals,
 * 						diagnostics.X_0_resolves_to_a_type_only_declaration_and_must_be_marked_type_only_in_this_file_before_re_exporting_when_1_is_enabled_Consider_using_import_type_where_0_is_imported,
 * 						diagnostics.X_0_resolves_to_a_type_only_declaration_and_must_be_marked_type_only_in_this_file_before_re_exporting_when_1_is_enabled_Consider_using_export_type_0_as_default)
 * 					c.addTypeOnlyDeclarationRelatedInfo(c.error(id, message, id.Text(), c.getIsolatedModulesLikeFlagName()), typeOnlyDeclaration, id.Text())
 * 				}
 * 			}
 * 		} else {
 * 			c.checkExpressionCached(id)
 * 			// doesn't resolve, check as expression to mark as error
 * 		}
 *
 * 	} else {
 * 		c.checkExpressionCached(node.Expression())
 * 	}
 * 	if isIllegalExportDefaultInCJS {
 * 		c.error(node, getVerbatimModuleSyntaxErrorMessage(node))
 * 	}
 * 	c.checkExternalModuleExports(container)
 * 	if typeNode := node.Type(); typeNode != nil && node.Kind == ast.KindExportAssignment {
 * 		t := c.getTypeFromTypeNode(typeNode)
 * 		initializerType := c.checkExpressionCached(node.Expression())
 * 		c.checkTypeAssignableToAndOptionallyElaborate(initializerType, t, node.Expression(), node.Expression(), nil /*headMessage* /, nil)
 * 	}
 * 	if (node.Flags&ast.NodeFlagsAmbient != 0) && !ast.IsEntityNameExpression(node.Expression()) {
 * 		c.grammarErrorOnNode(node.Expression(), diagnostics.The_expression_of_an_export_assignment_must_be_an_identifier_or_qualified_name_in_an_ambient_context)
 * 	}
 * 	if isExportEquals {
 * 		// Forbid export= in esm implementation files, and esm mode declaration files
 * 		if c.moduleKind >= core.ModuleKindES2015 && c.moduleKind != core.ModuleKindPreserve && ((node.Flags&ast.NodeFlagsAmbient != 0 && c.program.GetImpliedNodeFormatForEmit(ast.GetSourceFileOfNode(node)) == core.ModuleKindESNext) || (node.Flags&ast.NodeFlagsAmbient == 0 && c.program.GetImpliedNodeFormatForEmit(ast.GetSourceFileOfNode(node)) != core.ModuleKindCommonJS)) {
 * 			// export assignment is not supported in es6 modules
 * 			c.grammarErrorOnNode(node, diagnostics.Export_assignment_cannot_be_used_when_targeting_ECMAScript_modules_Consider_using_export_default_or_another_module_format_instead)
 * 		} else if c.moduleKind == core.ModuleKindSystem && node.Flags&ast.NodeFlagsAmbient == 0 {
 * 			// system modules does not support export assignment
 * 			c.grammarErrorOnNode(node, diagnostics.Export_assignment_is_not_supported_when_module_flag_is_system)
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkExportAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.areDeclarationFlagsIdentical","kind":"method","status":"implemented","sigHash":"8a1aeba8b831e17fca88a174e5fc62a51381cdda9df3eff35e5abe85eed2780a","bodyHash":"0d6a0bbe32afc13624c3a9a372f5e097702e1d333e5fb55cd6a187702e11766c"}
 *
 * Go source:
 * func (c *Checker) areDeclarationFlagsIdentical(left *ast.Declaration, right *ast.Declaration) bool {
 * 	if ast.IsParameterDeclaration(left) && ast.IsVariableDeclaration(right) || ast.IsVariableDeclaration(left) && ast.IsParameterDeclaration(right) {
 * 		// Differences in optionality between parameters and variables are allowed.
 * 		return true
 * 	}
 * 	if isOptionalDeclaration(left) != isOptionalDeclaration(right) {
 * 		return false
 * 	}
 * 	interestingFlags := ast.ModifierFlagsPrivate | ast.ModifierFlagsProtected | ast.ModifierFlagsAsync | ast.ModifierFlagsAbstract | ast.ModifierFlagsReadonly | ast.ModifierFlagsStatic
 * 	return getSelectedModifierFlags(left, interestingFlags) == getSelectedModifierFlags(right, interestingFlags)
 * }
 */
export declare function Checker_areDeclarationFlagsIdentical(receiver: GoPtr<Checker>, left: GoPtr<Declaration>, right: GoPtr<Declaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkSatisfiesExpression","kind":"method","status":"implemented","sigHash":"698f7d11a65d816ba71672b34da4fef21a1681e3749a6afe9a1939a6bfbb09a0","bodyHash":"aecabc50b40ecd9bfaacef47982f804bc58ccfd2caaa9c1d9d14de6ae5f6b29d"}
 *
 * Go source:
 * func (c *Checker) checkSatisfiesExpression(node *ast.Node) *Type {
 * 	typeNode := node.Type()
 * 	c.checkSourceElement(typeNode)
 * 	exprType := c.checkExpression(node.Expression())
 * 	targetType := c.getTypeFromTypeNode(typeNode)
 * 	if c.isErrorType(targetType) {
 * 		return targetType
 * 	}
 * 	errorNode := core.IfElse(typeNode.Flags&ast.NodeFlagsReparsed != 0, typeNode, node)
 * 	c.checkTypeAssignableToAndOptionallyElaborate(exprType, targetType, errorNode, node.Expression(), diagnostics.Type_0_does_not_satisfy_the_expected_type_1, nil)
 * 	return exprType
 * }
 */
export declare function Checker_checkSatisfiesExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkDestructuringAssignment","kind":"method","status":"implemented","sigHash":"a30f707976ce675b92289aa8eca01b4e4f67d0a98f385a56bb6079fcf3b7be11","bodyHash":"12ebaec0b0fc2c9359a041b8b9562ddd6b581463ef054da2b80641c406a77bd8"}
 *
 * Go source:
 * func (c *Checker) checkDestructuringAssignment(node *ast.Node, sourceType *Type, checkMode CheckMode, rightIsThis bool) *Type {
 * 	var target *ast.Node
 * 	if ast.IsShorthandPropertyAssignment(node) {
 * 		initializer := node.AsShorthandPropertyAssignment().ObjectAssignmentInitializer
 * 		if initializer != nil {
 * 			// In strict null checking mode, if a default value of a non-undefined type is specified, remove
 * 			// undefined from the final type.
 * 			if c.strictNullChecks && !(c.hasTypeFacts(c.checkExpression(initializer), TypeFactsIsUndefined)) {
 * 				sourceType = c.getTypeWithFacts(sourceType, TypeFactsNEUndefined)
 * 			}
 * 			c.checkBinaryLikeExpression(node.Name(), node.AsShorthandPropertyAssignment().EqualsToken, initializer, checkMode, nil)
 * 		}
 * 		target = node.Name()
 * 	} else {
 * 		target = node
 * 	}
 * 	if ast.IsBinaryExpression(target) && target.AsBinaryExpression().OperatorToken.Kind == ast.KindEqualsToken {
 * 		c.checkBinaryExpression(target, checkMode)
 * 		target = target.AsBinaryExpression().Left
 * 		// A default value is specified, so remove undefined from the final type.
 * 		if c.strictNullChecks {
 * 			sourceType = c.getTypeWithFacts(sourceType, TypeFactsNEUndefined)
 * 		}
 * 	}
 * 	if ast.IsObjectLiteralExpression(target) {
 * 		return c.checkObjectLiteralAssignment(target, sourceType, rightIsThis)
 * 	}
 * 	if ast.IsArrayLiteralExpression(target) {
 * 		return c.checkArrayLiteralAssignment(target, sourceType, checkMode)
 * 	}
 * 	return c.checkReferenceAssignment(target, sourceType, checkMode)
 * }
 */
export declare function Checker_checkDestructuringAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>, sourceType: GoPtr<Type>, checkMode: CheckMode, rightIsThis: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkObjectLiteralAssignment","kind":"method","status":"implemented","sigHash":"1fe5ea098f1296a633b32a25e335bdfc02956e4295016c9a26f189dd00c7e475","bodyHash":"f8bb9efd5e40bb064b0b34a5712982c5d7d1e6219a20f5ed3fbfafb7f9232c0b"}
 *
 * Go source:
 * func (c *Checker) checkObjectLiteralAssignment(node *ast.Node, sourceType *Type, rightIsThis bool) *Type {
 * 	properties := node.PropertyList()
 * 	if c.strictNullChecks && len(properties.Nodes) == 0 {
 * 		return c.checkNonNullType(sourceType, node)
 * 	}
 * 	for i := range properties.Nodes {
 * 		c.checkObjectLiteralDestructuringPropertyAssignment(node, sourceType, i, properties, rightIsThis)
 * 	}
 * 	return sourceType
 * }
 */
export declare function Checker_checkObjectLiteralAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>, sourceType: GoPtr<Type>, rightIsThis: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkObjectLiteralDestructuringPropertyAssignment","kind":"method","status":"implemented","sigHash":"7df0dff78687ce98f147b42b65f0c1126808238afa4f83e990d8a77253957710","bodyHash":"ea1448fc1de4c762d06b2f5439fff48dcb585f5f7b3f5f61082324b07f5a68ca"}
 *
 * Go source:
 * func (c *Checker) checkObjectLiteralDestructuringPropertyAssignment(node *ast.Node, objectLiteralType *Type, propertyIndex int, allProperties *ast.NodeList, rightIsThis bool) *Type {
 * 	properties := node.Properties()
 * 	property := properties[propertyIndex]
 * 	if ast.IsPropertyAssignment(property) || ast.IsShorthandPropertyAssignment(property) {
 * 		name := property.Name()
 * 		exprType := c.getLiteralTypeFromPropertyName(name)
 * 		if isTypeUsableAsPropertyName(exprType) {
 * 			text := getPropertyNameFromType(exprType)
 * 			prop := c.getPropertyOfType(objectLiteralType, text)
 * 			if prop != nil {
 * 				c.markPropertyAsReferenced(prop, property, rightIsThis)
 * 				c.checkPropertyAccessibility(property, false /*isSuper* /, true /*writing* /, objectLiteralType, prop)
 * 			}
 * 		}
 * 		elementType := c.getIndexedAccessTypeEx(objectLiteralType, exprType, AccessFlagsExpressionPosition|(core.IfElse(c.hasDefaultValue(property), AccessFlagsAllowMissing, 0)), name, nil)
 * 		t := c.getFlowTypeOfDestructuring(property, elementType)
 * 		expr := property
 * 		if ast.IsPropertyAssignment(property) {
 * 			expr = property.Initializer()
 * 		}
 * 		return c.checkDestructuringAssignment(expr, t, CheckModeNormal, false)
 * 	}
 * 	if ast.IsSpreadAssignment(property) {
 * 		if propertyIndex < len(properties)-1 {
 * 			c.error(property, diagnostics.A_rest_element_must_be_last_in_a_destructuring_pattern)
 * 			return nil
 * 		}
 * 		var nonRestNames []*ast.Node
 * 		if allProperties != nil {
 * 			for _, otherProperty := range allProperties.Nodes {
 * 				if !ast.IsSpreadAssignment(otherProperty) {
 * 					nonRestNames = append(nonRestNames, otherProperty.Name())
 * 				}
 * 			}
 * 		}
 * 		t := c.getRestType(objectLiteralType, nonRestNames, objectLiteralType.symbol)
 * 		c.checkGrammarForDisallowedTrailingComma(allProperties, diagnostics.A_rest_parameter_or_binding_pattern_may_not_have_a_trailing_comma)
 * 		return c.checkDestructuringAssignment(property.Expression(), t, CheckModeNormal, false)
 * 	}
 * 	c.error(property, diagnostics.Property_assignment_expected)
 * 	return nil
 * }
 */
export declare function Checker_checkObjectLiteralDestructuringPropertyAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>, objectLiteralType: GoPtr<Type>, propertyIndex: int, allProperties: GoPtr<NodeList>, rightIsThis: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkArrayLiteralAssignment","kind":"method","status":"implemented","sigHash":"fbe3216901dccd20ba73087f443cfce1f51e45827776aa98ecd9b0f8f5d8e0eb","bodyHash":"1cc3bb3c3fa701dd3aa450c911fb7f40dc4534fdedc16ed1b5129d7062508b93"}
 *
 * Go source:
 * func (c *Checker) checkArrayLiteralAssignment(node *ast.Node, sourceType *Type, checkMode CheckMode) *Type {
 * 	elements := node.Elements()
 * 	// This elementType will be used if the specific property corresponding to this index is not
 * 	// present (aka the tuple element property). This call also checks that the parentType is in
 * 	// fact an iterable or array (depending on target language).
 * 	possiblyOutOfBoundsType := core.OrElse(c.checkIteratedTypeOrElementType(IterationUseDestructuring|IterationUsePossiblyOutOfBounds, sourceType, c.undefinedType, node), c.errorType)
 * 	inBoundsType := core.IfElse(c.compilerOptions.NoUncheckedIndexedAccess == core.TSTrue, nil, possiblyOutOfBoundsType)
 * 	for i := range elements {
 * 		t := possiblyOutOfBoundsType
 * 		if elements[i].Kind == ast.KindSpreadElement {
 * 			if inBoundsType == nil {
 * 				inBoundsType = core.OrElse(c.checkIteratedTypeOrElementType(IterationUseDestructuring, sourceType, c.undefinedType, node), c.errorType)
 * 			}
 * 			t = inBoundsType
 * 		}
 * 		c.checkArrayLiteralDestructuringElementAssignment(node, sourceType, i, t, checkMode)
 * 	}
 * 	return sourceType
 * }
 */
export declare function Checker_checkArrayLiteralAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>, sourceType: GoPtr<Type>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkArrayLiteralDestructuringElementAssignment","kind":"method","status":"implemented","sigHash":"77f93fde9de19403ac29fc26e26141abc393cda41d51ba4a844b3b89437193a4","bodyHash":"7c4bb885391e7f0eb32f5cd1f4f204558eb808db8341a50d665facb37728a1f3"}
 *
 * Go source:
 * func (c *Checker) checkArrayLiteralDestructuringElementAssignment(node *ast.Node, sourceType *Type, elementIndex int, elementType *Type, checkMode CheckMode) *Type {
 * 	elements := node.ElementList()
 * 	element := elements.Nodes[elementIndex]
 * 	if !ast.IsOmittedExpression(element) {
 * 		if !ast.IsSpreadElement(element) {
 * 			indexType := c.getNumberLiteralType(jsnum.Number(elementIndex))
 * 			if c.isArrayLikeType(sourceType) {
 * 				// We create a synthetic expression so that getIndexedAccessType doesn't get confused
 * 				// when the element is a SyntaxKind.ElementAccessExpression.
 * 				accessFlags := AccessFlagsExpressionPosition | core.IfElse(c.hasDefaultValue(element), AccessFlagsAllowMissing, 0)
 * 				elementType := core.OrElse(c.getIndexedAccessTypeOrUndefined(sourceType, indexType, accessFlags, c.createSyntheticExpression(element, indexType, false, nil), nil), c.errorType)
 * 				assignedType := elementType
 * 				if c.hasDefaultValue(element) {
 * 					assignedType = c.getTypeWithFacts(elementType, TypeFactsNEUndefined)
 * 				}
 * 				t := c.getFlowTypeOfDestructuring(element, assignedType)
 * 				return c.checkDestructuringAssignment(element, t, checkMode, false)
 * 			}
 * 			return c.checkDestructuringAssignment(element, elementType, checkMode, false)
 * 		}
 * 		if elementIndex < len(elements.Nodes)-1 {
 * 			c.error(element, diagnostics.A_rest_element_must_be_last_in_a_destructuring_pattern)
 * 		} else {
 * 			restExpression := element.Expression()
 * 			if ast.IsBinaryExpression(restExpression) && restExpression.AsBinaryExpression().OperatorToken.Kind == ast.KindEqualsToken {
 * 				c.error(restExpression.AsBinaryExpression().OperatorToken, diagnostics.A_rest_element_cannot_have_an_initializer)
 * 			} else {
 * 				c.checkGrammarForDisallowedTrailingComma(elements, diagnostics.A_rest_parameter_or_binding_pattern_may_not_have_a_trailing_comma)
 * 				var t *Type
 * 				if everyType(sourceType, isTupleType) {
 * 					t = c.mapType(sourceType, func(t *Type) *Type { return c.sliceTupleType(t, elementIndex, 0) })
 * 				} else {
 * 					t = c.createArrayType(elementType)
 * 				}
 * 				return c.checkDestructuringAssignment(restExpression, t, checkMode, false)
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_checkArrayLiteralDestructuringElementAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>, sourceType: GoPtr<Type>, elementIndex: int, elementType: GoPtr<Type>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkReferenceAssignment","kind":"method","status":"implemented","sigHash":"fd2843555d1a751af87be88f2c58602089fc0dc09412b2866a925a9de3a7fbe5","bodyHash":"db65f3b536959929ec614f0c14833b68f29a660f3910c1f2a0667c4c1df0d3e4"}
 *
 * Go source:
 * func (c *Checker) checkReferenceAssignment(target *ast.Node, sourceType *Type, checkMode CheckMode) *Type {
 * 	targetType := c.checkExpressionEx(target, checkMode)
 * 	message := core.IfElse(ast.IsSpreadAssignment(target.Parent),
 * 		diagnostics.The_target_of_an_object_rest_assignment_must_be_a_variable_or_a_property_access,
 * 		diagnostics.The_left_hand_side_of_an_assignment_expression_must_be_a_variable_or_a_property_access)
 * 	optionalMessage := core.IfElse(ast.IsSpreadAssignment(target.Parent),
 * 		diagnostics.The_target_of_an_object_rest_assignment_may_not_be_an_optional_property_access,
 * 		diagnostics.The_left_hand_side_of_an_assignment_expression_may_not_be_an_optional_property_access)
 * 	if c.checkReferenceExpression(target, message, optionalMessage) {
 * 		c.checkTypeAssignableToAndOptionallyElaborate(sourceType, targetType, target, target, nil, nil)
 * 	}
 * 	return sourceType
 * }
 */
export declare function Checker_checkReferenceAssignment(receiver: GoPtr<Checker>, target: GoPtr<Node>, sourceType: GoPtr<Type>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAssignmentOperator","kind":"method","status":"implemented","sigHash":"26ba0c10bf681786933298dcdc6d561aa80d70c00599622772fddc786d70e6e5","bodyHash":"488972863473c827589119f9876bfa97fe77766871a728858667f4ee3c669f15"}
 *
 * Go source:
 * func (c *Checker) checkAssignmentOperator(left *ast.Node, operator ast.Kind, right *ast.Node, leftType *Type, rightType *Type) {
 * 	if ast.IsAssignmentOperator(operator) {
 * 		// We ignore assignments of undefined to CommonJS exports when there are multiple assignment declarations
 * 		if ast.IsDeclarationNode(left.Parent) && ast.GetAssignmentDeclarationKind(left.Parent) == ast.JSDeclarationKindExportsProperty {
 * 			if symbol := c.symbolNodeLinks.Get(left).resolvedSymbol; symbol != nil && len(symbol.Declarations) > 1 && rightType.flags&TypeFlagsUndefined != 0 {
 * 				return
 * 			}
 * 		}
 * 		// getters can be a subtype of setters, so to check for assignability we use the setter's type instead
 * 		if ast.IsCompoundAssignment(operator) && ast.IsPropertyAccessExpression(left) {
 * 			leftType = c.checkPropertyAccessExpression(left, CheckModeNormal, true /*writeOnly* /)
 * 		}
 * 		if c.checkReferenceExpression(left, diagnostics.The_left_hand_side_of_an_assignment_expression_must_be_a_variable_or_a_property_access, diagnostics.The_left_hand_side_of_an_assignment_expression_may_not_be_an_optional_property_access) {
 * 			var headMessage *diagnostics.Message
 * 			if c.exactOptionalPropertyTypes && ast.IsPropertyAccessExpression(left) && c.maybeTypeOfKind(rightType, TypeFlagsUndefined) {
 * 				target := c.getTypeOfPropertyOfType(c.getTypeOfExpression(left.Expression()), left.Name().Text())
 * 				if c.isExactOptionalPropertyMismatch(rightType, target) {
 * 					headMessage = diagnostics.Type_0_is_not_assignable_to_type_1_with_exactOptionalPropertyTypes_Colon_true_Consider_adding_undefined_to_the_type_of_the_target
 * 				}
 * 			}
 * 			// to avoid cascading errors check assignability only if 'isReference' check succeeded and no errors were reported
 * 			c.checkTypeAssignableToAndOptionallyElaborate(rightType, leftType, left, right, headMessage, nil)
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkAssignmentOperator(receiver: GoPtr<Checker>, left: GoPtr<Node>, operator: Kind, right: GoPtr<Node>, leftType: GoPtr<Type>, rightType: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isTypeEqualityComparableTo","kind":"method","status":"implemented","sigHash":"3497f93993ecb137da2fcf3b9b563135e7ae17f24ae03e67f0789f730cc69565","bodyHash":"2e585fe440ba922f670372efa91c08459e0637cd17787c5371fb5b6dbe8cd211"}
 *
 * Go source:
 * func (c *Checker) isTypeEqualityComparableTo(source *Type, target *Type) bool {
 * 	return (target.flags&TypeFlagsNullable) != 0 || c.isTypeComparableTo(source, target)
 * }
 */
export declare function Checker_isTypeEqualityComparableTo(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPropertyAssignment","kind":"method","status":"implemented","sigHash":"a3504e96a98cf3397d1be4e128613d4e14706bc5154bd1f364219518c0fc4e8c","bodyHash":"4088ea691e500ff97b4199823bc7973c0871a2f802d81d24478afa18858eea93"}
 *
 * Go source:
 * func (c *Checker) checkPropertyAssignment(node *ast.Node, checkMode CheckMode) *Type {
 * 	// Do not use hasDynamicName here, because that returns false for well known symbols.
 * 	// We want to perform checkComputedPropertyName for all computed properties, including
 * 	// well known symbols.
 * 	if ast.IsComputedPropertyName(node.Name()) {
 * 		c.checkComputedPropertyName(node.Name())
 * 	}
 * 	initializerType := c.checkExpressionForMutableLocation(node.Initializer(), checkMode)
 * 	if node.Type() != nil {
 * 		t := c.getTypeFromTypeNode(node.Type())
 * 		c.checkTypeAssignableToAndOptionallyElaborate(initializerType, t, node, node.Initializer(), nil /*headMessage* /, nil)
 * 		return t
 * 	}
 * 	return initializerType
 * }
 */
export declare function Checker_checkPropertyAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkShorthandPropertyAssignment","kind":"method","status":"implemented","sigHash":"cad1c6e73fe800588d88654c134ca043180e1c8d8b2e3502391b3f4781afe228","bodyHash":"6da8272c3c645c2959a178b7fa35375e254c6d0befc69331962ffaf815e37c45"}
 *
 * Go source:
 * func (c *Checker) checkShorthandPropertyAssignment(node *ast.Node, inDestructuringPattern bool, checkMode CheckMode) *Type {
 * 	var expr *ast.Node
 * 	if !inDestructuringPattern {
 * 		expr = node.AsShorthandPropertyAssignment().ObjectAssignmentInitializer
 * 	}
 * 	if expr == nil {
 * 		expr = node.Name()
 * 	}
 * 	expressionType := c.checkExpressionForMutableLocation(expr, checkMode)
 * 	if node.Type() != nil {
 * 		t := c.getTypeFromTypeNode(node.Type())
 * 		c.checkTypeAssignableToAndOptionallyElaborate(expressionType, t, node, expr, nil /*headMessage* /, nil)
 * 		return t
 * 	}
 * 	return expressionType
 * }
 */
export declare function Checker_checkShorthandPropertyAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>, inDestructuringPattern: bool, checkMode: CheckMode): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isReadonlyAssignmentDeclaration","kind":"method","status":"implemented","sigHash":"e010b3f6ddbfb8e2c3f71c44a436844d9b527b1bcd2f5bec847d871ef2a08a37","bodyHash":"16bdb22f1d411a83da715e581381b6c61443d3b56a3d5183b4c7f4e002c6bb71"}
 *
 * Go source:
 * func (c *Checker) isReadonlyAssignmentDeclaration(node *ast.Node) bool {
 * 	if !ast.IsCallExpression(node) {
 * 		return false
 * 	}
 * 	propertyDescriptorType := c.checkExpressionCached(node.Arguments()[2])
 * 	if valueType := c.getTypeOfPropertyOfType(propertyDescriptorType, "value"); valueType != nil {
 * 		if writableProp := c.getPropertyOfType(propertyDescriptorType, "writable"); writableProp != nil {
 * 			var writableType *Type
 * 			if writableProp.ValueDeclaration != nil && ast.IsPropertyAssignment(writableProp.ValueDeclaration) {
 * 				writableType = c.checkExpression(writableProp.ValueDeclaration.Initializer())
 * 			} else {
 * 				writableType = c.getTypeOfSymbol(writableProp)
 * 			}
 * 			return writableType.flags&TypeFlagsBooleanLiteral != 0 && getBooleanLiteralValue(writableType) == false
 * 		}
 * 		return true
 * 	}
 * 	return c.getTypeOfPropertyOfType(propertyDescriptorType, "set") == nil
 * }
 */
export declare function Checker_isReadonlyAssignmentDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTargetOfExportAssignment","kind":"method","status":"implemented","sigHash":"9467261be26c69803efeb5b0c8566331b6064f5c221dfef19d7b708d4ea83b58","bodyHash":"5c3536ee6b39bb342a8801b09630fcc5717a5603e71f2a87ca24c006d4ba9a98"}
 *
 * Go source:
 * func (c *Checker) getTargetOfExportAssignment(node *ast.Node) *ast.Symbol {
 * 	resolved := c.getTargetOfAliasLikeExpression(node.Expression())
 * 	c.markSymbolOfAliasDeclarationIfTypeOnly(node, nil)
 * 	return resolved
 * }
 */
export declare function Checker_getTargetOfExportAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getWidenedTypeForAssignmentDeclaration","kind":"method","status":"implemented","sigHash":"8430950ecde9f423c4a046cb9aed4533173a6cbf97dc24e7df4e106d88109d30","bodyHash":"ab61a17ab370359918e158f3e9cf77a16e13096b1e2bd4455abf04634482184e"}
 *
 * Go source:
 * func (c *Checker) getWidenedTypeForAssignmentDeclaration(symbol *ast.Symbol) *Type {
 * 	var t *Type
 * 	kind, location := c.isConstructorDeclaredThisProperty(symbol)
 * 	switch kind {
 * 	case thisAssignmentDeclarationTyped:
 * 		if location == nil {
 * 			panic("location should not be nil when this assignment has a type.")
 * 		}
 * 		t = c.getTypeFromTypeNode(location)
 * 	case thisAssignmentDeclarationConstructor:
 * 		if location == nil {
 * 			panic("constructor should not be nil when this assignment is in a constructor.")
 * 		}
 * 		t = c.getFlowTypeInConstructor(symbol, location)
 * 	case thisAssignmentDeclarationMethod:
 * 		t = c.getTypeOfPropertyInBaseClass(symbol)
 * 	}
 * 	if t == nil {
 * 		var types []*Type
 * 		for i, declaration := range symbol.Declarations {
 * 			if ast.IsBinaryExpression(declaration) && declaration.Type() != nil {
 * 				t = c.getTypeFromTypeNode(declaration.Type())
 * 				break
 * 			}
 * 			assignedType := c.getAssignmentDeclarationInitializerType(declaration)
 * 			// We ignore initial assignments of undefined to CommonJS exports when there are multiple assignment declarations
 * 			if ast.GetAssignmentDeclarationKind(declaration) != ast.JSDeclarationKindExportsProperty || i != 0 || len(symbol.Declarations) == 1 || assignedType.flags&TypeFlagsUndefined == 0 {
 * 				types = core.AppendIfUnique(types, assignedType)
 * 			}
 * 		}
 * 		if kind == thisAssignmentDeclarationMethod && len(types) > 0 {
 * 			if c.strictNullChecks {
 * 				types = core.AppendIfUnique(types, c.undefinedOrMissingType)
 * 			}
 * 		}
 * 		if t == nil {
 * 			t = c.getWidenedType(c.getUnionType(types))
 * 		}
 * 	}
 * 	// report an all-nullable or empty union as an implicit any in JS files
 * 	if symbol.ValueDeclaration != nil && ast.IsInJSFile(symbol.ValueDeclaration) &&
 * 		c.filterType(t, func(c *Type) bool { return c.Flags() & ^TypeFlagsNullable != 0 }) == c.neverType {
 * 		c.reportImplicitAny(symbol.ValueDeclaration, c.anyType, WideningKindNormal)
 * 		return c.anyType
 * 	}
 * 	return t
 * }
 */
export declare function Checker_getWidenedTypeForAssignmentDeclaration(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getAssignmentDeclarationInitializerType","kind":"method","status":"implemented","sigHash":"65081f71119059e69c5f6452344bfffe508e13984125f2e3f5f491b7b2b3287b","bodyHash":"80f09efbc17f927b1787788f776656d5ca3412106b0ecfae05baafe85fd5a3a8"}
 *
 * Go source:
 * func (c *Checker) getAssignmentDeclarationInitializerType(node *ast.Node) *Type {
 * 	if ast.IsBinaryExpression(node) {
 * 		switch ast.GetAssignmentDeclarationKind(node) {
 * 		case ast.JSDeclarationKindModuleExports, ast.JSDeclarationKindExportsProperty:
 * 			return c.getRegularTypeOfLiteralType(c.checkExpressionCached(ast.GetRightMostAssignedExpression(node)))
 * 		}
 * 		return c.checkExpressionForMutableLocation(node.AsBinaryExpression().Right, CheckModeNormal)
 * 	}
 * 	if ast.IsCallExpression(node) {
 * 		return c.getTypeFromPropertyDescriptor(node.Arguments()[2])
 * 	}
 * 	return c.neverType
 * }
 */
export declare function Checker_getAssignmentDeclarationInitializerType(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.removeSubtypes","kind":"method","status":"implemented","sigHash":"8b4040210ef6ee2012d6a9e44f9e29175dd761be10cb1ebea4b0be4df8282508","bodyHash":"f01794532ae15f1b019b2a0b80256ec0b0012c987f74d563d5c4e6f20ce00b37"}
 *
 * Go source:
 * func (c *Checker) removeSubtypes(types []*Type, hasObjectTypes bool) []*Type {
 * 	// [] and [T] immediately reduce to [] and [T] respectively
 * 	if len(types) < 2 {
 * 		return types
 * 	}
 * 	key := getTypeListKey(types)
 * 	if cached := c.subtypeReductionCache[key]; cached != nil {
 * 		return cached
 * 	}
 * 	// We assume that redundant primitive types have already been removed from the types array and that there
 * 	// are no any and unknown types in the array. Thus, the only possible supertypes for primitive types are empty
 * 	// object types, and if none of those are present we can exclude primitive types from the subtype check.
 * 	hasEmptyObject := hasObjectTypes && core.Some(types, func(t *Type) bool {
 * 		return t.flags&TypeFlagsObject != 0 && !c.isGenericMappedType(t) && c.isEmptyResolvedType(c.resolveStructuredTypeMembers(t))
 * 	})
 * 	length := len(types)
 * 	i := length
 * 	count := 0
 * 	for i > 0 {
 * 		i--
 * 		source := types[i]
 * 		if hasEmptyObject || source.flags&TypeFlagsStructuredOrInstantiable != 0 {
 * 			// A type parameter with a union constraint may be a subtype of some union, but not a subtype of the
 * 			// individual constituents of that union. For example, `T extends A | B` is a subtype of `A | B`, but not
 * 			// a subtype of just `A` or just `B`. When we encounter such a type parameter, we therefore check if the
 * 			// type parameter is a subtype of a union of all the other types.
 * 			if source.flags&TypeFlagsTypeParameter != 0 && c.getBaseConstraintOrType(source).flags&TypeFlagsUnion != 0 {
 * 				if c.isTypeRelatedTo(source, c.getUnionType(core.Map(types, func(t *Type) *Type {
 * 					if t == source {
 * 						return c.neverType
 * 					}
 * 					return t
 * 				})), c.strictSubtypeRelation) {
 * 					types = slices.Delete(types, i, i+1)
 * 				}
 * 				continue
 * 			}
 * 			// Find the first property with a unit type, if any. When constituents have a property by the same name
 * 			// but of a different unit type, we can quickly disqualify them from subtype checks. This helps subtype
 * 			// reduction of large discriminated union types.
 * 			var keyProperty *ast.Symbol
 * 			var keyPropertyType *Type
 * 			if source.flags&(TypeFlagsObject|TypeFlagsIntersection|TypeFlagsInstantiableNonPrimitive) != 0 {
 * 				keyProperty = core.Find(c.getPropertiesOfType(source), func(p *ast.Symbol) bool {
 * 					return isUnitType(c.getTypeOfSymbol(p))
 * 				})
 * 			}
 * 			if keyProperty != nil {
 * 				keyPropertyType = c.getRegularTypeOfLiteralType(c.getTypeOfSymbol(keyProperty))
 * 			}
 * 			for _, target := range types {
 * 				if source != target {
 * 					if count == 100000 {
 * 						// After 100000 subtype checks we estimate the remaining amount of work by assuming the
 * 						// same ratio of checks per element. If the estimated number of remaining type checks is
 * 						// greater than 1M we deem the union type too complex to represent. This for example
 * 						// caps union types at 1000 unique object types.
 * 						estimatedCount := (count / (length - i)) * length
 * 						if estimatedCount > 1000000 {
 * 							if tr := c.tracer; tr != nil {
 * 								tr.Instant(tracing.PhaseCheckTypes, "removeSubtypes_DepthLimit", map[string]any{"estimatedCount": estimatedCount})
 * 							}
 * 							c.error(c.currentNode, diagnostics.Expression_produces_a_union_type_that_is_too_complex_to_represent)
 * 							return nil
 * 						}
 * 					}
 * 					count++
 * 					if keyProperty != nil && target.flags&(TypeFlagsObject|TypeFlagsIntersection|TypeFlagsInstantiableNonPrimitive) != 0 {
 * 						t := c.getTypeOfPropertyOfType(target, keyProperty.Name)
 * 						if t != nil && isUnitType(t) && c.getRegularTypeOfLiteralType(t) != keyPropertyType {
 * 							continue
 * 						}
 * 					}
 * 					if (source == c.emptyObjectType || source == c.unknownEmptyObjectType) && target.symbol != nil && c.IsEmptyAnonymousObjectType(target) {
 * 						continue
 * 					}
 * 					if c.isTypeRelatedTo(source, target, c.strictSubtypeRelation) && (c.getTargetType(source).objectFlags&ObjectFlagsClass == 0 ||
 * 						c.getTargetType(target).objectFlags&ObjectFlagsClass == 0 ||
 * 						c.isTypeDerivedFrom(source, target)) {
 * 						types = slices.Delete(types, i, i+1)
 * 						break
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	c.subtypeReductionCache[key] = types
 * 	return types
 * }
 */
export declare function Checker_removeSubtypes(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>, hasObjectTypes: bool): GoPtr<GoSlice<GoPtr<Type>>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.removeRedundantSupertypes","kind":"method","status":"implemented","sigHash":"207533a674cced35a0b5d249b117381b24a5a77e3d1e851dc921493383719e75","bodyHash":"fbf7e2d332da5763a131b3cc9560dd5cebea23bf819e7b7ce1db4ac26be49ed7"}
 *
 * Go source:
 * func (c *Checker) removeRedundantSupertypes(types []*Type, includes TypeFlags) []*Type {
 * 	i := len(types)
 * 	for i > 0 {
 * 		i--
 * 		t := types[i]
 * 		remove := t.flags&TypeFlagsString != 0 && includes&(TypeFlagsStringLiteral|TypeFlagsTemplateLiteral|TypeFlagsStringMapping) != 0 ||
 * 			t.flags&TypeFlagsNumber != 0 && includes&TypeFlagsNumberLiteral != 0 ||
 * 			t.flags&TypeFlagsBigInt != 0 && includes&TypeFlagsBigIntLiteral != 0 ||
 * 			t.flags&TypeFlagsESSymbol != 0 && includes&TypeFlagsUniqueESSymbol != 0 ||
 * 			t.flags&TypeFlagsVoid != 0 && includes&TypeFlagsUndefined != 0 ||
 * 			c.IsEmptyAnonymousObjectType(t) && includes&TypeFlagsDefinitelyNonNullable != 0
 * 		if remove {
 * 			types = slices.Delete(types, i, i+1)
 * 		}
 * 	}
 * 	return types
 * }
 */
export declare function Checker_removeRedundantSupertypes(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>, includes: TypeFlags): GoSlice<GoPtr<Type>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isAssignmentToReadonlyEntity","kind":"method","status":"implemented","sigHash":"fd2664450704446541c8906636be17c0f40c5aad97d9567675c7ed12e8a50618","bodyHash":"5fd67879e7ef91df4ede82ce271af24627d2d37610e5a978fcbcba8d5dba829c"}
 *
 * Go source:
 * func (c *Checker) isAssignmentToReadonlyEntity(expr *ast.Node, symbol *ast.Symbol, assignmentKind AssignmentKind) bool {
 * 	if assignmentKind == AssignmentKindNone {
 * 		// no assignment means it doesn't matter whether the entity is readonly
 * 		return false
 * 	}
 * 	if ast.IsAccessExpression(expr) {
 * 		node := ast.SkipParentheses(expr.Expression())
 * 		if ast.IsIdentifier(node) {
 * 			expressionSymbol := c.getResolvedSymbol(node)
 * 			// CommonJS module.exports is never readonly
 * 			if expressionSymbol.Flags&ast.SymbolFlagsModuleExports != 0 {
 * 				return false
 * 			}
 * 		}
 * 	}
 * 	if c.isReadonlySymbol(symbol) {
 * 		// Allow assignments to readonly properties within constructors of the same class declaration.
 * 		if symbol.Flags&ast.SymbolFlagsProperty != 0 && ast.IsAccessExpression(expr) && expr.Expression().Kind == ast.KindThisKeyword {
 * 			// Look for if this is the constructor for the class that `symbol` is a property of.
 * 			ctor := c.getControlFlowContainer(expr)
 * 			if ctor == nil || !ast.IsConstructorDeclaration(ctor) {
 * 				return true
 * 			}
 * 			if symbol.ValueDeclaration != nil {
 * 				isAssignmentDeclaration := ast.IsBinaryExpression(symbol.ValueDeclaration)
 * 				isLocalPropertyDeclaration := ctor.Parent == symbol.ValueDeclaration.Parent
 * 				isLocalParameterProperty := ctor == symbol.ValueDeclaration.Parent
 * 				isLocalThisPropertyAssignment := isAssignmentDeclaration && symbol.Parent.ValueDeclaration == ctor.Parent
 * 				isLocalThisPropertyAssignmentConstructorFunction := isAssignmentDeclaration && symbol.Parent.ValueDeclaration == ctor
 * 				isWriteableSymbol := isLocalPropertyDeclaration || isLocalParameterProperty || isLocalThisPropertyAssignment || isLocalThisPropertyAssignmentConstructorFunction
 * 				return !isWriteableSymbol
 * 			}
 * 		}
 * 		return true
 * 	}
 * 	if ast.IsAccessExpression(expr) {
 * 		// references through namespace import should be readonly
 * 		node := ast.SkipParentheses(expr.Expression())
 * 		if ast.IsIdentifier(node) {
 * 			expressionSymbol := c.getResolvedSymbol(node)
 * 			if expressionSymbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 				declaration := c.getDeclarationOfAliasSymbol(expressionSymbol)
 * 				return declaration != nil && ast.IsNamespaceImport(declaration)
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isAssignmentToReadonlyEntity(receiver: GoPtr<Checker>, expr: GoPtr<Node>, symbol_: GoPtr<Symbol>, assignmentKind: AssignmentKind): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.allTypesAssignableToKind","kind":"method","status":"implemented","sigHash":"1b9110d8c8909b92fb685a2cc7d26f2ed33f1be2a83049f068ed17f88926c41d","bodyHash":"90db6af073b40b3077975162ada8681e30bd6b1cbf2e91d9a4ada1f6c0edabca"}
 *
 * Go source:
 * func (c *Checker) allTypesAssignableToKind(source *Type, kind TypeFlags) bool {
 * 	return c.allTypesAssignableToKindEx(source, kind, false)
 * }
 */
export declare function Checker_allTypesAssignableToKind(receiver: GoPtr<Checker>, source: GoPtr<Type>, kind: TypeFlags): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.allTypesAssignableToKindEx","kind":"method","status":"implemented","sigHash":"e09ac7f8c12e09877b4b2d22b414f45f15aa20cc74fe906ea82aeef3786322a3","bodyHash":"98ba3dfbedd2992eb9bc86e1f5477972133cabf477b3435a26efd2225c6a5a2c"}
 *
 * Go source:
 * func (c *Checker) allTypesAssignableToKindEx(source *Type, kind TypeFlags, strict bool) bool {
 * 	if source.flags&TypeFlagsUnion != 0 {
 * 		return core.Every(source.Types(), func(subType *Type) bool {
 * 			return c.allTypesAssignableToKindEx(subType, kind, strict)
 * 		})
 * 	}
 * 	return c.isTypeAssignableToKindEx(source, kind, strict)
 * }
 */
export declare function Checker_allTypesAssignableToKindEx(receiver: GoPtr<Checker>, source: GoPtr<Type>, kind: TypeFlags, strict: bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isTypeAssignableToKind","kind":"method","status":"implemented","sigHash":"f3abfb77c7e5a352e579a284845d461b92f73b0f7b3748643bc6b095d66f5905","bodyHash":"33ea51a706d25e8c8b5cb99404dadccdbc6f0737633732b78b3e5092a32a5867"}
 *
 * Go source:
 * func (c *Checker) isTypeAssignableToKind(source *Type, kind TypeFlags) bool {
 * 	return c.isTypeAssignableToKindEx(source, kind, false)
 * }
 */
export declare function Checker_isTypeAssignableToKind(receiver: GoPtr<Checker>, source: GoPtr<Type>, kind: TypeFlags): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isTypeAssignableToKindEx","kind":"method","status":"implemented","sigHash":"8e70a982561de9f2113e027834a7d92cf711d9429fc83e926f2729d75959192f","bodyHash":"040f2d8318408cc4ba1a096457c28d609a1c11aa322d4404bec9bd97878c98b9"}
 *
 * Go source:
 * func (c *Checker) isTypeAssignableToKindEx(source *Type, kind TypeFlags, strict bool) bool {
 * 	if source.flags&kind != 0 {
 * 		return true
 * 	}
 * 	if strict && source.flags&(TypeFlagsAnyOrUnknown|TypeFlagsVoid|TypeFlagsUndefined|TypeFlagsNull) != 0 {
 * 		return false
 * 	}
 * 	return kind&TypeFlagsNumberLike != 0 && c.isTypeAssignableTo(source, c.numberType) ||
 * 		kind&TypeFlagsBigIntLike != 0 && c.isTypeAssignableTo(source, c.bigintType) ||
 * 		kind&TypeFlagsStringLike != 0 && c.isTypeAssignableTo(source, c.stringType) ||
 * 		kind&TypeFlagsBooleanLike != 0 && c.isTypeAssignableTo(source, c.booleanType) ||
 * 		kind&TypeFlagsVoid != 0 && c.isTypeAssignableTo(source, c.voidType) ||
 * 		kind&TypeFlagsNever != 0 && c.isTypeAssignableTo(source, c.neverType) ||
 * 		kind&TypeFlagsNull != 0 && c.isTypeAssignableTo(source, c.nullType) ||
 * 		kind&TypeFlagsUndefined != 0 && c.isTypeAssignableTo(source, c.undefinedType) ||
 * 		kind&TypeFlagsESSymbol != 0 && c.isTypeAssignableTo(source, c.esSymbolType) ||
 * 		kind&TypeFlagsNonPrimitive != 0 && c.isTypeAssignableTo(source, c.nonPrimitiveType)
 * }
 */
export declare function Checker_isTypeAssignableToKindEx(receiver: GoPtr<Checker>, source: GoPtr<Type>, kind: TypeFlags, strict: bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSingleBaseForNonAugmentingSubtype","kind":"method","status":"implemented","sigHash":"30ec292b3c2546619306b7f80a224782c3249de0fa8de0153b0e4ccdd6200da1","bodyHash":"ce727eba3a53bf99c92906572a9ddf9c773d1fff0df0b59b8334755e0e575e52"}
 *
 * Go source:
 * func (c *Checker) getSingleBaseForNonAugmentingSubtype(t *Type) *Type {
 * 	if t.objectFlags&ObjectFlagsReference == 0 || t.Target().objectFlags&ObjectFlagsClassOrInterface == 0 {
 * 		return nil
 * 	}
 * 	key := CachedTypeKey{kind: CachedTypeKindEquivalentBaseType, typeId: t.id}
 * 	if t.objectFlags&ObjectFlagsIdenticalBaseTypeCalculated != 0 {
 * 		return c.cachedTypes[key]
 * 	}
 * 	t.objectFlags |= ObjectFlagsIdenticalBaseTypeCalculated
 * 	target := t.Target()
 * 	if target.objectFlags&ObjectFlagsClass != 0 {
 * 		baseTypeNode := getBaseTypeNodeOfClass(target)
 * 		// A base type expression may circularly reference the class itself (e.g. as an argument to function call), so we only
 * 		// check for base types specified as simple qualified names.
 * 		if baseTypeNode != nil && !ast.IsIdentifier(baseTypeNode.Expression()) && !ast.IsPropertyAccessExpression(baseTypeNode.Expression()) {
 * 			return nil
 * 		}
 * 	}
 * 	bases := c.getBaseTypes(target)
 * 	if len(bases) != 1 {
 * 		return nil
 * 	}
 * 	if len(c.getMembersOfSymbol(t.symbol)) != 0 {
 * 		// If the interface has any members, they may subtype members in the base, so we should do a full structural comparison
 * 		return nil
 * 	}
 * 	var instantiatedBase *Type
 * 	typeParameters := target.AsInterfaceType().TypeParameters()
 * 	if len(typeParameters) == 0 {
 * 		instantiatedBase = bases[0]
 * 	} else {
 * 		instantiatedBase = c.instantiateType(bases[0], newTypeMapper(typeParameters, c.getTypeArguments(t)[:len(typeParameters)]))
 * 	}
 * 	if len(c.getTypeArguments(t)) > len(typeParameters) {
 * 		instantiatedBase = c.getTypeWithThisArgument(instantiatedBase, core.LastOrNil(c.getTypeArguments(t)), false)
 * 	}
 * 	c.cachedTypes[key] = instantiatedBase
 * 	return instantiatedBase
 * }
 */
export declare function Checker_getSingleBaseForNonAugmentingSubtype(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.markExportAssignmentAliasReferenced","kind":"method","status":"implemented","sigHash":"7ee58c125b603ccb8d4dcbd81822ab7fb96d4e08f4c357eda088def611d79ce7","bodyHash":"ec82712743e6d6033102961b61abbc02ae41ec2dcdfa3ddedd603ff62409c16f"}
 *
 * Go source:
 * func (c *Checker) markExportAssignmentAliasReferenced(location *ast.Node /*ExportAssignment* /) {
 * 	id := location.Expression()
 * 	if ast.IsIdentifier(id) {
 * 		sym := c.getExportSymbolOfValueSymbolIfExported(c.resolveEntityName(id, ast.SymbolFlagsAll, true /*ignoreErrors* /, true /*dontResolveAlias* /, location))
 * 		if sym != nil {
 * 			c.markAliasReferenced(sym, id)
 * 		}
 * 	}
 * }
 */
export declare function Checker_markExportAssignmentAliasReferenced(receiver: GoPtr<Checker>, location: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getContextualTypeForAssignmentExpression","kind":"method","status":"implemented","sigHash":"6008ce5b08bcc3f3256b840ffb2da40c6d808c728e0e86b54e91e6022ec0ee0d","bodyHash":"f7df81578e0daebc6032371b6f6cb942bca67bc0befb1a423a72a57f25f9f399"}
 *
 * Go source:
 * func (c *Checker) getContextualTypeForAssignmentExpression(binary *ast.BinaryExpression) *Type {
 * 	left := binary.Left
 * 	if ast.IsAccessExpression(left) {
 * 		expr := left.Expression()
 * 		switch expr.Kind {
 * 		case ast.KindIdentifier:
 * 			symbol := c.getExportSymbolOfValueSymbolIfExported(c.getResolvedSymbol(expr))
 * 			if symbol.Flags&ast.SymbolFlagsModuleExports != 0 {
 * 				// No contextual type for an expression of the form 'module.exports = expr'.
 * 				return nil
 * 			}
 * 			if binary.Symbol != nil {
 * 				// We have an assignment declaration (a binary expression with a symbol assigned by the binder) of the form
 * 				// 'F.id = expr' or 'F[xxx] = expr'. If 'F' is declared as a variable with a type annotation, we can obtain a
 * 				// contextual type from the annotated type without triggering a circularity. Otherwise, the assignment
 * 				// declaration has no contextual type.
 * 				if symbol.ValueDeclaration != nil && ast.IsVariableDeclaration(symbol.ValueDeclaration) {
 * 					if typeNode := symbol.ValueDeclaration.Type(); typeNode != nil {
 * 						if ast.IsPropertyAccessExpression(left) {
 * 							return c.getTypeOfPropertyOfContextualType(c.getTypeFromTypeNode(typeNode), left.Name().Text())
 * 						}
 * 						nameType := c.checkExpressionCached(left.AsElementAccessExpression().ArgumentExpression)
 * 						if isTypeUsableAsPropertyName(nameType) {
 * 							return c.getTypeOfPropertyOfContextualTypeEx(c.getTypeFromTypeNode(typeNode), getPropertyNameFromType(nameType), nameType)
 * 						}
 * 						return c.getTypeOfExpression(left)
 * 					}
 * 				}
 * 				return nil
 * 			}
 * 		case ast.KindPropertyAccessExpression, ast.KindElementAccessExpression:
 * 			if binary.Symbol != nil {
 * 				return nil
 * 			}
 * 		case ast.KindThisKeyword:
 * 			var symbol *ast.Symbol
 * 			thisType := c.getTypeOfExpression(expr)
 * 			if ast.IsPropertyAccessExpression(left) {
 * 				name := left.Name()
 * 				if ast.IsPrivateIdentifier(name) {
 * 					if thisType.symbol != nil {
 * 						symbol = c.getPropertyOfType(thisType, binder.GetSymbolNameForPrivateIdentifier(thisType.symbol, name.Text()))
 * 					}
 * 				} else {
 * 					symbol = c.getPropertyOfType(thisType, name.Text())
 * 				}
 * 			} else {
 * 				propType := c.checkExpressionCached(left.AsElementAccessExpression().ArgumentExpression)
 * 				if isTypeUsableAsPropertyName(propType) {
 * 					symbol = c.getPropertyOfType(thisType, getPropertyNameFromType(propType))
 * 				}
 * 			}
 * 			if symbol != nil {
 * 				if d := symbol.ValueDeclaration; d != nil && (ast.IsPropertyDeclaration(d) || ast.IsPropertySignatureDeclaration(d)) && d.Type() == nil && d.Initializer() == nil {
 * 					// No contextual type for 'this.xxx = expr', where xxx is declared as a property with no type annotation or initializer.
 * 					return nil
 * 				}
 * 			}
 * 			if binary.Symbol != nil && binary.Symbol.ValueDeclaration != nil && binary.Symbol.ValueDeclaration.Type() == nil {
 * 				// We have an assignment declaration 'this.xxx = expr' with no (synthetic) type annotation
 * 				if !ast.IsObjectLiteralMethod(c.getThisContainer(expr, false, false)) {
 * 					return nil
 * 				}
 * 				// and now for one single case of object literal methods
 * 				name := ast.GetElementOrPropertyAccessName(left)
 * 				if name == nil {
 * 					return nil
 * 				} else {
 * 					// !!! contextual typing for `this` in object literals
 * 					return nil
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return c.getTypeOfExpression(left)
 * }
 */
export declare function Checker_getContextualTypeForAssignmentExpression(receiver: GoPtr<Checker>, binary: GoPtr<BinaryExpression>): GoPtr<Type>;
//# sourceMappingURL=relations.d.ts.map