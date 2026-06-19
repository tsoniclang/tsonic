import type { bool, int } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Context } from "../../../go/context.js";
import { Node_Text, Node_Members, Node_Statements, Node_CanHaveStatements, Node_Expression, Node_Arguments, Node_TypeArgumentList, Node_TypeArguments, Node_Parameters, Node_TagName, Node_Symbol, Node_Type, Node_Initializer, SourceFile_Diagnostics, SourceFile_Text } from "../../ast/ast.js";
import type { Node, SourceFile } from "../../ast/ast.js";
import type { Expression } from "../../ast/generated/unions.js";
import type { FlowNode } from "../../ast/flow.js";
import { Diagnostic_AddRelatedInfo, Diagnostic_Clone, Diagnostic_RelatedInformation, Diagnostic_SetCategory, DiagnosticsCollection_Add, DiagnosticsCollection_GetDiagnosticsForFile, DiagnosticsCollection_GetGlobalDiagnostics, DiagnosticsCollection_Lookup, NewDiagnostic, NewDiagnosticChain } from "../../ast/diagnostic.js";
import type { Diagnostic, DiagnosticsCollection } from "../../ast/diagnostic.js";
import { CompareDiagnostics } from "../../ast/diagnostic.js";
import { GetFunctionFlags, FunctionFlagsGenerator, FunctionFlagsAsync } from "../../ast/functionflags.js";
import { KindCallExpression, KindClassDeclaration, KindClassExpression, KindDecorator, KindElementAccessExpression, KindEnumDeclaration, KindExportDeclaration, KindExportSpecifier, KindExtendsKeyword, KindGetAccessor, KindImplementsKeyword, KindInterfaceDeclaration, KindJsxOpeningElement, KindJsxSelfClosingElement, KindMethodDeclaration, KindModuleDeclaration, KindNewExpression, KindNullKeyword, KindParameter, KindPropertyAccessExpression, KindPropertyDeclaration, KindSetAccessor, KindShorthandPropertyAssignment, KindTaggedTemplateExpression, KindTypeReference, KindEqualsEqualsEqualsToken, KindEqualsEqualsToken, KindExclamationEqualsEqualsToken, KindExclamationEqualsToken } from "../../ast/generated/kinds.js";
import type { Kind } from "../../ast/kind_generated.js";
import { NodeFlagsUnreachable } from "../../ast/nodeflags.js";
import { IsCallExpression, IsConstructorDeclaration, IsDecorator, IsExportDeclaration, IsExportSpecifier, IsForOfStatement, IsHeritageClause, IsIdentifier, IsJsxOpeningFragment, IsNamespaceExport, IsNewExpression, IsParameterDeclaration, IsPropertyAccessExpression, IsQualifiedName, IsStringLiteral } from "../../ast/generated/predicates.js";
import type { Symbol } from "../../ast/symbol.js";
import { InternalSymbolNameComputed } from "../../ast/symbol.js";
import { SymbolFlagsAlias, SymbolFlagsBlockScopedVariable, SymbolFlagsEnum, SymbolFlagsGetAccessor, SymbolFlagsInterface, SymbolFlagsModule, SymbolFlagsNamespace, SymbolFlagsNamespaceModule, SymbolFlagsOptional, SymbolFlagsType, SymbolFlagsValue } from "../../ast/generated/flags.js";
import type { SymbolFlags } from "../../ast/symbolflags.js";
import { IsBindingPattern, IsClassLike, IsDeprecatedDeclarationWithCachedFlags, IsFunctionExpressionOrArrowFunction, IsFunctionLikeDeclaration, GetInvokedExpression, GetJSDocDeprecatedTag, GetSourceFileOfNode, IsEnumConst, IsEntityNameExpression, IsInstantiatedModule, IsParameterPropertyDeclaration, IsPotentiallyExecutableNode, IsPlainJSFile, IsStatic, IsTypeDeclaration, SkipParentheses, IsImportCall, IsInJSFile, NodeKindIs } from "../../ast/utilities.js";
import type { NodeFlags } from "../../ast/generated/flags.js";
import { SourceFile_FileName } from "../../ast/ast.js";
import { Node_End, Node_FlowNodeData, Node_Name, Node_Pos } from "../../ast/spine.js";
import { AsPropertyDeclaration, AsHeritageClause, AsQualifiedName, AsTaggedTemplateExpression, AsElementAccessExpression, AsTypeReferenceNode, AsImportEqualsDeclaration } from "../../ast/generated/casts.js";
import { Set_Has, Set_Add } from "../../collections/set.js";
import { CompilerOptions_GetEmitStandardClassFields, CompilerOptions_ShouldPreserveConstEnums, CompilerOptions_UsesWildcardTypes } from "../../core/compileroptions.js";
import { IfElse, Every, Some, Filter, Find, OrElse, ElementOrNil } from "../../core/core.js";
import type { LinkStore } from "../../core/linkstore.js";
import { LinkStore_Get, LinkStore_Has } from "../../core/linkstore.js";
import { NodeCoreModules } from "../../core/nodemodules.js";
import { NewTextRange, TextRange_ContainsInclusive, TextRange_Pos, TextRange_End } from "../../core/text.js";
import { TSFalse } from "../../core/tristate.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import { CategorySuggestion } from "../../diagnostics/diagnostics.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import { Declaration_name_conflicts_with_built_in_global_identifier_0, X_0_was_exported_here, X_0_was_imported_here, X_0_only_refers_to_a_type_but_is_being_used_as_a_namespace_here, Cannot_access_0_1_because_0_is_a_type_but_not_a_namespace_Did_you_mean_to_retrieve_the_type_of_the_property_1_in_0_with_0_1, Cannot_use_namespace_0_as_a_value, Cannot_use_namespace_0_as_a_type, X_0_only_refers_to_a_type_but_is_being_used_as_a_value_here, X_0_only_refers_to_a_type_but_is_being_used_as_a_value_here_Do_you_need_to_change_your_target_library_Try_changing_the_lib_compiler_option_to_es2015_or_later, X_0_only_refers_to_a_type_but_is_being_used_as_a_value_here_Did_you_mean_to_use_1_in_0, X_0_refers_to_a_value_but_is_being_used_as_a_type_here_Did_you_mean_typeof_0, Cannot_find_name_0_Did_you_mean_the_static_member_1_0, Cannot_find_name_0_Did_you_mean_the_instance_member_this_0, Cannot_export_0_Only_local_declarations_can_be_exported_from_a_module, An_interface_cannot_extend_a_primitive_type_like_0_It_can_only_extend_other_named_object_types, A_class_cannot_extend_a_primitive_type_like_0_Classes_can_only_extend_constructable_values, A_class_cannot_implement_a_primitive_type_like_0_It_can_only_implement_other_named_object_types, Unreachable_code_detected, X_0_is_deprecated, The_declaration_was_marked_as_deprecated_here, The_signature_0_of_1_is_deprecated, Unable_to_resolve_signature_of_class_decorator_when_called_as_an_expression, Unable_to_resolve_signature_of_parameter_decorator_when_called_as_an_expression, Unable_to_resolve_signature_of_property_decorator_when_called_as_an_expression, Unable_to_resolve_signature_of_method_decorator_when_called_as_an_expression, Type_0_must_have_a_Symbol_asyncIterator_method_that_returns_an_async_iterator, Type_0_must_have_a_Symbol_iterator_method_that_returns_an_iterator, Type_0_can_only_be_iterated_through_when_using_the_downlevelIteration_flag_or_with_a_target_of_es2015_or_higher, Type_0_is_not_an_array_type_or_a_string_type_or_does_not_have_a_Symbol_iterator_method_that_returns_an_iterator, Type_0_is_not_an_array_type_or_does_not_have_a_Symbol_iterator_method_that_returns_an_iterator, Object_is_of_type_unknown, X_0_is_of_type_unknown, Object_is_possibly_null, Object_is_possibly_null_or_undefined, Object_is_possibly_undefined, X_0_is_possibly_null, X_0_is_possibly_null_or_undefined, X_0_is_possibly_undefined, The_value_0_cannot_be_used_here, Cannot_invoke_an_object_which_is_possibly_null, Cannot_invoke_an_object_which_is_possibly_null_or_undefined, Cannot_invoke_an_object_which_is_possibly_undefined, Type_0_has_no_call_signatures, Type_0_has_no_construct_signatures, Not_all_constituents_of_type_0_are_callable, Not_all_constituents_of_type_0_are_constructable, No_constituent_of_type_0_is_callable, No_constituent_of_type_0_is_constructable, Each_member_of_the_union_type_0_has_signatures_but_none_of_those_signatures_are_compatible_with_each_other, Each_member_of_the_union_type_0_has_construct_signatures_but_none_of_those_signatures_are_compatible_with_each_other, This_expression_is_not_callable, This_expression_is_not_constructable, This_expression_is_not_callable_because_it_is_a_get_accessor_Did_you_mean_to_use_it_without, Did_you_forget_to_use_await, Type_originates_at_this_import_A_namespace_style_import_cannot_be_called_or_constructed_and_will_cause_a_failure_at_runtime_Consider_using_a_default_import_or_import_require_here_instead, Operator_0_cannot_be_applied_to_types_1_and_2, This_comparison_appears_to_be_unintentional_because_the_types_0_and_1_have_no_overlap, Cannot_find_name_0, Cannot_find_name_0_Did_you_mean_to_write_this_in_an_async_function, No_value_exists_in_scope_for_the_shorthand_property_0_Either_declare_one_or_provide_an_initializer, Cannot_find_name_0_Do_you_need_to_change_your_target_library_Try_changing_the_lib_compiler_option_to_include_dom, Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_jQuery_Try_npm_i_save_dev_types_Slashjquery, Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_jQuery_Try_npm_i_save_dev_types_Slashjquery_and_then_add_jquery_to_the_types_field_in_your_tsconfig, Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_a_test_runner_Try_npm_i_save_dev_types_Slashjest_or_npm_i_save_dev_types_Slashmocha, Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_a_test_runner_Try_npm_i_save_dev_types_Slashjest_or_npm_i_save_dev_types_Slashmocha_and_then_add_jest_or_mocha_to_the_types_field_in_your_tsconfig, Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_node_Try_npm_i_save_dev_types_Slashnode, Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_node_Try_npm_i_save_dev_types_Slashnode_and_then_add_node_to_the_types_field_in_your_tsconfig, Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_Bun_Try_npm_i_save_dev_types_Slashbun, Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_Bun_Try_npm_i_save_dev_types_Slashbun_and_then_add_bun_to_the_types_field_in_your_tsconfig, Cannot_find_name_0_Do_you_need_to_change_your_target_library_Try_changing_the_lib_compiler_option_to_1_or_later, Cannot_extend_an_interface_0_Did_you_mean_implements, A_spread_argument_must_either_have_a_tuple_type_or_be_passed_to_a_rest_parameter, Expected_at_least_0_arguments_but_got_1, Expected_0_arguments_but_got_1, Expected_0_arguments_but_got_1_Did_you_forget_to_include_void_in_your_type_argument_to_Promise, No_overload_expects_0_arguments_but_overloads_do_exist_that_expect_either_1_or_2_arguments, No_overload_matches_this_call, The_last_overload_gave_the_following_error, The_last_overload_is_declared_here, An_argument_matching_this_binding_pattern_was_not_provided, An_argument_for_0_was_not_provided, Arguments_for_the_rest_parameter_0_were_not_provided, The_runtime_will_invoke_the_decorator_with_1_arguments_but_the_decorator_expects_0, The_runtime_will_invoke_the_decorator_with_1_arguments_but_the_decorator_expects_at_least_0, Expected_0_type_arguments_but_got_1, No_overload_expects_0_type_arguments_but_overloads_do_exist_that_expect_either_1_or_2_type_arguments, Property_0_in_type_1_is_not_assignable_to_the_same_property_in_base_type_2, Initializer_of_instance_member_variable_0_cannot_reference_identifier_1_declared_in_the_constructor, Type_of_instance_member_variable_0_cannot_reference_identifier_1_declared_in_the_constructor, Enum_declarations_can_only_merge_with_namespace_or_other_enum_declarations, Cannot_redeclare_block_scoped_variable_0, Duplicate_identifier_0, X_0_was_also_declared_here, X_and_here, X_0_is_referenced_directly_or_indirectly_in_its_own_type_annotation, X_0_implicitly_has_type_any_because_it_does_not_have_a_type_annotation_and_is_referenced_directly_or_indirectly_in_its_own_initializer, Circular_definition_of_import_alias_0, Object_literal_s_property_0_implicitly_has_an_1_type, An_import_alias_cannot_reference_a_declaration_that_was_exported_using_export_type, An_import_alias_cannot_reference_a_declaration_that_was_imported_using_import_type, Type_0_is_not_an_array_type_or_a_string_type, Type_0_is_not_an_array_type, Expected_1_argument_but_got_0_new_Promise_needs_a_JSDoc_hint_to_produce_a_resolve_that_can_be_called_without_arguments } from "../../diagnostics/generated/messages.js";
import { GetTokenPosOfNode, SkipTrivia, TokenToString } from "../../scanner/scanner.js";
import { DeclarationNameToString, GetTextOfNode } from "../../scanner/utilities.js";
import type { Signature, SignatureKind, Type } from "../types.js";
import { SignatureFlagsIsSignatureCandidateForOverloadFailure, TypeFlagsAny, TypeFlagsNever, TypeFlagsNullable, TypeFlagsUnion, TypeFlagsUnknown, ObjectFlagsContainsWideningType } from "../types.js";
import { SignatureKindCall } from "../types.js";
import type { ExportTypeLinks } from "../types.js";
import { Type_Types, Type_AsInterfaceType } from "../types.js";
import { NewDiagnosticForNode, NewDiagnosticChainForNode, entityNameToString, isTypeReferenceIdentifier, tryGetPropertyAccessOrIdentifierToString, isObjectLiteralType } from "../utilities.js";
import { IsInTypeQuery } from "../utilities.js";
import { Checker_checkNotCanceled } from "../utilities.js";
import type { CallState, Checker, IterationUse, TypeFacts, UnusedKind, WideningKind } from "./state.js";
import { CheckModeNormal, createDiagnosticForNode, getAdjustedNodeForError, getErrorNodeForCallNode, getFirstDeclaration, isES2015OrLaterConstructorName, isES2015OrLaterIterable, isPrimitiveTypeName, isRestParameter, TypeFactsIsNull, TypeFactsIsUndefined, TypeFactsIsUndefinedOrNull, UnusedKindLocal, UnusedKindParameter, WideningKindNormal, WideningKindFunctionReturn, WideningKindGeneratorNext, WideningKindGeneratorYield, IterationTypeKindReturn, IterationTypeKindYield, IterationTypeKindNext } from "./state.js";
import { Checker_error } from "./support.js";
import { Checker_getThisContainer, Checker_addImplementationSuccessElaboration } from "./support-queries.js";
import { Checker_getCombinedNodeFlagsCached, Checker_errorAndMaybeSuggestAwait, Checker_checkSourceFile } from "./syntax-checking.js";
import { Checker_getContextualSignatureForFunctionLikeDeclaration, Checker_getIterationTypeOfGeneratorFunctionReturnType, Checker_getMinTypeArgumentCount, Checker_getReturnTypeOfSignature, Checker_getSignaturesOfType, Checker_getSpreadArgumentIndex, Checker_getTypeArguments, Checker_hasCorrectTypeArgumentArity, Checker_isSignatureApplicable, Checker_checkTypeArguments, Checker_resolveUntypedCall } from "./signatures.js";
import { Checker_checkTypeAssignableTo, Checker_checkTypeAssignableToEx, Checker_getTypeNamesForErrorDisplay, Checker_isTypeAssignableTo, Checker_getParameterCount, Checker_getMinArgumentCount, Checker_hasEffectiveRestParameter } from "../relater.js";
import { Checker_createTypeFromGenericGlobalType, Checker_getDeclaredTypeOfSymbol, Checker_getPropertyOfType, Checker_getSymbolFlags, Checker_getSymbolOfDeclaration, Checker_getTypeOfSymbol, Checker_resolveEntityName, Checker_resolveSymbol, Checker_getResolvedSymbol, Checker_getResolvedSymbolOrNil, Checker_getParentOfSymbol, Checker_getDeclarationOfAliasSymbol, Checker_getTypeOnlyDeclarationOfEntityName, Checker_getEntityNameForExtendingInterface, Checker_getAwaitedTypeNoAlias } from "./symbols.js";
import { Checker_symbolToString, Checker_TypeToString, Checker_signatureToString } from "../printer.js";
import { Checker_getAwaitedTypeOfPromise, Checker_GetNonNullableType, Checker_getTypeFacts, Checker_getAwaitedType, Checker_isArrayOrTupleType, Checker_isEmptyObjectType, Checker_isGenericType, Checker_getPropertiesOfObjectType, Checker_getWidenedType, Checker_getUnionType, Checker_maybeMappedType, Checker_getBaseTypesIfUnrelated, Checker_reportImplicitAny, Checker_getIterationTypeOfIterable } from "./types.js";
import { Checker_isReachableFlowNode } from "../flow.js";
import { Checker_addDiagnostic, Checker_addSuggestionDiagnostic } from "../checker.js";
import * as slices from "../../../go/slices.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addUndefinedToGlobalsOrErrorOnRedeclaration","kind":"method","status":"implemented","sigHash":"177e4f101b29e5acf47d7d3ba71d55990c08f6963846244e1ce9f3bd84204baf","bodyHash":"9833e6a0d8a46862bc29d073abbfd30d49273d0d593b700304ac618cb431facd"}
 *
 * Go source:
 * func (c *Checker) addUndefinedToGlobalsOrErrorOnRedeclaration() {
 * 	name := c.undefinedSymbol.Name
 * 	targetSymbol := c.globals[name]
 * 	if targetSymbol != nil {
 * 		for _, declaration := range targetSymbol.Declarations {
 * 			if !ast.IsTypeDeclaration(declaration) {
 * 				c.addDiagnostic(createDiagnosticForNode(declaration, diagnostics.Declaration_name_conflicts_with_built_in_global_identifier_0, name))
 * 			}
 * 		}
 * 	} else {
 * 		c.globals[name] = c.undefinedSymbol
 * 	}
 * }
 */
