import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import * as core from "../../core/core.js";
import * as slices from "../../../go/slices.js";
import type { Number } from "../../jsnum/jsnum.js";
import type { Node, SourceFile } from "../../ast/ast.js";
import type { Expression } from "../../ast/generated/unions.js";
import type { ParameterDeclarationNode } from "../../ast/ast_generated.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import { Diagnostic_AddRelatedInfo, Diagnostic_SetRelatedInfo, DiagnosticsCollection_Add, NewDiagnostic, NewDiagnosticChain } from "../../ast/diagnostic.js";
import type { FunctionFlags } from "../../ast/functionflags.js";
import type { Symbol, SymbolTable } from "../../ast/symbol.js";
import { InternalSymbolNameIndex, InternalSymbolNameThis, SymbolName } from "../../ast/symbol.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import { A_0_parameter_must_be_the_first_parameter, A_binding_pattern_parameter_cannot_be_optional_in_an_implementation_signature, A_constructor_cannot_contain_a_super_call_when_its_class_extends_null, A_constructor_cannot_have_a_this_parameter, A_dynamic_import_call_in_ES5_requires_the_Promise_constructor_Make_sure_you_have_a_declaration_for_the_Promise_constructor_or_include_ES2015_in_your_lib_option, A_dynamic_import_call_returns_a_Promise_Make_sure_you_have_a_declaration_for_Promise_or_include_ES2015_in_your_lib_option, A_generator_cannot_have_a_void_type_annotation, A_parameter_property_is_only_allowed_in_a_constructor_implementation, A_rest_parameter_must_be_of_an_array_type, A_super_call_must_be_a_root_level_statement_within_a_constructor_of_a_derived_class_that_contains_initialized_properties_parameter_properties_or_private_identifiers, A_super_call_must_be_the_first_statement_in_the_constructor_to_refer_to_super_or_this_when_a_derived_class_contains_initialized_properties_parameter_properties_or_private_identifiers, A_this_type_is_available_only_in_a_non_static_member_of_a_class_or_interface, All_declarations_of_0_must_have_identical_type_parameters, All_declarations_of_an_abstract_method_must_be_consecutive, All_type_parameters_are_unused, An_arrow_function_cannot_have_a_this_parameter, An_async_function_or_method_in_ES5_requires_the_Promise_constructor_Make_sure_you_have_a_declaration_for_the_Promise_constructor_or_include_ES2015_in_your_lib_option, An_async_function_or_method_must_return_a_Promise_Make_sure_you_have_a_declaration_for_Promise_or_include_ES2015_in_your_lib_option, Assertions_require_every_name_in_the_call_target_to_be_declared_with_an_explicit_type_annotation, Assertions_require_the_call_target_to_be_an_identifier_or_qualified_name, Call_signature_which_lacks_return_type_annotation_implicitly_has_an_any_return_type, Class_declaration_cannot_implement_overload_list_for_0, Consider_adding_a_declare_modifier_to_this_class, Constructor_implementation_is_missing, Constructors_for_derived_classes_must_contain_a_super_call, Construct_signature_which_lacks_return_type_annotation_implicitly_has_an_any_return_type, Duplicate_function_implementation, Duplicate_identifier_0, Duplicate_index_signature_for_type_0, Function_implementation_is_missing_or_not_immediately_following_the_declaration, Function_implementation_name_must_be_0, Function_implicitly_has_return_type_any_because_it_does_not_have_a_return_type_annotation_and_is_referenced_directly_or_indirectly_in_one_of_its_return_expressions, Function_overload_must_be_static, Function_overload_must_not_be_static, Function_with_bodies_can_only_merge_with_classes_that_are_ambient, Multiple_constructor_implementations_are_not_allowed, Overload_signatures_must_all_be_abstract_or_non_abstract, Overload_signatures_must_all_be_ambient_or_non_ambient, Overload_signatures_must_all_be_exported_or_non_exported, Overload_signatures_must_all_be_optional_or_required, Overload_signatures_must_all_be_public_private_or_protected, Private_identifiers_are_not_allowed_outside_class_bodies, Required_type_parameters_may_not_follow_optional_type_parameters, Return_type_annotation_circularly_references_itself, The_implementation_signature_is_declared_here, The_return_type_of_an_async_function_must_either_be_a_valid_promise_or_must_not_contain_a_callable_then_member, The_return_type_of_an_async_function_or_method_must_be_the_global_Promise_T_type_Did_you_mean_to_write_Promise_0, This_overload_signature_is_not_compatible_with_its_implementation_signature, This_syntax_is_not_allowed_when_erasableSyntaxOnly_is_enabled, Tuple_type_arguments_circularly_reference_themselves, Type_0_does_not_satisfy_the_constraint_1, Type_0_is_not_assignable_to_type_1_as_implied_by_variance_annotation, Type_0_is_not_generic, Type_arguments_for_0_circularly_reference_themselves, Type_expected, Type_parameter_0_has_a_circular_default, Type_parameter_defaults_can_only_reference_previously_declared_type_parameters, Type_parameter_name_cannot_be_0, Variance_annotations_are_only_supported_in_type_aliases_for_object_function_constructor_and_mapped_types, X_0_index_type_1_is_not_assignable_to_2_index_type_3, X_0_is_declared_but_never_used, X_0_implicitly_has_return_type_any_because_it_does_not_have_a_return_type_annotation_and_is_referenced_directly_or_indirectly_in_one_of_its_return_expressions, X_constructor_cannot_be_used_as_a_parameter_property_name, X_get_and_set_accessors_cannot_declare_this_parameters, X_new_expression_whose_target_lacks_a_construct_signature_implicitly_has_an_any_type, The_right_hand_side_of_an_instanceof_expression_must_not_be_an_instantiation_expression } from "../../diagnostics/generated/messages.js";
import { Did_you_mean_for_0_to_be_constrained_to_type_new_args_Colon_any_1, Dynamic_import_s_specifier_must_be_of_type_string_but_here_has_type_0, Import_assertions_have_been_replaced_by_import_attributes_Use_with_instead_of_assert, Type_0_is_not_a_constructor_function_type, X_0_is_referenced_directly_or_indirectly_in_its_own_base_expression } from "../../diagnostics/generated/messages.js";
import { Are_you_missing_a_semicolon, Untyped_function_calls_may_not_accept_type_arguments, Value_of_type_0_is_not_callable_Did_you_mean_to_include_new } from "../../diagnostics/generated/messages.js";
import { The_left_hand_side_of_an_instanceof_expression_must_be_assignable_to_the_first_argument_of_the_right_hand_side_s_Symbol_hasInstance_method } from "../../diagnostics/generated/messages.js";
import { Argument_of_type_0_is_not_assignable_to_parameter_of_type_1, The_this_context_of_type_0_is_not_assignable_to_method_s_this_of_type_1 } from "../../diagnostics/generated/messages.js";
import { Constructor_of_class_0_is_private_and_only_accessible_within_the_class_declaration, Constructor_of_class_0_is_protected_and_only_accessible_within_the_class_declaration } from "../../diagnostics/generated/messages.js";
import { Checker_combineTypeMappers, TypeMapper_Map, newTypeMapper, newSimpleTypeMapper, newArrayToSingleTypeMapper, newDeferredTypeMapper } from "../mapper.js";
import type { TypeMapper } from "../mapper.js";
import type { Relation } from "../relater.js";
import { IsTypeAny, isLateBoundName, isTypeAlias, hasDotDotDotToken, isNumericLiteralName, isNodeDescendantOf, getContainingObjectLiteral, nodeStartsNewLexicalEnvironment, isSuperCall, isThisProperty, Checker_callLikeExpressionMayHaveTypeArguments, NewDiagnosticForNode, tryGetPropertyAccessOrIdentifierToString, allDeclarationsInSameSourceFile, rangeOfTypeParameters, getNonRestParameterCount, minAndMax } from "../utilities.js";
import { AccessFlagsContextual, ContextFlagsNone, ContextFlagsNoConstraints, ContextFlagsSignature, ElementFlagsOptional, ElementFlagsRequired, ElementFlagsRest, ElementFlagsVariadic, ElementFlagsVariable, InterfaceType_LocalTypeParameters, InterfaceType_OuterTypeParameters, InterfaceType_TypeParameters, ObjectFlagsAnonymous, ObjectFlagsClassOrInterface, ObjectFlagsInstantiated, ObjectFlagsInterface, ObjectFlagsMapped, ObjectFlagsMembersResolved, ObjectFlagsNone, ObjectFlagsObjectRestType, ObjectFlagsReference, ObjectFlagsSingleSignatureType, SignatureFlagsAbstract, SignatureFlagsConstruct, SignatureFlagsHasLiteralTypes, SignatureFlagsHasRestParameter, SignatureFlagsIsSignatureCandidateForOverloadFailure, SignatureFlagsNone, SignatureFlagsPropagatingFlags, SignatureFlagsCallChainFlags, SignatureFlagsIsInnerCallChain, SignatureFlagsIsOuterCallChain, SignatureFlagsIsUntypedSignatureInJSFile, SignatureKindCall, SignatureKindConstruct, Signature_Declaration, StructuredType_CallSignatures, StructuredType_ConstructSignatures, TernaryFalse, TypeFlagsAny, TypeFlagsAnyOrUnknown, TypeFlagsBoolean, TypeFlagsIndex, TypeFlagsInstantiableNonPrimitive, TypeFlagsIntersection, TypeFlagsNever, TypeFlagsNullable, TypeFlagsObject, TypeFlagsPrimitive, TypeFlagsString, TypeFlagsStringLiteral, TypeFlagsStringMapping, TypeFlagsStringOrNumberLiteralOrUnique, TypeFlagsStructuredType, TypeFlagsTemplateLiteral, TypeFlagsTypeParameter, TypeFlagsTypeVariable, TypeFlagsUndefined, TypeFlagsUnion, TypeFlagsUnionOrIntersection, TypeFlagsVoid, TypePredicateKindIdentifier, Type_AsInterfaceType, Type_AsIntersectionType, Type_AsMappedType, Type_AsObjectType, Type_AsTypeParameter, Type_AsTypeReference, Type_Distributed, Type_Mapper, Type_Target, Type_TargetInterfaceType, Type_TargetTupleType, Type_Types } from "../types.js";
import { ContextFlagsSkipBindingPatterns } from "../types.js";
import { TypeFlagsESSymbolLike } from "../types.js";
import type { ConstrainedType, ContextFlags, DeclaredTypeLinks, IndexInfo, ObjectFlags, Signature, SignatureFlags, SignatureKind, SignatureLinks, SymbolReferenceLinks, TupleElementInfo, Type, TypeAliasLinks, TypeComparer, TypeData, TypeFlags, TypeParameter, TypePredicate, TypeReference, ValueSymbolLinks } from "../types.js";
import { CheckModeInferential, CheckModeNormal, CheckModeSkipContextSensitive, CheckModeSkipGenericFunctions, InferenceFlagsAnyDefault, InferenceFlagsNone, InferenceFlagsNoDefault, InferenceFlagsSkippedGenericFunction, InferencePriorityNone, InferencePriorityReturnType, hasRestParameter, isInstancePropertyWithInitializerOrPrivateIdentifierProperty, isRestParameter, isSpreadArgument, isTupleType, signatureHasRestParameter, signatureHasLiteralTypes, acceptsVoid, thisAssignmentDeclarationNone, thisAssignmentDeclarationTyped, thisAssignmentDeclarationConstructor, thisAssignmentDeclarationMethod, isIdentifierThatStartsWithUnderscore, getStringLiteralValue, isUnitType, hasTypeParameterByName, getUniqueTypeParameterName, SignatureKeyErased, SignatureKeyCanonical, SignatureKeyBase, SignatureKeyInner, SignatureKeyOuter, getTypeListKey, isLateBindableAST, nodeImmediatelyReferencesSuperOrThis, superCallIsRootLevelInConstructor, TypeSystemPropertyNameType, TypeSystemPropertyNameResolvedReturnType, TypeSystemPropertyNameResolvedTypeArguments, UnionReductionLiteral, UnionReductionSubtype, IterationTypeKindYield, IterationTypeKindNext, IterationUseSpread, IterationUseGeneratorReturnType, IterationUseAsyncGeneratorReturnType, UnusedKindParameter, CachedTypeKindRestrictiveTypeParameter, getThisParameterFromNodeContext, getTargetType, someType, importClauseFromImported, WideningKindFunctionReturn, WideningKindGeneratorNext, WideningKindGeneratorYield } from "./state.js";
import { CheckModeIsForSignatureHelp } from "./state.js";
import { getBaseTypeNodeOfClass, TypeSystemPropertyNameResolvedBaseConstructorType } from "./state.js";
import type { CachedSignatureKey, CachedTypeKey, CallState, Checker, CheckMode, InferenceContext, InferenceInfo, InferencePriority, IterationTypeKind, IterationTypes, IterationUse, thisAssignmentDeclarationKind } from "./state.js";
import { GetThisParameter, GetNameOfDeclaration, GetSourceFileOfNode, GetClassLikeDeclarationOfSymbol, IsFunctionExpressionOrArrowFunction, IsFunctionLikeDeclaration, IsObjectLiteralMethod, IsInJSFile, IsJsonSourceFile, NodeKindIs, IsAccessExpression, IsAccessor, IsFunctionLike, IsOptionalChain, IsOptionalChainRoot, FindAncestorOrQuit, FindAncestorTrue, FindAncestorQuit, FindAncestorFalse, IsCallOrNewExpression, GetThisContainer, GetContainingClass, GetContainingFunction, GetExtendsHeritageClauseElement, IsThisParameter, HasAccessorModifier, HasSyntacticModifier, HasModifier, IsBindingPattern, SkipOuterExpressions, OEKAll, GetAssignmentDeclarationKind, JSDeclarationKindThisProperty, IsStringOrNumericLiteralLike, IsMethodOrAccessor, GetDeclarationOfKind, IsClassLike, IsStatic, GetRestParameterElementType, HasStaticModifier, IsPartOfTypeNode, WalkUpBindingElementsAndPatterns, SkipParentheses, IsEntityNameExpression, GetImmediatelyInvokedFunctionExpression, IsImportCall, IsAssignmentTarget, IsJsxOpeningLikeElement, IsJsxCallLike, IsSuperProperty, IsUnterminatedLiteral, NodeIsMissing, NodeIsPresent, GetReparsedNodeForNode, IsPropertyNameLiteral, GetRootDeclaration, IsAmbientModule, WalkUpParenthesizedExpressions, IsAssignmentExpression, GetFirstIdentifier, IsThisIdentifier } from "../../ast/utilities.js";
import { IsDottedName, IsOutermostOptionalChain } from "../../ast/utilities.js";
import type { FindAncestorResult } from "../../ast/utilities.js";
import { IsGetAccessorDeclaration, IsTypeParameterDeclaration, IsParenthesizedExpression, IsCallExpression, IsTaggedTemplateExpression, IsDecorator, IsIdentifier, IsObjectLiteralExpression, IsPropertyAssignment, IsPropertyAccessExpression, IsBinaryExpression, IsParameterDeclaration, IsBindingElement, IsConstructorDeclaration, IsConstructSignatureDeclaration, IsConstructorTypeNode, IsExpressionStatement, IsFunctionDeclaration, IsMethodDeclaration, IsMethodSignatureDeclaration, IsArrowFunction, IsFunctionExpression, IsInterfaceDeclaration, IsClassDeclaration, IsVariableDeclaration, IsSetAccessorDeclaration, IsComputedPropertyName, IsPropertyDeclaration, IsSpreadElement, IsSyntheticExpression, IsTemplateExpression, IsJsxOpeningFragment, IsJsxOpeningElement, IsPrivateIdentifier, IsIndexSignatureDeclaration, IsTypeReferenceNode, IsReturnStatement, IsTypeLiteralNode, IsImportClause, IsImportSpecifier, IsNamespaceImport, IsVariableDeclarationList, IsSourceFile, IsBlock, IsConditionalTypeNode, IsExpressionWithTypeArguments, IsInferTypeNode, IsParenthesizedTypeNode, IsRestTypeNode, IsNamedTupleMember, IsTemplateLiteralTypeSpan, IsMappedTypeNode, IsOmittedExpression } from "../../ast/generated/predicates.js";
import { IsNewExpression } from "../../ast/generated/predicates.js";
import { SymbolFlagsTypeParameter, SymbolFlagsTypeAlias, NodeFlagsJSDoc, NodeFlagsAmbient, NodeFlagsReparsed, SymbolFlagsClass, SymbolFlagsConstructor, SymbolFlagsFunction, SymbolFlagsProperty, SymbolFlagsFunctionScopedVariable, SymbolFlagsOptional, SymbolFlagsEnum, SymbolFlagsValue, SymbolFlagsVariable, SymbolFlagsModuleExports, SymbolFlagsPrototype, SymbolFlagsNone, SymbolFlagsReplaceableByMethod, NodeFlagsNone } from "../../ast/generated/flags.js";
import type { SymbolFlags } from "../../ast/generated/flags.js";
import { KindUnknown, KindInterfaceDeclaration, KindClassDeclaration, KindClassExpression, KindPropertyDeclaration, KindMethodDeclaration, KindGetAccessor, KindSetAccessor, KindParameter, KindElementAccessExpression, KindIndexSignature, KindCallSignature, KindConstructSignature, KindMethodSignature, KindFunctionType, KindConstructorType, KindFunctionDeclaration, KindFunctionExpression, KindArrowFunction, KindTypeAliasDeclaration, KindJSTypeAliasDeclaration, KindMappedType, KindConditionalType, KindAnyKeyword, KindPropertyAssignment, KindThisKeyword, KindIdentifier, KindPropertyAccessExpression, KindPrefixUnaryExpression, KindMinusToken, KindBigIntLiteral, KindTrueKeyword, KindFalseKeyword, KindArrayLiteralExpression, KindObjectLiteralExpression, KindTemplateExpression, KindPlusToken, KindNoSubstitutionTemplateLiteral, KindStringLiteral, KindNumericLiteral, KindLiteralType, KindParenthesizedExpression, KindTypeReference, KindArrayType, KindTupleType, KindCallExpression, KindNewExpression, KindTaggedTemplateExpression, KindDecorator, KindJsxOpeningFragment, KindJsxOpeningElement, KindJsxSelfClosingElement, KindBinaryExpression, KindConstructor, KindThisType, KindTypeQuery, KindInstanceOfKeyword, KindBindingElement, KindVariableDeclaration, KindPropertySignature, KindExportAssignment, KindJsxAttribute, KindEnumMember, KindShorthandPropertyAssignment } from "../../ast/generated/kinds.js";
import { KindSuperKeyword } from "../../ast/generated/kinds.js";
import { GetFunctionFlags, FunctionFlagsAsync, FunctionFlagsAsyncGenerator, FunctionFlagsGenerator, FunctionFlagsInvalid } from "../../ast/functionflags.js";
import { IsNumericLiteral } from "../../ast/generated/predicates.js";
import { AsArrayTypeNode, AsBinaryExpression, AsConditionalTypeNode, AsConstructorDeclaration, AsElementAccessExpression, AsIndexSignatureDeclaration, AsInferTypeNode, AsMappedTypeNode, AsNamedTupleMember, AsNewExpression, AsParameterDeclaration, AsPrefixUnaryExpression, AsSyntheticExpression, AsTaggedTemplateExpression, AsTemplateExpression, AsTemplateSpan, AsTypeParameterDeclaration, AsTypeQueryNode, AsTypeReferenceNode, AsExpressionWithTypeArguments } from "../../ast/generated/casts.js";
import { Node_End, Node_FlowNodeData, Node_ForEachChild, Node_FunctionLikeData, Node_Name, Node_Pos, NodeList_End, NodeList_HasTrailingComma } from "../../ast/spine.js";
import { NewElementAccessExpression, NewFunctionTypeNode, NewKeywordExpression, NewKeywordTypeNode, NewPropertyAccessExpression } from "../../ast/generated/factory.js";
import { AsSourceFile, IsTypeOrJSTypeAliasDeclaration, Node_ArgumentList, Node_Arguments, Node_Attributes, Node_Body, Node_Children, Node_Elements, Node_Expression, Node_Initializer, Node_Locals, Node_Members, Node_Parameters, Node_Properties, Node_QuestionToken, Node_Statements, Node_Symbol, Node_Text, Node_Type, Node_TypeArguments, Node_TypeParameterList, Node_TypeParameters } from "../../ast/ast.js";
import { Node_QuestionDotToken, Node_TypeArgumentList, SourceFile_Text } from "../../ast/ast.js";
import { CheckFlagsIndexSymbol, CheckFlagsLate, CheckFlagsNone, CheckFlagsOptionalParameter, CheckFlagsRestParameter, CheckFlagsDeferredType } from "../../ast/checkflags.js";
import type { LinkStore } from "../../core/linkstore.js";
import { LinkStore_Get } from "../../core/linkstore.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import { Arena_New } from "../../core/arena.js";
import { Checker_checkComputedPropertyName, Checker_checkDeclarationInitializer, Checker_checkPropertyDeclaration, Checker_checkTypeNameIsReserved, Checker_checkVariableLikeDeclaration, Checker_classDeclarationExtendsNull, Checker_cloneSymbol, Checker_createCombinedSymbolFromTypes, Checker_createSymbolWithType, Checker_getAliasForTypeNode, Checker_getAwaitedTypeNoAlias, Checker_getClassElementPropertyKeyType, Checker_getClassOrInterfaceDeclarationsOfSymbol, Checker_getDeclarationOfAliasSymbol, Checker_getDeclaredTypeOfSymbol, Checker_getEffectiveDeclarationFlags, Checker_getIndexInfoOfType, Checker_getIndexInfosOfType, Checker_getIndexSymbol, Checker_getIndexTypeOfType, Checker_getLiteralTypeFromProperty, Checker_getLiteralTypeFromPropertyName, Checker_getMembersOfSymbol, Checker_getMergedSymbol, Checker_getParentOfSymbol, Checker_getPropertyOfObjectType, Checker_getPropertyOfType, Checker_getResolvedSymbol, Checker_getResolvedSymbolOrNil, Checker_getSymbolFromTypeReference, Checker_getSymbolOfDeclaration, Checker_getSymbolOfNode, Checker_getTypeOfPrototypeProperty, Checker_getTypeOfPropertyOfType, Checker_getTypeOfSymbol, Checker_getTypeOfEnumMember, Checker_getTypeWithSyntheticDefaultImportType, Checker_getUniqAssociatedNamesFromTupleType, Checker_getWidenedTypeForVariableLikeDeclaration, Checker_widenTypeForVariableLikeDeclaration, Checker_hasBindableName, Checker_instantiateSymbol, Checker_instantiateSymbols, Checker_isArrayOrTupleSymbol, Checker_isAutoTypedProperty, Checker_isGenericIndexType, Checker_isReadonlyArraySymbol, Checker_isSpreadableProperty, Checker_getSpreadSymbol, Checker_newIndexInfo, Checker_newSymbol, Checker_newSymbolEx, Checker_newClassMemberDecoratorContextTypeForNode, Checker_newTypedPropertyDescriptorType, Checker_registerForUnusedIdentifiersCheck, Checker_reportUnusedImports, Checker_reportUnusedLocal, Checker_reportUnusedVariableDeclarations, Checker_resolveEntityName, Checker_resolveExternalModuleName, Checker_resolveExternalModuleSymbol, Checker_resolveStructuredTypeMembers, Checker_getIndexedAccessTypeEx, Checker_setStructuredTypeMembers } from "./symbols.js";
import { Checker_getESSymbolLikeTypeForNode } from "./symbols.js";
import { Checker_isNodeWithinClass } from "./classes.js";
import { Checker_GetNonNullableType, Checker_GetPromisedTypeOfPromise, Checker_addOptionalTypeMarker, Checker_assignBindingElementTypes, Checker_checkAndAggregateReturnExpressionTypes, Checker_checkAndAggregateYieldOperandTypes, Checker_checkAwaitedType, Checker_checkExpressionWithContextualType, Checker_checkIteratedTypeOrElementType, Checker_checkObjectLiteralMethod, Checker_combineUnionOrIntersectionThisParam, Checker_containsUndefinedType, Checker_createArrayType, Checker_createArrayTypeEx, Checker_createGeneratorType, Checker_createPromiseType, Checker_createTupleTypeEx, Checker_createTypeReference, Checker_filterType, Checker_getAnnotatedAccessorType, Checker_getApparentType, Checker_getApparentTypeOfContextualType, Checker_getArrayElementTypeNode, Checker_getAwaitedTypeOfPromise, Checker_getBaseTypes, Checker_getContextualIterationType, Checker_getContextualType, Checker_getContextualTypeForElementExpression, Checker_getDeclaredTypeOfClassOrInterface, Checker_getElementTypeOfArrayType, Checker_getElementTypeOfSliceOfTupleType, Checker_getElementTypes, Checker_getIntersectionType, Checker_getIterationTypesOfIterable, Checker_getIterationTypesOfIterator, Checker_getMutableArrayOrTupleType, Checker_getNullableType, Checker_getNumberLiteralType, Checker_getOptionalExpressionType, Checker_getOptionalType, Checker_getParentTypeOfClassElement, Checker_getPropertiesOfType, Checker_getReducedApparentType, Checker_getReducedType, Checker_getRegularTypeOfLiteralType, Checker_getRegularTypeOfObjectLiteral, Checker_getStringLiteralType, Checker_getTypeFromBindingPattern, Checker_getTypeFromTypeNode, Checker_getTypeFromTypeReference, Checker_getTypeOfExpression, Checker_getTypeOfNode, Checker_getTypeWithSyntheticDefaultOnly, Checker_getUnionOrIntersectionType, Checker_getUnionType, Checker_getUnionTypeEx, Checker_getWidenedLiteralLikeTypeForContextualIterationTypeIfNeeded, Checker_getWidenedLiteralLikeTypeForContextualType, Checker_getWidenedLiteralType, Checker_instantiateContextualType, Checker_instantiateType, Checker_instantiateTypes, Checker_isArrayLikeType, Checker_isConstTypeVariable, Checker_isGenericMappedType, Checker_isGenericObjectType, Checker_isMutableArrayLikeType, Checker_isReferenceToType, Checker_mapType, Checker_maybeTypeOfKind, Checker_newAnonymousType, Checker_newClassAccessorDecoratorResultType, Checker_newClassAccessorDecoratorTargetType, Checker_newClassDecoratorContextType, Checker_newClassFieldDecoratorInitializerMutatorType, Checker_newGetterFunctionType, Checker_newObjectType, Checker_newSetterFunctionType, Checker_newType, Checker_popTypeResolution, Checker_propagateOptionalTypeMarker, Checker_pushTypeResolution, Checker_removeOptionalTypeMarker, Checker_resolveTaggedTemplateExpression, Checker_typeHasProtectedAccessibleBase, Checker_unwrapAwaitedType, Checker_isContextSensitiveFunctionOrObjectLiteralMethod, Checker_getWidenedType, IterationTypes_getType, IterationTypes_hasTypes } from "./types.js";
import { Checker_resolveExternalModuleTypeByLiteral } from "./types.js";
import { Checker_IsArgumentsSymbol } from "../services.js";
import { Checker_checkExpression, Checker_checkExpressionCached, Checker_checkExpressionCachedEx, Checker_checkNodeDeferred, Checker_checkSuperExpression, Checker_createSyntheticExpression, Checker_getEffectiveCheckNode, Checker_maybeAddMissingAwaitInfo, Checker_resolveInstanceofExpression, Checker_resolveNewExpression, Checker_reportUnusedVariables, Checker_checkThisExpression, Checker_skippedGenericFunction } from "./syntax-checking.js";
import { Checker_isGenericFunctionReturningFunction } from "./syntax-checking.js";
import { Checker_addOptionalityEx, Checker_isCommonJSRequire, Checker_isConstContext, Checker_isContextSensitive } from "./support-queries.js";
import { Checker_checkTypeAssignableTo, Checker_checkTypeAssignableToEx, Checker_checkTypeRelatedToAndOptionallyElaborate, Checker_checkTypeRelatedToEx, Checker_compareSignaturesIdentical, Checker_compareTypeParametersIdentical, Checker_compareTypesIdentical, Checker_createMarkerType, Checker_findMatchingSignature, Checker_findMatchingSignatures, Checker_getEffectiveRestType, Checker_getMinArgumentCount, Checker_getNonArrayRestType, Checker_getParameterCount, Checker_getParameterNameAtPosition, Checker_getRestTypeAtPosition, Checker_getTypeAtPosition, Checker_getTypeParameterModifiers, Checker_hasEffectiveRestParameter, Checker_isResolvingReturnTypeOfSignature, Checker_isSignatureAssignableTo, Checker_isTypeAssignableTo, Checker_isTypeIdenticalTo, Checker_isTypeRelatedTo, Checker_newTypePredicate, Checker_tryGetTypeAtPosition, Checker_getThisTypeOfSignature } from "../relater.js";
import { Checker_getTypePredicateOfSignature } from "../relater.js";
import { Checker_checkPropertyAssignment, Checker_checkShorthandPropertyAssignment, Checker_getWidenedTypeForAssignmentDeclaration } from "./relations.js";
import { Checker_getEffectsSignature, Checker_getFlowTypeOfReference, Checker_getFlowTypeOfReferenceEx, Checker_getTypeOfDottedName, Checker_isSymbolAssigned, getFlowNodeOfNode } from "../flow.js";
import { FlowFlagsFalseCondition, FlowFlagsStart, FlowFlagsTrueCondition } from "../../ast/flow.js";
import type { FlowNode } from "../../ast/flow.js";
import { Checker_getBaseConstraintOfType, Checker_getConstraintDeclaration, Checker_getTypeAliasInstantiation, Checker_hasNonCircularBaseConstraint, Checker_getInferenceContext, Checker_getInstantiationExpressionType, Checker_widenTypeInferredFromInitializer } from "./inference.js";
import { Checker_applyToParameterTypes, Checker_applyToReturnTypes, Checker_cloneInferenceContext, Checker_cloneInferredPartOfContext, Checker_createOuterReturnMapper, Checker_getInferredTypes, Checker_inferTypes, Checker_newInferenceContext, Checker_getMapperFromContext, newInferenceInfo, hasInferenceCandidates, hasOverlappingInferences, Checker_mergeInferences } from "../inference.js";
import { Checker_checkSourceElement, Checker_checkSourceElements, Checker_error, Checker_reportUnused, Checker_shouldCheckErasableSyntax } from "./support.js";
import { Checker_checkDeprecatedSignature, Checker_checkNonNullTypeWithReporter, Checker_invocationError, Checker_isErrorType, Checker_reportCannotInvokePossiblyNullOrUndefinedError, Checker_reportCircularityError, Checker_reportErrorsFromWidening, Checker_resolveErrorCall } from "./diagnostics.js";
import { Checker_reportCallResolutionErrors } from "./diagnostics.js";
import { instantiateList, IterationTypeKindReturn } from "./state.js";
import { getDeclarationModifierFlagsFromSymbol, getSelectedModifierFlags, isOptionalDeclaration } from "../utilities.js";
import { Checker_checkGrammarConstructorTypeAnnotation, Checker_checkGrammarConstructorTypeParameters, Checker_checkGrammarFunctionLikeDeclaration, Checker_checkGrammarIndexSignature, Checker_checkGrammarModifiers, Checker_grammarErrorOnFirstToken, Checker_checkGrammarExpressionWithTypeArguments } from "../grammarchecks.js";
import { Checker_checkGrammarImportCallExpression, Checker_checkGrammarTypeArguments } from "../grammarchecks.js";
import { DeclarationNameToString } from "../../scanner/utilities.js";
import { SkipTriviaEx } from "../../scanner/scanner.js";
import type { SkipTriviaOptions } from "../../scanner/scanner.js";
import { Checker_symbolToString, Checker_TypeToString } from "../printer.js";
import { IsLineBreak } from "../../stringutil/util.js";
import { Checker_resolveDecorator } from "./jsx-jsdoc-decorators.js";
import { Checker_checkApplicableSignatureForJsxCallLikeElement, Checker_checkJsxAttribute, Checker_getEffectiveFirstArgumentForJsxSignature, Checker_inferJsxTypeArguments, Checker_resolveJsxOpeningLikeElement } from "../jsx.js";
import { ModifierFlagsAbstract, ModifierFlagsAmbient, ModifierFlagsExport, ModifierFlagsIn, ModifierFlagsOut, ModifierFlagsParameterPropertyModifier, ModifierFlagsPrivate, ModifierFlagsProtected, ModifierFlagsNonPublicAccessibilityModifier } from "../../ast/modifierflags.js";
import { PhaseCheckTypes } from "../../tracing/tracing.js";
import { Tracer_Push } from "../tracer.js";
import { Checker_checkUnmatchedJSDocParameters } from "../jsdoc.js";
import { NewTextRange } from "../../core/text.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.GetTypeAliasTypeParameters","kind":"method","status":"implemented","sigHash":"0b4f54cda41fb6e460b50792c13ecf63a5a90b07e65ca4c27484c2ebd3b2b5d9","bodyHash":"02fa6e6ef34ba705f2d33b3f81000aaa91ecff0d2cb63d373a5a89e9c30a511d"}
 *
 * Go source:
 * func (c *Checker) GetTypeAliasTypeParameters(symbol *ast.Symbol) []*Type {
 * 	if symbol.Flags&ast.SymbolFlagsTypeAlias == 0 {
 * 		panic("Attempted to fetch type alias parameters for non-type-alias symbol")
 * 	}
 * 	c.getDeclaredTypeOfSymbol(symbol)
 * 	return c.typeAliasLinks.Get(symbol).typeParameters
 * }
 */
export function Checker_GetTypeAliasTypeParameters(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Type>> {
  if ((symbol_!.Flags & SymbolFlagsTypeAlias) === 0) {
    throw new globalThis.Error("Attempted to fetch type alias parameters for non-type-alias symbol");
  }
  Checker_getDeclaredTypeOfSymbol(receiver, symbol_);
  return (LinkStore_Get(receiver!.typeAliasLinks, symbol_) as GoPtr<TypeAliasLinks>)!.typeParameters;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTypeParameter","kind":"method","status":"implemented","sigHash":"524f6a368c829b48b95b04c38b139953ecebf792da7193fae57f76c74e3fae3e","bodyHash":"e50e8b788b391ce49332f4b48c4915833d80b4ac7c8d450f96e9bebb89558de3"}
 *
 * Go source:
 * func (c *Checker) checkTypeParameter(node *ast.Node) {
 * 	// Grammar Checking
 * 	c.checkGrammarModifiers(node)
 * 	if expr := node.AsTypeParameterDeclaration().Expression; expr != nil {
 * 		c.grammarErrorOnFirstToken(expr, diagnostics.Type_expected)
 * 	}
 * 	tpNode := node.AsTypeParameterDeclaration()
 * 	c.checkSourceElement(tpNode.Constraint)
 * 	c.checkSourceElement(tpNode.DefaultType)
 * 	typeParameter := c.getDeclaredTypeOfTypeParameter(c.getSymbolOfDeclaration(node))
 * 	// Resolve base constraint to reveal circularity errors
 * 	c.getBaseConstraintOfType(typeParameter)
 * 	if c.getResolvedTypeParameterDefault(typeParameter) == c.circularConstraintType {
 * 		c.error(tpNode.DefaultType, diagnostics.Type_parameter_0_has_a_circular_default, c.TypeToString(typeParameter))
 * 	}
 * 	constraintType := c.getConstraintOfTypeParameter(typeParameter)
 * 	defaultType := c.getDefaultFromTypeParameter(typeParameter)
 * 	if constraintType != nil && defaultType != nil {
 * 		c.checkTypeAssignableTo(defaultType, c.getTypeWithThisArgument(c.instantiateType(constraintType, newSimpleTypeMapper(typeParameter, defaultType)), defaultType, false), tpNode.DefaultType, diagnostics.Type_0_does_not_satisfy_the_constraint_1)
 * 	}
 * 	c.checkTypeNameIsReserved(node.Name(), diagnostics.Type_parameter_name_cannot_be_0)
 * 	c.checkNodeDeferred(node)
 * }
 */
export function Checker_checkTypeParameter(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  Checker_checkGrammarModifiers(receiver, node);
  const expression = AsTypeParameterDeclaration(node)!.Expression;
  if (expression !== undefined) {
    Checker_grammarErrorOnFirstToken(receiver, expression, Type_expected);
  }
  const typeParameterNode = AsTypeParameterDeclaration(node)!;
  Checker_checkSourceElement(receiver, typeParameterNode.Constraint);
  Checker_checkSourceElement(receiver, typeParameterNode.DefaultType);
  const typeParameter = Checker_getDeclaredTypeOfTypeParameter(receiver, Checker_getSymbolOfDeclaration(receiver, node));
  Checker_getBaseConstraintOfType(receiver, typeParameter);
  if (Checker_getResolvedTypeParameterDefault(receiver, typeParameter) === receiver!.circularConstraintType) {
    Checker_error(receiver, typeParameterNode.DefaultType, Type_parameter_0_has_a_circular_default, Checker_TypeToString(receiver, typeParameter));
  }
  const constraintType = Checker_getConstraintOfTypeParameter(receiver, typeParameter);
  const defaultType = Checker_getDefaultFromTypeParameter(receiver, typeParameter);
  if (constraintType !== undefined && defaultType !== undefined) {
    Checker_checkTypeAssignableTo(
      receiver,
      defaultType,
      Checker_getTypeWithThisArgument(receiver, Checker_instantiateType(receiver, constraintType, newSimpleTypeMapper(typeParameter, defaultType)), defaultType, false),
      typeParameterNode.DefaultType,
      Type_0_does_not_satisfy_the_constraint_1,
    );
  }
  Checker_checkTypeNameIsReserved(receiver, Node_Name(node), Type_parameter_name_cannot_be_0);
  Checker_checkNodeDeferred(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTypeParameterDeferred","kind":"method","status":"implemented","sigHash":"b3bcbc71da94c565b8c0e264a97f8d1688c649e5898dba9ee12f6ee1f8c07d93","bodyHash":"e5eefb9b481b945add35fcd466bdb9884e78bea99242426c379b88055856f285"}
 *
 * Go source:
 * func (c *Checker) checkTypeParameterDeferred(node *ast.Node) {
 * 	if ast.IsInterfaceDeclaration(node.Parent) || ast.IsClassLike(node.Parent) || ast.IsTypeOrJSTypeAliasDeclaration(node.Parent) {
 * 		typeParameter := c.getDeclaredTypeOfTypeParameter(c.getSymbolOfDeclaration(node))
 * 		modifiers := c.getTypeParameterModifiers(typeParameter) & (ast.ModifierFlagsIn | ast.ModifierFlagsOut)
 * 		if modifiers != 0 {
 * 			symbol := c.getSymbolOfDeclaration(node.Parent)
 * 			if ast.IsTypeOrJSTypeAliasDeclaration(node.Parent) && c.getDeclaredTypeOfSymbol(symbol).objectFlags&(ObjectFlagsAnonymous|ObjectFlagsMapped) == 0 {
 * 				c.error(node, diagnostics.Variance_annotations_are_only_supported_in_type_aliases_for_object_function_constructor_and_mapped_types)
 * 			} else if modifiers == ast.ModifierFlagsIn || modifiers == ast.ModifierFlagsOut {
 * 				if tr := c.tracer; tr != nil {
 * 					defer tr.Push(tracing.PhaseCheckTypes, "checkTypeParameterDeferred", map[string]any{"parent": c.getDeclaredTypeOfSymbol(symbol).id, "id": typeParameter.id}, false)()
 * 				}
 * 				source := c.createMarkerType(symbol, typeParameter, core.IfElse(modifiers == ast.ModifierFlagsOut, c.markerSubTypeForCheck, c.markerSuperTypeForCheck))
 * 				target := c.createMarkerType(symbol, typeParameter, core.IfElse(modifiers == ast.ModifierFlagsOut, c.markerSuperTypeForCheck, c.markerSubTypeForCheck))
 * 				saveVarianceTypeParameter := typeParameter
 * 				c.varianceTypeParameter = typeParameter
 * 				c.checkTypeAssignableTo(source, target, node, diagnostics.Type_0_is_not_assignable_to_type_1_as_implied_by_variance_annotation)
 * 				c.varianceTypeParameter = saveVarianceTypeParameter
 * 			}
 * 		}
 * 	}
 * }
 */
export function Checker_checkTypeParameterDeferred(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  if (IsInterfaceDeclaration(node!.Parent) || IsClassLike(node!.Parent) || IsTypeOrJSTypeAliasDeclaration(node!.Parent)) {
    const typeParameter = Checker_getDeclaredTypeOfTypeParameter(receiver, Checker_getSymbolOfDeclaration(receiver, node));
    const modifiers = (Checker_getTypeParameterModifiers(receiver, typeParameter) & (ModifierFlagsIn | ModifierFlagsOut)) as int;
    if (modifiers !== 0) {
      const symbol_ = Checker_getSymbolOfDeclaration(receiver, node!.Parent);
      if (IsTypeOrJSTypeAliasDeclaration(node!.Parent) && (Checker_getDeclaredTypeOfSymbol(receiver, symbol_)!.objectFlags & (ObjectFlagsAnonymous | ObjectFlagsMapped)) === 0) {
        Checker_error(receiver, node, Variance_annotations_are_only_supported_in_type_aliases_for_object_function_constructor_and_mapped_types);
      } else if (modifiers === ModifierFlagsIn || modifiers === ModifierFlagsOut) {
        const popTrace = receiver!.tracer !== undefined
          ? Tracer_Push(receiver!.tracer, PhaseCheckTypes, "checkTypeParameterDeferred", new globalThis.Map<string, unknown>([["parent", Checker_getDeclaredTypeOfSymbol(receiver, symbol_)!.id], ["id", typeParameter!.id]]), false)
          : undefined;
        try {
          const source = Checker_createMarkerType(receiver, symbol_, typeParameter, core.IfElse(modifiers === ModifierFlagsOut, receiver!.markerSubTypeForCheck, receiver!.markerSuperTypeForCheck));
          const target = Checker_createMarkerType(receiver, symbol_, typeParameter, core.IfElse(modifiers === ModifierFlagsOut, receiver!.markerSuperTypeForCheck, receiver!.markerSubTypeForCheck));
          const saveVarianceTypeParameter = receiver!.varianceTypeParameter;
          receiver!.varianceTypeParameter = typeParameter;
          Checker_checkTypeAssignableTo(receiver, source, target, node, Type_0_is_not_assignable_to_type_1_as_implied_by_variance_annotation);
          receiver!.varianceTypeParameter = saveVarianceTypeParameter;
        } finally {
          if (popTrace !== undefined) {
            popTrace();
          }
        }
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkParameter","kind":"method","status":"implemented","sigHash":"ec485e18152549b84e14fd75537f34082f0e0977872c1234da46ae067b4147bf","bodyHash":"b3994ac2f318971ee2bc3d16386bfdcac2bb5e832f1bf57f49da87dba04a9993"}
 *
 * Go source:
 * func (c *Checker) checkParameter(node *ast.Node) {
 * 	// Grammar checking
 * 	// It is a SyntaxError if the Identifier "eval" or the Identifier "arguments" occurs as the
 * 	// Identifier in a PropertySetParameterList of a PropertyAssignment that is contained in strict code
 * 	// or if its FunctionBody is strict code(11.1.5).
 * 	c.checkGrammarModifiers(node)
 * 	c.checkVariableLikeDeclaration(node)
 * 	fn := ast.GetContainingFunction(node)
 * 	var paramName string
 * 	if node.Name() != nil && ast.IsIdentifier(node.Name()) {
 * 		paramName = node.Name().Text()
 * 	}
 * 	if ast.HasSyntacticModifier(node, ast.ModifierFlagsParameterPropertyModifier) {
 * 		if c.shouldCheckErasableSyntax(node) {
 * 			c.error(node, diagnostics.This_syntax_is_not_allowed_when_erasableSyntaxOnly_is_enabled)
 * 		}
 * 		if !(ast.IsConstructorDeclaration(fn) && ast.NodeIsPresent(fn.Body())) {
 * 			c.error(node, diagnostics.A_parameter_property_is_only_allowed_in_a_constructor_implementation)
 * 		}
 * 		if ast.IsConstructorDeclaration(fn) && paramName == "constructor" {
 * 			c.error(node.Name(), diagnostics.X_constructor_cannot_be_used_as_a_parameter_property_name)
 * 		}
 * 	}
 * 	if node.Initializer() == nil && isOptionalDeclaration(node) && ast.IsBindingPattern(node.Name()) && fn.Body() != nil {
 * 		c.error(node, diagnostics.A_binding_pattern_parameter_cannot_be_optional_in_an_implementation_signature)
 * 	}
 * 	if paramName == "this" || paramName == "new" {
 * 		if slices.Index(fn.Parameters(), node) != 0 {
 * 			c.error(node, diagnostics.A_0_parameter_must_be_the_first_parameter, paramName)
 * 		}
 * 		if ast.IsConstructorDeclaration(fn) || ast.IsConstructSignatureDeclaration(fn) || ast.IsConstructorTypeNode(fn) {
 * 			c.error(node, diagnostics.A_constructor_cannot_have_a_this_parameter)
 * 		}
 * 		if ast.IsArrowFunction(fn) {
 * 			c.error(node, diagnostics.An_arrow_function_cannot_have_a_this_parameter)
 * 		}
 * 		if ast.IsAccessor(fn) {
 * 			c.error(node, diagnostics.X_get_and_set_accessors_cannot_declare_this_parameters)
 * 		}
 * 	}
 * 	// Only check rest parameter type if it's not a binding pattern. Since binding patterns are
 * 	// not allowed in a rest parameter, we already have an error from checkGrammarParameterList.
 * 	if hasDotDotDotToken(node) && !ast.IsBindingPattern(node.Name()) && !c.isTypeAssignableTo(c.getReducedType(c.getTypeOfSymbol(node.Symbol())), c.anyReadonlyArrayType) {
 * 		c.error(node, diagnostics.A_rest_parameter_must_be_of_an_array_type)
 * 	}
 * }
 */
export function Checker_checkParameter(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  Checker_checkGrammarModifiers(receiver, node);
  Checker_checkVariableLikeDeclaration(receiver, node);
  const fn = GetContainingFunction(node);
  let paramName = "";
  const name = Node_Name(node);
  if (name !== undefined && IsIdentifier(name)) {
    paramName = Node_Text(name);
  }
  if (HasSyntacticModifier(node, ModifierFlagsParameterPropertyModifier)) {
    if (Checker_shouldCheckErasableSyntax(receiver, node)) {
      Checker_error(receiver, node, This_syntax_is_not_allowed_when_erasableSyntaxOnly_is_enabled);
    }
    if (!(IsConstructorDeclaration(fn) && NodeIsPresent(Node_Body(fn)))) {
      Checker_error(receiver, node, A_parameter_property_is_only_allowed_in_a_constructor_implementation);
    }
    if (IsConstructorDeclaration(fn) && paramName === "constructor") {
      Checker_error(receiver, Node_Name(node), X_constructor_cannot_be_used_as_a_parameter_property_name);
    }
  }
  if (Node_Initializer(node) === undefined && isOptionalDeclaration(node) && IsBindingPattern(Node_Name(node)) && Node_Body(fn) !== undefined) {
    Checker_error(receiver, node, A_binding_pattern_parameter_cannot_be_optional_in_an_implementation_signature);
  }
  if (paramName === "this" || paramName === "new") {
    if (slices.Index(Node_Parameters(fn) ?? [], node) !== 0) {
      Checker_error(receiver, node, A_0_parameter_must_be_the_first_parameter, paramName);
    }
    if (IsConstructorDeclaration(fn) || IsConstructSignatureDeclaration(fn) || IsConstructorTypeNode(fn)) {
      Checker_error(receiver, node, A_constructor_cannot_have_a_this_parameter);
    }
    if (IsArrowFunction(fn)) {
      Checker_error(receiver, node, An_arrow_function_cannot_have_a_this_parameter);
    }
    if (IsAccessor(fn)) {
      Checker_error(receiver, node, X_get_and_set_accessors_cannot_declare_this_parameters);
    }
  }
  if (hasDotDotDotToken(node) && !IsBindingPattern(Node_Name(node)) && !Checker_isTypeAssignableTo(receiver, Checker_getReducedType(receiver, Checker_getTypeOfSymbol(receiver, Node_Symbol(node))), receiver!.anyReadonlyArrayType)) {
    Checker_error(receiver, node, A_rest_parameter_must_be_of_an_array_type);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkPropertySignature","kind":"method","status":"implemented","sigHash":"65dd4330bba7198bffacacd361e8c652907aa800257cb7ac73d46e954910a4f0","bodyHash":"af567134e87e2e8e3d729b1b8220e66f043b963d0df0f3a75b78e3c4801cb046"}
 *
 * Go source:
 * func (c *Checker) checkPropertySignature(node *ast.Node) {
 * 	if ast.IsPrivateIdentifier(node.AsPropertySignatureDeclaration().Name()) {
 * 		c.error(node, diagnostics.Private_identifiers_are_not_allowed_outside_class_bodies)
 * 	}
 * 	c.checkPropertyDeclaration(node)
 * }
 */
export function Checker_checkPropertySignature(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  if (IsPrivateIdentifier(Node_Name(node))) {
    Checker_error(receiver, node, Private_identifiers_are_not_allowed_outside_class_bodies);
  }
  Checker_checkPropertyDeclaration(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkSignatureDeclaration","kind":"method","status":"implemented","sigHash":"2a254eb72fc561201fb1f4d1545b11eb0e8531c4d6974eca781602945c69a83e","bodyHash":"f910b99071d0cfe37c013f1cb61e98af3b7ce9a90ff42859c384c231ad8bfc7b"}
 *
 * Go source:
 * func (c *Checker) checkSignatureDeclaration(node *ast.Node) {
 * 	// Grammar checking
 * 	switch node.Kind {
 * 	case ast.KindIndexSignature:
 * 		c.checkGrammarIndexSignature(node.AsIndexSignatureDeclaration())
 * 	case ast.KindFunctionType, ast.KindFunctionDeclaration, ast.KindConstructorType, ast.KindCallSignature, ast.KindConstructor, ast.KindConstructSignature:
 * 		c.checkGrammarFunctionLikeDeclaration(node)
 * 	}
 * 	c.checkTypeParameters(node.TypeParameters())
 * 	c.checkUnmatchedJSDocParameters(node)
 * 	c.checkSourceElements(node.Parameters())
 * 	returnTypeNode := node.Type()
 * 	if returnTypeNode != nil {
 * 		c.checkSourceElement(returnTypeNode)
 * 	}
 * 	if c.noImplicitAny && returnTypeNode == nil {
 * 		switch node.Kind {
 * 		case ast.KindConstructSignature:
 * 			c.error(node, diagnostics.Construct_signature_which_lacks_return_type_annotation_implicitly_has_an_any_return_type)
 * 		case ast.KindCallSignature:
 * 			c.error(node, diagnostics.Call_signature_which_lacks_return_type_annotation_implicitly_has_an_any_return_type)
 * 		}
 * 	}
 * 	if returnTypeNode != nil {
 * 		functionFlags := ast.GetFunctionFlags(node)
 * 		if (functionFlags & (ast.FunctionFlagsInvalid | ast.FunctionFlagsGenerator)) == ast.FunctionFlagsGenerator {
 * 			returnType := c.getTypeFromTypeNode(returnTypeNode)
 * 			if returnType == c.voidType {
 * 				c.error(returnTypeNode, diagnostics.A_generator_cannot_have_a_void_type_annotation)
 * 			} else {
 * 				c.checkGeneratorInstantiationAssignabilityToReturnType(returnType, functionFlags, returnTypeNode)
 * 			}
 * 		} else if (functionFlags & ast.FunctionFlagsAsyncGenerator) == ast.FunctionFlagsAsync {
 * 			c.checkAsyncFunctionReturnType(node, returnTypeNode)
 * 		}
 * 	}
 * 	if !ast.IsIndexSignatureDeclaration(node) {
 * 		c.registerForUnusedIdentifiersCheck(node)
 * 	}
 * }
 */
export function Checker_checkSignatureDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  switch (node!.Kind) {
    case KindIndexSignature:
      Checker_checkGrammarIndexSignature(receiver, AsIndexSignatureDeclaration(node)!);
      break;
    case KindFunctionType:
    case KindFunctionDeclaration:
    case KindConstructorType:
    case KindCallSignature:
    case KindConstructor:
    case KindConstructSignature:
      Checker_checkGrammarFunctionLikeDeclaration(receiver, node);
      break;
  }
  Checker_checkTypeParameters(receiver, Node_TypeParameters(node) ?? []);
  Checker_checkUnmatchedJSDocParameters(receiver, node);
  Checker_checkSourceElements(receiver, Node_Parameters(node) ?? []);
  const returnTypeNode = Node_Type(node);
  if (returnTypeNode !== undefined) {
    Checker_checkSourceElement(receiver, returnTypeNode);
  }
  if (receiver!.noImplicitAny && returnTypeNode === undefined) {
    switch (node!.Kind) {
      case KindConstructSignature:
        Checker_error(receiver, node, Construct_signature_which_lacks_return_type_annotation_implicitly_has_an_any_return_type);
        break;
      case KindCallSignature:
        Checker_error(receiver, node, Call_signature_which_lacks_return_type_annotation_implicitly_has_an_any_return_type);
        break;
    }
  }
  if (returnTypeNode !== undefined) {
    const functionFlags = GetFunctionFlags(node);
    if ((functionFlags & (FunctionFlagsInvalid | FunctionFlagsGenerator)) === FunctionFlagsGenerator) {
      const returnType = Checker_getTypeFromTypeNode(receiver, returnTypeNode);
      if (returnType === receiver!.voidType) {
        Checker_error(receiver, returnTypeNode, A_generator_cannot_have_a_void_type_annotation);
      } else {
        Checker_checkGeneratorInstantiationAssignabilityToReturnType(receiver, returnType, functionFlags, returnTypeNode);
      }
    } else if ((functionFlags & FunctionFlagsAsyncGenerator) === FunctionFlagsAsync) {
      Checker_checkAsyncFunctionReturnType(receiver, node, returnTypeNode);
    }
  }
  if (!IsIndexSignatureDeclaration(node)) {
    Checker_registerForUnusedIdentifiersCheck(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkAsyncFunctionReturnType","kind":"method","status":"implemented","sigHash":"ab0ddb00f8c182e16031716b6233f474c1ccd37eefe980692a2da1739b452fb9","bodyHash":"44865723da3d942e6f87bc6e219c8be7e13b1f3fd5f3f37c2e885fba873276c8"}
 *
 * Go source:
 * func (c *Checker) checkAsyncFunctionReturnType(node *ast.Node, returnTypeNode *ast.Node) {
 * 	returnType := c.getTypeFromTypeNode(returnTypeNode)
 * 	if c.isErrorType(returnType) {
 * 		return
 * 	}
 * 	globalPromiseType := c.getGlobalPromiseTypeChecked()
 * 	if globalPromiseType != c.emptyGenericType && !c.isReferenceToType(returnType, globalPromiseType) {
 * 		// The promise type was not a valid type reference to the global promise type, so we
 * 		// report an error and return the unknown type.
 * 		c.error(returnTypeNode, diagnostics.The_return_type_of_an_async_function_or_method_must_be_the_global_Promise_T_type_Did_you_mean_to_write_Promise_0, c.TypeToString(core.OrElse(c.getAwaitedTypeNoAlias(returnType), c.voidType)))
 * 		return
 * 	}
 * 	c.checkAwaitedType(returnType, false /*withAlias* /, node, diagnostics.The_return_type_of_an_async_function_must_either_be_a_valid_promise_or_must_not_contain_a_callable_then_member)
 * }
 */
export function Checker_checkAsyncFunctionReturnType(receiver: GoPtr<Checker>, node: GoPtr<Node>, returnTypeNode: GoPtr<Node>): void {
  const returnType = Checker_getTypeFromTypeNode(receiver, returnTypeNode);
  if (Checker_isErrorType(receiver, returnType)) {
    return;
  }
  const globalPromiseType = receiver!.getGlobalPromiseTypeChecked();
  if (globalPromiseType !== receiver!.emptyGenericType && !Checker_isReferenceToType(receiver, returnType, globalPromiseType)) {
    Checker_error(
      receiver,
      returnTypeNode,
      The_return_type_of_an_async_function_or_method_must_be_the_global_Promise_T_type_Did_you_mean_to_write_Promise_0,
      Checker_TypeToString(receiver, core.OrElse(Checker_getAwaitedTypeNoAlias(receiver, returnType), receiver!.voidType)),
    );
    return;
  }
  Checker_checkAwaitedType(receiver, returnType, false, node, The_return_type_of_an_async_function_must_either_be_a_valid_promise_or_must_not_contain_a_callable_then_member);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkConstructorDeclaration","kind":"method","status":"implemented","sigHash":"07e6c9b9b3b1076ce12fadeda9df28d44ff389367c0aa5542c1a15c61ce0d996","bodyHash":"c4c11def4686fbab0b1a5df11791e196c949f381fda3a7072dd8d0f2e342e4b9"}
 *
 * Go source:
 * func (c *Checker) checkConstructorDeclaration(node *ast.Node) {
 * 	// Grammar check on signature of constructor and modifier of the constructor is done in checkSignatureDeclaration function.
 * 	c.checkSignatureDeclaration(node)
 * 	// Grammar check for checking only related to constructorDeclaration
 * 	ctor := node.AsConstructorDeclaration()
 * 	if !c.checkGrammarConstructorTypeParameters(ctor) {
 * 		c.checkGrammarConstructorTypeAnnotation(ctor)
 * 	}
 * 	c.checkSourceElement(node.Body())
 * 	symbol := c.getSymbolOfDeclaration(node)
 * 	c.checkFunctionOrConstructorSymbol(symbol)
 * 	// exit early in the case of signature - super checks are not relevant to them
 * 	if ast.NodeIsMissing(node.Body()) {
 * 		return
 * 	}
 * 	// TS 1.0 spec (April 2014): 8.3.2
 * 	// Constructors of classes with no extends clause may not contain super calls, whereas
 * 	// constructors of derived classes must contain at least one super call somewhere in their function body.
 * 	containingClassDecl := node.Parent
 * 	if ast.GetExtendsHeritageClauseElement(containingClassDecl) == nil {
 * 		return
 * 	}
 * 	classExtendsNull := c.classDeclarationExtendsNull(containingClassDecl)
 * 	superCall := c.findFirstSuperCall(node.Body())
 * 	if superCall != nil {
 * 		if classExtendsNull {
 * 			c.error(superCall, diagnostics.A_constructor_cannot_contain_a_super_call_when_its_class_extends_null)
 * 		}
 * 		// A super call must be root-level in a constructor if both of the following are true:
 * 		// - The containing class is a derived class.
 * 		// - The constructor declares parameter properties
 * 		//   or the containing class declares instance member variables with initializers.
 * 		superCallShouldBeRootLevel := !c.emitStandardClassFields &&
 * 			(core.Some(node.Parent.Members(), isInstancePropertyWithInitializerOrPrivateIdentifierProperty) ||
 * 				core.Some(node.Parameters(), func(p *ast.Node) bool {
 * 					return ast.HasSyntacticModifier(p, ast.ModifierFlagsParameterPropertyModifier)
 * 				}))
 * 		if superCallShouldBeRootLevel {
 * 			// Until we have better flow analysis, it is an error to place the super call within any kind of block or conditional
 * 			// See GH #8277
 * 			if !superCallIsRootLevelInConstructor(superCall, node.Body()) {
 * 				c.error(superCall, diagnostics.A_super_call_must_be_a_root_level_statement_within_a_constructor_of_a_derived_class_that_contains_initialized_properties_parameter_properties_or_private_identifiers)
 * 			} else {
 * 				var superCallStatement *ast.Node
 * 				for _, statement := range node.Body().Statements() {
 * 					if ast.IsExpressionStatement(statement) && isSuperCall(ast.SkipOuterExpressions(statement.Expression(), ast.OEKAll)) {
 * 						superCallStatement = statement
 * 						break
 * 					}
 * 					if nodeImmediatelyReferencesSuperOrThis(statement) {
 * 						break
 * 					}
 * 				}
 * 				// Until we have better flow analysis, it is an error to place the super call within any kind of block or conditional
 * 				// See GH #8277
 * 				if superCallStatement == nil {
 * 					c.error(node, diagnostics.A_super_call_must_be_the_first_statement_in_the_constructor_to_refer_to_super_or_this_when_a_derived_class_contains_initialized_properties_parameter_properties_or_private_identifiers)
 * 				}
 * 			}
 * 		}
 * 	} else if !classExtendsNull {
 * 		c.error(node, diagnostics.Constructors_for_derived_classes_must_contain_a_super_call)
 * 	}
 * }
 */
export function Checker_checkConstructorDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  Checker_checkSignatureDeclaration(receiver, node);
  const ctor = AsConstructorDeclaration(node)!;
  if (!Checker_checkGrammarConstructorTypeParameters(receiver, ctor)) {
    Checker_checkGrammarConstructorTypeAnnotation(receiver, ctor);
  }
  Checker_checkSourceElement(receiver, Node_Body(node));
  const symbol_ = Checker_getSymbolOfDeclaration(receiver, node);
  Checker_checkFunctionOrConstructorSymbol(receiver, symbol_);
  if (NodeIsMissing(Node_Body(node))) {
    return;
  }
  const containingClassDecl = node!.Parent;
  if (GetExtendsHeritageClauseElement(containingClassDecl) === undefined) {
    return;
  }
  const classExtendsNull = Checker_classDeclarationExtendsNull(receiver, containingClassDecl);
  const superCall = Checker_findFirstSuperCall(receiver, Node_Body(node));
  if (superCall !== undefined) {
    if (classExtendsNull) {
      Checker_error(receiver, superCall, A_constructor_cannot_contain_a_super_call_when_its_class_extends_null);
    }
    const superCallShouldBeRootLevel = (!receiver!.emitStandardClassFields &&
      (core.Some(Node_Members(node!.Parent) ?? [], isInstancePropertyWithInitializerOrPrivateIdentifierProperty) ||
        core.Some(Node_Parameters(node) ?? [], (p: GoPtr<Node>): bool => HasSyntacticModifier(p, ModifierFlagsParameterPropertyModifier)))) as bool;
    if (superCallShouldBeRootLevel) {
      if (!superCallIsRootLevelInConstructor(superCall, Node_Body(node))) {
        Checker_error(receiver, superCall, A_super_call_must_be_a_root_level_statement_within_a_constructor_of_a_derived_class_that_contains_initialized_properties_parameter_properties_or_private_identifiers);
      } else {
        let superCallStatement: GoPtr<Node>;
        for (const statement of Node_Statements(Node_Body(node)) ?? []) {
          if (IsExpressionStatement(statement) && isSuperCall(SkipOuterExpressions(Node_Expression(statement), OEKAll))) {
            superCallStatement = statement;
            break;
          }
          if (nodeImmediatelyReferencesSuperOrThis(statement)) {
            break;
          }
        }
        if (superCallStatement === undefined) {
          Checker_error(receiver, node, A_super_call_must_be_the_first_statement_in_the_constructor_to_refer_to_super_or_this_when_a_derived_class_contains_initialized_properties_parameter_properties_or_private_identifiers);
        }
      }
    }
  } else if (!classExtendsNull) {
    Checker_error(receiver, node, Constructors_for_derived_classes_must_contain_a_super_call);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.findFirstSuperCall","kind":"method","status":"implemented","sigHash":"73fbff4d7b96acba4102b12439c63e3be86bc89577599858b01610d57214d87f","bodyHash":"9fc094126407a5cc2740ca6276bde6c6f9aa2017e2a67afa7469f995f2724878"}
 *
 * Go source:
 * func (c *Checker) findFirstSuperCall(node *ast.Node) *ast.Node {
 * 	var superCall *ast.Node
 * 	var visit func(node *ast.Node) bool
 * 	visit = func(node *ast.Node) bool {
 * 		switch {
 * 		case isSuperCall(node):
 * 			superCall = node
 * 			return true
 * 		case ast.IsFunctionLike(node):
 * 			return false
 * 		}
 * 		return node.ForEachChild(visit)
 * 	}
 * 	visit(node)
 * 	return superCall
 * }
 */
export function Checker_findFirstSuperCall(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node> {
  let superCall: GoPtr<Node> = undefined;
  const visit = (n: GoPtr<Node>): bool => {
    if (isSuperCall(n)) {
      superCall = n;
      return true;
    }
    if (IsFunctionLike(n)) {
      return false;
    }
    return Node_ForEachChild(n, visit);
  };
  visit(node);
  return superCall;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTypeArgumentConstraints","kind":"method","status":"implemented","sigHash":"28dc343409929afc2516c002594a37bec3b6d87f8cc31d7d7a740b0554cf1837","bodyHash":"ef2f43f4939b0e2c20a2275f6eb82c0e796e70868223f24134e53f61405087c3"}
 *
 * Go source:
 * func (c *Checker) checkTypeArgumentConstraints(node *ast.Node, typeParameters []*Type) bool {
 * 	var typeArguments []*Type
 * 	var mapper *TypeMapper
 * 	result := true
 * 	for i, typeParameter := range typeParameters {
 * 		constraint := c.getConstraintOfTypeParameter(typeParameter)
 * 		if constraint != nil {
 * 			if typeArguments == nil {
 * 				typeArguments = c.getEffectiveTypeArguments(node, typeParameters)
 * 				mapper = newTypeMapper(typeParameters, typeArguments)
 * 			}
 * 			result = result && c.checkTypeAssignableTo(typeArguments[i], c.instantiateType(constraint, mapper), core.ElementOrNil(node.TypeArguments(), i), diagnostics.Type_0_does_not_satisfy_the_constraint_1)
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Checker_checkTypeArgumentConstraints(receiver: GoPtr<Checker>, node: GoPtr<Node>, typeParameters: GoSlice<GoPtr<Type>>): bool {
  let typeArguments: GoPtr<GoSlice<GoPtr<Type>>> = undefined;
  let mapper: GoPtr<TypeMapper> = undefined;
  let result = true;
  for (let i = 0; i < typeParameters.length; i++) {
    const typeParameter = typeParameters[i];
    const constraint = Checker_getConstraintOfTypeParameter(receiver, typeParameter);
    if (constraint !== undefined) {
      if (typeArguments === undefined) {
        typeArguments = Checker_getEffectiveTypeArguments(receiver, node, typeParameters);
        mapper = newTypeMapper(typeParameters, typeArguments);
      }
      result = result && Checker_checkTypeAssignableTo(receiver, typeArguments[i], Checker_instantiateType(receiver, constraint, mapper), core.ElementOrNil(Node_TypeArguments(node) ?? [], i), Type_0_does_not_satisfy_the_constraint_1);
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkThisType","kind":"method","status":"implemented","sigHash":"f78b1caa034ccf114c32a231424550e99fad4ce9cb21e2ecd159399c2ec6ca95","bodyHash":"5b5243e87ec62a8aa0cebe9f643a0666e22ba2ce2ec31e3183dfb981dce8df06"}
 *
 * Go source:
 * func (c *Checker) checkThisType(node *ast.Node) {
 * 	c.getTypeFromThisTypeNode(node)
 * }
 */
export function Checker_checkThisType(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  Checker_getTypeFromThisTypeNode(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkFunctionOrConstructorSymbol","kind":"method","status":"implemented","sigHash":"1b4530229bf7da86f4197961be72f1d1d5249ea0c40134ad7e364410234856eb","bodyHash":"01f02715c95bb25e4e8c170e3009b9c7c8f1b4deb3c4c53604c2968e2fc1dab3"}
 *
 * Go source:
 * func (c *Checker) checkFunctionOrConstructorSymbol(symbol *ast.Symbol) {
 * 	// Only check the symbol once
 * 	if links := c.valueSymbolLinks.Get(symbol); !links.functionOrConstructorChecked {
 * 		links.functionOrConstructorChecked = true
 * 		c.checkFunctionOrConstructorSymbolWorker(symbol)
 * 	}
 * }
 */
export function Checker_checkFunctionOrConstructorSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): void {
  const links = LinkStore_Get(receiver!.valueSymbolLinks, symbol_) as GoPtr<ValueSymbolLinks>;
  if (!links!.functionOrConstructorChecked) {
    links!.functionOrConstructorChecked = true;
    Checker_checkFunctionOrConstructorSymbolWorker(receiver, symbol_);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkFunctionOrConstructorSymbolWorker","kind":"method","status":"implemented","sigHash":"850fa2d05d385c6304ee812c65af6ab74a67ee326345a813710e3ad7a1b0642f","bodyHash":"931515c23bcf9a43c6d889d6e328f7902990ab5a0ee324037513ef552394ac99"}
 *
 * Go source:
 * func (c *Checker) checkFunctionOrConstructorSymbolWorker(symbol *ast.Symbol) {
 * 	flagsToCheck := ast.ModifierFlagsExport | ast.ModifierFlagsAmbient | ast.ModifierFlagsPrivate | ast.ModifierFlagsProtected | ast.ModifierFlagsAbstract
 * 	someNodeFlags := ast.ModifierFlagsNone
 * 	allNodeFlags := flagsToCheck
 * 	someHaveQuestionToken := false
 * 	allHaveQuestionToken := true
 * 	hasOverloads := false
 * 	var bodyDeclaration *ast.Node
 * 	var lastSeenNonAmbientDeclaration *ast.Node
 * 	var previousDeclaration *ast.Node
 * 	declarations := symbol.Declarations
 * 	isConstructor := symbol.Flags&ast.SymbolFlagsConstructor != 0
 * 	duplicateFunctionDeclaration := false
 * 	multipleConstructorImplementation := false
 * 	hasNonAmbientClass := false
 * 	var functionDeclarations []*ast.Node
 * 	getCanonicalOverload := func(overloads []*ast.Node, implementation *ast.Node) *ast.Node {
 * 		// Consider the canonical set of flags to be the flags of the bodyDeclaration or the first declaration
 * 		// Error on all deviations from this canonical set of flags
 * 		// The caveat is that if some overloads are defined in lib.d.ts, we don't want to
 * 		// report the errors on those. To achieve this, we will say that the implementation is
 * 		// the canonical signature only if it is in the same container as the first overload
 * 		implementationSharesContainerWithFirstOverload := implementation != nil && implementation.Parent == overloads[0].Parent
 * 		if implementationSharesContainerWithFirstOverload {
 * 			return implementation
 * 		}
 * 		return overloads[0]
 * 	}
 * 	checkFlagAgreementBetweenOverloads := func(overloads []*ast.Node, implementation *ast.Node, flagsToCheck ast.ModifierFlags, someOverloadFlags ast.ModifierFlags, allOverloadFlags ast.ModifierFlags) {
 * 		// Error if some overloads have a flag that is not shared by all overloads. To find the
 * 		// deviations, we XOR someOverloadFlags with allOverloadFlags
 * 		someButNotAllOverloadFlags := someOverloadFlags ^ allOverloadFlags
 * 		if someButNotAllOverloadFlags != 0 {
 * 			canonicalFlags := c.getEffectiveDeclarationFlags(getCanonicalOverload(overloads, implementation), flagsToCheck)
 * 			groups := make(map[*ast.SourceFile][]*ast.Node)
 * 			for _, overload := range overloads {
 * 				sourceFile := ast.GetSourceFileOfNode(overload)
 * 				groups[sourceFile] = append(groups[sourceFile], overload)
 * 			}
 * 			for _, overloadsInFile := range groups {
 * 				canonicalFlagsForFile := c.getEffectiveDeclarationFlags(getCanonicalOverload(overloadsInFile, implementation), flagsToCheck)
 * 				for _, overload := range overloadsInFile {
 * 					deviation := c.getEffectiveDeclarationFlags(overload, flagsToCheck) ^ canonicalFlags
 * 					deviationInFile := c.getEffectiveDeclarationFlags(overload, flagsToCheck) ^ canonicalFlagsForFile
 * 					switch {
 * 					case deviationInFile&ast.ModifierFlagsExport != 0:
 * 						// Overloads in different files need not all have export modifiers. This is ok:
 * 						//   // lib.d.ts
 * 						//   declare function foo(s: number): string;
 * 						//   declare function foo(s: string): number;
 * 						//   export { foo };
 * 						//
 * 						//   // app.ts
 * 						//   declare module "lib" {
 * 						//     export function foo(s: boolean): boolean;
 * 						//   }
 * 						c.error(ast.GetNameOfDeclaration(overload), diagnostics.Overload_signatures_must_all_be_exported_or_non_exported)
 * 					case deviationInFile&ast.ModifierFlagsAmbient != 0:
 * 						// Though rare, a module augmentation (necessarily ambient) is allowed to add overloads
 * 						// to a non-ambient function in an implementation file.
 * 						c.error(ast.GetNameOfDeclaration(overload), diagnostics.Overload_signatures_must_all_be_ambient_or_non_ambient)
 * 					case deviation&(ast.ModifierFlagsPrivate|ast.ModifierFlagsProtected) != 0:
 * 						c.error(core.OrElse(ast.GetNameOfDeclaration(overload), overload), diagnostics.Overload_signatures_must_all_be_public_private_or_protected)
 * 					case deviation&ast.ModifierFlagsAbstract != 0:
 * 						c.error(ast.GetNameOfDeclaration(overload), diagnostics.Overload_signatures_must_all_be_abstract_or_non_abstract)
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	checkQuestionTokenAgreementBetweenOverloads := func(overloads []*ast.Node, implementation *ast.Node, someHaveQuestionToken bool, allHaveQuestionToken bool) {
 * 		if someHaveQuestionToken != allHaveQuestionToken {
 * 			canonicalHasQuestionToken := isOptionalDeclaration(getCanonicalOverload(overloads, implementation))
 * 			for _, o := range overloads {
 * 				if isOptionalDeclaration(o) != canonicalHasQuestionToken {
 * 					c.error(ast.GetNameOfDeclaration(o), diagnostics.Overload_signatures_must_all_be_optional_or_required)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	reportImplementationExpectedError := func(node *ast.Node) {
 * 		name := node.Name()
 * 		if name != nil && ast.NodeIsMissing(name) {
 * 			return
 * 		}
 * 		seen := false
 * 		var subsequentNode *ast.Node
 * 		node.Parent.ForEachChild(func(child *ast.Node) bool {
 * 			if seen {
 * 				subsequentNode = child
 * 				return true
 * 			}
 * 			seen = child == node
 * 			return false
 * 		})
 * 		// We may be here because of some extra nodes between overloads that could not be parsed into a valid node.
 * 		// In this case the subsequent node is not really consecutive (.pos !== node.end), and we must ignore it here.
 * 		if subsequentNode != nil && subsequentNode.Pos() == node.End() {
 * 			if subsequentNode.Kind == node.Kind {
 * 				subsequentName := subsequentNode.Name()
 * 				errorNode := core.OrElse(subsequentName, subsequentNode)
 * 				if name != nil && subsequentName != nil &&
 * 					(ast.IsPrivateIdentifier(name) && ast.IsPrivateIdentifier(subsequentName) && name.Text() == subsequentName.Text() ||
 * 						ast.IsComputedPropertyName(name) && ast.IsComputedPropertyName(subsequentName) && c.isTypeIdenticalTo(c.checkComputedPropertyName(name), c.checkComputedPropertyName(subsequentName)) ||
 * 						ast.IsPropertyNameLiteral(name) && ast.IsPropertyNameLiteral(subsequentName) && name.Text() == subsequentName.Text()) {
 * 					reportError := (ast.IsMethodDeclaration(node) || ast.IsMethodSignatureDeclaration(node)) && ast.IsStatic(node) != ast.IsStatic(subsequentNode)
 * 					// we can get here in two cases
 * 					// 1. mixed static and instance class members
 * 					// 2. something with the same name was defined before the set of overloads that prevents them from merging
 * 					// here we'll report error only for the first case since for second we should already report error in binder
 * 					if reportError {
 * 						diagnostic := core.IfElse(ast.IsStatic(node), diagnostics.Function_overload_must_be_static, diagnostics.Function_overload_must_not_be_static)
 * 						c.error(errorNode, diagnostic)
 * 					}
 * 					return
 * 				}
 * 				if ast.NodeIsPresent(subsequentNode.Body()) {
 * 					c.error(errorNode, diagnostics.Function_implementation_name_must_be_0, scanner.DeclarationNameToString(name))
 * 					return
 * 				}
 * 			}
 * 		}
 * 		errorNode := core.OrElse(name, node)
 * 		if isConstructor {
 * 			c.error(errorNode, diagnostics.Constructor_implementation_is_missing)
 * 		} else {
 * 			// Report different errors regarding non-consecutive blocks of declarations depending on whether
 * 			// the node in question is abstract.
 * 			if ast.HasSyntacticModifier(node, ast.ModifierFlagsAbstract) {
 * 				c.error(errorNode, diagnostics.All_declarations_of_an_abstract_method_must_be_consecutive)
 * 			} else {
 * 				c.error(errorNode, diagnostics.Function_implementation_is_missing_or_not_immediately_following_the_declaration)
 * 			}
 * 		}
 * 	}
 * 	for _, node := range declarations {
 * 		inAmbientContext := node.Flags&ast.NodeFlagsAmbient != 0
 * 		inAmbientContextOrInterface := inAmbientContext || node.Parent != nil && (ast.IsInterfaceDeclaration(node.Parent) || ast.IsTypeLiteralNode(node.Parent))
 * 		if inAmbientContextOrInterface {
 * 			// check if declarations are consecutive only if they are non-ambient
 * 			// 1. ambient declarations can be interleaved
 * 			// i.e. this is legal
 * 			//     declare function foo();
 * 			//     declare function bar();
 * 			//     declare function foo();
 * 			// 2. mixing ambient and non-ambient declarations is a separate error that will be reported - do not want to report an extra one
 * 			previousDeclaration = nil
 * 		}
 * 		if ast.IsClassLike(node) && !inAmbientContext {
 * 			hasNonAmbientClass = true
 * 		}
 * 		if ast.IsFunctionDeclaration(node) || ast.IsMethodDeclaration(node) || ast.IsMethodSignatureDeclaration(node) || ast.IsConstructorDeclaration(node) {
 * 			functionDeclarations = append(functionDeclarations, node)
 * 			currentNodeFlags := c.getEffectiveDeclarationFlags(node, flagsToCheck)
 * 			someNodeFlags |= currentNodeFlags
 * 			allNodeFlags &= currentNodeFlags
 * 			someHaveQuestionToken = someHaveQuestionToken || isOptionalDeclaration(node)
 * 			allHaveQuestionToken = allHaveQuestionToken && isOptionalDeclaration(node)
 * 			bodyIsPresent := ast.NodeIsPresent(node.Body())
 * 			if bodyIsPresent && bodyDeclaration != nil {
 * 				if isConstructor {
 * 					multipleConstructorImplementation = true
 * 				} else {
 * 					duplicateFunctionDeclaration = true
 * 				}
 * 			} else if previousDeclaration != nil && previousDeclaration.Parent == node.Parent && previousDeclaration.End() != node.Pos() && previousDeclaration.Flags&ast.NodeFlagsReparsed == 0 {
 * 				reportImplementationExpectedError(previousDeclaration)
 * 			}
 * 			if bodyIsPresent {
 * 				if bodyDeclaration == nil {
 * 					bodyDeclaration = node
 * 				}
 * 			} else {
 * 				hasOverloads = true
 * 			}
 * 			previousDeclaration = node
 * 			if !inAmbientContextOrInterface {
 * 				lastSeenNonAmbientDeclaration = node
 * 			}
 * 		}
 * 	}
 * 	if multipleConstructorImplementation {
 * 		for _, declaration := range functionDeclarations {
 * 			c.error(declaration, diagnostics.Multiple_constructor_implementations_are_not_allowed)
 * 		}
 * 	}
 * 	if duplicateFunctionDeclaration {
 * 		for _, declaration := range functionDeclarations {
 * 			c.error(core.OrElse(ast.GetNameOfDeclaration(declaration), declaration), diagnostics.Duplicate_function_implementation)
 * 		}
 * 	}
 * 	if hasNonAmbientClass && !isConstructor && symbol.Flags&ast.SymbolFlagsFunction != 0 && len(declarations) != 0 {
 * 		var relatedDiagnostics []*ast.Diagnostic
 * 		for _, declaration := range declarations {
 * 			if ast.IsClassDeclaration(declaration) {
 * 				relatedDiagnostics = append(relatedDiagnostics, createDiagnosticForNode(declaration, diagnostics.Consider_adding_a_declare_modifier_to_this_class))
 * 			}
 * 		}
 * 		for _, declaration := range declarations {
 * 			var diagnostic *diagnostics.Message
 * 			switch declaration.Kind {
 * 			case ast.KindClassDeclaration:
 * 				diagnostic = diagnostics.Class_declaration_cannot_implement_overload_list_for_0
 * 			case ast.KindFunctionDeclaration:
 * 				diagnostic = diagnostics.Function_with_bodies_can_only_merge_with_classes_that_are_ambient
 * 			}
 * 			if diagnostic != nil {
 * 				c.error(core.OrElse(ast.GetNameOfDeclaration(declaration), declaration), diagnostic, symbol.Name).SetRelatedInfo(relatedDiagnostics)
 * 			}
 * 		}
 * 	}
 * 	// Abstract methods can't have an implementation -- in particular, they don't need one.
 * 	if lastSeenNonAmbientDeclaration != nil && lastSeenNonAmbientDeclaration.Body() == nil && !ast.HasSyntacticModifier(lastSeenNonAmbientDeclaration, ast.ModifierFlagsAbstract) && !isOptionalDeclaration(lastSeenNonAmbientDeclaration) {
 * 		reportImplementationExpectedError(lastSeenNonAmbientDeclaration)
 * 	}
 * 	if hasOverloads {
 * 		checkFlagAgreementBetweenOverloads(declarations, bodyDeclaration, flagsToCheck, someNodeFlags, allNodeFlags)
 * 		checkQuestionTokenAgreementBetweenOverloads(declarations, bodyDeclaration, someHaveQuestionToken, allHaveQuestionToken)
 * 		if bodyDeclaration != nil {
 * 			signatures := c.getSignaturesOfSymbol(symbol)
 * 			bodySignature := c.getSignatureFromDeclaration(bodyDeclaration)
 * 			for _, signature := range signatures {
 * 				if !c.isImplementationCompatibleWithOverload(bodySignature, signature) {
 * 					errorNode := signature.declaration
 * 					c.error(errorNode, diagnostics.This_overload_signature_is_not_compatible_with_its_implementation_signature).AddRelatedInfo(createDiagnosticForNode(bodyDeclaration, diagnostics.The_implementation_signature_is_declared_here))
 * 					break
 * 				}
 * 			}
 * 		}
 * 	}
 * }
 */
export function Checker_checkFunctionOrConstructorSymbolWorker(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): void {
  const flagsToCheck = (ModifierFlagsExport | ModifierFlagsAmbient | ModifierFlagsPrivate | ModifierFlagsProtected | ModifierFlagsAbstract) as int;
  let someNodeFlags = 0 as int;
  let allNodeFlags = flagsToCheck;
  let someHaveQuestionToken = false as bool;
  let allHaveQuestionToken = true as bool;
  let hasOverloads = false as bool;
  let bodyDeclaration: GoPtr<Node> = undefined;
  let lastSeenNonAmbientDeclaration: GoPtr<Node> = undefined;
  let previousDeclaration: GoPtr<Node> = undefined;
  const declarations = symbol_!.Declarations ?? [];
  const isConstructor = ((symbol_!.Flags & SymbolFlagsConstructor) !== 0) as bool;
  let duplicateFunctionDeclaration = false as bool;
  let multipleConstructorImplementation = false as bool;
  let hasNonAmbientClass = false as bool;
  const functionDeclarations: GoSlice<GoPtr<Node>> = [];

  const getCanonicalOverload = (overloads: GoSlice<GoPtr<Node>>, implementation: GoPtr<Node>): GoPtr<Node> => {
    const implementationSharesContainerWithFirstOverload = (implementation !== undefined && implementation!.Parent === overloads[0]!.Parent) as bool;
    if (implementationSharesContainerWithFirstOverload) {
      return implementation;
    }
    return overloads[0];
  };

  const checkFlagAgreementBetweenOverloads = (
    overloads: GoSlice<GoPtr<Node>>,
    implementation: GoPtr<Node>,
    checkFlags: int,
    someOverloadFlags: int,
    allOverloadFlags: int,
  ): void => {
    const someButNotAllOverloadFlags = (someOverloadFlags ^ allOverloadFlags) as int;
    if (someButNotAllOverloadFlags !== 0) {
      const canonicalFlags = Checker_getEffectiveDeclarationFlags(receiver, getCanonicalOverload(overloads, implementation), checkFlags);
      const groups = new globalThis.Map<SourceFile, GoSlice<GoPtr<Node>>>();
      for (const overload of overloads) {
        const sourceFile = GetSourceFileOfNode(overload)!;
        const overloadsInFile = groups.get(sourceFile);
        if (overloadsInFile === undefined) {
          groups.set(sourceFile, [overload]);
        } else {
          overloadsInFile.push(overload);
        }
      }
      for (const overloadsInFile of groups.values()) {
        const canonicalFlagsForFile = Checker_getEffectiveDeclarationFlags(receiver, getCanonicalOverload(overloadsInFile, implementation), checkFlags);
        for (const overload of overloadsInFile) {
          const deviation = (Checker_getEffectiveDeclarationFlags(receiver, overload, checkFlags) ^ canonicalFlags) as int;
          const deviationInFile = (Checker_getEffectiveDeclarationFlags(receiver, overload, checkFlags) ^ canonicalFlagsForFile) as int;
          if ((deviationInFile & ModifierFlagsExport) !== 0) {
            Checker_error(receiver, GetNameOfDeclaration(overload), Overload_signatures_must_all_be_exported_or_non_exported);
          } else if ((deviationInFile & ModifierFlagsAmbient) !== 0) {
            Checker_error(receiver, GetNameOfDeclaration(overload), Overload_signatures_must_all_be_ambient_or_non_ambient);
          } else if ((deviation & (ModifierFlagsPrivate | ModifierFlagsProtected)) !== 0) {
            Checker_error(receiver, core.OrElse(GetNameOfDeclaration(overload), overload), Overload_signatures_must_all_be_public_private_or_protected);
          } else if ((deviation & ModifierFlagsAbstract) !== 0) {
            Checker_error(receiver, GetNameOfDeclaration(overload), Overload_signatures_must_all_be_abstract_or_non_abstract);
          }
        }
      }
    }
  };

  const checkQuestionTokenAgreementBetweenOverloads = (
    overloads: GoSlice<GoPtr<Node>>,
    implementation: GoPtr<Node>,
    someOverloadHasQuestionToken: bool,
    allOverloadsHaveQuestionToken: bool,
  ): void => {
    if (someOverloadHasQuestionToken !== allOverloadsHaveQuestionToken) {
      const canonicalHasQuestionToken = isOptionalDeclaration(getCanonicalOverload(overloads, implementation));
      for (const overload of overloads) {
        if (isOptionalDeclaration(overload) !== canonicalHasQuestionToken) {
          Checker_error(receiver, GetNameOfDeclaration(overload), Overload_signatures_must_all_be_optional_or_required);
        }
      }
    }
  };

  const reportImplementationExpectedError = (node: GoPtr<Node>): void => {
    const name = Node_Name(node);
    if (name !== undefined && NodeIsMissing(name)) {
      return;
    }
    let seen = false as bool;
    const subsequentNode = { node: undefined as GoPtr<Node> };
    Node_ForEachChild(node!.Parent, (child: GoPtr<Node>): bool => {
      if (seen) {
        subsequentNode.node = child;
        return true as bool;
      }
      seen = (child === node) as bool;
      return false as bool;
    });
    if (subsequentNode.node !== undefined && Node_Pos(subsequentNode.node) === Node_End(node)) {
      if (subsequentNode.node!.Kind === node!.Kind) {
        const subsequentName = Node_Name(subsequentNode.node);
        const errorNode = core.OrElse(subsequentName, subsequentNode.node);
        if (name !== undefined && subsequentName !== undefined &&
          (
            (IsPrivateIdentifier(name) && IsPrivateIdentifier(subsequentName) && Node_Text(name) === Node_Text(subsequentName)) ||
            (IsComputedPropertyName(name) && IsComputedPropertyName(subsequentName) && Checker_isTypeIdenticalTo(receiver, Checker_checkComputedPropertyName(receiver, name), Checker_checkComputedPropertyName(receiver, subsequentName))) ||
            (IsPropertyNameLiteral(name) && IsPropertyNameLiteral(subsequentName) && Node_Text(name) === Node_Text(subsequentName))
          )) {
          const reportError = ((IsMethodDeclaration(node) || IsMethodSignatureDeclaration(node)) && IsStatic(node) !== IsStatic(subsequentNode.node)) as bool;
          if (reportError) {
            const diagnostic = core.IfElse(IsStatic(node), Function_overload_must_be_static, Function_overload_must_not_be_static);
            Checker_error(receiver, errorNode, diagnostic);
          }
          return;
        }
        if (NodeIsPresent(Node_Body(subsequentNode.node))) {
          Checker_error(receiver, errorNode, Function_implementation_name_must_be_0, DeclarationNameToString(name));
          return;
        }
      }
    }
    const errorNode = core.OrElse(name, node);
    if (isConstructor) {
      Checker_error(receiver, errorNode, Constructor_implementation_is_missing);
    } else if (HasSyntacticModifier(node, ModifierFlagsAbstract)) {
      Checker_error(receiver, errorNode, All_declarations_of_an_abstract_method_must_be_consecutive);
    } else {
      Checker_error(receiver, errorNode, Function_implementation_is_missing_or_not_immediately_following_the_declaration);
    }
  };

  for (const node of declarations) {
    const inAmbientContext = ((node!.Flags & NodeFlagsAmbient) !== 0) as bool;
    const inAmbientContextOrInterface = (inAmbientContext || (node!.Parent !== undefined && (IsInterfaceDeclaration(node!.Parent) || IsTypeLiteralNode(node!.Parent)))) as bool;
    if (inAmbientContextOrInterface) {
      previousDeclaration = undefined;
    }
    if (IsClassLike(node) && !inAmbientContext) {
      hasNonAmbientClass = true as bool;
    }
    if (IsFunctionDeclaration(node) || IsMethodDeclaration(node) || IsMethodSignatureDeclaration(node) || IsConstructorDeclaration(node)) {
      functionDeclarations.push(node);
      const currentNodeFlags = Checker_getEffectiveDeclarationFlags(receiver, node, flagsToCheck);
      someNodeFlags = (someNodeFlags | currentNodeFlags) as int;
      allNodeFlags = (allNodeFlags & currentNodeFlags) as int;
      someHaveQuestionToken = (someHaveQuestionToken || isOptionalDeclaration(node)) as bool;
      allHaveQuestionToken = (allHaveQuestionToken && isOptionalDeclaration(node)) as bool;
      const bodyIsPresent = NodeIsPresent(Node_Body(node));
      if (bodyIsPresent && bodyDeclaration !== undefined) {
        if (isConstructor) {
          multipleConstructorImplementation = true as bool;
        } else {
          duplicateFunctionDeclaration = true as bool;
        }
      } else if (
        previousDeclaration !== undefined &&
        previousDeclaration!.Parent === node!.Parent &&
        Node_End(previousDeclaration) !== Node_Pos(node) &&
        (previousDeclaration!.Flags & NodeFlagsReparsed) === 0
      ) {
        reportImplementationExpectedError(previousDeclaration);
      }
      if (bodyIsPresent) {
        if (bodyDeclaration === undefined) {
          bodyDeclaration = node;
        }
      } else {
        hasOverloads = true as bool;
      }
      previousDeclaration = node;
      if (!inAmbientContextOrInterface) {
        lastSeenNonAmbientDeclaration = node;
      }
    }
  }

  if (multipleConstructorImplementation) {
    for (const declaration of functionDeclarations) {
      Checker_error(receiver, declaration, Multiple_constructor_implementations_are_not_allowed);
    }
  }
  if (duplicateFunctionDeclaration) {
    for (const declaration of functionDeclarations) {
      Checker_error(receiver, core.OrElse(GetNameOfDeclaration(declaration), declaration), Duplicate_function_implementation);
    }
  }
  if (hasNonAmbientClass && !isConstructor && (symbol_!.Flags & SymbolFlagsFunction) !== 0 && declarations.length !== 0) {
    const relatedDiagnostics: GoSlice<GoPtr<Diagnostic>> = [];
    for (const declaration of declarations) {
      if (IsClassDeclaration(declaration)) {
        relatedDiagnostics.push(NewDiagnosticForNode(declaration, Consider_adding_a_declare_modifier_to_this_class));
      }
    }
    for (const declaration of declarations) {
      let diagnostic: GoPtr<Message> = undefined;
      switch (declaration!.Kind) {
        case KindClassDeclaration:
          diagnostic = Class_declaration_cannot_implement_overload_list_for_0;
          break;
        case KindFunctionDeclaration:
          diagnostic = Function_with_bodies_can_only_merge_with_classes_that_are_ambient;
          break;
      }
      if (diagnostic !== undefined) {
        const err = Checker_error(receiver, core.OrElse(GetNameOfDeclaration(declaration), declaration), diagnostic, symbol_!.Name);
        Diagnostic_SetRelatedInfo(err, relatedDiagnostics);
      }
    }
  }
  if (
    lastSeenNonAmbientDeclaration !== undefined &&
    Node_Body(lastSeenNonAmbientDeclaration) === undefined &&
    !HasSyntacticModifier(lastSeenNonAmbientDeclaration, ModifierFlagsAbstract) &&
    !isOptionalDeclaration(lastSeenNonAmbientDeclaration)
  ) {
    reportImplementationExpectedError(lastSeenNonAmbientDeclaration);
  }
  if (hasOverloads) {
    checkFlagAgreementBetweenOverloads(declarations, bodyDeclaration, flagsToCheck, someNodeFlags, allNodeFlags);
    checkQuestionTokenAgreementBetweenOverloads(declarations, bodyDeclaration, someHaveQuestionToken, allHaveQuestionToken);
    if (bodyDeclaration !== undefined) {
      const signatures = Checker_getSignaturesOfSymbol(receiver, symbol_);
      const bodySignature = Checker_getSignatureFromDeclaration(receiver, bodyDeclaration);
      for (const signature of signatures) {
        if (!Checker_isImplementationCompatibleWithOverload(receiver, bodySignature, signature)) {
          const errorNode = Signature_Declaration(signature);
          const diagnostic = Checker_error(receiver, errorNode, This_overload_signature_is_not_compatible_with_its_implementation_signature);
          Diagnostic_AddRelatedInfo(diagnostic, NewDiagnosticForNode(bodyDeclaration, The_implementation_signature_is_declared_here));
          break;
        }
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isImplementationCompatibleWithOverload","kind":"method","status":"implemented","sigHash":"d7a65f77f03a1a63060e5195929592ba010d31aa18f00e204cef2f322e136c70","bodyHash":"2791c2afaa7129993bcefc88ae9f147f71311fa779dd9c26f3ab85c7cc77016d"}
 *
 * Go source:
 * func (c *Checker) isImplementationCompatibleWithOverload(implementation *Signature, overload *Signature) bool {
 * 	erasedSource := c.getErasedSignature(implementation)
 * 	erasedTarget := c.getErasedSignature(overload)
 * 	// First see if the return types are compatible in either direction.
 * 	sourceReturnType := c.getReturnTypeOfSignature(erasedSource)
 * 	targetReturnType := c.getReturnTypeOfSignature(erasedTarget)
 * 	if targetReturnType == c.voidType || c.isTypeRelatedTo(targetReturnType, sourceReturnType, c.assignableRelation) || c.isTypeRelatedTo(sourceReturnType, targetReturnType, c.assignableRelation) {
 * 		return c.isSignatureAssignableTo(erasedSource, erasedTarget, true /*ignoreReturnTypes* /)
 * 	}
 * 	return false
 * }
 */
export function Checker_isImplementationCompatibleWithOverload(receiver: GoPtr<Checker>, implementation: GoPtr<Signature>, overload: GoPtr<Signature>): bool {
  const erasedSource = Checker_getErasedSignature(receiver, implementation);
  const erasedTarget = Checker_getErasedSignature(receiver, overload);
  const sourceReturnType = Checker_getReturnTypeOfSignature(receiver, erasedSource);
  const targetReturnType = Checker_getReturnTypeOfSignature(receiver, erasedTarget);
  if (targetReturnType === receiver!.voidType ||
    Checker_isTypeRelatedTo(receiver, targetReturnType, sourceReturnType, receiver!.assignableRelation) ||
    Checker_isTypeRelatedTo(receiver, sourceReturnType, targetReturnType, receiver!.assignableRelation)) {
    return Checker_isSignatureAssignableTo(receiver, erasedSource, erasedTarget, true);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isUnwrappedReturnTypeUndefinedVoidOrAny","kind":"method","status":"implemented","sigHash":"640e1c1a9d9e8ecd46bd2830e7a37b3463dd91601518812bd4b0f1ecfd8b5a7d","bodyHash":"027a45f4e786baab609f976d887dfd3fb512235b38cf474ef262b924a13c23f6"}
 *
 * Go source:
 * func (c *Checker) isUnwrappedReturnTypeUndefinedVoidOrAny(fn *ast.Node, returnType *Type) bool {
 * 	t := c.unwrapReturnType(returnType, ast.GetFunctionFlags(fn))
 * 	return t != nil && (c.maybeTypeOfKind(t, TypeFlagsVoid) || t.flags&(TypeFlagsAny|TypeFlagsUndefined) != 0)
 * }
 */
export function Checker_isUnwrappedReturnTypeUndefinedVoidOrAny(receiver: GoPtr<Checker>, fn: GoPtr<Node>, returnType: GoPtr<Type>): bool {
  const t = Checker_unwrapReturnType(receiver, returnType, GetFunctionFlags(fn));
  return t !== undefined && (Checker_maybeTypeOfKind(receiver, t, TypeFlagsVoid) || (t!.flags & (TypeFlagsAny | TypeFlagsUndefined)) !== 0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTypeParameterListsIdentical","kind":"method","status":"implemented","sigHash":"63ae505b7b8dcfe89678aabfbecbdc58061371802f0c53893e10ea24d53ece35","bodyHash":"2e63d273c735e443fb224aeb3ef7b6cf611b491893e3d7a914d860563fc867cc"}
 *
 * Go source:
 * func (c *Checker) checkTypeParameterListsIdentical(symbol *ast.Symbol) {
 * 	if len(symbol.Declarations) == 1 {
 * 		return
 * 	}
 * 	links := c.declaredTypeLinks.Get(symbol)
 * 	if !links.typeParametersChecked {
 * 		links.typeParametersChecked = true
 * 		declarations := c.getClassOrInterfaceDeclarationsOfSymbol(symbol)
 * 		if len(declarations) <= 1 {
 * 			return
 * 		}
 * 		t := c.getDeclaredTypeOfSymbol(symbol)
 * 		if !c.areTypeParametersIdentical(declarations, t.AsInterfaceType().LocalTypeParameters(), (*ast.Node).TypeParameters) {
 * 			// Report an error on every conflicting declaration.
 * 			name := c.symbolToString(symbol)
 * 			for _, declaration := range declarations {
 * 				c.error(declaration.Name(), diagnostics.All_declarations_of_0_must_have_identical_type_parameters, name)
 * 			}
 * 		}
 * 	}
 * }
 */
export function Checker_checkTypeParameterListsIdentical(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): void {
  if ((symbol_!.Declarations?.length ?? 0) === 1) {
    return;
  }
  const links = LinkStore_Get(receiver!.declaredTypeLinks, symbol_) as GoPtr<DeclaredTypeLinks>;
  if (!links!.typeParametersChecked) {
    links!.typeParametersChecked = true as bool;
    const declarations = Checker_getClassOrInterfaceDeclarationsOfSymbol(receiver, symbol_);
    if (declarations.length <= 1) {
      return;
    }
    const t = Checker_getDeclaredTypeOfSymbol(receiver, symbol_);
    if (!Checker_areTypeParametersIdentical(receiver, declarations, InterfaceType_LocalTypeParameters(Type_AsInterfaceType(t)), (declaration) => Node_TypeParameters(declaration) ?? [])) {
      const name = Checker_symbolToString(receiver, symbol_);
      for (const declaration of declarations) {
        Checker_error(receiver, Node_Name(declaration), All_declarations_of_0_must_have_identical_type_parameters, name);
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.areTypeParametersIdentical","kind":"method","status":"implemented","sigHash":"e3a9b991f2321fca155e1dc770711ae577237296fc681460bdd7b0e871f86e02","bodyHash":"db246bb7149fb3e897bb85d6f764cd67740c91549f08d39dfc697feac609b883"}
 *
 * Go source:
 * func (c *Checker) areTypeParametersIdentical(declarations []*ast.Node, targetParameters []*Type, getTypeParameterDeclarations func(node *ast.Node) []*ast.Node) bool {
 * 	maxTypeArgumentCount := len(targetParameters)
 * 	minTypeArgumentCount := c.getMinTypeArgumentCount(targetParameters)
 * 	for _, declaration := range declarations {
 * 		// If this declaration has too few or too many type parameters, we report an error
 * 		sourceParameters := getTypeParameterDeclarations(declaration)
 * 		if len(sourceParameters) < minTypeArgumentCount || len(sourceParameters) > maxTypeArgumentCount {
 * 			return false
 * 		}
 * 		for i, source := range sourceParameters {
 * 			target := targetParameters[i]
 * 			// If the type parameter node does not have the same name as the resolved type
 * 			// parameter at this position, we report an error.
 * 			if source.Name().Text() != target.symbol.Name {
 * 				return false
 * 			}
 * 			// If the type parameter node does not have an identical constraintNode as the resolved
 * 			// type parameter at this position, we report an error.
 * 			constraintNode := source.AsTypeParameterDeclaration().Constraint
 * 			targetConstraint := c.getConstraintOfTypeParameter(target)
 * 			// relax check if later interface augmentation has no constraint, it's more broad and is OK to merge with
 * 			// a more constrained interface (this could be generalized to a full hierarchy check, but that's maybe overkill)
 * 			if constraintNode != nil && targetConstraint != nil && !c.isTypeIdenticalTo(c.getTypeFromTypeNode(constraintNode), targetConstraint) {
 * 				return false
 * 			}
 * 			// If the type parameter node has a default and it is not identical to the default
 * 			// for the type parameter at this position, we report an error.
 * 			defaultNode := source.AsTypeParameterDeclaration().DefaultType
 * 			targetDefault := c.getDefaultFromTypeParameter(target)
 * 			if defaultNode != nil && targetDefault != nil && !c.isTypeIdenticalTo(c.getTypeFromTypeNode(defaultNode), targetDefault) {
 * 				return false
 * 			}
 * 		}
 * 	}
 * 	return true
 * }
 */
export function Checker_areTypeParametersIdentical(receiver: GoPtr<Checker>, declarations: GoSlice<GoPtr<Node>>, targetParameters: GoSlice<GoPtr<Type>>, getTypeParameterDeclarations: (node: GoPtr<Node>) => GoSlice<GoPtr<Node>>): bool {
  const maxTypeArgumentCount = targetParameters.length;
  const minTypeArgumentCount = Checker_getMinTypeArgumentCount(receiver, targetParameters);
  for (const declaration of declarations) {
    const sourceParameters = getTypeParameterDeclarations(declaration);
    if (sourceParameters.length < minTypeArgumentCount || sourceParameters.length > maxTypeArgumentCount) {
      return false;
    }
    for (let i = 0; i < sourceParameters.length; i++) {
      const source = sourceParameters[i];
      const target = targetParameters[i];
      if (Node_Text(Node_Name(source)) !== target!.symbol!.Name) {
        return false;
      }
      const constraintNode = AsTypeParameterDeclaration(source)!.Constraint;
      const targetConstraint = Checker_getConstraintOfTypeParameter(receiver, target);
      if (constraintNode !== undefined && targetConstraint !== undefined && !Checker_isTypeIdenticalTo(receiver, Checker_getTypeFromTypeNode(receiver, constraintNode), targetConstraint)) {
        return false;
      }
      const defaultNode = AsTypeParameterDeclaration(source)!.DefaultType;
      const targetDefault = Checker_getDefaultFromTypeParameter(receiver, target);
      if (defaultNode !== undefined && targetDefault !== undefined && !Checker_isTypeIdenticalTo(receiver, Checker_getTypeFromTypeNode(receiver, defaultNode), targetDefault)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeWithoutSignatures","kind":"method","status":"implemented","sigHash":"5d30783d099102293b3748ac432439c3532f2e1e23028b45ef797a2456df33ac","bodyHash":"0d40f17fbdc033bc4b23bdbea2fc3d08a4d59ceb1bac30bd91a29e99e70bdc02"}
 *
 * Go source:
 * func (c *Checker) getTypeWithoutSignatures(t *Type) *Type {
 * 	switch {
 * 	case t.flags&TypeFlagsObject != 0:
 * 		resolved := c.resolveStructuredTypeMembers(t)
 * 		if len(resolved.signatures) != 0 {
 * 			result := c.newObjectType(ObjectFlagsAnonymous, t.symbol)
 * 			result.objectFlags |= ObjectFlagsMembersResolved
 * 			result.AsObjectType().members = resolved.members
 * 			result.AsObjectType().properties = resolved.properties
 * 			return result
 * 		}
 * 	case t.flags&TypeFlagsIntersection != 0:
 * 		return c.getIntersectionType(core.Map(t.AsIntersectionType().types, c.getTypeWithoutSignatures))
 * 	}
 * 	return t
 * }
 */
export function Checker_getTypeWithoutSignatures(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  if ((t!.flags & TypeFlagsObject) !== 0) {
    const resolved = Checker_resolveStructuredTypeMembers(receiver, t);
    if (resolved!.signatures.length !== 0) {
      const result = Checker_newObjectType(receiver, ObjectFlagsAnonymous, t!.symbol);
      result!.objectFlags |= ObjectFlagsMembersResolved;
      Type_AsObjectType(result)!.__tsgoEmbedded0!.members = resolved!.members;
      Type_AsObjectType(result)!.__tsgoEmbedded0!.properties = resolved!.properties;
      return result;
    }
  } else if ((t!.flags & TypeFlagsIntersection) !== 0) {
    return Checker_getIntersectionType(receiver, core.Map(Type_Types(t), (type_: GoPtr<Type>) => Checker_getTypeWithoutSignatures(receiver, type_)));
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkIndexConstraintForIndexSignature","kind":"method","status":"implemented","sigHash":"e3d2305fd7b80f6fcb0eaf35ee942d97acc8a2780f18bf2b197ed3cfe439621d","bodyHash":"f916daf6bff54bc688dcc65abccc7b677e006eaf48192ab6e75b668d05e61359"}
 *
 * Go source:
 * func (c *Checker) checkIndexConstraintForIndexSignature(t *Type, checkInfo *IndexInfo) {
 * 	declaration := checkInfo.declaration
 * 	indexInfos := c.getApplicableIndexInfos(t, checkInfo.keyType)
 * 	if len(indexInfos) == 0 {
 * 		return
 * 	}
 * 	var interfaceDeclaration *ast.Node
 * 	if t.objectFlags&ObjectFlagsInterface != 0 {
 * 		interfaceDeclaration = ast.GetDeclarationOfKind(t.symbol, ast.KindInterfaceDeclaration)
 * 	}
 * 	var localCheckDeclaration *ast.Node
 * 	if declaration != nil && c.getParentOfSymbol(c.getSymbolOfDeclaration(declaration)) == t.symbol {
 * 		localCheckDeclaration = declaration
 * 	}
 * 	for _, info := range indexInfos {
 * 		if info == checkInfo {
 * 			continue
 * 		}
 * 		var localIndexDeclaration *ast.Node
 * 		if info.declaration != nil && c.getParentOfSymbol(c.getSymbolOfDeclaration(info.declaration)) == t.symbol {
 * 			localIndexDeclaration = info.declaration
 * 		}
 * 		// We check only when (a) the check index signature is declared in the containing type, or (b) the applicable index
 * 		// signature is declared in the containing type, or (c) the containing type is an interface and no base interface contains
 * 		// both index signatures (i.e. the index signatures are declared in separate inherited interfaces).
 * 		errorNode := core.OrElse(localCheckDeclaration, localIndexDeclaration)
 * 		if errorNode == nil && interfaceDeclaration != nil && !core.Some(c.getBaseTypes(t), func(base *Type) bool {
 * 			return c.getIndexInfoOfType(base, checkInfo.keyType) != nil && c.getIndexTypeOfType(base, info.keyType) != nil
 * 		}) {
 * 			errorNode = interfaceDeclaration
 * 		}
 * 		if errorNode != nil && !c.isTypeAssignableTo(checkInfo.valueType, info.valueType) {
 * 			c.error(errorNode, diagnostics.X_0_index_type_1_is_not_assignable_to_2_index_type_3, c.TypeToString(checkInfo.keyType), c.TypeToString(checkInfo.valueType), c.TypeToString(info.keyType), c.TypeToString(info.valueType))
 * 		}
 * 	}
 * }
 */
export function Checker_checkIndexConstraintForIndexSignature(receiver: GoPtr<Checker>, t: GoPtr<Type>, checkInfo: GoPtr<IndexInfo>): void {
  const declaration = checkInfo!.declaration;
  const indexInfos = Checker_getApplicableIndexInfos(receiver, t, checkInfo!.keyType);
  if (indexInfos.length === 0) {
    return;
  }
  let interfaceDeclaration: GoPtr<Node>;
  if ((t!.objectFlags & ObjectFlagsInterface) !== 0) {
    interfaceDeclaration = GetDeclarationOfKind(t!.symbol, KindInterfaceDeclaration);
  }
  let localCheckDeclaration: GoPtr<Node>;
  if (declaration !== undefined && Checker_getParentOfSymbol(receiver, Checker_getSymbolOfDeclaration(receiver, declaration)) === t!.symbol) {
    localCheckDeclaration = declaration;
  }
  for (const info of indexInfos) {
    if (info === checkInfo) {
      continue;
    }
    let localIndexDeclaration: GoPtr<Node>;
    if (info!.declaration !== undefined && Checker_getParentOfSymbol(receiver, Checker_getSymbolOfDeclaration(receiver, info!.declaration)) === t!.symbol) {
      localIndexDeclaration = info!.declaration;
    }
    let errorNode = core.OrElse(localCheckDeclaration, localIndexDeclaration);
    if (errorNode === undefined && interfaceDeclaration !== undefined && !core.Some(Checker_getBaseTypes(receiver, t), (base: GoPtr<Type>): bool =>
      (Checker_getIndexInfoOfType(receiver, base, checkInfo!.keyType) !== undefined && Checker_getIndexTypeOfType(receiver, base, info!.keyType) !== undefined) as bool,
    )) {
      errorNode = interfaceDeclaration;
    }
    if (errorNode !== undefined && !Checker_isTypeAssignableTo(receiver, checkInfo!.valueType, info!.valueType)) {
      Checker_error(
        receiver,
        errorNode,
        X_0_index_type_1_is_not_assignable_to_2_index_type_3,
        Checker_TypeToString(receiver, checkInfo!.keyType),
        Checker_TypeToString(receiver, checkInfo!.valueType),
        Checker_TypeToString(receiver, info!.keyType),
        Checker_TypeToString(receiver, info!.valueType),
      );
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkClassOrInterfaceForDuplicateIndexSignatures","kind":"method","status":"implemented","sigHash":"fe6caf9d5762493cda36096b2daacce64ef80b2369e6f11d9a9ce0170b057586","bodyHash":"1085d02fabe5d72fb05c57b4762c5fa4e06b5e3c7056dd5862541fea1dc48058"}
 *
 * Go source:
 * func (c *Checker) checkClassOrInterfaceForDuplicateIndexSignatures(node *ast.Node) {
 * 	// Only check the type once
 * 	if links := c.declaredTypeLinks.Get(c.getSymbolOfDeclaration(node)); !links.indexSignaturesChecked {
 * 		links.indexSignaturesChecked = true
 * 		c.checkTypeForDuplicateIndexSignatures(node)
 * 	}
 * }
 */
export function Checker_checkClassOrInterfaceForDuplicateIndexSignatures(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const links = LinkStore_Get<GoPtr<Symbol>, DeclaredTypeLinks>(receiver!.declaredTypeLinks as LinkStore<GoPtr<Symbol>, DeclaredTypeLinks>, Checker_getSymbolOfDeclaration(receiver, node));
  if (!links!.indexSignaturesChecked) {
    links!.indexSignaturesChecked = true;
    Checker_checkTypeForDuplicateIndexSignatures(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTypeForDuplicateIndexSignatures","kind":"method","status":"implemented","sigHash":"4df2ab3d536108adc31c823d484c0e0755228e599b6b5d69ec19984f4a7ce8a3","bodyHash":"98d8c6240752d0f4730260d6d22876bdd99ec1799f94a7fdc2f15ec9f2c80675"}
 *
 * Go source:
 * func (c *Checker) checkTypeForDuplicateIndexSignatures(node *ast.Node) {
 * 	// TypeScript 1.0 spec (April 2014)
 * 	// 3.7.4: An object type can contain at most one string index signature and one numeric index signature.
 * 	// 8.5: A class declaration can have at most one string index member declaration and one numeric index member declaration
 * 	indexSymbol := c.getIndexSymbol(c.getSymbolOfDeclaration(node))
 * 	if indexSymbol == nil || len(indexSymbol.Declarations) <= 1 {
 * 		return
 * 	}
 * 	indexSignatureMap := make(map[*Type][]*ast.Node)
 * 	for _, declaration := range indexSymbol.Declarations {
 * 		if ast.IsIndexSignatureDeclaration(declaration) {
 * 			parameters := declaration.Parameters()
 * 			if len(parameters) == 1 && parameters[0].Type() != nil {
 * 				for _, t := range c.getTypeFromTypeNode(parameters[0].Type()).Distributed() {
 * 					indexSignatureMap[t] = append(indexSignatureMap[t], declaration)
 * 				}
 * 			}
 * 		}
 * 		// Do nothing for late-bound index signatures: allow these to duplicate one another and explicit indexes
 * 	}
 * 	for t, declarations := range indexSignatureMap {
 * 		if len(declarations) > 1 {
 * 			for _, declaration := range declarations {
 * 				c.error(declaration, diagnostics.Duplicate_index_signature_for_type_0, c.TypeToString(t))
 * 			}
 * 		}
 * 	}
 * }
 */
export function Checker_checkTypeForDuplicateIndexSignatures(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const indexSymbol = Checker_getIndexSymbol(receiver, Checker_getSymbolOfDeclaration(receiver, node));
  const indexDeclarations = indexSymbol?.Declarations ?? [];
  if (indexSymbol === undefined || indexDeclarations.length <= 1) {
    return;
  }
  const indexSignatureMap = new Map<GoPtr<Type>, GoSlice<GoPtr<Node>>>();
  for (const declaration of indexDeclarations) {
    if (IsIndexSignatureDeclaration(declaration)) {
      const parameters = Node_Parameters(declaration);
      if (parameters.length === 1 && Node_Type(parameters[0]) !== undefined) {
        for (const t of Type_Distributed(Checker_getTypeFromTypeNode(receiver, Node_Type(parameters[0])))) {
          indexSignatureMap.set(t, [...(indexSignatureMap.get(t) ?? []), declaration]);
        }
      }
    }
  }
  for (const [t, declarations] of indexSignatureMap) {
    if (declarations.length > 1) {
      for (const declaration of declarations) {
        Checker_error(receiver, declaration, Duplicate_index_signature_for_type_0, Checker_TypeToString(receiver, t));
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isPropertyInitializedInConstructor","kind":"method","status":"implemented","sigHash":"8f3b80d7dd926d45756da262af59834299e78350b71fa9aea50e77a4da08dc88","bodyHash":"0828a18d87d85e7b61dc401398bb8cf286460d35b043b4a03383a61426f5fa2e"}
 *
 * Go source:
 * func (c *Checker) isPropertyInitializedInConstructor(propName *ast.Node, propType *Type, constructor *ast.Node) bool {
 * 	var reference *ast.Node
 * 	if ast.IsComputedPropertyName(propName) {
 * 		reference = c.factory.NewElementAccessExpression(c.factory.NewKeywordExpression(ast.KindThisKeyword), nil, propName.Expression(), ast.NodeFlagsNone)
 * 	} else {
 * 		reference = c.factory.NewPropertyAccessExpression(c.factory.NewKeywordExpression(ast.KindThisKeyword), nil, propName, ast.NodeFlagsNone)
 * 	}
 * 	reference.Expression().Parent = reference
 * 	reference.Parent = constructor
 * 	reference.FlowNodeData().FlowNode = constructor.AsConstructorDeclaration().ReturnFlowNode
 * 	flowType := c.getFlowTypeOfReferenceEx(reference, propType, c.getOptionalType(propType, false), nil, nil)
 * 	return !c.containsUndefinedType(flowType)
 * }
 */
export function Checker_isPropertyInitializedInConstructor(receiver: GoPtr<Checker>, propName: GoPtr<Node>, propType: GoPtr<Type>, constructor_: GoPtr<Node>): bool {
  let reference: GoPtr<Node>;
  if (IsComputedPropertyName(propName)) {
    reference = NewElementAccessExpression(receiver!.factory, NewKeywordExpression(receiver!.factory, KindThisKeyword) as GoPtr<Expression>, undefined, Node_Expression(propName), NodeFlagsNone);
  } else {
    reference = NewPropertyAccessExpression(receiver!.factory, NewKeywordExpression(receiver!.factory, KindThisKeyword) as GoPtr<Expression>, undefined, propName, NodeFlagsNone);
  }
  Node_Expression(reference)!.Parent = reference;
  reference!.Parent = constructor_;
  (Node_FlowNodeData(reference) as unknown as { FlowNode: GoPtr<FlowNode> }).FlowNode = (AsConstructorDeclaration(constructor_) as unknown as Record<string, GoPtr<FlowNode>>)["ReturnFlowNode"];
  const flowType = Checker_getFlowTypeOfReferenceEx(receiver, reference, propType, Checker_getOptionalType(receiver, propType, false), undefined, undefined);
  return !Checker_containsUndefinedType(receiver, flowType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIterationTypeOfGeneratorFunctionReturnType","kind":"method","status":"implemented","sigHash":"5b6376ea27438695442b4af0e6b6bd45dd69f080fa801e041c1b74dbad030df9","bodyHash":"cfa6197970e37c018b5a732a21680d76ec727d79a031c474872e55c8ab356218"}
 *
 * Go source:
 * func (c *Checker) getIterationTypeOfGeneratorFunctionReturnType(typeKind IterationTypeKind, returnType *Type, isAsyncGenerator bool) *Type {
 * 	if IsTypeAny(returnType) {
 * 		return nil
 * 	}
 * 	iterationTypes := c.getIterationTypesOfGeneratorFunctionReturnType(returnType, isAsyncGenerator)
 * 	return iterationTypes.getType(typeKind)
 * }
 */
export function Checker_getIterationTypeOfGeneratorFunctionReturnType(receiver: GoPtr<Checker>, typeKind: IterationTypeKind, returnType: GoPtr<Type>, isAsyncGenerator: bool): GoPtr<Type> {
  if (IsTypeAny(returnType)) {
    return undefined;
  }
  const iterationTypes = Checker_getIterationTypesOfGeneratorFunctionReturnType(receiver, returnType, isAsyncGenerator);
  return IterationTypes_getType(iterationTypes, typeKind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIterationTypesOfGeneratorFunctionReturnType","kind":"method","status":"implemented","sigHash":"e6a1d1153c5904db2858682ff86ad002b5cedc1b85bc58da557a2360428590e6","bodyHash":"4a7bb2a2b29dfdae07b144adf550ab55bff4e6ebe24dc41214946692a97b46cc"}
 *
 * Go source:
 * func (c *Checker) getIterationTypesOfGeneratorFunctionReturnType(t *Type, isAsyncGenerator bool) IterationTypes {
 * 	if IsTypeAny(t) {
 * 		return IterationTypes{c.anyType, c.anyType, c.anyType}
 * 	}
 * 	use := core.IfElse(isAsyncGenerator, IterationUseAsyncGeneratorReturnType, IterationUseGeneratorReturnType)
 * 	resolver := core.IfElse(isAsyncGenerator, c.asyncIterationTypesResolver, c.syncIterationTypesResolver)
 * 	result := c.getIterationTypesOfIterable(t, use, nil /*errorNode* /)
 * 	if result.hasTypes() {
 * 		return result
 * 	}
 * 	return c.getIterationTypesOfIterator(t, resolver, nil /*errorNode* /, nil /*diagnosticOutput* /)
 * }
 */
export function Checker_getIterationTypesOfGeneratorFunctionReturnType(receiver: GoPtr<Checker>, t: GoPtr<Type>, isAsyncGenerator: bool): IterationTypes {
  if (IsTypeAny(t)) {
    return { yieldType: receiver!.anyType, returnType: receiver!.anyType, nextType: receiver!.anyType };
  }
  const use = core.IfElse(isAsyncGenerator, IterationUseAsyncGeneratorReturnType, IterationUseGeneratorReturnType);
  const resolver = core.IfElse(isAsyncGenerator, receiver!.asyncIterationTypesResolver, receiver!.syncIterationTypesResolver);
  const result = Checker_getIterationTypesOfIterable(receiver, t, use, undefined);
  if (IterationTypes_hasTypes(result)) {
    return result;
  }
  return Checker_getIterationTypesOfIterator(receiver, t, resolver, undefined, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getBuiltinIteratorReturnType","kind":"method","status":"implemented","sigHash":"7ce2a1bb8d97fc6c15141b53264a370a1cbab6331ee8caaf85409040679aa1c8","bodyHash":"9ff3cd319d7ad77a803309d111442fb81a36a0c0768f8c9ee98a3d06ad653177"}
 *
 * Go source:
 * func (c *Checker) getBuiltinIteratorReturnType() *Type {
 * 	return core.IfElse(c.strictBuiltinIteratorReturn, c.undefinedType, c.anyType)
 * }
 */
export function Checker_getBuiltinIteratorReturnType(receiver: GoPtr<Checker>): GoPtr<Type> {
  return core.IfElse(receiver!.strictBuiltinIteratorReturn, receiver!.undefinedType, receiver!.anyType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTypeParameters","kind":"method","status":"implemented","sigHash":"505712a390dc9a1e623e442ba068ac5422f2a1719b8cbb57c2b64a2eec75ec8c","bodyHash":"ab817d8640b147ef489b4da3ceda7e7d8e435315188337c5fadce4068365b896"}
 *
 * Go source:
 * func (c *Checker) checkTypeParameters(typeParameterDeclarations []*ast.Node) {
 * 	seenDefault := false
 * 	for i, node := range typeParameterDeclarations {
 * 		c.checkTypeParameter(node)
 * 		defaultTypeNode := node.AsTypeParameterDeclaration().DefaultType
 * 		if defaultTypeNode != nil {
 * 			seenDefault = true
 * 			c.checkTypeParametersNotReferenced(defaultTypeNode, typeParameterDeclarations, i)
 * 		} else if seenDefault {
 * 			c.error(node, diagnostics.Required_type_parameters_may_not_follow_optional_type_parameters)
 * 		}
 * 		for j := range i {
 * 			if typeParameterDeclarations[j].Symbol() == node.Symbol() {
 * 				c.error(node.Name(), diagnostics.Duplicate_identifier_0, scanner.DeclarationNameToString(node.Name()))
 * 			}
 * 		}
 * 	}
 * }
 */
export function Checker_checkTypeParameters(receiver: GoPtr<Checker>, typeParameterDeclarations: GoSlice<GoPtr<Node>>): void {
  let seenDefault = false;
  for (let i = 0; i < typeParameterDeclarations.length; i++) {
    const node = typeParameterDeclarations[i];
    Checker_checkTypeParameter(receiver, node);
    const defaultTypeNode = AsTypeParameterDeclaration(node)!.DefaultType;
    if (defaultTypeNode !== undefined) {
      seenDefault = true;
      Checker_checkTypeParametersNotReferenced(receiver, defaultTypeNode, typeParameterDeclarations, i);
    } else if (seenDefault) {
      Checker_error(receiver, node, Required_type_parameters_may_not_follow_optional_type_parameters);
    }
    for (let j = 0; j < i; j++) {
      if (Node_Symbol(typeParameterDeclarations[j]) === Node_Symbol(node)) {
        Checker_error(receiver, Node_Name(node), Duplicate_identifier_0, DeclarationNameToString(Node_Name(node)));
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTypeParametersNotReferenced","kind":"method","status":"implemented","sigHash":"faa67fc25cecb253a92539bd2392aca37b0a5aae48c874c34b590a96fa838a95","bodyHash":"5a421d216cdf5aa89c1ba67d3c74d25cdb947472e3a0e9ea40263f7bedb17d4c"}
 *
 * Go source:
 * func (c *Checker) checkTypeParametersNotReferenced(root *ast.Node, typeParameters []*ast.Node, index int) {
 * 	var visit func(*ast.Node) bool
 * 	visit = func(node *ast.Node) bool {
 * 		if ast.IsTypeReferenceNode(node) {
 * 			t := c.getTypeFromTypeReference(node)
 * 			if t.flags&TypeFlagsTypeParameter != 0 {
 * 				for i := index; i < len(typeParameters); i++ {
 * 					if t.symbol == c.getSymbolOfDeclaration(typeParameters[i]) {
 * 						c.error(node, diagnostics.Type_parameter_defaults_can_only_reference_previously_declared_type_parameters)
 * 					}
 * 				}
 * 			}
 * 		}
 * 		return node.ForEachChild(visit)
 * 	}
 * 	visit(root)
 * }
 */
export function Checker_checkTypeParametersNotReferenced(receiver: GoPtr<Checker>, root: GoPtr<Node>, typeParameters: GoSlice<GoPtr<Node>>, index: int): void {
  const visit = (node: GoPtr<Node>): bool => {
    if (IsTypeReferenceNode(node)) {
      const t = Checker_getTypeFromTypeReference(receiver, node);
      if ((t!.flags & TypeFlagsTypeParameter) !== 0) {
        for (let i = index; i < typeParameters.length; i++) {
          if (t!.symbol === Checker_getSymbolOfDeclaration(receiver, typeParameters[i])) {
            Checker_error(receiver, node, Type_parameter_defaults_can_only_reference_previously_declared_type_parameters);
          }
        }
      }
    }
    return Node_ForEachChild(node, visit);
  };
  visit(root);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkUnusedLocalsAndParameters","kind":"method","status":"implemented","sigHash":"f0ee324d76d3a40ed628a3719c51fc6c285f190086d7322f4e06ba21e7116d96","bodyHash":"199cc49586f318d260f5555e87a4788eb7b800d9d661575024220527c6b553f8"}
 *
 * Go source:
 * func (c *Checker) checkUnusedLocalsAndParameters(node *ast.Node) {
 * 	var variableParents collections.Set[*ast.Node]
 * 	var importClauses map[*ast.Node][]*ast.Node
 * 	for _, local := range node.Locals() {
 * 		referenceKinds := c.symbolReferenceLinks.Get(local).referenceKinds
 * 		if local.Flags&ast.SymbolFlagsTypeParameter != 0 && (local.Flags&ast.SymbolFlagsVariable == 0 || referenceKinds&ast.SymbolFlagsVariable != 0) ||
 * 			local.Flags&ast.SymbolFlagsTypeParameter == 0 && (referenceKinds != 0 || local.ExportSymbol != nil ||
 * 				local.Flags&ast.SymbolFlagsModuleExports != 0) {
 * 			continue
 * 		}
 * 		for _, declaration := range local.Declarations {
 * 			switch {
 * 			case ast.IsVariableDeclaration(declaration) || ast.IsParameterDeclaration(declaration) || ast.IsBindingElement(declaration):
 * 				variableParents.Add(ast.GetRootDeclaration(declaration).Parent)
 * 			case ast.IsImportClause(declaration) || ast.IsImportSpecifier(declaration) || ast.IsNamespaceImport(declaration):
 * 				if !isIdentifierThatStartsWithUnderscore(declaration.Name()) {
 * 					if importClauses == nil {
 * 						importClauses = make(map[*ast.Node][]*ast.Node)
 * 					}
 * 					importClause := importClauseFromImported(declaration)
 * 					importClauses[importClause] = append(importClauses[importClause], declaration)
 * 				}
 * 			default:
 * 				if !ast.IsTypeParameterDeclaration(declaration) && !ast.IsAmbientModule(declaration) {
 * 					c.reportUnusedLocal(declaration, ast.SymbolName(local))
 * 				}
 * 			}
 * 		}
 * 	}
 * 	for declaration := range variableParents.Keys() {
 * 		if ast.IsVariableDeclarationList(declaration) {
 * 			c.reportUnusedVariables(declaration)
 * 		} else {
 * 			c.reportUnusedParameters(declaration)
 * 		}
 * 	}
 * 	for declaration, unuseds := range importClauses {
 * 		c.reportUnusedImports(declaration, unuseds)
 * 	}
 * }
 */
export function Checker_checkUnusedLocalsAndParameters(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const variableParents = new globalThis.Set<GoPtr<Node>>();
  const importClauses = new globalThis.Map<GoPtr<Node>, GoSlice<GoPtr<Node>>>();
  for (const local of Node_Locals(node)?.values() ?? []) {
    const referenceKinds = (LinkStore_Get(receiver!.symbolReferenceLinks, local) as GoPtr<SymbolReferenceLinks>)!.referenceKinds ?? SymbolFlagsNone;
    if (((local!.Flags & SymbolFlagsTypeParameter) !== 0 && ((local!.Flags & SymbolFlagsVariable) === 0 || (referenceKinds & SymbolFlagsVariable) !== 0)) ||
      ((local!.Flags & SymbolFlagsTypeParameter) === 0 && (referenceKinds !== 0 || local!.ExportSymbol !== undefined || (local!.Flags & SymbolFlagsModuleExports) !== 0))) {
      continue;
    }
    for (const declaration of local!.Declarations ?? []) {
      if (IsVariableDeclaration(declaration) || IsParameterDeclaration(declaration) || IsBindingElement(declaration)) {
        variableParents.add(GetRootDeclaration(declaration)!.Parent);
      } else if (IsImportClause(declaration) || IsImportSpecifier(declaration) || IsNamespaceImport(declaration)) {
        if (!isIdentifierThatStartsWithUnderscore(Node_Name(declaration))) {
          const importClause = importClauseFromImported(declaration);
          const unuseds = importClauses.get(importClause);
          if (unuseds === undefined) {
            importClauses.set(importClause, [declaration]);
          } else {
            unuseds.push(declaration);
          }
        }
      } else if (!IsTypeParameterDeclaration(declaration) && !IsAmbientModule(declaration)) {
        Checker_reportUnusedLocal(receiver, declaration, SymbolName(local));
      }
    }
  }
  for (const declaration of variableParents.keys()) {
    if (IsVariableDeclarationList(declaration)) {
      Checker_reportUnusedVariables(receiver, declaration);
    } else {
      Checker_reportUnusedParameters(receiver, declaration);
    }
  }
  for (const [declaration, unuseds] of importClauses) {
    Checker_reportUnusedImports(receiver, declaration, unuseds);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reportUnusedParameters","kind":"method","status":"implemented","sigHash":"c9549c6d268577819cbe80d43c756c36423ca96001f9579e36a455dc1a6d2f35","bodyHash":"36f0201f16c5250efc005de6d797db0c5587657702dd05997043a79bb6122882"}
 *
 * Go source:
 * func (c *Checker) reportUnusedParameters(node *ast.Node) {
 * 	c.reportUnusedVariableDeclarations(node.Parameters())
 * }
 */
export function Checker_reportUnusedParameters(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  Checker_reportUnusedVariableDeclarations(receiver, Node_Parameters(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkUnusedInferTypeParameter","kind":"method","status":"implemented","sigHash":"4f74196346a558843da08ba5df4dd82c71c6d08326a973d58fcbf614167d562b","bodyHash":"4dce00e451d7575a66ca310244df6b3e1952e6e0435cebc3065e7542712f0849"}
 *
 * Go source:
 * func (c *Checker) checkUnusedInferTypeParameter(node *ast.Node) {
 * 	typeParameter := node.AsInferTypeNode().TypeParameter
 * 	if c.isUnreferencedTypeParameter(typeParameter) {
 * 		c.reportUnused(node, UnusedKindParameter, NewDiagnosticForNode(typeParameter.Name(), diagnostics.X_0_is_declared_but_never_used, typeParameter.Name().Text()))
 * 	}
 * }
 */
export function Checker_checkUnusedInferTypeParameter(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const typeParameter = AsInferTypeNode(node)!.TypeParameter;
  if (Checker_isUnreferencedTypeParameter(receiver, typeParameter)) {
    Checker_reportUnused(receiver, node, UnusedKindParameter, NewDiagnosticForNode(Node_Name(typeParameter), X_0_is_declared_but_never_used, Node_Text(Node_Name(typeParameter))));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkUnusedTypeParameters","kind":"method","status":"implemented","sigHash":"b6d8a4142285dae0d6b67e4e57ebfbb6555cd4e596e0ea9f7c959a3ae2157d2a","bodyHash":"9ad14d1eeabc0e0bdf23fc863b647af344390c0e8925b62351439912f2890e82"}
 *
 * Go source:
 * func (c *Checker) checkUnusedTypeParameters(node *ast.Node) {
 * 	if !allDeclarationsInSameSourceFile(c.getSymbolOfDeclaration(node)) {
 * 		return
 * 	}
 * 	typeParameterList := node.TypeParameterList()
 * 	if typeParameterList == nil {
 * 		return
 * 	}
 * 	if len(typeParameterList.Nodes) > 1 && core.Every(typeParameterList.Nodes, c.isUnreferencedTypeParameter) {
 * 		file := ast.GetSourceFileOfNode(node)
 * 		loc := rangeOfTypeParameters(file, typeParameterList)
 * 		c.reportUnused(node, UnusedKindParameter, ast.NewDiagnostic(file, loc, diagnostics.All_type_parameters_are_unused))
 * 	} else {
 * 		for _, typeParameter := range typeParameterList.Nodes {
 * 			if c.isUnreferencedTypeParameter(typeParameter) {
 * 				c.reportUnused(node, UnusedKindParameter, NewDiagnosticForNode(typeParameter, diagnostics.X_0_is_declared_but_never_used, typeParameter.Name().Text()))
 * 			}
 * 		}
 * 	}
 * }
 */
export function Checker_checkUnusedTypeParameters(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  if (!allDeclarationsInSameSourceFile(Checker_getSymbolOfDeclaration(receiver, node))) {
    return;
  }
  const typeParameterList = Node_TypeParameterList(node);
  if (typeParameterList === undefined) {
    return;
  }
  if (typeParameterList.Nodes.length > 1 && core.Every(typeParameterList.Nodes, (typeParameter) => Checker_isUnreferencedTypeParameter(receiver, typeParameter))) {
    const file = GetSourceFileOfNode(node);
    const loc = rangeOfTypeParameters(file, typeParameterList);
    Checker_reportUnused(receiver, node, UnusedKindParameter, NewDiagnostic(file, loc, All_type_parameters_are_unused));
  } else {
    for (const typeParameter of typeParameterList.Nodes) {
      if (Checker_isUnreferencedTypeParameter(receiver, typeParameter)) {
        Checker_reportUnused(receiver, node, UnusedKindParameter, NewDiagnosticForNode(typeParameter, X_0_is_declared_but_never_used, Node_Text(Node_Name(typeParameter))));
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isUnreferencedTypeParameter","kind":"method","status":"implemented","sigHash":"02ccf1180aad9dfe739ab1c9b2ebca4ae342168b613ad68c93aa57018ce72eeb","bodyHash":"df334365e5def8101766e09bef317c7494300ab5b4aaf953dc0601eff24ec77b"}
 *
 * Go source:
 * func (c *Checker) isUnreferencedTypeParameter(typeParameter *ast.Node) bool {
 * 	return c.symbolReferenceLinks.Get(c.getMergedSymbol(typeParameter.Symbol())).referenceKinds&ast.SymbolFlagsTypeParameter == 0 && !isIdentifierThatStartsWithUnderscore(typeParameter.Name())
 * }
 */
export function Checker_isUnreferencedTypeParameter(receiver: GoPtr<Checker>, typeParameter: GoPtr<Node>): bool {
  return ((LinkStore_Get<GoPtr<Symbol>, SymbolReferenceLinks>(receiver!.symbolReferenceLinks as LinkStore<GoPtr<Symbol>, SymbolReferenceLinks>, Checker_getMergedSymbol(receiver, Node_Symbol(typeParameter)))!.referenceKinds ?? SymbolFlagsNone) & SymbolFlagsTypeParameter) === 0 &&
    !isIdentifierThatStartsWithUnderscore(Node_Name(typeParameter));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getReturnTypeOfSingleNonGenericSignature","kind":"method","status":"implemented","sigHash":"634265b2499ff0fa08dbc9c77c54ac798489972178d50b9c61e24e01ad649a15","bodyHash":"638b1469094cea80ed0c485632e3d09bbb2c77df7dc4d1d1cf3e764208e2ab99"}
 *
 * Go source:
 * func (c *Checker) getReturnTypeOfSingleNonGenericSignature(funcType *Type, kind SignatureKind) *Type {
 * 	signature := c.getSingleSignature(funcType, kind, true /*allowMembers* /)
 * 	if signature != nil && len(signature.typeParameters) == 0 {
 * 		return c.getReturnTypeOfSignature(signature)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getReturnTypeOfSingleNonGenericSignature(receiver: GoPtr<Checker>, funcType: GoPtr<Type>, kind: SignatureKind): GoPtr<Type> {
  const signature = Checker_getSingleSignature(receiver, funcType, kind, true);
  if (signature !== undefined && signature!.typeParameters.length === 0) {
    return Checker_getReturnTypeOfSignature(receiver, signature);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getReturnTypeOfSingleNonGenericSignatureOfCallChain","kind":"method","status":"implemented","sigHash":"1545326b6ac4f232440c012950a3c5f61b4a1fceabe729404bf9f5323d89a672","bodyHash":"2dcb4df85a25800d7d07289d9b94865aaa38b2c563feef729c0c3e892dd93a1a"}
 *
 * Go source:
 * func (c *Checker) getReturnTypeOfSingleNonGenericSignatureOfCallChain(expr *ast.Node) *Type {
 * 	funcType := c.checkExpression(expr.Expression())
 * 	nonOptionalType := c.getOptionalExpressionType(funcType, expr.Expression())
 * 	returnType := c.getReturnTypeOfSingleNonGenericSignature(funcType, SignatureKindCall)
 * 	if returnType != nil {
 * 		return c.propagateOptionalTypeMarker(returnType, expr, nonOptionalType != funcType)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getReturnTypeOfSingleNonGenericSignatureOfCallChain(receiver: GoPtr<Checker>, expr: GoPtr<Node>): GoPtr<Type> {
  const expression = Node_Expression(expr);
  const funcType = Checker_checkExpression(receiver, expression);
  const nonOptionalType = Checker_getOptionalExpressionType(receiver, funcType, expression);
  const returnType = Checker_getReturnTypeOfSingleNonGenericSignature(receiver, funcType, SignatureKindCall);
  if (returnType !== undefined) {
    return Checker_propagateOptionalTypeMarker(receiver, returnType, expr, nonOptionalType !== funcType);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.instantiateTypeWithSingleGenericCallSignature","kind":"method","status":"implemented","sigHash":"b8376c4fb85c499c6c29aaf68c5562a54749f159b47f7ec3c6a98f323aa5c0fe","bodyHash":"567022ec30d09ae8efa198660203e1088b3cf83f046674e3867f57e62c470ceb"}
 *
 * Go source:
 * func (c *Checker) instantiateTypeWithSingleGenericCallSignature(node *ast.Node, t *Type, checkMode CheckMode) *Type {
 * 	if checkMode&(CheckModeInferential|CheckModeSkipGenericFunctions) == 0 {
 * 		return t
 * 	}
 * 	callSignature := c.getSingleSignature(t, SignatureKindCall, true /*allowMembers* /)
 * 	constructSignature := c.getSingleSignature(t, SignatureKindConstruct, true /*allowMembers* /)
 * 	signature := core.OrElse(callSignature, constructSignature)
 * 	if signature == nil || len(signature.typeParameters) == 0 {
 * 		return t
 * 	}
 * 	contextualType := c.getApparentTypeOfContextualType(node, ContextFlagsNoConstraints)
 * 	if contextualType == nil {
 * 		return t
 * 	}
 * 	contextualSignature := c.getSingleSignature(c.GetNonNullableType(contextualType), core.IfElse(callSignature != nil, SignatureKindCall, SignatureKindConstruct), false /*allowMembers* /)
 * 	if contextualSignature == nil || len(contextualSignature.typeParameters) != 0 {
 * 		return t
 * 	}
 * 	if checkMode&CheckModeSkipGenericFunctions != 0 {
 * 		c.skippedGenericFunction(node, checkMode)
 * 		return c.anyFunctionType
 * 	}
 * 	context := c.getInferenceContext(node)
 * 	// We have an expression that is an argument of a generic function for which we are performing
 * 	// type argument inference. The expression is of a function type with a single generic call
 * 	// signature and a contextual function type with a single non-generic call signature. Now check
 * 	// if the outer function returns a function type with a single non-generic call signature and
 * 	// if some of the outer function type parameters have no inferences so far. If so, we can
 * 	// potentially add inferred type parameters to the outer function return type.
 * 	var returnSignature *Signature
 * 	if context.signature != nil {
 * 		returnType := c.getReturnTypeOfSignature(context.signature)
 * 		if returnType != nil {
 * 			returnSignature = c.getSingleCallOrConstructSignature(returnType)
 * 		}
 * 	}
 * 	if returnSignature != nil && len(returnSignature.typeParameters) == 0 && !core.Every(context.inferences, hasInferenceCandidates) {
 * 		// Instantiate the signature with its own type parameters as type arguments, possibly
 * 		// renaming the type parameters to ensure they have unique names.
 * 		uniqueTypeParameters := c.getUniqueTypeParameters(context, signature.typeParameters)
 * 		instantiatedSignature := c.getSignatureInstantiationWithoutFillingInTypeArguments(signature, uniqueTypeParameters)
 * 		// Infer from the parameters of the instantiated signature to the parameters of the
 * 		// contextual signature starting with an empty set of inference candidates.
 * 		inferences := core.Map(context.inferences, func(info *InferenceInfo) *InferenceInfo {
 * 			return newInferenceInfo(info.typeParameter)
 * 		})
 * 		c.applyToParameterTypes(instantiatedSignature, contextualSignature, func(source *Type, target *Type) {
 * 			c.inferTypes(inferences, source, target, InferencePriorityNone, true /*contravariant* /)
 * 		})
 * 		if core.Some(inferences, hasInferenceCandidates) {
 * 			// We have inference candidates, indicating that one or more type parameters are referenced
 * 			// in the parameter types of the contextual signature. Now also infer from the return type.
 * 			c.applyToReturnTypes(instantiatedSignature, contextualSignature, func(source *Type, target *Type) {
 * 				c.inferTypes(inferences, source, target, InferencePriorityNone, false)
 * 			})
 * 			// If the type parameters for which we produced candidates do not have any inferences yet,
 * 			// we adopt the new inference candidates and add the type parameters of the expression type
 * 			// to the set of inferred type parameters for the outer function return type.
 * 			if !hasOverlappingInferences(context.inferences, inferences) {
 * 				c.mergeInferences(context.inferences, inferences)
 * 				context.inferredTypeParameters = core.Concatenate(context.inferredTypeParameters, uniqueTypeParameters)
 * 				return c.getOrCreateTypeFromSignature(instantiatedSignature)
 * 			}
 * 		}
 * 	}
 * 	// TODO: The signature may reference any outer inference contexts, but we map pop off and then apply new inference contexts,
 * 	// and thus get different inferred types. That this is cached on the *first* such attempt is not currently an issue, since expression
 * 	// types *also* get cached on the first pass. If we ever properly speculate, though, the cached "isolatedSignatureType" signature
 * 	// field absolutely needs to be included in the list of speculative caches.
 * 	return c.getOrCreateTypeFromSignature(c.instantiateSignatureInContextOf(signature, contextualSignature, context, nil))
 * }
 */
export function Checker_instantiateTypeWithSingleGenericCallSignature(receiver: GoPtr<Checker>, node: GoPtr<Node>, t: GoPtr<Type>, checkMode: CheckMode): GoPtr<Type> {
  if ((checkMode & (CheckModeInferential | CheckModeSkipGenericFunctions)) === 0) {
    return t;
  }
  const callSignature = Checker_getSingleSignature(receiver, t, SignatureKindCall, true);
  const constructSignature = Checker_getSingleSignature(receiver, t, SignatureKindConstruct, true);
  const signature = core.OrElse(callSignature, constructSignature);
  if (signature === undefined || signature!.typeParameters.length === 0) {
    return t;
  }
  const contextualType = Checker_getApparentTypeOfContextualType(receiver, node, ContextFlagsNoConstraints);
  if (contextualType === undefined) {
    return t;
  }
  const contextualSignature = Checker_getSingleSignature(receiver, Checker_GetNonNullableType(receiver, contextualType), callSignature !== undefined ? SignatureKindCall : SignatureKindConstruct, false);
  if (contextualSignature === undefined || contextualSignature!.typeParameters.length !== 0) {
    return t;
  }
  if ((checkMode & CheckModeSkipGenericFunctions) !== 0) {
    Checker_skippedGenericFunction(receiver, node, checkMode);
    return receiver!.anyFunctionType;
  }
  const context = Checker_getInferenceContext(receiver, node);
  let returnSignature: GoPtr<Signature>;
  if (context!.signature !== undefined) {
    const returnType = Checker_getReturnTypeOfSignature(receiver, context!.signature);
    if (returnType !== undefined) {
      returnSignature = Checker_getSingleCallOrConstructSignature(receiver, returnType);
    }
  }
  if (returnSignature !== undefined && returnSignature!.typeParameters.length === 0 && !core.Every(context!.inferences, hasInferenceCandidates)) {
    const uniqueTypeParameters = Checker_getUniqueTypeParameters(receiver, context, signature!.typeParameters);
    const instantiatedSignature = Checker_getSignatureInstantiationWithoutFillingInTypeArguments(receiver, signature, uniqueTypeParameters);
    const inferences = core.Map(context!.inferences, (info) => newInferenceInfo(info!.typeParameter));
    Checker_applyToParameterTypes(receiver, instantiatedSignature, contextualSignature, (source, target) => {
      Checker_inferTypes(receiver, inferences, source, target, InferencePriorityNone, true);
    });
    if (core.Some(inferences, hasInferenceCandidates)) {
      Checker_applyToReturnTypes(receiver, instantiatedSignature, contextualSignature, (source, target) => {
        Checker_inferTypes(receiver, inferences, source, target, InferencePriorityNone, false);
      });
      if (!hasOverlappingInferences(context!.inferences, inferences)) {
        Checker_mergeInferences(receiver, context!.inferences, inferences);
        context!.inferredTypeParameters = core.Concatenate(context!.inferredTypeParameters, uniqueTypeParameters);
        return Checker_getOrCreateTypeFromSignature(receiver, instantiatedSignature);
      }
    }
  }
  return Checker_getOrCreateTypeFromSignature(receiver, Checker_instantiateSignatureInContextOf(receiver, signature, contextualSignature, context, undefined));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getOuterInferenceTypeParameters","kind":"method","status":"implemented","sigHash":"d3dd0cc0f251d7a363d1528eaacd1a53b60d22fddc280838a080dafc88b97f9d","bodyHash":"6bf046ae2468e411711e3ce1a2e876fd7f8329ad395caf85de55eeb0fb82f079"}
 *
 * Go source:
 * func (c *Checker) getOuterInferenceTypeParameters() []*Type {
 * 	var result []*Type
 * 	for i := range c.inferenceContextInfos {
 * 		context := c.inferenceContextInfos[i].context
 * 		if context != nil {
 * 			for _, info := range context.inferences {
 * 				result = append(result, info.typeParameter)
 * 			}
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Checker_getOuterInferenceTypeParameters(receiver: GoPtr<Checker>): GoSlice<GoPtr<Type>> {
  let result: GoSlice<GoPtr<Type>> = [];
  for (let i = 0; i < receiver!.inferenceContextInfos.length; i++) {
    const context = receiver!.inferenceContextInfos[i]!.context;
    if (context !== undefined) {
      for (const info of context!.inferences) {
        result = [...result, info!.typeParameter];
      }
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getUniqueTypeParameters","kind":"method","status":"implemented","sigHash":"a8f6b7a7ba6f542459d9d14e38d9b94b70bbb7d6b677186930b0066041be13d4","bodyHash":"20f11181e84231a304325a8d5eb67cbdd94f8b009047352fb3816753347cdb4d"}
 *
 * Go source:
 * func (c *Checker) getUniqueTypeParameters(context *InferenceContext, typeParameters []*Type) []*Type {
 * 	var oldTypeParameters []*Type
 * 	var newTypeParameters []*Type
 * 	result := make([]*Type, 0, len(typeParameters))
 * 	for _, tp := range typeParameters {
 * 		name := tp.symbol.Name
 * 		if hasTypeParameterByName(context.inferredTypeParameters, name) || hasTypeParameterByName(result, name) {
 * 			newName := getUniqueTypeParameterName(core.Concatenate(context.inferredTypeParameters, result), name)
 * 			symbol := c.newSymbol(ast.SymbolFlagsTypeParameter, newName)
 * 			newTypeParameter := c.newTypeParameter(symbol)
 * 			newTypeParameter.AsTypeParameter().target = tp
 * 			oldTypeParameters = append(oldTypeParameters, tp)
 * 			newTypeParameters = append(newTypeParameters, newTypeParameter)
 * 			result = append(result, newTypeParameter)
 * 		} else {
 * 			result = append(result, tp)
 * 		}
 * 	}
 * 	if len(newTypeParameters) != 0 {
 * 		mapper := newTypeMapper(oldTypeParameters, newTypeParameters)
 * 		for _, tp := range newTypeParameters {
 * 			tp.AsTypeParameter().mapper = mapper
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Checker_getUniqueTypeParameters(receiver: GoPtr<Checker>, context: GoPtr<InferenceContext>, typeParameters: GoSlice<GoPtr<Type>>): GoSlice<GoPtr<Type>> {
  let oldTypeParameters: GoSlice<GoPtr<Type>> = [];
  let newTypeParameters: GoSlice<GoPtr<Type>> = [];
  let result: GoSlice<GoPtr<Type>> = [] as GoSlice<GoPtr<Type>>;
  for (const tp of (typeParameters ?? [])) {
    const name = tp!["symbol"]!.Name;
    if (hasTypeParameterByName(context!.inferredTypeParameters, name) || hasTypeParameterByName(result, name)) {
      const newName = getUniqueTypeParameterName(core.Concatenate(context!.inferredTypeParameters, result), name);
      const symbol_ = Checker_newSymbol(receiver, SymbolFlagsTypeParameter, newName);
      const newTypeParameter = Checker_newTypeParameter(receiver, symbol_);
      Type_AsTypeParameter(newTypeParameter)!.target = tp;
      oldTypeParameters = [...(oldTypeParameters ?? []), tp] as GoSlice<GoPtr<Type>>;
      newTypeParameters = [...(newTypeParameters ?? []), newTypeParameter] as GoSlice<GoPtr<Type>>;
      result = [...result, newTypeParameter] as GoSlice<GoPtr<Type>>;
    } else {
      result = [...result, tp] as GoSlice<GoPtr<Type>>;
    }
  }
  if ((newTypeParameters ?? []).length !== 0) {
    const mapper = newTypeMapper(oldTypeParameters!, newTypeParameters!);
    for (const tp of (newTypeParameters ?? [])) {
      Type_AsTypeParameter(tp)!.mapper = mapper;
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isInConstructorArgumentInitializer","kind":"method","status":"implemented","sigHash":"2ed887a4548993c664d9cf4eebbf23958e2b1784013ab6daf45dad9190ee80b6","bodyHash":"a805805ab424d9727a1eb04087af257d3fc3b1717265756dee071bb33c27d7bd"}
 *
 * Go source:
 * func (c *Checker) isInConstructorArgumentInitializer(node *ast.Node, constructorDecl *ast.Node) bool {
 * 	return ast.FindAncestorOrQuit(node, func(n *ast.Node) ast.FindAncestorResult {
 * 		if ast.IsFunctionLikeDeclaration(n) {
 * 			return ast.FindAncestorQuit
 * 		}
 * 		if ast.IsParameterDeclaration(n) && n.Parent == constructorDecl {
 * 			return ast.FindAncestorTrue
 * 		}
 * 		return ast.FindAncestorFalse
 * 	}) != nil
 * }
 */
export function Checker_isInConstructorArgumentInitializer(receiver: GoPtr<Checker>, node: GoPtr<Node>, constructorDecl: GoPtr<Node>): bool {
  return FindAncestorOrQuit(node, (n: GoPtr<Node>): FindAncestorResult => {
    if (IsFunctionLikeDeclaration(n)) {
      return FindAncestorQuit;
    }
    if (IsParameterDeclaration(n) && n!.Parent === constructorDecl) {
      return FindAncestorTrue;
    }
    return FindAncestorFalse;
  }) !== undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkImportCallExpression","kind":"method","status":"implemented","sigHash":"6ada5a782d519c0f6c50d7815b56e60ba99aec2e68d60b094f34b9cd1823f96a","bodyHash":"a4c3a7321bad901c451d376dbb3d3aff45099f8c0410332670657b58f7be7640"}
 *
 * Go source:
 * func (c *Checker) checkImportCallExpression(node *ast.Node) *Type {
 * 	// Check grammar of dynamic import
 * 	c.checkGrammarImportCallExpression(node)
 * 	args := node.Arguments()
 * 	if len(args) == 0 {
 * 		return c.createPromiseReturnType(node, c.anyType)
 * 	}
 * 	specifier := args[0]
 * 	specifierType := c.checkExpressionCached(specifier)
 * 	var optionsType *Type
 * 	if len(args) > 1 {
 * 		optionsType = c.checkExpressionCached(args[1])
 * 	}
 * 	// Even though multiple arguments is grammatically incorrect, type-check extra arguments for completion
 * 	for i := 2; i < len(args); i++ {
 * 		c.checkExpressionCached(args[i])
 * 	}
 * 	if specifierType.flags&TypeFlagsNullable != 0 || !c.isTypeAssignableTo(specifierType, c.stringType) {
 * 		c.error(specifier, diagnostics.Dynamic_import_s_specifier_must_be_of_type_string_but_here_has_type_0, c.TypeToString(specifierType))
 * 	}
 * 	if optionsType != nil {
 * 		importCallOptionsType := c.getGlobalImportCallOptionsTypeChecked()
 * 		if importCallOptionsType != c.emptyObjectType {
 * 			c.checkTypeAssignableTo(optionsType, c.getNullableType(importCallOptionsType, TypeFlagsUndefined), args[1], nil)
 * 		}
 * 		if ast.IsObjectLiteralExpression(args[1]) {
 * 			for _, prop := range args[1].AsObjectLiteralExpression().Properties.Nodes {
 * 				if ast.IsPropertyAssignment(prop) && ast.IsIdentifier(prop.Name()) && prop.Name().Text() == "assert" {
 * 					c.error(prop.Name(), diagnostics.Import_assertions_have_been_replaced_by_import_attributes_Use_with_instead_of_assert)
 * 					break
 * 				}
 * 			}
 * 		}
 * 	}
 * 	// resolveExternalModuleName will return undefined if the moduleReferenceExpression is not a string literal
 * 	moduleSymbol := c.resolveExternalModuleName(node, specifier, false /*ignoreErrors* /)
 * 	if moduleSymbol != nil {
 * 		esModuleSymbol := c.resolveExternalModuleSymbol(moduleSymbol, true /*dontResolveAlias* /)
 * 		if esModuleSymbol != nil {
 * 			syntheticType := c.getTypeWithSyntheticDefaultOnly(c.getTypeOfSymbol(esModuleSymbol), esModuleSymbol, moduleSymbol, specifier)
 * 			if syntheticType == nil {
 * 				syntheticType = c.getTypeWithSyntheticDefaultImportType(c.getTypeOfSymbol(esModuleSymbol), esModuleSymbol, moduleSymbol, specifier)
 * 			}
 * 			return c.createPromiseReturnType(node, syntheticType)
 * 		}
 * 	}
 * 	return c.createPromiseReturnType(node, c.anyType)
 * }
 */
export function Checker_checkImportCallExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  Checker_checkGrammarImportCallExpression(receiver, node);
  const args = Node_Arguments(node) ?? [];
  if (args.length === 0) {
    return Checker_createPromiseReturnType(receiver, node, receiver!.anyType);
  }
  const specifier = args[0];
  const specifierType = Checker_checkExpressionCached(receiver, specifier);
  let optionsType: GoPtr<Type>;
  if (args.length > 1) {
    optionsType = Checker_checkExpressionCached(receiver, args[1]);
  }
  for (let index = 2; index < args.length; index++) {
    Checker_checkExpressionCached(receiver, args[index]);
  }
  if ((specifierType!.flags & TypeFlagsNullable) !== 0 || !Checker_isTypeAssignableTo(receiver, specifierType, receiver!.stringType)) {
    Checker_error(receiver, specifier, Dynamic_import_s_specifier_must_be_of_type_string_but_here_has_type_0, Checker_TypeToString(receiver, specifierType));
  }
  if (optionsType !== undefined) {
    const importCallOptionsType = receiver!.getGlobalImportCallOptionsTypeChecked();
    if (importCallOptionsType !== receiver!.emptyObjectType) {
      Checker_checkTypeAssignableTo(receiver, optionsType, Checker_getNullableType(receiver, importCallOptionsType, TypeFlagsUndefined), args[1], undefined);
    }
    if (IsObjectLiteralExpression(args[1])) {
      for (const prop of Node_Properties(args[1]) ?? []) {
        const name = Node_Name(prop);
        if (IsPropertyAssignment(prop) && IsIdentifier(name) && Node_Text(name) === "assert") {
          Checker_error(receiver, name, Import_assertions_have_been_replaced_by_import_attributes_Use_with_instead_of_assert);
          break;
        }
      }
    }
  }
  const moduleSymbol = Checker_resolveExternalModuleName(receiver, node, specifier, false);
  if (moduleSymbol !== undefined) {
    const esModuleSymbol = Checker_resolveExternalModuleSymbol(receiver, moduleSymbol, true);
    if (esModuleSymbol !== undefined) {
      let syntheticType = Checker_getTypeWithSyntheticDefaultOnly(receiver, Checker_getTypeOfSymbol(receiver, esModuleSymbol), esModuleSymbol, moduleSymbol, specifier);
      if (syntheticType === undefined) {
        syntheticType = Checker_getTypeWithSyntheticDefaultImportType(receiver, Checker_getTypeOfSymbol(receiver, esModuleSymbol), esModuleSymbol, moduleSymbol, specifier);
      }
      return Checker_createPromiseReturnType(receiver, node, syntheticType);
    }
  }
  return Checker_createPromiseReturnType(receiver, node, receiver!.anyType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkCallExpression","kind":"method","status":"implemented","sigHash":"c7077a9359a5dabbb7b33b07409cf7ae319dc8d4ee9862f71076afb9296c19cc","bodyHash":"8d143d4d304de3843b2932373cebb5a3e5a974a05b6bbf1f1e0ea960bebc8d4e"}
 *
 * Go source:
 * func (c *Checker) checkCallExpression(node *ast.Node, checkMode CheckMode) *Type {
 * 	c.checkGrammarTypeArguments(node, node.TypeArgumentList())
 * 	signature := c.getResolvedSignature(node, nil /*candidatesOutArray* /, checkMode)
 * 	if signature == c.resolvingSignature {
 * 		// CheckMode.SkipGenericFunctions is enabled and this is a call to a generic function that
 * 		// returns a function type. We defer checking and return silentNeverType.
 * 		return c.silentNeverType
 * 	}
 * 	c.checkDeprecatedSignature(signature, node)
 * 	if node.Expression().Kind == ast.KindSuperKeyword {
 * 		return c.voidType
 * 	}
 * 	if ast.IsNewExpression(node) {
 * 		declaration := signature.declaration
 * 		if declaration != nil && !ast.IsConstructorDeclaration(declaration) && !ast.IsConstructSignatureDeclaration(declaration) && !ast.IsConstructorTypeNode(declaration) {
 * 			// When resolved signature is a call signature (and not a construct signature) the result type is any
 * 			if c.noImplicitAny {
 * 				c.error(node, diagnostics.X_new_expression_whose_target_lacks_a_construct_signature_implicitly_has_an_any_type)
 * 			}
 * 			return c.anyType
 * 		}
 * 	}
 * 	if ast.IsInJSFile(node) && c.isCommonJSRequire(node) {
 * 		return c.resolveExternalModuleTypeByLiteral(node.Arguments()[0])
 * 	}
 * 	returnType := c.getReturnTypeOfSignature(signature)
 * 	// Treat any call to the global 'Symbol' function that is part of a const variable or readonly property
 * 	// as a fresh unique symbol literal type.
 * 	if returnType.flags&TypeFlagsESSymbolLike != 0 && c.isSymbolOrSymbolForCall(node) {
 * 		return c.getESSymbolLikeTypeForNode(ast.WalkUpParenthesizedExpressions(node.Parent))
 * 	}
 * 	if ast.IsCallExpression(node) && node.QuestionDotToken() == nil && ast.IsExpressionStatement(node.Parent) && returnType.flags&TypeFlagsVoid != 0 && c.getTypePredicateOfSignature(signature) != nil {
 * 		if !ast.IsDottedName(node.Expression()) {
 * 			c.error(node.Expression(), diagnostics.Assertions_require_the_call_target_to_be_an_identifier_or_qualified_name)
 * 		} else if c.getEffectsSignature(node) == nil {
 * 			diagnostic := c.error(node.Expression(), diagnostics.Assertions_require_every_name_in_the_call_target_to_be_declared_with_an_explicit_type_annotation)
 * 			c.getTypeOfDottedName(node.Expression(), diagnostic)
 * 		}
 * 	}
 * 	return returnType
 * }
 */
export function Checker_checkCallExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  Checker_checkGrammarTypeArguments(receiver, node, Node_TypeArgumentList(node));
  const signature = Checker_getResolvedSignature(receiver, node, undefined, checkMode);
  if (signature === receiver!.resolvingSignature) {
    return receiver!.silentNeverType;
  }
  Checker_checkDeprecatedSignature(receiver, signature, node);
  if (Node_Expression(node)!.Kind === KindSuperKeyword) {
    return receiver!.voidType;
  }
  if (IsNewExpression(node)) {
    const declaration = signature!.declaration;
    if (declaration !== undefined && !IsConstructorDeclaration(declaration) && !IsConstructSignatureDeclaration(declaration) && !IsConstructorTypeNode(declaration)) {
      if (receiver!.noImplicitAny) {
        Checker_error(receiver, node, X_new_expression_whose_target_lacks_a_construct_signature_implicitly_has_an_any_type);
      }
      return receiver!.anyType;
    }
  }
  if (IsInJSFile(node) && Checker_isCommonJSRequire(receiver, node)) {
    return Checker_resolveExternalModuleTypeByLiteral(receiver, (Node_Arguments(node) ?? [])[0]);
  }
  const returnType = Checker_getReturnTypeOfSignature(receiver, signature);
  if ((returnType!.flags & TypeFlagsESSymbolLike) !== 0 && Checker_isSymbolOrSymbolForCall(receiver, node)) {
    return Checker_getESSymbolLikeTypeForNode(receiver, WalkUpParenthesizedExpressions(node!.Parent as GoPtr<Expression>));
  }
  if (IsCallExpression(node) && Node_QuestionDotToken(node) === undefined && IsExpressionStatement(node!.Parent) && (returnType!.flags & TypeFlagsVoid) !== 0 && Checker_getTypePredicateOfSignature(receiver, signature) !== undefined) {
    if (!IsDottedName(Node_Expression(node))) {
      Checker_error(receiver, Node_Expression(node), Assertions_require_the_call_target_to_be_an_identifier_or_qualified_name);
    } else if (Checker_getEffectsSignature(receiver, node) === undefined) {
      const diagnostic = Checker_error(receiver, Node_Expression(node), Assertions_require_every_name_in_the_call_target_to_be_declared_with_an_explicit_type_annotation);
      Checker_getTypeOfDottedName(receiver, Node_Expression(node), diagnostic);
    }
  }
  return returnType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isSymbolOrSymbolForCall","kind":"method","status":"implemented","sigHash":"97c1f029804c5ad9117ef305bc1e441ab0306b099cb4b93af1f6f8d0789ba8af","bodyHash":"19404954be40bd312bbc9d57f6024aa9975825dd94b76b2fcd300d5e5a022d48"}
 *
 * Go source:
 * func (c *Checker) isSymbolOrSymbolForCall(node *ast.Node) bool {
 * 	if !ast.IsCallExpression(node) {
 * 		return false
 * 	}
 * 	left := node.Expression()
 * 	if ast.IsPropertyAccessExpression(left) && left.Name().Text() == "for" {
 * 		left = left.Expression()
 * 	}
 * 	if !ast.IsIdentifier(left) || left.Text() != "Symbol" {
 * 		return false
 * 	}
 * 	// make sure `Symbol` is the global symbol
 * 	globalESSymbol := c.getGlobalESSymbolConstructorSymbolOrNil()
 * 	if globalESSymbol == nil {
 * 		return false
 * 	}
 * 	return globalESSymbol == c.resolveName(left, "Symbol", ast.SymbolFlagsValue, nil /*nameNotFoundMessage* /, false /*isUse* /, false)
 * }
 */
export function Checker_isSymbolOrSymbolForCall(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (!IsCallExpression(node)) {
    return false;
  }
  let left = Node_Expression(node);
  if (IsPropertyAccessExpression(left) && Node_Text(Node_Name(left)) === "for") {
    left = Node_Expression(left);
  }
  if (!IsIdentifier(left) || Node_Text(left) !== "Symbol") {
    return false;
  }
  const globalESSymbol = receiver!.getGlobalESSymbolConstructorSymbolOrNil();
  if (globalESSymbol === undefined) {
    return false;
  }
  return globalESSymbol === receiver!.resolveName(left, "Symbol", SymbolFlagsValue, undefined, false, false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getResolvedSignature","kind":"method","status":"implemented","sigHash":"6e07804e3f703a58b1aa0928481fd12ea132aadd55c97ab134180b75f6514591","bodyHash":"74d5204a564f7e9db52bc5cb606cb05647d136732d76b5ef07aeb9e879c450c0"}
 *
 * Go source:
 * func (c *Checker) getResolvedSignature(node *ast.Node, candidatesOutArray *[]*Signature, checkMode CheckMode) *Signature {
 * 	links := c.signatureLinks.Get(node)
 * 	// If getResolvedSignature has already been called, we will have cached the resolvedSignature.
 * 	// However, it is possible that either candidatesOutArray was not passed in the first time,
 * 	// or that a different candidatesOutArray was passed in. Therefore, we need to redo the work
 * 	// to correctly fill the candidatesOutArray.
 * 	cached := links.resolvedSignature
 * 	if cached != nil && cached != c.resolvingSignature && candidatesOutArray == nil {
 * 		return cached
 * 	}
 * 	saveResolutionStart := c.resolutionStart
 * 	if cached == nil {
 * 		// If we haven't already done so, temporarily reset the resolution stack. This allows us to
 * 		// handle "inverted" situations where, for example, an API client asks for the type of a symbol
 * 		// containined in a function call argument whose contextual type depends on the symbol itself
 * 		// through resolution of the containing function call. By resetting the resolution stack we'll
 * 		// retry the symbol type resolution with the resolvingSignature marker in place to suppress
 * 		// the contextual type circularity.
 * 		c.resolutionStart = len(c.typeResolutions)
 * 	}
 * 	links.resolvedSignature = c.resolvingSignature
 * 	result := c.resolveSignature(node, candidatesOutArray, checkMode)
 * 	c.resolutionStart = saveResolutionStart
 * 	// When CheckMode.SkipGenericFunctions is set we use resolvingSignature to indicate that call
 * 	// resolution should be deferred.
 * 	if result != c.resolvingSignature {
 * 		// if the signature resolution originated on a node that itself depends on the contextual type
 * 		// then it's possible that the resolved signature might not be the same as the one that would be computed in source order
 * 		// since resolving such signature leads to resolving the potential outer signature, its arguments and thus the very same signature
 * 		// it's possible that this inner resolution sets the resolvedSignature first.
 * 		// In such a case we ignore the local result and reuse the correct one that was cached.
 * 		if links.resolvedSignature != c.resolvingSignature {
 * 			result = links.resolvedSignature
 * 		}
 * 		// If signature resolution originated in control flow type analysis (for example to compute the
 * 		// assigned type in a flow assignment) we don't cache the result as it may be based on temporary
 * 		// types from the control flow analysis.
 * 		if len(c.flowLoopStack) == 0 {
 * 			links.resolvedSignature = result
 * 		} else {
 * 			links.resolvedSignature = cached
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Checker_getResolvedSignature(receiver: GoPtr<Checker>, node: GoPtr<Node>, candidatesOutArray: GoPtr<GoSlice<GoPtr<Signature>>>, checkMode: CheckMode): GoPtr<Signature> {
  const links = LinkStore_Get(receiver!.signatureLinks, node) as GoPtr<SignatureLinks>;
  const cached = links!.resolvedSignature;
  if (cached !== undefined && cached !== receiver!.resolvingSignature && candidatesOutArray === undefined) {
    return cached;
  }
  const saveResolutionStart = receiver!.resolutionStart;
  if (cached === undefined) {
    receiver!.resolutionStart = receiver!.typeResolutions.length;
  }
  links!.resolvedSignature = receiver!.resolvingSignature;
  let result = Checker_resolveSignature(receiver, node, candidatesOutArray, checkMode);
  receiver!.resolutionStart = saveResolutionStart;
  if (result !== receiver!.resolvingSignature) {
    if (links!.resolvedSignature !== receiver!.resolvingSignature) {
      result = links!.resolvedSignature;
    }
    if (receiver!.flowLoopStack.length === 0) {
      links!.resolvedSignature = result;
    } else {
      links!.resolvedSignature = cached;
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveSignature","kind":"method","status":"implemented","sigHash":"3f5f24d8b322f3d2262569dc0fad3eb979984d3500a3322bee3b45508bd47345","bodyHash":"03f051b64a78b179daad017cbd3815451b58a183c849bc42a6a4be0c48e8d1fc"}
 *
 * Go source:
 * func (c *Checker) resolveSignature(node *ast.Node, candidatesOutArray *[]*Signature, checkMode CheckMode) *Signature {
 * 	switch node.Kind {
 * 	case ast.KindCallExpression:
 * 		return c.resolveCallExpression(node, candidatesOutArray, checkMode)
 * 	case ast.KindNewExpression:
 * 		return c.resolveNewExpression(node, candidatesOutArray, checkMode)
 * 	case ast.KindTaggedTemplateExpression:
 * 		return c.resolveTaggedTemplateExpression(node, candidatesOutArray, checkMode)
 * 	case ast.KindDecorator:
 * 		return c.resolveDecorator(node, candidatesOutArray, checkMode)
 * 	case ast.KindJsxOpeningFragment, ast.KindJsxOpeningElement, ast.KindJsxSelfClosingElement:
 * 		return c.resolveJsxOpeningLikeElement(node, candidatesOutArray, checkMode)
 * 	case ast.KindBinaryExpression:
 * 		return c.resolveInstanceofExpression(node, candidatesOutArray, checkMode)
 * 	}
 * 	panic("Unhandled case in resolveSignature")
 * }
 */
export function Checker_resolveSignature(receiver: GoPtr<Checker>, node: GoPtr<Node>, candidatesOutArray: GoPtr<GoSlice<GoPtr<Signature>>>, checkMode: CheckMode): GoPtr<Signature> {
  switch (node!.Kind) {
    case KindCallExpression:
      return Checker_resolveCallExpression(receiver, node, candidatesOutArray, checkMode);
    case KindNewExpression:
      return Checker_resolveNewExpression(receiver, node, candidatesOutArray, checkMode);
    case KindTaggedTemplateExpression:
      return Checker_resolveTaggedTemplateExpression(receiver, node, candidatesOutArray, checkMode);
    case KindDecorator:
      return Checker_resolveDecorator(receiver, node, candidatesOutArray, checkMode);
    case KindJsxOpeningFragment:
    case KindJsxOpeningElement:
    case KindJsxSelfClosingElement:
      return Checker_resolveJsxOpeningLikeElement(receiver, node, candidatesOutArray, checkMode);
    case KindBinaryExpression:
      return Checker_resolveInstanceofExpression(receiver, node, candidatesOutArray, checkMode);
  }
  throw new globalThis.Error("Unhandled case in resolveSignature");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveCallExpression","kind":"method","status":"implemented","sigHash":"c7b5867f2eec833277bb9e32e3697824bf56540407f05569487a0dd36b4f8c44","bodyHash":"d87dbfc01174633f6433c6757d42df9f282813404bf8abc125f7522f1d37d991"}
 *
 * Go source:
 * func (c *Checker) resolveCallExpression(node *ast.Node, candidatesOutArray *[]*Signature, checkMode CheckMode) *Signature {
 * 	if node.Expression().Kind == ast.KindSuperKeyword {
 * 		superType := c.checkSuperExpression(node.Expression())
 * 		if IsTypeAny(superType) {
 * 			for _, arg := range node.Arguments() {
 * 				// Still visit arguments so they get marked for visibility, etc
 * 				c.checkExpression(arg)
 * 			}
 * 			return c.anySignature
 * 		}
 * 		if !c.isErrorType(superType) {
 * 			// In super call, the candidate signatures are the matching arity signatures of the base constructor function instantiated
 * 			// with the type arguments specified in the extends clause.
 * 			baseTypeNode := ast.GetExtendsHeritageClauseElement(ast.GetContainingClass(node))
 * 			if baseTypeNode != nil {
 * 				baseConstructors := c.getInstantiatedConstructorsForTypeArguments(superType, baseTypeNode.TypeArguments(), baseTypeNode)
 * 				return c.resolveCall(node, baseConstructors, candidatesOutArray, checkMode, SignatureFlagsNone, nil)
 * 			}
 * 		}
 * 		return c.resolveUntypedCall(node)
 * 	}
 * 	var callChainFlags SignatureFlags
 * 	funcType := c.checkExpression(node.Expression())
 * 	if isCallChain(node) {
 * 		nonOptionalType := c.getOptionalExpressionType(funcType, node.Expression())
 * 		switch {
 * 		case nonOptionalType == funcType:
 * 			callChainFlags = SignatureFlagsNone
 * 		case ast.IsOutermostOptionalChain(node):
 * 			callChainFlags = SignatureFlagsIsOuterCallChain
 * 		default:
 * 			callChainFlags = SignatureFlagsIsInnerCallChain
 * 		}
 * 		funcType = nonOptionalType
 * 	} else {
 * 		callChainFlags = SignatureFlagsNone
 * 	}
 * 	funcType = c.checkNonNullTypeWithReporter(funcType, node.Expression(), (*Checker).reportCannotInvokePossiblyNullOrUndefinedError)
 * 	if funcType == c.silentNeverType {
 * 		return c.silentNeverSignature
 * 	}
 * 	apparentType := c.getApparentType(funcType)
 * 	if c.isErrorType(apparentType) {
 * 		// Another error has already been reported
 * 		return c.resolveErrorCall(node)
 * 	}
 * 	// Technically, this signatures list may be incomplete. We are taking the apparent type,
 * 	// but we are not including call signatures that may have been added to the Object or
 * 	// Function interface, since they have none by default. This is a bit of a leap of faith
 * 	// that the user will not add any.
 * 	callSignatures := c.getSignaturesOfType(apparentType, SignatureKindCall)
 * 	numConstructSignatures := len(c.getSignaturesOfType(apparentType, SignatureKindConstruct))
 * 	// TS 1.0 Spec: 4.12
 * 	// In an untyped function call no TypeArgs are permitted, Args can be any argument list, no contextual
 * 	// types are provided for the argument expressions, and the result is always of type Any.
 * 	if c.isUntypedFunctionCall(funcType, apparentType, len(callSignatures), numConstructSignatures) {
 * 		// The unknownType indicates that an error already occurred (and was reported).  No
 * 		// need to report another error in this case.
 * 		if !c.isErrorType(funcType) && node.TypeArguments() != nil {
 * 			c.error(node, diagnostics.Untyped_function_calls_may_not_accept_type_arguments)
 * 		}
 * 		return c.resolveUntypedCall(node)
 * 	}
 * 	// If FuncExpr's apparent type(section 3.8.1) is a function type, the call is a typed function call.
 * 	// TypeScript employs overload resolution in typed function calls in order to support functions
 * 	// with multiple call signatures.
 * 	if len(callSignatures) == 0 {
 * 		if numConstructSignatures != 0 {
 * 			c.error(node, diagnostics.Value_of_type_0_is_not_callable_Did_you_mean_to_include_new, c.TypeToString(funcType))
 * 		} else {
 * 			var relatedInformation *ast.Diagnostic
 * 			if len(node.Arguments()) == 1 {
 * 				text := ast.GetSourceFileOfNode(node).Text()
 * 				options := scanner.SkipTriviaOptions{StopAfterLineBreak: true}
 * 				if stringutil.IsLineBreak(rune(text[scanner.SkipTriviaEx(text, node.Expression().End(), &options)-1])) {
 * 					relatedInformation = createDiagnosticForNode(node.Expression(), diagnostics.Are_you_missing_a_semicolon)
 * 				}
 * 			}
 * 			c.invocationError(node.Expression(), apparentType, SignatureKindCall, relatedInformation)
 * 		}
 * 		return c.resolveErrorCall(node)
 * 	}
 * 	// When a call to a generic function is an argument to an outer call to a generic function for which
 * 	// inference is in process, we have a choice to make. If the inner call relies on inferences made from
 * 	// its contextual type to its return type, deferring the inner call processing allows the best possible
 * 	// contextual type to accumulate. But if the outer call relies on inferences made from the return type of
 * 	// the inner call, the inner call should be processed early. There's no sure way to know which choice is
 * 	// right (only a full unification algorithm can determine that), so we resort to the following heuristic:
 * 	// If no type arguments are specified in the inner call and at least one call signature is generic and
 * 	// returns a function type, we choose to defer processing. This narrowly permits function composition
 * 	// operators to flow inferences through return types, but otherwise processes calls right away. We
 * 	// use the resolvingSignature singleton to indicate that we deferred processing. This result will be
 * 	// propagated out and eventually turned into silentNeverType (a type that is assignable to anything and
 * 	// from which we never make inferences).
 * 	if checkMode&CheckModeSkipGenericFunctions != 0 && len(node.TypeArguments()) == 0 && core.Some(callSignatures, c.isGenericFunctionReturningFunction) {
 * 		c.skippedGenericFunction(node, checkMode)
 * 		return c.resolvingSignature
 * 	}
 * 	return c.resolveCall(node, callSignatures, candidatesOutArray, checkMode, callChainFlags, nil)
 * }
 */
export function Checker_resolveCallExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>, candidatesOutArray: GoPtr<GoSlice<GoPtr<Signature>>>, checkMode: CheckMode): GoPtr<Signature> {
  if (Node_Expression(node)!.Kind === KindSuperKeyword) {
    const superType = Checker_checkSuperExpression(receiver, Node_Expression(node));
    if (IsTypeAny(superType)) {
      for (const arg of Node_Arguments(node) ?? []) {
        Checker_checkExpression(receiver, arg);
      }
      return receiver!.anySignature;
    }
    if (!Checker_isErrorType(receiver, superType)) {
      const containingClass = GetContainingClass(node);
      const baseTypeNode = containingClass !== undefined ? GetExtendsHeritageClauseElement(containingClass) : undefined;
      if (baseTypeNode !== undefined) {
        const baseConstructors = Checker_getInstantiatedConstructorsForTypeArguments(receiver, superType, Node_TypeArguments(baseTypeNode) ?? [], baseTypeNode);
        return Checker_resolveCall(receiver, node, baseConstructors, candidatesOutArray, checkMode, SignatureFlagsNone, undefined);
      }
    }
    return Checker_resolveUntypedCall(receiver, node);
  }
  let callChainFlags: SignatureFlags;
  let funcType = Checker_checkExpression(receiver, Node_Expression(node));
  if (IsOptionalChain(node)) {
    const nonOptionalType = Checker_getOptionalExpressionType(receiver, funcType, Node_Expression(node));
    switch (true) {
      case nonOptionalType === funcType:
        callChainFlags = SignatureFlagsNone;
        break;
      case IsOutermostOptionalChain(node as GoPtr<Expression>):
        callChainFlags = SignatureFlagsIsOuterCallChain;
        break;
      default:
        callChainFlags = SignatureFlagsIsInnerCallChain;
        break;
    }
    funcType = nonOptionalType;
  } else {
    callChainFlags = SignatureFlagsNone;
  }
  funcType = Checker_checkNonNullTypeWithReporter(receiver, funcType, Node_Expression(node), Checker_reportCannotInvokePossiblyNullOrUndefinedError);
  if (funcType === receiver!.silentNeverType) {
    return receiver!.silentNeverSignature;
  }
  const apparentType = Checker_getApparentType(receiver, funcType);
  if (Checker_isErrorType(receiver, apparentType)) {
    return Checker_resolveErrorCall(receiver, node);
  }
  const callSignatures = Checker_getSignaturesOfType(receiver, apparentType, SignatureKindCall);
  const numConstructSignatures = Checker_getSignaturesOfType(receiver, apparentType, SignatureKindConstruct).length;
  if (Checker_isUntypedFunctionCall(receiver, funcType, apparentType, callSignatures.length as int, numConstructSignatures as int)) {
    if (!Checker_isErrorType(receiver, funcType) && Node_TypeArguments(node) !== undefined) {
      Checker_error(receiver, node, Untyped_function_calls_may_not_accept_type_arguments);
    }
    return Checker_resolveUntypedCall(receiver, node);
  }
  if (callSignatures.length === 0) {
    if (numConstructSignatures !== 0) {
      Checker_error(receiver, node, Value_of_type_0_is_not_callable_Did_you_mean_to_include_new, Checker_TypeToString(receiver, funcType));
    } else {
      let relatedInformation: GoPtr<Diagnostic>;
      if ((Node_Arguments(node) ?? []).length === 1) {
        const text = SourceFile_Text(GetSourceFileOfNode(node));
        const options: SkipTriviaOptions = { StopAfterLineBreak: true, StopAtComments: false, InJSDoc: false };
        if (IsLineBreak(text.charCodeAt(SkipTriviaEx(text, Node_End(Node_Expression(node)), options) - 1) as int)) {
          relatedInformation = NewDiagnosticForNode(Node_Expression(node), Are_you_missing_a_semicolon);
        }
      }
      Checker_invocationError(receiver, Node_Expression(node), apparentType, SignatureKindCall, relatedInformation);
    }
    return Checker_resolveErrorCall(receiver, node);
  }
  if ((checkMode & CheckModeSkipGenericFunctions) !== 0 && (Node_TypeArguments(node) ?? []).length === 0 && core.Some(callSignatures, (signature) => Checker_isGenericFunctionReturningFunction(receiver, signature))) {
    Checker_skippedGenericFunction(receiver, node, checkMode);
    return receiver!.resolvingSignature;
  }
  return Checker_resolveCall(receiver, node, callSignatures, candidatesOutArray, checkMode, callChainFlags, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isConstructorAccessible","kind":"method","status":"implemented","sigHash":"08733b3be47d5f962517bd2ff7291f4439a94f22e926cd00859f19e2d83f5601","bodyHash":"f26528f99bb86349d0d19a96d4bd77594aac160b4ec6d8ae42319b0e9b9ac776"}
 *
 * Go source:
 * func (c *Checker) isConstructorAccessible(node *ast.Node, signature *Signature) bool {
 * 	if signature == nil || signature.declaration == nil {
 * 		return true
 * 	}
 * 	declaration := signature.declaration
 * 	modifiers := getSelectedModifierFlags(declaration, ast.ModifierFlagsNonPublicAccessibilityModifier)
 * 	// (1) Public constructors and (2) constructor functions are always accessible.
 * 	if modifiers == 0 || !ast.IsConstructorDeclaration(declaration) {
 * 		return true
 * 	}
 * 	declaringClassDeclaration := ast.GetClassLikeDeclarationOfSymbol(declaration.Parent.Symbol())
 * 	declaringClass := c.getDeclaredTypeOfSymbol(declaration.Parent.Symbol())
 * 	// A private or protected constructor can only be instantiated within its own class (or a subclass, for protected)
 * 	if !c.isNodeWithinClass(node, declaringClassDeclaration) {
 * 		containingClass := ast.GetContainingClass(node)
 * 		if containingClass != nil && modifiers&ast.ModifierFlagsProtected != 0 {
 * 			containingType := c.getDeclaredTypeOfSymbol(containingClass.Symbol())
 * 			if c.typeHasProtectedAccessibleBase(declaration.Parent.Symbol(), containingType) {
 * 				return true
 * 			}
 * 		}
 * 		if modifiers&ast.ModifierFlagsPrivate != 0 {
 * 			c.error(node, diagnostics.Constructor_of_class_0_is_private_and_only_accessible_within_the_class_declaration, c.TypeToString(declaringClass))
 * 		}
 * 		if modifiers&ast.ModifierFlagsProtected != 0 {
 * 			c.error(node, diagnostics.Constructor_of_class_0_is_protected_and_only_accessible_within_the_class_declaration, c.TypeToString(declaringClass))
 * 		}
 * 		return false
 * 	}
 * 	return true
 * }
 */
export function Checker_isConstructorAccessible(receiver: GoPtr<Checker>, node: GoPtr<Node>, signature: GoPtr<Signature>): bool {
  if (signature === undefined || signature!.declaration === undefined) {
    return true;
  }
  const declaration = signature!.declaration;
  const modifiers = getSelectedModifierFlags(declaration, ModifierFlagsNonPublicAccessibilityModifier);
  if (modifiers === 0 || !IsConstructorDeclaration(declaration)) {
    return true;
  }
  const declaringClassDeclaration = GetClassLikeDeclarationOfSymbol(Node_Symbol(declaration!.Parent));
  const declaringClass = Checker_getDeclaredTypeOfSymbol(receiver, Node_Symbol(declaration!.Parent));
  if (!Checker_isNodeWithinClass(receiver, node, declaringClassDeclaration)) {
    const containingClass = GetContainingClass(node);
    if (containingClass !== undefined && (modifiers & ModifierFlagsProtected) !== 0) {
      const containingType = Checker_getDeclaredTypeOfSymbol(receiver, Node_Symbol(containingClass));
      if (Checker_typeHasProtectedAccessibleBase(receiver, Node_Symbol(declaration!.Parent), containingType)) {
        return true;
      }
    }
    if ((modifiers & ModifierFlagsPrivate) !== 0) {
      Checker_error(receiver, node, Constructor_of_class_0_is_private_and_only_accessible_within_the_class_declaration, Checker_TypeToString(receiver, declaringClass));
    }
    if ((modifiers & ModifierFlagsProtected) !== 0) {
      Checker_error(receiver, node, Constructor_of_class_0_is_protected_and_only_accessible_within_the_class_declaration, Checker_TypeToString(receiver, declaringClass));
    }
    return false;
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveCall","kind":"method","status":"implemented","sigHash":"64f4eaeeec3a8408011f9d18d2a9e533c91d5a6b983cdd9a4da4b213c9e49193","bodyHash":"1165e481d9cca67eff4bd5ace5384e74a74c86d1153ff23eaf8103bd126eb465"}
 *
 * Go source:
 * func (c *Checker) resolveCall(node *ast.Node, signatures []*Signature, candidatesOutArray *[]*Signature, checkMode CheckMode, callChainFlags SignatureFlags, headMessage *diagnostics.Message) *Signature {
 * 	isTaggedTemplate := node.Kind == ast.KindTaggedTemplateExpression
 * 	isDecorator := node.Kind == ast.KindDecorator
 * 	isJsxOpeningOrSelfClosingElement := ast.IsJsxOpeningLikeElement(node)
 * 	isInstanceof := node.Kind == ast.KindBinaryExpression
 * 	reportErrors := !c.isInferencePartiallyBlocked && candidatesOutArray == nil
 * 	var s CallState
 * 	s.node = node
 * 	if !isDecorator && !isInstanceof && !isSuperCall(node) && !ast.IsJsxOpeningFragment(node) {
 * 		s.typeArguments = node.TypeArguments()
 * 		// We already perform checking on the type arguments on the class declaration itself.
 * 		if isTaggedTemplate || isJsxOpeningOrSelfClosingElement || node.Expression().Kind != ast.KindSuperKeyword {
 * 			c.checkSourceElements(s.typeArguments)
 * 		}
 * 	}
 * 	s.candidates = c.reorderCandidates(signatures, callChainFlags)
 * 	if candidatesOutArray != nil {
 * 		*candidatesOutArray = s.candidates
 * 	}
 * 
 * 	if len(s.candidates) == 0 {
 * 		// In Strada we would error here, but no known repro doesn't have at least
 * 		// one other error in this codepath. Just return instead. See #54442
 * 		return c.unknownSignature
 * 	}
 * 
 * 	s.args = c.getEffectiveCallArguments(node)
 * 	// The excludeArgument array contains true for each context sensitive argument (an argument
 * 	// is context sensitive it is susceptible to a one-time permanent contextual typing).
 * 	//
 * 	// The idea is that we will perform type argument inference & assignability checking once
 * 	// without using the susceptible parameters that are functions, and once more for those
 * 	// parameters, contextually typing each as we go along.
 * 	//
 * 	// For a tagged template, then the first argument be 'undefined' if necessary because it
 * 	// represents a TemplateStringsArray.
 * 	//
 * 	// For a decorator, no arguments are susceptible to contextual typing due to the fact
 * 	// decorators are applied to a declaration by the emitter, and not to an expression.
 * 	s.isSingleNonGenericCandidate = len(s.candidates) == 1 && len(s.candidates[0].typeParameters) == 0
 * 	if !isDecorator && !s.isSingleNonGenericCandidate && core.Some(s.args, c.isContextSensitive) {
 * 		s.argCheckMode = CheckModeSkipContextSensitive
 * 	} else {
 * 		s.argCheckMode = CheckModeNormal
 * 	}
 * 	// The following variables are captured and modified by calls to chooseOverload.
 * 	// If overload resolution or type argument inference fails, we want to report the
 * 	// best error possible. The best error is one which says that an argument was not
 * 	// assignable to a parameter. This implies that everything else about the overload
 * 	// was fine. So if there is any overload that is only incorrect because of an
 * 	// argument, we will report an error on that one.
 * 	//
 * 	//     function foo(s: string): void;
 * 	//     function foo(n: number): void; // Report argument error on this overload
 * 	//     function foo(): void;
 * 	//     foo(true);
 * 	//
 * 	// If none of the overloads even made it that far, there are two possibilities.
 * 	// There was a problem with type arguments for some overload, in which case
 * 	// report an error on that. Or none of the overloads even had correct arity,
 * 	// in which case give an arity error.
 * 	//
 * 	//     function foo<T extends string>(x: T): void; // Report type argument error
 * 	//     function foo(): void;
 * 	//     foo<number>(0);
 * 	//
 * 	// If we are in signature help, a trailing comma indicates that we intend to provide another argument,
 * 	// so we will only accept overloads with arity at least 1 higher than the current number of provided arguments.
 * 	s.signatureHelpTrailingComma = checkMode&CheckModeIsForSignatureHelp != 0 && ast.IsCallExpression(node) && node.ArgumentList().HasTrailingComma()
 * 	// Section 4.12.1:
 * 	// if the candidate list contains one or more signatures for which the type of each argument
 * 	// expression is a subtype of each corresponding parameter type, the return type of the first
 * 	// of those signatures becomes the return type of the function call.
 * 	// Otherwise, the return type of the first signature in the candidate list becomes the return
 * 	// type of the function call.
 * 	//
 * 	// Whether the call is an error is determined by assignability of the arguments. The subtype pass
 * 	// is just important for choosing the best signature. So in the case where there is only one
 * 	// signature, the subtype pass is useless. So skipping it is an optimization.
 * 	var result *Signature
 * 	if len(s.candidates) > 1 {
 * 		result = c.chooseOverload(&s, c.subtypeRelation)
 * 	}
 * 	if result == nil {
 * 		result = c.chooseOverload(&s, c.assignableRelation)
 * 	}
 * 	if result != nil {
 * 		return result
 * 	}
 * 	result = c.getCandidateForOverloadFailure(s.node, s.candidates, s.args, candidatesOutArray != nil, checkMode)
 * 	// Preemptively cache the result; getResolvedSignature will do this after we return, but
 * 	// we need to ensure that the result is present for the error checks below so that if
 * 	// this signature is encountered again, we handle the circularity (rather than producing a
 * 	// different result which may produce no errors and assert). Callers of getResolvedSignature
 * 	// don't hit this issue because they only observe this result after it's had a chance to
 * 	// be cached, but the error reporting code below executes before getResolvedSignature sets
 * 	// resolvedSignature.
 * 	c.signatureLinks.Get(node).resolvedSignature = result
 * 	// No signatures were applicable. Now report errors based on the last applicable signature with
 * 	// no arguments excluded from assignability checks.
 * 	// If candidate is undefined, it means that no candidates had a suitable arity. In that case,
 * 	// skip the checkApplicableSignature check.
 * 	if reportErrors {
 * 		// If the call expression is a synthetic call to a `[Symbol.hasInstance]` method then we will produce a head
 * 		// message when reporting diagnostics that explains how we got to `right[Symbol.hasInstance](left)` from
 * 		// `left instanceof right`, as it pertains to "Argument" related messages reported for the call.
 * 		if headMessage == nil && isInstanceof {
 * 			headMessage = diagnostics.The_left_hand_side_of_an_instanceof_expression_must_be_assignable_to_the_first_argument_of_the_right_hand_side_s_Symbol_hasInstance_method
 * 		}
 * 		c.reportCallResolutionErrors(node, &s, signatures, headMessage)
 * 	}
 * 	return result
 * }
 */
export function Checker_resolveCall(receiver: GoPtr<Checker>, node: GoPtr<Node>, signatures: GoSlice<GoPtr<Signature>>, candidatesOutArray: GoPtr<GoSlice<GoPtr<Signature>>>, checkMode: CheckMode, callChainFlags: SignatureFlags, headMessage: GoPtr<Message>): GoPtr<Signature> {
  const isDecorator = node!.Kind === KindDecorator;
  const isInstanceof = node!.Kind === KindBinaryExpression;
  const reportErrors = !receiver!.isInferencePartiallyBlocked && candidatesOutArray === undefined;
  const typeArguments = !isDecorator && !isInstanceof && !isSuperCall(node) && node!.Kind !== KindJsxOpeningFragment ? (Node_TypeArguments(node) ?? []) : [];
  if (typeArguments.length !== 0 && (node!.Kind === KindTaggedTemplateExpression || IsJsxOpeningLikeElement(node) || Node_Expression(node)!.Kind !== KindSuperKeyword)) {
    Checker_checkSourceElements(receiver, typeArguments);
  }
  const candidates = Checker_reorderCandidates(receiver, signatures, callChainFlags);
  if (candidatesOutArray !== undefined) {
    candidatesOutArray.length = 0;
    candidatesOutArray.push(...candidates);
  }
  if (candidates.length === 0) {
    return receiver!.unknownSignature;
  }
  const args = Checker_getEffectiveCallArguments(receiver, node);
  const isSingleNonGenericCandidate = candidates.length === 1 && (candidates[0]!.typeParameters ?? []).length === 0;
  const argCheckMode = !isDecorator && !isSingleNonGenericCandidate && core.Some(args, (arg) => Checker_isContextSensitive(receiver, arg))
    ? CheckModeSkipContextSensitive
    : CheckModeNormal;
  const callState = {
    node,
    typeArguments,
    candidates,
    args,
    isSingleNonGenericCandidate,
    argCheckMode,
    signatureHelpTrailingComma: ((checkMode & CheckModeIsForSignatureHelp) !== 0 && IsCallExpression(node) && NodeList_HasTrailingComma(Node_ArgumentList(node))) as bool,
  } as CallState;
  let result: GoPtr<Signature>;
  if (candidates.length > 1) {
    result = Checker_chooseOverload(receiver, callState, receiver!.subtypeRelation);
  }
  if (result === undefined) {
    result = Checker_chooseOverload(receiver, callState, receiver!.assignableRelation);
  }
  if (result !== undefined) {
    return result;
  }
  result = Checker_getCandidateForOverloadFailure(receiver, callState.node, callState.candidates, callState.args, candidatesOutArray !== undefined, checkMode);
  (LinkStore_Get(receiver!.signatureLinks, node) as GoPtr<SignatureLinks>)!.resolvedSignature = result;
  if (reportErrors) {
    const resolvedHeadMessage = headMessage === undefined && isInstanceof
      ? The_left_hand_side_of_an_instanceof_expression_must_be_assignable_to_the_first_argument_of_the_right_hand_side_s_Symbol_hasInstance_method
      : headMessage;
    Checker_reportCallResolutionErrors(receiver, node, callState, signatures, resolvedHeadMessage);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.reorderCandidates","kind":"method","status":"implemented","sigHash":"35ebf926781ad9829f89337e383e4c3e53de8d5dfae3d53aa2ac291bcd5998f8","bodyHash":"bd76d93811b5b9de65e879ef734438a56c7660697e4024d8f7df96386f86afb4"}
 *
 * Go source:
 * func (c *Checker) reorderCandidates(signatures []*Signature, callChainFlags SignatureFlags) []*Signature {
 * 	var lastParent *ast.Node
 * 	var lastSymbol *ast.Symbol
 * 	var index int
 * 	var cutoffIndex int
 * 	var spliceIndex int
 * 	specializedIndex := -1
 * 	result := make([]*Signature, 0, len(signatures))
 * 	for _, signature := range signatures {
 * 		var symbol *ast.Symbol
 * 		var parent *ast.Node
 * 		if signature.declaration != nil {
 * 			symbol = c.getSymbolOfDeclaration(signature.declaration)
 * 			parent = signature.declaration.Parent
 * 		}
 * 		if lastSymbol == nil || symbol == lastSymbol {
 * 			if lastParent != nil && parent == lastParent {
 * 				index = index + 1
 * 			} else {
 * 				lastParent = parent
 * 				index = cutoffIndex
 * 			}
 * 		} else {
 * 			// current declaration belongs to a different symbol
 * 			// set cutoffIndex so re-orderings in the future won't change result set from 0 to cutoffIndex
 * 			index = len(result)
 * 			cutoffIndex = len(result)
 * 			lastParent = parent
 * 		}
 * 		lastSymbol = symbol
 * 		// specialized signatures always need to be placed before non-specialized signatures regardless
 * 		// of the cutoff position; see GH#1133
 * 		if signatureHasLiteralTypes(signature) {
 * 			specializedIndex++
 * 			spliceIndex = specializedIndex
 * 			// The cutoff index always needs to be greater than or equal to the specialized signature index
 * 			// in order to prevent non-specialized signatures from being added before a specialized
 * 			// signature.
 * 			cutoffIndex++
 * 		} else {
 * 			spliceIndex = index
 * 		}
 * 		if callChainFlags != 0 {
 * 			signature = c.getOptionalCallSignature(signature, callChainFlags)
 * 		}
 * 		result = slices.Insert(result, spliceIndex, signature)
 * 	}
 * 	return result
 * }
 */
export function Checker_reorderCandidates(receiver: GoPtr<Checker>, signatures: GoSlice<GoPtr<Signature>>, callChainFlags: SignatureFlags): GoSlice<GoPtr<Signature>> {
  let lastParent: GoPtr<Node>;
  let lastSymbol: GoPtr<Symbol>;
  let index = 0;
  let cutoffIndex = 0;
  let spliceIndex = 0;
  let specializedIndex = -1;
  let result: GoSlice<GoPtr<Signature>> = [];
  for (let signature of signatures) {
    let symbol: GoPtr<Symbol>;
    let parent: GoPtr<Node>;
    if (signature!.declaration !== undefined) {
      symbol = Checker_getSymbolOfDeclaration(receiver, signature!.declaration);
      parent = signature!.declaration.Parent;
    }
    if (lastSymbol === undefined || symbol === lastSymbol) {
      if (lastParent !== undefined && parent === lastParent) {
        index = index + 1;
      } else {
        lastParent = parent;
        index = cutoffIndex;
      }
    } else {
      index = result.length;
      cutoffIndex = result.length;
      lastParent = parent;
    }
    lastSymbol = symbol;
    if (signatureHasLiteralTypes(signature)) {
      specializedIndex++;
      spliceIndex = specializedIndex;
      cutoffIndex++;
    } else {
      spliceIndex = index;
    }
    if (callChainFlags !== 0) {
      signature = Checker_getOptionalCallSignature(receiver, signature, callChainFlags);
    }
    result = slices.Insert(result, spliceIndex, signature);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getOptionalCallSignature","kind":"method","status":"implemented","sigHash":"f83bac10efc05aeff180ece199b9b74a9bb21c8f96c6afdf27a82c379b0cbb98","bodyHash":"4de11347b5ecd8c4b8fa0682e9933c4f61b96d3324edf5d68ea20fc530722364"}
 *
 * Go source:
 * func (c *Checker) getOptionalCallSignature(signature *Signature, callChainFlags SignatureFlags) *Signature {
 * 	if signature.flags&SignatureFlagsCallChainFlags == callChainFlags {
 * 		return signature
 * 	}
 * 	key := CachedSignatureKey{sig: signature, key: core.IfElse(callChainFlags == SignatureFlagsIsInnerCallChain, SignatureKeyInner, SignatureKeyOuter)}
 * 	if cached := c.cachedSignatures[key]; cached != nil {
 * 		return cached
 * 	}
 * 	result := c.cloneSignature(signature)
 * 	result.flags |= callChainFlags
 * 	c.cachedSignatures[key] = result
 * 	return result
 * }
 */
export function Checker_getOptionalCallSignature(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, callChainFlags: SignatureFlags): GoPtr<Signature> {
  if ((signature!.flags & SignatureFlagsCallChainFlags) === (callChainFlags as int)) {
    return signature;
  }
  const key: CachedSignatureKey = { sig: signature, key: core.IfElse(callChainFlags === SignatureFlagsIsInnerCallChain, SignatureKeyInner, SignatureKeyOuter) };
  const cached = receiver!.cachedSignatures.get(key as unknown as CachedSignatureKey);
  if (cached !== undefined) {
    return cached;
  }
  const result = Checker_cloneSignature(receiver, signature);
  result!.flags = (result!.flags | callChainFlags) as SignatureFlags;
  receiver!.cachedSignatures.set(key as unknown as CachedSignatureKey, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.chooseOverload","kind":"method","status":"implemented","sigHash":"35dba3b0efe4936419b69fa992defebeee5d256f458d7f9e4380a90f01ebf523","bodyHash":"700e21c92d57c8a4855429b73ba64cf71315dc211322c7e729c564783475cdec"}
 *
 * Go source:
 * func (c *Checker) chooseOverload(s *CallState, relation *Relation) *Signature {
 * 	s.candidatesForArgumentError = nil
 * 	s.candidateForArgumentArityError = nil
 * 	s.candidateForTypeArgumentError = nil
 * 	if s.isSingleNonGenericCandidate {
 * 		candidate := s.candidates[0]
 * 		if len(s.typeArguments) != 0 || !c.hasCorrectArity(s.node, s.args, candidate, s.signatureHelpTrailingComma) {
 * 			return nil
 * 		}
 * 		if !c.isSignatureApplicable(s.node, s.args, candidate, relation, CheckModeNormal, false /*reportErrors* /, nil /*diagnosticOutput* /) {
 * 			s.candidatesForArgumentError = []*Signature{candidate}
 * 			return nil
 * 		}
 * 		return candidate
 * 	}
 * 	for candidateIndex, candidate := range s.candidates {
 * 		if !c.hasCorrectTypeArgumentArity(candidate, s.typeArguments) || !c.hasCorrectArity(s.node, s.args, candidate, s.signatureHelpTrailingComma) {
 * 			continue
 * 		}
 * 		var checkCandidate *Signature
 * 		var inferenceContext *InferenceContext
 * 		if len(candidate.typeParameters) != 0 {
 * 			var typeArgumentTypes []*Type
 * 			if len(s.typeArguments) != 0 {
 * 				typeArgumentTypes = c.checkTypeArguments(candidate, s.typeArguments, false /*reportErrors* /, nil)
 * 				if typeArgumentTypes == nil {
 * 					s.candidateForTypeArgumentError = candidate
 * 					continue
 * 				}
 * 			} else {
 * 				inferenceContext = c.newInferenceContext(candidate.typeParameters, candidate, core.IfElse(ast.IsInJSFile(s.node), InferenceFlagsAnyDefault, InferenceFlagsNone) /*flags* /, nil)
 * 				typeArgumentTypes = c.inferTypeArguments(s.node, candidate, s.args, s.argCheckMode|CheckModeSkipGenericFunctions, inferenceContext)
 * 				if inferenceContext.flags&InferenceFlagsSkippedGenericFunction != 0 {
 * 					s.argCheckMode |= CheckModeSkipGenericFunctions
 * 				}
 * 			}
 * 			var inferredTypeParameters []*Type
 * 			if inferenceContext != nil {
 * 				inferredTypeParameters = inferenceContext.inferredTypeParameters
 * 			}
 * 			checkCandidate = c.getSignatureInstantiation(candidate, typeArgumentTypes, ast.IsInJSFile(candidate.declaration), inferredTypeParameters)
 * 			// If the original signature has a generic rest type, instantiation may produce a
 * 			// signature with different arity and we need to perform another arity check.
 * 			if c.getNonArrayRestType(candidate) != nil && !c.hasCorrectArity(s.node, s.args, checkCandidate, s.signatureHelpTrailingComma) {
 * 				s.candidateForArgumentArityError = checkCandidate
 * 				continue
 * 			}
 * 		} else {
 * 			checkCandidate = candidate
 * 		}
 * 		if !c.isSignatureApplicable(s.node, s.args, checkCandidate, relation, s.argCheckMode, false /*reportErrors* /, nil /*diagnosticOutput* /) {
 * 			// Give preference to error candidates that have no rest parameters (as they are more specific)
 * 			s.candidatesForArgumentError = append(s.candidatesForArgumentError, checkCandidate)
 * 			continue
 * 		}
 * 		if s.argCheckMode != 0 {
 * 			// If one or more context sensitive arguments were excluded, we start including
 * 			// them now (and keeping do so for any subsequent candidates) and perform a second
 * 			// round of type inference and applicability checking for this particular candidate.
 * 			s.argCheckMode = CheckModeNormal
 * 			if inferenceContext != nil {
 * 				typeArgumentTypes := c.inferTypeArguments(s.node, candidate, s.args, s.argCheckMode, inferenceContext)
 * 				checkCandidate = c.getSignatureInstantiation(candidate, typeArgumentTypes, ast.IsInJSFile(candidate.declaration), inferenceContext.inferredTypeParameters)
 * 				// If the original signature has a generic rest type, instantiation may produce a
 * 				// signature with different arity and we need to perform another arity check.
 * 				if c.getNonArrayRestType(candidate) != nil && !c.hasCorrectArity(s.node, s.args, checkCandidate, s.signatureHelpTrailingComma) {
 * 					s.candidateForArgumentArityError = checkCandidate
 * 					continue
 * 				}
 * 			}
 * 			if !c.isSignatureApplicable(s.node, s.args, checkCandidate, relation, s.argCheckMode, false /*reportErrors* /, nil /*diagnosticOutput* /) {
 * 				// Give preference to error candidates that have no rest parameters (as they are more specific)
 * 				s.candidatesForArgumentError = append(s.candidatesForArgumentError, checkCandidate)
 * 				continue
 * 			}
 * 		}
 * 		s.candidates[candidateIndex] = checkCandidate
 * 		return checkCandidate
 * 	}
 * 	return nil
 * }
 */
export function Checker_chooseOverload(receiver: GoPtr<Checker>, s: GoPtr<CallState>, relation: GoPtr<Relation>): GoPtr<Signature> {
  s!.candidatesForArgumentError = [];
  s!.candidateForArgumentArityError = undefined;
  s!.candidateForTypeArgumentError = undefined;
  if (s!.isSingleNonGenericCandidate) {
    const candidate = s!.candidates[0];
    if (s!.typeArguments.length !== 0 || !Checker_hasCorrectArity(receiver, s!.node, s!.args, candidate, s!.signatureHelpTrailingComma)) {
      return undefined;
    }
    if (!Checker_isSignatureApplicable(receiver, s!.node, s!.args, candidate, relation, CheckModeNormal, false as bool, undefined)) {
      s!.candidatesForArgumentError = [candidate];
      return undefined;
    }
    return candidate;
  }
  for (let candidateIndex = 0; candidateIndex < s!.candidates.length; candidateIndex++) {
    const candidate = s!.candidates[candidateIndex];
    if (!Checker_hasCorrectTypeArgumentArity(receiver, candidate, s!.typeArguments) || !Checker_hasCorrectArity(receiver, s!.node, s!.args, candidate, s!.signatureHelpTrailingComma)) {
      continue;
    }
    let checkCandidate: GoPtr<Signature>;
    let inferenceContext: GoPtr<InferenceContext>;
    if (candidate!.typeParameters.length !== 0) {
      let typeArgumentTypes: GoPtr<GoSlice<GoPtr<Type>>>;
      if (s!.typeArguments.length !== 0) {
        typeArgumentTypes = Checker_checkTypeArguments(receiver, candidate, s!.typeArguments, false as bool, undefined);
        if (typeArgumentTypes === undefined) {
          s!.candidateForTypeArgumentError = candidate;
          continue;
        }
      } else {
        inferenceContext = Checker_newInferenceContext(receiver, candidate!.typeParameters, candidate, core.IfElse(IsInJSFile(s!.node), InferenceFlagsAnyDefault, InferenceFlagsNone), undefined as unknown as TypeComparer);
        typeArgumentTypes = Checker_inferTypeArguments(receiver, s!.node, candidate, s!.args, (s!.argCheckMode | CheckModeSkipGenericFunctions) as CheckMode, inferenceContext);
        if ((inferenceContext!.flags & InferenceFlagsSkippedGenericFunction) !== 0) {
          s!.argCheckMode = (s!.argCheckMode | CheckModeSkipGenericFunctions) as CheckMode;
        }
      }
      let inferredTypeParameters: GoSlice<GoPtr<Type>> | undefined;
      if (inferenceContext !== undefined) {
        inferredTypeParameters = inferenceContext.inferredTypeParameters;
      }
      checkCandidate = Checker_getSignatureInstantiation(receiver, candidate, typeArgumentTypes, IsInJSFile(candidate!.declaration), inferredTypeParameters);
      if (Checker_getNonArrayRestType(receiver, candidate) !== undefined && !Checker_hasCorrectArity(receiver, s!.node, s!.args, checkCandidate, s!.signatureHelpTrailingComma)) {
        s!.candidateForArgumentArityError = checkCandidate;
        continue;
      }
    } else {
      checkCandidate = candidate;
    }
    if (!Checker_isSignatureApplicable(receiver, s!.node, s!.args, checkCandidate, relation, s!.argCheckMode, false as bool, undefined)) {
      s!.candidatesForArgumentError.push(checkCandidate);
      continue;
    }
    if (s!.argCheckMode !== 0) {
      s!.argCheckMode = CheckModeNormal;
      if (inferenceContext !== undefined) {
        const typeArgumentTypes = Checker_inferTypeArguments(receiver, s!.node, candidate, s!.args, s!.argCheckMode, inferenceContext);
        checkCandidate = Checker_getSignatureInstantiation(receiver, candidate, typeArgumentTypes, IsInJSFile(candidate!.declaration), inferenceContext.inferredTypeParameters);
        if (Checker_getNonArrayRestType(receiver, candidate) !== undefined && !Checker_hasCorrectArity(receiver, s!.node, s!.args, checkCandidate, s!.signatureHelpTrailingComma)) {
          s!.candidateForArgumentArityError = checkCandidate;
          continue;
        }
      }
      if (!Checker_isSignatureApplicable(receiver, s!.node, s!.args, checkCandidate, relation, s!.argCheckMode, false as bool, undefined)) {
        s!.candidatesForArgumentError.push(checkCandidate);
        continue;
      }
    }
    s!.candidates[candidateIndex] = checkCandidate;
    return checkCandidate;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasCorrectArity","kind":"method","status":"implemented","sigHash":"30e8b730a6be4f649430cfc5856b8c9a52b7f5b9f94e28ea3cfd7834540d1536","bodyHash":"7534dc397d549151f05d922da8ee58a063fe26622c4dc9fdc00db6cab466b1b2"}
 *
 * Go source:
 * func (c *Checker) hasCorrectArity(node *ast.Node, args []*ast.Node, signature *Signature, signatureHelpTrailingComma bool) bool {
 * 	if ast.IsJsxOpeningFragment(node) {
 * 		return true
 * 	}
 * 	var argCount int
 * 	callIsIncomplete := false
 * 	// In incomplete call we want to be lenient when we have too few arguments
 * 	effectiveParameterCount := c.getParameterCount(signature)
 * 	effectiveMinimumArguments := c.getMinArgumentCount(signature)
 * 	switch {
 * 	case ast.IsTaggedTemplateExpression(node):
 * 		argCount = len(args)
 * 		template := node.AsTaggedTemplateExpression().Template
 * 		if ast.IsTemplateExpression(template) {
 * 			// If a tagged template expression lacks a tail literal, the call is incomplete.
 * 			// Specifically, a template only can end in a TemplateTail or a Missing literal.
 * 			lastSpan := core.LastOrNil(template.AsTemplateExpression().TemplateSpans.Nodes)
 * 			// we should always have at least one span.
 * 			callIsIncomplete = ast.NodeIsMissing(lastSpan.AsTemplateSpan().Literal) || ast.IsUnterminatedLiteral(lastSpan.AsTemplateSpan().Literal)
 * 		} else {
 * 			// If the template didn't end in a backtick, or its beginning occurred right prior to EOF,
 * 			// then this might actually turn out to be a TemplateHead in the future;
 * 			// so we consider the call to be incomplete.
 * 			callIsIncomplete = ast.IsUnterminatedLiteral(template)
 * 		}
 * 	case ast.IsDecorator(node):
 * 		argCount = c.getDecoratorArgumentCount(node, signature)
 * 	case ast.IsBinaryExpression(node):
 * 		argCount = 1
 * 	case ast.IsJsxOpeningLikeElement(node):
 * 		callIsIncomplete = node.Attributes().End() == node.End()
 * 		if callIsIncomplete {
 * 			return true
 * 		}
 * 		argCount = core.IfElse(effectiveMinimumArguments == 0, len(args), 1)
 * 		effectiveParameterCount = core.IfElse(len(args) == 0, effectiveParameterCount, 1) // class may have argumentless ctor functions - still resolve ctor and compare vs props member type
 * 		effectiveMinimumArguments = min(effectiveMinimumArguments, 1)                     // sfc may specify context argument - handled by framework and not typechecked
 * 	case ast.IsNewExpression(node) && node.ArgumentList() == nil:
 * 		// This only happens when we have something of the form: 'new C'
 * 		return c.getMinArgumentCount(signature) == 0
 * 	default:
 * 		if signatureHelpTrailingComma {
 * 			argCount = len(args) + 1
 * 		} else {
 * 			argCount = len(args)
 * 		}
 * 		// If we are missing the close parenthesis, the call is incomplete.
 * 		callIsIncomplete = node.ArgumentList().End() == node.End()
 * 		// If a spread argument is present, check that it corresponds to a rest parameter or at least that it's in the valid range.
 * 		spreadArgIndex := c.getSpreadArgumentIndex(args)
 * 		if spreadArgIndex >= 0 {
 * 			return spreadArgIndex >= c.getMinArgumentCount(signature) && (c.hasEffectiveRestParameter(signature) || spreadArgIndex < c.getParameterCount(signature))
 * 		}
 * 	}
 * 	// Too many arguments implies incorrect arity.
 * 	if !c.hasEffectiveRestParameter(signature) && argCount > effectiveParameterCount {
 * 		return false
 * 	}
 * 	// If the call is incomplete, we should skip the lower bound check.
 * 	// JSX signatures can have extra parameters provided by the library which we don't check
 * 	if callIsIncomplete || argCount >= effectiveMinimumArguments {
 * 		return true
 * 	}
 * 	for i := argCount; i < effectiveMinimumArguments; i++ {
 * 		t := c.getTypeAtPosition(signature, i)
 * 		if c.filterType(t, acceptsVoid).flags&TypeFlagsNever != 0 {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function Checker_hasCorrectArity(receiver: GoPtr<Checker>, node: GoPtr<Node>, args: GoSlice<GoPtr<Node>>, signature: GoPtr<Signature>, signatureHelpTrailingComma: bool): bool {
  if (IsJsxOpeningFragment(node)) {
    return true as bool;
  }
  const callArgs = args ?? [];
  let argCount = 0;
  let callIsIncomplete = false;
  let effectiveParameterCount = Checker_getParameterCount(receiver, signature);
  let effectiveMinimumArguments = Checker_getMinArgumentCount(receiver, signature);
  if (IsTaggedTemplateExpression(node)) {
    argCount = callArgs.length;
    const template = AsTaggedTemplateExpression(node)!.Template;
    if (IsTemplateExpression(template)) {
      const lastSpan = core.LastOrNil(AsTemplateExpression(template)!.TemplateSpans!.Nodes);
      const literal = AsTemplateSpan(lastSpan)!.Literal;
      callIsIncomplete = NodeIsMissing(literal) || IsUnterminatedLiteral(literal);
    } else {
      callIsIncomplete = IsUnterminatedLiteral(template);
    }
  } else if (IsDecorator(node)) {
    argCount = Checker_getDecoratorArgumentCount(receiver, node, signature);
  } else if (IsBinaryExpression(node)) {
    argCount = 1;
  } else if (IsJsxOpeningLikeElement(node)) {
    callIsIncomplete = Node_End(Node_Attributes(node)) === Node_End(node);
    if (callIsIncomplete) {
      return true as bool;
    }
    argCount = core.IfElse(effectiveMinimumArguments === 0, callArgs.length, 1);
    effectiveParameterCount = core.IfElse(callArgs.length === 0, effectiveParameterCount, 1);
    effectiveMinimumArguments = globalThis.Math.min(effectiveMinimumArguments, 1);
  } else if (IsNewExpression(node) && AsNewExpression(node)!.Arguments === undefined) {
    return Checker_getMinArgumentCount(receiver, signature) === 0;
  } else {
    if (signatureHelpTrailingComma) {
      argCount = callArgs.length + 1;
    } else {
      argCount = callArgs.length;
    }
    const argumentList = Node_ArgumentList(node);
    callIsIncomplete = argumentList !== undefined && NodeList_End(argumentList) === Node_End(node);
    const spreadArgIndex = Checker_getSpreadArgumentIndex(receiver, callArgs);
    if (spreadArgIndex >= 0) {
      return spreadArgIndex >= Checker_getMinArgumentCount(receiver, signature) && (Checker_hasEffectiveRestParameter(receiver, signature) || spreadArgIndex < Checker_getParameterCount(receiver, signature));
    }
  }
  if (!Checker_hasEffectiveRestParameter(receiver, signature) && argCount > effectiveParameterCount) {
    return false as bool;
  }
  if (callIsIncomplete || argCount >= effectiveMinimumArguments) {
    return true as bool;
  }
  for (let index = argCount; index < effectiveMinimumArguments; index++) {
    const t = Checker_getTypeAtPosition(receiver, signature, index);
    if ((Checker_filterType(receiver, t, acceptsVoid)!.flags & TypeFlagsNever) !== 0) {
      return false as bool;
    }
  }
  return true as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDecoratorArgumentCount","kind":"method","status":"implemented","sigHash":"dfc05388538f27c517ba2c23e8685565a0a69cc004e740f6894b02f226c5c4bf","bodyHash":"b7ec1fe483d8978984ab51ecbe9d6c5d142bb449248a35098700c5255201d843"}
 *
 * Go source:
 * func (c *Checker) getDecoratorArgumentCount(node *ast.Node, signature *Signature) int {
 * 	if c.compilerOptions.ExperimentalDecorators.IsTrue() {
 * 		return c.getLegacyDecoratorArgumentCount(node, signature)
 * 	}
 * 	return min(max(c.getParameterCount(signature), 1), 2)
 * }
 */
export function Checker_getDecoratorArgumentCount(receiver: GoPtr<Checker>, node: GoPtr<Node>, signature: GoPtr<Signature>): int {
  if (Tristate_IsTrue(receiver!.compilerOptions!.ExperimentalDecorators)) {
    return Checker_getLegacyDecoratorArgumentCount(receiver, node, signature);
  }
  return Math.min(Math.max(Checker_getParameterCount(receiver, signature), 1), 2);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getLegacyDecoratorArgumentCount","kind":"method","status":"implemented","sigHash":"dbad1228b8df77e372a881b831386a5d092fae4b70793e47973b626ad58a52f8","bodyHash":"3ba13d2f58079c3bfce26bfeb9a017c9e0bde89780f2bffdb9fac40c5017aea7"}
 *
 * Go source:
 * func (c *Checker) getLegacyDecoratorArgumentCount(node *ast.Node, signature *Signature) int {
 * 	switch node.Parent.Kind {
 * 	case ast.KindClassDeclaration, ast.KindClassExpression:
 * 		return 1
 * 	case ast.KindPropertyDeclaration:
 * 		if ast.HasAccessorModifier(node.Parent) {
 * 			return 3
 * 		}
 * 		return 2
 * 	case ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor:
 * 		// For decorators with only two parameters we supply only two arguments
 * 		if len(signature.parameters) <= 2 {
 * 			return 2
 * 		}
 * 		return 3
 * 	case ast.KindParameter:
 * 		return 3
 * 	}
 * 	panic("Unhandled case in getLegacyDecoratorArgumentCount")
 * }
 */
export function Checker_getLegacyDecoratorArgumentCount(receiver: GoPtr<Checker>, node: GoPtr<Node>, signature: GoPtr<Signature>): int {
  switch (node!.Parent!.Kind) {
    case KindClassDeclaration:
    case KindClassExpression:
      return 1;
    case KindPropertyDeclaration:
      if (HasAccessorModifier(node!.Parent)) {
        return 3;
      }
      return 2;
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
      if (signature!.parameters.length <= 2) {
        return 2;
      }
      return 3;
    case KindParameter:
      return 3;
    default:
      throw new globalThis.Error("Unhandled case in getLegacyDecoratorArgumentCount");
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasCorrectTypeArgumentArity","kind":"method","status":"implemented","sigHash":"4dd131e96696a0af360cc023089aeaf061a869c2c35838376d51be9bb24f0a51","bodyHash":"e3453da3ee4ebe243189b9dcde4207512b674611e0c82f66e35b4648c515ef71"}
 *
 * Go source:
 * func (c *Checker) hasCorrectTypeArgumentArity(signature *Signature, typeArguments []*ast.Node) bool {
 * 	// If the user supplied type arguments, but the number of type arguments does not match
 * 	// the declared number of type parameters, the call has an incorrect arity.
 * 	numTypeParameters := len(signature.typeParameters)
 * 	minTypeArgumentCount := c.getMinTypeArgumentCount(signature.typeParameters)
 * 	return len(typeArguments) == 0 || len(typeArguments) >= minTypeArgumentCount && len(typeArguments) <= numTypeParameters
 * }
 */
export function Checker_hasCorrectTypeArgumentArity(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, typeArguments: GoSlice<GoPtr<Node>>): bool {
  const numTypeParameters = (signature!.typeParameters ?? []).length;
  const minTypeArgumentCount = Checker_getMinTypeArgumentCount(receiver, signature!.typeParameters);
  return (typeArguments ?? []).length === 0 ||
    (typeArguments ?? []).length >= minTypeArgumentCount && (typeArguments ?? []).length <= numTypeParameters;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkTypeArguments","kind":"method","status":"implemented","sigHash":"87040d2eb38d587de694a2f8ddf509392a46dd9f4d347fa49ea8898d05aba2b1","bodyHash":"cd40eddf94982c1995fd206c268d78a0a08869db8cf33a8b491c1f846561b100"}
 *
 * Go source:
 * func (c *Checker) checkTypeArguments(signature *Signature, typeArgumentNodes []*ast.Node, reportErrors bool, headMessage *diagnostics.Message) []*Type {
 * 	isJavaScript := ast.IsInJSFile(signature.declaration)
 * 	typeParameters := signature.typeParameters
 * 	typeArgumentTypes := c.fillMissingTypeArguments(core.Map(typeArgumentNodes, c.getTypeFromTypeNode), typeParameters, c.getMinTypeArgumentCount(typeParameters), isJavaScript)
 * 	var mapper *TypeMapper
 * 	for i := range typeArgumentNodes {
 * 		debug.Assert(typeParameters[i] != nil, "Should not call checkTypeArguments with too many type arguments")
 * 		constraint := c.getConstraintOfTypeParameter(typeParameters[i])
 * 		if constraint != nil {
 * 			typeArgumentHeadMessage := core.OrElse(headMessage, diagnostics.Type_0_does_not_satisfy_the_constraint_1)
 * 			if mapper == nil {
 * 				mapper = newTypeMapper(typeParameters, typeArgumentTypes)
 * 			}
 * 			typeArgument := typeArgumentTypes[i]
 * 			var errorNode *ast.Node
 * 			if reportErrors {
 * 				errorNode = typeArgumentNodes[i]
 * 			}
 * 			var diags []*ast.Diagnostic
 * 			if !c.checkTypeAssignableToEx(typeArgument, c.getTypeWithThisArgument(c.instantiateType(constraint, mapper), typeArgument, false), errorNode, typeArgumentHeadMessage, &diags) {
 * 				if len(diags) != 0 {
 * 					diagnostic := diags[0]
 * 					if headMessage != nil {
 * 						diagnostic = ast.NewDiagnosticChain(diagnostic, diagnostics.Type_0_does_not_satisfy_the_constraint_1)
 * 					}
 * 					c.diagnostics.Add(diagnostic)
 * 				}
 * 				return nil
 * 			}
 * 		}
 * 	}
 * 	return typeArgumentTypes
 * }
 */
export function Checker_checkTypeArguments(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, typeArgumentNodes: GoSlice<GoPtr<Node>>, reportErrors: bool, headMessage: GoPtr<Message>): GoPtr<GoSlice<GoPtr<Type>>> {
  const isJavaScript = IsInJSFile(signature!.declaration);
  const typeParameters = signature!.typeParameters;
  const typeArgumentTypes = Checker_fillMissingTypeArguments(
    receiver,
    core.Map(typeArgumentNodes, (node: GoPtr<Node>) => Checker_getTypeFromTypeNode(receiver, node)),
    typeParameters,
    Checker_getMinTypeArgumentCount(receiver, typeParameters),
    isJavaScript,
  );
  let mapper: GoPtr<TypeMapper> = undefined;
  for (let index = 0; index < typeArgumentNodes.length; index++) {
    const constraint = Checker_getConstraintOfTypeParameter(receiver, typeParameters[index]);
    if (constraint !== undefined) {
      const typeArgumentHeadMessage = core.OrElse(headMessage, Type_0_does_not_satisfy_the_constraint_1);
      if (mapper === undefined) {
        mapper = newTypeMapper(typeParameters, typeArgumentTypes);
      }
      const typeArgument = typeArgumentTypes[index];
      const errorNode = reportErrors ? typeArgumentNodes[index] : undefined;
      const diags: GoSlice<GoPtr<Diagnostic>> = [];
      if (!Checker_checkTypeAssignableToEx(
        receiver,
        typeArgument,
        Checker_getTypeWithThisArgument(receiver, Checker_instantiateType(receiver, constraint, mapper), typeArgument, false),
        errorNode,
        typeArgumentHeadMessage,
        diags,
      )) {
        if (diags.length !== 0) {
          let diagnostic = diags[0];
          if (headMessage !== undefined) {
            diagnostic = NewDiagnosticChain(diagnostic, Type_0_does_not_satisfy_the_constraint_1);
          }
          DiagnosticsCollection_Add(receiver!.diagnostics, diagnostic);
        }
        return undefined;
      }
    }
  }
  return typeArgumentTypes;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isSignatureApplicable","kind":"method","status":"implemented","sigHash":"5707b58d565ca9504f11871fcfeff062bb8599288f1d09c6e802f1443961906e","bodyHash":"4dd2ef04c249ba264d83a86632ceb3b30973a6df168b9afe28e23359c12d439b"}
 *
 * Go source:
 * func (c *Checker) isSignatureApplicable(node *ast.Node, args []*ast.Node, signature *Signature, relation *Relation, checkMode CheckMode, reportErrors bool, diagnosticOutput *[]*ast.Diagnostic) bool {
 * 	if ast.IsJsxCallLike(node) {
 * 		return c.checkApplicableSignatureForJsxCallLikeElement(node, signature, relation, checkMode, reportErrors, diagnosticOutput)
 * 	}
 * 	thisType := c.getThisTypeOfSignature(signature)
 * 	if thisType != nil && thisType != c.voidType && !(ast.IsNewExpression(node) || ast.IsCallExpression(node) && ast.IsSuperProperty(node.Expression())) {
 * 		// If the called expression is not of the form `x.f` or `x["f"]`, then sourceType = voidType
 * 		// If the signature's 'this' type is voidType, then the check is skipped -- anything is compatible.
 * 		// If the expression is a new expression or super call expression, then the check is skipped.
 * 		thisArgumentNode := c.getThisArgumentOfCall(node)
 * 		thisArgumentType := c.getThisArgumentType(thisArgumentNode)
 * 		var errorNode *ast.Node
 * 		if reportErrors {
 * 			errorNode = thisArgumentNode
 * 			if errorNode == nil {
 * 				errorNode = node
 * 			}
 * 		}
 * 		headMessage := diagnostics.The_this_context_of_type_0_is_not_assignable_to_method_s_this_of_type_1
 * 		if !c.checkTypeRelatedToEx(thisArgumentType, thisType, relation, errorNode, headMessage, diagnosticOutput) {
 * 			return false
 * 		}
 * 	}
 * 	headMessage := diagnostics.Argument_of_type_0_is_not_assignable_to_parameter_of_type_1
 * 	restType := c.getNonArrayRestType(signature)
 * 	var argCount int
 * 	if restType != nil {
 * 		argCount = min(c.getParameterCount(signature)-1, len(args))
 * 	} else {
 * 		argCount = len(args)
 * 	}
 * 	for i := range argCount {
 * 		arg := args[i]
 * 		if !ast.IsOmittedExpression(arg) {
 * 			paramType := c.getTypeAtPosition(signature, i)
 * 			argType := c.checkExpressionWithContextualType(arg, paramType, nil /*inferenceContext* /, checkMode)
 * 			// If one or more arguments are still excluded (as indicated by CheckMode.SkipContextSensitive),
 * 			// we obtain the regular type of any object literal arguments because we may not have inferred complete
 * 			// parameter types yet and therefore excess property checks may yield false positives (see #17041).
 * 			var checkArgType *Type
 * 			if checkMode&CheckModeSkipContextSensitive != 0 {
 * 				checkArgType = c.getRegularTypeOfObjectLiteral(argType)
 * 			} else {
 * 				checkArgType = argType
 * 			}
 * 			effectiveCheckArgumentNode := c.getEffectiveCheckNode(arg)
 * 			if !c.checkTypeRelatedToAndOptionallyElaborate(checkArgType, paramType, relation, core.IfElse(reportErrors, effectiveCheckArgumentNode, nil), effectiveCheckArgumentNode, headMessage, diagnosticOutput) {
 * 				c.maybeAddMissingAwaitInfo(arg, checkArgType, paramType, relation, reportErrors, diagnosticOutput)
 * 				return false
 * 			}
 * 		}
 * 	}
 * 	if restType != nil {
 * 		spreadType := c.getSpreadArgumentType(args, argCount, len(args), restType, nil /*context* /, checkMode)
 * 		restArgCount := len(args) - argCount
 * 		var errorNode *ast.Node
 * 		if reportErrors {
 * 			switch restArgCount {
 * 			case 0:
 * 				errorNode = node
 * 			case 1:
 * 				errorNode = c.getEffectiveCheckNode(args[argCount])
 * 			default:
 * 				errorNode = c.createSyntheticExpression(node, spreadType, false, nil)
 * 				errorNode.Loc = core.NewTextRange(args[argCount].Pos(), args[len(args)-1].End())
 * 			}
 * 		}
 * 		if !c.checkTypeRelatedToEx(spreadType, restType, relation, errorNode, headMessage, diagnosticOutput) {
 * 			c.maybeAddMissingAwaitInfo(errorNode, spreadType, restType, relation, reportErrors, diagnosticOutput)
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function Checker_isSignatureApplicable(receiver: GoPtr<Checker>, node: GoPtr<Node>, args: GoSlice<GoPtr<Node>>, signature: GoPtr<Signature>, relation: GoPtr<Relation>, checkMode: CheckMode, reportErrors: bool, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool {
  if (IsJsxCallLike(node)) {
    return Checker_checkApplicableSignatureForJsxCallLikeElement(receiver, node, signature, relation, checkMode, reportErrors, diagnosticOutput);
  }
  const thisType = Checker_getThisTypeOfSignature(receiver, signature);
  if (thisType !== undefined && thisType !== receiver!.voidType && !(IsNewExpression(node) || IsCallExpression(node) && IsSuperProperty(Node_Expression(node)))) {
    const thisArgumentNode = Checker_getThisArgumentOfCall(receiver, node);
    const thisArgumentType = Checker_getThisArgumentType(receiver, thisArgumentNode);
    let errorNode: GoPtr<Node>;
    if (reportErrors) {
      errorNode = thisArgumentNode;
      if (errorNode === undefined) {
        errorNode = node;
      }
    }
    if (!Checker_checkTypeRelatedToEx(receiver, thisArgumentType, thisType, relation, errorNode, The_this_context_of_type_0_is_not_assignable_to_method_s_this_of_type_1, diagnosticOutput)) {
      return false as bool;
    }
  }
  const headMessage = Argument_of_type_0_is_not_assignable_to_parameter_of_type_1;
  const restType = Checker_getNonArrayRestType(receiver, signature);
  const argCount = restType !== undefined ? globalThis.Math.min(Checker_getParameterCount(receiver, signature) - 1, args.length) : args.length;
  for (let index = 0; index < argCount; index++) {
    const arg = args[index];
    if (!IsOmittedExpression(arg)) {
      const paramType = Checker_getTypeAtPosition(receiver, signature, index);
      const argType = Checker_checkExpressionWithContextualType(receiver, arg, paramType, undefined, checkMode);
      const checkArgType = (checkMode & CheckModeSkipContextSensitive) !== 0
        ? Checker_getRegularTypeOfObjectLiteral(receiver, argType)
        : argType;
      const effectiveCheckArgumentNode = Checker_getEffectiveCheckNode(receiver, arg);
      if (!Checker_checkTypeRelatedToAndOptionallyElaborate(receiver, checkArgType, paramType, relation, reportErrors ? effectiveCheckArgumentNode : undefined, effectiveCheckArgumentNode, headMessage, diagnosticOutput)) {
        Checker_maybeAddMissingAwaitInfo(receiver, arg, checkArgType, paramType, relation, reportErrors, diagnosticOutput);
        return false as bool;
      }
    }
  }
  if (restType !== undefined) {
    const spreadType = Checker_getSpreadArgumentType(receiver, args, argCount, args.length, restType, undefined, checkMode);
    const restArgCount = args.length - argCount;
    let errorNode: GoPtr<Node>;
    if (reportErrors) {
      if (restArgCount === 0) {
        errorNode = node;
      } else if (restArgCount === 1) {
        errorNode = Checker_getEffectiveCheckNode(receiver, args[argCount]);
      } else {
        errorNode = Checker_createSyntheticExpression(receiver, node, spreadType, false as bool, undefined);
        errorNode!.Loc = NewTextRange(Node_Pos(args[argCount]), Node_End(args[args.length - 1]));
      }
    }
    if (!Checker_checkTypeRelatedToEx(receiver, spreadType, restType, relation, errorNode, headMessage, diagnosticOutput)) {
      Checker_maybeAddMissingAwaitInfo(receiver, errorNode, spreadType, restType, relation, reportErrors, diagnosticOutput);
      return false as bool;
    }
  }
  return true as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getThisArgumentOfCall","kind":"method","status":"implemented","sigHash":"0fa52a64d6ecd3f611aca35b259ffb6c0b62406a019efcdfa6f4c5e80d62ad99","bodyHash":"6c1c2c66ca52e6346e924ecd69eb8c8a9e472c3d3edd4e72f85aae249a994b29"}
 *
 * Go source:
 * func (c *Checker) getThisArgumentOfCall(node *ast.Node) *ast.Node {
 * 	if ast.IsBinaryExpression(node) {
 * 		return node.AsBinaryExpression().Right
 * 	}
 * 	var expression *ast.Node
 * 	switch {
 * 	case ast.IsCallExpression(node):
 * 		expression = node.Expression()
 * 	case ast.IsTaggedTemplateExpression(node):
 * 		expression = node.AsTaggedTemplateExpression().Tag
 * 	case ast.IsDecorator(node) && !c.legacyDecorators:
 * 		expression = node.Expression()
 * 	}
 * 	if expression != nil {
 * 		callee := ast.SkipOuterExpressions(expression, ast.OEKAll)
 * 		if ast.IsAccessExpression(callee) {
 * 			return callee.Expression()
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getThisArgumentOfCall(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node> {
  if (IsBinaryExpression(node)) {
    return AsBinaryExpression(node)!.Right;
  }
  let expression: GoPtr<Node> = undefined;
  if (IsCallExpression(node)) {
    expression = Node_Expression(node);
  } else if (IsTaggedTemplateExpression(node)) {
    expression = AsTaggedTemplateExpression(node)!.Tag;
  } else if (IsDecorator(node) && !receiver!.legacyDecorators) {
    expression = Node_Expression(node);
  }
  if (expression !== undefined) {
    const callee = SkipOuterExpressions(expression, OEKAll);
    if (IsAccessExpression(callee)) {
      return Node_Expression(callee);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getThisArgumentType","kind":"method","status":"implemented","sigHash":"cae19bedb34c356338ca98d5a1fd8a01f0199805eee88ef8acbb90124fb58b4a","bodyHash":"b2378cc49dbbd185cbeb9204335a8b25e2a788a58af7b5405886517c2fde74cd"}
 *
 * Go source:
 * func (c *Checker) getThisArgumentType(node *ast.Node) *Type {
 * 	if node == nil {
 * 		return c.voidType
 * 	}
 * 	thisArgumentType := c.checkExpression(node)
 * 	switch {
 * 	case ast.IsOptionalChainRoot(node.Parent):
 * 		return c.GetNonNullableType(thisArgumentType)
 * 	case ast.IsOptionalChain(node.Parent):
 * 		return c.removeOptionalTypeMarker(thisArgumentType)
 * 	}
 * 	return thisArgumentType
 * }
 */
export function Checker_getThisArgumentType(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  if (node === undefined) {
    return receiver!.voidType;
  }
  const thisArgumentType = Checker_checkExpression(receiver, node);
  if (IsOptionalChainRoot(node!.Parent)) {
    return Checker_GetNonNullableType(receiver, thisArgumentType);
  }
  if (IsOptionalChain(node!.Parent)) {
    return Checker_removeOptionalTypeMarker(receiver, thisArgumentType);
  }
  return thisArgumentType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.inferTypeArguments","kind":"method","status":"implemented","sigHash":"e5de0a3f508ed64b0fa803c836037202e1ea7e1af1c50646566e8848e36615c2","bodyHash":"5751441525bef82c119b92091786f4654b49d054d44f5bd6580bbed2e75e4473"}
 *
 * Go source:
 * func (c *Checker) inferTypeArguments(node *ast.Node, signature *Signature, args []*ast.Node, checkMode CheckMode, context *InferenceContext) []*Type {
 * 	if ast.IsJsxOpeningLikeElement(node) {
 * 		return c.inferJsxTypeArguments(node, signature, checkMode, context)
 * 	}
 * 	// If a contextual type is available, infer from that type to the return type of the call expression. For
 * 	// example, given a 'function wrap<T, U>(cb: (x: T) => U): (x: T) => U' and a call expression
 * 	// 'let f: (x: string) => number = wrap(s => s.length)', we infer from the declared type of 'f' to the
 * 	// return type of 'wrap'.
 * 	if !ast.IsDecorator(node) && !ast.IsBinaryExpression(node) {
 * 		skipBindingPatterns := core.Every(signature.typeParameters, func(p *Type) bool { return c.getDefaultFromTypeParameter(p) != nil })
 * 		contextualType := c.getContextualType(node, core.IfElse(skipBindingPatterns, ContextFlagsSkipBindingPatterns, ContextFlagsNone))
 * 		if contextualType != nil {
 * 			inferenceTargetType := c.getReturnTypeOfSignature(signature)
 * 			if c.couldContainTypeVariables(inferenceTargetType) {
 * 				outerContext := c.getInferenceContext(node)
 * 				isFromBindingPattern := !skipBindingPatterns && c.getContextualType(node, ContextFlagsSkipBindingPatterns) != contextualType
 * 				// A return type inference from a binding pattern can be used in instantiating the contextual
 * 				// type of an argument later in inference, but cannot stand on its own as the final return type.
 * 				// It is incorporated into `context.returnMapper` which is used in `instantiateContextualType`,
 * 				// but doesn't need to go into `context.inferences`. This allows a an array binding pattern to
 * 				// produce a tuple for `T` in
 * 				//   declare function f<T>(cb: () => T): T;
 * 				//   const [e1, e2, e3] = f(() => [1, "hi", true]);
 * 				// but does not produce any inference for `T` in
 * 				//   declare function f<T>(): T;
 * 				//   const [e1, e2, e3] = f();
 * 				if !isFromBindingPattern {
 * 					// We clone the inference context to avoid disturbing a resolution in progress for an
 * 					// outer call expression. Effectively we just want a snapshot of whatever has been
 * 					// inferred for any outer call expression so far.
 * 					outerMapper := c.getMapperFromContext(c.cloneInferenceContext(outerContext, InferenceFlagsNoDefault))
 * 					instantiatedType := c.instantiateType(contextualType, outerMapper)
 * 					// If the contextual type is a generic function type with a single call signature, we
 * 					// instantiate the type with its own type parameters and type arguments. This ensures that
 * 					// the type parameters are not erased to type any during type inference such that they can
 * 					// be inferred as actual types from the contextual type. For example:
 * 					//   declare function arrayMap<T, U>(f: (x: T) => U): (a: T[]) => U[];
 * 					//   const boxElements: <A>(a: A[]) => { value: A }[] = arrayMap(value => ({ value }));
 * 					// Above, the type of the 'value' parameter is inferred to be 'A'.
 * 					contextualSignature := c.getSingleCallSignature(instantiatedType)
 * 					var inferenceSourceType *Type
 * 					if contextualSignature != nil && len(contextualSignature.typeParameters) != 0 {
 * 						inferenceSourceType = c.getOrCreateTypeFromSignature(c.getSignatureInstantiationWithoutFillingInTypeArguments(contextualSignature, contextualSignature.typeParameters))
 * 					} else {
 * 						inferenceSourceType = instantiatedType
 * 					}
 * 					// Inferences made from return types have lower priority than all other inferences.
 * 					c.inferTypes(context.inferences, inferenceSourceType, inferenceTargetType, InferencePriorityReturnType, false)
 * 				}
 * 				// Create a type mapper for instantiating generic contextual types using the inferences made
 * 				// from the return type. We need a separate inference pass here because (a) instantiation of
 * 				// the source type uses the outer context's return mapper (which excludes inferences made from
 * 				// outer arguments), and (b) we don't want any further inferences going into this context.
 * 				// We use `createOuterReturnMapper` to ensure that all occurrences of outer type parameters are
 * 				// replaced with inferences produced from the outer return type or preceding outer arguments.
 * 				// This protects against circular inferences, i.e. avoiding situations where inferences reference
 * 				// type parameters for which the inferences are being made.
 * 				returnContext := c.newInferenceContext(signature.typeParameters, signature, context.flags, nil)
 * 				var outerReturnMapper *TypeMapper
 * 				if outerContext != nil {
 * 					outerReturnMapper = c.createOuterReturnMapper(outerContext)
 * 				}
 * 				returnSourceType := c.instantiateType(contextualType, outerReturnMapper)
 * 				c.inferTypes(returnContext.inferences, returnSourceType, inferenceTargetType, InferencePriorityNone, false)
 * 				if core.Some(returnContext.inferences, hasInferenceCandidates) {
 * 					context.returnMapper = c.getMapperFromContext(c.cloneInferredPartOfContext(returnContext))
 * 				} else {
 * 					context.returnMapper = nil
 * 				}
 * 			}
 * 		}
 * 	}
 * 	restType := c.getNonArrayRestType(signature)
 * 	argCount := len(args)
 * 	if restType != nil {
 * 		argCount = min(c.getParameterCount(signature)-1, argCount)
 * 	}
 * 	if restType != nil && restType.flags&TypeFlagsTypeParameter != 0 {
 * 		info := core.Find(context.inferences, func(info *InferenceInfo) bool { return info.typeParameter == restType })
 * 		if info != nil {
 * 			if core.FindIndex(args[argCount:], isSpreadArgument) < 0 {
 * 				info.impliedArity = len(args) - argCount
 * 			}
 * 		}
 * 	}
 * 	thisType := c.getThisTypeOfSignature(signature)
 * 	if thisType != nil && c.couldContainTypeVariables(thisType) {
 * 		thisArgumentNode := c.getThisArgumentOfCall(node)
 * 		c.inferTypes(context.inferences, c.getThisArgumentType(thisArgumentNode), thisType, InferencePriorityNone, false)
 * 	}
 * 	for i := range argCount {
 * 		arg := args[i]
 * 		if arg.Kind != ast.KindOmittedExpression {
 * 			paramType := c.getTypeAtPosition(signature, i)
 * 			if c.couldContainTypeVariables(paramType) {
 * 				argType := c.checkExpressionWithContextualType(arg, paramType, context, checkMode)
 * 				c.inferTypes(context.inferences, argType, paramType, InferencePriorityNone, false)
 * 			}
 * 		}
 * 	}
 * 	if restType != nil && c.couldContainTypeVariables(restType) {
 * 		spreadType := c.getSpreadArgumentType(args, argCount, len(args), restType, context, checkMode)
 * 		c.inferTypes(context.inferences, spreadType, restType, InferencePriorityNone, false)
 * 	}
 * 	return c.getInferredTypes(context)
 * }
 */
export function Checker_inferTypeArguments(receiver: GoPtr<Checker>, node: GoPtr<Node>, signature: GoPtr<Signature>, args: GoSlice<GoPtr<Node>>, checkMode: CheckMode, context: GoPtr<InferenceContext>): GoSlice<GoPtr<Type>> {
  if (IsJsxOpeningLikeElement(node)) {
    return Checker_inferJsxTypeArguments(receiver, node, signature, checkMode, context);
  }
  if (!IsDecorator(node) && !IsBinaryExpression(node)) {
    const skipBindingPatterns = core.Every(signature!.typeParameters, (p: GoPtr<Type>): bool => Checker_getDefaultFromTypeParameter(receiver, p) !== undefined);
    const contextualType = Checker_getContextualType(receiver, node, skipBindingPatterns ? ContextFlagsSkipBindingPatterns : ContextFlagsNone);
    if (contextualType !== undefined) {
      const inferenceTargetType = Checker_getReturnTypeOfSignature(receiver, signature);
      if (receiver!.couldContainTypeVariables(inferenceTargetType)) {
        const outerContext = Checker_getInferenceContext(receiver, node);
        const isFromBindingPattern = !skipBindingPatterns && Checker_getContextualType(receiver, node, ContextFlagsSkipBindingPatterns) !== contextualType;
        if (!isFromBindingPattern) {
          const outerMapper = Checker_getMapperFromContext(receiver, Checker_cloneInferenceContext(receiver, outerContext, InferenceFlagsNoDefault));
          const instantiatedType = Checker_instantiateType(receiver, contextualType, outerMapper);
          const contextualSignature = Checker_getSingleCallSignature(receiver, instantiatedType);
          let inferenceSourceType: GoPtr<Type>;
          if (contextualSignature !== undefined && contextualSignature!.typeParameters.length !== 0) {
            inferenceSourceType = Checker_getOrCreateTypeFromSignature(receiver, Checker_getSignatureInstantiationWithoutFillingInTypeArguments(receiver, contextualSignature, contextualSignature!.typeParameters));
          } else {
            inferenceSourceType = instantiatedType;
          }
          Checker_inferTypes(receiver, context!.inferences, inferenceSourceType, inferenceTargetType, InferencePriorityReturnType, false);
        }
        const returnContext = Checker_newInferenceContext(receiver, signature!.typeParameters, signature, context!.flags, undefined);
        let outerReturnMapper: GoPtr<TypeMapper>;
        if (outerContext !== undefined) {
          outerReturnMapper = Checker_createOuterReturnMapper(receiver, outerContext);
        }
        const returnSourceType = Checker_instantiateType(receiver, contextualType, outerReturnMapper);
        Checker_inferTypes(receiver, returnContext!.inferences, returnSourceType, inferenceTargetType, InferencePriorityNone, false);
        if (core.Some(returnContext!.inferences, hasInferenceCandidates)) {
          context!.returnMapper = Checker_getMapperFromContext(receiver, Checker_cloneInferredPartOfContext(receiver, returnContext));
        } else {
          context!.returnMapper = undefined;
        }
      }
    }
  }
  const restType = Checker_getNonArrayRestType(receiver, signature);
  let argCount = args.length;
  if (restType !== undefined) {
    argCount = Math.min(Checker_getParameterCount(receiver, signature) - 1, argCount) as int;
  }
  if (restType !== undefined && (restType!.flags & TypeFlagsTypeParameter) !== 0) {
    const info = core.Find(context!.inferences, (inference: GoPtr<InferenceInfo>): bool => inference!.typeParameter === restType);
    if (info !== undefined) {
      if (core.FindIndex(args.slice(argCount), isSpreadArgument) < 0) {
        info!.impliedArity = args.length - argCount;
      }
    }
  }
  const thisType = Checker_getThisTypeOfSignature(receiver, signature);
  if (thisType !== undefined && receiver!.couldContainTypeVariables(thisType)) {
    const thisArgumentNode = Checker_getThisArgumentOfCall(receiver, node);
    Checker_inferTypes(receiver, context!.inferences, Checker_getThisArgumentType(receiver, thisArgumentNode), thisType, InferencePriorityNone, false);
  }
  for (let index = 0; index < argCount; index++) {
    const arg = args[index];
    if (!IsOmittedExpression(arg)) {
      const paramType = Checker_getTypeAtPosition(receiver, signature, index as int);
      if (receiver!.couldContainTypeVariables(paramType)) {
        const argType = Checker_checkExpressionWithContextualType(receiver, arg, paramType, context, checkMode);
        Checker_inferTypes(receiver, context!.inferences, argType, paramType, InferencePriorityNone, false);
      }
    }
  }
  if (restType !== undefined && receiver!.couldContainTypeVariables(restType)) {
    const spreadType = Checker_getSpreadArgumentType(receiver, args, argCount, args.length as int, restType, context, checkMode);
    Checker_inferTypes(receiver, context!.inferences, spreadType, restType, InferencePriorityNone, false);
  }
  return Checker_getInferredTypes(receiver, context);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getCandidateForOverloadFailure","kind":"method","status":"implemented","sigHash":"ab4486c5b410abb656fce477c7849a44c21d03a5a04afaa78253fa95f1957f1b","bodyHash":"e7e69142739c436659cbd6b79ca4c935036ff3955006de3fe1467b614265749b"}
 *
 * Go source:
 * func (c *Checker) getCandidateForOverloadFailure(node *ast.Node, candidates []*Signature, args []*ast.Node, hasCandidatesOutArray bool, checkMode CheckMode) *Signature {
 * 	// Else should not have called this.
 * 	c.checkNodeDeferred(node)
 * 	// Normally we will combine overloads. Skip this if they have type parameters since that's hard to combine.
 * 	// Don't do this if there is a `candidatesOutArray`,
 * 	// because then we want the chosen best candidate to be one of the overloads, not a combination.
 * 	if hasCandidatesOutArray || len(candidates) == 1 || core.Some(candidates, func(s *Signature) bool { return len(s.typeParameters) != 0 }) {
 * 		return c.pickLongestCandidateSignature(node, candidates, args, checkMode)
 * 	}
 * 	return c.createUnionOfSignaturesForOverloadFailure(candidates)
 * }
 */
export function Checker_getCandidateForOverloadFailure(receiver: GoPtr<Checker>, node: GoPtr<Node>, candidates: GoSlice<GoPtr<Signature>>, args: GoSlice<GoPtr<Node>>, hasCandidatesOutArray: bool, checkMode: CheckMode): GoPtr<Signature> {
  Checker_checkNodeDeferred(receiver, node);
  if (hasCandidatesOutArray || candidates.length === 1 || core.Some(candidates, (s: GoPtr<Signature>) => s!.typeParameters.length !== 0)) {
    return Checker_pickLongestCandidateSignature(receiver, node, candidates, args, checkMode);
  }
  return Checker_createUnionOfSignaturesForOverloadFailure(receiver, candidates);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.pickLongestCandidateSignature","kind":"method","status":"implemented","sigHash":"c16caa097d4952ada11619bd0659a818746c68e4a934ca13111ea719764b8f88","bodyHash":"dfa000ad854b2fe42d643c9532cc3911720ce53e58670175757d9db31cec6a56"}
 *
 * Go source:
 * func (c *Checker) pickLongestCandidateSignature(node *ast.Node, candidates []*Signature, args []*ast.Node, checkMode CheckMode) *Signature {
 * 	// Pick the longest signature. This way we can get a contextual type for cases like:
 * 	//     declare function f(a: { xa: number; xb: number; }, b: number);
 * 	//     f({ |
 * 	// Also, use explicitly-supplied type arguments if they are provided, so we can get a contextual signature in cases like:
 * 	//     declare function f<T>(k: keyof T);
 * 	//     f<Foo>("
 * 	argCount := len(args)
 * 	if c.apparentArgumentCount != nil {
 * 		argCount = *c.apparentArgumentCount
 * 	}
 * 	bestIndex := c.getLongestCandidateIndex(candidates, argCount)
 * 	candidate := candidates[bestIndex]
 * 	typeParameters := candidate.typeParameters
 * 	if len(typeParameters) == 0 {
 * 		return candidate
 * 	}
 * 	var typeArgumentNodes []*ast.Node
 * 	if c.callLikeExpressionMayHaveTypeArguments(node) {
 * 		typeArgumentNodes = node.TypeArguments()
 * 	}
 * 	var instantiated *Signature
 * 	if len(typeArgumentNodes) != 0 {
 * 		instantiated = c.createSignatureInstantiation(candidate, c.getTypeArgumentsFromNodes(typeArgumentNodes, typeParameters))
 * 	} else {
 * 		instantiated = c.inferSignatureInstantiationForOverloadFailure(node, typeParameters, candidate, args, checkMode)
 * 	}
 * 	candidates[bestIndex] = instantiated
 * 	return instantiated
 * }
 */
export function Checker_pickLongestCandidateSignature(receiver: GoPtr<Checker>, node: GoPtr<Node>, candidates: GoSlice<GoPtr<Signature>>, args: GoSlice<GoPtr<Node>>, checkMode: CheckMode): GoPtr<Signature> {
  // Go: len(nil) == 0.
  let argCount = (args ?? []).length;
  if (receiver!.apparentArgumentCount !== undefined) {
    argCount = receiver!.apparentArgumentCount;
  }
  const bestIndex = Checker_getLongestCandidateIndex(receiver, candidates, argCount as int);
  const candidate = candidates[bestIndex];
  const typeParameters = candidate!.typeParameters;
  // Go: len(nil) == 0.
  if ((typeParameters ?? []).length === 0) {
    return candidate;
  }
  let typeArgumentNodes: GoSlice<GoPtr<Node>> = [];
  if (Checker_callLikeExpressionMayHaveTypeArguments(receiver, node)) {
    typeArgumentNodes = Node_TypeArguments(node) ?? [];
  }
  let instantiated: GoPtr<Signature>;
  if (typeArgumentNodes.length !== 0) {
    instantiated = Checker_createSignatureInstantiation(receiver, candidate, Checker_getTypeArgumentsFromNodes(receiver, typeArgumentNodes, typeParameters));
  } else {
    instantiated = Checker_inferSignatureInstantiationForOverloadFailure(receiver, node, typeParameters, candidate, args, checkMode);
  }
  candidates[bestIndex] = instantiated;
  return instantiated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getLongestCandidateIndex","kind":"method","status":"implemented","sigHash":"f8487c2f27473a6379f7a918bdfecbbb96e7509a26930ed003e46e472369399b","bodyHash":"685ef445ab22ef3665f41f77fd570bb4ebddaff7c4be47952bb4e3a4394c35ce"}
 *
 * Go source:
 * func (c *Checker) getLongestCandidateIndex(candidates []*Signature, argsCount int) int {
 * 	maxParamsIndex := -1
 * 	maxParams := -1
 * 	for i, candidate := range candidates {
 * 		paramCount := c.getParameterCount(candidate)
 * 		if c.hasEffectiveRestParameter(candidate) || paramCount >= argsCount {
 * 			return i
 * 		}
 * 		if paramCount > maxParams {
 * 			maxParams = paramCount
 * 			maxParamsIndex = i
 * 		}
 * 	}
 * 	return maxParamsIndex
 * }
 */
export function Checker_getLongestCandidateIndex(receiver: GoPtr<Checker>, candidates: GoSlice<GoPtr<Signature>>, argsCount: int): int {
  let maxParamsIndex = -1;
  let maxParams = -1;
  for (let i = 0; i < (candidates ?? []).length; i++) {
    const candidate = (candidates ?? [])[i];
    const paramCount = Checker_getParameterCount(receiver, candidate);
    if (Checker_hasEffectiveRestParameter(receiver, candidate) || paramCount >= argsCount) {
      return i;
    }
    if (paramCount > maxParams) {
      maxParams = paramCount;
      maxParamsIndex = i;
    }
  }
  return maxParamsIndex;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeArgumentsFromNodes","kind":"method","status":"implemented","sigHash":"175b82662258236838122affbda94e8625a90c22003385e776266dcf20f9bc77","bodyHash":"1ae8a416fa2508aa823351ed5bf840b7458b99bae78fe5f3530482de9a201213"}
 *
 * Go source:
 * func (c *Checker) getTypeArgumentsFromNodes(typeArgumentNodes []*ast.Node, typeParameters []*Type) []*Type {
 * 	if len(typeArgumentNodes) > len(typeParameters) {
 * 		typeArgumentNodes = typeArgumentNodes[:len(typeParameters)]
 * 	}
 * 	typeArguments := core.Map(typeArgumentNodes, c.getTypeFromTypeNode)
 * 	for len(typeArguments) < len(typeParameters) {
 * 		t := c.getDefaultFromTypeParameter(typeParameters[len(typeArguments)])
 * 		if t == nil {
 * 			t = c.getConstraintOfTypeParameter(typeParameters[len(typeArguments)])
 * 			if t == nil {
 * 				t = c.unknownType
 * 			}
 * 		}
 * 		typeArguments = append(typeArguments, t)
 * 	}
 * 	return typeArguments
 * }
 */
export function Checker_getTypeArgumentsFromNodes(receiver: GoPtr<Checker>, typeArgumentNodes: GoSlice<GoPtr<Node>>, typeParameters: GoSlice<GoPtr<Type>>): GoSlice<GoPtr<Type>> {
  let nodes = typeArgumentNodes;
  if ((nodes ?? []).length > (typeParameters ?? []).length) {
    nodes = (nodes ?? []).slice(0, (typeParameters ?? []).length) as GoSlice<GoPtr<Node>>;
  }
  const typeArguments = core.Map(nodes, (n: GoPtr<Node>) => Checker_getTypeFromTypeNode(receiver, n));
  let result = typeArguments ?? [] as Array<GoPtr<Type>>;
  while (result.length < (typeParameters ?? []).length) {
    let t = Checker_getDefaultFromTypeParameter(receiver, (typeParameters ?? [])[result.length]);
    if (t === undefined) {
      t = Checker_getConstraintOfTypeParameter(receiver, (typeParameters ?? [])[result.length]);
      if (t === undefined) {
        t = receiver!.unknownType;
      }
    }
    result = [...result, t];
  }
  return result as GoSlice<GoPtr<Type>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.inferSignatureInstantiationForOverloadFailure","kind":"method","status":"implemented","sigHash":"e55d2ffad4c11aab49154f5c16b5187a4fc508c3bfe4e17ba9939e883ea5d3ae","bodyHash":"9b5e151ea3969d20225bfa32cee596de6a504f58d0cab65f9992e15fe4d21711"}
 *
 * Go source:
 * func (c *Checker) inferSignatureInstantiationForOverloadFailure(node *ast.Node, typeParameters []*Type, candidate *Signature, args []*ast.Node, checkMode CheckMode) *Signature {
 * 	inferenceContext := c.newInferenceContext(typeParameters, candidate, core.IfElse(ast.IsInJSFile(node), InferenceFlagsAnyDefault, InferenceFlagsNone), nil)
 * 	typeArgumentTypes := c.inferTypeArguments(node, candidate, args, checkMode|CheckModeSkipContextSensitive|CheckModeSkipGenericFunctions, inferenceContext)
 * 	return c.createSignatureInstantiation(candidate, typeArgumentTypes)
 * }
 */
export function Checker_inferSignatureInstantiationForOverloadFailure(receiver: GoPtr<Checker>, node: GoPtr<Node>, typeParameters: GoSlice<GoPtr<Type>>, candidate: GoPtr<Signature>, args: GoSlice<GoPtr<Node>>, checkMode: CheckMode): GoPtr<Signature> {
  const inferenceContext = Checker_newInferenceContext(receiver, typeParameters, candidate, core.IfElse(IsInJSFile(node), InferenceFlagsAnyDefault, InferenceFlagsNone), receiver!.compareTypesAssignable);
  const typeArgumentTypes = Checker_inferTypeArguments(receiver, node, candidate, args, checkMode | CheckModeSkipContextSensitive | CheckModeSkipGenericFunctions, inferenceContext);
  return Checker_createSignatureInstantiation(receiver, candidate, typeArgumentTypes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createUnionOfSignaturesForOverloadFailure","kind":"method","status":"implemented","sigHash":"057ae6581f91a2ef4941f1a22b22792aee26f23961584da8f51173b2ee9773f6","bodyHash":"8227db00841f75e213934af3bf279794710bdc02071b684e95e9ceb95876f57d"}
 *
 * Go source:
 * func (c *Checker) createUnionOfSignaturesForOverloadFailure(candidates []*Signature) *Signature {
 * 	thisParameters := core.MapNonNil(candidates, func(c *Signature) *ast.Symbol { return c.thisParameter })
 * 	var thisParameter *ast.Symbol
 * 	if len(thisParameters) != 0 {
 * 		thisParameter = c.createCombinedSymbolFromTypes(thisParameters, core.Map(thisParameters, c.getTypeOfParameter))
 * 	}
 * 	minArgumentCount, maxNonRestParam := minAndMax(candidates, getNonRestParameterCount)
 * 	parameters := make([]*ast.Symbol, 0, maxNonRestParam)
 * 	for i := range maxNonRestParam {
 * 		symbols := core.MapNonNil(candidates, func(s *Signature) *ast.Symbol {
 * 			if signatureHasRestParameter(s) {
 * 				if i < len(s.parameters)-1 {
 * 					return s.parameters[i]
 * 				}
 * 				return core.LastOrNil(s.parameters)
 * 			}
 * 			if i < len(s.parameters) {
 * 				return s.parameters[i]
 * 			}
 * 			return nil
 * 		})
 * 		parameters = append(parameters, c.createCombinedSymbolFromTypes(symbols, core.MapNonNil(candidates, func(s *Signature) *Type { return c.tryGetTypeAtPosition(s, i) })))
 * 	}
 * 	restParameterSymbols := core.MapNonNil(candidates, func(s *Signature) *ast.Symbol {
 * 		if signatureHasRestParameter(s) {
 * 			return core.LastOrNil(s.parameters)
 * 		}
 * 		return nil
 * 	})
 * 	flags := SignatureFlagsIsSignatureCandidateForOverloadFailure
 * 	if len(restParameterSymbols) != 0 {
 * 		t := c.createArrayType(c.getUnionTypeEx(core.MapNonNil(candidates, c.tryGetRestTypeOfSignature), UnionReductionSubtype, nil, nil))
 * 		parameters = append(parameters, c.createCombinedSymbolForOverloadFailure(restParameterSymbols, t))
 * 		flags |= SignatureFlagsHasRestParameter
 * 	}
 * 	if core.Some(candidates, signatureHasLiteralTypes) {
 * 		flags |= SignatureFlagsHasLiteralTypes
 * 	}
 * 	return c.newSignature(flags, candidates[0].declaration, nil, thisParameter, parameters, c.getIntersectionType(core.Map(candidates, c.getReturnTypeOfSignature)), nil, minArgumentCount)
 * }
 */
export function Checker_createUnionOfSignaturesForOverloadFailure(receiver: GoPtr<Checker>, candidates: GoSlice<GoPtr<Signature>>): GoPtr<Signature> {
  const thisParameters = core.MapNonNil(candidates, (candidate: GoPtr<Signature>) => candidate!.thisParameter);
  let thisParameter: GoPtr<Symbol>;
  if (thisParameters.length !== 0) {
    thisParameter = Checker_createCombinedSymbolFromTypes(receiver, thisParameters, core.Map(thisParameters, (symbol_: GoPtr<Symbol>) => Checker_getTypeOfParameter(receiver, symbol_)));
  }
  const [minArgumentCount, maxNonRestParam] = minAndMax(candidates, getNonRestParameterCount);
  const parameters: GoSlice<GoPtr<Symbol>> = [];
  for (let i = 0; i < maxNonRestParam; i++) {
    const index = i as int;
    const symbols = core.MapNonNil(candidates, (signature: GoPtr<Signature>) => {
      if (signatureHasRestParameter(signature)) {
        if (index < signature!.parameters.length - 1) {
          return signature!.parameters[index];
        }
        return core.LastOrNil(signature!.parameters);
      }
      if (index < signature!.parameters.length) {
        return signature!.parameters[index];
      }
      return undefined;
    });
    parameters.push(Checker_createCombinedSymbolFromTypes(receiver, symbols, core.MapNonNil(candidates, (signature: GoPtr<Signature>) => Checker_tryGetTypeAtPosition(receiver, signature, index))));
  }
  const restParameterSymbols = core.MapNonNil(candidates, (signature: GoPtr<Signature>) => {
    if (signatureHasRestParameter(signature)) {
      return core.LastOrNil(signature!.parameters);
    }
    return undefined;
  });
  let flags = SignatureFlagsIsSignatureCandidateForOverloadFailure;
  if (restParameterSymbols.length !== 0) {
    const restType = Checker_createArrayType(receiver, Checker_getUnionTypeEx(receiver, core.MapNonNil(candidates, (signature: GoPtr<Signature>) => Checker_tryGetRestTypeOfSignature(receiver, signature)), UnionReductionSubtype, undefined, undefined));
    parameters.push(Checker_createCombinedSymbolForOverloadFailure(receiver, restParameterSymbols, restType));
    flags |= SignatureFlagsHasRestParameter;
  }
  if (core.Some(candidates, signatureHasLiteralTypes)) {
    flags |= SignatureFlagsHasLiteralTypes;
  }
  return Checker_newSignature(receiver, flags, candidates[0]!.declaration, [], thisParameter, parameters, Checker_getIntersectionType(receiver, core.Map(candidates, (signature: GoPtr<Signature>) => Checker_getReturnTypeOfSignature(receiver, signature))), undefined, minArgumentCount);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createCombinedSymbolForOverloadFailure","kind":"method","status":"implemented","sigHash":"822daf1cf621be165ccb32287376da529708305fdd165316e95c69e38fb09f4c","bodyHash":"3212e59f5010cc0fd16a51494ab80a27d8cf10a37c1ae326ce3efa6eefd8602e"}
 *
 * Go source:
 * func (c *Checker) createCombinedSymbolForOverloadFailure(sources []*ast.Symbol, t *Type) *ast.Symbol {
 * 	// This function is currently only used for erroneous overloads, so it's good enough to just use the first source.
 * 	return c.createSymbolWithType(core.FirstOrNil(sources), t)
 * }
 */
export function Checker_createCombinedSymbolForOverloadFailure(receiver: GoPtr<Checker>, sources: GoSlice<GoPtr<Symbol>>, t: GoPtr<Type>): GoPtr<Symbol> {
  return Checker_createSymbolWithType(receiver, core.FirstOrNil(sources), t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getRestTypeOfSignature","kind":"method","status":"implemented","sigHash":"76f68d3a8adac3bb68f10d1a84f3cac3fefaeb3cf51231adb650007352ef5459","bodyHash":"5b8cb12b911acf5d09dd143fdaa82c25058b98281a7a6138b6afc67a40032a92"}
 *
 * Go source:
 * func (c *Checker) getRestTypeOfSignature(signature *Signature) *Type {
 * 	return core.OrElse(c.tryGetRestTypeOfSignature(signature), c.anyType)
 * }
 */
export function Checker_getRestTypeOfSignature(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): GoPtr<Type> {
  return core.OrElse(Checker_tryGetRestTypeOfSignature(receiver, signature), receiver!.anyType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.tryGetRestTypeOfSignature","kind":"method","status":"implemented","sigHash":"8fb89747698eb0db5dae0adc6ceee4cea5a7327fabd9fb674668fba11f336282","bodyHash":"291b9e2226498598bb08eedaca107c34c44b16644dff68f0f0f71fac9e1a3797"}
 *
 * Go source:
 * func (c *Checker) tryGetRestTypeOfSignature(signature *Signature) *Type {
 * 	if !signatureHasRestParameter(signature) {
 * 		return nil
 * 	}
 * 	restType := c.getTypeOfSymbol(signature.parameters[len(signature.parameters)-1])
 * 	if isTupleType(restType) {
 * 		restType = c.getRestTypeOfTupleType(restType)
 * 		if restType == nil {
 * 			return nil
 * 		}
 * 	}
 * 	return c.getIndexTypeOfType(restType, c.numberType)
 * }
 */
export function Checker_tryGetRestTypeOfSignature(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): GoPtr<Type> {
  if (!signatureHasRestParameter(signature)) {
    return undefined;
  }
  let restType = Checker_getTypeOfSymbol(receiver, signature!.parameters[signature!.parameters.length - 1]);
  if (isTupleType(restType)) {
    restType = Checker_getRestTypeOfTupleType(receiver, restType);
    if (restType === undefined) {
      return undefined;
    }
  }
  return Checker_getIndexTypeOfType(receiver, restType, receiver!.numberType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveUntypedCall","kind":"method","status":"implemented","sigHash":"7e3b1eb3dae3b2231aa77ec38dadd33d60d96079e8cb00b31a91db6368be1c2d","bodyHash":"3c329c1e25e4a5ed5caf75d9fa3cd7fcf3299d583c5c6e0cd6c3e55fa6caaa83"}
 *
 * Go source:
 * func (c *Checker) resolveUntypedCall(node *ast.Node) *Signature {
 * 	if c.callLikeExpressionMayHaveTypeArguments(node) {
 * 		// Check type arguments even though we will give an error that untyped calls may not accept type arguments.
 * 		// This gets us diagnostics for the type arguments and marks them as referenced.
 * 		c.checkSourceElements(node.TypeArguments())
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindTaggedTemplateExpression:
 * 		c.checkExpression(node.AsTaggedTemplateExpression().Template)
 * 	case ast.KindJsxOpeningElement, ast.KindJsxSelfClosingElement:
 * 		c.checkExpression(node.Attributes())
 * 	case ast.KindBinaryExpression:
 * 		c.checkExpression(node.AsBinaryExpression().Left)
 * 	case ast.KindCallExpression, ast.KindNewExpression:
 * 		for _, argument := range node.Arguments() {
 * 			c.checkExpression(argument)
 * 		}
 * 	}
 * 	return c.anySignature
 * }
 */
export function Checker_resolveUntypedCall(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Signature> {
  if (Checker_callLikeExpressionMayHaveTypeArguments(receiver, node)) {
    Checker_checkSourceElements(receiver, Node_TypeArguments(node) ?? []);
  }
  switch (node!.Kind) {
    case KindTaggedTemplateExpression:
      Checker_checkExpression(receiver, AsTaggedTemplateExpression(node)!.Template);
      break;
    case KindJsxOpeningElement:
    case KindJsxSelfClosingElement:
      Checker_checkExpression(receiver, Node_Attributes(node));
      break;
    case KindBinaryExpression:
      Checker_checkExpression(receiver, AsBinaryExpression(node)!.Left);
      break;
    case KindCallExpression:
    case KindNewExpression:
      for (const argument of Node_Arguments(node) ?? []) {
        Checker_checkExpression(receiver, argument);
      }
      break;
  }
  return receiver!.anySignature;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isUntypedFunctionCall","kind":"method","status":"implemented","sigHash":"5687d856700d885e66b95d32af1a98aa745bf4d75e7d3e5dc2c6dc465503d7e1","bodyHash":"c5c158118acf483a5b2760a71dc2feb5e8cb4f633210021e3dad74e615786b38"}
 *
 * Go source:
 * func (c *Checker) isUntypedFunctionCall(funcType *Type, apparentFuncType *Type, numCallSignatures int, numConstructSignatures int) bool {
 * 	// We exclude union types because we may have a union of function types that happen to have no common signatures.
 * 	return IsTypeAny(funcType) || IsTypeAny(apparentFuncType) && funcType.flags&TypeFlagsTypeParameter != 0 ||
 * 		numCallSignatures == 0 && numConstructSignatures == 0 && apparentFuncType.flags&TypeFlagsUnion == 0 &&
 * 			c.getReducedType(apparentFuncType).flags&TypeFlagsNever == 0 && c.isTypeAssignableTo(funcType, c.globalFunctionType)
 * }
 */
export function Checker_isUntypedFunctionCall(receiver: GoPtr<Checker>, funcType: GoPtr<Type>, apparentFuncType: GoPtr<Type>, numCallSignatures: int, numConstructSignatures: int): bool {
  return IsTypeAny(funcType) || IsTypeAny(apparentFuncType) && (funcType!.flags & TypeFlagsTypeParameter) !== 0 ||
    numCallSignatures === 0 && numConstructSignatures === 0 && (apparentFuncType!.flags & TypeFlagsUnion) === 0 &&
      (Checker_getReducedType(receiver, apparentFuncType)!.flags & TypeFlagsNever) === 0 && Checker_isTypeAssignableTo(receiver, funcType, receiver!.globalFunctionType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.inferFromAnnotatedParametersAndReturn","kind":"method","status":"implemented","sigHash":"74fdce54c2adde046a52bd5968ba76b1becbdc3842674d83359d69192092a9b4","bodyHash":"5809510eda289457db643f62d6bc0d5f3b1f79eda1021165275996576c1d2bc6"}
 *
 * Go source:
 * func (c *Checker) inferFromAnnotatedParametersAndReturn(sig *Signature, context *Signature, inferenceContext *InferenceContext) {
 * 	length := len(sig.parameters) - core.IfElse(signatureHasRestParameter(sig), 1, 0)
 * 	for i := range length {
 * 		declaration := sig.parameters[i].ValueDeclaration
 * 		typeNode := declaration.Type()
 * 		if typeNode != nil {
 * 			source := c.addOptionalityEx(c.getTypeFromTypeNode(typeNode), false /*isProperty* /, isOptionalDeclaration(declaration))
 * 			target := c.getTypeAtPosition(context, i)
 * 			c.inferTypes(inferenceContext.inferences, source, target, InferencePriorityNone, false)
 * 		}
 * 	}
 * 	if declaration := sig.Declaration(); declaration != nil {
 * 		if returnTypeNode := declaration.Type(); returnTypeNode != nil {
 * 			source := c.getTypeFromTypeNode(returnTypeNode)
 * 			target := c.getReturnTypeOfSignature(context)
 * 			c.inferTypes(inferenceContext.inferences, source, target, InferencePriorityNone, false)
 * 		}
 * 	}
 * }
 */
export function Checker_inferFromAnnotatedParametersAndReturn(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, context: GoPtr<Signature>, inferenceContext: GoPtr<InferenceContext>): void {
  const length = sig!.parameters.length - core.IfElse(signatureHasRestParameter(sig), 1, 0);
  for (let i = 0; i < length; i++) {
    const declaration = sig!.parameters[i]!.ValueDeclaration;
    const typeNode = Node_Type(declaration);
    if (typeNode !== undefined) {
      const source = Checker_addOptionalityEx(receiver, Checker_getTypeFromTypeNode(receiver, typeNode), false, isOptionalDeclaration(declaration));
      const target = Checker_getTypeAtPosition(receiver, context, i);
      Checker_inferTypes(receiver, inferenceContext!.inferences, source, target, InferencePriorityNone, false);
    }
  }
  const declaration = Signature_Declaration(sig);
  if (declaration !== undefined) {
    const returnTypeNode = Node_Type(declaration);
    if (returnTypeNode !== undefined) {
      const source = Checker_getTypeFromTypeNode(receiver, returnTypeNode);
      const target = Checker_getReturnTypeOfSignature(receiver, context);
      Checker_inferTypes(receiver, inferenceContext!.inferences, source, target, InferencePriorityNone, false);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getContextualSignature","kind":"method","status":"implemented","sigHash":"294412cb2bc75fb56ce9d998ac3af4a9dab9831b8381aceae27be5aafae2a65e","bodyHash":"d3da003677cd6578e09ef01c5ca8926d5a6d66748b6ad4e6c8abe71dd660146c"}
 *
 * Go source:
 * func (c *Checker) getContextualSignature(node *ast.Node) *Signature {
 * 	t := c.getApparentTypeOfContextualType(node, ContextFlagsSignature)
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	if t.flags&TypeFlagsUnion == 0 {
 * 		return c.getContextualCallSignature(t, node)
 * 	}
 * 	var signatureList []*Signature
 * 	types := t.Types()
 * 	for _, current := range types {
 * 		signature := c.getContextualCallSignature(current, node)
 * 		if signature != nil {
 * 			if len(signatureList) != 0 && c.compareSignaturesIdentical(signatureList[0], signature, false /*partialMatch* /, true /*ignoreThisTypes* /, true /*ignoreReturnTypes* /, c.compareTypesIdentical) == TernaryFalse {
 * 				// Signatures aren't identical, do not use
 * 				return nil
 * 			}
 * 			// Use this signature for contextual union signature
 * 			signatureList = append(signatureList, signature)
 * 		}
 * 	}
 * 	switch len(signatureList) {
 * 	case 0:
 * 		return nil
 * 	case 1:
 * 		return signatureList[0]
 * 	}
 * 	// Result is union of signatures collected (return type is union of return types of this signature set)
 * 	return c.createUnionSignature(signatureList[0], signatureList)
 * }
 */
export function Checker_getContextualSignature(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Signature> {
  const t = Checker_getApparentTypeOfContextualType(receiver, node, ContextFlagsSignature);
  if (t === undefined) {
    return undefined;
  }
  if ((t.flags & TypeFlagsUnion) === 0) {
    return Checker_getContextualCallSignature(receiver, t, node);
  }
  const signatureList: GoSlice<GoPtr<Signature>> = [];
  for (const current of Type_Types(t)) {
    const signature = Checker_getContextualCallSignature(receiver, current, node);
    if (signature !== undefined) {
      if (signatureList.length !== 0 && Checker_compareSignaturesIdentical(receiver, signatureList[0], signature, false, true, true, (source: GoPtr<Type>, target: GoPtr<Type>) => Checker_compareTypesIdentical(receiver, source, target)) === TernaryFalse) {
        return undefined;
      }
      signatureList.push(signature);
    }
  }
  switch (signatureList.length) {
    case 0:
      return undefined;
    case 1:
      return signatureList[0];
  }
  return Checker_createUnionSignature(receiver, signatureList[0], signatureList);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createUnionSignature","kind":"method","status":"implemented","sigHash":"20dc122192f12b73d9428047380d9de1846a14d4240e73d7b7f27ec45aee75ce","bodyHash":"5e474ae5f0c13261eabf6a0bb23e5a38be40da8f28cfe11857ef14e287599d8a"}
 *
 * Go source:
 * func (c *Checker) createUnionSignature(sig *Signature, unionSignatures []*Signature) *Signature {
 * 	result := c.cloneSignature(sig)
 * 	result.composite = &CompositeSignature{isUnion: true, signatures: unionSignatures}
 * 	result.target = nil
 * 	result.mapper = nil
 * 	return result
 * }
 */
export function Checker_createUnionSignature(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, unionSignatures: GoSlice<GoPtr<Signature>>): GoPtr<Signature> {
  const result = Checker_cloneSignature(receiver, sig);
  result!.composite = { isUnion: true, signatures: unionSignatures };
  result!.target = undefined;
  result!.mapper = undefined;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getContextualCallSignature","kind":"method","status":"implemented","sigHash":"3071240537629fe38501033a0fc2d45d0049d7928ae9b1b64c968b5be4e079d1","bodyHash":"e2537aa97c25051790cb33d4aa0de94b679e3ddfbc35d94fff6a6ba11b4aabe8"}
 *
 * Go source:
 * func (c *Checker) getContextualCallSignature(t *Type, node *ast.Node) *Signature {
 * 	signatures := c.getSignaturesOfType(t, SignatureKindCall)
 * 	applicableByArity := core.Filter(signatures, func(s *Signature) bool { return !c.isAritySmaller(s, node) })
 * 	if len(applicableByArity) == 1 {
 * 		return applicableByArity[0]
 * 	}
 * 	return c.getIntersectedSignatures(applicableByArity)
 * }
 */
export function Checker_getContextualCallSignature(receiver: GoPtr<Checker>, t: GoPtr<Type>, node: GoPtr<Node>): GoPtr<Signature> {
  const signatures = Checker_getSignaturesOfType(receiver, t, SignatureKindCall);
  const applicableByArity = core.Filter(signatures, (s: GoPtr<Signature>) => !Checker_isAritySmaller(receiver, s, node));
  if (applicableByArity.length === 1) {
    return applicableByArity[0];
  }
  return Checker_getIntersectedSignatures(receiver, applicableByArity);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIntersectedSignatures","kind":"method","status":"implemented","sigHash":"71b59e29273af8d3465ac7cbc1bce59b9cc9e4e589684edd069b23dcd0270665","bodyHash":"d951bf974a8dfcd4b5878d204a8b9e1c2c6ab59064fbce6920c7d603edae76cc"}
 *
 * Go source:
 * func (c *Checker) getIntersectedSignatures(signatures []*Signature) *Signature {
 * 	if !c.noImplicitAny {
 * 		return nil
 * 	}
 * 	var combined *Signature
 * 	for _, sig := range signatures {
 * 		switch {
 * 		case combined == sig || combined == nil:
 * 			combined = sig
 * 		case c.compareTypeParametersIdentical(combined.typeParameters, sig.typeParameters):
 * 			combined = c.combineUnionOrIntersectionMemberSignatures(combined, sig, false /*isUnion* /)
 * 		default:
 * 			return nil
 * 		}
 * 	}
 * 	return combined
 * }
 */
export function Checker_getIntersectedSignatures(receiver: GoPtr<Checker>, signatures: GoSlice<GoPtr<Signature>>): GoPtr<Signature> {
  if (!receiver!.noImplicitAny) {
    return undefined;
  }
  let combined: GoPtr<Signature> = undefined;
  for (const sig of signatures) {
    if (combined === sig || combined === undefined) {
      combined = sig;
    } else if (Checker_compareTypeParametersIdentical(receiver, combined!.typeParameters, sig!.typeParameters)) {
      combined = Checker_combineUnionOrIntersectionMemberSignatures(receiver, combined, sig, false);
    } else {
      return undefined;
    }
  }
  return combined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isAritySmaller","kind":"method","status":"implemented","sigHash":"0a448d848c2f5280132fe62fb35e1c6118a3325427cd71e086733996ebffd209","bodyHash":"09c83a3dc32ea8ed43ce911ab9aa0a3977e9fac8665318c14da69b517c6c0cdb"}
 *
 * Go source:
 * func (c *Checker) isAritySmaller(signature *Signature, target *ast.Node) bool {
 * 	parameters := target.Parameters()
 * 	targetParameterCount := 0
 * 	for targetParameterCount < len(parameters) {
 * 		param := parameters[targetParameterCount]
 * 		if param.Initializer() != nil || param.QuestionToken() != nil || hasDotDotDotToken(param) {
 * 			break
 * 		}
 * 		targetParameterCount++
 * 	}
 * 	if len(parameters) != 0 && ast.IsThisParameter(parameters[0]) {
 * 		targetParameterCount--
 * 	}
 * 	return !c.hasEffectiveRestParameter(signature) && c.getParameterCount(signature) < targetParameterCount
 * }
 */
export function Checker_isAritySmaller(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, target: GoPtr<Node>): bool {
  const parameters = Node_Parameters(target);
  let targetParameterCount = 0;
  while (targetParameterCount < parameters.length) {
    const param = parameters[targetParameterCount];
    if (Node_Initializer(param) !== undefined || Node_QuestionToken(param) !== undefined || hasDotDotDotToken(param)) {
      break;
    }
    targetParameterCount++;
  }
  if (parameters.length !== 0 && IsThisParameter(parameters[0])) {
    targetParameterCount--;
  }
  return !Checker_hasEffectiveRestParameter(receiver, signature) && Checker_getParameterCount(receiver, signature) < targetParameterCount;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.assignContextualParameterTypes","kind":"method","status":"implemented","sigHash":"bbefc7f80d9a8753e19615f445d86cf3fcd3592c29d416e55e6d2d28a96c404f","bodyHash":"5c9084a86a35a7c9ec99f02ea461e868c5724431ea510a36494896c9d25b9214"}
 *
 * Go source:
 * func (c *Checker) assignContextualParameterTypes(sig *Signature, context *Signature) {
 * 	if len(context.typeParameters) != 0 {
 * 		if len(sig.typeParameters) != 0 {
 * 			// This signature has already has a contextual inference performed and cached on it
 * 			return
 * 		}
 * 		sig.typeParameters = context.typeParameters
 * 	}
 * 	if context.thisParameter != nil {
 * 		parameter := sig.thisParameter
 * 		if parameter == nil || parameter.ValueDeclaration != nil && parameter.ValueDeclaration.Type() == nil {
 * 			if parameter == nil {
 * 				sig.thisParameter = c.createSymbolWithType(context.thisParameter, nil /*type* /)
 * 			}
 * 			c.assignParameterType(sig.thisParameter, c.getTypeOfSymbol(context.thisParameter))
 * 		}
 * 	}
 * 	length := len(sig.parameters) - core.IfElse(signatureHasRestParameter(sig), 1, 0)
 * 	for i := range length {
 * 		parameter := sig.parameters[i]
 * 		declaration := parameter.ValueDeclaration
 * 		if declaration.Type() == nil {
 * 			t := c.tryGetTypeAtPosition(context, i)
 * 			if t != nil && declaration.Initializer() != nil {
 * 				initializerType := c.checkDeclarationInitializer(declaration, CheckModeNormal, nil)
 * 				if !c.isTypeAssignableTo(initializerType, t) {
 * 					initializerType = c.widenTypeInferredFromInitializer(declaration, initializerType)
 * 					if c.isTypeAssignableTo(t, initializerType) {
 * 						t = initializerType
 * 					}
 * 				}
 * 			}
 * 			c.assignParameterType(parameter, t)
 * 		}
 * 	}
 * 	if signatureHasRestParameter(sig) {
 * 		// parameter might be a transient symbol generated by use of `arguments` in the function body.
 * 		parameter := core.LastOrNil(sig.parameters)
 * 		if parameter.ValueDeclaration != nil && parameter.ValueDeclaration.Type() == nil ||
 * 			parameter.ValueDeclaration == nil && parameter.CheckFlags&ast.CheckFlagsDeferredType != 0 {
 * 			contextualParameterType := c.getRestTypeAtPosition(context, length, false)
 * 			c.assignParameterType(parameter, contextualParameterType)
 * 		}
 * 	}
 * }
 */
export function Checker_assignContextualParameterTypes(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, context: GoPtr<Signature>): void {
  if (context!.typeParameters.length !== 0) {
    if (sig!.typeParameters.length !== 0) {
      return;
    }
    sig!.typeParameters = context!.typeParameters;
  }
  if (context!.thisParameter !== undefined) {
    let parameter = sig!.thisParameter;
    if (parameter === undefined || (parameter!.ValueDeclaration !== undefined && Node_Type(parameter!.ValueDeclaration) === undefined)) {
      if (parameter === undefined) {
        sig!.thisParameter = Checker_createSymbolWithType(receiver, context!.thisParameter, undefined);
        parameter = sig!.thisParameter;
      }
      Checker_assignParameterType(receiver, parameter, Checker_getTypeOfSymbol(receiver, context!.thisParameter));
    }
  }
  const length = sig!.parameters.length - core.IfElse(signatureHasRestParameter(sig), 1, 0);
  for (let i = 0; i < length; i++) {
    const parameter = sig!.parameters[i];
    const declaration = parameter!.ValueDeclaration;
    if (declaration !== undefined && Node_Type(declaration) === undefined) {
      let t = Checker_tryGetTypeAtPosition(receiver, context, i);
      if (t !== undefined && Node_Initializer(declaration) !== undefined) {
        let initializerType = Checker_checkDeclarationInitializer(receiver, declaration, CheckModeNormal, undefined);
        if (!Checker_isTypeAssignableTo(receiver, initializerType, t)) {
          initializerType = Checker_widenTypeInferredFromInitializer(receiver, declaration, initializerType);
          if (Checker_isTypeAssignableTo(receiver, t, initializerType)) {
            t = initializerType;
          }
        }
      }
      Checker_assignParameterType(receiver, parameter, t);
    }
  }
  if (signatureHasRestParameter(sig)) {
    const parameter = core.LastOrNil(sig!.parameters);
    if (
      (parameter!.ValueDeclaration !== undefined && Node_Type(parameter!.ValueDeclaration) === undefined) ||
      (parameter!.ValueDeclaration === undefined && (parameter!.CheckFlags & CheckFlagsDeferredType) !== 0)
    ) {
      const contextualParameterType = Checker_getRestTypeAtPosition(receiver, context, length, false);
      Checker_assignParameterType(receiver, parameter, contextualParameterType);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.assignNonContextualParameterTypes","kind":"method","status":"implemented","sigHash":"c7d64612feb4416a1fcfc9efc2c34b6d4bef9b69eaeb719684a1b4228b2b9079","bodyHash":"06b452049e99a8556267d15f21c848a947b560ccd63f06dad45fcbe54575d145"}
 *
 * Go source:
 * func (c *Checker) assignNonContextualParameterTypes(signature *Signature) {
 * 	if signature.thisParameter != nil {
 * 		c.assignParameterType(signature.thisParameter, nil)
 * 	}
 * 	for _, parameter := range signature.parameters {
 * 		c.assignParameterType(parameter, nil)
 * 	}
 * }
 */
export function Checker_assignNonContextualParameterTypes(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): void {
  if (signature!.thisParameter !== undefined) {
    Checker_assignParameterType(receiver, signature!.thisParameter, undefined);
  }
  for (const parameter of signature!.parameters) {
    Checker_assignParameterType(receiver, parameter, undefined);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.assignParameterType","kind":"method","status":"implemented","sigHash":"92473fb34c97092c5518902e164889e98bfa2d2495be4d3250edab4a7cd53170","bodyHash":"351779080aed7bb3a838942eadd7318ff60feabfdd07d52332c213e157877b02"}
 *
 * Go source:
 * func (c *Checker) assignParameterType(parameter *ast.Symbol, contextualType *Type) {
 * 	links := c.valueSymbolLinks.Get(parameter)
 * 	if links.resolvedType != nil {
 * 		return
 * 	}
 * 	declaration := parameter.ValueDeclaration
 * 	t := contextualType
 * 	if t == nil {
 * 		if declaration != nil {
 * 			t = c.getWidenedTypeForVariableLikeDeclaration(declaration, true /*reportErrors* /)
 * 		} else {
 * 			t = c.getTypeOfSymbol(parameter)
 * 		}
 * 	}
 * 	links.resolvedType = c.addOptionalityEx(t, false, declaration != nil && declaration.Initializer() == nil && isOptionalDeclaration(declaration))
 * 	if declaration != nil && !ast.IsIdentifier(declaration.Name()) {
 * 		// if inference didn't come up with anything but unknown, fall back to the binding pattern if present.
 * 		if links.resolvedType == c.unknownType {
 * 			links.resolvedType = c.getTypeFromBindingPattern(declaration.Name(), false, false)
 * 		}
 * 		c.assignBindingElementTypes(declaration.Name(), links.resolvedType)
 * 	}
 * }
 */
export function Checker_assignParameterType(receiver: GoPtr<Checker>, parameter: GoPtr<Symbol>, contextualType: GoPtr<Type>): void {
  const links = LinkStore_Get(receiver!.valueSymbolLinks, parameter) as GoPtr<ValueSymbolLinks>;
  if (links!.resolvedType !== undefined) {
    return;
  }
  const declaration = parameter!.ValueDeclaration;
  let t = contextualType;
  if (t === undefined) {
    if (declaration !== undefined) {
      t = Checker_getWidenedTypeForVariableLikeDeclaration(receiver, declaration, true);
    } else {
      t = Checker_getTypeOfSymbol(receiver, parameter);
    }
  }
  links!.resolvedType = Checker_addOptionalityEx(receiver, t, false, declaration !== undefined && Node_Initializer(declaration) === undefined && isOptionalDeclaration(declaration));
  if (declaration !== undefined && !IsIdentifier(Node_Name(declaration))) {
    if (links!.resolvedType === receiver!.unknownType) {
      links!.resolvedType = Checker_getTypeFromBindingPattern(receiver, Node_Name(declaration), false, false);
    }
    Checker_assignBindingElementTypes(receiver, Node_Name(declaration), links!.resolvedType);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExpressionWithTypeArguments","kind":"method","status":"implemented","sigHash":"7af60f8586f24d4e03c7dd8c4ee31384245225c03b67700531d956b3b4326422","bodyHash":"a832e66b0e0d85c478c53fa02b48d179c369d217ac08d6c231d7f1a9b7cea7b7"}
 *
 * Go source:
 * func (c *Checker) checkExpressionWithTypeArguments(node *ast.Node) *Type {
 * 	c.checkGrammarExpressionWithTypeArguments(node)
 * 	c.checkSourceElements(node.TypeArguments())
 * 	if ast.IsExpressionWithTypeArguments(node) {
 * 		parent := ast.WalkUpParenthesizedExpressions(node.Parent)
 * 		if ast.IsBinaryExpression(parent) && parent.AsBinaryExpression().OperatorToken.Kind == ast.KindInstanceOfKeyword && isNodeDescendantOf(node, parent.AsBinaryExpression().Right) {
 * 			c.error(node, diagnostics.The_right_hand_side_of_an_instanceof_expression_must_not_be_an_instantiation_expression)
 * 		}
 * 	}
 * 	var exprType *Type
 * 	if ast.IsExpressionWithTypeArguments(node) {
 * 		exprType = c.checkExpression(node.Expression())
 * 	} else {
 * 		exprName := node.AsTypeQueryNode().ExprName
 * 		if ast.IsThisIdentifier(exprName) {
 * 			exprType = c.checkThisExpression(node.AsTypeQueryNode().ExprName)
 * 		} else {
 * 			exprType = c.checkExpression(node.AsTypeQueryNode().ExprName)
 * 		}
 * 	}
 * 	return c.getInstantiationExpressionType(exprType, node)
 * }
 */
export function Checker_checkExpressionWithTypeArguments(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  Checker_checkGrammarExpressionWithTypeArguments(receiver, node);
  Checker_checkSourceElements(receiver, Node_TypeArguments(node) ?? []);
  if (IsExpressionWithTypeArguments(node)) {
    const parent = WalkUpParenthesizedExpressions(node!.Parent);
    if (parent !== undefined && IsBinaryExpression(parent)) {
      const binary = AsBinaryExpression(parent)!;
      if (binary.OperatorToken !== undefined && binary.OperatorToken.Kind === KindInstanceOfKeyword && isNodeDescendantOf(node, binary.Right)) {
        Checker_error(receiver, node, The_right_hand_side_of_an_instanceof_expression_must_not_be_an_instantiation_expression);
      }
    }
  }
  let exprType: GoPtr<Type>;
  if (IsExpressionWithTypeArguments(node)) {
    exprType = Checker_checkExpression(receiver, AsExpressionWithTypeArguments(node)!.Expression);
  } else {
    const exprName = AsTypeQueryNode(node)!.ExprName;
    if (IsThisIdentifier(exprName)) {
      exprType = Checker_checkThisExpression(receiver, AsTypeQueryNode(node)!.ExprName);
    } else {
      exprType = Checker_checkExpression(receiver, AsTypeQueryNode(node)!.ExprName);
    }
  }
  return Checker_getInstantiationExpressionType(receiver, exprType, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isMethodAccessForCall","kind":"method","status":"implemented","sigHash":"49915d12d5da293aedc638bcabe2f8df92cd78908eb9dd655bb22f9fede178e6","bodyHash":"d22ab86e42bf4cf78b92d5da8ca144ae25f900a7928b2afced133dfecf39d235"}
 *
 * Go source:
 * func (c *Checker) isMethodAccessForCall(node *ast.Node) bool {
 * 	for ast.IsParenthesizedExpression(node.Parent) {
 * 		node = node.Parent
 * 	}
 * 	return ast.IsCallOrNewExpression(node.Parent) && node.Parent.Expression() == node
 * }
 */
export function Checker_isMethodAccessForCall(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  let cur = node;
  while (IsParenthesizedExpression(cur!.Parent)) {
    cur = cur!.Parent;
  }
  return IsCallOrNewExpression(cur!.Parent) && Node_Expression(cur!.Parent) === cur;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getEnclosingClassFromThisParameter","kind":"method","status":"implemented","sigHash":"347c987444e5675afc15ec06dc7721b515dd43edaad3f01312443e2947bc213b","bodyHash":"8da57d54e8bfc5cb2ba7cda32c6730b4b1531e8ad31f36f9bb3396ff6ac2caf7"}
 *
 * Go source:
 * func (c *Checker) getEnclosingClassFromThisParameter(node *ast.Node) *Type {
 * 	// 'this' type for a node comes from, in priority order...
 * 	// 1. The type of a syntactic 'this' parameter in the enclosing function scope
 * 	thisParameter := getThisParameterFromNodeContext(node)
 * 	var thisType *Type
 * 	if thisParameter != nil && thisParameter.Type() != nil {
 * 		thisType = c.getTypeFromTypeNode(thisParameter.Type())
 * 	}
 * 	if thisType != nil {
 * 		// 2. The constraint of a type parameter used for an explicit 'this' parameter
 * 		if thisType.flags&TypeFlagsTypeParameter != 0 {
 * 			thisType = c.getConstraintOfTypeParameter(thisType)
 * 		}
 * 	} else {
 * 		// 3. The 'this' parameter of a contextual type
 * 		thisContainer := ast.GetThisContainer(node, false /*includeArrowFunctions* /, false /*includeClassComputedPropertyName* /)
 * 		if thisContainer != nil && ast.IsFunctionLike(thisContainer) {
 * 			thisType = c.getContextualThisParameterType(thisContainer)
 * 		}
 * 	}
 * 	if thisType != nil && thisType.objectFlags&(ObjectFlagsClassOrInterface|ObjectFlagsReference) != 0 {
 * 		return getTargetType(thisType)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getEnclosingClassFromThisParameter(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const thisParameter = getThisParameterFromNodeContext(node);
  let thisType: GoPtr<Type>;
  if (thisParameter !== undefined && Node_Type(thisParameter) !== undefined) {
    thisType = Checker_getTypeFromTypeNode(receiver, Node_Type(thisParameter));
  }
  if (thisType !== undefined) {
    if ((thisType!.flags & TypeFlagsTypeParameter) !== 0) {
      thisType = Checker_getConstraintOfTypeParameter(receiver, thisType);
    }
  } else {
    const thisContainer = GetThisContainer(node, false, false);
    if (thisContainer !== undefined && IsFunctionLike(thisContainer)) {
      thisType = Checker_getContextualThisParameterType(receiver, thisContainer);
    }
  }
  if (thisType !== undefined && (thisType!.objectFlags & (ObjectFlagsClassOrInterface | ObjectFlagsReference)) !== 0) {
    return getTargetType(thisType);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getContextualThisParameterType","kind":"method","status":"implemented","sigHash":"331f7922e6c535e2499162188a5f221e5f782095090c5107ce17a82a9fe6f833","bodyHash":"cb1e5adb866374d5786bf70ea5b4b592746ae09927eaf071f7eb80ddfeffddfe"}
 *
 * Go source:
 * func (c *Checker) getContextualThisParameterType(fn *ast.Node) *Type {
 * 	if ast.IsArrowFunction(fn) {
 * 		return nil
 * 	}
 * 	if c.isContextSensitiveFunctionOrObjectLiteralMethod(fn) {
 * 		contextualSignature := c.getContextualSignature(fn)
 * 		if contextualSignature != nil {
 * 			thisParameter := contextualSignature.thisParameter
 * 			if thisParameter != nil {
 * 				return c.getTypeOfSymbol(thisParameter)
 * 			}
 * 		}
 * 	}
 * 	inJs := ast.IsInJSFile(fn)
 * 	if c.noImplicitThis || inJs {
 * 		containingLiteral := getContainingObjectLiteral(fn)
 * 		if containingLiteral != nil {
 * 			// We have an object literal method. Check if the containing object literal has a contextual type
 * 			// that includes a ThisType<T>. If so, T is the contextual type for 'this'. We continue looking in
 * 			// any directly enclosing object literals.
 * 			contextualType := c.getApparentTypeOfContextualType(containingLiteral, ContextFlagsNone)
 * 			thisType := c.getThisTypeOfObjectLiteralFromContextualType(containingLiteral, contextualType)
 * 			if thisType != nil {
 * 				return c.instantiateType(thisType, c.getMapperFromContext(c.getInferenceContext(containingLiteral)))
 * 			}
 * 			// There was no contextual ThisType<T> for the containing object literal, so the contextual type
 * 			// for 'this' is the non-null form of the contextual type for the containing object literal or
 * 			// the type of the object literal itself.
 * 			if contextualType != nil {
 * 				thisType = c.GetNonNullableType(contextualType)
 * 			} else {
 * 				thisType = c.checkExpressionCached(containingLiteral)
 * 			}
 * 			return c.getWidenedType(thisType)
 * 		}
 * 		// In an assignment of the form 'obj.xxx = function(...)' or 'obj[xxx] = function(...)', the
 * 		// contextual type for 'this' is 'obj'.
 * 		parent := ast.WalkUpParenthesizedExpressions(fn.Parent)
 * 		if ast.IsAssignmentExpression(parent, false) {
 * 			target := parent.AsBinaryExpression().Left
 * 			if ast.IsAccessExpression(target) {
 * 				expression := target.Expression()
 * 				// Don't contextually type `this` as `exports` in `exports.Point = function(x, y) { this.x = x; this.y = y; }`
 * 				if inJs && ast.IsIdentifier(expression) {
 * 					sourceFile := ast.GetSourceFileOfNode(parent)
 * 					if sourceFile.CommonJSModuleIndicator != nil && c.getResolvedSymbol(expression).Flags&ast.SymbolFlagsModuleExports != 0 {
 * 						return nil
 * 					}
 * 				}
 * 				return c.getWidenedType(c.checkExpressionCached(expression))
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getContextualThisParameterType(receiver: GoPtr<Checker>, fn: GoPtr<Node>): GoPtr<Type> {
  if (IsArrowFunction(fn)) {
    return undefined;
  }
  if (Checker_isContextSensitiveFunctionOrObjectLiteralMethod(receiver, fn)) {
    const contextualSignature = Checker_getContextualSignature(receiver, fn);
    if (contextualSignature !== undefined) {
      const thisParameter = contextualSignature!.thisParameter;
      if (thisParameter !== undefined) {
        return Checker_getTypeOfSymbol(receiver, thisParameter);
      }
    }
  }
  const inJs = IsInJSFile(fn);
  if (receiver!.noImplicitThis || inJs) {
    const containingLiteral = getContainingObjectLiteral(fn);
    if (containingLiteral !== undefined) {
      const contextualType = Checker_getApparentTypeOfContextualType(receiver, containingLiteral, ContextFlagsNone);
      let thisType = Checker_getThisTypeOfObjectLiteralFromContextualType(receiver, containingLiteral, contextualType);
      if (thisType !== undefined) {
        return Checker_instantiateType(receiver, thisType, Checker_getMapperFromContext(receiver, Checker_getInferenceContext(receiver, containingLiteral)));
      }
      if (contextualType !== undefined) {
        thisType = Checker_GetNonNullableType(receiver, contextualType);
      } else {
        thisType = Checker_checkExpressionCached(receiver, containingLiteral);
      }
      return Checker_getWidenedType(receiver, thisType);
    }
    const parent = WalkUpParenthesizedExpressions(fn!.Parent as unknown as GoPtr<Expression>);
    if (IsAssignmentExpression(parent, false)) {
      const target = AsBinaryExpression(parent)!.Left;
      if (IsAccessExpression(target)) {
        const expression = Node_Expression(target);
        if (inJs && IsIdentifier(expression)) {
          const sourceFile = GetSourceFileOfNode(parent);
          if (sourceFile!.CommonJSModuleIndicator !== undefined && (Checker_getResolvedSymbol(receiver, expression)!.Flags & SymbolFlagsModuleExports) !== 0) {
            return undefined;
          }
        }
        return Checker_getWidenedType(receiver, Checker_checkExpressionCached(receiver, expression));
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.tryGetThisTypeAt","kind":"method","status":"implemented","sigHash":"30d3a6424ec33dc60086c1fde3f84e4a97bf2917d6e25bd5f67a5e7dc9229799","bodyHash":"e86842a6ffc59e29b8f49bec4b9e32432cf8ed3f7ebb89418e00eadebd23e171"}
 *
 * Go source:
 * func (c *Checker) tryGetThisTypeAt(node *ast.Node) *Type {
 * 	return c.tryGetThisTypeAtEx(node, true /*includeGlobalThis* /, nil /*container* /)
 * }
 */
export function Checker_tryGetThisTypeAt(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  return Checker_tryGetThisTypeAtEx(receiver, node, true, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.TryGetThisTypeAtEx","kind":"method","status":"implemented","sigHash":"134cd1c540dc04be62156fd68e50449ff6e633ef4aa8da36b642024da4653e96","bodyHash":"6fdaf84a7f1005ace7678d3798b4bf03757557fc5cd110aa793e5b175e01d6b1"}
 *
 * Go source:
 * func (c *Checker) TryGetThisTypeAtEx(node *ast.Node, includeGlobalThis bool, container *ast.Node) *Type {
 * 	reparsed := ast.GetReparsedNodeForNode(node)
 * 	if reparsed.Flags&ast.NodeFlagsJSDoc != 0 && reparsed.Flags&ast.NodeFlagsReparsed == 0 {
 * 		return nil // Binder doesn't process non-reparsed JSDoc nodes
 * 	}
 * 	return c.tryGetThisTypeAtEx(reparsed, includeGlobalThis, ast.GetReparsedNodeForNode(container))
 * }
 */
export function Checker_TryGetThisTypeAtEx(receiver: GoPtr<Checker>, node: GoPtr<Node>, includeGlobalThis: bool, container: GoPtr<Node>): GoPtr<Type> {
  const reparsed = GetReparsedNodeForNode(node);
  if ((reparsed!.Flags & NodeFlagsJSDoc) !== 0 && (reparsed!.Flags & NodeFlagsReparsed) === 0) {
    return undefined;
  }
  return Checker_tryGetThisTypeAtEx(receiver, reparsed, includeGlobalThis, GetReparsedNodeForNode(container));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.tryGetThisTypeAtEx","kind":"method","status":"implemented","sigHash":"3db4ed577040e6b50f06d77cbf412d6415042a181659831c0bac4ffce104aab8","bodyHash":"b0c91547c473b7f8c612e6b49ac38495e543067bcbd9a8d3e58307403a6ca546"}
 *
 * Go source:
 * func (c *Checker) tryGetThisTypeAtEx(node *ast.Node, includeGlobalThis bool, container *ast.Node) *Type {
 * 	if container == nil {
 * 		container = c.getThisContainer(node, false /*includeArrowFunctions* /, false /*includeClassComputedPropertyName* /)
 * 	}
 * 	if ast.IsFunctionLike(container) && (!c.isInParameterInitializerBeforeContainingFunction(node) || ast.GetThisParameter(container) != nil) {
 * 		sig := c.getSignatureOfFullSignatureType(container)
 * 		if sig == nil {
 * 			sig = c.getSignatureFromDeclaration(container)
 * 		}
 * 		thisType := c.getThisTypeOfSignature(sig)
 * 		// Note: a parameter initializer should refer to class-this unless function-this is explicitly annotated.
 * 		// If this is a function in a JS file, it might be a class method.
 * 		if thisType == nil {
 * 			thisType = c.getContextualThisParameterType(container)
 * 		}
 * 		if thisType != nil {
 * 			return c.getFlowTypeOfReference(node, thisType)
 * 		}
 * 	}
 * 	if container.Parent != nil && ast.IsClassLike(container.Parent) {
 * 		symbol := c.getSymbolOfDeclaration(container.Parent)
 * 		var t *Type
 * 		if ast.IsStatic(container) {
 * 			t = c.getTypeOfSymbol(symbol)
 * 		} else {
 * 			t = c.getDeclaredTypeOfSymbol(symbol).AsInterfaceType().thisType
 * 		}
 * 		return c.getFlowTypeOfReference(node, t)
 * 	}
 * 	if ast.IsSourceFile(container) {
 * 		// look up in the source file's locals or exports
 * 		if container.AsSourceFile().ExternalModuleIndicator != nil {
 * 			// TODO: Maybe issue a better error than 'object is possibly undefined'
 * 			return c.undefinedType
 * 		}
 * 		if includeGlobalThis {
 * 			return c.getTypeOfSymbol(c.globalThisSymbol)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_tryGetThisTypeAtEx(receiver: GoPtr<Checker>, node: GoPtr<Node>, includeGlobalThis: bool, container: GoPtr<Node>): GoPtr<Type> {
  let effectiveContainer = container;
  if (effectiveContainer === undefined) {
    effectiveContainer = GetThisContainer(node, false /*includeArrowFunctions*/, false /*includeClassComputedPropertyName*/);
  }
  if (IsFunctionLike(effectiveContainer) && (!Checker_isInParameterInitializerBeforeContainingFunction(receiver, node) || GetThisParameter(effectiveContainer) !== undefined)) {
    let sig = Checker_getSignatureOfFullSignatureType(receiver, effectiveContainer);
    if (sig === undefined) {
      sig = Checker_getSignatureFromDeclaration(receiver, effectiveContainer);
    }
    let thisType = sig === undefined ? undefined : Checker_getThisTypeOfSignature(receiver, sig);
    if (thisType === undefined) {
      thisType = Checker_getContextualThisParameterType(receiver, effectiveContainer);
    }
    if (thisType !== undefined) {
      return Checker_getFlowTypeOfReference(receiver, node, thisType);
    }
  }
  if (effectiveContainer!.Parent !== undefined && IsClassLike(effectiveContainer!.Parent)) {
    const symbol_ = Checker_getSymbolOfDeclaration(receiver, effectiveContainer!.Parent);
    let t: GoPtr<Type>;
    if (IsStatic(effectiveContainer)) {
      t = Checker_getTypeOfSymbol(receiver, symbol_);
    } else {
      t = Type_AsInterfaceType(Checker_getDeclaredTypeOfSymbol(receiver, symbol_))!.thisType;
    }
    return Checker_getFlowTypeOfReference(receiver, node, t);
  }
  if (IsSourceFile(effectiveContainer)) {
    const sourceFile = effectiveContainer as GoPtr<SourceFile>;
    if (sourceFile!.ExternalModuleIndicator !== undefined) {
      return receiver!.undefinedType;
    }
    if (includeGlobalThis) {
      return Checker_getTypeOfSymbol(receiver, receiver!.globalThisSymbol);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isInParameterInitializerBeforeContainingFunction","kind":"method","status":"implemented","sigHash":"a311fa03ba4ce3ae61509041242facf7149e73145e0f660738a6feaba720e1d4","bodyHash":"382753a2b0311ae0e838270daabeffa0a8792fb3de39c3837d075b98fb7db6e9"}
 *
 * Go source:
 * func (c *Checker) isInParameterInitializerBeforeContainingFunction(node *ast.Node) bool {
 * 	inBindingInitializer := false
 * 	for node.Parent != nil && !ast.IsFunctionLike(node.Parent) {
 * 		if ast.IsParameterDeclaration(node.Parent) {
 * 			if inBindingInitializer || node.Parent.Initializer() == node {
 * 				return true
 * 			}
 * 		}
 *
 * 		if ast.IsBindingElement(node.Parent) && node.Parent.Initializer() == node {
 * 			inBindingInitializer = true
 * 		}
 *
 * 		node = node.Parent
 * 	}
 *
 * 	return false
 * }
 */
export function Checker_isInParameterInitializerBeforeContainingFunction(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  let inBindingInitializer = false;
  let cur = node;
  while (cur!.Parent !== undefined && !IsFunctionLike(cur!.Parent)) {
    if (IsParameterDeclaration(cur!.Parent)) {
      if (inBindingInitializer || Node_Initializer(cur!.Parent) === cur) {
        return true;
      }
    }
    if (IsBindingElement(cur!.Parent) && Node_Initializer(cur!.Parent) === cur) {
      inBindingInitializer = true;
    }
    cur = cur!.Parent;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isIndirectCall","kind":"method","status":"implemented","sigHash":"c5c2f660cac6ec41fed9e20ead2ecfa5f91a88394b9e7fc07a7aa61031de5aad","bodyHash":"bd8cfa186d1b013a1f79ee847f274afe2f898e1a8933ab188c3481c6c7f7009f"}
 *
 * Go source:
 * func (c *Checker) isIndirectCall(node *ast.Node) bool {
 * 	left := node.AsBinaryExpression().Left
 * 	right := node.AsBinaryExpression().Right
 * 	return ast.IsParenthesizedExpression(node.Parent) && ast.IsNumericLiteral(left) && left.Text() == "0" &&
 * 		(ast.IsCallExpression(node.Parent.Parent) && node.Parent.Parent.Expression() == node.Parent ||
 * 			ast.IsTaggedTemplateExpression(node.Parent.Parent)) && (ast.IsAccessExpression(right) || ast.IsIdentifier(right) && right.Text() == "eval")
 * }
 */
export function Checker_isIndirectCall(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const binary = AsBinaryExpression(node);
  const left = binary!.Left;
  const right = binary!.Right;
  return IsParenthesizedExpression(node!.Parent) && IsNumericLiteral(left) && Node_Text(left) === "0" &&
    (IsCallExpression(node!.Parent!.Parent) && Node_Expression(node!.Parent!.Parent) === node!.Parent ||
      IsTaggedTemplateExpression(node!.Parent!.Parent)) && (IsAccessExpression(right) || IsIdentifier(right) && Node_Text(right) === "eval");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isValidConstAssertionArgument","kind":"method","status":"implemented","sigHash":"e2878f11ba8f9dea130576a497ea7308e7dcafedaaf5823fe5d17517690abd25","bodyHash":"44b6e3ebb414f5d9780a2a1de8665f13300238bfde0d4d94f94c358f5fdfb975"}
 *
 * Go source:
 * func (c *Checker) isValidConstAssertionArgument(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindStringLiteral, ast.KindNoSubstitutionTemplateLiteral, ast.KindNumericLiteral, ast.KindBigIntLiteral, ast.KindTrueKeyword,
 * 		ast.KindFalseKeyword, ast.KindArrayLiteralExpression, ast.KindObjectLiteralExpression, ast.KindTemplateExpression:
 * 		return true
 * 	case ast.KindParenthesizedExpression:
 * 		return c.isValidConstAssertionArgument(node.Expression())
 * 	case ast.KindPrefixUnaryExpression:
 * 		op := node.AsPrefixUnaryExpression().Operator
 * 		arg := node.AsPrefixUnaryExpression().Operand
 * 		return op == ast.KindMinusToken && (arg.Kind == ast.KindNumericLiteral || arg.Kind == ast.KindBigIntLiteral) || op == ast.KindPlusToken && arg.Kind == ast.KindNumericLiteral
 * 	case ast.KindPropertyAccessExpression, ast.KindElementAccessExpression:
 * 		expr := ast.SkipParentheses(node.Expression())
 * 		var symbol *ast.Symbol
 * 		if ast.IsEntityNameExpression(expr) {
 * 			symbol = c.resolveEntityName(expr, ast.SymbolFlagsValue, true /*ignoreErrors* /, false, nil)
 * 		}
 * 		return symbol != nil && symbol.Flags&ast.SymbolFlagsEnum != 0
 * 	}
 * 	return false
 * }
 */
export function Checker_isValidConstAssertionArgument(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindStringLiteral:
    case KindNoSubstitutionTemplateLiteral:
    case KindNumericLiteral:
    case KindBigIntLiteral:
    case KindTrueKeyword:
    case KindFalseKeyword:
    case KindArrayLiteralExpression:
    case KindObjectLiteralExpression:
    case KindTemplateExpression:
      return true;
    case KindParenthesizedExpression:
      return Checker_isValidConstAssertionArgument(receiver, Node_Expression(node));
    case KindPrefixUnaryExpression: {
      const op = AsPrefixUnaryExpression(node)!.Operator;
      const arg = AsPrefixUnaryExpression(node)!.Operand;
      return op === KindMinusToken && (arg!.Kind === KindNumericLiteral || arg!.Kind === KindBigIntLiteral) || op === KindPlusToken && arg!.Kind === KindNumericLiteral;
    }
    case KindPropertyAccessExpression:
    case KindElementAccessExpression: {
      const expr = SkipParentheses(Node_Expression(node));
      let symbol_: GoPtr<Symbol> = undefined;
      if (IsEntityNameExpression(expr)) {
        symbol_ = Checker_resolveEntityName(receiver, expr, SymbolFlagsEnum, true, false, undefined);
      }
      return symbol_ !== undefined && (symbol_!.Flags & SymbolFlagsEnum) !== 0;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newParameter","kind":"method","status":"implemented","sigHash":"4f45a98e35c0a184597db1219c45a0d52d30f8de881ac6e314bc5c16c7f603da","bodyHash":"3536521fa8e83d5cb800c9df6c90a517914942bdf9a2326908e7b34d81fd0693"}
 *
 * Go source:
 * func (c *Checker) newParameter(name string, t *Type) *ast.Symbol {
 * 	symbol := c.newSymbol(ast.SymbolFlagsFunctionScopedVariable, name)
 * 	c.valueSymbolLinks.Get(symbol).resolvedType = t
 * 	return symbol
 * }
 */
export function Checker_newParameter(receiver: GoPtr<Checker>, name: string, t: GoPtr<Type>): GoPtr<Symbol> {
  const symbol_ = Checker_newSymbol(receiver, SymbolFlagsFunctionScopedVariable, name);
  (LinkStore_Get(receiver!.valueSymbolLinks, symbol_) as GoPtr<ValueSymbolLinks>)!.resolvedType = t;
  return symbol_;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasSignatures","kind":"method","status":"implemented","sigHash":"7f2abb22d876c2d46c799cbb51b3268cc35906e2fa785bd005e45bfde0960806","bodyHash":"26d600b46febdc288494fdc0b9c07d5c277af56f6af5a7c06d6a99b811dd715e"}
 *
 * Go source:
 * func (c *Checker) hasSignatures(t *Type) bool {
 * 	return len(c.getSignaturesOfStructuredType(t, SignatureKindCall)) > 0 || len(c.getSignaturesOfStructuredType(t, SignatureKindConstruct)) > 0
 * }
 */
export function Checker_hasSignatures(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  return Checker_getSignaturesOfStructuredType(receiver, t, SignatureKindCall).length > 0 || Checker_getSignaturesOfStructuredType(receiver, t, SignatureKindConstruct).length > 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.lateBindIndexSignature","kind":"method","status":"implemented","sigHash":"29470d6353635374a94694a289f27501a1172e1c5738b4060b65d49a16bdc8ca","bodyHash":"1f1302cfc5bbcdd072d2b0232e26c18464613363277fbe902cbabca7ea5a8443"}
 *
 * Go source:
 * func (c *Checker) lateBindIndexSignature(parent *ast.Symbol, earlySymbols ast.SymbolTable, lateSymbols ast.SymbolTable, decl *ast.Node) {
 * 	// First, late bind the index symbol itself, if needed
 * 	indexSymbol := lateSymbols[ast.InternalSymbolNameIndex]
 * 	if indexSymbol == nil {
 * 		early := earlySymbols[ast.InternalSymbolNameIndex]
 * 		if early == nil {
 * 			indexSymbol = c.newSymbolEx(ast.SymbolFlagsNone, ast.InternalSymbolNameIndex, ast.CheckFlagsLate)
 * 		} else {
 * 			indexSymbol = c.cloneSymbol(early)
 * 			indexSymbol.CheckFlags |= ast.CheckFlagsLate
 * 		}
 * 		lateSymbols[ast.InternalSymbolNameIndex] = indexSymbol
 * 	}
 * 	// Then just add the computed name as a late bound declaration
 * 	// (note: unlike `addDeclarationToLateBoundSymbol` we do not set up a `.lateSymbol` on `decl`'s links,
 * 	// since that would point at an index symbol and not a single property symbol, like most consumers would expect)
 * 	if len(indexSymbol.Declarations) == 0 || decl.Symbol().Flags&ast.SymbolFlagsReplaceableByMethod == 0 {
 * 		indexSymbol.Declarations = append(indexSymbol.Declarations, decl)
 * 	}
 * }
 */
export function Checker_lateBindIndexSignature(receiver: GoPtr<Checker>, parent: GoPtr<Symbol>, earlySymbols: SymbolTable, lateSymbols: SymbolTable, decl: GoPtr<Node>): void {
  let indexSymbol = lateSymbols.get(InternalSymbolNameIndex);
  if (indexSymbol === undefined) {
    const early = earlySymbols.get(InternalSymbolNameIndex);
    if (early === undefined) {
      indexSymbol = Checker_newSymbolEx(receiver, SymbolFlagsNone, InternalSymbolNameIndex, CheckFlagsLate);
    } else {
      indexSymbol = Checker_cloneSymbol(receiver, early);
      indexSymbol!.CheckFlags |= CheckFlagsLate;
    }
    lateSymbols.set(InternalSymbolNameIndex, indexSymbol);
  }
  if ((indexSymbol!.Declarations?.length ?? 0) === 0 || (Node_Symbol(decl)!.Flags & SymbolFlagsReplaceableByMethod) === 0) {
    indexSymbol!.Declarations = [...(indexSymbol!.Declarations ?? []), decl];
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfVariableOrParameterOrProperty","kind":"method","status":"implemented","sigHash":"2ba7b0a2657917a34db885aad9978e6756e0bb6df93b91a92895ac8d3f76859d","bodyHash":"67798da0784a8644093df855318c53e0b99e02707acc8ad213c6f974f2c856d1"}
 *
 * Go source:
 * func (c *Checker) getTypeOfVariableOrParameterOrProperty(symbol *ast.Symbol) *Type {
 * 	links := c.valueSymbolLinks.Get(symbol)
 * 	if links.resolvedType == nil {
 * 		t := c.getTypeOfVariableOrParameterOrPropertyWorker(symbol)
 * 		if t == nil {
 * 			panic("Unexpected nil type")
 * 		}
 * 		// For a contextually typed parameter it is possible that a type has already
 * 		// been assigned (in assignTypeToParameterAndFixTypeParameters), and we want
 * 		// to preserve this type. In fact, we need to _prefer_ that type, but it won't
 * 		// be assigned until contextual typing is complete, so we need to defer in
 * 		// cases where contextual typing may take place.
 * 		if links.resolvedType == nil && !c.isParameterOfContextSensitiveSignature(symbol) {
 * 			links.resolvedType = t
 * 		}
 * 		return t
 * 	}
 * 	return links.resolvedType
 * }
 */
export function Checker_getTypeOfVariableOrParameterOrProperty(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type> {
  const links = LinkStore_Get(receiver!.valueSymbolLinks, symbol_) as GoPtr<ValueSymbolLinks>;
  if (links!.resolvedType === undefined) {
    const t = Checker_getTypeOfVariableOrParameterOrPropertyWorker(receiver, symbol_);
    if (t === undefined) {
      throw new globalThis.Error("Unexpected nil type");
    }
    if (links!.resolvedType === undefined && !Checker_isParameterOfContextSensitiveSignature(receiver, symbol_)) {
      links!.resolvedType = t;
    }
    return t;
  }
  return links!.resolvedType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isParameterOfContextSensitiveSignature","kind":"method","status":"implemented","sigHash":"f284921a62e3f5e326b33d6d96009fce090c8154590b9ff17070c64f0bed4fdb","bodyHash":"b008513fcd9b8dfd3a3fb4356a6b6f51beab4b8089421612f6e01da1dc1f4839"}
 *
 * Go source:
 * func (c *Checker) isParameterOfContextSensitiveSignature(symbol *ast.Symbol) bool {
 * 	decl := symbol.ValueDeclaration
 * 	if decl == nil {
 * 		return false
 * 	}
 * 	if ast.IsBindingElement(decl) {
 * 		decl = ast.WalkUpBindingElementsAndPatterns(decl)
 * 	}
 * 	if ast.IsParameterDeclaration(decl) {
 * 		return c.isContextSensitiveFunctionOrObjectLiteralMethod(decl.Parent)
 * 	}
 * 	return false
 * }
 */
export function Checker_isParameterOfContextSensitiveSignature(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool {
  let decl = symbol_!.ValueDeclaration;
  if (decl === undefined) {
    return false;
  }
  if (IsBindingElement(decl)) {
    decl = WalkUpBindingElementsAndPatterns(decl);
  }
  if (IsParameterDeclaration(decl)) {
    return Checker_isContextSensitiveFunctionOrObjectLiteralMethod(receiver, decl!.Parent);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfVariableOrParameterOrPropertyWorker","kind":"method","status":"implemented","sigHash":"ba24615b142afe80d09de3281fc0f58e9a00888b99861164453ecd2f508c1ef8","bodyHash":"7f9cd0c399e881f7720232eac01ecb19c0b54dc3026c3318dfb3d1c5a1a7f814"}
 *
 * Go source:
 * func (c *Checker) getTypeOfVariableOrParameterOrPropertyWorker(symbol *ast.Symbol) *Type {
 * 	// Handle prototype property
 * 	if symbol.Flags&ast.SymbolFlagsPrototype != 0 {
 * 		return c.getTypeOfPrototypeProperty(symbol)
 * 	}
 * 	// CommonsJS require and module both have type any.
 * 	if symbol == c.requireSymbol {
 * 		return c.anyType
 * 	}
 * 	debug.Assert(symbol.ValueDeclaration != nil)
 * 	declaration := symbol.ValueDeclaration
 * 	if ast.IsSourceFile(declaration) && ast.IsJsonSourceFile(declaration.AsSourceFile()) {
 * 		statements := declaration.Statements()
 * 		if len(statements) == 0 {
 * 			return c.emptyObjectType
 * 		}
 * 		return c.getWidenedType(c.getWidenedLiteralType(c.checkExpression(statements[0].Expression())))
 * 	}
 * 	// Handle variable, parameter or property
 * 	if !c.pushTypeResolution(symbol, TypeSystemPropertyNameType) {
 * 		return c.reportCircularityError(symbol)
 * 	}
 * 	if symbol.Flags&ast.SymbolFlagsModuleExports != 0 {
 * 		if symbol.Name == "exports" {
 * 			return c.getTypeOfSymbol(c.resolveExternalModuleSymbol(symbol.ValueDeclaration.Symbol(), false /*dontResolveAlias* /))
 * 		}
 * 		return c.newAnonymousType(symbol, symbol.Members, nil, nil, nil)
 * 	}
 * 	var result *Type
 * 	switch declaration.Kind {
 * 	case ast.KindParameter, ast.KindPropertyDeclaration, ast.KindPropertySignature, ast.KindVariableDeclaration,
 * 		ast.KindBindingElement:
 * 		result = c.getWidenedTypeForVariableLikeDeclaration(declaration, true /*reportErrors* /)
 * 	case ast.KindPropertyAssignment:
 * 		result = c.checkPropertyAssignment(declaration, CheckModeNormal)
 * 	case ast.KindShorthandPropertyAssignment:
 * 		result = c.checkShorthandPropertyAssignment(declaration, true /*inDestructuringPattern* /, CheckModeNormal)
 * 	case ast.KindMethodDeclaration:
 * 		result = c.checkObjectLiteralMethod(declaration, CheckModeNormal)
 * 	case ast.KindExportAssignment:
 * 		if declaration.Type() != nil {
 * 			result = c.getTypeFromTypeNode(declaration.Type())
 * 		} else {
 * 			result = c.widenTypeForVariableLikeDeclaration(c.checkExpressionCached(declaration.Expression()), declaration, false /*reportErrors* /)
 * 		}
 * 	case ast.KindBinaryExpression, ast.KindCallExpression:
 * 		result = c.getWidenedTypeForAssignmentDeclaration(symbol)
 * 	case ast.KindJsxAttribute:
 * 		result = c.checkJsxAttribute(declaration, CheckModeNormal)
 * 	case ast.KindEnumMember:
 * 		result = c.getTypeOfEnumMember(symbol)
 * 	default:
 * 		panic("Unhandled case in getTypeOfVariableOrParameterOrPropertyWorker: " + declaration.Kind.String())
 * 	}
 * 	if !c.popTypeResolution() {
 * 		return c.reportCircularityError(symbol)
 * 	}
 * 	return result
 * }
 */
export function Checker_getTypeOfVariableOrParameterOrPropertyWorker(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type> {
  if ((symbol_!.Flags & SymbolFlagsPrototype) !== 0) {
    return Checker_getTypeOfPrototypeProperty(receiver, symbol_);
  }
  if (symbol_ === receiver!.requireSymbol) {
    return receiver!.anyType;
  }
  const declaration = symbol_!.ValueDeclaration;
  if (declaration === undefined) {
    throw new globalThis.Error("Expected symbol.ValueDeclaration");
  }
  if (IsSourceFile(declaration) && IsJsonSourceFile(AsSourceFile(declaration))) {
    const statements = Node_Statements(declaration) ?? [];
    if (statements.length === 0) {
      return receiver!.emptyObjectType;
    }
    return Checker_getWidenedType(receiver, Checker_getWidenedLiteralType(receiver, Checker_checkExpression(receiver, Node_Expression(statements[0]))));
  }
  if (!Checker_pushTypeResolution(receiver, symbol_, TypeSystemPropertyNameType)) {
    return Checker_reportCircularityError(receiver, symbol_);
  }
  if ((symbol_!.Flags & SymbolFlagsModuleExports) !== 0) {
    if (symbol_!.Name === "exports") {
      return Checker_getTypeOfSymbol(receiver, Checker_resolveExternalModuleSymbol(receiver, Node_Symbol(symbol_!.ValueDeclaration), false));
    }
    return Checker_newAnonymousType(receiver, symbol_, symbol_!.Members, [], [], []);
  }
  let result: GoPtr<Type>;
  switch (declaration.Kind) {
    case KindParameter:
    case KindPropertyDeclaration:
    case KindPropertySignature:
    case KindVariableDeclaration:
    case KindBindingElement:
      result = Checker_getWidenedTypeForVariableLikeDeclaration(receiver, declaration, true);
      break;
    case KindPropertyAssignment:
      result = Checker_checkPropertyAssignment(receiver, declaration, CheckModeNormal);
      break;
    case KindShorthandPropertyAssignment:
      result = Checker_checkShorthandPropertyAssignment(receiver, declaration, true, CheckModeNormal);
      break;
    case KindMethodDeclaration:
      result = Checker_checkObjectLiteralMethod(receiver, declaration, CheckModeNormal);
      break;
    case KindExportAssignment:
      if (Node_Type(declaration) !== undefined) {
        result = Checker_getTypeFromTypeNode(receiver, Node_Type(declaration));
      } else {
        result = Checker_widenTypeForVariableLikeDeclaration(receiver, Checker_checkExpressionCached(receiver, Node_Expression(declaration)), declaration, false);
      }
      break;
    case KindBinaryExpression:
    case KindCallExpression:
      result = Checker_getWidenedTypeForAssignmentDeclaration(receiver, symbol_);
      break;
    case KindJsxAttribute:
      result = Checker_checkJsxAttribute(receiver, declaration, CheckModeNormal);
      break;
    case KindEnumMember:
      result = Checker_getTypeOfEnumMember(receiver, symbol_);
      break;
    default:
      throw new globalThis.Error("Unhandled case in getTypeOfVariableOrParameterOrPropertyWorker: " + String(declaration.Kind));
  }
  if (!Checker_popTypeResolution(receiver)) {
    return Checker_reportCircularityError(receiver, symbol_);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getBaseConstructorTypeOfClass","kind":"method","status":"implemented","sigHash":"eda3dcbd8d4f3242a5d72eb0cf35ee78abcf1d996b9b0424484b4fab8b8c51cc","bodyHash":"727c97f58a28dfce60e3b39aa19883aaea56de8a83b7667fd5a356fe872c7e08"}
 *
 * Go source:
 * func (c *Checker) getBaseConstructorTypeOfClass(t *Type) *Type {
 * 	data := t.AsInterfaceType()
 * 	if data.resolvedBaseConstructorType != nil {
 * 		return data.resolvedBaseConstructorType
 * 	}
 * 	baseTypeNode := getBaseTypeNodeOfClass(t)
 * 	if baseTypeNode == nil {
 * 		data.resolvedBaseConstructorType = c.undefinedType
 * 		return data.resolvedBaseConstructorType
 * 	}
 * 	if !c.pushTypeResolution(t, TypeSystemPropertyNameResolvedBaseConstructorType) {
 * 		return c.errorType
 * 	}
 * 	baseConstructorType := c.checkExpression(baseTypeNode.Expression())
 * 	if baseConstructorType.flags&(TypeFlagsObject|TypeFlagsIntersection) != 0 {
 * 		// Resolving the members of a class requires us to resolve the base class of that class.
 * 		// We force resolution here such that we catch circularities now.
 * 		c.resolveStructuredTypeMembers(baseConstructorType)
 * 	}
 * 	if !c.popTypeResolution() {
 * 		c.error(t.symbol.ValueDeclaration, diagnostics.X_0_is_referenced_directly_or_indirectly_in_its_own_base_expression, c.symbolToString(t.symbol))
 * 		if data.resolvedBaseConstructorType == nil {
 * 			data.resolvedBaseConstructorType = c.errorType
 * 		}
 * 		return data.resolvedBaseConstructorType
 * 	}
 * 	if baseConstructorType.flags&TypeFlagsAny == 0 && baseConstructorType != c.nullWideningType && !c.isConstructorType(baseConstructorType) {
 * 		err := c.error(baseTypeNode.Expression(), diagnostics.Type_0_is_not_a_constructor_function_type, c.TypeToString(baseConstructorType))
 * 		if baseConstructorType.flags&TypeFlagsTypeParameter != 0 {
 * 			constraint := c.getConstraintFromTypeParameter(baseConstructorType)
 * 			var ctorReturn *Type = c.unknownType
 * 			if constraint != nil {
 * 				ctorSigs := c.getSignaturesOfType(constraint, SignatureKindConstruct)
 * 				if len(ctorSigs) != 0 {
 * 					ctorReturn = c.getReturnTypeOfSignature(ctorSigs[0])
 * 				}
 * 			}
 * 			if baseConstructorType.symbol.Declarations != nil {
 * 				err.AddRelatedInfo(createDiagnosticForNode(baseConstructorType.symbol.Declarations[0], diagnostics.Did_you_mean_for_0_to_be_constrained_to_type_new_args_Colon_any_1, c.symbolToString(baseConstructorType.symbol), c.TypeToString(ctorReturn)))
 * 			}
 * 		}
 * 		if data.resolvedBaseConstructorType == nil {
 * 			data.resolvedBaseConstructorType = c.errorType
 * 		}
 * 		return data.resolvedBaseConstructorType
 * 	}
 * 	if data.resolvedBaseConstructorType == nil {
 * 		data.resolvedBaseConstructorType = baseConstructorType
 * 	}
 * 	return data.resolvedBaseConstructorType
 * }
 */
export function Checker_getBaseConstructorTypeOfClass(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  const data = Type_AsInterfaceType(t);
  if (data!.resolvedBaseConstructorType !== undefined) {
    return data!.resolvedBaseConstructorType;
  }
  const baseTypeNode = getBaseTypeNodeOfClass(t);
  if (baseTypeNode === undefined) {
    data!.resolvedBaseConstructorType = receiver!.undefinedType;
    return data!.resolvedBaseConstructorType;
  }
  if (!Checker_pushTypeResolution(receiver, t, TypeSystemPropertyNameResolvedBaseConstructorType)) {
    return receiver!.errorType;
  }
  const baseConstructorType = Checker_checkExpression(receiver, Node_Expression(baseTypeNode));
  if ((baseConstructorType!.flags & (TypeFlagsObject | TypeFlagsIntersection)) !== 0) {
    Checker_resolveStructuredTypeMembers(receiver, baseConstructorType);
  }
  if (!Checker_popTypeResolution(receiver)) {
    Checker_error(receiver, t!.symbol!.ValueDeclaration, X_0_is_referenced_directly_or_indirectly_in_its_own_base_expression, Checker_symbolToString(receiver, t!.symbol));
    if (data!.resolvedBaseConstructorType === undefined) {
      data!.resolvedBaseConstructorType = receiver!.errorType;
    }
    return data!.resolvedBaseConstructorType;
  }
  if ((baseConstructorType!.flags & TypeFlagsAny) === 0 && baseConstructorType !== receiver!.nullWideningType && !Checker_isConstructorType(receiver, baseConstructorType)) {
    const err = Checker_error(receiver, Node_Expression(baseTypeNode), Type_0_is_not_a_constructor_function_type, Checker_TypeToString(receiver, baseConstructorType));
    if ((baseConstructorType!.flags & TypeFlagsTypeParameter) !== 0) {
      const constraint = Checker_getConstraintFromTypeParameter(receiver, baseConstructorType);
      let ctorReturn: GoPtr<Type> = receiver!.unknownType;
      if (constraint !== undefined) {
        const ctorSigs = Checker_getSignaturesOfType(receiver, constraint, SignatureKindConstruct);
        if (ctorSigs.length !== 0) {
          ctorReturn = Checker_getReturnTypeOfSignature(receiver, ctorSigs[0]);
        }
      }
      if (baseConstructorType!.symbol!.Declarations !== undefined) {
        Diagnostic_AddRelatedInfo(
          err,
          NewDiagnosticForNode(
            baseConstructorType!.symbol!.Declarations[0],
            Did_you_mean_for_0_to_be_constrained_to_type_new_args_Colon_any_1,
            Checker_symbolToString(receiver, baseConstructorType!.symbol),
            Checker_TypeToString(receiver, ctorReturn),
          ),
        );
      }
    }
    if (data!.resolvedBaseConstructorType === undefined) {
      data!.resolvedBaseConstructorType = receiver!.errorType;
    }
    return data!.resolvedBaseConstructorType;
  }
  if (data!.resolvedBaseConstructorType === undefined) {
    data!.resolvedBaseConstructorType = baseConstructorType;
  }
  return data!.resolvedBaseConstructorType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isConstructorType","kind":"method","status":"implemented","sigHash":"25be20db339f5b391ac6fa80e8c0651d8385fa084348a2e949054875924f55e3","bodyHash":"6c963024ea205f9ad39e390a8bd94afaecab481e71e5d4829bda76f9eee8a35e"}
 *
 * Go source:
 * func (c *Checker) isConstructorType(t *Type) bool {
 * 	if len(c.getSignaturesOfType(t, SignatureKindConstruct)) > 0 {
 * 		return true
 * 	}
 * 	if t.flags&TypeFlagsTypeVariable != 0 {
 * 		constraint := c.getBaseConstraintOfType(t)
 * 		return constraint != nil && c.isMixinConstructorType(constraint)
 * 	}
 * 	return false
 * }
 */
export function Checker_isConstructorType(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  if (Checker_getSignaturesOfType(receiver, t, SignatureKindConstruct).length > 0) {
    return true;
  }
  if ((t!.flags & TypeFlagsTypeVariable) !== 0) {
    const constraint = Checker_getBaseConstraintOfType(receiver, t);
    return constraint !== undefined && Checker_isMixinConstructorType(receiver, constraint);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isMixinConstructorType","kind":"method","status":"implemented","sigHash":"a02efd11fcebae5ba555ed7663fdff9f75380cd2a47f3ac751e866ac2208927c","bodyHash":"ea80d55544b4abdde243c44aca9b557489ebdad952bd28701fa28379e0e60188"}
 *
 * Go source:
 * func (c *Checker) isMixinConstructorType(t *Type) bool {
 * 	signatures := c.getSignaturesOfType(t, SignatureKindConstruct)
 * 	if len(signatures) == 1 {
 * 		s := signatures[0]
 * 		if len(s.typeParameters) == 0 && len(s.parameters) == 1 && signatureHasRestParameter(s) {
 * 			paramType := c.getTypeOfParameter(s.parameters[0])
 * 			return IsTypeAny(paramType) || c.getElementTypeOfArrayType(paramType) == c.anyType
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_isMixinConstructorType(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  const signatures = Checker_getSignaturesOfType(receiver, t, SignatureKindConstruct);
  if (signatures.length === 1) {
    const s = signatures[0];
    if (s!.typeParameters.length === 0 && s!.parameters.length === 1 && signatureHasRestParameter(s)) {
      const paramType = Checker_getTypeOfParameter(receiver, s!.parameters[0]);
      return IsTypeAny(paramType) || Checker_getElementTypeOfArrayType(receiver, paramType) === receiver!.anyType;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfParameter","kind":"method","status":"implemented","sigHash":"4d1c32e15f262b8b95b1d208d96b19ed4d1ee072c75a63e7ed33540f85389202","bodyHash":"a3cd40bba07a16500493468128d6906d4a1db9693119ec4fead4336e6039ac9c"}
 *
 * Go source:
 * func (c *Checker) getTypeOfParameter(symbol *ast.Symbol) *Type {
 * 	declaration := symbol.ValueDeclaration
 * 	return c.addOptionalityEx(c.getTypeOfSymbol(symbol), false, declaration != nil && (declaration.Initializer() != nil || isOptionalDeclaration(declaration)))
 * }
 */
export function Checker_getTypeOfParameter(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type> {
  const declaration = symbol_!.ValueDeclaration;
  return Checker_addOptionalityEx(receiver, Checker_getTypeOfSymbol(receiver, symbol_), false, declaration !== undefined && (Node_Initializer(declaration) !== undefined || isOptionalDeclaration(declaration)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConstraintOfTypeParameter","kind":"method","status":"implemented","sigHash":"65be89218217782db9bd47d5e334653918b4b5446bc5902a7a9e0c057f5395ba","bodyHash":"aea579ba2af52fcfe901b6e801c69d3d52b61360dc1a9e6614df709fd7ecc8e5"}
 *
 * Go source:
 * func (c *Checker) getConstraintOfTypeParameter(typeParameter *Type) *Type {
 * 	if c.hasNonCircularBaseConstraint(typeParameter) {
 * 		return c.getConstraintFromTypeParameter(typeParameter)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getConstraintOfTypeParameter(receiver: GoPtr<Checker>, typeParameter: GoPtr<Type>): GoPtr<Type> {
  if (Checker_hasNonCircularBaseConstraint(receiver, typeParameter)) {
    return Checker_getConstraintFromTypeParameter(receiver, typeParameter);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConstraintFromTypeParameter","kind":"method","status":"implemented","sigHash":"3c5d3902ca0f8bc127adf7bad839911715408317792c5961583fabe5ab0001b4","bodyHash":"0764c7d557c52949bc0109f1b43da6f456981eb7ca6a65b2b607ecee77724670"}
 *
 * Go source:
 * func (c *Checker) getConstraintFromTypeParameter(t *Type) *Type {
 * 	if t.flags&TypeFlagsTypeParameter == 0 {
 * 		return nil
 * 	}
 * 
 * 	tp := t.AsTypeParameter()
 * 	if tp.constraint == nil {
 * 		var constraint *Type
 * 		if tp.target != nil {
 * 			constraint = c.instantiateType(c.getConstraintOfTypeParameter(tp.target), tp.mapper)
 * 		} else {
 * 			constraintDeclaration := c.getConstraintDeclaration(t)
 * 			if constraintDeclaration != nil {
 * 				constraint = c.getTypeFromTypeNode(constraintDeclaration)
 * 				if constraint.flags&TypeFlagsAny != 0 && !c.isErrorType(constraint) {
 * 					// use stringNumberSymbolType as the base constraint for mapped type key constraints (unknown isn;t assignable to that, but `any` was),
 * 					// use unknown otherwise
 * 					if ast.IsMappedTypeNode(constraintDeclaration.Parent.Parent) {
 * 						constraint = c.stringNumberSymbolType
 * 					} else {
 * 						constraint = c.unknownType
 * 					}
 * 				}
 * 			} else {
 * 				constraint = c.getInferredTypeParameterConstraint(t, false)
 * 			}
 * 		}
 * 		if constraint == nil {
 * 			constraint = c.noConstraintType
 * 		}
 * 		tp.constraint = constraint
 * 	}
 * 	if tp.constraint != c.noConstraintType {
 * 		return tp.constraint
 * 	}
 * 	return nil
 * }
 */
export function Checker_getConstraintFromTypeParameter(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  if ((t!.flags & TypeFlagsTypeParameter) === 0) {
    return undefined;
  }
  const typeParameter = Type_AsTypeParameter(t);
  if (typeParameter!.constraint === undefined) {
    let constraint: GoPtr<Type>;
    if (typeParameter!.target !== undefined) {
      constraint = Checker_instantiateType(receiver, Checker_getConstraintOfTypeParameter(receiver, typeParameter!.target), typeParameter!.mapper);
    } else {
      const constraintDeclaration = Checker_getConstraintDeclaration(receiver, t);
      if (constraintDeclaration !== undefined) {
        constraint = Checker_getTypeFromTypeNode(receiver, constraintDeclaration);
        if ((constraint!.flags & TypeFlagsAny) !== 0 && !Checker_isErrorType(receiver, constraint)) {
          if (constraintDeclaration!.Parent!.Parent!.Kind === KindMappedType) {
            constraint = receiver!.stringNumberSymbolType;
          } else {
            constraint = receiver!.unknownType;
          }
        }
      } else {
        constraint = Checker_getInferredTypeParameterConstraint(receiver, t, false);
      }
    }
    if (constraint === undefined) {
      constraint = receiver!.noConstraintType;
    }
    typeParameter!.constraint = constraint;
  }
  if (typeParameter!.constraint !== receiver!.noConstraintType) {
    return typeParameter!.constraint;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConstraintOrUnknownFromTypeParameter","kind":"method","status":"implemented","sigHash":"e4268b32f6e2fce067f32091c498cc6ce2155bcd547dbb1ea15dd0e86100de36","bodyHash":"14fa4ef693cbb25731012393539b687aeda4cc0ebe6e0e2319d4c91300daf4ee"}
 *
 * Go source:
 * func (c *Checker) getConstraintOrUnknownFromTypeParameter(t *Type) *Type {
 * 	result := c.getConstraintFromTypeParameter(t)
 * 	return core.IfElse(result != nil, result, c.unknownType)
 * }
 */
export function Checker_getConstraintOrUnknownFromTypeParameter(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  const result = Checker_getConstraintFromTypeParameter(receiver, t);
  return core.IfElse(result !== undefined, result, receiver!.unknownType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getInferredTypeParameterConstraint","kind":"method","status":"implemented","sigHash":"9d5ff3fc573e9c23b24e4acb6193c8520b6030bb29e3c2862d65058f56567d40","bodyHash":"8fd8bf3bf011d2e46839a0d329398e5f093bb4e103a41bc37f948f882114d6eb"}
 *
 * Go source:
 * func (c *Checker) getInferredTypeParameterConstraint(t *Type, omitTypeReferences bool) *Type {
 * 	var inferences []*Type
 * 	if t.symbol != nil && len(t.symbol.Declarations) != 0 {
 * 		for _, declaration := range t.symbol.Declarations {
 * 			if ast.IsInferTypeNode(declaration.Parent) {
 * 				// When an 'infer T' declaration is immediately contained in a type reference node
 * 				// (such as 'Foo<infer T>'), T's constraint is inferred from the constraint of the
 * 				// corresponding type parameter in 'Foo'. When multiple 'infer T' declarations are
 * 				// present, we form an intersection of the inferred constraint types.
 * 				child := declaration.Parent
 * 				parent := child.Parent
 * 				for parent != nil && ast.IsParenthesizedTypeNode(parent) {
 * 					child = parent
 * 					parent = child.Parent
 * 				}
 * 				switch {
 * 				case ast.IsTypeReferenceNode(parent) && !omitTypeReferences:
 * 					typeParameters := c.getTypeParametersForTypeReferenceOrImport(parent)
 * 					if typeParameters != nil {
 * 						index := slices.Index(parent.TypeArguments(), child)
 * 						if index >= 0 && index < len(typeParameters) {
 * 							declaredConstraint := c.getConstraintOfTypeParameter(typeParameters[index])
 * 							if declaredConstraint != nil {
 * 								// Type parameter constraints can reference other type parameters so
 * 								// constraints need to be instantiated. If instantiation produces the
 * 								// type parameter itself, we discard that inference. For example, in
 * 								//   type Foo<T extends string, U extends T> = [T, U];
 * 								//   type Bar<T> = T extends Foo<infer X, infer X> ? Foo<X, X> : T;
 * 								// the instantiated constraint for U is X, so we discard that inference.
 * 								mapper := newDeferredTypeMapper(typeParameters, core.MapIndex(typeParameters, func(_ *Type, index int) func() *Type {
 * 									return func() *Type {
 * 										return c.getEffectiveTypeArgumentAtIndex(parent, typeParameters, index)
 * 									}
 * 								}))
 * 								constraint := c.instantiateType(declaredConstraint, mapper)
 * 								if constraint != t {
 * 									inferences = append(inferences, constraint)
 * 								}
 * 							}
 * 						}
 * 					}
 * 				case ast.IsParameterDeclaration(parent) && parent.AsParameterDeclaration().DotDotDotToken != nil ||
 * 					ast.IsRestTypeNode(parent) ||
 * 					ast.IsNamedTupleMember(parent) && parent.AsNamedTupleMember().DotDotDotToken != nil:
 * 					inferences = append(inferences, c.createArrayType(c.unknownType))
 * 				case ast.IsTemplateLiteralTypeSpan(parent):
 * 					inferences = append(inferences, c.stringType)
 * 				case ast.IsTypeParameterDeclaration(parent) && ast.IsMappedTypeNode(parent.Parent):
 * 					inferences = append(inferences, c.stringNumberSymbolType)
 * 				case ast.IsMappedTypeNode(parent) && parent.Type() != nil &&
 * 					ast.SkipParentheses(parent.Type()) == declaration.Parent &&
 * 					ast.IsConditionalTypeNode(parent.Parent) &&
 * 					parent.Parent.AsConditionalTypeNode().ExtendsType == parent &&
 * 					ast.IsMappedTypeNode(parent.Parent.AsConditionalTypeNode().CheckType) &&
 * 					parent.Parent.AsConditionalTypeNode().CheckType.Type() != nil:
 * 					checkMappedType := parent.Parent.AsConditionalTypeNode().CheckType
 * 					nodeType := c.getTypeFromTypeNode(checkMappedType.Type())
 * 					checkMappedTypeParameter := checkMappedType.AsMappedTypeNode().TypeParameter
 * 					mapper := newSimpleTypeMapper(c.getDeclaredTypeOfTypeParameter(c.getSymbolOfDeclaration(checkMappedTypeParameter)),
 * 						core.IfElse(checkMappedTypeParameter.AsTypeParameterDeclaration().Constraint != nil,
 * 							c.getTypeFromTypeNode(checkMappedTypeParameter.AsTypeParameterDeclaration().Constraint),
 * 							c.stringNumberSymbolType))
 * 					inferences = append(inferences, c.instantiateType(nodeType, mapper))
 * 				}
 * 			}
 * 		}
 * 	}
 * 	if len(inferences) != 0 {
 * 		return c.getIntersectionType(inferences)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getInferredTypeParameterConstraint(receiver: GoPtr<Checker>, t: GoPtr<Type>, omitTypeReferences: bool): GoPtr<Type> {
  const inferences: GoSlice<GoPtr<Type>> = [];
  if (t!.symbol !== undefined && (t!.symbol!.Declarations ?? []).length !== 0) {
    for (const declaration of t!.symbol!.Declarations ?? []) {
      if (IsInferTypeNode(declaration!.Parent)) {
        let child = declaration!.Parent;
        let parent = child!.Parent;
        while (parent !== undefined && IsParenthesizedTypeNode(parent)) {
          child = parent;
          parent = child!.Parent;
        }
        if (IsTypeReferenceNode(parent) && !omitTypeReferences) {
          const typeParameters = Checker_getTypeParametersForTypeReferenceOrImport(receiver, parent);
          if (typeParameters !== undefined) {
            const index = slices.Index(Node_TypeArguments(parent), child);
            if (index >= 0 && index < typeParameters.length) {
              const declaredConstraint = Checker_getConstraintOfTypeParameter(receiver, typeParameters[index]);
              if (declaredConstraint !== undefined) {
                const mapper = newDeferredTypeMapper(typeParameters, core.MapIndex(typeParameters, (_typeParameter: GoPtr<Type>, typeParameterIndex: int): (() => GoPtr<Type>) => {
                  return (): GoPtr<Type> => Checker_getEffectiveTypeArgumentAtIndex(receiver, parent, typeParameters, typeParameterIndex);
                }));
                const constraint = Checker_instantiateType(receiver, declaredConstraint, mapper);
                if (constraint !== t) {
                  inferences.push(constraint);
                }
              }
            }
          }
        } else if (
          (IsParameterDeclaration(parent) && AsParameterDeclaration(parent)!.DotDotDotToken !== undefined) ||
          IsRestTypeNode(parent) ||
          (IsNamedTupleMember(parent) && AsNamedTupleMember(parent)!.DotDotDotToken !== undefined)
        ) {
          inferences.push(Checker_createArrayType(receiver, receiver!.unknownType));
        } else if (IsTemplateLiteralTypeSpan(parent)) {
          inferences.push(receiver!.stringType);
        } else if (IsTypeParameterDeclaration(parent) && IsMappedTypeNode(parent!.Parent)) {
          inferences.push(receiver!.stringNumberSymbolType);
        } else if (
          IsMappedTypeNode(parent) &&
          Node_Type(parent) !== undefined &&
          SkipParentheses(Node_Type(parent)) === declaration!.Parent &&
          IsConditionalTypeNode(parent!.Parent) &&
          AsConditionalTypeNode(parent!.Parent)!.ExtendsType === parent &&
          IsMappedTypeNode(AsConditionalTypeNode(parent!.Parent)!.CheckType) &&
          Node_Type(AsConditionalTypeNode(parent!.Parent)!.CheckType) !== undefined
        ) {
          const checkMappedType = AsConditionalTypeNode(parent!.Parent)!.CheckType;
          const nodeType = Checker_getTypeFromTypeNode(receiver, Node_Type(checkMappedType));
          const checkMappedTypeParameter = AsMappedTypeNode(checkMappedType)!.TypeParameter;
          const checkMappedTypeParameterDeclaration = AsTypeParameterDeclaration(checkMappedTypeParameter)!;
          const mapper = newSimpleTypeMapper(
            Checker_getDeclaredTypeOfTypeParameter(receiver, Checker_getSymbolOfDeclaration(receiver, checkMappedTypeParameter)),
            core.IfElse(
              checkMappedTypeParameterDeclaration.Constraint !== undefined,
              Checker_getTypeFromTypeNode(receiver, checkMappedTypeParameterDeclaration.Constraint),
              receiver!.stringNumberSymbolType,
            ),
          );
          inferences.push(Checker_instantiateType(receiver, nodeType, mapper));
        }
      }
    }
  }
  if (inferences.length !== 0) {
    return Checker_getIntersectionType(receiver, inferences);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeParametersForTypeReferenceOrImport","kind":"method","status":"implemented","sigHash":"eb4b7686442df2a9f4f6e1cc76013b36743411a03cdf12ee61befa0b6334489f","bodyHash":"aa687d69d54b1e782b620968398337fcead79798fc22dd00fd1b7b41e17bbc44"}
 *
 * Go source:
 * func (c *Checker) getTypeParametersForTypeReferenceOrImport(node *ast.Node) []*Type {
 * 	t := c.getTypeFromTypeNode(node)
 * 	if !c.isErrorType(t) {
 * 		symbol := c.getResolvedSymbolOrNil(node)
 * 		if symbol != nil {
 * 			return c.getTypeParametersForTypeAndSymbol(t, symbol)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getTypeParametersForTypeReferenceOrImport(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoSlice<GoPtr<Type>> {
  const t = Checker_getTypeFromTypeNode(receiver, node);
  if (!Checker_isErrorType(receiver, t)) {
    const symbol_ = Checker_getResolvedSymbolOrNil(receiver, node);
    if (symbol_ !== undefined) {
      return Checker_getTypeParametersForTypeAndSymbol(receiver, t, symbol_);
    }
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeParametersForTypeAndSymbol","kind":"method","status":"implemented","sigHash":"0dfc26500632ab828792a9d844a72b09cfba39fa10a89434c5a0b3b912d7da97","bodyHash":"86792d23c6990674d2f954d38d60b34ba77db02271d0feab1e14106d386f1785"}
 *
 * Go source:
 * func (c *Checker) getTypeParametersForTypeAndSymbol(t *Type, symbol *ast.Symbol) []*Type {
 * 	if !c.isErrorType(t) {
 * 		if symbol.Flags&ast.SymbolFlagsTypeAlias != 0 {
 * 			if typeParameters := c.typeAliasLinks.Get(symbol).typeParameters; len(typeParameters) != 0 {
 * 				return typeParameters
 * 			}
 * 		}
 * 		if t.objectFlags&ObjectFlagsReference != 0 {
 * 			return t.Target().AsInterfaceType().LocalTypeParameters()
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getTypeParametersForTypeAndSymbol(receiver: GoPtr<Checker>, t: GoPtr<Type>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Type>> {
  if (!Checker_isErrorType(receiver, t)) {
    if ((symbol_!.Flags & SymbolFlagsTypeAlias) !== 0) {
      const typeParameters = LinkStore_Get<GoPtr<Symbol>, TypeAliasLinks>(receiver!.typeAliasLinks, symbol_)!.typeParameters;
      if ((typeParameters ?? []).length !== 0) {
        return typeParameters;
      }
    }
    if ((t!.objectFlags & ObjectFlagsReference) !== 0) {
      return InterfaceType_LocalTypeParameters(Type_AsInterfaceType(Type_Target(t)));
    }
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getEffectiveTypeArgumentAtIndex","kind":"method","status":"implemented","sigHash":"9368c1241078c7c9d7cd8ca876a208e69423119288a7d115984ca99916783719","bodyHash":"3f2a811f0fb2dc3214c54b51feab7e195001039331619b9a6727d605df255d5f"}
 *
 * Go source:
 * func (c *Checker) getEffectiveTypeArgumentAtIndex(node *ast.Node, typeParameters []*Type, index int) *Type {
 * 	typeArguments := node.TypeArguments()
 * 	if index < len(typeArguments) {
 * 		return c.getTypeFromTypeNode(typeArguments[index])
 * 	}
 * 	return c.getEffectiveTypeArguments(node, typeParameters)[index]
 * }
 */
export function Checker_getEffectiveTypeArgumentAtIndex(receiver: GoPtr<Checker>, node: GoPtr<Node>, typeParameters: GoSlice<GoPtr<Type>>, index: int): GoPtr<Type> {
  const typeArguments = Node_TypeArguments(node);
  if (index < (typeArguments ?? []).length) {
    return Checker_getTypeFromTypeNode(receiver, typeArguments![index]);
  }
  return Checker_getEffectiveTypeArguments(receiver, node, typeParameters)[index];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getRestType","kind":"method","status":"implemented","sigHash":"32a32535061c5c2137388fdea266e7494b721ae45ce4d133e940454d2a62bd3f","bodyHash":"34fb2488372ffbe38de7088d7b9e7e0d136f45ea7fe0423c89c9353416604eaf"}
 *
 * Go source:
 * func (c *Checker) getRestType(source *Type, properties []*ast.Node, symbol *ast.Symbol) *Type {
 * 	source = c.filterType(source, func(t *Type) bool { return t.flags&TypeFlagsNullable == 0 })
 * 	if source.flags&TypeFlagsNever != 0 {
 * 		return c.emptyObjectType
 * 	}
 * 	if source.flags&TypeFlagsUnion != 0 {
 * 		return c.mapType(source, func(t *Type) *Type {
 * 			return c.getRestType(t, properties, symbol)
 * 		})
 * 	}
 * 	omitKeyType := c.getUnionType(core.Map(properties, c.getLiteralTypeFromPropertyName))
 * 	var spreadableProperties []*ast.Symbol
 * 	var unspreadableToRestKeys []*Type
 * 	for _, prop := range c.getPropertiesOfType(source) {
 * 		literalTypeFromProperty := c.getLiteralTypeFromProperty(prop, TypeFlagsStringOrNumberLiteralOrUnique, false)
 * 		if !c.isTypeAssignableTo(literalTypeFromProperty, omitKeyType) && getDeclarationModifierFlagsFromSymbol(prop)&(ast.ModifierFlagsPrivate|ast.ModifierFlagsProtected) == 0 && c.isSpreadableProperty(prop) {
 * 			spreadableProperties = append(spreadableProperties, prop)
 * 		} else {
 * 			unspreadableToRestKeys = append(unspreadableToRestKeys, literalTypeFromProperty)
 * 		}
 * 	}
 * 	if c.isGenericObjectType(source) || c.isGenericIndexType(omitKeyType) {
 * 		if len(unspreadableToRestKeys) != 0 {
 * 			// If the type we're spreading from has properties that cannot
 * 			// be spread into the rest type (e.g. getters, methods), ensure
 * 			// they are explicitly omitted, as they would in the non-generic case.
 * 			omitKeyType = c.getUnionType(append([]*Type{omitKeyType}, unspreadableToRestKeys...))
 * 		}
 * 		if omitKeyType.flags&TypeFlagsNever != 0 {
 * 			return source
 * 		}
 * 		omitTypeAlias := c.getGlobalOmitSymbol()
 * 		if omitTypeAlias == nil {
 * 			return c.errorType
 * 		}
 * 		return c.getTypeAliasInstantiation(omitTypeAlias, []*Type{source, omitKeyType}, nil)
 * 	}
 * 	members := make(ast.SymbolTable)
 * 	for _, prop := range spreadableProperties {
 * 		members[prop.Name] = c.getSpreadSymbol(prop, false /*readonly* /)
 * 	}
 * 	result := c.newAnonymousType(symbol, members, nil, nil, c.getIndexInfosOfType(source))
 * 	result.objectFlags |= ObjectFlagsObjectRestType
 * 	return result
 * }
 */
export function Checker_getRestType(receiver: GoPtr<Checker>, source: GoPtr<Type>, properties: GoSlice<GoPtr<Node>>, symbol_: GoPtr<Symbol>): GoPtr<Type> {
  source = Checker_filterType(receiver, source, (t: GoPtr<Type>): bool => ((t!.flags & TypeFlagsNullable) === 0) as bool);
  if ((source!.flags & TypeFlagsNever) !== 0) {
    return receiver!.emptyObjectType;
  }
  if ((source!.flags & TypeFlagsUnion) !== 0) {
    return Checker_mapType(receiver, source, (t: GoPtr<Type>): GoPtr<Type> => Checker_getRestType(receiver, t, properties, symbol_));
  }
  let omitKeyType = Checker_getUnionType(receiver, core.Map(properties, (property: GoPtr<Node>): GoPtr<Type> => Checker_getLiteralTypeFromPropertyName(receiver, property)));
  const spreadableProperties: GoSlice<GoPtr<Symbol>> = [];
  const unspreadableToRestKeys: GoSlice<GoPtr<Type>> = [];
  for (const prop of Checker_getPropertiesOfType(receiver, source)) {
    const literalTypeFromProperty = Checker_getLiteralTypeFromProperty(receiver, prop, TypeFlagsStringOrNumberLiteralOrUnique, false as bool);
    if (
      !Checker_isTypeAssignableTo(receiver, literalTypeFromProperty, omitKeyType) &&
      (getDeclarationModifierFlagsFromSymbol(prop) & (ModifierFlagsPrivate | ModifierFlagsProtected)) === 0 &&
      Checker_isSpreadableProperty(receiver, prop)
    ) {
      spreadableProperties.push(prop);
    } else {
      unspreadableToRestKeys.push(literalTypeFromProperty);
    }
  }
  if (Checker_isGenericObjectType(receiver, source) || Checker_isGenericIndexType(receiver, omitKeyType)) {
    if (unspreadableToRestKeys.length !== 0) {
      omitKeyType = Checker_getUnionType(receiver, [omitKeyType, ...unspreadableToRestKeys]);
    }
    if ((omitKeyType!.flags & TypeFlagsNever) !== 0) {
      return source;
    }
    const omitTypeAlias = receiver!.getGlobalOmitSymbol();
    if (omitTypeAlias === undefined) {
      return receiver!.errorType;
    }
    return Checker_getTypeAliasInstantiation(receiver, omitTypeAlias, [source, omitKeyType], undefined);
  }
  const members: SymbolTable = new globalThis.Map<string, GoPtr<Symbol>>();
  for (const prop of spreadableProperties) {
    members.set(prop!.Name, Checker_getSpreadSymbol(receiver, prop, false as bool));
  }
  const result = Checker_newAnonymousType(receiver, symbol_, members, [], [], Checker_getIndexInfosOfType(receiver, source));
  result!.objectFlags = (result!.objectFlags | ObjectFlagsObjectRestType) as ObjectFlags;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isConstructorDeclaredThisProperty","kind":"method","status":"implemented","sigHash":"9e8c226dc9dcde8b3d69232732a7184197c7643677540c4cbc2fd8983571c0b0","bodyHash":"e38ab4747cbb06a1ea614f1be54bf8bf0a9cc957645916e90623f6f6b5ec11e3"}
 *
 * Go source:
 * func (c *Checker) isConstructorDeclaredThisProperty(symbol *ast.Symbol) (thisAssignmentDeclarationKind, *ast.Node) {
 * 	if symbol.ValueDeclaration == nil || !ast.IsBinaryExpression(symbol.ValueDeclaration) {
 * 		return thisAssignmentDeclarationNone, nil
 * 	}
 * 	if kind, ok := c.thisExpandoKinds[symbol]; ok {
 * 		location, ok2 := c.thisExpandoLocations[symbol]
 * 		if !ok2 {
 * 			panic("location should be cached whenever this expando symbol is cached")
 * 		}
 * 		return kind, location
 * 	}
 * 	allThis := true
 * 	var typeAnnotation *ast.Node
 * 	for _, declaration := range symbol.Declarations {
 * 		if !ast.IsBinaryExpression(declaration) {
 * 			allThis = false
 * 			break
 * 		}
 * 		bin := declaration.AsBinaryExpression()
 * 		if ast.GetAssignmentDeclarationKind(declaration) == ast.JSDeclarationKindThisProperty &&
 * 			(bin.Left.Kind != ast.KindElementAccessExpression || ast.IsStringOrNumericLiteralLike(bin.Left.AsElementAccessExpression().ArgumentExpression)) {
 * 			if bin.Type != nil {
 * 				typeAnnotation = bin.Type
 * 			}
 * 		} else {
 * 			allThis = false
 * 			break
 * 		}
 * 	}
 * 	var location *ast.Node
 * 	kind := thisAssignmentDeclarationNone
 * 	if allThis {
 * 		if typeAnnotation != nil {
 * 			location = typeAnnotation
 * 			kind = thisAssignmentDeclarationTyped
 * 		} else {
 * 			location = c.getDeclaringConstructor(symbol)
 * 			kind = core.IfElse(location == nil, thisAssignmentDeclarationMethod, thisAssignmentDeclarationConstructor)
 * 		}
 * 	}
 * 	c.thisExpandoKinds[symbol] = kind
 * 	c.thisExpandoLocations[symbol] = location
 * 	return kind, location
 * }
 */
export function Checker_isConstructorDeclaredThisProperty(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): [thisAssignmentDeclarationKind, GoPtr<Node>] {
  if (symbol_!.ValueDeclaration === undefined || !IsBinaryExpression(symbol_!.ValueDeclaration)) {
    return [thisAssignmentDeclarationNone, undefined];
  }
  if (receiver!.thisExpandoKinds.has(symbol_)) {
    const kind = receiver!.thisExpandoKinds.get(symbol_)!;
    if (!receiver!.thisExpandoLocations.has(symbol_)) {
      throw new globalThis.Error("location should be cached whenever this expando symbol is cached");
    }
    const location = receiver!.thisExpandoLocations.get(symbol_)!;
    return [kind, location];
  }
  let allThis = true;
  let typeAnnotation: GoPtr<Node> = undefined;
  for (const declaration of symbol_!.Declarations ?? []) {
    if (!IsBinaryExpression(declaration)) {
      allThis = false;
      break;
    }
    const bin = AsBinaryExpression(declaration);
    if (GetAssignmentDeclarationKind(declaration) === JSDeclarationKindThisProperty &&
      (bin!.Left!.Kind !== KindElementAccessExpression || IsStringOrNumericLiteralLike(AsElementAccessExpression(bin!.Left)!.ArgumentExpression))) {
      if (bin!.Type !== undefined) {
        typeAnnotation = bin!.Type;
      }
    } else {
      allThis = false;
      break;
    }
  }
  let location: GoPtr<Node> = undefined;
  let kind: thisAssignmentDeclarationKind = thisAssignmentDeclarationNone;
  if (allThis) {
    if (typeAnnotation !== undefined) {
      location = typeAnnotation;
      kind = thisAssignmentDeclarationTyped;
    } else {
      location = Checker_getDeclaringConstructor(receiver, symbol_);
      kind = core.IfElse(location === undefined, thisAssignmentDeclarationMethod, thisAssignmentDeclarationConstructor);
    }
  }
  receiver!.thisExpandoKinds.set(symbol_, kind);
  receiver!.thisExpandoLocations.set(symbol_, location);
  return [kind, location];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isGlobalSymbolConstructor","kind":"method","status":"implemented","sigHash":"18328612f88f78b7a833ef710e15b0dbf06ac5e4572f0092bf789d72fdefc0a7","bodyHash":"e3ccb1c18a45360fc2cc933a26648b14f6518295dd112b7be7266186eb2ee390"}
 *
 * Go source:
 * func (c *Checker) isGlobalSymbolConstructor(node *ast.Node) bool {
 * 	symbol := c.getSymbolOfNode(node)
 * 	globalSymbol := c.getGlobalESSymbolConstructorTypeSymbolOrNil()
 * 	return globalSymbol != nil && symbol == globalSymbol
 * }
 */
export function Checker_isGlobalSymbolConstructor(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const symbol_ = Checker_getSymbolOfNode(receiver, node);
  const globalSymbol = receiver!.getGlobalESSymbolConstructorTypeSymbolOrNil();
  return globalSymbol !== undefined && symbol_ === globalSymbol;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSignaturesOfType","kind":"method","status":"implemented","sigHash":"50516a040707d550bebf1933c979d6c88fa4c021222a40f2b646811f12db420c","bodyHash":"12d986c5e9e3ef2ff5dc7856d769df85483ccbf123784290e5fb0092e4f04796"}
 *
 * Go source:
 * func (c *Checker) getSignaturesOfType(t *Type, kind SignatureKind) []*Signature {
 * 	return c.getSignaturesOfStructuredType(c.getReducedApparentType(t), kind)
 * }
 */
export function Checker_getSignaturesOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>, kind: SignatureKind): GoSlice<GoPtr<Signature>> {
  return Checker_getSignaturesOfStructuredType(receiver, Checker_getReducedApparentType(receiver, t), kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSignaturesOfStructuredType","kind":"method","status":"implemented","sigHash":"34db2c00f2b9b0f54322d04da591540b9fa3b3749cc98db010353f4a89509b1b","bodyHash":"18dcd71740f8f6b05a249f82c5a09e84577ef060dc3119fe4e4fed876708bb6e"}
 *
 * Go source:
 * func (c *Checker) getSignaturesOfStructuredType(t *Type, kind SignatureKind) []*Signature {
 * 	if t.flags&TypeFlagsStructuredType == 0 {
 * 		return nil
 * 	}
 * 	resolved := c.resolveStructuredTypeMembers(t)
 * 	if kind == SignatureKindCall {
 * 		return resolved.signatures[:resolved.callSignatureCount]
 * 	}
 * 	return resolved.signatures[resolved.callSignatureCount:]
 * }
 */
export function Checker_getSignaturesOfStructuredType(receiver: GoPtr<Checker>, t: GoPtr<Type>, kind: SignatureKind): GoSlice<GoPtr<Signature>> {
  if ((t!.flags & TypeFlagsStructuredType) === 0) {
    return [];
  }
  const resolved = Checker_resolveStructuredTypeMembers(receiver, t);
  if (kind === SignatureKindCall) {
    return resolved!.signatures.slice(0, resolved!.callSignatureCount) as GoSlice<GoPtr<Signature>>;
  }
  return resolved!.signatures.slice(resolved!.callSignatureCount) as GoSlice<GoPtr<Signature>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getApplicableIndexInfo","kind":"method","status":"implemented","sigHash":"0e929585b24365682b9fa0b24f6a7b760d2a27a49175a56380d049cf0ed7726f","bodyHash":"25a756e0fde1f7935f2b0e7e5fda0d8c5a86563b09c861cd70136de5f983a94d"}
 *
 * Go source:
 * func (c *Checker) getApplicableIndexInfo(t *Type, keyType *Type) *IndexInfo {
 * 	return c.findApplicableIndexInfo(c.getIndexInfosOfType(t), keyType)
 * }
 */
export function Checker_getApplicableIndexInfo(receiver: GoPtr<Checker>, t: GoPtr<Type>, keyType: GoPtr<Type>): GoPtr<IndexInfo> {
  return Checker_findApplicableIndexInfo(receiver, Checker_getIndexInfosOfType(receiver, t), keyType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getApplicableIndexInfoForName","kind":"method","status":"implemented","sigHash":"3af8b79071c0e6cb6d0495dd631e419bbe21b373019b353ba487f85657677f61","bodyHash":"73985821397ef5b2e425bdfa83985f4f3811bb7c6a0fdafde8e18758fe249d3b"}
 *
 * Go source:
 * func (c *Checker) getApplicableIndexInfoForName(t *Type, name string) *IndexInfo {
 * 	if isLateBoundName(name) {
 * 		return c.getApplicableIndexInfo(t, c.esSymbolType)
 * 	}
 * 	return c.getApplicableIndexInfo(t, c.getStringLiteralType(name))
 * }
 */
export function Checker_getApplicableIndexInfoForName(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string): GoPtr<IndexInfo> {
  if (isLateBoundName(name)) {
    return Checker_getApplicableIndexInfo(receiver, t, receiver!.esSymbolType);
  }
  return Checker_getApplicableIndexInfo(receiver, t, Checker_getStringLiteralType(receiver, name));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.findApplicableIndexInfo","kind":"method","status":"implemented","sigHash":"37bc60135b8c12225c8c34a171d329b3e6487738b1ece89449e5031b10c1bc89","bodyHash":"4e52917d4618344ab781f2e152b016d6f3d3ecc78aa1022d564c1c05e2024c00"}
 *
 * Go source:
 * func (c *Checker) findApplicableIndexInfo(indexInfos []*IndexInfo, keyType *Type) *IndexInfo {
 * 	// Index signatures for type 'string' are considered only when no other index signatures apply.
 * 	var stringIndexInfo *IndexInfo
 * 	applicableInfos := make([]*IndexInfo, 0, 8)
 * 	for _, info := range indexInfos {
 * 		if info.keyType == c.stringType {
 * 			stringIndexInfo = info
 * 		} else if c.isApplicableIndexType(keyType, info.keyType) {
 * 			applicableInfos = append(applicableInfos, info)
 * 		}
 * 	}
 * 	// When more than one index signature is applicable we create a synthetic IndexInfo. Instead of computing
 * 	// the intersected key type, we just use unknownType for the key type as nothing actually depends on the
 * 	// keyType property of the returned IndexInfo.
 * 	switch len(applicableInfos) {
 * 	case 0:
 * 		if stringIndexInfo != nil && c.isApplicableIndexType(keyType, c.stringType) {
 * 			return stringIndexInfo
 * 		}
 * 		return nil
 * 	case 1:
 * 		return applicableInfos[0]
 * 	default:
 * 		isReadonly := true
 * 		types := make([]*Type, len(applicableInfos))
 * 		for i, info := range applicableInfos {
 * 			types[i] = info.valueType
 * 			if !info.isReadonly {
 * 				isReadonly = false
 * 			}
 * 		}
 * 		return c.newIndexInfo(c.unknownType, c.getIntersectionType(types), isReadonly, nil, nil)
 * 	}
 * }
 */
export function Checker_findApplicableIndexInfo(receiver: GoPtr<Checker>, indexInfos: GoSlice<GoPtr<IndexInfo>>, keyType: GoPtr<Type>): GoPtr<IndexInfo> {
  let stringIndexInfo: GoPtr<IndexInfo> = undefined;
  const applicableInfos: Array<GoPtr<IndexInfo>> = [];
  for (const info of (indexInfos ?? [])) {
    if (info!.keyType === receiver!.stringType) {
      stringIndexInfo = info;
    } else if (Checker_isApplicableIndexType(receiver, keyType, info!.keyType)) {
      applicableInfos.push(info);
    }
  }
  if (applicableInfos.length === 0) {
    if (stringIndexInfo !== undefined && Checker_isApplicableIndexType(receiver, keyType, receiver!.stringType)) {
      return stringIndexInfo;
    }
    return undefined;
  }
  if (applicableInfos.length === 1) {
    return applicableInfos[0];
  }
  let isReadonly = true;
  const types: Array<GoPtr<Type>> = applicableInfos.map(info => {
    if (!info!.isReadonly) {
      isReadonly = false;
    }
    return info!.valueType;
  });
  return Checker_newIndexInfo(receiver, receiver!.unknownType, Checker_getIntersectionType(receiver, types), isReadonly, undefined, []);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isApplicableIndexType","kind":"method","status":"implemented","sigHash":"16b0b8d353b8525fdf8ade7276fcbfd685c3c671a2a845183c9d0cf17c5bae97","bodyHash":"e38d0571be51fc8ae8158c729761b4872974d6e48cec5d8fa54b4989c6e0a7b2"}
 *
 * Go source:
 * func (c *Checker) isApplicableIndexType(source *Type, target *Type) bool {
 * 	// A 'string' index signature applies to types assignable to 'string' or 'number', and a 'number' index
 * 	// signature applies to types assignable to 'number', `${number}` and numeric string literal types.
 * 	return c.isTypeAssignableTo(source, target) ||
 * 		target == c.stringType && c.isTypeAssignableTo(source, c.numberType) ||
 * 		target == c.numberType && (source == c.numericStringType || source.flags&TypeFlagsStringLiteral != 0 && isNumericLiteralName(getStringLiteralValue(source)))
 * }
 */
export function Checker_isApplicableIndexType(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  return Checker_isTypeAssignableTo(receiver, source, target) ||
    target === receiver!.stringType && Checker_isTypeAssignableTo(receiver, source, receiver!.numberType) ||
    target === receiver!.numberType && (source === receiver!.numericStringType || (source!.flags & TypeFlagsStringLiteral) !== 0 && isNumericLiteralName(getStringLiteralValue(source)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getInstantiatedConstructorsForTypeArguments","kind":"method","status":"implemented","sigHash":"b184f761d715e78402b38709f0cb09704f776a86564b48966bb0e0a79ad76856","bodyHash":"69e8493dd867e762e78799afc9453ae9a20ee720d97e583ff0b7e736945c6d44"}
 *
 * Go source:
 * func (c *Checker) getInstantiatedConstructorsForTypeArguments(t *Type, typeArgumentNodes []*ast.Node, location *ast.Node) []*Signature {
 * 	signatures := c.getConstructorsForTypeArguments(t, typeArgumentNodes, location)
 * 	typeArguments := core.Map(typeArgumentNodes, c.getTypeFromTypeNode)
 * 	return core.SameMap(signatures, func(sig *Signature) *Signature {
 * 		if len(sig.typeParameters) != 0 {
 * 			return c.getSignatureInstantiation(sig, typeArguments, ast.IsInJSFile(location), nil)
 * 		}
 * 		return sig
 * 	})
 * }
 */
export function Checker_getInstantiatedConstructorsForTypeArguments(receiver: GoPtr<Checker>, t: GoPtr<Type>, typeArgumentNodes: GoSlice<GoPtr<Node>>, location: GoPtr<Node>): GoSlice<GoPtr<Signature>> {
  const signatures = Checker_getConstructorsForTypeArguments(receiver, t, typeArgumentNodes, location);
  const typeArguments = core.Map(typeArgumentNodes, (node: GoPtr<Node>) => Checker_getTypeFromTypeNode(receiver, node));
  return core.SameMap(signatures, (sig: GoPtr<Signature>) => {
    if (sig!.typeParameters.length !== 0) {
      return Checker_getSignatureInstantiation(receiver, sig, typeArguments, IsInJSFile(location), undefined as unknown as GoSlice<GoPtr<Type>>);
    }
    return sig;
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getConstructorsForTypeArguments","kind":"method","status":"implemented","sigHash":"d3563ca7958e8270c22563b209046a4db9388807625d557b3a4854b2ca60cf9d","bodyHash":"7c235debcdfb59293d1b338fdafbcd46fe59f827961c52f79386b4b399cf5e65"}
 *
 * Go source:
 * func (c *Checker) getConstructorsForTypeArguments(t *Type, typeArgumentNodes []*ast.Node, location *ast.Node) []*Signature {
 * 	typeArgCount := len(typeArgumentNodes)
 * 	return core.Filter(c.getSignaturesOfType(t, SignatureKindConstruct), func(sig *Signature) bool {
 * 		return typeArgCount >= c.getMinTypeArgumentCount(sig.typeParameters) && typeArgCount <= len(sig.typeParameters)
 * 	})
 * }
 */
export function Checker_getConstructorsForTypeArguments(receiver: GoPtr<Checker>, t: GoPtr<Type>, typeArgumentNodes: GoSlice<GoPtr<Node>>, location: GoPtr<Node>): GoSlice<GoPtr<Signature>> {
  const typeArgCount = typeArgumentNodes.length;
  return core.Filter(Checker_getSignaturesOfType(receiver, t, SignatureKindConstruct), (sig: GoPtr<Signature>) =>
    typeArgCount >= Checker_getMinTypeArgumentCount(receiver, sig!.typeParameters) && typeArgCount <= sig!.typeParameters.length
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSignatureInstantiation","kind":"method","status":"implemented","sigHash":"c644227b7797d9527e44f59ac8691746d09a02195ccd36e9d90982c6b7bf87ef","bodyHash":"429e104e3d8a1284190c63812b1d24ff31ea384fe4c98bc5f5daab1b32da0fe7"}
 *
 * Go source:
 * func (c *Checker) getSignatureInstantiation(sig *Signature, typeArguments []*Type, isJavaScript bool, inferredTypeParameters []*Type) *Signature {
 * 	instantiatedSignature := c.getSignatureInstantiationWithoutFillingInTypeArguments(sig, c.fillMissingTypeArguments(typeArguments, sig.typeParameters, c.getMinTypeArgumentCount(sig.typeParameters), isJavaScript))
 * 	if len(inferredTypeParameters) != 0 {
 * 		returnSignature := c.getSingleCallOrConstructSignature(c.getReturnTypeOfSignature(instantiatedSignature))
 * 		if returnSignature != nil {
 * 			newReturnSignature := c.cloneSignature(returnSignature)
 * 			newReturnSignature.typeParameters = inferredTypeParameters
 * 			newReturnType := c.getOrCreateTypeFromSignature(newReturnSignature)
 * 			newReturnType.AsObjectType().mapper = instantiatedSignature.mapper
 * 			newInstantiatedSignature := c.cloneSignature(instantiatedSignature)
 * 			newInstantiatedSignature.resolvedReturnType = newReturnType
 * 			return newInstantiatedSignature
 * 		}
 * 	}
 * 	return instantiatedSignature
 * }
 */
export function Checker_getSignatureInstantiation(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, typeArguments: GoSlice<GoPtr<Type>>, isJavaScript: bool, inferredTypeParameters: GoSlice<GoPtr<Type>> | undefined): GoPtr<Signature> {
  const instantiatedSignature = Checker_getSignatureInstantiationWithoutFillingInTypeArguments(receiver, sig, Checker_fillMissingTypeArguments(receiver, typeArguments, sig!.typeParameters, Checker_getMinTypeArgumentCount(receiver, sig!.typeParameters), isJavaScript));
  if (inferredTypeParameters !== undefined && inferredTypeParameters.length !== 0) {
    const returnSignature = Checker_getSingleCallOrConstructSignature(receiver, Checker_getReturnTypeOfSignature(receiver, instantiatedSignature));
    if (returnSignature !== undefined) {
      const newReturnSignature = Checker_cloneSignature(receiver, returnSignature);
      newReturnSignature!.typeParameters = inferredTypeParameters;
      const newReturnType = Checker_getOrCreateTypeFromSignature(receiver, newReturnSignature);
      Type_AsObjectType(newReturnType)!.mapper = instantiatedSignature!.mapper;
      const newInstantiatedSignature = Checker_cloneSignature(receiver, instantiatedSignature);
      newInstantiatedSignature!.resolvedReturnType = newReturnType;
      return newInstantiatedSignature;
    }
  }
  return instantiatedSignature;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.cloneSignature","kind":"method","status":"implemented","sigHash":"8af0f1860c9a904b18cbaf6085e763141df33b52a9b03ed6a70a611c2f9d8914","bodyHash":"d23ca55b0ce15a06416fc1b6dad61fa59727a473c2a93a77d9f67937847fac05"}
 *
 * Go source:
 * func (c *Checker) cloneSignature(sig *Signature) *Signature {
 * 	result := c.newSignature(sig.flags&SignatureFlagsPropagatingFlags, sig.declaration, sig.typeParameters, sig.thisParameter, sig.parameters, nil, nil, int(sig.minArgumentCount))
 * 	result.target = sig.target
 * 	result.mapper = sig.mapper
 * 	result.composite = sig.composite
 * 	return result
 * }
 */
export function Checker_cloneSignature(receiver: GoPtr<Checker>, sig: GoPtr<Signature>): GoPtr<Signature> {
  const result = Checker_newSignature(receiver, (sig!.flags & SignatureFlagsPropagatingFlags) as SignatureFlags, sig!.declaration, sig!.typeParameters, sig!.thisParameter, sig!.parameters, undefined, undefined, sig!.minArgumentCount as int);
  result!.target = sig;
  result!.mapper = sig!.mapper;
  result!.composite = sig!.composite;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSignatureInstantiationWithoutFillingInTypeArguments","kind":"method","status":"implemented","sigHash":"b17d88b595cefe5cf56615ab4609d0d91cf9f92411ce71cb2241805af9ea4758","bodyHash":"506da85daa36a0c7996586a9dd130fc215b016626a88d5f73d50c810d125d733"}
 *
 * Go source:
 * func (c *Checker) getSignatureInstantiationWithoutFillingInTypeArguments(sig *Signature, typeArguments []*Type) *Signature {
 * 	key := CachedSignatureKey{sig: sig, key: getTypeListKey(typeArguments)}
 * 	instantiation := c.cachedSignatures[key]
 * 	if instantiation == nil {
 * 		instantiation = c.createSignatureInstantiation(sig, typeArguments)
 * 		c.cachedSignatures[key] = instantiation
 * 	}
 * 	return instantiation
 * }
 */
export function Checker_getSignatureInstantiationWithoutFillingInTypeArguments(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, typeArguments: GoSlice<GoPtr<Type>>): GoPtr<Signature> {
  const key: CachedSignatureKey = { sig, key: getTypeListKey(typeArguments) };
  let instantiation = receiver!.cachedSignatures.get(key as unknown as CachedSignatureKey);
  if (instantiation === undefined) {
    instantiation = Checker_createSignatureInstantiation(receiver, sig, typeArguments);
    receiver!.cachedSignatures.set(key as unknown as CachedSignatureKey, instantiation);
  }
  return instantiation;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createSignatureInstantiation","kind":"method","status":"implemented","sigHash":"630f00305534cb7148da172e49f25a030b1f38eb2941c2020bc236b3220cc346","bodyHash":"689b9d664e69aa5fe33e582f8d9011c1c63325b7d9d9b636e89a0637c84ffbd1"}
 *
 * Go source:
 * func (c *Checker) createSignatureInstantiation(sig *Signature, typeArguments []*Type) *Signature {
 * 	return c.instantiateSignatureEx(sig, c.createSignatureTypeMapper(sig, typeArguments), true /*eraseTypeParameters* /)
 * }
 */
export function Checker_createSignatureInstantiation(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, typeArguments: GoSlice<GoPtr<Type>>): GoPtr<Signature> {
  return Checker_instantiateSignatureEx(receiver, sig, Checker_createSignatureTypeMapper(receiver, sig, typeArguments), true);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createSignatureTypeMapper","kind":"method","status":"implemented","sigHash":"f64f28afca514f4d3a0818c941b3f83f5d96b0d610b5331ac900e9adf458e2f5","bodyHash":"9dae9800aee00a5686035dfa450ab2068ba93af8603d6870c1459726094d5544"}
 *
 * Go source:
 * func (c *Checker) createSignatureTypeMapper(sig *Signature, typeArguments []*Type) *TypeMapper {
 * 	return newTypeMapper(c.getTypeParametersForMapper(sig), typeArguments)
 * }
 */
export function Checker_createSignatureTypeMapper(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, typeArguments: GoSlice<GoPtr<Type>>): GoPtr<TypeMapper> {
  return newTypeMapper(Checker_getTypeParametersForMapper(receiver, sig), typeArguments);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeParametersForMapper","kind":"method","status":"implemented","sigHash":"7c8402a9f1b6c625f05c97025ae6007a3b02a7b0b934090b9d24a58008597fb7","bodyHash":"dd1a8d320eb2ce0bf61e1bc753d4115774251f38e1959853d893f52fa3b19959"}
 *
 * Go source:
 * func (c *Checker) getTypeParametersForMapper(sig *Signature) []*Type {
 * 	return core.SameMap(sig.typeParameters, func(tp *Type) *Type { return c.instantiateType(tp, tp.Mapper()) })
 * }
 */
export function Checker_getTypeParametersForMapper(receiver: GoPtr<Checker>, sig: GoPtr<Signature>): GoSlice<GoPtr<Type>> {
  return core.SameMap(sig!.typeParameters, (tp: GoPtr<Type>) => Checker_instantiateType(receiver, tp, Type_Mapper(tp)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSingleCallSignature","kind":"method","status":"implemented","sigHash":"9de192c4ba3fc7e5918e660929e0a1ae75b800ff4fd63b58ab50ec21959b88f6","bodyHash":"15c43516c5df9b23c962b1c9420a0abe68688d106aae05633d88339fbd2409a3"}
 *
 * Go source:
 * func (c *Checker) getSingleCallSignature(t *Type) *Signature {
 * 	return c.getSingleSignature(t, SignatureKindCall, false /*allowMembers* /)
 * }
 */
export function Checker_getSingleCallSignature(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Signature> {
  return Checker_getSingleSignature(receiver, t, SignatureKindCall, false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSingleCallOrConstructSignature","kind":"method","status":"implemented","sigHash":"92013c0ea077bb39333b18b4fb281dbe53004570a448804eab0f033ae53bf13d","bodyHash":"da35cf4d4e062eb0412172401844d51c7f51acb5919592328a97c0c544da986d"}
 *
 * Go source:
 * func (c *Checker) getSingleCallOrConstructSignature(t *Type) *Signature {
 * 	callSig := c.getSingleSignature(t, SignatureKindCall, false /*allowMembers* /)
 * 	if callSig != nil {
 * 		return callSig
 * 	}
 * 	return c.getSingleSignature(t, SignatureKindConstruct, false /*allowMembers* /)
 * }
 */
export function Checker_getSingleCallOrConstructSignature(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Signature> {
  const callSig = Checker_getSingleSignature(receiver, t, SignatureKindCall, false);
  if (callSig !== undefined) {
    return callSig;
  }
  return Checker_getSingleSignature(receiver, t, SignatureKindConstruct, false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSingleSignature","kind":"method","status":"implemented","sigHash":"7e22b62c0304062f3158dca7e9887bdd2f85f7e392a3d27c22a34779e7ebff00","bodyHash":"7842697ebc4e30e84f9b79b60c0b2f2a0c86f820618d336316ba2ae91447caef"}
 *
 * Go source:
 * func (c *Checker) getSingleSignature(t *Type, kind SignatureKind, allowMembers bool) *Signature {
 * 	if t.flags&TypeFlagsObject != 0 {
 * 		resolved := c.resolveStructuredTypeMembers(t)
 * 		if allowMembers || len(resolved.properties) == 0 && len(resolved.indexInfos) == 0 {
 * 			if kind == SignatureKindCall && len(resolved.CallSignatures()) == 1 && len(resolved.ConstructSignatures()) == 0 {
 * 				return resolved.CallSignatures()[0]
 * 			}
 * 			if kind == SignatureKindConstruct && len(resolved.ConstructSignatures()) == 1 && len(resolved.CallSignatures()) == 0 {
 * 				return resolved.ConstructSignatures()[0]
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getSingleSignature(receiver: GoPtr<Checker>, t: GoPtr<Type>, kind: SignatureKind, allowMembers: bool): GoPtr<Signature> {
  if ((t!.flags & TypeFlagsObject) !== 0) {
    const resolved = Checker_resolveStructuredTypeMembers(receiver, t);
    const callSignatures = StructuredType_CallSignatures(resolved);
    const constructSignatures = StructuredType_ConstructSignatures(resolved);
    if (allowMembers || ((resolved!.properties ?? []).length === 0 && (resolved!.indexInfos ?? []).length === 0)) {
      if (kind === SignatureKindCall && callSignatures.length === 1 && constructSignatures.length === 0) {
        return callSignatures[0];
      }
      if (kind === SignatureKindConstruct && constructSignatures.length === 1 && callSignatures.length === 0) {
        return constructSignatures[0];
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getOrCreateTypeFromSignature","kind":"method","status":"implemented","sigHash":"07e8e120451c03e87dbbc9f7cd823b90e9915ce423d6d7c68c81fa31ed3826c2","bodyHash":"f9fdbd201db3d95ef1857ce220eeaf349d67a02551aba489efa23e96755131d3"}
 *
 * Go source:
 * func (c *Checker) getOrCreateTypeFromSignature(sig *Signature) *Type {
 * 	// There are two ways to declare a construct signature, one is by declaring a class constructor
 * 	// using the constructor keyword, and the other is declaring a bare construct signature in an
 * 	// object type literal or interface (using the new keyword). Each way of declaring a constructor
 * 	// will result in a different declaration kind.
 * 	if sig.isolatedSignatureType == nil {
 * 		var kind ast.Kind
 * 		if sig.declaration != nil {
 * 			kind = sig.declaration.Kind
 * 		}
 * 		// If declaration is undefined, it is likely to be the signature of the default constructor.
 * 		isConstructor := kind == ast.KindUnknown || kind == ast.KindConstructor || kind == ast.KindConstructSignature || kind == ast.KindConstructorType
 * 
 * 		var symbol *ast.Symbol
 * 		if sig.declaration != nil {
 * 			symbol = sig.declaration.Symbol()
 * 		}
 * 		t := c.newObjectType(ObjectFlagsAnonymous|ObjectFlagsSingleSignatureType, symbol)
 * 		if isConstructor {
 * 			c.setStructuredTypeMembers(t, nil, nil, []*Signature{sig}, nil)
 * 		} else {
 * 			c.setStructuredTypeMembers(t, nil, []*Signature{sig}, nil, nil)
 * 		}
 * 		sig.isolatedSignatureType = t
 * 	}
 * 	return sig.isolatedSignatureType
 * }
 */
export function Checker_getOrCreateTypeFromSignature(receiver: GoPtr<Checker>, sig: GoPtr<Signature>): GoPtr<Type> {
  if (sig!.isolatedSignatureType === undefined) {
    let kind = KindUnknown;
    if (sig!.declaration !== undefined) {
      kind = sig!.declaration.Kind;
    }
    const isConstructor = kind === KindUnknown || kind === KindConstructor || kind === KindConstructSignature || kind === KindConstructorType;
    let symbol_: GoPtr<Symbol> = undefined;
    if (sig!.declaration !== undefined) {
      symbol_ = Node_Symbol(sig!.declaration);
    }
    const t = Checker_newObjectType(receiver, ObjectFlagsAnonymous | ObjectFlagsSingleSignatureType, symbol_);
    if (isConstructor) {
      Checker_setStructuredTypeMembers(receiver, t, undefined as unknown as SymbolTable, [], [sig], []);
    } else {
      Checker_setStructuredTypeMembers(receiver, t, undefined as unknown as SymbolTable, [sig], [], []);
    }
    sig!.isolatedSignatureType = t;
  }
  return sig!.isolatedSignatureType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getErasedSignature","kind":"method","status":"implemented","sigHash":"fedbb8f99106887c9043f8aed2ec0a1d2c2735a347b2c879a87ee0504d80c0d7","bodyHash":"ad773a5ec111b5185ee4ea1db726145249ee8be7dbeac02a26767f413cd68b9b"}
 *
 * Go source:
 * func (c *Checker) getErasedSignature(signature *Signature) *Signature {
 * 	if len(signature.typeParameters) == 0 {
 * 		return signature
 * 	}
 * 	key := CachedSignatureKey{sig: signature, key: SignatureKeyErased}
 * 	erased := c.cachedSignatures[key]
 * 	if erased == nil {
 * 		erased = c.instantiateSignatureEx(signature, newArrayToSingleTypeMapper(signature.typeParameters, c.anyType), true /*eraseTypeParameters* /)
 * 		c.cachedSignatures[key] = erased
 * 	}
 * 	return erased
 * }
 */
export function Checker_getErasedSignature(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): GoPtr<Signature> {
  if (signature!.typeParameters.length === 0) {
    return signature;
  }
  const key: CachedSignatureKey = { sig: signature, key: SignatureKeyErased };
  let erased = receiver!.cachedSignatures.get(key as unknown as CachedSignatureKey);
  if (erased === undefined) {
    erased = Checker_instantiateSignatureEx(receiver, signature, newArrayToSingleTypeMapper(signature!.typeParameters, receiver!.anyType), true);
    receiver!.cachedSignatures.set(key as unknown as CachedSignatureKey, erased);
  }
  return erased;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getCanonicalSignature","kind":"method","status":"implemented","sigHash":"c67f9d9003e262ecaaf0f6da34c2762847b1de7c29aa29f72f0abb464fae51aa","bodyHash":"6f477b99810174a3878e3561dfa6b011b2110230105f52e794161aa04dcb1eb7"}
 *
 * Go source:
 * func (c *Checker) getCanonicalSignature(signature *Signature) *Signature {
 * 	if len(signature.typeParameters) == 0 {
 * 		return signature
 * 	}
 * 	key := CachedSignatureKey{sig: signature, key: SignatureKeyCanonical}
 * 	canonical := c.cachedSignatures[key]
 * 	if canonical == nil {
 * 		canonical = c.createCanonicalSignature(signature)
 * 		c.cachedSignatures[key] = canonical
 * 	}
 * 	return canonical
 * }
 */
export function Checker_getCanonicalSignature(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): GoPtr<Signature> {
  if (signature!.typeParameters.length === 0) {
    return signature;
  }
  const key: CachedSignatureKey = { sig: signature, key: SignatureKeyCanonical };
  let canonical = receiver!.cachedSignatures.get(key as unknown as CachedSignatureKey);
  if (canonical === undefined) {
    canonical = Checker_createCanonicalSignature(receiver, signature);
    receiver!.cachedSignatures.set(key as unknown as CachedSignatureKey, canonical);
  }
  return canonical;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createCanonicalSignature","kind":"method","status":"implemented","sigHash":"f2a151f8882084afdb1dad47e16e51b89b979864a907b92766cb434274b46413","bodyHash":"d5a4e6c7715ac1b88eec67976df8938b7580c5e8d9cae9c05a3f535a0ca7ad31"}
 *
 * Go source:
 * func (c *Checker) createCanonicalSignature(signature *Signature) *Signature {
 * 	// Create an instantiation of the signature where each unconstrained type parameter is replaced with
 * 	// its original. When a generic class or interface is instantiated, each generic method in the class or
 * 	// interface is instantiated with a fresh set of cloned type parameters (which we need to handle scenarios
 * 	// where different generations of the same type parameter are in scope). This leads to a lot of new type
 * 	// identities, and potentially a lot of work comparing those identities, so here we create an instantiation
 * 	// that uses the original type identities for all unconstrained type parameters.
 * 	typeArguments := core.Map(signature.typeParameters, func(tp *Type) *Type {
 * 		if tp.Target() != nil && c.getConstraintOfTypeParameter(tp.Target()) == nil {
 * 			return tp.Target()
 * 		}
 * 		return tp
 * 	})
 * 	return c.getSignatureInstantiation(signature, typeArguments, ast.IsInJSFile(signature.declaration), nil /*inferredTypeParameters* /)
 * }
 */
export function Checker_createCanonicalSignature(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): GoPtr<Signature> {
  const typeArguments = core.Map(signature!.typeParameters, (tp: GoPtr<Type>) => {
    const target = Type_Target(tp);
    if (target !== undefined && Checker_getConstraintOfTypeParameter(receiver, target) === undefined) {
      return target;
    }
    return tp;
  });
  return Checker_getSignatureInstantiation(receiver, signature, typeArguments, IsInJSFile(signature!.declaration), undefined as unknown as GoSlice<GoPtr<Type>>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getBaseSignature","kind":"method","status":"implemented","sigHash":"dad4d349d561e4a742b1d6a2433a1c3d7b739120db9cc49ff5578600578d9ee8","bodyHash":"90cdebb451de639202530b3e31bc06628a2e38f00471c2ef5341c4a5e96dbe50"}
 *
 * Go source:
 * func (c *Checker) getBaseSignature(signature *Signature) *Signature {
 * 	typeParameters := signature.typeParameters
 * 	if len(typeParameters) == 0 {
 * 		return signature
 * 	}
 * 	key := CachedSignatureKey{sig: signature, key: SignatureKeyBase}
 * 	if cached := c.cachedSignatures[key]; cached != nil {
 * 		return cached
 * 	}
 * 	baseConstraintMapper := newTypeMapper(typeParameters, core.Map(typeParameters, func(tp *Type) *Type {
 * 		return core.OrElse(c.getConstraintOfTypeParameter(tp), c.unknownType)
 * 	}))
 * 	baseConstraints := core.Map(typeParameters, func(tp *Type) *Type {
 * 		return c.instantiateType(tp, baseConstraintMapper)
 * 	})
 * 	// Run N type params thru the immediate constraint mapper up to N times
 * 	// This way any noncircular interdependent type parameters are definitely resolved to their external dependencies
 * 	for range typeParameters {
 * 		baseConstraints = c.instantiateTypes(baseConstraints, baseConstraintMapper)
 * 	}
 * 	// and then apply a type eraser to remove any remaining circularly dependent type parameters
 * 	baseConstraints = c.instantiateTypes(baseConstraints, newArrayToSingleTypeMapper(typeParameters, c.anyType))
 * 	result := c.instantiateSignatureEx(signature, newTypeMapper(typeParameters, baseConstraints), true /*eraseTypeParameters* /)
 * 	c.cachedSignatures[key] = result
 * 	return result
 * }
 */
export function Checker_getBaseSignature(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): GoPtr<Signature> {
  const typeParameters = signature!.typeParameters;
  if (typeParameters.length === 0) {
    return signature;
  }
  const key: CachedSignatureKey = { sig: signature, key: SignatureKeyBase };
  const cached = receiver!.cachedSignatures.get(key as unknown as CachedSignatureKey);
  if (cached !== undefined) {
    return cached;
  }
  const baseConstraintMapper = newTypeMapper(typeParameters, core.Map(typeParameters, (tp: GoPtr<Type>) => core.OrElse(Checker_getConstraintOfTypeParameter(receiver, tp), receiver!.unknownType)));
  let baseConstraints = core.Map(typeParameters, (tp: GoPtr<Type>) => Checker_instantiateType(receiver, tp, baseConstraintMapper));
  for (let index = 0; index < typeParameters.length; index++) {
    baseConstraints = Checker_instantiateTypes(receiver, baseConstraints, baseConstraintMapper);
  }
  baseConstraints = Checker_instantiateTypes(receiver, baseConstraints, newArrayToSingleTypeMapper(typeParameters, receiver!.anyType));
  const result = Checker_instantiateSignatureEx(receiver, signature, newTypeMapper(typeParameters, baseConstraints), true);
  receiver!.cachedSignatures.set(key as unknown as CachedSignatureKey, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.instantiateSignatureInContextOf","kind":"method","status":"implemented","sigHash":"eddbfc389da006d92a84e02e64ee151046dec99ebb454c4e00dfc946f79dbc1f","bodyHash":"f7f89e49e5520c0ebd46437ab7823fd9812e116f9389b4e40039cb2dab5f9079"}
 *
 * Go source:
 * func (c *Checker) instantiateSignatureInContextOf(signature *Signature, contextualSignature *Signature, inferenceContext *InferenceContext, compareTypes TypeComparer) *Signature {
 * 	context := c.newInferenceContext(c.getTypeParametersForMapper(signature), signature, InferenceFlagsNone, compareTypes)
 * 	// We clone the inferenceContext to avoid fixing. For example, when the source signature is <T>(x: T) => T[] and
 * 	// the contextual signature is (...args: A) => B, we want to infer the element type of A's constraint (say 'any')
 * 	// for T but leave it possible to later infer '[any]' back to A.
 * 	restType := c.getEffectiveRestType(contextualSignature)
 * 	var mapper *TypeMapper
 * 	if inferenceContext != nil {
 * 		if restType != nil && restType.flags&TypeFlagsTypeParameter != 0 {
 * 			mapper = inferenceContext.nonFixingMapper
 * 		} else {
 * 			mapper = inferenceContext.mapper
 * 		}
 * 	}
 * 	var sourceSignature *Signature
 * 	if mapper != nil {
 * 		sourceSignature = c.instantiateSignature(contextualSignature, mapper)
 * 	} else {
 * 		sourceSignature = contextualSignature
 * 	}
 * 	c.applyToParameterTypes(sourceSignature, signature, func(source *Type, target *Type) {
 * 		// Type parameters from outer context referenced by source type are fixed by instantiation of the source type
 * 		c.inferTypes(context.inferences, source, target, InferencePriorityNone, false)
 * 	})
 * 	if inferenceContext == nil {
 * 		c.applyToReturnTypes(contextualSignature, signature, func(source *Type, target *Type) {
 * 			c.inferTypes(context.inferences, source, target, InferencePriorityReturnType, false)
 * 		})
 * 	}
 * 	return c.getSignatureInstantiation(signature, c.getInferredTypes(context), ast.IsInJSFile(contextualSignature.declaration), nil /*inferredTypeParameters* /)
 * }
 */
export function Checker_instantiateSignatureInContextOf(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, contextualSignature: GoPtr<Signature>, inferenceContext: GoPtr<InferenceContext>, compareTypes: TypeComparer | undefined): GoPtr<Signature> {
  const context = Checker_newInferenceContext(receiver, Checker_getTypeParametersForMapper(receiver, signature), signature, InferenceFlagsNone, compareTypes);
  const restType = Checker_getEffectiveRestType(receiver, contextualSignature);
  let mapper: GoPtr<TypeMapper>;
  if (inferenceContext !== undefined) {
    if (restType !== undefined && (restType!.flags & TypeFlagsTypeParameter) !== 0) {
      mapper = inferenceContext!.nonFixingMapper;
    } else {
      mapper = inferenceContext!.mapper;
    }
  }
  const sourceSignature = mapper !== undefined ? Checker_instantiateSignature(receiver, contextualSignature, mapper) : contextualSignature;
  Checker_applyToParameterTypes(receiver, sourceSignature, signature, (source: GoPtr<Type>, target: GoPtr<Type>): void => {
    Checker_inferTypes(receiver, context!.inferences, source, target, InferencePriorityNone, false);
  });
  if (inferenceContext === undefined) {
    Checker_applyToReturnTypes(receiver, contextualSignature, signature, (source: GoPtr<Type>, target: GoPtr<Type>): void => {
      Checker_inferTypes(receiver, context!.inferences, source, target, InferencePriorityReturnType, false);
    });
  }
  return Checker_getSignatureInstantiation(receiver, signature, Checker_getInferredTypes(receiver, context), IsInJSFile(contextualSignature!.declaration), undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.areAllOuterTypeParametersApplied","kind":"method","status":"implemented","sigHash":"f33f7fce6e563a5d25bb4c42e06facf91b9246e26083188387d9fb479219ff81","bodyHash":"9218e9dbac827b5814c8c83b6c8023975c235cd4328d0e2de1335d48d281aa19"}
 *
 * Go source:
 * func (c *Checker) areAllOuterTypeParametersApplied(t *Type) bool {
 * 	// An unapplied type parameter has its symbol still the same as the matching argument symbol.
 * 	// Since parameters are applied outer-to-inner, only the last outer parameter needs to be checked.
 * 	outerTypeParameters := t.AsInterfaceType().OuterTypeParameters()
 * 	if len(outerTypeParameters) != 0 {
 * 		last := len(outerTypeParameters) - 1
 * 		typeArguments := c.getTypeArguments(t)
 * 		return outerTypeParameters[last].symbol != typeArguments[last].symbol
 * 	}
 * 	return true
 * }
 */
export function Checker_areAllOuterTypeParametersApplied(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  const outerTypeParameters = InterfaceType_OuterTypeParameters(Type_AsInterfaceType(t));
  if ((outerTypeParameters ?? []).length !== 0) {
    const last = outerTypeParameters!.length - 1;
    const typeArguments = Checker_getTypeArguments(receiver, t);
    return outerTypeParameters![last]!.symbol !== typeArguments[last]!.symbol;
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeWithThisArgument","kind":"method","status":"implemented","sigHash":"7d06ee979b4d360d3ac69112a2ddb97f8033ace7817ab4bc6808e132966e87a3","bodyHash":"aa9c999f256dd00a3ed3d1b81aef314a12d0e964f5b2572a9851c9403a86139c"}
 *
 * Go source:
 * func (c *Checker) getTypeWithThisArgument(t *Type, thisArgument *Type, needApparentType bool) *Type {
 * 	if t.objectFlags&ObjectFlagsReference != 0 {
 * 		target := t.Target()
 * 		typeArguments := c.getTypeArguments(t)
 * 		if len(target.AsInterfaceType().TypeParameters()) == len(typeArguments) {
 * 			if thisArgument == nil {
 * 				thisArgument = target.AsInterfaceType().thisType
 * 			}
 * 			return c.createTypeReference(target, core.Concatenate(typeArguments, []*Type{thisArgument}))
 * 		}
 * 		return t
 * 	} else if t.flags&TypeFlagsIntersection != 0 {
 * 		types := t.Types()
 * 		newTypes := core.SameMap(types, func(t *Type) *Type { return c.getTypeWithThisArgument(t, thisArgument, needApparentType) })
 * 		if core.Same(newTypes, types) {
 * 			return t
 * 		}
 * 		return c.getIntersectionType(newTypes)
 * 	}
 * 	if needApparentType {
 * 		return c.getApparentType(t)
 * 	}
 * 	return t
 * }
 */
export function Checker_getTypeWithThisArgument(receiver: GoPtr<Checker>, t: GoPtr<Type>, thisArgument: GoPtr<Type>, needApparentType: bool): GoPtr<Type> {
  if ((t!.objectFlags & ObjectFlagsReference) !== 0) {
    const target = Type_Target(t);
    const typeArguments = Checker_getTypeArguments(receiver, t);
    if ((InterfaceType_TypeParameters(Type_AsInterfaceType(target)) ?? []).length === typeArguments.length) {
      const thisArg = core.OrElse(thisArgument, Type_AsInterfaceType(target)!.thisType);
      return Checker_createTypeReference(receiver, target, core.Concatenate(typeArguments, [thisArg]));
    }
    return t;
  } else if ((t!.flags & TypeFlagsIntersection) !== 0) {
    const types = Type_Types(t);
    const newTypes = core.SameMap(types, (t2: GoPtr<Type>) => Checker_getTypeWithThisArgument(receiver, t2, thisArgument, needApparentType));
    if (core.Same(newTypes, types)) {
      return t;
    }
    return Checker_getIntersectionType(receiver, newTypes);
  }
  if (needApparentType) {
    return Checker_getApparentType(receiver, t);
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSignaturesOfSymbol","kind":"method","status":"implemented","sigHash":"081addefada23b2ac3735f3c1719b5761d0db69db6245b8747952e9571c42f0d","bodyHash":"086da1e53c6297209ad2180f42b4514741ad23738383c2d8ae5027e664bc3ba8"}
 *
 * Go source:
 * func (c *Checker) getSignaturesOfSymbol(symbol *ast.Symbol) []*Signature {
 * 	if symbol == nil {
 * 		return nil
 * 	}
 * 	var result []*Signature
 * 	for i, decl := range symbol.Declarations {
 * 		if !ast.IsFunctionLike(decl) {
 * 			continue
 * 		}
 * 		// Don't include signature if node is the implementation of an overloaded function. A node is considered
 * 		// an implementation node if it has a body and the previous node is of the same kind and immediately
 * 		// precedes the implementation node (i.e. has the same parent and ends where the implementation starts).
 * 		if i > 0 && decl.Body() != nil {
 * 			previous := symbol.Declarations[i-1]
 * 			if decl.Parent == previous.Parent && decl.Kind == previous.Kind &&
 * 				(decl.Pos() == previous.End() || previous.Flags&ast.NodeFlagsReparsed != 0) {
 * 				continue
 * 			}
 * 		}
 * 		// If this is a function or method declaration, get the signature from the @type tag for the sake of optional parameters.
 * 		// Exclude contextually-typed kinds because we already apply the @type tag to the context, plus applying it here to the initializer would suppress checks that the two are compatible.
 * 		sig := c.getSignatureOfFullSignatureType(decl)
 * 		if sig == nil {
 * 			sig = c.getSignatureFromDeclaration(decl)
 * 		}
 * 		result = append(result, sig)
 * 	}
 * 	return result
 * }
 */
export function Checker_getSignaturesOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Signature>> {
  if (symbol_ === undefined) {
    return [];
  }
  const result: GoPtr<Signature>[] = [];
  const declarations = symbol_!.Declarations ?? [];
  for (let i = 0; i < declarations.length; i++) {
    const decl = declarations[i];
    if (!IsFunctionLike(decl)) {
      continue;
    }
    if (i > 0 && Node_Body(decl) !== undefined) {
      const previous = declarations[i - 1];
      if (decl!.Parent === previous!.Parent && decl!.Kind === previous!.Kind &&
        (Node_Pos(decl) === Node_End(previous) || (previous!.Flags & NodeFlagsReparsed) !== 0)) {
        continue;
      }
    }
    let sig = Checker_getSignatureOfFullSignatureType(receiver, decl);
    if (sig === undefined) {
      sig = Checker_getSignatureFromDeclaration(receiver, decl);
    }
    result.push(sig);
  }
  return result as GoSlice<GoPtr<Signature>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSignatureFromDeclaration","kind":"method","status":"implemented","sigHash":"ee770b9980969ab7ab7012ac9a1714c1d871e9c3f83494c8d6cff09c8370c9f8","bodyHash":"fbff957eb15cced3c4cd0986c743a2f235960a01ea5cc5c4d72f50cd6fe518ff"}
 *
 * Go source:
 * func (c *Checker) getSignatureFromDeclaration(declaration *ast.Node) *Signature {
 * 	links := c.signatureLinks.Get(declaration)
 * 	if links.resolvedSignature != nil {
 * 		return links.resolvedSignature
 * 	}
 * 	var parameters []*ast.Symbol
 * 	var flags SignatureFlags
 * 	var thisParameter *ast.Symbol
 * 	minArgumentCount := 0
 * 	hasThisParameter := false
 * 	iife := ast.GetImmediatelyInvokedFunctionExpression(declaration)
 * 	isUntypedSignatureInJSFile := iife == nil &&
 * 		ast.IsInJSFile(declaration) &&
 * 		(ast.IsFunctionExpression(declaration) || ast.IsArrowFunction(declaration) || ast.IsMethodOrAccessor(declaration) || ast.IsFunctionDeclaration(declaration) || ast.IsConstructorDeclaration(declaration)) &&
 * 		core.Every(declaration.Parameters(), func(param *ast.Node) bool { return param.Type() == nil }) &&
 * 		c.getContextualType(declaration, ContextFlagsSignature) == nil
 * 	if isUntypedSignatureInJSFile {
 * 		flags |= SignatureFlagsIsUntypedSignatureInJSFile
 * 	}
 * 	for i, param := range declaration.Parameters() {
 * 		paramSymbol := param.Symbol()
 * 		typeNode := param.Type()
 * 		// Include parameter symbol instead of property symbol in the signature
 * 		if paramSymbol != nil && paramSymbol.Flags&ast.SymbolFlagsProperty != 0 && !ast.IsBindingPattern(param.Name()) {
 * 			resolvedSymbol := c.resolveName(param, paramSymbol.Name, ast.SymbolFlagsValue, nil /*nameNotFoundMessage* /, false /*isUse* /, false /*excludeGlobals* /)
 * 			paramSymbol = resolvedSymbol
 * 		}
 * 		if i == 0 && paramSymbol.Name == ast.InternalSymbolNameThis {
 * 			hasThisParameter = true
 * 			thisParameter = param.Symbol()
 * 		} else {
 * 			parameters = append(parameters, paramSymbol)
 * 		}
 * 		if typeNode != nil && typeNode.Kind == ast.KindLiteralType {
 * 			flags |= SignatureFlagsHasLiteralTypes
 * 		}
 * 		// Record a new minimum argument count if this is not an optional parameter
 * 		isOptionalParameter := isOptionalDeclaration(param) ||
 * 			param.Initializer() != nil ||
 * 			isRestParameter(param) ||
 * 			iife != nil && len(parameters) > len(iife.Arguments()) && typeNode == nil
 * 		if !isOptionalParameter {
 * 			minArgumentCount = len(parameters)
 * 		}
 * 	}
 * 	// If only one accessor includes a this-type annotation, the other behaves as if it had the same type annotation
 * 	if (ast.IsGetAccessorDeclaration(declaration) || ast.IsSetAccessorDeclaration(declaration)) && c.hasBindableName(declaration) && (!hasThisParameter || thisParameter == nil) {
 * 		otherKind := core.IfElse(ast.IsGetAccessorDeclaration(declaration), ast.KindSetAccessor, ast.KindGetAccessor)
 * 		other := ast.GetDeclarationOfKind(c.getSymbolOfDeclaration(declaration), otherKind)
 * 		if other != nil {
 * 			thisParameter = c.getAnnotatedAccessorThisParameter(other)
 * 		}
 * 	}
 * 	var classType *Type
 * 	if ast.IsConstructorDeclaration(declaration) {
 * 		classType = c.getDeclaredTypeOfClassOrInterface(c.getMergedSymbol(declaration.Parent.Symbol()))
 * 	}
 * 	var typeParameters []*Type
 * 	if classType != nil {
 * 		typeParameters = classType.AsInterfaceType().LocalTypeParameters()
 * 	} else {
 * 		typeParameters = c.getTypeParametersFromDeclaration(declaration)
 * 	}
 * 	if hasRestParameter(declaration) {
 * 		flags |= SignatureFlagsHasRestParameter
 * 	}
 * 	if ast.IsConstructorTypeNode(declaration) || ast.IsConstructorDeclaration(declaration) || ast.IsConstructSignatureDeclaration(declaration) {
 * 		flags |= SignatureFlagsConstruct
 * 	}
 * 	if ast.IsConstructorTypeNode(declaration) && ast.HasSyntacticModifier(declaration, ast.ModifierFlagsAbstract) || ast.IsConstructorDeclaration(declaration) && ast.HasSyntacticModifier(declaration.Parent, ast.ModifierFlagsAbstract) {
 * 		flags |= SignatureFlagsAbstract
 * 	}
 * 	links.resolvedSignature = c.newSignature(flags, declaration, typeParameters, thisParameter, parameters, nil /*resolvedReturnType* /, nil /*resolvedTypePredicate* /, minArgumentCount)
 * 	return links.resolvedSignature
 * }
 */
export function Checker_getSignatureFromDeclaration(receiver: GoPtr<Checker>, declaration: GoPtr<Node>): GoPtr<Signature> {
  const links = LinkStore_Get(receiver!.signatureLinks, declaration) as GoPtr<SignatureLinks>;
  if (links!.resolvedSignature !== undefined) {
    return links!.resolvedSignature;
  }
  const parameters: GoSlice<GoPtr<Symbol>> = [];
  let flags = SignatureFlagsNone;
  let thisParameter: GoPtr<Symbol>;
  let minArgumentCount: int = 0;
  let hasThisParameter = false;
  const iife = GetImmediatelyInvokedFunctionExpression(declaration);
  const isUntypedSignatureInJSFile = iife === undefined
    && IsInJSFile(declaration)
    && (IsFunctionExpression(declaration) || IsArrowFunction(declaration) || IsMethodOrAccessor(declaration) || IsFunctionDeclaration(declaration) || IsConstructorDeclaration(declaration))
    && core.Every(Node_Parameters(declaration), (param: GoPtr<Node>) => Node_Type(param) === undefined)
    && Checker_getContextualType(receiver, declaration, ContextFlagsSignature) === undefined;
  if (isUntypedSignatureInJSFile) {
    flags = (flags | SignatureFlagsIsUntypedSignatureInJSFile) as SignatureFlags;
  }
  for (const [i, param] of (Node_Parameters(declaration) ?? []).entries()) {
    let paramSymbol = Node_Symbol(param);
    const typeNode = Node_Type(param);
    if (paramSymbol !== undefined && (paramSymbol!.Flags & SymbolFlagsProperty) !== 0 && !IsBindingPattern(Node_Name(param))) {
      const resolvedSymbol = receiver!.resolveName(param, paramSymbol!.Name, SymbolFlagsValue, undefined, false, false);
      paramSymbol = resolvedSymbol;
    }
    if (i === 0 && paramSymbol!.Name === InternalSymbolNameThis) {
      hasThisParameter = true;
      thisParameter = Node_Symbol(param);
    } else {
      parameters.push(paramSymbol);
    }
    if (typeNode !== undefined && typeNode!.Kind === KindLiteralType) {
      flags = (flags | SignatureFlagsHasLiteralTypes) as SignatureFlags;
    }
    const isOptionalParameter = isOptionalDeclaration(param)
      || Node_Initializer(param) !== undefined
      || isRestParameter(param)
      || (iife !== undefined && parameters.length > (Node_Arguments(iife) ?? []).length && typeNode === undefined);
    if (!isOptionalParameter) {
      minArgumentCount = parameters.length as int;
    }
  }
  if ((IsGetAccessorDeclaration(declaration) || IsSetAccessorDeclaration(declaration)) && Checker_hasBindableName(receiver, declaration) && (!hasThisParameter || thisParameter === undefined)) {
    const otherKind = core.IfElse(IsGetAccessorDeclaration(declaration), KindSetAccessor, KindGetAccessor);
    const other = GetDeclarationOfKind(Checker_getSymbolOfDeclaration(receiver, declaration), otherKind);
    if (other !== undefined) {
      thisParameter = Checker_getAnnotatedAccessorThisParameter(receiver, other);
    }
  }
  let classType: GoPtr<Type>;
  if (IsConstructorDeclaration(declaration)) {
    classType = Checker_getDeclaredTypeOfClassOrInterface(receiver, Checker_getMergedSymbol(receiver, Node_Symbol(declaration!.Parent)));
  }
  const typeParameters = classType !== undefined
    ? InterfaceType_LocalTypeParameters(Type_AsInterfaceType(classType))
    : Checker_getTypeParametersFromDeclaration(receiver, declaration);
  if (hasRestParameter(declaration)) {
    flags = (flags | SignatureFlagsHasRestParameter) as SignatureFlags;
  }
  if (IsConstructorTypeNode(declaration) || IsConstructorDeclaration(declaration) || IsConstructSignatureDeclaration(declaration)) {
    flags = (flags | SignatureFlagsConstruct) as SignatureFlags;
  }
  if ((IsConstructorTypeNode(declaration) && HasSyntacticModifier(declaration, ModifierFlagsAbstract))
    || (IsConstructorDeclaration(declaration) && HasSyntacticModifier(declaration!.Parent, ModifierFlagsAbstract))) {
    flags = (flags | SignatureFlagsAbstract) as SignatureFlags;
  }
  links!.resolvedSignature = Checker_newSignature(receiver, flags, declaration, typeParameters, thisParameter, parameters, undefined, undefined, minArgumentCount);
  return links!.resolvedSignature;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeParametersFromDeclaration","kind":"method","status":"implemented","sigHash":"a063b0e90c2bc824e1e6da60e669447516b9613d791411b2f0339d17a0a24b63","bodyHash":"ba95552ed9436bf98ce9534ba4b629d60e108cc6882a8868419d7aa671909803"}
 *
 * Go source:
 * func (c *Checker) getTypeParametersFromDeclaration(declaration *ast.Node) []*Type {
 * 	if sig := c.getSignatureOfFullSignatureType(declaration); sig != nil {
 * 		return sig.TypeParameters()
 * 	}
 * 	var result []*Type
 * 	for _, node := range declaration.TypeParameters() {
 * 		result = core.AppendIfUnique(result, c.getDeclaredTypeOfTypeParameter(node.Symbol()))
 * 	}
 * 	return result
 * }
 */
export function Checker_getTypeParametersFromDeclaration(receiver: GoPtr<Checker>, declaration: GoPtr<Node>): GoSlice<GoPtr<Type>> {
  const sig = Checker_getSignatureOfFullSignatureType(receiver, declaration);
  if (sig !== undefined) {
    return sig!.typeParameters;
  }
  let result: GoSlice<GoPtr<Type>> = [];
  for (const node of Node_TypeParameters(declaration) ?? []) {
    result = core.AppendIfUnique(result, Checker_getDeclaredTypeOfTypeParameter(receiver, Node_Symbol(node)));
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getAnnotatedAccessorThisParameter","kind":"method","status":"implemented","sigHash":"e11a7bce63956029fa477b2060a7db44b6862df1690c92e2ea9eae66e8d5cfdb","bodyHash":"8f49b30226645243932a062a5c5a6fff84fdd48e42aa85de1d89a6e06bdb09ce"}
 *
 * Go source:
 * func (c *Checker) getAnnotatedAccessorThisParameter(accessor *ast.Node) *ast.Symbol {
 * 	parameter := c.getAccessorThisParameter(accessor)
 * 	if parameter != nil {
 * 		return parameter.Symbol()
 * 	}
 * 	return nil
 * }
 */
export function Checker_getAnnotatedAccessorThisParameter(receiver: GoPtr<Checker>, accessor: GoPtr<Node>): GoPtr<Symbol> {
  const parameter = Checker_getAccessorThisParameter(receiver, accessor);
  if (parameter !== undefined) {
    return Node_Symbol(parameter);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getAccessorThisParameter","kind":"method","status":"implemented","sigHash":"8f92422cd97ba50bebe0ad7cdad6f9a705c19a1823f3a8c277d433e5e23e4dde","bodyHash":"d10c27341f5f7b875c8d750e3a9c5d5e3071afe6a2459e04ab3c94956247e4d1"}
 *
 * Go source:
 * func (c *Checker) getAccessorThisParameter(accessor *ast.Node) *ast.Node {
 * 	if len(accessor.Parameters()) == core.IfElse(ast.IsGetAccessorDeclaration(accessor), 1, 2) {
 * 		return ast.GetThisParameter(accessor)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getAccessorThisParameter(receiver: GoPtr<Checker>, accessor: GoPtr<Node>): GoPtr<Node> {
  if (Node_Parameters(accessor).length === core.IfElse(IsGetAccessorDeclaration(accessor), 1, 2)) {
    return GetThisParameter(accessor);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasLateBindableIndexSignature","kind":"method","status":"implemented","sigHash":"8340a9b041cf06f3be6fafff63e4971dbdbc0dc4a71ae4ac6c66af17944f883c","bodyHash":"3493698267798e090f8ed223fb523a4dc0765dbb34cce0836919fa54d37083c7"}
 *
 * Go source:
 * func (c *Checker) hasLateBindableIndexSignature(node *ast.Node) bool {
 * 	name := ast.GetNameOfDeclaration(node)
 * 	return name != nil && c.isLateBindableIndexSignature(name)
 * }
 */
export function Checker_hasLateBindableIndexSignature(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  const name = GetNameOfDeclaration(node);
  return name !== undefined && Checker_isLateBindableIndexSignature(receiver, name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isLateBindableIndexSignature","kind":"method","status":"implemented","sigHash":"a5d739ba1fad244d682fb0c01f2e31c9a0704e07853b66bb4b4000fb9d6d109b","bodyHash":"a0684718f64a95762f76c900f2ddb4610d3c302bf3dab02b2aa6d5a397ca7d23"}
 *
 * Go source:
 * func (c *Checker) isLateBindableIndexSignature(node *ast.Node) bool {
 * 	if !isLateBindableAST(node) {
 * 		return false
 * 	}
 * 	if ast.IsComputedPropertyName(node) {
 * 		return c.isTypeUsableAsIndexSignatureDeclaration(c.checkComputedPropertyName(node))
 * 	}
 * 	return c.isTypeUsableAsIndexSignatureDeclaration(c.checkExpressionCached(node.AsElementAccessExpression().ArgumentExpression))
 * }
 */
export function Checker_isLateBindableIndexSignature(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (!isLateBindableAST(node)) {
    return false;
  }
  if (IsComputedPropertyName(node)) {
    return Checker_isTypeUsableAsIndexSignatureDeclaration(receiver, Checker_checkComputedPropertyName(receiver, node));
  }
  return Checker_isTypeUsableAsIndexSignatureDeclaration(receiver, Checker_checkExpressionCached(receiver, AsElementAccessExpression(node)!.ArgumentExpression as GoPtr<Node>));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isTypeUsableAsIndexSignatureDeclaration","kind":"method","status":"implemented","sigHash":"d02a784a762fd058fc6380b28bb73c284cd47a355e615e3823f705648df917f3","bodyHash":"5c0ba4dadec174013d1e09995f0d8aa282c3d682389f55f16d6c2d98f7ad8886"}
 *
 * Go source:
 * func (c *Checker) isTypeUsableAsIndexSignatureDeclaration(t *Type) bool {
 * 	return c.isTypeAssignableTo(t, c.stringNumberSymbolType)
 * }
 */
export function Checker_isTypeUsableAsIndexSignatureDeclaration(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  return Checker_isTypeAssignableTo(receiver, t, receiver!.stringNumberSymbolType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getReturnTypeOfSignature","kind":"method","status":"implemented","sigHash":"33410e1515531741a40c86e3ab02b0193f46da481fafe969678dcb2bf8d7deed","bodyHash":"ad37af1772482bbab91b9ffb5e1f134c09a14021d6288d43c9eb4c30fd82085e"}
 *
 * Go source:
 * func (c *Checker) getReturnTypeOfSignature(sig *Signature) *Type {
 * 	if sig.resolvedReturnType != nil {
 * 		return sig.resolvedReturnType
 * 	}
 * 	if !c.pushTypeResolution(sig, TypeSystemPropertyNameResolvedReturnType) {
 * 		return c.errorType
 * 	}
 * 	var t *Type
 * 	switch {
 * 	case sig.target != nil:
 * 		t = c.instantiateType(c.getReturnTypeOfSignature(sig.target), sig.mapper)
 * 	case sig.composite != nil:
 * 		t = c.instantiateType(c.getUnionOrIntersectionType(core.Map(sig.composite.signatures, c.getReturnTypeOfSignature), sig.composite.isUnion, UnionReductionSubtype), sig.mapper)
 * 	default:
 * 		t = c.getReturnTypeFromAnnotation(sig.declaration)
 * 		if t == nil {
 * 			if !ast.NodeIsMissing(sig.declaration.Body()) {
 * 				t = c.getReturnTypeFromBody(sig.declaration, CheckModeNormal)
 * 			} else {
 * 				t = c.anyType
 * 			}
 * 		}
 * 	}
 * 	if sig.flags&SignatureFlagsIsInnerCallChain != 0 {
 * 		t = c.addOptionalTypeMarker(t)
 * 	} else if sig.flags&SignatureFlagsIsOuterCallChain != 0 {
 * 		t = c.getOptionalType(t, false /*isProperty* /)
 * 	}
 * 	if !c.popTypeResolution() {
 * 		if sig.declaration != nil {
 * 			typeNode := sig.declaration.Type()
 * 			if typeNode != nil {
 * 				c.error(typeNode, diagnostics.Return_type_annotation_circularly_references_itself)
 * 			} else if c.noImplicitAny {
 * 				name := ast.GetNameOfDeclaration(sig.declaration)
 * 				if name != nil {
 * 					c.error(name, diagnostics.X_0_implicitly_has_return_type_any_because_it_does_not_have_a_return_type_annotation_and_is_referenced_directly_or_indirectly_in_one_of_its_return_expressions, scanner.DeclarationNameToString(name))
 * 				} else {
 * 					c.error(sig.declaration, diagnostics.Function_implicitly_has_return_type_any_because_it_does_not_have_a_return_type_annotation_and_is_referenced_directly_or_indirectly_in_one_of_its_return_expressions)
 * 				}
 * 			}
 * 		}
 * 		t = c.anyType
 * 	}
 * 	if sig.resolvedReturnType == nil {
 * 		sig.resolvedReturnType = t
 * 	}
 * 	return sig.resolvedReturnType
 * }
 */
export function Checker_getReturnTypeOfSignature(receiver: GoPtr<Checker>, sig: GoPtr<Signature>): GoPtr<Type> {
  if (sig!.resolvedReturnType !== undefined) {
    return sig!.resolvedReturnType;
  }
  if (!Checker_pushTypeResolution(receiver, sig, TypeSystemPropertyNameResolvedReturnType)) {
    return receiver!.errorType;
  }
  let t: GoPtr<Type>;
  if (sig!.target !== undefined) {
    t = Checker_instantiateType(receiver, Checker_getReturnTypeOfSignature(receiver, sig!.target), sig!.mapper);
  } else if (sig!.composite !== undefined) {
    t = Checker_instantiateType(receiver, Checker_getUnionOrIntersectionType(receiver, core.Map(sig!.composite.signatures, (signature: GoPtr<Signature>) => Checker_getReturnTypeOfSignature(receiver, signature)), sig!.composite.isUnion, UnionReductionSubtype), sig!.mapper);
  } else {
    t = Checker_getReturnTypeFromAnnotation(receiver, sig!.declaration);
    if (t === undefined) {
      if (!NodeIsMissing(Node_Body(sig!.declaration))) {
        t = Checker_getReturnTypeFromBody(receiver, sig!.declaration, CheckModeNormal);
      } else {
        t = receiver!.anyType;
      }
    }
  }
  if ((sig!.flags & SignatureFlagsIsInnerCallChain) !== 0) {
    t = Checker_addOptionalTypeMarker(receiver, t);
  } else if ((sig!.flags & SignatureFlagsIsOuterCallChain) !== 0) {
    t = Checker_getOptionalType(receiver, t, false);
  }
  if (!Checker_popTypeResolution(receiver)) {
    if (sig!.declaration !== undefined) {
      const typeNode = Node_Type(sig!.declaration);
      if (typeNode !== undefined) {
        Checker_error(receiver, typeNode, Return_type_annotation_circularly_references_itself);
      } else if (receiver!.noImplicitAny) {
        const name = GetNameOfDeclaration(sig!.declaration);
        if (name !== undefined) {
          Checker_error(receiver, name, X_0_implicitly_has_return_type_any_because_it_does_not_have_a_return_type_annotation_and_is_referenced_directly_or_indirectly_in_one_of_its_return_expressions, DeclarationNameToString(name));
        } else {
          Checker_error(receiver, sig!.declaration, Function_implicitly_has_return_type_any_because_it_does_not_have_a_return_type_annotation_and_is_referenced_directly_or_indirectly_in_one_of_its_return_expressions);
        }
      }
    }
    t = receiver!.anyType;
  }
  if (sig!.resolvedReturnType === undefined) {
    sig!.resolvedReturnType = t;
  }
  return sig!.resolvedReturnType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getNonCircularReturnTypeOfSignature","kind":"method","status":"implemented","sigHash":"d0801936cd6491f24fcb7580847fd22c4177dc24ab088d45828e2fd19cfc8ffe","bodyHash":"af76c2327b22408270ff0ac74c48ddc3edb8209e6d8764300082981a49b141ce"}
 *
 * Go source:
 * func (c *Checker) getNonCircularReturnTypeOfSignature(sig *Signature) *Type {
 * 	if c.isResolvingReturnTypeOfSignature(sig) {
 * 		return c.anyType
 * 	}
 * 	return c.getReturnTypeOfSignature(sig)
 * }
 */
export function Checker_getNonCircularReturnTypeOfSignature(receiver: GoPtr<Checker>, sig: GoPtr<Signature>): GoPtr<Type> {
  if (Checker_isResolvingReturnTypeOfSignature(receiver, sig)) {
    return receiver!.anyType;
  }
  return Checker_getReturnTypeOfSignature(receiver, sig);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getReturnTypeFromAnnotation","kind":"method","status":"implemented","sigHash":"e2a8bdf7fc0cc1762cda4b184d381d18fd19c5e26c5ac56bf76191e06e14d295","bodyHash":"bb00c2a9f9412a2f1f715c629bdc26390227184736212d867e5a4b08eb1efcff"}
 *
 * Go source:
 * func (c *Checker) getReturnTypeFromAnnotation(declaration *ast.Node) *Type {
 * 	if ast.IsConstructorDeclaration(declaration) {
 * 		return c.getDeclaredTypeOfClassOrInterface(c.getMergedSymbol(declaration.Parent.Symbol()))
 * 	}
 * 	returnType := declaration.Type()
 * 	if returnType != nil {
 * 		return c.getTypeFromTypeNode(returnType)
 * 	}
 * 	if ast.IsGetAccessorDeclaration(declaration) && c.hasBindableName(declaration) {
 * 		return c.getAnnotatedAccessorType(ast.GetDeclarationOfKind(c.getSymbolOfDeclaration(declaration), ast.KindSetAccessor))
 * 	}
 * 	return c.getReturnTypeOfFullSignature(declaration)
 * }
 */
export function Checker_getReturnTypeFromAnnotation(receiver: GoPtr<Checker>, declaration: GoPtr<Node>): GoPtr<Type> {
  if (IsConstructorDeclaration(declaration)) {
    return Checker_getDeclaredTypeOfClassOrInterface(receiver, Checker_getMergedSymbol(receiver, Node_Symbol(declaration!.Parent)));
  }
  const returnType = Node_Type(declaration);
  if (returnType !== undefined) {
    return Checker_getTypeFromTypeNode(receiver, returnType);
  }
  if (IsGetAccessorDeclaration(declaration) && Checker_hasBindableName(receiver, declaration)) {
    return Checker_getAnnotatedAccessorType(receiver, GetDeclarationOfKind(Checker_getSymbolOfDeclaration(receiver, declaration), KindSetAccessor));
  }
  return Checker_getReturnTypeOfFullSignature(receiver, declaration);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSignatureOfFullSignatureType","kind":"method","status":"implemented","sigHash":"4faf1dacbb3511e10486711666811131b4110d8492023da54129b1602769cb2c","bodyHash":"86af10fb6bd6cfcbca4021e57172d9aa31c9df535e64edadac21cf2a43ffa5dd"}
 *
 * Go source:
 * func (c *Checker) getSignatureOfFullSignatureType(node *ast.Node) *Signature {
 * 	if ast.IsInJSFile(node) && (ast.IsFunctionDeclaration(node) || ast.IsMethodDeclaration(node) || ast.IsFunctionExpressionOrArrowFunction(node)) && node.FunctionLikeData().FullSignature != nil {
 * 		return c.getSingleCallSignature(c.getTypeFromTypeNode(node.FunctionLikeData().FullSignature))
 * 	}
 * 	return nil
 * }
 */
export function Checker_getSignatureOfFullSignatureType(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Signature> {
  const funcLikeData = Node_FunctionLikeData(node);
  if (IsInJSFile(node) && (IsFunctionDeclaration(node) || IsMethodDeclaration(node) || IsFunctionExpressionOrArrowFunction(node)) && funcLikeData !== undefined && funcLikeData!.FullSignature !== undefined) {
    return Checker_getSingleCallSignature(receiver, Checker_getTypeFromTypeNode(receiver, funcLikeData!.FullSignature));
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getParameterTypeOfFullSignature","kind":"method","status":"implemented","sigHash":"9b6638b1e7364aca889bcb1880a308306d9a54eb49ad60c532ff89bb503262e6","bodyHash":"1e91a4c7e639ad22777316a67d74f3c15d6e1e5640aba2b1111fecfa4d9df75f"}
 *
 * Go source:
 * func (c *Checker) getParameterTypeOfFullSignature(node *ast.Node, parameter *ast.ParameterDeclarationNode) *Type {
 * 	if signature := c.getSignatureOfFullSignatureType(node); signature != nil {
 * 		pos := slices.Index(node.Parameters(), parameter)
 * 		if parameter.AsParameterDeclaration().DotDotDotToken != nil {
 * 			return c.getRestTypeAtPosition(signature, pos, false /*readonly* /)
 * 		} else {
 * 			return c.getTypeAtPosition(signature, pos)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getParameterTypeOfFullSignature(receiver: GoPtr<Checker>, node: GoPtr<Node>, parameter: GoPtr<ParameterDeclarationNode>): GoPtr<Type> {
  const signature = Checker_getSignatureOfFullSignatureType(receiver, node);
  if (signature !== undefined) {
    const pos = slices.Index(Node_Parameters(node), parameter);
    if (AsParameterDeclaration(parameter)!.DotDotDotToken !== undefined) {
      return Checker_getRestTypeAtPosition(receiver, signature, pos, false);
    } else {
      return Checker_getTypeAtPosition(receiver, signature, pos);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getReturnTypeOfFullSignature","kind":"method","status":"implemented","sigHash":"a80fcde458b0e599023d1b95f61fea07f99ce0b933d059caaf4faa2f17a94003","bodyHash":"1f6016a90cb0178256c638d5b47edc567cedefe20022fa3d71e4f7e383e4c705"}
 *
 * Go source:
 * func (c *Checker) getReturnTypeOfFullSignature(node *ast.Node) *Type {
 * 	if signature := c.getSignatureOfFullSignatureType(node); signature != nil {
 * 		return c.getReturnTypeOfSignature(signature)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getReturnTypeOfFullSignature(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const signature = Checker_getSignatureOfFullSignatureType(receiver, node);
  if (signature !== undefined) {
    return Checker_getReturnTypeOfSignature(receiver, signature);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getReturnTypeFromBody","kind":"method","status":"implemented","sigHash":"bdc5379186bfb9cb1e7f5fc54f549e30d73d828d4eb210d522c93fca044bcc91","bodyHash":"de36cc3f993a6d774ef051a34f2a003130c41565fe8c38d3526e958301db44f1"}
 *
 * Go source:
 * func (c *Checker) getReturnTypeFromBody(fn *ast.Node, checkMode CheckMode) *Type {
 * 	body := fn.Body()
 * 	if body == nil {
 * 		return c.errorType
 * 	}
 * 	functionFlags := ast.GetFunctionFlags(fn)
 * 	isAsync := (functionFlags & ast.FunctionFlagsAsync) != 0
 * 	isGenerator := (functionFlags & ast.FunctionFlagsGenerator) != 0
 * 	var returnType *Type
 * 	var yieldType *Type
 * 	var nextType *Type
 * 	var fallbackReturnType *Type = c.voidType
 * 	switch {
 * 	case !ast.IsBlock(body):
 * 		returnType = c.checkExpressionCachedEx(body, checkMode & ^CheckModeSkipGenericFunctions)
 * 		if c.isConstContext(body) {
 * 			returnType = c.getRegularTypeOfLiteralType(returnType)
 * 		}
 * 		if isAsync {
 * 			// From within an async function you can return either a non-promise value or a promise. Any
 * 			// Promise/A+ compatible implementation will always assimilate any foreign promise, so the
 * 			// return type of the body should be unwrapped to its awaited type, which we will wrap in
 * 			// the native Promise<T> type later in this function.
 * 			returnType = c.unwrapAwaitedType(c.checkAwaitedType(returnType, false /*withAlias* /, fn /*errorNode* /, diagnostics.The_return_type_of_an_async_function_must_either_be_a_valid_promise_or_must_not_contain_a_callable_then_member))
 * 		}
 * 	case isGenerator:
 * 		returnTypes, isNeverReturning := c.checkAndAggregateReturnExpressionTypes(fn, checkMode)
 * 		if isNeverReturning {
 * 			fallbackReturnType = c.neverType
 * 		} else if len(returnTypes) != 0 {
 * 			returnType = c.getUnionTypeEx(returnTypes, UnionReductionSubtype, nil, nil)
 * 		}
 * 		yieldTypes, nextTypes := c.checkAndAggregateYieldOperandTypes(fn, checkMode)
 * 		if len(yieldTypes) != 0 {
 * 			yieldType = c.getUnionTypeEx(yieldTypes, UnionReductionSubtype, nil, nil)
 * 		}
 * 		if len(nextTypes) != 0 {
 * 			nextType = c.getIntersectionType(nextTypes)
 * 		}
 * 	default:
 * 		types, isNeverReturning := c.checkAndAggregateReturnExpressionTypes(fn, checkMode)
 * 		if isNeverReturning {
 * 			// For an async function, the return type will not be never, but rather a Promise for never.
 * 			if functionFlags&ast.FunctionFlagsAsync != 0 {
 * 				return c.createPromiseReturnType(fn, c.neverType)
 * 			}
 * 			// Normal function
 * 			return c.neverType
 * 		}
 * 		if len(types) == 0 {
 * 			// For an async function, the return type will not be void/undefined, but rather a Promise for void/undefined.
 * 			contextualReturnType := c.getContextualReturnType(fn, ContextFlagsNone)
 * 			var returnType *Type
 * 			if contextualReturnType != nil && someType(core.OrElse(c.unwrapReturnType(contextualReturnType, functionFlags), c.voidType), func(t *Type) bool { return t.flags&TypeFlagsUndefined != 0 }) {
 * 				returnType = c.undefinedType
 * 			} else {
 * 				returnType = c.voidType
 * 			}
 * 			if functionFlags&ast.FunctionFlagsAsync != 0 {
 * 				return c.createPromiseReturnType(fn, returnType)
 * 			}
 * 			// Normal function
 * 			return returnType
 * 		}
 * 		// Return a union of the return expression types.
 * 		returnType = c.getUnionTypeEx(types, UnionReductionSubtype, nil, nil)
 * 	}
 * 	if returnType != nil || yieldType != nil || nextType != nil {
 * 		if yieldType != nil {
 * 			c.reportErrorsFromWidening(fn, yieldType, WideningKindGeneratorYield)
 * 		}
 * 		if returnType != nil {
 * 			c.reportErrorsFromWidening(fn, returnType, WideningKindFunctionReturn)
 * 		}
 * 		if nextType != nil {
 * 			c.reportErrorsFromWidening(fn, nextType, WideningKindGeneratorNext)
 * 		}
 * 		if returnType != nil && isUnitType(returnType) || yieldType != nil && isUnitType(yieldType) || nextType != nil && isUnitType(nextType) {
 * 			contextualSignature := c.getContextualSignatureForFunctionLikeDeclaration(fn)
 * 			var contextualType *Type
 * 			switch {
 * 			case contextualSignature == nil:
 * 				// No contextual type
 * 			case contextualSignature == c.getSignatureFromDeclaration(fn):
 * 				if !isGenerator {
 * 					contextualType = returnType
 * 				}
 * 			default:
 * 				contextualType = c.instantiateContextualType(c.getReturnTypeOfSignature(contextualSignature), fn, ContextFlagsNone)
 * 			}
 * 			if isGenerator {
 * 				yieldType = c.getWidenedLiteralLikeTypeForContextualIterationTypeIfNeeded(yieldType, contextualType, IterationTypeKindYield, isAsync)
 * 				returnType = c.getWidenedLiteralLikeTypeForContextualIterationTypeIfNeeded(returnType, contextualType, IterationTypeKindReturn, isAsync)
 * 				nextType = c.getWidenedLiteralLikeTypeForContextualIterationTypeIfNeeded(nextType, contextualType, IterationTypeKindNext, isAsync)
 * 			} else {
 * 				returnType = c.getWidenedLiteralLikeTypeForContextualReturnTypeIfNeeded(returnType, contextualType, isAsync)
 * 			}
 * 		}
 * 		if yieldType != nil {
 * 			yieldType = c.getWidenedType(yieldType)
 * 		}
 * 		if returnType != nil {
 * 			returnType = c.getWidenedType(returnType)
 * 		}
 * 		if nextType != nil {
 * 			nextType = c.getWidenedType(nextType)
 * 		}
 * 	}
 * 	if returnType == nil {
 * 		returnType = fallbackReturnType
 * 	}
 * 	if isGenerator {
 * 		if yieldType == nil {
 * 			yieldType = c.neverType
 * 		}
 * 		if nextType == nil {
 * 			nextType = c.getContextualIterationType(IterationTypeKindNext, fn)
 * 			if nextType == nil {
 * 				nextType = c.unknownType
 * 			}
 * 		}
 * 		return c.createGeneratorType(yieldType, returnType, nextType, isAsync)
 * 	}
 * 	// From within an async function you can return either a non-promise value or a promise. Any
 * 	// Promise/A+ compatible implementation will always assimilate any foreign promise, so the
 * 	// return type of the body is awaited type of the body, wrapped in a native Promise<T> type.
 * 	if isAsync {
 * 		return c.createPromiseType(returnType)
 * 	}
 * 	return returnType
 * }
 */
export function Checker_getReturnTypeFromBody(receiver: GoPtr<Checker>, fn: GoPtr<Node>, checkMode: CheckMode): GoPtr<Type> {
  const body = Node_Body(fn);
  if (body === undefined) {
    return receiver!.errorType;
  }
  const functionFlags = GetFunctionFlags(fn);
  const isAsync = (functionFlags & FunctionFlagsAsync) !== 0;
  const isGenerator = (functionFlags & FunctionFlagsGenerator) !== 0;
  let returnType: GoPtr<Type>;
  let yieldType: GoPtr<Type>;
  let nextType: GoPtr<Type>;
  let fallbackReturnType: GoPtr<Type> = receiver!.voidType;
  if (!IsBlock(body)) {
    returnType = Checker_checkExpressionCachedEx(receiver, body, (checkMode & ~CheckModeSkipGenericFunctions) as CheckMode);
    if (Checker_isConstContext(receiver, body)) {
      returnType = Checker_getRegularTypeOfLiteralType(receiver, returnType);
    }
    if (isAsync) {
      returnType = Checker_unwrapAwaitedType(receiver, Checker_checkAwaitedType(receiver, returnType, false, fn, The_return_type_of_an_async_function_must_either_be_a_valid_promise_or_must_not_contain_a_callable_then_member));
    }
  } else if (isGenerator) {
    const [returnTypes, isNeverReturning] = Checker_checkAndAggregateReturnExpressionTypes(receiver, fn, checkMode);
    if (isNeverReturning) {
      fallbackReturnType = receiver!.neverType;
    } else if ((returnTypes ?? []).length !== 0) {
      returnType = Checker_getUnionTypeEx(receiver, returnTypes, UnionReductionSubtype, undefined, undefined);
    }
    const [yieldTypes, nextTypes] = Checker_checkAndAggregateYieldOperandTypes(receiver, fn, checkMode);
    if (yieldTypes.length !== 0) {
      yieldType = Checker_getUnionTypeEx(receiver, yieldTypes, UnionReductionSubtype, undefined, undefined);
    }
    if (nextTypes.length !== 0) {
      nextType = Checker_getIntersectionType(receiver, nextTypes);
    }
  } else {
    const [types, isNeverReturning] = Checker_checkAndAggregateReturnExpressionTypes(receiver, fn, checkMode);
    if (isNeverReturning) {
      if ((functionFlags & FunctionFlagsAsync) !== 0) {
        return Checker_createPromiseReturnType(receiver, fn, receiver!.neverType);
      }
      return receiver!.neverType;
    }
    if ((types ?? []).length === 0) {
      const contextualReturnType = Checker_getContextualReturnType(receiver, fn, ContextFlagsNone);
      const emptyReturnType = contextualReturnType !== undefined &&
        someType(core.OrElse(Checker_unwrapReturnType(receiver, contextualReturnType, functionFlags), receiver!.voidType), (t: GoPtr<Type>): bool => (t!.flags & TypeFlagsUndefined) !== 0)
        ? receiver!.undefinedType
        : receiver!.voidType;
      if ((functionFlags & FunctionFlagsAsync) !== 0) {
        return Checker_createPromiseReturnType(receiver, fn, emptyReturnType);
      }
      return emptyReturnType;
    }
    returnType = Checker_getUnionTypeEx(receiver, types, UnionReductionSubtype, undefined, undefined);
  }
  if (returnType !== undefined || yieldType !== undefined || nextType !== undefined) {
    if (yieldType !== undefined) {
      Checker_reportErrorsFromWidening(receiver, fn, yieldType, WideningKindGeneratorYield);
    }
    if (returnType !== undefined) {
      Checker_reportErrorsFromWidening(receiver, fn, returnType, WideningKindFunctionReturn);
    }
    if (nextType !== undefined) {
      Checker_reportErrorsFromWidening(receiver, fn, nextType, WideningKindGeneratorNext);
    }
    if ((returnType !== undefined && isUnitType(returnType)) || (yieldType !== undefined && isUnitType(yieldType)) || (nextType !== undefined && isUnitType(nextType))) {
      const contextualSignature = Checker_getContextualSignatureForFunctionLikeDeclaration(receiver, fn);
      let contextualType: GoPtr<Type>;
      if (contextualSignature === undefined) {
        // No contextual type
      } else if (contextualSignature === Checker_getSignatureFromDeclaration(receiver, fn)) {
        if (!isGenerator) {
          contextualType = returnType;
        }
      } else {
        contextualType = Checker_instantiateContextualType(receiver, Checker_getReturnTypeOfSignature(receiver, contextualSignature), fn, ContextFlagsNone);
      }
      if (isGenerator) {
        yieldType = Checker_getWidenedLiteralLikeTypeForContextualIterationTypeIfNeeded(receiver, yieldType, contextualType, IterationTypeKindYield, isAsync);
        returnType = Checker_getWidenedLiteralLikeTypeForContextualIterationTypeIfNeeded(receiver, returnType, contextualType, IterationTypeKindReturn, isAsync);
        nextType = Checker_getWidenedLiteralLikeTypeForContextualIterationTypeIfNeeded(receiver, nextType, contextualType, IterationTypeKindNext, isAsync);
      } else {
        returnType = Checker_getWidenedLiteralLikeTypeForContextualReturnTypeIfNeeded(receiver, returnType, contextualType, isAsync);
      }
    }
    if (yieldType !== undefined) {
      yieldType = Checker_getWidenedType(receiver, yieldType);
    }
    if (returnType !== undefined) {
      returnType = Checker_getWidenedType(receiver, returnType);
    }
    if (nextType !== undefined) {
      nextType = Checker_getWidenedType(receiver, nextType);
    }
  }
  if (returnType === undefined) {
    returnType = fallbackReturnType;
  }
  if (isGenerator) {
    if (yieldType === undefined) {
      yieldType = receiver!.neverType;
    }
    if (nextType === undefined) {
      nextType = Checker_getContextualIterationType(receiver, IterationTypeKindNext, fn);
      if (nextType === undefined) {
        nextType = receiver!.unknownType;
      }
    }
    return Checker_createGeneratorType(receiver, yieldType, returnType, nextType, isAsync);
  }
  if (isAsync) {
    return Checker_createPromiseType(receiver, returnType);
  }
  return returnType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createPromiseReturnType","kind":"method","status":"implemented","sigHash":"d9c4e358d60ad12b99bf0796a913da290700cf496486bde867e8ec3fb993dd7e","bodyHash":"add26851ed37d606763ae3c1a2d8871b0b758f8bafeeca16b5e6860f4af15ddf"}
 *
 * Go source:
 * func (c *Checker) createPromiseReturnType(fn *ast.Node, promisedType *Type) *Type {
 * 	promiseType := c.createPromiseType(promisedType)
 * 	if promiseType == c.unknownType {
 * 		c.error(fn, core.IfElse(ast.IsImportCall(fn),
 * 			diagnostics.A_dynamic_import_call_returns_a_Promise_Make_sure_you_have_a_declaration_for_Promise_or_include_ES2015_in_your_lib_option,
 * 			diagnostics.An_async_function_or_method_must_return_a_Promise_Make_sure_you_have_a_declaration_for_Promise_or_include_ES2015_in_your_lib_option))
 * 		return c.errorType
 * 	}
 * 	if c.getGlobalPromiseConstructorSymbol() == nil {
 * 		c.error(fn, core.IfElse(ast.IsImportCall(fn),
 * 			diagnostics.A_dynamic_import_call_in_ES5_requires_the_Promise_constructor_Make_sure_you_have_a_declaration_for_the_Promise_constructor_or_include_ES2015_in_your_lib_option,
 * 			diagnostics.An_async_function_or_method_in_ES5_requires_the_Promise_constructor_Make_sure_you_have_a_declaration_for_the_Promise_constructor_or_include_ES2015_in_your_lib_option))
 * 	}
 * 	return promiseType
 * }
 */
export function Checker_createPromiseReturnType(receiver: GoPtr<Checker>, fn: GoPtr<Node>, promisedType: GoPtr<Type>): GoPtr<Type> {
  const promiseType = Checker_createPromiseType(receiver, promisedType);
  if (promiseType === receiver!.unknownType) {
    Checker_error(
      receiver,
      fn,
      core.IfElse(
        IsImportCall(fn),
        A_dynamic_import_call_returns_a_Promise_Make_sure_you_have_a_declaration_for_Promise_or_include_ES2015_in_your_lib_option,
        An_async_function_or_method_must_return_a_Promise_Make_sure_you_have_a_declaration_for_Promise_or_include_ES2015_in_your_lib_option,
      ),
    );
    return receiver!.errorType;
  }
  if (receiver!.getGlobalPromiseConstructorSymbol() === undefined) {
    Checker_error(
      receiver,
      fn,
      core.IfElse(
        IsImportCall(fn),
        A_dynamic_import_call_in_ES5_requires_the_Promise_constructor_Make_sure_you_have_a_declaration_for_the_Promise_constructor_or_include_ES2015_in_your_lib_option,
        An_async_function_or_method_in_ES5_requires_the_Promise_constructor_Make_sure_you_have_a_declaration_for_the_Promise_constructor_or_include_ES2015_in_your_lib_option,
      ),
    );
  }
  return promiseType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.unwrapReturnType","kind":"method","status":"implemented","sigHash":"142fb709106bce6407d505d865fa5a7f03446a49dddc24ccd456d60ed1afd4a5","bodyHash":"0e356439fc73be58c28c1ef2e87585f2ef840ffa8c4762b020ea088c9cd9fb3b"}
 *
 * Go source:
 * func (c *Checker) unwrapReturnType(returnType *Type, functionFlags ast.FunctionFlags) *Type {
 * 	isGenerator := functionFlags&ast.FunctionFlagsGenerator != 0
 * 	isAsync := functionFlags&ast.FunctionFlagsAsync != 0
 * 	if isGenerator {
 * 		returnIterationType := c.getIterationTypeOfGeneratorFunctionReturnType(IterationTypeKindReturn, returnType, isAsync)
 * 		if returnIterationType == nil {
 * 			return c.errorType
 * 		}
 * 		if isAsync {
 * 			return c.getAwaitedTypeNoAlias(c.unwrapAwaitedType(returnIterationType))
 * 		}
 * 		return returnIterationType
 * 	}
 * 	if isAsync {
 * 		return core.OrElse(c.getAwaitedTypeNoAlias(returnType), c.errorType)
 * 	}
 * 	return returnType
 * }
 */
export function Checker_unwrapReturnType(receiver: GoPtr<Checker>, returnType: GoPtr<Type>, functionFlags: FunctionFlags): GoPtr<Type> {
  const isGenerator = (functionFlags & FunctionFlagsGenerator) !== 0;
  const isAsync = (functionFlags & FunctionFlagsAsync) !== 0;
  if (isGenerator) {
    const returnIterationType = Checker_getIterationTypeOfGeneratorFunctionReturnType(receiver, IterationTypeKindReturn, returnType, isAsync);
    if (returnIterationType === undefined) {
      return receiver!.errorType;
    }
    if (isAsync) {
      return Checker_getAwaitedTypeNoAlias(receiver, Checker_unwrapAwaitedType(receiver, returnIterationType));
    }
    return returnIterationType;
  }
  if (isAsync) {
    return core.OrElse(Checker_getAwaitedTypeNoAlias(receiver, returnType), receiver!.errorType);
  }
  return returnType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getWidenedLiteralLikeTypeForContextualReturnTypeIfNeeded","kind":"method","status":"implemented","sigHash":"fc31453aa19698365bd4fa3dcf5dd7ffe74288c9137660378eb70bbc1700bb42","bodyHash":"68f3a9429bcbff940d7361f4942777b32742f4f2c5518be532be41722faa94fd"}
 *
 * Go source:
 * func (c *Checker) getWidenedLiteralLikeTypeForContextualReturnTypeIfNeeded(t *Type, contextualSignatureReturnType *Type, isAsync bool) *Type {
 * 	if t != nil && isUnitType(t) {
 * 		var contextualType *Type
 * 		switch {
 * 		case contextualSignatureReturnType == nil:
 * 			// No contextual type
 * 		case isAsync:
 * 			contextualType = c.GetPromisedTypeOfPromise(contextualSignatureReturnType)
 * 		default:
 * 			contextualType = contextualSignatureReturnType
 * 		}
 * 		t = c.getWidenedLiteralLikeTypeForContextualType(t, contextualType)
 * 	}
 * 	return t
 * }
 */
export function Checker_getWidenedLiteralLikeTypeForContextualReturnTypeIfNeeded(receiver: GoPtr<Checker>, t: GoPtr<Type>, contextualSignatureReturnType: GoPtr<Type>, isAsync: bool): GoPtr<Type> {
  if (t !== undefined && isUnitType(t)) {
    let contextualType: GoPtr<Type> = undefined;
    if (contextualSignatureReturnType === undefined) {
      // No contextual type
    } else if (isAsync) {
      contextualType = Checker_GetPromisedTypeOfPromise(receiver, contextualSignatureReturnType);
    } else {
      contextualType = contextualSignatureReturnType;
    }
    return Checker_getWidenedLiteralLikeTypeForContextualType(receiver, t, contextualType);
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkIfExpressionRefinesAnyParameter","kind":"method","status":"implemented","sigHash":"612a6ab061e2c25ed4112030f6e2fa7041e8db2ddfbaa1d76c12359f7f21602d","bodyHash":"e8d50d503c656b69e7ab9fe28d99e69d4e8a07d8df2d3bede3ffff098ec56ec5"}
 *
 * Go source:
 * func (c *Checker) checkIfExpressionRefinesAnyParameter(fn *ast.Node, expr *ast.Node) *TypePredicate {
 * 	expr = ast.SkipParentheses(expr)
 * 	returnType := c.checkExpressionCached(expr)
 * 	if returnType.flags&TypeFlagsBoolean == 0 {
 * 		return nil
 * 	}
 * 	for i, param := range fn.Parameters() {
 * 		initType := c.getTypeOfSymbol(param.Symbol())
 * 		if initType == nil || initType.flags&TypeFlagsBoolean != 0 || !ast.IsIdentifier(param.Name()) || c.isSymbolAssigned(param.Symbol()) || isRestParameter(param) {
 * 			// Refining "x: boolean" to "x is true" or "x is false" isn't useful.
 * 			continue
 * 		}
 * 		trueType := c.checkIfExpressionRefinesParameter(fn, expr, param, initType)
 * 		if trueType != nil {
 * 			return c.newTypePredicate(TypePredicateKindIdentifier, param.Name().Text(), int32(i), trueType)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_checkIfExpressionRefinesAnyParameter(receiver: GoPtr<Checker>, fn: GoPtr<Node>, expr: GoPtr<Node>): GoPtr<TypePredicate> {
  expr = SkipParentheses(expr);
  const returnType = Checker_checkExpressionCached(receiver, expr);
  if ((returnType!.flags & TypeFlagsBoolean) === 0) {
    return undefined;
  }
  const parameters = Node_Parameters(fn);
  for (let i = 0; i < parameters.length; i++) {
    const param = parameters[i];
    const initType = Checker_getTypeOfSymbol(receiver, Node_Symbol(param));
    if (initType === undefined || (initType!.flags & TypeFlagsBoolean) !== 0 || !IsIdentifier(Node_Name(param)) || Checker_isSymbolAssigned(receiver, Node_Symbol(param)) || isRestParameter(param)) {
      continue;
    }
    const trueType = Checker_checkIfExpressionRefinesParameter(receiver, fn, expr, param, initType);
    if (trueType !== undefined) {
      return Checker_newTypePredicate(receiver, TypePredicateKindIdentifier, Node_Text(Node_Name(param)), i, trueType);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkIfExpressionRefinesParameter","kind":"method","status":"implemented","sigHash":"71e2338fab62cfacd2df5e5fd6cd45f1c5026e998ac8e92a741afbe8575e6f4f","bodyHash":"700e22ba94e1d56cda524d163f3be3011f0269b1795543554940e78516b4a5f9"}
 *
 * Go source:
 * func (c *Checker) checkIfExpressionRefinesParameter(fn *ast.Node, expr *ast.Node, param *ast.Node, initType *Type) *Type {
 * 	antecedent := getFlowNodeOfNode(expr)
 * 	if antecedent == nil && ast.IsReturnStatement(expr.Parent) {
 * 		antecedent = getFlowNodeOfNode(expr.Parent)
 * 	}
 * 	if antecedent == nil {
 * 		antecedent = &ast.FlowNode{Flags: ast.FlowFlagsStart}
 * 	}
 * 	trueCondition := &ast.FlowNode{Flags: ast.FlowFlagsTrueCondition, Node: expr, Antecedent: antecedent}
 * 	trueType := c.getFlowTypeOfReferenceEx(param.Name(), initType, initType, fn, trueCondition)
 * 	if trueType == initType {
 * 		return nil
 * 	}
 * 	// "x is T" means that x is T if and only if it returns true. If it returns false then x is not T.
 * 	// This means that if the function is called with an argument of type trueType, there can't be anything left in the `else` branch. It must reduce to `never`.
 * 	falseCondition := &ast.FlowNode{Flags: ast.FlowFlagsFalseCondition, Node: expr, Antecedent: antecedent}
 * 	falseSubtype := c.getReducedType(c.getFlowTypeOfReferenceEx(param.Name(), initType, trueType, fn, falseCondition))
 * 	if falseSubtype.flags&TypeFlagsNever != 0 {
 * 		return trueType
 * 	}
 * 	return nil
 * }
 */
export function Checker_checkIfExpressionRefinesParameter(receiver: GoPtr<Checker>, fn: GoPtr<Node>, expr: GoPtr<Node>, param: GoPtr<Node>, initType: GoPtr<Type>): GoPtr<Type> {
  let antecedent = getFlowNodeOfNode(expr);
  if (antecedent === undefined && IsReturnStatement(expr!.Parent)) {
    antecedent = getFlowNodeOfNode(expr!.Parent);
  }
  if (antecedent === undefined) {
    antecedent = { Flags: FlowFlagsStart, Node: undefined, Antecedent: undefined, Antecedents: undefined } as FlowNode;
  }
  const trueCondition = { Flags: FlowFlagsTrueCondition, Node: expr, Antecedent: antecedent, Antecedents: undefined } as FlowNode;
  const trueType = Checker_getFlowTypeOfReferenceEx(receiver, Node_Name(param), initType, initType, fn, trueCondition);
  if (trueType === initType) {
    return undefined;
  }
  const falseCondition = { Flags: FlowFlagsFalseCondition, Node: expr, Antecedent: antecedent, Antecedents: undefined } as FlowNode;
  const falseSubtype = Checker_getReducedType(receiver, Checker_getFlowTypeOfReferenceEx(receiver, Node_Name(param), initType, trueType, fn, falseCondition));
  if ((falseSubtype!.flags & TypeFlagsNever) !== 0) {
    return trueType;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.instantiateSignature","kind":"method","status":"implemented","sigHash":"0c24cd9a94d314d24b9cc23b3940ed992476091121651a25805df250df5108bc","bodyHash":"fe75c9db97e2c23581d8c9f23b5034e1e471be291aaaf2339a39c204081f17f3"}
 *
 * Go source:
 * func (c *Checker) instantiateSignature(sig *Signature, m *TypeMapper) *Signature {
 * 	return c.instantiateSignatureEx(sig, m, m == c.permissiveMapper /*eraseTypeParameters* /)
 * }
 */
export function Checker_instantiateSignature(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, m: GoPtr<TypeMapper>): GoPtr<Signature> {
  return Checker_instantiateSignatureEx(receiver, sig, m, m === receiver!.permissiveMapper);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.instantiateSignatureEx","kind":"method","status":"implemented","sigHash":"e80862e53012f4cee5dd56ba1e2fc5f06c3144351fab423715142fe48ce5470c","bodyHash":"3d5e7825ffb4b7fabec26cf378a70c0568856ed9647608841e1f7d6a7dbc65bc"}
 *
 * Go source:
 * func (c *Checker) instantiateSignatureEx(sig *Signature, m *TypeMapper, eraseTypeParameters bool) *Signature {
 * 	var freshTypeParameters []*Type
 * 	if len(sig.typeParameters) != 0 && !eraseTypeParameters {
 * 		// First create a fresh set of type parameters, then include a mapping from the old to the
 * 		// new type parameters in the mapper function. Finally store this mapper in the new type
 * 		// parameters such that we can use it when instantiating constraints.
 * 		freshTypeParameters = core.Map(sig.typeParameters, c.cloneTypeParameter)
 * 		m = c.combineTypeMappers(newTypeMapper(sig.typeParameters, freshTypeParameters), m)
 * 		for _, tp := range freshTypeParameters {
 * 			tp.AsTypeParameter().mapper = m
 * 		}
 * 	}
 * 	// Don't compute resolvedReturnType and resolvedTypePredicate now,
 * 	// because using `mapper` now could trigger inferences to become fixed. (See `createInferenceContext`.)
 * 	// See GH#17600.
 * 	result := c.newSignature(sig.flags&SignatureFlagsPropagatingFlags, sig.declaration, freshTypeParameters,
 * 		c.instantiateSymbol(sig.thisParameter, m), c.instantiateSymbols(sig.parameters, m),
 * 		nil /*resolvedReturnType* /, nil /*resolvedTypePredicate* /, int(sig.minArgumentCount))
 * 	result.target = sig
 * 	result.mapper = m
 * 	return result
 * }
 */
export function Checker_instantiateSignatureEx(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, m: GoPtr<TypeMapper>, eraseTypeParameters: bool): GoPtr<Signature> {
  let freshTypeParameters: GoSlice<GoPtr<Type>> = [];
  if (sig!.typeParameters.length !== 0 && !eraseTypeParameters) {
    freshTypeParameters = core.Map(sig!.typeParameters, (tp: GoPtr<Type>) => Checker_cloneTypeParameter(receiver, tp));
    m = Checker_combineTypeMappers(receiver, newTypeMapper(sig!.typeParameters, freshTypeParameters), m);
    for (const typeParameter of freshTypeParameters) {
      Type_AsTypeParameter(typeParameter)!.mapper = m;
    }
  }
  const result = Checker_newSignature(receiver, (sig!.flags & SignatureFlagsPropagatingFlags) as SignatureFlags, sig!.declaration, freshTypeParameters, Checker_instantiateSymbol(receiver, sig!.thisParameter, m), Checker_instantiateSymbols(receiver, sig!.parameters, m), undefined, undefined, sig!.minArgumentCount);
  result!.target = sig;
  result!.mapper = m;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDefaultConstructSignatures","kind":"method","status":"implemented","sigHash":"cc919b19751b29ec5b20ad9cf22bd40304a02ebc1680bfddbe916b7ad2c3f650","bodyHash":"10d97ce77b97834398232d4a20c56d8e0c9c61a75763b555c21911c15ccc4ca5"}
 *
 * Go source:
 * func (c *Checker) getDefaultConstructSignatures(classType *Type) []*Signature {
 * 	baseConstructorType := c.getBaseConstructorTypeOfClass(classType)
 * 	baseSignatures := c.getSignaturesOfType(baseConstructorType, SignatureKindConstruct)
 * 	declaration := ast.GetClassLikeDeclarationOfSymbol(classType.symbol)
 * 	isAbstract := declaration != nil && ast.HasSyntacticModifier(declaration, ast.ModifierFlagsAbstract)
 * 	if len(baseSignatures) == 0 {
 * 		flags := core.IfElse(isAbstract, SignatureFlagsConstruct|SignatureFlagsAbstract, SignatureFlagsConstruct)
 * 		return []*Signature{c.newSignature(flags, nil, classType.AsInterfaceType().LocalTypeParameters(), nil, nil, classType, nil, 0)}
 * 	}
 * 	baseTypeNode := getBaseTypeNodeOfClass(classType)
 * 	isJavaScript := declaration != nil && ast.IsInJSFile(declaration)
 * 	typeArguments := c.getTypeArgumentsFromNode(baseTypeNode)
 * 	typeArgCount := len(typeArguments)
 * 	var result []*Signature
 * 	for _, baseSig := range baseSignatures {
 * 		minTypeArgumentCount := c.getMinTypeArgumentCount(baseSig.typeParameters)
 * 		typeParamCount := len(baseSig.typeParameters)
 * 		if isJavaScript || typeArgCount >= minTypeArgumentCount && typeArgCount <= typeParamCount {
 * 			var sig *Signature
 * 			if typeParamCount != 0 {
 * 				sig = c.createSignatureInstantiation(baseSig, c.fillMissingTypeArguments(typeArguments, baseSig.typeParameters, minTypeArgumentCount, isJavaScript))
 * 			} else {
 * 				sig = c.cloneSignature(baseSig)
 * 			}
 * 			sig.typeParameters = classType.AsInterfaceType().LocalTypeParameters()
 * 			sig.resolvedReturnType = classType
 * 			if isAbstract {
 * 				sig.flags |= SignatureFlagsAbstract
 * 			} else {
 * 				sig.flags &^= SignatureFlagsAbstract
 * 			}
 * 			result = append(result, sig)
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Checker_getDefaultConstructSignatures(receiver: GoPtr<Checker>, classType: GoPtr<Type>): GoSlice<GoPtr<Signature>> {
  const baseConstructorType = Checker_getBaseConstructorTypeOfClass(receiver, classType);
  const baseSignatures = Checker_getSignaturesOfType(receiver, baseConstructorType, SignatureKindConstruct);
  const declaration = GetClassLikeDeclarationOfSymbol(classType!.symbol);
  const isAbstract = declaration !== undefined && HasSyntacticModifier(declaration, ModifierFlagsAbstract);
  if (baseSignatures.length === 0) {
    const flags = core.IfElse(isAbstract, SignatureFlagsConstruct | SignatureFlagsAbstract, SignatureFlagsConstruct);
    return [Checker_newSignature(receiver, flags as SignatureFlags, undefined, InterfaceType_LocalTypeParameters(Type_AsInterfaceType(classType)), undefined, [], classType, undefined, 0)];
  }
  const baseTypeNode = getBaseTypeNodeOfClass(classType);
  const isJavaScript = declaration !== undefined && IsInJSFile(declaration);
  const typeArguments = Checker_getTypeArgumentsFromNode(receiver, baseTypeNode);
  const typeArgCount = typeArguments.length;
  const result: GoSlice<GoPtr<Signature>> = [];
  for (const baseSig of baseSignatures) {
    const minTypeArgumentCount = Checker_getMinTypeArgumentCount(receiver, baseSig!.typeParameters);
    const typeParamCount = baseSig!.typeParameters.length;
    if (isJavaScript || (typeArgCount >= minTypeArgumentCount && typeArgCount <= typeParamCount)) {
      let sig: GoPtr<Signature>;
      if (typeParamCount !== 0) {
        sig = Checker_createSignatureInstantiation(receiver, baseSig, Checker_fillMissingTypeArguments(receiver, typeArguments, baseSig!.typeParameters, minTypeArgumentCount, isJavaScript));
      } else {
        sig = Checker_cloneSignature(receiver, baseSig);
      }
      sig!.typeParameters = InterfaceType_LocalTypeParameters(Type_AsInterfaceType(classType));
      sig!.resolvedReturnType = classType;
      if (isAbstract) {
        sig!.flags = (sig!.flags | SignatureFlagsAbstract) as SignatureFlags;
      } else {
        sig!.flags = (sig!.flags & ~SignatureFlagsAbstract) as SignatureFlags;
      }
      result.push(sig);
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getArrayMemberCallSignatures","kind":"method","status":"implemented","sigHash":"3210399b2151444fc4a8e6c3f84c8a55440010c73bc0d7b1c8663fb21c9baa5a","bodyHash":"6609d58fec43a2cdbdd01d7b3b366c277893a4a98670b94e29de717e9cb24f81"}
 *
 * Go source:
 * func (c *Checker) getArrayMemberCallSignatures(t *Type) []*Signature {
 * 	// Check if union is exclusively instantiations of a member of the global Array or ReadonlyArray type.
 * 	var memberName string
 * 	for i, t := range t.Types() {
 * 		if t.objectFlags&ObjectFlagsInstantiated == 0 || t.symbol == nil || t.symbol.Parent == nil || !c.isArrayOrTupleSymbol(t.symbol.Parent) {
 * 			return nil
 * 		}
 * 		if i == 0 {
 * 			memberName = t.symbol.Name
 * 		} else if memberName != t.symbol.Name {
 * 			return nil
 * 		}
 * 	}
 * 	// Transform the type from `(A[] | B[])["member"]` to `(A | B)[]["member"]` (since we pretend array is covariant anyway).
 * 	arrayArg := c.mapType(t, func(t *Type) *Type {
 * 		return t.Mapper().Map(core.IfElse(c.isReadonlyArraySymbol(t.symbol.Parent), c.globalReadonlyArrayType, c.globalArrayType).AsInterfaceType().TypeParameters()[0])
 * 	})
 * 	arrayType := c.createArrayTypeEx(arrayArg, someType(t, func(t *Type) bool {
 * 		return c.isReadonlyArraySymbol(t.symbol.Parent)
 * 	}))
 * 	return c.getSignaturesOfType(c.getTypeOfPropertyOfType(arrayType, memberName), SignatureKindCall)
 * }
 */
export function Checker_getArrayMemberCallSignatures(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoSlice<GoPtr<Signature>> {
  let memberName = "";
  const types = Type_Types(t);
  for (let i = 0; i < types.length; i++) {
    const type_ = types[i]!;
    if ((type_!.objectFlags & ObjectFlagsInstantiated) === 0 || type_!.symbol === undefined || type_!.symbol!.Parent === undefined || !Checker_isArrayOrTupleSymbol(receiver, type_!.symbol!.Parent)) {
      return undefined as unknown as GoSlice<GoPtr<Signature>>;
    }
    if (i === 0) {
      memberName = type_!.symbol!.Name;
    } else if (memberName !== type_!.symbol!.Name) {
      return undefined as unknown as GoSlice<GoPtr<Signature>>;
    }
  }
  const arrayArg = Checker_mapType(receiver, t, (type_: GoPtr<Type>): GoPtr<Type> => {
    const arrayTarget = Checker_isReadonlyArraySymbol(receiver, type_!.symbol!.Parent) ? receiver!.globalReadonlyArrayType : receiver!.globalArrayType;
    return TypeMapper_Map(Type_Mapper(type_), InterfaceType_TypeParameters(Type_AsInterfaceType(arrayTarget))[0]!);
  });
  const arrayType = Checker_createArrayTypeEx(receiver, arrayArg, someType(t, (type_: GoPtr<Type>): bool => Checker_isReadonlyArraySymbol(receiver, type_!.symbol!.Parent)));
  return Checker_getSignaturesOfType(receiver, Checker_getTypeOfPropertyOfType(receiver, arrayType, memberName), SignatureKindCall);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getUnionSignatures","kind":"method","status":"implemented","sigHash":"535ccb736d68f4f2c7ebea4cbd7b5cd855001679f3c1f2aaa471b5c7bc246ebb","bodyHash":"815961442bc12f5b8f1d1461295a11d7bdd34eca7712ebfc031eb9acf4e8549a"}
 *
 * Go source:
 * func (c *Checker) getUnionSignatures(signatureLists [][]*Signature) []*Signature {
 * 	var result []*Signature
 * 	var indexWithLengthOverOne int
 * 	var countLengthOverOne int
 * 	for i := range signatureLists {
 * 		if len(signatureLists[i]) == 0 {
 * 			return nil
 * 		}
 * 		if len(signatureLists[i]) > 1 {
 * 			indexWithLengthOverOne = i
 * 			countLengthOverOne++
 * 		}
 * 		for _, signature := range signatureLists[i] {
 * 			// Only process signatures with parameter lists that aren't already in the result list
 * 			if result == nil || c.findMatchingSignature(result, signature, false /*partialMatch* /, false /*ignoreThisTypes* /, true /*ignoreReturnTypes* /) == nil {
 * 				unionSignatures := c.findMatchingSignatures(signatureLists, signature, i)
 * 				if unionSignatures != nil {
 * 					s := signature
 * 					// Union the result types when more than one signature matches
 * 					if len(unionSignatures) > 1 {
 * 						thisParameter := signature.thisParameter
 * 						firstThisParameterOfUnionSignatures := core.FirstNonNil(unionSignatures, func(sig *Signature) *ast.Symbol {
 * 							return sig.thisParameter
 * 						})
 * 						if firstThisParameterOfUnionSignatures != nil {
 * 							thisType := c.getIntersectionType(core.MapNonNil(unionSignatures, func(sig *Signature) *Type {
 * 								if sig.thisParameter != nil {
 * 									return c.getTypeOfSymbol(sig.thisParameter)
 * 								}
 * 								return nil
 * 							}))
 * 							thisParameter = c.createSymbolWithType(firstThisParameterOfUnionSignatures, thisType)
 * 						}
 * 						s = c.createUnionSignature(signature, unionSignatures)
 * 						s.thisParameter = thisParameter
 * 					}
 * 					result = append(result, s)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	if len(result) == 0 && countLengthOverOne <= 1 {
 * 		// No sufficiently similar signature existed to subsume all the other signatures in the union - time to see if we can make a single
 * 		// signature that handles all of them. We only do this when there are overloads in only one constituent. (Overloads are conditional in
 * 		// nature and having overloads in multiple constituents would necessitate making a power set of signatures from the type, whose
 * 		// ordering would be non-obvious)
 * 		masterList := signatureLists[indexWithLengthOverOne]
 * 		var results []*Signature = slices.Clone(masterList)
 * 		for _, signatures := range signatureLists {
 * 			if !core.Same(signatures, masterList) {
 * 				signature := signatures[0]
 * 				debug.Assert(signature != nil, "getUnionSignatures bails early on empty signature lists and should not have empty lists on second pass")
 * 				if len(signature.typeParameters) != 0 && core.Some(results, func(s *Signature) bool {
 * 					return len(s.typeParameters) != 0 && !c.compareTypeParametersIdentical(signature.typeParameters, s.typeParameters)
 * 				}) {
 * 					results = nil
 * 				} else {
 * 					results = core.Map(results, func(sig *Signature) *Signature {
 * 						return c.combineUnionOrIntersectionMemberSignatures(sig, signature, true /*isUnion* /)
 * 					})
 * 				}
 * 				if results == nil {
 * 					break
 * 				}
 * 			}
 * 		}
 * 		result = results
 * 	}
 * 	return result
 * }
 */
export function Checker_getUnionSignatures(receiver: GoPtr<Checker>, signatureLists: GoSlice<GoSlice<GoPtr<Signature>>>): GoSlice<GoPtr<Signature>> {
  let result: GoSlice<GoPtr<Signature>> = [];
  let indexWithLengthOverOne = 0 as int;
  let countLengthOverOne = 0 as int;
  for (let i = 0; i < signatureLists.length; i++) {
    if (signatureLists[i]!.length === 0) {
      return [];
    }
    if (signatureLists[i]!.length > 1) {
      indexWithLengthOverOne = i as int;
      countLengthOverOne++;
    }
    for (const signature of signatureLists[i]!) {
      // Only process signatures with parameter lists that aren't already in the result list
      if (result.length === 0 || Checker_findMatchingSignature(receiver, result, signature, false, false, true) === undefined) {
        const unionSignatures = Checker_findMatchingSignatures(receiver, signatureLists, signature, i as int);
        if (unionSignatures !== undefined && unionSignatures.length !== 0) {
          let s = signature;
          // Union the result types when more than one signature matches
          if (unionSignatures.length > 1) {
            let thisParameter = signature!.thisParameter;
            const firstThisParameterOfUnionSignatures = core.FirstNonNil(unionSignatures, (sig: GoPtr<Signature>): GoPtr<Symbol> => {
              return sig!.thisParameter;
            });
            if (firstThisParameterOfUnionSignatures !== undefined) {
              const thisType = Checker_getIntersectionType(receiver, core.MapNonNil(unionSignatures, (sig: GoPtr<Signature>): GoPtr<Type> => {
                if (sig!.thisParameter !== undefined) {
                  return Checker_getTypeOfSymbol(receiver, sig!.thisParameter);
                }
                return undefined;
              }));
              thisParameter = Checker_createSymbolWithType(receiver, firstThisParameterOfUnionSignatures, thisType);
            }
            s = Checker_createUnionSignature(receiver, signature, unionSignatures);
            s!.thisParameter = thisParameter;
          }
          result = [...result, s];
        }
      }
    }
  }
  if (result.length === 0 && countLengthOverOne <= 1) {
    // No sufficiently similar signature existed to subsume all the other signatures in the union - time to see if we can make a single
    // signature that handles all of them. We only do this when there are overloads in only one constituent. (Overloads are conditional in
    // nature and having overloads in multiple constituents would necessitate making a power set of signatures from the type, whose
    // ordering would be non-obvious)
    const masterList = signatureLists[indexWithLengthOverOne]!;
    let results: GoSlice<GoPtr<Signature>> = slices.Clone(masterList) ?? [];
    for (const signatures of signatureLists) {
      if (!core.Same(signatures, masterList)) {
        const signature = signatures[0];
        if (signature === undefined) {
          throw new globalThis.Error("getUnionSignatures bails early on empty signature lists and should not have empty lists on second pass");
        }
        if (signature.typeParameters.length !== 0 && core.Some(results, (s: GoPtr<Signature>): bool => {
          return s!.typeParameters.length !== 0 && !Checker_compareTypeParametersIdentical(receiver, signature.typeParameters, s!.typeParameters);
        })) {
          results = [];
        } else {
          results = core.Map(results, (sig: GoPtr<Signature>): GoPtr<Signature> => {
            return Checker_combineUnionOrIntersectionMemberSignatures(receiver, sig, signature, true);
          });
        }
        if (results.length === 0) {
          break;
        }
      }
    }
    result = results;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.combineUnionOrIntersectionMemberSignatures","kind":"method","status":"implemented","sigHash":"de6844df9e05862ba295f4daad8ed1b0eb336022be9ab5bb7860082383845b40","bodyHash":"f341a53a87982800d5d9e49f7fe044e7cf59e34b5d77bac7f88f717cbbc3f3cb"}
 *
 * Go source:
 * func (c *Checker) combineUnionOrIntersectionMemberSignatures(left *Signature, right *Signature, isUnion bool) *Signature {
 * 	typeParams := left.typeParameters
 * 	if len(typeParams) == 0 {
 * 		typeParams = right.typeParameters
 * 	}
 * 	var paramMapper *TypeMapper
 * 	if len(left.typeParameters) != 0 && len(right.typeParameters) != 0 {
 * 		// We just use the type parameter defaults from the first signature
 * 		paramMapper = newTypeMapper(right.typeParameters, left.typeParameters)
 * 	}
 * 	flags := (left.flags | right.flags) & (SignatureFlagsPropagatingFlags & ^SignatureFlagsHasRestParameter)
 * 	declaration := left.declaration
 * 	params := c.combineUnionOrIntersectionParameters(left, right, paramMapper, isUnion)
 * 	lastParam := core.LastOrNil(params)
 * 	if lastParam != nil && lastParam.CheckFlags&ast.CheckFlagsRestParameter != 0 {
 * 		flags |= SignatureFlagsHasRestParameter
 * 	}
 * 	thisParam := c.combineUnionOrIntersectionThisParam(left.thisParameter, right.thisParameter, paramMapper, isUnion)
 * 	minArgCount := int(max(left.minArgumentCount, right.minArgumentCount))
 * 	result := c.newSignature(flags, declaration, typeParams, thisParam, params, nil, nil, minArgCount)
 * 	var leftSignatures []*Signature
 * 	if left.composite != nil && left.composite.isUnion {
 * 		leftSignatures = left.composite.signatures
 * 	} else {
 * 		leftSignatures = []*Signature{left}
 * 	}
 * 	result.composite = &CompositeSignature{isUnion: isUnion, signatures: append(leftSignatures, right)}
 * 	if paramMapper != nil {
 * 		if left.composite != nil && left.composite.isUnion == isUnion && left.mapper != nil {
 * 			result.mapper = c.combineTypeMappers(left.mapper, paramMapper)
 * 		} else {
 * 			result.mapper = paramMapper
 * 		}
 * 	} else if left.composite != nil && left.composite.isUnion == isUnion {
 * 		result.mapper = left.mapper
 * 	}
 * 	return result
 * }
 */
export function Checker_combineUnionOrIntersectionMemberSignatures(receiver: GoPtr<Checker>, left: GoPtr<Signature>, right: GoPtr<Signature>, isUnion: bool): GoPtr<Signature> {
  let typeParams = left!.typeParameters;
  if (typeParams.length === 0) {
    typeParams = right!.typeParameters;
  }
  let paramMapper: GoPtr<TypeMapper>;
  if (left!.typeParameters.length !== 0 && right!.typeParameters.length !== 0) {
    // We just use the type parameter defaults from the first signature
    paramMapper = newTypeMapper(right!.typeParameters, left!.typeParameters);
  }
  let flags = ((left!.flags | right!.flags) & (SignatureFlagsPropagatingFlags & ~SignatureFlagsHasRestParameter)) as SignatureFlags;
  const declaration = left!.declaration;
  const params = Checker_combineUnionOrIntersectionParameters(receiver, left, right, paramMapper, isUnion);
  const lastParam = core.LastOrNil(params);
  if (lastParam !== undefined && (lastParam!.CheckFlags & CheckFlagsRestParameter) !== 0) {
    flags = (flags | SignatureFlagsHasRestParameter) as SignatureFlags;
  }
  const thisParam = Checker_combineUnionOrIntersectionThisParam(receiver, left!.thisParameter, right!.thisParameter, paramMapper, isUnion);
  const minArgCount = Math.max(left!.minArgumentCount, right!.minArgumentCount) as int;
  const result = Checker_newSignature(receiver, flags, declaration, typeParams, thisParam, params, undefined, undefined, minArgCount);
  let leftSignatures: GoSlice<GoPtr<Signature>>;
  if (left!.composite !== undefined && left!.composite.isUnion) {
    leftSignatures = left!.composite.signatures;
  } else {
    leftSignatures = [left];
  }
  result!.composite = { isUnion, signatures: [...leftSignatures, right] };
  if (paramMapper !== undefined) {
    if (left!.composite !== undefined && left!.composite.isUnion === isUnion && left!.mapper !== undefined) {
      result!.mapper = Checker_combineTypeMappers(receiver, left!.mapper, paramMapper);
    } else {
      result!.mapper = paramMapper;
    }
  } else if (left!.composite !== undefined && left!.composite.isUnion === isUnion) {
    result!.mapper = left!.mapper;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.combineUnionOrIntersectionParameters","kind":"method","status":"implemented","sigHash":"72ea8e5cc81eeb6245823f316712b77c0199ee3a8bf4d1bfaa14f9301923c2fc","bodyHash":"933e563119a1f9f5f8156453d6fbe56bdcf3680fb40621b3b8ba9787eca9eca2"}
 *
 * Go source:
 * func (c *Checker) combineUnionOrIntersectionParameters(left *Signature, right *Signature, mapper *TypeMapper, isUnion bool) []*ast.Symbol {
 * 	leftCount := c.getParameterCount(left)
 * 	rightCount := c.getParameterCount(right)
 * 	var longestCount int
 * 	var longest, shorter *Signature
 * 	if leftCount >= rightCount {
 * 		longestCount, longest, shorter = leftCount, left, right
 * 	} else {
 * 		longestCount, longest, shorter = rightCount, right, left
 * 	}
 * 	eitherHasEffectiveRest := c.hasEffectiveRestParameter(left) || c.hasEffectiveRestParameter(right)
 * 	needsExtraRestElement := eitherHasEffectiveRest && !c.hasEffectiveRestParameter(longest)
 * 	params := make([]*ast.Symbol, longestCount+core.IfElse(needsExtraRestElement, 1, 0))
 * 	for i := range longestCount {
 * 		longestParamType := c.tryGetTypeAtPosition(longest, i)
 * 		if longest == right {
 * 			longestParamType = c.instantiateType(longestParamType, mapper)
 * 		}
 * 		shorterParamType := core.OrElse(c.tryGetTypeAtPosition(shorter, i), c.unknownType)
 * 		if shorter == right {
 * 			shorterParamType = c.instantiateType(shorterParamType, mapper)
 * 		}
 * 		combinedParamType := c.getUnionOrIntersectionType([]*Type{longestParamType, shorterParamType}, !isUnion, UnionReductionLiteral)
 * 		isRestParam := eitherHasEffectiveRest && !needsExtraRestElement && i == (longestCount-1)
 * 		isOptional := i >= c.getMinArgumentCount(longest) && i >= c.getMinArgumentCount(shorter)
 * 		var leftName, rightName string
 * 		if i < leftCount {
 * 			leftName = c.getParameterNameAtPosition(left, i)
 * 		}
 * 		if i < rightCount {
 * 			rightName = c.getParameterNameAtPosition(right, i)
 * 		}
 * 		var paramName string
 * 		switch {
 * 		case leftName == rightName:
 * 			paramName = leftName
 * 		case leftName == "":
 * 			paramName = rightName
 * 		case rightName == "":
 * 			paramName = leftName
 * 		}
 * 		if paramName == "" {
 * 			paramName = "arg" + strconv.Itoa(i)
 * 		}
 * 		paramSymbol := c.newSymbolEx(ast.SymbolFlagsFunctionScopedVariable|core.IfElse(isOptional && !isRestParam, ast.SymbolFlagsOptional, 0), paramName,
 * 			core.IfElse(isRestParam, ast.CheckFlagsRestParameter, core.IfElse(isOptional, ast.CheckFlagsOptionalParameter, 0)))
 * 		links := c.valueSymbolLinks.Get(paramSymbol)
 * 		if isRestParam {
 * 			links.resolvedType = c.createArrayType(combinedParamType)
 * 		} else {
 * 			links.resolvedType = combinedParamType
 * 		}
 * 		params[i] = paramSymbol
 * 	}
 * 	if needsExtraRestElement {
 * 		restParamSymbol := c.newSymbolEx(ast.SymbolFlagsFunctionScopedVariable, "args", ast.CheckFlagsRestParameter)
 * 		links := c.valueSymbolLinks.Get(restParamSymbol)
 * 		links.resolvedType = c.createArrayType(c.getTypeAtPosition(shorter, longestCount))
 * 		if shorter == right {
 * 			links.resolvedType = c.instantiateType(links.resolvedType, mapper)
 * 		}
 * 		params[longestCount] = restParamSymbol
 * 	}
 * 	return params
 * }
 */
export function Checker_combineUnionOrIntersectionParameters(receiver: GoPtr<Checker>, left: GoPtr<Signature>, right: GoPtr<Signature>, mapper: GoPtr<TypeMapper>, isUnion: bool): GoSlice<GoPtr<Symbol>> {
  const leftCount = Checker_getParameterCount(receiver, left);
  const rightCount = Checker_getParameterCount(receiver, right);
  let longestCount: int;
  let longest: GoPtr<Signature>;
  let shorter: GoPtr<Signature>;
  if (leftCount >= rightCount) {
    longestCount = leftCount;
    longest = left;
    shorter = right;
  } else {
    longestCount = rightCount;
    longest = right;
    shorter = left;
  }
  const eitherHasEffectiveRest = Checker_hasEffectiveRestParameter(receiver, left) || Checker_hasEffectiveRestParameter(receiver, right);
  const needsExtraRestElement = eitherHasEffectiveRest && !Checker_hasEffectiveRestParameter(receiver, longest);
  const params = new Array<GoPtr<Symbol>>(longestCount + core.IfElse(needsExtraRestElement, 1, 0)) as GoSlice<GoPtr<Symbol>>;
  for (let i = 0; i < longestCount; i++) {
    let longestParamType = Checker_tryGetTypeAtPosition(receiver, longest, i as int);
    if (longest === right) {
      longestParamType = Checker_instantiateType(receiver, longestParamType, mapper);
    }
    let shorterParamType = core.OrElse(Checker_tryGetTypeAtPosition(receiver, shorter, i as int), receiver!.unknownType);
    if (shorter === right) {
      shorterParamType = Checker_instantiateType(receiver, shorterParamType, mapper);
    }
    const combinedParamType = Checker_getUnionOrIntersectionType(receiver, [longestParamType, shorterParamType], !isUnion, UnionReductionLiteral);
    const isRestParam = eitherHasEffectiveRest && !needsExtraRestElement && i === (longestCount - 1);
    const isOptional = i >= Checker_getMinArgumentCount(receiver, longest) && i >= Checker_getMinArgumentCount(receiver, shorter);
    let leftName = "";
    let rightName = "";
    if (i < leftCount) {
      leftName = Checker_getParameterNameAtPosition(receiver, left, i as int);
    }
    if (i < rightCount) {
      rightName = Checker_getParameterNameAtPosition(receiver, right, i as int);
    }
    let paramName = "";
    switch (true) {
      case leftName === rightName:
        paramName = leftName;
        break;
      case leftName === "":
        paramName = rightName;
        break;
      case rightName === "":
        paramName = leftName;
        break;
    }
    if (paramName === "") {
      paramName = `arg${i}`;
    }
    const paramSymbol = Checker_newSymbolEx(
      receiver,
      (SymbolFlagsFunctionScopedVariable | core.IfElse(isOptional && !isRestParam, SymbolFlagsOptional, 0)) as SymbolFlags,
      paramName,
      core.IfElse(isRestParam, CheckFlagsRestParameter, core.IfElse(isOptional, CheckFlagsOptionalParameter, 0)),
    );
    const links = LinkStore_Get(receiver!.valueSymbolLinks, paramSymbol) as GoPtr<ValueSymbolLinks>;
    if (isRestParam) {
      links!.resolvedType = Checker_createArrayType(receiver, combinedParamType);
    } else {
      links!.resolvedType = combinedParamType;
    }
    params[i] = paramSymbol;
  }
  if (needsExtraRestElement) {
    const restParamSymbol = Checker_newSymbolEx(receiver, SymbolFlagsFunctionScopedVariable as SymbolFlags, "args", CheckFlagsRestParameter);
    const links = LinkStore_Get(receiver!.valueSymbolLinks, restParamSymbol) as GoPtr<ValueSymbolLinks>;
    links!.resolvedType = Checker_createArrayType(receiver, Checker_getTypeAtPosition(receiver, shorter, longestCount));
    if (shorter === right) {
      links!.resolvedType = Checker_instantiateType(receiver, links!.resolvedType, mapper);
    }
    params[longestCount] = restParamSymbol;
  }
  return params;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.appendSignatures","kind":"method","status":"implemented","sigHash":"5c3fa0c2ecdf16edcebf284c72274319cdda4a79a191179ae327b923d4a4b8ed","bodyHash":"96792b8ff2bfc0529611434531cbc32a79e38f9f8376c2972e6636091a2bdaa8"}
 *
 * Go source:
 * func (c *Checker) appendSignatures(signatures []*Signature, newSignatures []*Signature) []*Signature {
 * 	for _, sig := range newSignatures {
 * 		if len(signatures) == 0 || core.Every(signatures, func(s *Signature) bool {
 * 			return c.compareSignaturesIdentical(s, sig, false /*partialMatch* /, false /*ignoreThisTypes* /, false /*ignoreReturnTypes* /, c.compareTypesIdentical) == TernaryFalse
 * 		}) {
 * 			signatures = append(signatures, sig)
 * 		}
 * 	}
 * 	return signatures
 * }
 */
export function Checker_appendSignatures(receiver: GoPtr<Checker>, signatures: GoSlice<GoPtr<Signature>>, newSignatures: GoSlice<GoPtr<Signature>>): GoSlice<GoPtr<Signature>> {
  let result = signatures ?? [] as GoSlice<GoPtr<Signature>>;
  for (const sig of (newSignatures ?? [])) {
    if (result.length === 0 || core.Every(result, (s: GoPtr<Signature>) =>
      Checker_compareSignaturesIdentical(receiver, s, sig, false, false, false, (source: GoPtr<Type>, target: GoPtr<Type>) => Checker_compareTypesIdentical(receiver, source, target)) === TernaryFalse)) {
      result = [...result, sig] as GoSlice<GoPtr<Signature>>;
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeArguments","kind":"method","status":"implemented","sigHash":"3c7691036560484008d07192ef2d8716f3171561be9cfbe8b8c5854121ba87f8","bodyHash":"53f78fa2fb565050154647e8519a80b508e09774a1eed0409ed075f006b4bbb4"}
 *
 * Go source:
 * func (c *Checker) getTypeArguments(t *Type) []*Type {
 * 	d := t.AsTypeReference()
 * 	if d.resolvedTypeArguments == nil {
 * 		n := d.target.AsInterfaceType()
 * 		if !c.pushTypeResolution(t, TypeSystemPropertyNameResolvedTypeArguments) {
 * 			return slices.Repeat([]*Type{c.errorType}, len(n.TypeParameters()))
 * 		}
 * 		var typeArguments []*Type
 * 		node := t.AsTypeReference().node
 * 		if node != nil {
 * 			switch node.Kind {
 * 			case ast.KindTypeReference:
 * 				typeArguments = append(n.OuterTypeParameters(), c.getEffectiveTypeArguments(node, n.LocalTypeParameters())...)
 * 			case ast.KindArrayType:
 * 				typeArguments = []*Type{c.getTypeFromTypeNode(node.AsArrayTypeNode().ElementType)}
 * 			case ast.KindTupleType:
 * 				typeArguments = core.Map(node.Elements(), c.getTypeFromTypeNode)
 * 			default:
 * 				panic("Unhandled case in getTypeArguments")
 * 			}
 * 		}
 * 		if c.popTypeResolution() {
 * 			if d.resolvedTypeArguments == nil {
 * 				d.resolvedTypeArguments = c.instantiateTypes(typeArguments, d.mapper)
 * 			}
 * 		} else {
 * 			if d.resolvedTypeArguments == nil {
 * 				d.resolvedTypeArguments = slices.Repeat([]*Type{c.errorType}, len(n.TypeParameters()))
 * 			}
 * 			errorNode := core.IfElse(node != nil, node, c.currentNode)
 * 			if d.target.symbol != nil {
 * 				c.error(errorNode, diagnostics.Type_arguments_for_0_circularly_reference_themselves, c.symbolToString(d.target.symbol))
 * 			} else {
 * 				c.error(errorNode, diagnostics.Tuple_type_arguments_circularly_reference_themselves)
 * 			}
 * 		}
 * 	}
 * 	return d.resolvedTypeArguments
 * }
 */
export function Checker_getTypeArguments(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoSlice<GoPtr<Type>> {
  const d = Type_AsTypeReference(t);
  if (d!.resolvedTypeArguments === undefined) {
    const targetInterface = Type_TargetInterfaceType(t);
    if (!Checker_pushTypeResolution(receiver, t, TypeSystemPropertyNameResolvedTypeArguments)) {
      return slices.Repeat([receiver!.errorType], InterfaceType_TypeParameters(targetInterface).length);
    }
    let typeArguments: GoSlice<GoPtr<Type>> = [];
    const node = d!.node;
    if (node !== undefined) {
      switch (node.Kind) {
        case KindTypeReference:
          typeArguments = [...InterfaceType_OuterTypeParameters(targetInterface), ...Checker_getEffectiveTypeArguments(receiver, node, InterfaceType_LocalTypeParameters(targetInterface))] as GoSlice<GoPtr<Type>>;
          break;
        case KindArrayType:
          typeArguments = [Checker_getTypeFromTypeNode(receiver, AsArrayTypeNode(node)!.ElementType)];
          break;
        case KindTupleType:
          typeArguments = core.Map(Node_Elements(node) ?? [], (element: GoPtr<Node>) => Checker_getTypeFromTypeNode(receiver, element));
          break;
        default:
          throw new globalThis.Error("Unhandled case in getTypeArguments");
      }
    }
    if (Checker_popTypeResolution(receiver)) {
      if (d!.resolvedTypeArguments === undefined) {
        d!.resolvedTypeArguments = Checker_instantiateTypes(receiver, typeArguments, Type_Mapper(t));
      }
    } else {
      if (d!.resolvedTypeArguments === undefined) {
        d!.resolvedTypeArguments = slices.Repeat([receiver!.errorType], InterfaceType_TypeParameters(targetInterface).length);
      }
      const errorNode = node !== undefined ? node : receiver!.currentNode;
      if (Type_Target(t)!.symbol !== undefined) {
        Checker_error(receiver, errorNode, Type_arguments_for_0_circularly_reference_themselves, Checker_symbolToString(receiver, Type_Target(t)!.symbol));
      } else {
        Checker_error(receiver, errorNode, Tuple_type_arguments_circularly_reference_themselves);
      }
    }
  }
  return d!.resolvedTypeArguments;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getEffectiveTypeArguments","kind":"method","status":"implemented","sigHash":"02e479812dd0eb4e62a29ee97c7db5885a4135552e5eabdf9afffc3f992557bf","bodyHash":"121f191ca275c57c2d307d55094d11a0bb8f5173a051eef93a06ee44a011af2a"}
 *
 * Go source:
 * func (c *Checker) getEffectiveTypeArguments(node *ast.Node, typeParameters []*Type) []*Type {
 * 	return c.fillMissingTypeArguments(core.Map(node.TypeArguments(), c.getTypeFromTypeNode), typeParameters, c.getMinTypeArgumentCount(typeParameters), ast.IsInJSFile(node))
 * }
 */
export function Checker_getEffectiveTypeArguments(receiver: GoPtr<Checker>, node: GoPtr<Node>, typeParameters: GoSlice<GoPtr<Type>>): GoSlice<GoPtr<Type>> {
  return Checker_fillMissingTypeArguments(receiver, core.Map(Node_TypeArguments(node) ?? [], (n: GoPtr<Node>) => Checker_getTypeFromTypeNode(receiver, n)), typeParameters, Checker_getMinTypeArgumentCount(receiver, typeParameters), IsInJSFile(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getMinTypeArgumentCount","kind":"method","status":"implemented","sigHash":"22295ff81bbdde03c306d61cffb97e53d3559006caf1aad8214ace6ec4f01ac8","bodyHash":"7685f119b33062d5b77d9c75846211fbb09d249ef7dffa5cd73cefa47f9e90f8"}
 *
 * Go source:
 * func (c *Checker) getMinTypeArgumentCount(typeParameters []*Type) int {
 * 	minTypeArgumentCount := 0
 * 	for i, typeParameter := range typeParameters {
 * 		if !c.hasTypeParameterDefault(typeParameter) {
 * 			minTypeArgumentCount = i + 1
 * 		}
 * 	}
 * 	return minTypeArgumentCount
 * }
 */
export function Checker_getMinTypeArgumentCount(receiver: GoPtr<Checker>, typeParameters: GoSlice<GoPtr<Type>>): int {
  let minTypeArgumentCount = 0;
  for (let i = 0; i < typeParameters.length; i++) {
    if (!Checker_hasTypeParameterDefault(receiver, typeParameters[i])) {
      minTypeArgumentCount = i + 1;
    }
  }
  return minTypeArgumentCount;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasTypeParameterDefault","kind":"method","status":"implemented","sigHash":"e9cce9e048ed33dc9ed8c075a145c4214a0ab0f84854c1f7352688311c73de56","bodyHash":"f498f1487a9cd954719e6bf1ce96b7d8c8698d66933085ac474aa4fadd212a87"}
 *
 * Go source:
 * func (c *Checker) hasTypeParameterDefault(t *Type) bool {
 * 	return t.symbol != nil && core.Some(t.symbol.Declarations, func(d *ast.Node) bool {
 * 		return ast.IsTypeParameterDeclaration(d) && d.AsTypeParameterDeclaration().DefaultType != nil
 * 	})
 * }
 */
export function Checker_hasTypeParameterDefault(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  return t!.symbol !== undefined && core.Some(t!.symbol!.Declarations ?? [], (d: GoPtr<Node>) =>
    IsTypeParameterDeclaration(d) && AsTypeParameterDeclaration(d)!.DefaultType !== undefined
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.fillMissingTypeArguments","kind":"method","status":"implemented","sigHash":"90119f31e42b5b3c6483f74a4486a50d2c36e8e47fd66a2b2a63c01cf4ffbd18","bodyHash":"53094ad900a81ee75d20b4e1e28ec02aebdcae494b0d9096524457dadbc4f47a"}
 *
 * Go source:
 * func (c *Checker) fillMissingTypeArguments(typeArguments []*Type, typeParameters []*Type, minTypeArgumentCount int, isJavaScriptImplicitAny bool) []*Type {
 * 	numTypeParameters := len(typeParameters)
 * 	if numTypeParameters == 0 {
 * 		return nil
 * 	}
 * 	numTypeArguments := len(typeArguments)
 * 	if isJavaScriptImplicitAny || numTypeArguments < numTypeParameters {
 * 		result := make([]*Type, numTypeParameters)
 * 		copy(result, typeArguments)
 * 		// Map invalid forward references in default types to the error type
 * 		for i := numTypeArguments; i < numTypeParameters; i++ {
 * 			result[i] = c.errorType
 * 		}
 * 		baseDefaultType := c.getDefaultTypeArgumentType(isJavaScriptImplicitAny)
 * 		for i := numTypeArguments; i < numTypeParameters; i++ {
 * 			defaultType := c.getDefaultFromTypeParameter(typeParameters[i])
 *
 * 			if isJavaScriptImplicitAny && defaultType != nil && (c.isTypeIdenticalTo(defaultType, c.unknownType) || c.isTypeIdenticalTo(defaultType, c.emptyObjectType)) {
 * 				defaultType = c.anyType
 * 			}
 *
 * 			if defaultType != nil {
 * 				result[i] = c.instantiateType(defaultType, newTypeMapper(typeParameters, result))
 * 			} else {
 * 				result[i] = baseDefaultType
 * 			}
 * 		}
 * 		return result
 * 	}
 * 	return typeArguments
 * }
 */
export function Checker_fillMissingTypeArguments(receiver: GoPtr<Checker>, typeArguments: GoSlice<GoPtr<Type>>, typeParameters: GoSlice<GoPtr<Type>>, minTypeArgumentCount: int, isJavaScriptImplicitAny: bool): GoSlice<GoPtr<Type>> {
  const numTypeParameters = (typeParameters ?? []).length;
  if (numTypeParameters === 0) {
    return [];
  }
  const numTypeArguments = (typeArguments ?? []).length;
  if (isJavaScriptImplicitAny || numTypeArguments < numTypeParameters) {
    const result: GoPtr<Type>[] = new Array(numTypeParameters);
    for (let i = 0; i < numTypeArguments; i++) {
      result[i] = typeArguments![i];
    }
    // Map invalid forward references in default types to the error type
    for (let i = numTypeArguments; i < numTypeParameters; i++) {
      result[i] = receiver!.errorType;
    }
    const baseDefaultType = Checker_getDefaultTypeArgumentType(receiver, isJavaScriptImplicitAny);
    for (let i = numTypeArguments; i < numTypeParameters; i++) {
      let defaultType = Checker_getDefaultFromTypeParameter(receiver, typeParameters![i]);
      if (isJavaScriptImplicitAny && defaultType !== undefined && (Checker_isTypeIdenticalTo(receiver, defaultType, receiver!.unknownType) || Checker_isTypeIdenticalTo(receiver, defaultType, receiver!.emptyObjectType))) {
        defaultType = receiver!.anyType;
      }
      if (defaultType !== undefined) {
        result[i] = Checker_instantiateType(receiver, defaultType, newTypeMapper(typeParameters!, result as GoSlice<GoPtr<Type>>));
      } else {
        result[i] = baseDefaultType;
      }
    }
    return result as GoSlice<GoPtr<Type>>;
  }
  return typeArguments;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDefaultTypeArgumentType","kind":"method","status":"implemented","sigHash":"3c192613eb0fc4db43cea8c8d583f463f0ca886275cc03b3d0bc695c0b734731","bodyHash":"50cab841ffd023e1f0b0e9b3cb837b7a06f67d993b02f818c6f1a96c2324def8"}
 *
 * Go source:
 * func (c *Checker) getDefaultTypeArgumentType(isInJavaScriptFile bool) *Type {
 * 	if isInJavaScriptFile {
 * 		return c.anyType
 * 	}
 * 	return c.unknownType
 * }
 */
export function Checker_getDefaultTypeArgumentType(receiver: GoPtr<Checker>, isInJavaScriptFile: bool): GoPtr<Type> {
  if (isInJavaScriptFile) {
    return receiver!.anyType;
  }
  return receiver!.unknownType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDefaultFromTypeParameter","kind":"method","status":"implemented","sigHash":"b3c47e1eeac7d2ff3f9cbfc970b00ba6288f804ee2df1165d9982d1cbe684cf7","bodyHash":"bb43c5ea3fb9e64d54eb4a595e749f96ec27f2a603ab6dc89bae1f4319c3e105"}
 *
 * Go source:
 * func (c *Checker) getDefaultFromTypeParameter(t *Type) *Type {
 * 	if t.flags&TypeFlagsTypeParameter == 0 {
 * 		return nil
 * 	}
 * 	defaultType := c.getResolvedTypeParameterDefault(t)
 * 	if defaultType != c.noConstraintType && defaultType != c.circularConstraintType {
 * 		return defaultType
 * 	}
 * 	return nil
 * }
 */
export function Checker_getDefaultFromTypeParameter(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  if ((t!.flags & TypeFlagsTypeParameter) === 0) {
    return undefined;
  }
  const defaultType = Checker_getResolvedTypeParameterDefault(receiver, t);
  if (defaultType !== receiver!.noConstraintType && defaultType !== receiver!.circularConstraintType) {
    return defaultType;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getResolvedTypeParameterDefault","kind":"method","status":"implemented","sigHash":"df0b5f27b5a3ad3a7f7e37bc9b455d7dc3215612a0d28be3e13b5ebb30fa4f7d","bodyHash":"4203eefed124d92a7d77c86f54cc659c56fa486c3247c69112bd8d7a8103ddcb"}
 *
 * Go source:
 * func (c *Checker) getResolvedTypeParameterDefault(t *Type) *Type {
 * 	d := t.AsTypeParameter()
 * 	if d.resolvedDefaultType == nil {
 * 		if d.target != nil {
 * 			targetDefault := c.getResolvedTypeParameterDefault(d.target)
 * 			if targetDefault != nil {
 * 				d.resolvedDefaultType = c.instantiateType(targetDefault, d.mapper)
 * 			} else {
 * 				d.resolvedDefaultType = c.noConstraintType
 * 			}
 * 		} else {
 * 			// To block recursion, set the initial value to the resolvingDefaultType.
 * 			d.resolvedDefaultType = c.resolvingDefaultType
 * 			defaultType := c.noConstraintType
 * 			if t.symbol != nil {
 * 				defaultDeclaration := core.FirstNonNil(t.symbol.Declarations, func(decl *ast.Node) *ast.Node {
 * 					if ast.IsTypeParameterDeclaration(decl) {
 * 						return decl.AsTypeParameterDeclaration().DefaultType
 * 					}
 * 					return nil
 * 				})
 * 				if defaultDeclaration != nil {
 * 					defaultType = c.getTypeFromTypeNode(defaultDeclaration)
 * 				}
 * 			}
 * 			if d.resolvedDefaultType == c.resolvingDefaultType {
 * 				// If we have not been called recursively, set the correct default type.
 * 				d.resolvedDefaultType = defaultType
 * 			}
 * 		}
 * 	} else if d.resolvedDefaultType == c.resolvingDefaultType {
 * 		// If we are called recursively for this type parameter, mark the default as circular.
 * 		d.resolvedDefaultType = c.circularConstraintType
 * 	}
 * 	return d.resolvedDefaultType
 * }
 */
export function Checker_getResolvedTypeParameterDefault(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  const d = Type_AsTypeParameter(t);
  if (d!.resolvedDefaultType === undefined) {
    if (d!.target !== undefined) {
      const targetDefault = Checker_getResolvedTypeParameterDefault(receiver, d!.target);
      if (targetDefault !== undefined) {
        d!.resolvedDefaultType = Checker_instantiateType(receiver, targetDefault, d!.mapper);
      } else {
        d!.resolvedDefaultType = receiver!.noConstraintType;
      }
    } else {
      // To block recursion, set the initial value to the resolvingDefaultType.
      d!.resolvedDefaultType = receiver!.resolvingDefaultType;
      let defaultType = receiver!.noConstraintType;
      if (t!.symbol !== undefined) {
        const defaultDeclaration = core.FirstNonNil(t!.symbol!.Declarations ?? [], (decl: GoPtr<Node>) => {
          if (IsTypeParameterDeclaration(decl)) {
            return AsTypeParameterDeclaration(decl)!.DefaultType;
          }
          return undefined;
        });
        if (defaultDeclaration !== undefined) {
          defaultType = Checker_getTypeFromTypeNode(receiver, defaultDeclaration);
        }
      }
      if (d!.resolvedDefaultType === receiver!.resolvingDefaultType) {
        // If we have not been called recursively, set the correct default type.
        d!.resolvedDefaultType = defaultType;
      }
    }
  } else if (d!.resolvedDefaultType === receiver!.resolvingDefaultType) {
    // If we are called recursively for this type parameter, mark the default as circular.
    d!.resolvedDefaultType = receiver!.circularConstraintType;
  }
  return d!.resolvedDefaultType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDefaultOrUnknownFromTypeParameter","kind":"method","status":"implemented","sigHash":"61be3bb8c19975f78659be69aee347f6aec3ec58e973f087c3be72e99c11c5a7","bodyHash":"ef6b50997ea822576ebee944bdde4374cdf213065c8dedcf59bdadb624a47821"}
 *
 * Go source:
 * func (c *Checker) getDefaultOrUnknownFromTypeParameter(t *Type) *Type {
 * 	result := c.getDefaultFromTypeParameter(t)
 * 	return core.IfElse(result != nil, result, c.unknownType)
 * }
 */
export function Checker_getDefaultOrUnknownFromTypeParameter(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  const result = Checker_getDefaultFromTypeParameter(receiver, t);
  return core.IfElse(result !== undefined, result, receiver!.unknownType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isTypeParameterPossiblyReferenced","kind":"method","status":"implemented","sigHash":"c3efe8d0da236c675a357508c8dbd5538d1d43effe74befd2c2ec54b868f964c","bodyHash":"44e809447efb7bbe19f4b6304a8261d81c1f40514ed309bee6b5163b1e46df5a"}
 *
 * Go source:
 * func (c *Checker) isTypeParameterPossiblyReferenced(tp *Type, node *ast.Node) bool {
 * 	var containsReference func(*ast.Node) bool
 * 	containsReference = func(node *ast.Node) bool {
 * 		switch node.Kind {
 * 		case ast.KindThisType:
 * 			return tp.AsTypeParameter().isThisType
 * 		case ast.KindTypeReference:
 * 			// use worker because we're looking for === equality
 * 			if !tp.AsTypeParameter().isThisType && len(node.TypeArguments()) == 0 && c.getSymbolFromTypeReference(node) == tp.symbol {
 * 				return true
 * 			}
 * 		case ast.KindTypeQuery:
 * 			entityName := node.AsTypeQueryNode().ExprName
 * 			firstIdentifier := ast.GetFirstIdentifier(entityName)
 * 			if !ast.IsThisIdentifier(firstIdentifier) {
 * 				firstIdentifierSymbol := c.getResolvedSymbol(firstIdentifier)
 * 				tpDeclaration := tp.symbol.Declarations[0] // There is exactly one declaration, otherwise `containsReference` is not called
 * 				var tpScope *ast.Node
 * 				switch {
 * 				case ast.IsTypeParameterDeclaration(tpDeclaration):
 * 					tpScope = tpDeclaration.Parent // Type parameter is a regular type parameter, e.g. foo<T>
 * 				case tp.AsTypeParameter().isThisType:
 * 					tpScope = tpDeclaration // Type parameter is the this type, and its declaration is the class declaration.
 * 				}
 * 				if tpScope != nil {
 * 					return core.Some(firstIdentifierSymbol.Declarations, func(d *ast.Node) bool { return isNodeDescendantOf(d, tpScope) }) ||
 * 						core.Some(node.TypeArguments(), containsReference)
 * 				}
 * 			}
 * 			return true
 * 		case ast.KindMethodDeclaration, ast.KindMethodSignature:
 * 			returnType := node.Type()
 * 			return returnType == nil && node.Body() != nil ||
 * 				core.Some(node.TypeParameters(), containsReference) ||
 * 				core.Some(node.Parameters(), containsReference) ||
 * 				returnType != nil && containsReference(returnType)
 * 		}
 * 		return node.ForEachChild(containsReference)
 * 	}
 * 	// If the type parameter doesn't have exactly one declaration, if there are intervening statement blocks
 * 	// between the node and the type parameter declaration, if the node contains actual references to the
 * 	// type parameter, or if the node contains type queries that we can't prove couldn't contain references to the type parameter,
 * 	// we consider the type parameter possibly referenced.
 * 	if tp.symbol != nil && len(tp.symbol.Declarations) == 1 {
 * 		container := tp.symbol.Declarations[0].Parent
 * 		for n := node; n != container; n = n.Parent {
 * 			if n == nil || ast.IsBlock(n) || ast.IsConditionalTypeNode(n) && containsReference(n.AsConditionalTypeNode().ExtendsType) {
 * 				return true
 * 			}
 * 		}
 * 		return containsReference(node)
 * 	}
 * 	return true
 * }
 */
export function Checker_isTypeParameterPossiblyReferenced(receiver: GoPtr<Checker>, tp: GoPtr<Type>, node: GoPtr<Node>): bool {
  const containsReference = (current: GoPtr<Node>): bool => {
    switch (current!.Kind) {
      case KindThisType:
        return Type_AsTypeParameter(tp)!.isThisType;
      case KindTypeReference:
        if (
          !Type_AsTypeParameter(tp)!.isThisType &&
          ((Node_TypeArguments(current) as GoSlice<GoPtr<Node>> | undefined)?.length ?? 0) === 0 &&
          Checker_getSymbolFromTypeReference(receiver, current) === tp!.symbol
        ) {
          return true;
        }
        break;
      case KindTypeQuery: {
        const entityName = AsTypeQueryNode(current)!.ExprName;
        const firstIdentifier = GetFirstIdentifier(entityName);
        if (!IsThisIdentifier(firstIdentifier)) {
          const firstIdentifierSymbol = Checker_getResolvedSymbol(receiver, firstIdentifier);
          const typeParameterDeclaration = tp!.symbol!.Declarations![0]!;
          let typeParameterScope: GoPtr<Node> = undefined;
          if (IsTypeParameterDeclaration(typeParameterDeclaration)) {
            typeParameterScope = typeParameterDeclaration.Parent;
          } else if (Type_AsTypeParameter(tp)!.isThisType) {
            typeParameterScope = typeParameterDeclaration;
          }
          if (typeParameterScope !== undefined) {
            return (
              core.Some(firstIdentifierSymbol!.Declarations ?? [], (declaration: GoPtr<Node>): bool =>
                isNodeDescendantOf(declaration, typeParameterScope),
              ) || core.Some(Node_TypeArguments(current) as GoSlice<GoPtr<Node>>, containsReference)
            );
          }
        }
        return true;
      }
      case KindMethodDeclaration:
      case KindMethodSignature: {
        const returnType = Node_Type(current);
        return (
          (returnType === undefined && Node_Body(current) !== undefined) ||
          core.Some(Node_TypeParameters(current) as GoSlice<GoPtr<Node>>, containsReference) ||
          core.Some(Node_Parameters(current) as GoSlice<GoPtr<Node>>, containsReference) ||
          (returnType !== undefined && containsReference(returnType))
        );
      }
    }
    return Node_ForEachChild(current, containsReference);
  };
  if (tp!.symbol !== undefined && (tp!.symbol.Declarations?.length ?? 0) === 1) {
    const container = tp!.symbol.Declarations![0]!.Parent;
    for (let current = node; current !== container; current = current!.Parent) {
      if (
        current === undefined ||
        IsBlock(current) ||
        (IsConditionalTypeNode(current) && containsReference(AsConditionalTypeNode(current)!.ExtendsType))
      ) {
        return true;
      }
    }
    return containsReference(node);
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.cloneTypeParameter","kind":"method","status":"implemented","sigHash":"b84cdc9b143ac359efd137b150a5b35c99c68195dd9f4b5e2424230fec3295ae","bodyHash":"2258ccf1084ee2f86bc3c641a4ae0be9910a8d867b49d9b178a1691cfae45bfa"}
 *
 * Go source:
 * func (c *Checker) cloneTypeParameter(tp *Type) *Type {
 * 	result := c.newTypeParameter(tp.symbol)
 * 	result.AsTypeParameter().target = tp
 * 	return result
 * }
 */
export function Checker_cloneTypeParameter(receiver: GoPtr<Checker>, tp: GoPtr<Type>): GoPtr<Type> {
  const result = Checker_newTypeParameter(receiver, tp!.symbol);
  Type_AsTypeParameter(result)!.target = tp;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeParameterFromMappedType","kind":"method","status":"implemented","sigHash":"643ec895f9675933995ffc972567ef3af732d268ffdf49fa89b9fda16b8a4914","bodyHash":"29608c06dec49896406fab90c76b981ceca86b46dc56980151ca37ef19e1ce78"}
 *
 * Go source:
 * func (c *Checker) getTypeParameterFromMappedType(t *Type) *Type {
 * 	m := t.AsMappedType()
 * 	if m.typeParameter == nil {
 * 		m.typeParameter = c.getDeclaredTypeOfTypeParameter(c.getSymbolOfDeclaration(m.declaration.TypeParameter))
 * 	}
 * 	return m.typeParameter
 * }
 */
export function Checker_getTypeParameterFromMappedType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  const m = Type_AsMappedType(t);
  if (m!.typeParameter === undefined) {
    m!.typeParameter = Checker_getDeclaredTypeOfTypeParameter(receiver, Checker_getSymbolOfDeclaration(receiver, AsMappedTypeNode(m!.declaration)!.TypeParameter));
  }
  return m!.typeParameter;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.forEachMappedTypePropertyKeyTypeAndIndexSignatureKeyType","kind":"method","status":"implemented","sigHash":"1842580a5020f1e9a9f02c5e415e7f99106426ec0a76e065c38578183b599f02","bodyHash":"4d1499156463903b889d33e2b288b68580edfaccd772751a0f4fcc4e8ffa3b71"}
 *
 * Go source:
 * func (c *Checker) forEachMappedTypePropertyKeyTypeAndIndexSignatureKeyType(t *Type, include TypeFlags, stringsOnly bool, cb func(keyType *Type)) {
 * 	for _, prop := range c.getPropertiesOfType(t) {
 * 		cb(c.getLiteralTypeFromProperty(prop, include, false))
 * 	}
 * 	if t.flags&TypeFlagsAny != 0 {
 * 		cb(c.stringType)
 * 	} else {
 * 		for _, info := range c.getIndexInfosOfType(t) {
 * 			if !stringsOnly || info.keyType.flags&(TypeFlagsString|TypeFlagsTemplateLiteral) != 0 {
 * 				cb(info.keyType)
 * 			}
 * 		}
 * 	}
 * }
 */
export function Checker_forEachMappedTypePropertyKeyTypeAndIndexSignatureKeyType(receiver: GoPtr<Checker>, t: GoPtr<Type>, include: TypeFlags, stringsOnly: bool, cb: (keyType: GoPtr<Type>) => void): void {
  for (const prop of Checker_getPropertiesOfType(receiver, t)) {
    cb(Checker_getLiteralTypeFromProperty(receiver, prop, include, false));
  }
  if ((t!.flags & TypeFlagsAny) !== 0) {
    cb(receiver!.stringType);
  } else {
    for (const info of Checker_getIndexInfosOfType(receiver, t)) {
      if (!stringsOnly || (info!.keyType!.flags & (TypeFlagsString | TypeFlagsTemplateLiteral)) !== 0) {
        cb(info!.keyType);
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.instantiateSignatures","kind":"method","status":"implemented","sigHash":"70ea0024c54c635fbe299ad597b08754a958f150df83d80538bdb6d53ba46dd1","bodyHash":"a83370ffef67d4526bf09a5bb98e35511c05f2e593a26003bf6087d598253dcd"}
 *
 * Go source:
 * func (c *Checker) instantiateSignatures(signatures []*Signature, m *TypeMapper) []*Signature {
 * 	return instantiateList(c, signatures, m, (*Checker).instantiateSignature)
 * }
 */
export function Checker_instantiateSignatures(receiver: GoPtr<Checker>, signatures: GoSlice<GoPtr<Signature>>, m: GoPtr<TypeMapper>): GoSlice<GoPtr<Signature>> {
  return instantiateList(receiver, signatures, m, Checker_instantiateSignature);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeFromThisTypeNode","kind":"method","status":"implemented","sigHash":"bebbe3308850a39404b9bbb496151206cc51c7e59aa77ed3c94871708a44c007","bodyHash":"9b61f350639c1096a36e54b827843e3746d8c6515152e775670ef529edb6c7b9"}
 *
 * Go source:
 * func (c *Checker) getTypeFromThisTypeNode(node *ast.Node) *Type {
 * 	links := c.typeNodeLinks.Get(node)
 * 	if links.resolvedType == nil {
 * 		links.resolvedType = c.getThisType(node)
 * 	}
 * 	return links.resolvedType
 * }
 */
export function Checker_getTypeFromThisTypeNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const links = LinkStore_Get(receiver!.typeNodeLinks, node);
  if (links!.resolvedType === undefined) {
    links!.resolvedType = Checker_getThisType(receiver, node);
  }
  return links!.resolvedType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getThisType","kind":"method","status":"implemented","sigHash":"d376c1bb26cc632cac687f0042954d9da53aac86b671125440feaf5135ee8b76","bodyHash":"d1bd83fcc3e946ad90c6f4f2ac01fb7b4afc12dc40dbf08b7b643a549ea8780e"}
 *
 * Go source:
 * func (c *Checker) getThisType(node *ast.Node) *Type {
 * 	container := ast.GetThisContainer(node /*includeArrowFunctions* /, false /*includeClassComputedPropertyName* /, false)
 * 	if container != nil {
 * 		parent := container.Parent
 * 		if parent != nil && (ast.IsClassLike(parent) || ast.IsInterfaceDeclaration(parent)) {
 * 			if !ast.IsStatic(container) && (!ast.IsConstructorDeclaration(container) || isNodeDescendantOf(node, container.Body())) {
 * 				return core.Coalesce(c.getDeclaredTypeOfClassOrInterface(c.getSymbolOfDeclaration(parent)).AsInterfaceType().thisType, c.errorType)
 * 			}
 * 		}
 * 	}
 * 	c.error(node, diagnostics.A_this_type_is_available_only_in_a_non_static_member_of_a_class_or_interface)
 * 	return c.errorType
 * }
 */
export function Checker_getThisType(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const container = GetThisContainer(node, false, false);
  if (container !== undefined) {
    const parent = container!.Parent;
    if (parent !== undefined && (IsClassLike(parent) || IsInterfaceDeclaration(parent))) {
      if (!IsStatic(container) && (!IsConstructorDeclaration(container) || isNodeDescendantOf(node, Node_Body(container)))) {
        return core.Coalesce(Type_AsInterfaceType(Checker_getDeclaredTypeOfClassOrInterface(receiver, Checker_getSymbolOfDeclaration(receiver, parent)))!.thisType, receiver!.errorType);
      }
    }
  }
  Checker_error(receiver, node, A_this_type_is_available_only_in_a_non_static_member_of_a_class_or_interface);
  return receiver!.errorType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeFromTypeLiteralOrFunctionOrConstructorTypeNode","kind":"method","status":"implemented","sigHash":"120386fe2a99dc1fa48790b1fa7a8f2f264f33f141f1d00f297ce6e8d6dea77d","bodyHash":"225739b6d3a6544a08d350f1bb8fd632ff96279f0ac4e0567842c60d106dfb45"}
 *
 * Go source:
 * func (c *Checker) getTypeFromTypeLiteralOrFunctionOrConstructorTypeNode(node *ast.Node) *Type {
 * 	links := c.typeNodeLinks.Get(node)
 * 	if links.resolvedType == nil {
 * 		// Deferred resolution of members is handled by resolveObjectTypeMembers
 * 		alias := c.getAliasForTypeNode(node)
 * 		if sym := node.Symbol(); sym == nil || len(c.getMembersOfSymbol(sym)) == 0 && alias == nil {
 * 			links.resolvedType = c.emptyTypeLiteralType
 * 		} else {
 * 			t := c.newObjectType(ObjectFlagsAnonymous, node.Symbol())
 * 			t.alias = alias
 * 			links.resolvedType = t
 * 		}
 * 	}
 * 	return links.resolvedType
 * }
 */
export function Checker_getTypeFromTypeLiteralOrFunctionOrConstructorTypeNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  const links = LinkStore_Get(receiver!.typeNodeLinks, node);
  if (links!.resolvedType === undefined) {
    // Deferred resolution of members is handled by resolveObjectTypeMembers
    const alias = Checker_getAliasForTypeNode(receiver, node);
    const sym = Node_Symbol(node);
    if (sym === undefined || ((Checker_getMembersOfSymbol(receiver, sym) ?? new Map()).size === 0 && alias === undefined)) {
      links!.resolvedType = receiver!.emptyTypeLiteralType;
    } else {
      const t = Checker_newObjectType(receiver, ObjectFlagsAnonymous, Node_Symbol(node));
      t!.alias = alias;
      links!.resolvedType = t;
    }
  }
  return links!.resolvedType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeArgumentsFromNode","kind":"method","status":"implemented","sigHash":"8fd9ba781c432f0e42c64db4d4bc010029344697e077baa76e577537edfb103b","bodyHash":"1d5dcb6b68175ad65327536d6ab94d56ca8a60205f4d4015cd6928f60003a464"}
 *
 * Go source:
 * func (c *Checker) getTypeArgumentsFromNode(node *ast.Node) []*Type {
 * 	return core.Map(node.TypeArguments(), c.getTypeFromTypeNode)
 * }
 */
export function Checker_getTypeArgumentsFromNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoSlice<GoPtr<Type>> {
  return core.Map(Node_TypeArguments(node) ?? [], (n: GoPtr<Node>) => Checker_getTypeFromTypeNode(receiver, n));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkNoTypeArguments","kind":"method","status":"implemented","sigHash":"26b770b167eb332efded578de3deecedcd829e8b8e09873ff33eabe99a14eca1","bodyHash":"e04ff3cb54babba86d2afcd00b4f59d19e8a797aa099ef781a3e13cd1913b365"}
 *
 * Go source:
 * func (c *Checker) checkNoTypeArguments(node *ast.Node, symbol *ast.Symbol) bool {
 * 	if len(node.TypeArguments()) != 0 {
 * 		var typeName string
 * 		if symbol != nil {
 * 			typeName = c.symbolToString(symbol)
 * 		} else {
 * 			typeName = scanner.DeclarationNameToString(node.AsTypeReferenceNode().TypeName)
 * 		}
 * 		c.error(node, diagnostics.Type_0_is_not_generic, typeName)
 * 		return false
 * 	}
 * 	return true
 * }
 */
export function Checker_checkNoTypeArguments(receiver: GoPtr<Checker>, node: GoPtr<Node>, symbol_: GoPtr<Symbol>): bool {
  if ((Node_TypeArguments(node)?.length ?? 0) !== 0) {
    const typeName = symbol_ !== undefined ? Checker_symbolToString(receiver, symbol_) : DeclarationNameToString(AsTypeReferenceNode(node)!.TypeName);
    Checker_error(receiver, node, Type_0_is_not_generic, typeName);
    return false;
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeReferenceArity","kind":"method","status":"implemented","sigHash":"9a84ea9c4f37c7a1bcf1f5339b3483403079422f5d9dec0e685a56edce05de01","bodyHash":"087323f7ad633d19917cfe117f3deb4000623ff36add16bf060d47ec5676b04e"}
 *
 * Go source:
 * func (c *Checker) getTypeReferenceArity(t *Type) int {
 * 	return len(t.TargetInterfaceType().TypeParameters())
 * }
 */
export function Checker_getTypeReferenceArity(receiver: GoPtr<Checker>, t: GoPtr<Type>): int {
  return InterfaceType_TypeParameters(Type_TargetInterfaceType(t)).length;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeArgumentsForAliasSymbol","kind":"method","status":"implemented","sigHash":"5a5629ce621d723b41e693a9da5be742080e2dee6041c344947278e950b09fbf","bodyHash":"f3dc72c9ecc46e513bd8b443e26e8fdd1e62326628725ec419cbf77afd9bdd00"}
 *
 * Go source:
 * func (c *Checker) getTypeArgumentsForAliasSymbol(symbol *ast.Symbol) []*Type {
 * 	if symbol != nil {
 * 		return c.getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(symbol)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getTypeArgumentsForAliasSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Type>> {
  if (symbol_ !== undefined) {
    return Checker_getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(receiver, symbol_);
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getOuterTypeParametersOfClassOrInterface","kind":"method","status":"implemented","sigHash":"43d3086fd5015e18cf822cb63f7f6206f9cfa3cd02e59aa78d00794b3e275928","bodyHash":"596557cbf04c7df0c11472d7ad831b5cdc916d70c71554a56106b367d5262a30"}
 *
 * Go source:
 * func (c *Checker) getOuterTypeParametersOfClassOrInterface(symbol *ast.Symbol) []*Type {
 * 	declaration := symbol.ValueDeclaration
 * 	if symbol.Flags&(ast.SymbolFlagsClass|ast.SymbolFlagsFunction) == 0 {
 * 		declaration = core.Find(symbol.Declarations, func(d *ast.Node) bool {
 * 			if ast.IsInterfaceDeclaration(d) {
 * 				return true
 * 			}
 * 			if !ast.IsVariableDeclaration(d) {
 * 				return false
 * 			}
 * 			initializer := d.Initializer()
 * 			return initializer != nil && ast.IsFunctionExpressionOrArrowFunction(initializer)
 * 		})
 * 	}
 * 	debug.Assert(declaration != nil, "Class was missing valueDeclaration -OR- non-class had no interface declarations")
 * 	return c.getOuterTypeParameters(declaration, false /*includeThisTypes* /)
 * }
 */
export function Checker_getOuterTypeParametersOfClassOrInterface(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Type>> {
  let declaration = symbol_!.ValueDeclaration;
  if ((symbol_!.Flags & (SymbolFlagsClass | SymbolFlagsFunction)) === 0) {
    declaration = core.Find(symbol_!.Declarations ?? [], (d: GoPtr<Node>) => {
      if (IsInterfaceDeclaration(d)) {
        return true;
      }
      if (!IsVariableDeclaration(d)) {
        return false;
      }
      const initializer = Node_Initializer(d);
      return initializer !== undefined && IsFunctionExpressionOrArrowFunction(initializer);
    });
  }
  return Checker_getOuterTypeParameters(receiver, declaration, false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getOuterTypeParameters","kind":"method","status":"implemented","sigHash":"396b6a48e7d29ec509e538212fd7a59499e3f5e27392b6a02576399e8a4bd7e4","bodyHash":"78612a68ffc9c7909b2f8d915f3625bd6908cb7c74e45b0f254bc0328dd5150d"}
 *
 * Go source:
 * func (c *Checker) getOuterTypeParameters(node *ast.Node, includeThisTypes bool) []*Type {
 * 	for {
 * 		node = node.Parent
 * 		if node == nil {
 * 			return nil
 * 		}
 * 		kind := node.Kind
 * 		switch kind {
 * 		case ast.KindClassDeclaration, ast.KindClassExpression, ast.KindInterfaceDeclaration, ast.KindCallSignature, ast.KindConstructSignature,
 * 			ast.KindMethodSignature, ast.KindFunctionType, ast.KindConstructorType, ast.KindFunctionDeclaration,
 * 			ast.KindMethodDeclaration, ast.KindFunctionExpression, ast.KindArrowFunction, ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration, ast.KindMappedType,
 * 			ast.KindConditionalType:
 * 			outerTypeParameters := c.getOuterTypeParameters(node, includeThisTypes)
 * 			if (kind == ast.KindFunctionExpression || kind == ast.KindArrowFunction || ast.IsObjectLiteralMethod(node)) && c.isContextSensitive(node) {
 * 				signature := core.FirstOrNil(c.getSignaturesOfType(c.getTypeOfSymbol(c.getSymbolOfDeclaration(node)), SignatureKindCall))
 * 				if signature != nil && len(signature.typeParameters) != 0 {
 * 					return append(outerTypeParameters, signature.typeParameters...)
 * 				}
 * 			}
 * 			if kind == ast.KindMappedType {
 * 				return append(outerTypeParameters, c.getDeclaredTypeOfTypeParameter(c.getSymbolOfDeclaration((node.AsMappedTypeNode().TypeParameter))))
 * 			}
 * 			if kind == ast.KindConditionalType {
 * 				return append(outerTypeParameters, c.getInferTypeParameters(node)...)
 * 			}
 * 			outerAndOwnTypeParameters := c.appendTypeParameters(outerTypeParameters, node.TypeParameters())
 * 			var thisType *Type
 * 			if includeThisTypes && (kind == ast.KindClassDeclaration || kind == ast.KindClassExpression || kind == ast.KindInterfaceDeclaration) {
 * 				thisType = c.getDeclaredTypeOfClassOrInterface(c.getSymbolOfDeclaration(node)).AsInterfaceType().thisType
 * 			}
 * 			if thisType != nil {
 * 				return append(outerAndOwnTypeParameters, thisType)
 * 			}
 * 			return outerAndOwnTypeParameters
 * 		}
 * 	}
 * }
 */
export function Checker_getOuterTypeParameters(receiver: GoPtr<Checker>, node: GoPtr<Node>, includeThisTypes: bool): GoSlice<GoPtr<Type>> {
  let cur = node;
  for (;;) {
    cur = cur!.Parent;
    if (cur === undefined) {
      return [];
    }
    const kind = cur!.Kind;
    switch (kind) {
      case KindClassDeclaration:
      case KindClassExpression:
      case KindInterfaceDeclaration:
      case KindCallSignature:
      case KindConstructSignature:
      case KindMethodSignature:
      case KindFunctionType:
      case KindConstructorType:
      case KindFunctionDeclaration:
      case KindMethodDeclaration:
      case KindFunctionExpression:
      case KindArrowFunction:
      case KindTypeAliasDeclaration:
      case KindJSTypeAliasDeclaration:
      case KindMappedType:
      case KindConditionalType: {
        const outerTypeParameters = Checker_getOuterTypeParameters(receiver, cur, includeThisTypes);
        if ((kind === KindFunctionExpression || kind === KindArrowFunction || IsObjectLiteralMethod(cur)) && Checker_isContextSensitive(receiver, cur)) {
          const signature = core.FirstOrNil(Checker_getSignaturesOfType(receiver, Checker_getTypeOfSymbol(receiver, Checker_getSymbolOfDeclaration(receiver, cur)), SignatureKindCall));
          if (signature !== undefined && (signature!.typeParameters ?? []).length !== 0) {
            return [...(outerTypeParameters ?? []), ...signature!.typeParameters!] as GoSlice<GoPtr<Type>>;
          }
        }
        if (kind === KindMappedType) {
          return [...(outerTypeParameters ?? []), Checker_getDeclaredTypeOfTypeParameter(receiver, Checker_getSymbolOfDeclaration(receiver, AsMappedTypeNode(cur)!.TypeParameter))] as GoSlice<GoPtr<Type>>;
        }
        if (kind === KindConditionalType) {
          return [...(outerTypeParameters ?? []), ...(Checker_getInferTypeParameters(receiver, cur) ?? [])] as GoSlice<GoPtr<Type>>;
        }
        const outerAndOwnTypeParameters = Checker_appendTypeParameters(receiver, outerTypeParameters, Node_TypeParameters(cur) ?? []);
        let thisType: GoPtr<Type> = undefined;
        if (includeThisTypes && (kind === KindClassDeclaration || kind === KindClassExpression || kind === KindInterfaceDeclaration)) {
          thisType = Type_AsInterfaceType(Checker_getDeclaredTypeOfClassOrInterface(receiver, Checker_getSymbolOfDeclaration(receiver, cur)))!.thisType;
        }
        if (thisType !== undefined) {
          return [...(outerAndOwnTypeParameters ?? []), thisType] as GoSlice<GoPtr<Type>>;
        }
        return outerAndOwnTypeParameters;
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getInferTypeParameters","kind":"method","status":"implemented","sigHash":"ae4a3da196ac2ebc4baa6500b53dd9f982a9c81863dadfdeefbfa7354fd13293","bodyHash":"2f93969eaff0986888500ab889979775692df95ee581fe79f379d07ed215bc02"}
 *
 * Go source:
 * func (c *Checker) getInferTypeParameters(node *ast.Node) []*Type {
 * 	var result []*Type
 * 	for _, symbol := range node.Locals() {
 * 		if symbol.Flags&ast.SymbolFlagsTypeParameter != 0 {
 * 			result = append(result, c.getDeclaredTypeOfSymbol(symbol))
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Checker_getInferTypeParameters(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoSlice<GoPtr<Type>> {
  let result: GoSlice<GoPtr<Type>> = [];
  const locals = Node_Locals(node);
  if (locals === undefined) {
    return result;
  }
  for (const symbol_ of locals.values()) {
    if ((symbol_!.Flags & SymbolFlagsTypeParameter) !== 0) {
      result = [...(result ?? []), Checker_getDeclaredTypeOfSymbol(receiver, symbol_)];
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getLocalTypeParametersOfClassOrInterfaceOrTypeAlias","kind":"method","status":"implemented","sigHash":"7a0112a7749769d792f20d38284288b41a8ec9fa3587ec98b9a611e9d4b84fce","bodyHash":"4e1cca8b358b4281320040a26e5f61a86ddacceda43e4ba0e40cc990440f2c62"}
 *
 * Go source:
 * func (c *Checker) getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(symbol *ast.Symbol) []*Type {
 * 	return c.appendLocalTypeParametersOfClassOrInterfaceOrTypeAlias(nil, symbol)
 * }
 */
export function Checker_getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Type>> {
  return Checker_appendLocalTypeParametersOfClassOrInterfaceOrTypeAlias(receiver, [], symbol_);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.appendLocalTypeParametersOfClassOrInterfaceOrTypeAlias","kind":"method","status":"implemented","sigHash":"0e49f06fd5f213428d2abe5e9ea2367a9a532cba05b0e51fc627c7125d85d4bf","bodyHash":"a2f2f5edeec1360c3a089213bc17b0316e5eb96c585675f77e6f37ea08517844"}
 *
 * Go source:
 * func (c *Checker) appendLocalTypeParametersOfClassOrInterfaceOrTypeAlias(types []*Type, symbol *ast.Symbol) []*Type {
 * 	for _, node := range symbol.Declarations {
 * 		if ast.NodeKindIs(node, ast.KindInterfaceDeclaration, ast.KindClassDeclaration, ast.KindClassExpression) || isTypeAlias(node) {
 * 			types = c.appendTypeParameters(types, node.TypeParameters())
 * 		}
 * 	}
 * 	return types
 * }
 */
export function Checker_appendLocalTypeParametersOfClassOrInterfaceOrTypeAlias(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Type>> {
  let result = types;
  for (const node of symbol_!.Declarations ?? []) {
    if (NodeKindIs(node, KindInterfaceDeclaration, KindClassDeclaration, KindClassExpression) || isTypeAlias(node)) {
      result = Checker_appendTypeParameters(receiver, result, Node_TypeParameters(node) ?? []);
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.appendTypeParameters","kind":"method","status":"implemented","sigHash":"f4e38d4712e988514013611c2d3951fd2e2da259de5cf252b8bb5f1a372b9c93","bodyHash":"0af75b265bfbbce3922236c202e7c2bf244e15c77700fcfbc75f6027c0bf7780"}
 *
 * Go source:
 * func (c *Checker) appendTypeParameters(typeParameters []*Type, declarations []*ast.Node) []*Type {
 * 	for _, declaration := range declarations {
 * 		typeParameters = core.AppendIfUnique(typeParameters, c.getDeclaredTypeOfTypeParameter(c.getSymbolOfDeclaration(declaration)))
 * 	}
 * 	return typeParameters
 * }
 */
export function Checker_appendTypeParameters(receiver: GoPtr<Checker>, typeParameters: GoSlice<GoPtr<Type>>, declarations: GoSlice<GoPtr<Node>>): GoSlice<GoPtr<Type>> {
  let result = typeParameters;
  for (const declaration of declarations) {
    result = core.AppendIfUnique(result, Checker_getDeclaredTypeOfTypeParameter(receiver, Checker_getSymbolOfDeclaration(receiver, declaration)));
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDeclaredTypeOfTypeParameter","kind":"method","status":"implemented","sigHash":"517fb865feadd036621a14083c0f76a0c689904ac34595e6b33a478857eb4a37","bodyHash":"ea91d572fdeef524ec4c41279a7465f757b124b9d5425854f2437c43dc25db4b"}
 *
 * Go source:
 * func (c *Checker) getDeclaredTypeOfTypeParameter(symbol *ast.Symbol) *Type {
 * 	links := c.declaredTypeLinks.Get(symbol)
 * 	if links.declaredType == nil {
 * 		links.declaredType = c.newTypeParameter(symbol)
 * 	}
 * 	return links.declaredType
 * }
 */
export function Checker_getDeclaredTypeOfTypeParameter(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type> {
  const links = LinkStore_Get<GoPtr<Symbol>, DeclaredTypeLinks>(receiver!.declaredTypeLinks as LinkStore<GoPtr<Symbol>, DeclaredTypeLinks>, symbol_);
  if (links!.declaredType === undefined) {
    links!.declaredType = Checker_newTypeParameter(receiver, symbol_);
  }
  return links!.declaredType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeFromRestTypeNode","kind":"method","status":"implemented","sigHash":"08e670b400d3daf49f6b406f7f799f2e9478374d6762599fcfab3a259c940e13","bodyHash":"02396b1fe1309a8c8a7c917de20deccd9d3ce6076ab6994e84bf83829e54e726"}
 *
 * Go source:
 * func (c *Checker) getTypeFromRestTypeNode(node *ast.Node) *Type {
 * 	typeNode := node.Type()
 * 	elementTypeNode := c.getArrayElementTypeNode(typeNode)
 * 	if elementTypeNode != nil {
 * 		typeNode = elementTypeNode
 * 	}
 * 	return c.getTypeFromTypeNode(typeNode)
 * }
 */
export function Checker_getTypeFromRestTypeNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  let typeNode = Node_Type(node);
  const elementTypeNode = Checker_getArrayElementTypeNode(receiver, typeNode);
  if (elementTypeNode !== undefined) {
    typeNode = elementTypeNode;
  }
  return Checker_getTypeFromTypeNode(receiver, typeNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getRestrictiveTypeParameter","kind":"method","status":"implemented","sigHash":"b1004dce8902aef8a198db32c0d8195c4fa76710d00be3b9e79188ab4864a66a","bodyHash":"e7ea530b7d8c0dd6a950e9d3100a4a0fbdd648044e2438ea6b97eeae6bfe80db"}
 *
 * Go source:
 * func (c *Checker) getRestrictiveTypeParameter(t *Type) *Type {
 * 	if t.AsTypeParameter().constraint == nil && c.getConstraintDeclaration(t) == nil || t.AsTypeParameter().constraint == c.noConstraintType {
 * 		return t
 * 	}
 * 	key := CachedTypeKey{kind: CachedTypeKindRestrictiveTypeParameter, typeId: t.id}
 * 	if cached := c.cachedTypes[key]; cached != nil {
 * 		return cached
 * 	}
 * 	result := c.newTypeParameter(t.symbol)
 * 	result.AsTypeParameter().constraint = c.noConstraintType
 * 	c.cachedTypes[key] = result
 * 	return result
 * }
 */
export function Checker_getRestrictiveTypeParameter(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  const typeParameter = Type_AsTypeParameter(t);
  if ((typeParameter!.constraint === undefined && Checker_getConstraintDeclaration(receiver, t) === undefined) || typeParameter!.constraint === receiver!.noConstraintType) {
    return t;
  }
  const key: CachedTypeKey = { kind: CachedTypeKindRestrictiveTypeParameter, typeId: t!.id };
  const cached = receiver!.cachedTypes.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const result = Checker_newTypeParameter(receiver, t!.symbol);
  Type_AsTypeParameter(result)!.constraint = receiver!.noConstraintType;
  receiver!.cachedTypes.set(key, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getRestTypeOfTupleType","kind":"method","status":"implemented","sigHash":"7e9a7bf280d0732c5caf1eb7d8891b3925c7af54257bb9117f4e450825e077e6","bodyHash":"1f02df0478b071fb567852cdd0f0fb6e031afc42488e0e9a95952aa79456d398"}
 *
 * Go source:
 * func (c *Checker) getRestTypeOfTupleType(t *Type) *Type {
 * 	return c.getElementTypeOfSliceOfTupleType(t, t.TargetTupleType().fixedLength, 0, false, false)
 * }
 */
export function Checker_getRestTypeOfTupleType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  return Checker_getElementTypeOfSliceOfTupleType(receiver, t, Type_TargetTupleType(t)!.fixedLength, 0, false, false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getUniqueLiteralTypeForTypeParameter","kind":"method","status":"implemented","sigHash":"84c895977e842a54d52f2ad2b0ae42e30c39bc9e34207e7acf16acca80925fe1","bodyHash":"46ec2e6eeadfac026d355074f82adb94159cffe76d739773153f0ea20186e659"}
 *
 * Go source:
 * func (c *Checker) getUniqueLiteralTypeForTypeParameter(t *Type) *Type {
 * 	if t.flags&TypeFlagsTypeParameter != 0 {
 * 		return c.uniqueLiteralType
 * 	}
 * 	return t
 * }
 */
export function Checker_getUniqueLiteralTypeForTypeParameter(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  if ((t!.flags & TypeFlagsTypeParameter) !== 0) {
    return receiver!.uniqueLiteralType;
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newTypeParameter","kind":"method","status":"implemented","sigHash":"2a29c57fac2bfff1773b35cf041820c22cb927e065a0ac7b69e39020c02f3384","bodyHash":"59f6d41ef6f559056225b74d74726b0798a5f1753da455846f1f85845c5774ca"}
 *
 * Go source:
 * func (c *Checker) newTypeParameter(symbol *ast.Symbol) *Type {
 * 	t := c.newType(TypeFlagsTypeParameter, ObjectFlagsNone, &TypeParameter{})
 * 	t.symbol = symbol
 * 	return t
 * }
 */
export function Checker_newTypeParameter(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type> {
  const data = {
    resolvedBaseConstraint: undefined,
    constraint: undefined,
    target: undefined,
    mapper: undefined,
    isThisType: false,
    resolvedDefaultType: undefined,
  } as unknown as TypeParameter & ConstrainedType;
  const t = Checker_newType(receiver, TypeFlagsTypeParameter, ObjectFlagsNone, data as unknown as TypeData);
  t!["symbol"] = symbol_;
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newSignature","kind":"method","status":"implemented","sigHash":"0705401fb9577a843532c59e2aa1c1a769ceeffe13f757fde471312170e710eb","bodyHash":"c1ceb9b79769bfb204097068fee384def9051c14b159f4337db02fc78bcbe454"}
 *
 * Go source:
 * func (c *Checker) newSignature(flags SignatureFlags, declaration *ast.Node, typeParameters []*Type, thisParameter *ast.Symbol, parameters []*ast.Symbol, resolvedReturnType *Type, resolvedTypePredicate *TypePredicate, minArgumentCount int) *Signature {
 * 	sig := c.signatureArena.New()
 * 	sig.flags = flags
 * 	sig.declaration = declaration
 * 	sig.typeParameters = typeParameters
 * 	sig.parameters = parameters
 * 	sig.thisParameter = thisParameter
 * 	sig.resolvedReturnType = resolvedReturnType
 * 	sig.resolvedTypePredicate = resolvedTypePredicate
 * 	sig.minArgumentCount = int32(minArgumentCount)
 * 	sig.resolvedMinArgumentCount = -1
 * 	return sig
 * }
 */
export function Checker_newSignature(receiver: GoPtr<Checker>, flags: SignatureFlags, declaration: GoPtr<Node>, typeParameters: GoSlice<GoPtr<Type>>, thisParameter: GoPtr<Symbol>, parameters: GoSlice<GoPtr<Symbol>>, resolvedReturnType: GoPtr<Type>, resolvedTypePredicate: GoPtr<TypePredicate>, minArgumentCount: int): GoPtr<Signature> {
  const sig = Arena_New(receiver!.signatureArena) as GoPtr<Signature>;
  sig!.flags = flags;
  sig!.declaration = declaration;
  sig!.typeParameters = typeParameters;
  sig!.parameters = parameters ?? [] as GoSlice<GoPtr<Symbol>>;
  sig!.thisParameter = thisParameter;
  sig!.resolvedReturnType = resolvedReturnType;
  sig!.resolvedTypePredicate = resolvedTypePredicate;
  sig!.minArgumentCount = minArgumentCount as int;
  sig!.resolvedMinArgumentCount = -1;
  return sig;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSuggestionForNonexistentIndexSignature","kind":"method","status":"implemented","sigHash":"7fa94a79522b003108f57cc105a2a11840a6223a896d83ce9f25d56a44020030","bodyHash":"c6cca2f33dbbef337794d36ff4f62bd5108ddca7ba1c01e69ca70b8fd474343a"}
 *
 * Go source:
 * func (c *Checker) getSuggestionForNonexistentIndexSignature(objectType *Type, expr *ast.Node, keyedType *Type) string {
 * 	// check if object type has setter or getter
 * 	hasProp := func(name string) bool {
 * 		prop := c.getPropertyOfObjectType(objectType, name)
 * 		if prop != nil {
 * 			s := c.getSingleCallSignature(c.getTypeOfSymbol(prop))
 * 			return s != nil && c.getMinArgumentCount(s) >= 1 && c.isTypeAssignableTo(keyedType, c.getTypeAtPosition(s, 0))
 * 		}
 * 		return false
 * 	}
 * 	suggestedMethod := core.IfElse(ast.IsAssignmentTarget(expr), "set", "get")
 * 	if !hasProp(suggestedMethod) {
 * 		return ""
 * 	}
 * 	suggestion := tryGetPropertyAccessOrIdentifierToString(expr.Expression())
 * 	if suggestion == "" {
 * 		return suggestedMethod
 * 	}
 * 	return suggestion + "." + suggestedMethod
 * }
 */
export function Checker_getSuggestionForNonexistentIndexSignature(receiver: GoPtr<Checker>, objectType: GoPtr<Type>, expr: GoPtr<Node>, keyedType: GoPtr<Type>): string {
  const hasProp = (name: string): bool => {
    const prop = Checker_getPropertyOfObjectType(receiver, objectType, name);
    if (prop !== undefined) {
      const s = Checker_getSingleCallSignature(receiver, Checker_getTypeOfSymbol(receiver, prop));
      return s !== undefined && Checker_getMinArgumentCount(receiver, s) >= 1 && Checker_isTypeAssignableTo(receiver, keyedType, Checker_getTypeAtPosition(receiver, s, 0));
    }
    return false;
  };
  const suggestedMethod = core.IfElse(IsAssignmentTarget(expr), "set", "get");
  if (!hasProp(suggestedMethod)) {
    return "";
  }
  const suggestion = tryGetPropertyAccessOrIdentifierToString(Node_Expression(expr));
  if (suggestion === "") {
    return suggestedMethod;
  }
  return suggestion + "." + suggestedMethod;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isThisPropertyAccessInConstructor","kind":"method","status":"implemented","sigHash":"b871ed063e29e790d9c40c894aca2df6f9af760186a50895e4e4f5e65a814c9e","bodyHash":"c94f50ab5b23f0527118383b2c6799e27d777e7df8d6c80e25ada2f7859f2686"}
 *
 * Go source:
 * func (c *Checker) isThisPropertyAccessInConstructor(node *ast.Node, prop *ast.Symbol) bool {
 * 	var constructor *ast.Node
 * 	if kind, location := c.isConstructorDeclaredThisProperty(prop); kind == thisAssignmentDeclarationConstructor {
 * 		constructor = location
 * 	} else if isThisProperty(node) && c.isAutoTypedProperty(prop) {
 * 		constructor = c.getDeclaringConstructor(prop)
 * 	}
 * 	return ast.GetThisContainer(node, true /*includeArrowFunctions* /, false /*includeClassComputedPropertyName* /) == constructor
 * }
 */
export function Checker_isThisPropertyAccessInConstructor(receiver: GoPtr<Checker>, node: GoPtr<Node>, prop: GoPtr<Symbol>): bool {
  let constructor: GoPtr<Node> = undefined;
  const [kind, location] = Checker_isConstructorDeclaredThisProperty(receiver, prop);
  if (kind === thisAssignmentDeclarationConstructor) {
    constructor = location;
  } else if (isThisProperty(node) && Checker_isAutoTypedProperty(receiver, prop)) {
    constructor = Checker_getDeclaringConstructor(receiver, prop);
  }
  return GetThisContainer(node, true, false) === constructor;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDeclaringConstructor","kind":"method","status":"implemented","sigHash":"bd91440e14fcf77953406a37832c5355497ed517064245d102397538a0835ba7","bodyHash":"8d9ba3562f06af39c2a2f9d8d4bf6606537748c66a21035d84e0f959418af9dc"}
 *
 * Go source:
 * func (c *Checker) getDeclaringConstructor(symbol *ast.Symbol) *ast.Node {
 * 	for _, declaration := range symbol.Declarations {
 * 		container := ast.GetThisContainer(declaration, false /*includeArrowFunctions* /, false /*includeClassComputedPropertyName* /)
 * 		if container != nil && ast.IsConstructorDeclaration(container) {
 * 			return container
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getDeclaringConstructor(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Node> {
  for (const declaration of symbol_!.Declarations ?? []) {
    const container = GetThisContainer(declaration, false, false);
    if (container !== undefined && IsConstructorDeclaration(container)) {
      return container;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isStringIndexSignatureOnlyTypeWorker","kind":"method","status":"implemented","sigHash":"33c0e745dee09b50d3bf0820f13a098d31c25acb6ca51f0b236a12bed9c4e496","bodyHash":"a3831e954ab599e57e530d6421678eb2b2ce377b24f169f81602f99a21f3d4cc"}
 *
 * Go source:
 * func (c *Checker) isStringIndexSignatureOnlyTypeWorker(t *Type) bool {
 * 	return t.flags&TypeFlagsObject != 0 && !c.isGenericMappedType(t) && len(c.getPropertiesOfType(t)) == 0 && len(c.getIndexInfosOfType(t)) == 1 && c.getIndexInfoOfType(t, c.stringType) != nil ||
 * 		t.flags&TypeFlagsUnionOrIntersection != 0 && core.Every(t.Types(), c.isStringIndexSignatureOnlyType)
 * }
 */
export function Checker_isStringIndexSignatureOnlyTypeWorker(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  return ((t!.flags & TypeFlagsObject) !== 0 &&
    !Checker_isGenericMappedType(receiver, t) &&
    Checker_getPropertiesOfType(receiver, t).length === 0 &&
    Checker_getIndexInfosOfType(receiver, t).length === 1 &&
    Checker_getIndexInfoOfType(receiver, t, receiver!.stringType) !== undefined) ||
    ((t!.flags & TypeFlagsUnionOrIntersection) !== 0 && core.Every(Type_Types(t), (type_: GoPtr<Type>) => receiver!.isStringIndexSignatureOnlyType(type_)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.expandSignatureParametersWithTupleMembers","kind":"method","status":"implemented","sigHash":"8bd7d98d36cfcdfbb40c520d56b7500e30739ae0812609bee9823102687ecaf0","bodyHash":"57b615e304df4f92588385cd39bdb22f6d66f47eabbd6bc61cad5accd515d4f1"}
 *
 * Go source:
 * func (c *Checker) expandSignatureParametersWithTupleMembers(signature *Signature, restType *TypeReference, restIndex int, restSymbol *ast.Symbol) []*ast.Symbol {
 * 	elementTypes := c.getTypeArguments(restType.AsType())
 * 	elementInfos := restType.TargetTupleType().elementInfos
 * 	associatedNames := c.getUniqAssociatedNamesFromTupleType(restType, restSymbol)
 * 	expanded := append(make([]*ast.Symbol, 0, restIndex+len(elementTypes)), signature.parameters[:restIndex]...)
 * 	for i, t := range elementTypes {
 * 		flags := elementInfos[i].flags
 * 		checkFlags := ast.CheckFlagsNone
 * 		switch {
 * 		case flags&ElementFlagsVariable != 0:
 * 			checkFlags = ast.CheckFlagsRestParameter
 * 		case flags&ElementFlagsOptional != 0:
 * 			checkFlags = ast.CheckFlagsOptionalParameter
 * 		}
 * 		symbol := c.newSymbolEx(ast.SymbolFlagsFunctionScopedVariable, associatedNames[i], checkFlags)
 * 		links := c.valueSymbolLinks.Get(symbol)
 * 		if flags&ElementFlagsRest != 0 {
 * 			links.resolvedType = c.createArrayType(t)
 * 		} else {
 * 			links.resolvedType = t
 * 		}
 * 		expanded = append(expanded, symbol)
 * 	}
 * 	return expanded
 * }
 */
export function Checker_expandSignatureParametersWithTupleMembers(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, restType: GoPtr<TypeReference>, restIndex: int, restSymbol: GoPtr<Symbol>): GoSlice<GoPtr<Symbol>> {
  const restTypeAsType = restType!.__tsgoEmbedded0!.__tsgoEmbedded0!.__tsgoEmbedded0!.__tsgoEmbedded0!.__tsgoEmbedded0;
  const elementTypes = Checker_getTypeArguments(receiver, restTypeAsType);
  const elementInfos = Type_TargetTupleType(restTypeAsType)!.elementInfos;
  const associatedNames = Checker_getUniqAssociatedNamesFromTupleType(receiver, restType, restSymbol);
  const expanded = signature!.parameters.slice(0, restIndex) as GoSlice<GoPtr<Symbol>>;
  for (let i = 0; i < elementTypes.length; i++) {
    const type_ = elementTypes[i];
    const flags = elementInfos[i]!.flags;
    let checkFlags = CheckFlagsNone;
    if ((flags & ElementFlagsVariable) !== 0) {
      checkFlags = CheckFlagsRestParameter;
    } else if ((flags & ElementFlagsOptional) !== 0) {
      checkFlags = CheckFlagsOptionalParameter;
    }
    const symbol_ = Checker_newSymbolEx(receiver, SymbolFlagsFunctionScopedVariable, associatedNames[i]!, checkFlags);
    const links = LinkStore_Get(receiver!.valueSymbolLinks, symbol_) as GoPtr<ValueSymbolLinks>;
    if ((flags & ElementFlagsRest) !== 0) {
      links!.resolvedType = Checker_createArrayType(receiver, type_);
    } else {
      links!.resolvedType = type_;
    }
    expanded.push(symbol_);
  }
  return expanded;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.typeHasCallOrConstructSignatures","kind":"method","status":"implemented","sigHash":"a71ef1b0cae83f47fc8b35ddc24a9369f61af582ffc01d0dd6678d191e39f627","bodyHash":"b27747d8851b513b451e4cc5c967bd373e1b847c5cc27fa7b72cf0734ce32d06"}
 *
 * Go source:
 * func (c *Checker) typeHasCallOrConstructSignatures(t *Type) bool {
 * 	return t.flags&TypeFlagsStructuredType != 0 && len(c.resolveStructuredTypeMembers(t).signatures) != 0
 * }
 */
export function Checker_typeHasCallOrConstructSignatures(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  return (t!.flags & TypeFlagsStructuredType) !== 0 && Checker_resolveStructuredTypeMembers(receiver, t)!.signatures.length !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getParameterTypeNodeForDecoratorCheck","kind":"method","status":"implemented","sigHash":"021354f7072638b3c19a8458e7e01d7762efcb2666a970ccc06c41e972c07d2a","bodyHash":"02e1f661fa365598ee35588a5354cfecb7a87611b069569713dd363d6f7c66eb"}
 *
 * Go source:
 * func (c *Checker) getParameterTypeNodeForDecoratorCheck(node *ast.ParameterDeclarationNode) *ast.Node {
 * 	typeNode := node.Type()
 * 	if node.AsParameterDeclaration().DotDotDotToken != nil {
 * 		return ast.GetRestParameterElementType(typeNode)
 * 	}
 * 	return typeNode
 * }
 */
export function Checker_getParameterTypeNodeForDecoratorCheck(receiver: GoPtr<Checker>, node: GoPtr<ParameterDeclarationNode>): GoPtr<Node> {
  const typeNode = Node_Type(node);
  if (AsParameterDeclaration(node)!.DotDotDotToken !== undefined) {
    return GetRestParameterElementType(typeNode);
  }
  return typeNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfFirstParameterOfSignature","kind":"method","status":"implemented","sigHash":"5b1f7294d6e14af0a7470e029f2b696a71b118352887b0b2af5df13fc7939620","bodyHash":"1dae2ddf7683b15a98f556c033c6a708e6d5cd001687fcbef765925624e4bef3"}
 *
 * Go source:
 * func (c *Checker) getTypeOfFirstParameterOfSignature(signature *Signature) *Type {
 * 	return c.getTypeOfFirstParameterOfSignatureWithFallback(signature, c.neverType)
 * }
 */
export function Checker_getTypeOfFirstParameterOfSignature(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): GoPtr<Type> {
  return Checker_getTypeOfFirstParameterOfSignatureWithFallback(receiver, signature, receiver!.neverType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfFirstParameterOfSignatureWithFallback","kind":"method","status":"implemented","sigHash":"614e7b7a906ea75cf49240823cb5c160d26d33267825014a6024ebf9d73f1895","bodyHash":"74ed37c036874c3ca48cb5772f5f78469eff82750ff7fab34621c34945f8e1db"}
 *
 * Go source:
 * func (c *Checker) getTypeOfFirstParameterOfSignatureWithFallback(signature *Signature, fallbackType *Type) *Type {
 * 	if len(signature.parameters) > 0 {
 * 		return c.getTypeAtPosition(signature, 0)
 * 	}
 * 	return fallbackType
 * }
 */
export function Checker_getTypeOfFirstParameterOfSignatureWithFallback(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, fallbackType: GoPtr<Type>): GoPtr<Type> {
  if (signature!.parameters.length > 0) {
    return Checker_getTypeAtPosition(receiver, signature, 0);
  }
  return fallbackType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTypeOfPropertyOrIndexSignatureOfType","kind":"method","status":"implemented","sigHash":"f0a1f4dc3c768f56840d581f52987db74d37e03c6b19e04b53acbf7ef3fb19f8","bodyHash":"cdbeba211391c8a0e5f9b277399d2a3b0beff7648dda39690d41c8c79e2292be"}
 *
 * Go source:
 * func (c *Checker) getTypeOfPropertyOrIndexSignatureOfType(t *Type, name string) *Type {
 * 	propType := c.getTypeOfPropertyOfType(t, name)
 * 	if propType != nil {
 * 		return propType
 * 	}
 * 	indexInfo := c.getApplicableIndexInfoForName(t, name)
 * 	if indexInfo != nil {
 * 		return c.addOptionalityEx(indexInfo.valueType, true /*isProperty* /, true /*isOptional* /)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getTypeOfPropertyOrIndexSignatureOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string): GoPtr<Type> {
  const propType = Checker_getTypeOfPropertyOfType(receiver, t, name);
  if (propType !== undefined) {
    return propType;
  }
  const indexInfo = Checker_getApplicableIndexInfoForName(receiver, t, name);
  if (indexInfo !== undefined) {
    return Checker_addOptionalityEx(receiver, indexInfo!.valueType, true, true);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getContextuallyTypedParameterType","kind":"method","status":"implemented","sigHash":"0466ec00b945488770b59dd3d36dd960d7e90c2aed3b87d724c1ac64d4d18bdb","bodyHash":"10316f0efc3742523c276f0359627ea82fcb27807df88d2fc44eb0434f56af0b"}
 *
 * Go source:
 * func (c *Checker) getContextuallyTypedParameterType(parameter *ast.Node) *Type {
 * 	fn := parameter.Parent
 * 	if !c.isContextSensitiveFunctionOrObjectLiteralMethod(fn) {
 * 		return nil
 * 	}
 * 	iife := ast.GetImmediatelyInvokedFunctionExpression(fn)
 * 	if iife != nil {
 * 		args := c.getEffectiveCallArguments(iife)
 * 		indexOfParameter := slices.Index(fn.Parameters(), parameter)
 * 		if hasDotDotDotToken(parameter) {
 * 			return c.getSpreadArgumentType(args, indexOfParameter, len(args), c.anyType, nil /*context* /, CheckModeNormal)
 * 		}
 * 		links := c.signatureLinks.Get(iife)
 * 		cached := links.resolvedSignature
 * 		links.resolvedSignature = c.anySignature
 * 		var t *Type
 * 		switch {
 * 		case indexOfParameter < len(args):
 * 			t = c.getWidenedLiteralType(c.checkExpression(args[indexOfParameter]))
 * 		case parameter.Initializer() != nil:
 * 			t = nil
 * 		default:
 * 			t = c.undefinedWideningType
 * 		}
 * 		links.resolvedSignature = cached
 * 		return t
 * 	}
 * 	contextualSignature := c.getContextualSignature(fn)
 * 	if contextualSignature != nil {
 * 		index := slices.Index(fn.Parameters(), parameter) - core.IfElse(ast.GetThisParameter(fn) != nil, 1, 0)
 * 		if hasDotDotDotToken(parameter) && core.LastOrNil(fn.Parameters()) == parameter {
 * 			return c.getRestTypeAtPosition(contextualSignature, index, false)
 * 		}
 * 		return c.tryGetTypeAtPosition(contextualSignature, index)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getContextuallyTypedParameterType(receiver: GoPtr<Checker>, parameter: GoPtr<Node>): GoPtr<Type> {
  const fn = parameter!.Parent;
  if (!Checker_isContextSensitiveFunctionOrObjectLiteralMethod(receiver, fn)) {
    return undefined;
  }
  const iife = GetImmediatelyInvokedFunctionExpression(fn);
  if (iife !== undefined) {
    const args = Checker_getEffectiveCallArguments(receiver, iife);
    const indexOfParameter = slices.Index(Node_Parameters(fn), parameter);
    if (hasDotDotDotToken(parameter)) {
      return Checker_getSpreadArgumentType(receiver, args, indexOfParameter, args.length, receiver!.anyType, undefined, CheckModeNormal);
    }
    const links = LinkStore_Get(receiver!.signatureLinks, iife) as GoPtr<SignatureLinks>;
    const cached = links!.resolvedSignature;
    links!.resolvedSignature = receiver!.anySignature;
    let t: GoPtr<Type>;
    if (indexOfParameter < args.length) {
      t = Checker_getWidenedLiteralType(receiver, Checker_checkExpression(receiver, args[indexOfParameter]));
    } else if (Node_Initializer(parameter) !== undefined) {
      t = undefined;
    } else {
      t = receiver!.undefinedWideningType;
    }
    links!.resolvedSignature = cached;
    return t;
  }
  const contextualSignature = Checker_getContextualSignature(receiver, fn);
  if (contextualSignature !== undefined) {
    const index = slices.Index(Node_Parameters(fn), parameter) - core.IfElse(GetThisParameter(fn) !== undefined, 1, 0);
    if (hasDotDotDotToken(parameter) && core.LastOrNil(Node_Parameters(fn)) === parameter) {
      return Checker_getRestTypeAtPosition(receiver, contextualSignature, index, false);
    }
    return Checker_tryGetTypeAtPosition(receiver, contextualSignature, index);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSpreadArgumentType","kind":"method","status":"implemented","sigHash":"4e8f6dbb44b876df7d02f68dd625421f501897189f1a55fc170732f038c7dcc2","bodyHash":"f209cac7ead6222449a541eff70fe6b43ac12f8a56a043e0557c3c9b84f3be14"}
 *
 * Go source:
 * func (c *Checker) getSpreadArgumentType(args []*ast.Node, index int, argCount int, restType *Type, context *InferenceContext, checkMode CheckMode) *Type {
 * 	inConstContext := c.isConstTypeVariable(restType, 0)
 * 	if argCount > 0 && index >= argCount-1 {
 * 		arg := args[argCount-1]
 * 		if isSpreadArgument(arg) {
 * 			// We are inferring from a spread expression in the last argument position, i.e. both the parameter
 * 			// and the argument are ...x forms.
 * 			var spreadType *Type
 * 			if ast.IsSyntheticExpression(arg) {
 * 				spreadType = arg.AsSyntheticExpression().Type.(*Type)
 * 			} else {
 * 				spreadType = c.checkExpressionWithContextualType(arg.Expression(), restType, context, checkMode)
 * 			}
 * 			if c.isArrayLikeType(spreadType) {
 * 				return c.getMutableArrayOrTupleType(spreadType)
 * 			}
 * 			if ast.IsSpreadElement(arg) {
 * 				arg = arg.Expression()
 * 			}
 * 			return c.createArrayTypeEx(c.checkIteratedTypeOrElementType(IterationUseSpread, spreadType, c.undefinedType, arg), inConstContext)
 * 		}
 * 	}
 * 	var types []*Type
 * 	var infos []TupleElementInfo
 * 	for i := index; i < argCount; i++ {
 * 		arg := args[i]
 * 		var t *Type
 * 		var info TupleElementInfo
 * 		if isSpreadArgument(arg) {
 * 			var spreadType *Type
 * 			if ast.IsSyntheticExpression(arg) {
 * 				spreadType = arg.AsSyntheticExpression().Type.(*Type)
 * 			} else {
 * 				spreadType = c.checkExpression(arg.Expression())
 * 			}
 * 			if c.isArrayLikeType(spreadType) {
 * 				t = spreadType
 * 				info.flags = ElementFlagsVariadic
 * 			} else {
 * 				if ast.IsSpreadElement(arg) {
 * 					t = c.checkIteratedTypeOrElementType(IterationUseSpread, spreadType, c.undefinedType, arg.Expression())
 * 				} else {
 * 					t = c.checkIteratedTypeOrElementType(IterationUseSpread, spreadType, c.undefinedType, arg)
 * 				}
 * 				info.flags = ElementFlagsRest
 * 			}
 * 		} else {
 * 			var contextualType *Type
 * 			if isTupleType(restType) {
 * 				contextualType = core.OrElse(c.getContextualTypeForElementExpression(restType, i-index, argCount-index, -1, -1), c.unknownType)
 * 			} else {
 * 				contextualType = c.getIndexedAccessTypeEx(restType, c.getNumberLiteralType(jsnum.Number(i-index)), AccessFlagsContextual, nil, nil)
 * 			}
 * 			argType := c.checkExpressionWithContextualType(arg, contextualType, context, checkMode)
 * 			hasPrimitiveContextualType := inConstContext || c.maybeTypeOfKind(contextualType, TypeFlagsPrimitive|TypeFlagsIndex|TypeFlagsTemplateLiteral|TypeFlagsStringMapping)
 * 			if hasPrimitiveContextualType {
 * 				t = c.getRegularTypeOfLiteralType(argType)
 * 			} else {
 * 				t = c.getWidenedLiteralType(argType)
 * 			}
 * 			info.flags = ElementFlagsRequired
 * 		}
 * 		if ast.IsSyntheticExpression(arg) && arg.AsSyntheticExpression().TupleNameSource != nil {
 * 			info.labeledDeclaration = arg.AsSyntheticExpression().TupleNameSource
 * 		}
 * 		types = append(types, t)
 * 		infos = append(infos, info)
 * 	}
 * 	return c.createTupleTypeEx(types, infos, inConstContext && !someType(restType, c.isMutableArrayLikeType))
 * }
 */
export function Checker_getSpreadArgumentType(receiver: GoPtr<Checker>, args: GoSlice<GoPtr<Node>>, index: int, argCount: int, restType: GoPtr<Type>, context: GoPtr<InferenceContext>, checkMode: CheckMode): GoPtr<Type> {
  const inConstContext = Checker_isConstTypeVariable(receiver, restType, 0);
  if (argCount > 0 && index >= argCount - 1) {
    let arg = args[argCount - 1];
    if (isSpreadArgument(arg)) {
      let spreadType: GoPtr<Type>;
      if (IsSyntheticExpression(arg)) {
        spreadType = AsSyntheticExpression(arg)!.Type as GoPtr<Type>;
      } else {
        spreadType = Checker_checkExpressionWithContextualType(receiver, Node_Expression(arg), restType, context, checkMode);
      }
      if (Checker_isArrayLikeType(receiver, spreadType)) {
        return Checker_getMutableArrayOrTupleType(receiver, spreadType);
      }
      if (IsSpreadElement(arg)) {
        arg = Node_Expression(arg);
      }
      return Checker_createArrayTypeEx(receiver, Checker_checkIteratedTypeOrElementType(receiver, IterationUseSpread, spreadType, receiver!.undefinedType, arg), inConstContext);
    }
  }
  const types: GoSlice<GoPtr<Type>> = [];
  const infos: GoSlice<TupleElementInfo> = [];
  for (let argIndex = index; argIndex < argCount; argIndex++) {
    let arg = args[argIndex];
    let t: GoPtr<Type>;
    const info: TupleElementInfo = { flags: ElementFlagsRequired, labeledDeclaration: undefined };
    if (isSpreadArgument(arg)) {
      let spreadType: GoPtr<Type>;
      if (IsSyntheticExpression(arg)) {
        spreadType = AsSyntheticExpression(arg)!.Type as GoPtr<Type>;
      } else {
        spreadType = Checker_checkExpression(receiver, Node_Expression(arg));
      }
      if (Checker_isArrayLikeType(receiver, spreadType)) {
        t = spreadType;
        info.flags = ElementFlagsVariadic;
      } else {
        if (IsSpreadElement(arg)) {
          t = Checker_checkIteratedTypeOrElementType(receiver, IterationUseSpread, spreadType, receiver!.undefinedType, Node_Expression(arg));
        } else {
          t = Checker_checkIteratedTypeOrElementType(receiver, IterationUseSpread, spreadType, receiver!.undefinedType, arg);
        }
        info.flags = ElementFlagsRest;
      }
    } else {
      let contextualType: GoPtr<Type>;
      if (isTupleType(restType)) {
        contextualType = core.OrElse(Checker_getContextualTypeForElementExpression(receiver, restType, argIndex - index, argCount - index, -1, -1), receiver!.unknownType);
      } else {
        contextualType = Checker_getIndexedAccessTypeEx(receiver, restType, Checker_getNumberLiteralType(receiver, argIndex - index), AccessFlagsContextual, undefined, undefined);
      }
      const argType = Checker_checkExpressionWithContextualType(receiver, arg, contextualType, context, checkMode);
      const hasPrimitiveContextualType = inConstContext || Checker_maybeTypeOfKind(receiver, contextualType, TypeFlagsPrimitive | TypeFlagsIndex | TypeFlagsTemplateLiteral | TypeFlagsStringMapping);
      if (hasPrimitiveContextualType) {
        t = Checker_getRegularTypeOfLiteralType(receiver, argType);
      } else {
        t = Checker_getWidenedLiteralType(receiver, argType);
      }
      info.flags = ElementFlagsRequired;
    }
    if (IsSyntheticExpression(arg) && AsSyntheticExpression(arg)!.TupleNameSource !== undefined) {
      info.labeledDeclaration = AsSyntheticExpression(arg)!.TupleNameSource;
    }
    types.push(t);
    infos.push(info);
  }
  return Checker_createTupleTypeEx(receiver, types, infos, inConstContext && !someType(restType, (t: GoPtr<Type>): bool => Checker_isMutableArrayLikeType(receiver, t)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getContextualReturnType","kind":"method","status":"implemented","sigHash":"2500b052ad2750ae701921b1386b8351136a576f52327f4e6f92aa93f2168721","bodyHash":"2b23f71117c04453e8d1948485b2fe7d3aca848ce2593d4b39a86746055a8a33"}
 *
 * Go source:
 * func (c *Checker) getContextualReturnType(functionDecl *ast.Node, contextFlags ContextFlags) *Type {
 * 	// If the containing function has a return type annotation, is a constructor, or is a get accessor whose
 * 	// corresponding set accessor has a type annotation, return statements in the function are contextually typed
 * 	returnType := c.getReturnTypeFromAnnotation(functionDecl)
 * 	if returnType != nil {
 * 		return returnType
 * 	}
 * 	// Otherwise, if the containing function is contextually typed by a function type with exactly one call signature
 * 	// and that call signature is non-generic, return statements are contextually typed by the return type of the signature
 * 	signature := c.getContextualSignatureForFunctionLikeDeclaration(functionDecl)
 * 	if signature != nil && !c.isResolvingReturnTypeOfSignature(signature) {
 * 		returnType := c.getReturnTypeOfSignature(signature)
 * 		functionFlags := ast.GetFunctionFlags(functionDecl)
 * 		if functionFlags&ast.FunctionFlagsGenerator != 0 {
 * 			return c.filterType(returnType, func(t *Type) bool {
 * 				return t.flags&(TypeFlagsAnyOrUnknown|TypeFlagsVoid|TypeFlagsInstantiableNonPrimitive) != 0 || c.checkGeneratorInstantiationAssignabilityToReturnType(t, functionFlags, nil /*errorNode* /)
 * 			})
 * 		}
 * 		if functionFlags&ast.FunctionFlagsAsync != 0 {
 * 			return c.filterType(returnType, func(t *Type) bool {
 * 				return t.flags&(TypeFlagsAnyOrUnknown|TypeFlagsVoid|TypeFlagsInstantiableNonPrimitive) != 0 || c.getAwaitedTypeOfPromise(t) != nil
 * 			})
 * 		}
 * 		return returnType
 * 	}
 * 	iife := ast.GetImmediatelyInvokedFunctionExpression(functionDecl)
 * 	if iife != nil {
 * 		return c.getContextualType(iife, contextFlags)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getContextualReturnType(receiver: GoPtr<Checker>, functionDecl: GoPtr<Node>, contextFlags: ContextFlags): GoPtr<Type> {
  const annotatedReturnType = Checker_getReturnTypeFromAnnotation(receiver, functionDecl);
  if (annotatedReturnType !== undefined) {
    return annotatedReturnType;
  }
  const signature = Checker_getContextualSignatureForFunctionLikeDeclaration(receiver, functionDecl);
  if (signature !== undefined && !Checker_isResolvingReturnTypeOfSignature(receiver, signature)) {
    const returnType = Checker_getReturnTypeOfSignature(receiver, signature);
    const functionFlags = GetFunctionFlags(functionDecl);
    if ((functionFlags & FunctionFlagsGenerator) !== 0) {
      return Checker_filterType(receiver, returnType, (type_: GoPtr<Type>): bool =>
        (((type_!.flags & (TypeFlagsAnyOrUnknown | TypeFlagsVoid | TypeFlagsInstantiableNonPrimitive)) !== 0) ||
          Checker_checkGeneratorInstantiationAssignabilityToReturnType(receiver, type_, functionFlags, undefined)) as bool);
    }
    if ((functionFlags & FunctionFlagsAsync) !== 0) {
      return Checker_filterType(receiver, returnType, (type_: GoPtr<Type>): bool =>
        (((type_!.flags & (TypeFlagsAnyOrUnknown | TypeFlagsVoid | TypeFlagsInstantiableNonPrimitive)) !== 0) ||
          Checker_getAwaitedTypeOfPromise(receiver, type_) !== undefined) as bool);
    }
    return returnType;
  }
  const iife = GetImmediatelyInvokedFunctionExpression(functionDecl);
  if (iife !== undefined) {
    return Checker_getContextualType(receiver, iife, contextFlags);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkGeneratorInstantiationAssignabilityToReturnType","kind":"method","status":"implemented","sigHash":"5ba5dd9a6e43b6b5c554e9b8c7fc492a7edd26fd4f49aa7a1d54dd5a76ad2933","bodyHash":"a78858bbd7d1c28763a99ae054980a0885b68973abf8076c5233fd9a604a676d"}
 *
 * Go source:
 * func (c *Checker) checkGeneratorInstantiationAssignabilityToReturnType(returnType *Type, functionFlags ast.FunctionFlags, errorNode *ast.Node) bool {
 * 	// Naively, one could check that Generator<any, any, any> is assignable to the return type annotation.
 * 	// However, that would not catch the error in the following case.
 * 	//
 * 	//    interface BadGenerator extends Iterable<number>, Iterator<string> { }
 * 	//    function* g(): BadGenerator { } // Iterable and Iterator have different types!
 * 	//
 * 	generatorYieldType := core.OrElse(c.getIterationTypeOfGeneratorFunctionReturnType(IterationTypeKindYield, returnType, (functionFlags&ast.FunctionFlagsAsync) != 0), c.anyType)
 * 	generatorReturnType := core.OrElse(c.getIterationTypeOfGeneratorFunctionReturnType(IterationTypeKindReturn, returnType, (functionFlags&ast.FunctionFlagsAsync) != 0), generatorYieldType)
 * 	generatorNextType := core.OrElse(c.getIterationTypeOfGeneratorFunctionReturnType(IterationTypeKindNext, returnType, (functionFlags&ast.FunctionFlagsAsync) != 0), c.unknownType)
 * 	generatorInstantiation := c.createGeneratorType(generatorYieldType, generatorReturnType, generatorNextType, functionFlags&ast.FunctionFlagsAsync != 0)
 * 	return c.checkTypeAssignableTo(generatorInstantiation, returnType, errorNode, nil)
 * }
 */
export function Checker_checkGeneratorInstantiationAssignabilityToReturnType(receiver: GoPtr<Checker>, returnType: GoPtr<Type>, functionFlags: FunctionFlags, errorNode: GoPtr<Node>): bool {
  const isAsyncGenerator = (functionFlags & FunctionFlagsAsync) !== 0;
  const generatorYieldType = core.OrElse(Checker_getIterationTypeOfGeneratorFunctionReturnType(receiver, IterationTypeKindYield, returnType, isAsyncGenerator), receiver!.anyType);
  const generatorReturnType = core.OrElse(Checker_getIterationTypeOfGeneratorFunctionReturnType(receiver, IterationTypeKindReturn, returnType, isAsyncGenerator), generatorYieldType);
  const generatorNextType = core.OrElse(Checker_getIterationTypeOfGeneratorFunctionReturnType(receiver, IterationTypeKindNext, returnType, isAsyncGenerator), receiver!.unknownType);
  const generatorInstantiation = Checker_createGeneratorType(receiver, generatorYieldType, generatorReturnType, generatorNextType, isAsyncGenerator);
  return Checker_checkTypeAssignableTo(receiver, generatorInstantiation, returnType, errorNode, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getContextualSignatureForFunctionLikeDeclaration","kind":"method","status":"implemented","sigHash":"35758be4620771266ab25f1da378b6ade26818064b82230598f59dd70c81ed75","bodyHash":"616597e141bea3868bc97cdb0e80887b8157c87dd4e8abdd447b158323b9913f"}
 *
 * Go source:
 * func (c *Checker) getContextualSignatureForFunctionLikeDeclaration(node *ast.Node) *Signature {
 * 	// Only function expressions, arrow functions, and object literal methods are contextually typed.
 * 	if ast.IsFunctionExpressionOrArrowFunction(node) || ast.IsObjectLiteralMethod(node) {
 * 		return c.getContextualSignature(node)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getContextualSignatureForFunctionLikeDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Signature> {
  if (IsFunctionExpressionOrArrowFunction(node) || IsObjectLiteralMethod(node)) {
    return Checker_getContextualSignature(receiver, node);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getContextualTypeForArgument","kind":"method","status":"implemented","sigHash":"e66ab742087a328f0f2c9c460fea0b41419b6ac5f0b5f2fc57f97fb2bf33bcaa","bodyHash":"8ec39697eb5d991bd807bc2d25542c15b38d8e95fc7c3de046529421e707772f"}
 *
 * Go source:
 * func (c *Checker) getContextualTypeForArgument(callTarget *ast.Node, arg *ast.Node) *Type {
 * 	args := c.getEffectiveCallArguments(callTarget)
 * 	argIndex := slices.Index(args, arg)
 * 	// -1 for e.g. the expression of a CallExpression, or the tag of a TaggedTemplateExpression
 * 	if argIndex == -1 {
 * 		return nil
 * 	}
 * 	return c.getContextualTypeForArgumentAtIndex(callTarget, argIndex)
 * }
 */
export function Checker_getContextualTypeForArgument(receiver: GoPtr<Checker>, callTarget: GoPtr<Node>, arg: GoPtr<Node>): GoPtr<Type> {
  const args = Checker_getEffectiveCallArguments(receiver, callTarget);
  const argIndex = slices.Index(args, arg);
  if (argIndex === -1) {
    return undefined;
  }
  return Checker_getContextualTypeForArgumentAtIndex(receiver, callTarget, argIndex);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getContextualTypeForArgumentAtIndex","kind":"method","status":"implemented","sigHash":"f848375396a19a264e7787c95d8b737b2fd157a30580e8d9991c7edd2cd3f3d4","bodyHash":"aa75a2d426e6cdafa69aa108f2621fb77db3321788997a765695cbe91e345ad0"}
 *
 * Go source:
 * func (c *Checker) getContextualTypeForArgumentAtIndex(callTarget *ast.Node, argIndex int) *Type {
 * 	if ast.IsImportCall(callTarget) {
 * 		switch {
 * 		case argIndex == 0:
 * 			return c.stringType
 * 		case argIndex == 1:
 * 			return c.getGlobalImportCallOptionsType()
 * 		default:
 * 			return c.anyType
 * 		}
 * 	}
 * 	// If we're already in the process of resolving the given signature, don't resolve again as
 * 	// that could cause infinite recursion. Instead, return anySignature.
 * 	var signature *Signature
 * 	if c.signatureLinks.Get(callTarget).resolvedSignature == c.resolvingSignature {
 * 		signature = c.resolvingSignature
 * 	} else {
 * 		signature = c.getResolvedSignature(callTarget, nil, CheckModeNormal)
 * 	}
 * 	if ast.IsJsxOpeningLikeElement(callTarget) && argIndex == 0 {
 * 		return c.getEffectiveFirstArgumentForJsxSignature(signature, callTarget)
 * 	}
 * 	restIndex := len(signature.parameters) - 1
 * 	if signatureHasRestParameter(signature) && argIndex >= restIndex {
 * 		return c.getIndexedAccessTypeEx(c.getTypeOfSymbol(signature.parameters[restIndex]), c.getNumberLiteralType(jsnum.Number(argIndex-restIndex)), AccessFlagsContextual, nil, nil)
 * 	}
 * 	return c.getTypeAtPosition(signature, argIndex)
 * }
 */
export function Checker_getContextualTypeForArgumentAtIndex(receiver: GoPtr<Checker>, callTarget: GoPtr<Node>, argIndex: int): GoPtr<Type> {
  if (IsImportCall(callTarget)) {
    if (argIndex === 0) {
      return receiver!.stringType;
    }
    if (argIndex === 1) {
      return receiver!.getGlobalImportCallOptionsType();
    }
    return receiver!.anyType;
  }
  let signature: GoPtr<Signature>;
  if ((LinkStore_Get(receiver!.signatureLinks, callTarget) as GoPtr<SignatureLinks>)!.resolvedSignature === receiver!.resolvingSignature) {
    signature = receiver!.resolvingSignature;
  } else {
    signature = Checker_getResolvedSignature(receiver, callTarget, undefined, CheckModeNormal);
  }
  if (IsJsxOpeningLikeElement(callTarget) && argIndex === 0) {
    return Checker_getEffectiveFirstArgumentForJsxSignature(receiver, signature, callTarget);
  }
  const restIndex = signature!.parameters.length - 1;
  if (signatureHasRestParameter(signature) && argIndex >= restIndex) {
    return Checker_getIndexedAccessTypeEx(receiver, Checker_getTypeOfSymbol(receiver, signature!.parameters[restIndex]), Checker_getNumberLiteralType(receiver, argIndex - restIndex), AccessFlagsContextual, undefined, undefined);
  }
  return Checker_getTypeAtPosition(receiver, signature, argIndex);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getEffectiveCallArguments","kind":"method","status":"implemented","sigHash":"9572850d74760078277e606e3ca1190dd1ff030be0b6c377f9590082088ceb55","bodyHash":"d818b86f07e456fa22ba6d79ca15d5252643ffc272ca3fb8fff7073be588e37a"}
 *
 * Go source:
 * func (c *Checker) getEffectiveCallArguments(node *ast.Node) []*ast.Node {
 * 	switch {
 * 	case ast.IsJsxOpeningFragment(node):
 * 		// This attributes Type does not include a children property yet, the same way a fragment created with <React.Fragment> does not at this stage
 * 		return []*ast.Node{c.createSyntheticExpression(node, c.emptyFreshJsxObjectType, false, nil)}
 * 	case ast.IsTaggedTemplateExpression(node):
 * 		template := node.AsTaggedTemplateExpression().Template
 * 		firstArg := c.createSyntheticExpression(template, c.getGlobalTemplateStringsArrayType(), false, nil)
 * 		if !ast.IsTemplateExpression(template) {
 * 			return []*ast.Node{firstArg}
 * 		}
 * 		spans := template.AsTemplateExpression().TemplateSpans.Nodes
 * 		args := make([]*ast.Node, len(spans)+1)
 * 		args[0] = firstArg
 * 		for i, span := range spans {
 * 			args[i+1] = span.Expression()
 * 		}
 * 		return args
 * 	case ast.IsDecorator(node):
 * 		return c.getEffectiveDecoratorArguments(node)
 * 	case ast.IsBinaryExpression(node):
 * 		// Handles instanceof operator
 * 		return []*ast.Node{node.AsBinaryExpression().Left}
 * 	case ast.IsJsxOpeningLikeElement(node):
 * 		if len(node.Attributes().Properties()) != 0 || (ast.IsJsxOpeningElement(node) && len(node.Parent.Children().Nodes) != 0) {
 * 			return []*ast.Node{node.Attributes()}
 * 		}
 * 		return nil
 * 	default:
 * 		args := node.Arguments()
 * 		spreadIndex := c.getSpreadArgumentIndex(args)
 * 		if spreadIndex >= 0 {
 * 			// Create synthetic arguments from spreads of tuple types.
 * 			effectiveArgs := slices.Clip(args[:spreadIndex])
 * 			for i := spreadIndex; i < len(args); i++ {
 * 				arg := args[i]
 * 				var spreadType *Type
 * 				// We can call checkExpressionCached because spread expressions never have a contextual type.
 * 				if ast.IsSpreadElement(arg) {
 * 					if len(c.flowLoopStack) != 0 {
 * 						spreadType = c.checkExpression(arg.Expression())
 * 					} else {
 * 						spreadType = c.checkExpressionCached(arg.Expression())
 * 					}
 * 				}
 * 				if spreadType != nil && isTupleType(spreadType) {
 * 					for i, t := range c.getElementTypes(spreadType) {
 * 						elementInfos := spreadType.TargetTupleType().elementInfos
 * 						flags := elementInfos[i].flags
 * 						syntheticType := t
 * 						if flags&ElementFlagsRest != 0 {
 * 							syntheticType = c.createArrayType(t)
 * 						}
 * 						syntheticArg := c.createSyntheticExpression(arg, syntheticType, flags&ElementFlagsVariable != 0, elementInfos[i].labeledDeclaration)
 * 						effectiveArgs = append(effectiveArgs, syntheticArg)
 * 					}
 * 				} else {
 * 					effectiveArgs = append(effectiveArgs, arg)
 * 				}
 * 			}
 * 			return effectiveArgs
 * 		}
 * 		return args
 * 	}
 * }
 */
export function Checker_getEffectiveCallArguments(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  if (IsJsxOpeningFragment(node)) {
    return [Checker_createSyntheticExpression(receiver, node, receiver!.emptyFreshJsxObjectType, false, undefined)];
  }
  if (IsTaggedTemplateExpression(node)) {
    const template = AsTaggedTemplateExpression(node)!.Template as GoPtr<Node>;
    const firstArg = Checker_createSyntheticExpression(receiver, template, receiver!.getGlobalTemplateStringsArrayType(), false, undefined);
    if (!IsTemplateExpression(template)) {
      return [firstArg];
    }
    const spans = AsTemplateExpression(template)!.TemplateSpans!.Nodes;
    const args: GoSlice<GoPtr<Node>> = new globalThis.Array(spans.length + 1);
    args[0] = firstArg;
    for (let i = 0; i < spans.length; i++) {
      args[i + 1] = Node_Expression(spans[i]);
    }
    return args;
  }
  if (IsDecorator(node)) {
    return Checker_getEffectiveDecoratorArguments(receiver, node);
  }
  if (IsBinaryExpression(node)) {
    return [AsBinaryExpression(node)!.Left as GoPtr<Node>];
  }
  if (IsJsxOpeningLikeElement(node)) {
    if ((Node_Properties(Node_Attributes(node))?.length ?? 0) !== 0 || (IsJsxOpeningElement(node) && (Node_Children(node!.Parent)!.Nodes.length !== 0))) {
      return [Node_Attributes(node)];
    }
    return undefined as unknown as GoSlice<GoPtr<Node>>;
  }
  const args = Node_Arguments(node) ?? [];
  const spreadIndex = Checker_getSpreadArgumentIndex(receiver, args);
  if (spreadIndex >= 0) {
    const effectiveArgs = slices.Clip(args.slice(0, spreadIndex)) as GoSlice<GoPtr<Node>>;
    for (let i = spreadIndex; i < args.length; i++) {
      const arg = args[i];
      let spreadType: GoPtr<Type>;
      if (IsSpreadElement(arg)) {
        if (receiver!.flowLoopStack.length !== 0) {
          spreadType = Checker_checkExpression(receiver, Node_Expression(arg));
        } else {
          spreadType = Checker_checkExpressionCached(receiver, Node_Expression(arg));
        }
      }
      if (spreadType !== undefined && isTupleType(spreadType)) {
        const elementTypes = Checker_getElementTypes(receiver, spreadType);
        const elementInfos = Type_TargetTupleType(spreadType)!.elementInfos;
        for (let elementIndex = 0; elementIndex < elementTypes.length; elementIndex++) {
          const flags = elementInfos[elementIndex]!.flags;
          let syntheticType = elementTypes[elementIndex];
          if ((flags & ElementFlagsRest) !== 0) {
            syntheticType = Checker_createArrayType(receiver, syntheticType);
          }
          const syntheticArg = Checker_createSyntheticExpression(receiver, arg, syntheticType, (flags & ElementFlagsVariable) !== 0, elementInfos[elementIndex]!.labeledDeclaration);
          effectiveArgs.push(syntheticArg);
        }
      } else {
        effectiveArgs.push(arg);
      }
    }
    return effectiveArgs;
  }
  return args;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSpreadArgumentIndex","kind":"method","status":"implemented","sigHash":"a67588e206ef1eb54cc01ae81d5144aef4dd2920669d5677b9bed712972038d0","bodyHash":"26f5fc5b7e04105139a782bccba1136a07a58f479dd05c310f15e531c879343b"}
 *
 * Go source:
 * func (c *Checker) getSpreadArgumentIndex(args []*ast.Node) int {
 * 	return core.FindIndex(args, isSpreadArgument)
 * }
 */
export function Checker_getSpreadArgumentIndex(receiver: GoPtr<Checker>, args: GoSlice<GoPtr<Node>>): int {
  return core.FindIndex(args, isSpreadArgument);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getEffectiveDecoratorArguments","kind":"method","status":"implemented","sigHash":"4ac2ddfc1aa476bbd939f009d14da9bfad8c58cc32901318491db67f93e2d251","bodyHash":"82d564ac7aef5c25bebdd9e3df58ccecb55a5d5e1615d25e2aa068d28854bcf9"}
 *
 * Go source:
 * func (c *Checker) getEffectiveDecoratorArguments(node *ast.Node) []*ast.Node {
 * 	expr := node.Expression()
 * 	signature := c.getDecoratorCallSignature(node)
 * 	if signature != nil {
 * 		args := make([]*ast.Node, len(signature.parameters))
 * 		for i, param := range signature.parameters {
 * 			args[i] = c.createSyntheticExpression(expr, c.getTypeOfSymbol(param), false, nil)
 * 		}
 * 		return args
 * 	}
 * 	panic("Decorator signature not found")
 * }
 */
export function Checker_getEffectiveDecoratorArguments(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  const expr = Node_Expression(node);
  const signature = Checker_getDecoratorCallSignature(receiver, node);
  if (signature !== undefined) {
    const args = new Array<GoPtr<Node>>(signature!.parameters.length);
    for (let i = 0; i < signature!.parameters.length; i++) {
      args[i] = Checker_createSyntheticExpression(receiver, expr, Checker_getTypeOfSymbol(receiver, signature!.parameters[i]), false, undefined);
    }
    return args;
  }
  throw new globalThis.Error("Decorator signature not found");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getDecoratorCallSignature","kind":"method","status":"implemented","sigHash":"1058d93d4dfbd277bf8447a3e176c0b14b6c3f6ecb2e65981ef6b5ffe7a23be3","bodyHash":"de745adbdb6ac8a2564f8430e3a0b974553f11d7c9cf772f26898376e961a63b"}
 *
 * Go source:
 * func (c *Checker) getDecoratorCallSignature(decorator *ast.Node) *Signature {
 * 	if c.legacyDecorators {
 * 		return c.getLegacyDecoratorCallSignature(decorator)
 * 	}
 * 	return c.getESDecoratorCallSignature(decorator)
 * }
 */
export function Checker_getDecoratorCallSignature(receiver: GoPtr<Checker>, decorator: GoPtr<Node>): GoPtr<Signature> {
  if (receiver!.legacyDecorators) {
    return Checker_getLegacyDecoratorCallSignature(receiver, decorator);
  }
  return Checker_getESDecoratorCallSignature(receiver, decorator);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getLegacyDecoratorCallSignature","kind":"method","status":"implemented","sigHash":"d28506e9845bb9ae20c9db2d69b076f76641e24b1769f9e8107c5e122df0b7e7","bodyHash":"539ce9b578f646c154c86c4ca63de17015f8f6e9fd65e55f47647d6ae5410096"}
 *
 * Go source:
 * func (c *Checker) getLegacyDecoratorCallSignature(decorator *ast.Node) *Signature {
 * 	node := decorator.Parent
 * 	links := c.signatureLinks.Get(node)
 * 	if links.decoratorSignature == nil {
 * 		links.decoratorSignature = c.anySignature
 * 		switch node.Kind {
 * 		case ast.KindClassDeclaration, ast.KindClassExpression:
 * 			// For a class decorator, the `target` is the type of the class (e.g. the
 * 			// "static" or "constructor" side of the class).
 * 			targetType := c.getTypeOfSymbol(c.getSymbolOfDeclaration(node))
 * 			targetParam := c.newParameter("target", targetType)
 * 			links.decoratorSignature = c.newCallSignature(nil, nil, []*ast.Symbol{targetParam}, c.getUnionType([]*Type{targetType, c.voidType}))
 * 		case ast.KindParameter:
 * 			if !ast.IsConstructorDeclaration(node.Parent) && !(ast.IsMethodDeclaration(node.Parent) || ast.IsSetAccessorDeclaration(node.Parent) && ast.IsClassLike(node.Parent.Parent)) {
 * 				break
 * 			}
 * 			if ast.GetThisParameter(node.Parent) == node {
 * 				break
 * 			}
 * 			index := slices.Index(node.Parent.Parameters(), node) - core.IfElse(ast.GetThisParameter(node.Parent) != nil, 1, 0)
 * 			debug.Assert(index >= 0)
 * 			// A parameter declaration decorator will have three arguments (see `ParameterDecorator` in
 * 			// core.d.ts).
 * 			var targetType *Type
 * 			var keyType *Type
 * 			if ast.IsConstructorDeclaration(node.Parent) {
 * 				targetType = c.getTypeOfSymbol(c.getSymbolOfDeclaration(node.Parent.Parent))
 * 				keyType = c.undefinedType
 * 			} else {
 * 				targetType = c.getParentTypeOfClassElement(node.Parent)
 * 				keyType = c.getClassElementPropertyKeyType(node.Parent)
 * 			}
 * 			indexType := c.getNumberLiteralType(jsnum.Number(index))
 * 			targetParam := c.newParameter("target", targetType)
 * 			keyParam := c.newParameter("propertyKey", keyType)
 * 			indexParam := c.newParameter("parameterIndex", indexType)
 * 			links.decoratorSignature = c.newCallSignature(nil, nil, []*ast.Symbol{targetParam, keyParam, indexParam}, c.voidType)
 * 		case ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor, ast.KindPropertyDeclaration:
 * 			if !ast.IsClassLike(node.Parent) {
 * 				break
 * 			}
 * 			// A method or accessor declaration decorator will have either two or three arguments (see
 * 			// `PropertyDecorator` and `MethodDecorator` in core.d.ts).
 * 			targetType := c.getParentTypeOfClassElement(node)
 * 			targetParam := c.newParameter("target", targetType)
 * 			keyType := c.getClassElementPropertyKeyType(node)
 * 			keyParam := c.newParameter("propertyKey", keyType)
 * 			returnType := c.voidType
 * 			if !ast.IsPropertyDeclaration(node) {
 * 				returnType = c.newTypedPropertyDescriptorType(c.getTypeOfNode(node))
 * 			}
 * 			hasPropDesc := !ast.IsPropertyDeclaration(node) || ast.HasAccessorModifier(node)
 * 			if hasPropDesc {
 * 				descriptorType := c.newTypedPropertyDescriptorType(c.getTypeOfNode(node))
 * 				descriptorParam := c.newParameter("descriptor", descriptorType)
 * 				links.decoratorSignature = c.newCallSignature(nil, nil, []*ast.Symbol{targetParam, keyParam, descriptorParam}, c.getUnionType([]*Type{returnType, c.voidType}))
 * 			} else {
 * 				links.decoratorSignature = c.newCallSignature(nil, nil, []*ast.Symbol{targetParam, keyParam}, c.getUnionType([]*Type{returnType, c.voidType}))
 * 			}
 * 		}
 * 	}
 * 	if links.decoratorSignature == c.anySignature {
 * 		return nil
 * 	}
 * 	return links.decoratorSignature
 * }
 */
export function Checker_getLegacyDecoratorCallSignature(receiver: GoPtr<Checker>, decorator: GoPtr<Node>): GoPtr<Signature> {
  const node = decorator!.Parent;
  const links = LinkStore_Get(receiver!.signatureLinks, node) as GoPtr<SignatureLinks>;
  if (links!.decoratorSignature === undefined) {
    links!.decoratorSignature = receiver!.anySignature;
    switch (node!.Kind) {
      case KindClassDeclaration:
      case KindClassExpression: {
        const targetType = Checker_getTypeOfSymbol(receiver, Checker_getSymbolOfDeclaration(receiver, node));
        const targetParam = Checker_newParameter(receiver, "target", targetType);
        links!.decoratorSignature = Checker_newCallSignature(receiver, [], undefined, [targetParam] as GoSlice<GoPtr<Symbol>>, Checker_getUnionType(receiver, [targetType, receiver!.voidType] as GoSlice<GoPtr<Type>>));
        break;
      }
      case KindParameter: {
        if (!IsConstructorDeclaration(node!.Parent) && !(IsMethodDeclaration(node!.Parent) || (IsSetAccessorDeclaration(node!.Parent) && IsClassLike(node!.Parent!.Parent)))) {
          break;
        }
        if (GetThisParameter(node!.Parent) === node) {
          break;
        }
        const parameters = Node_Parameters(node!.Parent) ?? [];
        const thisParameterOffset = GetThisParameter(node!.Parent) !== undefined ? 1 : 0;
        const index = parameters.indexOf(node) - thisParameterOffset;
        if (index < 0) {
          throw new globalThis.Error("Invalid decorator parameter index");
        }
        let targetType: GoPtr<Type>;
        let keyType: GoPtr<Type>;
        if (IsConstructorDeclaration(node!.Parent)) {
          targetType = Checker_getTypeOfSymbol(receiver, Checker_getSymbolOfDeclaration(receiver, node!.Parent!.Parent));
          keyType = receiver!.undefinedType;
        } else {
          targetType = Checker_getParentTypeOfClassElement(receiver, node!.Parent);
          keyType = Checker_getClassElementPropertyKeyType(receiver, node!.Parent);
        }
        const indexType = Checker_getNumberLiteralType(receiver, index as Number);
        const targetParam = Checker_newParameter(receiver, "target", targetType);
        const keyParam = Checker_newParameter(receiver, "propertyKey", keyType);
        const indexParam = Checker_newParameter(receiver, "parameterIndex", indexType);
        links!.decoratorSignature = Checker_newCallSignature(receiver, [], undefined, [targetParam, keyParam, indexParam] as GoSlice<GoPtr<Symbol>>, receiver!.voidType);
        break;
      }
      case KindMethodDeclaration:
      case KindGetAccessor:
      case KindSetAccessor:
      case KindPropertyDeclaration: {
        if (!IsClassLike(node!.Parent)) {
          break;
        }
        const targetType = Checker_getParentTypeOfClassElement(receiver, node);
        const targetParam = Checker_newParameter(receiver, "target", targetType);
        const keyType = Checker_getClassElementPropertyKeyType(receiver, node);
        const keyParam = Checker_newParameter(receiver, "propertyKey", keyType);
        let returnType = receiver!.voidType;
        if (!IsPropertyDeclaration(node)) {
          returnType = Checker_newTypedPropertyDescriptorType(receiver, Checker_getTypeOfNode(receiver, node));
        }
        const hasPropDesc = !IsPropertyDeclaration(node) || HasAccessorModifier(node);
        if (hasPropDesc) {
          const descriptorType = Checker_newTypedPropertyDescriptorType(receiver, Checker_getTypeOfNode(receiver, node));
          const descriptorParam = Checker_newParameter(receiver, "descriptor", descriptorType);
          links!.decoratorSignature = Checker_newCallSignature(receiver, [], undefined, [targetParam, keyParam, descriptorParam] as GoSlice<GoPtr<Symbol>>, Checker_getUnionType(receiver, [returnType, receiver!.voidType] as GoSlice<GoPtr<Type>>));
        } else {
          links!.decoratorSignature = Checker_newCallSignature(receiver, [], undefined, [targetParam, keyParam] as GoSlice<GoPtr<Symbol>>, Checker_getUnionType(receiver, [returnType, receiver!.voidType] as GoSlice<GoPtr<Type>>));
        }
        break;
      }
    }
  }
  if (links!.decoratorSignature === receiver!.anySignature) {
    return undefined;
  }
  return links!.decoratorSignature;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getESDecoratorCallSignature","kind":"method","status":"implemented","sigHash":"f0210643764b83d1958ec858b35ad1d648744c98abad136f4a48f514e1c45ae0","bodyHash":"3a09622b31212b9337eeff716664b8de74efc7790c05d99592fb57d1f9c6fa53"}
 *
 * Go source:
 * func (c *Checker) getESDecoratorCallSignature(decorator *ast.Node) *Signature {
 * 	// We are considering a future change that would allow the type of a decorator to affect the type of the
 * 	// class and its members, such as a `@Stringify` decorator changing the type of a `number` field to `string`, or
 * 	// a `@Callable` decorator adding a call signature to a `class`. The type arguments for the various context
 * 	// types may eventually change to reflect such mutations.
 * 	//
 * 	// In some cases we describe such potential mutations as coming from a "prior decorator application". It is
 * 	// important to note that, while decorators are *evaluated* left to right, they are *applied* right to left
 * 	// to preserve f ৹ g -> f(g(x)) application order. In these cases, a "prior" decorator usually means the
 * 	// next decorator following this one in document order.
 * 	//
 * 	// The "original type" of a class or member is the type it was declared as, or the type we infer from
 * 	// initializers, before _any_ decorators are applied.
 * 	//
 * 	// The type of a class or member that is a result of a prior decorator application represents the
 * 	// "current type", i.e., the type for the declaration at the time the decorator is _applied_.
 * 	//
 * 	// The type of a class or member that is the result of the application of *all* relevant decorators is the
 * 	// "final type".
 * 	//
 * 	// Any decorator that allows mutation or replacement will also refer to an "input type" and an
 * 	// "output type". The "input type" corresponds to the "current type" of the declaration, while the
 * 	// "output type" will become either the "input type/current type" for a subsequent decorator application,
 * 	// or the "final type" for the decorated declaration.
 * 	//
 * 	// It is important to understand decorator application order as it relates to how the "current", "input",
 * 	// "output", and "final" types will be determined:
 * 	//
 * 	//  @E2 @E1 class SomeClass {
 * 	//      @A2 @A1 static f() {}
 * 	//      @B2 @B1 g() {}
 * 	//      @C2 @C1 static x;
 * 	//      @D2 @D1 y;
 * 	//  }
 * 	//
 * 	// Per [the specification][1], decorators are applied in the following order:
 * 	//
 * 	// 1. For each static method (incl. get/set methods and `accessor` fields), in document order:
 * 	//    a. Apply each decorator for that method, in reverse order (`A1`, `A2`).
 * 	// 2. For each instance method (incl. get/set methods and `accessor` fields), in document order:
 * 	//    a. Apply each decorator for that method, in reverse order (`B1`, `B2`).
 * 	// 3. For each static field (excl. auto-accessors), in document order:
 * 	//    a. Apply each decorator for that field, in reverse order (`C1`, `C2`).
 * 	// 4. For each instance field (excl. auto-accessors), in document order:
 * 	//    a. Apply each decorator for that field, in reverse order (`D1`, `D2`).
 * 	// 5. Apply each decorator for the class, in reverse order (`E1`, `E2`).
 * 	//
 * 	// As a result, "current" types at each decorator application are as follows:
 * 	// - For `A1`, the "current" types of the class and method are their "original" types.
 * 	// - For `A2`, the "current type" of the method is the "output type" of `A1`, and the "current type" of the
 * 	//   class is the type of `SomeClass` where `f` is the "output type" of `A1`. This becomes the "final type"
 * 	//   of `f`.
 * 	// - For `B1`, the "current type" of the method is its "original type", and the "current type" of the class
 * 	//   is the type of `SomeClass` where `f` now has its "final type".
 * 	// - etc.
 * 	//
 * 	// [1]: https://arai-a.github.io/ecma262-compare/?pr=2417&id=sec-runtime-semantics-classdefinitionevaluation
 * 	//
 * 	// This seems complicated at first glance, but is not unlike our existing inference for functions:
 * 	//
 * 	//  declare function pipe<Original, A1, A2, B1, B2, C1, C2, D1, D2, E1, E2>(
 * 	//      original: Original,
 * 	//      a1: (input: Original, context: Context<E2>) => A1,
 * 	//      a2: (input: A1, context: Context<E2>) => A2,
 * 	//      b1: (input: A2, context: Context<E2>) => B1,
 * 	//      b2: (input: B1, context: Context<E2>) => B2,
 * 	//      c1: (input: B2, context: Context<E2>) => C1,
 * 	//      c2: (input: C1, context: Context<E2>) => C2,
 * 	//      d1: (input: C2, context: Context<E2>) => D1,
 * 	//      d2: (input: D1, context: Context<E2>) => D2,
 * 	//      e1: (input: D2, context: Context<E2>) => E1,
 * 	//      e2: (input: E1, context: Context<E2>) => E2,
 * 	//  ): E2;
 * 
 * 	// When a decorator is applied, it is passed two arguments: "target", which is a value representing the
 * 	// thing being decorated (constructors for classes, functions for methods/accessors, `undefined` for fields,
 * 	// and a `{ get, set }` object for auto-accessors), and "context", which is an object that provides
 * 	// reflection information about the decorated element, as well as the ability to add additional "extra"
 * 	// initializers. In most cases, the "target" argument corresponds to the "input type" in some way, and the
 * 	// return value similarly corresponds to the "output type" (though if the "output type" is `void` or
 * 	// `undefined` then the "output type" is the "input type").
 * 	node := decorator.Parent
 * 	links := c.signatureLinks.Get(node)
 * 	if links.decoratorSignature == nil {
 * 		links.decoratorSignature = c.anySignature
 * 		switch node.Kind {
 * 		case ast.KindClassDeclaration, ast.KindClassExpression:
 * 			// Class decorators have a `context` of `ClassDecoratorContext<Class>`, where the `Class` type
 * 			// argument will be the "final type" of the class after all decorators are applied.
 * 			targetType := c.getTypeOfSymbol(c.getSymbolOfDeclaration(node))
 * 			contextType := c.newClassDecoratorContextType(targetType)
 * 			links.decoratorSignature = c.newESDecoratorCallSignature(targetType, contextType, targetType)
 * 		case ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor:
 * 			if !ast.IsClassLike(node.Parent) {
 * 				break
 * 			}
 * 			// Method decorators have a `context` of `ClassMethodDecoratorContext<This, Value>`, where the
 * 			// `Value` type argument corresponds to the "final type" of the method.
 * 			//
 * 			// Getter decorators have a `context` of `ClassGetterDecoratorContext<This, Value>`, where the
 * 			// `Value` type argument corresponds to the "final type" of the value returned by the getter.
 * 			//
 * 			// Setter decorators have a `context` of `ClassSetterDecoratorContext<This, Value>`, where the
 * 			// `Value` type argument corresponds to the "final type" of the parameter of the setter.
 * 			//
 * 			// In all three cases, the `This` type argument is the "final type" of either the class or
 * 			// instance, depending on whether the member was `static`.
 * 			var valueType *Type
 * 			if ast.IsMethodDeclaration(node) {
 * 				valueType = c.getOrCreateTypeFromSignature(c.getSignatureFromDeclaration(node))
 * 			} else {
 * 				valueType = c.getTypeOfNode(node)
 * 			}
 * 			var thisType *Type
 * 			if ast.HasStaticModifier(node) {
 * 				thisType = c.getTypeOfSymbol(c.getSymbolOfDeclaration(node.Parent))
 * 			} else {
 * 				thisType = c.getDeclaredTypeOfClassOrInterface(c.getSymbolOfDeclaration(node.Parent))
 * 			}
 * 			// We wrap the "input type", if necessary, to match the decoration target. For getters this is
 * 			// something like `() => inputType`, for setters it's `(value: inputType) => void` and for
 * 			// methods it is just the input type.
 * 			var targetType *Type
 * 			switch {
 * 			case ast.IsGetAccessorDeclaration(node):
 * 				targetType = c.newGetterFunctionType(valueType)
 * 			case ast.IsSetAccessorDeclaration(node):
 * 				targetType = c.newSetterFunctionType(valueType)
 * 			default:
 * 				targetType = valueType
 * 			}
 * 			contextType := c.newClassMemberDecoratorContextTypeForNode(node, thisType, valueType)
 * 			links.decoratorSignature = c.newESDecoratorCallSignature(targetType, contextType, targetType)
 * 		case ast.KindPropertyDeclaration:
 * 			if !ast.IsClassLike(node.Parent) {
 * 				break
 * 			}
 * 			// Field decorators have a `context` of `ClassFieldDecoratorContext<This, Value>` and
 * 			// auto-accessor decorators have a `context` of `ClassAccessorDecoratorContext<This, Value>. In
 * 			// both cases, the `This` type argument is the "final type" of either the class or instance,
 * 			// depending on whether the member was `static`, and the `Value` type argument corresponds to
 * 			// the "final type" of the value stored in the field.
 * 			valueType := c.getTypeOfNode(node)
 * 			var thisType *Type
 * 			if ast.HasStaticModifier(node) {
 * 				thisType = c.getTypeOfSymbol(c.getSymbolOfDeclaration(node.Parent))
 * 			} else {
 * 				thisType = c.getDeclaredTypeOfClassOrInterface(c.getSymbolOfDeclaration(node.Parent))
 * 			}
 * 			// The `target` of an auto-accessor decorator is a `{ get, set }` object, representing the
 * 			// runtime-generated getter and setter that are added to the class/prototype. The `target` of a
 * 			// regular field decorator is always `undefined` as it isn't installed until it is initialized.
 * 			var targetType *Type
 * 			if ast.HasAccessorModifier(node) {
 * 				targetType = c.newClassAccessorDecoratorTargetType(thisType, valueType)
 * 			} else {
 * 				targetType = c.undefinedType
 * 			}
 * 			// We wrap the "output type" depending on the declaration. For auto-accessors, we wrap the
 * 			// "output type" in a `ClassAccessorDecoratorResult<This, In, Out>` type, which allows for
 * 			// mutation of the runtime-generated getter and setter, as well as the injection of an
 * 			// initializer mutator. For regular fields, we wrap the "output type" in an initializer mutator.
 * 			var returnType *Type
 * 			if ast.HasAccessorModifier(node) {
 * 				returnType = c.newClassAccessorDecoratorResultType(thisType, valueType)
 * 			} else {
 * 				returnType = c.newClassFieldDecoratorInitializerMutatorType(thisType, valueType)
 * 			}
 * 			contextType := c.newClassMemberDecoratorContextTypeForNode(node, thisType, valueType)
 * 			links.decoratorSignature = c.newESDecoratorCallSignature(targetType, contextType, returnType)
 * 		}
 * 	}
 * 	if links.decoratorSignature == c.anySignature {
 * 		return nil
 * 	}
 * 	return links.decoratorSignature
 * }
 */
export function Checker_getESDecoratorCallSignature(receiver: GoPtr<Checker>, decorator: GoPtr<Node>): GoPtr<Signature> {
  const node = decorator!.Parent;
  const links = LinkStore_Get(receiver!.signatureLinks, node) as GoPtr<SignatureLinks>;
  if (links!.decoratorSignature === undefined) {
    links!.decoratorSignature = receiver!.anySignature;
    switch (node!.Kind) {
      case KindClassDeclaration:
      case KindClassExpression: {
        const targetType = Checker_getTypeOfSymbol(receiver, Checker_getSymbolOfDeclaration(receiver, node));
        const contextType = Checker_newClassDecoratorContextType(receiver, targetType);
        links!.decoratorSignature = Checker_newESDecoratorCallSignature(receiver, targetType, contextType, targetType);
        break;
      }
      case KindMethodDeclaration:
      case KindGetAccessor:
      case KindSetAccessor: {
        if (!IsClassLike(node!.Parent)) {
          break;
        }
        const valueType = IsMethodDeclaration(node)
          ? Checker_getOrCreateTypeFromSignature(receiver, Checker_getSignatureFromDeclaration(receiver, node))
          : Checker_getTypeOfNode(receiver, node);
        const thisType = HasStaticModifier(node)
          ? Checker_getTypeOfSymbol(receiver, Checker_getSymbolOfDeclaration(receiver, node!.Parent))
          : Checker_getDeclaredTypeOfClassOrInterface(receiver, Checker_getSymbolOfDeclaration(receiver, node!.Parent));
        let targetType: GoPtr<Type>;
        if (IsGetAccessorDeclaration(node)) {
          targetType = Checker_newGetterFunctionType(receiver, valueType);
        } else if (IsSetAccessorDeclaration(node)) {
          targetType = Checker_newSetterFunctionType(receiver, valueType);
        } else {
          targetType = valueType;
        }
        const contextType = Checker_newClassMemberDecoratorContextTypeForNode(receiver, node, thisType, valueType);
        links!.decoratorSignature = Checker_newESDecoratorCallSignature(receiver, targetType, contextType, targetType);
        break;
      }
      case KindPropertyDeclaration: {
        if (!IsClassLike(node!.Parent)) {
          break;
        }
        const valueType = Checker_getTypeOfNode(receiver, node);
        const thisType = HasStaticModifier(node)
          ? Checker_getTypeOfSymbol(receiver, Checker_getSymbolOfDeclaration(receiver, node!.Parent))
          : Checker_getDeclaredTypeOfClassOrInterface(receiver, Checker_getSymbolOfDeclaration(receiver, node!.Parent));
        const targetType = HasAccessorModifier(node)
          ? Checker_newClassAccessorDecoratorTargetType(receiver, thisType, valueType)
          : receiver!.undefinedType;
        const returnType = HasAccessorModifier(node)
          ? Checker_newClassAccessorDecoratorResultType(receiver, thisType, valueType)
          : Checker_newClassFieldDecoratorInitializerMutatorType(receiver, thisType, valueType);
        const contextType = Checker_newClassMemberDecoratorContextTypeForNode(receiver, node, thisType, valueType);
        links!.decoratorSignature = Checker_newESDecoratorCallSignature(receiver, targetType, contextType, returnType);
        break;
      }
    }
  }
  if (links!.decoratorSignature === receiver!.anySignature) {
    return undefined;
  }
  return links!.decoratorSignature;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newESDecoratorCallSignature","kind":"method","status":"implemented","sigHash":"a486f1eccc15adc2da9a78f1571211c308b7f106a35c9bb0884b10bb2d6dc149","bodyHash":"e7d0b352cf6527c21edbf17e8863e514aa581f4ad8132854364dc9d789f989ce"}
 *
 * Go source:
 * func (c *Checker) newESDecoratorCallSignature(targetType *Type, contextType *Type, nonOptionalReturnType *Type) *Signature {
 * 	targetParam := c.newParameter("target", targetType)
 * 	contextParam := c.newParameter("context", contextType)
 * 	returnType := c.getUnionType([]*Type{nonOptionalReturnType, c.voidType})
 * 	return c.newCallSignature(nil, nil /*thisParameter* /, []*ast.Symbol{targetParam, contextParam}, returnType)
 * }
 */
export function Checker_newESDecoratorCallSignature(receiver: GoPtr<Checker>, targetType: GoPtr<Type>, contextType: GoPtr<Type>, nonOptionalReturnType: GoPtr<Type>): GoPtr<Signature> {
  const targetParam = Checker_newParameter(receiver, "target", targetType);
  const contextParam = Checker_newParameter(receiver, "context", contextType);
  const returnType = Checker_getUnionType(receiver, [nonOptionalReturnType, receiver!.voidType] as GoSlice<GoPtr<Type>>);
  return Checker_newCallSignature(receiver, [], undefined, [targetParam, contextParam] as GoSlice<GoPtr<Symbol>>, returnType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.newCallSignature","kind":"method","status":"implemented","sigHash":"538fae2c78abade685aba4a8d0aa62a583b79e16f26f25506cd93603c9650bdb","bodyHash":"ee8cd01ef77fa45e399996cb0e4c7f2005c949591a2f80b13778ceed6147860b"}
 *
 * Go source:
 * func (c *Checker) newCallSignature(typeParameters []*Type, thisParameter *ast.Symbol, parameters []*ast.Symbol, returnType *Type) *Signature {
 * 	decl := c.factory.NewFunctionTypeNode(nil, nil, c.factory.NewKeywordTypeNode(ast.KindAnyKeyword))
 * 	return c.newSignature(SignatureFlagsNone, decl, typeParameters, thisParameter, parameters, returnType, nil, len(parameters))
 * }
 */
export function Checker_newCallSignature(receiver: GoPtr<Checker>, typeParameters: GoSlice<GoPtr<Type>>, thisParameter: GoPtr<Symbol>, parameters: GoSlice<GoPtr<Symbol>>, returnType: GoPtr<Type>): GoPtr<Signature> {
  const decl = NewFunctionTypeNode(receiver!.factory, undefined, undefined, NewKeywordTypeNode(receiver!.factory, KindAnyKeyword));
  return Checker_newSignature(receiver, SignatureFlagsNone, decl, typeParameters, thisParameter, parameters, returnType, undefined, (parameters ?? []).length);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getIndexSignaturesAtLocation","kind":"method","status":"implemented","sigHash":"6113503a2d4a4c270ebb1ae9557e3b78913db52a231615bb944e349683ee5b06","bodyHash":"b50814545541ee8be525df7b8e1bf91b04965382bdc67c16cd6b76d3607ce2c3"}
 *
 * Go source:
 * func (c *Checker) getIndexSignaturesAtLocation(node *ast.Node) []*ast.Node {
 * 	var signatures []*ast.Node
 * 	if ast.IsIdentifier(node) && ast.IsPropertyAccessExpression(node.Parent) && node.Parent.Name() == node {
 * 		keyType := c.getLiteralTypeFromPropertyName(node)
 * 		objectType := c.getTypeOfExpression(node.Parent.Expression())
 * 		for _, t := range objectType.Distributed() {
 * 			for _, info := range c.getApplicableIndexInfos(t, keyType) {
 * 				if info.declaration != nil {
 * 					signatures = core.AppendIfUnique(signatures, info.declaration)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return signatures
 * }
 */
export function Checker_getIndexSignaturesAtLocation(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  let signatures: GoSlice<GoPtr<Node>> = [];
  if (IsIdentifier(node) && IsPropertyAccessExpression(node!.Parent) && Node_Name(node!.Parent) === node) {
    const keyType = Checker_getLiteralTypeFromPropertyName(receiver, node);
    const objectType = Checker_getTypeOfExpression(receiver, Node_Expression(node!.Parent));
    for (const t of (Type_Distributed(objectType) ?? [])) {
      for (const info of (Checker_getApplicableIndexInfos(receiver, t, keyType) ?? [])) {
        if (info!.declaration !== undefined) {
          signatures = core.AppendIfUnique(signatures, info!.declaration);
        }
      }
    }
  }
  return signatures;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isThisPropertyAndThisTyped","kind":"method","status":"implemented","sigHash":"a7884962d081ce51fa7dd6ed39efe0fa0740e3b307a33fa6190179b70c5807f7","bodyHash":"c88d92f261e0d7d4d2c09e5e9e94e17094573cf17198e8fc1dd169ae09900c74"}
 *
 * Go source:
 * func (c *Checker) isThisPropertyAndThisTyped(node *ast.Node) bool {
 * 	if node.Expression().Kind == ast.KindThisKeyword {
 * 		container := c.getThisContainer(node, false /*includeArrowFunctions* /, false /*includeClassComputedPropertyName* /)
 * 		if ast.IsFunctionLike(container) {
 * 			containingLiteral := getContainingObjectLiteral(container)
 * 			if containingLiteral != nil {
 * 				contextualType := c.getApparentTypeOfContextualType(containingLiteral, ContextFlagsNone)
 * 				t := c.getThisTypeOfObjectLiteralFromContextualType(containingLiteral, contextualType)
 * 				return t != nil && !IsTypeAny(t)
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_isThisPropertyAndThisTyped(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (Node_Expression(node)!.Kind === KindThisKeyword) {
    const container = GetThisContainer(node, false, false);
    if (IsFunctionLike(container)) {
      const containingLiteral = getContainingObjectLiteral(container);
      if (containingLiteral !== undefined) {
        const contextualType = Checker_getApparentTypeOfContextualType(receiver, containingLiteral, ContextFlagsNone);
        const t = Checker_getThisTypeOfObjectLiteralFromContextualType(receiver, containingLiteral, contextualType);
        return t !== undefined && !IsTypeAny(t);
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getThisTypeOfObjectLiteralFromContextualType","kind":"method","status":"implemented","sigHash":"8f81b707d95da893ac2e909acab23493ce8851e7c64db00704a0f9a970cff1d9","bodyHash":"9c24538b3478d3264a6d896b18eaa45cbcbce9bfe137661ebca9533e43a4e0e9"}
 *
 * Go source:
 * func (c *Checker) getThisTypeOfObjectLiteralFromContextualType(containingLiteral *ast.Node, contextualType *Type) *Type {
 * 	literal := containingLiteral
 * 	t := contextualType
 * 	for t != nil {
 * 		thisType := c.getThisTypeFromContextualType(t)
 * 		if thisType != nil {
 * 			return thisType
 * 		}
 * 		if literal.Parent.Kind != ast.KindPropertyAssignment {
 * 			break
 * 		}
 * 		literal = literal.Parent.Parent
 * 		t = c.getApparentTypeOfContextualType(literal, ContextFlagsNone)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getThisTypeOfObjectLiteralFromContextualType(receiver: GoPtr<Checker>, containingLiteral: GoPtr<Node>, contextualType: GoPtr<Type>): GoPtr<Type> {
  let literal = containingLiteral;
  let t = contextualType;
  for (;;) {
    if (t === undefined) { break; }
    const thisType = Checker_getThisTypeFromContextualType(receiver, t);
    if (thisType !== undefined) {
      return thisType;
    }
    if (literal!.Parent!.Kind !== KindPropertyAssignment) {
      break;
    }
    literal = literal!.Parent!.Parent;
    t = Checker_getApparentTypeOfContextualType(receiver, literal, ContextFlagsNone);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getThisTypeFromContextualType","kind":"method","status":"implemented","sigHash":"81d63c55f9fd5cc8ffeae110e6d7567e3d41dab804aeec0cf6cc423761ba9e0b","bodyHash":"672cab718e8f5da56a2504bdcd3eea09f61b907627e0057d3bb11f9cc3350bc0"}
 *
 * Go source:
 * func (c *Checker) getThisTypeFromContextualType(t *Type) *Type {
 * 	return c.mapType(t, func(t *Type) *Type {
 * 		if t.flags&TypeFlagsIntersection != 0 {
 * 			for _, t := range t.AsIntersectionType().types {
 * 				typeArg := c.getThisTypeArgument(t)
 * 				if typeArg != nil {
 * 					return typeArg
 * 				}
 * 			}
 * 			return nil
 * 		} else {
 * 			return c.getThisTypeArgument(t)
 * 		}
 * 	})
 * }
 */
export function Checker_getThisTypeFromContextualType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  return Checker_mapType(receiver, t, (t: GoPtr<Type>): GoPtr<Type> => {
    if ((t!.flags & TypeFlagsIntersection) !== 0) {
      for (const inner of (Type_Types(t) ?? [])) {
        const typeArg = Checker_getThisTypeArgument(receiver, inner);
        if (typeArg !== undefined) {
          return typeArg;
        }
      }
      return undefined;
    } else {
      return Checker_getThisTypeArgument(receiver, t);
    }
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getThisTypeArgument","kind":"method","status":"implemented","sigHash":"5db476b7e6f38964aa4848a7aafc1c13e0e3ac4cfcdc2b96e0009bcce959966d","bodyHash":"bcf240156b5a5ceea8be8176ca722aa0c3c2bdbde61d57e15da0783a7aca15a8"}
 *
 * Go source:
 * func (c *Checker) getThisTypeArgument(t *Type) *Type {
 * 	if t.objectFlags&ObjectFlagsReference != 0 && t.AsTypeReference().target == c.globalThisType {
 * 		return c.getTypeArguments(t)[0]
 * 	}
 * 	return nil
 * }
 */
export function Checker_getThisTypeArgument(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  if ((t!.objectFlags & ObjectFlagsReference) !== 0 && Type_Target(t) === receiver!.globalThisType) {
    return Checker_getTypeArguments(receiver, t)[0];
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getApplicableIndexInfos","kind":"method","status":"implemented","sigHash":"611093a791ef932f8efdf7f9d26046bc23b5a50c32e25a9c23eb01e0134c6511","bodyHash":"8928d466a3d72facaac984ce6f55ba493f1d17f8ccbaea7a13cbf4ba9f66af62"}
 *
 * Go source:
 * func (c *Checker) getApplicableIndexInfos(t *Type, keyType *Type) []*IndexInfo {
 * 	return core.Filter(c.getIndexInfosOfType(t), func(info *IndexInfo) bool { return c.isApplicableIndexType(keyType, info.keyType) })
 * }
 */
export function Checker_getApplicableIndexInfos(receiver: GoPtr<Checker>, t: GoPtr<Type>, keyType: GoPtr<Type>): GoSlice<GoPtr<IndexInfo>> {
  return core.Filter(Checker_getIndexInfosOfType(receiver, t), (info: GoPtr<IndexInfo>) => Checker_isApplicableIndexType(receiver, keyType, info!.keyType));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getApplicableIndexSymbol","kind":"method","status":"implemented","sigHash":"a40817fe1af41ea59c2da8e72d9850088ef890ade45f2e789374df947fa9e7c5","bodyHash":"74ac15ed3ed74c01b2426c8687027941d736cb99a64e2c0fab87abd42939938d"}
 *
 * Go source:
 * func (c *Checker) getApplicableIndexSymbol(t *Type, keyType *Type) *ast.Symbol {
 * 	if info := c.getApplicableIndexInfo(t, keyType); info != nil && info != c.anyBaseTypeIndexInfo {
 * 		if info.indexSymbol == nil {
 * 			var declarations []*ast.Node
 * 			if info.declaration != nil {
 * 				declarations = []*ast.Node{info.declaration}
 * 			} else {
 * 				for _, info := range c.getIndexInfosOfType(t) {
 * 					if info.declaration != nil && c.isApplicableIndexType(keyType, info.keyType) {
 * 						declarations = append(declarations, info.declaration)
 * 					}
 * 				}
 * 			}
 * 			if len(declarations) != 0 {
 * 				symbol := c.newSymbol(ast.SymbolFlagsProperty, ast.InternalSymbolNameIndex)
 * 				symbol.CheckFlags |= ast.CheckFlagsIndexSymbol
 * 				symbol.Declarations = declarations
 * 				symbol.ValueDeclaration = declarations[0]
 * 				symbol.Parent = t.symbol
 * 				links := c.valueSymbolLinks.Get(symbol)
 * 				links.resolvedType = info.valueType
 * 				info.indexSymbol = symbol
 * 			}
 * 		}
 * 		return info.indexSymbol
 * 	}
 * 	return nil
 * }
 */
export function Checker_getApplicableIndexSymbol(receiver: GoPtr<Checker>, t: GoPtr<Type>, keyType: GoPtr<Type>): GoPtr<Symbol> {
  const info = Checker_getApplicableIndexInfo(receiver, t, keyType);
  if (info !== undefined && info !== receiver!.anyBaseTypeIndexInfo) {
    if (info!.indexSymbol === undefined) {
      let declarations: GoSlice<GoPtr<Node>> = [];
      if (info!.declaration !== undefined) {
        declarations = [info!.declaration] as GoSlice<GoPtr<Node>>;
      } else {
        for (const inf of (Checker_getIndexInfosOfType(receiver, t) ?? [])) {
          if (inf!.declaration !== undefined && Checker_isApplicableIndexType(receiver, keyType, inf!.keyType)) {
            declarations = [...(declarations ?? []), inf!.declaration] as GoSlice<GoPtr<Node>>;
          }
        }
      }
      if ((declarations ?? []).length !== 0) {
        const symbol_ = Checker_newSymbol(receiver, SymbolFlagsProperty, InternalSymbolNameIndex);
        symbol_!.CheckFlags |= CheckFlagsIndexSymbol;
        symbol_!.Declarations = declarations;
        symbol_!.ValueDeclaration = declarations![0];
        symbol_!.Parent = t!["symbol"];
        (LinkStore_Get(receiver!.valueSymbolLinks, symbol_) as GoPtr<ValueSymbolLinks>)!.resolvedType = info!.valueType;
        info!.indexSymbol = symbol_;
      }
    }
    return info!.indexSymbol;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.containsArgumentsReference","kind":"method","status":"implemented","sigHash":"d4ce4269801db06d19db13e54b586d39a519483923f2b47cb713e8f8c7ccd862","bodyHash":"7f8b145dfec356ee7f3ab9d1c6b5673b2c947cb744ead9fd3d2c2a59bd6027e9"}
 *
 * Go source:
 * func (c *Checker) containsArgumentsReference(node *ast.Node) bool {
 * 	if node.Body() == nil {
 * 		return false
 * 	}
 * 
 * 	if containsArguments, ok := c.cachedArgumentsReferenced[node]; ok {
 * 		return containsArguments
 * 	}
 * 
 * 	var visit func(node *ast.Node) bool
 * 	visit = func(node *ast.Node) bool {
 * 		if node == nil {
 * 			return false
 * 		}
 * 		switch node.Kind {
 * 		case ast.KindIdentifier:
 * 			return node.Text() == c.argumentsSymbol.Name && c.IsArgumentsSymbol(c.getResolvedSymbol(node))
 * 		case ast.KindPropertyDeclaration, ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor:
 * 			if ast.IsComputedPropertyName(node.Name()) {
 * 				return visit(node.Name())
 * 			}
 * 		case ast.KindPropertyAccessExpression, ast.KindElementAccessExpression:
 * 			return visit(node.Expression())
 * 		case ast.KindPropertyAssignment:
 * 			return visit(node.Initializer())
 * 		}
 * 		if nodeStartsNewLexicalEnvironment(node) || ast.IsPartOfTypeNode(node) {
 * 			return false
 * 		}
 * 		return node.ForEachChild(visit)
 * 	}
 * 
 * 	containsArguments := visit(node.Body())
 * 	c.cachedArgumentsReferenced[node] = containsArguments
 * 	return containsArguments
 * }
 */
export function Checker_containsArgumentsReference(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  if (Node_Body(node) === undefined) {
    return false;
  }
  const cached = receiver!.cachedArgumentsReferenced.get(node);
  if (cached !== undefined) {
    return cached;
  }
  const visit = (n: GoPtr<Node>): bool => {
    if (n === undefined) {
      return false;
    }
    switch (n!.Kind) {
      case KindIdentifier:
        return Node_Text(n) === receiver!.argumentsSymbol!.Name && Checker_IsArgumentsSymbol(receiver, Checker_getResolvedSymbol(receiver, n));
      case KindPropertyDeclaration:
      case KindMethodDeclaration:
      case KindGetAccessor:
      case KindSetAccessor:
        if (IsComputedPropertyName(Node_Name(n))) {
          return visit(Node_Name(n));
        }
        break;
      case KindPropertyAccessExpression:
      case KindElementAccessExpression:
        return visit(Node_Expression(n));
      case KindPropertyAssignment:
        return visit(Node_Initializer(n));
    }
    if (nodeStartsNewLexicalEnvironment(n) || IsPartOfTypeNode(n)) {
      return false;
    }
    return Node_ForEachChild(n, visit);
  };
  const containsArguments = visit(Node_Body(node));
  receiver!.cachedArgumentsReferenced.set(node, containsArguments);
  return containsArguments;
}
