import type { bool, int } from "@tsonic/core/types.js";
import { Every, Find, FirstOrNil, Filter, Some } from "../core/core.js";
import type { GoComparable, GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { Node, NodeList } from "../ast/spine.js";
import { IsTypeOrJSTypeAliasDeclaration, Node_Arguments, Node_Body, Node_Elements, Node_Expression, Node_ImportClause, Node_Initializer, Node_Members, Node_ModifierFlags, Node_Parameters, Node_Properties, Node_PropertyNameOrName, Node_Text, Node_Type, Node_TypeArguments, SourceFile_FileName, SourceFile_Path, SourceFile_Text } from "../ast/ast.js";
import { goReceiverKey, Node_FlowNodeData, Node_ForEachChild, Node_Name, Node_Pos, NodeList_End, NodeList_Pos } from "../ast/spine.js";
import type { HasFileName, SourceFile } from "../ast/ast.js";
import type { ClassLikeDeclaration, EntityName, SignatureDeclaration } from "../ast/generated/unions.js";
import type { ParameterDeclaration } from "../ast/generated/data.js";
import { AsBinaryExpression, AsBindingElement, AsElementAccessExpression, AsExportAssignment, AsForStatement, AsImportEqualsDeclaration, AsImportTypeNode, AsJsxExpression, AsNamedTupleMember, AsParameterDeclaration, AsTypeReferenceNode, AsVariableDeclarationList, AsVariableStatement } from "../ast/generated/casts.js";
import type { FindAncestorResult } from "../ast/utilities.js";
import { ClassOrConstructorParameterIsDecorated, EntityNameToString, FindAncestor, FindAncestorOrQuit, FindAncestorFalse, FindAncestorQuit, FindAncestorTrue, GetAssignmentTarget, GetCombinedModifierFlags, GetContainingClass, GetExtendsHeritageClauseElements, GetImmediatelyInvokedFunctionExpression, GetPropertyNameForPropertyNameNode, GetRootDeclaration, GetSourceFileOfNode, HasAccessorModifier, HasModifier, HasQuestionToken, HasStaticModifier, HasSyntacticModifier, IsAccessExpression, IsAssertionExpression, IsAssignmentExpression, IsBindableStaticAccessExpression, IsBindableStaticNameExpression, IsCallOrNewExpression, IsClassElement, IsClassLike, IsExpandoPropertyDeclaration, IsExternalModuleAugmentation, IsFunctionLike, IsFunctionLikeOrClassStaticBlockDeclaration, IsGlobalSourceFile, IsInJSFile, IsPartOfTypeNode, IsJsxOpeningLikeElement, IsLogicalBinaryOperator, IsParameterPropertyDeclaration, IsPrivateIdentifierClassElementDeclaration, IsPropertyName, IsPrototypeAccess, IsStatic, IsVarConst, IsVariableDeclarationInitializedToRequire, NewHasFileName, SkipParentheses, WalkUpParenthesizedExpressions } from "../ast/utilities.js";
import { IsArrayLiteralExpression, IsAssignmentOperator, IsBinaryExpression, IsCallExpression, IsCatchClause, IsComputedPropertyName, IsDecorator, IsElementAccessExpression, IsExportAssignment, IsExportSpecifier, IsExpressionStatement, IsForStatement, IsGetAccessorDeclaration, IsIdentifier, IsImportDeclaration, IsInterfaceDeclaration, IsLogicalOrCoalescingAssignmentOperator, IsModuleBlock, IsNamespaceExport, IsNonNullExpression, IsObjectLiteralExpression, IsParameterDeclaration, IsParenthesizedExpression, IsPropertyAccessExpression, IsPropertyAssignment, IsPropertyDeclaration, IsPropertySignatureDeclaration, IsSetAccessorDeclaration, IsShorthandPropertyAssignment, IsTaggedTemplateExpression, IsTypeLiteralNode, IsVariableDeclaration, IsVoidExpression } from "../ast/generated/predicates.js";
import { IsJsxNamespacedName } from "../ast/generated/predicates.js";
import { ContainerFlagsIsContainer, GetContainerFlags } from "../binder/binder.js";
import { GetSymbolId } from "../ast/utilities.js";
import { Compare as strings_Compare } from "../../go/strings.js";
import { GetTextOfNode, IsIntrinsicJsxName } from "../scanner/utilities.js";
import { InternalSymbolNameExportEquals, InternalSymbolNameIndex, InternalSymbolNamePrefix } from "../ast/symbol.js";
import { ModifierFlagsAccessibilityModifier, ModifierFlagsAsync, ModifierFlagsDefault, ModifierFlagsExport, ModifierFlagsNone, ModifierFlagsOverride, ModifierFlagsPrivate, ModifierFlagsProtected, ModifierFlagsPublic, ModifierFlagsReadonly, ModifierFlagsStatic } from "../ast/modifierflags.js";
import { NodeFlagsAmbient, NodeFlagsConstant, NodeFlagsLet, NodeFlagsOptionalChain, SymbolFlagsAlias, SymbolFlagsClass, SymbolFlagsGetAccessor, SymbolFlagsModule, SymbolFlagsPrototype, SymbolFlagsVariable } from "../ast/generated/flags.js";
import { CheckFlagsContainsPrivate, CheckFlagsContainsPublic, CheckFlagsContainsStatic, CheckFlagsSynthetic } from "../ast/checkflags.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import { NewDiagnostic, NewDiagnosticChain } from "../ast/diagnostic.js";
import type { Kind } from "../ast/generated/kinds.js";
import {
  KindAmpersandToken,
  KindArrayLiteralExpression,
  KindArrowFunction,
  KindAsteriskAsteriskToken,
  KindAsteriskToken,
  KindBarToken,
  KindBinaryExpression,
  KindBigIntLiteral,
  KindBindingElement,
  KindBlock,
  KindCallSignature,
  KindCaretToken,
  KindCaseBlock,
  KindCatchClause,
  KindClassDeclaration,
  KindClassExpression,
  KindClassStaticBlockDeclaration,
  KindCommaToken,
  KindComputedPropertyName,
  KindConditionalType,
  KindConstructSignature,
  KindConstructor,
  KindConstructorType,
  KindDecorator,
  KindDeleteExpression,
  KindEnumDeclaration,
  KindEnumMember,
  KindEqualsEqualsEqualsToken,
  KindEqualsEqualsToken,
  KindEqualsToken,
  KindExclamationEqualsEqualsToken,
  KindExclamationEqualsToken,
  KindExclamationToken,
  KindExportAssignment,
  KindExportSpecifier,
  KindExpressionWithTypeArguments,
  KindForInStatement,
  KindForOfStatement,
  KindForStatement,
  KindFunctionDeclaration,
  KindFunctionExpression,
  KindFunctionType,
  KindGetAccessor,
  KindGreaterThanEqualsToken,
  KindGreaterThanGreaterThanGreaterThanToken,
  KindGreaterThanGreaterThanToken,
  KindGreaterThanToken,
  KindIdentifier,
  KindImportClause,
  KindImportEqualsDeclaration,
  KindImportSpecifier,
  KindImportType,
  KindInKeyword,
  KindIndexSignature,
  KindInstanceOfKeyword,
  KindInterfaceDeclaration,
  KindJSDocSignature,
  KindJSTypeAliasDeclaration,
  KindJsxExpression,
  KindLessThanEqualsToken,
  KindLessThanLessThanToken,
  KindLessThanToken,
  KindMappedType,
  KindMethodDeclaration,
  KindMethodSignature,
  KindMinusToken,
  KindModuleDeclaration,
  KindNamedTupleMember,
  KindNamespaceExport,
  KindNamespaceImport,
  KindObjectLiteralExpression,
  KindParameter,
  KindPercentToken,
  KindPlusToken,
  KindPostfixUnaryExpression,
  KindPrefixUnaryExpression,
  KindPropertyAccessExpression,
  KindPropertyAssignment,
  KindPropertyDeclaration,
  KindPropertySignature,
  KindQualifiedName,
  KindQuestionQuestionToken,
  KindRegularExpressionLiteral,
  KindSetAccessor,
  KindSlashToken,
  KindSourceFile,
  KindSuperKeyword,
  KindThisKeyword,
  KindTypeAliasDeclaration,
  KindTypeLiteral,
  KindTypeQuery,
  KindVariableDeclaration,
  KindVariableStatement,
  KindYieldExpression,
} from "../ast/generated/kinds.js";
import { IsQualifiedName, IsTypeReferenceNode, IsVariableDeclarationList, IsVariableStatement } from "../ast/generated/predicates.js";
import type { ModifierFlags } from "../ast/modifierflags.js";
import type { Symbol, SymbolTable } from "../ast/symbol.js";
import type { ResolutionMode } from "../core/compileroptions.js";
import type { TextRange } from "../core/text.js";
import { NewTextRange } from "../core/text.js";
import type { Message } from "../diagnostics/diagnostics.js";
import type { Number as JsNumber } from "../jsnum/jsnum.js";
import { Number_IsInf, Number_IsNaN } from "../jsnum/jsnum.js";
import type { PseudoBigInt } from "../jsnum/pseudobigint.js";
import { NewPseudoBigInt, ParsePseudoBigInt, PseudoBigInt_String } from "../jsnum/pseudobigint.js";
import { FromString, Number_String } from "../jsnum/string.js";
import type { Checker, Program } from "./checker/state.js";
import { signatureHasRestParameter } from "./checker/state.js";
import { Checker_getResolvedBaseConstraint } from "./checker/inference.js";
import { Checker_getEffectiveCallArguments, Checker_getSignatureFromDeclaration } from "./checker/signatures.js";
import { Checker_GetAliasedSymbol, Checker_getDeclarationNodeFlagsFromSymbol } from "./checker/symbols.js";
import type { ArrayTypeMapper, MergedTypeMapper, SimpleTypeMapper, TypeMapper } from "./mapper.js";
import { TypeMapper_Kind, TypeMapperKindArray, TypeMapperKindMerged, TypeMapperKindSimple } from "./mapper.js";
import type { Signature, TupleType, Type } from "./types.js";
import {
  ObjectFlagsArrayLiteral,
  ObjectFlagsClassOrInterface,
  ObjectFlagsJSLiteral,
  ObjectFlagsObjectLiteral,
  ObjectFlagsObjectTypeKindMask,
  ObjectFlagsReference,
  ObjectFlagsTuple,
  TypeFlagsAny,
  TypeFlagsBigInt,
  TypeFlagsBoolean,
  TypeFlagsBooleanLiteral,
  TypeFlagsConditional,
  TypeFlagsESSymbol,
  TypeFlagsEnum,
  TypeFlagsEnumLiteral,
  TypeFlagsIndex,
  TypeFlagsIndexedAccess,
  TypeFlagsInstantiable,
  TypeFlagsIntersection,
  TypeFlagsNever,
  TypeFlagsNonPrimitive,
  TypeFlagsNull,
  TypeFlagsNumber,
  TypeFlagsNumberLiteral,
  TypeFlagsObject,
  TypeFlagsString,
  TypeFlagsStringLiteral,
  TypeFlagsStringMapping,
  TypeFlagsStringOrNumberLiteralOrUnique,
  TypeFlagsSubstitution,
  TypeFlagsTemplateLiteral,
  TypeFlagsTypeParameter,
  TypeFlagsUndefined,
  TypeFlagsUnion,
  TypeFlagsUniqueESSymbol,
  TypeFlagsUnknown,
  TypeFlagsVoid,
  Type_AsConditionalType,
  Type_AsIndexType,
  Type_AsIndexedAccessType,
  Type_AsLiteralType,
  Type_AsObjectType,
  Type_AsStringMappingType,
  Type_AsSubstitutionType,
  Type_AsTemplateLiteralType,
  Type_AsTupleType,
  Type_AsTypeParameter,
  Type_AsTypeReference,
  Type_AsUnionType,
  Type_AsUniqueESSymbolType,
  Type_Target,
  Type_Types,
} from "./types.js";
import type { MinArgumentCountFlags } from "./relater.js";
import { MinArgumentCountFlagsStrongArityForUntypedJS, MinArgumentCountFlagsVoidIsNonOptional, Checker_getMinArgumentCountEx } from "./relater.js";
import { Assert } from "../debug/debug.js";
import { GetErrorRangeForNode, NewScanner, Scanner_Scan, Scanner_SetOnError, Scanner_SetSkipTrivia, Scanner_SetText, Scanner_TokenEnd, Scanner_TokenFlags, Scanner_TokenValue, SkipTrivia } from "../scanner/scanner.js";
import { TokenFlagsContainsSeparator } from "../ast/tokenflags.js";
import { EscapeString, QuoteCharDoubleQuote } from "../printer/utilities.js";
import { GetTypesPackageName, MangleScopedPackageName } from "../module/util.js";
import type { ResolvedModule } from "../module/types.js";
import { ExtensionDts, ExtensionJs, ExtensionMjs, ExtensionMts, ExtensionTs, TryGetExtensionFromPath } from "../tspath/extension.js";
import { CombinePaths } from "../tspath/path.js";
import { ScriptKindJS, ScriptKindJSX } from "../core/scriptkind.js";
import { Tristate_IsUnknown } from "../core/tristate.js";
import {
  If_the_0_package_actually_exposes_this_module_consider_sending_a_pull_request_to_amend_https_Colon_Slash_Slashgithub_com_SlashDefinitelyTyped_SlashDefinitelyTyped_Slashtree_Slashmaster_Slashtypes_Slash_1,
  If_the_0_package_actually_exposes_this_module_try_adding_a_new_declaration_d_ts_file_containing_declare_module_1,
  There_are_types_at_0_but_this_result_could_not_be_resolved_when_respecting_package_json_exports_The_1_library_may_need_to_update_its_package_json_or_typings,
  To_convert_this_file_to_an_ECMAScript_module_add_the_field_type_Colon_module_to_0,
  To_convert_this_file_to_an_ECMAScript_module_change_its_file_extension_to_0_or_add_the_field_type_Colon_module_to_1,
  To_convert_this_file_to_an_ECMAScript_module_change_its_file_extension_to_0_or_create_a_local_package_json_file_with_type_Colon_module,
  To_convert_this_file_to_an_ECMAScript_module_create_a_local_package_json_file_with_type_Colon_module,
  Try_npm_i_save_dev_types_Slash_1_if_it_exists_or_add_a_new_declaration_d_ts_file_containing_declare_module_0,
} from "../diagnostics/generated/messages.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::NewDiagnosticForNode","kind":"func","status":"implemented","sigHash":"38975070fc52475f953f616cda4a7d53cea35489b9bd5758651180771e977acb","bodyHash":"527b4727e86c1c12508f0ce7e676ac72816d11345ecbeecb52a7ebde0f42de0a"}
 *
 * Go source:
 * func NewDiagnosticForNode(node *ast.Node, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 	var file *ast.SourceFile
 * 	var loc core.TextRange
 * 	if node != nil {
 * 		file = ast.GetSourceFileOfNode(node)
 * 		loc = scanner.GetErrorRangeForNode(file, node)
 * 	}
 * 	return ast.NewDiagnostic(file, loc, message, args...)
 * }
 */
