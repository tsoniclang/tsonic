import type { bool, int } from "../../go/scalars.js";
import type { GoComparable, GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import { NewGoStructMap } from "../../go/compat.js";
import type { ModifierList, Node, NodeFactoryCoercible, NodeList, NodeVisitor } from "../ast/spine.js";
import type { Identifier, IndexedAccessTypeNode } from "../ast/generated/data.js";
import type { SourceFile } from "../ast/ast.js";
import type { NodeFactory } from "../ast/generated/factory.js";
import type { BindingName, Declaration, EntityName, Expression, IdentifierNode, PropertyName, TypeElement, TypeNode, TypeParameterDeclarationNode, TypeParameterList } from "../ast/generated/unions.js";
import { AsBindingElement, AsConditionalTypeNode, AsElementAccessExpression, AsExpressionWithTypeArguments, AsIdentifier, AsImportEqualsDeclaration, AsImportTypeNode, AsIndexedAccessTypeNode, AsLiteralTypeNode, AsMappedTypeNode, AsQualifiedName, AsStringLiteral, AsTypeParameterDeclaration, AsTypeQueryNode, AsTypeReferenceNode, AsVariableDeclaration } from "../ast/generated/casts.js";
import { IsBindingElement, IsBinaryExpression, IsClassDeclaration, IsComputedPropertyName, IsElementAccessExpression, IsExpressionWithTypeArguments, IsIdentifier, IsImportTypeNode, IsIndexedAccessTypeNode, IsParameterDeclaration, IsPrivateIdentifier, IsPropertyAccessExpression, IsPropertyDeclaration, IsPropertySignatureDeclaration, IsQualifiedName, IsStringLiteral, IsTypeAliasDeclaration, IsTypeParameterDeclaration, IsTypeQueryNode, IsTypeReferenceNode } from "../ast/generated/predicates.js";
import type { NodeId, SymbolId } from "../ast/ids.js";
import type { Kind } from "../ast/generated/kinds.js";
import {
  KindAccessorKeyword,
  KindAnyKeyword,
  KindArrowFunction,
  KindBindingElement,
  KindBigIntKeyword,
  KindBooleanKeyword,
  KindCallSignature,
  KindClassExpression,
  KindConstructor,
  KindConstructorType,
  KindConstructSignature,
  KindDotDotDotToken,
  KindExportDeclaration,
  KindExportSpecifier,
  KindExternalModuleReference,
  KindFalseKeyword,
  KindFunctionDeclaration,
  KindFunctionExpression,
  KindFunctionType,
  KindGetAccessor,
  KindIndexSignature,
  KindImportClause,
  KindImportDeclaration,
  KindImportEqualsDeclaration,
  KindImportSpecifier,
  KindImportType,
  KindIntrinsicKeyword,
  KindKeyOfKeyword,
  KindJSDocImportTag,
  KindJSDocParameterTag,
  KindMinusToken,
  KindModuleBlock,
  KindMultiLineCommentTrivia,
  KindNeverKeyword,
  KindPropertyDeclaration,
  KindMethodDeclaration,
  KindMethodSignature,
  KindNamespaceExport,
  KindNamespaceImport,
  KindNullKeyword,
  KindNumberKeyword,
  KindObjectKeyword,
  KindParameter,
  KindQuestionToken,
  KindAssertsKeyword,
  KindReadonlyKeyword,
  KindSetAccessor,
  KindSourceFile,
  KindStringKeyword,
  KindSymbolKeyword,
  KindTrueKeyword,
  KindTypeParameter,
  KindUndefinedKeyword,
  KindUniqueKeyword,
  KindUnknownKeyword,
  KindVariableDeclaration,
  KindVoidKeyword,
  KindWithKeyword,
} from "../ast/generated/kinds.js";
import type { Symbol } from "../ast/symbol.js";
import { InternalSymbolNameDefault, InternalSymbolNameExportEquals, InternalSymbolNameMissing, InternalSymbolNamePrefix, SymbolName } from "../ast/symbol.js";
import type { CheckFlags } from "../ast/checkflags.js";
import { CheckFlagsInstantiated, CheckFlagsLate, CheckFlagsNone, CheckFlagsOptionalParameter, CheckFlagsRestParameter, CheckFlagsReverseMapped } from "../ast/checkflags.js";
import type { SymbolFlags } from "../ast/generated/flags.js";
import {
  NodeFlagsNone,
  NodeFlagsSynthesized,
  SymbolFlagsAlias,
  SymbolFlagsAccessor,
  SymbolFlagsClass,
  SymbolFlagsEnum,
  SymbolFlagsEnumMember,
  SymbolFlagsExportValue,
  SymbolFlagsFunction,
  SymbolFlagsFunctionScopedVariable,
  SymbolFlagsMethod,
  SymbolFlagsInterface,
  SymbolFlagsOptional,
  SymbolFlagsPrototype,
  SymbolFlagsSignature,
  SymbolFlagsTransient,
  SymbolFlagsType,
  SymbolFlagsObjectLiteral,
  SymbolFlagsTypeLiteral,
  SymbolFlagsTypeParameter,
  SymbolFlagsValue,
  SymbolFlagsValueModule,
} from "../ast/generated/flags.js";
import {
  FindAncestor,
  GetDeclarationOfKind,
  GetFirstIdentifier,
  GetNameOfDeclaration,
  GetNodeId,
  GetSourceFileOfModule,
  GetSourceFileOfNode,
  GetSymbolId,
  IsAmbientModule,
  IsAmbientModuleSymbolName,
  IsEntityNameExpression,
  CanHaveModifiers,
  CreateModifiersFromModifierFlags,
  IsClassLike,
  IsEntityName,
  HasInferredType,
  IsAccessor,
  IsLiteralImportTypeNode,
  IsPropertyAccessEntityNameExpression,
  IsModifier,
  IsRequireCall,
  IsStatic,
  NewHasFileName,
  NodeIsSynthesized,
  WalkUpParenthesizedTypes,
} from "../ast/utilities.js";
import { NewNodeVisitor, NodeVisitor_VisitEachChild } from "../ast/visitor.js";
import type { NodeVisitor as AstNodeVisitor, NodeVisitorHooks } from "../ast/visitor.js";
import { TokenFlagsNone, TokenFlagsSingleQuote } from "../ast/tokenflags.js";
import type { TokenFlags } from "../ast/tokenflags.js";
import { ModifierFlagsAbstract, ModifierFlagsPrivate, ModifierFlagsProtected, ModifiersToFlags } from "../ast/modifierflags.js";
import {
  NewArrowFunction,
  NewBlock,
  NewCallSignatureDeclaration,
  NewComputedPropertyName,
  NewConstructSignatureDeclaration,
  NewConditionalTypeNode,
  NewConstructorDeclaration,
  NewConstructorTypeNode,
  NewExpressionWithTypeArguments,
  NewFunctionDeclaration,
  NewFunctionExpression,
  NewFunctionTypeNode,
  NewGetAccessorDeclaration,
  NewArrayTypeNode,
  NewBigIntLiteral,
  NewInferTypeNode,
  NewIdentifier,
  NewImportAttribute,
  NewImportAttributes,
  NewImportTypeNode,
  NewIndexedAccessTypeNode,
  NewKeywordTypeNode,
  NewKeywordExpression,
  NewElementAccessExpression,
  NewIntersectionTypeNode,
  NewLiteralTypeNode,
  NewMappedTypeNode,
  NewMethodDeclaration,
  NewMethodSignatureDeclaration,
  NewNotEmittedTypeElement,
  NewNumericLiteral,
  NewNamedTupleMember,
  NewOptionalTypeNode,
  NewParameterDeclaration,
  NewParenthesizedTypeNode,
  NewPrefixUnaryExpression,
  NewPropertyAccessExpression,
  NewPropertySignatureDeclaration,
  NewQualifiedName,
  NewStringLiteral,
  NewThisTypeNode,
  NewTemplateHead,
  NewTemplateMiddle,
  NewTemplateTail,
  NewTemplateLiteralTypeNode,
  NewTemplateLiteralTypeSpan,
  NewToken,
  NewTypeOperatorNode,
  NewSetAccessorDeclaration,
  NewTypeParameterDeclaration,
  NewTypePredicateNode,
  NewTupleTypeNode,
  NewTypeQueryNode,
  NewTypeReferenceNode,
  NewRestTypeNode,
  NewTypeLiteralNode,
  NewUnionTypeNode,
  NewIndexSignatureDeclaration,
} from "../ast/generated/factory.js";
import { Node_Arguments, Node_Expression, Node_Initializer, Node_PostfixToken, Node_Symbol, Node_Type, Node_ModifierNodes, Node_ModuleSpecifier, Node_TypeArgumentList, Node_TypeArguments, NodeFactory_NewModifier, NodeFactory_UpdateBindingElement, SourceFile_FileName, SourceFile_Imports, SourceFile_IsJS, SourceFile_Path } from "../ast/ast.js";
import { NodeFactory_DeepCloneNode } from "../ast/deepclone.js";
import { Node_Clone, Node_Name, NodeDefault_AsNode, NodeFactory_AsNodeFactory, NodeFactory_NewModifierList, NodeFactory_NewNodeList, updateNode } from "../ast/spine.js";
import { NewTextRange } from "../core/text.js";
import type { Set } from "../collections/set.js";
import type { MultiMap } from "../collections/multimap.js";
import { MultiMap_Add, MultiMap_Values } from "../collections/multimap.js";
import { Every, Filter, Find, FirstNonNil, FirstOrNil, IfElse, Map as CoreMap, MapIndex, Some } from "../core/core.js";
import { LanguageVariantStandard } from "../core/languagevariant.js";
import { DeclarationNameToString, IsIdentifierText } from "../scanner/utilities.js";
import type { ResolutionMode } from "../core/compileroptions.js";
import { CompilerOptions_GetModuleResolutionKind, ModuleKindCommonJS, ModuleKindESNext, ModuleResolutionKindNode16, ModuleResolutionKindNodeNext, ResolutionModeESM, ResolutionModeNone } from "../core/compileroptions.js";
import type { LinkStore } from "../core/linkstore.js";
import { LinkStore_Get, LinkStore_Has, LinkStore_TryGet } from "../core/linkstore.js";
import type { ModeAwareCache } from "../module/cache.js";
import type { Flags, InternalFlags, SymbolTracker } from "../nodebuilder/types.js";
import {
  FlagsAllowAnonymousIdentifier,
  FlagsAllowEmptyUnionOrIntersection,
  FlagsAllowEmptyTuple,
  FlagsAllowEmptyIndexInfoType,
  FlagsAllowNodeModulesRelativePaths,
  FlagsAllowQualifiedNameInPlaceOfIdentifier,
  FlagsAllowThisInObjectLiteral,
  FlagsAllowUniqueESSymbolType,
  FlagsForbidIndexedAccessSymbolReferences,
  FlagsGenerateNamesForShadowedTypeParams,
  FlagsInInitialEntityName,
  FlagsInObjectTypeLiteral,
  FlagsInTypeAlias,
  FlagsMultilineObjectLiterals,
  FlagsNoTruncation,
  FlagsNoTypeReduction,
  FlagsOmitParameterModifiers,
  FlagsOmitThisParameter,
  FlagsSuppressAnyReturnType,
  FlagsUseAliasDefinedOutsideCurrentScope,
  FlagsUseFullyQualifiedType,
  FlagsUseInstantiationExpressions,
  FlagsUseOnlyExternalAliasing,
  FlagsUseStructuralFallback,
  FlagsUseTypeOfFunction,
  FlagsUseSingleQuotesForStringLiteralType,
  FlagsWriteClassExpressionAsTypeLiteral,
  FlagsWriteArrayAsGenericType,
  FlagsWriteTypeArgumentsOfSignature,
  FlagsWriteTypeParametersInQualifiedName,
  InternalFlagsDoNotIncludeSymbolChain,
  InternalFlagsWriteComputedProps,
} from "../nodebuilder/types.js";
import type { EmitContext } from "../printer/emitcontext.js";
import {
  EmitContext_AddEmitFlags,
  EmitContext_AddSyntheticLeadingComment,
  EmitContext_AddSyntheticTrailingComment,
  EmitContext_AssignCommentRange,
  EmitContext_MostOriginal,
  EmitContext_Original,
  EmitContext_SetEmitFlags,
  EmitContext_SetOriginalEx,
} from "../printer/emitcontext.js";
import { EFNoAsciiEscaping, EFNoIndentation, EFSingleLine } from "../printer/emitflags.js";
import { SymbolAccessibilityAccessible } from "../printer/emitresolver.js";
import { NewPseudoChecker } from "../pseudochecker/checker.js";
import type { PseudoChecker } from "../pseudochecker/checker.js";
import type { Checker, Host } from "./checker/state.js";
import { getBigIntLiteralValue, getNameFromIndexInfo, getMappedTypeModifiers, isRestParameter, isTupleType, signatureHasRestParameter, someType, TypeFactsNEUndefined, MappedTypeModifiersIncludeOptional } from "./checker/state.js";
import {
  Checker_getDefaultFromTypeParameter,
  Checker_getConstraintOfTypeParameter,
  Checker_getInferredTypeParameterConstraint,
  Checker_getLocalTypeParametersOfClassOrInterfaceOrTypeAlias,
  Checker_getMinTypeArgumentCount,
  Checker_getOuterTypeParametersOfClassOrInterface,
  Checker_getOrCreateTypeFromSignature,
  Checker_getSignatureFromDeclaration,
  Checker_getSignaturesOfType,
  Checker_getReturnTypeOfSignature,
  Checker_getTypeArguments,
  Checker_getTypeParameterFromMappedType,
  Checker_getTypeParametersFromDeclaration,
  Checker_getTypeReferenceArity,
  Checker_instantiateSignature,
  Checker_isLateBindableIndexSignature,
  Checker_newSignature,
  Checker_newTypeParameter,
} from "./checker/signatures.js";
import {
  Checker_getDeclaredTypeOfClassOrInterface,
  Checker_getHomomorphicTypeVariable,
  Checker_getBaseTypeVariableOfClass,
  Checker_getOptionalType,
  Checker_getRegularTypeOfExpression,
  Checker_getFalseTypeFromConditionalType,
  Checker_getTrueTypeFromConditionalType,
  Checker_getReducedType,
  Checker_getTypeFromTypeNode,
  Checker_getTypeFromTypeReference,
  Checker_getTypeWithFacts,
  Checker_getWidenedType,
  Checker_getWidenedLiteralType,
  Checker_getIntersectionType,
  Checker_getTemplateTypeFromMappedType,
  Checker_getModifiersTypeFromMappedType,
  Checker_filterType,
  Checker_getPropertiesOfObjectType,
  Checker_instantiateType,
  Checker_createArrayType,
  Checker_isReferenceToType,
  Checker_isGenericMappedType,
  Checker_removeMissingType,
  Checker_newAnonymousType,
} from "./checker/types.js";
import { Checker_getConstraintDeclaration, Checker_isNoInferType, Checker_getConstraintTypeFromMappedType, Checker_isMappedTypeWithKeyofConstraintDeclaration } from "./checker/inference.js";
import { Checker_IsLibSymbolForHoverVerbosity, Checker_IsLibTypeForHoverVerbosity } from "./services.js";
import {
  Checker_getAliasForSymbolInContainer,
  Checker_getAccessibleSymbolChain,
  Checker_getContainersOfSymbol,
  Checker_getFileSymbolIfFileSymbolExportEqualsContainer,
  Checker_IsSymbolAccessible,
  Checker_IsTypeSymbolAccessible,
  Checker_IsValueSymbolAccessible,
  Checker_needsQualification,
  getQualifiedLeftMeaning,
  hasNonGlobalAugmentationExternalModuleSymbol,
} from "./symbolaccessibility.js";
import {
  Checker_getExportsOfSymbol,
  Checker_getMembersOfSymbol,
  Checker_getDeclaredTypeOfSymbol,
  Checker_getGlobalTypeAliasSymbol,
  Checker_getNameTypeFromMappedType,
  Checker_getNonMissingTypeOfSymbol,
  Checker_getParentOfSymbol,
  Checker_getSymbolIfSameReference,
  Checker_getSymbolOfDeclaration,
  Checker_getSymbolOfNode,
  Checker_getTargetSymbol,
  Checker_getTypeOfSymbol,
  Checker_hasLateBindableName,
  Checker_isLateBindableName,
  Checker_getWriteTypeOfSymbol,
  Checker_isReadonlySymbol,
  Checker_newSymbol,
  Checker_newSymbolEx,
  Checker_resolveAlias,
  Checker_resolveEntityName,
  Checker_resolveStructuredTypeMembers, Checker_GetSymbolAtLocation, Checker_GetAliasedSymbol } from "./checker/symbols.js";
import { Checker_getTypeParameterModifiers, Checker_isTypeIdenticalTo } from "./relater.js";
import { Checker_GetEmitResolver } from "./checker/support.js";
import { Checker_isErrorType } from "./checker/diagnostics.js";
import { EmitResolver_isEntityNameVisible, EmitResolver_requiresAddingImplicitUndefined } from "./emitresolver.js";
import { Checker_getTupleElementLabel, Checker_getTypePredicateOfSignature, Checker_instantiateTypePredicate } from "./relater.js";
import type { TypeMapper } from "./mapper.js";
import { newTypeMapper, prependTypeMapping, TypeMapper_Map } from "./mapper.js";
import type { IndexInfo, InterfaceType, LiteralType, MappedType, ReverseMappedSymbolLinks, Signature, StructuredType, SymbolNodeLinks, Type, TypeAlias, TypeData, TypeId, TypeParameter, TypePredicate, TypeReference, UniqueESSymbolType, ValueSymbolLinks } from "./types.js";
import { ElementFlagsOptional, ElementFlagsRest, ElementFlagsVariable, InterfaceType_OuterTypeParameters, InterfaceType_TypeParameters, ObjectFlagsAnonymous, ObjectFlagsClassOrInterface, ObjectFlagsInstantiationExpressionType, ObjectFlagsIsClassInstanceClone, ObjectFlagsMapped, ObjectFlagsReference, ObjectFlagsRequiresWidening, ObjectFlagsReverseMapped, ObjectFlagsTuple, SignatureFlagsAbstract, SignatureFlagsNone, SignatureKindCall, StructuredType_CallSignatures, StructuredType_ConstructSignatures, Type_AsConditionalType, Type_AsIndexedAccessType, Type_AsInstantiationExpressionType, Type_AsInterfaceType, Type_AsIntersectionType, Type_AsLiteralType, Type_AsMappedType, Type_AsObjectType, Type_AsStringMappingType, Type_AsStructuredType, Type_AsSubstitutionType, Type_AsTemplateLiteralType, Type_AsTypeParameter, Type_AsTypeReference, Type_AsTupleType, Type_AsUnionOrIntersectionType, Type_AsUnionType, Type_Types, Type_AsUniqueESSymbolType, Type_Target, TypeAlias_Symbol, TypeAlias_TypeArguments, TypeBase_AsType, TypeFlagsAny, TypeFlagsBigInt, TypeFlagsBigIntLiteral, TypeFlagsBoolean, TypeFlagsBooleanLiteral, TypeFlagsConditional, TypeFlagsESSymbol, TypeFlagsEnumLike, TypeFlagsEnumLiteral, TypeFlagsIndex, TypeFlagsIndexedAccess, TypeFlagsIntersection, TypeFlagsNever, TypeFlagsNonPrimitive, TypeFlagsNull, TypeFlagsNumber, TypeFlagsNumberLiteral, TypeFlagsObject, TypeFlagsString, TypeFlagsStringLike, TypeFlagsStringLiteral, TypeFlagsStringMapping, TypeFlagsStringOrNumberLiteral, TypeFlagsSubstitution, TypeFlagsTemplateLiteral, TypeFlagsTypeParameter, TypeFlagsUndefined, TypeFlagsUnion, TypeFlagsUniqueESSymbol, TypeFlagsUnknown, TypeFlagsVoid, TypePredicateKindAssertsIdentifier, TypePredicateKindAssertsThis, TypePredicateKindIdentifier } from "./types.js";
import { Checker_formatUnionTypes, Checker_symbolToString, Checker_valueToString } from "./printer.js";
import { containsNonMissingUndefinedType, getDeclarationModifierFlagsFromSymbol, Checker_isOptionalParameter, isLateBoundName, isNumericLiteralName, isOptionalDeclaration, IsPrivateIdentifierSymbol, isReservedMemberName, pseudoBigIntToString, Checker_sortSymbols, IsTypeAny, isThisTypeParameter } from "./utilities.js";
import { PathIsRelative } from "../tspath/path.js";
import { CountPathComponents } from "../modulespecifiers/compare.js";
import type { ModuleSpecifierGenerationHost, SourceFileForSpecifierGeneration } from "../modulespecifiers/types.js";
import { ImportModuleSpecifierEndingPreferenceJs, ImportModuleSpecifierEndingPreferenceNone, ImportModuleSpecifierPreferenceProjectRelative } from "../modulespecifiers/types.js";
import { GetModuleSpecifiers } from "../modulespecifiers/specifiers.js";
import type { ModeAwareCacheKey } from "../module/types.js";
import type { SymbolAccessibilityResult } from "../printer/emitresolver.js";
import { NodeBuilderImpl_reuseNode, NodeBuilderImpl_tryReuseExistingNodeHelper } from "./nodecopy.js";
import { Checker_checkExpression } from "./checker/syntax-checking.js";
import { FromString, Number_String } from "../jsnum/string.js";
import type { Number as JsNumber } from "../jsnum/jsnum.js";
import { StripQuotes, UnquoteString } from "../stringutil/util.js";
import { Set_Add, Set_Delete, Set_Has } from "../collections/set.js";
import type { CopyOnWriteMap, CopyOnWriteSet } from "../collections/cow.js";
import { CopyOnWriteMap_Get, CopyOnWriteMap_Set, CopyOnWriteSet_Add, CopyOnWriteSet_Has } from "../collections/cow.js";
import { NodeBuilderImpl_pseudoReturnTypeMatchesPredicate, NodeBuilderImpl_pseudoTypeEquivalentToType, NodeBuilderImpl_pseudoTypeToNodeWithCheckerFallback, NodeBuilderImpl_pseudoTypeToType } from "./pseudotypenodebuilder.js";
import { NodeBuilderImpl_addSymbolTypeToContext, NodeBuilderImpl_enterNewScope, NodeBuilderImpl_enterSignatureScope } from "./nodebuilderscopes.js";
import { PseudoChecker_GetReturnTypeOfSignature, PseudoChecker_GetTypeOfAccessor, PseudoChecker_GetTypeOfDeclaration } from "../pseudochecker/lookup.js";
import type { PseudoType } from "../pseudochecker/type.js";
import { NewPseudoTypeUnion, PseudoType_AsPseudoTypeInferred, PseudoTypeKindInferred, PseudoTypeKindNoResult, PseudoTypeUndefined } from "../pseudochecker/type.js";
import { isExpanding } from "./nodebuilder_hover.js";
import * as slices from "../../go/slices.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::type::CompositeSymbolIdentity","kind":"type","status":"implemented","sigHash":"63514e5aab5471e2bab3ef29ffba28b0a73601b785edc7c308cd3b4728c501c4","bodyHash":"34b94602045468ce4801ed8661c2bcd1d48e14cd0dd0bd5326decd357a921eff"}
 *
 * Go source:
 * CompositeSymbolIdentity struct {
 * 	isConstructorNode bool
 * 	symbolId          ast.SymbolId
 * 	nodeId            ast.NodeId
 * }
 */
export interface CompositeSymbolIdentity {
  isConstructorNode: bool;
  symbolId: SymbolId;
  nodeId: NodeId;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::type::TrackedSymbolArgs","kind":"type","status":"implemented","sigHash":"78325b6b68bce109855433857939b11b15b26b61cef1f3a0381d6a5834768c9d","bodyHash":"743c9f4142afe6cfc9be9fc3e849bf6b8e7d8d81fc86c96bd438d8171015dfb9"}
 *
 * Go source:
 * TrackedSymbolArgs struct {
 * 	symbol               *ast.Symbol
 * 	enclosingDeclaration *ast.Node
 * 	meaning              ast.SymbolFlags
 * }
 */
export interface TrackedSymbolArgs {
  "symbol": GoPtr<Symbol>;
  enclosingDeclaration: GoPtr<Node>;
  meaning: SymbolFlags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::type::SerializedTypeEntry","kind":"type","status":"implemented","sigHash":"46619991febe06dadf5fbb7e4e3fccda00d436fd4f5223be4a5fe34de126192b","bodyHash":"a431bcd8f0752706be63e6757d0961799a24764f43586472d3abe83ac43e9e36"}
 *
 * Go source:
 * SerializedTypeEntry struct {
 * 	node           *ast.Node
 * 	truncating     bool
 * 	addedLength    int
 * 	trackedSymbols []*TrackedSymbolArgs
 * }
 */
export interface SerializedTypeEntry {
  node: GoPtr<Node>;
  truncating: bool;
  addedLength: int;
  trackedSymbols: GoSlice<GoPtr<TrackedSymbolArgs>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::type::CompositeTypeCacheIdentity","kind":"type","status":"implemented","sigHash":"e319268e9c77712641b75c9ba60d3c27f3cfc7f2a6bddeb55d7754af1ab5d8bf","bodyHash":"684b332578c7fbb10e49d1ce600d3325cc815a4c5d78056858dd421d3a9bdacd"}
 *
 * Go source:
 * CompositeTypeCacheIdentity struct {
 * 	typeId        TypeId
 * 	flags         nodebuilder.Flags
 * 	internalFlags nodebuilder.InternalFlags
 * }
 */
export interface CompositeTypeCacheIdentity {
  typeId: TypeId;
  flags: Flags;
  internalFlags: InternalFlags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::type::NodeBuilderLinks","kind":"type","status":"implemented","sigHash":"7210ed5377e1dc79feeca81e080aa78018e074b8c1d2082cb6802b67b1f99352","bodyHash":"f1107b1496e1355c8b0c5f14ae6e467787b7ca167e47d6ddddae5a41f4a4fe90"}
 *
 * Go source:
 * NodeBuilderLinks struct {
 * 	serializedTypes                  map[CompositeTypeCacheIdentity]*SerializedTypeEntry // Collection of types serialized at this location
 * 	fakeScopeForSignatureDeclaration *string                                             // If present, this is a fake scope injected into an enclosing declaration chain.
 * }
 */
export interface NodeBuilderLinks {
  serializedTypes: GoMap<CompositeTypeCacheIdentity, GoPtr<SerializedTypeEntry>>;
  fakeScopeForSignatureDeclaration: GoPtr<string>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::type::NodeBuilderSymbolLinks","kind":"type","status":"implemented","sigHash":"ef3a6f922d6893a6fdb7ea73f644d35f08e22849d47c085450b1e1ac29ac2709","bodyHash":"559f1a89c5b802246b753f3c012078850ab202f7a874379e9e55bd5645e913d5"}
 *
 * Go source:
 * NodeBuilderSymbolLinks struct {
 * 	specifierCache module.ModeAwareCache[string]
 * }
 */
export interface NodeBuilderSymbolLinks {
  specifierCache: ModeAwareCache<string>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::type::NodeBuilderContext","kind":"type","status":"implemented","sigHash":"4012a0428038ee5734a8ff96ce9b0f1f45dfaad9789ee658eeefe61d99accb37","bodyHash":"610a5764c48c995dd942afe77bd62c70566c0262afce6ab6ae282f3604dcabae"}
 *
 * Go source:
 * NodeBuilderContext struct {
 * 	host                            Host
 * 	tracker                         nodebuilder.SymbolTracker
 * 	approximateLength               int
 * 	maxTruncationLength             int
 * 	encounteredError                bool
 * 	truncating                      bool
 * 	reportedDiagnostic              bool
 * 	flags                           nodebuilder.Flags
 * 	internalFlags                   nodebuilder.InternalFlags
 * 	depth                           int
 * 	maxExpansionDepth               int // -1 means no expansion, 0+ = verbosity levels
 * 	typeStack                       []*Type
 * 	canIncreaseExpansionDepth       bool
 * 	expansionTruncated              bool
 * 	enclosingDeclaration            *ast.Node
 * 	enclosingFile                   *ast.SourceFile
 * 	inferTypeParameters             []*Type
 * 	visitedTypes                    collections.Set[TypeId]
 * 	symbolDepth                     map[CompositeSymbolIdentity]int
 * 	trackedSymbols                  []*TrackedSymbolArgs
 * 	mapper                          *TypeMapper
 * 	reverseMappedStack              []*ast.Symbol
 * 	enclosingSymbolTypes            map[ast.SymbolId]*Type
 * 	suppressReportInferenceFallback bool
 * 	remappedSymbolReferences        map[ast.SymbolId]*ast.Symbol
 *
 * 	// per signature scope state
 * 	typeParameterNames                    collections.CopyOnWriteMap[TypeId, *ast.Identifier]
 * 	typeParameterNamesByText              collections.CopyOnWriteSet[string]
 * 	typeParameterNamesByTextNextNameCount collections.CopyOnWriteMap[string, int]
 * 	typeParameterSymbolList               collections.CopyOnWriteSet[ast.SymbolId]
 * }
 */
export interface NodeBuilderContext {
  host: Host;
  tracker: GoPtr<SymbolTracker>;
  approximateLength: int;
  maxTruncationLength: int;
  encounteredError: bool;
  truncating: bool;
  reportedDiagnostic: bool;
  flags: Flags;
  internalFlags: InternalFlags;
  depth: int;
  maxExpansionDepth: int;
  typeStack: GoSlice<GoPtr<Type>>;
  canIncreaseExpansionDepth: bool;
  expansionTruncated: bool;
  enclosingDeclaration: GoPtr<Node>;
  enclosingFile: GoPtr<SourceFile>;
  inferTypeParameters: GoSlice<GoPtr<Type>>;
  visitedTypes: Set<TypeId>;
  symbolDepth: GoMap<CompositeSymbolIdentity, int>;
  trackedSymbols: GoSlice<GoPtr<TrackedSymbolArgs>>;
  mapper: GoPtr<TypeMapper>;
  reverseMappedStack: GoSlice<GoPtr<Symbol>>;
  enclosingSymbolTypes: GoMap<SymbolId, GoPtr<Type>>;
  suppressReportInferenceFallback: bool;
  remappedSymbolReferences: GoMap<SymbolId, GoPtr<Symbol>>;
  typeParameterNames: CopyOnWriteMap<TypeId, GoPtr<Identifier>>;
  typeParameterNamesByText: CopyOnWriteSet<string>;
  typeParameterNamesByTextNextNameCount: CopyOnWriteMap<string, int>;
  typeParameterSymbolList: CopyOnWriteSet<SymbolId>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::type::NodeBuilderImpl","kind":"type","status":"implemented","sigHash":"12872e28bcddd6645c61f48e19c533dcdb7b97bc4170a1b545a15e576fa116db","bodyHash":"710195befd5f57cadcc0474de6e685f88527b27f2fcfb9922749cbed8ceba39d"}
 *
 * Go source:
 * NodeBuilderImpl struct {
 * 	// host members
 * 	f  *ast.NodeFactory
 * 	ch *Checker
 * 	e  *printer.EmitContext
 * 	pc *pseudochecker.PseudoChecker
 * 
 * 	// cache
 * 	links       core.LinkStore[*ast.Node, NodeBuilderLinks]
 * 	symbolLinks core.LinkStore[*ast.Symbol, NodeBuilderSymbolLinks]
 * 
 * 	// state
 * 	ctx *NodeBuilderContext
 * 
 * 	// reusable visitor
 * 	cloneBindingNameVisitor *ast.NodeVisitor
 * 
 * 	// symbols for synthesized identifiers, needed for e.g. inlay hints
 * 	idToSymbol map[*ast.IdentifierNode]*ast.Symbol
 * }
 */
export interface NodeBuilderImpl {
  f: GoPtr<NodeFactory>;
  ch: GoPtr<Checker>;
  e: GoPtr<EmitContext>;
  pc: GoPtr<PseudoChecker>;
  links: LinkStore<GoPtr<Node>, NodeBuilderLinks>;
  symbolLinks: LinkStore<GoPtr<Symbol>, NodeBuilderSymbolLinks>;
  ctx: GoPtr<NodeBuilderContext>;
  cloneBindingNameVisitor: GoPtr<NodeVisitor>;
  idToSymbol: GoMap<GoPtr<IdentifierNode>, GoPtr<Symbol>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::constGroup::defaultMaximumTruncationLength+noTruncationMaximumTruncationLength","kind":"constGroup","status":"implemented","sigHash":"1352d5eaf71b82771b795fdeb63e9dd6e987d4eac5e76b57b8ce09ec72726f80","bodyHash":"32c74160ff4624b3afae10ceed1e9ebbfbca687ef912839febbf9b6d5c04fc33"}
 *
 * Go source:
 * const (
 * 	defaultMaximumTruncationLength      = 160
 * 	noTruncationMaximumTruncationLength = 1_000_000
 * )
 */
export const defaultMaximumTruncationLength: int = 160;
export const noTruncationMaximumTruncationLength: int = 1_000_000;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::newNodeBuilderImpl","kind":"func","status":"implemented","sigHash":"303887edcbcefc0e5ebc97d40e3ae0fc9bea35ca2be05df3fa7ea5f306f2c9d5","bodyHash":"e5d1d3b9b9ea138b2ca606fc12248f77c3432f5f0d8a5529e7eafa9506d523f6"}
 *
 * Go source:
 * func newNodeBuilderImpl(ch *Checker, e *printer.EmitContext, idToSymbol map[*ast.IdentifierNode]*ast.Symbol) *NodeBuilderImpl {
 * 	if idToSymbol == nil {
 * 		idToSymbol = make(map[*ast.IdentifierNode]*ast.Symbol)
 * 	}
 * 	b := &NodeBuilderImpl{f: e.Factory.AsNodeFactory(), ch: ch, e: e, idToSymbol: idToSymbol, pc: pseudochecker.NewPseudoChecker(ch.strictNullChecks, ch.exactOptionalPropertyTypes)}
 * 	b.cloneBindingNameVisitor = ast.NewNodeVisitor(b.cloneBindingName, b.f, ast.NodeVisitorHooks{})
 * 	return b
 * }
 */
export function newNodeBuilderImpl(ch: GoPtr<Checker>, e: GoPtr<EmitContext>, idToSymbol: GoMap<GoPtr<IdentifierNode>, GoPtr<Symbol>>): GoPtr<NodeBuilderImpl> {
  const resolvedIdToSymbol: GoMap<GoPtr<IdentifierNode>, GoPtr<Symbol>> = idToSymbol !== undefined ? idToSymbol : new globalThis.Map();
  const b: NodeBuilderImpl = {
    f: e!.Factory!.__tsgoEmbedded0!,
    ch,
    e,
    pc: NewPseudoChecker(ch!.strictNullChecks, ch!.exactOptionalPropertyTypes),
    links: { entries: new globalThis.Map(), arena: { data: [] } } as unknown as LinkStore<GoPtr<Node>, NodeBuilderLinks>,
    symbolLinks: { entries: new globalThis.Map(), arena: { data: [] } } as unknown as LinkStore<GoPtr<Symbol>, NodeBuilderSymbolLinks>,
    ctx: undefined,
    cloneBindingNameVisitor: undefined,
    idToSymbol: resolvedIdToSymbol,
  };
  b.cloneBindingNameVisitor = NewNodeVisitor((node) => NodeBuilderImpl_cloneBindingName(b, node), b.f, {} as NodeVisitorHooks);
  return b;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.saveRestoreFlags","kind":"method","status":"implemented","sigHash":"481640053e023a2e32213a6cbffcf4b7e0085c4f42a1812e0332991239dedd90","bodyHash":"7a1e64ef83864eab1b933607e1a35e77577870acda555e714956e62fca09cc8d"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) saveRestoreFlags() func() {
 * 	flags := b.ctx.flags
 * 	internalFlags := b.ctx.internalFlags
 * 	depth := b.ctx.depth
 * 
 * 	return func() {
 * 		b.ctx.flags = flags
 * 		b.ctx.internalFlags = internalFlags
 * 		b.ctx.depth = depth
 * 	}
 * }
 */
export function NodeBuilderImpl_saveRestoreFlags(receiver: GoPtr<NodeBuilderImpl>): () => void {
  const flags = receiver!.ctx!.flags;
  const internalFlags = receiver!.ctx!.internalFlags;
  const depth = receiver!.ctx!.depth;

  return () => {
    receiver!.ctx!.flags = flags;
    receiver!.ctx!.internalFlags = internalFlags;
    receiver!.ctx!.depth = depth;
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.checkTruncationLength","kind":"method","status":"implemented","sigHash":"67b0ec91b64cfcd0a906e1e1fc6c52e64288d0e2da250dc20d63bb4958c47a1d","bodyHash":"c12354971e27194a850bfdf66708b32c56d4ac941fb68c94e9df1b6ff51ed769"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) checkTruncationLength() bool {
 * 	if b.ctx.truncating {
 * 		return b.ctx.truncating
 * 	}
 * 	var maxLength int
 * 	if b.ctx.flags&nodebuilder.FlagsNoTruncation != 0 {
 * 		maxLength = noTruncationMaximumTruncationLength
 * 	} else if b.ctx.maxTruncationLength > 0 {
 * 		maxLength = b.ctx.maxTruncationLength
 * 	} else {
 * 		maxLength = defaultMaximumTruncationLength
 * 	}
 * 	b.ctx.truncating = b.ctx.approximateLength > maxLength
 * 	return b.ctx.truncating
 * }
 */
export function NodeBuilderImpl_checkTruncationLength(receiver: GoPtr<NodeBuilderImpl>): bool {
  if (receiver!.ctx!.truncating) {
    return receiver!.ctx!.truncating;
  }
  const maxLength =
    (receiver!.ctx!.flags & FlagsNoTruncation) !== 0
      ? noTruncationMaximumTruncationLength
      : receiver!.ctx!.maxTruncationLength > 0
        ? receiver!.ctx!.maxTruncationLength
        : defaultMaximumTruncationLength;
  receiver!.ctx!.truncating = receiver!.ctx!.approximateLength > maxLength;
  return receiver!.ctx!.truncating;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.checkTruncationLengthIfExpanding","kind":"method","status":"implemented","sigHash":"8099fa2a7ead62b5949c7518acac3e83e8eb6a6efdde36039224df423734ac50","bodyHash":"6953b6ac5599e5150806201a5d9fc48a1446faece704f1a7bfa408f0673586aa"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) checkTruncationLengthIfExpanding() bool {
 * 	if b.ctx.maxExpansionDepth >= 0 && b.checkTruncationLength() {
 * 		b.ctx.expansionTruncated = true
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function NodeBuilderImpl_checkTruncationLengthIfExpanding(receiver: GoPtr<NodeBuilderImpl>): bool {
  if (receiver!.ctx!.maxExpansionDepth >= 0 && NodeBuilderImpl_checkTruncationLength(receiver)) {
    receiver!.ctx!.expansionTruncated = true;
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.isExpandableType","kind":"method","status":"implemented","sigHash":"c56fd90c0ffdca4713d2ddebd71899ef89022378b0843029cc3d263f90f1c585","bodyHash":"6ee8737e973ce98dfd061fda84598d300726b226ee30b7e1613bccf8e76d9484"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) isExpandableType(t *Type, isAlias bool) bool {
 * 	if isAlias {
 * 		return !b.ch.IsLibSymbolForHoverVerbosity(t.alias.Symbol())
 * 	}
 * 	if b.ch.IsLibTypeForHoverVerbosity(t) {
 * 		return false
 * 	}
 * 	objectFlags := t.objectFlags
 * 	if t.flags&TypeFlagsEnumLike != 0 ||
 * 		objectFlags&ObjectFlagsReference != 0 ||
 * 		objectFlags&ObjectFlagsClassOrInterface != 0 {
 * 		return true
 * 	}
 * 	if objectFlags&ObjectFlagsAnonymous != 0 && t.symbol != nil &&
 * 		t.symbol.Flags&(ast.SymbolFlagsClass|ast.SymbolFlagsEnum|ast.SymbolFlagsValueModule|ast.SymbolFlagsFunction|ast.SymbolFlagsMethod) != 0 {
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function NodeBuilderImpl_isExpandableType(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>, isAlias: bool): bool {
  if (isAlias) {
    return !Checker_IsLibSymbolForHoverVerbosity(receiver!.ch, TypeAlias_Symbol(t!.alias));
  }
  if (Checker_IsLibTypeForHoverVerbosity(receiver!.ch, t)) {
    return false;
  }
  const objectFlags = t!.objectFlags;
  if ((t!.flags & TypeFlagsEnumLike) !== 0 ||
    (objectFlags & ObjectFlagsReference) !== 0 ||
    (objectFlags & ObjectFlagsClassOrInterface) !== 0) {
    return true;
  }
  if ((objectFlags & ObjectFlagsAnonymous) !== 0 && t!.symbol !== undefined &&
    (t!.symbol!.Flags & (SymbolFlagsClass | SymbolFlagsEnum | SymbolFlagsValueModule | SymbolFlagsFunction | SymbolFlagsMethod)) !== 0) {
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.isTypeOnStack","kind":"method","status":"implemented","sigHash":"0346147b3f04c9aef096c8b38e13ef63725ed2005f2bd3bd5ad8beb53687f8e3","bodyHash":"7a41f5502810eecd28b29da3f5b80ac4455dfa637ec90c38c06c38f5f7aa3c85"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) isTypeOnStack(t *Type) bool {
 * 	for i := range len(b.ctx.typeStack) - 1 {
 * 		if b.ctx.typeStack[i] == t {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function NodeBuilderImpl_isTypeOnStack(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>): bool {
  for (let i = 0; i < receiver!.ctx!.typeStack.length - 1; i++) {
    if (receiver!.ctx!.typeStack[i] === t) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.shouldExpandType","kind":"method","status":"implemented","sigHash":"a8c280b3e82fa739ab1273e208da1c3269846f67b7d6eb321a3d07f723807064","bodyHash":"8a8c15c55c22472a23e47b41ef05a7ff8dc1d2ebb6385cc451a7e4f8fd30b411"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) shouldExpandType(t *Type, isAlias bool) bool {
 * 	if b.ctx.maxExpansionDepth < 0 {
 * 		return false
 * 	}
 * 	if !b.isExpandableType(t, isAlias) {
 * 		return false
 * 	}
 * 	if b.isTypeOnStack(t) {
 * 		return false
 * 	}
 * 	if b.ctx.depth < b.ctx.maxExpansionDepth {
 * 		return true
 * 	}
 * 	b.ctx.canIncreaseExpansionDepth = true
 * 	return false
 * }
 */
export function NodeBuilderImpl_shouldExpandType(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>, isAlias: bool): bool {
  if (receiver!.ctx!.maxExpansionDepth < 0) {
    return false;
  }
  if (!NodeBuilderImpl_isExpandableType(receiver, t, isAlias)) {
    return false;
  }
  if (NodeBuilderImpl_isTypeOnStack(receiver, t)) {
    return false;
  }
  if (receiver!.ctx!.depth < receiver!.ctx!.maxExpansionDepth) {
    return true;
  }
  receiver!.ctx!.canIncreaseExpansionDepth = true;
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.isActivelyExpanding","kind":"method","status":"implemented","sigHash":"026f73f72a62044422d30df11952a4c059e67a6d5c1f04767a6ecaaaa6fe3489","bodyHash":"7609a74f156d1c67ad5f7d3475bcea33103dfbf7ab6b087eb0784bc39e99631e"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) isActivelyExpanding() bool {
 * 	return b.ctx.maxExpansionDepth > 0 && b.ctx.depth < b.ctx.maxExpansionDepth
 * }
 */
export function NodeBuilderImpl_isActivelyExpanding(receiver: GoPtr<NodeBuilderImpl>): bool {
  return receiver!.ctx!.maxExpansionDepth > 0 && receiver!.ctx!.depth < receiver!.ctx!.maxExpansionDepth;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.checkTypeExpandability","kind":"method","status":"implemented","sigHash":"ee0a6bfcb2c39a09fe18bb2a99050629f47fff415b75168392931fb71bd4f426","bodyHash":"c08ae74487dac35dbae0347032890d50a1587c2a83f25c30b7e13896374ee517"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) checkTypeExpandability(t *Type) {
 * 	if b.ctx.maxExpansionDepth < 0 || t == nil || b.ctx.canIncreaseExpansionDepth {
 * 		return
 * 	}
 * 	// Push t onto the type stack so shouldExpandType's cycle detection works correctly.
 * 	b.ctx.typeStack = append(b.ctx.typeStack, t)
 * 	if t.alias != nil {
 * 		b.shouldExpandType(t, true)
 * 	}
 * 	if !b.ctx.canIncreaseExpansionDepth {
 * 		b.shouldExpandType(t, false)
 * 	}
 * 	b.ctx.typeStack = b.ctx.typeStack[:len(b.ctx.typeStack)-1]
 * 	if b.ctx.canIncreaseExpansionDepth {
 * 		return
 * 	}
 * 	// Recurse into type arguments (e.g., check Apple in Promise<Apple>).
 * 	if t.objectFlags&ObjectFlagsReference != 0 {
 * 		for _, arg := range b.ch.getTypeArguments(t) {
 * 			b.checkTypeExpandability(arg)
 * 			if b.ctx.canIncreaseExpansionDepth {
 * 				return
 * 			}
 * 		}
 * 	}
 * }
 */
export function NodeBuilderImpl_checkTypeExpandability(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>): void {
  if (receiver!.ctx!.maxExpansionDepth < 0 || t === undefined || receiver!.ctx!.canIncreaseExpansionDepth) {
    return;
  }
  // Push t onto the type stack so shouldExpandType's cycle detection works correctly.
  receiver!.ctx!.typeStack = [...receiver!.ctx!.typeStack, t];
  if (t!.alias !== undefined) {
    NodeBuilderImpl_shouldExpandType(receiver, t, true as bool);
  }
  if (!receiver!.ctx!.canIncreaseExpansionDepth) {
    NodeBuilderImpl_shouldExpandType(receiver, t, false as bool);
  }
  receiver!.ctx!.typeStack = receiver!.ctx!.typeStack.slice(0, receiver!.ctx!.typeStack.length - 1);
  if (receiver!.ctx!.canIncreaseExpansionDepth) {
    return;
  }
  // Recurse into type arguments (e.g., check Apple in Promise<Apple>).
  if ((t!.objectFlags & ObjectFlagsReference) !== 0) {
    const typeArgs = Checker_getTypeArguments(receiver!.ch, t);
    for (const arg of typeArgs) {
      NodeBuilderImpl_checkTypeExpandability(receiver, arg);
      if (receiver!.ctx!.canIncreaseExpansionDepth) {
        return;
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.appendReferenceToType","kind":"method","status":"implemented","sigHash":"4b5c82ce29e2ed4c749e73a579729438a58453d5db54b71dac942d570d74bdf4","bodyHash":"e53f966cac2d080c1bc443a4f39a01a893b118733f6914dc2f9efc8d8af3f1a4"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) appendReferenceToType(root *ast.TypeNode, ref *ast.TypeNode) *ast.TypeNode {
 * 	if ast.IsImportTypeNode(root) {
 * 		// first shift type arguments
 * 
 * 		// !!! In the old emitter, an Identifier could have type arguments for use with quickinfo:
 * 		// typeArguments := root.TypeArguments
 * 		// qualifier := root.AsImportTypeNode().Qualifier
 * 		// if qualifier != nil {
 * 		// 	if ast.IsIdentifier(qualifier) {
 * 		// 		if typeArguments != getIdentifierTypeArguments(qualifier) {
 * 		// 			qualifier = setIdentifierTypeArguments(b.f.CloneNode(qualifier), typeArguments)
 * 		// 		}
 * 		// 	} else {
 * 		// 		if typeArguments != getIdentifierTypeArguments(qualifier.Right) {
 * 		// 			qualifier = b.f.UpdateQualifiedName(qualifier, qualifier.Left, setIdentifierTypeArguments(b.f.cloneNode(qualifier.Right), typeArguments))
 * 		// 		}
 * 		// 	}
 * 		// }
 * 		// !!! Without the above, nested type args are silently elided
 * 		imprt := root.AsImportTypeNode()
 * 		// then move qualifiers
 * 		ids := getAccessStack(ref)
 * 		qualifier := root.AsImportTypeNode().Qualifier
 * 		for _, id := range ids {
 * 			if qualifier != nil {
 * 				qualifier = b.f.NewQualifiedName(qualifier, id)
 * 			} else {
 * 				qualifier = id
 * 			}
 * 		}
 * 		return b.f.UpdateImportTypeNode(imprt, imprt.IsTypeOf, imprt.Argument, imprt.Attributes, qualifier, ref.TypeArgumentList())
 * 	} else if ast.IsTypeReferenceNode(root) {
 * 		typeRef := root.AsTypeReferenceNode()
 * 		if b.ctx.flags&nodebuilder.FlagsUseInstantiationExpressions != 0 && typeRef.TypeArguments != nil && len(typeRef.TypeArguments.Nodes) != 0 {
 * 			expr := b.createExpressionWithTypeArguments(b.createAccessExpression(typeRef.TypeName), typeRef.TypeArguments)
 * 			for _, id := range getAccessStack(ref) {
 * 				expr = b.f.NewPropertyAccessExpression(expr, nil, id, ast.NodeFlagsNone)
 * 			}
 * 			return expr
 * 		}
 * 		var typeName *ast.Node = typeRef.TypeName
 * 		for _, id := range getAccessStack(ref) {
 * 			typeName = b.f.NewQualifiedName(typeName, id)
 * 		}
 * 		return b.f.UpdateTypeReferenceNode(root.AsTypeReferenceNode(), typeName, ref.TypeArgumentList())
 * 	}
 * 	expr := b.createAccessExpression(root)
 * 	for _, id := range getAccessStack(ref) {
 * 		expr = b.f.NewPropertyAccessExpression(expr, nil, id, ast.NodeFlagsNone)
 * 	}
 * 	return expr
 * }
 */
export function NodeBuilderImpl_appendReferenceToType(receiver: GoPtr<NodeBuilderImpl>, root: GoPtr<TypeNode>, ref: GoPtr<TypeNode>): GoPtr<TypeNode> {
  if (IsImportTypeNode(root)) {
    const imprt = AsImportTypeNode(root);
    const ids = getAccessStack(ref);
    const qualifier = ids.reduce<GoPtr<Node>>((q, id) => q !== undefined ? NewQualifiedName(receiver!.f, q, id) : id, imprt!.Qualifier);
    const updated = NewImportTypeNode(receiver!.f, imprt!.IsTypeOf, imprt!.Argument, imprt!.Attributes, qualifier, Node_TypeArgumentList(ref));
    if (updated !== root) {
      return updateNode(updated, root, receiver!.f!.hooks);
    }
    return root;
  }
  if (IsTypeReferenceNode(root)) {
    const typeRef = AsTypeReferenceNode(root);
    if ((receiver!.ctx!.flags & FlagsUseInstantiationExpressions) !== 0 && typeRef!.TypeArguments !== undefined && typeRef!.TypeArguments.Nodes.length !== 0) {
      const ids2 = getAccessStack(ref);
      const expr = ids2.reduce<GoPtr<Expression>>(
        (e, id) => NewPropertyAccessExpression(receiver!.f, e, undefined, id, NodeFlagsNone),
        NodeBuilderImpl_createExpressionWithTypeArguments(receiver, NodeBuilderImpl_createAccessExpression(receiver, typeRef!.TypeName), typeRef!.TypeArguments)
      );
      return expr;
    }
    const ids3 = getAccessStack(ref);
    const typeName = ids3.reduce<GoPtr<Node>>((tn, id) => NewQualifiedName(receiver!.f, tn, id), typeRef!.TypeName);
    const updated2 = NewTypeReferenceNode(receiver!.f, typeName, Node_TypeArgumentList(ref));
    if (updated2 !== root) {
      return updateNode(updated2, root, receiver!.f!.hooks);
    }
    return root;
  }
  const ids4 = getAccessStack(ref);
  return ids4.reduce<GoPtr<Expression>>(
    (e, id) => NewPropertyAccessExpression(receiver!.f, e, undefined, id, NodeFlagsNone),
    NodeBuilderImpl_createAccessExpression(receiver, root)
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::getAccessStack","kind":"func","status":"implemented","sigHash":"e81bea51ac035ca1a5aefa300603c9fa8f4b0ab90c254cde0b6512b6c7ab7bde","bodyHash":"373227ce0f15507c2168dc78d37cc18e32c9af99397901f1f3641912ef1b849a"}
 *
 * Go source:
 * func getAccessStack(ref *ast.Node) []*ast.Node {
 * 	var state *ast.Node = ref.AsTypeReferenceNode().TypeName
 * 	ids := []*ast.Node{}
 * 	for !ast.IsIdentifier(state) {
 * 		entity := state.AsQualifiedName()
 * 		ids = append([]*ast.Node{entity.Right}, ids...)
 * 		state = entity.Left
 * 	}
 * 	ids = append([]*ast.Node{state}, ids...)
 * 	return ids
 * }
 */
export function getAccessStack(ref: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  let state: GoPtr<Node> = AsTypeReferenceNode(ref)!.TypeName;
  let ids: GoSlice<GoPtr<Node>> = [];
  while (!IsIdentifier(state)) {
    const entity = AsQualifiedName(state)!;
    ids = [entity.Right, ...ids];
    state = entity.Left;
  }
  ids = [state, ...ids];
  return ids;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::isClassInstanceSide","kind":"func","status":"implemented","sigHash":"74f86d23953aab6733a46ed9d7531f1a98005ed802182052e17537c45f9b8b05","bodyHash":"78d111188c35f6b8052c0f3e6d3276a2fb7b314dc298db05bcbedcc37f228223"}
 *
 * Go source:
 * func isClassInstanceSide(c *Checker, t *Type) bool {
 * 	return t.symbol != nil && t.symbol.Flags&ast.SymbolFlagsClass != 0 && (t == c.getDeclaredTypeOfClassOrInterface(t.symbol) || (t.flags&TypeFlagsObject != 0 && t.objectFlags&ObjectFlagsIsClassInstanceClone != 0))
 * }
 */
export function isClassInstanceSide(c: GoPtr<Checker>, t: GoPtr<Type>): bool {
  return (t!.symbol !== undefined &&
    (t!.symbol!.Flags & SymbolFlagsClass) !== 0 &&
    (t === Checker_getDeclaredTypeOfClassOrInterface(c, t!.symbol) ||
      ((t!.flags & TypeFlagsObject) !== 0 && (t!.objectFlags & ObjectFlagsIsClassInstanceClone) !== 0))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.createElidedInformationPlaceholder","kind":"method","status":"implemented","sigHash":"37ab351848194dccb75cae13c102cdac7525d359830b5e84423ae4813acf3d10","bodyHash":"f4554655c1d42978d0a066230c35548d4e9448eaf333cfcdb59871af40c98a59"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) createElidedInformationPlaceholder() *ast.TypeNode {
 * 	b.ctx.approximateLength += 3
 * 	if b.ctx.flags&nodebuilder.FlagsNoTruncation == 0 {
 * 		return b.f.NewTypeReferenceNode(b.f.NewIdentifier("..."), nil /*typeArguments* /)
 * 	}
 * 	return b.e.AddSyntheticLeadingComment(b.f.NewKeywordTypeNode(ast.KindAnyKeyword), ast.KindMultiLineCommentTrivia, "elided", false /*hasTrailingNewLine* /)
 * }
 */
export function NodeBuilderImpl_createElidedInformationPlaceholder(receiver: GoPtr<NodeBuilderImpl>): GoPtr<TypeNode> {
  receiver!.ctx!.approximateLength += 3;
  if ((receiver!.ctx!.flags & FlagsNoTruncation) === 0) {
    return NewTypeReferenceNode(receiver!.f, NewIdentifier(receiver!.f, "..."), undefined);
  }
  return EmitContext_AddSyntheticLeadingComment(receiver!.e, NewKeywordTypeNode(receiver!.f, KindAnyKeyword), KindMultiLineCommentTrivia, "elided", false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.mapToTypeNodes","kind":"method","status":"implemented","sigHash":"358c87c81519e49d1ca70ffc89d7fe092a67bf0ebb47d305a2bee61b6fe5baca","bodyHash":"2a303dc32bfb2202a13e0dd996ba99383b3d3578a1558a76b9aeb45478debdd6"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) mapToTypeNodes(list []*Type, isBareList bool) *ast.NodeList {
 * 	if len(list) == 0 {
 * 		return nil
 * 	}
 * 
 * 	if b.checkTruncationLength() {
 * 		if !isBareList {
 * 			var node *ast.Node
 * 			if b.ctx.flags&nodebuilder.FlagsNoTruncation != 0 {
 * 				node = b.e.AddSyntheticLeadingComment(b.f.NewKeywordTypeNode(ast.KindAnyKeyword), ast.KindMultiLineCommentTrivia, "elided", false /*hasTrailingNewLine* /)
 * 			} else {
 * 				node = b.f.NewTypeReferenceNode(b.f.NewIdentifier("..."), nil /*typeArguments* /)
 * 			}
 * 			return b.f.NewNodeList([]*ast.Node{node})
 * 		} else if len(list) > 2 {
 * 			nodes := []*ast.Node{
 * 				b.typeToTypeNode(list[0]),
 * 				nil,
 * 				b.typeToTypeNode(list[len(list)-1]),
 * 			}
 * 
 * 			if b.ctx.flags&nodebuilder.FlagsNoTruncation != 0 {
 * 				nodes[1] = b.e.AddSyntheticLeadingComment(b.f.NewKeywordTypeNode(ast.KindAnyKeyword), ast.KindMultiLineCommentTrivia, fmt.Sprintf("... %d more elided ...", len(list)-2), false /*hasTrailingNewLine* /)
 * 			} else {
 * 				text := fmt.Sprintf("... %d more ...", len(list)-2)
 * 				nodes[1] = b.f.NewTypeReferenceNode(b.f.NewIdentifier(text), nil /*typeArguments* /)
 * 			}
 * 			return b.f.NewNodeList(nodes)
 * 		}
 * 	}
 * 
 * 	mayHaveNameCollisions := b.ctx.flags&nodebuilder.FlagsUseFullyQualifiedType == 0
 * 	type seenName struct {
 * 		t *Type
 * 		i int
 * 	}
 * 	var seenNames *collections.MultiMap[string, seenName]
 * 	if mayHaveNameCollisions {
 * 		seenNames = &collections.MultiMap[string, seenName]{}
 * 	}
 * 
 * 	result := make([]*ast.Node, 0, len(list))
 * 
 * 	for i, t := range list {
 * 		displayIndex := i + 1
 * 		if b.checkTruncationLength() && (displayIndex+2 < len(list)-1) {
 * 			if b.ctx.flags&nodebuilder.FlagsNoTruncation != 0 {
 * 				result = append(result, b.e.AddSyntheticLeadingComment(b.f.NewKeywordTypeNode(ast.KindAnyKeyword), ast.KindMultiLineCommentTrivia, fmt.Sprintf("... %d more elided ...", len(list)-displayIndex), false /*hasTrailingNewLine* /))
 * 			} else {
 * 				text := fmt.Sprintf("... %d more ...", len(list)-displayIndex)
 * 				result = append(result, b.f.NewTypeReferenceNode(b.f.NewIdentifier(text), nil /*typeArguments* /))
 * 			}
 * 			typeNode := b.typeToTypeNode(list[len(list)-1])
 * 			if typeNode != nil {
 * 				result = append(result, typeNode)
 * 			}
 * 			break
 * 		}
 * 		b.ctx.approximateLength += 2 // Account for whitespace + separator
 * 		typeNode := b.typeToTypeNode(t)
 * 		if typeNode != nil {
 * 			result = append(result, typeNode)
 * 			if seenNames != nil && isIdentifierTypeReference(typeNode) {
 * 				seenNames.Add(typeNode.AsTypeReferenceNode().TypeName.Text(), seenName{t, len(result) - 1})
 * 			}
 * 		}
 * 	}
 * 
 * 	if seenNames != nil {
 * 		// To avoid printing types like `[Foo, Foo]` or `Bar & Bar` where
 * 		// occurrences of the same name actually come from different
 * 		// namespaces, go through the single-identifier type reference nodes
 * 		// we just generated, and see if any names were generated more than
 * 		// once while referring to different types. If so, regenerate the
 * 		// type node for each entry by that name with the
 * 		// `UseFullyQualifiedType` flag enabled.
 * 		restoreFlags := b.saveRestoreFlags()
 * 		b.ctx.flags |= nodebuilder.FlagsUseFullyQualifiedType
 * 		for types := range seenNames.Values() {
 * 			if !arrayIsHomogeneous(types, func(a, b seenName) bool {
 * 				return typesAreSameReference(a.t, b.t)
 * 			}) {
 * 				for _, seen := range types {
 * 					result[seen.i] = b.typeToTypeNode(seen.t)
 * 				}
 * 			}
 * 		}
 * 		restoreFlags()
 * 	}
 * 
 * 	return b.f.NewNodeList(result)
 * }
 */
export function NodeBuilderImpl_mapToTypeNodes(receiver: GoPtr<NodeBuilderImpl>, list: GoSlice<GoPtr<Type>>, isBareList: bool): GoPtr<NodeList> {
  if (list.length === 0) {
    return undefined;
  }
  if (NodeBuilderImpl_checkTruncationLength(receiver)) {
    if (!isBareList) {
      const node = (receiver!.ctx!.flags & FlagsNoTruncation) !== 0
        ? EmitContext_AddSyntheticLeadingComment(receiver!.e, NewKeywordTypeNode(receiver!.f, KindAnyKeyword), KindMultiLineCommentTrivia, "elided", false)
        : NewTypeReferenceNode(receiver!.f, NewIdentifier(receiver!.f, "..."), undefined);
      return NodeFactory_NewNodeList(receiver!.f, [node]);
    } else if (list.length > 2) {
      const nodes: GoSlice<GoPtr<Node>> = [
        NodeBuilderImpl_typeToTypeNode(receiver, list[0]),
        undefined,
        NodeBuilderImpl_typeToTypeNode(receiver, list[list.length - 1]),
      ];
      nodes[1] = (receiver!.ctx!.flags & FlagsNoTruncation) !== 0
        ? EmitContext_AddSyntheticLeadingComment(receiver!.e, NewKeywordTypeNode(receiver!.f, KindAnyKeyword), KindMultiLineCommentTrivia, `... ${list.length - 2} more elided ...`, false)
        : NewTypeReferenceNode(receiver!.f, NewIdentifier(receiver!.f, `... ${list.length - 2} more ...`), undefined);
      return NodeFactory_NewNodeList(receiver!.f, nodes);
    }
  }
  const mayHaveNameCollisions = (receiver!.ctx!.flags & FlagsUseFullyQualifiedType) === 0;
  const seenNames: GoPtr<MultiMap<string, { t: GoPtr<Type>; i: int }>> = mayHaveNameCollisions ? { M: new globalThis.Map() } : undefined;
  const result: GoSlice<GoPtr<Node>> = [];
  let i = 0;
  for (const t of list) {
    const displayIndex = i + 1;
    if (NodeBuilderImpl_checkTruncationLength(receiver) && (displayIndex + 2 < list.length - 1)) {
      const truncNode = (receiver!.ctx!.flags & FlagsNoTruncation) !== 0
        ? EmitContext_AddSyntheticLeadingComment(receiver!.e, NewKeywordTypeNode(receiver!.f, KindAnyKeyword), KindMultiLineCommentTrivia, `... ${list.length - displayIndex} more elided ...`, false)
        : NewTypeReferenceNode(receiver!.f, NewIdentifier(receiver!.f, `... ${list.length - displayIndex} more ...`), undefined);
      result.push(truncNode);
      const lastTypeNode = NodeBuilderImpl_typeToTypeNode(receiver, list[list.length - 1]);
      if (lastTypeNode !== undefined) {
        result.push(lastTypeNode);
      }
      break;
    }
    receiver!.ctx!.approximateLength += 2;
    const typeNode = NodeBuilderImpl_typeToTypeNode(receiver, t);
    if (typeNode !== undefined) {
      result.push(typeNode);
      if (seenNames !== undefined && isIdentifierTypeReference(typeNode)) {
        const name = AsIdentifier(AsTypeReferenceNode(typeNode)!.TypeName)!.Text;
        MultiMap_Add(seenNames, name, { t, i: result.length - 1 });
      }
    }
    i++;
  }
  if (seenNames !== undefined) {
    const restoreFlags = NodeBuilderImpl_saveRestoreFlags(receiver);
    receiver!.ctx!.flags |= FlagsUseFullyQualifiedType;
    MultiMap_Values<string, { t: GoPtr<Type>; i: int }>(seenNames)(types => {
      if (!arrayIsHomogeneous(types, (a, b) => typesAreSameReference(a.t, b.t))) {
        for (const seen of types) {
          result[seen.i] = NodeBuilderImpl_typeToTypeNode(receiver, seen.t);
        }
      }
      return true;
    });
    restoreFlags();
  }
  return NodeFactory_NewNodeList(receiver!.f, result);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.serializeTypeName","kind":"method","status":"implemented","sigHash":"ffda5b4e68918be1c7defd337b5b637c23e34aa07b489aa2fe756bf466c07758","bodyHash":"027e24b45ea94e8be78f1237519376c6e7677f5a683c3ab5afd697a014266e0d"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) serializeTypeName(node *ast.Node, isTypeOf bool, typeArguments *ast.NodeList) *ast.Node {
 * 	meaning := ast.SymbolFlagsType
 * 	if isTypeOf {
 * 		meaning = ast.SymbolFlagsValue
 * 	}
 * 	symbol := b.ch.resolveEntityName(node, meaning, true, false, node)
 * 	if symbol == nil {
 * 		return nil
 * 	}
 * 
 * 	resolvedSymbol := symbol
 * 	if symbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 		resolvedSymbol = b.ch.resolveAlias(symbol)
 * 	}
 * 
 * 	if b.ch.IsSymbolAccessible(symbol, b.ctx.enclosingDeclaration, meaning, false).Accessibility != printer.SymbolAccessibilityAccessible {
 * 		return nil
 * 	}
 * 	return b.symbolToTypeNode(resolvedSymbol, meaning, typeArguments)
 * }
 */
export function NodeBuilderImpl_serializeTypeName(receiver: GoPtr<NodeBuilderImpl>, node: GoPtr<Node>, isTypeOf: bool, typeArguments: GoPtr<NodeList>): GoPtr<Node> {
  const meaning = isTypeOf ? SymbolFlagsValue : SymbolFlagsType;
  const symbol = Checker_resolveEntityName(receiver!.ch, node, meaning, true, false, node);
  if (symbol === undefined) {
    return undefined;
  }
  const resolvedSymbol = (symbol!.Flags & SymbolFlagsAlias) !== 0 ? Checker_resolveAlias(receiver!.ch, symbol) : symbol;
  if (Checker_IsSymbolAccessible(receiver!.ch, symbol, receiver!.ctx!.enclosingDeclaration, meaning, false).Accessibility !== SymbolAccessibilityAccessible) {
    return undefined;
  }
  return NodeBuilderImpl_symbolToTypeNode(receiver, resolvedSymbol, meaning, typeArguments);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::isIdentifierTypeReference","kind":"func","status":"implemented","sigHash":"a2f65e69d0b0a322458070b55a44f7803a0d84a4eba8dabc76d253ada533c4b1","bodyHash":"5a4780de59f3ac77e78f5722362eb00c39e8964b36168a0c0e83ebd8e037391a"}
 *
 * Go source:
 * func isIdentifierTypeReference(node *ast.Node) bool {
 * 	return ast.IsTypeReferenceNode(node) && ast.IsIdentifier(node.AsTypeReferenceNode().TypeName)
 * }
 */
export function isIdentifierTypeReference(node: GoPtr<Node>): bool {
  return IsTypeReferenceNode(node) && IsIdentifier(AsTypeReferenceNode(node)!.TypeName);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::arrayIsHomogeneous","kind":"func","status":"implemented","sigHash":"a11aae40c5c6b9cb95cbbdc2423ad946c42fa4b8175e2fead3989fb1a8612eaf","bodyHash":"520510c8d0cf71fc1d13cffccecf5e6f77c4400cb232b8ee431b275bfcf75387"}
 *
 * Go source:
 * func arrayIsHomogeneous[T any](array []T, comparer func(a, B T) bool) bool {
 * 	if len(array) < 2 {
 * 		return true
 * 	}
 * 	first := array[0]
 * 	for i := 1; i < len(array); i++ {
 * 		target := array[i]
 * 		if !comparer(first, target) {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function arrayIsHomogeneous<T>(array: GoSlice<T>, comparer: (a: T, B: T) => bool): bool {
  if (array.length < 2) {
    return true;
  }
  const first = array[0]!;
  for (let i = 1; i < array.length; i++) {
    const target = array[i]!;
    if (!comparer(first, target)) {
      return false;
    }
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::typesAreSameReference","kind":"func","status":"implemented","sigHash":"e52c97749f503919b7b2dee6b953de938dbfe67c652705e938321ab437552a0e","bodyHash":"e20112d6c8ac182ddacf4ce7e1c0b9816650f626fd40aedb1b029ee964bc47d3"}
 *
 * Go source:
 * func typesAreSameReference(a, b *Type) bool {
 * 	return a == b || a.symbol != nil && a.symbol == b.symbol || a.alias != nil && a.alias == b.alias
 * }
 */
export function typesAreSameReference(a: GoPtr<Type>, b: GoPtr<Type>): bool {
  return a === b || (a!.symbol !== undefined && a!.symbol === b!.symbol) || (a!.alias !== undefined && a!.alias === b!.alias);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.setCommentRange","kind":"method","status":"implemented","sigHash":"82b3881ef4f534368d845ca54f67ff5617af78b987c9a9b4398e45c879001596","bodyHash":"04b4745496422497f682781c4d2c6213d66f6c5860c7836ef899bfa7bfe3e4ec"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) setCommentRange(node *ast.Node, range_ *ast.Node) {
 * 	if range_ != nil && b.ctx.enclosingFile != nil && b.ctx.enclosingFile == ast.GetSourceFileOfNode(range_) {
 * 		// Copy comments to node for declaration emit
 * 		b.e.AssignCommentRange(node, range_)
 * 	}
 * }
 */
export function NodeBuilderImpl_setCommentRange(receiver: GoPtr<NodeBuilderImpl>, node: GoPtr<Node>, range_: GoPtr<Node>): void {
  if (range_ !== undefined && receiver!.ctx!.enclosingFile !== undefined && receiver!.ctx!.enclosingFile === GetSourceFileOfNode(range_)) {
    EmitContext_AssignCommentRange(receiver!.e, node, range_);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.tryReuseExistingTypeNode","kind":"method","status":"implemented","sigHash":"bec5f3d0f12933fd704da0f48a8e64b5ae5eff7000ba54e7143a88797bcd12f7","bodyHash":"e3f784ef0fce391771b04e3e550933148ee70b5e7481e9076577acb7de365cfd"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) tryReuseExistingTypeNode(typeNode *ast.TypeNode, t *Type, host *ast.Node, addUndefined bool) *ast.TypeNode {
 * 	originalType := t
 * 	if addUndefined {
 * 		t = b.ch.getOptionalType(t, !ast.IsParameterDeclaration(host))
 * 	}
 * 	clone := b.tryReuseExistingNonParameterTypeNode(typeNode, t, host, nil)
 * 	if clone != nil {
 * 		// explicitly add `| undefined` if it's missing from the input type nodes and the type contains `undefined` (and not the missing type)
 * 		if addUndefined && containsNonMissingUndefinedType(b.ch, t) && !someType(b.getTypeFromTypeNode(typeNode, false), func(t *Type) bool {
 * 			return t.flags&TypeFlagsUndefined != 0
 * 		}) {
 * 			return b.f.NewUnionTypeNode(b.f.NewNodeList([]*ast.TypeNode{clone, b.f.NewKeywordTypeNode(ast.KindUndefinedKeyword)}))
 * 		}
 * 		return clone
 * 	}
 * 	if addUndefined && originalType != t {
 * 		cloneMissingUndefined := b.tryReuseExistingNonParameterTypeNode(typeNode, originalType, host, nil)
 * 		if cloneMissingUndefined != nil {
 * 			return b.f.NewUnionTypeNode(b.f.NewNodeList([]*ast.TypeNode{cloneMissingUndefined, b.f.NewKeywordTypeNode(ast.KindUndefinedKeyword)}))
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function NodeBuilderImpl_tryReuseExistingTypeNode(receiver: GoPtr<NodeBuilderImpl>, typeNode: GoPtr<TypeNode>, t: GoPtr<Type>, host: GoPtr<Node>, addUndefined: bool): GoPtr<TypeNode> {
  const originalType = t;
  const effectiveT = addUndefined ? Checker_getOptionalType(receiver!.ch, t, !IsParameterDeclaration(host)) : t;
  const clone = NodeBuilderImpl_tryReuseExistingNonParameterTypeNode(receiver, typeNode, effectiveT, host, undefined);
  if (clone !== undefined) {
    if (addUndefined && containsNonMissingUndefinedType(receiver!.ch, effectiveT) && !someType(NodeBuilderImpl_getTypeFromTypeNode(receiver, typeNode, false), (inner) => (inner!.flags & TypeFlagsUndefined) !== 0)) {
      return NewUnionTypeNode(receiver!.f, NodeFactory_NewNodeList(receiver!.f, [clone, NewKeywordTypeNode(receiver!.f, KindUndefinedKeyword)]));
    }
    return clone;
  }
  if (addUndefined && originalType !== effectiveT) {
    const cloneMissingUndefined = NodeBuilderImpl_tryReuseExistingNonParameterTypeNode(receiver, typeNode, originalType, host, undefined);
    if (cloneMissingUndefined !== undefined) {
      return NewUnionTypeNode(receiver!.f, NodeFactory_NewNodeList(receiver!.f, [cloneMissingUndefined, NewKeywordTypeNode(receiver!.f, KindUndefinedKeyword)]));
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.typeNodeIsEquivalentToType","kind":"method","status":"implemented","sigHash":"0d5c1b02a402d48a8c358c2531b80e9fe47fdbea6b298db625cbdfcca893ecd2","bodyHash":"a39e12b3178ad6bc67a8f4577b90013f191df57fb67fff35b53bd252a867f8ab"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) typeNodeIsEquivalentToType(annotatedDeclaration *ast.Node, t *Type, typeFromTypeNode *Type) bool {
 * 	if typeFromTypeNode == t {
 * 		return true
 * 	}
 * 	if annotatedDeclaration == nil {
 * 		return false
 * 	}
 * 	// !!!
 * 	// used to be hasEffectiveQuestionToken for JSDoc
 * 	if isOptionalDeclaration(annotatedDeclaration) {
 * 		return b.ch.getTypeWithFacts(t, TypeFactsNEUndefined) == typeFromTypeNode
 * 	}
 * 	return false
 * }
 */
export function NodeBuilderImpl_typeNodeIsEquivalentToType(receiver: GoPtr<NodeBuilderImpl>, annotatedDeclaration: GoPtr<Node>, t: GoPtr<Type>, typeFromTypeNode: GoPtr<Type>): bool {
  if (typeFromTypeNode === t) {
    return true;
  }
  if (annotatedDeclaration === undefined) {
    return false;
  }
  if (isOptionalDeclaration(annotatedDeclaration)) {
    return Checker_getTypeWithFacts(receiver!.ch, t, TypeFactsNEUndefined) === typeFromTypeNode;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.existingTypeNodeIsNotReferenceOrIsReferenceWithCompatibleTypeArgumentCount","kind":"method","status":"implemented","sigHash":"f9b4e03cc8196cd733c5d8568b0783ba753c2a35c53b34bea3e08350144ebdab","bodyHash":"7b62e24434cfceaf234d6cbefa6e3113a23008f5fa46ae211858c037eb1685ec"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) existingTypeNodeIsNotReferenceOrIsReferenceWithCompatibleTypeArgumentCount(existing *ast.TypeNode, t *Type) bool {
 * 	// In JS, you can say something like `Foo` and get a `Foo<any>` implicitly - we don't want to preserve that original `Foo` in these cases, though.
 * 	if t.objectFlags&ObjectFlagsReference == 0 {
 * 		return true
 * 	}
 * 	if !ast.IsTypeReferenceNode(existing) {
 * 		return true
 * 	}
 * 	// `type` is a reference type, and `existing` is a type reference node, but we still need to make sure they refer to the _same_ target type
 * 	// before we go comparing their type argument counts.
 * 	b.ch.getTypeFromTypeReference(existing)
 * 	// call to ensure symbol is resolved
 * 	links := b.ch.symbolNodeLinks.TryGet(existing)
 * 	if links == nil {
 * 		return true
 * 	}
 * 	symbol := links.resolvedSymbol
 * 	if symbol == nil {
 * 		return true
 * 	}
 * 	existingTarget := b.ch.getDeclaredTypeOfSymbol(symbol)
 * 	if existingTarget == nil || existingTarget != t.AsTypeReference().target {
 * 		return true
 * 	}
 * 	return len(existing.TypeArguments()) >= b.ch.getMinTypeArgumentCount(t.AsTypeReference().target.AsInterfaceType().TypeParameters())
 * }
 */
export function NodeBuilderImpl_existingTypeNodeIsNotReferenceOrIsReferenceWithCompatibleTypeArgumentCount(receiver: GoPtr<NodeBuilderImpl>, existing: GoPtr<TypeNode>, t: GoPtr<Type>): bool {
  if ((t!.objectFlags & ObjectFlagsReference) === 0) {
    return true;
  }
  if (!IsTypeReferenceNode(existing)) {
    return true;
  }
  Checker_getTypeFromTypeReference(receiver!.ch, existing);
  const links = LinkStore_TryGet<GoPtr<Node>, SymbolNodeLinks>(receiver!.ch!.symbolNodeLinks as unknown as LinkStore<GoPtr<Node>, SymbolNodeLinks>, existing);
  if (links === undefined) {
    return true;
  }
  const symbol = links!.resolvedSymbol;
  if (symbol === undefined) {
    return true;
  }
  const existingTarget = Checker_getDeclaredTypeOfSymbol(receiver!.ch, symbol);
  if (existingTarget === undefined || existingTarget !== Type_AsObjectType(t)!.target) {
    return true;
  }
  const typeArgs = Node_TypeArguments(existing);
  return (typeArgs !== undefined ? typeArgs.length : 0) >= Checker_getMinTypeArgumentCount(receiver!.ch, InterfaceType_TypeParameters(Type_AsInterfaceType(Type_AsObjectType(t)!.target)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.tryReuseExistingNonParameterTypeNode","kind":"method","status":"implemented","sigHash":"57a8620fdc7b9187bce0c8e3064f8da98436d896dbafae744344a9cbb53f793a","bodyHash":"df0d4822129492849fffe0d515cc11a6fcc6acb13ed744d828643a6f960f44c4"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) tryReuseExistingNonParameterTypeNode(existing *ast.TypeNode, t *Type, host *ast.Node, annotationType *Type) *ast.TypeNode {
 * 	if host == nil {
 * 		host = b.ctx.enclosingDeclaration
 * 	}
 * 	if annotationType == nil {
 * 		annotationType = b.getTypeFromTypeNode(existing, true)
 * 	}
 * 	if annotationType != nil && b.typeNodeIsEquivalentToType(host, t, annotationType) && b.existingTypeNodeIsNotReferenceOrIsReferenceWithCompatibleTypeArgumentCount(existing, t) {
 * 		result := b.tryReuseExistingNodeHelper(existing)
 * 		if result != nil {
 * 			return result
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function NodeBuilderImpl_tryReuseExistingNonParameterTypeNode(receiver: GoPtr<NodeBuilderImpl>, existing: GoPtr<TypeNode>, t: GoPtr<Type>, host: GoPtr<Node>, annotationType: GoPtr<Type>): GoPtr<TypeNode> {
  const effectiveHost = host !== undefined ? host : receiver!.ctx!.enclosingDeclaration;
  const effectiveAnnotationType = annotationType !== undefined ? annotationType : NodeBuilderImpl_getTypeFromTypeNode(receiver, existing, true);
  if (effectiveAnnotationType !== undefined && NodeBuilderImpl_typeNodeIsEquivalentToType(receiver, effectiveHost, t, effectiveAnnotationType) && NodeBuilderImpl_existingTypeNodeIsNotReferenceOrIsReferenceWithCompatibleTypeArgumentCount(receiver, existing, t)) {
    const result = NodeBuilderImpl_tryReuseExistingNodeHelper(receiver, existing);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.getResolvedTypeWithoutAbstractConstructSignatures","kind":"method","status":"implemented","sigHash":"7de1d71a82a74bfcc62ae4f50da10d102531fc68cb0b9ba34d99a0ab1e70e445","bodyHash":"3fa71c683bdb4075a1650a8904ef88cb3fef9b635d716ad3a485efe648d0ab1d"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) getResolvedTypeWithoutAbstractConstructSignatures(t *StructuredType) *Type {
 * 	if len(t.ConstructSignatures()) == 0 {
 * 		return t.AsType()
 * 	}
 * 	if t.objectTypeWithoutAbstractConstructSignatures != nil {
 * 		return t.objectTypeWithoutAbstractConstructSignatures
 * 	}
 * 	constructSignatures := core.Filter(t.ConstructSignatures(), func(signature *Signature) bool {
 * 		return signature.flags&SignatureFlagsAbstract == 0
 * 	})
 * 	if len(constructSignatures) == len(t.ConstructSignatures()) {
 * 		t.objectTypeWithoutAbstractConstructSignatures = t.AsType()
 * 		return t.AsType()
 * 	}
 * 	typeCopy := b.ch.newAnonymousType(t.symbol, t.members, t.CallSignatures(), core.IfElse(len(constructSignatures) > 0, constructSignatures, []*Signature{}), t.indexInfos)
 * 	t.objectTypeWithoutAbstractConstructSignatures = typeCopy
 * 	typeCopy.AsStructuredType().objectTypeWithoutAbstractConstructSignatures = typeCopy
 * 	return typeCopy
 * }
 */
export function NodeBuilderImpl_getResolvedTypeWithoutAbstractConstructSignatures(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<StructuredType>): GoPtr<Type> {
  const asType = (t as unknown as TypeData).AsType();
  if (StructuredType_ConstructSignatures(t).length === 0) {
    return asType;
  }
  if (t!.objectTypeWithoutAbstractConstructSignatures !== undefined) {
    return t!.objectTypeWithoutAbstractConstructSignatures;
  }
  const constructSignatures = Filter(StructuredType_ConstructSignatures(t), (sig) => (sig!.flags & SignatureFlagsAbstract) === 0);
  if (constructSignatures.length === StructuredType_ConstructSignatures(t).length) {
    t!.objectTypeWithoutAbstractConstructSignatures = asType;
    return asType;
  }
  const typeCopy = Checker_newAnonymousType(receiver!.ch, asType!.symbol, t!.members, StructuredType_CallSignatures(t), constructSignatures.length > 0 ? constructSignatures : [], t!.indexInfos);
  t!.objectTypeWithoutAbstractConstructSignatures = typeCopy;
  Type_AsStructuredType(typeCopy)!.objectTypeWithoutAbstractConstructSignatures = typeCopy;
  return typeCopy;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.symbolToNode","kind":"method","status":"implemented","sigHash":"e8c28ee5a103857e639bb584c3f5141b4b18adf39c1afe0849ded5b97004d8b1","bodyHash":"d905c0a8c750ae1d1078b319f25fb38487b3f086da422f791e06babda7297761"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) symbolToNode(symbol *ast.Symbol, meaning ast.SymbolFlags) *ast.Node {
 * 	if b.ctx.internalFlags&nodebuilder.InternalFlagsWriteComputedProps != 0 {
 * 		if symbol.ValueDeclaration != nil {
 * 			name := ast.GetNameOfDeclaration(symbol.ValueDeclaration)
 * 			if name != nil && ast.IsComputedPropertyName(name) {
 * 				return name
 * 			}
 * 		}
 * 		if b.ch.valueSymbolLinks.Has(symbol) {
 * 			nameType := b.ch.valueSymbolLinks.Get(symbol).nameType
 * 			if nameType != nil && nameType.flags&(TypeFlagsEnumLiteral|TypeFlagsUniqueESSymbol) != 0 {
 * 				oldEnclosing := b.ctx.enclosingDeclaration
 * 				b.ctx.enclosingDeclaration = nameType.symbol.ValueDeclaration
 * 				result := b.f.NewComputedPropertyName(b.symbolToExpression(nameType.symbol, meaning))
 * 				b.ctx.enclosingDeclaration = oldEnclosing
 * 				return result
 * 			}
 * 		}
 * 	}
 * 	return b.symbolToExpression(symbol, meaning)
 * }
 */
export function NodeBuilderImpl_symbolToNode(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>, meaning: SymbolFlags): GoPtr<Node> {
  if ((receiver!.ctx!.internalFlags & InternalFlagsWriteComputedProps) !== 0) {
    if (symbol_!.ValueDeclaration !== undefined) {
      const name = GetNameOfDeclaration(symbol_!.ValueDeclaration);
      if (name !== undefined) {
        // IsComputedPropertyName - check Kind
        if (name!.Kind === /* KindComputedPropertyName */ 166) {
          return name;
        }
      }
    }
    if (LinkStore_Has(receiver!.ch!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, symbol_)) {
      const nameType = LinkStore_Get<GoPtr<Symbol>, ValueSymbolLinks>(receiver!.ch!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, symbol_)!.nameType;
      if (nameType !== undefined && (nameType!.flags & (TypeFlagsEnumLiteral | TypeFlagsUniqueESSymbol)) !== 0) {
        const oldEnclosing = receiver!.ctx!.enclosingDeclaration;
        receiver!.ctx!.enclosingDeclaration = nameType!.symbol!.ValueDeclaration;
        const result = NewComputedPropertyName(receiver!.f, NodeBuilderImpl_symbolToExpression(receiver, nameType!.symbol, meaning));
        receiver!.ctx!.enclosingDeclaration = oldEnclosing;
        return result;
      }
    }
  }
  return NodeBuilderImpl_symbolToExpression(receiver, symbol_, meaning);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.symbolToName","kind":"method","status":"implemented","sigHash":"79308c1ef5b3d92c193bd39a060d11cd5eda143593fd7be71294142383b4e473","bodyHash":"a0ab08cbc5bdb6d1a42de5ff2b20308f21b22c2d0516f27a4bc939fa96ecaa63"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) symbolToName(symbol *ast.Symbol, meaning ast.SymbolFlags, expectsIdentifier bool) *ast.Node {
 * 	chain := b.lookupSymbolChain(symbol, meaning, false)
 * 	if expectsIdentifier && len(chain) != 1 && !b.ctx.encounteredError && (b.ctx.flags&nodebuilder.FlagsAllowQualifiedNameInPlaceOfIdentifier != 0) {
 * 		b.ctx.encounteredError = true
 * 	}
 * 	return b.createEntityNameFromSymbolChain(chain, len(chain)-1)
 * }
 */
export function NodeBuilderImpl_symbolToName(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>, meaning: SymbolFlags, expectsIdentifier: bool): GoPtr<Node> {
  const chain = NodeBuilderImpl_lookupSymbolChain(receiver, symbol_, meaning, false as bool);
  if (expectsIdentifier && chain.length !== 1 && !receiver!.ctx!.encounteredError && (receiver!.ctx!.flags & FlagsAllowQualifiedNameInPlaceOfIdentifier) !== 0) {
    receiver!.ctx!.encounteredError = true;
  }
  return NodeBuilderImpl_createEntityNameFromSymbolChain(receiver, chain, chain.length - 1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.createEntityNameFromSymbolChain","kind":"method","status":"implemented","sigHash":"8bd983db204b7e2b2a2fb5effd5c251d9720e23e6aec363410e3a5889f1c976a","bodyHash":"932358061d3c13ad9aeed7e87a6b400b74051e6e809e17a473ad4e2d5f644957"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) createEntityNameFromSymbolChain(chain []*ast.Symbol, index int) *ast.Node {
 * 	// typeParameterNodes := b.lookupTypeParameterNodes(chain, index)
 * 	symbol := chain[index]
 * 
 * 	if index == 0 {
 * 		b.ctx.flags |= nodebuilder.FlagsInInitialEntityName
 * 	}
 * 	symbolName := b.getNameOfSymbolAsWritten(symbol)
 * 	if index == 0 {
 * 		b.ctx.flags ^= nodebuilder.FlagsInInitialEntityName
 * 	}
 * 
 * 	identifier := b.newIdentifier(symbolName, symbol)
 * 	b.e.AddEmitFlags(identifier, printer.EFNoAsciiEscaping)
 * 	// !!! TODO: smuggle type arguments out
 * 	// if (typeParameterNodes) setIdentifierTypeArguments(identifier, factory.createNodeArray<TypeNode | TypeParameterDeclaration>(typeParameterNodes));
 * 	// identifier.symbol = symbol;
 * 	// expression = identifier;
 * 	if index > 0 {
 * 		return b.f.NewQualifiedName(
 * 			b.createEntityNameFromSymbolChain(chain, index-1),
 * 			identifier,
 * 		)
 * 	}
 * 	return identifier
 * }
 */
export function NodeBuilderImpl_createEntityNameFromSymbolChain(receiver: GoPtr<NodeBuilderImpl>, chain: GoSlice<GoPtr<Symbol>>, index: int): GoPtr<Node> {
  const symbol_ = chain[index];
  if (index === 0) {
    receiver!.ctx!.flags |= FlagsInInitialEntityName;
  }
  const symbolName = NodeBuilderImpl_getNameOfSymbolAsWritten(receiver, symbol_);
  if (index === 0) {
    receiver!.ctx!.flags ^= FlagsInInitialEntityName;
  }
  const identifier = NodeBuilderImpl_newIdentifier(receiver, symbolName, symbol_);
  EmitContext_AddEmitFlags(receiver!.e, identifier, EFNoAsciiEscaping);
  if (index > 0) {
    return NewQualifiedName(
      receiver!.f,
      NodeBuilderImpl_createEntityNameFromSymbolChain(receiver, chain, index - 1) as GoPtr<EntityName>,
      identifier as GoPtr<IdentifierNode>,
    );
  }
  return identifier;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.symbolToEntityNameNode","kind":"method","status":"implemented","sigHash":"b0e89f24334e9b1be3b3c09514b8097f18834944e599447d32d782e32e375e3b","bodyHash":"b73d192a5f462c339d7e5df3f6630ad478bb72e853386577036ff72a8588ede2"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) symbolToEntityNameNode(symbol *ast.Symbol) *ast.EntityName {
 * 	identifier := b.newIdentifier(symbol.Name, symbol)
 * 	if symbol.Parent != nil {
 * 		return b.f.NewQualifiedName(b.symbolToEntityNameNode(symbol.Parent), identifier)
 * 	}
 * 	return identifier
 * }
 */
export function NodeBuilderImpl_symbolToEntityNameNode(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>): GoPtr<EntityName> {
  const identifier = NodeBuilderImpl_newIdentifier(receiver, symbol_!.Name, symbol_);
  if (symbol_!.Parent !== undefined) {
    return NewQualifiedName(receiver!.f, NodeBuilderImpl_symbolToEntityNameNode(receiver, symbol_!.Parent), identifier);
  }
  return identifier;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.symbolToTypeNode","kind":"method","status":"implemented","sigHash":"c21625fc3a6804c965beee6c5d6c9002f03250f9faf0ea108dd8e0bfef15d3bb","bodyHash":"5b5deb3ff1ae1b14d3368ed96f3a6d17f1cb6e3f0e21901a88bc1e39b1c4981e"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) symbolToTypeNode(symbol *ast.Symbol, mask ast.SymbolFlags, typeArguments *ast.NodeList) *ast.TypeNode {
 * 	chain := b.lookupSymbolChain(symbol, mask, (b.ctx.flags&nodebuilder.FlagsUseAliasDefinedOutsideCurrentScope == 0)) // If we're using aliases outside the current scope, dont bother with the module
 * 	if len(chain) == 0 {
 * 		return nil // TODO: shouldn't be possible, `lookupSymbolChain` should always at least return the input symbol and issue an error
 * 	}
 * 	isTypeOf := mask == ast.SymbolFlagsValue
 * 	if core.Some(chain[0].Declarations, hasNonGlobalAugmentationExternalModuleSymbol) {
 * 		// module is root, must use `ImportTypeNode`
 * 		var nonRootParts *ast.Node
 * 		if len(chain) > 1 {
 * 			nonRootParts = b.createAccessFromSymbolChain(chain, len(chain)-1, 1, typeArguments)
 * 		}
 * 		typeParameterNodes := typeArguments
 * 		if typeParameterNodes == nil {
 * 			typeParameterNodes = b.lookupTypeParameterNodes(chain, 0)
 * 		}
 * 		contextFile := ast.GetSourceFileOfNode(b.e.MostOriginal(b.ctx.enclosingDeclaration)) // TODO: Just use b.ctx.enclosingFile ? Or is the delayed lookup important for context moves?
 * 		targetFile := ast.GetSourceFileOfModule(chain[0])
 * 		var specifier string
 * 		var attributes *ast.Node
 * 		if b.ch.compilerOptions.GetModuleResolutionKind() == core.ModuleResolutionKindNode16 || b.ch.compilerOptions.GetModuleResolutionKind() == core.ModuleResolutionKindNodeNext {
 * 			// An `import` type directed at an esm format file is only going to resolve in esm mode - set the esm mode assertion
 * 			if targetFile != nil && contextFile != nil && b.ch.program.GetEmitModuleFormatOfFile(targetFile) == core.ModuleKindESNext && b.ch.program.GetEmitModuleFormatOfFile(targetFile) != b.ch.program.GetEmitModuleFormatOfFile(contextFile) {
 * 				specifier = b.getSpecifierForModuleSymbol(chain[0], core.ModuleKindESNext)
 * 				attributes = b.f.NewImportAttributes(
 * 					ast.KindWithKeyword,
 * 					b.f.NewNodeList([]*ast.Node{b.f.NewImportAttribute(b.newStringLiteral("resolution-mode"), b.newStringLiteral("import"))}),
 * 					false,
 * 				)
 * 			}
 * 		}
 * 		if len(specifier) == 0 {
 * 			specifier = b.getSpecifierForModuleSymbol(chain[0], core.ResolutionModeNone)
 * 		}
 * 		if (b.ctx.flags&nodebuilder.FlagsAllowNodeModulesRelativePaths == 0) /* && b.ch.compilerOptions.GetModuleResolutionKind() != core.ModuleResolutionKindClassic * / && strings.Contains(specifier, "/node_modules/") {
 * 			oldSpecifier := specifier
 * 
 * 			if b.ch.compilerOptions.GetModuleResolutionKind() == core.ModuleResolutionKindNode16 || b.ch.compilerOptions.GetModuleResolutionKind() == core.ModuleResolutionKindNodeNext {
 * 				// We might be able to write a portable import type using a mode override; try specifier generation again, but with a different mode set
 * 				swappedMode := core.ModuleKindESNext
 * 				if b.ch.program.GetEmitModuleFormatOfFile(contextFile) == core.ModuleKindESNext {
 * 					swappedMode = core.ModuleKindCommonJS
 * 				}
 * 				specifier = b.getSpecifierForModuleSymbol(chain[0], swappedMode)
 * 
 * 				if strings.Contains(specifier, "/node_modules/") {
 * 					// Still unreachable :(
 * 					specifier = oldSpecifier
 * 				} else {
 * 					modeStr := "require"
 * 					if swappedMode == core.ModuleKindESNext {
 * 						modeStr = "import"
 * 					}
 * 					attributes = b.f.NewImportAttributes(
 * 						ast.KindWithKeyword,
 * 						b.f.NewNodeList([]*ast.Node{b.f.NewImportAttribute(b.newStringLiteral("resolution-mode"), b.newStringLiteral(modeStr))}),
 * 						false,
 * 					)
 * 				}
 * 			}
 * 
 * 			if attributes == nil {
 * 				// If ultimately we can only name the symbol with a reference that dives into a `node_modules` folder, we should error
 * 				// since declaration files with these kinds of references are liable to fail when published :(
 * 				b.ctx.encounteredError = true
 * 				b.ctx.tracker.ReportLikelyUnsafeImportRequiredError(oldSpecifier, symbol.Name)
 * 			}
 * 		}
 * 
 * 		lit := b.f.NewLiteralTypeNode(b.newStringLiteral(specifier))
 * 		b.ctx.approximateLength += len(specifier) + 10 // specifier + import("")
 * 		if nonRootParts == nil || ast.IsEntityName(nonRootParts) {
 * 			if nonRootParts != nil {
 * 				// !!! TODO: smuggle type arguments out
 * 				// const lastId = isIdentifier(nonRootParts) ? nonRootParts : nonRootParts.right;
 * 				// setIdentifierTypeArguments(lastId, /*typeArguments* / undefined);
 * 			}
 * 			return b.f.NewImportTypeNode(isTypeOf, lit, attributes, nonRootParts, typeParameterNodes)
 * 		}
 * 
 * 		splitNode := getTopmostIndexedAccessType(nonRootParts.AsIndexedAccessTypeNode())
 * 		qualifier := splitNode.ObjectType.AsTypeReferenceNode().TypeName
 * 		return b.f.NewIndexedAccessTypeNode(
 * 			b.f.NewImportTypeNode(isTypeOf, lit, attributes, qualifier, typeParameterNodes),
 * 			splitNode.IndexType,
 * 		)
 * 
 * 	}
 * 
 * 	entityName := b.createAccessFromSymbolChain(chain, len(chain)-1, 0, typeArguments)
 * 	if ast.IsIndexedAccessTypeNode(entityName) {
 * 		return entityName // Indexed accesses can never be `typeof`
 * 	}
 * 	if ast.IsEntityName(entityName) {
 * 		if isTypeOf {
 * 			return b.f.NewTypeQueryNode(entityName, nil)
 * 		}
 * 		return b.f.NewTypeReferenceNode(entityName, typeArguments)
 * 	}
 * 	if isTypeOf && ast.IsExpressionWithTypeArguments(entityName) {
 * 		expr := entityName.AsExpressionWithTypeArguments()
 * 		return b.f.NewTypeQueryNode(b.f.DeepCloneNode(expr.Expression), expr.TypeArguments)
 * 	}
 * 	return entityName
 * }
 */
export function NodeBuilderImpl_symbolToTypeNode(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>, mask: SymbolFlags, typeArguments: GoPtr<NodeList>): GoPtr<TypeNode> {
  const chain = NodeBuilderImpl_lookupSymbolChain(receiver, symbol_, mask, (receiver!.ctx!.flags & FlagsUseAliasDefinedOutsideCurrentScope) === 0);
  if (chain.length === 0) {
    return undefined;
  }
  const isTypeOf = mask === SymbolFlagsValue;
  if (Some(chain[0]!.Declarations, hasNonGlobalAugmentationExternalModuleSymbol)) {
    const nonRootParts = chain.length > 1
      ? NodeBuilderImpl_createAccessFromSymbolChain(receiver, chain, chain.length - 1, 1, typeArguments)
      : undefined;
    let typeParameterNodes = typeArguments;
    if (typeParameterNodes === undefined) {
      typeParameterNodes = NodeBuilderImpl_lookupTypeParameterNodes(receiver, chain, 0);
    }
    const contextOriginal = receiver!.ctx!.enclosingDeclaration !== undefined ? EmitContext_MostOriginal(receiver!.e, receiver!.ctx!.enclosingDeclaration) : undefined;
    const contextFile = contextOriginal !== undefined ? GetSourceFileOfNode(contextOriginal) : undefined;
    const targetFile = GetSourceFileOfModule(chain[0]);
    let specifier = "";
    let attributes: GoPtr<Node>;
    const moduleResolutionKind = CompilerOptions_GetModuleResolutionKind(receiver!.ch!.compilerOptions);
    if (moduleResolutionKind === ModuleResolutionKindNode16 || moduleResolutionKind === ModuleResolutionKindNodeNext) {
      if (targetFile !== undefined && contextFile !== undefined) {
        const targetHasFileName = NewHasFileName(SourceFile_FileName(targetFile), SourceFile_Path(targetFile));
        const contextHasFileName = NewHasFileName(SourceFile_FileName(contextFile), SourceFile_Path(contextFile));
        if (receiver!.ch!.program.GetEmitModuleFormatOfFile(targetHasFileName) === ModuleKindESNext &&
          receiver!.ch!.program.GetEmitModuleFormatOfFile(targetHasFileName) !== receiver!.ch!.program.GetEmitModuleFormatOfFile(contextHasFileName)) {
          specifier = NodeBuilderImpl_getSpecifierForModuleSymbol(receiver, chain[0], ResolutionModeESM);
          attributes = NewImportAttributes(
            receiver!.f,
            KindWithKeyword,
            NodeFactory_NewNodeList(receiver!.f, [NewImportAttribute(receiver!.f, NodeBuilderImpl_newStringLiteral(receiver, "resolution-mode") as never, NodeBuilderImpl_newStringLiteral(receiver, "import") as GoPtr<Expression>)]),
            false as bool,
          );
        }
      }
    }
    if (specifier.length === 0) {
      specifier = NodeBuilderImpl_getSpecifierForModuleSymbol(receiver, chain[0], ResolutionModeNone);
    }
    if ((receiver!.ctx!.flags & FlagsAllowNodeModulesRelativePaths) === 0 && specifier.includes("/node_modules/")) {
      const oldSpecifier = specifier;
      if (moduleResolutionKind === ModuleResolutionKindNode16 || moduleResolutionKind === ModuleResolutionKindNodeNext) {
        let swappedMode = ResolutionModeESM;
        if (contextFile !== undefined) {
          const contextHasFileName = NewHasFileName(SourceFile_FileName(contextFile), SourceFile_Path(contextFile));
          if (receiver!.ch!.program.GetEmitModuleFormatOfFile(contextHasFileName) === ModuleKindESNext) {
            swappedMode = ModuleKindCommonJS as ResolutionMode;
          }
        }
        specifier = NodeBuilderImpl_getSpecifierForModuleSymbol(receiver, chain[0], swappedMode);
        if (specifier.includes("/node_modules/")) {
          specifier = oldSpecifier;
        } else {
          const modeStr = swappedMode === ResolutionModeESM ? "import" : "require";
          attributes = NewImportAttributes(
            receiver!.f,
            KindWithKeyword,
            NodeFactory_NewNodeList(receiver!.f, [NewImportAttribute(receiver!.f, NodeBuilderImpl_newStringLiteral(receiver, "resolution-mode") as never, NodeBuilderImpl_newStringLiteral(receiver, modeStr) as GoPtr<Expression>)]),
            false as bool,
          );
        }
      }
      if (attributes === undefined) {
        receiver!.ctx!.encounteredError = true;
        receiver!.ctx!.tracker!.ReportLikelyUnsafeImportRequiredError(oldSpecifier, symbol_!.Name);
      }
    }
    const lit = NewLiteralTypeNode(receiver!.f, NodeBuilderImpl_newStringLiteral(receiver, specifier)) as GoPtr<TypeNode>;
    receiver!.ctx!.approximateLength += specifier.length + 10;
    if (nonRootParts === undefined || IsEntityName(nonRootParts)) {
      return NewImportTypeNode(receiver!.f, isTypeOf, lit, attributes as never, nonRootParts as GoPtr<EntityName>, typeParameterNodes) as GoPtr<TypeNode>;
    }
    const splitNode = getTopmostIndexedAccessType(AsIndexedAccessTypeNode(nonRootParts));
    const qualifier = AsTypeReferenceNode(splitNode!.ObjectType)!.TypeName;
    return NewIndexedAccessTypeNode(
      receiver!.f,
      NewImportTypeNode(receiver!.f, isTypeOf, lit, attributes as never, qualifier, typeParameterNodes) as GoPtr<TypeNode>,
      splitNode!.IndexType,
    ) as GoPtr<TypeNode>;
  }
  const entityName = NodeBuilderImpl_createAccessFromSymbolChain(receiver, chain, chain.length - 1, 0, typeArguments);
  if (IsIndexedAccessTypeNode(entityName)) {
    return entityName as GoPtr<TypeNode>;
  }
  if (IsEntityName(entityName)) {
    if (isTypeOf) {
      return NewTypeQueryNode(receiver!.f, entityName as GoPtr<EntityName>, undefined) as GoPtr<TypeNode>;
    }
    return NewTypeReferenceNode(receiver!.f, entityName as GoPtr<EntityName>, typeArguments) as GoPtr<TypeNode>;
  }
  if (isTypeOf && IsExpressionWithTypeArguments(entityName)) {
    const expr = AsExpressionWithTypeArguments(entityName);
    return NewTypeQueryNode(receiver!.f, NodeFactory_DeepCloneNode(receiver!.f, expr!.Expression) as GoPtr<EntityName>, expr!.TypeArguments) as GoPtr<TypeNode>;
  }
  return entityName as GoPtr<TypeNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::getTopmostIndexedAccessType","kind":"func","status":"implemented","sigHash":"bfcd15e2c77e0584ab5dc35a375e0317a3e1cd8bb94c5cc614ad71b316292594","bodyHash":"63d8dbbf07752d75a7c1c777d3ac5e72d4ab3a3872bd6a46504d5502e8b724c1"}
 *
 * Go source:
 * func getTopmostIndexedAccessType(node *ast.IndexedAccessTypeNode) *ast.IndexedAccessTypeNode {
 * 	if ast.IsIndexedAccessTypeNode(node.ObjectType) {
 * 		return getTopmostIndexedAccessType(node.ObjectType.AsIndexedAccessTypeNode())
 * 	}
 * 	return node
 * }
 */
export function getTopmostIndexedAccessType(node: GoPtr<IndexedAccessTypeNode>): GoPtr<IndexedAccessTypeNode> {
  if (IsIndexedAccessTypeNode(node!.ObjectType)) {
    return getTopmostIndexedAccessType(AsIndexedAccessTypeNode(node!.ObjectType));
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.createAccessFromSymbolChain","kind":"method","status":"implemented","sigHash":"4112f0cbecbc6a1843bde1e5106e189cbc9f161a7842c053858ed8fe80490fd1","bodyHash":"5d6a8411c057018b052a641ca20c63898a0371df3756c6775d087dd227724ec7"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) createAccessFromSymbolChain(chain []*ast.Symbol, index int, stopper int, overrideTypeArguments *ast.NodeList) *ast.Node {
 * 	typeParameterNodes := overrideTypeArguments
 * 	if index != (len(chain) - 1) {
 * 		typeParameterNodes = b.lookupTypeParameterNodes(chain, index)
 * 	}
 * 	symbol := chain[index]
 * 	var parent *ast.Symbol
 * 	if index > 0 {
 * 		parent = chain[index-1]
 * 	}
 * 
 * 	var symbolName string
 * 	if index == 0 {
 * 		b.ctx.flags |= nodebuilder.FlagsInInitialEntityName
 * 		symbolName = b.getNameOfSymbolAsWritten(symbol)
 * 		b.ctx.approximateLength += len(symbolName) + 1
 * 		b.ctx.flags ^= nodebuilder.FlagsInInitialEntityName
 * 	} else {
 * 		// lookup a ref to symbol within parent to handle export aliases
 * 		if parent != nil {
 * 			exports := b.ch.getExportsOfSymbol(parent)
 * 			if exports != nil {
 * 				// avoid exhaustive iteration in the common case
 * 				res, ok := exports[symbol.Name]
 * 				if symbol.Name != ast.InternalSymbolNameExportEquals && !isLateBoundName(symbol.Name) && ok && res != nil && b.ch.getSymbolIfSameReference(res, symbol) != nil {
 * 					symbolName = symbol.Name
 * 				} else {
 * 					results := make(map[*ast.Symbol]string, 1)
 * 					for name, ex := range exports {
 * 						if b.ch.getSymbolIfSameReference(ex, symbol) != nil && !isLateBoundName(name) && name != ast.InternalSymbolNameExportEquals {
 * 							results[ex] = name
 * 							// break // must collect all results and sort them - exports are randomly iterated
 * 						}
 * 					}
 * 					resultSymbols := slices.Collect(maps.Keys(results))
 * 					if len(resultSymbols) > 0 {
 * 						b.ch.sortSymbols(resultSymbols)
 * 						symbolName = results[resultSymbols[0]]
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 
 * 	if len(symbolName) == 0 {
 * 		var name *ast.Node
 * 		for _, d := range symbol.Declarations {
 * 			name = ast.GetNameOfDeclaration(d)
 * 			if name != nil {
 * 				break
 * 			}
 * 		}
 * 		if name != nil && ast.IsComputedPropertyName(name) && ast.IsEntityName(name.Expression()) {
 * 			lhs := b.createAccessFromSymbolChain(chain, index-1, stopper, overrideTypeArguments)
 * 			if ast.IsEntityName(lhs) {
 * 				return b.f.NewIndexedAccessTypeNode(
 * 					b.f.NewParenthesizedTypeNode(b.f.NewTypeQueryNode(lhs, nil)),
 * 					b.f.NewTypeQueryNode(name.Expression(), nil),
 * 				)
 * 			}
 * 			return lhs
 * 		}
 * 		symbolName = b.getNameOfSymbolAsWritten(symbol)
 * 	}
 * 	b.ctx.approximateLength += len(symbolName) + 1
 * 
 * 	if (b.ctx.flags&nodebuilder.FlagsForbidIndexedAccessSymbolReferences == 0) && parent != nil &&
 * 		b.ch.getMembersOfSymbol(parent) != nil && b.ch.getMembersOfSymbol(parent)[symbol.Name] != nil &&
 * 		b.ch.getSymbolIfSameReference(b.ch.getMembersOfSymbol(parent)[symbol.Name], symbol) != nil {
 * 		// Should use an indexed access
 * 		lhs := b.createAccessFromSymbolChain(chain, index-1, stopper, overrideTypeArguments)
 * 		if ast.IsIndexedAccessTypeNode(lhs) {
 * 			return b.f.NewIndexedAccessTypeNode(
 * 				lhs,
 * 				b.f.NewLiteralTypeNode(b.newStringLiteral(symbolName)),
 * 			)
 * 		}
 * 		return b.f.NewIndexedAccessTypeNode(
 * 			b.f.NewTypeReferenceNode(lhs, typeParameterNodes),
 * 			b.f.NewLiteralTypeNode(b.newStringLiteral(symbolName)),
 * 		)
 * 	}
 * 
 * 	identifier := b.newIdentifier(symbolName, symbol)
 * 	b.e.AddEmitFlags(identifier, printer.EFNoAsciiEscaping)
 * 
 * 	if index > stopper {
 * 		lhs := b.createAccessFromSymbolChain(chain, index-1, stopper, overrideTypeArguments)
 * 		if b.ctx.flags&nodebuilder.FlagsUseInstantiationExpressions == 0 || ast.IsEntityName(lhs) && (typeParameterNodes == nil || len(typeParameterNodes.Nodes) == 0) {
 * 			return b.f.NewQualifiedName(lhs, identifier)
 * 		}
 * 		return b.createExpressionWithTypeArguments(b.f.NewPropertyAccessExpression(b.createAccessExpression(lhs), nil, identifier, ast.NodeFlagsNone), typeParameterNodes)
 * 	}
 * 	return identifier
 * }
 */
export function NodeBuilderImpl_createAccessFromSymbolChain(receiver: GoPtr<NodeBuilderImpl>, chain: GoSlice<GoPtr<Symbol>>, index: int, stopper: int, overrideTypeArguments: GoPtr<NodeList>): GoPtr<Node> {
  let typeParameterNodes = overrideTypeArguments;
  if (index !== chain.length - 1) {
    typeParameterNodes = NodeBuilderImpl_lookupTypeParameterNodes(receiver, chain, index);
  }
  const symbol_ = chain[index];
  const parent = index > 0 ? chain[index - 1] : undefined;
  let symbolName = "";
  if (index === 0) {
    receiver!.ctx!.flags |= FlagsInInitialEntityName;
    symbolName = NodeBuilderImpl_getNameOfSymbolAsWritten(receiver, symbol_);
    receiver!.ctx!.approximateLength += symbolName.length + 1;
    receiver!.ctx!.flags ^= FlagsInInitialEntityName;
  } else if (parent !== undefined) {
    const exports = Checker_getExportsOfSymbol(receiver!.ch, parent);
    if (exports !== undefined) {
      const res = exports.get(symbol_!.Name);
      if (symbol_!.Name !== InternalSymbolNameExportEquals && !isLateBoundName(symbol_!.Name) && res !== undefined && Checker_getSymbolIfSameReference(receiver!.ch, res, symbol_) !== undefined) {
        symbolName = symbol_!.Name;
      } else {
        const results = new globalThis.Map<GoPtr<Symbol>, string>();
        for (const [name, ex] of exports) {
          if (Checker_getSymbolIfSameReference(receiver!.ch, ex, symbol_) !== undefined && !isLateBoundName(name) && name !== InternalSymbolNameExportEquals) {
            results.set(ex, name);
          }
        }
        const resultSymbols = [...results.keys()];
        if (resultSymbols.length > 0) {
          resultSymbols.sort((left, right) => receiver!.ch!.compareSymbols(left, right));
          symbolName = results.get(resultSymbols[0]) ?? "";
        }
      }
    }
  }
  if (symbolName.length === 0) {
    let name: GoPtr<Node>;
    for (const declaration of symbol_!.Declarations ?? []) {
      name = GetNameOfDeclaration(declaration);
      if (name !== undefined) {
        break;
      }
    }
    if (name !== undefined && IsComputedPropertyName(name) && IsEntityName(Node_Expression(name))) {
      const lhs = NodeBuilderImpl_createAccessFromSymbolChain(receiver, chain, index - 1, stopper, overrideTypeArguments);
      if (IsEntityName(lhs)) {
        return NewIndexedAccessTypeNode(
          receiver!.f,
          NewParenthesizedTypeNode(receiver!.f, NewTypeQueryNode(receiver!.f, lhs as GoPtr<EntityName>, undefined) as GoPtr<TypeNode>) as GoPtr<TypeNode>,
          NewTypeQueryNode(receiver!.f, Node_Expression(name) as GoPtr<EntityName>, undefined) as GoPtr<TypeNode>,
        );
      }
      return lhs;
    }
    symbolName = NodeBuilderImpl_getNameOfSymbolAsWritten(receiver, symbol_);
  }
  receiver!.ctx!.approximateLength += symbolName.length + 1;
  if ((receiver!.ctx!.flags & FlagsForbidIndexedAccessSymbolReferences) === 0 && parent !== undefined) {
    const members = Checker_getMembersOfSymbol(receiver!.ch, parent);
    const member = members?.get(symbol_!.Name);
    if (member !== undefined && Checker_getSymbolIfSameReference(receiver!.ch, member, symbol_) !== undefined) {
      const lhs = NodeBuilderImpl_createAccessFromSymbolChain(receiver, chain, index - 1, stopper, overrideTypeArguments);
      if (IsIndexedAccessTypeNode(lhs)) {
        return NewIndexedAccessTypeNode(
          receiver!.f,
          lhs as GoPtr<TypeNode>,
          NewLiteralTypeNode(receiver!.f, NodeBuilderImpl_newStringLiteral(receiver, symbolName)) as GoPtr<TypeNode>,
        );
      }
      return NewIndexedAccessTypeNode(
        receiver!.f,
        NewTypeReferenceNode(receiver!.f, lhs as GoPtr<EntityName>, typeParameterNodes) as GoPtr<TypeNode>,
        NewLiteralTypeNode(receiver!.f, NodeBuilderImpl_newStringLiteral(receiver, symbolName)) as GoPtr<TypeNode>,
      );
    }
  }
  const identifier = NodeBuilderImpl_newIdentifier(receiver, symbolName, symbol_);
  EmitContext_AddEmitFlags(receiver!.e, identifier, EFNoAsciiEscaping);
  if (index > stopper) {
    const lhs = NodeBuilderImpl_createAccessFromSymbolChain(receiver, chain, index - 1, stopper, overrideTypeArguments);
    if ((receiver!.ctx!.flags & FlagsUseInstantiationExpressions) === 0 || (IsEntityName(lhs) && (typeParameterNodes === undefined || typeParameterNodes.Nodes.length === 0))) {
      return NewQualifiedName(receiver!.f, lhs as GoPtr<EntityName>, identifier as GoPtr<IdentifierNode>);
    }
    return NodeBuilderImpl_createExpressionWithTypeArguments(
      receiver,
      NewPropertyAccessExpression(receiver!.f, NodeBuilderImpl_createAccessExpression(receiver, lhs), undefined, identifier as GoPtr<IdentifierNode>, NodeFlagsNone) as GoPtr<Expression>,
      typeParameterNodes,
    );
  }
  return identifier;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.symbolToExpression","kind":"method","status":"implemented","sigHash":"62305332463d07161741fd232c58600d5f74df4d437df824152e409b64ba1f4e","bodyHash":"aff67439b9b4b909060ddce66d84bb1426006648a2861c4a314c011248307c1b"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) symbolToExpression(symbol *ast.Symbol, mask ast.SymbolFlags) *ast.Expression {
 * 	chain := b.lookupSymbolChain(symbol, mask, false)
 * 	return b.createExpressionFromSymbolChain(chain, len(chain)-1)
 * }
 */
export function NodeBuilderImpl_symbolToExpression(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>, mask: SymbolFlags): GoPtr<Expression> {
  const chain = NodeBuilderImpl_lookupSymbolChain(receiver, symbol_, mask, false as bool);
  return NodeBuilderImpl_createExpressionFromSymbolChain(receiver, chain, chain.length - 1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.createExpressionFromSymbolChain","kind":"method","status":"implemented","sigHash":"bacc30233525b8b3ed9f17630c0849144c8418f0e75e11d834771d90ecd0be94","bodyHash":"01b94e64e1f30c98aa5d8ddebc0b79af1da8568a5c9f33b76fe7e3d4f34d9538"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) createExpressionFromSymbolChain(chain []*ast.Symbol, index int) *ast.Expression {
 * 	typeParameterNodes := b.lookupExpressionChainTypeArgumentNodes(chain, index)
 * 	symbol := chain[index]
 * 
 * 	if index == 0 {
 * 		b.ctx.flags |= nodebuilder.FlagsInInitialEntityName
 * 	}
 * 	symbolName := b.getNameOfSymbolAsWritten(symbol)
 * 	if index == 0 {
 * 		b.ctx.flags ^= nodebuilder.FlagsInInitialEntityName
 * 	}
 * 
 * 	if startsWithSingleOrDoubleQuote(symbolName) && core.Some(symbol.Declarations, hasNonGlobalAugmentationExternalModuleSymbol) {
 * 		specifier := b.getSpecifierForModuleSymbol(symbol, core.ResolutionModeNone)
 * 		b.ctx.approximateLength += 2 + len(specifier)
 * 		return b.newStringLiteral(specifier)
 * 	}
 * 
 * 	if index == 0 || canUsePropertyAccess(symbolName) {
 * 		identifier := b.newIdentifier(symbolName, symbol)
 * 		b.e.AddEmitFlags(identifier, printer.EFNoAsciiEscaping)
 * 		b.ctx.approximateLength += 1 + len(symbolName)
 * 		if index > 0 {
 * 			result := b.f.NewPropertyAccessExpression(b.createExpressionFromSymbolChain(chain, index-1), nil, identifier, ast.NodeFlagsNone)
 * 			b.e.AddEmitFlags(result, printer.EFNoIndentation)
 * 			return b.createExpressionWithTypeArguments(result, typeParameterNodes)
 * 		}
 * 		return b.createExpressionWithTypeArguments(identifier, typeParameterNodes)
 * 	}
 * 
 * 	if startsWithSquareBracket(symbolName) {
 * 		symbolName = symbolName[1 : len(symbolName)-1]
 * 	}
 * 
 * 	var expression *ast.Expression
 * 	if startsWithSingleOrDoubleQuote(symbolName) && symbol.Flags&ast.SymbolFlagsEnumMember == 0 {
 * 		literalText := stringutil.UnquoteString(symbolName)
 * 		b.ctx.approximateLength += len(literalText) + 2
 * 		expression = b.newStringLiteralEx(literalText, symbolName[0] == '\'')
 * 	} else if jsnum.FromString(symbolName).String() == symbolName {
 * 		// TODO: the follwing in strada would assert if the number is negative, but no such assertion exists here
 * 		// Moreover, what's even guaranteeing the name *isn't* -1 here anyway? Needs double-checking.
 * 		b.ctx.approximateLength += len(symbolName)
 * 		expression = b.f.NewNumericLiteral(symbolName, ast.TokenFlagsNone)
 * 	}
 * 	if expression == nil {
 * 		b.ctx.approximateLength += len(symbolName)
 * 		expression = b.newIdentifier(symbolName, symbol)
 * 		b.e.AddEmitFlags(expression, printer.EFNoAsciiEscaping)
 * 	}
 * 	b.ctx.approximateLength += 2 // []
 * 	return b.createExpressionWithTypeArguments(b.f.NewElementAccessExpression(b.createExpressionFromSymbolChain(chain, index-1), nil, expression, ast.NodeFlagsNone), typeParameterNodes)
 * }
 */
export function NodeBuilderImpl_createExpressionFromSymbolChain(receiver: GoPtr<NodeBuilderImpl>, chain: GoSlice<GoPtr<Symbol>>, index: int): GoPtr<Expression> {
  const typeParameterNodes = NodeBuilderImpl_lookupExpressionChainTypeArgumentNodes(receiver, chain, index);
  const symbol_ = chain[index];
  if (index === 0) {
    receiver!.ctx!.flags |= FlagsInInitialEntityName;
  }
  let symbolName = NodeBuilderImpl_getNameOfSymbolAsWritten(receiver, symbol_);
  if (index === 0) {
    receiver!.ctx!.flags ^= FlagsInInitialEntityName;
  }
  if (startsWithSingleOrDoubleQuote(symbolName) && Some(symbol_!.Declarations, hasNonGlobalAugmentationExternalModuleSymbol)) {
    const specifier = NodeBuilderImpl_getSpecifierForModuleSymbol(receiver, symbol_, ResolutionModeNone);
    receiver!.ctx!.approximateLength += 2 + specifier.length;
    return NodeBuilderImpl_newStringLiteral(receiver, specifier) as GoPtr<Expression>;
  }
  if (index === 0 || canUsePropertyAccess(symbolName)) {
    const identifier = NodeBuilderImpl_newIdentifier(receiver, symbolName, symbol_);
    EmitContext_AddEmitFlags(receiver!.e, identifier, EFNoAsciiEscaping);
    receiver!.ctx!.approximateLength += 1 + symbolName.length;
    if (index > 0) {
      const result = NewPropertyAccessExpression(
        receiver!.f,
        NodeBuilderImpl_createExpressionFromSymbolChain(receiver, chain, index - 1),
        undefined,
        identifier as GoPtr<IdentifierNode>,
        NodeFlagsNone,
      );
      EmitContext_AddEmitFlags(receiver!.e, result, EFNoIndentation);
      return NodeBuilderImpl_createExpressionWithTypeArguments(receiver, result as GoPtr<Expression>, typeParameterNodes);
    }
    return NodeBuilderImpl_createExpressionWithTypeArguments(receiver, identifier as GoPtr<Expression>, typeParameterNodes);
  }
  if (startsWithSquareBracket(symbolName)) {
    symbolName = symbolName.slice(1, -1);
  }
  let expression: GoPtr<Expression>;
  if (startsWithSingleOrDoubleQuote(symbolName) && (symbol_!.Flags & SymbolFlagsEnumMember) === 0) {
    const literalText = UnquoteString(symbolName);
    receiver!.ctx!.approximateLength += literalText.length + 2;
    expression = NodeBuilderImpl_newStringLiteralEx(receiver, literalText, symbolName[0] === "'") as GoPtr<Expression>;
  } else if (String(FromString(symbolName)) === symbolName) {
    receiver!.ctx!.approximateLength += symbolName.length;
    expression = NewNumericLiteral(receiver!.f, symbolName, TokenFlagsNone) as GoPtr<Expression>;
  }
  if (expression === undefined) {
    receiver!.ctx!.approximateLength += symbolName.length;
    expression = NodeBuilderImpl_newIdentifier(receiver, symbolName, symbol_) as GoPtr<Expression>;
    EmitContext_AddEmitFlags(receiver!.e, expression, EFNoAsciiEscaping);
  }
  receiver!.ctx!.approximateLength += 2;
  return NodeBuilderImpl_createExpressionWithTypeArguments(
    receiver,
    NewElementAccessExpression(receiver!.f, NodeBuilderImpl_createExpressionFromSymbolChain(receiver, chain, index - 1), undefined, expression, NodeFlagsNone) as GoPtr<Expression>,
    typeParameterNodes,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::canUsePropertyAccess","kind":"func","status":"implemented","sigHash":"5cb881dd575af251eab2c7e4c2de75d62f3eed9f9c45288a175147d5ddf18668","bodyHash":"3d6676806db693aa1647699c8419870800f60669592c6a381a6170a913fbee5f"}
 *
 * Go source:
 * func canUsePropertyAccess(name string) bool {
 * 	if len(name) == 0 {
 * 		return false
 * 	}
 * 	// TODO: in strada, this only used `isIdentifierStart` on the first character, while this checks the whole string for validity
 * 	// - possible strada bug?
 * 	if strings.HasPrefix(name, "#") {
 * 		return len(name) > 1 && scanner.IsIdentifierText(name[1:], core.LanguageVariantStandard)
 * 	}
 * 	return scanner.IsIdentifierText(name, core.LanguageVariantStandard)
 * }
 */
export function canUsePropertyAccess(name: string): bool {
  if (name.length === 0) {
    return false;
  }
  // TODO: in strada, this only used `isIdentifierStart` on the first character, while this checks the whole string for validity
  // - possible strada bug?
  if (name.startsWith("#")) {
    return name.length > 1 && IsIdentifierText(name.substring(1), LanguageVariantStandard);
  }
  return IsIdentifierText(name, LanguageVariantStandard);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::startsWithSingleOrDoubleQuote","kind":"func","status":"implemented","sigHash":"66b412595e874a3d865e1e98eaab15ccdc366583c6855f7621c5619266825806","bodyHash":"bc96ae359ad1ef6dd351d4a759eb2132d6c3144b1f23f9826e72b613a581524b"}
 *
 * Go source:
 * func startsWithSingleOrDoubleQuote(str string) bool {
 * 	return strings.HasPrefix(str, "'") || strings.HasPrefix(str, "\"")
 * }
 */
export function startsWithSingleOrDoubleQuote(str: string): bool {
  return str.startsWith("'") || str.startsWith("\"");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::startsWithSquareBracket","kind":"func","status":"implemented","sigHash":"38f9d1769051057e9246a4afff7b6acabb826cbb92028bd7e5dd59fb5df07bb4","bodyHash":"fec179170c8885d78162da6db9fdc9fb29ffa8544de9ff663bee988fe0cf8970"}
 *
 * Go source:
 * func startsWithSquareBracket(str string) bool {
 * 	return strings.HasPrefix(str, "[")
 * }
 */
export function startsWithSquareBracket(str: string): bool {
  return str.startsWith("[");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::isDefaultBindingContext","kind":"func","status":"implemented","sigHash":"8895e674d9bd03ed313023629224ca36a6007442cf5f1a78df8a0708362ae294","bodyHash":"3f6ce9f0855e0e3483d5a49a0ea7dd0c7a6fcc743f08c2105d48b70b58532eb4"}
 *
 * Go source:
 * func isDefaultBindingContext(location *ast.Node) bool {
 * 	return location.Kind == ast.KindSourceFile || ast.IsAmbientModule(location)
 * }
 */
export function isDefaultBindingContext(location: GoPtr<Node>): bool {
  return (location!.Kind === KindSourceFile || IsAmbientModule(location)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.getNameOfSymbolFromNameType","kind":"method","status":"implemented","sigHash":"e3e8d859afa2fd5f2ec277c6f5773520d37a8d5bbce57599b606e58ec54e2b6d","bodyHash":"ebcc1fd7688e55c965909867fb1b5d38da94393cef53ca36e99c93c5765b342f"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) getNameOfSymbolFromNameType(symbol *ast.Symbol) string {
 * 	if b.ch.valueSymbolLinks.Has(symbol) {
 * 		nameType := b.ch.valueSymbolLinks.Get(symbol).nameType
 * 		if nameType == nil {
 * 			return ""
 * 		}
 * 		if nameType.flags&TypeFlagsStringOrNumberLiteral != 0 {
 * 			var name string
 * 			switch v := nameType.AsLiteralType().value.(type) {
 * 			case string:
 * 				name = v
 * 			case jsnum.Number:
 * 				name = v.String()
 * 			}
 * 			if !scanner.IsIdentifierText(name, core.LanguageVariantStandard) && !isNumericLiteralName(name) {
 * 				return b.ch.valueToString(nameType.AsLiteralType().value)
 * 			}
 * 			if isNumericLiteralName(name) && strings.HasPrefix(name, "-") {
 * 				return fmt.Sprintf("[%s]", name)
 * 			}
 * 			return name
 * 		}
 * 		if nameType.flags&TypeFlagsUniqueESSymbol != 0 {
 * 			text := b.getNameOfSymbolAsWritten(nameType.AsUniqueESSymbolType().symbol)
 * 			return fmt.Sprintf("[%s]", text)
 * 		}
 * 	}
 * 	return ""
 * }
 */
export function NodeBuilderImpl_getNameOfSymbolFromNameType(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>): string {
  if (LinkStore_Has(receiver!.ch!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, symbol_)) {
    const nameType = LinkStore_Get<GoPtr<Symbol>, ValueSymbolLinks>(receiver!.ch!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, symbol_)!.nameType;
    if (nameType === undefined) {
      return "";
    }
    if ((nameType!.flags & TypeFlagsStringOrNumberLiteral) !== 0) {
      const litValue = Type_AsLiteralType(nameType)!.value;
      const name: string = (typeof litValue === "number" || (litValue !== null && typeof litValue === "object")) ? String(litValue) : litValue as string;
      if (!IsIdentifierText(name, LanguageVariantStandard) && !isNumericLiteralName(name)) {
        return Checker_valueToString(receiver!.ch, litValue);
      }
      if (isNumericLiteralName(name) && name.startsWith("-")) {
        return `[${name}]`;
      }
      return name;
    }
    if ((nameType!.flags & TypeFlagsUniqueESSymbol) !== 0) {
      const text = NodeBuilderImpl_getNameOfSymbolAsWritten(receiver, nameType!.symbol);
      return `[${text}]`;
    }
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.getNameOfSymbolAsWritten","kind":"method","status":"implemented","sigHash":"f532bf3f87088e5350a915a95176711d748f624233950ea75cb94bb2f4c13bc6","bodyHash":"28d04ee53f45e4d2290715f25d2f0e389dcfa6ec230221e110342989c01e1c59"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) getNameOfSymbolAsWritten(symbol *ast.Symbol) string {
 * 	result, ok := b.ctx.remappedSymbolReferences[ast.GetSymbolId(symbol)]
 * 	if ok {
 * 		symbol = result
 * 	}
 * 	if symbol.Name == ast.InternalSymbolNameDefault && (b.ctx.flags&nodebuilder.FlagsUseAliasDefinedOutsideCurrentScope == 0) &&
 * 		// If it's not the first part of an entity name, it must print as `default`
 * 		((b.ctx.flags&nodebuilder.FlagsInInitialEntityName == 0) ||
 * 			// if the symbol is synthesized, it will only be referenced externally it must print as `default`
 * 			len(symbol.Declarations) == 0 ||
 * 			// if not in the same binding context (source file, module declaration), it must print as `default`
 * 			(b.ctx.enclosingDeclaration != nil && ast.FindAncestor(symbol.Declarations[0], isDefaultBindingContext) != ast.FindAncestor(b.ctx.enclosingDeclaration, isDefaultBindingContext))) {
 * 		return "default"
 * 	}
 * 	if len(symbol.Declarations) > 0 {
 * 		name := core.FirstNonNil(symbol.Declarations, ast.GetNameOfDeclaration) // Try using a declaration with a name, first
 * 		if name != nil {
 * 			// !!! TODO: JS Object.defineProperty declarations
 * 			// if ast.IsCallExpression(declaration) && ast.IsBindableObjectDefinePropertyCall(declaration) {
 * 			// 	return symbol.Name
 * 			// }
 * 			if ast.IsComputedPropertyName(name) && symbol.CheckFlags&ast.CheckFlagsLate == 0 {
 * 				if b.ch.valueSymbolLinks.Has(symbol) && b.ch.valueSymbolLinks.Get(symbol).nameType != nil && b.ch.valueSymbolLinks.Get(symbol).nameType.flags&TypeFlagsStringOrNumberLiteral != 0 {
 * 					result := b.getNameOfSymbolFromNameType(symbol)
 * 					if len(result) > 0 {
 * 						return result
 * 					}
 * 				}
 * 			}
 * 			return scanner.DeclarationNameToString(name)
 * 		}
 * 		declaration := symbol.Declarations[0] // Declaration may be nameless, but we'll try anyway
 * 		if declaration.Parent != nil && declaration.Parent.Kind == ast.KindVariableDeclaration {
 * 			return scanner.DeclarationNameToString(declaration.Parent.AsVariableDeclaration().Name())
 * 		}
 * 		if ast.IsClassExpression(declaration) || ast.IsFunctionExpression(declaration) || ast.IsArrowFunction(declaration) {
 * 			if b.ctx != nil && !b.ctx.encounteredError && b.ctx.flags&nodebuilder.FlagsAllowAnonymousIdentifier == 0 {
 * 				b.ctx.encounteredError = true
 * 			}
 * 			switch declaration.Kind {
 * 			case ast.KindClassExpression:
 * 				return "(Anonymous class)"
 * 			case ast.KindFunctionExpression, ast.KindArrowFunction:
 * 				return "(Anonymous function)"
 * 			}
 * 		}
 * 	}
 * 	name := b.getNameOfSymbolFromNameType(symbol)
 * 	if len(name) > 0 {
 * 		return name
 * 	}
 * 	if symbol.Name == ast.InternalSymbolNameMissing {
 * 		return "__missing"
 * 	}
 * 	return symbol.Name
 * }
 */
export function NodeBuilderImpl_getNameOfSymbolAsWritten(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>): string {
  const remapped = receiver!.ctx!.remappedSymbolReferences.get(GetSymbolId(symbol_));
  const sym = remapped !== undefined ? remapped : symbol_;
  if (sym!.Name === InternalSymbolNameDefault && (receiver!.ctx!.flags & FlagsUseAliasDefinedOutsideCurrentScope) === 0 &&
    ((receiver!.ctx!.flags & FlagsInInitialEntityName) === 0 ||
      sym!.Declarations === undefined || sym!.Declarations.length === 0 ||
      (receiver!.ctx!.enclosingDeclaration !== undefined && FindAncestor(sym!.Declarations[0], isDefaultBindingContext) !== FindAncestor(receiver!.ctx!.enclosingDeclaration, isDefaultBindingContext)))) {
    return "default";
  }
  if (sym!.Declarations !== undefined && sym!.Declarations.length > 0) {
    const name = FirstNonNil(sym!.Declarations, GetNameOfDeclaration);
    if (name !== undefined) {
      if (IsComputedPropertyName(name) && (sym!.CheckFlags & CheckFlagsLate) === 0) {
        if (LinkStore_Has(receiver!.ch!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, sym) && LinkStore_Get<GoPtr<Symbol>, ValueSymbolLinks>(receiver!.ch!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, sym)!.nameType !== undefined && (LinkStore_Get<GoPtr<Symbol>, ValueSymbolLinks>(receiver!.ch!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, sym)!.nameType!.flags & TypeFlagsStringOrNumberLiteral) !== 0) {
          const result = NodeBuilderImpl_getNameOfSymbolFromNameType(receiver, sym);
          if (result.length > 0) {
            return result;
          }
        }
      }
      return DeclarationNameToString(name);
    }
    const declaration = sym!.Declarations[0];
    if (declaration !== undefined && declaration!.Parent !== undefined && declaration!.Parent!.Kind === KindVariableDeclaration) {
      return DeclarationNameToString(AsVariableDeclaration(declaration!.Parent)!.name);
    }
    if (declaration!.Kind === KindClassExpression || declaration!.Kind === KindFunctionExpression || declaration!.Kind === KindArrowFunction) {
      if (receiver!.ctx !== undefined && !receiver!.ctx!.encounteredError && (receiver!.ctx!.flags & FlagsAllowAnonymousIdentifier) === 0) {
        receiver!.ctx!.encounteredError = true;
      }
      switch (declaration!.Kind) {
        case KindClassExpression:
          return "(Anonymous class)";
        case KindFunctionExpression:
        case KindArrowFunction:
          return "(Anonymous function)";
      }
    }
  }
  const finalName = NodeBuilderImpl_getNameOfSymbolFromNameType(receiver, sym);
  if (finalName.length > 0) {
    return finalName;
  }
  if (sym!.Name === InternalSymbolNameMissing) {
    return "__missing";
  }
  return sym!.Name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.getTypeParametersOfClassOrInterface","kind":"method","status":"implemented","sigHash":"6fc405c2580689c47ebd25306783f2e88493d066237d327745bc348a60359105","bodyHash":"8b22edc4c8cabc6b8eeec9e52e1bec7895ce33f0680ec15b3220b39a60e9b7d4"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) getTypeParametersOfClassOrInterface(symbol *ast.Symbol) []*Type {
 * 	result := make([]*Type, 0)
 * 	result = append(result, b.ch.getOuterTypeParametersOfClassOrInterface(symbol)...)
 * 	result = append(result, b.ch.getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(symbol)...)
 * 	return result
 * }
 */
export function NodeBuilderImpl_getTypeParametersOfClassOrInterface(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Type>> {
  const outer = Checker_getOuterTypeParametersOfClassOrInterface(receiver!.ch, symbol_);
  const local = Checker_getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(receiver!.ch, symbol_);
  return [...(outer ?? []), ...(local ?? [])];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.lookupTypeParameterNodes","kind":"method","status":"implemented","sigHash":"bf8682000405da9e9fc02f2f43d209116ca30a312154a84dd2a46af956b346b3","bodyHash":"11d75d3ec1f18d6221620e0448f8d737f23a46a6c18d4d04557999ac08667394"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) lookupTypeParameterNodes(chain []*ast.Symbol, index int) *ast.TypeParameterList {
 * 	debug.Assert(chain != nil && 0 <= index && index < len(chain))
 * 	symbol := chain[index]
 * 	symbolId := ast.GetSymbolId(symbol)
 * 	if b.ctx.typeParameterSymbolList.Has(symbolId) {
 * 		return nil
 * 	}
 * 	b.ctx.typeParameterSymbolList.Add(symbolId)
 *
 * 	if b.ctx.flags&nodebuilder.FlagsWriteTypeParametersInQualifiedName != 0 && index < (len(chain)-1) {
 * 		if typeArgumentNodes := b.lookupInstantiatedTypeArgumentNodes(chain, index); typeArgumentNodes != nil {
 * 			return typeArgumentNodes
 * 		} else {
 * 			typeParameterNodes := b.typeParametersToTypeParameterDeclarations(symbol)
 * 			if len(typeParameterNodes) > 0 {
 * 				return b.f.NewNodeList(typeParameterNodes)
 * 			}
 * 			return nil
 * 		}
 * 	}
 *
 * 	return nil
 * }
 */
export function NodeBuilderImpl_lookupTypeParameterNodes(receiver: GoPtr<NodeBuilderImpl>, chain: GoSlice<GoPtr<Symbol>>, index: int): GoPtr<TypeParameterList> {
  const symbol_ = chain[index];
  const symbolId = GetSymbolId(symbol_);
  if (CopyOnWriteSet_Has(receiver!.ctx!.typeParameterSymbolList, symbolId)) {
    return undefined;
  }
  CopyOnWriteSet_Add(receiver!.ctx!.typeParameterSymbolList, symbolId);
  if ((receiver!.ctx!.flags & FlagsWriteTypeParametersInQualifiedName) !== 0 && index < chain.length - 1) {
    const typeArgumentNodes = NodeBuilderImpl_lookupInstantiatedTypeArgumentNodes(receiver, chain, index);
    if (typeArgumentNodes !== undefined) {
      return typeArgumentNodes;
    } else {
      const typeParameterNodes = NodeBuilderImpl_typeParametersToTypeParameterDeclarations(receiver, symbol_);
      if (typeParameterNodes !== undefined && typeParameterNodes.length > 0) {
        return NodeFactory_NewNodeList(receiver!.f, typeParameterNodes);
      }
      return undefined;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.lookupSymbolChain","kind":"method","status":"implemented","sigHash":"223e0d35f846e5b39fbb24f2059005977ad67bb55eeb5fc38b58fed9973e99a4","bodyHash":"28032af6d9fd7d015aa8ddd687ba29f93c3ab0a8f569020a1d15807111a95589"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) lookupSymbolChain(symbol *ast.Symbol, meaning ast.SymbolFlags, yieldModuleSymbol bool) []*ast.Symbol {
 * 	b.ctx.tracker.TrackSymbol(symbol, b.ctx.enclosingDeclaration, meaning)
 * 	return b.lookupSymbolChainWorker(symbol, meaning, yieldModuleSymbol)
 * }
 */
export function NodeBuilderImpl_lookupSymbolChain(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>, meaning: SymbolFlags, yieldModuleSymbol: bool): GoSlice<GoPtr<Symbol>> {
  receiver!.ctx!.tracker!.TrackSymbol(symbol_, receiver!.ctx!.enclosingDeclaration, meaning);
  return NodeBuilderImpl_lookupSymbolChainWorker(receiver, symbol_, meaning, yieldModuleSymbol);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.lookupSymbolChainWorker","kind":"method","status":"implemented","sigHash":"ecc421eaa1f76ac67ffc17743b5e6fbb27714477ae0ad745869bb2cb8a099685","bodyHash":"96059245cbe51fa9c51ebb9bca1d8e3f3f951a146dfa28138edd46b75687b5f1"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) lookupSymbolChainWorker(symbol *ast.Symbol, meaning ast.SymbolFlags, yieldModuleSymbol bool) []*ast.Symbol {
 * 	// Try to get qualified name if the symbol is not a type parameter and there is an enclosing declaration.
 * 	var chain []*ast.Symbol
 * 	isTypeParameter := symbol.Flags&ast.SymbolFlagsTypeParameter != 0
 * 	if !isTypeParameter && (b.ctx.enclosingDeclaration != nil || b.ctx.flags&nodebuilder.FlagsUseFullyQualifiedType != 0) && (b.ctx.internalFlags&nodebuilder.InternalFlagsDoNotIncludeSymbolChain == 0) {
 * 		res := b.getSymbolChain(symbol, meaning /*endOfChain* /, true, yieldModuleSymbol)
 * 		chain = res
 * 		debug.Assert(chain != nil)
 * 		debug.Assert(len(chain) > 0)
 * 	} else {
 * 		chain = append(chain, symbol)
 * 	}
 * 	return chain
 * }
 */
export function NodeBuilderImpl_lookupSymbolChainWorker(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>, meaning: SymbolFlags, yieldModuleSymbol: bool): GoSlice<GoPtr<Symbol>> {
  // Try to get qualified name if the symbol is not a type parameter and there is an enclosing declaration.
  const isTypeParameter = (symbol_!.Flags & SymbolFlagsTypeParameter) !== 0;
  if (!isTypeParameter && (receiver!.ctx!.enclosingDeclaration !== undefined || (receiver!.ctx!.flags & FlagsUseFullyQualifiedType) !== 0) && (receiver!.ctx!.internalFlags & InternalFlagsDoNotIncludeSymbolChain) === 0) {
    const res = NodeBuilderImpl_getSymbolChain(receiver, symbol_, meaning, true as bool, yieldModuleSymbol);
    const chain = res;
    // debug.Assert(chain != nil)
    // debug.Assert(len(chain) > 0)
    return chain;
  } else {
    return [symbol_];
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::type::sortedSymbolNamePair","kind":"type","status":"implemented","sigHash":"b488449cfcaff7a9e12c3c0f88a5b4e2d464f084e157bcac95174f87ebd6a3fe","bodyHash":"902dd026cca0845456bdf159bb11e3a633e106474df8f8268e53a717a33fcd41"}
 *
 * Go source:
 * sortedSymbolNamePair struct {
 * 	sym  *ast.Symbol
 * 	name string
 * }
 */
export interface sortedSymbolNamePair {
  sym: GoPtr<Symbol>;
  name: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.getSymbolChain","kind":"method","status":"implemented","sigHash":"95c2381cf0fa370cbae4f6b83fb4528768f1397c984e547741e2849e16169874","bodyHash":"e76c57692c9d4e015c39a1fa2234c9c3e6c7b44c5dff745ec1a14cc5d8e29374"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) getSymbolChain(symbol *ast.Symbol, meaning ast.SymbolFlags, endOfChain bool, yieldModuleSymbol bool) []*ast.Symbol {
 * 	accessibleSymbolChain := b.ch.getAccessibleSymbolChain(symbol, b.ctx.enclosingDeclaration, meaning, b.ctx.flags&nodebuilder.FlagsUseOnlyExternalAliasing != 0)
 * 	qualifierMeaning := meaning
 * 	if len(accessibleSymbolChain) > 1 {
 * 		qualifierMeaning = getQualifiedLeftMeaning(meaning)
 * 	}
 * 	if len(accessibleSymbolChain) == 0 ||
 * 		b.ch.needsQualification(accessibleSymbolChain[0], b.ctx.enclosingDeclaration, qualifierMeaning) {
 * 		// Go up and add our parent.
 * 		root := symbol
 * 		if len(accessibleSymbolChain) > 0 {
 * 			root = accessibleSymbolChain[0]
 * 		}
 * 		parents := b.ch.getContainersOfSymbol(root, b.ctx.enclosingDeclaration, meaning)
 * 		if len(parents) > 0 {
 * 			parentSpecifiers := core.Map(parents, func(symbol *ast.Symbol) sortedSymbolNamePair {
 * 				if core.Some(symbol.Declarations, hasNonGlobalAugmentationExternalModuleSymbol) {
 * 					return sortedSymbolNamePair{symbol, b.getSpecifierForModuleSymbol(symbol, core.ResolutionModeNone)}
 * 				}
 * 				return sortedSymbolNamePair{symbol, ""}
 * 			})
 * 			slices.SortStableFunc(parentSpecifiers, b.sortByBestName)
 * 			for _, pair := range parentSpecifiers {
 * 				parent := pair.sym
 * 				parentChain := b.getSymbolChain(parent, getQualifiedLeftMeaning(meaning), false, yieldModuleSymbol)
 * 				if len(parentChain) > 0 {
 * 					if parent.Exports != nil {
 * 						exported, ok := parent.Exports[ast.InternalSymbolNameExportEquals]
 * 						if ok && b.ch.getSymbolIfSameReference(exported, symbol) != nil {
 * 							// parentChain root _is_ symbol - symbol is a module export=, so it kinda looks like it's own parent
 * 							// No need to lookup an alias for the symbol in itself
 * 							accessibleSymbolChain = parentChain
 * 							break
 * 						}
 * 					}
 * 					nextSyms := accessibleSymbolChain
 * 					if len(nextSyms) == 0 {
 * 						fallback := b.ch.getAliasForSymbolInContainer(parent, symbol)
 * 						if fallback == nil {
 * 							fallback = symbol
 * 						}
 * 						nextSyms = append(nextSyms, fallback)
 * 					}
 * 					accessibleSymbolChain = append(parentChain, nextSyms...)
 * 					break
 * 				}
 * 			}
 * 		}
 * 	}
 * 	if len(accessibleSymbolChain) > 0 {
 * 		return accessibleSymbolChain
 * 	}
 * 	if
 * 	// If this is the last part of outputting the symbol, always output. The cases apply only to parent symbols.
 * 	endOfChain ||
 * 		// If a parent symbol is an anonymous type, don't write it.
 * 		(symbol.Flags&(ast.SymbolFlagsTypeLiteral|ast.SymbolFlagsObjectLiteral) == 0) {
 * 		// If a parent symbol is an external module, don't write it. (We prefer just `x` vs `"foo/bar".x`.)
 * 		if !endOfChain && !yieldModuleSymbol && core.Some(symbol.Declarations, hasNonGlobalAugmentationExternalModuleSymbol) {
 * 			return nil
 * 		}
 * 		return []*ast.Symbol{symbol}
 * 	}
 * 	return nil
 * }
 */
export function NodeBuilderImpl_getSymbolChain(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>, meaning: SymbolFlags, endOfChain: bool, yieldModuleSymbol: bool): GoSlice<GoPtr<Symbol>> {
  let accessibleSymbolChain = Checker_getAccessibleSymbolChain(receiver!.ch, symbol_, receiver!.ctx!.enclosingDeclaration, meaning, ((receiver!.ctx!.flags & FlagsUseOnlyExternalAliasing) !== 0) as bool);
  let qualifierMeaning = meaning;
  if (accessibleSymbolChain !== undefined && accessibleSymbolChain.length > 1) {
    qualifierMeaning = getQualifiedLeftMeaning(meaning);
  }
  if ((accessibleSymbolChain === undefined || accessibleSymbolChain.length === 0) ||
    Checker_needsQualification(receiver!.ch, accessibleSymbolChain[0], receiver!.ctx!.enclosingDeclaration, qualifierMeaning)) {
    // Go up and add our parent.
    const root = (accessibleSymbolChain !== undefined && accessibleSymbolChain.length > 0) ? accessibleSymbolChain[0] : symbol_;
    const parents = Checker_getContainersOfSymbol(receiver!.ch, root, receiver!.ctx!.enclosingDeclaration, meaning);
    if (parents !== undefined && parents.length > 0) {
      const parentSpecifiers: GoSlice<sortedSymbolNamePair> = parents.map((sym): sortedSymbolNamePair => {
        if (Some(sym!.Declarations, hasNonGlobalAugmentationExternalModuleSymbol)) {
          return { sym, name: NodeBuilderImpl_getSpecifierForModuleSymbol(receiver, sym, ResolutionModeNone) };
        }
        return { sym, name: "" };
      });
      slices.SortStableFunc(parentSpecifiers, (a, b) => NodeBuilderImpl_sortByBestName(receiver, a, b));
      for (const pair of parentSpecifiers) {
        const parent = pair.sym;
        const parentChain = NodeBuilderImpl_getSymbolChain(receiver, parent, getQualifiedLeftMeaning(meaning), false as bool, yieldModuleSymbol);
        if (parentChain !== undefined && parentChain.length > 0) {
          if (parent!.Exports !== undefined) {
            const exported = parent!.Exports.get(InternalSymbolNameExportEquals);
            if (exported !== undefined && Checker_getSymbolIfSameReference(receiver!.ch, exported, symbol_) !== undefined) {
              // parentChain root _is_ symbol - symbol is a module export=, so it kinda looks like it's own parent
              accessibleSymbolChain = parentChain;
              break;
            }
          }
          let nextSyms: GoSlice<GoPtr<Symbol>> = accessibleSymbolChain !== undefined && accessibleSymbolChain.length > 0 ? accessibleSymbolChain : undefined!;
          if (nextSyms === undefined || nextSyms.length === 0) {
            let fallback = Checker_getAliasForSymbolInContainer(receiver!.ch, parent, symbol_);
            if (fallback === undefined) {
              fallback = symbol_;
            }
            nextSyms = [fallback];
          }
          accessibleSymbolChain = [...parentChain, ...nextSyms];
          break;
        }
      }
    }
  }
  if (accessibleSymbolChain !== undefined && accessibleSymbolChain.length > 0) {
    return accessibleSymbolChain;
  }
  if (endOfChain || (symbol_!.Flags & (SymbolFlagsTypeLiteral | SymbolFlagsObjectLiteral)) === 0) {
    if (!endOfChain && !yieldModuleSymbol && Some(symbol_!.Declarations, hasNonGlobalAugmentationExternalModuleSymbol)) {
      return [];
    }
    return [symbol_];
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.sortByBestName","kind":"method","status":"implemented","sigHash":"8e589a5d3f0035701fb63d04d0aa52c4e33680f30603a96554a5a9eee5b274df","bodyHash":"390b43b9952fdfe656b24c5ecc22c228d7bae2586c6a5094eb6a585a22543952"}
 *
 * Go source:
 * func (b_ *NodeBuilderImpl) sortByBestName(a sortedSymbolNamePair, b sortedSymbolNamePair) int {
 * 	specifierA := a.name
 * 	specifierB := b.name
 * 	if len(specifierA) > 0 && len(specifierB) > 0 {
 * 		isBRelative := tspath.PathIsRelative(specifierB)
 * 		if tspath.PathIsRelative(specifierA) == isBRelative {
 * 			// Both relative or both non-relative, sort by number of parts
 * 			return modulespecifiers.CountPathComponents(specifierA) - modulespecifiers.CountPathComponents(specifierB)
 * 		}
 * 		if isBRelative {
 * 			// A is non-relative, B is relative: prefer A
 * 			return -1
 * 		}
 * 		// A is relative, B is non-relative: prefer B
 * 		return 1
 * 	}
 * 	return b_.ch.compareSymbols(a.sym, b.sym) // must sort symbols for stable ordering
 * }
 */
export function NodeBuilderImpl_sortByBestName(receiver: GoPtr<NodeBuilderImpl>, a: sortedSymbolNamePair, b: sortedSymbolNamePair): int {
  const specifierA = a.name;
  const specifierB = b.name;
  if (specifierA.length > 0 && specifierB.length > 0) {
    const isBRelative = PathIsRelative(specifierB);
    if (PathIsRelative(specifierA) === isBRelative) {
      // Both relative or both non-relative, sort by number of parts
      return CountPathComponents(specifierA) - CountPathComponents(specifierB);
    }
    if (isBRelative) {
      // A is non-relative, B is relative: prefer A
      return -1;
    }
    // A is relative, B is non-relative: prefer B
    return 1;
  }
  return receiver!.ch!.compareSymbols(a.sym, b.sym);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::canHaveModuleSpecifier","kind":"func","status":"implemented","sigHash":"9c3c84372e6e3ee9708b3f082d9b28825eda6a5c26f571154d20ea48ee1a98c4","bodyHash":"f7e072038bf225503f91d471fd0d1a7e6abb9f63e10c8d7e6b1b092cf3491afb"}
 *
 * Go source:
 * func canHaveModuleSpecifier(node *ast.Node) bool {
 * 	if node == nil {
 * 		return false
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindVariableDeclaration,
 * 		ast.KindBindingElement,
 * 		ast.KindImportDeclaration,
 * 		ast.KindExportDeclaration,
 * 		ast.KindImportEqualsDeclaration,
 * 		ast.KindImportClause,
 * 		ast.KindNamespaceExport,
 * 		ast.KindNamespaceImport,
 * 		ast.KindExportSpecifier,
 * 		ast.KindImportSpecifier,
 * 		ast.KindImportType:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function canHaveModuleSpecifier(node: GoPtr<Node>): bool {
  if (node === undefined) {
    return false;
  }
  switch (node.Kind) {
    case KindVariableDeclaration:
    case KindBindingElement:
    case KindImportDeclaration:
    case KindExportDeclaration:
    case KindImportEqualsDeclaration:
    case KindImportClause:
    case KindNamespaceExport:
    case KindNamespaceImport:
    case KindExportSpecifier:
    case KindImportSpecifier:
    case KindImportType:
      return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::TryGetModuleSpecifierFromDeclaration","kind":"func","status":"implemented","sigHash":"460f7df27b6af8db51f3b6a6c9f936798cc635b95cd663037f1ba65e9fd648a2","bodyHash":"4449a744272db36eadcf2e8661b204be7388cd59cc4f6a43eb5859dd3950a9ab"}
 *
 * Go source:
 * func TryGetModuleSpecifierFromDeclaration(node *ast.Node) *ast.Node {
 * 	res := tryGetModuleSpecifierFromDeclarationWorker(node)
 * 	if res == nil || !ast.IsStringLiteral(res) {
 * 		return nil
 * 	}
 * 	return res
 * }
 */
export function TryGetModuleSpecifierFromDeclaration(node: GoPtr<Node>): GoPtr<Node> {
  const res = tryGetModuleSpecifierFromDeclarationWorker(node);
  if (res === undefined || !IsStringLiteral(res)) {
    return undefined;
  }
  return res;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::tryGetModuleSpecifierFromDeclarationWorker","kind":"func","status":"implemented","sigHash":"b06d5992925a773c9ec0dfe22406dcc1ec29ebdfc2d9ceeae0862e20fc49d3c5","bodyHash":"59d3977f64974fc24d14c22fd8451aeff21616441b6c5b5d255c54d151ccae4a"}
 *
 * Go source:
 * func tryGetModuleSpecifierFromDeclarationWorker(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindVariableDeclaration, ast.KindBindingElement:
 * 		requireCall := ast.FindAncestor(node.Initializer(), func(node *ast.Node) bool {
 * 			return ast.IsRequireCall(node, true /*requireStringLiteralLikeArgument* /)
 * 		})
 * 		if requireCall == nil {
 * 			return nil
 * 		}
 * 		return requireCall.Arguments()[0]
 * 	case ast.KindImportDeclaration, ast.KindExportDeclaration, ast.KindJSDocImportTag:
 * 		return node.ModuleSpecifier()
 * 	case ast.KindImportEqualsDeclaration:
 * 		ref := node.AsImportEqualsDeclaration().ModuleReference
 * 		if ref.Kind != ast.KindExternalModuleReference {
 * 			return nil
 * 		}
 * 		return ref.Expression()
 * 	case ast.KindImportClause:
 * 		if ast.IsImportDeclaration(node.Parent) {
 * 			return node.Parent.ModuleSpecifier()
 * 		}
 * 		return node.Parent.ModuleSpecifier()
 * 	case ast.KindNamespaceExport:
 * 		return node.Parent.ModuleSpecifier()
 * 	case ast.KindNamespaceImport:
 * 		if ast.IsImportDeclaration(node.Parent.Parent) {
 * 			return node.Parent.Parent.ModuleSpecifier()
 * 		}
 * 		return node.Parent.Parent.ModuleSpecifier()
 * 	case ast.KindExportSpecifier:
 * 		return node.Parent.Parent.ModuleSpecifier()
 * 	case ast.KindImportSpecifier:
 * 		if ast.IsImportDeclaration(node.Parent.Parent.Parent) {
 * 			return node.Parent.Parent.Parent.ModuleSpecifier()
 * 		}
 * 		return node.Parent.Parent.Parent.ModuleSpecifier()
 * 	case ast.KindImportType:
 * 		if ast.IsLiteralImportTypeNode(node) {
 * 			return node.AsImportTypeNode().Argument.AsLiteralTypeNode().Literal
 * 		}
 * 		return nil
 * 	default:
 * 		debug.AssertNever(node)
 * 		return nil
 * 	}
 * }
 */
export function tryGetModuleSpecifierFromDeclarationWorker(node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindVariableDeclaration:
    case KindBindingElement: {
      const requireCall = FindAncestor(Node_Initializer(node), (current) => IsRequireCall(current, true as bool));
      if (requireCall === undefined) {
        return undefined;
      }
      return Node_Arguments(requireCall)![0];
    }
    case KindImportDeclaration:
    case KindExportDeclaration:
    case KindJSDocImportTag:
      return Node_ModuleSpecifier(node);
    case KindImportEqualsDeclaration: {
      const ref = AsImportEqualsDeclaration(node)!.ModuleReference;
      if (ref!.Kind !== KindExternalModuleReference) {
        return undefined;
      }
      return Node_Expression(ref);
    }
    case KindImportClause:
      return Node_ModuleSpecifier(node!.Parent);
    case KindNamespaceExport:
      return Node_ModuleSpecifier(node!.Parent);
    case KindNamespaceImport:
      return Node_ModuleSpecifier(node!.Parent!.Parent);
    case KindExportSpecifier:
      return Node_ModuleSpecifier(node!.Parent!.Parent);
    case KindImportSpecifier:
      return Node_ModuleSpecifier(node!.Parent!.Parent!.Parent);
    case KindImportType:
      if (IsLiteralImportTypeNode(node)) {
        return AsLiteralTypeNode(AsImportTypeNode(node)!.Argument)!.Literal;
      }
      return undefined;
    default:
      return undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.getSpecifierForModuleSymbol","kind":"method","status":"implemented","sigHash":"35c5e29a10beb2a0e48afb6513d6865f7f693d6d0f921710d4a6ba2d3040affc","bodyHash":"4629aa40c107b22a5cc05d9dcdb382d0c5a11b70c78aa682f29cbf1a59b7dfe5"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) getSpecifierForModuleSymbol(symbol *ast.Symbol, overrideImportMode core.ResolutionMode) string {
 * 	file := ast.GetDeclarationOfKind(symbol, ast.KindSourceFile)
 * 	if file == nil {
 * 		equivalentSymbol := core.FirstNonNil(symbol.Declarations, func(d *ast.Node) *ast.Symbol {
 * 			return b.ch.getFileSymbolIfFileSymbolExportEqualsContainer(d, symbol)
 * 		})
 * 		if equivalentSymbol != nil {
 * 			file = ast.GetDeclarationOfKind(equivalentSymbol, ast.KindSourceFile)
 * 		}
 * 	}
 * 
 * 	if file == nil {
 * 		if ast.IsAmbientModuleSymbolName(symbol.Name) {
 * 			return stringutil.StripQuotes(symbol.Name)
 * 		}
 * 	}
 * 	if b.ctx.enclosingFile == nil {
 * 		if ast.IsAmbientModuleSymbolName(symbol.Name) {
 * 			return stringutil.StripQuotes(symbol.Name)
 * 		}
 * 		return ast.GetSourceFileOfModule(symbol).FileName()
 * 	}
 * 
 * 	enclosingDeclaration := b.e.MostOriginal(b.ctx.enclosingDeclaration)
 * 	var originalModuleSpecifier *ast.Node
 * 	if canHaveModuleSpecifier(enclosingDeclaration) {
 * 		originalModuleSpecifier = TryGetModuleSpecifierFromDeclaration(enclosingDeclaration)
 * 	}
 * 	contextFile := b.ctx.enclosingFile
 * 	resolutionMode := overrideImportMode
 * 	if resolutionMode == core.ResolutionModeNone && originalModuleSpecifier != nil {
 * 		resolutionMode = b.ch.program.GetModeForUsageLocation(contextFile, originalModuleSpecifier)
 * 	} else if resolutionMode == core.ResolutionModeNone && contextFile != nil {
 * 		resolutionMode = b.ch.program.GetDefaultResolutionModeForFile(contextFile)
 * 	}
 * 	cacheKey := module.ModeAwareCacheKey{Name: string(contextFile.Path()), Mode: resolutionMode}
 * 	links := b.symbolLinks.Get(symbol)
 * 	if links.specifierCache == nil {
 * 		links.specifierCache = make(module.ModeAwareCache[string])
 * 	}
 * 	result, ok := links.specifierCache[cacheKey]
 * 	if ok {
 * 		return result
 * 	}
 * 	// For declaration bundles, we need to generate absolute paths relative to the common source dir for imports,
 * 	// just like how the declaration emitter does for the ambient module declarations - we can easily accomplish this
 * 	// using the `baseUrl` compiler option (which we would otherwise never use in declaration emit) and a non-relative
 * 	// specifier preference
 * 	host := b.ctx.host
 * 	specifierCompilerOptions := b.ch.compilerOptions
 * 	specifierPref := modulespecifiers.ImportModuleSpecifierPreferenceProjectRelative
 * 	endingPref := modulespecifiers.ImportModuleSpecifierEndingPreferenceNone
 * 	if resolutionMode == core.ResolutionModeESM {
 * 		endingPref = modulespecifiers.ImportModuleSpecifierEndingPreferenceJs
 * 	}
 * 
 * 	allSpecifiers := modulespecifiers.GetModuleSpecifiers(
 * 		symbol,
 * 		b.ch,
 * 		specifierCompilerOptions,
 * 		contextFile,
 * 		host,
 * 		modulespecifiers.UserPreferences{
 * 			ImportModuleSpecifierPreference: specifierPref,
 * 			ImportModuleSpecifierEnding:     endingPref,
 * 		},
 * 		modulespecifiers.ModuleSpecifierOptions{
 * 			OverrideImportMode: overrideImportMode,
 * 		},
 * 		false, /*forAutoImports* /
 * 	)
 * 	if len(allSpecifiers) == 0 {
 * 		links.specifierCache[cacheKey] = ""
 * 		return ""
 * 	}
 * 	specifier := allSpecifiers[0]
 * 	links.specifierCache[cacheKey] = specifier
 * 	return specifier
 * }
 */
export function NodeBuilderImpl_getSpecifierForModuleSymbol(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>, overrideImportMode: ResolutionMode): string {
  let file = GetDeclarationOfKind(symbol_, KindSourceFile);
  if (file === undefined) {
    const equivalentSymbol = FirstNonNil(symbol_!.Declarations ?? [], (d) => Checker_getFileSymbolIfFileSymbolExportEqualsContainer(receiver!.ch, d, symbol_));
    if (equivalentSymbol !== undefined) {
      file = GetDeclarationOfKind(equivalentSymbol as GoPtr<Symbol>, KindSourceFile);
    }
  }
  if (file === undefined && IsAmbientModuleSymbolName(symbol_!.Name)) {
    return StripQuotes(symbol_!.Name);
  }
  if (receiver!.ctx!.enclosingFile === undefined) {
    if (IsAmbientModuleSymbolName(symbol_!.Name)) {
      return StripQuotes(symbol_!.Name);
    }
    return SourceFile_FileName(GetSourceFileOfModule(symbol_)!);
  }
  const enclosingDeclaration = EmitContext_MostOriginal(receiver!.e, receiver!.ctx!.enclosingDeclaration);
  let originalModuleSpecifier: GoPtr<Node>;
  if (canHaveModuleSpecifier(enclosingDeclaration)) {
    originalModuleSpecifier = TryGetModuleSpecifierFromDeclaration(enclosingDeclaration);
  }
  const contextFile = receiver!.ctx!.enclosingFile;
  const contextHasFileName = NewHasFileName(SourceFile_FileName(contextFile), SourceFile_Path(contextFile));
  let resolutionMode = overrideImportMode;
  if (resolutionMode === ResolutionModeNone && originalModuleSpecifier !== undefined) {
    resolutionMode = receiver!.ch!.program.GetEmitSyntaxForUsageLocation(contextHasFileName, originalModuleSpecifier as never);
  } else if (resolutionMode === ResolutionModeNone && contextFile !== undefined) {
    resolutionMode = receiver!.ch!.program.GetImpliedNodeFormatForEmit(contextHasFileName) as unknown as ResolutionMode;
  }
  const cacheKey: ModeAwareCacheKey = { Name: String(SourceFile_Path(contextFile)), Mode: resolutionMode };
  const links = LinkStore_Get<GoPtr<Symbol>, NodeBuilderSymbolLinks>(receiver!.symbolLinks as unknown as LinkStore<GoPtr<Symbol>, NodeBuilderSymbolLinks>, symbol_);
  if (links!.specifierCache === undefined) {
    links!.specifierCache = new globalThis.Map() as ModeAwareCache<string>;
  }
  if (links!.specifierCache.has(cacheKey)) {
    return links!.specifierCache.get(cacheKey) as string;
  }
  const host = (receiver!.ctx!.host.__tsgoEmbedded0 ?? receiver!.ctx!.host) as unknown as ModuleSpecifierGenerationHost;
  const specifierCompilerOptions = receiver!.ch!.compilerOptions;
  const specifierPref = ImportModuleSpecifierPreferenceProjectRelative;
  let endingPref = ImportModuleSpecifierEndingPreferenceNone;
  if (resolutionMode === ResolutionModeESM) {
    endingPref = ImportModuleSpecifierEndingPreferenceJs;
  }
  const importingSourceFile: SourceFileForSpecifierGeneration = {
    Path: () => SourceFile_Path(contextFile),
    FileName: () => SourceFile_FileName(contextFile),
    Imports: () => SourceFile_Imports(contextFile) as never,
    IsJS: () => SourceFile_IsJS(contextFile),
  };
  // Go passes b.ch directly because Checker implements modulespecifiers.Checker via
  // methods; the port adapts the struct to the interface shape with the free functions.
  const checkerShape = {
    GetSymbolAtLocation: (node: GoPtr<Node>) => Checker_GetSymbolAtLocation(receiver!.ch, node),
    GetAliasedSymbol: (aliasSymbol: GoPtr<Symbol>) => Checker_GetAliasedSymbol(receiver!.ch, aliasSymbol),
  };
  const allSpecifiers = GetModuleSpecifiers(
    symbol_,
    checkerShape as never,
    specifierCompilerOptions,
    importingSourceFile,
    host,
    {
      ImportModuleSpecifierPreference: specifierPref,
      ImportModuleSpecifierEnding: endingPref,
      AutoImportSpecifierExcludeRegexes: [],
    },
    { OverrideImportMode: overrideImportMode },
    false as bool,
  );
  if (allSpecifiers.length === 0) {
    links!.specifierCache.set(cacheKey, "");
    return "";
  }
  const specifier = allSpecifiers[0] ?? "";
  links!.specifierCache.set(cacheKey, specifier);
  return specifier;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.typeParameterToDeclarationWithConstraint","kind":"method","status":"implemented","sigHash":"205bc0601b5e3cd5058e32db0a75ccc53b009a85a45430ab0e76b400c88e7597","bodyHash":"fd46f5fe353343f13e4364479aa136eff8bc33861f5e904963926a1f3008caaf"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) typeParameterToDeclarationWithConstraint(typeParameter *Type, constraintNode *ast.TypeNode) *ast.TypeParameterDeclarationNode {
 * 	restoreFlags := b.saveRestoreFlags()
 * 	b.ctx.flags &^= nodebuilder.FlagsWriteTypeParametersInQualifiedName // Avoids potential infinite loop when building for a claimspace with a generic
 * 	modifiers := ast.CreateModifiersFromModifierFlags(b.ch.getTypeParameterModifiers(typeParameter), b.f.NewModifier)
 * 	var modifiersList *ast.ModifierList
 * 	if len(modifiers) > 0 {
 * 		modifiersList = b.f.NewModifierList(modifiers)
 * 	}
 * 	name := b.typeParameterToName(typeParameter)
 * 	defaultParameter := b.ch.getDefaultFromTypeParameter(typeParameter)
 * 	var defaultParameterDeclarationNode *ast.Node
 * 	if defaultParameter != nil {
 * 		defaultParameterDeclarationNode = b.typeToTypeNode(defaultParameter)
 * 	}
 * 	restoreFlags()
 * 	return b.f.NewTypeParameterDeclaration(
 * 		modifiersList,
 * 		name.AsNode(),
 * 		constraintNode,
 * 		nil, // expression
 * 		defaultParameterDeclarationNode,
 * 	)
 * }
 */
export function NodeBuilderImpl_typeParameterToDeclarationWithConstraint(receiver: GoPtr<NodeBuilderImpl>, typeParameter: GoPtr<Type>, constraintNode: GoPtr<TypeNode>): GoPtr<TypeParameterDeclarationNode> {
  const restoreFlags = NodeBuilderImpl_saveRestoreFlags(receiver);
  receiver!.ctx!.flags &= ~FlagsWriteTypeParametersInQualifiedName;
  const modifiers = CreateModifiersFromModifierFlags(Checker_getTypeParameterModifiers(receiver!.ch, typeParameter), (kind) => NodeFactory_NewModifier(receiver!.f, kind)) ?? [];
  const modifiersList = modifiers.length > 0 ? NodeFactory_NewModifierList(receiver!.f, modifiers) : undefined;
  const name = NodeBuilderImpl_typeParameterToName(receiver, typeParameter);
  const defaultParameter = Checker_getDefaultFromTypeParameter(receiver!.ch, typeParameter);
  const defaultParameterDeclarationNode = defaultParameter !== undefined ? NodeBuilderImpl_typeToTypeNode(receiver, defaultParameter) : undefined;
  restoreFlags();
  return NewTypeParameterDeclaration(
    receiver!.f,
    modifiersList,
    NodeDefault_AsNode(name) as GoPtr<IdentifierNode>,
    constraintNode,
    undefined,
    defaultParameterDeclarationNode,
  ) as GoPtr<TypeParameterDeclarationNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.setTextRange","kind":"method","status":"implemented","sigHash":"0b7beeeb9832c9ac762ecacbeb008051eb6bb9dce9f4c55cc045ce82d63f8074","bodyHash":"ce6dd6d7313609c263cdf7c646082c3abc891e5cc08ac09b46a42b9f4f726520"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) setTextRange(range_ *ast.Node, location *ast.Node) *ast.Node {
 * 	if range_ == nil {
 * 		return range_
 * 	}
 * 	if !ast.NodeIsSynthesized(range_) || (range_.Flags&ast.NodeFlagsSynthesized == 0) || b.ctx.enclosingFile == nil || b.ctx.enclosingFile != ast.GetSourceFileOfNode(b.e.MostOriginal(range_)) {
 * 		original := range_
 * 		range_ = range_.Clone(b.f) // if `range` is synthesized or originates in another file, copy it so it definitely has synthetic positions
 * 		range_.Loc = core.NewTextRange(-1, -1)
 * 		if symbol, ok := b.idToSymbol[original]; ok {
 * 			b.idToSymbol[range_] = symbol
 * 		}
 * 	}
 * 	if range_ == location || location == nil {
 * 		return range_
 * 	}
 * 	// Don't overwrite the original node if `range` has an `original` node that points either directly or indirectly to `location`
 * 	original := b.e.Original(range_)
 * 	for original != nil && original != location {
 * 		original = b.e.Original(original)
 * 	}
 * 	if original == nil {
 * 		b.e.SetOriginalEx(range_, location, true)
 * 	}
 * 
 * 	// only set positions if range comes from the same file since copying text across files isn't supported by the emitter
 * 	if b.ctx.enclosingFile != nil && b.ctx.enclosingFile == ast.GetSourceFileOfNode(b.e.MostOriginal(location)) {
 * 		range_.Loc = location.Loc
 * 		return range_
 * 	} else {
 * 		range_.Loc = core.NewTextRange(-1, -1)
 * 	}
 * 	return range_
 * }
 */
export function NodeBuilderImpl_setTextRange(receiver: GoPtr<NodeBuilderImpl>, range_: GoPtr<Node>, location: GoPtr<Node>): GoPtr<Node> {
  if (range_ === undefined) {
    return range_;
  }
  const cloned = (!NodeIsSynthesized(range_) || (range_!.Flags & NodeFlagsSynthesized) === 0 || receiver!.ctx!.enclosingFile === undefined || receiver!.ctx!.enclosingFile !== GetSourceFileOfNode(EmitContext_MostOriginal(receiver!.e, range_)))
    ? (() => {
        const original = range_!;
        const c = Node_Clone(range_, receiver!.f as unknown as NodeFactoryCoercible);
        c!.Loc = NewTextRange(-1, -1);
        const symbol = receiver!.idToSymbol!.get(original as unknown as GoPtr<IdentifierNode>);
        if (symbol !== undefined) {
          receiver!.idToSymbol!.set(c as unknown as GoPtr<IdentifierNode>, symbol);
        }
        return c;
      })()
    : range_;
  if (cloned === location || location === undefined) {
    return cloned;
  }
  // Don't overwrite the original node if `cloned` has an `original` node that points either directly or indirectly to `location`
  const checkOriginal = (() => {
    const findOriginalLoop = (o: GoPtr<Node>): GoPtr<Node> => {
      if (o === undefined || o === location) return o;
      return findOriginalLoop(EmitContext_Original(receiver!.e, o));
    };
    return findOriginalLoop(EmitContext_Original(receiver!.e, cloned));
  })();
  if (checkOriginal === undefined) {
    EmitContext_SetOriginalEx(receiver!.e, cloned, location, true);
  }
  // only set positions if range comes from the same file since copying text across files isn't supported by the emitter
  if (receiver!.ctx!.enclosingFile !== undefined && receiver!.ctx!.enclosingFile === GetSourceFileOfNode(EmitContext_MostOriginal(receiver!.e, location))) {
    cloned!.Loc = location!.Loc;
  } else {
    cloned!.Loc = NewTextRange(-1, -1);
  }
  return cloned;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.typeParameterShadowsOtherTypeParameterInScope","kind":"method","status":"implemented","sigHash":"63ae0ce704f1ed6cf3e1885b0747f5b69d781ba9db7bd824ca8ce4272bbd213a","bodyHash":"e3b5bd0a667a092ba527ea4f665fd9d4347739367d1d7914799994f28020e961"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) typeParameterShadowsOtherTypeParameterInScope(name string, typeParameter *Type) bool {
 * 	result := b.ch.resolveName(b.ctx.enclosingDeclaration, name, ast.SymbolFlagsType, nil, false, false)
 * 	if result != nil && result.Flags&ast.SymbolFlagsTypeParameter != 0 {
 * 		return result != typeParameter.symbol
 * 	}
 * 	return false
 * }
 */
export function NodeBuilderImpl_typeParameterShadowsOtherTypeParameterInScope(receiver: GoPtr<NodeBuilderImpl>, name: string, typeParameter: GoPtr<Type>): bool {
  const result = receiver!.ch!.resolveName(receiver!.ctx!.enclosingDeclaration, name, SymbolFlagsType as SymbolFlags, undefined, false as bool, false as bool);
  if (result !== undefined && (result!.Flags & SymbolFlagsTypeParameter) !== 0) {
    return result !== typeParameter!.symbol;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.typeParameterToName","kind":"method","status":"implemented","sigHash":"f9e5c03ce066276cea28594e05a343f049cbfe1eb11e8995b51a7e038bb13a88","bodyHash":"1e07a9d4424d30b2dd3528a659ab57108c2c4ed1f903af8cdb7ac172025a73ba"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) typeParameterToName(typeParameter *Type) *ast.Identifier {
 * 	if b.ctx.flags&nodebuilder.FlagsGenerateNamesForShadowedTypeParams != 0 {
 * 		if cached, ok := b.ctx.typeParameterNames.Get(typeParameter.id); ok {
 * 			return cached
 * 		}
 * 	}
 * 	result := b.symbolToName(typeParameter.symbol, ast.SymbolFlagsType /*expectsIdentifier* /, true)
 * 	if !ast.IsIdentifier(result) {
 * 		return b.f.NewIdentifier("(Missing type parameter)").AsIdentifier()
 * 	}
 * 	if typeParameter.symbol != nil && len(typeParameter.symbol.Declarations) > 0 {
 * 		decl := typeParameter.symbol.Declarations[0]
 * 		if decl != nil && ast.IsTypeParameterDeclaration(decl) {
 * 			result = b.setTextRange(result, decl.Name())
 * 		}
 * 	}
 * 	if b.ctx.flags&nodebuilder.FlagsGenerateNamesForShadowedTypeParams != 0 {
 * 		rawText := result.Text()
 * 		i, _ := b.ctx.typeParameterNamesByTextNextNameCount.Get(rawText)
 * 		text := rawText
 *
 * 		for true {
 * 			if !b.ctx.typeParameterNamesByText.Has(text) && !b.typeParameterShadowsOtherTypeParameterInScope(text, typeParameter) {
 * 				break
 * 			}
 * 			i++
 * 			text = fmt.Sprintf("%s_%d", rawText, i)
 * 		}
 *
 * 		if text != rawText {
 * 			// !!! TODO: smuggle type arguments out
 * 			// const typeArguments = getIdentifierTypeArguments(result);
 * 			result = b.newIdentifier(text, typeParameter.symbol)
 * 			// setIdentifierTypeArguments(result, typeArguments);
 * 		}
 *
 * 		// avoiding iterations of the above loop turns out to be worth it when `i` starts to get large, so we cache the max
 * 		// `i` we've used thus far, to save work later
 * 		b.ctx.typeParameterNamesByTextNextNameCount.Set(rawText, i)
 * 		b.ctx.typeParameterNames.Set(typeParameter.id, result.AsIdentifier())
 * 		b.ctx.typeParameterNamesByText.Add(text)
 * 	}
 *
 * 	return result.AsIdentifier()
 * }
 */
export function NodeBuilderImpl_typeParameterToName(receiver: GoPtr<NodeBuilderImpl>, typeParameter: GoPtr<Type>): GoPtr<Identifier> {
  if ((receiver!.ctx!.flags & FlagsGenerateNamesForShadowedTypeParams) !== 0) {
    const [cached, ok] = CopyOnWriteMap_Get(receiver!.ctx!.typeParameterNames, typeParameter!.id);
    if (ok) {
      return cached;
    }
  }
  let result = NodeBuilderImpl_symbolToName(receiver, typeParameter!["symbol"], SymbolFlagsType as SymbolFlags, true);
  if (!IsIdentifier(result)) {
    return AsIdentifier(NewIdentifier(receiver!.f, "(Missing type parameter)"));
  }
  if (typeParameter!["symbol"] !== undefined && typeParameter!["symbol"]!.Declarations !== undefined && typeParameter!["symbol"]!.Declarations.length > 0) {
    const decl = typeParameter!["symbol"]!.Declarations[0];
    if (decl !== undefined && IsTypeParameterDeclaration(decl)) {
      result = NodeBuilderImpl_setTextRange(receiver, result, Node_Name(decl));
    }
  }
  if ((receiver!.ctx!.flags & FlagsGenerateNamesForShadowedTypeParams) !== 0) {
    const rawText = AsIdentifier(result)!.Text;
    // Go's `i, _ := ...Get(rawText)` yields the zero value (0) when the key is absent.
    const [prevI] = CopyOnWriteMap_Get(receiver!.ctx!.typeParameterNamesByTextNextNameCount, rawText);
    let i = prevI ?? 0;
    let text = rawText;
    while (true) {
      if (!CopyOnWriteSet_Has(receiver!.ctx!.typeParameterNamesByText, text) && !NodeBuilderImpl_typeParameterShadowsOtherTypeParameterInScope(receiver, text, typeParameter)) {
        break;
      }
      i++;
      text = `${rawText}_${i}`;
    }
    if (text !== rawText) {
      result = NodeBuilderImpl_newIdentifier(receiver, text, typeParameter!["symbol"]);
    }
    CopyOnWriteMap_Set(receiver!.ctx!.typeParameterNamesByTextNextNameCount, rawText, i);
    CopyOnWriteMap_Set(receiver!.ctx!.typeParameterNames, typeParameter!.id, AsIdentifier(result)!);
    CopyOnWriteSet_Add(receiver!.ctx!.typeParameterNamesByText, text);
  }
  return AsIdentifier(result)!;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.isMappedTypeHomomorphic","kind":"method","status":"implemented","sigHash":"25c912a82650cfb451b85646b1e810f4dbce97b8495104af4fab222b7e58a082","bodyHash":"e7ef38b50f9d46fc7b91c9f69f96b15f1948366c3db54c2fc386147167fdfdda"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) isMappedTypeHomomorphic(mapped *Type) bool {
 * 	return b.ch.getHomomorphicTypeVariable(mapped) != nil
 * }
 */
export function NodeBuilderImpl_isMappedTypeHomomorphic(receiver: GoPtr<NodeBuilderImpl>, mapped: GoPtr<Type>): bool {
  return Checker_getHomomorphicTypeVariable(receiver!.ch, mapped) !== undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.isHomomorphicMappedTypeWithNonHomomorphicInstantiation","kind":"method","status":"implemented","sigHash":"0b9c2da41c935666b3419beadf4de74a8ef3a5b31af46e9069a20108db0cd8ea","bodyHash":"dd41bada05dde7b9e380c307573fe7679b3ae3a0b180709a8bc48bafa8e03af8"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) isHomomorphicMappedTypeWithNonHomomorphicInstantiation(mapped *MappedType) bool {
 * 	return mapped.target != nil && !b.isMappedTypeHomomorphic(mapped.AsType()) && b.isMappedTypeHomomorphic(mapped.target)
 * }
 */
export function NodeBuilderImpl_isHomomorphicMappedTypeWithNonHomomorphicInstantiation(receiver: GoPtr<NodeBuilderImpl>, mapped: GoPtr<MappedType>): bool {
  const mappedAsType = (mapped as unknown as TypeData).AsType();
  const target = Type_Target(mappedAsType);
  return (target !== undefined &&
    !NodeBuilderImpl_isMappedTypeHomomorphic(receiver, mappedAsType) &&
    NodeBuilderImpl_isMappedTypeHomomorphic(receiver, target)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.createMappedTypeNodeFromType","kind":"method","status":"implemented","sigHash":"7af9fdfa3d6b367d25985fc9a9b49dcee31a958e0760514cdef766b04c151be9","bodyHash":"0c4f71a7552532b157b2ff0497e6a736325108b8e6cb6da5a5b3e79528fde2e0"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) createMappedTypeNodeFromType(t *Type) *ast.TypeNode {
 * 	debug.Assert(t.Flags()&TypeFlagsObject != 0)
 * 	mapped := t.AsMappedType()
 * 	var readonlyToken *ast.Node
 * 	if mapped.declaration.ReadonlyToken != nil {
 * 		readonlyToken = b.f.NewToken(mapped.declaration.ReadonlyToken.Kind)
 * 	}
 * 	var questionToken *ast.Node
 * 	if mapped.declaration.QuestionToken != nil {
 * 		questionToken = b.f.NewToken(mapped.declaration.QuestionToken.Kind)
 * 	}
 * 	var appropriateConstraintTypeNode *ast.Node
 * 	var newTypeVariable *ast.Node
 * 	templateType := b.ch.getTemplateTypeFromMappedType(t)
 * 	typeParameter := b.ch.getTypeParameterFromMappedType(t)
 * 
 * 	// If the mapped type isn't `keyof` constraint-declared, _but_ still has modifiers preserved, and its naive instantiation won't preserve modifiers because its constraint isn't `keyof` constrained, we have work to do
 * 	needsModifierPreservingWrapper := !b.ch.isMappedTypeWithKeyofConstraintDeclaration(t) &&
 * 		b.ch.getModifiersTypeFromMappedType(t).flags&TypeFlagsUnknown == 0 &&
 * 		b.ctx.flags&nodebuilder.FlagsGenerateNamesForShadowedTypeParams != 0 &&
 * 		!(b.ch.getConstraintTypeFromMappedType(t).flags&TypeFlagsTypeParameter != 0 && b.ch.getConstraintOfTypeParameter(b.ch.getConstraintTypeFromMappedType(t)).flags&TypeFlagsIndex != 0)
 * 
 * 	if b.ch.isMappedTypeWithKeyofConstraintDeclaration(t) {
 * 		// We have a { [P in keyof T]: X }
 * 		// We do this to ensure we retain the toplevel keyof-ness of the type which may be lost due to keyof distribution during `getConstraintTypeFromMappedType`
 * 		if b.ctx.flags&nodebuilder.FlagsGenerateNamesForShadowedTypeParams != 0 && b.isHomomorphicMappedTypeWithNonHomomorphicInstantiation(mapped) {
 * 			newConstraintParam := b.ch.newTypeParameter(
 * 				b.ch.newSymbol(ast.SymbolFlagsTypeParameter, "T"),
 * 			)
 * 			name := b.typeParameterToName(newConstraintParam)
 * 			target := t.Target()
 * 			newTypeVariable = b.f.NewTypeReferenceNode(name.AsNode(), nil)
 * 			templateType = b.ch.instantiateType(b.ch.getTemplateTypeFromMappedType(target), newTypeMapper([]*Type{b.ch.getTypeParameterFromMappedType(target), b.ch.getModifiersTypeFromMappedType(target)}, []*Type{typeParameter, newConstraintParam}))
 * 		}
 * 		indexTarget := newTypeVariable
 * 		if indexTarget == nil {
 * 			indexTarget = b.typeToTypeNode(b.ch.getModifiersTypeFromMappedType(t))
 * 		}
 * 		appropriateConstraintTypeNode = b.f.NewTypeOperatorNode(ast.KindKeyOfKeyword, indexTarget)
 * 	} else if needsModifierPreservingWrapper {
 * 		// So, step 1: new type variable
 * 		newParam := b.ch.newTypeParameter(
 * 			b.ch.newSymbol(ast.SymbolFlagsTypeParameter, "T"),
 * 		)
 * 		name := b.typeParameterToName(newParam)
 * 		newTypeVariable = b.f.NewTypeReferenceNode(name.AsNode(), nil)
 * 		// step 2: make that new type variable itself the constraint node, making the mapped type `{[K in T_1]: Template}`
 * 		appropriateConstraintTypeNode = newTypeVariable
 * 	} else {
 * 		appropriateConstraintTypeNode = b.typeToTypeNode(b.ch.getConstraintTypeFromMappedType(t))
 * 	}
 * 
 * 	// nameType and templateType nodes have to be in the new scope
 * 	cleanup := b.enterNewScope(mapped.declaration.AsNode(), nil, []*Type{b.ch.getTypeParameterFromMappedType(t)}, nil, nil)
 * 	typeParameterDeclarationNode := b.typeParameterToDeclarationWithConstraint(typeParameter, appropriateConstraintTypeNode)
 * 	var nameTypeNode *ast.Node
 * 	if mapped.declaration.NameType != nil {
 * 		nameTypeNode = b.typeToTypeNode(b.ch.getNameTypeFromMappedType(t))
 * 	}
 * 	templateTypeNode := b.typeToTypeNode(b.ch.removeMissingType(
 * 		templateType,
 * 		getMappedTypeModifiers(t)&MappedTypeModifiersIncludeOptional != 0,
 * 	))
 * 	cleanup()
 * 	result := b.f.NewMappedTypeNode(
 * 		readonlyToken,
 * 		typeParameterDeclarationNode,
 * 		nameTypeNode,
 * 		questionToken,
 * 		templateTypeNode,
 * 		nil,
 * 	)
 * 	b.ctx.approximateLength += 10
 * 	b.e.AddEmitFlags(result, printer.EFSingleLine)
 * 
 * 	if b.ctx.flags&nodebuilder.FlagsGenerateNamesForShadowedTypeParams != 0 && b.isHomomorphicMappedTypeWithNonHomomorphicInstantiation(mapped) {
 * 		// homomorphic mapped type with a non-homomorphic naive inlining
 * 		// wrap it with a conditional like `SomeModifiersType extends infer U ? {..the mapped type...} : never` to ensure the resulting
 * 		// type stays homomorphic
 * 
 * 		rawConstraintTypeFromDeclaration := b.getTypeFromTypeNode(mapped.declaration.TypeParameter.AsTypeParameterDeclaration().Constraint.Type(), false)
 * 		if rawConstraintTypeFromDeclaration != nil {
 * 			rawConstraintTypeFromDeclaration = b.ch.getConstraintOfTypeParameter(rawConstraintTypeFromDeclaration)
 * 		}
 * 		if rawConstraintTypeFromDeclaration == nil {
 * 			rawConstraintTypeFromDeclaration = b.ch.unknownType
 * 		}
 * 		originalConstraint := b.ch.instantiateType(rawConstraintTypeFromDeclaration, mapped.mapper)
 * 
 * 		var originalConstraintNode *ast.Node
 * 		if originalConstraint.flags&TypeFlagsUnknown == 0 {
 * 			originalConstraintNode = b.typeToTypeNode(originalConstraint)
 * 		}
 * 
 * 		return b.f.NewConditionalTypeNode(
 * 			b.typeToTypeNode(b.ch.getModifiersTypeFromMappedType(t)),
 * 			b.f.NewInferTypeNode(b.f.NewTypeParameterDeclaration(nil, newTypeVariable.AsTypeReferenceNode().TypeName.Clone(b.f), originalConstraintNode, nil, nil)),
 * 			result,
 * 			b.f.NewKeywordTypeNode(ast.KindNeverKeyword),
 * 		)
 * 	} else if needsModifierPreservingWrapper {
 * 		// and step 3: once the mapped type is reconstructed, create a `ConstraintType extends infer T_1 extends keyof ModifiersType ? {[K in T_1]: Template} : never`
 * 		// subtly different from the `keyof` constraint case, by including the `keyof` constraint on the `infer` type parameter, it doesn't rely on the constraint type being itself
 * 		// constrained to a `keyof` type to preserve its modifier-preserving behavior. This is all basically because we preserve modifiers for a wider set of mapped types than
 * 		// just homomorphic ones.
 * 		return b.f.NewConditionalTypeNode(
 * 			b.typeToTypeNode(b.ch.getConstraintTypeFromMappedType(t)),
 * 			b.f.NewInferTypeNode(b.f.NewTypeParameterDeclaration(nil, newTypeVariable.AsTypeReferenceNode().TypeName.Clone(b.f), b.f.NewTypeOperatorNode(ast.KindKeyOfKeyword, b.typeToTypeNode(b.ch.getModifiersTypeFromMappedType(t))), nil, nil)),
 * 			result,
 * 			b.f.NewKeywordTypeNode(ast.KindNeverKeyword),
 * 		)
 * 	}
 * 
 * 	return result
 * }
 */
export function NodeBuilderImpl_createMappedTypeNodeFromType(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>): GoPtr<TypeNode> {
  if ((t!.flags & TypeFlagsObject) === 0) {
    throw new globalThis.Error("Debug failure.");
  }
  const b = receiver!;
  const mapped = Type_AsMappedType(t)!;
  const declaration = AsMappedTypeNode(mapped.declaration)!;
  const readonlyToken = declaration.ReadonlyToken !== undefined ? NewToken(b.f, declaration.ReadonlyToken.Kind) : undefined;
  const questionToken = declaration.QuestionToken !== undefined ? NewToken(b.f, declaration.QuestionToken.Kind) : undefined;
  let appropriateConstraintTypeNode: GoPtr<TypeNode> = undefined;
  let newTypeVariable: GoPtr<Node> = undefined;
  let templateType = Checker_getTemplateTypeFromMappedType(b.ch, t);
  const typeParameter = Checker_getTypeParameterFromMappedType(b.ch, t);
  const constraintType = Checker_getConstraintTypeFromMappedType(b.ch, t);
  const modifiersType = Checker_getModifiersTypeFromMappedType(b.ch, t);

  const constraintOfConstraint = (constraintType!.flags & TypeFlagsTypeParameter) !== 0
    ? Checker_getConstraintOfTypeParameter(b.ch, constraintType)
    : undefined;
  const needsModifierPreservingWrapper =
    !Checker_isMappedTypeWithKeyofConstraintDeclaration(b.ch, t) &&
    (modifiersType!.flags & TypeFlagsUnknown) === 0 &&
    (b.ctx!.flags & FlagsGenerateNamesForShadowedTypeParams) !== 0 &&
    !((constraintType!.flags & TypeFlagsTypeParameter) !== 0 && constraintOfConstraint !== undefined && (constraintOfConstraint.flags & TypeFlagsIndex) !== 0);

  if (Checker_isMappedTypeWithKeyofConstraintDeclaration(b.ch, t)) {
    if ((b.ctx!.flags & FlagsGenerateNamesForShadowedTypeParams) !== 0 && NodeBuilderImpl_isHomomorphicMappedTypeWithNonHomomorphicInstantiation(receiver, mapped)) {
      const newConstraintParam = Checker_newTypeParameter(b.ch, Checker_newSymbol(b.ch, SymbolFlagsTypeParameter, "T"));
      const name = NodeBuilderImpl_typeParameterToName(receiver, newConstraintParam);
      const target = Type_Target(t);
      newTypeVariable = NewTypeReferenceNode(b.f, name as never, undefined);
      templateType = Checker_instantiateType(
        b.ch,
        Checker_getTemplateTypeFromMappedType(b.ch, target),
        newTypeMapper(
          [Checker_getTypeParameterFromMappedType(b.ch, target), Checker_getModifiersTypeFromMappedType(b.ch, target)],
          [typeParameter, newConstraintParam],
        ),
      );
    }
    const indexTarget = newTypeVariable !== undefined
      ? newTypeVariable as GoPtr<TypeNode>
      : NodeBuilderImpl_typeToTypeNode(receiver, modifiersType);
    appropriateConstraintTypeNode = NewTypeOperatorNode(b.f, KindKeyOfKeyword, indexTarget) as GoPtr<TypeNode>;
  } else if (needsModifierPreservingWrapper) {
    const newParam = Checker_newTypeParameter(b.ch, Checker_newSymbol(b.ch, SymbolFlagsTypeParameter, "T"));
    const name = NodeBuilderImpl_typeParameterToName(receiver, newParam);
    newTypeVariable = NewTypeReferenceNode(b.f, name as never, undefined);
    appropriateConstraintTypeNode = newTypeVariable as GoPtr<TypeNode>;
  } else {
    appropriateConstraintTypeNode = NodeBuilderImpl_typeToTypeNode(receiver, constraintType);
  }

  const cleanup = NodeBuilderImpl_enterNewScope(receiver, mapped.declaration, [], [typeParameter], [], undefined);
  const typeParameterDeclarationNode = NodeBuilderImpl_typeParameterToDeclarationWithConstraint(receiver, typeParameter, appropriateConstraintTypeNode);
  const nameTypeNode = declaration.NameType !== undefined
    ? NodeBuilderImpl_typeToTypeNode(receiver, Checker_getNameTypeFromMappedType(b.ch, t))
    : undefined;
  const templateTypeNode = NodeBuilderImpl_typeToTypeNode(
    receiver,
    Checker_removeMissingType(b.ch, templateType, (getMappedTypeModifiers(t) & MappedTypeModifiersIncludeOptional) !== 0),
  );
  cleanup();

  const result = NewMappedTypeNode(
    b.f,
    readonlyToken,
    typeParameterDeclarationNode,
    nameTypeNode,
    questionToken,
    templateTypeNode,
    undefined,
  );
  b.ctx!.approximateLength += 10;
  EmitContext_AddEmitFlags(b.e, result, EFSingleLine);

  if ((b.ctx!.flags & FlagsGenerateNamesForShadowedTypeParams) !== 0 && NodeBuilderImpl_isHomomorphicMappedTypeWithNonHomomorphicInstantiation(receiver, mapped)) {
    // Go: ...TypeParameter.AsTypeParameterDeclaration().Constraint.Type() — the
    // OPERAND of the `keyof` constraint node, not the constraint node itself.
    let rawConstraintTypeFromDeclaration = NodeBuilderImpl_getTypeFromTypeNode(receiver, Node_Type(AsTypeParameterDeclaration(declaration.TypeParameter)!.Constraint), false);
    if (rawConstraintTypeFromDeclaration !== undefined) {
      rawConstraintTypeFromDeclaration = Checker_getConstraintOfTypeParameter(b.ch, rawConstraintTypeFromDeclaration);
    }
    if (rawConstraintTypeFromDeclaration === undefined) {
      rawConstraintTypeFromDeclaration = b.ch!.unknownType;
    }
    const originalConstraint = Checker_instantiateType(b.ch, rawConstraintTypeFromDeclaration, (mapped as unknown as TypeData).AsObjectType()!.mapper);
    const originalConstraintNode = (originalConstraint!.flags & TypeFlagsUnknown) === 0
      ? NodeBuilderImpl_typeToTypeNode(receiver, originalConstraint)
      : undefined;
    const newTypeVariableName = AsTypeReferenceNode(newTypeVariable)!.TypeName;
    return NewConditionalTypeNode(
      b.f,
      NodeBuilderImpl_typeToTypeNode(receiver, modifiersType),
      NewInferTypeNode(b.f, NewTypeParameterDeclaration(b.f, undefined, NodeFactory_DeepCloneNode(b.f, newTypeVariableName) as never, originalConstraintNode, undefined, undefined) as GoPtr<TypeParameterDeclarationNode>) as GoPtr<TypeNode>,
      result as GoPtr<TypeNode>,
      NewKeywordTypeNode(b.f, KindNeverKeyword),
    ) as GoPtr<TypeNode>;
  } else if (needsModifierPreservingWrapper) {
    const newTypeVariableName = AsTypeReferenceNode(newTypeVariable)!.TypeName;
    return NewConditionalTypeNode(
      b.f,
      NodeBuilderImpl_typeToTypeNode(receiver, constraintType),
      NewInferTypeNode(
        b.f,
        NewTypeParameterDeclaration(
          b.f,
          undefined,
          NodeFactory_DeepCloneNode(b.f, newTypeVariableName) as never,
          NewTypeOperatorNode(b.f, KindKeyOfKeyword, NodeBuilderImpl_typeToTypeNode(receiver, modifiersType)) as GoPtr<TypeNode>,
          undefined,
          undefined,
        ) as GoPtr<TypeParameterDeclarationNode>,
      ) as GoPtr<TypeNode>,
      result as GoPtr<TypeNode>,
      NewKeywordTypeNode(b.f, KindNeverKeyword),
    ) as GoPtr<TypeNode>;
  }

  return result as GoPtr<TypeNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.typePredicateToTypePredicateNode","kind":"method","status":"implemented","sigHash":"177dc48bbdc0fa840784acd061a234fee00b51993451281e379b8ef783b8522f","bodyHash":"75a32f0be8816082be87abc53509de8fcf0ccf38ed23423e7675a5cbaa6cee1e"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) typePredicateToTypePredicateNode(predicate *TypePredicate) *ast.Node {
 * 	var assertsModifier *ast.Node
 * 	if predicate.kind == TypePredicateKindAssertsIdentifier || predicate.kind == TypePredicateKindAssertsThis {
 * 		assertsModifier = b.f.NewToken(ast.KindAssertsKeyword)
 * 	}
 * 	var parameterName *ast.Node
 * 	if predicate.kind == TypePredicateKindIdentifier || predicate.kind == TypePredicateKindAssertsIdentifier {
 * 		parameterName = b.f.NewIdentifier(predicate.parameterName)
 * 		b.e.AddEmitFlags(parameterName, printer.EFNoAsciiEscaping)
 * 	} else {
 * 		parameterName = b.f.NewThisTypeNode()
 * 	}
 * 	var typeNode *ast.Node
 * 	if predicate.t != nil {
 * 		typeNode = b.typeToTypeNode(predicate.t)
 * 	}
 * 	return b.f.NewTypePredicateNode(
 * 		assertsModifier,
 * 		parameterName,
 * 		typeNode,
 * 	)
 * }
 */
export function NodeBuilderImpl_typePredicateToTypePredicateNode(receiver: GoPtr<NodeBuilderImpl>, predicate: GoPtr<TypePredicate>): GoPtr<Node> {
  const assertsModifier = (predicate!.kind === TypePredicateKindAssertsIdentifier || predicate!.kind === TypePredicateKindAssertsThis)
    ? NewToken(receiver!.f, KindAssertsKeyword)
    : undefined;
  let parameterName: GoPtr<Node>;
  if (predicate!.kind === TypePredicateKindIdentifier || predicate!.kind === TypePredicateKindAssertsIdentifier) {
    parameterName = NewIdentifier(receiver!.f, predicate!.parameterName);
    EmitContext_AddEmitFlags(receiver!.e, parameterName, EFNoAsciiEscaping);
  } else {
    parameterName = NewThisTypeNode(receiver!.f);
  }
  const typeNode = predicate!.t !== undefined ? NodeBuilderImpl_typeToTypeNode(receiver, predicate!.t) : undefined;
  return NewTypePredicateNode(receiver!.f, assertsModifier as never, parameterName as never, typeNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.typeToTypeNodeHelperWithPossibleReusableTypeNode","kind":"method","status":"implemented","sigHash":"5105d17227307e88a6b0fe085d882fded9be0819cd562b69d5939f810245b4be","bodyHash":"9e336dd8a27646820b732e162b424fed2cb65b6639a54be35caeb562947fad77"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) typeToTypeNodeHelperWithPossibleReusableTypeNode(t *Type, typeNode *ast.TypeNode) *ast.TypeNode {
 * 	if t == nil {
 * 		return b.f.NewKeywordTypeNode(ast.KindAnyKeyword)
 * 	}
 * 	if !b.isActivelyExpanding() && typeNode != nil && b.getTypeFromTypeNode(typeNode, false) == t {
 * 		reused := b.tryReuseExistingNodeHelper(typeNode)
 * 		if reused != nil {
 * 			b.checkTypeExpandability(t)
 * 			return reused
 * 		}
 * 	}
 * 	return b.typeToTypeNode(t)
 * }
 */
export function NodeBuilderImpl_typeToTypeNodeHelperWithPossibleReusableTypeNode(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>, typeNode: GoPtr<TypeNode>): GoPtr<TypeNode> {
  if (t === undefined) {
    return NewKeywordTypeNode(receiver!.f, KindAnyKeyword) as GoPtr<TypeNode>;
  }
  if (!NodeBuilderImpl_isActivelyExpanding(receiver) && typeNode !== undefined && NodeBuilderImpl_getTypeFromTypeNode(receiver, typeNode, false as bool) === t) {
    const reused = NodeBuilderImpl_tryReuseExistingNodeHelper(receiver, typeNode);
    if (reused !== undefined) {
      NodeBuilderImpl_checkTypeExpandability(receiver, t);
      return reused;
    }
  }
  return NodeBuilderImpl_typeToTypeNode(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.typeParameterToDeclaration","kind":"method","status":"implemented","sigHash":"6fccdc3ca47a34a5a81a6f84b772e16468f6102e550c64cac0574853a301b7cf","bodyHash":"1e1ada8a3d525cb931458a434145a82fc906d5da72a8662cbbb183ece26d6bc2"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) typeParameterToDeclaration(parameter *Type) *ast.Node {
 * 	constraint := b.ch.getConstraintOfTypeParameter(parameter)
 * 	var constraintNode *ast.Node
 * 	if constraint != nil {
 * 		constraintNode = b.typeToTypeNodeHelperWithPossibleReusableTypeNode(constraint, b.ch.getConstraintDeclaration(parameter))
 * 	}
 * 	return b.typeParameterToDeclarationWithConstraint(parameter, constraintNode)
 * }
 */
export function NodeBuilderImpl_typeParameterToDeclaration(receiver: GoPtr<NodeBuilderImpl>, parameter: GoPtr<Type>): GoPtr<Node> {
  const constraint = Checker_getConstraintOfTypeParameter(receiver!.ch, parameter);
  const constraintNode = constraint !== undefined
    ? NodeBuilderImpl_typeToTypeNodeHelperWithPossibleReusableTypeNode(receiver, constraint, Checker_getConstraintDeclaration(receiver!.ch, parameter) as GoPtr<TypeNode>)
    : undefined;
  return NodeBuilderImpl_typeParameterToDeclarationWithConstraint(receiver, parameter, constraintNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.symbolToTypeParameterDeclarations","kind":"method","status":"implemented","sigHash":"102a8b7c3a89105042ca73b1c21597f6aebabe6af0642683db15661fe32b7721","bodyHash":"e3b04cdef9e22534d331b349359dacf3bed736e4f14a8a43bbcb36854bcd4afa"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) symbolToTypeParameterDeclarations(symbol *ast.Symbol) []*ast.Node {
 * 	return b.typeParametersToTypeParameterDeclarations(symbol)
 * }
 */
export function NodeBuilderImpl_symbolToTypeParameterDeclarations(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Node>> {
  return NodeBuilderImpl_typeParametersToTypeParameterDeclarations(receiver, symbol_);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.typeParametersToTypeParameterDeclarations","kind":"method","status":"implemented","sigHash":"54a5f81c6ecb718ee941edad8da0bd611ddc4a954d677d78156813f62b13fc74","bodyHash":"0cad470717b0b4ce5700ca4c4fb3e081db67e0c2fac69772a15151ebdb7cb33a"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) typeParametersToTypeParameterDeclarations(symbol *ast.Symbol) []*ast.Node {
 * 	targetSymbol := b.ch.getTargetSymbol(symbol)
 * 	if targetSymbol.Flags&(ast.SymbolFlagsClass|ast.SymbolFlagsInterface|ast.SymbolFlagsAlias) != 0 {
 * 		var results []*ast.Node
 * 		params := b.ch.getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(symbol)
 * 		for _, param := range params {
 * 			results = append(results, b.typeParameterToDeclaration(param))
 * 		}
 * 		return results
 * 	} else if targetSymbol.Flags&ast.SymbolFlagsFunction != 0 {
 * 		var results []*ast.Node
 * 		for _, param := range b.ch.getTypeParametersFromDeclaration(symbol.ValueDeclaration) {
 * 			results = append(results, b.typeParameterToDeclaration(param))
 * 		}
 * 		return results
 * 	}
 * 	return nil
 * }
 */
export function NodeBuilderImpl_typeParametersToTypeParameterDeclarations(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Node>> {
  const targetSymbol = Checker_getTargetSymbol(receiver!.ch, symbol_);
  if ((targetSymbol!.Flags & (SymbolFlagsClass | SymbolFlagsInterface | SymbolFlagsAlias)) !== 0) {
    const results: GoSlice<GoPtr<Node>> = [];
    const params = Checker_getLocalTypeParametersOfClassOrInterfaceOrTypeAlias(receiver!.ch, symbol_);
    for (const param of params ?? []) {
      results.push(NodeBuilderImpl_typeParameterToDeclaration(receiver, param));
    }
    return results;
  }
  if ((targetSymbol!.Flags & SymbolFlagsFunction) !== 0) {
    const results: GoSlice<GoPtr<Node>> = [];
    for (const param of Checker_getTypeParametersFromDeclaration(receiver!.ch, symbol_!.ValueDeclaration) ?? []) {
      results.push(NodeBuilderImpl_typeParameterToDeclaration(receiver, param));
    }
    return results;
  }
  return undefined!;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::getEffectiveParameterDeclaration","kind":"func","status":"implemented","sigHash":"6a63cf3e5247a19a6de66ce7d20301cd82f28113bfd3e289d4c44bb68b2e0e95","bodyHash":"b4673b9d5f2df7a079acea1e7d3589c9d80aa4790a1ee6aa60f70819107c85d1"}
 *
 * Go source:
 * func getEffectiveParameterDeclaration(symbol *ast.Symbol) *ast.Node {
 * 	parameterDeclaration := ast.GetDeclarationOfKind(symbol, ast.KindParameter)
 * 	if parameterDeclaration != nil {
 * 		return parameterDeclaration
 * 	}
 * 	if symbol.Flags&ast.SymbolFlagsTransient == 0 {
 * 		return ast.GetDeclarationOfKind(symbol, ast.KindJSDocParameterTag)
 * 	}
 * 	return nil
 * }
 */
export function getEffectiveParameterDeclaration(symbol_: GoPtr<Symbol>): GoPtr<Node> {
  const parameterDeclaration = GetDeclarationOfKind(symbol_, KindParameter);
  if (parameterDeclaration !== undefined) {
    return parameterDeclaration;
  }
  if ((symbol_!.Flags & SymbolFlagsTransient) === 0) {
    return GetDeclarationOfKind(symbol_, KindJSDocParameterTag);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.symbolToParameterDeclaration","kind":"method","status":"implemented","sigHash":"35650e77c2e2e44bd43e04d4a1dcd8ebb23065fe546404e3eca3da8ac11b59eb","bodyHash":"a08565a2a284e5501c31b05bd1a3013ed9cb912a073063916d20c77ef68aa021"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) symbolToParameterDeclaration(parameterSymbol *ast.Symbol, preserveModifierFlags bool) *ast.Node {
 * 	parameterDeclaration := getEffectiveParameterDeclaration(parameterSymbol)
 * 
 * 	parameterType := b.ch.getTypeOfSymbol(parameterSymbol)
 * 	parameterTypeNode := b.serializeTypeForDeclaration(parameterDeclaration, parameterType, parameterSymbol, true)
 * 	var modifiers *ast.ModifierList
 * 	if b.ctx.flags&nodebuilder.FlagsOmitParameterModifiers == 0 && preserveModifierFlags && parameterDeclaration != nil && ast.CanHaveModifiers(parameterDeclaration) {
 * 		originals := core.Filter(parameterDeclaration.ModifierNodes(), ast.IsModifier)
 * 		clones := core.Map(originals, func(node *ast.Node) *ast.Node { return node.Clone(b.f) })
 * 		if len(clones) > 0 {
 * 			modifiers = b.f.NewModifierList(clones)
 * 		}
 * 	}
 * 	isRest := parameterDeclaration != nil && isRestParameter(parameterDeclaration) || parameterSymbol.CheckFlags&ast.CheckFlagsRestParameter != 0
 * 	var dotDotDotToken *ast.Node
 * 	if isRest {
 * 		dotDotDotToken = b.f.NewToken(ast.KindDotDotDotToken)
 * 	}
 * 	name := b.parameterToParameterDeclarationName(parameterSymbol, parameterDeclaration)
 * 	isOptional := parameterDeclaration != nil && b.ch.isOptionalParameter(parameterDeclaration) || parameterSymbol.CheckFlags&ast.CheckFlagsOptionalParameter != 0
 * 	var questionToken *ast.Node
 * 	if isOptional {
 * 		questionToken = b.f.NewToken(ast.KindQuestionToken)
 * 	}
 * 
 * 	parameterNode := b.f.NewParameterDeclaration(
 * 		modifiers,
 * 		dotDotDotToken,
 * 		name,
 * 		questionToken,
 * 		parameterTypeNode,
 * 		/*initializer* / nil,
 * 	)
 * 	b.ctx.approximateLength += len(parameterSymbol.Name) + 3
 * 	return parameterNode
 * }
 */
export function NodeBuilderImpl_symbolToParameterDeclaration(receiver: GoPtr<NodeBuilderImpl>, parameterSymbol: GoPtr<Symbol>, preserveModifierFlags: bool): GoPtr<Node> {
  const parameterDeclaration = getEffectiveParameterDeclaration(parameterSymbol);
  const parameterType = Checker_getTypeOfSymbol(receiver!.ch, parameterSymbol);
  const parameterTypeNode = NodeBuilderImpl_serializeTypeForDeclaration(receiver, parameterDeclaration as GoPtr<Declaration>, parameterType, parameterSymbol, true as bool);
  let modifiers: GoPtr<NodeList>;
  if ((receiver!.ctx!.flags & FlagsOmitParameterModifiers) === 0 && preserveModifierFlags && parameterDeclaration !== undefined && CanHaveModifiers(parameterDeclaration)) {
    const originals = Filter(Node_ModifierNodes(parameterDeclaration) ?? [], IsModifier);
    const clones = CoreMap(originals, (node) => Node_Clone(node, receiver!.f as unknown as NodeFactoryCoercible));
    if (clones.length > 0) {
      modifiers = NodeFactory_NewModifierList(receiver!.f, clones);
    }
  }
  const isRest = ((parameterDeclaration !== undefined && isRestParameter(parameterDeclaration)) || (parameterSymbol!.CheckFlags & CheckFlagsRestParameter) !== 0) as bool;
  const dotDotDotToken = isRest ? NewToken(receiver!.f, KindDotDotDotToken) : undefined;
  const name = NodeBuilderImpl_parameterToParameterDeclarationName(receiver, parameterSymbol, parameterDeclaration);
  const isOptional = ((parameterDeclaration !== undefined && Checker_isOptionalParameter(receiver!.ch, parameterDeclaration)) || (parameterSymbol!.CheckFlags & CheckFlagsOptionalParameter) !== 0) as bool;
  const questionToken = isOptional ? NewToken(receiver!.f, KindQuestionToken) : undefined;
  const parameterNode = NewParameterDeclaration(
    receiver!.f,
    modifiers as never,
    dotDotDotToken as never,
    name as GoPtr<BindingName>,
    questionToken as never,
    parameterTypeNode as GoPtr<TypeNode>,
    undefined,
  );
  receiver!.ctx!.approximateLength += parameterSymbol!.Name.length + 3;
  return parameterNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.parameterToParameterDeclarationName","kind":"method","status":"implemented","sigHash":"06e2e92fed8e7182b1ef53c1134cd8c96f2cb7e488d19172edfa8c310fbfdadd","bodyHash":"e0c7f342673b7c62ff8d59de31e67b50d20c8f755d668348cdf00be0b543b1e6"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) parameterToParameterDeclarationName(parameterSymbol *ast.Symbol, parameterDeclaration *ast.Node) *ast.Node {
 * 	if parameterDeclaration == nil || parameterDeclaration.Name() == nil {
 * 		return b.newIdentifier(parameterSymbol.Name, parameterSymbol)
 * 	}
 * 
 * 	name := parameterDeclaration.Name()
 * 	switch name.Kind {
 * 	case ast.KindIdentifier:
 * 		cloned := b.f.DeepCloneNode(name)
 * 		b.e.SetEmitFlags(cloned, printer.EFNoAsciiEscaping)
 * 		b.idToSymbol[cloned] = parameterSymbol
 * 		return cloned
 * 	case ast.KindQualifiedName:
 * 		cloned := b.f.DeepCloneNode(name.AsQualifiedName().Right)
 * 		b.e.SetEmitFlags(cloned, printer.EFNoAsciiEscaping)
 * 		b.idToSymbol[cloned] = parameterSymbol
 * 		return cloned
 * 	default:
 * 		return b.cloneBindingName(name)
 * 	}
 * }
 */
export function NodeBuilderImpl_parameterToParameterDeclarationName(receiver: GoPtr<NodeBuilderImpl>, parameterSymbol: GoPtr<Symbol>, parameterDeclaration: GoPtr<Node>): GoPtr<Node> {
  if (parameterDeclaration === undefined || Node_Name(parameterDeclaration) === undefined) {
    return NodeBuilderImpl_newIdentifier(receiver, parameterSymbol!.Name, parameterSymbol);
  }
  const name = Node_Name(parameterDeclaration);
  if (IsIdentifier(name)) {
    const cloned = NodeFactory_DeepCloneNode(receiver!.f, name);
    EmitContext_SetEmitFlags(receiver!.e, cloned, EFNoAsciiEscaping);
    receiver!.idToSymbol!.set(cloned as GoPtr<IdentifierNode>, parameterSymbol);
    return cloned;
  }
  if (IsQualifiedName(name)) {
    const cloned = NodeFactory_DeepCloneNode(receiver!.f, AsQualifiedName(name)!.Right);
    EmitContext_SetEmitFlags(receiver!.e, cloned, EFNoAsciiEscaping);
    receiver!.idToSymbol!.set(cloned as GoPtr<IdentifierNode>, parameterSymbol);
    return cloned;
  }
  return NodeBuilderImpl_cloneBindingName(receiver, name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.cloneBindingName","kind":"method","status":"implemented","sigHash":"fdf2f13ce73bd568102dfec22c507d49638a1adfe9e956280854d1727b2a8836","bodyHash":"bab1046dea626256b300d74e2d33907f7bf997d8e65566e118301546e2f5fb49"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) cloneBindingName(node *ast.Node) *ast.Node {
 * 	if ast.IsComputedPropertyName(node) && b.ch.isLateBindableName(node) {
 * 		b.trackComputedName(node.Expression(), b.ctx.enclosingDeclaration)
 * 	}
 * 
 * 	visited := b.cloneBindingNameVisitor.VisitEachChild(node)
 * 
 * 	if ast.IsBindingElement(visited) {
 * 		bindingElement := visited.AsBindingElement()
 * 		visited = b.f.UpdateBindingElement(
 * 			bindingElement,
 * 			bindingElement.DotDotDotToken,
 * 			bindingElement.PropertyName,
 * 			bindingElement.Name(),
 * 			nil, // remove initializer
 * 		)
 * 	}
 * 
 * 	if !ast.NodeIsSynthesized(visited) {
 * 		visited = b.f.DeepCloneNode(visited)
 * 	}
 * 
 * 	b.e.SetEmitFlags(visited, printer.EFSingleLine|printer.EFNoAsciiEscaping)
 * 	return visited
 * }
 */
export function NodeBuilderImpl_cloneBindingName(receiver: GoPtr<NodeBuilderImpl>, node: GoPtr<Node>): GoPtr<Node> {
  if (IsComputedPropertyName(node) && Checker_isLateBindableName(receiver!.ch, node)) {
    NodeBuilderImpl_trackComputedName(receiver, Node_Expression(node), receiver!.ctx!.enclosingDeclaration);
  }
  let visited = NodeVisitor_VisitEachChild(receiver!.cloneBindingNameVisitor as unknown as GoPtr<AstNodeVisitor>, node);
  if (IsBindingElement(visited)) {
    const bindingElement = AsBindingElement(visited);
    visited = NodeFactory_UpdateBindingElement(
      receiver!.f,
      bindingElement,
      bindingElement!.DotDotDotToken,
      bindingElement!.PropertyName,
      Node_Name(visited) as GoPtr<BindingName>,
      undefined,
    );
  }
  if (!NodeIsSynthesized(visited)) {
    visited = NodeFactory_DeepCloneNode(receiver!.f, visited);
  }
  EmitContext_SetEmitFlags(receiver!.e, visited, EFSingleLine | EFNoAsciiEscaping);
  return visited;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.serializeTypeForExpression","kind":"method","status":"implemented","sigHash":"34bf1600cfe0d79be17244399da1b476a9169b0ad1e377e8cec3a22386e758f7","bodyHash":"4167f4bb8233018a549f2c814d0de60e37af7fcd62a5d350805857cb0374d881"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) serializeTypeForExpression(expr *ast.Node) *ast.Node {
 * 	// !!! TODO: shim, add node reuse
 * 	t := b.ch.instantiateType(b.ch.getWidenedType(b.ch.getRegularTypeOfExpression(expr)), b.ctx.mapper)
 * 	return b.typeToTypeNode(t)
 * }
 */
export function NodeBuilderImpl_serializeTypeForExpression(receiver: GoPtr<NodeBuilderImpl>, expr: GoPtr<Node>): GoPtr<Node> {
  // !!! TODO: shim, add node reuse
  const t = Checker_instantiateType(receiver!.ch, Checker_getWidenedType(receiver!.ch, Checker_getRegularTypeOfExpression(receiver!.ch, expr)), receiver!.ctx!.mapper);
  return NodeBuilderImpl_typeToTypeNode(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.serializeInferredReturnTypeForSignature","kind":"method","status":"implemented","sigHash":"6a09ab82e719078c46afc6c4a376800493e3e2b5788622aa378b7ac2fd3af1e8","bodyHash":"278a43732f0a543ff1561f13aeee7262c62b106179167d5ee4ebb410054c5b52"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) serializeInferredReturnTypeForSignature(signature *Signature, returnType *Type) *ast.Node {
 * 	oldSuppressReportInferenceFallback := b.ctx.suppressReportInferenceFallback
 * 	b.ctx.suppressReportInferenceFallback = true
 * 	typePredicate := b.ch.getTypePredicateOfSignature(signature)
 * 	var returnTypeNode *ast.Node
 * 	if typePredicate != nil {
 * 		var predicate *TypePredicate
 * 		if b.ctx.mapper != nil {
 * 			predicate = b.ch.instantiateTypePredicate(typePredicate, b.ctx.mapper)
 * 		} else {
 * 			predicate = typePredicate
 * 		}
 * 		returnTypeNode = b.typePredicateToTypePredicateNodeHelper(predicate)
 * 	} else {
 * 		returnTypeNode = b.typeToTypeNode(returnType)
 * 	}
 * 	b.ctx.suppressReportInferenceFallback = oldSuppressReportInferenceFallback
 * 	return returnTypeNode
 * }
 */
export function NodeBuilderImpl_serializeInferredReturnTypeForSignature(receiver: GoPtr<NodeBuilderImpl>, signature: GoPtr<Signature>, returnType: GoPtr<Type>): GoPtr<Node> {
  const oldSuppressReportInferenceFallback = receiver!.ctx!.suppressReportInferenceFallback;
  receiver!.ctx!.suppressReportInferenceFallback = true;
  const typePredicate = Checker_getTypePredicateOfSignature(receiver!.ch, signature);
  let returnTypeNode: GoPtr<Node>;
  if (typePredicate !== undefined) {
    const predicate = receiver!.ctx!.mapper !== undefined
      ? Checker_instantiateTypePredicate(receiver!.ch, typePredicate, receiver!.ctx!.mapper)
      : typePredicate;
    returnTypeNode = NodeBuilderImpl_typePredicateToTypePredicateNodeHelper(receiver, predicate);
  } else {
    returnTypeNode = NodeBuilderImpl_typeToTypeNode(receiver, returnType);
  }
  receiver!.ctx!.suppressReportInferenceFallback = oldSuppressReportInferenceFallback;
  return returnTypeNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.typePredicateToTypePredicateNodeHelper","kind":"method","status":"implemented","sigHash":"d52dde89c745ce63ca8936bb376dbd1db0989d92845625cb93181c2684d5b682","bodyHash":"2852df3f11b8fcada90b5e67698921c8893866cd97789c4417eb5f210936a17f"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) typePredicateToTypePredicateNodeHelper(typePredicate *TypePredicate) *ast.Node {
 * 	var assertsModifier *ast.Node
 * 	if typePredicate.kind == TypePredicateKindAssertsThis || typePredicate.kind == TypePredicateKindAssertsIdentifier {
 * 		assertsModifier = b.f.NewToken(ast.KindAssertsKeyword)
 * 	} else {
 * 		assertsModifier = nil
 * 	}
 * 	var parameterName *ast.Node
 * 	if typePredicate.kind == TypePredicateKindIdentifier || typePredicate.kind == TypePredicateKindAssertsIdentifier {
 * 		parameterName = b.newIdentifier(typePredicate.parameterName, nil /*symbol* /)
 * 		b.e.SetEmitFlags(parameterName, printer.EFNoAsciiEscaping)
 * 	} else {
 * 		parameterName = b.f.NewThisTypeNode()
 * 	}
 * 	var typeNode *ast.Node
 * 	if typePredicate.t != nil {
 * 		typeNode = b.typeToTypeNode(typePredicate.t)
 * 	}
 * 	return b.f.NewTypePredicateNode(assertsModifier, parameterName, typeNode)
 * }
 */
export function NodeBuilderImpl_typePredicateToTypePredicateNodeHelper(receiver: GoPtr<NodeBuilderImpl>, typePredicate: GoPtr<TypePredicate>): GoPtr<Node> {
  const assertsModifier = (typePredicate!.kind === TypePredicateKindAssertsThis || typePredicate!.kind === TypePredicateKindAssertsIdentifier)
    ? NewToken(receiver!.f, KindAssertsKeyword)
    : undefined;
  let parameterName: GoPtr<Node>;
  if (typePredicate!.kind === TypePredicateKindIdentifier || typePredicate!.kind === TypePredicateKindAssertsIdentifier) {
    parameterName = NodeBuilderImpl_newIdentifier(receiver, typePredicate!.parameterName, undefined);
    EmitContext_SetEmitFlags(receiver!.e, parameterName, EFNoAsciiEscaping);
  } else {
    parameterName = NewThisTypeNode(receiver!.f);
  }
  const typeNode = typePredicate!.t !== undefined ? NodeBuilderImpl_typeToTypeNode(receiver, typePredicate!.t) : undefined;
  return NewTypePredicateNode(receiver!.f, assertsModifier as never, parameterName as never, typeNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::type::SignatureToSignatureDeclarationOptions","kind":"type","status":"implemented","sigHash":"062270961a75adbd8d8730d70e3a9a2acbc230429e8ac14cc197eeb9fab32637","bodyHash":"08e505bebf8246d2835b7402a13e98deb8cd423c8e3d8583ab85a30654025632"}
 *
 * Go source:
 * SignatureToSignatureDeclarationOptions struct {
 * 	modifiers     []*ast.Node
 * 	name          *ast.PropertyName
 * 	questionToken *ast.Node
 * }
 */
export interface SignatureToSignatureDeclarationOptions {
  modifiers: GoSlice<GoPtr<Node>>;
  name: GoPtr<PropertyName>;
  questionToken: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.signatureToSignatureDeclarationHelper","kind":"method","status":"implemented","sigHash":"54f5d2e76ec9e9be664e33675829c85912de62a9bc617473328534583db7cd03","bodyHash":"35319c1886cddfcf506858be52d465d004556abf73beeb6457f6e2272523d500"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) signatureToSignatureDeclarationHelper(signature *Signature, kind ast.Kind, options *SignatureToSignatureDeclarationOptions) *ast.Node {
 * 	var typeParameters []*ast.Node
 *
 * 	expandedParams, cleanup := b.enterSignatureScope(signature)
 * 	b.ctx.approximateLength += 3
 * 	// Usually a signature contributes a few more characters than this, but 3 is the minimum
 * 
 * 	if b.ctx.flags&nodebuilder.FlagsWriteTypeArgumentsOfSignature != 0 && signature.target != nil && signature.mapper != nil && len(signature.target.typeParameters) != 0 {
 * 		for _, parameter := range signature.target.typeParameters {
 * 			typeParameters = append(typeParameters, b.typeToTypeNode(b.ch.instantiateType(parameter, signature.mapper)))
 * 		}
 * 	} else {
 * 		for _, parameter := range signature.typeParameters {
 * 			typeParameters = append(typeParameters, b.typeParameterToDeclaration(parameter))
 * 		}
 * 	}
 * 
 * 	restoreFlags := b.saveRestoreFlags()
 * 	b.ctx.flags &^= nodebuilder.FlagsSuppressAnyReturnType
 * 	// If the expanded parameter list had a variadic in a non-trailing position, don't expand it
 * 	parameters := core.Map(core.IfElse(core.Some(expandedParams, func(p *ast.Symbol) bool {
 * 		return p != expandedParams[len(expandedParams)-1] && p.CheckFlags&ast.CheckFlagsRestParameter != 0
 * 	}), signature.parameters, expandedParams), func(parameter *ast.Symbol) *ast.Node {
 * 		return b.symbolToParameterDeclaration(parameter, kind == ast.KindConstructor)
 * 	})
 * 	var thisParameter *ast.Node
 * 	if b.ctx.flags&nodebuilder.FlagsOmitThisParameter != 0 {
 * 		thisParameter = nil
 * 	} else {
 * 		thisParameter = b.tryGetThisParameterDeclaration(signature)
 * 	}
 * 	if thisParameter != nil {
 * 		parameters = append([]*ast.Node{thisParameter}, parameters...)
 * 	}
 * 	restoreFlags()
 * 
 * 	returnTypeNode := b.serializeReturnTypeForSignature(signature, true)
 * 
 * 	var modifiers []*ast.Node
 * 	if options != nil {
 * 		modifiers = options.modifiers
 * 	}
 * 	if (kind == ast.KindConstructorType) && signature.flags&SignatureFlagsAbstract != 0 {
 * 		flags := ast.ModifiersToFlags(modifiers)
 * 		modifiers = ast.CreateModifiersFromModifierFlags(flags|ast.ModifierFlagsAbstract, b.f.NewModifier)
 * 	}
 * 
 * 	paramList := b.f.NewNodeList(parameters)
 * 	var typeParamList *ast.NodeList
 * 	if len(typeParameters) != 0 {
 * 		typeParamList = b.f.NewNodeList(typeParameters)
 * 	}
 * 	var modifierList *ast.ModifierList
 * 	if len(modifiers) > 0 {
 * 		modifierList = b.f.NewModifierList(modifiers)
 * 	}
 * 	var name *ast.Node
 * 	if options != nil {
 * 		name = options.name
 * 	}
 * 	if name == nil {
 * 		name = b.f.NewIdentifier("")
 * 	}
 * 
 * 	var node *ast.Node
 * 	switch {
 * 	case kind == ast.KindCallSignature:
 * 		node = b.f.NewCallSignatureDeclaration(typeParamList, paramList, returnTypeNode)
 * 	case kind == ast.KindConstructSignature:
 * 		node = b.f.NewConstructSignatureDeclaration(typeParamList, paramList, returnTypeNode)
 * 	case kind == ast.KindMethodSignature:
 * 		var questionToken *ast.Node
 * 		if options != nil {
 * 			questionToken = options.questionToken
 * 		}
 * 		node = b.f.NewMethodSignatureDeclaration(modifierList, name, questionToken, typeParamList, paramList, returnTypeNode)
 * 	case kind == ast.KindMethodDeclaration:
 * 		node = b.f.NewMethodDeclaration(modifierList, nil /*asteriskToken* /, name, nil /*questionToken* /, typeParamList, paramList, returnTypeNode, nil /*fullSignature* /, nil /*body* /)
 * 	case kind == ast.KindConstructor:
 * 		node = b.f.NewConstructorDeclaration(modifierList, nil /*typeParamList* /, paramList, nil /*returnTypeNode* /, nil /*fullSignature* /, nil /*body* /)
 * 	case kind == ast.KindGetAccessor:
 * 		node = b.f.NewGetAccessorDeclaration(modifierList, name, nil /*typeParamList* /, paramList, returnTypeNode, nil /*fullSignature* /, nil /*body* /)
 * 	case kind == ast.KindSetAccessor:
 * 		node = b.f.NewSetAccessorDeclaration(modifierList, name, nil /*typeParamList* /, paramList, nil /*returnTypeNode* /, nil /*fullSignature* /, nil /*body* /)
 * 	case kind == ast.KindIndexSignature:
 * 		node = b.f.NewIndexSignatureDeclaration(modifierList, paramList, returnTypeNode)
 * 	// !!! JSDoc Support
 * 	// case kind == ast.KindJSDocFunctionType:
 * 	// 	node = b.f.NewJSDocFunctionType(parameters, returnTypeNode)
 * 	case kind == ast.KindFunctionType:
 * 		if returnTypeNode == nil {
 * 			returnTypeNode = b.f.NewTypeReferenceNode(b.f.NewIdentifier(""), nil)
 * 		}
 * 		node = b.f.NewFunctionTypeNode(typeParamList, paramList, returnTypeNode)
 * 	case kind == ast.KindConstructorType:
 * 		if returnTypeNode == nil {
 * 			returnTypeNode = b.f.NewTypeReferenceNode(b.f.NewIdentifier(""), nil)
 * 		}
 * 		node = b.f.NewConstructorTypeNode(modifierList, typeParamList, paramList, returnTypeNode)
 * 	case kind == ast.KindFunctionDeclaration:
 * 		// TODO: assert name is Identifier
 * 		node = b.f.NewFunctionDeclaration(modifierList, nil /*asteriskToken* /, name, typeParamList, paramList, returnTypeNode, nil /*fullSignature* /, nil /*body* /)
 * 	case kind == ast.KindFunctionExpression:
 * 		// TODO: assert name is Identifier
 * 		node = b.f.NewFunctionExpression(modifierList, nil /*asteriskToken* /, name, typeParamList, paramList, returnTypeNode, nil /*fullSignature* /, b.f.NewBlock(b.f.NewNodeList([]*ast.Node{}), false))
 * 	case kind == ast.KindArrowFunction:
 * 		node = b.f.NewArrowFunction(modifierList, typeParamList, paramList, returnTypeNode, nil /*fullSignature* /, nil /*equalsGreaterThanToken* /, b.f.NewBlock(b.f.NewNodeList([]*ast.Node{}), false))
 * 	default:
 * 		panic("Unhandled kind in signatureToSignatureDeclarationHelper")
 * 	}
 * 
 * 	// !!! TODO: Smuggle type arguments of signatures out for quickinfo
 * 	// if typeArguments != nil {
 * 	// 	node.TypeArguments = b.f.NewNodeList(typeArguments)
 * 	// }
 * 
 * 	cleanup()
 * 	return node
 * }
 */
export function NodeBuilderImpl_signatureToSignatureDeclarationHelper(receiver: GoPtr<NodeBuilderImpl>, signature: GoPtr<Signature>, kind: Kind, options: GoPtr<SignatureToSignatureDeclarationOptions>): GoPtr<Node> {
  const typeParameters: GoSlice<GoPtr<Node>> = [];
  const [expandedParams, cleanup] = NodeBuilderImpl_enterSignatureScope(receiver, signature);
  const signatureParameters = signature!.parameters ?? [];
  const signatureTypeParameters = signature!.typeParameters ?? [];
  receiver!.ctx!.approximateLength += 3;
  if ((receiver!.ctx!.flags & FlagsWriteTypeArgumentsOfSignature) !== 0 && signature!.target !== undefined && signature!.mapper !== undefined && signature!.target!.typeParameters.length !== 0) {
    for (const parameter of signature!.target!.typeParameters) {
      typeParameters.push(NodeBuilderImpl_typeToTypeNode(receiver, Checker_instantiateType(receiver!.ch, parameter, signature!.mapper)));
    }
  } else {
    for (const parameter of signatureTypeParameters) {
      typeParameters.push(NodeBuilderImpl_typeParameterToDeclaration(receiver, parameter));
    }
  }
  const restoreFlags = NodeBuilderImpl_saveRestoreFlags(receiver);
  receiver!.ctx!.flags &= ~FlagsSuppressAnyReturnType;
  const parameterSource = Some(expandedParams, (p) => p !== expandedParams[expandedParams.length - 1] && (p!.CheckFlags & CheckFlagsRestParameter) !== 0)
    ? signatureParameters
    : expandedParams;
  let parameters: GoSlice<GoPtr<Node>> = parameterSource.map((parameter) => NodeBuilderImpl_symbolToParameterDeclaration(receiver, parameter, kind === KindConstructor));
  const thisParameter = (receiver!.ctx!.flags & FlagsOmitThisParameter) !== 0 ? undefined : NodeBuilderImpl_tryGetThisParameterDeclaration(receiver, signature);
  if (thisParameter !== undefined) {
    parameters = [thisParameter, ...parameters];
  }
  restoreFlags();
  let returnTypeNode = NodeBuilderImpl_serializeReturnTypeForSignature(receiver, signature, true);
  let modifiers: GoSlice<GoPtr<Node>> = options !== undefined ? options!.modifiers : undefined!;
  if (kind === KindConstructorType && (signature!.flags & SignatureFlagsAbstract) !== 0) {
    const flags = ModifiersToFlags(modifiers ?? []);
    modifiers = CreateModifiersFromModifierFlags((flags | ModifierFlagsAbstract) >>> 0, (modifierKind) => NodeFactory_NewModifier(receiver!.f, modifierKind));
  }
  const paramList = NodeFactory_NewNodeList(receiver!.f, parameters);
  const typeParamList = typeParameters.length !== 0 ? NodeFactory_NewNodeList(receiver!.f, typeParameters) : undefined;
  const modifierList = (modifiers ?? []).length > 0 ? NodeFactory_NewModifierList(receiver!.f, modifiers) : undefined;
  const name = options !== undefined && options!.name !== undefined ? options!.name : NewIdentifier(receiver!.f, "");
  let node: GoPtr<Node>;
  switch (kind) {
    case KindCallSignature:
      node = NewCallSignatureDeclaration(receiver!.f, typeParamList as never, paramList as never, returnTypeNode);
      break;
    case KindConstructSignature:
      node = NewConstructSignatureDeclaration(receiver!.f, typeParamList as never, paramList as never, returnTypeNode);
      break;
    case KindMethodSignature:
      node = NewMethodSignatureDeclaration(receiver!.f, modifierList as never, name as never, options !== undefined ? options!.questionToken : undefined, typeParamList as never, paramList as never, returnTypeNode);
      break;
    case KindMethodDeclaration:
      node = NewMethodDeclaration(receiver!.f, modifierList as never, undefined, name as never, undefined, typeParamList as never, paramList as never, returnTypeNode, undefined, undefined);
      break;
    case KindConstructor:
      node = NewConstructorDeclaration(receiver!.f, modifierList as never, undefined, paramList as never, undefined, undefined, undefined);
      break;
    case KindGetAccessor:
      node = NewGetAccessorDeclaration(receiver!.f, modifierList as never, name as never, undefined, paramList as never, returnTypeNode, undefined, undefined);
      break;
    case KindSetAccessor:
      node = NewSetAccessorDeclaration(receiver!.f, modifierList as never, name as never, undefined, paramList as never, undefined, undefined, undefined);
      break;
    case KindIndexSignature:
      node = NewIndexSignatureDeclaration(receiver!.f, modifierList as never, paramList as never, returnTypeNode);
      break;
    case KindFunctionType:
      if (returnTypeNode === undefined) {
        returnTypeNode = NewTypeReferenceNode(receiver!.f, NewIdentifier(receiver!.f, ""), undefined);
      }
      node = NewFunctionTypeNode(receiver!.f, typeParamList as never, paramList as never, returnTypeNode);
      break;
    case KindConstructorType:
      if (returnTypeNode === undefined) {
        returnTypeNode = NewTypeReferenceNode(receiver!.f, NewIdentifier(receiver!.f, ""), undefined);
      }
      node = NewConstructorTypeNode(receiver!.f, modifierList as never, typeParamList as never, paramList as never, returnTypeNode);
      break;
    case KindFunctionDeclaration:
      node = NewFunctionDeclaration(receiver!.f, modifierList as never, undefined, name as never, typeParamList as never, paramList as never, returnTypeNode, undefined, undefined);
      break;
    case KindFunctionExpression:
      node = NewFunctionExpression(receiver!.f, modifierList as never, undefined, name as never, typeParamList as never, paramList as never, returnTypeNode, undefined, NewBlock(receiver!.f, NodeFactory_NewNodeList(receiver!.f, []), false) as never);
      break;
    case KindArrowFunction:
      node = NewArrowFunction(receiver!.f, modifierList as never, typeParamList as never, paramList as never, returnTypeNode, undefined, undefined, NewBlock(receiver!.f, NodeFactory_NewNodeList(receiver!.f, []), false) as never);
      break;
    default:
      throw new globalThis.Error("Unhandled kind in signatureToSignatureDeclarationHelper");
  }
  cleanup();
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::Checker.getExpandedParameters","kind":"method","status":"implemented","sigHash":"445d61ebc8f61cf773eb825ce8a50af6065b9a63eb2f819395c68bd78621cfd3","bodyHash":"5015e85ef6bae014f29bcd1786dc1eef5e438d4c2b01f80ee713327449c6dd8f"}
 *
 * Go source:
 * func (c *Checker) getExpandedParameters(sig *Signature, skipUnionExpanding bool) [][]*ast.Symbol {
 * 	if signatureHasRestParameter(sig) {
 * 		restIndex := len(sig.parameters) - 1
 * 		restSymbol := sig.parameters[restIndex]
 * 		restType := c.getTypeOfSymbol(restSymbol)
 * 		getUniqAssociatedNamesFromTupleType := func(t *Type, restSymbol *ast.Symbol) []string {
 * 			names := core.MapIndex(t.Target().AsTupleType().elementInfos, func(info TupleElementInfo, i int) string {
 * 				return c.getTupleElementLabel(info, restSymbol, i)
 * 			})
 * 			if len(names) > 0 {
 * 				duplicates := []int{}
 * 				uniqueNames := make(map[string]bool)
 * 				for i, name := range names {
 * 					_, ok := uniqueNames[name]
 * 					if ok {
 * 						duplicates = append(duplicates, i)
 * 					} else {
 * 						uniqueNames[name] = true
 * 					}
 * 				}
 * 				counters := make(map[string]int)
 * 				for _, i := range duplicates {
 * 					counter, ok := counters[names[i]]
 * 					if !ok {
 * 						counter = 1
 * 					}
 * 					var name string
 * 					for true {
 * 						name = fmt.Sprintf("%s_%d", names[i], counter)
 * 						_, ok := uniqueNames[name]
 * 						if ok {
 * 							counter++
 * 							continue
 * 						} else {
 * 							uniqueNames[name] = true
 * 							break
 * 						}
 * 					}
 * 					names[i] = name
 * 					counters[names[i]] = counter + 1
 * 				}
 * 			}
 * 			return names
 * 		}
 * 		expandSignatureParametersWithTupleMembers := func(restType *Type, restIndex int, restSymbol *ast.Symbol) []*ast.Symbol {
 * 			elementTypes := c.getTypeArguments(restType)
 * 			associatedNames := getUniqAssociatedNamesFromTupleType(restType, restSymbol)
 * 			restParams := core.MapIndex(elementTypes, func(t *Type, i int) *ast.Symbol {
 * 				// Lookup the label from the individual tuple passed in before falling back to the signature `rest` parameter name
 * 				// TODO: getTupleElementLabel can no longer fail, investigate if this lack of falliability meaningfully changes output
 * 				// var name *string
 * 				// if associatedNames != nil && associatedNames[i] != nil {
 * 				// 	name = associatedNames[i]
 * 				// } else {
 * 				// 	name = c.getParameterNameAtPosition(sig, restIndex+i, restType)
 * 				// }
 * 				name := associatedNames[i]
 * 				flags := restType.Target().AsTupleType().elementInfos[i].flags
 * 				var checkFlags ast.CheckFlags
 * 				switch {
 * 				case flags&ElementFlagsVariable != 0:
 * 					checkFlags = ast.CheckFlagsRestParameter
 * 				case flags&ElementFlagsOptional != 0:
 * 					checkFlags = ast.CheckFlagsOptionalParameter
 * 				}
 * 				symbol := c.newSymbolEx(ast.SymbolFlagsFunctionScopedVariable, name, checkFlags)
 * 				links := c.valueSymbolLinks.Get(symbol)
 * 				if flags&ElementFlagsRest != 0 {
 * 					links.resolvedType = c.createArrayType(t)
 * 				} else {
 * 					links.resolvedType = t
 * 				}
 * 				return symbol
 * 			})
 * 			return core.Concatenate(sig.parameters[0:restIndex], restParams)
 * 		}
 * 
 * 		if isTupleType(restType) {
 * 			return [][]*ast.Symbol{expandSignatureParametersWithTupleMembers(restType, restIndex, restSymbol)}
 * 		} else if !skipUnionExpanding && restType.flags&TypeFlagsUnion != 0 && core.Every(restType.AsUnionType().types, isTupleType) {
 * 			return core.Map(restType.AsUnionType().types, func(t *Type) []*ast.Symbol {
 * 				return expandSignatureParametersWithTupleMembers(t, restIndex, restSymbol)
 * 			})
 * 		}
 * 	}
 * 	return [][]*ast.Symbol{sig.parameters}
 * }
 */
export function Checker_getExpandedParameters(receiver: GoPtr<Checker>, sig: GoPtr<Signature>, skipUnionExpanding: bool): GoSlice<GoSlice<GoPtr<Symbol>>> {
  if (signatureHasRestParameter(sig)) {
    const restIndex = sig!.parameters.length - 1;
    const restSymbol = sig!.parameters[restIndex];
    const restType = Checker_getTypeOfSymbol(receiver, restSymbol);
    const getUniqAssociatedNamesFromTupleType = (t: GoPtr<Type>, tupleRestSymbol: GoPtr<Symbol>): GoSlice<string> => {
      const names = Type_Target(t) !== undefined
        ? Type_AsTupleType(Type_Target(t))!.elementInfos.map((info, index) => Checker_getTupleElementLabel(receiver, info, tupleRestSymbol, index))
        : [];
      if (names.length > 0) {
        const duplicates: GoSlice<int> = [];
        const uniqueNames = new globalThis.Map<string, bool>();
        for (let i = 0; i < names.length; i++) {
          if (uniqueNames.has(names[i]!)) {
            duplicates.push(i);
          } else {
            uniqueNames.set(names[i]!, true);
          }
        }
        const counters = new globalThis.Map<string, int>();
        for (const i of duplicates) {
          let counter = counters.get(names[i]!) ?? 1;
          let name = "";
          while (true) {
            name = `${names[i]!}_${counter}`;
            if (uniqueNames.has(name)) {
              counter++;
              continue;
            }
            uniqueNames.set(name, true);
            break;
          }
          names[i] = name;
          counters.set(names[i]!, counter + 1);
        }
      }
      return names;
    };
    const expandSignatureParametersWithTupleMembers = (tupleRestType: GoPtr<Type>, tupleRestIndex: int, tupleRestSymbol: GoPtr<Symbol>): GoSlice<GoPtr<Symbol>> => {
      const elementTypes = Checker_getTypeArguments(receiver, tupleRestType);
      const associatedNames = getUniqAssociatedNamesFromTupleType(tupleRestType, tupleRestSymbol);
      const targetTuple = Type_AsTupleType(Type_Target(tupleRestType))!;
      const restParams = elementTypes.map((type_, index) => {
        const name = associatedNames[index]!;
        const flags = targetTuple.elementInfos[index]!.flags;
        let checkFlags: CheckFlags = CheckFlagsNone;
        if ((flags & ElementFlagsVariable) !== 0) {
          checkFlags = CheckFlagsRestParameter;
        } else if ((flags & ElementFlagsOptional) !== 0) {
          checkFlags = CheckFlagsOptionalParameter;
        }
        const symbol_ = Checker_newSymbolEx(receiver, SymbolFlagsFunctionScopedVariable, name, checkFlags);
        const links = LinkStore_Get(receiver!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, symbol_);
        links!.resolvedType = (flags & ElementFlagsRest) !== 0 ? Checker_createArrayType(receiver, type_) : type_;
        return symbol_;
      });
      return [...sig!.parameters.slice(0, tupleRestIndex), ...restParams];
    };
    if (isTupleType(restType)) {
      return [expandSignatureParametersWithTupleMembers(restType, restIndex, restSymbol)];
    }
    if (!skipUnionExpanding && (restType!.flags & TypeFlagsUnion) !== 0 && Every(Type_Types(restType), isTupleType)) {
      return Type_Types(restType).map((type_) => expandSignatureParametersWithTupleMembers(type_, restIndex, restSymbol));
    }
  }
  return [sig!.parameters];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.tryGetThisParameterDeclaration","kind":"method","status":"implemented","sigHash":"dbd4f1cd5d64153b6c81d84247371f2303d66ef3dabad8b7fc8a9f5e675fe064","bodyHash":"b50457ce098fa13e26fdbe0bcacf837925a716c700981ca63c125501003faee4"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) tryGetThisParameterDeclaration(signature *Signature) *ast.Node {
 * 	if signature.thisParameter != nil {
 * 		return b.symbolToParameterDeclaration(signature.thisParameter, false)
 * 	}
 * 	if signature.declaration != nil && ast.IsInJSFile(signature.declaration) {
 * 		// !!! JSDoc Support
 * 		// thisTag := getJSDocThisTag(signature.declaration)
 * 		// if (thisTag && thisTag.typeExpression) {
 * 		// 	return factory.createParameterDeclaration(
 * 		// 		/*modifiers* / undefined,
 * 		// 		/*dotDotDotToken* / undefined,
 * 		// 		"this",
 * 		// 		/*questionToken* / undefined,
 * 		// 		typeToTypeNodeHelper(getTypeFromTypeNode(context, thisTag.typeExpression), context),
 * 		// 	);
 * 		// }
 * 	}
 * 	return nil
 * }
 */
export function NodeBuilderImpl_tryGetThisParameterDeclaration(receiver: GoPtr<NodeBuilderImpl>, signature: GoPtr<Signature>): GoPtr<Node> {
  if (signature!.thisParameter !== undefined) {
    return NodeBuilderImpl_symbolToParameterDeclaration(receiver, signature!.thisParameter, false as bool);
  }
  // !!! JSDoc Support not implemented
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.serializeReturnTypeForSignature","kind":"method","status":"implemented","sigHash":"f05f188513e65eb9af078058b7e5b434e03b9b69ea9284469083dc62b873549b","bodyHash":"c9e0242de6e3ea11aa6a63c75d670d87ace2d85e3f259536aa1ae9ae0e2418b4"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) serializeReturnTypeForSignature(signature *Signature, tryReuse bool) *ast.Node {
 * 	suppressAny := b.ctx.flags&nodebuilder.FlagsSuppressAnyReturnType != 0
 * 	restoreFlags := b.saveRestoreFlags()
 * 	if suppressAny {
 * 		b.ctx.flags &^= nodebuilder.FlagsSuppressAnyReturnType // suppress only toplevel `any`s
 * 	}
 * 	var returnTypeNode *ast.Node
 * 
 * 	var returnType *Type
 * 	if signature.declaration != nil && !ast.NodeIsSynthesized(signature.declaration) {
 * 		symbol := b.ch.getSymbolOfDeclaration(signature.declaration)
 * 		var ok bool
 * 		returnType, ok = b.ctx.enclosingSymbolTypes[ast.GetSymbolId(symbol)]
 * 		if !ok || returnType == nil {
 * 			returnType = b.ch.instantiateType(b.ch.getReturnTypeOfSignature(signature), b.ctx.mapper)
 * 		}
 * 	} else {
 * 		returnType = b.ch.getReturnTypeOfSignature(signature)
 * 	}
 * 	if !(suppressAny && IsTypeAny(returnType)) {
 * 		if !b.isActivelyExpanding() && tryReuse && b.ctx.enclosingDeclaration != nil && signature.declaration != nil && !ast.NodeIsSynthesized(signature.declaration) {
 * 			declarationSymbol := b.ch.getSymbolOfDeclaration(signature.declaration)
 * 			restore := b.addSymbolTypeToContext(declarationSymbol, returnType)
 * 			pt := b.pc.GetReturnTypeOfSignature(signature.declaration)
 * 			if b.pseudoTypeEquivalentToType(pt, returnType, false, !b.ctx.suppressReportInferenceFallback) {
 * 				// Also verify the pseudo type captures any inferred type predicate, not just the boolean return type.
 * 				// The pseudochecker is unaware of inferred type predicates, so it produces boolean where
 * 				// the checker infers e.g. `x is string`.
 * 				typePredicate := b.ch.getTypePredicateOfSignature(signature)
 * 				if typePredicate != nil && !b.pseudoReturnTypeMatchesPredicate(pt, typePredicate) {
 * 					if !b.ctx.suppressReportInferenceFallback {
 * 						b.ctx.tracker.ReportInferenceFallback(signature.declaration)
 * 					}
 * 					pt = nil
 * 				}
 * 				if pt != nil {
 * 					// !!! TODO: If annotated type node is a reference with insufficient type arguments, we should still fall back to type serialization
 * 					// see: canReuseTypeNodeAnnotation in strada for context
 * 					returnTypeNode = b.pseudoTypeToNodeWithCheckerFallback(pt, returnType)
 * 				}
 * 			}
 * 			restore()
 * 		}
 * 		if returnTypeNode == nil {
 * 			returnTypeNode = b.serializeInferredReturnTypeForSignature(signature, returnType)
 * 		}
 * 	}
 * 
 * 	if returnTypeNode == nil && !suppressAny {
 * 		returnTypeNode = b.f.NewKeywordTypeNode(ast.KindAnyKeyword)
 * 	}
 * 	restoreFlags()
 * 	return returnTypeNode
 * }
 */
export function NodeBuilderImpl_serializeReturnTypeForSignature(receiver: GoPtr<NodeBuilderImpl>, signature: GoPtr<Signature>, tryReuse: bool): GoPtr<Node> {
  const suppressAny = (receiver!.ctx!.flags & FlagsSuppressAnyReturnType) !== 0;
  const restoreFlags = NodeBuilderImpl_saveRestoreFlags(receiver);
  if (suppressAny) {
    receiver!.ctx!.flags &= ~FlagsSuppressAnyReturnType;
  }
  let returnTypeNode: GoPtr<Node>;
  let returnType: GoPtr<Type>;
  if (signature!.declaration !== undefined && !NodeIsSynthesized(signature!.declaration)) {
    const symbol_ = Checker_getSymbolOfDeclaration(receiver!.ch, signature!.declaration);
    returnType = receiver!.ctx!.enclosingSymbolTypes.get(GetSymbolId(symbol_));
    if (returnType === undefined) {
      returnType = Checker_instantiateType(receiver!.ch, Checker_getReturnTypeOfSignature(receiver!.ch, signature), receiver!.ctx!.mapper);
    }
  } else {
    returnType = Checker_getReturnTypeOfSignature(receiver!.ch, signature);
  }
  if (!(suppressAny && IsTypeAny(returnType))) {
    if (!NodeBuilderImpl_isActivelyExpanding(receiver) && tryReuse && receiver!.ctx!.enclosingDeclaration !== undefined && signature!.declaration !== undefined && !NodeIsSynthesized(signature!.declaration)) {
      const declarationSymbol = Checker_getSymbolOfDeclaration(receiver!.ch, signature!.declaration);
      const restore = NodeBuilderImpl_addSymbolTypeToContext(receiver, declarationSymbol, returnType);
      let pt = PseudoChecker_GetReturnTypeOfSignature(receiver!.pc, signature!.declaration);
      if (NodeBuilderImpl_pseudoTypeEquivalentToType(receiver, pt, returnType, false as bool, !receiver!.ctx!.suppressReportInferenceFallback)) {
        const typePredicate = Checker_getTypePredicateOfSignature(receiver!.ch, signature);
        if (typePredicate !== undefined && !NodeBuilderImpl_pseudoReturnTypeMatchesPredicate(receiver, pt, typePredicate)) {
          if (!receiver!.ctx!.suppressReportInferenceFallback) {
            receiver!.ctx!.tracker!.ReportInferenceFallback(signature!.declaration);
          }
          pt = undefined;
        }
        if (pt !== undefined) {
          returnTypeNode = NodeBuilderImpl_pseudoTypeToNodeWithCheckerFallback(receiver, pt, returnType);
        }
      }
      restore();
    }
    if (returnTypeNode === undefined) {
      returnTypeNode = NodeBuilderImpl_serializeInferredReturnTypeForSignature(receiver, signature, returnType);
    }
  }
  if (returnTypeNode === undefined && !suppressAny) {
    returnTypeNode = NewKeywordTypeNode(receiver!.f, KindAnyKeyword);
  }
  restoreFlags();
  return returnTypeNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.isTriviallySerializableComputedName","kind":"method","status":"implemented","sigHash":"61ce3aa7e76882aab302040bd3a81935d418227c2cee29101a7b5a029adf9aef","bodyHash":"b3f9c4ca1589275f29194db4c592144328b4001d54c99538e8f4ec24d798c97b"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) isTriviallySerializableComputedName(e *ast.Node) bool {
 * 	shapeGood := e != nil && e.Name() != nil && ast.IsComputedPropertyName(e.Name()) && ast.IsEntityNameExpression(e.Name().Expression())
 * 	if !shapeGood {
 * 		return false
 * 	}
 * 	// TODO: going through emit resolver here is weird. Relayer these APIs.
 * 	return b.ch.GetEmitResolver().isEntityNameVisible(e.Name().Expression(), b.ctx.enclosingDeclaration, false).Accessibility == printer.SymbolAccessibilityAccessible
 * }
 */
export function NodeBuilderImpl_isTriviallySerializableComputedName(receiver: GoPtr<NodeBuilderImpl>, e: GoPtr<Node>): bool {
  const shapeGood = e !== undefined && Node_Name(e) !== undefined && IsComputedPropertyName(Node_Name(e)) && IsEntityNameExpression(Node_Expression(Node_Name(e)));
  if (!shapeGood) {
    return false;
  }
  // TODO: going through emit resolver here is weird. Relayer these APIs.
  return EmitResolver_isEntityNameVisible(Checker_GetEmitResolver(receiver!.ch), Node_Expression(Node_Name(e)), receiver!.ctx!.enclosingDeclaration, false as bool).Accessibility === SymbolAccessibilityAccessible;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.indexInfoToObjectComputedNamesOrSignatureDeclaration","kind":"method","status":"implemented","sigHash":"4c94d20e16103396df21120045ba89362d5c2cfd3e6c538bebad3552b5fb9bc0","bodyHash":"e73a7b8627492b9a3f08110bfba2542f83069b33c8419a7aa353bc43e5b5a828"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) indexInfoToObjectComputedNamesOrSignatureDeclaration(indexInfo *IndexInfo, typeNode *ast.TypeNode) []*ast.Node {
 * 	if len(indexInfo.components) > 0 {
 * 		// Index info is derived from object or class computed property names (plus explicit named members) - we can clone those instead of writing out the result computed index signature
 * 		allComponentComputedNamesSerializable := b.ctx.enclosingDeclaration != nil && core.Every(indexInfo.components, b.isTriviallySerializableComputedName)
 * 		if allComponentComputedNamesSerializable {
 * 			// Only use computed name serialization form if all components are visible and take the `a.b.c` form
 * 			newComponents := core.Filter(indexInfo.components, func(c *ast.Node) bool {
 * 				// skip late bound props that contribute to the index signature - they'll be created by property creation anyway
 * 				return !b.ch.hasLateBindableName(c)
 * 			})
 * 			bailed := false
 * 			results := core.Map(newComponents, func(e *ast.Node) *ast.Node {
 * 				name := b.reuseNode(e.Name())
 * 				if name != nil {
 * 					// Still need to track visibility even if we've already checked it to paint references as used
 * 					b.trackComputedName(e.Name().Expression(), b.ctx.enclosingDeclaration)
 * 					var mods *ast.ModifierList
 * 					if indexInfo.isReadonly {
 * 						mods = b.f.NewModifierList([]*ast.Node{b.f.NewModifier(ast.KindReadonlyKeyword)})
 * 					}
 * 					var postfixToken *ast.Node
 * 					if e.PostfixToken() != nil {
 * 						postfixToken = e.PostfixToken().Clone(b.f)
 * 					}
 * 					var currentTypeNode *ast.TypeNode
 * 					if typeNode != nil {
 * 						currentTypeNode = b.f.DeepCloneNode(typeNode)
 * 					} else {
 * 						currentTypeNode = b.typeToTypeNode(b.ch.getTypeOfSymbol(e.Symbol()))
 * 					}
 * 					sig := b.f.NewPropertySignatureDeclaration(
 * 						mods,
 * 						name,
 * 						postfixToken,
 * 						currentTypeNode,
 * 						nil,
 * 					)
 * 					sig.Loc = e.Loc
 * 					return sig
 * 				}
 * 				bailed = true
 * 				return nil
 * 			})
 * 			if !bailed {
 * 				return results
 * 			}
 * 		}
 * 	}
 * 	return []*ast.Node{b.indexInfoToIndexSignatureDeclarationHelper(indexInfo, typeNode)}
 * }
 */
export function NodeBuilderImpl_indexInfoToObjectComputedNamesOrSignatureDeclaration(receiver: GoPtr<NodeBuilderImpl>, indexInfo: GoPtr<IndexInfo>, typeNode: GoPtr<TypeNode>): GoSlice<GoPtr<Node>> {
  if ((indexInfo!.components ?? []).length > 0) {
    // Index info is derived from object or class computed property names (plus explicit named members) - we can clone those instead of writing out the result computed index signature
    const allComponentComputedNamesSerializable = receiver!.ctx!.enclosingDeclaration !== undefined && Every(indexInfo!.components, (e) => NodeBuilderImpl_isTriviallySerializableComputedName(receiver, e));
    if (allComponentComputedNamesSerializable) {
      // Only use computed name serialization form if all components are visible and take the `a.b.c` form
      const newComponents = Filter(indexInfo!.components, (c) => {
        // skip late bound props that contribute to the index signature - they'll be created by property creation anyway
        return !Checker_hasLateBindableName(receiver!.ch, c);
      });
      let bailed = false;
      const results = CoreMap(newComponents, (e) => {
        const name = NodeBuilderImpl_reuseNode(receiver, Node_Name(e));
        if (name !== undefined) {
          // Still need to track visibility even if we've already checked it to paint references as used
          NodeBuilderImpl_trackComputedName(receiver, Node_Expression(Node_Name(e)), receiver!.ctx!.enclosingDeclaration);
          let mods: GoPtr<ModifierList>;
          if (indexInfo!.isReadonly) {
            mods = NodeFactory_NewModifierList(receiver!.f, [NodeFactory_NewModifier(receiver!.f, KindReadonlyKeyword)]);
          }
          let postfixToken: GoPtr<Node>;
          if (Node_PostfixToken(e) !== undefined) {
            postfixToken = Node_Clone(Node_PostfixToken(e), receiver!.f as unknown as NodeFactoryCoercible);
          }
          let currentTypeNode: GoPtr<TypeNode>;
          if (typeNode !== undefined) {
            currentTypeNode = NodeFactory_DeepCloneNode(receiver!.f, typeNode);
          } else {
            currentTypeNode = NodeBuilderImpl_typeToTypeNode(receiver, Checker_getTypeOfSymbol(receiver!.ch, Node_Symbol(e)));
          }
          const sig = NewPropertySignatureDeclaration(
            receiver!.f,
            mods as GoPtr<ModifierList>,
            name as GoPtr<PropertyName>,
            postfixToken,
            currentTypeNode,
            undefined,
          );
          sig!.Loc = e!.Loc;
          return sig;
        }
        bailed = true;
        return undefined;
      });
      if (!bailed) {
        return results;
      }
    }
  }
  return [NodeBuilderImpl_indexInfoToIndexSignatureDeclarationHelper(receiver, indexInfo, typeNode)];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.indexInfoToIndexSignatureDeclarationHelper","kind":"method","status":"implemented","sigHash":"8ea9817652ce8aa095a17630f1e7a34f96e7762958efa796541a9ea0c0910ac8","bodyHash":"da1ecbca33ebcdcdc89cd4143d0d58a759fbe34504c6a2599556d5d805e3f627"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) indexInfoToIndexSignatureDeclarationHelper(indexInfo *IndexInfo, typeNode *ast.TypeNode) *ast.Node {
 * 	name := getNameFromIndexInfo(indexInfo)
 * 	indexerTypeNode := b.typeToTypeNode(indexInfo.keyType)
 * 
 * 	indexingParameter := b.f.NewParameterDeclaration(nil, nil, b.newIdentifier(name, nil /*symbol* /), nil, indexerTypeNode, nil)
 * 	if typeNode == nil {
 * 		if indexInfo.valueType == nil {
 * 			typeNode = b.f.NewKeywordTypeNode(ast.KindAnyKeyword)
 * 		} else {
 * 			typeNode = b.typeToTypeNode(indexInfo.valueType)
 * 		}
 * 	}
 * 	if indexInfo.valueType == nil && b.ctx.flags&nodebuilder.FlagsAllowEmptyIndexInfoType == 0 {
 * 		b.ctx.encounteredError = true
 * 	}
 * 	b.ctx.approximateLength += len(name) + 4
 * 	var modifiers *ast.ModifierList
 * 	if indexInfo.isReadonly {
 * 		b.ctx.approximateLength += 9
 * 		modifiers = b.f.NewModifierList([]*ast.Node{b.f.NewModifier(ast.KindReadonlyKeyword)})
 * 	}
 * 	return b.f.NewIndexSignatureDeclaration(modifiers, b.f.NewNodeList([]*ast.Node{indexingParameter}), typeNode)
 * }
 */
export function NodeBuilderImpl_indexInfoToIndexSignatureDeclarationHelper(receiver: GoPtr<NodeBuilderImpl>, indexInfo: GoPtr<IndexInfo>, typeNode: GoPtr<TypeNode>): GoPtr<Node> {
  const name = getNameFromIndexInfo(indexInfo);
  const indexerTypeNode = NodeBuilderImpl_typeToTypeNode(receiver, indexInfo!.keyType);
  const indexingParameter = NewParameterDeclaration(receiver!.f, undefined, undefined, NodeBuilderImpl_newIdentifier(receiver, name, undefined) as GoPtr<BindingName>, undefined, indexerTypeNode, undefined);
  let resolvedTypeNode = typeNode;
  if (resolvedTypeNode === undefined) {
    if (indexInfo!.valueType === undefined) {
      resolvedTypeNode = NewKeywordTypeNode(receiver!.f, KindAnyKeyword) as GoPtr<TypeNode>;
    } else {
      resolvedTypeNode = NodeBuilderImpl_typeToTypeNode(receiver, indexInfo!.valueType);
    }
  }
  if (indexInfo!.valueType === undefined && (receiver!.ctx!.flags & FlagsAllowEmptyIndexInfoType) === 0) {
    receiver!.ctx!.encounteredError = true;
  }
  receiver!.ctx!.approximateLength += name.length + 4;
  let modifiers: GoPtr<NodeList>;
  if (indexInfo!.isReadonly) {
    receiver!.ctx!.approximateLength += 9;
    modifiers = NodeFactory_NewModifierList(receiver!.f, [NodeFactory_NewModifier(receiver!.f, KindReadonlyKeyword)]);
  }
  return NewIndexSignatureDeclaration(receiver!.f, modifiers as never, NodeFactory_NewNodeList(receiver!.f, [indexingParameter]), resolvedTypeNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::hasTypeAnnotation","kind":"func","status":"implemented","sigHash":"f0b0aa9194f7f2e3a7588139f0144c89068b5e903395fecdb04d1cc86c78249a","bodyHash":"a413c1b4922091dae74a489e0229b142e9bac62b5040070636277644dff77d51"}
 *
 * Go source:
 * func hasTypeAnnotation(declaration *ast.Declaration) bool {
 * 	return declaration != nil && declaration.Type() != nil
 * }
 */
export function hasTypeAnnotation(declaration: GoPtr<Declaration>): bool {
  return (declaration !== undefined && Node_Type(declaration) !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.serializeTypeForDeclaration","kind":"method","status":"implemented","sigHash":"0b470c8019e7b8bda5ee206173271b4dbccb11a8d882dc517442fbc69fd6a55a","bodyHash":"f20eede70aea86325699b368d25d3df38579488752649bb957ef154370b7b80d"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) serializeTypeForDeclaration(declaration *ast.Declaration, t *Type, symbol *ast.Symbol, tryReuse bool) *ast.Node {
 * 	if declaration == nil {
 * 		if symbol != nil {
 * 			declaration = symbol.ValueDeclaration
 * 			if declaration == nil {
 * 				// TODO: prefer annotated declarations like in strada (but does this ever even matter in practice? All callers should supply a declaration!)
 * 				declaration = core.FirstOrNil(symbol.Declarations)
 * 			}
 * 		}
 * 	}
 * 	if symbol == nil {
 * 		symbol = b.ch.getSymbolOfDeclaration(declaration)
 * 	}
 * 	if t == nil {
 * 		t = b.ctx.enclosingSymbolTypes[ast.GetSymbolId(symbol)]
 * 		if t == nil {
 * 			if symbol.Flags&ast.SymbolFlagsAccessor != 0 && declaration.Kind == ast.KindSetAccessor {
 * 				t = b.ch.instantiateType(b.ch.getWriteTypeOfSymbol(symbol), b.ctx.mapper)
 * 			} else if symbol != nil && (symbol.Flags&(ast.SymbolFlagsTypeLiteral|ast.SymbolFlagsSignature) == 0) {
 * 				t = b.ch.instantiateType(b.ch.getWidenedLiteralType(b.ch.getTypeOfSymbol(symbol)), b.ctx.mapper)
 * 			} else {
 * 				t = b.ch.errorType
 * 			}
 * 		}
 * 	}
 * 
 * 	// !!! TODO: JSDoc, getEmitResolver call is unfortunate layering for the helper - hoist it into checker
 * 	requiresAddingUndefined := declaration != nil && (ast.IsParameterDeclaration(declaration) || ast.IsPropertySignatureDeclaration(declaration) || ast.IsPropertyDeclaration(declaration)) && b.ch.GetEmitResolver().requiresAddingImplicitUndefined(declaration, symbol, b.ctx.enclosingDeclaration)
 * 	addUndefinedForParameter := requiresAddingUndefined && (ast.IsParameterDeclaration(declaration) /*|| ast.IsJSDocParameterTag(declaration)* /)
 * 	if addUndefinedForParameter {
 * 		t = b.ch.getOptionalType(t, false)
 * 	}
 * 
 * 	restoreFlags := b.saveRestoreFlags()
 * 	if t.flags&TypeFlagsUniqueESSymbol != 0 && t.symbol == symbol && (b.ctx.enclosingDeclaration == nil || core.Some(symbol.Declarations, func(d *ast.Declaration) bool {
 * 		return ast.GetSourceFileOfNode(d) == b.ctx.enclosingFile
 * 	})) {
 * 		b.ctx.flags |= nodebuilder.FlagsAllowUniqueESSymbolType
 * 	}
 * 	var result *ast.Node
 * 	var reportedInferenceFallback bool
 * 	// !!! expandable hover support
 * 	if !b.isActivelyExpanding() && tryReuse && b.ctx.enclosingDeclaration != nil && declaration != nil && (ast.IsAccessor(declaration) || (ast.HasInferredType(declaration) && !ast.NodeIsSynthesized(declaration) && (t.ObjectFlags()&ObjectFlagsRequiresWidening) == 0)) {
 * 		remove := b.addSymbolTypeToContext(symbol, t)
 * 		var pt *pseudochecker.PseudoType
 * 		if ast.IsAccessor(declaration) {
 * 			pt = b.pc.GetTypeOfAccessor(declaration)
 * 		} else {
 * 			pt = b.pc.GetTypeOfDeclaration(declaration)
 * 		}
 * 		if (pt == nil || pt.Kind == pseudochecker.PseudoTypeKindNoResult) && ast.IsBinaryExpression(declaration) {
 * 			if decl := core.Find(symbol.Declarations, hasTypeAnnotation); decl != nil {
 * 				// Binary expressions have a first-in-wins type annotation system. The first one with an annotation supplies the type for the rest.
 * 				pt = b.pc.GetTypeOfDeclaration(decl)
 * 			}
 * 		}
 * 		reportErrors := !b.ctx.suppressReportInferenceFallback
 * 		if b.pseudoTypeEquivalentToType(pt, t, !requiresAddingUndefined && (ast.IsParameterDeclaration(declaration) || ast.IsPropertySignatureDeclaration(declaration) || ast.IsPropertyDeclaration(declaration)) && isOptionalDeclaration(declaration), reportErrors) {
 * 			// !!! TODO: If annotated type node is a reference with insufficient type arguments, we should still fall back to type serialization
 * 			// see: canReuseTypeNodeAnnotation in strada for context
 * 			ptt := b.pseudoTypeToType(pt)
 * 			if ptt != nil && requiresAddingUndefined && containsNonMissingUndefinedType(b.ch, t) && !containsNonMissingUndefinedType(b.ch, ptt) {
 * 				pt = pseudochecker.NewPseudoTypeUnion([]*pseudochecker.PseudoType{pt, pseudochecker.PseudoTypeUndefined})
 * 			}
 * 			result = b.pseudoTypeToNodeWithCheckerFallback(pt, t)
 * 		} else {
 * 			// Equivalence failed; if errors from inferred-with-errors pseudo types were
 * 			// reported, note it so we can suppress nested errors during the fallback
 * 			// typeToTypeNode serialization (mirroring the suppression that
 * 			// pseudoTypeToNodeWithCheckerFallback provides).
 * 			reportedInferenceFallback = reportErrors && pt.Kind == pseudochecker.PseudoTypeKindInferred && len(pt.AsPseudoTypeInferred().ErrorNodes) > 0
 * 			if requiresAddingUndefined {
 * 				pt = pseudochecker.NewPseudoTypeUnion([]*pseudochecker.PseudoType{pt, pseudochecker.PseudoTypeUndefined})
 * 				if b.pseudoTypeEquivalentToType(pt, t, false, reportErrors) {
 * 					result = b.pseudoTypeToNodeWithCheckerFallback(pt, t)
 * 					reportedInferenceFallback = false
 * 				}
 * 			}
 * 		}
 * 		remove()
 * 	}
 * 	if result == nil {
 * 		if reportedInferenceFallback {
 * 			oldSuppress := b.ctx.suppressReportInferenceFallback
 * 			b.ctx.suppressReportInferenceFallback = true
 * 			result = b.typeToTypeNode(t)
 * 			b.ctx.suppressReportInferenceFallback = oldSuppress
 * 		} else {
 * 			result = b.typeToTypeNode(t)
 * 		}
 * 	}
 * 	restoreFlags()
 * 	if result == nil {
 * 		return b.f.NewKeywordTypeNode(ast.KindAnyKeyword)
 * 	}
 * 	return result
 * }
 */
export function NodeBuilderImpl_serializeTypeForDeclaration(receiver: GoPtr<NodeBuilderImpl>, declaration: GoPtr<Declaration>, t: GoPtr<Type>, symbol_: GoPtr<Symbol>, tryReuse: bool): GoPtr<Node> {
  if (declaration === undefined && symbol_ !== undefined) {
    declaration = symbol_!.ValueDeclaration as GoPtr<Declaration>;
    if (declaration === undefined) {
      declaration = FirstOrNil(symbol_!.Declarations ?? []) as GoPtr<Declaration>;
    }
  }
  if (symbol_ === undefined && declaration !== undefined) {
    symbol_ = Checker_getSymbolOfDeclaration(receiver!.ch, declaration);
  }
  if (t === undefined) {
    if (symbol_ !== undefined) {
      t = receiver!.ctx!.enclosingSymbolTypes.get(GetSymbolId(symbol_));
      if (t === undefined) {
        if ((symbol_!.Flags & SymbolFlagsAccessor) !== 0 && declaration !== undefined && declaration!.Kind === KindSetAccessor) {
          t = Checker_instantiateType(receiver!.ch, Checker_getWriteTypeOfSymbol(receiver!.ch, symbol_), receiver!.ctx!.mapper);
        } else if ((symbol_!.Flags & (SymbolFlagsTypeLiteral | SymbolFlagsSignature)) === 0) {
          t = Checker_instantiateType(receiver!.ch, Checker_getWidenedLiteralType(receiver!.ch, Checker_getTypeOfSymbol(receiver!.ch, symbol_)), receiver!.ctx!.mapper);
        } else {
          t = receiver!.ch!.errorType;
        }
      }
    } else {
      t = receiver!.ch!.errorType;
    }
  }
  const requiresAddingUndefined = declaration !== undefined &&
    (IsParameterDeclaration(declaration) || IsPropertySignatureDeclaration(declaration) || IsPropertyDeclaration(declaration)) &&
    EmitResolver_requiresAddingImplicitUndefined(Checker_GetEmitResolver(receiver!.ch), declaration, symbol_, receiver!.ctx!.enclosingDeclaration);
  const addUndefinedForParameter = requiresAddingUndefined && IsParameterDeclaration(declaration);
  if (addUndefinedForParameter) {
    t = Checker_getOptionalType(receiver!.ch, t, false as bool);
  }
  const restoreFlags = NodeBuilderImpl_saveRestoreFlags(receiver);
  if ((t!.flags & TypeFlagsUniqueESSymbol) !== 0 &&
    t!.symbol === symbol_ &&
    (receiver!.ctx!.enclosingDeclaration === undefined ||
      Some(symbol_!.Declarations, (declarationNode) => GetSourceFileOfNode(declarationNode) === receiver!.ctx!.enclosingFile))) {
    receiver!.ctx!.flags |= FlagsAllowUniqueESSymbolType;
  }
  let result: GoPtr<Node>;
  let reportedInferenceFallback = false;
  if (!NodeBuilderImpl_isActivelyExpanding(receiver) &&
    tryReuse &&
    receiver!.ctx!.enclosingDeclaration !== undefined &&
    declaration !== undefined &&
    (IsAccessor(declaration) || (HasInferredType(declaration) && !NodeIsSynthesized(declaration) && (t!.objectFlags & ObjectFlagsRequiresWidening) === 0))) {
    const remove = NodeBuilderImpl_addSymbolTypeToContext(receiver, symbol_, t);
    let pt: GoPtr<PseudoType>;
    if (IsAccessor(declaration)) {
      pt = PseudoChecker_GetTypeOfAccessor(receiver!.pc, declaration);
    } else {
      pt = PseudoChecker_GetTypeOfDeclaration(receiver!.pc, declaration);
    }
    if ((pt === undefined || pt!.Kind === PseudoTypeKindNoResult) && IsBinaryExpression(declaration)) {
      const decl = Find(symbol_!.Declarations ?? [], hasTypeAnnotation);
      if (decl !== undefined) {
        // Binary expressions have a first-in-wins type annotation system. The first one with an annotation supplies the type for the rest.
        pt = PseudoChecker_GetTypeOfDeclaration(receiver!.pc, decl as GoPtr<Declaration>);
      }
    }
    const reportErrors = !receiver!.ctx!.suppressReportInferenceFallback;
    if (pt !== undefined && NodeBuilderImpl_pseudoTypeEquivalentToType(
      receiver,
      pt,
      t,
      !requiresAddingUndefined &&
        (IsParameterDeclaration(declaration) || IsPropertySignatureDeclaration(declaration) || IsPropertyDeclaration(declaration)) &&
        isOptionalDeclaration(declaration),
      reportErrors,
    )) {
      let pseudoType: GoPtr<PseudoType> = pt;
      const pseudoTypeType = NodeBuilderImpl_pseudoTypeToType(receiver, pt);
      if (pseudoTypeType !== undefined && requiresAddingUndefined && containsNonMissingUndefinedType(receiver!.ch, t) && !containsNonMissingUndefinedType(receiver!.ch, pseudoTypeType)) {
        pseudoType = NewPseudoTypeUnion([pt, PseudoTypeUndefined]);
      }
      result = NodeBuilderImpl_pseudoTypeToNodeWithCheckerFallback(receiver, pseudoType, t);
    } else if (pt !== undefined) {
      reportedInferenceFallback = reportErrors &&
        pt!.Kind === PseudoTypeKindInferred &&
        PseudoType_AsPseudoTypeInferred(pt)!.ErrorNodes.length > 0;
      if (requiresAddingUndefined) {
        const pseudoType = NewPseudoTypeUnion([pt, PseudoTypeUndefined]);
        if (NodeBuilderImpl_pseudoTypeEquivalentToType(receiver, pseudoType, t, false as bool, reportErrors)) {
          result = NodeBuilderImpl_pseudoTypeToNodeWithCheckerFallback(receiver, pseudoType, t);
          reportedInferenceFallback = false;
        }
      }
    }
    remove();
  }
  if (result === undefined) {
    if (reportedInferenceFallback) {
      const oldSuppress = receiver!.ctx!.suppressReportInferenceFallback;
      receiver!.ctx!.suppressReportInferenceFallback = true;
      result = NodeBuilderImpl_typeToTypeNode(receiver, t);
      receiver!.ctx!.suppressReportInferenceFallback = oldSuppress;
    } else {
      result = NodeBuilderImpl_typeToTypeNode(receiver, t);
    }
  }
  restoreFlags();
  if (result === undefined) {
    return NewKeywordTypeNode(receiver!.f, KindAnyKeyword);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::constGroup::MAX_REVERSE_MAPPED_NESTING_INSPECTION_DEPTH","kind":"constGroup","status":"implemented","sigHash":"d0b7d8265d1cb3dd55386e70620232e6212451cc0b96b8a5019d98a006d45de1","bodyHash":"489412d80271e3868952574d6f0006e8b841bfa006a413fc3477cb17c24197c7"}
 *
 * Go source:
 * const MAX_REVERSE_MAPPED_NESTING_INSPECTION_DEPTH = 3
 */
export const MAX_REVERSE_MAPPED_NESTING_INSPECTION_DEPTH: int = 3;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.shouldUsePlaceholderForProperty","kind":"method","status":"implemented","sigHash":"b891d13263277f7c3982fbf8a4c8f7bf8647a3a823dc4409acb30326425b6673","bodyHash":"1ebfb106e43ce444e5f181b8410dca0c580a552689f0169021e8a60c05783312"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) shouldUsePlaceholderForProperty(propertySymbol *ast.Symbol) bool {
 * 	// Use placeholders for reverse mapped types we've either
 * 	// (1) already descended into, or
 * 	// (2) are nested reverse mappings within a mapping over a non-anonymous type, or
 * 	// (3) are deeply nested properties that originate from the same mapped type.
 * 	// Condition (2) is a restriction mostly just to
 * 	// reduce the blowup in printback size from doing, eg, a deep reverse mapping over `Window`.
 * 	// Since anonymous types usually come from expressions, this allows us to preserve the output
 * 	// for deep mappings which likely come from expressions, while truncating those parts which
 * 	// come from mappings over library functions.
 * 	// Condition (3) limits printing of possibly infinitely deep reverse mapped types.
 * 	if propertySymbol.CheckFlags&ast.CheckFlagsReverseMapped == 0 {
 * 		return false
 * 	}
 * 	// (1)
 * 	if slices.Contains(b.ctx.reverseMappedStack, propertySymbol) {
 * 		return true
 * 	}
 * 	// (2)
 * 	if len(b.ctx.reverseMappedStack) > 0 {
 * 		last := b.ctx.reverseMappedStack[len(b.ctx.reverseMappedStack)-1]
 * 		if b.ch.ReverseMappedSymbolLinks.Has(last) {
 * 			links := b.ch.ReverseMappedSymbolLinks.TryGet(last)
 * 			propertyType := links.propertyType
 * 			if propertyType != nil && propertyType.objectFlags&ObjectFlagsAnonymous == 0 {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	// (3) - we only inspect the last MAX_REVERSE_MAPPED_NESTING_INSPECTION_DEPTH elements of the
 * 	// stack for approximate matches to catch tight infinite loops
 * 	// TODO: Why? Reasoning lost to time. this could probably stand to be improved?
 * 	if len(b.ctx.reverseMappedStack) < MAX_REVERSE_MAPPED_NESTING_INSPECTION_DEPTH {
 * 		return false
 * 	}
 * 	if !b.ch.ReverseMappedSymbolLinks.Has(propertySymbol) {
 * 		return false
 * 	}
 * 	propertyLinks := b.ch.ReverseMappedSymbolLinks.TryGet(propertySymbol)
 * 	propMappedType := propertyLinks.mappedType
 * 	if propMappedType == nil || propMappedType.symbol == nil {
 * 		return false
 * 	}
 * 	for i := range b.ctx.reverseMappedStack {
 * 		if i > MAX_REVERSE_MAPPED_NESTING_INSPECTION_DEPTH {
 * 			break
 * 		}
 * 		prop := b.ctx.reverseMappedStack[len(b.ctx.reverseMappedStack)-1-i]
 * 		if b.ch.ReverseMappedSymbolLinks.Has(prop) {
 * 			links := b.ch.ReverseMappedSymbolLinks.TryGet(prop)
 * 			mappedType := links.mappedType
 * 			if mappedType != nil && mappedType.symbol == propMappedType.symbol {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function NodeBuilderImpl_shouldUsePlaceholderForProperty(receiver: GoPtr<NodeBuilderImpl>, propertySymbol: GoPtr<Symbol>): bool {
  if ((propertySymbol!.CheckFlags & CheckFlagsReverseMapped) === 0) {
    return false;
  }
  // (1)
  if (slices.Contains(receiver!.ctx!.reverseMappedStack, propertySymbol)) {
    return true;
  }
  // (2)
  if (receiver!.ctx!.reverseMappedStack.length > 0) {
    const last = receiver!.ctx!.reverseMappedStack[receiver!.ctx!.reverseMappedStack.length - 1];
    if (LinkStore_Has(receiver!.ch!.ReverseMappedSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ReverseMappedSymbolLinks>, last)) {
      const links = LinkStore_TryGet<GoPtr<Symbol>, ReverseMappedSymbolLinks>(receiver!.ch!.ReverseMappedSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ReverseMappedSymbolLinks>, last);
      const propertyType = links!.propertyType;
      if (propertyType !== undefined && (propertyType!.objectFlags & ObjectFlagsAnonymous) === 0) {
        return true;
      }
    }
  }
  // (3)
  if (receiver!.ctx!.reverseMappedStack.length < MAX_REVERSE_MAPPED_NESTING_INSPECTION_DEPTH) {
    return false;
  }
  if (!LinkStore_Has(receiver!.ch!.ReverseMappedSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ReverseMappedSymbolLinks>, propertySymbol)) {
    return false;
  }
  const propertyLinks = LinkStore_TryGet<GoPtr<Symbol>, ReverseMappedSymbolLinks>(receiver!.ch!.ReverseMappedSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ReverseMappedSymbolLinks>, propertySymbol);
  const propMappedType = propertyLinks!.mappedType;
  if (propMappedType === undefined || propMappedType!["symbol"] === undefined) {
    return false;
  }
  for (let i = 0; i < receiver!.ctx!.reverseMappedStack.length; i++) {
    if (i > MAX_REVERSE_MAPPED_NESTING_INSPECTION_DEPTH) {
      break;
    }
    const prop = receiver!.ctx!.reverseMappedStack[receiver!.ctx!.reverseMappedStack.length - 1 - i];
    if (LinkStore_Has(receiver!.ch!.ReverseMappedSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ReverseMappedSymbolLinks>, prop)) {
      const links = LinkStore_TryGet<GoPtr<Symbol>, ReverseMappedSymbolLinks>(receiver!.ch!.ReverseMappedSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ReverseMappedSymbolLinks>, prop);
      const mappedType = links!.mappedType;
      if (mappedType !== undefined && mappedType!["symbol"] === propMappedType!["symbol"]) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.trackComputedName","kind":"method","status":"implemented","sigHash":"40edc19a8720731ffdc78f7f9205831e8baa91f9bebbdb77d423b55391ef999f","bodyHash":"27f88b45f9af2ac2cda3f41a250f1cf5437d4e62e6fd92bd859483de0172bf51"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) trackComputedName(accessExpression *ast.Node, enclosingDeclaration *ast.Node) {
 * 	// get symbol of the first identifier of the entityName
 * 	firstIdentifier := ast.GetFirstIdentifier(accessExpression)
 * 	name := b.ch.resolveName(enclosingDeclaration, firstIdentifier.Text(), ast.SymbolFlagsValue|ast.SymbolFlagsExportValue, nil /*nameNotFoundMessage* /, true /*isUse* /, false)
 * 	if name != nil {
 * 		b.ctx.tracker.TrackSymbol(name, enclosingDeclaration, ast.SymbolFlagsValue)
 * 	} else {
 * 		// Name does not resolve at target location, track symbol at dest location (should be inaccessible)
 * 		fallback := b.ch.resolveName(firstIdentifier, firstIdentifier.Text(), ast.SymbolFlagsValue|ast.SymbolFlagsExportValue, nil /*nameNotFoundMessage* /, true /*isUse* /, false)
 * 		if fallback != nil {
 * 			b.ctx.tracker.TrackSymbol(fallback, enclosingDeclaration, ast.SymbolFlagsValue)
 * 		}
 * 	}
 * }
 */
export function NodeBuilderImpl_trackComputedName(receiver: GoPtr<NodeBuilderImpl>, accessExpression: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>): void {
  const firstIdentifier = GetFirstIdentifier(accessExpression);
  const name = receiver!.ch!.resolveName(enclosingDeclaration, AsIdentifier(firstIdentifier)!.Text, (SymbolFlagsValue | SymbolFlagsExportValue) as SymbolFlags, undefined, true as bool, false as bool);
  if (name !== undefined) {
    receiver!.ctx!.tracker!.TrackSymbol(name, enclosingDeclaration, SymbolFlagsValue as SymbolFlags);
  } else {
    const fallback = receiver!.ch!.resolveName(firstIdentifier, AsIdentifier(firstIdentifier)!.Text, (SymbolFlagsValue | SymbolFlagsExportValue) as SymbolFlags, undefined, true as bool, false as bool);
    if (fallback !== undefined) {
      receiver!.ctx!.tracker!.TrackSymbol(fallback, enclosingDeclaration, SymbolFlagsValue as SymbolFlags);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::type::propertyNameNodeKind","kind":"type","status":"implemented","sigHash":"13adc31bd574420ba8915f59ecbc9ac385a03d9c7a0449d3e1be67e4a3906c68","bodyHash":"fa7dbf4d10a7b20edb16178429d2bfcb0fb05ac5c41930a8a96740ecba5c08bd"}
 *
 * Go source:
 * propertyNameNodeKind int
 */
export type propertyNameNodeKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::constGroup::propertyNameNodeKindIdentifier+propertyNameNodeKindNumericLiteral+propertyNameNodeKindStringLiteral","kind":"constGroup","status":"implemented","sigHash":"65e788682b53fe37823ecea2f285df55342b0a2e07af90340f1ba91ce3b3d83f","bodyHash":"3ddc06620981a580d9f760ecad7cf7052e60875288b19a3f1f985d95eb843eb1"}
 *
 * Go source:
 * const (
 * 	propertyNameNodeKindIdentifier propertyNameNodeKind = iota
 * 	propertyNameNodeKindNumericLiteral
 * 	propertyNameNodeKindStringLiteral
 * )
 */
export const propertyNameNodeKindIdentifier: propertyNameNodeKind = 0 as int;
export const propertyNameNodeKindNumericLiteral: propertyNameNodeKind = 1 as int;
export const propertyNameNodeKindStringLiteral: propertyNameNodeKind = 2 as int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::classifyPropertyName","kind":"func","status":"implemented","sigHash":"27c752b7e3034577697eb275b7b8f12a413f917d70b59f56c3634dd2572f3cd7","bodyHash":"cded99e9b74710c0b622e3bd6b6716550041df2cb263cbfd378bd489b4b4293b"}
 *
 * Go source:
 * func classifyPropertyName(name string, stringNamed bool, isMethod bool) propertyNameNodeKind {
 * 	if isMethod && name == "new" {
 * 		return propertyNameNodeKindStringLiteral
 * 	}
 * 	if scanner.IsIdentifierText(name, core.LanguageVariantStandard) {
 * 		return propertyNameNodeKindIdentifier
 * 	}
 * 	return core.IfElse(!stringNamed && isNumericLiteralName(name) && jsnum.FromString(name) >= 0, propertyNameNodeKindNumericLiteral, propertyNameNodeKindStringLiteral)
 * }
 */
export function classifyPropertyName(name: string, stringNamed: bool, isMethod: bool): propertyNameNodeKind {
  if (isMethod && name === "new") {
    return propertyNameNodeKindStringLiteral;
  }
  if (IsIdentifierText(name, LanguageVariantStandard)) {
    return propertyNameNodeKindIdentifier;
  }
  return IfElse(!stringNamed && isNumericLiteralName(name) && FromString(name) >= 0, propertyNameNodeKindNumericLiteral, propertyNameNodeKindStringLiteral);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.createPropertyNameNodeForIdentifierOrLiteral","kind":"method","status":"implemented","sigHash":"b296ac50b6b130b1e1819e126963f957753132e87b8c167ccfd2ea33dc06e494","bodyHash":"e7a9800fe1f48a7f9570cc0e9bd846061e9092acf904ad478b7423a13af72854"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) createPropertyNameNodeForIdentifierOrLiteral(name string, singleQuote bool, stringNamed bool, isMethod bool, symbol *ast.Symbol) *ast.Node {
 * 	switch classifyPropertyName(name, stringNamed, isMethod) {
 * 	case propertyNameNodeKindIdentifier:
 * 		return b.newIdentifier(name, symbol)
 * 	case propertyNameNodeKindNumericLiteral:
 * 		return b.f.NewNumericLiteral(name, ast.TokenFlagsNone)
 * 	default:
 * 		return b.f.NewStringLiteral(name, core.IfElse(singleQuote, ast.TokenFlagsSingleQuote, ast.TokenFlagsNone))
 * 	}
 * }
 */
export function NodeBuilderImpl_createPropertyNameNodeForIdentifierOrLiteral(receiver: GoPtr<NodeBuilderImpl>, name: string, singleQuote: bool, stringNamed: bool, isMethod: bool, symbol_: GoPtr<Symbol>): GoPtr<Node> {
  switch (classifyPropertyName(name, stringNamed, isMethod)) {
    case propertyNameNodeKindIdentifier:
      return NodeBuilderImpl_newIdentifier(receiver, name, symbol_);
    case propertyNameNodeKindNumericLiteral:
      return NewNumericLiteral(receiver!.f, name, TokenFlagsNone);
    default:
      return NewStringLiteral(receiver!.f, name, singleQuote ? TokenFlagsSingleQuote : TokenFlagsNone);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.isStringNamed","kind":"method","status":"implemented","sigHash":"119734fb9d34d16b1c403f130e0bd966dceff0dfa63540926aa29edacda71493","bodyHash":"df331ad5583ff4ef1fabf557e2d39d2f4e21e813fbc2b0589424dbe8d6ffe1c7"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) isStringNamed(d *ast.Declaration) bool {
 * 	name := ast.GetNameOfDeclaration(d)
 * 	if name == nil {
 * 		return false
 * 	}
 * 	if ast.IsComputedPropertyName(name) {
 * 		t := b.ch.checkExpression(name.Expression())
 * 		return t.flags&TypeFlagsStringLike != 0
 * 	}
 * 	if ast.IsElementAccessExpression(name) {
 * 		t := b.ch.checkExpression(name.AsElementAccessExpression().ArgumentExpression)
 * 		return t.flags&TypeFlagsStringLike != 0
 * 	}
 * 	return ast.IsStringLiteral(name)
 * }
 */
export function NodeBuilderImpl_isStringNamed(receiver: GoPtr<NodeBuilderImpl>, d: GoPtr<Declaration>): bool {
  const name = GetNameOfDeclaration(d);
  if (name === undefined) {
    return false;
  }
  if (IsComputedPropertyName(name)) {
    const t = Checker_checkExpression(receiver!.ch, Node_Expression(name));
    return (t!.flags & TypeFlagsStringLike) !== 0;
  }
  if (IsElementAccessExpression(name)) {
    const t = Checker_checkExpression(receiver!.ch, AsElementAccessExpression(name)!.ArgumentExpression);
    return (t!.flags & TypeFlagsStringLike) !== 0;
  }
  return IsStringLiteral(name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.isSingleQuotedStringNamed","kind":"method","status":"implemented","sigHash":"a8c66c20e73f3f4dfb1f33c67b3cb6fa3560e51d6393c61be116c4fd8b3b9ed2","bodyHash":"8f3bfa0501b50be5a931d9a4f5a0f9e70826a5fc8bb7d95c0eb85656c2c36b72"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) isSingleQuotedStringNamed(d *ast.Declaration) bool {
 * 	name := ast.GetNameOfDeclaration(d)
 * 	return name != nil && ast.IsStringLiteral(name) && name.AsStringLiteral().TokenFlags&ast.TokenFlagsSingleQuote != 0
 * }
 */
export function NodeBuilderImpl_isSingleQuotedStringNamed(receiver: GoPtr<NodeBuilderImpl>, d: GoPtr<Declaration>): bool {
  const name = GetNameOfDeclaration(d);
  return name !== undefined && IsStringLiteral(name) && (AsStringLiteral(name)!.TokenFlags & TokenFlagsSingleQuote) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.getPropertyNameNodeForSymbol","kind":"method","status":"implemented","sigHash":"700ead887e2a14f72214b85701ae6b2b557cb84f85c68cc7136bb487d6f002ce","bodyHash":"e2d7bbbbca73482bb686aaae1715983ed4f69165b630baea24faef5397f0f77c"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) getPropertyNameNodeForSymbol(symbol *ast.Symbol) *ast.Node {
 * 	// For hash-private names, clone the original private identifier from the declaration
 * 	if symbol.ValueDeclaration != nil {
 * 		declName := symbol.ValueDeclaration.Name()
 * 		if declName != nil && ast.IsPrivateIdentifier(declName) {
 * 			return b.f.DeepCloneNode(declName)
 * 		}
 * 	}
 * 	stringNamed := len(symbol.Declarations) != 0 && core.Every(symbol.Declarations, b.isStringNamed)
 * 	singleQuote := len(symbol.Declarations) != 0 && core.Every(symbol.Declarations, b.isSingleQuotedStringNamed)
 * 	isMethod := symbol.Flags&ast.SymbolFlagsMethod != 0
 * 	fromNameType := b.getPropertyNameNodeForSymbolFromNameType(symbol, singleQuote, stringNamed, isMethod)
 * 	if fromNameType != nil {
 * 		return fromNameType
 * 	}
 * 
 * 	name := symbol.Name
 * 	const privateNamePrefix = ast.InternalSymbolNamePrefix + "#"
 * 	if strings.HasPrefix(name, privateNamePrefix) {
 * 		// symbol IDs are unstable - replace #nnn# with #private#
 * 		name = name[len(privateNamePrefix):]
 * 		name = strings.TrimLeftFunc(name, stringutil.IsDigit)
 * 		name = "__#private" + name
 * 	}
 * 
 * 	return b.createPropertyNameNodeForIdentifierOrLiteral(name, singleQuote, stringNamed, isMethod, symbol)
 * }
 */
export function NodeBuilderImpl_getPropertyNameNodeForSymbol(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>): GoPtr<Node> {
  if (symbol_!.ValueDeclaration !== undefined) {
    const declName = Node_Name(symbol_!.ValueDeclaration);
    if (declName !== undefined && IsPrivateIdentifier(declName)) {
      return NodeFactory_DeepCloneNode(receiver!.f, declName);
    }
  }
  const stringNamed = symbol_!.Declarations !== undefined && symbol_!.Declarations.length !== 0 && Every(symbol_!.Declarations, (d) => NodeBuilderImpl_isStringNamed(receiver, d));
  const singleQuote = symbol_!.Declarations !== undefined && symbol_!.Declarations.length !== 0 && Every(symbol_!.Declarations, (d) => NodeBuilderImpl_isSingleQuotedStringNamed(receiver, d));
  const isMethod = (symbol_!.Flags & SymbolFlagsMethod) !== 0;
  const fromNameType = NodeBuilderImpl_getPropertyNameNodeForSymbolFromNameType(receiver, symbol_, singleQuote, stringNamed, isMethod);
  if (fromNameType !== undefined) {
    return fromNameType;
  }
  const privateNamePrefix = InternalSymbolNamePrefix + "#";
  let name = symbol_!.Name;
  if (name.startsWith(privateNamePrefix)) {
    const rest = name.slice(privateNamePrefix.length).replace(/^\d+/, "");
    name = "__#private" + rest;
  }
  return NodeBuilderImpl_createPropertyNameNodeForIdentifierOrLiteral(receiver, name, singleQuote, stringNamed, isMethod, symbol_);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.getPropertyNameNodeForSymbolFromNameType","kind":"method","status":"implemented","sigHash":"fc1f7ca1fd4c1854cf0c6730487bd6a5a382613cc68e34b571adbb819f677696","bodyHash":"b61f5d7921e611a771f681695ed1b599ad771273a770a350059d8826966d5204"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) getPropertyNameNodeForSymbolFromNameType(symbol *ast.Symbol, singleQuote bool, stringNamed bool, isMethod bool) *ast.Node {
 * 	if !b.ch.valueSymbolLinks.Has(symbol) {
 * 		return nil
 * 	}
 * 	nameType := b.ch.valueSymbolLinks.TryGet(symbol).nameType
 * 	if nameType == nil {
 * 		return nil
 * 	}
 * 	if nameType.flags&TypeFlagsStringOrNumberLiteral != 0 {
 * 		var name string
 * 		switch nameType.AsLiteralType().value.(type) {
 * 		case jsnum.Number:
 * 			name = nameType.AsLiteralType().value.(jsnum.Number).String()
 * 		case string:
 * 			name = nameType.AsLiteralType().value.(string)
 * 		}
 * 		if !scanner.IsIdentifierText(name, core.LanguageVariantStandard) && (stringNamed || !isNumericLiteralName(name)) {
 * 			node := b.f.NewStringLiteral(name, core.IfElse(singleQuote, ast.TokenFlagsSingleQuote, ast.TokenFlagsNone))
 * 			return node
 * 		}
 * 		if isNumericLiteralName(name) && name[0] == '-' {
 * 			return b.f.NewComputedPropertyName(b.f.NewPrefixUnaryExpression(ast.KindMinusToken, b.f.NewNumericLiteral(name[1:], ast.TokenFlagsNone)))
 * 		}
 * 		return b.createPropertyNameNodeForIdentifierOrLiteral(name, singleQuote, stringNamed, isMethod, symbol)
 * 	}
 * 	if nameType.flags&TypeFlagsUniqueESSymbol != 0 {
 * 		return b.f.NewComputedPropertyName(b.symbolToExpression(nameType.AsUniqueESSymbolType().symbol, ast.SymbolFlagsValue))
 * 	}
 * 	return nil
 * }
 */
export function NodeBuilderImpl_getPropertyNameNodeForSymbolFromNameType(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>, singleQuote: bool, stringNamed: bool, isMethod: bool): GoPtr<Node> {
  if (!LinkStore_Has(receiver!.ch!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, symbol_)) {
    return undefined;
  }
  const linksVal = LinkStore_TryGet<GoPtr<Symbol>, ValueSymbolLinks>(receiver!.ch!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, symbol_);
  const nameType = linksVal!.nameType;
  if (nameType === undefined) {
    return undefined;
  }
  if ((nameType!.flags & TypeFlagsStringOrNumberLiteral) !== 0) {
    const litValue = Type_AsLiteralType(nameType)!.value;
    const name: string = typeof litValue === "number" ? String(litValue) : litValue as string;
    if (!IsIdentifierText(name, LanguageVariantStandard) && (stringNamed || !isNumericLiteralName(name))) {
      return NewStringLiteral(receiver!.f, name, singleQuote ? TokenFlagsSingleQuote : TokenFlagsNone);
    }
    if (isNumericLiteralName(name) && name[0] === "-") {
      return NewComputedPropertyName(receiver!.f, NewPrefixUnaryExpression(receiver!.f, KindMinusToken, NewNumericLiteral(receiver!.f, name.slice(1), TokenFlagsNone)));
    }
    return NodeBuilderImpl_createPropertyNameNodeForIdentifierOrLiteral(receiver, name, singleQuote, stringNamed, isMethod, symbol_);
  }
  if ((nameType!.flags & TypeFlagsUniqueESSymbol) !== 0) {
    const uniqueSymbol = nameType!.symbol;
    return NewComputedPropertyName(receiver!.f, NodeBuilderImpl_symbolToExpression(receiver, uniqueSymbol, SymbolFlagsValue as SymbolFlags));
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.addPropertyToElementList","kind":"method","status":"implemented","sigHash":"098033f1033b6e72bcda12349487225cca2beefdbe85bcce57be7842c69c7698","bodyHash":"43d8ff2cc9823d0d90af936335930293f9587e18c4428baae13ce73d827c0fe9"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) addPropertyToElementList(propertySymbol *ast.Symbol, typeElements []*ast.TypeElement) []*ast.TypeElement {
 * 	propertyIsReverseMapped := propertySymbol.CheckFlags&ast.CheckFlagsReverseMapped != 0
 * 	var propertyType *Type
 * 	if b.shouldUsePlaceholderForProperty(propertySymbol) {
 * 		propertyType = b.ch.anyType
 * 	} else {
 * 		propertyType = b.ch.getNonMissingTypeOfSymbol(propertySymbol)
 * 	}
 * 	saveEnclosingDeclaration := b.ctx.enclosingDeclaration
 * 	b.ctx.enclosingDeclaration = nil
 * 	if isLateBoundName(propertySymbol.Name) {
 * 		if len(propertySymbol.Declarations) > 0 {
 * 			decl := propertySymbol.Declarations[0]
 * 			if b.ch.hasLateBindableName(decl) {
 * 				if ast.IsBinaryExpression(decl) {
 * 					name := ast.GetNameOfDeclaration(decl)
 * 					if name != nil && ast.IsElementAccessExpression(name) && ast.IsPropertyAccessEntityNameExpression(name.AsElementAccessExpression().ArgumentExpression, false /*allowJs* /) {
 * 						b.trackComputedName(name.AsElementAccessExpression().ArgumentExpression, saveEnclosingDeclaration)
 * 					}
 * 				} else {
 * 					b.trackComputedName(decl.Name().Expression(), saveEnclosingDeclaration)
 * 				}
 * 			}
 * 		} else {
 * 			b.ctx.tracker.ReportNonSerializableProperty(b.ch.symbolToString(propertySymbol))
 * 		}
 * 	}
 * 	if propertySymbol.ValueDeclaration != nil {
 * 		b.ctx.enclosingDeclaration = propertySymbol.ValueDeclaration
 * 	} else if len(propertySymbol.Declarations) > 0 && propertySymbol.Declarations[0] != nil {
 * 		b.ctx.enclosingDeclaration = propertySymbol.Declarations[0]
 * 	} else {
 * 		b.ctx.enclosingDeclaration = saveEnclosingDeclaration
 * 	}
 * 	propertyName := b.getPropertyNameNodeForSymbol(propertySymbol)
 * 	b.ctx.enclosingDeclaration = saveEnclosingDeclaration
 * 	b.ctx.approximateLength += len(ast.SymbolName(propertySymbol)) + 1
 * 
 * 	if propertySymbol.Flags&ast.SymbolFlagsAccessor != 0 {
 * 		writeType := b.ch.getWriteTypeOfSymbol(propertySymbol)
 * 		if !b.ch.isErrorType(propertyType) && !b.ch.isErrorType(writeType) {
 * 			propDeclaration := ast.GetDeclarationOfKind(propertySymbol, ast.KindPropertyDeclaration)
 * 			if propertyType != writeType || propertySymbol.Parent != nil && propertySymbol.Parent.Flags&ast.SymbolFlagsClass != 0 && propDeclaration == nil {
 * 				symbolMapper := b.ch.valueSymbolLinks.Get(propertySymbol).mapper
 * 				if getterDeclaration := ast.GetDeclarationOfKind(propertySymbol, ast.KindGetAccessor); getterDeclaration != nil {
 * 					getterSignature := b.ch.getSignatureFromDeclaration(getterDeclaration)
 * 					if symbolMapper != nil {
 * 						getterSignature = b.ch.instantiateSignature(getterSignature, symbolMapper)
 * 					}
 * 					getter := b.signatureToSignatureDeclarationHelper(getterSignature, ast.KindGetAccessor, &SignatureToSignatureDeclarationOptions{
 * 						name: propertyName,
 * 					})
 * 					b.setCommentRange(getter, getterDeclaration)
 * 					typeElements = append(typeElements, getter)
 * 				}
 * 				if setterDeclaration := ast.GetDeclarationOfKind(propertySymbol, ast.KindSetAccessor); setterDeclaration != nil {
 * 					setterSignature := b.ch.getSignatureFromDeclaration(setterDeclaration)
 * 					if symbolMapper != nil {
 * 						setterSignature = b.ch.instantiateSignature(setterSignature, symbolMapper)
 * 					}
 * 					setter := b.signatureToSignatureDeclarationHelper(setterSignature, ast.KindSetAccessor, &SignatureToSignatureDeclarationOptions{
 * 						name: propertyName,
 * 					})
 * 					b.setCommentRange(setter, setterDeclaration)
 * 					typeElements = append(typeElements, setter)
 * 				}
 * 				return typeElements
 * 			} else if propertySymbol.Parent != nil && propertySymbol.Parent.Flags&ast.SymbolFlagsClass != 0 && propDeclaration != nil && core.Find(propDeclaration.ModifierNodes(), func(m *ast.Node) bool {
 * 				return m.Kind == ast.KindAccessorKeyword
 * 			}) != nil {
 * 				fakeGetterSignature := b.ch.newSignature(SignatureFlagsNone, nil, nil, nil, nil, propertyType, nil, 0)
 * 				fakeGetterDeclaration := b.signatureToSignatureDeclarationHelper(fakeGetterSignature, ast.KindGetAccessor, &SignatureToSignatureDeclarationOptions{
 * 					name: propertyName,
 * 				})
 * 				b.setCommentRange(fakeGetterDeclaration, propDeclaration)
 * 				typeElements = append(typeElements, fakeGetterDeclaration)
 * 
 * 				setterParam := b.ch.newSymbol(ast.SymbolFlagsFunctionScopedVariable, "arg")
 * 				b.ch.valueSymbolLinks.Get(setterParam).resolvedType = writeType
 * 				fakeSetterSignature := b.ch.newSignature(SignatureFlagsNone, nil, nil, nil, []*ast.Symbol{setterParam}, b.ch.voidType, nil, 0)
 * 				fakeSetterDeclaration := b.signatureToSignatureDeclarationHelper(fakeSetterSignature, ast.KindSetAccessor, &SignatureToSignatureDeclarationOptions{
 * 					name: propertyName,
 * 				})
 * 				typeElements = append(typeElements, fakeSetterDeclaration)
 * 				return typeElements
 * 			}
 * 		}
 * 	}
 * 
 * 	var optionalToken *ast.Node
 * 	if propertySymbol.Flags&ast.SymbolFlagsOptional != 0 {
 * 		optionalToken = b.f.NewToken(ast.KindQuestionToken)
 * 	} else {
 * 		optionalToken = nil
 * 	}
 * 	if propertySymbol.Flags&(ast.SymbolFlagsFunction|ast.SymbolFlagsMethod) != 0 && len(b.ch.getPropertiesOfObjectType(propertyType)) == 0 && !b.ch.isReadonlySymbol(propertySymbol) {
 * 		signatures := b.ch.getSignaturesOfType(b.ch.filterType(propertyType, func(t *Type) bool {
 * 			return t.flags&TypeFlagsUndefined == 0
 * 		}), SignatureKindCall)
 * 		for _, signature := range signatures {
 * 			methodDeclaration := b.signatureToSignatureDeclarationHelper(signature, ast.KindMethodSignature, &SignatureToSignatureDeclarationOptions{
 * 				name:          propertyName,
 * 				questionToken: optionalToken,
 * 			})
 * 			b.setCommentRange(methodDeclaration, core.Coalesce(signature.declaration, propertySymbol.ValueDeclaration))
 * 			typeElements = append(typeElements, methodDeclaration)
 * 		}
 * 		if len(signatures) != 0 || optionalToken == nil {
 * 			return typeElements
 * 		}
 * 	}
 * 	var propertyTypeNode *ast.TypeNode
 * 	if b.shouldUsePlaceholderForProperty(propertySymbol) {
 * 		propertyTypeNode = b.createElidedInformationPlaceholder()
 * 	} else {
 * 		if propertyIsReverseMapped {
 * 			b.ctx.reverseMappedStack = append(b.ctx.reverseMappedStack, propertySymbol)
 * 		}
 * 		if propertyType != nil {
 * 			propertyTypeNode = b.serializeTypeForDeclaration(nil /*declaration* /, propertyType, propertySymbol, true)
 * 		} else {
 * 			propertyTypeNode = b.f.NewKeywordTypeNode(ast.KindAnyKeyword)
 * 		}
 * 		if propertyIsReverseMapped {
 * 			b.ctx.reverseMappedStack = b.ctx.reverseMappedStack[:len(b.ctx.reverseMappedStack)-1]
 * 		}
 * 	}
 * 
 * 	var modifiers *ast.ModifierList
 * 	if b.ch.isReadonlySymbol(propertySymbol) {
 * 		modifiers = b.f.NewModifierList([]*ast.Node{b.f.NewModifier(ast.KindReadonlyKeyword)})
 * 		b.ctx.approximateLength += 9
 * 	}
 * 	propertySignature := b.f.NewPropertySignatureDeclaration(modifiers, propertyName, optionalToken, propertyTypeNode, nil)
 * 
 * 	b.setCommentRange(propertySignature, propertySymbol.ValueDeclaration)
 * 	typeElements = append(typeElements, propertySignature)
 * 
 * 	return typeElements
 * }
 */
export function NodeBuilderImpl_addPropertyToElementList(receiver: GoPtr<NodeBuilderImpl>, propertySymbol: GoPtr<Symbol>, typeElements: GoSlice<GoPtr<TypeElement>>): GoSlice<GoPtr<TypeElement>> {
  const propertyIsReverseMapped = (propertySymbol!.CheckFlags & CheckFlagsReverseMapped) !== 0;
  let propertyType: GoPtr<Type>;
  if (NodeBuilderImpl_shouldUsePlaceholderForProperty(receiver, propertySymbol)) {
    propertyType = receiver!.ch!.anyType;
  } else {
    propertyType = Checker_getNonMissingTypeOfSymbol(receiver!.ch, propertySymbol);
  }
  const saveEnclosingDeclaration = receiver!.ctx!.enclosingDeclaration;
  receiver!.ctx!.enclosingDeclaration = undefined;
  if (isLateBoundName(propertySymbol!.Name)) {
    if ((propertySymbol!.Declarations?.length ?? 0) > 0) {
      const declaration = propertySymbol!.Declarations![0];
      if (Checker_hasLateBindableName(receiver!.ch, declaration)) {
        if (IsBinaryExpression(declaration)) {
          const name = GetNameOfDeclaration(declaration);
          if (name !== undefined &&
            IsElementAccessExpression(name) &&
            IsPropertyAccessEntityNameExpression(AsElementAccessExpression(name)!.ArgumentExpression as GoPtr<Node>, false)) {
            NodeBuilderImpl_trackComputedName(receiver, AsElementAccessExpression(name)!.ArgumentExpression as GoPtr<Node>, saveEnclosingDeclaration);
          }
        } else {
          const declarationName = Node_Name(declaration);
          if (declarationName !== undefined) {
            NodeBuilderImpl_trackComputedName(receiver, Node_Expression(declarationName), saveEnclosingDeclaration);
          }
        }
      }
    } else {
      receiver!.ctx!.tracker!.ReportNonSerializableProperty(Checker_symbolToString(receiver!.ch, propertySymbol));
    }
  }
  if (propertySymbol!.ValueDeclaration !== undefined) {
    receiver!.ctx!.enclosingDeclaration = propertySymbol!.ValueDeclaration;
  } else if ((propertySymbol!.Declarations?.length ?? 0) > 0 && propertySymbol!.Declarations![0] !== undefined) {
    receiver!.ctx!.enclosingDeclaration = propertySymbol!.Declarations![0];
  } else {
    receiver!.ctx!.enclosingDeclaration = saveEnclosingDeclaration;
  }
  const propertyName = NodeBuilderImpl_getPropertyNameNodeForSymbol(receiver, propertySymbol) as GoPtr<PropertyName>;
  receiver!.ctx!.enclosingDeclaration = saveEnclosingDeclaration;
  receiver!.ctx!.approximateLength += SymbolName(propertySymbol).length + 1;

  if ((propertySymbol!.Flags & SymbolFlagsAccessor) !== 0) {
    const writeType = Checker_getWriteTypeOfSymbol(receiver!.ch, propertySymbol);
    if (!Checker_isErrorType(receiver!.ch, propertyType) && !Checker_isErrorType(receiver!.ch, writeType)) {
      const propDeclaration = GetDeclarationOfKind(propertySymbol, KindPropertyDeclaration);
      if (propertyType !== writeType || (propertySymbol!.Parent !== undefined && (propertySymbol!.Parent!.Flags & SymbolFlagsClass) !== 0 && propDeclaration === undefined)) {
        const symbolMapper = (LinkStore_Get(receiver!.ch!.valueSymbolLinks, propertySymbol) as GoPtr<ValueSymbolLinks>)!.mapper;
        const getterDeclaration = GetDeclarationOfKind(propertySymbol, KindGetAccessor);
        if (getterDeclaration !== undefined) {
          let getterSignature = Checker_getSignatureFromDeclaration(receiver!.ch, getterDeclaration);
          if (symbolMapper !== undefined) {
            getterSignature = Checker_instantiateSignature(receiver!.ch, getterSignature, symbolMapper);
          }
          const getter = NodeBuilderImpl_signatureToSignatureDeclarationHelper(receiver, getterSignature, KindGetAccessor, {
            modifiers: [],
            name: propertyName,
            questionToken: undefined,
          });
          NodeBuilderImpl_setCommentRange(receiver, getter, getterDeclaration);
          typeElements.push(getter as GoPtr<TypeElement>);
        }
        const setterDeclaration = GetDeclarationOfKind(propertySymbol, KindSetAccessor);
        if (setterDeclaration !== undefined) {
          let setterSignature = Checker_getSignatureFromDeclaration(receiver!.ch, setterDeclaration);
          if (symbolMapper !== undefined) {
            setterSignature = Checker_instantiateSignature(receiver!.ch, setterSignature, symbolMapper);
          }
          const setter = NodeBuilderImpl_signatureToSignatureDeclarationHelper(receiver, setterSignature, KindSetAccessor, {
            modifiers: [],
            name: propertyName,
            questionToken: undefined,
          });
          NodeBuilderImpl_setCommentRange(receiver, setter, setterDeclaration);
          typeElements.push(setter as GoPtr<TypeElement>);
        }
        return typeElements;
      } else if (propertySymbol!.Parent !== undefined &&
        (propertySymbol!.Parent!.Flags & SymbolFlagsClass) !== 0 &&
        propDeclaration !== undefined &&
        Some(Node_ModifierNodes(propDeclaration) ?? [], (modifier) => modifier!.Kind === KindAccessorKeyword)) {
        const fakeGetterSignature = Checker_newSignature(receiver!.ch, SignatureFlagsNone, undefined, [], undefined, [], propertyType, undefined, 0);
        const fakeGetterDeclaration = NodeBuilderImpl_signatureToSignatureDeclarationHelper(receiver, fakeGetterSignature, KindGetAccessor, {
          modifiers: [],
          name: propertyName,
          questionToken: undefined,
        });
        NodeBuilderImpl_setCommentRange(receiver, fakeGetterDeclaration, propDeclaration);
        typeElements.push(fakeGetterDeclaration as GoPtr<TypeElement>);

        const setterParam = Checker_newSymbol(receiver!.ch, SymbolFlagsFunctionScopedVariable, "arg");
        (LinkStore_Get(receiver!.ch!.valueSymbolLinks, setterParam) as GoPtr<ValueSymbolLinks>)!.resolvedType = writeType;
        const fakeSetterSignature = Checker_newSignature(receiver!.ch, SignatureFlagsNone, undefined, [], undefined, [setterParam], receiver!.ch!.voidType, undefined, 0);
        const fakeSetterDeclaration = NodeBuilderImpl_signatureToSignatureDeclarationHelper(receiver, fakeSetterSignature, KindSetAccessor, {
          modifiers: [],
          name: propertyName,
          questionToken: undefined,
        });
        typeElements.push(fakeSetterDeclaration as GoPtr<TypeElement>);
        return typeElements;
      }
    }
  }

  const optionalToken = (propertySymbol!.Flags & SymbolFlagsOptional) !== 0
    ? NewToken(receiver!.f, KindQuestionToken)
    : undefined;
  if ((propertySymbol!.Flags & (SymbolFlagsFunction | SymbolFlagsMethod)) !== 0 &&
    Checker_getPropertiesOfObjectType(receiver!.ch, propertyType).length === 0 &&
    !Checker_isReadonlySymbol(receiver!.ch, propertySymbol)) {
    const signatures = Checker_getSignaturesOfType(
      receiver!.ch,
      Checker_filterType(receiver!.ch, propertyType, (type_) => (type_!.flags & TypeFlagsUndefined) === 0),
      SignatureKindCall,
    );
    for (const signature of signatures) {
      const methodDeclaration = NodeBuilderImpl_signatureToSignatureDeclarationHelper(receiver, signature, KindMethodSignature, {
        modifiers: [],
        name: propertyName,
        questionToken: optionalToken,
      });
      NodeBuilderImpl_setCommentRange(receiver, methodDeclaration, signature!.declaration ?? propertySymbol!.ValueDeclaration);
      typeElements.push(methodDeclaration as GoPtr<TypeElement>);
    }
    if (signatures.length !== 0 || optionalToken === undefined) {
      return typeElements;
    }
  }

  let propertyTypeNode: GoPtr<TypeNode>;
  if (NodeBuilderImpl_shouldUsePlaceholderForProperty(receiver, propertySymbol)) {
    propertyTypeNode = NodeBuilderImpl_createElidedInformationPlaceholder(receiver);
  } else {
    if (propertyIsReverseMapped) {
      receiver!.ctx!.reverseMappedStack.push(propertySymbol);
    }
    if (propertyType !== undefined) {
      propertyTypeNode = NodeBuilderImpl_serializeTypeForDeclaration(receiver, undefined, propertyType, propertySymbol, true) as GoPtr<TypeNode>;
    } else {
      propertyTypeNode = NewKeywordTypeNode(receiver!.f, KindAnyKeyword);
    }
    if (propertyIsReverseMapped) {
      receiver!.ctx!.reverseMappedStack = receiver!.ctx!.reverseMappedStack.slice(0, receiver!.ctx!.reverseMappedStack.length - 1);
    }
  }

  let modifiers: GoPtr<NodeList>;
  if (Checker_isReadonlySymbol(receiver!.ch, propertySymbol)) {
    modifiers = NodeFactory_NewModifierList(receiver!.f, [NodeFactory_NewModifier(receiver!.f, KindReadonlyKeyword)]);
    receiver!.ctx!.approximateLength += 9;
  }
  const propertySignature = NewPropertySignatureDeclaration(receiver!.f, modifiers as never, propertyName, optionalToken, propertyTypeNode, undefined);
  NodeBuilderImpl_setCommentRange(receiver, propertySignature, propertySymbol!.ValueDeclaration);
  typeElements.push(propertySignature as GoPtr<TypeElement>);
  return typeElements;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.createTypeNodesFromResolvedType","kind":"method","status":"implemented","sigHash":"be0db50174cf167e5b5b2b59c34f6f8b2227ce79bde646637f1c49f79ba2b14b","bodyHash":"0ab0fee4037e4627b510de5e54231d297c49109cfbe31630d19e0d95e5c533e0"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) createTypeNodesFromResolvedType(resolvedType *StructuredType) *ast.NodeList {
 * 	if b.checkTruncationLength() {
 * 		if b.ctx.flags&nodebuilder.FlagsNoTruncation != 0 {
 * 			elem := b.f.NewNotEmittedTypeElement()
 * 			return b.f.NewNodeList([]*ast.TypeElement{b.e.AddSyntheticTrailingComment(elem, ast.KindMultiLineCommentTrivia, "elided", false /*hasTrailingNewLine* /)})
 * 		}
 * 		return b.f.NewNodeList([]*ast.Node{b.f.NewPropertySignatureDeclaration(nil, b.f.NewIdentifier("..."), nil, nil, nil)})
 * 	}
 * 	var typeElements []*ast.TypeElement
 * 	for _, signature := range resolvedType.CallSignatures() {
 * 		typeElements = append(typeElements, b.signatureToSignatureDeclarationHelper(signature, ast.KindCallSignature, nil))
 * 	}
 * 	for _, signature := range resolvedType.ConstructSignatures() {
 * 		if signature.flags&SignatureFlagsAbstract != 0 {
 * 			continue
 * 		}
 * 		typeElements = append(typeElements, b.signatureToSignatureDeclarationHelper(signature, ast.KindConstructSignature, nil))
 * 	}
 * 	for _, info := range resolvedType.indexInfos {
 * 		typeElements = slices.Concat(typeElements, b.indexInfoToObjectComputedNamesOrSignatureDeclaration(info, core.IfElse(resolvedType.objectFlags&ObjectFlagsReverseMapped != 0, b.createElidedInformationPlaceholder(), nil)))
 * 	}
 *
 * 	properties := resolvedType.properties
 * 	if len(properties) == 0 {
 * 		return b.f.NewNodeList(typeElements)
 * 	}
 * 
 * 	i := 0
 * 	for _, propertySymbol := range properties {
 * 		if isExpanding(b.ctx) && propertySymbol.Flags&ast.SymbolFlagsPrototype != 0 {
 * 			continue
 * 		}
 * 		i++
 * 		if b.ctx.flags&nodebuilder.FlagsWriteClassExpressionAsTypeLiteral != 0 {
 * 			if propertySymbol.Flags&ast.SymbolFlagsPrototype != 0 {
 * 				continue
 * 			}
 * 			if getDeclarationModifierFlagsFromSymbol(propertySymbol)&(ast.ModifierFlagsPrivate|ast.ModifierFlagsProtected) != 0 {
 * 				b.ctx.tracker.ReportPrivateInBaseOfClassExpression(propertySymbol.Name)
 * 			}
 * 			if IsPrivateIdentifierSymbol(propertySymbol) {
 * 				b.ctx.tracker.ReportPrivateInBaseOfClassExpression(ast.SymbolName(propertySymbol))
 * 			}
 * 		}
 * 		if b.checkTruncationLength() && (i+2 < len(properties)-1) {
 * 			if b.ctx.flags&nodebuilder.FlagsNoTruncation != 0 {
 * 				typeElements[len(typeElements)-1] = b.e.AddSyntheticTrailingComment(typeElements[len(typeElements)-1], ast.KindMultiLineCommentTrivia, fmt.Sprintf("... %d more elided ...", len(properties)-i), false /*hasTrailingNewLine* /)
 * 			} else {
 * 				text := fmt.Sprintf("... %d more ...", len(properties)-i)
 * 				typeElements = append(typeElements, b.f.NewPropertySignatureDeclaration(nil, b.f.NewIdentifier(text), nil, nil, nil))
 * 			}
 * 			typeElements = b.addPropertyToElementList(properties[len(properties)-1], typeElements)
 * 			break
 * 		}
 * 		typeElements = b.addPropertyToElementList(propertySymbol, typeElements)
 * 	}
 * 	if len(typeElements) != 0 {
 * 		return b.f.NewNodeList(typeElements)
 * 	} else {
 * 		return nil
 * 	}
 * }
 */
export function NodeBuilderImpl_createTypeNodesFromResolvedType(receiver: GoPtr<NodeBuilderImpl>, resolvedType: GoPtr<StructuredType>): GoPtr<NodeList> {
  if (NodeBuilderImpl_checkTruncationLength(receiver)) {
    if ((receiver!.ctx!.flags & FlagsNoTruncation) !== 0) {
      const elem = NewNotEmittedTypeElement(receiver!.f);
      return NodeFactory_NewNodeList(receiver!.f, [EmitContext_AddSyntheticTrailingComment(receiver!.e, elem, KindMultiLineCommentTrivia, "elided", false) as GoPtr<TypeElement>]);
    }
    return NodeFactory_NewNodeList(receiver!.f, [NewPropertySignatureDeclaration(receiver!.f, undefined, NewIdentifier(receiver!.f, "..."), undefined, undefined, undefined) as GoPtr<TypeElement>]);
  }
  let typeElements: GoSlice<GoPtr<TypeElement>> = [];
  for (const signature of StructuredType_CallSignatures(resolvedType)) {
    typeElements.push(NodeBuilderImpl_signatureToSignatureDeclarationHelper(receiver, signature, KindCallSignature, undefined) as GoPtr<TypeElement>);
  }
  for (const signature of StructuredType_ConstructSignatures(resolvedType)) {
    if ((signature!.flags & SignatureFlagsAbstract) !== 0) {
      continue;
    }
    typeElements.push(NodeBuilderImpl_signatureToSignatureDeclarationHelper(receiver, signature, KindConstructSignature, undefined) as GoPtr<TypeElement>);
  }
  const resolvedObjectFlags = (resolvedType as unknown as TypeData).AsType()!.objectFlags;
  for (const info of resolvedType!.indexInfos ?? []) {
    typeElements = slices.Concat<GoPtr<TypeElement>>(
      typeElements,
      NodeBuilderImpl_indexInfoToObjectComputedNamesOrSignatureDeclaration(receiver, info, (resolvedObjectFlags & ObjectFlagsReverseMapped) !== 0 ? NodeBuilderImpl_createElidedInformationPlaceholder(receiver) : undefined) as GoSlice<GoPtr<TypeElement>>,
    );
  }
  const properties = resolvedType!.properties ?? [];
  if (properties.length === 0) {
    return NodeFactory_NewNodeList(receiver!.f, typeElements);
  }
  let i = 0;
  for (const propertySymbol of properties) {
    if (isExpanding(receiver!.ctx) && (propertySymbol!.Flags & SymbolFlagsPrototype) !== 0) {
      continue;
    }
    i++;
    if ((receiver!.ctx!.flags & FlagsWriteClassExpressionAsTypeLiteral) !== 0) {
      if ((propertySymbol!.Flags & SymbolFlagsPrototype) !== 0) {
        continue;
      }
      if ((getDeclarationModifierFlagsFromSymbol(propertySymbol) & (ModifierFlagsPrivate | ModifierFlagsProtected)) !== 0) {
        receiver!.ctx!.tracker!.ReportPrivateInBaseOfClassExpression(propertySymbol!.Name);
      }
      if (IsPrivateIdentifierSymbol(propertySymbol)) {
        receiver!.ctx!.tracker!.ReportPrivateInBaseOfClassExpression(SymbolName(propertySymbol));
      }
    }
    if (NodeBuilderImpl_checkTruncationLength(receiver) && (i + 2 < properties.length - 1)) {
      if ((receiver!.ctx!.flags & FlagsNoTruncation) !== 0) {
        typeElements[typeElements.length - 1] = EmitContext_AddSyntheticTrailingComment(receiver!.e, typeElements[typeElements.length - 1], KindMultiLineCommentTrivia, `... ${properties.length - i} more elided ...`, false) as GoPtr<TypeElement>;
      } else {
        const text = `... ${properties.length - i} more ...`;
        typeElements.push(NewPropertySignatureDeclaration(receiver!.f, undefined, NewIdentifier(receiver!.f, text), undefined, undefined, undefined) as GoPtr<TypeElement>);
      }
      typeElements = NodeBuilderImpl_addPropertyToElementList(receiver, properties[properties.length - 1], typeElements);
      break;
    }
    typeElements = NodeBuilderImpl_addPropertyToElementList(receiver, propertySymbol, typeElements);
  }
  return typeElements.length !== 0 ? NodeFactory_NewNodeList(receiver!.f, typeElements) : undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.createTypeNodeFromObjectType","kind":"method","status":"implemented","sigHash":"7b59a9696a22f521ee99cb6bcf857b48d222d0e01955a3a7bc33ba174d45f28a","bodyHash":"dcd295993e8f1000173d46a8c35eae9e69f13c5314bdf25db78a6f77f47ed59c"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) createTypeNodeFromObjectType(t *Type) *ast.TypeNode {
 * 	if b.ch.isGenericMappedType(t) || (t.objectFlags&ObjectFlagsMapped != 0 && t.AsMappedType().containsError) {
 * 		return b.createMappedTypeNodeFromType(t)
 * 	}
 * 
 * 	resolved := b.ch.resolveStructuredTypeMembers(t)
 * 	callSigs := resolved.CallSignatures()
 * 	ctorSigs := resolved.ConstructSignatures()
 * 	if len(resolved.properties) == 0 && len(resolved.indexInfos) == 0 {
 * 		if len(callSigs) == 0 && len(ctorSigs) == 0 {
 * 			b.ctx.approximateLength += 2
 * 			result := b.f.NewTypeLiteralNode(b.f.NewNodeList([]*ast.Node{}))
 * 			b.e.SetEmitFlags(result, printer.EFSingleLine)
 * 			return result
 * 		}
 * 
 * 		if len(callSigs) == 1 && len(ctorSigs) == 0 {
 * 			signature := callSigs[0]
 * 			signatureNode := b.signatureToSignatureDeclarationHelper(signature, ast.KindFunctionType, nil)
 * 			return signatureNode
 * 		}
 * 
 * 		if len(ctorSigs) == 1 && len(callSigs) == 0 {
 * 			signature := ctorSigs[0]
 * 			signatureNode := b.signatureToSignatureDeclarationHelper(signature, ast.KindConstructorType, nil)
 * 			return signatureNode
 * 		}
 * 	}
 * 
 * 	abstractSignatures := core.Filter(ctorSigs, func(signature *Signature) bool {
 * 		return signature.flags&SignatureFlagsAbstract != 0
 * 	})
 * 	if len(abstractSignatures) > 0 {
 * 		types := core.Map(abstractSignatures, func(s *Signature) *Type {
 * 			return b.ch.getOrCreateTypeFromSignature(s)
 * 		})
 * 		// count the number of type elements excluding abstract constructors
 * 		typeElementCount := len(callSigs) + (len(ctorSigs) - len(abstractSignatures)) + len(resolved.indexInfos) + core.IfElse(b.ctx.flags&nodebuilder.FlagsWriteClassExpressionAsTypeLiteral != 0, core.CountWhere(resolved.properties, func(p *ast.Symbol) bool {
 * 			return p.Flags&ast.SymbolFlagsPrototype == 0
 * 		}), len(resolved.properties))
 * 		// don't include an empty object literal if there were no other static-side
 * 		// properties to write, i.e. `abstract class C { }` becomes `abstract new () => {}`
 * 		// and not `(abstract new () => {}) & {}`
 * 		if typeElementCount != 0 {
 * 			// create a copy of the object type without any abstract construct signatures.
 * 			types = append(types, b.getResolvedTypeWithoutAbstractConstructSignatures(resolved))
 * 		}
 * 		return b.typeToTypeNode(b.ch.getIntersectionType(types))
 * 	}
 * 
 * 	restoreFlags := b.saveRestoreFlags()
 * 	b.ctx.flags |= nodebuilder.FlagsInObjectTypeLiteral
 * 	members := b.createTypeNodesFromResolvedType(resolved)
 * 	restoreFlags()
 * 	typeLiteralNode := b.f.NewTypeLiteralNode(members)
 * 	b.ctx.approximateLength += 2
 * 	b.e.SetEmitFlags(typeLiteralNode, core.IfElse((b.ctx.flags&nodebuilder.FlagsMultilineObjectLiterals != 0), 0, printer.EFSingleLine))
 * 	return typeLiteralNode
 * }
 */
export function NodeBuilderImpl_createTypeNodeFromObjectType(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>): GoPtr<TypeNode> {
  if (Checker_isGenericMappedType(receiver!.ch, t) || ((t!.objectFlags & ObjectFlagsMapped) !== 0 && Type_AsMappedType(t)!.containsError)) {
    return NodeBuilderImpl_createMappedTypeNodeFromType(receiver, t);
  }
  const resolved = Checker_resolveStructuredTypeMembers(receiver!.ch, t);
  const callSigs = StructuredType_CallSignatures(resolved);
  const ctorSigs = StructuredType_ConstructSignatures(resolved);
  if ((resolved!.properties ?? []).length === 0 && (resolved!.indexInfos ?? []).length === 0) {
    if (callSigs.length === 0 && ctorSigs.length === 0) {
      receiver!.ctx!.approximateLength += 2;
      const result = NewTypeLiteralNode(receiver!.f, NodeFactory_NewNodeList(receiver!.f, []));
      EmitContext_SetEmitFlags(receiver!.e, result, EFSingleLine);
      return result as GoPtr<TypeNode>;
    }
    if (callSigs.length === 1 && ctorSigs.length === 0) {
      return NodeBuilderImpl_signatureToSignatureDeclarationHelper(receiver, callSigs[0], KindFunctionType, undefined) as GoPtr<TypeNode>;
    }
    if (ctorSigs.length === 1 && callSigs.length === 0) {
      return NodeBuilderImpl_signatureToSignatureDeclarationHelper(receiver, ctorSigs[0], KindConstructorType, undefined) as GoPtr<TypeNode>;
    }
  }
  const abstractSignatures = Filter(ctorSigs, (signature) => (signature!.flags & SignatureFlagsAbstract) !== 0);
  if (abstractSignatures.length > 0) {
    const types = abstractSignatures.map((signature) => Checker_getOrCreateTypeFromSignature(receiver!.ch, signature));
    const propertyCount = (receiver!.ctx!.flags & FlagsWriteClassExpressionAsTypeLiteral) !== 0
      ? (resolved!.properties ?? []).filter((property) => (property!.Flags & SymbolFlagsPrototype) === 0).length
      : (resolved!.properties ?? []).length;
    const typeElementCount = callSigs.length + (ctorSigs.length - abstractSignatures.length) + (resolved!.indexInfos ?? []).length + propertyCount;
    if (typeElementCount !== 0) {
      types.push(NodeBuilderImpl_getResolvedTypeWithoutAbstractConstructSignatures(receiver, resolved));
    }
    return NodeBuilderImpl_typeToTypeNode(receiver, Checker_getIntersectionType(receiver!.ch, types));
  }
  const restoreFlags = NodeBuilderImpl_saveRestoreFlags(receiver);
  receiver!.ctx!.flags |= FlagsInObjectTypeLiteral;
  const members = NodeBuilderImpl_createTypeNodesFromResolvedType(receiver, resolved);
  restoreFlags();
  const typeLiteralNode = NewTypeLiteralNode(receiver!.f, members as never);
  receiver!.ctx!.approximateLength += 2;
  EmitContext_SetEmitFlags(receiver!.e, typeLiteralNode, (receiver!.ctx!.flags & FlagsMultilineObjectLiterals) !== 0 ? 0 : EFSingleLine);
  return typeLiteralNode as GoPtr<TypeNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::func::getTypeAliasForTypeLiteral","kind":"func","status":"implemented","sigHash":"e13e00aa4da5d23b4deef0e6d9468282ccd059ef1570d5f575964a22d4bc5369","bodyHash":"66b64cee9025b685e6d6b86f7ad0ca388c5ad4639bf3ef76a8771ed4bfff7bdb"}
 *
 * Go source:
 * func getTypeAliasForTypeLiteral(c *Checker, t *Type) *ast.Symbol {
 * 	if t.symbol != nil && t.symbol.Flags&ast.SymbolFlagsTypeLiteral != 0 && t.symbol.Declarations != nil {
 * 		node := ast.WalkUpParenthesizedTypes(t.symbol.Declarations[0].Parent)
 * 		if ast.IsTypeAliasDeclaration(node) {
 * 			return c.getSymbolOfDeclaration(node)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function getTypeAliasForTypeLiteral(c: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Symbol> {
  if (t!["symbol"] !== undefined && (t!["symbol"]!.Flags & SymbolFlagsTypeLiteral) !== 0 && t!["symbol"]!.Declarations !== undefined) {
    const node = WalkUpParenthesizedTypes(t!["symbol"]!.Declarations[0]!.Parent);
    if (IsTypeAliasDeclaration(node)) {
      return Checker_getSymbolOfDeclaration(c, node);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.shouldWriteTypeOfFunctionSymbol","kind":"method","status":"implemented","sigHash":"1e53cb0acba9fdb648e90206c92e85ae75009f1b77fdbc69b4903d5fd217e276","bodyHash":"80e0e2dcd7976d5177c05d322d73da49b0ab26348296af53ee335acd27ab5df8"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) shouldWriteTypeOfFunctionSymbol(symbol *ast.Symbol, typeId TypeId) bool {
 * 	isStaticMethodSymbol := symbol.Flags&ast.SymbolFlagsMethod != 0 && core.Some(symbol.Declarations, func(declaration *ast.Node) bool {
 * 		return ast.IsStatic(declaration) && !b.ch.isLateBindableIndexSignature(ast.GetNameOfDeclaration(declaration))
 * 	})
 * 	isNonLocalFunctionSymbol := false
 * 	if symbol.Flags&ast.SymbolFlagsFunction != 0 {
 * 		if symbol.Parent != nil {
 * 			isNonLocalFunctionSymbol = true
 * 		} else {
 * 			for _, declaration := range symbol.Declarations {
 * 				if declaration.Parent.Kind == ast.KindSourceFile || declaration.Parent.Kind == ast.KindModuleBlock {
 * 					isNonLocalFunctionSymbol = true
 * 					break
 * 				}
 * 			}
 * 		}
 * 	}
 * 	if isStaticMethodSymbol || isNonLocalFunctionSymbol {
 * 		// typeof is allowed only for static/non local functions
 * 		return (b.ctx.flags&nodebuilder.FlagsUseTypeOfFunction != 0 || b.ctx.visitedTypes.Has(typeId)) && // it is type of the symbol uses itself recursively
 * 			(b.ctx.flags&nodebuilder.FlagsUseStructuralFallback == 0 || b.ch.IsValueSymbolAccessible(symbol, b.ctx.enclosingDeclaration)) // And the build is going to succeed without visibility error or there is no structural fallback allowed
 * 	}
 * 	return false
 * }
 */
export function NodeBuilderImpl_shouldWriteTypeOfFunctionSymbol(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>, typeId: TypeId): bool {
  const isStaticMethodSymbol = (symbol_!.Flags & SymbolFlagsMethod) !== 0 && Some(symbol_!.Declarations, (declaration) =>
    IsStatic(declaration) && !Checker_isLateBindableIndexSignature(receiver!.ch, GetNameOfDeclaration(declaration)));
  let isNonLocalFunctionSymbol = false;
  if ((symbol_!.Flags & SymbolFlagsFunction) !== 0) {
    if (symbol_!.Parent !== undefined) {
      isNonLocalFunctionSymbol = true;
    } else {
      for (const declaration of symbol_!.Declarations ?? []) {
        if (declaration!.Parent!.Kind === KindSourceFile || declaration!.Parent!.Kind === KindModuleBlock) {
          isNonLocalFunctionSymbol = true;
          break;
        }
      }
    }
  }
  if (isStaticMethodSymbol || isNonLocalFunctionSymbol) {
    return ((receiver!.ctx!.flags & FlagsUseTypeOfFunction) !== 0 || Set_Has(receiver!.ctx!.visitedTypes, typeId)) &&
      ((receiver!.ctx!.flags & FlagsUseStructuralFallback) === 0 || Checker_IsValueSymbolAccessible(receiver!.ch, symbol_, receiver!.ctx!.enclosingDeclaration));
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.createAnonymousTypeNode","kind":"method","status":"implemented","sigHash":"285e186205ffbad43d027b1ab0fdecb15195f2e2bdfca46b2e2f093a272fc6b5","bodyHash":"0fa100739ecc4567a357134614eaccdc509ec249e7963d87c9b59122db375989"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) createAnonymousTypeNode(t *Type) *ast.TypeNode {
 * 	return b.createAnonymousTypeNodeEx(t, false, false)
 * }
 */
export function NodeBuilderImpl_createAnonymousTypeNode(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>): GoPtr<TypeNode> {
  return NodeBuilderImpl_createAnonymousTypeNodeEx(receiver, t, false as bool, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.createAnonymousTypeNodeEx","kind":"method","status":"implemented","sigHash":"f2bebebe80ca443db938b805e7ceb3358bd919e216ebbd92158f42e37ee64222","bodyHash":"b3a68fac9f8011067d9c483b84a0196d033ccee1b3e472b53380be04eadb0d46"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) createAnonymousTypeNodeEx(t *Type, forceClassExpansion bool, forceExpansion bool) *ast.TypeNode {
 * 	typeId := t.id
 * 	symbol := t.symbol
 * 	if symbol != nil {
 * 		isInstantiationExpressionType := t.objectFlags&ObjectFlagsInstantiationExpressionType != 0
 * 		if isInstantiationExpressionType {
 * 			instantiationExpressionType := t.AsInstantiationExpressionType()
 * 			existing := instantiationExpressionType.node
 * 			//  instantiationExpressionType.node is unreliable for constituents of unions and intersections.
 * 			// declare const Err: typeof ErrImpl & (<T>() => T);
 * 			// type ErrAlias<U> = typeof Err<U>;
 * 			// declare const e: ErrAlias<number>;
 * 			// ErrAlias<number> = typeof Err<number> = typeof ErrImpl & (<number>() => number)
 * 			// The problem is each constituent of the intersection will be associated with typeof Err<number>
 * 			// And when extracting a type for typeof ErrImpl from typeof Err<number> does not make sense.
 * 			if ast.IsTypeQueryNode(existing) && b.getTypeFromTypeNode(existing, false) == t {
 * 				// Guard against unbounded recursion when the existing typeof node fails to be reused
 * 				// (e.g. its entity name isn't accessible from this scope) and the recovery boundary's
 * 				// fallback re-enters typeToTypeNode with the very same instantiation type, which would
 * 				// in turn try to reuse the same node again. Mark the type as visited around the reuse
 * 				// attempt so the inner recursion bottoms out via the visitedTypes guard below.
 * 				if b.ctx.visitedTypes.Has(typeId) {
 * 					return b.createElidedInformationPlaceholder()
 * 				}
 * 				b.ctx.visitedTypes.Add(typeId)
 * 				typeNode := b.tryReuseExistingNonParameterTypeNode(existing, t, nil, nil)
 * 				b.ctx.visitedTypes.Delete(typeId)
 * 				if typeNode != nil {
 * 					return typeNode
 * 				}
 * 			}
 * 			if b.ctx.visitedTypes.Has(typeId) {
 * 				return b.createElidedInformationPlaceholder()
 * 			}
 * 			return b.visitAndTransformType(t, (*NodeBuilderImpl).createTypeNodeFromObjectType)
 * 		}
 * 		var isInstanceType ast.SymbolFlags
 * 		if isClassInstanceSide(b.ch, t) {
 * 			isInstanceType = ast.SymbolFlagsType
 * 		} else {
 * 			isInstanceType = ast.SymbolFlagsValue
 * 		}
 * 
 * 		// !!! JS support
 * 		// if c.isJSConstructor(symbol.ValueDeclaration) {
 * 		// 	// Instance and static types share the same symbol; only add 'typeof' for the static side.
 * 		// 	return b.symbolToTypeNode(symbol, isInstanceType, nil)
 * 		// } else
 * 		if !forceExpansion &&
 * 			(symbol.Flags&ast.SymbolFlagsClass != 0 && !forceClassExpansion && b.ch.getBaseTypeVariableOfClass(symbol) == nil && !(symbol.ValueDeclaration != nil && ast.IsClassLike(symbol.ValueDeclaration) && b.ctx.flags&nodebuilder.FlagsWriteClassExpressionAsTypeLiteral != 0 && (!ast.IsClassDeclaration(symbol.ValueDeclaration) || b.ch.IsSymbolAccessible(symbol, b.ctx.enclosingDeclaration, isInstanceType, false /*shouldComputeAliasesToMakeVisible* /).Accessibility != printer.SymbolAccessibilityAccessible)) || symbol.Flags&(ast.SymbolFlagsEnum|ast.SymbolFlagsValueModule) != 0 || b.shouldWriteTypeOfFunctionSymbol(symbol, typeId)) {
 * 			if b.shouldExpandType(t, false /*isAlias* /) {
 * 				b.ctx.depth++
 * 			} else {
 * 				return b.symbolToTypeNode(symbol, isInstanceType, nil)
 * 			}
 * 		}
 * 		if b.ctx.visitedTypes.Has(typeId) {
 * 			// If type is an anonymous type literal in a type alias declaration, use type alias name
 * 			typeAlias := getTypeAliasForTypeLiteral(b.ch, t)
 * 			if typeAlias != nil {
 * 				// The specified symbol flags need to be reinterpreted as type flags
 * 				return b.symbolToTypeNode(typeAlias, ast.SymbolFlagsType, nil)
 * 			} else {
 * 				return b.createElidedInformationPlaceholder()
 * 			}
 * 		} else {
 * 			return b.visitAndTransformType(t, (*NodeBuilderImpl).createTypeNodeFromObjectType)
 * 		}
 * 	} else {
 * 		// Anonymous types without a symbol are never circular.
 * 		return b.createTypeNodeFromObjectType(t)
 * 	}
 * }
 */
export function NodeBuilderImpl_createAnonymousTypeNodeEx(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>, forceClassExpansion: bool, forceExpansion: bool): GoPtr<TypeNode> {
  const typeId = t!.id;
  const symbol_ = t!.symbol;
  if (symbol_ !== undefined) {
    const isInstantiationExpressionType = (t!.objectFlags & ObjectFlagsInstantiationExpressionType) !== 0;
    if (isInstantiationExpressionType) {
      const instantiationExpressionType = Type_AsInstantiationExpressionType(t);
      const existing = instantiationExpressionType!.node;
      if (IsTypeQueryNode(existing) && NodeBuilderImpl_getTypeFromTypeNode(receiver, existing as GoPtr<TypeNode>, false) === t) {
        // Guard against unbounded recursion when the existing typeof node fails to be reused
        // (e.g. its entity name isn't accessible from this scope) and the recovery boundary's
        // fallback re-enters typeToTypeNode with the very same instantiation type, which would
        // in turn try to reuse the same node again. Mark the type as visited around the reuse
        // attempt so the inner recursion bottoms out via the visitedTypes guard below.
        if (Set_Has(receiver!.ctx!.visitedTypes, typeId)) {
          return NodeBuilderImpl_createElidedInformationPlaceholder(receiver);
        }
        Set_Add(receiver!.ctx!.visitedTypes, typeId);
        const typeNode = NodeBuilderImpl_tryReuseExistingNonParameterTypeNode(receiver, existing as GoPtr<TypeNode>, t, undefined, undefined);
        Set_Delete(receiver!.ctx!.visitedTypes, typeId);
        if (typeNode !== undefined) {
          return typeNode;
        }
      }
      if (Set_Has(receiver!.ctx!.visitedTypes, typeId)) {
        return NodeBuilderImpl_createElidedInformationPlaceholder(receiver);
      }
      return NodeBuilderImpl_visitAndTransformType(receiver, t, NodeBuilderImpl_createTypeNodeFromObjectType);
    }
    const isInstanceType = isClassInstanceSide(receiver!.ch, t) ? SymbolFlagsType : SymbolFlagsValue;
    if (!forceExpansion &&
      (((symbol_!.Flags & SymbolFlagsClass) !== 0 &&
        !forceClassExpansion &&
        Checker_getBaseTypeVariableOfClass(receiver!.ch, symbol_) === undefined &&
        !(symbol_!.ValueDeclaration !== undefined &&
          IsClassLike(symbol_!.ValueDeclaration) &&
          (receiver!.ctx!.flags & FlagsWriteClassExpressionAsTypeLiteral) !== 0 &&
          (!IsClassDeclaration(symbol_!.ValueDeclaration) ||
            Checker_IsSymbolAccessible(receiver!.ch, symbol_, receiver!.ctx!.enclosingDeclaration, isInstanceType, false).Accessibility !== SymbolAccessibilityAccessible))) ||
        (symbol_!.Flags & (SymbolFlagsEnum | SymbolFlagsValueModule)) !== 0 ||
        NodeBuilderImpl_shouldWriteTypeOfFunctionSymbol(receiver, symbol_, typeId))) {
      if (NodeBuilderImpl_shouldExpandType(receiver, t, false)) {
        receiver!.ctx!.depth++;
      } else {
        return NodeBuilderImpl_symbolToTypeNode(receiver, symbol_, isInstanceType, undefined);
      }
    }
    if (Set_Has(receiver!.ctx!.visitedTypes, typeId)) {
      const typeAlias = getTypeAliasForTypeLiteral(receiver!.ch, t);
      if (typeAlias !== undefined) {
        return NodeBuilderImpl_symbolToTypeNode(receiver, typeAlias, SymbolFlagsType, undefined);
      }
      return NodeBuilderImpl_createElidedInformationPlaceholder(receiver);
    }
    return NodeBuilderImpl_visitAndTransformType(receiver, t, NodeBuilderImpl_createTypeNodeFromObjectType);
  }
  return NodeBuilderImpl_createTypeNodeFromObjectType(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.getTypeFromTypeNode","kind":"method","status":"implemented","sigHash":"ebe5c7a8fe41851a38bdd33e850f21c88e05eac816538a2ecb6d9fba081367e7","bodyHash":"848ab430dcb26c8b0fc695a6ef8774429c0da63c97baf37df5c3fac1f33dda78"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) getTypeFromTypeNode(node *ast.TypeNode, noMappedTypes bool) *Type {
 * 	// !!! noMappedTypes optional param support
 * 	t := b.ch.getTypeFromTypeNode(node)
 * 	if b.ctx.mapper == nil {
 * 		return t
 * 	}
 * 
 * 	instantiated := b.ch.instantiateType(t, b.ctx.mapper)
 * 	if noMappedTypes && instantiated != t {
 * 		return nil
 * 	}
 * 	return instantiated
 * }
 */
export function NodeBuilderImpl_getTypeFromTypeNode(receiver: GoPtr<NodeBuilderImpl>, node: GoPtr<TypeNode>, noMappedTypes: bool): GoPtr<Type> {
  const t = Checker_getTypeFromTypeNode(receiver!.ch, node);
  if (receiver!.ctx!.mapper === undefined) {
    return t;
  }
  const instantiated = Checker_instantiateType(receiver!.ch, t, receiver!.ctx!.mapper);
  if (noMappedTypes && instantiated !== t) {
    return undefined;
  }
  return instantiated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.typeToTypeNodeOrCircularityElision","kind":"method","status":"implemented","sigHash":"42c6e07758cfcbc1a1dcf9264a648b75432983b9e133a47ab93160ad143c8186","bodyHash":"e3ddab90f1f6083489cca1d205683754a0798cc147c7d590795fa6a21351a4dc"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) typeToTypeNodeOrCircularityElision(t *Type) *ast.TypeNode {
 * 	if t.flags&TypeFlagsUnion != 0 {
 * 		if b.ctx.visitedTypes.Has(t.id) {
 * 			if b.ctx.flags&nodebuilder.FlagsAllowAnonymousIdentifier == 0 {
 * 				b.ctx.encounteredError = true
 * 				b.ctx.tracker.ReportCyclicStructureError()
 * 			}
 * 			return b.createElidedInformationPlaceholder()
 * 		}
 * 		return b.visitAndTransformType(t, (*NodeBuilderImpl).typeToTypeNode)
 * 	}
 * 	return b.typeToTypeNode(t)
 * }
 */
export function NodeBuilderImpl_typeToTypeNodeOrCircularityElision(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>): GoPtr<TypeNode> {
  if ((t!.flags & TypeFlagsUnion) !== 0) {
    if (Set_Has(receiver!.ctx!.visitedTypes, t!.id)) {
      if ((receiver!.ctx!.flags & FlagsAllowAnonymousIdentifier) === 0) {
        receiver!.ctx!.encounteredError = true;
        receiver!.ctx!.tracker!.ReportCyclicStructureError();
      }
      return NodeBuilderImpl_createElidedInformationPlaceholder(receiver);
    }
    return NodeBuilderImpl_visitAndTransformType(receiver, t, NodeBuilderImpl_typeToTypeNode);
  }
  return NodeBuilderImpl_typeToTypeNode(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.conditionalTypeToTypeNode","kind":"method","status":"implemented","sigHash":"ffe0d6d883e4f46d855e8ec7d1e3615398d3dad2c630a5e24daf0232ce6c2988","bodyHash":"e3a040fb662ea86dd885327f8e51eb5675123f790f355b43387b89998d6deb9c"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) conditionalTypeToTypeNode(_t *Type) *ast.TypeNode {
 * 	if b.checkTruncationLength() {
 * 		return b.createElidedInformationPlaceholder()
 * 	}
 * 	t := _t.AsConditionalType()
 * 	checkTypeNode := b.typeToTypeNode(t.checkType)
 * 	b.ctx.approximateLength += 15
 * 	if b.ctx.flags&nodebuilder.FlagsGenerateNamesForShadowedTypeParams != 0 && t.root.isDistributive && t.checkType.flags&TypeFlagsTypeParameter == 0 {
 * 		newParam := b.ch.newTypeParameter(b.ch.newSymbol(ast.SymbolFlagsTypeParameter, "T" /* as __String * /))
 * 		name := b.typeParameterToName(newParam)
 * 		newTypeVariable := b.f.NewTypeReferenceNode(name.AsNode(), nil)
 * 		b.ctx.approximateLength += 37
 * 		// 15 each for two added conditionals, 7 for an added infer type
 * 		newMapper := prependTypeMapping(t.root.checkType, newParam, t.mapper)
 * 		saveInferTypeParameters := b.ctx.inferTypeParameters
 * 		b.ctx.inferTypeParameters = t.root.inferTypeParameters
 * 		extendsTypeNode := b.typeToTypeNode(b.ch.instantiateType(t.root.extendsType, newMapper))
 * 		b.ctx.inferTypeParameters = saveInferTypeParameters
 * 		trueTypeNode := b.typeToTypeNodeOrCircularityElision(b.ch.instantiateType(b.getTypeFromTypeNode(t.root.node.TrueType, false), newMapper))
 * 		falseTypeNode := b.typeToTypeNodeOrCircularityElision(b.ch.instantiateType(b.getTypeFromTypeNode(t.root.node.FalseType, false), newMapper))
 * 
 * 		// outermost conditional makes `T` a type parameter, allowing the inner conditionals to be distributive
 * 		// second conditional makes `T` have `T & checkType` substitution, so it is correctly usable as the checkType
 * 		// inner conditional runs the check the user provided on the check type (distributively) and returns the result
 * 		// checkType extends infer T ? T extends checkType ? T extends extendsType<T> ? trueType<T> : falseType<T> : never : never;
 * 		// this is potentially simplifiable to
 * 		// checkType extends infer T ? T extends checkType & extendsType<T> ? trueType<T> : falseType<T> : never;
 * 		// but that may confuse users who read the output more.
 * 		// On the other hand,
 * 		// checkType extends infer T extends checkType ? T extends extendsType<T> ? trueType<T> : falseType<T> : never;
 * 		// may also work with `infer ... extends ...` in, but would produce declarations only compatible with the latest TS.
 * 		newId := newTypeVariable.AsTypeReferenceNode().TypeName.AsIdentifier().Clone(b.f)
 * 		syntheticExtendsNode := b.f.NewInferTypeNode(b.f.NewTypeParameterDeclaration(nil, newId, nil, nil, nil))
 * 		innerCheckConditionalNode := b.f.NewConditionalTypeNode(newTypeVariable, extendsTypeNode, trueTypeNode, falseTypeNode)
 * 		syntheticTrueNode := b.f.NewConditionalTypeNode(b.f.NewTypeReferenceNode(name.Clone(b.f), nil), b.f.DeepCloneNode(checkTypeNode), innerCheckConditionalNode, b.f.NewKeywordTypeNode(ast.KindNeverKeyword))
 * 		return b.f.NewConditionalTypeNode(checkTypeNode, syntheticExtendsNode, syntheticTrueNode, b.f.NewKeywordTypeNode(ast.KindNeverKeyword))
 * 	}
 * 	saveInferTypeParameters := b.ctx.inferTypeParameters
 * 	b.ctx.inferTypeParameters = t.root.inferTypeParameters
 * 	extendsTypeNode := b.typeToTypeNode(t.extendsType)
 * 	b.ctx.inferTypeParameters = saveInferTypeParameters
 * 	trueTypeNode := b.typeToTypeNodeOrCircularityElision(b.ch.getTrueTypeFromConditionalType(_t))
 * 	falseTypeNode := b.typeToTypeNodeOrCircularityElision(b.ch.getFalseTypeFromConditionalType(_t))
 * 	return b.f.NewConditionalTypeNode(checkTypeNode, extendsTypeNode, trueTypeNode, falseTypeNode)
 * }
 */
export function NodeBuilderImpl_conditionalTypeToTypeNode(receiver: GoPtr<NodeBuilderImpl>, _t: GoPtr<Type>): GoPtr<TypeNode> {
  if (NodeBuilderImpl_checkTruncationLength(receiver)) {
    return NodeBuilderImpl_createElidedInformationPlaceholder(receiver);
  }
  const t = Type_AsConditionalType(_t);
  const checkTypeNode = NodeBuilderImpl_typeToTypeNode(receiver, t!.checkType);
  receiver!.ctx!.approximateLength += 15;
  if ((receiver!.ctx!.flags & FlagsGenerateNamesForShadowedTypeParams) !== 0 && t!.root!.isDistributive && (t!.checkType!.flags & TypeFlagsTypeParameter) === 0) {
    const newParam = Checker_newTypeParameter(receiver!.ch, Checker_newSymbol(receiver!.ch, SymbolFlagsTypeParameter, "T"));
    const name = NodeBuilderImpl_typeParameterToName(receiver, newParam);
    const newTypeVariable = NewTypeReferenceNode(receiver!.f, name, undefined);
    receiver!.ctx!.approximateLength += 37;
    const newMapper = prependTypeMapping(t!.root!.checkType, newParam, t!.mapper);
    const saveInferTypeParameters = receiver!.ctx!.inferTypeParameters;
    receiver!.ctx!.inferTypeParameters = t!.root!.inferTypeParameters;
    const extendsTypeNode = NodeBuilderImpl_typeToTypeNode(receiver, Checker_instantiateType(receiver!.ch, t!.root!.extendsType, newMapper));
    receiver!.ctx!.inferTypeParameters = saveInferTypeParameters;
    const rootNode = AsConditionalTypeNode(t!.root!.node)!;
    const trueTypeNode = NodeBuilderImpl_typeToTypeNodeOrCircularityElision(receiver, Checker_instantiateType(receiver!.ch, NodeBuilderImpl_getTypeFromTypeNode(receiver, rootNode.TrueType, false), newMapper));
    const falseTypeNode = NodeBuilderImpl_typeToTypeNodeOrCircularityElision(receiver, Checker_instantiateType(receiver!.ch, NodeBuilderImpl_getTypeFromTypeNode(receiver, rootNode.FalseType, false), newMapper));
    const newId = NodeFactory_DeepCloneNode(receiver!.f, AsTypeReferenceNode(newTypeVariable)!.TypeName);
    const syntheticExtendsNode = NewInferTypeNode(receiver!.f, NewTypeParameterDeclaration(receiver!.f, undefined, newId as never, undefined, undefined, undefined));
    const innerCheckConditionalNode = NewConditionalTypeNode(receiver!.f, newTypeVariable, extendsTypeNode, trueTypeNode, falseTypeNode);
    const syntheticTrueNode = NewConditionalTypeNode(receiver!.f, NewTypeReferenceNode(receiver!.f, NodeFactory_DeepCloneNode(receiver!.f, name) as never, undefined), NodeFactory_DeepCloneNode(receiver!.f, checkTypeNode) as GoPtr<TypeNode>, innerCheckConditionalNode as GoPtr<TypeNode>, NewKeywordTypeNode(receiver!.f, KindNeverKeyword));
    return NewConditionalTypeNode(receiver!.f, checkTypeNode, syntheticExtendsNode as GoPtr<TypeNode>, syntheticTrueNode as GoPtr<TypeNode>, NewKeywordTypeNode(receiver!.f, KindNeverKeyword)) as GoPtr<TypeNode>;
  }
  const saveInferTypeParameters = receiver!.ctx!.inferTypeParameters;
  receiver!.ctx!.inferTypeParameters = t!.root!.inferTypeParameters;
  const extendsTypeNode = NodeBuilderImpl_typeToTypeNode(receiver, t!.extendsType);
  receiver!.ctx!.inferTypeParameters = saveInferTypeParameters;
  const trueTypeNode = NodeBuilderImpl_typeToTypeNodeOrCircularityElision(receiver, Checker_getTrueTypeFromConditionalType(receiver!.ch, _t));
  const falseTypeNode = NodeBuilderImpl_typeToTypeNodeOrCircularityElision(receiver, Checker_getFalseTypeFromConditionalType(receiver!.ch, _t));
  return NewConditionalTypeNode(receiver!.f, checkTypeNode, extendsTypeNode, trueTypeNode, falseTypeNode) as GoPtr<TypeNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.getParentSymbolOfTypeParameter","kind":"method","status":"implemented","sigHash":"afcd3560c5ca9ce44104943df856ed283848806a4b708b10690e3bec46c5170e","bodyHash":"fcbd5c0d109571db4637689224025bc9a300d41810ee2bb93e00befd961aceea"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) getParentSymbolOfTypeParameter(typeParameter *TypeParameter) *ast.Symbol {
 * 	tp := ast.GetDeclarationOfKind(typeParameter.symbol, ast.KindTypeParameter)
 * 	var host *ast.Node
 * 	// !!! JSDoc support
 * 	// if ast.IsJSDocTemplateTag(tp.Parent) {
 * 	// 	host = getEffectiveContainerForJSDocTemplateTag(tp.Parent)
 * 	// } else {
 * 	host = tp.Parent
 * 	// }
 * 	if host == nil {
 * 		return nil
 * 	}
 * 	return b.ch.getSymbolOfNode(host)
 * }
 */
export function NodeBuilderImpl_getParentSymbolOfTypeParameter(receiver: GoPtr<NodeBuilderImpl>, typeParameter: GoPtr<TypeParameter>): GoPtr<Symbol> {
  // Checker type data objects are flat (installTypeData); the Go embedded chain is
  // represented by the AsType() backlink, not __tsgoEmbedded0 navigation.
  const typeObj = (typeParameter as unknown as TypeData).AsType();
  const tp = GetDeclarationOfKind(typeObj!["symbol"], KindTypeParameter);
  const host = tp!.Parent;
  if (host === undefined) {
    return undefined;
  }
  return Checker_getSymbolOfNode(receiver!.ch, host);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.typeReferenceToTypeNode","kind":"method","status":"implemented","sigHash":"19135656b1e2d226eaaa0d758eef8459f800a00d837c55e519a36a01284b5514","bodyHash":"ac75089d011bf816d25b280a94c10d96df58b8ef8c76a98d454cbbbdf3f0450b"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) typeReferenceToTypeNode(t *Type) *ast.TypeNode {
 * 	var typeArguments []*Type = b.ch.getTypeArguments(t)
 * 	if t.Target() == b.ch.globalArrayType || t.Target() == b.ch.globalReadonlyArrayType {
 * 		if b.ctx.flags&nodebuilder.FlagsWriteArrayAsGenericType != 0 {
 * 			typeArgumentNode := b.typeToTypeNode(typeArguments[0])
 * 			return b.f.NewTypeReferenceNode(
 * 				b.newIdentifier(core.IfElse(t.Target() == b.ch.globalArrayType, "Array", "ReadonlyArray"), t.Target().symbol),
 * 				b.f.NewNodeList([]*ast.TypeNode{typeArgumentNode}),
 * 			)
 * 		}
 * 		elementType := b.typeToTypeNode(typeArguments[0])
 * 		arrayType := b.f.NewArrayTypeNode(elementType)
 * 		if t.Target() == b.ch.globalArrayType {
 * 			return arrayType
 * 		} else {
 * 			return b.f.NewTypeOperatorNode(ast.KindReadonlyKeyword, arrayType)
 * 		}
 * 	} else if t.Target().objectFlags&ObjectFlagsTuple != 0 {
 * 		typeArguments = core.SameMapIndex(typeArguments, func(arg *Type, i int) *Type {
 * 			isOptional := false
 * 			if i < len(t.Target().AsTupleType().elementInfos) {
 * 				isOptional = t.Target().AsTupleType().elementInfos[i].flags&ElementFlagsOptional != 0
 * 			}
 * 			return b.ch.removeMissingType(arg, isOptional)
 * 		})
 * 		if len(typeArguments) > 0 {
 * 			arity := b.ch.getTypeReferenceArity(t)
 * 			tupleConstituentNodes := b.mapToTypeNodes(typeArguments[0:arity], false /*isBareList* /)
 * 			if tupleConstituentNodes != nil {
 * 				for i := 0; i < len(tupleConstituentNodes.Nodes); i++ {
 * 					flags := t.Target().AsTupleType().elementInfos[i].flags
 * 					labeledElementDeclaration := t.Target().AsTupleType().elementInfos[i].labeledDeclaration
 * 
 * 					if labeledElementDeclaration != nil {
 * 						tupleConstituentNodes.Nodes[i] = b.f.NewNamedTupleMember(
 * 							core.IfElse(flags&ElementFlagsVariable != 0, b.f.NewToken(ast.KindDotDotDotToken), nil),
 * 							b.newIdentifier(b.ch.getTupleElementLabel(t.Target().AsTupleType().elementInfos[i], nil, i), nil /*symbol* /),
 * 							core.IfElse(flags&ElementFlagsOptional != 0, b.f.NewToken(ast.KindQuestionToken), nil),
 * 							core.IfElse(flags&ElementFlagsRest != 0, b.f.NewArrayTypeNode(tupleConstituentNodes.Nodes[i]), tupleConstituentNodes.Nodes[i]),
 * 						)
 * 					} else {
 * 						switch {
 * 						case flags&ElementFlagsVariable != 0:
 * 							tupleConstituentNodes.Nodes[i] = b.f.NewRestTypeNode(core.IfElse(flags&ElementFlagsRest != 0, b.f.NewArrayTypeNode(tupleConstituentNodes.Nodes[i]), tupleConstituentNodes.Nodes[i]))
 * 						case flags&ElementFlagsOptional != 0:
 * 							tupleConstituentNodes.Nodes[i] = b.f.NewOptionalTypeNode(tupleConstituentNodes.Nodes[i])
 * 						}
 * 					}
 * 				}
 * 				tupleTypeNode := b.f.NewTupleTypeNode(tupleConstituentNodes)
 * 				b.e.SetEmitFlags(tupleTypeNode, printer.EFSingleLine)
 * 				if t.Target().AsTupleType().readonly {
 * 					return b.f.NewTypeOperatorNode(ast.KindReadonlyKeyword, tupleTypeNode)
 * 				} else {
 * 					return tupleTypeNode
 * 				}
 * 			}
 * 		}
 * 		if b.ctx.encounteredError || (b.ctx.flags&nodebuilder.FlagsAllowEmptyTuple != 0) {
 * 			tupleTypeNode := b.f.NewTupleTypeNode(b.f.NewNodeList([]*ast.TypeNode{}))
 * 			b.e.SetEmitFlags(tupleTypeNode, printer.EFSingleLine)
 * 			if t.Target().AsTupleType().readonly {
 * 				return b.f.NewTypeOperatorNode(ast.KindReadonlyKeyword, tupleTypeNode)
 * 			} else {
 * 				return tupleTypeNode
 * 			}
 * 		}
 * 		b.ctx.encounteredError = true
 * 		return nil
 * 		// TODO: GH#18217
 * 	} else if b.ctx.flags&nodebuilder.FlagsWriteClassExpressionAsTypeLiteral != 0 && t.symbol.ValueDeclaration != nil && ast.IsClassLike(t.symbol.ValueDeclaration) && !b.ch.IsValueSymbolAccessible(t.symbol, b.ctx.enclosingDeclaration) {
 * 		return b.createAnonymousTypeNode(t)
 * 	} else {
 * 		outerTypeParameters := t.Target().AsInterfaceType().OuterTypeParameters()
 * 		i := 0
 * 		var resultType *ast.TypeNode
 * 		if outerTypeParameters != nil {
 * 			length := len(outerTypeParameters)
 * 			for i < length {
 * 				// Find group of type arguments for type parameters with the same declaring container.
 * 				start := i
 * 				parent := b.getParentSymbolOfTypeParameter(outerTypeParameters[i].AsTypeParameter())
 * 				for ok := true; ok; ok = i < length && b.getParentSymbolOfTypeParameter(outerTypeParameters[i].AsTypeParameter()) == parent { // do-while loop
 * 					i++
 * 				}
 * 				// When type parameters are their own type arguments for the whole group (i.e. we have
 * 				// the default outer type arguments), we don't show the group.
 * 
 * 				if !slices.Equal(outerTypeParameters[start:i], typeArguments[start:i]) {
 * 					typeArgumentSlice := b.mapToTypeNodes(typeArguments[start:i], false /*isBareList* /)
 * 					restoreFlags := b.saveRestoreFlags()
 * 					b.ctx.flags |= nodebuilder.FlagsForbidIndexedAccessSymbolReferences
 * 					ref := b.symbolToTypeNode(parent, ast.SymbolFlagsType, typeArgumentSlice)
 * 					restoreFlags()
 * 					if resultType == nil {
 * 						resultType = ref
 * 					} else {
 * 						resultType = b.appendReferenceToType(resultType, ref)
 * 					}
 * 				}
 * 			}
 * 		}
 * 		var typeArgumentNodes *ast.NodeList
 * 		if len(typeArguments) > 0 {
 * 			typeParameterCount := 0
 * 			typeParams := t.Target().AsInterfaceType().TypeParameters()
 * 			if typeParams != nil {
 * 				typeParameterCount = min(len(typeParams), len(typeArguments))
 * 
 * 				// Maybe we should do this for more types, but for now we only elide type arguments that are
 * 				// identical to their associated type parameters' defaults for `Iterable`, `IterableIterator`,
 * 				// `AsyncIterable`, and `AsyncIterableIterator` to provide backwards-compatible .d.ts emit due
 * 				// to each now having three type parameters instead of only one.
 * 				if b.ch.isReferenceToType(t, b.ch.getGlobalIterableType()) || b.ch.isReferenceToType(t, b.ch.getGlobalIterableIteratorType()) || b.ch.isReferenceToType(t, b.ch.getGlobalAsyncIterableType()) || b.ch.isReferenceToType(t, b.ch.getGlobalAsyncIterableIteratorType()) {
 * 					if t.AsTypeReference().node == nil || !ast.IsTypeReferenceNode(t.AsTypeReference().node) || t.AsTypeReference().node.TypeArguments() == nil || len(t.AsTypeReference().node.TypeArguments()) < typeParameterCount {
 * 						for typeParameterCount > 0 {
 * 							typeArgument := typeArguments[typeParameterCount-1]
 * 							typeParameter := t.Target().AsInterfaceType().TypeParameters()[typeParameterCount-1]
 * 							defaultType := b.ch.getDefaultFromTypeParameter(typeParameter)
 * 							if defaultType == nil || !b.ch.isTypeIdenticalTo(typeArgument, defaultType) {
 * 								break
 * 							}
 * 							typeParameterCount--
 * 						}
 * 					}
 * 				}
 * 			}
 * 
 * 			typeArgumentNodes = b.mapToTypeNodes(typeArguments[i:typeParameterCount], false /*isBareList* /)
 * 		}
 * 		restoreFlags := b.saveRestoreFlags()
 * 		b.ctx.flags |= nodebuilder.FlagsForbidIndexedAccessSymbolReferences
 * 		finalRef := b.symbolToTypeNode(t.symbol, ast.SymbolFlagsType, typeArgumentNodes)
 * 		restoreFlags()
 * 		if resultType == nil {
 * 			return finalRef
 * 		} else {
 * 			return b.appendReferenceToType(resultType, finalRef)
 * 		}
 * 	}
 * }
 */
export function NodeBuilderImpl_typeReferenceToTypeNode(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>): GoPtr<TypeNode> {
  let typeArguments = Checker_getTypeArguments(receiver!.ch, t) ?? [];
  const target = Type_Target(t);
  if (target === receiver!.ch!.globalArrayType || target === receiver!.ch!.globalReadonlyArrayType) {
    if ((receiver!.ctx!.flags & FlagsWriteArrayAsGenericType) !== 0) {
      const typeArgumentNode = NodeBuilderImpl_typeToTypeNode(receiver, typeArguments[0]);
      return NewTypeReferenceNode(
        receiver!.f,
        NodeBuilderImpl_newIdentifier(receiver, target === receiver!.ch!.globalArrayType ? "Array" : "ReadonlyArray", target!.symbol),
        NodeFactory_NewNodeList(receiver!.f, [typeArgumentNode]) as never,
      ) as GoPtr<TypeNode>;
    }
    const elementType = NodeBuilderImpl_typeToTypeNode(receiver, typeArguments[0]);
    const arrayType = NewArrayTypeNode(receiver!.f, elementType);
    if (target === receiver!.ch!.globalArrayType) {
      return arrayType as GoPtr<TypeNode>;
    }
    return NewTypeOperatorNode(receiver!.f, KindReadonlyKeyword, arrayType as GoPtr<TypeNode>) as GoPtr<TypeNode>;
  }
  if ((target!.objectFlags & ObjectFlagsTuple) !== 0) {
    const tupleTarget = Type_AsTupleType(target);
    typeArguments = typeArguments.map((arg, index) => {
      const isOptional = index < tupleTarget!.elementInfos.length && (tupleTarget!.elementInfos[index]!.flags & ElementFlagsOptional) !== 0;
      return Checker_removeMissingType(receiver!.ch, arg, isOptional);
    });
    if (typeArguments.length > 0) {
      const arity = Checker_getTypeReferenceArity(receiver!.ch, t);
      const tupleConstituentNodes = NodeBuilderImpl_mapToTypeNodes(receiver, typeArguments.slice(0, arity), false);
      if (tupleConstituentNodes !== undefined) {
        for (let index = 0; index < tupleConstituentNodes.Nodes.length; index++) {
          const flags = tupleTarget!.elementInfos[index]!.flags;
          const labeledElementDeclaration = tupleTarget!.elementInfos[index]!.labeledDeclaration;
          const currentNode = tupleConstituentNodes.Nodes[index] as GoPtr<TypeNode>;
          if (labeledElementDeclaration !== undefined) {
            const elementType = (flags & ElementFlagsRest) !== 0 ? NewArrayTypeNode(receiver!.f, currentNode) as GoPtr<TypeNode> : currentNode;
            tupleConstituentNodes.Nodes[index] = NewNamedTupleMember(
              receiver!.f,
              (flags & ElementFlagsVariable) !== 0 ? NewToken(receiver!.f, KindDotDotDotToken) as never : undefined,
              NodeBuilderImpl_newIdentifier(receiver, Checker_getTupleElementLabel(receiver!.ch, tupleTarget!.elementInfos[index]!, undefined, index), undefined),
              (flags & ElementFlagsOptional) !== 0 ? NewToken(receiver!.f, KindQuestionToken) as never : undefined,
              elementType,
            );
          } else if ((flags & ElementFlagsVariable) !== 0) {
            const restType = (flags & ElementFlagsRest) !== 0 ? NewArrayTypeNode(receiver!.f, currentNode) as GoPtr<TypeNode> : currentNode;
            tupleConstituentNodes.Nodes[index] = NewRestTypeNode(receiver!.f, restType);
          } else if ((flags & ElementFlagsOptional) !== 0) {
            tupleConstituentNodes.Nodes[index] = NewOptionalTypeNode(receiver!.f, currentNode);
          }
        }
        const tupleTypeNode = NewTupleTypeNode(receiver!.f, tupleConstituentNodes as never);
        EmitContext_SetEmitFlags(receiver!.e, tupleTypeNode, EFSingleLine);
        if (tupleTarget!.readonly) {
          return NewTypeOperatorNode(receiver!.f, KindReadonlyKeyword, tupleTypeNode as GoPtr<TypeNode>) as GoPtr<TypeNode>;
        }
        return tupleTypeNode as GoPtr<TypeNode>;
      }
    }
    if (receiver!.ctx!.encounteredError || (receiver!.ctx!.flags & FlagsAllowEmptyTuple) !== 0) {
      const tupleTypeNode = NewTupleTypeNode(receiver!.f, NodeFactory_NewNodeList(receiver!.f, []) as never);
      EmitContext_SetEmitFlags(receiver!.e, tupleTypeNode, EFSingleLine);
      if (tupleTarget!.readonly) {
        return NewTypeOperatorNode(receiver!.f, KindReadonlyKeyword, tupleTypeNode as GoPtr<TypeNode>) as GoPtr<TypeNode>;
      }
      return tupleTypeNode as GoPtr<TypeNode>;
    }
    receiver!.ctx!.encounteredError = true;
    return undefined;
  }
  if ((receiver!.ctx!.flags & FlagsWriteClassExpressionAsTypeLiteral) !== 0 &&
    t!.symbol !== undefined &&
    t!.symbol!.ValueDeclaration !== undefined &&
    IsClassLike(t!.symbol!.ValueDeclaration) &&
    !Checker_IsValueSymbolAccessible(receiver!.ch, t!.symbol, receiver!.ctx!.enclosingDeclaration)) {
    return NodeBuilderImpl_createAnonymousTypeNode(receiver, t);
  }
  const outerTypeParameters = InterfaceType_OuterTypeParameters(Type_AsInterfaceType(target));
  let typeParameterOffset = 0;
  let resultType: GoPtr<TypeNode>;
  if (outerTypeParameters.length > 0) {
    const length = outerTypeParameters.length;
    while (typeParameterOffset < length) {
      const start = typeParameterOffset;
      const parent = NodeBuilderImpl_getParentSymbolOfTypeParameter(receiver, Type_AsTypeParameter(outerTypeParameters[typeParameterOffset]));
      do {
        typeParameterOffset++;
      } while (typeParameterOffset < length && NodeBuilderImpl_getParentSymbolOfTypeParameter(receiver, Type_AsTypeParameter(outerTypeParameters[typeParameterOffset])) === parent);
      if (!slices.Equal(outerTypeParameters.slice(start, typeParameterOffset), typeArguments.slice(start, typeParameterOffset))) {
        const typeArgumentSlice = NodeBuilderImpl_mapToTypeNodes(receiver, typeArguments.slice(start, typeParameterOffset), false);
        const restoreFlags = NodeBuilderImpl_saveRestoreFlags(receiver);
        receiver!.ctx!.flags |= FlagsForbidIndexedAccessSymbolReferences;
        const ref = NodeBuilderImpl_symbolToTypeNode(receiver, parent, SymbolFlagsType, typeArgumentSlice);
        restoreFlags();
        if (resultType === undefined) {
          resultType = ref;
        } else {
          resultType = NodeBuilderImpl_appendReferenceToType(receiver, resultType, ref);
        }
      }
    }
  }
  let typeArgumentNodes: GoPtr<NodeList>;
  if (typeArguments.length > 0) {
    let typeParameterCount = 0;
    const typeParams = InterfaceType_TypeParameters(Type_AsInterfaceType(target));
    if (typeParams.length > 0) {
      typeParameterCount = Math.min(typeParams.length, typeArguments.length);
      if (Checker_isReferenceToType(receiver!.ch, t, receiver!.ch!.getGlobalIterableType()) ||
        Checker_isReferenceToType(receiver!.ch, t, receiver!.ch!.getGlobalIterableIteratorType()) ||
        Checker_isReferenceToType(receiver!.ch, t, receiver!.ch!.getGlobalAsyncIterableType()) ||
        Checker_isReferenceToType(receiver!.ch, t, receiver!.ch!.getGlobalAsyncIterableIteratorType())) {
        const referenceNode = Type_AsTypeReference(t)!.node;
        const referenceTypeArgumentList = referenceNode !== undefined && IsTypeReferenceNode(referenceNode)
          ? Node_TypeArguments(referenceNode)
          : undefined;
        if (referenceNode === undefined || !IsTypeReferenceNode(referenceNode) || referenceTypeArgumentList === undefined || referenceTypeArgumentList.length < typeParameterCount) {
          while (typeParameterCount > 0) {
            const typeArgument = typeArguments[typeParameterCount - 1];
            const typeParameter = typeParams[typeParameterCount - 1];
            const defaultType = Checker_getDefaultFromTypeParameter(receiver!.ch, typeParameter);
            if (defaultType === undefined || !Checker_isTypeIdenticalTo(receiver!.ch, typeArgument, defaultType)) {
              break;
            }
            typeParameterCount--;
          }
        }
      }
    }
    typeArgumentNodes = NodeBuilderImpl_mapToTypeNodes(receiver, typeArguments.slice(typeParameterOffset, typeParameterCount), false);
  }
  const restoreFlags = NodeBuilderImpl_saveRestoreFlags(receiver);
  receiver!.ctx!.flags |= FlagsForbidIndexedAccessSymbolReferences;
  const finalRef = NodeBuilderImpl_symbolToTypeNode(receiver, t!.symbol, SymbolFlagsType, typeArgumentNodes);
  restoreFlags();
  if (resultType === undefined) {
    return finalRef;
  }
  return NodeBuilderImpl_appendReferenceToType(receiver, resultType, finalRef);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.visitAndTransformType","kind":"method","status":"implemented","sigHash":"6169f16b8e28d2538d50d731b6f58bd23164b9ed76ca11f895219b7521db10bc","bodyHash":"4b518b95f334243d3f6c144c0b26a35b36a195dd8ec09ff6f4f1475bd73f7236"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) visitAndTransformType(t *Type, transform func(b *NodeBuilderImpl, t *Type) *ast.TypeNode) *ast.TypeNode {
 * 	typeId := t.id
 * 	isConstructorObject := t.objectFlags&ObjectFlagsAnonymous != 0 && t.symbol != nil && t.symbol.Flags&ast.SymbolFlagsClass != 0
 * 	var id *CompositeSymbolIdentity
 * 	switch {
 * 	case t.objectFlags&ObjectFlagsReference != 0 && t.AsTypeReference().node != nil:
 * 		id = &CompositeSymbolIdentity{false, 0, ast.GetNodeId(t.AsTypeReference().node)}
 * 	case t.flags&TypeFlagsConditional != 0:
 * 		id = &CompositeSymbolIdentity{false, 0, ast.GetNodeId(t.AsConditionalType().root.node.AsNode())}
 * 	case t.symbol != nil:
 * 		id = &CompositeSymbolIdentity{isConstructorObject, ast.GetSymbolId(t.symbol), 0}
 * 	default:
 * 		id = nil
 * 	}
 * 	// Since instantiations of the same anonymous type have the same symbol, tracking symbols instead
 * 	// of types allows us to catch circular references to instantiations of the same anonymous type
 * 
 * 	key := CompositeTypeCacheIdentity{typeId, b.ctx.flags, b.ctx.internalFlags}
 * 	// Don't rely on type cache if we're expanding a type, because we need to compute `canIncreaseExpansionDepth`.
 * 	canUseCache := b.ctx.maxExpansionDepth < 0
 * 	if canUseCache && b.ctx.enclosingDeclaration != nil && b.links.Has(b.ctx.enclosingDeclaration) {
 * 		links := b.links.Get(b.ctx.enclosingDeclaration)
 * 		cachedResult, ok := links.serializedTypes[key]
 * 		if ok {
 * 			// TODO:: check if we instead store late painted statements associated with this?
 * 			for _, arg := range cachedResult.trackedSymbols {
 * 				b.ctx.tracker.TrackSymbol(arg.symbol, arg.enclosingDeclaration, arg.meaning)
 * 			}
 * 			if cachedResult.truncating {
 * 				b.ctx.truncating = true
 * 			}
 * 			b.ctx.approximateLength += cachedResult.addedLength
 * 			return b.f.DeepCloneNode(cachedResult.node)
 * 		}
 * 	}
 * 
 * 	var depth int
 * 	if id != nil {
 * 		depth = b.ctx.symbolDepth[*id]
 * 		if depth > 10 {
 * 			return b.createElidedInformationPlaceholder()
 * 		}
 * 		b.ctx.symbolDepth[*id] = depth + 1
 * 	}
 * 	b.ctx.visitedTypes.Add(typeId)
 * 	prevTrackedSymbols := b.ctx.trackedSymbols
 * 	b.ctx.trackedSymbols = nil
 * 	startLength := b.ctx.approximateLength
 * 	result := transform(b, t)
 * 	addedLength := b.ctx.approximateLength - startLength
 * 	if canUseCache && !b.ctx.reportedDiagnostic && !b.ctx.encounteredError {
 * 		links := b.links.Get(b.ctx.enclosingDeclaration)
 * 		if links.serializedTypes == nil {
 * 			links.serializedTypes = make(map[CompositeTypeCacheIdentity]*SerializedTypeEntry)
 * 		}
 * 		links.serializedTypes[key] = &SerializedTypeEntry{
 * 			node:           result,
 * 			truncating:     b.ctx.truncating,
 * 			addedLength:    addedLength,
 * 			trackedSymbols: b.ctx.trackedSymbols,
 * 		}
 * 	}
 * 	b.ctx.visitedTypes.Delete(typeId)
 * 	if id != nil {
 * 		b.ctx.symbolDepth[*id] = depth
 * 	}
 * 	b.ctx.trackedSymbols = prevTrackedSymbols
 * 	return result
 * 
 * 	// !!! TODO: Attempt node reuse or parse nodes to minimize copying once text range setting is set up
 * 	// deepCloneOrReuseNode := func(node T) T {
 * 	// 	if !nodeIsSynthesized(node) && getParseTreeNode(node) == node {
 * 	// 		return node
 * 	// 	}
 * 	// 	return setTextRange(b.ctx, b.f.cloneNode(visitEachChildWorker(node, deepCloneOrReuseNode, nil /*b.ctx* /, deepCloneOrReuseNodes, deepCloneOrReuseNode)), node)
 * 	// }
 * 
 * 	// deepCloneOrReuseNodes := func(nodes *NodeArray[*ast.Node], visitor Visitor, test func(node *ast.Node) bool, start number, count number) *NodeArray[*ast.Node] {
 * 	// 	if nodes != nil && nodes.length == 0 {
 * 	// 		// Ensure we explicitly make a copy of an empty array; visitNodes will not do this unless the array has elements,
 * 	// 		// which can lead to us reusing the same empty NodeArray more than once within the same AST during type noding.
 * 	// 		return setTextRangeWorker(b.f.NewNodeArray(nil, nodes.hasTrailingComma), nodes)
 * 	// 	}
 * 	// 	return visitNodes(nodes, visitor, test, start, count)
 * 	// }
 * }
 */
export function NodeBuilderImpl_visitAndTransformType(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>, transform: (b: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>) => GoPtr<TypeNode>): GoPtr<TypeNode> {
  const typeId = t!.id;
  const isConstructorObject = (t!.objectFlags & ObjectFlagsAnonymous) !== 0 && t!.symbol !== undefined && (t!.symbol!.Flags & SymbolFlagsClass) !== 0;
  let id: GoPtr<CompositeSymbolIdentity>;
  if ((t!.objectFlags & ObjectFlagsReference) !== 0 && Type_AsTypeReference(t)!.node !== undefined) {
    id = { isConstructorNode: false, symbolId: 0 as SymbolId, nodeId: GetNodeId(Type_AsTypeReference(t)!.node) };
  } else if ((t!.flags & TypeFlagsConditional) !== 0) {
    id = { isConstructorNode: false, symbolId: 0 as SymbolId, nodeId: GetNodeId(Type_AsConditionalType(t)!.root!.node) };
  } else if (t!.symbol !== undefined) {
    id = { isConstructorNode: isConstructorObject, symbolId: GetSymbolId(t!.symbol), nodeId: 0 as NodeId };
  }
  const key: CompositeTypeCacheIdentity = { typeId: typeId, flags: receiver!.ctx!.flags, internalFlags: receiver!.ctx!.internalFlags };
  // Don't rely on type cache if we're expanding a type, because we need to compute `canIncreaseExpansionDepth`.
  const canUseCache = receiver!.ctx!.maxExpansionDepth < 0;
  if (canUseCache && receiver!.ctx!.enclosingDeclaration !== undefined && LinkStore_Has(receiver!.links as LinkStore<GoPtr<Node>, NodeBuilderLinks>, receiver!.ctx!.enclosingDeclaration)) {
    const links = LinkStore_Get(receiver!.links as LinkStore<GoPtr<Node>, NodeBuilderLinks>, receiver!.ctx!.enclosingDeclaration);
    const cachedResult = links!.serializedTypes?.get(key);
    if (cachedResult !== undefined) {
      for (const arg of cachedResult!.trackedSymbols ?? []) {
        receiver!.ctx!.tracker!.TrackSymbol(arg!.symbol, arg!.enclosingDeclaration, arg!.meaning);
      }
      if (cachedResult!.truncating) {
        receiver!.ctx!.truncating = true;
      }
      receiver!.ctx!.approximateLength += cachedResult!.addedLength;
      return NodeFactory_DeepCloneNode(receiver!.f, cachedResult!.node) as GoPtr<TypeNode>;
    }
  }
  let depth = 0;
  if (id !== undefined) {
    depth = receiver!.ctx!.symbolDepth.get(id) ?? 0;
    if (depth > 10) {
      return NodeBuilderImpl_createElidedInformationPlaceholder(receiver);
    }
    receiver!.ctx!.symbolDepth.set(id, depth + 1);
  }
  Set_Add(receiver!.ctx!.visitedTypes, typeId);
  const prevTrackedSymbols = receiver!.ctx!.trackedSymbols;
  receiver!.ctx!.trackedSymbols = [];
  const startLength = receiver!.ctx!.approximateLength;
  const result = transform(receiver, t);
  const addedLength = receiver!.ctx!.approximateLength - startLength;
  if (canUseCache && !receiver!.ctx!.reportedDiagnostic && !receiver!.ctx!.encounteredError) {
    const links = LinkStore_Get(receiver!.links as LinkStore<GoPtr<Node>, NodeBuilderLinks>, receiver!.ctx!.enclosingDeclaration);
    if (links!.serializedTypes === undefined) {
      links!.serializedTypes = NewGoStructMap<CompositeTypeCacheIdentity, GoPtr<SerializedTypeEntry>>();
    }
    links!.serializedTypes.set(key, {
      node: result,
      truncating: receiver!.ctx!.truncating,
      addedLength: addedLength,
      trackedSymbols: receiver!.ctx!.trackedSymbols,
    });
  }
  Set_Delete(receiver!.ctx!.visitedTypes, typeId);
  if (id !== undefined) {
    receiver!.ctx!.symbolDepth.set(id, depth);
  }
  receiver!.ctx!.trackedSymbols = prevTrackedSymbols;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.typeToTypeNode","kind":"method","status":"implemented","sigHash":"1e623e4e46ce3fa9fbf005b69ae03009a55e8cfcd0cb7f28722491040f2cd115","bodyHash":"5c732605b13897b3b16fefb3273a8038200e9c1b145b539741a04b9a4fb92807"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) typeToTypeNode(t *Type) *ast.TypeNode {
 * 	// Push type onto typeStack for expansion depth tracking
 * 	if b.ctx.maxExpansionDepth >= 0 && t != nil {
 * 		b.ctx.typeStack = append(b.ctx.typeStack, t)
 * 		defer func() {
 * 			b.ctx.typeStack = b.ctx.typeStack[:len(b.ctx.typeStack)-1]
 * 		}()
 * 	}
 * 
 * 	inTypeAlias := b.ctx.flags & nodebuilder.FlagsInTypeAlias
 * 	b.ctx.flags &^= nodebuilder.FlagsInTypeAlias
 * 
 * 	if t == nil {
 * 		if b.ctx.flags&nodebuilder.FlagsAllowEmptyUnionOrIntersection == 0 {
 * 			b.ctx.encounteredError = true
 * 			return nil
 * 			// TODO: GH#18217
 * 		}
 * 		b.ctx.approximateLength += 3
 * 		return b.f.NewKeywordTypeNode(ast.KindAnyKeyword)
 * 	}
 * 
 * 	if b.ctx.flags&nodebuilder.FlagsNoTypeReduction == 0 {
 * 		t = b.ch.getReducedType(t)
 * 	}
 * 
 * 	if t.flags&TypeFlagsAny != 0 {
 * 		if t.alias != nil {
 * 			return t.alias.ToTypeReferenceNode(b)
 * 		}
 * 		if t == b.ch.unresolvedType {
 * 			return b.e.AddSyntheticLeadingComment(b.f.NewKeywordTypeNode(ast.KindAnyKeyword), ast.KindMultiLineCommentTrivia, "unresolved", false /*hasTrailingNewLine* /)
 * 		}
 * 		b.ctx.approximateLength += 3
 * 		return b.f.NewKeywordTypeNode(core.IfElse(t == b.ch.intrinsicMarkerType, ast.KindIntrinsicKeyword, ast.KindAnyKeyword))
 * 	}
 * 	if t.flags&TypeFlagsUnknown != 0 {
 * 		return b.f.NewKeywordTypeNode(ast.KindUnknownKeyword)
 * 	}
 * 	if t.flags&TypeFlagsString != 0 {
 * 		b.ctx.approximateLength += 6
 * 		return b.f.NewKeywordTypeNode(ast.KindStringKeyword)
 * 	}
 * 	if t.flags&TypeFlagsNumber != 0 {
 * 		b.ctx.approximateLength += 6
 * 		return b.f.NewKeywordTypeNode(ast.KindNumberKeyword)
 * 	}
 * 	if t.flags&TypeFlagsBigInt != 0 {
 * 		b.ctx.approximateLength += 6
 * 		return b.f.NewKeywordTypeNode(ast.KindBigIntKeyword)
 * 	}
 * 	if t.flags&TypeFlagsBoolean != 0 && t.alias == nil {
 * 		b.ctx.approximateLength += 7
 * 		return b.f.NewKeywordTypeNode(ast.KindBooleanKeyword)
 * 	}
 * 	expandingEnum := false
 * 	if t.flags&TypeFlagsEnumLike != 0 {
 * 		if t.symbol.Flags&ast.SymbolFlagsEnumMember != 0 {
 * 			parentSymbol := b.ch.getParentOfSymbol(t.symbol)
 * 			parentName := b.symbolToTypeNode(parentSymbol, ast.SymbolFlagsType, nil)
 * 			if b.ch.getDeclaredTypeOfSymbol(parentSymbol) == t {
 * 				return parentName
 * 			}
 * 			memberName := ast.SymbolName(t.symbol)
 * 			if scanner.IsIdentifierText(memberName, core.LanguageVariantStandard) {
 * 				return b.appendReferenceToType(parentName /* as TypeReference | ImportTypeNode * /, b.f.NewTypeReferenceNode(b.f.NewIdentifier(memberName), nil /*typeArguments* /))
 * 			}
 * 			if ast.IsImportTypeNode(parentName) {
 * 				parentName.AsImportTypeNode().IsTypeOf = true
 * 				// mutably update, node is freshly manufactured anyhow
 * 				return b.f.NewIndexedAccessTypeNode(parentName, b.f.NewLiteralTypeNode(b.newStringLiteral(memberName)))
 * 			} else if ast.IsTypeReferenceNode(parentName) {
 * 				return b.f.NewIndexedAccessTypeNode(b.f.NewTypeQueryNode(parentName.AsTypeReferenceNode().TypeName, nil), b.f.NewLiteralTypeNode(b.newStringLiteral(memberName)))
 * 			} else {
 * 				panic("Unhandled type node kind returned from `symbolToTypeNode`.")
 * 			}
 * 		}
 * 		if t.flags&TypeFlagsUnion == 0 || !b.shouldExpandType(t, false /*isAlias* /) {
 * 			return b.symbolToTypeNode(t.symbol, ast.SymbolFlagsType, nil)
 * 		}
 * 		expandingEnum = true
 * 	}
 * 	if t.flags&TypeFlagsStringLiteral != 0 {
 * 		b.ctx.approximateLength += len(t.AsLiteralType().value.(string)) + 2
 * 		lit := b.newStringLiteral(t.AsLiteralType().value.(string))
 * 		b.e.AddEmitFlags(lit, printer.EFNoAsciiEscaping)
 * 		return b.f.NewLiteralTypeNode(lit)
 * 	}
 * 	if t.flags&TypeFlagsNumberLiteral != 0 {
 * 		value := t.AsLiteralType().value.(jsnum.Number)
 * 		b.ctx.approximateLength += len(value.String())
 * 		if value < 0 {
 * 			return b.f.NewLiteralTypeNode(b.f.NewPrefixUnaryExpression(ast.KindMinusToken, b.f.NewNumericLiteral(value.String()[1:], ast.TokenFlagsNone)))
 * 		} else {
 * 			return b.f.NewLiteralTypeNode(b.f.NewNumericLiteral(value.String(), ast.TokenFlagsNone))
 * 		}
 * 	}
 * 	if t.flags&TypeFlagsBigIntLiteral != 0 {
 * 		b.ctx.approximateLength += len(pseudoBigIntToString(getBigIntLiteralValue(t))) + 1
 * 		return b.f.NewLiteralTypeNode(b.f.NewBigIntLiteral(pseudoBigIntToString(getBigIntLiteralValue(t))+"n", ast.TokenFlagsNone))
 * 	}
 * 	if t.flags&TypeFlagsBooleanLiteral != 0 {
 * 		if t.AsLiteralType().value.(bool) {
 * 			b.ctx.approximateLength += 4
 * 			return b.f.NewLiteralTypeNode(b.f.NewKeywordExpression(ast.KindTrueKeyword))
 * 		} else {
 * 			b.ctx.approximateLength += 5
 * 			return b.f.NewLiteralTypeNode(b.f.NewKeywordExpression(ast.KindFalseKeyword))
 * 		}
 * 	}
 * 	if t.flags&TypeFlagsUniqueESSymbol != 0 {
 * 		if b.ctx.flags&nodebuilder.FlagsAllowUniqueESSymbolType == 0 {
 * 			if b.ch.IsValueSymbolAccessible(t.symbol, b.ctx.enclosingDeclaration) {
 * 				b.ctx.approximateLength += 6
 * 				return b.symbolToTypeNode(t.symbol, ast.SymbolFlagsValue, nil)
 * 			}
 * 			b.ctx.tracker.ReportInaccessibleUniqueSymbolError()
 * 		}
 * 		b.ctx.approximateLength += 13
 * 		return b.f.NewTypeOperatorNode(ast.KindUniqueKeyword, b.f.NewKeywordTypeNode(ast.KindSymbolKeyword))
 * 	}
 * 	if t.flags&TypeFlagsVoid != 0 {
 * 		b.ctx.approximateLength += 4
 * 		return b.f.NewKeywordTypeNode(ast.KindVoidKeyword)
 * 	}
 * 	if t.flags&TypeFlagsUndefined != 0 {
 * 		b.ctx.approximateLength += 9
 * 		return b.f.NewKeywordTypeNode(ast.KindUndefinedKeyword)
 * 	}
 * 	if t.flags&TypeFlagsNull != 0 {
 * 		b.ctx.approximateLength += 4
 * 		return b.f.NewLiteralTypeNode(b.f.NewKeywordExpression(ast.KindNullKeyword))
 * 	}
 * 	if t.flags&TypeFlagsNever != 0 {
 * 		b.ctx.approximateLength += 5
 * 		return b.f.NewKeywordTypeNode(ast.KindNeverKeyword)
 * 	}
 * 	if t.flags&TypeFlagsESSymbol != 0 {
 * 		b.ctx.approximateLength += 6
 * 		return b.f.NewKeywordTypeNode(ast.KindSymbolKeyword)
 * 	}
 * 	if t.flags&TypeFlagsNonPrimitive != 0 {
 * 		b.ctx.approximateLength += 6
 * 		return b.f.NewKeywordTypeNode(ast.KindObjectKeyword)
 * 	}
 * 	if isThisTypeParameter(t) {
 * 		if b.ctx.flags&nodebuilder.FlagsInObjectTypeLiteral != 0 {
 * 			if !b.ctx.encounteredError && b.ctx.flags&nodebuilder.FlagsAllowThisInObjectLiteral == 0 {
 * 				b.ctx.encounteredError = true
 * 			}
 * 			b.ctx.tracker.ReportInaccessibleThisError()
 * 		}
 * 		b.ctx.approximateLength += 4
 * 		return b.f.NewThisTypeNode()
 * 	}
 * 
 * 	if inTypeAlias == 0 && t.alias != nil && (b.ctx.flags&nodebuilder.FlagsUseAliasDefinedOutsideCurrentScope != 0 || b.ch.IsTypeSymbolAccessible(t.alias.Symbol(), b.ctx.enclosingDeclaration)) {
 * 		// If we should expand this type alias, skip the alias and fall through to expand the underlying type
 * 		if !b.shouldExpandType(t, true /*isAlias* /) {
 * 			sym := t.alias.Symbol()
 * 			typeArgumentNodes := b.mapToTypeNodes(t.alias.TypeArguments(), false /*isBareList* /)
 * 			if isReservedMemberName(sym.Name) && sym.Flags&ast.SymbolFlagsClass == 0 {
 * 				return b.f.NewTypeReferenceNode(b.f.NewIdentifier(""), typeArgumentNodes)
 * 			}
 * 			if typeArgumentNodes != nil && len(typeArgumentNodes.Nodes) == 1 && sym == b.ch.globalArrayType.symbol {
 * 				return b.f.NewArrayTypeNode(typeArgumentNodes.Nodes[0])
 * 			}
 * 			return b.symbolToTypeNode(sym, ast.SymbolFlagsType, typeArgumentNodes)
 * 		}
 * 		// Expanding: increment depth and process the underlying type
 * 		b.ctx.depth++
 * 		defer func() { b.ctx.depth-- }()
 * 	}
 * 
 * 	objectFlags := t.objectFlags
 * 
 * 	if objectFlags&ObjectFlagsReference != 0 {
 * 		debug.Assert(t.Flags()&TypeFlagsObject != 0)
 * 		// When expanding, expand type references to their structural form
 * 		if b.shouldExpandType(t, false /*isAlias* /) {
 * 			b.ctx.depth++
 * 			result := b.createAnonymousTypeNodeEx(t, true /*forceClassExpansion* /, true /*forceExpansion* /)
 * 			b.ctx.depth--
 * 			return result
 * 		}
 * 		if t.AsTypeReference().node != nil {
 * 			return b.visitAndTransformType(t, (*NodeBuilderImpl).typeReferenceToTypeNode)
 * 		} else {
 * 			return b.typeReferenceToTypeNode(t)
 * 		}
 * 	}
 * 	if t.flags&TypeFlagsTypeParameter != 0 || objectFlags&ObjectFlagsClassOrInterface != 0 {
 * 		// When expanding class or interface types, show their structural form
 * 		if objectFlags&ObjectFlagsClassOrInterface != 0 && b.shouldExpandType(t, false /*isAlias* /) {
 * 			b.ctx.depth++
 * 			result := b.createAnonymousTypeNodeEx(t, true /*forceClassExpansion* /, true /*forceExpansion* /)
 * 			b.ctx.depth--
 * 			return result
 * 		}
 * 		if t.flags&TypeFlagsTypeParameter != 0 && slices.Contains(b.ctx.inferTypeParameters, t) {
 * 			b.ctx.approximateLength += len(ast.SymbolName(t.symbol)) + 6
 * 			var constraintNode *ast.TypeNode
 * 			constraint := b.ch.getConstraintOfTypeParameter(t)
 * 			if constraint != nil {
 * 				// If the infer type has a constraint that is not the same as the constraint
 * 				// we would have normally inferred based on b, we emit the constraint
 * 				// using `infer T extends ?`. We omit inferred constraints from type references
 * 				// as they may be elided.
 * 				inferredConstraint := b.ch.getInferredTypeParameterConstraint(t, true /*omitTypeReferences* /)
 * 				if !(inferredConstraint != nil && b.ch.isTypeIdenticalTo(constraint, inferredConstraint)) {
 * 					b.ctx.approximateLength += 9
 * 					constraintNode = b.typeToTypeNode(constraint)
 * 				}
 * 			}
 * 			return b.f.NewInferTypeNode(b.typeParameterToDeclarationWithConstraint(t, constraintNode))
 * 		}
 * 		if b.ctx.flags&nodebuilder.FlagsGenerateNamesForShadowedTypeParams != 0 && t.flags&TypeFlagsTypeParameter != 0 {
 * 			name := b.typeParameterToName(t)
 * 			b.ctx.approximateLength += len(name.Text)
 * 			return b.f.NewTypeReferenceNode(b.newIdentifier(name.Text, t.symbol), nil /*typeArguments* /)
 * 		}
 * 		// Ignore constraint/default when creating a usage (as opposed to declaration) of a type parameter.
 * 		if t.symbol != nil {
 * 			return b.symbolToTypeNode(t.symbol, ast.SymbolFlagsType, nil)
 * 		}
 * 		var name string
 * 		if (t == b.ch.markerSuperTypeForCheck || t == b.ch.markerSubTypeForCheck) && b.ch.varianceTypeParameter != nil && b.ch.varianceTypeParameter.symbol != nil {
 * 			name = core.IfElse(t == b.ch.markerSubTypeForCheck, "sub-", "super-") + ast.SymbolName(b.ch.varianceTypeParameter.symbol)
 * 		} else {
 * 			name = "?"
 * 		}
 * 		return b.f.NewTypeReferenceNode(b.newIdentifier(name, nil /*symbol* /), nil /*typeArguments* /)
 * 	}
 * 	if t.flags&TypeFlagsUnion != 0 && t.AsUnionType().origin != nil {
 * 		t = t.AsUnionType().origin
 * 	}
 * 	if t.flags&(TypeFlagsUnion|TypeFlagsIntersection) != 0 {
 * 		var types []*Type
 * 		if t.flags&TypeFlagsUnion != 0 {
 * 			types = b.ch.formatUnionTypes(t.AsUnionType().types, expandingEnum)
 * 		} else {
 * 			types = t.AsIntersectionType().types
 * 		}
 * 		if len(types) == 1 {
 * 			return b.typeToTypeNode(types[0])
 * 		}
 * 		typeNodes := b.mapToTypeNodes(types, true /*isBareList* /)
 * 		if typeNodes != nil && len(typeNodes.Nodes) > 0 {
 * 			if t.flags&TypeFlagsUnion != 0 {
 * 				return b.f.NewUnionTypeNode(typeNodes)
 * 			} else {
 * 				return b.f.NewIntersectionTypeNode(typeNodes)
 * 			}
 * 		} else {
 * 			if !b.ctx.encounteredError && b.ctx.flags&nodebuilder.FlagsAllowEmptyUnionOrIntersection == 0 {
 * 				b.ctx.encounteredError = true
 * 			}
 * 			return nil
 * 			// TODO: GH#18217
 * 		}
 * 	}
 * 	if objectFlags&(ObjectFlagsAnonymous|ObjectFlagsMapped) != 0 {
 * 		debug.Assert(t.Flags()&TypeFlagsObject != 0)
 * 		// The type is an object literal type.
 * 		return b.createAnonymousTypeNode(t)
 * 	}
 * 	if t.flags&TypeFlagsIndex != 0 {
 * 		indexedType := t.Target()
 * 		b.ctx.approximateLength += 6
 * 		indexTypeNode := b.typeToTypeNode(indexedType)
 * 		return b.f.NewTypeOperatorNode(ast.KindKeyOfKeyword, indexTypeNode)
 * 	}
 * 	if t.flags&TypeFlagsTemplateLiteral != 0 {
 * 		texts := t.AsTemplateLiteralType().texts
 * 		types := t.AsTemplateLiteralType().types
 * 		templateHead := b.f.NewTemplateHead(texts[0], "", ast.TokenFlagsNone)
 * 		b.e.AddEmitFlags(templateHead, printer.EFNoAsciiEscaping)
 * 		templateSpans := b.f.NewNodeList(core.MapIndex(types, func(t *Type, i int) *ast.Node {
 * 			var res *ast.TemplateMiddleOrTail
 * 			if i < len(types)-1 {
 * 				res = b.f.NewTemplateMiddle(texts[i+1], "", ast.TokenFlagsNone)
 * 			} else {
 * 				res = b.f.NewTemplateTail(texts[i+1], "", ast.TokenFlagsNone)
 * 			}
 * 			b.e.AddEmitFlags(res, printer.EFNoAsciiEscaping)
 * 			return b.f.NewTemplateLiteralTypeSpan(b.typeToTypeNode(t), res)
 * 		}))
 * 		b.ctx.approximateLength += 2
 * 		return b.f.NewTemplateLiteralTypeNode(templateHead, templateSpans)
 * 	}
 * 	if t.flags&TypeFlagsStringMapping != 0 {
 * 		typeNode := b.typeToTypeNode(t.Target())
 * 		return b.symbolToTypeNode(t.AsStringMappingType().symbol, ast.SymbolFlagsType, b.f.NewNodeList([]*ast.Node{typeNode}))
 * 	}
 * 	if t.flags&TypeFlagsIndexedAccess != 0 {
 * 		objectTypeNode := b.typeToTypeNode(t.AsIndexedAccessType().objectType)
 * 		indexTypeNode := b.typeToTypeNode(t.AsIndexedAccessType().indexType)
 * 		b.ctx.approximateLength += 2
 * 		return b.f.NewIndexedAccessTypeNode(objectTypeNode, indexTypeNode)
 * 	}
 * 	if t.flags&TypeFlagsConditional != 0 {
 * 		return b.visitAndTransformType(t, (*NodeBuilderImpl).conditionalTypeToTypeNode)
 * 	}
 * 	if t.flags&TypeFlagsSubstitution != 0 {
 * 		typeNode := b.typeToTypeNode(t.AsSubstitutionType().baseType)
 * 		if !b.ch.isNoInferType(t) {
 * 			return typeNode
 * 		}
 * 		noInferSymbol := b.ch.getGlobalTypeAliasSymbol("NoInfer", 1, false)
 * 		if noInferSymbol != nil {
 * 			return b.symbolToTypeNode(noInferSymbol, ast.SymbolFlagsType, b.f.NewNodeList([]*ast.Node{typeNode}))
 * 		} else {
 * 			return typeNode
 * 		}
 * 	}
 * 
 * 	panic("Should be unreachable.")
 * }
 */
export function NodeBuilderImpl_typeToTypeNode(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<Type>): GoPtr<TypeNode> {
  const pushedType = receiver!.ctx!.maxExpansionDepth >= 0 && t !== undefined;
  if (pushedType) {
    receiver!.ctx!.typeStack.push(t);
  }
  try {
    const inTypeAlias = receiver!.ctx!.flags & FlagsInTypeAlias;
    receiver!.ctx!.flags &= ~FlagsInTypeAlias;
    if (t === undefined) {
      if ((receiver!.ctx!.flags & FlagsAllowEmptyUnionOrIntersection) === 0) {
        receiver!.ctx!.encounteredError = true;
        return undefined;
      }
      receiver!.ctx!.approximateLength += 3;
      return NewKeywordTypeNode(receiver!.f, KindAnyKeyword) as GoPtr<TypeNode>;
    }
    if ((receiver!.ctx!.flags & FlagsNoTypeReduction) === 0) {
      t = Checker_getReducedType(receiver!.ch, t);
    }
    if ((t!.flags & TypeFlagsAny) !== 0) {
      if (t!.alias !== undefined) {
        return TypeAlias_ToTypeReferenceNode(t!.alias, receiver) as GoPtr<TypeNode>;
      }
      if (t === receiver!.ch!.unresolvedType) {
        return EmitContext_AddSyntheticLeadingComment(receiver!.e, NewKeywordTypeNode(receiver!.f, KindAnyKeyword), KindMultiLineCommentTrivia, "unresolved", false) as GoPtr<TypeNode>;
      }
      receiver!.ctx!.approximateLength += 3;
      return NewKeywordTypeNode(receiver!.f, t === receiver!.ch!.intrinsicMarkerType ? KindIntrinsicKeyword : KindAnyKeyword) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsUnknown) !== 0) {
      return NewKeywordTypeNode(receiver!.f, KindUnknownKeyword) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsString) !== 0) {
      receiver!.ctx!.approximateLength += 6;
      return NewKeywordTypeNode(receiver!.f, KindStringKeyword) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsNumber) !== 0) {
      receiver!.ctx!.approximateLength += 6;
      return NewKeywordTypeNode(receiver!.f, KindNumberKeyword) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsBigInt) !== 0) {
      receiver!.ctx!.approximateLength += 6;
      return NewKeywordTypeNode(receiver!.f, KindBigIntKeyword) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsBoolean) !== 0 && t!.alias === undefined) {
      receiver!.ctx!.approximateLength += 7;
      return NewKeywordTypeNode(receiver!.f, KindBooleanKeyword) as GoPtr<TypeNode>;
    }
    let expandingEnum = false;
    if ((t!.flags & TypeFlagsEnumLike) !== 0) {
      if ((t!.symbol!.Flags & SymbolFlagsEnumMember) !== 0) {
        const parentSymbol = Checker_getParentOfSymbol(receiver!.ch, t!.symbol);
        const parentName = NodeBuilderImpl_symbolToTypeNode(receiver, parentSymbol, SymbolFlagsType, undefined);
        if (Checker_getDeclaredTypeOfSymbol(receiver!.ch, parentSymbol) === t) {
          return parentName;
        }
        const memberName = SymbolName(t!.symbol);
        if (IsIdentifierText(memberName, LanguageVariantStandard)) {
          return NodeBuilderImpl_appendReferenceToType(receiver, parentName, NewTypeReferenceNode(receiver!.f, NewIdentifier(receiver!.f, memberName), undefined) as GoPtr<TypeNode>);
        }
        if (IsImportTypeNode(parentName)) {
          AsImportTypeNode(parentName)!.IsTypeOf = true;
          return NewIndexedAccessTypeNode(receiver!.f, parentName, NewLiteralTypeNode(receiver!.f, NodeBuilderImpl_newStringLiteral(receiver, memberName))) as GoPtr<TypeNode>;
        }
        if (IsTypeReferenceNode(parentName)) {
          return NewIndexedAccessTypeNode(
            receiver!.f,
            NewTypeQueryNode(receiver!.f, AsTypeReferenceNode(parentName)!.TypeName, undefined),
            NewLiteralTypeNode(receiver!.f, NodeBuilderImpl_newStringLiteral(receiver, memberName)),
          ) as GoPtr<TypeNode>;
        }
        throw new globalThis.Error("Unhandled type node kind returned from `symbolToTypeNode`.");
      }
      if ((t!.flags & TypeFlagsUnion) === 0 || !NodeBuilderImpl_shouldExpandType(receiver, t, false)) {
        return NodeBuilderImpl_symbolToTypeNode(receiver, t!.symbol, SymbolFlagsType, undefined);
      }
      expandingEnum = true;
    }
    if ((t!.flags & TypeFlagsStringLiteral) !== 0) {
      const value = Type_AsLiteralType(t)!.value as string;
      receiver!.ctx!.approximateLength += value.length + 2;
      const literal = NodeBuilderImpl_newStringLiteral(receiver, value);
      EmitContext_AddEmitFlags(receiver!.e, literal, EFNoAsciiEscaping);
      return NewLiteralTypeNode(receiver!.f, literal) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsNumberLiteral) !== 0) {
      const value = Type_AsLiteralType(t)!.value as JsNumber;
      const text = Number_String(value);
      receiver!.ctx!.approximateLength += text.length;
      if (value < 0) {
        return NewLiteralTypeNode(receiver!.f, NewPrefixUnaryExpression(receiver!.f, KindMinusToken, NewNumericLiteral(receiver!.f, text.slice(1), TokenFlagsNone))) as GoPtr<TypeNode>;
      }
      return NewLiteralTypeNode(receiver!.f, NewNumericLiteral(receiver!.f, text, TokenFlagsNone)) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsBigIntLiteral) !== 0) {
      const text = pseudoBigIntToString(getBigIntLiteralValue(t));
      receiver!.ctx!.approximateLength += text.length + 1;
      return NewLiteralTypeNode(receiver!.f, NewBigIntLiteral(receiver!.f, text + "n", TokenFlagsNone)) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsBooleanLiteral) !== 0) {
      const value = Type_AsLiteralType(t)!.value as bool;
      receiver!.ctx!.approximateLength += value ? 4 : 5;
      return NewLiteralTypeNode(receiver!.f, NewKeywordExpression(receiver!.f, value ? KindTrueKeyword : KindFalseKeyword)) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsUniqueESSymbol) !== 0) {
      if ((receiver!.ctx!.flags & FlagsAllowUniqueESSymbolType) === 0) {
        if (Checker_IsValueSymbolAccessible(receiver!.ch, t!.symbol, receiver!.ctx!.enclosingDeclaration)) {
          receiver!.ctx!.approximateLength += 6;
          return NodeBuilderImpl_symbolToTypeNode(receiver, t!.symbol, SymbolFlagsValue, undefined);
        }
        receiver!.ctx!.tracker!.ReportInaccessibleUniqueSymbolError();
      }
      receiver!.ctx!.approximateLength += 13;
      return NewTypeOperatorNode(receiver!.f, KindUniqueKeyword, NewKeywordTypeNode(receiver!.f, KindSymbolKeyword) as GoPtr<TypeNode>) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsVoid) !== 0) {
      receiver!.ctx!.approximateLength += 4;
      return NewKeywordTypeNode(receiver!.f, KindVoidKeyword) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsUndefined) !== 0) {
      receiver!.ctx!.approximateLength += 9;
      return NewKeywordTypeNode(receiver!.f, KindUndefinedKeyword) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsNull) !== 0) {
      receiver!.ctx!.approximateLength += 4;
      return NewLiteralTypeNode(receiver!.f, NewKeywordExpression(receiver!.f, KindNullKeyword)) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsNever) !== 0) {
      receiver!.ctx!.approximateLength += 5;
      return NewKeywordTypeNode(receiver!.f, KindNeverKeyword) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsESSymbol) !== 0) {
      receiver!.ctx!.approximateLength += 6;
      return NewKeywordTypeNode(receiver!.f, KindSymbolKeyword) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsNonPrimitive) !== 0) {
      receiver!.ctx!.approximateLength += 6;
      return NewKeywordTypeNode(receiver!.f, KindObjectKeyword) as GoPtr<TypeNode>;
    }
    if (isThisTypeParameter(t)) {
      if ((receiver!.ctx!.flags & FlagsInObjectTypeLiteral) !== 0) {
        if (!receiver!.ctx!.encounteredError && (receiver!.ctx!.flags & FlagsAllowThisInObjectLiteral) === 0) {
          receiver!.ctx!.encounteredError = true;
        }
        receiver!.ctx!.tracker!.ReportInaccessibleThisError();
      }
      receiver!.ctx!.approximateLength += 4;
      return NewThisTypeNode(receiver!.f) as GoPtr<TypeNode>;
    }
    if (inTypeAlias === 0 && t!.alias !== undefined && ((receiver!.ctx!.flags & FlagsUseAliasDefinedOutsideCurrentScope) !== 0 || Checker_IsTypeSymbolAccessible(receiver!.ch, TypeAlias_Symbol(t!.alias), receiver!.ctx!.enclosingDeclaration))) {
      if (!NodeBuilderImpl_shouldExpandType(receiver, t, true)) {
        const sym = TypeAlias_Symbol(t!.alias);
        const typeArgumentNodes = NodeBuilderImpl_mapToTypeNodes(receiver, TypeAlias_TypeArguments(t!.alias), false);
        if (isReservedMemberName(sym!.Name) && (sym!.Flags & SymbolFlagsClass) === 0) {
          return NewTypeReferenceNode(receiver!.f, NewIdentifier(receiver!.f, ""), typeArgumentNodes) as GoPtr<TypeNode>;
        }
        if (typeArgumentNodes !== undefined && typeArgumentNodes.Nodes.length === 1 && sym === receiver!.ch!.globalArrayType!.symbol) {
          return NewArrayTypeNode(receiver!.f, typeArgumentNodes.Nodes[0] as GoPtr<TypeNode>) as GoPtr<TypeNode>;
        }
        return NodeBuilderImpl_symbolToTypeNode(receiver, sym, SymbolFlagsType, typeArgumentNodes);
      }
      receiver!.ctx!.depth++;
      try {
        return NodeBuilderImpl_typeToTypeNode(receiver, t);
      } finally {
        receiver!.ctx!.depth--;
      }
    }
    const objectFlags = t!.objectFlags;
    if ((objectFlags & ObjectFlagsReference) !== 0) {
      if (NodeBuilderImpl_shouldExpandType(receiver, t, false)) {
        receiver!.ctx!.depth++;
        try {
          return NodeBuilderImpl_createAnonymousTypeNodeEx(receiver, t, true, true);
        } finally {
          receiver!.ctx!.depth--;
        }
      }
      if (Type_AsTypeReference(t)!.node !== undefined) {
        return NodeBuilderImpl_visitAndTransformType(receiver, t, NodeBuilderImpl_typeReferenceToTypeNode);
      }
      return NodeBuilderImpl_typeReferenceToTypeNode(receiver, t);
    }
    if ((t!.flags & TypeFlagsTypeParameter) !== 0 || (objectFlags & ObjectFlagsClassOrInterface) !== 0) {
      if ((objectFlags & ObjectFlagsClassOrInterface) !== 0 && NodeBuilderImpl_shouldExpandType(receiver, t, false)) {
        receiver!.ctx!.depth++;
        try {
          return NodeBuilderImpl_createAnonymousTypeNodeEx(receiver, t, true, true);
        } finally {
          receiver!.ctx!.depth--;
        }
      }
      if ((t!.flags & TypeFlagsTypeParameter) !== 0 && slices.Contains(receiver!.ctx!.inferTypeParameters, t)) {
        receiver!.ctx!.approximateLength += SymbolName(t!.symbol).length + 6;
        let constraintNode: GoPtr<TypeNode>;
        const constraint = Checker_getConstraintOfTypeParameter(receiver!.ch, t);
        if (constraint !== undefined) {
          const inferredConstraint = Checker_getInferredTypeParameterConstraint(receiver!.ch, t, true);
          if (!(inferredConstraint !== undefined && Checker_isTypeIdenticalTo(receiver!.ch, constraint, inferredConstraint))) {
            receiver!.ctx!.approximateLength += 9;
            constraintNode = NodeBuilderImpl_typeToTypeNode(receiver, constraint);
          }
        }
        return NewInferTypeNode(receiver!.f, NodeBuilderImpl_typeParameterToDeclarationWithConstraint(receiver, t, constraintNode)) as GoPtr<TypeNode>;
      }
      if ((receiver!.ctx!.flags & FlagsGenerateNamesForShadowedTypeParams) !== 0 && (t!.flags & TypeFlagsTypeParameter) !== 0) {
        const name = NodeBuilderImpl_typeParameterToName(receiver, t);
        receiver!.ctx!.approximateLength += name!.Text.length;
        return NewTypeReferenceNode(receiver!.f, NodeBuilderImpl_newIdentifier(receiver, name!.Text, t!.symbol), undefined) as GoPtr<TypeNode>;
      }
      if (t!.symbol !== undefined) {
        return NodeBuilderImpl_symbolToTypeNode(receiver, t!.symbol, SymbolFlagsType, undefined);
      }
      const name = (t === receiver!.ch!.markerSuperTypeForCheck || t === receiver!.ch!.markerSubTypeForCheck) && receiver!.ch!.varianceTypeParameter !== undefined && receiver!.ch!.varianceTypeParameter!.symbol !== undefined
        ? (t === receiver!.ch!.markerSubTypeForCheck ? "sub-" : "super-") + SymbolName(receiver!.ch!.varianceTypeParameter!.symbol)
        : "?";
      return NewTypeReferenceNode(receiver!.f, NodeBuilderImpl_newIdentifier(receiver, name, undefined), undefined) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsUnion) !== 0 && Type_AsUnionType(t)!.origin !== undefined) {
      t = Type_AsUnionType(t)!.origin;
    }
    if ((t!.flags & (TypeFlagsUnion | TypeFlagsIntersection)) !== 0) {
      const types = (t!.flags & TypeFlagsUnion) !== 0
        ? Checker_formatUnionTypes(receiver!.ch, Type_AsUnionOrIntersectionType(t)!.types, expandingEnum)
        : Type_AsUnionOrIntersectionType(t)!.types;
      if (types.length === 1) {
        return NodeBuilderImpl_typeToTypeNode(receiver, types[0]);
      }
      const typeNodes = NodeBuilderImpl_mapToTypeNodes(receiver, types, true);
      if (typeNodes !== undefined && typeNodes.Nodes.length > 0) {
        return ((t!.flags & TypeFlagsUnion) !== 0 ? NewUnionTypeNode(receiver!.f, typeNodes) : NewIntersectionTypeNode(receiver!.f, typeNodes)) as GoPtr<TypeNode>;
      }
      if (!receiver!.ctx!.encounteredError && (receiver!.ctx!.flags & FlagsAllowEmptyUnionOrIntersection) === 0) {
        receiver!.ctx!.encounteredError = true;
      }
      return undefined;
    }
    if ((objectFlags & (ObjectFlagsAnonymous | ObjectFlagsMapped)) !== 0) {
      return NodeBuilderImpl_createAnonymousTypeNode(receiver, t);
    }
    if ((t!.flags & TypeFlagsIndex) !== 0) {
      const indexedType = Type_Target(t);
      receiver!.ctx!.approximateLength += 6;
      return NewTypeOperatorNode(receiver!.f, KindKeyOfKeyword, NodeBuilderImpl_typeToTypeNode(receiver, indexedType)) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsTemplateLiteral) !== 0) {
      const templateType = Type_AsTemplateLiteralType(t);
      const texts = templateType!.texts;
      const types = templateType!.types;
      const templateHead = NewTemplateHead(receiver!.f, texts[0] ?? "", "", TokenFlagsNone);
      EmitContext_AddEmitFlags(receiver!.e, templateHead, EFNoAsciiEscaping);
      const templateSpans = NodeFactory_NewNodeList(receiver!.f, MapIndex(types, (typePart: GoPtr<Type>, index: int): GoPtr<Node> => {
        const literal = index < types.length - 1
          ? NewTemplateMiddle(receiver!.f, texts[index + 1] ?? "", "", TokenFlagsNone)
          : NewTemplateTail(receiver!.f, texts[index + 1] ?? "", "", TokenFlagsNone);
        EmitContext_AddEmitFlags(receiver!.e, literal, EFNoAsciiEscaping);
        return NewTemplateLiteralTypeSpan(receiver!.f, NodeBuilderImpl_typeToTypeNode(receiver, typePart), literal as GoPtr<Node>);
      }));
      receiver!.ctx!.approximateLength += 2;
      return NewTemplateLiteralTypeNode(receiver!.f, templateHead as never, templateSpans as never) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsStringMapping) !== 0) {
      const typeNode = NodeBuilderImpl_typeToTypeNode(receiver, Type_Target(t));
      return NodeBuilderImpl_symbolToTypeNode(receiver, t!.symbol, SymbolFlagsType, NodeFactory_NewNodeList(receiver!.f, [typeNode]));
    }
    if ((t!.flags & TypeFlagsIndexedAccess) !== 0) {
      const objectTypeNode = NodeBuilderImpl_typeToTypeNode(receiver, Type_AsIndexedAccessType(t)!.objectType);
      const indexTypeNode = NodeBuilderImpl_typeToTypeNode(receiver, Type_AsIndexedAccessType(t)!.indexType);
      receiver!.ctx!.approximateLength += 2;
      return NewIndexedAccessTypeNode(receiver!.f, objectTypeNode, indexTypeNode) as GoPtr<TypeNode>;
    }
    if ((t!.flags & TypeFlagsConditional) !== 0) {
      return NodeBuilderImpl_visitAndTransformType(receiver, t, NodeBuilderImpl_conditionalTypeToTypeNode);
    }
    if ((t!.flags & TypeFlagsSubstitution) !== 0) {
      const typeNode = NodeBuilderImpl_typeToTypeNode(receiver, Type_AsSubstitutionType(t)!.baseType);
      if (!Checker_isNoInferType(receiver!.ch, t)) {
        return typeNode;
      }
      const noInferSymbol = Checker_getGlobalTypeAliasSymbol(receiver!.ch, "NoInfer", 1, false);
      if (noInferSymbol !== undefined) {
        return NodeBuilderImpl_symbolToTypeNode(receiver, noInferSymbol, SymbolFlagsType, NodeFactory_NewNodeList(receiver!.f, [typeNode]));
      }
      return typeNode;
    }
    throw new globalThis.Error("Should be unreachable.");
  } finally {
    if (pushedType) {
      receiver!.ctx!.typeStack.pop();
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.newStringLiteral","kind":"method","status":"implemented","sigHash":"a889a5a78674a4d64812c707dc9471836ec0bd15867aaa83672860d766a4c8c1","bodyHash":"23bb9e8fa2a58aa4839104b9c363c36e4acbcf2a63c009858dab1f3b6306711c"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) newStringLiteral(text string) *ast.Node {
 * 	return b.newStringLiteralEx(text, false /*isSingleQuote* /)
 * }
 */
export function NodeBuilderImpl_newStringLiteral(receiver: GoPtr<NodeBuilderImpl>, text: string): GoPtr<Node> {
  return NodeBuilderImpl_newStringLiteralEx(receiver, text, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.newStringLiteralEx","kind":"method","status":"implemented","sigHash":"8882027e312febbc9a30e6ea9d151d1984c80e69fa13745c0c98a3ee41dd0d74","bodyHash":"08236c7b6c47156ab0d491b3256eb040b26e728576ef02726338cd860bbd9a09"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) newStringLiteralEx(text string, isSingleQuote bool) *ast.Node {
 * 	flags := ast.TokenFlagsNone
 * 	if isSingleQuote || b.ctx.flags&nodebuilder.FlagsUseSingleQuotesForStringLiteralType != 0 {
 * 		flags |= ast.TokenFlagsSingleQuote
 * 	}
 * 	node := b.f.NewStringLiteral(text, flags)
 * 	return node
 * }
 */
export function NodeBuilderImpl_newStringLiteralEx(receiver: GoPtr<NodeBuilderImpl>, text: string, isSingleQuote: bool): GoPtr<Node> {
  const flags: TokenFlags = (isSingleQuote || (receiver!.ctx!.flags & FlagsUseSingleQuotesForStringLiteralType) !== 0)
    ? TokenFlagsSingleQuote
    : TokenFlagsNone;
  return NewStringLiteral(receiver!.f, text, flags);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::TypeAlias.ToTypeReferenceNode","kind":"method","status":"implemented","sigHash":"c560a102bc5b4febf5266380be9bd3a0d7d02a8c1d6b2ba92ee957d35db0f7c4","bodyHash":"80a96e8a6579f577e56044320dfd5d3d583ec4e93e5250ae8e5db20cb3341d81"}
 *
 * Go source:
 * func (t *TypeAlias) ToTypeReferenceNode(b *NodeBuilderImpl) *ast.Node {
 * 	return b.f.NewTypeReferenceNode(b.symbolToEntityNameNode(t.Symbol()), b.mapToTypeNodes(t.TypeArguments(), false /*isBareList* /))
 * }
 */
export function TypeAlias_ToTypeReferenceNode(receiver: GoPtr<TypeAlias>, b: GoPtr<NodeBuilderImpl>): GoPtr<Node> {
  return NewTypeReferenceNode(b!.f, NodeBuilderImpl_symbolToEntityNameNode(b, TypeAlias_Symbol(receiver)), NodeBuilderImpl_mapToTypeNodes(b, TypeAlias_TypeArguments(receiver), false as bool));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.newIdentifier","kind":"method","status":"implemented","sigHash":"db482639787f9a34aed0a726dbeb1a127325dba2e06724c8961c25e623ed3be8","bodyHash":"d1541a0b7e6723c0e5face0f609e2bfc932d76ccae3c7f51f8337f1ee84d4cbc"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) newIdentifier(text string, symbol *ast.Symbol) *ast.Node {
 * 	id := b.f.NewIdentifier(text)
 * 	if symbol != nil {
 * 		b.idToSymbol[id] = symbol
 * 	}
 * 	return id
 * }
 */
export function NodeBuilderImpl_newIdentifier(receiver: GoPtr<NodeBuilderImpl>, text: string, symbol_: GoPtr<Symbol>): GoPtr<Node> {
  const id = NewIdentifier(receiver!.f, text);
  if (symbol_ !== undefined) {
    receiver!.idToSymbol!.set(id as GoPtr<IdentifierNode>, symbol_);
  }
  return id;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.createAccessExpression","kind":"method","status":"implemented","sigHash":"ed7b4a1e37b1cf780498c3408755723af03e9d239422dbe6a0aafe87ab66e38b","bodyHash":"ac017ce651406418d348a57622c829d2d1501a303ff88940a9263ee893764954"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) createAccessExpression(node *ast.Node) *ast.Expression {
 * 	switch {
 * 	case ast.IsQualifiedName(node):
 * 		return b.f.NewPropertyAccessExpression(b.createAccessExpression(node.AsQualifiedName().Left), nil /*questionDotToken* /, b.f.DeepCloneNode(node.AsQualifiedName().Right), ast.NodeFlagsNone)
 * 	case ast.IsIdentifier(node), ast.IsPropertyAccessExpression(node), ast.IsExpressionWithTypeArguments(node):
 * 		return b.f.DeepCloneNode(node)
 * 	default:
 * 		panic("unexpected access node kind: " + node.Kind.String())
 * 	}
 * }
 */
export function NodeBuilderImpl_createAccessExpression(receiver: GoPtr<NodeBuilderImpl>, node: GoPtr<Node>): GoPtr<Expression> {
  if (IsQualifiedName(node)) {
    const qn = AsQualifiedName(node);
    return NewPropertyAccessExpression(receiver!.f, NodeBuilderImpl_createAccessExpression(receiver, qn!.Left), undefined, NodeFactory_DeepCloneNode(receiver!.f, qn!.Right), NodeFlagsNone);
  }
  if (IsIdentifier(node) || IsPropertyAccessExpression(node) || IsExpressionWithTypeArguments(node)) {
    return NodeFactory_DeepCloneNode(receiver!.f, node);
  }
  throw new globalThis.Error("unexpected access node kind");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.createExpressionWithTypeArguments","kind":"method","status":"implemented","sigHash":"3c274b63a5a251102eb054bf8f5668e7f60f325680285d2b728473350053414f","bodyHash":"b2fa40a8ee270b2d389d86ec5acb505c1eb79db026d6a7ba648a701dd402c8f1"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) createExpressionWithTypeArguments(expr *ast.Expression, typeArguments *ast.NodeList) *ast.Expression {
 * 	if typeArguments == nil || len(typeArguments.Nodes) == 0 {
 * 		return expr
 * 	}
 * 	return b.f.NewExpressionWithTypeArguments(expr, typeArguments)
 * }
 */
export function NodeBuilderImpl_createExpressionWithTypeArguments(receiver: GoPtr<NodeBuilderImpl>, expr: GoPtr<Expression>, typeArguments: GoPtr<NodeList>): GoPtr<Expression> {
  if (typeArguments === undefined || typeArguments.Nodes.length === 0) {
    return expr;
  }
  return NewExpressionWithTypeArguments(receiver!.f, expr, typeArguments);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.lookupInstantiatedTypeArgumentNodes","kind":"method","status":"implemented","sigHash":"5a82887a323e0f5c3ccb8e2adf7ac9c58a6715d769e2d79fa6bc44b585fe23e0","bodyHash":"681c7c4f6ecf635b133c92436a975488e2ce04dcdbcdb5072da207da4cfbc0e7"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) lookupInstantiatedTypeArgumentNodes(chain []*ast.Symbol, index int) *ast.TypeParameterList {
 * 	if b.shouldWriteTypeParametersInQualifiedName(chain, index) {
 * 		symbol := chain[index]
 * 		nextSymbol := chain[index+1]
 * 		if nextSymbol.CheckFlags&ast.CheckFlagsInstantiated == 0 {
 * 			return nil
 * 		}
 * 
 * 		targetSymbol := symbol
 * 		if symbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 			targetSymbol = b.ch.resolveAlias(symbol)
 * 		}
 * 
 * 		params := b.getTypeParametersOfClassOrInterface(targetSymbol)
 * 		targetMapper := b.ch.valueSymbolLinks.Get(nextSymbol).mapper
 * 		if targetMapper != nil {
 * 			params = core.Map(params, targetMapper.Map)
 * 		}
 * 		return b.mapToTypeNodes(params, false /*isBareList* /)
 * 	}
 * 	return nil
 * }
 */
export function NodeBuilderImpl_lookupInstantiatedTypeArgumentNodes(receiver: GoPtr<NodeBuilderImpl>, chain: GoSlice<GoPtr<Symbol>>, index: int): GoPtr<TypeParameterList> {
  if (NodeBuilderImpl_shouldWriteTypeParametersInQualifiedName(receiver, chain, index)) {
    const symbol_ = chain[index];
    const nextSymbol = chain[index + 1];
    if ((nextSymbol!.CheckFlags & CheckFlagsInstantiated) === 0) {
      return undefined;
    }
    let targetSymbol = symbol_;
    if ((symbol_!.Flags & SymbolFlagsAlias) !== 0) {
      targetSymbol = Checker_resolveAlias(receiver!.ch, symbol_);
    }
    let params = NodeBuilderImpl_getTypeParametersOfClassOrInterface(receiver, targetSymbol);
    const targetMapper = LinkStore_Get<GoPtr<Symbol>, ValueSymbolLinks>(receiver!.ch!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, nextSymbol)!.mapper;
    if (targetMapper !== undefined) {
      params = CoreMap(params, (param) => TypeMapper_Map(targetMapper, param));
    }
    return NodeBuilderImpl_mapToTypeNodes(receiver, params, false as bool) as GoPtr<TypeParameterList>;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.lookupExpressionChainTypeArgumentNodes","kind":"method","status":"implemented","sigHash":"8e5f7188bc4fb046d762d3c0430bbb819f67804a39abeeb3f1dabf3ddc20649f","bodyHash":"3766a6a6d058ade253d889b2e20354278169021ef00356b7bfbd90f8f914663f"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) lookupExpressionChainTypeArgumentNodes(chain []*ast.Symbol, index int) *ast.TypeParameterList {
 * 	if b.shouldWriteTypeParametersInQualifiedName(chain, index) {
 * 		symbol := chain[index]
 * 		symbolId := ast.GetSymbolId(symbol)
 * 		if b.ctx.typeParameterSymbolList.Has(symbolId) {
 * 			return nil
 * 		}
 *
 * 		b.ctx.typeParameterSymbolList.Add(symbolId)
 * 		if typeArgumentNodes := b.lookupInstantiatedTypeArgumentNodes(chain, index); typeArgumentNodes != nil {
 * 			return typeArgumentNodes
 * 		}
 * 		typeParameterNodes := b.typeParametersToTypeParameterDeclarations(symbol)
 * 		if len(typeParameterNodes) > 0 {
 * 			return b.f.NewNodeList(typeParameterNodes)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function NodeBuilderImpl_lookupExpressionChainTypeArgumentNodes(receiver: GoPtr<NodeBuilderImpl>, chain: GoSlice<GoPtr<Symbol>>, index: int): GoPtr<TypeParameterList> {
  if (NodeBuilderImpl_shouldWriteTypeParametersInQualifiedName(receiver, chain, index)) {
    const symbol_ = chain[index];
    const symbolId = GetSymbolId(symbol_);
    if (CopyOnWriteSet_Has(receiver!.ctx!.typeParameterSymbolList, symbolId)) {
      return undefined;
    }
    CopyOnWriteSet_Add(receiver!.ctx!.typeParameterSymbolList, symbolId);
    const typeArgumentNodes = NodeBuilderImpl_lookupInstantiatedTypeArgumentNodes(receiver, chain, index);
    if (typeArgumentNodes !== undefined) {
      return typeArgumentNodes;
    }
    const typeParameterNodes = NodeBuilderImpl_typeParametersToTypeParameterDeclarations(receiver, symbol_);
    if (typeParameterNodes !== undefined && typeParameterNodes.length > 0) {
      return NodeFactory_NewNodeList(receiver!.f, typeParameterNodes);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderimpl.go::method::NodeBuilderImpl.shouldWriteTypeParametersInQualifiedName","kind":"method","status":"implemented","sigHash":"f60443bdcde1d2b8c805e2566068c22200171e6a91360b249d584a9b0002620d","bodyHash":"8bd6115ca0d8d9d6624d86ce3e05147642ac7077323f62de51ad70d528817222"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) shouldWriteTypeParametersInQualifiedName(chain []*ast.Symbol, index int) bool {
 * 	return b.ctx.flags&nodebuilder.FlagsWriteTypeParametersInQualifiedName != 0 && index < len(chain)-1
 * }
 */
export function NodeBuilderImpl_shouldWriteTypeParametersInQualifiedName(receiver: GoPtr<NodeBuilderImpl>, chain: GoSlice<GoPtr<Symbol>>, index: int): bool {
  return (receiver!.ctx!.flags & FlagsWriteTypeParametersInQualifiedName) !== 0 && index < chain.length - 1;
}
