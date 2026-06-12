import type { bool, int } from "@tsonic/core/types.js";
import * as strconv from "../../go/strconv.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import { Pool } from "../../go/sync.js";
import {
  Node_Arguments,
  Node_Body,
  Node_Elements,
  Node_Expression,
  Node_Initializer,
  Node_Label,
  Node_LocalSymbol,
  Node_Parameters,
  Node_PostfixToken,
  Node_Properties,
  Node_QuestionDotToken,
  Node_StatementList,
  Node_Statements,
  Node_Symbol,
  Node_Text,
  Node_Type,
  Node_TypeArgumentList,
  AsSourceFile,
  IsLocalsContainer,
  SourceFile_BindDiagnostics,
  SourceFile_BindOnce,
  SourceFile_Diagnostics,
  SourceFile_FileName,
  SourceFile_IsBound,
  SourceFile_SetBindDiagnostics,
} from "../ast/ast.js";
import type { ModifierList, Node, NodeList, SourceFile } from "../ast/ast.js";
import type { BinaryExpression } from "../ast/ast_generated.js";
import {
  AsBinaryExpression,
  AsBindingElement,
  AsCallExpression,
  AsCaseBlock,
  AsCaseOrDefaultClause,
  AsCatchClause,
  AsClassStaticBlockDeclaration,
  AsConditionalExpression,
  AsConditionalTypeNode,
  AsConstructorDeclaration,
  AsDeleteExpression,
  AsDoStatement,
  AsElementAccessExpression,
  AsExpressionStatement,
  AsExportAssignment,
  AsExportDeclaration,
  AsExportSpecifier,
  AsForStatement,
  AsForInOrOfStatement,
  AsFunctionDeclaration,
  AsFunctionExpression,
  AsIdentifier,
  AsIfStatement,
  AsImportClause,
  AsImportEqualsDeclaration,
  AsKeywordExpression,
  AsLabeledStatement,
  AsMetaProperty,
  AsModuleDeclaration,
  AsParameterDeclaration,
  AsPostfixUnaryExpression,
  AsPrefixUnaryExpression,
  AsPropertyAccessExpression,
  AsQualifiedName,
  AsReturnStatement,
  AsShorthandPropertyAssignment,
  AsSwitchStatement,
  AsTryStatement,
  AsTypeAliasDeclaration,
  AsVariableDeclaration,
  AsWhileStatement,
} from "../ast/generated/casts.js";
import {
  KindAmpersandAmpersandToken,
  KindAmpersandAmpersandEqualsToken,
  KindArrowFunction,
  KindBarBarEqualsToken,
  KindBinaryExpression,
  KindBlock,
  KindCallExpression,
  KindCallSignature,
  KindCaseBlock,
  KindCatchClause,
  KindClassDeclaration,
  KindClassExpression,
  KindClassStaticBlockDeclaration,
  KindCommaToken,
  KindConditionalExpression,
  KindConstructor,
  KindConstructorType,
  KindConstructSignature,
  KindDoStatement,
  KindElementAccessExpression,
  KindEnumDeclaration,
  KindEqualsEqualsEqualsToken,
  KindEqualsEqualsToken,
  KindEqualsToken,
  KindExclamationEqualsEqualsToken,
  KindExclamationEqualsToken,
  KindExclamationToken,
  KindFalseKeyword,
  KindFirstStatement,
  KindForInStatement,
  KindForOfStatement,
  KindForStatement,
  KindFunctionDeclaration,
  KindFunctionExpression,
  KindFunctionType,
  KindGetAccessor,
  KindIdentifier,
  KindIfStatement,
  KindIndexSignature,
  KindInferType,
  KindInKeyword,
  KindInstanceOfKeyword,
  KindInterfaceDeclaration,
  KindJSTypeAliasDeclaration,
  KindJsxAttributes,
  KindLabeledStatement,
  KindLastStatement,
  KindLastToken,
  KindMappedType,
  KindMetaProperty,
  KindMethodDeclaration,
  KindMethodSignature,
  KindMinusToken,
  KindMinusMinusToken,
  KindModuleBlock,
  KindModuleDeclaration,
  KindNonNullExpression,
  KindObjectLiteralExpression,
  KindParenthesizedExpression,
  KindPlusToken,
  KindPlusPlusToken,
  KindPrefixUnaryExpression,
  KindPropertyAccessExpression,
  KindPropertyDeclaration,
  KindQuestionQuestionEqualsToken,
  KindQuestionToken,
  KindSetAccessor,
  KindSourceFile,
  KindSuperKeyword,
  KindThisKeyword,
  KindTrueKeyword,
  KindTypeAliasDeclaration,
  KindTypeLiteral,
  KindTypeOfExpression,
  KindArrayLiteralExpression,
  KindAwaitKeyword,
  KindBindingElement,
  KindBreakStatement,
  KindCaseClause,
  KindContinueStatement,
  KindDefaultClause,
  KindDeleteExpression,
  KindEndOfFile,
  KindExportSpecifier,
  KindExpressionStatement,
  KindFirstFutureReservedWord,
  KindImportClause,
  KindImportEqualsDeclaration,
  KindImportSpecifier,
  KindJsxAttribute,
  KindLastFutureReservedWord,
  KindNamespaceExportDeclaration,
  KindNamespaceImport,
  KindParameter,
  KindPostfixUnaryExpression,
  KindPrivateIdentifier,
  KindPropertyAssignment,
  KindPropertySignature,
  KindQualifiedName,
  KindReturnStatement,
  KindShorthandPropertyAssignment,
  KindSpreadAssignment,
  KindSpreadElement,
  KindSwitchStatement,
  KindThisType,
  KindThrowStatement,
  KindTryStatement,
  KindTypeParameter,
  KindVariableDeclaration,
  KindVariableDeclarationList,
  KindWhileStatement,
  KindWithStatement,
  KindEnumMember,
  KindExportDeclaration,
  KindExportAssignment,
  KindYieldKeyword,
} from "../ast/generated/kinds.js";
import {
  IsAssignmentOperator,
  IsBinaryExpression,
  IsCallExpression,
  IsClassDeclaration,
  IsClassStaticBlockDeclaration,
  IsComputedPropertyName,
  IsConditionalTypeNode,
  IsExportAssignment,
  IsExportDeclaration,
  IsExportSpecifier,
  IsExpressionStatement,
  IsFunctionDeclaration,
  IsFunctionExpression,
  IsIdentifier,
  IsJsxNamespacedName,
  IsJSTypeAliasDeclaration,
  IsLogicalOrCoalescingAssignmentOperator,
  IsModuleBlock,
  IsModuleDeclaration,
  IsNamespaceExport,
  IsNonNullExpression,
  IsNumericLiteral,
  IsParenthesizedExpression,
  IsPrivateIdentifier,
  IsPrefixUnaryExpression,
  IsPropertyAccessExpression,
  IsSourceFile,
  IsStringLiteral,
  IsTypeAliasDeclaration,
  IsTypeOfExpression,
  IsVariableDeclaration,
  IsVariableStatement,
} from "../ast/generated/predicates.js";
import { Diagnostic_AddRelatedInfo, Diagnostic_SetCategory, NewDiagnostic } from "../ast/diagnostic.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import {
  FlowFlagsArrayMutation,
  FlowFlagsBranchLabel,
  FlowFlagsCall,
  FlowFlagsAssignment,
  FlowFlagsFalseCondition,
  FlowFlagsLoopLabel,
  FlowFlagsReferenced,
  FlowFlagsReduceLabel,
  FlowFlagsShared,
  FlowFlagsStart,
  FlowFlagsSwitchClause,
  FlowFlagsTrueCondition,
  FlowFlagsUnreachable,
  NewFlowReduceLabelData,
  NewFlowSwitchClauseData,
} from "../ast/flow.js";
import type { FlowFlags, FlowLabel, FlowList, FlowNode } from "../ast/flow.js";
import {
  NodeFlagsAmbient,
  NodeFlagsAwaitContext,
  NodeFlagsContainsThis,
  NodeFlagsConst,
  NodeFlagsExportContext,
  NodeFlagsHasAsyncFunctions,
  NodeFlagsHasExplicitReturn,
  NodeFlagsHasImplicitReturn,
  NodeFlagsJSDoc,
  NodeFlagsOptionalChain,
  NodeFlagsReachabilityAndEmitFlags,
  NodeFlagsThisNodeHasError,
  NodeFlagsThisNodeOrAnySubNodesHasError,
  NodeFlagsUnreachable,
  NodeFlagsYieldContext,
} from "../ast/nodeflags.js";
import type { NodeFlags } from "../ast/nodeflags.js";
import {
  InternalSymbolNameAssignmentDeclaration,
  InternalSymbolNameCall,
  InternalSymbolNameClass,
  InternalSymbolNameComputed,
  InternalSymbolNameConstructor,
  InternalSymbolNameDefault,
  InternalSymbolNameExportEquals,
  InternalSymbolNameExportStar,
  InternalSymbolNameFunction,
  InternalSymbolNameGlobal,
  InternalSymbolNameIndex,
  InternalSymbolNameJSXAttributes,
  InternalSymbolNameMissing,
  InternalSymbolNameNew,
  InternalSymbolNameObject,
  InternalSymbolNamePrefix,
  InternalSymbolNameType,
  SymbolName,
} from "../ast/symbol.js";
import type { Symbol, SymbolTable } from "../ast/symbol.js";
import {
  SymbolFlagsAccessor,
  SymbolFlagsAlias,
  SymbolFlagsBlockScopedVariable,
  SymbolFlagsBlockScopedVariableExcludes,
  SymbolFlagsClass,
  SymbolFlagsClassExcludes,
  SymbolFlagsClassMember,
  SymbolFlagsConstEnum,
  SymbolFlagsConstEnumExcludes,
  SymbolFlagsConstEnumOnlyModule,
  SymbolFlagsConstructor,
  SymbolFlagsEnum,
  SymbolFlagsEnumMember,
  SymbolFlagsEnumMemberExcludes,
  SymbolFlagsExportStar,
  SymbolFlagsExportValue,
  SymbolFlagsFunction,
  SymbolFlagsFunctionExcludes,
  SymbolFlagsFunctionScopedVariable,
  SymbolFlagsFunctionScopedVariableExcludes,
  SymbolFlagsInterface,
  SymbolFlagsModuleExports,
  SymbolFlagsNamespaceModule,
  SymbolFlagsNamespaceModuleExcludes,
  SymbolFlagsNone,
  SymbolFlagsObjectLiteral,
  SymbolFlagsOptional,
  SymbolFlagsParameterExcludes,
  SymbolFlagsProperty,
  SymbolFlagsPropertyExcludes,
  SymbolFlagsPrototype,
  SymbolFlagsRegularEnum,
  SymbolFlagsReplaceableByMethod,
  SymbolFlagsSignature,
  SymbolFlagsTypeAlias,
  SymbolFlagsTypeAliasExcludes,
  SymbolFlagsTypeLiteral,
  SymbolFlagsTypeParameter,
  SymbolFlagsTypeParameterExcludes,
  SymbolFlagsValueModule,
  SymbolFlagsValueModuleExcludes,
  SymbolFlagsValue,
  SymbolFlagsAll,
  SymbolFlagsAliasExcludes,
  SymbolFlagsAssignment,
  SymbolFlagsClassifiable,
  SymbolFlagsVariable,
  SymbolFlagsGetAccessor,
  SymbolFlagsGetAccessorExcludes,
  SymbolFlagsInterfaceExcludes,
  SymbolFlagsMethod,
  SymbolFlagsMethodExcludes,
  SymbolFlagsRegularEnumExcludes,
  SymbolFlagsSetAccessor,
  SymbolFlagsSetAccessorExcludes,
  SymbolFlagsAccessorExcludes,
  SymbolFlagsType,
  SymbolFlagsNamespace,
} from "../ast/symbolflags.js";
import type { SymbolFlags } from "../ast/symbolflags.js";
import {
  ModifierFlagsAsync,
  ModifierFlagsDefault,
  ModifierFlagsExport,
} from "../ast/modifierflags.js";
import {
  ExpressionIsAlias,
  FindAncestor,
  GetAssignmentDeclarationKind,
  GetCombinedModifierFlags,
  GetContainingClass,
  GetElementOrPropertyAccessName,
  GetExports,
  GetLocals,
  GetMembers,
  GetModuleInstanceState,
  GetNameOfDeclaration,
  GetSymbolId,
  HasDynamicName,
  HasSyntacticModifier,
  IsAccessExpression,
  IsAmbientModule,
  IsAsyncFunction,
  IsAssignmentTarget,
  IsAutoAccessorPropertyDeclaration,
  IsBindingPattern,
  IsBooleanLiteral,
  IsBlockOrCatchScoped,
  IsDestructuringAssignment,
  IsDottedName,
  IsEntityNameExpression,
  IsEnumConst,
  IsExpressionOfOptionalChainRoot,
  IsExpandoInitializer,
  IsExternalModule,
  IsExternalOrCommonJSModule,
  IsForInOrOfStatement,
  IsFunctionLike,
  IsGlobalScopeAugmentation,
  IsImplicitlyExportedJSTypeAlias,
  IsInJSFile,
  IsInTopLevelContext,
  IsLeftHandSideExpression,
  IsLogicalExpression,
  IsLogicalOrCoalescingAssignmentExpression,
  IsLogicalOrCoalescingBinaryOperator,
  IsModuleAugmentationExternal,
  IsNullishCoalesce,
  IsObjectLiteralMethod,
  IsObjectLiteralOrClassExpressionMethodOrAccessor,
  IsOptionalChain,
  IsOptionalChainRoot,
  IsOutermostOptionalChain,
  IsParameterPropertyDeclaration,
  IsPartOfParameterDeclaration,
  IsPartOfTypeQuery,
  IsPotentiallyExecutableNode,
  IsPrologueDirective,
  IsPushOrUnshiftIdentifier,
  IsRequireCall,
  IsStatic,
  IsStringLiteralLike,
  IsStringOrNumericLiteralLike,
  GetImmediatelyInvokedFunctionExpression,
  IsDeclarationStatement,
  IsIdentifierName,
  IsPropertyNameLiteral,
  IsVariableDeclarationInitializedToRequire,
  IsJsonSourceFile,
  JSDeclarationKindModuleExports,
  JSDeclarationKindExportsProperty,
  JSDeclarationKindThisProperty,
  JSDeclarationKindProperty,
  JSDeclarationKindObjectDefinePropertyValue,
  JSDeclarationKindObjectDefinePropertyExports,
  ModuleExportNameIsDefault,
  ModuleInstanceStateNonInstantiated,
  ModuleInstanceStateConstEnumOnly,
  NodeIsMissing,
  NodeIsPresent,
  SkipParentheses,
} from "../ast/utilities.js";
import type { ModuleInstanceState } from "../ast/utilities.js";
import {
  Set_Add,
  Set_Has,
  NewSetWithSizeHint,
} from "../collections/set.js";
import type { Set } from "../collections/set.js";
import { Arena_New, Arena_NewSlice1 } from "../core/arena.js";
import type { Arena } from "../core/arena.js";
import { AppendIfUnique, IfElse, OrElse, Some } from "../core/core.js";
import { CategorySuggestion } from "../diagnostics/diagnostics.js";
import type { Message } from "../diagnostics/diagnostics.js";
import {
  A_label_is_not_allowed_here,
  A_module_cannot_have_multiple_default_exports,
  Another_export_default_is_here,
  Cannot_redeclare_block_scoped_variable_0,
  Code_contained_in_a_class_is_evaluated_in_JavaScript_s_strict_mode_which_does_not_allow_this_use_of_0_For_more_information_see_https_Colon_Slash_Slashdeveloper_mozilla_org_Slashen_US_Slashdocs_SlashWeb_SlashJavaScript_SlashReference_SlashStrict_mode,
  Did_you_mean_0,
  Duplicate_identifier_0,
  Enum_declarations_can_only_merge_with_namespace_or_other_enum_declarations,
  Function_declarations_are_not_allowed_inside_blocks_in_strict_mode_when_targeting_ES5,
  Function_declarations_are_not_allowed_inside_blocks_in_strict_mode_when_targeting_ES5_Class_definitions_are_automatically_in_strict_mode,
  Function_declarations_are_not_allowed_inside_blocks_in_strict_mode_when_targeting_ES5_Modules_are_automatically_in_strict_mode,
  Global_module_exports_may_only_appear_at_top_level,
  Global_module_exports_may_only_appear_in_declaration_files,
  Global_module_exports_may_only_appear_in_module_files,
  Identifier_expected_0_is_a_reserved_word_at_the_top_level_of_a_module,
  Identifier_expected_0_is_a_reserved_word_in_strict_mode,
  Identifier_expected_0_is_a_reserved_word_in_strict_mode_Class_definitions_are_automatically_in_strict_mode,
  Identifier_expected_0_is_a_reserved_word_in_strict_mode_Modules_are_automatically_in_strict_mode,
  Identifier_expected_0_is_a_reserved_word_that_cannot_be_used_here,
  Invalid_use_of_0_in_strict_mode,
  Invalid_use_of_0_Modules_are_automatically_in_strict_mode,
  Modifiers_cannot_appear_here,
  Pattern_0_can_have_at_most_one_Asterisk_character,
  The_first_export_default_is_here,
  X_and_here,
  X_constructor_is_a_reserved_word,
  X_delete_cannot_be_called_on_an_identifier_in_strict_mode,
  X_export_modifier_cannot_be_applied_to_ambient_modules_and_module_augmentations_since_they_are_always_visible,
  X_with_statements_are_not_allowed_in_strict_mode,
} from "../diagnostics/generated/messages.js";
import {
  GetSourceTextOfNodeFromSourceFile,
  DeclarationNameToString,
} from "../scanner/utilities.js";
import {
  GetErrorRangeForNode,
  GetIdentifierToken,
  GetRangeOfTokenAtPosition,
  TokenToString,
} from "../scanner/scanner.js";
import { NewTextRange } from "../core/text.js";
import { Pattern_IsValid, TryParsePattern } from "../core/pattern.js";
import type { Pattern } from "../core/pattern.js";
import { RemoveFileExtension } from "../tspath/extension.js";
import { Node_AsNode, Node_BodyData, Node_DeclarationData, Node_End, Node_FlowNodeData, Node_ExportableData, Node_ForEachChild, Node_LocalsContainerData, Node_Name, Node_Modifiers, Node_Pos } from "../ast/spine.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::type::ContainerFlags","kind":"type","status":"implemented","sigHash":"068247eebc62ebe4c4b32ff608d4161dc758afa1a02341cf8ec341921dcd4c5d","bodyHash":"2fbc434e23f039c3fcc0dec2f41a450f3a94b32ea8cb8a767ea8f7ac402f3048"}
 *
 * Go source:
 * ContainerFlags int32
 */
export type ContainerFlags = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::constGroup::ContainerFlagsNone+ContainerFlagsIsContainer+ContainerFlagsIsBlockScopedContainer+ContainerFlagsIsControlFlowContainer+ContainerFlagsIsFunctionLike+ContainerFlagsIsFunctionExpression+ContainerFlagsHasLocals+ContainerFlagsIsInterface+ContainerFlagsIsObjectLiteralOrClassExpressionMethodOrAccessor+ContainerFlagsIsThisContainer+ContainerFlagsPropagatesThisKeyword","kind":"constGroup","status":"implemented","sigHash":"2f12f3d9304bcc59969d90f461ec13c4250150a78e7455aedae3ce82a7befb9f","bodyHash":"ed6c27a67c3a5f8ffc054e8c20f641093b0789927c4813306ff04ac88e498c37"}
 *
 * Go source:
 * const (
 * 	// The current node is not a container, and no container manipulation should happen before
 * 	// recursing into it.
 * 	ContainerFlagsNone ContainerFlags = 0
 * 	// The current node is a container.  It should be set as the current container (and block-
 * 	// container) before recursing into it.  The current node does not have locals.  Examples:
 * 	//
 * 	//      Classes, ObjectLiterals, TypeLiterals, Interfaces...
 * 	ContainerFlagsIsContainer ContainerFlags = 1 << 0
 * 	// The current node is a block-scoped-container.  It should be set as the current block-
 * 	// container before recursing into it.  Examples:
 * 	//
 * 	//      Blocks (when not parented by functions), Catch clauses, For/For-in/For-of statements...
 * 	ContainerFlagsIsBlockScopedContainer ContainerFlags = 1 << 1
 * 	// The current node is the container of a control flow path. The current control flow should
 * 	// be saved and restored, and a new control flow initialized within the container.
 * 	ContainerFlagsIsControlFlowContainer                           ContainerFlags = 1 << 2
 * 	ContainerFlagsIsFunctionLike                                   ContainerFlags = 1 << 3
 * 	ContainerFlagsIsFunctionExpression                             ContainerFlags = 1 << 4
 * 	ContainerFlagsHasLocals                                        ContainerFlags = 1 << 5
 * 	ContainerFlagsIsInterface                                      ContainerFlags = 1 << 6
 * 	ContainerFlagsIsObjectLiteralOrClassExpressionMethodOrAccessor ContainerFlags = 1 << 7
 * 	ContainerFlagsIsThisContainer                                  ContainerFlags = 1 << 8
 * 	ContainerFlagsPropagatesThisKeyword                            ContainerFlags = 1 << 9
 * )
 */
export const ContainerFlagsNone: ContainerFlags = 0;
export const ContainerFlagsIsContainer: ContainerFlags = 1 << 0;
export const ContainerFlagsIsBlockScopedContainer: ContainerFlags = 1 << 1;
export const ContainerFlagsIsControlFlowContainer: ContainerFlags = 1 << 2;
export const ContainerFlagsIsFunctionLike: ContainerFlags = 1 << 3;
export const ContainerFlagsIsFunctionExpression: ContainerFlags = 1 << 4;
export const ContainerFlagsHasLocals: ContainerFlags = 1 << 5;
export const ContainerFlagsIsInterface: ContainerFlags = 1 << 6;
export const ContainerFlagsIsObjectLiteralOrClassExpressionMethodOrAccessor: ContainerFlags = 1 << 7;
export const ContainerFlagsIsThisContainer: ContainerFlags = 1 << 8;
export const ContainerFlagsPropagatesThisKeyword: ContainerFlags = 1 << 9;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::type::ExpandoAssignmentInfo","kind":"type","status":"implemented","sigHash":"5f178645de4b442b313897929c258c60bc4ff9075d4be21e3a6e80c64e3cb96e","bodyHash":"600caeb126414e349a1a0d69d2ecea6a366dfc15b9526f56071a200f59cbee5f"}
 *
 * Go source:
 * ExpandoAssignmentInfo struct {
 * 	node                *ast.Node
 * 	container           *ast.Node
 * 	blockScopeContainer *ast.Node
 * }
 */
export interface ExpandoAssignmentInfo {
  node: GoPtr<Node>;
  container: GoPtr<Node>;
  blockScopeContainer: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::type::Binder","kind":"type","status":"implemented","sigHash":"d88cd5c54702ec4c7ebe3ba4c7dafe90cb53ba710d40678602adeeea1b8cc714","bodyHash":"d79dba50e3594bc759b78254714c32fbccc9c1b3b0f7238d807622c8d7e7f2e5"}
 *
 * Go source:
 * Binder struct {
 * 	file            *ast.SourceFile
 * 	bindFunc        func(*ast.Node) bool
 * 	unreachableFlow *ast.FlowNode
 * 
 * 	container               *ast.Node
 * 	thisContainer           *ast.Node
 * 	blockScopeContainer     *ast.Node
 * 	lastContainer           *ast.Node
 * 	currentFlow             *ast.FlowNode
 * 	currentBreakTarget      *ast.FlowLabel
 * 	currentContinueTarget   *ast.FlowLabel
 * 	currentReturnTarget     *ast.FlowLabel
 * 	currentTrueTarget       *ast.FlowLabel
 * 	currentFalseTarget      *ast.FlowLabel
 * 	currentExceptionTarget  *ast.FlowLabel
 * 	preSwitchCaseFlow       *ast.FlowNode
 * 	activeLabelList         *ActiveLabel
 * 	emitFlags               ast.NodeFlags
 * 	seenThisKeyword         bool
 * 	hasExplicitReturn       bool
 * 	hasFlowEffects          bool
 * 	inAssignmentPattern     bool
 * 	seenParseError          bool
 * 	symbolCount             int
 * 	classifiableNames       collections.Set[string]
 * 	notConstEnumOnlyModules collections.Set[*ast.Symbol]
 * 	symbolArena             core.Arena[ast.Symbol]
 * 	flowNodeArena           core.Arena[ast.FlowNode]
 * 	flowListArena           core.Arena[ast.FlowList]
 * 	singleDeclarationsArena core.Arena[*ast.Node]
 * 	expandoAssignments      []ExpandoAssignmentInfo
 * 	nestedCJSExports        []*ast.Node
 * }
 */
export interface Binder {
  file: GoPtr<SourceFile>;
  bindFunc: (arg0: GoPtr<Node>) => bool;
  unreachableFlow: GoPtr<FlowNode>;
  parent: GoPtr<Node>;
  container: GoPtr<Node>;
  thisContainer: GoPtr<Node>;
  blockScopeContainer: GoPtr<Node>;
  lastContainer: GoPtr<Node>;
  currentFlow: GoPtr<FlowNode>;
  currentBreakTarget: GoPtr<FlowLabel>;
  currentContinueTarget: GoPtr<FlowLabel>;
  currentReturnTarget: GoPtr<FlowLabel>;
  currentTrueTarget: GoPtr<FlowLabel>;
  currentFalseTarget: GoPtr<FlowLabel>;
  currentExceptionTarget: GoPtr<FlowLabel>;
  preSwitchCaseFlow: GoPtr<FlowNode>;
  activeLabelList: GoPtr<ActiveLabel>;
  emitFlags: NodeFlags;
  seenThisKeyword: bool;
  hasExplicitReturn: bool;
  hasFlowEffects: bool;
  inAssignmentPattern: bool;
  seenParseError: bool;
  symbolCount: int;
  classifiableNames: Set<string>;
  notConstEnumOnlyModules: Set<GoPtr<Symbol>>;
  symbolArena: Arena<Symbol>;
  flowNodeArena: Arena<FlowNode>;
  flowListArena: Arena<FlowList>;
  singleDeclarationsArena: Arena<GoPtr<Node>>;
  expandoAssignments: GoSlice<ExpandoAssignmentInfo>;
  nestedCJSExports: GoSlice<GoPtr<Node>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::type::ActiveLabel","kind":"type","status":"implemented","sigHash":"0e9ba95fd4ffc37701892003801d1d2b0ce185e434fad383068506bd6626a123","bodyHash":"66d5826ae05ba8bd67cdb74928667eb4a42437e6b94303a508ecce0422788547"}
 *
 * Go source:
 * ActiveLabel struct {
 * 	next           *ActiveLabel
 * 	breakTarget    *ast.FlowLabel
 * 	continueTarget *ast.FlowLabel
 * 	name           string
 * 	referenced     bool
 * }
 */
export interface ActiveLabel {
  next: GoPtr<ActiveLabel>;
  breakTarget: GoPtr<FlowLabel>;
  continueTarget: GoPtr<FlowLabel>;
  name: string;
  referenced: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::ActiveLabel.BreakTarget","kind":"method","status":"implemented","sigHash":"b693c7115dc9ccf871ce4284dbb26ee7b0afb48af33066095e0904cb1fdb4899","bodyHash":"6138d9260241cb88ef1754db55d8178f5c25af9f383bdb9467f96aa7b5bec15b"}
 *
 * Go source:
 * func (label *ActiveLabel) BreakTarget() *ast.FlowNode    { return label.breakTarget }
 */
export function ActiveLabel_BreakTarget(receiver: GoPtr<ActiveLabel>): GoPtr<FlowNode> {
  return receiver!.breakTarget;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::ActiveLabel.ContinueTarget","kind":"method","status":"implemented","sigHash":"0379f850673ebb3260d54b4132c5ab995e527d4ce1255dd060a15950813ce0a4","bodyHash":"7dcd3ec290eda615d15de841c8e8623cb1b2a0db77a4eb531cf936b77517da99"}
 *
 * Go source:
 * func (label *ActiveLabel) ContinueTarget() *ast.FlowNode { return label.continueTarget }
 */
export function ActiveLabel_ContinueTarget(receiver: GoPtr<ActiveLabel>): GoPtr<FlowNode> {
  return receiver!.continueTarget;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::BindSourceFile","kind":"func","status":"implemented","sigHash":"907a4145a2df4c5175858ef96668a1cbcaa8310cd9ad87a0e9fe88c8ee0c973b","bodyHash":"9218880dfca390a48433af6bd5543d0fa7c41143c39e6afa03395627035b92a0"}
 *
 * Go source:
 * func BindSourceFile(file *ast.SourceFile) {
 * 	// This is constructed this way to make the compiler "out-line" the function,
 * 	// avoiding most work in the common case where the file has already been bound.
 * 	if !file.IsBound() {
 * 		bindSourceFile(file)
 * 	}
 * }
 */
export function BindSourceFile(file: GoPtr<SourceFile>): void {
  if (!SourceFile_IsBound(file)) {
    bindSourceFile(file);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::varGroup::binderPool","kind":"varGroup","status":"implemented","sigHash":"df306d5a6fedccf9939ad726866d79807fbd22b996c9b1baa1f617cde53d2fd4","bodyHash":"35f9e43dd80865879d6ec5cc3853fa21171a2fd19c3717533bb57baeadaa82d9"}
 *
 * Go source:
 * var binderPool = sync.Pool{
 * 	New: func() any {
 * 		b := &Binder{}
 * 		b.bindFunc = b.bind // Allocate closure once
 * 		return b
 * 	},
 * }
 */
export const binderPool = new Pool<Binder>();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::getBinder","kind":"func","status":"implemented","sigHash":"b5ed04b8e537a472bfe5943403514f3a2337328c3df347af7978c671e52c0fa2","bodyHash":"459fb11735c11ea9e06babc9f1dab3e1df80aca8b93fcd595671fbd375fceddb"}
 *
 * Go source:
 * func getBinder() *Binder {
 * 	return binderPool.Get().(*Binder)
 * }
 */
export function getBinder(): GoPtr<Binder> {
  if (binderPool.New === undefined) {
    binderPool.New = () => {
      const b = {} as Binder;
      b.bindFunc = (node) => Binder_bind(b, node);
      return b;
    };
  }
  const binder = binderPool.Get() as Binder;
  binder.classifiableNames = { M: undefined as unknown as GoMap<string, { readonly __tsgoEmpty?: never }> };
  binder.notConstEnumOnlyModules = { M: undefined as unknown as GoMap<GoPtr<Symbol>, { readonly __tsgoEmpty?: never }> };
  return binder;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::putBinder","kind":"func","status":"implemented","sigHash":"60a3dc04c7a69ad4839398fb374eca8406bba4b82fa72e85ff6bf0f2bc23c666","bodyHash":"d1f49b5245c5b536566d84b1c663e233b9d74a3b6992e65901e4d04d984a7dea"}
 *
 * Go source:
 * func putBinder(b *Binder) {
 * 	*b = Binder{bindFunc: b.bindFunc}
 * 	binderPool.Put(b)
 * }
 */
export function putBinder(b: GoPtr<Binder>): void {
  const savedBindFunc = b!.bindFunc;
  // Reset all fields to zero values preserving bindFunc
  const bAsRecord = b as unknown as Record<string, unknown>;
  const keys = globalThis.Object.keys(bAsRecord) as Array<string>;
  for (const key of keys) {
    bAsRecord[key] = undefined;
  }
  b!.bindFunc = savedBindFunc;
  binderPool.Put(b!);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::bindSourceFile","kind":"func","status":"implemented","sigHash":"3bb9f0443f458e9d47307ddda50f20ed23377349dbf4f986d2522d6232efeed5","bodyHash":"152654cc39de357371ef910c53fcd59442f143330ff77b58401c94b1eab83a95"}
 *
 * Go source:
 * func bindSourceFile(file *ast.SourceFile) {
 * 	file.BindOnce(func() {
 * 		b := getBinder()
 * 		defer putBinder(b)
 * 		b.file = file
 * 		b.unreachableFlow = b.newFlowNode(ast.FlowFlagsUnreachable)
 * 		b.bind(file.AsNode())
 * 		b.bindDeferredExpandoAssignments()
 * 		file.SymbolCount = b.symbolCount
 * 		file.ClassifiableNames = b.classifiableNames
 * 		file.NestedCJSExports = b.nestedCJSExports
 * 	})
 * }
 */
export function bindSourceFile(file: GoPtr<SourceFile>): void {
  SourceFile_BindOnce(file, () => {
    const b = getBinder()!;
    b.file = file;
    b.unreachableFlow = Binder_newFlowNode(b, FlowFlagsUnreachable);
    Binder_bind(b, Node_AsNode(file as unknown as Node));
    Binder_bindDeferredExpandoAssignments(b);
    file!.SymbolCount = b.symbolCount;
    file!.ClassifiableNames = b.classifiableNames;
    file!.NestedCJSExports = b.nestedCJSExports ?? [];
    putBinder(b);
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.newSymbol","kind":"method","status":"implemented","sigHash":"0281db9a030823c9f125a3afc0999c69be7179f3189c4c512b155b050159c2fe","bodyHash":"4ea9eadc89b71192b8c6ce279b7ecbee8f9b97fc57963f776f41dfff4c08c136"}
 *
 * Go source:
 * func (b *Binder) newSymbol(flags ast.SymbolFlags, name string) *ast.Symbol {
 * 	b.symbolCount++
 * 	result := b.symbolArena.New()
 * 	result.Flags = flags
 * 	result.Name = name
 * 	return result
 * }
 */
export function Binder_newSymbol(receiver: GoPtr<Binder>, flags: SymbolFlags, name: string): GoPtr<Symbol> {
  receiver!.symbolCount = (receiver!.symbolCount as number + 1) as int;
  const result = Arena_New(receiver!.symbolArena);
  result!.Flags = flags;
  result!.Name = name;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.declareSymbol","kind":"method","status":"implemented","sigHash":"3fb23c037e030fcdf5aeba9a2eeff5e47efd25e36b7f45f31257204e76d9d820","bodyHash":"98e489f2a5f5804db2321b55ab2ce6b4831a8ae709af1e2f2559bf0285a60f67"}
 *
 * Go source:
 * func (b *Binder) declareSymbol(symbolTable ast.SymbolTable, parent *ast.Symbol, node *ast.Node, includes ast.SymbolFlags, excludes ast.SymbolFlags) *ast.Symbol {
 * 	return b.declareSymbolEx(symbolTable, parent, node, includes, excludes, false /*isReplaceableByMethod* /, false /*isComputedName* /)
 * }
 */
export function Binder_declareSymbol(receiver: GoPtr<Binder>, symbolTable: SymbolTable, parent: GoPtr<Symbol>, node: GoPtr<Node>, includes: SymbolFlags, excludes: SymbolFlags): GoPtr<Symbol> {
  return Binder_declareSymbolEx(receiver, symbolTable, parent, node, includes, excludes, false, false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.declareSymbolEx","kind":"method","status":"implemented","sigHash":"cad4b17597bd67d8cf1e4bd2cc9b412af9577fc56e7f62ab4fb23d4a0840c64a","bodyHash":"18502e6b6039d64c1e5ae351e1ea76eb74b54cf45c84acfe78a2d5c6160fcc16"}
 *
 * Go source:
 * func (b *Binder) declareSymbolEx(symbolTable ast.SymbolTable, parent *ast.Symbol, node *ast.Node, includes ast.SymbolFlags, excludes ast.SymbolFlags, isReplaceableByMethod bool, isComputedName bool) *ast.Symbol {
 * 	debug.Assert(isComputedName || !ast.HasDynamicName(node))
 * 	isDefaultExport := ast.HasSyntacticModifier(node, ast.ModifierFlagsDefault) || ast.IsExportSpecifier(node) && ast.ModuleExportNameIsDefault(node.AsExportSpecifier().Name())
 * 	// The exported symbol for an export default function/class node is always named "default"
 * 	var name string
 * 	switch {
 * 	case isComputedName:
 * 		name = ast.InternalSymbolNameComputed
 * 	case isDefaultExport && parent != nil:
 * 		name = ast.InternalSymbolNameDefault
 * 	default:
 * 		name = b.getDeclarationName(node)
 * 	}
 * 	var symbol *ast.Symbol
 * 	if name == ast.InternalSymbolNameMissing {
 * 		symbol = b.newSymbol(ast.SymbolFlagsNone, ast.InternalSymbolNameMissing)
 * 	} else {
 * 		// Check and see if the symbol table already has a symbol with this name.  If not,
 * 		// create a new symbol with this name and add it to the table.  Note that we don't
 * 		// give the new symbol any flags *yet*.  This ensures that it will not conflict
 * 		// with the 'excludes' flags we pass in.
 * 		//
 * 		// If we do get an existing symbol, see if it conflicts with the new symbol we're
 * 		// creating.  For example, a 'var' symbol and a 'class' symbol will conflict within
 * 		// the same symbol table.  If we have a conflict, report the issue on each
 * 		// declaration we have for this symbol, and then create a new symbol for this
 * 		// declaration.
 * 		//
 * 		// Note that when properties declared in Javascript constructors
 * 		// (marked by isReplaceableByMethod) conflict with another symbol, the property loses.
 * 		// Always. This allows the common Javascript pattern of overwriting a prototype method
 * 		// with an bound instance method of the same type: `this.method = this.method.bind(this)`
 * 		//
 * 		// If we created a new symbol, either because we didn't have a symbol with this name
 * 		// in the symbol table, or we conflicted with an existing symbol, then just add this
 * 		// node as the sole declaration of the new symbol.
 * 		//
 * 		// Otherwise, we'll be merging into a compatible existing symbol (for example when
 * 		// you have multiple 'vars' with the same name in the same container).  In this case
 * 		// just add this node into the declarations list of the symbol.
 * 		symbol = symbolTable[name]
 * 		if includes&ast.SymbolFlagsClassifiable != 0 {
 * 			b.classifiableNames.Add(name)
 * 		}
 * 		if symbol == nil {
 * 			symbol = b.newSymbol(ast.SymbolFlagsNone, name)
 * 			symbolTable[name] = symbol
 * 			if isReplaceableByMethod {
 * 				symbol.Flags |= ast.SymbolFlagsReplaceableByMethod
 * 			}
 * 		} else if isReplaceableByMethod && symbol.Flags&ast.SymbolFlagsReplaceableByMethod == 0 {
 * 			// A symbol already exists, so don't add this as a declaration.
 * 			return symbol
 * 		} else if symbol.Flags&excludes != 0 {
 * 			if symbol.Flags&ast.SymbolFlagsReplaceableByMethod != 0 {
 * 				// Javascript constructor-declared symbols can be discarded in favor of
 * 				// prototype symbols like methods.
 * 				symbol = b.newSymbol(ast.SymbolFlagsNone, name)
 * 				symbolTable[name] = symbol
 * 			} else if !(includes&ast.SymbolFlagsVariable != 0 && symbol.Flags&ast.SymbolFlagsAssignment != 0 ||
 * 				includes&ast.SymbolFlagsAssignment != 0 && symbol.Flags&ast.SymbolFlagsVariable != 0) {
 * 				// Assignment declarations are allowed to merge with variables, no matter what other flags they have.
 * 				// Report errors every position with duplicate declaration
 * 				// Report errors on previous encountered declarations
 * 				var message *diagnostics.Message
 * 				if symbol.Flags&ast.SymbolFlagsBlockScopedVariable != 0 {
 * 					message = diagnostics.Cannot_redeclare_block_scoped_variable_0
 * 				} else {
 * 					message = diagnostics.Duplicate_identifier_0
 * 				}
 * 				messageNeedsName := true
 * 				if symbol.Flags&ast.SymbolFlagsEnum != 0 || includes&ast.SymbolFlagsEnum != 0 {
 * 					message = diagnostics.Enum_declarations_can_only_merge_with_namespace_or_other_enum_declarations
 * 					messageNeedsName = false
 * 				}
 * 				multipleDefaultExports := false
 * 				if len(symbol.Declarations) != 0 {
 * 					// If the current node is a default export of some sort, then check if
 * 					// there are any other default exports that we need to error on.
 * 					// We'll know whether we have other default exports depending on if `symbol` already has a declaration list set.
 * 					if isDefaultExport {
 * 						message = diagnostics.A_module_cannot_have_multiple_default_exports
 * 						messageNeedsName = false
 * 						multipleDefaultExports = true
 * 					} else {
 * 						// This is to properly report an error in the case "export default { }" is after export default of class declaration or function declaration.
 * 						// Error on multiple export default in the following case:
 * 						// 1. multiple export default of class declaration or function declaration by checking NodeFlags.Default
 * 						// 2. multiple export default of export assignment. This one doesn't have NodeFlags.Default on (as export default doesn't considered as modifiers)
 * 						if len(symbol.Declarations) != 0 && ast.IsExportAssignment(node) && !node.AsExportAssignment().IsExportEquals {
 * 							message = diagnostics.A_module_cannot_have_multiple_default_exports
 * 							messageNeedsName = false
 * 							multipleDefaultExports = true
 * 						}
 * 					}
 * 				}
 * 				var declarationName *ast.Node = ast.GetNameOfDeclaration(node)
 * 				if declarationName == nil {
 * 					declarationName = node
 * 				}
 * 				var diag *ast.Diagnostic
 * 				if messageNeedsName {
 * 					diag = b.createDiagnosticForNode(declarationName, message, b.getDisplayName(node))
 * 				} else {
 * 					diag = b.createDiagnosticForNode(declarationName, message)
 * 				}
 * 				if ast.IsTypeAliasDeclaration(node) && ast.NodeIsMissing(node.Type()) && ast.HasSyntacticModifier(node, ast.ModifierFlagsExport) && symbol.Flags&(ast.SymbolFlagsAlias|ast.SymbolFlagsType|ast.SymbolFlagsNamespace) != 0 {
 * 					// export type T; - may have meant export type { T }?
 * 					diag.AddRelatedInfo(b.createDiagnosticForNode(node, diagnostics.Did_you_mean_0, "export type { "+node.AsTypeAliasDeclaration().Name().Text()+" }"))
 * 				}
 * 				for index, declaration := range symbol.Declarations {
 * 					var decl *ast.Node = ast.GetNameOfDeclaration(declaration)
 * 					if decl == nil {
 * 						decl = declaration
 * 					}
 * 					var d *ast.Diagnostic
 * 					if messageNeedsName {
 * 						d = b.createDiagnosticForNode(decl, message, b.getDisplayName(declaration))
 * 					} else {
 * 						d = b.createDiagnosticForNode(decl, message)
 * 					}
 * 					if multipleDefaultExports {
 * 						d.AddRelatedInfo(b.createDiagnosticForNode(declarationName, core.IfElse(index == 0, diagnostics.Another_export_default_is_here, diagnostics.X_and_here)))
 * 					}
 * 					b.addDiagnostic(d)
 * 					if multipleDefaultExports {
 * 						diag.AddRelatedInfo(b.createDiagnosticForNode(decl, diagnostics.The_first_export_default_is_here))
 * 					}
 * 				}
 * 				b.addDiagnostic(diag)
 * 				// When get or set accessor conflicts with a non-accessor or an accessor of a different kind, we mark
 * 				// the symbol as a full accessor such that all subsequent declarations are considered conflicting. This
 * 				// for example ensures that a get accessor followed by a non-accessor followed by a set accessor with the
 * 				// same name are all marked as duplicates.
 * 				if symbol.Flags&ast.SymbolFlagsAccessor != 0 && symbol.Flags&ast.SymbolFlagsAccessor != includes&ast.SymbolFlagsAccessor {
 * 					symbol.Flags |= ast.SymbolFlagsAccessor
 * 				}
 * 				symbol = b.newSymbol(ast.SymbolFlagsNone, name)
 * 			}
 * 		}
 * 	}
 * 	b.addDeclarationToSymbol(symbol, node, includes)
 * 	if symbol.Parent == nil {
 * 		symbol.Parent = parent
 * 	} else if symbol.Parent != parent {
 * 		panic("Existing symbol parent should match new one")
 * 	}
 * 	return symbol
 * }
 */
export function Binder_declareSymbolEx(receiver: GoPtr<Binder>, symbolTable: SymbolTable, parent: GoPtr<Symbol>, node: GoPtr<Node>, includes: SymbolFlags, excludes: SymbolFlags, isReplaceableByMethod: bool, isComputedName: bool): GoPtr<Symbol> {
  // debug.Assert(isComputedName || !ast.HasDynamicName(node))
  const isDefaultExport = HasSyntacticModifier(node, ModifierFlagsDefault) || IsExportSpecifier(node) && ModuleExportNameIsDefault(Node_Name(node)!);
  let name: string;
  if (isComputedName) {
    name = InternalSymbolNameComputed;
  } else if (isDefaultExport && parent !== undefined) {
    name = InternalSymbolNameDefault;
  } else {
    name = Binder_getDeclarationName(receiver, node);
  }
  let symbol: GoPtr<Symbol>;
  if (name === InternalSymbolNameMissing) {
    symbol = Binder_newSymbol(receiver, SymbolFlagsNone, InternalSymbolNameMissing);
  } else {
    if ((includes & SymbolFlagsClassifiable) !== 0) {
      Set_Add(receiver!.classifiableNames, name);
    }
    symbol = symbolTable.get(name);
    if (symbol === undefined) {
      symbol = Binder_newSymbol(receiver, SymbolFlagsNone, name);
      symbolTable.set(name, symbol!);
      if (isReplaceableByMethod) {
        symbol!.Flags = (symbol!.Flags | SymbolFlagsReplaceableByMethod) as SymbolFlags;
      }
    } else if (isReplaceableByMethod && (symbol!.Flags & SymbolFlagsReplaceableByMethod) === 0) {
      return symbol;
    } else if ((symbol!.Flags & excludes) !== 0) {
      if ((symbol!.Flags & SymbolFlagsReplaceableByMethod) !== 0) {
        symbol = Binder_newSymbol(receiver, SymbolFlagsNone, name);
        symbolTable.set(name, symbol!);
      } else if (!((includes & SymbolFlagsVariable) !== 0 && (symbol!.Flags & SymbolFlagsAssignment) !== 0 ||
        (includes & SymbolFlagsAssignment) !== 0 && (symbol!.Flags & SymbolFlagsVariable) !== 0)) {
        let message: GoPtr<Message>;
        if ((symbol!.Flags & SymbolFlagsBlockScopedVariable) !== 0) {
          message = Cannot_redeclare_block_scoped_variable_0;
        } else {
          message = Duplicate_identifier_0;
        }
        let messageNeedsName = true;
        if ((symbol!.Flags & SymbolFlagsEnum) !== 0 || (includes & SymbolFlagsEnum) !== 0) {
          message = Enum_declarations_can_only_merge_with_namespace_or_other_enum_declarations;
          messageNeedsName = false;
        }
        let multipleDefaultExports = false;
        if ((symbol!.Declarations ?? []).length !== 0) {
          if (isDefaultExport) {
            message = A_module_cannot_have_multiple_default_exports;
            messageNeedsName = false;
            multipleDefaultExports = true;
          } else {
            if ((symbol!.Declarations ?? []).length !== 0 && IsExportAssignment(node) && !AsExportAssignment(node)!.IsExportEquals) {
              message = A_module_cannot_have_multiple_default_exports;
              messageNeedsName = false;
              multipleDefaultExports = true;
            }
          }
        }
        let declarationName: GoPtr<Node> = GetNameOfDeclaration(node);
        if (declarationName === undefined) {
          declarationName = node;
        }
        let diag: GoPtr<Diagnostic>;
        if (messageNeedsName) {
          diag = Binder_createDiagnosticForNode(receiver, declarationName, message!, Binder_getDisplayName(receiver, node));
        } else {
          diag = Binder_createDiagnosticForNode(receiver, declarationName, message!);
        }
        if (IsTypeAliasDeclaration(node) && NodeIsMissing(Node_Type(node)) && HasSyntacticModifier(node, ModifierFlagsExport) && (symbol!.Flags & (SymbolFlagsAlias | SymbolFlagsType | SymbolFlagsNamespace)) !== 0) {
          Diagnostic_AddRelatedInfo(diag!, Binder_createDiagnosticForNode(receiver, node, Did_you_mean_0, "export type { " + Node_Text(AsTypeAliasDeclaration(node)!.name as unknown as Node) + " }"));
        }
        for (let index = 0; index < (symbol!.Declarations ?? []).length; index++) {
          const declaration = symbol!.Declarations![index];
          let decl: GoPtr<Node> = GetNameOfDeclaration(declaration);
          if (decl === undefined) {
            decl = declaration;
          }
          let d: GoPtr<Diagnostic>;
          if (messageNeedsName) {
            d = Binder_createDiagnosticForNode(receiver, decl, message!, Binder_getDisplayName(receiver, declaration));
          } else {
            d = Binder_createDiagnosticForNode(receiver, decl, message!);
          }
          if (multipleDefaultExports) {
            Diagnostic_AddRelatedInfo(d!, Binder_createDiagnosticForNode(receiver, declarationName, IfElse(index === 0, Another_export_default_is_here, X_and_here)));
          }
          Binder_addDiagnostic(receiver, d!);
          if (multipleDefaultExports) {
            Diagnostic_AddRelatedInfo(diag!, Binder_createDiagnosticForNode(receiver, decl, The_first_export_default_is_here));
          }
        }
        Binder_addDiagnostic(receiver, diag!);
        if ((symbol!.Flags & SymbolFlagsAccessor) !== 0 && (symbol!.Flags & SymbolFlagsAccessor) !== (includes & SymbolFlagsAccessor)) {
          symbol!.Flags = (symbol!.Flags | SymbolFlagsAccessor) as SymbolFlags;
        }
        symbol = Binder_newSymbol(receiver, SymbolFlagsNone, name);
      }
    }
  }
  Binder_addDeclarationToSymbol(receiver, symbol!, node!, includes);
  if (symbol!.Parent === undefined) {
    symbol!.Parent = parent;
  } else if (symbol!.Parent !== parent) {
    throw new globalThis.Error("Existing symbol parent should match new one");
  }
  return symbol;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.getDeclarationName","kind":"method","status":"implemented","sigHash":"a787964c77a9f26c16f13742c21a1877d6c68e8e8e5835f16b935089abcc3dd9","bodyHash":"620cd915d9c60e99415d26e5891ec289f564414acdac1c1a963ee6eca2164c25"}
 *
 * Go source:
 * func (b *Binder) getDeclarationName(node *ast.Node) string {
 * 	if ast.IsExportAssignment(node) {
 * 		return core.IfElse(node.AsExportAssignment().IsExportEquals, ast.InternalSymbolNameExportEquals, ast.InternalSymbolNameDefault)
 * 	}
 * 	name := ast.GetNameOfDeclaration(node)
 * 	if name != nil {
 * 		if ast.IsAmbientModule(node) {
 * 			moduleName := name.Text()
 * 			if ast.IsGlobalScopeAugmentation(node) {
 * 				return ast.InternalSymbolNameGlobal
 * 			}
 * 			return "\"" + moduleName + "\""
 * 		}
 * 		if ast.IsPrivateIdentifier(name) {
 * 			// containingClass exists because private names only allowed inside classes
 * 			containingClass := ast.GetContainingClass(node)
 * 			if containingClass == nil {
 * 				// we can get here in cases where there is already a parse error.
 * 				return ast.InternalSymbolNameMissing
 * 			}
 * 			return GetSymbolNameForPrivateIdentifier(containingClass.Symbol(), name.Text())
 * 		}
 * 		if ast.IsPropertyNameLiteral(name) || ast.IsJsxNamespacedName(name) {
 * 			return name.Text()
 * 		}
 * 		if ast.IsComputedPropertyName(name) {
 * 			nameExpression := name.Expression()
 * 			// treat computed property names where expression is string/numeric literal as just string/numeric literal
 * 			if ast.IsStringOrNumericLiteralLike(nameExpression) {
 * 				return nameExpression.Text()
 * 			}
 * 			if ast.IsSignedNumericLiteral(nameExpression) {
 * 				unaryExpression := nameExpression.AsPrefixUnaryExpression()
 * 				return scanner.TokenToString(unaryExpression.Operator) + unaryExpression.Operand.Text()
 * 			}
 * 			panic("Only computed properties with literal names have declaration names")
 * 		}
 * 		return ast.InternalSymbolNameMissing
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindConstructor:
 * 		return ast.InternalSymbolNameConstructor
 * 	case ast.KindFunctionType, ast.KindCallSignature:
 * 		return ast.InternalSymbolNameCall
 * 	case ast.KindConstructorType, ast.KindConstructSignature:
 * 		return ast.InternalSymbolNameNew
 * 	case ast.KindIndexSignature:
 * 		return ast.InternalSymbolNameIndex
 * 	case ast.KindExportDeclaration:
 * 		return ast.InternalSymbolNameExportStar
 * 	case ast.KindSourceFile, ast.KindBinaryExpression:
 * 		return ast.InternalSymbolNameExportEquals
 * 	}
 * 	return ast.InternalSymbolNameMissing
 * }
 */
export function Binder_getDeclarationName(receiver: GoPtr<Binder>, node: GoPtr<Node>): string {
  if (IsExportAssignment(node)) {
    return IfElse(AsExportAssignment(node)!.IsExportEquals, InternalSymbolNameExportEquals, InternalSymbolNameDefault);
  }
  const name = GetNameOfDeclaration(node);
  if (name !== undefined) {
    if (IsAmbientModule(node)) {
      const moduleName = Node_Text(name);
      if (IsGlobalScopeAugmentation(node)) {
        return InternalSymbolNameGlobal;
      }
      return "\"" + moduleName + "\"";
    }
    if (IsPrivateIdentifier(name)) {
      const containingClass = GetContainingClass(node);
      if (containingClass === undefined) {
        return InternalSymbolNameMissing;
      }
      return GetSymbolNameForPrivateIdentifier(Node_Symbol(containingClass), Node_Text(name));
    }
    if (IsPropertyNameLiteral(name) || IsJsxNamespacedName(name)) {
      return Node_Text(name);
    }
    if (IsComputedPropertyName(name)) {
      const nameExpression = Node_Expression(name);
      if (IsStringOrNumericLiteralLike(nameExpression)) {
        return Node_Text(nameExpression);
      }
      if (isSignedNumericLiteral(nameExpression)) {
        const unaryExpression = AsPrefixUnaryExpression(nameExpression);
        return TokenToString(unaryExpression!.Operator) + Node_Text(unaryExpression!.Operand as unknown as Node);
      }
      throw new globalThis.Error("Only computed properties with literal names have declaration names");
    }
    return InternalSymbolNameMissing;
  }
  switch (node!.Kind) {
    case KindConstructor:
      return InternalSymbolNameConstructor;
    case KindFunctionType:
    case KindCallSignature:
      return InternalSymbolNameCall;
    case KindConstructorType:
    case KindConstructSignature:
      return InternalSymbolNameNew;
    case KindIndexSignature:
      return InternalSymbolNameIndex;
    case KindExportDeclaration:
      return InternalSymbolNameExportStar;
    case KindSourceFile:
    case KindBinaryExpression:
      return InternalSymbolNameExportEquals;
  }
  return InternalSymbolNameMissing;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.getDisplayName","kind":"method","status":"implemented","sigHash":"7c6362ae47096bdf59f2cc1dce85e78ba2040ab3d6912342d279a5563f67150e","bodyHash":"b22e642fbae874293a529523b12dfee024e44940e6d61247c6571260da0c3ecd"}
 *
 * Go source:
 * func (b *Binder) getDisplayName(node *ast.Node) string {
 * 	nameNode := node.Name()
 * 	if nameNode != nil {
 * 		return scanner.DeclarationNameToString(nameNode)
 * 	}
 * 	name := b.getDeclarationName(node)
 * 	if name != ast.InternalSymbolNameMissing {
 * 		return name
 * 	}
 * 	return "(Missing)"
 * }
 */
export function Binder_getDisplayName(receiver: GoPtr<Binder>, node: GoPtr<Node>): string {
  const nameNode = Node_Name(node);
  if (nameNode !== undefined) {
    return DeclarationNameToString(nameNode as unknown as Node);
  }
  const name = Binder_getDeclarationName(receiver, node);
  if (name !== InternalSymbolNameMissing) {
    return name;
  }
  return "(Missing)";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::GetSymbolNameForPrivateIdentifier","kind":"func","status":"implemented","sigHash":"b5e2a4703169ae2dea1aaa7864d2fecad6e1c45065d94db196b340dc74b26cbf","bodyHash":"ff7e168f408dff2c0fa0e31b165a3dea4596d64fdaf436819d27f5bc0605545f"}
 *
 * Go source:
 * func GetSymbolNameForPrivateIdentifier(containingClassSymbol *ast.Symbol, description string) string {
 * 	return ast.InternalSymbolNamePrefix + "#" + strconv.Itoa(int(ast.GetSymbolId(containingClassSymbol))) + "@" + description
 * }
 */
export function GetSymbolNameForPrivateIdentifier(containingClassSymbol: GoPtr<Symbol>, description: string): string {
  return InternalSymbolNamePrefix + "#" + strconv.Itoa(GetSymbolId(containingClassSymbol)) + "@" + description;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.declareModuleMember","kind":"method","status":"implemented","sigHash":"64029444bbb7b44c7e72e78af46404c6a3e5e6169f85bfd86c2102ce3fb24734","bodyHash":"0bd6eb9b6344083a1c8caa897a719fc27145890d323c8b43ccc9b64cd406c450"}
 *
 * Go source:
 * func (b *Binder) declareModuleMember(node *ast.Node, symbolFlags ast.SymbolFlags, symbolExcludes ast.SymbolFlags) *ast.Symbol {
 * 	container := b.container
 * 	hasExportModifier := ast.GetCombinedModifierFlags(node)&ast.ModifierFlagsExport != 0 || ast.IsImplicitlyExportedJSTypeAlias(node)
 * 	if symbolFlags&ast.SymbolFlagsAlias != 0 {
 * 		if node.Kind == ast.KindExportSpecifier || (node.Kind == ast.KindImportEqualsDeclaration && hasExportModifier) {
 * 			return b.declareSymbol(ast.GetExports(container.Symbol()), container.Symbol(), node, symbolFlags, symbolExcludes)
 * 		}
 * 		return b.declareSymbol(ast.GetLocals(container), nil /*parent* /, node, symbolFlags, symbolExcludes)
 * 	}
 * 	// Exported module members are given 2 symbols: A local symbol that is classified with an ExportValue flag,
 * 	// and an associated export symbol with all the correct flags set on it. There are 2 main reasons:
 * 	//
 * 	//   1. We treat locals and exports of the same name as mutually exclusive within a container.
 * 	//      That means the binder will issue a Duplicate Identifier error if you mix locals and exports
 * 	//      with the same name in the same container.
 * 	//      TODO: Make this a more specific error and decouple it from the exclusion logic.
 * 	//   2. When we checkIdentifier in the checker, we set its resolved symbol to the local symbol,
 * 	//      but return the export symbol (by calling getExportSymbolOfValueSymbolIfExported). That way
 * 	//      when the emitter comes back to it, it knows not to qualify the name if it was found in a containing scope.
 * 	//
 * 	// NOTE: Nested ambient modules always should go to to 'locals' table to prevent their automatic merge
 * 	//       during global merging in the checker. Why? The only case when ambient module is permitted inside another module is module augmentation
 * 	//       and this case is specially handled. Module augmentations should only be merged with original module definition
 * 	//       and should never be merged directly with other augmentation, and the latter case would be possible if automatic merge is allowed.
 * 	if !ast.IsAmbientModule(node) && (hasExportModifier || container.Flags&ast.NodeFlagsExportContext != 0) {
 * 		if !ast.IsLocalsContainer(container) || (ast.HasSyntacticModifier(node, ast.ModifierFlagsDefault) && b.getDeclarationName(node) == ast.InternalSymbolNameMissing) {
 * 			return b.declareSymbol(ast.GetExports(container.Symbol()), container.Symbol(), node, symbolFlags, symbolExcludes)
 * 			// No local symbol for an unnamed default!
 * 		}
 * 		exportKind := ast.SymbolFlagsNone
 * 		if symbolFlags&ast.SymbolFlagsValue != 0 {
 * 			exportKind = ast.SymbolFlagsExportValue
 * 		}
 * 		local := b.declareSymbol(ast.GetLocals(container), nil /*parent* /, node, exportKind, symbolExcludes)
 * 		local.ExportSymbol = b.declareSymbol(ast.GetExports(container.Symbol()), container.Symbol(), node, symbolFlags, symbolExcludes)
 * 		node.ExportableData().LocalSymbol = local
 * 		return local
 * 	}
 * 	return b.declareSymbol(ast.GetLocals(container), nil /*parent* /, node, symbolFlags, symbolExcludes)
 * }
 */
export function Binder_declareModuleMember(receiver: GoPtr<Binder>, node: GoPtr<Node>, symbolFlags: SymbolFlags, symbolExcludes: SymbolFlags): GoPtr<Symbol> {
  const container = receiver!.container;
  const hasExportModifier = (GetCombinedModifierFlags(node) & ModifierFlagsExport) !== 0 || IsImplicitlyExportedJSTypeAlias(node);
  if ((symbolFlags & SymbolFlagsAlias) !== 0) {
    if (node!.Kind === KindExportSpecifier || (node!.Kind === KindImportEqualsDeclaration && hasExportModifier)) {
      return Binder_declareSymbol(receiver, GetExports(Node_Symbol(container)!)!, Node_Symbol(container)!, node, symbolFlags, symbolExcludes);
    }
    return Binder_declareSymbol(receiver, GetLocals(container)!, undefined, node, symbolFlags, symbolExcludes);
  }
  if (!IsAmbientModule(node) && (hasExportModifier || (container!.Flags & NodeFlagsExportContext) !== 0)) {
    if (!IsLocalsContainer(container) || (HasSyntacticModifier(node, ModifierFlagsDefault) && Binder_getDeclarationName(receiver, node) === InternalSymbolNameMissing)) {
      return Binder_declareSymbol(receiver, GetExports(Node_Symbol(container)!)!, Node_Symbol(container)!, node, symbolFlags, symbolExcludes);
    }
    const exportKind: SymbolFlags = (symbolFlags & SymbolFlagsValue) !== 0 ? SymbolFlagsExportValue : SymbolFlagsNone;
    const local = Binder_declareSymbol(receiver, GetLocals(container)!, undefined, node, exportKind, symbolExcludes);
    local!.ExportSymbol = Binder_declareSymbol(receiver, GetExports(Node_Symbol(container)!)!, Node_Symbol(container)!, node, symbolFlags, symbolExcludes);
    (Node_ExportableData(node) as unknown as { LocalSymbol?: GoPtr<Symbol> }).LocalSymbol = local;
    return local;
  }
  return Binder_declareSymbol(receiver, GetLocals(container)!, undefined, node, symbolFlags, symbolExcludes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.declareClassMember","kind":"method","status":"implemented","sigHash":"fc75310c9e8cf4a45ab2f80365798d0b43a35834a91f63ee7029db2a222f97e5","bodyHash":"d7c7ff26d6c672f3cba6ca694fe7c65cbd3595398fe4e482833922f59e0d1fda"}
 *
 * Go source:
 * func (b *Binder) declareClassMember(node *ast.Node, symbolFlags ast.SymbolFlags, symbolExcludes ast.SymbolFlags) *ast.Symbol {
 * 	if ast.IsStatic(node) {
 * 		return b.declareSymbol(ast.GetExports(b.container.Symbol()), b.container.Symbol(), node, symbolFlags, symbolExcludes)
 * 	}
 * 	return b.declareSymbol(ast.GetMembers(b.container.Symbol()), b.container.Symbol(), node, symbolFlags, symbolExcludes)
 * }
 */
export function Binder_declareClassMember(receiver: GoPtr<Binder>, node: GoPtr<Node>, symbolFlags: SymbolFlags, symbolExcludes: SymbolFlags): GoPtr<Symbol> {
  if (IsStatic(node)) {
    return Binder_declareSymbol(receiver, GetExports(Node_Symbol(receiver!.container)!)!, Node_Symbol(receiver!.container)!, node, symbolFlags, symbolExcludes);
  }
  return Binder_declareSymbol(receiver, GetMembers(Node_Symbol(receiver!.container)!)!, Node_Symbol(receiver!.container)!, node, symbolFlags, symbolExcludes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.declareSourceFileMember","kind":"method","status":"implemented","sigHash":"9c44c11bc7bd72752752763bb49d2fc6fda75370fc685651946c168ef3ead427","bodyHash":"fc65ca4b20a871a29f8203c513a607ece6bf1887775a3b3d8b758e66d91fc28a"}
 *
 * Go source:
 * func (b *Binder) declareSourceFileMember(node *ast.Node, symbolFlags ast.SymbolFlags, symbolExcludes ast.SymbolFlags) *ast.Symbol {
 * 	if ast.IsExternalOrCommonJSModule(b.file) {
 * 		return b.declareModuleMember(node, symbolFlags, symbolExcludes)
 * 	}
 * 	return b.declareSymbol(ast.GetLocals(b.file.AsNode()), nil /*parent* /, node, symbolFlags, symbolExcludes)
 * }
 */
export function Binder_declareSourceFileMember(receiver: GoPtr<Binder>, node: GoPtr<Node>, symbolFlags: SymbolFlags, symbolExcludes: SymbolFlags): GoPtr<Symbol> {
  if (IsExternalOrCommonJSModule(receiver!.file)) {
    return Binder_declareModuleMember(receiver, node, symbolFlags, symbolExcludes);
  }
  return Binder_declareSymbol(receiver, GetLocals(Node_AsNode(receiver!.file as unknown as Node))!, undefined, node, symbolFlags, symbolExcludes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.declareSymbolAndAddToSymbolTable","kind":"method","status":"implemented","sigHash":"40e9df330f45c7c0270fd8cf57db6860d2a1fe392b4f2847bac75d4efc906c67","bodyHash":"e27c9cc2e1437d70054d98c9e877b625a287841beb6dc4fb9612420724326270"}
 *
 * Go source:
 * func (b *Binder) declareSymbolAndAddToSymbolTable(node *ast.Node, symbolFlags ast.SymbolFlags, symbolExcludes ast.SymbolFlags) *ast.Symbol {
 * 	switch b.container.Kind {
 * 	case ast.KindModuleDeclaration:
 * 		return b.declareModuleMember(node, symbolFlags, symbolExcludes)
 * 	case ast.KindSourceFile:
 * 		return b.declareSourceFileMember(node, symbolFlags, symbolExcludes)
 * 	case ast.KindClassExpression, ast.KindClassDeclaration:
 * 		return b.declareClassMember(node, symbolFlags, symbolExcludes)
 * 	case ast.KindEnumDeclaration:
 * 		return b.declareSymbol(ast.GetExports(b.container.Symbol()), b.container.Symbol(), node, symbolFlags, symbolExcludes)
 * 	case ast.KindTypeLiteral, ast.KindObjectLiteralExpression, ast.KindInterfaceDeclaration, ast.KindJsxAttributes:
 * 		return b.declareSymbol(ast.GetMembers(b.container.Symbol()), b.container.Symbol(), node, symbolFlags, symbolExcludes)
 * 	case ast.KindFunctionType, ast.KindConstructorType, ast.KindCallSignature, ast.KindConstructSignature,
 * 		ast.KindIndexSignature, ast.KindMethodDeclaration, ast.KindMethodSignature, ast.KindConstructor, ast.KindGetAccessor,
 * 		ast.KindSetAccessor, ast.KindFunctionDeclaration, ast.KindFunctionExpression, ast.KindArrowFunction,
 * 		ast.KindClassStaticBlockDeclaration, ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration, ast.KindMappedType:
 * 		return b.declareSymbol(ast.GetLocals(b.container), nil /*parent* /, node, symbolFlags, symbolExcludes)
 * 	}
 * 	panic("Unhandled case in declareSymbolAndAddToSymbolTable")
 * }
 */
export function Binder_declareSymbolAndAddToSymbolTable(receiver: GoPtr<Binder>, node: GoPtr<Node>, symbolFlags: SymbolFlags, symbolExcludes: SymbolFlags): GoPtr<Symbol> {
  switch (receiver!.container!.Kind) {
    case KindModuleDeclaration:
      return Binder_declareModuleMember(receiver, node, symbolFlags, symbolExcludes);
    case KindSourceFile:
      return Binder_declareSourceFileMember(receiver, node, symbolFlags, symbolExcludes);
    case KindClassExpression:
    case KindClassDeclaration:
      return Binder_declareClassMember(receiver, node, symbolFlags, symbolExcludes);
    case KindEnumDeclaration:
      return Binder_declareSymbol(receiver, GetExports(Node_Symbol(receiver!.container)!)!, Node_Symbol(receiver!.container)!, node, symbolFlags, symbolExcludes);
    case KindTypeLiteral:
    case KindObjectLiteralExpression:
    case KindInterfaceDeclaration:
    case KindJsxAttributes:
      return Binder_declareSymbol(receiver, GetMembers(Node_Symbol(receiver!.container)!)!, Node_Symbol(receiver!.container)!, node, symbolFlags, symbolExcludes);
    case KindFunctionType:
    case KindConstructorType:
    case KindCallSignature:
    case KindConstructSignature:
    case KindIndexSignature:
    case KindMethodDeclaration:
    case KindMethodSignature:
    case KindConstructor:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindFunctionDeclaration:
    case KindFunctionExpression:
    case KindArrowFunction:
    case KindClassStaticBlockDeclaration:
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
    case KindMappedType:
      return Binder_declareSymbol(receiver, GetLocals(receiver!.container)!, undefined, node, symbolFlags, symbolExcludes);
  }
  throw new globalThis.Error("Unhandled case in declareSymbolAndAddToSymbolTable");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.newFlowNode","kind":"method","status":"implemented","sigHash":"0f6c543a457136a1a4f8f9802ed5bda68c43c52e3a5726cf1e37d41d6b246096","bodyHash":"e208a08128dfbf15e44eb8d8ebf2b88a75bf2820f1f1eee2c55e5313a4ca2f77"}
 *
 * Go source:
 * func (b *Binder) newFlowNode(flags ast.FlowFlags) *ast.FlowNode {
 * 	result := b.flowNodeArena.New()
 * 	result.Flags = flags
 * 	return result
 * }
 */
export function Binder_newFlowNode(receiver: GoPtr<Binder>, flags: FlowFlags): GoPtr<FlowNode> {
  const result = Arena_New(receiver!.flowNodeArena);
  result!.Flags = flags;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.newFlowNodeEx","kind":"method","status":"implemented","sigHash":"a308beccf20f6827712b0b1134833841e83c5488331643461bc2a3b23d4f47a9","bodyHash":"07015f2cac7523f9db9bd2d408b3662c83def8c5d83b9a60540cc9f7dfc71a53"}
 *
 * Go source:
 * func (b *Binder) newFlowNodeEx(flags ast.FlowFlags, node *ast.Node, antecedent *ast.FlowNode) *ast.FlowNode {
 * 	result := b.newFlowNode(flags)
 * 	result.Node = node
 * 	result.Antecedent = antecedent
 * 	return result
 * }
 */
export function Binder_newFlowNodeEx(receiver: GoPtr<Binder>, flags: FlowFlags, node: GoPtr<Node>, antecedent: GoPtr<FlowNode>): GoPtr<FlowNode> {
  const result = Binder_newFlowNode(receiver, flags);
  result!.Node = node;
  result!.Antecedent = antecedent;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.createLoopLabel","kind":"method","status":"implemented","sigHash":"500341735dc00fa8248fc0d4221e520fbfe0ea346db869a446587b31d55e618a","bodyHash":"ceabfaf333a2e15c41654d20424709b2f4b3366829c96447820749ed8401bf04"}
 *
 * Go source:
 * func (b *Binder) createLoopLabel() *ast.FlowLabel {
 * 	return b.newFlowNode(ast.FlowFlagsLoopLabel)
 * }
 */
export function Binder_createLoopLabel(receiver: GoPtr<Binder>): GoPtr<FlowLabel> {
  return Binder_newFlowNode(receiver, FlowFlagsLoopLabel);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.createBranchLabel","kind":"method","status":"implemented","sigHash":"a7807f1f45d834a30f496c3da66133da824f9b0fd0a2c0754e760b38db4b9eac","bodyHash":"4972ccb38ad5d7658d4d6354f97d2225e8486c7ee92ddfefa332cc1c281294c2"}
 *
 * Go source:
 * func (b *Binder) createBranchLabel() *ast.FlowLabel {
 * 	return b.newFlowNode(ast.FlowFlagsBranchLabel)
 * }
 */
export function Binder_createBranchLabel(receiver: GoPtr<Binder>): GoPtr<FlowLabel> {
  return Binder_newFlowNode(receiver, FlowFlagsBranchLabel);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.createReduceLabel","kind":"method","status":"implemented","sigHash":"373d86fe8c15a2020a1bb2976a918bae45b4218aad53fc0462d6a631c668248d","bodyHash":"364446fd12f8071f5d58af1e6f66806890899dddf2dbcdbe66abc259fdaecb49"}
 *
 * Go source:
 * func (b *Binder) createReduceLabel(target *ast.FlowLabel, antecedents *ast.FlowList, antecedent *ast.FlowNode) *ast.FlowNode {
 * 	return b.newFlowNodeEx(ast.FlowFlagsReduceLabel, ast.NewFlowReduceLabelData(target, antecedents), antecedent)
 * }
 */
export function Binder_createReduceLabel(receiver: GoPtr<Binder>, target: GoPtr<FlowLabel>, antecedents: GoPtr<FlowList>, antecedent: GoPtr<FlowNode>): GoPtr<FlowNode> {
  return Binder_newFlowNodeEx(receiver, FlowFlagsReduceLabel, NewFlowReduceLabelData(target, antecedents), antecedent);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.createFlowCondition","kind":"method","status":"implemented","sigHash":"df980a27fcd43ae88e57b2f68181bb2c2ae8d620b3341f28c2cd7673274c5c24","bodyHash":"a37bb07d0f8f407462b75017b5332a14159f03bbae2f3405d097a71be8d93112"}
 *
 * Go source:
 * func (b *Binder) createFlowCondition(flags ast.FlowFlags, antecedent *ast.FlowNode, expression *ast.Node) *ast.FlowNode {
 * 	if antecedent.Flags&ast.FlowFlagsUnreachable != 0 {
 * 		return antecedent
 * 	}
 * 	if expression == nil {
 * 		if flags&ast.FlowFlagsTrueCondition != 0 {
 * 			return antecedent
 * 		}
 * 		return b.unreachableFlow
 * 	}
 * 	if (expression.Kind == ast.KindTrueKeyword && flags&ast.FlowFlagsFalseCondition != 0 || expression.Kind == ast.KindFalseKeyword && flags&ast.FlowFlagsTrueCondition != 0) && !ast.IsExpressionOfOptionalChainRoot(expression) && !ast.IsNullishCoalesce(expression.Parent) {
 * 		return b.unreachableFlow
 * 	}
 * 	if !isNarrowingExpression(expression) {
 * 		return antecedent
 * 	}
 * 	setFlowNodeReferenced(antecedent)
 * 	return b.newFlowNodeEx(flags, expression, antecedent)
 * }
 */
export function Binder_createFlowCondition(receiver: GoPtr<Binder>, flags: FlowFlags, antecedent: GoPtr<FlowNode>, expression: GoPtr<Node>): GoPtr<FlowNode> {
  if ((antecedent!.Flags & FlowFlagsUnreachable) !== 0) {
    return antecedent;
  }
  if (expression === undefined) {
    if ((flags & FlowFlagsTrueCondition) !== 0) {
      return antecedent;
    }
    return receiver!.unreachableFlow;
  }
  if ((expression!.Kind === KindTrueKeyword && (flags & FlowFlagsFalseCondition) !== 0 || expression!.Kind === KindFalseKeyword && (flags & FlowFlagsTrueCondition) !== 0) && !IsExpressionOfOptionalChainRoot(expression) && !IsNullishCoalesce(expression!.Parent)) {
    return receiver!.unreachableFlow;
  }
  if (!isNarrowingExpression(expression)) {
    return antecedent;
  }
  setFlowNodeReferenced(antecedent!);
  return Binder_newFlowNodeEx(receiver, flags, expression, antecedent);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.createFlowMutation","kind":"method","status":"implemented","sigHash":"e198fcff0f0262aba84d3d5c6cd11f43dc508b1fb32e9aee82f542927891b733","bodyHash":"9fdacdd0cde3e6d11164f0f8ddebdbc769e3783cc190596d2c8e25a6b8456c69"}
 *
 * Go source:
 * func (b *Binder) createFlowMutation(flags ast.FlowFlags, antecedent *ast.FlowNode, node *ast.Node) *ast.FlowNode {
 * 	setFlowNodeReferenced(antecedent)
 * 	b.hasFlowEffects = true
 * 	result := b.newFlowNodeEx(flags, node, antecedent)
 * 	if b.currentExceptionTarget != nil {
 * 		b.addAntecedent(b.currentExceptionTarget, result)
 * 	}
 * 	return result
 * }
 */
export function Binder_createFlowMutation(receiver: GoPtr<Binder>, flags: FlowFlags, antecedent: GoPtr<FlowNode>, node: GoPtr<Node>): GoPtr<FlowNode> {
  setFlowNodeReferenced(antecedent!);
  receiver!.hasFlowEffects = true;
  const result = Binder_newFlowNodeEx(receiver, flags, node, antecedent);
  if (receiver!.currentExceptionTarget !== undefined) {
    Binder_addAntecedent(receiver, receiver!.currentExceptionTarget, result!);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.createFlowSwitchClause","kind":"method","status":"implemented","sigHash":"75cf485ccb5288141dff16493f0aee26ad8e454b3a2780040d03c70d7d38cd3f","bodyHash":"7eb2f325d9350e9d1e45cf817cc067525cc42c6812b25664fdec252e04deace7"}
 *
 * Go source:
 * func (b *Binder) createFlowSwitchClause(antecedent *ast.FlowNode, switchStatement *ast.Node, clauseStart int, clauseEnd int) *ast.FlowNode {
 * 	setFlowNodeReferenced(antecedent)
 * 	return b.newFlowNodeEx(ast.FlowFlagsSwitchClause, ast.NewFlowSwitchClauseData(switchStatement, clauseStart, clauseEnd), antecedent)
 * }
 */
export function Binder_createFlowSwitchClause(receiver: GoPtr<Binder>, antecedent: GoPtr<FlowNode>, switchStatement: GoPtr<Node>, clauseStart: int, clauseEnd: int): GoPtr<FlowNode> {
  setFlowNodeReferenced(antecedent!);
  return Binder_newFlowNodeEx(receiver, FlowFlagsSwitchClause, NewFlowSwitchClauseData(switchStatement, clauseStart, clauseEnd), antecedent);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.createFlowCall","kind":"method","status":"implemented","sigHash":"81b0b382a7a71a80392ea423374bc1b32dfd727c28e936bd4d5ffab9028ef61a","bodyHash":"3a88daf94a98dcb23f4fb225465c0d8815d73f0669da7b87ce8816667a0805e2"}
 *
 * Go source:
 * func (b *Binder) createFlowCall(antecedent *ast.FlowNode, node *ast.Node) *ast.FlowNode {
 * 	setFlowNodeReferenced(antecedent)
 * 	b.hasFlowEffects = true
 * 	return b.newFlowNodeEx(ast.FlowFlagsCall, node, antecedent)
 * }
 */
export function Binder_createFlowCall(receiver: GoPtr<Binder>, antecedent: GoPtr<FlowNode>, node: GoPtr<Node>): GoPtr<FlowNode> {
  setFlowNodeReferenced(antecedent!);
  receiver!.hasFlowEffects = true;
  return Binder_newFlowNodeEx(receiver, FlowFlagsCall, node, antecedent);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.newFlowList","kind":"method","status":"implemented","sigHash":"dc489be3388fbcdcc88eaa93d4a098af3672675d2ff4366c5de1d29e035fc17e","bodyHash":"ab5a049e083593f945f8ce21c4cbe9116f4e5ec204abe839ce9ca587c19f2f73"}
 *
 * Go source:
 * func (b *Binder) newFlowList(head *ast.FlowNode, tail *ast.FlowList) *ast.FlowList {
 * 	result := b.flowListArena.New()
 * 	result.Flow = head
 * 	result.Next = tail
 * 	return result
 * }
 */
export function Binder_newFlowList(receiver: GoPtr<Binder>, head: GoPtr<FlowNode>, tail: GoPtr<FlowList>): GoPtr<FlowList> {
  const result = Arena_New(receiver!.flowListArena);
  result!.Flow = head;
  result!.Next = tail;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.combineFlowLists","kind":"method","status":"implemented","sigHash":"4e81db48d4ea0ca9b5f4730d213a3ebe9928f75c301ee2b9bad1048470c021da","bodyHash":"22aee0ba7173121c7442a53f307be31aa5d09534df9290eaaa9f7d8b10f3d4eb"}
 *
 * Go source:
 * func (b *Binder) combineFlowLists(head *ast.FlowList, tail *ast.FlowList) *ast.FlowList {
 * 	if head == nil {
 * 		return tail
 * 	}
 * 	return b.newFlowList(head.Flow, b.combineFlowLists(head.Next, tail))
 * }
 */
export function Binder_combineFlowLists(receiver: GoPtr<Binder>, head: GoPtr<FlowList>, tail: GoPtr<FlowList>): GoPtr<FlowList> {
  if (head === undefined) {
    return tail;
  }
  return Binder_newFlowList(receiver, head!.Flow, Binder_combineFlowLists(receiver, head!.Next, tail));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.newSingleDeclaration","kind":"method","status":"implemented","sigHash":"bea51f80945da1e82ffe76025c07b9b452fb2b6b4b511f04a8709ac90e060862","bodyHash":"0c4fa5ac2d7014729f54177d403646bf0de3d0c432f738be3431596b1cef5d53"}
 *
 * Go source:
 * func (b *Binder) newSingleDeclaration(declaration *ast.Node) []*ast.Node {
 * 	return b.singleDeclarationsArena.NewSlice1(declaration)
 * }
 */
export function Binder_newSingleDeclaration(receiver: GoPtr<Binder>, declaration: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  return Arena_NewSlice1(receiver!.singleDeclarationsArena, declaration);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::setFlowNodeReferenced","kind":"func","status":"implemented","sigHash":"c0f3a90a52186ef3a6b24170aa90085ff98f103ab7e090ac8ab77000a6648e23","bodyHash":"1a3257a7bbc17c766a1f355a4d2ebc79bce24725e228eaf29d6316d49b82e4e3"}
 *
 * Go source:
 * func setFlowNodeReferenced(flow *ast.FlowNode) {
 * 	// On first reference we set the Referenced flag, thereafter we set the Shared flag
 * 	if flow.Flags&ast.FlowFlagsReferenced == 0 {
 * 		flow.Flags |= ast.FlowFlagsReferenced
 * 	} else {
 * 		flow.Flags |= ast.FlowFlagsShared
 * 	}
 * }
 */
export function setFlowNodeReferenced(flow: GoPtr<FlowNode>): void {
  // On first reference we set the Referenced flag, thereafter we set the Shared flag
  if ((flow!.Flags & FlowFlagsReferenced) === 0) {
    flow!.Flags = (flow!.Flags | FlowFlagsReferenced) as FlowFlags;
  } else {
    flow!.Flags = (flow!.Flags | FlowFlagsShared) as FlowFlags;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.addAntecedent","kind":"method","status":"implemented","sigHash":"8df5bc3cdf1e44bdefc9daf1523d56058858f5f8dd5340fa4cdc925037db64a1","bodyHash":"9806495d56b9146a717c741831eed4fedac4992c40a495d5a0058dc61c577123"}
 *
 * Go source:
 * func (b *Binder) addAntecedent(label *ast.FlowLabel, antecedent *ast.FlowNode) {
 * 	if antecedent.Flags&ast.FlowFlagsUnreachable != 0 {
 * 		return
 * 	}
 * 	// If antecedent isn't already on the Antecedents list, add it to the end of the list
 * 	var last *ast.FlowList
 * 	for list := label.Antecedents; list != nil; list = list.Next {
 * 		if list.Flow == antecedent {
 * 			return
 * 		}
 * 		last = list
 * 	}
 * 	if last == nil {
 * 		label.Antecedents = b.newFlowList(antecedent, nil)
 * 	} else {
 * 		last.Next = b.newFlowList(antecedent, nil)
 * 	}
 * 	setFlowNodeReferenced(antecedent)
 * }
 */
export function Binder_addAntecedent(receiver: GoPtr<Binder>, label: GoPtr<FlowLabel>, antecedent: GoPtr<FlowNode>): void {
  if ((antecedent!.Flags & FlowFlagsUnreachable) !== 0) {
    return;
  }
  let last: GoPtr<FlowList> = undefined;
  for (let list = label!.Antecedents; list !== undefined; list = list!.Next) {
    if (list!.Flow === antecedent) {
      return;
    }
    last = list;
  }
  if (last === undefined) {
    label!.Antecedents = Binder_newFlowList(receiver, antecedent, undefined);
  } else {
    last!.Next = Binder_newFlowList(receiver, antecedent, undefined);
  }
  setFlowNodeReferenced(antecedent!);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.finishFlowLabel","kind":"method","status":"implemented","sigHash":"7245d6ee9b6b60d4413443a59c1a9241c69fed83f7f7ffe197b03b925cf01abd","bodyHash":"46442432141eb2d7d4044d0816f6f83be02c0d9d5508e1c398074f648056338a"}
 *
 * Go source:
 * func (b *Binder) finishFlowLabel(label *ast.FlowLabel) *ast.FlowNode {
 * 	if label.Antecedents == nil {
 * 		return b.unreachableFlow
 * 	}
 * 	if label.Antecedents.Next == nil {
 * 		return label.Antecedents.Flow
 * 	}
 * 	return label
 * }
 */
export function Binder_finishFlowLabel(receiver: GoPtr<Binder>, label: GoPtr<FlowLabel>): GoPtr<FlowNode> {
  if (label!.Antecedents === undefined) {
    return receiver!.unreachableFlow;
  }
  if (label!.Antecedents!.Next === undefined) {
    return label!.Antecedents!.Flow;
  }
  return label;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bind","kind":"method","status":"implemented","sigHash":"b64e60c99a7b3c067cbe984f7ff1445561675da4cd98face0019e61b4769fbd5","bodyHash":"26da8d2a2b2cf6e2939ba4517e878237ba9e888a93f489af5002bcde68cb258a"}
 *
 * Go source:
 * func (b *Binder) bind(node *ast.Node) bool {
 * 	if node == nil {
 * 		return false
 * 	}
 * 	// Even though in the AST the jsdoc @typedef node belongs to the current node,
 * 	// its symbol might be in the same scope with the current node's symbol. Consider:
 * 	//
 * 	//     /** @typedef {string | number} MyType * /
 * 	//     function foo();
 * 	//
 * 	// Here the current node is "foo", which is a container, but the scope of "MyType" should
 * 	// not be inside "foo". Therefore we always bind @typedef before bind the parent node,
 * 	// and skip binding this tag later when binding all the other jsdoc tags.
 * 
 * 	// First we bind declaration nodes to a symbol if possible. We'll both create a symbol
 * 	// and then potentially add the symbol to an appropriate symbol table. Possible
 * 	// destination symbol tables are:
 * 	//
 * 	//  1) The 'exports' table of the current container's symbol.
 * 	//  2) The 'members' table of the current container's symbol.
 * 	//  3) The 'locals' table of the current container.
 * 	//
 * 	// However, not all symbols will end up in any of these tables. 'Anonymous' symbols
 * 	// (like TypeLiterals for example) will not be put in any table.
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		node.AsIdentifier().FlowNode = b.currentFlow
 * 		b.checkContextualIdentifier(node)
 * 	case ast.KindThisKeyword, ast.KindSuperKeyword:
 * 		if node.Kind == ast.KindThisKeyword {
 * 			b.seenThisKeyword = true
 * 		}
 * 		node.AsKeywordExpression().FlowNode = b.currentFlow
 * 	case ast.KindQualifiedName:
 * 		if b.currentFlow != nil && ast.IsPartOfTypeQuery(node) {
 * 			node.AsQualifiedName().FlowNode = b.currentFlow
 * 		}
 * 	case ast.KindMetaProperty:
 * 		node.AsMetaProperty().FlowNode = b.currentFlow
 * 	case ast.KindPrivateIdentifier:
 * 		b.checkPrivateIdentifier(node)
 * 	case ast.KindPropertyAccessExpression, ast.KindElementAccessExpression:
 * 		if b.currentFlow != nil && isNarrowableReference(node) {
 * 			setFlowNode(node, b.currentFlow)
 * 		}
 * 	case ast.KindBinaryExpression:
 * 		switch ast.GetAssignmentDeclarationKind(node) {
 * 		case ast.JSDeclarationKindModuleExports:
 * 			b.bindModuleExportsAssignment(node)
 * 		case ast.JSDeclarationKindExportsProperty:
 * 			b.bindExportsOrObjectDefineProperty(node)
 * 		case ast.JSDeclarationKindProperty:
 * 			b.bindExpandoPropertyAssignment(node)
 * 		case ast.JSDeclarationKindThisProperty:
 * 			b.bindThisPropertyAssignment(node)
 * 		}
 * 		b.checkStrictModeBinaryExpression(node)
 * 	case ast.KindCatchClause:
 * 		b.checkStrictModeCatchClause(node)
 * 	case ast.KindDeleteExpression:
 * 		b.checkStrictModeDeleteExpression(node)
 * 	case ast.KindPostfixUnaryExpression:
 * 		b.checkStrictModePostfixUnaryExpression(node)
 * 	case ast.KindPrefixUnaryExpression:
 * 		b.checkStrictModePrefixUnaryExpression(node)
 * 	case ast.KindWithStatement:
 * 		b.checkStrictModeWithStatement(node)
 * 	case ast.KindLabeledStatement:
 * 		b.checkStrictModeLabeledStatement(node)
 * 	case ast.KindThisType:
 * 		b.seenThisKeyword = true
 * 	case ast.KindTypeParameter:
 * 		b.bindTypeParameter(node)
 * 	case ast.KindParameter:
 * 		b.bindParameter(node)
 * 	case ast.KindVariableDeclaration:
 * 		b.bindVariableDeclarationOrBindingElement(node)
 * 	case ast.KindBindingElement:
 * 		node.AsBindingElement().FlowNode = b.currentFlow
 * 		b.bindVariableDeclarationOrBindingElement(node)
 * 	case ast.KindPropertyDeclaration, ast.KindPropertySignature:
 * 		b.bindPropertyWorker(node)
 * 	case ast.KindPropertyAssignment, ast.KindShorthandPropertyAssignment:
 * 		b.bindPropertyOrMethodOrAccessor(node, ast.SymbolFlagsProperty, ast.SymbolFlagsPropertyExcludes)
 * 	case ast.KindEnumMember:
 * 		b.bindPropertyOrMethodOrAccessor(node, ast.SymbolFlagsEnumMember, ast.SymbolFlagsEnumMemberExcludes)
 * 	case ast.KindCallSignature, ast.KindConstructSignature, ast.KindIndexSignature:
 * 		b.declareSymbolAndAddToSymbolTable(node, ast.SymbolFlagsSignature, ast.SymbolFlagsNone)
 * 	case ast.KindMethodDeclaration, ast.KindMethodSignature:
 * 		b.bindPropertyOrMethodOrAccessor(node, ast.SymbolFlagsMethod|getOptionalSymbolFlagForNode(node), core.IfElse(ast.IsObjectLiteralMethod(node), ast.SymbolFlagsPropertyExcludes, ast.SymbolFlagsMethodExcludes))
 * 	case ast.KindFunctionDeclaration:
 * 		b.bindFunctionDeclaration(node)
 * 	case ast.KindConstructor:
 * 		b.declareSymbolAndAddToSymbolTable(node, ast.SymbolFlagsConstructor, ast.SymbolFlagsNone)
 * 	case ast.KindGetAccessor:
 * 		b.bindPropertyOrMethodOrAccessor(node, ast.SymbolFlagsGetAccessor, ast.SymbolFlagsGetAccessorExcludes)
 * 	case ast.KindSetAccessor:
 * 		b.bindPropertyOrMethodOrAccessor(node, ast.SymbolFlagsSetAccessor, ast.SymbolFlagsSetAccessorExcludes)
 * 	case ast.KindFunctionType, ast.KindConstructorType:
 * 		b.bindFunctionOrConstructorType(node)
 * 	case ast.KindTypeLiteral, ast.KindMappedType:
 * 		b.bindAnonymousDeclaration(node, ast.SymbolFlagsTypeLiteral, ast.InternalSymbolNameType)
 * 	case ast.KindObjectLiteralExpression:
 * 		b.bindAnonymousDeclaration(node, ast.SymbolFlagsObjectLiteral, ast.InternalSymbolNameObject)
 * 	case ast.KindFunctionExpression, ast.KindArrowFunction:
 * 		b.bindFunctionExpression(node)
 * 	case ast.KindClassExpression, ast.KindClassDeclaration:
 * 		b.bindClassLikeDeclaration(node)
 * 	case ast.KindInterfaceDeclaration:
 * 		b.bindBlockScopedDeclaration(node, ast.SymbolFlagsInterface, ast.SymbolFlagsInterfaceExcludes)
 * 	case ast.KindCallExpression:
 * 		switch ast.GetAssignmentDeclarationKind(node) {
 * 		case ast.JSDeclarationKindObjectDefinePropertyValue:
 * 			b.bindExpandoPropertyAssignment(node)
 * 		case ast.JSDeclarationKindObjectDefinePropertyExports:
 * 			b.bindExportsOrObjectDefineProperty(node)
 * 		}
 * 		if ast.IsInJSFile(node) {
 * 			b.bindCallExpression(node)
 * 		}
 * 	case ast.KindTypeAliasDeclaration:
 * 		b.bindBlockScopedDeclaration(node, ast.SymbolFlagsTypeAlias, ast.SymbolFlagsTypeAliasExcludes)
 * 	case ast.KindJSTypeAliasDeclaration:
 * 		// Top-level JSTypeAliasDeclaration nodes are processed in bindContainer
 * 		if !ast.IsSourceFile(b.blockScopeContainer) {
 * 			b.bindBlockScopedDeclaration(node, ast.SymbolFlagsTypeAlias, ast.SymbolFlagsTypeAliasExcludes)
 * 		}
 * 	case ast.KindEnumDeclaration:
 * 		b.bindEnumDeclaration(node)
 * 	case ast.KindModuleDeclaration:
 * 		b.bindModuleDeclaration(node)
 * 	case ast.KindImportEqualsDeclaration, ast.KindNamespaceImport, ast.KindImportSpecifier, ast.KindExportSpecifier:
 * 		b.declareSymbolAndAddToSymbolTable(node, ast.SymbolFlagsAlias, ast.SymbolFlagsAliasExcludes)
 * 	case ast.KindNamespaceExportDeclaration:
 * 		b.bindNamespaceExportDeclaration(node)
 * 	case ast.KindImportClause:
 * 		b.bindImportClause(node)
 * 	case ast.KindExportDeclaration:
 * 		b.bindExportDeclaration(node)
 * 	case ast.KindExportAssignment:
 * 		b.bindExportAssignment(node)
 * 	case ast.KindSourceFile:
 * 		b.bindSourceFileIfExternalModule()
 * 	case ast.KindJsxAttributes:
 * 		b.bindJsxAttributes(node)
 * 	case ast.KindJsxAttribute:
 * 		b.bindJsxAttribute(node, ast.SymbolFlagsProperty, ast.SymbolFlagsPropertyExcludes)
 * 	}
 * 	// Then we recurse into the children of the node to bind them as well. For certain
 * 	// symbols we do specialized work when we recurse. For example, we'll keep track of
 * 	// the current 'container' node when it changes. This helps us know which symbol table
 * 	// a local should go into for example. Since terminal nodes are known not to have
 * 	// children, as an optimization we don't process those.
 * 	thisNodeOrAnySubnodesHasError := node.Flags&ast.NodeFlagsThisNodeHasError != 0
 * 	if node.Kind > ast.KindLastToken {
 * 		saveSeenParseError := b.seenParseError
 * 		b.seenParseError = false
 * 		containerFlags := GetContainerFlags(node)
 * 		if containerFlags == ContainerFlagsNone {
 * 			b.bindChildren(node)
 * 		} else {
 * 			b.bindContainer(node, containerFlags)
 * 		}
 * 		if b.seenParseError {
 * 			thisNodeOrAnySubnodesHasError = true
 * 		}
 * 		b.seenParseError = saveSeenParseError
 * 	}
 * 	if thisNodeOrAnySubnodesHasError {
 * 		node.Flags |= ast.NodeFlagsThisNodeOrAnySubNodesHasError
 * 		b.seenParseError = true
 * 	}
 * 	return false
 * }
 */
export function Binder_bind(receiver: GoPtr<Binder>, node: GoPtr<Node>): bool {
  if (node === undefined) {
    return false;
  }
  node!.Parent = receiver!.parent;
  const saveParent = receiver!.parent;
  receiver!.parent = node;
  // First bind declaration nodes to a symbol if possible.
  switch (node!.Kind) {
    case KindIdentifier:
      setFlowNode(node, receiver!.currentFlow);
      Binder_checkContextualIdentifier(receiver, node);
      break;
    case KindThisKeyword:
      receiver!.seenThisKeyword = true;
      setFlowNode(node, receiver!.currentFlow);
      break;
    case KindSuperKeyword:
      setFlowNode(node, receiver!.currentFlow);
      break;
    case KindQualifiedName:
      if (receiver!.currentFlow !== undefined && IsPartOfTypeQuery(node)) {
        setFlowNode(node, receiver!.currentFlow);
      }
      break;
    case KindMetaProperty:
      setFlowNode(node, receiver!.currentFlow);
      break;
    case KindPrivateIdentifier:
      Binder_checkPrivateIdentifier(receiver, node);
      break;
    case KindPropertyAccessExpression:
    case KindElementAccessExpression:
      if (receiver!.currentFlow !== undefined && isNarrowableReference(node)) {
        setFlowNode(node, receiver!.currentFlow);
      }
      break;
    case KindBinaryExpression:
      Binder_bindBinaryExpressionNode(receiver, node);
      break;
    case KindCatchClause:
      Binder_checkStrictModeCatchClause(receiver, node);
      break;
    case KindDeleteExpression:
      Binder_checkStrictModeDeleteExpression(receiver, node);
      break;
    case KindPostfixUnaryExpression:
      Binder_checkStrictModePostfixUnaryExpression(receiver, node);
      break;
    case KindPrefixUnaryExpression:
      Binder_checkStrictModePrefixUnaryExpression(receiver, node);
      break;
    case KindWithStatement:
      Binder_checkStrictModeWithStatement(receiver, node);
      break;
    case KindLabeledStatement:
      Binder_checkStrictModeLabeledStatement(receiver, node);
      break;
    case KindThisType:
      receiver!.seenThisKeyword = true;
      break;
    case KindTypeParameter:
      Binder_bindTypeParameter(receiver, node);
      break;
    case KindParameter:
      Binder_bindParameter(receiver, node);
      break;
    case KindVariableDeclaration:
      Binder_bindVariableDeclarationOrBindingElement(receiver, node);
      break;
    case KindBindingElement:
      setFlowNode(node, receiver!.currentFlow);
      Binder_bindVariableDeclarationOrBindingElement(receiver, node);
      break;
    case KindPropertyDeclaration:
    case KindPropertySignature:
      Binder_bindPropertyWorker(receiver, node);
      break;
    case KindPropertyAssignment:
    case KindShorthandPropertyAssignment:
      Binder_bindPropertyOrMethodOrAccessor(receiver, node, SymbolFlagsProperty, SymbolFlagsPropertyExcludes);
      break;
    case KindEnumMember:
      Binder_bindPropertyOrMethodOrAccessor(receiver, node, SymbolFlagsEnumMember, SymbolFlagsEnumMemberExcludes);
      break;
    case KindCallSignature:
    case KindConstructSignature:
    case KindIndexSignature:
      Binder_declareSymbolAndAddToSymbolTable(receiver, node, SymbolFlagsSignature, SymbolFlagsNone);
      break;
    case KindMethodDeclaration:
    case KindMethodSignature:
      Binder_bindPropertyOrMethodOrAccessor(receiver, node, (SymbolFlagsMethod | getOptionalSymbolFlagForNode(node)) as SymbolFlags, IfElse(IsObjectLiteralMethod(node), SymbolFlagsPropertyExcludes, SymbolFlagsMethodExcludes));
      break;
    case KindFunctionDeclaration:
      Binder_bindFunctionDeclaration(receiver, node);
      break;
    case KindConstructor:
      Binder_declareSymbolAndAddToSymbolTable(receiver, node, SymbolFlagsConstructor, SymbolFlagsNone);
      break;
    case KindGetAccessor:
      Binder_bindPropertyOrMethodOrAccessor(receiver, node, SymbolFlagsGetAccessor, SymbolFlagsGetAccessorExcludes);
      break;
    case KindSetAccessor:
      Binder_bindPropertyOrMethodOrAccessor(receiver, node, SymbolFlagsSetAccessor, SymbolFlagsSetAccessorExcludes);
      break;
    case KindFunctionType:
    case KindConstructorType:
      Binder_bindFunctionOrConstructorType(receiver, node);
      break;
    case KindTypeLiteral:
    case KindMappedType:
      Binder_bindAnonymousDeclaration(receiver, node, SymbolFlagsTypeLiteral, InternalSymbolNameType);
      break;
    case KindObjectLiteralExpression:
      Binder_bindAnonymousDeclaration(receiver, node, SymbolFlagsObjectLiteral, InternalSymbolNameObject);
      break;
    case KindFunctionExpression:
    case KindArrowFunction:
      Binder_bindFunctionExpression(receiver, node);
      break;
    case KindClassExpression:
    case KindClassDeclaration:
      Binder_bindClassLikeDeclaration(receiver, node);
      break;
    case KindInterfaceDeclaration:
      Binder_bindBlockScopedDeclaration(receiver, node, SymbolFlagsInterface, SymbolFlagsInterfaceExcludes);
      break;
    case KindCallExpression: {
      const callKind = GetAssignmentDeclarationKind(node);
      if (callKind === JSDeclarationKindObjectDefinePropertyValue) {
        Binder_bindExpandoPropertyAssignment(receiver, node);
      } else if (callKind === JSDeclarationKindObjectDefinePropertyExports) {
        Binder_bindExportsOrObjectDefineProperty(receiver, node);
      }
      if (IsInJSFile(node)) {
        Binder_bindCallExpression(receiver, node);
      }
      break;
    }
    case KindTypeAliasDeclaration:
      Binder_bindBlockScopedDeclaration(receiver, node, SymbolFlagsTypeAlias, SymbolFlagsTypeAliasExcludes);
      break;
    case KindJSTypeAliasDeclaration:
      if (!IsSourceFile(receiver!.blockScopeContainer)) {
        Binder_bindBlockScopedDeclaration(receiver, node, SymbolFlagsTypeAlias, SymbolFlagsTypeAliasExcludes);
      }
      break;
    case KindEnumDeclaration:
      Binder_bindEnumDeclaration(receiver, node);
      break;
    case KindModuleDeclaration:
      Binder_bindModuleDeclaration(receiver, node);
      break;
    case KindImportEqualsDeclaration:
    case KindNamespaceImport:
    case KindImportSpecifier:
    case KindExportSpecifier:
      Binder_declareSymbolAndAddToSymbolTable(receiver, node, SymbolFlagsAlias, SymbolFlagsAliasExcludes);
      break;
    case KindNamespaceExportDeclaration:
      Binder_bindNamespaceExportDeclaration(receiver, node);
      break;
    case KindImportClause:
      Binder_bindImportClause(receiver, node);
      break;
    case KindExportDeclaration:
      Binder_bindExportDeclaration(receiver, node);
      break;
    case KindExportAssignment:
      Binder_bindExportAssignment(receiver, node);
      break;
    case KindSourceFile:
      Binder_bindSourceFileIfExternalModule(receiver);
      break;
    case KindJsxAttributes:
      Binder_bindJsxAttributes(receiver, node);
      break;
    case KindJsxAttribute:
      Binder_bindJsxAttribute(receiver, node, SymbolFlagsProperty, SymbolFlagsPropertyExcludes);
      break;
  }
  // Then we recurse into the children of the node to bind them as well.
  let thisNodeOrAnySubnodesHasError = (node!.Flags & NodeFlagsThisNodeHasError) !== 0;
  if (node!.Kind > KindLastToken) {
    const saveSeenParseError = receiver!.seenParseError;
    receiver!.seenParseError = false;
    const containerFlags = GetContainerFlags(node);
    if (containerFlags === ContainerFlagsNone) {
      Binder_bindChildren(receiver, node);
    } else {
      Binder_bindContainer(receiver, node, containerFlags);
    }
    if (receiver!.seenParseError) {
      thisNodeOrAnySubnodesHasError = true;
    }
    receiver!.seenParseError = saveSeenParseError;
  }
  if (thisNodeOrAnySubnodesHasError) {
    node!.Flags = (node!.Flags | NodeFlagsThisNodeOrAnySubNodesHasError) as NodeFlags;
    receiver!.seenParseError = true;
  }
  receiver!.parent = saveParent;
  return false;
}

function Binder_bindBinaryExpressionNode(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const kind = GetAssignmentDeclarationKind(node);
  if (kind === JSDeclarationKindModuleExports) {
    Binder_bindModuleExportsAssignment(receiver, node);
  } else if (kind === JSDeclarationKindExportsProperty) {
    Binder_bindExportsOrObjectDefineProperty(receiver, node);
  } else if (kind === JSDeclarationKindProperty) {
    Binder_bindExpandoPropertyAssignment(receiver, node);
  } else if (kind === JSDeclarationKindThisProperty) {
    Binder_bindThisPropertyAssignment(receiver, node);
  }
  Binder_checkStrictModeBinaryExpression(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindPropertyWorker","kind":"method","status":"implemented","sigHash":"15e442267c63f956c774bf718ef42bf6decb2c213775d7315e2309da5d7b0e57","bodyHash":"7d5b32b0ad501c1f49be6080b19a94a14e7f2fe3d77fd96cf50c6a8cdc9f2fe9"}
 *
 * Go source:
 * func (b *Binder) bindPropertyWorker(node *ast.Node) {
 * 	isAutoAccessor := ast.IsAutoAccessorPropertyDeclaration(node)
 * 	includes := core.IfElse(isAutoAccessor, ast.SymbolFlagsAccessor, ast.SymbolFlagsProperty)
 * 	excludes := core.IfElse(isAutoAccessor, ast.SymbolFlagsAccessorExcludes, ast.SymbolFlagsPropertyExcludes)
 * 	b.bindPropertyOrMethodOrAccessor(node, includes|getOptionalSymbolFlagForNode(node), excludes)
 * }
 */
export function Binder_bindPropertyWorker(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const isAutoAccessor = IsAutoAccessorPropertyDeclaration(node);
  const includes = IfElse(isAutoAccessor, SymbolFlagsAccessor, SymbolFlagsProperty) as SymbolFlags;
  const excludes = IfElse(isAutoAccessor, SymbolFlagsAccessorExcludes, SymbolFlagsPropertyExcludes) as SymbolFlags;
  Binder_bindPropertyOrMethodOrAccessor(receiver, node, (includes | getOptionalSymbolFlagForNode(node)) as SymbolFlags, excludes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindSourceFileIfExternalModule","kind":"method","status":"implemented","sigHash":"e713bf77d2e57dd9eaa8242f4fd9260fe7717fd4fd56a1e2b5cde2180670d3f2","bodyHash":"f09582a0d245c933069634eb819aa75eed083af495aa6c8cb22a26d76f77303f"}
 *
 * Go source:
 * func (b *Binder) bindSourceFileIfExternalModule() {
 * 	b.setExportContextFlag(b.file.AsNode())
 * 	if ast.IsExternalOrCommonJSModule(b.file) {
 * 		b.bindSourceFileAsExternalModule()
 * 	} else if ast.IsJsonSourceFile(b.file) {
 * 		b.bindSourceFileAsExternalModule()
 * 		// Create symbol equivalent for the module.exports = {}
 * 		originalSymbol := b.file.Symbol
 * 		b.declareSymbol(ast.GetSymbolTable(&b.file.Symbol.Exports), b.file.Symbol, b.file.AsNode(), ast.SymbolFlagsProperty, ast.SymbolFlagsAll)
 * 		b.file.Symbol = originalSymbol
 * 	}
 * }
 */
export function Binder_bindSourceFileIfExternalModule(receiver: GoPtr<Binder>): void {
  const fileNode = receiver!.file as unknown as GoPtr<Node>;
  Binder_setExportContextFlag(receiver, fileNode);
  if (IsExternalOrCommonJSModule(receiver!.file)) {
    Binder_bindSourceFileAsExternalModule(receiver);
  } else if (IsJsonSourceFile(receiver!.file)) {
    Binder_bindSourceFileAsExternalModule(receiver);
    const fileDecl = Node_DeclarationData(fileNode);
    const originalSymbol = (fileDecl as unknown as { Symbol?: GoPtr<Symbol> })?.Symbol;
    const fileSymbol = Node_Symbol(fileNode);
    Binder_declareSymbol(receiver, GetExports(fileSymbol), fileSymbol, fileNode, SymbolFlagsProperty, SymbolFlagsAll);
    (fileDecl as unknown as { Symbol?: GoPtr<Symbol> }).Symbol = originalSymbol;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindSourceFileAsExternalModule","kind":"method","status":"implemented","sigHash":"66fd4414963c4bdc6c096e5119130903b26ac8acdb5dae9711dbd51881dc2a09","bodyHash":"ce99177ebe55630c1f8c3f4688a3b350f2a8aa8c38cc0e87114ce780f6284129"}
 *
 * Go source:
 * func (b *Binder) bindSourceFileAsExternalModule() {
 * 	b.bindAnonymousDeclaration(b.file.AsNode(), ast.SymbolFlagsValueModule, "\""+tspath.RemoveFileExtension(b.file.FileName())+"\"")
 * }
 */
export function Binder_bindSourceFileAsExternalModule(receiver: GoPtr<Binder>): void {
  Binder_bindAnonymousDeclaration(receiver, (receiver!.file as unknown as Node), SymbolFlagsValueModule, "\"" + RemoveFileExtension(SourceFile_FileName(receiver!.file)) + "\"");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindModuleDeclaration","kind":"method","status":"implemented","sigHash":"bf94669960f7e06a7c139786f31f9ea69caada91b6e56d70e0b1eaca7859f117","bodyHash":"f964ca27cba1ad0b649ba2a130537ad5ad642b5c56e89a756d8229225254d290"}
 *
 * Go source:
 * func (b *Binder) bindModuleDeclaration(node *ast.Node) {
 * 	b.setExportContextFlag(node)
 * 	if ast.IsAmbientModule(node) {
 * 		if ast.HasSyntacticModifier(node, ast.ModifierFlagsExport) {
 * 			b.errorOnFirstToken(node, diagnostics.X_export_modifier_cannot_be_applied_to_ambient_modules_and_module_augmentations_since_they_are_always_visible)
 * 		}
 * 		if ast.IsModuleAugmentationExternal(node) {
 * 			b.declareModuleSymbol(node)
 * 		} else {
 * 			name := node.AsModuleDeclaration().Name()
 * 			symbol := b.declareSymbolAndAddToSymbolTable(node, ast.SymbolFlagsValueModule, ast.SymbolFlagsValueModuleExcludes)
 * 
 * 			if ast.IsStringLiteral(name) {
 * 				pattern := core.TryParsePattern(name.Text())
 * 				if !pattern.IsValid() {
 * 					// An invalid pattern - must have multiple wildcards.
 * 					b.errorOnFirstToken(name, diagnostics.Pattern_0_can_have_at_most_one_Asterisk_character, name.Text())
 * 				} else if pattern.StarIndex >= 0 {
 * 					b.file.PatternAmbientModules = append(b.file.PatternAmbientModules, &ast.PatternAmbientModule{Pattern: pattern, Symbol: symbol})
 * 				}
 * 			}
 * 		}
 * 	} else {
 * 		state := b.declareModuleSymbol(node)
 * 		if state != ast.ModuleInstanceStateNonInstantiated {
 * 			symbol := node.Symbol()
 * 			// if module was already merged with some function, class or non-const enum, treat it as non-const-enum-only
 * 			constEnumOnlyModule := (symbol.Flags&(ast.SymbolFlagsFunction|ast.SymbolFlagsClass|ast.SymbolFlagsRegularEnum) == 0) &&
 * 				// Current must be `const enum` only
 * 				state == ast.ModuleInstanceStateConstEnumOnly &&
 * 				// Can't have been set to 'false' in a previous merged symbol. ('undefined' OK)
 * 				!b.notConstEnumOnlyModules.Has(symbol)
 * 			if constEnumOnlyModule {
 * 				symbol.Flags |= ast.SymbolFlagsConstEnumOnlyModule
 * 			} else {
 * 				symbol.Flags &^= ast.SymbolFlagsConstEnumOnlyModule
 * 				b.notConstEnumOnlyModules.Add(symbol)
 * 			}
 * 		}
 * 	}
 * }
 */
export function Binder_bindModuleDeclaration(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  Binder_setExportContextFlag(receiver, node);
  if (IsAmbientModule(node)) {
    if (HasSyntacticModifier(node, ModifierFlagsExport)) {
      Binder_errorOnFirstToken(receiver, node, X_export_modifier_cannot_be_applied_to_ambient_modules_and_module_augmentations_since_they_are_always_visible);
    }
    if (IsModuleAugmentationExternal(node)) {
      Binder_declareModuleSymbol(receiver, node);
    } else {
      const name = Node_Name(AsModuleDeclaration(node));
      const symbol = Binder_declareSymbolAndAddToSymbolTable(receiver, node, SymbolFlagsValueModule, SymbolFlagsValueModuleExcludes);
      if (IsStringLiteral(name)) {
        const pattern = TryParsePattern(Node_Text(name));
        if (!Pattern_IsValid(pattern)) {
          Binder_errorOnFirstToken(receiver, name, Pattern_0_can_have_at_most_one_Asterisk_character, Node_Text(name));
        } else if ((pattern.StarIndex as number) >= 0) {
          receiver!.file!.PatternAmbientModules = [...(receiver!.file!.PatternAmbientModules ?? []), { Pattern: pattern, Symbol: symbol }];
        }
      }
    }
  } else {
    const state = Binder_declareModuleSymbol(receiver, node);
    if (state !== ModuleInstanceStateNonInstantiated) {
      const symbol = Node_Symbol(node);
      const constEnumOnlyModule = ((symbol!.Flags & (SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsRegularEnum)) === 0) &&
        state === ModuleInstanceStateConstEnumOnly &&
        !Set_Has(receiver!.notConstEnumOnlyModules, symbol);
      if (constEnumOnlyModule) {
        symbol!.Flags = (symbol!.Flags | SymbolFlagsConstEnumOnlyModule) as SymbolFlags;
      } else {
        symbol!.Flags = (symbol!.Flags & ~SymbolFlagsConstEnumOnlyModule) as SymbolFlags;
        Set_Add(receiver!.notConstEnumOnlyModules, symbol);
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.declareModuleSymbol","kind":"method","status":"implemented","sigHash":"a2e71204c0a6345e50e098ecde4b56638dfc2f98228b91a2eaea3991f735a3c6","bodyHash":"fcb7e9ac4f0adcdfe47fffbc5177ecb4d0581c94339843d6e9a1f8d5a21b506c"}
 *
 * Go source:
 * func (b *Binder) declareModuleSymbol(node *ast.Node) ast.ModuleInstanceState {
 * 	state := ast.GetModuleInstanceState(node)
 * 	instantiated := state != ast.ModuleInstanceStateNonInstantiated
 * 	b.declareSymbolAndAddToSymbolTable(node, core.IfElse(instantiated, ast.SymbolFlagsValueModule, ast.SymbolFlagsNamespaceModule), core.IfElse(instantiated, ast.SymbolFlagsValueModuleExcludes, ast.SymbolFlagsNamespaceModuleExcludes))
 * 	return state
 * }
 */
export function Binder_declareModuleSymbol(receiver: GoPtr<Binder>, node: GoPtr<Node>): ModuleInstanceState {
  const state = GetModuleInstanceState(node);
  const instantiated = state !== ModuleInstanceStateNonInstantiated;
  Binder_declareSymbolAndAddToSymbolTable(receiver, node, IfElse(instantiated, SymbolFlagsValueModule, SymbolFlagsNamespaceModule) as SymbolFlags, IfElse(instantiated, SymbolFlagsValueModuleExcludes, SymbolFlagsNamespaceModuleExcludes) as SymbolFlags);
  return state;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindNamespaceExportDeclaration","kind":"method","status":"implemented","sigHash":"e281938a32b41749207296f07b86303c463ad40692ab7c3059ffa9879f202570","bodyHash":"f30e300ae1b6a98c9609f5663ebe2cafde543bfda9acbef1b61f2c2cd05bce3a"}
 *
 * Go source:
 * func (b *Binder) bindNamespaceExportDeclaration(node *ast.Node) {
 * 	if node.Modifiers() != nil {
 * 		b.errorOnNode(node, diagnostics.Modifiers_cannot_appear_here)
 * 	}
 * 	switch {
 * 	case !ast.IsSourceFile(node.Parent):
 * 		b.errorOnNode(node, diagnostics.Global_module_exports_may_only_appear_at_top_level)
 * 	case !ast.IsExternalModule(node.Parent.AsSourceFile()):
 * 		b.errorOnNode(node, diagnostics.Global_module_exports_may_only_appear_in_module_files)
 * 	case !node.Parent.AsSourceFile().IsDeclarationFile:
 * 		b.errorOnNode(node, diagnostics.Global_module_exports_may_only_appear_in_declaration_files)
 * 	default:
 * 		b.declareSymbol(ast.GetSymbolTable(&b.file.GlobalExports), b.file.Symbol, node, ast.SymbolFlagsAlias, ast.SymbolFlagsAliasExcludes)
 * 	}
 * }
 */
export function Binder_bindNamespaceExportDeclaration(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (Node_Modifiers(node) !== undefined) {
    Binder_errorOnNode(receiver, node, Modifiers_cannot_appear_here);
  }
  if (!IsSourceFile(node!.Parent)) {
    Binder_errorOnNode(receiver, node, Global_module_exports_may_only_appear_at_top_level);
  } else if (!IsExternalModule(AsSourceFile(node!.Parent))) {
    Binder_errorOnNode(receiver, node, Global_module_exports_may_only_appear_in_module_files);
  } else if (!AsSourceFile(node!.Parent)!.IsDeclarationFile) {
    Binder_errorOnNode(receiver, node, Global_module_exports_may_only_appear_in_declaration_files);
  } else {
    if (receiver!.file!.GlobalExports === undefined) {
      receiver!.file!.GlobalExports = new Map();
    }
    Binder_declareSymbol(receiver, receiver!.file!.GlobalExports, Node_Symbol(receiver!.file as unknown as GoPtr<Node>), node, SymbolFlagsAlias, SymbolFlagsAliasExcludes);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindImportClause","kind":"method","status":"implemented","sigHash":"4e3611bb5de53e5ee0dd76b8ac66f239ca00c1f87370fe69b52a8c0c1edc9b41","bodyHash":"21d58935d82793b7d6b0a704e75602ead539f2636373b4dc6c2f72ee999938eb"}
 *
 * Go source:
 * func (b *Binder) bindImportClause(node *ast.Node) {
 * 	if node.AsImportClause().Name() != nil {
 * 		b.declareSymbolAndAddToSymbolTable(node, ast.SymbolFlagsAlias, ast.SymbolFlagsAliasExcludes)
 * 	}
 * }
 */
export function Binder_bindImportClause(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (AsImportClause(node)!.name !== undefined) {
    Binder_declareSymbolAndAddToSymbolTable(receiver, node, SymbolFlagsAlias, SymbolFlagsAliasExcludes);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindExportDeclaration","kind":"method","status":"implemented","sigHash":"15c9e2eac90cd7a3ae2ae258b76e74ce70a4386860cc091b1d8a3c0710e2a0e2","bodyHash":"a07374a9d674d0356f6d4866a0e12d5a2b1ddcaccc537d02e4ef0b64ed924e70"}
 *
 * Go source:
 * func (b *Binder) bindExportDeclaration(node *ast.Node) {
 * 	decl := node.AsExportDeclaration()
 * 	if b.container.Symbol() == nil {
 * 		// Export * in some sort of block construct
 * 		b.bindAnonymousDeclaration(node, ast.SymbolFlagsExportStar, b.getDeclarationName(node))
 * 	} else if decl.ExportClause == nil {
 * 		// All export * declarations are collected in an __export symbol
 * 		b.declareSymbol(ast.GetExports(b.container.Symbol()), b.container.Symbol(), node, ast.SymbolFlagsExportStar, ast.SymbolFlagsNone)
 * 	} else if ast.IsNamespaceExport(decl.ExportClause) {
 * 		b.declareSymbol(ast.GetExports(b.container.Symbol()), b.container.Symbol(), decl.ExportClause, ast.SymbolFlagsAlias, ast.SymbolFlagsAliasExcludes)
 * 	}
 * }
 */
export function Binder_bindExportDeclaration(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const decl = AsExportDeclaration(node);
  if (Node_Symbol(receiver!.container) === undefined) {
    Binder_bindAnonymousDeclaration(receiver, node, SymbolFlagsExportStar, Binder_getDeclarationName(receiver, node));
  } else if (decl!.ExportClause === undefined) {
    Binder_declareSymbol(receiver, GetExports(Node_Symbol(receiver!.container)!)!, Node_Symbol(receiver!.container)!, node, SymbolFlagsExportStar, SymbolFlagsNone);
  } else if (IsNamespaceExport(decl!.ExportClause as unknown as GoPtr<Node>)) {
    Binder_declareSymbol(receiver, GetExports(Node_Symbol(receiver!.container)!)!, Node_Symbol(receiver!.container)!, decl!.ExportClause as unknown as GoPtr<Node>, SymbolFlagsAlias, SymbolFlagsAliasExcludes);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindExportAssignment","kind":"method","status":"implemented","sigHash":"98ecf925cbb6c65cfe61cac3cea6d0ff7a470d9df4947fd4c44a34e7d2babaf6","bodyHash":"f212dbd6771f11c8cbbd28ecb2fe3a8379d8a594e6dcb806582a0d6cd6704288"}
 *
 * Go source:
 * func (b *Binder) bindExportAssignment(node *ast.Node) {
 * 	container := b.container
 * 	if container.Symbol() == nil && ast.IsExportAssignment(node) {
 * 		// Incorrect export assignment in some sort of block construct
 * 		b.bindAnonymousDeclaration(node, ast.SymbolFlagsValue, b.getDeclarationName(node))
 * 	} else {
 * 		// If there is an `export default x;` alias declaration, can't `export default` anything else.
 * 		// (In contrast, you can still have `export default function f() {}` and `export default interface I {}`.)
 * 		flags := core.IfElse(ast.ExpressionIsAlias(node.Expression()), ast.SymbolFlagsAlias, ast.SymbolFlagsProperty)
 * 		symbol := b.declareSymbol(ast.GetExports(container.Symbol()), container.Symbol(), node, flags, ast.SymbolFlagsAll)
 * 		if node.AsExportAssignment().IsExportEquals {
 * 			// Ensure export assignments have a ValueDeclaration set.
 * 			SetValueDeclaration(symbol, node)
 * 		}
 * 	}
 * }
 */
export function Binder_bindExportAssignment(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const container = receiver!.container;
  if (Node_Symbol(container) === undefined && IsExportAssignment(node)) {
    Binder_bindAnonymousDeclaration(receiver, node, SymbolFlagsValue, Binder_getDeclarationName(receiver, node));
  } else {
    const flags = IfElse(ExpressionIsAlias(Node_Expression(node)), SymbolFlagsAlias, SymbolFlagsProperty) as SymbolFlags;
    const symbol = Binder_declareSymbol(receiver, GetExports(Node_Symbol(container)!)!, Node_Symbol(container)!, node, flags, SymbolFlagsAll);
    if (AsExportAssignment(node)!.IsExportEquals) {
      SetValueDeclaration(symbol!, node);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.trackNestedCJSExport","kind":"method","status":"implemented","sigHash":"ae4373312218a61507c84c337144eb24728e58fa26d75a0848344beeafb05fdd","bodyHash":"05f0dbac7946e9030e10d6672a41b481d774f46496b9da993d273a7b5af92150"}
 *
 * Go source:
 * func (b *Binder) trackNestedCJSExport(node *ast.Node) {
 * 	if !(ast.IsSourceFile(node.Parent) || ast.IsExpressionStatement(node.Parent) && ast.IsSourceFile(node.Parent.Parent)) {
 * 		b.nestedCJSExports = append(b.nestedCJSExports, node)
 * 	}
 * }
 */
export function Binder_trackNestedCJSExport(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (!(IsSourceFile(node!.Parent) || IsExpressionStatement(node!.Parent) && IsSourceFile(node!.Parent!.Parent))) {
    receiver!.nestedCJSExports = [...(receiver!.nestedCJSExports ?? []), node!];
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindJsxAttributes","kind":"method","status":"implemented","sigHash":"f68ef8ecc366abf327dfe29cbd1431d16191d0637b1900d2e5b3402100091050","bodyHash":"2613718c163d9218a4e6c736470aa8ef43a9d7fad4d01ef5dfc73940052f56c2"}
 *
 * Go source:
 * func (b *Binder) bindJsxAttributes(node *ast.Node) {
 * 	b.bindAnonymousDeclaration(node, ast.SymbolFlagsObjectLiteral, ast.InternalSymbolNameJSXAttributes)
 * }
 */
export function Binder_bindJsxAttributes(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  Binder_bindAnonymousDeclaration(receiver, node, SymbolFlagsObjectLiteral, InternalSymbolNameJSXAttributes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindJsxAttribute","kind":"method","status":"implemented","sigHash":"282c78b67088ca29309f5a186a3ea0764be3d9d8769bf32a05899fecbdb6e605","bodyHash":"5068e151f9de2338af41aac8f6b2af6e143b5f6f714bd849058d7c4ce3341508"}
 *
 * Go source:
 * func (b *Binder) bindJsxAttribute(node *ast.Node, symbolFlags ast.SymbolFlags, symbolExcludes ast.SymbolFlags) {
 * 	b.declareSymbolAndAddToSymbolTable(node, symbolFlags, symbolExcludes)
 * }
 */
export function Binder_bindJsxAttribute(receiver: GoPtr<Binder>, node: GoPtr<Node>, symbolFlags: SymbolFlags, symbolExcludes: SymbolFlags): void {
  Binder_declareSymbolAndAddToSymbolTable(receiver, node, symbolFlags, symbolExcludes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.setExportContextFlag","kind":"method","status":"implemented","sigHash":"0ab9449398a77f12709898102f9120dcfa0353b5e73fdc698d7da96ff12d97ed","bodyHash":"55979625fae6cce51cd9494856f63b914e24d8e9ee0984814b4b55dc69a9d824"}
 *
 * Go source:
 * func (b *Binder) setExportContextFlag(node *ast.Node) {
 * 	// A declaration source file or ambient module declaration that contains no export declarations (but possibly regular
 * 	// declarations with export modifiers) is an export context in which declarations are implicitly exported.
 * 	if node.Flags&ast.NodeFlagsAmbient != 0 && !b.hasExportDeclarations(node) {
 * 		node.Flags |= ast.NodeFlagsExportContext
 * 	} else {
 * 		node.Flags &^= ast.NodeFlagsExportContext
 * 	}
 * }
 */
export function Binder_setExportContextFlag(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if ((node!.Flags & NodeFlagsAmbient) !== 0 && !Binder_hasExportDeclarations(receiver, node)) {
    node!.Flags = (node!.Flags | NodeFlagsExportContext) as NodeFlags;
  } else {
    node!.Flags = (node!.Flags & ~NodeFlagsExportContext) as NodeFlags;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.hasExportDeclarations","kind":"method","status":"implemented","sigHash":"7c05b979970db7d0e2841ca7d50e470e266002439293803acef508f6d963ac66","bodyHash":"f02423d4d3dc0ec04b6fee5c39974e82bb0a7adc1ee50bf7acf777e0f8f258a1"}
 *
 * Go source:
 * func (b *Binder) hasExportDeclarations(node *ast.Node) bool {
 * 	var statements []*ast.Node
 * 	switch node.Kind {
 * 	case ast.KindSourceFile:
 * 		statements = node.Statements()
 * 	case ast.KindModuleDeclaration:
 * 		body := node.Body()
 * 		if body != nil && ast.IsModuleBlock(body) {
 * 			statements = body.Statements()
 * 		}
 * 	}
 * 	return core.Some(statements, func(s *ast.Node) bool {
 * 		return ast.IsExportDeclaration(s) || ast.IsExportAssignment(s)
 * 	})
 * }
 */
export function Binder_hasExportDeclarations(receiver: GoPtr<Binder>, node: GoPtr<Node>): bool {
  let statements: GoSlice<GoPtr<Node>> = [];
  switch (node!.Kind) {
    case KindSourceFile:
      statements = Node_Statements(node) ?? [];
      break;
    case KindModuleDeclaration: {
      const body = Node_Body(node);
      if (body !== undefined && IsModuleBlock(body)) {
        statements = Node_Statements(body) ?? [];
      }
      break;
    }
  }
  return Some(statements, (s) => IsExportDeclaration(s) || IsExportAssignment(s));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindFunctionExpression","kind":"method","status":"implemented","sigHash":"0cb84d232993283a56b12a23cbaf9cd82b40090ee254036bd43d14be4ebce811","bodyHash":"a537e03d974e7ef3de48baaf04ab86442cd3ada409aad5d16a92e32e7d9a7064"}
 *
 * Go source:
 * func (b *Binder) bindFunctionExpression(node *ast.Node) {
 * 	if !b.file.IsDeclarationFile && node.Flags&ast.NodeFlagsAmbient == 0 && ast.IsAsyncFunction(node) {
 * 		b.emitFlags |= ast.NodeFlagsHasAsyncFunctions
 * 	}
 * 	setFlowNode(node, b.currentFlow)
 * 	bindingName := ast.InternalSymbolNameFunction
 * 	if ast.IsFunctionExpression(node) && node.AsFunctionExpression().Name() != nil {
 * 		b.checkStrictModeFunctionName(node)
 * 		bindingName = node.AsFunctionExpression().Name().Text()
 * 	}
 * 	b.bindAnonymousDeclaration(node, ast.SymbolFlagsFunction, bindingName)
 * }
 */
export function Binder_bindFunctionExpression(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (!receiver!.file!.IsDeclarationFile && (node!.Flags & NodeFlagsAmbient) === 0 && IsAsyncFunction(node)) {
    receiver!.emitFlags = (receiver!.emitFlags | NodeFlagsHasAsyncFunctions) as NodeFlags;
  }
  setFlowNode(node, receiver!.currentFlow);
  let bindingName = InternalSymbolNameFunction;
  if (IsFunctionExpression(node) && AsFunctionExpression(node)!.name !== undefined) {
    Binder_checkStrictModeFunctionName(receiver, node);
    bindingName = Node_Text(AsFunctionExpression(node)!.name as unknown as Node);
  }
  Binder_bindAnonymousDeclaration(receiver, node, SymbolFlagsFunction, bindingName);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindCallExpression","kind":"method","status":"implemented","sigHash":"3ab8266d060f38651ba64de10ac0504900cea445b57d2d5abb8792fd663bcf4d","bodyHash":"b1a78bf7ae1c4df8a2f2b440908c7f572600b4597a2993d7e51fed9963c86455"}
 *
 * Go source:
 * func (b *Binder) bindCallExpression(node *ast.Node) {
 * 	// We're only inspecting call expressions to detect CommonJS modules, so we can skip
 * 	// this check if we've already seen the module indicator
 * 	if b.file.CommonJSModuleIndicator == nil && ast.IsRequireCall(node, false /*requireStringLiteralLikeArgument* /) {
 * 		b.setCommonJSModuleIndicator(node)
 * 	}
 * }
 */
export function Binder_bindCallExpression(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (receiver!.file!.CommonJSModuleIndicator === undefined && IsRequireCall(node, false)) {
    Binder_setCommonJSModuleIndicator(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.setCommonJSModuleIndicator","kind":"method","status":"implemented","sigHash":"fbea186c6d4c87b7310040cdd41fac3ed9029551aa0fd37ce0730afdcf063247","bodyHash":"16114a4ded8cfebeefe568faa93c54011331b59380876c85aac7556656cd21ea"}
 *
 * Go source:
 * func (b *Binder) setCommonJSModuleIndicator(node *ast.Node) bool {
 * 	if b.file.ExternalModuleIndicator != nil && b.file.ExternalModuleIndicator != b.file.AsNode() {
 * 		return false
 * 	}
 * 	if b.file.CommonJSModuleIndicator == nil {
 * 		b.file.CommonJSModuleIndicator = node
 * 		if b.file.ExternalModuleIndicator == nil {
 * 			b.bindSourceFileAsExternalModule()
 * 		}
 * 	}
 * 	return true
 * }
 */
export function Binder_setCommonJSModuleIndicator(receiver: GoPtr<Binder>, node: GoPtr<Node>): bool {
  const fileNode = receiver!.file as unknown as GoPtr<Node>;
  if (receiver!.file!.ExternalModuleIndicator !== undefined && receiver!.file!.ExternalModuleIndicator !== fileNode) {
    return false;
  }
  if (receiver!.file!.CommonJSModuleIndicator === undefined) {
    receiver!.file!.CommonJSModuleIndicator = node;
    if (receiver!.file!.ExternalModuleIndicator === undefined) {
      Binder_bindSourceFileAsExternalModule(receiver);
    }
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindClassLikeDeclaration","kind":"method","status":"implemented","sigHash":"279d7aea0cda1ecb5278155b6bf9c2b169783160595c760ba976635123aa6efe","bodyHash":"3e360ce073e564e07ae6d24de6473ee17c65e7c8762e42b76b509d36f9210e83"}
 *
 * Go source:
 * func (b *Binder) bindClassLikeDeclaration(node *ast.Node) {
 * 	name := node.Name()
 * 	switch node.Kind {
 * 	case ast.KindClassDeclaration:
 * 		b.bindBlockScopedDeclaration(node, ast.SymbolFlagsClass, ast.SymbolFlagsClassExcludes)
 * 	case ast.KindClassExpression:
 * 		nameText := ast.InternalSymbolNameClass
 * 		if name != nil {
 * 			nameText = name.Text()
 * 			b.classifiableNames.Add(nameText)
 * 		}
 * 		b.bindAnonymousDeclaration(node, ast.SymbolFlagsClass, nameText)
 * 	}
 * 	symbol := node.Symbol()
 * 	// TypeScript 1.0 spec (April 2014): 8.4
 * 	// Every class automatically contains a static property member named 'prototype', the
 * 	// type of which is an instantiation of the class type with type Any supplied as a type
 * 	// argument for each type parameter. It is an error to explicitly declare a static
 * 	// property member with the name 'prototype'.
 * 	//
 * 	// Note: we check for this here because this class may be merging into a module.  The
 * 	// module might have an exported variable called 'prototype'.  We can't allow that as
 * 	// that would clash with the built-in 'prototype' for the class.
 * 	prototypeSymbol := b.newSymbol(ast.SymbolFlagsProperty|ast.SymbolFlagsPrototype, "prototype")
 * 	symbolExport := ast.GetExports(symbol)[prototypeSymbol.Name]
 * 	if symbolExport != nil {
 * 		b.errorOnNode(symbolExport.Declarations[0], diagnostics.Duplicate_identifier_0, ast.SymbolName(prototypeSymbol))
 * 	}
 * 	ast.GetExports(symbol)[prototypeSymbol.Name] = prototypeSymbol
 * 	prototypeSymbol.Parent = symbol
 * }
 */
export function Binder_bindClassLikeDeclaration(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const name = Node_Name(node);
  switch (node!.Kind) {
    case KindClassDeclaration:
      Binder_bindBlockScopedDeclaration(receiver, node, SymbolFlagsClass, SymbolFlagsClassExcludes);
      break;
    case KindClassExpression: {
      let nameText = InternalSymbolNameClass;
      if (name !== undefined) {
        nameText = Node_Text(name as unknown as Node);
        Set_Add(receiver!.classifiableNames, nameText);
      }
      Binder_bindAnonymousDeclaration(receiver, node, SymbolFlagsClass, nameText);
      break;
    }
  }
  const symbol = Node_Symbol(node);
  const prototypeSymbol = Binder_newSymbol(receiver, (SymbolFlagsProperty | SymbolFlagsPrototype) as SymbolFlags, "prototype");
  const exports = GetExports(symbol);
  const symbolExport = exports?.get(prototypeSymbol!.Name);
  if (symbolExport !== undefined) {
    Binder_errorOnNode(receiver, symbolExport!.Declarations![0], Duplicate_identifier_0, SymbolName(prototypeSymbol));
  }
  exports?.set(prototypeSymbol!.Name, prototypeSymbol!);
  prototypeSymbol!.Parent = symbol;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindPropertyOrMethodOrAccessor","kind":"method","status":"implemented","sigHash":"027bbc1f3ae7da40c05b395dbaead8dd4086e24f35c6b42afaea6eeb372bed4e","bodyHash":"58a68d357d6deca3cbb4ca781c0ba63b3e76596f9d1d6d23b00cf717afe14b00"}
 *
 * Go source:
 * func (b *Binder) bindPropertyOrMethodOrAccessor(node *ast.Node, symbolFlags ast.SymbolFlags, symbolExcludes ast.SymbolFlags) {
 * 	if !b.file.IsDeclarationFile && node.Flags&ast.NodeFlagsAmbient == 0 && ast.IsAsyncFunction(node) {
 * 		b.emitFlags |= ast.NodeFlagsHasAsyncFunctions
 * 	}
 * 	if b.currentFlow != nil && ast.IsObjectLiteralOrClassExpressionMethodOrAccessor(node) {
 * 		setFlowNode(node, b.currentFlow)
 * 	}
 * 	if ast.HasDynamicName(node) {
 * 		b.bindAnonymousDeclaration(node, symbolFlags, ast.InternalSymbolNameComputed)
 * 	} else {
 * 		b.declareSymbolAndAddToSymbolTable(node, symbolFlags, symbolExcludes)
 * 	}
 * }
 */
export function Binder_bindPropertyOrMethodOrAccessor(receiver: GoPtr<Binder>, node: GoPtr<Node>, symbolFlags: SymbolFlags, symbolExcludes: SymbolFlags): void {
  if (!receiver!.file!.IsDeclarationFile && (node!.Flags & NodeFlagsAmbient) === 0 && IsAsyncFunction(node)) {
    receiver!.emitFlags = (receiver!.emitFlags | NodeFlagsHasAsyncFunctions) as NodeFlags;
  }
  if (receiver!.currentFlow !== undefined && IsObjectLiteralOrClassExpressionMethodOrAccessor(node)) {
    setFlowNode(node, receiver!.currentFlow);
  }
  if (HasDynamicName(node)) {
    Binder_bindAnonymousDeclaration(receiver, node, symbolFlags, InternalSymbolNameComputed);
  } else {
    Binder_declareSymbolAndAddToSymbolTable(receiver, node, symbolFlags, symbolExcludes);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindFunctionOrConstructorType","kind":"method","status":"implemented","sigHash":"cce02a906e5bd6afb804ec8fbad5adb9fbf00e2878d29d58d9a3a122d091cd1d","bodyHash":"862c230a5375a93b08a6e3b160d3d291af02b36fe13d04f8afa996e6453a20f2"}
 *
 * Go source:
 * func (b *Binder) bindFunctionOrConstructorType(node *ast.Node) {
 * 	// For a given function symbol "<...>(...) => T" we want to generate a symbol identical
 * 	// to the one we would get for: { <...>(...): T }
 * 	//
 * 	// We do that by making an anonymous type literal symbol, and then setting the function
 * 	// symbol as its sole member. To the rest of the system, this symbol will be indistinguishable
 * 	// from an actual type literal symbol you would have gotten had you used the long form.
 * 	symbol := b.newSymbol(ast.SymbolFlagsSignature, b.getDeclarationName(node))
 * 	b.addDeclarationToSymbol(symbol, node, ast.SymbolFlagsSignature)
 * 	typeLiteralSymbol := b.newSymbol(ast.SymbolFlagsTypeLiteral, ast.InternalSymbolNameType)
 * 	b.addDeclarationToSymbol(typeLiteralSymbol, node, ast.SymbolFlagsTypeLiteral)
 * 	typeLiteralSymbol.Members = make(ast.SymbolTable)
 * 	typeLiteralSymbol.Members[symbol.Name] = symbol
 * }
 */
export function Binder_bindFunctionOrConstructorType(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const symbol = Binder_newSymbol(receiver, SymbolFlagsSignature, Binder_getDeclarationName(receiver, node));
  Binder_addDeclarationToSymbol(receiver, symbol!, node!, SymbolFlagsSignature);
  const typeLiteralSymbol = Binder_newSymbol(receiver, SymbolFlagsTypeLiteral, InternalSymbolNameType);
  Binder_addDeclarationToSymbol(receiver, typeLiteralSymbol!, node!, SymbolFlagsTypeLiteral);
  typeLiteralSymbol!.Members = new globalThis.Map<string, GoPtr<Symbol>>();
  typeLiteralSymbol!.Members.set(symbol!.Name, symbol);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.addLateBoundAssignmentDeclarationToSymbol","kind":"method","status":"implemented","sigHash":"4c55bc3a7c70893f6e97394a4ce3afe69ac46a9c71904c875e5444897d484456","bodyHash":"7fd402150ed9433bfdc87bd37c34e633230d81723b5e54c31a683110ccf88ede"}
 *
 * Go source:
 * func (b *Binder) addLateBoundAssignmentDeclarationToSymbol(node *ast.Node, symbol *ast.Symbol) {
 * 	exports := ast.GetExports(symbol)
 * 	assignmentSymbol := exports[ast.InternalSymbolNameAssignmentDeclaration]
 * 	if assignmentSymbol == nil {
 * 		assignmentSymbol = b.newSymbol(ast.SymbolFlagsNone, ast.InternalSymbolNameAssignmentDeclaration)
 * 		exports[ast.InternalSymbolNameAssignmentDeclaration] = assignmentSymbol
 * 	}
 * 	assignmentSymbol.Declarations = append(assignmentSymbol.Declarations, node)
 * }
 */
export function Binder_addLateBoundAssignmentDeclarationToSymbol(receiver: GoPtr<Binder>, node: GoPtr<Node>, symbol_: GoPtr<Symbol>): void {
  const exports = GetExports(symbol_);
  let assignmentSymbol = exports?.get(InternalSymbolNameAssignmentDeclaration);
  if (assignmentSymbol === undefined) {
    assignmentSymbol = Binder_newSymbol(receiver, SymbolFlagsNone, InternalSymbolNameAssignmentDeclaration);
    exports?.set(InternalSymbolNameAssignmentDeclaration, assignmentSymbol!);
  }
  assignmentSymbol!.Declarations = [...(assignmentSymbol!.Declarations ?? []), node!];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindModuleExportsAssignment","kind":"method","status":"implemented","sigHash":"8a872c15798bb09bd3e05fe74dc2a55e50eeef571ec5ab1df5a09a81185b12b5","bodyHash":"e896d83dea0ceba0beac71ba760af1190dc14633470df6e770c438212d99bb62"}
 *
 * Go source:
 * func (b *Binder) bindModuleExportsAssignment(node *ast.Node) {
 * 	if b.setCommonJSModuleIndicator(node) {
 * 		b.trackNestedCJSExport(node)
 * 		container := b.file.AsNode()
 * 		flags := core.IfElse(ast.ExpressionIsAlias(node.AsBinaryExpression().Right), ast.SymbolFlagsAlias, ast.SymbolFlagsProperty)
 * 		symbol := b.declareSymbol(ast.GetExports(container.Symbol()), container.Symbol(), node, flags, 0)
 * 		SetValueDeclaration(symbol, node)
 * 	}
 * }
 */
export function Binder_bindModuleExportsAssignment(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (Binder_setCommonJSModuleIndicator(receiver, node)) {
    Binder_trackNestedCJSExport(receiver, node);
    const container = receiver!.file as unknown as GoPtr<Node>;
    const flags = IfElse(ExpressionIsAlias(AsBinaryExpression(node)!.Right), SymbolFlagsAlias, SymbolFlagsProperty) as SymbolFlags;
    const symbol = Binder_declareSymbol(receiver, GetExports(Node_Symbol(container)!)!, Node_Symbol(container)!, node, flags, 0 as SymbolFlags);
    SetValueDeclaration(symbol!, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindExpandoPropertyAssignment","kind":"method","status":"implemented","sigHash":"b0e71f8af4ca7525badb0f030a7e2a7b59c701e3121967eedcc6197f7f5847ae","bodyHash":"d0887cd92de37647f462394039192cb53b1272c0a1e606b4fe40c7142e9121ca"}
 *
 * Go source:
 * func (b *Binder) bindExpandoPropertyAssignment(node *ast.Node) {
 * 	b.expandoAssignments = append(b.expandoAssignments, ExpandoAssignmentInfo{
 * 		node:                node,
 * 		container:           b.container,
 * 		blockScopeContainer: b.blockScopeContainer,
 * 	})
 * }
 */
export function Binder_bindExpandoPropertyAssignment(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  receiver!.expandoAssignments = [...(receiver!.expandoAssignments ?? []), {
    node: node!,
    container: receiver!.container!,
    blockScopeContainer: receiver!.blockScopeContainer!,
  }];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindDeferredExpandoAssignments","kind":"method","status":"implemented","sigHash":"6eb7fc6d246abdbf0d2fc43a49ec72bfe20fb661fd66e0255c903dd137e6b506","bodyHash":"e92e01fce3d513d5a84bdf29a2a358720c5c8d8598edfb78bfa06bfd34494041"}
 *
 * Go source:
 * func (b *Binder) bindDeferredExpandoAssignments() {
 * 	for _, info := range b.expandoAssignments {
 * 		b.container = info.container
 * 		b.blockScopeContainer = info.blockScopeContainer
 * 		b.bindDeferredExpandoAssignment(info.node)
 * 	}
 * }
 */
export function Binder_bindDeferredExpandoAssignments(receiver: GoPtr<Binder>): void {
  for (const info of (receiver!.expandoAssignments ?? [])) {
    receiver!.container = info.container;
    receiver!.blockScopeContainer = info.blockScopeContainer;
    Binder_bindDeferredExpandoAssignment(receiver, info.node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindCommonJSTypeExports","kind":"method","status":"implemented","sigHash":"0a3b7f6b7543dfc83f1aa38cf7274c000d170d31505a58593d3f423fa3e86114","bodyHash":"3e4fed891e0028513d40f64d8ec6d3732b537182c3df899ec69397486518d555"}
 *
 * Go source:
 * func (b *Binder) bindCommonJSTypeExports(moduleSymbol *ast.Symbol) {
 * 	moduleExports := moduleSymbol.Exports
 * 	if exportEquals := moduleExports[ast.InternalSymbolNameExportEquals]; exportEquals != nil {
 * 		for _, symbol := range moduleExports {
 * 			if symbol.Name != ast.InternalSymbolNameExportEquals && symbol.Flags&(ast.SymbolFlagsType|ast.SymbolFlagsNamespace) != 0 {
 * 				ast.GetExports(exportEquals)[symbol.Name] = symbol
 * 				exportEquals.Flags |= ast.SymbolFlagsNamespaceModule
 * 			}
 * 		}
 * 	}
 * }
 */
export function Binder_bindCommonJSTypeExports(receiver: GoPtr<Binder>, moduleSymbol: GoPtr<Symbol>): void {
  const moduleExports = moduleSymbol!.Exports;
  if (moduleExports === undefined) { return; }
  const exportEquals = moduleExports.get(InternalSymbolNameExportEquals);
  if (exportEquals !== undefined) {
    for (const [, symbol_] of moduleExports) {
      if (symbol_!.Name !== InternalSymbolNameExportEquals && (symbol_!.Flags & (SymbolFlagsType | SymbolFlagsNamespace)) !== 0) {
        const exportEqualsExports = GetExports(exportEquals);
        exportEqualsExports?.set(symbol_!.Name, symbol_!);
        exportEquals!.Flags = (exportEquals!.Flags | SymbolFlagsNamespaceModule) as SymbolFlags;
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindDeferredExpandoAssignment","kind":"method","status":"implemented","sigHash":"8f50a2fd9855cf064e63ca18985c9a6d34bf26a89da23f362fae606dccbce8bf","bodyHash":"1480d36e75fab363b58c0e7252ffb98b06c471fc20cdfa256f7c90d7796f1075"}
 *
 * Go source:
 * func (b *Binder) bindDeferredExpandoAssignment(node *ast.Node) {
 * 	parent := getParentOfPropertyAssignment(node)
 * 	symbol := b.lookupEntity(parent, b.blockScopeContainer)
 * 	if symbol == nil {
 * 		symbol = b.lookupEntity(parent, b.container)
 * 	}
 * 	if symbol = getInitializerSymbol(symbol); symbol != nil {
 * 		if ast.HasDynamicName(node) {
 * 			b.bindAnonymousDeclaration(node, ast.SymbolFlagsProperty|ast.SymbolFlagsAssignment, ast.InternalSymbolNameComputed)
 * 			b.addLateBoundAssignmentDeclarationToSymbol(node, symbol)
 * 		} else {
 * 			// We declare expandos only when there are no non-expando declarations for that name.
 * 			exports := ast.GetExports(symbol)
 * 			if existing := exports[b.getDeclarationName(node)]; existing == nil || existing.Flags&ast.SymbolFlagsAssignment != 0 {
 * 				b.declareSymbol(exports, symbol, node, ast.SymbolFlagsProperty|ast.SymbolFlagsAssignment, ast.SymbolFlagsPropertyExcludes)
 * 			}
 * 		}
 * 	}
 * }
 */
export function Binder_bindDeferredExpandoAssignment(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const parent = getParentOfPropertyAssignment(node);
  let symbol = Binder_lookupEntity(receiver, parent, receiver!.blockScopeContainer);
  if (symbol === undefined) {
    symbol = Binder_lookupEntity(receiver, parent, receiver!.container);
  }
  symbol = getInitializerSymbol(symbol);
  if (symbol !== undefined) {
    if (HasDynamicName(node)) {
      Binder_bindAnonymousDeclaration(receiver, node, (SymbolFlagsProperty | SymbolFlagsAssignment) as SymbolFlags, InternalSymbolNameComputed);
      Binder_addLateBoundAssignmentDeclarationToSymbol(receiver, node, symbol);
    } else {
      const exports = GetExports(symbol);
      const existing = exports?.get(Binder_getDeclarationName(receiver, node));
      if (existing === undefined || (existing!.Flags & SymbolFlagsAssignment) !== 0) {
        Binder_declareSymbol(receiver, exports!, symbol, node, (SymbolFlagsProperty | SymbolFlagsAssignment) as SymbolFlags, SymbolFlagsPropertyExcludes);
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::getParentOfPropertyAssignment","kind":"func","status":"implemented","sigHash":"209640ef03a1082af8b3865cb08781250f7cd175a5643a9755d47a5a147cd32e","bodyHash":"08fcaeaa1dfe2a192e611b42c3859c9cbdb9a1dd707e7a07bc55918b8ca07491"}
 *
 * Go source:
 * func getParentOfPropertyAssignment(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindBinaryExpression:
 * 		return node.AsBinaryExpression().Left.Expression()
 * 	case ast.KindCallExpression:
 * 		return node.Arguments()[0]
 * 	}
 * 	panic("Unhandled case in getParentOfPropertyAssignment")
 * }
 */
export function getParentOfPropertyAssignment(node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindBinaryExpression:
      return Node_Expression(AsBinaryExpression(node)!.Left);
    case KindCallExpression:
      return Node_Arguments(node)![0];
  }
  throw new globalThis.Error("Unhandled case in getParentOfPropertyAssignment");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindExportsOrObjectDefineProperty","kind":"method","status":"implemented","sigHash":"f57ada5e475e7405f5db2d7aa41556cd48662d933d2ae3b60e8232f90f7c5b6b","bodyHash":"297fab573833ba0977c287beca4abb9682c1414fa09e9ae0622c2c350ca120c6"}
 *
 * Go source:
 * func (b *Binder) bindExportsOrObjectDefineProperty(node *ast.Node) {
 * 	if b.setCommonJSModuleIndicator(node) {
 * 		b.trackNestedCJSExport(node)
 * 		container := b.file.AsNode()
 * 		flags := core.IfElse(ast.IsBinaryExpression(node) && ast.ExpressionIsAlias(node.AsBinaryExpression().Right), ast.SymbolFlagsAlias, ast.SymbolFlagsFunctionScopedVariable)
 * 		b.declareSymbol(ast.GetExports(container.Symbol()), container.Symbol(), node, flags, ast.SymbolFlagsFunctionScopedVariableExcludes)
 * 	}
 * }
 */
export function Binder_bindExportsOrObjectDefineProperty(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (Binder_setCommonJSModuleIndicator(receiver, node)) {
    Binder_trackNestedCJSExport(receiver, node);
    const container = receiver!.file as unknown as GoPtr<Node>;
    const flags = IfElse(IsBinaryExpression(node) && ExpressionIsAlias(AsBinaryExpression(node)!.Right), SymbolFlagsAlias, SymbolFlagsFunctionScopedVariable) as SymbolFlags;
    Binder_declareSymbol(receiver, GetExports(Node_Symbol(container)!)!, Node_Symbol(container)!, node, flags, SymbolFlagsFunctionScopedVariableExcludes);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::getInitializerSymbol","kind":"func","status":"implemented","sigHash":"4880e6d88b929f21c1390dd12a331574e71d13edc74ed2f07b969dfb320fa918","bodyHash":"d47d4b01701011e1913a21e3c592ade0dad27d6b39f35ab46191577f471820bb"}
 *
 * Go source:
 * func getInitializerSymbol(symbol *ast.Symbol) *ast.Symbol {
 * 	if symbol == nil || symbol.ValueDeclaration == nil {
 * 		return nil
 * 	}
 * 	declaration := symbol.ValueDeclaration
 * 	// For an assignment 'fn.xxx = ...', where 'fn' is a previously declared function or a previously
 * 	// declared const variable initialized with a function expression or arrow function, we add expando
 * 	// property declarations to the function's symbol.
 * 	// This also applies to class expressions and empty object literals in JS files.
 * 	switch {
 * 	case ast.IsFunctionDeclaration(declaration) || ast.IsInJSFile(declaration) && ast.IsClassDeclaration(declaration):
 * 		return symbol
 * 	case ast.IsVariableDeclaration(declaration) &&
 * 		(declaration.Parent.Flags&ast.NodeFlagsConst != 0 || ast.IsInJSFile(declaration)):
 * 		initializer := declaration.Initializer()
 * 		if ast.IsExpandoInitializer(initializer) {
 * 			return initializer.Symbol()
 * 		}
 * 	case ast.IsBinaryExpression(declaration) && ast.IsInJSFile(declaration):
 * 		initializer := declaration.AsBinaryExpression().Right
 * 		if ast.IsExpandoInitializer(initializer) {
 * 			return initializer.Symbol()
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function getInitializerSymbol(symbol_: GoPtr<Symbol>): GoPtr<Symbol> {
  if (symbol_ === undefined || symbol_!.ValueDeclaration === undefined) {
    return undefined;
  }
  const declaration = symbol_!.ValueDeclaration;
  if (IsFunctionDeclaration(declaration) || (IsInJSFile(declaration) && IsClassDeclaration(declaration))) {
    return symbol_;
  }
  if (IsVariableDeclaration(declaration) && ((declaration!.Parent!.Flags & NodeFlagsConst) !== 0 || IsInJSFile(declaration))) {
    const initializer = Node_Initializer(declaration);
    if (IsExpandoInitializer(initializer)) {
      return Node_Symbol(initializer);
    }
  }
  if (IsBinaryExpression(declaration) && IsInJSFile(declaration)) {
    const initializer = AsBinaryExpression(declaration)!.Right;
    if (IsExpandoInitializer(initializer)) {
      return Node_Symbol(initializer);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindThisPropertyAssignment","kind":"method","status":"implemented","sigHash":"98764156db6616c7593f10a5f6850ab7cae53856ab8e3bc447871a3d9c0187de","bodyHash":"c7c716d33dd8807f39830cedd340b387e55e501950983bcf89dfd93b4d259fb5"}
 *
 * Go source:
 * func (b *Binder) bindThisPropertyAssignment(node *ast.Node) {
 * 	if !ast.IsInJSFile(node) {
 * 		return
 * 	}
 * 	bin := node.AsBinaryExpression()
 * 	if ast.IsPropertyAccessExpression(bin.Left) && ast.IsPrivateIdentifier(bin.Left.AsPropertyAccessExpression().Name()) ||
 * 		b.thisContainer == nil {
 * 		return
 * 	}
 * 	if classSymbol, symbolTable := b.getThisClassAndSymbolTable(); symbolTable != nil {
 * 		if ast.HasDynamicName(node) {
 * 			b.declareSymbolEx(symbolTable, classSymbol, node, ast.SymbolFlagsProperty, ast.SymbolFlagsNone, true /*isReplaceableByMethod* /, true /*isComputedName* /)
 * 			b.addLateBoundAssignmentDeclarationToSymbol(node, classSymbol)
 * 		} else {
 * 			b.declareSymbolEx(symbolTable, classSymbol, node, ast.SymbolFlagsProperty|ast.SymbolFlagsAssignment, ast.SymbolFlagsNone, true /*isReplaceableByMethod* /, false /*isComputedName* /)
 * 		}
 * 	} else if b.thisContainer.Kind != ast.KindFunctionDeclaration && b.thisContainer.Kind != ast.KindFunctionExpression {
 * 		// !!! constructor functions
 * 		panic("Unhandled case in bindThisPropertyAssignment: " + b.thisContainer.Kind.String())
 * 	}
 * }
 */
export function Binder_bindThisPropertyAssignment(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (!IsInJSFile(node)) { return; }
  const bin = AsBinaryExpression(node);
  if (IsPropertyAccessExpression(bin!.Left) && IsPrivateIdentifier(AsPropertyAccessExpression(bin!.Left)!.name as unknown as Node) || receiver!.thisContainer === undefined) {
    return;
  }
  const [classSymbol, symbolTable] = Binder_getThisClassAndSymbolTable(receiver);
  if (symbolTable !== undefined) {
    if (HasDynamicName(node)) {
      Binder_declareSymbolEx(receiver, symbolTable, classSymbol, node, SymbolFlagsProperty, SymbolFlagsNone, true, true);
      Binder_addLateBoundAssignmentDeclarationToSymbol(receiver, node, classSymbol);
    } else {
      Binder_declareSymbolEx(receiver, symbolTable, classSymbol, node, (SymbolFlagsProperty | SymbolFlagsAssignment) as SymbolFlags, SymbolFlagsNone, true, false);
    }
  } else if (receiver!.thisContainer!.Kind !== KindFunctionDeclaration && receiver!.thisContainer!.Kind !== KindFunctionExpression) {
    throw new globalThis.Error("Unhandled case in bindThisPropertyAssignment: " + receiver!.thisContainer!.Kind);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.getThisClassAndSymbolTable","kind":"method","status":"implemented","sigHash":"06497503f0304e19daa53c55a0375d2f901479e5d357f9ae78f00be1bb41a06e","bodyHash":"863dd5c5600228c7ec81533b03ed763bcef88c782285c05af38c191cfa084605"}
 *
 * Go source:
 * func (b *Binder) getThisClassAndSymbolTable() (classSymbol *ast.Symbol, symbolTable ast.SymbolTable) {
 * 	if b.thisContainer == nil {
 * 		return nil, nil
 * 	}
 * 	switch b.thisContainer.Kind {
 * 	case ast.KindFunctionDeclaration, ast.KindFunctionExpression:
 * 		// !!! constructor functions
 * 	case ast.KindConstructor, ast.KindPropertyDeclaration, ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor, ast.KindClassStaticBlockDeclaration:
 * 		// this.property assignment in class member -- bind to the containing class
 * 		classSymbol = b.thisContainer.Parent.Symbol()
 * 		if ast.IsStatic(b.thisContainer) {
 * 			symbolTable = ast.GetExports(classSymbol)
 * 		} else {
 * 			symbolTable = ast.GetMembers(classSymbol)
 * 		}
 * 	}
 * 	return classSymbol, symbolTable
 * }
 */
export function Binder_getThisClassAndSymbolTable(receiver: GoPtr<Binder>): [GoPtr<Symbol>, SymbolTable] {
  if (receiver!.thisContainer === undefined) {
    return [undefined, undefined as unknown as SymbolTable];
  }
  switch (receiver!.thisContainer!.Kind) {
    case KindFunctionDeclaration:
    case KindFunctionExpression:
      // constructor functions - not yet implemented
      break;
    case KindConstructor:
    case KindPropertyDeclaration:
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindClassStaticBlockDeclaration: {
      const classSymbol = Node_Symbol(receiver!.thisContainer!.Parent);
      const symbolTable = IsStatic(receiver!.thisContainer) ? GetExports(classSymbol) : GetMembers(classSymbol);
      return [classSymbol, symbolTable!];
    }
  }
  return [undefined, undefined as unknown as SymbolTable];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindEnumDeclaration","kind":"method","status":"implemented","sigHash":"f04f2fa1d16d0d0ef0cbd447fab206e0cc55e7a8b28c69b97fd667d6314bd025","bodyHash":"e5a5af44ed6d142d4a90eb612555f64124288495bd2505c65d1c967fa13f9f9d"}
 *
 * Go source:
 * func (b *Binder) bindEnumDeclaration(node *ast.Node) {
 * 	if ast.IsEnumConst(node) {
 * 		b.bindBlockScopedDeclaration(node, ast.SymbolFlagsConstEnum, ast.SymbolFlagsConstEnumExcludes)
 * 	} else {
 * 		b.bindBlockScopedDeclaration(node, ast.SymbolFlagsRegularEnum, ast.SymbolFlagsRegularEnumExcludes)
 * 	}
 * }
 */
export function Binder_bindEnumDeclaration(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (IsEnumConst(node)) {
    Binder_bindBlockScopedDeclaration(receiver, node, SymbolFlagsConstEnum, SymbolFlagsConstEnumExcludes);
  } else {
    Binder_bindBlockScopedDeclaration(receiver, node, SymbolFlagsRegularEnum, SymbolFlagsRegularEnumExcludes);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindVariableDeclarationOrBindingElement","kind":"method","status":"implemented","sigHash":"c887fcf5f289df3518589dcd35f88f3009d4f0b9ad0179c23939b554e8e95967","bodyHash":"17cecb55c562f657e4003445b5a42512e7a323f6c8f183e39c5c647db0efbe51"}
 *
 * Go source:
 * func (b *Binder) bindVariableDeclarationOrBindingElement(node *ast.Node) {
 * 	b.checkStrictModeEvalOrArguments(node, node.Name())
 * 	if name := node.Name(); name != nil && !ast.IsBindingPattern(name) {
 * 		switch {
 * 		case ast.IsVariableDeclarationInitializedToRequire(node):
 * 			b.declareSymbolAndAddToSymbolTable(node, ast.SymbolFlagsAlias, ast.SymbolFlagsAliasExcludes)
 * 		case ast.IsBlockOrCatchScoped(node):
 * 			b.bindBlockScopedDeclaration(node, ast.SymbolFlagsBlockScopedVariable, ast.SymbolFlagsBlockScopedVariableExcludes)
 * 		case ast.IsPartOfParameterDeclaration(node):
 * 			// It is safe to walk up parent chain to find whether the node is a destructuring parameter declaration
 * 			// because its parent chain has already been set up, since parents are set before descending into children.
 * 			//
 * 			// If node is a binding element in parameter declaration, we need to use ParameterExcludes.
 * 			// Using ParameterExcludes flag allows the compiler to report an error on duplicate identifiers in Parameter Declaration
 * 			// For example:
 * 			//      function foo([a,a]) {} // Duplicate Identifier error
 * 			//      function bar(a,a) {}   // Duplicate Identifier error, parameter declaration in this case is handled in bindParameter
 * 			//                             // which correctly set excluded symbols
 * 			b.declareSymbolAndAddToSymbolTable(node, ast.SymbolFlagsFunctionScopedVariable, ast.SymbolFlagsParameterExcludes)
 * 		default:
 * 			b.declareSymbolAndAddToSymbolTable(node, ast.SymbolFlagsFunctionScopedVariable, ast.SymbolFlagsFunctionScopedVariableExcludes)
 * 		}
 * 	}
 * }
 */
export function Binder_bindVariableDeclarationOrBindingElement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  Binder_checkStrictModeEvalOrArguments(receiver, node, Node_Name(node));
  const name = Node_Name(node);
  if (name !== undefined && !IsBindingPattern(name)) {
    if (IsVariableDeclarationInitializedToRequire(node)) {
      Binder_declareSymbolAndAddToSymbolTable(receiver, node, SymbolFlagsAlias, SymbolFlagsAliasExcludes);
    } else if (IsBlockOrCatchScoped(node)) {
      Binder_bindBlockScopedDeclaration(receiver, node, SymbolFlagsBlockScopedVariable, SymbolFlagsBlockScopedVariableExcludes);
    } else if (IsPartOfParameterDeclaration(node)) {
      Binder_declareSymbolAndAddToSymbolTable(receiver, node, SymbolFlagsFunctionScopedVariable, SymbolFlagsParameterExcludes);
    } else {
      Binder_declareSymbolAndAddToSymbolTable(receiver, node, SymbolFlagsFunctionScopedVariable, SymbolFlagsFunctionScopedVariableExcludes);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindParameter","kind":"method","status":"implemented","sigHash":"0e17e2f18f5398078c99b788c06baaace5181311859fc693bffed2e0be879497","bodyHash":"213b3a8d9e0f1a25a360f6537009f3a7bd332c2fa38b969868d14702daa9e2af"}
 *
 * Go source:
 * func (b *Binder) bindParameter(node *ast.Node) {
 * 	decl := node.AsParameterDeclaration()
 * 	if node.Flags&ast.NodeFlagsAmbient == 0 {
 * 		// It is a SyntaxError if the identifier eval or arguments appears within a FormalParameterList of a
 * 		// strict mode FunctionLikeDeclaration or FunctionExpression(13.1)
 * 		b.checkStrictModeEvalOrArguments(node, decl.Name())
 * 	}
 * 	if ast.IsBindingPattern(decl.Name()) {
 * 		index := slices.Index(node.Parent.Parameters(), node)
 * 		b.bindAnonymousDeclaration(node, ast.SymbolFlagsFunctionScopedVariable, "__"+strconv.Itoa(index))
 * 	} else {
 * 		b.declareSymbolAndAddToSymbolTable(node, ast.SymbolFlagsFunctionScopedVariable, ast.SymbolFlagsParameterExcludes)
 * 	}
 * 	// If this is a property-parameter, then also declare the property symbol into the
 * 	// containing class.
 * 	if ast.IsParameterPropertyDeclaration(node, node.Parent) {
 * 		classDeclaration := node.Parent.Parent
 * 		flags := ast.SymbolFlagsProperty | core.IfElse(decl.QuestionToken != nil, ast.SymbolFlagsOptional, ast.SymbolFlagsNone)
 * 		b.declareSymbol(ast.GetMembers(classDeclaration.Symbol()), classDeclaration.Symbol(), node, flags, ast.SymbolFlagsPropertyExcludes)
 * 	}
 * }
 */
export function Binder_bindParameter(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const decl = AsParameterDeclaration(node);
  if ((node!.Flags & NodeFlagsAmbient) === 0) {
    Binder_checkStrictModeEvalOrArguments(receiver, node, Node_Name(decl));
  }
  if (IsBindingPattern(Node_Name(decl))) {
    const params = Node_Parameters(node!.Parent);
    const index = params.indexOf(node);
    Binder_bindAnonymousDeclaration(receiver, node, SymbolFlagsFunctionScopedVariable, "__" + strconv.Itoa(index as int));
  } else {
    Binder_declareSymbolAndAddToSymbolTable(receiver, node, SymbolFlagsFunctionScopedVariable, SymbolFlagsParameterExcludes);
  }
  if (IsParameterPropertyDeclaration(node, node!.Parent)) {
    const classDeclaration = node!.Parent!.Parent;
    const flags = (SymbolFlagsProperty | IfElse(decl!.QuestionToken !== undefined, SymbolFlagsOptional, SymbolFlagsNone)) as SymbolFlags;
    Binder_declareSymbol(receiver, GetMembers(Node_Symbol(classDeclaration)), Node_Symbol(classDeclaration), node, flags, SymbolFlagsPropertyExcludes);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindFunctionDeclaration","kind":"method","status":"implemented","sigHash":"526ddce676c9190a9b99f689797e682d3fa4d878cc834efb8813d7ad1c62ddc1","bodyHash":"b754bfc1e3b64889b6b258568f10a1cb25a1794b78c50e6e0f9cec4e177600fe"}
 *
 * Go source:
 * func (b *Binder) bindFunctionDeclaration(node *ast.Node) {
 * 	if !b.file.IsDeclarationFile && node.Flags&ast.NodeFlagsAmbient == 0 && ast.IsAsyncFunction(node) {
 * 		b.emitFlags |= ast.NodeFlagsHasAsyncFunctions
 * 	}
 * 	b.checkStrictModeFunctionName(node)
 * 	b.bindBlockScopedDeclaration(node, ast.SymbolFlagsFunction, ast.SymbolFlagsFunctionExcludes)
 * }
 */
export function Binder_bindFunctionDeclaration(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (!receiver!.file!.IsDeclarationFile && (node!.Flags & NodeFlagsAmbient) === 0 && IsAsyncFunction(node)) {
    receiver!.emitFlags = (receiver!.emitFlags | NodeFlagsHasAsyncFunctions) as NodeFlags;
  }
  Binder_checkStrictModeFunctionName(receiver, node);
  Binder_bindBlockScopedDeclaration(receiver, node, SymbolFlagsFunction, SymbolFlagsFunctionExcludes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.getInferTypeContainer","kind":"method","status":"implemented","sigHash":"f2dd9b95ebc380bee7da2a9938249f55337382159811641f3cd6fc87d8e68fc2","bodyHash":"aef2d84df74ce6a5c033efd325e9da90b99bd573ff51c47d5a206165192547b5"}
 *
 * Go source:
 * func (b *Binder) getInferTypeContainer(node *ast.Node) *ast.Node {
 * 	extendsType := ast.FindAncestor(node, func(n *ast.Node) bool {
 * 		parent := n.Parent
 * 		return parent != nil && ast.IsConditionalTypeNode(parent) && parent.AsConditionalTypeNode().ExtendsType == n
 * 	})
 * 	if extendsType != nil {
 * 		return extendsType.Parent
 * 	}
 * 	return nil
 * }
 */
export function Binder_getInferTypeContainer(receiver: GoPtr<Binder>, node: GoPtr<Node>): GoPtr<Node> {
  const extendsType = FindAncestor(node, (n) => {
    const parent = n!.Parent;
    return parent !== undefined && IsConditionalTypeNode(parent) && AsConditionalTypeNode(parent)!.ExtendsType === n;
  });
  if (extendsType !== undefined) {
    return extendsType!.Parent;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindAnonymousDeclaration","kind":"method","status":"implemented","sigHash":"fffecf61ddfdf3739cd7e0f7abd1267acea36f0825664c6febbd5cbc88ee2e36","bodyHash":"a6c9be7ee03fed99fa38ddf7651060e0cc1b879fdf45d2a466878f96ee897320"}
 *
 * Go source:
 * func (b *Binder) bindAnonymousDeclaration(node *ast.Node, symbolFlags ast.SymbolFlags, name string) {
 * 	symbol := b.newSymbol(symbolFlags, name)
 * 	if symbolFlags&(ast.SymbolFlagsEnumMember|ast.SymbolFlagsClassMember) != 0 {
 * 		symbol.Parent = b.container.Symbol()
 * 	}
 * 	b.addDeclarationToSymbol(symbol, node, symbolFlags)
 * }
 */
export function Binder_bindAnonymousDeclaration(receiver: GoPtr<Binder>, node: GoPtr<Node>, symbolFlags: SymbolFlags, name: string): void {
  const symbol = Binder_newSymbol(receiver, symbolFlags, name);
  if ((symbolFlags & (SymbolFlagsEnumMember | SymbolFlagsClassMember)) !== 0) {
    symbol!.Parent = Node_Symbol(receiver!.container);
  }
  Binder_addDeclarationToSymbol(receiver, symbol, node, symbolFlags);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindBlockScopedDeclaration","kind":"method","status":"implemented","sigHash":"ea308c9c4514011ef9490b38009609dd3e7588ca484ac4566fed4d3371b8fd72","bodyHash":"5fa6710d8dbacbe2b0183ac10846eaf68b8a3f8c34cffd1784bbb40aea61302a"}
 *
 * Go source:
 * func (b *Binder) bindBlockScopedDeclaration(node *ast.Node, symbolFlags ast.SymbolFlags, symbolExcludes ast.SymbolFlags) {
 * 	switch b.blockScopeContainer.Kind {
 * 	case ast.KindModuleDeclaration:
 * 		b.declareModuleMember(node, symbolFlags, symbolExcludes)
 * 	case ast.KindSourceFile:
 * 		if ast.IsExternalOrCommonJSModule(b.container.AsSourceFile()) {
 * 			b.declareModuleMember(node, symbolFlags, symbolExcludes)
 * 			break
 * 		}
 * 		fallthrough
 * 	default:
 * 		b.declareSymbol(ast.GetLocals(b.blockScopeContainer), nil /*parent* /, node, symbolFlags, symbolExcludes)
 * 	}
 * }
 */
export function Binder_bindBlockScopedDeclaration(receiver: GoPtr<Binder>, node: GoPtr<Node>, symbolFlags: SymbolFlags, symbolExcludes: SymbolFlags): void {
  switch (receiver!.blockScopeContainer!.Kind) {
    case KindModuleDeclaration:
      Binder_declareModuleMember(receiver, node, symbolFlags, symbolExcludes);
      break;
    case KindSourceFile:
      if (IsExternalOrCommonJSModule(AsSourceFile(receiver!.blockScopeContainer))) {
        Binder_declareModuleMember(receiver, node, symbolFlags, symbolExcludes);
        break;
      }
      // fallthrough
    default:
      Binder_declareSymbol(receiver, GetLocals(receiver!.blockScopeContainer), undefined, node, symbolFlags, symbolExcludes);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindTypeParameter","kind":"method","status":"implemented","sigHash":"5175c58001bb23695b5097b38d8c8acd061f0de00638493b571c32c5be10749c","bodyHash":"e7cd741b5707dc7ba2939523c6d7296e66cd3aba61da971f47a4b0097aa1c72f"}
 *
 * Go source:
 * func (b *Binder) bindTypeParameter(node *ast.Node) {
 * 	if node.Parent.Kind == ast.KindInferType {
 * 		container := b.getInferTypeContainer(node.Parent)
 * 		if container != nil {
 * 			b.declareSymbol(ast.GetLocals(container), nil /*parent* /, node, ast.SymbolFlagsTypeParameter, ast.SymbolFlagsTypeParameterExcludes)
 * 		} else {
 * 			b.bindAnonymousDeclaration(node, ast.SymbolFlagsTypeParameter, b.getDeclarationName(node))
 * 		}
 * 	} else {
 * 		b.declareSymbolAndAddToSymbolTable(node, ast.SymbolFlagsTypeParameter, ast.SymbolFlagsTypeParameterExcludes)
 * 	}
 * }
 */
export function Binder_bindTypeParameter(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (node!.Parent!.Kind === KindInferType) {
    const container = Binder_getInferTypeContainer(receiver, node!.Parent);
    if (container !== undefined) {
      Binder_declareSymbol(receiver, GetLocals(container), undefined, node, SymbolFlagsTypeParameter, SymbolFlagsTypeParameterExcludes);
    } else {
      Binder_bindAnonymousDeclaration(receiver, node, SymbolFlagsTypeParameter, Binder_getDeclarationName(receiver, node));
    }
  } else {
    Binder_declareSymbolAndAddToSymbolTable(receiver, node, SymbolFlagsTypeParameter, SymbolFlagsTypeParameterExcludes);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.lookupEntity","kind":"method","status":"implemented","sigHash":"abffa7cbec099b623f18e8bef1d258d50b05534c770f182b4c3b9682395d2ad4","bodyHash":"84a1dd640058e00a701be88581858f71cb62ae32e9d0112f5d09d8d31f53cae0"}
 *
 * Go source:
 * func (b *Binder) lookupEntity(node *ast.Node, container *ast.Node) *ast.Symbol {
 * 	if ast.IsIdentifier(node) {
 * 		return b.lookupName(node.Text(), container)
 * 	}
 * 	if node.Expression().Kind == ast.KindThisKeyword {
 * 		if _, symbolTable := b.getThisClassAndSymbolTable(); symbolTable != nil {
 * 			if name := ast.GetElementOrPropertyAccessName(node); name != nil {
 * 				return symbolTable[name.Text()]
 * 			}
 * 		}
 * 		return nil
 * 	}
 * 	if symbol := getInitializerSymbol(b.lookupEntity(node.Expression(), container)); symbol != nil && symbol.Exports != nil {
 * 		if name := ast.GetElementOrPropertyAccessName(node); name != nil {
 * 			return symbol.Exports[name.Text()]
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Binder_lookupEntity(receiver: GoPtr<Binder>, node: GoPtr<Node>, container: GoPtr<Node>): GoPtr<Symbol> {
  if (IsIdentifier(node)) {
    return Binder_lookupName(receiver, Node_Text(node), container);
  }
  if (Node_Expression(node)!.Kind === KindThisKeyword) {
    const [, symbolTable] = Binder_getThisClassAndSymbolTable(receiver);
    if (symbolTable !== undefined) {
      const name = GetElementOrPropertyAccessName(node);
      if (name !== undefined) {
        return symbolTable.get(Node_Text(name));
      }
    }
    return undefined;
  }
  const symbol = getInitializerSymbol(Binder_lookupEntity(receiver, Node_Expression(node), container));
  if (symbol !== undefined && symbol!.Exports !== undefined) {
    const name = GetElementOrPropertyAccessName(node);
    if (name !== undefined) {
      return symbol!.Exports.get(Node_Text(name));
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.lookupName","kind":"method","status":"implemented","sigHash":"87f5dcbbe2f2833fa5b45f2ba08f81a4bc82294922e758179863a72264165c2f","bodyHash":"61e89a61b8f86b1fc839b9b25611995505893f81fb21a08e19e6b347c62e758c"}
 *
 * Go source:
 * func (b *Binder) lookupName(name string, container *ast.Node) *ast.Symbol {
 * 	if localsContainer := container.LocalsContainerData(); localsContainer != nil {
 * 		if local := localsContainer.Locals[name]; local != nil {
 * 			return core.OrElse(local.ExportSymbol, local)
 * 		}
 * 	}
 * 	if declaration := container.DeclarationData(); declaration != nil && declaration.Symbol != nil {
 * 		return declaration.Symbol.Exports[name]
 * 	}
 * 	return nil
 * }
 */
export function Binder_lookupName(receiver: GoPtr<Binder>, name: string, container: GoPtr<Node>): GoPtr<Symbol> {
  const localsContainer = Node_LocalsContainerData(container);
  if (localsContainer !== undefined) {
    const localsMap = (localsContainer as unknown as { Locals?: SymbolTable }).Locals;
    const local = localsMap?.get(name);
    if (local !== undefined) {
      return OrElse(local!.ExportSymbol, local);
    }
  }
  const declaration = Node_DeclarationData(container);
  const declSymbol = (declaration as unknown as { Symbol?: GoPtr<Symbol> })?.Symbol;
  if (declaration !== undefined && declSymbol !== undefined) {
    return declSymbol!.Exports?.get(name);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.checkContextualIdentifier","kind":"method","status":"implemented","sigHash":"56e0696f6e0d27073221bd9a2912576ac11adb86bb6ef5d664be434794e67e50","bodyHash":"b8a338e41c6869c02e4033b05f4c32d6e67ce4fa9d71a0a38e6f0a28b837062d"}
 *
 * Go source:
 * func (b *Binder) checkContextualIdentifier(node *ast.Node) {
 * 	// Report error only if there are no parse errors in file
 * 	if len(b.file.Diagnostics()) == 0 && node.Flags&ast.NodeFlagsAmbient == 0 && node.Flags&ast.NodeFlagsJSDoc == 0 && !ast.IsIdentifierName(node) {
 * 		// strict mode identifiers
 * 		originalKeywordKind := scanner.GetIdentifierToken(node.Text())
 * 		if originalKeywordKind == ast.KindIdentifier {
 * 			return
 * 		}
 * 		if originalKeywordKind >= ast.KindFirstFutureReservedWord && originalKeywordKind <= ast.KindLastFutureReservedWord {
 * 			b.errorOnNode(node, b.getStrictModeIdentifierMessage(node), scanner.DeclarationNameToString(node))
 * 		} else if originalKeywordKind == ast.KindAwaitKeyword {
 * 			if ast.IsExternalModule(b.file) && ast.IsInTopLevelContext(node) {
 * 				b.errorOnNode(node, diagnostics.Identifier_expected_0_is_a_reserved_word_at_the_top_level_of_a_module, scanner.DeclarationNameToString(node))
 * 			} else if node.Flags&ast.NodeFlagsAwaitContext != 0 {
 * 				b.errorOnNode(node, diagnostics.Identifier_expected_0_is_a_reserved_word_that_cannot_be_used_here, scanner.DeclarationNameToString(node))
 * 			}
 * 		} else if originalKeywordKind == ast.KindYieldKeyword && node.Flags&ast.NodeFlagsYieldContext != 0 {
 * 			b.errorOnNode(node, diagnostics.Identifier_expected_0_is_a_reserved_word_that_cannot_be_used_here, scanner.DeclarationNameToString(node))
 * 		}
 * 	}
 * }
 */
export function Binder_checkContextualIdentifier(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (SourceFile_Diagnostics(receiver!.file).length === 0 && (node!.Flags & NodeFlagsAmbient) === 0 && (node!.Flags & NodeFlagsJSDoc) === 0 && !IsIdentifierName(node)) {
    const originalKeywordKind = GetIdentifierToken(Node_Text(node));
    if (originalKeywordKind === KindIdentifier) {
      return;
    }
    if (originalKeywordKind >= KindFirstFutureReservedWord && originalKeywordKind <= KindLastFutureReservedWord) {
      Binder_errorOnNode(receiver, node, Binder_getStrictModeIdentifierMessage(receiver, node), DeclarationNameToString(node));
    } else if (originalKeywordKind === KindAwaitKeyword) {
      if (IsExternalModule(receiver!.file) && IsInTopLevelContext(node)) {
        Binder_errorOnNode(receiver, node, Identifier_expected_0_is_a_reserved_word_at_the_top_level_of_a_module, DeclarationNameToString(node));
      } else if ((node!.Flags & NodeFlagsAwaitContext) !== 0) {
        Binder_errorOnNode(receiver, node, Identifier_expected_0_is_a_reserved_word_that_cannot_be_used_here, DeclarationNameToString(node));
      }
    } else if (originalKeywordKind === KindYieldKeyword && (node!.Flags & NodeFlagsYieldContext) !== 0) {
      Binder_errorOnNode(receiver, node, Identifier_expected_0_is_a_reserved_word_that_cannot_be_used_here, DeclarationNameToString(node));
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.checkPrivateIdentifier","kind":"method","status":"implemented","sigHash":"46d25d58911174d4684d158e2faff64af91a9ab514b6ce6b299cea065f7c22c5","bodyHash":"9fd4168bff90e75ac855376e159f65f6ac22381e7736ea9cae168d24e4031ae6"}
 *
 * Go source:
 * func (b *Binder) checkPrivateIdentifier(node *ast.Node) {
 * 	if node.Text() == "#constructor" {
 * 		// Report error only if there are no parse errors in file
 * 		if len(b.file.Diagnostics()) == 0 {
 * 			b.errorOnNode(node, diagnostics.X_constructor_is_a_reserved_word, scanner.DeclarationNameToString(node))
 * 		}
 * 	}
 * }
 */
export function Binder_checkPrivateIdentifier(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (Node_Text(node) === "#constructor") {
    if (SourceFile_Diagnostics(receiver!.file).length === 0) {
      Binder_errorOnNode(receiver, node, X_constructor_is_a_reserved_word, DeclarationNameToString(node));
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.getStrictModeIdentifierMessage","kind":"method","status":"implemented","sigHash":"85f84be3ac7537dd4805b2ba7196959bc0cbd3f7ac380956c53d25a48de9ea68","bodyHash":"9b3350ec2f09add5feddf8d67ccca5858a73a1db6c3bb5af3a2bbc94e2b29ca2"}
 *
 * Go source:
 * func (b *Binder) getStrictModeIdentifierMessage(node *ast.Node) *diagnostics.Message {
 * 	// Provide specialized messages to help the user understand why we think they're in
 * 	// strict mode.
 * 	if ast.GetContainingClass(node) != nil {
 * 		return diagnostics.Identifier_expected_0_is_a_reserved_word_in_strict_mode_Class_definitions_are_automatically_in_strict_mode
 * 	}
 * 	if b.file.ExternalModuleIndicator != nil {
 * 		return diagnostics.Identifier_expected_0_is_a_reserved_word_in_strict_mode_Modules_are_automatically_in_strict_mode
 * 	}
 * 	return diagnostics.Identifier_expected_0_is_a_reserved_word_in_strict_mode
 * }
 */
export function Binder_getStrictModeIdentifierMessage(receiver: GoPtr<Binder>, node: GoPtr<Node>): GoPtr<Message> {
  if (GetContainingClass(node) !== undefined) {
    return Identifier_expected_0_is_a_reserved_word_in_strict_mode_Class_definitions_are_automatically_in_strict_mode;
  }
  if (receiver!.file!.ExternalModuleIndicator !== undefined) {
    return Identifier_expected_0_is_a_reserved_word_in_strict_mode_Modules_are_automatically_in_strict_mode;
  }
  return Identifier_expected_0_is_a_reserved_word_in_strict_mode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isUseStrictPrologueDirective","kind":"func","status":"implemented","sigHash":"ca7688ddcfe203fb24b86e3b2b7389205ccd51ccfbd5d1f5c2d6ebeef616c086","bodyHash":"e6c35c6be26e98f87a416101652b96fd3b44bfc259409bc59a8c172a1e9cb2b1"}
 *
 * Go source:
 * func isUseStrictPrologueDirective(sourceFile *ast.SourceFile, node *ast.Node) bool {
 * 	nodeText := scanner.GetSourceTextOfNodeFromSourceFile(sourceFile, node.Expression(), false /*includeTrivia* /)
 * 	// Note: the node text must be exactly "use strict" or 'use strict'.  It is not ok for the
 * 	// string to contain unicode escapes (as per ES5).
 * 	return nodeText == "\"use strict\"" || nodeText == "'use strict'"
 * }
 */
export function isUseStrictPrologueDirective(sourceFile: GoPtr<SourceFile>, node: GoPtr<Node>): bool {
  const nodeText = GetSourceTextOfNodeFromSourceFile(sourceFile, Node_Expression(node), false);
  return (nodeText === "\"use strict\"" || nodeText === "'use strict'") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::FindUseStrictPrologue","kind":"func","status":"implemented","sigHash":"0edce192f7e2d2be8a53be73f0bbf683d629899f4b67e58345587696f33af695","bodyHash":"2e1105b0cf824420a4ea4576c3bbb33ac2dcbf07cf1b784f4d3d2c6d0f51ceca"}
 *
 * Go source:
 * func FindUseStrictPrologue(sourceFile *ast.SourceFile, statements []*ast.Node) *ast.Node {
 * 	for _, statement := range statements {
 * 		if ast.IsPrologueDirective(statement) {
 * 			if isUseStrictPrologueDirective(sourceFile, statement) {
 * 				return statement
 * 			}
 * 		} else {
 * 			return nil
 * 		}
 * 	}
 * 
 * 	return nil
 * }
 */
export function FindUseStrictPrologue(sourceFile: GoPtr<SourceFile>, statements: GoSlice<GoPtr<Node>>): GoPtr<Node> {
  for (const statement of statements) {
    if (IsPrologueDirective(statement)) {
      if (isUseStrictPrologueDirective(sourceFile, statement)) {
        return statement;
      }
    } else {
      return undefined;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.checkStrictModeFunctionName","kind":"method","status":"implemented","sigHash":"c444e130710d36fcaedcb47f367870374641cce588d9204bd5d5603df8f3123d","bodyHash":"65745595c77638fe6f86f9e6c3fc5c4b0eafc9031c32443806196ca09da57471"}
 *
 * Go source:
 * func (b *Binder) checkStrictModeFunctionName(node *ast.Node) {
 * 	if node.Flags&ast.NodeFlagsAmbient == 0 {
 * 		// It is a SyntaxError if the identifier eval or arguments appears within a FormalParameterList of a strict mode FunctionDeclaration or FunctionExpression (13.1))
 * 		b.checkStrictModeEvalOrArguments(node, node.Name())
 * 	}
 * }
 */
export function Binder_checkStrictModeFunctionName(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if ((node!.Flags & NodeFlagsAmbient) === 0) {
    Binder_checkStrictModeEvalOrArguments(receiver, node, Node_Name(node));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.getStrictModeBlockScopeFunctionDeclarationMessage","kind":"method","status":"implemented","sigHash":"96f96a374e55bf84c439ac07d3e1368bc22e2d7ec63177add0fd19144a7a5bdf","bodyHash":"a72acb1b7e2f5f31e024fcee211ebd6a727e9eb76a34b5a8abd06ae1a7050a2c"}
 *
 * Go source:
 * func (b *Binder) getStrictModeBlockScopeFunctionDeclarationMessage(node *ast.Node) *diagnostics.Message {
 * 	// Provide specialized messages to help the user understand why we think they're in strict mode.
 * 	if ast.GetContainingClass(node) != nil {
 * 		return diagnostics.Function_declarations_are_not_allowed_inside_blocks_in_strict_mode_when_targeting_ES5_Class_definitions_are_automatically_in_strict_mode
 * 	}
 * 	if b.file.ExternalModuleIndicator != nil {
 * 		return diagnostics.Function_declarations_are_not_allowed_inside_blocks_in_strict_mode_when_targeting_ES5_Modules_are_automatically_in_strict_mode
 * 	}
 * 	return diagnostics.Function_declarations_are_not_allowed_inside_blocks_in_strict_mode_when_targeting_ES5
 * }
 */
export function Binder_getStrictModeBlockScopeFunctionDeclarationMessage(receiver: GoPtr<Binder>, node: GoPtr<Node>): GoPtr<Message> {
  if (GetContainingClass(node) !== undefined) {
    return Function_declarations_are_not_allowed_inside_blocks_in_strict_mode_when_targeting_ES5_Class_definitions_are_automatically_in_strict_mode;
  }
  if (receiver!.file!.ExternalModuleIndicator !== undefined) {
    return Function_declarations_are_not_allowed_inside_blocks_in_strict_mode_when_targeting_ES5_Modules_are_automatically_in_strict_mode;
  }
  return Function_declarations_are_not_allowed_inside_blocks_in_strict_mode_when_targeting_ES5;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.checkStrictModeBinaryExpression","kind":"method","status":"implemented","sigHash":"874390315ff7cf6e21c0f247b7cb482c6d505c4b9fc35d56bc3e227f63c946d6","bodyHash":"637481111998e2965cc8733610763d7a781ff28aadd38fd5a6971d16c224aff7"}
 *
 * Go source:
 * func (b *Binder) checkStrictModeBinaryExpression(node *ast.Node) {
 * 	expr := node.AsBinaryExpression()
 * 	if ast.IsLeftHandSideExpression(expr.Left) && ast.IsAssignmentOperator(expr.OperatorToken.Kind) {
 * 		// ECMA 262 (Annex C) The identifier eval or arguments may not appear as the LeftHandSideExpression of an
 * 		// Assignment operator(11.13) or of a PostfixExpression(11.3)
 * 		b.checkStrictModeEvalOrArguments(node, expr.Left)
 * 	}
 * }
 */
export function Binder_checkStrictModeBinaryExpression(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const expr = AsBinaryExpression(node);
  if (IsLeftHandSideExpression(expr!.Left) && IsAssignmentOperator(expr!.OperatorToken!.Kind)) {
    Binder_checkStrictModeEvalOrArguments(receiver, node, expr!.Left);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.checkStrictModeCatchClause","kind":"method","status":"implemented","sigHash":"05f1d10d6d0459a818a7e4c6a5045f4ee74dbe45498b3d656225e0b198a3bf26","bodyHash":"fff20c78e9fa3a08ed9f4ad2744d03d4ed7c4ca7845c1cd62a6928b65b41468f"}
 *
 * Go source:
 * func (b *Binder) checkStrictModeCatchClause(node *ast.Node) {
 * 	// It is a SyntaxError if a TryStatement with a Catch occurs within strict code and the Identifier of the
 * 	// Catch production is eval or arguments
 * 	clause := node.AsCatchClause()
 * 	if clause.VariableDeclaration != nil {
 * 		b.checkStrictModeEvalOrArguments(node, clause.VariableDeclaration.AsVariableDeclaration().Name())
 * 	}
 * }
 */
export function Binder_checkStrictModeCatchClause(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const clause = AsCatchClause(node);
  if (clause!.VariableDeclaration !== undefined) {
    const varDecl = AsVariableDeclaration(clause!.VariableDeclaration);
    Binder_checkStrictModeEvalOrArguments(receiver, node, Node_Name(varDecl));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.checkStrictModeDeleteExpression","kind":"method","status":"implemented","sigHash":"ae110d30a9b393876f020739cf0f54b33a97b91868f7c31c7c73eae53b935ad1","bodyHash":"240ea5a5f5560b3583cc7564a2f52e8327cbc5db5db939635673af266a9f57d0"}
 *
 * Go source:
 * func (b *Binder) checkStrictModeDeleteExpression(node *ast.Node) {
 * 	// Grammar checking
 * 	expr := node.AsDeleteExpression()
 * 	if expr.Expression.Kind == ast.KindIdentifier {
 * 		// When a delete operator occurs within strict mode code, a SyntaxError is thrown if its
 * 		// UnaryExpression is a direct reference to a variable, function argument, or function name
 * 		b.errorOnNode(expr.Expression, diagnostics.X_delete_cannot_be_called_on_an_identifier_in_strict_mode)
 * 	}
 * }
 */
export function Binder_checkStrictModeDeleteExpression(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const expr = AsDeleteExpression(node);
  if (expr!.Expression!.Kind === KindIdentifier) {
    Binder_errorOnNode(receiver, expr!.Expression, X_delete_cannot_be_called_on_an_identifier_in_strict_mode);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.checkStrictModePostfixUnaryExpression","kind":"method","status":"implemented","sigHash":"6747d756923e78a95895579bb79b56028f65543c4a0b3d027e06b2b56667da9d","bodyHash":"1fd1d96d821f2dc9e36956b3aa0a0afa48fa101794f40c86b5bc0d748ccf1048"}
 *
 * Go source:
 * func (b *Binder) checkStrictModePostfixUnaryExpression(node *ast.Node) {
 * 	// Grammar checking
 * 	// The identifier eval or arguments may not appear as the LeftHandSideExpression of an
 * 	// Assignment operator(11.13) or of a PostfixExpression(11.3) or as the UnaryExpression
 * 	// operated upon by a Prefix Increment(11.4.4) or a Prefix Decrement(11.4.5) operator.
 * 	b.checkStrictModeEvalOrArguments(node, node.AsPostfixUnaryExpression().Operand)
 * }
 */
export function Binder_checkStrictModePostfixUnaryExpression(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  Binder_checkStrictModeEvalOrArguments(receiver, node, AsPostfixUnaryExpression(node)!.Operand);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.checkStrictModePrefixUnaryExpression","kind":"method","status":"implemented","sigHash":"3cbcb4c636499a03e76c9e76534695372320ebc56c4c5513adc046340323be84","bodyHash":"0879d885df4e293f1e181143622f4077f0979919e6f04771a2a370434c3f837a"}
 *
 * Go source:
 * func (b *Binder) checkStrictModePrefixUnaryExpression(node *ast.Node) {
 * 	// Grammar checking
 * 	expr := node.AsPrefixUnaryExpression()
 * 	if expr.Operator == ast.KindPlusPlusToken || expr.Operator == ast.KindMinusMinusToken {
 * 		b.checkStrictModeEvalOrArguments(node, expr.Operand)
 * 	}
 * }
 */
export function Binder_checkStrictModePrefixUnaryExpression(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const expr = AsPrefixUnaryExpression(node);
  if (expr!.Operator === KindPlusPlusToken || expr!.Operator === KindMinusMinusToken) {
    Binder_checkStrictModeEvalOrArguments(receiver, node, expr!.Operand);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.checkStrictModeWithStatement","kind":"method","status":"implemented","sigHash":"b517cdf9e721da6187198cf4c247bd50eea1b6b13063bd154a3e6b43b23eae70","bodyHash":"88fbde1a48689f73f7582d111b40a3d3cd8bbfab3663cf7cf13b556c7f8e1ff0"}
 *
 * Go source:
 * func (b *Binder) checkStrictModeWithStatement(node *ast.Node) {
 * 	// Grammar checking for withStatement
 * 	b.errorOnFirstToken(node, diagnostics.X_with_statements_are_not_allowed_in_strict_mode)
 * }
 */
export function Binder_checkStrictModeWithStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  Binder_errorOnFirstToken(receiver, node, X_with_statements_are_not_allowed_in_strict_mode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.checkStrictModeLabeledStatement","kind":"method","status":"implemented","sigHash":"da74fc2e2f7d67925624d2c424e793fdea9aa2806beec2b4d5647fe1025dbc0d","bodyHash":"ae294363af500e126a7c30b8645a22d3ffe8a41efa79e843f95a858d617d4813"}
 *
 * Go source:
 * func (b *Binder) checkStrictModeLabeledStatement(node *ast.Node) {
 * 	// Grammar checking for labeledStatement
 * 	data := node.AsLabeledStatement()
 * 	if ast.IsDeclarationStatement(data.Statement) || ast.IsVariableStatement(data.Statement) {
 * 		b.errorOnFirstToken(data.Label, diagnostics.A_label_is_not_allowed_here)
 * 	}
 * }
 */
export function Binder_checkStrictModeLabeledStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const data = AsLabeledStatement(node);
  if (IsDeclarationStatement(data!.Statement) || IsVariableStatement(data!.Statement)) {
    Binder_errorOnFirstToken(receiver, data!.Label, A_label_is_not_allowed_here);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isEvalOrArgumentsIdentifier","kind":"func","status":"implemented","sigHash":"fefd90b82eb90ab2ec62ff86cf99df0a3fc30bfff2bbce36d2349536e3f96ffe","bodyHash":"915f226886a99c374048dc67fe3235a5e042630fedef65b8b017595ec31de673"}
 *
 * Go source:
 * func isEvalOrArgumentsIdentifier(node *ast.Node) bool {
 * 	if ast.IsIdentifier(node) {
 * 		text := node.Text()
 * 		return text == "eval" || text == "arguments"
 * 	}
 * 	return false
 * }
 */
export function isEvalOrArgumentsIdentifier(node: GoPtr<Node>): bool {
  if (IsIdentifier(node)) {
    const text = Node_Text(node);
    return (text === "eval" || text === "arguments") as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.checkStrictModeEvalOrArguments","kind":"method","status":"implemented","sigHash":"92f86f491754328c7facce392e0ba9dfcb84c3d01c131db6fe6bb13b0c4a86c7","bodyHash":"d20e9d42e956a4dbfab12380c8120d22209a91925dc8ce24578b6bf780e6325a"}
 *
 * Go source:
 * func (b *Binder) checkStrictModeEvalOrArguments(contextNode *ast.Node, name *ast.Node) {
 * 	if name != nil && isEvalOrArgumentsIdentifier(name) {
 * 		// We check first if the name is inside class declaration or class expression; if so give explicit message
 * 		// otherwise report generic error message.
 * 		b.errorOnNode(name, b.getStrictModeEvalOrArgumentsMessage(contextNode), name.Text())
 * 	}
 * }
 */
export function Binder_checkStrictModeEvalOrArguments(receiver: GoPtr<Binder>, contextNode: GoPtr<Node>, name: GoPtr<Node>): void {
  if (name !== undefined && isEvalOrArgumentsIdentifier(name)) {
    Binder_errorOnNode(receiver, name, Binder_getStrictModeEvalOrArgumentsMessage(receiver, contextNode), Node_Text(name));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.getStrictModeEvalOrArgumentsMessage","kind":"method","status":"implemented","sigHash":"501a7b07ff1ab1e02d8a853424c2d95a846fe16aed4951f1c47c64c427cd1fce","bodyHash":"650347a1eba2dd5f41df722cd820085e7ff0bb9257bcd94d120e7702b97155d4"}
 *
 * Go source:
 * func (b *Binder) getStrictModeEvalOrArgumentsMessage(node *ast.Node) *diagnostics.Message {
 * 	// Provide specialized messages to help the user understand why we think they're in strict mode
 * 	if ast.GetContainingClass(node) != nil {
 * 		return diagnostics.Code_contained_in_a_class_is_evaluated_in_JavaScript_s_strict_mode_which_does_not_allow_this_use_of_0_For_more_information_see_https_Colon_Slash_Slashdeveloper_mozilla_org_Slashen_US_Slashdocs_SlashWeb_SlashJavaScript_SlashReference_SlashStrict_mode
 * 	}
 * 	if b.file.ExternalModuleIndicator != nil {
 * 		return diagnostics.Invalid_use_of_0_Modules_are_automatically_in_strict_mode
 * 	}
 * 	return diagnostics.Invalid_use_of_0_in_strict_mode
 * }
 */
export function Binder_getStrictModeEvalOrArgumentsMessage(receiver: GoPtr<Binder>, node: GoPtr<Node>): GoPtr<Message> {
  if (GetContainingClass(node) !== undefined) {
    return Code_contained_in_a_class_is_evaluated_in_JavaScript_s_strict_mode_which_does_not_allow_this_use_of_0_For_more_information_see_https_Colon_Slash_Slashdeveloper_mozilla_org_Slashen_US_Slashdocs_SlashWeb_SlashJavaScript_SlashReference_SlashStrict_mode;
  }
  if (receiver!.file!.ExternalModuleIndicator !== undefined) {
    return Invalid_use_of_0_Modules_are_automatically_in_strict_mode;
  }
  return Invalid_use_of_0_in_strict_mode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindContainer","kind":"method","status":"implemented","sigHash":"42ecaf2eb1d197162b822ee0ea4668ae73e31c55cc8ff99714fe8936b13b171e","bodyHash":"ca7313a63436bf4fbd489e2f0d8d81481435cf763e1080b289b966650ae82fcb"}
 *
 * Go source:
 * func (b *Binder) bindContainer(node *ast.Node, containerFlags ContainerFlags) {
 * 	// Before we recurse into a node's children, we first save the existing parent, container
 * 	// and block-container.  Then after we pop out of processing the children, we restore
 * 	// these saved values.
 * 	saveContainer := b.container
 * 	saveThisContainer := b.thisContainer
 * 	savedBlockScopeContainer := b.blockScopeContainer
 * 	// Depending on what kind of node this is, we may have to adjust the current container
 * 	// and block-container.   If the current node is a container, then it is automatically
 * 	// considered the current block-container as well.  Also, for containers that we know
 * 	// may contain locals, we eagerly initialize the .locals field. We do this because
 * 	// it's highly likely that the .locals will be needed to place some child in (for example,
 * 	// a parameter, or variable declaration).
 * 	//
 * 	// However, we do not proactively create the .locals for block-containers because it's
 * 	// totally normal and common for block-containers to never actually have a block-scoped
 * 	// variable in them.  We don't want to end up allocating an object for every 'block' we
 * 	// run into when most of them won't be necessary.
 * 	//
 * 	// Finally, if this is a block-container, then we clear out any existing .locals object
 * 	// it may contain within it.  This happens in incremental scenarios.  Because we can be
 * 	// reusing a node from a previous compilation, that node may have had 'locals' created
 * 	// for it.  We must clear this so we don't accidentally move any stale data forward from
 * 	// a previous compilation.
 * 	if containerFlags&ContainerFlagsIsContainer != 0 {
 * 		b.container = node
 * 		b.blockScopeContainer = node
 * 		if containerFlags&ContainerFlagsHasLocals != 0 {
 * 			// localsContainer := node
 * 			// localsContainer.LocalsContainerData().locals = make(SymbolTable)
 * 			b.addToContainerChain(node)
 * 		}
 * 	} else if containerFlags&ContainerFlagsIsBlockScopedContainer != 0 {
 * 		b.blockScopeContainer = node
 * 		b.addToContainerChain(node)
 * 	}
 * 	if containerFlags&ContainerFlagsIsThisContainer != 0 {
 * 		b.thisContainer = node
 * 	}
 * 	if containerFlags&ContainerFlagsIsControlFlowContainer != 0 {
 * 		saveCurrentFlow := b.currentFlow
 * 		saveBreakTarget := b.currentBreakTarget
 * 		saveContinueTarget := b.currentContinueTarget
 * 		saveReturnTarget := b.currentReturnTarget
 * 		saveExceptionTarget := b.currentExceptionTarget
 * 		saveActiveLabelList := b.activeLabelList
 * 		saveHasExplicitReturn := b.hasExplicitReturn
 * 		saveSeenThisKeyword := b.seenThisKeyword
 * 		isImmediatelyInvoked := (containerFlags&ContainerFlagsIsFunctionExpression != 0 &&
 * 			!ast.HasSyntacticModifier(node, ast.ModifierFlagsAsync) &&
 * 			!isGeneratorFunctionExpression(node) &&
 * 			ast.GetImmediatelyInvokedFunctionExpression(node) != nil) || node.Kind == ast.KindClassStaticBlockDeclaration
 * 		// A non-async, non-generator IIFE is considered part of the containing control flow. Return statements behave
 * 		// similarly to break statements that exit to a label just past the statement body.
 * 		if !isImmediatelyInvoked {
 * 			flowStart := b.newFlowNode(ast.FlowFlagsStart)
 * 			b.currentFlow = flowStart
 * 			if containerFlags&(ContainerFlagsIsFunctionExpression|ContainerFlagsIsObjectLiteralOrClassExpressionMethodOrAccessor) != 0 {
 * 				flowStart.Node = node
 * 			}
 * 		}
 * 		// We create a return control flow graph for IIFEs and constructors. For constructors
 * 		// we use the return control flow graph in strict property initialization checks.
 * 		if isImmediatelyInvoked || node.Kind == ast.KindConstructor {
 * 			b.currentReturnTarget = b.newFlowNode(ast.FlowFlagsBranchLabel)
 * 		} else {
 * 			b.currentReturnTarget = nil
 * 		}
 * 		b.currentExceptionTarget = nil
 * 		b.currentBreakTarget = nil
 * 		b.currentContinueTarget = nil
 * 		b.activeLabelList = nil
 * 		b.hasExplicitReturn = false
 * 		b.seenThisKeyword = false
 * 		b.bindChildren(node)
 * 		// Reset flags (for incremental scenarios)
 * 		node.Flags &^= ast.NodeFlagsReachabilityAndEmitFlags | ast.NodeFlagsContainsThis
 * 		if b.currentFlow.Flags&ast.FlowFlagsUnreachable == 0 && containerFlags&ContainerFlagsIsFunctionLike != 0 {
 * 			bodyData := node.BodyData()
 * 			if bodyData != nil && ast.NodeIsPresent(bodyData.Body) {
 * 				node.Flags |= ast.NodeFlagsHasImplicitReturn
 * 				if b.hasExplicitReturn {
 * 					node.Flags |= ast.NodeFlagsHasExplicitReturn
 * 				}
 * 				bodyData.EndFlowNode = b.currentFlow
 * 			}
 * 		}
 * 		if b.seenThisKeyword {
 * 			node.Flags |= ast.NodeFlagsContainsThis
 * 		}
 * 		if node.Kind == ast.KindSourceFile {
 * 			node.Flags |= b.emitFlags
 * 			node.AsSourceFile().EndFlowNode = b.currentFlow
 * 		}
 * 		if b.currentReturnTarget != nil {
 * 			b.addAntecedent(b.currentReturnTarget, b.currentFlow)
 * 			b.currentFlow = b.finishFlowLabel(b.currentReturnTarget)
 * 			if node.Kind == ast.KindConstructor || node.Kind == ast.KindClassStaticBlockDeclaration {
 * 				setReturnFlowNode(node, b.currentFlow)
 * 			}
 * 		}
 * 		if !isImmediatelyInvoked {
 * 			b.currentFlow = saveCurrentFlow
 * 		}
 * 		b.currentBreakTarget = saveBreakTarget
 * 		b.currentContinueTarget = saveContinueTarget
 * 		b.currentReturnTarget = saveReturnTarget
 * 		b.currentExceptionTarget = saveExceptionTarget
 * 		b.activeLabelList = saveActiveLabelList
 * 		b.hasExplicitReturn = saveHasExplicitReturn
 * 		if containerFlags&ContainerFlagsPropagatesThisKeyword != 0 {
 * 			b.seenThisKeyword = saveSeenThisKeyword || b.seenThisKeyword
 * 		} else {
 * 			b.seenThisKeyword = saveSeenThisKeyword
 * 		}
 * 	} else if containerFlags&ContainerFlagsIsInterface != 0 {
 * 		saveSeenThisKeyword := b.seenThisKeyword
 * 		b.seenThisKeyword = false
 * 		b.bindChildren(node)
 * 		// ContainsThis cannot overlap with HasExtendedUnicodeEscape on Identifier
 * 		if b.seenThisKeyword {
 * 			node.Flags |= ast.NodeFlagsContainsThis
 * 		} else {
 * 			node.Flags &^= ast.NodeFlagsContainsThis
 * 		}
 * 		b.seenThisKeyword = saveSeenThisKeyword
 * 	} else {
 * 		b.bindChildren(node)
 * 	}
 * 	if ast.IsSourceFile(node) && ast.IsInJSFile(node) {
 * 		// Binding of top-level JSTypeAliasDeclaration nodes is deferred to ensure CommonJS module
 * 		// indicators, if any, are processed first.
 * 		for _, statement := range node.Statements() {
 * 			if ast.IsJSTypeAliasDeclaration(statement) {
 * 				b.bindBlockScopedDeclaration(statement, ast.SymbolFlagsTypeAlias, ast.SymbolFlagsTypeAliasExcludes)
 * 			}
 * 		}
 * 		if b.file.CommonJSModuleIndicator != nil {
 * 			b.declareCommonJSVariable("module")
 * 			b.declareCommonJSVariable("exports")
 * 		}
 * 	}
 * 	if ast.IsSourceFile(node) && ast.IsExternalOrCommonJSModule(node.AsSourceFile()) || ast.IsAmbientModule(node) {
 * 		b.bindCommonJSTypeExports(node.Symbol())
 * 	}
 * 	b.container = saveContainer
 * 	b.thisContainer = saveThisContainer
 * 	b.blockScopeContainer = savedBlockScopeContainer
 * }
 */
export function Binder_bindContainer(receiver: GoPtr<Binder>, node: GoPtr<Node>, containerFlags: ContainerFlags): void {
  const saveContainer = receiver!.container;
  const saveThisContainer = receiver!.thisContainer;
  const savedBlockScopeContainer = receiver!.blockScopeContainer;
  if ((containerFlags & ContainerFlagsIsContainer) !== 0) {
    receiver!.container = node;
    receiver!.blockScopeContainer = node;
    if ((containerFlags & ContainerFlagsHasLocals) !== 0) {
      Binder_addToContainerChain(receiver, node);
    }
  } else if ((containerFlags & ContainerFlagsIsBlockScopedContainer) !== 0) {
    receiver!.blockScopeContainer = node;
    Binder_addToContainerChain(receiver, node);
  }
  if ((containerFlags & ContainerFlagsIsThisContainer) !== 0) {
    receiver!.thisContainer = node;
  }
  if ((containerFlags & ContainerFlagsIsControlFlowContainer) !== 0) {
    const saveCurrentFlow = receiver!.currentFlow;
    const saveBreakTarget = receiver!.currentBreakTarget;
    const saveContinueTarget = receiver!.currentContinueTarget;
    const saveReturnTarget = receiver!.currentReturnTarget;
    const saveExceptionTarget = receiver!.currentExceptionTarget;
    const saveActiveLabelList = receiver!.activeLabelList;
    const saveHasExplicitReturn = receiver!.hasExplicitReturn;
    const saveSeenThisKeyword = receiver!.seenThisKeyword;
    const isImmediatelyInvoked = ((containerFlags & ContainerFlagsIsFunctionExpression) !== 0 &&
      !HasSyntacticModifier(node, ModifierFlagsAsync) &&
      !isGeneratorFunctionExpression(node) &&
      GetImmediatelyInvokedFunctionExpression(node) !== undefined) || node!.Kind === KindClassStaticBlockDeclaration;
    if (!isImmediatelyInvoked) {
      const flowStart = Binder_newFlowNode(receiver, FlowFlagsStart);
      receiver!.currentFlow = flowStart;
      if ((containerFlags & (ContainerFlagsIsFunctionExpression | ContainerFlagsIsObjectLiteralOrClassExpressionMethodOrAccessor)) !== 0) {
        flowStart!.Node = node;
      }
    }
    if (isImmediatelyInvoked || node!.Kind === KindConstructor) {
      receiver!.currentReturnTarget = Binder_newFlowNode(receiver, FlowFlagsBranchLabel);
    } else {
      receiver!.currentReturnTarget = undefined;
    }
    receiver!.currentExceptionTarget = undefined;
    receiver!.currentBreakTarget = undefined;
    receiver!.currentContinueTarget = undefined;
    receiver!.activeLabelList = undefined;
    receiver!.hasExplicitReturn = false;
    receiver!.seenThisKeyword = false;
    Binder_bindChildren(receiver, node);
    node!.Flags = (node!.Flags & ~(NodeFlagsReachabilityAndEmitFlags | NodeFlagsContainsThis)) as NodeFlags;
    if ((receiver!.currentFlow!.Flags & FlowFlagsUnreachable) === 0 && (containerFlags & ContainerFlagsIsFunctionLike) !== 0) {
      const bodyData = Node_BodyData(node);
      if (bodyData !== undefined && NodeIsPresent((bodyData as unknown as { Body?: GoPtr<Node> }).Body)) {
        node!.Flags = (node!.Flags | NodeFlagsHasImplicitReturn) as NodeFlags;
        if (receiver!.hasExplicitReturn) {
          node!.Flags = (node!.Flags | NodeFlagsHasExplicitReturn) as NodeFlags;
        }
        (bodyData as unknown as { EndFlowNode?: GoPtr<FlowNode> }).EndFlowNode = receiver!.currentFlow;
      }
    }
    if (receiver!.seenThisKeyword) {
      node!.Flags = (node!.Flags | NodeFlagsContainsThis) as NodeFlags;
    }
    if (node!.Kind === KindSourceFile) {
      node!.Flags = (node!.Flags | receiver!.emitFlags) as NodeFlags;
      receiver!.file!.EndFlowNode = receiver!.currentFlow;
    }
    if (receiver!.currentReturnTarget !== undefined) {
      Binder_addAntecedent(receiver, receiver!.currentReturnTarget, receiver!.currentFlow!);
      receiver!.currentFlow = Binder_finishFlowLabel(receiver, receiver!.currentReturnTarget);
      if (node!.Kind === KindConstructor || node!.Kind === KindClassStaticBlockDeclaration) {
        setReturnFlowNode(node, receiver!.currentFlow);
      }
    }
    if (!isImmediatelyInvoked) {
      receiver!.currentFlow = saveCurrentFlow;
    }
    receiver!.currentBreakTarget = saveBreakTarget;
    receiver!.currentContinueTarget = saveContinueTarget;
    receiver!.currentReturnTarget = saveReturnTarget;
    receiver!.currentExceptionTarget = saveExceptionTarget;
    receiver!.activeLabelList = saveActiveLabelList;
    receiver!.hasExplicitReturn = saveHasExplicitReturn;
    if ((containerFlags & ContainerFlagsPropagatesThisKeyword) !== 0) {
      receiver!.seenThisKeyword = saveSeenThisKeyword || receiver!.seenThisKeyword;
    } else {
      receiver!.seenThisKeyword = saveSeenThisKeyword;
    }
  } else if ((containerFlags & ContainerFlagsIsInterface) !== 0) {
    const saveSeenThisKeyword2 = receiver!.seenThisKeyword;
    receiver!.seenThisKeyword = false;
    Binder_bindChildren(receiver, node);
    if (receiver!.seenThisKeyword) {
      node!.Flags = (node!.Flags | NodeFlagsContainsThis) as NodeFlags;
    } else {
      node!.Flags = (node!.Flags & ~NodeFlagsContainsThis) as NodeFlags;
    }
    receiver!.seenThisKeyword = saveSeenThisKeyword2;
  } else {
    Binder_bindChildren(receiver, node);
  }
  if (IsSourceFile(node) && IsInJSFile(node)) {
    for (const statement of (Node_Statements(node) ?? [])) {
      if (IsJSTypeAliasDeclaration(statement)) {
        Binder_bindBlockScopedDeclaration(receiver, statement, SymbolFlagsTypeAlias, SymbolFlagsTypeAliasExcludes);
      }
    }
    if (receiver!.file!.CommonJSModuleIndicator !== undefined) {
      Binder_declareCommonJSVariable(receiver, "module");
      Binder_declareCommonJSVariable(receiver, "exports");
    }
  }
  if ((IsSourceFile(node) && IsExternalOrCommonJSModule(AsSourceFile(node))) || IsAmbientModule(node)) {
    Binder_bindCommonJSTypeExports(receiver, Node_Symbol(node));
  }
  receiver!.container = saveContainer;
  receiver!.thisContainer = saveThisContainer;
  receiver!.blockScopeContainer = savedBlockScopeContainer;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.declareCommonJSVariable","kind":"method","status":"implemented","sigHash":"6a08bda19c57e9fb64ef6cd2c5bfd00e4ef40a7ac876bb6395a7191cd03d6236","bodyHash":"4a350d295c96ec844b7fe1eaa93082342e4d8f94830ae16e844501c9bf9e1403"}
 *
 * Go source:
 * func (b *Binder) declareCommonJSVariable(name string) {
 * 	locals := ast.GetLocals(b.file.AsNode())
 * 	if locals[name] == nil {
 * 		symbol := b.newSymbol(ast.SymbolFlagsFunctionScopedVariable|ast.SymbolFlagsModuleExports, name)
 * 		symbol.Declarations = b.newSingleDeclaration(b.file.AsNode())
 * 		symbol.ValueDeclaration = symbol.Declarations[0]
 * 		if name == "module" {
 * 			exportsProperty := b.newSymbol(ast.SymbolFlagsModuleExports|ast.SymbolFlagsProperty, "exports")
 * 			exportsProperty.Declarations = symbol.Declarations
 * 			exportsProperty.ValueDeclaration = symbol.ValueDeclaration
 * 			exportsProperty.Parent = symbol
 * 			symbol.Members = make(ast.SymbolTable, 1)
 * 			symbol.Members["exports"] = exportsProperty
 * 		}
 * 		locals[name] = symbol
 * 	}
 * }
 */
export function Binder_declareCommonJSVariable(receiver: GoPtr<Binder>, name: string): void {
  const fileNode = receiver!.file as unknown as GoPtr<Node>;
  const locals = GetLocals(fileNode);
  if (locals !== undefined && locals.get(name) === undefined) {
    const symbol = Binder_newSymbol(receiver, (SymbolFlagsFunctionScopedVariable | SymbolFlagsModuleExports) as SymbolFlags, name);
    symbol!.Declarations = Binder_newSingleDeclaration(receiver, fileNode);
    symbol!.ValueDeclaration = symbol!.Declarations![0];
    if (name === "module") {
      const exportsProperty = Binder_newSymbol(receiver, (SymbolFlagsModuleExports | SymbolFlagsProperty) as SymbolFlags, "exports");
      exportsProperty!.Declarations = symbol!.Declarations;
      exportsProperty!.ValueDeclaration = symbol!.ValueDeclaration;
      exportsProperty!.Parent = symbol;
      symbol!.Members = new globalThis.Map<string, GoPtr<Symbol>>();
      symbol!.Members.set("exports", exportsProperty);
    }
    locals.set(name, symbol);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindChildren","kind":"method","status":"implemented","sigHash":"fc387c97e3ac89c4e8c8c504252178cdced871f0f3cd497324abfcfa06670bee","bodyHash":"b0c6d7e50b2e65a823d6983a845738fca4fd4a19643cf774e8479fa87edb5a73"}
 *
 * Go source:
 * func (b *Binder) bindChildren(node *ast.Node) {
 * 	saveInAssignmentPattern := b.inAssignmentPattern
 * 	// Most nodes aren't valid in an assignment pattern, so we clear the value here
 * 	// and set it before we descend into nodes that could actually be part of an assignment pattern.
 * 	b.inAssignmentPattern = false
 * 
 * 	if b.currentFlow == b.unreachableFlow {
 * 		if flowNodeData := node.FlowNodeData(); flowNodeData != nil {
 * 			flowNodeData.FlowNode = nil
 * 		}
 * 		if ast.IsPotentiallyExecutableNode(node) {
 * 			node.Flags |= ast.NodeFlagsUnreachable
 * 		}
 * 		b.bindEachChild(node)
 * 		b.inAssignmentPattern = saveInAssignmentPattern
 * 		return
 * 	}
 * 
 * 	if ast.KindFirstStatement <= node.Kind && node.Kind <= ast.KindLastStatement {
 * 		if flowNodeData := node.FlowNodeData(); flowNodeData != nil {
 * 			flowNodeData.FlowNode = b.currentFlow
 * 		}
 * 	}
 * 
 * 	switch node.Kind {
 * 	case ast.KindWhileStatement:
 * 		b.bindWhileStatement(node)
 * 	case ast.KindDoStatement:
 * 		b.bindDoStatement(node)
 * 	case ast.KindForStatement:
 * 		b.bindForStatement(node)
 * 	case ast.KindForInStatement, ast.KindForOfStatement:
 * 		b.bindForInOrForOfStatement(node)
 * 	case ast.KindIfStatement:
 * 		b.bindIfStatement(node)
 * 	case ast.KindReturnStatement:
 * 		b.bindReturnStatement(node)
 * 	case ast.KindThrowStatement:
 * 		b.bindThrowStatement(node)
 * 	case ast.KindBreakStatement:
 * 		b.bindBreakStatement(node)
 * 	case ast.KindContinueStatement:
 * 		b.bindContinueStatement(node)
 * 	case ast.KindTryStatement:
 * 		b.bindTryStatement(node)
 * 	case ast.KindSwitchStatement:
 * 		b.bindSwitchStatement(node)
 * 	case ast.KindCaseBlock:
 * 		b.bindCaseBlock(node)
 * 	case ast.KindCaseClause, ast.KindDefaultClause:
 * 		b.bindCaseOrDefaultClause(node)
 * 	case ast.KindExpressionStatement:
 * 		b.bindExpressionStatement(node)
 * 	case ast.KindLabeledStatement:
 * 		b.bindLabeledStatement(node)
 * 	case ast.KindPrefixUnaryExpression:
 * 		b.bindPrefixUnaryExpressionFlow(node)
 * 	case ast.KindPostfixUnaryExpression:
 * 		b.bindPostfixUnaryExpressionFlow(node)
 * 	case ast.KindBinaryExpression:
 * 		if ast.IsDestructuringAssignment(node) {
 * 			// Carry over whether we are in an assignment pattern to
 * 			// binary expressions that could actually be an initializer
 * 			b.inAssignmentPattern = saveInAssignmentPattern
 * 			b.bindDestructuringAssignmentFlow(node)
 * 			return
 * 		}
 * 		b.bindBinaryExpressionFlow(node)
 * 	case ast.KindDeleteExpression:
 * 		b.bindDeleteExpressionFlow(node)
 * 	case ast.KindConditionalExpression:
 * 		b.bindConditionalExpressionFlow(node)
 * 	case ast.KindVariableDeclaration:
 * 		b.bindVariableDeclarationFlow(node)
 * 	case ast.KindPropertyAccessExpression, ast.KindElementAccessExpression:
 * 		b.bindAccessExpressionFlow(node)
 * 	case ast.KindCallExpression:
 * 		b.bindCallExpressionFlow(node)
 * 	case ast.KindNonNullExpression:
 * 		b.bindNonNullExpressionFlow(node)
 * 	case ast.KindSourceFile:
 * 		sourceFile := node.AsSourceFile()
 * 		b.bindEachStatementFunctionsFirst(sourceFile.Statements)
 * 		b.bind(sourceFile.EndOfFileToken)
 * 	case ast.KindBlock, ast.KindModuleBlock:
 * 		b.bindEachStatementFunctionsFirst(node.StatementList())
 * 	case ast.KindBindingElement:
 * 		b.bindBindingElementFlow(node)
 * 	case ast.KindParameter:
 * 		b.bindParameterFlow(node)
 * 	case ast.KindObjectLiteralExpression, ast.KindArrayLiteralExpression, ast.KindPropertyAssignment, ast.KindSpreadElement:
 * 		b.inAssignmentPattern = saveInAssignmentPattern
 * 		b.bindEachChild(node)
 * 	default:
 * 		b.bindEachChild(node)
 * 	}
 * 	b.inAssignmentPattern = saveInAssignmentPattern
 * }
 */
export function Binder_bindChildren(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const saveInAssignmentPattern = receiver!.inAssignmentPattern;
  receiver!.inAssignmentPattern = false;
  if (receiver!.currentFlow === receiver!.unreachableFlow) {
    const flowNodeData = Node_FlowNodeData(node);
    if (flowNodeData !== undefined) {
      (flowNodeData as unknown as { FlowNode?: GoPtr<FlowNode> }).FlowNode = undefined;
    }
    if (IsPotentiallyExecutableNode(node)) {
      node!.Flags = (node!.Flags | NodeFlagsUnreachable) as NodeFlags;
    }
    Binder_bindEachChild(receiver, node);
    receiver!.inAssignmentPattern = saveInAssignmentPattern;
    return;
  }
  if (node!.Kind >= KindFirstStatement && node!.Kind <= KindLastStatement) {
    const flowNodeData = Node_FlowNodeData(node);
    if (flowNodeData !== undefined) {
      (flowNodeData as unknown as { FlowNode?: GoPtr<FlowNode> }).FlowNode = receiver!.currentFlow;
    }
  }
  switch (node!.Kind) {
    case KindWhileStatement:
      Binder_bindWhileStatement(receiver, node);
      break;
    case KindDoStatement:
      Binder_bindDoStatement(receiver, node);
      break;
    case KindForStatement:
      Binder_bindForStatement(receiver, node);
      break;
    case KindForInStatement:
    case KindForOfStatement:
      Binder_bindForInOrForOfStatement(receiver, node);
      break;
    case KindIfStatement:
      Binder_bindIfStatement(receiver, node);
      break;
    case KindReturnStatement:
      Binder_bindReturnStatement(receiver, node);
      break;
    case KindThrowStatement:
      Binder_bindThrowStatement(receiver, node);
      break;
    case KindBreakStatement:
      Binder_bindBreakStatement(receiver, node);
      break;
    case KindContinueStatement:
      Binder_bindContinueStatement(receiver, node);
      break;
    case KindTryStatement:
      Binder_bindTryStatement(receiver, node);
      break;
    case KindSwitchStatement:
      Binder_bindSwitchStatement(receiver, node);
      break;
    case KindCaseBlock:
      Binder_bindCaseBlock(receiver, node);
      break;
    case KindCaseClause:
    case KindDefaultClause:
      Binder_bindCaseOrDefaultClause(receiver, node);
      break;
    case KindExpressionStatement:
      Binder_bindExpressionStatement(receiver, node);
      break;
    case KindLabeledStatement:
      Binder_bindLabeledStatement(receiver, node);
      break;
    case KindPrefixUnaryExpression:
      Binder_bindPrefixUnaryExpressionFlow(receiver, node);
      break;
    case KindPostfixUnaryExpression:
      Binder_bindPostfixUnaryExpressionFlow(receiver, node);
      break;
    case KindBinaryExpression:
      if (IsDestructuringAssignment(node)) {
        receiver!.inAssignmentPattern = saveInAssignmentPattern;
        Binder_bindDestructuringAssignmentFlow(receiver, node);
        return;
      }
      Binder_bindBinaryExpressionFlow(receiver, node);
      break;
    case KindDeleteExpression:
      Binder_bindDeleteExpressionFlow(receiver, node);
      break;
    case KindConditionalExpression:
      Binder_bindConditionalExpressionFlow(receiver, node);
      break;
    case KindVariableDeclaration:
      Binder_bindVariableDeclarationFlow(receiver, node);
      break;
    case KindPropertyAccessExpression:
    case KindElementAccessExpression:
      Binder_bindAccessExpressionFlow(receiver, node);
      break;
    case KindCallExpression:
      Binder_bindCallExpressionFlow(receiver, node);
      break;
    case KindNonNullExpression:
      Binder_bindNonNullExpressionFlow(receiver, node);
      break;
    case KindSourceFile: {
      const sourceFile = AsSourceFile(node);
      Binder_bindEachStatementFunctionsFirst(receiver, sourceFile!.Statements);
      Binder_bind(receiver, sourceFile!.EndOfFileToken as unknown as GoPtr<Node>);
      break;
    }
    case KindBlock:
    case KindModuleBlock:
      Binder_bindEachStatementFunctionsFirst(receiver, Node_StatementList(node)!);
      break;
    case KindBindingElement:
      Binder_bindBindingElementFlow(receiver, node);
      break;
    case KindParameter:
      Binder_bindParameterFlow(receiver, node);
      break;
    case KindObjectLiteralExpression:
    case KindArrayLiteralExpression:
    case KindPropertyAssignment:
    case KindSpreadElement:
      receiver!.inAssignmentPattern = saveInAssignmentPattern;
      Binder_bindEachChild(receiver, node);
      break;
    default:
      Binder_bindEachChild(receiver, node);
      break;
  }
  receiver!.inAssignmentPattern = saveInAssignmentPattern;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindEachChild","kind":"method","status":"implemented","sigHash":"a123f56e66981e86ed553606cfb081b16facd13ce06ff10bb2f578f798cb91c9","bodyHash":"3569751eb819bbfdf0edc7ca9da2c0576423633471890dd7b9a7c076c22c9b74"}
 *
 * Go source:
 * func (b *Binder) bindEachChild(node *ast.Node) {
 * 	node.ForEachChild(b.bindFunc)
 * }
 */
export function Binder_bindEachChild(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  Node_ForEachChild(node, receiver!.bindFunc);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindEach","kind":"method","status":"implemented","sigHash":"0122ba175fe62045dcf33fadfcce9eac2bff0bbe52cf4be3a68a6db76475b2d5","bodyHash":"0a36aebec003fa04adc1efeea72299c46a80b9c6f45f66440b7185477525bf03"}
 *
 * Go source:
 * func (b *Binder) bindEach(nodes []*ast.Node) {
 * 	for _, node := range nodes {
 * 		b.bind(node)
 * 	}
 * }
 */
export function Binder_bindEach(receiver: GoPtr<Binder>, nodes: GoSlice<GoPtr<Node>>): void {
  for (const node of nodes) {
    Binder_bind(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindNodeList","kind":"method","status":"implemented","sigHash":"466eec6f39c2219759e3d2eb80f769f8674d3cfa0643e7396fcfb51db5e3d679","bodyHash":"e1f1834b06759e01fc2cff20ff24d5247b87446b01d181f06bc491986cbdb99a"}
 *
 * Go source:
 * func (b *Binder) bindNodeList(nodeList *ast.NodeList) {
 * 	if nodeList != nil {
 * 		b.bindEach(nodeList.Nodes)
 * 	}
 * }
 */
export function Binder_bindNodeList(receiver: GoPtr<Binder>, nodeList: GoPtr<NodeList>): void {
  if (nodeList !== undefined) {
    Binder_bindEach(receiver, nodeList!.Nodes);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindModifiers","kind":"method","status":"implemented","sigHash":"9f2a9ed6f0c513568be882098e6af525514922e6eae5f2029ff219fdfcf866ec","bodyHash":"6b05f28a7df269f29b735ba6a4106cf090efcc144f92fc1b72244455fa4232f8"}
 *
 * Go source:
 * func (b *Binder) bindModifiers(modifiers *ast.ModifierList) {
 * 	if modifiers != nil {
 * 		b.bindEach(modifiers.Nodes)
 * 	}
 * }
 */
export function Binder_bindModifiers(receiver: GoPtr<Binder>, modifiers: GoPtr<ModifierList>): void {
  if (modifiers !== undefined) {
    Binder_bindEach(receiver, modifiers!.Nodes);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindEachStatementFunctionsFirst","kind":"method","status":"implemented","sigHash":"6d702d8fbb5f942dcd709f099ec3314bb44d5a25cc4957e78ee489d7bed8a571","bodyHash":"d69ad7d6ac14145fc68138db6b9733220eeb81f405a3f868b69d7e1f45f141b2"}
 *
 * Go source:
 * func (b *Binder) bindEachStatementFunctionsFirst(statements *ast.NodeList) {
 * 	for _, node := range statements.Nodes {
 * 		if node.Kind == ast.KindFunctionDeclaration {
 * 			b.bind(node)
 * 		}
 * 	}
 * 	for _, node := range statements.Nodes {
 * 		if node.Kind != ast.KindFunctionDeclaration {
 * 			b.bind(node)
 * 		}
 * 	}
 * }
 */
export function Binder_bindEachStatementFunctionsFirst(receiver: GoPtr<Binder>, statements: GoPtr<NodeList>): void {
  for (const node of statements!.Nodes) {
    if (node!.Kind === KindFunctionDeclaration) {
      Binder_bind(receiver, node);
    }
  }
  for (const node of statements!.Nodes) {
    if (node!.Kind !== KindFunctionDeclaration) {
      Binder_bind(receiver, node);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.setContinueTarget","kind":"method","status":"implemented","sigHash":"624baf835ee8ffe048fc19a75634871e5964a7e6c5fc1fd62f28d7ebd4ba5715","bodyHash":"ff8570fc6edc4fae2e5dbeb5908ea2d7f33028310297f362192a63869e229a64"}
 *
 * Go source:
 * func (b *Binder) setContinueTarget(node *ast.Node, target *ast.FlowLabel) *ast.FlowLabel {
 * 	label := b.activeLabelList
 * 	for label != nil && node.Parent.Kind == ast.KindLabeledStatement {
 * 		label.continueTarget = target
 * 		label = label.next
 * 		node = node.Parent
 * 	}
 * 	return target
 * }
 */
export function Binder_setContinueTarget(receiver: GoPtr<Binder>, node: GoPtr<Node>, target: GoPtr<FlowLabel>): GoPtr<FlowLabel> {
  let label = receiver!.activeLabelList;
  let current = node;
  while (label !== undefined && current!.Parent!.Kind === KindLabeledStatement) {
    label!.continueTarget = target;
    label = label!.next;
    current = current!.Parent;
  }
  return target;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.doWithConditionalBranches","kind":"method","status":"implemented","sigHash":"31d911425ee9bfc4b29af60eb25b273bec1869bf912d5e7ea30c3aa7dd3a6ac8","bodyHash":"a6f55195da7d39d7626ffbd1e6691dbbb4d282dab84b1d0ba0ed14666643db8e"}
 *
 * Go source:
 * func (b *Binder) doWithConditionalBranches(action func(b *Binder, value *ast.Node) bool, value *ast.Node, trueTarget *ast.FlowLabel, falseTarget *ast.FlowLabel) {
 * 	savedTrueTarget := b.currentTrueTarget
 * 	savedFalseTarget := b.currentFalseTarget
 * 	b.currentTrueTarget = trueTarget
 * 	b.currentFalseTarget = falseTarget
 * 	action(b, value)
 * 	b.currentTrueTarget = savedTrueTarget
 * 	b.currentFalseTarget = savedFalseTarget
 * }
 */
export function Binder_doWithConditionalBranches(receiver: GoPtr<Binder>, action: (b: GoPtr<Binder>, value: GoPtr<Node>) => bool, value: GoPtr<Node>, trueTarget: GoPtr<FlowLabel>, falseTarget: GoPtr<FlowLabel>): void {
  const savedTrueTarget = receiver!.currentTrueTarget;
  const savedFalseTarget = receiver!.currentFalseTarget;
  receiver!.currentTrueTarget = trueTarget;
  receiver!.currentFalseTarget = falseTarget;
  action(receiver, value);
  receiver!.currentTrueTarget = savedTrueTarget;
  receiver!.currentFalseTarget = savedFalseTarget;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindCondition","kind":"method","status":"implemented","sigHash":"3f6141e16a33ad543f7d1332ca8ec1803f0197768f3f91ede31af57bc01b72cd","bodyHash":"c201abbe5977bcc1ff22f645f6ab5fb7353f98217db36cda9bbf8836d87b6c9c"}
 *
 * Go source:
 * func (b *Binder) bindCondition(node *ast.Node, trueTarget *ast.FlowLabel, falseTarget *ast.FlowLabel) {
 * 	b.doWithConditionalBranches((*Binder).bind, node, trueTarget, falseTarget)
 * 	if node == nil || !isLogicalAssignmentExpression(node) && !ast.IsLogicalExpression(node) && !(ast.IsOptionalChain(node) && ast.IsOutermostOptionalChain(node)) {
 * 		b.addAntecedent(trueTarget, b.createFlowCondition(ast.FlowFlagsTrueCondition, b.currentFlow, node))
 * 		b.addAntecedent(falseTarget, b.createFlowCondition(ast.FlowFlagsFalseCondition, b.currentFlow, node))
 * 	}
 * }
 */
export function Binder_bindCondition(receiver: GoPtr<Binder>, node: GoPtr<Node>, trueTarget: GoPtr<FlowLabel>, falseTarget: GoPtr<FlowLabel>): void {
  Binder_doWithConditionalBranches(receiver, Binder_bind, node, trueTarget, falseTarget);
  if (node === undefined || !isLogicalAssignmentExpression(node) && !IsLogicalExpression(node) && !(IsOptionalChain(node) && IsOutermostOptionalChain(node))) {
    Binder_addAntecedent(receiver, trueTarget, Binder_createFlowCondition(receiver, FlowFlagsTrueCondition, receiver!.currentFlow!, node));
    Binder_addAntecedent(receiver, falseTarget, Binder_createFlowCondition(receiver, FlowFlagsFalseCondition, receiver!.currentFlow!, node));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindIterativeStatement","kind":"method","status":"implemented","sigHash":"418cc2edce680f154b478d75d37211ea9a4a27d712e55f582d0b310ada02682f","bodyHash":"7324c1d5277b50f2254187474bf52b12f502109d18406e52a7772963a7bbf3a0"}
 *
 * Go source:
 * func (b *Binder) bindIterativeStatement(node *ast.Node, breakTarget *ast.FlowLabel, continueTarget *ast.FlowLabel) {
 * 	saveBreakTarget := b.currentBreakTarget
 * 	saveContinueTarget := b.currentContinueTarget
 * 	b.currentBreakTarget = breakTarget
 * 	b.currentContinueTarget = continueTarget
 * 	b.bind(node)
 * 	b.currentBreakTarget = saveBreakTarget
 * 	b.currentContinueTarget = saveContinueTarget
 * }
 */
export function Binder_bindIterativeStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>, breakTarget: GoPtr<FlowLabel>, continueTarget: GoPtr<FlowLabel>): void {
  const saveBreakTarget = receiver!.currentBreakTarget;
  const saveContinueTarget = receiver!.currentContinueTarget;
  receiver!.currentBreakTarget = breakTarget;
  receiver!.currentContinueTarget = continueTarget;
  Binder_bind(receiver, node);
  receiver!.currentBreakTarget = saveBreakTarget;
  receiver!.currentContinueTarget = saveContinueTarget;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isLogicalAssignmentExpression","kind":"func","status":"implemented","sigHash":"d7586143c002c9c7891a97fb63ade48bb2428ac851993baf2c2c01fe29c05d42","bodyHash":"0b674d603d0eaef94d9fc0c5ea9215ae784e25db79115036efb472380ace4aeb"}
 *
 * Go source:
 * func isLogicalAssignmentExpression(node *ast.Node) bool {
 * 	return ast.IsLogicalOrCoalescingAssignmentExpression(ast.SkipParentheses(node))
 * }
 */
export function isLogicalAssignmentExpression(node: GoPtr<Node>): bool {
  return IsLogicalOrCoalescingAssignmentExpression(SkipParentheses(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindAssignmentTargetFlow","kind":"method","status":"implemented","sigHash":"cd04e9339a297300b8e9bdf1b75edb64c6059f7d1282f6253889f2e1e3cae78a","bodyHash":"e31711c255ca0c26f6d4bd511c1883c0b9d5d5de87405bcf2c92f6dc6133ee6e"}
 *
 * Go source:
 * func (b *Binder) bindAssignmentTargetFlow(node *ast.Node) {
 * 	switch node.Kind {
 * 	case ast.KindArrayLiteralExpression:
 * 		for _, e := range node.Elements() {
 * 			if e.Kind == ast.KindSpreadElement {
 * 				b.bindAssignmentTargetFlow(e.Expression())
 * 			} else {
 * 				b.bindDestructuringTargetFlow(e)
 * 			}
 * 		}
 * 	case ast.KindObjectLiteralExpression:
 * 		for _, p := range node.Properties() {
 * 			switch p.Kind {
 * 			case ast.KindPropertyAssignment:
 * 				b.bindDestructuringTargetFlow(p.Initializer())
 * 			case ast.KindShorthandPropertyAssignment:
 * 				b.bindAssignmentTargetFlow(p.AsShorthandPropertyAssignment().Name())
 * 			case ast.KindSpreadAssignment:
 * 				b.bindAssignmentTargetFlow(p.Expression())
 * 			}
 * 		}
 * 	default:
 * 		if isNarrowableReference(node) {
 * 			b.currentFlow = b.createFlowMutation(ast.FlowFlagsAssignment, b.currentFlow, node)
 * 		}
 * 	}
 * }
 */
export function Binder_bindAssignmentTargetFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  switch (node!.Kind) {
    case KindArrayLiteralExpression:
      for (const e of Node_Elements(node)!) {
        if (e!.Kind === KindSpreadElement) {
          Binder_bindAssignmentTargetFlow(receiver, Node_Expression(e)!);
        } else {
          Binder_bindDestructuringTargetFlow(receiver, e);
        }
      }
      break;
    case KindObjectLiteralExpression:
      for (const p of Node_Properties(node)!) {
        switch (p!.Kind) {
          case KindPropertyAssignment:
            Binder_bindDestructuringTargetFlow(receiver, Node_Initializer(p)!);
            break;
          case KindShorthandPropertyAssignment:
            Binder_bindAssignmentTargetFlow(receiver, AsShorthandPropertyAssignment(p)!.name as unknown as GoPtr<Node>);
            break;
          case KindSpreadAssignment:
            Binder_bindAssignmentTargetFlow(receiver, Node_Expression(p)!);
            break;
        }
      }
      break;
    default:
      if (isNarrowableReference(node)) {
        receiver!.currentFlow = Binder_createFlowMutation(receiver, FlowFlagsAssignment, receiver!.currentFlow!, node);
      }
      break;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindDestructuringTargetFlow","kind":"method","status":"implemented","sigHash":"f77b38ede7df1b0f82e18cb7340d12e57564027b0fe684638631c02b220cc8cb","bodyHash":"359c259269e4da6bdea0c44908c2498d782d1eeb88268f0301b76cbf62553896"}
 *
 * Go source:
 * func (b *Binder) bindDestructuringTargetFlow(node *ast.Node) {
 * 	if ast.IsBinaryExpression(node) && node.AsBinaryExpression().OperatorToken.Kind == ast.KindEqualsToken {
 * 		b.bindAssignmentTargetFlow(node.AsBinaryExpression().Left)
 * 	} else {
 * 		b.bindAssignmentTargetFlow(node)
 * 	}
 * }
 */
export function Binder_bindDestructuringTargetFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (IsBinaryExpression(node) && AsBinaryExpression(node)!.OperatorToken!.Kind === KindEqualsToken) {
    Binder_bindAssignmentTargetFlow(receiver, AsBinaryExpression(node)!.Left);
  } else {
    Binder_bindAssignmentTargetFlow(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindWhileStatement","kind":"method","status":"implemented","sigHash":"86e1da471e277a1ff8bc44bda271ff94e31ae974c90934e80e74b759cb8479a6","bodyHash":"1026265c60b75a8a2f23aaec0f47eec488380700a7528f130d6e2309b891cc89"}
 *
 * Go source:
 * func (b *Binder) bindWhileStatement(node *ast.Node) {
 * 	stmt := node.AsWhileStatement()
 * 	preWhileLabel := b.setContinueTarget(node, b.createLoopLabel())
 * 	preBodyLabel := b.createBranchLabel()
 * 	postWhileLabel := b.createBranchLabel()
 * 	b.addAntecedent(preWhileLabel, b.currentFlow)
 * 	b.currentFlow = preWhileLabel
 * 	b.bindCondition(stmt.Expression, preBodyLabel, postWhileLabel)
 * 	b.currentFlow = b.finishFlowLabel(preBodyLabel)
 * 	b.bindIterativeStatement(stmt.Statement, postWhileLabel, preWhileLabel)
 * 	b.addAntecedent(preWhileLabel, b.currentFlow)
 * 	b.currentFlow = b.finishFlowLabel(postWhileLabel)
 * }
 */
export function Binder_bindWhileStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const stmt = AsWhileStatement(node);
  const preWhileLabel = Binder_setContinueTarget(receiver, node, Binder_createLoopLabel(receiver));
  const preBodyLabel = Binder_createBranchLabel(receiver);
  const postWhileLabel = Binder_createBranchLabel(receiver);
  Binder_addAntecedent(receiver, preWhileLabel!, receiver!.currentFlow!);
  receiver!.currentFlow = preWhileLabel;
  Binder_bindCondition(receiver, stmt!.Expression as unknown as GoPtr<Node>, preBodyLabel, postWhileLabel);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, preBodyLabel);
  Binder_bindIterativeStatement(receiver, stmt!.Statement as unknown as GoPtr<Node>, postWhileLabel!, preWhileLabel!);
  Binder_addAntecedent(receiver, preWhileLabel!, receiver!.currentFlow!);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, postWhileLabel);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindDoStatement","kind":"method","status":"implemented","sigHash":"470cbe0f635a9d84652dd8ddf73ec2536391e01b7f7f5ba0c30ac857d533ee94","bodyHash":"fa19dca85ec7a4da4e455dcb106036d6cbba5e44b6c2aa176b0e8ba5921a2d4a"}
 *
 * Go source:
 * func (b *Binder) bindDoStatement(node *ast.Node) {
 * 	stmt := node.AsDoStatement()
 * 	preDoLabel := b.createLoopLabel()
 * 	preConditionLabel := b.setContinueTarget(node, b.createBranchLabel())
 * 	postDoLabel := b.createBranchLabel()
 * 	b.addAntecedent(preDoLabel, b.currentFlow)
 * 	b.currentFlow = preDoLabel
 * 	b.bindIterativeStatement(stmt.Statement, postDoLabel, preConditionLabel)
 * 	b.addAntecedent(preConditionLabel, b.currentFlow)
 * 	b.currentFlow = b.finishFlowLabel(preConditionLabel)
 * 	b.bindCondition(stmt.Expression, preDoLabel, postDoLabel)
 * 	b.currentFlow = b.finishFlowLabel(postDoLabel)
 * }
 */
export function Binder_bindDoStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const stmt = AsDoStatement(node);
  const preDoLabel = Binder_createLoopLabel(receiver);
  const preConditionLabel = Binder_setContinueTarget(receiver, node, Binder_createBranchLabel(receiver));
  const postDoLabel = Binder_createBranchLabel(receiver);
  Binder_addAntecedent(receiver, preDoLabel!, receiver!.currentFlow!);
  receiver!.currentFlow = preDoLabel;
  Binder_bindIterativeStatement(receiver, stmt!.Statement as unknown as GoPtr<Node>, postDoLabel!, preConditionLabel!);
  Binder_addAntecedent(receiver, preConditionLabel!, receiver!.currentFlow!);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, preConditionLabel);
  Binder_bindCondition(receiver, stmt!.Expression as unknown as GoPtr<Node>, preDoLabel, postDoLabel);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, postDoLabel);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindForStatement","kind":"method","status":"implemented","sigHash":"e654f62eadff2b56e2ee11dc56996171a3f1e8fd555dda0468c2ca819cfff382","bodyHash":"55007449816034d164443710d9060c69ec94f3efe56891dacc0d16449b9b81ba"}
 *
 * Go source:
 * func (b *Binder) bindForStatement(node *ast.Node) {
 * 	stmt := node.AsForStatement()
 * 	preLoopLabel := b.setContinueTarget(node, b.createLoopLabel())
 * 	preBodyLabel := b.createBranchLabel()
 * 	preIncrementorLabel := b.createBranchLabel()
 * 	postLoopLabel := b.createBranchLabel()
 * 	b.bind(stmt.Initializer)
 * 	b.addAntecedent(preLoopLabel, b.currentFlow)
 * 	b.currentFlow = preLoopLabel
 * 	b.bindCondition(stmt.Condition, preBodyLabel, postLoopLabel)
 * 	b.currentFlow = b.finishFlowLabel(preBodyLabel)
 * 	b.bindIterativeStatement(stmt.Statement, postLoopLabel, preIncrementorLabel)
 * 	b.addAntecedent(preIncrementorLabel, b.currentFlow)
 * 	b.currentFlow = b.finishFlowLabel(preIncrementorLabel)
 * 	b.bind(stmt.Incrementor)
 * 	b.addAntecedent(preLoopLabel, b.currentFlow)
 * 	b.currentFlow = b.finishFlowLabel(postLoopLabel)
 * }
 */
export function Binder_bindForStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const stmt = AsForStatement(node);
  const preLoopLabel = Binder_setContinueTarget(receiver, node, Binder_createLoopLabel(receiver));
  const preBodyLabel = Binder_createBranchLabel(receiver);
  const preIncrementorLabel = Binder_createBranchLabel(receiver);
  const postLoopLabel = Binder_createBranchLabel(receiver);
  Binder_bind(receiver, stmt!.Initializer as unknown as GoPtr<Node>);
  Binder_addAntecedent(receiver, preLoopLabel!, receiver!.currentFlow!);
  receiver!.currentFlow = preLoopLabel;
  Binder_bindCondition(receiver, stmt!.Condition as unknown as GoPtr<Node>, preBodyLabel, postLoopLabel);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, preBodyLabel);
  Binder_bindIterativeStatement(receiver, stmt!.Statement as unknown as GoPtr<Node>, postLoopLabel!, preIncrementorLabel!);
  Binder_addAntecedent(receiver, preIncrementorLabel!, receiver!.currentFlow!);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, preIncrementorLabel);
  Binder_bind(receiver, stmt!.Incrementor as unknown as GoPtr<Node>);
  Binder_addAntecedent(receiver, preLoopLabel!, receiver!.currentFlow!);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, postLoopLabel);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindForInOrForOfStatement","kind":"method","status":"implemented","sigHash":"a1fc823b0a9a6c44a2fe8b8dbcf4013f4e2dabb61163e61fb51a644433353050","bodyHash":"b43749a6639a7f7a876d7263e2787d6dc2b4c8d24168e5b59d75a04e8afe2e48"}
 *
 * Go source:
 * func (b *Binder) bindForInOrForOfStatement(node *ast.Node) {
 * 	stmt := node.AsForInOrOfStatement()
 * 	preLoopLabel := b.setContinueTarget(node, b.createLoopLabel())
 * 	postLoopLabel := b.createBranchLabel()
 * 	b.bind(stmt.Expression)
 * 	b.addAntecedent(preLoopLabel, b.currentFlow)
 * 	b.currentFlow = preLoopLabel
 * 	if node.Kind == ast.KindForOfStatement {
 * 		b.bind(stmt.AwaitModifier)
 * 	}
 * 	b.addAntecedent(postLoopLabel, b.currentFlow)
 * 	b.bind(stmt.Initializer)
 * 	if stmt.Initializer.Kind != ast.KindVariableDeclarationList {
 * 		b.bindAssignmentTargetFlow(stmt.Initializer)
 * 	}
 * 	b.bindIterativeStatement(stmt.Statement, postLoopLabel, preLoopLabel)
 * 	b.addAntecedent(preLoopLabel, b.currentFlow)
 * 	b.currentFlow = b.finishFlowLabel(postLoopLabel)
 * }
 */
export function Binder_bindForInOrForOfStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const stmt = AsForInOrOfStatement(node);
  const preLoopLabel = Binder_setContinueTarget(receiver, node, Binder_createLoopLabel(receiver));
  const postLoopLabel = Binder_createBranchLabel(receiver);
  Binder_bind(receiver, stmt!.Expression as unknown as GoPtr<Node>);
  Binder_addAntecedent(receiver, preLoopLabel!, receiver!.currentFlow!);
  receiver!.currentFlow = preLoopLabel;
  if (node!.Kind === KindForOfStatement) {
    Binder_bind(receiver, stmt!.AwaitModifier as unknown as GoPtr<Node>);
  }
  Binder_addAntecedent(receiver, postLoopLabel!, receiver!.currentFlow!);
  Binder_bind(receiver, stmt!.Initializer as unknown as GoPtr<Node>);
  if (stmt!.Initializer!.Kind !== KindVariableDeclarationList) {
    Binder_bindAssignmentTargetFlow(receiver, stmt!.Initializer as unknown as GoPtr<Node>);
  }
  Binder_bindIterativeStatement(receiver, stmt!.Statement as unknown as GoPtr<Node>, postLoopLabel!, preLoopLabel!);
  Binder_addAntecedent(receiver, preLoopLabel!, receiver!.currentFlow!);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, postLoopLabel);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindIfStatement","kind":"method","status":"implemented","sigHash":"133a8d292b05766046eec7b2fdbcbe48cc849c61e5e91b2c2edd111bea5cfcf8","bodyHash":"3c4ad35058c0633ea5d70c1cd210dbf91f22136805a7e208d4d8cdd3440b14e2"}
 *
 * Go source:
 * func (b *Binder) bindIfStatement(node *ast.Node) {
 * 	stmt := node.AsIfStatement()
 * 	thenLabel := b.createBranchLabel()
 * 	elseLabel := b.createBranchLabel()
 * 	postIfLabel := b.createBranchLabel()
 * 	b.bindCondition(stmt.Expression, thenLabel, elseLabel)
 * 	b.currentFlow = b.finishFlowLabel(thenLabel)
 * 	b.bind(stmt.ThenStatement)
 * 	b.addAntecedent(postIfLabel, b.currentFlow)
 * 	b.currentFlow = b.finishFlowLabel(elseLabel)
 * 	b.bind(stmt.ElseStatement)
 * 	b.addAntecedent(postIfLabel, b.currentFlow)
 * 	b.currentFlow = b.finishFlowLabel(postIfLabel)
 * }
 */
export function Binder_bindIfStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const stmt = AsIfStatement(node);
  const thenLabel = Binder_createBranchLabel(receiver);
  const elseLabel = Binder_createBranchLabel(receiver);
  const postIfLabel = Binder_createBranchLabel(receiver);
  Binder_bindCondition(receiver, stmt!.Expression as unknown as GoPtr<Node>, thenLabel, elseLabel);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, thenLabel);
  Binder_bind(receiver, stmt!.ThenStatement as unknown as GoPtr<Node>);
  Binder_addAntecedent(receiver, postIfLabel!, receiver!.currentFlow!);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, elseLabel);
  Binder_bind(receiver, stmt!.ElseStatement as unknown as GoPtr<Node>);
  Binder_addAntecedent(receiver, postIfLabel!, receiver!.currentFlow!);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, postIfLabel);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindReturnStatement","kind":"method","status":"implemented","sigHash":"8b14466a98436817c914fd8b21ce839213451caa353b6e459d17c76307b490f8","bodyHash":"0407287a341af2c1ea73a37e785b2aaa6398e0eed596941269416f4936c0552a"}
 *
 * Go source:
 * func (b *Binder) bindReturnStatement(node *ast.Node) {
 * 	b.bind(node.Expression())
 * 	if b.currentReturnTarget != nil {
 * 		b.addAntecedent(b.currentReturnTarget, b.currentFlow)
 * 	}
 * 	b.currentFlow = b.unreachableFlow
 * 	b.hasExplicitReturn = true
 * 	b.hasFlowEffects = true
 * }
 */
export function Binder_bindReturnStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  Binder_bind(receiver, Node_Expression(node));
  if (receiver!.currentReturnTarget !== undefined) {
    Binder_addAntecedent(receiver, receiver!.currentReturnTarget, receiver!.currentFlow!);
  }
  receiver!.currentFlow = receiver!.unreachableFlow;
  receiver!.hasExplicitReturn = true;
  receiver!.hasFlowEffects = true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindThrowStatement","kind":"method","status":"implemented","sigHash":"ae598b2fd33dbe49e5f7faf4faedec799d04f0d107eddab4aba8f7142e01fd7a","bodyHash":"2c6ca1f4a152ff63076bd7ebaec1b640cf9537a1ca70830fc13822652da6c9e5"}
 *
 * Go source:
 * func (b *Binder) bindThrowStatement(node *ast.Node) {
 * 	b.bind(node.Expression())
 * 	b.currentFlow = b.unreachableFlow
 * 	b.hasFlowEffects = true
 * }
 */
export function Binder_bindThrowStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  Binder_bind(receiver, Node_Expression(node));
  receiver!.currentFlow = receiver!.unreachableFlow;
  receiver!.hasFlowEffects = true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindBreakStatement","kind":"method","status":"implemented","sigHash":"2c906f28d5b7252ab4e1784a5561c1b27ba2fb8574f45915d9bbf0ab3003b844","bodyHash":"6834e6f1ec376213a2e7c83ec5eb89ef9c6f814ea7244de4947b3d4974e32af5"}
 *
 * Go source:
 * func (b *Binder) bindBreakStatement(node *ast.Node) {
 * 	b.bindBreakOrContinueStatement(node.Label(), b.currentBreakTarget, (*ActiveLabel).BreakTarget)
 * }
 */
export function Binder_bindBreakStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  Binder_bindBreakOrContinueStatement(receiver, Node_Label(node), receiver!.currentBreakTarget, ActiveLabel_BreakTarget);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindContinueStatement","kind":"method","status":"implemented","sigHash":"4dc5e4d6150673173c1c14614246d4cb50364abe93d7586a99797df2db545361","bodyHash":"cfbbc612a070367ee6b9b55e3326b89e49528af6ecb63faa5732f71cdcc4e1ef"}
 *
 * Go source:
 * func (b *Binder) bindContinueStatement(node *ast.Node) {
 * 	b.bindBreakOrContinueStatement(node.Label(), b.currentContinueTarget, (*ActiveLabel).ContinueTarget)
 * }
 */
export function Binder_bindContinueStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  Binder_bindBreakOrContinueStatement(receiver, Node_Label(node), receiver!.currentContinueTarget, ActiveLabel_ContinueTarget);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindBreakOrContinueStatement","kind":"method","status":"implemented","sigHash":"8e29c0c1efd1033629081dd6fd5e3d3475781f33213bc4dfe663629ba486b2a8","bodyHash":"ceb97ff791be49e924de15b3fa7e44e44fd4999d5a57beee46e4a13e06faae6e"}
 *
 * Go source:
 * func (b *Binder) bindBreakOrContinueStatement(label *ast.Node, currentTarget *ast.FlowNode, getTarget func(*ActiveLabel) *ast.FlowNode) {
 * 	b.bind(label)
 * 	if label != nil {
 * 		activeLabel := b.findActiveLabel(label.Text())
 * 		if activeLabel != nil {
 * 			activeLabel.referenced = true
 * 			b.bindBreakOrContinueFlow(getTarget(activeLabel))
 * 		}
 * 	} else {
 * 		b.bindBreakOrContinueFlow(currentTarget)
 * 	}
 * }
 */
export function Binder_bindBreakOrContinueStatement(receiver: GoPtr<Binder>, label: GoPtr<Node>, currentTarget: GoPtr<FlowNode>, getTarget: (arg0: GoPtr<ActiveLabel>) => GoPtr<FlowNode>): void {
  Binder_bind(receiver, label);
  if (label !== undefined) {
    const activeLabel = Binder_findActiveLabel(receiver, Node_Text(label!));
    if (activeLabel !== undefined) {
      activeLabel!.referenced = true;
      Binder_bindBreakOrContinueFlow(receiver, getTarget(activeLabel) as GoPtr<FlowLabel>);
    }
  } else {
    Binder_bindBreakOrContinueFlow(receiver, currentTarget as GoPtr<FlowLabel>);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.findActiveLabel","kind":"method","status":"implemented","sigHash":"37c376c9787e20c31031ceace543f7b0a5d8b5dc4e86a8d5af17f79458180b88","bodyHash":"a03e76de5f99ee415efdee186b3e0d959cf3e9afefee74d0cb60886f0ece2d23"}
 *
 * Go source:
 * func (b *Binder) findActiveLabel(name string) *ActiveLabel {
 * 	for label := b.activeLabelList; label != nil; label = label.next {
 * 		if label.name == name {
 * 			return label
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Binder_findActiveLabel(receiver: GoPtr<Binder>, name: string): GoPtr<ActiveLabel> {
  let label = receiver!.activeLabelList;
  while (label !== undefined) {
    if (label.name === name) {
      return label;
    }
    label = label.next;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindBreakOrContinueFlow","kind":"method","status":"implemented","sigHash":"f08d23fdbffcf1e7a73b0a24960a513d487f403c855a34450a541a293cacc428","bodyHash":"9899d900b9f542d04b700106132d337e16372c4736586502bf3f14ef63461d08"}
 *
 * Go source:
 * func (b *Binder) bindBreakOrContinueFlow(flowLabel *ast.FlowLabel) {
 * 	if flowLabel != nil {
 * 		b.addAntecedent(flowLabel, b.currentFlow)
 * 		b.currentFlow = b.unreachableFlow
 * 		b.hasFlowEffects = true
 * 	}
 * }
 */
export function Binder_bindBreakOrContinueFlow(receiver: GoPtr<Binder>, flowLabel: GoPtr<FlowLabel>): void {
  if (flowLabel !== undefined) {
    Binder_addAntecedent(receiver, flowLabel, receiver!.currentFlow!);
    receiver!.currentFlow = receiver!.unreachableFlow;
    receiver!.hasFlowEffects = true;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindTryStatement","kind":"method","status":"implemented","sigHash":"88447a4c3035c315dcfea667a117b060e2988d10463a8de6490bd70e44d67f4c","bodyHash":"ec50e3d99d60804cef47ee802a57f6f4cc7aadb850df56a9ac2cb71b1d9152fa"}
 *
 * Go source:
 * func (b *Binder) bindTryStatement(node *ast.Node) {
 * 	// We conservatively assume that *any* code in the try block can cause an exception, but we only need
 * 	// to track code that causes mutations (because only mutations widen the possible control flow type of
 * 	// a variable). The exceptionLabel is the target label for control flows that result from exceptions.
 * 	// We add all mutation flow nodes as antecedents of this label such that we can analyze them as possible
 * 	// antecedents of the start of catch or finally blocks. Furthermore, we add the current control flow to
 * 	// represent exceptions that occur before any mutations.
 * 	stmt := node.AsTryStatement()
 * 	saveReturnTarget := b.currentReturnTarget
 * 	saveExceptionTarget := b.currentExceptionTarget
 * 	normalExitLabel := b.createBranchLabel()
 * 	returnLabel := b.createBranchLabel()
 * 	exceptionLabel := b.createBranchLabel()
 * 	if stmt.FinallyBlock != nil {
 * 		b.currentReturnTarget = returnLabel
 * 	}
 * 	b.addAntecedent(exceptionLabel, b.currentFlow)
 * 	b.currentExceptionTarget = exceptionLabel
 * 	b.bind(stmt.TryBlock)
 * 	b.addAntecedent(normalExitLabel, b.currentFlow)
 * 	if stmt.CatchClause != nil {
 * 		// Start of catch clause is the target of exceptions from try block.
 * 		b.currentFlow = b.finishFlowLabel(exceptionLabel)
 * 		// The currentExceptionTarget now represents control flows from exceptions in the catch clause.
 * 		// Effectively, in a try-catch-finally, if an exception occurs in the try block, the catch block
 * 		// acts like a second try block.
 * 		exceptionLabel = b.createBranchLabel()
 * 		b.addAntecedent(exceptionLabel, b.currentFlow)
 * 		b.currentExceptionTarget = exceptionLabel
 * 		b.bind(stmt.CatchClause)
 * 		b.addAntecedent(normalExitLabel, b.currentFlow)
 * 	}
 * 	b.currentReturnTarget = saveReturnTarget
 * 	b.currentExceptionTarget = saveExceptionTarget
 * 	if stmt.FinallyBlock != nil {
 * 		// Possible ways control can reach the finally block:
 * 		// 1) Normal completion of try block of a try-finally or try-catch-finally
 * 		// 2) Normal completion of catch block (following exception in try block) of a try-catch-finally
 * 		// 3) Return in try or catch block of a try-finally or try-catch-finally
 * 		// 4) Exception in try block of a try-finally
 * 		// 5) Exception in catch block of a try-catch-finally
 * 		// When analyzing a control flow graph that starts inside a finally block we want to consider all
 * 		// five possibilities above. However, when analyzing a control flow graph that starts outside (past)
 * 		// the finally block, we only want to consider the first two (if we're past a finally block then it
 * 		// must have completed normally). Likewise, when analyzing a control flow graph from return statements
 * 		// in try or catch blocks in an IIFE, we only want to consider the third. To make this possible, we
 * 		// inject a ReduceLabel node into the control flow graph. This node contains an alternate reduced
 * 		// set of antecedents for the pre-finally label. As control flow analysis passes by a ReduceLabel
 * 		// node, the pre-finally label is temporarily switched to the reduced antecedent set.
 * 		finallyLabel := b.createBranchLabel()
 * 		finallyLabel.Antecedents = b.combineFlowLists(normalExitLabel.Antecedents, b.combineFlowLists(exceptionLabel.Antecedents, returnLabel.Antecedents))
 * 		b.currentFlow = finallyLabel
 * 		b.bind(stmt.FinallyBlock)
 * 		if b.currentFlow.Flags&ast.FlowFlagsUnreachable != 0 {
 * 			// If the end of the finally block is unreachable, the end of the entire try statement is unreachable.
 * 			b.currentFlow = b.unreachableFlow
 * 		} else {
 * 			// If we have an IIFE return target and return statements in the try or catch blocks, add a control
 * 			// flow that goes back through the finally block and back through only the return statements.
 * 			if b.currentReturnTarget != nil && returnLabel.Antecedents != nil {
 * 				b.addAntecedent(b.currentReturnTarget, b.createReduceLabel(finallyLabel, returnLabel.Antecedents, b.currentFlow))
 * 			}
 * 			// If we have an outer exception target (i.e. a containing try-finally or try-catch-finally), add a
 * 			// control flow that goes back through the finally block and back through each possible exception source.
 * 			if b.currentExceptionTarget != nil && exceptionLabel.Antecedents != nil {
 * 				b.addAntecedent(b.currentExceptionTarget, b.createReduceLabel(finallyLabel, exceptionLabel.Antecedents, b.currentFlow))
 * 			}
 * 			// If the end of the finally block is reachable, but the end of the try and catch blocks are not,
 * 			// convert the current flow to unreachable. For example, 'try { return 1; } finally { ... }' should
 * 			// result in an unreachable current control flow.
 * 			if normalExitLabel.Antecedents != nil {
 * 				b.currentFlow = b.createReduceLabel(finallyLabel, normalExitLabel.Antecedents, b.currentFlow)
 * 			} else {
 * 				b.currentFlow = b.unreachableFlow
 * 			}
 * 		}
 * 	} else {
 * 		b.currentFlow = b.finishFlowLabel(normalExitLabel)
 * 	}
 * }
 */
export function Binder_bindTryStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const stmt = AsTryStatement(node);
  const saveReturnTarget = receiver!.currentReturnTarget;
  const saveExceptionTarget = receiver!.currentExceptionTarget;
  const normalExitLabel = Binder_createBranchLabel(receiver);
  const returnLabel = Binder_createBranchLabel(receiver);
  let exceptionLabel = Binder_createBranchLabel(receiver);
  if (stmt!.FinallyBlock !== undefined) {
    receiver!.currentReturnTarget = returnLabel;
  }
  Binder_addAntecedent(receiver, exceptionLabel!, receiver!.currentFlow!);
  receiver!.currentExceptionTarget = exceptionLabel;
  Binder_bind(receiver, stmt!.TryBlock as unknown as GoPtr<Node>);
  Binder_addAntecedent(receiver, normalExitLabel!, receiver!.currentFlow!);
  if (stmt!.CatchClause !== undefined) {
    receiver!.currentFlow = Binder_finishFlowLabel(receiver, exceptionLabel);
    exceptionLabel = Binder_createBranchLabel(receiver);
    Binder_addAntecedent(receiver, exceptionLabel!, receiver!.currentFlow!);
    receiver!.currentExceptionTarget = exceptionLabel;
    Binder_bind(receiver, stmt!.CatchClause as unknown as GoPtr<Node>);
    Binder_addAntecedent(receiver, normalExitLabel!, receiver!.currentFlow!);
  }
  receiver!.currentReturnTarget = saveReturnTarget;
  receiver!.currentExceptionTarget = saveExceptionTarget;
  if (stmt!.FinallyBlock !== undefined) {
    const finallyLabel = Binder_createBranchLabel(receiver);
    finallyLabel!.Antecedents = Binder_combineFlowLists(receiver, normalExitLabel!.Antecedents, Binder_combineFlowLists(receiver, exceptionLabel!.Antecedents, returnLabel!.Antecedents));
    receiver!.currentFlow = finallyLabel;
    Binder_bind(receiver, stmt!.FinallyBlock as unknown as GoPtr<Node>);
    if ((receiver!.currentFlow!.Flags & FlowFlagsUnreachable) !== 0) {
      receiver!.currentFlow = receiver!.unreachableFlow;
    } else {
      if (receiver!.currentReturnTarget !== undefined && returnLabel!.Antecedents !== undefined) {
        Binder_addAntecedent(receiver, receiver!.currentReturnTarget, Binder_createReduceLabel(receiver, finallyLabel!, returnLabel!.Antecedents, receiver!.currentFlow!)!);
      }
      if (receiver!.currentExceptionTarget !== undefined && exceptionLabel!.Antecedents !== undefined) {
        Binder_addAntecedent(receiver, receiver!.currentExceptionTarget, Binder_createReduceLabel(receiver, finallyLabel!, exceptionLabel!.Antecedents, receiver!.currentFlow!)!);
      }
      if (normalExitLabel!.Antecedents !== undefined) {
        receiver!.currentFlow = Binder_createReduceLabel(receiver, finallyLabel!, normalExitLabel!.Antecedents, receiver!.currentFlow!);
      } else {
        receiver!.currentFlow = receiver!.unreachableFlow;
      }
    }
  } else {
    receiver!.currentFlow = Binder_finishFlowLabel(receiver, normalExitLabel);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindSwitchStatement","kind":"method","status":"implemented","sigHash":"9f72704525b4a04d8118024bc425581db6db08d533cc58dc4ba7dc680c1a04bb","bodyHash":"439cfef217952bcfcf0d2ecf8bd84dbff3aa8e4775a3aa23909e15128bd95994"}
 *
 * Go source:
 * func (b *Binder) bindSwitchStatement(node *ast.Node) {
 * 	stmt := node.AsSwitchStatement()
 * 	postSwitchLabel := b.createBranchLabel()
 * 	b.bind(stmt.Expression)
 * 	saveBreakTarget := b.currentBreakTarget
 * 	savePreSwitchCaseFlow := b.preSwitchCaseFlow
 * 	b.currentBreakTarget = postSwitchLabel
 * 	b.preSwitchCaseFlow = b.currentFlow
 * 	b.bind(stmt.CaseBlock)
 * 	b.addAntecedent(postSwitchLabel, b.currentFlow)
 * 	hasDefault := core.Some(stmt.CaseBlock.AsCaseBlock().Clauses.Nodes, func(c *ast.Node) bool {
 * 		return c.Kind == ast.KindDefaultClause
 * 	})
 * 	if !hasDefault {
 * 		b.addAntecedent(postSwitchLabel, b.createFlowSwitchClause(b.preSwitchCaseFlow, node, 0, 0))
 * 	}
 * 	b.currentBreakTarget = saveBreakTarget
 * 	b.preSwitchCaseFlow = savePreSwitchCaseFlow
 * 	b.currentFlow = b.finishFlowLabel(postSwitchLabel)
 * }
 */
export function Binder_bindSwitchStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const stmt = AsSwitchStatement(node);
  const postSwitchLabel = Binder_createBranchLabel(receiver);
  Binder_bind(receiver, stmt!.Expression as unknown as GoPtr<Node>);
  const saveBreakTarget = receiver!.currentBreakTarget;
  const savePreSwitchCaseFlow = receiver!.preSwitchCaseFlow;
  receiver!.currentBreakTarget = postSwitchLabel;
  receiver!.preSwitchCaseFlow = receiver!.currentFlow;
  Binder_bind(receiver, stmt!.CaseBlock as unknown as GoPtr<Node>);
  Binder_addAntecedent(receiver, postSwitchLabel!, receiver!.currentFlow!);
  const hasDefault = Some(AsCaseBlock(stmt!.CaseBlock as unknown as GoPtr<Node>)!.Clauses!.Nodes, (c) => (c!.Kind === KindDefaultClause) as bool);
  if (!hasDefault) {
    Binder_addAntecedent(receiver, postSwitchLabel!, Binder_createFlowSwitchClause(receiver, receiver!.preSwitchCaseFlow!, node, 0 as int, 0 as int)!);
  }
  receiver!.currentBreakTarget = saveBreakTarget;
  receiver!.preSwitchCaseFlow = savePreSwitchCaseFlow;
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, postSwitchLabel);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindCaseBlock","kind":"method","status":"implemented","sigHash":"7afb55ad7e4593cc7e22e2899b9e7c9df52c147cdd16cb9539764d4bd14c8332","bodyHash":"4c2cced473c94e6b23bc2f51cb35dba47d579dc12e54b3e45ae1008f52e81d9b"}
 *
 * Go source:
 * func (b *Binder) bindCaseBlock(node *ast.Node) {
 * 	switchStatement := node.Parent
 * 	clauses := node.AsCaseBlock().Clauses.Nodes
 * 	isNarrowingSwitch := switchStatement.Expression().Kind == ast.KindTrueKeyword || isNarrowingExpression(switchStatement.Expression())
 * 	var fallthroughFlow *ast.FlowNode = b.unreachableFlow
 * 	for i := 0; i < len(clauses); i++ {
 * 		clauseStart := i
 * 		for len(clauses[i].Statements()) == 0 && i+1 < len(clauses) {
 * 			if fallthroughFlow == b.unreachableFlow {
 * 				b.currentFlow = b.preSwitchCaseFlow
 * 			}
 * 			b.bind(clauses[i])
 * 			i++
 * 		}
 * 		preCaseLabel := b.createBranchLabel()
 * 		preCaseFlow := b.preSwitchCaseFlow
 * 		if isNarrowingSwitch {
 * 			preCaseFlow = b.createFlowSwitchClause(b.preSwitchCaseFlow, switchStatement, clauseStart, i+1)
 * 		}
 * 		b.addAntecedent(preCaseLabel, preCaseFlow)
 * 		b.addAntecedent(preCaseLabel, fallthroughFlow)
 * 		b.currentFlow = b.finishFlowLabel(preCaseLabel)
 * 		clause := clauses[i]
 * 		b.bind(clause)
 * 		fallthroughFlow = b.currentFlow
 * 		if b.currentFlow.Flags&ast.FlowFlagsUnreachable == 0 && i != len(clauses)-1 {
 * 			clause.AsCaseOrDefaultClause().FallthroughFlowNode = b.currentFlow
 * 		}
 * 	}
 * }
 */
export function Binder_bindCaseBlock(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const switchStatement = node!.Parent;
  const clauses = AsCaseBlock(node)!.Clauses!.Nodes;
  const isNarrowingSwitch = Node_Expression(switchStatement)!.Kind === KindTrueKeyword || isNarrowingExpression(Node_Expression(switchStatement));
  let fallthroughFlow: GoPtr<FlowNode> = receiver!.unreachableFlow;
  let i = 0;
  while (i < clauses.length) {
    const clauseStart = i;
    while ((Node_Statements(clauses[i]) ?? []).length === 0 && i + 1 < clauses.length) {
      if (fallthroughFlow === receiver!.unreachableFlow) {
        receiver!.currentFlow = receiver!.preSwitchCaseFlow;
      }
      Binder_bind(receiver, clauses[i]);
      i++;
    }
    const preCaseLabel = Binder_createBranchLabel(receiver);
    let preCaseFlow: GoPtr<FlowNode> = receiver!.preSwitchCaseFlow;
    if (isNarrowingSwitch) {
      preCaseFlow = Binder_createFlowSwitchClause(receiver, receiver!.preSwitchCaseFlow!, switchStatement, clauseStart as int, (i + 1) as int);
    }
    Binder_addAntecedent(receiver, preCaseLabel!, preCaseFlow!);
    Binder_addAntecedent(receiver, preCaseLabel!, fallthroughFlow!);
    receiver!.currentFlow = Binder_finishFlowLabel(receiver, preCaseLabel);
    const clause = clauses[i];
    Binder_bind(receiver, clause);
    fallthroughFlow = receiver!.currentFlow;
    if ((receiver!.currentFlow!.Flags & FlowFlagsUnreachable) === 0 && i !== clauses.length - 1) {
      (AsCaseOrDefaultClause(clause) as unknown as { FallthroughFlowNode?: GoPtr<FlowNode> }).FallthroughFlowNode = receiver!.currentFlow;
    }
    i++;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindCaseOrDefaultClause","kind":"method","status":"implemented","sigHash":"dea7156e7e405d1d39d683d1ebdb2099bba01255c9ccf159ec15dc96985fb4a4","bodyHash":"5b6f879924e73216ed45720e290772296e8a71a9f5070bad8c485e04ef28f363"}
 *
 * Go source:
 * func (b *Binder) bindCaseOrDefaultClause(node *ast.Node) {
 * 	clause := node.AsCaseOrDefaultClause()
 * 	if clause.Expression != nil {
 * 		saveCurrentFlow := b.currentFlow
 * 		b.currentFlow = b.preSwitchCaseFlow
 * 		b.bind(clause.Expression)
 * 		b.currentFlow = saveCurrentFlow
 * 	}
 * 	b.bindEach(clause.Statements.Nodes)
 * }
 */
export function Binder_bindCaseOrDefaultClause(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const clause = AsCaseOrDefaultClause(node);
  if (clause!.Expression !== undefined) {
    const saveCurrentFlow = receiver!.currentFlow;
    receiver!.currentFlow = receiver!.preSwitchCaseFlow;
    Binder_bind(receiver, clause!.Expression as unknown as GoPtr<Node>);
    receiver!.currentFlow = saveCurrentFlow;
  }
  Binder_bindEach(receiver, clause!.Statements!.Nodes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindExpressionStatement","kind":"method","status":"implemented","sigHash":"02ce8faae8e9ca21ff2571df539172ec388883446f3325287c606bdf7f994b43","bodyHash":"be5b1b489b33ffecb4146e66dca3c847d65fed91c4cdae278ffc23f6c80d62e0"}
 *
 * Go source:
 * func (b *Binder) bindExpressionStatement(node *ast.Node) {
 * 	stmt := node.AsExpressionStatement()
 * 	b.bind(stmt.Expression)
 * 	b.maybeBindExpressionFlowIfCall(stmt.Expression)
 * }
 */
export function Binder_bindExpressionStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const stmt = AsExpressionStatement(node);
  Binder_bind(receiver, stmt!.Expression as unknown as GoPtr<Node>);
  Binder_maybeBindExpressionFlowIfCall(receiver, stmt!.Expression as unknown as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.maybeBindExpressionFlowIfCall","kind":"method","status":"implemented","sigHash":"9e2ee17f7ccf023f177e8a72aa1971d479929e746c8eb688f3c983454fcbc8a1","bodyHash":"e192584b8a9a9b757d18c75b04c5c9d58b8617b36095666daddc5dda2130e7c0"}
 *
 * Go source:
 * func (b *Binder) maybeBindExpressionFlowIfCall(node *ast.Node) {
 * 	// A top level or comma expression call expression with a dotted function name and at least one argument
 * 	// is potentially an assertion and is therefore included in the control flow.
 * 	if ast.IsCallExpression(node) {
 * 		if node.Expression().Kind != ast.KindSuperKeyword && ast.IsDottedName(node.Expression()) {
 * 			b.currentFlow = b.createFlowCall(b.currentFlow, node)
 * 		}
 * 	}
 * }
 */
export function Binder_maybeBindExpressionFlowIfCall(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (IsCallExpression(node)) {
    if (Node_Expression(node)!.Kind !== KindSuperKeyword && IsDottedName(Node_Expression(node))) {
      receiver!.currentFlow = Binder_createFlowCall(receiver, receiver!.currentFlow!, node);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindLabeledStatement","kind":"method","status":"implemented","sigHash":"8c7a547a41e83858e7af1fdd67a4e4f8dd01f4f5c1f46a87cc69a2d624953cbd","bodyHash":"a125d06072aa57b79eb81a03a46ff5809492d8eb1931bceebad0b58dff68ab3d"}
 *
 * Go source:
 * func (b *Binder) bindLabeledStatement(node *ast.Node) {
 * 	stmt := node.AsLabeledStatement()
 * 	postStatementLabel := b.createBranchLabel()
 * 	b.activeLabelList = &ActiveLabel{
 * 		next:           b.activeLabelList,
 * 		name:           stmt.Label.Text(),
 * 		breakTarget:    postStatementLabel,
 * 		continueTarget: nil,
 * 		referenced:     false,
 * 	}
 * 	b.bind(stmt.Label)
 * 	b.bind(stmt.Statement)
 * 	if !b.activeLabelList.referenced {
 * 		// Mark the label as unused; the checker will decide whether to report it
 * 		stmt.Label.Flags |= ast.NodeFlagsUnreachable
 * 	}
 * 	b.activeLabelList = b.activeLabelList.next
 * 	b.addAntecedent(postStatementLabel, b.currentFlow)
 * 	b.currentFlow = b.finishFlowLabel(postStatementLabel)
 * }
 */
export function Binder_bindLabeledStatement(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const stmt = AsLabeledStatement(node);
  const postStatementLabel = Binder_createBranchLabel(receiver);
  receiver!.activeLabelList = {
    next: receiver!.activeLabelList,
    name: Node_Text(stmt!.Label as unknown as Node),
    breakTarget: postStatementLabel,
    continueTarget: undefined,
    referenced: false,
  };
  Binder_bind(receiver, stmt!.Label as unknown as GoPtr<Node>);
  Binder_bind(receiver, stmt!.Statement as unknown as GoPtr<Node>);
  if (!receiver!.activeLabelList!.referenced) {
    stmt!.Label!.Flags = (stmt!.Label!.Flags | NodeFlagsUnreachable) as NodeFlags;
  }
  receiver!.activeLabelList = receiver!.activeLabelList!.next;
  Binder_addAntecedent(receiver, postStatementLabel!, receiver!.currentFlow!);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, postStatementLabel);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindPrefixUnaryExpressionFlow","kind":"method","status":"implemented","sigHash":"a7a60e8a91d158fb5d0d2559c1638a1119705ccc421ae0ecdc00936a62fa17fb","bodyHash":"71f4a361ab3cab7b42124074c2172b7ffbfe49417c9b3bd44c6b07c530065400"}
 *
 * Go source:
 * func (b *Binder) bindPrefixUnaryExpressionFlow(node *ast.Node) {
 * 	expr := node.AsPrefixUnaryExpression()
 * 	if expr.Operator == ast.KindExclamationToken {
 * 		saveTrueTarget := b.currentTrueTarget
 * 		b.currentTrueTarget = b.currentFalseTarget
 * 		b.currentFalseTarget = saveTrueTarget
 * 		b.bindEachChild(node)
 * 		b.currentFalseTarget = b.currentTrueTarget
 * 		b.currentTrueTarget = saveTrueTarget
 * 	} else {
 * 		b.bindEachChild(node)
 * 		if expr.Operator == ast.KindPlusPlusToken || expr.Operator == ast.KindMinusMinusToken {
 * 			b.bindAssignmentTargetFlow(expr.Operand)
 * 		}
 * 	}
 * }
 */
export function Binder_bindPrefixUnaryExpressionFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const expr = AsPrefixUnaryExpression(node);
  if (expr!.Operator === KindExclamationToken) {
    const saveTrueTarget = receiver!.currentTrueTarget;
    receiver!.currentTrueTarget = receiver!.currentFalseTarget;
    receiver!.currentFalseTarget = saveTrueTarget;
    Binder_bindEachChild(receiver, node);
    receiver!.currentFalseTarget = receiver!.currentTrueTarget;
    receiver!.currentTrueTarget = saveTrueTarget;
  } else {
    Binder_bindEachChild(receiver, node);
    if (expr!.Operator === KindPlusPlusToken || expr!.Operator === KindMinusMinusToken) {
      Binder_bindAssignmentTargetFlow(receiver, expr!.Operand as unknown as GoPtr<Node>);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindPostfixUnaryExpressionFlow","kind":"method","status":"implemented","sigHash":"5f1df513646ec86b0139e731a191c22d69737febdd94808e924924e67d5fc607","bodyHash":"7ef16343ec567b7a503d8086d5f08547c725b46654d9510a1ea62175009258dd"}
 *
 * Go source:
 * func (b *Binder) bindPostfixUnaryExpressionFlow(node *ast.Node) {
 * 	expr := node.AsPostfixUnaryExpression()
 * 	b.bindEachChild(node)
 * 	if expr.Operator == ast.KindPlusPlusToken || expr.Operator == ast.KindMinusMinusToken {
 * 		b.bindAssignmentTargetFlow(expr.Operand)
 * 	}
 * }
 */
export function Binder_bindPostfixUnaryExpressionFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const expr = AsPostfixUnaryExpression(node);
  Binder_bindEachChild(receiver, node);
  if (expr!.Operator === KindPlusPlusToken || expr!.Operator === KindMinusMinusToken) {
    Binder_bindAssignmentTargetFlow(receiver, expr!.Operand as unknown as GoPtr<Node>);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindDestructuringAssignmentFlow","kind":"method","status":"implemented","sigHash":"ebb5e3159698d377ab4046357f300823c846c8062c946a252a2f365fca123f67","bodyHash":"14e201612a9ef48d49d9ef2a11829d120948da95db70f00e553039661da7a0c9"}
 *
 * Go source:
 * func (b *Binder) bindDestructuringAssignmentFlow(node *ast.Node) {
 * 	expr := node.AsBinaryExpression()
 * 	if b.inAssignmentPattern {
 * 		b.inAssignmentPattern = false
 * 		b.bind(expr.OperatorToken)
 * 		b.bind(expr.Right)
 * 		b.inAssignmentPattern = true
 * 		b.bind(expr.Left)
 * 		b.bind(expr.Type)
 * 	} else {
 * 		b.inAssignmentPattern = true
 * 		b.bind(expr.Left)
 * 		b.bind(expr.Type)
 * 		b.inAssignmentPattern = false
 * 		b.bind(expr.OperatorToken)
 * 		b.bind(expr.Right)
 * 	}
 * 	b.bindAssignmentTargetFlow(expr.Left)
 * }
 */
export function Binder_bindDestructuringAssignmentFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const expr = AsBinaryExpression(node);
  if (receiver!.inAssignmentPattern) {
    receiver!.inAssignmentPattern = false;
    Binder_bind(receiver, expr!.OperatorToken as unknown as GoPtr<Node>);
    Binder_bind(receiver, expr!.Right as unknown as GoPtr<Node>);
    receiver!.inAssignmentPattern = true;
    Binder_bind(receiver, expr!.Left as unknown as GoPtr<Node>);
    Binder_bind(receiver, (expr as unknown as { Type?: GoPtr<Node> }).Type);
  } else {
    receiver!.inAssignmentPattern = true;
    Binder_bind(receiver, expr!.Left as unknown as GoPtr<Node>);
    Binder_bind(receiver, (expr as unknown as { Type?: GoPtr<Node> }).Type);
    receiver!.inAssignmentPattern = false;
    Binder_bind(receiver, expr!.OperatorToken as unknown as GoPtr<Node>);
    Binder_bind(receiver, expr!.Right as unknown as GoPtr<Node>);
  }
  Binder_bindAssignmentTargetFlow(receiver, expr!.Left as unknown as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindBinaryExpressionFlow","kind":"method","status":"implemented","sigHash":"2528bb73085d7b11c9a536c13f32c3a218827894c2e0d1e87c6de6705e46989e","bodyHash":"e02b22b41d8ace0374bc12746a52832b6670fc3b6860ec14c757ab4e37355945"}
 *
 * Go source:
 * func (b *Binder) bindBinaryExpressionFlow(node *ast.Node) {
 * 	expr := node.AsBinaryExpression()
 * 	operator := expr.OperatorToken.Kind
 * 	if ast.IsLogicalOrCoalescingBinaryOperator(operator) || ast.IsLogicalOrCoalescingAssignmentOperator(operator) {
 * 		if isTopLevelLogicalExpression(node) {
 * 			postExpressionLabel := b.createBranchLabel()
 * 			saveCurrentFlow := b.currentFlow
 * 			saveHasFlowEffects := b.hasFlowEffects
 * 			b.hasFlowEffects = false
 * 			b.bindLogicalLikeExpression(node, postExpressionLabel, postExpressionLabel)
 * 			if b.hasFlowEffects {
 * 				b.currentFlow = b.finishFlowLabel(postExpressionLabel)
 * 			} else {
 * 				b.currentFlow = saveCurrentFlow
 * 			}
 * 			b.hasFlowEffects = b.hasFlowEffects || saveHasFlowEffects
 * 		} else {
 * 			b.bindLogicalLikeExpression(node, b.currentTrueTarget, b.currentFalseTarget)
 * 		}
 * 	} else {
 * 		b.bind(expr.Left)
 * 		b.bind(expr.Type)
 * 		if operator == ast.KindCommaToken {
 * 			b.maybeBindExpressionFlowIfCall(expr.Left)
 * 		}
 * 		b.bind(expr.OperatorToken)
 * 		b.bind(expr.Right)
 * 		if operator == ast.KindCommaToken {
 * 			b.maybeBindExpressionFlowIfCall(expr.Right)
 * 		}
 * 		if ast.IsAssignmentOperator(operator) && !ast.IsAssignmentTarget(node) {
 * 			b.bindAssignmentTargetFlow(expr.Left)
 * 			if operator == ast.KindEqualsToken && expr.Left.Kind == ast.KindElementAccessExpression {
 * 				elementAccess := expr.Left.AsElementAccessExpression()
 * 				if isNarrowableOperand(elementAccess.Expression) {
 * 					b.currentFlow = b.createFlowMutation(ast.FlowFlagsArrayMutation, b.currentFlow, node)
 * 				}
 * 			}
 * 		}
 * 	}
 * }
 */
export function Binder_bindBinaryExpressionFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const expr = AsBinaryExpression(node);
  const operator = expr!.OperatorToken!.Kind;
  if (IsLogicalOrCoalescingBinaryOperator(operator) || IsLogicalOrCoalescingAssignmentOperator(operator)) {
    if (isTopLevelLogicalExpression(node)) {
      const postExpressionLabel = Binder_createBranchLabel(receiver);
      const saveCurrentFlow = receiver!.currentFlow;
      const saveHasFlowEffects = receiver!.hasFlowEffects;
      receiver!.hasFlowEffects = false;
      Binder_bindLogicalLikeExpression(receiver, node, postExpressionLabel, postExpressionLabel);
      if (receiver!.hasFlowEffects) {
        receiver!.currentFlow = Binder_finishFlowLabel(receiver, postExpressionLabel);
      } else {
        receiver!.currentFlow = saveCurrentFlow;
      }
      receiver!.hasFlowEffects = (receiver!.hasFlowEffects || saveHasFlowEffects) as bool;
    } else {
      Binder_bindLogicalLikeExpression(receiver, node, receiver!.currentTrueTarget, receiver!.currentFalseTarget);
    }
  } else {
    Binder_bindNonLogicalBinaryExpressionFlow(receiver, node);
  }
}

function Binder_bindNonLogicalBinaryExpressionFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const binaryChain: GoPtr<Node>[] = [node];
  let leftEdge = AsBinaryExpression(node)!.Left as unknown as GoPtr<Node>;
  while (isIterativelyBindableNonLogicalBinaryExpression(leftEdge)) {
    binaryChain.push(leftEdge);
    leftEdge = AsBinaryExpression(leftEdge)!.Left as unknown as GoPtr<Node>;
  }

  for (let index = 1; index < binaryChain.length; index++) {
    binaryChain[index]!.Parent = binaryChain[index - 1];
    Binder_bindBinaryExpressionNode(receiver, binaryChain[index]);
  }

  receiver!.parent = binaryChain[binaryChain.length - 1];
  Binder_bind(receiver, leftEdge);
  for (let index = binaryChain.length - 1; index >= 0; index--) {
    receiver!.parent = binaryChain[index];
    Binder_bindNonLogicalBinaryExpressionTail(receiver, binaryChain[index]);
  }
  receiver!.parent = node;
}

function isIterativelyBindableNonLogicalBinaryExpression(node: GoPtr<Node>): bool {
  if (node === undefined || node.Kind !== KindBinaryExpression || IsDestructuringAssignment(node)) {
    return false as bool;
  }
  const operator = AsBinaryExpression(node)!.OperatorToken!.Kind;
  return (!IsLogicalOrCoalescingBinaryOperator(operator) && !IsLogicalOrCoalescingAssignmentOperator(operator)) as bool;
}

function Binder_bindNonLogicalBinaryExpressionTail(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const expr = AsBinaryExpression(node);
  const operator = expr!.OperatorToken!.Kind;
  Binder_bind(receiver, (expr as unknown as { Type?: GoPtr<Node> }).Type);
  if (operator === KindCommaToken) {
    Binder_maybeBindExpressionFlowIfCall(receiver, expr!.Left as unknown as GoPtr<Node>);
  }
  Binder_bind(receiver, expr!.OperatorToken as unknown as GoPtr<Node>);
  Binder_bind(receiver, expr!.Right as unknown as GoPtr<Node>);
  if (operator === KindCommaToken) {
    Binder_maybeBindExpressionFlowIfCall(receiver, expr!.Right as unknown as GoPtr<Node>);
  }
  if (IsAssignmentOperator(operator) && !IsAssignmentTarget(node)) {
    Binder_bindAssignmentTargetFlow(receiver, expr!.Left as unknown as GoPtr<Node>);
    if (operator === KindEqualsToken && expr!.Left!.Kind === KindElementAccessExpression) {
      const elementAccess = AsElementAccessExpression(expr!.Left as unknown as GoPtr<Node>);
      if (isNarrowableOperand(elementAccess!.Expression as unknown as GoPtr<Node>)) {
        receiver!.currentFlow = Binder_createFlowMutation(receiver, FlowFlagsArrayMutation, receiver!.currentFlow!, node);
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindLogicalLikeExpression","kind":"method","status":"implemented","sigHash":"495531426ebfdcc314cd3151e4ab0927cda2edd57c7c202d27061c5da2a92fca","bodyHash":"a9712bff4109ce88f497573b6c2961263bd22a3c4eafb79a5f32630f7575d9bf"}
 *
 * Go source:
 * func (b *Binder) bindLogicalLikeExpression(node *ast.Node, trueTarget *ast.FlowLabel, falseTarget *ast.FlowLabel) {
 * 	expr := node.AsBinaryExpression()
 * 	preRightLabel := b.createBranchLabel()
 * 	if expr.OperatorToken.Kind == ast.KindAmpersandAmpersandToken || expr.OperatorToken.Kind == ast.KindAmpersandAmpersandEqualsToken {
 * 		b.bindCondition(expr.Left, preRightLabel, falseTarget)
 * 	} else {
 * 		b.bindCondition(expr.Left, trueTarget, preRightLabel)
 * 	}
 * 	b.currentFlow = b.finishFlowLabel(preRightLabel)
 * 	b.bind(expr.OperatorToken)
 * 	if ast.IsLogicalOrCoalescingAssignmentOperator(expr.OperatorToken.Kind) {
 * 		b.doWithConditionalBranches((*Binder).bind, expr.Right, trueTarget, falseTarget)
 * 		b.bindAssignmentTargetFlow(expr.Left)
 * 		b.addAntecedent(trueTarget, b.createFlowCondition(ast.FlowFlagsTrueCondition, b.currentFlow, node))
 * 		b.addAntecedent(falseTarget, b.createFlowCondition(ast.FlowFlagsFalseCondition, b.currentFlow, node))
 * 	} else {
 * 		b.bindCondition(expr.Right, trueTarget, falseTarget)
 * 	}
 * }
 */
export function Binder_bindLogicalLikeExpression(receiver: GoPtr<Binder>, node: GoPtr<Node>, trueTarget: GoPtr<FlowLabel>, falseTarget: GoPtr<FlowLabel>): void {
  const expr = AsBinaryExpression(node);
  const preRightLabel = Binder_createBranchLabel(receiver);
  if (expr!.OperatorToken!.Kind === KindAmpersandAmpersandToken || expr!.OperatorToken!.Kind === KindAmpersandAmpersandEqualsToken) {
    Binder_bindCondition(receiver, expr!.Left as unknown as GoPtr<Node>, preRightLabel, falseTarget);
  } else {
    Binder_bindCondition(receiver, expr!.Left as unknown as GoPtr<Node>, trueTarget, preRightLabel);
  }
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, preRightLabel);
  Binder_bind(receiver, expr!.OperatorToken as unknown as GoPtr<Node>);
  if (IsLogicalOrCoalescingAssignmentOperator(expr!.OperatorToken!.Kind)) {
    Binder_doWithConditionalBranches(receiver, Binder_bind, expr!.Right as unknown as GoPtr<Node>, trueTarget, falseTarget);
    Binder_bindAssignmentTargetFlow(receiver, expr!.Left as unknown as GoPtr<Node>);
    Binder_addAntecedent(receiver, trueTarget!, Binder_createFlowCondition(receiver, FlowFlagsTrueCondition, receiver!.currentFlow!, node)!);
    Binder_addAntecedent(receiver, falseTarget!, Binder_createFlowCondition(receiver, FlowFlagsFalseCondition, receiver!.currentFlow!, node)!);
  } else {
    Binder_bindCondition(receiver, expr!.Right as unknown as GoPtr<Node>, trueTarget, falseTarget);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindDeleteExpressionFlow","kind":"method","status":"implemented","sigHash":"aa87264ef1104759b358d496080c32ee2dc67afe3c93d6dcdad28b442b2ce9db","bodyHash":"afe1fdd9cee8cef15e9622fac7f6b16503c9194463421b38313f393069d9d1db"}
 *
 * Go source:
 * func (b *Binder) bindDeleteExpressionFlow(node *ast.Node) {
 * 	expr := node.AsDeleteExpression()
 * 	b.bindEachChild(node)
 * 	if expr.Expression.Kind == ast.KindPropertyAccessExpression {
 * 		b.bindAssignmentTargetFlow(expr.Expression)
 * 	}
 * }
 */
export function Binder_bindDeleteExpressionFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const expr = AsDeleteExpression(node);
  Binder_bindEachChild(receiver, node);
  if (expr!.Expression!.Kind === KindPropertyAccessExpression) {
    Binder_bindAssignmentTargetFlow(receiver, expr!.Expression as unknown as GoPtr<Node>);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindConditionalExpressionFlow","kind":"method","status":"implemented","sigHash":"7958cbd109aea4d0cf5ff9fdaf199c3df67a403756acbd6d1755f949df94cd45","bodyHash":"54a9ee4e102b34a3650168762e90aa87942e6acb9b47604cadb2d488676140bb"}
 *
 * Go source:
 * func (b *Binder) bindConditionalExpressionFlow(node *ast.Node) {
 * 	expr := node.AsConditionalExpression()
 * 	trueLabel := b.createBranchLabel()
 * 	falseLabel := b.createBranchLabel()
 * 	postExpressionLabel := b.createBranchLabel()
 * 	saveCurrentFlow := b.currentFlow
 * 	saveHasFlowEffects := b.hasFlowEffects
 * 	b.hasFlowEffects = false
 * 	b.bindCondition(expr.Condition, trueLabel, falseLabel)
 * 	b.currentFlow = b.finishFlowLabel(trueLabel)
 * 	b.bind(expr.QuestionToken)
 * 	b.bind(expr.WhenTrue)
 * 	b.addAntecedent(postExpressionLabel, b.currentFlow)
 * 	b.currentFlow = b.finishFlowLabel(falseLabel)
 * 	b.bind(expr.ColonToken)
 * 	b.bind(expr.WhenFalse)
 * 	b.addAntecedent(postExpressionLabel, b.currentFlow)
 * 	if b.hasFlowEffects {
 * 		b.currentFlow = b.finishFlowLabel(postExpressionLabel)
 * 	} else {
 * 		b.currentFlow = saveCurrentFlow
 * 	}
 * 	b.hasFlowEffects = b.hasFlowEffects || saveHasFlowEffects
 * }
 */
export function Binder_bindConditionalExpressionFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const expr = AsConditionalExpression(node);
  const trueLabel = Binder_createBranchLabel(receiver);
  const falseLabel = Binder_createBranchLabel(receiver);
  const postExpressionLabel = Binder_createBranchLabel(receiver);
  const saveCurrentFlow = receiver!.currentFlow;
  const saveHasFlowEffects = receiver!.hasFlowEffects;
  receiver!.hasFlowEffects = false;
  Binder_bindCondition(receiver, expr!.Condition as unknown as GoPtr<Node>, trueLabel, falseLabel);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, trueLabel);
  Binder_bind(receiver, expr!.QuestionToken as unknown as GoPtr<Node>);
  Binder_bind(receiver, expr!.WhenTrue as unknown as GoPtr<Node>);
  Binder_addAntecedent(receiver, postExpressionLabel!, receiver!.currentFlow!);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, falseLabel);
  Binder_bind(receiver, expr!.ColonToken as unknown as GoPtr<Node>);
  Binder_bind(receiver, expr!.WhenFalse as unknown as GoPtr<Node>);
  Binder_addAntecedent(receiver, postExpressionLabel!, receiver!.currentFlow!);
  if (receiver!.hasFlowEffects) {
    receiver!.currentFlow = Binder_finishFlowLabel(receiver, postExpressionLabel);
  } else {
    receiver!.currentFlow = saveCurrentFlow;
  }
  receiver!.hasFlowEffects = (receiver!.hasFlowEffects || saveHasFlowEffects) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindVariableDeclarationFlow","kind":"method","status":"implemented","sigHash":"326794be06390561fd5026c316785326fd9c8c8e9769fda686ad275d72e380f6","bodyHash":"759d5ccf350694ade7fdb5b7cfb415a49b3e03cf47576d025c6233c9566eb84a"}
 *
 * Go source:
 * func (b *Binder) bindVariableDeclarationFlow(node *ast.Node) {
 * 	b.bindEachChild(node)
 * 	if node.Initializer() != nil || ast.IsForInOrOfStatement(node.Parent.Parent) {
 * 		b.bindInitializedVariableFlow(node)
 * 	}
 * }
 */
export function Binder_bindVariableDeclarationFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  Binder_bindEachChild(receiver, node);
  if (Node_Initializer(node) !== undefined || IsForInOrOfStatement(node!.Parent!.Parent)) {
    Binder_bindInitializedVariableFlow(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindInitializedVariableFlow","kind":"method","status":"implemented","sigHash":"2878be7fe696a58838fb81f813209f9549b0d38e5ced5e67c8e56d25147867e1","bodyHash":"6def3ef1cf7f160268eeb0d1006a734e523a30d4f7a152964bca37e6d703ce36"}
 *
 * Go source:
 * func (b *Binder) bindInitializedVariableFlow(node *ast.Node) {
 * 	var name *ast.Node
 * 	switch node.Kind {
 * 	case ast.KindVariableDeclaration:
 * 		name = node.AsVariableDeclaration().Name()
 * 	case ast.KindBindingElement:
 * 		name = node.AsBindingElement().Name()
 * 	}
 * 	if name != nil && ast.IsBindingPattern(name) {
 * 		for _, child := range name.Elements() {
 * 			b.bindInitializedVariableFlow(child)
 * 		}
 * 	} else {
 * 		b.currentFlow = b.createFlowMutation(ast.FlowFlagsAssignment, b.currentFlow, node)
 * 	}
 * }
 */
export function Binder_bindInitializedVariableFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  let name: GoPtr<Node>;
  switch (node!.Kind) {
    case KindVariableDeclaration:
      name = Node_Name(node);
      break;
    case KindBindingElement:
      name = Node_Name(node);
      break;
  }
  if (name !== undefined && IsBindingPattern(name)) {
    for (const child of (Node_Elements(name) ?? [])) {
      Binder_bindInitializedVariableFlow(receiver, child);
    }
  } else {
    receiver!.currentFlow = Binder_createFlowMutation(receiver, FlowFlagsAssignment, receiver!.currentFlow!, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindAccessExpressionFlow","kind":"method","status":"implemented","sigHash":"27c7bfedc0b686809bafb71d7e01211e8924bc055c61d313eaaa2ada88eae867","bodyHash":"262624bab0e0a45ec6615da958b845f916769a2ab7e5ffea176c7925939701f1"}
 *
 * Go source:
 * func (b *Binder) bindAccessExpressionFlow(node *ast.Node) {
 * 	if ast.IsOptionalChain(node) {
 * 		b.bindOptionalChainFlow(node)
 * 	} else {
 * 		b.bindEachChild(node)
 * 	}
 * }
 */
export function Binder_bindAccessExpressionFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (IsOptionalChain(node)) {
    Binder_bindOptionalChainFlow(receiver, node);
  } else {
    Binder_bindEachChild(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindOptionalChainFlow","kind":"method","status":"implemented","sigHash":"ff83bf50837dd3068e1cbdfb28a401e3a9ca762949d019140dc3f940213bd2d4","bodyHash":"720e528649f8448a0279fdfdd2392b64c8da9bc71a43cc352e1d5f6e2bce137a"}
 *
 * Go source:
 * func (b *Binder) bindOptionalChainFlow(node *ast.Node) {
 * 	if isTopLevelLogicalExpression(node) {
 * 		postExpressionLabel := b.createBranchLabel()
 * 		saveCurrentFlow := b.currentFlow
 * 		saveHasFlowEffects := b.hasFlowEffects
 * 		b.bindOptionalChain(node, postExpressionLabel, postExpressionLabel)
 * 		if b.hasFlowEffects {
 * 			b.currentFlow = b.finishFlowLabel(postExpressionLabel)
 * 		} else {
 * 			b.currentFlow = saveCurrentFlow
 * 		}
 * 		b.hasFlowEffects = b.hasFlowEffects || saveHasFlowEffects
 * 	} else {
 * 		b.bindOptionalChain(node, b.currentTrueTarget, b.currentFalseTarget)
 * 	}
 * }
 */
export function Binder_bindOptionalChainFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (isTopLevelLogicalExpression(node)) {
    const postExpressionLabel = Binder_createBranchLabel(receiver);
    const saveCurrentFlow = receiver!.currentFlow;
    const saveHasFlowEffects = receiver!.hasFlowEffects;
    Binder_bindOptionalChain(receiver, node, postExpressionLabel, postExpressionLabel);
    if (receiver!.hasFlowEffects) {
      receiver!.currentFlow = Binder_finishFlowLabel(receiver, postExpressionLabel);
    } else {
      receiver!.currentFlow = saveCurrentFlow;
    }
    receiver!.hasFlowEffects = (receiver!.hasFlowEffects || saveHasFlowEffects) as bool;
  } else {
    Binder_bindOptionalChain(receiver, node, receiver!.currentTrueTarget, receiver!.currentFalseTarget);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindOptionalChain","kind":"method","status":"implemented","sigHash":"8324d16ef53f9b50ade10e2073a1c5e2186e94b20d8b7abc50a51994330fb6e3","bodyHash":"3e540f51b1af0d55e271c2525a28c2c6b47120e71a49b0752e61d4694d22beba"}
 *
 * Go source:
 * func (b *Binder) bindOptionalChain(node *ast.Node, trueTarget *ast.FlowLabel, falseTarget *ast.FlowLabel) {
 * 	// For an optional chain, we emulate the behavior of a logical expression:
 * 	//
 * 	// a?.b         -> a && a.b
 * 	// a?.b.c       -> a && a.b.c
 * 	// a?.b?.c      -> a && a.b && a.b.c
 * 	// a?.[x = 1]   -> a && a[x = 1]
 * 	//
 * 	// To do this we descend through the chain until we reach the root of a chain (the expression with a `?.`)
 * 	// and build it's CFA graph as if it were the first condition (`a && ...`). Then we bind the rest
 * 	// of the node as part of the "true" branch, and continue to do so as we ascend back up to the outermost
 * 	// chain node. We then treat the entire node as the right side of the expression.
 * 	var preChainLabel *ast.FlowLabel
 * 	if ast.IsOptionalChainRoot(node) {
 * 		preChainLabel = b.createBranchLabel()
 * 	}
 * 	b.bindOptionalExpression(node.Expression(), core.IfElse(preChainLabel != nil, preChainLabel, trueTarget), falseTarget)
 * 	if preChainLabel != nil {
 * 		b.currentFlow = b.finishFlowLabel(preChainLabel)
 * 	}
 * 	b.doWithConditionalBranches((*Binder).bindOptionalChainRest, node, trueTarget, falseTarget)
 * 	if ast.IsOutermostOptionalChain(node) {
 * 		b.addAntecedent(trueTarget, b.createFlowCondition(ast.FlowFlagsTrueCondition, b.currentFlow, node))
 * 		b.addAntecedent(falseTarget, b.createFlowCondition(ast.FlowFlagsFalseCondition, b.currentFlow, node))
 * 	}
 * }
 */
export function Binder_bindOptionalChain(receiver: GoPtr<Binder>, node: GoPtr<Node>, trueTarget: GoPtr<FlowLabel>, falseTarget: GoPtr<FlowLabel>): void {
  let preChainLabel: GoPtr<FlowLabel>;
  if (IsOptionalChainRoot(node)) {
    preChainLabel = Binder_createBranchLabel(receiver);
  }
  Binder_bindOptionalExpression(receiver, Node_Expression(node), IfElse(preChainLabel !== undefined, preChainLabel!, trueTarget) as GoPtr<FlowLabel>, falseTarget);
  if (preChainLabel !== undefined) {
    receiver!.currentFlow = Binder_finishFlowLabel(receiver, preChainLabel);
  }
  Binder_doWithConditionalBranches(receiver, Binder_bindOptionalChainRest, node, trueTarget, falseTarget);
  if (IsOutermostOptionalChain(node)) {
    Binder_addAntecedent(receiver, trueTarget!, Binder_createFlowCondition(receiver, FlowFlagsTrueCondition, receiver!.currentFlow!, node)!);
    Binder_addAntecedent(receiver, falseTarget!, Binder_createFlowCondition(receiver, FlowFlagsFalseCondition, receiver!.currentFlow!, node)!);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindOptionalExpression","kind":"method","status":"implemented","sigHash":"1da19a095155b80b1b260170912bf48d8b88944f68b5bf3cdd9a817422f05fe9","bodyHash":"77a997bd87e482445a60614b0e8db5f217c7b14157ccd9b1ddaaf89afafafb90"}
 *
 * Go source:
 * func (b *Binder) bindOptionalExpression(node *ast.Node, trueTarget *ast.FlowLabel, falseTarget *ast.FlowLabel) {
 * 	b.doWithConditionalBranches((*Binder).bind, node, trueTarget, falseTarget)
 * 	if !ast.IsOptionalChain(node) || ast.IsOutermostOptionalChain(node) {
 * 		b.addAntecedent(trueTarget, b.createFlowCondition(ast.FlowFlagsTrueCondition, b.currentFlow, node))
 * 		b.addAntecedent(falseTarget, b.createFlowCondition(ast.FlowFlagsFalseCondition, b.currentFlow, node))
 * 	}
 * }
 */
export function Binder_bindOptionalExpression(receiver: GoPtr<Binder>, node: GoPtr<Node>, trueTarget: GoPtr<FlowLabel>, falseTarget: GoPtr<FlowLabel>): void {
  Binder_doWithConditionalBranches(receiver, Binder_bind, node, trueTarget, falseTarget);
  if (!IsOptionalChain(node) || IsOutermostOptionalChain(node)) {
    Binder_addAntecedent(receiver, trueTarget!, Binder_createFlowCondition(receiver, FlowFlagsTrueCondition, receiver!.currentFlow!, node)!);
    Binder_addAntecedent(receiver, falseTarget!, Binder_createFlowCondition(receiver, FlowFlagsFalseCondition, receiver!.currentFlow!, node)!);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindOptionalChainRest","kind":"method","status":"implemented","sigHash":"bec8ae94365270f1eb05ccfdf85c934d1df88fd99ae72f6d48d21c5043f3e6b6","bodyHash":"b2063678ea63415327b3c8f5db1d7edf096482822a46c36e0ffd90a4eec76053"}
 *
 * Go source:
 * func (b *Binder) bindOptionalChainRest(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindPropertyAccessExpression:
 * 		b.bind(node.QuestionDotToken())
 * 		b.bind(node.Name())
 * 	case ast.KindElementAccessExpression:
 * 		b.bind(node.QuestionDotToken())
 * 		b.bind(node.AsElementAccessExpression().ArgumentExpression)
 * 	case ast.KindCallExpression:
 * 		b.bind(node.QuestionDotToken())
 * 		b.bindNodeList(node.TypeArgumentList())
 * 		b.bindEach(node.Arguments())
 * 	}
 * 	return false
 * }
 */
export function Binder_bindOptionalChainRest(receiver: GoPtr<Binder>, node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindPropertyAccessExpression:
      Binder_bind(receiver, Node_QuestionDotToken(node));
      Binder_bind(receiver, Node_Name(node));
      break;
    case KindElementAccessExpression:
      Binder_bind(receiver, Node_QuestionDotToken(node));
      Binder_bind(receiver, AsElementAccessExpression(node)!.ArgumentExpression as unknown as GoPtr<Node>);
      break;
    case KindCallExpression:
      Binder_bind(receiver, Node_QuestionDotToken(node));
      Binder_bindNodeList(receiver, Node_TypeArgumentList(node));
      Binder_bindEach(receiver, Node_Arguments(node) ?? []);
      break;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindCallExpressionFlow","kind":"method","status":"implemented","sigHash":"fc53baa9ee9b5a8cf2f6729a0030f59b72da8e525ca16f5a3820a51a4d276c78","bodyHash":"78b87c3846286322fca3e0f7d6db35695f0a8d7ff1a50075f440d97782e16123"}
 *
 * Go source:
 * func (b *Binder) bindCallExpressionFlow(node *ast.Node) {
 * 	call := node.AsCallExpression()
 * 	if ast.IsOptionalChain(node) {
 * 		b.bindOptionalChainFlow(node)
 * 	} else {
 * 		// If the target of the call expression is a function expression or arrow function we have
 * 		// an immediately invoked function expression (IIFE). Initialize the flowNode property to
 * 		// the current control flow (which includes evaluation of the IIFE arguments).
 * 		expr := ast.SkipParentheses(call.Expression)
 * 		if expr.Kind == ast.KindFunctionExpression || expr.Kind == ast.KindArrowFunction {
 * 			b.bindNodeList(call.TypeArguments)
 * 			b.bindEach(call.Arguments.Nodes)
 * 			b.bind(call.Expression)
 * 		} else {
 * 			b.bindEachChild(node)
 * 			if call.Expression.Kind == ast.KindSuperKeyword {
 * 				b.currentFlow = b.createFlowCall(b.currentFlow, node)
 * 			}
 * 		}
 * 	}
 * 	if ast.IsPropertyAccessExpression(call.Expression) {
 * 		access := call.Expression.AsPropertyAccessExpression()
 * 		if ast.IsIdentifier(access.Name()) && isNarrowableOperand(access.Expression) && ast.IsPushOrUnshiftIdentifier(access.Name()) {
 * 			b.currentFlow = b.createFlowMutation(ast.FlowFlagsArrayMutation, b.currentFlow, node)
 * 		}
 * 	}
 * }
 */
export function Binder_bindCallExpressionFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const call = AsCallExpression(node);
  if (IsOptionalChain(node)) {
    Binder_bindOptionalChainFlow(receiver, node);
  } else {
    const expr = SkipParentheses(call!.Expression as unknown as GoPtr<Node>);
    if (expr!.Kind === KindFunctionExpression || expr!.Kind === KindArrowFunction) {
      Binder_bindNodeList(receiver, call!.TypeArguments as unknown as GoPtr<NodeList>);
      Binder_bindEach(receiver, call!.Arguments!.Nodes ?? []);
      Binder_bind(receiver, call!.Expression as unknown as GoPtr<Node>);
    } else {
      Binder_bindEachChild(receiver, node);
      if (call!.Expression!.Kind === KindSuperKeyword) {
        receiver!.currentFlow = Binder_createFlowCall(receiver, receiver!.currentFlow!, node);
      }
    }
  }
  if (IsPropertyAccessExpression(call!.Expression as unknown as GoPtr<Node>)) {
    const access = AsPropertyAccessExpression(call!.Expression as unknown as GoPtr<Node>);
    if (IsIdentifier(access!.name as unknown as GoPtr<Node>) && isNarrowableOperand(access!.Expression as unknown as GoPtr<Node>) && IsPushOrUnshiftIdentifier(access!.name as unknown as GoPtr<Node>)) {
      receiver!.currentFlow = Binder_createFlowMutation(receiver, FlowFlagsArrayMutation, receiver!.currentFlow!, node);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindNonNullExpressionFlow","kind":"method","status":"implemented","sigHash":"66b835a73422a0b9264a9769b3bb64e5d2c10c752c0de18b3a59703fba354841","bodyHash":"fc611e8a3d4a8a705e76c49935511be79f1270b3fd36d5087e89e1f4895aa87a"}
 *
 * Go source:
 * func (b *Binder) bindNonNullExpressionFlow(node *ast.Node) {
 * 	if ast.IsOptionalChain(node) {
 * 		b.bindOptionalChainFlow(node)
 * 	} else {
 * 		b.bindEachChild(node)
 * 	}
 * }
 */
export function Binder_bindNonNullExpressionFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (IsOptionalChain(node)) {
    Binder_bindOptionalChainFlow(receiver, node);
  } else {
    Binder_bindEachChild(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindBindingElementFlow","kind":"method","status":"implemented","sigHash":"95476ce26441b1eb79b9c493935eb062f8302e5b538ab3a2988247bc4efdc79b","bodyHash":"13a727fa63a988862c85ec95a374748c77ba480d03f26ff9d646768f2e7d5791"}
 *
 * Go source:
 * func (b *Binder) bindBindingElementFlow(node *ast.Node) {
 * 	// When evaluating a binding pattern, the initializer is evaluated before the binding pattern, per:
 * 	// - https://tc39.es/ecma262/#sec-destructuring-binding-patterns-runtime-semantics-iteratorbindinginitialization
 * 	//   - `BindingElement: BindingPattern Initializer?`
 * 	// - https://tc39.es/ecma262/#sec-runtime-semantics-keyedbindinginitialization
 * 	//   - `BindingElement: BindingPattern Initializer?`
 * 	elem := node.AsBindingElement()
 * 	b.bind(elem.DotDotDotToken)
 * 	b.bind(elem.PropertyName)
 * 	b.bindInitializer(elem.Initializer)
 * 	b.bind(elem.Name())
 * }
 */
export function Binder_bindBindingElementFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const elem = AsBindingElement(node);
  Binder_bind(receiver, elem!.DotDotDotToken as unknown as GoPtr<Node>);
  Binder_bind(receiver, elem!.PropertyName as unknown as GoPtr<Node>);
  Binder_bindInitializer(receiver, elem!.Initializer as unknown as GoPtr<Node>);
  Binder_bind(receiver, Node_Name(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindParameterFlow","kind":"method","status":"implemented","sigHash":"59feaa0a1617fd1f2d95e2a0f6b0056442a9aa3d9323ebc7ba7fe337dded6d72","bodyHash":"39bf29fd8ca62718c79e6d62420398c58452339757a42ecb893ed835841e0792"}
 *
 * Go source:
 * func (b *Binder) bindParameterFlow(node *ast.Node) {
 * 	param := node.AsParameterDeclaration()
 * 	b.bindModifiers(param.Modifiers())
 * 	b.bind(param.DotDotDotToken)
 * 	b.bind(param.QuestionToken)
 * 	b.bind(param.Type)
 * 	b.bindInitializer(param.Initializer)
 * 	b.bind(param.Name())
 * }
 */
export function Binder_bindParameterFlow(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  const param = AsParameterDeclaration(node);
  Binder_bindModifiers(receiver, Node_Modifiers(node));
  Binder_bind(receiver, param!.DotDotDotToken as unknown as GoPtr<Node>);
  Binder_bind(receiver, param!.QuestionToken as unknown as GoPtr<Node>);
  Binder_bind(receiver, param!.Type as unknown as GoPtr<Node>);
  Binder_bindInitializer(receiver, param!.Initializer as unknown as GoPtr<Node>);
  Binder_bind(receiver, Node_Name(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.bindInitializer","kind":"method","status":"implemented","sigHash":"bd53a15be84ba8c0a1f068639980791b854c7b91c0a9145081ea5a78d0ad0ee6","bodyHash":"2c013f15f65d422eb4498fe06fce206bf6054f4a68af3ebaac853a1b83c9b691"}
 *
 * Go source:
 * func (b *Binder) bindInitializer(node *ast.Node) {
 * 	if node == nil {
 * 		return
 * 	}
 * 	entryFlow := b.currentFlow
 * 	b.bind(node)
 * 	if entryFlow == b.unreachableFlow || entryFlow == b.currentFlow {
 * 		return
 * 	}
 * 	exitFlow := b.createBranchLabel()
 * 	b.addAntecedent(exitFlow, entryFlow)
 * 	b.addAntecedent(exitFlow, b.currentFlow)
 * 	b.currentFlow = b.finishFlowLabel(exitFlow)
 * }
 */
export function Binder_bindInitializer(receiver: GoPtr<Binder>, node: GoPtr<Node>): void {
  if (node === undefined) {
    return;
  }
  const entryFlow = receiver!.currentFlow;
  Binder_bind(receiver, node);
  if (entryFlow === receiver!.unreachableFlow || entryFlow === receiver!.currentFlow) {
    return;
  }
  const exitFlow = Binder_createBranchLabel(receiver);
  Binder_addAntecedent(receiver, exitFlow!, entryFlow!);
  Binder_addAntecedent(receiver, exitFlow!, receiver!.currentFlow!);
  receiver!.currentFlow = Binder_finishFlowLabel(receiver, exitFlow);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::setFlowNode","kind":"func","status":"implemented","sigHash":"419497b1b40ef89e848e669f459a8167afffaefad03726304863bb1c41da067d","bodyHash":"9245d745151a491d5d4ad6d433541b4c3e54a8f846b989b38df7093af1b922f9"}
 *
 * Go source:
 * func setFlowNode(node *ast.Node, flowNode *ast.FlowNode) {
 * 	data := node.FlowNodeData()
 * 	if data != nil {
 * 		data.FlowNode = flowNode
 * 	}
 * }
 */
export function setFlowNode(node: GoPtr<Node>, flowNode: GoPtr<FlowNode>): void {
  const data = Node_FlowNodeData(node);
  if (data !== undefined) {
    (data as unknown as { FlowNode?: GoPtr<FlowNode> }).FlowNode = flowNode;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::setReturnFlowNode","kind":"func","status":"implemented","sigHash":"26b0a3a8b77c7ab5aace20bcfe80ea88b35dc7b51355b59868a94e0a4538de1a","bodyHash":"2d440df1fd042f6b76cc95db50af2737b82cb277433002f4c69d8129c85890d2"}
 *
 * Go source:
 * func setReturnFlowNode(node *ast.Node, returnFlowNode *ast.FlowNode) {
 * 	switch node.Kind {
 * 	case ast.KindConstructor:
 * 		node.AsConstructorDeclaration().ReturnFlowNode = returnFlowNode
 * 	case ast.KindFunctionDeclaration:
 * 		node.AsFunctionDeclaration().ReturnFlowNode = returnFlowNode
 * 	case ast.KindFunctionExpression:
 * 		node.AsFunctionExpression().ReturnFlowNode = returnFlowNode
 * 	case ast.KindClassStaticBlockDeclaration:
 * 		node.AsClassStaticBlockDeclaration().ReturnFlowNode = returnFlowNode
 * 	}
 * }
 */
export function setReturnFlowNode(node: GoPtr<Node>, returnFlowNode: GoPtr<FlowNode>): void {
  switch (node!.Kind) {
    case KindConstructor:
      (AsConstructorDeclaration(node) as unknown as Record<string, GoPtr<FlowNode>>)["ReturnFlowNode"] = returnFlowNode;
      break;
    case KindFunctionDeclaration:
      (AsFunctionDeclaration(node) as unknown as Record<string, GoPtr<FlowNode>>)["ReturnFlowNode"] = returnFlowNode;
      break;
    case KindFunctionExpression:
      (AsFunctionExpression(node) as unknown as Record<string, GoPtr<FlowNode>>)["ReturnFlowNode"] = returnFlowNode;
      break;
    case KindClassStaticBlockDeclaration:
      (AsClassStaticBlockDeclaration(node) as unknown as Record<string, GoPtr<FlowNode>>)["ReturnFlowNode"] = returnFlowNode;
      break;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isGeneratorFunctionExpression","kind":"func","status":"implemented","sigHash":"f4b5319a73d66a4b22744cadebffef490f1d820f454b93b2964f03965a333262","bodyHash":"0bee2743d7073c10af13e89b84e1b7d7848f2340d3b1f27b6fe6785a6754ef29"}
 *
 * Go source:
 * func isGeneratorFunctionExpression(node *ast.Node) bool {
 * 	return ast.IsFunctionExpression(node) && node.AsFunctionExpression().AsteriskToken != nil
 * }
 */
export function isGeneratorFunctionExpression(node: GoPtr<Node>): bool {
  return (IsFunctionExpression(node) && AsFunctionExpression(node)!.AsteriskToken !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.addToContainerChain","kind":"method","status":"implemented","sigHash":"aeb651d5647a658340b4a7dd4beb516279d51d60e7907f1993fdf4a0cf5344df","bodyHash":"8eaca857699108b0d6c1d295645872fe7ec8cdcd86253de88bd8982c2f4a26ee"}
 *
 * Go source:
 * func (b *Binder) addToContainerChain(next *ast.Node) {
 * 	if b.lastContainer != nil {
 * 		b.lastContainer.LocalsContainerData().NextContainer = next
 * 	}
 * 	b.lastContainer = next
 * }
 */
export function Binder_addToContainerChain(receiver: GoPtr<Binder>, next: GoPtr<Node>): void {
  if (receiver!.lastContainer !== undefined) {
    (Node_LocalsContainerData(receiver!.lastContainer) as unknown as { NextContainer?: GoPtr<Node> })!.NextContainer = next;
  }
  receiver!.lastContainer = next;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.addDeclarationToSymbol","kind":"method","status":"implemented","sigHash":"ffc46cf8f996d846ddb045dcdc1dae5ca52203ab5e348d041ebf8cac53e07e7a","bodyHash":"2fe420510ccb963c97afb2178df44984804acd81cc6cdd4ebe7efa4c6c22c3fd"}
 *
 * Go source:
 * func (b *Binder) addDeclarationToSymbol(symbol *ast.Symbol, node *ast.Node, symbolFlags ast.SymbolFlags) {
 * 	symbol.Flags |= symbolFlags
 * 	node.DeclarationData().Symbol = symbol
 * 	if symbol.Declarations == nil {
 * 		symbol.Declarations = b.newSingleDeclaration(node)
 * 	} else {
 * 		symbol.Declarations = core.AppendIfUnique(symbol.Declarations, node)
 * 	}
 * 	// On merge of const enum module with class or function, reset const enum only flag (namespaces will already recalculate)
 * 	if symbol.Flags&ast.SymbolFlagsConstEnumOnlyModule != 0 && symbol.Flags&(ast.SymbolFlagsFunction|ast.SymbolFlagsClass|ast.SymbolFlagsRegularEnum) != 0 {
 * 		symbol.Flags &^= ast.SymbolFlagsConstEnumOnlyModule
 * 		b.notConstEnumOnlyModules.Add(symbol)
 * 	}
 * 	if symbolFlags&ast.SymbolFlagsValue != 0 {
 * 		SetValueDeclaration(symbol, node)
 * 	}
 * }
 */
export function Binder_addDeclarationToSymbol(receiver: GoPtr<Binder>, symbol_: GoPtr<Symbol>, node: GoPtr<Node>, symbolFlags: SymbolFlags): void {
  symbol_!.Flags = (symbol_!.Flags | symbolFlags) as SymbolFlags;
  (Node_DeclarationData(node) as unknown as { Symbol?: GoPtr<Symbol> })!.Symbol = symbol_;
  if (symbol_!.Declarations === undefined || symbol_!.Declarations.length === 0) {
    symbol_!.Declarations = Binder_newSingleDeclaration(receiver, node);
  } else {
    symbol_!.Declarations = AppendIfUnique(symbol_!.Declarations, node);
  }
  if ((symbol_!.Flags & SymbolFlagsConstEnumOnlyModule) !== 0 && (symbol_!.Flags & (SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsRegularEnum)) !== 0) {
    symbol_!.Flags = (symbol_!.Flags & ~SymbolFlagsConstEnumOnlyModule) as SymbolFlags;
    Set_Add(receiver!.notConstEnumOnlyModules, symbol_!);
  }
  if ((symbolFlags & SymbolFlagsValue) !== 0) {
    SetValueDeclaration(symbol_, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::SetValueDeclaration","kind":"func","status":"implemented","sigHash":"76c19ed95fed43864f40f066cced2492eefbb61f21926ce28ee98c95070eeae3","bodyHash":"dcd898a0906bd98b9d5f648fa97d449da0a76e7e674ceafa323c7f2dd82574a6"}
 *
 * Go source:
 * func SetValueDeclaration(symbol *ast.Symbol, node *ast.Node) {
 * 	valueDeclaration := symbol.ValueDeclaration
 * 	if valueDeclaration == nil ||
 * 		isAssignmentDeclaration(valueDeclaration) && !isAssignmentDeclaration(node) ||
 * 		valueDeclaration.Kind != node.Kind && isEffectiveModuleDeclaration(valueDeclaration) {
 * 		// Non-assignment declarations take precedence over assignment declarations and
 * 		// non-namespace declarations take precedence over namespace declarations.
 * 		symbol.ValueDeclaration = node
 * 	}
 * }
 */
export function SetValueDeclaration(symbol_: GoPtr<Symbol>, node: GoPtr<Node>): void {
  const valueDeclaration = symbol_!.ValueDeclaration;
  if (
    valueDeclaration === undefined ||
    (isAssignmentDeclaration(valueDeclaration) && !isAssignmentDeclaration(node)) ||
    (valueDeclaration!.Kind !== node!.Kind && isEffectiveModuleDeclaration(valueDeclaration))
  ) {
    // Non-assignment declarations take precedence over assignment declarations and
    // non-namespace declarations take precedence over namespace declarations.
    symbol_!.ValueDeclaration = node;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::GetContainerFlags","kind":"func","status":"implemented","sigHash":"3bd8de19948e1fbb658e69534b380dcf80fb3605a8d36cf9f34d044b73beabe3","bodyHash":"8bbb84fd065e1fc99a704b4cf5e9e29b04645caea7669b04ca835ea307f9a123"}
 *
 * Go source:
 * func GetContainerFlags(node *ast.Node) ContainerFlags {
 * 	switch node.Kind {
 * 	case ast.KindClassExpression, ast.KindClassDeclaration, ast.KindEnumDeclaration, ast.KindObjectLiteralExpression, ast.KindTypeLiteral,
 * 		ast.KindJsxAttributes:
 * 		return ContainerFlagsIsContainer
 * 	case ast.KindInterfaceDeclaration:
 * 		return ContainerFlagsIsContainer | ContainerFlagsIsInterface
 * 	case ast.KindModuleDeclaration, ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration, ast.KindMappedType, ast.KindIndexSignature:
 * 		return ContainerFlagsIsContainer | ContainerFlagsHasLocals
 * 	case ast.KindSourceFile:
 * 		return ContainerFlagsIsContainer | ContainerFlagsIsControlFlowContainer | ContainerFlagsHasLocals
 * 	case ast.KindGetAccessor, ast.KindSetAccessor, ast.KindMethodDeclaration:
 * 		if ast.IsObjectLiteralOrClassExpressionMethodOrAccessor(node) {
 * 			return ContainerFlagsIsContainer | ContainerFlagsIsControlFlowContainer | ContainerFlagsHasLocals | ContainerFlagsIsFunctionLike | ContainerFlagsIsObjectLiteralOrClassExpressionMethodOrAccessor | ContainerFlagsIsThisContainer
 * 		}
 * 		fallthrough
 * 	case ast.KindConstructor, ast.KindFunctionDeclaration, ast.KindClassStaticBlockDeclaration:
 * 		return ContainerFlagsIsContainer | ContainerFlagsIsControlFlowContainer | ContainerFlagsHasLocals | ContainerFlagsIsFunctionLike | ContainerFlagsIsThisContainer
 * 	case ast.KindMethodSignature, ast.KindCallSignature, ast.KindFunctionType, ast.KindConstructSignature, ast.KindConstructorType:
 * 		return ContainerFlagsIsContainer | ContainerFlagsIsControlFlowContainer | ContainerFlagsHasLocals | ContainerFlagsIsFunctionLike | ContainerFlagsPropagatesThisKeyword
 * 	case ast.KindFunctionExpression:
 * 		return ContainerFlagsIsContainer | ContainerFlagsIsControlFlowContainer | ContainerFlagsHasLocals | ContainerFlagsIsFunctionLike | ContainerFlagsIsFunctionExpression | ContainerFlagsIsThisContainer
 * 	case ast.KindArrowFunction:
 * 		return ContainerFlagsIsContainer | ContainerFlagsIsControlFlowContainer | ContainerFlagsHasLocals | ContainerFlagsIsFunctionLike | ContainerFlagsIsFunctionExpression | ContainerFlagsPropagatesThisKeyword
 * 	case ast.KindModuleBlock:
 * 		return ContainerFlagsIsControlFlowContainer
 * 	case ast.KindPropertyDeclaration:
 * 		if node.Initializer() != nil {
 * 			return ContainerFlagsIsControlFlowContainer | ContainerFlagsIsThisContainer
 * 		} else {
 * 			return ContainerFlagsNone
 * 		}
 * 	case ast.KindCatchClause, ast.KindForStatement, ast.KindForInStatement, ast.KindForOfStatement, ast.KindCaseBlock:
 * 		return ContainerFlagsIsBlockScopedContainer | ContainerFlagsHasLocals
 * 	case ast.KindBlock:
 * 		if ast.IsFunctionLike(node.Parent) || ast.IsClassStaticBlockDeclaration(node.Parent) {
 * 			return ContainerFlagsNone
 * 		} else {
 * 			return ContainerFlagsIsBlockScopedContainer | ContainerFlagsHasLocals
 * 		}
 * 	}
 * 	return ContainerFlagsNone
 * }
 */
export function GetContainerFlags(node: GoPtr<Node>): ContainerFlags {
  switch (node!.Kind) {
    case KindClassExpression:
    case KindClassDeclaration:
    case KindEnumDeclaration:
    case KindObjectLiteralExpression:
    case KindTypeLiteral:
    case KindJsxAttributes:
      return ContainerFlagsIsContainer;
    case KindInterfaceDeclaration:
      return (ContainerFlagsIsContainer | ContainerFlagsIsInterface) as ContainerFlags;
    case KindModuleDeclaration:
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
    case KindMappedType:
    case KindIndexSignature:
      return (ContainerFlagsIsContainer | ContainerFlagsHasLocals) as ContainerFlags;
    case KindSourceFile:
      return (ContainerFlagsIsContainer | ContainerFlagsIsControlFlowContainer | ContainerFlagsHasLocals) as ContainerFlags;
    case KindGetAccessor:
    case KindSetAccessor:
    case KindMethodDeclaration:
      if (IsObjectLiteralOrClassExpressionMethodOrAccessor(node)) {
        return (ContainerFlagsIsContainer | ContainerFlagsIsControlFlowContainer | ContainerFlagsHasLocals | ContainerFlagsIsFunctionLike | ContainerFlagsIsObjectLiteralOrClassExpressionMethodOrAccessor | ContainerFlagsIsThisContainer) as ContainerFlags;
      }
    // fallthrough
    case KindConstructor:
    case KindFunctionDeclaration:
    case KindClassStaticBlockDeclaration:
      return (ContainerFlagsIsContainer | ContainerFlagsIsControlFlowContainer | ContainerFlagsHasLocals | ContainerFlagsIsFunctionLike | ContainerFlagsIsThisContainer) as ContainerFlags;
    case KindMethodSignature:
    case KindCallSignature:
    case KindFunctionType:
    case KindConstructSignature:
    case KindConstructorType:
      return (ContainerFlagsIsContainer | ContainerFlagsIsControlFlowContainer | ContainerFlagsHasLocals | ContainerFlagsIsFunctionLike | ContainerFlagsPropagatesThisKeyword) as ContainerFlags;
    case KindFunctionExpression:
      return (ContainerFlagsIsContainer | ContainerFlagsIsControlFlowContainer | ContainerFlagsHasLocals | ContainerFlagsIsFunctionLike | ContainerFlagsIsFunctionExpression | ContainerFlagsIsThisContainer) as ContainerFlags;
    case KindArrowFunction:
      return (ContainerFlagsIsContainer | ContainerFlagsIsControlFlowContainer | ContainerFlagsHasLocals | ContainerFlagsIsFunctionLike | ContainerFlagsIsFunctionExpression | ContainerFlagsPropagatesThisKeyword) as ContainerFlags;
    case KindModuleBlock:
      return ContainerFlagsIsControlFlowContainer;
    case KindPropertyDeclaration:
      if (Node_Initializer(node) !== undefined) {
        return (ContainerFlagsIsControlFlowContainer | ContainerFlagsIsThisContainer) as ContainerFlags;
      } else {
        return ContainerFlagsNone;
      }
    case KindCatchClause:
    case KindForStatement:
    case KindForInStatement:
    case KindForOfStatement:
    case KindCaseBlock:
      return (ContainerFlagsIsBlockScopedContainer | ContainerFlagsHasLocals) as ContainerFlags;
    case KindBlock:
      if (IsFunctionLike(node!.Parent) || IsClassStaticBlockDeclaration(node!.Parent)) {
        return ContainerFlagsNone;
      } else {
        return (ContainerFlagsIsBlockScopedContainer | ContainerFlagsHasLocals) as ContainerFlags;
      }
  }
  return ContainerFlagsNone;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isNarrowingExpression","kind":"func","status":"implemented","sigHash":"3cec27f4ffe1c974576cccd994dbf6139df50c9c7541f03cd5dd287c7848a578","bodyHash":"5aac37b89ba99622f37ed4ef6eed58670ae1fb9b263f6ab95b10620d411bdffe"}
 *
 * Go source:
 * func isNarrowingExpression(expr *ast.Node) bool {
 * 	switch expr.Kind {
 * 	case ast.KindIdentifier, ast.KindThisKeyword:
 * 		return true
 * 	case ast.KindPropertyAccessExpression, ast.KindElementAccessExpression:
 * 		return containsNarrowableReference(expr)
 * 	case ast.KindCallExpression:
 * 		return hasNarrowableArgument(expr)
 * 	case ast.KindParenthesizedExpression, ast.KindNonNullExpression, ast.KindTypeOfExpression:
 * 		return isNarrowingExpression(expr.Expression())
 * 	case ast.KindBinaryExpression:
 * 		return isNarrowingBinaryExpression(expr.AsBinaryExpression())
 * 	case ast.KindPrefixUnaryExpression:
 * 		return expr.AsPrefixUnaryExpression().Operator == ast.KindExclamationToken && isNarrowingExpression(expr.AsPrefixUnaryExpression().Operand)
 * 	}
 * 	return false
 * }
 */
export function isNarrowingExpression(expr: GoPtr<Node>): bool {
  switch (expr!.Kind) {
    case KindIdentifier:
    case KindThisKeyword:
      return true as bool;
    case KindPropertyAccessExpression:
    case KindElementAccessExpression:
      return containsNarrowableReference(expr);
    case KindCallExpression:
      return hasNarrowableArgument(expr);
    case KindParenthesizedExpression:
    case KindNonNullExpression:
    case KindTypeOfExpression:
      return isNarrowingExpression(Node_Expression(expr));
    case KindBinaryExpression:
      return isNarrowingBinaryExpression(AsBinaryExpression(expr));
    case KindPrefixUnaryExpression:
      return (AsPrefixUnaryExpression(expr)!.Operator === KindExclamationToken && isNarrowingExpression(AsPrefixUnaryExpression(expr)!.Operand)) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::containsNarrowableReference","kind":"func","status":"implemented","sigHash":"6ed4664940a1bf1247b509f4a8d7403d05d08a8cd45951e702c3746f44dec76e","bodyHash":"9d472cf852e76f23df50d1867d0416c5d58117c6d677e01443d4da8ce9f67319"}
 *
 * Go source:
 * func containsNarrowableReference(expr *ast.Node) bool {
 * 	if isNarrowableReference(expr) {
 * 		return true
 * 	}
 * 	if expr.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 		switch expr.Kind {
 * 		case ast.KindPropertyAccessExpression, ast.KindElementAccessExpression, ast.KindCallExpression, ast.KindNonNullExpression:
 * 			return containsNarrowableReference(expr.Expression())
 * 		}
 * 	}
 * 	return false
 * }
 */
export function containsNarrowableReference(expr: GoPtr<Node>): bool {
  if (isNarrowableReference(expr)) {
    return true as bool;
  }
  if ((expr!.Flags & NodeFlagsOptionalChain) !== 0) {
    switch (expr!.Kind) {
      case KindPropertyAccessExpression:
      case KindElementAccessExpression:
      case KindCallExpression:
      case KindNonNullExpression:
        return containsNarrowableReference(Node_Expression(expr));
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isNarrowableReference","kind":"func","status":"implemented","sigHash":"6f8e2147c0dbf95e3e6050125e0fea1b3a45956a3901ae51b71d2f89e4eb528a","bodyHash":"4e718fdd1b9b4edb1a6c88560c7fe567a7612d2eb35927416ba46a01f9afbaf0"}
 *
 * Go source:
 * func isNarrowableReference(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindIdentifier, ast.KindThisKeyword, ast.KindSuperKeyword, ast.KindMetaProperty:
 * 		return true
 * 	case ast.KindPropertyAccessExpression, ast.KindParenthesizedExpression, ast.KindNonNullExpression:
 * 		return isNarrowableReference(node.Expression())
 * 	case ast.KindElementAccessExpression:
 * 		expr := node.AsElementAccessExpression()
 * 		return ast.IsStringOrNumericLiteralLike(expr.ArgumentExpression) ||
 * 			ast.IsEntityNameExpression(expr.ArgumentExpression) && isNarrowableReference(expr.Expression)
 * 	case ast.KindBinaryExpression:
 * 		expr := node.AsBinaryExpression()
 * 		return expr.OperatorToken.Kind == ast.KindCommaToken && isNarrowableReference(expr.Right) ||
 * 			ast.IsAssignmentOperator(expr.OperatorToken.Kind) && ast.IsLeftHandSideExpression(expr.Left)
 * 	}
 * 	return false
 * }
 */
export function isNarrowableReference(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindIdentifier:
    case KindThisKeyword:
    case KindSuperKeyword:
    case KindMetaProperty:
      return true as bool;
    case KindPropertyAccessExpression:
    case KindParenthesizedExpression:
    case KindNonNullExpression:
      return isNarrowableReference(Node_Expression(node));
    case KindElementAccessExpression: {
      const expr = AsElementAccessExpression(node);
      return (IsStringOrNumericLiteralLike(expr!.ArgumentExpression) ||
        (IsEntityNameExpression(expr!.ArgumentExpression) && isNarrowableReference(expr!.Expression))) as bool;
    }
    case KindBinaryExpression: {
      const expr = AsBinaryExpression(node);
      return ((expr!.OperatorToken!.Kind === KindCommaToken && isNarrowableReference(expr!.Right)) ||
        (IsAssignmentOperator(expr!.OperatorToken!.Kind) && IsLeftHandSideExpression(expr!.Left))) as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::hasNarrowableArgument","kind":"func","status":"implemented","sigHash":"6751f18833472cef7d21f486b7625f50bf5d2906267a42bbd4d50ac43fb2c26c","bodyHash":"b43a6ecf8b6b47531df769cebb00b4ce75cb408d2a40b39c96d96d3acfd3e909"}
 *
 * Go source:
 * func hasNarrowableArgument(expr *ast.Node) bool {
 * 	call := expr.AsCallExpression()
 * 	for _, argument := range call.Arguments.Nodes { //nolint:modernize
 * 		if containsNarrowableReference(argument) {
 * 			return true
 * 		}
 * 	}
 * 	if ast.IsPropertyAccessExpression(call.Expression) {
 * 		if containsNarrowableReference(call.Expression.Expression()) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function hasNarrowableArgument(expr: GoPtr<Node>): bool {
  const call = AsCallExpression(expr);
  for (const argument of call!.Arguments!.Nodes) {
    if (containsNarrowableReference(argument)) {
      return true as bool;
    }
  }
  if (IsPropertyAccessExpression(call!.Expression)) {
    if (containsNarrowableReference(Node_Expression(call!.Expression))) {
      return true as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isNarrowingBinaryExpression","kind":"func","status":"implemented","sigHash":"eeafb7f59d924e6116f3fc6192f9d3672f552ff8d37ab0dd64ed7695a31182be","bodyHash":"7cb3924915703a8556cff1e5ea73f2fd03aaff32a76d6d9bf476cf8a722a547a"}
 *
 * Go source:
 * func isNarrowingBinaryExpression(expr *ast.BinaryExpression) bool {
 * 	switch expr.OperatorToken.Kind {
 * 	case ast.KindEqualsToken, ast.KindBarBarEqualsToken, ast.KindAmpersandAmpersandEqualsToken, ast.KindQuestionQuestionEqualsToken:
 * 		return containsNarrowableReference(expr.Left)
 * 	case ast.KindEqualsEqualsToken, ast.KindExclamationEqualsToken, ast.KindEqualsEqualsEqualsToken, ast.KindExclamationEqualsEqualsToken:
 * 		left := ast.SkipParentheses(expr.Left)
 * 		right := ast.SkipParentheses(expr.Right)
 * 		return isNarrowableOperand(left) || isNarrowableOperand(right) ||
 * 			isNarrowingTypeOfOperands(right, left) || isNarrowingTypeOfOperands(left, right) ||
 * 			(ast.IsBooleanLiteral(right) && isNarrowingExpression(left) || ast.IsBooleanLiteral(left) && isNarrowingExpression(right))
 * 	case ast.KindInstanceOfKeyword:
 * 		return isNarrowableOperand(expr.Left)
 * 	case ast.KindInKeyword:
 * 		return isNarrowingExpression(expr.Right)
 * 	case ast.KindCommaToken:
 * 		return isNarrowingExpression(expr.Right)
 * 	}
 * 	return false
 * }
 */
export function isNarrowingBinaryExpression(expr: GoPtr<BinaryExpression>): bool {
  switch (expr!.OperatorToken!.Kind) {
    case KindEqualsToken:
    case KindBarBarEqualsToken:
    case KindAmpersandAmpersandEqualsToken:
    case KindQuestionQuestionEqualsToken:
      return containsNarrowableReference(expr!.Left);
    case KindEqualsEqualsToken:
    case KindExclamationEqualsToken:
    case KindEqualsEqualsEqualsToken:
    case KindExclamationEqualsEqualsToken: {
      const left = SkipParentheses(expr!.Left);
      const right = SkipParentheses(expr!.Right);
      return (isNarrowableOperand(left) || isNarrowableOperand(right) ||
        isNarrowingTypeOfOperands(right, left) || isNarrowingTypeOfOperands(left, right) ||
        ((IsBooleanLiteral(right) && isNarrowingExpression(left)) || (IsBooleanLiteral(left) && isNarrowingExpression(right)))) as bool;
    }
    case KindInstanceOfKeyword:
      return isNarrowableOperand(expr!.Left);
    case KindInKeyword:
      return isNarrowingExpression(expr!.Right);
    case KindCommaToken:
      return isNarrowingExpression(expr!.Right);
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isNarrowableOperand","kind":"func","status":"implemented","sigHash":"63495a6ffbcfea7a9846a14920885c50ce0d455b7adfd7ef79ddaf014994ec17","bodyHash":"c793f74a3cdeb1f0c16c0db42d671b5d8aab2abef2680651c158c7b462c1e97d"}
 *
 * Go source:
 * func isNarrowableOperand(expr *ast.Node) bool {
 * 	switch expr.Kind {
 * 	case ast.KindParenthesizedExpression:
 * 		return isNarrowableOperand(expr.Expression())
 * 	case ast.KindBinaryExpression:
 * 		binary := expr.AsBinaryExpression()
 * 		switch binary.OperatorToken.Kind {
 * 		case ast.KindEqualsToken:
 * 			return isNarrowableOperand(binary.Left)
 * 		case ast.KindCommaToken:
 * 			return isNarrowableOperand(binary.Right)
 * 		}
 * 	}
 * 	return containsNarrowableReference(expr)
 * }
 */
export function isNarrowableOperand(expr: GoPtr<Node>): bool {
  switch (expr!.Kind) {
    case KindParenthesizedExpression:
      return isNarrowableOperand(Node_Expression(expr));
    case KindBinaryExpression: {
      const binary = AsBinaryExpression(expr);
      switch (binary!.OperatorToken!.Kind) {
        case KindEqualsToken:
          return isNarrowableOperand(binary!.Left);
        case KindCommaToken:
          return isNarrowableOperand(binary!.Right);
      }
    }
  }
  return containsNarrowableReference(expr);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isNarrowingTypeOfOperands","kind":"func","status":"implemented","sigHash":"86a5cc66332dd58f8517dc6e58b508f155062214b7fb1ab7bfdabbfad85aff1f","bodyHash":"85e0fd1fa7da69d0987da7839f693ff764c76340fdda52a41ac251c9dfe1305d"}
 *
 * Go source:
 * func isNarrowingTypeOfOperands(expr1 *ast.Node, expr2 *ast.Node) bool {
 * 	return ast.IsTypeOfExpression(expr1) && isNarrowableOperand(expr1.Expression()) && ast.IsStringLiteralLike(expr2)
 * }
 */
export function isNarrowingTypeOfOperands(expr1: GoPtr<Node>, expr2: GoPtr<Node>): bool {
  return (IsTypeOfExpression(expr1) && isNarrowableOperand(Node_Expression(expr1)) && IsStringLiteralLike(expr2)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.errorOnNode","kind":"method","status":"implemented","sigHash":"b7b0ff8329316a87986f41f54ef58df8094faf41b8c8364b11e5431513fcd90c","bodyHash":"3b39f0f77cdea29c23f7344b309748184bbc50dcddd091d7dc3821f6f701c338"}
 *
 * Go source:
 * func (b *Binder) errorOnNode(node *ast.Node, message *diagnostics.Message, args ...any) {
 * 	b.addDiagnostic(b.createDiagnosticForNode(node, message, args...))
 * }
 */
export function Binder_errorOnNode(receiver: GoPtr<Binder>, node: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): void {
  Binder_addDiagnostic(receiver, Binder_createDiagnosticForNode(receiver, node, message, ...args));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.errorOnFirstToken","kind":"method","status":"implemented","sigHash":"c5568a08be182adc380e729d7e1167a8c32a14e23776df1a26f667a9be2c8e89","bodyHash":"60a7a1e0f89f4364b9aad4b37fc1afd147557711726eb5d8a48c850ecb7663d5"}
 *
 * Go source:
 * func (b *Binder) errorOnFirstToken(node *ast.Node, message *diagnostics.Message, args ...any) {
 * 	span := scanner.GetRangeOfTokenAtPosition(b.file, node.Pos())
 * 	b.addDiagnostic(ast.NewDiagnostic(b.file, span, message, args...))
 * }
 */
export function Binder_errorOnFirstToken(receiver: GoPtr<Binder>, node: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): void {
  const span = GetRangeOfTokenAtPosition(receiver!.file, Node_Pos(node));
  Binder_addDiagnostic(receiver, NewDiagnostic(receiver!.file, span, message, ...args));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.errorOrSuggestionOnNode","kind":"method","status":"implemented","sigHash":"a5f0a683c54d8b2a0885e9840b4f6f923a7b57339c3b37b7369120e2f97dca05","bodyHash":"090a7e9fc27bee2fcc74bc7f068de9a8195140f63c03413a0e1ff51c554f0ea1"}
 *
 * Go source:
 * func (b *Binder) errorOrSuggestionOnNode(isError bool, node *ast.Node, message *diagnostics.Message) {
 * 	b.errorOrSuggestionOnRange(isError, node, node, message)
 * }
 */
export function Binder_errorOrSuggestionOnNode(receiver: GoPtr<Binder>, isError: bool, node: GoPtr<Node>, message: GoPtr<Message>): void {
  Binder_errorOrSuggestionOnRange(receiver, isError, node, node, message);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.errorOrSuggestionOnRange","kind":"method","status":"implemented","sigHash":"5e7695553167b2073f0d7bd6050cab4c26fcb8f0d806d6f6419182cf379066ac","bodyHash":"0879c71dde54a0ebbf343212cd62c1918cff35733821395a0f5fcf823973d2c8"}
 *
 * Go source:
 * func (b *Binder) errorOrSuggestionOnRange(isError bool, startNode *ast.Node, endNode *ast.Node, message *diagnostics.Message) {
 * 	textRange := core.NewTextRange(scanner.GetRangeOfTokenAtPosition(b.file, startNode.Pos()).Pos(), endNode.End())
 * 	diagnostic := ast.NewDiagnostic(b.file, textRange, message)
 * 	if isError {
 * 		b.addDiagnostic(diagnostic)
 * 	} else {
 * 		diagnostic.SetCategory(diagnostics.CategorySuggestion)
 * 		b.file.BindSuggestionDiagnostics = append(b.file.BindSuggestionDiagnostics, diagnostic)
 * 	}
 * }
 */
export function Binder_errorOrSuggestionOnRange(receiver: GoPtr<Binder>, isError: bool, startNode: GoPtr<Node>, endNode: GoPtr<Node>, message: GoPtr<Message>): void {
  const textRange = NewTextRange(GetRangeOfTokenAtPosition(receiver!.file, Node_Pos(startNode)).pos, Node_End(endNode));
  const diagnostic = NewDiagnostic(receiver!.file, textRange, message);
  if (isError) {
    Binder_addDiagnostic(receiver, diagnostic);
  } else {
    Diagnostic_SetCategory(diagnostic, CategorySuggestion);
    receiver!.file!.BindSuggestionDiagnostics = [...(receiver!.file!.BindSuggestionDiagnostics ?? []), diagnostic!];
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.createDiagnosticForNode","kind":"method","status":"implemented","sigHash":"be85cc82e5b14722f1e83845bb8c24d6aa1e627d3c3e994e13a17a16d4ef389a","bodyHash":"7f73e4aa41dcfa2d6da06b1974ff94ccb88620e7f0b3004cbde6936e7dd03e3c"}
 *
 * Go source:
 * func (b *Binder) createDiagnosticForNode(node *ast.Node, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 	return ast.NewDiagnostic(b.file, scanner.GetErrorRangeForNode(b.file, node), message, args...)
 * }
 */
export function Binder_createDiagnosticForNode(receiver: GoPtr<Binder>, node: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic> {
  return NewDiagnostic(receiver!.file, GetErrorRangeForNode(receiver!.file, node), message, ...args);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::method::Binder.addDiagnostic","kind":"method","status":"implemented","sigHash":"7064aa562deac7284b3fdc4fd7b7639e62d84f20f61033e68cdebf513eb5ed10","bodyHash":"34b77a751428e3861100eb9ee585e4c3abfbf0ab71d08e47173fa47982eeef46"}
 *
 * Go source:
 * func (b *Binder) addDiagnostic(diagnostic *ast.Diagnostic) {
 * 	b.file.SetBindDiagnostics(append(b.file.BindDiagnostics(), diagnostic))
 * }
 */
export function Binder_addDiagnostic(receiver: GoPtr<Binder>, diagnostic: GoPtr<Diagnostic>): void {
  SourceFile_SetBindDiagnostics(receiver!.file, [...SourceFile_BindDiagnostics(receiver!.file)!, diagnostic!]);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isSignedNumericLiteral","kind":"func","status":"implemented","sigHash":"95340c6d23fc5ebb7934a750a51111a3aed736ef7f65e5f8458031a6b3fe39f6","bodyHash":"527e53c4df2f9a9ec1c8eff36e9f676232b616cdeaa11b452dc554cccd10ac90"}
 *
 * Go source:
 * func isSignedNumericLiteral(node *ast.Node) bool {
 * 	if node.Kind == ast.KindPrefixUnaryExpression {
 * 		node := node.AsPrefixUnaryExpression()
 * 		return (node.Operator == ast.KindPlusToken || node.Operator == ast.KindMinusToken) && ast.IsNumericLiteral(node.Operand)
 * 	}
 * 	return false
 * }
 */
export function isSignedNumericLiteral(node: GoPtr<Node>): bool {
  if (node!.Kind === KindPrefixUnaryExpression) {
    const unary = AsPrefixUnaryExpression(node);
    return ((unary!.Operator === KindPlusToken || unary!.Operator === KindMinusToken) && IsNumericLiteral(unary!.Operand)) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::getOptionalSymbolFlagForNode","kind":"func","status":"implemented","sigHash":"0f2b9a3c292c93dd331e0fb74aad2c38e4ff25a6b04d97adfcecd6a9eca95101","bodyHash":"a3b2947d3b6b6a979732810b47cb660159981b35c32230d999c43d057c7fe0ad"}
 *
 * Go source:
 * func getOptionalSymbolFlagForNode(node *ast.Node) ast.SymbolFlags {
 * 	postfixToken := node.PostfixToken()
 * 	return core.IfElse(postfixToken != nil && postfixToken.Kind == ast.KindQuestionToken, ast.SymbolFlagsOptional, ast.SymbolFlagsNone)
 * }
 */
export function getOptionalSymbolFlagForNode(node: GoPtr<Node>): SymbolFlags {
  const postfixToken = Node_PostfixToken(node);
  return IfElse(
    (postfixToken !== undefined && postfixToken!.Kind === KindQuestionToken) as bool,
    SymbolFlagsOptional,
    SymbolFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isFunctionSymbol","kind":"func","status":"implemented","sigHash":"7da02a4539dada1c29da221edc08b00785ca3c01175c4749c82ed0f9299a216d","bodyHash":"c82c2d3790511d9e91a71d8a0b105504a1b77a458efd475ed6549286e25268cd"}
 *
 * Go source:
 * func isFunctionSymbol(symbol *ast.Symbol) bool {
 * 	d := symbol.ValueDeclaration
 * 	if d != nil {
 * 		if ast.IsFunctionDeclaration(d) {
 * 			return true
 * 		}
 * 		if ast.IsVariableDeclaration(d) {
 * 			varDecl := d.AsVariableDeclaration()
 * 			if varDecl.Initializer != nil {
 * 				return ast.IsFunctionLike(varDecl.Initializer)
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function isFunctionSymbol(symbol_: GoPtr<Symbol>): bool {
  const d = symbol_!.ValueDeclaration;
  if (d !== undefined) {
    if (IsFunctionDeclaration(d)) {
      return true as bool;
    }
    if (IsVariableDeclaration(d)) {
      const varDecl = AsVariableDeclaration(d);
      if (varDecl!.Initializer !== undefined) {
        return IsFunctionLike(varDecl!.Initializer);
      }
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isStatementCondition","kind":"func","status":"implemented","sigHash":"879ba42fe044e4105ef36343e7891740de43d63c2374e5176cc1e6f75d88bb0f","bodyHash":"73524429af2b2fde4de4fd8766ec0d54001bc7b326307b92b7bb6354d7900de5"}
 *
 * Go source:
 * func isStatementCondition(node *ast.Node) bool {
 * 	switch node.Parent.Kind {
 * 	case ast.KindIfStatement, ast.KindWhileStatement, ast.KindDoStatement:
 * 		return node.Parent.Expression() == node
 * 	case ast.KindForStatement:
 * 		return node.Parent.AsForStatement().Condition == node
 * 	case ast.KindConditionalExpression:
 * 		return node.Parent.AsConditionalExpression().Condition == node
 * 	}
 * 	return false
 * }
 */
export function isStatementCondition(node: GoPtr<Node>): bool {
  switch (node!.Parent!.Kind) {
    case KindIfStatement:
    case KindWhileStatement:
    case KindDoStatement:
      return (Node_Expression(node!.Parent) === node) as bool;
    case KindForStatement:
      return (AsForStatement(node!.Parent)!.Condition === node) as bool;
    case KindConditionalExpression:
      return (AsConditionalExpression(node!.Parent)!.Condition === node) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isTopLevelLogicalExpression","kind":"func","status":"implemented","sigHash":"daad993da162f7c10e7be23cee8c8d76144133c2b75117b85f8fb11ffebed394","bodyHash":"ef763ed5021e912aa7392394f4e22896c4ffdf0eba817fbcad0b974a0a8c17f1"}
 *
 * Go source:
 * func isTopLevelLogicalExpression(node *ast.Node) bool {
 * 	for ast.IsParenthesizedExpression(node.Parent) || ast.IsPrefixUnaryExpression(node.Parent) && node.Parent.AsPrefixUnaryExpression().Operator == ast.KindExclamationToken {
 * 		node = node.Parent
 * 	}
 * 	return !isStatementCondition(node) && !ast.IsLogicalExpression(node.Parent) && !(ast.IsOptionalChain(node.Parent) && node.Parent.Expression() == node)
 * }
 */
export function isTopLevelLogicalExpression(node: GoPtr<Node>): bool {
  let current: GoPtr<Node> = node;
  while (
    IsParenthesizedExpression(current!.Parent) ||
    (IsPrefixUnaryExpression(current!.Parent) && AsPrefixUnaryExpression(current!.Parent)!.Operator === KindExclamationToken)
  ) {
    current = current!.Parent;
  }
  return (!isStatementCondition(current) &&
    !IsLogicalExpression(current!.Parent) &&
    !(IsOptionalChain(current!.Parent) && Node_Expression(current!.Parent) === current)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isAssignmentDeclaration","kind":"func","status":"implemented","sigHash":"4f412d8be6c704f1fd4daa4d191eb1151413c55e8c2661219c98ed064eaf607a","bodyHash":"d3aefda74b4e2a70b431139bb8e73c23b2ad5d17d496d5db8faa0abbf49757c8"}
 *
 * Go source:
 * func isAssignmentDeclaration(decl *ast.Node) bool {
 * 	return ast.IsBinaryExpression(decl) || ast.IsAccessExpression(decl) || ast.IsIdentifier(decl) || ast.IsCallExpression(decl)
 * }
 */
export function isAssignmentDeclaration(decl: GoPtr<Node>): bool {
  return (IsBinaryExpression(decl) || IsAccessExpression(decl) || IsIdentifier(decl) || IsCallExpression(decl)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/binder/binder.go::func::isEffectiveModuleDeclaration","kind":"func","status":"implemented","sigHash":"45a2e2e16d0f193ec1ef3644a7417fad99ac692dd696f2a1121f630ee58d5cbc","bodyHash":"d5a0526e8a3c617fa3e05d02b39d5513500a34fcfb901cc68369a4881f96c158"}
 *
 * Go source:
 * func isEffectiveModuleDeclaration(node *ast.Node) bool {
 * 	return ast.IsModuleDeclaration(node) || ast.IsIdentifier(node)
 * }
 */
export function isEffectiveModuleDeclaration(node: GoPtr<Node>): bool {
  return (IsModuleDeclaration(node) || IsIdentifier(node)) as bool;
}