export function NewDiagnosticForNode(node: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic> {
  let file: GoPtr<SourceFile> = undefined;
  let loc: TextRange = NewTextRange(0, 0);
  if (node !== undefined) {
    file = GetSourceFileOfNode(node);
    loc = GetErrorRangeForNode(file, node);
  }
  return NewDiagnostic(file, loc, message, ...args);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::NewDiagnosticChainForNode","kind":"func","status":"implemented","sigHash":"0d98e8c86348dcc28b403251be77a5141034032bfd696b6560b0f93053fed3ce","bodyHash":"b46f7395c47d432efa8e4536139d6050c902d258ad25d10e5711e219d6bbe1ca"}
 *
 * Go source:
 * func NewDiagnosticChainForNode(chain *ast.Diagnostic, node *ast.Node, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 	if chain != nil {
 * 		return ast.NewDiagnosticChain(chain, message, args...)
 * 	}
 * 	return NewDiagnosticForNode(node, message, args...)
 * }
 */
export function NewDiagnosticChainForNode(chain: GoPtr<Diagnostic>, node: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic> {
  if (chain !== undefined) {
    return NewDiagnosticChain(chain, message, ...args);
  }
  return NewDiagnosticForNode(node, message, ...args);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::findInMap","kind":"func","status":"implemented","sigHash":"17bb318d799d271abd20ee5867b8b5d856df62276fe304ece91444a26f84b0f6","bodyHash":"d7f9ce5043735102869f6b640f3bf548585a863df51671661dc775cefef7e5f3"}
 *
 * Go source:
 * func findInMap[K comparable, V any](m map[K]V, predicate func(V) bool) V {
 * 	for _, value := range m {
 * 		if predicate(value) {
 * 			return value
 * 		}
 * 	}
 * 	return *new(V)
 * }
 */
export function findInMap<K extends GoComparable, V>(m: GoMap<K, V>, predicate: (arg0: V) => bool): V {
  // Go ranges over a nil map as a no-op.
  for (const value of m?.values() ?? []) {
    if (predicate(value)) {
      return value;
    }
  }
  return undefined as V;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::tokenIsIdentifierOrKeyword","kind":"func","status":"implemented","sigHash":"538026bcddd56581a52c2d4c5ae6b1f36ef3386ee89dd8f7605ba57f9f21df7d","bodyHash":"b09ca2afbed17046efb355bbc5fa534f58fc7cb9b3b212c37a3ba8428a1b3726"}
 *
 * Go source:
 * func tokenIsIdentifierOrKeyword(token ast.Kind) bool {
 * 	return token >= ast.KindIdentifier
 * }
 */
export function tokenIsIdentifierOrKeyword(token: Kind): bool {
  return (token >= KindIdentifier) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::tokenIsIdentifierOrKeywordOrGreaterThan","kind":"func","status":"implemented","sigHash":"8c2bbccf98db702c946063640450b133e7c0c3a1978a7263dc599cb503470a5c","bodyHash":"9c4b664d2fc422eddefcedbe8884f7565459bc1020b09a71cf200b48340e8865"}
 *
 * Go source:
 * func tokenIsIdentifierOrKeywordOrGreaterThan(token ast.Kind) bool {
 * 	return token == ast.KindGreaterThanToken || tokenIsIdentifierOrKeyword(token)
 * }
 */
export function tokenIsIdentifierOrKeywordOrGreaterThan(token: Kind): bool {
  return (token === KindGreaterThanToken || tokenIsIdentifierOrKeyword(token)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::hasOverrideModifier","kind":"func","status":"implemented","sigHash":"7128ef6f330c613d0b9bfcdbe3091b8add548317b27243373b27a3649af36490","bodyHash":"f83915509e02b83f494b06ac1b3ccf7f4059d515cede9afca67594e482a063ce"}
 *
 * Go source:
 * func hasOverrideModifier(node *ast.Node) bool {
 * 	return ast.HasSyntacticModifier(node, ast.ModifierFlagsOverride)
 * }
 */
export function hasOverrideModifier(node: GoPtr<Node>): bool {
  return HasSyntacticModifier(node, ModifierFlagsOverride);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::hasAsyncModifier","kind":"func","status":"implemented","sigHash":"f4033bd546f1f3ad06a5f2697fb67868732539db1cafa1d7bc25c7cc5620792b","bodyHash":"4b5c02d69506c4f2ef74e3b08539aadfccc9f2ed14957ee9d33d858ef8516268"}
 *
 * Go source:
 * func hasAsyncModifier(node *ast.Node) bool {
 * 	return ast.HasSyntacticModifier(node, ast.ModifierFlagsAsync)
 * }
 */
export function hasAsyncModifier(node: GoPtr<Node>): bool {
  return HasSyntacticModifier(node, ModifierFlagsAsync);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getSelectedModifierFlags","kind":"func","status":"implemented","sigHash":"387d56d54f63ba532dfc8544faa61f4257b6e7af52c1014979068428e843b4a6","bodyHash":"617051e67eada1ff6553733eb30a60dd83fc98179f7a661d92ef1273b1ae84bb"}
 *
 * Go source:
 * func getSelectedModifierFlags(node *ast.Node, flags ast.ModifierFlags) ast.ModifierFlags {
 * 	return node.ModifierFlags() & flags
 * }
 */
export function getSelectedModifierFlags(node: GoPtr<Node>, flags: ModifierFlags): ModifierFlags {
  return (Node_ModifierFlags(node) & flags) as ModifierFlags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::hasReadonlyModifier","kind":"func","status":"implemented","sigHash":"ea748866cfc46fb0efca4a1ec40b9ae10c6005bb0084ff9f8211b1f9af4d37e2","bodyHash":"3d5af1736f7a341fe5a8beca0f8eb1b1155ba83168c34374525bf6e07122d552"}
 *
 * Go source:
 * func hasReadonlyModifier(node *ast.Node) bool {
 * 	return ast.HasModifier(node, ast.ModifierFlagsReadonly)
 * }
 */
export function hasReadonlyModifier(node: GoPtr<Node>): bool {
  return HasModifier(node, ModifierFlagsReadonly);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isStaticPrivateIdentifierProperty","kind":"func","status":"implemented","sigHash":"4d9ca3c5b9ab79e4ac23dc8e070f6ffcd1e5f4886a16569d4219e71d6da63e77","bodyHash":"0b932cacc03f47b3c737371a9df2905dfae7c6730a3cc5b2d3dc4c432c3d9aea"}
 *
 * Go source:
 * func isStaticPrivateIdentifierProperty(s *ast.Symbol) bool {
 * 	return s.ValueDeclaration != nil && ast.IsPrivateIdentifierClassElementDeclaration(s.ValueDeclaration) && ast.IsStatic(s.ValueDeclaration)
 * }
 */
export function isStaticPrivateIdentifierProperty(s: GoPtr<Symbol>): bool {
  return (s!.ValueDeclaration !== undefined && IsPrivateIdentifierClassElementDeclaration(s!.ValueDeclaration) && IsStatic(s!.ValueDeclaration)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isEmptyObjectLiteral","kind":"func","status":"implemented","sigHash":"84281cd285312aa56e5123644f3dc25d3e45fd83c4c0cdaa24f6412c7c76305d","bodyHash":"f6cccda1f6e3a72105cf7f79b8e88987eb68c408cdd76c3f4cc5fba59aeffca5"}
 *
 * Go source:
 * func isEmptyObjectLiteral(expression *ast.Node) bool {
 * 	return ast.IsObjectLiteralExpression(expression) && len(expression.Properties()) == 0
 * }
 */
export function isEmptyObjectLiteral(expression: GoPtr<Node>): bool {
  return (IsObjectLiteralExpression(expression) && (Node_Properties(expression) ?? []).length === 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::type::AssignmentKind","kind":"type","status":"implemented","sigHash":"393c48543c1ba7e168c5568834798d90c984038a744dd5c848531dc6e8088119","bodyHash":"c29629770275cb80c24b6cef05fec2a76a2affa8a0e1e07d247983ae4f2a93e6"}
 *
 * Go source:
 * AssignmentKind int32
 */
export type AssignmentKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::constGroup::AssignmentKindNone+AssignmentKindDefinite+AssignmentKindCompound","kind":"constGroup","status":"implemented","sigHash":"2a2a8229d8b9a8a744026766183e53b3705719ccdcff135a01a4f615c05e0801","bodyHash":"0d3d348fe24cec7b8aa1127504564260c9fb60fcb64dcbbaf37c3c6d78a16f71"}
 *
 * Go source:
 * const (
 * 	AssignmentKindNone AssignmentKind = iota
 * 	AssignmentKindDefinite
 * 	AssignmentKindCompound
 * )
 */
export const AssignmentKindNone: AssignmentKind = 0;
export const AssignmentKindDefinite: AssignmentKind = 1;
export const AssignmentKindCompound: AssignmentKind = 2;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::type::AssignmentTarget","kind":"type","status":"implemented","sigHash":"3c7ae8f7c4c72d97efb05684cb22333b9e47672e39349d550af85d76a9a2cd4d","bodyHash":"8118d1e9ac5684dcf218648bc69cff3f6e88d42879c39a2ce2cd9e3264aafd57"}
 *
 * Go source:
 * AssignmentTarget = ast.Node
 */
export type AssignmentTarget = Node;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getAssignmentTargetKind","kind":"func","status":"implemented","sigHash":"482184057064abc7ffb5ae097e38972d83ddfd2340d58729dee7869f283a7f66","bodyHash":"7b4f12bc5b61d782a914215c109f887df22f3b8940a046260094e8acb4e33f79"}
 *
 * Go source:
 * func getAssignmentTargetKind(node *ast.Node) AssignmentKind {
 * 	target := ast.GetAssignmentTarget(node)
 * 	if target == nil {
 * 		return AssignmentKindNone
 * 	}
 * 	switch target.Kind {
 * 	case ast.KindBinaryExpression:
 * 		binaryOperator := target.AsBinaryExpression().OperatorToken.Kind
 * 		if binaryOperator == ast.KindEqualsToken || ast.IsLogicalOrCoalescingAssignmentOperator(binaryOperator) {
 * 			return AssignmentKindDefinite
 * 		}
 * 		return AssignmentKindCompound
 * 	case ast.KindPrefixUnaryExpression, ast.KindPostfixUnaryExpression:
 * 		return AssignmentKindCompound
 * 	case ast.KindForInStatement, ast.KindForOfStatement:
 * 		return AssignmentKindDefinite
 * 	}
 * 	panic("Unhandled case in getAssignmentTargetKind")
 * }
 */
export function getAssignmentTargetKind(node: GoPtr<Node>): AssignmentKind {
  const target = GetAssignmentTarget(node);
  if (target === undefined) {
    return AssignmentKindNone;
  }
  switch (target!.Kind) {
    case KindBinaryExpression: {
      const binaryOperator = AsBinaryExpression(target)!.OperatorToken!.Kind;
      if (binaryOperator === KindEqualsToken || IsLogicalOrCoalescingAssignmentOperator(binaryOperator)) {
        return AssignmentKindDefinite;
      }
      return AssignmentKindCompound;
    }
    case KindPrefixUnaryExpression:
    case KindPostfixUnaryExpression:
      return AssignmentKindCompound;
    case KindForInStatement:
    case KindForOfStatement:
      return AssignmentKindDefinite;
  }
  throw new globalThis.Error("Unhandled case in getAssignmentTargetKind");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isDeleteTarget","kind":"func","status":"implemented","sigHash":"e10cfe4e82cbd07e89a05cbd0fc64748039038d410b50f850df74e948a6e1a81","bodyHash":"49e9cb0072cc73ceca0ace328da32b912e826a1794f02ab37c0e43ab884df633"}
 *
 * Go source:
 * func isDeleteTarget(node *ast.Node) bool {
 * 	if !ast.IsAccessExpression(node) {
 * 		return false
 * 	}
 * 	node = ast.WalkUpParenthesizedExpressions(node.Parent)
 * 	return node != nil && node.Kind == ast.KindDeleteExpression
 * }
 */
export function isDeleteTarget(node: GoPtr<Node>): bool {
  if (!IsAccessExpression(node)) {
    return false as bool;
  }
  const walked = WalkUpParenthesizedExpressions(node!.Parent);
  return (walked !== undefined && walked!.Kind === KindDeleteExpression) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isInCompoundLikeAssignment","kind":"func","status":"implemented","sigHash":"a06eae9a808d58ead5e35a071d0f9a7187d70b7b1339c7743162cf4c6c208e77","bodyHash":"5174d4e5598e3f0400af2a1bd5207a2b09b776ce9ddec118ac697d6f517ec2cc"}
 *
 * Go source:
 * func isInCompoundLikeAssignment(node *ast.Node) bool {
 * 	target := ast.GetAssignmentTarget(node)
 * 	return target != nil && ast.IsAssignmentExpression(target /*excludeCompoundAssignment* /, true) && isCompoundLikeAssignment(target)
 * }
 */
export function isInCompoundLikeAssignment(node: GoPtr<Node>): bool {
  const target = GetAssignmentTarget(node);
  return (target !== undefined && IsAssignmentExpression(target, true as bool) && isCompoundLikeAssignment(target)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isCompoundLikeAssignment","kind":"func","status":"implemented","sigHash":"c97f1f5e6cffb8761fcb87e8b62bfbf3e99a056085efbcdd6dc5e092e14e2c2a","bodyHash":"02807f1e6998b3f43d66368cf71e9fcb2e31c754add7983b2beb65794923c216"}
 *
 * Go source:
 * func isCompoundLikeAssignment(assignment *ast.Node) bool {
 * 	right := ast.SkipParentheses(assignment.AsBinaryExpression().Right)
 * 	return right.Kind == ast.KindBinaryExpression && isShiftOperatorOrHigher(right.AsBinaryExpression().OperatorToken.Kind)
 * }
 */
export function isCompoundLikeAssignment(assignment: GoPtr<Node>): bool {
  const right = SkipParentheses(AsBinaryExpression(assignment)!.Right);
  return (right!.Kind === KindBinaryExpression && isShiftOperatorOrHigher(AsBinaryExpression(right)!.OperatorToken!.Kind)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isConstTypeReference","kind":"func","status":"implemented","sigHash":"8072e0449ac51141b42f04d1b12c904559bfab8cbc1f1adb5233b14a566a6d69","bodyHash":"62abd023ac00dfda90293f30cdec073143b009390121425678589ced0d779a1d"}
 *
 * Go source:
 * func isConstTypeReference(node *ast.Node) bool {
 * 	return ast.IsTypeReferenceNode(node) && len(node.TypeArguments()) == 0 && ast.IsIdentifier(node.AsTypeReferenceNode().TypeName) && node.AsTypeReferenceNode().TypeName.Text() == "const"
 * }
 */
export function isConstTypeReference(node: GoPtr<Node>): bool {
  return (IsTypeReferenceNode(node) && (Node_TypeArguments(node) ?? []).length === 0 && IsIdentifier(AsTypeReferenceNode(node)!.TypeName) && Node_Text(AsTypeReferenceNode(node)!.TypeName) === "const") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::GetSingleVariableOfVariableStatement","kind":"func","status":"implemented","sigHash":"da76119bd54063f17a52572927219e08f4d9cf7e266fe9b56dfcb901cdef9dbc","bodyHash":"702f76809a6efe767cc09ca25c3fff69f578be1c2787041aa59646eb3357e53f"}
 *
 * Go source:
 * func GetSingleVariableOfVariableStatement(node *ast.Node) *ast.Node {
 * 	if !ast.IsVariableStatement(node) {
 * 		return nil
 * 	}
 * 	return core.FirstOrNil(node.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations.Nodes)
 * }
 */
export function GetSingleVariableOfVariableStatement(node: GoPtr<Node>): GoPtr<Node> {
  if (!IsVariableStatement(node)) {
    return undefined;
  }
  return FirstOrNil(AsVariableDeclarationList(AsVariableStatement(node)!.DeclarationList)!.Declarations!.Nodes);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isTypeReferenceIdentifier","kind":"func","status":"implemented","sigHash":"2a9bc9a2752331e4c926182c3ecbf9833c49db13987715ac492c5e9c4a4f19ea","bodyHash":"0f77d7ffd80911da0c3088493c04d2fe82938f479514e635bc067c62305236fa"}
 *
 * Go source:
 * func isTypeReferenceIdentifier(node *ast.Node) bool {
 * 	for node.Parent.Kind == ast.KindQualifiedName {
 * 		node = node.Parent
 * 	}
 * 	return ast.IsTypeReferenceNode(node.Parent)
 * }
 */
export function isTypeReferenceIdentifier(node: GoPtr<Node>): bool {
  let cur = node;
  while (cur!.Parent!.Kind === KindQualifiedName) {
    cur = cur!.Parent;
  }
  return IsTypeReferenceNode(cur!.Parent);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::IsInTypeQuery","kind":"func","status":"implemented","sigHash":"3c80ad58491942624d8d4c4711be38790d1e33cb8bfbd488e771c26737d23834","bodyHash":"4682ada4603df89a65a207d38d2f7466074c39cc200e7f48fc41980593b47df7"}
 *
 * Go source:
 * func IsInTypeQuery(node *ast.Node) bool {
 * 	// TypeScript 1.0 spec (April 2014): 3.6.3
 * 	// A type query consists of the keyword typeof followed by an expression.
 * 	// The expression is restricted to a single identifier or a sequence of identifiers separated by periods
 * 	return ast.FindAncestorOrQuit(node, func(n *ast.Node) ast.FindAncestorResult {
 * 		switch n.Kind {
 * 		case ast.KindTypeQuery:
 * 			return ast.FindAncestorTrue
 * 		case ast.KindIdentifier, ast.KindQualifiedName:
 * 			return ast.FindAncestorFalse
 * 		}
 * 		return ast.FindAncestorQuit
 * 	}) != nil
 * }
 */
export function IsInTypeQuery(node: GoPtr<Node>): bool {
  // TypeScript 1.0 spec (April 2014): 3.6.3
  // A type query consists of the keyword typeof followed by an expression.
  // The expression is restricted to a single identifier or a sequence of identifiers separated by periods
  return (FindAncestorOrQuit(node, (n: GoPtr<Node>): FindAncestorResult => {
    switch (n!.Kind) {
      case KindTypeQuery:
        return FindAncestorTrue;
      case KindIdentifier:
      case KindQualifiedName:
        return FindAncestorFalse;
    }
    return FindAncestorQuit;
  }) !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::canHaveLocals","kind":"func","status":"implemented","sigHash":"9952744a2b9bf55ac2b4d3f9285bf33409a3f47529f886b75e93a808164e7e98","bodyHash":"680a6182844f6a8e2d21bedef23c17019a57bfff85cf9615c916b1d5b0a3833c"}
 *
 * Go source:
 * func canHaveLocals(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindArrowFunction, ast.KindBlock, ast.KindCallSignature, ast.KindCaseBlock, ast.KindCatchClause,
 * 		ast.KindClassStaticBlockDeclaration, ast.KindConditionalType, ast.KindConstructor, ast.KindConstructorType,
 * 		ast.KindConstructSignature, ast.KindForStatement, ast.KindForInStatement, ast.KindForOfStatement, ast.KindFunctionDeclaration,
 * 		ast.KindFunctionExpression, ast.KindFunctionType, ast.KindGetAccessor, ast.KindIndexSignature,
 * 		ast.KindJSDocSignature, ast.KindMappedType,
 * 		ast.KindMethodDeclaration, ast.KindMethodSignature, ast.KindModuleDeclaration, ast.KindSetAccessor, ast.KindSourceFile,
 * 		ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function canHaveLocals(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindArrowFunction:
    case KindBlock:
    case KindCallSignature:
    case KindCaseBlock:
    case KindCatchClause:
    case KindClassStaticBlockDeclaration:
    case KindConditionalType:
    case KindConstructor:
    case KindConstructorType:
    case KindConstructSignature:
    case KindForStatement:
    case KindForInStatement:
    case KindForOfStatement:
    case KindFunctionDeclaration:
    case KindFunctionExpression:
    case KindFunctionType:
    case KindGetAccessor:
    case KindIndexSignature:
    case KindJSDocSignature:
    case KindMappedType:
    case KindMethodDeclaration:
    case KindMethodSignature:
    case KindModuleDeclaration:
    case KindSetAccessor:
    case KindSourceFile:
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isShorthandAmbientModuleSymbol","kind":"func","status":"implemented","sigHash":"26b7d80c1091f333940db74ff0da6789d59b2986eb4f8adeca002bdb40dddc14","bodyHash":"7da505468e17a574e553683e2b507232b8795999a49523c69b051af4b19ad9da"}
 *
 * Go source:
 * func isShorthandAmbientModuleSymbol(moduleSymbol *ast.Symbol) bool {
 * 	return isShorthandAmbientModule(moduleSymbol.ValueDeclaration)
 * }
 */
export function isShorthandAmbientModuleSymbol(moduleSymbol: GoPtr<Symbol>): bool {
  return isShorthandAmbientModule(moduleSymbol!.ValueDeclaration);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isShorthandAmbientModule","kind":"func","status":"implemented","sigHash":"584f251d1af54a570132979608b623b30bd79671f571fdd49d9df70d3df2bcd0","bodyHash":"300f8f6194387082a6156ffa5e3a4417ed19355c41ae5ad3a3e73f86e0e2960c"}
 *
 * Go source:
 * func isShorthandAmbientModule(node *ast.Node) bool {
 * 	// The only kind of module that can be missing a body is a shorthand ambient module.
 * 	return node != nil && node.Kind == ast.KindModuleDeclaration && node.Body() == nil
 * }
 */
export function isShorthandAmbientModule(node: GoPtr<Node>): bool {
  // The only kind of module that can be missing a body is a shorthand ambient module.
  return (node !== undefined && node!.Kind === KindModuleDeclaration && Node_Body(node) === undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getAliasDeclarationFromName","kind":"func","status":"implemented","sigHash":"4e29b7bc00f8822bc3694ab4ce0591f3207c8c29f5085025a04e9cee0179ad1f","bodyHash":"7d8c1ebac46523bfe7449ad9fd2d10284f9f70d1e3e70d732baa9ff596a81326"}
 *
 * Go source:
 * func getAliasDeclarationFromName(node *ast.Node) *ast.Node {
 * 	switch node.Parent.Kind {
 * 	case ast.KindImportClause, ast.KindImportSpecifier, ast.KindNamespaceImport, ast.KindExportSpecifier, ast.KindExportAssignment,
 * 		ast.KindImportEqualsDeclaration, ast.KindNamespaceExport:
 * 		return node.Parent
 * 	case ast.KindQualifiedName:
 * 		return getAliasDeclarationFromName(node.Parent)
 * 	}
 * 	return nil
 * }
 */
export function getAliasDeclarationFromName(node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Parent!.Kind) {
    case KindImportClause:
    case KindImportSpecifier:
    case KindNamespaceImport:
    case KindExportSpecifier:
    case KindExportAssignment:
    case KindImportEqualsDeclaration:
    case KindNamespaceExport:
      return node!.Parent;
    case KindQualifiedName:
      return getAliasDeclarationFromName(node!.Parent);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::entityNameToString","kind":"func","status":"implemented","sigHash":"3b7c22c290a89868686ce908571a82799371dfda8fd91bff3e50807615faa077","bodyHash":"7cfbedd0bea4a4cf6835019fd9a8afe3361ca175e66a55ab5d0bb680da1887a7"}
 *
 * Go source:
 * func entityNameToString(name *ast.Node) string {
 * 	return ast.EntityNameToString(name, scanner.GetTextOfNode)
 * }
 */
export function entityNameToString(name: GoPtr<Node>): string {
  return EntityNameToString(name, GetTextOfNode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getContainingQualifiedNameNode","kind":"func","status":"implemented","sigHash":"60c04d445d4e119b2775dc04f06f448758a7cf4e45bb5f8e90371bb023de1e42","bodyHash":"d80efe86563f45b3f0395a57d604b97a3b5e0fb6c0801cbe62b3e2be043c4bfe"}
 *
 * Go source:
 * func getContainingQualifiedNameNode(node *ast.Node) *ast.Node {
 * 	for ast.IsQualifiedName(node.Parent) {
 * 		node = node.Parent
 * 	}
 * 	return node
 * }
 */
export function getContainingQualifiedNameNode(node: GoPtr<Node>): GoPtr<Node> {
  let cur = node;
  while (IsQualifiedName(cur!.Parent)) {
    cur = cur!.Parent;
  }
  return cur;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isSideEffectImport","kind":"func","status":"implemented","sigHash":"13715e0da670b8a839b1296c7fda66d406dc8d7171eafcd01bb56ba205911baf","bodyHash":"ec442ca7630535cbb902d141c8b3338225c26047e4c5211504846b007bc7b561"}
 *
 * Go source:
 * func isSideEffectImport(node *ast.Node) bool {
 * 	ancestor := ast.FindAncestor(node, ast.IsImportDeclaration)
 * 	return ancestor != nil && ancestor.ImportClause() == nil
 * }
 */
export function isSideEffectImport(node: GoPtr<Node>): bool {
  const ancestor = FindAncestor(node, IsImportDeclaration);
  return (ancestor !== undefined && Node_ImportClause(ancestor) === undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getExternalModuleRequireArgument","kind":"func","status":"implemented","sigHash":"344668f050f6d8021ac0d6ec7c818eac1984f374625f18afa8a1582fa87e6420","bodyHash":"aaabcbb85f98dbd66eb9486d44aebcf7bf6ff3861526baab2ce6210092316d22"}
 *
 * Go source:
 * func getExternalModuleRequireArgument(node *ast.Node) *ast.Node {
 * 	if ast.IsVariableDeclarationInitializedToRequire(node) {
 * 		return node.Initializer().Arguments()[0]
 * 	}
 * 	return nil
 * }
 */
export function getExternalModuleRequireArgument(node: GoPtr<Node>): GoPtr<Node> {
  if (IsVariableDeclarationInitializedToRequire(node)) {
    return Node_Arguments(Node_Initializer(node))![0];
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isRightSideOfAccessExpression","kind":"func","status":"implemented","sigHash":"85de8d1dedefba7e8355f4a140bff173dfc04107068da18912badef71cd7b15d","bodyHash":"c7e457dc91220da64dece8f31a68bfa8f5d5327c423156960468db1b5f157c5d"}
 *
 * Go source:
 * func isRightSideOfAccessExpression(node *ast.Node) bool {
 * 	return node.Parent != nil && (ast.IsPropertyAccessExpression(node.Parent) && node.Parent.Name() == node ||
 * 		ast.IsElementAccessExpression(node.Parent) && node.Parent.AsElementAccessExpression().ArgumentExpression == node)
 * }
 */
export function isRightSideOfAccessExpression(node: GoPtr<Node>): bool {
  return (node!.Parent !== undefined && ((IsPropertyAccessExpression(node!.Parent) && Node_Name(node!.Parent) === node) ||
    (IsElementAccessExpression(node!.Parent) && AsElementAccessExpression(node!.Parent)!.ArgumentExpression === node))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isTopLevelInExternalModuleAugmentation","kind":"func","status":"implemented","sigHash":"ab7221226c5a114f733df73f71b436fa4a563172459a7cac04fad8818a69641f","bodyHash":"028541d11d219b1bf4b6661284c9721f51603cc42b140cb5be0557070928a4ae"}
 *
 * Go source:
 * func isTopLevelInExternalModuleAugmentation(node *ast.Node) bool {
 * 	return node != nil && node.Parent != nil && ast.IsModuleBlock(node.Parent) && ast.IsExternalModuleAugmentation(node.Parent.Parent)
 * }
 */
export function isTopLevelInExternalModuleAugmentation(node: GoPtr<Node>): bool {
  return (node !== undefined && node!.Parent !== undefined && IsModuleBlock(node!.Parent) && IsExternalModuleAugmentation(node!.Parent!.Parent)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isSyntacticDefault","kind":"func","status":"implemented","sigHash":"c1a8fc41910a5345349ecc8d6efffe1c783721a410961b7e238f23317bee0d50","bodyHash":"5b06fab2959b7838194d0206c62660bbe03b8bc5ef3e36dffa7671bbf77be00d"}
 *
 * Go source:
 * func isSyntacticDefault(node *ast.Node) bool {
 * 	return (ast.IsExportAssignment(node) && !node.AsExportAssignment().IsExportEquals) ||
 * 		ast.HasSyntacticModifier(node, ast.ModifierFlagsDefault) ||
 * 		ast.IsExportSpecifier(node) ||
 * 		ast.IsNamespaceExport(node)
 * }
 */
export function isSyntacticDefault(node: GoPtr<Node>): bool {
  return ((IsExportAssignment(node) && !AsExportAssignment(node)!.IsExportEquals) ||
    HasSyntacticModifier(node, ModifierFlagsDefault) ||
    IsExportSpecifier(node) ||
    IsNamespaceExport(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::hasExportAssignmentSymbol","kind":"func","status":"implemented","sigHash":"4ad0f2d39b8d4ea91c67db80708eebd4aa0c722f468f524de627237749fc54c0","bodyHash":"094c07509306f4a86013cc68e2f9b1300c3ec1b05ea28a4dbf9eb0800f4784db"}
 *
 * Go source:
 * func hasExportAssignmentSymbol(moduleSymbol *ast.Symbol) bool {
 * 	return moduleSymbol.Exports[ast.InternalSymbolNameExportEquals] != nil
 * }
 */
export function hasExportAssignmentSymbol(moduleSymbol: GoPtr<Symbol>): bool {
  return (moduleSymbol!.Exports?.get(InternalSymbolNameExportEquals) !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isTypeAlias","kind":"func","status":"implemented","sigHash":"d2c4fb8559d7a4a0b35fab4dfee18794166aa0c9893bdb28f2e14415f730cd8b","bodyHash":"78810d12204cb116dff177519f9727c6bbe521b612cd726d37d100d1b192249d"}
 *
 * Go source:
 * func isTypeAlias(node *ast.Node) bool {
 * 	return ast.IsTypeOrJSTypeAliasDeclaration(node)
 * }
 */
export function isTypeAlias(node: GoPtr<Node>): bool {
  return IsTypeOrJSTypeAliasDeclaration(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::hasOnlyExpressionInitializer","kind":"func","status":"implemented","sigHash":"a878c46dcb756d60cac8ab21557e2502be2f3b10b802c82e9703432d66d6d774","bodyHash":"effd36ac0f44f70a2753fff6c47a9938271899579449b8a8cccd4e0359ba946d"}
 *
 * Go source:
 * func hasOnlyExpressionInitializer(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindVariableDeclaration, ast.KindParameter, ast.KindBindingElement, ast.KindPropertyDeclaration, ast.KindPropertyAssignment, ast.KindEnumMember:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function hasOnlyExpressionInitializer(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindVariableDeclaration:
    case KindParameter:
    case KindBindingElement:
    case KindPropertyDeclaration:
    case KindPropertyAssignment:
    case KindEnumMember:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::hasDotDotDotToken","kind":"func","status":"implemented","sigHash":"63102325616b5aa0d2d6366981ca1ed6f1d2e5cf2b5e482e9dab5b2726888cbb","bodyHash":"87d08b322f19bd9efe0009a21f5505b70afac32c0abf70fff174d081bc5a091d"}
 *
 * Go source:
 * func hasDotDotDotToken(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindParameter:
 * 		return node.AsParameterDeclaration().DotDotDotToken != nil
 * 	case ast.KindBindingElement:
 * 		return node.AsBindingElement().DotDotDotToken != nil
 * 	case ast.KindNamedTupleMember:
 * 		return node.AsNamedTupleMember().DotDotDotToken != nil
 * 	case ast.KindJsxExpression:
 * 		return node.AsJsxExpression().DotDotDotToken != nil
 * 	}
 * 	return false
 * }
 */
export function hasDotDotDotToken(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindParameter:
      return (AsParameterDeclaration(node)!.DotDotDotToken !== undefined) as bool;
    case KindBindingElement:
      return (AsBindingElement(node)!.DotDotDotToken !== undefined) as bool;
    case KindNamedTupleMember:
      return (AsNamedTupleMember(node)!.DotDotDotToken !== undefined) as bool;
    case KindJsxExpression:
      return (AsJsxExpression(node)!.DotDotDotToken !== undefined) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::IsTypeAny","kind":"func","status":"implemented","sigHash":"19d879f9763c5d22bdd5a258d03a56c1be116c2d95721c13597b911178581940","bodyHash":"7455ecbba99a3b4acabc3a31fb0d0069ab2df7b9507d8e3431d3999b50a671ad"}
 *
 * Go source:
 * func IsTypeAny(t *Type) bool {
 * 	return t != nil && t.flags&TypeFlagsAny != 0
 * }
 */
export function IsTypeAny(t: GoPtr<Type>): bool {
  return (t !== undefined && (t!.flags & TypeFlagsAny) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isJSDocOptionalParameter","kind":"func","status":"implemented","sigHash":"5e1568f8b9d017bc506738a202999fb70c4bddcb6cd80db41362508e922b9da2","bodyHash":"4e9863386b2da0d5e47fc6053f9df263e93512ad94e57cd75ac4154605d8ac94"}
 *
 * Go source:
 * func isJSDocOptionalParameter(node *ast.ParameterDeclaration) bool {
 * 	return false // !!!
 * }
 */
export function isJSDocOptionalParameter(node: GoPtr<ParameterDeclaration>): bool {
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isExclamationToken","kind":"func","status":"implemented","sigHash":"3d1fafc1c357cef0dd33782ceb8c590915eeb287731a6edb2b945937a0799718","bodyHash":"02f11621376766ece91d8729482065164ad0f68de39cd104397f1d03038197f8"}
 *
 * Go source:
 * func isExclamationToken(node *ast.Node) bool {
 * 	return node != nil && node.Kind == ast.KindExclamationToken
 * }
 */
export function isExclamationToken(node: GoPtr<Node>): bool {
  return (node !== undefined && node!.Kind === KindExclamationToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isOptionalDeclaration","kind":"func","status":"implemented","sigHash":"d5503fa46944894a3112a33dd276edb85f7206394f30213dd3d14fbbef2e103a","bodyHash":"f9f3d6e7a887b816caa2ef960069e55c782a677ec3cc57902b64a3d7ad596408"}
 *
 * Go source:
 * func isOptionalDeclaration(declaration *ast.Node) bool {
 * 	return ast.HasQuestionToken(declaration)
 * }
 */
export function isOptionalDeclaration(declaration: GoPtr<Node>): bool {
  return HasQuestionToken(declaration);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.isOptionalParameter","kind":"method","status":"implemented","sigHash":"a33c389e91bdf8308a9af4b620e8ac9736193585890808a159e986906440ede4","bodyHash":"b8e6d5333a56ef3d4424c7fba114aaf7015a156214bf858ee37075788f8d6316"}
 *
 * Go source:
 * func (c *Checker) isOptionalParameter(node *ast.Node) bool {
 * 	// !!! TODO: JSDoc support
 * 	if ast.IsParameterDeclaration(node) && node.QuestionToken() != nil {
 * 		return true
 * 	}
 * 	if !ast.IsParameterDeclaration(node) {
 * 		return false
 * 	}
 * 	if node.Initializer() != nil {
 * 		signature := c.getSignatureFromDeclaration(node.Parent)
 * 		parameterIndex := core.FindIndex(node.Parent.Parameters(), func(p *ast.ParameterDeclarationNode) bool { return p == node })
 * 		debug.Assert(parameterIndex >= 0)
 * 		// Only consider syntactic or instantiated parameters as optional, not `void` parameters as this function is used
 * 		// in grammar checks and checking for `void` too early results in parameter types widening too early
 * 		// and causes some noImplicitAny errors to be lost.
 * 		return parameterIndex >= c.getMinArgumentCountEx(signature, MinArgumentCountFlagsStrongArityForUntypedJS|MinArgumentCountFlagsVoidIsNonOptional)
 * 	}
 * 	iife := ast.GetImmediatelyInvokedFunctionExpression(node.Parent)
 * 	if iife != nil {
 * 		parameterIndex := core.FindIndex(node.Parent.Parameters(), func(p *ast.ParameterDeclarationNode) bool { return p == node })
 * 		return node.Type() == nil &&
 * 			node.AsParameterDeclaration().DotDotDotToken == nil &&
 * 			parameterIndex >= len(c.getEffectiveCallArguments(iife))
 * 	}
 * 	return false
 * }
 */
export function Checker_isOptionalParameter(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  // !!! TODO: JSDoc support
  if (IsParameterDeclaration(node) && HasQuestionToken(node)) {
    return true as bool;
  }
  if (!IsParameterDeclaration(node)) {
    return false as bool;
  }
  if (Node_Initializer(node) !== undefined) {
    const signature = Checker_getSignatureFromDeclaration(receiver, node!.Parent);
    const parameterIndex = Node_Parameters(node!.Parent).findIndex((p) => p === node);
    Assert((parameterIndex >= 0) as bool);
    // Only consider syntactic or instantiated parameters as optional, not `void` parameters as this function is used
    // in grammar checks and checking for `void` too early results in parameter types widening too early
    // and causes some noImplicitAny errors to be lost.
    return (parameterIndex >= Checker_getMinArgumentCountEx(receiver, signature, (MinArgumentCountFlagsStrongArityForUntypedJS | MinArgumentCountFlagsVoidIsNonOptional) as MinArgumentCountFlags)) as bool;
  }
  const iife = GetImmediatelyInvokedFunctionExpression(node!.Parent);
  if (iife !== undefined) {
    const parameterIndex = Node_Parameters(node!.Parent).findIndex((p) => p === node);
    return (Node_Type(node) === undefined &&
      AsParameterDeclaration(node)!.DotDotDotToken === undefined &&
      parameterIndex >= Checker_getEffectiveCallArguments(receiver, iife).length) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isEmptyArrayLiteral","kind":"func","status":"implemented","sigHash":"22702a07a201f8640015cd0efca6b5e437f2682c09f35283c8cd6e37a65a28b7","bodyHash":"3a1efa1c45a69775ca999576f55ac7ae15bf852a0ec944cc63d6f01b2190c167"}
 *
 * Go source:
 * func isEmptyArrayLiteral(expression *ast.Node) bool {
 * 	return ast.IsArrayLiteralExpression(expression) && len(expression.Elements()) == 0
 * }
 */
export function isEmptyArrayLiteral(expression: GoPtr<Node>): bool {
  return (IsArrayLiteralExpression(expression) && (Node_Elements(expression) ?? []).length === 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::declarationBelongsToPrivateAmbientMember","kind":"func","status":"implemented","sigHash":"f976dfd806168bccabcfa02a573fbe46104f47f0c24096265ee49cd6d13ad0c1","bodyHash":"aeaf2eb61f3bb875ddce3a01ff57e3b6d250175aa65d7dbba42a75a570eb9f49"}
 *
 * Go source:
 * func declarationBelongsToPrivateAmbientMember(declaration *ast.Node) bool {
 * 	root := ast.GetRootDeclaration(declaration)
 * 	memberDeclaration := root
 * 	if root.Kind == ast.KindParameter {
 * 		memberDeclaration = root.Parent
 * 	}
 * 	return isPrivateWithinAmbient(memberDeclaration)
 * }
 */
export function declarationBelongsToPrivateAmbientMember(declaration: GoPtr<Node>): bool {
  const root = GetRootDeclaration(declaration);
  const memberDeclaration = root!.Kind === KindParameter ? root!.Parent : root;
  return isPrivateWithinAmbient(memberDeclaration);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isPrivateWithinAmbient","kind":"func","status":"implemented","sigHash":"3934a1399a6d87d4c7f30c4c6de767ceee17c7cbefcd4232a6ae98be079794c0","bodyHash":"6bc8d97569ab806253073db80aed37e47e3f95b3433cca0ca13b20fdf23ded4e"}
 *
 * Go source:
 * func isPrivateWithinAmbient(node *ast.Node) bool {
 * 	return (ast.HasModifier(node, ast.ModifierFlagsPrivate) || ast.IsPrivateIdentifierClassElementDeclaration(node)) && node.Flags&ast.NodeFlagsAmbient != 0
 * }
 */
export function isPrivateWithinAmbient(node: GoPtr<Node>): bool {
  return ((HasModifier(node, ModifierFlagsPrivate) || IsPrivateIdentifierClassElementDeclaration(node)) && (node!.Flags & NodeFlagsAmbient) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isTypeAssertion","kind":"func","status":"implemented","sigHash":"9adc94f22f53e197e3c8738a1131da48c7042628a95a1085a381aba88d67c31d","bodyHash":"5d9244edd4d550e806bc5976a19d9df9f7f53dd27ea48bcbcc8cd7ed1ce99f11"}
 *
 * Go source:
 * func isTypeAssertion(node *ast.Node) bool {
 * 	return ast.IsAssertionExpression(ast.SkipParentheses(node))
 * }
 */
export function isTypeAssertion(node: GoPtr<Node>): bool {
  return IsAssertionExpression(SkipParentheses(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::createSymbolTable","kind":"func","status":"implemented","sigHash":"c3241e8f79ea5297aa8c56f8b2c032214bc54e288731c22927d251ccb683f954","bodyHash":"38a004dc9b6d5d80e01a05918c9d463b44910b5a26807eb54e62f55313a7d233"}
 *
 * Go source:
 * func createSymbolTable(symbols []*ast.Symbol) ast.SymbolTable {
 * 	if len(symbols) == 0 {
 * 		return nil
 * 	}
 * 	result := make(ast.SymbolTable)
 * 	for _, symbol := range symbols {
 * 		result[symbol.Name] = symbol
 * 	}
 * 	return result
 * }
 */
export function createSymbolTable(symbols: GoSlice<GoPtr<Symbol>>): SymbolTable {
  if (symbols.length === 0) {
    return undefined as unknown as SymbolTable;
  }
  const result: SymbolTable = new globalThis.Map<string, GoPtr<Symbol>>();
  for (const symbol of symbols) {
    result.set(symbol!.Name, symbol);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.sortSymbols","kind":"method","status":"implemented","sigHash":"75628652db8bd88ec91b85a420992b338aa3187f6fe1cfe67663fc2755f1a184","bodyHash":"e7a2cea0071350200244b2e758bb8bd38d6703e256d824dc71fa674871f2fb4a"}
 *
 * Go source:
 * func (c *Checker) sortSymbols(symbols []*ast.Symbol) {
 * 	slices.SortFunc(symbols, c.compareSymbols)
 * }
 */
export function Checker_sortSymbols(receiver: GoPtr<Checker>, symbols: GoSlice<GoPtr<Symbol>>): void {
  symbols.sort((s1, s2) => receiver!.compareSymbols(s1, s2));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.compareSymbolsWorker","kind":"method","status":"implemented","sigHash":"a5fd24773e16e016b610528201ba31244cde2ff517a96997e30f896722ada22d","bodyHash":"655ff032e023a6aba67cb90182dd47ad37d7df9b3e6bcb27692142e59a67b375"}
 *
 * Go source:
 * func (c *Checker) compareSymbolsWorker(s1, s2 *ast.Symbol) int {
 * 	if s1 == s2 {
 * 		return 0
 * 	}
 * 	if s1 == nil {
 * 		return 1
 * 	}
 * 	if s2 == nil {
 * 		return -1
 * 	}
 * 	if len(s1.Declarations) != 0 && len(s2.Declarations) != 0 {
 * 		if r := c.compareNodes(s1.Declarations[0], s2.Declarations[0]); r != 0 {
 * 			return r
 * 		}
 * 	} else if len(s1.Declarations) != 0 {
 * 		return -1
 * 	} else if len(s2.Declarations) != 0 {
 * 		return 1
 * 	}
 * 	if r := strings.Compare(s1.Name, s2.Name); r != 0 {
 * 		return r
 * 	}
 * 	// Fall back to symbol IDs. This is a last resort that should happen only when symbols have
 * 	// no declaration and duplicate names.
 * 	return int(ast.GetSymbolId(s1)) - int(ast.GetSymbolId(s2))
 * }
 */
export function Checker_compareSymbolsWorker(receiver: GoPtr<Checker>, s1: GoPtr<Symbol>, s2: GoPtr<Symbol>): int {
  if (s1 === s2) {
    return 0;
  }
  if (s1 === undefined) {
    return 1;
  }
  if (s2 === undefined) {
    return -1;
  }
  const declarations1 = s1!.Declarations ?? [];
  const declarations2 = s2!.Declarations ?? [];
  if (declarations1.length !== 0 && declarations2.length !== 0) {
    const r = Checker_compareNodes(receiver, declarations1[0], declarations2[0]);
    if (r !== 0) {
      return r;
    }
  } else if (declarations1.length !== 0) {
    return -1;
  } else if (declarations2.length !== 0) {
    return 1;
  }
  const r = strings_Compare(s1!.Name, s2!.Name);
  if (r !== 0) {
    return r;
  }
  // Fall back to symbol IDs. This is a last resort that should happen only when symbols have
  // no declaration and duplicate names.
  return (GetSymbolId(s1) as int) - (GetSymbolId(s2) as int);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.compareNodes","kind":"method","status":"implemented","sigHash":"bbd1344ccfdfdbdcb9f58fba9d44d343e42da4ad29e0b0657d538ccbef7310d4","bodyHash":"090b14d9bbba4f21dd7ad94ddbfdbd296ed507d3c90d59fe1a2daa3170ad3cf2"}
 *
 * Go source:
 * func (c *Checker) compareNodes(n1, n2 *ast.Node) int {
 * 	if n1 == n2 {
 * 		return 0
 * 	}
 * 	if n1 == nil {
 * 		return 1
 * 	}
 * 	if n2 == nil {
 * 		return -1
 * 	}
 * 	s1 := ast.GetSourceFileOfNode(n1)
 * 	s2 := ast.GetSourceFileOfNode(n2)
 * 	if s1 != s2 {
 * 		f1 := c.fileIndexMap[s1]
 * 		f2 := c.fileIndexMap[s2]
 * 		// Order by index of file in the containing program
 * 		return f1 - f2
 * 	}
 * 	// In the same file, order by source position
 * 	return n1.Pos() - n2.Pos()
 * }
 */
export function Checker_compareNodes(receiver: GoPtr<Checker>, n1: GoPtr<Node>, n2: GoPtr<Node>): int {
  if (n1 === n2) {
    return 0;
  }
  if (n1 === undefined) {
    return 1;
  }
  if (n2 === undefined) {
    return -1;
  }
  const s1 = GetSourceFileOfNode(n1);
  const s2 = GetSourceFileOfNode(n2);
  if (s1 !== s2) {
    const f1 = receiver!.fileIndexMap.get(s1) ?? 0;
    const f2 = receiver!.fileIndexMap.get(s2) ?? 0;
    // Order by index of file in the containing program
    return f1 - f2;
  }
  // In the same file, order by source position
  return Node_Pos(n1) - Node_Pos(n2);
}

function compareNumbers(n1: number, n2: number): int {
  if (n1 < n2) {
    return -1;
  }
  if (n1 > n2) {
    return 1;
  }
  return 0;
}

function compareStringLists(s1: GoSlice<string>, s2: GoSlice<string>): int {
  const a1 = s1 ?? [];
  const a2 = s2 ?? [];
  if (a1.length !== a2.length) {
    return a1.length - a2.length;
  }
  for (let i = 0; i < a1.length; i++) {
    const c = strings_Compare(a1[i]!, a2[i]!);
    if (c !== 0) {
      return c;
    }
  }
  return 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::CompareTypes","kind":"func","status":"implemented","sigHash":"b1aaf14ab8ae2eeba38af44d23e0769b342c4e00d993cdc3c147b1752dce6845","bodyHash":"dfc0c546b5d68898a3a8ff6a5f9b6dcd2c81003d098954a70f0a6f45e84ebce1"}
 *
 * Go source:
 * func CompareTypes(t1, t2 *Type) int {
 * 	if t1 == t2 {
 * 		return 0
 * 	}
 * 	if t1 == nil {
 * 		return -1
 * 	}
 * 	if t2 == nil {
 * 		return 1
 * 	}
 * 	if t1.checker != t2.checker {
 * 		panic("Cannot compare types from different checkers")
 * 	}
 * 	// First sort in order of increasing type flags values.
 * 	if c := getSortOrderFlags(t1) - getSortOrderFlags(t2); c != 0 {
 * 		return c
 * 	}
 * 	// Order named types by name and, in the case of aliased types, by alias type arguments.
 * 	if c := compareTypeNames(t1, t2); c != 0 {
 * 		return c
 * 	}
 * 	// We have unnamed types or types with identical names. Now sort by data specific to the type.
 * 	switch {
 * 	case t1.flags&(TypeFlagsAny|TypeFlagsUnknown|TypeFlagsString|TypeFlagsNumber|TypeFlagsBoolean|TypeFlagsBigInt|TypeFlagsESSymbol|TypeFlagsVoid|TypeFlagsUndefined|TypeFlagsNull|TypeFlagsNever|TypeFlagsNonPrimitive) != 0:
 * 		// Only distinguished by type IDs, handled below.
 * 	case t1.flags&TypeFlagsObject != 0:
 * 		// Order unnamed or identically named object types by symbol.
 * 		if c := t1.checker.compareSymbols(t1.symbol, t2.symbol); c != 0 {
 * 			return c
 * 		}
 * 		// When object types have the same or no symbol, order by kind. We order type references before other kinds.
 * 		if t1.objectFlags&ObjectFlagsReference != 0 && t2.objectFlags&ObjectFlagsReference != 0 {
 * 			r1 := t1.AsTypeReference()
 * 			r2 := t2.AsTypeReference()
 * 			if r1.target.objectFlags&ObjectFlagsTuple != 0 && r2.target.objectFlags&ObjectFlagsTuple != 0 {
 * 				// Tuple types have no associated symbol, instead we order by tuple element information.
 * 				if c := compareTupleTypes(r1.target.AsTupleType(), r2.target.AsTupleType()); c != 0 {
 * 					return c
 * 				}
 * 			}
 * 			// Here we know we have references to instantiations of the same type because we have matching targets.
 * 			if r1.node == nil && r2.node == nil {
 * 				// Non-deferred type references with the same target are sorted by their type argument lists.
 * 				if c := compareTypeLists(t1.AsTypeReference().resolvedTypeArguments, t2.AsTypeReference().resolvedTypeArguments); c != 0 {
 * 					return c
 * 				}
 * 			} else {
 * 				// Deferred type references with the same target are ordered by the source location of the reference.
 * 				if c := t1.checker.compareNodes(r1.node, r2.node); c != 0 {
 * 					return c
 * 				}
 * 				// Instantiations of the same deferred type reference are ordered by their associated type mappers
 * 				// (which reflect the mapping of in-scope type parameters to type arguments).
 * 				if c := compareTypeMappers(t1.AsObjectType().mapper, t2.AsObjectType().mapper); c != 0 {
 * 					return c
 * 				}
 * 			}
 * 		} else if t1.objectFlags&ObjectFlagsReference != 0 {
 * 			return -1
 * 		} else if t2.objectFlags&ObjectFlagsReference != 0 {
 * 			return 1
 * 		} else {
 * 			// Order unnamed non-reference object types by kind associated type mappers. Reverse mapped types have
 * 			// neither symbols nor mappers so they're ultimately ordered by unstable type IDs, but given their rarity
 * 			// this should be fine.
 * 			if c := int(t1.objectFlags&ObjectFlagsObjectTypeKindMask) - int(t2.objectFlags&ObjectFlagsObjectTypeKindMask); c != 0 {
 * 				return c
 * 			}
 * 			if c := compareTypeMappers(t1.AsObjectType().mapper, t2.AsObjectType().mapper); c != 0 {
 * 				return c
 * 			}
 * 		}
 * 	case t1.flags&TypeFlagsUnion != 0:
 * 		// Unions are ordered by origin and then constituent type lists.
 * 		o1 := t1.AsUnionType().origin
 * 		o2 := t2.AsUnionType().origin
 * 		if o1 == nil && o2 == nil {
 * 			if c := compareTypeLists(t1.Types(), t2.Types()); c != 0 {
 * 				return c
 * 			}
 * 		} else if o1 == nil {
 * 			return 1
 * 		} else if o2 == nil {
 * 			return -1
 * 		} else {
 * 			if c := CompareTypes(o1, o2); c != 0 {
 * 				return c
 * 			}
 * 		}
 * 	case t1.flags&TypeFlagsIntersection != 0:
 * 		// Intersections are ordered by their constituent type lists.
 * 		if c := compareTypeLists(t1.Types(), t2.Types()); c != 0 {
 * 			return c
 * 		}
 * 	case t1.flags&(TypeFlagsEnum|TypeFlagsEnumLiteral|TypeFlagsUniqueESSymbol) != 0:
 * 		// Enum members are ordered by their symbol (and thus their declaration order).
 * 		if c := t1.checker.compareSymbols(t1.symbol, t2.symbol); c != 0 {
 * 			return c
 * 		}
 * 	case t1.flags&TypeFlagsStringLiteral != 0:
 * 		// String literal types are ordered by their values.
 * 		if c := strings.Compare(t1.AsLiteralType().value.(string), t2.AsLiteralType().value.(string)); c != 0 {
 * 			return c
 * 		}
 * 	case t1.flags&TypeFlagsNumberLiteral != 0:
 * 		// Numeric literal types are ordered by their values.
 * 		if c := cmp.Compare(t1.AsLiteralType().value.(jsnum.Number), t2.AsLiteralType().value.(jsnum.Number)); c != 0 {
 * 			return c
 * 		}
 * 	case t1.flags&TypeFlagsBooleanLiteral != 0:
 * 		b1 := t1.AsLiteralType().value.(bool)
 * 		b2 := t2.AsLiteralType().value.(bool)
 * 		if b1 != b2 {
 * 			if b1 {
 * 				return 1
 * 			}
 * 			return -1
 * 		}
 * 	case t1.flags&TypeFlagsTypeParameter != 0:
 * 		if c := t1.checker.compareSymbols(t1.symbol, t2.symbol); c != 0 {
 * 			return c
 * 		}
 * 	case t1.flags&TypeFlagsIndex != 0:
 * 		if c := CompareTypes(t1.AsIndexType().target, t2.AsIndexType().target); c != 0 {
 * 			return c
 * 		}
 * 		if c := int(t1.AsIndexType().indexFlags) - int(t2.AsIndexType().indexFlags); c != 0 {
 * 			return c
 * 		}
 * 	case t1.flags&TypeFlagsIndexedAccess != 0:
 * 		if c := CompareTypes(t1.AsIndexedAccessType().objectType, t2.AsIndexedAccessType().objectType); c != 0 {
 * 			return c
 * 		}
 * 		if c := CompareTypes(t1.AsIndexedAccessType().indexType, t2.AsIndexedAccessType().indexType); c != 0 {
 * 			return c
 * 		}
 * 	case t1.flags&TypeFlagsConditional != 0:
 * 		if c := t1.checker.compareNodes(t1.AsConditionalType().root.node.AsNode(), t2.AsConditionalType().root.node.AsNode()); c != 0 {
 * 			return c
 * 		}
 * 		if c := compareTypeMappers(t1.AsConditionalType().mapper, t2.AsConditionalType().mapper); c != 0 {
 * 			return c
 * 		}
 * 	case t1.flags&TypeFlagsSubstitution != 0:
 * 		if c := CompareTypes(t1.AsSubstitutionType().baseType, t2.AsSubstitutionType().baseType); c != 0 {
 * 			return c
 * 		}
 * 		if c := CompareTypes(t1.AsSubstitutionType().constraint, t2.AsSubstitutionType().constraint); c != 0 {
 * 			return c
 * 		}
 * 	case t1.flags&TypeFlagsTemplateLiteral != 0:
 * 		if c := slices.Compare(t1.AsTemplateLiteralType().texts, t2.AsTemplateLiteralType().texts); c != 0 {
 * 			return c
 * 		}
 * 		if c := compareTypeLists(t1.AsTemplateLiteralType().types, t2.AsTemplateLiteralType().types); c != 0 {
 * 			return c
 * 		}
 * 	case t1.flags&TypeFlagsStringMapping != 0:
 * 		if c := CompareTypes(t1.AsStringMappingType().target, t2.AsStringMappingType().target); c != 0 {
 * 			return c
 * 		}
 * 	}
 * 	// Fall back to type IDs. This results in type creation order for built-in types.
 * 	return int(t1.id) - int(t2.id)
 * }
 */
export function CompareTypes(t1: GoPtr<Type>, t2: GoPtr<Type>): int {
  if (t1 === t2) {
    return 0;
  }
  if (t1 === undefined) {
    return -1;
  }
  if (t2 === undefined) {
    return 1;
  }
  if (t1!.checker !== t2!.checker) {
    throw new globalThis.Error("Cannot compare types from different checkers");
  }
  // First sort in order of increasing type flags values.
  const sortOrder = getSortOrderFlags(t1) - getSortOrderFlags(t2);
  if (sortOrder !== 0) {
    return sortOrder;
  }
  // Order named types by name and, in the case of aliased types, by alias type arguments.
  const names = compareTypeNames(t1, t2);
  if (names !== 0) {
    return names;
  }
  // We have unnamed types or types with identical names. Now sort by data specific to the type.
  if ((t1!.flags & (TypeFlagsAny | TypeFlagsUnknown | TypeFlagsString | TypeFlagsNumber | TypeFlagsBoolean | TypeFlagsBigInt | TypeFlagsESSymbol | TypeFlagsVoid | TypeFlagsUndefined | TypeFlagsNull | TypeFlagsNever | TypeFlagsNonPrimitive)) !== 0) {
    // Only distinguished by type IDs, handled below.
  } else if ((t1!.flags & TypeFlagsObject) !== 0) {
    // Order unnamed or identically named object types by symbol.
    const symbols = t1!.checker!.compareSymbols(t1!.symbol, t2!.symbol);
    if (symbols !== 0) {
      return symbols;
    }
    // When object types have the same or no symbol, order by kind. We order type references before other kinds.
    if ((t1!.objectFlags & ObjectFlagsReference) !== 0 && (t2!.objectFlags & ObjectFlagsReference) !== 0) {
      const r1 = Type_AsTypeReference(t1);
      const r2 = Type_AsTypeReference(t2);
      if ((Type_Target(t1)!.objectFlags & ObjectFlagsTuple) !== 0 && (Type_Target(t2)!.objectFlags & ObjectFlagsTuple) !== 0) {
        // Tuple types have no associated symbol, instead we order by tuple element information.
        const tuples = compareTupleTypes(Type_AsTupleType(Type_Target(t1)), Type_AsTupleType(Type_Target(t2)));
        if (tuples !== 0) {
          return tuples;
        }
      }
      // Here we know we have references to instantiations of the same type because we have matching targets.
      if (r1!.node === undefined && r2!.node === undefined) {
        // Non-deferred type references with the same target are sorted by their type argument lists.
        const typeArguments = compareTypeLists(r1!.resolvedTypeArguments, r2!.resolvedTypeArguments);
        if (typeArguments !== 0) {
          return typeArguments;
        }
      } else {
        // Deferred type references with the same target are ordered by the source location of the reference.
        const nodes = Checker_compareNodes(t1!.checker, r1!.node, r2!.node);
        if (nodes !== 0) {
          return nodes;
        }
        // Instantiations of the same deferred type reference are ordered by their associated type mappers
        // (which reflect the mapping of in-scope type parameters to type arguments).
        const mappers = compareTypeMappers(Type_AsObjectType(t1)!.mapper, Type_AsObjectType(t2)!.mapper);
        if (mappers !== 0) {
          return mappers;
        }
      }
    } else if ((t1!.objectFlags & ObjectFlagsReference) !== 0) {
      return -1;
    } else if ((t2!.objectFlags & ObjectFlagsReference) !== 0) {
      return 1;
    } else {
      // Order unnamed non-reference object types by kind associated type mappers. Reverse mapped types have
      // neither symbols nor mappers so they're ultimately ordered by unstable type IDs, but given their rarity
      // this should be fine.
      const objectKind = (t1!.objectFlags & ObjectFlagsObjectTypeKindMask) - (t2!.objectFlags & ObjectFlagsObjectTypeKindMask);
      if (objectKind !== 0) {
        return objectKind;
      }
      const mappers = compareTypeMappers(Type_AsObjectType(t1)!.mapper, Type_AsObjectType(t2)!.mapper);
      if (mappers !== 0) {
        return mappers;
      }
    }
  } else if ((t1!.flags & TypeFlagsUnion) !== 0) {
    // Unions are ordered by origin and then constituent type lists.
    const o1 = Type_AsUnionType(t1)!.origin;
    const o2 = Type_AsUnionType(t2)!.origin;
    if (o1 === undefined && o2 === undefined) {
      const types = compareTypeLists(Type_Types(t1), Type_Types(t2));
      if (types !== 0) {
        return types;
      }
    } else if (o1 === undefined) {
      return 1;
    } else if (o2 === undefined) {
      return -1;
    } else {
      const origins = CompareTypes(o1, o2);
      if (origins !== 0) {
        return origins;
      }
    }
  } else if ((t1!.flags & TypeFlagsIntersection) !== 0) {
    // Intersections are ordered by their constituent type lists.
    const types = compareTypeLists(Type_Types(t1), Type_Types(t2));
    if (types !== 0) {
      return types;
    }
  } else if ((t1!.flags & (TypeFlagsEnum | TypeFlagsEnumLiteral | TypeFlagsUniqueESSymbol)) !== 0) {
    // Enum members are ordered by their symbol (and thus their declaration order).
    const symbols = t1!.checker!.compareSymbols(t1!.symbol, t2!.symbol);
    if (symbols !== 0) {
      return symbols;
    }
  } else if ((t1!.flags & TypeFlagsStringLiteral) !== 0) {
    // String literal types are ordered by their values.
    const strings = strings_Compare(Type_AsLiteralType(t1)!.value as string, Type_AsLiteralType(t2)!.value as string);
    if (strings !== 0) {
      return strings;
    }
  } else if ((t1!.flags & TypeFlagsNumberLiteral) !== 0) {
    // Numeric literal types are ordered by their values.
    const numbers = compareNumbers(Type_AsLiteralType(t1)!.value as number, Type_AsLiteralType(t2)!.value as number);
    if (numbers !== 0) {
      return numbers;
    }
  } else if ((t1!.flags & TypeFlagsBooleanLiteral) !== 0) {
    const b1 = Type_AsLiteralType(t1)!.value as bool;
    const b2 = Type_AsLiteralType(t2)!.value as bool;
    if (b1 !== b2) {
      if (b1) {
        return 1;
      }
      return -1;
    }
  } else if ((t1!.flags & TypeFlagsTypeParameter) !== 0) {
    const symbols = t1!.checker!.compareSymbols(t1!.symbol, t2!.symbol);
    if (symbols !== 0) {
      return symbols;
    }
  } else if ((t1!.flags & TypeFlagsIndex) !== 0) {
    const targets = CompareTypes(Type_AsIndexType(t1)!.target, Type_AsIndexType(t2)!.target);
    if (targets !== 0) {
      return targets;
    }
    const flags = Type_AsIndexType(t1)!.indexFlags - Type_AsIndexType(t2)!.indexFlags;
    if (flags !== 0) {
      return flags;
    }
  } else if ((t1!.flags & TypeFlagsIndexedAccess) !== 0) {
    const objects = CompareTypes(Type_AsIndexedAccessType(t1)!.objectType, Type_AsIndexedAccessType(t2)!.objectType);
    if (objects !== 0) {
      return objects;
    }
    const indexes = CompareTypes(Type_AsIndexedAccessType(t1)!.indexType, Type_AsIndexedAccessType(t2)!.indexType);
    if (indexes !== 0) {
      return indexes;
    }
  } else if ((t1!.flags & TypeFlagsConditional) !== 0) {
    const nodes = Checker_compareNodes(
      t1!.checker,
      Type_AsConditionalType(t1)!.root!.node as GoPtr<Node>,
      Type_AsConditionalType(t2)!.root!.node as GoPtr<Node>,
    );
    if (nodes !== 0) {
      return nodes;
    }
    const mappers = compareTypeMappers(Type_AsConditionalType(t1)!.mapper, Type_AsConditionalType(t2)!.mapper);
    if (mappers !== 0) {
      return mappers;
    }
  } else if ((t1!.flags & TypeFlagsSubstitution) !== 0) {
    const bases = CompareTypes(Type_AsSubstitutionType(t1)!.baseType, Type_AsSubstitutionType(t2)!.baseType);
    if (bases !== 0) {
      return bases;
    }
    const constraints = CompareTypes(Type_AsSubstitutionType(t1)!.constraint, Type_AsSubstitutionType(t2)!.constraint);
    if (constraints !== 0) {
      return constraints;
    }
  } else if ((t1!.flags & TypeFlagsTemplateLiteral) !== 0) {
    const texts = compareStringLists(Type_AsTemplateLiteralType(t1)!.texts, Type_AsTemplateLiteralType(t2)!.texts);
    if (texts !== 0) {
      return texts;
    }
    const types = compareTypeLists(Type_AsTemplateLiteralType(t1)!.types, Type_AsTemplateLiteralType(t2)!.types);
    if (types !== 0) {
      return types;
    }
  } else if ((t1!.flags & TypeFlagsStringMapping) !== 0) {
    const targets = CompareTypes(Type_AsStringMappingType(t1)!.target, Type_AsStringMappingType(t2)!.target);
    if (targets !== 0) {
      return targets;
    }
  }
  // Fall back to type IDs. This results in type creation order for built-in types.
  return (t1!.id as int) - (t2!.id as int);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getSortOrderFlags","kind":"func","status":"implemented","sigHash":"496efb78e44a3196b68781c0bed715b81f1f73c0c9255b964700c2312e70b6d5","bodyHash":"29a0c6bb81db4f016f6e8c90d43d15103d705c48aa83cfa12e88830f57d2af4f"}
 *
 * Go source:
 * func getSortOrderFlags(t *Type) int {
 * 	// Return TypeFlagsEnum for all enum-like unit types (they'll be sorted by their symbols)
 * 	if t.flags&(TypeFlagsEnumLiteral|TypeFlagsEnum) != 0 && t.flags&TypeFlagsUnion == 0 {
 * 		return int(TypeFlagsEnum)
 * 	}
 * 	return int(t.flags)
 * }
 */
export function getSortOrderFlags(t: GoPtr<Type>): int {
  // Return TypeFlagsEnum for all enum-like unit types (they'll be sorted by their symbols)
  if ((t!.flags & (TypeFlagsEnumLiteral | TypeFlagsEnum)) !== 0 && (t!.flags & TypeFlagsUnion) === 0) {
    return TypeFlagsEnum as int;
  }
  return t!.flags as int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::compareTypeNames","kind":"func","status":"implemented","sigHash":"0d77697874ee5cedc213f37d7a199b9917d72a55f8dcc6f13bff922f20c677c4","bodyHash":"874174603d71042e4a10a613e631f6a22b47677aa145b17fac8f58bc3dfbe1c8"}
 *
 * Go source:
 * func compareTypeNames(t1, t2 *Type) int {
 * 	s1 := getTypeNameSymbol(t1)
 * 	s2 := getTypeNameSymbol(t2)
 * 	if s1 == s2 {
 * 		if t1.alias != nil {
 * 			return compareTypeLists(t1.alias.typeArguments, t2.alias.typeArguments)
 * 		}
 * 		return 0
 * 	}
 * 	if s1 == nil {
 * 		return 1
 * 	}
 * 	if s2 == nil {
 * 		return -1
 * 	}
 * 	return strings.Compare(s1.Name, s2.Name)
 * }
 */
export function compareTypeNames(t1: GoPtr<Type>, t2: GoPtr<Type>): int {
  const s1 = getTypeNameSymbol(t1);
  const s2 = getTypeNameSymbol(t2);
  if (s1 === s2) {
    if (t1!.alias !== undefined) {
      return compareTypeLists(t1!.alias!.typeArguments, t2!.alias!.typeArguments);
    }
    return 0;
  }
  if (s1 === undefined) {
    return 1;
  }
  if (s2 === undefined) {
    return -1;
  }
  return strings_Compare(s1!.Name, s2!.Name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getTypeNameSymbol","kind":"func","status":"implemented","sigHash":"a19e938ecd63af23b269314042f3a893958749a5d475cdbfb3aa09c5f82586b0","bodyHash":"5741314761d45e1dc7adbeb5546f767bcd1618a1173dab09d5ef15bf46cc1cfa"}
 *
 * Go source:
 * func getTypeNameSymbol(t *Type) *ast.Symbol {
 * 	if t.alias != nil {
 * 		return t.alias.symbol
 * 	}
 * 	if t.flags&(TypeFlagsTypeParameter|TypeFlagsStringMapping) != 0 || t.objectFlags&(ObjectFlagsClassOrInterface|ObjectFlagsReference) != 0 {
 * 		return t.symbol
 * 	}
 * 	return nil
 * }
 */
export function getTypeNameSymbol(t: GoPtr<Type>): GoPtr<Symbol> {
  if (t!.alias !== undefined) {
    return t!.alias!.symbol;
  }
  if ((t!.flags & (TypeFlagsTypeParameter | TypeFlagsStringMapping)) !== 0 || (t!.objectFlags & (ObjectFlagsClassOrInterface | ObjectFlagsReference)) !== 0) {
    return t!.symbol;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getObjectTypeName","kind":"func","status":"implemented","sigHash":"2b3d11f2763282c62134ec20801891941c4d05d2ee70a392f408844e174fbcff","bodyHash":"62a651145ac20f23b2c7f2bba6b7760b74553085b18c5faf540e92f737958c3e"}
 *
 * Go source:
 * func getObjectTypeName(t *Type) *ast.Symbol {
 * 	if t.objectFlags&(ObjectFlagsClassOrInterface|ObjectFlagsReference) != 0 {
 * 		return t.symbol
 * 	}
 * 	return nil
 * }
 */
export function getObjectTypeName(t: GoPtr<Type>): GoPtr<Symbol> {
  if ((t!.objectFlags & (ObjectFlagsClassOrInterface | ObjectFlagsReference)) !== 0) {
    return t!.symbol;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::compareTupleTypes","kind":"func","status":"implemented","sigHash":"96595b4fbfa51a7a2f9fc131755545ed29b6305031c00b762a5811f99601c0ce","bodyHash":"df33febd57855750ebb5bee909709cfb0b3c6d0ede71dfad6ccef7887bcfcd95"}
 *
 * Go source:
 * func compareTupleTypes(t1, t2 *TupleType) int {
 * 	if t1 == t2 {
 * 		return 0
 * 	}
 * 	if t1.readonly != t2.readonly {
 * 		return core.IfElse(t1.readonly, 1, -1)
 * 	}
 * 	if len(t1.elementInfos) != len(t2.elementInfos) {
 * 		return len(t1.elementInfos) - len(t2.elementInfos)
 * 	}
 * 	for i := range t1.elementInfos {
 * 		if c := int(t1.elementInfos[i].flags) - int(t2.elementInfos[i].flags); c != 0 {
 * 			return c
 * 		}
 * 	}
 * 	for i := range t1.elementInfos {
 * 		if c := compareElementLabels(t1.elementInfos[i].labeledDeclaration, t2.elementInfos[i].labeledDeclaration); c != 0 {
 * 			return c
 * 		}
 * 	}
 * 	return 0
 * }
 */
export function compareTupleTypes(t1: GoPtr<TupleType>, t2: GoPtr<TupleType>): int {
  if (t1 === t2) {
    return 0;
  }
  if (t1!.readonly !== t2!.readonly) {
    return t1!.readonly ? 1 : -1;
  }
  if (t1!.elementInfos.length !== t2!.elementInfos.length) {
    return t1!.elementInfos.length - t2!.elementInfos.length;
  }
  for (let i = 0; i < t1!.elementInfos.length; i++) {
    const flags = t1!.elementInfos[i]!.flags - t2!.elementInfos[i]!.flags;
    if (flags !== 0) {
      return flags;
    }
  }
  for (let i = 0; i < t1!.elementInfos.length; i++) {
    const labels = compareElementLabels(t1!.elementInfos[i]!.labeledDeclaration, t2!.elementInfos[i]!.labeledDeclaration);
    if (labels !== 0) {
      return labels;
    }
  }
  return 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::compareElementLabels","kind":"func","status":"implemented","sigHash":"8ffbc9edab3a288f972b23d21a237b127495e99f0b8575935fcc57982084608f","bodyHash":"ee373237b1412aa4e63ac085fae86bb6d3615df61742d8fafe370c7490da6887"}
 *
 * Go source:
 * func compareElementLabels(n1, n2 *ast.Node) int {
 * 	if n1 == n2 {
 * 		return 0
 * 	}
 * 	if n1 == nil {
 * 		return -1
 * 	}
 * 	if n2 == nil {
 * 		return 1
 * 	}
 * 	return strings.Compare(n1.Name().Text(), n2.Name().Text())
 * }
 */
export function compareElementLabels(n1: GoPtr<Node>, n2: GoPtr<Node>): int {
  if (n1 === n2) {
    return 0;
  }
  if (n1 === undefined) {
    return -1;
  }
  if (n2 === undefined) {
    return 1;
  }
  return strings_Compare(Node_Text(Node_Name(n1)), Node_Text(Node_Name(n2)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::compareTypeLists","kind":"func","status":"implemented","sigHash":"76c69f7a46352298830c1948784250d2a3e4429fac753178387a02d95cad4567","bodyHash":"2d84f8b2b742a8e6dac070b80cc8c9527b580069ea9b376a8244ecaebe9e024b"}
 *
 * Go source:
 * func compareTypeLists(s1, s2 []*Type) int {
 * 	if len(s1) != len(s2) {
 * 		return len(s1) - len(s2)
 * 	}
 * 	for i, t1 := range s1 {
 * 		if c := CompareTypes(t1, s2[i]); c != 0 {
 * 			return c
 * 		}
 * 	}
 * 	return 0
 * }
 */
export function compareTypeLists(s1: GoSlice<GoPtr<Type>>, s2: GoSlice<GoPtr<Type>>): int {
  const a1 = s1 ?? [];
  const a2 = s2 ?? [];
  if (a1.length !== a2.length) {
    return a1.length - a2.length;
  }
  for (let i = 0; i < a1.length; i++) {
    const c = CompareTypes(a1[i], a2[i]);
    if (c !== 0) {
      return c;
    }
  }
  return 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::compareTypeMappers","kind":"func","status":"implemented","sigHash":"3a4ecca8848d27365884e768c5e2ee5d85969034445b74dc286f4160e75b6c5c","bodyHash":"a84901b91de51841fc151c1d714b88aa032eed0ebf8e6098e343dcdf280f139a"}
 *
 * Go source:
 * func compareTypeMappers(m1, m2 *TypeMapper) int {
 * 	if m1 == m2 {
 * 		return 0
 * 	}
 * 	if m1 == nil {
 * 		return 1
 * 	}
 * 	if m2 == nil {
 * 		return -1
 * 	}
 * 	kind1 := m1.Kind()
 * 	kind2 := m2.Kind()
 * 	if kind1 != kind2 {
 * 		return int(kind1) - int(kind2)
 * 	}
 * 	switch kind1 {
 * 	case TypeMapperKindSimple:
 * 		m1 := m1.data.(*SimpleTypeMapper)
 * 		m2 := m2.data.(*SimpleTypeMapper)
 * 		if c := CompareTypes(m1.source, m2.source); c != 0 {
 * 			return c
 * 		}
 * 		return CompareTypes(m1.target, m2.target)
 * 	case TypeMapperKindArray:
 * 		m1 := m1.data.(*ArrayTypeMapper)
 * 		m2 := m2.data.(*ArrayTypeMapper)
 * 		if c := compareTypeLists(m1.sources, m2.sources); c != 0 {
 * 			return c
 * 		}
 * 		return compareTypeLists(m1.targets, m2.targets)
 * 	case TypeMapperKindMerged:
 * 		m1 := m1.data.(*MergedTypeMapper)
 * 		m2 := m2.data.(*MergedTypeMapper)
 * 		if c := compareTypeMappers(m1.m1, m2.m1); c != 0 {
 * 			return c
 * 		}
 * 		return compareTypeMappers(m1.m2, m2.m2)
 * 	}
 * 	return 0
 * }
 */
export function compareTypeMappers(m1: GoPtr<TypeMapper>, m2: GoPtr<TypeMapper>): int {
  if (m1 === m2) {
    return 0;
  }
  if (m1 === undefined) {
    return 1;
  }
  if (m2 === undefined) {
    return -1;
  }
  const kind1 = TypeMapper_Kind(m1);
  const kind2 = TypeMapper_Kind(m2);
  if (kind1 !== kind2) {
    return kind1 - kind2;
  }
  switch (kind1) {
    case TypeMapperKindSimple: {
      const mapper1 = m1!.data[goReceiverKey] as GoPtr<SimpleTypeMapper>;
      const mapper2 = m2!.data[goReceiverKey] as GoPtr<SimpleTypeMapper>;
      const sources = CompareTypes(mapper1!.source, mapper2!.source);
      if (sources !== 0) {
        return sources;
      }
      return CompareTypes(mapper1!.target, mapper2!.target);
    }
    case TypeMapperKindArray: {
      const mapper1 = m1!.data[goReceiverKey] as GoPtr<ArrayTypeMapper>;
      const mapper2 = m2!.data[goReceiverKey] as GoPtr<ArrayTypeMapper>;
      const sources = compareTypeLists(mapper1!.sources, mapper2!.sources);
      if (sources !== 0) {
        return sources;
      }
      return compareTypeLists(mapper1!.targets, mapper2!.targets);
    }
    case TypeMapperKindMerged: {
      const mapper1 = m1!.data[goReceiverKey] as GoPtr<MergedTypeMapper>;
      const mapper2 = m2!.data[goReceiverKey] as GoPtr<MergedTypeMapper>;
      const first = compareTypeMappers(mapper1!.m1, mapper2!.m1);
      if (first !== 0) {
        return first;
      }
      return compareTypeMappers(mapper1!.m2, mapper2!.m2);
    }
  }
  return 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getDeclarationModifierFlagsFromSymbol","kind":"func","status":"implemented","sigHash":"4a54cfd7939a78e781d6fe36487a9b8a24c7f7fefc22f255b12d78b3910ab037","bodyHash":"e73a6e2507ca181216c8e5851d5f10e42eae68d810db867fd928c043dabee712"}
 *
 * Go source:
 * func getDeclarationModifierFlagsFromSymbol(s *ast.Symbol) ast.ModifierFlags {
 * 	return getDeclarationModifierFlagsFromSymbolEx(s, false /*isWrite* /)
 * }
 */
export function getDeclarationModifierFlagsFromSymbol(s: GoPtr<Symbol>): ModifierFlags {
  return getDeclarationModifierFlagsFromSymbolEx(s, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getDeclarationModifierFlagsFromSymbolEx","kind":"func","status":"implemented","sigHash":"7ba8ceadee573394a5320ee9e4a9eaaaa15fc9d80e451f626420206cf2c148ea","bodyHash":"dc2ff25da7644cf0ca66f29ca8135c6e0274f04b7913074f80bf2b9ed5a4ab25"}
 *
 * Go source:
 * func getDeclarationModifierFlagsFromSymbolEx(s *ast.Symbol, isWrite bool) ast.ModifierFlags {
 * 	if s.ValueDeclaration != nil {
 * 		var declaration *ast.Node
 * 		if isWrite {
 * 			declaration = core.Find(s.Declarations, ast.IsSetAccessorDeclaration)
 * 		}
 * 		if declaration == nil && s.Flags&ast.SymbolFlagsGetAccessor != 0 {
 * 			declaration = core.Find(s.Declarations, ast.IsGetAccessorDeclaration)
 * 		}
 * 		if declaration == nil {
 * 			declaration = s.ValueDeclaration
 * 		}
 * 		flags := ast.GetCombinedModifierFlags(declaration)
 * 		if s.Parent != nil && s.Parent.Flags&ast.SymbolFlagsClass != 0 {
 * 			return flags
 * 		}
 * 		return flags & ^ast.ModifierFlagsAccessibilityModifier
 * 	}
 * 	if s.CheckFlags&ast.CheckFlagsSynthetic != 0 {
 * 		var accessModifier ast.ModifierFlags
 * 		switch {
 * 		case s.CheckFlags&ast.CheckFlagsContainsPrivate != 0:
 * 			accessModifier = ast.ModifierFlagsPrivate
 * 		case s.CheckFlags&ast.CheckFlagsContainsPublic != 0:
 * 			accessModifier = ast.ModifierFlagsPublic
 * 		default:
 * 			accessModifier = ast.ModifierFlagsProtected
 * 		}
 * 		var staticModifier ast.ModifierFlags
 * 		if s.CheckFlags&ast.CheckFlagsContainsStatic != 0 {
 * 			staticModifier = ast.ModifierFlagsStatic
 * 		}
 * 		return accessModifier | staticModifier
 * 	}
 * 	if s.Flags&ast.SymbolFlagsPrototype != 0 {
 * 		return ast.ModifierFlagsPublic | ast.ModifierFlagsStatic
 * 	}
 * 	return ast.ModifierFlagsNone
 * }
 */
export function getDeclarationModifierFlagsFromSymbolEx(s: GoPtr<Symbol>, isWrite: bool): ModifierFlags {
  if (s!.ValueDeclaration !== undefined) {
    let declaration: GoPtr<Node> = undefined;
    if (isWrite) {
      declaration = Find(s!.Declarations ?? [], IsSetAccessorDeclaration);
    }
    if (declaration === undefined && (s!.Flags & SymbolFlagsGetAccessor) !== 0) {
      declaration = Find(s!.Declarations ?? [], IsGetAccessorDeclaration);
    }
    if (declaration === undefined) {
      declaration = s!.ValueDeclaration;
    }
    const flags = GetCombinedModifierFlags(declaration);
    if (s!.Parent !== undefined && (s!.Parent!.Flags & SymbolFlagsClass) !== 0) {
      return flags;
    }
    return (flags & ~ModifierFlagsAccessibilityModifier) as ModifierFlags;
  }
  if ((s!.CheckFlags & CheckFlagsSynthetic) !== 0) {
    let accessModifier: ModifierFlags;
    if ((s!.CheckFlags & CheckFlagsContainsPrivate) !== 0) {
      accessModifier = ModifierFlagsPrivate;
    } else if ((s!.CheckFlags & CheckFlagsContainsPublic) !== 0) {
      accessModifier = ModifierFlagsPublic;
    } else {
      accessModifier = ModifierFlagsProtected;
    }
    let staticModifier: ModifierFlags = ModifierFlagsNone;
    if ((s!.CheckFlags & CheckFlagsContainsStatic) !== 0) {
      staticModifier = ModifierFlagsStatic;
    }
    return (accessModifier | staticModifier) as ModifierFlags;
  }
  if ((s!.Flags & SymbolFlagsPrototype) !== 0) {
    return (ModifierFlagsPublic | ModifierFlagsStatic) as ModifierFlags;
  }
  return ModifierFlagsNone;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isExponentiationOperator","kind":"func","status":"implemented","sigHash":"c8b5bf3356f7180ba76969c4dde08927212f56d119aefaf1e7a865b11aaac2ef","bodyHash":"aa07d09de8039bb9c678c0f7fd6e922bbe60da687b0ff5b102b0e34c39116f81"}
 *
 * Go source:
 * func isExponentiationOperator(kind ast.Kind) bool {
 * 	return kind == ast.KindAsteriskAsteriskToken
 * }
 */
export function isExponentiationOperator(kind: Kind): bool {
  return (kind === KindAsteriskAsteriskToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isMultiplicativeOperator","kind":"func","status":"implemented","sigHash":"39124025a5f742cf4fc60c8a1228f0a8da33ec9646fb70c365129f7ca3f6517b","bodyHash":"8527c71e58a5e4720e0597e124d2985f924460ec9b0399f7c0522aa300f3fe0a"}
 *
 * Go source:
 * func isMultiplicativeOperator(kind ast.Kind) bool {
 * 	return kind == ast.KindAsteriskToken || kind == ast.KindSlashToken || kind == ast.KindPercentToken
 * }
 */
export function isMultiplicativeOperator(kind: Kind): bool {
  return (kind === KindAsteriskToken || kind === KindSlashToken || kind === KindPercentToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isMultiplicativeOperatorOrHigher","kind":"func","status":"implemented","sigHash":"7d4a2b9523711a854e4a61036cab07cc658de682c29e316880b973e1feb37329","bodyHash":"e0b639348c59e3aa3a51f05057dd0066b886515f216216c214aa5c775cca97b5"}
 *
 * Go source:
 * func isMultiplicativeOperatorOrHigher(kind ast.Kind) bool {
 * 	return isExponentiationOperator(kind) || isMultiplicativeOperator(kind)
 * }
 */
export function isMultiplicativeOperatorOrHigher(kind: Kind): bool {
  return (isExponentiationOperator(kind) || isMultiplicativeOperator(kind)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isAdditiveOperator","kind":"func","status":"implemented","sigHash":"ed5cb6076f00066311928ad9d6410eeb59ed945c1aa6f54589d243621831a36b","bodyHash":"ef5b563a1772ee41cecaf0e2104d1c919ad474743a090fde3230d355a8456eed"}
 *
 * Go source:
 * func isAdditiveOperator(kind ast.Kind) bool {
 * 	return kind == ast.KindPlusToken || kind == ast.KindMinusToken
 * }
 */
export function isAdditiveOperator(kind: Kind): bool {
  return (kind === KindPlusToken || kind === KindMinusToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isAdditiveOperatorOrHigher","kind":"func","status":"implemented","sigHash":"9c4d7ed0d775b4f7000c20f61268d58d9d104173bfbff6f9d90a405a629cee24","bodyHash":"3e3b2b42b6e573c1571c0d40d65198783dc0bbcb41ea91ddc7eef0a263c97d23"}
 *
 * Go source:
 * func isAdditiveOperatorOrHigher(kind ast.Kind) bool {
 * 	return isAdditiveOperator(kind) || isMultiplicativeOperatorOrHigher(kind)
 * }
 */
export function isAdditiveOperatorOrHigher(kind: Kind): bool {
  return (isAdditiveOperator(kind) || isMultiplicativeOperatorOrHigher(kind)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isShiftOperator","kind":"func","status":"implemented","sigHash":"d774b8503d3897961c1e735b9032c1bdf3244e78e528a88b07f2de88f9b5710d","bodyHash":"6a684c490ef9ca3b9a88c7203cfb890ce2b3da3ed5dcad68a80fc2ad1f056ac5"}
 *
 * Go source:
 * func isShiftOperator(kind ast.Kind) bool {
 * 	return kind == ast.KindLessThanLessThanToken || kind == ast.KindGreaterThanGreaterThanToken ||
 * 		kind == ast.KindGreaterThanGreaterThanGreaterThanToken
 * }
 */
export function isShiftOperator(kind: Kind): bool {
  return (kind === KindLessThanLessThanToken || kind === KindGreaterThanGreaterThanToken ||
    kind === KindGreaterThanGreaterThanGreaterThanToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isShiftOperatorOrHigher","kind":"func","status":"implemented","sigHash":"64dbabcea0b686826089cff1188013ee9a43505c144d8aba6f33a902d3d6194a","bodyHash":"99bbfd1d30cafa71c126264e4cdb94fee1e6a7a28fc026a5396c58f450a81d9b"}
 *
 * Go source:
 * func isShiftOperatorOrHigher(kind ast.Kind) bool {
 * 	return isShiftOperator(kind) || isAdditiveOperatorOrHigher(kind)
 * }
 */
export function isShiftOperatorOrHigher(kind: Kind): bool {
  return (isShiftOperator(kind) || isAdditiveOperatorOrHigher(kind)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isRelationalOperator","kind":"func","status":"implemented","sigHash":"fb1f5f62a1912620f12632b53282bfde129b72cbf28c3752cc96686866f9bd90","bodyHash":"3e3ec5d409ca32026634c54aac84ce0bec12e5a624c479973fe910163ebed8f3"}
 *
 * Go source:
 * func isRelationalOperator(kind ast.Kind) bool {
 * 	return kind == ast.KindLessThanToken || kind == ast.KindLessThanEqualsToken || kind == ast.KindGreaterThanToken ||
 * 		kind == ast.KindGreaterThanEqualsToken || kind == ast.KindInstanceOfKeyword || kind == ast.KindInKeyword
 * }
 */
export function isRelationalOperator(kind: Kind): bool {
  return (kind === KindLessThanToken || kind === KindLessThanEqualsToken || kind === KindGreaterThanToken ||
    kind === KindGreaterThanEqualsToken || kind === KindInstanceOfKeyword || kind === KindInKeyword) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isRelationalOperatorOrHigher","kind":"func","status":"implemented","sigHash":"0b7bf7096835ebfe7bcbbb8369081c2812ef5eb03ab333df3fb549c1a917db12","bodyHash":"68bf5f70d07d4a77b6d8a5610f456b37b1f368e87036d5bc6f5181688b6f937b"}
 *
 * Go source:
 * func isRelationalOperatorOrHigher(kind ast.Kind) bool {
 * 	return isRelationalOperator(kind) || isShiftOperatorOrHigher(kind)
 * }
 */
export function isRelationalOperatorOrHigher(kind: Kind): bool {
  return (isRelationalOperator(kind) || isShiftOperatorOrHigher(kind)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isEqualityOperator","kind":"func","status":"implemented","sigHash":"ef16392a62a1e2c8cc3c0d44a91b794c3e96f3e7a8588893d29cdfa84bed88ce","bodyHash":"9348592c0ce68489d4e4f9100ef52a9f8ef2365b6103112274a10fc36adec23c"}
 *
 * Go source:
 * func isEqualityOperator(kind ast.Kind) bool {
 * 	return kind == ast.KindEqualsEqualsToken || kind == ast.KindEqualsEqualsEqualsToken ||
 * 		kind == ast.KindExclamationEqualsToken || kind == ast.KindExclamationEqualsEqualsToken
 * }
 */
export function isEqualityOperator(kind: Kind): bool {
  return (kind === KindEqualsEqualsToken || kind === KindEqualsEqualsEqualsToken ||
    kind === KindExclamationEqualsToken || kind === KindExclamationEqualsEqualsToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isEqualityOperatorOrHigher","kind":"func","status":"implemented","sigHash":"faa2d24fd3aa583ba31279746171e9d8dee7d99e8b07277c8274cf7292426486","bodyHash":"76cedd3b3b66d2ad217f8065ea0d3412e9529257cda1912ed57393237df05238"}
 *
 * Go source:
 * func isEqualityOperatorOrHigher(kind ast.Kind) bool {
 * 	return isEqualityOperator(kind) || isRelationalOperatorOrHigher(kind)
 * }
 */
export function isEqualityOperatorOrHigher(kind: Kind): bool {
  return (isEqualityOperator(kind) || isRelationalOperatorOrHigher(kind)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isBitwiseOperator","kind":"func","status":"implemented","sigHash":"38170aab7674f133dc6bece88fb657a80c625cc1b8395c5415116f878b82fbd8","bodyHash":"98d878ea6aa25a6a9901c3e216fb5638f03208661cc8185d8e34cfb058c1c9c4"}
 *
 * Go source:
 * func isBitwiseOperator(kind ast.Kind) bool {
 * 	return kind == ast.KindAmpersandToken || kind == ast.KindBarToken || kind == ast.KindCaretToken
 * }
 */
export function isBitwiseOperator(kind: Kind): bool {
  return (kind === KindAmpersandToken || kind === KindBarToken || kind === KindCaretToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isBitwiseOperatorOrHigher","kind":"func","status":"implemented","sigHash":"ca0c605285919a5f19009587f0c3a2c2d24eaf6d372eb7d7a62eac2f0054b8b3","bodyHash":"84bfdd31ea0bce9c4af39f64ec2c57fbd76ee8a7081e83ddcd023f01fb304944"}
 *
 * Go source:
 * func isBitwiseOperatorOrHigher(kind ast.Kind) bool {
 * 	return isBitwiseOperator(kind) || isEqualityOperatorOrHigher(kind)
 * }
 */
export function isBitwiseOperatorOrHigher(kind: Kind): bool {
  return (isBitwiseOperator(kind) || isEqualityOperatorOrHigher(kind)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isLogicalOperatorOrHigher","kind":"func","status":"implemented","sigHash":"be95df075f653ffa77245daa9008c00791fa919d79733590bafd5560a8a00467","bodyHash":"df9295948d4e685a2283f3561a475b152aca2c91661f13cb8f74851a37d95881"}
 *
 * Go source:
 * func isLogicalOperatorOrHigher(kind ast.Kind) bool {
 * 	return ast.IsLogicalBinaryOperator(kind) || isBitwiseOperatorOrHigher(kind)
 * }
 */
export function isLogicalOperatorOrHigher(kind: Kind): bool {
  return (IsLogicalBinaryOperator(kind) || isBitwiseOperatorOrHigher(kind)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isAssignmentOperatorOrHigher","kind":"func","status":"implemented","sigHash":"47317aa9f01c465393e2a38abb0912a46b231e62d6f946806c2b450fb9fe6947","bodyHash":"f2e297bb1c1903109684fe83998c1e9c6f43cde650a82e712e2c6ed4983ea591"}
 *
 * Go source:
 * func isAssignmentOperatorOrHigher(kind ast.Kind) bool {
 * 	return kind == ast.KindQuestionQuestionToken || isLogicalOperatorOrHigher(kind) || ast.IsAssignmentOperator(kind)
 * }
 */
export function isAssignmentOperatorOrHigher(kind: Kind): bool {
  return (kind === KindQuestionQuestionToken || isLogicalOperatorOrHigher(kind) || IsAssignmentOperator(kind)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isBinaryOperator","kind":"func","status":"implemented","sigHash":"83951e774e33bc5e8a5470a5f115bfe36e9461ce9d8eb639e3cdb29f8b57a5ef","bodyHash":"2e993ec81845683a2bdd45fa494c5ad822f14cfe2fbe11afb04d46bad95a40d9"}
 *
 * Go source:
 * func isBinaryOperator(kind ast.Kind) bool {
 * 	return isAssignmentOperatorOrHigher(kind) || kind == ast.KindCommaToken
 * }
 */
export function isBinaryOperator(kind: Kind): bool {
  return (isAssignmentOperatorOrHigher(kind) || kind === KindCommaToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isObjectLiteralType","kind":"func","status":"implemented","sigHash":"444899883a9c47da59a95564f7896d571ff7db905b203303385fffe11f02c5e1","bodyHash":"0d3423145fa08ebb549d2d1a2270c0e64bf8c877ff1668840d7b144daee366ad"}
 *
 * Go source:
 * func isObjectLiteralType(t *Type) bool {
 * 	return t.objectFlags&ObjectFlagsObjectLiteral != 0
 * }
 */
export function isObjectLiteralType(t: GoPtr<Type>): bool {
  return ((t!.objectFlags & ObjectFlagsObjectLiteral) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isDeclarationReadonly","kind":"func","status":"implemented","sigHash":"93f78754836b36a4036b72c719679f1cfe315c33b505815e5c24a6a098fb5518","bodyHash":"638427216261ccdbb6a2a81d749373d5b1c79148ca97a5a2bdf15d7ddb7b19c7"}
 *
 * Go source:
 * func isDeclarationReadonly(declaration *ast.Node) bool {
 * 	return ast.GetCombinedModifierFlags(declaration)&ast.ModifierFlagsReadonly != 0 && !ast.IsParameterPropertyDeclaration(declaration, declaration.Parent)
 * }
 */
export function isDeclarationReadonly(declaration: GoPtr<Node>): bool {
  return ((GetCombinedModifierFlags(declaration) & ModifierFlagsReadonly) !== 0 && !IsParameterPropertyDeclaration(declaration, declaration!.Parent)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::type::orderedSet","kind":"type","status":"implemented","sigHash":"0b8cbabe0644feba32a9e54af5d9e781c38f6cef14766411376b73b8cfa700ba","bodyHash":"2c7752c6016345bde032fc1f305ae9cc0aeca157c4ea70bbeea23f728cda0636"}
 *
 * Go source:
 * orderedSet[T comparable] struct {
 * 	valuesByKey map[T]struct{}
 * 	values      []T
 * }
 */
export interface orderedSet<T extends GoComparable = unknown> {
  valuesByKey: GoMap<T, { readonly __tsgoEmpty?: never }>;
  values: GoSlice<T>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::orderedSet.contains","kind":"method","status":"implemented","sigHash":"2460cca9f495c58bfd288bba1cb596fcda44bfefe3d01c509566a50a397acd7d","bodyHash":"b21516737e740c0bc4a427e9e50241356f4d2a281c3e05556801a33ee503dc94"}
 *
 * Go source:
 * func (s *orderedSet[T]) contains(value T) bool {
 * 	_, ok := s.valuesByKey[value]
 * 	return ok
 * }
 */
export function orderedSet_contains<T>(receiver: GoPtr<orderedSet<T>>, value: T): bool {
  return receiver!.valuesByKey.has(value) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::orderedSet.add","kind":"method","status":"implemented","sigHash":"780f9106360da89759277f7728d7eacda5a81d3279d5126745fad67e81a89be6","bodyHash":"4be6f96df9e04cba0b1a3b82f23309402b69191d75b43f1356ecab4e28ea617e"}
 *
 * Go source:
 * func (s *orderedSet[T]) add(value T) {
 * 	if s.valuesByKey == nil {
 * 		s.valuesByKey = make(map[T]struct{})
 * 	}
 * 	s.valuesByKey[value] = struct{}{}
 * 	s.values = append(s.values, value)
 * }
 */
export function orderedSet_add<T>(receiver: GoPtr<orderedSet<T>>, value: T): void {
  if (receiver!.valuesByKey === undefined) {
    receiver!.valuesByKey = new globalThis.Map<T, { readonly __tsgoEmpty?: never }>();
  }
  receiver!.valuesByKey.set(value, {});
  receiver!.values = [...receiver!.values, value];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getContainingFunctionOrClassStaticBlock","kind":"func","status":"implemented","sigHash":"2c206a09cd5cfddab0d486dc2796345cfd0504b7216dedaa69d933f24d77dadb","bodyHash":"b8f73d3cc7cfaeb428147ad285b9ff90d24893087c1b361c953f18eb39b489dd"}
 *
 * Go source:
 * func getContainingFunctionOrClassStaticBlock(node *ast.Node) *ast.Node {
 * 	return ast.FindAncestor(node.Parent, ast.IsFunctionLikeOrClassStaticBlockDeclaration)
 * }
 */
export function getContainingFunctionOrClassStaticBlock(node: GoPtr<Node>): GoPtr<Node> {
  return FindAncestor(node!.Parent, IsFunctionLikeOrClassStaticBlockDeclaration);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isNodeDescendantOf","kind":"func","status":"implemented","sigHash":"ddb4a76460d574dfdf3da4365c7bc6287eba7ac9d59a65438cf6d3e14e081c3d","bodyHash":"5e135682890baced91209912ae8a8f74b7308ba9bf3b3f596c0c99a9ee2fa0bf"}
 *
 * Go source:
 * func isNodeDescendantOf(node *ast.Node, ancestor *ast.Node) bool {
 * 	for node != nil {
 * 		if node == ancestor {
 * 			return true
 * 		}
 * 		node = node.Parent
 * 	}
 * 	return false
 * }
 */
export function isNodeDescendantOf(node: GoPtr<Node>, ancestor: GoPtr<Node>): bool {
  let cur = node;
  while (cur !== undefined) {
    if (cur === ancestor) {
      return true as bool;
    }
    cur = cur!.Parent;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isTypeUsableAsPropertyName","kind":"func","status":"implemented","sigHash":"1e82fbd3f46f13d6f6d275e5ff20c0f362eb77458d29c5b5c06610fff9518cf0","bodyHash":"ca332f278b72670d8388067e18845e3cf1ac3fecd5dac67954fff97cb67b55b4"}
 *
 * Go source:
 * func isTypeUsableAsPropertyName(t *Type) bool {
 * 	return t.flags&TypeFlagsStringOrNumberLiteralOrUnique != 0
 * }
 */
export function isTypeUsableAsPropertyName(t: GoPtr<Type>): bool {
  return ((t!.flags & TypeFlagsStringOrNumberLiteralOrUnique) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getPropertyNameFromType","kind":"func","status":"implemented","sigHash":"44987df1d72d27523cb977b09a19944fce09d6214d9814cc0aa835dbdafa748d","bodyHash":"854ee65f9d02252ce34490842b1cb86dcbdf3d4f6e4c4ea798d4eb8a7e806dd0"}
 *
 * Go source:
 * func getPropertyNameFromType(t *Type) string {
 * 	switch {
 * 	case t.flags&TypeFlagsStringLiteral != 0:
 * 		return t.AsLiteralType().value.(string)
 * 	case t.flags&TypeFlagsNumberLiteral != 0:
 * 		return t.AsLiteralType().value.(jsnum.Number).String()
 * 	case t.flags&TypeFlagsUniqueESSymbol != 0:
 * 		return t.AsUniqueESSymbolType().name
 * 	}
 * 	panic("Unhandled case in getPropertyNameFromType")
 * }
 */
export function getPropertyNameFromType(t: GoPtr<Type>): string {
  if ((t!.flags & TypeFlagsStringLiteral) !== 0) {
    return Type_AsLiteralType(t)!.value as string;
  }
  if ((t!.flags & TypeFlagsNumberLiteral) !== 0) {
    return Number_String(Type_AsLiteralType(t)!.value as JsNumber);
  }
  if ((t!.flags & TypeFlagsUniqueESSymbol) !== 0) {
    return Type_AsUniqueESSymbolType(t)!.name;
  }
  throw new globalThis.Error("Unhandled case in getPropertyNameFromType");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isNumericLiteralName","kind":"func","status":"implemented","sigHash":"8eb571079c8823e2e8d1af157bdfb1b4b5c8ce3928adcef6d4980e475771a8c7","bodyHash":"c57b4d16eb1d73b0a80520b5d99925b36e0dc9a73657d6f10711baf7fb905a98"}
 *
 * Go source:
 * func isNumericLiteralName(name string) bool {
 * 	// The intent of numeric names is that
 * 	//     - they are names with text in a numeric form, and that
 * 	//     - setting properties/indexing with them is always equivalent to doing so with the numeric literal 'numLit',
 * 	//         acquired by applying the abstract 'ToNumber' operation on the name's text.
 * 	//
 * 	// The subtlety is in the latter portion, as we cannot reliably say that anything that looks like a numeric literal is a numeric name.
 * 	// In fact, it is the case that the text of the name must be equal to 'ToString(numLit)' for this to hold.
 * 	//
 * 	// Consider the property name '"0xF00D"'. When one indexes with '0xF00D', they are actually indexing with the value of 'ToString(0xF00D)'
 * 	// according to the ECMAScript specification, so it is actually as if the user indexed with the string '"61453"'.
 * 	// Thus, the text of all numeric literals equivalent to '61543' such as '0xF00D', '0xf00D', '0170015', etc. are not valid numeric names
 * 	// because their 'ToString' representation is not equal to their original text.
 * 	// This is motivated by ECMA-262 sections 9.3.1, 9.8.1, 11.1.5, and 11.2.1.
 * 	//
 * 	// Here, we test whether 'ToString(ToNumber(name))' is exactly equal to 'name'.
 * 	// The '+' prefix operator is equivalent here to applying the abstract ToNumber operation.
 * 	// Applying the 'toString()' method on a number gives us the abstract ToString operation on a number.
 * 	//
 * 	// Note that this accepts the values 'Infinity', '-Infinity', and 'NaN', and that this is intentional.
 * 	// This is desired behavior, because when indexing with them as numeric entities, you are indexing
 * 	// with the strings '"Infinity"', '"-Infinity"', and '"NaN"' respectively.
 * 	return jsnum.FromString(name).String() == name
 * }
 */
export function isNumericLiteralName(name: string): bool {
  return (Number_String(FromString(name)) === name) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isThisProperty","kind":"func","status":"implemented","sigHash":"d6843e50683051cf4b37ed59080ba9f5b85ab4a961415c6d63655bb170418bb3","bodyHash":"d29e2ce8908db58ccbf005b760ae45e1b93971e20981bd681f6fbc57f63eed02"}
 *
 * Go source:
 * func isThisProperty(node *ast.Node) bool {
 * 	return (ast.IsPropertyAccessExpression(node) || ast.IsElementAccessExpression(node)) && node.Expression().Kind == ast.KindThisKeyword
 * }
 */
export function isThisProperty(node: GoPtr<Node>): bool {
  return ((IsPropertyAccessExpression(node) || IsElementAccessExpression(node)) && Node_Expression(node)!.Kind === KindThisKeyword) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isValidNumberString","kind":"func","status":"implemented","sigHash":"237cee1f10fd1c290ee0dc73769c5624506d49dd0d34f9182bf3590538c5de9f","bodyHash":"7f37ce4800d2165c4e0b02135dc9173fa83e5ce86b915baf3f893932132f4009"}
 *
 * Go source:
 * func isValidNumberString(s string, roundTripOnly bool) bool {
 * 	if s == "" {
 * 		return false
 * 	}
 * 	n := jsnum.FromString(s)
 * 	return !n.IsNaN() && !n.IsInf() && (!roundTripOnly || n.String() == s)
 * }
 */
export function isValidNumberString(s: string, roundTripOnly: bool): bool {
  if (s === "") {
    return false as bool;
  }
  const n = FromString(s);
  return (!Number_IsNaN(n) && !Number_IsInf(n) && (!roundTripOnly || Number_String(n) === s)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isValidBigIntString","kind":"func","status":"implemented","sigHash":"7971fb4eb613a2f44e336a7da079ff58af2f550e6a6e8c5e976e85b782b11c20","bodyHash":"1e309cae1a51a16dd217ced0f66310b61dbc24dabde63da55281c25d95d0a15f"}
 *
 * Go source:
 * func isValidBigIntString(s string, roundTripOnly bool) bool {
 * 	if s == "" {
 * 		return false
 * 	}
 * 	scanner := scanner.NewScanner()
 * 	scanner.SetSkipTrivia(false)
 * 	success := true
 * 	scanner.SetOnError(func(diagnostic *diagnostics.Message, start, length int, args ...any) {
 * 		success = false
 * 	})
 * 	scanner.SetText(s + "n")
 * 	result := scanner.Scan()
 * 	negative := result == ast.KindMinusToken
 * 	if negative {
 * 		result = scanner.Scan()
 * 	}
 * 	flags := scanner.TokenFlags()
 * 	// validate that
 * 	// * scanning proceeded without error
 * 	// * a bigint can be scanned, and that when it is scanned, it is
 * 	// * the full length of the input string (so the scanner is one character beyond the augmented input length)
 * 	// * it does not contain a numeric separator (the `BigInt` constructor does not accept a numeric separator in its input)
 * 	return success && result == ast.KindBigIntLiteral && scanner.TokenEnd() == len(s)+1 && flags&ast.TokenFlagsContainsSeparator == 0 &&
 * 		(!roundTripOnly || s == pseudoBigIntToString(jsnum.NewPseudoBigInt(jsnum.ParsePseudoBigInt(scanner.TokenValue()), negative)))
 * }
 */
export function isValidBigIntString(s: string, roundTripOnly: bool): bool {
  if (s === "") {
    return false as bool;
  }
  const scanner = NewScanner();
  Scanner_SetSkipTrivia(scanner, false as bool);
  let success: bool = true as bool;
  Scanner_SetOnError(scanner, (_diagnostic: GoPtr<Message>, _start: int, _length: int, ..._args: Array<unknown>): void => {
    success = false as bool;
  });
  Scanner_SetText(scanner, s + "n");
  let result = Scanner_Scan(scanner);
  const negative = result === KindMinusToken;
  if (negative) {
    result = Scanner_Scan(scanner);
  }
  const flags = Scanner_TokenFlags(scanner);
  const inputLength = new globalThis.TextEncoder().encode(s).length;
  // validate that
  // * scanning proceeded without error
  // * a bigint can be scanned, and that when it is scanned, it is
  // * the full length of the input string (so the scanner is one character beyond the augmented input length)
  // * it does not contain a numeric separator (the `BigInt` constructor does not accept a numeric separator in its input)
  return (success && result === KindBigIntLiteral && Scanner_TokenEnd(scanner) === inputLength + 1 && (flags & TokenFlagsContainsSeparator) === 0 &&
    (!roundTripOnly || s === pseudoBigIntToString(NewPseudoBigInt(ParsePseudoBigInt(Scanner_TokenValue(scanner)), negative as bool)))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isValidESSymbolDeclaration","kind":"func","status":"implemented","sigHash":"2beb063c6003f48625a31a14a1a7eec83d969f8704824c1330edbb76d1cbe756","bodyHash":"9dfac11302561354d62c77acbad690e121ee92f3c9a514487ca54242804715a2"}
 *
 * Go source:
 * func isValidESSymbolDeclaration(node *ast.Node) bool {
 * 	if ast.IsVariableDeclaration(node) {
 * 		return ast.IsVarConst(node) && ast.IsIdentifier(node.AsVariableDeclaration().Name()) && isVariableDeclarationInVariableStatement(node)
 * 	}
 * 	if ast.IsPropertyDeclaration(node) {
 * 		return hasReadonlyModifier(node) && ast.HasStaticModifier(node)
 * 	}
 * 	return ast.IsPropertySignatureDeclaration(node) && hasReadonlyModifier(node)
 * }
 */
export function isValidESSymbolDeclaration(node: GoPtr<Node>): bool {
  if (IsVariableDeclaration(node)) {
    return (IsVarConst(node) && IsIdentifier(Node_Name(node)) && isVariableDeclarationInVariableStatement(node)) as bool;
  }
  if (IsPropertyDeclaration(node)) {
    return (hasReadonlyModifier(node) && HasStaticModifier(node)) as bool;
  }
  return (IsPropertySignatureDeclaration(node) && hasReadonlyModifier(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isVariableDeclarationInVariableStatement","kind":"func","status":"implemented","sigHash":"e1cf808f0a7bc127d96be2abb7a026200043ef1a5bd0139df5f84456ae481201","bodyHash":"c7e8b0c79f96de413bd45a31a03be06df4299a70f39eb643067faa0b04ef6c6d"}
 *
 * Go source:
 * func isVariableDeclarationInVariableStatement(node *ast.Node) bool {
 * 	return ast.IsVariableDeclarationList(node.Parent) && ast.IsVariableStatement(node.Parent.Parent)
 * }
 */
export function isVariableDeclarationInVariableStatement(node: GoPtr<Node>): bool {
  return (IsVariableDeclarationList(node!.Parent) && IsVariableStatement(node!.Parent!.Parent)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::IsKnownSymbol","kind":"func","status":"implemented","sigHash":"fc2050b408ef181ea1650a94ee688c5eb7ebe5acdd661a680a0d2e8a9adb1eae","bodyHash":"9a4c2de632f6c1f83df870b3e473dec7710a327b2021e77c0679f58255c277ef"}
 *
 * Go source:
 * func IsKnownSymbol(symbol *ast.Symbol) bool {
 * 	return isLateBoundName(symbol.Name)
 * }
 */
export function IsKnownSymbol(symbol_: GoPtr<Symbol>): bool {
  return isLateBoundName(symbol_!.Name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::IsPrivateIdentifierSymbol","kind":"func","status":"implemented","sigHash":"f3453bd38f994aecd2fe9f8ac77110f64f4c41e31b29fd1d5fa73ad8f19dbdcc","bodyHash":"8f3c9073dd23e99e19e46055750e6d04ebc2990cc7ccaa709a9cb0f6868d3bf3"}
 *
 * Go source:
 * func IsPrivateIdentifierSymbol(symbol *ast.Symbol) bool {
 * 	if symbol == nil {
 * 		return false
 * 	}
 * 	return strings.HasPrefix(symbol.Name, ast.InternalSymbolNamePrefix+"#")
 * }
 */
export function IsPrivateIdentifierSymbol(symbol_: GoPtr<Symbol>): bool {
  if (symbol_ === undefined) {
    return false as bool;
  }
  return symbol_!.Name.startsWith(InternalSymbolNamePrefix + "#") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isLateBoundName","kind":"func","status":"implemented","sigHash":"6f696f5ee4e865cfc91686e6352aff2c1084c85a3a2d526f2cf7b4d4026c4ae4","bodyHash":"7e9746823faa10aab57461cf5e58723351ec13a42e3137cc53f9825c1fc068e5"}
 *
 * Go source:
 * func isLateBoundName(name string) bool {
 * 	return len(name) >= 2 && name[0] == '\xfe' && name[1] == '@'
 * }
 */
export function isLateBoundName(name: string): bool {
  // Go checks the raw internal-name prefix byte; the port's prefix is the
  // InternalSymbolNamePrefix constant (a Unicode noncharacter), not 0xFE.
  return (name.length >= 2 && name.startsWith(InternalSymbolNamePrefix) && name.charCodeAt(1) === 0x40) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isObjectOrArrayLiteralType","kind":"func","status":"implemented","sigHash":"695f58430266d7adb6422bcc55efed437dbe47ca58a20077de56640f71610a80","bodyHash":"779866f02503fddc14c0606a38063fa2600fca2cfbaf31d7c4cf1471678f435b"}
 *
 * Go source:
 * func isObjectOrArrayLiteralType(t *Type) bool {
 * 	return t.objectFlags&(ObjectFlagsObjectLiteral|ObjectFlagsArrayLiteral) != 0
 * }
 */
export function isObjectOrArrayLiteralType(t: GoPtr<Type>): bool {
  return ((t!.objectFlags & (ObjectFlagsObjectLiteral | ObjectFlagsArrayLiteral)) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getContainingClassExcludingClassDecorators","kind":"func","status":"implemented","sigHash":"6649225fa55f47e2287c58b2f24b80770a8a695efd0f4c82138db251ca52a540","bodyHash":"1a4755412acec17d9d3f3ab8f09cf59f5e0b36beae5e24d9e9a26633ee286a3a"}
 *
 * Go source:
 * func getContainingClassExcludingClassDecorators(node *ast.Node) *ast.ClassLikeDeclaration {
 * 	decorator := ast.FindAncestorOrQuit(node.Parent, func(n *ast.Node) ast.FindAncestorResult {
 * 		if ast.IsClassLike(n) {
 * 			return ast.FindAncestorQuit
 * 		}
 * 		if ast.IsDecorator(n) {
 * 			return ast.FindAncestorTrue
 * 		}
 * 		return ast.FindAncestorFalse
 * 	})
 * 	if decorator != nil && ast.IsClassLike(decorator.Parent) {
 * 		return ast.GetContainingClass(decorator.Parent)
 * 	}
 * 	if decorator != nil {
 * 		return ast.GetContainingClass(decorator)
 * 	}
 * 	return ast.GetContainingClass(node)
 * }
 */
export function getContainingClassExcludingClassDecorators(node: GoPtr<Node>): GoPtr<ClassLikeDeclaration> {
  const decorator = FindAncestorOrQuit(node!.Parent, (n: GoPtr<Node>): FindAncestorResult => {
    if (IsClassLike(n)) {
      return FindAncestorQuit;
    }
    if (IsDecorator(n)) {
      return FindAncestorTrue;
    }
    return FindAncestorFalse;
  });
  if (decorator !== undefined && IsClassLike(decorator!.Parent)) {
    return GetContainingClass(decorator!.Parent);
  }
  if (decorator !== undefined) {
    return GetContainingClass(decorator);
  }
  return GetContainingClass(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isThisTypeParameter","kind":"func","status":"implemented","sigHash":"c543aff0877b03371ff03791ab0e9f910fb4a2e78696aee818b3980a2a6d974a","bodyHash":"a458daa74823a21e03415f66c0a24541a013169615733b27f124723efd0fe616"}
 *
 * Go source:
 * func isThisTypeParameter(t *Type) bool {
 * 	return t.flags&TypeFlagsTypeParameter != 0 && t.AsTypeParameter().isThisType
 * }
 */
export function isThisTypeParameter(t: GoPtr<Type>): bool {
  return ((t!.flags & TypeFlagsTypeParameter) !== 0 && Type_AsTypeParameter(t)!.isThisType) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isClassInstanceProperty","kind":"func","status":"implemented","sigHash":"8384c22e65f8da03cec8e75222c68827728a44df30cc3060c2a39ec96fcc7e91","bodyHash":"91f089a24d3f09dca42c3e88ea2472e1051af39a11ff1b8584434507e93e09a7"}
 *
 * Go source:
 * func isClassInstanceProperty(node *ast.Node) bool {
 * 	if ast.IsInJSFile(node) && ast.IsExpandoPropertyDeclaration(node) {
 * 		left := node.AsBinaryExpression().Left
 * 		return (!ast.IsBindableStaticAccessExpression(left, false /*excludeThisKeyword* /) || !ast.IsPrototypeAccess(left.Expression())) &&
 * 			!ast.IsBindableStaticNameExpression(left, true /*excludeThisKeyword* /)
 * 	}
 * 	return node.Parent != nil && ast.IsClassLike(node.Parent) && ast.IsPropertyDeclaration(node) && !ast.HasAccessorModifier(node)
 * }
 */
export function isClassInstanceProperty(node: GoPtr<Node>): bool {
  if (IsInJSFile(node) && IsExpandoPropertyDeclaration(node)) {
    const left = AsBinaryExpression(node)!.Left;
    return ((!IsBindableStaticAccessExpression(left, false as bool) || !IsPrototypeAccess(Node_Expression(left))) &&
      !IsBindableStaticNameExpression(left, true as bool)) as bool;
  }
  return (node!.Parent !== undefined && IsClassLike(node!.Parent) && IsPropertyDeclaration(node) && !HasAccessorModifier(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isThisInitializedObjectBindingExpression","kind":"func","status":"implemented","sigHash":"5866d44f8d4f135f880fed90391443d611f2dec03da630487e805fc13b3c4b5c","bodyHash":"66b67fcce732b402cb925db79fc07b1da6ed14e20fe829d3684df3aa6771a721"}
 *
 * Go source:
 * func isThisInitializedObjectBindingExpression(node *ast.Node) bool {
 * 	return node != nil && (ast.IsShorthandPropertyAssignment(node) || ast.IsPropertyAssignment(node)) && ast.IsBinaryExpression(node.Parent.Parent) &&
 * 		node.Parent.Parent.AsBinaryExpression().OperatorToken.Kind == ast.KindEqualsToken &&
 * 		node.Parent.Parent.AsBinaryExpression().Right.Kind == ast.KindThisKeyword
 * }
 */
export function isThisInitializedObjectBindingExpression(node: GoPtr<Node>): bool {
  return (node !== undefined && (IsShorthandPropertyAssignment(node) || IsPropertyAssignment(node)) && IsBinaryExpression(node!.Parent!.Parent) &&
    AsBinaryExpression(node!.Parent!.Parent)!.OperatorToken!.Kind === KindEqualsToken &&
    AsBinaryExpression(node!.Parent!.Parent)!.Right!.Kind === KindThisKeyword) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isThisInitializedDeclaration","kind":"func","status":"implemented","sigHash":"802572d6ba2af90aa3e8331a884b8c4e3874bf2ce20df1e7c90b5c5ab43707e6","bodyHash":"14f5053e372f4bbbe51e64eafc35a77c1f6d3be96bfdc847287e69fa8519c861"}
 *
 * Go source:
 * func isThisInitializedDeclaration(node *ast.Node) bool {
 * 	return node != nil && ast.IsVariableDeclaration(node) && node.Initializer() != nil && node.Initializer().Kind == ast.KindThisKeyword
 * }
 */
export function isThisInitializedDeclaration(node: GoPtr<Node>): bool {
  return (node !== undefined && IsVariableDeclaration(node) && Node_Initializer(node) !== undefined && Node_Initializer(node)!.Kind === KindThisKeyword) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isInfinityOrNaNString","kind":"func","status":"implemented","sigHash":"4d2726372810eb01ef6b5d848190c2de334e7fdfbc426d8387698faf12753937","bodyHash":"9e6e74cc1199a016a5a980fbac48f483f7a4deac404d5a4f766fdd932978ae5c"}
 *
 * Go source:
 * func isInfinityOrNaNString(name string) bool {
 * 	return name == "Infinity" || name == "-Infinity" || name == "NaN"
 * }
 */
export function isInfinityOrNaNString(name: string): bool {
  return (name === "Infinity" || name === "-Infinity" || name === "NaN") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.isConstantVariable","kind":"method","status":"implemented","sigHash":"1bb0d0489b3efaf54db1458d904d56d9a5f1b655e3bc0ee2b7816acf1e8f0aab","bodyHash":"7c7ecc8fa2886fddf69b8831bd17b827ecc4892baee777c83fcc7f1eaf832a3b"}
 *
 * Go source:
 * func (c *Checker) isConstantVariable(symbol *ast.Symbol) bool {
 * 	return symbol.Flags&ast.SymbolFlagsVariable != 0 && (c.getDeclarationNodeFlagsFromSymbol(symbol)&ast.NodeFlagsConstant) != 0
 * }
 */
export function Checker_isConstantVariable(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool {
  return ((symbol_!.Flags & SymbolFlagsVariable) !== 0 && (Checker_getDeclarationNodeFlagsFromSymbol(receiver, symbol_) & NodeFlagsConstant) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.isParameterOrMutableLocalVariable","kind":"method","status":"implemented","sigHash":"da0befcee03bf3f644e44ca8bb3a0f6580c4120112eaf997c31975c8b822212d","bodyHash":"735494581e37aa5ce85889f1b20e6ce403c09fa436db5be4a0824cdcebdf1b3f"}
 *
 * Go source:
 * func (c *Checker) isParameterOrMutableLocalVariable(symbol *ast.Symbol) bool {
 * 	// Return true if symbol is a parameter, a catch clause variable, or a mutable local variable
 * 	if symbol.ValueDeclaration != nil {
 * 		declaration := ast.GetRootDeclaration(symbol.ValueDeclaration)
 * 		return declaration != nil && (ast.IsParameterDeclaration(declaration) || ast.IsVariableDeclaration(declaration) && (ast.IsCatchClause(declaration.Parent) || c.isMutableLocalVariableDeclaration(declaration)))
 * 	}
 * 	return false
 * }
 */
export function Checker_isParameterOrMutableLocalVariable(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool {
  // Return true if symbol is a parameter, a catch clause variable, or a mutable local variable
  if (symbol_!.ValueDeclaration !== undefined) {
    const declaration = GetRootDeclaration(symbol_!.ValueDeclaration);
    return (declaration !== undefined && (IsParameterDeclaration(declaration) || IsVariableDeclaration(declaration) && (IsCatchClause(declaration!.Parent) || Checker_isMutableLocalVariableDeclaration(receiver, declaration)))) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.isMutableLocalVariableDeclaration","kind":"method","status":"implemented","sigHash":"4d9f615a01711df911919e11fcf69a21ea97637a9d09157612663dfc59a904ed","bodyHash":"a44b8d06ab034876b8d09c24f3c6f62300526d478af78adfccae675526834e31"}
 *
 * Go source:
 * func (c *Checker) isMutableLocalVariableDeclaration(declaration *ast.Node) bool {
 * 	// Return true if symbol is a non-exported and non-global `let` variable
 * 	return declaration.Parent.Flags&ast.NodeFlagsLet != 0 && !(ast.GetCombinedModifierFlags(declaration)&ast.ModifierFlagsExport != 0 || declaration.Parent.Parent.Kind == ast.KindVariableStatement && ast.IsGlobalSourceFile(declaration.Parent.Parent.Parent))
 * }
 */
export function Checker_isMutableLocalVariableDeclaration(receiver: GoPtr<Checker>, declaration: GoPtr<Node>): bool {
  // Return true if symbol is a non-exported and non-global `let` variable
  return ((declaration!.Parent!.Flags & NodeFlagsLet) !== 0 && !((GetCombinedModifierFlags(declaration) & ModifierFlagsExport) !== 0 || declaration!.Parent!.Parent!.Kind === KindVariableStatement && IsGlobalSourceFile(declaration!.Parent!.Parent!.Parent))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isInAmbientOrTypeNode","kind":"func","status":"implemented","sigHash":"c81011def9a9f2abd215e1764a85f0b346b18c26d98461beebb599c2949252be","bodyHash":"c05eb454cee4704e40869d02379d8cc0c04900249bbebe75e2870135c0639b49"}
 *
 * Go source:
 * func isInAmbientOrTypeNode(node *ast.Node) bool {
 * 	return node.Flags&ast.NodeFlagsAmbient != 0 || ast.FindAncestor(node, func(n *ast.Node) bool {
 * 		return ast.IsInterfaceDeclaration(n) || ast.IsTypeOrJSTypeAliasDeclaration(n) || ast.IsTypeLiteralNode(n)
 * 	}) != nil
 * }
 */
export function isInAmbientOrTypeNode(node: GoPtr<Node>): bool {
  return ((node!.Flags & NodeFlagsAmbient) !== 0 || FindAncestor(node, (n: GoPtr<Node>): bool => {
    return (IsInterfaceDeclaration(n) || IsTypeOrJSTypeAliasDeclaration(n) || IsTypeLiteralNode(n)) as bool;
  }) !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isLiteralExpressionOfObject","kind":"func","status":"implemented","sigHash":"2812fecdc35849002df87bb60600403c4fbc78707d1bedd546e2c9fd1708f5c4","bodyHash":"5ca235cb9a98bbb21015f2d746679a9542d5856ae697ad1f34a04650ac5eecb1"}
 *
 * Go source:
 * func isLiteralExpressionOfObject(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindObjectLiteralExpression, ast.KindArrayLiteralExpression, ast.KindRegularExpressionLiteral,
 * 		ast.KindFunctionExpression, ast.KindClassExpression:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function isLiteralExpressionOfObject(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindObjectLiteralExpression:
    case KindArrayLiteralExpression:
    case KindRegularExpressionLiteral:
    case KindFunctionExpression:
    case KindClassExpression:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::canHaveFlowNode","kind":"func","status":"implemented","sigHash":"00f91de0eb7759255b629ab6646b708fb569390a1d4389ea4e77aab497c1c0f3","bodyHash":"5f6bbf77da5f3899b3ca7d90a073a9705b5119ede1ebb66d07601a0b5693d9b4"}
 *
 * Go source:
 * func canHaveFlowNode(node *ast.Node) bool {
 * 	return node.FlowNodeData() != nil
 * }
 */
export function canHaveFlowNode(node: GoPtr<Node>): bool {
  return (Node_FlowNodeData(node) !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isNonNullAccess","kind":"func","status":"implemented","sigHash":"dea308b8657fe06c9e824a1028f7b22898e950e5a8b62c59aa40e2389e0d012f","bodyHash":"10994dd82745797a1b3980fbc2a95502ff897ecc1f7f063ba9513d202471b44f"}
 *
 * Go source:
 * func isNonNullAccess(node *ast.Node) bool {
 * 	return ast.IsAccessExpression(node) && ast.IsNonNullExpression(node.Expression())
 * }
 */
export function isNonNullAccess(node: GoPtr<Node>): bool {
  return (IsAccessExpression(node) && IsNonNullExpression(Node_Expression(node))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getBindingElementPropertyName","kind":"func","status":"implemented","sigHash":"80850587fc202081d3bf52eb18c7a25b54eeb7dac75d758d9e8ac7715898d4b3","bodyHash":"ed723036e74020fcc78695cf13f0a67034bc2ecb14281f40657639e69373dcdf"}
 *
 * Go source:
 * func getBindingElementPropertyName(node *ast.Node) *ast.Node {
 * 	return node.PropertyNameOrName()
 * }
 */
export function getBindingElementPropertyName(node: GoPtr<Node>): GoPtr<Node> {
  return Node_PropertyNameOrName(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isCallChain","kind":"func","status":"implemented","sigHash":"86b2ae21ffee1c312ea7ea061f782a06855803fada2bbb1f9b83c23840bafc9a","bodyHash":"18ac8f0180a6246c8cd91f949cd8c5bbc4793dee9f4ace217eb7cff5aabc8038"}
 *
 * Go source:
 * func isCallChain(node *ast.Node) bool {
 * 	return ast.IsCallExpression(node) && node.Flags&ast.NodeFlagsOptionalChain != 0
 * }
 */
export function isCallChain(node: GoPtr<Node>): bool {
  return (IsCallExpression(node) && (node!.Flags & NodeFlagsOptionalChain) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.callLikeExpressionMayHaveTypeArguments","kind":"method","status":"implemented","sigHash":"64b833695754c5a6bad52ad6d2ae7292055fafbe930733d3a963ea9e250cfdec","bodyHash":"129010157a8bd8202b4343bf503fe91b93ec0166c584214d9fb2b6278809c793"}
 *
 * Go source:
 * func (c *Checker) callLikeExpressionMayHaveTypeArguments(node *ast.Node) bool {
 * 	return ast.IsCallOrNewExpression(node) || ast.IsTaggedTemplateExpression(node) || ast.IsJsxOpeningLikeElement(node)
 * }
 */
export function Checker_callLikeExpressionMayHaveTypeArguments(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool {
  return (IsCallOrNewExpression(node) || IsTaggedTemplateExpression(node) || IsJsxOpeningLikeElement(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isSuperCall","kind":"func","status":"implemented","sigHash":"446588b86c6f35af7e803bf4867bf214684d717dab1afc57fb59ec99a1877bdd","bodyHash":"2a6c90521be9ab3cb4fe9203fcb890946471fc6095b1c348a0215afd6d66f2eb"}
 *
 * Go source:
 * func isSuperCall(n *ast.Node) bool {
 * 	return ast.IsCallExpression(n) && n.Expression().Kind == ast.KindSuperKeyword
 * }
 */
export function isSuperCall(n: GoPtr<Node>): bool {
  return (IsCallExpression(n) && Node_Expression(n)!.Kind === KindSuperKeyword) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getMembersOfDeclaration","kind":"func","status":"implemented","sigHash":"14568b11fd12600cfac5df126145965358531a6d930cacfdf957b857b27e1b80","bodyHash":"ae74fd0921a3addd0ffebc11545a006c8427bf260ef5e55cfc9766f7bc0892c3"}
 *
 * Go source:
 * func getMembersOfDeclaration(node *ast.Node) []*ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindInterfaceDeclaration, ast.KindClassDeclaration, ast.KindClassExpression, ast.KindTypeLiteral:
 * 		return node.Members()
 * 	case ast.KindObjectLiteralExpression:
 * 		return node.Properties()
 * 	}
 * 	return nil
 * }
 */
export function getMembersOfDeclaration(node: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  switch (node!.Kind) {
    case KindInterfaceDeclaration:
    case KindClassDeclaration:
    case KindClassExpression:
    case KindTypeLiteral:
      return Node_Members(node) ?? [];
    case KindObjectLiteralExpression:
      return Node_Properties(node) ?? [];
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isInRightSideOfImportOrExportAssignment","kind":"func","status":"implemented","sigHash":"d1d084461ae07172a60238ce24027688be928769d10db009963556bbba173ec9","bodyHash":"4819987be9a9cc8d02119b2f99fa99786d9ddb3ff59312e24fbdeb2e5410c56d"}
 *
 * Go source:
 * func isInRightSideOfImportOrExportAssignment(node *ast.EntityName) bool {
 * 	for node.Parent.Kind == ast.KindQualifiedName {
 * 		node = node.Parent
 * 	}
 * 
 * 	return node.Parent.Kind == ast.KindImportEqualsDeclaration && node.Parent.AsImportEqualsDeclaration().ModuleReference == node ||
 * 		node.Parent.Kind == ast.KindExportAssignment && node.Parent.Expression() == node
 * }
 */
export function isInRightSideOfImportOrExportAssignment(node: GoPtr<EntityName>): bool {
  let cur: GoPtr<Node> = node;
  while (cur!.Parent!.Kind === KindQualifiedName) {
    cur = cur!.Parent;
  }

  return ((cur!.Parent!.Kind === KindImportEqualsDeclaration && AsImportEqualsDeclaration(cur!.Parent)!.ModuleReference === cur) ||
    (cur!.Parent!.Kind === KindExportAssignment && Node_Expression(cur!.Parent) === cur)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isJsxIntrinsicTagName","kind":"func","status":"implemented","sigHash":"cf4cc9d095c32e63e2c3d3d4e84ecea34fa6edfc7077f7060e514edddaa51ef1","bodyHash":"7c42fc1feaea8f3a864942da4ee0b3e9bd2240f51ad274c425a7e52c2af45e78"}
 *
 * Go source:
 * func isJsxIntrinsicTagName(tagName *ast.Node) bool {
 * 	return ast.IsIdentifier(tagName) && scanner.IsIntrinsicJsxName(tagName.Text()) || ast.IsJsxNamespacedName(tagName)
 * }
 */
export function isJsxIntrinsicTagName(tagName: GoPtr<Node>): bool {
  return ((IsIdentifier(tagName) && IsIntrinsicJsxName(Node_Text(tagName))) || IsJsxNamespacedName(tagName)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getContainingObjectLiteral","kind":"func","status":"implemented","sigHash":"4c6db73772996044042bd9de38ff5b70a4a3e5e0af98d58141687ffe4b3d341b","bodyHash":"67bb85f7e439b694d4a9dc7bb7c76e2a0e0db596ceab89f7fab16469487747a1"}
 *
 * Go source:
 * func getContainingObjectLiteral(f *ast.SignatureDeclaration) *ast.Node {
 * 	if (f.Kind == ast.KindMethodDeclaration ||
 * 		f.Kind == ast.KindGetAccessor ||
 * 		f.Kind == ast.KindSetAccessor) && f.Parent.Kind == ast.KindObjectLiteralExpression {
 * 		return f.Parent
 * 	} else if f.Kind == ast.KindFunctionExpression && f.Parent.Kind == ast.KindPropertyAssignment {
 * 		return f.Parent.Parent
 * 	}
 * 	return nil
 * }
 */
export function getContainingObjectLiteral(f: GoPtr<SignatureDeclaration>): GoPtr<Node> {
  if ((f!.Kind === KindMethodDeclaration ||
    f!.Kind === KindGetAccessor ||
    f!.Kind === KindSetAccessor) && f!.Parent!.Kind === KindObjectLiteralExpression) {
    return f!.Parent;
  } else if (f!.Kind === KindFunctionExpression && f!.Parent!.Kind === KindPropertyAssignment) {
    return f!.Parent!.Parent;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isImportTypeQualifierPart","kind":"func","status":"implemented","sigHash":"b2ef501af648c4ee386a13676018f9caada1fe34677e46d5c61fdbc050e51680","bodyHash":"e206250914bed69dcf16aa9d37ab2b64a095075262fe9213f62c76fc85b1736f"}
 *
 * Go source:
 * func isImportTypeQualifierPart(node *ast.Node) *ast.Node {
 * 	parent := node.Parent
 * 	for ast.IsQualifiedName(parent) {
 * 		node = parent
 * 		parent = parent.Parent
 * 	}
 * 
 * 	if parent != nil && parent.Kind == ast.KindImportType && parent.AsImportTypeNode().Qualifier == node {
 * 		return parent
 * 	}
 * 
 * 	return nil
 * }
 */
export function isImportTypeQualifierPart(node: GoPtr<Node>): GoPtr<Node> {
  let cur: GoPtr<Node> = node;
  let parent = cur!.Parent;
  while (IsQualifiedName(parent)) {
    cur = parent;
    parent = parent!.Parent;
  }

  if (parent !== undefined && parent!.Kind === KindImportType && AsImportTypeNode(parent)!.Qualifier === cur) {
    return parent;
  }

  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isInNameOfExpressionWithTypeArguments","kind":"func","status":"implemented","sigHash":"ef3b18436396ea722f5ac2234b77b9fd1947d31f0b19fd2c1efc2044f9e246de","bodyHash":"0032f7fa03075ee3694f3b0ffbcca5f0254f47e9aa3c1ad1dac2add5f721b8df"}
 *
 * Go source:
 * func isInNameOfExpressionWithTypeArguments(node *ast.Node) bool {
 * 	for node.Parent.Kind == ast.KindPropertyAccessExpression {
 * 		node = node.Parent
 * 	}
 * 
 * 	return node.Parent.Kind == ast.KindExpressionWithTypeArguments
 * }
 */
export function isInNameOfExpressionWithTypeArguments(node: GoPtr<Node>): bool {
  let cur: GoPtr<Node> = node;
  while (cur!.Parent!.Kind === KindPropertyAccessExpression) {
    cur = cur!.Parent;
  }

  return (cur!.Parent!.Kind === KindExpressionWithTypeArguments) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getIndexSymbolFromSymbolTable","kind":"func","status":"implemented","sigHash":"264ad5c952568bd5040764624e8f940feea7d824e18308643cb1af80311398d2","bodyHash":"f99bf2aaa42d260fa8b4b8b245c3778922ac08b96d6d91aa8c7e0c565b8162b6"}
 *
 * Go source:
 * func getIndexSymbolFromSymbolTable(symbolTable ast.SymbolTable) *ast.Symbol {
 * 	return symbolTable[ast.InternalSymbolNameIndex]
 * }
 */
export function getIndexSymbolFromSymbolTable(symbolTable: SymbolTable): GoPtr<Symbol> {
  return symbolTable.get(InternalSymbolNameIndex);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::expressionResultIsUnused","kind":"func","status":"implemented","sigHash":"f7bb46ac1562b5427fe4444607928de2a80710bfe64abc194fc4e5f2fcde811c","bodyHash":"b0291ed1bc7378dcbe0af40767824e4ad7848af42ef0f6fb50dcfac2cafb3ad2"}
 *
 * Go source:
 * func expressionResultIsUnused(node *ast.Node) bool {
 * 	for {
 * 		parent := node.Parent
 * 		// walk up parenthesized expressions, but keep a pointer to the top-most parenthesized expression
 * 		if ast.IsParenthesizedExpression(parent) {
 * 			node = parent
 * 			continue
 * 		}
 * 		// result is unused in an expression statement, `void` expression, or the initializer or incrementer of a `for` loop
 * 		if ast.IsExpressionStatement(parent) || ast.IsVoidExpression(parent) || ast.IsForStatement(parent) && (parent.Initializer() == node || parent.AsForStatement().Incrementor == node) {
 * 			return true
 * 		}
 * 		if ast.IsBinaryExpression(parent) && parent.AsBinaryExpression().OperatorToken.Kind == ast.KindCommaToken {
 * 			// left side of comma is always unused
 * 			if node == parent.AsBinaryExpression().Left {
 * 				return true
 * 			}
 * 			// right side of comma is unused if parent is unused
 * 			node = parent
 * 			continue
 * 		}
 * 		return false
 * 	}
 * }
 */
export function expressionResultIsUnused(node: GoPtr<Node>): bool {
  let cur: GoPtr<Node> = node;
  for (;;) {
    const parent = cur!.Parent;
    // walk up parenthesized expressions, but keep a pointer to the top-most parenthesized expression
    if (IsParenthesizedExpression(parent)) {
      cur = parent;
      continue;
    }
    // result is unused in an expression statement, `void` expression, or the initializer or incrementer of a `for` loop
    if (IsExpressionStatement(parent) || IsVoidExpression(parent) || (IsForStatement(parent) && (Node_Initializer(parent) === cur || AsForStatement(parent)!.Incrementor === cur))) {
      return true as bool;
    }
    if (IsBinaryExpression(parent) && AsBinaryExpression(parent)!.OperatorToken!.Kind === KindCommaToken) {
      // left side of comma is always unused
      if (cur === AsBinaryExpression(parent)!.Left) {
        return true as bool;
      }
      // right side of comma is unused if parent is unused
      cur = parent;
      continue;
    }
    return false as bool;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::pseudoBigIntToString","kind":"func","status":"implemented","sigHash":"62756ef46db747075770dbdcb0f177cefca83d67a0a78c7b5e628c8ba82cc2ec","bodyHash":"b2800fbbe563ebcefeeb4a6db29619f3ce65f3305ef9ad1a09d7f0a01230026a"}
 *
 * Go source:
 * func pseudoBigIntToString(value jsnum.PseudoBigInt) string {
 * 	return value.String()
 * }
 */
export function pseudoBigIntToString(value: PseudoBigInt): string {
  return PseudoBigInt_String(value);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getSuperContainer","kind":"func","status":"implemented","sigHash":"d525fb398e2a890073cb5b0b80accf0da9b64ccf96a455d4468f9a3e8aac2d6d","bodyHash":"0d9067b9b6b124ff70ffdeb04cef564efc1674643ede6de121a435a21c2723fa"}
 *
 * Go source:
 * func getSuperContainer(node *ast.Node, stopOnFunctions bool) *ast.Node {
 * 	for {
 * 		node = node.Parent
 * 		if node == nil {
 * 			return nil
 * 		}
 * 		switch node.Kind {
 * 		case ast.KindComputedPropertyName:
 * 			node = node.Parent
 * 		case ast.KindFunctionDeclaration, ast.KindFunctionExpression, ast.KindArrowFunction:
 * 			if !stopOnFunctions {
 * 				continue
 * 			}
 * 			fallthrough
 * 		case ast.KindPropertyDeclaration, ast.KindPropertySignature, ast.KindMethodDeclaration, ast.KindMethodSignature, ast.KindConstructor,
 * 			ast.KindGetAccessor, ast.KindSetAccessor, ast.KindClassStaticBlockDeclaration:
 * 			return node
 * 		case ast.KindDecorator:
 * 			// Decorators are always applied outside of the body of a class or method.
 * 			if ast.IsParameterDeclaration(node.Parent) && ast.IsClassElement(node.Parent.Parent) {
 * 				// If the decorator's parent is a Parameter, we resolve the this container from
 * 				// the grandparent class declaration.
 * 				node = node.Parent.Parent
 * 			} else if ast.IsClassElement(node.Parent) {
 * 				// If the decorator's parent is a class element, we resolve the 'this' container
 * 				// from the parent class declaration.
 * 				node = node.Parent
 * 			}
 * 		}
 * 	}
 * }
 */
export function getSuperContainer(node: GoPtr<Node>, stopOnFunctions: bool): GoPtr<Node> {
  let cur: GoPtr<Node> = node;
  for (;;) {
    cur = cur!.Parent;
    if (cur === undefined) {
      return undefined;
    }
    switch (cur!.Kind) {
      case KindComputedPropertyName:
        cur = cur!.Parent;
        break;
      case KindFunctionDeclaration:
      case KindFunctionExpression:
      case KindArrowFunction:
        if (!stopOnFunctions) {
          continue;
        }
        // fallthrough
        return cur;
      case KindPropertyDeclaration:
      case KindPropertySignature:
      case KindMethodDeclaration:
      case KindMethodSignature:
      case KindConstructor:
      case KindGetAccessor:
      case KindSetAccessor:
      case KindClassStaticBlockDeclaration:
        return cur;
      case KindDecorator:
        // Decorators are always applied outside of the body of a class or method.
        if (IsParameterDeclaration(cur!.Parent) && IsClassElement(cur!.Parent!.Parent)) {
          // If the decorator's parent is a Parameter, we resolve the this container from
          // the grandparent class declaration.
          cur = cur!.Parent!.Parent;
        } else if (IsClassElement(cur!.Parent)) {
          // If the decorator's parent is a class element, we resolve the 'this' container
          // from the parent class declaration.
          cur = cur!.Parent;
        }
        break;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::forEachYieldExpression","kind":"func","status":"implemented","sigHash":"d9454bc6255016ab97c58d59debc42837ddeb6c097c2577d0b78eba4ad9aa271","bodyHash":"a682c9fc1c3d10bc255f38fbc38d48e765160e8e70315099cd2df924af13bb21"}
 *
 * Go source:
 * func forEachYieldExpression(body *ast.Node, visitor func(expr *ast.Node) bool) bool {
 * 	var traverse func(*ast.Node) bool
 * 	traverse = func(node *ast.Node) bool {
 * 		switch node.Kind {
 * 		case ast.KindYieldExpression:
 * 			if visitor(node) {
 * 				return true
 * 			}
 * 			operand := node.Expression()
 * 			if operand == nil {
 * 				return false
 * 			}
 * 			return traverse(operand)
 * 		case ast.KindEnumDeclaration, ast.KindInterfaceDeclaration, ast.KindModuleDeclaration, ast.KindTypeAliasDeclaration:
 * 			// These are not allowed inside a generator now, but eventually they may be allowed
 * 			// as local types. Regardless, skip them to avoid the work.
 * 		default:
 * 			if ast.IsFunctionLike(node) {
 * 				if node.Name() != nil && ast.IsComputedPropertyName(node.Name()) {
 * 					// Note that we will not include methods/accessors of a class because they would require
 * 					// first descending into the class. This is by design.
 * 					return traverse(node.Name().Expression())
 * 				}
 * 			} else if !ast.IsPartOfTypeNode(node) {
 * 				// This is the general case, which should include mostly expressions and statements.
 * 				// Also includes NodeArrays.
 * 				return node.ForEachChild(traverse)
 * 			}
 * 		}
 * 		return false
 * 	}
 * 	return traverse(body)
 * }
 */
export function forEachYieldExpression(body: GoPtr<Node>, visitor: (expr: GoPtr<Node>) => bool): bool {
  const traverse = (node: GoPtr<Node>): bool => {
    switch (node!.Kind) {
      case KindYieldExpression: {
        if (visitor(node)) {
          return true as bool;
        }
        const operand = Node_Expression(node);
        if (operand === undefined) {
          return false as bool;
        }
        return traverse(operand);
      }
      case KindEnumDeclaration:
      case KindInterfaceDeclaration:
      case KindModuleDeclaration:
      case KindTypeAliasDeclaration:
        // These are not allowed inside a generator now, but eventually they may be allowed
        // as local types. Regardless, skip them to avoid the work.
        break;
      default:
        if (IsFunctionLike(node)) {
          if (Node_Name(node) !== undefined && IsComputedPropertyName(Node_Name(node))) {
            // Note that we will not include methods/accessors of a class because they would require
            // first descending into the class. This is by design.
            return traverse(Node_Expression(Node_Name(node)));
          }
        } else if (!IsPartOfTypeNode(node)) {
          // This is the general case, which should include mostly expressions and statements.
          // Also includes NodeArrays.
          return Node_ForEachChild(node, traverse);
        }
        break;
    }
    return false as bool;
  };
  return traverse(body);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getEnclosingContainer","kind":"func","status":"implemented","sigHash":"1478a6a2cbcbfe1c642de452cb1bcb9545ffabe40aa3b2c6e62d23b0d5f360ca","bodyHash":"b0af76bd3d9cd1f3aa7a973e9dcdda9e068de4e76ec11048f55d10e5231644a3"}
 *
 * Go source:
 * func getEnclosingContainer(node *ast.Node) *ast.Node {
 * 	return ast.FindAncestor(node.Parent, func(n *ast.Node) bool {
 * 		return binder.GetContainerFlags(n)&binder.ContainerFlagsIsContainer != 0
 * 	})
 * }
 */
export function getEnclosingContainer(node: GoPtr<Node>): GoPtr<Node> {
  return FindAncestor(node!.Parent, (n: GoPtr<Node>): bool => {
    return ((GetContainerFlags(n) & ContainerFlagsIsContainer) !== 0) as bool;
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getDeclarationsOfKind","kind":"func","status":"implemented","sigHash":"c5cddfbb70a3dcc6d6b50afc7d04669c3d4363c51453e8ae29400d783bbd2595","bodyHash":"421cd87725b4645615cbd1ea09973afb4b4ec934f5977c653c449fc384d585ef"}
 *
 * Go source:
 * func getDeclarationsOfKind(symbol *ast.Symbol, kind ast.Kind) []*ast.Node {
 * 	return core.Filter(symbol.Declarations, func(d *ast.Node) bool { return d.Kind == kind })
 * }
 */
export function getDeclarationsOfKind(symbol_: GoPtr<Symbol>, kind: Kind): GoSlice<GoPtr<Node>> {
  return Filter(symbol_!.Declarations ?? [], (d: GoPtr<Node>): bool => (d!.Kind === kind) as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::hasType","kind":"func","status":"implemented","sigHash":"5d999bb41b63b39ff7c09e1d2771670c7a3e738d881f8a685f5ecb07e7138c26","bodyHash":"6ecd2c5b74f2d0aa95317d0384765a9d5acc3d9f144754afd4001fa1705885df"}
 *
 * Go source:
 * func hasType(node *ast.Node) bool {
 * 	return node.Type() != nil
 * }
 */
export function hasType(node: GoPtr<Node>): bool {
  return (Node_Type(node) !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getNonRestParameterCount","kind":"func","status":"implemented","sigHash":"8f43cfae7272e54ff76afc052d4b414d002f28280ae0d952906551a2620b5ee9","bodyHash":"82969c938438d6f1a26c91a050785217b088fe39944919f76a5391ec4cda81a8"}
 *
 * Go source:
 * func getNonRestParameterCount(sig *Signature) int {
 * 	return len(sig.parameters) - core.IfElse(signatureHasRestParameter(sig), 1, 0)
 * }
 */
export function getNonRestParameterCount(sig: GoPtr<Signature>): int {
  return sig!.parameters.length - (signatureHasRestParameter(sig) ? 1 : 0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::minAndMax","kind":"func","status":"implemented","sigHash":"eb78bc5aacf7fa6a8e970a3ec6ada2305643c366b834ca77e9b5b45b512a0a53","bodyHash":"7f71534bad28eb8b6b623dfdf852d3ab41fd305fe48705360df5224b949ffd4f"}
 *
 * Go source:
 * func minAndMax[T any](slice []T, getValue func(value T) int) (int, int) {
 * 	var minValue, maxValue int
 * 	for i, element := range slice {
 * 		value := getValue(element)
 * 		if i == 0 {
 * 			minValue = value
 * 			maxValue = value
 * 		} else {
 * 			minValue = min(minValue, value)
 * 			maxValue = max(maxValue, value)
 * 		}
 * 	}
 * 	return minValue, maxValue
 * }
 */
export function minAndMax<T>(slice: GoSlice<T>, getValue: (value: T) => int): [int, int] {
  let minValue: int = 0;
  let maxValue: int = 0;
  for (let i = 0; i < slice.length; i++) {
    const value = getValue(slice[i]!);
    if (i === 0) {
      minValue = value;
      maxValue = value;
    } else {
      minValue = globalThis.Math.min(minValue, value);
      maxValue = globalThis.Math.max(maxValue, value);
    }
  }
  return [minValue, maxValue];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::type::FeatureMapEntry","kind":"type","status":"implemented","sigHash":"2cbbeb08175483f01878f43dfc57fdf761d2ab4ac1edfd10456b7060a079973c","bodyHash":"01f0f6c6c54be96456fd41ca4b62fe63c0135fa2224ff0708d0145e074ff4f21"}
 *
 * Go source:
 * FeatureMapEntry struct {
 * 	lib   string
 * 	props []string
 * }
 */
export interface FeatureMapEntry {
  lib: string;
  props: GoSlice<string>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::varGroup::getFeatureMap","kind":"varGroup","status":"implemented","sigHash":"91d7ad405cbb9f158b0e038918e57e5a622b254e3ce64301f4ab9869573decd5","bodyHash":"8798a4060347aaeb280d75e0077067a092b3df12b5e70469a4cdb9b68fdb818a"}
 *
 * Go source:
 * var getFeatureMap = sync.OnceValue(func() map[string][]FeatureMapEntry {
 * 	return map[string][]FeatureMapEntry{
 * 		"Array": {
 * 			{lib: "es2015", props: []string{"find", "findIndex", "fill", "copyWithin", "entries", "keys", "values"}},
 * 			{lib: "es2016", props: []string{"includes"}},
 * 			{lib: "es2019", props: []string{"flat", "flatMap"}},
 * 			{lib: "es2022", props: []string{"at"}},
 * 			{lib: "es2023", props: []string{"findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"}},
 * 		},
 * 		"Iterator": {
 * 			{lib: "es2015", props: []string{}},
 * 		},
 * 		"AsyncIterator": {
 * 			{lib: "es2015", props: []string{}},
 * 		},
 * 		"ArrayBuffer": {
 * 			{lib: "es2024", props: []string{
 * 				"maxByteLength",
 * 				"resizable",
 * 				"resize",
 * 				"detached",
 * 				"transfer",
 * 				"transferToFixedLength",
 * 			}},
 * 		},
 * 		"Atomics": {
 * 			{lib: "es2017", props: []string{
 * 				"add",
 * 				"and",
 * 				"compareExchange",
 * 				"exchange",
 * 				"isLockFree",
 * 				"load",
 * 				"or",
 * 				"store",
 * 				"sub",
 * 				"wait",
 * 				"notify",
 * 				"xor",
 * 			}},
 * 			{lib: "es2024", props: []string{
 * 				"waitAsync",
 * 			}},
 * 		},
 * 		"SharedArrayBuffer": {
 * 			{lib: "es2017", props: []string{
 * 				"byteLength",
 * 				"slice",
 * 			}},
 * 			{lib: "es2024", props: []string{
 * 				"growable",
 * 				"maxByteLength",
 * 				"grow",
 * 			}},
 * 		},
 * 		"AsyncIterable": {
 * 			{lib: "es2018", props: []string{}},
 * 		},
 * 		"AsyncIterableIterator": {
 * 			{lib: "es2018", props: []string{}},
 * 		},
 * 		"AsyncGenerator": {
 * 			{lib: "es2018", props: []string{}},
 * 		},
 * 		"AsyncGeneratorFunction": {
 * 			{lib: "es2018", props: []string{}},
 * 		},
 * 		"RegExp": {
 * 			{lib: "es2015", props: []string{"flags", "sticky", "unicode"}},
 * 			{lib: "es2018", props: []string{"dotAll"}},
 * 			{lib: "es2024", props: []string{"unicodeSets"}},
 * 		},
 * 		"RegExpConstructor": {
 * 			{lib: "es2025", props: []string{"escape"}},
 * 		},
 * 		"Reflect": {
 * 			{lib: "es2015", props: []string{"apply", "construct", "defineProperty", "deleteProperty", "get", "getOwnPropertyDescriptor", "getPrototypeOf", "has", "isExtensible", "ownKeys", "preventExtensions", "set", "setPrototypeOf"}},
 * 		},
 * 		"ArrayConstructor": {
 * 			{lib: "es2015", props: []string{"from", "of"}},
 * 			{lib: "esnext", props: []string{"fromAsync"}},
 * 		},
 * 		"ObjectConstructor": {
 * 			{lib: "es2015", props: []string{"assign", "getOwnPropertySymbols", "keys", "is", "setPrototypeOf"}},
 * 			{lib: "es2017", props: []string{"values", "entries", "getOwnPropertyDescriptors"}},
 * 			{lib: "es2019", props: []string{"fromEntries"}},
 * 			{lib: "es2022", props: []string{"hasOwn"}},
 * 			{lib: "es2024", props: []string{"groupBy"}},
 * 		},
 * 		"NumberConstructor": {
 * 			{lib: "es2015", props: []string{"isFinite", "isInteger", "isNaN", "isSafeInteger", "parseFloat", "parseInt"}},
 * 		},
 * 		"Math": {
 * 			{lib: "es2015", props: []string{"clz32", "imul", "sign", "log10", "log2", "log1p", "expm1", "cosh", "sinh", "tanh", "acosh", "asinh", "atanh", "hypot", "trunc", "fround", "cbrt"}},
 * 			{lib: "es2025", props: []string{"f16round"}},
 * 		},
 * 		"Map": {
 * 			{lib: "es2015", props: []string{"entries", "keys", "values"}},
 * 			{lib: "esnext", props: []string{
 * 				"getOrInsert",
 * 				"getOrInsertComputed",
 * 			}},
 * 		},
 * 		"MapConstructor": {
 * 			{lib: "es2024", props: []string{"groupBy"}},
 * 		},
 * 		"Set": {
 * 			{lib: "es2015", props: []string{"entries", "keys", "values"}},
 * 			{lib: "es2025", props: []string{
 * 				"union",
 * 				"intersection",
 * 				"difference",
 * 				"symmetricDifference",
 * 				"isSubsetOf",
 * 				"isSupersetOf",
 * 				"isDisjointFrom",
 * 			}},
 * 		},
 * 		"PromiseConstructor": {
 * 			{lib: "es2015", props: []string{"all", "race", "reject", "resolve"}},
 * 			{lib: "es2020", props: []string{"allSettled"}},
 * 			{lib: "es2021", props: []string{"any"}},
 * 			{lib: "es2024", props: []string{"withResolvers"}},
 * 			{lib: "es2025", props: []string{"try"}},
 * 		},
 * 		"Symbol": {
 * 			{lib: "es2015", props: []string{"for", "keyFor"}},
 * 			{lib: "es2019", props: []string{"description"}},
 * 		},
 * 		"WeakMap": {
 * 			{lib: "es2015", props: []string{}},
 * 			{lib: "esnext", props: []string{
 * 				"getOrInsert",
 * 				"getOrInsertComputed",
 * 			}},
 * 		},
 * 		"WeakSet": {
 * 			{lib: "es2015", props: []string{}},
 * 		},
 * 		"String": {
 * 			{lib: "es2015", props: []string{"codePointAt", "includes", "endsWith", "normalize", "repeat", "startsWith", "anchor", "big", "blink", "bold", "fixed", "fontcolor", "fontsize", "italics", "link", "small", "strike", "sub", "sup"}},
 * 			{lib: "es2017", props: []string{"padStart", "padEnd"}},
 * 			{lib: "es2019", props: []string{"trimStart", "trimEnd", "trimLeft", "trimRight"}},
 * 			{lib: "es2020", props: []string{"matchAll"}},
 * 			{lib: "es2021", props: []string{"replaceAll"}},
 * 			{lib: "es2022", props: []string{"at"}},
 * 			{lib: "es2024", props: []string{"isWellFormed", "toWellFormed"}},
 * 		},
 * 		"StringConstructor": {
 * 			{lib: "es2015", props: []string{"fromCodePoint", "raw"}},
 * 		},
 * 		"DateTimeFormat": {
 * 			{lib: "es2017", props: []string{"formatToParts"}},
 * 		},
 * 		"Promise": {
 * 			{lib: "es2015", props: []string{}},
 * 			{lib: "es2018", props: []string{"finally"}},
 * 		},
 * 		"RegExpMatchArray": {
 * 			{lib: "es2018", props: []string{"groups"}},
 * 		},
 * 		"RegExpExecArray": {
 * 			{lib: "es2018", props: []string{"groups"}},
 * 		},
 * 		"Intl": {
 * 			{lib: "es2018", props: []string{"PluralRules"}},
 * 			{lib: "es2020", props: []string{"RelativeTimeFormat", "Locale", "DisplayNames"}},
 * 			{lib: "es2021", props: []string{"ListFormat", "DateTimeFormat"}},
 * 			{lib: "es2022", props: []string{"Segmenter"}},
 * 			{lib: "es2025", props: []string{"DurationFormat"}},
 * 		},
 * 		"NumberFormat": {
 * 			{lib: "es2018", props: []string{"formatToParts"}},
 * 		},
 * 		"SymbolConstructor": {
 * 			{lib: "es2020", props: []string{"matchAll"}},
 * 			{lib: "esnext", props: []string{
 * 				"metadata",
 * 				"dispose",
 * 				"asyncDispose",
 * 			}},
 * 		},
 * 		"DataView": {
 * 			{lib: "es2020", props: []string{"setBigInt64", "setBigUint64", "getBigInt64", "getBigUint64"}},
 * 			{lib: "es2025", props: []string{"setFloat16", "getFloat16"}},
 * 		},
 * 		"BigInt": {
 * 			{lib: "es2020", props: []string{}},
 * 		},
 * 		"RelativeTimeFormat": {
 * 			{lib: "es2020", props: []string{"format", "formatToParts", "resolvedOptions"}},
 * 		},
 * 		"Int8Array": {
 * 			{lib: "es2022", props: []string{"at"}},
 * 			{lib: "es2023", props: []string{"findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"}},
 * 		},
 * 		"Uint8Array": {
 * 			{lib: "es2022", props: []string{"at"}},
 * 			{lib: "es2023", props: []string{"findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"}},
 * 		},
 * 		"Uint8ClampedArray": {
 * 			{lib: "es2022", props: []string{"at"}},
 * 			{lib: "es2023", props: []string{"findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"}},
 * 		},
 * 		"Int16Array": {
 * 			{lib: "es2022", props: []string{"at"}},
 * 			{lib: "es2023", props: []string{"findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"}},
 * 		},
 * 		"Uint16Array": {
 * 			{lib: "es2022", props: []string{"at"}},
 * 			{lib: "es2023", props: []string{"findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"}},
 * 		},
 * 		"Int32Array": {
 * 			{lib: "es2022", props: []string{"at"}},
 * 			{lib: "es2023", props: []string{"findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"}},
 * 		},
 * 		"Uint32Array": {
 * 			{lib: "es2022", props: []string{"at"}},
 * 			{lib: "es2023", props: []string{"findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"}},
 * 		},
 * 		"Float16Array": {
 * 			{lib: "es2025", props: []string{}},
 * 		},
 * 		"Float32Array": {
 * 			{lib: "es2022", props: []string{"at"}},
 * 			{lib: "es2023", props: []string{"findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"}},
 * 		},
 * 		"Float64Array": {
 * 			{lib: "es2022", props: []string{"at"}},
 * 			{lib: "es2023", props: []string{"findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"}},
 * 		},
 * 		"BigInt64Array": {
 * 			{lib: "es2020", props: []string{}},
 * 			{lib: "es2022", props: []string{"at"}},
 * 			{lib: "es2023", props: []string{"findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"}},
 * 		},
 * 		"BigUint64Array": {
 * 			{lib: "es2020", props: []string{}},
 * 			{lib: "es2022", props: []string{"at"}},
 * 			{lib: "es2023", props: []string{"findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"}},
 * 		},
 * 		"Error": {
 * 			{lib: "es2022", props: []string{"cause"}},
 * 		},
 * 		"ErrorConstructor": {
 * 			{lib: "esnext", props: []string{"isError"}},
 * 		},
 * 		"Uint8ArrayConstructor": {
 * 			{lib: "esnext", props: []string{"fromBase64", "fromHex"}},
 * 		},
 * 		"DisposableStack": {
 * 			{lib: "esnext", props: []string{}},
 * 		},
 * 		"AsyncDisposableStack": {
 * 			{lib: "esnext", props: []string{}},
 * 		},
 * 		"Date": {
 * 			{lib: "esnext", props: []string{"toTemporalInstant"}},
 * 		},
 * 	}
 * })
 */
const featureMapValue: GoMap<string, GoSlice<FeatureMapEntry>> = new Map<string, GoSlice<FeatureMapEntry>>([
  ["Array", [
    { lib: "es2015", props: ["find", "findIndex", "fill", "copyWithin", "entries", "keys", "values"] },
    { lib: "es2016", props: ["includes"] },
    { lib: "es2019", props: ["flat", "flatMap"] },
    { lib: "es2022", props: ["at"] },
    { lib: "es2023", props: ["findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"] },
  ]],
  ["Iterator", [
    { lib: "es2015", props: [] },
  ]],
  ["AsyncIterator", [
    { lib: "es2015", props: [] },
  ]],
  ["ArrayBuffer", [
    { lib: "es2024", props: ["maxByteLength", "resizable", "resize", "detached", "transfer", "transferToFixedLength"] },
  ]],
  ["Atomics", [
    { lib: "es2017", props: ["add", "and", "compareExchange", "exchange", "isLockFree", "load", "or", "store", "sub", "wait", "notify", "xor"] },
    { lib: "es2024", props: ["waitAsync"] },
  ]],
  ["SharedArrayBuffer", [
    { lib: "es2017", props: ["byteLength", "slice"] },
    { lib: "es2024", props: ["growable", "maxByteLength", "grow"] },
  ]],
  ["AsyncIterable", [
    { lib: "es2018", props: [] },
  ]],
  ["AsyncIterableIterator", [
    { lib: "es2018", props: [] },
  ]],
  ["AsyncGenerator", [
    { lib: "es2018", props: [] },
  ]],
  ["AsyncGeneratorFunction", [
    { lib: "es2018", props: [] },
  ]],
  ["RegExp", [
    { lib: "es2015", props: ["flags", "sticky", "unicode"] },
    { lib: "es2018", props: ["dotAll"] },
    { lib: "es2024", props: ["unicodeSets"] },
  ]],
  ["RegExpConstructor", [
    { lib: "es2025", props: ["escape"] },
  ]],
  ["Reflect", [
    { lib: "es2015", props: ["apply", "construct", "defineProperty", "deleteProperty", "get", "getOwnPropertyDescriptor", "getPrototypeOf", "has", "isExtensible", "ownKeys", "preventExtensions", "set", "setPrototypeOf"] },
  ]],
  ["ArrayConstructor", [
    { lib: "es2015", props: ["from", "of"] },
    { lib: "esnext", props: ["fromAsync"] },
  ]],
  ["ObjectConstructor", [
    { lib: "es2015", props: ["assign", "getOwnPropertySymbols", "keys", "is", "setPrototypeOf"] },
    { lib: "es2017", props: ["values", "entries", "getOwnPropertyDescriptors"] },
    { lib: "es2019", props: ["fromEntries"] },
    { lib: "es2022", props: ["hasOwn"] },
    { lib: "es2024", props: ["groupBy"] },
  ]],
  ["NumberConstructor", [
    { lib: "es2015", props: ["isFinite", "isInteger", "isNaN", "isSafeInteger", "parseFloat", "parseInt"] },
  ]],
  ["Math", [
    { lib: "es2015", props: ["clz32", "imul", "sign", "log10", "log2", "log1p", "expm1", "cosh", "sinh", "tanh", "acosh", "asinh", "atanh", "hypot", "trunc", "fround", "cbrt"] },
    { lib: "es2025", props: ["f16round"] },
  ]],
  ["Map", [
    { lib: "es2015", props: ["entries", "keys", "values"] },
    { lib: "esnext", props: ["getOrInsert", "getOrInsertComputed"] },
  ]],
  ["MapConstructor", [
    { lib: "es2024", props: ["groupBy"] },
  ]],
  ["Set", [
    { lib: "es2015", props: ["entries", "keys", "values"] },
    { lib: "es2025", props: ["union", "intersection", "difference", "symmetricDifference", "isSubsetOf", "isSupersetOf", "isDisjointFrom"] },
  ]],
  ["PromiseConstructor", [
    { lib: "es2015", props: ["all", "race", "reject", "resolve"] },
    { lib: "es2020", props: ["allSettled"] },
    { lib: "es2021", props: ["any"] },
    { lib: "es2024", props: ["withResolvers"] },
    { lib: "es2025", props: ["try"] },
  ]],
  ["Symbol", [
    { lib: "es2015", props: ["for", "keyFor"] },
    { lib: "es2019", props: ["description"] },
  ]],
  ["WeakMap", [
    { lib: "es2015", props: [] },
    { lib: "esnext", props: ["getOrInsert", "getOrInsertComputed"] },
  ]],
  ["WeakSet", [
    { lib: "es2015", props: [] },
  ]],
  ["String", [
    { lib: "es2015", props: ["codePointAt", "includes", "endsWith", "normalize", "repeat", "startsWith", "anchor", "big", "blink", "bold", "fixed", "fontcolor", "fontsize", "italics", "link", "small", "strike", "sub", "sup"] },
    { lib: "es2017", props: ["padStart", "padEnd"] },
    { lib: "es2019", props: ["trimStart", "trimEnd", "trimLeft", "trimRight"] },
    { lib: "es2020", props: ["matchAll"] },
    { lib: "es2021", props: ["replaceAll"] },
    { lib: "es2022", props: ["at"] },
    { lib: "es2024", props: ["isWellFormed", "toWellFormed"] },
  ]],
  ["StringConstructor", [
    { lib: "es2015", props: ["fromCodePoint", "raw"] },
  ]],
  ["DateTimeFormat", [
    { lib: "es2017", props: ["formatToParts"] },
  ]],
  ["Promise", [
    { lib: "es2015", props: [] },
    { lib: "es2018", props: ["finally"] },
  ]],
  ["RegExpMatchArray", [
    { lib: "es2018", props: ["groups"] },
  ]],
  ["RegExpExecArray", [
    { lib: "es2018", props: ["groups"] },
  ]],
  ["Intl", [
    { lib: "es2018", props: ["PluralRules"] },
    { lib: "es2020", props: ["RelativeTimeFormat", "Locale", "DisplayNames"] },
    { lib: "es2021", props: ["ListFormat", "DateTimeFormat"] },
    { lib: "es2022", props: ["Segmenter"] },
    { lib: "es2025", props: ["DurationFormat"] },
  ]],
  ["NumberFormat", [
    { lib: "es2018", props: ["formatToParts"] },
  ]],
  ["SymbolConstructor", [
    { lib: "es2020", props: ["matchAll"] },
    { lib: "esnext", props: ["metadata", "dispose", "asyncDispose"] },
  ]],
  ["DataView", [
    { lib: "es2020", props: ["setBigInt64", "setBigUint64", "getBigInt64", "getBigUint64"] },
    { lib: "es2025", props: ["setFloat16", "getFloat16"] },
  ]],
  ["BigInt", [
    { lib: "es2020", props: [] },
  ]],
  ["RelativeTimeFormat", [
    { lib: "es2020", props: ["format", "formatToParts", "resolvedOptions"] },
  ]],
  ["Int8Array", [
    { lib: "es2022", props: ["at"] },
    { lib: "es2023", props: ["findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"] },
  ]],
  ["Uint8Array", [
    { lib: "es2022", props: ["at"] },
    { lib: "es2023", props: ["findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"] },
  ]],
  ["Uint8ClampedArray", [
    { lib: "es2022", props: ["at"] },
    { lib: "es2023", props: ["findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"] },
  ]],
  ["Int16Array", [
    { lib: "es2022", props: ["at"] },
    { lib: "es2023", props: ["findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"] },
  ]],
  ["Uint16Array", [
    { lib: "es2022", props: ["at"] },
    { lib: "es2023", props: ["findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"] },
  ]],
  ["Int32Array", [
    { lib: "es2022", props: ["at"] },
    { lib: "es2023", props: ["findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"] },
  ]],
  ["Uint32Array", [
    { lib: "es2022", props: ["at"] },
    { lib: "es2023", props: ["findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"] },
  ]],
  ["Float16Array", [
    { lib: "es2025", props: [] },
  ]],
  ["Float32Array", [
    { lib: "es2022", props: ["at"] },
    { lib: "es2023", props: ["findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"] },
  ]],
  ["Float64Array", [
    { lib: "es2022", props: ["at"] },
    { lib: "es2023", props: ["findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"] },
  ]],
  ["BigInt64Array", [
    { lib: "es2020", props: [] },
    { lib: "es2022", props: ["at"] },
    { lib: "es2023", props: ["findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"] },
  ]],
  ["BigUint64Array", [
    { lib: "es2020", props: [] },
    { lib: "es2022", props: ["at"] },
    { lib: "es2023", props: ["findLastIndex", "findLast", "toReversed", "toSorted", "toSpliced", "with"] },
  ]],
  ["Error", [
    { lib: "es2022", props: ["cause"] },
  ]],
  ["ErrorConstructor", [
    { lib: "esnext", props: ["isError"] },
  ]],
  ["Uint8ArrayConstructor", [
    { lib: "esnext", props: ["fromBase64", "fromHex"] },
  ]],
  ["DisposableStack", [
    { lib: "esnext", props: [] },
  ]],
  ["AsyncDisposableStack", [
    { lib: "esnext", props: [] },
  ]],
  ["Date", [
    { lib: "esnext", props: ["toTemporalInstant"] },
  ]],
]);

export const getFeatureMap = (): GoMap<string, GoSlice<FeatureMapEntry>> => featureMapValue;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::rangeOfTypeParameters","kind":"func","status":"implemented","sigHash":"3b96c6d77a3011eff67caed0c5370d8d0c0e881c217e70234a2ce374030685d1","bodyHash":"d2c5ff22c84983fb52406c10b321a8873d61b10e82b9480d194c80956ad0734a"}
 *
 * Go source:
 * func rangeOfTypeParameters(sourceFile *ast.SourceFile, typeParameters *ast.NodeList) core.TextRange {
 * 	return core.NewTextRange(typeParameters.Pos()-1, min(len(sourceFile.Text()), scanner.SkipTrivia(sourceFile.Text(), typeParameters.End())+1))
 * }
 */
export function rangeOfTypeParameters(sourceFile: GoPtr<SourceFile>, typeParameters: GoPtr<NodeList>): TextRange {
  const text = SourceFile_Text(sourceFile);
  return NewTextRange(NodeList_Pos(typeParameters) - 1, globalThis.Math.min(text.length, SkipTrivia(text, NodeList_End(typeParameters)) + 1));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::tryGetPropertyAccessOrIdentifierToString","kind":"func","status":"implemented","sigHash":"b858fc2dce5d06fa7846e79ec105b120b7d006bbc2aa6c01747dc41407bf1064","bodyHash":"031e32c2ee5b48ae79243da0f8aaf5bcc6edeb91cc691070f9c26a1b4e472da0"}
 *
 * Go source:
 * func tryGetPropertyAccessOrIdentifierToString(expr *ast.Node) string {
 * 	switch {
 * 	case ast.IsPropertyAccessExpression(expr):
 * 		baseStr := tryGetPropertyAccessOrIdentifierToString(expr.Expression())
 * 		if baseStr != "" {
 * 			return baseStr + "." + entityNameToString(expr.Name())
 * 		}
 * 	case ast.IsElementAccessExpression(expr):
 * 		baseStr := tryGetPropertyAccessOrIdentifierToString(expr.Expression())
 * 		if baseStr != "" && ast.IsPropertyName(expr.AsElementAccessExpression().ArgumentExpression) {
 * 			return baseStr + "." + ast.GetPropertyNameForPropertyNameNode(expr.AsElementAccessExpression().ArgumentExpression)
 * 		}
 * 	case ast.IsIdentifier(expr):
 * 		return expr.Text()
 * 	case ast.IsJsxNamespacedName(expr):
 * 		return entityNameToString(expr)
 * 	}
 * 	return ""
 * }
 */
export function tryGetPropertyAccessOrIdentifierToString(expr: GoPtr<Node>): string {
  if (IsPropertyAccessExpression(expr)) {
    const baseStr = tryGetPropertyAccessOrIdentifierToString(Node_Expression(expr));
    if (baseStr !== "") {
      return baseStr + "." + entityNameToString(Node_Name(expr));
    }
  } else if (IsElementAccessExpression(expr)) {
    const baseStr = tryGetPropertyAccessOrIdentifierToString(Node_Expression(expr));
    const argumentExpression = AsElementAccessExpression(expr)!.ArgumentExpression;
    if (baseStr !== "" && IsPropertyName(argumentExpression)) {
      return baseStr + "." + GetPropertyNameForPropertyNameNode(argumentExpression);
    }
  } else if (IsIdentifier(expr)) {
    return Node_Text(expr);
  } else if (IsJsxNamespacedName(expr)) {
    return entityNameToString(expr);
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::allDeclarationsInSameSourceFile","kind":"func","status":"implemented","sigHash":"7d2851dfb5af00d7a94f7995700a4e238159567cde1bb5dc26b12dfefd788d41","bodyHash":"4c0ebc1099009a6eb23c67dd71a4e660805bd9485904b551b27a50c4560e2bc2"}
 *
 * Go source:
 * func allDeclarationsInSameSourceFile(symbol *ast.Symbol) bool {
 * 	if len(symbol.Declarations) > 1 {
 * 		var sourceFile *ast.SourceFile
 * 		for i, d := range symbol.Declarations {
 * 			if i == 0 {
 * 				sourceFile = ast.GetSourceFileOfNode(d)
 * 			} else if ast.GetSourceFileOfNode(d) != sourceFile {
 * 				return false
 * 			}
 * 		}
 * 	}
 * 	return true
 * }
 */
export function allDeclarationsInSameSourceFile(symbol_: GoPtr<Symbol>): bool {
  if ((symbol_!.Declarations?.length ?? 0) > 1) {
    let sourceFile: GoPtr<SourceFile> = undefined;
    for (let i = 0; i < symbol_!.Declarations!.length; i++) {
      const d = symbol_!.Declarations![i]!;
      if (i === 0) {
        sourceFile = GetSourceFileOfNode(d);
      } else if (GetSourceFileOfNode(d) !== sourceFile) {
        return false as bool;
      }
    }
  }
  return true as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::containsNonMissingUndefinedType","kind":"func","status":"implemented","sigHash":"fc495b3d40ea6be026ebd69754974090ae2205f45dbded33426d401be03bd5f9","bodyHash":"bbb4c1c0959633bc519720db15bde5be6b01dccbaaea991e4b900c1b5276c7e2"}
 *
 * Go source:
 * func containsNonMissingUndefinedType(c *Checker, t *Type) bool {
 * 	var candidate *Type
 * 	if t.flags&TypeFlagsUnion != 0 {
 * 		candidate = t.AsUnionType().types[0]
 * 	} else {
 * 		candidate = t
 * 	}
 * 	return candidate.flags&TypeFlagsUndefined != 0 && candidate != c.missingType
 * }
 */
export function containsNonMissingUndefinedType(c: GoPtr<Checker>, t: GoPtr<Type>): bool {
  const candidate = (t!.flags & TypeFlagsUnion) !== 0 ? Type_Types(t)[0] : t;
  return ((candidate!.flags & TypeFlagsUndefined) !== 0 && candidate !== c!.missingType) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::getAnyImportSyntax","kind":"func","status":"implemented","sigHash":"5eed622afcf885a95d84c80f2b49a835e4e4ec59ae9a9ba873dc672b41c88186","bodyHash":"683edbaa23d1240fbe0d3f6c072dcd73c72b5b7c64ad303b7b320b19d5e75484"}
 *
 * Go source:
 * func getAnyImportSyntax(node *ast.Node) *ast.Node {
 * 	var importNode *ast.Node
 * 	switch node.Kind {
 * 	case ast.KindImportEqualsDeclaration:
 * 		importNode = node
 * 	case ast.KindImportClause:
 * 		importNode = node.Parent
 * 	case ast.KindNamespaceImport:
 * 		importNode = node.Parent.Parent
 * 	case ast.KindImportSpecifier:
 * 		importNode = node.Parent.Parent.Parent
 * 	default:
 * 		return nil
 * 	}
 * 	return importNode
 * }
 */
export function getAnyImportSyntax(node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindImportEqualsDeclaration:
      return node;
    case KindImportClause:
      return node!.Parent;
    case KindNamespaceImport:
      return node!.Parent!.Parent;
    case KindImportSpecifier:
      return node!.Parent!.Parent!.Parent;
    default:
      return undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::isReservedMemberName","kind":"func","status":"implemented","sigHash":"5a505bab8633a207d0a620143ae35c1b2f565070986edcdb0f6cf8fe1d14fc58","bodyHash":"279b566ae2ef3fe458fa9f31658cfa7598065b433d3316db6e34f87d9c826be3"}
 *
 * Go source:
 * func isReservedMemberName(name string) bool {
 * 	return len(name) >= 2 && name[0] == '\xFE' && name[1] != '@' && name[1] != '#'
 * }
 */
export function isReservedMemberName(name: string): bool {
  // Same prefix-constant note as isLateBoundName.
  return (name.length >= 2 && name.startsWith(InternalSymbolNamePrefix) && name.charCodeAt(1) !== 0x40 && name.charCodeAt(1) !== 0x23) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::introducesArgumentsExoticObject","kind":"func","status":"implemented","sigHash":"cc4d9de75831bf81eb70b95b5227bd42c3bdc917b7332892d3277046598d0b41","bodyHash":"8019f86c29f8157332751954cc235c4efc09d289018b79beb070ab2dcda8f816"}
 *
 * Go source:
 * func introducesArgumentsExoticObject(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindMethodDeclaration, ast.KindMethodSignature, ast.KindConstructor, ast.KindGetAccessor,
 * 		ast.KindSetAccessor, ast.KindFunctionDeclaration, ast.KindFunctionExpression:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function introducesArgumentsExoticObject(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindMethodDeclaration:
    case KindMethodSignature:
    case KindConstructor:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindFunctionDeclaration:
    case KindFunctionExpression:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::symbolsToArray","kind":"func","status":"implemented","sigHash":"dc8da83cf73336fa172d4f7a162d85eae8772f184a98f897c58539d35aae0d85","bodyHash":"ac98477d90330ae3c7d6cb3712aded1c5cf398992aeabf57c91a2dfaec62f412"}
 *
 * Go source:
 * func symbolsToArray(symbols ast.SymbolTable) []*ast.Symbol {
 * 	var result []*ast.Symbol
 * 	for id, symbol := range symbols {
 * 		if !isReservedMemberName(id) {
 * 			result = append(result, symbol)
 * 		}
 * 	}
 * 	return result
 * }
 */
export function symbolsToArray(symbols: SymbolTable): GoSlice<GoPtr<Symbol>> {
  let result: GoSlice<GoPtr<Symbol>> = [];
  for (const [id, symbol] of symbols) {
    if (!isReservedMemberName(id)) {
      result = [...result, symbol];
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::SkipAlias","kind":"func","status":"implemented","sigHash":"912d1e9750065e24bf6e5fcdbb88811646f4bbf59a054e99099000db0560c1d1","bodyHash":"5df1ab2fcd91c3373e8f5f95dc80a711c443ccc2eb55fca86f242c49bbe7cb23"}
 *
 * Go source:
 * func SkipAlias(symbol *ast.Symbol, checker *Checker) *ast.Symbol {
 * 	if symbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 		return checker.GetAliasedSymbol(symbol)
 * 	}
 * 	return symbol
 * }
 */
export function SkipAlias(symbol_: GoPtr<Symbol>, checker: GoPtr<Checker>): GoPtr<Symbol> {
  if ((symbol_!.Flags & SymbolFlagsAlias) !== 0) {
    return Checker_GetAliasedSymbol(checker, symbol_);
  }
  return symbol_;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::IsExternalModuleSymbol","kind":"func","status":"implemented","sigHash":"a78e59a51643bf18183407391eca4129afa7d01daf9fffebb02b7c21c37517e1","bodyHash":"84947dc7373c355f97d14295111f0279615f4b99f18a2e62201bc16beaf713c4"}
 *
 * Go source:
 * func IsExternalModuleSymbol(moduleSymbol *ast.Symbol) bool {
 * 	firstRune, _ := utf8.DecodeRuneInString(moduleSymbol.Name)
 * 	return moduleSymbol.Flags&ast.SymbolFlagsModule != 0 && firstRune == '"'
 * }
 */
export function IsExternalModuleSymbol(moduleSymbol: GoPtr<Symbol>): bool {
  return ((moduleSymbol!.Flags & SymbolFlagsModule) !== 0 && moduleSymbol!.Name.length > 0 && moduleSymbol!.Name.charCodeAt(0) === "\"".charCodeAt(0)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.isCanceled","kind":"method","status":"implemented","sigHash":"6289369daf3b5928b1cbe16e00f6a655588eb1de12d03cf6e4decc4c5c051d78","bodyHash":"c49d90e95db1e7903473864ae1c88d9cd8bb7d5a19a07387c77e4d8c116fd73f"}
 *
 * Go source:
 * func (c *Checker) isCanceled() bool {
 * 	return c.ctx != nil && c.ctx.Err() != nil
 * }
 */
export function Checker_isCanceled(receiver: GoPtr<Checker>): bool {
  return (receiver!.ctx !== undefined && receiver!.ctx.Err() !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.checkNotCanceled","kind":"method","status":"implemented","sigHash":"ace30975355abc68ccd5eb7a82ac1dcb85231af10ac6f01e4ed23e8cf386e83a","bodyHash":"f49f27d56430f7c222c7fd85b6699c364607b69aae176eee64ea7ccabf0fdd1f"}
 *
 * Go source:
 * func (c *Checker) checkNotCanceled() {
 * 	if c.wasCanceled {
 * 		panic("Checker was previously cancelled")
 * 	}
 * }
 */
export function Checker_checkNotCanceled(receiver: GoPtr<Checker>): void {
  if (receiver!.wasCanceled) {
    throw new globalThis.Error("Checker was previously cancelled");
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.getPackagesMap","kind":"method","status":"implemented","sigHash":"0becfc224f9763da7d2321581c4a56027aa655cb7347727b1c6e13ccd21be551","bodyHash":"b82d59b284ffdb60f730170bad6a453229e80f36cf3ecb965e09ca5b275cce3f"}
 *
 * Go source:
 * func (c *Checker) getPackagesMap() map[string]bool {
 * 	if c.packagesMap == nil {
 * 		c.packagesMap = make(map[string]bool)
 * 		resolvedModules := c.program.GetResolvedModules()
 * 		for _, resolvedModulesInFile := range resolvedModules {
 * 			for _, module := range resolvedModulesInFile {
 * 				if module.PackageId.Name != "" {
 * 					c.packagesMap[module.PackageId.Name] = c.packagesMap[module.PackageId.Name] || module.Extension == tspath.ExtensionDts
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return c.packagesMap
 * }
 */
export function Checker_getPackagesMap(receiver: GoPtr<Checker>): GoMap<string, bool> {
  if (receiver!.packagesMap === undefined) {
    receiver!.packagesMap = new globalThis.Map<string, bool>();
    const resolvedModules = receiver!.program.GetResolvedModules();
    for (const [, resolvedModulesInFile] of resolvedModules) {
      for (const [, module_] of resolvedModulesInFile) {
        const module = module_ as GoPtr<ResolvedModule>;
        if (module !== undefined && module!.PackageId.Name !== "") {
          receiver!.packagesMap.set(
            module!.PackageId.Name,
            (receiver!.packagesMap.get(module!.PackageId.Name) || module!.Extension === ExtensionDts) as bool,
          );
        }
      }
    }
  }
  return receiver!.packagesMap;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.typesPackageExists","kind":"method","status":"implemented","sigHash":"f083cc9965812f716906eeee944ee1cb3219318985b9d76a40571a88187cd90a","bodyHash":"8cc3ac4e20e78eec4ace260aae1597e7afdce91578bb04ac28c27bbc8fb1f3e4"}
 *
 * Go source:
 * func (c *Checker) typesPackageExists(packageName string) bool {
 * 	packagesMap := c.getPackagesMap()
 * 	_, ok := packagesMap[module.GetTypesPackageName(packageName)]
 * 	return ok
 * }
 */
export function Checker_typesPackageExists(receiver: GoPtr<Checker>, packageName: string): bool {
  const packagesMap = Checker_getPackagesMap(receiver);
  return packagesMap.has(GetTypesPackageName(packageName)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.packageBundlesTypes","kind":"method","status":"implemented","sigHash":"687e6d4b496a3fef0324efb51d665793d419253697b9259afcb9cab00534dce6","bodyHash":"dbbbe3d6c7f1208915244cf5be14a5f35ef351f4bc01d709f9fe7e62be94f024"}
 *
 * Go source:
 * func (c *Checker) packageBundlesTypes(packageName string) bool {
 * 	packagesMap := c.getPackagesMap()
 * 	hasTypes, _ := packagesMap[packageName]
 * 	return hasTypes
 * }
 */
export function Checker_packageBundlesTypes(receiver: GoPtr<Checker>, packageName: string): bool {
  const packagesMap = Checker_getPackagesMap(receiver);
  return (packagesMap.get(packageName) ?? false) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::ValueToString","kind":"func","status":"implemented","sigHash":"6bfbf51dd0bd845bb15b118f5ba252da4620105a9ce9215bc11b556f006ae240","bodyHash":"d97549a0b5d289833c4a58931b0a1edfaffa600b1e1485b53cb1d03f17cb3c02"}
 *
 * Go source:
 * func ValueToString(value any) string {
 * 	switch value := value.(type) {
 * 	case string:
 * 		return "\"" + printer.EscapeString(value, '"') + "\""
 * 	case jsnum.Number:
 * 		return value.String()
 * 	case bool:
 * 		return core.IfElse(value, "true", "false")
 * 	case jsnum.PseudoBigInt:
 * 		return value.String() + "n"
 * 	}
 * 	panic("unhandled value type in valueToString")
 * }
 */
export function ValueToString(value: unknown): string {
  switch (typeof value) {
    case "string":
      return "\"" + EscapeString(value, QuoteCharDoubleQuote) + "\"";
    case "number":
      return Number_String(value as JsNumber);
    case "boolean":
      return value ? "true" : "false";
  }
  if (typeof value === "object" && value !== null && "Base10Value" in value && "Negative" in value) {
    return PseudoBigInt_String(value as PseudoBigInt) + "n";
  }
  throw new globalThis.Error("unhandled value type in valueToString");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::nodeStartsNewLexicalEnvironment","kind":"func","status":"implemented","sigHash":"26c2f1f55d6ea81d0eac4448bf82ef593a3a5963f479864ac507beccaddd41c5","bodyHash":"2e5dcbd24593b8d54c2ab9c034304fadeabb8e11556e671b2255d4f25ae47135"}
 *
 * Go source:
 * func nodeStartsNewLexicalEnvironment(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindConstructor, ast.KindFunctionExpression, ast.KindFunctionDeclaration, ast.KindArrowFunction,
 * 		ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor, ast.KindModuleDeclaration, ast.KindSourceFile:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function nodeStartsNewLexicalEnvironment(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindConstructor:
    case KindFunctionExpression:
    case KindFunctionDeclaration:
    case KindArrowFunction:
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindModuleDeclaration:
    case KindSourceFile:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.isUncheckedJSSuggestion","kind":"method","status":"implemented","sigHash":"089d53df10059fa476d7b8268b879caccc78bb11d2a643fa0d7d3786c3688756","bodyHash":"7bd8f31cb40c20168296cadee41934eb6f199944ec104978f254d5d321b45b18"}
 *
 * Go source:
 * func (c *Checker) isUncheckedJSSuggestion(node *ast.Node, suggestion *ast.Symbol, excludeClasses bool) bool {
 * 	file := ast.GetSourceFileOfNode(node)
 * 	if file != nil {
 * 		if c.compilerOptions.CheckJs.IsUnknown() && file.CheckJsDirective == nil && (file.ScriptKind == core.ScriptKindJS || file.ScriptKind == core.ScriptKindJSX) {
 * 			var declarationFile *ast.SourceFile
 * 			if suggestion != nil {
 * 				if firstDeclaration := core.FirstOrNil(suggestion.Declarations); firstDeclaration != nil {
 * 					declarationFile = ast.GetSourceFileOfNode(firstDeclaration)
 * 				}
 * 			}
 * 			suggestionHasNoExtendsOrDecorators := suggestion == nil ||
 * 				suggestion.ValueDeclaration == nil ||
 * 				!ast.IsClassLike(suggestion.ValueDeclaration) ||
 * 				len(ast.GetExtendsHeritageClauseElements(suggestion.ValueDeclaration)) != 0 ||
 * 				ast.ClassOrConstructorParameterIsDecorated(false, suggestion.ValueDeclaration)
 * 			return !(file != declarationFile && declarationFile != nil && ast.IsGlobalSourceFile(declarationFile.AsNode())) &&
 * 				!(excludeClasses && suggestion != nil && suggestion.Flags&ast.SymbolFlagsClass != 0 && suggestionHasNoExtendsOrDecorators) &&
 * 				!(node != nil && excludeClasses && ast.IsPropertyAccessExpression(node) && node.Expression().Kind == ast.KindThisKeyword && suggestionHasNoExtendsOrDecorators)
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_isUncheckedJSSuggestion(receiver: GoPtr<Checker>, node: GoPtr<Node>, suggestion: GoPtr<Symbol>, excludeClasses: bool): bool {
  const file = GetSourceFileOfNode(node);
  if (file !== undefined) {
    if (Tristate_IsUnknown(receiver!.compilerOptions!.CheckJs) && file!.CheckJsDirective === undefined && (file!.ScriptKind === ScriptKindJS || file!.ScriptKind === ScriptKindJSX)) {
      let declarationFile: GoPtr<SourceFile> = undefined;
      if (suggestion !== undefined) {
        const firstDeclaration = FirstOrNil(suggestion!.Declarations ?? []);
        if (firstDeclaration !== undefined) {
          declarationFile = GetSourceFileOfNode(firstDeclaration);
        }
      }
      const suggestionHasNoExtendsOrDecorators = suggestion === undefined ||
        suggestion!.ValueDeclaration === undefined ||
        !IsClassLike(suggestion!.ValueDeclaration) ||
        GetExtendsHeritageClauseElements(suggestion!.ValueDeclaration).length !== 0 ||
        ClassOrConstructorParameterIsDecorated(false as bool, suggestion!.ValueDeclaration);
      return (!(file !== declarationFile && declarationFile !== undefined && IsGlobalSourceFile(declarationFile)) &&
        !(excludeClasses && suggestion !== undefined && (suggestion!.Flags & SymbolFlagsClass) !== 0 && suggestionHasNoExtendsOrDecorators) &&
        !(node !== undefined && excludeClasses && IsPropertyAccessExpression(node) && Node_Expression(node)!.Kind === KindThisKeyword && suggestionHasNoExtendsOrDecorators)) as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::method::Checker.isJSLiteralType","kind":"method","status":"implemented","sigHash":"98ddf5f280f9feab9b007380d5ac9490e80b645605095e99847759f29d89d8c1","bodyHash":"577c69b0c4e46ea4ab81f0a4f523ad119c69baee09398175bc586bdc23a7f47d"}
 *
 * Go source:
 * func (c *Checker) isJSLiteralType(t *Type) bool {
 * 	if c.noImplicitAny {
 * 		return false
 * 		// Flag is meaningless under `noImplicitAny` mode
 * 	}
 * 	if t.objectFlags&ObjectFlagsJSLiteral != 0 {
 * 		return true
 * 	}
 * 	if t.flags&TypeFlagsUnion != 0 {
 * 		return core.Every(t.AsUnionType().types, c.isJSLiteralType)
 * 	}
 * 	if t.flags&TypeFlagsIntersection != 0 {
 * 		return core.Some(t.AsIntersectionType().types, c.isJSLiteralType)
 * 	}
 * 	if t.flags&TypeFlagsInstantiable != 0 {
 * 		constraint := c.getResolvedBaseConstraint(t, nil)
 * 		return constraint != t && c.isJSLiteralType(constraint)
 * 	}
 * 	return false
 * }
 */
export function Checker_isJSLiteralType(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  if (receiver!.noImplicitAny) {
    return false as bool;
    // Flag is meaningless under `noImplicitAny` mode
  }
  if ((t!.objectFlags & ObjectFlagsJSLiteral) !== 0) {
    return true as bool;
  }
  if ((t!.flags & TypeFlagsUnion) !== 0) {
    return Every(Type_Types(t), (element: GoPtr<Type>): bool => Checker_isJSLiteralType(receiver, element));
  }
  if ((t!.flags & TypeFlagsIntersection) !== 0) {
    return Some(Type_Types(t), (element: GoPtr<Type>): bool => Checker_isJSLiteralType(receiver, element));
  }
  if ((t!.flags & TypeFlagsInstantiable) !== 0) {
    const constraint = Checker_getResolvedBaseConstraint(receiver, t, []);
    return (constraint !== t && Checker_isJSLiteralType(receiver, constraint)) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::type::DiagnosticDetails","kind":"type","status":"implemented","sigHash":"84b28122cefd93e7dee846efe7e2c79c3da0b2ccfe1bc3bf73a655b05f9f6be7","bodyHash":"564fae5f9838c9348060d9f546a192a04fb239fd0de411f2c00d7fdaae9b89af"}
 *
 * Go source:
 * DiagnosticDetails struct {
 * 	Message *diagnostics.Message
 * 	Args    []any
 * }
 */
export interface DiagnosticDetails {
  Message: GoPtr<Message>;
  Args: GoSlice<unknown>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::CreateModuleNotFoundChain","kind":"func","status":"implemented","sigHash":"00d5057255e36d3ba796dc979546b43e3043cc46331b16dd607f1e1a1320186e","bodyHash":"cb5b375a5943ce8dc0409a79f88d19106bc1ae9a21b6900ed40f6ec40bcd4daf"}
 *
 * Go source:
 * func CreateModuleNotFoundChain(program Program, file *ast.SourceFile, moduleReference string, mode core.ResolutionMode, packageName string) DiagnosticDetails {
 * 	resolvedModule := program.GetResolvedModule(file, moduleReference, mode)
 * 
 * 	if resolvedModule != nil && resolvedModule.AlternateResult != "" {
 * 		if strings.Contains(resolvedModule.AlternateResult, "/node_modules/@types/") {
 * 			packageName = "@types/" + module.MangleScopedPackageName(packageName)
 * 		}
 * 		return DiagnosticDetails{
 * 			Message: diagnostics.There_are_types_at_0_but_this_result_could_not_be_resolved_when_respecting_package_json_exports_The_1_library_may_need_to_update_its_package_json_or_typings,
 * 			Args:    []any{resolvedModule.AlternateResult, packageName},
 * 		}
 * 	}
 * 
 * 	packagesMap := program.GetPackagesMap()
 * 	if _, ok := packagesMap[module.GetTypesPackageName(packageName)]; ok {
 * 		return DiagnosticDetails{
 * 			Message: diagnostics.If_the_0_package_actually_exposes_this_module_consider_sending_a_pull_request_to_amend_https_Colon_Slash_Slashgithub_com_SlashDefinitelyTyped_SlashDefinitelyTyped_Slashtree_Slashmaster_Slashtypes_Slash_1,
 * 			Args:    []any{packageName, module.MangleScopedPackageName(packageName)},
 * 		}
 * 	}
 * 	if packagesMap[packageName] {
 * 		return DiagnosticDetails{
 * 			Message: diagnostics.If_the_0_package_actually_exposes_this_module_try_adding_a_new_declaration_d_ts_file_containing_declare_module_1,
 * 			Args:    []any{packageName, moduleReference},
 * 		}
 * 	}
 * 	return DiagnosticDetails{
 * 		Message: diagnostics.Try_npm_i_save_dev_types_Slash_1_if_it_exists_or_add_a_new_declaration_d_ts_file_containing_declare_module_0,
 * 		Args:    []any{moduleReference, module.MangleScopedPackageName(packageName)},
 * 	}
 * }
 */
export function CreateModuleNotFoundChain(program: Program, file: GoPtr<SourceFile>, moduleReference: string, mode: ResolutionMode, packageName: string): DiagnosticDetails {
  const currentSourceFile = NewHasFileName(SourceFile_FileName(file), SourceFile_Path(file)) as HasFileName;
  const resolvedModule = program.GetResolvedModule(currentSourceFile, moduleReference, mode);

  if (resolvedModule !== undefined && resolvedModule!.AlternateResult !== "") {
    if (resolvedModule!.AlternateResult.includes("/node_modules/@types/")) {
      packageName = "@types/" + MangleScopedPackageName(packageName);
    }
    return {
      Message: There_are_types_at_0_but_this_result_could_not_be_resolved_when_respecting_package_json_exports_The_1_library_may_need_to_update_its_package_json_or_typings,
      Args: [resolvedModule!.AlternateResult, packageName],
    };
  }

  const packagesMap = program.GetPackagesMap();
  if (packagesMap.has(GetTypesPackageName(packageName))) {
    return {
      Message: If_the_0_package_actually_exposes_this_module_consider_sending_a_pull_request_to_amend_https_Colon_Slash_Slashgithub_com_SlashDefinitelyTyped_SlashDefinitelyTyped_Slashtree_Slashmaster_Slashtypes_Slash_1,
      Args: [packageName, MangleScopedPackageName(packageName)],
    };
  }
  if (packagesMap.get(packageName)) {
    return {
      Message: If_the_0_package_actually_exposes_this_module_try_adding_a_new_declaration_d_ts_file_containing_declare_module_1,
      Args: [packageName, moduleReference],
    };
  }
  return {
    Message: Try_npm_i_save_dev_types_Slash_1_if_it_exists_or_add_a_new_declaration_d_ts_file_containing_declare_module_0,
    Args: [moduleReference, MangleScopedPackageName(packageName)],
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/utilities.go::func::CreateModeMismatchDetails","kind":"func","status":"implemented","sigHash":"62c0e3e8283d16b2686196528980fbdfb35a369ef161ea182628f6e6f9f9e191","bodyHash":"cd20aa560ff1cd1a2252197980a9dfdab20708d6ad3ddf297b7f8620ce61f36b"}
 *
 * Go source:
 * func CreateModeMismatchDetails(program Program, file *ast.SourceFile) DiagnosticDetails {
 * 	ext := tspath.TryGetExtensionFromPath(file.FileName())
 * 	targetExt := core.IfElse(ext == tspath.ExtensionTs, tspath.ExtensionMts, core.IfElse(ext == tspath.ExtensionJs, tspath.ExtensionMjs, ""))
 * 	meta := program.GetSourceFileMetaData(file.Path())
 * 	packageJsonType := meta.PackageJsonType
 * 	packageJsonDirectory := meta.PackageJsonDirectory
 * 
 * 	if packageJsonDirectory != "" && packageJsonType == "" {
 * 		if targetExt != "" {
 * 			return DiagnosticDetails{
 * 				Message: diagnostics.To_convert_this_file_to_an_ECMAScript_module_change_its_file_extension_to_0_or_add_the_field_type_Colon_module_to_1,
 * 				Args:    []any{targetExt, tspath.CombinePaths(packageJsonDirectory, "package.json")},
 * 			}
 * 		}
 * 		return DiagnosticDetails{
 * 			Message: diagnostics.To_convert_this_file_to_an_ECMAScript_module_add_the_field_type_Colon_module_to_0,
 * 			Args:    []any{tspath.CombinePaths(packageJsonDirectory, "package.json")},
 * 		}
 * 	}
 * 	if targetExt != "" {
 * 		return DiagnosticDetails{
 * 			Message: diagnostics.To_convert_this_file_to_an_ECMAScript_module_change_its_file_extension_to_0_or_create_a_local_package_json_file_with_type_Colon_module,
 * 			Args:    []any{targetExt},
 * 		}
 * 	}
 * 	return DiagnosticDetails{
 * 		Message: diagnostics.To_convert_this_file_to_an_ECMAScript_module_create_a_local_package_json_file_with_type_Colon_module,
 * 		Args:    nil,
 * 	}
 * }
 */
export function CreateModeMismatchDetails(program: Program, file: GoPtr<SourceFile>): DiagnosticDetails {
  const ext = TryGetExtensionFromPath(SourceFile_FileName(file));
  const targetExt = ext === ExtensionTs ? ExtensionMts : ext === ExtensionJs ? ExtensionMjs : "";
  const meta = program.GetSourceFileMetaData(SourceFile_Path(file));
  const packageJsonType = meta.PackageJsonType;
  const packageJsonDirectory = meta.PackageJsonDirectory;

  if (packageJsonDirectory !== "" && packageJsonType === "") {
    if (targetExt !== "") {
      return {
        Message: To_convert_this_file_to_an_ECMAScript_module_change_its_file_extension_to_0_or_add_the_field_type_Colon_module_to_1,
        Args: [targetExt, CombinePaths(packageJsonDirectory, "package.json")],
      };
    }
    return {
      Message: To_convert_this_file_to_an_ECMAScript_module_add_the_field_type_Colon_module_to_0,
      Args: [CombinePaths(packageJsonDirectory, "package.json")],
    };
  }
  if (targetExt !== "") {
    return {
      Message: To_convert_this_file_to_an_ECMAScript_module_change_its_file_extension_to_0_or_create_a_local_package_json_file_with_type_Colon_module,
      Args: [targetExt],
    };
  }
  return {
    Message: To_convert_this_file_to_an_ECMAScript_module_create_a_local_package_json_file_with_type_Colon_module,
    Args: [],
  };
}
