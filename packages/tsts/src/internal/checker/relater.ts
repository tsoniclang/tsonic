import type { bool, byte, int, uint } from "@tsonic/core/types.js";
import type { GoConstraint, GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { Node } from "../ast/spine.js";
import { Node_Name } from "../ast/spine.js";
import { Node_ModifierFlags } from "../ast/ast.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import { DiagnosticsCollection_Add, NewDiagnosticChain, Diagnostic_SetRelatedInfo, Diagnostic_AddRelatedInfo } from "../ast/diagnostic.js";
import { ModifierFlagsPrivate, ModifierFlagsProtected, ModifierFlagsIn, ModifierFlagsOut, ModifierFlagsConst, ModifierFlagsNonPublicAccessibilityModifier } from "../ast/modifierflags.js";
import type { ModifierFlags } from "../ast/modifierflags.js";
import type { Symbol } from "../ast/symbol.js";
import { InternalSymbolNameMissing } from "../ast/symbol.js";
import type { Set } from "../collections/set.js";
import { Set_Has, Set_Clear, Set_Add, Set_Delete, Set_Len, NewSetWithSizeHint } from "../collections/set.js";
import type { Message } from "../diagnostics/diagnostics.js";
import { Message_ElidedInCompatibilityPyramid } from "../diagnostics/diagnostics.js";
import {
  Cannot_assign_a_0_constructor_type_to_a_1_constructor_type,
  Cannot_assign_an_abstract_constructor_type_to_a_non_abstract_constructor_type,
  Class_0_incorrectly_implements_class_1_Did_you_mean_to_extend_1_and_inherit_its_members_as_a_subclass,
  Class_0_incorrectly_implements_interface_1,
  Conversion_of_type_0_to_type_1_may_be_a_mistake_because_neither_type_sufficiently_overlaps_with_the_other_If_this_was_intentional_convert_the_expression_to_unknown_first,
  Did_you_mean_to_call_this_expression,
  Did_you_mean_to_use_new_with_this_expression,
  Excessive_complexity_comparing_types_0_and_1,
  Excessive_stack_depth_comparing_types_0_and_1,
  Index_signature_for_type_0_is_missing_in_type_1,
  Its_element_type_0_is_not_a_valid_JSX_element,
  Its_instance_type_0_is_not_a_valid_JSX_element,
  Its_return_type_0_is_not_a_valid_JSX_element,
  Object_literal_may_only_specify_known_properties_and_0_does_not_exist_in_type_1,
  Object_literal_may_only_specify_known_properties_but_0_does_not_exist_in_type_1_Did_you_mean_to_write_2,
  Property_0_does_not_exist_on_type_1_Did_you_mean_2,
  Property_0_is_incompatible_with_index_signature,
  The_type_0_is_readonly_and_cannot_be_assigned_to_the_mutable_type_1,
  The_types_of_0_are_incompatible_between_these_types,
  The_types_returned_by_0_are_incompatible_between_these_types,
  Type_0_has_no_properties_in_common_with_type_1,
  Type_0_provides_no_match_for_the_signature_1,
  Types_of_property_0_are_incompatible,
  Value_of_type_0_has_no_properties_in_common_with_type_1_Did_you_mean_to_call_it,
  X_0_and_1_index_signatures_are_incompatible,
  X_0_index_signatures_are_incompatible,
  X_0_is_a_primitive_but_1_is_a_wrapper_object_Prefer_using_0_when_possible,
  Source_has_0_element_s_but_target_requires_1,
  Source_has_0_element_s_but_target_allows_only_1,
  Target_requires_0_element_s_but_source_may_have_fewer,
  Target_allows_only_0_element_s_but_source_may_have_more,
  Source_provides_no_match_for_required_element_at_position_0_in_target,
  Source_provides_no_match_for_variadic_element_at_position_0_in_target,
  Variadic_element_at_position_0_in_source_does_not_match_element_at_position_1_in_target,
  Type_at_position_0_in_source_is_not_compatible_with_type_at_position_1_in_target,
  Type_at_positions_0_through_1_in_source_is_not_compatible_with_type_at_position_2_in_target,
  Property_0_does_not_exist_on_type_1,
  Property_0_is_private_in_type_1_but_not_in_type_2,
  Property_0_is_missing_in_type_1_but_required_in_type_2,
  Property_0_is_optional_in_type_1_but_required_in_type_2,
  Types_have_separate_declarations_of_a_private_property_0,
  Property_0_is_protected_but_type_1_is_not_a_class_derived_from_2,
  Property_0_is_protected_in_type_1_but_public_in_type_2,
  The_Object_type_is_assignable_to_very_few_other_types_Did_you_mean_to_use_the_any_type_instead,
  The_intersection_0_was_reduced_to_never_because_property_1_has_conflicting_types_in_some_constituents,
  The_intersection_0_was_reduced_to_never_because_property_1_exists_in_multiple_constituents_and_is_private_in_some,
  This_type_parameter_might_need_an_extends_0_constraint,
  Type_0_is_not_comparable_to_type_1,
  Type_0_is_not_assignable_to_type_1,
  Type_0_is_not_assignable_to_type_1_Did_you_mean_2,
  Type_0_is_not_assignable_to_type_1_Two_different_types_with_this_name_exist_but_they_are_unrelated,
  Type_0_is_not_assignable_to_type_1_with_exactOptionalPropertyTypes_Colon_true_Consider_adding_undefined_to_the_types_of_the_target_s_properties,
  Type_0_is_missing_the_following_properties_from_type_1_Colon_2,
  Type_0_is_missing_the_following_properties_from_type_1_Colon_2_and_3_more,
  Property_0_in_type_1_refers_to_a_different_member_that_cannot_be_accessed_from_within_type_2,
  X_0_is_declared_here,
  X_0_is_assignable_to_the_constraint_of_type_1_but_1_could_be_instantiated_with_a_different_subtype_of_constraint_2,
  X_0_could_be_instantiated_with_an_arbitrary_type_which_could_be_unrelated_to_1,
} from "../diagnostics/generated/messages.js";
import { Did_you_mean_to_mark_this_function_as_async, The_expected_type_comes_from_property_0_which_is_declared_here_on_type_1, The_expected_type_comes_from_the_return_type_of_this_signature, The_expected_type_comes_from_this_index_signature, Type_0_is_not_assignable_to_type_1_with_exactOptionalPropertyTypes_Colon_true_Consider_adding_undefined_to_the_type_of_the_target, Type_of_computed_property_s_value_is_0_which_is_not_assignable_to_type_1 } from "../diagnostics/generated/messages.js";
import type { CacheHashKey, Checker, EnumRelationKey, IntersectionFlags } from "./checker/state.js";
import { IntersectionFlagsNoConstraintReduction, CheckModeContextual, CheckModeForceTuple, MappedTypeModifiersIncludeOptional, MappedTypeModifiersExcludeOptional, InferenceFlagsNone, InferencePriorityNoConstraints, InferencePriorityAlwaysStrict } from "./checker/state.js";
import { getRelationKey, isFreshLiteralType, containsType, everyType, getMappedTypeModifiers, isSingleElementGenericTupleType, isMutableTupleType, isPartialMappedType, getStartElementCount, getEndElementCount, isConflictingPrivateProperty, countTypes } from "./checker/state.js";
import type { TypeMapper } from "./mapper.js";
import type { AccessFlags, ConditionalRoot, ElementFlags, ExportTypeLinks, IndexInfo, Signature, SignatureKind, StructuredType, TemplateLiteralType, Ternary, TupleElementInfo, TupleType, Type, TypeAlias, TypeComparer, TypeFlags, TypeId, TypePredicate, TypePredicateKind, VarianceFlags, VarianceLinks } from "./types.js";
import { TernaryFalse, TernaryTrue, TernaryMaybe, TernaryUnknown, TypeFlagsNever, TypeFlagsObject, TypeFlagsString, TypeFlagsNumber, TypeFlagsBigInt, TypeFlagsBoolean, TypeFlagsESSymbol, TypeFlagsStringLiteral, TypeFlagsNumberLiteral, TypeFlagsBigIntLiteral, TypeFlagsBooleanLiteral, TypeFlagsBigIntLike, TypeFlagsBooleanLike, TypeFlagsESSymbolLike, TypeFlagsStringLike, TypeFlagsNumberLike, TypeFlagsEnum, TypeFlagsEnumLiteral, TypeFlagsEnumLike, TypeFlagsUndefined, TypeFlagsNull, TypeFlagsUnionOrIntersection, TypeFlagsVoid, TypeFlagsNonPrimitive, TypeFlagsAny, TypeFlagsUnknown, TypeFlagsSingleton, TypeFlagsStructuredOrInstantiable, TypeFlagsUnion, TypeFlagsIntersection, TypeFlagsConditional, TypeFlagsSubstitution, TypeFlagsIndexedAccess, TypeFlagsLiteral, TypeFlagsTypeParameter, TypeFlagsTypeVariable, TypeFlagsTemplateLiteral, TypeFlagsStringMapping, TypeFlagsInstantiable, TypeFlagsInstantiableNonPrimitive, TypeFlagsUnit, TypeFlagsDefinitelyNonNullable, TypeFlagsNullable, TypeFlagsPrimitive, TypeFlagsIndex, TypeFlagsInstantiablePrimitive, TypeFlagsStringOrNumberLiteralOrUnique, TypeFlagsStructuredType, TypeFlagsUniqueESSymbol, ObjectFlagsObjectLiteralPatternWithComputedProperties, ObjectFlagsFreshLiteral, ObjectFlagsReference, ObjectFlagsAnonymous, ObjectFlagsInstantiated, ObjectFlagsInstantiatedMapped, ObjectFlagsTuple, ObjectFlagsPrimitiveUnion, ObjectFlagsObjectLiteral, ObjectFlagsJsxAttributes, ObjectFlagsJSLiteral, ObjectFlagsNonInferrableType, ObjectFlagsMapped, VarianceFlagsCovariant, VarianceFlagsContravariant, VarianceFlagsInvariant, VarianceFlagsBivariant, VarianceFlagsIndependent, VarianceFlagsVarianceMask, VarianceFlagsUnmeasurable, VarianceFlagsUnreliable, VarianceFlagsAllowsStructuralFallback, AccessFlagsNone, AccessFlagsWriting, AccessFlagsNoIndexSignatures, IndexFlagsNoIndexSignatures, IndexFlagsNoReducibleCheck, Type_AsLiteralType, Type_AsSubstitutionType, Type_Types, Type_Target, Type_AsIndexType, Type_AsIndexedAccessType, Type_AsConditionalType, Type_AsInterfaceType, Type_AsTypeReference, Type_AsUnionType, Type_Distributed, Type_TargetTupleType, ElementFlagsVariable, ElementFlagsRest, ElementFlagsNone, ElementFlagsNonRest, ObjectFlagsObjectRestType, ObjectFlagsReverseMapped, Type_AsReverseMappedType, TypeFlagsDisjointDomains, Type_AsStringMappingType, Type_AsTemplateLiteralType, Type_AsMappedType, Type_AsIntrinsicType, Type_AsTypeParameter, SignatureKindCall, SignatureKindConstruct, InterfaceType_TypeParameters, SignatureFlagsAbstract, ObjectFlagsIsNeverIntersection, TypeFormatFlagsNoTypeReduction } from "./types.js";
import { UnionReductionNone } from "./checker/state.js";
import { Checker_IsEmptyAnonymousObjectType, Checker_isUnknownLikeUnionType, Checker_getBaseTypeOfEnumLikeType, Checker_getRegularTypeOfObjectLiteral, Checker_getIntersectionType, Checker_extractTypesOfKind, Checker_getModifiersTypeFromMappedType, Checker_filterType, Checker_maybeTypeOfKind, Checker_hasBaseType, Checker_isArrayType, Checker_isReadonlyArrayType, Checker_isFunctionObjectType, Checker_getTargetType, Checker_getRegularTypeOfLiteralType, Checker_getPropertiesOfObjectType, Checker_getPropertiesOfUnionOrIntersectionType, Checker_isGenericType, Checker_getReducedType, Checker_getUnionTypeEx, Checker_instantiateTypes, Checker_createPromiseType, Checker_createTypeReference, Checker_checkArrayLiteral, Checker_isTupleLikeType, Checker_getApparentType, Checker_getIntersectionTypeEx, Checker_getNormalizedType, Checker_getTemplateLiteralType, Checker_isArrayLikeType, Checker_isArrayOrTupleType, Checker_isMutableArrayOrTuple, Checker_isGenericMappedType, Checker_isGenericObjectType, Checker_isNonGenericObjectType, Checker_isGenericTupleType, Checker_getCombinedMappedTypeOptionality, Checker_getTemplateTypeFromMappedType, Checker_getTypeWithFacts, Checker_pushContextualType, Checker_popContextualType, Checker_intersectTypes, Checker_getApparentMappedTypeKeys, Checker_isEmptyArrayLiteralType, Checker_isEmptyObjectType, Checker_getTrueTypeFromConditionalType, Checker_getFalseTypeFromConditionalType, Checker_removeMissingType, Checker_getBaseTypeOfLiteralType, Checker_getSuggestedTypeForNonexistentStringLiteralType } from "./checker/types.js";
import { Checker_checkExpressionForMutableLocation, Checker_getEffectiveCheckNode } from "./checker/syntax-checking.js";
import { Checker_getTypeOfSymbol, Checker_getIndexInfosOfType, Checker_getIndexedAccessTypeOrUndefined, Checker_getLiteralTypeFromProperty, Checker_getNameTypeFromMappedType, Checker_getNonMissingTypeOfSymbol, Checker_getIndexTypeEx, Checker_isGenericIndexType, Checker_shouldDeferIndexType, Checker_getIndexTypeOfTypeEx, Checker_isMappedTypeGenericIndexedAccess, Checker_getPropertyNameFromIndex, Checker_getSuggestionForNonexistentProperty, Checker_getSymbolOfDeclaration, Checker_isExactOptionalPropertyMismatch } from "./checker/symbols.js";
import { Checker_getBaseConstraintOfType, Checker_getTypeAliasInstantiation, Checker_getConstraintOfType, Checker_getStringMappingType, Checker_getBaseConstraintOrType, Checker_getConstraintTypeFromMappedType, Checker_getSimplifiedTypeOrConstraint, Checker_getPermissiveInstantiation, Checker_getRestrictiveInstantiation, Checker_isMappedTypeWithKeyofConstraintDeclaration, Checker_hasNonCircularBaseConstraint, Checker_getDefaultConstraintOfConditionalType, Checker_getConstraintOfDistributiveConditionalType } from "./checker/inference.js";
import { Checker_newInferenceContext, Checker_inferTypes } from "./inference.js";
import { SameMap, Same, CountWhere, Every, Some, OrElse, Find, FirstOrNil } from "../core/core.js";
import { Checker_TypeToString, Checker_TypeToStringEx, Checker_typeToStringEx, Checker_typeToString, Checker_signatureToString, Checker_typePredicateToString, Checker_symbolToString, Checker_valueToString } from "./printer.js";
import { TypeFormatFlagsUseFullyQualifiedType } from "./types.js";
import { SymbolFlagsClass, SymbolFlagsOptional, SymbolFlagsEnumMember, SymbolFlagsRegularEnum, SymbolFlagsObjectLiteral, SymbolFlagsTypeLiteral, SymbolFlagsEnum, SymbolFlagsValueModule, SymbolFlagsPrototype, SymbolFlagsClassMember } from "../ast/symbolflags.js";
import { CheckFlagsPartial, CheckFlagsSyntheticProperty, CheckFlagsIsDiscriminantComputed, CheckFlagsIsDiscriminant, CheckFlagsNonUniformAndLiteral } from "../ast/checkflags.js";
import { isObjectOrArrayLiteralType, isLateBoundName, isStaticPrivateIdentifierProperty, isValidNumberString, isValidBigIntString, isNumericLiteralName, isTypeUsableAsPropertyName, getPropertyNameFromType, NewDiagnosticForNode, getDeclarationModifierFlagsFromSymbol } from "./utilities.js";
import { IsExpression, GetDeclarationOfKind, GetSymbolId, IsImportCall, IsInJSFile, FindAncestor, GetSourceFileOfNode, IsJsxOpeningLikeElement, IsObjectLiteralElement, IsConstAssertion, IsComputedNonLiteralName } from "../ast/utilities.js";
import { Checker_addOptionalityEx, Checker_isContextSensitive, Checker_getExactOptionalUnassignableProperties } from "./checker/support-queries.js";
import { Checker_getSingleBaseForNonAugmentingSubtype } from "./checker/relations.js";
import { Checker_getJsxType, JsxNames, Checker_getSuggestedSymbolForNonexistentJSXAttribute, Checker_elaborateJsxComponents } from "./jsx.js";
import { isTupleType, isUnitType, signatureHasRestParameter, isLiteralType } from "./checker/state.js";
import { Checker_resolveStructuredTypeMembers, Checker_getPropertyOfObjectType, Checker_getIndexInfoOfType, Checker_getPropertyOfType, Checker_getTypeOfPropertyOfType, Checker_getUnionOrIntersectionProperty, Checker_getDeclaredTypeOfSymbol, Checker_getParentOfSymbol, Checker_getEnumMemberValue, Checker_getPropertyOfUnionOrIntersectionType, Checker_isReadonlySymbol } from "./checker/symbols.js";
import { Checker_getDeclaringClass, Checker_isValidOverrideOf } from "./checker/classes.js";
import { Checker_getPropertiesOfType } from "./checker/types.js";
import { Checker_getApplicableIndexInfoForName, Checker_isTypeParameterPossiblyReferenced, Checker_getSignaturesOfType, Checker_getSignaturesOfStructuredType, Checker_getTypeOfPropertyOrIndexSignatureOfType, Checker_typeHasCallOrConstructSignatures, Checker_getApplicableIndexInfo, Checker_isApplicableIndexType, Checker_getTypeParameterFromMappedType, Checker_getErasedSignature } from "./checker/signatures.js";
import { AsConditionalTypeNode, AsMappedTypeNode } from "../ast/generated/casts.js";
import { IsPrivateIdentifier } from "../ast/generated/predicates.js";
import { GetSymbolNameForPrivateIdentifier } from "../binder/binder.js";
import { Checker_isErrorType } from "./checker/diagnostics.js";
import { newSimpleTypeMapper } from "./mapper.js";
import type { LinkStore } from "../core/linkstore.js";
import { LinkStore_Get, LinkStore_Has } from "../core/linkstore.js";
import * as slices from "../../go/slices.js";
import { SymbolFlagsTypeAlias } from "../ast/symbolflags.js";
import {
  Target_signature_provides_too_few_arguments_Expected_0_or_more_but_got_1,
  The_this_types_of_each_signature_are_incompatible,
  Types_of_parameters_0_and_1_are_incompatible,
  Signature_0_must_be_a_type_predicate,
  Call_signature_return_types_0_and_1_are_incompatible,
  Construct_signature_return_types_0_and_1_are_incompatible,
  Call_signatures_with_no_arguments_have_incompatible_return_types_0_and_1,
  Construct_signatures_with_no_arguments_have_incompatible_return_types_0_and_1,
  A_this_based_type_guard_is_not_compatible_with_a_parameter_based_type_guard,
  Type_predicate_0_is_not_assignable_to_1,
  Parameter_0_is_not_in_the_same_position_as_parameter_1,
  Property_0_is_missing_in_type_1,
  Each_declaration_of_0_1_differs_in_its_value_where_2_was_expected_but_3_was_given,
  One_value_of_0_1_is_the_string_2_and_the_other_is_assumed_to_be_an_unknown_numeric_value,
  Type_originates_at_this_import_A_namespace_style_import_cannot_be_called_or_constructed_and_will_cause_a_failure_at_runtime_Consider_using_a_default_import_or_import_require_here_instead,
} from "../diagnostics/generated/messages.js";
import { TypeFlagsAnyOrUnknown, ElementFlagsRequired, ElementFlagsOptional, ElementFlagsFixed, ElementFlagsVariadic, SignatureFlagsConstruct, SignatureFlagsIsUntypedSignatureInJSFile, TypePredicateKindThis, TypePredicateKindIdentifier, TypePredicateKindAssertsThis, TypePredicateKindAssertsIdentifier } from "./types.js";
import { UnionReductionLiteral, TypeSystemPropertyNameResolvedReturnType, someType, TypeFactsIsUndefinedOrNull, TypeFactsNEUndefined, getStringLiteralValue } from "./checker/state.js";
import { Checker_compareProperties } from "./checker/support.js";
import { IsTypeAny, hasDotDotDotToken, hasType, isObjectLiteralType } from "./utilities.js";
import { IsNamedTupleMember, IsParameterDeclaration, IsIdentifier, IsBindingElement, IsTypePredicateNode, IsThisTypeNode, IsJsxAttributes, IsJsxAttribute, IsSpreadAssignment, IsSetAccessorDeclaration, IsGetAccessorDeclaration, IsMethodDeclaration, IsShorthandPropertyAssignment, IsPropertyAssignment, IsOmittedExpression, IsBlock } from "../ast/generated/predicates.js";
import { IsFunctionLikeDeclaration } from "../ast/utilities.js";
import { Node_Body, Node_Expression, Node_Initializer, Node_Parameters, Node_Properties, Node_Text } from "../ast/ast.js";
import { Node_Elements, Node_Type, SourceFile_Path } from "../ast/ast.js";
import { FindIndex, AppendIfUnique, LastOrNil, MapIndex } from "../core/core.js";
import type { Number as JsNumber } from "../jsnum/jsnum.js";
import { Number_String } from "../jsnum/string.js";
import { GetFunctionFlags, FunctionFlagsAsync } from "../ast/functionflags.js";
import { KindUnknown, KindMethodDeclaration, KindMethodSignature, KindConstructor, KindIdentifier, KindArrayBindingPattern, KindEnumMember, KindAsExpression, KindJsxExpression, KindParenthesizedExpression, KindBinaryExpression, KindEqualsToken, KindCommaToken, KindObjectLiteralExpression, KindArrayLiteralExpression, KindArrowFunction, KindJsxAttributes } from "../ast/generated/kinds.js";
import { AsBinaryExpression, AsTypePredicateNode } from "../ast/generated/casts.js";
import {
  Checker_getTypeOfParameter,
  Checker_getReturnTypeOfSignature,
  Checker_getNonCircularReturnTypeOfSignature,
  Checker_getTypeArguments,
  Checker_getMinTypeArgumentCount,
  Checker_fillMissingTypeArguments,
  Checker_getTypeReferenceArity,
  Checker_getRestTypeOfTupleType,
  Checker_getSingleCallSignature,
  Checker_getCanonicalSignature,
  Checker_instantiateSignatureInContextOf,
  Checker_instantiateSignatureEx,
  Checker_getConstraintOrUnknownFromTypeParameter,
  Checker_getDefaultOrUnknownFromTypeParameter,
  Checker_getConstraintFromTypeParameter,
  Checker_getTypeWithThisArgument,
  Checker_cloneTypeParameter,
} from "./checker/signatures.js";
import { Checker_getIndexedAccessType } from "./checker/symbols.js";
import {
  Checker_createArrayType,
  Checker_createTupleType,
  Checker_createTupleTypeEx,
  Checker_getStringLiteralType,
  Checker_getNumberLiteralType,
  Checker_getUnionType,
  Checker_getUnionOrIntersectionType,
  Checker_getElementTypeOfArrayType,
  Checker_GetNonNullableType,
  Checker_getTypeFacts,
  Checker_getTypeFromTypeNode,
  Checker_instantiateType,
} from "./checker/types.js";
import { Checker_getIndexType } from "./checker/symbols.js";
import { Checker_getTypePredicateFromBody } from "./checker/flow-narrowing.js";
import { Checker_isDiscriminantWithNeverType } from "./checker/flow-narrowing.js";
import { Checker_findResolutionCycleStartIndex } from "./checker/symbols.js";
import { newTypeMapper } from "./mapper.js";
import type { Result } from "../evaluator/evaluator.js";
import { createDiagnosticForNode } from "./checker/state.js";
import { Tracer_Instant } from "./tracer.js";
import { PhaseCheckTypes } from "../tracing/tracing.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::SignatureCheckMode","kind":"type","status":"implemented","sigHash":"6b0118bf5541ca9032771b8ea433c037202512239fdbe62b39e231afb1506b47","bodyHash":"947fb20d37f95b65415be825a583827c09c6b3d891cdb2a5e8842545f55685bf"}
 *
 * Go source:
 * SignatureCheckMode uint32
 */
export type SignatureCheckMode = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::constGroup::SignatureCheckModeNone+SignatureCheckModeBivariantCallback+SignatureCheckModeStrictCallback+SignatureCheckModeIgnoreReturnTypes+SignatureCheckModeStrictArity+SignatureCheckModeStrictTopSignature+SignatureCheckModeCallback","kind":"constGroup","status":"implemented","sigHash":"298ffb696eee249aa700068ed55ed1a24ef8b1697b01300ed4a18d4e9f25ee23","bodyHash":"82acee3b05d22259d7592fe298d4404c0d0d901f0e4ce7f88c244b19079ec3f5"}
 *
 * Go source:
 * const (
 * 	SignatureCheckModeNone               SignatureCheckMode = 0
 * 	SignatureCheckModeBivariantCallback  SignatureCheckMode = 1 << 0
 * 	SignatureCheckModeStrictCallback     SignatureCheckMode = 1 << 1
 * 	SignatureCheckModeIgnoreReturnTypes  SignatureCheckMode = 1 << 2
 * 	SignatureCheckModeStrictArity        SignatureCheckMode = 1 << 3
 * 	SignatureCheckModeStrictTopSignature SignatureCheckMode = 1 << 4
 * 	SignatureCheckModeCallback           SignatureCheckMode = SignatureCheckModeBivariantCallback | SignatureCheckModeStrictCallback
 * )
 */
export const SignatureCheckModeNone: SignatureCheckMode = 0;
export const SignatureCheckModeBivariantCallback: SignatureCheckMode = 1 << 0;
export const SignatureCheckModeStrictCallback: SignatureCheckMode = 1 << 1;
export const SignatureCheckModeIgnoreReturnTypes: SignatureCheckMode = 1 << 2;
export const SignatureCheckModeStrictArity: SignatureCheckMode = 1 << 3;
export const SignatureCheckModeStrictTopSignature: SignatureCheckMode = 1 << 4;
export const SignatureCheckModeCallback: SignatureCheckMode = SignatureCheckModeBivariantCallback | SignatureCheckModeStrictCallback;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::MinArgumentCountFlags","kind":"type","status":"implemented","sigHash":"37946b6d515542477cfda7e497c2cc49940769c1000cd2de27f7563c0c316fa4","bodyHash":"95f261392d53e2d0f40ae8dc28175791d09a757e54ac86aba9d3eb80cc9f262a"}
 *
 * Go source:
 * MinArgumentCountFlags uint32
 */
export type MinArgumentCountFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::constGroup::MinArgumentCountFlagsNone+MinArgumentCountFlagsStrongArityForUntypedJS+MinArgumentCountFlagsVoidIsNonOptional","kind":"constGroup","status":"implemented","sigHash":"846c4357fd7698a594b99de529c5272ba9d4ac72c48bc05cca036fecb1cda5b7","bodyHash":"a34dccd14c3b907453268ce12b110a8eae13d31ac313ea4cbabec22edc189899"}
 *
 * Go source:
 * const (
 * 	MinArgumentCountFlagsNone                    MinArgumentCountFlags = 0
 * 	MinArgumentCountFlagsStrongArityForUntypedJS MinArgumentCountFlags = 1 << 0
 * 	MinArgumentCountFlagsVoidIsNonOptional       MinArgumentCountFlags = 1 << 1
 * )
 */
export const MinArgumentCountFlagsNone: MinArgumentCountFlags = 0;
export const MinArgumentCountFlagsStrongArityForUntypedJS: MinArgumentCountFlags = 1 << 0;
export const MinArgumentCountFlagsVoidIsNonOptional: MinArgumentCountFlags = 1 << 1;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::IntersectionState","kind":"type","status":"implemented","sigHash":"7c20c4fd6e1a1795e7a2c357348d51c1786f0364c65e7f7e10cbd294c6c3b7b5","bodyHash":"8f68708350c2142f29284d807a8e79f2fb82f02e886738b2fe6c5986f24370eb"}
 *
 * Go source:
 * IntersectionState uint32
 */
export type IntersectionState = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::constGroup::IntersectionStateNone+IntersectionStateSource+IntersectionStateTarget","kind":"constGroup","status":"implemented","sigHash":"7d2ba771b3a03b04085047eca6ff3044c470859c25d3ce09cdeffdb722d7b806","bodyHash":"9530f9bb43d1c27fc54b922868e5df01226ec90d17eee026582e4d7576f4fcfb"}
 *
 * Go source:
 * const (
 * 	IntersectionStateNone   IntersectionState = 0
 * 	IntersectionStateSource IntersectionState = 1 << 0 // Source type is a constituent of an outer intersection
 * 	IntersectionStateTarget IntersectionState = 1 << 1 // Target type is a constituent of an outer intersection
 * )
 */
export const IntersectionStateNone: IntersectionState = 0;
export const IntersectionStateSource: IntersectionState = 1 << 0; // Source type is a constituent of an outer intersection
export const IntersectionStateTarget: IntersectionState = 1 << 1; // Target type is a constituent of an outer intersection

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::RecursionFlags","kind":"type","status":"implemented","sigHash":"1db90bc2bb4d4df6c25497845600b91517b5e2608e47291b800b8280044b7aac","bodyHash":"1c357f47aed7bc3c1ddacd8024f413c597a4378d31071d61ac32b68a9de99bb0"}
 *
 * Go source:
 * RecursionFlags uint32
 */
export type RecursionFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::constGroup::RecursionFlagsNone+RecursionFlagsSource+RecursionFlagsTarget+RecursionFlagsBoth","kind":"constGroup","status":"implemented","sigHash":"bd5413f1c6bae7f2e8e8f00822d228e863c9ee43425345c00eaa54113886e815","bodyHash":"3133245efeb56329133131ad6fe28f2a6669f757aa7ed953017b166b0a28fb5e"}
 *
 * Go source:
 * const (
 * 	RecursionFlagsNone   RecursionFlags = 0
 * 	RecursionFlagsSource RecursionFlags = 1 << 0
 * 	RecursionFlagsTarget RecursionFlags = 1 << 1
 * 	RecursionFlagsBoth                  = RecursionFlagsSource | RecursionFlagsTarget
 * )
 */
export const RecursionFlagsNone: RecursionFlags = 0;
export const RecursionFlagsSource: RecursionFlags = 1 << 0;
export const RecursionFlagsTarget: RecursionFlags = 1 << 1;
export const RecursionFlagsBoth: int = RecursionFlagsSource | RecursionFlagsTarget;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::ExpandingFlags","kind":"type","status":"implemented","sigHash":"5536216ecf64736cd3b789854e16d643bb47b752bb45bec66b6f0bde6fd3e25a","bodyHash":"b9a45ece5eeda1ec67b69d9d1e9f57cc6eca212168cbb7225b47725f73edd850"}
 *
 * Go source:
 * ExpandingFlags uint8
 */
export type ExpandingFlags = byte;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::constGroup::ExpandingFlagsNone+ExpandingFlagsSource+ExpandingFlagsTarget+ExpandingFlagsBoth","kind":"constGroup","status":"implemented","sigHash":"0bd7fef147986c12e1fe12e32914d29b481c5eaf071f605ba3fdda9553a2b7a7","bodyHash":"af0f335af8287f96441e4906d64ebfaeca8458cb02be0268b4c56ee3f76fdcf9"}
 *
 * Go source:
 * const (
 * 	ExpandingFlagsNone   ExpandingFlags = 0
 * 	ExpandingFlagsSource ExpandingFlags = 1 << 0
 * 	ExpandingFlagsTarget ExpandingFlags = 1 << 1
 * 	ExpandingFlagsBoth                  = ExpandingFlagsSource | ExpandingFlagsTarget
 * )
 */
export const ExpandingFlagsNone: ExpandingFlags = 0;
export const ExpandingFlagsSource: ExpandingFlags = 1 << 0;
export const ExpandingFlagsTarget: ExpandingFlags = 1 << 1;
export const ExpandingFlagsBoth: int = ExpandingFlagsSource | ExpandingFlagsTarget;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::RelationComparisonResult","kind":"type","status":"implemented","sigHash":"acda68ec8eae2b817f42aa23ea91ff183231b03a3b99bff758ccf12487f95de4","bodyHash":"dc159a52d0eb40150213ff9f6b54d0f839383f7db8c070291cf688456e2e63f7"}
 *
 * Go source:
 * RelationComparisonResult uint32
 */
export type RelationComparisonResult = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::constGroup::RelationComparisonResultNone+RelationComparisonResultSucceeded+RelationComparisonResultFailed+RelationComparisonResultReportsUnmeasurable+RelationComparisonResultReportsUnreliable+RelationComparisonResultComplexityOverflow+RelationComparisonResultStackDepthOverflow+RelationComparisonResultReportsMask+RelationComparisonResultOverflow","kind":"constGroup","status":"implemented","sigHash":"d3eb4f292719141c643e32d240e063cb36a023b6bb8142aed09a01d4ae6c621b","bodyHash":"401097c9bee61cabea46077701ec5c56ab0f5d615164f791c164a26e050b41e3"}
 *
 * Go source:
 * const (
 * 	RelationComparisonResultNone                RelationComparisonResult = 0
 * 	RelationComparisonResultSucceeded           RelationComparisonResult = 1 << 0
 * 	RelationComparisonResultFailed              RelationComparisonResult = 1 << 1
 * 	RelationComparisonResultReportsUnmeasurable RelationComparisonResult = 1 << 3
 * 	RelationComparisonResultReportsUnreliable   RelationComparisonResult = 1 << 4
 * 	RelationComparisonResultComplexityOverflow  RelationComparisonResult = 1 << 5
 * 	RelationComparisonResultStackDepthOverflow  RelationComparisonResult = 1 << 6
 * 	RelationComparisonResultReportsMask                                  = RelationComparisonResultReportsUnmeasurable | RelationComparisonResultReportsUnreliable
 * 	RelationComparisonResultOverflow                                     = RelationComparisonResultComplexityOverflow | RelationComparisonResultStackDepthOverflow
 * )
 */
export const RelationComparisonResultNone: RelationComparisonResult = 0;
export const RelationComparisonResultSucceeded: RelationComparisonResult = 1 << 0;
export const RelationComparisonResultFailed: RelationComparisonResult = 1 << 1;
export const RelationComparisonResultReportsUnmeasurable: RelationComparisonResult = 1 << 3;
export const RelationComparisonResultReportsUnreliable: RelationComparisonResult = 1 << 4;
export const RelationComparisonResultComplexityOverflow: RelationComparisonResult = 1 << 5;
export const RelationComparisonResultStackDepthOverflow: RelationComparisonResult = 1 << 6;
export const RelationComparisonResultReportsMask: int = RelationComparisonResultReportsUnmeasurable | RelationComparisonResultReportsUnreliable;
export const RelationComparisonResultOverflow: int = RelationComparisonResultComplexityOverflow | RelationComparisonResultStackDepthOverflow;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::DiagnosticAndArguments","kind":"type","status":"implemented","sigHash":"1718f0fa121536480425484094f4a54afb0724c4eb5512dc080e451626ede2f5","bodyHash":"3585c49a0087cd18dc85ef80de058b359f9325d2d92dfe7e3690789f62c5e8fe"}
 *
 * Go source:
 * DiagnosticAndArguments struct {
 * 	message   *diagnostics.Message
 * 	arguments []any
 * }
 */
export interface DiagnosticAndArguments {
  message: GoPtr<Message>;
  "arguments": GoSlice<unknown>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::ErrorOutputContainer","kind":"type","status":"implemented","sigHash":"45e07bf3e59e2a9edc2ef146bbc90254642e6cdf1618ee87cf64cd652b7e128b","bodyHash":"cdbd0e637227b81b5b6d26bb5740bf53650610b205af34e85ce579f8892288e1"}
 *
 * Go source:
 * ErrorOutputContainer struct {
 * 	errors      []*ast.Diagnostic
 * 	skipLogging bool
 * }
 */
export interface ErrorOutputContainer {
  errors: GoSlice<GoPtr<Diagnostic>>;
  skipLogging: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::ErrorReporter","kind":"type","status":"implemented","sigHash":"710dbff2c60b639176ba8ae23925c4e30739f484d56a13bcdc6a165912a2d9f4","bodyHash":"7711ae982bb192fbd44c5c7e662f72e69f0334ca8c46bba4ad2626dbdf740c32"}
 *
 * Go source:
 * ErrorReporter func(message *diagnostics.Message, args ...any)
 */
export type ErrorReporter = (message: GoPtr<Message>, ...args: Array<unknown>) => void;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::RecursionId","kind":"type","status":"implemented","sigHash":"368c8aeb348677cd34967d0743746c23a0620b09f747f077a5fe903038586520","bodyHash":"46c6ddec8fc3f1448edadaba235205abf1f28d0db424e2de8486a3563cede39c"}
 *
 * Go source:
 * RecursionId struct {
 * 	value any
 * }
 */
export interface RecursionId {
  value: unknown;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::asRecursionId","kind":"func","status":"implemented","sigHash":"b51845ce830277b69e09682a1ff8c25d2c83965d90fe7cf4e69152cb63ca6c7f","bodyHash":"13ff3ecc7e5ce27bc8f3591a10e4cd32e0d25ef8dbe850554af38de62163c2b3"}
 *
 * Go source:
 * func asRecursionId[T *ast.Node | *ast.Symbol | *Type](value T) RecursionId {
 * 	return RecursionId{value: value}
 * }
 */
export function asRecursionId<T>(value: T): RecursionId {
  return { value };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::Relation","kind":"type","status":"implemented","sigHash":"3bdd3def27bbd7b3baed4129d95c0ebec3190d7dac25566a03665c1a49943054","bodyHash":"4c50301c896258c67bc82f86c06647f867933240dee8c00e094867c459d227f8"}
 *
 * Go source:
 * Relation struct {
 * 	results map[CacheHashKey]RelationComparisonResult
 * }
 */
export interface Relation {
  results: GoMap<CacheHashKey, RelationComparisonResult>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relation.get","kind":"method","status":"implemented","sigHash":"2e7886d5bf0cc3ae95518cb1e6ae4fc6183914764b81cfa8d3fcf26b3316c662","bodyHash":"79ba3aac73ad123e8562233ad155b45daa23892636ec332dd3936fb419ed4ca1"}
 *
 * Go source:
 * func (r *Relation) get(key CacheHashKey) RelationComparisonResult {
 * 	return r.results[key]
 * }
 */
export function Relation_get(receiver: GoPtr<Relation>, key: CacheHashKey): RelationComparisonResult {
  if (receiver!.results === undefined) {
    return RelationComparisonResultNone;
  }
  return receiver!.results.get(key) ?? RelationComparisonResultNone;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relation.set","kind":"method","status":"implemented","sigHash":"2abc29f8f1cca64d38d13100b1de165cde3ae4c3ab7f72170397b36046e86fc0","bodyHash":"db5a84fdee6634fd7c6570f19b3d425a6cb5aee8396fe7abb508159c4e4e706b"}
 *
 * Go source:
 * func (r *Relation) set(key CacheHashKey, result RelationComparisonResult) {
 * 	if r.results == nil {
 * 		r.results = make(map[CacheHashKey]RelationComparisonResult)
 * 	}
 * 	r.results[key] = result
 * }
 */
export function Relation_set(receiver: GoPtr<Relation>, key: CacheHashKey, result: RelationComparisonResult): void {
  if (receiver!.results === undefined) {
    receiver!.results = new globalThis.Map<CacheHashKey, RelationComparisonResult>();
  }
  receiver!.results.set(key, result);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relation.size","kind":"method","status":"implemented","sigHash":"56d071992668ef54977e209701b52475839edf734b9b8740c9b30e1b6f104601","bodyHash":"f1ff629e0e5aeb8d6144e1f9b93d23c97dedf5f0192bdb9a4b28f10ec44e27bd"}
 *
 * Go source:
 * func (r *Relation) size() int {
 * 	return len(r.results)
 * }
 */
export function Relation_size(receiver: GoPtr<Relation>): int {
  if (receiver!.results === undefined) {
    return 0;
  }
  return receiver!.results.size;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isTypeIdenticalTo","kind":"method","status":"implemented","sigHash":"a49f7d77f6557911108c60992e444f8e49e90d541a61583a3f4ae1ece77dd10b","bodyHash":"884e577f3653747ac42fc8cdc337824aa943b522775515cc8c6abf0f88462cf9"}
 *
 * Go source:
 * func (c *Checker) isTypeIdenticalTo(source *Type, target *Type) bool {
 * 	return c.isTypeRelatedTo(source, target, c.identityRelation)
 * }
 */
export function Checker_isTypeIdenticalTo(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  return Checker_isTypeRelatedTo(receiver, source, target, receiver!.identityRelation);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.compareTypesIdentical","kind":"method","status":"implemented","sigHash":"c6797b7b2e49af7fe31e17cafb30e6389da45bbe748734e14bd94a68962c2aa5","bodyHash":"8a962b625a05d66deda5ac00efb0dcf6e2835ef48b07bc5e3f5a2adef9f8fdc4"}
 *
 * Go source:
 * func (c *Checker) compareTypesIdentical(source *Type, target *Type) Ternary {
 * 	if c.isTypeRelatedTo(source, target, c.identityRelation) {
 * 		return TernaryTrue
 * 	}
 * 	return TernaryFalse
 * }
 */
export function Checker_compareTypesIdentical(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): Ternary {
  if (Checker_isTypeRelatedTo(receiver, source, target, receiver!.identityRelation)) {
    return TernaryTrue;
  }
  return TernaryFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.compareTypesAssignableSimple","kind":"method","status":"implemented","sigHash":"11cf7864c1c09a7d195c6e63bae4e38525eca78cc3900791bb84a92954704d97","bodyHash":"e630a3beab00946d1113f834c642632f00e91aa264bc0b108d0e7b6e7e5e5f3e"}
 *
 * Go source:
 * func (c *Checker) compareTypesAssignableSimple(source *Type, target *Type) Ternary {
 * 	if c.isTypeRelatedTo(source, target, c.assignableRelation) {
 * 		return TernaryTrue
 * 	}
 * 	return TernaryFalse
 * }
 */
export function Checker_compareTypesAssignableSimple(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): Ternary {
  if (Checker_isTypeRelatedTo(receiver, source, target, receiver!.assignableRelation)) {
    return TernaryTrue;
  }
  return TernaryFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.compareTypesAssignableWorker","kind":"method","status":"implemented","sigHash":"6e95d6ce76abce9f5e6783bd7a991395bf2caee9533dcae6774cb1fc9df3e7de","bodyHash":"566c3c62a21185141973e4bb52571990c0a2da36f61a5ce88fa1f25fa6aeddd6"}
 *
 * Go source:
 * func (c *Checker) compareTypesAssignableWorker(source *Type, target *Type, reportErrors bool) Ternary {
 * 	if c.isTypeRelatedTo(source, target, c.assignableRelation) {
 * 		return TernaryTrue
 * 	}
 * 	return TernaryFalse
 * }
 */
export function Checker_compareTypesAssignableWorker(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, reportErrors: bool): Ternary {
  if (Checker_isTypeRelatedTo(receiver, source, target, receiver!.assignableRelation)) {
    return TernaryTrue;
  }
  return TernaryFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.compareTypesSubtypeOf","kind":"method","status":"implemented","sigHash":"e7ec887fad8e097cff00f9558769928792e277781e056c2fdb5d759a1b8f6ed9","bodyHash":"e92c7445900cf897f2493f2435fd9df898267b45cfc3000192e2e892b733036d"}
 *
 * Go source:
 * func (c *Checker) compareTypesSubtypeOf(source *Type, target *Type) Ternary {
 * 	if c.isTypeRelatedTo(source, target, c.subtypeRelation) {
 * 		return TernaryTrue
 * 	}
 * 	return TernaryFalse
 * }
 */
export function Checker_compareTypesSubtypeOf(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): Ternary {
  if (Checker_isTypeRelatedTo(receiver, source, target, receiver!.subtypeRelation)) {
    return TernaryTrue;
  }
  return TernaryFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isTypeAssignableTo","kind":"method","status":"implemented","sigHash":"518682b14bf12f6fc3968e23e1eb4475163d5067ed42b8f1e0a1c2b116d09b1d","bodyHash":"c0a2d6a4db2332cc68df2ab2829f12d093d44cfd1ad4f7aa522cffa87a360dc2"}
 *
 * Go source:
 * func (c *Checker) isTypeAssignableTo(source *Type, target *Type) bool {
 * 	return c.isTypeRelatedTo(source, target, c.assignableRelation)
 * }
 */
export function Checker_isTypeAssignableTo(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  return Checker_isTypeRelatedTo(receiver, source, target, receiver!.assignableRelation);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isTypeSubtypeOf","kind":"method","status":"implemented","sigHash":"8cf4a1348d66d0a205bcda4a2f3622842c4b3603eb128104e9c7832e427f642f","bodyHash":"cbb61c4c256a9a16036055e28fe878d1155878d727cd4524e907c56313e3b05c"}
 *
 * Go source:
 * func (c *Checker) isTypeSubtypeOf(source *Type, target *Type) bool {
 * 	return c.isTypeRelatedTo(source, target, c.subtypeRelation)
 * }
 */
export function Checker_isTypeSubtypeOf(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  return Checker_isTypeRelatedTo(receiver, source, target, receiver!.subtypeRelation);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isTypeStrictSubtypeOf","kind":"method","status":"implemented","sigHash":"ebab9e3a79de899fcc54c8469bc762cb67fdcf24acd8bb14c62c4d809a7aba4e","bodyHash":"561e4edf00cc542f3b3df1a2bbc5f8b3e5e99c31bf84c7137bbe72f876dc7577"}
 *
 * Go source:
 * func (c *Checker) isTypeStrictSubtypeOf(source *Type, target *Type) bool {
 * 	return c.isTypeRelatedTo(source, target, c.strictSubtypeRelation)
 * }
 */
export function Checker_isTypeStrictSubtypeOf(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  return Checker_isTypeRelatedTo(receiver, source, target, receiver!.strictSubtypeRelation);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isTypeComparableTo","kind":"method","status":"implemented","sigHash":"d0cb8c5b0b2a66321a9e3ea4cffe6d4a7414ba1d84f0fd86e86e90b2bf72133b","bodyHash":"799a7b440b6c4d529eb9fc0a37603b0d5e00cb125904885ce5d2c189f880c040"}
 *
 * Go source:
 * func (c *Checker) isTypeComparableTo(source *Type, target *Type) bool {
 * 	return c.isTypeRelatedTo(source, target, c.comparableRelation)
 * }
 */
export function Checker_isTypeComparableTo(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  return Checker_isTypeRelatedTo(receiver, source, target, receiver!.comparableRelation);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.areTypesComparable","kind":"method","status":"implemented","sigHash":"b990f7e38008f22eaeeb2a8898336969c9cc3e723b084cf36e8ed57bbae8d345","bodyHash":"33bcdc0fb077f6da710784887d26de72dd7249b98e41dce774e06797222656cd"}
 *
 * Go source:
 * func (c *Checker) areTypesComparable(type1 *Type, type2 *Type) bool {
 * 	return c.isTypeComparableTo(type1, type2) || c.isTypeComparableTo(type2, type1)
 * }
 */
export function Checker_areTypesComparable(receiver: GoPtr<Checker>, type1: GoPtr<Type>, type2: GoPtr<Type>): bool {
  return Checker_isTypeComparableTo(receiver, type1, type2) || Checker_isTypeComparableTo(receiver, type2, type1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isTypeRelatedTo","kind":"method","status":"implemented","sigHash":"48fffae35b6de7e458a2b6498f80b352a901cf483785a31e82d0e49e86536886","bodyHash":"32ec186ca046c88366b2664e4f60717f85f50089b50d3f1dcc80cd7266b1cf91"}
 *
 * Go source:
 * func (c *Checker) isTypeRelatedTo(source *Type, target *Type, relation *Relation) bool {
 * 	if isFreshLiteralType(source) {
 * 		source = source.AsLiteralType().regularType
 * 	}
 * 	if isFreshLiteralType(target) {
 * 		target = target.AsLiteralType().regularType
 * 	}
 * 	if source == target {
 * 		return true
 * 	}
 * 	if relation != c.identityRelation {
 * 		if relation == c.comparableRelation && target.flags&TypeFlagsNever == 0 && c.isSimpleTypeRelatedTo(target, source, relation, nil) || c.isSimpleTypeRelatedTo(source, target, relation, nil) {
 * 			return true
 * 		}
 * 	} else if !((source.flags|target.flags)&(TypeFlagsUnionOrIntersection|TypeFlagsIndexedAccess|TypeFlagsConditional|TypeFlagsSubstitution) != 0) {
 * 		// We have excluded types that may simplify to other forms, so types must have identical flags
 * 		if source.flags != target.flags {
 * 			return false
 * 		}
 * 		if source.flags&TypeFlagsSingleton != 0 {
 * 			return true
 * 		}
 * 	}
 * 	if source.flags&TypeFlagsObject != 0 && target.flags&TypeFlagsObject != 0 {
 * 		id, _ := getRelationKey(source, target, IntersectionStateNone, relation == c.identityRelation, false)
 * 		related := relation.get(id)
 * 		if related != RelationComparisonResultNone {
 * 			return related&RelationComparisonResultSucceeded != 0
 * 		}
 * 	}
 * 	if source.flags&TypeFlagsStructuredOrInstantiable != 0 || target.flags&TypeFlagsStructuredOrInstantiable != 0 {
 * 		return c.checkTypeRelatedTo(source, target, relation, nil /*errorNode* /)
 * 	}
 * 	return false
 * }
 */
export function Checker_isTypeRelatedTo(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>): bool {
  if (isFreshLiteralType(source)) {
    source = Type_AsLiteralType(source)!.regularType;
  }
  if (isFreshLiteralType(target)) {
    target = Type_AsLiteralType(target)!.regularType;
  }
  if (source === target) {
    return true;
  }
  if (relation !== receiver!.identityRelation) {
    if (
      (relation === receiver!.comparableRelation && (target!.flags & TypeFlagsNever) === 0 && Checker_isSimpleTypeRelatedTo(receiver, target, source, relation, undefined as unknown as ErrorReporter)) ||
      Checker_isSimpleTypeRelatedTo(receiver, source, target, relation, undefined as unknown as ErrorReporter)
    ) {
      return true;
    }
  } else if (!((source!.flags | target!.flags) & (TypeFlagsUnionOrIntersection | TypeFlagsIndexedAccess | TypeFlagsConditional | TypeFlagsSubstitution))) {
    if (source!.flags !== target!.flags) {
      return false;
    }
    if (source!.flags & TypeFlagsSingleton) {
      return true;
    }
  }
  if ((source!.flags & TypeFlagsObject) !== 0 && (target!.flags & TypeFlagsObject) !== 0) {
    const [id] = getRelationKey(source, target, IntersectionStateNone, relation === receiver!.identityRelation, false);
    const related = Relation_get(relation, id);
    if (related !== RelationComparisonResultNone) {
      return (related & RelationComparisonResultSucceeded) !== 0;
    }
  }
  if ((source!.flags & TypeFlagsStructuredOrInstantiable) !== 0 || (target!.flags & TypeFlagsStructuredOrInstantiable) !== 0) {
    return Checker_checkTypeRelatedTo(receiver, source, target, relation, undefined);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isSimpleTypeRelatedTo","kind":"method","status":"implemented","sigHash":"25973bbee79279758fc57253e1b3c972235feabad8524c8c69eae18827a9881a","bodyHash":"9364d5c7ecb1c6d2640ec3d2997d2d13b99098768ba1baedca7b266f8423529f"}
 *
 * Go source:
 * func (c *Checker) isSimpleTypeRelatedTo(source *Type, target *Type, relation *Relation, errorReporter ErrorReporter) bool {
 * 	s := source.flags
 * 	t := target.flags
 * 	if t&TypeFlagsAny != 0 || s&TypeFlagsNever != 0 || source == c.wildcardType {
 * 		return true
 * 	}
 * 	if t&TypeFlagsUnknown != 0 && !(relation == c.strictSubtypeRelation && s&TypeFlagsAny != 0) {
 * 		return true
 * 	}
 * 	if t&TypeFlagsNever != 0 {
 * 		return false
 * 	}
 * 	if s&TypeFlagsStringLike != 0 && t&TypeFlagsString != 0 {
 * 		return true
 * 	}
 * 	if s&TypeFlagsStringLiteral != 0 && s&TypeFlagsEnumLiteral != 0 && t&TypeFlagsStringLiteral != 0 && t&TypeFlagsEnumLiteral == 0 && source.AsLiteralType().value == target.AsLiteralType().value {
 * 		return true
 * 	}
 * 	if s&TypeFlagsNumberLike != 0 && t&TypeFlagsNumber != 0 {
 * 		return true
 * 	}
 * 	if s&TypeFlagsNumberLiteral != 0 && s&TypeFlagsEnumLiteral != 0 && t&TypeFlagsNumberLiteral != 0 && t&TypeFlagsEnumLiteral == 0 && source.AsLiteralType().value == target.AsLiteralType().value {
 * 		return true
 * 	}
 * 	if s&TypeFlagsBigIntLike != 0 && t&TypeFlagsBigInt != 0 {
 * 		return true
 * 	}
 * 	if s&TypeFlagsBooleanLike != 0 && t&TypeFlagsBoolean != 0 {
 * 		return true
 * 	}
 * 	if s&TypeFlagsESSymbolLike != 0 && t&TypeFlagsESSymbol != 0 {
 * 		return true
 * 	}
 * 	if s&TypeFlagsEnum != 0 && t&TypeFlagsEnum != 0 && source.symbol.Name == target.symbol.Name && c.isEnumTypeRelatedTo(source.symbol, target.symbol, errorReporter) {
 * 		return true
 * 	}
 * 	if s&TypeFlagsEnumLiteral != 0 && t&TypeFlagsEnumLiteral != 0 {
 * 		if s&TypeFlagsUnion != 0 && t&TypeFlagsUnion != 0 && c.isEnumTypeRelatedTo(source.symbol, target.symbol, errorReporter) {
 * 			return true
 * 		}
 * 		if s&TypeFlagsLiteral != 0 && t&TypeFlagsLiteral != 0 && source.AsLiteralType().value == target.AsLiteralType().value && c.isEnumTypeRelatedTo(source.symbol, target.symbol, errorReporter) {
 * 			return true
 * 		}
 * 	}
 * 	// In non-strictNullChecks mode, `undefined` and `null` are assignable to anything except `never`.
 * 	// Since unions and intersections may reduce to `never`, we exclude them here.
 * 	if s&TypeFlagsUndefined != 0 && (!c.strictNullChecks && t&TypeFlagsUnionOrIntersection == 0 || t&(TypeFlagsUndefined|TypeFlagsVoid) != 0) {
 * 		return true
 * 	}
 * 	if s&TypeFlagsNull != 0 && (!c.strictNullChecks && t&TypeFlagsUnionOrIntersection == 0 || t&TypeFlagsNull != 0) {
 * 		return true
 * 	}
 * 	if s&TypeFlagsObject != 0 && t&TypeFlagsNonPrimitive != 0 && !(relation == c.strictSubtypeRelation && c.IsEmptyAnonymousObjectType(source) && source.objectFlags&ObjectFlagsFreshLiteral == 0) {
 * 		return true
 * 	}
 * 	if relation == c.assignableRelation || relation == c.comparableRelation {
 * 		if s&TypeFlagsAny != 0 {
 * 			return true
 * 		}
 * 		// Type number is assignable to any computed numeric enum type or any numeric enum literal type, and
 * 		// a numeric literal type is assignable any computed numeric enum type or any numeric enum literal type
 * 		// with a matching value. These rules exist such that enums can be used for bit-flag purposes.
 * 		if s&TypeFlagsNumber != 0 && (t&TypeFlagsEnum != 0 || t&TypeFlagsNumberLiteral != 0 && t&TypeFlagsEnumLiteral != 0) {
 * 			return true
 * 		}
 * 		if s&TypeFlagsNumberLiteral != 0 && s&TypeFlagsEnumLiteral == 0 && (t&TypeFlagsEnum != 0 || t&TypeFlagsNumberLiteral != 0 && t&TypeFlagsEnumLiteral != 0 && source.AsLiteralType().value == target.AsLiteralType().value) {
 * 			return true
 * 		}
 * 		// Anything is assignable to a union containing undefined, null, and {}
 * 		if c.isUnknownLikeUnionType(target) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_isSimpleTypeRelatedTo(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, errorReporter: ErrorReporter): bool {
  const s = source!.flags;
  const t = target!.flags;
  if ((t & TypeFlagsAny) !== 0 || (s & TypeFlagsNever) !== 0 || source === receiver!.wildcardType) {
    return true;
  }
  if ((t & TypeFlagsUnknown) !== 0 && !(relation === receiver!.strictSubtypeRelation && (s & TypeFlagsAny) !== 0)) {
    return true;
  }
  if ((t & TypeFlagsNever) !== 0) {
    return false;
  }
  if ((s & TypeFlagsStringLike) !== 0 && (t & TypeFlagsString) !== 0) {
    return true;
  }
  if ((s & TypeFlagsStringLiteral) !== 0 && (s & TypeFlagsEnumLiteral) !== 0 && (t & TypeFlagsStringLiteral) !== 0 && (t & TypeFlagsEnumLiteral) === 0 && Type_AsLiteralType(source)!.value === Type_AsLiteralType(target)!.value) {
    return true;
  }
  if ((s & TypeFlagsNumberLike) !== 0 && (t & TypeFlagsNumber) !== 0) {
    return true;
  }
  if ((s & TypeFlagsNumberLiteral) !== 0 && (s & TypeFlagsEnumLiteral) !== 0 && (t & TypeFlagsNumberLiteral) !== 0 && (t & TypeFlagsEnumLiteral) === 0 && Type_AsLiteralType(source)!.value === Type_AsLiteralType(target)!.value) {
    return true;
  }
  if ((s & TypeFlagsBigIntLike) !== 0 && (t & TypeFlagsBigInt) !== 0) {
    return true;
  }
  if ((s & TypeFlagsBooleanLike) !== 0 && (t & TypeFlagsBoolean) !== 0) {
    return true;
  }
  if ((s & TypeFlagsESSymbolLike) !== 0 && (t & TypeFlagsESSymbol) !== 0) {
    return true;
  }
  if ((s & TypeFlagsEnum) !== 0 && (t & TypeFlagsEnum) !== 0 && source!.symbol!.Name === target!.symbol!.Name && Checker_isEnumTypeRelatedTo(receiver, source!.symbol, target!.symbol, errorReporter)) {
    return true;
  }
  if ((s & TypeFlagsEnumLiteral) !== 0 && (t & TypeFlagsEnumLiteral) !== 0) {
    if ((s & TypeFlagsUnion) !== 0 && (t & TypeFlagsUnion) !== 0 && Checker_isEnumTypeRelatedTo(receiver, source!.symbol, target!.symbol, errorReporter)) {
      return true;
    }
    if ((s & TypeFlagsLiteral) !== 0 && (t & TypeFlagsLiteral) !== 0 && Type_AsLiteralType(source)!.value === Type_AsLiteralType(target)!.value && Checker_isEnumTypeRelatedTo(receiver, source!.symbol, target!.symbol, errorReporter)) {
      return true;
    }
  }
  if ((s & TypeFlagsUndefined) !== 0 && ((!receiver!.strictNullChecks && (t & TypeFlagsUnionOrIntersection) === 0) || (t & (TypeFlagsUndefined | TypeFlagsVoid)) !== 0)) {
    return true;
  }
  if ((s & TypeFlagsNull) !== 0 && ((!receiver!.strictNullChecks && (t & TypeFlagsUnionOrIntersection) === 0) || (t & TypeFlagsNull) !== 0)) {
    return true;
  }
  if ((s & TypeFlagsObject) !== 0 && (t & TypeFlagsNonPrimitive) !== 0 && !(relation === receiver!.strictSubtypeRelation && Checker_IsEmptyAnonymousObjectType(receiver, source) && (source!.objectFlags & ObjectFlagsFreshLiteral) === 0)) {
    return true;
  }
  if (relation === receiver!.assignableRelation || relation === receiver!.comparableRelation) {
    if ((s & TypeFlagsAny) !== 0) {
      return true;
    }
    if ((s & TypeFlagsNumber) !== 0 && ((t & TypeFlagsEnum) !== 0 || ((t & TypeFlagsNumberLiteral) !== 0 && (t & TypeFlagsEnumLiteral) !== 0))) {
      return true;
    }
    if ((s & TypeFlagsNumberLiteral) !== 0 && (s & TypeFlagsEnumLiteral) === 0 && ((t & TypeFlagsEnum) !== 0 || ((t & TypeFlagsNumberLiteral) !== 0 && (t & TypeFlagsEnumLiteral) !== 0 && Type_AsLiteralType(source)!.value === Type_AsLiteralType(target)!.value))) {
      return true;
    }
    if (Checker_isUnknownLikeUnionType(receiver, target)) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isEnumTypeRelatedTo","kind":"method","status":"implemented","sigHash":"cfe9263c5f75a07da88309c2204670dba706c7aa556038c2498e69f53b92a225","bodyHash":"9473286db74dd3585e3623cd65777ae853f85b176d35f4440007cec6c2abde80"}
 *
 * Go source:
 * func (c *Checker) isEnumTypeRelatedTo(source *ast.Symbol, target *ast.Symbol, errorReporter ErrorReporter) bool {
 * 	sourceSymbol := core.IfElse(source.Flags&ast.SymbolFlagsEnumMember != 0, c.getParentOfSymbol(source), source)
 * 	targetSymbol := core.IfElse(target.Flags&ast.SymbolFlagsEnumMember != 0, c.getParentOfSymbol(target), target)
 * 	if sourceSymbol == targetSymbol {
 * 		return true
 * 	}
 * 	if sourceSymbol.Name != targetSymbol.Name || sourceSymbol.Flags&ast.SymbolFlagsRegularEnum == 0 || targetSymbol.Flags&ast.SymbolFlagsRegularEnum == 0 {
 * 		return false
 * 	}
 * 	key := EnumRelationKey{sourceId: ast.GetSymbolId(sourceSymbol), targetId: ast.GetSymbolId(targetSymbol)}
 * 	if entry := c.enumRelation[key]; entry != RelationComparisonResultNone && !(entry&RelationComparisonResultFailed != 0 && errorReporter != nil) {
 * 		return entry&RelationComparisonResultSucceeded != 0
 * 	}
 * 	targetEnumType := c.getTypeOfSymbol(targetSymbol)
 * 	for _, sourceProperty := range c.getPropertiesOfType(c.getTypeOfSymbol(sourceSymbol)) {
 * 		if sourceProperty.Flags&ast.SymbolFlagsEnumMember != 0 {
 * 			targetProperty := c.getPropertyOfType(targetEnumType, sourceProperty.Name)
 * 			if targetProperty == nil || targetProperty.Flags&ast.SymbolFlagsEnumMember == 0 {
 * 				if errorReporter != nil {
 * 					errorReporter(diagnostics.Property_0_is_missing_in_type_1, c.symbolToString(sourceProperty), c.TypeToStringEx(c.getDeclaredTypeOfSymbol(targetSymbol), nil /*enclosingDeclaration* /, TypeFormatFlagsUseFullyQualifiedType, nil))
 * 				}
 * 				c.enumRelation[key] = RelationComparisonResultFailed
 * 				return false
 * 			}
 * 			sourceValue := c.getEnumMemberValue(ast.GetDeclarationOfKind(sourceProperty, ast.KindEnumMember)).Value
 * 			targetValue := c.getEnumMemberValue(ast.GetDeclarationOfKind(targetProperty, ast.KindEnumMember)).Value
 * 			if sourceValue != targetValue {
 * 				// If we have 2 enums with *known* values that differ, they are incompatible.
 * 				if sourceValue != nil && targetValue != nil {
 * 					if errorReporter != nil {
 * 						errorReporter(diagnostics.Each_declaration_of_0_1_differs_in_its_value_where_2_was_expected_but_3_was_given, c.symbolToString(targetSymbol), c.symbolToString(targetProperty), c.valueToString(targetValue), c.valueToString(sourceValue))
 * 					}
 * 					c.enumRelation[key] = RelationComparisonResultFailed
 * 					return false
 * 				}
 * 				// At this point we know that at least one of the values is 'undefined'.
 * 				// This may mean that we have an opaque member from an ambient enum declaration,
 * 				// or that we were not able to calculate it (which is basically an error).
 * 				//
 * 				// Either way, we can assume that it's numeric.
 * 				// If the other is a string, we have a mismatch in types.
 * 				_, sourceIsString := sourceValue.(string)
 * 				_, targetIsString := targetValue.(string)
 * 				if sourceIsString || targetIsString {
 * 					if errorReporter != nil {
 * 						knownStringValue := core.OrElse(sourceValue, targetValue)
 * 						errorReporter(diagnostics.One_value_of_0_1_is_the_string_2_and_the_other_is_assumed_to_be_an_unknown_numeric_value, c.symbolToString(targetSymbol), c.symbolToString(targetProperty), c.valueToString(knownStringValue))
 * 					}
 * 					c.enumRelation[key] = RelationComparisonResultFailed
 * 					return false
 * 				}
 * 			}
 * 		}
 * 	}
 * 	c.enumRelation[key] = RelationComparisonResultSucceeded
 * 	return true
 * }
 */
export function Checker_isEnumTypeRelatedTo(receiver: GoPtr<Checker>, source: GoPtr<Symbol>, target: GoPtr<Symbol>, errorReporter: ErrorReporter): bool {
  const sourceSymbol = (source!.Flags & SymbolFlagsEnumMember) !== 0 ? Checker_getParentOfSymbol(receiver, source) : source;
  const targetSymbol = (target!.Flags & SymbolFlagsEnumMember) !== 0 ? Checker_getParentOfSymbol(receiver, target) : target;
  if (sourceSymbol === targetSymbol) {
    return true as bool;
  }
  if (sourceSymbol!.Name !== targetSymbol!.Name || (sourceSymbol!.Flags & SymbolFlagsRegularEnum) === 0 || (targetSymbol!.Flags & SymbolFlagsRegularEnum) === 0) {
    return false as bool;
  }
  const key: EnumRelationKey = { sourceId: GetSymbolId(sourceSymbol), targetId: GetSymbolId(targetSymbol) };
  const entry = receiver!.enumRelation.get(key);
  if (entry !== undefined && entry !== RelationComparisonResultNone && !((entry & RelationComparisonResultFailed) !== 0 && errorReporter !== undefined)) {
    return ((entry & RelationComparisonResultSucceeded) !== 0) as bool;
  }
  const targetEnumType = Checker_getTypeOfSymbol(receiver, targetSymbol);
  for (const sourceProperty of Checker_getPropertiesOfType(receiver, Checker_getTypeOfSymbol(receiver, sourceSymbol)) ?? []) {
    if ((sourceProperty!.Flags & SymbolFlagsEnumMember) !== 0) {
      const targetProperty = Checker_getPropertyOfType(receiver, targetEnumType, sourceProperty!.Name);
      if (targetProperty === undefined || (targetProperty!.Flags & SymbolFlagsEnumMember) === 0) {
        if (errorReporter !== undefined) {
          errorReporter(Property_0_is_missing_in_type_1, Checker_symbolToString(receiver, sourceProperty), Checker_typeToStringEx(receiver, Checker_getDeclaredTypeOfSymbol(receiver, targetSymbol), undefined, TypeFormatFlagsUseFullyQualifiedType, undefined));
        }
        receiver!.enumRelation.set(key, RelationComparisonResultFailed);
        return false as bool;
      }
      const sourceValue: Result = Checker_getEnumMemberValue(receiver, GetDeclarationOfKind(sourceProperty, KindEnumMember));
      const targetValue: Result = Checker_getEnumMemberValue(receiver, GetDeclarationOfKind(targetProperty, KindEnumMember));
      if (sourceValue.Value !== targetValue.Value) {
        if (sourceValue.Value !== undefined && targetValue.Value !== undefined) {
          if (errorReporter !== undefined) {
            errorReporter(Each_declaration_of_0_1_differs_in_its_value_where_2_was_expected_but_3_was_given, Checker_symbolToString(receiver, targetSymbol), Checker_symbolToString(receiver, targetProperty), Checker_valueToString(receiver, targetValue.Value), Checker_valueToString(receiver, sourceValue.Value));
          }
          receiver!.enumRelation.set(key, RelationComparisonResultFailed);
          return false as bool;
        }
        const sourceIsString = typeof sourceValue.Value === "string";
        const targetIsString = typeof targetValue.Value === "string";
        if (sourceIsString || targetIsString) {
          if (errorReporter !== undefined) {
            const knownStringValue = sourceValue.Value !== undefined ? sourceValue.Value : targetValue.Value;
            errorReporter(One_value_of_0_1_is_the_string_2_and_the_other_is_assumed_to_be_an_unknown_numeric_value, Checker_symbolToString(receiver, targetSymbol), Checker_symbolToString(receiver, targetProperty), Checker_valueToString(receiver, knownStringValue));
          }
          receiver!.enumRelation.set(key, RelationComparisonResultFailed);
          return false as bool;
        }
      }
    }
  }
  receiver!.enumRelation.set(key, RelationComparisonResultSucceeded);
  return true as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.checkTypeAssignableTo","kind":"method","status":"implemented","sigHash":"972f5e3e0d41634075096b864ac358ef833b4f99f84edd0d72668f34a67f3798","bodyHash":"17f82cacd3d1731c67ec8c6a60dac84abd0238b94aa977802163f88eb0998580"}
 *
 * Go source:
 * func (c *Checker) checkTypeAssignableTo(source *Type, target *Type, errorNode *ast.Node, headMessage *diagnostics.Message) bool {
 * 	return c.checkTypeRelatedToEx(source, target, c.assignableRelation, errorNode, headMessage, nil)
 * }
 */
export function Checker_checkTypeAssignableTo(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, errorNode: GoPtr<Node>, headMessage: GoPtr<Message>): bool {
  return Checker_checkTypeRelatedToEx(receiver, source, target, receiver!.assignableRelation, errorNode, headMessage, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.checkTypeAssignableToEx","kind":"method","status":"implemented","sigHash":"a8b9bc9bf54edb5a4d7dd1623cd506da8553b68f3d3d497dbcc53c55b9b351c7","bodyHash":"91dcd8f6991dc5824cd169040ca2c4a60623a1aa17f3c8b29c6ad99fd8d014da"}
 *
 * Go source:
 * func (c *Checker) checkTypeAssignableToEx(source *Type, target *Type, errorNode *ast.Node, headMessage *diagnostics.Message, diagnosticOutput *[]*ast.Diagnostic) bool {
 * 	return c.checkTypeRelatedToEx(source, target, c.assignableRelation, errorNode, headMessage, diagnosticOutput)
 * }
 */
export function Checker_checkTypeAssignableToEx(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, errorNode: GoPtr<Node>, headMessage: GoPtr<Message>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool {
  return Checker_checkTypeRelatedToEx(receiver, source, target, receiver!.assignableRelation, errorNode, headMessage, diagnosticOutput);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.checkTypeComparableTo","kind":"method","status":"implemented","sigHash":"0deb1d6027f42c755d603b3178c98083fc00939edcbf5738af173674d744aae9","bodyHash":"7101cf517534ca382c322028f642cfadcfa4cf45dcd853bd88282e7223ab0869"}
 *
 * Go source:
 * func (c *Checker) checkTypeComparableTo(source *Type, target *Type, errorNode *ast.Node, headMessage *diagnostics.Message) bool {
 * 	return c.checkTypeRelatedToEx(source, target, c.comparableRelation, errorNode, headMessage, nil)
 * }
 */
export function Checker_checkTypeComparableTo(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, errorNode: GoPtr<Node>, headMessage: GoPtr<Message>): bool {
  return Checker_checkTypeRelatedToEx(receiver, source, target, receiver!.comparableRelation, errorNode, headMessage, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.checkTypeRelatedTo","kind":"method","status":"implemented","sigHash":"0d0dab10fa637c8b3cb0558c7a874edb7c67d6e6d2d1133b2efa1c4c020ae5a0","bodyHash":"f6edd9d076087ef82eb1f690f45f544d95a77b109a3bf33fecc7b8fd16e6ee7d"}
 *
 * Go source:
 * func (c *Checker) checkTypeRelatedTo(source *Type, target *Type, relation *Relation, errorNode *ast.Node) bool {
 * 	return c.checkTypeRelatedToEx(source, target, relation, errorNode, nil, nil)
 * }
 */
export function Checker_checkTypeRelatedTo(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, errorNode: GoPtr<Node>): bool {
  return Checker_checkTypeRelatedToEx(receiver, source, target, relation, errorNode, undefined, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.checkTypeRelatedToEx","kind":"method","status":"implemented","sigHash":"ceddbbf47f7929f5429bd11298355c5eb10fecc11a6925bceb6c10e3576bb008","bodyHash":"b7cdede2690d8e9dc45aa7fa3e5afed87cbdbfdb4b3ce6031eda1da229aa128b"}
 *
 * Go source:
 * func (c *Checker) checkTypeRelatedToEx(
 * 	source *Type,
 * 	target *Type,
 * 	relation *Relation,
 * 	errorNode *ast.Node,
 * 	headMessage *diagnostics.Message,
 * 	diagnosticOutput *[]*ast.Diagnostic,
 * ) bool {
 * 	r := c.getRelater()
 * 	r.relation = relation
 * 	r.errorNode = errorNode
 * 	r.relationCount = (16_000_000 - relation.size()) / 8
 * 	result := r.isRelatedToEx(source, target, RecursionFlagsBoth, errorNode != nil /*reportErrors* /, headMessage, IntersectionStateNone)
 * 	if r.overflow {
 * 		// Record this relation as having failed such that we don't attempt the overflowing operation again.
 * 		id, _ := getRelationKey(source, target, IntersectionStateNone, relation == c.identityRelation, false /*ignoreConstraints* /)
 * 		relation.set(id, RelationComparisonResultFailed|core.IfElse(r.relationCount <= 0, RelationComparisonResultComplexityOverflow, RelationComparisonResultStackDepthOverflow))
 * 		if tr := c.tracer; tr != nil {
 * 			tr.Instant(tracing.PhaseCheckTypes, "checkTypeRelatedTo_DepthLimit", map[string]any{"sourceId": source.id, "targetId": target.id, "depth": len(r.sourceStack), "targetDepth": len(r.targetStack)})
 * 		}
 * 		message := core.IfElse(r.relationCount <= 0, diagnostics.Excessive_complexity_comparing_types_0_and_1, diagnostics.Excessive_stack_depth_comparing_types_0_and_1)
 * 		if errorNode == nil {
 * 			errorNode = c.currentNode
 * 		}
 * 		c.reportDiagnostic(NewDiagnosticForNode(errorNode, message, c.TypeToString(source), c.TypeToString(target)), diagnosticOutput)
 * 	} else if r.errorChain != nil {
 * 		// Check if we should issue an extra diagnostic to produce a quickfix for a slightly incorrect import statement
 * 		if headMessage != nil && errorNode != nil && result == TernaryFalse && source.symbol != nil && c.exportTypeLinks.Has(source.symbol) {
 * 			links := c.exportTypeLinks.Get(source.symbol)
 * 			if links.originatingImport != nil && !ast.IsImportCall(links.originatingImport) {
 * 				helpfulRetry := c.checkTypeRelatedTo(c.getTypeOfSymbol(links.target), target, relation /*errorNode* /, nil)
 * 				if helpfulRetry {
 * 					// Likely an incorrect import. Issue a helpful diagnostic to produce a quickfix to change the import
 * 					r.relatedInfo = append(r.relatedInfo, createDiagnosticForNode(links.originatingImport, diagnostics.Type_originates_at_this_import_A_namespace_style_import_cannot_be_called_or_constructed_and_will_cause_a_failure_at_runtime_Consider_using_a_default_import_or_import_require_here_instead))
 * 				}
 * 			}
 * 		}
 * 		c.reportDiagnostic(createDiagnosticChainFromErrorChain(r.errorChain, r.errorNode, r.relatedInfo), diagnosticOutput)
 * 	}
 * 	c.putRelater(r)
 * 	return result != TernaryFalse
 * }
 */
export function Checker_checkTypeRelatedToEx(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, errorNode: GoPtr<Node>, headMessage: GoPtr<Message>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool {
  const r = Checker_getRelater(receiver);
  r!.relation = relation;
  r!.errorNode = errorNode;
  r!.relationCount = (16_000_000 - Relation_size(relation)) / 8;
  const result = Relater_isRelatedToEx(r, source, target, RecursionFlagsBoth, (errorNode !== undefined) as bool, headMessage, IntersectionStateNone);
  if (r!.overflow) {
    const [id] = getRelationKey(source, target, IntersectionStateNone, relation === receiver!.identityRelation, false as bool);
    Relation_set(relation, id, (RelationComparisonResultFailed | (r!.relationCount <= 0 ? RelationComparisonResultComplexityOverflow : RelationComparisonResultStackDepthOverflow)) as RelationComparisonResult);
    if (receiver!.tracer !== undefined) {
      Tracer_Instant(receiver!.tracer, PhaseCheckTypes, "checkTypeRelatedTo_DepthLimit", new globalThis.Map<string, unknown>([["sourceId", source!.id], ["targetId", target!.id], ["depth", r!.sourceStack.length], ["targetDepth", r!.targetStack.length]]));
    }
    const message = r!.relationCount <= 0 ? Excessive_complexity_comparing_types_0_and_1 : Excessive_stack_depth_comparing_types_0_and_1;
    let en = errorNode;
    if (en === undefined) {
      en = receiver!.currentNode;
    }
    Checker_reportDiagnostic(receiver, NewDiagnosticForNode(en, message, Checker_TypeToString(receiver, source), Checker_TypeToString(receiver, target)), diagnosticOutput);
  } else if (r!.errorChain !== undefined) {
    if (headMessage !== undefined && errorNode !== undefined && result === TernaryFalse && source!.symbol !== undefined && LinkStore_Has(receiver!.exportTypeLinks as GoPtr<LinkStore<GoPtr<Symbol>, ExportTypeLinks>>, source!.symbol)) {
      const links = LinkStore_Get<GoPtr<Symbol>, ExportTypeLinks>(receiver!.exportTypeLinks as GoPtr<LinkStore<GoPtr<Symbol>, ExportTypeLinks>>, source!.symbol)!;
      if (links.originatingImport !== undefined && !IsImportCall(links.originatingImport)) {
        const helpfulRetry = Checker_checkTypeRelatedTo(receiver, Checker_getTypeOfSymbol(receiver, links.target), target, relation, undefined);
        if (helpfulRetry) {
          r!.relatedInfo = [...(r!.relatedInfo ?? []), createDiagnosticForNode(links.originatingImport, Type_originates_at_this_import_A_namespace_style_import_cannot_be_called_or_constructed_and_will_cause_a_failure_at_runtime_Consider_using_a_default_import_or_import_require_here_instead)];
        }
      }
    }
    Checker_reportDiagnostic(receiver, createDiagnosticChainFromErrorChain(r!.errorChain, r!.errorNode, r!.relatedInfo), diagnosticOutput);
  }
  Checker_putRelater(receiver, r);
  return result !== TernaryFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::createDiagnosticChainFromErrorChain","kind":"func","status":"implemented","sigHash":"2e1b9005f98130e13bbf0debabe55b91f0ef27bf9f1906a7e14fba38438f8f4c","bodyHash":"25f604a42edeb4293b46e4c1256f08b747426f674a798a54874d3216850ecaf4"}
 *
 * Go source:
 * func createDiagnosticChainFromErrorChain(chain *ErrorChain, errorNode *ast.Node, relatedInfo []*ast.Diagnostic) *ast.Diagnostic {
 * 	for chain != nil && chain.message.ElidedInCompatibilityPyramid() {
 * 		chain = chain.next
 * 	}
 * 	if chain == nil {
 * 		return nil
 * 	}
 * 	next := createDiagnosticChainFromErrorChain(chain.next, errorNode, relatedInfo)
 * 	if next == nil {
 * 		return NewDiagnosticForNode(errorNode, chain.message, chain.args...).SetRelatedInfo(relatedInfo)
 * 	}
 * 	return ast.NewDiagnosticChain(next, chain.message, chain.args...)
 * }
 */
export function createDiagnosticChainFromErrorChain(chain: GoPtr<ErrorChain>, errorNode: GoPtr<Node>, relatedInfo: GoSlice<GoPtr<Diagnostic>>): GoPtr<Diagnostic> {
  while (chain !== undefined && Message_ElidedInCompatibilityPyramid(chain!.message)) {
    chain = chain!.next;
  }
  if (chain === undefined) {
    return undefined;
  }
  const next = createDiagnosticChainFromErrorChain(chain!.next, errorNode, relatedInfo);
  if (next === undefined) {
    return Diagnostic_SetRelatedInfo(NewDiagnosticForNode(errorNode, chain!.message, ...(chain!.args ?? [])), relatedInfo);
  }
  return NewDiagnosticChain(next, chain!.message, ...(chain!.args ?? []));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.reportDiagnostic","kind":"method","status":"implemented","sigHash":"894dad158033587ed0a325c337051d877625103b2b72d51a065aa4de1b3047a1","bodyHash":"38a3de5b21bbbddca4fa41912d1853bc0624ffac926970cd178024fa9b9d2f88"}
 *
 * Go source:
 * func (c *Checker) reportDiagnostic(diagnostic *ast.Diagnostic, diagnosticOutput *[]*ast.Diagnostic) {
 * 	if diagnostic != nil {
 * 		if diagnosticOutput != nil {
 * 			*diagnosticOutput = append(*diagnosticOutput, diagnostic)
 * 		} else {
 * 			c.diagnostics.Add(diagnostic)
 * 		}
 * 	}
 * }
 */
export function Checker_reportDiagnostic(receiver: GoPtr<Checker>, diagnostic: GoPtr<Diagnostic>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): void {
  if (diagnostic !== undefined) {
    if (diagnosticOutput !== undefined) {
      diagnosticOutput.push(diagnostic);
    } else {
      DiagnosticsCollection_Add(receiver!.diagnostics, diagnostic);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.checkTypeAssignableToAndOptionallyElaborate","kind":"method","status":"implemented","sigHash":"4db0d4f43f485c39b2d35b65a4917cac04a7a21a814eb64d706729c064060d66","bodyHash":"3fb2c8d80a6974d273442b269e10c7b48eced38a44e1af479b3b9f4ad18c96c5"}
 *
 * Go source:
 * func (c *Checker) checkTypeAssignableToAndOptionallyElaborate(source *Type, target *Type, errorNode *ast.Node, expr *ast.Node, headMessage *diagnostics.Message, diagnosticOutput *[]*ast.Diagnostic) bool {
 * 	return c.checkTypeRelatedToAndOptionallyElaborate(source, target, c.assignableRelation, errorNode, expr, headMessage, diagnosticOutput)
 * }
 */
export function Checker_checkTypeAssignableToAndOptionallyElaborate(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, errorNode: GoPtr<Node>, expr: GoPtr<Node>, headMessage: GoPtr<Message>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool {
  return Checker_checkTypeRelatedToAndOptionallyElaborate(receiver, source, target, receiver!.assignableRelation, errorNode, expr, headMessage, diagnosticOutput);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.checkTypeRelatedToAndOptionallyElaborate","kind":"method","status":"implemented","sigHash":"3be8c70b5de92c27dbd732a2715271d8d1f11bddde43258ac9bc64bddbe4f952","bodyHash":"4435d044edba7a4f83ee4486f165036629f497be74b0b8cb6bbfe4e8297943ee"}
 *
 * Go source:
 * func (c *Checker) checkTypeRelatedToAndOptionallyElaborate(source *Type, target *Type, relation *Relation, errorNode *ast.Node, expr *ast.Node, headMessage *diagnostics.Message, diagnosticOutput *[]*ast.Diagnostic) bool {
 * 	if c.isTypeRelatedTo(source, target, relation) {
 * 		return true
 * 	}
 * 	if errorNode != nil && !c.elaborateError(expr, source, target, relation, headMessage, diagnosticOutput) {
 * 		return c.checkTypeRelatedToEx(source, target, relation, errorNode, headMessage, diagnosticOutput)
 * 	}
 * 	return false
 * }
 */
export function Checker_checkTypeRelatedToAndOptionallyElaborate(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, errorNode: GoPtr<Node>, expr: GoPtr<Node>, headMessage: GoPtr<Message>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool {
  if (Checker_isTypeRelatedTo(receiver, source, target, relation)) {
    return true;
  }
  if (errorNode !== undefined && !Checker_elaborateError(receiver, expr, source, target, relation, headMessage, diagnosticOutput)) {
    return Checker_checkTypeRelatedToEx(receiver, source, target, relation, errorNode, headMessage, diagnosticOutput);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.elaborateError","kind":"method","status":"implemented","sigHash":"6c2b47e9295305411cca29b88706566c444b2efc2a1459d7fd556e4c1c2b0477","bodyHash":"b678a775715a2fe3f474dccbcb52de8ee94ee5c6429419e845e81944608ee96c"}
 *
 * Go source:
 * func (c *Checker) elaborateError(node *ast.Node, source *Type, target *Type, relation *Relation, headMessage *diagnostics.Message, diagnosticOutput *[]*ast.Diagnostic) bool {
 * 	if node == nil || c.isOrHasGenericConditional(target) {
 * 		return false
 * 	}
 * 	if c.elaborateDidYouMeanToCallOrConstruct(node, source, target, relation, SignatureKindConstruct, headMessage, diagnosticOutput) ||
 * 		c.elaborateDidYouMeanToCallOrConstruct(node, source, target, relation, SignatureKindCall, headMessage, diagnosticOutput) {
 * 		return true
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindAsExpression:
 * 		if !ast.IsConstAssertion(node) {
 * 			break
 * 		}
 * 		fallthrough
 * 	case ast.KindJsxExpression, ast.KindParenthesizedExpression:
 * 		return c.elaborateError(node.Expression(), source, target, relation, headMessage, diagnosticOutput)
 * 	case ast.KindBinaryExpression:
 * 		switch node.AsBinaryExpression().OperatorToken.Kind {
 * 		case ast.KindEqualsToken, ast.KindCommaToken:
 * 			return c.elaborateError(node.AsBinaryExpression().Right, source, target, relation, headMessage, diagnosticOutput)
 * 		}
 * 	case ast.KindObjectLiteralExpression:
 * 		return c.elaborateObjectLiteral(node, source, target, relation, diagnosticOutput)
 * 	case ast.KindArrayLiteralExpression:
 * 		return c.elaborateArrayLiteral(node, source, target, relation, diagnosticOutput)
 * 	case ast.KindArrowFunction:
 * 		return c.elaborateArrowFunction(node, source, target, relation, diagnosticOutput)
 * 	case ast.KindJsxAttributes:
 * 		return c.elaborateJsxComponents(node, source, target, relation, diagnosticOutput)
 * 	}
 * 	return false
 * }
 */
export function Checker_elaborateError(receiver: GoPtr<Checker>, node: GoPtr<Node>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, headMessage: GoPtr<Message>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool {
  if (node === undefined || Checker_isOrHasGenericConditional(receiver, target)) {
    return false;
  }
  if (
    Checker_elaborateDidYouMeanToCallOrConstruct(receiver, node, source, target, relation, SignatureKindConstruct, headMessage, diagnosticOutput) ||
    Checker_elaborateDidYouMeanToCallOrConstruct(receiver, node, source, target, relation, SignatureKindCall, headMessage, diagnosticOutput)
  ) {
    return true;
  }
  switch (node!.Kind) {
    case KindAsExpression:
      if (!IsConstAssertion(node)) {
        break;
      }
      return Checker_elaborateError(receiver, Node_Expression(node), source, target, relation, headMessage, diagnosticOutput);
    case KindJsxExpression:
    case KindParenthesizedExpression:
      return Checker_elaborateError(receiver, Node_Expression(node), source, target, relation, headMessage, diagnosticOutput);
    case KindBinaryExpression: {
      const opKind = AsBinaryExpression(node)!.OperatorToken!.Kind;
      switch (opKind) {
        case KindEqualsToken:
        case KindCommaToken:
          return Checker_elaborateError(receiver, AsBinaryExpression(node)!.Right, source, target, relation, headMessage, diagnosticOutput);
      }
      break;
    }
    case KindObjectLiteralExpression:
      return Checker_elaborateObjectLiteral(receiver, node, source, target, relation, diagnosticOutput);
    case KindArrayLiteralExpression:
      return Checker_elaborateArrayLiteral(receiver, node, source, target, relation, diagnosticOutput);
    case KindArrowFunction:
      return Checker_elaborateArrowFunction(receiver, node, source, target, relation, diagnosticOutput);
    case KindJsxAttributes:
      return Checker_elaborateJsxComponents(receiver, node, source, target, relation, diagnosticOutput);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isOrHasGenericConditional","kind":"method","status":"implemented","sigHash":"1ec8649d118766b3bf21b35e1454bed868db3d53425804610056e0641f5af654","bodyHash":"517a29986ba542f59bb8c229c8a952b618cc92d797028d0db823c3fdb115cf55"}
 *
 * Go source:
 * func (c *Checker) isOrHasGenericConditional(t *Type) bool {
 * 	return t.flags&TypeFlagsConditional != 0 || (t.flags&TypeFlagsIntersection != 0 && core.Some(t.Types(), c.isOrHasGenericConditional))
 * }
 */
export function Checker_isOrHasGenericConditional(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  return (t!.flags & TypeFlagsConditional) !== 0 || ((t!.flags & TypeFlagsIntersection) !== 0 && Type_Types(t)!.some((t: GoPtr<Type>) => Checker_isOrHasGenericConditional(receiver, t)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.elaborateDidYouMeanToCallOrConstruct","kind":"method","status":"implemented","sigHash":"56cc88cbc3b3324fd0b26ef3fde4c61a649402133b6b4c099afb57a200226916","bodyHash":"e98544c5e9f2a2a4ae041432be9fd1a905ac30e6c9059d6546912b2c896a5b91"}
 *
 * Go source:
 * func (c *Checker) elaborateDidYouMeanToCallOrConstruct(node *ast.Node, source *Type, target *Type, relation *Relation, kind SignatureKind, headMessage *diagnostics.Message, diagnosticOutput *[]*ast.Diagnostic) bool {
 * 	if core.Some(c.getSignaturesOfType(source, kind), func(s *Signature) bool {
 * 		returnType := c.getReturnTypeOfSignature(s)
 * 		return returnType.flags&(TypeFlagsAny|TypeFlagsNever) == 0 && c.checkTypeRelatedTo(returnType, target, relation, nil /*errorNode* /)
 * 	}) {
 * 		var diags []*ast.Diagnostic
 * 		if !c.checkTypeRelatedToEx(source, target, relation, node, headMessage, &diags) {
 * 			diagnostic := diags[0]
 * 			message := core.IfElse(kind == SignatureKindConstruct,
 * 				diagnostics.Did_you_mean_to_use_new_with_this_expression,
 * 				diagnostics.Did_you_mean_to_call_this_expression)
 * 			c.reportDiagnostic(diagnostic.AddRelatedInfo(createDiagnosticForNode(node, message)), diagnosticOutput)
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_elaborateDidYouMeanToCallOrConstruct(receiver: GoPtr<Checker>, node: GoPtr<Node>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, kind: SignatureKind, headMessage: GoPtr<Message>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool {
  if (
    Checker_getSignaturesOfType(receiver, source, kind).some((s: GoPtr<Signature>) => {
      const returnType = Checker_getReturnTypeOfSignature(receiver, s);
      return (returnType!.flags & (TypeFlagsAny | TypeFlagsNever)) === 0 && Checker_checkTypeRelatedTo(receiver, returnType, target, relation, undefined);
    })
  ) {
    const diags: GoSlice<GoPtr<Diagnostic>> = [];
    if (!Checker_checkTypeRelatedToEx(receiver, source, target, relation, node, headMessage, diags)) {
      const diagnostic = diags[0]!;
      const message = kind === SignatureKindConstruct ? Did_you_mean_to_use_new_with_this_expression : Did_you_mean_to_call_this_expression;
      Checker_reportDiagnostic(receiver, Diagnostic_AddRelatedInfo(diagnostic, createDiagnosticForNode(node, message)), diagnosticOutput);
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.elaborateObjectLiteral","kind":"method","status":"implemented","sigHash":"51394088b6364dfc5c8a158f22d3a13e5eb398ce4c6c7ba5aa2d995579122dce","bodyHash":"bd52bff4493ebd5df173a779e2665bf3ed1edc331b365dc119dd960ce44a0da6"}
 *
 * Go source:
 * func (c *Checker) elaborateObjectLiteral(node *ast.Node, source *Type, target *Type, relation *Relation, diagnosticOutput *[]*ast.Diagnostic) bool {
 * 	if target.flags&(TypeFlagsPrimitive|TypeFlagsNever) != 0 {
 * 		return false
 * 	}
 * 	reportedError := false
 * 	for _, prop := range node.Properties() {
 * 		if ast.IsSpreadAssignment(prop) {
 * 			continue
 * 		}
 * 		nameType := c.getLiteralTypeFromProperty(c.getSymbolOfDeclaration(prop), TypeFlagsStringOrNumberLiteralOrUnique, false)
 * 		if nameType == nil || nameType.flags&TypeFlagsNever != 0 {
 * 			continue
 * 		}
 * 		switch prop.Kind {
 * 		case ast.KindSetAccessor, ast.KindGetAccessor, ast.KindMethodDeclaration, ast.KindShorthandPropertyAssignment:
 * 			reportedError = c.elaborateElement(source, target, relation, prop.Name(), nil, nameType, nil, nil, diagnosticOutput) || reportedError
 * 		case ast.KindPropertyAssignment:
 * 			message := core.IfElse(ast.IsComputedNonLiteralName(prop.Name()), diagnostics.Type_of_computed_property_s_value_is_0_which_is_not_assignable_to_type_1, nil)
 * 			reportedError = c.elaborateElement(source, target, relation, prop.Name(), prop.Initializer(), nameType, message, nil, diagnosticOutput) || reportedError
 * 		}
 * 	}
 * 	return reportedError
 * }
 */
export function Checker_elaborateObjectLiteral(receiver: GoPtr<Checker>, node: GoPtr<Node>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool {
  if ((target!.flags & (TypeFlagsPrimitive | TypeFlagsNever)) !== 0) {
    return false;
  }
  let reportedError = false;
  for (const prop of Node_Properties(node) ?? []) {
    if (IsSpreadAssignment(prop)) {
      continue;
    }
    const nameType = Checker_getLiteralTypeFromProperty(receiver, Checker_getSymbolOfDeclaration(receiver, prop), TypeFlagsStringOrNumberLiteralOrUnique, false);
    if (nameType === undefined || (nameType!.flags & TypeFlagsNever) !== 0) {
      continue;
    }
    if (IsSetAccessorDeclaration(prop) || IsGetAccessorDeclaration(prop) || IsMethodDeclaration(prop) || IsShorthandPropertyAssignment(prop)) {
      reportedError = (Checker_elaborateElement(receiver, source, target, relation, Node_Name(prop), undefined, nameType, undefined, undefined, diagnosticOutput) || reportedError) as bool;
    } else if (IsPropertyAssignment(prop)) {
      const message = IsComputedNonLiteralName(Node_Name(prop)) ? Type_of_computed_property_s_value_is_0_which_is_not_assignable_to_type_1 : undefined;
      reportedError = (Checker_elaborateElement(receiver, source, target, relation, Node_Name(prop), Node_Initializer(prop), nameType, message, undefined, diagnosticOutput) || reportedError) as bool;
    }
  }
  return reportedError;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.elaborateArrayLiteral","kind":"method","status":"implemented","sigHash":"99e207f7e07f3376ad68bec403394380669cacd276ea16d57a5b2133197f74eb","bodyHash":"ce281459c9d63e13fdb836591c18146949772951635c1e2d791f1e16c6040348"}
 *
 * Go source:
 * func (c *Checker) elaborateArrayLiteral(node *ast.Node, source *Type, target *Type, relation *Relation, diagnosticOutput *[]*ast.Diagnostic) bool {
 * 	if target.flags&(TypeFlagsPrimitive|TypeFlagsNever) != 0 {
 * 		return false
 * 	}
 * 	if !c.isTupleLikeType(source) {
 * 		c.pushContextualType(node, target, false /*isCache* /)
 * 		source = c.checkArrayLiteral(node, CheckModeContextual|CheckModeForceTuple)
 * 		c.popContextualType()
 * 		if !c.isTupleLikeType(source) {
 * 			return false
 * 		}
 * 	}
 * 	reportedError := false
 * 	for i, element := range node.Elements() {
 * 		if ast.IsOmittedExpression(element) || c.isTupleLikeType(target) && c.getPropertyOfType(target, jsnum.Number(i).String()) == nil {
 * 			continue
 * 		}
 * 		nameType := c.getNumberLiteralType(jsnum.Number(i))
 * 		checkNode := c.getEffectiveCheckNode(element)
 * 		reportedError = c.elaborateElement(source, target, relation, checkNode, checkNode, nameType, nil, nil, diagnosticOutput) || reportedError
 * 	}
 * 	return reportedError
 * }
 */
export function Checker_elaborateArrayLiteral(receiver: GoPtr<Checker>, node: GoPtr<Node>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool {
  if ((target!.flags & (TypeFlagsPrimitive | TypeFlagsNever)) !== 0) {
    return false;
  }
  if (!Checker_isTupleLikeType(receiver, source)) {
    Checker_pushContextualType(receiver, node, target, false);
    source = Checker_checkArrayLiteral(receiver, node, (CheckModeContextual | CheckModeForceTuple) as typeof CheckModeContextual);
    Checker_popContextualType(receiver);
    if (!Checker_isTupleLikeType(receiver, source)) {
      return false;
    }
  }
  let reportedError = false;
  const elements = Node_Elements(node) ?? [];
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const indexName = Number_String(i as JsNumber);
    if (IsOmittedExpression(element) || (Checker_isTupleLikeType(receiver, target) && Checker_getPropertyOfType(receiver, target, indexName) === undefined)) {
      continue;
    }
    const nameType = Checker_getNumberLiteralType(receiver, i as JsNumber);
    const checkNode = Checker_getEffectiveCheckNode(receiver, element);
    reportedError = (Checker_elaborateElement(receiver, source, target, relation, checkNode, checkNode, nameType, undefined, undefined, diagnosticOutput) || reportedError) as bool;
  }
  return reportedError;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.elaborateElement","kind":"method","status":"implemented","sigHash":"cb460c5db11ffbde97f43c5f26a97504e374403f043a6ad41ed31c35bc854d5b","bodyHash":"c7f1a1fd7a7fdd4a3815326c48ebdc52481703b9fb18e3bdc49074935e1b02b9"}
 *
 * Go source:
 * func (c *Checker) elaborateElement(source *Type, target *Type, relation *Relation, prop *ast.Node, next *ast.Node, nameType *Type, errorMessage *diagnostics.Message, diagnosticFactory func(prop *ast.Node) *ast.Diagnostic, diagnosticOutput *[]*ast.Diagnostic) bool {
 * 	targetPropType := c.getBestMatchIndexedAccessTypeOrUndefined(source, target, nameType)
 * 	if targetPropType == nil || targetPropType.flags&TypeFlagsIndexedAccess != 0 {
 * 		// Don't elaborate on indexes on generic variables
 * 		return false
 * 	}
 * 	sourcePropType := c.getIndexedAccessTypeOrUndefined(source, nameType, AccessFlagsNone, nil, nil)
 * 	if sourcePropType == nil || c.checkTypeRelatedTo(sourcePropType, targetPropType, relation, nil /*errorNode* /) {
 * 		// Don't elaborate on indexes on generic variables or when types match
 * 		return false
 * 	}
 * 	if next != nil && c.elaborateError(next, sourcePropType, targetPropType, relation, nil /*headMessage* /, diagnosticOutput) {
 * 		return true
 * 	}
 * 	// Issue error on the prop itself, since the prop couldn't elaborate the error
 * 	var diags []*ast.Diagnostic
 * 	// Use the expression type, if available
 * 	specificSource := sourcePropType
 * 	if next != nil {
 * 		specificSource = c.checkExpressionForMutableLocationWithContextualType(next, sourcePropType)
 * 	}
 * 	if diagnosticFactory != nil {
 * 		// Use the custom diagnostic factory if provided (e.g., for JSX text children with dynamic error messages)
 * 		diags = append(diags, diagnosticFactory(prop))
 * 	} else if c.exactOptionalPropertyTypes && c.isExactOptionalPropertyMismatch(specificSource, targetPropType) {
 * 		diags = append(diags, createDiagnosticForNode(prop, diagnostics.Type_0_is_not_assignable_to_type_1_with_exactOptionalPropertyTypes_Colon_true_Consider_adding_undefined_to_the_type_of_the_target, c.TypeToString(specificSource), c.TypeToString(targetPropType)))
 * 	} else {
 * 		propName := c.getPropertyNameFromIndex(nameType, nil /*accessNode* /)
 * 		targetIsOptional := core.OrElse(c.getPropertyOfType(target, propName), c.unknownSymbol).Flags&ast.SymbolFlagsOptional != 0
 * 		sourceIsOptional := core.OrElse(c.getPropertyOfType(source, propName), c.unknownSymbol).Flags&ast.SymbolFlagsOptional != 0
 * 		targetPropType = c.removeMissingType(targetPropType, targetIsOptional)
 * 		sourcePropType = c.removeMissingType(sourcePropType, targetIsOptional && sourceIsOptional)
 * 		result := c.checkTypeRelatedToEx(specificSource, targetPropType, relation, prop, errorMessage, &diags)
 * 		if result && specificSource != sourcePropType {
 * 			// If for whatever reason the expression type doesn't yield an error, make sure we still issue an error on the sourcePropType
 * 			c.checkTypeRelatedToEx(sourcePropType, targetPropType, relation, prop, errorMessage, &diags)
 * 		}
 * 	}
 * 	if len(diags) == 0 {
 * 		return false
 * 	}
 * 	diagnostic := diags[0]
 * 	var propertyName string
 * 	var targetProp *ast.Symbol
 * 	if isTypeUsableAsPropertyName(nameType) {
 * 		propertyName = getPropertyNameFromType(nameType)
 * 		targetProp = c.getPropertyOfType(target, propertyName)
 * 	}
 * 	issuedElaboration := false
 * 	if targetProp == nil {
 * 		indexInfo := c.getApplicableIndexInfo(target, nameType)
 * 		if indexInfo != nil && indexInfo.declaration != nil && !c.program.IsSourceFileDefaultLibrary(ast.GetSourceFileOfNode(indexInfo.declaration).Path()) {
 * 			issuedElaboration = true
 * 			diagnostic.AddRelatedInfo(createDiagnosticForNode(indexInfo.declaration, diagnostics.The_expected_type_comes_from_this_index_signature))
 * 		}
 * 	}
 * 	if !issuedElaboration && (targetProp != nil && len(targetProp.Declarations) != 0 || target.symbol != nil && len(target.symbol.Declarations) != 0) {
 * 		var targetNode *ast.Node
 * 		if targetProp != nil && len(targetProp.Declarations) != 0 {
 * 			targetNode = targetProp.Declarations[0]
 * 		} else {
 * 			targetNode = target.symbol.Declarations[0]
 * 		}
 * 		if propertyName == "" || nameType.flags&TypeFlagsUniqueESSymbol != 0 {
 * 			propertyName = c.TypeToString(nameType)
 * 		}
 * 		if !c.program.IsSourceFileDefaultLibrary(ast.GetSourceFileOfNode(targetNode).Path()) {
 * 			diagnostic.AddRelatedInfo(createDiagnosticForNode(targetNode, diagnostics.The_expected_type_comes_from_property_0_which_is_declared_here_on_type_1, propertyName, c.TypeToString(target)))
 * 		}
 * 	}
 * 	c.reportDiagnostic(diagnostic, diagnosticOutput)
 * 	return true
 * }
 */
export function Checker_elaborateElement(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, prop: GoPtr<Node>, next: GoPtr<Node>, nameType: GoPtr<Type>, errorMessage: GoPtr<Message>, diagnosticFactory: GoPtr<(prop: GoPtr<Node>) => GoPtr<Diagnostic>>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool {
  let targetPropType = Checker_getBestMatchIndexedAccessTypeOrUndefined(receiver, source, target, nameType);
  if (targetPropType === undefined || (targetPropType!.flags & TypeFlagsIndexedAccess) !== 0) {
    return false;
  }
  let sourcePropType = Checker_getIndexedAccessTypeOrUndefined(receiver, source, nameType, AccessFlagsNone, undefined, undefined);
  if (sourcePropType === undefined || Checker_checkTypeRelatedTo(receiver, sourcePropType, targetPropType, relation, undefined)) {
    return false;
  }
  if (next !== undefined && Checker_elaborateError(receiver, next, sourcePropType, targetPropType, relation, undefined, diagnosticOutput)) {
    return true;
  }
  const diags: GoSlice<GoPtr<Diagnostic>> = [];
  let specificSource: GoPtr<Type> = sourcePropType;
  if (next !== undefined) {
    specificSource = Checker_checkExpressionForMutableLocationWithContextualType(receiver, next, sourcePropType);
  }
  if (diagnosticFactory !== undefined) {
    diags.push(diagnosticFactory(prop));
  } else if (receiver!.exactOptionalPropertyTypes && Checker_isExactOptionalPropertyMismatch(receiver, specificSource, targetPropType)) {
    diags.push(createDiagnosticForNode(prop, Type_0_is_not_assignable_to_type_1_with_exactOptionalPropertyTypes_Colon_true_Consider_adding_undefined_to_the_type_of_the_target, Checker_TypeToString(receiver, specificSource), Checker_TypeToString(receiver, targetPropType)));
  } else {
    const propName = Checker_getPropertyNameFromIndex(receiver, nameType, undefined);
    const targetIsOptional = (OrElse(Checker_getPropertyOfType(receiver, target, propName), receiver!.unknownSymbol)!.Flags & SymbolFlagsOptional) !== 0;
    const sourceIsOptional = (OrElse(Checker_getPropertyOfType(receiver, source, propName), receiver!.unknownSymbol)!.Flags & SymbolFlagsOptional) !== 0;
    targetPropType = Checker_removeMissingType(receiver, targetPropType, targetIsOptional);
    sourcePropType = Checker_removeMissingType(receiver, sourcePropType, (targetIsOptional && sourceIsOptional) as bool);
    const result = Checker_checkTypeRelatedToEx(receiver, specificSource, targetPropType, relation, prop, errorMessage, diags);
    if (result && specificSource !== sourcePropType) {
      Checker_checkTypeRelatedToEx(receiver, sourcePropType, targetPropType, relation, prop, errorMessage, diags);
    }
  }
  if (diags.length === 0) {
    return false;
  }
  const diagnostic = diags[0]!;
  let propertyName = "";
  let targetProp: GoPtr<Symbol>;
  if (isTypeUsableAsPropertyName(nameType)) {
    propertyName = getPropertyNameFromType(nameType);
    targetProp = Checker_getPropertyOfType(receiver, target, propertyName);
  }
  let issuedElaboration = false;
  if (targetProp === undefined) {
    const indexInfo = Checker_getApplicableIndexInfo(receiver, target, nameType);
    if (indexInfo !== undefined && indexInfo.declaration !== undefined && !receiver!.program.IsSourceFileDefaultLibrary(SourceFile_Path(GetSourceFileOfNode(indexInfo.declaration))!)) {
      issuedElaboration = true;
      Diagnostic_AddRelatedInfo(diagnostic, createDiagnosticForNode(indexInfo.declaration, The_expected_type_comes_from_this_index_signature));
    }
  }
  if (!issuedElaboration && ((targetProp !== undefined && (targetProp!.Declarations?.length ?? 0) !== 0) || (target!.symbol !== undefined && (target!.symbol!.Declarations?.length ?? 0) !== 0))) {
    let targetNode: GoPtr<Node>;
    if (targetProp !== undefined && (targetProp!.Declarations?.length ?? 0) !== 0) {
      targetNode = targetProp!.Declarations![0];
    } else {
      targetNode = target!.symbol!.Declarations![0];
    }
    if (propertyName === "" || (nameType!.flags & TypeFlagsUniqueESSymbol) !== 0) {
      propertyName = Checker_TypeToString(receiver, nameType);
    }
    if (!receiver!.program.IsSourceFileDefaultLibrary(SourceFile_Path(GetSourceFileOfNode(targetNode))!)) {
      Diagnostic_AddRelatedInfo(diagnostic, createDiagnosticForNode(targetNode, The_expected_type_comes_from_property_0_which_is_declared_here_on_type_1, propertyName, Checker_TypeToString(receiver, target)));
    }
  }
  Checker_reportDiagnostic(receiver, diagnostic, diagnosticOutput);
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getBestMatchIndexedAccessTypeOrUndefined","kind":"method","status":"implemented","sigHash":"89a409a89ca1e803d10670970087cfef4ab94fa3d3ff687e774ee68ff4c7e055","bodyHash":"4a331e50267b25cbe803ae167eba1b35e7c28f699838aaf88f0d5835c4b2e3cc"}
 *
 * Go source:
 * func (c *Checker) getBestMatchIndexedAccessTypeOrUndefined(source *Type, target *Type, nameType *Type) *Type {
 * 	idx := c.getIndexedAccessTypeOrUndefined(target, nameType, AccessFlagsNone, nil, nil)
 * 	if idx != nil {
 * 		return idx
 * 	}
 * 	if target.flags&TypeFlagsUnion != 0 {
 * 		best := c.getBestMatchingType(source, target, c.compareTypesAssignableSimple)
 * 		if best != nil {
 * 			return c.getIndexedAccessTypeOrUndefined(best, nameType, AccessFlagsNone, nil, nil)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getBestMatchIndexedAccessTypeOrUndefined(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, nameType: GoPtr<Type>): GoPtr<Type> {
  const idx = Checker_getIndexedAccessTypeOrUndefined(receiver, target, nameType, AccessFlagsNone, undefined, undefined);
  if (idx !== undefined) {
    return idx;
  }
  if ((target!.flags & TypeFlagsUnion) !== 0) {
    const best = Checker_getBestMatchingType(receiver, source, target, (s: GoPtr<Type>, t: GoPtr<Type>) => Checker_compareTypesAssignableSimple(receiver, s, t));
    if (best !== undefined) {
      return Checker_getIndexedAccessTypeOrUndefined(receiver, best, nameType, AccessFlagsNone, undefined, undefined);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.checkExpressionForMutableLocationWithContextualType","kind":"method","status":"implemented","sigHash":"e7a9e75ad3f82737259d27711ef383c1542bbccc15f1b1fba0c604647231c08c","bodyHash":"ab9297ab43e42018c71a7b9bc040ee96cc554beb6c2c5cb3aa949c58ac5b78cb"}
 *
 * Go source:
 * func (c *Checker) checkExpressionForMutableLocationWithContextualType(next *ast.Node, sourcePropType *Type) *Type {
 * 	c.pushContextualType(next, sourcePropType, false /*isCache* /)
 * 	result := c.checkExpressionForMutableLocation(next, CheckModeContextual)
 * 	c.popContextualType()
 * 	return result
 * }
 */
export function Checker_checkExpressionForMutableLocationWithContextualType(receiver: GoPtr<Checker>, next: GoPtr<Node>, sourcePropType: GoPtr<Type>): GoPtr<Type> {
  Checker_pushContextualType(receiver, next, sourcePropType, false);
  const result = Checker_checkExpressionForMutableLocation(receiver, next, CheckModeContextual);
  Checker_popContextualType(receiver);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.elaborateArrowFunction","kind":"method","status":"implemented","sigHash":"94ee497cdb5d1b28950e3ed117361996151ecc4aa7a06e6633de979758a7dde2","bodyHash":"c7ce508fdb73086d7caa5ec969761921c6687939937ea4302ea18fb37c2a5148"}
 *
 * Go source:
 * func (c *Checker) elaborateArrowFunction(node *ast.Node, source *Type, target *Type, relation *Relation, diagnosticOutput *[]*ast.Diagnostic) bool {
 * 	// Don't elaborate blocks or functions with annotated parameter types
 * 	if ast.IsBlock(node.Body()) || core.Some(node.Parameters(), hasType) {
 * 		return false
 * 	}
 * 	sourceSig := c.getSingleCallSignature(source)
 * 	if sourceSig == nil {
 * 		return false
 * 	}
 * 	targetSignatures := c.getSignaturesOfType(target, SignatureKindCall)
 * 	if len(targetSignatures) == 0 {
 * 		return false
 * 	}
 * 	returnExpression := node.Body()
 * 	sourceReturn := c.getReturnTypeOfSignature(sourceSig)
 * 	targetReturn := c.getUnionType(core.Map(targetSignatures, c.getReturnTypeOfSignature))
 * 	if c.checkTypeRelatedTo(sourceReturn, targetReturn, relation, nil /*errorNode* /) {
 * 		return false
 * 	}
 * 	if returnExpression != nil && c.elaborateError(returnExpression, sourceReturn, targetReturn, relation, nil /*headMessage* /, diagnosticOutput) {
 * 		return true
 * 	}
 * 	var diags []*ast.Diagnostic
 * 	c.checkTypeRelatedToEx(sourceReturn, targetReturn, relation, returnExpression, nil /*headMessage* /, &diags)
 * 	if len(diags) != 0 {
 * 		diagnostic := diags[0]
 * 		if target.symbol != nil && len(target.symbol.Declarations) != 0 {
 * 			diagnostic.AddRelatedInfo(createDiagnosticForNode(target.symbol.Declarations[0], diagnostics.The_expected_type_comes_from_the_return_type_of_this_signature))
 * 		}
 * 		if ast.GetFunctionFlags(node)&ast.FunctionFlagsAsync == 0 && c.getTypeOfPropertyOfType(sourceReturn, "then") == nil && c.checkTypeRelatedTo(c.createPromiseType(sourceReturn), targetReturn, relation, nil /*errorNode* /) {
 * 			diagnostic.AddRelatedInfo(createDiagnosticForNode(node, diagnostics.Did_you_mean_to_mark_this_function_as_async))
 * 		}
 * 		c.reportDiagnostic(diagnostic, diagnosticOutput)
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Checker_elaborateArrowFunction(receiver: GoPtr<Checker>, node: GoPtr<Node>, source: GoPtr<Type>, target: GoPtr<Type>, relation: GoPtr<Relation>, diagnosticOutput: GoPtr<GoSlice<GoPtr<Diagnostic>>>): bool {
  const body = Node_Body(node);
  if (IsBlock(body) || Some(Node_Parameters(node), hasType)) {
    return false;
  }
  const sourceSig = Checker_getSingleCallSignature(receiver, source);
  if (sourceSig === undefined) {
    return false;
  }
  const targetSignatures = Checker_getSignaturesOfType(receiver, target, SignatureKindCall);
  if (targetSignatures.length === 0) {
    return false;
  }
  const returnExpression = body;
  const sourceReturn = Checker_getReturnTypeOfSignature(receiver, sourceSig);
  const targetReturn = Checker_getUnionType(receiver, targetSignatures.map((signature: GoPtr<Signature>) => Checker_getReturnTypeOfSignature(receiver, signature)) as GoSlice<GoPtr<Type>>);
  if (Checker_checkTypeRelatedTo(receiver, sourceReturn, targetReturn, relation, undefined)) {
    return false;
  }
  if (returnExpression !== undefined && Checker_elaborateError(receiver, returnExpression, sourceReturn, targetReturn, relation, undefined, diagnosticOutput)) {
    return true;
  }
  const diags: GoSlice<GoPtr<Diagnostic>> = [];
  Checker_checkTypeRelatedToEx(receiver, sourceReturn, targetReturn, relation, returnExpression, undefined, diags);
  if (diags.length !== 0) {
    const diagnostic = diags[0]!;
    if (target!.symbol !== undefined && (target!.symbol!.Declarations?.length ?? 0) !== 0) {
      Diagnostic_AddRelatedInfo(diagnostic, createDiagnosticForNode(target!.symbol!.Declarations![0], The_expected_type_comes_from_the_return_type_of_this_signature));
    }
    if ((GetFunctionFlags(node) & FunctionFlagsAsync) === 0 && Checker_getTypeOfPropertyOfType(receiver, sourceReturn, "then") === undefined &&
      Checker_checkTypeRelatedTo(receiver, Checker_createPromiseType(receiver, sourceReturn), targetReturn, relation, undefined)) {
      Diagnostic_AddRelatedInfo(diagnostic, createDiagnosticForNode(node, Did_you_mean_to_mark_this_function_as_async));
    }
    Checker_reportDiagnostic(receiver, diagnostic, diagnosticOutput);
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isWeakType","kind":"method","status":"implemented","sigHash":"5d4ba14e5419b2fd66122c7aa7e1cfc4115c0d6ed46b62ae5962416236e77a5d","bodyHash":"6a34a3984110f57df3ec8704aebe714448527d660d6e1157613dc7f636e146ad"}
 *
 * Go source:
 * func (c *Checker) isWeakType(t *Type) bool {
 * 	if t.flags&TypeFlagsObject != 0 {
 * 		resolved := c.resolveStructuredTypeMembers(t)
 * 		return len(resolved.signatures) == 0 && len(resolved.indexInfos) == 0 && len(resolved.properties) > 0 && core.Every(resolved.properties, func(p *ast.Symbol) bool {
 * 			return p.Flags&ast.SymbolFlagsOptional != 0
 * 		})
 * 	}
 * 	if t.flags&TypeFlagsSubstitution != 0 {
 * 		return c.isWeakType(t.AsSubstitutionType().baseType)
 * 	}
 * 	if t.flags&TypeFlagsIntersection != 0 {
 * 		return core.Every(t.Types(), c.isWeakType)
 * 	}
 * 	return false
 * }
 */
export function Checker_isWeakType(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  if ((t!.flags & TypeFlagsObject) !== 0) {
    const resolved = Checker_resolveStructuredTypeMembers(receiver, t);
    const signatures = resolved!.signatures ?? [];
    const indexInfos = resolved!.indexInfos ?? [];
    const properties = resolved!.properties ?? [];
    return signatures.length === 0 && indexInfos.length === 0 && properties.length > 0 && properties.every((p: GoPtr<Symbol>) => (p!.Flags & SymbolFlagsOptional) !== 0);
  }
  if ((t!.flags & TypeFlagsSubstitution) !== 0) {
    return Checker_isWeakType(receiver, Type_AsSubstitutionType(t)!.baseType);
  }
  if ((t!.flags & TypeFlagsIntersection) !== 0) {
    return Type_Types(t)!.every((t2: GoPtr<Type>) => Checker_isWeakType(receiver, t2));
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.hasCommonProperties","kind":"method","status":"implemented","sigHash":"548cf7d7ef057e7ccb9ff2b217a055ac951a712291275f5f7fbc016b41e425e8","bodyHash":"08a6e61a2ad897df89d42c7ddd77568e73d8a993735714d2ad692a0fed0ebd6a"}
 *
 * Go source:
 * func (c *Checker) hasCommonProperties(source *Type, target *Type, isComparingJsxAttributes bool) bool {
 * 	for _, prop := range c.getPropertiesOfType(source) {
 * 		if c.isKnownProperty(target, prop.Name, isComparingJsxAttributes) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_hasCommonProperties(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, isComparingJsxAttributes: bool): bool {
  for (const prop of Checker_getPropertiesOfType(receiver, source)) {
    if (Checker_isKnownProperty(receiver, target, prop!.Name, isComparingJsxAttributes)) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isKnownProperty","kind":"method","status":"implemented","sigHash":"68640122796219e293ba69f058a8fb79c8f7b7109a26efd5ee8cc0daa11a7f91","bodyHash":"98851a6977bdf9901fa5d461286c155e1a6d68e550175e358257a001945b4d4d"}
 *
 * Go source:
 * func (c *Checker) isKnownProperty(targetType *Type, name string, isComparingJsxAttributes bool) bool {
 * 	if targetType.flags&TypeFlagsObject != 0 {
 * 		// For backwards compatibility a symbol-named property is satisfied by a string index signature. This
 * 		// is incorrect and inconsistent with element access expressions, where it is an error, so eventually
 * 		// we should remove this exception.
 * 		if c.getPropertyOfObjectType(targetType, name) != nil ||
 * 			c.getApplicableIndexInfoForName(targetType, name) != nil ||
 * 			isLateBoundName(name) && c.getIndexInfoOfType(targetType, c.stringType) != nil ||
 * 			isComparingJsxAttributes && isHyphenatedJsxName(name) {
 * 			// For JSXAttributes, if the attribute has a hyphenated name, consider that the attribute to be known.
 * 			return true
 * 		}
 * 	}
 * 	if targetType.flags&TypeFlagsSubstitution != 0 {
 * 		return c.isKnownProperty(targetType.AsSubstitutionType().baseType, name, isComparingJsxAttributes)
 * 	}
 * 	if targetType.flags&TypeFlagsUnionOrIntersection != 0 && isExcessPropertyCheckTarget(targetType) {
 * 		for _, t := range targetType.Types() {
 * 			if c.isKnownProperty(t, name, isComparingJsxAttributes) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_isKnownProperty(receiver: GoPtr<Checker>, targetType: GoPtr<Type>, name: string, isComparingJsxAttributes: bool): bool {
  if ((targetType!.flags & TypeFlagsObject) !== 0) {
    if (Checker_getPropertyOfObjectType(receiver, targetType, name) !== undefined ||
        Checker_getApplicableIndexInfoForName(receiver, targetType, name) !== undefined ||
        (isLateBoundName(name) && Checker_getIndexInfoOfType(receiver, targetType, receiver!.stringType) !== undefined) ||
        (isComparingJsxAttributes && isHyphenatedJsxName(name))) {
      return true;
    }
  }
  if ((targetType!.flags & TypeFlagsSubstitution) !== 0) {
    return Checker_isKnownProperty(receiver, Type_AsSubstitutionType(targetType)!.baseType, name, isComparingJsxAttributes);
  }
  if ((targetType!.flags & TypeFlagsUnionOrIntersection) !== 0 && isExcessPropertyCheckTarget(targetType)) {
    for (const t of Type_Types(targetType)!) {
      if (Checker_isKnownProperty(receiver, t, name, isComparingJsxAttributes)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::isHyphenatedJsxName","kind":"func","status":"implemented","sigHash":"2517ab0134208884e67946e8c3365d0a88348b9bcfdd2c476832eaa39e4cc3ec","bodyHash":"1eaee3c92c74b5f988c23f867ea2d750abe80bd14d86d2e250c8f67262fbc038"}
 *
 * Go source:
 * func isHyphenatedJsxName(name string) bool {
 * 	return strings.Contains(name, "-")
 * }
 */
export function isHyphenatedJsxName(name: string): bool {
  return name.includes("-");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::isExcessPropertyCheckTarget","kind":"func","status":"implemented","sigHash":"5d4c142368224809259f001d8e44f7785e8d57630d3dc37c5a9341f11726cd9a","bodyHash":"711a31eb4bc63140c45f3b909fb12f41afebab7fba0edff2b60b3412c067c7c8"}
 *
 * Go source:
 * func isExcessPropertyCheckTarget(t *Type) bool {
 * 	return t.flags&TypeFlagsObject != 0 && t.objectFlags&ObjectFlagsObjectLiteralPatternWithComputedProperties == 0 ||
 * 		t.flags&TypeFlagsNonPrimitive != 0 ||
 * 		t.flags&TypeFlagsSubstitution != 0 && isExcessPropertyCheckTarget(t.AsSubstitutionType().baseType) ||
 * 		t.flags&TypeFlagsUnion != 0 && core.Some(t.Types(), isExcessPropertyCheckTarget) ||
 * 		t.flags&TypeFlagsIntersection != 0 && core.Every(t.Types(), isExcessPropertyCheckTarget)
 * }
 */
export function isExcessPropertyCheckTarget(t: GoPtr<Type>): bool {
  return ((t!.flags & TypeFlagsObject) !== 0 && (t!.objectFlags & ObjectFlagsObjectLiteralPatternWithComputedProperties) === 0) ||
    (t!.flags & TypeFlagsNonPrimitive) !== 0 ||
    ((t!.flags & TypeFlagsSubstitution) !== 0 && isExcessPropertyCheckTarget(Type_AsSubstitutionType(t)!.baseType)) ||
    ((t!.flags & TypeFlagsUnion) !== 0 && Type_Types(t)!.some(isExcessPropertyCheckTarget)) ||
    ((t!.flags & TypeFlagsIntersection) !== 0 && Type_Types(t)!.every(isExcessPropertyCheckTarget));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isDeeplyNestedType","kind":"method","status":"implemented","sigHash":"d1a3550f357b80715134c05a2b53d69add0ec38d7ba3280512d2d14f9be0f65d","bodyHash":"a86781028183a7a6931ff7bf97d83e737aa0a824c13e0319c529cf5e09882fe1"}
 *
 * Go source:
 * func (c *Checker) isDeeplyNestedType(t *Type, stack []*Type, maxDepth int) bool {
 * 	if len(stack) >= maxDepth {
 * 		if t.objectFlags&ObjectFlagsInstantiatedMapped == ObjectFlagsInstantiatedMapped {
 * 			t = c.getMappedTargetWithSymbol(t)
 * 		}
 * 		if t.flags&TypeFlagsIntersection != 0 {
 * 			for _, t := range t.Types() {
 * 				if c.isDeeplyNestedType(t, stack, maxDepth) {
 * 					return true
 * 				}
 * 			}
 * 		}
 * 		identity := getRecursionIdentity(t)
 * 		count := 0
 * 		lastTypeId := TypeId(0)
 * 		for _, t := range stack {
 * 			if c.hasMatchingRecursionIdentity(t, identity) {
 * 				// We only count occurrences with a higher type id than the previous occurrence, since higher
 * 				// type ids are an indicator of newer instantiations caused by recursion.
 * 				if t.id >= lastTypeId {
 * 					count++
 * 					if count >= maxDepth {
 * 						return true
 * 					}
 * 				}
 * 				lastTypeId = t.id
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_isDeeplyNestedType(receiver: GoPtr<Checker>, t: GoPtr<Type>, stack: GoSlice<GoPtr<Type>>, maxDepth: int): bool {
  if (stack.length >= maxDepth) {
    let cur = t;
    if ((cur!.objectFlags & ObjectFlagsInstantiatedMapped) === ObjectFlagsInstantiatedMapped) {
      cur = Checker_getMappedTargetWithSymbol(receiver, cur);
    }
    if ((cur!.flags & TypeFlagsIntersection) !== 0) {
      for (const t2 of Type_Types(cur)!) {
        if (Checker_isDeeplyNestedType(receiver, t2, stack, maxDepth)) {
          return true;
        }
      }
    }
    const identity = getRecursionIdentity(cur);
    let count = 0;
    let lastTypeId: TypeId = 0;
    for (const stackT of stack) {
      if (Checker_hasMatchingRecursionIdentity(receiver, stackT, identity)) {
        if (stackT!.id >= lastTypeId) {
          count++;
          if (count >= maxDepth) {
            return true;
          }
        }
        lastTypeId = stackT!.id;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getMappedTargetWithSymbol","kind":"method","status":"implemented","sigHash":"ac35595995293f6ecf71ffa2e2799a7156a7578ca6484ce51f37e17f928df0b3","bodyHash":"5171cba11f17e246801975b18d871db67f24f8e9236e165626bfc8089e4c90aa"}
 *
 * Go source:
 * func (c *Checker) getMappedTargetWithSymbol(t *Type) *Type {
 * 	for {
 * 		if t.objectFlags&ObjectFlagsInstantiatedMapped == ObjectFlagsInstantiatedMapped {
 * 			target := c.getModifiersTypeFromMappedType(t)
 * 			if target != nil && (target.symbol != nil || target.flags&TypeFlagsIntersection != 0 &&
 * 				core.Some(target.Types(), func(t *Type) bool { return t.symbol != nil })) {
 * 				t = target
 * 				continue
 * 			}
 * 		}
 * 		return t
 * 	}
 * }
 */
export function Checker_getMappedTargetWithSymbol(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  let cur = t;
  while (true) {
    if ((cur!.objectFlags & ObjectFlagsInstantiatedMapped) === ObjectFlagsInstantiatedMapped) {
      const target = Checker_getModifiersTypeFromMappedType(receiver, cur);
      if (target !== undefined && (target!.symbol !== undefined || ((target!.flags & TypeFlagsIntersection) !== 0 && Type_Types(target)!.some((t2: GoPtr<Type>) => t2!.symbol !== undefined)))) {
        cur = target;
        continue;
      }
    }
    return cur;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.hasMatchingRecursionIdentity","kind":"method","status":"implemented","sigHash":"ff38f259471a52966ed810870f325cf857edaf7f70cc131d002264a4a8e75e3e","bodyHash":"8ea02d14d12965f5fa7a931430f6f7dcabafa2239f9ef1a146c0620c1df8619d"}
 *
 * Go source:
 * func (c *Checker) hasMatchingRecursionIdentity(t *Type, identity RecursionId) bool {
 * 	if t.objectFlags&ObjectFlagsInstantiatedMapped == ObjectFlagsInstantiatedMapped {
 * 		t = c.getMappedTargetWithSymbol(t)
 * 	}
 * 	if t.flags&TypeFlagsIntersection != 0 {
 * 		for _, t := range t.Types() {
 * 			if c.hasMatchingRecursionIdentity(t, identity) {
 * 				return true
 * 			}
 * 		}
 * 		return false
 * 	}
 * 	return getRecursionIdentity(t) == identity
 * }
 */
export function Checker_hasMatchingRecursionIdentity(receiver: GoPtr<Checker>, t: GoPtr<Type>, identity: RecursionId): bool {
  let cur = t;
  if ((cur!.objectFlags & ObjectFlagsInstantiatedMapped) === ObjectFlagsInstantiatedMapped) {
    cur = Checker_getMappedTargetWithSymbol(receiver, cur);
  }
  if ((cur!.flags & TypeFlagsIntersection) !== 0) {
    for (const t2 of Type_Types(cur)!) {
      if (Checker_hasMatchingRecursionIdentity(receiver, t2, identity)) {
        return true;
      }
    }
    return false;
  }
  return getRecursionIdentity(cur).value === identity.value;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::getRecursionIdentity","kind":"func","status":"implemented","sigHash":"480caa5e1dce7046727a2542aa372b9e65a9a545802b89f462e45eec4d70440c","bodyHash":"ddbc9346a2ffb1b930e4d3c2440f303b4bb25c346763a63566a9b4f3c7f44905"}
 *
 * Go source:
 * func getRecursionIdentity(t *Type) RecursionId {
 * 	// Object and array literals are known not to contain recursive references and don't need a recursion identity.
 * 	if t.flags&TypeFlagsObject != 0 && !isObjectOrArrayLiteralType(t) {
 * 		if t.objectFlags&ObjectFlagsReference != 0 && t.AsTypeReference().node != nil {
 * 			// Deferred type references are tracked through their associated AST node. This gives us finer
 * 			// granularity than using their associated target because each manifest type reference has a
 * 			// unique AST node.
 * 			return asRecursionId(t.AsTypeReference().node)
 * 		}
 * 		if t.symbol != nil && !(t.objectFlags&ObjectFlagsAnonymous != 0 && t.symbol.Flags&ast.SymbolFlagsClass != 0) {
 * 			// We track object types that have a symbol by that symbol (representing the origin of the type), but
 * 			// exclude the static side of a class since it shares its symbol with the instance side.
 * 			return asRecursionId(t.symbol)
 * 		}
 * 		if isTupleType(t) {
 * 			return asRecursionId(t.Target())
 * 		}
 * 	}
 * 	if t.flags&TypeFlagsTypeParameter != 0 && t.symbol != nil {
 * 		// We use the symbol of the type parameter such that all "fresh" instantiations of that type parameter
 * 		// have the same recursion identity.
 * 		return asRecursionId(t.symbol)
 * 	}
 * 	if t.flags&TypeFlagsIndexedAccess != 0 {
 * 		// Identity is the leftmost object type in a chain of indexed accesses, eg, in A[P1][P2][P3] it is A.
 * 		t = t.AsIndexedAccessType().objectType
 * 		for t.flags&TypeFlagsIndexedAccess != 0 {
 * 			t = t.AsIndexedAccessType().objectType
 * 		}
 * 		return asRecursionId(t)
 * 	}
 * 	if t.flags&TypeFlagsConditional != 0 {
 * 		// The root object represents the origin of the conditional type
 * 		return asRecursionId(t.AsConditionalType().root.node.AsNode())
 * 	}
 * 	return asRecursionId(t)
 * }
 */
export function getRecursionIdentity(t: GoPtr<Type>): RecursionId {
  if ((t!.flags & TypeFlagsObject) !== 0 && !isObjectOrArrayLiteralType(t)) {
    if ((t!.objectFlags & ObjectFlagsReference) !== 0 && Type_AsTypeReference(t)!.node !== undefined) {
      return asRecursionId(Type_AsTypeReference(t)!.node);
    }
    if (t!.symbol !== undefined && !((t!.objectFlags & ObjectFlagsAnonymous) !== 0 && (t!.symbol!.Flags & SymbolFlagsClass) !== 0)) {
      return asRecursionId(t!.symbol);
    }
    if (isTupleType(t)) {
      return asRecursionId(Type_Target(t));
    }
  }
  if ((t!.flags & TypeFlagsTypeParameter) !== 0 && t!.symbol !== undefined) {
    return asRecursionId(t!.symbol);
  }
  if ((t!.flags & TypeFlagsIndexedAccess) !== 0) {
    let cur = t!;
    while ((cur.flags & TypeFlagsIndexedAccess) !== 0) {
      cur = Type_AsIndexedAccessType(cur)!.objectType!;
    }
    return asRecursionId(cur);
  }
  if ((t!.flags & TypeFlagsConditional) !== 0) {
    return asRecursionId(Type_AsConditionalType(t)!.root!.node);
  }
  return asRecursionId(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getBestMatchingType","kind":"method","status":"implemented","sigHash":"dd6edb0e8ec661e0e787c810f28da5d259b0c534af41b0d04a53d853b8a0f424","bodyHash":"16da5fa0e4b2e33a692a48e714929e7979c0b1fa1983d0c66c2dd8456b941377"}
 *
 * Go source:
 * func (c *Checker) getBestMatchingType(source *Type, target *Type, isRelatedTo func(source *Type, target *Type) Ternary) *Type {
 * 	if t := c.findMatchingDiscriminantType(source, target, isRelatedTo); t != nil {
 * 		return t
 * 	}
 * 	if t := c.findMatchingTypeReferenceOrTypeAliasReference(source, target); t != nil {
 * 		return t
 * 	}
 * 	if t := c.findBestTypeForObjectLiteral(source, target); t != nil {
 * 		return t
 * 	}
 * 	if t := c.findBestTypeForInvokable(source, target, SignatureKindCall); t != nil {
 * 		return t
 * 	}
 * 	if t := c.findBestTypeForInvokable(source, target, SignatureKindConstruct); t != nil {
 * 		return t
 * 	}
 * 	return c.findMostOverlappyType(source, target)
 * }
 */
export function Checker_getBestMatchingType(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, isRelatedTo: (source: GoPtr<Type>, target: GoPtr<Type>) => Ternary): GoPtr<Type> {
  const discriminantType = Checker_findMatchingDiscriminantType(receiver, source, target, isRelatedTo);
  if (discriminantType !== undefined) {
    return discriminantType;
  }
  const matchingReference = Checker_findMatchingTypeReferenceOrTypeAliasReference(receiver, source, target);
  if (matchingReference !== undefined) {
    return matchingReference;
  }
  const objectLiteralType = Checker_findBestTypeForObjectLiteral(receiver, source, target);
  if (objectLiteralType !== undefined) {
    return objectLiteralType;
  }
  const callType = Checker_findBestTypeForInvokable(receiver, source, target, SignatureKindCall);
  if (callType !== undefined) {
    return callType;
  }
  const constructType = Checker_findBestTypeForInvokable(receiver, source, target, SignatureKindConstruct);
  if (constructType !== undefined) {
    return constructType;
  }
  return Checker_findMostOverlappyType(receiver, source, target);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.findMatchingTypeReferenceOrTypeAliasReference","kind":"method","status":"implemented","sigHash":"11ddf6144a7e61938cfa47f913ec69ab46eefb5e7dd3064397d970dd7af6c0dd","bodyHash":"6ae6fc57fdec44e8be3aad03aa0f3921f4e496a54d12bf229eaf98166cf2c529"}
 *
 * Go source:
 * func (c *Checker) findMatchingTypeReferenceOrTypeAliasReference(source *Type, unionTarget *Type) *Type {
 * 	sourceObjectFlags := source.objectFlags
 * 	if sourceObjectFlags&(ObjectFlagsReference|ObjectFlagsAnonymous) != 0 && unionTarget.flags&TypeFlagsUnion != 0 {
 * 		for _, target := range unionTarget.Types() {
 * 			if target.flags&TypeFlagsObject != 0 {
 * 				overlapObjFlags := sourceObjectFlags & target.objectFlags
 * 				if overlapObjFlags&ObjectFlagsReference != 0 && source.Target() == target.Target() {
 * 					return target
 * 				}
 * 				if overlapObjFlags&ObjectFlagsAnonymous != 0 && source.alias != nil && target.alias != nil && source.alias.symbol == target.alias.symbol {
 * 					return target
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_findMatchingTypeReferenceOrTypeAliasReference(receiver: GoPtr<Checker>, source: GoPtr<Type>, unionTarget: GoPtr<Type>): GoPtr<Type> {
  const sourceObjectFlags = source!.objectFlags;
  if ((sourceObjectFlags & (ObjectFlagsReference | ObjectFlagsAnonymous)) !== 0 && (unionTarget!.flags & TypeFlagsUnion) !== 0) {
    for (const target of Type_Types(unionTarget)!) {
      if ((target!.flags & TypeFlagsObject) !== 0) {
        const overlapObjFlags = sourceObjectFlags & target!.objectFlags;
        if ((overlapObjFlags & ObjectFlagsReference) !== 0 && Type_Target(source) === Type_Target(target)) {
          return target;
        }
        if ((overlapObjFlags & ObjectFlagsAnonymous) !== 0 && source!.alias !== undefined && target!.alias !== undefined && source!.alias.symbol === target!.alias.symbol) {
          return target;
        }
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.findBestTypeForInvokable","kind":"method","status":"implemented","sigHash":"8c15496608d7c468ba20a2ebdecc5a7428695edc559da3d92b745337f38129af","bodyHash":"2998d03b08d7b4f5c8fca42b42be15675907b4d87a97de0b94484199215c1a35"}
 *
 * Go source:
 * func (c *Checker) findBestTypeForInvokable(source *Type, unionTarget *Type, kind SignatureKind) *Type {
 * 	if len(c.getSignaturesOfType(source, kind)) != 0 {
 * 		return core.Find(unionTarget.Types(), func(t *Type) bool { return len(c.getSignaturesOfType(t, kind)) != 0 })
 * 	}
 * 	return nil
 * }
 */
export function Checker_findBestTypeForInvokable(receiver: GoPtr<Checker>, source: GoPtr<Type>, unionTarget: GoPtr<Type>, kind: SignatureKind): GoPtr<Type> {
  if (Checker_getSignaturesOfType(receiver, source, kind).length !== 0) {
    return Type_Types(unionTarget)!.find((t: GoPtr<Type>) => Checker_getSignaturesOfType(receiver, t, kind).length !== 0);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.findMostOverlappyType","kind":"method","status":"implemented","sigHash":"0d21238e7e1ccb873874569e4d8796331786f55ff745b35c078a2759d19cef87","bodyHash":"9777207c1018a90042fe077b992cd853ffa725d50a7fa867747276b813d3c593"}
 *
 * Go source:
 * func (c *Checker) findMostOverlappyType(source *Type, unionTarget *Type) *Type {
 * 	var bestMatch *Type
 * 	if source.flags&(TypeFlagsPrimitive|TypeFlagsInstantiablePrimitive) == 0 {
 * 		matchingCount := 0
 * 		for _, target := range unionTarget.Types() {
 * 			if target.flags&(TypeFlagsPrimitive|TypeFlagsInstantiablePrimitive) == 0 {
 * 				overlap := c.getIntersectionType([]*Type{c.getIndexType(source), c.getIndexType(target)})
 * 				if overlap.flags&TypeFlagsIndex != 0 {
 * 					// perfect overlap of keys
 * 					return target
 * 				} else if isUnitType(overlap) || overlap.flags&TypeFlagsUnion != 0 {
 * 					// We only want to account for literal types otherwise.
 * 					// If we have a union of index types, it seems likely that we
 * 					// needed to elaborate between two generic mapped types anyway.
 * 					length := 1
 * 					if overlap.flags&TypeFlagsUnion != 0 {
 * 						length = core.CountWhere(overlap.Types(), isUnitType)
 * 					}
 * 					if length >= matchingCount {
 * 						bestMatch = target
 * 						matchingCount = length
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return bestMatch
 * }
 */
export function Checker_findMostOverlappyType(receiver: GoPtr<Checker>, source: GoPtr<Type>, unionTarget: GoPtr<Type>): GoPtr<Type> {
  let bestMatch: GoPtr<Type>;
  if ((source!.flags & (TypeFlagsPrimitive | TypeFlagsInstantiablePrimitive)) === 0) {
    let matchingCount = 0;
    for (const target of Type_Types(unionTarget)!) {
      if ((target!.flags & (TypeFlagsPrimitive | TypeFlagsInstantiablePrimitive)) === 0) {
        const overlap = Checker_getIntersectionType(receiver, [Checker_getIndexType(receiver, source), Checker_getIndexType(receiver, target)]);
        if ((overlap!.flags & TypeFlagsIndex) !== 0) {
          return target;
        }
        if (isUnitType(overlap) || (overlap!.flags & TypeFlagsUnion) !== 0) {
          let length = 1;
          if ((overlap!.flags & TypeFlagsUnion) !== 0) {
            length = CountWhere(Type_Types(overlap)!, isUnitType);
          }
          if (length >= matchingCount) {
            bestMatch = target;
            matchingCount = length;
          }
        }
      }
    }
  }
  return bestMatch;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.findBestTypeForObjectLiteral","kind":"method","status":"implemented","sigHash":"52cfcd8702458687b8cb1e2f7733d359c43792f3d735dd6e465a442da5edaadc","bodyHash":"442b39a33105d665a6d8608f8193ea21d8f913f04e4e52afd8b18585173718a1"}
 *
 * Go source:
 * func (c *Checker) findBestTypeForObjectLiteral(source *Type, unionTarget *Type) *Type {
 * 	if source.objectFlags&ObjectFlagsObjectLiteral != 0 && someType(unionTarget, c.isArrayLikeType) {
 * 		return core.Find(unionTarget.Types(), func(t *Type) bool { return !c.isArrayLikeType(t) })
 * 	}
 * 	return nil
 * }
 */
export function Checker_findBestTypeForObjectLiteral(receiver: GoPtr<Checker>, source: GoPtr<Type>, unionTarget: GoPtr<Type>): GoPtr<Type> {
  if ((source!.objectFlags & ObjectFlagsObjectLiteral) !== 0 && someType(unionTarget, (t: GoPtr<Type>) => Checker_isArrayLikeType(receiver, t))) {
    return Type_Types(unionTarget)!.find((t: GoPtr<Type>) => !Checker_isArrayLikeType(receiver, t));
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.shouldReportUnmatchedPropertyError","kind":"method","status":"implemented","sigHash":"e0a4fd34ccae975fd83b900d49f137149026c4428ed93100306611e7ea3994d9","bodyHash":"7552e02649e20e2cbf15a73c1ca47b80134e28135bd0706a76bda237e66d4258"}
 *
 * Go source:
 * func (c *Checker) shouldReportUnmatchedPropertyError(source *Type, target *Type) bool {
 * 	typeCallSignatures := c.getSignaturesOfStructuredType(source, SignatureKindCall)
 * 	typeConstructSignatures := c.getSignaturesOfStructuredType(source, SignatureKindConstruct)
 * 	typeProperties := c.getPropertiesOfObjectType(source)
 * 	if (len(typeCallSignatures) != 0 || len(typeConstructSignatures) != 0) && len(typeProperties) == 0 {
 * 		if (len(c.getSignaturesOfType(target, SignatureKindCall)) != 0 && len(typeCallSignatures) != 0) ||
 * 			len(c.getSignaturesOfType(target, SignatureKindConstruct)) != 0 && len(typeConstructSignatures) != 0 {
 * 			// target has similar signature kinds to source, still focus on the unmatched property
 * 			return true
 * 		}
 * 		return false
 * 	}
 * 	return true
 * }
 */
export function Checker_shouldReportUnmatchedPropertyError(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  const typeCallSignatures = Checker_getSignaturesOfStructuredType(receiver, source, SignatureKindCall);
  const typeConstructSignatures = Checker_getSignaturesOfStructuredType(receiver, source, SignatureKindConstruct);
  const typeProperties = Checker_getPropertiesOfObjectType(receiver, source);
  if ((typeCallSignatures.length !== 0 || typeConstructSignatures.length !== 0) && typeProperties.length === 0) {
    if ((Checker_getSignaturesOfType(receiver, target, SignatureKindCall).length !== 0 && typeCallSignatures.length !== 0) ||
      Checker_getSignaturesOfType(receiver, target, SignatureKindConstruct).length !== 0 && typeConstructSignatures.length !== 0) {
      return true;
    }
    return false;
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getUnmatchedProperty","kind":"method","status":"implemented","sigHash":"9f04cd0fc977233c0e4fb59407f39236d098dff80902d54aaa04faaecf1627ac","bodyHash":"52dd7a746900da599ec37fcc70412c9cbe8c41c9d42f79cd889bb30f39eee6c3"}
 *
 * Go source:
 * func (c *Checker) getUnmatchedProperty(source *Type, target *Type, requireOptionalProperties bool, matchDiscriminantProperties bool) *ast.Symbol {
 * 	return c.getUnmatchedPropertiesWorker(source, target, requireOptionalProperties, matchDiscriminantProperties, nil)
 * }
 */
export function Checker_getUnmatchedProperty(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, requireOptionalProperties: bool, matchDiscriminantProperties: bool): GoPtr<Symbol> {
  return Checker_getUnmatchedPropertiesWorker(receiver, source, target, requireOptionalProperties, matchDiscriminantProperties, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getUnmatchedProperties","kind":"method","status":"implemented","sigHash":"a5893f8661e4bce5db1e050da252651a648f4cd34f3fce1f310cef816f47c13d","bodyHash":"349d0fafc6a64adea9e5a627976ffa420fcc1996a269363a8332c6325c9b0b47"}
 *
 * Go source:
 * func (c *Checker) getUnmatchedProperties(source *Type, target *Type, requireOptionalProperties bool, matchDiscriminantProperties bool) []*ast.Symbol {
 * 	var props []*ast.Symbol
 * 	c.getUnmatchedPropertiesWorker(source, target, requireOptionalProperties, matchDiscriminantProperties, &props)
 * 	return props
 * }
 */
export function Checker_getUnmatchedProperties(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, requireOptionalProperties: bool, matchDiscriminantProperties: bool): GoSlice<GoPtr<Symbol>> {
  const props: GoSlice<GoPtr<Symbol>> = [];
  Checker_getUnmatchedPropertiesWorker(receiver, source, target, requireOptionalProperties, matchDiscriminantProperties, props);
  return props;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getUnmatchedPropertiesWorker","kind":"method","status":"implemented","sigHash":"bd0299605cb3a5cb583e081f6b2e3666ae94e25e7097a3d71a2ff58aaf96d1e3","bodyHash":"69225d97e92269e896ef8532ed7e10a4e28dd5138e245370e01506cfb8a98488"}
 *
 * Go source:
 * func (c *Checker) getUnmatchedPropertiesWorker(source *Type, target *Type, requireOptionalProperties bool, matchDiscriminantProperties bool, propsOut *[]*ast.Symbol) *ast.Symbol {
 * 	properties := c.getPropertiesOfType(target)
 * 	for _, targetProp := range properties {
 * 		// TODO: remove this when we support static private identifier fields and find other solutions to get privateNamesAndStaticFields test to pass
 * 		if isStaticPrivateIdentifierProperty(targetProp) {
 * 			continue
 * 		}
 * 		if requireOptionalProperties || targetProp.Flags&ast.SymbolFlagsOptional == 0 && targetProp.CheckFlags&ast.CheckFlagsPartial == 0 {
 * 			sourceProp := c.getPropertyOfType(source, targetProp.Name)
 * 			if sourceProp == nil {
 * 				if propsOut == nil {
 * 					return targetProp
 * 				}
 * 				*propsOut = append(*propsOut, targetProp)
 * 			} else if matchDiscriminantProperties {
 * 				targetType := c.getTypeOfSymbol(targetProp)
 * 				if targetType.flags&TypeFlagsUnit != 0 {
 * 					sourceType := c.getTypeOfSymbol(sourceProp)
 * 					if !(sourceType.flags&TypeFlagsAny != 0 || c.getRegularTypeOfLiteralType(sourceType) == c.getRegularTypeOfLiteralType(targetType)) {
 * 						if propsOut == nil {
 * 							return targetProp
 * 						}
 * 						*propsOut = append(*propsOut, targetProp)
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getUnmatchedPropertiesWorker(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, requireOptionalProperties: bool, matchDiscriminantProperties: bool, propsOut: GoPtr<GoSlice<GoPtr<Symbol>>>): GoPtr<Symbol> {
  const properties = Checker_getPropertiesOfType(receiver, target) ?? [];
  for (const targetProp of properties) {
    if (isStaticPrivateIdentifierProperty(targetProp)) {
      continue;
    }
    if (requireOptionalProperties || ((targetProp!.Flags & SymbolFlagsOptional) === 0 && (targetProp!.CheckFlags & CheckFlagsPartial) === 0)) {
      const sourceProp = Checker_getPropertyOfType(receiver, source, targetProp!.Name);
      if (sourceProp === undefined) {
        if (propsOut === undefined) {
          return targetProp;
        }
        propsOut.push(targetProp);
      } else if (matchDiscriminantProperties) {
        const targetType = Checker_getTypeOfSymbol(receiver, targetProp);
        if ((targetType!.flags & TypeFlagsUnit) !== 0) {
          const sourceType = Checker_getTypeOfSymbol(receiver, sourceProp);
          if (!((sourceType!.flags & TypeFlagsAny) !== 0 || Checker_getRegularTypeOfLiteralType(receiver, sourceType) === Checker_getRegularTypeOfLiteralType(receiver, targetType))) {
            if (propsOut === undefined) {
              return targetProp;
            }
            propsOut.push(targetProp);
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::excludeProperties","kind":"func","status":"implemented","sigHash":"da563e323a776e8eadec8e473e67d9915d167d119b8471282caaa75307444c21","bodyHash":"0ab74671d6db5b1d9edfd9b5f3b80a2800037ba69c85e1be5837c0d09eba87cd"}
 *
 * Go source:
 * func excludeProperties(properties []*ast.Symbol, excludedProperties collections.Set[string]) []*ast.Symbol {
 * 	if excludedProperties.Len() == 0 || len(properties) == 0 {
 * 		return properties
 * 	}
 * 	var reduced []*ast.Symbol
 * 	var excluded bool
 * 	for i, prop := range properties {
 * 		if !excludedProperties.Has(prop.Name) {
 * 			if excluded {
 * 				reduced = append(reduced, prop)
 * 			}
 * 		} else if !excluded {
 * 			reduced = slices.Clip(properties[:i])
 * 			excluded = true
 * 		}
 * 	}
 * 	if excluded {
 * 		return reduced
 * 	}
 * 	return properties
 * }
 */
export function excludeProperties(properties: GoPtr<GoSlice<GoPtr<Symbol>>>, excludedProperties: Set): GoSlice<GoPtr<Symbol>> {
  const sourceProperties = properties ?? [];
  if (Set_Len(excludedProperties) === 0 || sourceProperties.length === 0) {
    return sourceProperties;
  }
  let excluded = false;
  const reduced: GoPtr<Symbol>[] = [];
  for (let i = 0; i < sourceProperties.length; i++) {
    const prop = sourceProperties[i]!;
    if (!Set_Has(excludedProperties, prop!.Name)) {
      if (excluded) {
        reduced.push(prop);
      }
    } else if (!excluded) {
      for (let j = 0; j < i; j++) {
        reduced.push(sourceProperties[j]!);
      }
      excluded = true;
    }
  }
  if (excluded) {
    return reduced;
  }
  return sourceProperties;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::TypeDiscriminator","kind":"type","status":"implemented","sigHash":"7148f8d481a1de427d5a4958487914dc85fc448d039b4426f1d8a7be2eba5f28","bodyHash":"12d8c2f1c24c67ef0c6fd3690893224d255ae7b12537aff566d13d2fa4d02ae0"}
 *
 * Go source:
 * TypeDiscriminator struct {
 * 	c           *Checker
 * 	props       []*ast.Symbol
 * 	isRelatedTo func(*Type, *Type) Ternary
 * }
 */
export interface TypeDiscriminator {
  c: GoPtr<Checker>;
  props: GoSlice<GoPtr<Symbol>>;
  isRelatedTo: (arg0: GoPtr<Type>, arg1: GoPtr<Type>) => Ternary;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::TypeDiscriminator.len","kind":"method","status":"implemented","sigHash":"8e11aa6bc45803413d10398b1e6b65dacd8ce960af0a2d0a28c419d5f48ba386","bodyHash":"eebf1405c029cbfe22d2487eb1102b89b08fe4067b12b7e14edfa0309dd843cf"}
 *
 * Go source:
 * func (d *TypeDiscriminator) len() int {
 * 	return len(d.props)
 * }
 */
export function TypeDiscriminator_len(receiver: GoPtr<TypeDiscriminator>): int {
  return receiver!.props.length;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::TypeDiscriminator.name","kind":"method","status":"implemented","sigHash":"0c10b24d3204dcf4c4d84b814ace1028893c42438492f59aacacc95df8fb3f07","bodyHash":"95dfa40a6005e767944796c9e05e623dc3a6ed4185b98216712e56ed800fc1e5"}
 *
 * Go source:
 * func (d *TypeDiscriminator) name(index int) string {
 * 	return d.props[index].Name
 * }
 */
export function TypeDiscriminator_name(receiver: GoPtr<TypeDiscriminator>, index: int): string {
  return receiver!.props[index]!.Name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::TypeDiscriminator.matches","kind":"method","status":"implemented","sigHash":"9494466b873c8b791809ddd8f1a0944212c63bfdb167ab7417c9c31d050f66b4","bodyHash":"e47e31079c72cca6f1537eadcf202bc0632ca40f6ecca5205124c62953221cb2"}
 *
 * Go source:
 * func (d *TypeDiscriminator) matches(index int, t *Type) bool {
 * 	propType := d.c.getTypeOfSymbol(d.props[index])
 * 	for _, s := range propType.Distributed() {
 * 		if d.isRelatedTo(s, t) != TernaryFalse {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function TypeDiscriminator_matches(receiver: GoPtr<TypeDiscriminator>, index: int, t: GoPtr<Type>): bool {
  const propType = Checker_getTypeOfSymbol(receiver!.c, receiver!.props[index]);
  for (const s of Type_Distributed(propType)) {
    if (receiver!.isRelatedTo(s, t) !== TernaryFalse) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.findMatchingDiscriminantType","kind":"method","status":"implemented","sigHash":"42102e513e66314edb05d2b3989f733dada816f8aa8c17cd5a8f967c541ceaa6","bodyHash":"2b8bd410f1fd722a4e9fe66651208207017c0834e12d4cd624da40385a539f0d"}
 *
 * Go source:
 * func (c *Checker) findMatchingDiscriminantType(source *Type, target *Type, isRelatedTo func(source *Type, target *Type) Ternary) *Type {
 * 	if target.flags&TypeFlagsUnion != 0 && source.flags&(TypeFlagsIntersection|TypeFlagsObject) != 0 {
 * 		if match := c.getMatchingUnionConstituentForType(target, source); match != nil {
 * 			return match
 * 		}
 * 		if discriminantProperties := c.findDiscriminantProperties(c.getPropertiesOfType(source), target); len(discriminantProperties) != 0 {
 * 			discriminator := &TypeDiscriminator{c: c, props: discriminantProperties, isRelatedTo: isRelatedTo}
 * 			if discriminated := c.discriminateTypeByDiscriminableItems(target, discriminator); discriminated != target {
 * 				return discriminated
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_findMatchingDiscriminantType(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, isRelatedTo: (source: GoPtr<Type>, target: GoPtr<Type>) => Ternary): GoPtr<Type> {
  if ((target!.flags & TypeFlagsUnion) !== 0 && (source!.flags & (TypeFlagsIntersection | TypeFlagsObject)) !== 0) {
    const match = Checker_getMatchingUnionConstituentForType(receiver, target, source);
    if (match !== undefined) {
      return match;
    }
    const discriminantProperties = Checker_findDiscriminantProperties(receiver, Checker_getPropertiesOfType(receiver, source), target);
    if (discriminantProperties.length !== 0) {
      const discriminatorData: TypeDiscriminator = { c: receiver, props: discriminantProperties, isRelatedTo };
      const discriminator: Discriminator = {
        len: () => TypeDiscriminator_len(discriminatorData),
        name: (index: int) => TypeDiscriminator_name(discriminatorData, index),
        matches: (index: int, t: GoPtr<Type>) => TypeDiscriminator_matches(discriminatorData, index, t),
      };
      const discriminated = Checker_discriminateTypeByDiscriminableItems(receiver, target, discriminator);
      if (discriminated !== target) {
        return discriminated;
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.findDiscriminantProperties","kind":"method","status":"implemented","sigHash":"a1077264b63278a4593eac4e42e1d3b157336b59a217cd5bcf5ba951c02e95bb","bodyHash":"50c52cc7234f0a7b5fb4a2667d1129e6966a7a12ebf67356a3337c74581179c3"}
 *
 * Go source:
 * func (c *Checker) findDiscriminantProperties(sourceProperties []*ast.Symbol, target *Type) []*ast.Symbol {
 * 	var result []*ast.Symbol
 * 	for _, sourceProperty := range sourceProperties {
 * 		if c.isDiscriminantProperty(target, sourceProperty.Name) {
 * 			result = append(result, sourceProperty)
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Checker_findDiscriminantProperties(receiver: GoPtr<Checker>, sourceProperties: GoSlice<GoPtr<Symbol>>, target: GoPtr<Type>): GoSlice<GoPtr<Symbol>> {
  const result: GoPtr<Symbol>[] = [];
  for (const sourceProperty of sourceProperties) {
    if (Checker_isDiscriminantProperty(receiver, target, sourceProperty!.Name)) {
      result.push(sourceProperty);
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isDiscriminantProperty","kind":"method","status":"implemented","sigHash":"58b3f6cb31045bf9a9d3c8b4386bceaae63f8d022f570f1127bc48bd4910cc6e","bodyHash":"eb3c7e9cf2f183cd24f5aeb444935bae4f977b3faa4bc3144771150ea065c82a"}
 *
 * Go source:
 * func (c *Checker) isDiscriminantProperty(t *Type, name string) bool {
 * 	if t != nil && t.flags&TypeFlagsUnion != 0 {
 * 		prop := c.getUnionOrIntersectionProperty(t, name, false /*skipObjectFunctionPropertyAugment* /)
 * 		if prop != nil && prop.CheckFlags&ast.CheckFlagsSyntheticProperty != 0 {
 * 			if prop.CheckFlags&ast.CheckFlagsIsDiscriminantComputed == 0 {
 * 				prop.CheckFlags |= ast.CheckFlagsIsDiscriminantComputed
 * 				if prop.CheckFlags&ast.CheckFlagsNonUniformAndLiteral == ast.CheckFlagsNonUniformAndLiteral && !c.isGenericType(c.getTypeOfSymbol(prop)) {
 * 					prop.CheckFlags |= ast.CheckFlagsIsDiscriminant
 * 				}
 * 			}
 * 			return prop.CheckFlags&ast.CheckFlagsIsDiscriminant != 0
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_isDiscriminantProperty(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string): bool {
  if (t !== undefined && (t!.flags & TypeFlagsUnion) !== 0) {
    const prop = Checker_getUnionOrIntersectionProperty(receiver, t, name, false);
    if (prop !== undefined && (prop!.CheckFlags & CheckFlagsSyntheticProperty) !== 0) {
      if ((prop!.CheckFlags & CheckFlagsIsDiscriminantComputed) === 0) {
        prop!.CheckFlags = (prop!.CheckFlags | CheckFlagsIsDiscriminantComputed) as typeof prop.CheckFlags;
        if ((prop!.CheckFlags & CheckFlagsNonUniformAndLiteral) === CheckFlagsNonUniformAndLiteral && !Checker_isGenericType(receiver, Checker_getTypeOfSymbol(receiver, prop))) {
          prop!.CheckFlags = (prop!.CheckFlags | CheckFlagsIsDiscriminant) as typeof prop.CheckFlags;
        }
      }
      return (prop!.CheckFlags & CheckFlagsIsDiscriminant) !== 0;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getMatchingUnionConstituentForType","kind":"method","status":"implemented","sigHash":"b4e4d02a9de43777bc74be21fd9f9552a7e11f5a7b3c283772c5123c075831c7","bodyHash":"c3c16e533780b340eb5d44603225a5bab6035d98bd82d25dfb1e308461422ac7"}
 *
 * Go source:
 * func (c *Checker) getMatchingUnionConstituentForType(unionType *Type, t *Type) *Type {
 * 	keyPropertyName := c.getKeyPropertyName(unionType)
 * 	if keyPropertyName == "" {
 * 		return nil
 * 	}
 * 	propType := c.getTypeOfPropertyOfType(t, keyPropertyName)
 * 	if propType == nil {
 * 		return nil
 * 	}
 * 	return c.getConstituentTypeForKeyType(unionType, propType)
 * }
 */
export function Checker_getMatchingUnionConstituentForType(receiver: GoPtr<Checker>, unionType: GoPtr<Type>, t: GoPtr<Type>): GoPtr<Type> {
  const keyPropertyName = Checker_getKeyPropertyName(receiver, unionType);
  if (keyPropertyName === "") {
    return undefined;
  }
  const propType = Checker_getTypeOfPropertyOfType(receiver, t, keyPropertyName);
  if (propType === undefined) {
    return undefined;
  }
  return Checker_getConstituentTypeForKeyType(receiver, unionType, propType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getKeyPropertyName","kind":"method","status":"implemented","sigHash":"8c8307c290e4b7f3bd593e04b1c0e229603c57ec472f67596477542f83f516fe","bodyHash":"9879057eb8b2ca06bc15f9e9e2d7b55acaead466837fe8fab4cdbba317d6c2b4"}
 *
 * Go source:
 * func (c *Checker) getKeyPropertyName(t *Type) string {
 * 	u := t.AsUnionType()
 * 	if u.keyPropertyName == "" {
 * 		u.keyPropertyName, u.constituentMap = c.computeKeyPropertyNameAndMap(t)
 * 	}
 * 	if u.keyPropertyName == ast.InternalSymbolNameMissing {
 * 		return ""
 * 	}
 * 	return u.keyPropertyName
 * }
 */
export function Checker_getKeyPropertyName(receiver: GoPtr<Checker>, t: GoPtr<Type>): string {
  const u = Type_AsUnionType(t);
  if (u!.keyPropertyName === "") {
    const [name, map] = Checker_computeKeyPropertyNameAndMap(receiver, t);
    u!.keyPropertyName = name;
    u!.constituentMap = map ?? new globalThis.Map();
  }
  if (u!.keyPropertyName === InternalSymbolNameMissing) {
    return "";
  }
  return u!.keyPropertyName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getConstituentTypeForKeyType","kind":"method","status":"implemented","sigHash":"c836ff7d7a0119b96d59fb493dcb63b366232f2168f3bf539156951852e54e13","bodyHash":"2f6bddfd2abee94102804f6552a9e901e1535751633994ae4062a7ad60aa1c31"}
 *
 * Go source:
 * func (c *Checker) getConstituentTypeForKeyType(t *Type, keyType *Type) *Type {
 * 	result := t.AsUnionType().constituentMap[c.getRegularTypeOfLiteralType(keyType)]
 * 	if result != c.unknownType {
 * 		return result
 * 	}
 * 	return nil
 * }
 */
export function Checker_getConstituentTypeForKeyType(receiver: GoPtr<Checker>, t: GoPtr<Type>, keyType: GoPtr<Type>): GoPtr<Type> {
  const result = Type_AsUnionType(t)!.constituentMap!.get(Checker_getRegularTypeOfLiteralType(receiver, keyType));
  if (result !== receiver!.unknownType) {
    return result;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.computeKeyPropertyNameAndMap","kind":"method","status":"implemented","sigHash":"0cfdc4a9ceb6bb58c1aef76029123ab358434cbda88b00e94da6cc899dffba38","bodyHash":"c27aee042833c036b0c837cce454bde2da1fa1050f118904b21560db2c47a259"}
 *
 * Go source:
 * func (c *Checker) computeKeyPropertyNameAndMap(t *Type) (string, map[*Type]*Type) {
 * 	types := t.Types()
 * 	if len(types) < 10 || t.objectFlags&ObjectFlagsPrimitiveUnion != 0 || core.CountWhere(types, isObjectOrInstantiableNonPrimitive) < 10 {
 * 		return ast.InternalSymbolNameMissing, nil
 * 	}
 * 	keyPropertyName := c.getKeyPropertyCandidateName(types)
 * 	if keyPropertyName == "" {
 * 		return ast.InternalSymbolNameMissing, nil
 * 	}
 * 	mapByKeyProperty := c.mapTypesByKeyProperty(types, keyPropertyName)
 * 	if mapByKeyProperty == nil {
 * 		return ast.InternalSymbolNameMissing, nil
 * 	}
 * 	return keyPropertyName, mapByKeyProperty
 * }
 */
export function Checker_computeKeyPropertyNameAndMap(receiver: GoPtr<Checker>, t: GoPtr<Type>): [string, GoPtr<GoMap<GoPtr<Type>, GoPtr<Type>>>] {
  const types = Type_Types(t)!;
  if (types.length < 10 || (t!.objectFlags & ObjectFlagsPrimitiveUnion) !== 0 || CountWhere(types, isObjectOrInstantiableNonPrimitive) < 10) {
    return [InternalSymbolNameMissing, undefined];
  }
  const keyPropertyName = Checker_getKeyPropertyCandidateName(receiver, types);
  if (keyPropertyName === "") {
    return [InternalSymbolNameMissing, undefined];
  }
  const mapByKeyProperty = Checker_mapTypesByKeyProperty(receiver, types, keyPropertyName);
  if (mapByKeyProperty === undefined) {
    return [InternalSymbolNameMissing, undefined];
  }
  return [keyPropertyName, mapByKeyProperty];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::isObjectOrInstantiableNonPrimitive","kind":"func","status":"implemented","sigHash":"7cacd359f84eae279705cf2144dad404f64cea2aa260c35fe23ef2d23b63099c","bodyHash":"d5d21d8c433cf0660470ba50921c906eb8c3b25afcdddf0fcf1b5042ad8512d9"}
 *
 * Go source:
 * func isObjectOrInstantiableNonPrimitive(t *Type) bool {
 * 	return t.flags&(TypeFlagsObject|TypeFlagsInstantiableNonPrimitive) != 0
 * }
 */
export function isObjectOrInstantiableNonPrimitive(t: GoPtr<Type>): bool {
  return (t!.flags & (TypeFlagsObject | TypeFlagsInstantiableNonPrimitive)) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getKeyPropertyCandidateName","kind":"method","status":"implemented","sigHash":"42710249675a5990177c5830685a4587246ff4bb7581f49f30a21fd15fa79340","bodyHash":"461f3ea70cfefe93fc9e9549bea8469249f06a2557f4063fae9cb88cfbd1384b"}
 *
 * Go source:
 * func (c *Checker) getKeyPropertyCandidateName(types []*Type) string {
 * 	for _, t := range types {
 * 		if t.flags&(TypeFlagsObject|TypeFlagsInstantiableNonPrimitive) != 0 {
 * 			for _, p := range c.getPropertiesOfType(t) {
 * 				if isUnitType(c.getTypeOfSymbol(p)) {
 * 					return p.Name
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return ""
 * }
 */
export function Checker_getKeyPropertyCandidateName(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>): string {
  for (const t of types) {
    if ((t!.flags & (TypeFlagsObject | TypeFlagsInstantiableNonPrimitive)) !== 0) {
      for (const p of Checker_getPropertiesOfType(receiver, t)) {
        if (isUnitType(Checker_getTypeOfSymbol(receiver, p))) {
          return p!.Name;
        }
      }
    }
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.mapTypesByKeyProperty","kind":"method","status":"implemented","sigHash":"9ac57bcd8575918fe39b1f37952f34932045d6e964d780cf177ab6aa514b6812","bodyHash":"22376013ffacd5f50e29300db95f56c3f63f2f9aa6b2792b6fc12818dc091838"}
 *
 * Go source:
 * func (c *Checker) mapTypesByKeyProperty(types []*Type, keyPropertyName string) map[*Type]*Type {
 * 	typesByKey := make(map[*Type]*Type)
 * 	count := 0
 * 	for _, t := range types {
 * 		if t.flags&(TypeFlagsObject|TypeFlagsIntersection|TypeFlagsInstantiableNonPrimitive) != 0 {
 * 			discriminant := c.getTypeOfPropertyOfType(t, keyPropertyName)
 * 			if discriminant == nil || !isLiteralType(discriminant) {
 * 				return nil
 * 			}
 * 			duplicate := false
 * 			for _, d := range discriminant.Distributed() {
 * 				key := c.getRegularTypeOfLiteralType(d)
 * 				if existing := typesByKey[key]; existing == nil {
 * 					typesByKey[key] = t
 * 				} else if existing != c.unknownType {
 * 					typesByKey[key] = c.unknownType
 * 					duplicate = true
 * 				}
 * 			}
 * 			if !duplicate {
 * 				count++
 * 			}
 * 		}
 * 	}
 * 	if count >= 10 && count*2 >= len(types) {
 * 		return typesByKey
 * 	}
 * 	return nil
 * }
 */
export function Checker_mapTypesByKeyProperty(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>, keyPropertyName: string): GoPtr<GoMap<GoPtr<Type>, GoPtr<Type>>> {
  const typesByKey: GoMap<GoPtr<Type>, GoPtr<Type>> = new globalThis.Map();
  let count = 0;
  for (const t of types) {
    if ((t!.flags & (TypeFlagsObject | TypeFlagsIntersection | TypeFlagsInstantiableNonPrimitive)) !== 0) {
      const discriminant = Checker_getTypeOfPropertyOfType(receiver, t, keyPropertyName);
      if (discriminant === undefined || !isLiteralType(discriminant)) {
        return undefined;
      }
      let duplicate = false;
      for (const d of Type_Distributed(discriminant)) {
        const key = Checker_getRegularTypeOfLiteralType(receiver, d);
        const existing = typesByKey.get(key);
        if (existing === undefined) {
          typesByKey.set(key, t);
        } else if (existing !== receiver!.unknownType) {
          typesByKey.set(key, receiver!.unknownType);
          duplicate = true;
        }
      }
      if (!duplicate) {
        count++;
      }
    }
  }
  if (count >= 10 && count * 2 >= types.length) {
    return typesByKey;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::Discriminator","kind":"type","status":"implemented","sigHash":"b1a30190626d188ea1fb4c91b8316668c9aa4daf8e12f7c9b621a84507d931c2","bodyHash":"2faa74df3be084722e53cb4706d495f2e5700c08d1674668cad49b390a2cfd7b"}
 *
 * Go source:
 * Discriminator interface {
 * 	len() int                        // Number of discriminant properties
 * 	name(index int) string           // Property name of index-th discriminator
 * 	matches(index int, t *Type) bool // True if index-th discriminator matches the given type
 * }
 */
export interface Discriminator {
  len(): int;
  name(index: int): string;
  matches(index: int, t: GoPtr<Type>): bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.discriminateTypeByDiscriminableItems","kind":"method","status":"implemented","sigHash":"f4b665644c43aa05cb7334687601d3cf7622721d23ba3331c22016ab095f4bdc","bodyHash":"2d3c899f46b8e0d5b0085fe5a9c552c8979a9a341a5fac1dc84a44ecc8e7fa98"}
 *
 * Go source:
 * func (c *Checker) discriminateTypeByDiscriminableItems(target *Type, discriminator Discriminator) *Type {
 * 	types := target.Types()
 * 	include := make([]Ternary, len(types))
 * 	for i, t := range types {
 * 		if t.flags&TypeFlagsPrimitive == 0 && c.getReducedType(t).flags&TypeFlagsNever == 0 {
 * 			include[i] = TernaryTrue
 * 		}
 * 	}
 * 	for n := range discriminator.len() {
 * 		// If the remaining target types include at least one with a matching discriminant, eliminate those that
 * 		// have non-matching discriminants. This ensures that we ignore erroneous discriminators and gradually
 * 		// refine the target set without eliminating every constituent (which would lead to `never`).
 * 		matched := false
 * 		for i := range types {
 * 			if include[i] != TernaryFalse {
 * 				targetType := c.getTypeOfPropertyOrIndexSignatureOfType(types[i], discriminator.name(n))
 * 				if targetType != nil {
 * 					if discriminator.matches(n, targetType) {
 * 						matched = true
 * 					} else {
 * 						include[i] = TernaryMaybe
 * 					}
 * 				}
 * 			}
 * 		}
 * 		// Turn each Ternary.Maybe into Ternary.False if there was a match. Otherwise, revert to Ternary.True.
 * 		for i := range types {
 * 			if include[i] == TernaryMaybe {
 * 				if matched {
 * 					include[i] = TernaryFalse
 * 				} else {
 * 					include[i] = TernaryTrue
 * 				}
 * 			}
 * 		}
 * 	}
 * 	if slices.Contains(include, TernaryFalse) {
 * 		var filteredTypes []*Type
 * 		for i, t := range types {
 * 			if include[i] == TernaryTrue {
 * 				filteredTypes = append(filteredTypes, t)
 * 			}
 * 		}
 * 		filtered := c.getUnionTypeEx(filteredTypes, UnionReductionNone, nil, nil)
 * 		if filtered.flags&TypeFlagsNever == 0 {
 * 			return filtered
 * 		}
 * 	}
 * 	return target
 * }
 */
export function Checker_discriminateTypeByDiscriminableItems(receiver: GoPtr<Checker>, target: GoPtr<Type>, discriminator: Discriminator): GoPtr<Type> {
  const types = Type_Types(target)!;
  const include: Ternary[] = new Array(types.length).fill(0) as Ternary[];
  for (let i = 0; i < types.length; i++) {
    if ((types[i]!.flags & TypeFlagsPrimitive) === 0 && (Checker_getReducedType(receiver, types[i])!.flags & TypeFlagsNever) === 0) {
      include[i] = TernaryTrue;
    }
  }
  for (let n = 0; n < discriminator.len(); n++) {
    let matched = false;
    for (let i = 0; i < types.length; i++) {
      if (include[i] !== TernaryFalse) {
        const targetType = Checker_getTypeOfPropertyOrIndexSignatureOfType(receiver, types[i], discriminator.name(n));
        if (targetType !== undefined) {
          if (discriminator.matches(n, targetType)) {
            matched = true;
          } else {
            include[i] = TernaryMaybe;
          }
        }
      }
    }
    for (let i = 0; i < types.length; i++) {
      if (include[i] === TernaryMaybe) {
        if (matched) {
          include[i] = TernaryFalse;
        } else {
          include[i] = TernaryTrue;
        }
      }
    }
  }
  if (include.includes(TernaryFalse)) {
    const filteredTypes: GoPtr<Type>[] = [];
    for (let i = 0; i < types.length; i++) {
      if (include[i] === TernaryTrue) {
        filteredTypes.push(types[i]);
      }
    }
    const filtered = Checker_getUnionTypeEx(receiver, filteredTypes, UnionReductionNone, undefined, undefined);
    if ((filtered!.flags & TypeFlagsNever) === 0) {
      return filtered;
    }
  }
  return target;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.filterPrimitivesIfContainsNonPrimitive","kind":"method","status":"implemented","sigHash":"3dbb882c125c4d0f43814d9ee5b60278ac6d056dea9b5d59c0e6947a7bed515f","bodyHash":"4a699897bfb51e897bd2999411b7f146caf5a6bc84a3b47840103f9b37fca9e1"}
 *
 * Go source:
 * func (c *Checker) filterPrimitivesIfContainsNonPrimitive(unionType *Type) *Type {
 * 	if c.maybeTypeOfKind(unionType, TypeFlagsNonPrimitive) {
 * 		result := c.filterType(unionType, isNonPrimitiveType)
 * 		if result.flags&TypeFlagsNever == 0 {
 * 			return result
 * 		}
 * 	}
 * 	return unionType
 * }
 */
export function Checker_filterPrimitivesIfContainsNonPrimitive(receiver: GoPtr<Checker>, unionType: GoPtr<Type>): GoPtr<Type> {
  if (Checker_maybeTypeOfKind(receiver, unionType, TypeFlagsNonPrimitive)) {
    const result = Checker_filterType(receiver, unionType, isNonPrimitiveType);
    if ((result!.flags & TypeFlagsNever) === 0) {
      return result;
    }
  }
  return unionType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::isNonPrimitiveType","kind":"func","status":"implemented","sigHash":"ea206be5a811d5b6ef467b8c8735ed8405a7076d28ae220520251670bc0cd710","bodyHash":"eb0cbdac028f34685271423669ff2c2f73398bf14ec635cbf017e13b804fedf0"}
 *
 * Go source:
 * func isNonPrimitiveType(t *Type) bool {
 * 	return t.flags&TypeFlagsPrimitive == 0
 * }
 */
export function isNonPrimitiveType(t: GoPtr<Type>): bool {
  return (t!.flags & TypeFlagsPrimitive) === 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getTypeNamesForErrorDisplay","kind":"method","status":"implemented","sigHash":"fca306d3ec13171e41b67d5ff52e95336b14a1d810cbc21d0a0076e0bff366fe","bodyHash":"087e1745806b55081b9bceec04f8955e5f279c07748fada0fdaf13280a3dc446"}
 *
 * Go source:
 * func (c *Checker) getTypeNamesForErrorDisplay(left *Type, right *Type) (string, string) {
 * 	var leftStr string
 * 	if c.symbolValueDeclarationIsContextSensitive(left.symbol) {
 * 		leftStr = c.typeToString(left, left.symbol.ValueDeclaration)
 * 	} else {
 * 		leftStr = c.TypeToString(left)
 * 	}
 * 	var rightStr string
 * 	if c.symbolValueDeclarationIsContextSensitive(right.symbol) {
 * 		rightStr = c.typeToString(right, right.symbol.ValueDeclaration)
 * 	} else {
 * 		rightStr = c.TypeToString(right)
 * 	}
 * 	if leftStr == rightStr {
 * 		leftStr = c.getTypeNameForErrorDisplay(left)
 * 		rightStr = c.getTypeNameForErrorDisplay(right)
 * 	}
 * 	return leftStr, rightStr
 * }
 */
export function Checker_getTypeNamesForErrorDisplay(receiver: GoPtr<Checker>, left: GoPtr<Type>, right: GoPtr<Type>): [string, string] {
  let leftStr: string;
  if (Checker_symbolValueDeclarationIsContextSensitive(receiver, left!.symbol)) {
    leftStr = Checker_typeToString(receiver, left, left!.symbol!.ValueDeclaration);
  } else {
    leftStr = Checker_TypeToString(receiver, left);
  }
  let rightStr: string;
  if (Checker_symbolValueDeclarationIsContextSensitive(receiver, right!.symbol)) {
    rightStr = Checker_typeToString(receiver, right, right!.symbol!.ValueDeclaration);
  } else {
    rightStr = Checker_TypeToString(receiver, right);
  }
  if (leftStr === rightStr) {
    leftStr = Checker_getTypeNameForErrorDisplay(receiver, left);
    rightStr = Checker_getTypeNameForErrorDisplay(receiver, right);
  }
  return [leftStr, rightStr];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getTypeNameForErrorDisplay","kind":"method","status":"implemented","sigHash":"8d1afcda107b7fcdeae34e8337f789a4b41072abdda0aa0a9873438df26873e2","bodyHash":"956158b85bf6f754787f9c1455fc9e1da11649056de037a406ee370b1e896a00"}
 *
 * Go source:
 * func (c *Checker) getTypeNameForErrorDisplay(t *Type) string {
 * 	return c.typeToStringEx(t, nil /*enclosingDeclaration* /, TypeFormatFlagsUseFullyQualifiedType, nil)
 * }
 */
export function Checker_getTypeNameForErrorDisplay(receiver: GoPtr<Checker>, t: GoPtr<Type>): string {
  return Checker_typeToStringEx(receiver, t, undefined, TypeFormatFlagsUseFullyQualifiedType, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.symbolValueDeclarationIsContextSensitive","kind":"method","status":"implemented","sigHash":"86a83760d1b5366e414902f806b3a4b176b0219726e4ce4a47e9f1d5730c0af0","bodyHash":"c8aee2819ff6040e892a43779b583e40f608b253c3236cb6f2ee71c633163125"}
 *
 * Go source:
 * func (c *Checker) symbolValueDeclarationIsContextSensitive(symbol *ast.Symbol) bool {
 * 	return symbol != nil && symbol.ValueDeclaration != nil && ast.IsExpression(symbol.ValueDeclaration) && !c.isContextSensitive(symbol.ValueDeclaration)
 * }
 */
export function Checker_symbolValueDeclarationIsContextSensitive(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool {
  return symbol_ !== undefined && symbol_!.ValueDeclaration !== undefined && IsExpression(symbol_!.ValueDeclaration) && !Checker_isContextSensitive(receiver, symbol_!.ValueDeclaration);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.typeCouldHaveTopLevelSingletonTypes","kind":"method","status":"implemented","sigHash":"de67c5f27996baefb6866cdd89c700d09859644a8c102ec105b5f718cfbddecf","bodyHash":"872e233974f6462a56643240b632b3163e6277bad0f1df7a74cedead48e60796"}
 *
 * Go source:
 * func (c *Checker) typeCouldHaveTopLevelSingletonTypes(t *Type) bool {
 * 	// Okay, yes, 'boolean' is a union of 'true | false', but that's not useful
 * 	// in error reporting scenarios. If you need to use this function but that detail matters,
 * 	// feel free to add a flag.
 * 	if t.flags&TypeFlagsBoolean != 0 {
 * 		return false
 * 	}
 * 	if t.flags&TypeFlagsUnionOrIntersection != 0 {
 * 		return core.Some(t.Types(), c.typeCouldHaveTopLevelSingletonTypes)
 * 	}
 * 	if t.flags&TypeFlagsInstantiable != 0 {
 * 		constraint := c.getConstraintOfType(t)
 * 		if constraint != nil && constraint != t {
 * 			return c.typeCouldHaveTopLevelSingletonTypes(constraint)
 * 		}
 * 	}
 * 	return isUnitType(t) || t.flags&TypeFlagsTemplateLiteral != 0 || t.flags&TypeFlagsStringMapping != 0
 * }
 */
export function Checker_typeCouldHaveTopLevelSingletonTypes(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  if ((t!.flags & TypeFlagsBoolean) !== 0) {
    return false;
  }
  if ((t!.flags & TypeFlagsUnionOrIntersection) !== 0) {
    return Type_Types(t)!.some((t2: GoPtr<Type>) => Checker_typeCouldHaveTopLevelSingletonTypes(receiver, t2));
  }
  if ((t!.flags & TypeFlagsInstantiable) !== 0) {
    const constraint = Checker_getConstraintOfType(receiver, t);
    if (constraint !== undefined && constraint !== t) {
      return Checker_typeCouldHaveTopLevelSingletonTypes(receiver, constraint);
    }
  }
  return isUnitType(t) || (t!.flags & TypeFlagsTemplateLiteral) !== 0 || (t!.flags & TypeFlagsStringMapping) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getVariances","kind":"method","status":"implemented","sigHash":"468cd89c12c859fe16bc6c526a4082e9351e46a0b94190d6d524176dc3d7a3ed","bodyHash":"88e08ae486f9a996637106dfd8d48d15a7d0d1e76bf94530843011d4482d9563"}
 *
 * Go source:
 * func (c *Checker) getVariances(t *Type) []VarianceFlags {
 * 	// Arrays and tuples are known to be covariant, no need to spend time computing this.
 * 	if t == c.globalArrayType || t == c.globalReadonlyArrayType || t.objectFlags&ObjectFlagsTuple != 0 {
 * 		return c.arrayVariances
 * 	}
 * 	return c.getVariancesWorker(t.symbol, t.AsInterfaceType().TypeParameters())
 * }
 */
export function Checker_getVariances(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoSlice<VarianceFlags> {
  if (t === receiver!.globalArrayType || t === receiver!.globalReadonlyArrayType || (t!.objectFlags & ObjectFlagsTuple) !== 0) {
    return receiver!.arrayVariances;
  }
  return Checker_getVariancesWorker(receiver, t!.symbol, InterfaceType_TypeParameters(Type_AsInterfaceType(t)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getAliasVariances","kind":"method","status":"implemented","sigHash":"6ae72d98b41e39fdd5baa1b12fa3e93a1887bbf972165b39d554e4130f4e2e65","bodyHash":"025f3827130a3de807cb2e26df8a479f16b83705eb8176bc804d3bf1163e276d"}
 *
 * Go source:
 * func (c *Checker) getAliasVariances(symbol *ast.Symbol) []VarianceFlags {
 * 	return c.getVariancesWorker(symbol, c.typeAliasLinks.Get(symbol).typeParameters)
 * }
 */
export function Checker_getAliasVariances(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoSlice<VarianceFlags> {
  return Checker_getVariancesWorker(receiver, symbol_, LinkStore_Get(receiver!.typeAliasLinks, symbol_)!.typeParameters);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getVariancesWorker","kind":"method","status":"implemented","sigHash":"f75aaf58b7851e9b944a2361bc00748bc2dc3fca7dffe7d96ef308b8044bbebe","bodyHash":"18d082cac3d125f4866d34360707c535f20f058da03694ab1dd2986edf708c97"}
 *
 * Go source:
 * func (c *Checker) getVariancesWorker(symbol *ast.Symbol, typeParameters []*Type) []VarianceFlags {
 * 	links := c.varianceLinks.Get(symbol)
 * 	if links.variances == nil {
 * 		var traceArgs map[string]any
 * 		if tr := c.tracer; tr != nil {
 * 			traceArgs = map[string]any{"arity": len(typeParameters), "id": c.getDeclaredTypeOfSymbol(symbol).id}
 * 			popFn := tr.Push(tracing.PhaseCheckTypes, "getVariancesWorker", traceArgs, true)
 * 			defer func() {
 * 				formatted := make([]string, len(links.variances))
 * 				for i, v := range links.variances {
 * 					formatted[i] = v.String()
 * 				}
 * 				traceArgs["variances"] = formatted
 * 				popFn()
 * 			}()
 * 		}
 * 		oldVarianceComputation := c.inVarianceComputation
 * 		saveResolutionStart := c.resolutionStart
 * 		if !c.inVarianceComputation {
 * 			c.inVarianceComputation = true
 * 			c.resolutionStart = len(c.typeResolutions)
 * 		}
 * 		links.variances = []VarianceFlags{}
 * 		variances := make([]VarianceFlags, len(typeParameters))
 * 		for i, tp := range typeParameters {
 * 			modifiers := c.getTypeParameterModifiers(tp)
 * 			var variance VarianceFlags
 * 			switch {
 * 			case modifiers&ast.ModifierFlagsOut != 0:
 * 				if modifiers&ast.ModifierFlagsIn != 0 {
 * 					variance = VarianceFlagsInvariant
 * 				} else {
 * 					variance = VarianceFlagsCovariant
 * 				}
 * 			case modifiers&ast.ModifierFlagsIn != 0:
 * 				variance = VarianceFlagsContravariant
 * 			default:
 * 				saveReliabilityFlags := c.reliabilityFlags
 * 				c.reliabilityFlags = 0
 * 				// We first compare instantiations where the type parameter is replaced with
 * 				// marker types that have a known subtype relationship. From this we can infer
 * 				// invariance, covariance, contravariance or bivariance.
 * 				typeWithSuper := c.createMarkerType(symbol, tp, c.markerSuperType)
 * 				typeWithSub := c.createMarkerType(symbol, tp, c.markerSubType)
 * 				variance = (core.IfElse(c.isTypeAssignableTo(typeWithSub, typeWithSuper), VarianceFlagsCovariant, 0)) |
 * 					(core.IfElse(c.isTypeAssignableTo(typeWithSuper, typeWithSub), VarianceFlagsContravariant, 0))
 * 				// If the instantiations appear to be related bivariantly it may be because the
 * 				// type parameter is independent (i.e. it isn't witnessed anywhere in the generic
 * 				// type). To determine this we compare instantiations where the type parameter is
 * 				// replaced with marker types that are known to be unrelated.
 * 				if variance == VarianceFlagsBivariant && c.isTypeAssignableTo(c.createMarkerType(symbol, tp, c.markerOtherType), typeWithSuper) {
 * 					variance = VarianceFlagsIndependent
 * 				}
 * 				if c.reliabilityFlags&RelationComparisonResultReportsUnmeasurable != 0 {
 * 					variance |= VarianceFlagsUnmeasurable
 * 				}
 * 				if c.reliabilityFlags&RelationComparisonResultReportsUnreliable != 0 {
 * 					variance |= VarianceFlagsUnreliable
 * 				}
 * 				c.reliabilityFlags = saveReliabilityFlags
 * 			}
 * 			variances[i] = variance
 * 		}
 * 		if !oldVarianceComputation {
 * 			c.inVarianceComputation = false
 * 			c.resolutionStart = saveResolutionStart
 * 		}
 * 		links.variances = variances
 * 	}
 * 	return links.variances
 * }
 */
export function Checker_getVariancesWorker(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, typeParameters: GoSlice<GoPtr<Type>>): GoSlice<VarianceFlags> {
  const links = LinkStore_Get<GoPtr<Symbol>, VarianceLinks>(receiver!.varianceLinks as GoPtr<LinkStore<GoPtr<Symbol>, VarianceLinks>>, symbol_);
  if (links!.variances === undefined) {
    const oldVarianceComputation = receiver!.inVarianceComputation;
    const saveResolutionStart = receiver!.resolutionStart;
    if (!receiver!.inVarianceComputation) {
      receiver!.inVarianceComputation = true;
      receiver!.resolutionStart = receiver!.typeResolutions.length;
    }
    links!.variances = [];
    const variances: VarianceFlags[] = new Array(typeParameters.length).fill(0);
    for (let i = 0; i < typeParameters.length; i++) {
      const tp = typeParameters[i];
      const modifiers = Checker_getTypeParameterModifiers(receiver, tp);
      let variance: VarianceFlags = 0;
      if ((modifiers & ModifierFlagsOut) !== 0) {
        if ((modifiers & ModifierFlagsIn) !== 0) {
          variance = VarianceFlagsInvariant;
        } else {
          variance = VarianceFlagsCovariant;
        }
      } else if ((modifiers & ModifierFlagsIn) !== 0) {
        variance = VarianceFlagsContravariant;
      } else {
        const saveReliabilityFlags = receiver!.reliabilityFlags;
        receiver!.reliabilityFlags = 0 as RelationComparisonResult;
        const typeWithSuper = Checker_createMarkerType(receiver, symbol_, tp, receiver!.markerSuperType);
        const typeWithSub = Checker_createMarkerType(receiver, symbol_, tp, receiver!.markerSubType);
        variance = (Checker_isTypeAssignableTo(receiver, typeWithSub, typeWithSuper) ? VarianceFlagsCovariant : 0) |
          (Checker_isTypeAssignableTo(receiver, typeWithSuper, typeWithSub) ? VarianceFlagsContravariant : 0);
        if (variance === VarianceFlagsBivariant && Checker_isTypeAssignableTo(receiver, Checker_createMarkerType(receiver, symbol_, tp, receiver!.markerOtherType), typeWithSuper)) {
          variance = VarianceFlagsIndependent;
        }
        if ((receiver!.reliabilityFlags & RelationComparisonResultReportsUnmeasurable) !== 0) {
          variance = (variance | VarianceFlagsUnmeasurable) as VarianceFlags;
        }
        if ((receiver!.reliabilityFlags & RelationComparisonResultReportsUnreliable) !== 0) {
          variance = (variance | VarianceFlagsUnreliable) as VarianceFlags;
        }
        receiver!.reliabilityFlags = saveReliabilityFlags;
      }
      variances[i] = variance;
    }
    if (!oldVarianceComputation) {
      receiver!.inVarianceComputation = false;
      receiver!.resolutionStart = saveResolutionStart;
    }
    links!.variances = variances;
  }
  return links!.variances;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.createMarkerType","kind":"method","status":"implemented","sigHash":"1d5268766f3214b5a89e3da2af2d970c3594636a588720f1ff29c7ca68f308f0","bodyHash":"37af8fedc067aadb93ea630d6fbedb7ef97eb6dc210a152b9b2b8d156979e885"}
 *
 * Go source:
 * func (c *Checker) createMarkerType(symbol *ast.Symbol, source *Type, target *Type) *Type {
 * 	mapper := newSimpleTypeMapper(source, target)
 * 	t := c.getDeclaredTypeOfSymbol(symbol)
 * 	if c.isErrorType(t) {
 * 		return t
 * 	}
 * 	var result *Type
 * 	if symbol.Flags&ast.SymbolFlagsTypeAlias != 0 {
 * 		result = c.getTypeAliasInstantiation(symbol, c.instantiateTypes(c.typeAliasLinks.Get(symbol).typeParameters, mapper), nil)
 * 	} else {
 * 		result = c.createTypeReference(t, c.instantiateTypes(t.AsInterfaceType().TypeParameters(), mapper))
 * 	}
 * 	c.markerTypes.Add(result)
 * 	return result
 * }
 */
export function Checker_createMarkerType(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, source: GoPtr<Type>, target: GoPtr<Type>): GoPtr<Type> {
  const mapper = newSimpleTypeMapper(source, target);
  const t = Checker_getDeclaredTypeOfSymbol(receiver, symbol_);
  if (Checker_isErrorType(receiver, t)) {
    return t;
  }
  let result: GoPtr<Type>;
  if ((symbol_!.Flags & SymbolFlagsTypeAlias) !== 0) {
    result = Checker_getTypeAliasInstantiation(receiver, symbol_, Checker_instantiateTypes(receiver, LinkStore_Get(receiver!.typeAliasLinks, symbol_)!.typeParameters, mapper), undefined);
  } else {
    result = Checker_createTypeReference(receiver, t, Checker_instantiateTypes(receiver, InterfaceType_TypeParameters(Type_AsInterfaceType(t)), mapper));
  }
  Set_Add(receiver!.markerTypes, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isMarkerType","kind":"method","status":"implemented","sigHash":"a8ba4823dd2ed11f383ba7f66103f2c0e6f78705255a2c22416d6e4df4de35f1","bodyHash":"3c23399c36ad4912ec01be35606c87050c178922eb2362f59b63a8a50fcfd270"}
 *
 * Go source:
 * func (c *Checker) isMarkerType(t *Type) bool {
 * 	return c.markerTypes.Has(t)
 * }
 */
export function Checker_isMarkerType(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  return Set_Has(receiver!.markerTypes, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getTypeParameterModifiers","kind":"method","status":"implemented","sigHash":"bcb1396f617241de4a566dd34a22a96334fdf96fe97da0261547c1adab6d6db0","bodyHash":"913b605cd6271ebf5708d3541d85eaaa1f560d7c94dc2f6805a5f36ebb195364"}
 *
 * Go source:
 * func (c *Checker) getTypeParameterModifiers(tp *Type) ast.ModifierFlags {
 * 	var flags ast.ModifierFlags
 * 	if tp.symbol != nil {
 * 		for _, d := range tp.symbol.Declarations {
 * 			flags |= d.ModifierFlags()
 * 		}
 * 	}
 * 	return flags & (ast.ModifierFlagsIn | ast.ModifierFlagsOut | ast.ModifierFlagsConst)
 * }
 */
export function Checker_getTypeParameterModifiers(receiver: GoPtr<Checker>, tp: GoPtr<Type>): ModifierFlags {
  let flags: ModifierFlags = 0;
  if (tp!.symbol !== undefined) {
    for (const d of tp!.symbol!.Declarations ?? []) {
      flags = (flags | Node_ModifierFlags(d)) as ModifierFlags;
    }
  }
  return (flags & (ModifierFlagsIn | ModifierFlagsOut | ModifierFlagsConst)) as ModifierFlags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.hasCovariantVoidArgument","kind":"method","status":"implemented","sigHash":"a5ce730c029d875c061939c67b55375191e70da04ad8c185c99c93288f5816c5","bodyHash":"bb6306787ac0a727371c383a08aca20736c53ecfbc05db18da0eaa6e9212cbeb"}
 *
 * Go source:
 * func (c *Checker) hasCovariantVoidArgument(typeArguments []*Type, variances []VarianceFlags) bool {
 * 	for i, v := range variances {
 * 		if v&VarianceFlagsVarianceMask == VarianceFlagsCovariant && typeArguments[i].flags&TypeFlagsVoid != 0 {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_hasCovariantVoidArgument(receiver: GoPtr<Checker>, typeArguments: GoSlice<GoPtr<Type>>, variances: GoSlice<VarianceFlags>): bool {
  for (let i = 0; i < variances.length; i++) {
    if (((variances[i]! & VarianceFlagsVarianceMask)) === VarianceFlagsCovariant && (typeArguments[i]!.flags & TypeFlagsVoid) !== 0) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isSignatureAssignableTo","kind":"method","status":"implemented","sigHash":"750e573d9aaa19b337cd17a6f2d78b8b4e3eba6012113ddf9b1495010587b0a6","bodyHash":"e55b3f23ddd06b3ed1653c5d21324a8c1d0b3da84fe068b943c35b41de35e34d"}
 *
 * Go source:
 * func (c *Checker) isSignatureAssignableTo(source *Signature, target *Signature, ignoreReturnTypes bool) bool {
 * 	return c.compareSignaturesRelated(source, target, core.IfElse(ignoreReturnTypes, SignatureCheckModeIgnoreReturnTypes, SignatureCheckModeNone), false /*reportErrors* /, nil /*errorReporter* /, c.compareTypesAssignable, nil /*reportUnreliableMarkers* /) != TernaryFalse
 * }
 */
export function Checker_isSignatureAssignableTo(receiver: GoPtr<Checker>, source: GoPtr<Signature>, target: GoPtr<Signature>, ignoreReturnTypes: bool): bool {
  return Checker_compareSignaturesRelated(receiver, source, target, ignoreReturnTypes ? SignatureCheckModeIgnoreReturnTypes : SignatureCheckModeNone, false as bool, undefined!, receiver!.compareTypesAssignable as TypeComparer, undefined) !== TernaryFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.compareSignaturesRelated","kind":"method","status":"implemented","sigHash":"b6980cfc0e095c4a60787cd96d46a9ae3dba694c3b5e5072522a41b61eb6c6ed","bodyHash":"f9a21ffbf4d0844246f1df5d16fd4c026b7f386253ef9b99b8914ccfca047ebc"}
 *
 * Go source:
 * func (c *Checker) compareSignaturesRelated(source *Signature, target *Signature, checkMode SignatureCheckMode, reportErrors bool, errorReporter ErrorReporter, compareTypes TypeComparer, reportUnreliableMarkers *TypeMapper) Ternary {
 * 	if source == target {
 * 		return TernaryTrue
 * 	}
 * 	if !(checkMode&SignatureCheckModeStrictTopSignature != 0 && c.isTopSignature(source)) && c.isTopSignature(target) {
 * 		return TernaryTrue
 * 	}
 * 	if checkMode&SignatureCheckModeStrictTopSignature != 0 && c.isTopSignature(source) && !c.isTopSignature(target) {
 * 		return TernaryFalse
 * 	}
 * 	targetCount := c.getParameterCount(target)
 * 	var sourceHasMoreParameters bool
 * 	if !c.hasEffectiveRestParameter(target) {
 * 		if checkMode&SignatureCheckModeStrictArity != 0 {
 * 			sourceHasMoreParameters = c.hasEffectiveRestParameter(source) || c.getParameterCount(source) > targetCount
 * 		} else {
 * 			sourceHasMoreParameters = c.getMinArgumentCount(source) > targetCount
 * 		}
 * 	}
 * 	if sourceHasMoreParameters {
 * 		if reportErrors && (checkMode&SignatureCheckModeStrictArity == 0) {
 * 			// the second condition should be redundant, because there is no error reporting when comparing signatures by strict arity
 * 			// since it is only done for subtype reduction
 * 			errorReporter(diagnostics.Target_signature_provides_too_few_arguments_Expected_0_or_more_but_got_1, c.getMinArgumentCount(source), targetCount)
 * 		}
 * 		return TernaryFalse
 * 	}
 * 	if len(source.typeParameters) != 0 && !core.Same(source.typeParameters, target.typeParameters) {
 * 		target = c.getCanonicalSignature(target)
 * 		source = c.instantiateSignatureInContextOf(source, target /*inferenceContext* /, nil, compareTypes)
 * 	}
 * 	sourceCount := c.getParameterCount(source)
 * 	sourceRestType := c.getNonArrayRestType(source)
 * 	targetRestType := c.getNonArrayRestType(target)
 * 	if sourceRestType != nil || targetRestType != nil {
 * 		c.instantiateType(core.IfElse(sourceRestType != nil, sourceRestType, targetRestType), reportUnreliableMarkers)
 * 	}
 * 	kind := ast.KindUnknown
 * 	if target.declaration != nil {
 * 		kind = target.declaration.Kind
 * 	}
 * 	strictVariance := checkMode&SignatureCheckModeCallback == 0 && c.strictFunctionTypes && kind != ast.KindMethodDeclaration && kind != ast.KindMethodSignature && kind != ast.KindConstructor
 * 	result := TernaryTrue
 * 	sourceThisType := c.getThisTypeOfSignature(source)
 * 	if sourceThisType != nil && sourceThisType != c.voidType {
 * 		targetThisType := c.getThisTypeOfSignature(target)
 * 		if targetThisType != nil {
 * 			// void sources are assignable to anything.
 * 			var related Ternary
 * 			if !strictVariance {
 * 				related = compareTypes(sourceThisType, targetThisType, false /*reportErrors* /)
 * 			}
 * 			if related == TernaryFalse {
 * 				related = compareTypes(targetThisType, sourceThisType, reportErrors)
 * 			}
 * 			if related == TernaryFalse {
 * 				if reportErrors {
 * 					errorReporter(diagnostics.The_this_types_of_each_signature_are_incompatible)
 * 				}
 * 				return TernaryFalse
 * 			}
 * 			result &= related
 * 		}
 * 	}
 * 	var paramCount int
 * 	if sourceRestType != nil || targetRestType != nil {
 * 		paramCount = min(sourceCount, targetCount)
 * 	} else {
 * 		paramCount = max(sourceCount, targetCount)
 * 	}
 * 	var restIndex int
 * 	if sourceRestType != nil || targetRestType != nil {
 * 		restIndex = paramCount - 1
 * 	} else {
 * 		restIndex = -1
 * 	}
 * 	for i := range paramCount {
 * 		var sourceType *Type
 * 		if i == restIndex {
 * 			sourceType = c.getRestOrAnyTypeAtPosition(source, i)
 * 		} else {
 * 			sourceType = c.tryGetTypeAtPosition(source, i)
 * 		}
 * 		var targetType *Type
 * 		if i == restIndex {
 * 			targetType = c.getRestOrAnyTypeAtPosition(target, i)
 * 		} else {
 * 			targetType = c.tryGetTypeAtPosition(target, i)
 * 		}
 * 		if sourceType != nil && targetType != nil && (sourceType != targetType || checkMode&SignatureCheckModeStrictArity != 0) {
 * 			// In order to ensure that any generic type Foo<T> is at least co-variant with respect to T no matter
 * 			// how Foo uses T, we need to relate parameters bi-variantly (given that parameters are input positions,
 * 			// they naturally relate only contra-variantly). However, if the source and target parameters both have
 * 			// function types with a single call signature, we know we are relating two callback parameters. In
 * 			// that case it is sufficient to only relate the parameters of the signatures co-variantly because,
 * 			// similar to return values, callback parameters are output positions. This means that a Promise<T>,
 * 			// where T is used only in callback parameter positions, will be co-variant (as opposed to bi-variant)
 * 			// with respect to T.
 * 			var sourceSig *Signature
 * 			var targetSig *Signature
 * 			if checkMode&SignatureCheckModeCallback == 0 && !c.isInstantiatedGenericParameter(source, i) {
 * 				sourceSig = c.getSingleCallSignature(c.GetNonNullableType(sourceType))
 * 			}
 * 			if checkMode&SignatureCheckModeCallback == 0 && !c.isInstantiatedGenericParameter(target, i) {
 * 				targetSig = c.getSingleCallSignature(c.GetNonNullableType(targetType))
 * 			}
 * 			callbacks := sourceSig != nil && targetSig != nil && c.getTypePredicateOfSignature(sourceSig) == nil && c.getTypePredicateOfSignature(targetSig) == nil &&
 * 				c.getTypeFacts(sourceType, TypeFactsIsUndefinedOrNull) == c.getTypeFacts(targetType, TypeFactsIsUndefinedOrNull)
 * 			var related Ternary
 * 			if callbacks {
 * 				related = c.compareSignaturesRelated(targetSig, sourceSig, checkMode&SignatureCheckModeStrictArity|core.IfElse(strictVariance, SignatureCheckModeStrictCallback, SignatureCheckModeBivariantCallback), reportErrors, errorReporter, compareTypes, reportUnreliableMarkers)
 * 			} else {
 * 				if checkMode&SignatureCheckModeCallback == 0 && !strictVariance {
 * 					related = compareTypes(sourceType, targetType, false /*reportErrors* /)
 * 				}
 * 				if related == TernaryFalse {
 * 					related = compareTypes(targetType, sourceType, reportErrors)
 * 				}
 * 			}
 * 			// With strict arity, (x: number | undefined) => void is a subtype of (x?: number | undefined) => void
 * 			if related != TernaryFalse && checkMode&SignatureCheckModeStrictArity != 0 && i >= c.getMinArgumentCount(source) && i < c.getMinArgumentCount(target) && compareTypes(sourceType, targetType, false /*reportErrors* /) != TernaryFalse {
 * 				related = TernaryFalse
 * 			}
 * 			if related == TernaryFalse {
 * 				if reportErrors {
 * 					errorReporter(diagnostics.Types_of_parameters_0_and_1_are_incompatible, c.getParameterNameAtPosition(source, i), c.getParameterNameAtPosition(target, i))
 * 				}
 * 				return TernaryFalse
 * 			}
 * 			result &= related
 * 		}
 * 	}
 * 	if checkMode&SignatureCheckModeIgnoreReturnTypes == 0 {
 * 		// If a signature resolution is already in-flight, skip issuing a circularity error
 * 		// here and just use the `any` type directly
 * 		targetReturnType := c.getNonCircularReturnTypeOfSignature(target)
 * 		if targetReturnType == c.voidType || targetReturnType == c.anyType {
 * 			return result
 * 		}
 * 		sourceReturnType := c.getNonCircularReturnTypeOfSignature(source)
 * 		// The following block preserves behavior forbidding boolean returning functions from being assignable to type guard returning functions
 * 		targetTypePredicate := c.getTypePredicateOfSignature(target)
 * 		if targetTypePredicate != nil {
 * 			sourceTypePredicate := c.getTypePredicateOfSignature(source)
 * 			if sourceTypePredicate != nil {
 * 				result &= c.compareTypePredicateRelatedTo(sourceTypePredicate, targetTypePredicate, reportErrors, errorReporter, compareTypes)
 * 			} else if targetTypePredicate.kind == TypePredicateKindIdentifier || targetTypePredicate.kind == TypePredicateKindThis {
 * 				if reportErrors {
 * 					errorReporter(diagnostics.Signature_0_must_be_a_type_predicate, c.signatureToString(source))
 * 				}
 * 				return TernaryFalse
 * 			}
 * 		} else {
 * 			// When relating callback signatures, we still need to relate return types bi-variantly as otherwise
 * 			// the containing type wouldn't be co-variant. For example, interface Foo<T> { add(cb: () => T): void }
 * 			// wouldn't be co-variant for T without this rule.
 * 			var related Ternary
 * 			if checkMode&SignatureCheckModeBivariantCallback != 0 {
 * 				related = compareTypes(targetReturnType, sourceReturnType, false /*reportErrors* /)
 * 			}
 * 			if related == TernaryFalse {
 * 				related = compareTypes(sourceReturnType, targetReturnType, reportErrors)
 * 			}
 * 			result &= related
 * 			if result == TernaryFalse && reportErrors {
 * 				// The errors reported here serve as markers that trigger error chain reduction in the (*Relater).reportError
 * 				// method. The markers are elided in the final diagnostic chain and never actually reported.
 * 				var message *diagnostics.Message
 * 				if len(source.parameters) == 0 && len(target.parameters) == 0 {
 * 					message = core.IfElse(source.flags&SignatureFlagsConstruct != 0,
 * 						diagnostics.Construct_signatures_with_no_arguments_have_incompatible_return_types_0_and_1,
 * 						diagnostics.Call_signatures_with_no_arguments_have_incompatible_return_types_0_and_1)
 * 				} else {
 * 					message = core.IfElse(source.flags&SignatureFlagsConstruct != 0,
 * 						diagnostics.Construct_signature_return_types_0_and_1_are_incompatible,
 * 						diagnostics.Call_signature_return_types_0_and_1_are_incompatible)
 * 				}
 * 				errorReporter(message, c.TypeToString(sourceReturnType), c.TypeToString(targetReturnType))
 * 			}
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Checker_compareSignaturesRelated(receiver: GoPtr<Checker>, source: GoPtr<Signature>, target: GoPtr<Signature>, checkMode: SignatureCheckMode, reportErrors: bool, errorReporter: ErrorReporter, compareTypes: TypeComparer, reportUnreliableMarkers: GoPtr<TypeMapper>): Ternary {
  if (source === target) {
    return TernaryTrue;
  }
  if (!((checkMode & SignatureCheckModeStrictTopSignature) !== 0 && Checker_isTopSignature(receiver, source)) && Checker_isTopSignature(receiver, target)) {
    return TernaryTrue;
  }
  if ((checkMode & SignatureCheckModeStrictTopSignature) !== 0 && Checker_isTopSignature(receiver, source) && !Checker_isTopSignature(receiver, target)) {
    return TernaryFalse;
  }
  const targetCount = Checker_getParameterCount(receiver, target);
  let sourceHasMoreParameters = false;
  if (!Checker_hasEffectiveRestParameter(receiver, target)) {
    if ((checkMode & SignatureCheckModeStrictArity) !== 0) {
      sourceHasMoreParameters = Checker_hasEffectiveRestParameter(receiver, source) || Checker_getParameterCount(receiver, source) > targetCount;
    } else {
      sourceHasMoreParameters = Checker_getMinArgumentCount(receiver, source) > targetCount;
    }
  }
  if (sourceHasMoreParameters) {
    if (reportErrors && (checkMode & SignatureCheckModeStrictArity) === 0) {
      errorReporter(Target_signature_provides_too_few_arguments_Expected_0_or_more_but_got_1, Checker_getMinArgumentCount(receiver, source), targetCount);
    }
    return TernaryFalse;
  }
  let src = source;
  let tgt = target;
  if ((src!.typeParameters !== undefined && src!.typeParameters.length !== 0) && !Same(src!.typeParameters, tgt!.typeParameters)) {
    tgt = Checker_getCanonicalSignature(receiver, tgt);
    src = Checker_instantiateSignatureInContextOf(receiver, src, tgt, undefined, compareTypes);
  }
  const sourceCount = Checker_getParameterCount(receiver, src);
  const sourceRestType = Checker_getNonArrayRestType(receiver, src);
  const targetRestType = Checker_getNonArrayRestType(receiver, tgt);
  if (sourceRestType !== undefined || targetRestType !== undefined) {
    Checker_instantiateType(receiver, sourceRestType !== undefined ? sourceRestType : targetRestType, reportUnreliableMarkers);
  }
  let kind: int = KindUnknown;
  if (tgt!.declaration !== undefined) {
    kind = tgt!.declaration!.Kind;
  }
  const strictVariance = (checkMode & SignatureCheckModeCallback) === 0 && receiver!.strictFunctionTypes && kind !== KindMethodDeclaration && kind !== KindMethodSignature && kind !== KindConstructor;
  let result: Ternary = TernaryTrue;
  const sourceThisType = Checker_getThisTypeOfSignature(receiver, src);
  if (sourceThisType !== undefined && sourceThisType !== receiver!.voidType) {
    const targetThisType = Checker_getThisTypeOfSignature(receiver, tgt);
    if (targetThisType !== undefined) {
      let related: Ternary = TernaryFalse;
      if (!strictVariance) {
        related = compareTypes(sourceThisType, targetThisType, false as bool);
      }
      if (related === TernaryFalse) {
        related = compareTypes(targetThisType, sourceThisType, reportErrors);
      }
      if (related === TernaryFalse) {
        if (reportErrors) {
          errorReporter(The_this_types_of_each_signature_are_incompatible);
        }
        return TernaryFalse;
      }
      result = (result & related) as Ternary;
    }
  }
  let paramCount: int;
  if (sourceRestType !== undefined || targetRestType !== undefined) {
    paramCount = Math.min(sourceCount, targetCount);
  } else {
    paramCount = Math.max(sourceCount, targetCount);
  }
  let restIndex: int;
  if (sourceRestType !== undefined || targetRestType !== undefined) {
    restIndex = paramCount - 1;
  } else {
    restIndex = -1;
  }
  for (let i = 0; i < paramCount; i++) {
    let sourceType: GoPtr<Type>;
    if (i === restIndex) {
      sourceType = Checker_getRestOrAnyTypeAtPosition(receiver, src, i);
    } else {
      sourceType = Checker_tryGetTypeAtPosition(receiver, src, i);
    }
    let targetType: GoPtr<Type>;
    if (i === restIndex) {
      targetType = Checker_getRestOrAnyTypeAtPosition(receiver, tgt, i);
    } else {
      targetType = Checker_tryGetTypeAtPosition(receiver, tgt, i);
    }
    if (sourceType !== undefined && targetType !== undefined && (sourceType !== targetType || (checkMode & SignatureCheckModeStrictArity) !== 0)) {
      let sourceSig: GoPtr<Signature> = undefined;
      let targetSig: GoPtr<Signature> = undefined;
      if ((checkMode & SignatureCheckModeCallback) === 0 && !Checker_isInstantiatedGenericParameter(receiver, src, i)) {
        sourceSig = Checker_getSingleCallSignature(receiver, Checker_GetNonNullableType(receiver, sourceType));
      }
      if ((checkMode & SignatureCheckModeCallback) === 0 && !Checker_isInstantiatedGenericParameter(receiver, tgt, i)) {
        targetSig = Checker_getSingleCallSignature(receiver, Checker_GetNonNullableType(receiver, targetType));
      }
      const callbacks = sourceSig !== undefined && targetSig !== undefined &&
        Checker_getTypePredicateOfSignature(receiver, sourceSig) === undefined &&
        Checker_getTypePredicateOfSignature(receiver, targetSig) === undefined &&
        Checker_getTypeFacts(receiver, sourceType, TypeFactsIsUndefinedOrNull) === Checker_getTypeFacts(receiver, targetType, TypeFactsIsUndefinedOrNull);
      let related: Ternary = TernaryFalse;
      if (callbacks) {
        related = Checker_compareSignaturesRelated(receiver, targetSig, sourceSig,
          ((checkMode & SignatureCheckModeStrictArity) | (strictVariance ? SignatureCheckModeStrictCallback : SignatureCheckModeBivariantCallback)) as SignatureCheckMode,
          reportErrors, errorReporter, compareTypes, reportUnreliableMarkers);
      } else {
        if ((checkMode & SignatureCheckModeCallback) === 0 && !strictVariance) {
          related = compareTypes(sourceType, targetType, false as bool);
        }
        if (related === TernaryFalse) {
          related = compareTypes(targetType, sourceType, reportErrors);
        }
      }
      if (related !== TernaryFalse && (checkMode & SignatureCheckModeStrictArity) !== 0 && i >= Checker_getMinArgumentCount(receiver, src) && i < Checker_getMinArgumentCount(receiver, tgt) && compareTypes(sourceType, targetType, false as bool) !== TernaryFalse) {
        related = TernaryFalse;
      }
      if (related === TernaryFalse) {
        if (reportErrors) {
          errorReporter(Types_of_parameters_0_and_1_are_incompatible, Checker_getParameterNameAtPosition(receiver, src, i), Checker_getParameterNameAtPosition(receiver, tgt, i));
        }
        return TernaryFalse;
      }
      result = (result & related) as Ternary;
    }
  }
  if ((checkMode & SignatureCheckModeIgnoreReturnTypes) === 0) {
    const targetReturnType = Checker_getNonCircularReturnTypeOfSignature(receiver, tgt);
    if (targetReturnType === receiver!.voidType || targetReturnType === receiver!.anyType) {
      return result;
    }
    const sourceReturnType = Checker_getNonCircularReturnTypeOfSignature(receiver, src);
    const targetTypePredicate = Checker_getTypePredicateOfSignature(receiver, tgt);
    if (targetTypePredicate !== undefined) {
      const sourceTypePredicate = Checker_getTypePredicateOfSignature(receiver, src);
      if (sourceTypePredicate !== undefined) {
        result = (result & Checker_compareTypePredicateRelatedTo(receiver, sourceTypePredicate, targetTypePredicate, reportErrors, errorReporter, compareTypes)) as Ternary;
      } else if (targetTypePredicate!.kind === TypePredicateKindIdentifier || targetTypePredicate!.kind === TypePredicateKindThis) {
        if (reportErrors) {
          errorReporter(Signature_0_must_be_a_type_predicate, Checker_signatureToString(receiver, src));
        }
        return TernaryFalse;
      }
    } else {
      let related: Ternary = TernaryFalse;
      if ((checkMode & SignatureCheckModeBivariantCallback) !== 0) {
        related = compareTypes(targetReturnType, sourceReturnType, false as bool);
      }
      if (related === TernaryFalse) {
        related = compareTypes(sourceReturnType, targetReturnType, reportErrors);
      }
      result = (result & related) as Ternary;
      if (result === TernaryFalse && reportErrors) {
        let message: GoPtr<Message>;
        if (src!.parameters.length === 0 && tgt!.parameters.length === 0) {
          message = (src!.flags & SignatureFlagsConstruct) !== 0
            ? Construct_signatures_with_no_arguments_have_incompatible_return_types_0_and_1
            : Call_signatures_with_no_arguments_have_incompatible_return_types_0_and_1;
        } else {
          message = (src!.flags & SignatureFlagsConstruct) !== 0
            ? Construct_signature_return_types_0_and_1_are_incompatible
            : Call_signature_return_types_0_and_1_are_incompatible;
        }
        errorReporter(message, Checker_typeToString(receiver, sourceReturnType, undefined), Checker_typeToString(receiver, targetReturnType, undefined));
      }
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.compareTypePredicateRelatedTo","kind":"method","status":"implemented","sigHash":"60aef56be393fc9d2968ae1ddd0ebfc769c957603a7d99e8d44ed1a733acd74b","bodyHash":"ebae061f2b9b97483f2fb79924a3dd3ed8e8c7c3ecfdcabd29251238f14eaacb"}
 *
 * Go source:
 * func (c *Checker) compareTypePredicateRelatedTo(source *TypePredicate, target *TypePredicate, reportErrors bool, errorReporter ErrorReporter, compareTypes TypeComparer) Ternary {
 * 	if source.kind != target.kind {
 * 		if reportErrors {
 * 			errorReporter(diagnostics.A_this_based_type_guard_is_not_compatible_with_a_parameter_based_type_guard)
 * 			errorReporter(diagnostics.Type_predicate_0_is_not_assignable_to_1, c.typePredicateToString(source), c.typePredicateToString(target))
 * 		}
 * 		return TernaryFalse
 * 	}
 * 	if source.kind == TypePredicateKindIdentifier || source.kind == TypePredicateKindAssertsIdentifier {
 * 		if source.parameterIndex != target.parameterIndex {
 * 			if reportErrors {
 * 				errorReporter(diagnostics.Parameter_0_is_not_in_the_same_position_as_parameter_1, source.parameterName, target.parameterName)
 * 				errorReporter(diagnostics.Type_predicate_0_is_not_assignable_to_1, c.typePredicateToString(source), c.typePredicateToString(target))
 * 			}
 * 			return TernaryFalse
 * 		}
 * 	}
 * 	var related Ternary
 * 	switch {
 * 	case source.t == target.t:
 * 		related = TernaryTrue
 * 	case source.t != nil && target.t != nil:
 * 		related = compareTypes(source.t, target.t, reportErrors)
 * 	default:
 * 		related = TernaryFalse
 * 	}
 * 	if related == TernaryFalse && reportErrors {
 * 		errorReporter(diagnostics.Type_predicate_0_is_not_assignable_to_1, c.typePredicateToString(source), c.typePredicateToString(target))
 * 	}
 * 	return related
 * }
 */
export function Checker_compareTypePredicateRelatedTo(receiver: GoPtr<Checker>, source: GoPtr<TypePredicate>, target: GoPtr<TypePredicate>, reportErrors: bool, errorReporter: ErrorReporter, compareTypes: TypeComparer): Ternary {
  if (source!.kind !== target!.kind) {
    if (reportErrors) {
      errorReporter(A_this_based_type_guard_is_not_compatible_with_a_parameter_based_type_guard);
      errorReporter(Type_predicate_0_is_not_assignable_to_1, Checker_typePredicateToString(receiver, source), Checker_typePredicateToString(receiver, target));
    }
    return TernaryFalse;
  }
  if (source!.kind === TypePredicateKindIdentifier || source!.kind === TypePredicateKindAssertsIdentifier) {
    if (source!.parameterIndex !== target!.parameterIndex) {
      if (reportErrors) {
        errorReporter(Parameter_0_is_not_in_the_same_position_as_parameter_1, source!.parameterName, target!.parameterName);
        errorReporter(Type_predicate_0_is_not_assignable_to_1, Checker_typePredicateToString(receiver, source), Checker_typePredicateToString(receiver, target));
      }
      return TernaryFalse;
    }
  }
  let related: Ternary;
  if (source!.t === target!.t) {
    related = TernaryTrue;
  } else if (source!.t !== undefined && target!.t !== undefined) {
    related = compareTypes(source!.t, target!.t, reportErrors);
  } else {
    related = TernaryFalse;
  }
  if (related === TernaryFalse && reportErrors) {
    errorReporter(Type_predicate_0_is_not_assignable_to_1, Checker_typePredicateToString(receiver, source), Checker_typePredicateToString(receiver, target));
  }
  return related;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isTopSignature","kind":"method","status":"implemented","sigHash":"f0b29cc5175a31dba24d21bb95a2283067620147b857dc153fc093a3a4062f1a","bodyHash":"4ed4663eb01f84938f2b130f89a6ae892924e2e2e8fa594da462b5d2df34e84c"}
 *
 * Go source:
 * func (c *Checker) isTopSignature(s *Signature) bool {
 * 	if len(s.typeParameters) == 0 && (s.thisParameter == nil || IsTypeAny(c.getTypeOfParameter(s.thisParameter))) && len(s.parameters) == 1 && signatureHasRestParameter(s) {
 * 		paramType := c.getTypeOfParameter(s.parameters[0])
 * 		var restType *Type
 * 		if c.isArrayType(paramType) {
 * 			restType = c.getTypeArguments(paramType)[0]
 * 		} else {
 * 			restType = paramType
 * 		}
 * 		return restType.flags&(TypeFlagsAny|TypeFlagsNever) != 0 && c.getReturnTypeOfSignature(s).flags&TypeFlagsAnyOrUnknown != 0
 * 	}
 * 	return false
 * }
 */
export function Checker_isTopSignature(receiver: GoPtr<Checker>, s: GoPtr<Signature>): bool {
  if (s!.typeParameters === undefined || s!.typeParameters.length === 0) {
    if ((s!.thisParameter === undefined || IsTypeAny(Checker_getTypeOfParameter(receiver, s!.thisParameter))) && s!.parameters.length === 1 && signatureHasRestParameter(s)) {
      const paramType = Checker_getTypeOfParameter(receiver, s!.parameters[0]);
      let restType: GoPtr<Type>;
      if (Checker_isArrayType(receiver, paramType)) {
        restType = Checker_getTypeArguments(receiver, paramType)![0];
      } else {
        restType = paramType;
      }
      return ((restType!.flags & (TypeFlagsAny | TypeFlagsNever)) !== 0 && (Checker_getReturnTypeOfSignature(receiver, s)!.flags & TypeFlagsAnyOrUnknown) !== 0) as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getParameterCount","kind":"method","status":"implemented","sigHash":"3627b430319912a0baec260bea6862f82c3785ff04b1dfb2584477f3610152ca","bodyHash":"e9b1554d53636c544ab5601a9d609fa7a46a18641cafd58307c1ad2096b4151b"}
 *
 * Go source:
 * func (c *Checker) getParameterCount(signature *Signature) int {
 * 	length := len(signature.parameters)
 * 	if signatureHasRestParameter(signature) {
 * 		restType := c.getTypeOfSymbol(signature.parameters[length-1])
 * 		if isTupleType(restType) {
 * 			return length + restType.TargetTupleType().fixedLength - core.IfElse(restType.TargetTupleType().combinedFlags&ElementFlagsVariable != 0, 0, 1)
 * 		}
 * 	}
 * 	return length
 * }
 */
export function Checker_getParameterCount(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): int {
  const length = signature!.parameters.length;
  if (signatureHasRestParameter(signature)) {
    const restType = Checker_getTypeOfSymbol(receiver, signature!.parameters[length - 1]);
    if (isTupleType(restType)) {
      const tupleType = Type_TargetTupleType(restType);
      return length + tupleType!.fixedLength - ((tupleType!.combinedFlags & ElementFlagsVariable) !== 0 ? 0 : 1);
    }
  }
  return length;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getMinArgumentCount","kind":"method","status":"implemented","sigHash":"9ed77f4ae8c9feec91c9ae802fd1028a3148b30b09a333d16bd80b830686956b","bodyHash":"644fa71318592696d1d67e0d73b0cbaa847bef20bef612dafaf8b03c3aa00e81"}
 *
 * Go source:
 * func (c *Checker) getMinArgumentCount(signature *Signature) int {
 * 	return c.getMinArgumentCountEx(signature, MinArgumentCountFlagsNone)
 * }
 */
export function Checker_getMinArgumentCount(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): int {
  return Checker_getMinArgumentCountEx(receiver, signature, MinArgumentCountFlagsNone);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getMinArgumentCountEx","kind":"method","status":"implemented","sigHash":"a1b090713b00c6c797070c857d196d11adfe8b3a93c14c6f875ad279970361b4","bodyHash":"bebcda3a594dbb3eb0ba0c6fafa013132338dd8311a9d4844d5b03726cbedb0d"}
 *
 * Go source:
 * func (c *Checker) getMinArgumentCountEx(signature *Signature, flags MinArgumentCountFlags) int {
 * 	strongArityForUntypedJS := flags & MinArgumentCountFlagsStrongArityForUntypedJS
 * 	voidIsNonOptional := flags & MinArgumentCountFlagsVoidIsNonOptional
 * 	if voidIsNonOptional != 0 || signature.resolvedMinArgumentCount == -1 {
 * 		minArgumentCount := -1
 * 		if signatureHasRestParameter(signature) {
 * 			restType := c.getTypeOfSymbol(signature.parameters[len(signature.parameters)-1])
 * 			if isTupleType(restType) {
 * 				firstOptionalIndex := core.FindIndex(restType.TargetTupleType().elementInfos, func(info TupleElementInfo) bool {
 * 					return info.flags&ElementFlagsRequired == 0
 * 				})
 * 				requiredCount := firstOptionalIndex
 * 				if firstOptionalIndex < 0 {
 * 					requiredCount = restType.TargetTupleType().fixedLength
 * 				}
 * 				if requiredCount > 0 {
 * 					minArgumentCount = len(signature.parameters) - 1 + requiredCount
 * 				}
 * 			}
 * 		}
 * 		if minArgumentCount == -1 {
 * 			if strongArityForUntypedJS == 0 && signature.flags&SignatureFlagsIsUntypedSignatureInJSFile != 0 {
 * 				return 0
 * 			}
 * 			minArgumentCount = int(signature.minArgumentCount)
 * 		}
 * 		if voidIsNonOptional != 0 {
 * 			return minArgumentCount
 * 		}
 * 		for i := minArgumentCount - 1; i >= 0; i-- {
 * 			t := c.getTypeAtPosition(signature, i)
 * 			if !someType(t, func(t *Type) bool { return t.flags&TypeFlagsVoid != 0 }) {
 * 				break
 * 			}
 * 			minArgumentCount = i
 * 		}
 * 		signature.resolvedMinArgumentCount = int32(minArgumentCount)
 * 	}
 * 	return int(signature.resolvedMinArgumentCount)
 * }
 */
export function Checker_getMinArgumentCountEx(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, flags: MinArgumentCountFlags): int {
  const strongArityForUntypedJS = flags & MinArgumentCountFlagsStrongArityForUntypedJS;
  const voidIsNonOptional = flags & MinArgumentCountFlagsVoidIsNonOptional;
  if (voidIsNonOptional !== 0 || signature!.resolvedMinArgumentCount === -1) {
    let minArgumentCount = -1;
    if (signatureHasRestParameter(signature)) {
      const restType = Checker_getTypeOfSymbol(receiver, signature!.parameters[signature!.parameters.length - 1]);
      if (isTupleType(restType)) {
        const tupleType = Type_TargetTupleType(restType);
        const firstOptionalIndex = FindIndex(tupleType!.elementInfos, (info: TupleElementInfo) => (info.flags & ElementFlagsRequired) === 0);
        const requiredCount = firstOptionalIndex < 0 ? tupleType!.fixedLength : firstOptionalIndex;
        if (requiredCount > 0) {
          minArgumentCount = signature!.parameters.length - 1 + requiredCount;
        }
      }
    }
    if (minArgumentCount === -1) {
      if (strongArityForUntypedJS === 0 && (signature!.flags & SignatureFlagsIsUntypedSignatureInJSFile) !== 0) {
        return 0;
      }
      minArgumentCount = signature!.minArgumentCount;
    }
    if (voidIsNonOptional !== 0) {
      return minArgumentCount;
    }
    for (let i = minArgumentCount - 1; i >= 0; i--) {
      const t = Checker_getTypeAtPosition(receiver, signature, i);
      if (!someType(t, (t: GoPtr<Type>) => (t!.flags & TypeFlagsVoid) !== 0)) {
        break;
      }
      minArgumentCount = i;
    }
    signature!.resolvedMinArgumentCount = minArgumentCount;
  }
  return signature!.resolvedMinArgumentCount;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.hasEffectiveRestParameter","kind":"method","status":"implemented","sigHash":"db2062c0c33ae68a86c15484a6c8a32d8abc60adf9204940c0bba797b4f09821","bodyHash":"6d0e91daa859f131e64475f67b4a79839169102a9c260544dd9cf4e747354228"}
 *
 * Go source:
 * func (c *Checker) hasEffectiveRestParameter(signature *Signature) bool {
 * 	if signatureHasRestParameter(signature) {
 * 		restType := c.getTypeOfSymbol(signature.parameters[len(signature.parameters)-1])
 * 		return !isTupleType(restType) || restType.TargetTupleType().combinedFlags&ElementFlagsVariable != 0
 * 	}
 * 	return false
 * }
 */
export function Checker_hasEffectiveRestParameter(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): bool {
  if (signatureHasRestParameter(signature)) {
    const restType = Checker_getTypeOfSymbol(receiver, signature!.parameters[signature!.parameters.length - 1]);
    return (!isTupleType(restType) || (Type_TargetTupleType(restType)!.combinedFlags & ElementFlagsVariable) !== 0) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getTypeAtPosition","kind":"method","status":"implemented","sigHash":"485e6012698639d17264e3683b22ea40134e775e573e42d63cd2c0020d5edc1e","bodyHash":"9860c0f56d71ff1cb6ca85f8a99a96a2122534b3284710ebda73abae8c53edfe"}
 *
 * Go source:
 * func (c *Checker) getTypeAtPosition(signature *Signature, pos int) *Type {
 * 	t := c.tryGetTypeAtPosition(signature, pos)
 * 	if t != nil {
 * 		return t
 * 	}
 * 	return c.anyType
 * }
 */
export function Checker_getTypeAtPosition(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, pos: int): GoPtr<Type> {
  const t = Checker_tryGetTypeAtPosition(receiver, signature, pos);
  if (t !== undefined) {
    return t;
  }
  return receiver!.anyType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.tryGetTypeAtPosition","kind":"method","status":"implemented","sigHash":"d12c99404ab0455a84c58dff84b89aa9e09f3427091617d50ab88953fc9bc6a6","bodyHash":"cad16e7bd3c91190c225ba7b701c364f609de79317f8eb16e74cd2c351b1e22d"}
 *
 * Go source:
 * func (c *Checker) tryGetTypeAtPosition(signature *Signature, pos int) *Type {
 * 	paramCount := len(signature.parameters) - core.IfElse(signatureHasRestParameter(signature), 1, 0)
 * 	if pos < paramCount {
 * 		return c.getTypeOfParameter(signature.parameters[pos])
 * 	}
 * 	if signatureHasRestParameter(signature) {
 * 		// We want to return the value undefined for an out of bounds parameter position,
 * 		// so we need to check bounds here before calling getIndexedAccessType (which
 * 		// otherwise would return the type 'undefined').
 * 		restType := c.getTypeOfSymbol(signature.parameters[paramCount])
 * 		index := pos - paramCount
 * 		if !isTupleType(restType) || restType.TargetTupleType().combinedFlags&ElementFlagsVariable != 0 || index < restType.TargetTupleType().fixedLength {
 * 			return c.getIndexedAccessType(restType, c.getNumberLiteralType(jsnum.Number(index)))
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_tryGetTypeAtPosition(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, pos: int): GoPtr<Type> {
  const paramCount = signature!.parameters.length - (signatureHasRestParameter(signature) ? 1 : 0);
  if (pos < paramCount) {
    return Checker_getTypeOfParameter(receiver, signature!.parameters[pos]);
  }
  if (signatureHasRestParameter(signature)) {
    const restType = Checker_getTypeOfSymbol(receiver, signature!.parameters[paramCount]);
    const index = pos - paramCount;
    if (!isTupleType(restType) || (Type_TargetTupleType(restType)!.combinedFlags & ElementFlagsVariable) !== 0 || index < Type_TargetTupleType(restType)!.fixedLength) {
      return Checker_getIndexedAccessType(receiver, restType, Checker_getNumberLiteralType(receiver, index));
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getRestOrAnyTypeAtPosition","kind":"method","status":"implemented","sigHash":"9e19b3376b6064d6a59123082872fa990f94ee6a10dabd3a25c6d3024c81ae14","bodyHash":"94f1939e5c4495263417163c7105205984c5ef22c1e6bcf38fe85944211128b0"}
 *
 * Go source:
 * func (c *Checker) getRestOrAnyTypeAtPosition(source *Signature, pos int) *Type {
 * 	restType := c.getRestTypeAtPosition(source, pos, false)
 * 	if restType != nil {
 * 		if elementType := c.getElementTypeOfArrayType(restType); elementType != nil && IsTypeAny(elementType) {
 * 			return c.anyType
 * 		}
 * 	}
 * 	return restType
 * }
 */
export function Checker_getRestOrAnyTypeAtPosition(receiver: GoPtr<Checker>, source: GoPtr<Signature>, pos: int): GoPtr<Type> {
  const restType = Checker_getRestTypeAtPosition(receiver, source, pos, false as bool);
  if (restType !== undefined) {
    const elementType = Checker_getElementTypeOfArrayType(receiver, restType);
    if (elementType !== undefined && IsTypeAny(elementType)) {
      return receiver!.anyType;
    }
  }
  return restType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getRestTypeAtPosition","kind":"method","status":"implemented","sigHash":"752e8cb7e457073f7611a1860e9236c18f1d5a956df53bfc82b2a493aa1bc997","bodyHash":"3856a6415466dd5228b004c4d01605a1de1b9a4f59853735d841df3e8e10add5"}
 *
 * Go source:
 * func (c *Checker) getRestTypeAtPosition(source *Signature, pos int, readonly bool) *Type {
 * 	parameterCount := c.getParameterCount(source)
 * 	minArgumentCount := c.getMinArgumentCount(source)
 * 	restType := c.getEffectiveRestType(source)
 * 	if restType != nil && pos >= parameterCount-1 {
 * 		if pos == parameterCount-1 {
 * 			return restType
 * 		} else {
 * 			return c.createArrayType(c.getIndexedAccessType(restType, c.numberType))
 * 		}
 * 	}
 * 	types := make([]*Type, parameterCount-pos)
 * 	infos := make([]TupleElementInfo, parameterCount-pos)
 * 	for i := range types {
 * 		var flags ElementFlags
 * 		if restType == nil || i < len(types)-1 {
 * 			types[i] = c.getTypeAtPosition(source, i+pos)
 * 			flags = core.IfElse(i+pos < minArgumentCount, ElementFlagsRequired, ElementFlagsOptional)
 * 		} else {
 * 			types[i] = restType
 * 			flags = ElementFlagsVariadic
 * 		}
 * 		infos[i] = TupleElementInfo{flags: flags, labeledDeclaration: c.getNameableDeclarationAtPosition(source, i+pos)}
 * 	}
 * 	return c.createTupleTypeEx(types, infos, readonly)
 * }
 */
export function Checker_getRestTypeAtPosition(receiver: GoPtr<Checker>, source: GoPtr<Signature>, pos: int, readonly: bool): GoPtr<Type> {
  const parameterCount = Checker_getParameterCount(receiver, source);
  const minArgumentCount = Checker_getMinArgumentCount(receiver, source);
  const restType = Checker_getEffectiveRestType(receiver, source);
  if (restType !== undefined && pos >= parameterCount - 1) {
    if (pos === parameterCount - 1) {
      return restType;
    } else {
      return Checker_createArrayType(receiver, Checker_getIndexedAccessType(receiver, restType, receiver!.numberType));
    }
  }
  const length = parameterCount - pos;
  if (length <= 0) {
    return Checker_createTupleType(receiver, undefined!);
  }
  const types: GoPtr<Type>[] = new Array(length);
  const infos: TupleElementInfo[] = new Array(length);
  for (let i = 0; i < length; i++) {
    let flags: ElementFlags;
    if (restType === undefined || i < length - 1) {
      types[i] = Checker_getTypeAtPosition(receiver, source, i + pos);
      flags = (i + pos < minArgumentCount ? ElementFlagsRequired : ElementFlagsOptional) as ElementFlags;
    } else {
      types[i] = restType;
      flags = ElementFlagsVariadic as ElementFlags;
    }
    infos[i] = { flags, labeledDeclaration: Checker_getNameableDeclarationAtPosition(receiver, source, i + pos) } as TupleElementInfo;
  }
  return Checker_createTupleTypeEx(receiver, types, infos, readonly);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getNameableDeclarationAtPosition","kind":"method","status":"implemented","sigHash":"5dc4dd1f104e821df1d26b6c68c85a951d8e7b65b0d49c72e3d1882c3c706c0a","bodyHash":"d79864ab023e04afa970cabaa56238843b8ab02c24e1fe43f335cbb6456a5875"}
 *
 * Go source:
 * func (c *Checker) getNameableDeclarationAtPosition(signature *Signature, pos int) *ast.Node {
 * 	paramCount := len(signature.parameters) - core.IfElse(signatureHasRestParameter(signature), 1, 0)
 * 	if pos < paramCount {
 * 		decl := signature.parameters[pos].ValueDeclaration
 * 		if decl != nil && c.isValidDeclarationForTupleLabel(decl) {
 * 			return decl
 * 		}
 * 		return nil
 * 	}
 * 	if signatureHasRestParameter(signature) {
 * 		restParameter := signature.parameters[paramCount]
 * 		restType := c.getTypeOfSymbol(restParameter)
 * 		if isTupleType(restType) {
 * 			elementInfos := restType.TargetTupleType().elementInfos
 * 			index := pos - paramCount
 * 			if index < len(elementInfos) {
 * 				return elementInfos[index].labeledDeclaration
 * 			}
 * 			return nil
 * 		}
 * 		if restParameter.ValueDeclaration != nil && c.isValidDeclarationForTupleLabel(restParameter.ValueDeclaration) {
 * 			return restParameter.ValueDeclaration
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getNameableDeclarationAtPosition(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, pos: int): GoPtr<Node> {
  const paramCount = signature!.parameters.length - (signatureHasRestParameter(signature) ? 1 : 0);
  if (pos < paramCount) {
    const decl = signature!.parameters[pos]!.ValueDeclaration;
    if (decl !== undefined && Checker_isValidDeclarationForTupleLabel(receiver, decl)) {
      return decl;
    }
    return undefined;
  }
  if (signatureHasRestParameter(signature)) {
    const restParameter = signature!.parameters[paramCount];
    const restType = Checker_getTypeOfSymbol(receiver, restParameter);
    if (isTupleType(restType)) {
      const elementInfos = Type_TargetTupleType(restType)!.elementInfos;
      const index = pos - paramCount;
      if (index < elementInfos.length) {
        return elementInfos[index]!.labeledDeclaration;
      }
      return undefined;
    }
    if (restParameter!.ValueDeclaration !== undefined && Checker_isValidDeclarationForTupleLabel(receiver, restParameter!.ValueDeclaration)) {
      return restParameter!.ValueDeclaration;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isValidDeclarationForTupleLabel","kind":"method","status":"implemented","sigHash":"055cb70d5295ebe40970599833b4322961327a27801f562434a991f7d3b75121","bodyHash":"d4f8848fc60a2df0e896c2c893440de454bd9d9dbd17de235c89b1ec492a5f95"}
 *
 * Go source:
 * func (c *Checker) isValidDeclarationForTupleLabel(d *ast.Node) bool {
 * 	return ast.IsNamedTupleMember(d) || ast.IsParameterDeclaration(d) && d.Name() != nil && ast.IsIdentifier(d.Name())
 * }
 */
export function Checker_isValidDeclarationForTupleLabel(receiver: GoPtr<Checker>, d: GoPtr<Node>): bool {
  return (IsNamedTupleMember(d) || IsParameterDeclaration(d) && d!.data.Name() !== undefined && IsIdentifier(d!.data.Name()!)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getNonArrayRestType","kind":"method","status":"implemented","sigHash":"2d1e56c21b1e8f60601f2a88ff3ff750b74a3491e8626aa02139861328ad2382","bodyHash":"1d5cd7ed1b89b88da38fd7c2ac8200e8cc15490bbb421b9be687afd38a1cbac0"}
 *
 * Go source:
 * func (c *Checker) getNonArrayRestType(signature *Signature) *Type {
 * 	restType := c.getEffectiveRestType(signature)
 * 	if restType != nil && !c.isArrayType(restType) && !IsTypeAny(restType) {
 * 		return restType
 * 	}
 * 	return nil
 * }
 */
export function Checker_getNonArrayRestType(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): GoPtr<Type> {
  const restType = Checker_getEffectiveRestType(receiver, signature);
  if (restType !== undefined && !Checker_isArrayType(receiver, restType) && !IsTypeAny(restType)) {
    return restType;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getEffectiveRestType","kind":"method","status":"implemented","sigHash":"e725e27051d1b3cc76d9cc6135fe77815eac249bdafbdaabd5a25f92afae2104","bodyHash":"a39fbfaacf3511aac5b8d490463b0fdc39527d76a7d49f1fb0068949562f0207"}
 *
 * Go source:
 * func (c *Checker) getEffectiveRestType(signature *Signature) *Type {
 * 	if signatureHasRestParameter(signature) {
 * 		restType := c.getTypeOfSymbol(signature.parameters[len(signature.parameters)-1])
 * 		if !isTupleType(restType) {
 * 			if IsTypeAny(restType) {
 * 				return c.anyArrayType
 * 			}
 * 			return restType
 * 		}
 * 		if restType.TargetTupleType().combinedFlags&ElementFlagsVariable != 0 {
 * 			return c.sliceTupleType(restType, restType.TargetTupleType().fixedLength, 0)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getEffectiveRestType(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): GoPtr<Type> {
  if (signatureHasRestParameter(signature)) {
    const restType = Checker_getTypeOfSymbol(receiver, signature!.parameters[signature!.parameters.length - 1]);
    if (!isTupleType(restType)) {
      if (IsTypeAny(restType)) {
        return receiver!.anyArrayType;
      }
      return restType;
    }
    if ((Type_TargetTupleType(restType)!.combinedFlags & ElementFlagsVariable) !== 0) {
      return Checker_sliceTupleType(receiver, restType, Type_TargetTupleType(restType)!.fixedLength, 0);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.sliceTupleType","kind":"method","status":"implemented","sigHash":"1e78c043c96e140a33e383fa28f044011abac9b616079ebcd22386c6ac56e203","bodyHash":"e1fd70c391162a44fcefffda98cf247939e2f1804bb00fe04bfc9b484f4fb5a7"}
 *
 * Go source:
 * func (c *Checker) sliceTupleType(t *Type, index int, endSkipCount int) *Type {
 * 	target := t.TargetTupleType()
 * 	endIndex := c.getTypeReferenceArity(t) - max(endSkipCount, 0)
 * 	if index > target.fixedLength {
 * 		if restArrayType := c.getRestArrayTypeOfTupleType(t); restArrayType != nil {
 * 			return restArrayType
 * 		}
 * 		return c.createTupleType(nil)
 * 	}
 * 	return c.createTupleTypeEx(c.getTypeArguments(t)[index:endIndex], target.elementInfos[index:endIndex], false /*readonly* /)
 * }
 */
export function Checker_sliceTupleType(receiver: GoPtr<Checker>, t: GoPtr<Type>, index: int, endSkipCount: int): GoPtr<Type> {
  const target = Type_TargetTupleType(t);
  const endIndex = Checker_getTypeReferenceArity(receiver, t) - Math.max(endSkipCount, 0);
  if (index > target!.fixedLength) {
    const restArrayType = Checker_getRestArrayTypeOfTupleType(receiver, t);
    if (restArrayType !== undefined) {
      return restArrayType;
    }
    return Checker_createTupleType(receiver, undefined!);
  }
  if (index >= endIndex) {
    return Checker_createTupleType(receiver, undefined!);
  }
  return Checker_createTupleTypeEx(receiver, Checker_getTypeArguments(receiver, t)!.slice(index, endIndex), target!.elementInfos.slice(index, endIndex), false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getKnownKeysOfTupleType","kind":"method","status":"implemented","sigHash":"77e77ba38b2ddb023281f676fc53e57583617b49233f0ddbc595b0c7034e367b","bodyHash":"3c73de611fbb847180f987e93fc2cd3cc8c9bfd048fc4efde684e1e81942be46"}
 *
 * Go source:
 * func (c *Checker) getKnownKeysOfTupleType(t *Type) *Type {
 * 	fixedLength := t.TargetTupleType().fixedLength
 * 	keys := make([]*Type, fixedLength+1)
 * 	for i := range fixedLength {
 * 		keys[i] = c.getStringLiteralType(strconv.Itoa(i))
 * 	}
 * 	keys[fixedLength] = c.getIndexType(core.IfElse(t.TargetTupleType().readonly, c.globalReadonlyArrayType, c.globalArrayType))
 * 	return c.getUnionType(keys)
 * }
 */
export function Checker_getKnownKeysOfTupleType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  const fixedLength = Type_TargetTupleType(t)!.fixedLength;
  const keys: GoPtr<Type>[] = new Array(fixedLength + 1);
  for (let i = 0; i < fixedLength; i++) {
    keys[i] = Checker_getStringLiteralType(receiver, String(i));
  }
  keys[fixedLength] = Checker_getIndexType(receiver, Type_TargetTupleType(t)!.readonly ? receiver!.globalReadonlyArrayType : receiver!.globalArrayType);
  return Checker_getUnionType(receiver, keys);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getRestArrayTypeOfTupleType","kind":"method","status":"implemented","sigHash":"b82c5b16976bec01630441facbe709ca16f8cfe1051d1bfaed4b80afdb5e0164","bodyHash":"7fdc8a08ff44d6ba817b733ae6f3bf80345a1848b9d3b6d2b6b195dc5b9c74cc"}
 *
 * Go source:
 * func (c *Checker) getRestArrayTypeOfTupleType(t *Type) *Type {
 * 	if restType := c.getRestTypeOfTupleType(t); restType != nil {
 * 		return c.createArrayType(restType)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getRestArrayTypeOfTupleType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  const restType = Checker_getRestTypeOfTupleType(receiver, t);
  if (restType !== undefined) {
    return Checker_createArrayType(receiver, restType);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getThisTypeOfSignature","kind":"method","status":"implemented","sigHash":"d5b742828e644dd34b050b453eca26a29a40717be0094afd63c6f2af15267b68","bodyHash":"a5f74ff5a1eb9d60a250cf253ca432698068ac92706c30a79fceec3bec2ffed3"}
 *
 * Go source:
 * func (c *Checker) getThisTypeOfSignature(signature *Signature) *Type {
 * 	if signature.thisParameter != nil {
 * 		return c.getTypeOfSymbol(signature.thisParameter)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getThisTypeOfSignature(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): GoPtr<Type> {
  if (signature!.thisParameter !== undefined) {
    return Checker_getTypeOfSymbol(receiver, signature!.thisParameter);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isInstantiatedGenericParameter","kind":"method","status":"implemented","sigHash":"715851bcfd803dd8e34782e5229fee6ed564c6fbde56b7636bcd6bd5cb9eb7ef","bodyHash":"15c67722c175b0c4967b36019e3b30a192e7ec50486c81150e6856886d4401bc"}
 *
 * Go source:
 * func (c *Checker) isInstantiatedGenericParameter(signature *Signature, pos int) bool {
 * 	if signature.target == nil {
 * 		return false
 * 	}
 * 	t := c.tryGetTypeAtPosition(signature.target, pos)
 * 	return t != nil && c.isGenericType(t)
 * }
 */
export function Checker_isInstantiatedGenericParameter(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, pos: int): bool {
  if (signature!.target === undefined) {
    return false as bool;
  }
  const t = Checker_tryGetTypeAtPosition(receiver, signature!.target, pos);
  return (t !== undefined && Checker_isGenericType(receiver, t)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getParameterNameAtPosition","kind":"method","status":"implemented","sigHash":"50bbc6658005695c4c3bb2431ce618fa7996b331fa8829e00d8ac4088868d4ed","bodyHash":"ce03250b20261324a7fce95fa4886ea58ab539d9135d6d5c5e92ae1f391ac163"}
 *
 * Go source:
 * func (c *Checker) getParameterNameAtPosition(signature *Signature, pos int) string {
 * 	paramCount := len(signature.parameters) - core.IfElse(signatureHasRestParameter(signature), 1, 0)
 * 	if pos < paramCount {
 * 		return signature.parameters[pos].Name
 * 	}
 * 	restParameter := signature.parameters[paramCount]
 * 	restType := c.getTypeOfSymbol(restParameter)
 * 	if isTupleType(restType) {
 * 		index := pos - paramCount
 * 		c.getTupleElementLabel(restType.TargetTupleType().elementInfos[index], restParameter, index)
 * 	}
 * 	return restParameter.Name
 * }
 */
export function Checker_getParameterNameAtPosition(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, pos: int): string {
  const paramCount = signature!.parameters.length - (signatureHasRestParameter(signature) ? 1 : 0);
  if (pos < paramCount) {
    return signature!.parameters[pos]!.Name;
  }
  const restParameter = signature!.parameters[paramCount];
  const restType = Checker_getTypeOfSymbol(receiver, restParameter);
  if (isTupleType(restType)) {
    const index = pos - paramCount;
    return Checker_getTupleElementLabel(receiver, Type_TargetTupleType(restType)!.elementInfos[index]!, restParameter, index);
  }
  return restParameter!.Name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getTupleElementLabel","kind":"method","status":"implemented","sigHash":"5ca47d7ed08bfd5fa4d3dc754d0b922f284b16ea1ec9680146a22e5b6e6b42b8","bodyHash":"b50c5e43395c9b05aa2df8ae17b13e29c5c51166e7e48881125d46ed631c2554"}
 *
 * Go source:
 * func (c *Checker) getTupleElementLabel(elementInfo TupleElementInfo, restSymbol *ast.Symbol, index int) string {
 * 	if elementInfo.labeledDeclaration != nil {
 * 		return elementInfo.labeledDeclaration.Name().Text()
 * 	}
 * 	if restSymbol != nil && restSymbol.ValueDeclaration != nil && ast.IsParameterDeclaration(restSymbol.ValueDeclaration) {
 * 		return c.getTupleElementLabelFromBindingElement(restSymbol.ValueDeclaration, index, elementInfo.flags)
 * 	}
 * 	var rootName string
 * 	if restSymbol != nil {
 * 		rootName = restSymbol.Name
 * 	} else {
 * 		rootName = "arg"
 * 	}
 * 	return rootName + "_" + strconv.Itoa(index)
 * }
 */
export function Checker_getTupleElementLabel(receiver: GoPtr<Checker>, elementInfo: TupleElementInfo, restSymbol: GoPtr<Symbol>, index: int): string {
  if (elementInfo.labeledDeclaration !== undefined) {
    return Node_Text(elementInfo.labeledDeclaration!.data.Name()!);
  }
  if (restSymbol !== undefined && restSymbol!.ValueDeclaration !== undefined && IsParameterDeclaration(restSymbol!.ValueDeclaration)) {
    return Checker_getTupleElementLabelFromBindingElement(receiver, restSymbol!.ValueDeclaration, index, elementInfo.flags);
  }
  const rootName = restSymbol !== undefined ? restSymbol!.Name : "arg";
  return rootName + "_" + String(index);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getTupleElementLabelFromBindingElement","kind":"method","status":"implemented","sigHash":"c192895beddda85cb11a10a725fca2604cc7b536dbae9b132f441dc4f2add8ee","bodyHash":"b5e0be583cf2fb3589609b07ad1c9ceaae6945de65d4077970398d0dc858e65e"}
 *
 * Go source:
 * func (c *Checker) getTupleElementLabelFromBindingElement(node *ast.Node, index int, elementFlags ElementFlags) string {
 * 	if node.Name() != nil {
 * 		switch node.Name().Kind {
 * 		case ast.KindIdentifier:
 * 			name := node.Name().Text()
 * 			if hasDotDotDotToken(node) {
 * 				// given
 * 				//   (...[x, y, ...z]: [number, number, ...number[]]) => ...
 * 				// this produces
 * 				//   (x: number, y: number, ...z: number[]) => ...
 * 				// which preserves rest elements of 'z'
 * 
 * 				// given
 * 				//   (...[x, y, ...z]: [number, number, ...[...number[], number]]) => ...
 * 				// this produces
 * 				//   (x: number, y: number, ...z: number[], z_1: number) => ...
 * 				// which preserves rest elements of z but gives distinct numbers to fixed elements of 'z'
 * 				if elementFlags&ElementFlagsVariable != 0 {
 * 					return name
 * 				}
 * 				return name + "_" + strconv.Itoa(index)
 * 			}
 * 			// given
 * 			//   (...[x]: [number]) => ...
 * 			// this produces
 * 			//   (x: number) => ...
 * 			// which preserves fixed elements of 'x'
 * 
 * 			// given
 * 			//   (...[x]: ...number[]) => ...
 * 			// this produces
 * 			//   (x_0: number) => ...
 * 			// which which numbers fixed elements of 'x' whose tuple element type is variable
 * 			if elementFlags&ElementFlagsFixed != 0 {
 * 				return name
 * 			}
 * 			return name + "_n"
 * 		case ast.KindArrayBindingPattern:
 * 			if hasDotDotDotToken(node) {
 * 				elements := node.Name().Elements()
 * 				lastElement := core.LastOrNil(elements)
 * 				lastElementIsBindingElementRest := lastElement != nil && ast.IsBindingElement(lastElement) && hasDotDotDotToken(lastElement)
 * 				elementCount := len(elements) - core.IfElse(lastElementIsBindingElementRest, 1, 0)
 * 				if index < elementCount {
 * 					element := elements[index]
 * 					if ast.IsBindingElement(element) {
 * 						return c.getTupleElementLabelFromBindingElement(element, index, elementFlags)
 * 					}
 * 				} else if lastElementIsBindingElementRest {
 * 					return c.getTupleElementLabelFromBindingElement(lastElement, index-elementCount, elementFlags)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return "arg_" + strconv.Itoa(index)
 * }
 */
export function Checker_getTupleElementLabelFromBindingElement(receiver: GoPtr<Checker>, node: GoPtr<Node>, index: int, elementFlags: ElementFlags): string {
  const nameNode = node!.data.Name();
  if (nameNode !== undefined) {
    if (nameNode!.Kind === KindIdentifier) {
      const name = Node_Text(nameNode!);
      if (hasDotDotDotToken(node)) {
        if ((elementFlags & ElementFlagsVariable) !== 0) {
          return name;
        }
        return name + "_" + String(index);
      }
      if ((elementFlags & ElementFlagsFixed) !== 0) {
        return name;
      }
      return name + "_n";
    }
    if (nameNode!.Kind === KindArrayBindingPattern) {
      if (hasDotDotDotToken(node)) {
        const elements = Node_Elements(nameNode!) ?? [];
        const lastElement = LastOrNil(elements);
        const lastElementIsBindingElementRest = lastElement !== undefined && IsBindingElement(lastElement) && hasDotDotDotToken(lastElement);
        const elementCount = elements.length - (lastElementIsBindingElementRest ? 1 : 0);
        if (index < elementCount) {
          const element = elements[index];
          if (IsBindingElement(element)) {
            return Checker_getTupleElementLabelFromBindingElement(receiver, element, index, elementFlags);
          }
        } else if (lastElementIsBindingElementRest) {
          return Checker_getTupleElementLabelFromBindingElement(receiver, lastElement!, index - elementCount, elementFlags);
        }
      }
    }
  }
  return "arg_" + String(index);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getTypePredicateOfSignature","kind":"method","status":"implemented","sigHash":"c8ac40b0f00c7a1e3f8a2ed6e6f28511e62eeb5e2d579b8516813c227623b5f1","bodyHash":"204fe6ef83f44d3ea9d233c987fef10647e18bd3aa82fa9a02246ef9257761ab"}
 *
 * Go source:
 * func (c *Checker) getTypePredicateOfSignature(sig *Signature) *TypePredicate {
 * 	if sig.resolvedTypePredicate == nil {
 * 		switch {
 * 		case sig.target != nil:
 * 			targetTypePredicate := c.getTypePredicateOfSignature(sig.target)
 * 			if targetTypePredicate != nil {
 * 				sig.resolvedTypePredicate = c.instantiateTypePredicate(targetTypePredicate, sig.mapper)
 * 			}
 * 		case sig.composite != nil:
 * 			sig.resolvedTypePredicate = c.getUnionOrIntersectionTypePredicate(sig.composite.signatures, sig.composite.isUnion)
 * 		default:
 * 			if sig.declaration != nil {
 * 				typeNode := sig.declaration.Type()
 * 				switch {
 * 				case typeNode != nil:
 * 					if ast.IsTypePredicateNode(typeNode) {
 * 						sig.resolvedTypePredicate = c.createTypePredicateFromTypePredicateNode(typeNode, sig)
 * 					}
 * 				case ast.IsFunctionLikeDeclaration(sig.declaration) && (sig.resolvedReturnType == nil || sig.resolvedReturnType.flags&TypeFlagsBoolean != 0) && c.getParameterCount(sig) > 0:
 * 					sig.resolvedTypePredicate = c.noTypePredicate // avoid infinite loop
 * 					sig.resolvedTypePredicate = c.getTypePredicateFromBody(sig.declaration)
 * 				}
 * 			}
 * 		}
 * 		if sig.resolvedTypePredicate == nil {
 * 			sig.resolvedTypePredicate = c.noTypePredicate
 * 		}
 * 	}
 * 	if sig.resolvedTypePredicate == c.noTypePredicate {
 * 		return nil
 * 	}
 * 	return sig.resolvedTypePredicate
 * }
 */
export function Checker_getTypePredicateOfSignature(receiver: GoPtr<Checker>, sig: GoPtr<Signature>): GoPtr<TypePredicate> {
  if (sig!.resolvedTypePredicate === undefined) {
    if (sig!.target !== undefined) {
      const targetTypePredicate = Checker_getTypePredicateOfSignature(receiver, sig!.target);
      if (targetTypePredicate !== undefined) {
        sig!.resolvedTypePredicate = Checker_instantiateTypePredicate(receiver, targetTypePredicate, sig!.mapper);
      }
    } else if (sig!.composite !== undefined) {
      sig!.resolvedTypePredicate = Checker_getUnionOrIntersectionTypePredicate(receiver, sig!.composite!.signatures, sig!.composite!.isUnion);
    } else {
      if (sig!.declaration !== undefined) {
        const typeNode = Node_Type(sig!.declaration);
        if (typeNode !== undefined) {
          if (IsTypePredicateNode(typeNode)) {
            sig!.resolvedTypePredicate = Checker_createTypePredicateFromTypePredicateNode(receiver, typeNode, sig);
          }
        } else if (IsFunctionLikeDeclaration(sig!.declaration) && (sig!.resolvedReturnType === undefined || (sig!.resolvedReturnType!.flags & TypeFlagsBoolean) !== 0) && Checker_getParameterCount(receiver, sig) > 0) {
          sig!.resolvedTypePredicate = receiver!.noTypePredicate;
          sig!.resolvedTypePredicate = Checker_getTypePredicateFromBody(receiver, sig!.declaration);
        }
      }
    }
    if (sig!.resolvedTypePredicate === undefined) {
      sig!.resolvedTypePredicate = receiver!.noTypePredicate;
    }
  }
  if (sig!.resolvedTypePredicate === receiver!.noTypePredicate) {
    return undefined;
  }
  return sig!.resolvedTypePredicate;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getUnionOrIntersectionTypePredicate","kind":"method","status":"implemented","sigHash":"7780f32673634c61a8ee753596f37036ea49985726055339e5c02e05a5fa4d41","bodyHash":"1d60c418a487a824356d97f3bc30cb7da761fdab4f97f90b8cb2770ff014ac6e"}
 *
 * Go source:
 * func (c *Checker) getUnionOrIntersectionTypePredicate(signatures []*Signature, isUnion bool) *TypePredicate {
 * 	var last *TypePredicate
 * 	var types []*Type
 * 	for _, sig := range signatures {
 * 		pred := c.getTypePredicateOfSignature(sig)
 * 		if pred != nil {
 * 			// Constituent type predicates must all have matching kinds. We don't create composite type predicates for assertions.
 * 			if pred.kind != TypePredicateKindThis && pred.kind != TypePredicateKindIdentifier || last != nil && !c.typePredicateKindsMatch(last, pred) {
 * 				return nil
 * 			}
 * 			last = pred
 * 			types = append(types, pred.t)
 * 		} else {
 * 			// In composite union signatures we permit and ignore signatures with a return type `false`.
 * 			var returnType *Type
 * 			if isUnion {
 * 				returnType = c.getReturnTypeOfSignature(sig)
 * 			}
 * 			if returnType != c.falseType && returnType != c.regularFalseType {
 * 				return nil
 * 			}
 * 		}
 * 	}
 * 	if last == nil {
 * 		return nil
 * 	}
 * 	compositeType := c.getUnionOrIntersectionType(types, isUnion, UnionReductionLiteral)
 * 	return c.newTypePredicate(last.kind, last.parameterName, last.parameterIndex, compositeType)
 * }
 */
export function Checker_getUnionOrIntersectionTypePredicate(receiver: GoPtr<Checker>, signatures: GoSlice<GoPtr<Signature>>, isUnion: bool): GoPtr<TypePredicate> {
  let last: GoPtr<TypePredicate> = undefined;
  const types: GoPtr<Type>[] = [];
  for (const sig of (signatures ?? [])) {
    const pred = Checker_getTypePredicateOfSignature(receiver, sig);
    if (pred !== undefined) {
      if ((pred!.kind !== TypePredicateKindThis && pred!.kind !== TypePredicateKindIdentifier) || (last !== undefined && !Checker_typePredicateKindsMatch(receiver, last, pred))) {
        return undefined;
      }
      last = pred;
      types.push(pred!.t);
    } else {
      let returnType: GoPtr<Type> = undefined;
      if (isUnion) {
        returnType = Checker_getReturnTypeOfSignature(receiver, sig);
      }
      if (returnType !== receiver!.falseType && returnType !== receiver!.regularFalseType) {
        return undefined;
      }
    }
  }
  if (last === undefined) {
    return undefined;
  }
  const compositeType = Checker_getUnionOrIntersectionType(receiver, types, isUnion, UnionReductionLiteral);
  return Checker_newTypePredicate(receiver, last!.kind, last!.parameterName, last!.parameterIndex, compositeType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.typePredicateKindsMatch","kind":"method","status":"implemented","sigHash":"c637268d8fa73cc654d2d3cc01c60add4607cc1aed4d5b8d06a190214dffcb88","bodyHash":"635b486183c6035d0a3dbc015f7999ecb96725c3ce9eb51d100a36544c59dc21"}
 *
 * Go source:
 * func (c *Checker) typePredicateKindsMatch(a *TypePredicate, b *TypePredicate) bool {
 * 	return a.kind == b.kind && a.parameterIndex == b.parameterIndex
 * }
 */
export function Checker_typePredicateKindsMatch(receiver: GoPtr<Checker>, a: GoPtr<TypePredicate>, b: GoPtr<TypePredicate>): bool {
  return a!.kind === b!.kind && a!.parameterIndex === b!.parameterIndex;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.createTypePredicateFromTypePredicateNode","kind":"method","status":"implemented","sigHash":"087291ff0d969bc5ef4926b4b702362a6e17ce4a68ad6b40d511838181027c70","bodyHash":"f5b28246cd7913d7f2fc286d98b85335c772e09a875370aec1792003e9bec474"}
 *
 * Go source:
 * func (c *Checker) createTypePredicateFromTypePredicateNode(node *ast.Node, signature *Signature) *TypePredicate {
 * 	predicateNode := node.AsTypePredicateNode()
 * 	var t *Type
 * 	if predicateNode.Type != nil {
 * 		t = c.getTypeFromTypeNode(predicateNode.Type)
 * 	}
 * 	if ast.IsThisTypeNode(predicateNode.ParameterName) {
 * 		kind := core.IfElse(predicateNode.AssertsModifier != nil, TypePredicateKindAssertsThis, TypePredicateKindThis)
 * 		return c.newTypePredicate(kind, "" /*parameterName* /, 0 /*parameterIndex* /, t)
 * 	}
 * 	kind := core.IfElse(predicateNode.AssertsModifier != nil, TypePredicateKindAssertsIdentifier, TypePredicateKindIdentifier)
 * 	name := predicateNode.ParameterName.Text()
 * 	index := core.FindIndex(signature.parameters, func(p *ast.Symbol) bool { return p.Name == name })
 * 	return c.newTypePredicate(kind, name, int32(index), t)
 * }
 */
export function Checker_createTypePredicateFromTypePredicateNode(receiver: GoPtr<Checker>, node: GoPtr<Node>, signature: GoPtr<Signature>): GoPtr<TypePredicate> {
  const predicateNode = AsTypePredicateNode(node);
  let t: GoPtr<Type> = undefined;
  if (predicateNode!.Type !== undefined) {
    t = Checker_getTypeFromTypeNode(receiver, predicateNode!.Type);
  }
  if (IsThisTypeNode(predicateNode!.ParameterName)) {
    const kind = predicateNode!.AssertsModifier !== undefined ? TypePredicateKindAssertsThis : TypePredicateKindThis;
    return Checker_newTypePredicate(receiver, kind, "", 0, t);
  }
  const kind = predicateNode!.AssertsModifier !== undefined ? TypePredicateKindAssertsIdentifier : TypePredicateKindIdentifier;
  const name = Node_Text(predicateNode!.ParameterName!);
  const index = FindIndex(signature!.parameters, (p: GoPtr<Symbol>) => p!.Name === name);
  return Checker_newTypePredicate(receiver, kind, name, index, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.instantiateTypePredicate","kind":"method","status":"implemented","sigHash":"2351c3cf45df52baa1d725b0cb82cccbb521f0cff6b70ca58dbe1175c788b5f6","bodyHash":"e9a7eff80a6b35acca944806b454dd3446421c8767def14a40846f2e9d144732"}
 *
 * Go source:
 * func (c *Checker) instantiateTypePredicate(predicate *TypePredicate, mapper *TypeMapper) *TypePredicate {
 * 	t := c.instantiateType(predicate.t, mapper)
 * 	if t == predicate.t {
 * 		return predicate
 * 	}
 * 	return c.newTypePredicate(predicate.kind, predicate.parameterName, predicate.parameterIndex, t)
 * }
 */
export function Checker_instantiateTypePredicate(receiver: GoPtr<Checker>, predicate: GoPtr<TypePredicate>, mapper: GoPtr<TypeMapper>): GoPtr<TypePredicate> {
  const t = Checker_instantiateType(receiver, predicate!.t, mapper);
  if (t === predicate!.t) {
    return predicate;
  }
  return Checker_newTypePredicate(receiver, predicate!.kind, predicate!.parameterName, predicate!.parameterIndex, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.newTypePredicate","kind":"method","status":"implemented","sigHash":"7f1b0579dbeb4319d599d7a941d9e78ed9df4a4a9be672877b079ade7b82c7cc","bodyHash":"73f6b781eb6a02cacdd8671d498abddc3e3312cd82bd034d04ba090c827692a9"}
 *
 * Go source:
 * func (c *Checker) newTypePredicate(kind TypePredicateKind, parameterName string, parameterIndex int32, t *Type) *TypePredicate {
 * 	return &TypePredicate{kind: kind, parameterIndex: parameterIndex, parameterName: parameterName, t: t}
 * }
 */
export function Checker_newTypePredicate(receiver: GoPtr<Checker>, kind: TypePredicateKind, parameterName: string, parameterIndex: int, t: GoPtr<Type>): GoPtr<TypePredicate> {
  return { kind, parameterIndex, parameterName, t } as TypePredicate;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isResolvingReturnTypeOfSignature","kind":"method","status":"implemented","sigHash":"bdd03ee7515f394050d90630f4fc5b3700fc7a11a09666d7a63a429645d0477e","bodyHash":"0d1ec6277eda297b1bba1cb7519a46a65aafc54d24e09fe22b6bd6ee2a7302f9"}
 *
 * Go source:
 * func (c *Checker) isResolvingReturnTypeOfSignature(signature *Signature) bool {
 * 	if signature.composite != nil && core.Some(signature.composite.signatures, c.isResolvingReturnTypeOfSignature) {
 * 		return true
 * 	}
 * 	return signature.resolvedReturnType == nil && c.findResolutionCycleStartIndex(signature, TypeSystemPropertyNameResolvedReturnType) >= 0
 * }
 */
export function Checker_isResolvingReturnTypeOfSignature(receiver: GoPtr<Checker>, signature: GoPtr<Signature>): bool {
  if (signature!.composite !== undefined && signature!.composite!.signatures.some((s: GoPtr<Signature>) => Checker_isResolvingReturnTypeOfSignature(receiver, s))) {
    return true as bool;
  }
  return (signature!.resolvedReturnType === undefined && Checker_findResolutionCycleStartIndex(receiver, signature as unknown as GoPtr<unknown>, TypeSystemPropertyNameResolvedReturnType) >= 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.findMatchingSignatures","kind":"method","status":"implemented","sigHash":"d3d91c333af346af70942a81f3f9973e7a80c565334ef5124ddd9c36aaccc1f1","bodyHash":"61c8cd38b66e747dc5414d109db819e9d57c481b8a727a9a57319be691e4de6c"}
 *
 * Go source:
 * func (c *Checker) findMatchingSignatures(signatureLists [][]*Signature, signature *Signature, listIndex int) []*Signature {
 * 	if len(signature.typeParameters) != 0 {
 * 		// We require an exact match for generic signatures, so we only return signatures from the first
 * 		// signature list and only if they have exact matches in the other signature lists.
 * 		if listIndex > 0 {
 * 			return nil
 * 		}
 * 		for i := 1; i < len(signatureLists); i++ {
 * 			if c.findMatchingSignature(signatureLists[i], signature, false /*partialMatch* /, false /*ignoreThisTypes* /, false /*ignoreReturnTypes* /) == nil {
 * 				return nil
 * 			}
 * 		}
 * 		return []*Signature{signature}
 * 	}
 * 	var result []*Signature
 * 	for i := range signatureLists {
 * 		// Allow matching non-generic signatures to have excess parameters (as a fallback if exact parameter match is not found) and different return types.
 * 		// Prefer matching this types if possible.
 * 		var match *Signature
 * 		if i == listIndex {
 * 			match = signature
 * 		} else {
 * 			match = c.findMatchingSignature(signatureLists[i], signature, false /*partialMatch* /, false /*ignoreThisTypes* /, true /*ignoreReturnTypes* /)
 * 			if match == nil {
 * 				match = c.findMatchingSignature(signatureLists[i], signature, true /*partialMatch* /, false /*ignoreThisTypes* /, true /*ignoreReturnTypes* /)
 * 			}
 * 		}
 * 		if match == nil {
 * 			return nil
 * 		}
 * 		result = core.AppendIfUnique(result, match)
 * 	}
 * 	return result
 * }
 */
export function Checker_findMatchingSignatures(receiver: GoPtr<Checker>, signatureLists: GoSlice<GoSlice<GoPtr<Signature>>>, signature: GoPtr<Signature>, listIndex: int): GoSlice<GoPtr<Signature>> {
  if (signature!.typeParameters !== undefined && signature!.typeParameters.length !== 0) {
    if (listIndex > 0) {
      return undefined!;
    }
    for (let i = 1; i < signatureLists.length; i++) {
      if (Checker_findMatchingSignature(receiver, signatureLists[i]!, signature, false as bool, false as bool, false as bool) === undefined) {
        return undefined!;
      }
    }
    return [signature];
  }
  let result: GoSlice<GoPtr<Signature>> = undefined!;
  for (let i = 0; i < signatureLists.length; i++) {
    let match: GoPtr<Signature>;
    if (i === listIndex) {
      match = signature;
    } else {
      match = Checker_findMatchingSignature(receiver, signatureLists[i]!, signature, false as bool, false as bool, true as bool);
      if (match === undefined) {
        match = Checker_findMatchingSignature(receiver, signatureLists[i]!, signature, true as bool, false as bool, true as bool);
      }
    }
    if (match === undefined) {
      return undefined!;
    }
    result = AppendIfUnique(result ?? [], match);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.findMatchingSignature","kind":"method","status":"implemented","sigHash":"2fb508aa65f4ec598f4887c43842972a91ca9da5ec7ed5f10b92ff52fbbdb169","bodyHash":"2b8c6ac0ce57b3270ee5e26ab61db5ff526b1c429f5da51f9455258e5075aa40"}
 *
 * Go source:
 * func (c *Checker) findMatchingSignature(signatureList []*Signature, signature *Signature, partialMatch bool, ignoreThisTypes bool, ignoreReturnTypes bool) *Signature {
 * 	compareTypes := core.IfElse(partialMatch, c.compareTypesSubtypeOf, c.compareTypesIdentical)
 * 	for _, s := range signatureList {
 * 		if c.compareSignaturesIdentical(s, signature, partialMatch, ignoreThisTypes, ignoreReturnTypes, compareTypes) != 0 {
 * 			return s
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_findMatchingSignature(receiver: GoPtr<Checker>, signatureList: GoSlice<GoPtr<Signature>>, signature: GoPtr<Signature>, partialMatch: bool, ignoreThisTypes: bool, ignoreReturnTypes: bool): GoPtr<Signature> {
  const compareTypes: (s: GoPtr<Type>, t: GoPtr<Type>) => Ternary = partialMatch
    ? (s: GoPtr<Type>, t: GoPtr<Type>) => Checker_compareTypesSubtypeOf(receiver, s, t)
    : (s: GoPtr<Type>, t: GoPtr<Type>) => Checker_compareTypesIdentical(receiver, s, t);
  for (const s of (signatureList ?? [])) {
    if (Checker_compareSignaturesIdentical(receiver, s, signature, partialMatch, ignoreThisTypes, ignoreReturnTypes, compareTypes) !== 0) {
      return s;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.compareSignaturesIdentical","kind":"method","status":"implemented","sigHash":"a9b32c9ffc022cdac4f16463f11db64fc168b4c5e47e44d98764489b258fee16","bodyHash":"40098b86f119d9b0f171b2fde64498d94003908641d8b1a74062231cf59ac2d7"}
 *
 * Go source:
 * func (c *Checker) compareSignaturesIdentical(source *Signature, target *Signature, partialMatch bool, ignoreThisTypes bool, ignoreReturnTypes bool, compareTypes func(s *Type, t *Type) Ternary) Ternary {
 * 	if source == target {
 * 		return TernaryTrue
 * 	}
 * 	if !c.isMatchingSignature(source, target, partialMatch) {
 * 		return TernaryFalse
 * 	}
 * 	// Check that the two signatures have the same number of type parameters.
 * 	if len(source.typeParameters) != len(target.typeParameters) {
 * 		return TernaryFalse
 * 	}
 * 	// Check that type parameter constraints and defaults match. If they do, instantiate the source
 * 	// signature with the type parameters of the target signature and continue the comparison.
 * 	if len(target.typeParameters) != 0 {
 * 		mapper := newTypeMapper(source.typeParameters, target.typeParameters)
 * 		for i := range len(target.typeParameters) {
 * 			s := source.typeParameters[i]
 * 			t := target.typeParameters[i]
 * 			if !(s == t || compareTypes(c.instantiateType(c.getConstraintOrUnknownFromTypeParameter(s), mapper), c.getConstraintOrUnknownFromTypeParameter(t)) != TernaryFalse &&
 * 				compareTypes(c.instantiateType(c.getDefaultOrUnknownFromTypeParameter(s), mapper), c.getDefaultOrUnknownFromTypeParameter(t)) != TernaryFalse) {
 * 				return TernaryFalse
 * 			}
 * 		}
 * 		source = c.instantiateSignatureEx(source, mapper, true /*eraseTypeParameters* /)
 * 	}
 * 	result := TernaryTrue
 * 	if !ignoreThisTypes {
 * 		sourceThisType := c.getThisTypeOfSignature(source)
 * 		if sourceThisType != nil {
 * 			targetThisType := c.getThisTypeOfSignature(target)
 * 			if targetThisType != nil {
 * 				related := compareTypes(sourceThisType, targetThisType)
 * 				if related == TernaryFalse {
 * 					return TernaryFalse
 * 				}
 * 				result &= related
 * 			}
 * 		}
 * 	}
 * 	for i := range c.getParameterCount(target) {
 * 		s := c.getTypeAtPosition(source, i)
 * 		t := c.getTypeAtPosition(target, i)
 * 		related := compareTypes(t, s)
 * 		if related == TernaryFalse {
 * 			return TernaryFalse
 * 		}
 * 		result &= related
 * 	}
 * 	if !ignoreReturnTypes {
 * 		sourceTypePredicate := c.getTypePredicateOfSignature(source)
 * 		targetTypePredicate := c.getTypePredicateOfSignature(target)
 * 		if sourceTypePredicate != nil || targetTypePredicate != nil {
 * 			result &= c.compareTypePredicatesIdentical(sourceTypePredicate, targetTypePredicate, compareTypes)
 * 		} else {
 * 			result &= compareTypes(c.getReturnTypeOfSignature(source), c.getReturnTypeOfSignature(target))
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Checker_compareSignaturesIdentical(receiver: GoPtr<Checker>, source: GoPtr<Signature>, target: GoPtr<Signature>, partialMatch: bool, ignoreThisTypes: bool, ignoreReturnTypes: bool, compareTypes: (s: GoPtr<Type>, t: GoPtr<Type>) => Ternary): Ternary {
  if (source === target) {
    return TernaryTrue;
  }
  if (!Checker_isMatchingSignature(receiver, source, target, partialMatch)) {
    return TernaryFalse;
  }
  const srcTpLen = source!.typeParameters ? source!.typeParameters.length : 0;
  const tgtTpLen = target!.typeParameters ? target!.typeParameters.length : 0;
  if (srcTpLen !== tgtTpLen) {
    return TernaryFalse;
  }
  let src = source;
  if (tgtTpLen !== 0) {
    const mapper = newTypeMapper(source!.typeParameters, target!.typeParameters);
    for (let i = 0; i < tgtTpLen; i++) {
      const s = source!.typeParameters![i];
      const t = target!.typeParameters![i];
      if (!(s === t ||
        compareTypes(Checker_instantiateType(receiver, Checker_getConstraintOrUnknownFromTypeParameter(receiver, s), mapper), Checker_getConstraintOrUnknownFromTypeParameter(receiver, t)) !== TernaryFalse &&
        compareTypes(Checker_instantiateType(receiver, Checker_getDefaultOrUnknownFromTypeParameter(receiver, s), mapper), Checker_getDefaultOrUnknownFromTypeParameter(receiver, t)) !== TernaryFalse)) {
        return TernaryFalse;
      }
    }
    src = Checker_instantiateSignatureEx(receiver, source, mapper, true as bool);
  }
  let result: Ternary = TernaryTrue;
  if (!ignoreThisTypes) {
    const sourceThisType = Checker_getThisTypeOfSignature(receiver, src);
    if (sourceThisType !== undefined) {
      const targetThisType = Checker_getThisTypeOfSignature(receiver, target);
      if (targetThisType !== undefined) {
        const related = compareTypes(sourceThisType, targetThisType);
        if (related === TernaryFalse) {
          return TernaryFalse;
        }
        result = (result & related) as Ternary;
      }
    }
  }
  const paramCount = Checker_getParameterCount(receiver, target);
  for (let i = 0; i < paramCount; i++) {
    const s = Checker_getTypeAtPosition(receiver, src, i);
    const t = Checker_getTypeAtPosition(receiver, target, i);
    const related = compareTypes(t, s);
    if (related === TernaryFalse) {
      return TernaryFalse;
    }
    result = (result & related) as Ternary;
  }
  if (!ignoreReturnTypes) {
    const sourceTypePredicate = Checker_getTypePredicateOfSignature(receiver, src);
    const targetTypePredicate = Checker_getTypePredicateOfSignature(receiver, target);
    if (sourceTypePredicate !== undefined || targetTypePredicate !== undefined) {
      result = (result & Checker_compareTypePredicatesIdentical(receiver, sourceTypePredicate, targetTypePredicate, compareTypes)) as Ternary;
    } else {
      result = (result & compareTypes(Checker_getReturnTypeOfSignature(receiver, src), Checker_getReturnTypeOfSignature(receiver, target))) as Ternary;
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isMatchingSignature","kind":"method","status":"implemented","sigHash":"8838309eb329a204fb6e4a123561b619f06e932363210e6755ae6fb5eda7f221","bodyHash":"ddfb55150abf8f259299b582cbd63d4996a970c366905a61431b7466f21fef7b"}
 *
 * Go source:
 * func (c *Checker) isMatchingSignature(source *Signature, target *Signature, partialMatch bool) bool {
 * 	sourceParameterCount := c.getParameterCount(source)
 * 	targetParameterCount := c.getParameterCount(target)
 * 	sourceMinArgumentCount := c.getMinArgumentCount(source)
 * 	targetMinArgumentCount := c.getMinArgumentCount(target)
 * 	sourceHasRestParameter := c.hasEffectiveRestParameter(source)
 * 	targetHasRestParameter := c.hasEffectiveRestParameter(target)
 * 	// A source signature matches a target signature if the two signatures have the same number of required,
 * 	// optional, and rest parameters.
 * 	if sourceParameterCount == targetParameterCount && sourceMinArgumentCount == targetMinArgumentCount && sourceHasRestParameter == targetHasRestParameter {
 * 		return true
 * 	}
 * 	// A source signature partially matches a target signature if the target signature has no fewer required
 * 	// parameters
 * 	if partialMatch && sourceMinArgumentCount <= targetMinArgumentCount {
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Checker_isMatchingSignature(receiver: GoPtr<Checker>, source: GoPtr<Signature>, target: GoPtr<Signature>, partialMatch: bool): bool {
  const sourceParameterCount = Checker_getParameterCount(receiver, source);
  const targetParameterCount = Checker_getParameterCount(receiver, target);
  const sourceMinArgumentCount = Checker_getMinArgumentCount(receiver, source);
  const targetMinArgumentCount = Checker_getMinArgumentCount(receiver, target);
  const sourceHasRest = Checker_hasEffectiveRestParameter(receiver, source);
  const targetHasRest = Checker_hasEffectiveRestParameter(receiver, target);
  if (sourceParameterCount === targetParameterCount && sourceMinArgumentCount === targetMinArgumentCount && sourceHasRest === targetHasRest) {
    return true as bool;
  }
  if (partialMatch && sourceMinArgumentCount <= targetMinArgumentCount) {
    return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.compareTypeParametersIdentical","kind":"method","status":"implemented","sigHash":"28f5260617085ffd33d37d6da9d900a31ce2c5f412004ed20992190e05d317bb","bodyHash":"ba2e5a89ec088e4f4680d13293c0ca10a97aa2d25da1ce8949879350190a1b9d"}
 *
 * Go source:
 * func (c *Checker) compareTypeParametersIdentical(sourceParams []*Type, targetParams []*Type) bool {
 * 	if len(sourceParams) != len(targetParams) {
 * 		return false
 * 	}
 * 	mapper := newTypeMapper(targetParams, sourceParams)
 * 	for i := range sourceParams {
 * 		source := sourceParams[i]
 * 		target := targetParams[i]
 * 		if source == target {
 * 			continue
 * 		}
 * 		// We instantiate the target type parameter constraints into the source types so we can recognize `<T, U extends T>` as the same as `<A, B extends A>`
 * 		if !c.isTypeIdenticalTo(core.OrElse(c.getConstraintFromTypeParameter(source), c.unknownType), c.instantiateType(core.OrElse(c.getConstraintFromTypeParameter(target), c.unknownType), mapper)) {
 * 			return false
 * 		}
 * 		// We don't compare defaults - we just use the type parameter defaults from the first signature that seems to match.
 * 		// It might make sense to combine these defaults in the future, but doing so intelligently requires knowing
 * 		// if the parameter is used covariantly or contravariantly (so we intersect if it's used like a parameter or union if used like a return type)
 * 		// and, since it's just an inference _default_, just picking one arbitrarily works OK.
 * 	}
 * 	return true
 * }
 */
export function Checker_compareTypeParametersIdentical(receiver: GoPtr<Checker>, sourceParams: GoSlice<GoPtr<Type>>, targetParams: GoSlice<GoPtr<Type>>): bool {
  const srcLen = sourceParams ? sourceParams.length : 0;
  const tgtLen = targetParams ? targetParams.length : 0;
  if (srcLen !== tgtLen) {
    return false as bool;
  }
  const mapper = newTypeMapper(targetParams, sourceParams);
  for (let i = 0; i < srcLen; i++) {
    const source = sourceParams![i];
    const target = targetParams![i];
    if (source === target) {
      continue;
    }
    const srcConstraint = Checker_getConstraintFromTypeParameter(receiver, source) ?? receiver!.unknownType;
    const tgtConstraint = Checker_getConstraintFromTypeParameter(receiver, target) ?? receiver!.unknownType;
    if (!Checker_isTypeIdenticalTo(receiver, srcConstraint, Checker_instantiateType(receiver, tgtConstraint, mapper))) {
      return false as bool;
    }
  }
  return true as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.compareTypePredicatesIdentical","kind":"method","status":"implemented","sigHash":"dad5eb3937d200c54ec1f443b12453b90a4ae74ae4760b3d78c516d6dbeda152","bodyHash":"ef38f77100c19de320488bd38d40b06ea2a5003f50409d191dae8e9015f75c9d"}
 *
 * Go source:
 * func (c *Checker) compareTypePredicatesIdentical(source *TypePredicate, target *TypePredicate, compareTypes func(s *Type, t *Type) Ternary) Ternary {
 * 	switch {
 * 	case source == nil || target == nil || !c.typePredicateKindsMatch(source, target):
 * 		return TernaryFalse
 * 	case source.t == target.t:
 * 		return TernaryTrue
 * 	case source.t != nil && target.t != nil:
 * 		return compareTypes(source.t, target.t)
 * 	}
 * 	return TernaryFalse
 * }
 */
export function Checker_compareTypePredicatesIdentical(receiver: GoPtr<Checker>, source: GoPtr<TypePredicate>, target: GoPtr<TypePredicate>, compareTypes: (s: GoPtr<Type>, t: GoPtr<Type>) => Ternary): Ternary {
  if (source === undefined || target === undefined || !Checker_typePredicateKindsMatch(receiver, source, target)) {
    return TernaryFalse;
  }
  if (source!.t === target!.t) {
    return TernaryTrue;
  }
  if (source!.t !== undefined && target!.t !== undefined) {
    return compareTypes(source!.t, target!.t);
  }
  return TernaryFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getEffectiveConstraintOfIntersection","kind":"method","status":"implemented","sigHash":"f408251576705c4503639624d7d26e1202c71b8da92a267b5e8b7f3e49afb598","bodyHash":"9c17da9bffc1e768d3683c3554c589085347eb8841a8a3304058b2033f3d1c40"}
 *
 * Go source:
 * func (c *Checker) getEffectiveConstraintOfIntersection(types []*Type, targetIsUnion bool) *Type {
 * 	var constraints []*Type
 * 	hasDisjointDomainType := false
 * 	for _, t := range types {
 * 		if t.flags&TypeFlagsInstantiable != 0 {
 * 			// We keep following constraints as long as we have an instantiable type that is known
 * 			// not to be circular or infinite (hence we stop on index access types).
 * 			constraint := c.getConstraintOfType(t)
 * 			for constraint != nil && constraint.flags&(TypeFlagsTypeParameter|TypeFlagsIndex|TypeFlagsConditional) != 0 {
 * 				constraint = c.getConstraintOfType(constraint)
 * 			}
 * 			if constraint != nil {
 * 				constraints = append(constraints, constraint)
 * 				if targetIsUnion {
 * 					constraints = append(constraints, t)
 * 				}
 * 			}
 * 		} else if t.flags&TypeFlagsDisjointDomains != 0 || c.IsEmptyAnonymousObjectType(t) {
 * 			hasDisjointDomainType = true
 * 		}
 * 	}
 * 	// If the target is a union type or if we are intersecting with types belonging to one of the
 * 	// disjoint domains, we may end up producing a constraint that hasn't been examined before.
 * 	if constraints != nil && (targetIsUnion || hasDisjointDomainType) {
 * 		if hasDisjointDomainType {
 * 			// We add any types belong to one of the disjoint domains because they might cause the final
 * 			// intersection operation to reduce the union constraints.
 * 			for _, t := range types {
 * 				if t.flags&TypeFlagsDisjointDomains != 0 || c.IsEmptyAnonymousObjectType(t) {
 * 					constraints = append(constraints, t)
 * 				}
 * 			}
 * 		}
 * 		// The source types were normalized; ensure the result is normalized too.
 * 		return c.getNormalizedType(c.getIntersectionTypeEx(constraints, IntersectionFlagsNoConstraintReduction, nil), false /*writing* /)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getEffectiveConstraintOfIntersection(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>, targetIsUnion: bool): GoPtr<Type> {
  let constraints: GoSlice<GoPtr<Type>> = undefined!;
  let hasDisjointDomainType = false;
  for (const t of types ?? []) {
    if ((t!.flags & TypeFlagsInstantiable) !== 0) {
      let constraint = Checker_getConstraintOfType(receiver, t);
      while (constraint !== undefined && (constraint!.flags & (TypeFlagsTypeParameter | TypeFlagsIndex | TypeFlagsConditional)) !== 0) {
        constraint = Checker_getConstraintOfType(receiver, constraint);
      }
      if (constraint !== undefined) {
        constraints = constraints ? [...constraints, constraint] : [constraint];
        if (targetIsUnion) {
          constraints = [...constraints, t];
        }
      }
    } else if ((t!.flags & TypeFlagsDisjointDomains) !== 0 || Checker_IsEmptyAnonymousObjectType(receiver, t)) {
      hasDisjointDomainType = true;
    }
  }
  if (constraints !== undefined && (targetIsUnion || hasDisjointDomainType)) {
    if (hasDisjointDomainType) {
      for (const t of types ?? []) {
        if ((t!.flags & TypeFlagsDisjointDomains) !== 0 || Checker_IsEmptyAnonymousObjectType(receiver, t)) {
          constraints = [...constraints, t];
        }
      }
    }
    return Checker_getNormalizedType(receiver, Checker_getIntersectionTypeEx(receiver, constraints, IntersectionFlagsNoConstraintReduction, undefined), false as bool);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.templateLiteralTypesDefinitelyUnrelated","kind":"method","status":"implemented","sigHash":"f19a9ae1057eb3b4db0fe0fc2d89038902ff0e521ab6293feb442aec614188f6","bodyHash":"b221d509b4ea6834092386335738a77d92b7e4cb772a4b6ab44cdf339a7130ae"}
 *
 * Go source:
 * func (c *Checker) templateLiteralTypesDefinitelyUnrelated(source *TemplateLiteralType, target *TemplateLiteralType) bool {
 * 	// Two template literal types with differences in their starting or ending text spans are definitely unrelated.
 * 	sourceStart := source.texts[0]
 * 	targetStart := target.texts[0]
 * 	sourceEnd := source.texts[len(source.texts)-1]
 * 	targetEnd := target.texts[len(target.texts)-1]
 * 	startLen := min(len(sourceStart), len(targetStart))
 * 	endLen := min(len(sourceEnd), len(targetEnd))
 * 	return sourceStart[:startLen] != targetStart[:startLen] || sourceEnd[len(sourceEnd)-endLen:] != targetEnd[len(targetEnd)-endLen:]
 * }
 */
export function Checker_templateLiteralTypesDefinitelyUnrelated(receiver: GoPtr<Checker>, source: GoPtr<TemplateLiteralType>, target: GoPtr<TemplateLiteralType>): bool {
  const sourceStart = source!.texts[0]!;
  const targetStart = target!.texts[0]!;
  const sourceEnd = source!.texts[source!.texts.length - 1]!;
  const targetEnd = target!.texts[target!.texts.length - 1]!;
  const startLen = globalThis.Math.min(sourceStart.length, targetStart.length);
  const endLen = globalThis.Math.min(sourceEnd.length, targetEnd.length);
  return sourceStart.slice(0, startLen) !== targetStart.slice(0, startLen) ||
    sourceEnd.slice(sourceEnd.length - endLen) !== targetEnd.slice(targetEnd.length - endLen);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isTypeMatchedByTemplateLiteralType","kind":"method","status":"implemented","sigHash":"ddcb198e888ce44771329524c63b15b8ec37e1b36765293cd5f424cc54f2bb97","bodyHash":"40c75453aadb6fd5a6599f5b3245a1f012ea9164ed05d9894940f890365dbe3a"}
 *
 * Go source:
 * func (c *Checker) isTypeMatchedByTemplateLiteralType(source *Type, target *TemplateLiteralType, compareTypes TypeComparer) bool {
 * 	inferences := c.inferTypesFromTemplateLiteralType(source, target)
 * 	if inferences != nil {
 * 		for i, inference := range inferences {
 * 			if !c.isValidTypeForTemplateLiteralPlaceholder(inference, target.types[i], compareTypes) {
 * 				return false
 * 			}
 * 		}
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function Checker_isTypeMatchedByTemplateLiteralType(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<TemplateLiteralType>, compareTypes: TypeComparer): bool {
  const inferences = Checker_inferTypesFromTemplateLiteralType(receiver, source, target);
  if (inferences !== undefined) {
    for (let i = 0; i < inferences.length; i++) {
      if (!Checker_isValidTypeForTemplateLiteralPlaceholder(receiver, inferences[i]!, target!.types[i]!, compareTypes)) {
        return false as bool;
      }
    }
    return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.inferTypesFromTemplateLiteralType","kind":"method","status":"implemented","sigHash":"965d18ddd76a1ee04fbd4bfad399a1074d88d1e2dfb4e91d055f5a8fdd523c53","bodyHash":"7e72b718f7b107e02d043d067decf74af70da15d0f128a0ad12e6d7d8ebb7809"}
 *
 * Go source:
 * func (c *Checker) inferTypesFromTemplateLiteralType(source *Type, target *TemplateLiteralType) []*Type {
 * 	switch {
 * 	case source.flags&TypeFlagsStringLiteral != 0:
 * 		return c.inferFromLiteralPartsToTemplateLiteral([]string{getStringLiteralValue(source)}, nil, target)
 * 	case source.flags&TypeFlagsTemplateLiteral != 0:
 * 		if slices.Equal(source.AsTemplateLiteralType().texts, target.texts) {
 * 			return core.MapIndex(source.AsTemplateLiteralType().types, func(s *Type, i int) *Type {
 * 				if c.isTypeAssignableTo(c.getBaseConstraintOrType(s), c.getBaseConstraintOrType(target.types[i])) {
 * 					return s
 * 				}
 * 				return c.getStringLikeTypeForType(s)
 * 			})
 * 		}
 * 		return c.inferFromLiteralPartsToTemplateLiteral(source.AsTemplateLiteralType().texts, source.AsTemplateLiteralType().types, target)
 * 	default:
 * 		return nil
 * 	}
 * }
 */
export function Checker_inferTypesFromTemplateLiteralType(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<TemplateLiteralType>): GoSlice<GoPtr<Type>> | undefined {
  if ((source!.flags & TypeFlagsStringLiteral) !== 0) {
    return Checker_inferFromLiteralPartsToTemplateLiteral(receiver, [getStringLiteralValue(source)], [], target);
  }
  if ((source!.flags & TypeFlagsTemplateLiteral) !== 0) {
    const srcTexts = Type_AsTemplateLiteralType(source)!.texts;
    const srcTypes = Type_AsTemplateLiteralType(source)!.types;
    const tgtTexts = target!.texts;
    const tgtLen = srcTexts.length === tgtTexts.length;
    const textEqual = tgtLen && srcTexts.every((v, i) => v === tgtTexts[i]);
    if (textEqual) {
      return MapIndex(srcTypes, (s: GoPtr<Type>, i: int) => {
        if (Checker_isTypeAssignableTo(receiver, Checker_getBaseConstraintOrType(receiver, s), Checker_getBaseConstraintOrType(receiver, target!.types[i]!))) {
          return s;
        }
        return Checker_getStringLikeTypeForType(receiver, s);
      });
    }
    return Checker_inferFromLiteralPartsToTemplateLiteral(receiver, srcTexts, srcTypes, target);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.inferFromLiteralPartsToTemplateLiteral","kind":"method","status":"implemented","sigHash":"f775ef3f0af4f8266224b735b052ed3eb5820efac6f50f920cd063ec4593524e","bodyHash":"586b456bb34c0f39016f29792030e6296c40e4526fb71f9afc40d5fed37ff4f8"}
 *
 * Go source:
 * func (c *Checker) inferFromLiteralPartsToTemplateLiteral(sourceTexts []string, sourceTypes []*Type, target *TemplateLiteralType) []*Type {
 * 	lastSourceIndex := len(sourceTexts) - 1
 * 	sourceStartText := sourceTexts[0]
 * 	sourceEndText := sourceTexts[lastSourceIndex]
 * 	targetTexts := target.texts
 * 	lastTargetIndex := len(targetTexts) - 1
 * 	targetStartText := targetTexts[0]
 * 	targetEndText := targetTexts[lastTargetIndex]
 * 	if lastSourceIndex == 0 && len(sourceStartText) < len(targetStartText)+len(targetEndText) || !strings.HasPrefix(sourceStartText, targetStartText) || !strings.HasSuffix(sourceEndText, targetEndText) {
 * 		return nil
 * 	}
 * 	remainingEndText := sourceEndText[:len(sourceEndText)-len(targetEndText)]
 * 	seg := 0
 * 	pos := len(targetStartText)
 * 	var matches []*Type
 * 	getSourceText := func(index int) string {
 * 		if index < lastSourceIndex {
 * 			return sourceTexts[index]
 * 		}
 * 		return remainingEndText
 * 	}
 * 	addMatch := func(s int, p int) {
 * 		var matchType *Type
 * 		if s == seg {
 * 			matchType = c.getStringLiteralType(getSourceText(s)[pos:p])
 * 		} else {
 * 			matchTexts := make([]string, s-seg+1)
 * 			matchTexts[0] = sourceTexts[seg][pos:]
 * 			copy(matchTexts[1:], sourceTexts[seg+1:s])
 * 			matchTexts[s-seg] = getSourceText(s)[:p]
 * 			matchType = c.getTemplateLiteralType(matchTexts, sourceTypes[seg:s])
 * 		}
 * 		matches = append(matches, matchType)
 * 		seg = s
 * 		pos = p
 * 	}
 * 	for i := 1; i < lastTargetIndex; i++ {
 * 		delim := targetTexts[i]
 * 		if len(delim) > 0 {
 * 			s := seg
 * 			p := pos
 * 			for {
 * 				d := strings.Index(getSourceText(s)[p:], delim)
 * 				if d >= 0 {
 * 					p += d
 * 					break
 * 				}
 * 				s++
 * 				if s == len(sourceTexts) {
 * 					return nil
 * 				}
 * 				p = 0
 * 			}
 * 			addMatch(s, p)
 * 			pos += len(delim)
 * 		} else if sourceText := getSourceText(seg); pos < len(sourceText) {
 * 			_, size := utf8.DecodeRuneInString(sourceText[pos:])
 * 			addMatch(seg, pos+size)
 * 		} else if seg < lastSourceIndex {
 * 			addMatch(seg+1, 0)
 * 		} else {
 * 			return nil
 * 		}
 * 	}
 * 	addMatch(lastSourceIndex, len(getSourceText(lastSourceIndex)))
 * 	return matches
 * }
 */
export function Checker_inferFromLiteralPartsToTemplateLiteral(receiver: GoPtr<Checker>, sourceTexts: GoSlice<string>, sourceTypes: GoSlice<GoPtr<Type>>, target: GoPtr<TemplateLiteralType>): GoSlice<GoPtr<Type>> | undefined {
  const lastSourceIndex = sourceTexts.length - 1;
  const sourceStartText = sourceTexts[0]!;
  const sourceEndText = sourceTexts[lastSourceIndex]!;
  const targetTexts = target!.texts;
  const lastTargetIndex = targetTexts.length - 1;
  const targetStartText = targetTexts[0]!;
  const targetEndText = targetTexts[lastTargetIndex]!;
  if (lastSourceIndex === 0 && sourceStartText.length < targetStartText.length + targetEndText.length || !sourceStartText.startsWith(targetStartText) || !sourceEndText.endsWith(targetEndText)) {
    return undefined;
  }
  const remainingEndText = sourceEndText.slice(0, sourceEndText.length - targetEndText.length);
  let seg = 0;
  let pos = targetStartText.length;
  let matches: GoSlice<GoPtr<Type>> = [];
  const getSourceText = (index: int): string => {
    if (index < lastSourceIndex) {
      return sourceTexts[index]!;
    }
    return remainingEndText;
  };
  const addMatch = (s: int, p: int): void => {
    let matchType: GoPtr<Type>;
    if (s === seg) {
      matchType = Checker_getStringLiteralType(receiver, getSourceText(s).slice(pos, p));
    } else {
      const matchTexts: string[] = new Array(s - seg + 1);
      matchTexts[0] = sourceTexts[seg]!.slice(pos);
      for (let k = 1; k < s - seg; k++) {
        matchTexts[k] = sourceTexts[seg + k]!;
      }
      matchTexts[s - seg] = getSourceText(s).slice(0, p);
      matchType = Checker_getTemplateLiteralType(receiver, matchTexts, (sourceTypes ?? []).slice(seg, s));
    }
    matches = [...matches, matchType];
    seg = s;
    pos = p;
  };
  for (let i = 1; i < lastTargetIndex; i++) {
    const delim = targetTexts[i]!;
    if (delim.length > 0) {
      let s = seg;
      let p = pos;
      for (;;) {
        const d = getSourceText(s).indexOf(delim, p);
        if (d >= 0) {
          p = d;
          break;
        }
        s++;
        if (s === sourceTexts.length) {
          return undefined;
        }
        p = 0;
      }
      addMatch(s, p);
      pos += delim.length;
    } else {
      const sourceText = getSourceText(seg);
      if (pos < sourceText.length) {
        const cp = sourceText.codePointAt(pos)!;
        const size = cp > 0xFFFF ? 2 : 1;
        addMatch(seg, pos + size);
      } else if (seg < lastSourceIndex) {
        addMatch(seg + 1, 0);
      } else {
        return undefined;
      }
    }
  }
  addMatch(lastSourceIndex, getSourceText(lastSourceIndex).length);
  return matches;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getStringLikeTypeForType","kind":"method","status":"implemented","sigHash":"8b318d8509954270f853fbcf0eecfaa47730c62dbd843074ac792bd748e1d34b","bodyHash":"b287b13cc032a0cab9a60c861b29e7e3fbb8e4bc2d293c6ce7587afcac447546"}
 *
 * Go source:
 * func (c *Checker) getStringLikeTypeForType(t *Type) *Type {
 * 	if t.flags&(TypeFlagsAny|TypeFlagsStringLike) != 0 {
 * 		return t
 * 	}
 * 	return c.getTemplateLiteralType([]string{"", ""}, []*Type{t})
 * }
 */
export function Checker_getStringLikeTypeForType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  if ((t!.flags & (TypeFlagsAny | TypeFlagsStringLike)) !== 0) {
    return t;
  }
  return Checker_getTemplateLiteralType(receiver, ["", ""], [t]);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isValidTypeForTemplateLiteralPlaceholder","kind":"method","status":"implemented","sigHash":"c4e6edb9b369db09d6996d9fab3a60e08c1dc27808608fff7b11b9f27c3fc72f","bodyHash":"cda8bee71fbbd3133284b4dc49af4d2088d415c3ec94d254e191d588bce322c8"}
 *
 * Go source:
 * func (c *Checker) isValidTypeForTemplateLiteralPlaceholder(source *Type, target *Type, compareTypes TypeComparer) bool {
 * 	switch {
 * 	case target.flags&TypeFlagsIntersection != 0:
 * 		return core.Every(target.Types(), func(t *Type) bool {
 * 			return t == c.emptyTypeLiteralType || c.isValidTypeForTemplateLiteralPlaceholder(source, t, compareTypes)
 * 		})
 * 	case target.flags&TypeFlagsString != 0 || compareTypes(source, target, false) != TernaryFalse:
 * 		return true
 * 	case source.flags&TypeFlagsStringLiteral != 0:
 * 		value := getStringLiteralValue(source)
 * 		return target.flags&TypeFlagsNumber != 0 && isValidNumberString(value, false /*roundTripOnly* /) ||
 * 			target.flags&TypeFlagsBigInt != 0 && isValidBigIntString(value, false /*roundTripOnly* /) ||
 * 			target.flags&(TypeFlagsBooleanLiteral|TypeFlagsNullable) != 0 && value == target.AsIntrinsicType().intrinsicName ||
 * 			target.flags&TypeFlagsStringMapping != 0 && c.isMemberOfStringMapping(source, target) ||
 * 			target.flags&TypeFlagsTemplateLiteral != 0 && c.isTypeMatchedByTemplateLiteralType(source, target.AsTemplateLiteralType(), compareTypes)
 * 	case source.flags&TypeFlagsTemplateLiteral != 0:
 * 		texts := source.AsTemplateLiteralType().texts
 * 		return len(texts) == 2 && texts[0] == "" && texts[1] == "" && compareTypes(source.AsTemplateLiteralType().types[0], target, false) != TernaryFalse
 * 	}
 * 	return false
 * }
 */
export function Checker_isValidTypeForTemplateLiteralPlaceholder(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, compareTypes: TypeComparer): bool {
  if ((target!.flags & TypeFlagsIntersection) !== 0) {
    return Every(Type_Types(target), (t: GoPtr<Type>) => t === receiver!.emptyTypeLiteralType || Checker_isValidTypeForTemplateLiteralPlaceholder(receiver, source, t, compareTypes));
  }
  if ((target!.flags & TypeFlagsString) !== 0 || compareTypes(source, target, false as bool) !== TernaryFalse) {
    return true as bool;
  }
  if ((source!.flags & TypeFlagsStringLiteral) !== 0) {
    const value = getStringLiteralValue(source);
    return (
      ((target!.flags & TypeFlagsNumber) !== 0 && isValidNumberString(value, false as bool)) ||
      ((target!.flags & TypeFlagsBigInt) !== 0 && isValidBigIntString(value, false as bool)) ||
      ((target!.flags & (TypeFlagsBooleanLiteral | TypeFlagsNullable)) !== 0 && value === Type_AsIntrinsicType(target)!.intrinsicName) ||
      ((target!.flags & TypeFlagsStringMapping) !== 0 && Checker_isMemberOfStringMapping(receiver, source, target)) ||
      ((target!.flags & TypeFlagsTemplateLiteral) !== 0 && Checker_isTypeMatchedByTemplateLiteralType(receiver, source, Type_AsTemplateLiteralType(target)!, compareTypes))
    ) as bool;
  }
  if ((source!.flags & TypeFlagsTemplateLiteral) !== 0) {
    const texts = Type_AsTemplateLiteralType(source)!.texts;
    return (texts.length === 2 && texts[0]! === "" && texts[1]! === "" && compareTypes(Type_AsTemplateLiteralType(source)!.types[0]!, target, false as bool) !== TernaryFalse) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isMemberOfStringMapping","kind":"method","status":"implemented","sigHash":"9e91f8f4cff2686f0872fc70316e96f321d20e64f814e0e71505784a07f5a9d3","bodyHash":"f9321da58bda5ff0f0f6435031524c747f1049c8dc00c47ade5061e7a66bd9f7"}
 *
 * Go source:
 * func (c *Checker) isMemberOfStringMapping(source *Type, target *Type) bool {
 * 	switch {
 * 	case target.flags&TypeFlagsAny != 0:
 * 		return true
 * 	case target.flags&(TypeFlagsString|TypeFlagsTemplateLiteral) != 0:
 * 		return c.isTypeAssignableTo(source, target)
 * 	case target.flags&TypeFlagsStringMapping != 0:
 * 		// We need to see whether applying the same mappings of the target
 * 		// onto the source would produce an identical type *and* that
 * 		// it's compatible with the inner-most non-string-mapped type.
 * 		//
 * 		// The intuition here is that if same mappings don't affect the source at all,
 * 		// and the source is compatible with the unmapped target, then they must
 * 		// still reside in the same domain.
 * 		mapped, inner := c.applyTargetStringMappingToSource(source, target)
 * 		return mapped == source && c.isMemberOfStringMapping(source, inner)
 * 	}
 * 	return false
 * }
 */
export function Checker_isMemberOfStringMapping(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  if ((target!.flags & TypeFlagsAny) !== 0) {
    return true as bool;
  }
  if ((target!.flags & (TypeFlagsString | TypeFlagsTemplateLiteral)) !== 0) {
    return Checker_isTypeAssignableTo(receiver, source, target);
  }
  if ((target!.flags & TypeFlagsStringMapping) !== 0) {
    const [mapped, inner] = Checker_applyTargetStringMappingToSource(receiver, source, target);
    return (mapped === source && Checker_isMemberOfStringMapping(receiver, source, inner)) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.applyTargetStringMappingToSource","kind":"method","status":"implemented","sigHash":"bd6987e81c8d10cfea550de26170367b8b427ef456dadc02f4d8c99f7333b0ac","bodyHash":"475eb0bb8725e8625be5e19e1969fb722a58d540fe78bf0dc4533c5ef16f0c93"}
 *
 * Go source:
 * func (c *Checker) applyTargetStringMappingToSource(source *Type, target *Type) (*Type, *Type) {
 * 	inner := target.AsStringMappingType().target
 * 	if inner.flags&TypeFlagsStringMapping != 0 {
 * 		source, inner = c.applyTargetStringMappingToSource(source, inner)
 * 	}
 * 	return c.getStringMappingType(target.symbol, source), inner
 * }
 */
export function Checker_applyTargetStringMappingToSource(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): [GoPtr<Type>, GoPtr<Type>] {
  let inner = Type_AsStringMappingType(target)!.target;
  if ((inner!.flags & TypeFlagsStringMapping) !== 0) {
    [source, inner] = Checker_applyTargetStringMappingToSource(receiver, source, inner);
  }
  return [Checker_getStringMappingType(receiver, target!["symbol"], source), inner];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::visibilityToString","kind":"func","status":"implemented","sigHash":"451f97a9f709ee079a076f104efe3cf90253250b7564080d9c51e93f12ec263d","bodyHash":"0d084bc350602e87841a06aa10e767f673e21bfec95f0798be80f8f98721e359"}
 *
 * Go source:
 * func visibilityToString(flags ast.ModifierFlags) string {
 * 	if flags == ast.ModifierFlagsPrivate {
 * 		return "private"
 * 	}
 * 	if flags == ast.ModifierFlagsProtected {
 * 		return "protected"
 * 	}
 * 	return "public"
 * }
 */
export function visibilityToString(flags: ModifierFlags): string {
  if (flags === ModifierFlagsPrivate) {
    return "private";
  }
  if (flags === ModifierFlagsProtected) {
    return "protected";
  }
  return "public";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::errorState","kind":"type","status":"implemented","sigHash":"4379c7bc299a46da367c625bce4187d88f96e1aa082d4a7d892f0abbc76485e0","bodyHash":"b521efc3d84af89ae6c24a7d154ab8d025992372925012a0a36993c63fb81312"}
 *
 * Go source:
 * errorState struct {
 * 	errorChain  *ErrorChain
 * 	relatedInfo []*ast.Diagnostic
 * }
 */
export interface errorState {
  errorChain: GoPtr<ErrorChain>;
  relatedInfo: GoSlice<GoPtr<Diagnostic>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::ErrorChain","kind":"type","status":"implemented","sigHash":"0d9e7ad8d068c761cc453cf02c1e330bf9e4a0562f2280eac3d9e3a18e5681df","bodyHash":"6efe48b63df72de047d26ca49255174c569619c007bd2fa7fd7af178abe1d856"}
 *
 * Go source:
 * ErrorChain struct {
 * 	next    *ErrorChain
 * 	message *diagnostics.Message
 * 	args    []any
 * }
 */
export interface ErrorChain {
  next: GoPtr<ErrorChain>;
  message: GoPtr<Message>;
  args: GoSlice<unknown>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::type::Relater","kind":"type","status":"implemented","sigHash":"28c24be7b5535d6b0273da32a7e1567c4db694c2a01570e3685d9aae5a17069d","bodyHash":"978c188a75cef17587cb47716caa20d6795fba874d4869243f3f88e246ff604f"}
 *
 * Go source:
 * Relater struct {
 * 	c              *Checker
 * 	relation       *Relation
 * 	errorNode      *ast.Node
 * 	errorChain     *ErrorChain
 * 	relatedInfo    []*ast.Diagnostic
 * 	maybeKeys      []CacheHashKey
 * 	maybeKeysSet   collections.Set[CacheHashKey]
 * 	sourceStack    []*Type
 * 	targetStack    []*Type
 * 	maybeCount     int
 * 	sourceDepth    int
 * 	targetDepth    int
 * 	expandingFlags ExpandingFlags
 * 	overflow       bool
 * 	relationCount  int
 * 	next           *Relater
 * }
 */
export interface Relater {
  c: GoPtr<Checker>;
  relation: GoPtr<Relation>;
  errorNode: GoPtr<Node>;
  errorChain: GoPtr<ErrorChain>;
  relatedInfo: GoSlice<GoPtr<Diagnostic>>;
  maybeKeys: GoSlice<CacheHashKey>;
  maybeKeysSet: Set;
  sourceStack: GoSlice<GoPtr<Type>>;
  targetStack: GoSlice<GoPtr<Type>>;
  maybeCount: int;
  sourceDepth: int;
  targetDepth: int;
  expandingFlags: ExpandingFlags;
  overflow: bool;
  relationCount: int;
  next: GoPtr<Relater>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getRelater","kind":"method","status":"implemented","sigHash":"fedb9cb9bf13d6145d81fe8f3a52d266fc376253745b3561faa43cc81cf3b07a","bodyHash":"add794d7c1ac5e13a35916baf7e4e02df1192e2e73f6df4f8f8dddaad78ab046"}
 *
 * Go source:
 * func (c *Checker) getRelater() *Relater {
 * 	r := c.freeRelater
 * 	if r == nil {
 * 		r = &Relater{c: c}
 * 	}
 * 	c.freeRelater = r.next
 * 	return r
 * }
 */
export function Checker_getRelater(receiver: GoPtr<Checker>): GoPtr<Relater> {
  let r = receiver!.freeRelater;
  if (r === undefined) {
    r = {
      c: receiver,
      relation: undefined,
      errorNode: undefined,
      errorChain: undefined,
      relatedInfo: [],
      maybeKeys: [],
      maybeKeysSet: NewSetWithSizeHint<CacheHashKey>(0 as int)!,
      sourceStack: [],
      targetStack: [],
      maybeCount: 0 as int,
      sourceDepth: 0 as int,
      targetDepth: 0 as int,
      expandingFlags: ExpandingFlagsNone,
      overflow: false,
      relationCount: 0 as int,
      next: undefined,
    } as Relater;
  }
  receiver!.freeRelater = r!.next;
  return r;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.putRelater","kind":"method","status":"implemented","sigHash":"71875d611ea1c8175c46ccb41a3beb92c499ab74aa946f2a6737ea8a4bfa6926","bodyHash":"aeb4c39b2aadee5cbbc99f0dac5203a491c3cd19e1fae3c5a29c2c99dd307f67"}
 *
 * Go source:
 * func (c *Checker) putRelater(r *Relater) {
 * 	r.maybeKeysSet.Clear()
 * 	*r = Relater{
 * 		c:            c,
 * 		maybeKeys:    r.maybeKeys[:0],
 * 		maybeKeysSet: r.maybeKeysSet,
 * 		sourceStack:  r.sourceStack[:0],
 * 		targetStack:  r.targetStack[:0],
 * 		next:         c.freeRelater,
 * 	}
 * 	c.freeRelater = r
 * }
 */
export function Checker_putRelater(receiver: GoPtr<Checker>, r: GoPtr<Relater>): void {
  Set_Clear(r!.maybeKeysSet);
  const savedMaybeKeys = r!.maybeKeys;
  const savedMaybeKeysSet = r!.maybeKeysSet;
  const savedSourceStack = r!.sourceStack;
  const savedTargetStack = r!.targetStack;
  r!.c = receiver;
  r!.relation = undefined;
  r!.errorNode = undefined;
  r!.errorChain = undefined;
  r!.relatedInfo = [];
  r!.maybeKeys = savedMaybeKeys;
  r!.maybeKeys.length = 0;
  r!.maybeKeysSet = savedMaybeKeysSet;
  r!.sourceStack = savedSourceStack;
  r!.sourceStack.length = 0;
  r!.targetStack = savedTargetStack;
  r!.targetStack.length = 0;
  r!.maybeCount = 0;
  r!.sourceDepth = 0;
  r!.targetDepth = 0;
  r!.expandingFlags = ExpandingFlagsNone;
  r!.overflow = false;
  r!.relationCount = 0;
  r!.next = receiver!.freeRelater;
  receiver!.freeRelater = r;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.isRelatedToSimple","kind":"method","status":"implemented","sigHash":"0cb8eb029d49031cbf7707a55ab1242eaaa6da9c9c607d5318c222cc84fd1b56","bodyHash":"dc0f027fd5d20abb7f181e95f513d9ea41f6c1d9695702b3a2e24ae535cc3701"}
 *
 * Go source:
 * func (r *Relater) isRelatedToSimple(source *Type, target *Type) Ternary {
 * 	return r.isRelatedToEx(source, target, RecursionFlagsBoth, false /*reportErrors* /, nil /*headMessage* /, IntersectionStateNone)
 * }
 */
export function Relater_isRelatedToSimple(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>): Ternary {
  return Relater_isRelatedToEx(receiver, source, target, RecursionFlagsBoth, false, undefined, IntersectionStateNone);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.isRelatedToWorker","kind":"method","status":"implemented","sigHash":"3a731b1492df0818ee374947310c6badafc7b50fafa46f717ec54705d33ac6ec","bodyHash":"12a5afd31834779965487dcb4ed78ede027f4e49e1e7f7361fee937e9d822a0e"}
 *
 * Go source:
 * func (r *Relater) isRelatedToWorker(source *Type, target *Type, reportErrors bool) Ternary {
 * 	return r.isRelatedToEx(source, target, RecursionFlagsBoth, reportErrors, nil, IntersectionStateNone)
 * }
 */
export function Relater_isRelatedToWorker(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, reportErrors: bool): Ternary {
  return Relater_isRelatedToEx(receiver, source, target, RecursionFlagsBoth, reportErrors, undefined, IntersectionStateNone);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.isRelatedTo","kind":"method","status":"implemented","sigHash":"dad7db596064fa792a6738adfe9b2863d12fdf0ae8c4d8ac0fc7b2e6c0957833","bodyHash":"7c93ccb811681edcfa33b8785a99680d7f60620fa8436b0fb12c33359bc8f7b1"}
 *
 * Go source:
 * func (r *Relater) isRelatedTo(source *Type, target *Type, recursionFlags RecursionFlags, reportErrors bool) Ternary {
 * 	return r.isRelatedToEx(source, target, recursionFlags, reportErrors, nil, IntersectionStateNone)
 * }
 */
export function Relater_isRelatedTo(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, recursionFlags: RecursionFlags, reportErrors: bool): Ternary {
  return Relater_isRelatedToEx(receiver, source, target, recursionFlags, reportErrors, undefined, IntersectionStateNone);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.isRelatedToEx","kind":"method","status":"implemented","sigHash":"37c87988a49a75f911abf52ad482cdd6f66129a863f81f187b4c2a901b612b16","bodyHash":"081704671b3d5be444cae66198417366adde25d6152d9dd7ebcb648dfa062706"}
 *
 * Go source:
 * func (r *Relater) isRelatedToEx(originalSource *Type, originalTarget *Type, recursionFlags RecursionFlags, reportErrors bool, headMessage *diagnostics.Message, intersectionState IntersectionState) Ternary {
 * 	if originalSource == originalTarget {
 * 		return TernaryTrue
 * 	}
 * 	// Before normalization: if `source` is type an object type, and `target` is primitive,
 * 	// skip all the checks we don't need and just return `isSimpleTypeRelatedTo` result
 * 	if originalSource.flags&TypeFlagsObject != 0 && originalTarget.flags&TypeFlagsPrimitive != 0 {
 * 		if r.relation == r.c.comparableRelation && originalTarget.flags&TypeFlagsNever == 0 && r.c.isSimpleTypeRelatedTo(originalTarget, originalSource, r.relation, nil) ||
 * 			r.c.isSimpleTypeRelatedTo(originalSource, originalTarget, r.relation, core.IfElse(reportErrors, r.reportError, nil)) {
 * 			return TernaryTrue
 * 		}
 * 		if reportErrors {
 * 			r.reportErrorResults(originalSource, originalTarget, originalSource, originalTarget, headMessage)
 * 		}
 * 		return TernaryFalse
 * 	}
 * 	// Normalize the source and target types: Turn fresh literal types into regular literal types,
 * 	// turn deferred type references into regular type references, simplify indexed access and
 * 	// conditional types, and resolve substitution types to either the substitution (on the source
 * 	// side) or the type variable (on the target side).
 * 	source := r.c.getNormalizedType(originalSource, false /*writing* /)
 * 	target := r.c.getNormalizedType(originalTarget, true /*writing* /)
 * 	if source == target {
 * 		return TernaryTrue
 * 	}
 * 	if r.relation == r.c.identityRelation {
 * 		if source.flags != target.flags {
 * 			return TernaryFalse
 * 		}
 * 		if source.flags&TypeFlagsSingleton != 0 {
 * 			return TernaryTrue
 * 		}
 * 		r.traceUnionsOrIntersectionsTooLarge(source, target)
 * 		return r.recursiveTypeRelatedTo(source, target, false /*reportErrors* /, IntersectionStateNone, recursionFlags)
 * 	}
 * 	// We fastpath comparing a type parameter to exactly its constraint, as this is _super_ common,
 * 	// and otherwise, for type parameters in large unions, causes us to need to compare the union to itself,
 * 	// as we break down the _target_ union first, _then_ get the source constraint - so for every
 * 	// member of the target, we attempt to find a match in the source. This avoids that in cases where
 * 	// the target is exactly the constraint.
 * 	if source.flags&TypeFlagsTypeParameter != 0 && r.c.getConstraintOfType(source) == target {
 * 		return TernaryTrue
 * 	}
 * 	// See if we're relating a definitely non-nullable type to a union that includes null and/or undefined
 * 	// plus a single non-nullable type. If so, remove null and/or undefined from the target type.
 * 	if source.flags&TypeFlagsDefinitelyNonNullable != 0 && target.flags&TypeFlagsUnion != 0 {
 * 		types := target.Types()
 * 		var candidate *Type
 * 		switch {
 * 		case len(types) == 2 && types[0].flags&TypeFlagsNullable != 0:
 * 			candidate = types[1]
 * 		case len(types) == 3 && types[0].flags&TypeFlagsNullable != 0 && types[1].flags&TypeFlagsNullable != 0:
 * 			candidate = types[2]
 * 		}
 * 		if candidate != nil && candidate.flags&TypeFlagsNullable == 0 {
 * 			target = r.c.getNormalizedType(candidate /*writing* /, true)
 * 			if source == target {
 * 				return TernaryTrue
 * 			}
 * 		}
 * 	}
 * 	if r.relation == r.c.comparableRelation && target.flags&TypeFlagsNever == 0 && r.c.isSimpleTypeRelatedTo(target, source, r.relation, nil) ||
 * 		r.c.isSimpleTypeRelatedTo(source, target, r.relation, core.IfElse(reportErrors, r.reportError, nil)) {
 * 		return TernaryTrue
 * 	}
 * 	if source.flags&TypeFlagsStructuredOrInstantiable != 0 || target.flags&TypeFlagsStructuredOrInstantiable != 0 {
 * 		isPerformingExcessPropertyChecks := intersectionState&IntersectionStateTarget == 0 && isObjectLiteralType(source) && source.objectFlags&ObjectFlagsFreshLiteral != 0
 * 		if isPerformingExcessPropertyChecks {
 * 			if r.hasExcessProperties(source, target, reportErrors) {
 * 				if reportErrors {
 * 					r.reportRelationError(headMessage, source, core.IfElse(originalTarget.alias != nil, originalTarget, target))
 * 				}
 * 				return TernaryFalse
 * 			}
 * 		}
 * 		isPerformingCommonPropertyChecks := (r.relation != r.c.comparableRelation || isUnitType(source)) &&
 * 			intersectionState&IntersectionStateTarget == 0 &&
 * 			source.flags&(TypeFlagsPrimitive|TypeFlagsObject|TypeFlagsIntersection) != 0 && source != r.c.globalObjectType &&
 * 			target.flags&(TypeFlagsObject|TypeFlagsIntersection) != 0 && r.c.isWeakType(target) && (len(r.c.getPropertiesOfType(source)) > 0 || r.c.typeHasCallOrConstructSignatures(source))
 * 		isComparingJsxAttributes := source.objectFlags&ObjectFlagsJsxAttributes != 0
 * 		if isPerformingCommonPropertyChecks && !r.c.hasCommonProperties(source, target, isComparingJsxAttributes) {
 * 			if reportErrors {
 * 				sourceString := r.c.TypeToString(core.IfElse(originalSource.alias != nil, originalSource, source))
 * 				targetString := r.c.TypeToString(core.IfElse(originalTarget.alias != nil, originalTarget, target))
 * 				calls := r.c.getSignaturesOfType(source, SignatureKindCall)
 * 				constructs := r.c.getSignaturesOfType(source, SignatureKindConstruct)
 * 				if len(calls) > 0 && r.isRelatedTo(r.c.getReturnTypeOfSignature(calls[0]), target, RecursionFlagsSource, false /*reportErrors* /) != TernaryFalse ||
 * 					len(constructs) > 0 && r.isRelatedTo(r.c.getReturnTypeOfSignature(constructs[0]), target, RecursionFlagsSource, false /*reportErrors* /) != TernaryFalse {
 * 					r.reportError(diagnostics.Value_of_type_0_has_no_properties_in_common_with_type_1_Did_you_mean_to_call_it, sourceString, targetString)
 * 				} else {
 * 					r.reportError(diagnostics.Type_0_has_no_properties_in_common_with_type_1, sourceString, targetString)
 * 				}
 * 			}
 * 			return TernaryFalse
 * 		}
 * 		r.traceUnionsOrIntersectionsTooLarge(source, target)
 * 		skipCaching := source.flags&TypeFlagsUnion != 0 && len(source.Types()) < 4 && target.flags&TypeFlagsUnion == 0 ||
 * 			target.flags&TypeFlagsUnion != 0 && len(target.Types()) < 4 && source.flags&TypeFlagsStructuredOrInstantiable == 0
 * 		var result Ternary
 * 		if skipCaching {
 * 			result = r.unionOrIntersectionRelatedTo(source, target, reportErrors, intersectionState)
 * 		} else {
 * 			result = r.recursiveTypeRelatedTo(source, target, reportErrors, intersectionState, recursionFlags)
 * 		}
 * 		if result != TernaryFalse {
 * 			return result
 * 		}
 * 	}
 * 	if reportErrors {
 * 		r.reportErrorResults(originalSource, originalTarget, source, target, headMessage)
 * 	}
 * 	return TernaryFalse
 * }
 */
export function Relater_isRelatedToEx(receiver: GoPtr<Relater>, originalSource: GoPtr<Type>, originalTarget: GoPtr<Type>, recursionFlags: RecursionFlags, reportErrors: bool, headMessage: GoPtr<Message>, intersectionState: IntersectionState): Ternary {
  if (originalSource === originalTarget) {
    return TernaryTrue;
  }
  const reportError: ErrorReporter = (message: GoPtr<Message>, ...args: Array<unknown>) => Relater_reportError(receiver, message, ...args);
  if ((originalSource!.flags & TypeFlagsObject) !== 0 && (originalTarget!.flags & TypeFlagsPrimitive) !== 0) {
    if (
      (receiver!.relation === receiver!.c!.comparableRelation && (originalTarget!.flags & TypeFlagsNever) === 0 && Checker_isSimpleTypeRelatedTo(receiver!.c, originalTarget, originalSource, receiver!.relation, undefined as unknown as ErrorReporter)) ||
      Checker_isSimpleTypeRelatedTo(receiver!.c, originalSource, originalTarget, receiver!.relation, reportErrors ? reportError : (undefined as unknown as ErrorReporter))
    ) {
      return TernaryTrue;
    }
    if (reportErrors) {
      Relater_reportErrorResults(receiver, originalSource, originalTarget, originalSource, originalTarget, headMessage);
    }
    return TernaryFalse;
  }
  const source = Checker_getNormalizedType(receiver!.c, originalSource, false);
  let target = Checker_getNormalizedType(receiver!.c, originalTarget, true);
  if (source === target) {
    return TernaryTrue;
  }
  if (receiver!.relation === receiver!.c!.identityRelation) {
    if (source!.flags !== target!.flags) {
      return TernaryFalse;
    }
    if ((source!.flags & TypeFlagsSingleton) !== 0) {
      return TernaryTrue;
    }
    Relater_traceUnionsOrIntersectionsTooLarge(receiver, source, target);
    return Relater_recursiveTypeRelatedTo(receiver, source, target, false, IntersectionStateNone, recursionFlags);
  }
  if ((source!.flags & TypeFlagsTypeParameter) !== 0 && Checker_getConstraintOfType(receiver!.c, source) === target) {
    return TernaryTrue;
  }
  if ((source!.flags & TypeFlagsDefinitelyNonNullable) !== 0 && (target!.flags & TypeFlagsUnion) !== 0) {
    const types = Type_Types(target)!;
    let candidate: GoPtr<Type>;
    if (types.length === 2 && (types[0]!.flags & TypeFlagsNullable) !== 0) {
      candidate = types[1];
    } else if (types.length === 3 && (types[0]!.flags & TypeFlagsNullable) !== 0 && (types[1]!.flags & TypeFlagsNullable) !== 0) {
      candidate = types[2];
    }
    if (candidate !== undefined && (candidate!.flags & TypeFlagsNullable) === 0) {
      target = Checker_getNormalizedType(receiver!.c, candidate, true);
      if (source === target) {
        return TernaryTrue;
      }
    }
  }
  if (
    (receiver!.relation === receiver!.c!.comparableRelation && (target!.flags & TypeFlagsNever) === 0 && Checker_isSimpleTypeRelatedTo(receiver!.c, target, source, receiver!.relation, undefined as unknown as ErrorReporter)) ||
    Checker_isSimpleTypeRelatedTo(receiver!.c, source, target, receiver!.relation, reportErrors ? reportError : (undefined as unknown as ErrorReporter))
  ) {
    return TernaryTrue;
  }
  if ((source!.flags & TypeFlagsStructuredOrInstantiable) !== 0 || (target!.flags & TypeFlagsStructuredOrInstantiable) !== 0) {
    const isPerformingExcessPropertyChecks = (intersectionState & IntersectionStateTarget) === 0 && isObjectLiteralType(source) && (source!.objectFlags & ObjectFlagsFreshLiteral) !== 0;
    if (isPerformingExcessPropertyChecks) {
      if (Relater_hasExcessProperties(receiver, source, target, reportErrors)) {
        if (reportErrors) {
          Relater_reportRelationError(receiver, headMessage, source, originalTarget!.alias !== undefined ? originalTarget : target);
        }
        return TernaryFalse;
      }
    }
    const isPerformingCommonPropertyChecks =
      (receiver!.relation !== receiver!.c!.comparableRelation || isUnitType(source)) &&
      (intersectionState & IntersectionStateTarget) === 0 &&
      (source!.flags & (TypeFlagsPrimitive | TypeFlagsObject | TypeFlagsIntersection)) !== 0 &&
      source !== receiver!.c!.globalObjectType &&
      (target!.flags & (TypeFlagsObject | TypeFlagsIntersection)) !== 0 &&
      Checker_isWeakType(receiver!.c, target) &&
      (Checker_getPropertiesOfType(receiver!.c, source).length > 0 || Checker_typeHasCallOrConstructSignatures(receiver!.c, source));
    const isComparingJsxAttributes = (source!.objectFlags & ObjectFlagsJsxAttributes) !== 0;
    if (isPerformingCommonPropertyChecks && !Checker_hasCommonProperties(receiver!.c, source, target, isComparingJsxAttributes)) {
      if (reportErrors) {
        const sourceString = Checker_TypeToString(receiver!.c, originalSource!.alias !== undefined ? originalSource : source);
        const targetString = Checker_TypeToString(receiver!.c, originalTarget!.alias !== undefined ? originalTarget : target);
        const calls = Checker_getSignaturesOfType(receiver!.c, source, SignatureKindCall);
        const constructs = Checker_getSignaturesOfType(receiver!.c, source, SignatureKindConstruct);
        if (
          (calls.length > 0 && Relater_isRelatedTo(receiver, Checker_getReturnTypeOfSignature(receiver!.c, calls[0]!), target, RecursionFlagsSource, false) !== TernaryFalse) ||
          (constructs.length > 0 && Relater_isRelatedTo(receiver, Checker_getReturnTypeOfSignature(receiver!.c, constructs[0]!), target, RecursionFlagsSource, false) !== TernaryFalse)
        ) {
          Relater_reportError(receiver, Value_of_type_0_has_no_properties_in_common_with_type_1_Did_you_mean_to_call_it, sourceString, targetString);
        } else {
          Relater_reportError(receiver, Type_0_has_no_properties_in_common_with_type_1, sourceString, targetString);
        }
      }
      return TernaryFalse;
    }
    Relater_traceUnionsOrIntersectionsTooLarge(receiver, source, target);
    const skipCaching =
      ((source!.flags & TypeFlagsUnion) !== 0 && Type_Types(source)!.length < 4 && (target!.flags & TypeFlagsUnion) === 0) ||
      ((target!.flags & TypeFlagsUnion) !== 0 && Type_Types(target)!.length < 4 && (source!.flags & TypeFlagsStructuredOrInstantiable) === 0);
    const result = skipCaching
      ? Relater_unionOrIntersectionRelatedTo(receiver, source, target, reportErrors, intersectionState)
      : Relater_recursiveTypeRelatedTo(receiver, source, target, reportErrors, intersectionState, recursionFlags);
    if (result !== TernaryFalse) {
      return result;
    }
  }
  if (reportErrors) {
    Relater_reportErrorResults(receiver, originalSource, originalTarget, source, target, headMessage);
  }
  return TernaryFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.hasExcessProperties","kind":"method","status":"implemented","sigHash":"113f37217c6b4dcc1dc5f5ec12ebbec5fc1944a86e1d12d5ed608331ba1f16cd","bodyHash":"e32a3efa3343354648a743d4775b27f82d6c37b48bbbd57312f9387f822d4e4e"}
 *
 * Go source:
 * func (r *Relater) hasExcessProperties(source *Type, target *Type, reportErrors bool) bool {
 * 	if !isExcessPropertyCheckTarget(target) || !r.c.noImplicitAny && target.objectFlags&ObjectFlagsJSLiteral != 0 {
 * 		// Disable excess property checks on JS literals to simulate having an implicit "index signature" - but only outside of noImplicitAny
 * 		return false
 * 	}
 * 	isComparingJsxAttributes := source.objectFlags&ObjectFlagsJsxAttributes != 0
 * 	if (r.relation == r.c.assignableRelation || r.relation == r.c.comparableRelation) && (r.c.isTypeSubsetOf(r.c.globalObjectType, target) || (!isComparingJsxAttributes && r.c.isEmptyObjectType(target))) {
 * 		return false
 * 	}
 * 	reducedTarget := target
 * 	var checkTypes []*Type
 * 	if target.flags&TypeFlagsUnion != 0 {
 * 		reducedTarget = r.c.findMatchingDiscriminantType(source, target, r.isRelatedToSimple)
 * 		if reducedTarget == nil {
 * 			reducedTarget = r.c.filterPrimitivesIfContainsNonPrimitive(target)
 * 		}
 * 		checkTypes = reducedTarget.Distributed()
 * 	}
 * 	for _, prop := range r.c.getPropertiesOfType(source) {
 * 		if shouldCheckAsExcessProperty(prop, source.symbol) && !isIgnoredJsxProperty(source, prop) {
 * 			if !r.c.isKnownProperty(reducedTarget, prop.Name, isComparingJsxAttributes) {
 * 				if reportErrors {
 * 					// Report error in terms of object types in the target as those are the only ones
 * 					// we check in isKnownProperty.
 * 					errorTarget := r.c.filterType(reducedTarget, isExcessPropertyCheckTarget)
 * 					// We know *exactly* where things went wrong when comparing the types.
 * 					// Use this property as the error node as this will be more helpful in
 * 					// reasoning about what went wrong.
 * 					if r.errorNode == nil {
 * 						panic("No errorNode in hasExcessProperties")
 * 					}
 * 					if ast.IsJsxAttributes(r.errorNode) || ast.IsJsxOpeningLikeElement(r.errorNode) || ast.IsJsxOpeningLikeElement(r.errorNode.Parent) {
 * 						// JsxAttributes has an object-literal flag and undergo same type-assignablity check as normal object-literal.
 * 						// However, using an object-literal error message will be very confusing to the users so we give different a message.
 * 						if prop.ValueDeclaration != nil && ast.IsJsxAttribute(prop.ValueDeclaration) && ast.GetSourceFileOfNode(r.errorNode) == ast.GetSourceFileOfNode(prop.ValueDeclaration.Name()) {
 * 							// Note that extraneous children (as in `<NoChild>extra</NoChild>`) don't pass this check,
 * 							// since `children` is a Kind.PropertySignature instead of a Kind.JsxAttribute.
 * 							r.errorNode = prop.ValueDeclaration.Name()
 * 						}
 * 						propName := r.c.symbolToString(prop)
 * 						suggestionSymbol := r.c.getSuggestedSymbolForNonexistentJSXAttribute(propName, errorTarget)
 * 						if suggestionSymbol != nil {
 * 							r.reportError(diagnostics.Property_0_does_not_exist_on_type_1_Did_you_mean_2, propName, r.c.TypeToString(errorTarget), r.c.symbolToString(suggestionSymbol))
 * 						} else {
 * 							r.reportError(diagnostics.Property_0_does_not_exist_on_type_1, propName, r.c.TypeToString(errorTarget))
 * 						}
 * 					} else {
 * 						// use the property's value declaration if the property is assigned inside the literal itself
 * 						var objectLiteralDeclaration *ast.Node
 * 						if source.symbol != nil {
 * 							objectLiteralDeclaration = core.FirstOrNil(source.symbol.Declarations)
 * 						}
 * 						var suggestion string
 * 						if prop.ValueDeclaration != nil && ast.IsObjectLiteralElement(prop.ValueDeclaration) &&
 * 							ast.FindAncestor(prop.ValueDeclaration, func(d *ast.Node) bool { return d == objectLiteralDeclaration }) != nil &&
 * 							ast.GetSourceFileOfNode(objectLiteralDeclaration) == ast.GetSourceFileOfNode(r.errorNode) {
 * 							name := prop.ValueDeclaration.Name()
 * 							r.errorNode = name
 * 							if ast.IsIdentifier(name) {
 * 								suggestion = r.c.getSuggestionForNonexistentProperty(name.Text(), errorTarget)
 * 							}
 * 						}
 * 						if suggestion != "" {
 * 							r.reportError(diagnostics.Object_literal_may_only_specify_known_properties_but_0_does_not_exist_in_type_1_Did_you_mean_to_write_2, r.c.symbolToString(prop), r.c.TypeToString(errorTarget), suggestion)
 * 						} else {
 * 							r.reportError(diagnostics.Object_literal_may_only_specify_known_properties_and_0_does_not_exist_in_type_1, r.c.symbolToString(prop), r.c.TypeToString(errorTarget))
 * 						}
 * 					}
 * 				}
 * 				return true
 * 			}
 * 			if checkTypes != nil && r.isRelatedTo(r.c.getTypeOfSymbol(prop), r.c.getTypeOfPropertyInTypes(checkTypes, prop.Name), RecursionFlagsBoth, reportErrors) == TernaryFalse {
 * 				if reportErrors {
 * 					r.reportError(diagnostics.Types_of_property_0_are_incompatible, r.c.symbolToString(prop))
 * 				}
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Relater_hasExcessProperties(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, reportErrors: bool): bool {
  if (!isExcessPropertyCheckTarget(target) || (!receiver!.c!.noImplicitAny && (target!.objectFlags & ObjectFlagsJSLiteral) !== 0)) {
    return false;
  }
  const isComparingJsxAttributes = (source!.objectFlags & ObjectFlagsJsxAttributes) !== 0;
  if (
    (receiver!.relation === receiver!.c!.assignableRelation || receiver!.relation === receiver!.c!.comparableRelation) &&
    (Checker_isTypeSubsetOf(receiver!.c, receiver!.c!.globalObjectType, target) || (!isComparingJsxAttributes && Checker_isEmptyObjectType(receiver!.c, target)))
  ) {
    return false;
  }
  let reducedTarget = target;
  let checkTypes: GoSlice<GoPtr<Type>> | undefined = undefined;
  if ((target!.flags & TypeFlagsUnion) !== 0) {
    reducedTarget = Checker_findMatchingDiscriminantType(receiver!.c, source, target, (sourceType, targetType) => Relater_isRelatedToSimple(receiver, sourceType, targetType));
    if (reducedTarget === undefined) {
      reducedTarget = Checker_filterPrimitivesIfContainsNonPrimitive(receiver!.c, target);
    }
    checkTypes = Type_Distributed(reducedTarget);
  }
  for (const prop of Checker_getPropertiesOfType(receiver!.c, source)) {
    if (shouldCheckAsExcessProperty(prop, source!.symbol) && !isIgnoredJsxProperty(source, prop)) {
      if (!Checker_isKnownProperty(receiver!.c, reducedTarget, prop!.Name, isComparingJsxAttributes)) {
        if (reportErrors) {
          const errorTarget = Checker_filterType(receiver!.c, reducedTarget, isExcessPropertyCheckTarget);
          if (receiver!.errorNode === undefined) {
            throw new globalThis.Error("No errorNode in hasExcessProperties");
          }
          const errorNodeParent = receiver!.errorNode!.Parent;
          if (IsJsxAttributes(receiver!.errorNode) || IsJsxOpeningLikeElement(receiver!.errorNode) || (errorNodeParent !== undefined && IsJsxOpeningLikeElement(errorNodeParent))) {
            if (
              prop!.ValueDeclaration !== undefined &&
              IsJsxAttribute(prop!.ValueDeclaration) &&
              GetSourceFileOfNode(receiver!.errorNode) === GetSourceFileOfNode(Node_Name(prop!.ValueDeclaration))
            ) {
              receiver!.errorNode = Node_Name(prop!.ValueDeclaration);
            }
            const propName = Checker_symbolToString(receiver!.c, prop);
            const suggestionSymbol = Checker_getSuggestedSymbolForNonexistentJSXAttribute(receiver!.c, propName, errorTarget);
            if (suggestionSymbol !== undefined) {
              Relater_reportError(receiver, Property_0_does_not_exist_on_type_1_Did_you_mean_2, propName, Checker_TypeToString(receiver!.c, errorTarget), Checker_symbolToString(receiver!.c, suggestionSymbol));
            } else {
              Relater_reportError(receiver, Property_0_does_not_exist_on_type_1, propName, Checker_TypeToString(receiver!.c, errorTarget));
            }
          } else {
            let objectLiteralDeclaration: GoPtr<Node> = undefined;
            if (source!.symbol !== undefined) {
      objectLiteralDeclaration = FirstOrNil(source!.symbol!.Declarations ?? []);
            }
            let suggestion = "";
            if (
              prop!.ValueDeclaration !== undefined &&
              IsObjectLiteralElement(prop!.ValueDeclaration) &&
              objectLiteralDeclaration !== undefined &&
              FindAncestor(prop!.ValueDeclaration, (declaration) => declaration === objectLiteralDeclaration) !== undefined &&
              GetSourceFileOfNode(objectLiteralDeclaration) === GetSourceFileOfNode(receiver!.errorNode)
            ) {
              const name = Node_Name(prop!.ValueDeclaration);
              receiver!.errorNode = name;
              if (IsIdentifier(name)) {
                suggestion = Checker_getSuggestionForNonexistentProperty(receiver!.c, Node_Text(name), errorTarget);
              }
            }
            if (suggestion !== "") {
              Relater_reportError(receiver, Object_literal_may_only_specify_known_properties_but_0_does_not_exist_in_type_1_Did_you_mean_to_write_2, Checker_symbolToString(receiver!.c, prop), Checker_TypeToString(receiver!.c, errorTarget), suggestion);
            } else {
              Relater_reportError(receiver, Object_literal_may_only_specify_known_properties_and_0_does_not_exist_in_type_1, Checker_symbolToString(receiver!.c, prop), Checker_TypeToString(receiver!.c, errorTarget));
            }
          }
        }
        return true;
      }
      if (
        checkTypes !== undefined &&
        Relater_isRelatedTo(receiver, Checker_getTypeOfSymbol(receiver!.c, prop), Checker_getTypeOfPropertyInTypes(receiver!.c, checkTypes, prop!.Name), RecursionFlagsBoth, reportErrors) === TernaryFalse
      ) {
        if (reportErrors) {
          Relater_reportError(receiver, Types_of_property_0_are_incompatible, Checker_symbolToString(receiver!.c, prop));
        }
        return true;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getTypeOfPropertyInTypes","kind":"method","status":"implemented","sigHash":"4d9e3423a062cefdf9d1070364cedbf949a73f9981a7bcc43bafe5e0d4ef8efe","bodyHash":"b27a85704f2ab8a68a77cf887b04208dcd9ec6c9c4fb6dd586989e5531b7f98d"}
 *
 * Go source:
 * func (c *Checker) getTypeOfPropertyInTypes(types []*Type, name string) *Type {
 * 	var propTypes []*Type
 * 	for _, t := range types {
 * 		propTypes = append(propTypes, c.getTypeOfPropertyInType(t, name))
 * 	}
 * 	return c.getUnionType(propTypes)
 * }
 */
export function Checker_getTypeOfPropertyInTypes(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>, name: string): GoPtr<Type> {
  let propTypes: GoSlice<GoPtr<Type>> = [];
  for (const t of types ?? []) {
    propTypes = [...propTypes, Checker_getTypeOfPropertyInType(receiver, t, name)];
  }
  return Checker_getUnionType(receiver, propTypes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.getTypeOfPropertyInType","kind":"method","status":"implemented","sigHash":"ead50dcbac0d9fd1cfd2e8eea84524b965d7e81e48dbd46b8d9eab667d9a9293","bodyHash":"1c95e5744bd8c4acc2d77872efa8afe10796256755ede332d08b518e9408c97f"}
 *
 * Go source:
 * func (c *Checker) getTypeOfPropertyInType(t *Type, name string) *Type {
 * 	t = c.getApparentType(t)
 * 	var prop *ast.Symbol
 * 	if t.flags&TypeFlagsUnionOrIntersection != 0 {
 * 		prop = c.getPropertyOfUnionOrIntersectionType(t, name, false)
 * 	} else {
 * 		prop = c.getPropertyOfObjectType(t, name)
 * 	}
 * 	if prop != nil {
 * 		return c.getTypeOfSymbol(prop)
 * 	}
 * 	indexInfo := c.getApplicableIndexInfoForName(t, name)
 * 	if indexInfo != nil {
 * 		return indexInfo.valueType
 * 	}
 * 	return c.undefinedType
 * }
 */
export function Checker_getTypeOfPropertyInType(receiver: GoPtr<Checker>, t: GoPtr<Type>, name: string): GoPtr<Type> {
  t = Checker_getApparentType(receiver, t);
  let prop: GoPtr<Symbol>;
  if ((t!.flags & TypeFlagsUnionOrIntersection) !== 0) {
    prop = Checker_getPropertyOfUnionOrIntersectionType(receiver, t, name, false as bool);
  } else {
    prop = Checker_getPropertyOfObjectType(receiver, t, name);
  }
  if (prop !== undefined) {
    return Checker_getTypeOfSymbol(receiver, prop);
  }
  const indexInfo = Checker_getApplicableIndexInfoForName(receiver, t, name);
  if (indexInfo !== undefined) {
    return indexInfo!.valueType;
  }
  return receiver!.undefinedType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::shouldCheckAsExcessProperty","kind":"func","status":"implemented","sigHash":"bd9e5de3e1c13da92cabdf07ae5c10cf5e2a725163dc927b29a7487fb834c2bc","bodyHash":"8df6a6f3a1cdd78bd3454d34c6fd4097019b791afc87009b9350882732e2b0f8"}
 *
 * Go source:
 * func shouldCheckAsExcessProperty(prop *ast.Symbol, container *ast.Symbol) bool {
 * 	return prop.ValueDeclaration != nil && container.ValueDeclaration != nil && prop.ValueDeclaration.Parent == container.ValueDeclaration
 * }
 */
export function shouldCheckAsExcessProperty(prop: GoPtr<Symbol>, container: GoPtr<Symbol>): bool {
  return prop!.ValueDeclaration !== undefined && container!.ValueDeclaration !== undefined && prop!.ValueDeclaration!.Parent === container!.ValueDeclaration;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::isIgnoredJsxProperty","kind":"func","status":"implemented","sigHash":"261fcbe2f7ba442f4680e6b068dab7be2dc0ecf08afe13c45aa39381c1cd8bd5","bodyHash":"bd88a9098098ceefadf92769bde116dfeacf5ca25cabe38210fd176f376b6686"}
 *
 * Go source:
 * func isIgnoredJsxProperty(source *Type, sourceProp *ast.Symbol) bool {
 * 	return source.objectFlags&ObjectFlagsJsxAttributes != 0 && isHyphenatedJsxName(sourceProp.Name)
 * }
 */
export function isIgnoredJsxProperty(source: GoPtr<Type>, sourceProp: GoPtr<Symbol>): bool {
  return (source!.objectFlags & ObjectFlagsJsxAttributes) !== 0 && isHyphenatedJsxName(sourceProp!.Name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isTypeSubsetOf","kind":"method","status":"implemented","sigHash":"a1d9119e741d8b49018f83e70a4a6546157ac0f79643921faaac623577b5cd60","bodyHash":"bde3ab70555cc737b2efbb42d349421a8fcb9e03fe51573dc62e2f97514686a7"}
 *
 * Go source:
 * func (c *Checker) isTypeSubsetOf(source *Type, target *Type) bool {
 * 	return source == target || source.flags&TypeFlagsNever != 0 || target.flags&TypeFlagsUnion != 0 && c.isTypeSubsetOfUnion(source, target)
 * }
 */
export function Checker_isTypeSubsetOf(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  return source === target || (source!.flags & TypeFlagsNever) !== 0 || ((target!.flags & TypeFlagsUnion) !== 0 && Checker_isTypeSubsetOfUnion(receiver, source, target));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isTypeSubsetOfUnion","kind":"method","status":"implemented","sigHash":"e33a51a6529cacd88e62116c162a0569121308b639e4ff473d9765a6b28e9329","bodyHash":"ee8609f60afc9ab14fa432ce505bea692d01cfd0b61e46f78d67dd98b40401f0"}
 *
 * Go source:
 * func (c *Checker) isTypeSubsetOfUnion(source *Type, target *Type) bool {
 * 	if source.flags&TypeFlagsUnion != 0 {
 * 		for _, t := range source.Types() {
 * 			if !containsType(target.Types(), t) {
 * 				return false
 * 			}
 * 		}
 * 		return true
 * 	}
 * 	if source.flags&TypeFlagsEnumLike != 0 && c.getBaseTypeOfEnumLikeType(source) == target {
 * 		return true
 * 	}
 * 	return containsType(target.Types(), source)
 * }
 */
export function Checker_isTypeSubsetOfUnion(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  if ((source!.flags & TypeFlagsUnion) !== 0) {
    for (const t of Type_Types(source)!) {
      if (!containsType(Type_Types(target)!, t)) {
        return false;
      }
    }
    return true;
  }
  if ((source!.flags & TypeFlagsEnumLike) !== 0 && Checker_getBaseTypeOfEnumLikeType(receiver, source) === target) {
    return true;
  }
  return containsType(Type_Types(target)!, source);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.unionOrIntersectionRelatedTo","kind":"method","status":"implemented","sigHash":"a884ea7b57906cdf1fb846880237ffb606382d54d8916096194cadd32fb275c5","bodyHash":"faf9d15f202d1d91b35a052cf0ea3b3f922013c626ac15a1018b2c79ff668f26"}
 *
 * Go source:
 * func (r *Relater) unionOrIntersectionRelatedTo(source *Type, target *Type, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	// Note that these checks are specifically ordered to produce correct results. In particular,
 * 	// we need to deconstruct unions before intersections (because unions are always at the top),
 * 	// and we need to handle "each" relations before "some" relations for the same kind of type.
 * 	if source.flags&TypeFlagsUnion != 0 {
 * 		if target.flags&TypeFlagsUnion != 0 {
 * 			// Intersections of union types are normalized into unions of intersection types, and such normalized
 * 			// unions can get very large and expensive to relate. The following fast path checks if the source union
 * 			// originated in an intersection. If so, and if that intersection contains the target type, then we know
 * 			// the result to be true (for any two types A and B, A & B is related to both A and B).
 * 			sourceOrigin := source.AsUnionType().origin
 * 			if sourceOrigin != nil && sourceOrigin.flags&TypeFlagsIntersection != 0 && target.alias != nil && slices.Contains(sourceOrigin.Types(), target) {
 * 				return TernaryTrue
 * 			}
 * 			// Similarly, in unions of unions the we preserve the original list of unions. This original list is often
 * 			// much shorter than the normalized result, so we scan it in the following fast path.
 * 			targetOrigin := target.AsUnionType().origin
 * 			if targetOrigin != nil && targetOrigin.flags&TypeFlagsUnion != 0 && source.alias != nil && slices.Contains(targetOrigin.Types(), source) {
 * 				return TernaryTrue
 * 			}
 * 		}
 * 		if r.relation == r.c.comparableRelation {
 * 			return r.someTypeRelatedToType(source, target, reportErrors && source.flags&TypeFlagsPrimitive == 0, intersectionState)
 * 		}
 * 		return r.eachTypeRelatedToType(source, target, reportErrors && source.flags&TypeFlagsPrimitive == 0, intersectionState)
 * 	}
 * 	if target.flags&TypeFlagsUnion != 0 {
 * 		return r.typeRelatedToSomeType(r.c.getRegularTypeOfObjectLiteral(source), target, reportErrors && source.flags&TypeFlagsPrimitive == 0 && target.flags&TypeFlagsPrimitive == 0, intersectionState)
 * 	}
 * 	if target.flags&TypeFlagsIntersection != 0 {
 * 		return r.typeRelatedToEachType(source, target, reportErrors, IntersectionStateTarget)
 * 	}
 * 	// Source is an intersection. For the comparable relation, if the target is a primitive type we hoist the
 * 	// constraints of all non-primitive types in the source into a new intersection. We do this because the
 * 	// intersection may further constrain the constraints of the non-primitive types. For example, given a type
 * 	// parameter 'T extends 1 | 2', the intersection 'T & 1' should be reduced to '1' such that it doesn't
 * 	// appear to be comparable to '2'.
 * 	if r.relation == r.c.comparableRelation && target.flags&TypeFlagsPrimitive != 0 {
 * 		constraints := core.SameMap(source.Types(), func(t *Type) *Type {
 * 			if t.flags&TypeFlagsInstantiable != 0 {
 * 				constraint := r.c.getBaseConstraintOfType(t)
 * 				if constraint != nil {
 * 					return constraint
 * 				}
 * 				return r.c.unknownType
 * 			}
 * 			return t
 * 		})
 * 		if !core.Same(constraints, source.Types()) {
 * 			source = r.c.getIntersectionType(constraints)
 * 			if source.flags&TypeFlagsNever != 0 {
 * 				return TernaryFalse
 * 			}
 * 			if source.flags&TypeFlagsIntersection == 0 {
 * 				result := r.isRelatedTo(source, target, RecursionFlagsSource, false /*reportErrors* /)
 * 				if result != TernaryFalse {
 * 					return result
 * 				}
 * 				return r.isRelatedTo(target, source, RecursionFlagsSource, false /*reportErrors* /)
 * 			}
 * 		}
 * 	}
 * 	// Check to see if any constituents of the intersection are immediately related to the target.
 * 	// Don't report errors though. Elaborating on whether a source constituent is related to the target is
 * 	// not actually useful and leads to some confusing error messages. Instead, we rely on the caller
 * 	// checking whether the full intersection viewed as an object is related to the target.
 * 	return r.someTypeRelatedToType(source, target, false /*reportErrors* /, IntersectionStateSource)
 * }
 */
export function Relater_unionOrIntersectionRelatedTo(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  if ((source!.flags & TypeFlagsUnion) !== 0) {
    if ((target!.flags & TypeFlagsUnion) !== 0) {
      const sourceOrigin = Type_AsUnionType(source)!.origin;
      if (sourceOrigin !== undefined && (sourceOrigin!.flags & TypeFlagsIntersection) !== 0 && target!.alias !== undefined && Type_Types(sourceOrigin)!.includes(target)) {
        return TernaryTrue;
      }
      const targetOrigin = Type_AsUnionType(target)!.origin;
      if (targetOrigin !== undefined && (targetOrigin!.flags & TypeFlagsUnion) !== 0 && source!.alias !== undefined && Type_Types(targetOrigin)!.includes(source)) {
        return TernaryTrue;
      }
    }
    if (receiver!.relation === receiver!.c!.comparableRelation) {
      return Relater_someTypeRelatedToType(receiver, source, target, reportErrors && (source!.flags & TypeFlagsPrimitive) === 0, intersectionState);
    }
    return Relater_eachTypeRelatedToType(receiver, source, target, reportErrors && (source!.flags & TypeFlagsPrimitive) === 0, intersectionState);
  }
  if ((target!.flags & TypeFlagsUnion) !== 0) {
    return Relater_typeRelatedToSomeType(receiver, Checker_getRegularTypeOfObjectLiteral(receiver!.c, source), target, reportErrors && (source!.flags & TypeFlagsPrimitive) === 0 && (target!.flags & TypeFlagsPrimitive) === 0, intersectionState);
  }
  if ((target!.flags & TypeFlagsIntersection) !== 0) {
    return Relater_typeRelatedToEachType(receiver, source, target, reportErrors, IntersectionStateTarget);
  }
  if (receiver!.relation === receiver!.c!.comparableRelation && (target!.flags & TypeFlagsPrimitive) !== 0) {
    const constraints = SameMap(Type_Types(source)!, (t: GoPtr<Type>) => {
      if ((t!.flags & TypeFlagsInstantiable) !== 0) {
        const constraint = Checker_getBaseConstraintOfType(receiver!.c, t);
        if (constraint !== undefined) {
          return constraint;
        }
        return receiver!.c!.unknownType;
      }
      return t;
    });
    if (!Same(constraints, Type_Types(source)!)) {
      let src = Checker_getIntersectionType(receiver!.c, constraints);
      if ((src!.flags & TypeFlagsNever) !== 0) {
        return TernaryFalse;
      }
      if ((src!.flags & TypeFlagsIntersection) === 0) {
        const result = Relater_isRelatedTo(receiver, src, target, RecursionFlagsSource, false);
        if (result !== TernaryFalse) {
          return result;
        }
        return Relater_isRelatedTo(receiver, target, src, RecursionFlagsSource, false);
      }
    }
  }
  return Relater_someTypeRelatedToType(receiver, source, target, false, IntersectionStateSource);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.someTypeRelatedToType","kind":"method","status":"implemented","sigHash":"f027f669850e7084e207ae799982e57952bba724b3c62f18d852e4c125a9198b","bodyHash":"7314f22209b5b5e96ffc231ab93ebbbb389157dda68aba7e760b1cd14870e5f4"}
 *
 * Go source:
 * func (r *Relater) someTypeRelatedToType(source *Type, target *Type, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	sourceTypes := source.Types()
 * 	if source.flags&TypeFlagsUnion != 0 && containsType(sourceTypes, target) {
 * 		return TernaryTrue
 * 	}
 * 	for i, t := range sourceTypes {
 * 		related := r.isRelatedToEx(t, target, RecursionFlagsSource, reportErrors && i == len(sourceTypes)-1, nil /*headMessage* /, intersectionState)
 * 		if related != TernaryFalse {
 * 			return related
 * 		}
 * 	}
 * 	return TernaryFalse
 * }
 */
export function Relater_someTypeRelatedToType(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  const sourceTypes = Type_Types(source)!;
  if ((source!.flags & TypeFlagsUnion) !== 0 && containsType(sourceTypes, target)) {
    return TernaryTrue;
  }
  for (let i = 0; i < sourceTypes.length; i++) {
    const t = sourceTypes[i];
    const related = Relater_isRelatedToEx(receiver, t, target, RecursionFlagsSource, reportErrors && i === sourceTypes.length - 1, undefined, intersectionState);
    if (related !== TernaryFalse) {
      return related;
    }
  }
  return TernaryFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.eachTypeRelatedToType","kind":"method","status":"implemented","sigHash":"7b2b746a7cbabc78a3bb3907a918706f77810afba4aa85f328ff699b40ce2b05","bodyHash":"abea43cff9d2118b44e6c96073d42f71a19e8b497a610e39329e072db5d87fd7"}
 *
 * Go source:
 * func (r *Relater) eachTypeRelatedToType(source *Type, target *Type, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	result := TernaryTrue
 * 	sourceTypes := source.Types()
 * 	// We strip `undefined` from the target if the `source` trivially doesn't contain it for our correspondence-checking fastpath
 * 	// since `undefined` is frequently added by optionality and would otherwise spoil a potentially useful correspondence
 * 	strippedTarget := r.getUndefinedStrippedTargetIfNeeded(source, target)
 * 	var strippedTypes []*Type
 * 	if strippedTarget.flags&TypeFlagsUnion != 0 {
 * 		strippedTypes = strippedTarget.Types()
 * 	}
 * 	for i, sourceType := range sourceTypes {
 * 		if strippedTarget.flags&TypeFlagsUnion != 0 && len(sourceTypes) >= len(strippedTypes) && len(sourceTypes)%len(strippedTypes) == 0 {
 * 			// many unions are mappings of one another; in such cases, simply comparing members at the same index can shortcut the comparison
 * 			// such unions will have identical lengths, and their corresponding elements will match up. Another common scenario is where a large
 * 			// union has a union of objects intersected with it. In such cases, if the input was, eg `("a" | "b" | "c") & (string | boolean | {} | {whatever})`,
 * 			// the result will have the structure `"a" | "b" | "c" | "a" & {} | "b" & {} | "c" & {} | "a" & {whatever} | "b" & {whatever} | "c" & {whatever}`
 * 			// - the resulting union has a length which is a multiple of the original union, and the elements correspond modulo the length of the original union
 * 			related := r.isRelatedToEx(sourceType, strippedTypes[i%len(strippedTypes)], RecursionFlagsBoth, false /*reportErrors* /, nil /*headMessage* /, intersectionState)
 * 			if related != TernaryFalse {
 * 				result &= related
 * 				continue
 * 			}
 * 		}
 * 		related := r.isRelatedToEx(sourceType, target, RecursionFlagsSource, reportErrors, nil /*headMessage* /, intersectionState)
 * 		if related == TernaryFalse {
 * 			return TernaryFalse
 * 		}
 * 		result &= related
 * 	}
 * 	return result
 * }
 */
export function Relater_eachTypeRelatedToType(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  let result: Ternary = TernaryTrue;
  const sourceTypes = Type_Types(source)!;
  const strippedTarget = Relater_getUndefinedStrippedTargetIfNeeded(receiver, source, target);
  let strippedTypes: GoSlice<GoPtr<Type>> | undefined;
  if ((strippedTarget!.flags & TypeFlagsUnion) !== 0) {
    strippedTypes = Type_Types(strippedTarget)!;
  }
  for (let i = 0; i < sourceTypes.length; i++) {
    const sourceType = sourceTypes[i];
    if (strippedTypes !== undefined && (strippedTarget!.flags & TypeFlagsUnion) !== 0 && sourceTypes.length >= strippedTypes.length && sourceTypes.length % strippedTypes.length === 0) {
      const related = Relater_isRelatedToEx(receiver, sourceType, strippedTypes[i % strippedTypes.length], RecursionFlagsBoth, false, undefined, intersectionState);
      if (related !== TernaryFalse) {
        result = (result & related) as Ternary;
        continue;
      }
    }
    const related = Relater_isRelatedToEx(receiver, sourceType, target, RecursionFlagsSource, reportErrors, undefined, intersectionState);
    if (related === TernaryFalse) {
      return TernaryFalse;
    }
    result = (result & related) as Ternary;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.getUndefinedStrippedTargetIfNeeded","kind":"method","status":"implemented","sigHash":"72fa262541ffc20f6e8913c7f80b50b5f869f7e2840d8e8958ff5b9a8304691a","bodyHash":"ad7723353cd7bd4d3dbc14caaa8d924118cbd807824d664d5db822e7b40d4a9c"}
 *
 * Go source:
 * func (r *Relater) getUndefinedStrippedTargetIfNeeded(source *Type, target *Type) *Type {
 * 	if source.flags&TypeFlagsUnion != 0 && target.flags&TypeFlagsUnion != 0 && source.Types()[0].flags&TypeFlagsUndefined == 0 && target.Types()[0].flags&TypeFlagsUndefined != 0 {
 * 		return r.c.extractTypesOfKind(target, ^TypeFlagsUndefined)
 * 	}
 * 	return target
 * }
 */
export function Relater_getUndefinedStrippedTargetIfNeeded(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>): GoPtr<Type> {
  if ((source!.flags & TypeFlagsUnion) !== 0 && (target!.flags & TypeFlagsUnion) !== 0 && (Type_Types(source)![0]!.flags & TypeFlagsUndefined) === 0 && (Type_Types(target)![0]!.flags & TypeFlagsUndefined) !== 0) {
    return Checker_extractTypesOfKind(receiver!.c, target, (~TypeFlagsUndefined) >>> 0);
  }
  return target;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.typeRelatedToSomeType","kind":"method","status":"implemented","sigHash":"bacbc1e6e52cc2f4f34b3b29dbc9ce608441f87ccb88f1c2a26e1b9427d7292d","bodyHash":"f62bf06730147a41e35e68c4ca94403375a573717d59519f6b966d1c9ac41193"}
 *
 * Go source:
 * func (r *Relater) typeRelatedToSomeType(source *Type, target *Type, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	targetTypes := target.Types()
 * 	if target.flags&TypeFlagsUnion != 0 {
 * 		if containsType(targetTypes, source) {
 * 			return TernaryTrue
 * 		}
 * 		if r.relation != r.c.comparableRelation && target.objectFlags&ObjectFlagsPrimitiveUnion != 0 && source.flags&TypeFlagsEnumLiteral == 0 &&
 * 			(source.flags&(TypeFlagsStringLiteral|TypeFlagsBooleanLiteral|TypeFlagsBigIntLiteral) != 0 ||
 * 				(r.relation == r.c.subtypeRelation || r.relation == r.c.strictSubtypeRelation) && source.flags&TypeFlagsNumberLiteral != 0) {
 * 			// When relating a literal type to a union of primitive types, we know the relation is false unless
 * 			// the union contains the base primitive type or the literal type in one of its fresh/regular forms.
 * 			// We exclude numeric literals for non-subtype relations because numeric literals are assignable to
 * 			// numeric enum literals with the same value. Similarly, we exclude enum literal types because
 * 			// identically named enum types are related (see isEnumTypeRelatedTo). We exclude the comparable
 * 			// relation in entirety because it needs to be checked in both directions.
 * 			var alternateForm *Type
 * 			if source == source.AsLiteralType().regularType {
 * 				alternateForm = source.AsLiteralType().freshType
 * 			} else {
 * 				alternateForm = source.AsLiteralType().regularType
 * 			}
 * 			var primitive *Type
 * 			switch {
 * 			case source.flags&TypeFlagsStringLiteral != 0:
 * 				primitive = r.c.stringType
 * 			case source.flags&TypeFlagsNumberLiteral != 0:
 * 				primitive = r.c.numberType
 * 			case source.flags&TypeFlagsBigIntLiteral != 0:
 * 				primitive = r.c.bigintType
 * 			}
 * 			if primitive != nil && containsType(targetTypes, primitive) || alternateForm != nil && containsType(targetTypes, alternateForm) {
 * 				return TernaryTrue
 * 			}
 * 			return TernaryFalse
 * 		}
 * 		match := r.c.getMatchingUnionConstituentForType(target, source)
 * 		if match != nil {
 * 			related := r.isRelatedToEx(source, match, RecursionFlagsTarget, false /*reportErrors* /, nil /*headMessage* /, intersectionState)
 * 			if related != TernaryFalse {
 * 				return related
 * 			}
 * 		}
 * 	}
 * 	for _, t := range targetTypes {
 * 		related := r.isRelatedToEx(source, t, RecursionFlagsTarget, false /*reportErrors* /, nil /*headMessage* /, intersectionState)
 * 		if related != TernaryFalse {
 * 			return related
 * 		}
 * 	}
 * 	if reportErrors {
 * 		// Elaborate only if we can find a best matching type in the target union
 * 		bestMatchingType := r.c.getBestMatchingType(source, target, r.isRelatedToSimple)
 * 		if bestMatchingType != nil {
 * 			r.isRelatedToEx(source, bestMatchingType, RecursionFlagsTarget, true /*reportErrors* /, nil /*headMessage* /, intersectionState)
 * 		}
 * 	}
 * 	return TernaryFalse
 * }
 */
export function Relater_typeRelatedToSomeType(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  const targetTypes = Type_Types(target)!;
  if ((target!.flags & TypeFlagsUnion) !== 0) {
    if (containsType(targetTypes, source)) {
      return TernaryTrue;
    }
    if (receiver!.relation !== receiver!.c!.comparableRelation && (target!.objectFlags & ObjectFlagsPrimitiveUnion) !== 0 && (source!.flags & TypeFlagsEnumLiteral) === 0 &&
      ((source!.flags & (TypeFlagsStringLiteral | TypeFlagsBooleanLiteral | TypeFlagsBigIntLiteral)) !== 0 ||
        ((receiver!.relation === receiver!.c!.subtypeRelation || receiver!.relation === receiver!.c!.strictSubtypeRelation) && (source!.flags & TypeFlagsNumberLiteral) !== 0))) {
      let alternateForm: GoPtr<Type>;
      if (source === Type_AsLiteralType(source)!.regularType) {
        alternateForm = Type_AsLiteralType(source)!.freshType;
      } else {
        alternateForm = Type_AsLiteralType(source)!.regularType;
      }
      let primitive: GoPtr<Type>;
      if ((source!.flags & TypeFlagsStringLiteral) !== 0) {
        primitive = receiver!.c!.stringType;
      } else if ((source!.flags & TypeFlagsNumberLiteral) !== 0) {
        primitive = receiver!.c!.numberType;
      } else if ((source!.flags & TypeFlagsBigIntLiteral) !== 0) {
        primitive = receiver!.c!.bigintType;
      }
      if ((primitive !== undefined && containsType(targetTypes, primitive)) || (alternateForm !== undefined && containsType(targetTypes, alternateForm))) {
        return TernaryTrue;
      }
      return TernaryFalse;
    }
    const match = Checker_getMatchingUnionConstituentForType(receiver!.c, target, source);
    if (match !== undefined) {
      const related = Relater_isRelatedToEx(receiver, source, match, RecursionFlagsTarget, false, undefined, intersectionState);
      if (related !== TernaryFalse) {
        return related;
      }
    }
  }
  for (const t of targetTypes) {
    const related = Relater_isRelatedToEx(receiver, source, t, RecursionFlagsTarget, false, undefined, intersectionState);
    if (related !== TernaryFalse) {
      return related;
    }
  }
  if (reportErrors) {
    const bestMatchingType = Checker_getBestMatchingType(receiver!.c, source, target, (s: GoPtr<Type>, t: GoPtr<Type>) => Relater_isRelatedToSimple(receiver, s, t));
    if (bestMatchingType !== undefined) {
      Relater_isRelatedToEx(receiver, source, bestMatchingType, RecursionFlagsTarget, true, undefined, intersectionState);
    }
  }
  return TernaryFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.typeRelatedToEachType","kind":"method","status":"implemented","sigHash":"fb3d12bae8505016b9a094cde97af48d1d43d68eb1d41d3f392a343f688b1833","bodyHash":"e3f2600042a8f3f386fc3639b359272dfd5046daef346eafec7e2af2ba0698e7"}
 *
 * Go source:
 * func (r *Relater) typeRelatedToEachType(source *Type, target *Type, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	result := TernaryTrue
 * 	targetTypes := target.Types()
 * 	for _, targetType := range targetTypes {
 * 		related := r.isRelatedToEx(source, targetType, RecursionFlagsTarget, reportErrors /*headMessage* /, nil, intersectionState)
 * 		if related == TernaryFalse {
 * 			return TernaryFalse
 * 		}
 * 		result &= related
 * 	}
 * 	return result
 * }
 */
export function Relater_typeRelatedToEachType(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  let result: Ternary = TernaryTrue;
  const targetTypes = Type_Types(target)!;
  for (const targetType of targetTypes) {
    const related = Relater_isRelatedToEx(receiver, source, targetType, RecursionFlagsTarget, reportErrors, undefined, intersectionState);
    if (related === TernaryFalse) {
      return TernaryFalse;
    }
    result = (result & related) as Ternary;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.eachTypeRelatedToSomeType","kind":"method","status":"implemented","sigHash":"1859a10b801b9e30e69e5dc4cd19daadf70ff02ca67311b8daadda3ecd6bc3e6","bodyHash":"d7354a923c0cf390787eb91835d67ca5d2bb14bff33e887b353339241825f202"}
 *
 * Go source:
 * func (r *Relater) eachTypeRelatedToSomeType(source *Type, target *Type) Ternary {
 * 	result := TernaryTrue
 * 	sourceTypes := source.Types()
 * 	for _, sourceType := range sourceTypes {
 * 		related := r.typeRelatedToSomeType(sourceType, target, false /*reportErrors* /, IntersectionStateNone)
 * 		if related == TernaryFalse {
 * 			return TernaryFalse
 * 		}
 * 		result &= related
 * 	}
 * 	return result
 * }
 */
export function Relater_eachTypeRelatedToSomeType(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>): Ternary {
  let result: Ternary = TernaryTrue;
  const sourceTypes = Type_Types(source)!;
  for (const sourceType of sourceTypes) {
    const related = Relater_typeRelatedToSomeType(receiver, sourceType, target, false, IntersectionStateNone);
    if (related === TernaryFalse) {
      return TernaryFalse;
    }
    result = (result & related) as Ternary;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.recursiveTypeRelatedTo","kind":"method","status":"implemented","sigHash":"e71ff7d68c8861e10c2302487cf183cbc9dd88ef4067c2c256c0379dc62446e1","bodyHash":"852af6cc88977dc0170d97ae68dfc4679d47050c03a6dcdf19372653d37c80e3"}
 *
 * Go source:
 * func (r *Relater) recursiveTypeRelatedTo(source *Type, target *Type, reportErrors bool, intersectionState IntersectionState, recursionFlags RecursionFlags) Ternary {
 * 	if r.overflow {
 * 		return TernaryFalse
 * 	}
 * 	id, constrained := getRelationKey(source, target, intersectionState, r.relation == r.c.identityRelation, false /*ignoreConstraints* /)
 * 	if entry := r.relation.get(id); entry != RelationComparisonResultNone {
 * 		if reportErrors && entry&RelationComparisonResultFailed != 0 && entry&RelationComparisonResultOverflow == 0 {
 * 			// We are elaborating errors and the cached result is a failure not due to a comparison overflow,
 * 			// so we will do the comparison again to generate an error message.
 * 		} else {
 * 			r.c.reliabilityFlags |= entry & (RelationComparisonResultReportsUnmeasurable | RelationComparisonResultReportsUnreliable)
 * 			if reportErrors && entry&RelationComparisonResultOverflow != 0 {
 * 				message := core.IfElse(entry&RelationComparisonResultComplexityOverflow != 0,
 * 					diagnostics.Excessive_complexity_comparing_types_0_and_1,
 * 					diagnostics.Excessive_stack_depth_comparing_types_0_and_1)
 * 				r.reportError(message, r.c.TypeToString(source), r.c.TypeToString(target))
 * 			}
 * 			if entry&RelationComparisonResultSucceeded != 0 {
 * 				return TernaryTrue
 * 			}
 * 			return TernaryFalse
 * 		}
 * 	}
 * 	if r.relationCount <= 0 {
 * 		r.overflow = true
 * 		return TernaryFalse
 * 	}
 * 	// If source and target are already being compared, consider them related with assumptions
 * 	if r.maybeKeysSet.Has(id) {
 * 		return TernaryMaybe
 * 	}
 * 	// A constrained key indicates that we have type references that reference constrained
 * 	// type parameters. For such keys we also check against the key we would have gotten if all type parameters
 * 	// were unconstrained.
 * 	if constrained {
 * 		broadestEquivalentId, _ := getRelationKey(source, target, intersectionState, r.relation == r.c.identityRelation, true /*ignoreConstraints* /)
 * 		if r.maybeKeysSet.Has(broadestEquivalentId) {
 * 			return TernaryMaybe
 * 		}
 * 	}
 * 	if len(r.sourceStack) == 100 || len(r.targetStack) == 100 {
 * 		r.overflow = true
 * 		return TernaryFalse
 * 	}
 * 	maybeStart := len(r.maybeKeys)
 * 	r.maybeKeys = append(r.maybeKeys, id)
 * 	r.maybeKeysSet.Add(id)
 * 	saveExpandingFlags := r.expandingFlags
 * 	if recursionFlags&RecursionFlagsSource != 0 {
 * 		r.sourceStack = append(r.sourceStack, source)
 * 		if r.expandingFlags&ExpandingFlagsSource == 0 && r.c.isDeeplyNestedType(source, r.sourceStack, 3) {
 * 			r.expandingFlags |= ExpandingFlagsSource
 * 		}
 * 	}
 * 	if recursionFlags&RecursionFlagsTarget != 0 {
 * 		r.targetStack = append(r.targetStack, target)
 * 		if r.expandingFlags&ExpandingFlagsTarget == 0 && r.c.isDeeplyNestedType(target, r.targetStack, 3) {
 * 			r.expandingFlags |= ExpandingFlagsTarget
 * 		}
 * 	}
 * 	saveReliabilityFlags := r.c.reliabilityFlags
 * 	r.c.reliabilityFlags = 0
 * 	var result Ternary
 * 	if r.expandingFlags == ExpandingFlagsBoth {
 * 		if tr := r.c.tracer; tr != nil {
 * 			tr.Instant(tracing.PhaseCheckTypes, "recursiveTypeRelatedTo_DepthLimit", map[string]any{"sourceId": source.id, "targetId": target.id, "depth": len(r.sourceStack), "targetDepth": len(r.targetStack)})
 * 		}
 * 		result = TernaryMaybe
 * 	} else {
 * 		if tr := r.c.tracer; tr != nil {
 * 			defer tr.Push(tracing.PhaseCheckTypes, "structuredTypeRelatedTo", map[string]any{"sourceId": source.id, "targetId": target.id}, false)()
 * 		}
 * 		result = r.structuredTypeRelatedTo(source, target, reportErrors, intersectionState)
 * 	}
 * 	propagatingVarianceFlags := r.c.reliabilityFlags
 * 	r.c.reliabilityFlags |= saveReliabilityFlags
 * 	if recursionFlags&RecursionFlagsSource != 0 {
 * 		r.sourceStack = r.sourceStack[:len(r.sourceStack)-1]
 * 	}
 * 	if recursionFlags&RecursionFlagsTarget != 0 {
 * 		r.targetStack = r.targetStack[:len(r.targetStack)-1]
 * 	}
 * 	r.expandingFlags = saveExpandingFlags
 * 	if result != TernaryFalse {
 * 		if result == TernaryTrue || (len(r.sourceStack) == 0 && len(r.targetStack) == 0) {
 * 			if result == TernaryTrue || result == TernaryMaybe {
 * 				// If result is definitely true, record all maybe keys as having succeeded. Also, record Ternary.Maybe
 * 				// results as having succeeded once we reach depth 0, but never record Ternary.Unknown results.
 * 				r.resetMaybeStack(maybeStart, propagatingVarianceFlags, true)
 * 			} else {
 * 				r.resetMaybeStack(maybeStart, propagatingVarianceFlags, false)
 * 			}
 * 		}
 * 		// Note: it's intentional that we don't reset in the else case;
 * 		// we leave them on the stack such that when we hit depth zero
 * 		// above, we can report all of them as successful.
 * 	} else {
 * 		// A false result goes straight into global cache (when something is false under
 * 		// assumptions it will also be false without assumptions)
 * 		r.relation.set(id, RelationComparisonResultFailed|propagatingVarianceFlags)
 * 		r.relationCount--
 * 		r.resetMaybeStack(maybeStart, propagatingVarianceFlags, false)
 * 	}
 * 	return result
 * }
 */
export function Relater_recursiveTypeRelatedTo(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, reportErrors: bool, intersectionState: IntersectionState, recursionFlags: RecursionFlags): Ternary {
  if (receiver!.overflow) {
    return TernaryFalse;
  }
  const [id, constrained] = getRelationKey(source, target, intersectionState, receiver!.relation === receiver!.c!.identityRelation, false);
  const entry = Relation_get(receiver!.relation, id);
  if (entry !== RelationComparisonResultNone) {
    if (reportErrors && (entry & RelationComparisonResultFailed) !== 0 && (entry & RelationComparisonResultOverflow) === 0) {
      // Elaborate errors: do the comparison again
    } else {
      receiver!.c!.reliabilityFlags = (receiver!.c!.reliabilityFlags | (entry & (RelationComparisonResultReportsUnmeasurable | RelationComparisonResultReportsUnreliable))) as RelationComparisonResult;
      if (reportErrors && (entry & RelationComparisonResultOverflow) !== 0) {
        const message = (entry & RelationComparisonResultComplexityOverflow) !== 0 ? Excessive_complexity_comparing_types_0_and_1 : Excessive_stack_depth_comparing_types_0_and_1;
        Relater_reportError(receiver, message, Checker_TypeToString(receiver!.c, source), Checker_TypeToString(receiver!.c, target));
      }
      if ((entry & RelationComparisonResultSucceeded) !== 0) {
        return TernaryTrue;
      }
      return TernaryFalse;
    }
  }
  if (receiver!.relationCount <= 0) {
    receiver!.overflow = true;
    return TernaryFalse;
  }
  if (Set_Has(receiver!.maybeKeysSet, id)) {
    return TernaryMaybe;
  }
  if (constrained) {
    const [broadestEquivalentId] = getRelationKey(source, target, intersectionState, receiver!.relation === receiver!.c!.identityRelation, true);
    if (Set_Has(receiver!.maybeKeysSet, broadestEquivalentId)) {
      return TernaryMaybe;
    }
  }
  if (receiver!.sourceStack.length === 100 || receiver!.targetStack.length === 100) {
    receiver!.overflow = true;
    return TernaryFalse;
  }
  const maybeStart = receiver!.maybeKeys.length;
  receiver!.maybeKeys = [...receiver!.maybeKeys, id];
  Set_Add(receiver!.maybeKeysSet, id);
  const saveExpandingFlags = receiver!.expandingFlags;
  if ((recursionFlags & RecursionFlagsSource) !== 0) {
    receiver!.sourceStack = [...receiver!.sourceStack, source];
    if ((receiver!.expandingFlags & ExpandingFlagsSource) === 0 && Checker_isDeeplyNestedType(receiver!.c, source, receiver!.sourceStack, 3)) {
      receiver!.expandingFlags = (receiver!.expandingFlags | ExpandingFlagsSource) as ExpandingFlags;
    }
  }
  if ((recursionFlags & RecursionFlagsTarget) !== 0) {
    receiver!.targetStack = [...receiver!.targetStack, target];
    if ((receiver!.expandingFlags & ExpandingFlagsTarget) === 0 && Checker_isDeeplyNestedType(receiver!.c, target, receiver!.targetStack, 3)) {
      receiver!.expandingFlags = (receiver!.expandingFlags | ExpandingFlagsTarget) as ExpandingFlags;
    }
  }
  const saveReliabilityFlags = receiver!.c!.reliabilityFlags;
  receiver!.c!.reliabilityFlags = RelationComparisonResultNone as RelationComparisonResult;
  let result: Ternary;
  if (receiver!.expandingFlags === ExpandingFlagsBoth) {
    result = TernaryMaybe;
  } else {
    result = Relater_structuredTypeRelatedTo(receiver, source, target, reportErrors, intersectionState);
  }
  const propagatingVarianceFlags = receiver!.c!.reliabilityFlags;
  receiver!.c!.reliabilityFlags = (receiver!.c!.reliabilityFlags | saveReliabilityFlags) as RelationComparisonResult;
  if ((recursionFlags & RecursionFlagsSource) !== 0) {
    receiver!.sourceStack = receiver!.sourceStack.slice(0, receiver!.sourceStack.length - 1);
  }
  if ((recursionFlags & RecursionFlagsTarget) !== 0) {
    receiver!.targetStack = receiver!.targetStack.slice(0, receiver!.targetStack.length - 1);
  }
  receiver!.expandingFlags = saveExpandingFlags;
  if (result !== TernaryFalse) {
    if (result === TernaryTrue || (receiver!.sourceStack.length === 0 && receiver!.targetStack.length === 0)) {
      if (result === TernaryTrue || result === TernaryMaybe) {
        Relater_resetMaybeStack(receiver, maybeStart, propagatingVarianceFlags, true);
      } else {
        Relater_resetMaybeStack(receiver, maybeStart, propagatingVarianceFlags, false);
      }
    }
  } else {
    Relation_set(receiver!.relation, id, (RelationComparisonResultFailed | propagatingVarianceFlags) as RelationComparisonResult);
    receiver!.relationCount--;
    Relater_resetMaybeStack(receiver, maybeStart, propagatingVarianceFlags, false);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.resetMaybeStack","kind":"method","status":"implemented","sigHash":"4c33dc76350815f0f06deedb8c2591e6816b929a502e600271fcbaadeeb06e09","bodyHash":"811fdaf858af9859be134c0986e1f7cd4a350a727315646814e29277a733b8a9"}
 *
 * Go source:
 * func (r *Relater) resetMaybeStack(maybeStart int, propagatingVarianceFlags RelationComparisonResult, markAllAsSucceeded bool) {
 * 	for i := maybeStart; i < len(r.maybeKeys); i++ {
 * 		r.maybeKeysSet.Delete(r.maybeKeys[i])
 * 		if markAllAsSucceeded {
 * 			r.relation.set(r.maybeKeys[i], RelationComparisonResultSucceeded|propagatingVarianceFlags)
 * 			r.relationCount--
 * 		}
 * 	}
 * 	r.maybeKeys = r.maybeKeys[:maybeStart]
 * }
 */
export function Relater_resetMaybeStack(receiver: GoPtr<Relater>, maybeStart: int, propagatingVarianceFlags: RelationComparisonResult, markAllAsSucceeded: bool): void {
  for (let i = maybeStart; i < receiver!.maybeKeys.length; i++) {
    Set_Delete(receiver!.maybeKeysSet, receiver!.maybeKeys[i]!);
    if (markAllAsSucceeded) {
      Relation_set(receiver!.relation, receiver!.maybeKeys[i]!, (RelationComparisonResultSucceeded | propagatingVarianceFlags) as RelationComparisonResult);
      receiver!.relationCount--;
    }
  }
  receiver!.maybeKeys = receiver!.maybeKeys.slice(0, maybeStart);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.getErrorState","kind":"method","status":"implemented","sigHash":"1e5e362e6bb6134f4fef28eb366ccf056d780eb4ee393550b5a70b595e88a1cd","bodyHash":"481369c4fa0b74fd5e81c3e85d13f046ceec720fbd4d7df73fa5a6971f6519af"}
 *
 * Go source:
 * func (r *Relater) getErrorState() errorState {
 * 	return errorState{
 * 		errorChain:  r.errorChain,
 * 		relatedInfo: r.relatedInfo,
 * 	}
 * }
 */
export function Relater_getErrorState(receiver: GoPtr<Relater>): errorState {
  return { errorChain: receiver!.errorChain, relatedInfo: receiver!.relatedInfo } as errorState;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.restoreErrorState","kind":"method","status":"implemented","sigHash":"7ccde45945f4061916b5cead8f01677c1615737c5f1bd8ae1e0aaa3e41ab0bc2","bodyHash":"2b33b785ba82584e374e25eab3e58ab41996ab6bd599aba6e078df4e214c4fbd"}
 *
 * Go source:
 * func (r *Relater) restoreErrorState(e errorState) {
 * 	r.errorChain = e.errorChain
 * 	r.relatedInfo = e.relatedInfo
 * }
 */
export function Relater_restoreErrorState(receiver: GoPtr<Relater>, e: errorState): void {
  receiver!.errorChain = e.errorChain;
  receiver!.relatedInfo = e.relatedInfo;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.structuredTypeRelatedTo","kind":"method","status":"implemented","sigHash":"401d2ac3ee7b8c5a5a8f2cf9d1aef9979c40808c2a983247187f3216b3cfe99c","bodyHash":"5fa2acb43c642c7b1c8443e654787d96a3fd597f12bb520195d0131d64498937"}
 *
 * Go source:
 * func (r *Relater) structuredTypeRelatedTo(source *Type, target *Type, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	saveErrorState := r.getErrorState()
 * 	result := r.structuredTypeRelatedToWorker(source, target, reportErrors, intersectionState)
 * 	if r.relation != r.c.identityRelation {
 * 		// The combined constraint of an intersection type is the intersection of the constraints of
 * 		// the constituents. When an intersection type contains instantiable types with union type
 * 		// constraints, there are situations where we need to examine the combined constraint. One is
 * 		// when the target is a union type. Another is when the intersection contains types belonging
 * 		// to one of the disjoint domains. For example, given type variables T and U, each with the
 * 		// constraint 'string | number', the combined constraint of 'T & U' is 'string | number' and
 * 		// we need to check this constraint against a union on the target side. Also, given a type
 * 		// variable V constrained to 'string | number', 'V & number' has a combined constraint of
 * 		// 'string & number | number & number' which reduces to just 'number'.
 * 		// This also handles type parameters, as a type parameter with a union constraint compared against a union
 * 		// needs to have its constraint hoisted into an intersection with said type parameter, this way
 * 		// the type param can be compared with itself in the target (with the influence of its constraint to match other parts)
 * 		// For example, if `T extends 1 | 2` and `U extends 2 | 3` and we compare `T & U` to `T & U & (1 | 2 | 3)`
 * 		if result == TernaryFalse && (source.flags&TypeFlagsIntersection != 0 || source.flags&TypeFlagsTypeParameter != 0 && target.flags&TypeFlagsUnion != 0) {
 * 			var sourceTypes []*Type
 * 			if source.flags&TypeFlagsIntersection != 0 {
 * 				sourceTypes = source.Types()
 * 			} else {
 * 				sourceTypes = []*Type{source}
 * 			}
 * 			constraint := r.c.getEffectiveConstraintOfIntersection(sourceTypes, target.flags&TypeFlagsUnion != 0)
 * 			if constraint != nil && everyType(constraint, func(c *Type) bool { return c != source }) {
 * 				// TODO: Stack errors so we get a pyramid for the "normal" comparison above, _and_ a second for this
 * 				result = r.isRelatedToEx(constraint, target, RecursionFlagsSource, false /*reportErrors* /, nil /*headMessage* /, intersectionState)
 * 			}
 * 		}
 * 		switch {
 * 		// When the target is an intersection we need an extra property check in order to detect nested excess
 * 		// properties and nested weak types. The following are motivating examples that all should be errors, but
 * 		// aren't without this extra property check:
 * 		//
 * 		//   let obj: { a: { x: string } } & { c: number } = { a: { x: 'hello', y: 2 }, c: 5 };  // Nested excess property
 * 		//
 * 		//   declare let wrong: { a: { y: string } };
 * 		//   let weak: { a?: { x?: number } } & { c?: string } = wrong;  // Nested weak object type
 * 		//
 * 		case result != TernaryFalse && intersectionState&IntersectionStateTarget == 0 && target.flags&TypeFlagsIntersection != 0 && !r.c.isGenericObjectType(target) && source.flags&(TypeFlagsObject|TypeFlagsIntersection) != 0:
 * 			result &= r.propertiesRelatedTo(source, target, reportErrors, collections.Set[string]{} /*excludedProperties* /, false /*optionalsOnly* /, IntersectionStateNone)
 * 			if result != 0 && isObjectLiteralType(source) && source.objectFlags&ObjectFlagsFreshLiteral != 0 {
 * 				result &= r.indexSignaturesRelatedTo(source, target, false /*sourceIsPrimitive* /, reportErrors, IntersectionStateNone)
 * 			}
 * 		// When the source is an intersection we need an extra check of any optional properties in the target to
 * 		// detect possible mismatched property types. For example:
 * 		//
 * 		//   function foo<T extends object>(x: { a?: string }, y: T & { a: boolean }) {
 * 		//     x = y;  // Mismatched property in source intersection
 * 		//   }
 * 		//
 * 		case result != 0 && r.c.isNonGenericObjectType(target) && !r.c.isArrayOrTupleType(target) && r.isSourceIntersectionNeedingExtraCheck(source, target):
 * 			result &= r.propertiesRelatedTo(source, target, reportErrors, collections.Set[string]{} /*excludedProperties* /, true /*optionalsOnly* /, intersectionState)
 * 		}
 * 	}
 * 	if result != TernaryFalse {
 * 		r.restoreErrorState(saveErrorState)
 * 	}
 * 	return result
 * }
 */
export function Relater_structuredTypeRelatedTo(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  const saveErrorState = Relater_getErrorState(receiver);
  let result = Relater_structuredTypeRelatedToWorker(receiver, source, target, reportErrors, intersectionState);
  if (receiver!.relation !== receiver!.c!.identityRelation) {
    if (result === TernaryFalse && ((source!.flags & TypeFlagsIntersection) !== 0 || ((source!.flags & TypeFlagsTypeParameter) !== 0 && (target!.flags & TypeFlagsUnion) !== 0))) {
      const sourceTypes = (source!.flags & TypeFlagsIntersection) !== 0 ? Type_Types(source)! : [source];
      const constraint = Checker_getEffectiveConstraintOfIntersection(receiver!.c, sourceTypes, (target!.flags & TypeFlagsUnion) !== 0);
      if (constraint !== undefined && everyType(constraint, (constraintType: GoPtr<Type>) => constraintType !== source)) {
        result = Relater_isRelatedToEx(receiver, constraint, target, RecursionFlagsSource, false, undefined, intersectionState);
      }
    }
    if (
      result !== TernaryFalse &&
      (intersectionState & IntersectionStateTarget) === 0 &&
      (target!.flags & TypeFlagsIntersection) !== 0 &&
      !Checker_isGenericObjectType(receiver!.c, target) &&
      (source!.flags & (TypeFlagsObject | TypeFlagsIntersection)) !== 0
    ) {
      result = (result & Relater_propertiesRelatedTo(receiver, source, target, reportErrors, { M: new globalThis.Map<string, { readonly __tsgoEmpty?: never }>() }, false, IntersectionStateNone)) as Ternary;
      if (result !== TernaryFalse && isObjectLiteralType(source) && (source!.objectFlags & ObjectFlagsFreshLiteral) !== 0) {
        result = (result & Relater_indexSignaturesRelatedTo(receiver, source, target, false, reportErrors, IntersectionStateNone)) as Ternary;
      }
    } else if (
      result !== TernaryFalse &&
      Checker_isNonGenericObjectType(receiver!.c, target) &&
      !Checker_isArrayOrTupleType(receiver!.c, target) &&
      Relater_isSourceIntersectionNeedingExtraCheck(receiver, source, target)
    ) {
      result = (result & Relater_propertiesRelatedTo(receiver, source, target, reportErrors, { M: new globalThis.Map<string, { readonly __tsgoEmpty?: never }>() }, true, intersectionState)) as Ternary;
    }
  }
  if (result !== TernaryFalse) {
    Relater_restoreErrorState(receiver, saveErrorState);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.isSourceIntersectionNeedingExtraCheck","kind":"method","status":"implemented","sigHash":"2d6f881ab694fe6761cf6760e705cd9fc3ba39ab967539bd218a14b8c90a7057","bodyHash":"d13d507d7ebb0c2a5e95a4c02b485d4f2cc1e25caa60ee27e3c96c7079dcce14"}
 *
 * Go source:
 * func (r *Relater) isSourceIntersectionNeedingExtraCheck(source *Type, target *Type) bool {
 * 	return source.flags&TypeFlagsIntersection != 0 && r.c.getApparentType(source).flags&TypeFlagsStructuredType != 0 &&
 * 		!core.Some(source.Types(), func(t *Type) bool {
 * 			return t == target || t.objectFlags&ObjectFlagsNonInferrableType != 0
 * 		})
 * }
 */
export function Relater_isSourceIntersectionNeedingExtraCheck(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  return (
    (source!.flags & TypeFlagsIntersection) !== 0 &&
    (Checker_getApparentType(receiver!.c, source)!.flags & TypeFlagsStructuredType) !== 0 &&
    !Type_Types(source)!.some((t: GoPtr<Type>) => t === target || (t!.objectFlags & ObjectFlagsNonInferrableType) !== 0)
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.structuredTypeRelatedToWorker","kind":"method","status":"implemented","sigHash":"94c4638157c60e2e5f9611b831d75f6e5687f16814d8f142dafb264208625bcd","bodyHash":"9c4509856a03a7f263297770ec18f1e13f5935c104122a2e4656cfdcc925cf8e"}
 *
 * Go source:
 * func (r *Relater) structuredTypeRelatedToWorker(source *Type, target *Type, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	var result Ternary
 * 	var varianceCheckFailed bool
 * 	var originalErrorChain *ErrorChain
 * 	saveErrorState := r.getErrorState()
 * 	relateVariances := func(sourceTypeArguments []*Type, targetTypeArguments []*Type, variances []VarianceFlags, intersectionState IntersectionState) (Ternary, bool) {
 * 		if result = r.typeArgumentsRelatedTo(sourceTypeArguments, targetTypeArguments, variances, reportErrors, intersectionState); result != TernaryFalse {
 * 			return result, true
 * 		}
 * 		if core.Some(variances, func(v VarianceFlags) bool { return v&VarianceFlagsAllowsStructuralFallback != 0 }) {
 * 			// If some type parameter was `Unmeasurable` or `Unreliable`, and we couldn't pass by assuming it was identical, then we
 * 			// have to allow a structural fallback check
 * 			// We elide the variance-based error elaborations, since those might not be too helpful, since we'll potentially
 * 			// be assuming identity of the type parameter.
 * 			originalErrorChain = nil
 * 			r.restoreErrorState(saveErrorState)
 * 			return TernaryFalse, false
 * 		}
 * 		allowStructuralFallback := r.c.hasCovariantVoidArgument(targetTypeArguments, variances)
 * 		varianceCheckFailed = !allowStructuralFallback
 * 		// The type arguments did not relate appropriately, but it may be because we have no variance
 * 		// information (in which case typeArgumentsRelatedTo defaulted to covariance for all type
 * 		// arguments). It might also be the case that the target type has a 'void' type argument for
 * 		// a covariant type parameter that is only used in return positions within the generic type
 * 		// (in which case any type argument is permitted on the source side). In those cases we proceed
 * 		// with a structural comparison. Otherwise, we know for certain the instantiations aren't
 * 		// related and we can return here.
 * 		if len(variances) != 0 && !allowStructuralFallback {
 * 			// In some cases generic types that are covariant in regular type checking mode become
 * 			// invariant in --strictFunctionTypes mode because one or more type parameters are used in
 * 			// both co- and contravariant positions. In order to make it easier to diagnose *why* such
 * 			// types are invariant, if any of the type parameters are invariant we reset the reported
 * 			// errors and instead force a structural comparison (which will include elaborations that
 * 			// reveal the reason).
 * 			// We can switch on `reportErrors` here, since varianceCheckFailed guarantees we return `False`,
 * 			// we can return `False` early here to skip calculating the structural error message we don't need.
 * 			if varianceCheckFailed && !(reportErrors && core.Some(variances, func(v VarianceFlags) bool { return (v & VarianceFlagsVarianceMask) == VarianceFlagsInvariant })) {
 * 				return TernaryFalse, true
 * 			}
 * 			// We remember the original error information so we can restore it in case the structural
 * 			// comparison unexpectedly succeeds. This can happen when the structural comparison result
 * 			// is a Ternary.Maybe for example caused by the recursion depth limiter.
 * 			originalErrorChain = r.errorChain
 * 			r.restoreErrorState(saveErrorState)
 * 		}
 * 		return TernaryFalse, false
 * 	}
 * 	switch {
 * 	case r.relation == r.c.identityRelation:
 * 		// We've already checked that source.flags and target.flags are identical
 * 		switch {
 * 		case source.flags&TypeFlagsUnionOrIntersection != 0:
 * 			result := r.eachTypeRelatedToSomeType(source, target)
 * 			if result != TernaryFalse {
 * 				result &= r.eachTypeRelatedToSomeType(target, source)
 * 			}
 * 			return result
 * 		case source.flags&TypeFlagsIndex != 0:
 * 			return r.isRelatedTo(source.Target(), target.Target(), RecursionFlagsBoth, false /*reportErrors* /)
 * 		case source.flags&TypeFlagsIndexedAccess != 0:
 * 			result = r.isRelatedTo(source.AsIndexedAccessType().objectType, target.AsIndexedAccessType().objectType, RecursionFlagsBoth, false /*reportErrors* /)
 * 			if result != TernaryFalse {
 * 				result &= r.isRelatedTo(source.AsIndexedAccessType().indexType, target.AsIndexedAccessType().indexType, RecursionFlagsBoth, false /*reportErrors* /)
 * 				if result != TernaryFalse {
 * 					return result
 * 				}
 * 			}
 * 		case source.flags&TypeFlagsConditional != 0:
 * 			if source.AsConditionalType().root.isDistributive == target.AsConditionalType().root.isDistributive {
 * 				result = r.isRelatedTo(source.AsConditionalType().checkType, target.AsConditionalType().checkType, RecursionFlagsBoth, false /*reportErrors* /)
 * 				if result != TernaryFalse {
 * 					result &= r.isRelatedTo(source.AsConditionalType().extendsType, target.AsConditionalType().extendsType, RecursionFlagsBoth, false /*reportErrors* /)
 * 					if result != TernaryFalse {
 * 						result &= r.isRelatedTo(r.c.getTrueTypeFromConditionalType(source), r.c.getTrueTypeFromConditionalType(target), RecursionFlagsBoth, false /*reportErrors* /)
 * 						if result != TernaryFalse {
 * 							result &= r.isRelatedTo(r.c.getFalseTypeFromConditionalType(source), r.c.getFalseTypeFromConditionalType(target), RecursionFlagsBoth, false /*reportErrors* /)
 * 							if result != TernaryFalse {
 * 								return result
 * 							}
 * 						}
 * 					}
 * 				}
 * 			}
 * 		case source.flags&TypeFlagsSubstitution != 0:
 * 			result = r.isRelatedTo(source.AsSubstitutionType().baseType, target.AsSubstitutionType().baseType, RecursionFlagsBoth, false /*reportErrors* /)
 * 			if result != TernaryFalse {
 * 				result &= r.isRelatedTo(source.AsSubstitutionType().constraint, target.AsSubstitutionType().constraint, RecursionFlagsBoth, false /*reportErrors* /)
 * 				if result != TernaryFalse {
 * 					return result
 * 				}
 * 			}
 * 		case source.flags&TypeFlagsTemplateLiteral != 0:
 * 			if slices.Equal(source.AsTemplateLiteralType().texts, target.AsTemplateLiteralType().texts) {
 * 				result = TernaryTrue
 * 				for i, sourceType := range source.AsTemplateLiteralType().types {
 * 					targetType := target.AsTemplateLiteralType().types[i]
 * 					result &= r.isRelatedTo(sourceType, targetType, RecursionFlagsBoth, false /*reportErrors* /)
 * 					if result == TernaryFalse {
 * 						return result
 * 					}
 * 				}
 * 				return result
 * 			}
 * 		case source.flags&TypeFlagsStringMapping != 0:
 * 			if source.AsStringMappingType().Symbol() == target.AsStringMappingType().Symbol() {
 * 				return r.isRelatedTo(source.AsStringMappingType().target, target.AsStringMappingType().target, RecursionFlagsBoth, false /*reportErrors* /)
 * 			}
 * 		}
 * 		if source.flags&TypeFlagsObject == 0 {
 * 			return TernaryFalse
 * 		}
 * 	case source.flags&TypeFlagsUnionOrIntersection != 0 || target.flags&TypeFlagsUnionOrIntersection != 0:
 * 		result = r.unionOrIntersectionRelatedTo(source, target, reportErrors, intersectionState)
 * 		if result != TernaryFalse {
 * 			return result
 * 		}
 * 		// The ordered decomposition above doesn't handle all cases. Specifically, we also need to handle:
 * 		// Source is instantiable (e.g. source has union or intersection constraint).
 * 		// Source is an object, target is a union (e.g. { a, b: boolean } <=> { a, b: true } | { a, b: false }).
 * 		// Source is an intersection, target is an object (e.g. { a } & { b } <=> { a, b }).
 * 		// Source is an intersection, target is a union (e.g. { a } & { b: boolean } <=> { a, b: true } | { a, b: false }).
 * 		// Source is an intersection, target instantiable (e.g. string & { tag } <=> T["a"] constrained to string & { tag }).
 * 		if !(source.flags&TypeFlagsInstantiable != 0 ||
 * 			source.flags&TypeFlagsObject != 0 && target.flags&TypeFlagsUnion != 0 ||
 * 			source.flags&TypeFlagsIntersection != 0 && target.flags&(TypeFlagsObject|TypeFlagsUnion|TypeFlagsInstantiable) != 0) {
 * 			return TernaryFalse
 * 		}
 * 	}
 * 	// We limit alias variance probing to only object and conditional types since their alias behavior
 * 	// is more predictable than other, interned types, which may or may not have an alias depending on
 * 	// the order in which things were checked.
 * 	if source.flags&(TypeFlagsObject|TypeFlagsConditional) != 0 && source.alias != nil && len(source.alias.typeArguments) != 0 &&
 * 		target.alias != nil && source.alias.symbol == target.alias.symbol && !(r.c.isMarkerType(source) || r.c.isMarkerType(target)) {
 * 		variances := r.c.getAliasVariances(source.alias.symbol)
 * 		if len(variances) == 0 {
 * 			return TernaryUnknown
 * 		}
 * 		params := r.c.typeAliasLinks.Get(source.alias.symbol).typeParameters
 * 		minParams := r.c.getMinTypeArgumentCount(params)
 * 		nodeIsInJsFile := ast.IsInJSFile(source.alias.symbol.ValueDeclaration)
 * 		sourceTypes := r.c.fillMissingTypeArguments(source.alias.typeArguments, params, minParams, nodeIsInJsFile)
 * 		targetTypes := r.c.fillMissingTypeArguments(target.alias.typeArguments, params, minParams, nodeIsInJsFile)
 * 		varianceResult, ok := relateVariances(sourceTypes, targetTypes, variances, intersectionState)
 * 		if ok {
 * 			return varianceResult
 * 		}
 * 	}
 * 	// For a generic type T and a type U that is assignable to T, [...U] is assignable to T, U is assignable to readonly [...T],
 * 	// and U is assignable to [...T] when U is constrained to a mutable array or tuple type.
 * 	if isSingleElementGenericTupleType(source) && !source.TargetTupleType().readonly {
 * 		result = r.isRelatedTo(r.c.getTypeArguments(source)[0], target, RecursionFlagsSource, false /*reportErrors* /)
 * 		if result != TernaryFalse {
 * 			return result
 * 		}
 * 	}
 * 	if isSingleElementGenericTupleType(target) && (target.TargetTupleType().readonly || r.c.isMutableArrayOrTuple(r.c.getBaseConstraintOrType(source))) {
 * 		result = r.isRelatedTo(source, r.c.getTypeArguments(target)[0], RecursionFlagsTarget, false /*reportErrors* /)
 * 		if result != TernaryFalse {
 * 			return result
 * 		}
 * 	}
 * 	switch {
 * 	case target.flags&TypeFlagsTypeParameter != 0:
 * 		// A source type { [P in Q]: X } is related to a target type T if keyof T is related to Q and X is related to T[Q].
 * 		if source.objectFlags&ObjectFlagsMapped != 0 && source.AsMappedType().declaration.NameType == nil && r.isRelatedTo(r.c.getIndexType(target), r.c.getConstraintTypeFromMappedType(source), RecursionFlagsBoth, false) != TernaryFalse {
 * 			if getMappedTypeModifiers(source)&MappedTypeModifiersIncludeOptional == 0 {
 * 				templateType := r.c.getTemplateTypeFromMappedType(source)
 * 				indexedAccessType := r.c.getIndexedAccessType(target, r.c.getTypeParameterFromMappedType(source))
 * 				result = r.isRelatedTo(templateType, indexedAccessType, RecursionFlagsBoth, reportErrors)
 * 				if result != TernaryFalse {
 * 					return result
 * 				}
 * 			}
 * 		}
 * 		if r.relation == r.c.comparableRelation && source.flags&TypeFlagsTypeParameter != 0 {
 * 			// This is a carve-out in comparability to essentially forbid comparing a type parameter with another type parameter
 * 			// unless one extends the other. (Remember: comparability is mostly bidirectional!)
 * 			if constraint := r.c.getConstraintOfTypeParameter(source); constraint != nil && someType(constraint, func(c *Type) bool { return c.flags&TypeFlagsTypeParameter != 0 }) {
 * 				return r.isRelatedTo(constraint, target, RecursionFlagsSource, false /*reportErrors* /)
 * 			}
 * 			return TernaryFalse
 * 		}
 * 	case target.flags&TypeFlagsIndexedAccess != 0:
 * 		if source.flags&TypeFlagsIndexedAccess != 0 {
 * 			// Relate components directly before falling back to constraint relationships
 * 			// A type S[K] is related to a type T[J] if S is related to T and K is related to J.
 * 			result = r.isRelatedTo(source.AsIndexedAccessType().objectType, target.AsIndexedAccessType().objectType, RecursionFlagsBoth, reportErrors)
 * 			if result != TernaryFalse {
 * 				result &= r.isRelatedTo(source.AsIndexedAccessType().indexType, target.AsIndexedAccessType().indexType, RecursionFlagsBoth, reportErrors)
 * 			}
 * 			if result != TernaryFalse {
 * 				return result
 * 			}
 * 			if reportErrors {
 * 				originalErrorChain = r.errorChain
 * 			}
 * 		}
 * 		// A type S is related to a type T[K] if S is related to C, where C is the base
 * 		// constraint of T[K] for writing.
 * 		if r.relation == r.c.assignableRelation || r.relation == r.c.comparableRelation {
 * 			objectType := target.AsIndexedAccessType().objectType
 * 			indexType := target.AsIndexedAccessType().indexType
 * 			baseObjectType := r.c.getBaseConstraintOrType(objectType)
 * 			baseIndexType := r.c.getBaseConstraintOrType(indexType)
 * 			if !r.c.isGenericObjectType(baseObjectType) && !r.c.isGenericIndexType(baseIndexType) {
 * 				accessFlags := AccessFlagsWriting | (core.IfElse(baseObjectType != objectType, AccessFlagsNoIndexSignatures, 0))
 * 				constraint := r.c.getIndexedAccessTypeOrUndefined(baseObjectType, baseIndexType, accessFlags, nil, nil)
 * 				if constraint != nil {
 * 					if reportErrors && originalErrorChain != nil {
 * 						// create a new chain for the constraint error
 * 						r.restoreErrorState(saveErrorState)
 * 					}
 * 					result = r.isRelatedToEx(source, constraint, RecursionFlagsTarget, reportErrors, nil /*headMessage* /, intersectionState)
 * 					if result != TernaryFalse {
 * 						return result
 * 					}
 * 					// prefer the shorter chain of the constraint comparison chain, and the direct comparison chain
 * 					if reportErrors && originalErrorChain != nil && r.errorChain != nil {
 * 						if chainDepth(originalErrorChain) <= chainDepth(r.errorChain) {
 * 							r.errorChain = originalErrorChain
 * 						}
 * 					}
 * 				}
 * 			}
 * 		}
 * 		if reportErrors {
 * 			originalErrorChain = nil
 * 		}
 * 	case target.flags&TypeFlagsIndex != 0:
 * 		targetType := target.AsIndexType().target
 * 		// A keyof S is related to a keyof T if T is related to S.
 * 		if source.flags&TypeFlagsIndex != 0 {
 * 			result = r.isRelatedTo(targetType, source.AsIndexType().target, RecursionFlagsBoth, false /*reportErrors* /)
 * 			if result != TernaryFalse {
 * 				return result
 * 			}
 * 		}
 * 		if isTupleType(targetType) {
 * 			// An index type can have a tuple type target when the tuple type contains variadic elements.
 * 			// Check if the source is related to the known keys of the tuple type.
 * 			result = r.isRelatedTo(source, r.c.getKnownKeysOfTupleType(targetType), RecursionFlagsTarget, reportErrors)
 * 			if result != TernaryFalse {
 * 				return result
 * 			}
 * 		} else {
 * 			// A type S is assignable to keyof T if S is assignable to keyof C, where C is the
 * 			// simplified form of T or, if T doesn't simplify, the constraint of T.
 * 			constraint := r.c.getSimplifiedTypeOrConstraint(targetType)
 * 			if constraint != nil {
 * 				// We require Ternary.True here such that circular constraints don't cause
 * 				// false positives. For example, given 'T extends { [K in keyof T]: string }',
 * 				// 'keyof T' has itself as its constraint and produces a Ternary.Maybe when
 * 				// related to other types.
 * 				if r.isRelatedTo(source, r.c.getIndexTypeEx(constraint, target.AsIndexType().indexFlags|IndexFlagsNoReducibleCheck), RecursionFlagsTarget, reportErrors) == TernaryTrue {
 * 					return TernaryTrue
 * 				}
 * 			} else if r.c.isGenericMappedType(targetType) {
 * 				// generic mapped types that don't simplify or have a constraint still have a very simple set of keys we can compare against
 * 				// - their nameType or constraintType.
 * 				// In many ways, this comparison is a deferred version of what `getIndexTypeForMappedType` does to actually resolve the keys for _non_-generic types
 * 				nameType := r.c.getNameTypeFromMappedType(targetType)
 * 				constraintType := r.c.getConstraintTypeFromMappedType(targetType)
 * 				var targetKeys *Type
 * 				if nameType != nil && r.c.isMappedTypeWithKeyofConstraintDeclaration(targetType) {
 * 					// we need to get the apparent mappings and union them with the generic mappings, since some properties may be
 * 					// missing from the `constraintType` which will otherwise be mapped in the object
 * 					mappedKeys := r.c.getApparentMappedTypeKeys(nameType, targetType)
 * 					// We still need to include the non-apparent (and thus still generic) keys in the target side of the comparison (in case they're in the source side)
 * 					targetKeys = r.c.getUnionType([]*Type{mappedKeys, nameType})
 * 				} else if nameType != nil {
 * 					targetKeys = nameType
 * 				} else {
 * 					targetKeys = constraintType
 * 				}
 * 				if r.isRelatedTo(source, targetKeys, RecursionFlagsTarget, reportErrors) == TernaryTrue {
 * 					return TernaryTrue
 * 				}
 * 			}
 * 		}
 * 	case target.flags&TypeFlagsConditional != 0:
 * 		// If we reach 10 levels of nesting for the same conditional type, assume it is an infinitely expanding recursive
 * 		// conditional type and bail out with a Ternary.Maybe result.
 * 		if r.c.isDeeplyNestedType(target, r.targetStack, 10) {
 * 			return TernaryMaybe
 * 		}
 * 		c := target.AsConditionalType()
 * 		// We check for a relationship to a conditional type target only when the conditional type has no
 * 		// 'infer' positions, is not distributive or is distributive but doesn't reference the check type
 * 		// parameter in either of the result types, and the source isn't an instantiation of the same
 * 		// conditional type (as happens when computing variance).
 * 		if c.root.inferTypeParameters == nil && !r.c.isDistributionDependent(c.root) && !(source.flags&TypeFlagsConditional != 0 && source.AsConditionalType().root == c.root) {
 * 			// Check if the conditional is always true or always false but still deferred for distribution purposes.
 * 			skipTrue := !r.c.isTypeAssignableTo(r.c.getPermissiveInstantiation(c.checkType), r.c.getPermissiveInstantiation(c.extendsType))
 * 			skipFalse := !skipTrue && r.c.isTypeAssignableTo(r.c.getRestrictiveInstantiation(c.checkType), r.c.getRestrictiveInstantiation(c.extendsType))
 * 			// TODO: Find a nice way to include potential conditional type breakdowns in error output, if they seem good (they usually don't)
 * 			if skipTrue {
 * 				result = TernaryTrue
 * 			} else {
 * 				result = r.isRelatedToEx(source, r.c.getTrueTypeFromConditionalType(target), RecursionFlagsTarget, false /*reportErrors* /, nil /*headMessage* /, intersectionState)
 * 			}
 * 			if result != TernaryFalse {
 * 				if skipFalse {
 * 					result &= TernaryTrue
 * 				} else {
 * 					result &= r.isRelatedToEx(source, r.c.getFalseTypeFromConditionalType(target), RecursionFlagsTarget, false /*reportErrors* /, nil /*headMessage* /, intersectionState)
 * 				}
 * 				if result != TernaryFalse {
 * 					return result
 * 				}
 * 			}
 * 		}
 * 	case target.flags&TypeFlagsTemplateLiteral != 0:
 * 		if source.flags&TypeFlagsTemplateLiteral != 0 {
 * 			if r.relation == r.c.comparableRelation {
 * 				if r.c.templateLiteralTypesDefinitelyUnrelated(source.AsTemplateLiteralType(), target.AsTemplateLiteralType()) {
 * 					return TernaryFalse
 * 				}
 * 				return TernaryTrue
 * 			}
 * 			// Report unreliable variance for type variables referenced in template literal type placeholders.
 * 			// For example, `foo-${number}` is related to `foo-${string}` even though number isn't related to string.
 * 			r.c.instantiateType(source, r.c.reportUnreliableMapper)
 * 		}
 * 		if r.c.isTypeMatchedByTemplateLiteralType(source, target.AsTemplateLiteralType(), r.isRelatedToWorker) {
 * 			return TernaryTrue
 * 		}
 * 	case target.flags&TypeFlagsStringMapping != 0:
 * 		if source.flags&TypeFlagsStringMapping == 0 {
 * 			if r.c.isMemberOfStringMapping(source, target) {
 * 				return TernaryTrue
 * 			}
 * 		}
 * 	case r.c.isGenericMappedType(target) && r.relation != r.c.identityRelation:
 * 		// Check if source type `S` is related to target type `{ [P in Q]: T }` or `{ [P in Q as R]: T}`.
 * 		keysRemapped := target.AsMappedType().declaration.NameType != nil
 * 		templateType := r.c.getTemplateTypeFromMappedType(target)
 * 		modifiers := getMappedTypeModifiers(target)
 * 		if modifiers&MappedTypeModifiersExcludeOptional == 0 {
 * 			// If the mapped type has shape `{ [P in Q]: T[P] }`,
 * 			// source `S` is related to target if `T` = `S`, i.e. `S` is related to `{ [P in Q]: S[P] }`.
 * 			if !keysRemapped && templateType.flags&TypeFlagsIndexedAccess != 0 && templateType.AsIndexedAccessType().objectType == source && templateType.AsIndexedAccessType().indexType == r.c.getTypeParameterFromMappedType(target) {
 * 				return TernaryTrue
 * 			}
 * 			if !r.c.isGenericMappedType(source) {
 * 				// If target has shape `{ [P in Q as R]: T}`, then its keys have type `R`.
 * 				// If target has shape `{ [P in Q]: T }`, then its keys have type `Q`.
 * 				var targetKeys *Type
 * 				if keysRemapped {
 * 					targetKeys = r.c.getNameTypeFromMappedType(target)
 * 				} else {
 * 					targetKeys = r.c.getConstraintTypeFromMappedType(target)
 * 				}
 * 				// Type of the keys of source type `S`, i.e. `keyof S`.
 * 				sourceKeys := r.c.getIndexTypeEx(source, IndexFlagsNoIndexSignatures)
 * 				includeOptional := modifiers&MappedTypeModifiersIncludeOptional != 0
 * 				var filteredByApplicability *Type
 * 				if includeOptional {
 * 					filteredByApplicability = r.c.intersectTypes(targetKeys, sourceKeys)
 * 				}
 * 				// A source type `S` is related to a target type `{ [P in Q]: T }` if `Q` is related to `keyof S` and `S[Q]` is related to `T`.
 * 				// A source type `S` is related to a target type `{ [P in Q as R]: T }` if `R` is related to `keyof S` and `S[R]` is related to `T.
 * 				// A source type `S` is related to a target type `{ [P in Q]?: T }` if some constituent `Q'` of `Q` is related to `keyof S` and `S[Q']` is related to `T`.
 * 				// A source type `S` is related to a target type `{ [P in Q as R]?: T }` if some constituent `R'` of `R` is related to `keyof S` and `S[R']` is related to `T`.
 * 				if includeOptional && filteredByApplicability.flags&TypeFlagsNever == 0 || !includeOptional && r.isRelatedTo(targetKeys, sourceKeys, RecursionFlagsBoth, false) != TernaryFalse {
 * 					templateType := r.c.getTemplateTypeFromMappedType(target)
 * 					typeParameter := r.c.getTypeParameterFromMappedType(target)
 * 					// Fastpath: When the template type has the form `Obj[P]` where `P` is the mapped type parameter, directly compare source `S` with `Obj`
 * 					// to avoid creating the (potentially very large) number of new intermediate types made by manufacturing `S[P]`.
 * 					nonNullComponent := r.c.extractTypesOfKind(templateType, ^TypeFlagsNullable)
 * 					if !keysRemapped && nonNullComponent.flags&TypeFlagsIndexedAccess != 0 && nonNullComponent.AsIndexedAccessType().indexType == typeParameter {
 * 						result = r.isRelatedTo(source, nonNullComponent.AsIndexedAccessType().objectType, RecursionFlagsTarget, reportErrors)
 * 						if result != TernaryFalse {
 * 							return result
 * 						}
 * 					} else {
 * 						// We need to compare the type of a property on the source type `S` to the type of the same property on the target type,
 * 						// so we need to construct an indexing type representing a property, and then use indexing type to index the source type for comparison.
 * 						// If the target type has shape `{ [P in Q]: T }`, then a property of the target has type `P`.
 * 						// If the target type has shape `{ [P in Q]?: T }`, then a property of the target has type `P`,
 * 						// but the property is optional, so we only want to compare properties `P` that are common between `keyof S` and `Q`.
 * 						// If the target type has shape `{ [P in Q as R]: T }`, then a property of the target has type `R`.
 * 						// If the target type has shape `{ [P in Q as R]?: T }`, then a property of the target has type `R`,
 * 						// but the property is optional, so we only want to compare properties `R` that are common between `keyof S` and `R`.
 * 						indexingType := typeParameter
 * 						switch {
 * 						case keysRemapped:
 * 							indexingType = core.OrElse(filteredByApplicability, targetKeys)
 * 						case filteredByApplicability != nil:
 * 							indexingType = r.c.getIntersectionType([]*Type{filteredByApplicability, typeParameter})
 * 						}
 * 						indexedAccessType := r.c.getIndexedAccessType(source, indexingType)
 * 						// Compare `S[indexingType]` to `T`, where `T` is the type of a property of the target type.
 * 						result = r.isRelatedTo(indexedAccessType, templateType, RecursionFlagsBoth, reportErrors)
 * 						if result != TernaryFalse {
 * 							return result
 * 						}
 * 					}
 * 				}
 * 				originalErrorChain = r.errorChain
 * 				r.restoreErrorState(saveErrorState)
 * 			}
 * 		}
 * 	}
 * 	switch {
 * 	case source.flags&TypeFlagsTypeVariable != 0:
 * 		// IndexedAccess comparisons are handled above in the `target.flags&TypeFlagsIndexedAccess` branch
 * 		if source.flags&TypeFlagsIndexedAccess == 0 || target.flags&TypeFlagsIndexedAccess == 0 {
 * 			constraint := r.c.getConstraintOfType(source)
 * 			if constraint == nil {
 * 				constraint = r.c.unknownType
 * 			}
 * 			// hi-speed no-this-instantiation check (less accurate, but avoids costly `this`-instantiation when the constraint will suffice), see #28231 for report on why this is needed
 * 			result = r.isRelatedToEx(constraint, target, RecursionFlagsSource, false /*reportErrors* /, nil /*headMessage* /, intersectionState)
 * 			if result != TernaryFalse {
 * 				return result
 * 			}
 * 			constraintWithThis := r.c.getTypeWithThisArgument(constraint, source, false /*needApparentType* /)
 * 			result = r.isRelatedToEx(constraintWithThis, target, RecursionFlagsSource, reportErrors && constraint != r.c.unknownType && target.flags&source.flags&TypeFlagsTypeParameter == 0, nil /*headMessage* /, intersectionState)
 * 			if result != TernaryFalse {
 * 				return result
 * 			}
 * 			if r.c.isMappedTypeGenericIndexedAccess(source) {
 * 				// For an indexed access type { [P in K]: E}[X], above we have already explored an instantiation of E with X
 * 				// substituted for P. We also want to explore type { [P in K]: E }[C], where C is the constraint of X.
 * 				indexConstraint := r.c.getConstraintOfType(source.AsIndexedAccessType().indexType)
 * 				if indexConstraint != nil {
 * 					result = r.isRelatedTo(r.c.getIndexedAccessType(source.AsIndexedAccessType().objectType, indexConstraint), target, RecursionFlagsSource, reportErrors)
 * 					if result != TernaryFalse {
 * 						return result
 * 					}
 * 				}
 * 			}
 * 		}
 * 	case source.flags&TypeFlagsIndex != 0:
 * 		isDeferredMappedIndex := r.c.shouldDeferIndexType(source.AsIndexType().target, source.AsIndexType().indexFlags) && source.AsIndexType().target.objectFlags&ObjectFlagsMapped != 0
 * 		result = r.isRelatedTo(r.c.stringNumberSymbolType, target, RecursionFlagsSource, reportErrors && !isDeferredMappedIndex)
 * 		if result != TernaryFalse {
 * 			return result
 * 		}
 * 		if isDeferredMappedIndex {
 * 			mappedType := source.AsIndexType().target
 * 			nameType := r.c.getNameTypeFromMappedType(mappedType)
 * 			// Unlike on the target side, on the source side we do *not* include the generic part of the `nameType`, since that comes from a
 * 			// (potentially anonymous) mapped type local type parameter, so that'd never assign outside the mapped type body, but we still want to
 * 			// allow assignments of index types of identical (or similar enough) mapped types.
 * 			// eg, `keyof {[X in keyof A]: Obj[X]}` should be assignable to `keyof {[Y in keyof A]: Tup[Y]}` because both map over the same set of keys (`keyof A`).
 * 			// Without this source-side breakdown, a `keyof {[X in keyof A]: Obj[X]}` style type won't be assignable to anything except itself, which is much too strict.
 * 			var sourceMappedKeys *Type
 * 			if nameType != nil && r.c.isMappedTypeWithKeyofConstraintDeclaration(mappedType) {
 * 				sourceMappedKeys = r.c.getApparentMappedTypeKeys(nameType, mappedType)
 * 			} else if nameType != nil {
 * 				sourceMappedKeys = nameType
 * 			} else {
 * 				sourceMappedKeys = r.c.getConstraintTypeFromMappedType(mappedType)
 * 			}
 * 			result = r.isRelatedTo(sourceMappedKeys, target, RecursionFlagsSource, reportErrors)
 * 			if result != TernaryFalse {
 * 				return result
 * 			}
 * 		}
 * 	case source.flags&TypeFlagsConditional != 0:
 * 		// If we reach 10 levels of nesting for the same conditional type, assume it is an infinitely expanding recursive
 * 		// conditional type and bail out with a Ternary.Maybe result.
 * 		if r.c.isDeeplyNestedType(source, r.sourceStack, 10) {
 * 			return TernaryMaybe
 * 		}
 * 		if target.flags&TypeFlagsConditional != 0 {
 * 			// Two conditional types 'T1 extends U1 ? X1 : Y1' and 'T2 extends U2 ? X2 : Y2' are related if
 * 			// one of T1 and T2 is related to the other, U1 and U2 are identical types, X1 is related to X2,
 * 			// and Y1 is related to Y2.
 * 			sourceParams := source.AsConditionalType().root.inferTypeParameters
 * 			sourceExtends := source.AsConditionalType().extendsType
 * 			var mapper *TypeMapper
 * 			if len(sourceParams) != 0 {
 * 				// If the source has infer type parameters, we instantiate them in the context of the target
 * 				ctx := r.c.newInferenceContext(sourceParams, nil /*signature* /, InferenceFlagsNone, r.isRelatedToWorker)
 * 				r.c.inferTypes(ctx.inferences, target.AsConditionalType().extendsType, sourceExtends, InferencePriorityNoConstraints|InferencePriorityAlwaysStrict, false)
 * 				sourceExtends = r.c.instantiateType(sourceExtends, ctx.mapper)
 * 				mapper = ctx.mapper
 * 			}
 * 			if r.c.isTypeIdenticalTo(sourceExtends, target.AsConditionalType().extendsType) && (r.isRelatedTo(source.AsConditionalType().checkType, target.AsConditionalType().checkType, RecursionFlagsBoth, false) != 0 || r.isRelatedTo(target.AsConditionalType().checkType, source.AsConditionalType().checkType, RecursionFlagsBoth, false) != 0) {
 * 				result = r.isRelatedTo(r.c.instantiateType(r.c.getTrueTypeFromConditionalType(source), mapper), r.c.getTrueTypeFromConditionalType(target), RecursionFlagsBoth, reportErrors)
 * 				if result != TernaryFalse {
 * 					result &= r.isRelatedTo(r.c.getFalseTypeFromConditionalType(source), r.c.getFalseTypeFromConditionalType(target), RecursionFlagsBoth, reportErrors)
 * 				}
 * 				if result != TernaryFalse {
 * 					return result
 * 				}
 * 			}
 * 		}
 * 		// conditionals can be related to one another via normal constraint, as, eg, `A extends B ? O : never` should be assignable to `O`
 * 		// when `O` is a conditional (`never` is trivially assignable to `O`, as is `O`!).
 * 		defaultConstraint := r.c.getDefaultConstraintOfConditionalType(source)
 * 		if defaultConstraint != nil {
 * 			result = r.isRelatedTo(defaultConstraint, target, RecursionFlagsSource, reportErrors)
 * 			if result != TernaryFalse {
 * 				return result
 * 			}
 * 		}
 * 		// conditionals aren't related to one another via distributive constraint as it is much too inaccurate and allows way
 * 		// more assignments than are desirable (since it maps the source check type to its constraint, it loses information).
 * 		if target.flags&TypeFlagsConditional == 0 && r.c.hasNonCircularBaseConstraint(source) {
 * 			distributiveConstraint := r.c.getConstraintOfDistributiveConditionalType(source)
 * 			if distributiveConstraint != nil {
 * 				r.restoreErrorState(saveErrorState)
 * 				result = r.isRelatedTo(distributiveConstraint, target, RecursionFlagsSource, reportErrors)
 * 				if result != TernaryFalse {
 * 					return result
 * 				}
 * 			}
 * 		}
 * 	case source.flags&TypeFlagsTemplateLiteral != 0 && target.flags&TypeFlagsObject == 0:
 * 		if target.flags&TypeFlagsTemplateLiteral == 0 {
 * 			constraint := r.c.getBaseConstraintOfType(source)
 * 			if constraint != nil && constraint != source {
 * 				result = r.isRelatedTo(constraint, target, RecursionFlagsSource, reportErrors)
 * 				if result != TernaryFalse {
 * 					return result
 * 				}
 * 			}
 * 		}
 * 	case source.flags&TypeFlagsStringMapping != 0:
 * 		if target.flags&TypeFlagsStringMapping != 0 {
 * 			if source.AsStringMappingType().symbol != target.AsStringMappingType().symbol {
 * 				return TernaryFalse
 * 			}
 * 			result = r.isRelatedTo(source.AsStringMappingType().target, target.AsStringMappingType().target, RecursionFlagsBoth, reportErrors)
 * 			if result != TernaryFalse {
 * 				return result
 * 			}
 * 		} else {
 * 			constraint := r.c.getBaseConstraintOfType(source)
 * 			if constraint != nil {
 * 				result = r.isRelatedTo(constraint, target, RecursionFlagsSource, reportErrors)
 * 				if result != TernaryFalse {
 * 					return result
 * 				}
 * 			}
 * 		}
 * 	default:
 * 		// An empty object type is related to any mapped type that includes a '?' modifier.
 * 		if r.relation != r.c.subtypeRelation && r.relation != r.c.strictSubtypeRelation && isPartialMappedType(target) && r.c.isEmptyObjectType(source) {
 * 			return TernaryTrue
 * 		}
 * 		if r.c.isGenericMappedType(target) {
 * 			if r.c.isGenericMappedType(source) {
 * 				result = r.mappedTypeRelatedTo(source, target, reportErrors)
 * 				if result != TernaryFalse {
 * 					return result
 * 				}
 * 			}
 * 			return TernaryFalse
 * 		}
 * 		sourceIsPrimitive := source.flags&TypeFlagsPrimitive != 0
 * 		if r.relation != r.c.identityRelation {
 * 			source = r.c.getApparentType(source)
 * 		} else if r.c.isGenericMappedType(source) {
 * 			return TernaryFalse
 * 		}
 * 		switch {
 * 		case source.objectFlags&ObjectFlagsReference != 0 && target.objectFlags&ObjectFlagsReference != 0 && source.Target() == target.Target() && !isTupleType(source) && !r.c.isMarkerType(source) && !r.c.isMarkerType(target):
 * 			// When strictNullChecks is disabled, the element type of the empty array literal is undefinedWideningType,
 * 			// and an empty array literal wouldn't be assignable to a `never[]` without this check.
 * 			if r.c.isEmptyArrayLiteralType(source) {
 * 				return TernaryTrue
 * 			}
 * 			// We have type references to the same generic type, and the type references are not marker
 * 			// type references (which are intended by be compared structurally). Obtain the variance
 * 			// information for the type parameters and relate the type arguments accordingly.
 * 			variances := r.c.getVariances(source.Target())
 * 			// We return Ternary.Maybe for a recursive invocation of getVariances (signaled by emptyArray). This
 * 			// effectively means we measure variance only from type parameter occurrences that aren't nested in
 * 			// recursive instantiations of the generic type.
 * 			if len(variances) == 0 {
 * 				return TernaryUnknown
 * 			}
 * 			varianceResult, ok := relateVariances(r.c.getTypeArguments(source), r.c.getTypeArguments(target), variances, intersectionState)
 * 			if ok {
 * 				return varianceResult
 * 			}
 * 		case r.c.isArrayType(target) && (r.c.isReadonlyArrayType(target) && everyType(source, r.c.isArrayOrTupleType) || everyType(source, isMutableTupleType)):
 * 			if r.relation != r.c.identityRelation {
 * 				return r.isRelatedTo(r.c.getIndexTypeOfTypeEx(source, r.c.numberType, r.c.anyType), r.c.getIndexTypeOfTypeEx(target, r.c.numberType, r.c.anyType), RecursionFlagsBoth, reportErrors)
 * 			}
 * 			// By flags alone, we know that the `target` is a readonly array while the source is a normal array or tuple
 * 			// or `target` is an array and source is a tuple - in both cases the types cannot be identical, by construction
 * 			return TernaryFalse
 * 		case r.c.isGenericTupleType(source) && isTupleType(target) && !r.c.isGenericTupleType(target):
 * 			constraint := r.c.getBaseConstraintOrType(source)
 * 			if constraint != source {
 * 				return r.isRelatedTo(constraint, target, RecursionFlagsSource, reportErrors)
 * 			}
 * 		case (r.relation == r.c.subtypeRelation || r.relation == r.c.strictSubtypeRelation) && r.c.isEmptyObjectType(target) && target.objectFlags&ObjectFlagsFreshLiteral != 0 && !r.c.isEmptyObjectType(source):
 * 			return TernaryFalse
 * 		}
 * 		// Even if relationship doesn't hold for unions, intersections, or generic type references,
 * 		// it may hold in a structural comparison.
 * 		// In a check of the form X = A & B, we will have previously checked if A relates to X or B relates
 * 		// to X. Failing both of those we want to check if the aggregation of A and B's members structurally
 * 		// relates to X. Thus, we include intersection types on the source side here.
 * 		if source.flags&(TypeFlagsObject|TypeFlagsIntersection) != 0 && target.flags&TypeFlagsObject != 0 {
 * 			// Report structural errors only if we haven't reported any errors yet
 * 			reportStructuralErrors := reportErrors && r.errorChain == saveErrorState.errorChain && !sourceIsPrimitive
 * 			result = r.propertiesRelatedTo(source, target, reportStructuralErrors, collections.Set[string]{} /*excludedProperties* /, false /*optionalsOnly* /, intersectionState)
 * 			if result != TernaryFalse {
 * 				result &= r.signaturesRelatedTo(source, target, SignatureKindCall, reportStructuralErrors, intersectionState)
 * 				if result != TernaryFalse {
 * 					result &= r.signaturesRelatedTo(source, target, SignatureKindConstruct, reportStructuralErrors, intersectionState)
 * 					if result != TernaryFalse {
 * 						result &= r.indexSignaturesRelatedTo(source, target, sourceIsPrimitive, reportStructuralErrors, intersectionState)
 * 					}
 * 				}
 * 			}
 * 			if result != TernaryFalse {
 * 				if !varianceCheckFailed {
 * 					return result
 * 				}
 * 				if originalErrorChain != nil {
 * 					r.errorChain = originalErrorChain
 * 				} else if r.errorChain == nil {
 * 					r.errorChain = saveErrorState.errorChain
 * 				}
 * 				// Use variance error (there is no structural one) and return false
 * 			}
 * 		}
 * 		// If S is an object type and T is a discriminated union, S may be related to T if
 * 		// there exists a constituent of T for every combination of the discriminants of S
 * 		// with respect to T. We do not report errors here, as we will use the existing
 * 		// error result from checking each constituent of the union.
 * 		if source.flags&(TypeFlagsObject|TypeFlagsIntersection) != 0 && target.flags&TypeFlagsUnion != 0 {
 * 			objectOnlyTarget := r.c.extractTypesOfKind(target, TypeFlagsObject|TypeFlagsIntersection|TypeFlagsSubstitution)
 * 			if objectOnlyTarget.flags&TypeFlagsUnion != 0 {
 * 				result := r.typeRelatedToDiscriminatedType(source, objectOnlyTarget)
 * 				if result != TernaryFalse {
 * 					return result
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return TernaryFalse
 * }
 */
export function Relater_structuredTypeRelatedToWorker(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  let result: Ternary = TernaryFalse;
  let varianceCheckFailed = false;
  let originalErrorChain: GoPtr<ErrorChain>;
  const saveErrorState = Relater_getErrorState(receiver);
  const c = receiver!.c;
  const relateVariances = (
    sourceTypeArguments: GoSlice<GoPtr<Type>>,
    targetTypeArguments: GoSlice<GoPtr<Type>>,
    variances: GoSlice<VarianceFlags>,
    varianceIntersectionState: IntersectionState,
  ): [Ternary, bool] => {
    result = Relater_typeArgumentsRelatedTo(receiver, sourceTypeArguments, targetTypeArguments, variances, reportErrors, varianceIntersectionState);
    if (result !== TernaryFalse) {
      return [result, true];
    }
    if (Some(variances, (v: VarianceFlags): bool => (v & VarianceFlagsAllowsStructuralFallback) !== 0)) {
      originalErrorChain = undefined;
      Relater_restoreErrorState(receiver, saveErrorState);
      return [TernaryFalse, false];
    }
    const allowStructuralFallback = Checker_hasCovariantVoidArgument(c, targetTypeArguments, variances);
    varianceCheckFailed = !allowStructuralFallback;
    if (variances.length !== 0 && !allowStructuralFallback) {
      if (varianceCheckFailed && !(reportErrors && Some(variances, (v: VarianceFlags): bool => (v & VarianceFlagsVarianceMask) === VarianceFlagsInvariant))) {
        return [TernaryFalse, true];
      }
      originalErrorChain = receiver!.errorChain;
      Relater_restoreErrorState(receiver, saveErrorState);
    }
    return [TernaryFalse, false];
  };

  if (receiver!.relation === c!.identityRelation) {
    if ((source!.flags & TypeFlagsUnionOrIntersection) !== 0) {
      result = Relater_eachTypeRelatedToSomeType(receiver, source, target);
      if (result !== TernaryFalse) {
        result = (result & Relater_eachTypeRelatedToSomeType(receiver, target, source)) as Ternary;
      }
      return result;
    }
    if ((source!.flags & TypeFlagsIndex) !== 0) {
      return Relater_isRelatedTo(receiver, Type_Target(source), Type_Target(target), RecursionFlagsBoth, false);
    }
    if ((source!.flags & TypeFlagsIndexedAccess) !== 0) {
      result = Relater_isRelatedTo(receiver, Type_AsIndexedAccessType(source)!.objectType, Type_AsIndexedAccessType(target)!.objectType, RecursionFlagsBoth, false);
      if (result !== TernaryFalse) {
        result = (result & Relater_isRelatedTo(receiver, Type_AsIndexedAccessType(source)!.indexType, Type_AsIndexedAccessType(target)!.indexType, RecursionFlagsBoth, false)) as Ternary;
        if (result !== TernaryFalse) {
          return result;
        }
      }
    } else if ((source!.flags & TypeFlagsConditional) !== 0) {
      const sourceConditional = Type_AsConditionalType(source)!;
      const targetConditional = Type_AsConditionalType(target)!;
      if (sourceConditional.root!.isDistributive === targetConditional.root!.isDistributive) {
        result = Relater_isRelatedTo(receiver, sourceConditional.checkType, targetConditional.checkType, RecursionFlagsBoth, false);
        if (result !== TernaryFalse) {
          result = (result & Relater_isRelatedTo(receiver, sourceConditional.extendsType, targetConditional.extendsType, RecursionFlagsBoth, false)) as Ternary;
          if (result !== TernaryFalse) {
            result = (result & Relater_isRelatedTo(receiver, Checker_getTrueTypeFromConditionalType(c, source), Checker_getTrueTypeFromConditionalType(c, target), RecursionFlagsBoth, false)) as Ternary;
            if (result !== TernaryFalse) {
              result = (result & Relater_isRelatedTo(receiver, Checker_getFalseTypeFromConditionalType(c, source), Checker_getFalseTypeFromConditionalType(c, target), RecursionFlagsBoth, false)) as Ternary;
              if (result !== TernaryFalse) {
                return result;
              }
            }
          }
        }
      }
    } else if ((source!.flags & TypeFlagsSubstitution) !== 0) {
      result = Relater_isRelatedTo(receiver, Type_AsSubstitutionType(source)!.baseType, Type_AsSubstitutionType(target)!.baseType, RecursionFlagsBoth, false);
      if (result !== TernaryFalse) {
        result = (result & Relater_isRelatedTo(receiver, Type_AsSubstitutionType(source)!.constraint, Type_AsSubstitutionType(target)!.constraint, RecursionFlagsBoth, false)) as Ternary;
        if (result !== TernaryFalse) {
          return result;
        }
      }
    } else if ((source!.flags & TypeFlagsTemplateLiteral) !== 0) {
      const sourceTemplate = Type_AsTemplateLiteralType(source)!;
      const targetTemplate = Type_AsTemplateLiteralType(target)!;
      if (slices.Equal(sourceTemplate.texts, targetTemplate.texts)) {
        result = TernaryTrue;
        for (let index = 0; index < sourceTemplate.types.length; index++) {
          result = (result & Relater_isRelatedTo(receiver, sourceTemplate.types[index], targetTemplate.types[index], RecursionFlagsBoth, false)) as Ternary;
          if (result === TernaryFalse) {
            return result;
          }
        }
        return result;
      }
    } else if ((source!.flags & TypeFlagsStringMapping) !== 0) {
      if (source!.symbol === target!.symbol) {
        return Relater_isRelatedTo(receiver, Type_AsStringMappingType(source)!.target, Type_AsStringMappingType(target)!.target, RecursionFlagsBoth, false);
      }
    }
    if ((source!.flags & TypeFlagsObject) === 0) {
      return TernaryFalse;
    }
  } else if ((source!.flags & TypeFlagsUnionOrIntersection) !== 0 || (target!.flags & TypeFlagsUnionOrIntersection) !== 0) {
    result = Relater_unionOrIntersectionRelatedTo(receiver, source, target, reportErrors, intersectionState);
    if (result !== TernaryFalse) {
      return result;
    }
    if (!(
      (source!.flags & TypeFlagsInstantiable) !== 0 ||
      ((source!.flags & TypeFlagsObject) !== 0 && (target!.flags & TypeFlagsUnion) !== 0) ||
      ((source!.flags & TypeFlagsIntersection) !== 0 && (target!.flags & (TypeFlagsObject | TypeFlagsUnion | TypeFlagsInstantiable)) !== 0)
    )) {
      return TernaryFalse;
    }
  }

  if (
    (source!.flags & (TypeFlagsObject | TypeFlagsConditional)) !== 0 &&
    source!.alias !== undefined &&
    source!.alias.typeArguments.length !== 0 &&
    target!.alias !== undefined &&
    source!.alias.symbol === target!.alias.symbol &&
    !(Checker_isMarkerType(c, source) || Checker_isMarkerType(c, target))
  ) {
    const variances = Checker_getAliasVariances(c, source!.alias.symbol);
    if (variances.length === 0) {
      return TernaryUnknown;
    }
    const params = LinkStore_Get(c!.typeAliasLinks, source!.alias.symbol)!.typeParameters;
    const minParams = Checker_getMinTypeArgumentCount(c, params);
    const nodeIsInJsFile = IsInJSFile(source!.alias.symbol!.ValueDeclaration);
    const sourceTypes = Checker_fillMissingTypeArguments(c, source!.alias.typeArguments, params, minParams, nodeIsInJsFile);
    const targetTypes = Checker_fillMissingTypeArguments(c, target!.alias.typeArguments, params, minParams, nodeIsInJsFile);
    const [varianceResult, ok] = relateVariances(sourceTypes, targetTypes, variances, intersectionState);
    if (ok) {
      return varianceResult;
    }
  }

  if (isSingleElementGenericTupleType(source) && !Type_TargetTupleType(source)!.readonly) {
    result = Relater_isRelatedTo(receiver, Checker_getTypeArguments(c, source)[0], target, RecursionFlagsSource, false);
    if (result !== TernaryFalse) {
      return result;
    }
  }
  if (isSingleElementGenericTupleType(target) && (Type_TargetTupleType(target)!.readonly || Checker_isMutableArrayOrTuple(c, Checker_getBaseConstraintOrType(c, source)))) {
    result = Relater_isRelatedTo(receiver, source, Checker_getTypeArguments(c, target)[0], RecursionFlagsTarget, false);
    if (result !== TernaryFalse) {
      return result;
    }
  }

  if ((target!.flags & TypeFlagsTypeParameter) !== 0) {
    if (
      (source!.objectFlags & ObjectFlagsMapped) !== 0 &&
      AsMappedTypeNode(Type_AsMappedType(source)!.declaration)!.NameType === undefined &&
      Relater_isRelatedTo(receiver, Checker_getIndexType(c, target), Checker_getConstraintTypeFromMappedType(c, source), RecursionFlagsBoth, false) !== TernaryFalse
    ) {
      if ((getMappedTypeModifiers(source) & MappedTypeModifiersIncludeOptional) === 0) {
        const templateType = Checker_getTemplateTypeFromMappedType(c, source);
        const indexedAccessType = Checker_getIndexedAccessType(c, target, Checker_getTypeParameterFromMappedType(c, source));
        result = Relater_isRelatedTo(receiver, templateType, indexedAccessType, RecursionFlagsBoth, reportErrors);
        if (result !== TernaryFalse) {
          return result;
        }
      }
    }
    if (receiver!.relation === c!.comparableRelation && (source!.flags & TypeFlagsTypeParameter) !== 0) {
      const constraint = Checker_getConstraintFromTypeParameter(c, source);
      if (constraint !== undefined && someType(constraint, (constraintType: GoPtr<Type>): bool => (constraintType!.flags & TypeFlagsTypeParameter) !== 0)) {
        return Relater_isRelatedTo(receiver, constraint, target, RecursionFlagsSource, false);
      }
      return TernaryFalse;
    }
  } else if ((target!.flags & TypeFlagsIndexedAccess) !== 0) {
    if ((source!.flags & TypeFlagsIndexedAccess) !== 0) {
      result = Relater_isRelatedTo(receiver, Type_AsIndexedAccessType(source)!.objectType, Type_AsIndexedAccessType(target)!.objectType, RecursionFlagsBoth, reportErrors);
      if (result !== TernaryFalse) {
        result = (result & Relater_isRelatedTo(receiver, Type_AsIndexedAccessType(source)!.indexType, Type_AsIndexedAccessType(target)!.indexType, RecursionFlagsBoth, reportErrors)) as Ternary;
      }
      if (result !== TernaryFalse) {
        return result;
      }
      if (reportErrors) {
        originalErrorChain = receiver!.errorChain;
      }
    }
    if (receiver!.relation === c!.assignableRelation || receiver!.relation === c!.comparableRelation) {
      const objectType = Type_AsIndexedAccessType(target)!.objectType;
      const indexType = Type_AsIndexedAccessType(target)!.indexType;
      const baseObjectType = Checker_getBaseConstraintOrType(c, objectType);
      const baseIndexType = Checker_getBaseConstraintOrType(c, indexType);
      if (!Checker_isGenericObjectType(c, baseObjectType) && !Checker_isGenericIndexType(c, baseIndexType)) {
        const accessFlags = (AccessFlagsWriting | (baseObjectType !== objectType ? AccessFlagsNoIndexSignatures : 0)) as AccessFlags;
        const constraint = Checker_getIndexedAccessTypeOrUndefined(c, baseObjectType, baseIndexType, accessFlags, undefined, undefined);
        if (constraint !== undefined) {
          if (reportErrors && originalErrorChain !== undefined) {
            Relater_restoreErrorState(receiver, saveErrorState);
          }
          result = Relater_isRelatedToEx(receiver, source, constraint, RecursionFlagsTarget, reportErrors, undefined, intersectionState);
          if (result !== TernaryFalse) {
            return result;
          }
          if (reportErrors && originalErrorChain !== undefined && receiver!.errorChain !== undefined && chainDepth(originalErrorChain) <= chainDepth(receiver!.errorChain)) {
            receiver!.errorChain = originalErrorChain;
          }
        }
      }
    }
    if (reportErrors) {
      originalErrorChain = undefined;
    }
  } else if ((target!.flags & TypeFlagsIndex) !== 0) {
    const targetIndex = Type_AsIndexType(target)!;
    const targetType = targetIndex.target;
    if ((source!.flags & TypeFlagsIndex) !== 0) {
      result = Relater_isRelatedTo(receiver, targetType, Type_AsIndexType(source)!.target, RecursionFlagsBoth, false);
      if (result !== TernaryFalse) {
        return result;
      }
    }
    if (isTupleType(targetType)) {
      result = Relater_isRelatedTo(receiver, source, Checker_getKnownKeysOfTupleType(c, targetType), RecursionFlagsTarget, reportErrors);
      if (result !== TernaryFalse) {
        return result;
      }
    } else {
      const constraint = Checker_getSimplifiedTypeOrConstraint(c, targetType);
      if (constraint !== undefined) {
        if (Relater_isRelatedTo(receiver, source, Checker_getIndexTypeEx(c, constraint, (targetIndex.indexFlags | IndexFlagsNoReducibleCheck) as never), RecursionFlagsTarget, reportErrors) === TernaryTrue) {
          return TernaryTrue;
        }
      } else if (Checker_isGenericMappedType(c, targetType)) {
        const nameType = Checker_getNameTypeFromMappedType(c, targetType);
        const constraintType = Checker_getConstraintTypeFromMappedType(c, targetType);
        let targetKeys: GoPtr<Type>;
        if (nameType !== undefined && Checker_isMappedTypeWithKeyofConstraintDeclaration(c, targetType)) {
          const mappedKeys = Checker_getApparentMappedTypeKeys(c, nameType, targetType);
          targetKeys = Checker_getUnionType(c, [mappedKeys, nameType]);
        } else if (nameType !== undefined) {
          targetKeys = nameType;
        } else {
          targetKeys = constraintType;
        }
        if (Relater_isRelatedTo(receiver, source, targetKeys, RecursionFlagsTarget, reportErrors) === TernaryTrue) {
          return TernaryTrue;
        }
      }
    }
  } else if ((target!.flags & TypeFlagsConditional) !== 0) {
    if (Checker_isDeeplyNestedType(c, target, receiver!.targetStack, 10)) {
      return TernaryMaybe;
    }
    const targetConditional = Type_AsConditionalType(target)!;
    if (
      (targetConditional.root!.inferTypeParameters ?? []).length === 0 &&
      !Checker_isDistributionDependent(c, targetConditional.root) &&
      !((source!.flags & TypeFlagsConditional) !== 0 && Type_AsConditionalType(source)!.root === targetConditional.root)
    ) {
      const skipTrue = !Checker_isTypeAssignableTo(c, Checker_getPermissiveInstantiation(c, targetConditional.checkType), Checker_getPermissiveInstantiation(c, targetConditional.extendsType));
      const skipFalse = !skipTrue && Checker_isTypeAssignableTo(c, Checker_getRestrictiveInstantiation(c, targetConditional.checkType), Checker_getRestrictiveInstantiation(c, targetConditional.extendsType));
      if (skipTrue) {
        result = TernaryTrue;
      } else {
        result = Relater_isRelatedToEx(receiver, source, Checker_getTrueTypeFromConditionalType(c, target), RecursionFlagsTarget, false, undefined, intersectionState);
      }
      if (result !== TernaryFalse) {
        if (skipFalse) {
          result = (result & TernaryTrue) as Ternary;
        } else {
          result = (result & Relater_isRelatedToEx(receiver, source, Checker_getFalseTypeFromConditionalType(c, target), RecursionFlagsTarget, false, undefined, intersectionState)) as Ternary;
        }
        if (result !== TernaryFalse) {
          return result;
        }
      }
    }
  } else if ((target!.flags & TypeFlagsTemplateLiteral) !== 0) {
    if ((source!.flags & TypeFlagsTemplateLiteral) !== 0) {
      if (receiver!.relation === c!.comparableRelation) {
        if (Checker_templateLiteralTypesDefinitelyUnrelated(c, Type_AsTemplateLiteralType(source)!, Type_AsTemplateLiteralType(target)!)) {
          return TernaryFalse;
        }
        return TernaryTrue;
      }
      Checker_instantiateType(c, source, c!.reportUnreliableMapper);
    }
    if (Checker_isTypeMatchedByTemplateLiteralType(c, source, Type_AsTemplateLiteralType(target)!, (s: GoPtr<Type>, t: GoPtr<Type>, errors: bool) => Relater_isRelatedToWorker(receiver, s, t, errors))) {
      return TernaryTrue;
    }
  } else if ((target!.flags & TypeFlagsStringMapping) !== 0) {
    if ((source!.flags & TypeFlagsStringMapping) === 0 && Checker_isMemberOfStringMapping(c, source, target)) {
      return TernaryTrue;
    }
  } else if (Checker_isGenericMappedType(c, target) && receiver!.relation !== c!.identityRelation) {
    const keysRemapped = AsMappedTypeNode(Type_AsMappedType(target)!.declaration)!.NameType !== undefined;
    const templateType = Checker_getTemplateTypeFromMappedType(c, target);
    const modifiers = getMappedTypeModifiers(target);
    if ((modifiers & MappedTypeModifiersExcludeOptional) === 0) {
      if (!keysRemapped && (templateType!.flags & TypeFlagsIndexedAccess) !== 0 && Type_AsIndexedAccessType(templateType)!.objectType === source && Type_AsIndexedAccessType(templateType)!.indexType === Checker_getTypeParameterFromMappedType(c, target)) {
        return TernaryTrue;
      }
      if (!Checker_isGenericMappedType(c, source)) {
        const targetKeys = keysRemapped ? Checker_getNameTypeFromMappedType(c, target) : Checker_getConstraintTypeFromMappedType(c, target);
        const sourceKeys = Checker_getIndexTypeEx(c, source, IndexFlagsNoIndexSignatures);
        const includeOptional = (modifiers & MappedTypeModifiersIncludeOptional) !== 0;
        let filteredByApplicability: GoPtr<Type>;
        if (includeOptional) {
          filteredByApplicability = Checker_intersectTypes(c, targetKeys, sourceKeys);
        }
        if ((includeOptional && filteredByApplicability !== undefined && (filteredByApplicability.flags & TypeFlagsNever) === 0) || (!includeOptional && Relater_isRelatedTo(receiver, targetKeys, sourceKeys, RecursionFlagsBoth, false) !== TernaryFalse)) {
          const targetTemplateType = Checker_getTemplateTypeFromMappedType(c, target);
          const typeParameter = Checker_getTypeParameterFromMappedType(c, target);
          const nonNullComponent = Checker_extractTypesOfKind(c, targetTemplateType, ~TypeFlagsNullable as never);
          if (!keysRemapped && (nonNullComponent!.flags & TypeFlagsIndexedAccess) !== 0 && Type_AsIndexedAccessType(nonNullComponent)!.indexType === typeParameter) {
            result = Relater_isRelatedTo(receiver, source, Type_AsIndexedAccessType(nonNullComponent)!.objectType, RecursionFlagsTarget, reportErrors);
            if (result !== TernaryFalse) {
              return result;
            }
          } else {
            let indexingType = typeParameter;
            if (keysRemapped) {
              indexingType = OrElse(filteredByApplicability, targetKeys);
            } else if (filteredByApplicability !== undefined) {
              indexingType = Checker_getIntersectionType(c, [filteredByApplicability, typeParameter]);
            }
            const indexedAccessType = Checker_getIndexedAccessType(c, source, indexingType);
            result = Relater_isRelatedTo(receiver, indexedAccessType, targetTemplateType, RecursionFlagsBoth, reportErrors);
            if (result !== TernaryFalse) {
              return result;
            }
          }
        }
        originalErrorChain = receiver!.errorChain;
        Relater_restoreErrorState(receiver, saveErrorState);
      }
    }
  }

  if ((source!.flags & TypeFlagsTypeVariable) !== 0) {
    if ((source!.flags & TypeFlagsIndexedAccess) === 0 || (target!.flags & TypeFlagsIndexedAccess) === 0) {
      let constraint = Checker_getConstraintOfType(c, source);
      if (constraint === undefined) {
        constraint = c!.unknownType;
      }
      result = Relater_isRelatedToEx(receiver, constraint, target, RecursionFlagsSource, false, undefined, intersectionState);
      if (result !== TernaryFalse) {
        return result;
      }
      const constraintWithThis = Checker_getTypeWithThisArgument(c, constraint, source, false);
      result = Relater_isRelatedToEx(receiver, constraintWithThis, target, RecursionFlagsSource, reportErrors && constraint !== c!.unknownType && (target!.flags & source!.flags & TypeFlagsTypeParameter) === 0, undefined, intersectionState);
      if (result !== TernaryFalse) {
        return result;
      }
      if (Checker_isMappedTypeGenericIndexedAccess(c, source)) {
        const indexConstraint = Checker_getConstraintOfType(c, Type_AsIndexedAccessType(source)!.indexType);
        if (indexConstraint !== undefined) {
          result = Relater_isRelatedTo(receiver, Checker_getIndexedAccessType(c, Type_AsIndexedAccessType(source)!.objectType, indexConstraint), target, RecursionFlagsSource, reportErrors);
          if (result !== TernaryFalse) {
            return result;
          }
        }
      }
    }
  } else if ((source!.flags & TypeFlagsIndex) !== 0) {
    const sourceIndex = Type_AsIndexType(source)!;
    const isDeferredMappedIndex = Checker_shouldDeferIndexType(c, sourceIndex.target, sourceIndex.indexFlags) && (sourceIndex.target!.objectFlags & ObjectFlagsMapped) !== 0;
    result = Relater_isRelatedTo(receiver, c!.stringNumberSymbolType, target, RecursionFlagsSource, reportErrors && !isDeferredMappedIndex);
    if (result !== TernaryFalse) {
      return result;
    }
    if (isDeferredMappedIndex) {
      const mappedType = sourceIndex.target;
      const nameType = Checker_getNameTypeFromMappedType(c, mappedType);
      let sourceMappedKeys: GoPtr<Type>;
      if (nameType !== undefined && Checker_isMappedTypeWithKeyofConstraintDeclaration(c, mappedType)) {
        sourceMappedKeys = Checker_getApparentMappedTypeKeys(c, nameType, mappedType);
      } else if (nameType !== undefined) {
        sourceMappedKeys = nameType;
      } else {
        sourceMappedKeys = Checker_getConstraintTypeFromMappedType(c, mappedType);
      }
      result = Relater_isRelatedTo(receiver, sourceMappedKeys, target, RecursionFlagsSource, reportErrors);
      if (result !== TernaryFalse) {
        return result;
      }
    }
  } else if ((source!.flags & TypeFlagsConditional) !== 0) {
    if (Checker_isDeeplyNestedType(c, source, receiver!.sourceStack, 10)) {
      return TernaryMaybe;
    }
    if ((target!.flags & TypeFlagsConditional) !== 0) {
      const sourceConditional = Type_AsConditionalType(source)!;
      const targetConditional = Type_AsConditionalType(target)!;
      const sourceParams = sourceConditional.root!.inferTypeParameters ?? [];
      let sourceExtends = sourceConditional.extendsType;
      let mapper: GoPtr<TypeMapper>;
      if (sourceParams.length !== 0) {
        const context = Checker_newInferenceContext(c, sourceParams, undefined, InferenceFlagsNone, (s: GoPtr<Type>, t: GoPtr<Type>, errors: bool) => Relater_isRelatedToWorker(receiver, s, t, errors));
        Checker_inferTypes(c, context!.inferences, targetConditional.extendsType, sourceExtends, InferencePriorityNoConstraints | InferencePriorityAlwaysStrict, false);
        sourceExtends = Checker_instantiateType(c, sourceExtends, context!.mapper);
        mapper = context!.mapper;
      }
      if (
        Checker_isTypeIdenticalTo(c, sourceExtends, targetConditional.extendsType) &&
        (Relater_isRelatedTo(receiver, sourceConditional.checkType, targetConditional.checkType, RecursionFlagsBoth, false) !== 0 ||
          Relater_isRelatedTo(receiver, targetConditional.checkType, sourceConditional.checkType, RecursionFlagsBoth, false) !== 0)
      ) {
        result = Relater_isRelatedTo(receiver, Checker_instantiateType(c, Checker_getTrueTypeFromConditionalType(c, source), mapper), Checker_getTrueTypeFromConditionalType(c, target), RecursionFlagsBoth, reportErrors);
        if (result !== TernaryFalse) {
          result = (result & Relater_isRelatedTo(receiver, Checker_getFalseTypeFromConditionalType(c, source), Checker_getFalseTypeFromConditionalType(c, target), RecursionFlagsBoth, reportErrors)) as Ternary;
        }
        if (result !== TernaryFalse) {
          return result;
        }
      }
    }
    const defaultConstraint = Checker_getDefaultConstraintOfConditionalType(c, source);
    if (defaultConstraint !== undefined) {
      result = Relater_isRelatedTo(receiver, defaultConstraint, target, RecursionFlagsSource, reportErrors);
      if (result !== TernaryFalse) {
        return result;
      }
    }
    if ((target!.flags & TypeFlagsConditional) === 0 && Checker_hasNonCircularBaseConstraint(c, source)) {
      const distributiveConstraint = Checker_getConstraintOfDistributiveConditionalType(c, source);
      if (distributiveConstraint !== undefined) {
        Relater_restoreErrorState(receiver, saveErrorState);
        result = Relater_isRelatedTo(receiver, distributiveConstraint, target, RecursionFlagsSource, reportErrors);
        if (result !== TernaryFalse) {
          return result;
        }
      }
    }
  } else if ((source!.flags & TypeFlagsTemplateLiteral) !== 0 && (target!.flags & TypeFlagsObject) === 0) {
    if ((target!.flags & TypeFlagsTemplateLiteral) === 0) {
      const constraint = Checker_getBaseConstraintOfType(c, source);
      if (constraint !== undefined && constraint !== source) {
        result = Relater_isRelatedTo(receiver, constraint, target, RecursionFlagsSource, reportErrors);
        if (result !== TernaryFalse) {
          return result;
        }
      }
    }
  } else if ((source!.flags & TypeFlagsStringMapping) !== 0) {
    if ((target!.flags & TypeFlagsStringMapping) !== 0) {
      if (source!.symbol !== target!.symbol) {
        return TernaryFalse;
      }
      result = Relater_isRelatedTo(receiver, Type_AsStringMappingType(source)!.target, Type_AsStringMappingType(target)!.target, RecursionFlagsBoth, reportErrors);
      if (result !== TernaryFalse) {
        return result;
      }
    } else {
      const constraint = Checker_getBaseConstraintOfType(c, source);
      if (constraint !== undefined) {
        result = Relater_isRelatedTo(receiver, constraint, target, RecursionFlagsSource, reportErrors);
        if (result !== TernaryFalse) {
          return result;
        }
      }
    }
  } else {
    if (receiver!.relation !== c!.subtypeRelation && receiver!.relation !== c!.strictSubtypeRelation && isPartialMappedType(target) && Checker_isEmptyObjectType(c, source)) {
      return TernaryTrue;
    }
    if (Checker_isGenericMappedType(c, target)) {
      if (Checker_isGenericMappedType(c, source)) {
        result = Relater_mappedTypeRelatedTo(receiver, source, target, reportErrors);
        if (result !== TernaryFalse) {
          return result;
        }
      }
      return TernaryFalse;
    }
    const sourceIsPrimitive = (source!.flags & TypeFlagsPrimitive) !== 0;
    if (receiver!.relation !== c!.identityRelation) {
      source = Checker_getApparentType(c, source);
    } else if (Checker_isGenericMappedType(c, source)) {
      return TernaryFalse;
    }
    if (
      (source!.objectFlags & ObjectFlagsReference) !== 0 &&
      (target!.objectFlags & ObjectFlagsReference) !== 0 &&
      Type_Target(source) === Type_Target(target) &&
      !isTupleType(source) &&
      !Checker_isMarkerType(c, source) &&
      !Checker_isMarkerType(c, target)
    ) {
      if (Checker_isEmptyArrayLiteralType(c, source)) {
        return TernaryTrue;
      }
      const variances = Checker_getVariances(c, Type_Target(source));
      if (variances.length === 0) {
        return TernaryUnknown;
      }
      const [varianceResult, ok] = relateVariances(Checker_getTypeArguments(c, source), Checker_getTypeArguments(c, target), variances, intersectionState);
      if (ok) {
        return varianceResult;
      }
    } else if (
      Checker_isArrayType(c, target) &&
      ((Checker_isReadonlyArrayType(c, target) && everyType(source, (type_: GoPtr<Type>): bool => Checker_isArrayOrTupleType(c, type_))) || everyType(source, isMutableTupleType))
    ) {
      if (receiver!.relation !== c!.identityRelation) {
        return Relater_isRelatedTo(receiver, Checker_getIndexTypeOfTypeEx(c, source, c!.numberType, c!.anyType), Checker_getIndexTypeOfTypeEx(c, target, c!.numberType, c!.anyType), RecursionFlagsBoth, reportErrors);
      }
      return TernaryFalse;
    } else if (Checker_isGenericTupleType(c, source) && isTupleType(target) && !Checker_isGenericTupleType(c, target)) {
      const constraint = Checker_getBaseConstraintOrType(c, source);
      if (constraint !== source) {
        return Relater_isRelatedTo(receiver, constraint, target, RecursionFlagsSource, reportErrors);
      }
    } else if (
      (receiver!.relation === c!.subtypeRelation || receiver!.relation === c!.strictSubtypeRelation) &&
      Checker_isEmptyObjectType(c, target) &&
      (target!.objectFlags & ObjectFlagsFreshLiteral) !== 0 &&
      !Checker_isEmptyObjectType(c, source)
    ) {
      return TernaryFalse;
    }
    if ((source!.flags & (TypeFlagsObject | TypeFlagsIntersection)) !== 0 && (target!.flags & TypeFlagsObject) !== 0) {
      const reportStructuralErrors = reportErrors && receiver!.errorChain === saveErrorState.errorChain && !sourceIsPrimitive;
      result = Relater_propertiesRelatedTo(receiver, source, target, reportStructuralErrors, NewSetWithSizeHint<string>(0 as int)!, false, intersectionState);
      if (result !== TernaryFalse) {
        result = (result & Relater_signaturesRelatedTo(receiver, source, target, SignatureKindCall, reportStructuralErrors, intersectionState)) as Ternary;
        if (result !== TernaryFalse) {
          result = (result & Relater_signaturesRelatedTo(receiver, source, target, SignatureKindConstruct, reportStructuralErrors, intersectionState)) as Ternary;
          if (result !== TernaryFalse) {
            result = (result & Relater_indexSignaturesRelatedTo(receiver, source, target, sourceIsPrimitive, reportStructuralErrors, intersectionState)) as Ternary;
          }
        }
      }
      if (result !== TernaryFalse) {
        if (!varianceCheckFailed) {
          return result;
        }
        if (originalErrorChain !== undefined) {
          receiver!.errorChain = originalErrorChain;
        } else if (receiver!.errorChain === undefined) {
          receiver!.errorChain = saveErrorState.errorChain;
        }
      }
    }
    if ((source!.flags & (TypeFlagsObject | TypeFlagsIntersection)) !== 0 && (target!.flags & TypeFlagsUnion) !== 0) {
      const objectOnlyTarget = Checker_extractTypesOfKind(c, target, (TypeFlagsObject | TypeFlagsIntersection | TypeFlagsSubstitution) as never);
      if ((objectOnlyTarget!.flags & TypeFlagsUnion) !== 0) {
        result = Relater_typeRelatedToDiscriminatedType(receiver, source, objectOnlyTarget);
        if (result !== TernaryFalse) {
          return result;
        }
      }
    }
  }
  return TernaryFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.typeArgumentsRelatedTo","kind":"method","status":"implemented","sigHash":"e309de9ec76375a08bcd2b9e350b847ef4b2565e1b1a50ae108c7783191cb855","bodyHash":"27532e0b52744b14987c7a9ad401e8801db7abfa0ee96401d37c79e27caaa15b"}
 *
 * Go source:
 * func (r *Relater) typeArgumentsRelatedTo(sources []*Type, targets []*Type, variances []VarianceFlags, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	if len(sources) != len(targets) && r.relation == r.c.identityRelation {
 * 		return TernaryFalse
 * 	}
 * 	length := min(len(sources), len(targets))
 * 	result := TernaryTrue
 * 	for i := range length {
 * 		// When variance information isn't available we default to covariance. This happens
 * 		// in the process of computing variance information for recursive types and when
 * 		// comparing 'this' type arguments.
 * 		varianceFlags := VarianceFlagsCovariant
 * 		if i < len(variances) {
 * 			varianceFlags = variances[i]
 * 		}
 * 		variance := varianceFlags & VarianceFlagsVarianceMask
 * 		// We ignore arguments for independent type parameters (because they're never witnessed).
 * 		if variance != VarianceFlagsIndependent {
 * 			s := sources[i]
 * 			t := targets[i]
 * 			var related Ternary
 * 			if varianceFlags&VarianceFlagsUnmeasurable != 0 {
 * 				// Even an `Unmeasurable` variance works out without a structural check if the source and target are _identical_.
 * 				// We can't simply assume invariance, because `Unmeasurable` marks nonlinear relations, for example, a relation tainted by
 * 				// the `-?` modifier in a mapped type (where, no matter how the inputs are related, the outputs still might not be)
 * 				if r.relation == r.c.identityRelation {
 * 					related = r.isRelatedTo(s, t, RecursionFlagsBoth, false /*reportErrors* /)
 * 				} else {
 * 					related = r.c.compareTypesIdentical(s, t)
 * 				}
 * 			} else {
 * 				// Propagate unreliable variance flag
 * 				if r.c.inVarianceComputation && varianceFlags&VarianceFlagsUnreliable != 0 {
 * 					r.c.instantiateType(s, r.c.reportUnreliableMapper)
 * 				}
 * 				if variance == VarianceFlagsCovariant {
 * 					related = r.isRelatedToEx(s, t, RecursionFlagsBoth, reportErrors, nil /*headMessage* /, intersectionState)
 * 				} else if variance == VarianceFlagsContravariant {
 * 					related = r.isRelatedToEx(t, s, RecursionFlagsBoth, reportErrors, nil /*headMessage* /, intersectionState)
 * 				} else if variance == VarianceFlagsBivariant {
 * 					// In the bivariant case we first compare contravariantly without reporting
 * 					// errors. Then, if that doesn't succeed, we compare covariantly with error
 * 					// reporting. Thus, error elaboration will be based on the covariant check,
 * 					// which is generally easier to reason about.
 * 					related = r.isRelatedTo(t, s, RecursionFlagsBoth, false /*reportErrors* /)
 * 					if related == TernaryFalse {
 * 						related = r.isRelatedToEx(s, t, RecursionFlagsBoth, reportErrors, nil /*headMessage* /, intersectionState)
 * 					}
 * 				} else {
 * 					// In the invariant case we first compare covariantly, and only when that
 * 					// succeeds do we proceed to compare contravariantly. Thus, error elaboration
 * 					// will typically be based on the covariant check.
 * 					related = r.isRelatedToEx(s, t, RecursionFlagsBoth, reportErrors, nil /*headMessage* /, intersectionState)
 * 					if related != TernaryFalse {
 * 						related &= r.isRelatedToEx(t, s, RecursionFlagsBoth, reportErrors, nil /*headMessage* /, intersectionState)
 * 					}
 * 				}
 * 			}
 * 			if related == TernaryFalse {
 * 				return TernaryFalse
 * 			}
 * 			result &= related
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Relater_typeArgumentsRelatedTo(receiver: GoPtr<Relater>, sources: GoSlice<GoPtr<Type>>, targets: GoSlice<GoPtr<Type>>, variances: GoSlice<VarianceFlags>, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  if (sources.length !== targets.length && receiver!.relation === receiver!.c!.identityRelation) {
    return TernaryFalse;
  }
  const length = Math.min(sources.length, targets.length);
  let result: Ternary = TernaryTrue;
  for (let i = 0; i < length; i++) {
    let varianceFlags: VarianceFlags = VarianceFlagsCovariant;
    if (i < variances.length) {
      varianceFlags = variances[i]!;
    }
    const variance = varianceFlags & VarianceFlagsVarianceMask;
    if (variance !== VarianceFlagsIndependent) {
      const s = sources[i]!;
      const t = targets[i]!;
      let related: Ternary;
      if ((varianceFlags & VarianceFlagsUnmeasurable) !== 0) {
        if (receiver!.relation === receiver!.c!.identityRelation) {
          related = Relater_isRelatedTo(receiver, s, t, RecursionFlagsBoth, false);
        } else {
          related = Checker_compareTypesIdentical(receiver!.c, s, t);
        }
      } else {
        if (receiver!.c!.inVarianceComputation && (varianceFlags & VarianceFlagsUnreliable) !== 0) {
          Checker_instantiateType(receiver!.c, s, receiver!.c!.reportUnreliableMapper);
        }
        if (variance === VarianceFlagsCovariant) {
          related = Relater_isRelatedToEx(receiver, s, t, RecursionFlagsBoth, reportErrors, undefined, intersectionState);
        } else if (variance === VarianceFlagsContravariant) {
          related = Relater_isRelatedToEx(receiver, t, s, RecursionFlagsBoth, reportErrors, undefined, intersectionState);
        } else if (variance === VarianceFlagsBivariant) {
          related = Relater_isRelatedTo(receiver, t, s, RecursionFlagsBoth, false);
          if (related === TernaryFalse) {
            related = Relater_isRelatedToEx(receiver, s, t, RecursionFlagsBoth, reportErrors, undefined, intersectionState);
          }
        } else {
          related = Relater_isRelatedToEx(receiver, s, t, RecursionFlagsBoth, reportErrors, undefined, intersectionState);
          if (related !== TernaryFalse) {
            related = (related & Relater_isRelatedToEx(receiver, t, s, RecursionFlagsBoth, reportErrors, undefined, intersectionState)) as Ternary;
          }
        }
      }
      if (related === TernaryFalse) {
        return TernaryFalse;
      }
      result = (result & related) as Ternary;
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.mappedTypeRelatedTo","kind":"method","status":"implemented","sigHash":"2cddfe4595a3e8f6b58202796615b0d3f59fd76e11927faf315d18d857eddd22","bodyHash":"bae0bf587119a60471f1063f0895665c294a02eb03d52eccccf9d71332ce6677"}
 *
 * Go source:
 * func (r *Relater) mappedTypeRelatedTo(source *Type, target *Type, reportErrors bool) Ternary {
 * 	modifiersRelated := r.relation == r.c.comparableRelation ||
 * 		r.relation == r.c.identityRelation && getMappedTypeModifiers(source) == getMappedTypeModifiers(target) ||
 * 		r.relation != r.c.identityRelation && r.c.getCombinedMappedTypeOptionality(source) <= r.c.getCombinedMappedTypeOptionality(target)
 * 	if modifiersRelated {
 * 		targetConstraint := r.c.getConstraintTypeFromMappedType(target)
 * 		sourceConstraint := r.c.instantiateType(r.c.getConstraintTypeFromMappedType(source), core.IfElse(r.c.getCombinedMappedTypeOptionality(source) < 0, r.c.reportUnmeasurableMapper, r.c.reportUnreliableMapper))
 * 		if result := r.isRelatedTo(targetConstraint, sourceConstraint, RecursionFlagsBoth, reportErrors); result != TernaryFalse {
 * 			mapper := newSimpleTypeMapper(r.c.getTypeParameterFromMappedType(source), r.c.getTypeParameterFromMappedType(target))
 * 			if r.c.instantiateType(r.c.getNameTypeFromMappedType(source), mapper) == r.c.instantiateType(r.c.getNameTypeFromMappedType(target), mapper) {
 * 				return result & r.isRelatedTo(r.c.instantiateType(r.c.getTemplateTypeFromMappedType(source), mapper), r.c.getTemplateTypeFromMappedType(target), RecursionFlagsBoth, reportErrors)
 * 			}
 * 		}
 * 	}
 * 	return TernaryFalse
 * }
 */
export function Relater_mappedTypeRelatedTo(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, reportErrors: bool): Ternary {
  const modifiersRelated =
    receiver!.relation === receiver!.c!.comparableRelation ||
    (receiver!.relation === receiver!.c!.identityRelation && getMappedTypeModifiers(source) === getMappedTypeModifiers(target)) ||
    (receiver!.relation !== receiver!.c!.identityRelation && Checker_getCombinedMappedTypeOptionality(receiver!.c, source) <= Checker_getCombinedMappedTypeOptionality(receiver!.c, target));
  if (modifiersRelated) {
    const targetConstraint = Checker_getConstraintTypeFromMappedType(receiver!.c, target);
    const sourceConstraint = Checker_instantiateType(
      receiver!.c,
      Checker_getConstraintTypeFromMappedType(receiver!.c, source),
      Checker_getCombinedMappedTypeOptionality(receiver!.c, source) < 0 ? receiver!.c!.reportUnmeasurableMapper : receiver!.c!.reportUnreliableMapper,
    );
    const result = Relater_isRelatedTo(receiver, targetConstraint, sourceConstraint, RecursionFlagsBoth, reportErrors);
    if (result !== TernaryFalse) {
      const mapper = newSimpleTypeMapper(Checker_getTypeParameterFromMappedType(receiver!.c, source), Checker_getTypeParameterFromMappedType(receiver!.c, target));
      if (Checker_instantiateType(receiver!.c, Checker_getNameTypeFromMappedType(receiver!.c, source), mapper) === Checker_instantiateType(receiver!.c, Checker_getNameTypeFromMappedType(receiver!.c, target), mapper)) {
        return (result & Relater_isRelatedTo(receiver, Checker_instantiateType(receiver!.c, Checker_getTemplateTypeFromMappedType(receiver!.c, source), mapper), Checker_getTemplateTypeFromMappedType(receiver!.c, target), RecursionFlagsBoth, reportErrors)) as Ternary;
      }
    }
  }
  return TernaryFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.typeRelatedToDiscriminatedType","kind":"method","status":"implemented","sigHash":"7e88d2781c6b475a0bd0bf7d723f06da1b196832366f7dc895cab0f91f1acbee","bodyHash":"420a65dae01b8a4862b5c3ac09854cb2062f3e0c2eeb1c7f49a7943251104fc5"}
 *
 * Go source:
 * func (r *Relater) typeRelatedToDiscriminatedType(source *Type, target *Type) Ternary {
 * 	// 1. Generate the combinations of discriminant properties & types 'source' can satisfy.
 * 	//    a. If the number of combinations is above a set limit, the comparison is too complex.
 * 	// 2. Filter 'target' to the subset of types whose discriminants exist in the matrix.
 * 	//    a. If 'target' does not satisfy all discriminants in the matrix, 'source' is not related.
 * 	// 3. For each type in the filtered 'target', determine if all non-discriminant properties of
 * 	//    'target' are related to a property in 'source'.
 * 	//
 * 	// NOTE: See ~/tests/cases/conformance/types/typeRelationships/assignmentCompatibility/assignmentCompatWithDiscriminatedUnion.ts
 * 	//       for examples.
 * 	sourceProperties := r.c.getPropertiesOfType(source)
 * 	sourcePropertiesFiltered := r.c.findDiscriminantProperties(sourceProperties, target)
 * 	if len(sourcePropertiesFiltered) == 0 {
 * 		return TernaryFalse
 * 	}
 * 	// Though we could compute the number of combinations as we generate
 * 	// the matrix, this would incur additional memory overhead due to
 * 	// array allocations. To reduce this overhead, we first compute
 * 	// the number of combinations to ensure we will not surpass our
 * 	// fixed limit before incurring the cost of any allocations:
 * 	numCombinations := 1
 * 	for _, sourceProperty := range sourcePropertiesFiltered {
 * 		numCombinations *= countTypes(r.c.getNonMissingTypeOfSymbol(sourceProperty))
 * 		if numCombinations > 25 {
 * 			if tr := r.c.tracer; tr != nil {
 * 				tr.Instant(tracing.PhaseCheckTypes, "typeRelatedToDiscriminatedType_DepthLimit", map[string]any{"sourceId": source.id, "targetId": target.id, "numCombinations": numCombinations})
 * 			}
 * 			return TernaryFalse
 * 		}
 * 		if numCombinations == 0 {
 * 			return TernaryFalse
 * 		}
 * 	}
 * 	// Compute the set of types for each discriminant property.
 * 	sourceDiscriminantTypes := make([][]*Type, len(sourcePropertiesFiltered))
 * 	var excludedProperties collections.Set[string]
 * 	for i, sourceProperty := range sourcePropertiesFiltered {
 * 		sourcePropertyType := r.c.getNonMissingTypeOfSymbol(sourceProperty)
 * 		sourceDiscriminantTypes[i] = sourcePropertyType.Distributed()
 * 		excludedProperties.Add(sourceProperty.Name)
 * 	}
 * 	// Build the cartesian product
 * 	discriminantCombinations := make([][]*Type, numCombinations)
 * 	for i := range numCombinations {
 * 		combination := make([]*Type, len(sourceDiscriminantTypes))
 * 		n := i
 * 		for j := len(sourceDiscriminantTypes) - 1; j >= 0; j-- {
 * 			sourceTypes := sourceDiscriminantTypes[j]
 * 			length := len(sourceTypes)
 * 			combination[j] = sourceTypes[n%length]
 * 			n = n / length
 * 		}
 * 		discriminantCombinations[i] = combination
 * 	}
 * 	// Match each combination of the cartesian product of discriminant properties to one or more
 * 	// constituents of 'target'. If any combination does not have a match then 'source' is not relatable.
 * 	var matchingTypes []*Type
 * 	for _, combination := range discriminantCombinations {
 * 		hasMatch := false
 * 	outer:
 * 		for _, t := range target.Types() {
 * 			for i := range sourcePropertiesFiltered {
 * 				sourceProperty := sourcePropertiesFiltered[i]
 * 				targetProperty := r.c.getPropertyOfType(t, sourceProperty.Name)
 * 				if targetProperty == nil {
 * 					continue outer
 * 				}
 * 				if sourceProperty == targetProperty {
 * 					continue
 * 				}
 * 				// We compare the source property to the target in the context of a single discriminant type.
 * 				related := r.propertyRelatedTo(source, target, sourceProperty, targetProperty, func(*ast.Symbol) *Type { return combination[i] },
 * 					false /*reportErrors* /, IntersectionStateNone, r.c.strictNullChecks || r.relation == r.c.comparableRelation /*skipOptional* /)
 * 				// If the target property could not be found, or if the properties were not related,
 * 				// then this constituent is not a match.
 * 				if related == TernaryFalse {
 * 					continue outer
 * 				}
 * 			}
 * 			matchingTypes = core.AppendIfUnique(matchingTypes, t)
 * 			hasMatch = true
 * 		}
 * 		if !hasMatch {
 * 			// We failed to match any type for this combination.
 * 			return TernaryFalse
 * 		}
 * 	}
 * 	// Compare the remaining non-discriminant properties of each match.
 * 	result := TernaryTrue
 * 	for _, t := range matchingTypes {
 * 		result &= r.propertiesRelatedTo(source, t /*reportErrors* /, false, excludedProperties /*optionalsOnly* /, false, IntersectionStateNone)
 * 		if result != TernaryFalse {
 * 			result &= r.signaturesRelatedTo(source, t, SignatureKindCall /*reportErrors* /, false, IntersectionStateNone)
 * 			if result != TernaryFalse {
 * 				result &= r.signaturesRelatedTo(source, t, SignatureKindConstruct /*reportErrors* /, false, IntersectionStateNone)
 * 				if result != TernaryFalse && !(isTupleType(source) && isTupleType(t)) {
 * 					// Comparing numeric index types when both `source` and `type` are tuples is unnecessary as the
 * 					// element types should be sufficiently covered by `propertiesRelatedTo`. It also causes problems
 * 					// with index type assignability as the types for the excluded discriminants are still included
 * 					// in the index type.
 * 					result &= r.indexSignaturesRelatedTo(source, t /*sourceIsPrimitive* /, false /*reportErrors* /, false, IntersectionStateNone)
 * 				}
 * 			}
 * 		}
 * 		if result == TernaryFalse {
 * 			return result
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Relater_typeRelatedToDiscriminatedType(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>): Ternary {
  const sourceProperties = Checker_getPropertiesOfType(receiver!.c, source);
  const sourcePropertiesFiltered = Checker_findDiscriminantProperties(receiver!.c, sourceProperties, target);
  if (sourcePropertiesFiltered.length === 0) {
    return TernaryFalse;
  }
  let numCombinations: int = 1 as int;
  for (const sourceProperty of sourcePropertiesFiltered) {
    numCombinations = (numCombinations * countTypes(Checker_getNonMissingTypeOfSymbol(receiver!.c, sourceProperty))) as int;
    if (numCombinations > 25) {
      if (receiver!.c!.tracer !== undefined) {
        Tracer_Instant(
          receiver!.c!.tracer,
          PhaseCheckTypes,
          "typeRelatedToDiscriminatedType_DepthLimit",
          new globalThis.Map<string, unknown>([
            ["sourceId", source!.id],
            ["targetId", target!.id],
            ["numCombinations", numCombinations],
          ]),
        );
      }
      return TernaryFalse;
    }
    if (numCombinations === 0) {
      return TernaryFalse;
    }
  }
  const sourceDiscriminantTypes: GoPtr<Type>[][] = new globalThis.Array(sourcePropertiesFiltered.length);
  const excludedProperties = NewSetWithSizeHint<string>(0 as int)!;
  for (let i = 0; i < sourcePropertiesFiltered.length; i++) {
    const sourceProperty = sourcePropertiesFiltered[i]!;
    const sourcePropertyType = Checker_getNonMissingTypeOfSymbol(receiver!.c, sourceProperty);
    sourceDiscriminantTypes[i] = Type_Distributed(sourcePropertyType);
    Set_Add(excludedProperties, sourceProperty.Name);
  }
  const discriminantCombinations: GoPtr<Type>[][] = new globalThis.Array(numCombinations);
  for (let i = 0; i < numCombinations; i++) {
    const combination: GoPtr<Type>[] = new globalThis.Array(sourceDiscriminantTypes.length);
    let n = i;
    for (let j = sourceDiscriminantTypes.length - 1; j >= 0; j--) {
      const sourceTypes = sourceDiscriminantTypes[j]!;
      const length = sourceTypes.length;
      combination[j] = sourceTypes[n % length]!;
      n = Math.trunc(n / length);
    }
    discriminantCombinations[i] = combination;
  }
  let matchingTypes: GoPtr<Type>[] = [];
  for (const combination of discriminantCombinations) {
    let hasMatch = false;
    targetLoop: for (const t of Type_Types(target)) {
      for (let i = 0; i < sourcePropertiesFiltered.length; i++) {
        const sourceProperty = sourcePropertiesFiltered[i]!;
        const targetProperty = Checker_getPropertyOfType(receiver!.c, t, sourceProperty.Name);
        if (targetProperty === undefined) {
          continue targetLoop;
        }
        if (sourceProperty === targetProperty) {
          continue;
        }
        const related = Relater_propertyRelatedTo(
          receiver,
          source,
          target,
          sourceProperty,
          targetProperty,
          (): GoPtr<Type> => combination[i],
          false,
          IntersectionStateNone,
          receiver!.c!.strictNullChecks || receiver!.relation === receiver!.c!.comparableRelation,
        );
        if (related === TernaryFalse) {
          continue targetLoop;
        }
      }
      matchingTypes = AppendIfUnique(matchingTypes, t);
      hasMatch = true;
    }
    if (!hasMatch) {
      return TernaryFalse;
    }
  }
  let result: Ternary = TernaryTrue;
  for (const t of matchingTypes) {
    result = (result & Relater_propertiesRelatedTo(receiver, source, t, false, excludedProperties, false, IntersectionStateNone)) as Ternary;
    if (result !== TernaryFalse) {
      result = (result & Relater_signaturesRelatedTo(receiver, source, t, SignatureKindCall, false, IntersectionStateNone)) as Ternary;
      if (result !== TernaryFalse) {
        result = (result & Relater_signaturesRelatedTo(receiver, source, t, SignatureKindConstruct, false, IntersectionStateNone)) as Ternary;
        if (result !== TernaryFalse && !(isTupleType(source) && isTupleType(t))) {
          result = (result & Relater_indexSignaturesRelatedTo(receiver, source, t, false, false, IntersectionStateNone)) as Ternary;
        }
      }
    }
    if (result === TernaryFalse) {
      return result;
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.propertiesRelatedTo","kind":"method","status":"implemented","sigHash":"99701f20d9f8ef10c34c9f2e9dabe76b778d2b7739f2b59fa05832e5c42b151c","bodyHash":"d99c20b3d4628f63fd68824b6b24a2d9d8ffe78c2c5ab57cea094d85aaee2d77"}
 *
 * Go source:
 * func (r *Relater) propertiesRelatedTo(source *Type, target *Type, reportErrors bool, excludedProperties collections.Set[string], optionalsOnly bool, intersectionState IntersectionState) Ternary {
 * 	if r.relation == r.c.identityRelation {
 * 		return r.propertiesIdenticalTo(source, target, excludedProperties)
 * 	}
 * 	result := TernaryTrue
 * 	if isTupleType(target) {
 * 		if r.c.isArrayOrTupleType(source) {
 * 			if !target.TargetTupleType().readonly && (r.c.isReadonlyArrayType(source) || isTupleType(source) && source.TargetTupleType().readonly) {
 * 				return TernaryFalse
 * 			}
 * 			sourceArity := r.c.getTypeReferenceArity(source)
 * 			targetArity := r.c.getTypeReferenceArity(target)
 * 			var sourceRest bool
 * 			if isTupleType(source) {
 * 				sourceRest = source.TargetTupleType().combinedFlags&ElementFlagsRest != 0
 * 			} else {
 * 				sourceRest = true
 * 			}
 * 			targetHasRestElement := target.TargetTupleType().combinedFlags&ElementFlagsVariable != 0
 * 			var sourceMinLength int
 * 			if isTupleType(source) {
 * 				sourceMinLength = source.TargetTupleType().minLength
 * 			} else {
 * 				sourceMinLength = 0
 * 			}
 * 			targetMinLength := target.TargetTupleType().minLength
 * 			if !sourceRest && sourceArity < targetMinLength {
 * 				if reportErrors {
 * 					r.reportError(diagnostics.Source_has_0_element_s_but_target_requires_1, sourceArity, targetMinLength)
 * 				}
 * 				return TernaryFalse
 * 			}
 * 			if !targetHasRestElement && targetArity < sourceMinLength {
 * 				if reportErrors {
 * 					r.reportError(diagnostics.Source_has_0_element_s_but_target_allows_only_1, sourceMinLength, targetArity)
 * 				}
 * 				return TernaryFalse
 * 			}
 * 			if !targetHasRestElement && (sourceRest || targetArity < sourceArity) {
 * 				if reportErrors {
 * 					if sourceMinLength < targetMinLength {
 * 						r.reportError(diagnostics.Target_requires_0_element_s_but_source_may_have_fewer, targetMinLength)
 * 					} else {
 * 						r.reportError(diagnostics.Target_allows_only_0_element_s_but_source_may_have_more, targetArity)
 * 					}
 * 				}
 * 				return TernaryFalse
 * 			}
 * 			sourceTypeArguments := r.c.getTypeArguments(source)
 * 			targetTypeArguments := r.c.getTypeArguments(target)
 * 			targetStartCount := getStartElementCount(target.TargetTupleType(), ElementFlagsNonRest)
 * 			targetEndCount := getEndElementCount(target.TargetTupleType(), ElementFlagsNonRest)
 * 			canExcludeDiscriminants := excludedProperties.Len() != 0
 * 			for sourcePosition := range sourceArity {
 * 				var sourceFlags ElementFlags
 * 				if isTupleType(source) {
 * 					sourceFlags = source.TargetTupleType().elementInfos[sourcePosition].flags
 * 				} else {
 * 					sourceFlags = ElementFlagsRest
 * 				}
 * 				sourcePositionFromEnd := sourceArity - 1 - sourcePosition
 * 				var targetPosition int
 * 				if targetHasRestElement && sourcePosition >= targetStartCount {
 * 					targetPosition = targetArity - 1 - min(sourcePositionFromEnd, targetEndCount)
 * 				} else {
 * 					targetPosition = sourcePosition
 * 				}
 * 				targetFlags := ElementFlagsNone
 * 				if targetPosition >= 0 {
 * 					targetFlags = target.TargetTupleType().elementInfos[targetPosition].flags
 * 				}
 * 				if targetFlags&ElementFlagsVariadic != 0 && sourceFlags&ElementFlagsVariadic == 0 {
 * 					if reportErrors {
 * 						r.reportError(diagnostics.Source_provides_no_match_for_variadic_element_at_position_0_in_target, targetPosition)
 * 					}
 * 					return TernaryFalse
 * 				}
 * 				if sourceFlags&ElementFlagsVariadic != 0 && targetFlags&ElementFlagsVariable == 0 {
 * 					if reportErrors {
 * 						r.reportError(diagnostics.Variadic_element_at_position_0_in_source_does_not_match_element_at_position_1_in_target, sourcePosition, targetPosition)
 * 					}
 * 					return TernaryFalse
 * 				}
 * 				if targetFlags&ElementFlagsRequired != 0 && sourceFlags&ElementFlagsRequired == 0 {
 * 					if reportErrors {
 * 						r.reportError(diagnostics.Source_provides_no_match_for_required_element_at_position_0_in_target, targetPosition)
 * 					}
 * 					return TernaryFalse
 * 				}
 * 				// We can only exclude discriminant properties if we have not yet encountered a variable-length element.
 * 				if canExcludeDiscriminants {
 * 					if sourceFlags&ElementFlagsVariable != 0 || targetFlags&ElementFlagsVariable != 0 {
 * 						canExcludeDiscriminants = false
 * 					}
 * 					if canExcludeDiscriminants && excludedProperties.Has(strconv.Itoa(sourcePosition)) {
 * 						continue
 * 					}
 * 				}
 * 				sourceType := r.c.removeMissingType(sourceTypeArguments[sourcePosition], sourceFlags&targetFlags&ElementFlagsOptional != 0)
 * 				targetType := targetTypeArguments[targetPosition]
 * 				var targetCheckType *Type
 * 				if sourceFlags&ElementFlagsVariadic != 0 && targetFlags&ElementFlagsRest != 0 {
 * 					targetCheckType = r.c.createArrayType(targetType)
 * 				} else {
 * 					targetCheckType = r.c.removeMissingType(targetType, targetFlags&ElementFlagsOptional != 0)
 * 				}
 * 				related := r.isRelatedToEx(sourceType, targetCheckType, RecursionFlagsBoth, reportErrors, nil /*headMessage* /, intersectionState)
 * 				if related == TernaryFalse {
 * 					if reportErrors && (targetArity > 1 || sourceArity > 1) {
 * 						if targetHasRestElement && sourcePosition >= targetStartCount && sourcePositionFromEnd >= targetEndCount && targetStartCount != sourceArity-targetEndCount-1 {
 * 							r.reportError(diagnostics.Type_at_positions_0_through_1_in_source_is_not_compatible_with_type_at_position_2_in_target, targetStartCount, sourceArity-targetEndCount-1, targetPosition)
 * 						} else {
 * 							r.reportError(diagnostics.Type_at_position_0_in_source_is_not_compatible_with_type_at_position_1_in_target, sourcePosition, targetPosition)
 * 						}
 * 					}
 * 					return TernaryFalse
 * 				}
 * 				result &= related
 * 			}
 * 			return result
 * 		}
 * 		if target.TargetTupleType().combinedFlags&ElementFlagsVariable != 0 {
 * 			return TernaryFalse
 * 		}
 * 	}
 * 	requireOptionalProperties := (r.relation == r.c.subtypeRelation || r.relation == r.c.strictSubtypeRelation) && !isObjectLiteralType(source) && !r.c.isEmptyArrayLiteralType(source) && !isTupleType(source)
 * 	unmatchedProperty := r.c.getUnmatchedProperty(source, target, requireOptionalProperties, false /*matchDiscriminantProperties* /)
 * 	if unmatchedProperty != nil {
 * 		if reportErrors && r.c.shouldReportUnmatchedPropertyError(source, target) {
 * 			r.reportUnmatchedProperty(source, target, unmatchedProperty, requireOptionalProperties)
 * 		}
 * 		return TernaryFalse
 * 	}
 * 	if isObjectLiteralType(target) {
 * 		for _, sourceProp := range excludeProperties(r.c.getPropertiesOfType(source), excludedProperties) {
 * 			if r.c.getPropertyOfObjectType(target, sourceProp.Name) == nil {
 * 				if reportErrors {
 * 					r.reportError(diagnostics.Property_0_does_not_exist_on_type_1, r.c.symbolToString(sourceProp), r.c.TypeToString(target))
 * 				}
 * 				return TernaryFalse
 * 			}
 * 		}
 * 	}
 * 	// We only call this for union target types when we're attempting to do excess property checking - in those cases, we want to get _all possible props_
 * 	// from the target union, across all members
 * 	properties := r.c.getPropertiesOfType(target)
 * 	numericNamesOnly := isTupleType(source) && isTupleType(target)
 * 	for _, targetProp := range excludeProperties(properties, excludedProperties) {
 * 		name := targetProp.Name
 * 		if targetProp.Flags&ast.SymbolFlagsPrototype == 0 && (!numericNamesOnly || isNumericLiteralName(name) || name == "length") && (!optionalsOnly || targetProp.Flags&ast.SymbolFlagsOptional != 0) {
 * 			sourceProp := r.c.getPropertyOfType(source, name)
 * 			if sourceProp != nil && sourceProp != targetProp {
 * 				related := r.propertyRelatedTo(source, target, sourceProp, targetProp, r.c.getNonMissingTypeOfSymbol, reportErrors, intersectionState, r.relation == r.c.comparableRelation)
 * 				if related == TernaryFalse {
 * 					return TernaryFalse
 * 				}
 * 				result &= related
 * 			}
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Relater_propertiesRelatedTo(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, reportErrors: bool, excludedProperties: Set, optionalsOnly: bool, intersectionState: IntersectionState): Ternary {
  if (receiver!.relation === receiver!.c!.identityRelation) {
    return Relater_propertiesIdenticalTo(receiver, source, target, excludedProperties);
  }
  let result: Ternary = TernaryTrue;
  if (isTupleType(target)) {
    const targetTupleType = Type_TargetTupleType(target)!;
    if (Checker_isArrayOrTupleType(receiver!.c, source)) {
      if (!targetTupleType.readonly && (Checker_isReadonlyArrayType(receiver!.c, source) || (isTupleType(source) && Type_TargetTupleType(source)!.readonly))) {
        return TernaryFalse;
      }
      const sourceArity = Checker_getTypeReferenceArity(receiver!.c, source);
      const targetArity = Checker_getTypeReferenceArity(receiver!.c, target);
      let sourceRest: bool;
      if (isTupleType(source)) {
        sourceRest = (Type_TargetTupleType(source)!.combinedFlags & ElementFlagsRest) !== 0;
      } else {
        sourceRest = true;
      }
      const targetHasRestElement = (targetTupleType.combinedFlags & ElementFlagsVariable) !== 0;
      let sourceMinLength: int;
      if (isTupleType(source)) {
        sourceMinLength = Type_TargetTupleType(source)!.minLength;
      } else {
        sourceMinLength = 0 as int;
      }
      const targetMinLength = targetTupleType.minLength;
      if (!sourceRest && sourceArity < targetMinLength) {
        if (reportErrors) {
          Relater_reportError(receiver, Source_has_0_element_s_but_target_requires_1, sourceArity, targetMinLength);
        }
        return TernaryFalse;
      }
      if (!targetHasRestElement && targetArity < sourceMinLength) {
        if (reportErrors) {
          Relater_reportError(receiver, Source_has_0_element_s_but_target_allows_only_1, sourceMinLength, targetArity);
        }
        return TernaryFalse;
      }
      if (!targetHasRestElement && (sourceRest || targetArity < sourceArity)) {
        if (reportErrors) {
          if (sourceMinLength < targetMinLength) {
            Relater_reportError(receiver, Target_requires_0_element_s_but_source_may_have_fewer, targetMinLength);
          } else {
            Relater_reportError(receiver, Target_allows_only_0_element_s_but_source_may_have_more, targetArity);
          }
        }
        return TernaryFalse;
      }
      const sourceTypeArguments = Checker_getTypeArguments(receiver!.c, source);
      const targetTypeArguments = Checker_getTypeArguments(receiver!.c, target);
      const targetStartCount = getStartElementCount(targetTupleType, ElementFlagsNonRest as ElementFlags);
      const targetEndCount = getEndElementCount(targetTupleType, ElementFlagsNonRest as ElementFlags);
      let canExcludeDiscriminants = Set_Len(excludedProperties) !== 0;
      for (let sourcePosition = 0; sourcePosition < sourceArity; sourcePosition++) {
        let sourceFlags: ElementFlags;
        if (isTupleType(source)) {
          sourceFlags = Type_TargetTupleType(source)!.elementInfos[sourcePosition]!.flags;
        } else {
          sourceFlags = ElementFlagsRest;
        }
        const sourcePositionFromEnd = sourceArity - 1 - sourcePosition;
        let targetPosition: int;
        if (targetHasRestElement && sourcePosition >= targetStartCount) {
          targetPosition = (targetArity - 1 - Math.min(sourcePositionFromEnd, targetEndCount)) as int;
        } else {
          targetPosition = sourcePosition as int;
        }
        let targetFlags: ElementFlags = ElementFlagsNone;
        if (targetPosition >= 0) {
          targetFlags = targetTupleType.elementInfos[targetPosition]!.flags;
        }
        if ((targetFlags & ElementFlagsVariadic) !== 0 && (sourceFlags & ElementFlagsVariadic) === 0) {
          if (reportErrors) {
            Relater_reportError(receiver, Source_provides_no_match_for_variadic_element_at_position_0_in_target, targetPosition);
          }
          return TernaryFalse;
        }
        if ((sourceFlags & ElementFlagsVariadic) !== 0 && (targetFlags & ElementFlagsVariable) === 0) {
          if (reportErrors) {
            Relater_reportError(receiver, Variadic_element_at_position_0_in_source_does_not_match_element_at_position_1_in_target, sourcePosition, targetPosition);
          }
          return TernaryFalse;
        }
        if ((targetFlags & ElementFlagsRequired) !== 0 && (sourceFlags & ElementFlagsRequired) === 0) {
          if (reportErrors) {
            Relater_reportError(receiver, Source_provides_no_match_for_required_element_at_position_0_in_target, targetPosition);
          }
          return TernaryFalse;
        }
        if (canExcludeDiscriminants) {
          if ((sourceFlags & ElementFlagsVariable) !== 0 || (targetFlags & ElementFlagsVariable) !== 0) {
            canExcludeDiscriminants = false;
          }
          if (canExcludeDiscriminants && Set_Has(excludedProperties, `${sourcePosition}`)) {
            continue;
          }
        }
        const sourceType = Checker_removeMissingType(receiver!.c, sourceTypeArguments[sourcePosition], (sourceFlags & targetFlags & ElementFlagsOptional) !== 0);
        const targetType = targetTypeArguments[targetPosition];
        let targetCheckType: GoPtr<Type>;
        if ((sourceFlags & ElementFlagsVariadic) !== 0 && (targetFlags & ElementFlagsRest) !== 0) {
          targetCheckType = Checker_createArrayType(receiver!.c, targetType);
        } else {
          targetCheckType = Checker_removeMissingType(receiver!.c, targetType, (targetFlags & ElementFlagsOptional) !== 0);
        }
        const related = Relater_isRelatedToEx(receiver, sourceType, targetCheckType, RecursionFlagsBoth, reportErrors, undefined, intersectionState);
        if (related === TernaryFalse) {
          if (reportErrors && (targetArity > 1 || sourceArity > 1)) {
            if (targetHasRestElement && sourcePosition >= targetStartCount && sourcePositionFromEnd >= targetEndCount && targetStartCount !== sourceArity - targetEndCount - 1) {
              Relater_reportError(receiver, Type_at_positions_0_through_1_in_source_is_not_compatible_with_type_at_position_2_in_target, targetStartCount, sourceArity - targetEndCount - 1, targetPosition);
            } else {
              Relater_reportError(receiver, Type_at_position_0_in_source_is_not_compatible_with_type_at_position_1_in_target, sourcePosition, targetPosition);
            }
          }
          return TernaryFalse;
        }
        result = (result & related) as Ternary;
      }
      return result;
    }
    if ((targetTupleType.combinedFlags & ElementFlagsVariable) !== 0) {
      return TernaryFalse;
    }
  }
  const requireOptionalProperties =
    (receiver!.relation === receiver!.c!.subtypeRelation || receiver!.relation === receiver!.c!.strictSubtypeRelation) &&
    !isObjectLiteralType(source) &&
    !Checker_isEmptyArrayLiteralType(receiver!.c, source) &&
    !isTupleType(source);
  const unmatchedProperty = Checker_getUnmatchedProperty(receiver!.c, source, target, requireOptionalProperties, false);
  if (unmatchedProperty !== undefined) {
    if (reportErrors && Checker_shouldReportUnmatchedPropertyError(receiver!.c, source, target)) {
      Relater_reportUnmatchedProperty(receiver, source, target, unmatchedProperty, requireOptionalProperties);
    }
    return TernaryFalse;
  }
  if (isObjectLiteralType(target)) {
    for (const sourceProp of excludeProperties(Checker_getPropertiesOfType(receiver!.c, source), excludedProperties)) {
      if (Checker_getPropertyOfObjectType(receiver!.c, target, sourceProp!.Name) === undefined) {
        if (reportErrors) {
          Relater_reportError(receiver, Property_0_does_not_exist_on_type_1, Checker_symbolToString(receiver!.c, sourceProp), Checker_TypeToString(receiver!.c, target));
        }
        return TernaryFalse;
      }
    }
  }
  const properties = Checker_getPropertiesOfType(receiver!.c, target);
  const numericNamesOnly = isTupleType(source) && isTupleType(target);
  for (const targetProp of excludeProperties(properties, excludedProperties)) {
    const name = targetProp!.Name;
    if ((targetProp!.Flags & SymbolFlagsPrototype) === 0 && (!numericNamesOnly || isNumericLiteralName(name) || name === "length") && (!optionalsOnly || (targetProp!.Flags & SymbolFlagsOptional) !== 0)) {
      const sourceProp = Checker_getPropertyOfType(receiver!.c, source, name);
      if (sourceProp !== undefined && sourceProp !== targetProp) {
        const related = Relater_propertyRelatedTo(
          receiver,
          source,
          target,
          sourceProp,
          targetProp,
          (sym) => Checker_getNonMissingTypeOfSymbol(receiver!.c, sym),
          reportErrors,
          intersectionState,
          receiver!.relation === receiver!.c!.comparableRelation,
        );
        if (related === TernaryFalse) {
          return TernaryFalse;
        }
        result = (result & related) as Ternary;
      }
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.propertyRelatedTo","kind":"method","status":"implemented","sigHash":"d36649bac3404adb68eb73bc209cb5f12984e0278ae4c5b88220a24cb062e2bb","bodyHash":"030e73e1710d380ca066390756c9eee8569c049c083f417d97a7765ee0b32e9f"}
 *
 * Go source:
 * func (r *Relater) propertyRelatedTo(source *Type, target *Type, sourceProp *ast.Symbol, targetProp *ast.Symbol, getTypeOfSourceProperty func(sym *ast.Symbol) *Type, reportErrors bool, intersectionState IntersectionState, skipOptional bool) Ternary {
 * 	sourcePropFlags := getDeclarationModifierFlagsFromSymbol(sourceProp)
 * 	targetPropFlags := getDeclarationModifierFlagsFromSymbol(targetProp)
 * 	switch {
 * 	case sourcePropFlags&ast.ModifierFlagsPrivate != 0 || targetPropFlags&ast.ModifierFlagsPrivate != 0:
 * 		if sourceProp.ValueDeclaration != targetProp.ValueDeclaration {
 * 			if reportErrors {
 * 				if sourcePropFlags&ast.ModifierFlagsPrivate != 0 && targetPropFlags&ast.ModifierFlagsPrivate != 0 {
 * 					r.reportError(diagnostics.Types_have_separate_declarations_of_a_private_property_0, r.c.symbolToString(targetProp))
 * 				} else {
 * 					r.reportError(diagnostics.Property_0_is_private_in_type_1_but_not_in_type_2, r.c.symbolToString(targetProp), r.c.TypeToString(core.IfElse(sourcePropFlags&ast.ModifierFlagsPrivate != 0, source, target)), r.c.TypeToString(core.IfElse(sourcePropFlags&ast.ModifierFlagsPrivate != 0, target, source)))
 * 				}
 * 			}
 * 			return TernaryFalse
 * 		}
 * 	case targetPropFlags&ast.ModifierFlagsProtected != 0:
 * 		if !r.c.isValidOverrideOf(sourceProp, targetProp) {
 * 			if reportErrors {
 * 				sourceType := core.OrElse(r.c.getDeclaringClass(sourceProp), source)
 * 				targetType := core.OrElse(r.c.getDeclaringClass(targetProp), target)
 * 				r.reportError(diagnostics.Property_0_is_protected_but_type_1_is_not_a_class_derived_from_2, r.c.symbolToString(targetProp), r.c.TypeToString(sourceType), r.c.TypeToString(targetType))
 * 			}
 * 			return TernaryFalse
 * 		}
 * 	case sourcePropFlags&ast.ModifierFlagsProtected != 0:
 * 		if reportErrors {
 * 			r.reportError(diagnostics.Property_0_is_protected_in_type_1_but_public_in_type_2, r.c.symbolToString(targetProp), r.c.TypeToString(source), r.c.TypeToString(target))
 * 		}
 * 		return TernaryFalse
 * 	}
 * 	// Ensure {readonly a: whatever} is not a subtype of {a: whatever},
 * 	// while {a: whatever} is a subtype of {readonly a: whatever}.
 * 	// This ensures the subtype relationship is ordered, and preventing declaration order
 * 	// from deciding which type "wins" in union subtype reduction.
 * 	// They're still assignable to one another, since `readonly` doesn't affect assignability.
 * 	// This is only applied during the strictSubtypeRelation -- currently used in subtype reduction
 * 	if r.relation == r.c.strictSubtypeRelation && r.c.isReadonlySymbol(sourceProp) && !r.c.isReadonlySymbol(targetProp) {
 * 		return TernaryFalse
 * 	}
 * 	// If the target comes from a partial union prop, allow `undefined` in the target type
 * 	related := r.isPropertySymbolTypeRelated(sourceProp, targetProp, getTypeOfSourceProperty, reportErrors, intersectionState)
 * 	if related == TernaryFalse {
 * 		if reportErrors {
 * 			r.reportError(diagnostics.Types_of_property_0_are_incompatible, r.c.symbolToString(targetProp))
 * 		}
 * 		return TernaryFalse
 * 	}
 * 	// When checking for comparability, be more lenient with optional properties.
 * 	if !skipOptional && sourceProp.Flags&ast.SymbolFlagsOptional != 0 && targetProp.Flags&ast.SymbolFlagsClassMember != 0 && targetProp.Flags&ast.SymbolFlagsOptional == 0 {
 * 		// TypeScript 1.0 spec (April 2014): 3.8.3
 * 		// S is a subtype of a type T, and T is a supertype of S if ...
 * 		// S' and T are object types and, for each member M in T..
 * 		// M is a property and S' contains a property N where
 * 		// if M is a required property, N is also a required property
 * 		// (M - property in T)
 * 		// (N - property in S)
 * 		if reportErrors {
 * 			r.reportError(diagnostics.Property_0_is_optional_in_type_1_but_required_in_type_2, r.c.symbolToString(targetProp), r.c.TypeToString(source), r.c.TypeToString(target))
 * 		}
 * 		return TernaryFalse
 * 	}
 * 	return related
 * }
 */
export function Relater_propertyRelatedTo(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, sourceProp: GoPtr<Symbol>, targetProp: GoPtr<Symbol>, getTypeOfSourceProperty: (sym: GoPtr<Symbol>) => GoPtr<Type>, reportErrors: bool, intersectionState: IntersectionState, skipOptional: bool): Ternary {
  const sourcePropFlags = getDeclarationModifierFlagsFromSymbol(sourceProp);
  const targetPropFlags = getDeclarationModifierFlagsFromSymbol(targetProp);
  if ((sourcePropFlags & ModifierFlagsPrivate) !== 0 || (targetPropFlags & ModifierFlagsPrivate) !== 0) {
    if (sourceProp!.ValueDeclaration !== targetProp!.ValueDeclaration) {
      if (reportErrors) {
        if ((sourcePropFlags & ModifierFlagsPrivate) !== 0 && (targetPropFlags & ModifierFlagsPrivate) !== 0) {
          Relater_reportError(receiver, Types_have_separate_declarations_of_a_private_property_0, Checker_symbolToString(receiver!.c, targetProp));
        } else {
          Relater_reportError(
            receiver,
            Property_0_is_private_in_type_1_but_not_in_type_2,
            Checker_symbolToString(receiver!.c, targetProp),
            Checker_TypeToString(receiver!.c, (sourcePropFlags & ModifierFlagsPrivate) !== 0 ? source : target),
            Checker_TypeToString(receiver!.c, (sourcePropFlags & ModifierFlagsPrivate) !== 0 ? target : source),
          );
        }
      }
      return TernaryFalse;
    }
  } else if ((targetPropFlags & ModifierFlagsProtected) !== 0) {
    if (!Checker_isValidOverrideOf(receiver!.c, sourceProp, targetProp)) {
      if (reportErrors) {
        const sourceType = OrElse(Checker_getDeclaringClass(receiver!.c, sourceProp), source);
        const targetType = OrElse(Checker_getDeclaringClass(receiver!.c, targetProp), target);
        Relater_reportError(
          receiver,
          Property_0_is_protected_but_type_1_is_not_a_class_derived_from_2,
          Checker_symbolToString(receiver!.c, targetProp),
          Checker_TypeToString(receiver!.c, sourceType),
          Checker_TypeToString(receiver!.c, targetType),
        );
      }
      return TernaryFalse;
    }
  } else if ((sourcePropFlags & ModifierFlagsProtected) !== 0) {
    if (reportErrors) {
      Relater_reportError(
        receiver,
        Property_0_is_protected_in_type_1_but_public_in_type_2,
        Checker_symbolToString(receiver!.c, targetProp),
        Checker_TypeToString(receiver!.c, source),
        Checker_TypeToString(receiver!.c, target),
      );
    }
    return TernaryFalse;
  }
  if (receiver!.relation === receiver!.c!.strictSubtypeRelation && Checker_isReadonlySymbol(receiver!.c, sourceProp) && !Checker_isReadonlySymbol(receiver!.c, targetProp)) {
    return TernaryFalse;
  }
  const related = Relater_isPropertySymbolTypeRelated(receiver, sourceProp, targetProp, getTypeOfSourceProperty, reportErrors, intersectionState);
  if (related === TernaryFalse) {
    if (reportErrors) {
      Relater_reportError(receiver, Types_of_property_0_are_incompatible, Checker_symbolToString(receiver!.c, targetProp));
    }
    return TernaryFalse;
  }
  if (!skipOptional && (sourceProp!.Flags & SymbolFlagsOptional) !== 0 && (targetProp!.Flags & SymbolFlagsClassMember) !== 0 && (targetProp!.Flags & SymbolFlagsOptional) === 0) {
    if (reportErrors) {
      Relater_reportError(
        receiver,
        Property_0_is_optional_in_type_1_but_required_in_type_2,
        Checker_symbolToString(receiver!.c, targetProp),
        Checker_TypeToString(receiver!.c, source),
        Checker_TypeToString(receiver!.c, target),
      );
    }
    return TernaryFalse;
  }
  return related;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.isPropertySymbolTypeRelated","kind":"method","status":"implemented","sigHash":"81112259febc815ef8cee2832e2a6f10051a945fc5a8714ec83fe4d76c26a8b1","bodyHash":"dfdea5ffbd33b9b07190128698be600741eeb4ec0727b03fab3c37a23f5244b8"}
 *
 * Go source:
 * func (r *Relater) isPropertySymbolTypeRelated(sourceProp *ast.Symbol, targetProp *ast.Symbol, getTypeOfSourceProperty func(sym *ast.Symbol) *Type, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	targetIsOptional := r.c.strictNullChecks && targetProp.CheckFlags&ast.CheckFlagsPartial != 0
 * 	effectiveTarget := r.c.addOptionalityEx(r.c.getNonMissingTypeOfSymbol(targetProp), false /*isProperty* /, targetIsOptional)
 * 	// source could resolve to `any` and that's not related to `unknown` target under strict subtype relation
 * 	if effectiveTarget.flags&core.IfElse(r.relation == r.c.strictSubtypeRelation, TypeFlagsAny, TypeFlagsAnyOrUnknown) != 0 {
 * 		return TernaryTrue
 * 	}
 * 	effectiveSource := getTypeOfSourceProperty(sourceProp)
 * 	return r.isRelatedToEx(effectiveSource, effectiveTarget, RecursionFlagsBoth, reportErrors, nil /*headMessage* /, intersectionState)
 * }
 */
export function Relater_isPropertySymbolTypeRelated(receiver: GoPtr<Relater>, sourceProp: GoPtr<Symbol>, targetProp: GoPtr<Symbol>, getTypeOfSourceProperty: (sym: GoPtr<Symbol>) => GoPtr<Type>, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  const targetIsOptional = receiver!.c!.strictNullChecks && (targetProp!.CheckFlags & CheckFlagsPartial) !== 0;
  const rawTarget = Checker_getNonMissingTypeOfSymbol(receiver!.c, targetProp);
  const effectiveTarget = Checker_addOptionalityEx(receiver!.c, rawTarget, false, targetIsOptional);
  // source could resolve to `any` and that's not related to `unknown` target under strict subtype relation
  if ((effectiveTarget!.flags & (receiver!.relation === receiver!.c!.strictSubtypeRelation ? TypeFlagsAny : TypeFlagsAnyOrUnknown)) !== 0) {
    return TernaryTrue;
  }
  const effectiveSource = getTypeOfSourceProperty(sourceProp);
  return Relater_isRelatedToEx(receiver, effectiveSource, effectiveTarget, RecursionFlagsBoth, reportErrors, undefined, intersectionState);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.reportUnmatchedProperty","kind":"method","status":"implemented","sigHash":"6ef12d9574708d45956f1534bdfe400304de54e3b4d53b82a5e63c4a5210b285","bodyHash":"67036847466969e61a6faf62ec3ea57f45297e813e8512f4115f256d40ebc901"}
 *
 * Go source:
 * func (r *Relater) reportUnmatchedProperty(source *Type, target *Type, unmatchedProperty *ast.Symbol, requireOptionalProperties bool) {
 * 	// give specific error in case where private names have the same description
 * 	if unmatchedProperty.ValueDeclaration != nil &&
 * 		unmatchedProperty.ValueDeclaration.Name() != nil &&
 * 		ast.IsPrivateIdentifier(unmatchedProperty.ValueDeclaration.Name()) &&
 * 		source.symbol != nil &&
 * 		source.symbol.Flags&ast.SymbolFlagsClass != 0 {
 * 		privateIdentifierDescription := unmatchedProperty.ValueDeclaration.Name().Text()
 * 		symbolTableKey := binder.GetSymbolNameForPrivateIdentifier(source.symbol, privateIdentifierDescription)
 * 		if r.c.getPropertyOfType(source, symbolTableKey) != nil {
 * 			r.reportError(diagnostics.Property_0_in_type_1_refers_to_a_different_member_that_cannot_be_accessed_from_within_type_2, privateIdentifierDescription, r.c.SymbolToString(source.symbol), r.c.SymbolToString(target.symbol))
 * 			return
 * 		}
 * 	}
 * 	props := r.c.getUnmatchedProperties(source, target, requireOptionalProperties, false /*matchDiscriminantProperties* /)
 * 	if len(props) == 1 {
 * 		sourceType, targetType := r.c.getTypeNamesForErrorDisplay(source, target)
 * 		propName := r.c.symbolToString(unmatchedProperty)
 * 		r.reportError(diagnostics.Property_0_is_missing_in_type_1_but_required_in_type_2, propName, sourceType, targetType)
 * 		if len(unmatchedProperty.Declarations) != 0 {
 * 			r.relatedInfo = append(r.relatedInfo, createDiagnosticForNode(unmatchedProperty.Declarations[0], diagnostics.X_0_is_declared_here, propName))
 * 		}
 * 	} else if r.tryElaborateArrayLikeErrors(source, target, false /*reportErrors* /) {
 * 		sourceType, targetType := r.c.getTypeNamesForErrorDisplay(source, target)
 * 		if len(props) > 5 {
 * 			propNames := strings.Join(core.Map(props[:4], r.c.symbolToString), ", ")
 * 			r.reportError(diagnostics.Type_0_is_missing_the_following_properties_from_type_1_Colon_2_and_3_more, sourceType, targetType, propNames, len(props)-4)
 * 		} else {
 * 			propNames := strings.Join(core.Map(props, r.c.symbolToString), ", ")
 * 			r.reportError(diagnostics.Type_0_is_missing_the_following_properties_from_type_1_Colon_2, sourceType, targetType, propNames)
 * 		}
 * 	}
 * }
 */
export function Relater_reportUnmatchedProperty(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, unmatchedProperty: GoPtr<Symbol>, requireOptionalProperties: bool): void {
  if (
    unmatchedProperty!.ValueDeclaration !== undefined &&
    Node_Name(unmatchedProperty!.ValueDeclaration) !== undefined &&
    IsPrivateIdentifier(Node_Name(unmatchedProperty!.ValueDeclaration)) &&
    source!.symbol !== undefined &&
    (source!.symbol!.Flags & SymbolFlagsClass) !== 0
  ) {
    const privateIdentifierDescription = Node_Text(Node_Name(unmatchedProperty!.ValueDeclaration)!);
    const symbolTableKey = GetSymbolNameForPrivateIdentifier(source!.symbol, privateIdentifierDescription);
    if (Checker_getPropertyOfType(receiver!.c, source, symbolTableKey) !== undefined) {
      Relater_reportError(
        receiver,
        Property_0_in_type_1_refers_to_a_different_member_that_cannot_be_accessed_from_within_type_2,
        privateIdentifierDescription,
        Checker_symbolToString(receiver!.c, source!.symbol),
        Checker_symbolToString(receiver!.c, target!.symbol),
      );
      return;
    }
  }
  const props = Checker_getUnmatchedProperties(receiver!.c, source, target, requireOptionalProperties, false);
  if (props.length === 1) {
    const [sourceType, targetType] = Checker_getTypeNamesForErrorDisplay(receiver!.c, source, target);
    const propName = Checker_symbolToString(receiver!.c, unmatchedProperty);
    Relater_reportError(receiver, Property_0_is_missing_in_type_1_but_required_in_type_2, propName, sourceType, targetType);
    if ((unmatchedProperty!.Declarations?.length ?? 0) !== 0) {
      receiver!.relatedInfo.push(createDiagnosticForNode(unmatchedProperty!.Declarations![0], X_0_is_declared_here, propName));
    }
  } else if (Relater_tryElaborateArrayLikeErrors(receiver, source, target, false)) {
    const [sourceType, targetType] = Checker_getTypeNamesForErrorDisplay(receiver!.c, source, target);
    if (props.length > 5) {
      const propNames = props.slice(0, 4).map((prop: GoPtr<Symbol>) => Checker_symbolToString(receiver!.c, prop)).join(", ");
      Relater_reportError(receiver, Type_0_is_missing_the_following_properties_from_type_1_Colon_2_and_3_more, sourceType, targetType, propNames, props.length - 4);
    } else {
      const propNames = props.map((prop: GoPtr<Symbol>) => Checker_symbolToString(receiver!.c, prop)).join(", ");
      Relater_reportError(receiver, Type_0_is_missing_the_following_properties_from_type_1_Colon_2, sourceType, targetType, propNames);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.tryElaborateArrayLikeErrors","kind":"method","status":"implemented","sigHash":"6870f2ee8ff0f9c1dde83d40f8b5ff4efe06201cdf012eef4bb338ad9e7562a8","bodyHash":"636297f7498ce7e65261c62a421055426247832083bfa04d9f23e8405936d07d"}
 *
 * Go source:
 * func (r *Relater) tryElaborateArrayLikeErrors(source *Type, target *Type, reportErrors bool) bool {
 * 	/**
 * 	 * The spec for elaboration is:
 * 	 * - If the source is a readonly tuple and the target is a mutable array or tuple, elaborate on mutability and skip property elaborations.
 * 	 * - If the source is a tuple then skip property elaborations if the target is an array or tuple.
 * 	 * - If the source is a readonly array and the target is a mutable array or tuple, elaborate on mutability and skip property elaborations.
 * 	 * - If the source an array then skip property elaborations if the target is a tuple.
 * 	 * /
 * 	if isTupleType(source) {
 * 		if source.TargetTupleType().readonly && r.c.isMutableArrayOrTuple(target) {
 * 			if reportErrors {
 * 				r.reportError(diagnostics.The_type_0_is_readonly_and_cannot_be_assigned_to_the_mutable_type_1, r.c.TypeToString(source), r.c.TypeToString(target))
 * 			}
 * 			return false
 * 		}
 * 		return r.c.isArrayOrTupleType(target)
 * 	}
 * 	if r.c.isReadonlyArrayType(source) && r.c.isMutableArrayOrTuple(target) {
 * 		if reportErrors {
 * 			r.reportError(diagnostics.The_type_0_is_readonly_and_cannot_be_assigned_to_the_mutable_type_1, r.c.TypeToString(source), r.c.TypeToString(target))
 * 		}
 * 		return false
 * 	}
 * 	if isTupleType(target) {
 * 		return r.c.isArrayType(source)
 * 	}
 * 	return true
 * }
 */
export function Relater_tryElaborateArrayLikeErrors(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, reportErrors: bool): bool {
  if (isTupleType(source)) {
    if (Type_TargetTupleType(source)!.readonly && Checker_isMutableArrayOrTuple(receiver!.c, target)) {
      if (reportErrors) {
        Relater_reportError(receiver, The_type_0_is_readonly_and_cannot_be_assigned_to_the_mutable_type_1, Checker_TypeToString(receiver!.c, source), Checker_TypeToString(receiver!.c, target));
      }
      return false;
    }
    return Checker_isArrayOrTupleType(receiver!.c, target);
  }
  if (Checker_isReadonlyArrayType(receiver!.c, source) && Checker_isMutableArrayOrTuple(receiver!.c, target)) {
    if (reportErrors) {
      Relater_reportError(receiver, The_type_0_is_readonly_and_cannot_be_assigned_to_the_mutable_type_1, Checker_TypeToString(receiver!.c, source), Checker_TypeToString(receiver!.c, target));
    }
    return false;
  }
  if (isTupleType(target)) {
    return Checker_isArrayType(receiver!.c, source);
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.tryElaborateErrorsForPrimitivesAndObjects","kind":"method","status":"implemented","sigHash":"52b3b09b6143e8e2038250ee23487d821becc9a40e4cc4ea8400681977b3ec38","bodyHash":"74b87ee1bffb330316380bfee5c2299c525a7cda5b10daa855a117f357219bcf"}
 *
 * Go source:
 * func (r *Relater) tryElaborateErrorsForPrimitivesAndObjects(source *Type, target *Type) {
 * 	if (source == r.c.globalStringType && target == r.c.stringType) ||
 * 		(source == r.c.globalNumberType && target == r.c.numberType) ||
 * 		(source == r.c.globalBooleanType && target == r.c.booleanType) ||
 * 		(source == r.c.getGlobalESSymbolType() && target == r.c.esSymbolType) {
 * 		r.reportError(diagnostics.X_0_is_a_primitive_but_1_is_a_wrapper_object_Prefer_using_0_when_possible, r.c.TypeToString(target), r.c.TypeToString(source))
 * 	}
 * }
 */
export function Relater_tryElaborateErrorsForPrimitivesAndObjects(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>): void {
  if (
    (source === receiver!.c!.globalStringType && target === receiver!.c!.stringType) ||
    (source === receiver!.c!.globalNumberType && target === receiver!.c!.numberType) ||
    (source === receiver!.c!.globalBooleanType && target === receiver!.c!.booleanType) ||
    (source === receiver!.c!.getGlobalESSymbolType() && target === receiver!.c!.esSymbolType)
  ) {
    Relater_reportError(receiver, X_0_is_a_primitive_but_1_is_a_wrapper_object_Prefer_using_0_when_possible, Checker_TypeToString(receiver!.c, target), Checker_TypeToString(receiver!.c, source));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.propertiesIdenticalTo","kind":"method","status":"implemented","sigHash":"d4e2e1e28026b49a51690bd2fa62f4a2650f7bd6f9e1a27162b282c64754c6a8","bodyHash":"d7f4068a2a871c41a8e682b4857bedba90fb31f7cbb433ebcfd41a65c42ae49e"}
 *
 * Go source:
 * func (r *Relater) propertiesIdenticalTo(source *Type, target *Type, excludedProperties collections.Set[string]) Ternary {
 * 	if source.flags&TypeFlagsObject == 0 || target.flags&TypeFlagsObject == 0 {
 * 		return TernaryFalse
 * 	}
 * 	sourceProperties := excludeProperties(r.c.getPropertiesOfObjectType(source), excludedProperties)
 * 	targetProperties := excludeProperties(r.c.getPropertiesOfObjectType(target), excludedProperties)
 * 	if len(sourceProperties) != len(targetProperties) {
 * 		return TernaryFalse
 * 	}
 * 	result := TernaryTrue
 * 	for _, sourceProp := range sourceProperties {
 * 		targetProp := r.c.getPropertyOfObjectType(target, sourceProp.Name)
 * 		if targetProp == nil {
 * 			return TernaryFalse
 * 		}
 * 		related := r.c.compareProperties(sourceProp, targetProp, r.isRelatedToSimple)
 * 		if related == TernaryFalse {
 * 			return TernaryFalse
 * 		}
 * 		result &= related
 * 	}
 * 	return result
 * }
 */
export function Relater_propertiesIdenticalTo(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, excludedProperties: Set): Ternary {
  if ((source!.flags & TypeFlagsObject) === 0 || (target!.flags & TypeFlagsObject) === 0) {
    return TernaryFalse;
  }
  const sourceProperties = excludeProperties(Checker_getPropertiesOfObjectType(receiver!.c, source), excludedProperties);
  const targetProperties = excludeProperties(Checker_getPropertiesOfObjectType(receiver!.c, target), excludedProperties);
  if (sourceProperties.length !== targetProperties.length) {
    return TernaryFalse;
  }
  let result: Ternary = TernaryTrue;
  for (const sourceProp of sourceProperties) {
    const targetProp = Checker_getPropertyOfObjectType(receiver!.c, target, sourceProp!.Name);
    if (targetProp === undefined) {
      return TernaryFalse;
    }
    const related = Checker_compareProperties(receiver!.c, sourceProp, targetProp, (s: GoPtr<Type>, t: GoPtr<Type>) => Relater_isRelatedToSimple(receiver, s, t));
    if (related === TernaryFalse) {
      return TernaryFalse;
    }
    result = (result & related) as Ternary;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.signaturesRelatedTo","kind":"method","status":"implemented","sigHash":"5756f0a73b0f5467ea51872104f6bafef37c400f9ccae57e72c5abec066572f5","bodyHash":"7eab1566582316e74de31561106ad6ae73603c8a4301cd3430f8d797442467f9"}
 *
 * Go source:
 * func (r *Relater) signaturesRelatedTo(source *Type, target *Type, kind SignatureKind, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	if r.relation == r.c.identityRelation {
 * 		return r.signaturesIdenticalTo(source, target, kind)
 * 	}
 * 	// With respect to signatures, the anyFunctionType wildcard is a subtype of every other function type.
 * 	if source == r.c.anyFunctionType {
 * 		return TernaryTrue
 * 	}
 * 	if target == r.c.anyFunctionType {
 * 		return TernaryFalse
 * 	}
 * 	sourceSignatures := r.c.getSignaturesOfType(source, kind)
 * 	targetSignatures := r.c.getSignaturesOfType(target, kind)
 * 	if kind == SignatureKindConstruct && len(sourceSignatures) != 0 && len(targetSignatures) != 0 {
 * 		sourceIsAbstract := sourceSignatures[0].flags&SignatureFlagsAbstract != 0
 * 		targetIsAbstract := targetSignatures[0].flags&SignatureFlagsAbstract != 0
 * 		if sourceIsAbstract && !targetIsAbstract {
 * 			// An abstract constructor type is not assignable to a non-abstract constructor type
 * 			// as it would otherwise be possible to new an abstract class. Note that the assignability
 * 			// check we perform for an extends clause excludes construct signatures from the target,
 * 			// so this check never proceeds.
 * 			if reportErrors {
 * 				r.reportError(diagnostics.Cannot_assign_an_abstract_constructor_type_to_a_non_abstract_constructor_type)
 * 			}
 * 			return TernaryFalse
 * 		}
 * 		if !r.constructorVisibilitiesAreCompatible(sourceSignatures[0], targetSignatures[0], reportErrors) {
 * 			return TernaryFalse
 * 		}
 * 	}
 * 	result := TernaryTrue
 * 	switch {
 * 	case source.objectFlags&ObjectFlagsInstantiated != 0 && target.objectFlags&ObjectFlagsInstantiated != 0 && source.symbol == target.symbol ||
 * 		source.objectFlags&ObjectFlagsReference != 0 && target.objectFlags&ObjectFlagsReference != 0 && source.Target() == target.Target():
 * 		// We have instantiations of the same anonymous type (which typically will be the type of a
 * 		// method). Simply do a pairwise comparison of the signatures in the two signature lists instead
 * 		// of the much more expensive N * M comparison matrix we explore below. We erase type parameters
 * 		// as they are known to always be the same.
 * 		for i := range targetSignatures {
 * 			related := r.signatureRelatedTo(sourceSignatures[i], targetSignatures[i], true /*erase* /, reportErrors, intersectionState)
 * 			if related == TernaryFalse {
 * 				return TernaryFalse
 * 			}
 * 			result &= related
 * 		}
 * 	case len(sourceSignatures) == 1 && len(targetSignatures) == 1:
 * 		// For simple functions (functions with a single signature) we only erase type parameters for
 * 		// the comparable relation. Otherwise, if the source signature is generic, we instantiate it
 * 		// in the context of the target signature before checking the relationship. Ideally we'd do
 * 		// this regardless of the number of signatures, but the potential costs are prohibitive due
 * 		// to the quadratic nature of the logic below.
 * 		eraseGenerics := r.relation == r.c.comparableRelation
 * 		result = r.signatureRelatedTo(sourceSignatures[0], targetSignatures[0], eraseGenerics, reportErrors, intersectionState)
 * 	default:
 * 	outer:
 * 		for _, t := range targetSignatures {
 * 			saveErrorState := r.getErrorState()
 * 			// Only elaborate errors from the first failure
 * 			shouldElaborateErrors := reportErrors
 * 			for _, s := range sourceSignatures {
 * 				related := r.signatureRelatedTo(s, t, true /*erase* /, shouldElaborateErrors, intersectionState)
 * 				if related != TernaryFalse {
 * 					result &= related
 * 					r.restoreErrorState(saveErrorState)
 * 					continue outer
 * 				}
 * 				shouldElaborateErrors = false
 * 			}
 * 			if shouldElaborateErrors {
 * 				r.reportError(diagnostics.Type_0_provides_no_match_for_the_signature_1, r.c.TypeToString(source), r.c.signatureToString(t))
 * 			}
 * 			return TernaryFalse
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Relater_signaturesRelatedTo(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, kind: SignatureKind, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  if (receiver!.relation === receiver!.c!.identityRelation) {
    return Relater_signaturesIdenticalTo(receiver, source, target, kind);
  }
  if (source === receiver!.c!.anyFunctionType) {
    return TernaryTrue;
  }
  if (target === receiver!.c!.anyFunctionType) {
    return TernaryFalse;
  }
  const sourceSignatures = Checker_getSignaturesOfType(receiver!.c, source, kind);
  const targetSignatures = Checker_getSignaturesOfType(receiver!.c, target, kind);
  if (kind === SignatureKindConstruct && sourceSignatures.length !== 0 && targetSignatures.length !== 0) {
    const sourceIsAbstract = (sourceSignatures[0]!.flags & SignatureFlagsAbstract) !== 0;
    const targetIsAbstract = (targetSignatures[0]!.flags & SignatureFlagsAbstract) !== 0;
    if (sourceIsAbstract && !targetIsAbstract) {
      if (reportErrors) {
        Relater_reportError(receiver, Cannot_assign_an_abstract_constructor_type_to_a_non_abstract_constructor_type);
      }
      return TernaryFalse;
    }
    if (!Relater_constructorVisibilitiesAreCompatible(receiver, sourceSignatures[0], targetSignatures[0], reportErrors)) {
      return TernaryFalse;
    }
  }
  let result: Ternary = TernaryTrue;
  if (
    (((source!.objectFlags & ObjectFlagsInstantiated) !== 0 && (target!.objectFlags & ObjectFlagsInstantiated) !== 0 && source!.symbol === target!.symbol) ||
      ((source!.objectFlags & ObjectFlagsReference) !== 0 && (target!.objectFlags & ObjectFlagsReference) !== 0 && Type_Target(source) === Type_Target(target)))
  ) {
    for (let i = 0; i < targetSignatures.length; i++) {
      const related = Relater_signatureRelatedTo(receiver, sourceSignatures[i]!, targetSignatures[i]!, true, reportErrors, intersectionState);
      if (related === TernaryFalse) {
        return TernaryFalse;
      }
      result = (result & related) as Ternary;
    }
  } else if (sourceSignatures.length === 1 && targetSignatures.length === 1) {
    const eraseGenerics = receiver!.relation === receiver!.c!.comparableRelation;
    result = Relater_signatureRelatedTo(receiver, sourceSignatures[0], targetSignatures[0], eraseGenerics, reportErrors, intersectionState);
  } else {
    targetLoop:
    for (const t of targetSignatures) {
      const saveErrorState = Relater_getErrorState(receiver);
      let shouldElaborateErrors = reportErrors;
      for (const s of sourceSignatures) {
        const related = Relater_signatureRelatedTo(receiver, s, t, true, shouldElaborateErrors, intersectionState);
        if (related !== TernaryFalse) {
          result = (result & related) as Ternary;
          Relater_restoreErrorState(receiver, saveErrorState);
          continue targetLoop;
        }
        shouldElaborateErrors = false;
      }
      if (shouldElaborateErrors) {
        Relater_reportError(receiver, Type_0_provides_no_match_for_the_signature_1, Checker_TypeToString(receiver!.c, source), Checker_signatureToString(receiver!.c, t));
      }
      return TernaryFalse;
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.constructorVisibilitiesAreCompatible","kind":"method","status":"implemented","sigHash":"338cf7dac55dd2091e65971c7459652073e4ccc8660425b8b192a83750c4b3db","bodyHash":"4fd168d77bc7efb0db39e193e5937c2fc8b03cfae30d8bd82b030bc783f669f0"}
 *
 * Go source:
 * func (r *Relater) constructorVisibilitiesAreCompatible(sourceSignature *Signature, targetSignature *Signature, reportErrors bool) bool {
 * 	if sourceSignature.declaration == nil || targetSignature.declaration == nil {
 * 		return true
 * 	}
 * 	sourceAccessibility := sourceSignature.declaration.ModifierFlags() & ast.ModifierFlagsNonPublicAccessibilityModifier
 * 	targetAccessibility := targetSignature.declaration.ModifierFlags() & ast.ModifierFlagsNonPublicAccessibilityModifier
 * 	// A public, protected and private signature is assignable to a private signature.
 * 	if targetAccessibility == ast.ModifierFlagsPrivate {
 * 		return true
 * 	}
 * 	// A public and protected signature is assignable to a protected signature.
 * 	if targetAccessibility == ast.ModifierFlagsProtected && sourceAccessibility != ast.ModifierFlagsPrivate {
 * 		return true
 * 	}
 * 	// Only a public signature is assignable to public signature.
 * 	if targetAccessibility != ast.ModifierFlagsProtected && sourceAccessibility == 0 {
 * 		return true
 * 	}
 * 	if reportErrors {
 * 		r.reportError(diagnostics.Cannot_assign_a_0_constructor_type_to_a_1_constructor_type, visibilityToString(sourceAccessibility), visibilityToString(targetAccessibility))
 * 	}
 * 	return false
 * }
 */
export function Relater_constructorVisibilitiesAreCompatible(receiver: GoPtr<Relater>, sourceSignature: GoPtr<Signature>, targetSignature: GoPtr<Signature>, reportErrors: bool): bool {
  if (sourceSignature!.declaration === undefined || targetSignature!.declaration === undefined) {
    return true;
  }
  const sourceAccessibility = Node_ModifierFlags(sourceSignature!.declaration) & ModifierFlagsNonPublicAccessibilityModifier;
  const targetAccessibility = Node_ModifierFlags(targetSignature!.declaration) & ModifierFlagsNonPublicAccessibilityModifier;
  if (targetAccessibility === ModifierFlagsPrivate) {
    return true;
  }
  if (targetAccessibility === ModifierFlagsProtected && sourceAccessibility !== ModifierFlagsPrivate) {
    return true;
  }
  if (targetAccessibility !== ModifierFlagsProtected && sourceAccessibility === 0) {
    return true;
  }
  if (reportErrors) {
    Relater_reportError(receiver, Cannot_assign_a_0_constructor_type_to_a_1_constructor_type, visibilityToString(sourceAccessibility), visibilityToString(targetAccessibility));
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.signatureRelatedTo","kind":"method","status":"implemented","sigHash":"61a271a6b899aaa69251dc601e32621b6aab5b07992e019277f56f02e91d5841","bodyHash":"f02ac6c567101a8c7d75042b51505abc1271862f3bb0158102a408984f6dcd04"}
 *
 * Go source:
 * func (r *Relater) signatureRelatedTo(source *Signature, target *Signature, erase bool, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	checkMode := SignatureCheckModeNone
 * 	switch {
 * 	case r.relation == r.c.subtypeRelation:
 * 		checkMode = SignatureCheckModeStrictTopSignature
 * 	case r.relation == r.c.strictSubtypeRelation:
 * 		checkMode = SignatureCheckModeStrictTopSignature | SignatureCheckModeStrictArity
 * 	}
 * 	if erase {
 * 		source = r.c.getErasedSignature(source)
 * 		target = r.c.getErasedSignature(target)
 * 	}
 * 	isRelatedToWorker := func(source *Type, target *Type, reportErrors bool) Ternary {
 * 		return r.isRelatedToEx(source, target, RecursionFlagsBoth, reportErrors, nil /*headMessage* /, intersectionState)
 * 	}
 * 	return r.c.compareSignaturesRelated(source, target, checkMode, reportErrors, r.reportError, isRelatedToWorker, r.c.reportUnreliableMapper)
 * }
 */
export function Relater_signatureRelatedTo(receiver: GoPtr<Relater>, source: GoPtr<Signature>, target: GoPtr<Signature>, erase: bool, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  let checkMode: SignatureCheckMode = SignatureCheckModeNone;
  if (receiver!.relation === receiver!.c!.subtypeRelation) {
    checkMode = SignatureCheckModeStrictTopSignature;
  } else if (receiver!.relation === receiver!.c!.strictSubtypeRelation) {
    checkMode = SignatureCheckModeStrictTopSignature | SignatureCheckModeStrictArity;
  }
  let sourceSignature = source;
  let targetSignature = target;
  if (erase) {
    sourceSignature = Checker_getErasedSignature(receiver!.c, sourceSignature);
    targetSignature = Checker_getErasedSignature(receiver!.c, targetSignature);
  }
  const isRelatedToWorker: TypeComparer = (sourceType: GoPtr<Type>, targetType: GoPtr<Type>, reportWorkerErrors: bool) => {
    return Relater_isRelatedToEx(receiver, sourceType, targetType, RecursionFlagsBoth, reportWorkerErrors, undefined, intersectionState);
  };
  return Checker_compareSignaturesRelated(
    receiver!.c,
    sourceSignature,
    targetSignature,
    checkMode,
    reportErrors,
    (message: GoPtr<Message>, ...args: Array<unknown>) => Relater_reportError(receiver, message, ...args),
    isRelatedToWorker,
    receiver!.c!.reportUnreliableMapper,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.signaturesIdenticalTo","kind":"method","status":"implemented","sigHash":"ecaeda6f82be85c2968501b0d1a3623952340ff3cede865985d83c651cb60865","bodyHash":"780a7bc48669f317db5831472ee572e7d90db31ddef09dcf004f26dcac402ab6"}
 *
 * Go source:
 * func (r *Relater) signaturesIdenticalTo(source *Type, target *Type, kind SignatureKind) Ternary {
 * 	sourceSignatures := r.c.getSignaturesOfType(source, kind)
 * 	targetSignatures := r.c.getSignaturesOfType(target, kind)
 * 	if len(sourceSignatures) != len(targetSignatures) {
 * 		return TernaryFalse
 * 	}
 * 	result := TernaryTrue
 * 	for i := range sourceSignatures {
 * 		related := r.c.compareSignaturesIdentical(sourceSignatures[i], targetSignatures[i], false /*partialMatch* /, false /*ignoreThisTypes* /, false /*ignoreReturnTypes* /, r.isRelatedToSimple)
 * 		if related == 0 {
 * 			return TernaryFalse
 * 		}
 * 		result &= related
 * 	}
 * 	return result
 * }
 */
export function Relater_signaturesIdenticalTo(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, kind: SignatureKind): Ternary {
  const sourceSignatures = Checker_getSignaturesOfType(receiver!.c, source, kind);
  const targetSignatures = Checker_getSignaturesOfType(receiver!.c, target, kind);
  if (sourceSignatures.length !== targetSignatures.length) {
    return TernaryFalse;
  }
  let result: Ternary = TernaryTrue;
  for (let i = 0; i < sourceSignatures.length; i++) {
    const related = Checker_compareSignaturesIdentical(receiver!.c, sourceSignatures[i]!, targetSignatures[i]!, false, false, false, (s: GoPtr<Type>, t: GoPtr<Type>) => Relater_isRelatedToSimple(receiver, s, t));
    if (related === 0) {
      return TernaryFalse;
    }
    result = (result & related) as Ternary;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.indexSignaturesRelatedTo","kind":"method","status":"implemented","sigHash":"7c55038d8a345144b64a9741273ee4e944d65fd840d1961092fca5bc552ee703","bodyHash":"6917d4cc896dd61c57711c2ae96f8a9fb374757c58d980c92c53b9db75240f67"}
 *
 * Go source:
 * func (r *Relater) indexSignaturesRelatedTo(source *Type, target *Type, sourceIsPrimitive bool, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	if r.relation == r.c.identityRelation {
 * 		return r.indexSignaturesIdenticalTo(source, target)
 * 	}
 * 	indexInfos := r.c.getIndexInfosOfType(target)
 * 	targetHasStringIndex := core.Some(indexInfos, func(info *IndexInfo) bool { return info.keyType == r.c.stringType })
 * 	result := TernaryTrue
 * 	for _, targetInfo := range indexInfos {
 * 		var related Ternary
 * 		switch {
 * 		case r.relation != r.c.strictSubtypeRelation && !sourceIsPrimitive && targetHasStringIndex && targetInfo.valueType.flags&TypeFlagsAny != 0:
 * 			related = TernaryTrue
 * 		case r.c.isGenericMappedType(source) && targetHasStringIndex:
 * 			related = r.isRelatedTo(r.c.getTemplateTypeFromMappedType(source), targetInfo.valueType, RecursionFlagsBoth, reportErrors)
 * 		default:
 * 			related = r.typeRelatedToIndexInfo(source, targetInfo, reportErrors, intersectionState)
 * 		}
 * 		if related == TernaryFalse {
 * 			return TernaryFalse
 * 		}
 * 		result &= related
 * 	}
 * 	return result
 * }
 */
export function Relater_indexSignaturesRelatedTo(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>, sourceIsPrimitive: bool, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  if (receiver!.relation === receiver!.c!.identityRelation) {
    return Relater_indexSignaturesIdenticalTo(receiver, source, target);
  }
  const indexInfos = Checker_getIndexInfosOfType(receiver!.c, target);
  const targetHasStringIndex = indexInfos.some((info: GoPtr<IndexInfo>) => info!.keyType === receiver!.c!.stringType);
  let result: Ternary = TernaryTrue;
  for (const targetInfo of indexInfos) {
    let related: Ternary;
    if (receiver!.relation !== receiver!.c!.strictSubtypeRelation && !sourceIsPrimitive && targetHasStringIndex && (targetInfo!.valueType!.flags & TypeFlagsAny) !== 0) {
      related = TernaryTrue;
    } else if (Checker_isGenericMappedType(receiver!.c, source) && targetHasStringIndex) {
      related = Relater_isRelatedTo(receiver, Checker_getTemplateTypeFromMappedType(receiver!.c, source), targetInfo!.valueType, RecursionFlagsBoth, reportErrors);
    } else {
      related = Relater_typeRelatedToIndexInfo(receiver, source, targetInfo, reportErrors, intersectionState);
    }
    if (related === TernaryFalse) {
      return TernaryFalse;
    }
    result = (result & related) as Ternary;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.typeRelatedToIndexInfo","kind":"method","status":"implemented","sigHash":"947b414517dc425ebc207c47f4e60c7ef4c225016cf6362f61246c492ea8f2e7","bodyHash":"b8b7bc2b51748d09841ad59d27eda1909bd2a08c5c2d0767a1ae454852a3bb18"}
 *
 * Go source:
 * func (r *Relater) typeRelatedToIndexInfo(source *Type, targetInfo *IndexInfo, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	sourceInfo := r.c.getApplicableIndexInfo(source, targetInfo.keyType)
 * 	if sourceInfo != nil {
 * 		return r.indexInfoRelatedTo(sourceInfo, targetInfo, reportErrors, intersectionState)
 * 	}
 * 	// Intersection constituents are never considered to have an inferred index signature. Also, in the strict subtype relation,
 * 	// only fresh object literals are considered to have inferred index signatures. This ensures { [x: string]: xxx } <: {} but
 * 	// not vice-versa. Without this rule, those types would be mutual strict subtypes.
 * 	if intersectionState&IntersectionStateSource == 0 && (r.relation != r.c.strictSubtypeRelation || source.objectFlags&ObjectFlagsFreshLiteral != 0) && r.c.isObjectTypeWithInferableIndex(source) {
 * 		return r.membersRelatedToIndexInfo(source, targetInfo, reportErrors, intersectionState)
 * 	}
 * 	if reportErrors {
 * 		r.reportError(diagnostics.Index_signature_for_type_0_is_missing_in_type_1, r.c.TypeToString(targetInfo.keyType), r.c.TypeToString(source))
 * 	}
 * 	return TernaryFalse
 * }
 */
export function Relater_typeRelatedToIndexInfo(receiver: GoPtr<Relater>, source: GoPtr<Type>, targetInfo: GoPtr<IndexInfo>, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  const sourceInfo = Checker_getApplicableIndexInfo(receiver!.c, source, targetInfo!.keyType);
  if (sourceInfo !== undefined) {
    return Relater_indexInfoRelatedTo(receiver, sourceInfo, targetInfo, reportErrors, intersectionState);
  }
  if ((intersectionState & IntersectionStateSource) === 0 && (receiver!.relation !== receiver!.c!.strictSubtypeRelation || (source!.objectFlags & ObjectFlagsFreshLiteral) !== 0) && Checker_isObjectTypeWithInferableIndex(receiver!.c, source)) {
    return Relater_membersRelatedToIndexInfo(receiver, source, targetInfo, reportErrors, intersectionState);
  }
  if (reportErrors) {
    Relater_reportError(receiver, Index_signature_for_type_0_is_missing_in_type_1, Checker_TypeToString(receiver!.c, targetInfo!.keyType), Checker_TypeToString(receiver!.c, source));
  }
  return TernaryFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isObjectTypeWithInferableIndex","kind":"method","status":"implemented","sigHash":"541ca3a2f62092dd85543f2c073dda59c5fef43a7ea045efcfb2f5f94617436c","bodyHash":"590aa041b17aa3f3a66728d6c4ff3f012043397889b5448d7eae1b399d0721eb"}
 *
 * Go source:
 * func (c *Checker) isObjectTypeWithInferableIndex(t *Type) bool {
 * 	if t.flags&TypeFlagsIntersection != 0 {
 * 		return core.Every(t.Types(), c.isObjectTypeWithInferableIndex)
 * 	}
 * 	return t.symbol != nil && t.symbol.Flags&(ast.SymbolFlagsObjectLiteral|ast.SymbolFlagsTypeLiteral|ast.SymbolFlagsEnum|ast.SymbolFlagsValueModule) != 0 &&
 * 		t.symbol.Flags&ast.SymbolFlagsClass == 0 && !c.typeHasCallOrConstructSignatures(t) ||
 * 		t.objectFlags&ObjectFlagsObjectRestType != 0 ||
 * 		t.objectFlags&ObjectFlagsReverseMapped != 0 && c.isObjectTypeWithInferableIndex(t.AsReverseMappedType().source)
 * }
 */
export function Checker_isObjectTypeWithInferableIndex(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  if ((t!.flags & TypeFlagsIntersection) !== 0) {
    return Every(Type_Types(t), (ti: GoPtr<Type>) => Checker_isObjectTypeWithInferableIndex(receiver, ti));
  }
  return (
    (t!["symbol"] !== undefined &&
      (t!["symbol"]!.Flags & (SymbolFlagsObjectLiteral | SymbolFlagsTypeLiteral | SymbolFlagsEnum | SymbolFlagsValueModule)) !== 0 &&
      (t!["symbol"]!.Flags & SymbolFlagsClass) === 0 &&
      !Checker_typeHasCallOrConstructSignatures(receiver, t)) ||
    (t!.objectFlags & (ObjectFlagsJSLiteral | ObjectFlagsObjectRestType)) !== 0 ||
    ((t!.objectFlags & ObjectFlagsReverseMapped) !== 0 && Checker_isObjectTypeWithInferableIndex(receiver, Type_AsReverseMappedType(t)!.source))
  ) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.membersRelatedToIndexInfo","kind":"method","status":"implemented","sigHash":"1e289b1fbf2a8562dc5392fccd50559345b4986e8fe1a1e2eda512c6a4260fa7","bodyHash":"e6dfb95ad96fe3643b4760e34ac0e55f2af3459696fa51bd7e1c0aed1c78f42f"}
 *
 * Go source:
 * func (r *Relater) membersRelatedToIndexInfo(source *Type, targetInfo *IndexInfo, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	result := TernaryTrue
 * 	keyType := targetInfo.keyType
 * 	var props []*ast.Symbol
 * 	if source.flags&TypeFlagsIntersection != 0 {
 * 		props = r.c.getPropertiesOfUnionOrIntersectionType(source)
 * 	} else {
 * 		props = r.c.getPropertiesOfObjectType(source)
 * 	}
 * 	for _, prop := range props {
 * 		// Skip over ignored JSX and symbol-named members
 * 		if isIgnoredJsxProperty(source, prop) {
 * 			continue
 * 		}
 * 		if r.c.isApplicableIndexType(r.c.getLiteralTypeFromProperty(prop, TypeFlagsStringOrNumberLiteralOrUnique, false), keyType) {
 * 			propType := r.c.getNonMissingTypeOfSymbol(prop)
 * 			var t *Type
 * 			if r.c.exactOptionalPropertyTypes || propType.flags&TypeFlagsUndefined != 0 || keyType == r.c.numberType || prop.Flags&ast.SymbolFlagsOptional == 0 {
 * 				t = propType
 * 			} else {
 * 				t = r.c.getTypeWithFacts(propType, TypeFactsNEUndefined)
 * 			}
 * 			related := r.isRelatedToEx(t, targetInfo.valueType, RecursionFlagsBoth, reportErrors, nil /*headMessage* /, intersectionState)
 * 			if related == TernaryFalse {
 * 				if reportErrors {
 * 					r.reportError(diagnostics.Property_0_is_incompatible_with_index_signature, r.c.symbolToString(prop))
 * 				}
 * 				return TernaryFalse
 * 			}
 * 			result &= related
 * 		}
 * 	}
 * 	for _, info := range r.c.getIndexInfosOfType(source) {
 * 		if r.c.isApplicableIndexType(info.keyType, keyType) {
 * 			related := r.indexInfoRelatedTo(info, targetInfo, reportErrors, intersectionState)
 * 			if !(related != 0) {
 * 				return TernaryFalse
 * 			}
 * 			result &= related
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Relater_membersRelatedToIndexInfo(receiver: GoPtr<Relater>, source: GoPtr<Type>, targetInfo: GoPtr<IndexInfo>, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  let result: Ternary = TernaryTrue;
  const keyType = targetInfo!.keyType;
  const props = (source!.flags & TypeFlagsIntersection) !== 0 ? Checker_getPropertiesOfUnionOrIntersectionType(receiver!.c, source) : Checker_getPropertiesOfObjectType(receiver!.c, source);
  for (const prop of props) {
    if (isIgnoredJsxProperty(source, prop)) {
      continue;
    }
    if (Checker_isApplicableIndexType(receiver!.c, Checker_getLiteralTypeFromProperty(receiver!.c, prop, TypeFlagsStringOrNumberLiteralOrUnique, false), keyType)) {
      const propType = Checker_getNonMissingTypeOfSymbol(receiver!.c, prop);
      const t =
        receiver!.c!.exactOptionalPropertyTypes || (propType!.flags & TypeFlagsUndefined) !== 0 || keyType === receiver!.c!.numberType || (prop!.Flags & SymbolFlagsOptional) === 0
          ? propType
          : Checker_getTypeWithFacts(receiver!.c, propType, TypeFactsNEUndefined);
      const related = Relater_isRelatedToEx(receiver, t, targetInfo!.valueType, RecursionFlagsBoth, reportErrors, undefined, intersectionState);
      if (related === TernaryFalse) {
        if (reportErrors) {
          Relater_reportError(receiver, Property_0_is_incompatible_with_index_signature, Checker_symbolToString(receiver!.c, prop));
        }
        return TernaryFalse;
      }
      result = (result & related) as Ternary;
    }
  }
  for (const info of Checker_getIndexInfosOfType(receiver!.c, source)) {
    if (Checker_isApplicableIndexType(receiver!.c, info!.keyType, keyType)) {
      const related = Relater_indexInfoRelatedTo(receiver, info, targetInfo, reportErrors, intersectionState);
      if (related === TernaryFalse) {
        return TernaryFalse;
      }
      result = (result & related) as Ternary;
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.indexInfoRelatedTo","kind":"method","status":"implemented","sigHash":"eb45473ad52d274e4710d8e68c854b7b9d330cec29aaaef9095d3316a456e224","bodyHash":"54ed15f2909b96ec4df641d06c042fdebb9d8aa7261ab0205513aa588ca1627f"}
 *
 * Go source:
 * func (r *Relater) indexInfoRelatedTo(sourceInfo *IndexInfo, targetInfo *IndexInfo, reportErrors bool, intersectionState IntersectionState) Ternary {
 * 	related := r.isRelatedToEx(sourceInfo.valueType, targetInfo.valueType, RecursionFlagsBoth, reportErrors, nil /*headMessage* /, intersectionState)
 * 	if related == TernaryFalse && reportErrors {
 * 		if sourceInfo.keyType == targetInfo.keyType {
 * 			r.reportError(diagnostics.X_0_index_signatures_are_incompatible, r.c.TypeToString(sourceInfo.keyType))
 * 		} else {
 * 			r.reportError(diagnostics.X_0_and_1_index_signatures_are_incompatible, r.c.TypeToString(sourceInfo.keyType), r.c.TypeToString(targetInfo.keyType))
 * 		}
 * 	}
 * 	return related
 * }
 */
export function Relater_indexInfoRelatedTo(receiver: GoPtr<Relater>, sourceInfo: GoPtr<IndexInfo>, targetInfo: GoPtr<IndexInfo>, reportErrors: bool, intersectionState: IntersectionState): Ternary {
  const related = Relater_isRelatedToEx(receiver, sourceInfo!.valueType, targetInfo!.valueType, RecursionFlagsBoth, reportErrors, undefined, intersectionState);
  if (related === TernaryFalse && reportErrors) {
    if (sourceInfo!.keyType === targetInfo!.keyType) {
      Relater_reportError(receiver, X_0_index_signatures_are_incompatible, Checker_TypeToString(receiver!.c, sourceInfo!.keyType));
    } else {
      Relater_reportError(receiver, X_0_and_1_index_signatures_are_incompatible, Checker_TypeToString(receiver!.c, sourceInfo!.keyType), Checker_TypeToString(receiver!.c, targetInfo!.keyType));
    }
  }
  return related;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.indexSignaturesIdenticalTo","kind":"method","status":"implemented","sigHash":"e26c8e7f83981813255abaf3a84dd91a4a5a0b5b2b321d71818e1a20b7d2268a","bodyHash":"7860a58fd774be507857788d4b7bd6c3a202f207563befdf37c0df677110dbaa"}
 *
 * Go source:
 * func (r *Relater) indexSignaturesIdenticalTo(source *Type, target *Type) Ternary {
 * 	sourceInfos := r.c.getIndexInfosOfType(source)
 * 	targetInfos := r.c.getIndexInfosOfType(target)
 * 	if len(sourceInfos) != len(targetInfos) {
 * 		return TernaryFalse
 * 	}
 * 	for _, targetInfo := range targetInfos {
 * 		sourceInfo := r.c.getIndexInfoOfType(source, targetInfo.keyType)
 * 		if !(sourceInfo != nil && r.isRelatedTo(sourceInfo.valueType, targetInfo.valueType, RecursionFlagsBoth, false) != TernaryFalse && sourceInfo.isReadonly == targetInfo.isReadonly) {
 * 			return TernaryFalse
 * 		}
 * 	}
 * 	return TernaryTrue
 * }
 */
export function Relater_indexSignaturesIdenticalTo(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>): Ternary {
  const sourceInfos = Checker_getIndexInfosOfType(receiver!.c, source);
  const targetInfos = Checker_getIndexInfosOfType(receiver!.c, target);
  if (sourceInfos.length !== targetInfos.length) {
    return TernaryFalse;
  }
  for (const targetInfo of targetInfos) {
    const sourceInfo = Checker_getIndexInfoOfType(receiver!.c, source, targetInfo!.keyType);
    if (!(sourceInfo !== undefined && Relater_isRelatedTo(receiver, sourceInfo!.valueType, targetInfo!.valueType, RecursionFlagsBoth, false) !== TernaryFalse && sourceInfo!.isReadonly === targetInfo!.isReadonly)) {
      return TernaryFalse;
    }
  }
  return TernaryTrue;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.reportErrorResults","kind":"method","status":"implemented","sigHash":"96c448c56291e9b936d3268046b1f10522924ef817ff1326c3b214c3d3d9615f","bodyHash":"9977b7c2b2b2c81c88dac911c2330ae4722f64eeb2c35cd1fbfc966e72734a70"}
 *
 * Go source:
 * func (r *Relater) reportErrorResults(originalSource *Type, originalTarget *Type, source *Type, target *Type, headMessage *diagnostics.Message) {
 * 	sourceHasBase := r.c.getSingleBaseForNonAugmentingSubtype(originalSource) != nil
 * 	targetHasBase := r.c.getSingleBaseForNonAugmentingSubtype(originalTarget) != nil
 * 	if originalSource.alias != nil || sourceHasBase {
 * 		source = originalSource
 * 	}
 * 	if originalTarget.alias != nil || targetHasBase {
 * 		target = originalTarget
 * 	}
 * 	if source.flags&TypeFlagsObject != 0 && target.flags&TypeFlagsObject != 0 {
 * 		r.tryElaborateArrayLikeErrors(source, target, true /*reportErrors* /)
 * 	}
 * 	switch {
 * 	case source.flags&TypeFlagsObject != 0 && target.flags&TypeFlagsPrimitive != 0:
 * 		r.tryElaborateErrorsForPrimitivesAndObjects(source, target)
 * 	case source.symbol != nil && source.flags&TypeFlagsObject != 0 && r.c.globalObjectType == source:
 * 		r.reportError(diagnostics.The_Object_type_is_assignable_to_very_few_other_types_Did_you_mean_to_use_the_any_type_instead)
 * 	case source.objectFlags&ObjectFlagsJsxAttributes != 0 && target.flags&TypeFlagsIntersection != 0:
 * 		targetTypes := target.Types()
 * 		intrinsicAttributes := r.c.getJsxType(JsxNames.IntrinsicAttributes, r.errorNode)
 * 		intrinsicClassAttributes := r.c.getJsxType(JsxNames.IntrinsicClassAttributes, r.errorNode)
 * 		if !r.c.isErrorType(intrinsicAttributes) && !r.c.isErrorType(intrinsicClassAttributes) && (slices.Contains(targetTypes, intrinsicAttributes) || slices.Contains(targetTypes, intrinsicClassAttributes)) {
 * 			return
 * 		}
 * 	case originalTarget.flags&TypeFlagsIntersection != 0 && originalTarget.objectFlags&ObjectFlagsIsNeverIntersection != 0:
 * 		message := diagnostics.The_intersection_0_was_reduced_to_never_because_property_1_has_conflicting_types_in_some_constituents
 * 		prop := core.Find(r.c.getPropertiesOfUnionOrIntersectionType(originalTarget), r.c.isDiscriminantWithNeverType)
 * 		if prop == nil {
 * 			message = diagnostics.The_intersection_0_was_reduced_to_never_because_property_1_exists_in_multiple_constituents_and_is_private_in_some
 * 			prop = core.Find(r.c.getPropertiesOfUnionOrIntersectionType(originalTarget), isConflictingPrivateProperty)
 * 		}
 * 		if prop != nil {
 * 			r.reportError(message, r.c.typeToStringEx(originalTarget, nil /*enclosingDeclaration* /, TypeFormatFlagsNoTypeReduction, nil), r.c.symbolToString(prop))
 * 		}
 * 	}
 * 	r.reportRelationError(headMessage, source, target)
 * 	if source.flags&TypeFlagsTypeParameter != 0 && source.symbol != nil && len(source.symbol.Declarations) != 0 && r.c.getConstraintOfType(source) == nil {
 * 		syntheticParam := r.c.cloneTypeParameter(source)
 * 		syntheticParam.AsTypeParameter().constraint = r.c.instantiateType(target, newSimpleTypeMapper(source, syntheticParam))
 * 		if r.c.hasNonCircularBaseConstraint(syntheticParam) {
 * 			targetConstraintString := r.c.TypeToString(target)
 * 			r.relatedInfo = append(r.relatedInfo, NewDiagnosticForNode(source.symbol.Declarations[0], diagnostics.This_type_parameter_might_need_an_extends_0_constraint, targetConstraintString))
 * 		}
 * 	}
 * }
 */
export function Relater_reportErrorResults(receiver: GoPtr<Relater>, originalSource: GoPtr<Type>, originalTarget: GoPtr<Type>, source: GoPtr<Type>, target: GoPtr<Type>, headMessage: GoPtr<Message>): void {
  const sourceHasBase = Checker_getSingleBaseForNonAugmentingSubtype(receiver!.c, originalSource) !== undefined;
  const targetHasBase = Checker_getSingleBaseForNonAugmentingSubtype(receiver!.c, originalTarget) !== undefined;
  if (originalSource!.alias !== undefined || sourceHasBase) {
    source = originalSource;
  }
  if (originalTarget!.alias !== undefined || targetHasBase) {
    target = originalTarget;
  }
  if ((source!.flags & TypeFlagsObject) !== 0 && (target!.flags & TypeFlagsObject) !== 0) {
    Relater_tryElaborateArrayLikeErrors(receiver, source, target, true);
  }
  if ((source!.flags & TypeFlagsObject) !== 0 && (target!.flags & TypeFlagsPrimitive) !== 0) {
    Relater_tryElaborateErrorsForPrimitivesAndObjects(receiver, source, target);
  } else if (source!.symbol !== undefined && (source!.flags & TypeFlagsObject) !== 0 && receiver!.c!.globalObjectType === source) {
    Relater_reportError(receiver, The_Object_type_is_assignable_to_very_few_other_types_Did_you_mean_to_use_the_any_type_instead);
  } else if ((source!.objectFlags & ObjectFlagsJsxAttributes) !== 0 && (target!.flags & TypeFlagsIntersection) !== 0) {
    const targetTypes = Type_Types(target);
    const intrinsicAttributes = Checker_getJsxType(receiver!.c, JsxNames.IntrinsicAttributes, receiver!.errorNode);
    const intrinsicClassAttributes = Checker_getJsxType(receiver!.c, JsxNames.IntrinsicClassAttributes, receiver!.errorNode);
    if (
      !Checker_isErrorType(receiver!.c, intrinsicAttributes) &&
      !Checker_isErrorType(receiver!.c, intrinsicClassAttributes) &&
      (targetTypes.includes(intrinsicAttributes) || targetTypes.includes(intrinsicClassAttributes))
    ) {
      return;
    }
  } else if ((originalTarget!.flags & TypeFlagsIntersection) !== 0 && (originalTarget!.objectFlags & ObjectFlagsIsNeverIntersection) !== 0) {
    let message = The_intersection_0_was_reduced_to_never_because_property_1_has_conflicting_types_in_some_constituents;
    let prop = Find(Checker_getPropertiesOfUnionOrIntersectionType(receiver!.c, originalTarget), (candidate: GoPtr<Symbol>): bool => Checker_isDiscriminantWithNeverType(receiver!.c, candidate));
    if (prop === undefined) {
      message = The_intersection_0_was_reduced_to_never_because_property_1_exists_in_multiple_constituents_and_is_private_in_some;
      prop = Find(Checker_getPropertiesOfUnionOrIntersectionType(receiver!.c, originalTarget), isConflictingPrivateProperty);
    }
    if (prop !== undefined) {
      Relater_reportError(receiver, message, Checker_TypeToStringEx(receiver!.c, originalTarget, undefined, TypeFormatFlagsNoTypeReduction, undefined), Checker_symbolToString(receiver!.c, prop));
    }
  }
  Relater_reportRelationError(receiver, headMessage, source, target);
  if ((source!.flags & TypeFlagsTypeParameter) !== 0 && source!.symbol !== undefined && (source!.symbol!.Declarations?.length ?? 0) !== 0 && Checker_getConstraintOfType(receiver!.c, source) === undefined) {
    const syntheticParam = Checker_cloneTypeParameter(receiver!.c, source);
    Type_AsTypeParameter(syntheticParam)!.constraint = Checker_instantiateType(receiver!.c, target, newSimpleTypeMapper(source, syntheticParam));
    if (Checker_hasNonCircularBaseConstraint(receiver!.c, syntheticParam)) {
      const targetConstraintString = Checker_TypeToString(receiver!.c, target);
      receiver!.relatedInfo.push(NewDiagnosticForNode(source!.symbol!.Declarations![0], This_type_parameter_might_need_an_extends_0_constraint, targetConstraintString));
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.reportRelationError","kind":"method","status":"implemented","sigHash":"32f54f9ca6d15c9c41139e46f96167a019379e68af7a2e7b65319a9e16fc1af7","bodyHash":"6c9b1991f75625427843be8459876b601f7a0cd66c0fe2f1d855eae31ca60767"}
 *
 * Go source:
 * func (r *Relater) reportRelationError(message *diagnostics.Message, source *Type, target *Type) {
 * 	sourceType, targetType := r.c.getTypeNamesForErrorDisplay(source, target)
 * 	generalizedSource := source
 * 	generalizedSourceType := sourceType
 * 	// Don't generalize on 'never' - we really want the original type
 * 	// to be displayed for use-cases like 'assertNever'.
 * 	if target.flags&TypeFlagsNever == 0 && isLiteralType(source) && !r.c.typeCouldHaveTopLevelSingletonTypes(target) {
 * 		generalizedSource = r.c.getBaseTypeOfLiteralType(source)
 * 		debug.Assert(!r.c.isTypeAssignableTo(generalizedSource, target), "generalized source shouldn't be assignable")
 * 		generalizedSourceType = r.c.getTypeNameForErrorDisplay(generalizedSource)
 * 	}
 * 	// If `target` is of indexed access type (and `source` it is not), we use the object type of `target` for better error reporting
 * 	var targetFlags TypeFlags
 * 	if target.flags&TypeFlagsIndexedAccess != 0 && source.flags&TypeFlagsIndexedAccess == 0 {
 * 		targetFlags = target.AsIndexedAccessType().objectType.flags
 * 	} else {
 * 		targetFlags = target.flags
 * 	}
 * 	if targetFlags&TypeFlagsTypeParameter != 0 && target != r.c.markerSuperTypeForCheck && target != r.c.markerSubTypeForCheck {
 * 		constraint := r.c.getBaseConstraintOfType(target)
 * 		switch {
 * 		case constraint != nil && r.c.isTypeAssignableTo(generalizedSource, constraint):
 * 			r.reportError(diagnostics.X_0_is_assignable_to_the_constraint_of_type_1_but_1_could_be_instantiated_with_a_different_subtype_of_constraint_2, generalizedSourceType, targetType, r.c.TypeToString(constraint))
 * 		case constraint != nil && r.c.isTypeAssignableTo(source, constraint):
 * 			r.reportError(diagnostics.X_0_is_assignable_to_the_constraint_of_type_1_but_1_could_be_instantiated_with_a_different_subtype_of_constraint_2, sourceType, targetType, r.c.TypeToString(constraint))
 * 		default:
 * 			r.errorChain = nil // Only report this error once
 * 			r.reportError(diagnostics.X_0_could_be_instantiated_with_an_arbitrary_type_which_could_be_unrelated_to_1, targetType, generalizedSourceType)
 * 		}
 * 	}
 * 	if message == nil {
 * 		switch {
 * 		case r.relation == r.c.comparableRelation:
 * 			message = diagnostics.Type_0_is_not_comparable_to_type_1
 * 		case sourceType == targetType:
 * 			message = diagnostics.Type_0_is_not_assignable_to_type_1_Two_different_types_with_this_name_exist_but_they_are_unrelated
 * 		case r.c.exactOptionalPropertyTypes && len(r.c.getExactOptionalUnassignableProperties(source, target)) != 0:
 * 			message = diagnostics.Type_0_is_not_assignable_to_type_1_with_exactOptionalPropertyTypes_Colon_true_Consider_adding_undefined_to_the_types_of_the_target_s_properties
 * 		default:
 * 			if source.flags&TypeFlagsStringLiteral != 0 && target.flags&TypeFlagsUnion != 0 {
 * 				suggestedType := r.c.getSuggestedTypeForNonexistentStringLiteralType(source, target)
 * 				if suggestedType != nil {
 * 					r.reportError(diagnostics.Type_0_is_not_assignable_to_type_1_Did_you_mean_2, generalizedSourceType, targetType, r.c.TypeToString(suggestedType))
 * 					return
 * 				}
 * 			}
 * 			message = diagnostics.Type_0_is_not_assignable_to_type_1
 * 		}
 * 	}
 * 	switch r.getChainMessage(0) {
 * 	// Suppress if next message is an excess property error
 * 	case diagnostics.Object_literal_may_only_specify_known_properties_and_0_does_not_exist_in_type_1,
 * 		diagnostics.Object_literal_may_only_specify_known_properties_but_0_does_not_exist_in_type_1_Did_you_mean_to_write_2:
 * 		return
 * 	// Suppress if next message is an excessive complexity/stack depth message for source and target or a readonly
 * 	// vs. mutable error for source and target
 * 	case diagnostics.Excessive_complexity_comparing_types_0_and_1,
 * 		diagnostics.Excessive_stack_depth_comparing_types_0_and_1,
 * 		diagnostics.The_type_0_is_readonly_and_cannot_be_assigned_to_the_mutable_type_1:
 * 		if r.chainArgsMatch(generalizedSourceType, targetType) {
 * 			return
 * 		}
 * 	// Suppress if next message is a missing property message for source and target and we're not
 * 	// reporting on conversion or interface implementation
 * 	case diagnostics.Property_0_is_missing_in_type_1_but_required_in_type_2:
 * 		if !isConversionOrInterfaceImplementationMessage(message) && r.chainArgsMatch(nil, generalizedSourceType, targetType) {
 * 			return
 * 		}
 * 	// Suppress if next message is a missing property message for source and target and we're not
 * 	// reporting on conversion or interface implementation
 * 	case diagnostics.Type_0_is_missing_the_following_properties_from_type_1_Colon_2_and_3_more,
 * 		diagnostics.Type_0_is_missing_the_following_properties_from_type_1_Colon_2:
 * 		if !isConversionOrInterfaceImplementationMessage(message) && r.chainArgsMatch(generalizedSourceType, targetType) {
 * 			return
 * 		}
 * 	}
 * 	r.reportError(message, generalizedSourceType, targetType)
 * }
 */
export function Relater_reportRelationError(receiver: GoPtr<Relater>, message: GoPtr<Message>, source: GoPtr<Type>, target: GoPtr<Type>): void {
  const [sourceType, targetType] = Checker_getTypeNamesForErrorDisplay(receiver!.c, source, target);
  let generalizedSource = source;
  let generalizedSourceType = sourceType;
  if ((target!.flags & TypeFlagsNever) === 0 && isLiteralType(source) && !Checker_typeCouldHaveTopLevelSingletonTypes(receiver!.c, target)) {
    generalizedSource = Checker_getBaseTypeOfLiteralType(receiver!.c, source);
    generalizedSourceType = Checker_getTypeNameForErrorDisplay(receiver!.c, generalizedSource);
  }
  let targetFlags: TypeFlags;
  if ((target!.flags & TypeFlagsIndexedAccess) !== 0 && (source!.flags & TypeFlagsIndexedAccess) === 0) {
    targetFlags = Type_AsIndexedAccessType(target)!.objectType!.flags;
  } else {
    targetFlags = target!.flags;
  }
  if ((targetFlags & TypeFlagsTypeParameter) !== 0 && target !== receiver!.c!.markerSuperTypeForCheck && target !== receiver!.c!.markerSubTypeForCheck) {
    const constraint = Checker_getBaseConstraintOfType(receiver!.c, target);
    if (constraint !== undefined && Checker_isTypeAssignableTo(receiver!.c, generalizedSource, constraint)) {
      Relater_reportError(receiver, X_0_is_assignable_to_the_constraint_of_type_1_but_1_could_be_instantiated_with_a_different_subtype_of_constraint_2, generalizedSourceType, targetType, Checker_TypeToString(receiver!.c, constraint));
    } else if (constraint !== undefined && Checker_isTypeAssignableTo(receiver!.c, source, constraint)) {
      Relater_reportError(receiver, X_0_is_assignable_to_the_constraint_of_type_1_but_1_could_be_instantiated_with_a_different_subtype_of_constraint_2, sourceType, targetType, Checker_TypeToString(receiver!.c, constraint));
    } else {
      receiver!.errorChain = undefined;
      Relater_reportError(receiver, X_0_could_be_instantiated_with_an_arbitrary_type_which_could_be_unrelated_to_1, targetType, generalizedSourceType);
    }
  }
  if (message === undefined) {
    if (receiver!.relation === receiver!.c!.comparableRelation) {
      message = Type_0_is_not_comparable_to_type_1;
    } else if (sourceType === targetType) {
      message = Type_0_is_not_assignable_to_type_1_Two_different_types_with_this_name_exist_but_they_are_unrelated;
    } else if (receiver!.c!.exactOptionalPropertyTypes && Checker_getExactOptionalUnassignableProperties(receiver!.c, source, target).length !== 0) {
      message = Type_0_is_not_assignable_to_type_1_with_exactOptionalPropertyTypes_Colon_true_Consider_adding_undefined_to_the_types_of_the_target_s_properties;
    } else {
      if ((source!.flags & TypeFlagsStringLiteral) !== 0 && (target!.flags & TypeFlagsUnion) !== 0) {
        const suggestedType = Checker_getSuggestedTypeForNonexistentStringLiteralType(receiver!.c, source, target);
        if (suggestedType !== undefined) {
          Relater_reportError(receiver, Type_0_is_not_assignable_to_type_1_Did_you_mean_2, generalizedSourceType, targetType, Checker_TypeToString(receiver!.c, suggestedType));
          return;
        }
      }
      message = Type_0_is_not_assignable_to_type_1;
    }
  }
  switch (Relater_getChainMessage(receiver, 0)) {
    case Object_literal_may_only_specify_known_properties_and_0_does_not_exist_in_type_1:
    case Object_literal_may_only_specify_known_properties_but_0_does_not_exist_in_type_1_Did_you_mean_to_write_2:
      return;
    case Excessive_complexity_comparing_types_0_and_1:
    case Excessive_stack_depth_comparing_types_0_and_1:
    case The_type_0_is_readonly_and_cannot_be_assigned_to_the_mutable_type_1:
      if (Relater_chainArgsMatch(receiver, generalizedSourceType, targetType)) {
        return;
      }
      break;
    case Property_0_is_missing_in_type_1_but_required_in_type_2:
      if (!isConversionOrInterfaceImplementationMessage(message) && Relater_chainArgsMatch(receiver, undefined, generalizedSourceType, targetType)) {
        return;
      }
      break;
    case Type_0_is_missing_the_following_properties_from_type_1_Colon_2_and_3_more:
    case Type_0_is_missing_the_following_properties_from_type_1_Colon_2:
      if (!isConversionOrInterfaceImplementationMessage(message) && Relater_chainArgsMatch(receiver, generalizedSourceType, targetType)) {
        return;
      }
      break;
  }
  Relater_reportError(receiver, message, generalizedSourceType, targetType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.reportError","kind":"method","status":"implemented","sigHash":"8e1e5c55beeaf5af305997eca162ff7636adc84d06e53c20173a1ddc6166edd0","bodyHash":"18ee4af6d6e7fd6ba280117cec3c1402acf129de2770236dd7e15c3291805a25"}
 *
 * Go source:
 * func (r *Relater) reportError(message *diagnostics.Message, args ...any) {
 * 	if message == diagnostics.Types_of_property_0_are_incompatible {
 * 		// Suppress if next message is an excess property error
 * 		switch r.getChainMessage(0) {
 * 		case diagnostics.Object_literal_may_only_specify_known_properties_and_0_does_not_exist_in_type_1,
 * 			diagnostics.Object_literal_may_only_specify_known_properties_but_0_does_not_exist_in_type_1_Did_you_mean_to_write_2:
 * 			return
 * 		}
 * 		// Transform a property incompatibility message for property 'x' followed by some elaboration message
 * 		// followed by a signature return type incompatibility message into a single return type incompatibility
 * 		// message for 'x()' or 'x(...)'
 * 		var arg string
 * 		switch r.getChainMessage(1) {
 * 		case diagnostics.Call_signatures_with_no_arguments_have_incompatible_return_types_0_and_1:
 * 			arg = getPropertyNameArg(args[0]) + "()"
 * 		case diagnostics.Construct_signatures_with_no_arguments_have_incompatible_return_types_0_and_1:
 * 			arg = "new " + getPropertyNameArg(args[0]) + "()"
 * 		case diagnostics.Call_signature_return_types_0_and_1_are_incompatible:
 * 			arg = getPropertyNameArg(args[0]) + "(...)"
 * 		case diagnostics.Construct_signature_return_types_0_and_1_are_incompatible:
 * 			arg = "new " + getPropertyNameArg(args[0]) + "(...)"
 * 		}
 * 		if arg != "" {
 * 			message = diagnostics.The_types_returned_by_0_are_incompatible_between_these_types
 * 			args[0] = arg
 * 			r.errorChain = r.errorChain.next.next
 * 		}
 * 		// Transform a property incompatibility message for property 'x' followed by some elaboration message
 * 		// followed by a property incompatibility message for property 'y' into a single property incompatibility
 * 		// message for 'x.y'
 * 		switch r.getChainMessage(1) {
 * 		case diagnostics.Types_of_property_0_are_incompatible,
 * 			diagnostics.The_types_of_0_are_incompatible_between_these_types,
 * 			diagnostics.The_types_returned_by_0_are_incompatible_between_these_types:
 * 			head := getPropertyNameArg(args[0])
 * 			tail := getPropertyNameArg(r.errorChain.next.args[0])
 * 			arg := addToDottedName(head, tail)
 * 			r.errorChain = r.errorChain.next.next
 * 			if message == diagnostics.Types_of_property_0_are_incompatible {
 * 				message = diagnostics.The_types_of_0_are_incompatible_between_these_types
 * 			}
 * 			r.reportError(message, arg)
 * 			return
 * 		}
 * 	}
 * 	r.errorChain = &ErrorChain{next: r.errorChain, message: message, args: args}
 * }
 */
export function Relater_reportError(receiver: GoPtr<Relater>, message: GoPtr<Message>, ...args: Array<unknown>): void {
  if (message === Types_of_property_0_are_incompatible) {
    switch (Relater_getChainMessage(receiver, 0)) {
      case Object_literal_may_only_specify_known_properties_and_0_does_not_exist_in_type_1:
      case Object_literal_may_only_specify_known_properties_but_0_does_not_exist_in_type_1_Did_you_mean_to_write_2:
        return;
    }
    let arg = "";
    switch (Relater_getChainMessage(receiver, 1)) {
      case Call_signatures_with_no_arguments_have_incompatible_return_types_0_and_1:
        arg = getPropertyNameArg(args[0]) + "()";
        break;
      case Construct_signatures_with_no_arguments_have_incompatible_return_types_0_and_1:
        arg = "new " + getPropertyNameArg(args[0]) + "()";
        break;
      case Call_signature_return_types_0_and_1_are_incompatible:
        arg = getPropertyNameArg(args[0]) + "(...)";
        break;
      case Construct_signature_return_types_0_and_1_are_incompatible:
        arg = "new " + getPropertyNameArg(args[0]) + "(...)";
        break;
    }
    if (arg !== "") {
      message = The_types_returned_by_0_are_incompatible_between_these_types;
      args[0] = arg;
      receiver!.errorChain = receiver!.errorChain!.next!.next;
    }
    switch (Relater_getChainMessage(receiver, 1)) {
      case Types_of_property_0_are_incompatible:
      case The_types_of_0_are_incompatible_between_these_types:
      case The_types_returned_by_0_are_incompatible_between_these_types: {
        const head = getPropertyNameArg(args[0]);
        const tail = getPropertyNameArg(receiver!.errorChain!.next!.args[0]);
        const dottedArg = addToDottedName(head, tail);
        receiver!.errorChain = receiver!.errorChain!.next!.next;
        if (message === Types_of_property_0_are_incompatible) {
          message = The_types_of_0_are_incompatible_between_these_types;
        }
        Relater_reportError(receiver, message, dottedArg);
        return;
      }
    }
  }
  receiver!.errorChain = { next: receiver!.errorChain, message, args };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::addToDottedName","kind":"func","status":"implemented","sigHash":"23164083b83495b2301a671c3498ead80661f14553794710d8c42ea959e0da34","bodyHash":"5dc2d57e363f16b2868f4bc46059d90d44a3b6e3ff5d82533ccd8e20104f49f6"}
 *
 * Go source:
 * func addToDottedName(head string, tail string) string {
 * 	if strings.HasPrefix(head, "new ") {
 * 		head = "(" + head + ")"
 * 	}
 * 	pos := 0
 * 	for {
 * 		if strings.HasPrefix(tail[pos:], "(") {
 * 			pos++
 * 		} else if strings.HasPrefix(tail[pos:], "new ") {
 * 			pos += 4
 * 		} else {
 * 			break
 * 		}
 * 	}
 * 	prefix := tail[:pos]
 * 	suffix := tail[pos:]
 * 	if strings.HasPrefix(suffix, "[") {
 * 		return prefix + head + suffix
 * 	}
 * 	return prefix + head + "." + suffix
 * }
 */
export function addToDottedName(head: string, tail: string): string {
  const wrappedHead = head.startsWith("new ") ? "(" + head + ")" : head;
  const computePos = (pos: int): int => {
    if (tail.slice(pos).startsWith("(")) {
      return computePos(pos + 1);
    }
    if (tail.slice(pos).startsWith("new ")) {
      return computePos(pos + 4);
    }
    return pos;
  };
  const pos = computePos(0);
  const prefix = tail.slice(0, pos);
  const suffix = tail.slice(pos);
  if (suffix.startsWith("[")) {
    return prefix + wrappedHead + suffix;
  }
  return prefix + wrappedHead + "." + suffix;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.getChainMessage","kind":"method","status":"implemented","sigHash":"b7530c8340a0b457cc42903900df0500a507e02b25f92ea9995d18bcbf293aa9","bodyHash":"c961ca5def17040c3e28cc4c6662ab084cf9e2a4a9c216f7f478133d74297b03"}
 *
 * Go source:
 * func (r *Relater) getChainMessage(index int) *diagnostics.Message {
 * 	e := r.errorChain
 * 	for {
 * 		if e == nil {
 * 			return nil
 * 		}
 * 		if index == 0 {
 * 			return e.message
 * 		}
 * 		e = e.next
 * 		index--
 * 	}
 * }
 */
export function Relater_getChainMessage(receiver: GoPtr<Relater>, index: int): GoPtr<Message> {
  const walk = (e: GoPtr<ErrorChain>, idx: int): GoPtr<Message> => {
    if (e === undefined) {
      return undefined;
    }
    if (idx === 0) {
      return e.message;
    }
    return walk(e.next, idx - 1);
  };
  return walk(receiver!.errorChain, index);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.chainArgsMatch","kind":"method","status":"implemented","sigHash":"90283374fb1746d048ca258e7e3fbb29f67a7de344aceeb923f47f11fe539bc4","bodyHash":"3041a426a09cdb440003d62cb16ea266aabf27f6739f9af1616f3cefb31f38a7"}
 *
 * Go source:
 * func (r *Relater) chainArgsMatch(args ...any) bool {
 * 	for i, a := range args {
 * 		if a != nil && a != r.errorChain.args[i] {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function Relater_chainArgsMatch(receiver: GoPtr<Relater>, ...args: Array<unknown>): bool {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a !== undefined && a !== receiver!.errorChain!.args[i]) {
      return false;
    }
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::getPropertyNameArg","kind":"func","status":"implemented","sigHash":"f043461fefb480c36ecde1de64f690431838cadc3051de1e5927af225d2725dd","bodyHash":"de2cb569a35059e5f19ecdfd504d808d08fff8c489225e2dd04d3ad9269bf44b"}
 *
 * Go source:
 * func getPropertyNameArg(arg any) string {
 * 	s := arg.(string)
 * 	if len(s) != 0 && (s[0] == '"' || s[0] == '\'' || s[0] == '`') {
 * 		return "[" + s + "]"
 * 	}
 * 	return s
 * }
 */
export function getPropertyNameArg(arg: unknown): string {
  const s = arg as string;
  if (s.length !== 0 && (s.charCodeAt(0) === "\"".charCodeAt(0) || s.charCodeAt(0) === "'".charCodeAt(0) || s.charCodeAt(0) === "`".charCodeAt(0))) {
    return "[" + s + "]";
  }
  return s;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::isConversionOrInterfaceImplementationMessage","kind":"func","status":"implemented","sigHash":"b143ece17ddc348eedd97850864c153b4246823a113064b4138402f4d5de0d83","bodyHash":"4bec6ef1ad64ed99a54f8bbe751c1ce1577e11428656bc8cbdc32d7030091077"}
 *
 * Go source:
 * func isConversionOrInterfaceImplementationMessage(message *diagnostics.Message) bool {
 * 	return message == diagnostics.Class_0_incorrectly_implements_interface_1 ||
 * 		message == diagnostics.Class_0_incorrectly_implements_class_1_Did_you_mean_to_extend_1_and_inherit_its_members_as_a_subclass ||
 * 		message == diagnostics.Conversion_of_type_0_to_type_1_may_be_a_mistake_because_neither_type_sufficiently_overlaps_with_the_other_If_this_was_intentional_convert_the_expression_to_unknown_first ||
 * 		message == diagnostics.Its_instance_type_0_is_not_a_valid_JSX_element ||
 * 		message == diagnostics.Its_return_type_0_is_not_a_valid_JSX_element ||
 * 		message == diagnostics.Its_element_type_0_is_not_a_valid_JSX_element
 * }
 */
export function isConversionOrInterfaceImplementationMessage(message: GoPtr<Message>): bool {
  return message === Class_0_incorrectly_implements_interface_1 ||
    message === Class_0_incorrectly_implements_class_1_Did_you_mean_to_extend_1_and_inherit_its_members_as_a_subclass ||
    message === Conversion_of_type_0_to_type_1_may_be_a_mistake_because_neither_type_sufficiently_overlaps_with_the_other_If_this_was_intentional_convert_the_expression_to_unknown_first ||
    message === Its_instance_type_0_is_not_a_valid_JSX_element ||
    message === Its_return_type_0_is_not_a_valid_JSX_element ||
    message === Its_element_type_0_is_not_a_valid_JSX_element;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::func::chainDepth","kind":"func","status":"implemented","sigHash":"429b94285c520fe725e7a8c6b6d07a0647504c2145ec09cb7a663787ac81b3cc","bodyHash":"d7197fb4d34f153a5f4926b5a5e8de0232fbbf8f9ef7255113b7b48c7c0e41d3"}
 *
 * Go source:
 * func chainDepth(chain *ErrorChain) int {
 * 	depth := 0
 * 	for chain != nil {
 * 		depth++
 * 		chain = chain.next
 * 	}
 * 	return depth
 * }
 */
export function chainDepth(chain: GoPtr<ErrorChain>): int {
  let depth = 0;
  let cur = chain;
  while (cur !== undefined) {
    depth++;
    cur = cur!.next;
  }
  return depth;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isTypeDerivedFrom","kind":"method","status":"implemented","sigHash":"831190bac5e771530bfa96d17bc12ead0deb75f08dbcf97da148ad4a0502e002","bodyHash":"a87d59d35cfbcbfedb547425aed7fe74db29f9e22655c3625861a65a9b0d652c"}
 *
 * Go source:
 * func (c *Checker) isTypeDerivedFrom(source *Type, target *Type) bool {
 * 	switch {
 * 	case source.flags&TypeFlagsUnion != 0:
 * 		return core.Every(source.AsUnionType().types, func(t *Type) bool {
 * 			return c.isTypeDerivedFrom(t, target)
 * 		})
 * 	case target.flags&TypeFlagsUnion != 0:
 * 		return core.Some(target.AsUnionType().types, func(t *Type) bool {
 * 			return c.isTypeDerivedFrom(source, t)
 * 		})
 * 	case source.flags&TypeFlagsIntersection != 0:
 * 		return core.Some(source.AsIntersectionType().types, func(t *Type) bool {
 * 			return c.isTypeDerivedFrom(t, target)
 * 		})
 * 	case source.flags&TypeFlagsInstantiableNonPrimitive != 0:
 * 		constraint := c.getBaseConstraintOfType(source)
 * 		if constraint == nil {
 * 			constraint = c.unknownType
 * 		}
 * 		return c.isTypeDerivedFrom(constraint, target)
 * 	case c.IsEmptyAnonymousObjectType(target):
 * 		return source.flags&(TypeFlagsObject|TypeFlagsNonPrimitive) != 0
 * 	case target == c.globalObjectType:
 * 		return source.flags&(TypeFlagsObject|TypeFlagsNonPrimitive) != 0 && !c.IsEmptyAnonymousObjectType(source)
 * 	case target == c.globalFunctionType:
 * 		return source.flags&TypeFlagsObject != 0 && c.isFunctionObjectType(source)
 * 	default:
 * 		return c.hasBaseType(source, c.getTargetType(target)) || (c.isArrayType(target) && !c.isReadonlyArrayType(target) && c.isTypeDerivedFrom(source, c.globalReadonlyArrayType))
 * 	}
 * }
 */
export function Checker_isTypeDerivedFrom(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool {
  if ((source!.flags & TypeFlagsUnion) !== 0) {
    return Type_Types(source)!.every((t: GoPtr<Type>) => Checker_isTypeDerivedFrom(receiver, t, target));
  }
  if ((target!.flags & TypeFlagsUnion) !== 0) {
    return Type_Types(target)!.some((t: GoPtr<Type>) => Checker_isTypeDerivedFrom(receiver, source, t));
  }
  if ((source!.flags & TypeFlagsIntersection) !== 0) {
    return Type_Types(source)!.some((t: GoPtr<Type>) => Checker_isTypeDerivedFrom(receiver, t, target));
  }
  if ((source!.flags & TypeFlagsInstantiableNonPrimitive) !== 0) {
    let constraint = Checker_getBaseConstraintOfType(receiver, source);
    if (constraint === undefined) {
      constraint = receiver!.unknownType;
    }
    return Checker_isTypeDerivedFrom(receiver, constraint, target);
  }
  if (Checker_IsEmptyAnonymousObjectType(receiver, target)) {
    return (source!.flags & (TypeFlagsObject | TypeFlagsNonPrimitive)) !== 0;
  }
  if (target === receiver!.globalObjectType) {
    return (source!.flags & (TypeFlagsObject | TypeFlagsNonPrimitive)) !== 0 && !Checker_IsEmptyAnonymousObjectType(receiver, source);
  }
  if (target === receiver!.globalFunctionType) {
    return (source!.flags & TypeFlagsObject) !== 0 && Checker_isFunctionObjectType(receiver, source);
  }
  return Checker_hasBaseType(receiver, source, Checker_getTargetType(receiver, target)) || (Checker_isArrayType(receiver, target) && !Checker_isReadonlyArrayType(receiver, target) && Checker_isTypeDerivedFrom(receiver, source, receiver!.globalReadonlyArrayType));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Checker.isDistributionDependent","kind":"method","status":"implemented","sigHash":"6dc23529399c14dfa43a9f60124843cd1aba44bfa0dcaee35188aeed866f76b8","bodyHash":"01ffc3206b9f8e801bbce9b7697907cdd78c840ea2a64d3df35c78ab9e25c7a0"}
 *
 * Go source:
 * func (c *Checker) isDistributionDependent(root *ConditionalRoot) bool {
 * 	return root.isDistributive && (c.isTypeParameterPossiblyReferenced(root.checkType, root.node.TrueType) || c.isTypeParameterPossiblyReferenced(root.checkType, root.node.FalseType))
 * }
 */
export function Checker_isDistributionDependent(receiver: GoPtr<Checker>, root: GoPtr<ConditionalRoot>): bool {
  return root!.isDistributive && (Checker_isTypeParameterPossiblyReferenced(receiver, root!.checkType, AsConditionalTypeNode(root!.node)!.TrueType) || Checker_isTypeParameterPossiblyReferenced(receiver, root!.checkType, AsConditionalTypeNode(root!.node)!.FalseType));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/relater.go::method::Relater.traceUnionsOrIntersectionsTooLarge","kind":"method","status":"implemented","sigHash":"1c1224468f54f31fd458c6e088e4f41aa7b8ebd6fa7b5e0de4ba509a181b7cf4","bodyHash":"528a95a5ef0e6b62b44bbcc65607b5ff16e11adbe491161124256d3cdd04f876"}
 *
 * Go source:
 * func (r *Relater) traceUnionsOrIntersectionsTooLarge(source *Type, target *Type) {
 * 	tr := r.c.tracer
 * 	if tr == nil {
 * 		return
 * 	}
 * 	if source.flags&TypeFlagsUnionOrIntersection != 0 && target.flags&TypeFlagsUnionOrIntersection != 0 {
 * 		if source.objectFlags&target.objectFlags&ObjectFlagsPrimitiveUnion != 0 {
 * 			// There's a fast path for comparing primitive unions
 * 			return
 * 		}
 * 		sourceSize := len(source.Types())
 * 		targetSize := len(target.Types())
 * 		if sourceSize*targetSize > 1_000_000 {
 * 			tr.Instant(tracing.PhaseCheckTypes, "traceUnionsOrIntersectionsTooLarge_DepthLimit", map[string]any{"sourceId": source.id, "sourceSize": sourceSize, "targetId": target.id, "targetSize": targetSize})
 * 		}
 * 	}
 * }
 */
export function Relater_traceUnionsOrIntersectionsTooLarge(receiver: GoPtr<Relater>, source: GoPtr<Type>, target: GoPtr<Type>): void {
  // tracing not implemented in TSTS port
}