export function Checker_addUndefinedToGlobalsOrErrorOnRedeclaration(receiver: GoPtr<Checker>): void {
  const c = receiver!;
  const name = c.undefinedSymbol!.Name;
  const targetSymbol = c.globals.get(name);
  if (targetSymbol !== undefined) {
    for (const declaration of targetSymbol!.Declarations ?? []) {
      if (!IsTypeDeclaration(declaration)) {
        Checker_addDiagnostic(receiver, createDiagnosticForNode(declaration, Declaration_name_conflicts_with_built_in_global_identifier_0, name));
      }
    }
  } else {
    c.globals.set(name, c.undefinedSymbol);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAndReportErrorForInvalidInitializer","kind":"method","status":"implemented","sigHash":"545bc6dc60215ddada3483404be71e382f2c6d901475546357e886af6780c1e5","bodyHash":"a3e2fe29f59c3e992abffb0e961ff8d1280d2be59b21ea7d5ccb39ae8036c473"}
 *
 * Go source:
 * func (c *Checker) checkAndReportErrorForInvalidInitializer(errorLocation *ast.Node, name string, propertyWithInvalidInitializer *ast.Node, result *ast.Symbol) bool {
 * 	if !c.compilerOptions.GetEmitStandardClassFields() {
 * 		if errorLocation != nil && result == nil && c.checkAndReportErrorForMissingPrefix(errorLocation, name) {
 * 			return true
 * 		}
 * 		// We have a match, but the reference occurred within a property initializer and the identifier also binds
 * 		// to a local variable in the constructor where the code will be emitted. Note that this is actually allowed
 * 		// with emitStandardClassFields because the scope semantics are different.
 * 		prop := propertyWithInvalidInitializer.AsPropertyDeclaration()
 * 		message := core.IfElse(errorLocation != nil && prop.Type != nil && prop.Type.Loc.ContainsInclusive(errorLocation.Pos()),
 * 			diagnostics.Type_of_instance_member_variable_0_cannot_reference_identifier_1_declared_in_the_constructor,
 * 			diagnostics.Initializer_of_instance_member_variable_0_cannot_reference_identifier_1_declared_in_the_constructor)
 * 		c.error(errorLocation, message, scanner.DeclarationNameToString(prop.Name()), name)
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Checker_checkAndReportErrorForInvalidInitializer(receiver: GoPtr<Checker>, errorLocation: GoPtr<Node>, name: string, propertyWithInvalidInitializer: GoPtr<Node>, result: GoPtr<Symbol>): bool {
  const c = receiver!;
  if (!CompilerOptions_GetEmitStandardClassFields(c.compilerOptions)) {
    if (errorLocation !== undefined && result === undefined && Checker_checkAndReportErrorForMissingPrefix(receiver, errorLocation, name)) {
      return true;
    }
    const prop = AsPropertyDeclaration(propertyWithInvalidInitializer);
    const message = IfElse(errorLocation !== undefined && prop!.Type !== undefined && TextRange_ContainsInclusive(prop!.Type!.Loc, Node_Pos(errorLocation)),
      Type_of_instance_member_variable_0_cannot_reference_identifier_1_declared_in_the_constructor,
      Initializer_of_instance_member_variable_0_cannot_reference_identifier_1_declared_in_the_constructor);
    Checker_error(receiver, errorLocation, message, DeclarationNameToString(Node_Name(prop)), name);
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAndReportErrorForMissingPrefix","kind":"method","status":"implemented","sigHash":"18fec22445b3cef2b8732ec7c40f63337829008c60880632232cab440959b11b","bodyHash":"4b956a1db6478786cc99f7595cc59ce153db1fcc962234b13dde9f05ef28bed5"}
 *
 * Go source:
 * func (c *Checker) checkAndReportErrorForMissingPrefix(errorLocation *ast.Node, name string) bool {
 * 	if !ast.IsIdentifier(errorLocation) || errorLocation.Text() != name || isTypeReferenceIdentifier(errorLocation) || IsInTypeQuery(errorLocation) {
 * 		return false
 * 	}
 * 	container := c.getThisContainer(errorLocation, false /*includeArrowFunctions* /, false /*includeClassComputedPropertyName* /)
 * 	for location := container; location.Parent != nil; location = location.Parent {
 * 		if ast.IsClassLike(location.Parent) {
 * 			classSymbol := c.getSymbolOfDeclaration(location.Parent)
 * 			if classSymbol == nil {
 * 				break
 * 			}
 * 			// Check to see if a static member exists.
 * 			constructorType := c.getTypeOfSymbol(classSymbol)
 * 			if c.getPropertyOfType(constructorType, name) != nil {
 * 				c.error(errorLocation, diagnostics.Cannot_find_name_0_Did_you_mean_the_static_member_1_0, name, c.symbolToString(classSymbol))
 * 				return true
 * 			}
 * 			// No static member is present.
 * 			// Check if we're in an instance method and look for a relevant instance member.
 * 			if location == container && !ast.IsStatic(location) {
 * 				instanceType := c.getDeclaredTypeOfSymbol(classSymbol).AsInterfaceType().thisType
 * 				// TODO: GH#18217
 * 				if c.getPropertyOfType(instanceType, name) != nil {
 * 					c.error(errorLocation, diagnostics.Cannot_find_name_0_Did_you_mean_the_instance_member_this_0, name)
 * 					return true
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkAndReportErrorForMissingPrefix(receiver: GoPtr<Checker>, errorLocation: GoPtr<Node>, name: string): bool {
  const c = receiver!;
  if (!IsIdentifier(errorLocation) || Node_Text(errorLocation) !== name || isTypeReferenceIdentifier(errorLocation) || IsInTypeQuery(errorLocation)) {
    return false;
  }
  const container = Checker_getThisContainer(receiver, errorLocation, false as bool, false as bool);
  for (let location = container; location!.Parent !== undefined; location = location!.Parent) {
    if (IsClassLike(location!.Parent)) {
      const classSymbol = Checker_getSymbolOfDeclaration(receiver, location!.Parent);
      if (classSymbol === undefined) {
        break;
      }
      const constructorType = Checker_getTypeOfSymbol(receiver, classSymbol);
      if (Checker_getPropertyOfType(receiver, constructorType, name) !== undefined) {
        Checker_error(receiver, errorLocation, Cannot_find_name_0_Did_you_mean_the_static_member_1_0, name, Checker_symbolToString(receiver, classSymbol));
        return true;
      }
      if (location === container && !IsStatic(location)) {
        const instanceType = Type_AsInterfaceType(Checker_getDeclaredTypeOfSymbol(receiver, classSymbol))!.thisType;
        if (Checker_getPropertyOfType(receiver, instanceType, name) !== undefined) {
          Checker_error(receiver, errorLocation, Cannot_find_name_0_Did_you_mean_the_instance_member_this_0, name);
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAndReportErrorForUsingTypeAsNamespace","kind":"method","status":"implemented","sigHash":"1a5465f5cb71210ce9c66203b82a59640bedf3f9cc5d804102cf93ba7e087ea7","bodyHash":"462340466bef5b58c911a67382fc9666c090be80d3287a9df403d564a728eb6e"}
 *
 * Go source:
 * func (c *Checker) checkAndReportErrorForUsingTypeAsNamespace(errorLocation *ast.Node, name string, meaning ast.SymbolFlags) bool {
 * 	if meaning == ast.SymbolFlagsNamespace {
 * 		symbol := c.resolveSymbol(c.resolveName(errorLocation, name, ast.SymbolFlagsType&^ast.SymbolFlagsNamespace, nil /*nameNotFoundMessage* /, false /*isUse* /, false /*excludeGlobals* /))
 * 		if symbol != nil {
 * 			parent := errorLocation.Parent
 * 			if ast.IsQualifiedName(parent) {
 * 				debug.Assert(parent.AsQualifiedName().Left == errorLocation, "Should only be resolving left side of qualified name as a namespace")
 * 				propName := parent.AsQualifiedName().Right.Text()
 * 				propType := c.getPropertyOfType(c.getDeclaredTypeOfSymbol(symbol), propName)
 * 				if propType != nil {
 * 					c.error(parent, diagnostics.Cannot_access_0_1_because_0_is_a_type_but_not_a_namespace_Did_you_mean_to_retrieve_the_type_of_the_property_1_in_0_with_0_1, name, propName)
 * 					return true
 * 				}
 * 			}
 * 			c.error(errorLocation, diagnostics.X_0_only_refers_to_a_type_but_is_being_used_as_a_namespace_here, name)
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkAndReportErrorForUsingTypeAsNamespace(receiver: GoPtr<Checker>, errorLocation: GoPtr<Node>, name: string, meaning: SymbolFlags): bool {
  const c = receiver!;
  if (meaning === SymbolFlagsNamespace) {
    const symbol = Checker_resolveSymbol(receiver, c.resolveName(errorLocation, name, (SymbolFlagsType & ~SymbolFlagsNamespace) as SymbolFlags, undefined, false as bool, false as bool));
    if (symbol !== undefined) {
      const parent = errorLocation!.Parent;
      if (IsQualifiedName(parent)) {
        const propName = Node_Text(AsQualifiedName(parent)!.Right);
        const propType = Checker_getPropertyOfType(receiver, Checker_getDeclaredTypeOfSymbol(receiver, symbol), propName);
        if (propType !== undefined) {
          Checker_error(receiver, parent, Cannot_access_0_1_because_0_is_a_type_but_not_a_namespace_Did_you_mean_to_retrieve_the_type_of_the_property_1_in_0_with_0_1, name, propName);
          return true;
        }
      }
      Checker_error(receiver, errorLocation, X_0_only_refers_to_a_type_but_is_being_used_as_a_namespace_here, name);
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAndReportErrorForExportingPrimitiveType","kind":"method","status":"implemented","sigHash":"4aa8fd510c1fb35a2d0738c5287544f29f30187c7013589da4e2d0a3b137d0ae","bodyHash":"f07fa3514735334d11d8892bd19371b498c07f3030207e96a50390b080cc0b39"}
 *
 * Go source:
 * func (c *Checker) checkAndReportErrorForExportingPrimitiveType(errorLocation *ast.Node, name string) bool {
 * 	if isPrimitiveTypeName(name) && errorLocation.Parent.Kind == ast.KindExportSpecifier {
 * 		c.error(errorLocation, diagnostics.Cannot_export_0_Only_local_declarations_can_be_exported_from_a_module, name)
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Checker_checkAndReportErrorForExportingPrimitiveType(receiver: GoPtr<Checker>, errorLocation: GoPtr<Node>, name: string): bool {
  const c = receiver!;
  if (isPrimitiveTypeName(name) && errorLocation!.Parent!.Kind === KindExportSpecifier) {
    Checker_error(receiver, errorLocation, Cannot_export_0_Only_local_declarations_can_be_exported_from_a_module, name);
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAndReportErrorForUsingNamespaceAsTypeOrValue","kind":"method","status":"implemented","sigHash":"0d029e232b7b6952e7700bfd75c6c7794ef8c5a43056bb2a767519b1e5aef711","bodyHash":"de23ff341c240d3e83b621869bb39e712d5838eec7003535b93a8a7cea723418"}
 *
 * Go source:
 * func (c *Checker) checkAndReportErrorForUsingNamespaceAsTypeOrValue(errorLocation *ast.Node, name string, meaning ast.SymbolFlags) bool {
 * 	if meaning&(ast.SymbolFlagsValue&^ast.SymbolFlagsType) != 0 {
 * 		symbol := c.resolveSymbol(c.resolveName(errorLocation, name, ast.SymbolFlagsNamespaceModule, nil /*nameNotFoundMessage* /, false /*isUse* /, false /*excludeGlobals* /))
 * 		if symbol != nil {
 * 			c.error(errorLocation, diagnostics.Cannot_use_namespace_0_as_a_value, name)
 * 			return true
 * 		}
 * 	} else if meaning&(ast.SymbolFlagsType&^ast.SymbolFlagsValue) != 0 {
 * 		symbol := c.resolveSymbol(c.resolveName(errorLocation, name, ast.SymbolFlagsModule, nil /*nameNotFoundMessage* /, false /*isUse* /, false /*excludeGlobals* /))
 * 		if symbol != nil {
 * 			c.error(errorLocation, diagnostics.Cannot_use_namespace_0_as_a_type, name)
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkAndReportErrorForUsingNamespaceAsTypeOrValue(receiver: GoPtr<Checker>, errorLocation: GoPtr<Node>, name: string, meaning: SymbolFlags): bool {
  const c = receiver!;
  if ((meaning & ((SymbolFlagsValue & ~SymbolFlagsType) as SymbolFlags)) !== 0) {
    const symbol = Checker_resolveSymbol(receiver, c.resolveName(errorLocation, name, SymbolFlagsNamespaceModule, undefined, false as bool, false as bool));
    if (symbol !== undefined) {
      Checker_error(receiver, errorLocation, Cannot_use_namespace_0_as_a_value, name);
      return true;
    }
  } else if ((meaning & ((SymbolFlagsType & ~SymbolFlagsValue) as SymbolFlags)) !== 0) {
    const symbol = Checker_resolveSymbol(receiver, c.resolveName(errorLocation, name, SymbolFlagsModule, undefined, false as bool, false as bool));
    if (symbol !== undefined) {
      Checker_error(receiver, errorLocation, Cannot_use_namespace_0_as_a_type, name);
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAndReportErrorForUsingTypeAsValue","kind":"method","status":"implemented","sigHash":"708fc07da39463f993e39abde0e8538b685108304c6552f09c94c5b41b7b430d","bodyHash":"5007957548c7e8186343de7d5d40ea3426bd41b52ed27d8f74835c84799bc0ff"}
 *
 * Go source:
 * func (c *Checker) checkAndReportErrorForUsingTypeAsValue(errorLocation *ast.Node, name string, meaning ast.SymbolFlags) bool {
 * 	if meaning&ast.SymbolFlagsValue != 0 {
 * 		if isPrimitiveTypeName(name) {
 * 			grandparent := errorLocation.Parent.Parent
 * 			if grandparent != nil && grandparent.Parent != nil && ast.IsHeritageClause(grandparent) {
 * 				heritageKind := grandparent.AsHeritageClause().Token
 * 				containerKind := grandparent.Parent.Kind
 * 				if containerKind == ast.KindInterfaceDeclaration && heritageKind == ast.KindExtendsKeyword {
 * 					c.error(errorLocation, diagnostics.An_interface_cannot_extend_a_primitive_type_like_0_It_can_only_extend_other_named_object_types, name)
 * 				} else if ast.IsClassLike(grandparent.Parent) && heritageKind == ast.KindExtendsKeyword {
 * 					c.error(errorLocation, diagnostics.A_class_cannot_extend_a_primitive_type_like_0_Classes_can_only_extend_constructable_values, name)
 * 				} else if ast.IsClassLike(grandparent.Parent) && heritageKind == ast.KindImplementsKeyword {
 * 					c.error(errorLocation, diagnostics.A_class_cannot_implement_a_primitive_type_like_0_It_can_only_implement_other_named_object_types, name)
 * 				}
 * 			} else {
 * 				c.error(errorLocation, diagnostics.X_0_only_refers_to_a_type_but_is_being_used_as_a_value_here, name)
 * 			}
 * 			return true
 * 		}
 * 		symbol := c.resolveSymbol(c.resolveName(errorLocation, name, ast.SymbolFlagsType & ^ast.SymbolFlagsValue, nil /*nameNotFoundMessage* /, false /*isUse* /, false /*excludeGlobals* /))
 * 		if symbol != nil {
 * 			allFlags := c.getSymbolFlags(symbol)
 * 			if allFlags&ast.SymbolFlagsValue == 0 {
 * 				if isES2015OrLaterConstructorName(name) {
 * 					c.error(errorLocation, diagnostics.X_0_only_refers_to_a_type_but_is_being_used_as_a_value_here_Do_you_need_to_change_your_target_library_Try_changing_the_lib_compiler_option_to_es2015_or_later, name)
 * 				} else if c.maybeMappedType(errorLocation, symbol) {
 * 					c.error(errorLocation, diagnostics.X_0_only_refers_to_a_type_but_is_being_used_as_a_value_here_Did_you_mean_to_use_1_in_0, name, core.IfElse(name == "K", "P", "K"))
 * 				} else {
 * 					c.error(errorLocation, diagnostics.X_0_only_refers_to_a_type_but_is_being_used_as_a_value_here, name)
 * 				}
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkAndReportErrorForUsingTypeAsValue(receiver: GoPtr<Checker>, errorLocation: GoPtr<Node>, name: string, meaning: SymbolFlags): bool {
  const c = receiver!;
  if ((meaning & SymbolFlagsValue) !== 0) {
    if (isPrimitiveTypeName(name)) {
      const grandparent = errorLocation!.Parent!.Parent;
      if (grandparent !== undefined && grandparent!.Parent !== undefined && IsHeritageClause(grandparent)) {
        const heritageKind = AsHeritageClause(grandparent)!.Token;
        const containerKind = grandparent!.Parent!.Kind;
        if (containerKind === KindInterfaceDeclaration && heritageKind === KindExtendsKeyword) {
          Checker_error(receiver, errorLocation, An_interface_cannot_extend_a_primitive_type_like_0_It_can_only_extend_other_named_object_types, name);
        } else if (IsClassLike(grandparent!.Parent) && heritageKind === KindExtendsKeyword) {
          Checker_error(receiver, errorLocation, A_class_cannot_extend_a_primitive_type_like_0_Classes_can_only_extend_constructable_values, name);
        } else if (IsClassLike(grandparent!.Parent) && heritageKind === KindImplementsKeyword) {
          Checker_error(receiver, errorLocation, A_class_cannot_implement_a_primitive_type_like_0_It_can_only_implement_other_named_object_types, name);
        }
      } else {
        Checker_error(receiver, errorLocation, X_0_only_refers_to_a_type_but_is_being_used_as_a_value_here, name);
      }
      return true;
    }
    const symbol = Checker_resolveSymbol(receiver, c.resolveName(errorLocation, name, (SymbolFlagsType & ~SymbolFlagsValue) as SymbolFlags, undefined, false as bool, false as bool));
    if (symbol !== undefined) {
      const allFlags = Checker_getSymbolFlags(receiver, symbol);
      if ((allFlags & SymbolFlagsValue) === 0) {
        if (isES2015OrLaterConstructorName(name)) {
          Checker_error(receiver, errorLocation, X_0_only_refers_to_a_type_but_is_being_used_as_a_value_here_Do_you_need_to_change_your_target_library_Try_changing_the_lib_compiler_option_to_es2015_or_later, name);
        } else if (Checker_maybeMappedType(receiver, errorLocation, symbol)) {
          Checker_error(receiver, errorLocation, X_0_only_refers_to_a_type_but_is_being_used_as_a_value_here_Did_you_mean_to_use_1_in_0, name, IfElse(name === "K", "P", "K"));
        } else {
          Checker_error(receiver, errorLocation, X_0_only_refers_to_a_type_but_is_being_used_as_a_value_here, name);
        }
        return true;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAndReportErrorForUsingValueAsType","kind":"method","status":"implemented","sigHash":"df1df0124dc999518fe86396d461c02395ec5d46c4c7a18683a2ccf9e935f213","bodyHash":"a48bebe23a22d5e548995c642a627133ae9c461414bd78e40c10d8fab7459758"}
 *
 * Go source:
 * func (c *Checker) checkAndReportErrorForUsingValueAsType(errorLocation *ast.Node, name string, meaning ast.SymbolFlags) bool {
 * 	if meaning&(ast.SymbolFlagsType & ^ast.SymbolFlagsNamespace) != 0 {
 * 		symbol := c.resolveSymbol(c.resolveName(errorLocation, name, ^ast.SymbolFlagsType&ast.SymbolFlagsValue, nil /*nameNotFoundMessage* /, false /*isUse* /, false /*excludeGlobals* /))
 * 		if symbol != nil && symbol.Flags&ast.SymbolFlagsNamespace == 0 {
 * 			c.error(errorLocation, diagnostics.X_0_refers_to_a_value_but_is_being_used_as_a_type_here_Did_you_mean_typeof_0, name)
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkAndReportErrorForUsingValueAsType(receiver: GoPtr<Checker>, errorLocation: GoPtr<Node>, name: string, meaning: SymbolFlags): bool {
  const c = receiver!;
  if ((meaning & ((SymbolFlagsType & ~SymbolFlagsNamespace) as SymbolFlags)) !== 0) {
    const symbol = Checker_resolveSymbol(receiver, c.resolveName(errorLocation, name, (~SymbolFlagsType & SymbolFlagsValue) as SymbolFlags, undefined, false as bool, false as bool));
    if (symbol !== undefined && (symbol!.Flags & SymbolFlagsNamespace) === 0) {
      Checker_error(receiver, errorLocation, X_0_refers_to_a_value_but_is_being_used_as_a_type_here_Did_you_mean_typeof_0, name);
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addTypeOnlyDeclarationRelatedInfo","kind":"method","status":"implemented","sigHash":"51d27b67eac687aa55c2c01c9ca535c18a3ae159383ab03484917f24a4651162","bodyHash":"c6295903298928bc25cb6ec4592cb99ffd2a33757ac2071a5e49098cbb531596"}
 *
 * Go source:
 * func (c *Checker) addTypeOnlyDeclarationRelatedInfo(diagnostic *ast.Diagnostic, typeOnlyDeclaration *ast.Node, name string) *ast.Diagnostic {
 * 	if typeOnlyDeclaration == nil {
 * 		return diagnostic
 * 	}
 * 	isExport := ast.IsExportSpecifier(typeOnlyDeclaration) || ast.IsExportDeclaration(typeOnlyDeclaration) || ast.IsNamespaceExport(typeOnlyDeclaration)
 * 	return diagnostic.AddRelatedInfo(NewDiagnosticForNode(typeOnlyDeclaration, core.IfElse(isExport, diagnostics.X_0_was_exported_here, diagnostics.X_0_was_imported_here), name))
 * }
 */
export function Checker_addTypeOnlyDeclarationRelatedInfo(receiver: GoPtr<Checker>, diagnostic: GoPtr<Diagnostic>, typeOnlyDeclaration: GoPtr<Node>, name: string): GoPtr<Diagnostic> {
  if (typeOnlyDeclaration === undefined) {
    return diagnostic;
  }
  const isExport = IsExportSpecifier(typeOnlyDeclaration) || IsExportDeclaration(typeOnlyDeclaration) || IsNamespaceExport(typeOnlyDeclaration);
  return Diagnostic_AddRelatedInfo(diagnostic, NewDiagnosticForNode(typeOnlyDeclaration, IfElse(isExport, X_0_was_exported_here, X_0_was_imported_here), name));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkSourceElementUnreachable","kind":"method","status":"implemented","sigHash":"ae4de570e8c52b2371dc2b6d6103c3eeb2a9912c21110e95edfe69f1edb417bf","bodyHash":"2a460073990ef3630e770cec79e6eccf7bb97095850167139598708afa7c2057"}
 *
 * Go source:
 * func (c *Checker) checkSourceElementUnreachable(node *ast.Node) bool {
 * 	if !ast.IsPotentiallyExecutableNode(node) {
 * 		return false
 * 	}
 * 
 * 	if c.reportedUnreachableNodes.Has(node) {
 * 		return true
 * 	}
 * 
 * 	if !c.isSourceElementUnreachable(node) {
 * 		return false
 * 	}
 * 
 * 	c.reportedUnreachableNodes.Add(node)
 * 
 * 	sourceFile := ast.GetSourceFileOfNode(node)
 * 
 * 	startNode := node
 * 	endNode := node
 * 
 * 	parent := node.Parent
 * 	if parent.CanHaveStatements() {
 * 		statements := parent.Statements()
 * 		if offset := slices.Index(statements, node); offset >= 0 {
 * 			// Scan backwards to find the first unreachable unreported node;
 * 			// this may happen when producing region diagnostics where not all nodes
 * 			// will have been visited.
 * 			// TODO: enable this code once we support region diagnostics again.
 * 			first := offset
 * 			// for i := offset - 1; i >= 0; i-- {
 * 			// 	prevNode := statements[i]
 * 			// 	if !ast.IsPotentiallyExecutableNode(prevNode) || c.reportedUnreachableNodes.Has(prevNode) || !c.isSourceElementUnreachable(prevNode) {
 * 			// 		break
 * 			// 	}
 * 			// 	firstUnreachableIndex = i
 * 			// 	c.reportedUnreachableNodes.Add(prevNode)
 * 			// }
 * 
 * 			last := offset
 * 			for i := offset + 1; i < len(statements); i++ {
 * 				nextNode := statements[i]
 * 				if !ast.IsPotentiallyExecutableNode(nextNode) || !c.isSourceElementUnreachable(nextNode) {
 * 					break
 * 				}
 * 				last = i
 * 				c.reportedUnreachableNodes.Add(nextNode)
 * 			}
 * 
 * 			startNode = statements[first]
 * 			endNode = statements[last]
 * 		}
 * 	}
 * 
 * 	start := scanner.GetTokenPosOfNode(startNode, sourceFile, false /*includeJSDoc* /)
 * 
 * 	diagnostic := ast.NewDiagnostic(sourceFile, core.NewTextRange(start, endNode.End()), diagnostics.Unreachable_code_detected)
 * 	c.addErrorOrSuggestion(c.compilerOptions.AllowUnreachableCode == core.TSFalse, diagnostic)
 * 
 * 	return true
 * }
 */
export function Checker_checkSourceElementUnreachable(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const c = receiver!;
  if (!IsPotentiallyExecutableNode(node)) {
    return false;
  }
  if (Set_Has(c.reportedUnreachableNodes, node)) {
    return true;
  }
  if (!Checker_isSourceElementUnreachable(receiver, node)) {
    return false;
  }
  Set_Add(c.reportedUnreachableNodes, node);
  const sourceFile = GetSourceFileOfNode(node);
  let startNode = node;
  let endNode = node;
  const parent = node!.Parent;
  if (Node_CanHaveStatements(parent)) {
    const statements = Node_Statements(parent);
    if (statements !== undefined) {
      const offset = slices.Index(statements, node);
      if (offset >= 0) {
        const first = offset;
        let last = offset;
        for (let i = offset + 1; i < statements.length; i++) {
          const nextNode = statements[i];
          if (!IsPotentiallyExecutableNode(nextNode) || !Checker_isSourceElementUnreachable(receiver, nextNode)) {
            break;
          }
          last = i;
          Set_Add(c.reportedUnreachableNodes, nextNode);
        }
        startNode = statements[first];
        endNode = statements[last];
      }
    }
  }
  const start = GetTokenPosOfNode(startNode, sourceFile, false as bool);
  const diagnostic = NewDiagnostic(sourceFile, NewTextRange(start, Node_End(endNode)), Unreachable_code_detected);
  Checker_addErrorOrSuggestion(receiver, c.compilerOptions!.AllowUnreachableCode === TSFalse, diagnostic);
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isSourceElementUnreachable","kind":"method","status":"implemented","sigHash":"099e433da0304d11df3e05e3b321b9649c5128ae2c97f5927404f35808a574c4","bodyHash":"c377c210e7200a825d9d0e3f85c469b61fdc227fafaa6983e57d42098ce513a6"}
 *
 * Go source:
 * func (c *Checker) isSourceElementUnreachable(node *ast.Node) bool {
 * 	// Precondition: ast.IsPotentiallyExecutableNode is true
 * 	if node.Flags&ast.NodeFlagsUnreachable != 0 {
 * 		// The binder has determined that this code is unreachable.
 * 		// Ignore const enums unless preserveConstEnums is set.
 * 		switch node.Kind {
 * 		case ast.KindEnumDeclaration:
 * 			return !ast.IsEnumConst(node) || c.compilerOptions.ShouldPreserveConstEnums()
 * 		case ast.KindModuleDeclaration:
 * 			return ast.IsInstantiatedModule(node, c.compilerOptions.ShouldPreserveConstEnums())
 * 		default:
 * 			return true
 * 		}
 * 	} else if flowNode := node.FlowNodeData().FlowNode; flowNode != nil {
 * 		// For code the binder doesn't know is unreachable, use control flow / types.
 * 		return !c.isReachableFlowNode(flowNode)
 * 	}
 * 	return false
 * }
 */
export function Checker_isSourceElementUnreachable(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const c = receiver!;
  if ((node!.Flags & NodeFlagsUnreachable) !== 0) {
    switch (node!.Kind) {
      case KindEnumDeclaration:
        return !IsEnumConst(node) || CompilerOptions_ShouldPreserveConstEnums(c.compilerOptions);
      case KindModuleDeclaration:
        return IsInstantiatedModule(node, CompilerOptions_ShouldPreserveConstEnums(c.compilerOptions));
      default:
        return true;
    }
  } else {
    const flowNodeData = Node_FlowNodeData(node);
    if (flowNodeData !== undefined) {
      const flowNode = (flowNodeData as unknown as { FlowNode?: GoPtr<FlowNode> }).FlowNode;
      if (flowNode !== undefined) {
        return !Checker_isReachableFlowNode(receiver, flowNode);
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDeprecatedSuggestionNode","kind":"method","status":"implemented","sigHash":"6a3ec218d229f75f55b76cabfe38a396b43d9f8c15e56cbb8f1e58a8ef358537","bodyHash":"ee9def3b32579643f446ea7fb51535605c751563726f98e7488a2ae0559df2aa"}
 *
 * Go source:
 * func (c *Checker) getDeprecatedSuggestionNode(node *ast.Node) *ast.Node {
 * 	node = ast.SkipParentheses(node)
 * 	switch node.Kind {
 * 	case ast.KindCallExpression, ast.KindDecorator, ast.KindNewExpression:
 * 		return c.getDeprecatedSuggestionNode(node.Expression())
 * 	case ast.KindTaggedTemplateExpression:
 * 		return c.getDeprecatedSuggestionNode(node.AsTaggedTemplateExpression().Tag)
 * 	case ast.KindJsxOpeningElement, ast.KindJsxSelfClosingElement:
 * 		return c.getDeprecatedSuggestionNode(node.TagName())
 * 	case ast.KindElementAccessExpression:
 * 		return node.AsElementAccessExpression().ArgumentExpression
 * 	case ast.KindPropertyAccessExpression:
 * 		return node.Name()
 * 	case ast.KindTypeReference:
 * 		typeName := node.AsTypeReferenceNode().TypeName
 * 		if ast.IsQualifiedName(typeName) {
 * 			return typeName.AsQualifiedName().Right
 * 		}
 * 	}
 * 	return node
 * }
 */
export function Checker_getDeprecatedSuggestionNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node> {
  node = SkipParentheses(node as GoPtr<Expression>) as GoPtr<Node>;
  switch (node!.Kind) {
    case KindCallExpression:
    case KindDecorator:
    case KindNewExpression:
      return Checker_getDeprecatedSuggestionNode(receiver, Node_Expression(node));
    case KindTaggedTemplateExpression:
      return Checker_getDeprecatedSuggestionNode(receiver, AsTaggedTemplateExpression(node)!.Tag as GoPtr<Node>);
    case KindJsxOpeningElement:
    case KindJsxSelfClosingElement:
      return Checker_getDeprecatedSuggestionNode(receiver, Node_TagName(node));
    case KindElementAccessExpression:
      return AsElementAccessExpression(node)!.ArgumentExpression as GoPtr<Node>;
    case KindPropertyAccessExpression:
      return Node_Name(node);
    case KindTypeReference: {
      const typeName = AsTypeReferenceNode(node)!.TypeName as GoPtr<Node>;
      if (IsQualifiedName(typeName)) {
        return AsQualifiedName(typeName)!.Right as GoPtr<Node>;
      }
      break;
    }
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportDuplicateMemberErrors","kind":"method","status":"implemented","sigHash":"aedff69d55ee29d6583d4e30dbe212e9c7658884128770d1d870883abfdd2c22","bodyHash":"2f5e104c2673d5a02ec181ff898f61ef887b8cb23fa1d93f1c3999fe426c4d62"}
 *
 * Go source:
 * func (c *Checker) reportDuplicateMemberErrors(node *ast.Node, name string, checkStatic bool, isStatic bool, message *diagnostics.Message) {
 * 	for _, member := range node.Members() {
 * 		if ast.IsConstructorDeclaration(member) {
 * 			for _, param := range member.Parameters() {
 * 				if ast.IsParameterPropertyDeclaration(param, member) && !ast.IsBindingPattern(param.Name()) {
 * 					if symbol := c.getSymbolOfDeclaration(param); symbol.Name == name {
 * 						c.error(param.Name(), message, c.symbolToString(symbol))
 * 					}
 * 				}
 * 			}
 * 		} else if symbol := c.getSymbolOfDeclaration(member); symbol != nil && symbol.Name == name && (!checkStatic || isStatic == ast.IsStatic(member)) {
 * 			c.error(member.Name(), message, c.symbolToString(symbol))
 * 		}
 * 	}
 * }
 */
export function Checker_reportDuplicateMemberErrors(receiver: GoPtr<Checker>, node: GoPtr<Node>, name: string, checkStatic: bool, isStatic: bool, message: GoPtr<Message>): void {
  for (const member of Node_Members(node)!) {
    if (IsConstructorDeclaration(member)) {
      for (const param of Node_Parameters(member)) {
        if (IsParameterPropertyDeclaration(param, member) && !IsBindingPattern(Node_Name(param))) {
          const symbol = Checker_getSymbolOfDeclaration(receiver, param);
          if (symbol!.Name === name) {
            Checker_error(receiver, Node_Name(param), message, Checker_symbolToString(receiver, symbol));
          }
        }
      }
    } else {
      const symbol = Checker_getSymbolOfDeclaration(receiver, member);
      if (symbol !== undefined && symbol!.Name === name && (!checkStatic || isStatic === IsStatic(member))) {
        Checker_error(receiver, Node_Name(member), message, Checker_symbolToString(receiver, symbol));
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.issueMemberSpecificError","kind":"method","status":"implemented","sigHash":"8534ca39c472c9366efc02900585a053b4f4cb901b742452532495dfeace78be","bodyHash":"c2ac640f44a5d37e716485bf9234602868437e11f3b8936ff753c9049925cce4"}
 *
 * Go source:
 * func (c *Checker) issueMemberSpecificError(node *ast.Node, typeWithThis *Type, baseWithThis *Type, broadDiag *diagnostics.Message) {
 * 	// iterate over all implemented properties and issue errors on each one which isn't compatible, rather than the class as a whole, if possible
 * 	issuedMemberError := false
 * 	for _, member := range node.Members() {
 * 		if ast.IsStatic(member) {
 * 			continue
 * 		}
 * 		if declaredProp := c.getSymbolOfDeclaration(member); declaredProp != nil && declaredProp.Name != ast.InternalSymbolNameComputed {
 * 			prop := c.getPropertyOfType(typeWithThis, declaredProp.Name)
 * 			baseProp := c.getPropertyOfType(baseWithThis, declaredProp.Name)
 * 			if prop != nil && baseProp != nil {
 * 				var diags []*ast.Diagnostic
 * 				if !c.checkTypeAssignableToEx(c.getTypeOfSymbol(prop), c.getTypeOfSymbol(baseProp), core.OrElse(member.Name(), member), nil /*headMessage* /, &diags) {
 * 					c.addDiagnostic(ast.NewDiagnosticChain(diags[0], diagnostics.Property_0_in_type_1_is_not_assignable_to_the_same_property_in_base_type_2, c.symbolToString(declaredProp), c.TypeToString(typeWithThis), c.TypeToString(baseWithThis)))
 * 					issuedMemberError = true
 * 				}
 * 			}
 * 		}
 * 	}
 * 	if !issuedMemberError {
 * 		// check again with diagnostics to generate a less-specific error
 * 		c.checkTypeAssignableTo(typeWithThis, baseWithThis, core.OrElse(node.Name(), node), broadDiag)
 * 	}
 * }
 */
export function Checker_issueMemberSpecificError(receiver: GoPtr<Checker>, node: GoPtr<Node>, typeWithThis: GoPtr<Type>, baseWithThis: GoPtr<Type>, broadDiag: GoPtr<Message>): void {
  const c = receiver!;
  let issuedMemberError = false;
  for (const member of Node_Members(node)!) {
    if (IsStatic(member)) {
      continue;
    }
    const declaredProp = Checker_getSymbolOfDeclaration(receiver, member);
    if (declaredProp !== undefined && declaredProp!.Name !== InternalSymbolNameComputed) {
      const prop = Checker_getPropertyOfType(receiver, typeWithThis, declaredProp!.Name);
      const baseProp = Checker_getPropertyOfType(receiver, baseWithThis, declaredProp!.Name);
      if (prop !== undefined && baseProp !== undefined) {
        const diags: GoSlice<GoPtr<Diagnostic>> = [];
        if (!Checker_checkTypeAssignableToEx(receiver, Checker_getTypeOfSymbol(receiver, prop), Checker_getTypeOfSymbol(receiver, baseProp), OrElse(Node_Name(member), member), undefined, diags)) {
          Checker_addDiagnostic(receiver, NewDiagnosticChain(diags[0], Property_0_in_type_1_is_not_assignable_to_the_same_property_in_base_type_2, Checker_symbolToString(receiver, declaredProp), Checker_TypeToString(receiver, typeWithThis), Checker_TypeToString(receiver, baseWithThis)));
          issuedMemberError = true;
        }
      }
    }
  }
  if (!issuedMemberError) {
    Checker_checkTypeAssignableTo(receiver, typeWithThis, baseWithThis, OrElse(Node_Name(node), node), broadDiag);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportTypeNotIterableError","kind":"method","status":"implemented","sigHash":"4d75bb2879c0271f9191855816ae3f3b0fa2fc4a968dab69e86b3071ed8492ce","bodyHash":"1cfd1da29ab31cf458e272f7e44b4022f3797e2692d1802f5be26a5e487fe7a2"}
 *
 * Go source:
 * func (c *Checker) reportTypeNotIterableError(errorNode *ast.Node, t *Type, allowAsyncIterables bool) *ast.Diagnostic {
 * 	var message *diagnostics.Message
 * 	if allowAsyncIterables {
 * 		message = diagnostics.Type_0_must_have_a_Symbol_asyncIterator_method_that_returns_an_async_iterator
 * 	} else {
 * 		message = diagnostics.Type_0_must_have_a_Symbol_iterator_method_that_returns_an_iterator
 * 	}
 * 	suggestAwait := c.getAwaitedTypeOfPromise(t) != nil || (!allowAsyncIterables &&
 * 		ast.IsForOfStatement(errorNode.Parent) &&
 * 		errorNode.Parent.Expression() == errorNode &&
 * 		c.getGlobalAsyncIterableType() != c.emptyGenericType &&
 * 		c.isTypeAssignableTo(t, c.createTypeFromGenericGlobalType(c.getGlobalAsyncIterableType(), []*Type{c.anyType, c.anyType, c.anyType})))
 * 	return c.errorAndMaybeSuggestAwait(errorNode, suggestAwait, message, c.TypeToString(t))
 * }
 */
export function Checker_reportTypeNotIterableError(receiver: GoPtr<Checker>, errorNode: GoPtr<Node>, t: GoPtr<Type>, allowAsyncIterables: bool): GoPtr<Diagnostic> {
  const c = receiver!;
  const message = allowAsyncIterables
    ? Type_0_must_have_a_Symbol_asyncIterator_method_that_returns_an_async_iterator
    : Type_0_must_have_a_Symbol_iterator_method_that_returns_an_iterator;
  const suggestAwait: bool = Checker_getAwaitedTypeOfPromise(receiver, t) !== undefined || (!allowAsyncIterables &&
    IsForOfStatement(errorNode!.Parent) &&
    Node_Expression(errorNode!.Parent) === errorNode &&
    c.getGlobalAsyncIterableType() !== c.emptyGenericType &&
    Checker_isTypeAssignableTo(receiver, t, Checker_createTypeFromGenericGlobalType(receiver, c.getGlobalAsyncIterableType(), [c.anyType, c.anyType, c.anyType])));
  return Checker_errorAndMaybeSuggestAwait(receiver, errorNode, suggestAwait, message, Checker_TypeToString(receiver, t));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIterationDiagnosticDetails","kind":"method","status":"implemented","sigHash":"a44d145e07c1faad36e4c32ae4aac0700f1f8e69231dff5ffefb11093af1585a","bodyHash":"4260a6be92b46f9dc011d710daaaac36f1968f9f2e180a5b0962f0475ada789c"}
 *
 * Go source:
 * func (c *Checker) getIterationDiagnosticDetails(use IterationUse, inputType *Type, allowsStrings bool) (*diagnostics.Message, bool) {
 * 	yieldType := c.getIterationTypeOfIterable(use, IterationTypeKindYield, inputType, nil /*errorNode* /)
 * 	if yieldType != nil {
 * 		return diagnostics.Type_0_can_only_be_iterated_through_when_using_the_downlevelIteration_flag_or_with_a_target_of_es2015_or_higher, false
 * 	}
 * 	if inputType.symbol != nil && isES2015OrLaterIterable(inputType.symbol.Name) {
 * 		return diagnostics.Type_0_can_only_be_iterated_through_when_using_the_downlevelIteration_flag_or_with_a_target_of_es2015_or_higher, true
 * 	}
 * 	if allowsStrings {
 * 		return diagnostics.Type_0_is_not_an_array_type_or_a_string_type, true
 * 	}
 * 	return diagnostics.Type_0_is_not_an_array_type, true
 * }
 */
export function Checker_getIterationDiagnosticDetails(receiver: GoPtr<Checker>, use: IterationUse, inputType: GoPtr<Type>, allowsStrings: bool): [GoPtr<Message>, bool] {
  const yieldType = Checker_getIterationTypeOfIterable(receiver, use, IterationTypeKindYield, inputType, undefined);
  if (yieldType !== undefined) {
    return [Type_0_can_only_be_iterated_through_when_using_the_downlevelIteration_flag_or_with_a_target_of_es2015_or_higher, false];
  }
  if (inputType!["symbol"] !== undefined && isES2015OrLaterIterable(inputType!["symbol"]!.Name)) {
    return [Type_0_can_only_be_iterated_through_when_using_the_downlevelIteration_flag_or_with_a_target_of_es2015_or_higher, true];
  }
  if (allowsStrings) {
    return [Type_0_is_not_an_array_type_or_a_string_type, true];
  }
  return [Type_0_is_not_an_array_type, true];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.unusedIsError","kind":"method","status":"implemented","sigHash":"46d8d71ac20213427fd1032ad2418b42a2b475a62141d9c7ae907db7b4cf25f6","bodyHash":"a9ef6483440d64bba14a7c873a496d9375e4a43cce0d712e7c762f17ce993023"}
 *
 * Go source:
 * func (c *Checker) unusedIsError(kind UnusedKind) bool {
 * 	switch kind {
 * 	case UnusedKindLocal:
 * 		return c.compilerOptions.NoUnusedLocals.IsTrue()
 * 	case UnusedKindParameter:
 * 		return c.compilerOptions.NoUnusedParameters.IsTrue()
 * 	default:
 * 		panic("Unhandled case in unusedIsError")
 * 	}
 * }
 */
export function Checker_unusedIsError(receiver: GoPtr<Checker>, kind: UnusedKind): bool {
  const c = receiver!;
  switch (kind) {
    case UnusedKindLocal:
      return Tristate_IsTrue(c.compilerOptions!.NoUnusedLocals);
    case UnusedKindParameter:
      return Tristate_IsTrue(c.compilerOptions!.NoUnusedParameters);
    default:
      throw new globalThis.Error("Unhandled case in unusedIsError");
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkNonNullTypeWithReporter","kind":"method","status":"implemented","sigHash":"aaf7379538fd2ab157fe0f0dc0f1cc065994cdca15925b455441f1a0e2f32de3","bodyHash":"696b46a588008056ff3d357ef29f24fbe0da32bc88bbf1e3a8de6daaddd8868c"}
 *
 * Go source:
 * func (c *Checker) checkNonNullTypeWithReporter(t *Type, node *ast.Node, reportError func(c *Checker, node *ast.Node, facts TypeFacts)) *Type {
 * 	if c.strictNullChecks && t.flags&TypeFlagsUnknown != 0 {
 * 		if ast.IsEntityNameExpression(node) {
 * 			nodeText := entityNameToString(node)
 * 			if len(nodeText) < 100 {
 * 				c.error(node, diagnostics.X_0_is_of_type_unknown, nodeText)
 * 				return c.errorType
 * 			}
 * 		}
 * 		c.error(node, diagnostics.Object_is_of_type_unknown)
 * 		return c.errorType
 * 	}
 * 	facts := c.getTypeFacts(t, TypeFactsIsUndefinedOrNull)
 * 	if facts&TypeFactsIsUndefinedOrNull != 0 {
 * 		reportError(c, node, facts)
 * 		nonNullable := c.GetNonNullableType(t)
 * 		if nonNullable.flags&(TypeFlagsNullable|TypeFlagsNever) != 0 {
 * 			return c.errorType
 * 		}
 * 		return nonNullable
 * 	}
 * 	return t
 * }
 */
export function Checker_checkNonNullTypeWithReporter(receiver: GoPtr<Checker>, t: GoPtr<Type>, node: GoPtr<Node>, reportError: (c: GoPtr<Checker>, node: GoPtr<Node>, facts: TypeFacts) => void): GoPtr<Type> {
  const c = receiver!;
  if (c.strictNullChecks && (t!.flags & TypeFlagsUnknown) !== 0) {
    if (IsEntityNameExpression(node)) {
      const nodeText = entityNameToString(node);
      if (nodeText.length < 100) {
        Checker_error(receiver, node, X_0_is_of_type_unknown, nodeText);
        return c.errorType;
      }
    }
    Checker_error(receiver, node, Object_is_of_type_unknown);
    return c.errorType;
  }
  const facts = Checker_getTypeFacts(receiver, t, TypeFactsIsUndefinedOrNull);
  if ((facts & TypeFactsIsUndefinedOrNull) !== 0) {
    reportError(receiver, node, facts);
    const nonNullable = Checker_GetNonNullableType(receiver, t);
    if ((nonNullable!.flags & (TypeFlagsNullable | TypeFlagsNever)) !== 0) {
      return c.errorType;
    }
    return nonNullable;
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportObjectPossiblyNullOrUndefinedError","kind":"method","status":"implemented","sigHash":"d0a53d9fa3154b111f6bcee2c79f1a46761552e57951014e5c1fdb1e9de9a378","bodyHash":"6ce352f9c3ef91142a8bc7f212f5245cc135159fde389564c7500d80be22e768"}
 *
 * Go source:
 * func (c *Checker) reportObjectPossiblyNullOrUndefinedError(node *ast.Node, facts TypeFacts) {
 * 	var nodeText string
 * 	if ast.IsEntityNameExpression(node) {
 * 		nodeText = entityNameToString(node)
 * 	}
 * 	if node.Kind == ast.KindNullKeyword {
 * 		c.error(node, diagnostics.The_value_0_cannot_be_used_here, "null")
 * 		return
 * 	}
 * 	if nodeText != "" && len(nodeText) < 100 {
 * 		if ast.IsIdentifier(node) && nodeText == "undefined" {
 * 			c.error(node, diagnostics.The_value_0_cannot_be_used_here, "undefined")
 * 			return
 * 		}
 * 		c.error(node, core.IfElse(facts&TypeFactsIsUndefined != 0,
 * 			core.IfElse(facts&TypeFactsIsNull != 0,
 * 				diagnostics.X_0_is_possibly_null_or_undefined,
 * 				diagnostics.X_0_is_possibly_undefined),
 * 			diagnostics.X_0_is_possibly_null), nodeText)
 * 	} else {
 * 		c.error(node, core.IfElse(facts&TypeFactsIsUndefined != 0,
 * 			core.IfElse(facts&TypeFactsIsNull != 0,
 * 				diagnostics.Object_is_possibly_null_or_undefined,
 * 				diagnostics.Object_is_possibly_undefined),
 * 			diagnostics.Object_is_possibly_null))
 * 	}
 * }
 */
export function Checker_reportObjectPossiblyNullOrUndefinedError(receiver: GoPtr<Checker>, node: GoPtr<Node>, facts: TypeFacts): void {
  let nodeText = "";
  if (IsEntityNameExpression(node)) {
    nodeText = entityNameToString(node);
  }
  if (node!.Kind === KindNullKeyword) {
    Checker_error(receiver, node, The_value_0_cannot_be_used_here, "null");
    return;
  }
  if (nodeText !== "" && nodeText.length < 100) {
    if (IsIdentifier(node) && nodeText === "undefined") {
      Checker_error(receiver, node, The_value_0_cannot_be_used_here, "undefined");
      return;
    }
    Checker_error(receiver, node, IfElse((facts & TypeFactsIsUndefined) !== 0,
      IfElse((facts & TypeFactsIsNull) !== 0,
        X_0_is_possibly_null_or_undefined,
        X_0_is_possibly_undefined),
      X_0_is_possibly_null), nodeText);
  } else {
    Checker_error(receiver, node, IfElse((facts & TypeFactsIsUndefined) !== 0,
      IfElse((facts & TypeFactsIsNull) !== 0,
        Object_is_possibly_null_or_undefined,
        Object_is_possibly_undefined),
      Object_is_possibly_null));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkDeprecatedSignature","kind":"method","status":"implemented","sigHash":"bb6fee91b0856efbe69e3610c4fd61fd889348465e3972f99c6756d1fcead770","bodyHash":"fde5e898a9ecd61fad180ab06fc4d0fd6331e332839a385f884527532d6d9da9"}
 *
 * Go source:
 * func (c *Checker) checkDeprecatedSignature(sig *Signature, node *ast.Node) {
 * 	if sig.flags&SignatureFlagsIsSignatureCandidateForOverloadFailure != 0 {
 * 		return
 * 	}
 * 	if sig.declaration != nil && c.IsDeprecatedDeclaration(sig.declaration) {
 * 		suggestionNode := c.getDeprecatedSuggestionNode(node)
 * 		name := tryGetPropertyAccessOrIdentifierToString(ast.GetInvokedExpression(node))
 * 		c.addDeprecatedSuggestionWithSignature(suggestionNode, sig.declaration, name, c.signatureToString(sig))
 * 	}
 * }
 */
export function Checker_checkDeprecatedSignature(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, node: GoPtr<Node>): void {
  if ((sig!.flags & SignatureFlagsIsSignatureCandidateForOverloadFailure) !== 0) {
    return;
  }
  if (sig!.declaration !== undefined && Checker_IsDeprecatedDeclaration(receiver, sig!.declaration)) {
    const suggestionNode = Checker_getDeprecatedSuggestionNode(receiver, node);
    const name = tryGetPropertyAccessOrIdentifierToString(GetInvokedExpression(node));
    Checker_addDeprecatedSuggestionWithSignature(receiver, suggestionNode, sig!.declaration, name, Checker_signatureToString(receiver, sig));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addDeprecatedSuggestionWithSignature","kind":"method","status":"implemented","sigHash":"8207edd87da1df5bbc2c77f421432f2b7faa2027fc029953c7906cec5f7e72eb","bodyHash":"c4e8e88d538723765656a257d6315c785f69658dd52cc97aeadcb76730eaa4cc"}
 *
 * Go source:
 * func (c *Checker) addDeprecatedSuggestionWithSignature(location *ast.Node, declaration *ast.Node, deprecatedEntity string, signatureString string) *ast.Diagnostic {
 * 	message := core.IfElse(deprecatedEntity != "", diagnostics.The_signature_0_of_1_is_deprecated, diagnostics.X_0_is_deprecated)
 * 	diagnostic := NewDiagnosticForNode(location, message, signatureString, deprecatedEntity)
 * 	return c.addDeprecatedSuggestionWorker([]*ast.Node{declaration}, diagnostic)
 * }
 */
export function Checker_addDeprecatedSuggestionWithSignature(receiver: GoPtr<Checker>, location: GoPtr<Node>, declaration: GoPtr<Node>, deprecatedEntity: string, signatureString: string): GoPtr<Diagnostic> {
  const message = IfElse(deprecatedEntity !== "", The_signature_0_of_1_is_deprecated, X_0_is_deprecated);
  const diagnostic = NewDiagnosticForNode(location, message, signatureString, deprecatedEntity);
  return Checker_addDeprecatedSuggestionWorker(receiver, [declaration], diagnostic);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDiagnosticHeadMessageForDecoratorResolution","kind":"method","status":"implemented","sigHash":"f9aea19c43e4ec7f981b60b15dc4134284756e4103106c92da003e5ac108d94f","bodyHash":"3bd5bd67b0c6590fdd00a902738350736c10d53bfe03e6ed43b84ce3af9638c8"}
 *
 * Go source:
 * func (c *Checker) getDiagnosticHeadMessageForDecoratorResolution(node *ast.Node) *diagnostics.Message {
 * 	switch node.Parent.Kind {
 * 	case ast.KindClassDeclaration, ast.KindClassExpression:
 * 		return diagnostics.Unable_to_resolve_signature_of_class_decorator_when_called_as_an_expression
 * 	case ast.KindParameter:
 * 		return diagnostics.Unable_to_resolve_signature_of_parameter_decorator_when_called_as_an_expression
 * 	case ast.KindPropertyDeclaration:
 * 		return diagnostics.Unable_to_resolve_signature_of_property_decorator_when_called_as_an_expression
 * 	case ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor:
 * 		return diagnostics.Unable_to_resolve_signature_of_method_decorator_when_called_as_an_expression
 * 	}
 * 	panic("Unhandled case in getDiagnosticHeadMessageForDecoratorResolution")
 * }
 */
export function Checker_getDiagnosticHeadMessageForDecoratorResolution(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Message> {
  switch (node!.Parent!.Kind) {
    case KindClassDeclaration:
    case KindClassExpression:
      return Unable_to_resolve_signature_of_class_decorator_when_called_as_an_expression;
    case KindParameter:
      return Unable_to_resolve_signature_of_parameter_decorator_when_called_as_an_expression;
    case KindPropertyDeclaration:
      return Unable_to_resolve_signature_of_property_decorator_when_called_as_an_expression;
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
      return Unable_to_resolve_signature_of_method_decorator_when_called_as_an_expression;
  }
  throw new globalThis.Error("Unhandled case in getDiagnosticHeadMessageForDecoratorResolution");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportCallResolutionErrors","kind":"method","status":"implemented","sigHash":"b53e1df31b2b460a4600844bf3e882cae56f028872e89dd7ef8a480d9ee5748a","bodyHash":"437b02d32034811e1876ce1d3b383c0ea77ceaac1f48bc703e360a90ff002840"}
 *
 * Go source:
 * func (c *Checker) reportCallResolutionErrors(node *ast.Node, s *CallState, signatures []*Signature, headMessage *diagnostics.Message) {
 * 	switch {
 * 	case len(s.candidatesForArgumentError) != 0:
 * 		last := s.candidatesForArgumentError[len(s.candidatesForArgumentError)-1]
 * 		var diags []*ast.Diagnostic
 * 		c.isSignatureApplicable(s.node, s.args, last, c.assignableRelation, CheckModeNormal, true /*reportErrors* /, &diags)
 * 		for _, diagnostic := range diags {
 * 			if len(s.candidatesForArgumentError) > 1 {
 * 				diagnostic = ast.NewDiagnosticChain(diagnostic, diagnostics.The_last_overload_gave_the_following_error)
 * 				diagnostic = ast.NewDiagnosticChain(diagnostic, diagnostics.No_overload_matches_this_call)
 * 			}
 * 			if headMessage != nil {
 * 				diagnostic = ast.NewDiagnosticChain(diagnostic, headMessage)
 * 			}
 * 			if last.declaration != nil && len(s.candidatesForArgumentError) > 1 {
 * 				diagnostic.AddRelatedInfo(NewDiagnosticForNode(last.declaration, diagnostics.The_last_overload_is_declared_here))
 * 			}
 * 			c.addImplementationSuccessElaboration(s, last, diagnostic)
 * 			c.addDiagnostic(diagnostic)
 * 		}
 * 	case s.candidateForArgumentArityError != nil:
 * 		c.addDiagnostic(c.getArgumentArityError(s.node, []*Signature{s.candidateForArgumentArityError}, s.args, headMessage))
 * 	case s.candidateForTypeArgumentError != nil:
 * 		c.checkTypeArguments(s.candidateForTypeArgumentError, s.node.TypeArguments(), true /*reportErrors* /, headMessage)
 * 	case !ast.IsJsxOpeningFragment(node):
 * 		signaturesWithCorrectTypeArgumentArity := core.Filter(signatures, func(sig *Signature) bool {
 * 			return c.hasCorrectTypeArgumentArity(sig, s.typeArguments)
 * 		})
 * 		if len(signaturesWithCorrectTypeArgumentArity) == 0 {
 * 			c.addDiagnostic(c.getTypeArgumentArityError(s.node, signatures, s.typeArguments, headMessage))
 * 		} else {
 * 			c.addDiagnostic(c.getArgumentArityError(s.node, signaturesWithCorrectTypeArgumentArity, s.args, headMessage))
 * 		}
 * 	}
 * }
 */
export function Checker_reportCallResolutionErrors(receiver: GoPtr<Checker>, node: GoPtr<Node>, s: GoPtr<CallState>, signatures: GoSlice<GoPtr<Signature>>, headMessage: GoPtr<Message>): void {
  const c = receiver!;
  if (s!.candidatesForArgumentError.length !== 0) {
    const last = s!.candidatesForArgumentError[s!.candidatesForArgumentError.length - 1];
    const diags: Array<GoPtr<Diagnostic>> = [];
    Checker_isSignatureApplicable(receiver, s!.node, s!.args, last, c.assignableRelation, CheckModeNormal, true as bool, diags);
    for (let diagnostic of diags) {
      if (s!.candidatesForArgumentError.length > 1) {
        diagnostic = NewDiagnosticChain(diagnostic, The_last_overload_gave_the_following_error);
        diagnostic = NewDiagnosticChain(diagnostic, No_overload_matches_this_call);
      }
      if (headMessage !== undefined) {
        diagnostic = NewDiagnosticChain(diagnostic, headMessage);
      }
      if (last!.declaration !== undefined && s!.candidatesForArgumentError.length > 1) {
        Diagnostic_AddRelatedInfo(diagnostic, NewDiagnosticForNode(last!.declaration, The_last_overload_is_declared_here));
      }
      Checker_addImplementationSuccessElaboration(receiver, s, last, diagnostic);
      Checker_addDiagnostic(receiver, diagnostic);
    }
  } else if (s!.candidateForArgumentArityError !== undefined) {
    Checker_addDiagnostic(receiver, Checker_getArgumentArityError(receiver, s!.node, [s!.candidateForArgumentArityError], s!.args, headMessage));
  } else if (s!.candidateForTypeArgumentError !== undefined) {
    Checker_checkTypeArguments(receiver, s!.candidateForTypeArgumentError, Node_TypeArguments(s!.node) ?? [], true as bool, headMessage);
  } else if (!IsJsxOpeningFragment(node)) {
    const signaturesWithCorrectTypeArgumentArity = Filter(signatures, (sig: GoPtr<Signature>) =>
      Checker_hasCorrectTypeArgumentArity(receiver, sig, s!.typeArguments));
    if (signaturesWithCorrectTypeArgumentArity.length === 0) {
      Checker_addDiagnostic(receiver, Checker_getTypeArgumentArityError(receiver, s!.node, signatures, s!.typeArguments, headMessage));
    } else {
      Checker_addDiagnostic(receiver, Checker_getArgumentArityError(receiver, s!.node, signaturesWithCorrectTypeArgumentArity, s!.args, headMessage));
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getArgumentArityError","kind":"method","status":"implemented","sigHash":"9e7ce0219f8b08877783ae7a37fe95f4e5e7be8d5dc6f7b0b397f6a1b8469a09","bodyHash":"36e6c5b4c20539e0755113da7a5c81a0082a31f2b905e8ed9c7b54b2f91ad008"}
 *
 * Go source:
 * func (c *Checker) getArgumentArityError(node *ast.Node, signatures []*Signature, args []*ast.Node, headMessage *diagnostics.Message) *ast.Diagnostic {
 * 	spreadIndex := c.getSpreadArgumentIndex(args)
 * 	if spreadIndex > -1 {
 * 		return NewDiagnosticForNode(args[spreadIndex], diagnostics.A_spread_argument_must_either_have_a_tuple_type_or_be_passed_to_a_rest_parameter)
 * 	}
 * 	minCount := math.MaxInt // smallest parameter count
 * 	maxCount := math.MinInt // largest parameter count
 * 	maxBelow := math.MinInt // largest parameter count that is smaller than the number of arguments
 * 	minAbove := math.MaxInt // smallest parameter count that is larger than the number of arguments
 * 	var closestSignature *Signature
 * 	for _, sig := range signatures {
 * 		minParameter := c.getMinArgumentCount(sig)
 * 		maxParameter := c.getParameterCount(sig)
 * 		// smallest/largest parameter counts
 * 		if minParameter < minCount {
 * 			minCount = minParameter
 * 			closestSignature = sig
 * 		}
 * 		maxCount = max(maxCount, maxParameter)
 * 		// shortest parameter count *longer than the call* /longest parameter count *shorter than the call*
 * 		if minParameter < len(args) && minParameter > maxBelow {
 * 			maxBelow = minParameter
 * 		}
 * 		if len(args) < maxParameter && maxParameter < minAbove {
 * 			minAbove = maxParameter
 * 		}
 * 	}
 * 	hasRestParameter := core.Some(signatures, c.hasEffectiveRestParameter)
 * 	var parameterRange string
 * 	switch {
 * 	case hasRestParameter:
 * 		parameterRange = strconv.Itoa(minCount)
 * 	case minCount < maxCount:
 * 		parameterRange = strconv.Itoa(minCount) + "-" + strconv.Itoa(maxCount)
 * 	default:
 * 		parameterRange = strconv.Itoa(minCount)
 * 	}
 * 	isVoidPromiseError := !hasRestParameter && parameterRange == "1" && len(args) == 0 && c.isPromiseResolveArityError(node)
 * 	errorNode := getErrorNodeForCallNode(node)
 * 	if isVoidPromiseError && ast.IsInJSFile(node) {
 * 		return NewDiagnosticForNode(errorNode, diagnostics.Expected_1_argument_but_got_0_new_Promise_needs_a_JSDoc_hint_to_produce_a_resolve_that_can_be_called_without_arguments)
 * 	}
 * 	var message *diagnostics.Message
 * 	switch {
 * 	case ast.IsDecorator(node):
 * 		if hasRestParameter {
 * 			message = diagnostics.The_runtime_will_invoke_the_decorator_with_1_arguments_but_the_decorator_expects_at_least_0
 * 		} else {
 * 			message = diagnostics.The_runtime_will_invoke_the_decorator_with_1_arguments_but_the_decorator_expects_0
 * 		}
 * 	case hasRestParameter:
 * 		message = diagnostics.Expected_at_least_0_arguments_but_got_1
 * 	case isVoidPromiseError:
 * 		message = diagnostics.Expected_0_arguments_but_got_1_Did_you_forget_to_include_void_in_your_type_argument_to_Promise
 * 	default:
 * 		message = diagnostics.Expected_0_arguments_but_got_1
 * 	}
 * 	switch {
 * 	case minCount < len(args) && len(args) < maxCount:
 * 		// between min and max, but with no matching overload
 * 		diagnostic := NewDiagnosticForNode(errorNode, diagnostics.No_overload_expects_0_arguments_but_overloads_do_exist_that_expect_either_1_or_2_arguments, len(args), maxBelow, minAbove)
 * 		if headMessage != nil {
 * 			diagnostic = ast.NewDiagnosticChain(diagnostic, headMessage)
 * 		}
 * 		return diagnostic
 * 	case len(args) < minCount:
 * 		// too short: put the error span on the call expression, not any of the args
 * 		diagnostic := NewDiagnosticForNode(errorNode, message, parameterRange, len(args))
 * 		if headMessage != nil {
 * 			diagnostic = ast.NewDiagnosticChain(diagnostic, headMessage)
 * 		}
 * 		var parameter *ast.Node
 * 		if closestSignature != nil && closestSignature.declaration != nil {
 * 			parameter = core.ElementOrNil(closestSignature.declaration.Parameters(), len(args)+core.IfElse(closestSignature.thisParameter != nil, 1, 0))
 * 		}
 * 		if parameter != nil {
 * 			var related *ast.Diagnostic
 * 			switch {
 * 			case ast.IsBindingPattern(parameter.Name()):
 * 				related = NewDiagnosticForNode(parameter, diagnostics.An_argument_matching_this_binding_pattern_was_not_provided)
 * 			case isRestParameter(parameter):
 * 				related = NewDiagnosticForNode(parameter, diagnostics.Arguments_for_the_rest_parameter_0_were_not_provided, parameter.Name().Text())
 * 			default:
 * 				related = NewDiagnosticForNode(parameter, diagnostics.An_argument_for_0_was_not_provided, parameter.Name().Text())
 * 			}
 * 			diagnostic.AddRelatedInfo(related)
 * 		}
 * 		return diagnostic
 * 	default:
 * 		// Guard against out-of-bounds access when maxCount >= len(args).
 * 		// This can happen when we reach this fallback error path but the argument
 * 		// count actually matches the parameter count (e.g., due to trailing commas
 * 		// causing signature resolution to fail for other reasons).
 * 		if maxCount >= len(args) {
 * 			diagnostic := NewDiagnosticForNode(errorNode, message, parameterRange, len(args))
 * 			if headMessage != nil {
 * 				diagnostic = ast.NewDiagnosticChain(diagnostic, headMessage)
 * 			}
 * 			return diagnostic
 * 		}
 * 		sourceFile := ast.GetSourceFileOfNode(node)
 * 		pos := args[maxCount].Pos()
 * 		end := args[len(args)-1].End()
 * 		if end == pos {
 * 			end++
 * 		}
 * 		pos = scanner.SkipTrivia(sourceFile.Text(), pos)
 * 		if end < pos {
 * 			end = pos
 * 		}
 * 		diagnostic := ast.NewDiagnostic(sourceFile, core.NewTextRange(pos, end), message, parameterRange, len(args))
 * 		if headMessage != nil {
 * 			diagnostic = ast.NewDiagnosticChain(diagnostic, headMessage)
 * 		}
 * 		return diagnostic
 * 	}
 * }
 */
export function Checker_getArgumentArityError(receiver: GoPtr<Checker>, node: GoPtr<Node>, signatures: GoSlice<GoPtr<Signature>>, args: GoSlice<GoPtr<Node>>, headMessage: GoPtr<Message>): GoPtr<Diagnostic> {
  const spreadIndex = Checker_getSpreadArgumentIndex(receiver, args);
  if (spreadIndex > -1) {
    return NewDiagnosticForNode(args[spreadIndex], A_spread_argument_must_either_have_a_tuple_type_or_be_passed_to_a_rest_parameter);
  }
  let minCount = Number.MAX_SAFE_INTEGER; // smallest parameter count
  let maxCount = Number.MIN_SAFE_INTEGER; // largest parameter count
  let maxBelow = Number.MIN_SAFE_INTEGER; // largest parameter count that is smaller than the number of arguments
  let minAbove = Number.MAX_SAFE_INTEGER; // smallest parameter count that is larger than the number of arguments
  let closestSignature: GoPtr<Signature> = undefined;
  for (const sig of signatures) {
    const minParameter = Checker_getMinArgumentCount(receiver, sig);
    const maxParameter = Checker_getParameterCount(receiver, sig);
    if (minParameter < minCount) {
      minCount = minParameter;
      closestSignature = sig;
    }
    maxCount = Math.max(maxCount, maxParameter);
    if (minParameter < args.length && minParameter > maxBelow) {
      maxBelow = minParameter;
    }
    if (args.length < maxParameter && maxParameter < minAbove) {
      minAbove = maxParameter;
    }
  }
  const hasRestParameter = Some(signatures, (sig: GoPtr<Signature>) => Checker_hasEffectiveRestParameter(receiver, sig));
  let parameterRange: string;
  if (hasRestParameter) {
    parameterRange = String(minCount);
  } else if (minCount < maxCount) {
    parameterRange = String(minCount) + "-" + String(maxCount);
  } else {
    parameterRange = String(minCount);
  }
  const isVoidPromiseError = !hasRestParameter && parameterRange === "1" && args.length === 0 && Checker_isPromiseResolveArityError(receiver, node);
  const errorNode = getErrorNodeForCallNode(node);
  if (isVoidPromiseError && IsInJSFile(node)) {
    return NewDiagnosticForNode(errorNode, Expected_1_argument_but_got_0_new_Promise_needs_a_JSDoc_hint_to_produce_a_resolve_that_can_be_called_without_arguments);
  }
  let message: GoPtr<Message>;
  if (IsDecorator(node)) {
    if (hasRestParameter) {
      message = The_runtime_will_invoke_the_decorator_with_1_arguments_but_the_decorator_expects_at_least_0;
    } else {
      message = The_runtime_will_invoke_the_decorator_with_1_arguments_but_the_decorator_expects_0;
    }
  } else if (hasRestParameter) {
    message = Expected_at_least_0_arguments_but_got_1;
  } else if (isVoidPromiseError) {
    message = Expected_0_arguments_but_got_1_Did_you_forget_to_include_void_in_your_type_argument_to_Promise;
  } else {
    message = Expected_0_arguments_but_got_1;
  }
  if (minCount < args.length && args.length < maxCount) {
    // between min and max, but with no matching overload
    let diagnostic: GoPtr<Diagnostic> = NewDiagnosticForNode(errorNode, No_overload_expects_0_arguments_but_overloads_do_exist_that_expect_either_1_or_2_arguments, args.length, maxBelow, minAbove);
    if (headMessage !== undefined) {
      diagnostic = NewDiagnosticChain(diagnostic, headMessage);
    }
    return diagnostic;
  } else if (args.length < minCount) {
    // too short: put the error span on the call expression, not any of the args
    let diagnostic: GoPtr<Diagnostic> = NewDiagnosticForNode(errorNode, message, parameterRange, args.length);
    if (headMessage !== undefined) {
      diagnostic = NewDiagnosticChain(diagnostic, headMessage);
    }
    let parameter: GoPtr<Node> = undefined;
    if (closestSignature !== undefined && closestSignature!.declaration !== undefined) {
      parameter = ElementOrNil(Node_Parameters(closestSignature!.declaration) as unknown as GoSlice<GoPtr<Node>>, args.length + IfElse(closestSignature!.thisParameter !== undefined, 1, 0));
    }
    if (parameter !== undefined) {
      let related: GoPtr<Diagnostic>;
      if (IsBindingPattern(Node_Name(parameter))) {
        related = NewDiagnosticForNode(parameter, An_argument_matching_this_binding_pattern_was_not_provided);
      } else if (isRestParameter(parameter)) {
        related = NewDiagnosticForNode(parameter, Arguments_for_the_rest_parameter_0_were_not_provided, Node_Text(Node_Name(parameter)));
      } else {
        related = NewDiagnosticForNode(parameter, An_argument_for_0_was_not_provided, Node_Text(Node_Name(parameter)));
      }
      Diagnostic_AddRelatedInfo(diagnostic, related);
    }
    return diagnostic;
  } else {
    // Guard against out-of-bounds access when maxCount >= len(args).
    if (maxCount >= args.length) {
      let diagnostic: GoPtr<Diagnostic> = NewDiagnosticForNode(errorNode, message, parameterRange, args.length);
      if (headMessage !== undefined) {
        diagnostic = NewDiagnosticChain(diagnostic, headMessage);
      }
      return diagnostic;
    }
    const sourceFile = GetSourceFileOfNode(node);
    let pos = Node_Pos(args[maxCount]);
    let end = Node_End(args[args.length - 1]);
    if (end === pos) {
      end++;
    }
    pos = SkipTrivia(SourceFile_Text(sourceFile), pos);
    if (end < pos) {
      end = pos;
    }
    let diagnostic: GoPtr<Diagnostic> = NewDiagnostic(sourceFile, NewTextRange(pos, end), message, parameterRange, args.length);
    if (headMessage !== undefined) {
      diagnostic = NewDiagnosticChain(diagnostic, headMessage);
    }
    return diagnostic;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isPromiseResolveArityError","kind":"method","status":"implemented","sigHash":"6d743e33fe3005bb100daeb3071cc0dcff68ffb11de2c6a22906eb0d535157ff","bodyHash":"4393e729eb4bd8f2f733e732c2fa9934ae74891e0d04a30d2f07828ab04d5337"}
 *
 * Go source:
 * func (c *Checker) isPromiseResolveArityError(node *ast.Node) bool {
 * 	if !ast.IsCallExpression(node) || !ast.IsIdentifier(node.Expression()) {
 * 		return false
 * 	}
 * 	symbol := c.resolveName(node.Expression(), node.Expression().Text(), ast.SymbolFlagsValue, nil /*nameNotFoundMessage* /, false /*isUse* /, false)
 * 	if symbol == nil {
 * 		return false
 * 	}
 * 	decl := symbol.ValueDeclaration
 * 	if decl == nil || !ast.IsParameterDeclaration(decl) || !ast.IsFunctionExpressionOrArrowFunction(decl.Parent) || !ast.IsNewExpression(decl.Parent.Parent) || !ast.IsIdentifier(decl.Parent.Parent.Expression()) {
 * 		return false
 * 	}
 * 	globalPromiseSymbol := c.getGlobalPromiseConstructorSymbolOrNil()
 * 	if globalPromiseSymbol == nil {
 * 		return false
 * 	}
 * 	constructorSymbol := c.getResolvedSymbol(decl.Parent.Parent.Expression())
 * 	return constructorSymbol == globalPromiseSymbol
 * }
 */
export function Checker_isPromiseResolveArityError(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const c = receiver!;
  if (!IsCallExpression(node) || !IsIdentifier(Node_Expression(node))) {
    return false;
  }
  const symbol = c.resolveName(Node_Expression(node), Node_Text(Node_Expression(node)), SymbolFlagsValue, undefined, false as bool, false as bool);
  if (symbol === undefined) {
    return false;
  }
  const decl = symbol!.ValueDeclaration;
  const parent = decl?.Parent;
  const grandParent = parent?.Parent;
  if (decl === undefined || !IsParameterDeclaration(decl) || !IsFunctionExpressionOrArrowFunction(parent) || !IsNewExpression(grandParent) || !IsIdentifier(Node_Expression(grandParent))) {
    return false;
  }
  const globalPromiseSymbol = c.getGlobalPromiseConstructorSymbolOrNil();
  if (globalPromiseSymbol === undefined) {
    return false;
  }
  const constructorSymbol = Checker_getResolvedSymbol(receiver, Node_Expression(grandParent));
  return constructorSymbol === globalPromiseSymbol;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeArgumentArityError","kind":"method","status":"implemented","sigHash":"e6f97bff36671ddbf59493318bf96ce82364671b370d8dc4300eb5c58f26924d","bodyHash":"272027267ce34d415d730aa6843b371bc04178ee140eacd516edcdd5f1f64998"}
 *
 * Go source:
 * func (c *Checker) getTypeArgumentArityError(node *ast.Node, signatures []*Signature, typeArguments []*ast.Node, headMessage *diagnostics.Message) *ast.Diagnostic {
 * 	var diagnostic *ast.Diagnostic
 * 	argCount := len(typeArguments)
 * 	sourceFile := ast.GetSourceFileOfNode(node)
 * 	typeArgumentList := node.TypeArgumentList()
 * 	loc := core.NewTextRange(scanner.SkipTrivia(sourceFile.Text(), typeArgumentList.Loc.Pos()), typeArgumentList.Loc.End())
 * 	if len(signatures) == 1 {
 * 		// No overloads exist
 * 		sig := signatures[0]
 * 		minCount := c.getMinTypeArgumentCount(sig.typeParameters)
 * 		maxCount := len(sig.typeParameters)
 * 		expected := strconv.Itoa(minCount)
 * 		if minCount < maxCount {
 * 			expected = expected + "-" + strconv.Itoa(maxCount)
 * 		}
 * 		diagnostic = ast.NewDiagnostic(sourceFile, loc, diagnostics.Expected_0_type_arguments_but_got_1, expected, argCount)
 * 	} else {
 * 		// Overloads exist
 * 		belowArgCount := math.MinInt
 * 		aboveArgCount := math.MaxInt
 * 		for _, sig := range signatures {
 * 			minCount := c.getMinTypeArgumentCount(sig.typeParameters)
 * 			maxCount := len(sig.typeParameters)
 * 			if minCount > argCount {
 * 				aboveArgCount = min(aboveArgCount, minCount)
 * 			} else if maxCount < argCount {
 * 				belowArgCount = max(belowArgCount, maxCount)
 * 			}
 * 		}
 * 		if belowArgCount != math.MinInt && aboveArgCount != math.MaxInt {
 * 			diagnostic = ast.NewDiagnostic(sourceFile, loc, diagnostics.No_overload_expects_0_type_arguments_but_overloads_do_exist_that_expect_either_1_or_2_type_arguments, argCount, belowArgCount, aboveArgCount)
 * 		} else {
 * 			diagnostic = ast.NewDiagnostic(sourceFile, loc, diagnostics.Expected_0_type_arguments_but_got_1, core.IfElse(belowArgCount == math.MinInt, aboveArgCount, belowArgCount), argCount)
 * 		}
 * 	}
 * 	if headMessage != nil {
 * 		diagnostic = ast.NewDiagnosticChain(diagnostic, headMessage)
 * 	}
 * 	return diagnostic
 * }
 */
export function Checker_getTypeArgumentArityError(receiver: GoPtr<Checker>, node: GoPtr<Node>, signatures: GoSlice<GoPtr<Signature>>, typeArguments: GoSlice<GoPtr<Node>>, headMessage: GoPtr<Message>): GoPtr<Diagnostic> {
  let diagnostic: GoPtr<Diagnostic> = undefined;
  const argCount = typeArguments.length;
  const sourceFile = GetSourceFileOfNode(node);
  const typeArgumentList = Node_TypeArgumentList(node);
  const loc = NewTextRange(SkipTrivia(SourceFile_Text(sourceFile), TextRange_Pos(typeArgumentList!.Loc)), TextRange_End(typeArgumentList!.Loc));
  if (signatures.length === 1) {
    // No overloads exist
    const sig = signatures[0];
    const minCount = Checker_getMinTypeArgumentCount(receiver, sig!.typeParameters ?? []);
    const maxCount = sig!.typeParameters === undefined ? 0 : sig!.typeParameters.length;
    let expected = String(minCount);
    if (minCount < maxCount) {
      expected = expected + "-" + String(maxCount);
    }
    diagnostic = NewDiagnostic(sourceFile, loc, Expected_0_type_arguments_but_got_1, expected, argCount);
  } else {
    // Overloads exist
    let belowArgCount = Number.MIN_SAFE_INTEGER;
    let aboveArgCount = Number.MAX_SAFE_INTEGER;
    for (const sig of signatures) {
      const minCount = Checker_getMinTypeArgumentCount(receiver, sig!.typeParameters ?? []);
      const maxCount = sig!.typeParameters === undefined ? 0 : sig!.typeParameters.length;
      if (minCount > argCount) {
        aboveArgCount = Math.min(aboveArgCount, minCount);
      } else if (maxCount < argCount) {
        belowArgCount = Math.max(belowArgCount, maxCount);
      }
    }
    if (belowArgCount !== Number.MIN_SAFE_INTEGER && aboveArgCount !== Number.MAX_SAFE_INTEGER) {
      diagnostic = NewDiagnostic(sourceFile, loc, No_overload_expects_0_type_arguments_but_overloads_do_exist_that_expect_either_1_or_2_type_arguments, argCount, belowArgCount, aboveArgCount);
    } else {
      diagnostic = NewDiagnostic(sourceFile, loc, Expected_0_type_arguments_but_got_1, IfElse(belowArgCount === Number.MIN_SAFE_INTEGER, aboveArgCount, belowArgCount), argCount);
    }
  }
  if (headMessage !== undefined) {
    diagnostic = NewDiagnosticChain(diagnostic, headMessage);
  }
  return diagnostic;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportCannotInvokePossiblyNullOrUndefinedError","kind":"method","status":"implemented","sigHash":"f61c3fb48bd425a9195ac1530c6b60d2bcaa7203fbc537b619e722c4ba31d639","bodyHash":"c5bc6e5e75ede5e2b560c291612a39e4ee924100aaf5abe7ff43d8f1223ce0d6"}
 *
 * Go source:
 * func (c *Checker) reportCannotInvokePossiblyNullOrUndefinedError(node *ast.Node, facts TypeFacts) {
 * 	c.error(node, core.IfElse(facts&TypeFactsIsUndefined != 0,
 * 		core.IfElse(facts&TypeFactsIsNull != 0,
 * 			diagnostics.Cannot_invoke_an_object_which_is_possibly_null_or_undefined,
 * 			diagnostics.Cannot_invoke_an_object_which_is_possibly_undefined),
 * 		diagnostics.Cannot_invoke_an_object_which_is_possibly_null))
 * }
 */
export function Checker_reportCannotInvokePossiblyNullOrUndefinedError(receiver: GoPtr<Checker>, node: GoPtr<Node>, facts: TypeFacts): void {
  Checker_error(receiver, node, IfElse((facts & TypeFactsIsUndefined) !== 0,
    IfElse((facts & TypeFactsIsNull) !== 0,
      Cannot_invoke_an_object_which_is_possibly_null_or_undefined,
      Cannot_invoke_an_object_which_is_possibly_undefined),
    Cannot_invoke_an_object_which_is_possibly_null));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveErrorCall","kind":"method","status":"implemented","sigHash":"dedaeb289deb864b8e3babca1046d72be978d2b689f931b473d5015f31f5ea9b","bodyHash":"19157ce534c80d3694cc276eb280e77f41312491fa3b874f891f87ea9b468805"}
 *
 * Go source:
 * func (c *Checker) resolveErrorCall(node *ast.Node) *Signature {
 * 	c.resolveUntypedCall(node)
 * 	return c.unknownSignature
 * }
 */
export function Checker_resolveErrorCall(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Signature> {
  const c = receiver!;
  Checker_resolveUntypedCall(receiver, node);
  return c.unknownSignature;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.invocationErrorDetails","kind":"method","status":"implemented","sigHash":"e14bdbd2367a35c1e0a6a8e0a77018ec595c0dc4182b927b4f94904e034e6d32","bodyHash":"fefc7dcc6be3ddfb689d0b6b5536543216623bcd6c3604d8454b38b67dbac654"}
 *
 * Go source:
 * func (c *Checker) invocationErrorDetails(errorTarget *ast.Node, apparentType *Type, kind SignatureKind) *ast.Diagnostic {
 * 	var diagnostic *ast.Diagnostic
 * 	isCall := kind == SignatureKindCall
 * 	awaitedType := c.getAwaitedType(apparentType)
 * 	maybeMissingAwait := awaitedType != nil && len(c.getSignaturesOfType(awaitedType, kind)) > 0
 * 	target := errorTarget
 * 	if ast.IsPropertyAccessExpression(errorTarget) && ast.IsCallExpression(errorTarget.Parent) {
 * 		target = errorTarget.Name()
 * 	}
 * 	if apparentType.flags&TypeFlagsUnion != 0 {
 * 		types := apparentType.Types()
 * 		hasSignatures := false
 * 		for _, constituent := range types {
 * 			signatures := c.getSignaturesOfType(constituent, kind)
 * 			if len(signatures) != 0 {
 * 				hasSignatures = true
 * 				if diagnostic != nil {
 * 					// Bail early if we already have an error, no chance of "No constituent of type is callable"
 * 					break
 * 				}
 * 			} else {
 * 				// Error on the first non callable constituent only
 * 				if diagnostic == nil {
 * 					diagnostic = NewDiagnosticForNode(target, core.IfElse(isCall, diagnostics.Type_0_has_no_call_signatures, diagnostics.Type_0_has_no_construct_signatures), c.TypeToString(constituent))
 * 					diagnostic = NewDiagnosticChainForNode(diagnostic, target, core.IfElse(isCall, diagnostics.Not_all_constituents_of_type_0_are_callable, diagnostics.Not_all_constituents_of_type_0_are_constructable), c.TypeToString(apparentType))
 * 				}
 * 				if hasSignatures {
 * 					// Bail early if we already found a signature, no chance of "No constituent of type is callable"
 * 					break
 * 				}
 * 			}
 * 		}
 * 		if !hasSignatures {
 * 			diagnostic = NewDiagnosticForNode(target, core.IfElse(isCall, diagnostics.No_constituent_of_type_0_is_callable, diagnostics.No_constituent_of_type_0_is_constructable), c.TypeToString(apparentType))
 * 		}
 * 		if diagnostic == nil {
 * 			diagnostic = NewDiagnosticForNode(target, core.IfElse(isCall, diagnostics.Each_member_of_the_union_type_0_has_signatures_but_none_of_those_signatures_are_compatible_with_each_other, diagnostics.Each_member_of_the_union_type_0_has_construct_signatures_but_none_of_those_signatures_are_compatible_with_each_other), c.TypeToString(apparentType))
 * 		}
 * 	} else {
 * 		diagnostic = NewDiagnosticChainForNode(diagnostic, target, core.IfElse(isCall, diagnostics.Type_0_has_no_call_signatures, diagnostics.Type_0_has_no_construct_signatures), c.TypeToString(apparentType))
 * 	}
 * 	headMessage := core.IfElse(isCall, diagnostics.This_expression_is_not_callable, diagnostics.This_expression_is_not_constructable)
 * 	// Diagnose get accessors incorrectly called as functions
 * 	if ast.IsCallExpression(errorTarget.Parent) && len(errorTarget.Parent.Arguments()) == 0 {
 * 		resolvedSymbol := c.getResolvedSymbolOrNil(errorTarget)
 * 		if resolvedSymbol != nil && resolvedSymbol.Flags&ast.SymbolFlagsGetAccessor != 0 {
 * 			headMessage = diagnostics.This_expression_is_not_callable_because_it_is_a_get_accessor_Did_you_mean_to_use_it_without
 * 		}
 * 	}
 * 	diagnostic = NewDiagnosticChainForNode(diagnostic, target, headMessage)
 * 	if maybeMissingAwait {
 * 		diagnostic.AddRelatedInfo(NewDiagnosticForNode(errorTarget, diagnostics.Did_you_forget_to_use_await))
 * 	}
 * 	return diagnostic
 * }
 */
export function Checker_invocationErrorDetails(receiver: GoPtr<Checker>, errorTarget: GoPtr<Node>, apparentType: GoPtr<Type>, kind: SignatureKind): GoPtr<Diagnostic> {
  let diagnostic: GoPtr<Diagnostic> = undefined;
  const isCall = kind === SignatureKindCall;
  const awaitedType = Checker_getAwaitedType(receiver, apparentType);
  const maybeMissingAwait = awaitedType !== undefined && Checker_getSignaturesOfType(receiver, awaitedType, kind).length > 0;
  let target = errorTarget;
  if (IsPropertyAccessExpression(errorTarget) && IsCallExpression(errorTarget!.Parent)) {
    target = Node_Name(errorTarget);
  }
  if ((apparentType!.flags & TypeFlagsUnion) !== 0) {
    const types = Type_Types(apparentType);
    let hasSignatures = false as bool;
    for (const constituent of types) {
      const signatures = Checker_getSignaturesOfType(receiver, constituent, kind);
      if (signatures.length !== 0) {
        hasSignatures = true as bool;
        if (diagnostic !== undefined) {
          break;
        }
      } else {
        if (diagnostic === undefined) {
          diagnostic = NewDiagnosticForNode(
            target,
            IfElse(isCall, Type_0_has_no_call_signatures, Type_0_has_no_construct_signatures),
            Checker_TypeToString(receiver, constituent),
          );
          diagnostic = NewDiagnosticChainForNode(
            diagnostic,
            target,
            IfElse(isCall, Not_all_constituents_of_type_0_are_callable, Not_all_constituents_of_type_0_are_constructable),
            Checker_TypeToString(receiver, apparentType),
          );
        }
        if (hasSignatures) {
          break;
        }
      }
    }
    if (!hasSignatures) {
      diagnostic = NewDiagnosticForNode(
        target,
        IfElse(isCall, No_constituent_of_type_0_is_callable, No_constituent_of_type_0_is_constructable),
        Checker_TypeToString(receiver, apparentType),
      );
    }
    if (diagnostic === undefined) {
      diagnostic = NewDiagnosticForNode(
        target,
        IfElse(
          isCall,
          Each_member_of_the_union_type_0_has_signatures_but_none_of_those_signatures_are_compatible_with_each_other,
          Each_member_of_the_union_type_0_has_construct_signatures_but_none_of_those_signatures_are_compatible_with_each_other,
        ),
        Checker_TypeToString(receiver, apparentType),
      );
    }
  } else {
    diagnostic = NewDiagnosticChainForNode(
      diagnostic,
      target,
      IfElse(isCall, Type_0_has_no_call_signatures, Type_0_has_no_construct_signatures),
      Checker_TypeToString(receiver, apparentType),
    );
  }
  let headMessage = IfElse(isCall, This_expression_is_not_callable, This_expression_is_not_constructable);
  if (IsCallExpression(errorTarget!.Parent) && (Node_Arguments(errorTarget!.Parent)?.length ?? 0) === 0) {
    const resolvedSymbol = Checker_getResolvedSymbolOrNil(receiver, errorTarget);
    if (resolvedSymbol !== undefined && (resolvedSymbol!.Flags & SymbolFlagsGetAccessor) !== 0) {
      headMessage = This_expression_is_not_callable_because_it_is_a_get_accessor_Did_you_mean_to_use_it_without;
    }
  }
  diagnostic = NewDiagnosticChainForNode(diagnostic, target, headMessage);
  if (maybeMissingAwait) {
    Diagnostic_AddRelatedInfo(diagnostic, NewDiagnosticForNode(errorTarget, Did_you_forget_to_use_await));
  }
  return diagnostic;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.invocationError","kind":"method","status":"implemented","sigHash":"a45a023459755f491899dc36253bce0dc97596689e0f617740fcbd053cc81577","bodyHash":"a187caddba84169f93050068f31d8ddd6240d7f9521d99e9259436acdb17ebfc"}
 *
 * Go source:
 * func (c *Checker) invocationError(errorTarget *ast.Node, apparentType *Type, kind SignatureKind, relatedInformation *ast.Diagnostic) {
 * 	diagnostic := c.invocationErrorDetails(errorTarget, apparentType, kind)
 * 	if relatedInformation != nil {
 * 		diagnostic.AddRelatedInfo(relatedInformation)
 * 	}
 * 	c.addDiagnostic(diagnostic)
 * 	c.invocationErrorRecovery(apparentType, kind, diagnostic)
 * }
 */
export function Checker_invocationError(receiver: GoPtr<Checker>, errorTarget: GoPtr<Node>, apparentType: GoPtr<Type>, kind: SignatureKind, relatedInformation: GoPtr<Diagnostic>): void {
  const diagnostic = Checker_invocationErrorDetails(receiver, errorTarget, apparentType, kind);
  if (relatedInformation !== undefined) {
    Diagnostic_AddRelatedInfo(diagnostic, relatedInformation);
  }
  Checker_addDiagnostic(receiver, diagnostic);
  Checker_invocationErrorRecovery(receiver, apparentType, kind, diagnostic);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.invocationErrorRecovery","kind":"method","status":"implemented","sigHash":"8b4159b53e315d99bd66e2967c6a36346d8a6de37e36fc6a3614f0aba6849d3c","bodyHash":"89c4bf6b0a2ae158c0f40ded94924ef45901d4222a7179b682e0d95dc052ddc3"}
 *
 * Go source:
 * func (c *Checker) invocationErrorRecovery(apparentType *Type, kind SignatureKind, diagnostic *ast.Diagnostic) {
 * 	if apparentType.symbol == nil {
 * 		return
 * 	}
 * 	importNode := c.exportTypeLinks.Get(apparentType.symbol).originatingImport
 * 	// Create a diagnostic on the originating import if possible onto which we can attach a quickfix
 * 	//  An import call expression cannot be rewritten into another form to correct the error - the only solution is to use `.default` at the use-site
 * 	if importNode != nil && !ast.IsImportCall(importNode) {
 * 		sigs := c.getSignaturesOfType(c.getTypeOfSymbol(c.exportTypeLinks.Get(apparentType.symbol).target), kind)
 * 		if len(sigs) == 0 {
 * 			return
 * 		}
 * 		diagnostic.AddRelatedInfo(NewDiagnosticForNode(importNode, diagnostics.Type_originates_at_this_import_A_namespace_style_import_cannot_be_called_or_constructed_and_will_cause_a_failure_at_runtime_Consider_using_a_default_import_or_import_require_here_instead))
 * 	}
 * }
 */
export function Checker_invocationErrorRecovery(receiver: GoPtr<Checker>, apparentType: GoPtr<Type>, kind: SignatureKind, diagnostic: GoPtr<Diagnostic>): void {
  if (apparentType!.symbol === undefined) {
    return;
  }
  const links = LinkStore_Get(receiver!.exportTypeLinks as unknown as GoPtr<LinkStore<GoPtr<Symbol>, ExportTypeLinks>>, apparentType!.symbol);
  const importNode = links!.originatingImport;
  if (importNode !== undefined && !IsImportCall(importNode)) {
    const sigs = Checker_getSignaturesOfType(receiver, Checker_getTypeOfSymbol(receiver, links!.target), kind);
    if (sigs.length === 0) {
      return;
    }
    Diagnostic_AddRelatedInfo(
      diagnostic,
      NewDiagnosticForNode(importNode, Type_originates_at_this_import_A_namespace_style_import_cannot_be_called_or_constructed_and_will_cause_a_failure_at_runtime_Consider_using_a_default_import_or_import_require_here_instead),
    );
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAndReportErrorForExtendingInterface","kind":"method","status":"implemented","sigHash":"ae66925e8598966cd73fcc9b88e1a96461cdb1f144af00189f40ab419776f0ac","bodyHash":"3348decdb8179b73388d170c45fd5694c7ee6f8879c3c536e257be758993fefd"}
 *
 * Go source:
 * func (c *Checker) checkAndReportErrorForExtendingInterface(errorLocation *ast.Node) bool {
 * 	expression := c.getEntityNameForExtendingInterface(errorLocation)
 * 	if expression != nil && c.resolveEntityName(expression, ast.SymbolFlagsInterface, true /*ignoreErrors* /, false, nil) != nil {
 * 		c.error(errorLocation, diagnostics.Cannot_extend_an_interface_0_Did_you_mean_implements, scanner.GetTextOfNode(expression))
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Checker_checkAndReportErrorForExtendingInterface(receiver: GoPtr<Checker>, errorLocation: GoPtr<Node>): bool {
  const expression = Checker_getEntityNameForExtendingInterface(receiver, errorLocation);
  if (expression !== undefined && Checker_resolveEntityName(receiver, expression, SymbolFlagsInterface, true, false, undefined) !== undefined) {
    Checker_error(receiver, errorLocation, Cannot_extend_an_interface_0_Did_you_mean_implements, GetTextOfNode(expression));
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportOperatorError","kind":"method","status":"implemented","sigHash":"a7c7c1b0211997659807933f04fa406aa32278ecf2cb096bbbf9497de5683c6b","bodyHash":"024af0855171af1ceae383f977b1e4a9bb989d55792d01913c7dc81353077d13"}
 *
 * Go source:
 * func (c *Checker) reportOperatorError(leftType *Type, operator ast.Kind, rightType *Type, errorNode *ast.Node, isRelated func(left *Type, right *Type) bool) {
 * 	wouldWorkWithAwait := false
 * 	if isRelated != nil {
 * 		awaitedLeftType := c.getAwaitedTypeNoAlias(leftType)
 * 		awaitedRightType := c.getAwaitedTypeNoAlias(rightType)
 * 		wouldWorkWithAwait = !(awaitedLeftType == leftType && awaitedRightType == rightType) && awaitedLeftType != nil && awaitedRightType != nil && isRelated(awaitedLeftType, awaitedRightType)
 * 	}
 * 	effectiveLeft := leftType
 * 	effectiveRight := rightType
 * 	if !wouldWorkWithAwait && isRelated != nil {
 * 		effectiveLeft, effectiveRight = c.getBaseTypesIfUnrelated(leftType, rightType, isRelated)
 * 	}
 * 	leftStr, rightStr := c.getTypeNamesForErrorDisplay(effectiveLeft, effectiveRight)
 * 	switch operator {
 * 	case ast.KindEqualsEqualsEqualsToken, ast.KindEqualsEqualsToken, ast.KindExclamationEqualsEqualsToken, ast.KindExclamationEqualsToken:
 * 		c.errorAndMaybeSuggestAwait(errorNode, wouldWorkWithAwait, diagnostics.This_comparison_appears_to_be_unintentional_because_the_types_0_and_1_have_no_overlap, leftStr, rightStr)
 * 	default:
 * 		c.errorAndMaybeSuggestAwait(errorNode, wouldWorkWithAwait, diagnostics.Operator_0_cannot_be_applied_to_types_1_and_2, scanner.TokenToString(operator), leftStr, rightStr)
 * 	}
 * }
 */
export function Checker_reportOperatorError(receiver: GoPtr<Checker>, leftType: GoPtr<Type>, operator: Kind, rightType: GoPtr<Type>, errorNode: GoPtr<Node>, isRelated: ((left: GoPtr<Type>, right: GoPtr<Type>) => bool) | undefined): void {
  let wouldWorkWithAwait = false;
  if (isRelated !== undefined) {
    const awaitedLeftType = Checker_getAwaitedTypeNoAlias(receiver, leftType);
    const awaitedRightType = Checker_getAwaitedTypeNoAlias(receiver, rightType);
    wouldWorkWithAwait = !((awaitedLeftType === leftType) && (awaitedRightType === rightType)) && awaitedLeftType !== undefined && awaitedRightType !== undefined && isRelated(awaitedLeftType, awaitedRightType);
  }
  let effectiveLeft = leftType;
  let effectiveRight = rightType;
  if (!wouldWorkWithAwait && isRelated !== undefined) {
    [effectiveLeft, effectiveRight] = Checker_getBaseTypesIfUnrelated(receiver, leftType, rightType, isRelated);
  }
  const [leftStr, rightStr] = Checker_getTypeNamesForErrorDisplay(receiver, effectiveLeft, effectiveRight);
  switch (operator) {
    case KindEqualsEqualsEqualsToken:
    case KindEqualsEqualsToken:
    case KindExclamationEqualsEqualsToken:
    case KindExclamationEqualsToken:
      Checker_errorAndMaybeSuggestAwait(receiver, errorNode, wouldWorkWithAwait, This_comparison_appears_to_be_unintentional_because_the_types_0_and_1_have_no_overlap, leftStr, rightStr);
      break;
    default:
      Checker_errorAndMaybeSuggestAwait(receiver, errorNode, wouldWorkWithAwait, Operator_0_cannot_be_applied_to_types_1_and_2, TokenToString(operator), leftStr, rightStr);
      break;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportOperatorErrorUnless","kind":"method","status":"implemented","sigHash":"8c3c5e34688c02cfacd2f52a07518cfd4dbbdf3193f27ca0047204b5a61152b9","bodyHash":"8782b24ddbb3a6ce1a8625c43e9e8229716d8bcf9399b4c04f1ba2f9882fb9dd"}
 *
 * Go source:
 * func (c *Checker) reportOperatorErrorUnless(leftType *Type, operator ast.Kind, rightType *Type, errorNode *ast.Node, typesAreCompatible func(left *Type, right *Type) bool) {
 * 	if !typesAreCompatible(leftType, rightType) {
 * 		c.reportOperatorError(leftType, operator, rightType, errorNode, typesAreCompatible)
 * 	}
 * }
 */
export function Checker_reportOperatorErrorUnless(receiver: GoPtr<Checker>, leftType: GoPtr<Type>, operator: Kind, rightType: GoPtr<Type>, errorNode: GoPtr<Node>, typesAreCompatible: (left: GoPtr<Type>, right: GoPtr<Type>) => bool): void {
  if (!typesAreCompatible(leftType, rightType)) {
    Checker_reportOperatorError(receiver, leftType, operator, rightType, errorNode, typesAreCompatible);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getCannotFindNameDiagnosticForName","kind":"method","status":"implemented","sigHash":"eae200ae7bc29b80af238f3d99c950b786747542f17abe9f4790b681b54567a3","bodyHash":"b418c0e3691f846812ff9795a38a7967539a8d00aea242ac5f1cb63cd8eae003"}
 *
 * Go source:
 * func (c *Checker) getCannotFindNameDiagnosticForName(node *ast.Node) *diagnostics.Message {
 * 	switch node.Text() {
 * 	case "document", "console":
 * 		return diagnostics.Cannot_find_name_0_Do_you_need_to_change_your_target_library_Try_changing_the_lib_compiler_option_to_include_dom
 * 	case "$":
 * 		return core.IfElse(c.compilerOptions.UsesWildcardTypes(),
 * 			diagnostics.Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_jQuery_Try_npm_i_save_dev_types_Slashjquery,
 * 			diagnostics.Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_jQuery_Try_npm_i_save_dev_types_Slashjquery_and_then_add_jquery_to_the_types_field_in_your_tsconfig)
 * 	case "beforeEach", "describe", "suite", "it", "test":
 * 		return core.IfElse(c.compilerOptions.UsesWildcardTypes(),
 * 			diagnostics.Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_a_test_runner_Try_npm_i_save_dev_types_Slashjest_or_npm_i_save_dev_types_Slashmocha,
 * 			diagnostics.Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_a_test_runner_Try_npm_i_save_dev_types_Slashjest_or_npm_i_save_dev_types_Slashmocha_and_then_add_jest_or_mocha_to_the_types_field_in_your_tsconfig)
 * 	case "process", "require", "Buffer", "module", "NodeJS":
 * 		return core.IfElse(c.compilerOptions.UsesWildcardTypes(),
 * 			diagnostics.Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_node_Try_npm_i_save_dev_types_Slashnode,
 * 			diagnostics.Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_node_Try_npm_i_save_dev_types_Slashnode_and_then_add_node_to_the_types_field_in_your_tsconfig)
 * 	case "Bun":
 * 		return core.IfElse(c.compilerOptions.UsesWildcardTypes(),
 * 			diagnostics.Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_Bun_Try_npm_i_save_dev_types_Slashbun,
 * 			diagnostics.Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_Bun_Try_npm_i_save_dev_types_Slashbun_and_then_add_bun_to_the_types_field_in_your_tsconfig)
 * 	case "Map", "Set", "Promise", "ast.Symbol", "WeakMap", "WeakSet", "Iterator", "AsyncIterator", "SharedArrayBuffer", "Atomics", "AsyncIterable",
 * 		"AsyncIterableIterator", "AsyncGenerator", "AsyncGeneratorFunction", "BigInt", "Reflect", "BigInt64Array", "BigUint64Array":
 * 		return diagnostics.Cannot_find_name_0_Do_you_need_to_change_your_target_library_Try_changing_the_lib_compiler_option_to_1_or_later
 * 	case "await":
 * 		if ast.IsCallExpression(node.Parent) {
 * 			return diagnostics.Cannot_find_name_0_Did_you_mean_to_write_this_in_an_async_function
 * 		}
 * 		fallthrough
 * 	default:
 * 		if node.Parent.Kind == ast.KindShorthandPropertyAssignment {
 * 			return diagnostics.No_value_exists_in_scope_for_the_shorthand_property_0_Either_declare_one_or_provide_an_initializer
 * 		}
 * 		return diagnostics.Cannot_find_name_0
 * 	}
 * }
 */
export function Checker_getCannotFindNameDiagnosticForName(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Message> {
  const c = receiver!;
  switch (Node_Text(node)) {
    case "document":
    case "console":
      return Cannot_find_name_0_Do_you_need_to_change_your_target_library_Try_changing_the_lib_compiler_option_to_include_dom;
    case "$":
      return IfElse(
        CompilerOptions_UsesWildcardTypes(c.compilerOptions),
        Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_jQuery_Try_npm_i_save_dev_types_Slashjquery,
        Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_jQuery_Try_npm_i_save_dev_types_Slashjquery_and_then_add_jquery_to_the_types_field_in_your_tsconfig,
      );
    case "beforeEach":
    case "describe":
    case "suite":
    case "it":
    case "test":
      return IfElse(
        CompilerOptions_UsesWildcardTypes(c.compilerOptions),
        Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_a_test_runner_Try_npm_i_save_dev_types_Slashjest_or_npm_i_save_dev_types_Slashmocha,
        Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_a_test_runner_Try_npm_i_save_dev_types_Slashjest_or_npm_i_save_dev_types_Slashmocha_and_then_add_jest_or_mocha_to_the_types_field_in_your_tsconfig,
      );
    case "process":
    case "require":
    case "Buffer":
    case "module":
    case "NodeJS":
      return IfElse(
        CompilerOptions_UsesWildcardTypes(c.compilerOptions),
        Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_node_Try_npm_i_save_dev_types_Slashnode,
        Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_node_Try_npm_i_save_dev_types_Slashnode_and_then_add_node_to_the_types_field_in_your_tsconfig,
      );
    case "Bun":
      return IfElse(
        CompilerOptions_UsesWildcardTypes(c.compilerOptions),
        Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_Bun_Try_npm_i_save_dev_types_Slashbun,
        Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_Bun_Try_npm_i_save_dev_types_Slashbun_and_then_add_bun_to_the_types_field_in_your_tsconfig,
      );
    case "Map":
    case "Set":
    case "Promise":
    case "ast.Symbol":
    case "WeakMap":
    case "WeakSet":
    case "Iterator":
    case "AsyncIterator":
    case "SharedArrayBuffer":
    case "Atomics":
    case "AsyncIterable":
    case "AsyncIterableIterator":
    case "AsyncGenerator":
    case "AsyncGeneratorFunction":
    case "BigInt":
    case "Reflect":
    case "BigInt64Array":
    case "BigUint64Array":
      return Cannot_find_name_0_Do_you_need_to_change_your_target_library_Try_changing_the_lib_compiler_option_to_1_or_later;
    case "await":
      if (IsCallExpression(node!.Parent)) {
        return Cannot_find_name_0_Did_you_mean_to_write_this_in_an_async_function;
      }
      break;
  }
  if (node!.Parent !== undefined && node!.Parent.Kind === KindShorthandPropertyAssignment) {
    return No_value_exists_in_scope_for_the_shorthand_property_0_Either_declare_one_or_provide_an_initializer;
  }
  return Cannot_find_name_0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.GetDiagnostics","kind":"method","status":"implemented","sigHash":"37ea2cbbb80f6f6a2c81bb58c519e4e4e0b2a524b9fe35b74c2701c487e39e4a","bodyHash":"e45dcd40edc09719c5c266641257041d5655c05a954f57edca1b80944f79fa26"}
 *
 * Go source:
 * func (c *Checker) GetDiagnostics(ctx context.Context, sourceFile *ast.SourceFile) []*ast.Diagnostic {
 * 	return c.getDiagnostics(ctx, sourceFile, &c.diagnostics)
 * }
 */
export function Checker_GetDiagnostics(receiver: GoPtr<Checker>, ctx: Context, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>> {
  return Checker_getDiagnostics(receiver, ctx, sourceFile, receiver!.diagnostics);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.GetSuggestionDiagnostics","kind":"method","status":"implemented","sigHash":"97f638b0d4b0b1f7f89bcea364a82839808d155d6d85fd0ee2496423c35cee4f","bodyHash":"00a4d733a5d3513b985d54487e069bac295ce7c42a82de83734dac2b816149d3"}
 *
 * Go source:
 * func (c *Checker) GetSuggestionDiagnostics(ctx context.Context, sourceFile *ast.SourceFile) []*ast.Diagnostic {
 * 	return c.getDiagnostics(ctx, sourceFile, &c.suggestionDiagnostics)
 * }
 */
export function Checker_GetSuggestionDiagnostics(receiver: GoPtr<Checker>, ctx: Context, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>> {
  return Checker_getDiagnostics(receiver, ctx, sourceFile, receiver!.suggestionDiagnostics);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDiagnostics","kind":"method","status":"implemented","sigHash":"76688290efe6d9786821b97ee32f83dba77236df3c60bbb957c567992ec4c858","bodyHash":"c8b7a97bf6634f32d1cb20fb1fd2a9f2208a4a80cc4116f7953c04fe152b8ae8"}
 *
 * Go source:
 * func (c *Checker) getDiagnostics(ctx context.Context, sourceFile *ast.SourceFile, collection *ast.DiagnosticsCollection) []*ast.Diagnostic {
 * 	c.checkNotCanceled()
 * 	checkUnused := c.compilerOptions.NoUnusedLocals.IsTrue() || c.compilerOptions.NoUnusedParameters.IsTrue() || collection == &c.suggestionDiagnostics
 * 	c.checkSourceFile(ctx, sourceFile, checkUnused)
 * 	if c.wasCanceled {
 * 		return nil
 * 	}
 * 	return collection.GetDiagnosticsForFile(sourceFile.FileName())
 * }
 */
export function Checker_getDiagnostics(receiver: GoPtr<Checker>, ctx: Context, sourceFile: GoPtr<SourceFile>, collection: GoPtr<DiagnosticsCollection>): GoSlice<GoPtr<Diagnostic>> {
  const c = receiver!;
  Checker_checkNotCanceled(receiver);
  const checkUnused = (Tristate_IsTrue(c.compilerOptions!.NoUnusedLocals) ||
    Tristate_IsTrue(c.compilerOptions!.NoUnusedParameters) ||
    collection === c.suggestionDiagnostics) as bool;
  Checker_checkSourceFile(receiver, ctx, sourceFile, checkUnused);
  if (c.wasCanceled) {
    return [];
  }
  return DiagnosticsCollection_GetDiagnosticsForFile(collection, SourceFile_FileName(sourceFile));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.GetGlobalDiagnostics","kind":"method","status":"implemented","sigHash":"3bfb53202e3d8331de7127856cb81ee1a3787adf80b36d04da5f3636ebab8fc5","bodyHash":"26ab6d44813d73ff5fbe4dafe6f30680784ecd5f05c3740b56b35cbe0581da9b"}
 *
 * Go source:
 * func (c *Checker) GetGlobalDiagnostics() []*ast.Diagnostic {
 * 	c.checkNotCanceled()
 * 	return c.diagnostics.GetGlobalDiagnostics()
 * }
 */
export function Checker_GetGlobalDiagnostics(receiver: GoPtr<Checker>): GoSlice<GoPtr<Diagnostic>> {
  Checker_checkNotCanceled(receiver);
  return DiagnosticsCollection_GetGlobalDiagnostics(receiver!.diagnostics);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addDeferredDiagnostic","kind":"method","status":"implemented","sigHash":"b4099d211be44e64ca5eb78493e2a7ba0e7441480c93b091b8df3e9f57a983bb","bodyHash":"298fbf47d2bb88187c160a66bd77d3f860490659c0b21e5fc6f4461b50e846a6"}
 *
 * Go source:
 * func (c *Checker) addDeferredDiagnostic(callback func()) {
 * 	if c.saveDeferredDiagnostics {
 * 		c.deferredDiagnosticCallbacks = append(c.deferredDiagnosticCallbacks, callback)
 * 	}
 * }
 */
export function Checker_addDeferredDiagnostic(receiver: GoPtr<Checker>, callback: () => void): void {
  const c = receiver!;
  if (c.saveDeferredDiagnostics) {
    c.deferredDiagnosticCallbacks = [...(c.deferredDiagnosticCallbacks ?? []), callback];
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.produceDeferredDiagnostics","kind":"method","status":"implemented","sigHash":"b76ee6d78e69a0a9d39e8fe04e888743204d757a190b7b4b314058bd00d62cd1","bodyHash":"01c4b38128e6d8067641a4f2837947048e03bbf50016aea85e66c6fc3a60cdf4"}
 *
 * Go source:
 * func (c *Checker) produceDeferredDiagnostics() {
 * 	for _, cb := range c.deferredDiagnosticCallbacks {
 * 		cb()
 * 	}
 * 	c.deferredDiagnosticCallbacks = nil
 * }
 */
export function Checker_produceDeferredDiagnostics(receiver: GoPtr<Checker>): void {
  const c = receiver!;
  for (const cb of c.deferredDiagnosticCallbacks ?? []) {
    cb();
  }
  c.deferredDiagnosticCallbacks = undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addErrorOrSuggestion","kind":"method","status":"implemented","sigHash":"3a4023d03174daef90494da78c235989d9c89eb87726ac6c3715a9f78a03fa5f","bodyHash":"51824774258eba7a3a28e813e5f4b33fc3b86049b9d680d9e4629b7cd004e1d7"}
 *
 * Go source:
 * func (c *Checker) addErrorOrSuggestion(isError bool, diagnostic *ast.Diagnostic) {
 * 	if isError {
 * 		c.addDiagnostic(diagnostic)
 * 	} else {
 * 		suggestion := *diagnostic
 * 		suggestion.SetCategory(diagnostics.CategorySuggestion)
 * 		c.addSuggestionDiagnostic(&suggestion)
 * 	}
 * }
 */
export function Checker_addErrorOrSuggestion(receiver: GoPtr<Checker>, isError: bool, diagnostic: GoPtr<Diagnostic>): void {
  if (isError) {
    Checker_addDiagnostic(receiver, diagnostic);
  } else {
    const suggestion = Diagnostic_Clone(diagnostic);
    Diagnostic_SetCategory(suggestion, CategorySuggestion);
    Checker_addSuggestionDiagnostic(receiver, suggestion);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.IsDeprecatedDeclaration","kind":"method","status":"implemented","sigHash":"94562f9123e66d313b2ba9a744ea610a748e3134a7922768e3c19b59884b52b2","bodyHash":"8b50399655ffcbf8af2cb56769d1e4b0f6bd78f6201cd915dc26516045d81c4b"}
 *
 * Go source:
 * func (c *Checker) IsDeprecatedDeclaration(declaration *ast.Node) bool {
 * 	return ast.IsDeprecatedDeclarationWithCachedFlags(declaration, c.getCombinedNodeFlagsCached(declaration))
 * }
 */
export function Checker_IsDeprecatedDeclaration(receiver: GoPtr<Checker>, declaration: GoPtr<Node>): bool {
  return IsDeprecatedDeclarationWithCachedFlags(declaration, Checker_getCombinedNodeFlagsCached(receiver, declaration));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addDeprecatedSuggestion","kind":"method","status":"implemented","sigHash":"05c75b0e89d569cac08e086724c71689c45c6a832d347186387cec7ff4323269","bodyHash":"539052c42379945d103cb7e1875c8e737fe0676e4330491ce0a5ddb2c1df24b3"}
 *
 * Go source:
 * func (c *Checker) addDeprecatedSuggestion(location *ast.Node, declarations []*ast.Node, deprecatedEntity string) *ast.Diagnostic {
 * 	diagnostic := NewDiagnosticForNode(location, diagnostics.X_0_is_deprecated, deprecatedEntity)
 * 	return c.addDeprecatedSuggestionWorker(declarations, diagnostic)
 * }
 */
export function Checker_addDeprecatedSuggestion(receiver: GoPtr<Checker>, location: GoPtr<Node>, declarations: GoSlice<GoPtr<Node>>, deprecatedEntity: string): GoPtr<Diagnostic> {
  const diagnostic = NewDiagnosticForNode(location, X_0_is_deprecated, deprecatedEntity);
  return Checker_addDeprecatedSuggestionWorker(receiver, declarations, diagnostic);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addDeprecatedSuggestionWorker","kind":"method","status":"implemented","sigHash":"6090f33b1bcdcdbb8a241755e468f7f54e095948e7031b646b10d06c7f0496aa","bodyHash":"19ac712a048c5ce29039b02f24ec466b851a711694be1fa3d50dfaf7fc0cea61"}
 *
 * Go source:
 * func (c *Checker) addDeprecatedSuggestionWorker(declarations []*ast.Node, diagnostic *ast.Diagnostic) *ast.Diagnostic {
 * 	for _, declaration := range declarations {
 * 		deprecatedTag := ast.GetJSDocDeprecatedTag(declaration)
 * 		if deprecatedTag != nil {
 * 			diagnostic.AddRelatedInfo(NewDiagnosticForNode(deprecatedTag, diagnostics.The_declaration_was_marked_as_deprecated_here))
 * 			break
 * 		}
 * 	}
 * 	c.addSuggestionDiagnostic(diagnostic)
 * 	return diagnostic
 * }
 */
export function Checker_addDeprecatedSuggestionWorker(receiver: GoPtr<Checker>, declarations: GoSlice<GoPtr<Node>>, diagnostic: GoPtr<Diagnostic>): GoPtr<Diagnostic> {
  for (const declaration of declarations) {
    const deprecatedTag = GetJSDocDeprecatedTag(declaration);
    if (deprecatedTag !== undefined) {
      Diagnostic_AddRelatedInfo(diagnostic, NewDiagnosticForNode(deprecatedTag, The_declaration_was_marked_as_deprecated_here));
      break;
    }
  }
  Checker_addSuggestionDiagnostic(receiver, diagnostic);
  return diagnostic;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isDeprecatedSymbol","kind":"method","status":"implemented","sigHash":"76594b4d9eb7222a7d0cf4ae288dbd300ddd713b3f04e5b69769517d20366ed5","bodyHash":"54099fcaaaefb472f7d5e65b559391dc8156a1c2cd66186bb4d11f7700587eb7"}
 *
 * Go source:
 * func (c *Checker) isDeprecatedSymbol(symbol *ast.Symbol) bool {
 * 	parentSymbol := c.getParentOfSymbol(symbol)
 * 	if parentSymbol != nil && len(symbol.Declarations) > 1 {
 * 		if parentSymbol.Flags&ast.SymbolFlagsInterface != 0 {
 * 			return core.Some(symbol.Declarations, c.IsDeprecatedDeclaration)
 * 		} else {
 * 			return core.Every(symbol.Declarations, c.IsDeprecatedDeclaration)
 * 		}
 * 	}
 * 	return symbol.ValueDeclaration != nil && c.IsDeprecatedDeclaration(symbol.ValueDeclaration) || len(symbol.Declarations) != 0 && core.Every(symbol.Declarations, c.IsDeprecatedDeclaration)
 * }
 */
export function Checker_isDeprecatedSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool {
  const parentSymbol = Checker_getParentOfSymbol(receiver, symbol_);
  const declarations = symbol_!.Declarations ?? [];
  if (parentSymbol !== undefined && declarations.length > 1) {
    if ((parentSymbol!.Flags & SymbolFlagsInterface) !== 0) {
      return Some(declarations, (declaration) => Checker_IsDeprecatedDeclaration(receiver, declaration));
    }
    return Every(declarations, (declaration) => Checker_IsDeprecatedDeclaration(receiver, declaration));
  }
  return ((symbol_!.ValueDeclaration !== undefined && Checker_IsDeprecatedDeclaration(receiver, symbol_!.ValueDeclaration)) ||
    (declarations.length !== 0 && Every(declarations, (declaration) => Checker_IsDeprecatedDeclaration(receiver, declaration)))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasParseDiagnostics","kind":"method","status":"implemented","sigHash":"e2c06d25aaa191c1fdf45c8a7be1adca08a49b57d81c851da196830a5791666d","bodyHash":"9ed775a1470c11c5d7e94ea29c39a13bcaf9a7809f1b8a52015546e4a2f88657"}
 *
 * Go source:
 * func (c *Checker) hasParseDiagnostics(sourceFile *ast.SourceFile) bool {
 * 	return len(sourceFile.Diagnostics()) > 0
 * }
 */
export function Checker_hasParseDiagnostics(receiver: GoPtr<Checker>, sourceFile: GoPtr<SourceFile>): bool {
  return (SourceFile_Diagnostics(sourceFile).length > 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportMergeSymbolError","kind":"method","status":"implemented","sigHash":"707eee0bed519887c474932889b4501b53eff1dbcd632a4e8753eefa0808c88b","bodyHash":"135ee9473811ee94e831337430972d8a2c2da72b59bf8c68862ed4000945d24b"}
 *
 * Go source:
 * func (c *Checker) reportMergeSymbolError(target *ast.Symbol, source *ast.Symbol) {
 * 	isEitherEnum := target.Flags&ast.SymbolFlagsEnum != 0 || source.Flags&ast.SymbolFlagsEnum != 0
 * 	isEitherBlockScoped := target.Flags&ast.SymbolFlagsBlockScopedVariable != 0 || source.Flags&ast.SymbolFlagsBlockScopedVariable != 0
 * 	var message *diagnostics.Message
 * 	switch {
 * 	case isEitherEnum:
 * 		message = diagnostics.Enum_declarations_can_only_merge_with_namespace_or_other_enum_declarations
 * 	case isEitherBlockScoped:
 * 		message = diagnostics.Cannot_redeclare_block_scoped_variable_0
 * 	default:
 * 		message = diagnostics.Duplicate_identifier_0
 * 	}
 * 	sourceSymbolFile := ast.GetSourceFileOfNode(getFirstDeclaration(source))
 * 	targetSymbolFile := ast.GetSourceFileOfNode(getFirstDeclaration(target))
 * 	isSourcePlainJS := ast.IsPlainJSFile(sourceSymbolFile, c.compilerOptions.CheckJs)
 * 	isTargetPlainJS := ast.IsPlainJSFile(targetSymbolFile, c.compilerOptions.CheckJs)
 * 	symbolName := c.symbolToString(source)
 * 	if !isSourcePlainJS {
 * 		c.addDuplicateDeclarationErrorsForSymbols(source, message, symbolName, target)
 * 	}
 * 	if !isTargetPlainJS {
 * 		c.addDuplicateDeclarationErrorsForSymbols(target, message, symbolName, source)
 * 	}
 * }
 */
export function Checker_reportMergeSymbolError(receiver: GoPtr<Checker>, target: GoPtr<Symbol>, source: GoPtr<Symbol>): void {
  const c = receiver!;
  const isEitherEnum = ((target!.Flags & SymbolFlagsEnum) !== 0 || (source!.Flags & SymbolFlagsEnum) !== 0) as bool;
  const isEitherBlockScoped = ((target!.Flags & SymbolFlagsBlockScopedVariable) !== 0 || (source!.Flags & SymbolFlagsBlockScopedVariable) !== 0) as bool;
  let message: GoPtr<Message>;
  if (isEitherEnum) {
    message = Enum_declarations_can_only_merge_with_namespace_or_other_enum_declarations;
  } else if (isEitherBlockScoped) {
    message = Cannot_redeclare_block_scoped_variable_0;
  } else {
    message = Duplicate_identifier_0;
  }
  const sourceSymbolFile = GetSourceFileOfNode(getFirstDeclaration(source));
  const targetSymbolFile = GetSourceFileOfNode(getFirstDeclaration(target));
  const isSourcePlainJS = IsPlainJSFile(sourceSymbolFile, c.compilerOptions!.CheckJs);
  const isTargetPlainJS = IsPlainJSFile(targetSymbolFile, c.compilerOptions!.CheckJs);
  const symbolName = Checker_symbolToString(receiver, source);
  if (!isSourcePlainJS) {
    Checker_addDuplicateDeclarationErrorsForSymbols(receiver, source, message, symbolName, target);
  }
  if (!isTargetPlainJS) {
    Checker_addDuplicateDeclarationErrorsForSymbols(receiver, target, message, symbolName, source);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addDuplicateDeclarationErrorsForSymbols","kind":"method","status":"implemented","sigHash":"f12c76e0036acbe20e1e1540c488e1a181c145b25caa8fa7cc9b18ef51c6e3ad","bodyHash":"27d829d016d418ad1a1c852cadc7eaaf2503b7df3bc4fe30d25a6e5117c949fc"}
 *
 * Go source:
 * func (c *Checker) addDuplicateDeclarationErrorsForSymbols(target *ast.Symbol, message *diagnostics.Message, symbolName string, source *ast.Symbol) {
 * 	for _, node := range target.Declarations {
 * 		c.addDuplicateDeclarationError(node, message, symbolName, source.Declarations)
 * 	}
 * }
 */
export function Checker_addDuplicateDeclarationErrorsForSymbols(receiver: GoPtr<Checker>, target: GoPtr<Symbol>, message: GoPtr<Message>, symbolName: string, source: GoPtr<Symbol>): void {
  for (const node of target!.Declarations ?? []) {
    Checker_addDuplicateDeclarationError(receiver, node, message, symbolName, source!.Declarations ?? []);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addDuplicateDeclarationError","kind":"method","status":"implemented","sigHash":"5700ea255b3dd4bcf10f0c56d6ddcab07e6ecb4d377210e1266f8fc756e079ba","bodyHash":"924d63517b86d6db080f32da7c6a723483260bd1d5b0d386862112f785475e25"}
 *
 * Go source:
 * func (c *Checker) addDuplicateDeclarationError(node *ast.Node, message *diagnostics.Message, symbolName string, relatedNodes []*ast.Node) {
 * 	errorNode := getAdjustedNodeForError(node)
 * 	if errorNode == nil {
 * 		errorNode = node
 * 	}
 * 	err := c.lookupOrIssueError(errorNode, message, symbolName)
 * 	for _, relatedNode := range relatedNodes {
 * 		adjustedNode := getAdjustedNodeForError(relatedNode)
 * 		if adjustedNode == errorNode {
 * 			continue
 * 		}
 * 		leadingMessage := createDiagnosticForNode(adjustedNode, diagnostics.X_0_was_also_declared_here, symbolName)
 * 		followOnMessage := createDiagnosticForNode(adjustedNode, diagnostics.X_and_here)
 * 		if len(err.RelatedInformation()) >= 5 || core.Some(err.RelatedInformation(), func(d *ast.Diagnostic) bool {
 * 			return ast.CompareDiagnostics(d, followOnMessage) == 0 || ast.CompareDiagnostics(d, leadingMessage) == 0
 * 		}) {
 * 			continue
 * 		}
 * 		if len(err.RelatedInformation()) == 0 {
 * 			err.AddRelatedInfo(leadingMessage)
 * 		} else {
 * 			err.AddRelatedInfo(followOnMessage)
 * 		}
 * 	}
 * }
 */
export function Checker_addDuplicateDeclarationError(receiver: GoPtr<Checker>, node: GoPtr<Node>, message: GoPtr<Message>, symbolName: string, relatedNodes: GoSlice<GoPtr<Node>>): void {
  let errorNode = getAdjustedNodeForError(node);
  if (errorNode === undefined) {
    errorNode = node;
  }
  const err = Checker_lookupOrIssueError(receiver, errorNode, message, symbolName);
  for (const relatedNode of relatedNodes) {
    const adjustedNode = getAdjustedNodeForError(relatedNode);
    if (adjustedNode === errorNode) {
      continue;
    }
    const leadingMessage = createDiagnosticForNode(adjustedNode, X_0_was_also_declared_here, symbolName);
    const followOnMessage = createDiagnosticForNode(adjustedNode, X_and_here);
    if (
      Diagnostic_RelatedInformation(err).length >= 5 ||
      Some(Diagnostic_RelatedInformation(err), (d: GoPtr<Diagnostic>) =>
        CompareDiagnostics(d, followOnMessage) === 0 || CompareDiagnostics(d, leadingMessage) === 0)
    ) {
      continue;
    }
    if (Diagnostic_RelatedInformation(err).length === 0) {
      Diagnostic_AddRelatedInfo(err, leadingMessage);
    } else {
      Diagnostic_AddRelatedInfo(err, followOnMessage);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.lookupOrIssueError","kind":"method","status":"implemented","sigHash":"d49682ace3c66fbf7e4e3c0f4001bc9c49f62a25415ccc1fd8c07ad907a52ced","bodyHash":"cb91459a0b6ec1d82cf13ff89170259ca8776d38804c0e142c266125eae6f472"}
 *
 * Go source:
 * func (c *Checker) lookupOrIssueError(location *ast.Node, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 	diagnostic := NewDiagnosticForNode(location, message, args...)
 * 	existing := c.diagnostics.Lookup(diagnostic)
 * 	if existing != nil {
 * 		return existing
 * 	}
 * 	c.addDiagnostic(diagnostic)
 * 	return diagnostic
 * }
 */
export function Checker_lookupOrIssueError(receiver: GoPtr<Checker>, location: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic> {
  const diagnostic = NewDiagnosticForNode(location, message, ...args);
  const existing = DiagnosticsCollection_Lookup(receiver!.diagnostics, diagnostic);
  if (existing !== undefined) {
    return existing;
  }
  Checker_addDiagnostic(receiver, diagnostic);
  return diagnostic;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAndReportErrorForResolvingImportAliasToTypeOnlySymbol","kind":"method","status":"implemented","sigHash":"0450a01268426ba7992f134fc495bc5943dd5efcd3ce8701a7713b97db699a65","bodyHash":"540b58284229379dfc2dc38e508f6aaeaa641cc745d8f9b45a09dcc833f22095"}
 *
 * Go source:
 * func (c *Checker) checkAndReportErrorForResolvingImportAliasToTypeOnlySymbol(node *ast.Node, resolved *ast.Symbol) {
 * 	decl := node.AsImportEqualsDeclaration()
 * 	name := decl.ModuleReference
 * 	for {
 * 		if typeOnlyDeclaration := c.getTypeOnlyDeclarationOfEntityName(name); typeOnlyDeclaration != nil {
 * 			isExport := ast.NodeKindIs(typeOnlyDeclaration, ast.KindExportSpecifier, ast.KindExportDeclaration)
 * 			message := core.IfElse(isExport,
 * 				diagnostics.An_import_alias_cannot_reference_a_declaration_that_was_exported_using_export_type,
 * 				diagnostics.An_import_alias_cannot_reference_a_declaration_that_was_imported_using_import_type)
 * 			relatedMessage := core.IfElse(isExport,
 * 				diagnostics.X_0_was_exported_here,
 * 				diagnostics.X_0_was_imported_here)
 * 			// TODO: how to get name for export *?
 * 			name := "*"
 * 			if !ast.IsExportDeclaration(typeOnlyDeclaration) {
 * 				name = typeOnlyDeclaration.Name().Text()
 * 			}
 * 			c.error(decl.ModuleReference, message).AddRelatedInfo(createDiagnosticForNode(typeOnlyDeclaration, relatedMessage, name))
 * 			break
 * 		}
 * 		if ast.IsIdentifier(name) {
 * 			break
 * 		}
 * 		name = name.AsQualifiedName().Left
 * 	}
 * }
 */
export function Checker_checkAndReportErrorForResolvingImportAliasToTypeOnlySymbol(receiver: GoPtr<Checker>, node: GoPtr<Node>, resolved: GoPtr<Symbol>): void {
  const decl = AsImportEqualsDeclaration(node);
  let name = decl!.ModuleReference;
  for (;;) {
    const typeOnlyDeclaration = Checker_getTypeOnlyDeclarationOfEntityName(receiver, name);
    if (typeOnlyDeclaration !== undefined) {
      const isExport = NodeKindIs(typeOnlyDeclaration, KindExportSpecifier, KindExportDeclaration);
      const message = IfElse(isExport,
        An_import_alias_cannot_reference_a_declaration_that_was_exported_using_export_type,
        An_import_alias_cannot_reference_a_declaration_that_was_imported_using_import_type);
      const relatedMessage = IfElse(isExport,
        X_0_was_exported_here,
        X_0_was_imported_here);
      let declarationName = "*";
      if (!IsExportDeclaration(typeOnlyDeclaration)) {
        declarationName = Node_Text(Node_Name(typeOnlyDeclaration));
      }
      Diagnostic_AddRelatedInfo(
        Checker_error(receiver, decl!.ModuleReference, message),
        createDiagnosticForNode(typeOnlyDeclaration, relatedMessage, declarationName),
      );
      break;
    }
    if (IsIdentifier(name)) {
      break;
    }
    name = AsQualifiedName(name)!.Left;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getCannotResolveModuleNameErrorForSpecificModule","kind":"method","status":"implemented","sigHash":"f7a52c7a4d98c69fa048daf40ba24009855a2c2785f585d024e4bfe661ee0d26","bodyHash":"90a9bdc118a40e684aeab04de2f4bf0cb039dfe5b1ab75320695d5fd2eb84c82"}
 *
 * Go source:
 * func (c *Checker) getCannotResolveModuleNameErrorForSpecificModule(moduleName *ast.Node) *diagnostics.Message {
 * 	if ast.IsStringLiteral(moduleName) {
 * 		if core.NodeCoreModules()[moduleName.Text()] {
 * 			if c.compilerOptions.UsesWildcardTypes() {
 * 				return diagnostics.Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_node_Try_npm_i_save_dev_types_Slashnode
 * 			}
 * 			return diagnostics.Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_node_Try_npm_i_save_dev_types_Slashnode_and_then_add_node_to_the_types_field_in_your_tsconfig
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getCannotResolveModuleNameErrorForSpecificModule(receiver: GoPtr<Checker>, moduleName: GoPtr<Node>): GoPtr<Message> {
  if (IsStringLiteral(moduleName)) {
    if (NodeCoreModules().get(Node_Text(moduleName))) {
      if (CompilerOptions_UsesWildcardTypes(receiver!.compilerOptions)) {
        return Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_node_Try_npm_i_save_dev_types_Slashnode;
      }
      return Cannot_find_name_0_Do_you_need_to_install_type_definitions_for_node_Try_npm_i_save_dev_types_Slashnode_and_then_add_node_to_the_types_field_in_your_tsconfig;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportCircularityError","kind":"method","status":"implemented","sigHash":"2a8895e219e931cf8c4f56cd27d26954e0e68740ed2826203dc4019c60ef4da4","bodyHash":"ed7162ed0066e406fe727612508ed8ceaae961ec1875bf6252e5d7eb718ba4be"}
 *
 * Go source:
 * func (c *Checker) reportCircularityError(symbol *ast.Symbol) *Type {
 * 	declaration := symbol.ValueDeclaration
 * 	// Check if variable has type annotation that circularly references the variable itself
 * 	if declaration != nil {
 * 		if declaration.Type() != nil {
 * 			c.error(symbol.ValueDeclaration, diagnostics.X_0_is_referenced_directly_or_indirectly_in_its_own_type_annotation, c.symbolToString(symbol))
 * 			return c.errorType
 * 		}
 * 		// Check if variable has initializer that circularly references the variable itself
 * 		if c.noImplicitAny && (!ast.IsParameterDeclaration(declaration) || declaration.Initializer() != nil) {
 * 			c.error(symbol.ValueDeclaration, diagnostics.X_0_implicitly_has_type_any_because_it_does_not_have_a_type_annotation_and_is_referenced_directly_or_indirectly_in_its_own_initializer, c.symbolToString(symbol))
 * 		}
 * 	} else if symbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 		node := c.getDeclarationOfAliasSymbol(symbol)
 * 		if node != nil {
 * 			c.error(node, diagnostics.Circular_definition_of_import_alias_0, c.symbolToString(symbol))
 * 		}
 * 	}
 * 	// Circularities could also result from parameters in function expressions that end up
 * 	// having themselves as contextual types following type argument inference. In those cases
 * 	// we have already reported an implicit any error so we don't report anything here.
 * 	return c.anyType
 * }
 */
export function Checker_reportCircularityError(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type> {
  const declaration = symbol_!.ValueDeclaration;
  if (declaration !== undefined) {
    if (Node_Type(declaration) !== undefined) {
      Checker_error(receiver, symbol_!.ValueDeclaration, X_0_is_referenced_directly_or_indirectly_in_its_own_type_annotation, Checker_symbolToString(receiver, symbol_));
      return receiver!.errorType;
    }
    if (receiver!.noImplicitAny && (!IsParameterDeclaration(declaration) || Node_Initializer(declaration) !== undefined)) {
      Checker_error(receiver, symbol_!.ValueDeclaration, X_0_implicitly_has_type_any_because_it_does_not_have_a_type_annotation_and_is_referenced_directly_or_indirectly_in_its_own_initializer, Checker_symbolToString(receiver, symbol_));
    }
  } else if ((symbol_!.Flags & SymbolFlagsAlias) !== 0) {
    const node = Checker_getDeclarationOfAliasSymbol(receiver, symbol_);
    if (node !== undefined) {
      Checker_error(receiver, node, Circular_definition_of_import_alias_0, Checker_symbolToString(receiver, symbol_));
    }
  }
  return receiver!.anyType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportErrorsFromWidening","kind":"method","status":"implemented","sigHash":"8a87d93f4f2bb42d7f36d00047f8b32cc1cf8793e8b8ae1d9491671b4e6db19f","bodyHash":"1c98b4f1852a7cb7a3f7a63d069b12283b472b2d72d1f411965624a41f7ba7bf"}
 *
 * Go source:
 * func (c *Checker) reportErrorsFromWidening(declaration *ast.Node, t *Type, wideningKind WideningKind) {
 * 	if c.noImplicitAny && t.objectFlags&ObjectFlagsContainsWideningType != 0 {
 * 		if wideningKind == WideningKindNormal || ast.IsFunctionLikeDeclaration(declaration) && c.shouldReportErrorsFromWideningWithContextualSignature(declaration, wideningKind) {
 * 			// Report implicit any error within type if possible, otherwise report error on declaration
 * 			if !c.reportWideningErrorsInType(t) {
 * 				c.reportImplicitAny(declaration, t, wideningKind)
 * 			}
 * 		}
 * 	}
 * }
 */
export function Checker_reportErrorsFromWidening(receiver: GoPtr<Checker>, declaration: GoPtr<Node>, t: GoPtr<Type>, wideningKind: WideningKind): void {
  if (receiver!.noImplicitAny && (t!.objectFlags & ObjectFlagsContainsWideningType) !== 0) {
    if (wideningKind === WideningKindNormal || (IsFunctionLikeDeclaration(declaration) && Checker_shouldReportErrorsFromWideningWithContextualSignature(receiver, declaration, wideningKind))) {
      if (!Checker_reportWideningErrorsInType(receiver, t)) {
        Checker_reportImplicitAny(receiver, declaration, t, wideningKind);
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.shouldReportErrorsFromWideningWithContextualSignature","kind":"method","status":"implemented","sigHash":"6d7968bcaba6519c9d3aacbe2c73a59b75970fdc00267eda66d3333f598673ae","bodyHash":"b9ced644ed9199470836a8c4461e65a8d900c4703151d630e3e59b3227401fc7"}
 *
 * Go source:
 * func (c *Checker) shouldReportErrorsFromWideningWithContextualSignature(declaration *ast.Node, wideningKind WideningKind) bool {
 * 	signature := c.getContextualSignatureForFunctionLikeDeclaration(declaration)
 * 	if signature == nil {
 * 		return true
 * 	}
 * 	returnType := c.getReturnTypeOfSignature(signature)
 * 	flags := ast.GetFunctionFlags(declaration)
 * 	switch wideningKind {
 * 	case WideningKindFunctionReturn:
 * 		if flags&ast.FunctionFlagsGenerator != 0 {
 * 			returnType = core.OrElse(c.getIterationTypeOfGeneratorFunctionReturnType(IterationTypeKindReturn, returnType, flags&ast.FunctionFlagsAsync != 0), returnType)
 * 		} else if flags&ast.FunctionFlagsAsync != 0 {
 * 			returnType = core.OrElse(c.getAwaitedTypeNoAlias(returnType), returnType)
 * 		}
 * 		return c.isGenericType(returnType)
 * 	case WideningKindGeneratorYield:
 * 		yieldType := c.getIterationTypeOfGeneratorFunctionReturnType(IterationTypeKindYield, returnType, flags&ast.FunctionFlagsAsync != 0)
 * 		return yieldType != nil && c.isGenericType(yieldType)
 * 	case WideningKindGeneratorNext:
 * 		nextType := c.getIterationTypeOfGeneratorFunctionReturnType(IterationTypeKindNext, returnType, flags&ast.FunctionFlagsAsync != 0)
 * 		return nextType != nil && c.isGenericType(nextType)
 * 	}
 * 	return false
 * }
 */
export function Checker_shouldReportErrorsFromWideningWithContextualSignature(receiver: GoPtr<Checker>, declaration: GoPtr<Node>, wideningKind: WideningKind): bool {
  const signature = Checker_getContextualSignatureForFunctionLikeDeclaration(receiver, declaration);
  if (signature === undefined) {
    return true;
  }
  let returnType = Checker_getReturnTypeOfSignature(receiver, signature);
  const flags = GetFunctionFlags(declaration);
  switch (wideningKind) {
    case WideningKindFunctionReturn:
      if ((flags & FunctionFlagsGenerator) !== 0) {
        returnType = OrElse(Checker_getIterationTypeOfGeneratorFunctionReturnType(receiver, IterationTypeKindReturn, returnType, (flags & FunctionFlagsAsync) !== 0), returnType);
      } else if ((flags & FunctionFlagsAsync) !== 0) {
        returnType = OrElse(Checker_getAwaitedTypeNoAlias(receiver, returnType), returnType);
      }
      return Checker_isGenericType(receiver, returnType);
    case WideningKindGeneratorYield: {
      const yieldType = Checker_getIterationTypeOfGeneratorFunctionReturnType(receiver, IterationTypeKindYield, returnType, (flags & FunctionFlagsAsync) !== 0);
      return yieldType !== undefined && Checker_isGenericType(receiver, yieldType);
    }
    case WideningKindGeneratorNext: {
      const nextType = Checker_getIterationTypeOfGeneratorFunctionReturnType(receiver, IterationTypeKindNext, returnType, (flags & FunctionFlagsAsync) !== 0);
      return nextType !== undefined && Checker_isGenericType(receiver, nextType);
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportWideningErrorsInType","kind":"method","status":"implemented","sigHash":"c793c199893476d8d8a34047f417c69b7276a2501f33377a22dbdd23ad3170dd","bodyHash":"c66486351ee83492ca79dd068b648bcdb9f7877417587cf3c516fc4482b772ae"}
 *
 * Go source:
 * func (c *Checker) reportWideningErrorsInType(t *Type) bool {
 * 	errorReported := false
 * 	if t.objectFlags&ObjectFlagsContainsWideningType != 0 {
 * 		if t.flags&TypeFlagsUnion != 0 {
 * 			if core.Some(t.Types(), c.isEmptyObjectType) {
 * 				errorReported = true
 * 			} else {
 * 				for _, s := range t.Types() {
 * 					errorReported = errorReported || c.reportWideningErrorsInType(s)
 * 				}
 * 			}
 * 		} else if c.isArrayOrTupleType(t) {
 * 			for _, s := range c.getTypeArguments(t) {
 * 				errorReported = errorReported || c.reportWideningErrorsInType(s)
 * 			}
 * 		} else if isObjectLiteralType(t) {
 * 			for _, p := range c.getPropertiesOfObjectType(t) {
 * 				s := c.getTypeOfSymbol(p)
 * 				if s.objectFlags&ObjectFlagsContainsWideningType != 0 {
 * 					errorReported = c.reportWideningErrorsInType(s)
 * 					if !errorReported {
 * 						// we need to account for property types coming from object literal type normalization in unions
 * 						valueDeclaration := core.Find(p.Declarations, func(d *ast.Node) bool {
 * 							valueDeclaration := d.Symbol().ValueDeclaration
 * 							return valueDeclaration != nil && valueDeclaration.Parent == t.symbol.ValueDeclaration
 * 						})
 * 						if valueDeclaration != nil {
 * 							c.error(valueDeclaration, diagnostics.Object_literal_s_property_0_implicitly_has_an_1_type, c.symbolToString(p), c.TypeToString(c.getWidenedType(s)))
 * 							errorReported = true
 * 						}
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return errorReported
 * }
 */
export function Checker_reportWideningErrorsInType(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  let errorReported = false;
  if ((t!.objectFlags & ObjectFlagsContainsWideningType) !== 0) {
    if ((t!.flags & TypeFlagsUnion) !== 0) {
      if (Some(Type_Types(t), (tt: GoPtr<Type>) => Checker_isEmptyObjectType(receiver, tt))) {
        errorReported = true;
      } else {
        for (const s of Type_Types(t)) {
          errorReported = Checker_reportWideningErrorsInType(receiver, s) || errorReported;
        }
      }
    } else if (Checker_isArrayOrTupleType(receiver, t)) {
      for (const s of Checker_getTypeArguments(receiver, t)) {
        errorReported = Checker_reportWideningErrorsInType(receiver, s) || errorReported;
      }
    } else if (isObjectLiteralType(t)) {
      for (const p of Checker_getPropertiesOfObjectType(receiver, t)) {
        const s = Checker_getTypeOfSymbol(receiver, p);
        if ((s!.objectFlags & ObjectFlagsContainsWideningType) !== 0) {
          errorReported = Checker_reportWideningErrorsInType(receiver, s);
          if (!errorReported) {
            const valueDeclaration = Find(p!.Declarations ?? [], (d: GoPtr<Node>) => {
              const declarationValue = Node_Symbol(d)!.ValueDeclaration;
              return declarationValue !== undefined && declarationValue!.Parent === t!.symbol!.ValueDeclaration;
            });
            if (valueDeclaration !== undefined) {
              Checker_error(receiver, valueDeclaration, Object_literal_s_property_0_implicitly_has_an_1_type, Checker_symbolToString(receiver, p), Checker_TypeToString(receiver, Checker_getWidenedType(receiver, s)));
              errorReported = true;
            }
          }
        }
      }
    }
  }
  return errorReported;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isErrorType","kind":"method","status":"implemented","sigHash":"a6d51ca14443f14460b775745964be72a1864efc008ef088c59c424e1a83432c","bodyHash":"77b104972e7da782f4367e6d7efe0023dbb8e9b4ba9868d220dcb4ddb752ee11"}
 *
 * Go source:
 * func (c *Checker) isErrorType(t *Type) bool {
 * 	// The only 'any' types that have alias symbols are those manufactured by getTypeFromTypeAliasReference for
 * 	// a reference to an unresolved symbol. We want those to behave like the errorType.
 * 	return t == c.errorType || t.flags&TypeFlagsAny != 0 && t.alias != nil
 * }
 */
export function Checker_isErrorType(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  return (t === receiver!.errorType || ((t!.flags & TypeFlagsAny) !== 0 && t!.alias !== undefined)) as bool;
}
