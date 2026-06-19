import type { bool, int } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import { GetSourceFileOfNode, HasSyntacticModifier, HasDecorators, IsDynamicName, IsEntityNameExpression, IsEffectiveExternalModule, IsInTopLevelContext, IsFunctionLikeDeclaration, IsBindingPattern, IsAmbientModule, IsAutoAccessorPropertyDeclaration, IsStringOrNumericLiteralLike, CanHaveIllegalDecorators, CanHaveIllegalModifiers, CanHaveModifiers, HasAbstractModifier, NodeCanBeDecorated, IsIterationStatement, IsFunctionLikeOrClassStaticBlockDeclaration, IsClassLike, IsCommaSequence, IsDeclaration, GetContainingFunction, GetAllAccessorDeclarationsForDeclaration, SkipParentheses, IsInJSFile } from "../ast/utilities.js";
import { Node_EagerJSDoc, Node_ModifierNodes, Node_PostfixToken, Node_Attributes, Node_TagName, Node_TypeArgumentList, Node_Parameters, Node_Label, Node_Statement, Node_ClassName, Node_Statements, Node_StatementList, Node_Properties } from "../ast/ast.js";
import type { SourceFile, SourceFileLike } from "../ast/ast.js";
import { Node_Name, Node_FunctionLikeData, Node_ClassLikeData, Node_BodyData, Node_End, Node_Pos, NodeList_Pos, NodeList_End, NodeList_HasTrailingComma, Node_Modifiers, Node_ForEachChild } from "../ast/spine.js";
import type { Node, NodeList } from "../ast/spine.js";
import type { BigIntLiteral, BindingElement, ConstructorDeclaration, Decorator, ExportDeclaration, ForInOrOfStatement, HeritageClause, ImportClause, IndexSignatureDeclaration, InterfaceDeclaration, JsxExpression, MappedTypeNode, MetaProperty, NumericLiteral, ObjectLiteralExpression, PrivateIdentifier, RegularExpressionLiteral, TaggedTemplateExpression, TypeOperatorNode, VariableDeclaration, VariableDeclarationList, VariableStatement } from "../ast/generated/data.js";
import { PropertyAccessExpression_Name } from "../ast/generated/data.js";
import {
  KindSourceFile, KindModuleBlock, KindModuleDeclaration, KindBlock, KindImportDeclaration, KindImportEqualsDeclaration, KindExportAssignment, KindExportDeclaration,
  KindMethodDeclaration, KindFunctionDeclaration, KindFunctionExpression, KindArrowFunction, KindClassDeclaration, KindClassExpression, KindInterfaceDeclaration, KindTypeAliasDeclaration,
  KindEnumDeclaration, KindVariableStatement, KindGetAccessor, KindSetAccessor, KindConstructor, KindParameter, KindTypeParameter, KindPropertyDeclaration, KindPropertySignature,
  KindMethodSignature, KindIndexSignature, KindClassStaticBlockDeclaration, KindPropertyAssignment, KindShorthandPropertyAssignment, KindNamespaceExportDeclaration, KindMissingDeclaration,
  KindNumericLiteral, KindBigIntLiteral, KindSymbolKeyword, KindArrayType, KindTupleType, KindNewKeyword, KindImportKeyword, KindInKeyword, KindOutKeyword, KindConstKeyword,
  KindReadonlyKeyword, KindStaticKeyword, KindAccessorKeyword, KindAsyncKeyword, KindAbstractKeyword, KindDeclareKeyword, KindDefaultKeyword, KindExportKeyword,
  KindPublicKeyword, KindProtectedKeyword, KindPrivateKeyword, KindOverrideKeyword, KindCommaToken, KindExclamationToken, KindQuestionToken, KindComputedPropertyName,
  KindSwitchStatement, KindLabeledStatement, KindBreakStatement, KindContinueStatement, KindVariableDeclaration as KindVariableDeclarationNode, KindVariableDeclarationList, KindRegularExpressionLiteral,
  KindJSTypeAliasDeclaration, KindJSImportDeclaration, KindNamespaceImport, KindNamedImports, KindNamedExports, KindImportSpecifier, KindExportSpecifier, KindJsxSpreadAttribute,
  KindJSDocAugmentsTag, KindMetaProperty, KindTypeLiteral, KindIdentifier, KindPropertyAccessExpression, KindExpressionWithTypeArguments, KindPrivateIdentifier, KindConstructorType, KindAwaitKeyword,
  KindExtendsKeyword, KindImplementsKeyword, KindObjectLiteralExpression, KindPrefixUnaryExpression,
  KindForInStatement, KindForOfStatement, KindUniqueKeyword, KindTrueKeyword, KindFalseKeyword, KindMinusToken,
  KindDeferKeyword, KindTypeKeyword, KindSpreadAssignment, KindJsxExpression, KindBinaryExpression,
} from "../ast/generated/kinds.js";
import type { Kind } from "../ast/generated/kinds.js";
import {
  AsArrowFunction, AsCallExpression, AsBinaryExpression, AsPropertyAccessExpression, AsVariableDeclarationList, AsParameterDeclaration, AsHeritageClause,
  AsExpressionWithTypeArguments, AsVariableStatement, AsMetaProperty, AsComputedPropertyName, AsMethodDeclaration, AsPropertyDeclaration, AsPropertyAssignment,
  AsShorthandPropertyAssignment, AsSpreadAssignment, AsJsxAttribute, AsJSDoc, AsVariableDeclaration, AsTypeOperatorNode, AsMappedTypeNode, AsConstructorDeclaration,
  AsImportClause, AsGetAccessorDeclaration, AsSetAccessorDeclaration, AsIndexSignatureDeclaration, AsJsxNamespacedName, AsBindingElement, AsElementAccessExpression,
} from "../ast/generated/casts.js";
import {
  IsIdentifier, IsForInStatement, IsForOfStatement, IsBinaryExpression, IsPropertyAccessExpression, IsCallExpression, IsParenthesizedExpression, IsExpressionWithTypeArguments,
  IsNonNullExpression, IsArrowFunction as IsArrowFunctionPred, IsClassStaticBlockDeclaration, IsAwaitExpression, IsPrefixUnaryExpression, IsLiteralTypeNode, IsTypeLiteralNode,
  IsPropertySignatureDeclaration, IsJSTypeAliasDeclaration, IsSpreadElement, IsJsxNamespacedName, IsMethodDeclaration, IsElementAccessExpression, IsForStatement,
  IsBlock, IsVariableStatement, IsPropertyDeclaration, IsCaseClause, IsDefaultClause, IsStringLiteral, IsArrayLiteralExpression, IsObjectLiteralExpression, IsComputedPropertyName,
  IsDecorator, IsInterfaceDeclaration, IsCallSignatureDeclaration, IsConstructSignatureDeclaration, IsMethodSignatureDeclaration, IsFunctionTypeNode, IsConstructorTypeNode,
} from "../ast/generated/predicates.js";
import {
  ModifierFlagsNone, ModifierFlagsExport, ModifierFlagsAbstract, ModifierFlagsAmbient, ModifierFlagsStatic, ModifierFlagsAccessor, ModifierFlagsAsync, ModifierFlagsDefault,
  ModifierFlagsConst, ModifierFlagsIn, ModifierFlagsOut, ModifierFlagsDecorator, ModifierFlagsOverride, ModifierFlagsReadonly, ModifierFlagsPrivate, ModifierFlagsPublic, ModifierFlagsProtected,
  ModifierFlagsAccessibilityModifier, ModifierFlagsParameterPropertyModifier, ModifierFlagsExportDefault, ModifierFlagsModifier, ModifierToFlag,
} from "../ast/modifierflags.js";
import type { ModifierFlags } from "../ast/modifierflags.js";
import {
  NodeFlagsAmbient, NodeFlagsAwaitContext, NodeFlagsYieldContext, NodeFlagsOptionalChain, NodeFlagsReparsed, NodeFlagsConst, NodeFlagsUsing, NodeFlagsAwaitUsing, NodeFlagsBlockScoped, NodeFlagsLet, NodeFlagsJSDoc,
} from "../ast/generated/flags.js";
import type { NodeFlags } from "../ast/generated/flags.js";
import { NewDiagnostic } from "../ast/diagnostic.js";
import { Diagnostic_AddRelatedInfo, Diagnostic_SetSkippedOnNoEmit } from "../ast/diagnostic.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import { NewTextRange } from "../core/text.js";
import { GetRangeOfTokenAtPosition, SkipTrivia, GetECMALineOfPosition, TokenToString } from "../scanner/scanner.js";
import { GetTextOfNode } from "../scanner/utilities.js";
import { GetErrorRangeForNode } from "../scanner/scanner.js";
import { FindUseStrictPrologue } from "../binder/binder.js";
import { Find, LastOrNil, Filter, Some } from "../core/core.js";
import { Node_Expression, Node_Body, SourceFile_Text, SourceFile_ECMALineMap } from "../ast/ast.js";
import { GetContainingClass, IsExpressionNode, IsModifier, NodeIsPresent, IsThisParameter, IsPrivateIdentifierClassElementDeclaration, NewHasFileName } from "../ast/utilities.js";
import { NodeFlagsNone } from "../ast/generated/flags.js";
import { TSTrue } from "../core/tristate.js";
import { NewScanner, Scanner_SetScriptTarget, Scanner_SetLanguageVariant, Scanner_SetOnError, Scanner_SetText, Scanner_ResetTokenState, Scanner_Scan, Scanner_ReScanSlashToken } from "../scanner/scanner.js";
import type { Scanner, ErrorCallback } from "../scanner/scanner.js";
import { CategoryMessage, Message_Category } from "../diagnostics/diagnostics.js";
import {
  A_0_modifier_cannot_be_used_with_an_import_declaration,
  A_bigint_literal_cannot_be_used_as_a_property_name,
  A_break_statement_can_only_be_used_within_an_enclosing_iteration_or_switch_statement,
  A_break_statement_can_only_jump_to_a_label_of_an_enclosing_statement,
  Abstract_methods_can_only_appear_within_an_abstract_class,
  Abstract_properties_can_only_appear_within_an_abstract_class,
  Accessibility_modifier_already_seen,
  A_class_member_cannot_have_the_0_keyword,
  A_comma_expression_is_not_allowed_in_a_computed_property_name,
  A_computed_property_name_in_a_class_property_declaration_must_have_a_simple_literal_type_or_a_unique_symbol_type,
  A_computed_property_name_in_a_method_overload_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type,
  A_computed_property_name_in_an_ambient_context_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type,
  A_computed_property_name_in_an_interface_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type,
  A_computed_property_name_in_a_type_literal_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type,
  A_const_initializer_in_an_ambient_context_must_be_a_string_or_numeric_literal_or_literal_enum_reference,
  A_continue_statement_can_only_be_used_within_an_enclosing_iteration_statement,
  A_continue_statement_can_only_jump_to_a_label_of_an_enclosing_iteration_statement,
  A_declare_modifier_cannot_be_used_in_an_already_ambient_context,
  A_decorator_can_only_decorate_a_method_implementation_not_an_overload,
  A_default_export_can_only_be_used_in_an_ECMAScript_style_module,
  A_definite_assignment_assertion_is_not_permitted_in_this_context,
  A_destructuring_declaration_must_have_an_initializer,
  A_get_accessor_cannot_have_parameters,
  A_mapped_type_may_not_declare_properties_or_methods,
  An_abstract_accessor_cannot_have_an_implementation,
  An_accessibility_modifier_cannot_be_used_with_a_private_identifier,
  An_accessor_cannot_have_type_parameters,
  An_accessor_property_cannot_be_declared_optional,
  An_implementation_cannot_be_declared_in_ambient_contexts,
  An_index_signature_cannot_have_a_rest_parameter,
  An_index_signature_cannot_have_a_trailing_comma,
  An_index_signature_must_have_a_type_annotation,
  An_index_signature_must_have_exactly_one_parameter,
  An_index_signature_parameter_cannot_have_an_accessibility_modifier,
  An_index_signature_parameter_cannot_have_an_initializer,
  An_index_signature_parameter_cannot_have_a_question_mark,
  An_index_signature_parameter_must_have_a_type_annotation,
  An_index_signature_parameter_type_cannot_be_a_literal_type_or_generic_type_Consider_using_a_mapped_object_type_instead,
  An_index_signature_parameter_type_must_be_string_number_symbol_or_a_template_literal_type,
  An_interface_property_cannot_have_an_initializer,
  An_object_literal_cannot_have_multiple_get_Slashset_accessors_with_the_same_name,
  An_object_literal_cannot_have_multiple_properties_with_the_same_name,
  An_object_literal_cannot_have_property_and_accessor_with_the_same_name,
  An_object_member_cannot_be_declared_optional,
  An_overload_signature_cannot_be_declared_as_a_generator,
  A_parameter_property_cannot_be_declared_using_a_rest_parameter,
  A_parameter_property_may_not_be_declared_using_a_binding_pattern,
  A_property_of_a_class_whose_type_is_a_unique_symbol_type_must_be_both_static_and_readonly,
  A_property_of_an_interface_or_type_literal_whose_type_is_a_unique_symbol_type_must_be_readonly,
  A_required_parameter_cannot_follow_an_optional_parameter,
  A_rest_element_cannot_contain_a_binding_pattern,
  A_rest_element_cannot_have_an_initializer,
  A_rest_element_cannot_have_a_property_name,
  A_rest_element_must_be_last_in_a_destructuring_pattern,
  A_rest_parameter_cannot_be_optional,
  A_rest_parameter_cannot_have_an_initializer,
  A_rest_parameter_must_be_last_in_a_parameter_list,
  A_rest_parameter_or_binding_pattern_may_not_have_a_trailing_comma,
  Argument_of_dynamic_import_cannot_be_spread_element,
  A_set_accessor_cannot_have_an_optional_parameter,
  A_set_accessor_cannot_have_a_return_type_annotation,
  A_set_accessor_cannot_have_rest_parameter,
  A_set_accessor_must_have_exactly_one_parameter,
  A_set_accessor_parameter_cannot_have_an_initializer,
  A_top_level_export_modifier_cannot_be_used_on_value_declarations_in_a_CommonJS_module_when_verbatimModuleSyntax_is_enabled,
  A_type_literal_property_cannot_have_an_initializer,
  A_type_only_import_can_specify_a_default_import_or_named_bindings_but_not_both,
  A_variable_whose_type_is_a_unique_symbol_type_must_be_const,
  A_yield_expression_is_only_allowed_in_a_generator_body,
  BigInt_literals_are_not_available_when_targeting_lower_than_ES2020,
  Cannot_find_name_0,
  Classes_can_only_extend_a_single_class,
  Classes_may_not_have_a_field_named_constructor,
  Declarations_with_definite_assignment_assertions_must_also_have_type_annotations,
  Declarations_with_initializers_cannot_also_have_definite_assignment_assertions,
  Decorators_are_not_valid_here,
  Decorators_cannot_be_applied_to_multiple_get_Slashset_accessors_of_the_same_name,
  Decorators_may_not_appear_after_export_or_export_default_if_they_also_appear_before_export,
  Decorator_used_before_export_here,
  Expression_must_be_enclosed_in_parentheses_to_be_used_as_a_decorator,
  Invalid_syntax_in_decorator,
  Modifiers_cannot_appear_here,
  Neither_decorators_nor_modifiers_may_be_applied_to_this_parameters,
  Non_simple_parameter_declared_here,
  Private_identifiers_are_not_allowed_outside_class_bodies,
  Private_identifiers_are_only_allowed_in_class_bodies_and_may_only_be_used_as_part_of_a_class_member_declaration_property_access_or_on_the_left_hand_side_of_an_in_expression,
  React_components_cannot_include_JSX_namespace_names,
  Statements_are_not_allowed_in_ambient_contexts,
  Tagged_template_expressions_are_not_permitted_in_an_optional_chain,
  The_current_file_is_a_CommonJS_module_and_cannot_use_await_at_the_top_level,
  The_left_hand_side_of_a_for_in_statement_cannot_be_an_await_using_declaration,
  The_left_hand_side_of_a_for_in_statement_cannot_be_a_using_declaration,
  The_left_hand_side_of_a_for_in_statement_cannot_use_a_type_annotation,
  The_left_hand_side_of_a_for_of_statement_cannot_use_a_type_annotation,
  The_left_hand_side_of_a_for_of_statement_may_not_be_async,
  The_type_modifier_cannot_be_used_on_a_named_export_when_export_type_is_used_on_its_export_statement,
  The_type_modifier_cannot_be_used_on_a_named_import_when_import_type_is_used_on_its_import_statement,
  The_variable_declaration_of_a_for_in_statement_cannot_have_an_initializer,
  The_variable_declaration_of_a_for_of_statement_cannot_have_an_initializer,
  This_parameter_is_not_allowed_with_use_strict_directive,
  This_syntax_is_reserved_in_files_with_the_mts_or_cts_extension_Add_a_trailing_comma_or_explicit_constraint,
  This_use_of_import_is_invalid_import_calls_can_be_written_but_they_must_have_parentheses_and_cannot_have_type_arguments,
  Top_level_await_expressions_are_only_allowed_when_the_module_option_is_set_to_es2022_esnext_system_node16_node18_node20_nodenext_or_preserve_and_the_target_option_is_set_to_es2017_or_higher,
  Top_level_await_using_statements_are_only_allowed_when_the_module_option_is_set_to_es2022_esnext_system_node16_node18_node20_nodenext_or_preserve_and_the_target_option_is_set_to_es2017_or_higher,
  Top_level_declarations_in_d_ts_files_must_start_with_either_a_declare_or_export_modifier,
  Top_level_for_await_loops_are_only_allowed_when_the_module_option_is_set_to_es2022_esnext_system_node16_node18_node20_nodenext_or_preserve_and_the_target_option_is_set_to_es2017_or_higher,
  Trailing_comma_not_allowed,
  Type_annotation_cannot_appear_on_a_constructor_declaration,
  Type_argument_list_cannot_be_empty,
  Type_parameter_list_cannot_be_empty,
  Type_parameters_cannot_appear_on_a_constructor_declaration,
  Variable_declaration_list_cannot_be_empty,
  X_0_declarations_can_only_be_declared_inside_a_block,
  X_0_declarations_may_not_have_binding_patterns,
  X_0_declarations_must_be_initialized,
  X_0_expected,
  X_0_is_not_a_valid_meta_property_for_keyword_1_Did_you_mean_2,
  X_0_is_not_a_valid_meta_property_for_keyword_import_Did_you_mean_meta_or_defer,
  X_0_list_cannot_be_empty,
  X_0_modifier_already_seen,
  X_0_modifier_cannot_appear_on_a_constructor_declaration,
  X_0_modifier_cannot_appear_on_a_module_or_namespace_element,
  X_0_modifier_cannot_appear_on_an_await_using_declaration,
  X_0_modifier_cannot_appear_on_an_index_signature,
  X_0_modifier_cannot_appear_on_a_parameter,
  X_0_modifier_cannot_appear_on_a_type_member,
  X_0_modifier_cannot_appear_on_a_type_parameter,
  X_0_modifier_cannot_appear_on_a_using_declaration,
  X_0_modifier_cannot_appear_on_class_elements_of_this_kind,
  X_0_modifier_cannot_be_used_here,
  X_0_modifier_cannot_be_used_in_an_ambient_context,
  X_0_modifier_cannot_be_used_with_1_modifier,
  X_0_modifier_cannot_be_used_with_a_private_identifier,
  X_0_modifier_can_only_appear_on_a_type_parameter_of_a_class_interface_or_type_alias,
  X_0_modifier_can_only_appear_on_a_type_parameter_of_a_function_method_or_class,
  X_0_modifier_must_precede_1_modifier,
  X_abstract_modifier_can_only_appear_on_a_class_method_or_property_declaration,
  X_accessor_modifier_can_only_appear_on_a_property_declaration,
  X_and_here,
  X_await_expression_cannot_be_used_inside_a_class_static_block,
  X_await_expressions_are_only_allowed_at_the_top_level_of_a_file_when_that_file_is_a_module_but_this_file_has_no_imports_or_exports_Consider_adding_an_empty_export_to_make_this_file_a_module,
  X_await_expressions_are_only_allowed_within_async_functions_and_at_the_top_levels_of_modules,
  X_await_expressions_cannot_be_used_in_a_parameter_initializer,
  X_await_using_declarations_are_not_allowed_in_ambient_contexts,
  X_await_using_declarations_are_not_allowed_in_case_or_default_clauses_unless_contained_within_a_block,
  X_await_using_statements_are_only_allowed_at_the_top_level_of_a_file_when_that_file_is_a_module_but_this_file_has_no_imports_or_exports_Consider_adding_an_empty_export_to_make_this_file_a_module,
  X_await_using_statements_are_only_allowed_within_async_functions_and_at_the_top_levels_of_modules,
  X_await_using_statements_cannot_be_used_inside_a_class_static_block,
  X_extends_clause_already_seen,
  X_extends_clause_must_precede_implements_clause,
  X_for_await_loops_are_only_allowed_at_the_top_level_of_a_file_when_that_file_is_a_module_but_this_file_has_no_imports_or_exports_Consider_adding_an_empty_export_to_make_this_file_a_module,
  X_for_await_loops_are_only_allowed_within_async_functions_and_at_the_top_levels_of_modules,
  X_implements_clause_already_seen,
  X_let_is_not_allowed_to_be_used_as_a_name_in_let_or_const_declarations,
  X_readonly_modifier_can_only_appear_on_a_property_declaration_or_index_signature,
  X_readonly_type_modifier_is_only_permitted_on_array_and_tuple_literal_types,
  X_unique_symbol_types_are_not_allowed_here,
  X_unique_symbol_types_are_only_allowed_on_variables_in_a_variable_statement,
  X_unique_symbol_types_may_not_be_used_on_a_variable_declaration_with_a_binding_name,
  X_use_strict_directive_cannot_be_used_with_non_simple_parameter_list,
  X_use_strict_directive_used_here,
  X_using_declarations_are_not_allowed_in_ambient_contexts,
  X_using_declarations_are_not_allowed_in_case_or_default_clauses_unless_contained_within_a_block,
  X_yield_expressions_cannot_be_used_in_a_parameter_initializer,
} from "../diagnostics/generated/messages.js";
import { Diagnostic_Pos, Diagnostic_Len, Diagnostic_Category } from "../ast/diagnostic.js";
import { Assert } from "../debug/debug.js";
import type { AccessorDeclaration, ClassLikeDeclaration, DeclarationName, Expression, JsxTagNameExpression, Statement, TokenNode } from "../ast/generated/unions.js";
import type { Message } from "../diagnostics/diagnostics.js";
import type { Checker } from "./checker/state.js";
import {
  DeclarationMeaningGetAccessor, DeclarationMeaningSetAccessor, DeclarationMeaningPropertyAssignment, DeclarationMeaningMethod, DeclarationMeaningGetOrSetAccessor,
  someType, everyType,
  type DeclarationMeaning,
  createDiagnosticForNode,
} from "./checker/state.js";
import { Checker_addDiagnostic } from "./checker.js";
import { Checker_error } from "./checker/support.js";
import { Checker_hasParseDiagnostics } from "./checker/diagnostics.js";
import { Checker_addErrorOrSuggestion } from "./checker/diagnostics.js";
import { Checker_getSymbolForPrivateIdentifierExpression, Checker_getSymbolOfDeclaration, Checker_isLateBindableName, Checker_getEffectivePropertyNameForPropertyNameNode, Checker_isValidIndexKeyType } from "./checker/symbols.js";
import { Checker_getTypeFromTypeNode, Checker_isGenericType } from "./checker/types.js";
import { Checker_getCombinedNodeFlagsCached, Checker_checkExpressionCached } from "./checker/syntax-checking.js";
import { Checker_isInParameterInitializerBeforeContainingFunction, Checker_getAccessorThisParameter } from "./checker/signatures.js";
import { getContainingFunctionOrClassStaticBlock, isOptionalDeclaration, isDeclarationReadonly, isVariableDeclarationInVariableStatement, GetSetAccessorValueParameter } from "./utilities.js";
import { isRestParameter, getVerbatimModuleSyntaxErrorMessage } from "./checker/state.js";
import { Checker_isVarConstLike } from "./checker/support-queries.js";
import { visibilityToString } from "./relater.js";
import { ScriptTargetES2016, ScriptTargetES2017, ScriptTargetES2020 } from "../core/compileroptions.js";
import { ModuleKindNode16, ModuleKindNode18, ModuleKindNode20, ModuleKindNodeNext, ModuleKindES2022, ModuleKindESNext, ModuleKindPreserve, ModuleKindSystem, ModuleKindCommonJS, ModuleKindES2015 } from "../core/compileroptions.js";
import { IsAccessor, IsFunctionLike, WalkUpParenthesizedTypes, IsStatic } from "../ast/utilities.js";
import { IsDeclarationNode, IsTypeOrJSTypeAliasDeclaration } from "../ast/ast.js";
import { hasAsyncModifier, hasReadonlyModifier } from "./utilities.js";
import { FunctionFlagsAsync, GetFunctionFlags } from "../ast/functionflags.js";
import { Node_Text, Node_ElementList, Node_IsTypeOnly, Node_TypeParameterList, Node_Initializer, SourceFile_Path, Node_Members, Node_Elements } from "../ast/ast.js";
import { IsIntrinsicJsxName } from "../scanner/utilities.js";
import { CompilerOptions_GetJSXTransformEnabled } from "../core/compileroptions.js";
import { LinkStore_Get } from "../core/linkstore.js";
import type { NodeLinks, Type } from "./types.js";
import { TypeFlagsStringOrNumberLiteralOrUnique, TypeFlagsEnumLike } from "./types.js";
import { FromString } from "../jsnum/string.js";
import { MaxSafeInteger } from "../jsnum/jsnum.js";
import { TokenFlagsScientific } from "../ast/tokenflags.js";
import { IfElse } from "../core/core.js";
import {
  KindIfStatement, KindDoStatement, KindWhileStatement, KindWithStatement, KindForStatement,
} from "../ast/generated/kinds.js";
import { AsPrefixUnaryExpression, AsPropertySignatureDeclaration, AsTypeParameterDeclaration } from "../ast/generated/casts.js";
import { FileExtensionIsOneOf, ExtensionMts, ExtensionCts } from "../tspath/extension.js";
import { SourceFile_FileName } from "../ast/ast.js";
import {
  Only_a_single_variable_declaration_is_allowed_in_a_for_in_statement,
  Only_a_single_variable_declaration_is_allowed_in_a_for_of_statement,
  Interface_declaration_cannot_have_implements_clause,
  Did_you_mean_to_use_a_Colon_An_can_only_follow_a_property_name_when_the_containing_object_literal_is_part_of_a_destructuring_pattern,
  Dynamic_imports_are_only_supported_when_the_module_flag_is_set_to_es2020_es2022_esnext_commonjs_amd_system_umd_node16_node18_node20_or_nodenext,
  Did_you_mean_to_mark_this_function_as_async,
  JSX_elements_cannot_have_multiple_attributes_with_the_same_name,
  JSX_attributes_must_only_be_assigned_a_non_empty_expression,
  JSX_property_access_expressions_cannot_include_JSX_namespace_names,
  JSX_expressions_may_not_use_the_comma_operator_Did_you_mean_to_write_an_array,
  Default_imports_are_not_allowed_in_a_deferred_import,
  Named_imports_are_not_allowed_in_a_deferred_import,
  Deferred_imports_are_only_supported_when_the_module_flag_is_set_to_esnext_or_preserve,
  Numeric_literals_with_absolute_values_equal_to_2_53_or_greater_are_too_large_to_be_represented_accurately_as_integers,
  Dynamic_imports_can_only_accept_a_module_specifier_and_an_optional_set_of_attributes_as_arguments,
  Dynamic_imports_only_support_a_second_argument_when_the_module_option_is_set_to_esnext_node16_node18_node20_nodenext_or_preserve,
  Parameter_cannot_have_question_mark_and_initializer,
  Line_terminator_not_permitted_before_arrow,
  JSDoc_0_1_does_not_match_the_extends_2_clause,
  Generators_are_not_allowed_in_an_ambient_context,
  Jump_target_cannot_cross_function_boundary,
  Identifier_expected_esModule_is_reserved_as_an_exported_marker_when_transforming_ECMAScript_modules,
  Duplicate_identifier_0,
  Initializers_are_not_allowed_in_ambient_contexts,
} from "../diagnostics/generated/messages.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.grammarErrorOnFirstToken","kind":"method","status":"implemented","sigHash":"9fab30665e440946aaaa3690f3b401ad23c823e57bb21da03bf92c49f43e9680","bodyHash":"142efb60e8b3a9257a937d0286695747aab58d7ed2ce3ce7538c4a22b21c9e7f"}
 *
 * Go source:
 * func (c *Checker) grammarErrorOnFirstToken(node *ast.Node, message *diagnostics.Message, args ...any) bool {
 * 	sourceFile := ast.GetSourceFileOfNode(node)
 * 	if !c.hasParseDiagnostics(sourceFile) {
 * 		span := scanner.GetRangeOfTokenAtPosition(sourceFile, node.Pos())
 * 		c.addDiagnostic(ast.NewDiagnostic(sourceFile, span, message, args...))
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Checker_grammarErrorOnFirstToken(receiver: GoPtr<Checker>, node: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): bool {
  const sourceFile = GetSourceFileOfNode(node);
  if (!Checker_hasParseDiagnostics(receiver, sourceFile)) {
    const span = GetRangeOfTokenAtPosition(sourceFile, Node_Pos(node));
    Checker_addDiagnostic(receiver, NewDiagnostic(sourceFile, span, message, ...args));
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.grammarErrorAtPos","kind":"method","status":"implemented","sigHash":"8b49203060ee9b54ed6bbb3f858296d437cd8203a72d494dfc10f2d805cb959d","bodyHash":"59cc0362e260ec4f12e2dca742d871b7351d3bd98c1fbbe8ee4e013d1149027c"}
 *
 * Go source:
 * func (c *Checker) grammarErrorAtPos(nodeForSourceFile *ast.Node, start int, length int, message *diagnostics.Message, args ...any) bool {
 * 	sourceFile := ast.GetSourceFileOfNode(nodeForSourceFile)
 * 	if !c.hasParseDiagnostics(sourceFile) {
 * 		c.addDiagnostic(ast.NewDiagnostic(sourceFile, core.NewTextRange(start, start+length), message, args...))
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Checker_grammarErrorAtPos(receiver: GoPtr<Checker>, nodeForSourceFile: GoPtr<Node>, start: int, length: int, message: GoPtr<Message>, ...args: Array<unknown>): bool {
  const sourceFile = GetSourceFileOfNode(nodeForSourceFile);
  if (!Checker_hasParseDiagnostics(receiver, sourceFile)) {
    Checker_addDiagnostic(receiver, NewDiagnostic(sourceFile, NewTextRange(start, start + length), message, ...args));
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.grammarErrorOnNode","kind":"method","status":"implemented","sigHash":"ee108f85250864c3b912ab817057387d981bc8ae5e9065d4b53bd0a6da485184","bodyHash":"db87fbbdbc3b4ade27dd599f8ceebe4b7a640774be6ff6354c4a30698431930b"}
 *
 * Go source:
 * func (c *Checker) grammarErrorOnNode(node *ast.Node, message *diagnostics.Message, args ...any) bool {
 * 	sourceFile := ast.GetSourceFileOfNode(node)
 * 	if !c.hasParseDiagnostics(sourceFile) {
 * 		c.error(node, message, args...)
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Checker_grammarErrorOnNode(receiver: GoPtr<Checker>, node: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): bool {
  const sourceFile = GetSourceFileOfNode(node);
  if (!Checker_hasParseDiagnostics(receiver, sourceFile)) {
    Checker_error(receiver, node, message, ...args);
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.grammarErrorOnNodeSkippedOnNoEmit","kind":"method","status":"implemented","sigHash":"d85ab3e5c9bf0b30f14ca2a447d4ad20abc51d82e5d5e16bfee84687488e39a1","bodyHash":"cfdfa06c00fbe02656001b8f1b84371e007b1efe70a2cca83f55b6b74d7c98c6"}
 *
 * Go source:
 * func (c *Checker) grammarErrorOnNodeSkippedOnNoEmit(node *ast.Node, message *diagnostics.Message, args ...any) bool {
 * 	sourceFile := ast.GetSourceFileOfNode(node)
 * 	if !c.hasParseDiagnostics(sourceFile) {
 * 		d := NewDiagnosticForNode(node, message, args...)
 * 		d.SetSkippedOnNoEmit()
 * 		c.addDiagnostic(d)
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Checker_grammarErrorOnNodeSkippedOnNoEmit(receiver: GoPtr<Checker>, node: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): bool {
  const sourceFile = GetSourceFileOfNode(node);
  if (!Checker_hasParseDiagnostics(receiver, sourceFile)) {
    const d = createDiagnosticForNode(node, message, ...args);
    Diagnostic_SetSkippedOnNoEmit(d);
    Checker_addDiagnostic(receiver, d);
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::func::getIdentifierFromEntityNameExpression","kind":"func","status":"implemented","sigHash":"8cd61adabde4b427cda31e169dd32215b90d9a9ffaf010147f3a612299dd9a1e","bodyHash":"29fbafc34d60a746146ba9457cfd5ef0e73f2ca96dfa4735bc2b831ef03646bd"}
 *
 * Go source:
 * func getIdentifierFromEntityNameExpression(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		return node
 * 	case ast.KindPropertyAccessExpression:
 * 		return node.AsPropertyAccessExpression().Name()
 * 	default:
 * 		return nil
 * 	}
 * }
 */
export function getIdentifierFromEntityNameExpression(node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindIdentifier:
      return node;
    case KindPropertyAccessExpression:
      return PropertyAccessExpression_Name(AsPropertyAccessExpression(node));
    default:
      return undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarRegularExpressionLiteral","kind":"method","status":"implemented","sigHash":"57120ea3bf3998113239125e5b090db84b7f166cd36c4e71b46f4bd1f0775144","bodyHash":"b94fb259392899e1350c7a3ac731dd31ff7cfd8d896e53334dc1c50fa8302f54"}
 *
 * Go source:
 * func (c *Checker) checkGrammarRegularExpressionLiteral(node *ast.RegularExpressionLiteral) bool {
 * 	sourceFile := ast.GetSourceFileOfNode(node.AsNode())
 * 	if !c.hasParseDiagnostics(sourceFile) {
 * 		var lastError *ast.Diagnostic
 * 		if c.regExpScanner == nil {
 * 			c.regExpScanner = scanner.NewScanner()
 * 		}
 * 		c.regExpScanner.SetScriptTarget(c.languageVersion)
 * 		c.regExpScanner.SetLanguageVariant(sourceFile.LanguageVariant)
 * 		c.regExpScanner.SetOnError(func(message *diagnostics.Message, start int, length int, args ...any) {
 * 			if message.Category() == diagnostics.CategoryMessage && lastError != nil && start == lastError.Pos() && length == lastError.Len() {
 * 				// For providing spelling suggestions.
 * 				err := ast.NewDiagnostic(nil, core.NewTextRange(start, start+length), message, args...)
 * 				lastError.AddRelatedInfo(err)
 * 			} else if lastError == nil || start != lastError.Pos() {
 * 				lastError = ast.NewDiagnostic(sourceFile, core.NewTextRange(start, start+length), message, args...)
 * 				c.addDiagnostic(lastError)
 * 			}
 * 		})
 * 		c.regExpScanner.SetText(sourceFile.Text())
 * 		c.regExpScanner.ResetTokenState(node.AsNode().Pos())
 * 		c.regExpScanner.Scan()
 * 		tokenIsRegularExpressionLiteral := c.regExpScanner.ReScanSlashToken(true) == ast.KindRegularExpressionLiteral
 * 		c.regExpScanner.SetText("")
 * 		c.regExpScanner.SetOnError(nil)
 * 		debug.Assert(tokenIsRegularExpressionLiteral)
 * 		return lastError != nil
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarRegularExpressionLiteral(receiver: GoPtr<Checker>, node: GoPtr<RegularExpressionLiteral>): bool {
  const sourceFile = GetSourceFileOfNode(node as unknown as GoPtr<Node>);
  if (!Checker_hasParseDiagnostics(receiver, sourceFile)) {
    let lastError: GoPtr<Diagnostic> = undefined;
    if (receiver!.regExpScanner === undefined) {
      receiver!.regExpScanner = NewScanner();
    }
    Scanner_SetScriptTarget(receiver!.regExpScanner, receiver!.languageVersion);
    Scanner_SetLanguageVariant(receiver!.regExpScanner, sourceFile!.LanguageVariant);
    Scanner_SetOnError(receiver!.regExpScanner, (message: GoPtr<Message>, start: int, length: int, ...args: Array<unknown>): void => {
      if (Message_Category(message) === CategoryMessage && lastError !== undefined && start === Diagnostic_Pos(lastError) && length === Diagnostic_Len(lastError)) {
        const err = NewDiagnostic(undefined, NewTextRange(start, start + length), message, ...args);
        Diagnostic_AddRelatedInfo(lastError, err);
      } else if (lastError === undefined || start !== Diagnostic_Pos(lastError)) {
        lastError = NewDiagnostic(sourceFile, NewTextRange(start, start + length), message, ...args);
        Checker_addDiagnostic(receiver, lastError);
      }
    });
    Scanner_SetText(receiver!.regExpScanner, SourceFile_Text(sourceFile));
    Scanner_ResetTokenState(receiver!.regExpScanner, Node_Pos(node as unknown as GoPtr<Node>));
    Scanner_Scan(receiver!.regExpScanner);
    const tokenIsRegularExpressionLiteral = Scanner_ReScanSlashToken(receiver!.regExpScanner, true) === KindRegularExpressionLiteral;
    Scanner_SetText(receiver!.regExpScanner, "");
    Scanner_SetOnError(receiver!.regExpScanner, undefined as unknown as ErrorCallback);
    Assert(tokenIsRegularExpressionLiteral);
    return lastError !== undefined;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarPrivateIdentifierExpression","kind":"method","status":"implemented","sigHash":"47ff992c397ba40a5b8609d0dda1c5fb41ec1657be9c67a6ff7616fd8d186e5d","bodyHash":"cb04324c4ec48279d8931c691d389b3cb26f8f68a870f798a4a6ac8ab9ea1e8f"}
 *
 * Go source:
 * func (c *Checker) checkGrammarPrivateIdentifierExpression(privId *ast.PrivateIdentifier) bool {
 * 	privIdAsNode := privId.AsNode()
 * 	if ast.GetContainingClass(privId.AsNode()) == nil {
 * 		return c.grammarErrorOnNode(privId.AsNode(), diagnostics.Private_identifiers_are_not_allowed_outside_class_bodies)
 * 	}
 * 
 * 	if !ast.IsForInStatement(privId.Parent) {
 * 		if !ast.IsExpressionNode(privIdAsNode) {
 * 			return c.grammarErrorOnNode(privIdAsNode, diagnostics.Private_identifiers_are_only_allowed_in_class_bodies_and_may_only_be_used_as_part_of_a_class_member_declaration_property_access_or_on_the_left_hand_side_of_an_in_expression)
 * 		}
 * 
 * 		isInOperation := ast.IsBinaryExpression(privId.Parent) && privId.Parent.AsBinaryExpression().OperatorToken.Kind == ast.KindInKeyword
 * 		if c.getSymbolForPrivateIdentifierExpression(privIdAsNode) == nil && !isInOperation {
 * 			return c.grammarErrorOnNode(privIdAsNode, diagnostics.Cannot_find_name_0, privId.Text)
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarPrivateIdentifierExpression(receiver: GoPtr<Checker>, privId: GoPtr<PrivateIdentifier>): bool {
  const privIdAsNode = privId as unknown as GoPtr<Node>;
  if (GetContainingClass(privId as unknown as GoPtr<Node>) === undefined) {
    return Checker_grammarErrorOnNode(receiver, privId as unknown as GoPtr<Node>, Private_identifiers_are_not_allowed_outside_class_bodies);
  }
  if (!IsForInStatement(privId!.Parent)) {
    if (!IsExpressionNode(privIdAsNode)) {
      return Checker_grammarErrorOnNode(receiver, privIdAsNode, Private_identifiers_are_only_allowed_in_class_bodies_and_may_only_be_used_as_part_of_a_class_member_declaration_property_access_or_on_the_left_hand_side_of_an_in_expression);
    }
    const isInOperation = IsBinaryExpression(privId!.Parent) && AsBinaryExpression(privId!.Parent)!.OperatorToken!.Kind === KindInKeyword;
    if (Checker_getSymbolForPrivateIdentifierExpression(receiver, privIdAsNode) === undefined && !isInOperation) {
      return Checker_grammarErrorOnNode(receiver, privIdAsNode, Cannot_find_name_0, privId!.Text);
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarMappedType","kind":"method","status":"implemented","sigHash":"0c99c1956e7a2ff074ca723b0db27e809059f504cfdbfcca714d3c5f970a0afb","bodyHash":"66c32a878418ccbca7e1273a575598ef9ad0c20bb13b85ffe73aaed691ecaed9"}
 *
 * Go source:
 * func (c *Checker) checkGrammarMappedType(node *ast.MappedTypeNode) bool {
 * 	if len(node.Members.Nodes) > 0 {
 * 		return c.grammarErrorOnNode(node.Members.Nodes[0], diagnostics.A_mapped_type_may_not_declare_properties_or_methods)
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarMappedType(receiver: GoPtr<Checker>, node: GoPtr<MappedTypeNode>): bool {
  if (node!.Members!.Nodes.length > 0) {
    return Checker_grammarErrorOnNode(receiver, node!.Members!.Nodes[0]!, A_mapped_type_may_not_declare_properties_or_methods);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarDecorator","kind":"method","status":"implemented","sigHash":"ce61e354e9b9e38bfb9698e86cf6908a2eb7ba402d80d474b2fe397f31d48013","bodyHash":"1ca27d975ba7ad3fb67b9f160f8327e06ecaff1354afab39847c778192b5e1fa"}
 *
 * Go source:
 * func (c *Checker) checkGrammarDecorator(decorator *ast.Decorator) bool {
 * 	sourceFile := ast.GetSourceFileOfNode(decorator.AsNode())
 * 	if !c.hasParseDiagnostics(sourceFile) {
 * 		node := decorator.Expression
 * 
 * 		// DecoratorParenthesizedExpression :
 * 		//   `(` Expression `)`
 * 
 * 		if ast.IsParenthesizedExpression(node) {
 * 			return false
 * 		}
 * 
 * 		canHaveCallExpression := true
 * 		var errorNode *ast.Node
 * 		for {
 * 			// Allow TS syntax such as non-null assertions and instantiation expressions
 * 			if ast.IsExpressionWithTypeArguments(node) || ast.IsNonNullExpression(node) {
 * 				node = node.Expression()
 * 				continue
 * 			}
 * 
 * 			// DecoratorCallExpression :
 * 			//   DecoratorMemberExpression Arguments
 * 
 * 			if ast.IsCallExpression(node) {
 * 				callExpr := node.AsCallExpression()
 * 				if !canHaveCallExpression {
 * 					errorNode = node
 * 				}
 * 				if callExpr.QuestionDotToken != nil {
 * 					// Even if we already have an error node, error at the `?.` token since it appears earlier.
 * 					errorNode = callExpr.QuestionDotToken
 * 				}
 * 				node = callExpr.Expression
 * 				canHaveCallExpression = false
 * 				continue
 * 			}
 * 
 * 			// DecoratorMemberExpression :
 * 			//   IdentifierReference
 * 			//   DecoratorMemberExpression `.` IdentifierName
 * 			//   DecoratorMemberExpression `.` PrivateIdentifier
 * 
 * 			if ast.IsPropertyAccessExpression(node) {
 * 				propertyAccessExpr := node.AsPropertyAccessExpression()
 * 				if propertyAccessExpr.QuestionDotToken != nil {
 * 					// Even if we already have an error node, error at the `?.` token since it appears earlier.
 * 					errorNode = propertyAccessExpr.QuestionDotToken
 * 				}
 * 				node = propertyAccessExpr.Expression
 * 				canHaveCallExpression = false
 * 				continue
 * 			}
 * 
 * 			if !ast.IsIdentifier(node) {
 * 				// Even if we already have an error node, error at this node since it appears earlier.
 * 				errorNode = node
 * 			}
 * 
 * 			break
 * 		}
 * 
 * 		if errorNode != nil {
 * 			err := c.error(decorator.Expression, diagnostics.Expression_must_be_enclosed_in_parentheses_to_be_used_as_a_decorator)
 * 			err.AddRelatedInfo(createDiagnosticForNode(errorNode, diagnostics.Invalid_syntax_in_decorator))
 * 			return true
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarDecorator(receiver: GoPtr<Checker>, decorator: GoPtr<Decorator>): bool {
  const sourceFile = GetSourceFileOfNode(decorator as unknown as GoPtr<Node>);
  if (!Checker_hasParseDiagnostics(receiver, sourceFile)) {
    let node: GoPtr<Node> = decorator!.Expression as unknown as GoPtr<Node>;

    if (IsParenthesizedExpression(node)) {
      return false;
    }

    let canHaveCallExpression = true;
    let errorNode: GoPtr<Node> = undefined;
    for (;;) {
      if (IsExpressionWithTypeArguments(node) || IsNonNullExpression(node)) {
        node = Node_Expression(node)!;
        continue;
      }
      if (IsCallExpression(node)) {
        const callExpr = AsCallExpression(node);
        if (!canHaveCallExpression) {
          errorNode = node;
        }
        if (callExpr!.QuestionDotToken !== undefined) {
          errorNode = callExpr!.QuestionDotToken as unknown as GoPtr<Node>;
        }
        node = callExpr!.Expression as unknown as GoPtr<Node>;
        canHaveCallExpression = false;
        continue;
      }
      if (IsPropertyAccessExpression(node)) {
        const propertyAccessExpr = AsPropertyAccessExpression(node);
        if (propertyAccessExpr!.QuestionDotToken !== undefined) {
          errorNode = propertyAccessExpr!.QuestionDotToken as unknown as GoPtr<Node>;
        }
        node = propertyAccessExpr!.Expression as unknown as GoPtr<Node>;
        canHaveCallExpression = false;
        continue;
      }
      if (!IsIdentifier(node)) {
        errorNode = node;
      }
      break;
    }

    if (errorNode !== undefined) {
      const err = Checker_error(receiver, decorator!.Expression as unknown as GoPtr<Node>, Expression_must_be_enclosed_in_parentheses_to_be_used_as_a_decorator);
      Diagnostic_AddRelatedInfo(err, createDiagnosticForNode(errorNode, Invalid_syntax_in_decorator));
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarExportDeclaration","kind":"method","status":"implemented","sigHash":"327154eaf4a7367d9bcb1af0ea0af81f5b6da8a0927c54e12e3a6103edd8f828","bodyHash":"9b6f7dc9b761e9e253f6a9cb42b3e22325824e775b0b5842dfebef69e5a51b77"}
 *
 * Go source:
 * func (c *Checker) checkGrammarExportDeclaration(node *ast.ExportDeclaration) bool {
 * 	if node.IsTypeOnly && node.ExportClause != nil && node.ExportClause.Kind == ast.KindNamedExports {
 * 		return c.checkGrammarTypeOnlyNamedImportsOrExports(node.ExportClause)
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarExportDeclaration(receiver: GoPtr<Checker>, node: GoPtr<ExportDeclaration>): bool {
  if (node!.IsTypeOnly && node!.ExportClause !== undefined && node!.ExportClause!.Kind === KindNamedExports) {
    return Checker_checkGrammarTypeOnlyNamedImportsOrExports(receiver, node!.ExportClause as unknown as GoPtr<Node>);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarModuleElementContext","kind":"method","status":"implemented","sigHash":"fa25520d01a571fa5f4d3dc97b44ec31ec02f1d401aad328a5f9d9331afcf22b","bodyHash":"cb7b62b7d603b95607c68f19892361245e0260dbb90df99ff5b18206617678d0"}
 *
 * Go source:
 * func (c *Checker) checkGrammarModuleElementContext(node *ast.Statement, errorMessage *diagnostics.Message) bool {
 * 	isInAppropriateContext := node.Parent.Kind == ast.KindSourceFile || node.Parent.Kind == ast.KindModuleBlock || node.Parent.Kind == ast.KindModuleDeclaration
 * 	if !isInAppropriateContext {
 * 		c.grammarErrorOnFirstToken(node, errorMessage)
 * 	}
 * 	return !isInAppropriateContext
 * }
 */
export function Checker_checkGrammarModuleElementContext(receiver: GoPtr<Checker>, node: GoPtr<Statement>, errorMessage: GoPtr<Message>): bool {
  const nodeAsNode = node as unknown as GoPtr<Node>;
  const isInAppropriateContext = nodeAsNode!.Parent!.Kind === KindSourceFile || nodeAsNode!.Parent!.Kind === KindModuleBlock || nodeAsNode!.Parent!.Kind === KindModuleDeclaration;
  if (!isInAppropriateContext) {
    Checker_grammarErrorOnFirstToken(receiver, nodeAsNode, errorMessage);
  }
  return !isInAppropriateContext;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarModifiers","kind":"method","status":"implemented","sigHash":"0b0425938eebf74bfdaf4333c96a425aea880ab0486e0c575ac1707e650b5099","bodyHash":"9b1548c4672ccb417b509ee7648b49911ff4ad73da38084033d56292e35c8c0f"}
 *
 * Go source:
 * func (c *Checker) checkGrammarModifiers(node *ast.Node /*Union[HasModifiers, HasDecorators, HasIllegalModifiers, HasIllegalDecorators]* /) bool {
 * 	if node.Modifiers() == nil {
 * 		return false
 * 	}
 * 	if c.reportObviousDecoratorErrors(node) || c.reportObviousModifierErrors(node) {
 * 		return true
 * 	}
 * 	if ast.IsThisParameter(node) {
 * 		return c.grammarErrorOnFirstToken(node, diagnostics.Neither_decorators_nor_modifiers_may_be_applied_to_this_parameters)
 * 	}
 * 	blockScopeKind := ast.NodeFlagsNone
 * 	if ast.IsVariableStatement(node) {
 * 		blockScopeKind = node.AsVariableStatement().DeclarationList.Flags & ast.NodeFlagsBlockScoped
 * 	}
 * 	var lastStatic *ast.Node
 * 	var lastDeclare *ast.Node
 * 	var lastAsync *ast.Node
 * 	var lastOverride *ast.Node
 * 	var firstDecorator *ast.Node
 * 	flags := ast.ModifierFlagsNone
 * 	sawExportBeforeDecorators := false
 * 	// We parse decorators and modifiers in four contiguous chunks:
 * 	// [...leadingDecorators, ...leadingModifiers, ...trailingDecorators, ...trailingModifiers]. It is an error to
 * 	// have both leading and trailing decorators.
 * 	hasLeadingDecorators := false
 * 	modifiers := node.ModifierNodes()
 * 	for _, modifier := range modifiers {
 * 		if ast.IsDecorator(modifier) {
 * 			if !ast.NodeCanBeDecorated(c.legacyDecorators, node, node.Parent, node.Parent.Parent) {
 * 				if node.Kind == ast.KindMethodDeclaration && !ast.NodeIsPresent(node.Body()) {
 * 					return c.grammarErrorOnFirstToken(node, diagnostics.A_decorator_can_only_decorate_a_method_implementation_not_an_overload)
 * 				} else {
 * 					return c.grammarErrorOnFirstToken(node, diagnostics.Decorators_are_not_valid_here)
 * 				}
 * 			} else if c.legacyDecorators && (node.Kind == ast.KindGetAccessor || node.Kind == ast.KindSetAccessor) {
 * 				accessors := ast.GetAllAccessorDeclarationsForDeclaration(node, c.getSymbolOfDeclaration(node).Declarations)
 * 				if ast.HasDecorators(accessors.FirstAccessor) && node == accessors.SecondAccessor {
 * 					return c.grammarErrorOnFirstToken(node, diagnostics.Decorators_cannot_be_applied_to_multiple_get_Slashset_accessors_of_the_same_name)
 * 				}
 * 			}
 * 
 * 			// if we've seen any modifiers aside from `export`, `default`, or another decorator, then this is an invalid position
 * 			if flags&^(ast.ModifierFlagsExportDefault|ast.ModifierFlagsDecorator) != 0 {
 * 				return c.grammarErrorOnNode(modifier, diagnostics.Decorators_are_not_valid_here)
 * 			}
 * 
 * 			// if we've already seen leading decorators and leading modifiers, then trailing decorators are an invalid position
 * 			if hasLeadingDecorators && flags&ast.ModifierFlagsModifier != 0 {
 * 				if firstDecorator == nil {
 * 					panic("Expected firstDecorator to be set")
 * 				}
 * 				sourceFile := ast.GetSourceFileOfNode(modifier)
 * 				if !c.hasParseDiagnostics(sourceFile) {
 * 					err := c.error(modifier, diagnostics.Decorators_may_not_appear_after_export_or_export_default_if_they_also_appear_before_export)
 * 					err.AddRelatedInfo(createDiagnosticForNode(firstDecorator, diagnostics.Decorator_used_before_export_here))
 * 					return true
 * 				}
 * 				return false
 * 			}
 * 
 * 			flags |= ast.ModifierFlagsDecorator
 * 
 * 			// if we have not yet seen a modifier, then these are leading decorators
 * 			if flags&ast.ModifierFlagsModifier == 0 {
 * 				hasLeadingDecorators = true
 * 			} else if flags&ast.ModifierFlagsExport != 0 {
 * 				sawExportBeforeDecorators = true
 * 			}
 * 
 * 			if firstDecorator == nil {
 * 				firstDecorator = modifier
 * 			}
 * 		} else {
 * 			if modifier.Kind != ast.KindReadonlyKeyword {
 * 				if node.Kind == ast.KindPropertySignature || node.Kind == ast.KindMethodSignature {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_type_member, scanner.TokenToString(modifier.Kind))
 * 				}
 * 				if node.Kind == ast.KindIndexSignature && (modifier.Kind != ast.KindStaticKeyword || !ast.IsClassLike(node.Parent)) {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_an_index_signature, scanner.TokenToString(modifier.Kind))
 * 				}
 * 			}
 * 			if modifier.Kind != ast.KindInKeyword && modifier.Kind != ast.KindOutKeyword && modifier.Kind != ast.KindConstKeyword {
 * 				if node.Kind == ast.KindTypeParameter {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_type_parameter, scanner.TokenToString(modifier.Kind))
 * 				}
 * 			}
 * 			switch modifier.Kind {
 * 			case ast.KindConstKeyword:
 * 				if node.Kind != ast.KindEnumDeclaration && node.Kind != ast.KindTypeParameter {
 * 					return c.grammarErrorOnNode(node, diagnostics.A_class_member_cannot_have_the_0_keyword, scanner.TokenToString(ast.KindConstKeyword))
 * 				}
 * 				parent := node.Parent
 * 				if node.Kind == ast.KindTypeParameter {
 * 					if !(ast.IsFunctionLikeDeclaration(parent) || ast.IsClassLike(parent) ||
 * 						ast.IsFunctionTypeNode(parent) || ast.IsConstructorTypeNode(parent) ||
 * 						ast.IsCallSignatureDeclaration(parent) || ast.IsConstructSignatureDeclaration(parent) ||
 * 						ast.IsMethodSignatureDeclaration(parent)) {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_can_only_appear_on_a_type_parameter_of_a_function_method_or_class, scanner.TokenToString(modifier.Kind))
 * 					}
 * 				}
 * 			case ast.KindOverrideKeyword:
 * 				// If node.kind === SyntaxKind.Parameter, checkParameter reports an error if it's not a parameter property.
 * 				if flags&ast.ModifierFlagsOverride != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "override")
 * 				} else if flags&ast.ModifierFlagsAmbient != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "override", "declare")
 * 				} else if flags&ast.ModifierFlagsReadonly != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "override", "readonly")
 * 				} else if flags&ast.ModifierFlagsAccessor != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "override", "accessor")
 * 				} else if flags&ast.ModifierFlagsAsync != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "override", "async")
 * 				}
 * 				flags |= ast.ModifierFlagsOverride
 * 				lastOverride = modifier
 * 
 * 			case ast.KindPublicKeyword,
 * 				ast.KindProtectedKeyword,
 * 				ast.KindPrivateKeyword:
 * 				text := visibilityToString(ast.ModifierToFlag(modifier.Kind))
 * 
 * 				if flags&ast.ModifierFlagsAccessibilityModifier != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.Accessibility_modifier_already_seen)
 * 				} else if flags&ast.ModifierFlagsOverride != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, text, "override")
 * 				} else if flags&ast.ModifierFlagsStatic != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, text, "static")
 * 				} else if flags&ast.ModifierFlagsAccessor != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, text, "accessor")
 * 				} else if flags&ast.ModifierFlagsReadonly != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, text, "readonly")
 * 				} else if flags&ast.ModifierFlagsAsync != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, text, "async")
 * 				} else if node.Parent.Kind == ast.KindModuleBlock || node.Parent.Kind == ast.KindSourceFile {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_module_or_namespace_element, text)
 * 				} else if flags&ast.ModifierFlagsAbstract != 0 {
 * 					if modifier.Kind == ast.KindPrivateKeyword {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, text, "abstract")
 * 					} else if modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, text, "abstract")
 * 					}
 * 				} else if ast.IsPrivateIdentifierClassElementDeclaration(node) {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.An_accessibility_modifier_cannot_be_used_with_a_private_identifier)
 * 				}
 * 				flags |= ast.ModifierToFlag(modifier.Kind)
 * 			case ast.KindStaticKeyword:
 * 				if flags&ast.ModifierFlagsStatic != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "static")
 * 				} else if flags&ast.ModifierFlagsReadonly != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "static", "readonly")
 * 				} else if flags&ast.ModifierFlagsAsync != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "static", "async")
 * 				} else if flags&ast.ModifierFlagsAccessor != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "static", "accessor")
 * 				} else if node.Parent.Kind == ast.KindModuleBlock || node.Parent.Kind == ast.KindSourceFile {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_module_or_namespace_element, "static")
 * 				} else if node.Kind == ast.KindParameter {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_parameter, "static")
 * 				} else if flags&ast.ModifierFlagsAbstract != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "static", "abstract")
 * 				} else if flags&ast.ModifierFlagsOverride != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "static", "override")
 * 				}
 * 				flags |= ast.ModifierFlagsStatic
 * 				lastStatic = modifier
 * 			case ast.KindAccessorKeyword:
 * 				if flags&ast.ModifierFlagsAccessor != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "accessor")
 * 				} else if flags&ast.ModifierFlagsReadonly != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "accessor", "readonly")
 * 				} else if flags&ast.ModifierFlagsAmbient != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "accessor", "declare")
 * 				} else if node.Kind != ast.KindPropertyDeclaration {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_accessor_modifier_can_only_appear_on_a_property_declaration)
 * 				}
 * 
 * 				flags |= ast.ModifierFlagsAccessor
 * 			case ast.KindReadonlyKeyword:
 * 				if flags&ast.ModifierFlagsReadonly != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "readonly")
 * 				} else if node.Kind != ast.KindPropertyDeclaration && node.Kind != ast.KindPropertySignature && node.Kind != ast.KindIndexSignature && node.Kind != ast.KindParameter {
 * 					// If node.kind === SyntaxKind.Parameter, checkParameter reports an error if it's not a parameter property.
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_readonly_modifier_can_only_appear_on_a_property_declaration_or_index_signature)
 * 				} else if flags&ast.ModifierFlagsAccessor != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "readonly", "accessor")
 * 				}
 * 				flags |= ast.ModifierFlagsReadonly
 * 			case ast.KindExportKeyword:
 * 				if c.compilerOptions.VerbatimModuleSyntax == core.TSTrue && node.Flags&ast.NodeFlagsAmbient == 0 && node.Kind != ast.KindTypeAliasDeclaration && node.Kind != ast.KindInterfaceDeclaration && node.Kind != ast.KindModuleDeclaration && node.Parent.Kind == ast.KindSourceFile && c.program.GetEmitModuleFormatOfFile(ast.GetSourceFileOfNode(node)) == core.ModuleKindCommonJS {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.A_top_level_export_modifier_cannot_be_used_on_value_declarations_in_a_CommonJS_module_when_verbatimModuleSyntax_is_enabled)
 * 				}
 * 				if flags&ast.ModifierFlagsExport != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "export")
 * 				} else if flags&ast.ModifierFlagsAmbient != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "export", "declare")
 * 				} else if flags&ast.ModifierFlagsAbstract != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "export", "abstract")
 * 				} else if flags&ast.ModifierFlagsAsync != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "export", "async")
 * 				} else if ast.IsClassLike(node.Parent) && !ast.IsJSTypeAliasDeclaration(node) {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_class_elements_of_this_kind, "export")
 * 				} else if node.Kind == ast.KindParameter {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_parameter, "export")
 * 				} else if blockScopeKind == ast.NodeFlagsUsing {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_using_declaration, "export")
 * 				} else if blockScopeKind == ast.NodeFlagsAwaitUsing {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_an_await_using_declaration, "export")
 * 				}
 * 				flags |= ast.ModifierFlagsExport
 * 			case ast.KindDefaultKeyword:
 * 				var container *ast.Node
 * 				if node.Parent.Kind == ast.KindSourceFile {
 * 					container = node.Parent
 * 				} else {
 * 					container = node.Parent.Parent
 * 				}
 * 				if container.Kind == ast.KindModuleDeclaration && !ast.IsAmbientModule(container) {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.A_default_export_can_only_be_used_in_an_ECMAScript_style_module)
 * 				} else if blockScopeKind == ast.NodeFlagsUsing {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_using_declaration, "default")
 * 				} else if blockScopeKind == ast.NodeFlagsAwaitUsing {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_an_await_using_declaration, "default")
 * 				} else if flags&ast.ModifierFlagsExport == 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "export", "default")
 * 				} else if sawExportBeforeDecorators {
 * 					return c.grammarErrorOnNode(firstDecorator, diagnostics.Decorators_are_not_valid_here)
 * 				}
 * 
 * 				flags |= ast.ModifierFlagsDefault
 * 			case ast.KindDeclareKeyword:
 * 				if flags&ast.ModifierFlagsAmbient != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "declare")
 * 				} else if flags&ast.ModifierFlagsAsync != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_in_an_ambient_context, "async")
 * 				} else if flags&ast.ModifierFlagsOverride != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_in_an_ambient_context, "override")
 * 				} else if ast.IsClassLike(node.Parent) && !ast.IsPropertyDeclaration(node) {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_class_elements_of_this_kind, "declare")
 * 				} else if node.Kind == ast.KindParameter {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_parameter, "declare")
 * 				} else if blockScopeKind == ast.NodeFlagsUsing {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_using_declaration, "declare")
 * 				} else if blockScopeKind == ast.NodeFlagsAwaitUsing {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_an_await_using_declaration, "declare")
 * 				} else if (node.Parent.Flags&ast.NodeFlagsAmbient != 0) && node.Parent.Kind == ast.KindModuleBlock {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.A_declare_modifier_cannot_be_used_in_an_already_ambient_context)
 * 				} else if ast.IsPrivateIdentifierClassElementDeclaration(node) {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_a_private_identifier, "declare")
 * 				} else if flags&ast.ModifierFlagsAccessor != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "declare", "accessor")
 * 				}
 * 				flags |= ast.ModifierFlagsAmbient
 * 				lastDeclare = modifier
 * 			case ast.KindAbstractKeyword:
 * 				if flags&ast.ModifierFlagsAbstract != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "abstract")
 * 				}
 * 				if node.Kind != ast.KindClassDeclaration && node.Kind != ast.KindConstructorType {
 * 					if node.Kind != ast.KindMethodDeclaration && node.Kind != ast.KindPropertyDeclaration && node.Kind != ast.KindGetAccessor && node.Kind != ast.KindSetAccessor {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_abstract_modifier_can_only_appear_on_a_class_method_or_property_declaration)
 * 					}
 * 					if !(node.Parent.Kind == ast.KindClassDeclaration && ast.HasSyntacticModifier(node.Parent, ast.ModifierFlagsAbstract)) {
 * 						var message *diagnostics.Message
 * 						if node.Kind == ast.KindPropertyDeclaration {
 * 							message = diagnostics.Abstract_properties_can_only_appear_within_an_abstract_class
 * 						} else {
 * 							message = diagnostics.Abstract_methods_can_only_appear_within_an_abstract_class
 * 						}
 * 						return c.grammarErrorOnNode(modifier, message)
 * 					}
 * 					if flags&ast.ModifierFlagsStatic != 0 {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "static", "abstract")
 * 					}
 * 					if flags&ast.ModifierFlagsPrivate != 0 {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "private", "abstract")
 * 					}
 * 					if flags&ast.ModifierFlagsAsync != 0 && lastAsync != nil {
 * 						return c.grammarErrorOnNode(lastAsync, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "async", "abstract")
 * 					}
 * 					if flags&ast.ModifierFlagsOverride != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "abstract", "override")
 * 					}
 * 					if flags&ast.ModifierFlagsAccessor != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "abstract", "accessor")
 * 					}
 * 				}
 * 				if name := node.Name(); name != nil && name.Kind == ast.KindPrivateIdentifier {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_a_private_identifier, "abstract")
 * 				}
 * 
 * 				flags |= ast.ModifierFlagsAbstract
 * 			case ast.KindAsyncKeyword:
 * 				if flags&ast.ModifierFlagsAsync != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "async")
 * 				} else if flags&ast.ModifierFlagsAmbient != 0 || node.Parent.Flags&ast.NodeFlagsAmbient != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_in_an_ambient_context, "async")
 * 				} else if node.Kind == ast.KindParameter {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_parameter, "async")
 * 				}
 * 				if flags&ast.ModifierFlagsAbstract != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "async", "abstract")
 * 				}
 * 				flags |= ast.ModifierFlagsAsync
 * 				lastAsync = modifier
 * 			case ast.KindInKeyword,
 * 				ast.KindOutKeyword:
 * 				var inOutFlag ast.ModifierFlags
 * 				if modifier.Kind == ast.KindInKeyword {
 * 					inOutFlag = ast.ModifierFlagsIn
 * 				} else {
 * 					inOutFlag = ast.ModifierFlagsOut
 * 				}
 * 				var inOutText string
 * 				if modifier.Kind == ast.KindInKeyword {
 * 					inOutText = "in"
 * 				} else {
 * 					inOutText = "out"
 * 				}
 * 				parent := node.Parent
 * 				if node.Kind != ast.KindTypeParameter || parent != nil && !(ast.IsInterfaceDeclaration(parent) || ast.IsClassLike(parent) || ast.IsTypeOrJSTypeAliasDeclaration(parent)) {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_can_only_appear_on_a_type_parameter_of_a_class_interface_or_type_alias, inOutText)
 * 				}
 * 				if flags&inOutFlag != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, inOutText)
 * 				}
 * 				if inOutFlag&ast.ModifierFlagsIn != 0 && flags&ast.ModifierFlagsOut != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "in", "out")
 * 				}
 * 				flags |= inOutFlag
 * 			}
 * 		}
 * 	}
 * 
 * 	if node.Kind == ast.KindConstructor {
 * 		if flags&ast.ModifierFlagsStatic != 0 {
 * 			return c.grammarErrorOnNode(lastStatic, diagnostics.X_0_modifier_cannot_appear_on_a_constructor_declaration, "static")
 * 		}
 * 		if flags&ast.ModifierFlagsOverride != 0 {
 * 			return c.grammarErrorOnNode(lastOverride, diagnostics.X_0_modifier_cannot_appear_on_a_constructor_declaration, "override")
 * 		}
 * 		if flags&ast.ModifierFlagsAsync != 0 {
 * 			return c.grammarErrorOnNode(lastAsync, diagnostics.X_0_modifier_cannot_appear_on_a_constructor_declaration, "async")
 * 		}
 * 		return false
 * 	} else if (node.Kind == ast.KindImportDeclaration || node.Kind == ast.KindJSImportDeclaration || node.Kind == ast.KindImportEqualsDeclaration) && flags&ast.ModifierFlagsAmbient != 0 {
 * 		return c.grammarErrorOnNode(lastDeclare, diagnostics.A_0_modifier_cannot_be_used_with_an_import_declaration, "declare")
 * 	} else if node.Kind == ast.KindParameter && (flags&ast.ModifierFlagsParameterPropertyModifier != 0) && ast.IsBindingPattern(node.Name()) {
 * 		return c.grammarErrorOnNode(node, diagnostics.A_parameter_property_may_not_be_declared_using_a_binding_pattern)
 * 	} else if node.Kind == ast.KindParameter && (flags&ast.ModifierFlagsParameterPropertyModifier != 0) && node.AsParameterDeclaration().DotDotDotToken != nil {
 * 		return c.grammarErrorOnNode(node, diagnostics.A_parameter_property_cannot_be_declared_using_a_rest_parameter)
 * 	}
 * 	if flags&ast.ModifierFlagsAsync != 0 {
 * 		return c.checkGrammarAsyncModifier(node, lastAsync)
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarModifiers(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (Node_Modifiers(node) === undefined) {
    return false;
  }
  if (Checker_reportObviousDecoratorErrors(receiver, node) || Checker_reportObviousModifierErrors(receiver, node)) {
    return true;
  }
  if (IsThisParameter(node)) {
    return Checker_grammarErrorOnFirstToken(receiver, node, Neither_decorators_nor_modifiers_may_be_applied_to_this_parameters);
  }
  let blockScopeKind: NodeFlags = NodeFlagsNone;
  if (IsVariableStatement(node)) {
    blockScopeKind = AsVariableStatement(node)!.DeclarationList!.Flags & NodeFlagsBlockScoped;
  }
  let lastStatic: GoPtr<Node> = undefined;
  let lastDeclare: GoPtr<Node> = undefined;
  let lastAsync: GoPtr<Node> = undefined;
  let lastOverride: GoPtr<Node> = undefined;
  let firstDecorator: GoPtr<Node> = undefined;
  let flags: ModifierFlags = ModifierFlagsNone;
  let sawExportBeforeDecorators = false;
  let hasLeadingDecorators = false;
  const modifiers = Node_ModifierNodes(node);
  for (const modifier of modifiers ?? []) {
    if (IsDecorator(modifier)) {
      if (!NodeCanBeDecorated(receiver!.legacyDecorators, node, node!.Parent, node!.Parent!.Parent)) {
        if (node!.Kind === KindMethodDeclaration && !NodeIsPresent(Node_Body(node))) {
          return Checker_grammarErrorOnFirstToken(receiver, node, A_decorator_can_only_decorate_a_method_implementation_not_an_overload);
        } else {
          return Checker_grammarErrorOnFirstToken(receiver, node, Decorators_are_not_valid_here);
        }
      } else if (receiver!.legacyDecorators && (node!.Kind === KindGetAccessor || node!.Kind === KindSetAccessor)) {
        const accessors = GetAllAccessorDeclarationsForDeclaration(node, Checker_getSymbolOfDeclaration(receiver, node)!.Declarations ?? []);
        if (HasDecorators(accessors.FirstAccessor) && node === accessors.SecondAccessor) {
          return Checker_grammarErrorOnFirstToken(receiver, node, Decorators_cannot_be_applied_to_multiple_get_Slashset_accessors_of_the_same_name);
        }
      }

      if ((flags & ~(ModifierFlagsExportDefault | ModifierFlagsDecorator)) !== 0) {
        return Checker_grammarErrorOnNode(receiver, modifier, Decorators_are_not_valid_here);
      }

      if (hasLeadingDecorators && (flags & ModifierFlagsModifier) !== 0) {
        if (firstDecorator === undefined) {
          throw new globalThis.Error("Expected firstDecorator to be set");
        }
        const sourceFile = GetSourceFileOfNode(modifier);
        if (!Checker_hasParseDiagnostics(receiver, sourceFile)) {
          const err = Checker_error(receiver, modifier, Decorators_may_not_appear_after_export_or_export_default_if_they_also_appear_before_export);
          Diagnostic_AddRelatedInfo(err, createDiagnosticForNode(firstDecorator, Decorator_used_before_export_here));
          return true;
        }
        return false;
      }

      flags |= ModifierFlagsDecorator;

      if ((flags & ModifierFlagsModifier) === 0) {
        hasLeadingDecorators = true;
      } else if ((flags & ModifierFlagsExport) !== 0) {
        sawExportBeforeDecorators = true;
      }

      if (firstDecorator === undefined) {
        firstDecorator = modifier;
      }
    } else {
      if (modifier!.Kind !== KindReadonlyKeyword) {
        if (node!.Kind === KindPropertySignature || node!.Kind === KindMethodSignature) {
          return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_a_type_member, TokenToString(modifier!.Kind));
        }
        if (node!.Kind === KindIndexSignature && (modifier!.Kind !== KindStaticKeyword || !IsClassLike(node!.Parent))) {
          return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_an_index_signature, TokenToString(modifier!.Kind));
        }
      }
      if (modifier!.Kind !== KindInKeyword && modifier!.Kind !== KindOutKeyword && modifier!.Kind !== KindConstKeyword) {
        if (node!.Kind === KindTypeParameter) {
          return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_a_type_parameter, TokenToString(modifier!.Kind));
        }
      }
      switch (modifier!.Kind) {
        case KindConstKeyword:
          if (node!.Kind !== KindEnumDeclaration && node!.Kind !== KindTypeParameter) {
            return Checker_grammarErrorOnNode(receiver, node, A_class_member_cannot_have_the_0_keyword, TokenToString(KindConstKeyword));
          }
          {
            const parent = node!.Parent;
            if (node!.Kind === KindTypeParameter) {
              if (!(IsFunctionLikeDeclaration(parent) || IsClassLike(parent) ||
                IsFunctionTypeNode(parent) || IsConstructorTypeNode(parent) ||
                IsCallSignatureDeclaration(parent) || IsConstructSignatureDeclaration(parent) ||
                IsMethodSignatureDeclaration(parent))) {
                return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_can_only_appear_on_a_type_parameter_of_a_function_method_or_class, TokenToString(modifier!.Kind));
              }
            }
          }
          break;
        case KindOverrideKeyword:
          if ((flags & ModifierFlagsOverride) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_already_seen, "override");
          } else if ((flags & ModifierFlagsAmbient) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_with_1_modifier, "override", "declare");
          } else if ((flags & ModifierFlagsReadonly) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, "override", "readonly");
          } else if ((flags & ModifierFlagsAccessor) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, "override", "accessor");
          } else if ((flags & ModifierFlagsAsync) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, "override", "async");
          }
          flags |= ModifierFlagsOverride;
          lastOverride = modifier;
          break;
        case KindPublicKeyword:
        case KindProtectedKeyword:
        case KindPrivateKeyword: {
          const text = visibilityToString(ModifierToFlag(modifier!.Kind));
          if ((flags & ModifierFlagsAccessibilityModifier) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, Accessibility_modifier_already_seen);
          } else if ((flags & ModifierFlagsOverride) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, text, "override");
          } else if ((flags & ModifierFlagsStatic) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, text, "static");
          } else if ((flags & ModifierFlagsAccessor) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, text, "accessor");
          } else if ((flags & ModifierFlagsReadonly) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, text, "readonly");
          } else if ((flags & ModifierFlagsAsync) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, text, "async");
          } else if (node!.Parent!.Kind === KindModuleBlock || node!.Parent!.Kind === KindSourceFile) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_a_module_or_namespace_element, text);
          } else if ((flags & ModifierFlagsAbstract) !== 0) {
            if (modifier!.Kind === KindPrivateKeyword) {
              return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_with_1_modifier, text, "abstract");
            } else if ((modifier!.Flags & NodeFlagsReparsed) === 0) {
              return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, text, "abstract");
            }
          } else if (IsPrivateIdentifierClassElementDeclaration(node)) {
            return Checker_grammarErrorOnNode(receiver, modifier, An_accessibility_modifier_cannot_be_used_with_a_private_identifier);
          }
          flags |= ModifierToFlag(modifier!.Kind);
          break;
        }
        case KindStaticKeyword:
          if ((flags & ModifierFlagsStatic) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_already_seen, "static");
          } else if ((flags & ModifierFlagsReadonly) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, "static", "readonly");
          } else if ((flags & ModifierFlagsAsync) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, "static", "async");
          } else if ((flags & ModifierFlagsAccessor) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, "static", "accessor");
          } else if (node!.Parent!.Kind === KindModuleBlock || node!.Parent!.Kind === KindSourceFile) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_a_module_or_namespace_element, "static");
          } else if (node!.Kind === KindParameter) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_a_parameter, "static");
          } else if ((flags & ModifierFlagsAbstract) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_with_1_modifier, "static", "abstract");
          } else if ((flags & ModifierFlagsOverride) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, "static", "override");
          }
          flags |= ModifierFlagsStatic;
          lastStatic = modifier;
          break;
        case KindAccessorKeyword:
          if ((flags & ModifierFlagsAccessor) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_already_seen, "accessor");
          } else if ((flags & ModifierFlagsReadonly) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_with_1_modifier, "accessor", "readonly");
          } else if ((flags & ModifierFlagsAmbient) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_with_1_modifier, "accessor", "declare");
          } else if (node!.Kind !== KindPropertyDeclaration) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_accessor_modifier_can_only_appear_on_a_property_declaration);
          }
          flags |= ModifierFlagsAccessor;
          break;
        case KindReadonlyKeyword:
          if ((flags & ModifierFlagsReadonly) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_already_seen, "readonly");
          } else if (node!.Kind !== KindPropertyDeclaration && node!.Kind !== KindPropertySignature && node!.Kind !== KindIndexSignature && node!.Kind !== KindParameter) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_readonly_modifier_can_only_appear_on_a_property_declaration_or_index_signature);
          } else if ((flags & ModifierFlagsAccessor) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_with_1_modifier, "readonly", "accessor");
          }
          flags |= ModifierFlagsReadonly;
          break;
        case KindExportKeyword:
          if (receiver!.compilerOptions!.VerbatimModuleSyntax === TSTrue && (node!.Flags & NodeFlagsAmbient) === 0 && node!.Kind !== KindTypeAliasDeclaration && node!.Kind !== KindInterfaceDeclaration && node!.Kind !== KindModuleDeclaration && node!.Parent!.Kind === KindSourceFile && receiver!.program.GetEmitModuleFormatOfFile(NewHasFileName(SourceFile_FileName(GetSourceFileOfNode(node)), SourceFile_Path(GetSourceFileOfNode(node)))) === ModuleKindCommonJS) {
            return Checker_grammarErrorOnNode(receiver, modifier, A_top_level_export_modifier_cannot_be_used_on_value_declarations_in_a_CommonJS_module_when_verbatimModuleSyntax_is_enabled);
          }
          if ((flags & ModifierFlagsExport) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_already_seen, "export");
          } else if ((flags & ModifierFlagsAmbient) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, "export", "declare");
          } else if ((flags & ModifierFlagsAbstract) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, "export", "abstract");
          } else if ((flags & ModifierFlagsAsync) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, "export", "async");
          } else if (IsClassLike(node!.Parent) && !IsJSTypeAliasDeclaration(node)) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_class_elements_of_this_kind, "export");
          } else if (node!.Kind === KindParameter) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_a_parameter, "export");
          } else if (blockScopeKind === NodeFlagsUsing) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_a_using_declaration, "export");
          } else if (blockScopeKind === NodeFlagsAwaitUsing) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_an_await_using_declaration, "export");
          }
          flags |= ModifierFlagsExport;
          break;
        case KindDefaultKeyword: {
          let container: GoPtr<Node>;
          if (node!.Parent!.Kind === KindSourceFile) {
            container = node!.Parent;
          } else {
            container = node!.Parent!.Parent;
          }
          if (container!.Kind === KindModuleDeclaration && !IsAmbientModule(container)) {
            return Checker_grammarErrorOnNode(receiver, modifier, A_default_export_can_only_be_used_in_an_ECMAScript_style_module);
          } else if (blockScopeKind === NodeFlagsUsing) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_a_using_declaration, "default");
          } else if (blockScopeKind === NodeFlagsAwaitUsing) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_an_await_using_declaration, "default");
          } else if ((flags & ModifierFlagsExport) === 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, "export", "default");
          } else if (sawExportBeforeDecorators) {
            return Checker_grammarErrorOnNode(receiver, firstDecorator!, Decorators_are_not_valid_here);
          }
          flags |= ModifierFlagsDefault;
          break;
        }
        case KindDeclareKeyword:
          if ((flags & ModifierFlagsAmbient) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_already_seen, "declare");
          } else if ((flags & ModifierFlagsAsync) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_in_an_ambient_context, "async");
          } else if ((flags & ModifierFlagsOverride) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_in_an_ambient_context, "override");
          } else if (IsClassLike(node!.Parent) && !IsPropertyDeclaration(node)) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_class_elements_of_this_kind, "declare");
          } else if (node!.Kind === KindParameter) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_a_parameter, "declare");
          } else if (blockScopeKind === NodeFlagsUsing) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_a_using_declaration, "declare");
          } else if (blockScopeKind === NodeFlagsAwaitUsing) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_an_await_using_declaration, "declare");
          } else if ((node!.Parent!.Flags & NodeFlagsAmbient) !== 0 && node!.Parent!.Kind === KindModuleBlock) {
            return Checker_grammarErrorOnNode(receiver, modifier, A_declare_modifier_cannot_be_used_in_an_already_ambient_context);
          } else if (IsPrivateIdentifierClassElementDeclaration(node)) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_with_a_private_identifier, "declare");
          } else if ((flags & ModifierFlagsAccessor) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_with_1_modifier, "declare", "accessor");
          }
          flags |= ModifierFlagsAmbient;
          lastDeclare = modifier;
          break;
        case KindAbstractKeyword:
          if ((flags & ModifierFlagsAbstract) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_already_seen, "abstract");
          }
          if (node!.Kind !== KindClassDeclaration && node!.Kind !== KindConstructorType) {
            if (node!.Kind !== KindMethodDeclaration && node!.Kind !== KindPropertyDeclaration && node!.Kind !== KindGetAccessor && node!.Kind !== KindSetAccessor) {
              return Checker_grammarErrorOnNode(receiver, modifier, X_abstract_modifier_can_only_appear_on_a_class_method_or_property_declaration);
            }
            if (!(node!.Parent!.Kind === KindClassDeclaration && HasSyntacticModifier(node!.Parent, ModifierFlagsAbstract))) {
              let message: GoPtr<Message>;
              if (node!.Kind === KindPropertyDeclaration) {
                message = Abstract_properties_can_only_appear_within_an_abstract_class;
              } else {
                message = Abstract_methods_can_only_appear_within_an_abstract_class;
              }
              return Checker_grammarErrorOnNode(receiver, modifier, message);
            }
            if ((flags & ModifierFlagsStatic) !== 0) {
              return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_with_1_modifier, "static", "abstract");
            }
            if ((flags & ModifierFlagsPrivate) !== 0) {
              return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_with_1_modifier, "private", "abstract");
            }
            if ((flags & ModifierFlagsAsync) !== 0 && lastAsync !== undefined) {
              return Checker_grammarErrorOnNode(receiver, lastAsync, X_0_modifier_cannot_be_used_with_1_modifier, "async", "abstract");
            }
            if ((flags & ModifierFlagsOverride) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
              return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, "abstract", "override");
            }
            if ((flags & ModifierFlagsAccessor) !== 0 && (modifier!.Flags & NodeFlagsReparsed) === 0) {
              return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, "abstract", "accessor");
            }
          }
          {
            const name = Node_Name(node);
            if (name !== undefined && name!.Kind === KindPrivateIdentifier) {
              return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_with_a_private_identifier, "abstract");
            }
          }
          flags |= ModifierFlagsAbstract;
          break;
        case KindAsyncKeyword:
          if ((flags & ModifierFlagsAsync) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_already_seen, "async");
          } else if ((flags & ModifierFlagsAmbient) !== 0 || (node!.Parent!.Flags & NodeFlagsAmbient) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_in_an_ambient_context, "async");
          } else if (node!.Kind === KindParameter) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_appear_on_a_parameter, "async");
          }
          if ((flags & ModifierFlagsAbstract) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_cannot_be_used_with_1_modifier, "async", "abstract");
          }
          flags |= ModifierFlagsAsync;
          lastAsync = modifier;
          break;
        case KindInKeyword:
        case KindOutKeyword: {
          const inOutFlag: ModifierFlags = modifier!.Kind === KindInKeyword ? ModifierFlagsIn : ModifierFlagsOut;
          const inOutText: string = modifier!.Kind === KindInKeyword ? "in" : "out";
          const parent = node!.Parent;
          if (node!.Kind !== KindTypeParameter || (parent !== undefined && !(IsInterfaceDeclaration(parent) || IsClassLike(parent) || IsTypeOrJSTypeAliasDeclaration(parent)))) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_can_only_appear_on_a_type_parameter_of_a_class_interface_or_type_alias, inOutText);
          }
          if ((flags & inOutFlag) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_already_seen, inOutText);
          }
          if ((inOutFlag & ModifierFlagsIn) !== 0 && (flags & ModifierFlagsOut) !== 0) {
            return Checker_grammarErrorOnNode(receiver, modifier, X_0_modifier_must_precede_1_modifier, "in", "out");
          }
          flags |= inOutFlag;
          break;
        }
      }
    }
  }

  if (node!.Kind === KindConstructor) {
    if ((flags & ModifierFlagsStatic) !== 0) {
      return Checker_grammarErrorOnNode(receiver, lastStatic!, X_0_modifier_cannot_appear_on_a_constructor_declaration, "static");
    }
    if ((flags & ModifierFlagsOverride) !== 0) {
      return Checker_grammarErrorOnNode(receiver, lastOverride!, X_0_modifier_cannot_appear_on_a_constructor_declaration, "override");
    }
    if ((flags & ModifierFlagsAsync) !== 0) {
      return Checker_grammarErrorOnNode(receiver, lastAsync!, X_0_modifier_cannot_appear_on_a_constructor_declaration, "async");
    }
    return false;
  } else if ((node!.Kind === KindImportDeclaration || node!.Kind === KindJSImportDeclaration || node!.Kind === KindImportEqualsDeclaration) && (flags & ModifierFlagsAmbient) !== 0) {
    return Checker_grammarErrorOnNode(receiver, lastDeclare!, A_0_modifier_cannot_be_used_with_an_import_declaration, "declare");
  } else if (node!.Kind === KindParameter && (flags & ModifierFlagsParameterPropertyModifier) !== 0 && IsBindingPattern(Node_Name(node))) {
    return Checker_grammarErrorOnNode(receiver, node, A_parameter_property_may_not_be_declared_using_a_binding_pattern);
  } else if (node!.Kind === KindParameter && (flags & ModifierFlagsParameterPropertyModifier) !== 0 && AsParameterDeclaration(node)!.DotDotDotToken !== undefined) {
    return Checker_grammarErrorOnNode(receiver, node, A_parameter_property_cannot_be_declared_using_a_rest_parameter);
  }
  if ((flags & ModifierFlagsAsync) !== 0) {
    return Checker_checkGrammarAsyncModifier(receiver, node, lastAsync!);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.reportObviousModifierErrors","kind":"method","status":"implemented","sigHash":"74a14bff8368eb7795ec34c9e91916e9e7e2a3fd73b1a9887c0a695d0a1a5c09","bodyHash":"23a2e9ee53fa3b5eec691effe89a3d7d0a9eacabf25d96e213d5dc69645b3a00"}
 *
 * Go source:
 * func (c *Checker) reportObviousModifierErrors(node *ast.Node) bool {
 * 	modifier := c.findFirstIllegalModifier(node)
 * 	if modifier == nil {
 * 		return false
 * 	}
 * 	return c.grammarErrorOnFirstToken(modifier, diagnostics.Modifiers_cannot_appear_here)
 * }
 */
export function Checker_reportObviousModifierErrors(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const modifier = Checker_findFirstIllegalModifier(receiver, node);
  if (modifier === undefined) {
    return false;
  }
  return Checker_grammarErrorOnFirstToken(receiver, modifier, Modifiers_cannot_appear_here);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.findFirstModifierExcept","kind":"method","status":"implemented","sigHash":"437d953f18fc4295435a134924484c4e5b30aca27fff6632e9b8252f11ffb204","bodyHash":"7207dfb01a9bf77de2528c4249c28fa4abb91b4b14f315d78f846c3a10fd9d25"}
 *
 * Go source:
 * func (c *Checker) findFirstModifierExcept(node *ast.Node, allowedModifier ast.Kind) *ast.Node {
 * 	modifier := core.Find(node.ModifierNodes(), ast.IsModifier)
 * 	if modifier != nil && modifier.Kind != allowedModifier {
 * 		return modifier
 * 	}
 * 	return nil
 * }
 */
export function Checker_findFirstModifierExcept(receiver: GoPtr<Checker>, node: GoPtr<Node>, allowedModifier: Kind): GoPtr<Node> {
  const modifier = Find(Node_ModifierNodes(node) ?? [], IsModifier);
  if (modifier !== undefined && modifier!.Kind !== allowedModifier) {
    return modifier;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.findFirstIllegalModifier","kind":"method","status":"implemented","sigHash":"bf400441e6e93c32dcfec61a751d6fd516cc6787d7457c1790b77d5dd07c840e","bodyHash":"1134c3c1d54997ac7636fd7afa25d610a3907405c8d93275fc071b8a88d33882"}
 *
 * Go source:
 * func (c *Checker) findFirstIllegalModifier(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindGetAccessor,
 * 		ast.KindSetAccessor,
 * 		ast.KindConstructor,
 * 		ast.KindPropertyDeclaration,
 * 		ast.KindPropertySignature,
 * 		ast.KindMethodDeclaration,
 * 		ast.KindMethodSignature,
 * 		ast.KindIndexSignature,
 * 		ast.KindModuleDeclaration,
 * 		ast.KindImportDeclaration,
 * 		ast.KindJSImportDeclaration,
 * 		ast.KindImportEqualsDeclaration,
 * 		ast.KindExportDeclaration,
 * 		ast.KindExportAssignment,
 * 		ast.KindFunctionExpression,
 * 		ast.KindArrowFunction,
 * 		ast.KindParameter,
 * 		ast.KindTypeParameter,
 * 		ast.KindJSTypeAliasDeclaration:
 * 		return nil
 * 	case ast.KindClassStaticBlockDeclaration,
 * 		ast.KindPropertyAssignment,
 * 		ast.KindShorthandPropertyAssignment,
 * 		ast.KindNamespaceExportDeclaration,
 * 		ast.KindMissingDeclaration:
 * 		return core.Find(node.ModifierNodes(), ast.IsModifier)
 * 	default:
 * 		if node.Parent.Kind == ast.KindModuleBlock || node.Parent.Kind == ast.KindSourceFile {
 * 			return nil
 * 		}
 * 		switch node.Kind {
 * 		case ast.KindFunctionDeclaration:
 * 			return c.findFirstModifierExcept(node, ast.KindAsyncKeyword)
 * 		case ast.KindClassDeclaration,
 * 			ast.KindConstructorType:
 * 			return c.findFirstModifierExcept(node, ast.KindAbstractKeyword)
 * 		case ast.KindClassExpression,
 * 			ast.KindInterfaceDeclaration,
 * 			ast.KindTypeAliasDeclaration:
 * 			return core.Find(node.ModifierNodes(), ast.IsModifier)
 * 		case ast.KindVariableStatement:
 * 			if node.AsVariableStatement().DeclarationList.Flags&ast.NodeFlagsUsing != 0 {
 * 				return c.findFirstModifierExcept(node, ast.KindAwaitKeyword)
 * 			}
 * 			return core.Find(node.ModifierNodes(), ast.IsModifier)
 * 		case ast.KindEnumDeclaration:
 * 			return c.findFirstModifierExcept(node, ast.KindConstKeyword)
 * 		default:
 * 			panic("Unhandled case in findFirstIllegalModifier.")
 * 		}
 * 	}
 * }
 */
export function Checker_findFirstIllegalModifier(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindGetAccessor:
    case KindSetAccessor:
    case KindConstructor:
    case KindPropertyDeclaration:
    case KindPropertySignature:
    case KindMethodDeclaration:
    case KindMethodSignature:
    case KindIndexSignature:
    case KindModuleDeclaration:
    case KindImportDeclaration:
    case KindJSImportDeclaration:
    case KindImportEqualsDeclaration:
    case KindExportDeclaration:
    case KindExportAssignment:
    case KindFunctionExpression:
    case KindArrowFunction:
    case KindParameter:
    case KindTypeParameter:
    case KindJSTypeAliasDeclaration:
      return undefined;
    case KindClassStaticBlockDeclaration:
    case KindPropertyAssignment:
    case KindShorthandPropertyAssignment:
    case KindNamespaceExportDeclaration:
    case KindMissingDeclaration:
      return Find(Node_ModifierNodes(node) ?? [], IsModifier);
    default:
      if (node!.Parent!.Kind === KindModuleBlock || node!.Parent!.Kind === KindSourceFile) {
        return undefined;
      }
      switch (node!.Kind) {
        case KindFunctionDeclaration:
          return Checker_findFirstModifierExcept(receiver, node, KindAsyncKeyword);
        case KindClassDeclaration:
        case KindConstructorType:
          return Checker_findFirstModifierExcept(receiver, node, KindAbstractKeyword);
        case KindClassExpression:
        case KindInterfaceDeclaration:
        case KindTypeAliasDeclaration:
          return Find(Node_ModifierNodes(node) ?? [], IsModifier);
        case KindVariableStatement:
          if ((AsVariableStatement(node)!.DeclarationList!.Flags & NodeFlagsUsing) !== 0) {
            return Checker_findFirstModifierExcept(receiver, node, KindAwaitKeyword);
          }
          return Find(Node_ModifierNodes(node) ?? [], IsModifier);
        case KindEnumDeclaration:
          return Checker_findFirstModifierExcept(receiver, node, KindConstKeyword);
        default:
          throw new globalThis.Error("Unhandled case in findFirstIllegalModifier.");
      }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.reportObviousDecoratorErrors","kind":"method","status":"implemented","sigHash":"f6984c82989e13d6ecb3db4e6bcfe8ce93da1a4a49f4279749db0dbc62daa98c","bodyHash":"30f42d4662d94ce2f0e5eebd869dfe6be936487cb078ad7feedda5ce8eccc310"}
 *
 * Go source:
 * func (c *Checker) reportObviousDecoratorErrors(node *ast.Node) bool {
 * 	decorator := c.findFirstIllegalDecorator(node)
 * 	if decorator == nil {
 * 		return false
 * 	}
 * 	return c.grammarErrorOnFirstToken(decorator, diagnostics.Decorators_are_not_valid_here)
 * }
 */
export function Checker_reportObviousDecoratorErrors(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const decorator = Checker_findFirstIllegalDecorator(receiver, node);
  if (decorator === undefined) {
    return false;
  }
  return Checker_grammarErrorOnFirstToken(receiver, decorator, Decorators_are_not_valid_here);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.findFirstIllegalDecorator","kind":"method","status":"implemented","sigHash":"6f00e6ca045ef8aa8d286e1e57d0b2aa21cb6189edb01229a660c1a85eadb038","bodyHash":"8dd0b94f3747f680a6744b06ece3a75dec03c6a1d92be1004e9868fa3a457c9a"}
 *
 * Go source:
 * func (c *Checker) findFirstIllegalDecorator(node *ast.Node) *ast.Node {
 * 	if ast.CanHaveIllegalDecorators(node) {
 * 		decorator := core.Find(node.ModifierNodes(), ast.IsDecorator)
 * 		return decorator
 * 	} else {
 * 		return nil
 * 	}
 * }
 */
export function Checker_findFirstIllegalDecorator(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node> {
  if (CanHaveIllegalDecorators(node)) {
    const decorator = Find(Node_ModifierNodes(node) ?? [], IsDecorator);
    return decorator;
  } else {
    return undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarAsyncModifier","kind":"method","status":"implemented","sigHash":"d54b13a9d2fa44460464977bb696ac9ae4dbacb1ec735ce4a01b452ad6cb984f","bodyHash":"c4698c6ff4beab84b73933d8acba4d705b206664ee5be70b14f18341294f56d6"}
 *
 * Go source:
 * func (c *Checker) checkGrammarAsyncModifier(node *ast.Node, asyncModifier *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindMethodDeclaration,
 * 		ast.KindFunctionDeclaration,
 * 		ast.KindFunctionExpression,
 * 		ast.KindArrowFunction:
 * 		return false
 * 	}
 * 
 * 	return c.grammarErrorOnNode(asyncModifier, diagnostics.X_0_modifier_cannot_be_used_here, "async")
 * }
 */
export function Checker_checkGrammarAsyncModifier(receiver: GoPtr<Checker>, node: GoPtr<Node>, asyncModifier: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindMethodDeclaration:
    case KindFunctionDeclaration:
    case KindFunctionExpression:
    case KindArrowFunction:
      return false;
  }
  return Checker_grammarErrorOnNode(receiver, asyncModifier, X_0_modifier_cannot_be_used_here, "async");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForDisallowedTrailingComma","kind":"method","status":"implemented","sigHash":"a35da90b785d8beb5a9c2d22ebd89358077e0bb54c0a11c024fb1f939d182271","bodyHash":"c0e97ca3f274693f4a47174d8906bf814a67cfc79805182a706828fe458fec77"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForDisallowedTrailingComma(list *ast.NodeList, diag *diagnostics.Message) bool {
 * 	if list != nil && list.HasTrailingComma() {
 * 		return c.grammarErrorAtPos(list.Nodes[0], list.End()-len(","), len(","), diag)
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarForDisallowedTrailingComma(receiver: GoPtr<Checker>, list: GoPtr<NodeList>, diag: GoPtr<Message>): bool {
  if (list !== undefined && NodeList_HasTrailingComma(list)) {
    return Checker_grammarErrorAtPos(receiver, list!.Nodes[0], NodeList_End(list) - ",".length, ",".length, diag);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarTypeParameterList","kind":"method","status":"implemented","sigHash":"e0d95c60e6b16c268fa288bbf965cfc1abc6155aa0f2d02fe3b33014bde5e0da","bodyHash":"729efaa2cb75faa37ac3cd5abf90c73c0f3abb10a35454c4c9d49bd40b397afa"}
 *
 * Go source:
 * func (c *Checker) checkGrammarTypeParameterList(typeParameters *ast.NodeList, file *ast.SourceFile) bool {
 * 	if typeParameters != nil && len(typeParameters.Nodes) == 0 {
 * 		start := typeParameters.Pos() - len("<")
 * 		end := scanner.SkipTrivia(file.Text(), typeParameters.End()) + len(">")
 * 		return c.grammarErrorAtPos(file.AsNode(), start, end-start, diagnostics.Type_parameter_list_cannot_be_empty)
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarTypeParameterList(receiver: GoPtr<Checker>, typeParameters: GoPtr<NodeList>, file: GoPtr<SourceFile>): bool {
  if (typeParameters !== undefined && typeParameters!.Nodes.length === 0) {
    const start = NodeList_Pos(typeParameters) - "<".length;
    const end = SkipTrivia(SourceFile_Text(file), NodeList_End(typeParameters)) + ">".length;
    return Checker_grammarErrorAtPos(receiver, file as unknown as GoPtr<Node>, start, end - start, Type_parameter_list_cannot_be_empty);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarParameterList","kind":"method","status":"implemented","sigHash":"6d6e4dbbeaefbd4cc4091aa38b4ab5a2ce7d26f1266d8136737c1892ff9cb8b1","bodyHash":"e9d8d1fa67301afe4394612d4ff28b3600214087418ed3a299b88e8a206bf642"}
 *
 * Go source:
 * func (c *Checker) checkGrammarParameterList(parameters *ast.NodeList) bool {
 * 	seenOptionalParameter := false
 * 	parameterCount := len(parameters.Nodes)
 * 
 * 	for i := range parameterCount {
 * 		parameter := parameters.Nodes[i].AsParameterDeclaration()
 * 		if parameter.DotDotDotToken != nil {
 * 			if i != parameterCount-1 {
 * 				return c.grammarErrorOnNode(parameter.DotDotDotToken, diagnostics.A_rest_parameter_must_be_last_in_a_parameter_list)
 * 			}
 * 			if parameter.Flags&ast.NodeFlagsAmbient == 0 {
 * 				c.checkGrammarForDisallowedTrailingComma(parameters, diagnostics.A_rest_parameter_or_binding_pattern_may_not_have_a_trailing_comma)
 * 			}
 * 
 * 			if parameter.QuestionToken != nil {
 * 				return c.grammarErrorOnNode(parameter.QuestionToken, diagnostics.A_rest_parameter_cannot_be_optional)
 * 			}
 * 
 * 			if parameter.Initializer != nil {
 * 				return c.grammarErrorOnNode(parameter.Name(), diagnostics.A_rest_parameter_cannot_have_an_initializer)
 * 			}
 * 		} else if isOptionalDeclaration(parameter.AsNode()) {
 * 			seenOptionalParameter = true
 * 			// A reparsed '?' token indicates a bracketed name in @param tag
 * 			if parameter.QuestionToken != nil && parameter.QuestionToken.Flags&ast.NodeFlagsReparsed == 0 && parameter.Initializer != nil {
 * 				return c.grammarErrorOnNode(parameter.Name(), diagnostics.Parameter_cannot_have_question_mark_and_initializer)
 * 			}
 * 		} else if seenOptionalParameter && parameter.Initializer == nil {
 * 			return c.grammarErrorOnNode(parameter.Name(), diagnostics.A_required_parameter_cannot_follow_an_optional_parameter)
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarParameterList(receiver: GoPtr<Checker>, parameters: GoPtr<NodeList>): bool {
  let seenOptionalParameter = false;
  const parameterCount = parameters!.Nodes.length;
  for (let i = 0; i < parameterCount; i++) {
    const parameter = AsParameterDeclaration(parameters!.Nodes[i]);
    if (parameter!.DotDotDotToken !== undefined) {
      if (i !== parameterCount - 1) {
        return Checker_grammarErrorOnNode(receiver, parameter!.DotDotDotToken, A_rest_parameter_must_be_last_in_a_parameter_list);
      }
      if ((parameter!.Flags & NodeFlagsAmbient) === 0) {
        Checker_checkGrammarForDisallowedTrailingComma(receiver, parameters, A_rest_parameter_or_binding_pattern_may_not_have_a_trailing_comma);
      }
      if (parameter!.QuestionToken !== undefined) {
        return Checker_grammarErrorOnNode(receiver, parameter!.QuestionToken, A_rest_parameter_cannot_be_optional);
      }
      if (parameter!.Initializer !== undefined) {
        return Checker_grammarErrorOnNode(receiver, Node_Name(parameter as unknown as GoPtr<Node>), A_rest_parameter_cannot_have_an_initializer);
      }
    } else if (isOptionalDeclaration(parameter as unknown as GoPtr<Node>)) {
      seenOptionalParameter = true;
      // A reparsed '?' token indicates a bracketed name in @param tag
      if (parameter!.QuestionToken !== undefined && (parameter!.QuestionToken!.Flags & NodeFlagsReparsed) === 0 && parameter!.Initializer !== undefined) {
        return Checker_grammarErrorOnNode(receiver, Node_Name(parameter as unknown as GoPtr<Node>), Parameter_cannot_have_question_mark_and_initializer);
      }
    } else if (seenOptionalParameter && parameter!.Initializer === undefined) {
      return Checker_grammarErrorOnNode(receiver, Node_Name(parameter as unknown as GoPtr<Node>), A_required_parameter_cannot_follow_an_optional_parameter);
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForUseStrictSimpleParameterList","kind":"method","status":"implemented","sigHash":"2e19063ec0a437a8c220065365061dc49d2a3789be9a47cf2e8db62b3d229ce9","bodyHash":"b718e49840666faf668d0537dd89cff537d847791ea166e6f19feda30e41796f"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForUseStrictSimpleParameterList(node *ast.Node) bool {
 * 	if c.languageVersion >= core.ScriptTargetES2016 {
 * 		body := node.Body()
 * 		var useStrictDirective *ast.Node
 * 		if body != nil && ast.IsBlock(body) {
 * 			useStrictDirective = binder.FindUseStrictPrologue(ast.GetSourceFileOfNode(node), body.Statements())
 * 		}
 * 		if useStrictDirective != nil {
 * 			nonSimpleParameters := core.Filter(node.Parameters(), func(n *ast.Node) bool {
 * 				parameter := n.AsParameterDeclaration()
 * 				return parameter.Initializer != nil || ast.IsBindingPattern(parameter.Name()) || isRestParameter(parameter.AsNode())
 * 			})
 * 			if len(nonSimpleParameters) != 0 {
 * 				for _, parameter := range nonSimpleParameters {
 * 					err := c.error(parameter, diagnostics.This_parameter_is_not_allowed_with_use_strict_directive)
 * 					err.AddRelatedInfo(createDiagnosticForNode(useStrictDirective, diagnostics.X_use_strict_directive_used_here))
 * 				}
 * 
 * 				err := c.error(useStrictDirective, diagnostics.X_use_strict_directive_cannot_be_used_with_non_simple_parameter_list)
 * 				for index, parameter := range nonSimpleParameters {
 * 					var relatedMessage *diagnostics.Message
 * 					if index == 0 {
 * 						relatedMessage = diagnostics.Non_simple_parameter_declared_here
 * 					} else {
 * 						relatedMessage = diagnostics.X_and_here
 * 					}
 * 					err.AddRelatedInfo(createDiagnosticForNode(parameter, relatedMessage))
 * 				}
 * 
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarForUseStrictSimpleParameterList(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (receiver!.languageVersion >= ScriptTargetES2016) {
    const body = Node_Body(node);
    let useStrictDirective: GoPtr<Node> = undefined;
    if (body !== undefined && IsBlock(body)) {
      const stmts = Node_Statements(body);
      if (stmts !== undefined) {
        useStrictDirective = FindUseStrictPrologue(GetSourceFileOfNode(node), stmts);
      }
    }
    if (useStrictDirective !== undefined) {
      const nonSimpleParameters = Filter(Node_Parameters(node), (n: GoPtr<Node>) => {
        const parameter = AsParameterDeclaration(n);
        return parameter!.Initializer !== undefined || IsBindingPattern(Node_Name(n)) || isRestParameter(n);
      });
      if (nonSimpleParameters.length !== 0) {
        for (const parameter of nonSimpleParameters) {
          const err = Checker_error(receiver, parameter, This_parameter_is_not_allowed_with_use_strict_directive);
          Diagnostic_AddRelatedInfo(err, createDiagnosticForNode(useStrictDirective, X_use_strict_directive_used_here));
        }
        const err = Checker_error(receiver, useStrictDirective, X_use_strict_directive_cannot_be_used_with_non_simple_parameter_list);
        for (let index = 0; index < nonSimpleParameters.length; index++) {
          const parameter = nonSimpleParameters[index];
          const relatedMessage = index === 0 ? Non_simple_parameter_declared_here : X_and_here;
          Diagnostic_AddRelatedInfo(err, createDiagnosticForNode(parameter, relatedMessage));
        }
        return true;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarFunctionLikeDeclaration","kind":"method","status":"implemented","sigHash":"870d17938e226df009bf5a745d939bb4763b608c00ac15058839cae25d211a82","bodyHash":"62bef1861f89393a91c7e637dd60ac50d262015fcfefc4024acbbd1dfa0df455"}
 *
 * Go source:
 * func (c *Checker) checkGrammarFunctionLikeDeclaration(node *ast.Node) bool {
 * 	// Prevent cascading error by short-circuit
 * 	file := ast.GetSourceFileOfNode(node)
 * 	funcData := node.FunctionLikeData()
 * 	return c.checkGrammarModifiers(node) || c.checkGrammarTypeParameterList(funcData.TypeParameters, file) ||
 * 		c.checkGrammarParameterList(funcData.Parameters) || c.checkGrammarArrowFunction(node, file) ||
 * 		(ast.IsFunctionLikeDeclaration(node) && c.checkGrammarForUseStrictSimpleParameterList(node))
 * }
 */
export function Checker_checkGrammarFunctionLikeDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  // Prevent cascading error by short-circuit
  const file = GetSourceFileOfNode(node);
  const funcData = Node_FunctionLikeData(node);
  return Checker_checkGrammarModifiers(receiver, node) || Checker_checkGrammarTypeParameterList(receiver, funcData!.TypeParameters, file) ||
    Checker_checkGrammarParameterList(receiver, funcData!.Parameters) || Checker_checkGrammarArrowFunction(receiver, node, file) ||
    (IsFunctionLikeDeclaration(node) && Checker_checkGrammarForUseStrictSimpleParameterList(receiver, node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarClassLikeDeclaration","kind":"method","status":"implemented","sigHash":"5ce56af70ed0a67134918545c6f91a27f995da5eef93608d35add56509c0a37a","bodyHash":"5fa1697611a8d67acc03d48d2d7b19b9ab668a480bddb226d27776af804ffe53"}
 *
 * Go source:
 * func (c *Checker) checkGrammarClassLikeDeclaration(node *ast.Node) bool {
 * 	file := ast.GetSourceFileOfNode(node)
 * 	return c.checkGrammarClassDeclarationHeritageClauses(node, file) || c.checkGrammarTypeParameterList(node.TypeParameterList(), file)
 * }
 */
export function Checker_checkGrammarClassLikeDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const file = GetSourceFileOfNode(node);
  return Checker_checkGrammarClassDeclarationHeritageClauses(receiver, node as unknown as GoPtr<ClassLikeDeclaration>, file) || Checker_checkGrammarTypeParameterList(receiver, Node_TypeParameterList(node), file);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarArrowFunction","kind":"method","status":"implemented","sigHash":"5e3226bd327fd486b6abd9e2779555b44c3d01056d43c314cf4f536aada72350","bodyHash":"a06aa50d7e1a1648be7c8be83a934490b8422c5bae78e9dd7bfacd97b1b350fc"}
 *
 * Go source:
 * func (c *Checker) checkGrammarArrowFunction(node *ast.Node, file *ast.SourceFile) bool {
 * 	if !ast.IsArrowFunction(node) {
 * 		return false
 * 	}
 * 
 * 	arrowFunc := node.AsArrowFunction()
 * 	typeParameters := arrowFunc.TypeParameters
 * 	if typeParameters != nil {
 * 		typeParamNodes := typeParameters.Nodes
 * 		hasConstraint := len(typeParamNodes) > 0 && typeParamNodes[0].AsTypeParameterDeclaration().Constraint != nil
 * 		if !(len(typeParamNodes) > 1 || typeParameters.HasTrailingComma() || hasConstraint) {
 * 			if tspath.FileExtensionIsOneOf(file.FileName(), []string{tspath.ExtensionMts, tspath.ExtensionCts}) {
 * 				// TODO(danielr): should we return early here?
 * 				c.grammarErrorOnNode(typeParameters.Nodes[0], diagnostics.This_syntax_is_reserved_in_files_with_the_mts_or_cts_extension_Add_a_trailing_comma_or_explicit_constraint)
 * 			}
 * 		}
 * 	}
 * 
 * 	equalsGreaterThanToken := arrowFunc.EqualsGreaterThanToken
 * 	startLine := scanner.GetECMALineOfPosition(file, equalsGreaterThanToken.Pos())
 * 	endLine := scanner.GetECMALineOfPosition(file, equalsGreaterThanToken.End())
 * 	return startLine != endLine && c.grammarErrorOnNode(equalsGreaterThanToken, diagnostics.Line_terminator_not_permitted_before_arrow)
 * }
 */
export function Checker_checkGrammarArrowFunction(receiver: GoPtr<Checker>, node: GoPtr<Node>, file: GoPtr<SourceFile>): bool {
  if (!IsArrowFunctionPred(node)) {
    return false;
  }
  const arrowFunc = AsArrowFunction(node);
  const typeParameters = arrowFunc!.TypeParameters;
  if (typeParameters !== undefined) {
    const typeParamNodes = typeParameters!.Nodes;
    const hasConstraint = typeParamNodes.length > 0 && AsTypeParameterDeclaration(typeParamNodes[0])!.Constraint !== undefined;
    if (!(typeParamNodes.length > 1 || NodeList_HasTrailingComma(typeParameters) || hasConstraint)) {
      if (FileExtensionIsOneOf(SourceFile_FileName(file), [ExtensionMts, ExtensionCts])) {
        // TODO(danielr): should we return early here?
        Checker_grammarErrorOnNode(receiver, typeParameters!.Nodes[0], This_syntax_is_reserved_in_files_with_the_mts_or_cts_extension_Add_a_trailing_comma_or_explicit_constraint);
      }
    }
  }
  const equalsGreaterThanToken = arrowFunc!.EqualsGreaterThanToken;
  const sourceFileLike: SourceFileLike = { Text: () => SourceFile_Text(file), ECMALineMap: () => SourceFile_ECMALineMap(file) };
  const startLine = GetECMALineOfPosition(sourceFileLike, Node_Pos(equalsGreaterThanToken));
  const endLine = GetECMALineOfPosition(sourceFileLike, Node_End(equalsGreaterThanToken));
  return startLine !== endLine && Checker_grammarErrorOnNode(receiver, equalsGreaterThanToken, Line_terminator_not_permitted_before_arrow);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarIndexSignatureParameters","kind":"method","status":"implemented","sigHash":"83c0df83bc63fd85c1dbf6c6d1839adbed082d31e52e645fb4981b0a30f33eb1","bodyHash":"ab0d368e8ba74f732caf12e7f833347c47062ad0e65eb0c06a1822560d3bb690"}
 *
 * Go source:
 * func (c *Checker) checkGrammarIndexSignatureParameters(node *ast.IndexSignatureDeclaration) bool {
 * 	paramNodes := node.Parameters.Nodes
 * 
 * 	if len(paramNodes) == 0 {
 * 		return c.grammarErrorOnNode(node.AsNode(), diagnostics.An_index_signature_must_have_exactly_one_parameter)
 * 	}
 * 
 * 	parameter := paramNodes[0].AsParameterDeclaration()
 * 	if len(paramNodes) != 1 {
 * 		return c.grammarErrorOnNode(parameter.Name(), diagnostics.An_index_signature_must_have_exactly_one_parameter)
 * 	}
 * 
 * 	c.checkGrammarForDisallowedTrailingComma(node.Parameters, diagnostics.An_index_signature_cannot_have_a_trailing_comma)
 * 	if parameter.DotDotDotToken != nil {
 * 		return c.grammarErrorOnNode(parameter.DotDotDotToken, diagnostics.An_index_signature_cannot_have_a_rest_parameter)
 * 	}
 * 	if parameter.Modifiers() != nil {
 * 		return c.grammarErrorOnNode(parameter.Name(), diagnostics.An_index_signature_parameter_cannot_have_an_accessibility_modifier)
 * 	}
 * 	if parameter.QuestionToken != nil {
 * 		return c.grammarErrorOnNode(parameter.QuestionToken, diagnostics.An_index_signature_parameter_cannot_have_a_question_mark)
 * 	}
 * 	if parameter.Initializer != nil {
 * 		return c.grammarErrorOnNode(parameter.Name(), diagnostics.An_index_signature_parameter_cannot_have_an_initializer)
 * 	}
 * 	typeNode := parameter.Type
 * 	if typeNode == nil {
 * 		return c.grammarErrorOnNode(parameter.Name(), diagnostics.An_index_signature_parameter_must_have_a_type_annotation)
 * 	}
 * 	t := c.getTypeFromTypeNode(typeNode)
 * 	if someType(t, func(t *Type) bool {
 * 		return t.flags&TypeFlagsStringOrNumberLiteralOrUnique != 0
 * 	}) || c.isGenericType(t) {
 * 		return c.grammarErrorOnNode(parameter.Name(), diagnostics.An_index_signature_parameter_type_cannot_be_a_literal_type_or_generic_type_Consider_using_a_mapped_object_type_instead)
 * 	}
 * 	if !everyType(t, c.isValidIndexKeyType) {
 * 		return c.grammarErrorOnNode(parameter.Name(), diagnostics.An_index_signature_parameter_type_must_be_string_number_symbol_or_a_template_literal_type)
 * 	}
 * 	if node.Type == nil {
 * 		return c.grammarErrorOnNode(node.AsNode(), diagnostics.An_index_signature_must_have_a_type_annotation)
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarIndexSignatureParameters(receiver: GoPtr<Checker>, node: GoPtr<IndexSignatureDeclaration>): bool {
  const paramNodes = node!.Parameters!.Nodes;
  if (paramNodes.length === 0) {
    return Checker_grammarErrorOnNode(receiver, node as unknown as GoPtr<Node>, An_index_signature_must_have_exactly_one_parameter);
  }
  const parameter = AsParameterDeclaration(paramNodes[0]);
  if (paramNodes.length !== 1) {
    return Checker_grammarErrorOnNode(receiver, Node_Name(paramNodes[0]), An_index_signature_must_have_exactly_one_parameter);
  }
  Checker_checkGrammarForDisallowedTrailingComma(receiver, node!.Parameters, An_index_signature_cannot_have_a_trailing_comma);
  if (parameter!.DotDotDotToken !== undefined) {
    return Checker_grammarErrorOnNode(receiver, parameter!.DotDotDotToken, An_index_signature_cannot_have_a_rest_parameter);
  }
  if (Node_Modifiers(paramNodes[0]) !== undefined) {
    return Checker_grammarErrorOnNode(receiver, Node_Name(paramNodes[0]), An_index_signature_parameter_cannot_have_an_accessibility_modifier);
  }
  if (parameter!.QuestionToken !== undefined) {
    return Checker_grammarErrorOnNode(receiver, parameter!.QuestionToken, An_index_signature_parameter_cannot_have_a_question_mark);
  }
  if (parameter!.Initializer !== undefined) {
    return Checker_grammarErrorOnNode(receiver, Node_Name(paramNodes[0]), An_index_signature_parameter_cannot_have_an_initializer);
  }
  const typeNode = parameter!.Type;
  if (typeNode === undefined) {
    return Checker_grammarErrorOnNode(receiver, Node_Name(paramNodes[0]), An_index_signature_parameter_must_have_a_type_annotation);
  }
  const t = Checker_getTypeFromTypeNode(receiver, typeNode);
  if (someType(t, (t2: GoPtr<Type>) => (t2!.flags & TypeFlagsStringOrNumberLiteralOrUnique) !== 0) || Checker_isGenericType(receiver, t)) {
    return Checker_grammarErrorOnNode(receiver, Node_Name(paramNodes[0]), An_index_signature_parameter_type_cannot_be_a_literal_type_or_generic_type_Consider_using_a_mapped_object_type_instead);
  }
  if (!everyType(t, (t2: GoPtr<Type>) => Checker_isValidIndexKeyType(receiver, t2))) {
    return Checker_grammarErrorOnNode(receiver, Node_Name(paramNodes[0]), An_index_signature_parameter_type_must_be_string_number_symbol_or_a_template_literal_type);
  }
  if (node!.Type === undefined) {
    return Checker_grammarErrorOnNode(receiver, node as unknown as GoPtr<Node>, An_index_signature_must_have_a_type_annotation);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarIndexSignature","kind":"method","status":"implemented","sigHash":"f4c85d41a1aeef6724f9eaa1178d072ccc8b4b428c7e40aa8bc99487ea6e8fc5","bodyHash":"82c7484247a90e5e5914b79ed7a134420a1d6b0f3f1b55f764fb8be2da78ef2c"}
 *
 * Go source:
 * func (c *Checker) checkGrammarIndexSignature(node *ast.IndexSignatureDeclaration) bool {
 * 	// Prevent cascading error by short-circuit
 * 	return c.checkGrammarModifiers(node.AsNode()) || c.checkGrammarIndexSignatureParameters(node)
 * }
 */
export function Checker_checkGrammarIndexSignature(receiver: GoPtr<Checker>, node: GoPtr<IndexSignatureDeclaration>): bool {
  // Prevent cascading error by short-circuit
  return Checker_checkGrammarModifiers(receiver, node as unknown as GoPtr<Node>) || Checker_checkGrammarIndexSignatureParameters(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForAtLeastOneTypeArgument","kind":"method","status":"implemented","sigHash":"fcbedb418a0e985b8eb57039e04c12907bb55567fdd86499bd2103086242b9a1","bodyHash":"68aade49e5aa318db13f11c7f28247b21599adb72c1b6fdc23f2649bfc5c25d5"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForAtLeastOneTypeArgument(node *ast.Node, typeArguments *ast.NodeList) bool {
 * 	if typeArguments != nil && len(typeArguments.Nodes) == 0 {
 * 		sourceFile := ast.GetSourceFileOfNode(node)
 * 		start := typeArguments.Pos() - len("<")
 * 		end := scanner.SkipTrivia(sourceFile.Text(), typeArguments.End()) + len(">")
 * 		return c.grammarErrorAtPos(sourceFile.AsNode(), start, end-start, diagnostics.Type_argument_list_cannot_be_empty)
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarForAtLeastOneTypeArgument(receiver: GoPtr<Checker>, node: GoPtr<Node>, typeArguments: GoPtr<NodeList>): bool {
  if (typeArguments !== undefined && typeArguments!.Nodes.length === 0) {
    const sourceFile = GetSourceFileOfNode(node);
    const start = NodeList_Pos(typeArguments) - "<".length;
    const end = SkipTrivia(SourceFile_Text(sourceFile), NodeList_End(typeArguments)) + ">".length;
    return Checker_grammarErrorAtPos(receiver, sourceFile as unknown as GoPtr<Node>, start, end - start, Type_argument_list_cannot_be_empty);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarTypeArguments","kind":"method","status":"implemented","sigHash":"8a90235755408d44657bac57e6cc9800285dd139d038c27d5324bee1f13124ca","bodyHash":"bfef6639595660c25f27c8c9c1b62f6269602de33d16079d61d19aba5a7abf65"}
 *
 * Go source:
 * func (c *Checker) checkGrammarTypeArguments(node *ast.Node, typeArguments *ast.NodeList) bool {
 * 	return c.checkGrammarForDisallowedTrailingComma(typeArguments, diagnostics.Trailing_comma_not_allowed) || c.checkGrammarForAtLeastOneTypeArgument(node, typeArguments)
 * }
 */
export function Checker_checkGrammarTypeArguments(receiver: GoPtr<Checker>, node: GoPtr<Node>, typeArguments: GoPtr<NodeList>): bool {
  return Checker_checkGrammarForDisallowedTrailingComma(receiver, typeArguments, Trailing_comma_not_allowed) || Checker_checkGrammarForAtLeastOneTypeArgument(receiver, node, typeArguments);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarTaggedTemplateChain","kind":"method","status":"implemented","sigHash":"188b01ce1fdfda0d94d79eda4aec280e7fd9bdb72684b789a504fe8526796c78","bodyHash":"8168c582adce34621bc3ea08ef6c319403716d63737ca013bac0959889a483ad"}
 *
 * Go source:
 * func (c *Checker) checkGrammarTaggedTemplateChain(node *ast.TaggedTemplateExpression) bool {
 * 	if node.QuestionDotToken != nil || node.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 		return c.grammarErrorOnNode(node.Template, diagnostics.Tagged_template_expressions_are_not_permitted_in_an_optional_chain)
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarTaggedTemplateChain(receiver: GoPtr<Checker>, node: GoPtr<TaggedTemplateExpression>): bool {
  if (node!.QuestionDotToken !== undefined || (node!.Flags & NodeFlagsOptionalChain) !== 0) {
    return Checker_grammarErrorOnNode(receiver, node!.Template as unknown as GoPtr<Node>, Tagged_template_expressions_are_not_permitted_in_an_optional_chain);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarHeritageClause","kind":"method","status":"implemented","sigHash":"123b8fb0790f9d6f266d85a2b84e7ad075b6494d978395ac2015eafe83cca003","bodyHash":"9136aab077f29ab5537410e30027b1d9a623eb122c69a05b5f2188738bd32215"}
 *
 * Go source:
 * func (c *Checker) checkGrammarHeritageClause(node *ast.HeritageClause) bool {
 * 	types := node.Types
 * 	if c.checkGrammarForDisallowedTrailingComma(types, diagnostics.Trailing_comma_not_allowed) {
 * 		return true
 * 	}
 * 	if types != nil && len(types.Nodes) == 0 {
 * 		listType := scanner.TokenToString(node.Token)
 * 		// TODO(danielr): why not error on the token?
 * 		return c.grammarErrorAtPos(node.AsNode(), types.Pos(), 0, diagnostics.X_0_list_cannot_be_empty, listType)
 * 	}
 * 
 * 	for _, node := range types.Nodes { //nolint:modernize
 * 		if c.checkGrammarExpressionWithTypeArguments(node) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarHeritageClause(receiver: GoPtr<Checker>, node: GoPtr<HeritageClause>): bool {
  const types = node!.Types;
  if (Checker_checkGrammarForDisallowedTrailingComma(receiver, types, Trailing_comma_not_allowed)) {
    return true;
  }
  if (types !== undefined && types!.Nodes.length === 0) {
    const listType = TokenToString(node!.Token);
    // TODO(danielr): why not error on the token?
    return Checker_grammarErrorAtPos(receiver, node as unknown as GoPtr<Node>, NodeList_Pos(types), 0, X_0_list_cannot_be_empty, listType);
  }
  if (types !== undefined) {
    for (const n of types!.Nodes) {
      if (Checker_checkGrammarExpressionWithTypeArguments(receiver, n)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarExpressionWithTypeArguments","kind":"method","status":"implemented","sigHash":"af6e2eff9c43401e230029def29304e11ed9f61ae6cc473a3bc52c69964b4789","bodyHash":"8ec334978dfb08f4957c60401cbdf0d6a68b09f511b5819a3900c92b7a2d8d5e"}
 *
 * Go source:
 * func (c *Checker) checkGrammarExpressionWithTypeArguments(node *ast.Node /*Union[ExpressionWithTypeArguments, TypeQuery]* /) bool {
 * 	if ast.IsExpressionWithTypeArguments(node) && node.Expression().Kind == ast.KindImportKeyword && node.TypeArgumentList() != nil {
 * 		return c.grammarErrorOnNode(node, diagnostics.This_use_of_import_is_invalid_import_calls_can_be_written_but_they_must_have_parentheses_and_cannot_have_type_arguments)
 * 	}
 * 	return c.checkGrammarTypeArguments(node, node.TypeArgumentList())
 * }
 */
export function Checker_checkGrammarExpressionWithTypeArguments(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (IsExpressionWithTypeArguments(node) && Node_Expression(node)!.Kind === KindImportKeyword && Node_TypeArgumentList(node) !== undefined) {
    return Checker_grammarErrorOnNode(receiver, node, This_use_of_import_is_invalid_import_calls_can_be_written_but_they_must_have_parentheses_and_cannot_have_type_arguments);
  }
  return Checker_checkGrammarTypeArguments(receiver, node, Node_TypeArgumentList(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarClassDeclarationHeritageClauses","kind":"method","status":"implemented","sigHash":"c6081052108d5899f0301c930f47c21933a6f8f94cfe1a4316b370536d1cb3a5","bodyHash":"d517a586e6c8baca640866258aa2714b230d333247d7c8055bf37c3bf4f67349"}
 *
 * Go source:
 * func (c *Checker) checkGrammarClassDeclarationHeritageClauses(node *ast.ClassLikeDeclaration, file *ast.SourceFile) bool {
 * 	seenExtendsClause := false
 * 	seenImplementsClause := false
 * 
 * 	classLikeData := node.ClassLikeData()
 * 
 * 	if !c.checkGrammarModifiers(node) && classLikeData.HeritageClauses != nil {
 * 		for _, heritageClauseNode := range classLikeData.HeritageClauses.Nodes {
 * 			heritageClause := heritageClauseNode.AsHeritageClause()
 * 			if heritageClause.Token == ast.KindExtendsKeyword {
 * 				if seenExtendsClause {
 * 					return c.grammarErrorOnFirstToken(heritageClauseNode, diagnostics.X_extends_clause_already_seen)
 * 				}
 * 
 * 				if seenImplementsClause {
 * 					return c.grammarErrorOnFirstToken(heritageClauseNode, diagnostics.X_extends_clause_must_precede_implements_clause)
 * 				}
 * 
 * 				typeNodes := heritageClause.Types.Nodes
 * 				if len(typeNodes) > 1 {
 * 					return c.grammarErrorOnFirstToken(typeNodes[1], diagnostics.Classes_can_only_extend_a_single_class)
 * 				}
 * 
 * 				if len(typeNodes) > 0 {
 * 					for _, j := range node.EagerJSDoc(file) {
 * 						if j.AsJSDoc().Tags == nil {
 * 							continue
 * 						}
 * 						for _, tag := range j.AsJSDoc().Tags.Nodes {
 * 							if tag.Kind == ast.KindJSDocAugmentsTag {
 * 								target := typeNodes[0].AsExpressionWithTypeArguments()
 * 								source := tag.ClassName().AsExpressionWithTypeArguments()
 * 								targetName := getIdentifierFromEntityNameExpression(target.Expression)
 * 								sourceName := getIdentifierFromEntityNameExpression(source.Expression)
 * 								if targetName != nil && sourceName != nil && targetName.Text() != sourceName.Text() {
 * 									return c.grammarErrorOnNode(sourceName, diagnostics.JSDoc_0_1_does_not_match_the_extends_2_clause, tag.TagName().Text(), sourceName.Text(), targetName.Text())
 * 								}
 * 							}
 * 						}
 * 					}
 * 				}
 * 				seenExtendsClause = true
 * 			} else {
 * 				if heritageClause.Token != ast.KindImplementsKeyword {
 * 					panic(fmt.Sprintf("Unexpected token %q", heritageClause.Token))
 * 				}
 * 				if seenImplementsClause {
 * 					return c.grammarErrorOnFirstToken(heritageClauseNode, diagnostics.X_implements_clause_already_seen)
 * 				}
 * 
 * 				seenImplementsClause = true
 * 			}
 * 
 * 			// Grammar checking heritageClause inside class declaration
 * 			c.checkGrammarHeritageClause(heritageClause)
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarClassDeclarationHeritageClauses(receiver: GoPtr<Checker>, node: GoPtr<ClassLikeDeclaration>, file: GoPtr<SourceFile>): bool {
  let seenExtendsClause = false;
  let seenImplementsClause = false;
  const classLikeData = Node_ClassLikeData(node as unknown as GoPtr<Node>);
  if (!Checker_checkGrammarModifiers(receiver, node as unknown as GoPtr<Node>) && classLikeData!.HeritageClauses !== undefined) {
    for (const heritageClauseNode of classLikeData!.HeritageClauses!.Nodes) {
      const heritageClause = AsHeritageClause(heritageClauseNode);
      if (heritageClause!.Token === KindExtendsKeyword) {
        if (seenExtendsClause) {
          return Checker_grammarErrorOnFirstToken(receiver, heritageClauseNode, X_extends_clause_already_seen);
        }
        if (seenImplementsClause) {
          return Checker_grammarErrorOnFirstToken(receiver, heritageClauseNode, X_extends_clause_must_precede_implements_clause);
        }
        const typeNodes = heritageClause!.Types!.Nodes;
        if (typeNodes.length > 1) {
          return Checker_grammarErrorOnFirstToken(receiver, typeNodes[1], Classes_can_only_extend_a_single_class);
        }
        if (typeNodes.length > 0) {
          for (const j of Node_EagerJSDoc(node as unknown as GoPtr<Node>, file)) {
            if (AsJSDoc(j)!.Tags === undefined) {
              continue;
            }
            for (const tag of AsJSDoc(j)!.Tags!.Nodes) {
              if (tag!.Kind === KindJSDocAugmentsTag) {
                const target = AsExpressionWithTypeArguments(typeNodes[0]);
                const source = AsExpressionWithTypeArguments(Node_ClassName(tag));
                const targetName = getIdentifierFromEntityNameExpression(target!.Expression as unknown as GoPtr<Node>);
                const sourceName = getIdentifierFromEntityNameExpression(source!.Expression as unknown as GoPtr<Node>);
                if (targetName !== undefined && sourceName !== undefined && Node_Text(targetName) !== Node_Text(sourceName)) {
                  return Checker_grammarErrorOnNode(receiver, sourceName, JSDoc_0_1_does_not_match_the_extends_2_clause,
                    Node_Text(Node_TagName(tag)), Node_Text(sourceName), Node_Text(targetName));
                }
              }
            }
          }
        }
        seenExtendsClause = true;
      } else {
        if (heritageClause!.Token !== KindImplementsKeyword) {
          throw new globalThis.Error(`Unexpected token "${heritageClause!.Token}"`);
        }
        if (seenImplementsClause) {
          return Checker_grammarErrorOnFirstToken(receiver, heritageClauseNode, X_implements_clause_already_seen);
        }
        seenImplementsClause = true;
      }
      // Grammar checking heritageClause inside class declaration
      Checker_checkGrammarHeritageClause(receiver, heritageClause);
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarInterfaceDeclaration","kind":"method","status":"implemented","sigHash":"c9b54167c596379eae7c93fe642627266fa2c134ee4008edabc92329f73050e6","bodyHash":"ef89e20fe1cba09c23ee91640e246e8f6f93327eec6f53114c0b82b648a8edc0"}
 *
 * Go source:
 * func (c *Checker) checkGrammarInterfaceDeclaration(node *ast.InterfaceDeclaration) bool {
 * 	if node.HeritageClauses != nil {
 * 		seenExtendsClause := false
 * 		for _, heritageClauseNode := range node.HeritageClauses.Nodes {
 * 			heritageClause := heritageClauseNode.AsHeritageClause()
 * 
 * 			switch heritageClause.Token {
 * 			case ast.KindExtendsKeyword:
 * 				if seenExtendsClause {
 * 					return c.grammarErrorOnFirstToken(heritageClauseNode, diagnostics.X_extends_clause_already_seen)
 * 				}
 * 				seenExtendsClause = true
 * 			case ast.KindImplementsKeyword:
 * 				return c.grammarErrorOnFirstToken(heritageClauseNode, diagnostics.Interface_declaration_cannot_have_implements_clause)
 * 			default:
 * 				panic(fmt.Sprintf("Unexpected token %q", heritageClause.Token.String()))
 * 			}
 * 
 * 			// Grammar checking heritageClause inside class declaration
 * 			c.checkGrammarHeritageClause(heritageClause)
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarInterfaceDeclaration(receiver: GoPtr<Checker>, node: GoPtr<InterfaceDeclaration>): bool {
  if (node!.HeritageClauses !== undefined) {
    let seenExtendsClause = false;
    for (const heritageClauseNode of node!.HeritageClauses!.Nodes) {
      const heritageClause = AsHeritageClause(heritageClauseNode);
      switch (heritageClause!.Token) {
        case KindExtendsKeyword:
          if (seenExtendsClause) {
            return Checker_grammarErrorOnFirstToken(receiver, heritageClauseNode, X_extends_clause_already_seen);
          }
          seenExtendsClause = true;
          break;
        case KindImplementsKeyword:
          return Checker_grammarErrorOnFirstToken(receiver, heritageClauseNode, Interface_declaration_cannot_have_implements_clause);
        default:
          throw new globalThis.Error(`Unexpected token "${heritageClause!.Token}"`);
      }
      // Grammar checking heritageClause inside class declaration
      Checker_checkGrammarHeritageClause(receiver, heritageClause);
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarComputedPropertyName","kind":"method","status":"implemented","sigHash":"5e0329796e2bfc37ebb51cde9c5823f23cd2988bb8fd365239b6cebc9605a1a3","bodyHash":"8b26ca8e08f0493f323cf111b35d54b18be8f69ba2ee6f2a5dab853b3e8ac6e9"}
 *
 * Go source:
 * func (c *Checker) checkGrammarComputedPropertyName(node *ast.Node) bool {
 * 	// If node is not a computedPropertyName, just skip the grammar checking
 * 	if node.Kind != ast.KindComputedPropertyName {
 * 		return false
 * 	}
 * 
 * 	computedPropertyName := node.AsComputedPropertyName()
 * 	if computedPropertyName.Expression.Kind == ast.KindBinaryExpression && computedPropertyName.Expression.AsBinaryExpression().OperatorToken.Kind == ast.KindCommaToken {
 * 		return c.grammarErrorOnNode(computedPropertyName.Expression, diagnostics.A_comma_expression_is_not_allowed_in_a_computed_property_name)
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarComputedPropertyName(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  // If node is not a computedPropertyName, just skip the grammar checking
  if (node!.Kind !== KindComputedPropertyName) {
    return false;
  }
  const computedPropertyName = AsComputedPropertyName(node);
  if (computedPropertyName!.Expression!.Kind === KindBinaryExpression && AsBinaryExpression(computedPropertyName!.Expression as unknown as GoPtr<Node>)!.OperatorToken!.Kind === KindCommaToken) {
    return Checker_grammarErrorOnNode(receiver, computedPropertyName!.Expression as unknown as GoPtr<Node>, A_comma_expression_is_not_allowed_in_a_computed_property_name);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForGenerator","kind":"method","status":"implemented","sigHash":"21bf494af82f009b66f87db069de7394afd1c3d3a2a4cc3c3f65c8155e08f2eb","bodyHash":"702fc60f1bab8fda929c0622d4fe857a02ac8b5a1fa87ff3d39f7f3f382ca707"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForGenerator(node *ast.Node) bool {
 * 	if bodyData := node.BodyData(); bodyData != nil && bodyData.AsteriskToken != nil {
 * 		if node.Kind != ast.KindFunctionDeclaration && node.Kind != ast.KindFunctionExpression && node.Kind != ast.KindMethodDeclaration {
 * 			panic(fmt.Sprintf("Unexpected node kind %q", node.Kind))
 * 		}
 * 		if node.Flags&ast.NodeFlagsAmbient != 0 {
 * 			return c.grammarErrorOnNode(bodyData.AsteriskToken, diagnostics.Generators_are_not_allowed_in_an_ambient_context)
 * 		}
 * 		if bodyData.Body == nil {
 * 			return c.grammarErrorOnNode(bodyData.AsteriskToken, diagnostics.An_overload_signature_cannot_be_declared_as_a_generator)
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarForGenerator(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const bodyData = Node_BodyData(node);
  if (bodyData !== undefined && bodyData!.AsteriskToken !== undefined) {
    if (node!.Kind !== KindFunctionDeclaration && node!.Kind !== KindFunctionExpression && node!.Kind !== KindMethodDeclaration) {
      throw new globalThis.Error(`Unexpected node kind "${node!.Kind}"`);
    }
    if ((node!.Flags & NodeFlagsAmbient) !== 0) {
      return Checker_grammarErrorOnNode(receiver, bodyData!.AsteriskToken as unknown as GoPtr<Node>, Generators_are_not_allowed_in_an_ambient_context);
    }
    if (bodyData!.Body === undefined) {
      return Checker_grammarErrorOnNode(receiver, bodyData!.AsteriskToken as unknown as GoPtr<Node>, An_overload_signature_cannot_be_declared_as_a_generator);
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForInvalidQuestionMark","kind":"method","status":"implemented","sigHash":"32e35056d76e9e25f5e2712a0b074ce4bb73efba032e04cb94d590227ecc9b7d","bodyHash":"4c288ecc93f38f277248b5e63670cf82083ec91efd273b04e33e39edde861891"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForInvalidQuestionMark(postfixToken *ast.TokenNode, message *diagnostics.Message) bool {
 * 	return postfixToken != nil && postfixToken.Kind == ast.KindQuestionToken && c.grammarErrorOnNode(postfixToken, message)
 * }
 */
export function Checker_checkGrammarForInvalidQuestionMark(receiver: GoPtr<Checker>, postfixToken: GoPtr<TokenNode>, message: GoPtr<Message>): bool {
  return postfixToken !== undefined && (postfixToken as unknown as GoPtr<Node>)!.Kind === KindQuestionToken && Checker_grammarErrorOnNode(receiver, postfixToken as unknown as GoPtr<Node>, message);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForInvalidExclamationToken","kind":"method","status":"implemented","sigHash":"568a113bf327b24ebea7f0c6544237efac47eddf6357c196a6590f666ed149a9","bodyHash":"bb882157f738777bc861b5678c786e5316b8516598f4697cdd722af0527771d2"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForInvalidExclamationToken(postfixToken *ast.TokenNode, message *diagnostics.Message) bool {
 * 	return postfixToken != nil && postfixToken.Kind == ast.KindExclamationToken && c.grammarErrorOnNode(postfixToken, message)
 * }
 */
export function Checker_checkGrammarForInvalidExclamationToken(receiver: GoPtr<Checker>, postfixToken: GoPtr<TokenNode>, message: GoPtr<Message>): bool {
  return postfixToken !== undefined && (postfixToken as unknown as GoPtr<Node>)!.Kind === KindExclamationToken && Checker_grammarErrorOnNode(receiver, postfixToken as unknown as GoPtr<Node>, message);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarObjectLiteralExpression","kind":"method","status":"implemented","sigHash":"a9c196863e38cf676b534b07fda26c6972ce8786ba7e4da201eed68f8df63b2c","bodyHash":"52d0467ef4fd3442402287687a5bbb8134f7cc34ed02a9fd7299cfeb0bd40c9b"}
 *
 * Go source:
 * func (c *Checker) checkGrammarObjectLiteralExpression(node *ast.ObjectLiteralExpression, inDestructuring bool) bool {
 * 	seen := make(map[string]DeclarationMeaning)
 * 
 * 	var properties []*ast.Node
 * 	if node.Properties != nil {
 * 		properties = node.Properties.Nodes
 * 	}
 * 	for _, prop := range properties {
 * 		if prop.Kind == ast.KindSpreadAssignment {
 * 			spreadAssignment := prop.AsSpreadAssignment()
 * 			if inDestructuring {
 * 				// a rest property cannot be destructured any further
 * 				expression := ast.SkipParentheses(spreadAssignment.Expression)
 * 				if ast.IsArrayLiteralExpression(expression) || ast.IsObjectLiteralExpression(expression) {
 * 					return c.grammarErrorOnNode(spreadAssignment.Expression, diagnostics.A_rest_element_cannot_contain_a_binding_pattern)
 * 				}
 * 			}
 * 			continue
 * 		}
 * 		name := prop.Name()
 * 		if name.Kind == ast.KindComputedPropertyName {
 * 			// If the name is not a ComputedPropertyName, the grammar checking will skip it
 * 			c.checkGrammarComputedPropertyName(name)
 * 		}
 * 
 * 		if prop.Kind == ast.KindShorthandPropertyAssignment && !inDestructuring {
 * 			shorthandProp := prop.AsShorthandPropertyAssignment()
 * 			if shorthandProp.ObjectAssignmentInitializer != nil {
 * 				// having objectAssignmentInitializer is only valid in an ObjectAssignmentPattern.
 * 				// Outside of destructuring, it is a syntax error.
 * 
 * 				// Try to grab the last node prior to the initializer,
 * 				// then error on the first token following (which should be the `=` token).
 * 				var lastNodeBeforeInitializer *ast.Node
 * 				shorthandProp.ForEachChild(func(child *ast.Node) bool {
 * 					if child != shorthandProp.ObjectAssignmentInitializer {
 * 						lastNodeBeforeInitializer = child
 * 						return false
 * 					}
 * 					return true
 * 				})
 * 
 * 				c.grammarErrorOnFirstToken(lastNodeBeforeInitializer, diagnostics.Did_you_mean_to_use_a_Colon_An_can_only_follow_a_property_name_when_the_containing_object_literal_is_part_of_a_destructuring_pattern)
 * 			}
 * 		}
 * 
 * 		if name.Kind == ast.KindPrivateIdentifier {
 * 			c.grammarErrorOnNode(name, diagnostics.Private_identifiers_are_not_allowed_outside_class_bodies)
 * 		}
 * 
 * 		// Modifiers are never allowed on properties except for 'async' on a method declaration
 * 		if modifiers := prop.ModifierNodes(); len(modifiers) != 0 {
 * 			if ast.CanHaveModifiers(prop) {
 * 				for _, mod := range modifiers {
 * 					if ast.IsModifier(mod) && (mod.Kind != ast.KindAsyncKeyword || prop.Kind != ast.KindMethodDeclaration) {
 * 						c.grammarErrorOnNode(mod, diagnostics.X_0_modifier_cannot_be_used_here, scanner.GetTextOfNode(mod))
 * 					}
 * 				}
 * 			} else if ast.CanHaveIllegalModifiers(prop) {
 * 				for _, mod := range modifiers {
 * 					if ast.IsModifier(mod) {
 * 						c.grammarErrorOnNode(mod, diagnostics.X_0_modifier_cannot_be_used_here, scanner.GetTextOfNode(mod))
 * 					}
 * 				}
 * 			}
 * 		}
 * 
 * 		// ECMA-262 11.1.5 Object Initializer
 * 		// If previous is not undefined then throw a SyntaxError exception if any of the following conditions are true
 * 		// a.This production is contained in strict code and IsDataDescriptor(previous) is true and
 * 		// IsDataDescriptor(propId.descriptor) is true.
 * 		//    b.IsDataDescriptor(previous) is true and IsAccessorDescriptor(propId.descriptor) is true.
 * 		//    c.IsAccessorDescriptor(previous) is true and IsDataDescriptor(propId.descriptor) is true.
 * 		//    d.IsAccessorDescriptor(previous) is true and IsAccessorDescriptor(propId.descriptor) is true
 * 		// and either both previous and propId.descriptor have[[Get]] fields or both previous and propId.descriptor have[[Set]] fields
 * 		var currentKind DeclarationMeaning
 * 		switch prop.Kind {
 * 		case ast.KindShorthandPropertyAssignment,
 * 			ast.KindPropertyAssignment:
 * 			var commonProp *ast.NamedMemberBase
 * 			if prop.Kind == ast.KindShorthandPropertyAssignment {
 * 				prop.ClassLikeData()
 * 				commonProp = &prop.AsShorthandPropertyAssignment().NamedMemberBase
 * 			} else {
 * 				commonProp = &prop.AsPropertyAssignment().NamedMemberBase
 * 			}
 * 
 * 			// Grammar checking for computedPropertyName and shorthandPropertyAssignment
 * 			c.checkGrammarForInvalidExclamationToken(commonProp.PostfixToken, diagnostics.A_definite_assignment_assertion_is_not_permitted_in_this_context)
 * 			c.checkGrammarForInvalidQuestionMark(commonProp.PostfixToken, diagnostics.An_object_member_cannot_be_declared_optional)
 * 
 * 			if name.Kind == ast.KindNumericLiteral {
 * 				c.checkGrammarNumericLiteral(name.AsNumericLiteral())
 * 			}
 * 
 * 			if name.Kind == ast.KindBigIntLiteral {
 * 				c.addErrorOrSuggestion(true, createDiagnosticForNode(name, diagnostics.A_bigint_literal_cannot_be_used_as_a_property_name))
 * 			}
 * 
 * 			currentKind = DeclarationMeaningPropertyAssignment
 * 		case ast.KindMethodDeclaration:
 * 			currentKind = DeclarationMeaningMethod
 * 		case ast.KindGetAccessor:
 * 			currentKind = DeclarationMeaningGetAccessor
 * 		case ast.KindSetAccessor:
 * 			currentKind = DeclarationMeaningSetAccessor
 * 		default:
 * 			panic(fmt.Sprintf("Unexpected node kind %q", prop.Kind))
 * 		}
 * 
 * 		if !inDestructuring {
 * 			effectiveName, ok := c.getEffectivePropertyNameForPropertyNameNode(name)
 * 			if !ok {
 * 				continue
 * 			}
 * 
 * 			existingKind := seen[effectiveName]
 * 			if existingKind == 0 {
 * 				seen[effectiveName] = currentKind
 * 			} else {
 * 				if (currentKind&DeclarationMeaningMethod != 0) && (existingKind&DeclarationMeaningMethod != 0) {
 * 					c.grammarErrorOnNode(name, diagnostics.Duplicate_identifier_0, scanner.GetTextOfNode(name))
 * 				} else if (currentKind&DeclarationMeaningPropertyAssignment != 0) && (existingKind&DeclarationMeaningPropertyAssignment != 0) {
 * 					c.grammarErrorOnNode(name, diagnostics.An_object_literal_cannot_have_multiple_properties_with_the_same_name, scanner.GetTextOfNode(name))
 * 				} else if (currentKind&DeclarationMeaningGetOrSetAccessor != 0) && (existingKind&DeclarationMeaningGetOrSetAccessor != 0) {
 * 					if existingKind != DeclarationMeaningGetOrSetAccessor && currentKind != existingKind {
 * 						seen[effectiveName] = currentKind | existingKind
 * 					} else {
 * 						return c.grammarErrorOnNode(name, diagnostics.An_object_literal_cannot_have_multiple_get_Slashset_accessors_with_the_same_name)
 * 					}
 * 				} else {
 * 					return c.grammarErrorOnNode(name, diagnostics.An_object_literal_cannot_have_property_and_accessor_with_the_same_name)
 * 				}
 * 			}
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarObjectLiteralExpression(receiver: GoPtr<Checker>, node: GoPtr<ObjectLiteralExpression>, inDestructuring: bool): bool {
  const seen = new Map<string, DeclarationMeaning>();
  const properties = node!.Properties !== undefined ? node!.Properties!.Nodes : [];
  for (const prop of properties) {
    if (prop!.Kind === KindSpreadAssignment) {
      const spreadAssignment = AsSpreadAssignment(prop);
      if (inDestructuring) {
        const expression = SkipParentheses(spreadAssignment!.Expression as unknown as GoPtr<Node>);
        if (IsArrayLiteralExpression(expression) || IsObjectLiteralExpression(expression)) {
          return Checker_grammarErrorOnNode(receiver, spreadAssignment!.Expression as unknown as GoPtr<Node>, A_rest_element_cannot_contain_a_binding_pattern);
        }
      }
      continue;
    }
    const name = Node_Name(prop);
    if (name!.Kind === KindComputedPropertyName) {
      Checker_checkGrammarComputedPropertyName(receiver, name);
    }
    if (prop!.Kind === KindShorthandPropertyAssignment && !inDestructuring) {
      const shorthandProp = AsShorthandPropertyAssignment(prop);
      if (shorthandProp!.ObjectAssignmentInitializer !== undefined) {
        let lastNodeBeforeInitializer: GoPtr<Node> = undefined;
        Node_ForEachChild(prop, (child: GoPtr<Node>): bool => {
          if (child !== (shorthandProp!.ObjectAssignmentInitializer as unknown as GoPtr<Node>)) {
            lastNodeBeforeInitializer = child;
            return false;
          }
          return true;
        });
        Checker_grammarErrorOnFirstToken(receiver, lastNodeBeforeInitializer, Did_you_mean_to_use_a_Colon_An_can_only_follow_a_property_name_when_the_containing_object_literal_is_part_of_a_destructuring_pattern);
      }
    }
    if (name!.Kind === KindPrivateIdentifier) {
      Checker_grammarErrorOnNode(receiver, name, Private_identifiers_are_not_allowed_outside_class_bodies);
    }
    const modifiers = Node_ModifierNodes(prop) ?? [];
    if (modifiers.length !== 0) {
      if (CanHaveModifiers(prop)) {
        for (const mod of modifiers) {
          if (IsModifier(mod) && (mod!.Kind !== KindAsyncKeyword || prop!.Kind !== KindMethodDeclaration)) {
            Checker_grammarErrorOnNode(receiver, mod, X_0_modifier_cannot_be_used_here, GetTextOfNode(mod));
          }
        }
      } else if (CanHaveIllegalModifiers(prop)) {
        for (const mod of modifiers) {
          if (IsModifier(mod)) {
            Checker_grammarErrorOnNode(receiver, mod, X_0_modifier_cannot_be_used_here, GetTextOfNode(mod));
          }
        }
      }
    }
    let currentKind: DeclarationMeaning;
    switch (prop!.Kind) {
      case KindShorthandPropertyAssignment:
      case KindPropertyAssignment: {
        const postfixToken = prop!.Kind === KindShorthandPropertyAssignment
          ? AsShorthandPropertyAssignment(prop)!.PostfixToken
          : AsPropertyAssignment(prop)!.PostfixToken;
        Checker_checkGrammarForInvalidExclamationToken(receiver, postfixToken as unknown as GoPtr<TokenNode>, A_definite_assignment_assertion_is_not_permitted_in_this_context);
        Checker_checkGrammarForInvalidQuestionMark(receiver, postfixToken as unknown as GoPtr<TokenNode>, An_object_member_cannot_be_declared_optional);
        if (name!.Kind === KindNumericLiteral) {
          Checker_checkGrammarNumericLiteral(receiver, name as unknown as GoPtr<NumericLiteral>);
        }
        if (name!.Kind === KindBigIntLiteral) {
          Checker_addErrorOrSuggestion(receiver, true, createDiagnosticForNode(name, A_bigint_literal_cannot_be_used_as_a_property_name));
        }
        currentKind = DeclarationMeaningPropertyAssignment;
        break;
      }
      case KindMethodDeclaration:
        currentKind = DeclarationMeaningMethod;
        break;
      case KindGetAccessor:
        currentKind = DeclarationMeaningGetAccessor;
        break;
      case KindSetAccessor:
        currentKind = DeclarationMeaningSetAccessor;
        break;
      default:
        throw new globalThis.Error(`Unexpected node kind "${prop!.Kind}"`);
    }
    if (!inDestructuring) {
      const [effectiveName, ok] = Checker_getEffectivePropertyNameForPropertyNameNode(receiver, name);
      if (!ok) {
        continue;
      }
      const existingKind = seen.get(effectiveName) ?? (0 as DeclarationMeaning);
      if (existingKind === 0) {
        seen.set(effectiveName, currentKind);
      } else {
        if ((currentKind & DeclarationMeaningMethod) !== 0 && (existingKind & DeclarationMeaningMethod) !== 0) {
          Checker_grammarErrorOnNode(receiver, name, Duplicate_identifier_0, GetTextOfNode(name));
        } else if ((currentKind & DeclarationMeaningPropertyAssignment) !== 0 && (existingKind & DeclarationMeaningPropertyAssignment) !== 0) {
          Checker_grammarErrorOnNode(receiver, name, An_object_literal_cannot_have_multiple_properties_with_the_same_name, GetTextOfNode(name));
        } else if ((currentKind & DeclarationMeaningGetOrSetAccessor) !== 0 && (existingKind & DeclarationMeaningGetOrSetAccessor) !== 0) {
          if (existingKind !== DeclarationMeaningGetOrSetAccessor && currentKind !== existingKind) {
            seen.set(effectiveName, (currentKind | existingKind) as DeclarationMeaning);
          } else {
            return Checker_grammarErrorOnNode(receiver, name, An_object_literal_cannot_have_multiple_get_Slashset_accessors_with_the_same_name);
          }
        } else {
          return Checker_grammarErrorOnNode(receiver, name, An_object_literal_cannot_have_property_and_accessor_with_the_same_name);
        }
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarJsxElement","kind":"method","status":"implemented","sigHash":"158066c7c61bf24195d7ba706ceb7109a5532cc48c7bb1d119eccd852d7920aa","bodyHash":"5f7a8fd88f75114a89c11c89176f8a17e0c7a275d2830028cdb3b5aabeaa91e4"}
 *
 * Go source:
 * func (c *Checker) checkGrammarJsxElement(node *ast.Node) bool {
 * 	c.checkGrammarJsxName(node.TagName())
 * 	c.checkGrammarTypeArguments(node, node.TypeArgumentList())
 * 	var seen collections.Set[string]
 * 	for _, attrNode := range node.Attributes().Properties() {
 * 		if attrNode.Kind == ast.KindJsxSpreadAttribute {
 * 			continue
 * 		}
 * 		attr := attrNode.AsJsxAttribute()
 * 		name := attr.Name()
 * 		initializer := attr.Initializer
 * 		textOfName := name.Text()
 * 		if !seen.Has(textOfName) {
 * 			seen.Add(textOfName)
 * 		} else {
 * 			return c.grammarErrorOnNode(name, diagnostics.JSX_elements_cannot_have_multiple_attributes_with_the_same_name)
 * 		}
 * 		if initializer != nil && initializer.Kind == ast.KindJsxExpression && initializer.Expression() == nil {
 * 			return c.grammarErrorOnNode(initializer, diagnostics.JSX_attributes_must_only_be_assigned_a_non_empty_expression)
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarJsxElement(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  Checker_checkGrammarJsxName(receiver, Node_TagName(node) as unknown as GoPtr<JsxTagNameExpression>);
  Checker_checkGrammarTypeArguments(receiver, node, Node_TypeArgumentList(node));
  const seen = new Set<string>();
  const attrs = Node_Attributes(node);
  const props = Node_Properties(attrs) ?? [];
  for (const attrNode of props) {
    if (attrNode!.Kind === KindJsxSpreadAttribute) {
      continue;
    }
    const attr = AsJsxAttribute(attrNode);
    const attrName = attr!.name as unknown as GoPtr<Node>;
    const initializer = attr!.Initializer;
    const textOfName = Node_Text(attrName);
    if (!seen.has(textOfName)) {
      seen.add(textOfName);
    } else {
      return Checker_grammarErrorOnNode(receiver, attrName, JSX_elements_cannot_have_multiple_attributes_with_the_same_name);
    }
    if (initializer !== undefined && (initializer as unknown as GoPtr<Node>)!.Kind === KindJsxExpression && Node_Expression(initializer as unknown as GoPtr<Node>) === undefined) {
      return Checker_grammarErrorOnNode(receiver, initializer as unknown as GoPtr<Node>, JSX_attributes_must_only_be_assigned_a_non_empty_expression);
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarJsxName","kind":"method","status":"implemented","sigHash":"81f6096d6b28ad09cd5d3d4b96cd7fe0f6ebe37340724846a93e208e28a3277f","bodyHash":"c11b03d5fa0b6aca8c13f3adba5c8a52ebcc58be8da2c5f29fa0aace41eb1c3f"}
 *
 * Go source:
 * func (c *Checker) checkGrammarJsxName(node *ast.JsxTagNameExpression) bool {
 * 	if ast.IsPropertyAccessExpression(node) && ast.IsJsxNamespacedName(node.Expression()) {
 * 		return c.grammarErrorOnNode(node.Expression(), diagnostics.JSX_property_access_expressions_cannot_include_JSX_namespace_names)
 * 	}
 * 
 * 	if ast.IsJsxNamespacedName(node) && c.compilerOptions.GetJSXTransformEnabled() && !scanner.IsIntrinsicJsxName(node.AsJsxNamespacedName().Namespace.Text()) {
 * 		return c.grammarErrorOnNode(node, diagnostics.React_components_cannot_include_JSX_namespace_names)
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarJsxName(receiver: GoPtr<Checker>, node: GoPtr<JsxTagNameExpression>): bool {
  if (IsPropertyAccessExpression(node as unknown as GoPtr<Node>) && IsJsxNamespacedName(Node_Expression(node as unknown as GoPtr<Node>))) {
    return Checker_grammarErrorOnNode(receiver, Node_Expression(node as unknown as GoPtr<Node>), JSX_property_access_expressions_cannot_include_JSX_namespace_names);
  }
  if (IsJsxNamespacedName(node as unknown as GoPtr<Node>) && CompilerOptions_GetJSXTransformEnabled(receiver!.compilerOptions) && !IsIntrinsicJsxName(Node_Text(AsJsxNamespacedName(node as unknown as GoPtr<Node>)!.Namespace as unknown as GoPtr<Node>))) {
    return Checker_grammarErrorOnNode(receiver, node as unknown as GoPtr<Node>, React_components_cannot_include_JSX_namespace_names);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarJsxExpression","kind":"method","status":"implemented","sigHash":"b7b40bab6bd76f6ae891fc5a0eb17f5424f2d491683a1f1da42ae0937e2a236b","bodyHash":"2a5d71c6da465a99bea20524c7beb2a43cfe7eecacaf28ff6e368701b7b4f597"}
 *
 * Go source:
 * func (c *Checker) checkGrammarJsxExpression(node *ast.JsxExpression) bool {
 * 	if node.Expression != nil && ast.IsCommaSequence(node.Expression) {
 * 		return c.grammarErrorOnNode(node.Expression, diagnostics.JSX_expressions_may_not_use_the_comma_operator_Did_you_mean_to_write_an_array)
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarJsxExpression(receiver: GoPtr<Checker>, node: GoPtr<JsxExpression>): bool {
  if (node!.Expression !== undefined && IsCommaSequence(node!.Expression as unknown as GoPtr<Node>)) {
    return Checker_grammarErrorOnNode(receiver, node!.Expression as unknown as GoPtr<Node>, JSX_expressions_may_not_use_the_comma_operator_Did_you_mean_to_write_an_array);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForInOrForOfStatement","kind":"method","status":"implemented","sigHash":"ffbcc9e0df95aca13d0bca755617f2ce69a0ef9246b0a313c6372abd322912c3","bodyHash":"94a99486e3c003feb16880c86caa8bd8656aca414b57b1010f7048a3789f27e7"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForInOrForOfStatement(forInOrOfStatement *ast.ForInOrOfStatement) bool {
 * 	asNode := forInOrOfStatement.AsNode()
 * 	if c.checkGrammarStatementInAmbientContext(asNode) {
 * 		return true
 * 	}
 * 
 * 	if forInOrOfStatement.Kind == ast.KindForOfStatement && forInOrOfStatement.AwaitModifier != nil {
 * 		if forInOrOfStatement.Flags&ast.NodeFlagsAwaitContext == 0 {
 * 			sourceFile := ast.GetSourceFileOfNode(asNode)
 * 			if ast.IsInTopLevelContext(asNode) {
 * 				if !c.hasParseDiagnostics(sourceFile) {
 * 					if !ast.IsEffectiveExternalModule(sourceFile, c.compilerOptions) {
 * 						c.addDiagnostic(createDiagnosticForNode(forInOrOfStatement.AwaitModifier, diagnostics.X_for_await_loops_are_only_allowed_at_the_top_level_of_a_file_when_that_file_is_a_module_but_this_file_has_no_imports_or_exports_Consider_adding_an_empty_export_to_make_this_file_a_module))
 * 					}
 * 					switch c.moduleKind {
 * 					case core.ModuleKindNode16, core.ModuleKindNode18, core.ModuleKindNode20, core.ModuleKindNodeNext:
 * 						sourceFileMetaData := c.program.GetSourceFileMetaData(sourceFile.Path())
 * 						if sourceFileMetaData.ImpliedNodeFormat == core.ModuleKindCommonJS {
 * 							c.addDiagnostic(createDiagnosticForNode(forInOrOfStatement.AwaitModifier, diagnostics.The_current_file_is_a_CommonJS_module_and_cannot_use_await_at_the_top_level))
 * 							break
 * 						}
 * 						fallthrough
 * 					case core.ModuleKindES2022,
 * 						core.ModuleKindESNext,
 * 						core.ModuleKindPreserve,
 * 						core.ModuleKindSystem:
 * 						if c.languageVersion >= core.ScriptTargetES2017 {
 * 							break
 * 						}
 * 						fallthrough
 * 					default:
 * 						c.addDiagnostic(createDiagnosticForNode(forInOrOfStatement.AwaitModifier, diagnostics.Top_level_for_await_loops_are_only_allowed_when_the_module_option_is_set_to_es2022_esnext_system_node16_node18_node20_nodenext_or_preserve_and_the_target_option_is_set_to_es2017_or_higher))
 * 					}
 * 				}
 * 			} else {
 * 				// use of 'for-await-of' in non-async function
 * 				if !c.hasParseDiagnostics(sourceFile) {
 * 					diagnostic := createDiagnosticForNode(forInOrOfStatement.AwaitModifier, diagnostics.X_for_await_loops_are_only_allowed_within_async_functions_and_at_the_top_levels_of_modules)
 * 					containingFunc := ast.GetContainingFunction(forInOrOfStatement.AsNode())
 * 					if containingFunc != nil && containingFunc.Kind != ast.KindConstructor {
 * 						debug.Assert((ast.GetFunctionFlags(containingFunc)&ast.FunctionFlagsAsync) == 0, "Enclosing function should never be an async function.")
 * 						relatedInfo := createDiagnosticForNode(containingFunc, diagnostics.Did_you_mean_to_mark_this_function_as_async)
 * 						diagnostic.AddRelatedInfo(relatedInfo)
 * 					}
 * 					c.addDiagnostic(diagnostic)
 * 					return true
 * 				}
 * 			}
 * 		}
 * 	}
 * 
 * 	if ast.IsForOfStatement(asNode) && forInOrOfStatement.Flags&ast.NodeFlagsAwaitContext == 0 && ast.IsIdentifier(forInOrOfStatement.Initializer) && forInOrOfStatement.Initializer.Text() == "async" {
 * 		c.grammarErrorOnNode(forInOrOfStatement.Initializer, diagnostics.The_left_hand_side_of_a_for_of_statement_may_not_be_async)
 * 		return false
 * 	}
 * 
 * 	if forInOrOfStatement.Initializer.Kind == ast.KindVariableDeclarationList {
 * 		variableList := forInOrOfStatement.Initializer.AsVariableDeclarationList()
 * 		if !c.checkGrammarVariableDeclarationList(variableList) {
 * 			declarations := variableList.Declarations
 * 
 * 			// declarations.length can be zero if there is an error in variable declaration in for-of or for-in
 * 			// See http://www.ecma-international.org/ecma-262/6.0/#sec-for-in-and-for-of-statements for details
 * 			// For example:
 * 			//      var let = 10;
 * 			//      for (let of [1,2,3]) {} // this is invalid ES6 syntax
 * 			//      for (let in [1,2,3]) {} // this is invalid ES6 syntax
 * 			// We will then want to skip on grammar checking on variableList declaration
 * 			if len(declarations.Nodes) == 0 {
 * 				return false
 * 			}
 * 
 * 			if len(declarations.Nodes) > 1 {
 * 				var diagnostic *diagnostics.Message
 * 				if forInOrOfStatement.Kind == ast.KindForInStatement {
 * 					diagnostic = diagnostics.Only_a_single_variable_declaration_is_allowed_in_a_for_in_statement
 * 				} else {
 * 					diagnostic = diagnostics.Only_a_single_variable_declaration_is_allowed_in_a_for_of_statement
 * 				}
 * 				return c.grammarErrorOnFirstToken(declarations.Nodes[1], diagnostic)
 * 			}
 * 
 * 			firstVariableDeclaration := declarations.Nodes[0].AsVariableDeclaration()
 * 			if firstVariableDeclaration.Initializer != nil {
 * 				var diagnostic *diagnostics.Message
 * 				if forInOrOfStatement.Kind == ast.KindForInStatement {
 * 					diagnostic = diagnostics.The_variable_declaration_of_a_for_in_statement_cannot_have_an_initializer
 * 				} else {
 * 					diagnostic = diagnostics.The_variable_declaration_of_a_for_of_statement_cannot_have_an_initializer
 * 				}
 * 				return c.grammarErrorOnNode(firstVariableDeclaration.Name(), diagnostic)
 * 			}
 * 			if firstVariableDeclaration.Type != nil {
 * 				var diagnostic *diagnostics.Message
 * 				if forInOrOfStatement.Kind == ast.KindForInStatement {
 * 					diagnostic = diagnostics.The_left_hand_side_of_a_for_in_statement_cannot_use_a_type_annotation
 * 				} else {
 * 					diagnostic = diagnostics.The_left_hand_side_of_a_for_of_statement_cannot_use_a_type_annotation
 * 				}
 * 				return c.grammarErrorOnNode(firstVariableDeclaration.AsNode(), diagnostic)
 * 			}
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarForInOrForOfStatement(receiver: GoPtr<Checker>, forInOrOfStatement: GoPtr<ForInOrOfStatement>): bool {
  const asNode = forInOrOfStatement as unknown as GoPtr<Node>;
  if (Checker_checkGrammarStatementInAmbientContext(receiver, asNode)) {
    return true;
  }
  if (forInOrOfStatement!.Kind === KindForOfStatement && forInOrOfStatement!.AwaitModifier !== undefined) {
    if ((forInOrOfStatement!.Flags & NodeFlagsAwaitContext) === 0) {
      const sourceFile = GetSourceFileOfNode(asNode);
      if (IsInTopLevelContext(asNode)) {
        if (!Checker_hasParseDiagnostics(receiver, sourceFile)) {
          if (!IsEffectiveExternalModule(sourceFile, receiver!.compilerOptions)) {
            Checker_addDiagnostic(receiver, createDiagnosticForNode(forInOrOfStatement!.AwaitModifier as unknown as GoPtr<Node>, X_for_await_loops_are_only_allowed_at_the_top_level_of_a_file_when_that_file_is_a_module_but_this_file_has_no_imports_or_exports_Consider_adding_an_empty_export_to_make_this_file_a_module));
          }
          const isNodeModuleKind2 = receiver!.moduleKind === ModuleKindNode16 || receiver!.moduleKind === ModuleKindNode18 || receiver!.moduleKind === ModuleKindNode20 || receiver!.moduleKind === ModuleKindNodeNext;
          const isEsModuleKind2 = receiver!.moduleKind === ModuleKindES2022 || receiver!.moduleKind === ModuleKindESNext || receiver!.moduleKind === ModuleKindPreserve || receiver!.moduleKind === ModuleKindSystem;
          let skipTopLevelForAwaitError = false;
          if (isNodeModuleKind2) {
            const sourceFileMetaData = receiver!.program.GetSourceFileMetaData(SourceFile_Path(sourceFile));
            if (sourceFileMetaData!.ImpliedNodeFormat === ModuleKindCommonJS) {
              Checker_addDiagnostic(receiver, createDiagnosticForNode(forInOrOfStatement!.AwaitModifier as unknown as GoPtr<Node>, The_current_file_is_a_CommonJS_module_and_cannot_use_await_at_the_top_level));
              skipTopLevelForAwaitError = true;
            }
          }
          if (!skipTopLevelForAwaitError && (isNodeModuleKind2 || isEsModuleKind2)) {
            if (receiver!.languageVersion >= ScriptTargetES2017) {
              skipTopLevelForAwaitError = true;
            }
          }
          if (!skipTopLevelForAwaitError) {
            Checker_addDiagnostic(receiver, createDiagnosticForNode(forInOrOfStatement!.AwaitModifier as unknown as GoPtr<Node>, Top_level_for_await_loops_are_only_allowed_when_the_module_option_is_set_to_es2022_esnext_system_node16_node18_node20_nodenext_or_preserve_and_the_target_option_is_set_to_es2017_or_higher));
          }
        }
      } else {
        // use of 'for-await-of' in non-async function
        if (!Checker_hasParseDiagnostics(receiver, sourceFile)) {
          const diagnostic = createDiagnosticForNode(forInOrOfStatement!.AwaitModifier as unknown as GoPtr<Node>, X_for_await_loops_are_only_allowed_within_async_functions_and_at_the_top_levels_of_modules);
          const containingFunc = GetContainingFunction(asNode);
          if (containingFunc !== undefined && containingFunc!.Kind !== KindConstructor) {
            Assert((GetFunctionFlags(containingFunc) & FunctionFlagsAsync) === 0, "Enclosing function should never be an async function.");
            const relatedInfo = createDiagnosticForNode(containingFunc, Did_you_mean_to_mark_this_function_as_async);
            Diagnostic_AddRelatedInfo(diagnostic, relatedInfo);
          }
          Checker_addDiagnostic(receiver, diagnostic);
          return true;
        }
      }
    }
  }
  if (IsForOfStatement(asNode) && (forInOrOfStatement!.Flags & NodeFlagsAwaitContext) === 0 && IsIdentifier(forInOrOfStatement!.Initializer as unknown as GoPtr<Node>) && Node_Text(forInOrOfStatement!.Initializer as unknown as GoPtr<Node>) === "async") {
    Checker_grammarErrorOnNode(receiver, forInOrOfStatement!.Initializer as unknown as GoPtr<Node>, The_left_hand_side_of_a_for_of_statement_may_not_be_async);
    return false;
  }
  if ((forInOrOfStatement!.Initializer as unknown as GoPtr<Node>)!.Kind === KindVariableDeclarationList) {
    const variableList = AsVariableDeclarationList(forInOrOfStatement!.Initializer as unknown as GoPtr<Node>);
    if (!Checker_checkGrammarVariableDeclarationList(receiver, variableList)) {
      const declarations = variableList!.Declarations;
      if (declarations!.Nodes.length === 0) {
        return false;
      }
      if (declarations!.Nodes.length > 1) {
        const diagnostic = forInOrOfStatement!.Kind === KindForInStatement
          ? Only_a_single_variable_declaration_is_allowed_in_a_for_in_statement
          : Only_a_single_variable_declaration_is_allowed_in_a_for_of_statement;
        return Checker_grammarErrorOnFirstToken(receiver, declarations!.Nodes[1], diagnostic);
      }
      const firstVariableDeclaration = AsVariableDeclaration(declarations!.Nodes[0]);
      if (firstVariableDeclaration!.Initializer !== undefined) {
        const diagnostic = forInOrOfStatement!.Kind === KindForInStatement
          ? The_variable_declaration_of_a_for_in_statement_cannot_have_an_initializer
          : The_variable_declaration_of_a_for_of_statement_cannot_have_an_initializer;
        return Checker_grammarErrorOnNode(receiver, Node_Name(declarations!.Nodes[0]), diagnostic);
      }
      if (firstVariableDeclaration!.Type !== undefined) {
        const diagnostic = forInOrOfStatement!.Kind === KindForInStatement
          ? The_left_hand_side_of_a_for_in_statement_cannot_use_a_type_annotation
          : The_left_hand_side_of_a_for_of_statement_cannot_use_a_type_annotation;
        return Checker_grammarErrorOnNode(receiver, declarations!.Nodes[0], diagnostic);
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarAccessor","kind":"method","status":"implemented","sigHash":"485959dd2d0d94678b3f779984008f26ef7f12b135d3e7b4d0d41f2c96fd9147","bodyHash":"1a7a43297a53c032b38c8bc00a43e09a2a1231432ac75d5f158c09770619b390"}
 *
 * Go source:
 * func (c *Checker) checkGrammarAccessor(accessor *ast.AccessorDeclaration) bool {
 * 	body := accessor.Body()
 * 	if accessor.Flags&ast.NodeFlagsAmbient == 0 && (accessor.Parent.Kind != ast.KindTypeLiteral) && (accessor.Parent.Kind != ast.KindInterfaceDeclaration) {
 * 		if body == nil && !ast.HasSyntacticModifier(accessor, ast.ModifierFlagsAbstract) {
 * 			return c.grammarErrorAtPos(accessor, accessor.End()-1, len(";"), diagnostics.X_0_expected, "{")
 * 		}
 * 	}
 * 	if body != nil {
 * 		if ast.HasSyntacticModifier(accessor, ast.ModifierFlagsAbstract) {
 * 			return c.grammarErrorOnNode(accessor, diagnostics.An_abstract_accessor_cannot_have_an_implementation)
 * 		}
 * 		if accessor.Parent.Kind == ast.KindTypeLiteral || accessor.Parent.Kind == ast.KindInterfaceDeclaration {
 * 			return c.grammarErrorOnNode(body, diagnostics.An_implementation_cannot_be_declared_in_ambient_contexts)
 * 		}
 * 	}
 * 
 * 	funcData := accessor.FunctionLikeData()
 * 	var typeParameters *ast.NodeList
 * 	if funcData != nil {
 * 		typeParameters = funcData.TypeParameters
 * 	}
 * 
 * 	if typeParameters != nil {
 * 		return c.grammarErrorOnNode(accessor.Name(), diagnostics.An_accessor_cannot_have_type_parameters)
 * 	}
 * 	if !c.doesAccessorHaveCorrectParameterCount(accessor) {
 * 		return c.grammarErrorOnNode(accessor.Name(), core.IfElse(accessor.Kind == ast.KindGetAccessor, diagnostics.A_get_accessor_cannot_have_parameters, diagnostics.A_set_accessor_must_have_exactly_one_parameter))
 * 	}
 * 	if accessor.Kind == ast.KindSetAccessor {
 * 		if funcData.Type != nil {
 * 			return c.grammarErrorOnNode(accessor.Name(), diagnostics.A_set_accessor_cannot_have_a_return_type_annotation)
 * 		}
 * 
 * 		parameterNode := GetSetAccessorValueParameter(accessor)
 * 		if parameterNode == nil {
 * 			panic("Return value does not match parameter count assertion.")
 * 		}
 * 		parameter := parameterNode.AsParameterDeclaration()
 * 		if parameter.DotDotDotToken != nil {
 * 			return c.grammarErrorOnNode(parameter.DotDotDotToken, diagnostics.A_set_accessor_cannot_have_rest_parameter)
 * 		}
 * 		if parameter.QuestionToken != nil {
 * 			return c.grammarErrorOnNode(parameter.QuestionToken, diagnostics.A_set_accessor_cannot_have_an_optional_parameter)
 * 		}
 * 		if parameter.Initializer != nil {
 * 			return c.grammarErrorOnNode(accessor.Name(), diagnostics.A_set_accessor_parameter_cannot_have_an_initializer)
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarAccessor(receiver: GoPtr<Checker>, accessor: GoPtr<AccessorDeclaration>): bool {
  const asNode = accessor as unknown as GoPtr<Node>;
  const body = Node_Body(asNode);
  if ((asNode!.Flags & NodeFlagsAmbient) === 0 && asNode!.Parent!.Kind !== KindTypeLiteral && asNode!.Parent!.Kind !== KindInterfaceDeclaration) {
    if (body === undefined && !HasSyntacticModifier(asNode, ModifierFlagsAbstract)) {
      return Checker_grammarErrorAtPos(receiver, asNode, Node_End(asNode) - 1, 1, X_0_expected, "{");
    }
  }
  if (body !== undefined) {
    if (HasSyntacticModifier(asNode, ModifierFlagsAbstract)) {
      return Checker_grammarErrorOnNode(receiver, asNode, An_abstract_accessor_cannot_have_an_implementation);
    }
    if (asNode!.Parent!.Kind === KindTypeLiteral || asNode!.Parent!.Kind === KindInterfaceDeclaration) {
      return Checker_grammarErrorOnNode(receiver, body as unknown as GoPtr<Node>, An_implementation_cannot_be_declared_in_ambient_contexts);
    }
  }
  const funcData = Node_FunctionLikeData(asNode);
  const typeParameters = funcData !== undefined ? funcData!.TypeParameters : undefined;
  if (typeParameters !== undefined) {
    return Checker_grammarErrorOnNode(receiver, Node_Name(asNode), An_accessor_cannot_have_type_parameters);
  }
  if (!Checker_doesAccessorHaveCorrectParameterCount(receiver, accessor)) {
    return Checker_grammarErrorOnNode(receiver, Node_Name(asNode), IfElse(asNode!.Kind === KindGetAccessor, A_get_accessor_cannot_have_parameters, A_set_accessor_must_have_exactly_one_parameter));
  }
  if (asNode!.Kind === KindSetAccessor) {
    if (funcData!.Type !== undefined) {
      return Checker_grammarErrorOnNode(receiver, Node_Name(asNode), A_set_accessor_cannot_have_a_return_type_annotation);
    }
    const parameterNode = GetSetAccessorValueParameter(asNode);
    if (parameterNode === undefined) {
      throw new globalThis.Error("Return value does not match parameter count assertion.");
    }
    const parameter = AsParameterDeclaration(parameterNode);
    if (parameter!.DotDotDotToken !== undefined) {
      return Checker_grammarErrorOnNode(receiver, parameter!.DotDotDotToken as unknown as GoPtr<Node>, A_set_accessor_cannot_have_rest_parameter);
    }
    if (parameter!.QuestionToken !== undefined) {
      return Checker_grammarErrorOnNode(receiver, parameter!.QuestionToken as unknown as GoPtr<Node>, A_set_accessor_cannot_have_an_optional_parameter);
    }
    if (parameter!.Initializer !== undefined) {
      return Checker_grammarErrorOnNode(receiver, Node_Name(asNode), A_set_accessor_parameter_cannot_have_an_initializer);
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.doesAccessorHaveCorrectParameterCount","kind":"method","status":"implemented","sigHash":"e5c96ffc7430da9e5c0b0d33f2df94cf71cac9f5c841eaf08a33966d49f29e8d","bodyHash":"4a01315ba14e780a76e2322ac05e6f807ec75bc6db8e54981cbe85bf1daae05d"}
 *
 * Go source:
 * func (c *Checker) doesAccessorHaveCorrectParameterCount(accessor *ast.AccessorDeclaration) bool {
 * 	// `getAccessorThisParameter` returns `nil` if the accessor's arity is incorrect,
 * 	// even if there is a `this` parameter declared.
 * 	return c.getAccessorThisParameter(accessor) != nil || len(accessor.Parameters()) == core.IfElse(accessor.Kind == ast.KindGetAccessor, 0, 1)
 * }
 */
export function Checker_doesAccessorHaveCorrectParameterCount(receiver: GoPtr<Checker>, accessor: GoPtr<AccessorDeclaration>): bool {
  const asNode = accessor as unknown as GoPtr<Node>;
  const funcData = Node_FunctionLikeData(asNode);
  const paramCount = funcData !== undefined && funcData!.Parameters !== undefined ? funcData!.Parameters!.Nodes.length : 0;
  return Checker_getAccessorThisParameter(receiver, asNode) !== undefined || paramCount === IfElse(asNode!.Kind === KindGetAccessor, 0, 1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarTypeOperatorNode","kind":"method","status":"implemented","sigHash":"acba5f71399d83e8554d2b439a99aeeb66fbd0a9c86cc36e499968330a5d1250","bodyHash":"c4f2802a6143c303ff842e41380e6728bb12377869c477dfe79584482756af4f"}
 *
 * Go source:
 * func (c *Checker) checkGrammarTypeOperatorNode(node *ast.TypeOperatorNode) bool {
 * 	if node.Operator == ast.KindUniqueKeyword {
 * 		innerType := node.Type
 * 		if innerType.Kind != ast.KindSymbolKeyword {
 * 			return c.grammarErrorOnNode(innerType, diagnostics.X_0_expected, scanner.TokenToString(ast.KindSymbolKeyword))
 * 		}
 * 		parent := ast.WalkUpParenthesizedTypes(node.Parent)
 * 		switch parent.Kind {
 * 		case ast.KindVariableDeclaration:
 * 			decl := parent.AsVariableDeclaration()
 * 			if decl.Name().Kind != ast.KindIdentifier {
 * 				return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_unique_symbol_types_may_not_be_used_on_a_variable_declaration_with_a_binding_name)
 * 			}
 * 			if !isVariableDeclarationInVariableStatement(decl.AsNode()) {
 * 				return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_unique_symbol_types_are_only_allowed_on_variables_in_a_variable_statement)
 * 			}
 * 			if decl.Parent.Flags&ast.NodeFlagsConst == 0 {
 * 				return c.grammarErrorOnNode(parent.AsVariableDeclaration().Name(), diagnostics.A_variable_whose_type_is_a_unique_symbol_type_must_be_const)
 * 			}
 * 		case ast.KindPropertyDeclaration:
 * 			if !ast.IsStatic(parent) || !hasReadonlyModifier(parent) {
 * 				return c.grammarErrorOnNode(parent.AsPropertyDeclaration().Name(), diagnostics.A_property_of_a_class_whose_type_is_a_unique_symbol_type_must_be_both_static_and_readonly)
 * 			}
 * 		case ast.KindPropertySignature:
 * 			if !ast.HasSyntacticModifier(parent, ast.ModifierFlagsReadonly) {
 * 				return c.grammarErrorOnNode(parent.AsPropertySignatureDeclaration().Name(), diagnostics.A_property_of_an_interface_or_type_literal_whose_type_is_a_unique_symbol_type_must_be_readonly)
 * 			}
 * 		default:
 * 			return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_unique_symbol_types_are_not_allowed_here)
 * 		}
 * 	} else if node.Operator == ast.KindReadonlyKeyword {
 * 		innerType := node.Type
 * 		if innerType.Kind != ast.KindArrayType && innerType.Kind != ast.KindTupleType {
 * 			return c.grammarErrorOnFirstToken(node.AsNode(), diagnostics.X_readonly_type_modifier_is_only_permitted_on_array_and_tuple_literal_types, scanner.TokenToString(ast.KindSymbolKeyword))
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarTypeOperatorNode(receiver: GoPtr<Checker>, node: GoPtr<TypeOperatorNode>): bool {
  const asNode = node as unknown as GoPtr<Node>;
  if (node!.Operator === KindUniqueKeyword) {
    const innerType = node!.Type as unknown as GoPtr<Node>;
    if (innerType!.Kind !== KindSymbolKeyword) {
      return Checker_grammarErrorOnNode(receiver, innerType, X_0_expected, TokenToString(KindSymbolKeyword));
    }
    const parent = WalkUpParenthesizedTypes(asNode!.Parent);
    switch (parent!.Kind) {
      case KindVariableDeclarationNode: {
        const decl = AsVariableDeclaration(parent);
        if (Node_Name(parent)!.Kind !== KindIdentifier) {
          return Checker_grammarErrorOnNode(receiver, asNode, X_unique_symbol_types_may_not_be_used_on_a_variable_declaration_with_a_binding_name);
        }
        if (!isVariableDeclarationInVariableStatement(parent)) {
          return Checker_grammarErrorOnNode(receiver, asNode, X_unique_symbol_types_are_only_allowed_on_variables_in_a_variable_statement);
        }
        if ((decl!.Parent!.Flags & NodeFlagsConst) === 0) {
          return Checker_grammarErrorOnNode(receiver, Node_Name(parent), A_variable_whose_type_is_a_unique_symbol_type_must_be_const);
        }
        break;
      }
      case KindPropertyDeclaration:
        if (!IsStatic(parent) || !hasReadonlyModifier(parent)) {
          return Checker_grammarErrorOnNode(receiver, Node_Name(parent), A_property_of_a_class_whose_type_is_a_unique_symbol_type_must_be_both_static_and_readonly);
        }
        break;
      case KindPropertySignature:
        if (!HasSyntacticModifier(parent, ModifierFlagsReadonly)) {
          return Checker_grammarErrorOnNode(receiver, Node_Name(parent), A_property_of_an_interface_or_type_literal_whose_type_is_a_unique_symbol_type_must_be_readonly);
        }
        break;
      default:
        return Checker_grammarErrorOnNode(receiver, asNode, X_unique_symbol_types_are_not_allowed_here);
    }
  } else if (node!.Operator === KindReadonlyKeyword) {
    const innerType = node!.Type as unknown as GoPtr<Node>;
    if (innerType!.Kind !== KindArrayType && innerType!.Kind !== KindTupleType) {
      return Checker_grammarErrorOnFirstToken(receiver, asNode, X_readonly_type_modifier_is_only_permitted_on_array_and_tuple_literal_types, TokenToString(KindSymbolKeyword));
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForInvalidDynamicName","kind":"method","status":"implemented","sigHash":"1b94d484de7b4593d45ea103742133b2b7368240f1f16c848607f82da5475454","bodyHash":"aa939e4f1ad719cf21c1786256f9deab2fb7810a6a88be68e77d5d510b28a082"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForInvalidDynamicName(node *ast.DeclarationName, message *diagnostics.Message) bool {
 * 	if !c.isNonBindableDynamicName(node) {
 * 		return false
 * 	}
 * 	var expression *ast.Node
 * 	if ast.IsElementAccessExpression(node) {
 * 		expression = ast.SkipParentheses(node.AsElementAccessExpression().ArgumentExpression)
 * 	} else {
 * 		expression = node.Expression()
 * 	}
 * 
 * 	if !ast.IsEntityNameExpression(expression) {
 * 		return c.grammarErrorOnNode(node, message)
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarForInvalidDynamicName(receiver: GoPtr<Checker>, node: GoPtr<DeclarationName>, message: GoPtr<Message>): bool {
  if (!Checker_isNonBindableDynamicName(receiver, node)) {
    return false;
  }
  const asNode = node as unknown as GoPtr<Node>;
  const expression = IsElementAccessExpression(asNode)
    ? SkipParentheses(AsElementAccessExpression(asNode)!.ArgumentExpression)
    : Node_Expression(asNode);
  if (!IsEntityNameExpression(expression)) {
    return Checker_grammarErrorOnNode(receiver, asNode, message);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.isNonBindableDynamicName","kind":"method","status":"implemented","sigHash":"78a08b7566c0f2c67c6735ac46f524fca42d763f9e7c69bf7fc3c1823ebce0fc","bodyHash":"d62587a50c67d3624b4a94b787c2f506a4d6ce0bb26206cc271d6e5a35780b31"}
 *
 * Go source:
 * func (c *Checker) isNonBindableDynamicName(node *ast.DeclarationName) bool {
 * 	return ast.IsDynamicName(node) && !c.isLateBindableName(node)
 * }
 */
export function Checker_isNonBindableDynamicName(receiver: GoPtr<Checker>, node: GoPtr<DeclarationName>): bool {
  const asNode = node as unknown as GoPtr<Node>;
  return IsDynamicName(asNode) && !Checker_isLateBindableName(receiver, asNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarMethod","kind":"method","status":"implemented","sigHash":"1fb71c827079f43c3953cf62fe1d2b58004836d3a49de2c39bd4686743b58b18","bodyHash":"2e902d2f8a4a3208718f0bdfe4e0f441508490e1d3db11793fdc99d0161e1264"}
 *
 * Go source:
 * func (c *Checker) checkGrammarMethod(node *ast.Node /*Union[MethodDeclaration, MethodSignature]* /) bool {
 * 	if c.checkGrammarFunctionLikeDeclaration(node) {
 * 		return true
 * 	}
 * 
 * 	if node.Kind == ast.KindMethodDeclaration {
 * 		if node.Parent.Kind == ast.KindObjectLiteralExpression {
 * 			// We only disallow modifier on a method declaration if it is a property of object-literal-expression
 * 			if modifiers := node.Modifiers(); modifiers != nil && !(len(modifiers.Nodes) == 1 && modifiers.Nodes[0].Kind == ast.KindAsyncKeyword) {
 * 				return c.grammarErrorOnFirstToken(node, diagnostics.Modifiers_cannot_appear_here)
 * 			}
 * 
 * 			methodDecl := node.AsMethodDeclaration()
 * 			if c.checkGrammarForInvalidQuestionMark(methodDecl.PostfixToken, diagnostics.An_object_member_cannot_be_declared_optional) {
 * 				return true
 * 			}
 * 			if c.checkGrammarForInvalidExclamationToken(methodDecl.PostfixToken, diagnostics.A_definite_assignment_assertion_is_not_permitted_in_this_context) {
 * 				return true
 * 			}
 * 			if node.Body() == nil {
 * 				return c.grammarErrorAtPos(node, node.End()-1, len(";"), diagnostics.X_0_expected, "{")
 * 			}
 * 		}
 * 		if c.checkGrammarForGenerator(node) {
 * 			return true
 * 		}
 * 	}
 * 
 * 	if ast.IsClassLike(node.Parent) {
 * 		// Technically, computed properties in ambient contexts is disallowed
 * 		// for property declarations and accessors too, not just methods.
 * 		// However, property declarations disallow computed names in general,
 * 		// and accessors are not allowed in ambient contexts in general,
 * 		// so this error only really matters for methods.
 * 		if node.Flags&ast.NodeFlagsAmbient != 0 {
 * 			return c.checkGrammarForInvalidDynamicName(node.Name(), diagnostics.A_computed_property_name_in_an_ambient_context_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type)
 * 		} else if node.Kind == ast.KindMethodDeclaration && node.Body() == nil {
 * 			return c.checkGrammarForInvalidDynamicName(node.Name(), diagnostics.A_computed_property_name_in_a_method_overload_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type)
 * 		}
 * 	} else if node.Parent.Kind == ast.KindInterfaceDeclaration {
 * 		return c.checkGrammarForInvalidDynamicName(node.Name(), diagnostics.A_computed_property_name_in_an_interface_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type)
 * 	} else if node.Parent.Kind == ast.KindTypeLiteral {
 * 		return c.checkGrammarForInvalidDynamicName(node.Name(), diagnostics.A_computed_property_name_in_a_type_literal_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type)
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarMethod(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (Checker_checkGrammarFunctionLikeDeclaration(receiver, node)) {
    return true;
  }
  if (node!.Kind === KindMethodDeclaration) {
    if (node!.Parent!.Kind === KindObjectLiteralExpression) {
      const modifiers = Node_Modifiers(node);
      if (modifiers !== undefined && !(modifiers!.Nodes.length === 1 && modifiers!.Nodes[0]!.Kind === KindAsyncKeyword)) {
        return Checker_grammarErrorOnFirstToken(receiver, node, Modifiers_cannot_appear_here);
      }
      const methodDecl = AsMethodDeclaration(node);
      if (Checker_checkGrammarForInvalidQuestionMark(receiver, methodDecl!.PostfixToken as unknown as GoPtr<TokenNode>, An_object_member_cannot_be_declared_optional)) {
        return true;
      }
      if (Checker_checkGrammarForInvalidExclamationToken(receiver, methodDecl!.PostfixToken as unknown as GoPtr<TokenNode>, A_definite_assignment_assertion_is_not_permitted_in_this_context)) {
        return true;
      }
      if (Node_Body(node) === undefined) {
        return Checker_grammarErrorAtPos(receiver, node, Node_End(node) - 1, 1, X_0_expected, "{");
      }
    }
    if (Checker_checkGrammarForGenerator(receiver, node)) {
      return true;
    }
  }
  if (IsClassLike(node!.Parent)) {
    if ((node!.Flags & NodeFlagsAmbient) !== 0) {
      return Checker_checkGrammarForInvalidDynamicName(receiver, Node_Name(node) as unknown as GoPtr<DeclarationName>, A_computed_property_name_in_an_ambient_context_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type);
    } else if (node!.Kind === KindMethodDeclaration && Node_Body(node) === undefined) {
      return Checker_checkGrammarForInvalidDynamicName(receiver, Node_Name(node) as unknown as GoPtr<DeclarationName>, A_computed_property_name_in_a_method_overload_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type);
    }
  } else if (node!.Parent!.Kind === KindInterfaceDeclaration) {
    return Checker_checkGrammarForInvalidDynamicName(receiver, Node_Name(node) as unknown as GoPtr<DeclarationName>, A_computed_property_name_in_an_interface_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type);
  } else if (node!.Parent!.Kind === KindTypeLiteral) {
    return Checker_checkGrammarForInvalidDynamicName(receiver, Node_Name(node) as unknown as GoPtr<DeclarationName>, A_computed_property_name_in_a_type_literal_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarBreakOrContinueStatement","kind":"method","status":"implemented","sigHash":"5268e6a388eb530764bcf9c46f79285d09b53a611ef8c3cf16748de4b0fe8bb6","bodyHash":"a363cf3795b9740fc3b8c516f2806d602ec5e6218f0f94d88473fbb7a0102b88"}
 *
 * Go source:
 * func (c *Checker) checkGrammarBreakOrContinueStatement(node *ast.Node) bool {
 * 	targetLabel := node.Label()
 * 	var current *ast.Node = node
 * 	for current != nil {
 * 		if ast.IsFunctionLikeOrClassStaticBlockDeclaration(current) {
 * 			return c.grammarErrorOnNode(node, diagnostics.Jump_target_cannot_cross_function_boundary)
 * 		}
 * 
 * 		switch current.Kind {
 * 		case ast.KindLabeledStatement:
 * 			if targetLabel != nil && current.Label().Text() == targetLabel.Text() {
 * 				// found matching label - verify that label usage is correct
 * 				// continue can only target labels that are on iteration statements
 * 				isMisplacedContinueLabel := node.Kind == ast.KindContinueStatement && !ast.IsIterationStatement(current.Statement(), true /*lookInLabeledStatements* /)
 * 
 * 				if isMisplacedContinueLabel {
 * 					return c.grammarErrorOnNode(node, diagnostics.A_continue_statement_can_only_jump_to_a_label_of_an_enclosing_iteration_statement)
 * 				}
 * 
 * 				return false
 * 			}
 * 		case ast.KindSwitchStatement:
 * 			if node.Kind == ast.KindBreakStatement && targetLabel == nil {
 * 				// unlabeled break within switch statement - ok
 * 				return false
 * 			}
 * 		default:
 * 			if ast.IsIterationStatement(current, false /*lookInLabeledStatements* /) && targetLabel == nil {
 * 				// unlabeled break or continue within iteration statement - ok
 * 				return false
 * 			}
 * 		}
 * 
 * 		current = current.Parent
 * 	}
 * 
 * 	if targetLabel != nil {
 * 		var message *diagnostics.Message
 * 		if node.Kind == ast.KindBreakStatement {
 * 			message = diagnostics.A_break_statement_can_only_jump_to_a_label_of_an_enclosing_statement
 * 		} else {
 * 			message = diagnostics.A_continue_statement_can_only_jump_to_a_label_of_an_enclosing_iteration_statement
 * 		}
 * 
 * 		return c.grammarErrorOnNode(node, message)
 * 	} else {
 * 		var message *diagnostics.Message
 * 		if node.Kind == ast.KindBreakStatement {
 * 			message = diagnostics.A_break_statement_can_only_be_used_within_an_enclosing_iteration_or_switch_statement
 * 		} else {
 * 			message = diagnostics.A_continue_statement_can_only_be_used_within_an_enclosing_iteration_statement
 * 		}
 * 		return c.grammarErrorOnNode(node, message)
 * 	}
 * }
 */
export function Checker_checkGrammarBreakOrContinueStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const targetLabel = Node_Label(node);
  let current: GoPtr<Node> = node;
  while (current !== undefined) {
    if (IsFunctionLikeOrClassStaticBlockDeclaration(current)) {
      return Checker_grammarErrorOnNode(receiver, node, Jump_target_cannot_cross_function_boundary);
    }
    switch (current!.Kind) {
      case KindLabeledStatement:
        if (targetLabel !== undefined && Node_Text(Node_Label(current)) === Node_Text(targetLabel)) {
          const isMisplacedContinueLabel = node!.Kind === KindContinueStatement && !IsIterationStatement(Node_Statement(current), true);
          if (isMisplacedContinueLabel) {
            return Checker_grammarErrorOnNode(receiver, node, A_continue_statement_can_only_jump_to_a_label_of_an_enclosing_iteration_statement);
          }
          return false;
        }
        break;
      case KindSwitchStatement:
        if (node!.Kind === KindBreakStatement && targetLabel === undefined) {
          return false;
        }
        break;
      default:
        if (IsIterationStatement(current, false) && targetLabel === undefined) {
          return false;
        }
    }
    current = current!.Parent;
  }
  if (targetLabel !== undefined) {
    const message = node!.Kind === KindBreakStatement
      ? A_break_statement_can_only_jump_to_a_label_of_an_enclosing_statement
      : A_continue_statement_can_only_jump_to_a_label_of_an_enclosing_iteration_statement;
    return Checker_grammarErrorOnNode(receiver, node, message);
  } else {
    const message = node!.Kind === KindBreakStatement
      ? A_break_statement_can_only_be_used_within_an_enclosing_iteration_or_switch_statement
      : A_continue_statement_can_only_be_used_within_an_enclosing_iteration_statement;
    return Checker_grammarErrorOnNode(receiver, node, message);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarBindingElement","kind":"method","status":"implemented","sigHash":"e7cc27eb47c93739a9e83a836b7c6333a7cdbc9eea15a075274e6a5ca0f7fec8","bodyHash":"bf5d48331b4c5c29fd419eb9bf1186613593870c36f194db13ce7b6178985de6"}
 *
 * Go source:
 * func (c *Checker) checkGrammarBindingElement(node *ast.BindingElement) bool {
 * 	if node.DotDotDotToken != nil {
 * 		elements := node.Parent.ElementList()
 * 		if node.AsNode() != core.LastOrNil(elements.Nodes) {
 * 			return c.grammarErrorOnNode(&node.Node, diagnostics.A_rest_element_must_be_last_in_a_destructuring_pattern)
 * 		}
 * 		c.checkGrammarForDisallowedTrailingComma(elements, diagnostics.A_rest_parameter_or_binding_pattern_may_not_have_a_trailing_comma)
 * 
 * 		if node.PropertyName != nil {
 * 			return c.grammarErrorOnNode(node.Name(), diagnostics.A_rest_element_cannot_have_a_property_name)
 * 		}
 * 	}
 * 
 * 	if node.DotDotDotToken != nil && node.Initializer != nil {
 * 		// Error on equals token which immediately precedes the initializer
 * 		return c.grammarErrorAtPos(node.AsNode(), node.Initializer.Pos()-1, 1, diagnostics.A_rest_element_cannot_have_an_initializer)
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarBindingElement(receiver: GoPtr<Checker>, node: GoPtr<BindingElement>): bool {
  const asNode = node as unknown as GoPtr<Node>;
  if (node!.DotDotDotToken !== undefined) {
    const elements = Node_ElementList(asNode!.Parent);
    if (asNode !== LastOrNil(elements!.Nodes)) {
      return Checker_grammarErrorOnNode(receiver, asNode, A_rest_element_must_be_last_in_a_destructuring_pattern);
    }
    Checker_checkGrammarForDisallowedTrailingComma(receiver, elements, A_rest_parameter_or_binding_pattern_may_not_have_a_trailing_comma);
    if (node!.PropertyName !== undefined) {
      return Checker_grammarErrorOnNode(receiver, Node_Name(asNode), A_rest_element_cannot_have_a_property_name);
    }
  }
  if (node!.DotDotDotToken !== undefined && node!.Initializer !== undefined) {
    return Checker_grammarErrorAtPos(receiver, asNode, Node_Pos(node!.Initializer as unknown as GoPtr<Node>) - 1, 1, A_rest_element_cannot_have_an_initializer);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarVariableDeclaration","kind":"method","status":"implemented","sigHash":"f3a10fbff1817b43c569529302272bf422e5a99bb942c00c2c2bbb47af3377b5","bodyHash":"5ebe409076641cfc37baa23afe31c702d034d7766c3e3d252049edf3e173f270"}
 *
 * Go source:
 * func (c *Checker) checkGrammarVariableDeclaration(node *ast.VariableDeclaration) bool {
 * 	nodeFlags := c.getCombinedNodeFlagsCached(node.AsNode())
 * 	blockScopeKind := nodeFlags & ast.NodeFlagsBlockScoped
 * 	if ast.IsBindingPattern(node.Name()) {
 * 		switch blockScopeKind {
 * 		case ast.NodeFlagsAwaitUsing:
 * 			return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_0_declarations_may_not_have_binding_patterns, "await using")
 * 		case ast.NodeFlagsUsing:
 * 			return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_0_declarations_may_not_have_binding_patterns, "using")
 * 		}
 * 	}
 * 
 * 	if node.Parent.Parent.Kind != ast.KindForInStatement && node.Parent.Parent.Kind != ast.KindForOfStatement {
 * 		if nodeFlags&ast.NodeFlagsAmbient != 0 {
 * 			c.checkAmbientInitializer(node.AsNode())
 * 		} else if node.Initializer == nil {
 * 			if ast.IsBindingPattern(node.Name()) && !ast.IsBindingPattern(node.Parent) {
 * 				return c.grammarErrorOnNode(node.AsNode(), diagnostics.A_destructuring_declaration_must_have_an_initializer)
 * 			}
 * 			switch blockScopeKind {
 * 			case ast.NodeFlagsAwaitUsing:
 * 				return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_0_declarations_must_be_initialized, "await using")
 * 			case ast.NodeFlagsUsing:
 * 				return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_0_declarations_must_be_initialized, "using")
 * 			case ast.NodeFlagsConst:
 * 				return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_0_declarations_must_be_initialized, "const")
 * 			}
 * 		}
 * 	}
 * 
 * 	if node.ExclamationToken != nil && (node.Parent.Parent.Kind != ast.KindVariableStatement || node.Type == nil || node.Initializer != nil || nodeFlags&ast.NodeFlagsAmbient != 0) {
 * 		var message *diagnostics.Message
 * 		switch {
 * 		case node.Initializer != nil:
 * 			message = diagnostics.Declarations_with_initializers_cannot_also_have_definite_assignment_assertions
 * 		case node.Type == nil:
 * 			message = diagnostics.Declarations_with_definite_assignment_assertions_must_also_have_type_annotations
 * 		default:
 * 			message = diagnostics.A_definite_assignment_assertion_is_not_permitted_in_this_context
 * 		}
 * 		return c.grammarErrorOnNode(node.ExclamationToken, message)
 * 	}
 * 
 * 	if c.program.GetEmitModuleFormatOfFile(ast.GetSourceFileOfNode(node.AsNode())) < core.ModuleKindSystem && (node.Parent.Parent.Flags&ast.NodeFlagsAmbient == 0) && ast.HasSyntacticModifier(node.Parent.Parent, ast.ModifierFlagsExport) {
 * 		c.checkGrammarForEsModuleMarkerInBindingName(node.Name())
 * 	}
 * 
 * 	// 1. LexicalDeclaration : LetOrConst BindingList ;
 * 	// It is a Syntax Error if the BoundNames of BindingList contains "let".
 * 	// 2. ForDeclaration: ForDeclaration : LetOrConst ForBinding
 * 	// It is a Syntax Error if the BoundNames of ForDeclaration contains "let".
 * 
 * 	// It is a SyntaxError if a VariableDeclaration or VariableDeclarationNoIn occurs within strict code
 * 	// and its Identifier is eval or arguments
 * 	return blockScopeKind != 0 && c.checkGrammarNameInLetOrConstDeclarations(node.Name())
 * }
 */
export function Checker_checkGrammarVariableDeclaration(receiver: GoPtr<Checker>, node: GoPtr<VariableDeclaration>): bool {
  const asNode = node as unknown as GoPtr<Node>;
  const nodeFlags = Checker_getCombinedNodeFlagsCached(receiver, asNode);
  const blockScopeKind = nodeFlags & NodeFlagsBlockScoped;
  if (IsBindingPattern(Node_Name(asNode))) {
    if (blockScopeKind === NodeFlagsAwaitUsing) {
      return Checker_grammarErrorOnNode(receiver, asNode, X_0_declarations_may_not_have_binding_patterns, "await using");
    }
    if (blockScopeKind === NodeFlagsUsing) {
      return Checker_grammarErrorOnNode(receiver, asNode, X_0_declarations_may_not_have_binding_patterns, "using");
    }
  }
  if (asNode!.Parent!.Parent!.Kind !== KindForInStatement && asNode!.Parent!.Parent!.Kind !== KindForOfStatement) {
    if ((nodeFlags & NodeFlagsAmbient) !== 0) {
      Checker_checkAmbientInitializer(receiver, asNode);
    } else if (node!.Initializer === undefined) {
      if (IsBindingPattern(Node_Name(asNode)) && !IsBindingPattern(asNode!.Parent)) {
        return Checker_grammarErrorOnNode(receiver, asNode, A_destructuring_declaration_must_have_an_initializer);
      }
      if (blockScopeKind === NodeFlagsAwaitUsing) {
        return Checker_grammarErrorOnNode(receiver, asNode, X_0_declarations_must_be_initialized, "await using");
      }
      if (blockScopeKind === NodeFlagsUsing) {
        return Checker_grammarErrorOnNode(receiver, asNode, X_0_declarations_must_be_initialized, "using");
      }
      if (blockScopeKind === NodeFlagsConst) {
        return Checker_grammarErrorOnNode(receiver, asNode, X_0_declarations_must_be_initialized, "const");
      }
    }
  }
  if (node!.ExclamationToken !== undefined && (asNode!.Parent!.Parent!.Kind !== KindVariableStatement || node!.Type === undefined || node!.Initializer !== undefined || (nodeFlags & NodeFlagsAmbient) !== 0)) {
    let message: GoPtr<Message>;
    if (node!.Initializer !== undefined) {
      message = Declarations_with_initializers_cannot_also_have_definite_assignment_assertions;
    } else if (node!.Type === undefined) {
      message = Declarations_with_definite_assignment_assertions_must_also_have_type_annotations;
    } else {
      message = A_definite_assignment_assertion_is_not_permitted_in_this_context;
    }
    return Checker_grammarErrorOnNode(receiver, node!.ExclamationToken as unknown as GoPtr<Node>, message);
  }
  const sf = GetSourceFileOfNode(asNode);
  if (receiver!.program.GetEmitModuleFormatOfFile(NewHasFileName(SourceFile_FileName(sf), SourceFile_Path(sf))) < ModuleKindSystem && (asNode!.Parent!.Parent!.Flags & NodeFlagsAmbient) === 0 && HasSyntacticModifier(asNode!.Parent!.Parent, ModifierFlagsExport)) {
    Checker_checkGrammarForEsModuleMarkerInBindingName(receiver, Node_Name(asNode));
  }
  return blockScopeKind !== 0 && Checker_checkGrammarNameInLetOrConstDeclarations(receiver, Node_Name(asNode));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForEsModuleMarkerInBindingName","kind":"method","status":"implemented","sigHash":"ee57ca80a65aac74ffebc88a4a409019d4fd5ee7dd873d8ebdf04f99f54e2e8f","bodyHash":"644d7855f42eafd588b3d4b5acd7c2017879928bf7143d6bb337a32cd686f881"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForEsModuleMarkerInBindingName(name *ast.Node) bool {
 * 	if ast.IsIdentifier(name) {
 * 		if name.Text() == "__esModule" {
 * 			return c.grammarErrorOnNodeSkippedOnNoEmit(name, diagnostics.Identifier_expected_esModule_is_reserved_as_an_exported_marker_when_transforming_ECMAScript_modules)
 * 		}
 * 	} else {
 * 		for _, element := range name.Elements() {
 * 			if element.Name() != nil {
 * 				return c.checkGrammarForEsModuleMarkerInBindingName(element.Name())
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarForEsModuleMarkerInBindingName(receiver: GoPtr<Checker>, name: GoPtr<Node>): bool {
  if (IsIdentifier(name)) {
    if (Node_Text(name) === "__esModule") {
      return Checker_grammarErrorOnNodeSkippedOnNoEmit(receiver, name, Identifier_expected_esModule_is_reserved_as_an_exported_marker_when_transforming_ECMAScript_modules);
    }
  } else {
    const elements = Node_Elements(name);
    if (elements !== undefined) {
      for (const element of elements!) {
        const elementName = Node_Name(element);
        if (elementName !== undefined) {
          if (Checker_checkGrammarForEsModuleMarkerInBindingName(receiver, elementName)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarNameInLetOrConstDeclarations","kind":"method","status":"implemented","sigHash":"753105ba22cb5f637622b96da94f130eb8fbc91ead15cc662eab4f626c292f65","bodyHash":"2c63a5cd38efa0ecd6b563bd0e1cb8835dfc42d8942c4b81ec9982281e74fa2c"}
 *
 * Go source:
 * func (c *Checker) checkGrammarNameInLetOrConstDeclarations(name *ast.Node /*Union[Identifier, BindingPattern]* /) bool {
 * 	if name.Kind == ast.KindIdentifier {
 * 		if name.Text() == "let" {
 * 			return c.grammarErrorOnNode(name, diagnostics.X_let_is_not_allowed_to_be_used_as_a_name_in_let_or_const_declarations)
 * 		}
 * 	} else {
 * 		elements := name.Elements()
 * 		for _, element := range elements {
 * 			bindingElement := element.AsBindingElement()
 * 			if bindingElement.Name() != nil {
 * 				c.checkGrammarNameInLetOrConstDeclarations(bindingElement.Name())
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarNameInLetOrConstDeclarations(receiver: GoPtr<Checker>, name: GoPtr<Node>): bool {
  if (name!.Kind === KindIdentifier) {
    if (Node_Text(name) === "let") {
      return Checker_grammarErrorOnNode(receiver, name, X_let_is_not_allowed_to_be_used_as_a_name_in_let_or_const_declarations);
    }
  } else {
    const elements = Node_Elements(name);
    if (elements !== undefined) {
      for (const element of elements!) {
        const bindingElementName = Node_Name(element);
        if (bindingElementName !== undefined) {
          Checker_checkGrammarNameInLetOrConstDeclarations(receiver, bindingElementName);
        }
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarVariableDeclarationList","kind":"method","status":"implemented","sigHash":"d9c83212f973a9c95f1d27d9b1faa24c79d357c61842814f25853a5cce1a8760","bodyHash":"902ccddd5118e4cde1b930d55ea1f89d758c0b44b6d29bd0869a42a2f4ecdc11"}
 *
 * Go source:
 * func (c *Checker) checkGrammarVariableDeclarationList(declarationList *ast.VariableDeclarationList) bool {
 * 	declarations := declarationList.Declarations
 * 	if c.checkGrammarForDisallowedTrailingComma(declarations, diagnostics.Trailing_comma_not_allowed) {
 * 		return true
 * 	}
 * 
 * 	if len(declarations.Nodes) == 0 {
 * 		return c.grammarErrorAtPos(declarationList.AsNode(), declarations.Pos(), declarations.End()-declarations.Pos(), diagnostics.Variable_declaration_list_cannot_be_empty)
 * 	}
 * 
 * 	blockScopeFlags := declarationList.Flags & ast.NodeFlagsBlockScoped
 * 	if blockScopeFlags == ast.NodeFlagsUsing || blockScopeFlags == ast.NodeFlagsAwaitUsing {
 * 		if ast.IsForInStatement(declarationList.Parent) {
 * 			return c.grammarErrorOnNode(declarationList.AsNode(), core.IfElse(blockScopeFlags == ast.NodeFlagsUsing, diagnostics.The_left_hand_side_of_a_for_in_statement_cannot_be_a_using_declaration, diagnostics.The_left_hand_side_of_a_for_in_statement_cannot_be_an_await_using_declaration))
 * 		}
 * 		if declarationList.Flags&ast.NodeFlagsAmbient != 0 {
 * 			return c.grammarErrorOnNode(declarationList.AsNode(), core.IfElse(blockScopeFlags == ast.NodeFlagsUsing, diagnostics.X_using_declarations_are_not_allowed_in_ambient_contexts, diagnostics.X_await_using_declarations_are_not_allowed_in_ambient_contexts))
 * 		}
 * 		if ast.IsVariableStatement(declarationList.Parent) && (ast.IsCaseClause(declarationList.Parent.Parent) || ast.IsDefaultClause(declarationList.Parent.Parent)) {
 * 			return c.grammarErrorOnNode(declarationList.AsNode(), core.IfElse(blockScopeFlags == ast.NodeFlagsUsing, diagnostics.X_using_declarations_are_not_allowed_in_case_or_default_clauses_unless_contained_within_a_block, diagnostics.X_await_using_declarations_are_not_allowed_in_case_or_default_clauses_unless_contained_within_a_block))
 * 		}
 * 	}
 * 
 * 	if blockScopeFlags == ast.NodeFlagsAwaitUsing {
 * 		return c.checkGrammarAwaitOrAwaitUsing(declarationList.AsNode())
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarVariableDeclarationList(receiver: GoPtr<Checker>, declarationList: GoPtr<VariableDeclarationList>): bool {
  const asNode = declarationList as unknown as GoPtr<Node>;
  const declarations = declarationList!.Declarations;
  if (Checker_checkGrammarForDisallowedTrailingComma(receiver, declarations, Trailing_comma_not_allowed)) {
    return true;
  }
  if (declarations!.Nodes.length === 0) {
    return Checker_grammarErrorAtPos(receiver, asNode, NodeList_Pos(declarations), NodeList_End(declarations) - NodeList_Pos(declarations), Variable_declaration_list_cannot_be_empty);
  }
  const blockScopeFlags = asNode!.Flags & NodeFlagsBlockScoped;
  if (blockScopeFlags === NodeFlagsUsing || blockScopeFlags === NodeFlagsAwaitUsing) {
    if (IsForInStatement(asNode!.Parent)) {
      return Checker_grammarErrorOnNode(receiver, asNode, IfElse(blockScopeFlags === NodeFlagsUsing, The_left_hand_side_of_a_for_in_statement_cannot_be_a_using_declaration, The_left_hand_side_of_a_for_in_statement_cannot_be_an_await_using_declaration));
    }
    if ((asNode!.Flags & NodeFlagsAmbient) !== 0) {
      return Checker_grammarErrorOnNode(receiver, asNode, IfElse(blockScopeFlags === NodeFlagsUsing, X_using_declarations_are_not_allowed_in_ambient_contexts, X_await_using_declarations_are_not_allowed_in_ambient_contexts));
    }
    if (IsVariableStatement(asNode!.Parent) && (IsCaseClause(asNode!.Parent!.Parent) || IsDefaultClause(asNode!.Parent!.Parent))) {
      return Checker_grammarErrorOnNode(receiver, asNode, IfElse(blockScopeFlags === NodeFlagsUsing, X_using_declarations_are_not_allowed_in_case_or_default_clauses_unless_contained_within_a_block, X_await_using_declarations_are_not_allowed_in_case_or_default_clauses_unless_contained_within_a_block));
    }
  }
  if (blockScopeFlags === NodeFlagsAwaitUsing) {
    return Checker_checkGrammarAwaitOrAwaitUsing(receiver, asNode);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarAwaitOrAwaitUsing","kind":"method","status":"implemented","sigHash":"0b96fc8e8dcee43a8e70850ee4409f075482da145f46877afb7f6ecd886b290d","bodyHash":"cae564a4ad367089af21d182c3ced534b8831ef4b91ecadf18587872cd258595"}
 *
 * Go source:
 * func (c *Checker) checkGrammarAwaitOrAwaitUsing(node *ast.Node) bool {
 * 	// Grammar checking
 * 	hasError := false
 * 	container := getContainingFunctionOrClassStaticBlock(node)
 * 	if container != nil && ast.IsClassStaticBlockDeclaration(container) {
 * 		// NOTE: We report this regardless as to whether there are parse diagnostics.
 * 		var message *diagnostics.Message
 * 		if ast.IsAwaitExpression(node) {
 * 			message = diagnostics.X_await_expression_cannot_be_used_inside_a_class_static_block
 * 		} else {
 * 			message = diagnostics.X_await_using_statements_cannot_be_used_inside_a_class_static_block
 * 		}
 * 		c.error(node, message)
 * 		hasError = true
 * 	} else if node.Flags&ast.NodeFlagsAwaitContext == 0 {
 * 		if ast.IsInTopLevelContext(node) {
 * 			sourceFile := ast.GetSourceFileOfNode(node)
 * 			if !c.hasParseDiagnostics(sourceFile) {
 * 				var span core.TextRange
 * 				var spanCalculated bool
 * 				if !ast.IsEffectiveExternalModule(sourceFile, c.compilerOptions) {
 * 					span = scanner.GetRangeOfTokenAtPosition(sourceFile, node.Pos())
 * 					spanCalculated = true
 * 					var message *diagnostics.Message
 * 					if ast.IsAwaitExpression(node) {
 * 						message = diagnostics.X_await_expressions_are_only_allowed_at_the_top_level_of_a_file_when_that_file_is_a_module_but_this_file_has_no_imports_or_exports_Consider_adding_an_empty_export_to_make_this_file_a_module
 * 					} else {
 * 						message = diagnostics.X_await_using_statements_are_only_allowed_at_the_top_level_of_a_file_when_that_file_is_a_module_but_this_file_has_no_imports_or_exports_Consider_adding_an_empty_export_to_make_this_file_a_module
 * 					}
 * 					diagnostic := ast.NewDiagnostic(sourceFile, span, message)
 * 					c.addDiagnostic(diagnostic)
 * 					hasError = true
 * 				}
 * 				switch c.moduleKind {
 * 				case core.ModuleKindNode16,
 * 					core.ModuleKindNode18,
 * 					core.ModuleKindNode20,
 * 					core.ModuleKindNodeNext:
 * 					sourceFileMetaData := c.program.GetSourceFileMetaData(sourceFile.Path())
 * 					if sourceFileMetaData.ImpliedNodeFormat == core.ModuleKindCommonJS {
 * 						if !spanCalculated {
 * 							span = scanner.GetRangeOfTokenAtPosition(sourceFile, node.Pos())
 * 						}
 * 						c.addDiagnostic(ast.NewDiagnostic(sourceFile, span, diagnostics.The_current_file_is_a_CommonJS_module_and_cannot_use_await_at_the_top_level))
 * 						hasError = true
 * 						break
 * 					}
 * 					fallthrough
 * 				case core.ModuleKindES2022,
 * 					core.ModuleKindESNext,
 * 					core.ModuleKindPreserve,
 * 					core.ModuleKindSystem:
 * 					if c.languageVersion >= core.ScriptTargetES2017 {
 * 						break
 * 					}
 * 					fallthrough
 * 				default:
 * 					if !spanCalculated {
 * 						span = scanner.GetRangeOfTokenAtPosition(sourceFile, node.Pos())
 * 					}
 * 					var message *diagnostics.Message
 * 					if ast.IsAwaitExpression(node) {
 * 						message = diagnostics.Top_level_await_expressions_are_only_allowed_when_the_module_option_is_set_to_es2022_esnext_system_node16_node18_node20_nodenext_or_preserve_and_the_target_option_is_set_to_es2017_or_higher
 * 					} else {
 * 						message = diagnostics.Top_level_await_using_statements_are_only_allowed_when_the_module_option_is_set_to_es2022_esnext_system_node16_node18_node20_nodenext_or_preserve_and_the_target_option_is_set_to_es2017_or_higher
 * 					}
 * 					c.addDiagnostic(ast.NewDiagnostic(sourceFile, span, message))
 * 					hasError = true
 * 				}
 * 			}
 * 		} else {
 * 			// use of 'await' in non-async function
 * 			sourceFile := ast.GetSourceFileOfNode(node)
 * 			if !c.hasParseDiagnostics(sourceFile) {
 * 				span := scanner.GetRangeOfTokenAtPosition(sourceFile, node.Pos())
 * 				var message *diagnostics.Message
 * 				if ast.IsAwaitExpression(node) {
 * 					message = diagnostics.X_await_expressions_are_only_allowed_within_async_functions_and_at_the_top_levels_of_modules
 * 				} else {
 * 					message = diagnostics.X_await_using_statements_are_only_allowed_within_async_functions_and_at_the_top_levels_of_modules
 * 				}
 * 				diagnostic := ast.NewDiagnostic(sourceFile, span, message)
 * 				if container != nil && container.Kind != ast.KindConstructor && !hasAsyncModifier(container) {
 * 					relatedInfo := NewDiagnosticForNode(container, diagnostics.Did_you_mean_to_mark_this_function_as_async)
 * 					diagnostic.AddRelatedInfo(relatedInfo)
 * 				}
 * 				c.addDiagnostic(diagnostic)
 * 				hasError = true
 * 			}
 * 		}
 * 	}
 * 
 * 	if ast.IsAwaitExpression(node) && c.isInParameterInitializerBeforeContainingFunction(node) {
 * 		// NOTE: We report this regardless as to whether there are parse diagnostics.
 * 		c.error(node, diagnostics.X_await_expressions_cannot_be_used_in_a_parameter_initializer)
 * 		hasError = true
 * 	}
 * 
 * 	return hasError
 * }
 */
export function Checker_checkGrammarAwaitOrAwaitUsing(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  let hasError = false;
  const container = getContainingFunctionOrClassStaticBlock(node);
  if (container !== undefined && IsClassStaticBlockDeclaration(container)) {
    const message = IsAwaitExpression(node)
      ? X_await_expression_cannot_be_used_inside_a_class_static_block
      : X_await_using_statements_cannot_be_used_inside_a_class_static_block;
    Checker_error(receiver, node, message);
    hasError = true;
  } else if ((node!.Flags & NodeFlagsAwaitContext) === 0) {
    if (IsInTopLevelContext(node)) {
      const sourceFile = GetSourceFileOfNode(node);
      if (!Checker_hasParseDiagnostics(receiver, sourceFile)) {
        let span = NewTextRange(0, 0);
        let spanCalculated = false;
        if (!IsEffectiveExternalModule(sourceFile, receiver!.compilerOptions)) {
          span = GetRangeOfTokenAtPosition(sourceFile, Node_Pos(node));
          spanCalculated = true;
          const message = IsAwaitExpression(node)
            ? X_await_expressions_are_only_allowed_at_the_top_level_of_a_file_when_that_file_is_a_module_but_this_file_has_no_imports_or_exports_Consider_adding_an_empty_export_to_make_this_file_a_module
            : X_await_using_statements_are_only_allowed_at_the_top_level_of_a_file_when_that_file_is_a_module_but_this_file_has_no_imports_or_exports_Consider_adding_an_empty_export_to_make_this_file_a_module;
          const diagnostic = NewDiagnostic(sourceFile, span, message);
          Checker_addDiagnostic(receiver, diagnostic);
          hasError = true;
        }
        const isNodeModuleKind = receiver!.moduleKind === ModuleKindNode16 || receiver!.moduleKind === ModuleKindNode18 || receiver!.moduleKind === ModuleKindNode20 || receiver!.moduleKind === ModuleKindNodeNext;
        const isEsModuleKind = receiver!.moduleKind === ModuleKindES2022 || receiver!.moduleKind === ModuleKindESNext || receiver!.moduleKind === ModuleKindPreserve || receiver!.moduleKind === ModuleKindSystem;
        let skipTopLevelError = false;
        if (isNodeModuleKind) {
          const sourceFileMetaData = receiver!.program.GetSourceFileMetaData(SourceFile_Path(sourceFile));
          if (sourceFileMetaData!.ImpliedNodeFormat === ModuleKindCommonJS) {
            if (!spanCalculated) {
              span = GetRangeOfTokenAtPosition(sourceFile, Node_Pos(node));
            }
            Checker_addDiagnostic(receiver, NewDiagnostic(sourceFile, span, The_current_file_is_a_CommonJS_module_and_cannot_use_await_at_the_top_level));
            hasError = true;
            skipTopLevelError = true;
          }
        }
        if (!skipTopLevelError && (isNodeModuleKind || isEsModuleKind)) {
          if (receiver!.languageVersion >= ScriptTargetES2017) {
            skipTopLevelError = true;
          }
        }
        if (!skipTopLevelError) {
          if (!spanCalculated) {
            span = GetRangeOfTokenAtPosition(sourceFile, Node_Pos(node));
          }
          const message = IsAwaitExpression(node)
            ? Top_level_await_expressions_are_only_allowed_when_the_module_option_is_set_to_es2022_esnext_system_node16_node18_node20_nodenext_or_preserve_and_the_target_option_is_set_to_es2017_or_higher
            : Top_level_await_using_statements_are_only_allowed_when_the_module_option_is_set_to_es2022_esnext_system_node16_node18_node20_nodenext_or_preserve_and_the_target_option_is_set_to_es2017_or_higher;
          Checker_addDiagnostic(receiver, NewDiagnostic(sourceFile, span, message));
          hasError = true;
        }
      }
    } else {
      const sourceFile = GetSourceFileOfNode(node);
      if (!Checker_hasParseDiagnostics(receiver, sourceFile)) {
        const span = GetRangeOfTokenAtPosition(sourceFile, Node_Pos(node));
        const message = IsAwaitExpression(node)
          ? X_await_expressions_are_only_allowed_within_async_functions_and_at_the_top_levels_of_modules
          : X_await_using_statements_are_only_allowed_within_async_functions_and_at_the_top_levels_of_modules;
        const diagnostic = NewDiagnostic(sourceFile, span, message);
        if (container !== undefined && container!.Kind !== KindConstructor && !hasAsyncModifier(container)) {
          const relatedInfo = createDiagnosticForNode(container, Did_you_mean_to_mark_this_function_as_async);
          Diagnostic_AddRelatedInfo(diagnostic, relatedInfo);
        }
        Checker_addDiagnostic(receiver, diagnostic);
        hasError = true;
      }
    }
  }
  if (IsAwaitExpression(node) && Checker_isInParameterInitializerBeforeContainingFunction(receiver, node)) {
    Checker_error(receiver, node, X_await_expressions_cannot_be_used_in_a_parameter_initializer);
    hasError = true;
  }
  return hasError;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarYieldExpression","kind":"method","status":"implemented","sigHash":"c6c93506126263e9c6c576fa2e17ebec1040961f8416c0874d3789ad7b35902f","bodyHash":"a5165aee27826bf96adb8e791b4bbe04ce86758ec05be2de84f4d1ff24432756"}
 *
 * Go source:
 * func (c *Checker) checkGrammarYieldExpression(node *ast.Node) bool {
 * 	hasError := false
 * 	if node.Flags&ast.NodeFlagsYieldContext == 0 {
 * 		c.grammarErrorOnFirstToken(node, diagnostics.A_yield_expression_is_only_allowed_in_a_generator_body)
 * 		hasError = true
 * 	}
 * 	if c.isInParameterInitializerBeforeContainingFunction(node) {
 * 		c.error(node, diagnostics.X_yield_expressions_cannot_be_used_in_a_parameter_initializer)
 * 		hasError = true
 * 	}
 * 	return hasError
 * }
 */
export function Checker_checkGrammarYieldExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  let hasError = false;
  if ((node!.Flags & NodeFlagsYieldContext) === 0) {
    Checker_grammarErrorOnFirstToken(receiver, node, A_yield_expression_is_only_allowed_in_a_generator_body);
    hasError = true;
  }
  if (Checker_isInParameterInitializerBeforeContainingFunction(receiver, node)) {
    Checker_error(receiver, node, X_yield_expressions_cannot_be_used_in_a_parameter_initializer);
    hasError = true;
  }
  return hasError;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForDisallowedBlockScopedVariableStatement","kind":"method","status":"implemented","sigHash":"40b32625ee2fc0e2c65c08d5007ecaf0f2f7d982681435fc5be94d1237fedf11","bodyHash":"f0f48fa8b6da7f2e77c64deab74ac504485c98c03ff17edd67cb8cf5de13c986"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForDisallowedBlockScopedVariableStatement(node *ast.VariableStatement) bool {
 * 	if !c.containerAllowsBlockScopedVariable(node.Parent) {
 * 		blockScopeKind := c.getCombinedNodeFlagsCached(node.DeclarationList) & ast.NodeFlagsBlockScoped
 * 		if blockScopeKind != 0 {
 * 			var keyword string
 * 			switch {
 * 			case blockScopeKind == ast.NodeFlagsLet:
 * 				keyword = "let"
 * 			case blockScopeKind == ast.NodeFlagsConst:
 * 				keyword = "const"
 * 			case blockScopeKind == ast.NodeFlagsUsing:
 * 				keyword = "using"
 * 			case blockScopeKind == ast.NodeFlagsAwaitUsing:
 * 				keyword = "await using"
 * 			default:
 * 				panic("Unknown BlockScope flag")
 * 			}
 * 			c.error(node.AsNode(), diagnostics.X_0_declarations_can_only_be_declared_inside_a_block, keyword)
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarForDisallowedBlockScopedVariableStatement(receiver: GoPtr<Checker>, node: GoPtr<VariableStatement>): bool {
  const asNode = node as unknown as GoPtr<Node>;
  if (!Checker_containerAllowsBlockScopedVariable(receiver, asNode!.Parent)) {
    const blockScopeKind = Checker_getCombinedNodeFlagsCached(receiver, node!.DeclarationList as unknown as GoPtr<Node>) & NodeFlagsBlockScoped;
    if (blockScopeKind !== 0) {
      let keyword: string;
      if (blockScopeKind === NodeFlagsLet) {
        keyword = "let";
      } else if (blockScopeKind === NodeFlagsConst) {
        keyword = "const";
      } else if (blockScopeKind === NodeFlagsUsing) {
        keyword = "using";
      } else if (blockScopeKind === NodeFlagsAwaitUsing) {
        keyword = "await using";
      } else {
        throw new globalThis.Error("Unknown BlockScope flag");
      }
      Checker_error(receiver, asNode, X_0_declarations_can_only_be_declared_inside_a_block, keyword);
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.containerAllowsBlockScopedVariable","kind":"method","status":"implemented","sigHash":"29912bcc5bf48b6d0f23c9a5a8488fd558a4fac90305277baeb5acd83ab00e80","bodyHash":"c1c1ceca4d5e87435da0d5cac89f91cd6136fba2b8e258c02d1b5409869c8eff"}
 *
 * Go source:
 * func (c *Checker) containerAllowsBlockScopedVariable(parent *ast.Node) bool {
 * 	switch parent.Kind {
 * 	case ast.KindIfStatement,
 * 		ast.KindDoStatement,
 * 		ast.KindWhileStatement,
 * 		ast.KindWithStatement,
 * 		ast.KindForStatement,
 * 		ast.KindForInStatement,
 * 		ast.KindForOfStatement:
 * 		return false
 * 	case ast.KindLabeledStatement:
 * 		return c.containerAllowsBlockScopedVariable(parent.Parent)
 * 	}
 * 
 * 	return true
 * }
 */
export function Checker_containerAllowsBlockScopedVariable(receiver: GoPtr<Checker>, parent: GoPtr<Node>): bool {
  switch (parent!.Kind) {
    case KindIfStatement:
    case KindDoStatement:
    case KindWhileStatement:
    case KindWithStatement:
    case KindForStatement:
    case KindForInStatement:
    case KindForOfStatement:
      return false;
    case KindLabeledStatement:
      return Checker_containerAllowsBlockScopedVariable(receiver, parent!.Parent);
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarMetaProperty","kind":"method","status":"implemented","sigHash":"4bc770ed2984edf4d20feac19b592c92b22c1f7459dd5f3ce865d814c116e833","bodyHash":"b0ebbda8a33c7799cc83c2d8a9f350b71787104bc45dc08ea2c77af0387445e4"}
 *
 * Go source:
 * func (c *Checker) checkGrammarMetaProperty(node *ast.MetaProperty) bool {
 * 	nodeName := node.Name()
 * 	nameText := nodeName.Text()
 * 
 * 	switch node.KeywordToken {
 * 	case ast.KindNewKeyword:
 * 		if nameText != "target" {
 * 			return c.grammarErrorOnNode(nodeName, diagnostics.X_0_is_not_a_valid_meta_property_for_keyword_1_Did_you_mean_2, nameText, scanner.TokenToString(node.KeywordToken), "target")
 * 		}
 * 	case ast.KindImportKeyword:
 * 		if nameText != "meta" {
 * 			isCallee := ast.IsCallExpression(node.Parent) && node.Parent.Expression() == node.AsNode()
 * 			if nameText == "defer" {
 * 				if !isCallee {
 * 					return c.grammarErrorAtPos(node.AsNode(), node.AsNode().End(), 0, diagnostics.X_0_expected, "(")
 * 				}
 * 			} else {
 * 				if isCallee {
 * 					return c.grammarErrorOnNode(nodeName, diagnostics.X_0_is_not_a_valid_meta_property_for_keyword_import_Did_you_mean_meta_or_defer, nameText)
 * 				}
 * 				return c.grammarErrorOnNode(nodeName, diagnostics.X_0_is_not_a_valid_meta_property_for_keyword_1_Did_you_mean_2, nameText, scanner.TokenToString(node.KeywordToken), "meta")
 * 			}
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarMetaProperty(receiver: GoPtr<Checker>, node: GoPtr<MetaProperty>): bool {
  const asNode = node as unknown as GoPtr<Node>;
  const nodeName = node!.name as unknown as GoPtr<Node>;
  const nameText = Node_Text(nodeName);
  switch (node!.KeywordToken) {
    case KindNewKeyword:
      if (nameText !== "target") {
        return Checker_grammarErrorOnNode(receiver, nodeName, X_0_is_not_a_valid_meta_property_for_keyword_1_Did_you_mean_2, nameText, TokenToString(node!.KeywordToken), "target");
      }
      break;
    case KindImportKeyword:
      if (nameText !== "meta") {
        const isCallee = IsCallExpression(asNode!.Parent) && Node_Expression(asNode!.Parent) === asNode;
        if (nameText === "defer") {
          if (!isCallee) {
            return Checker_grammarErrorAtPos(receiver, asNode, Node_End(asNode), 0, X_0_expected, "(");
          }
        } else {
          if (isCallee) {
            return Checker_grammarErrorOnNode(receiver, nodeName, X_0_is_not_a_valid_meta_property_for_keyword_import_Did_you_mean_meta_or_defer, nameText);
          }
          return Checker_grammarErrorOnNode(receiver, nodeName, X_0_is_not_a_valid_meta_property_for_keyword_1_Did_you_mean_2, nameText, TokenToString(node!.KeywordToken), "meta");
        }
      }
      break;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarConstructorTypeParameters","kind":"method","status":"implemented","sigHash":"1670da7194763883460ee547071ec5edbc0296917341511246b310b6111c87ca","bodyHash":"13feb6af29d0b5af98004feda53ab057dd4ad32b8cdcfbac9411b1960683e00e"}
 *
 * Go source:
 * func (c *Checker) checkGrammarConstructorTypeParameters(node *ast.ConstructorDeclaration) bool {
 * 	range_ := node.TypeParameters
 * 	if range_ != nil {
 * 		var pos int
 * 		if range_.Pos() == range_.End() {
 * 			pos = range_.Pos()
 * 		} else {
 * 			pos = scanner.SkipTrivia(ast.GetSourceFileOfNode(node.AsNode()).Text(), range_.Pos())
 * 		}
 * 		return c.grammarErrorAtPos(node.AsNode(), pos, range_.End()-pos, diagnostics.Type_parameters_cannot_appear_on_a_constructor_declaration)
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarConstructorTypeParameters(receiver: GoPtr<Checker>, node: GoPtr<ConstructorDeclaration>): bool {
  const asNode = node as unknown as GoPtr<Node>;
  const range_ = node!.TypeParameters;
  if (range_ !== undefined) {
    let pos: int;
    if (NodeList_Pos(range_) === NodeList_End(range_)) {
      pos = NodeList_Pos(range_);
    } else {
      pos = SkipTrivia(SourceFile_Text(GetSourceFileOfNode(asNode)), NodeList_Pos(range_));
    }
    return Checker_grammarErrorAtPos(receiver, asNode, pos, NodeList_End(range_) - pos, Type_parameters_cannot_appear_on_a_constructor_declaration);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarConstructorTypeAnnotation","kind":"method","status":"implemented","sigHash":"3af3a54069f7b31e50265e4f6a3be5619c98fecc7b95d99b184981b4d7676e90","bodyHash":"f16b6c3339b76f52daec627cdcf589579065737a2b1a719964dd8d40c44deaef"}
 *
 * Go source:
 * func (c *Checker) checkGrammarConstructorTypeAnnotation(node *ast.ConstructorDeclaration) bool {
 * 	t := node.Type
 * 	if t != nil {
 * 		return c.grammarErrorOnNode(t, diagnostics.Type_annotation_cannot_appear_on_a_constructor_declaration)
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarConstructorTypeAnnotation(receiver: GoPtr<Checker>, node: GoPtr<ConstructorDeclaration>): bool {
  const t = node!.Type;
  if (t !== undefined) {
    return Checker_grammarErrorOnNode(receiver, t as unknown as GoPtr<Node>, Type_annotation_cannot_appear_on_a_constructor_declaration);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarProperty","kind":"method","status":"implemented","sigHash":"b7d4890ce603bcb5bac702ad1074d7aa11c620541607dc0044831d3492b891a9","bodyHash":"28a9ec427d77647da3f7bb79716121187732512efe59ab28f7159a870405cc3c"}
 *
 * Go source:
 * func (c *Checker) checkGrammarProperty(node *ast.Node /*Union[PropertyDeclaration, PropertySignature]* /) bool {
 * 	propertyName := node.Name()
 * 	if ast.IsComputedPropertyName(propertyName) && ast.IsBinaryExpression(propertyName.Expression()) && propertyName.Expression().AsBinaryExpression().OperatorToken.Kind == ast.KindInKeyword {
 * 		return c.grammarErrorOnNode(node.Parent.Members()[0], diagnostics.A_mapped_type_may_not_declare_properties_or_methods)
 * 	}
 * 	if ast.IsClassLike(node.Parent) {
 * 		if ast.IsStringLiteral(propertyName) && propertyName.Text() == "constructor" {
 * 			return c.grammarErrorOnNode(propertyName, diagnostics.Classes_may_not_have_a_field_named_constructor)
 * 		}
 * 		if c.checkGrammarForInvalidDynamicName(propertyName, diagnostics.A_computed_property_name_in_a_class_property_declaration_must_have_a_simple_literal_type_or_a_unique_symbol_type) {
 * 			return true
 * 		}
 * 		if ast.IsAutoAccessorPropertyDeclaration(node) && c.checkGrammarForInvalidQuestionMark(node.PostfixToken(), diagnostics.An_accessor_property_cannot_be_declared_optional) {
 * 			return true
 * 		}
 * 	} else if ast.IsInterfaceDeclaration(node.Parent) {
 * 		if c.checkGrammarForInvalidDynamicName(propertyName, diagnostics.A_computed_property_name_in_an_interface_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type) {
 * 			return true
 * 		}
 * 		if !ast.IsPropertySignatureDeclaration(node) {
 * 			// Interfaces cannot contain property declarations
 * 			panic(fmt.Sprintf("Unexpected node kind %q", node.Kind))
 * 		}
 * 		if initializer := node.Initializer(); initializer != nil {
 * 			return c.grammarErrorOnNode(initializer, diagnostics.An_interface_property_cannot_have_an_initializer)
 * 		}
 * 	} else if ast.IsTypeLiteralNode(node.Parent) {
 * 		if c.checkGrammarForInvalidDynamicName(node.Name(), diagnostics.A_computed_property_name_in_a_type_literal_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type) {
 * 			return true
 * 		}
 * 		if !ast.IsPropertySignatureDeclaration(node) {
 * 			// Type literals cannot contain property declarations
 * 			panic(fmt.Sprintf("Unexpected node kind %q", node.Kind))
 * 		}
 * 		if initializer := node.Initializer(); initializer != nil {
 * 			return c.grammarErrorOnNode(initializer, diagnostics.A_type_literal_property_cannot_have_an_initializer)
 * 		}
 * 	}
 * 
 * 	if node.Flags&ast.NodeFlagsAmbient != 0 {
 * 		c.checkAmbientInitializer(node)
 * 	}
 * 
 * 	if ast.IsPropertyDeclaration(node) {
 * 		propDecl := node.AsPropertyDeclaration()
 * 		postfixToken := propDecl.PostfixToken
 * 		if postfixToken != nil && postfixToken.Kind == ast.KindExclamationToken {
 * 			switch {
 * 			case propDecl.Initializer != nil:
 * 				return c.grammarErrorOnNode(postfixToken, diagnostics.Declarations_with_initializers_cannot_also_have_definite_assignment_assertions)
 * 			case propDecl.Type == nil:
 * 				return c.grammarErrorOnNode(postfixToken, diagnostics.Declarations_with_definite_assignment_assertions_must_also_have_type_annotations)
 * 			case !ast.IsClassLike(node.Parent) || node.Flags&ast.NodeFlagsAmbient != 0 || ast.IsStatic(node) || ast.HasAbstractModifier(node):
 * 				return c.grammarErrorOnNode(postfixToken, diagnostics.A_definite_assignment_assertion_is_not_permitted_in_this_context)
 * 			}
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarProperty(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const propertyName = Node_Name(node);
  if (IsComputedPropertyName(propertyName) && IsBinaryExpression(Node_Expression(propertyName)) && AsBinaryExpression(Node_Expression(propertyName))!.OperatorToken!.Kind === KindInKeyword) {
    return Checker_grammarErrorOnNode(receiver, (Node_Members(node!.Parent) ?? [])[0], A_mapped_type_may_not_declare_properties_or_methods);
  }
  if (IsClassLike(node!.Parent)) {
    if (IsStringLiteral(propertyName) && Node_Text(propertyName) === "constructor") {
      return Checker_grammarErrorOnNode(receiver, propertyName, Classes_may_not_have_a_field_named_constructor);
    }
    if (Checker_checkGrammarForInvalidDynamicName(receiver, propertyName as unknown as GoPtr<DeclarationName>, A_computed_property_name_in_a_class_property_declaration_must_have_a_simple_literal_type_or_a_unique_symbol_type)) {
      return true;
    }
    if (IsAutoAccessorPropertyDeclaration(node) && Checker_checkGrammarForInvalidQuestionMark(receiver, Node_PostfixToken(node) as unknown as GoPtr<TokenNode>, An_accessor_property_cannot_be_declared_optional)) {
      return true;
    }
  } else if (IsInterfaceDeclaration(node!.Parent)) {
    if (Checker_checkGrammarForInvalidDynamicName(receiver, propertyName as unknown as GoPtr<DeclarationName>, A_computed_property_name_in_an_interface_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type)) {
      return true;
    }
    if (!IsPropertySignatureDeclaration(node)) {
      throw new globalThis.Error(`Unexpected node kind "${node!.Kind}"`);
    }
    const initializer = Node_Initializer(node);
    if (initializer !== undefined) {
      return Checker_grammarErrorOnNode(receiver, initializer, An_interface_property_cannot_have_an_initializer);
    }
  } else if (IsTypeLiteralNode(node!.Parent)) {
    if (Checker_checkGrammarForInvalidDynamicName(receiver, Node_Name(node) as unknown as GoPtr<DeclarationName>, A_computed_property_name_in_a_type_literal_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type)) {
      return true;
    }
    if (!IsPropertySignatureDeclaration(node)) {
      throw new globalThis.Error(`Unexpected node kind "${node!.Kind}"`);
    }
    const initializer2 = Node_Initializer(node);
    if (initializer2 !== undefined) {
      return Checker_grammarErrorOnNode(receiver, initializer2, A_type_literal_property_cannot_have_an_initializer);
    }
  }
  if ((node!.Flags & NodeFlagsAmbient) !== 0) {
    Checker_checkAmbientInitializer(receiver, node);
  }
  if (IsPropertyDeclaration(node)) {
    const propDecl = AsPropertyDeclaration(node);
    const postfixToken = propDecl!.PostfixToken;
    if (postfixToken !== undefined && postfixToken!.Kind === KindExclamationToken) {
      if (propDecl!.Initializer !== undefined) {
        return Checker_grammarErrorOnNode(receiver, postfixToken, Declarations_with_initializers_cannot_also_have_definite_assignment_assertions);
      } else if (propDecl!.Type === undefined) {
        return Checker_grammarErrorOnNode(receiver, postfixToken, Declarations_with_definite_assignment_assertions_must_also_have_type_annotations);
      } else if (!IsClassLike(node!.Parent) || (node!.Flags & NodeFlagsAmbient) !== 0 || IsStatic(node) || HasAbstractModifier(node)) {
        return Checker_grammarErrorOnNode(receiver, postfixToken, A_definite_assignment_assertion_is_not_permitted_in_this_context);
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkAmbientInitializer","kind":"method","status":"implemented","sigHash":"ee1ed4d76efef776e5c4b5f708d5bcd2d7f255404ec525f49025060cff5a706e","bodyHash":"43b5319f57d1072a199977ef1b711312c3a90509bcff2320cf587dd577dd3542"}
 *
 * Go source:
 * func (c *Checker) checkAmbientInitializer(node *ast.Node) bool {
 * 	var initializer *ast.Expression
 * 	var typeNode *ast.TypeNode
 * 	switch node.Kind {
 * 	case ast.KindVariableDeclaration:
 * 		varDecl := node.AsVariableDeclaration()
 * 		initializer = varDecl.Initializer
 * 		typeNode = varDecl.Type
 * 	case ast.KindPropertyDeclaration:
 * 		propDecl := node.AsPropertyDeclaration()
 * 		initializer = propDecl.Initializer
 * 		typeNode = propDecl.Type
 * 	case ast.KindPropertySignature:
 * 		propSig := node.AsPropertySignatureDeclaration()
 * 		initializer = propSig.Initializer
 * 		typeNode = propSig.Type
 * 	default:
 * 		panic(fmt.Sprintf("Unexpected node kind %q", node.Kind))
 * 	}
 * 
 * 	if initializer != nil {
 * 		isInvalidInitializer := !(isInitializerStringOrNumberLiteralExpression(initializer) || c.isInitializerSimpleLiteralEnumReference(initializer) || initializer.Kind == ast.KindTrueKeyword || initializer.Kind == ast.KindFalseKeyword || isInitializerBigIntLiteralExpression(initializer))
 * 		isConstOrReadonly := isDeclarationReadonly(node) || ast.IsVariableDeclaration(node) && c.isVarConstLike(node)
 * 		if isConstOrReadonly && (typeNode == nil) {
 * 			if isInvalidInitializer {
 * 				return c.grammarErrorOnNode(initializer, diagnostics.A_const_initializer_in_an_ambient_context_must_be_a_string_or_numeric_literal_or_literal_enum_reference)
 * 			}
 * 		} else {
 * 			return c.grammarErrorOnNode(initializer, diagnostics.Initializers_are_not_allowed_in_ambient_contexts)
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkAmbientInitializer(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  let initializer: GoPtr<Node> | undefined = undefined;
  let typeNode: GoPtr<Node> | undefined = undefined;
  if (node!.Kind === KindVariableDeclarationNode) {
    const varDecl = AsVariableDeclaration(node);
    initializer = varDecl!.Initializer as unknown as GoPtr<Node>;
    typeNode = varDecl!.Type as unknown as GoPtr<Node>;
  } else if (node!.Kind === KindPropertyDeclaration) {
    const propDecl = AsPropertyDeclaration(node);
    initializer = propDecl!.Initializer as unknown as GoPtr<Node>;
    typeNode = propDecl!.Type as unknown as GoPtr<Node>;
  } else if (node!.Kind === KindPropertySignature) {
    const propSig = AsPropertySignatureDeclaration(node);
    initializer = propSig!.Initializer as unknown as GoPtr<Node>;
    typeNode = propSig!.Type as unknown as GoPtr<Node>;
  } else {
    throw new globalThis.Error(`Unexpected node kind "${node!.Kind}"`);
  }
  if (initializer !== undefined) {
    const isInvalidInitializer = !(isInitializerStringOrNumberLiteralExpression(initializer as unknown as GoPtr<Expression>) || Checker_isInitializerSimpleLiteralEnumReference(receiver, initializer as unknown as GoPtr<Expression>) || initializer!.Kind === KindTrueKeyword || initializer!.Kind === KindFalseKeyword || isInitializerBigIntLiteralExpression(initializer as unknown as GoPtr<Expression>));
    const isConstOrReadonly = isDeclarationReadonly(node) || (node!.Kind === KindVariableDeclarationNode && Checker_isVarConstLike(receiver, node));
    if (isConstOrReadonly && typeNode === undefined) {
      if (isInvalidInitializer) {
        return Checker_grammarErrorOnNode(receiver, initializer, A_const_initializer_in_an_ambient_context_must_be_a_string_or_numeric_literal_or_literal_enum_reference);
      }
    } else {
      return Checker_grammarErrorOnNode(receiver, initializer, Initializers_are_not_allowed_in_ambient_contexts);
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::func::isInitializerStringOrNumberLiteralExpression","kind":"func","status":"implemented","sigHash":"6553a5f71455e8cfc9fa72c8f0e589fc25b094961b0af36dd7e3fee49169881c","bodyHash":"25d8c789509d9c56872b214ddf7a1c733a7ce69f0297392086d8b05b4c446438"}
 *
 * Go source:
 * func isInitializerStringOrNumberLiteralExpression(expr *ast.Expression) bool {
 * 	return ast.IsStringOrNumericLiteralLike(expr) ||
 * 		expr.Kind == ast.KindPrefixUnaryExpression && expr.AsPrefixUnaryExpression().Operator == ast.KindMinusToken && expr.AsPrefixUnaryExpression().Operand.Kind == ast.KindNumericLiteral
 * }
 */
export function isInitializerStringOrNumberLiteralExpression(expr: GoPtr<Expression>): bool {
  const asNode = expr as unknown as GoPtr<Node>;
  return IsStringOrNumericLiteralLike(asNode) || (asNode!.Kind === KindPrefixUnaryExpression && AsPrefixUnaryExpression(asNode)!.Operator === KindMinusToken && AsPrefixUnaryExpression(asNode)!.Operand!.Kind === KindNumericLiteral);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::func::isInitializerBigIntLiteralExpression","kind":"func","status":"implemented","sigHash":"dfc359fe64c0b1aec32adee93287a0561233d9278954574e8960c7c00b5e713d","bodyHash":"185e334be3f99d1b3805151730820d0babbebe44773310c7305ecc253626921d"}
 *
 * Go source:
 * func isInitializerBigIntLiteralExpression(expr *ast.Expression) bool {
 * 	if expr.Kind == ast.KindBigIntLiteral {
 * 		return true
 * 	}
 * 
 * 	if expr.Kind == ast.KindPrefixUnaryExpression {
 * 		unaryExpr := expr.AsPrefixUnaryExpression()
 * 		return unaryExpr.Operator == ast.KindMinusToken && unaryExpr.Operand.Kind == ast.KindBigIntLiteral
 * 	}
 * 
 * 	return false
 * }
 */
export function isInitializerBigIntLiteralExpression(expr: GoPtr<Expression>): bool {
  const asNode = expr as unknown as GoPtr<Node>;
  if (asNode!.Kind === KindBigIntLiteral) {
    return true;
  }
  if (asNode!.Kind === KindPrefixUnaryExpression) {
    const unaryExpr = AsPrefixUnaryExpression(asNode);
    return unaryExpr!.Operator === KindMinusToken && unaryExpr!.Operand!.Kind === KindBigIntLiteral;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.isInitializerSimpleLiteralEnumReference","kind":"method","status":"implemented","sigHash":"b29e0e16bf36f2a495b7fd5902c96e0d54f29f5d8af9555bc8a5af833049e3e6","bodyHash":"980c27ab24b5113d9375efbed8fcee74536f12f4b7e9f235462117604953f5ba"}
 *
 * Go source:
 * func (c *Checker) isInitializerSimpleLiteralEnumReference(expr *ast.Expression) bool {
 * 	if ast.IsPropertyAccessExpression(expr) {
 * 		return c.checkExpressionCached(expr).flags&TypeFlagsEnumLike != 0
 * 	}
 * 
 * 	if ast.IsElementAccessExpression(expr) {
 * 		elementAccess := expr.AsElementAccessExpression()
 * 
 * 		return isInitializerStringOrNumberLiteralExpression(elementAccess.ArgumentExpression) &&
 * 			ast.IsEntityNameExpression(elementAccess.Expression) &&
 * 			c.checkExpressionCached(expr).flags&TypeFlagsEnumLike != 0
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_isInitializerSimpleLiteralEnumReference(receiver: GoPtr<Checker>, expr: GoPtr<Expression>): bool {
  const asNode = expr as unknown as GoPtr<Node>;
  if (IsPropertyAccessExpression(asNode)) {
    return (Checker_checkExpressionCached(receiver, asNode)!.flags & TypeFlagsEnumLike) !== 0;
  }
  if (IsElementAccessExpression(asNode)) {
    const elementAccess = AsElementAccessExpression(asNode);
    return isInitializerStringOrNumberLiteralExpression(elementAccess!.ArgumentExpression as unknown as GoPtr<Expression>) && IsEntityNameExpression(elementAccess!.Expression as unknown as GoPtr<Node>) && (Checker_checkExpressionCached(receiver, asNode)!.flags & TypeFlagsEnumLike) !== 0;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarTopLevelElementForRequiredDeclareModifier","kind":"method","status":"implemented","sigHash":"39c66fc4c267cc6dcc95a9e3c463181c43cc78b9477eee03820a86e432079084","bodyHash":"9934f0457db57f195da374b3a8a198f0818586b8e3ff423056a20fe9d7a214bd"}
 *
 * Go source:
 * func (c *Checker) checkGrammarTopLevelElementForRequiredDeclareModifier(node *ast.Node) bool {
 * 	// A declare modifier is required for any top level .d.ts declaration except export=, export default, export as namespace
 * 	// interfaces and imports categories:
 * 	//
 * 	//  DeclarationElement:
 * 	//     ExportAssignment
 * 	//     export_opt   InterfaceDeclaration
 * 	//     export_opt   TypeAliasDeclaration
 * 	//     export_opt   ImportDeclaration
 * 	//     export_opt   ExternalImportDeclaration
 * 	//     export_opt   AmbientDeclaration
 * 	//
 * 	// TODO: The spec needs to be amended to reflect this grammar.
 * 	if node.Kind == ast.KindInterfaceDeclaration || node.Kind == ast.KindTypeAliasDeclaration || node.Kind == ast.KindImportDeclaration || node.Kind == ast.KindJSImportDeclaration || node.Kind == ast.KindImportEqualsDeclaration || node.Kind == ast.KindExportDeclaration || node.Kind == ast.KindExportAssignment || node.Kind == ast.KindNamespaceExportDeclaration || ast.HasSyntacticModifier(node, ast.ModifierFlagsAmbient|ast.ModifierFlagsExport|ast.ModifierFlagsDefault) {
 * 		return false
 * 	}
 * 
 * 	return c.grammarErrorOnFirstToken(node, diagnostics.Top_level_declarations_in_d_ts_files_must_start_with_either_a_declare_or_export_modifier)
 * }
 */
export function Checker_checkGrammarTopLevelElementForRequiredDeclareModifier(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (node!.Kind === KindInterfaceDeclaration || node!.Kind === KindTypeAliasDeclaration || node!.Kind === KindImportDeclaration || node!.Kind === KindJSImportDeclaration || node!.Kind === KindImportEqualsDeclaration || node!.Kind === KindExportDeclaration || node!.Kind === KindExportAssignment || node!.Kind === KindNamespaceExportDeclaration || HasSyntacticModifier(node, ModifierFlagsAmbient | ModifierFlagsExport | ModifierFlagsDefault)) {
    return false;
  }
  return Checker_grammarErrorOnFirstToken(receiver, node, Top_level_declarations_in_d_ts_files_must_start_with_either_a_declare_or_export_modifier);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarTopLevelElementsForRequiredDeclareModifier","kind":"method","status":"implemented","sigHash":"52d04b72f38c919ea581d38fd5e25217a2a9d597b47b31dcb3e35f883526ce48","bodyHash":"efa6a9449860206a3760379c88aba5646f6aecc43167ce376b3fee04d3aad591"}
 *
 * Go source:
 * func (c *Checker) checkGrammarTopLevelElementsForRequiredDeclareModifier(file *ast.SourceFile) bool {
 * 	for _, decl := range file.Statements.Nodes {
 * 		if ast.IsDeclarationNode(decl) || decl.Kind == ast.KindVariableStatement {
 * 			if c.checkGrammarTopLevelElementForRequiredDeclareModifier(decl) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarTopLevelElementsForRequiredDeclareModifier(receiver: GoPtr<Checker>, file: GoPtr<SourceFile>): bool {
  const fileAsNode = file as unknown as GoPtr<Node>;
  const statements = Node_Statements(fileAsNode);
  for (const decl of statements!) {
    if (IsDeclarationNode(decl) || decl!.Kind === KindVariableStatement) {
      if (Checker_checkGrammarTopLevelElementForRequiredDeclareModifier(receiver, decl)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarSourceFile","kind":"method","status":"implemented","sigHash":"6b55248003fc85dff7d5c434a0f70b9e32b5bd3fb24fd3239072f38de1493a86","bodyHash":"59604fcfb3b922a9cb27815c3a012d4ee4616ce1e4c79c2db865cab1cdc72f83"}
 *
 * Go source:
 * func (c *Checker) checkGrammarSourceFile(node *ast.SourceFile) bool {
 * 	return node.Flags&ast.NodeFlagsAmbient != 0 && c.checkGrammarTopLevelElementsForRequiredDeclareModifier(node)
 * }
 */
export function Checker_checkGrammarSourceFile(receiver: GoPtr<Checker>, node: GoPtr<SourceFile>): bool {
  return ((node as unknown as GoPtr<Node>)!.Flags & NodeFlagsAmbient) !== 0 && Checker_checkGrammarTopLevelElementsForRequiredDeclareModifier(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarStatementInAmbientContext","kind":"method","status":"implemented","sigHash":"e899617be4cf828ba797385e789c53dbf2a267040b7378d2080a644c6e29ad47","bodyHash":"f41d355f5491362199a770d458115ff5c60056180eb9cbae48b9825b0c5fbf1f"}
 *
 * Go source:
 * func (c *Checker) checkGrammarStatementInAmbientContext(node *ast.Node) bool {
 * 	if node.Flags&ast.NodeFlagsAmbient != 0 {
 * 		// Find containing block which is either Block, ModuleBlock, SourceFile
 * 		links := c.nodeLinks.Get(node)
 * 		if !links.hasReportedStatementInAmbientContext && (ast.IsFunctionLike(node.Parent) || ast.IsAccessor(node.Parent)) {
 * 			links.hasReportedStatementInAmbientContext = c.grammarErrorOnFirstToken(node, diagnostics.An_implementation_cannot_be_declared_in_ambient_contexts)
 * 			return links.hasReportedStatementInAmbientContext
 * 		}
 * 
 * 		// We are either parented by another statement, or some sort of block.
 * 		// If we're in a block, we only want to really report an error once
 * 		// to prevent noisiness.  So use a bit on the block to indicate if
 * 		// this has already been reported, and don't report if it has.
 * 		//
 * 		if node.Parent.Kind == ast.KindBlock || node.Parent.Kind == ast.KindModuleBlock || node.Parent.Kind == ast.KindSourceFile {
 * 			links := c.nodeLinks.Get(node.Parent)
 * 			// Check if the containing block ever report this error
 * 			if !links.hasReportedStatementInAmbientContext {
 * 				links.hasReportedStatementInAmbientContext = c.grammarErrorOnFirstToken(node, diagnostics.Statements_are_not_allowed_in_ambient_contexts)
 * 				return links.hasReportedStatementInAmbientContext
 * 			}
 * 		} else {
 * 			// We must be parented by a statement.  If so, there's no need
 * 			// to report the error as our parent will have already done it.
 * 			// debug.Assert(ast.IsStatement(node.Parent)) // !!! commented out in strada - fails if uncommented
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarStatementInAmbientContext(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if ((node!.Flags & NodeFlagsAmbient) !== 0) {
    const links = LinkStore_Get(receiver!.nodeLinks, node) as GoPtr<NodeLinks>;
    if (!links!.hasReportedStatementInAmbientContext && (IsFunctionLike(node!.Parent) || IsAccessor(node!.Parent))) {
      links!.hasReportedStatementInAmbientContext = Checker_grammarErrorOnFirstToken(receiver, node, An_implementation_cannot_be_declared_in_ambient_contexts);
      return links!.hasReportedStatementInAmbientContext;
    }
    if (node!.Parent!.Kind === KindBlock || node!.Parent!.Kind === KindModuleBlock || node!.Parent!.Kind === KindSourceFile) {
      const parentLinks = LinkStore_Get(receiver!.nodeLinks, node!.Parent) as GoPtr<NodeLinks>;
      if (!parentLinks!.hasReportedStatementInAmbientContext) {
        parentLinks!.hasReportedStatementInAmbientContext = Checker_grammarErrorOnFirstToken(receiver, node, Statements_are_not_allowed_in_ambient_contexts);
        return parentLinks!.hasReportedStatementInAmbientContext;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarNumericLiteral","kind":"method","status":"implemented","sigHash":"8e9bc9f3b74f7e0840ceb4feae42c4b1f5c091770cb3186156cfa5796d094ff1","bodyHash":"441058860d530d31847f22ecdaa754167790a8a81cb018db397d1ee7fa42aac3"}
 *
 * Go source:
 * func (c *Checker) checkGrammarNumericLiteral(node *ast.NumericLiteral) {
 * 	nodeText := scanner.GetTextOfNode(node.AsNode())
 * 
 * 	// Realism (size) checking
 * 	// We should test against `getTextOfNode(node)` rather than `node.text`, because `node.text` for large numeric literals can contain "."
 * 	// e.g. `node.text` for numeric literal `1100000000000000000000` is `1.1e21`.
 * 	isFractional := strings.ContainsRune(nodeText, '.')
 * 	isScientific := node.TokenFlags&ast.TokenFlagsScientific != 0
 * 
 * 	// Scientific notation (e.g. 2e54 and 1e00000000010) can't be converted to bigint
 * 	// Fractional numbers (e.g. 9000000000000000.001) are inherently imprecise anyway
 * 	if isFractional || isScientific {
 * 		return
 * 	}
 * 
 * 	// Here `node` is guaranteed to be a numeric literal representing an integer.
 * 	// We need to judge whether the integer `node` represents is <= 2 ** 53 - 1, which can be accomplished by comparing to `value` defined below because:
 * 	// 1) when `node` represents an integer <= 2 ** 53 - 1, `node.text` is its exact string representation and thus `value` precisely represents the integer.
 * 	// 2) otherwise, although `node.text` may be imprecise string representation, its mathematical value and consequently `value` cannot be less than 2 ** 53,
 * 	//    thus the result of the predicate won't be affected.
 * 	value := jsnum.FromString(node.Text)
 * 	if value <= jsnum.MaxSafeInteger {
 * 		return
 * 	}
 * 
 * 	c.addErrorOrSuggestion(false, createDiagnosticForNode(node.AsNode(), diagnostics.Numeric_literals_with_absolute_values_equal_to_2_53_or_greater_are_too_large_to_be_represented_accurately_as_integers))
 * }
 */
export function Checker_checkGrammarNumericLiteral(receiver: GoPtr<Checker>, node: GoPtr<NumericLiteral>): void {
  const nodeText = GetTextOfNode(node as unknown as GoPtr<Node>);
  const isFractional = nodeText.includes(".");
  const isScientific = (node!.TokenFlags & TokenFlagsScientific) !== 0;
  if (isFractional || isScientific) {
    return;
  }
  const value = FromString(node!.Text);
  if (value <= MaxSafeInteger) {
    return;
  }
  Checker_addErrorOrSuggestion(receiver, false, createDiagnosticForNode(node as unknown as GoPtr<Node>, Numeric_literals_with_absolute_values_equal_to_2_53_or_greater_are_too_large_to_be_represented_accurately_as_integers));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarBigIntLiteral","kind":"method","status":"implemented","sigHash":"c360f4c6b0225730377d3ba483b01c580b79be61d6465d256082e20843803a13","bodyHash":"db0e760f394df87730d3192b1a1cf7fdb5d5ed698dc83d9f7cf6e0944a779bf8"}
 *
 * Go source:
 * func (c *Checker) checkGrammarBigIntLiteral(node *ast.BigIntLiteral) bool {
 * 	literalType := ast.IsLiteralTypeNode(node.Parent) || ast.IsPrefixUnaryExpression(node.Parent) && ast.IsLiteralTypeNode(node.Parent.Parent)
 * 	if !literalType {
 * 		// Don't error on BigInt literals in ambient contexts
 * 		if node.Flags&ast.NodeFlagsAmbient == 0 && c.languageVersion < core.ScriptTargetES2020 {
 * 			if c.grammarErrorOnNode(node.AsNode(), diagnostics.BigInt_literals_are_not_available_when_targeting_lower_than_ES2020) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarBigIntLiteral(receiver: GoPtr<Checker>, node: GoPtr<BigIntLiteral>): bool {
  const asNode = node as unknown as GoPtr<Node>;
  const literalType = IsLiteralTypeNode(asNode!.Parent) || (IsPrefixUnaryExpression(asNode!.Parent) && IsLiteralTypeNode(asNode!.Parent!.Parent));
  if (!literalType) {
    if ((asNode!.Flags & NodeFlagsAmbient) === 0 && receiver!.languageVersion < ScriptTargetES2020) {
      if (Checker_grammarErrorOnNode(receiver, asNode, BigInt_literals_are_not_available_when_targeting_lower_than_ES2020)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarImportClause","kind":"method","status":"implemented","sigHash":"76cf413b7c60dffe9e6275de8e1f5a16a72cda77deca69f93b602c8cc9e3985d","bodyHash":"392930ba0ecd1a00d96c11e64e78bdecee58c17b44545db81d5c759a7083eb91"}
 *
 * Go source:
 * func (c *Checker) checkGrammarImportClause(node *ast.ImportClause) bool {
 * 	switch node.PhaseModifier {
 * 	case ast.KindTypeKeyword:
 * 		if node.Flags&ast.NodeFlagsJSDoc == 0 && node.Name() != nil && node.NamedBindings != nil {
 * 			return c.grammarErrorOnNode(&node.Node, diagnostics.A_type_only_import_can_specify_a_default_import_or_named_bindings_but_not_both)
 * 		}
 * 		if node.NamedBindings != nil && node.NamedBindings.Kind == ast.KindNamedImports {
 * 			return c.checkGrammarTypeOnlyNamedImportsOrExports(node.NamedBindings)
 * 		}
 * 	case ast.KindDeferKeyword:
 * 		if node.Name() != nil {
 * 			return c.grammarErrorOnNode(&node.Node, diagnostics.Default_imports_are_not_allowed_in_a_deferred_import)
 * 		}
 * 		if node.NamedBindings != nil && node.NamedBindings.Kind == ast.KindNamedImports {
 * 			return c.grammarErrorOnNode(&node.Node, diagnostics.Named_imports_are_not_allowed_in_a_deferred_import)
 * 		}
 * 		if c.moduleKind != core.ModuleKindESNext && c.moduleKind != core.ModuleKindPreserve {
 * 			return c.grammarErrorOnNode(&node.Node, diagnostics.Deferred_imports_are_only_supported_when_the_module_flag_is_set_to_esnext_or_preserve)
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarImportClause(receiver: GoPtr<Checker>, node: GoPtr<ImportClause>): bool {
  const asNode = node as unknown as GoPtr<Node>;
  switch (node!.PhaseModifier) {
    case KindTypeKeyword:
      if ((asNode!.Flags & NodeFlagsJSDoc) === 0 && Node_Name(asNode) !== undefined && node!.NamedBindings !== undefined) {
        return Checker_grammarErrorOnNode(receiver, asNode, A_type_only_import_can_specify_a_default_import_or_named_bindings_but_not_both);
      }
      if (node!.NamedBindings !== undefined && node!.NamedBindings!.Kind === KindNamedImports) {
        return Checker_checkGrammarTypeOnlyNamedImportsOrExports(receiver, node!.NamedBindings as unknown as GoPtr<Node>);
      }
      break;
    case KindDeferKeyword:
      if (Node_Name(asNode) !== undefined) {
        return Checker_grammarErrorOnNode(receiver, asNode, Default_imports_are_not_allowed_in_a_deferred_import);
      }
      if (node!.NamedBindings !== undefined && node!.NamedBindings!.Kind === KindNamedImports) {
        return Checker_grammarErrorOnNode(receiver, asNode, Named_imports_are_not_allowed_in_a_deferred_import);
      }
      if (receiver!.moduleKind !== ModuleKindESNext && receiver!.moduleKind !== ModuleKindPreserve) {
        return Checker_grammarErrorOnNode(receiver, asNode, Deferred_imports_are_only_supported_when_the_module_flag_is_set_to_esnext_or_preserve);
      }
      break;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarTypeOnlyNamedImportsOrExports","kind":"method","status":"implemented","sigHash":"dc7b0ef2f77709f35264fb14617473a2c2e3c5f033bc7beb8b293ba092fd6bdf","bodyHash":"6ac6167e29bc647fcff2f0a2c704fe76dac55283c5ab3f0f9607efcbc39450be"}
 *
 * Go source:
 * func (c *Checker) checkGrammarTypeOnlyNamedImportsOrExports(namedBindings *ast.Node) bool {
 * 	nodeList := namedBindings.ElementList()
 * 	for _, specifier := range nodeList.Nodes {
 * 		var specifierIsTypeOnly bool
 * 		var message *diagnostics.Message
 * 		if specifier.Kind == ast.KindImportSpecifier {
 * 			specifierIsTypeOnly = specifier.IsTypeOnly()
 * 			message = diagnostics.The_type_modifier_cannot_be_used_on_a_named_import_when_import_type_is_used_on_its_import_statement
 * 		} else {
 * 			specifierIsTypeOnly = specifier.IsTypeOnly()
 * 			message = diagnostics.The_type_modifier_cannot_be_used_on_a_named_export_when_export_type_is_used_on_its_export_statement
 * 		}
 * 
 * 		if specifierIsTypeOnly {
 * 			return c.grammarErrorOnFirstToken(specifier, message)
 * 		}
 * 	}
 * 
 * 	return false
 * }
 */
export function Checker_checkGrammarTypeOnlyNamedImportsOrExports(receiver: GoPtr<Checker>, namedBindings: GoPtr<Node>): bool {
  const nodeList = Node_ElementList(namedBindings);
  for (const specifier of nodeList!.Nodes) {
    let specifierIsTypeOnly: bool;
    let message: GoPtr<Message>;
    if (specifier!.Kind === KindImportSpecifier) {
      specifierIsTypeOnly = Node_IsTypeOnly(specifier);
      message = The_type_modifier_cannot_be_used_on_a_named_import_when_import_type_is_used_on_its_import_statement;
    } else {
      specifierIsTypeOnly = Node_IsTypeOnly(specifier);
      message = The_type_modifier_cannot_be_used_on_a_named_export_when_export_type_is_used_on_its_export_statement;
    }
    if (specifierIsTypeOnly) {
      return Checker_grammarErrorOnFirstToken(receiver, specifier, message);
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarImportCallExpression","kind":"method","status":"implemented","sigHash":"b2688527c1f504e73e061e8f29331e39aa0e19b3c2f67ab880c22687a3f924d3","bodyHash":"cfcff84e1bc59cb40df9c04fea1a0c2ab7226f8c85153dd90ca95bd9cd617af0"}
 *
 * Go source:
 * func (c *Checker) checkGrammarImportCallExpression(node *ast.Node) bool {
 * 	if c.compilerOptions.VerbatimModuleSyntax == core.TSTrue && c.moduleKind == core.ModuleKindCommonJS {
 * 		return c.grammarErrorOnNode(node, getVerbatimModuleSyntaxErrorMessage(node))
 * 	}
 * 
 * 	if node.Expression().Kind == ast.KindMetaProperty {
 * 		if c.moduleKind != core.ModuleKindESNext && c.moduleKind != core.ModuleKindPreserve {
 * 			return c.grammarErrorOnNode(node, diagnostics.Deferred_imports_are_only_supported_when_the_module_flag_is_set_to_esnext_or_preserve)
 * 		}
 * 	} else if c.moduleKind == core.ModuleKindES2015 {
 * 		return c.grammarErrorOnNode(node, diagnostics.Dynamic_imports_are_only_supported_when_the_module_flag_is_set_to_es2020_es2022_esnext_commonjs_amd_system_umd_node16_node18_node20_or_nodenext)
 * 	}
 * 
 * 	nodeAsCall := node.AsCallExpression()
 * 	if nodeAsCall.TypeArguments != nil {
 * 		return c.grammarErrorOnNode(node, diagnostics.This_use_of_import_is_invalid_import_calls_can_be_written_but_they_must_have_parentheses_and_cannot_have_type_arguments)
 * 	}
 * 
 * 	nodeArguments := nodeAsCall.Arguments
 * 	argumentNodes := nodeArguments.Nodes
 * 	if !(core.ModuleKindNode16 <= c.moduleKind && c.moduleKind <= core.ModuleKindNodeNext) && c.moduleKind != core.ModuleKindESNext && c.moduleKind != core.ModuleKindPreserve {
 * 		// We are allowed trailing comma after proposal-import-assertions.
 * 		c.checkGrammarForDisallowedTrailingComma(nodeArguments, diagnostics.Trailing_comma_not_allowed)
 * 
 * 		if len(argumentNodes) > 1 {
 * 			importAttributesArgument := argumentNodes[1]
 * 			return c.grammarErrorOnNode(importAttributesArgument, diagnostics.Dynamic_imports_only_support_a_second_argument_when_the_module_option_is_set_to_esnext_node16_node18_node20_nodenext_or_preserve)
 * 		}
 * 	}
 * 
 * 	if len(argumentNodes) == 0 || len(argumentNodes) > 2 {
 * 		return c.grammarErrorOnNode(node, diagnostics.Dynamic_imports_can_only_accept_a_module_specifier_and_an_optional_set_of_attributes_as_arguments)
 * 	}
 * 
 * 	// see: parseArgumentOrArrayLiteralElement...we use this function which parse arguments of callExpression to parse specifier for dynamic import.
 * 	// parseArgumentOrArrayLiteralElement allows spread element to be in an argument list which is not allowed as specifier in dynamic import.
 * 	spreadElement := core.Find(argumentNodes, ast.IsSpreadElement)
 * 	if spreadElement != nil {
 * 		return c.grammarErrorOnNode(spreadElement, diagnostics.Argument_of_dynamic_import_cannot_be_spread_element)
 * 	}
 * 	return false
 * }
 */
export function Checker_checkGrammarImportCallExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (receiver!.compilerOptions!.VerbatimModuleSyntax === TSTrue && receiver!.moduleKind === ModuleKindCommonJS) {
    return Checker_grammarErrorOnNode(receiver, node, getVerbatimModuleSyntaxErrorMessage(node));
  }
  if (Node_Expression(node)!.Kind === KindMetaProperty) {
    if (receiver!.moduleKind !== ModuleKindESNext && receiver!.moduleKind !== ModuleKindPreserve) {
      return Checker_grammarErrorOnNode(receiver, node, Deferred_imports_are_only_supported_when_the_module_flag_is_set_to_esnext_or_preserve);
    }
  } else if (receiver!.moduleKind === ModuleKindES2015) {
    return Checker_grammarErrorOnNode(receiver, node, Dynamic_imports_are_only_supported_when_the_module_flag_is_set_to_es2020_es2022_esnext_commonjs_amd_system_umd_node16_node18_node20_or_nodenext);
  }
  const nodeAsCall = AsCallExpression(node);
  if (nodeAsCall!.TypeArguments !== undefined) {
    return Checker_grammarErrorOnNode(receiver, node, This_use_of_import_is_invalid_import_calls_can_be_written_but_they_must_have_parentheses_and_cannot_have_type_arguments);
  }
  const nodeArguments = nodeAsCall!.Arguments;
  const argumentNodes = nodeArguments!.Nodes;
  if (!(ModuleKindNode16 <= receiver!.moduleKind && receiver!.moduleKind <= ModuleKindNodeNext) && receiver!.moduleKind !== ModuleKindESNext && receiver!.moduleKind !== ModuleKindPreserve) {
    Checker_checkGrammarForDisallowedTrailingComma(receiver, nodeArguments, Trailing_comma_not_allowed);
    if (argumentNodes.length > 1) {
      const importAttributesArgument = argumentNodes[1];
      return Checker_grammarErrorOnNode(receiver, importAttributesArgument, Dynamic_imports_only_support_a_second_argument_when_the_module_option_is_set_to_esnext_node16_node18_node20_nodenext_or_preserve);
    }
  }
  if (argumentNodes.length === 0 || argumentNodes.length > 2) {
    return Checker_grammarErrorOnNode(receiver, node, Dynamic_imports_can_only_accept_a_module_specifier_and_an_optional_set_of_attributes_as_arguments);
  }
  const spreadElement = Find(argumentNodes, IsSpreadElement);
  if (spreadElement !== undefined) {
    return Checker_grammarErrorOnNode(receiver, spreadElement, Argument_of_dynamic_import_cannot_be_spread_element);
  }
  return false;
}
