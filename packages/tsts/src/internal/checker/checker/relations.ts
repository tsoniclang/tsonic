import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import * as slices from "../../../go/slices.js";
import { AppendIfUnique, Every, IfElse, LastOrNil, OrElse } from "../../core/core.js";
import {
  A_default_export_can_only_be_used_in_an_ECMAScript_style_module,
  A_default_export_must_be_at_the_top_level_of_a_file_or_module_declaration,
  A_rest_element_cannot_have_an_initializer,
  A_rest_element_must_be_last_in_a_destructuring_pattern,
  A_rest_parameter_or_binding_pattern_may_not_have_a_trailing_comma,
  An_export_declaration_must_reference_a_real_value_when_verbatimModuleSyntax_is_enabled_but_0_resolves_to_a_type_only_declaration,
  An_export_declaration_must_reference_a_value_when_verbatimModuleSyntax_is_enabled_but_0_only_refers_to_a_type,
  An_export_assignment_cannot_be_used_in_a_namespace,
  An_export_assignment_cannot_have_modifiers,
  An_export_assignment_must_be_at_the_top_level_of_a_file_or_module_declaration,
  An_export_default_must_reference_a_real_value_when_verbatimModuleSyntax_is_enabled_but_0_resolves_to_a_type_only_declaration,
  An_export_default_must_reference_a_value_when_verbatimModuleSyntax_is_enabled_but_0_only_refers_to_a_type,
  Export_assignment_cannot_be_used_when_targeting_ECMAScript_modules_Consider_using_export_default_or_another_module_format_instead,
  Export_assignment_is_not_supported_when_module_flag_is_system,
  Expression_produces_a_union_type_that_is_too_complex_to_represent,
  Interface_0_cannot_simultaneously_extend_types_1_and_2,
  Named_property_0_of_types_1_and_2_are_not_identical,
  Property_assignment_expected,
  The_expression_of_an_export_assignment_must_be_an_identifier_or_qualified_name_in_an_ambient_context,
  The_left_hand_side_of_an_assignment_expression_may_not_be_an_optional_property_access,
  The_left_hand_side_of_an_assignment_expression_must_be_a_variable_or_a_property_access,
  The_target_of_an_object_rest_assignment_may_not_be_an_optional_property_access,
  The_target_of_an_object_rest_assignment_must_be_a_variable_or_a_property_access,
  This_syntax_is_not_allowed_when_erasableSyntaxOnly_is_enabled,
  Type_0_does_not_satisfy_the_expected_type_1,
  Type_0_is_not_assignable_to_type_1_with_exactOptionalPropertyTypes_Colon_true_Consider_adding_undefined_to_the_type_of_the_target,
  X_0_resolves_to_a_type_and_must_be_marked_type_only_in_this_file_before_re_exporting_when_1_is_enabled_Consider_using_export_type_0_as_default,
  X_0_resolves_to_a_type_and_must_be_marked_type_only_in_this_file_before_re_exporting_when_1_is_enabled_Consider_using_import_type_where_0_is_imported,
  X_0_resolves_to_a_type_only_declaration_and_must_be_marked_type_only_in_this_file_before_re_exporting_when_1_is_enabled_Consider_using_export_type_0_as_default,
  X_0_resolves_to_a_type_only_declaration_and_must_be_marked_type_only_in_this_file_before_re_exporting_when_1_is_enabled_Consider_using_import_type_where_0_is_imported,
} from "../../diagnostics/generated/messages.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import type { Node, NodeList } from "../../ast/spine.js";
import type { BinaryExpression, ShorthandPropertyAssignment } from "../../ast/generated/data.js";
import type { Declaration } from "../../ast/generated/unions.js";
import { KindEqualsToken, KindElementAccessExpression, KindIdentifier, KindPropertyAccessExpression, KindSpreadElement, KindThisKeyword } from "../../ast/generated/kinds.js";
import type { Kind } from "../../ast/generated/kinds.js";
import type { Symbol } from "../../ast/symbol.js";
import {
  IsAccessExpression,
  IsAmbientModule,
  GetSourceFileOfNode,
  IsEntityNameExpression,
  NewHasFileName,
  SkipParentheses,
} from "../../ast/utilities.js";
import {
  IsArrayLiteralExpression,
  IsBinaryExpression,
  IsCallExpression,
  IsComputedPropertyName,
  IsConstructorDeclaration,
  IsElementAccessExpression,
  IsExportAssignment,
  IsIdentifier,
  IsModuleDeclaration,
  IsNamespaceImport,
  IsObjectLiteralExpression,
  IsOmittedExpression,
  IsParameterDeclaration,
  IsPrivateIdentifier,
  IsPropertyAccessExpression,
  IsPropertyAssignment,
  IsPropertyDeclaration,
  IsPropertySignatureDeclaration,
  IsShorthandPropertyAssignment,
  IsSourceFile,
  IsSpreadAssignment,
  IsSpreadElement,
  IsVariableDeclaration,
} from "../../ast/generated/predicates.js";
import { AsExportAssignment, AsBinaryExpression, AsElementAccessExpression, AsShorthandPropertyAssignment } from "../../ast/generated/casts.js";
import { NodeFlagsAmbient, NodeFlagsReparsed } from "../../ast/generated/flags.js";
import { SymbolFlagsAlias, SymbolFlagsAll, SymbolFlagsModuleExports, SymbolFlagsProperty, SymbolFlagsType, SymbolFlagsValue } from "../../ast/generated/flags.js";
import { GetAssignmentDeclarationKind, GetRightMostAssignedExpression, IsCompoundAssignment, IsInJSFile, IsObjectLiteralMethod, GetElementOrPropertyAccessName, JSDeclarationKindExportsProperty, JSDeclarationKindModuleExports } from "../../ast/utilities.js";
import { IsDeclarationNode, Node_Arguments, Node_Symbol, Node_Text, SourceFile_FileName, SourceFile_Path } from "../../ast/ast.js";
import { IsAssignmentOperator } from "../../ast/generated/predicates.js";
import { GetSymbolNameForPrivateIdentifier } from "../../binder/binder.js";
import { Node_Expression, Node_Type, Node_ElementList, Node_PropertyList, Node_Properties, Node_Elements, Node_Initializer } from "../../ast/ast.js";
import { Node_Modifiers, Node_Name } from "../../ast/spine.js";
import { NewDiagnosticChain } from "../../ast/diagnostic.js";
import { DiagnosticsCollection_Add } from "../../ast/diagnostic.js";
import { AssignmentKindNone, getSelectedModifierFlags, isOptionalDeclaration, isTypeUsableAsPropertyName, getPropertyNameFromType, NewDiagnosticForNode } from "../utilities.js";
import { ModifierFlagsAbstract, ModifierFlagsAsync, ModifierFlagsPrivate, ModifierFlagsProtected, ModifierFlagsReadonly, ModifierFlagsStatic } from "../../ast/modifierflags.js";
import { Checker_compareTypesIdentical, Checker_isTypeAssignableTo, Checker_isTypeComparableTo, Checker_checkTypeAssignableToAndOptionallyElaborate, Checker_isTypeDerivedFrom, Checker_isTypeRelatedTo } from "../relater.js";
import { TernaryFalse } from "../types.js";
import { AccessFlagsAllowMissing, AccessFlagsExpressionPosition } from "../types.js";
import type { AccessFlags } from "../types.js";
import { Checker_IsEmptyAnonymousObjectType, Checker_getWidenedType, Checker_getUnionType, Checker_filterType, Checker_getNumberLiteralType, Checker_createArrayType, Checker_mapType, Checker_getTypeWithFacts, Checker_getRegularTypeOfLiteralType, Checker_checkNonNullType, Checker_hasTypeFacts, Checker_getTypeFromTypeNode, Checker_maybeTypeOfKind, Checker_checkIteratedTypeOrElementType, Checker_isArrayLikeType, Checker_getPropertiesOfType, Checker_getBaseTypes, Checker_getTypeOfExpression, Checker_instantiateType, Checker_isGenericMappedType, Checker_isEmptyResolvedType, Checker_getTargetType } from "./types.js";
import { Checker_getTypeOfPropertyOfType, Checker_resolveDeclaredMembers, Checker_isNamedMember, Checker_getLiteralTypeFromPropertyName, Checker_getPropertyOfType, Checker_markPropertyAsReferenced, Checker_checkPropertyAccessibility, Checker_getIndexedAccessTypeEx, Checker_getIndexedAccessTypeOrUndefined, Checker_getTypeOfPropertyInBaseClass, Checker_getExportSymbolOfValueSymbolIfExported, Checker_resolveEntityName, Checker_getTypeOnlyAliasDeclarationEx, Checker_getSymbolFlagsEx, Checker_getSymbolFlags, Checker_getDeclarationOfAliasSymbol, Checker_markAliasReferenced, Checker_checkPropertyAccessExpression, Checker_getTypeFromPropertyDescriptor, Checker_checkExternalModuleExports, Checker_isReadonlySymbol, Checker_getResolvedSymbol, Checker_checkComputedPropertyName, Checker_getTypeOfPropertyOfContextualType, Checker_getTypeOfPropertyOfContextualTypeEx, Checker_getMembersOfSymbol, Checker_resolveStructuredTypeMembers } from "./symbols.js";
import { Checker_getTypeWithThisArgument, Checker_isConstructorDeclaredThisProperty, Checker_getRestType, Checker_getTypeArguments } from "./signatures.js";
import { Checker_getTypeOfSymbol } from "./symbols.js";
import { Checker_isExactOptionalPropertyMismatch } from "./symbols.js";
import { Checker_checkSourceElement, Checker_error, Checker_shouldCheckErasableSyntax } from "./support.js";
import { Checker_compareProperties } from "./support.js";
import { Checker_checkExpression, Checker_checkExpressionCached, Checker_checkExpressionForMutableLocation, Checker_checkExpressionEx, Checker_checkBinaryExpression, Checker_checkBinaryLikeExpression, Checker_checkReferenceExpression, Checker_createSyntheticExpression } from "./syntax-checking.js";
import { Checker_getFlowTypeOfDestructuring, Checker_getControlFlowContainer } from "./flow-narrowing.js";
import { Checker_hasDefaultValue, Checker_getThisContainer } from "./support-queries.js";
import { Checker_reportImplicitAny } from "./types.js";
import { Checker_markSymbolOfAliasDeclarationIfTypeOnly, Checker_getTargetOfAliasLikeExpression } from "./symbols.js";
import { Checker_grammarErrorOnNode, Checker_grammarErrorOnFirstToken, Checker_checkGrammarModifiers, Checker_checkGrammarModuleElementContext, Checker_checkGrammarForDisallowedTrailingComma } from "../grammarchecks.js";
import { Checker_addTypeOnlyDeclarationRelatedInfo, Checker_isErrorType as _Checker_isErrorType } from "./diagnostics.js";
import { Checker_getIsolatedModulesLikeFlagName } from "./symbols.js";
import { Checker_markLinkedReferences } from "./support-queries.js";
import { Checker_isErrorType } from "./diagnostics.js";
import { Checker_getFlowTypeInConstructor } from "../flow.js";
import { Checker_TypeToString, Checker_symbolToString } from "../printer.js";
import {
  CheckModeNormal,
  CachedTypeKindEquivalentBaseType,
  IterationUseDestructuring,
  IterationUsePossiblyOutOfBounds,
  ReferenceHintExportAssignment,
  TypeFactsIsUndefined,
  TypeFactsNEUndefined,
  WideningKindNormal,
  everyType,
  getBooleanLiteralValue,
  getTypeListKey,
  getVerbatimModuleSyntaxErrorMessage,
  isTupleType,
  isUnitType,
  thisAssignmentDeclarationConstructor,
  thisAssignmentDeclarationMethod,
  thisAssignmentDeclarationTyped,
  getBaseTypeNodeOfClass,
} from "./state.js";
import type { CachedTypeKey, InheritanceInfo, TypeFacts, WideningKind } from "./state.js";
import { Checker_getBaseConstraintOrType } from "./inference.js";
import { Tracer_Instant } from "../tracer.js";
import { PhaseCheckTypes } from "../../tracing/tracing.js";
import { Checker_sliceTupleType } from "../relater.js";
import {
  ObjectFlagsClass,
  ObjectFlagsClassOrInterface,
  ObjectFlagsIdenticalBaseTypeCalculated,
  ObjectFlagsReference,
  InterfaceType_TypeParameters,
  Type_AsInterfaceType,
  Type_Target,
  Type_Types,
  TypeFlagsAnyOrUnknown,
  TypeFlagsBigInt,
  TypeFlagsBigIntLike,
  TypeFlagsBigIntLiteral,
  TypeFlagsBooleanLike,
  TypeFlagsBooleanLiteral,
  TypeFlagsDefinitelyNonNullable,
  TypeFlagsESSymbol,
  TypeFlagsNever,
  TypeFlagsNonPrimitive,
  TypeFlagsNull,
  TypeFlagsNullable,
  TypeFlagsNumber,
  TypeFlagsNumberLike,
  TypeFlagsNumberLiteral,
  TypeFlagsObject,
  TypeFlagsString,
  TypeFlagsStringLike,
  TypeFlagsStringLiteral,
  TypeFlagsStringMapping,
  TypeFlagsIntersection,
  TypeFlagsInstantiableNonPrimitive,
  TypeFlagsTemplateLiteral,
  TypeFlagsTypeParameter,
  TypeFlagsStructuredOrInstantiable,
  TypeFlagsUndefined,
  TypeFlagsUnion,
  TypeFlagsUniqueESSymbol,
  TypeFlagsVoid,
} from "../types.js";
import type { Type, TypeAlias, TypeFlags } from "../types.js";
import type { LinkStore } from "../../core/linkstore.js";
import { LinkStore_Get } from "../../core/linkstore.js";
import { TSTrue } from "../../core/tristate.js";
import { CompilerOptions_GetIsolatedModules, ModuleKindCommonJS, ModuleKindES2015, ModuleKindESNext, ModuleKindPreserve, ModuleKindSystem } from "../../core/compileroptions.js";
import type { SymbolNodeLinks } from "../types.js";
import type { AssignmentKind } from "../utilities.js";
import type { Checker, CheckMode } from "./state.js";
import { newTypeMapper } from "../mapper.js";

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
export function Checker_checkInheritedPropertiesAreIdentical(receiver: GoPtr<Checker>, t: GoPtr<Type>, typeNode: GoPtr<Node>): bool {
  const baseTypes = Checker_getBaseTypes(receiver, t);
  if (baseTypes.length < 2) {
    return true;
  }
  const seen = new globalThis.Map<string, InheritanceInfo>();
  const declaredMembers = Checker_resolveDeclaredMembers(receiver, t)!.declaredMembers;
  for (const [id, p] of declaredMembers) {
    if (Checker_isNamedMember(receiver, p, id)) {
      seen.set(p!.Name, { prop: p, containingType: t });
    }
  }
  let identical = true;
  for (const base of baseTypes) {
    const properties = Checker_getPropertiesOfType(receiver, Checker_getTypeWithThisArgument(receiver, base, Type_AsInterfaceType(t)!.thisType, false));
    for (const prop of properties) {
      const existing = seen.get(prop!.Name);
      if (existing === undefined) {
        seen.set(prop!.Name, { prop: prop, containingType: base });
      } else {
        const isInheritedProperty = existing.containingType !== t;
        if (isInheritedProperty && !Checker_isPropertyIdenticalTo(receiver, existing.prop, prop)) {
          identical = false;
          const typeName1 = Checker_TypeToString(receiver, existing.containingType);
          const typeName2 = Checker_TypeToString(receiver, base);
          const errorInfo = NewDiagnosticForNode(typeNode, Named_property_0_of_types_1_and_2_are_not_identical, Checker_symbolToString(receiver, prop), typeName1, typeName2);
          DiagnosticsCollection_Add(receiver!.diagnostics, NewDiagnosticChain(errorInfo, Interface_0_cannot_simultaneously_extend_types_1_and_2, Checker_TypeToString(receiver, t), typeName1, typeName2));
        }
      }
    }
  }
  return identical;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isPropertyIdenticalTo","kind":"method","status":"implemented","sigHash":"578bd58756cb448b6d4f02d3f72beb3a6bcf54392f9e12fcc782e0481b453676","bodyHash":"eda6ce5e33399402099106e8ab0c3b954a688591baa557fbb0d9fb9bd2f7d83a"}
 *
 * Go source:
 * func (c *Checker) isPropertyIdenticalTo(sourceProp *ast.Symbol, targetProp *ast.Symbol) bool {
 * 	return c.compareProperties(sourceProp, targetProp, c.compareTypesIdentical) != TernaryFalse
 * }
 */
export function Checker_isPropertyIdenticalTo(receiver: GoPtr<Checker>, sourceProp: GoPtr<Symbol>, targetProp: GoPtr<Symbol>): bool {
  return Checker_compareProperties(receiver, sourceProp, targetProp, (s: GoPtr<Type>, t: GoPtr<Type>) => Checker_compareTypesIdentical(receiver, s, t)) !== TernaryFalse;
}

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
export function Checker_checkExportAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const isExportEquals = AsExportAssignment(node)!.IsExportEquals;
  const illegalContextMessage = IfElse(
    isExportEquals,
    An_export_assignment_must_be_at_the_top_level_of_a_file_or_module_declaration,
    A_default_export_must_be_at_the_top_level_of_a_file_or_module_declaration,
  );
  if (Checker_checkGrammarModuleElementContext(receiver, node, illegalContextMessage)) {
    return;
  }
  if (Checker_shouldCheckErasableSyntax(receiver, node) && AsExportAssignment(node)!.IsExportEquals && (node!.Flags & NodeFlagsAmbient) === 0) {
    Checker_error(receiver, node, This_syntax_is_not_allowed_when_erasableSyntaxOnly_is_enabled);
  }
  let container = node!.Parent;
  if (!IsSourceFile(container)) {
    container = container!.Parent;
  }
  if (IsModuleDeclaration(container) && !IsAmbientModule(container)) {
    if (isExportEquals) {
      Checker_error(receiver, node, An_export_assignment_cannot_be_used_in_a_namespace);
    } else {
      Checker_error(receiver, node, A_default_export_can_only_be_used_in_an_ECMAScript_style_module);
    }
    return;
  }
  if (!Checker_checkGrammarModifiers(receiver, node) && IsExportAssignment(node) && Node_Modifiers(node) !== undefined) {
    Checker_grammarErrorOnFirstToken(receiver, node, An_export_assignment_cannot_have_modifiers);
  }
  const sourceFile = GetSourceFileOfNode(node);
  const sourceFileName = NewHasFileName(SourceFile_FileName(sourceFile), SourceFile_Path(sourceFile));
  const compilerOptions = receiver!.compilerOptions!;
  const isIllegalExportDefaultInCJS = (!isExportEquals && (node!.Flags & NodeFlagsAmbient) === 0 && compilerOptions.VerbatimModuleSyntax === TSTrue && receiver!.program.GetEmitModuleFormatOfFile(sourceFileName) === ModuleKindCommonJS) as bool;
  if (IsIdentifier(Node_Expression(node))) {
    const id = Node_Expression(node);
    const sym = Checker_getExportSymbolOfValueSymbolIfExported(receiver, Checker_resolveEntityName(receiver, id, SymbolFlagsAll, true, true, node));
    if (sym !== undefined) {
      Checker_markLinkedReferences(receiver, node, ReferenceHintExportAssignment, undefined, undefined);
      const typeOnlyDeclaration = Checker_getTypeOnlyAliasDeclarationEx(receiver, sym, SymbolFlagsValue);
      if ((Checker_getSymbolFlags(receiver, sym) & SymbolFlagsValue) !== 0) {
        Checker_checkExpressionCached(receiver, id);
        if (!isIllegalExportDefaultInCJS && (node!.Flags & NodeFlagsAmbient) === 0 && compilerOptions.VerbatimModuleSyntax === TSTrue && typeOnlyDeclaration !== undefined) {
          const message = IfElse(
            isExportEquals,
            An_export_declaration_must_reference_a_real_value_when_verbatimModuleSyntax_is_enabled_but_0_resolves_to_a_type_only_declaration,
            An_export_default_must_reference_a_real_value_when_verbatimModuleSyntax_is_enabled_but_0_resolves_to_a_type_only_declaration,
          );
          Checker_error(receiver, id, message, Node_Text(id));
        }
      } else if (!isIllegalExportDefaultInCJS && (node!.Flags & NodeFlagsAmbient) === 0 && compilerOptions.VerbatimModuleSyntax === TSTrue) {
        const message = IfElse(
          isExportEquals,
          An_export_declaration_must_reference_a_value_when_verbatimModuleSyntax_is_enabled_but_0_only_refers_to_a_type,
          An_export_default_must_reference_a_value_when_verbatimModuleSyntax_is_enabled_but_0_only_refers_to_a_type,
        );
        Checker_error(receiver, id, message, Node_Text(id));
      }
      if (!isIllegalExportDefaultInCJS && (node!.Flags & NodeFlagsAmbient) === 0 && CompilerOptions_GetIsolatedModules(compilerOptions) && (sym!.Flags & SymbolFlagsValue) === 0) {
        const nonLocalMeanings = Checker_getSymbolFlagsEx(receiver, sym, false, true);
        if ((sym!.Flags & SymbolFlagsAlias) !== 0 && (nonLocalMeanings & SymbolFlagsType) !== 0 && (nonLocalMeanings & SymbolFlagsValue) === 0 && (typeOnlyDeclaration === undefined || GetSourceFileOfNode(typeOnlyDeclaration) !== sourceFile)) {
          const message = IfElse(
            isExportEquals,
            X_0_resolves_to_a_type_and_must_be_marked_type_only_in_this_file_before_re_exporting_when_1_is_enabled_Consider_using_import_type_where_0_is_imported,
            X_0_resolves_to_a_type_and_must_be_marked_type_only_in_this_file_before_re_exporting_when_1_is_enabled_Consider_using_export_type_0_as_default,
          );
          Checker_error(receiver, id, message, Node_Text(id), Checker_getIsolatedModulesLikeFlagName(receiver));
        } else if (typeOnlyDeclaration !== undefined && GetSourceFileOfNode(typeOnlyDeclaration) !== sourceFile) {
          const message = IfElse(
            isExportEquals,
            X_0_resolves_to_a_type_only_declaration_and_must_be_marked_type_only_in_this_file_before_re_exporting_when_1_is_enabled_Consider_using_import_type_where_0_is_imported,
            X_0_resolves_to_a_type_only_declaration_and_must_be_marked_type_only_in_this_file_before_re_exporting_when_1_is_enabled_Consider_using_export_type_0_as_default,
          );
          Checker_addTypeOnlyDeclarationRelatedInfo(receiver, Checker_error(receiver, id, message, Node_Text(id), Checker_getIsolatedModulesLikeFlagName(receiver)), typeOnlyDeclaration, Node_Text(id));
        }
      }
    } else {
      Checker_checkExpressionCached(receiver, id);
    }
  } else {
    Checker_checkExpressionCached(receiver, Node_Expression(node));
  }
  if (isIllegalExportDefaultInCJS) {
    Checker_error(receiver, node, getVerbatimModuleSyntaxErrorMessage(node));
  }
  Checker_checkExternalModuleExports(receiver, container);
  const typeNode = Node_Type(node);
  if (typeNode !== undefined && IsExportAssignment(node)) {
    const targetType = Checker_getTypeFromTypeNode(receiver, typeNode);
    const initializerType = Checker_checkExpressionCached(receiver, Node_Expression(node));
    Checker_checkTypeAssignableToAndOptionallyElaborate(receiver, initializerType, targetType, Node_Expression(node), Node_Expression(node), undefined, undefined);
  }
  if ((node!.Flags & NodeFlagsAmbient) !== 0 && !IsEntityNameExpression(Node_Expression(node))) {
    Checker_grammarErrorOnNode(receiver, Node_Expression(node), The_expression_of_an_export_assignment_must_be_an_identifier_or_qualified_name_in_an_ambient_context);
  }
  if (isExportEquals) {
    const impliedNodeFormat = receiver!.program.GetImpliedNodeFormatForEmit(sourceFileName);
    if (receiver!.moduleKind >= ModuleKindES2015 && receiver!.moduleKind !== ModuleKindPreserve && (((node!.Flags & NodeFlagsAmbient) !== 0 && impliedNodeFormat === ModuleKindESNext) || ((node!.Flags & NodeFlagsAmbient) === 0 && impliedNodeFormat !== ModuleKindCommonJS))) {
      Checker_grammarErrorOnNode(receiver, node, Export_assignment_cannot_be_used_when_targeting_ECMAScript_modules_Consider_using_export_default_or_another_module_format_instead);
    } else if (receiver!.moduleKind === ModuleKindSystem && (node!.Flags & NodeFlagsAmbient) === 0) {
      Checker_grammarErrorOnNode(receiver, node, Export_assignment_is_not_supported_when_module_flag_is_system);
    }
  }
}

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
export function Checker_areDeclarationFlagsIdentical(receiver: GoPtr<Checker>, left: GoPtr<Declaration>, right: GoPtr<Declaration>): bool {
  if ((IsParameterDeclaration(left as GoPtr<Node>) && IsVariableDeclaration(right as GoPtr<Node>)) || (IsVariableDeclaration(left as GoPtr<Node>) && IsParameterDeclaration(right as GoPtr<Node>))) {
    return true;
  }
  if (isOptionalDeclaration(left as GoPtr<Node>) !== isOptionalDeclaration(right as GoPtr<Node>)) {
    return false;
  }
  const interestingFlags = ModifierFlagsPrivate | ModifierFlagsProtected | ModifierFlagsAsync | ModifierFlagsAbstract | ModifierFlagsReadonly | ModifierFlagsStatic;
  return (getSelectedModifierFlags(left as GoPtr<Node>, interestingFlags) === getSelectedModifierFlags(right as GoPtr<Node>, interestingFlags)) as bool;
}

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
export function Checker_checkSatisfiesExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const typeNode = Node_Type(node);
  Checker_checkSourceElement(receiver, typeNode);
  const exprType = Checker_checkExpression(receiver, Node_Expression(node));
  const targetType = Checker_getTypeFromTypeNode(receiver, typeNode);
  if (Checker_isErrorType(receiver, targetType)) {
    return targetType;
  }
  const errorNode = IfElse((typeNode!.Flags & NodeFlagsReparsed) !== 0, typeNode, node);
  Checker_checkTypeAssignableToAndOptionallyElaborate(receiver, exprType, targetType, errorNode, Node_Expression(node), Type_0_does_not_satisfy_the_expected_type_1, undefined);
  return exprType;
}

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
export function Checker_checkDestructuringAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>, sourceType: GoPtr<Type>, checkMode: CheckMode, rightIsThis: bool): GoPtr<Type> {
  let target: GoPtr<Node>;
  if (IsShorthandPropertyAssignment(node)) {
    const initializer = AsShorthandPropertyAssignment(node)!.ObjectAssignmentInitializer;
    if (initializer !== undefined) {
      if (receiver!.strictNullChecks && !(Checker_hasTypeFacts(receiver, Checker_checkExpression(receiver, initializer), TypeFactsIsUndefined))) {
        sourceType = Checker_getTypeWithFacts(receiver, sourceType, TypeFactsNEUndefined);
      }
      Checker_checkBinaryLikeExpression(receiver, Node_Name(node), AsShorthandPropertyAssignment(node)!.EqualsToken, initializer, checkMode, undefined);
    }
    target = Node_Name(node);
  } else {
    target = node;
  }
  if (IsBinaryExpression(target) && AsBinaryExpression(target)!.OperatorToken!.Kind === KindEqualsToken) {
    Checker_checkBinaryExpression(receiver, target, checkMode);
    target = AsBinaryExpression(target)!.Left as unknown as GoPtr<Node>;
    if (receiver!.strictNullChecks) {
      sourceType = Checker_getTypeWithFacts(receiver, sourceType, TypeFactsNEUndefined);
    }
  }
  if (IsObjectLiteralExpression(target)) {
    return Checker_checkObjectLiteralAssignment(receiver, target, sourceType, rightIsThis);
  }
  if (IsArrayLiteralExpression(target)) {
    return Checker_checkArrayLiteralAssignment(receiver, target, sourceType, checkMode);
  }
  return Checker_checkReferenceAssignment(receiver, target, sourceType, checkMode);
}

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
export function Checker_checkObjectLiteralAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>, sourceType: GoPtr<Type>, rightIsThis: bool): GoPtr<Type> {
  const properties = Node_PropertyList(node);
  if (receiver!.strictNullChecks && properties!.Nodes.length === 0) {
    return Checker_checkNonNullType(receiver, sourceType, node);
  }
  for (let i = 0; i < properties!.Nodes.length; i++) {
    Checker_checkObjectLiteralDestructuringPropertyAssignment(receiver, node, sourceType, i, properties, rightIsThis);
  }
  return sourceType;
}

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
export function Checker_checkObjectLiteralDestructuringPropertyAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>, objectLiteralType: GoPtr<Type>, propertyIndex: int, allProperties: GoPtr<NodeList>, rightIsThis: bool): GoPtr<Type> {
  const properties = Node_Properties(node);
  const property = properties![propertyIndex];
  if (IsPropertyAssignment(property) || IsShorthandPropertyAssignment(property)) {
    const name = Node_Name(property);
    const exprType = Checker_getLiteralTypeFromPropertyName(receiver, name);
    if (isTypeUsableAsPropertyName(exprType)) {
      const text = getPropertyNameFromType(exprType);
      const prop = Checker_getPropertyOfType(receiver, objectLiteralType, text);
      if (prop !== undefined) {
        Checker_markPropertyAsReferenced(receiver, prop, property, rightIsThis);
        Checker_checkPropertyAccessibility(receiver, property, false as bool, true as bool, objectLiteralType, prop);
      }
    }
    const elementType = Checker_getIndexedAccessTypeEx(receiver, objectLiteralType, exprType, (AccessFlagsExpressionPosition | (Checker_hasDefaultValue(receiver, property) ? AccessFlagsAllowMissing : 0)) as AccessFlags, name, undefined);
    const t = Checker_getFlowTypeOfDestructuring(receiver, property, elementType);
    let expr = property;
    if (IsPropertyAssignment(property)) {
      expr = Node_Initializer(property) as unknown as GoPtr<Node>;
    }
    return Checker_checkDestructuringAssignment(receiver, expr, t, CheckModeNormal, false as bool);
  }
  if (IsSpreadAssignment(property)) {
    if (propertyIndex < properties!.length - 1) {
      Checker_error(receiver, property, A_rest_element_must_be_last_in_a_destructuring_pattern, undefined);
      return undefined;
    }
    let nonRestNames: GoSlice<GoPtr<Node>> = [];
    if (allProperties !== undefined) {
      for (let i = 0; i < allProperties.Nodes.length; i++) {
        const otherProperty = allProperties.Nodes[i];
        if (!IsSpreadAssignment(otherProperty)) {
          nonRestNames = [...nonRestNames, Node_Name(otherProperty)];
        }
      }
    }
    const t = Checker_getRestType(receiver, objectLiteralType, nonRestNames, objectLiteralType!["symbol"]);
    Checker_checkGrammarForDisallowedTrailingComma(receiver, allProperties, A_rest_parameter_or_binding_pattern_may_not_have_a_trailing_comma);
    return Checker_checkDestructuringAssignment(receiver, Node_Expression(property), t, CheckModeNormal, false as bool);
  }
  Checker_error(receiver, property, Property_assignment_expected, undefined);
  return undefined;
}

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
export function Checker_checkArrayLiteralAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>, sourceType: GoPtr<Type>, checkMode: CheckMode): GoPtr<Type> {
  const elements = Node_Elements(node);
  const possiblyOutOfBoundsType = OrElse(Checker_checkIteratedTypeOrElementType(receiver, (IterationUseDestructuring | IterationUsePossiblyOutOfBounds) as unknown as int, sourceType, receiver!.undefinedType, node), receiver!.errorType);
  let inBoundsType: GoPtr<Type> = IfElse(receiver!.compilerOptions!.NoUncheckedIndexedAccess === TSTrue, undefined, possiblyOutOfBoundsType);
  for (let i = 0; i < elements!.length; i++) {
    let t = possiblyOutOfBoundsType;
    if (elements![i]!.Kind === KindSpreadElement) {
      if (inBoundsType === undefined) {
        inBoundsType = OrElse(Checker_checkIteratedTypeOrElementType(receiver, IterationUseDestructuring as unknown as int, sourceType, receiver!.undefinedType, node), receiver!.errorType);
      }
      t = inBoundsType;
    }
    Checker_checkArrayLiteralDestructuringElementAssignment(receiver, node, sourceType, i, t, checkMode);
  }
  return sourceType;
}

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
export function Checker_checkArrayLiteralDestructuringElementAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>, sourceType: GoPtr<Type>, elementIndex: int, elementType: GoPtr<Type>, checkMode: CheckMode): GoPtr<Type> {
  const elements = Node_ElementList(node);
  const element = elements!.Nodes[elementIndex];
  if (!IsOmittedExpression(element)) {
    if (!IsSpreadElement(element)) {
      const indexType = Checker_getNumberLiteralType(receiver, elementIndex);
      if (Checker_isArrayLikeType(receiver, sourceType)) {
        const accessFlags = (AccessFlagsExpressionPosition | (Checker_hasDefaultValue(receiver, element) ? AccessFlagsAllowMissing : 0)) as AccessFlags;
        let localElementType: GoPtr<Type> = OrElse(Checker_getIndexedAccessTypeOrUndefined(receiver, sourceType, indexType, accessFlags, Checker_createSyntheticExpression(receiver, element, indexType, false as bool, undefined), undefined), receiver!.errorType);
        let assignedType = localElementType;
        if (Checker_hasDefaultValue(receiver, element)) {
          assignedType = Checker_getTypeWithFacts(receiver, localElementType, TypeFactsNEUndefined);
        }
        const t = Checker_getFlowTypeOfDestructuring(receiver, element, assignedType);
        return Checker_checkDestructuringAssignment(receiver, element, t, checkMode, false as bool);
      }
      return Checker_checkDestructuringAssignment(receiver, element, elementType, checkMode, false as bool);
    }
    if (elementIndex < elements!.Nodes.length - 1) {
      Checker_error(receiver, element, A_rest_element_must_be_last_in_a_destructuring_pattern, undefined);
    } else {
      const restExpression = Node_Expression(element);
      if (IsBinaryExpression(restExpression) && AsBinaryExpression(restExpression)!.OperatorToken!.Kind === KindEqualsToken) {
        Checker_error(receiver, AsBinaryExpression(restExpression)!.OperatorToken as unknown as GoPtr<Node>, A_rest_element_cannot_have_an_initializer, undefined);
      } else {
        Checker_checkGrammarForDisallowedTrailingComma(receiver, elements, A_rest_parameter_or_binding_pattern_may_not_have_a_trailing_comma);
        let t: GoPtr<Type>;
        if (everyType(sourceType, isTupleType)) {
          t = Checker_mapType(receiver, sourceType, (type: GoPtr<Type>): GoPtr<Type> => Checker_sliceTupleType(receiver, type, elementIndex, 0));
        } else {
          t = Checker_createArrayType(receiver, elementType);
        }
        return Checker_checkDestructuringAssignment(receiver, restExpression, t, checkMode, false as bool);
      }
    }
  }
  return undefined;
}

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
export function Checker_checkReferenceAssignment(receiver: GoPtr<Checker>, target: GoPtr<Node>, sourceType: GoPtr<Type>, checkMode: CheckMode): GoPtr<Type> {
  const targetType = Checker_checkExpressionEx(receiver, target, checkMode);
  const message = IfElse(IsSpreadAssignment(target!.Parent), The_target_of_an_object_rest_assignment_must_be_a_variable_or_a_property_access, The_left_hand_side_of_an_assignment_expression_must_be_a_variable_or_a_property_access);
  const optionalMessage = IfElse(IsSpreadAssignment(target!.Parent), The_target_of_an_object_rest_assignment_may_not_be_an_optional_property_access, The_left_hand_side_of_an_assignment_expression_may_not_be_an_optional_property_access);
  if (Checker_checkReferenceExpression(receiver, target, message, optionalMessage)) {
    Checker_checkTypeAssignableToAndOptionallyElaborate(receiver, sourceType, targetType, target, target, undefined, undefined);
  }
  return sourceType;
}

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
export function Checker_checkAssignmentOperator(receiver: GoPtr<Checker>, left: GoPtr<Node>, operator: Kind, right: GoPtr<Node>, leftType: GoPtr<Type>, rightType: GoPtr<Type>): void {
  if (IsAssignmentOperator(operator)) {
    if (IsDeclarationNode(left!.Parent) && GetAssignmentDeclarationKind(left!.Parent) === JSDeclarationKindExportsProperty) {
      const symbol_ = (LinkStore_Get<GoPtr<Node>, SymbolNodeLinks>(receiver!.symbolNodeLinks as unknown as LinkStore<GoPtr<Node>, SymbolNodeLinks>, left) as SymbolNodeLinks).resolvedSymbol;
      if (symbol_ !== undefined && symbol_!.Declarations !== undefined && symbol_!.Declarations.length > 1 && (rightType!.flags & TypeFlagsUndefined) !== 0) {
        return;
      }
    }
    let localLeftType = leftType;
    if (IsCompoundAssignment(operator) && IsPropertyAccessExpression(left)) {
      localLeftType = Checker_checkPropertyAccessExpression(receiver, left, CheckModeNormal, true as bool);
    }
    if (Checker_checkReferenceExpression(receiver, left, The_left_hand_side_of_an_assignment_expression_must_be_a_variable_or_a_property_access, The_left_hand_side_of_an_assignment_expression_may_not_be_an_optional_property_access)) {
      let headMessage: GoPtr<Message>;
      if (receiver!.exactOptionalPropertyTypes && IsPropertyAccessExpression(left) && Checker_maybeTypeOfKind(receiver, rightType, TypeFlagsUndefined)) {
        const target = Checker_getTypeOfPropertyOfType(receiver, Checker_getTypeOfExpression(receiver, Node_Expression(left)), Node_Text(Node_Name(left)!));
        if (Checker_isExactOptionalPropertyMismatch(receiver, rightType, target)) {
          headMessage = Type_0_is_not_assignable_to_type_1_with_exactOptionalPropertyTypes_Colon_true_Consider_adding_undefined_to_the_type_of_the_target;
        }
      }
      Checker_checkTypeAssignableToAndOptionallyElaborate(receiver, rightType, localLeftType, left, right, headMessage, undefined);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isTypeEqualityComparableTo","kind":"method","status":"implemented","sigHash":"3497f93993ecb137da2fcf3b9b563135e7ae17f24ae03e67f0789f730cc69565","bodyHash":"2e585fe440ba922f670372efa91c08459e0637cd17787c5371fb5b6dbe8cd211"}
 *
 * Go source:
 * func (c *Checker) isTypeEqualityComparableTo(source *Type, target *Type) bool {
 * 	return (target.flags&TypeFlagsNullable) != 0 || c.isTypeComparableTo(source, target)
 * }
 */
export function Checker_isTypeEqualityComparableTo(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  return (target!.flags & TypeFlagsNullable) !== 0 || Checker_isTypeComparableTo(receiver, source, target);
}

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
export function Checker_checkPropertyAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  if (IsComputedPropertyName(Node_Name(node))) {
    Checker_checkComputedPropertyName(receiver, Node_Name(node));
  }
  const initializerType = Checker_checkExpressionForMutableLocation(receiver, Node_Initializer(node) as unknown as GoPtr<Node>, checkMode);
  const typeNode = Node_Type(node);
  if (typeNode !== undefined) {
    const t = Checker_getTypeFromTypeNode(receiver, typeNode);
    Checker_checkTypeAssignableToAndOptionallyElaborate(receiver, initializerType, t, node, Node_Initializer(node) as unknown as GoPtr<Node>, undefined, undefined);
    return t;
  }
  return initializerType;
}

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
export function Checker_checkShorthandPropertyAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>, inDestructuringPattern: bool, checkMode: CheckMode): GoPtr<Type> {
  let expr: GoPtr<Node>;
  if (!inDestructuringPattern) {
    expr = AsShorthandPropertyAssignment(node)!.ObjectAssignmentInitializer as unknown as GoPtr<Node>;
  }
  if (expr === undefined) {
    expr = Node_Name(node);
  }
  const expressionType = Checker_checkExpressionForMutableLocation(receiver, expr, checkMode);
  const typeNode = Node_Type(node);
  if (typeNode !== undefined) {
    const t = Checker_getTypeFromTypeNode(receiver, typeNode);
    Checker_checkTypeAssignableToAndOptionallyElaborate(receiver, expressionType, t, node, expr, undefined, undefined);
    return t;
  }
  return expressionType;
}

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
export function Checker_isReadonlyAssignmentDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (!IsCallExpression(node)) {
    return false;
  }
  const args = Node_Arguments(node);
  const propertyDescriptorType = Checker_checkExpressionCached(receiver, args![2]);
  const valueType = Checker_getTypeOfPropertyOfType(receiver, propertyDescriptorType, "value");
  if (valueType !== undefined) {
    const writableProp = Checker_getPropertyOfType(receiver, propertyDescriptorType, "writable");
    if (writableProp !== undefined) {
      let writableType: GoPtr<Type>;
      if (writableProp!.ValueDeclaration !== undefined && IsPropertyAssignment(writableProp!.ValueDeclaration)) {
        writableType = Checker_checkExpression(receiver, Node_Initializer(writableProp!.ValueDeclaration) as unknown as GoPtr<Node>);
      } else {
        writableType = Checker_getTypeOfSymbol(receiver, writableProp);
      }
      return ((writableType!.flags & TypeFlagsBooleanLiteral) !== 0 && getBooleanLiteralValue(writableType) === false) as bool;
    }
    return true;
  }
  return (Checker_getTypeOfPropertyOfType(receiver, propertyDescriptorType, "set") === undefined) as bool;
}

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
export function Checker_getTargetOfExportAssignment(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol> {
  const resolved = Checker_getTargetOfAliasLikeExpression(receiver, Node_Expression(node));
  Checker_markSymbolOfAliasDeclarationIfTypeOnly(receiver, node, undefined);
  return resolved;
}

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
export function Checker_getWidenedTypeForAssignmentDeclaration(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type> {
  let t: GoPtr<Type>;
  const [kind, location] = Checker_isConstructorDeclaredThisProperty(receiver, symbol_);
  if (kind === thisAssignmentDeclarationTyped) {
    if (location === undefined) {
      throw new globalThis.Error("location should not be nil when this assignment has a type.");
    }
    t = Checker_getTypeFromTypeNode(receiver, location);
  } else if (kind === thisAssignmentDeclarationConstructor) {
    if (location === undefined) {
      throw new globalThis.Error("constructor should not be nil when this assignment is in a constructor.");
    }
    t = Checker_getFlowTypeInConstructor(receiver, symbol_, location);
  } else if (kind === thisAssignmentDeclarationMethod) {
    t = Checker_getTypeOfPropertyInBaseClass(receiver, symbol_);
  }
  if (t === undefined) {
    let types: GoSlice<GoPtr<Type>> = [];
    for (let i = 0; i < symbol_!.Declarations!.length; i++) {
      const declaration = symbol_!.Declarations![i];
      const typeNode = Node_Type(declaration);
      if (IsBinaryExpression(declaration) && typeNode !== undefined) {
        t = Checker_getTypeFromTypeNode(receiver, typeNode);
        break;
      }
      const assignedType = Checker_getAssignmentDeclarationInitializerType(receiver, declaration);
      if (GetAssignmentDeclarationKind(declaration) !== JSDeclarationKindExportsProperty || i !== 0 || symbol_!.Declarations!.length === 1 || (assignedType!.flags & TypeFlagsUndefined) === 0) {
        types = AppendIfUnique(types, assignedType);
      }
    }
    if (kind === thisAssignmentDeclarationMethod && types.length > 0) {
      if (receiver!.strictNullChecks) {
        types = AppendIfUnique(types, receiver!.undefinedOrMissingType);
      }
    }
    if (t === undefined) {
      t = Checker_getWidenedType(receiver, Checker_getUnionType(receiver, types));
    }
  }
  if (symbol_!.ValueDeclaration !== undefined && IsInJSFile(symbol_!.ValueDeclaration) &&
    Checker_filterType(receiver, t, (ct: GoPtr<Type>): bool => ((ct!.flags & ~TypeFlagsNullable) !== 0) as bool) === receiver!.neverType) {
    Checker_reportImplicitAny(receiver, symbol_!.ValueDeclaration, receiver!.anyType, WideningKindNormal);
    return receiver!.anyType;
  }
  return t;
}

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
export function Checker_getAssignmentDeclarationInitializerType(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  if (IsBinaryExpression(node)) {
    const kind = GetAssignmentDeclarationKind(node);
    if (kind === JSDeclarationKindModuleExports || kind === JSDeclarationKindExportsProperty) {
      return Checker_getRegularTypeOfLiteralType(receiver, Checker_checkExpressionCached(receiver, GetRightMostAssignedExpression(node)));
    }
    return Checker_checkExpressionForMutableLocation(receiver, AsBinaryExpression(node)!.Right as unknown as GoPtr<Node>, CheckModeNormal);
  }
  if (IsCallExpression(node)) {
    const args = Node_Arguments(node);
    return Checker_getTypeFromPropertyDescriptor(receiver, args![2]);
  }
  return receiver!.neverType;
}

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
export function Checker_removeSubtypes(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>, hasObjectTypes: bool): GoPtr<GoSlice<GoPtr<Type>>> {
  if (types.length < 2) {
    return types;
  }
  const key = getTypeListKey(types);
  const cached = receiver!.subtypeReductionCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const hasEmptyObject = hasObjectTypes && types.some((t) =>
    (t!.flags & TypeFlagsObject) !== 0 &&
    !Checker_isGenericMappedType(receiver, t) &&
    Checker_isEmptyResolvedType(receiver, Checker_resolveStructuredTypeMembers(receiver, t)),
  );
  const length = types.length;
  let i = length;
  let count = 0;
  while (i > 0) {
    i--;
    const source = types[i]!;
    if (hasEmptyObject || (source!.flags & TypeFlagsStructuredOrInstantiable) !== 0) {
      if ((source!.flags & TypeFlagsTypeParameter) !== 0 && (Checker_getBaseConstraintOrType(receiver, source)!.flags & TypeFlagsUnion) !== 0) {
        if (Checker_isTypeRelatedTo(receiver, source, Checker_getUnionType(receiver, types.map((t) => t === source ? receiver!.neverType : t)), receiver!.strictSubtypeRelation)) {
          types = slices.Delete(types, i, i + 1);
        }
        continue;
      }
      let keyProperty: GoPtr<Symbol>;
      let keyPropertyType: GoPtr<Type>;
      if ((source!.flags & (TypeFlagsObject | TypeFlagsIntersection | TypeFlagsInstantiableNonPrimitive)) !== 0) {
        keyProperty = Checker_getPropertiesOfType(receiver, source).find((p) => isUnitType(Checker_getTypeOfSymbol(receiver, p)));
      }
      if (keyProperty !== undefined) {
        keyPropertyType = Checker_getRegularTypeOfLiteralType(receiver, Checker_getTypeOfSymbol(receiver, keyProperty));
      }
      for (const target of types) {
        if (source === target) {
          continue;
        }
        if (count === 100000) {
          const estimatedCount = (Math.trunc(count / (length - i)) * length);
          if (estimatedCount > 1000000) {
            if (receiver!.tracer !== undefined) {
              Tracer_Instant(receiver!.tracer, PhaseCheckTypes, "removeSubtypes_DepthLimit", new globalThis.Map<string, unknown>([["estimatedCount", estimatedCount]]));
            }
            Checker_error(receiver, receiver!.currentNode, Expression_produces_a_union_type_that_is_too_complex_to_represent);
            return undefined;
          }
        }
        count++;
        if (keyProperty !== undefined && (target!.flags & (TypeFlagsObject | TypeFlagsIntersection | TypeFlagsInstantiableNonPrimitive)) !== 0) {
          const propertyType = Checker_getTypeOfPropertyOfType(receiver, target, keyProperty!.Name);
          if (propertyType !== undefined && isUnitType(propertyType) && Checker_getRegularTypeOfLiteralType(receiver, propertyType) !== keyPropertyType) {
            continue;
          }
        }
        if ((source === receiver!.emptyObjectType || source === receiver!.unknownEmptyObjectType) && target!.symbol !== undefined && Checker_IsEmptyAnonymousObjectType(receiver, target)) {
          continue;
        }
        if (
          Checker_isTypeRelatedTo(receiver, source, target, receiver!.strictSubtypeRelation) &&
          (
            (Checker_getTargetType(receiver, source)!.objectFlags & ObjectFlagsClass) === 0 ||
            (Checker_getTargetType(receiver, target)!.objectFlags & ObjectFlagsClass) === 0 ||
            Checker_isTypeDerivedFrom(receiver, source, target)
          )
        ) {
          types = slices.Delete(types, i, i + 1);
          break;
        }
      }
    }
  }
  receiver!.subtypeReductionCache.set(key, types);
  return types;
}

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
export function Checker_removeRedundantSupertypes(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>, includes: TypeFlags): GoSlice<GoPtr<Type>> {
  let result = types;
  let i = result.length;
  while (i > 0) {
    i--;
    const t = result[i];
    const remove = ((t!.flags & TypeFlagsString) !== 0 && (includes & (TypeFlagsStringLiteral | TypeFlagsTemplateLiteral | TypeFlagsStringMapping)) !== 0) ||
      ((t!.flags & TypeFlagsNumber) !== 0 && (includes & TypeFlagsNumberLiteral) !== 0) ||
      ((t!.flags & TypeFlagsBigInt) !== 0 && (includes & TypeFlagsBigIntLiteral) !== 0) ||
      ((t!.flags & TypeFlagsESSymbol) !== 0 && (includes & TypeFlagsUniqueESSymbol) !== 0) ||
      ((t!.flags & TypeFlagsVoid) !== 0 && (includes & TypeFlagsUndefined) !== 0) ||
      (Checker_IsEmptyAnonymousObjectType(receiver, t) && (includes & TypeFlagsDefinitelyNonNullable) !== 0);
    if (remove) {
      result = slices.Delete(result, i, i + 1);
    }
  }
  return result;
}

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
export function Checker_isAssignmentToReadonlyEntity(receiver: GoPtr<Checker>, expr: GoPtr<Node>, symbol_: GoPtr<Symbol>, assignmentKind: AssignmentKind): bool {
  if (assignmentKind === AssignmentKindNone) {
    return false;
  }
  if (IsAccessExpression(expr)) {
    const node = SkipParentheses(Node_Expression(expr));
    if (IsIdentifier(node)) {
      const expressionSymbol = Checker_getResolvedSymbol(receiver, node);
      if ((expressionSymbol!.Flags & SymbolFlagsModuleExports) !== 0) {
        return false;
      }
    }
  }
  if (Checker_isReadonlySymbol(receiver, symbol_)) {
    if ((symbol_!.Flags & SymbolFlagsProperty) !== 0 && IsAccessExpression(expr) && Node_Expression(expr)!.Kind === KindThisKeyword) {
      const ctor = Checker_getControlFlowContainer(receiver, expr);
      if (ctor === undefined || !IsConstructorDeclaration(ctor)) {
        return true;
      }
      if (symbol_!.ValueDeclaration !== undefined) {
        const isAssignmentDeclaration = IsBinaryExpression(symbol_!.ValueDeclaration);
        const isLocalPropertyDeclaration = ctor!.Parent === symbol_!.ValueDeclaration!.Parent;
        const isLocalParameterProperty = ctor === symbol_!.ValueDeclaration!.Parent;
        const isLocalThisPropertyAssignment = isAssignmentDeclaration && symbol_!.Parent!.ValueDeclaration === ctor!.Parent;
        const isLocalThisPropertyAssignmentConstructorFunction = isAssignmentDeclaration && symbol_!.Parent!.ValueDeclaration === ctor;
        const isWriteableSymbol = isLocalPropertyDeclaration || isLocalParameterProperty || isLocalThisPropertyAssignment || isLocalThisPropertyAssignmentConstructorFunction;
        return (!isWriteableSymbol) as bool;
      }
    }
    return true;
  }
  if (IsAccessExpression(expr)) {
    const node = SkipParentheses(Node_Expression(expr));
    if (IsIdentifier(node)) {
      const expressionSymbol = Checker_getResolvedSymbol(receiver, node);
      if ((expressionSymbol!.Flags & SymbolFlagsAlias) !== 0) {
        const declaration = Checker_getDeclarationOfAliasSymbol(receiver, expressionSymbol);
        return (declaration !== undefined && IsNamespaceImport(declaration)) as bool;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.allTypesAssignableToKind","kind":"method","status":"implemented","sigHash":"1b9110d8c8909b92fb685a2cc7d26f2ed33f1be2a83049f068ed17f88926c41d","bodyHash":"90db6af073b40b3077975162ada8681e30bd6b1cbf2e91d9a4ada1f6c0edabca"}
 *
 * Go source:
 * func (c *Checker) allTypesAssignableToKind(source *Type, kind TypeFlags) bool {
 * 	return c.allTypesAssignableToKindEx(source, kind, false)
 * }
 */
export function Checker_allTypesAssignableToKind(receiver: GoPtr<Checker>, source: GoPtr<Type>, kind: TypeFlags): bool {
  return Checker_allTypesAssignableToKindEx(receiver, source, kind, false);
}

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
export function Checker_allTypesAssignableToKindEx(receiver: GoPtr<Checker>, source: GoPtr<Type>, kind: TypeFlags, strict: bool): bool {
  if ((source!.flags & TypeFlagsUnion) !== 0) {
    return Every(Type_Types(source), (subType: GoPtr<Type>): bool => {
      return Checker_allTypesAssignableToKindEx(receiver, subType, kind, strict);
    });
  }
  return Checker_isTypeAssignableToKindEx(receiver, source, kind, strict);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isTypeAssignableToKind","kind":"method","status":"implemented","sigHash":"f3abfb77c7e5a352e579a284845d461b92f73b0f7b3748643bc6b095d66f5905","bodyHash":"33ea51a706d25e8c8b5cb99404dadccdbc6f0737633732b78b3e5092a32a5867"}
 *
 * Go source:
 * func (c *Checker) isTypeAssignableToKind(source *Type, kind TypeFlags) bool {
 * 	return c.isTypeAssignableToKindEx(source, kind, false)
 * }
 */
export function Checker_isTypeAssignableToKind(receiver: GoPtr<Checker>, source: GoPtr<Type>, kind: TypeFlags): bool {
  return Checker_isTypeAssignableToKindEx(receiver, source, kind, false);
}

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
export function Checker_isTypeAssignableToKindEx(receiver: GoPtr<Checker>, source: GoPtr<Type>, kind: TypeFlags, strict: bool): bool {
  if ((source!.flags & kind) !== 0) {
    return true;
  }
  if (strict && (source!.flags & (TypeFlagsAnyOrUnknown | TypeFlagsVoid | TypeFlagsUndefined | TypeFlagsNull)) !== 0) {
    return false;
  }
  return ((kind & TypeFlagsNumberLike) !== 0 && Checker_isTypeAssignableTo(receiver, source, receiver!.numberType)) ||
    ((kind & TypeFlagsBigIntLike) !== 0 && Checker_isTypeAssignableTo(receiver, source, receiver!.bigintType)) ||
    ((kind & TypeFlagsStringLike) !== 0 && Checker_isTypeAssignableTo(receiver, source, receiver!.stringType)) ||
    ((kind & TypeFlagsBooleanLike) !== 0 && Checker_isTypeAssignableTo(receiver, source, receiver!.booleanType)) ||
    ((kind & TypeFlagsVoid) !== 0 && Checker_isTypeAssignableTo(receiver, source, receiver!.voidType)) ||
    ((kind & TypeFlagsNever) !== 0 && Checker_isTypeAssignableTo(receiver, source, receiver!.neverType)) ||
    ((kind & TypeFlagsNull) !== 0 && Checker_isTypeAssignableTo(receiver, source, receiver!.nullType)) ||
    ((kind & TypeFlagsUndefined) !== 0 && Checker_isTypeAssignableTo(receiver, source, receiver!.undefinedType)) ||
    ((kind & TypeFlagsESSymbol) !== 0 && Checker_isTypeAssignableTo(receiver, source, receiver!.esSymbolType)) ||
    ((kind & TypeFlagsNonPrimitive) !== 0 && Checker_isTypeAssignableTo(receiver, source, receiver!.nonPrimitiveType));
}

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
export function Checker_getSingleBaseForNonAugmentingSubtype(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  if ((t!.objectFlags & ObjectFlagsReference) === 0 || (Type_Target(t)!.objectFlags & ObjectFlagsClassOrInterface) === 0) {
    return undefined;
  }
  const key: CachedTypeKey = { kind: CachedTypeKindEquivalentBaseType, typeId: t!.id };
  if ((t!.objectFlags & ObjectFlagsIdenticalBaseTypeCalculated) !== 0) {
    return receiver!.cachedTypes.get(key);
  }
  t!.objectFlags |= ObjectFlagsIdenticalBaseTypeCalculated;
  const target = Type_Target(t);
  if ((target!.objectFlags & ObjectFlagsClass) !== 0) {
    const baseTypeNode = getBaseTypeNodeOfClass(target);
    if (baseTypeNode !== undefined && !IsIdentifier(Node_Expression(baseTypeNode)) && !IsPropertyAccessExpression(Node_Expression(baseTypeNode))) {
      return undefined;
    }
  }
  const bases = Checker_getBaseTypes(receiver, target);
  if (bases.length !== 1) {
    return undefined;
  }
  if (Checker_getMembersOfSymbol(receiver, t!.symbol).size !== 0) {
    return undefined;
  }
  let instantiatedBase: GoPtr<Type>;
  const typeParameters = InterfaceType_TypeParameters(Type_AsInterfaceType(target));
  const typeArguments = Checker_getTypeArguments(receiver, t);
  if (typeParameters.length === 0) {
    instantiatedBase = bases[0];
  } else {
    instantiatedBase = Checker_instantiateType(receiver, bases[0], newTypeMapper(typeParameters, typeArguments.slice(0, typeParameters.length)));
  }
  if (typeArguments.length > typeParameters.length) {
    instantiatedBase = Checker_getTypeWithThisArgument(receiver, instantiatedBase, LastOrNil(typeArguments), false);
  }
  receiver!.cachedTypes.set(key, instantiatedBase);
  return instantiatedBase;
}

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
export function Checker_markExportAssignmentAliasReferenced(receiver: GoPtr<Checker>, location: GoPtr<Node>): void {
  const id = Node_Expression(location);
  if (IsIdentifier(id)) {
    const sym = Checker_getExportSymbolOfValueSymbolIfExported(receiver, Checker_resolveEntityName(receiver, id, SymbolFlagsAll, true, true, location));
    if (sym !== undefined) {
      Checker_markAliasReferenced(receiver, sym, id);
    }
  }
}

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
export function Checker_getContextualTypeForAssignmentExpression(receiver: GoPtr<Checker>, binary: GoPtr<BinaryExpression>): GoPtr<Type> {
  const left = binary!.Left as GoPtr<Node>;
  const binarySymbol = (binary as unknown as { Symbol?: GoPtr<Symbol> }).Symbol;
  if (IsAccessExpression(left)) {
    const expr = Node_Expression(left);
    switch (expr!.Kind) {
      case KindIdentifier: {
        const symbol_ = Checker_getExportSymbolOfValueSymbolIfExported(receiver, Checker_getResolvedSymbol(receiver, expr));
        if ((symbol_!.Flags & SymbolFlagsModuleExports) !== 0) {
          return undefined;
        }
        if (binarySymbol !== undefined) {
          if (symbol_!.ValueDeclaration !== undefined && IsVariableDeclaration(symbol_!.ValueDeclaration)) {
            const typeNode = Node_Type(symbol_!.ValueDeclaration);
            if (typeNode !== undefined) {
              if (IsPropertyAccessExpression(left)) {
                return Checker_getTypeOfPropertyOfContextualType(receiver, Checker_getTypeFromTypeNode(receiver, typeNode), Node_Text(Node_Name(left)!));
              }
              const nameType = Checker_checkExpressionCached(receiver, AsElementAccessExpression(left)!.ArgumentExpression);
              if (isTypeUsableAsPropertyName(nameType)) {
                return Checker_getTypeOfPropertyOfContextualTypeEx(receiver, Checker_getTypeFromTypeNode(receiver, typeNode), getPropertyNameFromType(nameType), nameType);
              }
              return Checker_getTypeOfExpression(receiver, left);
            }
          }
          return undefined;
        }
        break;
      }
      case KindPropertyAccessExpression:
      case KindElementAccessExpression:
        if (binarySymbol !== undefined) {
          return undefined;
        }
        break;
      case KindThisKeyword: {
        let symbol_: GoPtr<Symbol>;
        const thisType = Checker_getTypeOfExpression(receiver, expr);
        if (IsPropertyAccessExpression(left)) {
          const name = Node_Name(left);
          if (IsPrivateIdentifier(name)) {
            if (thisType!.symbol !== undefined) {
              symbol_ = Checker_getPropertyOfType(receiver, thisType, GetSymbolNameForPrivateIdentifier(thisType!.symbol, Node_Text(name)));
            }
          } else {
            symbol_ = Checker_getPropertyOfType(receiver, thisType, Node_Text(name));
          }
        } else if (IsElementAccessExpression(left)) {
          const propType = Checker_checkExpressionCached(receiver, AsElementAccessExpression(left)!.ArgumentExpression);
          if (isTypeUsableAsPropertyName(propType)) {
            symbol_ = Checker_getPropertyOfType(receiver, thisType, getPropertyNameFromType(propType));
          }
        }
        if (symbol_ !== undefined) {
          const declaration = symbol_.ValueDeclaration;
          if (declaration !== undefined && (IsPropertyDeclaration(declaration) || IsPropertySignatureDeclaration(declaration)) && Node_Type(declaration) === undefined && Node_Initializer(declaration) === undefined) {
            return undefined;
          }
        }
        if (binarySymbol !== undefined && binarySymbol.ValueDeclaration !== undefined && Node_Type(binarySymbol.ValueDeclaration) === undefined) {
          if (!IsObjectLiteralMethod(Checker_getThisContainer(receiver, expr, false, false))) {
            return undefined;
          }
          const name = GetElementOrPropertyAccessName(left);
          if (name === undefined) {
            return undefined;
          }
          return undefined;
        }
        break;
      }
    }
  }
  return Checker_getTypeOfExpression(receiver, left);
}
