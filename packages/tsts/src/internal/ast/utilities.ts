import type { bool, int, short, ulong } from "@tsonic/core/types.js";
import type { GoConstraint, GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import * as slices from "../../go/slices.js";
import * as strings from "../../go/strings.js";
import type { Pool } from "../../go/sync.js";
import { Uint64 } from "../../go/sync/atomic.js";
import type { CompilerOptions, ModuleKind, ResolutionMode } from "../core/compileroptions.js";
import { TextRange_End, TextRange_Pos } from "../core/text.js";
import type { TextRange } from "../core/text.js";
import type { Tristate } from "../core/tristate.js";
import type { Path as Path_73a9f36e } from "../tspath/path.js";
import type { HasFileName, Pragma, SourceFile, SourceFileMetaData, StringLiteralLike } from "./ast.js";
import {
  IsDeclarationNode,
  NodeFactory_UpdateArrowFunction,
  NodeFactory_UpdateClassDeclaration,
  NodeFactory_UpdateClassExpression,
  NodeFactory_UpdateConstructorDeclaration,
  NodeFactory_UpdateConstructorTypeNode,
  NodeFactory_UpdateEnumDeclaration,
  NodeFactory_UpdateExportAssignment,
  NodeFactory_UpdateExportDeclaration,
  NodeFactory_UpdateFunctionDeclaration,
  NodeFactory_UpdateFunctionExpression,
  NodeFactory_UpdateGetAccessorDeclaration,
  NodeFactory_UpdateImportDeclaration,
  NodeFactory_UpdateImportEqualsDeclaration,
  NodeFactory_UpdateIndexSignatureDeclaration,
  NodeFactory_UpdateInterfaceDeclaration,
  NodeFactory_UpdateMethodDeclaration,
  NodeFactory_UpdateMethodSignatureDeclaration,
  NodeFactory_UpdateModuleDeclaration,
  NodeFactory_UpdateParameterDeclaration,
  NodeFactory_UpdatePropertyDeclaration,
  NodeFactory_UpdatePropertySignatureDeclaration,
  NodeFactory_UpdateSetAccessorDeclaration,
  NodeFactory_UpdateTypeAliasDeclaration,
  NodeFactory_UpdateTypeParameterDeclaration,
  NodeFactory_UpdateVariableStatement,
  Node_Expression,
  Node_Initializer,
  Node_ModifierFlags,
  Node_PropertyName,
  Node_QuestionDotToken,
  Node_Statement,
  Node_Text,
  Node_Type,
} from "./ast.js";
import type { ModifierList, Node, NodeList, Visitor } from "./spine.js";
import {
  Node_End,
  Node_LocalsContainerData,
  Node_Name,
  Node_Pos,
} from "./spine.js";
import type { AccessorDeclaration, BinaryExpression, ClassElement, ClassLikeDeclaration, Expression, ExpressionWithTypeArgumentsNode, GetAccessorDeclaration, JsxChild, LiteralLikeNode, NodeFactory, ParameterDeclarationNode, SetAccessorDeclaration, Statement, TokenNode, TypeNode } from "./generated/index.js";
import {
  AsArrayTypeNode,
  AsArrowFunction,
  AsBinaryExpression,
  AsBindingElement,
  AsCallExpression,
  AsClassDeclaration,
  AsClassExpression,
  AsConstructorDeclaration,
  AsConstructorTypeNode,
  AsElementAccessExpression,
  AsEnumDeclaration,
  AsExportAssignment,
  AsExportDeclaration,
  AsFunctionDeclaration,
  AsFunctionExpression,
  AsForInOrOfStatement,
  AsForStatement,
  AsGetAccessorDeclaration,
  AsHeritageClause,
  AsImportClause,
  AsImportDeclaration,
  AsImportEqualsDeclaration,
  AsIndexSignatureDeclaration,
  AsImportTypeNode,
  AsInterfaceDeclaration,
  AsJSDoc,
  AsJsxNamespacedName,
  AsJsxText,
  AsLiteralTypeNode,
  AsMetaProperty,
  AsMethodDeclaration,
  AsMethodSignatureDeclaration,
  AsModuleDeclaration,
  AsParameterDeclaration,
  AsPostfixUnaryExpression,
  AsPrefixUnaryExpression,
  AsPropertyDeclaration,
  AsPropertyAccessExpression,
  AsPropertySignatureDeclaration,
  AsQualifiedName,
  AsSetAccessorDeclaration,
  AsShorthandPropertyAssignment,
  AsTaggedTemplateExpression,
  AsTypeAliasDeclaration,
  AsTypeParameterDeclaration,
  AsTypeReferenceNode,
  AsVariableDeclarationList,
  AsVariableStatement,
} from "./generated/casts.js";
import {
  NodeFlagsAmbient,
  NodeFlagsAwaitUsing,
  NodeFlagsBlockScoped,
  NodeFlagsConst,
  NodeFlagsContainsThis,
  NodeFlagsJSDoc,
  NodeFlagsJavaScriptFile,
  NodeFlagsJsonFile,
  NodeFlagsLet,
  NodeFlagsOptionalChain,
  NodeFlagsPossiblyContainsDeprecatedTag,
  NodeFlagsReparsed,
  NodeFlagsSynthesized,
  NodeFlagsUsing,
  SymbolFlagsAlias,
  SymbolFlagsAssignment,
} from "./generated/flags.js";
import type { Kind } from "./generated/kinds.js";
import {
  KindAmpersandAmpersandToken,
  KindAnyKeyword,
  KindArrayBindingPattern,
  KindArrayLiteralExpression,
  KindArrowFunction,
  KindAsExpression,
  KindAwaitExpression,
  KindBarBarToken,
  KindBigIntKeyword,
  KindBigIntLiteral,
  KindBooleanKeyword,
  KindBindingElement,
  KindBinaryExpression,
  KindBlock,
  KindBreakStatement,
  KindCallExpression,
  KindCallSignature,
  KindCatchClause,
  KindClassDeclaration,
  KindClassExpression,
  KindClassStaticBlockDeclaration,
  KindCommaToken,
  KindComputedPropertyName,
  KindConditionalExpression,
  KindConstructor,
  KindConstructorType,
  KindConstructSignature,
  KindContinueStatement,
  KindDebuggerStatement,
  KindDeleteExpression,
  KindDoStatement,
  KindElementAccessExpression,
  KindEmptyStatement,
  KindEndOfFile,
  KindEnumDeclaration,
  KindEnumMember,
  KindEqualsToken,
  KindExclamationToken,
  KindExportAssignment,
  KindExportDeclaration,
  KindExpressionStatement,
  KindExpressionWithTypeArguments,
  KindExportSpecifier,
  KindFalseKeyword,
  KindFirstCompoundAssignment,
  KindFirstContextualKeyword,
  KindFirstJSDocNode,
  KindFirstKeyword,
  KindFirstTemplateToken,
  KindFirstTriviaToken,
  KindFirstTypeNode,
  KindForInStatement,
  KindForOfStatement,
  KindForStatement,
  KindFunctionDeclaration,
  KindFunctionExpression,
  KindFunctionType,
  KindGetAccessor,
  KindIdentifier,
  KindIfStatement,
  KindImportDeclaration,
  KindImportEqualsDeclaration,
  KindImportKeyword,
  KindIndexSignature,
  KindInterfaceDeclaration,
  KindImportSpecifier,
  KindJSDocSignature,
  KindIntrinsicKeyword,
  KindJSDocAllType,
  KindJSDocNonNullableType,
  KindJSDocNullableType,
  KindJSDocOptionalType,
  KindJSDocVariadicType,
  KindJSImportDeclaration,
  KindJSTypeAliasDeclaration,
  KindJsxExpression,
  KindJsxText,
  KindLastContextualKeyword,
  KindLastJSDocNode,
  KindLastKeyword,
  KindLastTemplateToken,
  KindLastTriviaToken,
  KindLastTypeNode,
  KindJsxAttribute,
  KindJsxClosingElement,
  KindJsxElement,
  KindJsxFragment,
  KindJsxOpeningElement,
  KindJsxSelfClosingElement,
  KindLabeledStatement,
  KindLastCompoundAssignment,
  KindTypeReference,
  KindMetaProperty,
  KindMethodDeclaration,
  KindMethodSignature,
  KindMinusMinusToken,
  KindMinusToken,
  KindMissingDeclaration,
  KindModuleDeclaration,
  KindNamespaceExportDeclaration,
  KindNeverKeyword,
  KindNewExpression,
  KindNonNullExpression,
  KindNoSubstitutionTemplateLiteral,
  KindNotEmittedStatement,
  KindNotEmittedTypeElement,
  KindNullKeyword,
  KindNumberKeyword,
  KindNumericLiteral,
  KindObjectKeyword,
  KindObjectBindingPattern,
  KindObjectLiteralExpression,
  KindOmittedExpression,
  KindAccessorKeyword,
  KindOverrideKeyword,
  KindParameter,
  KindStaticKeyword,
  KindTypeParameter,
  KindParenthesizedExpression,
  KindParenthesizedType,
  KindPartiallyEmittedExpression,
  KindPlusPlusToken,
  KindPlusToken,
  KindPostfixUnaryExpression,
  KindPrefixUnaryExpression,
  KindPrivateIdentifier,
  KindPropertyAccessExpression,
  KindPropertyAssignment,
  KindPropertyDeclaration,
  KindPropertySignature,
  KindQualifiedName,
  KindQuestionQuestionToken,
  KindRegularExpressionLiteral,
  KindReturnStatement,
  KindSatisfiesExpression,
  KindSemicolonClassElement,
  KindSetAccessor,
  KindShorthandPropertyAssignment,
  KindSpreadAssignment,
  KindSpreadElement,
  KindStringKeyword,
  KindStringLiteral,
  KindSuperKeyword,
  KindSwitchStatement,
  KindSymbolKeyword,
  KindTaggedTemplateExpression,
  KindTemplateExpression,
  KindThisKeyword,
  KindThrowStatement,
  KindTrueKeyword,
  KindTryStatement,
  KindTypeAliasDeclaration,
  KindTypeAssertionExpression,
  KindTypeOfExpression,
  KindUndefinedKeyword,
  KindUnknownKeyword,
  KindVariableDeclaration,
  KindVariableDeclarationList,
  KindVariableStatement,
  KindVoidExpression,
  KindVoidKeyword,
  KindWhileStatement,
  KindWithStatement,
  KindYieldExpression,
  KindAbstractKeyword,
  KindArrayType,
  KindAsyncKeyword,
  KindCaseBlock,
  KindCaseClause,
  KindConstKeyword,
  KindDeclareKeyword,
  KindDecorator,
  KindDefaultClause,
  KindDefaultKeyword,
  KindExportKeyword,
  KindExtendsKeyword,
  KindExternalModuleReference,
  KindFirstJSDocTagNode,
  KindFirstNode,
  KindFirstStatement,
  KindGlobalKeyword,
  KindImplementsKeyword,
  KindImportClause,
  KindImportType,
  KindInKeyword,
  KindInferType,
  KindInstanceOfKeyword,
  KindJSDoc,
  KindJSDocAugmentsTag,
  KindJSDocCallbackTag,
  KindJSDocDeprecatedTag,
  KindJSDocImplementsTag,
  KindJSDocImportTag,
  KindJSDocLink,
  KindJSDocLinkCode,
  KindJSDocLinkPlain,
  KindJSDocOverloadTag,
  KindJSDocOverrideTag,
  KindJSDocParameterTag,
  KindJSDocPrivateTag,
  KindJSDocPropertyTag,
  KindJSDocProtectedTag,
  KindJSDocPublicTag,
  KindJSDocReadonlyTag,
  KindJSDocReturnTag,
  KindJSDocSatisfiesTag,
  KindJSDocSeeTag,
  KindJSDocTemplateTag,
  KindJSDocThisTag,
  KindJSDocThrowsTag,
  KindJSDocTypeExpression,
  KindJSDocTypeTag,
  KindJSDocTypedefTag,
  KindJSDocUnknownTag,
  KindJsxAttributes,
  KindJsxNamespacedName,
  KindJsxOpeningFragment,
  KindJsxSpreadAttribute,
  KindLastJSDocTagNode,
  KindLastStatement,
  KindLiteralType,
  KindMappedType,
  KindModuleBlock,
  KindNamedExports,
  KindNamedImports,
  KindNamedTupleMember,
  KindNamespaceExport,
  KindNamespaceImport,
  KindOptionalType,
  KindOutKeyword,
  KindPrivateKeyword,
  KindProtectedKeyword,
  KindPublicKeyword,
  KindQuestionToken,
  KindReadonlyKeyword,
  KindRestType,
  KindSourceFile,
  KindString,
  KindTemplateLiteralTypeSpan,
  KindTemplateSpan,
  KindTypeKeyword,
  KindTypeLiteral,
  KindTypeOperator,
  KindTypePredicate,
  KindTypeQuery,
} from "./generated/kinds.js";
import {
  IsArrayLiteralExpression,
  IsArrowFunction,
  IsAsExpression,
  IsAssignmentOperator,
  IsBigIntLiteral,
  IsBinaryExpression,
  IsBindingElement,
  IsBlock,
  IsCallExpression,
  IsClassDeclaration,
  IsClassExpression,
  IsClassStaticBlockDeclaration,
  IsComputedPropertyName,
  IsConstructorDeclaration,
  IsDecorator,
  IsElementAccessExpression,
  IsEnumDeclaration,
  IsExportAssignment,
  IsExportDeclaration,
  IsExportSpecifier,
  IsExpressionWithTypeArguments,
  IsFunctionDeclaration,
  IsFunctionExpression,
  IsHeritageClause,
  IsIdentifier,
  IsImportDeclaration,
  IsImportEqualsDeclaration,
  IsImportSpecifier,
  IsImportTypeNode,
  IsInterfaceDeclaration,
  IsJSDocAugmentsTag,
  IsJSDocDeprecatedTag,
  IsJSDocImplementsTag,
  IsJSDocNameReference,
  IsJSTypeAliasDeclaration,
  IsJsxAttribute,
  IsJsxOpeningElement,
  IsJsxSelfClosingElement,
  IsJsxSpreadAttribute,
  IsLabeledStatement,
  IsLiteralKind,
  IsLiteralTypeNode,
  IsLogicalOrCoalescingAssignmentOperator,
  IsMetaProperty,
  IsMethodDeclaration,
  IsModifierKind,
  IsModuleBlock,
  IsModuleDeclaration,
  IsNamespaceExport,
  IsNamespaceImport,
  IsNewExpression,
  IsNonNullExpression,
  IsNumericLiteral,
  IsObjectLiteralExpression,
  IsParameterDeclaration,
  IsParenthesizedExpression,
  IsParenthesizedTypeNode,
  IsPrivateIdentifier,
  IsPropertyAccessExpression,
  IsPropertyDeclaration,
  IsPropertySignatureDeclaration,
  IsQualifiedName,
  IsShorthandPropertyAssignment,
  IsSourceFile,
  IsSpreadElement,
  IsStringLiteral,
  IsTaggedTemplateExpression,
  IsTokenKind,
  IsTypeLiteralNode,
  IsTypeQueryNode,
  IsTypeReferenceNode,
  IsVariableStatement,
  IsVoidExpression,
} from "./generated/predicates.js";
import type { NodeId, SymbolId } from "./ids.js";
import {
  ModifierFlagsAbstract,
  ModifierFlagsAccessor,
  ModifierFlagsAmbient,
  ModifierFlagsAsync,
  ModifierFlagsConst,
  ModifierFlagsDecorator,
  ModifierFlagsDefault,
  ModifierFlagsExport,
  ModifierFlagsIn,
  ModifierFlagsOut,
  ModifierFlagsOverride,
  ModifierFlagsParameterPropertyModifier,
  ModifierFlagsPrivate,
  ModifierFlagsProtected,
  ModifierFlagsPublic,
  ModifierFlagsReadonly,
  ModifierFlagsStatic,
  ModifierToFlag,
} from "./modifierflags.js";
import type { ModifierFlags } from "./modifierflags.js";
import type { NodeFlags } from "./nodeflags.js";
import type { Symbol, SymbolTable } from "./symbol.js";
import {
  InternalSymbolNameDefault,
  InternalSymbolNameMissing,
} from "./symbol.js";
import type { SymbolFlags } from "./symbolflags.js";
import {
  SubtreeContainsESObjectRestOrSpread,
  SubtreeContainsObjectRestOrSpread,
} from "./subtreefacts.js";
import { TokenFlagsUnterminated } from "./tokenflags.js";
import { AsSourceFile, SourceFile_Text } from "./ast.js";
import {
  ImportAttributesNode_GetResolutionModeOverride,
  Node_Arguments,
  Node_Body,
  Node_CommentList,
  Node_Elements,
  Node_ImportClause,
  Node_IsTypeOnly,
  Node_JSDoc,
  Node_Label,
  Node_MemberList,
  Node_Members,
  Node_ModuleSpecifier,
  Node_ParameterList,
  Node_Parameters,
  Node_PostfixToken,
  Node_Properties,
  Node_PropertyNameOrName,
  Node_QuestionToken,
  Node_Statements,
  Node_TagName,
  Node_TypeArguments,
  Node_TypeParameterList,
  Node_TypeParameters,
} from "./ast.js";
import {
  Node_BodyData,
  Node_ForEachChild,
  Node_FunctionLikeData,
  Node_KindString,
  Node_LiteralLikeData,
  Node_SubtreeFacts,
  Node_TemplateLiteralLikeData,
  NodeDefault_AsNode,
  visitNodes,
} from "./spine.js";
import type { BodyBase as BodyBaseType, FunctionLikeBase as FunctionLikeBaseType } from "./generated/node.js";
import type { ImportAttributesNode } from "./generated/index.js";
import { TextRange_ContainedBy } from "../core/text.js";
import { ScriptKindJS, ScriptKindJSON, ScriptKindJSX } from "../core/scriptkind.js";
import {
  CompilerOptions_GetEmitModuleKind,
  JsxEmitReactJSX,
  JsxEmitReactJSXDev,
  ModuleKindCommonJS,
  ModuleKindES2015,
  ModuleKindESNext,
  ModuleKindNode16,
  ModuleKindNodeNext,
  ModuleKindNone,
  ModuleKindPreserve,
  ResolutionModeCommonJS,
  ResolutionModeESM,
  ResolutionModeNone,
} from "../core/compileroptions.js";
import { TSTrue, TSUnknown } from "../core/tristate.js";
import {
  ExtensionCjs,
  ExtensionCts,
  ExtensionDcts,
  ExtensionDmts,
  ExtensionDts,
  ExtensionJs,
  ExtensionJsx,
  ExtensionMjs,
  ExtensionMts,
  ExtensionTs,
  ExtensionTsx,
} from "../tspath/extension.js";
import { FileExtensionIsOneOf } from "../tspath/extension.js";
import {
  Every,
  Filter,
  Find,
  FirstOrNil,
  IfElse,
  Some,
} from "../core/core.js";
import { Assert, FailBadSyntaxKind } from "../debug/debug.js";
import { Pool as PoolValue } from "../../go/sync.js";

// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length,
// `s[i]` is a byte, and slices like `s[i:j]` operate on byte offsets. Source
// positions are byte offsets, so position-indexed reads of source text must go
// through the UTF-8 byte view rather than JS string indexing.
const utilUtf8Encoder: TextEncoder = new globalThis.TextEncoder();
const utilUtf8Decoder: TextDecoder = new globalThis.TextDecoder("utf-8");
type UtilUtf8ByteInfo = { ascii: bool; bytes: Uint8Array };
const utilUtf8ByteInfoCache = new globalThis.Map<string, UtilUtf8ByteInfo>();

const utilGetUtf8ByteInfo = (s: string): UtilUtf8ByteInfo => {
  const cached = utilUtf8ByteInfoCache.get(s);
  if (cached !== undefined) {
    return cached;
  }
  let ascii = true;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) >= 0x80) {
      ascii = false;
      break;
    }
  }
  const info: UtilUtf8ByteInfo = {
    ascii,
    bytes: ascii ? undefined as unknown as Uint8Array : utilUtf8Encoder.encode(s),
  };
  if (s.length >= 4096) {
    utilUtf8ByteInfoCache.set(s, info);
  }
  return info;
};

const utilByteLen = (s: string): int => {
  const info = utilGetUtf8ByteInfo(s);
  return info.ascii ? s.length : info.bytes.length;
};

const utilByteSlice = (s: string, start: int, end?: int): string => {
  const info = utilGetUtf8ByteInfo(s);
  return info.ascii ? s.slice(start, end) : utilUtf8Decoder.decode(info.bytes.subarray(start, end));
};

const utilByteAt = (s: string, i: int): int => {
  const info = utilGetUtf8ByteInfo(s);
  return info.ascii ? s.charCodeAt(i) : info.bytes[i]!;
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::varGroup::nextNodeId+nextSymbolId","kind":"varGroup","status":"implemented","sigHash":"023956e168736dc0e2e208f1009bb0207dce5c0c6e326fb624acc258ef9d4fd8","bodyHash":"bdf7525df846448041c907613da60444d42d43aa68effc987f7d071a0163c770"}
 *
 * Go source:
 * var (
 * 	nextNodeId   atomic.Uint64
 * 	nextSymbolId atomic.Uint64
 * )
 */
export const nextNodeId: Uint64 = new Uint64();
export const nextSymbolId: Uint64 = new Uint64();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetNodeId","kind":"func","status":"implemented","sigHash":"58bcc87f850cfc42a561e116eb0669459f0b60dfaeb2c779e28f2a06e2005d7a","bodyHash":"9075ab2290f73a01a27bb39d34c1bb7dca25dcc3845910c3e2dcf85217268716"}
 *
 * Go source:
 * func GetNodeId(node *Node) NodeId {
 * 	id := node.id.Load()
 * 	if id == 0 {
 * 		// Worst case, we burn a few ids if we have to CAS.
 * 		id = nextNodeId.Add(1)
 * 		if !node.id.CompareAndSwap(0, id) {
 * 			id = node.id.Load()
 * 		}
 * 	}
 * 	return NodeId(id)
 * }
 */
export function GetNodeId(node: GoPtr<Node>): NodeId {
  node!.id ??= new Uint64();
  const id0: ulong = node!.id.Load();
  if (id0 !== (0 as ulong)) return id0 as NodeId;
  // Worst case, we burn a few ids if we have to CAS.
  const attempted: ulong = nextNodeId.Add(1 as ulong);
  const id1: ulong = node!.id.CompareAndSwap(0 as ulong, attempted) ? attempted : node!.id.Load();
  return id1 as NodeId;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetSymbolId","kind":"func","status":"implemented","sigHash":"ae5950f796feca96e3340e148e31cc850a48cfdf943d6ed8a04558b1fe6b13a4","bodyHash":"8cf6f935bfe05c264cb2047742680a72654b7c2f15841d2cf1b3f13a91756093"}
 *
 * Go source:
 * func GetSymbolId(symbol *Symbol) SymbolId {
 * 	id := symbol.id.Load()
 * 	if id == 0 {
 * 		// Worst case, we burn a few ids if we have to CAS.
 * 		id = nextSymbolId.Add(1)
 * 		if !symbol.id.CompareAndSwap(0, id) {
 * 			id = symbol.id.Load()
 * 		}
 * 	}
 * 	return SymbolId(id)
 * }
 */
export function GetSymbolId(symbol_: GoPtr<Symbol>): SymbolId {
  symbol_!.id ??= new Uint64();
  const id0: ulong = symbol_!.id.Load();
  if (id0 !== (0 as ulong)) return id0 as SymbolId;
  // Worst case, we burn a few ids if we have to CAS.
  const attempted: ulong = nextSymbolId.Add(1 as ulong);
  const id1: ulong = symbol_!.id.CompareAndSwap(0 as ulong, attempted) ? attempted : symbol_!.id.Load();
  return id1 as SymbolId;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetSymbolTable","kind":"func","status":"implemented","sigHash":"ecf0f51324cec402d67481361d90847014aa898b6ed40cbee4bf7b9f629c1b59","bodyHash":"3f5bb32631df999e48ff71408b4f65817b3cab476e254d6706372b38eb8c785e"}
 *
 * Go source:
 * func GetSymbolTable(data *SymbolTable) SymbolTable {
 * 	if *data == nil {
 * 		*data = make(SymbolTable)
 * 	}
 * 	return *data
 * }
 */
export function GetSymbolTable(data: GoPtr<SymbolTable>): SymbolTable {
  if (data === undefined) {
    return new Map();
  }
  return data;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetMembers","kind":"func","status":"implemented","sigHash":"8f3637cc4020e55a9148ce2b77216972793357bd7e9682b19909ea43a626b5c5","bodyHash":"ff8ea87d4f028f59e360a0652089f322c84842f9d1210fb7b50b4d4439fa133f"}
 *
 * Go source:
 * func GetMembers(symbol *Symbol) SymbolTable {
 * 	return GetSymbolTable(&symbol.Members)
 * }
 */
export function GetMembers(symbol_: GoPtr<Symbol>): SymbolTable {
  if (symbol_!.Members === undefined) {
    symbol_!.Members = new Map();
  }
  return symbol_!.Members;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetExports","kind":"func","status":"implemented","sigHash":"e56df39356850158fd9544c92b42b96b609788dac8b97c097b56f674ae6db936","bodyHash":"0d8deea1f518604041b2051f3370c979b44b52df749f9e0fabc378ea52ad2d0d"}
 *
 * Go source:
 * func GetExports(symbol *Symbol) SymbolTable {
 * 	return GetSymbolTable(&symbol.Exports)
 * }
 */
export function GetExports(symbol_: GoPtr<Symbol>): SymbolTable {
  if (symbol_!.Exports === undefined) {
    symbol_!.Exports = new Map();
  }
  return symbol_!.Exports;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetLocals","kind":"func","status":"implemented","sigHash":"e6d3b1bdc67fae52e261db8f8fb6e87718e443f4cf9557108dd0616914cfd963","bodyHash":"e858c44b5f9bb737668aea577c45529cbd58427fcb6fec8c0d4e0803d245e15f"}
 *
 * Go source:
 * func GetLocals(container *Node) SymbolTable {
 * 	return GetSymbolTable(&container.LocalsContainerData().Locals)
 * }
 */
export function GetLocals(container: GoPtr<Node>): SymbolTable {
  const data = Node_LocalsContainerData(container);
  const holder = data as unknown as { Locals?: SymbolTable };
  if (holder.Locals === undefined) {
    holder.Locals = new Map();
  }
  return holder.Locals;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::NodeIsMissing","kind":"func","status":"implemented","sigHash":"5894d2949936c7687648d02f3f6dda475417773e75ddde1c96b71eefacc27845","bodyHash":"39993d777c1fb3cd8d239952ef805156c5806fc8ef1ac4453bf28d409146875d"}
 *
 * Go source:
 * func NodeIsMissing(node *Node) bool {
 * 	return node == nil || node.Loc.Pos() == node.Loc.End() && node.Loc.Pos() >= 0 && node.Kind != KindEndOfFile
 * }
 */
export function NodeIsMissing(node: GoPtr<Node>): bool {
  return (node === undefined ||
    (Node_Pos(node) === Node_End(node) && Node_Pos(node) >= 0 && node!.Kind !== KindEndOfFile)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::NodeIsPresent","kind":"func","status":"implemented","sigHash":"3aee77a61f1fa04d80d1e8320bb73ce4fefb60b05202c6d53b091e5a9994c2c2","bodyHash":"e33c3e6ec3ca97720885346bc439c56ac3a80eb84bcf6af6a9961473f1a18d88"}
 *
 * Go source:
 * func NodeIsPresent(node *Node) bool {
 * 	return !NodeIsMissing(node)
 * }
 */
export function NodeIsPresent(node: GoPtr<Node>): bool {
  return !NodeIsMissing(node) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::NodeIsSynthesized","kind":"func","status":"implemented","sigHash":"a9332b999d48ca8795cfd3ffbd16da50942b8f600898462cbe9a5a1dd1ee4a10","bodyHash":"472cb799f6d905bede4f1d1dd6152b0d3e6520af7542e97f5f5a6b7fd6722332"}
 *
 * Go source:
 * func NodeIsSynthesized(node *Node) bool {
 * 	return PositionIsSynthesized(node.Loc.Pos()) || PositionIsSynthesized(node.Loc.End())
 * }
 */
export function NodeIsSynthesized(node: GoPtr<Node>): bool {
  return (PositionIsSynthesized(Node_Pos(node)) || PositionIsSynthesized(Node_End(node))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::RangeIsSynthesized","kind":"func","status":"implemented","sigHash":"6b4df3d312b02d80b19e7904d29bfb97b03ca643eb4c0a4c9610cd56bb26ffa1","bodyHash":"4f2caaeb465689407f60eeae4d4080f994ba80f328a1b3927b47fddfa87eca0a"}
 *
 * Go source:
 * func RangeIsSynthesized(loc core.TextRange) bool {
 * 	return PositionIsSynthesized(loc.Pos()) || PositionIsSynthesized(loc.End())
 * }
 */
export function RangeIsSynthesized(loc: TextRange): bool {
  return (PositionIsSynthesized(TextRange_Pos(loc)) || PositionIsSynthesized(TextRange_End(loc))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::PositionIsSynthesized","kind":"func","status":"implemented","sigHash":"bb20abd33c3cfd69120a608ff90fee4ba3dab70c254f003ce0868341ed7b2056","bodyHash":"510af54b522f5a01ed4c2da03c75c872a9cd124529e7cfe94774c189b4a7b759"}
 *
 * Go source:
 * func PositionIsSynthesized(pos int) bool {
 * 	return pos < 0
 * }
 */
export function PositionIsSynthesized(pos: int): bool {
  return (pos < 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::FindLastVisibleNode","kind":"func","status":"implemented","sigHash":"2dc45a8fae442a8077823fcab728460b8777627caf8a55574fda0a437a189174","bodyHash":"7fdf96a7a0046f475cca6e8bcb0b9342fa65b39bf98bec389e3af0b1871735fb"}
 *
 * Go source:
 * func FindLastVisibleNode(nodes []*Node) *Node {
 * 	fromEnd := 1
 * 	for fromEnd <= len(nodes) && nodes[len(nodes)-fromEnd].Flags&NodeFlagsReparsed != 0 {
 * 		fromEnd++
 * 	}
 * 	if fromEnd <= len(nodes) {
 * 		return nodes[len(nodes)-fromEnd]
 * 	}
 * 	return nil
 * }
 */
export function FindLastVisibleNode(nodes: GoSlice<GoPtr<Node>>): GoPtr<Node> {
  const loop = (fromEnd: int): GoPtr<Node> => {
    if (fromEnd > nodes.length) return undefined;
    if ((nodes[nodes.length - fromEnd]!.Flags & NodeFlagsReparsed) === 0) return nodes[nodes.length - fromEnd];
    return loop((fromEnd + 1) as int);
  };
  return loop(1 as int);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::NodeKindIs","kind":"func","status":"implemented","sigHash":"7ec8613b75bda45cac32bcfda9af826bd45783ff51d506ed4b37a8c3a1297080","bodyHash":"a2c8021b32cf139b660a83635e5faf99244a6f5c288b87eb0abd8aaee7b95f4e"}
 *
 * Go source:
 * func NodeKindIs(node *Node, kinds ...Kind) bool {
 * 	return slices.Contains(kinds, node.Kind)
 * }
 */
export function NodeKindIs(node: GoPtr<Node>, ...kinds: Array<Kind>): bool {
  return slices.Contains(kinds, node!.Kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsModifier","kind":"func","status":"implemented","sigHash":"abc5a2ba3d442abfe1ee1f43ee8e451c34935aef74e7a39249208617312b5aee","bodyHash":"1ddd9cf07c01f534c8ed0c61fe3de0e832b45f56b93e50a0d3131de60fe9a2c3"}
 *
 * Go source:
 * func IsModifier(node *Node) bool {
 * 	return IsModifierKind(node.Kind)
 * }
 */
export function IsModifier(node: GoPtr<Node>): bool {
  return IsModifierKind(node!.Kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsModifierLike","kind":"func","status":"implemented","sigHash":"2a2ff32797822c1dd4de3b77964d8dba2bd72884fbaf823b3c6b9e563a05e075","bodyHash":"c5bfe2605e78f2bc260516379ee30f7d55837fe4245419d01c0fa1b55a6c7ce8"}
 *
 * Go source:
 * func IsModifierLike(node *Node) bool {
 * 	return IsModifier(node) || IsDecorator(node)
 * }
 */
export function IsModifierLike(node: GoPtr<Node>): bool {
  return (IsModifier(node) || IsDecorator(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsCompoundAssignment","kind":"func","status":"implemented","sigHash":"5e595f7a974e3ee8ef1193b855e8c5d0eb95786cd328ef10ce47d465f01e0f0e","bodyHash":"9e7c52798b16e03a54eea9f09d52e3df09a1019da68b8003eeb5eccc333949b2"}
 *
 * Go source:
 * func IsCompoundAssignment(token Kind) bool {
 * 	return token >= KindFirstCompoundAssignment && token <= KindLastCompoundAssignment
 * }
 */
export function IsCompoundAssignment(token: Kind): bool {
  return (token >= KindFirstCompoundAssignment && token <= KindLastCompoundAssignment) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsAssignmentExpression","kind":"func","status":"implemented","sigHash":"4dae478ef3ac6313769677c4e3ecfb145be8f91740df63928e420e05d5f9c1b5","bodyHash":"2ae73bfb85c5ff6363157f81a7ad1629daca169fa8e1fb2637da10d68200942e"}
 *
 * Go source:
 * func IsAssignmentExpression(node *Node, excludeCompoundAssignment bool) bool {
 * 	if node.Kind == KindBinaryExpression {
 * 		expr := node.AsBinaryExpression()
 * 		return (expr.OperatorToken.Kind == KindEqualsToken || !excludeCompoundAssignment && IsAssignmentOperator(expr.OperatorToken.Kind)) &&
 * 			IsLeftHandSideExpression(expr.Left)
 * 	}
 * 	return false
 * }
 */
export function IsAssignmentExpression(node: GoPtr<Node>, excludeCompoundAssignment: bool): bool {
  if (node!.Kind === KindBinaryExpression) {
    const expr = AsBinaryExpression(node);
    return ((expr!.OperatorToken!.Kind === KindEqualsToken ||
      (!excludeCompoundAssignment && IsAssignmentOperator(expr!.OperatorToken!.Kind))) &&
      IsLeftHandSideExpression(expr!.Left)) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetRightMostAssignedExpression","kind":"func","status":"implemented","sigHash":"2cd5307817cc50f77fac100d0f7f70a52716005cead749f932b16113f0d26c15","bodyHash":"782149ca40358ef6f22f220c9736113b4d80a8161ab9461e6a2b76d02b8672fc"}
 *
 * Go source:
 * func GetRightMostAssignedExpression(node *Node) *Node {
 * 	for IsAssignmentExpression(node, false /*excludeCompoundAssignment* /) {
 * 		node = node.AsBinaryExpression().Right
 * 	}
 * 	return node
 * }
 */
export function GetRightMostAssignedExpression(node: GoPtr<Node>): GoPtr<Node> {
  const loop = (current: GoPtr<Node>): GoPtr<Node> => {
    if (!IsAssignmentExpression(current, false /*excludeCompoundAssignment*/)) return current;
    return loop(AsBinaryExpression(current)!.Right);
  };
  return loop(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsDestructuringAssignment","kind":"func","status":"implemented","sigHash":"1bb1dbfb1aab8203b57653338e8ecf3f7b0165ca2e605d0260d3f5e86ba673f7","bodyHash":"21a6163966ceba2a6cd32d6936166d4248bff5cdf9e74f2062d12f0274ddaeef"}
 *
 * Go source:
 * func IsDestructuringAssignment(node *Node) bool {
 * 	if IsAssignmentExpression(node, true /*excludeCompoundAssignment* /) {
 * 		kind := node.AsBinaryExpression().Left.Kind
 * 		return kind == KindObjectLiteralExpression || kind == KindArrayLiteralExpression
 * 	}
 * 	return false
 * }
 */
export function IsDestructuringAssignment(node: GoPtr<Node>): bool {
  if (IsAssignmentExpression(node, true /*excludeCompoundAssignment*/)) {
    const kind = AsBinaryExpression(node)!.Left!.Kind;
    return (kind === KindObjectLiteralExpression || kind === KindArrayLiteralExpression) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsObjectBindingOrAssignmentElement","kind":"func","status":"implemented","sigHash":"27ee69cd9c5dea53e6303884b55bd3b5c54441be78a9072b38f41d51f3f1a159","bodyHash":"4d0ba3f5217a702ba5f94dcadf28d9b1799b3c29a1ab03973cac7afa889f26bf"}
 *
 * Go source:
 * func IsObjectBindingOrAssignmentElement(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindBindingElement,
 * 		KindPropertyAssignment,
 * 		KindShorthandPropertyAssignment,
 * 		KindSpreadAssignment:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsObjectBindingOrAssignmentElement(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindBindingElement:
    case KindPropertyAssignment:
    case KindShorthandPropertyAssignment:
    case KindSpreadAssignment:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsArrayBindingOrAssignmentElement","kind":"func","status":"implemented","sigHash":"e5737fe235af284ca78d798d9940cc827303d55ef67a987a64ac67098ee7e6e3","bodyHash":"267951e0b62d37f304f567cefe901e68b764bdfdf6561b26e0b8e609451ab913"}
 *
 * Go source:
 * func IsArrayBindingOrAssignmentElement(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindBindingElement,
 * 		KindOmittedExpression,
 * 		KindSpreadElement,
 * 		KindArrayLiteralExpression,
 * 		KindObjectLiteralExpression,
 * 		KindIdentifier,
 * 		KindPropertyAccessExpression,
 * 		KindElementAccessExpression:
 * 		return true
 * 	}
 * 	return IsAssignmentExpression(node, true /*excludeCompoundAssignment* /)
 * }
 */
export function IsArrayBindingOrAssignmentElement(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindBindingElement:
    case KindOmittedExpression:
    case KindSpreadElement:
    case KindArrayLiteralExpression:
    case KindObjectLiteralExpression:
    case KindIdentifier:
    case KindPropertyAccessExpression:
    case KindElementAccessExpression:
      return true as bool;
  }
  return IsAssignmentExpression(node, true /*excludeCompoundAssignment*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsBindingPattern","kind":"func","status":"implemented","sigHash":"bbd2fbb87d81dc15d2b21a8110c4bab96b42558f71697d3f949aaa24cd823a3f","bodyHash":"a28f092db242f0841e7ddef1756bd3e734b4c63d2a2e6786f3872edc6a5c35f9"}
 *
 * Go source:
 * func IsBindingPattern(node *Node) bool {
 * 	return node.Kind == KindObjectBindingPattern || node.Kind == KindArrayBindingPattern
 * }
 */
export function IsBindingPattern(node: GoPtr<Node>): bool {
  return (node!.Kind === KindObjectBindingPattern || node!.Kind === KindArrayBindingPattern) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsForInOrOfStatement","kind":"func","status":"implemented","sigHash":"e480606d4cf62bf2a9bf1bec9bcc9181fab59733aa38bc47fcb81c41dedfb8d0","bodyHash":"bbe2a9cdf93428489941586b52682080fea2d83f21b4dd2494acc19af44166a9"}
 *
 * Go source:
 * func IsForInOrOfStatement(node *Node) bool {
 * 	return node != nil && (node.Kind == KindForInStatement || node.Kind == KindForOfStatement)
 * }
 */
export function IsForInOrOfStatement(node: GoPtr<Node>): bool {
  return (node !== undefined &&
    (node!.Kind === KindForInStatement || node!.Kind === KindForOfStatement)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsAssignmentTarget","kind":"func","status":"implemented","sigHash":"e111675a61da79a53e48cdd6f62e6264b9d2fbdeacd44f44b17322f43b90fb5d","bodyHash":"dfc0ca6d7b1c30b29c0c8b5844b95afef996614da11643d136fdc890d791166a"}
 *
 * Go source:
 * func IsAssignmentTarget(node *Node) bool {
 * 	return GetAssignmentTarget(node) != nil
 * }
 */
export function IsAssignmentTarget(node: GoPtr<Node>): bool {
  return (GetAssignmentTarget(node) !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetAssignmentTarget","kind":"func","status":"implemented","sigHash":"dddcad230584070f0fd139de20fbdf29887aed0d986bf0d4ab898e78a25cd1e6","bodyHash":"7195304f9c20316fae191d2b504919f7a37c3fefa0320f3207b81bccd2572c47"}
 *
 * Go source:
 * func GetAssignmentTarget(node *Node) *Node {
 * 	for {
 * 		parent := node.Parent
 * 		switch parent.Kind {
 * 		case KindBinaryExpression:
 * 			if IsAssignmentOperator(parent.AsBinaryExpression().OperatorToken.Kind) && parent.AsBinaryExpression().Left == node {
 * 				return parent
 * 			}
 * 			return nil
 * 		case KindPrefixUnaryExpression:
 * 			if parent.AsPrefixUnaryExpression().Operator == KindPlusPlusToken || parent.AsPrefixUnaryExpression().Operator == KindMinusMinusToken {
 * 				return parent
 * 			}
 * 			return nil
 * 		case KindPostfixUnaryExpression:
 * 			if parent.AsPostfixUnaryExpression().Operator == KindPlusPlusToken || parent.AsPostfixUnaryExpression().Operator == KindMinusMinusToken {
 * 				return parent
 * 			}
 * 			return nil
 * 		case KindForInStatement, KindForOfStatement:
 * 			if parent.Initializer() == node {
 * 				return parent
 * 			}
 * 			return nil
 * 		case KindParenthesizedExpression, KindArrayLiteralExpression, KindSpreadElement, KindNonNullExpression:
 * 			node = parent
 * 		case KindSpreadAssignment:
 * 			node = parent.Parent
 * 		case KindShorthandPropertyAssignment:
 * 			if parent.AsShorthandPropertyAssignment().Name() != node {
 * 				return nil
 * 			}
 * 			node = parent.Parent
 * 		case KindPropertyAssignment:
 * 			if parent.AsPropertyAssignment().Name() == node {
 * 				return nil
 * 			}
 * 			node = parent.Parent
 * 		default:
 * 			return nil
 * 		}
 * 	}
 * }
 */
export function GetAssignmentTarget(node: GoPtr<Node>): GoPtr<Node> {
  const loop = (current: GoPtr<Node>): GoPtr<Node> => {
    const parent = current!.Parent;
    switch (parent!.Kind) {
      case KindBinaryExpression:
        if (IsAssignmentOperator(AsBinaryExpression(parent)!.OperatorToken!.Kind) &&
          AsBinaryExpression(parent)!.Left === current) return parent;
        return undefined;
      case KindPrefixUnaryExpression:
        if (AsPrefixUnaryExpression(parent)!.Operator === KindPlusPlusToken ||
          AsPrefixUnaryExpression(parent)!.Operator === KindMinusMinusToken) return parent;
        return undefined;
      case KindPostfixUnaryExpression:
        if (AsPostfixUnaryExpression(parent)!.Operator === KindPlusPlusToken ||
          AsPostfixUnaryExpression(parent)!.Operator === KindMinusMinusToken) return parent;
        return undefined;
      case KindForInStatement:
      case KindForOfStatement:
        if (Node_Initializer(parent) === current) return parent;
        return undefined;
      case KindParenthesizedExpression:
      case KindArrayLiteralExpression:
      case KindSpreadElement:
      case KindNonNullExpression:
        return loop(parent);
      case KindSpreadAssignment:
        return loop(parent!.Parent);
      case KindShorthandPropertyAssignment:
        if (Node_Name(parent) !== current) return undefined;
        return loop(parent!.Parent);
      case KindPropertyAssignment:
        if (Node_Name(parent) === current) return undefined;
        return loop(parent!.Parent);
      default:
        return undefined;
    }
  };
  return loop(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsLogicalBinaryOperator","kind":"func","status":"implemented","sigHash":"6d9edaa96aeaef4182e162b5f7c6fdd30c8c580a0170629d0e9d42587629e2eb","bodyHash":"9a5fb26a8f0f1e5a0040c73126323b44a7758d71d7f07c034320ce35a155558a"}
 *
 * Go source:
 * func IsLogicalBinaryOperator(token Kind) bool {
 * 	return token == KindBarBarToken || token == KindAmpersandAmpersandToken
 * }
 */
export function IsLogicalBinaryOperator(token: Kind): bool {
  return (token === KindBarBarToken || token === KindAmpersandAmpersandToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsLogicalOrCoalescingBinaryOperator","kind":"func","status":"implemented","sigHash":"bcc7d0000682b3b772bef3ee7ef38ab2e6162d0530043f70069a67ea0d0568cd","bodyHash":"7e0a51029d59c6563fd4ca6db75d93a5bf05e6c5b023ca4b081b7f13e769d6b8"}
 *
 * Go source:
 * func IsLogicalOrCoalescingBinaryOperator(token Kind) bool {
 * 	return IsLogicalBinaryOperator(token) || token == KindQuestionQuestionToken
 * }
 */
export function IsLogicalOrCoalescingBinaryOperator(token: Kind): bool {
  return (IsLogicalBinaryOperator(token) || token === KindQuestionQuestionToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsLogicalOrCoalescingBinaryExpression","kind":"func","status":"implemented","sigHash":"bdace5ac684eec2aeefabdb8ea04365f1e8aeb705d9b28e344b5e1c63704d150","bodyHash":"d15dd06333e4638dbe1ed71172b5781b4f70d153d1be362db8d0451f48ef11f1"}
 *
 * Go source:
 * func IsLogicalOrCoalescingBinaryExpression(expr *Node) bool {
 * 	return IsBinaryExpression(expr) && IsLogicalOrCoalescingBinaryOperator(expr.AsBinaryExpression().OperatorToken.Kind)
 * }
 */
export function IsLogicalOrCoalescingBinaryExpression(expr: GoPtr<Node>): bool {
  return (IsBinaryExpression(expr) &&
    IsLogicalOrCoalescingBinaryOperator(AsBinaryExpression(expr)!.OperatorToken!.Kind)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsLogicalOrCoalescingAssignmentExpression","kind":"func","status":"implemented","sigHash":"e14fb9a35d7186bac95bd403b1c5f3e83fdd271cd0d4a5db0603f8e0ea74c96d","bodyHash":"445c764b1f073e4428e98dc691d27d8a5a9649ca9acfbc5fb211b5c6fce0ff27"}
 *
 * Go source:
 * func IsLogicalOrCoalescingAssignmentExpression(expr *Node) bool {
 * 	return IsBinaryExpression(expr) && IsLogicalOrCoalescingAssignmentOperator(expr.AsBinaryExpression().OperatorToken.Kind)
 * }
 */
export function IsLogicalOrCoalescingAssignmentExpression(expr: GoPtr<Node>): bool {
  return (IsBinaryExpression(expr) &&
    IsLogicalOrCoalescingAssignmentOperator(AsBinaryExpression(expr)!.OperatorToken!.Kind)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsLogicalExpression","kind":"func","status":"implemented","sigHash":"be90776513149edd4b0760f36d1dbd7f86b111fa8f0f4d8fc66e4fda57203aaf","bodyHash":"ad2ee256075dd6db936995d0b00cbe94817062c6c30d1a8cbd77089127b513d4"}
 *
 * Go source:
 * func IsLogicalExpression(node *Node) bool {
 * 	for {
 * 		if node.Kind == KindParenthesizedExpression {
 * 			node = node.Expression()
 * 		} else if node.Kind == KindPrefixUnaryExpression && node.AsPrefixUnaryExpression().Operator == KindExclamationToken {
 * 			node = node.AsPrefixUnaryExpression().Operand
 * 		} else {
 * 			return IsLogicalOrCoalescingBinaryExpression(node)
 * 		}
 * 	}
 * }
 */
export function IsLogicalExpression(node: GoPtr<Node>): bool {
  const loop = (current: GoPtr<Node>): bool => {
    if (current!.Kind === KindParenthesizedExpression) return loop(Node_Expression(current));
    if (current!.Kind === KindPrefixUnaryExpression &&
      AsPrefixUnaryExpression(current)!.Operator === KindExclamationToken) {
      return loop(AsPrefixUnaryExpression(current)!.Operand);
    }
    return IsLogicalOrCoalescingBinaryExpression(current);
  };
  return loop(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsAccessor","kind":"func","status":"implemented","sigHash":"b56e229b288396f7e55b9e2fbb2c88ccd1bdace242c7d70d41d4c71347a07024","bodyHash":"c39029e483433765cb3fe5dadf0cab229e505c97775533aaeb077bd8c521d331"}
 *
 * Go source:
 * func IsAccessor(node *Node) bool {
 * 	return node.Kind == KindGetAccessor || node.Kind == KindSetAccessor
 * }
 */
export function IsAccessor(node: GoPtr<Node>): bool {
  return (node!.Kind === KindGetAccessor || node!.Kind === KindSetAccessor) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPropertyNameLiteral","kind":"func","status":"implemented","sigHash":"808c2e203cd069236086fdfba5fa745699fa5a9b7b0d49b8c25ac58569f8b0f5","bodyHash":"10813620d6917ebf7546b16de8c9ef756c16da671d6e2c5bfd435116ec641aa9"}
 *
 * Go source:
 * func IsPropertyNameLiteral(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindIdentifier,
 * 		KindStringLiteral,
 * 		KindNoSubstitutionTemplateLiteral,
 * 		KindNumericLiteral:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsPropertyNameLiteral(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindIdentifier:
    case KindStringLiteral:
    case KindNoSubstitutionTemplateLiteral:
    case KindNumericLiteral:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsMemberName","kind":"func","status":"implemented","sigHash":"babb2cbd9b39311792f1c7eebef54f0b4b6749537ccedd926662c00ba451d1dd","bodyHash":"e3a56344d7b2559d3bace660306bc7fd5471a0913fcf9009fd32a2b358cc7c84"}
 *
 * Go source:
 * func IsMemberName(node *Node) bool {
 * 	return node.Kind == KindIdentifier || node.Kind == KindPrivateIdentifier
 * }
 */
export function IsMemberName(node: GoPtr<Node>): bool {
  return (node!.Kind === KindIdentifier || node!.Kind === KindPrivateIdentifier) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsEntityName","kind":"func","status":"implemented","sigHash":"a3ae6bdb53a6b9349508e5526cb18cf838db6b006de9905b371951a587bfa575","bodyHash":"f8338c439bbccc96c943001475f45559f39459cd50e66db544357ae7e1a3788a"}
 *
 * Go source:
 * func IsEntityName(node *Node) bool {
 * 	return node.Kind == KindIdentifier || node.Kind == KindQualifiedName
 * }
 */
export function IsEntityName(node: GoPtr<Node>): bool {
  return (node!.Kind === KindIdentifier || node!.Kind === KindQualifiedName) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPropertyName","kind":"func","status":"implemented","sigHash":"ab0a51d5e3e4620eb79f2f413b8d6eedf5aa1fb0143f2989242b37ee78a8e69d","bodyHash":"f65ae123d5a5df12b321f239e0b4f61b093d51c545c75ab2fa76cfff43490ae4"}
 *
 * Go source:
 * func IsPropertyName(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindIdentifier,
 * 		KindPrivateIdentifier,
 * 		KindStringLiteral,
 * 		KindNumericLiteral,
 * 		KindComputedPropertyName:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsPropertyName(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindIdentifier:
    case KindPrivateIdentifier:
    case KindStringLiteral:
    case KindNumericLiteral:
    case KindComputedPropertyName:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsIdentifierName","kind":"func","status":"implemented","sigHash":"7a49e452b6767ff17574ff8ef38770593c0a2b6c07714827d7b118531fe36538","bodyHash":"960c37c99c1077d700ed8478c74bda30653dbd808dcf7c1b7602a9a95726f52e"}
 *
 * Go source:
 * func IsIdentifierName(node *Node) bool {
 * 	parent := node.Parent
 * 	switch parent.Kind {
 * 	case KindPropertyDeclaration, KindPropertySignature, KindMethodDeclaration, KindMethodSignature, KindGetAccessor,
 * 		KindSetAccessor, KindEnumMember, KindPropertyAssignment, KindPropertyAccessExpression:
 * 		return parent.Name() == node
 * 	case KindQualifiedName:
 * 		return parent.AsQualifiedName().Right == node
 * 	case KindBindingElement:
 * 		return parent.PropertyName() == node
 * 	case KindImportSpecifier:
 * 		return parent.PropertyName() == node
 * 	case KindExportSpecifier, KindJsxAttribute, KindJsxSelfClosingElement, KindJsxOpeningElement, KindJsxClosingElement:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsIdentifierName(node: GoPtr<Node>): bool {
  const parent: GoPtr<Node> = node!.Parent;
  switch (parent!.Kind) {
    case KindPropertyDeclaration:
    case KindPropertySignature:
    case KindMethodDeclaration:
    case KindMethodSignature:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindEnumMember:
    case KindPropertyAssignment:
    case KindPropertyAccessExpression:
      return (Node_Name(parent) === node) as bool;
    case KindQualifiedName:
      return (AsQualifiedName(parent)!.Right === node) as bool;
    case KindBindingElement:
      return (Node_PropertyName(parent) === node) as bool;
    case KindImportSpecifier:
      return (Node_PropertyName(parent) === node) as bool;
    case KindExportSpecifier:
    case KindJsxAttribute:
    case KindJsxSelfClosingElement:
    case KindJsxOpeningElement:
    case KindJsxClosingElement:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPushOrUnshiftIdentifier","kind":"func","status":"implemented","sigHash":"c378b00f86833bf04d1aeb27f29c4d4c37115a76a609b81ae8721aca3517bfa0","bodyHash":"abc459de35f03ad47aa933dbc27d2bcfa90c14944ddaaa6df73e5ec6c69bcb16"}
 *
 * Go source:
 * func IsPushOrUnshiftIdentifier(node *Node) bool {
 * 	text := node.Text()
 * 	return text == "push" || text == "unshift"
 * }
 */
export function IsPushOrUnshiftIdentifier(node: GoPtr<Node>): bool {
  const text: string = Node_Text(node);
  return (text === "push" || text === "unshift") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsBooleanLiteral","kind":"func","status":"implemented","sigHash":"53c4aa81fe389e3f77285497dfe994510a0ea1b0b5c64137d934161ded399ed3","bodyHash":"4d9fc0fcbdc679b67eaf707575d23830bebdf499654d13b9a0e139f6e5164c08"}
 *
 * Go source:
 * func IsBooleanLiteral(node *Node) bool {
 * 	return node.Kind == KindTrueKeyword || node.Kind == KindFalseKeyword
 * }
 */
export function IsBooleanLiteral(node: GoPtr<Node>): bool {
  return (node!.Kind === KindTrueKeyword || node!.Kind === KindFalseKeyword) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsLiteralExpression","kind":"func","status":"implemented","sigHash":"00774992abba24ae86e3381abff204fdb12c149fcd08f1d8b75dd2b7a12240bf","bodyHash":"2a85b601d8ec5cebadbfd8cfd3b26675695bfc0894be2fdeb660e0c5eeffa73d"}
 *
 * Go source:
 * func IsLiteralExpression(node *Node) bool {
 * 	return IsLiteralKind(node.Kind)
 * }
 */
export function IsLiteralExpression(node: GoPtr<Node>): bool {
  return IsLiteralKind(node!.Kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsStringLiteralLike","kind":"func","status":"implemented","sigHash":"09463f04f84223947624bd98d1b1597d37a2f0e4e6d1649a5704ec795179154e","bodyHash":"a1aade5ae2199258631f07d24b61691400fd8069bf6de05b665dbbc88fd9c673"}
 *
 * Go source:
 * func IsStringLiteralLike(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindStringLiteral, KindNoSubstitutionTemplateLiteral:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsStringLiteralLike(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindStringLiteral:
    case KindNoSubstitutionTemplateLiteral:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsStringOrNumericLiteralLike","kind":"func","status":"implemented","sigHash":"76ee06783a07da53c308a8bc25822b907222f32b869b012e52bedec808d22874","bodyHash":"4a249f0913e29788a4f4d8e42fd9b18f4c870e265ee0ebf3e33ef1704db89bc8"}
 *
 * Go source:
 * func IsStringOrNumericLiteralLike(node *Node) bool {
 * 	return IsStringLiteralLike(node) || IsNumericLiteral(node)
 * }
 */
export function IsStringOrNumericLiteralLike(node: GoPtr<Node>): bool {
  return (IsStringLiteralLike(node) || IsNumericLiteral(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsSignedNumericLiteral","kind":"func","status":"implemented","sigHash":"d1c97250bef470a405c72b401a8628805c1a28c373cccd612a2db81e2f62e782","bodyHash":"6041b9ea5072287015354031c82516ae1a89af54beec1c9761bdbf40914869e2"}
 *
 * Go source:
 * func IsSignedNumericLiteral(node *Node) bool {
 * 	if node.Kind == KindPrefixUnaryExpression {
 * 		node := node.AsPrefixUnaryExpression()
 * 		return (node.Operator == KindPlusToken || node.Operator == KindMinusToken) && IsNumericLiteral(node.Operand)
 * 	}
 * 	return false
 * }
 */
export function IsSignedNumericLiteral(node: GoPtr<Node>): bool {
  if (node!.Kind === KindPrefixUnaryExpression) {
    const pre = AsPrefixUnaryExpression(node);
    return ((pre!.Operator === KindPlusToken || pre!.Operator === KindMinusToken) &&
      IsNumericLiteral(pre!.Operand)) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsOptionalChain","kind":"func","status":"implemented","sigHash":"7ffb752085bb1a77e681e0d222d1e7ee900cf5f25a99ba88b05ecd76539650f3","bodyHash":"c8691c0f20b3d62144268c5f4adb6aad19ee8b6ae7d87a5a7221b65fbf9c89e0"}
 *
 * Go source:
 * func IsOptionalChain(node *Node) bool {
 * 	if node.Flags&NodeFlagsOptionalChain != 0 {
 * 		switch node.Kind {
 * 		case KindPropertyAccessExpression,
 * 			KindElementAccessExpression,
 * 			KindCallExpression,
 * 			KindNonNullExpression:
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function IsOptionalChain(node: GoPtr<Node>): bool {
  if ((node!.Flags & NodeFlagsOptionalChain) !== 0) {
    switch (node!.Kind) {
      case KindPropertyAccessExpression:
      case KindElementAccessExpression:
      case KindCallExpression:
      case KindNonNullExpression:
        return true as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::getQuestionDotToken","kind":"func","status":"implemented","sigHash":"232831ddb00175f322b7e0e79f0fb041d5565959a5982f6e58c3eb9aa3cd8516","bodyHash":"867a87f531cc90ae1c0eb51de02c433c5d49d6d60d95937cd1a183d1670bbfa5"}
 *
 * Go source:
 * func getQuestionDotToken(node *Expression) *TokenNode {
 * 	return node.QuestionDotToken()
 * }
 */
export function getQuestionDotToken(node: GoPtr<Expression>): GoPtr<TokenNode> {
  return Node_QuestionDotToken(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsOptionalChainRoot","kind":"func","status":"implemented","sigHash":"e50f9b4215f33ebfb251ba36ab7dd6a8b597724889bd63cd2332bf9918f528d7","bodyHash":"91bf5a4cb883f04eb0c2e9f1fc23e53661aed1becbd063badb3fa876de496f23"}
 *
 * Go source:
 * func IsOptionalChainRoot(node *Expression) bool {
 * 	return IsOptionalChain(node) && !IsNonNullExpression(node) && getQuestionDotToken(node) != nil
 * }
 */
export function IsOptionalChainRoot(node: GoPtr<Expression>): bool {
  return (IsOptionalChain(node) && !IsNonNullExpression(node) && getQuestionDotToken(node) !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsOutermostOptionalChain","kind":"func","status":"implemented","sigHash":"983f2bc4419da36c023e83e77d072983faffd099e41a838c3738804ea016958f","bodyHash":"00dacaae6dc3a69fa0be72433f25fe3a701f2d7937761e17fbce467d1d5077b7"}
 *
 * Go source:
 * func IsOutermostOptionalChain(node *Expression) bool {
 * 	parent := node.Parent
 * 	return !IsOptionalChain(parent) || // cases 1, 2, and 3
 * 		IsOptionalChainRoot(parent) || // case 4
 * 		node != parent.Expression() // case 5
 * }
 */
export function IsOutermostOptionalChain(node: GoPtr<Expression>): bool {
  const parent: GoPtr<Node> = node!.Parent;
  return (!IsOptionalChain(parent) || // cases 1, 2, and 3
    IsOptionalChainRoot(parent) || // case 4
    node !== Node_Expression(parent)) as bool; // case 5
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsExpressionOfOptionalChainRoot","kind":"func","status":"implemented","sigHash":"0c94fe64954e2211390fb92efea2342dae39af26b183c0afcb7c2a38a20cc6bf","bodyHash":"0b86f6c03b0e0ba7c0062bc63ed09aa2067a5cc9fc01bb19904e47f2c2edd1fd"}
 *
 * Go source:
 * func IsExpressionOfOptionalChainRoot(node *Node) bool {
 * 	return IsOptionalChainRoot(node.Parent) && node.Parent.Expression() == node
 * }
 */
export function IsExpressionOfOptionalChainRoot(node: GoPtr<Node>): bool {
  return (IsOptionalChainRoot(node!.Parent) && Node_Expression(node!.Parent) === node) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsNullishCoalesce","kind":"func","status":"implemented","sigHash":"49d83452f09e0e433782b7ed43de256ee7a2bf24be8067424582a928a92ace43","bodyHash":"25be6fea6ffc7910f9236a99d366aa529f4e31306059fff997ac8b8000689e9b"}
 *
 * Go source:
 * func IsNullishCoalesce(node *Node) bool {
 * 	return node.Kind == KindBinaryExpression && node.AsBinaryExpression().OperatorToken.Kind == KindQuestionQuestionToken
 * }
 */
export function IsNullishCoalesce(node: GoPtr<Node>): bool {
  return (node!.Kind === KindBinaryExpression &&
    AsBinaryExpression(node)!.OperatorToken!.Kind === KindQuestionQuestionToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsAssertionExpression","kind":"func","status":"implemented","sigHash":"e6a2784bca4aa9011c608795880afde78a16ff2b55e635915600bf30871c334d","bodyHash":"c1a2603e7a392d719c2087328b84b7f1c0fd051d10432dd6dfce1b35bbe352e2"}
 *
 * Go source:
 * func IsAssertionExpression(node *Node) bool {
 * 	kind := node.Kind
 * 	return kind == KindTypeAssertionExpression || kind == KindAsExpression
 * }
 */
export function IsAssertionExpression(node: GoPtr<Node>): bool {
  const kind = node!.Kind;
  return (kind === KindTypeAssertionExpression || kind === KindAsExpression) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isLeftHandSideExpressionKind","kind":"func","status":"implemented","sigHash":"7cf2ea23fcdfc00862a588b67ea497154c82553439bbc0b8a69ffee00b7324c9","bodyHash":"d977300951f62d1892ed5ef35cc47e395bc556c89286332336cd3136f43c977f"}
 *
 * Go source:
 * func isLeftHandSideExpressionKind(kind Kind) bool {
 * 	switch kind {
 * 	case KindPropertyAccessExpression, KindElementAccessExpression, KindNewExpression, KindCallExpression,
 * 		KindJsxElement, KindJsxSelfClosingElement, KindJsxFragment, KindTaggedTemplateExpression, KindArrayLiteralExpression,
 * 		KindParenthesizedExpression, KindObjectLiteralExpression, KindClassExpression, KindFunctionExpression, KindIdentifier,
 * 		KindPrivateIdentifier, KindRegularExpressionLiteral, KindNumericLiteral, KindBigIntLiteral, KindStringLiteral,
 * 		KindNoSubstitutionTemplateLiteral, KindTemplateExpression, KindFalseKeyword, KindNullKeyword, KindThisKeyword,
 * 		KindTrueKeyword, KindSuperKeyword, KindNonNullExpression, KindExpressionWithTypeArguments, KindMetaProperty,
 * 		KindImportKeyword, KindMissingDeclaration:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function isLeftHandSideExpressionKind(kind: Kind): bool {
  switch (kind) {
    case KindPropertyAccessExpression:
    case KindElementAccessExpression:
    case KindNewExpression:
    case KindCallExpression:
    case KindJsxElement:
    case KindJsxSelfClosingElement:
    case KindJsxFragment:
    case KindTaggedTemplateExpression:
    case KindArrayLiteralExpression:
    case KindParenthesizedExpression:
    case KindObjectLiteralExpression:
    case KindClassExpression:
    case KindFunctionExpression:
    case KindIdentifier:
    case KindPrivateIdentifier:
    case KindRegularExpressionLiteral:
    case KindNumericLiteral:
    case KindBigIntLiteral:
    case KindStringLiteral:
    case KindNoSubstitutionTemplateLiteral:
    case KindTemplateExpression:
    case KindFalseKeyword:
    case KindNullKeyword:
    case KindThisKeyword:
    case KindTrueKeyword:
    case KindSuperKeyword:
    case KindNonNullExpression:
    case KindExpressionWithTypeArguments:
    case KindMetaProperty:
    case KindImportKeyword:
    case KindMissingDeclaration:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsLeftHandSideExpression","kind":"func","status":"implemented","sigHash":"c1211996a6673f686253c77291112a56159391d89739ba82d42828eb682fecb5","bodyHash":"872a81b21b98f3c4a5e7af619fd01a2b41aecbc71a69992623276d4e6001714f"}
 *
 * Go source:
 * func IsLeftHandSideExpression(node *Node) bool {
 * 	return isLeftHandSideExpressionKind(SkipPartiallyEmittedExpressions(node).Kind)
 * }
 */
export function IsLeftHandSideExpression(node: GoPtr<Node>): bool {
  return isLeftHandSideExpressionKind(SkipPartiallyEmittedExpressions(node)!.Kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isUnaryExpressionKind","kind":"func","status":"implemented","sigHash":"24c2437e14dc45f776cb33b82a04bf2b53b23954e67e2e131b324904d7f9e3a6","bodyHash":"e37aa62d859e4c8c28d2c9d85ed6b65e65e4d2301c14e4ace95367508bdf1cb5"}
 *
 * Go source:
 * func isUnaryExpressionKind(kind Kind) bool {
 * 	switch kind {
 * 	case KindPrefixUnaryExpression,
 * 		KindPostfixUnaryExpression,
 * 		KindDeleteExpression,
 * 		KindTypeOfExpression,
 * 		KindVoidExpression,
 * 		KindAwaitExpression,
 * 		KindTypeAssertionExpression:
 * 		return true
 * 	}
 * 	return isLeftHandSideExpressionKind(kind)
 * }
 */
export function isUnaryExpressionKind(kind: Kind): bool {
  switch (kind) {
    case KindPrefixUnaryExpression:
    case KindPostfixUnaryExpression:
    case KindDeleteExpression:
    case KindTypeOfExpression:
    case KindVoidExpression:
    case KindAwaitExpression:
    case KindTypeAssertionExpression:
      return true as bool;
  }
  return isLeftHandSideExpressionKind(kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsUnaryExpression","kind":"func","status":"implemented","sigHash":"e5d475a3092fa4b6dcb5a43e32e246a6c95cba30808f9062ef55cbbbec845dd2","bodyHash":"674df652a864618d2e2edc37cb021d1e9f97b4f0d8b0c5d2753d8503c3b3e70d"}
 *
 * Go source:
 * func IsUnaryExpression(node *Node) bool {
 * 	return isUnaryExpressionKind(SkipPartiallyEmittedExpressions(node).Kind)
 * }
 */
export function IsUnaryExpression(node: GoPtr<Node>): bool {
  return isUnaryExpressionKind(SkipPartiallyEmittedExpressions(node)!.Kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isExpressionKind","kind":"func","status":"implemented","sigHash":"015faf6ca1af9ac184d239f252fe8cb7b31304b8c060c9c383d006fc3fd6c5ee","bodyHash":"052accb9c5da1860513cb2716d46f7abcb23294093231e76fe5484f8cc1425ff"}
 *
 * Go source:
 * func isExpressionKind(kind Kind) bool {
 * 	switch kind {
 * 	case KindConditionalExpression,
 * 		KindYieldExpression,
 * 		KindArrowFunction,
 * 		KindBinaryExpression,
 * 		KindSpreadElement,
 * 		KindAsExpression,
 * 		KindOmittedExpression,
 * 		KindPartiallyEmittedExpression,
 * 		KindSatisfiesExpression:
 * 		return true
 * 	}
 * 	return isUnaryExpressionKind(kind)
 * }
 */
export function isExpressionKind(kind: Kind): bool {
  switch (kind) {
    case KindConditionalExpression:
    case KindYieldExpression:
    case KindArrowFunction:
    case KindBinaryExpression:
    case KindSpreadElement:
    case KindAsExpression:
    case KindOmittedExpression:
    case KindPartiallyEmittedExpression:
    case KindSatisfiesExpression:
      return true as bool;
  }
  return isUnaryExpressionKind(kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsExpression","kind":"func","status":"implemented","sigHash":"fe55328b4cc31b6cde58afaa7dc6d03c97ce1bde714ad40623901c09c962c95b","bodyHash":"8708297842a3a4eb6eac8dc0511ea8f234b107905113198707279039a8a3760c"}
 *
 * Go source:
 * func IsExpression(node *Node) bool {
 * 	return isExpressionKind(SkipPartiallyEmittedExpressions(node).Kind)
 * }
 */
export function IsExpression(node: GoPtr<Node>): bool {
  return isExpressionKind(SkipPartiallyEmittedExpressions(node)!.Kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsCommaExpression","kind":"func","status":"implemented","sigHash":"c573b456028c7aa042280be835b10f6264f8042a018b587bc0a3554902624776","bodyHash":"9416455817030f618345989b0e6d8bce70d9e3b30ca9022c1cfe6e7196265324"}
 *
 * Go source:
 * func IsCommaExpression(node *Node) bool {
 * 	return node.Kind == KindBinaryExpression && node.AsBinaryExpression().OperatorToken.Kind == KindCommaToken
 * }
 */
export function IsCommaExpression(node: GoPtr<Node>): bool {
  return (node!.Kind === KindBinaryExpression &&
    AsBinaryExpression(node)!.OperatorToken!.Kind === KindCommaToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsCommaSequence","kind":"func","status":"implemented","sigHash":"71f41de6596e51cfbaa1a596ade3a9a10a0006e89e02bd65a2fada04ae8eb1ee","bodyHash":"6f650571e94d47470fda904da6d5666cb07a5d8f9302a63904ab679d1120b94a"}
 *
 * Go source:
 * func IsCommaSequence(node *Node) bool {
 * 	return IsCommaExpression(node)
 * }
 */
export function IsCommaSequence(node: GoPtr<Node>): bool {
  return IsCommaExpression(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsIterationStatement","kind":"func","status":"implemented","sigHash":"9652f53c2c56087e53db6732fa1e572eb4b27467e00ad2a4970a22efe7e96298","bodyHash":"b1ab4a5726691ba030c691097d9d82d4ffc3cf1e246c5c68e3a9cac516ec7d77"}
 *
 * Go source:
 * func IsIterationStatement(node *Node, lookInLabeledStatements bool) bool {
 * 	switch node.Kind {
 * 	case KindForStatement,
 * 		KindForInStatement,
 * 		KindForOfStatement,
 * 		KindDoStatement,
 * 		KindWhileStatement:
 * 		return true
 * 	case KindLabeledStatement:
 * 		return lookInLabeledStatements && IsIterationStatement(node.Statement(), lookInLabeledStatements)
 * 	}
 * 
 * 	return false
 * }
 */
export function IsIterationStatement(node: GoPtr<Node>, lookInLabeledStatements: bool): bool {
  switch (node!.Kind) {
    case KindForStatement:
    case KindForInStatement:
    case KindForOfStatement:
    case KindDoStatement:
    case KindWhileStatement:
      return true as bool;
    case KindLabeledStatement:
      return (lookInLabeledStatements &&
        IsIterationStatement(Node_Statement(node), lookInLabeledStatements)) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsAccessExpression","kind":"func","status":"implemented","sigHash":"61952dcafebbcbcfb6b9c3b296f7ee1d98d8c24f1f4776b41d4d04c7c9915645","bodyHash":"af868170f8ff1959b5b0a3c7dbb883eeb05f367f0b5da6b33bbf7341d75313b9"}
 *
 * Go source:
 * func IsAccessExpression(node *Node) bool {
 * 	return node.Kind == KindPropertyAccessExpression || node.Kind == KindElementAccessExpression
 * }
 */
export function IsAccessExpression(node: GoPtr<Node>): bool {
  return (node!.Kind === KindPropertyAccessExpression || node!.Kind === KindElementAccessExpression) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isFunctionLikeDeclarationKind","kind":"func","status":"implemented","sigHash":"a4ffbca09908739c93adc5fd9e52b5235659d3ff191298d2738708ad798cf9b1","bodyHash":"2904a47cb90e14447c7ac4ecf7f0f2f90314057c234fa06819eb52d50c6947ed"}
 *
 * Go source:
 * func isFunctionLikeDeclarationKind(kind Kind) bool {
 * 	switch kind {
 * 	case KindFunctionDeclaration,
 * 		KindMethodDeclaration,
 * 		KindConstructor,
 * 		KindGetAccessor,
 * 		KindSetAccessor,
 * 		KindFunctionExpression,
 * 		KindArrowFunction:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function isFunctionLikeDeclarationKind(kind: Kind): bool {
  switch (kind) {
    case KindFunctionDeclaration:
    case KindMethodDeclaration:
    case KindConstructor:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindFunctionExpression:
    case KindArrowFunction:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsFunctionLikeDeclaration","kind":"func","status":"implemented","sigHash":"cbcec2950608f710d0648881af6ad664aca8c7d560f58874de862832807db575","bodyHash":"2fdad40a8cb7db2309e8f05d505942769b904e72f9d7d98c84cbb1a572598d32"}
 *
 * Go source:
 * func IsFunctionLikeDeclaration(node *Node) bool {
 * 	// TODO(rbuckton): Move `node != nil` test to call sites
 * 	return node != nil && isFunctionLikeDeclarationKind(node.Kind)
 * }
 */
export function IsFunctionLikeDeclaration(node: GoPtr<Node>): bool {
  // TODO(rbuckton): Move `node != nil` test to call sites
  return (node !== undefined && isFunctionLikeDeclarationKind(node!.Kind)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsFunctionLikeKind","kind":"func","status":"implemented","sigHash":"f4100271923aade8392777c04b6bf3528f6c1b51e5ad59c662000d4f0912461d","bodyHash":"01b5227b87184a201bc8d02f11b4c32d6077b6369394521abfe7eba580855243"}
 *
 * Go source:
 * func IsFunctionLikeKind(kind Kind) bool {
 * 	switch kind {
 * 	case KindMethodSignature,
 * 		KindCallSignature,
 * 		KindJSDocSignature,
 * 		KindConstructSignature,
 * 		KindIndexSignature,
 * 		KindFunctionType,
 * 		KindConstructorType:
 * 		return true
 * 	}
 * 	return isFunctionLikeDeclarationKind(kind)
 * }
 */
export function IsFunctionLikeKind(kind: Kind): bool {
  switch (kind) {
    case KindMethodSignature:
    case KindCallSignature:
    case KindJSDocSignature:
    case KindConstructSignature:
    case KindIndexSignature:
    case KindFunctionType:
    case KindConstructorType:
      return true as bool;
  }
  return isFunctionLikeDeclarationKind(kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsFunctionLike","kind":"func","status":"implemented","sigHash":"6c7ead5224257132a4d8c845710a892f22066fb66f4162440e2ac42ffa95c29f","bodyHash":"ee720ae11c28c8799ec6bc8bd7907c4a7ca1508f0f9a4290813be5ca2a77d2f9"}
 *
 * Go source:
 * func IsFunctionLike(node *Node) bool {
 * 	// TODO(rbuckton): Move `node != nil` test to call sites
 * 	return node != nil && IsFunctionLikeKind(node.Kind)
 * }
 */
export function IsFunctionLike(node: GoPtr<Node>): bool {
  // TODO(rbuckton): Move `node != nil` test to call sites
  return (node !== undefined && IsFunctionLikeKind(node!.Kind)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsFunctionLikeOrClassStaticBlockDeclaration","kind":"func","status":"implemented","sigHash":"a4028120f14cb1aea50084c489aba0b8cfb9dc507d5aafbbff2007a8558bc910","bodyHash":"10067fef8c7130cac1afa5103803972b7cd3dc0756c487269160427391cdae09"}
 *
 * Go source:
 * func IsFunctionLikeOrClassStaticBlockDeclaration(node *Node) bool {
 * 	return node != nil && (IsFunctionLike(node) || IsClassStaticBlockDeclaration(node))
 * }
 */
export function IsFunctionLikeOrClassStaticBlockDeclaration(node: GoPtr<Node>): bool {
  return (node !== undefined && (IsFunctionLike(node) || IsClassStaticBlockDeclaration(node))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsFunctionOrSourceFile","kind":"func","status":"implemented","sigHash":"5c49dde8991c07647505b91b7ba3407e93a6375678a75c3eb0e0f96f6a8a93e5","bodyHash":"f183e96375675906e0ef552a92d7a5ea5d0dcbf3cd7bac95a5b0ad079f13a69a"}
 *
 * Go source:
 * func IsFunctionOrSourceFile(node *Node) bool {
 * 	return IsFunctionLike(node) || IsSourceFile(node)
 * }
 */
export function IsFunctionOrSourceFile(node: GoPtr<Node>): bool {
  return (IsFunctionLike(node) || IsSourceFile(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsClassLike","kind":"func","status":"implemented","sigHash":"0c17b85001847f9d4150970523cb4a6dd74e3fc4e81566757a119fd2caa4c8a7","bodyHash":"48f6325024179c57d904081ec9b63c52d8e5c84880ff36c5afb7eb66ebbf478f"}
 *
 * Go source:
 * func IsClassLike(node *Node) bool {
 * 	return node.Kind == KindClassDeclaration || node.Kind == KindClassExpression
 * }
 */
export function IsClassLike(node: GoPtr<Node>): bool {
  return (node!.Kind === KindClassDeclaration || node!.Kind === KindClassExpression) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsClassOrInterfaceLike","kind":"func","status":"implemented","sigHash":"87035a445d76871d4fc0cd84987b34a49798b8c7e120a9b2122ea66e2f4b89aa","bodyHash":"a0b5fce3c5f69d51a90ee4e30c54cba24d0f61da5b8cca97911a8e2b2a4fe740"}
 *
 * Go source:
 * func IsClassOrInterfaceLike(node *Node) bool {
 * 	return node.Kind == KindClassDeclaration || node.Kind == KindClassExpression || node.Kind == KindInterfaceDeclaration
 * }
 */
export function IsClassOrInterfaceLike(node: GoPtr<Node>): bool {
  return (node!.Kind === KindClassDeclaration || node!.Kind === KindClassExpression ||
    node!.Kind === KindInterfaceDeclaration) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsClassElement","kind":"func","status":"implemented","sigHash":"043f03823f817fc01b04ba78af5d6fe93edbb634f069a0a48d6a11bdfc8eca59","bodyHash":"acc34aa39eb48b92190bbc29df4a622d675958d8794a580d94a91b8e3c2f87af"}
 *
 * Go source:
 * func IsClassElement(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindConstructor,
 * 		KindPropertyDeclaration,
 * 		KindMethodDeclaration,
 * 		KindGetAccessor,
 * 		KindSetAccessor,
 * 		KindIndexSignature,
 * 		KindClassStaticBlockDeclaration,
 * 		KindSemicolonClassElement:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsClassElement(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindConstructor:
    case KindPropertyDeclaration:
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindIndexSignature:
    case KindClassStaticBlockDeclaration:
    case KindSemicolonClassElement:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsMethodOrAccessor","kind":"func","status":"implemented","sigHash":"24ba6a953db8244572dd03e34be717e4b4f77ae0b58f7a4dd5cfe6916964e5aa","bodyHash":"5850328b5a7738c92e1e380e9090cbabdb9b93df37c9067aa7efbc2ea008376d"}
 *
 * Go source:
 * func IsMethodOrAccessor(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindMethodDeclaration, KindGetAccessor, KindSetAccessor:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsMethodOrAccessor(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPrivateIdentifierClassElementDeclaration","kind":"func","status":"implemented","sigHash":"67727b6227ce02d3c903b03908e28c616edaa693ff7521a765446cf297b2b70d","bodyHash":"3b10085ebd76491b4d1a9809054ad591202a3aac6125c9229a0a844a9b8e7284"}
 *
 * Go source:
 * func IsPrivateIdentifierClassElementDeclaration(node *Node) bool {
 * 	return (IsPropertyDeclaration(node) || IsMethodOrAccessor(node)) && IsPrivateIdentifier(node.Name())
 * }
 */
export function IsPrivateIdentifierClassElementDeclaration(node: GoPtr<Node>): bool {
  return ((IsPropertyDeclaration(node) || IsMethodOrAccessor(node)) && IsPrivateIdentifier(Node_Name(node))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsObjectLiteralOrClassExpressionMethodOrAccessor","kind":"func","status":"implemented","sigHash":"a376a93a59b6cf5871e777b075fddda57cb1bf3396ab0d4ae27e70a10c9c9ba1","bodyHash":"9588fece91a0f6c73e1513f742251dca08ecec4e13729c7433e5b4adfc6ff501"}
 *
 * Go source:
 * func IsObjectLiteralOrClassExpressionMethodOrAccessor(node *Node) bool {
 * 	kind := node.Kind
 * 	return (kind == KindMethodDeclaration || kind == KindGetAccessor || kind == KindSetAccessor) &&
 * 		(node.Parent.Kind == KindObjectLiteralExpression || node.Parent.Kind == KindClassExpression)
 * }
 */
export function IsObjectLiteralOrClassExpressionMethodOrAccessor(node: GoPtr<Node>): bool {
  const kind = node!.Kind;
  return ((kind === KindMethodDeclaration || kind === KindGetAccessor || kind === KindSetAccessor) &&
    (node!.Parent!.Kind === KindObjectLiteralExpression || node!.Parent!.Kind === KindClassExpression)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsTypeElement","kind":"func","status":"implemented","sigHash":"74d17613c1e76e1b0831d007a385c3056eb1bbc71ad428bdf76e0a7905612f4b","bodyHash":"2f37cefcb5af2ff0e108b3fad94e512bf162e31ab5e45f33fcb242dcf66bbb3d"}
 *
 * Go source:
 * func IsTypeElement(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindConstructSignature,
 * 		KindCallSignature,
 * 		KindPropertySignature,
 * 		KindMethodSignature,
 * 		KindIndexSignature,
 * 		KindGetAccessor,
 * 		KindSetAccessor,
 * 		KindNotEmittedTypeElement:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsTypeElement(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindConstructSignature:
    case KindCallSignature:
    case KindPropertySignature:
    case KindMethodSignature:
    case KindIndexSignature:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindNotEmittedTypeElement:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsObjectLiteralElement","kind":"func","status":"implemented","sigHash":"367defa71c7329121d189c076c0daf60114ccde926391ec113a168bf6793375c","bodyHash":"a574d0db00a3e87739f76e77587debc0ac2a867d4f1c0113f67f5bb5c2c9422c"}
 *
 * Go source:
 * func IsObjectLiteralElement(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindPropertyAssignment,
 * 		KindShorthandPropertyAssignment,
 * 		KindSpreadAssignment,
 * 		KindMethodDeclaration,
 * 		KindGetAccessor,
 * 		KindSetAccessor:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsObjectLiteralElement(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindPropertyAssignment:
    case KindShorthandPropertyAssignment:
    case KindSpreadAssignment:
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsObjectLiteralMethod","kind":"func","status":"implemented","sigHash":"370870a967de7c917652337436a18c50a75fe3f8ef1b435e420a314371372c51","bodyHash":"e8a897d280a06bf7142ac5d5714b0b8ad0675d8f9a2232962cfe4da262206284"}
 *
 * Go source:
 * func IsObjectLiteralMethod(node *Node) bool {
 * 	return node != nil && node.Kind == KindMethodDeclaration && node.Parent.Kind == KindObjectLiteralExpression
 * }
 */
export function IsObjectLiteralMethod(node: GoPtr<Node>): bool {
  return (node !== undefined && node!.Kind === KindMethodDeclaration &&
    node!.Parent!.Kind === KindObjectLiteralExpression) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsAutoAccessorPropertyDeclaration","kind":"func","status":"implemented","sigHash":"9e47d8077e5e0d9af01bf0bd268d2f965204159ff5979d7804b246d6945208ac","bodyHash":"274de6d293664184a1750258a552678c011389201db13536fd062b106c07cd09"}
 *
 * Go source:
 * func IsAutoAccessorPropertyDeclaration(node *Node) bool {
 * 	return IsPropertyDeclaration(node) && HasAccessorModifier(node)
 * }
 */
export function IsAutoAccessorPropertyDeclaration(node: GoPtr<Node>): bool {
  return (IsPropertyDeclaration(node) && HasAccessorModifier(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsParameterPropertyDeclaration","kind":"func","status":"implemented","sigHash":"f85880286704b29f8a8186f318cf14f4e4d06421e2f8b581e043ef02dd1dabcc","bodyHash":"5bd59a0487fe9f8116e5c51efdc71433058a5d7f516da282d909135ef481f720"}
 *
 * Go source:
 * func IsParameterPropertyDeclaration(node *Node, parent *Node) bool {
 * 	return IsParameterDeclaration(node) && HasSyntacticModifier(node, ModifierFlagsParameterPropertyModifier) && parent.Kind == KindConstructor
 * }
 */
export function IsParameterPropertyDeclaration(node: GoPtr<Node>, parent: GoPtr<Node>): bool {
  return (IsParameterDeclaration(node) &&
    HasSyntacticModifier(node, ModifierFlagsParameterPropertyModifier) &&
    parent!.Kind === KindConstructor) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJsxChild","kind":"func","status":"implemented","sigHash":"6826ff73051d8aacfe220f80014cc900481d17b1bdbe36d6dd2cae944bd1002c","bodyHash":"3f6fbed5e23db0694e7dfd66492ef0879627ef219b8902a189d1e9fed5629e42"}
 *
 * Go source:
 * func IsJsxChild(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindJsxElement,
 * 		KindJsxExpression,
 * 		KindJsxSelfClosingElement,
 * 		KindJsxText,
 * 		KindJsxFragment:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsJsxChild(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindJsxElement:
    case KindJsxExpression:
    case KindJsxSelfClosingElement:
    case KindJsxText:
    case KindJsxFragment:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJsxAttributeLike","kind":"func","status":"implemented","sigHash":"337b1d9f288390760ca1d49f96c06c3b3226ae68943692a4579406f12dd1a3dd","bodyHash":"99c06467528b19fea747d82bbd0df58aa9895e1ced06cf1f8d8ca099c224db9b"}
 *
 * Go source:
 * func IsJsxAttributeLike(node *Node) bool {
 * 	return IsJsxAttribute(node) || IsJsxSpreadAttribute(node)
 * }
 */
export function IsJsxAttributeLike(node: GoPtr<Node>): bool {
  return (IsJsxAttribute(node) || IsJsxSpreadAttribute(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isDeclarationStatementKind","kind":"func","status":"implemented","sigHash":"45e1f17f3e755bf274128c565f818a3e37683447c5254004482732cef5b40b64","bodyHash":"8a9c429180aa91ae54703f911d23c54b7458b31ab10e0db8da533afd36e62b48"}
 *
 * Go source:
 * func isDeclarationStatementKind(kind Kind) bool {
 * 	switch kind {
 * 	case KindFunctionDeclaration,
 * 		KindMissingDeclaration,
 * 		KindClassDeclaration,
 * 		KindInterfaceDeclaration,
 * 		KindTypeAliasDeclaration,
 * 		KindJSTypeAliasDeclaration,
 * 		KindEnumDeclaration,
 * 		KindModuleDeclaration,
 * 		KindImportDeclaration,
 * 		KindJSImportDeclaration,
 * 		KindImportEqualsDeclaration,
 * 		KindExportDeclaration,
 * 		KindExportAssignment,
 * 		KindNamespaceExportDeclaration:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function isDeclarationStatementKind(kind: Kind): bool {
  switch (kind) {
    case KindFunctionDeclaration:
    case KindMissingDeclaration:
    case KindClassDeclaration:
    case KindInterfaceDeclaration:
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
    case KindEnumDeclaration:
    case KindModuleDeclaration:
    case KindImportDeclaration:
    case KindJSImportDeclaration:
    case KindImportEqualsDeclaration:
    case KindExportDeclaration:
    case KindExportAssignment:
    case KindNamespaceExportDeclaration:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsDeclarationStatement","kind":"func","status":"implemented","sigHash":"85b33e7d42c67478e0051808a11e5675bbeb8595d9dd731559a10817fbaca5c1","bodyHash":"fd94f17af0956931d15bde65a21f7522a9377d23f5ec4e04c7023ea36b73b0a7"}
 *
 * Go source:
 * func IsDeclarationStatement(node *Node) bool {
 * 	return isDeclarationStatementKind(node.Kind)
 * }
 */
export function IsDeclarationStatement(node: GoPtr<Node>): bool {
  return isDeclarationStatementKind(node!.Kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isStatementKindButNotDeclarationKind","kind":"func","status":"implemented","sigHash":"fc37d57ca18401705826ae35bc84030fc907b292af3526b88fca55ff3fe0edc1","bodyHash":"c72ca9e150eb8f201307cd832ec751c42c86f38c2f9aa75a54959cb3cd55351c"}
 *
 * Go source:
 * func isStatementKindButNotDeclarationKind(kind Kind) bool {
 * 	switch kind {
 * 	case KindBreakStatement,
 * 		KindContinueStatement,
 * 		KindDebuggerStatement,
 * 		KindDoStatement,
 * 		KindExpressionStatement,
 * 		KindEmptyStatement,
 * 		KindForInStatement,
 * 		KindForOfStatement,
 * 		KindForStatement,
 * 		KindIfStatement,
 * 		KindLabeledStatement,
 * 		KindReturnStatement,
 * 		KindSwitchStatement,
 * 		KindThrowStatement,
 * 		KindTryStatement,
 * 		KindVariableStatement,
 * 		KindWhileStatement,
 * 		KindWithStatement,
 * 		KindNotEmittedStatement:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function isStatementKindButNotDeclarationKind(kind: Kind): bool {
  switch (kind) {
    case KindBreakStatement:
    case KindContinueStatement:
    case KindDebuggerStatement:
    case KindDoStatement:
    case KindExpressionStatement:
    case KindEmptyStatement:
    case KindForInStatement:
    case KindForOfStatement:
    case KindForStatement:
    case KindIfStatement:
    case KindLabeledStatement:
    case KindReturnStatement:
    case KindSwitchStatement:
    case KindThrowStatement:
    case KindTryStatement:
    case KindVariableStatement:
    case KindWhileStatement:
    case KindWithStatement:
    case KindNotEmittedStatement:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsStatementButNotDeclaration","kind":"func","status":"implemented","sigHash":"8e1b5858e82a299fb464055ade7b098559817dd0e98bb6f4ac71049c14b308ae","bodyHash":"457ce28ba91dc5f79bd3ab62443d54c588897bb391c4414377c3bff81b9a4725"}
 *
 * Go source:
 * func IsStatementButNotDeclaration(node *Node) bool {
 * 	return isStatementKindButNotDeclarationKind(node.Kind)
 * }
 */
export function IsStatementButNotDeclaration(node: GoPtr<Node>): bool {
  return isStatementKindButNotDeclarationKind(node!.Kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsStatement","kind":"func","status":"implemented","sigHash":"e9f83f995a5b7aab90224ead9cc537370b3e56297012a41fda0c4406abc79465","bodyHash":"a10d58f2b702d60851296b12e30edfeea635d4028438271bb11f966942aa2286"}
 *
 * Go source:
 * func IsStatement(node *Node) bool {
 * 	kind := node.Kind
 * 	return isStatementKindButNotDeclarationKind(kind) || isDeclarationStatementKind(kind) || isBlockStatement(node)
 * }
 */
export function IsStatement(node: GoPtr<Node>): bool {
  const kind = node!.Kind;
  return (isStatementKindButNotDeclarationKind(kind) || isDeclarationStatementKind(kind) ||
    isBlockStatement(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isBlockStatement","kind":"func","status":"implemented","sigHash":"da26998348f7ccacee5d9b116c7a963085056db97e357f6294cc836f9ffb162f","bodyHash":"4a89d3efb218692c79045cc4b668846d23a95c26902d92130ee6ecc7d8da4bf5"}
 *
 * Go source:
 * func isBlockStatement(node *Node) bool {
 * 	if node.Kind != KindBlock {
 * 		return false
 * 	}
 * 	if node.Parent != nil && (node.Parent.Kind == KindTryStatement || node.Parent.Kind == KindCatchClause) {
 * 		return false
 * 	}
 * 	return !IsFunctionBlock(node)
 * }
 */
export function isBlockStatement(node: GoPtr<Node>): bool {
  if (node!.Kind !== KindBlock) {
    return false as bool;
  }
  if (node!.Parent !== undefined &&
    (node!.Parent!.Kind === KindTryStatement || node!.Parent!.Kind === KindCatchClause)) {
    return false as bool;
  }
  return !IsFunctionBlock(node) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsFunctionBlock","kind":"func","status":"implemented","sigHash":"7cb626a2615c607154af44550a350c46b44a25a560027b15f390e518052c967f","bodyHash":"a74312d1c981382e10f83b7422eb246b646f02ee669ce936b3a7d1a984bdecc0"}
 *
 * Go source:
 * func IsFunctionBlock(node *Node) bool {
 * 	return node != nil && node.Kind == KindBlock && node.Parent != nil && IsFunctionLike(node.Parent)
 * }
 */
export function IsFunctionBlock(node: GoPtr<Node>): bool {
  return (node !== undefined && node!.Kind === KindBlock && node!.Parent !== undefined &&
    IsFunctionLike(node!.Parent)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsBlockOrCatchScoped","kind":"func","status":"implemented","sigHash":"0fe3f76ba794bed6f7bbe870e45ba8dbf1204d877705bcfea0fd27c23cdca673","bodyHash":"7b9b660853e715d1f9594eead870cb8f33222acc525d374e6646692bb866840b"}
 *
 * Go source:
 * func IsBlockOrCatchScoped(declaration *Node) bool {
 * 	return GetCombinedNodeFlags(declaration)&NodeFlagsBlockScoped != 0 || IsCatchClauseVariableDeclarationOrBindingElement(declaration)
 * }
 */
export function IsBlockOrCatchScoped(declaration: GoPtr<Node>): bool {
  return ((GetCombinedNodeFlags(declaration) & NodeFlagsBlockScoped) !== 0 ||
    IsCatchClauseVariableDeclarationOrBindingElement(declaration)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsCatchClauseVariableDeclarationOrBindingElement","kind":"func","status":"implemented","sigHash":"029269b3a32bf1b13e117d1443abcde3a2efaadce482dddb7b6f98c45b101c03","bodyHash":"ec5c6ee72d25fa35ee97fbc5cd9102b3afb6b650326ed10d8f6eeecb00532a0e"}
 *
 * Go source:
 * func IsCatchClauseVariableDeclarationOrBindingElement(declaration *Node) bool {
 * 	node := GetRootDeclaration(declaration)
 * 	return node.Kind == KindVariableDeclaration && node.Parent.Kind == KindCatchClause
 * }
 */
export function IsCatchClauseVariableDeclarationOrBindingElement(declaration: GoPtr<Node>): bool {
  const node: GoPtr<Node> = GetRootDeclaration(declaration);
  return (node!.Kind === KindVariableDeclaration && node!.Parent!.Kind === KindCatchClause) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsTypeNodeKind","kind":"func","status":"implemented","sigHash":"df43e9772256427f66781315bc4df1544c3c550b5b41f9a5247407cb108e3cb0","bodyHash":"7bc99667b7a533ed75b624c603d05edb8a25f6c54ec3dd3384f5c835847356a0"}
 *
 * Go source:
 * func IsTypeNodeKind(kind Kind) bool {
 * 	switch kind {
 * 	case KindAnyKeyword,
 * 		KindUnknownKeyword,
 * 		KindNumberKeyword,
 * 		KindBigIntKeyword,
 * 		KindObjectKeyword,
 * 		KindBooleanKeyword,
 * 		KindStringKeyword,
 * 		KindSymbolKeyword,
 * 		KindVoidKeyword,
 * 		KindUndefinedKeyword,
 * 		KindNeverKeyword,
 * 		KindIntrinsicKeyword,
 * 		KindExpressionWithTypeArguments,
 * 		KindJSDocAllType,
 * 		KindJSDocNullableType,
 * 		KindJSDocNonNullableType,
 * 		KindJSDocOptionalType,
 * 		KindJSDocVariadicType:
 * 		return true
 * 	}
 * 	return kind >= KindFirstTypeNode && kind <= KindLastTypeNode
 * }
 */
export function IsTypeNodeKind(kind: Kind): bool {
  switch (kind) {
    case KindAnyKeyword:
    case KindUnknownKeyword:
    case KindNumberKeyword:
    case KindBigIntKeyword:
    case KindObjectKeyword:
    case KindBooleanKeyword:
    case KindStringKeyword:
    case KindSymbolKeyword:
    case KindVoidKeyword:
    case KindUndefinedKeyword:
    case KindNeverKeyword:
    case KindIntrinsicKeyword:
    case KindExpressionWithTypeArguments:
    case KindJSDocAllType:
    case KindJSDocNullableType:
    case KindJSDocNonNullableType:
    case KindJSDocOptionalType:
    case KindJSDocVariadicType:
      return true as bool;
  }
  return (kind >= KindFirstTypeNode && kind <= KindLastTypeNode) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsTypeNode","kind":"func","status":"implemented","sigHash":"1d7a527f2fa8a8b09beded063f142c060ded461a3c38ad296f5cae6608016870","bodyHash":"8b3a93310748bd85b69064da6673821faa78f7e4b8e7411156f0df8507ba814c"}
 *
 * Go source:
 * func IsTypeNode(node *Node) bool {
 * 	return IsTypeNodeKind(node.Kind)
 * }
 */
export function IsTypeNode(node: GoPtr<Node>): bool {
  return IsTypeNodeKind(node!.Kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJSDocKind","kind":"func","status":"implemented","sigHash":"470168af767793f573c8a5b61da3a06289899d1f792c6ad779b7fcb161733276","bodyHash":"08e12df290fb8a2715d44ee47d4fd5db78a1a1d0d543c3a4042fa7ce00a1d75e"}
 *
 * Go source:
 * func IsJSDocKind(kind Kind) bool {
 * 	return KindFirstJSDocNode <= kind && kind <= KindLastJSDocNode
 * }
 */
export function IsJSDocKind(kind: Kind): bool {
  return (KindFirstJSDocNode <= kind && kind <= KindLastJSDocNode) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJSDocTypeAssertion","kind":"func","status":"implemented","sigHash":"de8e6b4e77c1bbb2575a4a05734835571f0334a0f23b0c64d14abc7bf5ff0be6","bodyHash":"cee226fdf27e8d53220463253d6aa0545e19870909e2c1d45cf298aee547ca4e"}
 *
 * Go source:
 * func IsJSDocTypeAssertion(node *Node) bool {
 * 	if node == nil || !IsParenthesizedExpression(node) || !IsInJSFile(node) {
 * 		return false
 * 	}
 * 	expr := node.Expression()
 * 	return IsAsExpression(expr) && expr.Type() != nil && expr.Type().Flags&NodeFlagsReparsed != 0
 * }
 */
export function IsJSDocTypeAssertion(node: GoPtr<Node>): bool {
  if (node === undefined || !IsParenthesizedExpression(node) || !IsInJSFile(node)) {
    return false as bool;
  }
  const expr: GoPtr<Node> = Node_Expression(node);
  return (IsAsExpression(expr) && Node_Type(expr) !== undefined &&
    (Node_Type(expr)!.Flags & NodeFlagsReparsed) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPrologueDirective","kind":"func","status":"implemented","sigHash":"9f61c3a9832016f528875d09ab9894d7cbb093b72d9724be6be0dbd08bc8a585","bodyHash":"f56a0634d4b29827f29f1a7416f82498f31b5f7603427a3ee200b84e46296789"}
 *
 * Go source:
 * func IsPrologueDirective(node *Node) bool {
 * 	return node.Kind == KindExpressionStatement &&
 * 		node.Expression().Kind == KindStringLiteral
 * }
 */
export function IsPrologueDirective(node: GoPtr<Node>): bool {
  return (node!.Kind === KindExpressionStatement &&
    Node_Expression(node)!.Kind === KindStringLiteral) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::type::OuterExpressionKinds","kind":"type","status":"implemented","sigHash":"be6ac37a4b9ed0b36f3f1c1e090fa78b0a36ff9ad1989b831d1a4d5b27541f5f","bodyHash":"3dcb015ebd8d8cd234a7f4403b86e45ba8b55a4b4191a74f02f81e64663247a2"}
 *
 * Go source:
 * OuterExpressionKinds int16
 */
export type OuterExpressionKinds = short;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::constGroup::OEKParentheses+OEKTypeAssertions+OEKNonNullAssertions+OEKPartiallyEmittedExpressions+OEKExpressionsWithTypeArguments+OEKSatisfies+OEKExcludeJSDocTypeAssertion+OEKAssertions+OEKAll","kind":"constGroup","status":"implemented","sigHash":"84f9676886cf84a36a3e37e3b0fba08797c926f7eae90b57b089ba15bc3e539e","bodyHash":"ebf57acd4d5ff861de1a8a446f3a91e9a7493bd39ace1dd57df9194cde9756c9"}
 *
 * Go source:
 * const (
 * 	OEKParentheses                  OuterExpressionKinds = 1 << 0
 * 	OEKTypeAssertions               OuterExpressionKinds = 1 << 1
 * 	OEKNonNullAssertions            OuterExpressionKinds = 1 << 2
 * 	OEKPartiallyEmittedExpressions  OuterExpressionKinds = 1 << 3
 * 	OEKExpressionsWithTypeArguments OuterExpressionKinds = 1 << 4
 * 	OEKSatisfies                    OuterExpressionKinds = 1 << 5
 * 	OEKExcludeJSDocTypeAssertion                         = 1 << 6
 * 	OEKAssertions                                        = OEKTypeAssertions | OEKNonNullAssertions | OEKSatisfies
 * 	OEKAll                                               = OEKParentheses | OEKAssertions | OEKPartiallyEmittedExpressions | OEKExpressionsWithTypeArguments
 * )
 */
export const OEKParentheses: OuterExpressionKinds = (1 << 0) as OuterExpressionKinds;
export const OEKTypeAssertions: OuterExpressionKinds = (1 << 1) as OuterExpressionKinds;
export const OEKNonNullAssertions: OuterExpressionKinds = (1 << 2) as OuterExpressionKinds;
export const OEKPartiallyEmittedExpressions: OuterExpressionKinds = (1 << 3) as OuterExpressionKinds;
export const OEKExpressionsWithTypeArguments: OuterExpressionKinds = (1 << 4) as OuterExpressionKinds;
export const OEKSatisfies: OuterExpressionKinds = (1 << 5) as OuterExpressionKinds;
export const OEKExcludeJSDocTypeAssertion: int = (1 << 6) as int;
export const OEKAssertions: int = (OEKTypeAssertions | OEKNonNullAssertions | OEKSatisfies) as int;
export const OEKAll: int = (OEKParentheses | OEKAssertions | OEKPartiallyEmittedExpressions | OEKExpressionsWithTypeArguments) as int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsOuterExpression","kind":"func","status":"implemented","sigHash":"28b42343fb8505a97d8f6a58ddb129a754951cd4660b560ebc97695d5ae2808b","bodyHash":"a22d786b0e208217f92f631828167a00f8b78e1a87677e5adc8650fad2a9a24f"}
 *
 * Go source:
 * func IsOuterExpression(node *Expression, kinds OuterExpressionKinds) bool {
 * 	switch node.Kind {
 * 	case KindParenthesizedExpression:
 * 		return kinds&OEKParentheses != 0 && !(kinds&OEKExcludeJSDocTypeAssertion != 0 && IsJSDocTypeAssertion(node))
 * 	case KindTypeAssertionExpression, KindAsExpression:
 * 		return kinds&OEKTypeAssertions != 0
 * 	case KindSatisfiesExpression:
 * 		return kinds&(OEKExpressionsWithTypeArguments|OEKSatisfies) != 0
 * 	case KindExpressionWithTypeArguments:
 * 		return kinds&OEKExpressionsWithTypeArguments != 0
 * 	case KindNonNullExpression:
 * 		return kinds&OEKNonNullAssertions != 0
 * 	case KindPartiallyEmittedExpression:
 * 		return kinds&OEKPartiallyEmittedExpressions != 0
 * 	}
 * 	return false
 * }
 */
export function IsOuterExpression(node: GoPtr<Expression>, kinds: OuterExpressionKinds): bool {
  switch (node!.Kind) {
    case KindParenthesizedExpression:
      return ((kinds & OEKParentheses) !== 0 &&
        !((kinds & OEKExcludeJSDocTypeAssertion) !== 0 && IsJSDocTypeAssertion(node))) as bool;
    case KindTypeAssertionExpression:
    case KindAsExpression:
      return ((kinds & OEKTypeAssertions) !== 0) as bool;
    case KindSatisfiesExpression:
      return ((kinds & (OEKExpressionsWithTypeArguments | OEKSatisfies)) !== 0) as bool;
    case KindExpressionWithTypeArguments:
      return ((kinds & OEKExpressionsWithTypeArguments) !== 0) as bool;
    case KindNonNullExpression:
      return ((kinds & OEKNonNullAssertions) !== 0) as bool;
    case KindPartiallyEmittedExpression:
      return ((kinds & OEKPartiallyEmittedExpressions) !== 0) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::SkipOuterExpressions","kind":"func","status":"implemented","sigHash":"a8cd8291154f79b9cd6f1463229677f2fcbb04860a886c86a2fb9f89fba3c386","bodyHash":"d5e0a79382af81594cd5bb544abac30bab768b96399dc6d71e773946d1c9a49e"}
 *
 * Go source:
 * func SkipOuterExpressions(node *Expression, kinds OuterExpressionKinds) *Expression {
 * 	for IsOuterExpression(node, kinds) {
 * 		node = node.Expression()
 * 	}
 * 	return node
 * }
 */
export function SkipOuterExpressions(node: GoPtr<Expression>, kinds: OuterExpressionKinds): GoPtr<Expression> {
  const loop = (current: GoPtr<Expression>): GoPtr<Expression> => {
    if (!IsOuterExpression(current, kinds)) return current;
    return loop(Node_Expression(current));
  };
  return loop(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::SkipParentheses","kind":"func","status":"implemented","sigHash":"03e90efa385138c356cb91b2e6d394dbd9a6ef633690404c10f3058a54225c41","bodyHash":"487390cda4c067c144d7c224f34c99b25d6a23d48ebc75ae130305975aebb05c"}
 *
 * Go source:
 * func SkipParentheses(node *Expression) *Expression {
 * 	return SkipOuterExpressions(node, OEKParentheses)
 * }
 */
export function SkipParentheses(node: GoPtr<Expression>): GoPtr<Expression> {
  return SkipOuterExpressions(node, OEKParentheses);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::SkipTypeParentheses","kind":"func","status":"implemented","sigHash":"ea395dfe48a8bca470b254a0c43f971261dc69ad302c83fbb8cd4ddaa5ab384d","bodyHash":"b8bd79f8bc47de2c9bad75d68f78d39d87e651e59f53e187265b88b0cdb4f4cc"}
 *
 * Go source:
 * func SkipTypeParentheses(node *Node) *Node {
 * 	for IsParenthesizedTypeNode(node) {
 * 		node = node.Type()
 * 	}
 * 	return node
 * }
 */
export function SkipTypeParentheses(node: GoPtr<Node>): GoPtr<Node> {
  const loop = (current: GoPtr<Node>): GoPtr<Node> => {
    if (!IsParenthesizedTypeNode(current)) return current;
    return loop(Node_Type(current));
  };
  return loop(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::SkipPartiallyEmittedExpressions","kind":"func","status":"implemented","sigHash":"0a477e8abb59c269d30a1d5055e59da0aa30bf3e0766409ba86a53606be65bb6","bodyHash":"51e5dd331fe4a819a097878b9937e087a57024d05645cf8e9445f757ae92b96c"}
 *
 * Go source:
 * func SkipPartiallyEmittedExpressions(node *Expression) *Expression {
 * 	return SkipOuterExpressions(node, OEKPartiallyEmittedExpressions)
 * }
 */
export function SkipPartiallyEmittedExpressions(node: GoPtr<Expression>): GoPtr<Expression> {
  return SkipOuterExpressions(node, OEKPartiallyEmittedExpressions);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::WalkUpParenthesizedExpressions","kind":"func","status":"implemented","sigHash":"257313baece29940eedcbf0a8e49fca3eb1d3736e299c3227325d433e2fa5f67","bodyHash":"ae28d3b24cf5a80c5b30d101b35835943212fb1f9821ad8cdedb26c16614cb6a"}
 *
 * Go source:
 * func WalkUpParenthesizedExpressions(node *Expression) *Node {
 * 	for node != nil && node.Kind == KindParenthesizedExpression {
 * 		node = node.Parent
 * 	}
 * 	return node
 * }
 */
export function WalkUpParenthesizedExpressions(node: GoPtr<Expression>): GoPtr<Node> {
  const loop = (current: GoPtr<Node>): GoPtr<Node> => {
    if (current === undefined || current!.Kind !== KindParenthesizedExpression) return current;
    return loop(current!.Parent);
  };
  return loop(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::WalkUpParenthesizedTypes","kind":"func","status":"implemented","sigHash":"3ea8b8743d7a0e5cd653f6c959f8877bc7125fec092d05860f75b781a52bfb89","bodyHash":"8c41fab30abce5884c6e57f6d247c96d5b6666eb107d880bedb2bab627a61174"}
 *
 * Go source:
 * func WalkUpParenthesizedTypes(node *TypeNode) *Node {
 * 	for node != nil && node.Kind == KindParenthesizedType {
 * 		node = node.Parent
 * 	}
 * 	return node
 * }
 */
export function WalkUpParenthesizedTypes(node: GoPtr<TypeNode>): GoPtr<Node> {
  const loop = (current: GoPtr<Node>): GoPtr<Node> => {
    if (current === undefined || current!.Kind !== KindParenthesizedType) return current;
    return loop(current!.Parent);
  };
  return loop(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetSourceFileOfNode","kind":"func","status":"implemented","sigHash":"c08c22c988a6f37f6a16f53ec595db6a952847817c10df620b3be20a5ed3969e","bodyHash":"aebb5774c6321c7c3f46fea19bf8f9f98bbceb82c987e7cf0a4db9fe0a45bf7d"}
 *
 * Go source:
 * func GetSourceFileOfNode(node *Node) *SourceFile {
 * 	for node != nil {
 * 		if node.Kind == KindSourceFile {
 * 			return node.AsSourceFile()
 * 		}
 * 		node = node.Parent
 * 	}
 * 	return nil
 * }
 */
export function GetSourceFileOfNode(node: GoPtr<Node>): GoPtr<SourceFile> {
  const loop = (current: GoPtr<Node>): GoPtr<SourceFile> => {
    if (current === undefined) return undefined;
    if (current!.Kind === KindSourceFile) return AsSourceFile(current);
    return loop(current!.Parent);
  };
  return loop(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::varGroup::setParentInChildrenPool","kind":"varGroup","status":"implemented","sigHash":"ae451dac263fcd49a052fbaaa91c461d227f7ab108efd244750e66b475cd12be","bodyHash":"10ec3135e70425ace0e1321700abd0e4a2d549977d7e18cb9f2fb6b7acd151fc"}
 *
 * Go source:
 * var setParentInChildrenPool = sync.Pool{
 * 	New: func() any {
 * 		return newParentInChildrenSetter()
 * 	},
 * }
 */
export const setParentInChildrenPool: Pool<(node: GoPtr<Node>) => bool> = ((): Pool<(node: GoPtr<Node>) => bool> => {
  const pool = new PoolValue<(node: GoPtr<Node>) => bool>();
  pool.New = (): ((node: GoPtr<Node>) => bool) => {
    return newParentInChildrenSetter();
  };
  return pool;
})();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::newParentInChildrenSetter","kind":"func","status":"implemented","sigHash":"eba2dd47048272bfcef58ddc2cba1a38a2d8ffc2d3ca3020222146e7836a903c","bodyHash":"903a93fedb017a1bdf91490a0ef950f21268a492fdd59e8a9bf62d0793c92b06"}
 *
 * Go source:
 * func newParentInChildrenSetter() func(node *Node) bool {
 * 	// Consolidate state into one allocation.
 * 	// Similar to https://go.dev/cl/552375.
 * 	var state struct {
 * 		parent *Node
 * 		visit  func(*Node) bool
 * 	}
 * 
 * 	state.visit = func(node *Node) bool {
 * 		if state.parent != nil {
 * 			node.Parent = state.parent
 * 		}
 * 		saveParent := state.parent
 * 		state.parent = node
 * 		node.ForEachChild(state.visit)
 * 		state.parent = saveParent
 * 		return false
 * 	}
 * 
 * 	return state.visit
 * }
 */
export function newParentInChildrenSetter(): (node: GoPtr<Node>) => bool {
  // Consolidate state into one allocation.
  // Similar to https://go.dev/cl/552375.
  const state: { parent: GoPtr<Node>; visit: ((node: GoPtr<Node>) => bool) | undefined } = {
    parent: undefined,
    visit: undefined,
  };

  state.visit = (node: GoPtr<Node>): bool => {
    if (state.parent !== undefined) {
      node!.Parent = state.parent;
    }
    const saveParent: GoPtr<Node> = state.parent;
    state.parent = node;
    Node_ForEachChild(node, state.visit!);
    state.parent = saveParent;
    return false as bool;
  };

  return state.visit;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::SetParentInChildren","kind":"func","status":"implemented","sigHash":"a3361f13b592f17dd6b5ec690fff1d4c5b0f9d0c5e3dcc1610e14178cc624119","bodyHash":"13e338cba2afb10b9780f62fc58a77868a5f972ca331f00e584442c8e18c717e"}
 *
 * Go source:
 * func SetParentInChildren(node *Node) {
 * 	fn := setParentInChildrenPool.Get().(func(node *Node) bool)
 * 	defer setParentInChildrenPool.Put(fn)
 * 	fn(node)
 * }
 */
export function SetParentInChildren(node: GoPtr<Node>): void {
  const fn = setParentInChildrenPool.Get() as (node: GoPtr<Node>) => bool;
  try {
    fn(node);
  } finally {
    setParentInChildrenPool.Put(fn);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::SetImportsOfSourceFile","kind":"func","status":"implemented","sigHash":"df9759c59e9d3235cefcb1ae87da77bcc73d6ca9bd98ce6a9a29ddcd8c128afe","bodyHash":"e14296b9c2fe8a6144d654643c43f22db72afd5c47d1eefa8a120c51f8ea49af"}
 *
 * Go source:
 * func SetImportsOfSourceFile(node *SourceFile, imports []*LiteralLikeNode) {
 * 	node.imports = imports
 * }
 */
export function SetImportsOfSourceFile(node: GoPtr<SourceFile>, imports: GoSlice<GoPtr<LiteralLikeNode>>): void {
  node!.imports = imports;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::FindAncestor","kind":"func","status":"implemented","sigHash":"719a8c257cc4153dd2e0b502bfb83a4eec50e15ddad63a2681df7270fa81e12b","bodyHash":"b715e501df725ad290fc7479908cad2ce888c9f336f25165b99c9db73bc4bff9"}
 *
 * Go source:
 * func FindAncestor(node *Node, callback func(*Node) bool) *Node {
 * 	for node != nil {
 * 		if callback(node) {
 * 			return node
 * 		}
 * 		node = node.Parent
 * 	}
 * 	return nil
 * }
 */
export function FindAncestor(node: GoPtr<Node>, callback: (arg0: GoPtr<Node>) => bool): GoPtr<Node> {
  for (let current = node; current !== undefined; current = current!.Parent) {
    if (callback(current)) {
      return current;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::FindAncestorKind","kind":"func","status":"implemented","sigHash":"2832a659a617cd5aa9b27711a72307fec4d51d6c078c75cadb1aebae481b7c39","bodyHash":"e4d66df5b889e335e07426ed86e8eefb8f684af259e713917c7be2dbbdedbbd4"}
 *
 * Go source:
 * func FindAncestorKind(node *Node, kind Kind) *Node {
 * 	for node != nil {
 * 		if node.Kind == kind {
 * 			return node
 * 		}
 * 		node = node.Parent
 * 	}
 * 	return nil
 * }
 */
export function FindAncestorKind(node: GoPtr<Node>, kind: Kind): GoPtr<Node> {
  for (let current = node; current !== undefined; current = current!.Parent) {
    if (current!.Kind === kind) {
      return current;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::type::FindAncestorResult","kind":"type","status":"implemented","sigHash":"16cc407ee3792506d820fe7e6c57d522691f65c41213cf6d4ff5c95cb276ec6a","bodyHash":"67d16ad2dbe7e1d6dec82ab0018aa671e37eb64afe37577a53c22d8defbbc0e5"}
 *
 * Go source:
 * FindAncestorResult int32
 */
export type FindAncestorResult = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::constGroup::FindAncestorFalse+FindAncestorTrue+FindAncestorQuit","kind":"constGroup","status":"implemented","sigHash":"0d96e037b3a4279eb665d2e3ed1e3e50c88a70b97e010c9ef3da07fa37f3a81b","bodyHash":"9055a5920fa850f4cef04b562abb05592ba1f3c70d5ef3dffcd32401e97ecebc"}
 *
 * Go source:
 * const (
 * 	FindAncestorFalse FindAncestorResult = iota
 * 	FindAncestorTrue
 * 	FindAncestorQuit
 * )
 */
export const FindAncestorFalse: FindAncestorResult = 0 as FindAncestorResult;
export const FindAncestorTrue: FindAncestorResult = 1 as FindAncestorResult;
export const FindAncestorQuit: FindAncestorResult = 2 as FindAncestorResult;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::ToFindAncestorResult","kind":"func","status":"implemented","sigHash":"a5927ecc0638497719c45c4def6621b223ba366a7043b097f47a9edf6542c3ec","bodyHash":"75baa8aaad0728d057365259c6cc4f3f9a590b2d3164c438f69538bba9e25cf3"}
 *
 * Go source:
 * func ToFindAncestorResult(b bool) FindAncestorResult {
 * 	if b {
 * 		return FindAncestorTrue
 * 	}
 * 	return FindAncestorFalse
 * }
 */
export function ToFindAncestorResult(b: bool): FindAncestorResult {
  if (b) {
    return FindAncestorTrue;
  }
  return FindAncestorFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::FindAncestorOrQuit","kind":"func","status":"implemented","sigHash":"9cc5c3cf8c24b28a53c374b83e277ba73b617271765b3579f02d159d93f8f5b5","bodyHash":"d84db298ae61c5b0e8fa763a3077b4289375652fb1e8283c4a6d7d1ac422c58e"}
 *
 * Go source:
 * func FindAncestorOrQuit(node *Node, callback func(*Node) FindAncestorResult) *Node {
 * 	for node != nil {
 * 		switch callback(node) {
 * 		case FindAncestorQuit:
 * 			return nil
 * 		case FindAncestorTrue:
 * 			return node
 * 		}
 * 		node = node.Parent
 * 	}
 * 	return nil
 * }
 */
export function FindAncestorOrQuit(node: GoPtr<Node>, callback: (arg0: GoPtr<Node>) => FindAncestorResult): GoPtr<Node> {
  for (let current = node; current !== undefined; current = current!.Parent) {
    switch (callback(current)) {
      case FindAncestorQuit:
        return undefined;
      case FindAncestorTrue:
        return current;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsNodeDescendantOf","kind":"func","status":"implemented","sigHash":"ab859604c4a9e359f216f74293ab7859076be289722cb9fd9af4be3718ed1171","bodyHash":"d8d0ebca90555bc8f81d8d879acd95d5e9d2b11c92adec424cebdff12f332b47"}
 *
 * Go source:
 * func IsNodeDescendantOf(node *Node, ancestor *Node) bool {
 * 	for node != nil {
 * 		if node == ancestor {
 * 			return true
 * 		}
 * 		node = node.Parent
 * 	}
 * 	return false
 * }
 */
export function IsNodeDescendantOf(node: GoPtr<Node>, ancestor: GoPtr<Node>): bool {
  const loop = (current: GoPtr<Node>): bool => {
    if (current === undefined) return false as bool;
    if (current === ancestor) return true as bool;
    return loop(current!.Parent);
  };
  return loop(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasSyntacticModifier","kind":"func","status":"implemented","sigHash":"fb84cd1682b98907585e52cfd0c402a98cdb042732f9109baa7b9f9771529804","bodyHash":"bfbf0a7749750c05d987851f968d7f237d353398517aaf7c169dc5494a514bde"}
 *
 * Go source:
 * func HasSyntacticModifier(node *Node, flags ModifierFlags) bool {
 * 	return node.ModifierFlags()&flags != 0
 * }
 */
export function HasSyntacticModifier(node: GoPtr<Node>, flags: ModifierFlags): bool {
  return ((Node_ModifierFlags(node) & flags) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasAccessorModifier","kind":"func","status":"implemented","sigHash":"04909ad12f8230d2c1156b2d2e0639a0a50fa5aa5a94d0527da4a1192486e7f6","bodyHash":"ad63bc416635c5faa7229f9c40d891ab62b899420b391c1bf7d507d09c96594e"}
 *
 * Go source:
 * func HasAccessorModifier(node *Node) bool {
 * 	return HasSyntacticModifier(node, ModifierFlagsAccessor)
 * }
 */
export function HasAccessorModifier(node: GoPtr<Node>): bool {
  return HasSyntacticModifier(node, ModifierFlagsAccessor);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasStaticModifier","kind":"func","status":"implemented","sigHash":"88f7df6d3b6cd92bc359041791eb54965abf4f0c9c0081100b195b2d0054744c","bodyHash":"e57dcfbbf76bae989631dd00c56c29f221ed8be986033a4ca91d3e5167ab2dd7"}
 *
 * Go source:
 * func HasStaticModifier(node *Node) bool {
 * 	return HasSyntacticModifier(node, ModifierFlagsStatic)
 * }
 */
export function HasStaticModifier(node: GoPtr<Node>): bool {
  return HasSyntacticModifier(node, ModifierFlagsStatic);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsStatic","kind":"func","status":"implemented","sigHash":"efae789af8abd573ddceb5d717aacd305351716ad987aee78157ee06fdeeab69","bodyHash":"0cd06d8082207c26e8255d75e406a99f378ee701987907d96984343e7f5ec4e0"}
 *
 * Go source:
 * func IsStatic(node *Node) bool {
 * 	// https://tc39.es/ecma262/#sec-static-semantics-isstatic
 * 	return IsClassElement(node) && HasStaticModifier(node) || IsClassStaticBlockDeclaration(node)
 * }
 */
export function IsStatic(node: GoPtr<Node>): bool {
  // https://tc39.es/ecma262/#sec-static-semantics-isstatic
  return ((IsClassElement(node) && HasStaticModifier(node)) || IsClassStaticBlockDeclaration(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::CanHaveSymbol","kind":"func","status":"implemented","sigHash":"e03ecb0688ec02ebbb534744bea47d089512e7e312a7f7dbbb2ffe7453cb1750","bodyHash":"79c825310ccc8b80fa400f2d6a8d7dba8f5b44eafac430afd25c1681508e2e7c"}
 *
 * Go source:
 * func CanHaveSymbol(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindArrowFunction, KindBinaryExpression, KindBindingElement, KindCallExpression, KindCallSignature,
 * 		KindClassDeclaration, KindClassExpression, KindClassStaticBlockDeclaration, KindConstructor, KindConstructorType,
 * 		KindConstructSignature, KindElementAccessExpression, KindEnumDeclaration, KindEnumMember, KindExportAssignment,
 * 		KindExportDeclaration, KindExportSpecifier, KindFunctionDeclaration, KindFunctionExpression, KindFunctionType,
 * 		KindGetAccessor, KindImportClause, KindImportEqualsDeclaration, KindImportSpecifier, KindIndexSignature,
 * 		KindInterfaceDeclaration, KindJSTypeAliasDeclaration,
 * 		KindJsxAttribute, KindJsxAttributes, KindJsxSpreadAttribute, KindMappedType, KindMethodDeclaration,
 * 		KindMethodSignature, KindModuleDeclaration, KindNamedTupleMember, KindNamespaceExport, KindNamespaceExportDeclaration,
 * 		KindNamespaceImport, KindNewExpression, KindNoSubstitutionTemplateLiteral, KindNumericLiteral, KindObjectLiteralExpression,
 * 		KindParameter, KindPropertyAccessExpression, KindPropertyAssignment, KindPropertyDeclaration, KindPropertySignature,
 * 		KindSetAccessor, KindShorthandPropertyAssignment, KindSourceFile, KindSpreadAssignment, KindStringLiteral,
 * 		KindTypeAliasDeclaration, KindTypeLiteral, KindTypeParameter, KindVariableDeclaration:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function CanHaveSymbol(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindArrowFunction:
    case KindBinaryExpression:
    case KindBindingElement:
    case KindCallExpression:
    case KindCallSignature:
    case KindClassDeclaration:
    case KindClassExpression:
    case KindClassStaticBlockDeclaration:
    case KindConstructor:
    case KindConstructorType:
    case KindConstructSignature:
    case KindElementAccessExpression:
    case KindEnumDeclaration:
    case KindEnumMember:
    case KindExportAssignment:
    case KindExportDeclaration:
    case KindExportSpecifier:
    case KindFunctionDeclaration:
    case KindFunctionExpression:
    case KindFunctionType:
    case KindGetAccessor:
    case KindImportClause:
    case KindImportEqualsDeclaration:
    case KindImportSpecifier:
    case KindIndexSignature:
    case KindInterfaceDeclaration:
    case KindJSTypeAliasDeclaration:
    case KindJsxAttribute:
    case KindJsxAttributes:
    case KindJsxSpreadAttribute:
    case KindMappedType:
    case KindMethodDeclaration:
    case KindMethodSignature:
    case KindModuleDeclaration:
    case KindNamedTupleMember:
    case KindNamespaceExport:
    case KindNamespaceExportDeclaration:
    case KindNamespaceImport:
    case KindNewExpression:
    case KindNoSubstitutionTemplateLiteral:
    case KindNumericLiteral:
    case KindObjectLiteralExpression:
    case KindParameter:
    case KindPropertyAccessExpression:
    case KindPropertyAssignment:
    case KindPropertyDeclaration:
    case KindPropertySignature:
    case KindSetAccessor:
    case KindShorthandPropertyAssignment:
    case KindSourceFile:
    case KindSpreadAssignment:
    case KindStringLiteral:
    case KindTypeAliasDeclaration:
    case KindTypeLiteral:
    case KindTypeParameter:
    case KindVariableDeclaration:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::CanHaveIllegalDecorators","kind":"func","status":"implemented","sigHash":"c3bd9e86cbb1b2ede97320ca11238f386c593bbc1852e46aeb6ef37603aa4301","bodyHash":"dbbe92ace5ed2502f9d0783947296fbfb020f18c3720f081460c876cbb07b903"}
 *
 * Go source:
 * func CanHaveIllegalDecorators(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindPropertyAssignment, KindShorthandPropertyAssignment,
 * 		KindFunctionDeclaration, KindConstructor,
 * 		KindIndexSignature, KindClassStaticBlockDeclaration,
 * 		KindMissingDeclaration, KindVariableStatement,
 * 		KindInterfaceDeclaration, KindTypeAliasDeclaration,
 * 		KindEnumDeclaration, KindModuleDeclaration,
 * 		KindImportEqualsDeclaration, KindImportDeclaration, KindJSImportDeclaration,
 * 		KindNamespaceExportDeclaration, KindExportDeclaration,
 * 		KindExportAssignment:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function CanHaveIllegalDecorators(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindPropertyAssignment:
    case KindShorthandPropertyAssignment:
    case KindFunctionDeclaration:
    case KindConstructor:
    case KindIndexSignature:
    case KindClassStaticBlockDeclaration:
    case KindMissingDeclaration:
    case KindVariableStatement:
    case KindInterfaceDeclaration:
    case KindTypeAliasDeclaration:
    case KindEnumDeclaration:
    case KindModuleDeclaration:
    case KindImportEqualsDeclaration:
    case KindImportDeclaration:
    case KindJSImportDeclaration:
    case KindNamespaceExportDeclaration:
    case KindExportDeclaration:
    case KindExportAssignment:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::CanHaveIllegalModifiers","kind":"func","status":"implemented","sigHash":"fc082936ba348bc62c2ff27e4b320aa5fee9cba1ab40b70c546f17a9d0704fba","bodyHash":"914167d83b388860d658574aa73db93ae16e7d1f642d4028db096fa912c2e396"}
 *
 * Go source:
 * func CanHaveIllegalModifiers(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindClassStaticBlockDeclaration,
 * 		KindPropertyAssignment,
 * 		KindShorthandPropertyAssignment,
 * 		KindMissingDeclaration,
 * 		KindNamespaceExportDeclaration:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function CanHaveIllegalModifiers(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindClassStaticBlockDeclaration:
    case KindPropertyAssignment:
    case KindShorthandPropertyAssignment:
    case KindMissingDeclaration:
    case KindNamespaceExportDeclaration:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::CanHaveModifiers","kind":"func","status":"implemented","sigHash":"a799d139bbd7e10f2f9a07308f31abf0417f5e676209fce25eee766b8e2a3a4c","bodyHash":"23f3964e5f7294ff3c9e243b3be6abb94831f566960dee3f16b64e0a3b56ca0c"}
 *
 * Go source:
 * func CanHaveModifiers(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindTypeParameter,
 * 		KindParameter,
 * 		KindPropertySignature,
 * 		KindPropertyDeclaration,
 * 		KindMethodSignature,
 * 		KindMethodDeclaration,
 * 		KindConstructor,
 * 		KindGetAccessor,
 * 		KindSetAccessor,
 * 		KindIndexSignature,
 * 		KindConstructorType,
 * 		KindFunctionExpression,
 * 		KindArrowFunction,
 * 		KindClassExpression,
 * 		KindVariableStatement,
 * 		KindFunctionDeclaration,
 * 		KindClassDeclaration,
 * 		KindInterfaceDeclaration,
 * 		KindTypeAliasDeclaration,
 * 		KindEnumDeclaration,
 * 		KindModuleDeclaration,
 * 		KindImportEqualsDeclaration,
 * 		KindImportDeclaration,
 * 		KindJSImportDeclaration,
 * 		KindExportAssignment,
 * 		KindExportDeclaration:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function CanHaveModifiers(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindTypeParameter:
    case KindParameter:
    case KindPropertySignature:
    case KindPropertyDeclaration:
    case KindMethodSignature:
    case KindMethodDeclaration:
    case KindConstructor:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindIndexSignature:
    case KindConstructorType:
    case KindFunctionExpression:
    case KindArrowFunction:
    case KindClassExpression:
    case KindVariableStatement:
    case KindFunctionDeclaration:
    case KindClassDeclaration:
    case KindInterfaceDeclaration:
    case KindTypeAliasDeclaration:
    case KindEnumDeclaration:
    case KindModuleDeclaration:
    case KindImportEqualsDeclaration:
    case KindImportDeclaration:
    case KindJSImportDeclaration:
    case KindExportAssignment:
    case KindExportDeclaration:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::CanHaveDecorators","kind":"func","status":"implemented","sigHash":"965617f7524c6518cee42971141ed24516e567fae6690771f6f7daa2b9953d22","bodyHash":"72afaed1bed7a96abdc06b1ffabb9a7407186d06b2c4286b1ec9588029ef84b7"}
 *
 * Go source:
 * func CanHaveDecorators(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindParameter,
 * 		KindPropertyDeclaration,
 * 		KindMethodDeclaration,
 * 		KindGetAccessor,
 * 		KindSetAccessor,
 * 		KindClassExpression,
 * 		KindClassDeclaration:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function CanHaveDecorators(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindParameter:
    case KindPropertyDeclaration:
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindClassExpression:
    case KindClassDeclaration:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsFunctionOrModuleBlock","kind":"func","status":"implemented","sigHash":"b22879f0ad50d7da9e1b35f491a4cbe3b1e6c5a70116f11015de07b1ec910b0b","bodyHash":"1808a9f6caee8be3b662b042f1f750a99359c5667c6b90302ed480bd80a1537c"}
 *
 * Go source:
 * func IsFunctionOrModuleBlock(node *Node) bool {
 * 	return IsSourceFile(node) || IsModuleBlock(node) || IsBlock(node) && IsFunctionLike(node.Parent)
 * }
 */
export function IsFunctionOrModuleBlock(node: GoPtr<Node>): bool {
  return (IsSourceFile(node) || IsModuleBlock(node) || (IsBlock(node) && IsFunctionLike(node!.Parent))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsFunctionExpressionOrArrowFunction","kind":"func","status":"implemented","sigHash":"4916bfc5f9827b0761609bfdf6ed02034ca79b81883838977f427fc2759dfca9","bodyHash":"d9019870643d7ee9a89f503d3f191aa9b145ef7942467a0ac329390f23be4924"}
 *
 * Go source:
 * func IsFunctionExpressionOrArrowFunction(node *Node) bool {
 * 	return IsFunctionExpression(node) || IsArrowFunction(node)
 * }
 */
export function IsFunctionExpressionOrArrowFunction(node: GoPtr<Node>): bool {
  return (IsFunctionExpression(node) || IsArrowFunction(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::ForEachReturnStatement","kind":"func","status":"implemented","sigHash":"a9c5ba99de0d392050dc2f69611164845d06e471b1956eead01669a3798d6f8b","bodyHash":"284907e3d3172acd767b6cbbfc7d99795a6f3d7cf01f39d8acd7643d9de5204a"}
 *
 * Go source:
 * func ForEachReturnStatement(body *Node, visitor func(stmt *Node) bool) bool {
 * 	var traverse func(*Node) bool
 * 	traverse = func(node *Node) bool {
 * 		switch node.Kind {
 * 		case KindReturnStatement:
 * 			return visitor(node)
 * 		case KindCaseBlock, KindBlock, KindIfStatement, KindDoStatement, KindWhileStatement, KindForStatement, KindForInStatement,
 * 			KindForOfStatement, KindWithStatement, KindSwitchStatement, KindCaseClause, KindDefaultClause, KindLabeledStatement,
 * 			KindTryStatement, KindCatchClause:
 * 			return node.ForEachChild(traverse)
 * 		}
 * 		return false
 * 	}
 * 	return traverse(body)
 * }
 */
export function ForEachReturnStatement(body: GoPtr<Node>, visitor: (stmt: GoPtr<Node>) => bool): bool {
  const traverse = (node: GoPtr<Node>): bool => {
    switch (node!.Kind) {
      case KindReturnStatement:
        return visitor(node);
      case KindCaseBlock:
      case KindBlock:
      case KindIfStatement:
      case KindDoStatement:
      case KindWhileStatement:
      case KindForStatement:
      case KindForInStatement:
      case KindForOfStatement:
      case KindWithStatement:
      case KindSwitchStatement:
      case KindCaseClause:
      case KindDefaultClause:
      case KindLabeledStatement:
      case KindTryStatement:
      case KindCatchClause:
        return Node_ForEachChild(node, traverse);
    }
    return false as bool;
  };
  return traverse(body);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetRootDeclaration","kind":"func","status":"implemented","sigHash":"aef9fa376a49daf1eb3f212a4e6d104fbef06dbeab238554f30c958c5146f020","bodyHash":"dca65bd01227620139a131f7b9ad7f9e661cd3b3931c562f3e06bfde2e54e493"}
 *
 * Go source:
 * func GetRootDeclaration(node *Node) *Node {
 * 	for node.Kind == KindBindingElement {
 * 		node = node.Parent.Parent
 * 	}
 * 	return node
 * }
 */
export function GetRootDeclaration(node: GoPtr<Node>): GoPtr<Node> {
  const loop = (current: GoPtr<Node>): GoPtr<Node> => {
    if (current!.Kind !== KindBindingElement) return current;
    return loop(current!.Parent!.Parent);
  };
  return loop(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::getCombinedFlags","kind":"func","status":"implemented","sigHash":"57357718aef237ec0c4225b4d23ebf3fbe4fd8b63d51ae00c3dd43d04c15541f","bodyHash":"e917b239c8a6620fa1a968fc4cc6822fe724a441a184b3b63cc8c9a53af31bf6"}
 *
 * Go source:
 * func getCombinedFlags[T ~uint32](node *Node, getFlags func(*Node) T) T {
 * 	node = GetRootDeclaration(node)
 * 	flags := getFlags(node)
 * 	if node.Kind == KindVariableDeclaration {
 * 		node = node.Parent
 * 	}
 * 	if node != nil && node.Kind == KindVariableDeclarationList {
 * 		flags |= getFlags(node)
 * 		node = node.Parent
 * 	}
 * 	if node != nil && node.Kind == KindVariableStatement {
 * 		flags |= getFlags(node)
 * 	}
 * 	return flags
 * }
 */
export function getCombinedFlags<T extends number>(node: GoPtr<Node>, getFlags: (arg0: GoPtr<Node>) => T): T {
  const root = GetRootDeclaration(node);
  const flags0 = getFlags(root);
  const n1 = root!.Kind === KindVariableDeclaration ? root!.Parent : root;
  const isDeclList = n1 !== undefined && n1!.Kind === KindVariableDeclarationList;
  const flags1 = isDeclList ? (flags0 | getFlags(n1!)) as T : flags0;
  const n2 = isDeclList ? n1!.Parent : n1;
  const flags2 = (n2 !== undefined && n2!.Kind === KindVariableStatement) ? (flags1 | getFlags(n2)) as T : flags1;
  return flags2;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetCombinedModifierFlags","kind":"func","status":"implemented","sigHash":"4f78081cb14c46a2c5bde5f2b92259b8c7c43331e5f0e1a4c42624da649bd125","bodyHash":"f789082316c36c695ec0d57a8b61cce8660a388da5513febe0b039f346fd0cbe"}
 *
 * Go source:
 * func GetCombinedModifierFlags(node *Node) ModifierFlags {
 * 	return getCombinedFlags(node, (*Node).ModifierFlags)
 * }
 */
export function GetCombinedModifierFlags(node: GoPtr<Node>): ModifierFlags {
  return getCombinedFlags(node, Node_ModifierFlags);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetCombinedNodeFlags","kind":"func","status":"implemented","sigHash":"7162e95111775ef77c0f4df244e7ff65965ff4c4e525077fe09fc40eb82e14dc","bodyHash":"54537fd044a7676627bd003c4956eba71dc1a99f847c0b6141496493a3f24856"}
 *
 * Go source:
 * func GetCombinedNodeFlags(node *Node) NodeFlags {
 * 	return getCombinedFlags(node, getNodeFlags)
 * }
 */
export function GetCombinedNodeFlags(node: GoPtr<Node>): NodeFlags {
  return getCombinedFlags(node, getNodeFlags);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::getNodeFlags","kind":"func","status":"implemented","sigHash":"45c35b8c66d8dad248939d0174e52d53d1fd23c2f08db4a540a1202315e0cb85","bodyHash":"3518a966317a1b99459cdead0ff97c2c26b946d33567f338bd4b638d869d0c89"}
 *
 * Go source:
 * func getNodeFlags(node *Node) NodeFlags {
 * 	return node.Flags
 * }
 */
export function getNodeFlags(node: GoPtr<Node>): NodeFlags {
  return node!.Flags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsVarAwaitUsing","kind":"func","status":"implemented","sigHash":"ded24c3687c67e03549b9af12eadee39a024d57ef6078c04f2b1b60ea30732ed","bodyHash":"4594eb27530066feb3e97dd30ea619151ea3c6c47d5430307b5397d589dfab68"}
 *
 * Go source:
 * func IsVarAwaitUsing(node *Node) bool {
 * 	return GetCombinedNodeFlags(node)&NodeFlagsBlockScoped == NodeFlagsAwaitUsing
 * }
 */
export function IsVarAwaitUsing(node: GoPtr<Node>): bool {
  return ((GetCombinedNodeFlags(node) & NodeFlagsBlockScoped) === NodeFlagsAwaitUsing) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsVarUsing","kind":"func","status":"implemented","sigHash":"c169920ec0886dce64ca9456d45f714fae593ae77789c7cd193b09767d578183","bodyHash":"98bac08f3a906b16d6272d23e47974218400832a0cafbac89793bc6bf5148eec"}
 *
 * Go source:
 * func IsVarUsing(node *Node) bool {
 * 	return GetCombinedNodeFlags(node)&NodeFlagsBlockScoped == NodeFlagsUsing
 * }
 */
export function IsVarUsing(node: GoPtr<Node>): bool {
  return ((GetCombinedNodeFlags(node) & NodeFlagsBlockScoped) === NodeFlagsUsing) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetJSDocDeprecatedTag","kind":"func","status":"implemented","sigHash":"7efb5442a269895f9910531c67d735145cf176c4162053bf9e5c3ef7cf2d5997","bodyHash":"3087aa10d2d4ffc2cbbc0f94d58ff0dd3db28d2257cd2e62a98fde87193efb17"}
 *
 * Go source:
 * func GetJSDocDeprecatedTag(node *Node) *Node {
 * 	for _, jsdoc := range node.JSDoc(nil) {
 * 		tags := jsdoc.AsJSDoc().Tags
 * 		if tags != nil {
 * 			for _, tag := range tags.Nodes {
 * 				if IsJSDocDeprecatedTag(tag) {
 * 					return tag
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function GetJSDocDeprecatedTag(node: GoPtr<Node>): GoPtr<Node> {
  for (const jsdoc of Node_JSDoc(node, undefined)) {
    const tags = AsJSDoc(jsdoc)!.Tags;
    if (tags !== undefined) {
      for (const tag of tags!.Nodes) {
        if (IsJSDocDeprecatedTag(tag)) {
          return tag;
        }
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsDeprecatedDeclaration","kind":"func","status":"implemented","sigHash":"c11603d47f4ebf6de7929cc1355e67c89dc5ab944f89e651e3daba6b7ddd8f82","bodyHash":"3fbcef4fd940bcc4ef13fd4950c053950cf0f4b9f26a5be630bd8e09c9b22629"}
 *
 * Go source:
 * func IsDeprecatedDeclaration(declaration *Node) bool {
 * 	return IsDeprecatedDeclarationWithCachedFlags(declaration, GetCombinedNodeFlags(declaration))
 * }
 */
export function IsDeprecatedDeclaration(declaration: GoPtr<Node>): bool {
  return IsDeprecatedDeclarationWithCachedFlags(declaration, GetCombinedNodeFlags(declaration));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsDeprecatedDeclarationWithCachedFlags","kind":"func","status":"implemented","sigHash":"faeeb40a9d16c92a06767633e6fc613fb658a5295b94b80bd90ff51a320e6007","bodyHash":"0ae65d680066c8b777bcddcda0ad661201b711fef49605654cf4efd2ea1bb2e2"}
 *
 * Go source:
 * func IsDeprecatedDeclarationWithCachedFlags(declaration *Node, combinedFlags NodeFlags) bool {
 * 	if combinedFlags&NodeFlagsPossiblyContainsDeprecatedTag == 0 {
 * 		return false
 * 	}
 * 	// Walk up to find the node that directly has the flag, since JSDoc is
 * 	// attached to that node (e.g. VariableStatement, not VariableDeclaration).
 * 	for n := declaration; n != nil; n = n.Parent {
 * 		if n.Flags&NodeFlagsPossiblyContainsDeprecatedTag != 0 {
 * 			return GetJSDocDeprecatedTag(n) != nil
 * 		}
 * 	}
 * 	return false
 * }
 */
export function IsDeprecatedDeclarationWithCachedFlags(declaration: GoPtr<Node>, combinedFlags: NodeFlags): bool {
  if ((combinedFlags & NodeFlagsPossiblyContainsDeprecatedTag) === 0) {
    return false as bool;
  }
  // Walk up to find the node that directly has the flag, since JSDoc is
  // attached to that node (e.g. VariableStatement, not VariableDeclaration).
  const loop = (n: GoPtr<Node>): bool => {
    if (n === undefined) return false as bool;
    if ((n!.Flags & NodeFlagsPossiblyContainsDeprecatedTag) !== 0) return (GetJSDocDeprecatedTag(n) !== undefined) as bool;
    return loop(n!.Parent);
  };
  return loop(declaration);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsVarConst","kind":"func","status":"implemented","sigHash":"e8fb3ffb6e448cdd76358f8802a62fec0b0dd6a78e515e0d91deeabf9cf43ee7","bodyHash":"d02fe582dda2472efb717e422f2246b853c51d1e38e094f7f04337f6852430c9"}
 *
 * Go source:
 * func IsVarConst(node *Node) bool {
 * 	return GetCombinedNodeFlags(node)&NodeFlagsBlockScoped == NodeFlagsConst
 * }
 */
export function IsVarConst(node: GoPtr<Node>): bool {
  return ((GetCombinedNodeFlags(node) & NodeFlagsBlockScoped) === NodeFlagsConst) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsVarConstLike","kind":"func","status":"implemented","sigHash":"3ed8a6dfc8d68525177cf3f038cd9a25560e90275773428c0e4484ad39897d18","bodyHash":"19da875d508a1938f07ab172108722e48632f021845140ecaa456c59d149af15"}
 *
 * Go source:
 * func IsVarConstLike(node *Node) bool {
 * 	switch GetCombinedNodeFlags(node) & NodeFlagsBlockScoped {
 * 	case NodeFlagsConst, NodeFlagsUsing, NodeFlagsAwaitUsing:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsVarConstLike(node: GoPtr<Node>): bool {
  switch (GetCombinedNodeFlags(node) & NodeFlagsBlockScoped) {
    case NodeFlagsConst:
    case NodeFlagsUsing:
    case NodeFlagsAwaitUsing:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsVarLet","kind":"func","status":"implemented","sigHash":"ee74eed6900c6c84d01fa785e6b5f262b1f1c978820337f5401f8c1ae23638a5","bodyHash":"a9b3c7ad3490800d4ef5639228bbf08e60f31143d86317184874be9532654f81"}
 *
 * Go source:
 * func IsVarLet(node *Node) bool {
 * 	return GetCombinedNodeFlags(node)&NodeFlagsBlockScoped == NodeFlagsLet
 * }
 */
export function IsVarLet(node: GoPtr<Node>): bool {
  return ((GetCombinedNodeFlags(node) & NodeFlagsBlockScoped) === NodeFlagsLet) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsImportMeta","kind":"func","status":"implemented","sigHash":"031ec1540a6e473cf6e40db0871f37aefb3961e4a0efc5636459b4c3ed4033b7","bodyHash":"1922694d416787e87f042f61166c47f6742487e5a2981b15e19d9a8add67be37"}
 *
 * Go source:
 * func IsImportMeta(node *Node) bool {
 * 	if node.Kind == KindMetaProperty {
 * 		return node.AsMetaProperty().KeywordToken == KindImportKeyword && node.AsMetaProperty().Name().Text() == "meta"
 * 	}
 * 	return false
 * }
 */
export function IsImportMeta(node: GoPtr<Node>): bool {
  if (node!.Kind === KindMetaProperty) {
    return (AsMetaProperty(node)!.KeywordToken === KindImportKeyword &&
      Node_Text(Node_Name(node)) === "meta") as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::WalkUpBindingElementsAndPatterns","kind":"func","status":"implemented","sigHash":"268c5068915fed4ce35e77e6a50a3c4381c020ba7dc5075795d3d314eb382a5f","bodyHash":"fbed78427f4c2b5524abf67e7c8c036314562b84196a53a28ef4598fe600e57e"}
 *
 * Go source:
 * func WalkUpBindingElementsAndPatterns(binding *Node) *Node {
 * 	node := binding.Parent
 * 	for IsBindingElement(node.Parent) {
 * 		node = node.Parent.Parent
 * 	}
 * 	return node.Parent
 * }
 */
export function WalkUpBindingElementsAndPatterns(binding: GoPtr<Node>): GoPtr<Node> {
  const loop = (node: GoPtr<Node>): GoPtr<Node> => {
    if (!IsBindingElement(node!.Parent)) return node;
    return loop(node!.Parent!.Parent);
  };
  return loop(binding!.Parent)!.Parent;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsSourceFileJS","kind":"func","status":"implemented","sigHash":"b204fc76633eba41f561eb271eca10bad46b04cc4fbd1159f412f5a0d2b15eaf","bodyHash":"760468b8d74b9d7ef0e5fb64274e58a152ace8f6d8ffd142fd64f2ea57436081"}
 *
 * Go source:
 * func IsSourceFileJS(file *SourceFile) bool {
 * 	return file.ScriptKind == core.ScriptKindJS || file.ScriptKind == core.ScriptKindJSX
 * }
 */
export function IsSourceFileJS(file: GoPtr<SourceFile>): bool {
  return (file!.ScriptKind === ScriptKindJS || file!.ScriptKind === ScriptKindJSX) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsInJSFile","kind":"func","status":"implemented","sigHash":"74a9bde1692783c64741334940746f6b6fc226732240d843803835ea214a00de","bodyHash":"ea8f4034b03476b4ee47b99f3d47ccffa82ae7da1d1da5a5df63e86581f3b51d"}
 *
 * Go source:
 * func IsInJSFile(node *Node) bool {
 * 	return node != nil && node.Flags&NodeFlagsJavaScriptFile != 0
 * }
 */
export function IsInJSFile(node: GoPtr<Node>): bool {
  return (node !== undefined && (node!.Flags & NodeFlagsJavaScriptFile) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsDeclaration","kind":"func","status":"implemented","sigHash":"782151c0150e79c21cc37c421135b310683783dde260a78e916a7b54f00556c5","bodyHash":"ed72a7f26438428460f702d8ec4e21fec17cd2af5df8d99163a07e43686b2513"}
 *
 * Go source:
 * func IsDeclaration(node *Node) bool {
 * 	if node.Kind == KindTypeParameter {
 * 		return node.Parent != nil
 * 	}
 * 	return IsDeclarationNode(node)
 * }
 */
export function IsDeclaration(node: GoPtr<Node>): bool {
  if (node!.Kind === KindTypeParameter) {
    return (node!.Parent !== undefined) as bool;
  }
  return IsDeclarationNode(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsDeclarationName","kind":"func","status":"implemented","sigHash":"95f33a85c1b84ac9aa45226fcfa36fdbd215b5d82adbea87c3770c57af667783","bodyHash":"723fc7ed170332bae95564be32b120d7dcf07a677e8d4cb97475e14e0ecb9cde"}
 *
 * Go source:
 * func IsDeclarationName(name *Node) bool {
 * 	return !IsSourceFile(name) && !IsBindingPattern(name) && IsDeclaration(name.Parent) && name.Parent.Name() == name
 * }
 */
export function IsDeclarationName(name: GoPtr<Node>): bool {
  return (!IsSourceFile(name) && !IsBindingPattern(name) && IsDeclaration(name!.Parent) && Node_Name(name!.Parent) === name) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsDeclarationNameOrImportPropertyName","kind":"func","status":"implemented","sigHash":"db0ef6954847331c7670020e4408b996c68044d0b494b5fe6167713f8695d2ae","bodyHash":"07bf5be0189b1a4ad52b1408f74154e10c09b0cb9fe3c66bddd3180a25a14faf"}
 *
 * Go source:
 * func IsDeclarationNameOrImportPropertyName(name *Node) bool {
 * 	switch name.Parent.Kind {
 * 	case KindImportSpecifier, KindExportSpecifier:
 * 		return IsIdentifier(name) || name.Kind == KindStringLiteral
 * 	default:
 * 		return IsDeclarationName(name)
 * 	}
 * }
 */
export function IsDeclarationNameOrImportPropertyName(name: GoPtr<Node>): bool {
  switch (name!.Parent!.Kind) {
    case KindImportSpecifier:
    case KindExportSpecifier:
      return (IsIdentifier(name) || name!.Kind === KindStringLiteral) as bool;
    default:
      return IsDeclarationName(name);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsLiteralComputedPropertyDeclarationName","kind":"func","status":"implemented","sigHash":"29b9566d0b4be555b35e113d0766b148161c6778fe7735e91dcd7caeea5093af","bodyHash":"11a12d8aebf2ff4b4217d689a4d67a9c8dcd488672a1878051f57dd48e5623ad"}
 *
 * Go source:
 * func IsLiteralComputedPropertyDeclarationName(node *Node) bool {
 * 	return IsStringOrNumericLiteralLike(node) &&
 * 		node.Parent.Kind == KindComputedPropertyName &&
 * 		IsDeclaration(node.Parent.Parent)
 * }
 */
export function IsLiteralComputedPropertyDeclarationName(node: GoPtr<Node>): bool {
  return (IsStringOrNumericLiteralLike(node) &&
    node!.Parent!.Kind === KindComputedPropertyName &&
    IsDeclaration(node!.Parent!.Parent)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsExternalModuleImportEqualsDeclaration","kind":"func","status":"implemented","sigHash":"c4a6c15bf750c4105f28704535f716e61219bea8c083184ac338e0fba0ea14fd","bodyHash":"8c7b08442738096f3328619c3ebc33507f01128bb4478a8b549e93bb1c3ddf47"}
 *
 * Go source:
 * func IsExternalModuleImportEqualsDeclaration(node *Node) bool {
 * 	return node.Kind == KindImportEqualsDeclaration && node.AsImportEqualsDeclaration().ModuleReference.Kind == KindExternalModuleReference
 * }
 */
export function IsExternalModuleImportEqualsDeclaration(node: GoPtr<Node>): bool {
  return (node!.Kind === KindImportEqualsDeclaration &&
    AsImportEqualsDeclaration(node)!.ModuleReference!.Kind === KindExternalModuleReference) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsModuleOrEnumDeclaration","kind":"func","status":"implemented","sigHash":"3910b908f43c87d62c6c354420d9a4fbc5de956cb48bdd08c8060edd4be8b061","bodyHash":"179a220a4f77a0afa9ed613ceb5c6955a81b43374d46de7f6f11dd67dac5aabb"}
 *
 * Go source:
 * func IsModuleOrEnumDeclaration(node *Node) bool {
 * 	return node.Kind == KindModuleDeclaration || node.Kind == KindEnumDeclaration
 * }
 */
export function IsModuleOrEnumDeclaration(node: GoPtr<Node>): bool {
  return (node!.Kind === KindModuleDeclaration || node!.Kind === KindEnumDeclaration) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsLiteralImportTypeNode","kind":"func","status":"implemented","sigHash":"fcb1ebaed0cda8a8796c442f4211fd35bf4e22c15470ff06ead481447b9a78a6","bodyHash":"89c7bc38a49e2e4828974fcbf8cad729e1abaddb8b75e6628f7cd139f5922b74"}
 *
 * Go source:
 * func IsLiteralImportTypeNode(node *Node) bool {
 * 	return IsImportTypeNode(node) && IsLiteralTypeNode(node.AsImportTypeNode().Argument) && IsStringLiteral(node.AsImportTypeNode().Argument.AsLiteralTypeNode().Literal)
 * }
 */
export function IsLiteralImportTypeNode(node: GoPtr<Node>): bool {
  return (IsImportTypeNode(node) &&
    IsLiteralTypeNode(AsImportTypeNode(node)!.Argument) &&
    IsStringLiteral(AsLiteralTypeNode(AsImportTypeNode(node)!.Argument)!.Literal)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJsxTagName","kind":"func","status":"implemented","sigHash":"1d1cceb529f69b018b45dce4fba7a62f9ac673da01ebbd09f74f15b9fb4da881","bodyHash":"66f9b56e8f0d405f124a30f43d518c7cb6cf98f9034dfe21fd2550532c4b4420"}
 *
 * Go source:
 * func IsJsxTagName(node *Node) bool {
 * 	parent := node.Parent
 * 	switch parent.Kind {
 * 	case KindJsxOpeningElement, KindJsxClosingElement, KindJsxSelfClosingElement:
 * 		return parent.TagName() == node
 * 	}
 * 	return false
 * }
 */
export function IsJsxTagName(node: GoPtr<Node>): bool {
  const parent: GoPtr<Node> = node!.Parent;
  switch (parent!.Kind) {
    case KindJsxOpeningElement:
    case KindJsxClosingElement:
    case KindJsxSelfClosingElement:
      return (Node_TagName(parent) === node) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsImportOrExportSpecifier","kind":"func","status":"implemented","sigHash":"4213c3e7d44f51f77ba7b39775e5b5f97628a4b76437f7cf169e53133668ef72","bodyHash":"7b60169eac2465257489f1fced0cb005323b1bbe13f4aa5dc87d7218a6e39124"}
 *
 * Go source:
 * func IsImportOrExportSpecifier(node *Node) bool {
 * 	return IsImportSpecifier(node) || IsExportSpecifier(node)
 * }
 */
export function IsImportOrExportSpecifier(node: GoPtr<Node>): bool {
  return (IsImportSpecifier(node) || IsExportSpecifier(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsVoidZero","kind":"func","status":"implemented","sigHash":"30d6715d7e5bcda31769b11182d65e0cc26ecb91af8881cb8fdf2a0109253b0e","bodyHash":"1a449f64e121b1c649f63d81257367eee90619e1ecaec4fd3b786c5e0ca6076e"}
 *
 * Go source:
 * func IsVoidZero(node *Node) bool {
 * 	return IsVoidExpression(node) && IsNumericLiteral(node.Expression()) && node.Expression().Text() == "0"
 * }
 */
export function IsVoidZero(node: GoPtr<Node>): bool {
  return (IsVoidExpression(node) && IsNumericLiteral(Node_Expression(node)) && Node_Text(Node_Expression(node)) === "0") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsExportsIdentifier","kind":"func","status":"implemented","sigHash":"e58479142a41d566dfb781c5c3543bc718e57152c39276ad479234552d3cf4c5","bodyHash":"9ae6fb5bd66ead1ba4323c44acc90e9f45b71c44e14934a4c5fde7c93a2d159b"}
 *
 * Go source:
 * func IsExportsIdentifier(node *Node) bool {
 * 	return IsIdentifier(node) && node.Text() == "exports"
 * }
 */
export function IsExportsIdentifier(node: GoPtr<Node>): bool {
  return (IsIdentifier(node) && Node_Text(node) === "exports") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsModuleIdentifier","kind":"func","status":"implemented","sigHash":"7e996ba2992535ce907db9d05fc2da9b1ee4fc6ae1c8cea5ffc4aa96254b7c7b","bodyHash":"5a5682deee850fd457ee673c6d20af42580a78db45da56f3d39c6d3e10b63442"}
 *
 * Go source:
 * func IsModuleIdentifier(node *Node) bool {
 * 	return IsIdentifier(node) && node.Text() == "module"
 * }
 */
export function IsModuleIdentifier(node: GoPtr<Node>): bool {
  return (IsIdentifier(node) && Node_Text(node) === "module") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsThisIdentifier","kind":"func","status":"implemented","sigHash":"6110c087bae5c4e105d8e2c7e76ab2c181ea5aa72bd169a012fce1681ff25575","bodyHash":"897ddc68da3e59762aac06385a094a2289176d98c6746811793bbb2e899ffa7a"}
 *
 * Go source:
 * func IsThisIdentifier(node *Node) bool {
 * 	return IsIdentifier(node) && node.Text() == "this"
 * }
 */
export function IsThisIdentifier(node: GoPtr<Node>): bool {
  return (IsIdentifier(node) && Node_Text(node) === "this") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsThisParameter","kind":"func","status":"implemented","sigHash":"377b0b781bfc579254c6cff37b7cb24bc016bcc11dce069c7d4a2ed73dd914a9","bodyHash":"f949b203eae8cf583ae9fee1118efbfc847dba46fc0468bb1ba3f058c872a4b8"}
 *
 * Go source:
 * func IsThisParameter(node *Node) bool {
 * 	return IsParameterDeclaration(node) && node.Name() != nil && IsThisIdentifier(node.Name())
 * }
 */
export function IsThisParameter(node: GoPtr<Node>): bool {
  return (IsParameterDeclaration(node) && Node_Name(node) !== undefined && IsThisIdentifier(Node_Name(node))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsBindableStaticAccessExpression","kind":"func","status":"implemented","sigHash":"ec8db964489823c5c4763138d648140b447ca9c1cf88e617046ede0fe5e7e6fd","bodyHash":"d77ea20845e8b721edaf258a1c3ce29acd04b6282c7c7b16859bd0fae498951a"}
 *
 * Go source:
 * func IsBindableStaticAccessExpression(node *Node, excludeThisKeyword bool) bool {
 * 	return IsPropertyAccessExpression(node) &&
 * 		(!excludeThisKeyword && node.Expression().Kind == KindThisKeyword || IsIdentifier(node.Name()) && IsBindableStaticNameExpression(node.Expression(), true /*excludeThisKeyword* /)) ||
 * 		IsBindableStaticElementAccessExpression(node, excludeThisKeyword)
 * }
 */
export function IsBindableStaticAccessExpression(node: GoPtr<Node>, excludeThisKeyword: bool): bool {
  return ((IsPropertyAccessExpression(node) &&
    ((!excludeThisKeyword && Node_Expression(node)!.Kind === KindThisKeyword) ||
      (IsIdentifier(Node_Name(node)) && IsBindableStaticNameExpression(Node_Expression(node), true /*excludeThisKeyword*/)))) ||
    IsBindableStaticElementAccessExpression(node, excludeThisKeyword)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsBindableStaticElementAccessExpression","kind":"func","status":"implemented","sigHash":"e21df294a9c11dce75279d1c8b0c517fbf97247765bb9b4909f128e59c5def84","bodyHash":"81fb1b3079610fa880ab8acda6ff7f6dc8a70159d0427101403ef8f75ca42b6c"}
 *
 * Go source:
 * func IsBindableStaticElementAccessExpression(node *Node, excludeThisKeyword bool) bool {
 * 	return IsLiteralLikeElementAccess(node) &&
 * 		((!excludeThisKeyword && node.Expression().Kind == KindThisKeyword) ||
 * 			IsEntityNameExpression(node.Expression()) ||
 * 			IsBindableStaticAccessExpression(node.Expression(), true /*excludeThisKeyword* /))
 * }
 */
export function IsBindableStaticElementAccessExpression(node: GoPtr<Node>, excludeThisKeyword: bool): bool {
  return (IsLiteralLikeElementAccess(node) &&
    ((!excludeThisKeyword && Node_Expression(node)!.Kind === KindThisKeyword) ||
      IsEntityNameExpression(Node_Expression(node)) ||
      IsBindableStaticAccessExpression(Node_Expression(node), true /*excludeThisKeyword*/))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPrototypeAccess","kind":"func","status":"implemented","sigHash":"65289de84799992bcb207006361aa7024b74873022b4643feb83cb9fb923bdbf","bodyHash":"06d2fcbb2a4f8adb6df08f2638e2d1207d5f6073c80e0f17fde300b61319cf2f"}
 *
 * Go source:
 * func IsPrototypeAccess(node *Node) bool {
 * 	if IsBindableStaticAccessExpression(node, false /*excludeThisKeyword* /) {
 * 		if name := GetElementOrPropertyAccessName(node); name != nil {
 * 			return name.Text() == "prototype"
 * 		}
 * 	}
 * 	return false
 * }
 */
export function IsPrototypeAccess(node: GoPtr<Node>): bool {
  if (IsBindableStaticAccessExpression(node, false /*excludeThisKeyword*/)) {
    const name: GoPtr<Node> = GetElementOrPropertyAccessName(node);
    if (name !== undefined) {
      return (Node_Text(name) === "prototype") as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsLiteralLikeElementAccess","kind":"func","status":"implemented","sigHash":"83892bd6b7e00c9b8045cc479687935821f2c675bcfb11e8dc591a8388e438f5","bodyHash":"e981c8be939e7da1952a48de4856330687d20b6f563c384ba1a2e59aa1fa05fc"}
 *
 * Go source:
 * func IsLiteralLikeElementAccess(node *Node) bool {
 * 	return IsElementAccessExpression(node) && IsStringOrNumericLiteralLike(node.AsElementAccessExpression().ArgumentExpression)
 * }
 */
export function IsLiteralLikeElementAccess(node: GoPtr<Node>): bool {
  return (IsElementAccessExpression(node) &&
    IsStringOrNumericLiteralLike(AsElementAccessExpression(node)!.ArgumentExpression)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsBindableStaticNameExpression","kind":"func","status":"implemented","sigHash":"c73a55292b6c185ded35e0b8a0af4504f3c89a0421204bb7c29190e26ae21d3d","bodyHash":"9750df0f69cd923b3ab8b4504c790e374966a7f4d3bdd20a7ae0e93462571360"}
 *
 * Go source:
 * func IsBindableStaticNameExpression(node *Node, excludeThisKeyword bool) bool {
 * 	return IsEntityNameExpression(node) || IsBindableStaticAccessExpression(node, excludeThisKeyword)
 * }
 */
export function IsBindableStaticNameExpression(node: GoPtr<Node>, excludeThisKeyword: bool): bool {
  return (IsEntityNameExpression(node) || IsBindableStaticAccessExpression(node, excludeThisKeyword)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetElementOrPropertyAccessName","kind":"func","status":"implemented","sigHash":"1dfe3eac9680681003b00a557e41ff4cff64a74f2d07a48c5bf770cf593a5ce9","bodyHash":"549cd5b5417d13ee31c5e83f3162917342e808baa7a3429ca1b7b97a78619298"}
 *
 * Go source:
 * func GetElementOrPropertyAccessName(node *Node) *Node {
 * 	switch node.Kind {
 * 	case KindPropertyAccessExpression:
 * 		if IsIdentifier(node.Name()) {
 * 			return node.Name()
 * 		}
 * 		return nil
 * 	case KindElementAccessExpression:
 * 		if arg := SkipParentheses(node.AsElementAccessExpression().ArgumentExpression); IsStringOrNumericLiteralLike(arg) {
 * 			return arg
 * 		}
 * 		return nil
 * 	}
 * 	panic("Unhandled case in GetElementOrPropertyAccessName")
 * }
 */
export function GetElementOrPropertyAccessName(node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindPropertyAccessExpression:
      if (IsIdentifier(Node_Name(node))) {
        return Node_Name(node);
      }
      return undefined;
    case KindElementAccessExpression: {
      const arg: GoPtr<Node> = SkipParentheses(AsElementAccessExpression(node)!.ArgumentExpression);
      if (IsStringOrNumericLiteralLike(arg)) {
        return arg;
      }
      return undefined;
    }
  }
  throw new globalThis.Error("Unhandled case in GetElementOrPropertyAccessName");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetInitializerOfBinaryExpression","kind":"func","status":"implemented","sigHash":"234f8923ff63c920a7bcb3dc7760cce521ca64ce5fbb32ce07c87e702beab0c3","bodyHash":"57ee3cbd7d614d77a8a668e26696fc9944b50b018a084494d1927952ddb9aafa"}
 *
 * Go source:
 * func GetInitializerOfBinaryExpression(expr *BinaryExpression) *Expression {
 * 	for IsBinaryExpression(expr.Right) {
 * 		expr = expr.Right.AsBinaryExpression()
 * 	}
 * 	return expr.Right.Expression()
 * }
 */
export function GetInitializerOfBinaryExpression(expr: GoPtr<BinaryExpression>): GoPtr<Expression> {
  const loop = (current: GoPtr<BinaryExpression>): GoPtr<Expression> => {
    if (!IsBinaryExpression(current!.Right)) return Node_Expression(current!.Right);
    return loop(AsBinaryExpression(current!.Right));
  };
  return loop(expr);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsExpressionWithTypeArgumentsInClassExtendsClause","kind":"func","status":"implemented","sigHash":"5d8edbabb232c6d7f92eeef289284c6f919d4e5065cbf92a0d69c1c1e1114f7b","bodyHash":"d2024707de9a0b3fefb23f9ac858665b77039a1617442e8fd0814063e894d067"}
 *
 * Go source:
 * func IsExpressionWithTypeArgumentsInClassExtendsClause(node *Node) bool {
 * 	return TryGetClassExtendingExpressionWithTypeArguments(node) != nil
 * }
 */
export function IsExpressionWithTypeArgumentsInClassExtendsClause(node: GoPtr<Node>): bool {
  return (TryGetClassExtendingExpressionWithTypeArguments(node) !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::TryGetClassExtendingExpressionWithTypeArguments","kind":"func","status":"implemented","sigHash":"0efe6b2e710d1f1000a6f836294276bf4c2cb341492097087be8ade44ec46833","bodyHash":"1252aad26305c1a905418f9c76a3c57fd594a5ddeee51ce776d0da5452914fbd"}
 *
 * Go source:
 * func TryGetClassExtendingExpressionWithTypeArguments(node *Node) *ClassLikeDeclaration {
 * 	cls, isImplements := TryGetClassImplementingOrExtendingExpressionWithTypeArguments(node)
 * 	if cls != nil && !isImplements {
 * 		return cls
 * 	}
 * 	return nil
 * }
 */
export function TryGetClassExtendingExpressionWithTypeArguments(node: GoPtr<Node>): GoPtr<ClassLikeDeclaration> {
  const [cls, isImplements] = TryGetClassImplementingOrExtendingExpressionWithTypeArguments(node);
  if (cls !== undefined && !isImplements) {
    return cls;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::TryGetClassImplementingOrExtendingExpressionWithTypeArguments","kind":"func","status":"implemented","sigHash":"91b00b921859386893812b06e676f66baea41c1d5f054f4373859d0d30346cd9","bodyHash":"ae42154f5d53a907cbae7de240922bc4a65f2ec9e019fcb36a8f8a0d6b8a7c9d"}
 *
 * Go source:
 * func TryGetClassImplementingOrExtendingExpressionWithTypeArguments(node *Node) (class *ClassLikeDeclaration, isImplements bool) {
 * 	if IsExpressionWithTypeArguments(node) {
 * 		if IsHeritageClause(node.Parent) && IsClassLike(node.Parent.Parent) {
 * 			return node.Parent.Parent, node.Parent.AsHeritageClause().Token == KindImplementsKeyword
 * 		}
 * 	}
 * 	return nil, false
 * }
 */
export function TryGetClassImplementingOrExtendingExpressionWithTypeArguments(node: GoPtr<Node>): [GoPtr<ClassLikeDeclaration>, bool] {
  if (IsExpressionWithTypeArguments(node)) {
    if (IsHeritageClause(node!.Parent) && IsClassLike(node!.Parent!.Parent)) {
      return [node!.Parent!.Parent, (AsHeritageClause(node!.Parent)!.Token === KindImplementsKeyword) as bool];
    }
  }
  return [undefined, false as bool];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetNameOfDeclaration","kind":"func","status":"implemented","sigHash":"2d1bc7bed0b6995c7db72a317a16cdb0906d499a9edf686d18088b57395023c8","bodyHash":"b54419ea76912444334a8b6d7b911dbf68696ed383123f1ac9db53eed8ad1652"}
 *
 * Go source:
 * func GetNameOfDeclaration(declaration *Node) *Node {
 * 	if declaration == nil {
 * 		return nil
 * 	}
 * 	nonAssignedName := GetNonAssignedNameOfDeclaration(declaration)
 * 	if nonAssignedName != nil {
 * 		return nonAssignedName
 * 	}
 * 	if IsFunctionExpression(declaration) || IsArrowFunction(declaration) || IsClassExpression(declaration) {
 * 		return GetAssignedName(declaration)
 * 	}
 * 	return nil
 * }
 */
export function GetNameOfDeclaration(declaration: GoPtr<Node>): GoPtr<Node> {
  if (declaration === undefined) {
    return undefined;
  }
  const nonAssignedName: GoPtr<Node> = GetNonAssignedNameOfDeclaration(declaration);
  if (nonAssignedName !== undefined) {
    return nonAssignedName;
  }
  if (IsFunctionExpression(declaration) || IsArrowFunction(declaration) || IsClassExpression(declaration)) {
    return GetAssignedName(declaration);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetNonAssignedNameOfDeclaration","kind":"func","status":"implemented","sigHash":"5624d3309c9ecf6c3c65b28e45eedd012b8bb57feba41f9bba31c23cef2e4f91","bodyHash":"acdb0539bfed0e6dedbb9848db964d10d756434d9f1ce91c6347aeb25111209a"}
 *
 * Go source:
 * func GetNonAssignedNameOfDeclaration(declaration *Node) *Node {
 * 	// !!!
 * 	switch declaration.Kind {
 * 	case KindBinaryExpression, KindCallExpression:
 * 		switch GetAssignmentDeclarationKind(declaration) {
 * 		case JSDeclarationKindProperty, JSDeclarationKindThisProperty, JSDeclarationKindExportsProperty:
 * 			left := declaration.AsBinaryExpression().Left
 * 			if name := GetElementOrPropertyAccessName(left); name != nil {
 * 				return name
 * 			}
 * 			return left
 * 		case JSDeclarationKindObjectDefinePropertyValue, JSDeclarationKindObjectDefinePropertyExports:
 * 			return declaration.Arguments()[1]
 * 		}
 * 		return nil
 * 	case KindExportAssignment:
 * 		expr := declaration.Expression()
 * 		if IsIdentifier(expr) {
 * 			return expr
 * 		}
 * 		return nil
 * 	}
 * 	return declaration.Name()
 * }
 */
export function GetNonAssignedNameOfDeclaration(declaration: GoPtr<Node>): GoPtr<Node> {
  // !!!
  switch (declaration!.Kind) {
    case KindBinaryExpression:
    case KindCallExpression:
      switch (GetAssignmentDeclarationKind(declaration)) {
        case JSDeclarationKindProperty:
        case JSDeclarationKindThisProperty:
        case JSDeclarationKindExportsProperty: {
          const left: GoPtr<Node> = AsBinaryExpression(declaration)!.Left;
          const name: GoPtr<Node> = GetElementOrPropertyAccessName(left);
          if (name !== undefined) {
            return name;
          }
          return left;
        }
        case JSDeclarationKindObjectDefinePropertyValue:
        case JSDeclarationKindObjectDefinePropertyExports:
          return Node_Arguments(declaration)![1];
      }
      return undefined;
    case KindExportAssignment: {
      const expr: GoPtr<Node> = Node_Expression(declaration);
      if (IsIdentifier(expr)) {
        return expr;
      }
      return undefined;
    }
  }
  return Node_Name(declaration);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetAssignedName","kind":"func","status":"implemented","sigHash":"1597213640824706823c393d3e4bbd4023cf16f7f1e5e65420e5ed5a2b086ae8","bodyHash":"dd8c30cc3b3bcbfa12a79fc5d68853bf60bf18f7975adfa5c37fcc4d0b7dbdc2"}
 *
 * Go source:
 * func GetAssignedName(node *Node) *Node {
 * 	parent := node.Parent
 * 	if parent != nil {
 * 		switch parent.Kind {
 * 		case KindPropertyAssignment:
 * 			return parent.AsPropertyAssignment().Name()
 * 		case KindBindingElement:
 * 			return parent.AsBindingElement().Name()
 * 		case KindBinaryExpression:
 * 			if node == parent.AsBinaryExpression().Right {
 * 				left := parent.AsBinaryExpression().Left
 * 				switch left.Kind {
 * 				case KindIdentifier:
 * 					return left
 * 				case KindPropertyAccessExpression:
 * 					return left.AsPropertyAccessExpression().Name()
 * 				case KindElementAccessExpression:
 * 					arg := SkipParentheses(left.AsElementAccessExpression().ArgumentExpression)
 * 					if IsStringOrNumericLiteralLike(arg) {
 * 						return arg
 * 					}
 * 				}
 * 			}
 * 		case KindVariableDeclaration:
 * 			name := parent.AsVariableDeclaration().Name()
 * 			if IsIdentifier(name) {
 * 				return name
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function GetAssignedName(node: GoPtr<Node>): GoPtr<Node> {
  const parent: GoPtr<Node> = node!.Parent;
  if (parent !== undefined) {
    switch (parent!.Kind) {
      case KindPropertyAssignment:
        return Node_Name(parent);
      case KindBindingElement:
        return Node_Name(parent);
      case KindBinaryExpression:
        if (node === AsBinaryExpression(parent)!.Right) {
          const left: GoPtr<Node> = AsBinaryExpression(parent)!.Left;
          switch (left!.Kind) {
            case KindIdentifier:
              return left;
            case KindPropertyAccessExpression:
              return Node_Name(left);
            case KindElementAccessExpression: {
              const arg: GoPtr<Node> = SkipParentheses(AsElementAccessExpression(left)!.ArgumentExpression);
              if (IsStringOrNumericLiteralLike(arg)) {
                return arg;
              }
            }
          }
        }
        break;
      case KindVariableDeclaration: {
        const name: GoPtr<Node> = Node_Name(parent);
        if (IsIdentifier(name)) {
          return name;
        }
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::type::JSDeclarationKind","kind":"type","status":"implemented","sigHash":"71f07fd1398e6c278acc29a5ce54eb8a36451280e0f43ba2a5337ced2c0db4b6","bodyHash":"3505f0f269ef4b5d2084b657eeb05f411a6f613ffb9154fc67b9ef14dfc4ad02"}
 *
 * Go source:
 * JSDeclarationKind int
 */
export type JSDeclarationKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::constGroup::JSDeclarationKindNone+JSDeclarationKindModuleExports+JSDeclarationKindExportsProperty+JSDeclarationKindThisProperty+JSDeclarationKindProperty+JSDeclarationKindObjectDefinePropertyValue+JSDeclarationKindObjectDefinePropertyExports","kind":"constGroup","status":"implemented","sigHash":"edc5782b1e5bad487b025d1b9e8686cc4f655021e6a3c3f0730dcaeee7ac94b3","bodyHash":"c85f55613d06720de6446b954fa98463b4d8e7153173b67beb940d07d6331b4d"}
 *
 * Go source:
 * const (
 * 	JSDeclarationKindNone JSDeclarationKind = iota
 * 	// module.exports = expr, except for module.exports = exports
 * 	JSDeclarationKindModuleExports
 * 	// exports.name = expr
 * 	// module.exports.name = expr
 * 	JSDeclarationKindExportsProperty
 * 	// this.name = expr
 * 	JSDeclarationKindThisProperty
 * 	// F.name = expr, F[name] = expr, in JS or TS file
 * 	JSDeclarationKindProperty
 * 	// Object.defineProperty(x, 'name', { value: any, writable?: boolean (false by default) });
 * 	// Object.defineProperty(x, 'name', { get: Function, set: Function });
 * 	// Object.defineProperty(x, 'name', { get: Function });
 * 	// Object.defineProperty(x, 'name', { set: Function });
 * 	JSDeclarationKindObjectDefinePropertyValue
 * 	// Object.defineProperty(exports || module.exports, 'name', ...);
 * 	JSDeclarationKindObjectDefinePropertyExports
 * )
 */
export const JSDeclarationKindNone: JSDeclarationKind = 0 as JSDeclarationKind;
// module.exports = expr, except for module.exports = exports
export const JSDeclarationKindModuleExports: JSDeclarationKind = 1 as JSDeclarationKind;
// exports.name = expr
// module.exports.name = expr
export const JSDeclarationKindExportsProperty: JSDeclarationKind = 2 as JSDeclarationKind;
// this.name = expr
export const JSDeclarationKindThisProperty: JSDeclarationKind = 3 as JSDeclarationKind;
// F.name = expr, F[name] = expr, in JS or TS file
export const JSDeclarationKindProperty: JSDeclarationKind = 4 as JSDeclarationKind;
// Object.defineProperty(x, 'name', { value: any, writable?: boolean (false by default) });
export const JSDeclarationKindObjectDefinePropertyValue: JSDeclarationKind = 5 as JSDeclarationKind;
// Object.defineProperty(exports || module.exports, 'name', ...);
export const JSDeclarationKindObjectDefinePropertyExports: JSDeclarationKind = 6 as JSDeclarationKind;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetAssignmentDeclarationKind","kind":"func","status":"implemented","sigHash":"68337cd1c4504407e7e0bc84ef47420e732cb070863e46dfaf893bab129a0a15","bodyHash":"4eac3880bb92dc9c0d4b7d7402acea5f1a8f5b174ddc0532ca5e1750f03342d8"}
 *
 * Go source:
 * func GetAssignmentDeclarationKind(node *Node) JSDeclarationKind {
 * 	switch node.Kind {
 * 	case KindBinaryExpression:
 * 		bin := node.AsBinaryExpression()
 * 		if bin.OperatorToken.Kind == KindEqualsToken && IsAccessExpression(bin.Left) {
 * 			if IsInJSFile(bin.Left) {
 * 				if IsModuleExportsAccessExpression(bin.Left) && !IsExportsIdentifier(bin.Right) {
 * 					return JSDeclarationKindModuleExports
 * 				}
 * 				if (IsModuleExportsAccessExpression(bin.Left.Expression()) || IsExportsIdentifier(bin.Left.Expression())) &&
 * 					GetElementOrPropertyAccessName(bin.Left) != nil {
 * 					return JSDeclarationKindExportsProperty
 * 				}
 * 				if bin.Left.Expression().Kind == KindThisKeyword {
 * 					return JSDeclarationKindThisProperty
 * 				}
 * 			}
 * 			if bin.Left.Kind == KindPropertyAccessExpression && IsEntityNameExpressionEx(bin.Left.Expression(), IsInJSFile(bin.Left)) && IsIdentifier(bin.Left.Name()) ||
 * 				bin.Left.Kind == KindElementAccessExpression && IsEntityNameExpressionEx(bin.Left.Expression(), IsInJSFile(bin.Left)) {
 * 				return JSDeclarationKindProperty
 * 			}
 * 		}
 * 	case KindCallExpression:
 * 		if IsInJSFile(node) && IsBindableObjectDefinePropertyCall(node) {
 * 			entityName := node.Arguments()[0]
 * 			if IsExportsIdentifier(entityName) || IsModuleExportsAccessExpression(entityName) {
 * 				return JSDeclarationKindObjectDefinePropertyExports
 * 			}
 * 			return JSDeclarationKindObjectDefinePropertyValue
 * 		}
 * 	}
 * 	return JSDeclarationKindNone
 * }
 */
export function GetAssignmentDeclarationKind(node: GoPtr<Node>): JSDeclarationKind {
  switch (node!.Kind) {
    case KindBinaryExpression: {
      const bin = AsBinaryExpression(node);
      if (bin!.OperatorToken!.Kind === KindEqualsToken && IsAccessExpression(bin!.Left)) {
        if (IsInJSFile(bin!.Left)) {
          if (IsModuleExportsAccessExpression(bin!.Left) && !IsExportsIdentifier(bin!.Right)) {
            return JSDeclarationKindModuleExports;
          }
          if ((IsModuleExportsAccessExpression(Node_Expression(bin!.Left)) || IsExportsIdentifier(Node_Expression(bin!.Left))) &&
            GetElementOrPropertyAccessName(bin!.Left) !== undefined) {
            return JSDeclarationKindExportsProperty;
          }
          if (Node_Expression(bin!.Left)!.Kind === KindThisKeyword) {
            return JSDeclarationKindThisProperty;
          }
        }
        if ((bin!.Left!.Kind === KindPropertyAccessExpression && IsEntityNameExpressionEx(Node_Expression(bin!.Left), IsInJSFile(bin!.Left)) && IsIdentifier(Node_Name(bin!.Left))) ||
          (bin!.Left!.Kind === KindElementAccessExpression && IsEntityNameExpressionEx(Node_Expression(bin!.Left), IsInJSFile(bin!.Left)))) {
          return JSDeclarationKindProperty;
        }
      }
      break;
    }
    case KindCallExpression:
      if (IsInJSFile(node) && IsBindableObjectDefinePropertyCall(node)) {
        const entityName: GoPtr<Node> = Node_Arguments(node)![0];
        if (IsExportsIdentifier(entityName) || IsModuleExportsAccessExpression(entityName)) {
          return JSDeclarationKindObjectDefinePropertyExports;
        }
        return JSDeclarationKindObjectDefinePropertyValue;
      }
      break;
  }
  return JSDeclarationKindNone;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsBindableObjectDefinePropertyCall","kind":"func","status":"implemented","sigHash":"bdcefe429a68f0ef875e039efb7c1455bcb9de7008e8d9701b4c86310ac72844","bodyHash":"425a66e22f8f879c275e7154ca1a6e54af6565c0fc7ed4e0e6a0ef7ef7991def"}
 *
 * Go source:
 * func IsBindableObjectDefinePropertyCall(node *Node) bool {
 * 	if args := node.Arguments(); len(args) == 3 {
 * 		if expr := node.Expression(); IsPropertyAccessExpression(expr) &&
 * 			IsIdentifier(expr.Expression()) && expr.Expression().Text() == "Object" &&
 * 			expr.Name().Text() == "defineProperty" &&
 * 			IsStringOrNumericLiteralLike(args[1]) &&
 * 			IsBindableStaticNameExpression(args[0] /*excludeThisKeyword* /, true) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function IsBindableObjectDefinePropertyCall(node: GoPtr<Node>): bool {
  const args = Node_Arguments(node);
  if (args !== undefined && args.length === 3) {
    const expr: GoPtr<Node> = Node_Expression(node);
    if (IsPropertyAccessExpression(expr) &&
      IsIdentifier(Node_Expression(expr)) && Node_Text(Node_Expression(expr)) === "Object" &&
      Node_Text(Node_Name(expr)) === "defineProperty" &&
      IsStringOrNumericLiteralLike(args[1]) &&
      IsBindableStaticNameExpression(args[0], true /*excludeThisKeyword*/)) {
      return true as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasDynamicName","kind":"func","status":"implemented","sigHash":"3a1df619360594b6d507bf501c972844ea3e156a6453dfe21a9b31954dff91a3","bodyHash":"e6cb13812ac33df38512749d3713dee559e357c6e047bab64f8cfca165feb911"}
 *
 * Go source:
 * func HasDynamicName(declaration *Node) bool {
 * 	name := GetNameOfDeclaration(declaration)
 * 	return name != nil && IsDynamicName(name)
 * }
 */
export function HasDynamicName(declaration: GoPtr<Node>): bool {
  const name: GoPtr<Node> = GetNameOfDeclaration(declaration);
  return (name !== undefined && IsDynamicName(name)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsDynamicName","kind":"func","status":"implemented","sigHash":"43155b0d310866978bee14ee8600f0f804fa0e323d028a3e78533ff36410f13f","bodyHash":"e6cb5a60af38d696fabe6c565b901a3017255057c76177d0854563a3260aaa5d"}
 *
 * Go source:
 * func IsDynamicName(name *Node) bool {
 * 	var expr *Node
 * 	switch name.Kind {
 * 	case KindComputedPropertyName:
 * 		expr = name.Expression()
 * 	case KindElementAccessExpression:
 * 		expr = SkipParentheses(name.AsElementAccessExpression().ArgumentExpression)
 * 	default:
 * 		return false
 * 	}
 * 	return !IsStringOrNumericLiteralLike(expr) && !IsSignedNumericLiteral(expr)
 * }
 */
export function IsDynamicName(name: GoPtr<Node>): bool {
  const expr: GoPtr<Node> =
    name!.Kind === KindComputedPropertyName ? Node_Expression(name) :
    name!.Kind === KindElementAccessExpression ? SkipParentheses(AsElementAccessExpression(name)!.ArgumentExpression) :
    undefined;
  if (expr === undefined) return false as bool;
  return (!IsStringOrNumericLiteralLike(expr) && !IsSignedNumericLiteral(expr)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsEntityNameExpression","kind":"func","status":"implemented","sigHash":"200b5ed8d68e3578624281e40dda61eef732bc731fe35952e4f11b034c820658","bodyHash":"5186adb9c206fcfa6787d7955674e1cc0f8397296214e314c0ecef1bd2e161fc"}
 *
 * Go source:
 * func IsEntityNameExpression(node *Node) bool {
 * 	return IsEntityNameExpressionEx(node, false /*allowJS* /)
 * }
 */
export function IsEntityNameExpression(node: GoPtr<Node>): bool {
  return IsEntityNameExpressionEx(node, false /*allowJS*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsEntityNameExpressionEx","kind":"func","status":"implemented","sigHash":"b05857af38b074bc338d2b1ffabdc6eab8dce9fb61d999b92c4bd493e2b11310","bodyHash":"7406c32cf04b0612d97ef62e8a10dd2f46fef0509c06648f05a69ddf7358a598"}
 *
 * Go source:
 * func IsEntityNameExpressionEx(node *Node, allowJS bool) bool {
 * 	return IsIdentifier(node) ||
 * 		IsPropertyAccessEntityNameExpression(node, allowJS) ||
 * 		allowJS && (node.Kind == KindThisKeyword || isElementAccessEntityNameExpression(node, allowJS))
 * }
 */
export function IsEntityNameExpressionEx(node: GoPtr<Node>, allowJS: bool): bool {
  return (IsIdentifier(node) ||
    IsPropertyAccessEntityNameExpression(node, allowJS) ||
    (allowJS && (node!.Kind === KindThisKeyword || isElementAccessEntityNameExpression(node, allowJS)))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPropertyAccessEntityNameExpression","kind":"func","status":"implemented","sigHash":"37886e4bd75cf53bd852a11e04cff2cc9b27e6d606486d1602ff5db7798a661a","bodyHash":"1ae0527399d11a51fe81a2b7906341ae2f774bee5253a81dc25b448c0d911637"}
 *
 * Go source:
 * func IsPropertyAccessEntityNameExpression(node *Node, allowJS bool) bool {
 * 	return IsPropertyAccessExpression(node) && IsIdentifier(node.Name()) && IsEntityNameExpressionEx(node.Expression(), allowJS)
 * }
 */
export function IsPropertyAccessEntityNameExpression(node: GoPtr<Node>, allowJS: bool): bool {
  return (IsPropertyAccessExpression(node) && IsIdentifier(Node_Name(node)) &&
    IsEntityNameExpressionEx(Node_Expression(node), allowJS)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isElementAccessEntityNameExpression","kind":"func","status":"implemented","sigHash":"d9059065becdb3634d5053fabba1154ed4bbbded5386c674485ed639fe4e8ded","bodyHash":"403c6e48891a3c3539847b4ebd838110bb35193f0d03e054f91be25731c948c2"}
 *
 * Go source:
 * func isElementAccessEntityNameExpression(node *Node, allowJS bool) bool {
 * 	return IsElementAccessExpression(node) && IsStringOrNumericLiteralLike(node.AsElementAccessExpression().ArgumentExpression) && IsEntityNameExpressionEx(node.Expression(), allowJS)
 * }
 */
export function isElementAccessEntityNameExpression(node: GoPtr<Node>, allowJS: bool): bool {
  return (IsElementAccessExpression(node) &&
    IsStringOrNumericLiteralLike(AsElementAccessExpression(node)!.ArgumentExpression) &&
    IsEntityNameExpressionEx(Node_Expression(node), allowJS)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsDottedName","kind":"func","status":"implemented","sigHash":"63b48d2c6ffcb6bf0e976f0de9df2b5f24f259b8b87742f3fd82046598c2004d","bodyHash":"c8fc1c227dd261232d63adcd5ac5bb5040985c16c8f80cd092eee9fc2af1841d"}
 *
 * Go source:
 * func IsDottedName(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindIdentifier, KindThisKeyword, KindSuperKeyword, KindMetaProperty:
 * 		return true
 * 	case KindPropertyAccessExpression, KindParenthesizedExpression:
 * 		return IsDottedName(node.Expression())
 * 	}
 * 	return false
 * }
 */
export function IsDottedName(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindIdentifier:
    case KindThisKeyword:
    case KindSuperKeyword:
    case KindMetaProperty:
      return true as bool;
    case KindPropertyAccessExpression:
    case KindParenthesizedExpression:
      return IsDottedName(Node_Expression(node));
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasSamePropertyAccessName","kind":"func","status":"implemented","sigHash":"a948c146317cab9f5dae49a337ce1bd865a91228980460ba988f0cb59d875b8a","bodyHash":"1a8f4bda690bd0602c8c16c4ebd61cb1ea95d9fa3aa5cf3e146f45f13baa5374"}
 *
 * Go source:
 * func HasSamePropertyAccessName(node1, node2 *Node) bool {
 * 	if node1.Kind == KindIdentifier && node2.Kind == KindIdentifier {
 * 		return node1.Text() == node2.Text()
 * 	} else if node1.Kind == KindPropertyAccessExpression && node2.Kind == KindPropertyAccessExpression {
 * 		return node1.AsPropertyAccessExpression().Name().Text() == node2.AsPropertyAccessExpression().Name().Text() &&
 * 			HasSamePropertyAccessName(node1.Expression(), node2.Expression())
 * 	}
 * 	return false
 * }
 */
export function HasSamePropertyAccessName(node1: GoPtr<Node>, node2: GoPtr<Node>): bool {
  if (node1!.Kind === KindIdentifier && node2!.Kind === KindIdentifier) {
    return (Node_Text(node1) === Node_Text(node2)) as bool;
  } else if (node1!.Kind === KindPropertyAccessExpression && node2!.Kind === KindPropertyAccessExpression) {
    return (Node_Text(Node_Name(node1)) === Node_Text(Node_Name(node2)) &&
      HasSamePropertyAccessName(Node_Expression(node1), Node_Expression(node2))) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsAmbientModule","kind":"func","status":"implemented","sigHash":"896eb55f2a850f845d88142b941d7fdb515d1429f8814a28f84dfc686777af23","bodyHash":"499c26a4e56c88d081b3fca120303f395ccbc36215b5d0c59ab572ad4760fb8a"}
 *
 * Go source:
 * func IsAmbientModule(node *Node) bool {
 * 	return IsModuleDeclaration(node) && (node.AsModuleDeclaration().Name().Kind == KindStringLiteral || IsGlobalScopeAugmentation(node))
 * }
 */
export function IsAmbientModule(node: GoPtr<Node>): bool {
  return (IsModuleDeclaration(node) &&
    (Node_Name(node)!.Kind === KindStringLiteral || IsGlobalScopeAugmentation(node))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsExternalModule","kind":"func","status":"implemented","sigHash":"f5111c96d2c51c16b2b2b2dc4717b8be46662212f86238682cbdd6b0be7b86fd","bodyHash":"636ea47f8f4e0323542ce7bd8251cfa1e2fee73c3b7d7151373d4bf5f9ff0298"}
 *
 * Go source:
 * func IsExternalModule(file *SourceFile) bool {
 * 	return file.ExternalModuleIndicator != nil
 * }
 */
export function IsExternalModule(file: GoPtr<SourceFile>): bool {
  return (file!.ExternalModuleIndicator !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsExternalOrCommonJSModule","kind":"func","status":"implemented","sigHash":"50d9b1c743c8575d8b98acb0604c5f32afd370da79273878252a662ce1841a3a","bodyHash":"e239b1588abae7bd7d4c2ee500740105845ebdfa33fab22b63ab0e4ad6ed21df"}
 *
 * Go source:
 * func IsExternalOrCommonJSModule(file *SourceFile) bool {
 * 	return file.ExternalModuleIndicator != nil || file.CommonJSModuleIndicator != nil
 * }
 */
export function IsExternalOrCommonJSModule(file: GoPtr<SourceFile>): bool {
  return (file!.ExternalModuleIndicator !== undefined || file!.CommonJSModuleIndicator !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsEffectiveExternalModule","kind":"func","status":"implemented","sigHash":"bc5454c2f7cc5591b6e11d000e85fffd4d294a0c441e5d9efff99b6831964205","bodyHash":"e317d886d299425d9991ff5ae72dd2b70ad9219a6599fb34ebcd111018410e10"}
 *
 * Go source:
 * func IsEffectiveExternalModule(node *SourceFile, compilerOptions *core.CompilerOptions) bool {
 * 	return IsExternalModule(node) || (isCommonJSContainingModuleKind(compilerOptions.GetEmitModuleKind()) && node.CommonJSModuleIndicator != nil)
 * }
 */
export function IsEffectiveExternalModule(node: GoPtr<SourceFile>, compilerOptions: GoPtr<CompilerOptions>): bool {
  return (IsExternalModule(node) ||
    (isCommonJSContainingModuleKind(CompilerOptions_GetEmitModuleKind(compilerOptions)) && node!.CommonJSModuleIndicator !== undefined)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isCommonJSContainingModuleKind","kind":"func","status":"implemented","sigHash":"f24f335c5510fb150503415a1385c78317295492e1019075803768212dc18421","bodyHash":"e0555698254e2b7d5237b731808baa896b91d91f619fcf45570187d38cd904dc"}
 *
 * Go source:
 * func isCommonJSContainingModuleKind(kind core.ModuleKind) bool {
 * 	return kind == core.ModuleKindCommonJS || core.ModuleKindNode16 <= kind && kind <= core.ModuleKindNodeNext
 * }
 */
export function isCommonJSContainingModuleKind(kind: ModuleKind): bool {
  return (kind === ModuleKindCommonJS || (ModuleKindNode16 <= kind && kind <= ModuleKindNodeNext)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsExternalModuleIndicator","kind":"func","status":"implemented","sigHash":"b79cbc53b3f7105cf24752794d82eb459630c61ee18d4431ba8dcc94334401eb","bodyHash":"7388ecdc90ffa7fc64cc1a2e7cd6705d09e3d53407c76cfdc40f21b4787c68f8"}
 *
 * Go source:
 * func IsExternalModuleIndicator(node *Statement) bool {
 * 	// Exported top-level member indicates moduleness
 * 	return IsAnyImportOrReExport(node) || IsExportAssignment(node) || HasSyntacticModifier(node, ModifierFlagsExport)
 * }
 */
export function IsExternalModuleIndicator(node: GoPtr<Statement>): bool {
  // Exported top-level member indicates moduleness
  return (IsAnyImportOrReExport(node) || IsExportAssignment(node) || HasSyntacticModifier(node, ModifierFlagsExport)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsExportNamespaceAsDefaultDeclaration","kind":"func","status":"implemented","sigHash":"2e1c9576485bb6c7865526c4ed8aaf3def9968f9ace73a455aa7dbf2374783fc","bodyHash":"18c3aff525af7e649a89c5a821bc565a9f15d09a5683140b5d8116bb681b8a5c"}
 *
 * Go source:
 * func IsExportNamespaceAsDefaultDeclaration(node *Node) bool {
 * 	if IsExportDeclaration(node) {
 * 		decl := node.AsExportDeclaration()
 * 		return IsNamespaceExport(decl.ExportClause) && ModuleExportNameIsDefault(decl.ExportClause.Name())
 * 	}
 * 	return false
 * }
 */
export function IsExportNamespaceAsDefaultDeclaration(node: GoPtr<Node>): bool {
  if (IsExportDeclaration(node)) {
    const decl = AsExportDeclaration(node);
    return (IsNamespaceExport(decl!.ExportClause) && ModuleExportNameIsDefault(Node_Name(decl!.ExportClause))) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsGlobalScopeAugmentation","kind":"func","status":"implemented","sigHash":"7260d00fe04068728edd601ba7581f0570dcd307a0bc5f0dbe9749066f48b9bb","bodyHash":"adb03ef31b085e2c4e4ef1f7079651bdaf817b44bcc312944d05e5f0c5868eba"}
 *
 * Go source:
 * func IsGlobalScopeAugmentation(node *Node) bool {
 * 	return IsModuleDeclaration(node) && node.AsModuleDeclaration().Keyword == KindGlobalKeyword
 * }
 */
export function IsGlobalScopeAugmentation(node: GoPtr<Node>): bool {
  return (IsModuleDeclaration(node) && AsModuleDeclaration(node)!.Keyword === KindGlobalKeyword) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsModuleAugmentationExternal","kind":"func","status":"implemented","sigHash":"4878b66b85248d69621b60c957973260495f94c95e44ce5193c97b75462cb89f","bodyHash":"0d48e6d8145f7f3518fe91ddf63c7702908b62dfd1b4c266a5d2e1d23f65117c"}
 *
 * Go source:
 * func IsModuleAugmentationExternal(node *Node) bool {
 * 	// external module augmentation is a ambient module declaration that is either:
 * 	// - defined in the top level scope and source file is an external module
 * 	// - defined inside ambient module declaration located in the top level scope and source file not an external module
 * 	switch node.Parent.Kind {
 * 	case KindSourceFile:
 * 		return IsExternalModule(node.Parent.AsSourceFile())
 * 	case KindModuleBlock:
 * 		grandParent := node.Parent.Parent
 * 		return IsAmbientModule(grandParent) && IsSourceFile(grandParent.Parent) && !IsExternalModule(grandParent.Parent.AsSourceFile())
 * 	}
 * 	return false
 * }
 */
export function IsModuleAugmentationExternal(node: GoPtr<Node>): bool {
  // external module augmentation is a ambient module declaration that is either:
  // - defined in the top level scope and source file is an external module
  // - defined inside ambient module declaration located in the top level scope and source file not an external module
  switch (node!.Parent!.Kind) {
    case KindSourceFile:
      return IsExternalModule(AsSourceFile(node!.Parent));
    case KindModuleBlock: {
      const grandParent: GoPtr<Node> = node!.Parent!.Parent;
      return (IsAmbientModule(grandParent) && IsSourceFile(grandParent!.Parent) && !IsExternalModule(AsSourceFile(grandParent!.Parent))) as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsModuleWithStringLiteralName","kind":"func","status":"implemented","sigHash":"6d931ee29c32f0bf8d54c76870d92d95248a6b5d47ef5a2140a226288334dcf3","bodyHash":"d3d8c2bdb289f57f7bff27f0285ec7d4be9608380684288d384ef73d3261f821"}
 *
 * Go source:
 * func IsModuleWithStringLiteralName(node *Node) bool {
 * 	return IsModuleDeclaration(node) && node.Name().Kind == KindStringLiteral
 * }
 */
export function IsModuleWithStringLiteralName(node: GoPtr<Node>): bool {
  return (IsModuleDeclaration(node) && Node_Name(node)!.Kind === KindStringLiteral) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetContainingClass","kind":"func","status":"implemented","sigHash":"b93a7b14defdb5f9a7f2407933ff669eba46cb22934c84d1417aababe59c4bbf","bodyHash":"cb7064125a82fe8685141e5e921ba3464168df5230a787a1d2dcb2b4e53176a5"}
 *
 * Go source:
 * func GetContainingClass(node *Node) *Node {
 * 	return FindAncestor(node.Parent, IsClassLike)
 * }
 */
export function GetContainingClass(node: GoPtr<Node>): GoPtr<Node> {
  return FindAncestor(node!.Parent, IsClassLike);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetExtendsHeritageClauseElement","kind":"func","status":"implemented","sigHash":"aa14431031cb3b484d3b5235f9ae1d2f22e5108a893ed0da17debd8b0190d87d","bodyHash":"8ebe7b30c73649b541a74c00365cfb3ade8d5cb8e2cb6e2da5863358b9400873"}
 *
 * Go source:
 * func GetExtendsHeritageClauseElement(node *Node) *ExpressionWithTypeArgumentsNode {
 * 	return core.FirstOrNil(GetExtendsHeritageClauseElements(node))
 * }
 */
export function GetExtendsHeritageClauseElement(node: GoPtr<Node>): GoPtr<ExpressionWithTypeArgumentsNode> {
  return FirstOrNil(GetExtendsHeritageClauseElements(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetExtendsHeritageClauseElements","kind":"func","status":"implemented","sigHash":"755d42639b42957eb5d04510a846ff99ac6c87b4a46138c66b97504ddef10c00","bodyHash":"2f1d78b4839e017e9e134b780a61e1f637880cb5f3c836412befe1c07991a6ba"}
 *
 * Go source:
 * func GetExtendsHeritageClauseElements(node *Node) []*ExpressionWithTypeArgumentsNode {
 * 	return GetHeritageElements(node, KindExtendsKeyword)
 * }
 */
export function GetExtendsHeritageClauseElements(node: GoPtr<Node>): GoSlice<GoPtr<ExpressionWithTypeArgumentsNode>> {
  return GetHeritageElements(node, KindExtendsKeyword);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetImplementsHeritageClauseElements","kind":"func","status":"implemented","sigHash":"c6e8dbac214883ac45263f375b1a7740bfd64d163c0faba8d82e51c673c8b686","bodyHash":"b4a372a12ad46c5f7799862c6211d5db2fc54768deeaf000b3c30eddedcef051"}
 *
 * Go source:
 * func GetImplementsHeritageClauseElements(node *Node) []*ExpressionWithTypeArgumentsNode {
 * 	return GetHeritageElements(node, KindImplementsKeyword)
 * }
 */
export function GetImplementsHeritageClauseElements(node: GoPtr<Node>): GoSlice<GoPtr<ExpressionWithTypeArgumentsNode>> {
  return GetHeritageElements(node, KindImplementsKeyword);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetHeritageElements","kind":"func","status":"implemented","sigHash":"67ba33008c49a5e27f901d3c71680837142ebbb329ca49778d9bed1daa744542","bodyHash":"f2021f5553e964f53dab867a2467f5897558610bc9482835dff13adf8d486945"}
 *
 * Go source:
 * func GetHeritageElements(node *Node, kind Kind) []*Node {
 * 	clause := GetHeritageClause(node, kind)
 * 	if clause != nil {
 * 		return clause.AsHeritageClause().Types.Nodes
 * 	}
 * 	return nil
 * }
 */
export function GetHeritageElements(node: GoPtr<Node>, kind: Kind): GoSlice<GoPtr<Node>> {
  const clause = GetHeritageClause(node, kind);
  if (clause !== undefined) {
    return AsHeritageClause(clause)!.Types!.Nodes ?? [];
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetHeritageClause","kind":"func","status":"implemented","sigHash":"d781afd15c86e5621c2190c336f2b625a2b38da29d7b1b98527e0df1b4ef1ca8","bodyHash":"20ca96c2db906858db2408651f4a863197095cd987f927e194825f10bf4dcb2e"}
 *
 * Go source:
 * func GetHeritageClause(node *Node, kind Kind) *Node {
 * 	clauses := getHeritageClauses(node)
 * 	if clauses != nil {
 * 		for _, clause := range clauses.Nodes {
 * 			if clause.AsHeritageClause().Token == kind {
 * 				return clause
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function GetHeritageClause(node: GoPtr<Node>, kind: Kind): GoPtr<Node> {
  const clauses: GoPtr<NodeList> = getHeritageClauses(node);
  if (clauses !== undefined) {
    for (const clause of clauses!.Nodes) {
      if (AsHeritageClause(clause)!.Token === kind) {
        return clause;
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::getHeritageClauses","kind":"func","status":"implemented","sigHash":"a73356ef1b7d69a1930b6795f3f485deba0737b9b1f9f478780f64e2dc16450e","bodyHash":"de6cb0c654db293c49dfc98c9257bada130393dadf7aafa578aa55c637f85cad"}
 *
 * Go source:
 * func getHeritageClauses(node *Node) *NodeList {
 * 	switch node.Kind {
 * 	case KindClassDeclaration:
 * 		return node.AsClassDeclaration().HeritageClauses
 * 	case KindClassExpression:
 * 		return node.AsClassExpression().HeritageClauses
 * 	case KindInterfaceDeclaration:
 * 		return node.AsInterfaceDeclaration().HeritageClauses
 * 	}
 * 	return nil
 * }
 */
export function getHeritageClauses(node: GoPtr<Node>): GoPtr<NodeList> {
  switch (node!.Kind) {
    case KindClassDeclaration:
      return AsClassDeclaration(node)!.HeritageClauses;
    case KindClassExpression:
      return AsClassExpression(node)!.HeritageClauses;
    case KindInterfaceDeclaration:
      return AsInterfaceDeclaration(node)!.HeritageClauses;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPartOfTypeQuery","kind":"func","status":"implemented","sigHash":"61b00fc651234789357dd2c81f21af8a908360dae7488de93a1c0558820396ca","bodyHash":"266f647bfaf59f952b0f3bae0e1da297565394cea281351df112c95acbb516c9"}
 *
 * Go source:
 * func IsPartOfTypeQuery(node *Node) bool {
 * 	for node.Kind == KindQualifiedName || node.Kind == KindIdentifier {
 * 		node = node.Parent
 * 	}
 * 	return node.Kind == KindTypeQuery
 * }
 */
export function IsPartOfTypeQuery(node: GoPtr<Node>): bool {
  const loop = (current: GoPtr<Node>): bool => {
    if (current!.Kind !== KindQualifiedName && current!.Kind !== KindIdentifier) return (current!.Kind === KindTypeQuery) as bool;
    return loop(current!.Parent);
  };
  return loop(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPartOfParameterDeclaration","kind":"func","status":"implemented","sigHash":"3cc664798a46e3c10c6588a3791a193b0407f4db3c565955ae42df59c1c01d36","bodyHash":"173a0568bd86fbac902ccc85b2778194dd2b023d77633bbe2158d7d754c84a20"}
 *
 * Go source:
 * func IsPartOfParameterDeclaration(node *Node) bool {
 * 	return GetRootDeclaration(node).Kind == KindParameter
 * }
 */
export function IsPartOfParameterDeclaration(node: GoPtr<Node>): bool {
  return (GetRootDeclaration(node)!.Kind === KindParameter) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsInTopLevelContext","kind":"func","status":"implemented","sigHash":"d268e0e1c3b81557b06b1a7a1b1bfd6a0d774d54263d4f5b5aae441e77273b17","bodyHash":"48eca5e6194041fac2df995d05a7eab720137da672a533e7bf7e70020824120f"}
 *
 * Go source:
 * func IsInTopLevelContext(node *Node) bool {
 * 	// The name of a class or function declaration is a BindingIdentifier in its surrounding scope.
 * 	if IsIdentifier(node) {
 * 		parent := node.Parent
 * 		if (IsClassDeclaration(parent) || IsFunctionDeclaration(parent)) && parent.Name() == node {
 * 			node = parent
 * 		}
 * 	}
 * 	container := GetThisContainer(node, true /*includeArrowFunctions* /, false /*includeClassComputedPropertyName* /)
 * 	return IsSourceFile(container)
 * }
 */
export function IsInTopLevelContext(node: GoPtr<Node>): bool {
  // The name of a class or function declaration is a BindingIdentifier in its surrounding scope.
  const effective: GoPtr<Node> = IsIdentifier(node) &&
    (IsClassDeclaration(node!.Parent) || IsFunctionDeclaration(node!.Parent)) &&
    Node_Name(node!.Parent) === node
    ? node!.Parent
    : node;
  const container: GoPtr<Node> = GetThisContainer(effective, true /*includeArrowFunctions*/, false /*includeClassComputedPropertyName*/);
  return IsSourceFile(container);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetThisContainer","kind":"func","status":"implemented","sigHash":"eb3d10985796589c17e8e307aaa72120c10614745520b3e86e34d43c7a9047cf","bodyHash":"fc5623e755afbce216f0d9bdbc1f8947691a3100fb6add09325562efbf2dafab"}
 *
 * Go source:
 * func GetThisContainer(node *Node, includeArrowFunctions bool, includeClassComputedPropertyName bool) *Node {
 * 	for {
 * 		node = node.Parent
 * 		if node == nil {
 * 			panic("nil parent in getThisContainer")
 * 		}
 * 		switch node.Kind {
 * 		case KindComputedPropertyName:
 * 			if includeClassComputedPropertyName && IsClassLike(node.Parent.Parent) {
 * 				return node
 * 			}
 * 			node = node.Parent.Parent
 * 		case KindDecorator:
 * 			if node.Parent.Kind == KindParameter && IsClassElement(node.Parent.Parent) {
 * 				// If the decorator's parent is a ParameterDeclaration, we resolve the this container from
 * 				// the grandparent class declaration.
 * 				node = node.Parent.Parent
 * 			} else if IsClassElement(node.Parent) {
 * 				// If the decorator's parent is a class element, we resolve the 'this' container
 * 				// from the parent class declaration.
 * 				node = node.Parent
 * 			}
 * 		case KindArrowFunction:
 * 			if includeArrowFunctions {
 * 				return node
 * 			}
 * 		case KindFunctionDeclaration, KindFunctionExpression, KindModuleDeclaration, KindClassStaticBlockDeclaration,
 * 			KindPropertyDeclaration, KindPropertySignature, KindMethodDeclaration, KindMethodSignature, KindConstructor,
 * 			KindGetAccessor, KindSetAccessor, KindCallSignature, KindConstructSignature, KindIndexSignature,
 * 			KindEnumDeclaration, KindSourceFile:
 * 			return node
 * 		}
 * 	}
 * }
 */
export function GetThisContainer(node: GoPtr<Node>, includeArrowFunctions: bool, includeClassComputedPropertyName: bool): GoPtr<Node> {
  const loop = (n: GoPtr<Node>): GoPtr<Node> => {
    if (n === undefined) throw new globalThis.Error("nil parent in getThisContainer");
    switch (n!.Kind) {
      case KindComputedPropertyName:
        if (includeClassComputedPropertyName && IsClassLike(n!.Parent!.Parent)) return n;
        return loop(n!.Parent!.Parent!.Parent);
      case KindDecorator:
        if (n!.Parent!.Kind === KindParameter && IsClassElement(n!.Parent!.Parent)) {
          // If the decorator's parent is a ParameterDeclaration, we resolve the this container from
          // the grandparent class declaration.
          return loop(n!.Parent!.Parent!.Parent);
        } else if (IsClassElement(n!.Parent)) {
          // If the decorator's parent is a class element, we resolve the 'this' container
          // from the parent class declaration.
          return loop(n!.Parent!.Parent);
        }
        return loop(n!.Parent);
      case KindArrowFunction:
        if (includeArrowFunctions) return n;
        return loop(n!.Parent);
      case KindFunctionDeclaration:
      case KindFunctionExpression:
      case KindModuleDeclaration:
      case KindClassStaticBlockDeclaration:
      case KindPropertyDeclaration:
      case KindPropertySignature:
      case KindMethodDeclaration:
      case KindMethodSignature:
      case KindConstructor:
      case KindGetAccessor:
      case KindSetAccessor:
      case KindCallSignature:
      case KindConstructSignature:
      case KindIndexSignature:
      case KindEnumDeclaration:
      case KindSourceFile:
        return n;
      default:
        return loop(n!.Parent);
    }
  };
  return loop(node!.Parent);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetSuperContainer","kind":"func","status":"implemented","sigHash":"cd5ccb43fed2fc682e5aab6e87df7a2d65bc43617a82a8a41809c628cbee99b2","bodyHash":"4743c04e20b2e296c68d933ed709a5d095a18a5a17d4b25345d93453566d4342"}
 *
 * Go source:
 * func GetSuperContainer(node *Node, stopOnFunctions bool) *Node {
 * 	for node = node.Parent; node != nil; node = node.Parent {
 * 		switch node.Kind {
 * 		case KindComputedPropertyName:
 * 			node = node.Parent
 * 		case KindFunctionDeclaration, KindFunctionExpression, KindArrowFunction:
 * 			if !stopOnFunctions {
 * 				continue
 * 			}
 * 			return node
 * 		case KindPropertyDeclaration, KindPropertySignature, KindMethodDeclaration, KindMethodSignature, KindConstructor, KindGetAccessor, KindSetAccessor, KindClassStaticBlockDeclaration:
 * 			return node
 * 		case KindDecorator:
 * 			// Decorators are always applied outside of the body of a class or method.
 * 			if node.Parent.Kind == KindParameter && IsClassElement(node.Parent.Parent) {
 * 				// If the decorator's parent is a ParameterDeclaration, we resolve the this container from
 * 				// the grandparent class declaration.
 * 				node = node.Parent.Parent
 * 			} else if IsClassElement(node.Parent) {
 * 				// If the decorator's parent is a class element, we resolve the 'this' container
 * 				// from the parent class declaration.
 * 				node = node.Parent
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function GetSuperContainer(node: GoPtr<Node>, stopOnFunctions: bool): GoPtr<Node> {
  const loop = (n: GoPtr<Node>): GoPtr<Node> => {
    if (n === undefined) return undefined;
    switch (n!.Kind) {
      case KindComputedPropertyName:
        return loop(n!.Parent!.Parent);
      case KindFunctionDeclaration:
      case KindFunctionExpression:
      case KindArrowFunction:
        if (!stopOnFunctions) return loop(n!.Parent);
        return n;
      case KindPropertyDeclaration:
      case KindPropertySignature:
      case KindMethodDeclaration:
      case KindMethodSignature:
      case KindConstructor:
      case KindGetAccessor:
      case KindSetAccessor:
      case KindClassStaticBlockDeclaration:
        return n;
      case KindDecorator:
        // Decorators are always applied outside of the body of a class or method.
        if (n!.Parent!.Kind === KindParameter && IsClassElement(n!.Parent!.Parent)) {
          // If the decorator's parent is a ParameterDeclaration, we resolve the this container from
          // the grandparent class declaration.
          return loop(n!.Parent!.Parent!.Parent);
        } else if (IsClassElement(n!.Parent)) {
          // If the decorator's parent is a class element, we resolve the 'this' container
          // from the parent class declaration.
          return loop(n!.Parent!.Parent);
        }
        return loop(n!.Parent);
      default:
        return loop(n!.Parent);
    }
  };
  return loop(node!.Parent);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetImmediatelyInvokedFunctionExpression","kind":"func","status":"implemented","sigHash":"b19184b5ac259dbda3f1ba2a227d4a80ddaade923ff33b39bc3c84aec41ced1a","bodyHash":"e8e0de4309519f72eac13faecda0328dc9ccd8dac5f166b8c239dd47760a5ec3"}
 *
 * Go source:
 * func GetImmediatelyInvokedFunctionExpression(fn *Node) *Node {
 * 	if IsFunctionExpressionOrArrowFunction(fn) {
 * 		prev := fn
 * 		parent := fn.Parent
 * 		for IsParenthesizedExpression(parent) {
 * 			prev = parent
 * 			parent = parent.Parent
 * 		}
 * 		if IsCallExpression(parent) && parent.Expression() == prev {
 * 			return parent
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function GetImmediatelyInvokedFunctionExpression(fn: GoPtr<Node>): GoPtr<Node> {
  if (IsFunctionExpressionOrArrowFunction(fn)) {
    const loop = (prev: GoPtr<Node>, parent: GoPtr<Node>): GoPtr<Node> => {
      if (!IsParenthesizedExpression(parent)) {
        return (IsCallExpression(parent) && Node_Expression(parent) === prev) ? parent : undefined;
      }
      return loop(parent, parent!.Parent);
    };
    return loop(fn, fn!.Parent);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsEnumConst","kind":"func","status":"implemented","sigHash":"e873f151eff3946ffd1f2efb6b136e2d3611b06d35e056642344a0c7eb566eb8","bodyHash":"08ef37bf33a36f2df7ce47fdf4dca54026a2353403389330e6a58abf4534e260"}
 *
 * Go source:
 * func IsEnumConst(node *Node) bool {
 * 	return GetCombinedModifierFlags(node)&ModifierFlagsConst != 0
 * }
 */
export function IsEnumConst(node: GoPtr<Node>): bool {
  return ((GetCombinedModifierFlags(node) & ModifierFlagsConst) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::ExpressionIsAlias","kind":"func","status":"implemented","sigHash":"8cc65c49c3f2bb8e9b014c8deb40dfdc52d7abf31a9cf6ab8ac162a0ada6545d","bodyHash":"1c1420647ec0431cb873420b9ab1a4855c0b1a07d7ef5bdf9cb4c9d169a2f62d"}
 *
 * Go source:
 * func ExpressionIsAlias(node *Node) bool {
 * 	return IsEntityNameExpression(node) || IsClassExpression(node)
 * }
 */
export function ExpressionIsAlias(node: GoPtr<Node>): bool {
  return (IsEntityNameExpression(node) || IsClassExpression(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsInstanceOfExpression","kind":"func","status":"implemented","sigHash":"226d627b672a868fbba3a33c2cdf5d466c3ddde3441e0386429ffdc6afa17f22","bodyHash":"c39e242ab8b8ad95925721fc96cd4f32a7b882966e4537e38a62a0710d26dc07"}
 *
 * Go source:
 * func IsInstanceOfExpression(node *Node) bool {
 * 	return IsBinaryExpression(node) && node.AsBinaryExpression().OperatorToken.Kind == KindInstanceOfKeyword
 * }
 */
export function IsInstanceOfExpression(node: GoPtr<Node>): bool {
  return (IsBinaryExpression(node) && AsBinaryExpression(node)!.OperatorToken!.Kind === KindInstanceOfKeyword) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsAnyImportOrReExport","kind":"func","status":"implemented","sigHash":"2008e8953f4def086cb119c03bad73e743afeb872bb65dfd1c465ace0cd86354","bodyHash":"379ba3ab29545d03f7ece2aabd63b9888e6654e610e2708825936cbca1f7c736"}
 *
 * Go source:
 * func IsAnyImportOrReExport(node *Node) bool {
 * 	return IsImportNode(node) || IsExportDeclaration(node)
 * }
 */
export function IsAnyImportOrReExport(node: GoPtr<Node>): bool {
  return (IsImportNode(node) || IsExportDeclaration(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsImportNode","kind":"func","status":"implemented","sigHash":"b8159bda154ecea91bc05c96961da9dbbdb6156a56cec79f54aac977d09a1985","bodyHash":"60187c8fa8988867c7644bb6fc1fd8981f68f532a3251262ed4655bc6456acba"}
 *
 * Go source:
 * func IsImportNode(node *Node) bool {
 * 	return IsAnyImportSyntax(node) || NodeKindIs(node, KindJSImportDeclaration)
 * }
 */
export function IsImportNode(node: GoPtr<Node>): bool {
  return (IsAnyImportSyntax(node) || NodeKindIs(node, KindJSImportDeclaration)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsAnyImportSyntax","kind":"func","status":"implemented","sigHash":"bb6e8e9b343f1124256d499b2f65d94706f420129039b9d340be8421463509cd","bodyHash":"8360a81285b0b2b4382c5550415a79e66c166de0f703f6425bf3d70920114515"}
 *
 * Go source:
 * func IsAnyImportSyntax(node *Node) bool {
 * 	return NodeKindIs(node, KindImportDeclaration, KindImportEqualsDeclaration)
 * }
 */
export function IsAnyImportSyntax(node: GoPtr<Node>): bool {
  return NodeKindIs(node, KindImportDeclaration, KindImportEqualsDeclaration);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJsonSourceFile","kind":"func","status":"implemented","sigHash":"baad1dcfd08ce56c301d68a0881bd5011ebe1a67a0269add0b395f5211183acb","bodyHash":"38528dfed78b25270c391032eb865e810508c9ca5b1fb65e02494c55f4aa0603"}
 *
 * Go source:
 * func IsJsonSourceFile(file *SourceFile) bool {
 * 	return file.ScriptKind == core.ScriptKindJSON
 * }
 */
export function IsJsonSourceFile(file: GoPtr<SourceFile>): bool {
  return (file!.ScriptKind === ScriptKindJSON) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsInJsonFile","kind":"func","status":"implemented","sigHash":"a12b6b35d47af4015ab800d39fac83ee22a94d62c1dbc1627c7db07f0821ad98","bodyHash":"481b455fba956ef811e13e0319054a7b15109df4f3d907f88d7fa87ce90dc626"}
 *
 * Go source:
 * func IsInJsonFile(node *Node) bool {
 * 	return node.Flags&NodeFlagsJsonFile != 0
 * }
 */
export function IsInJsonFile(node: GoPtr<Node>): bool {
  return ((node!.Flags & NodeFlagsJsonFile) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetExternalModuleName","kind":"func","status":"implemented","sigHash":"dda2d5e141bbce65a589b5adfe80d761a0126ceddd975bfba6526f28c996f66b","bodyHash":"6c2540cec4b8481a694ede5b738fb0bc3b94f6694d725c8fb84f43fc3911b947"}
 *
 * Go source:
 * func GetExternalModuleName(node *Node) *Expression {
 * 	switch node.Kind {
 * 	case KindImportDeclaration, KindJSImportDeclaration, KindExportDeclaration:
 * 		return node.ModuleSpecifier()
 * 	case KindImportEqualsDeclaration:
 * 		if node.AsImportEqualsDeclaration().ModuleReference.Kind == KindExternalModuleReference {
 * 			return node.AsImportEqualsDeclaration().ModuleReference.Expression()
 * 		}
 * 		return nil
 * 	case KindImportType:
 * 		return getImportTypeNodeLiteral(node)
 * 	case KindCallExpression:
 * 		return core.FirstOrNil(node.Arguments())
 * 	case KindModuleDeclaration:
 * 		if IsStringLiteral(node.AsModuleDeclaration().Name()) {
 * 			return node.AsModuleDeclaration().Name()
 * 		}
 * 		return nil
 * 	}
 * 	panic("Unhandled case in getExternalModuleName")
 * }
 */
export function GetExternalModuleName(node: GoPtr<Node>): GoPtr<Expression> {
  switch (node!.Kind) {
    case KindImportDeclaration:
    case KindJSImportDeclaration:
    case KindExportDeclaration:
      return Node_ModuleSpecifier(node);
    case KindImportEqualsDeclaration:
      if (AsImportEqualsDeclaration(node)!.ModuleReference!.Kind === KindExternalModuleReference) {
        return Node_Expression(AsImportEqualsDeclaration(node)!.ModuleReference);
      }
      return undefined;
    case KindImportType:
      return getImportTypeNodeLiteral(node);
    case KindCallExpression:
      return FirstOrNil(Node_Arguments(node)!);
    case KindModuleDeclaration:
      if (IsStringLiteral(Node_Name(node))) {
        return Node_Name(node);
      }
      return undefined;
  }
  throw new globalThis.Error("Unhandled case in getExternalModuleName");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetImportAttributes","kind":"func","status":"implemented","sigHash":"65ec32a05ce9108787888266fcb84299e5c7ce654ad7924cfc6401487842bc8e","bodyHash":"9d587c41a49aa7d053e40ceb82637b99962024c2bbee2d7c32127327a9af4050"}
 *
 * Go source:
 * func GetImportAttributes(node *Node) *Node {
 * 	switch node.Kind {
 * 	case KindImportDeclaration, KindJSImportDeclaration:
 * 		return node.AsImportDeclaration().Attributes
 * 	case KindExportDeclaration:
 * 		return node.AsExportDeclaration().Attributes
 * 	}
 * 	panic("Unhandled case in getImportAttributes")
 * }
 */
export function GetImportAttributes(node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindImportDeclaration:
    case KindJSImportDeclaration:
      return AsImportDeclaration(node)!.Attributes;
    case KindExportDeclaration:
      return AsExportDeclaration(node)!.Attributes;
  }
  throw new globalThis.Error("Unhandled case in getImportAttributes");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::getImportTypeNodeLiteral","kind":"func","status":"implemented","sigHash":"e44036cfe29a98560807666f3f269acf5d82aba6c26c1711c933647d289f12ef","bodyHash":"7861adb839667713de37a59ea33ea827e42fb4cffcf2d36596425decfc674fd5"}
 *
 * Go source:
 * func getImportTypeNodeLiteral(node *Node) *Node {
 * 	if IsImportTypeNode(node) {
 * 		importTypeNode := node.AsImportTypeNode()
 * 		if IsLiteralTypeNode(importTypeNode.Argument) {
 * 			literalTypeNode := importTypeNode.Argument.AsLiteralTypeNode()
 * 			if IsStringLiteral(literalTypeNode.Literal) {
 * 				return literalTypeNode.Literal
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function getImportTypeNodeLiteral(node: GoPtr<Node>): GoPtr<Node> {
  if (IsImportTypeNode(node)) {
    const importTypeNode = AsImportTypeNode(node);
    if (IsLiteralTypeNode(importTypeNode!.Argument)) {
      const literalTypeNode = AsLiteralTypeNode(importTypeNode!.Argument);
      if (IsStringLiteral(literalTypeNode!.Literal)) {
        return literalTypeNode!.Literal;
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsExpressionNode","kind":"func","status":"implemented","sigHash":"53f526eb0ba62f77c69e5e7cc17616503d7a8e6fa6e24e4bd2216668df39ff2d","bodyHash":"22ea3503f56bc583c5cd83c51d6d852f8fbb760eb32d20bd420c44840c96e754"}
 *
 * Go source:
 * func IsExpressionNode(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindSuperKeyword, KindNullKeyword, KindTrueKeyword, KindFalseKeyword, KindRegularExpressionLiteral,
 * 		KindArrayLiteralExpression, KindObjectLiteralExpression, KindPropertyAccessExpression, KindElementAccessExpression,
 * 		KindCallExpression, KindNewExpression, KindTaggedTemplateExpression, KindAsExpression, KindTypeAssertionExpression,
 * 		KindSatisfiesExpression, KindNonNullExpression, KindParenthesizedExpression, KindFunctionExpression,
 * 		KindClassExpression, KindArrowFunction, KindVoidExpression, KindDeleteExpression, KindTypeOfExpression,
 * 		KindPrefixUnaryExpression, KindPostfixUnaryExpression, KindBinaryExpression, KindConditionalExpression,
 * 		KindSpreadElement, KindTemplateExpression, KindOmittedExpression, KindJsxElement, KindJsxSelfClosingElement,
 * 		KindJsxFragment, KindYieldExpression, KindAwaitExpression:
 * 		return true
 * 	case KindMetaProperty:
 * 		// `import.defer` in `import.defer(...)` is not an expression
 * 		return !IsImportCall(node.Parent) || node.Parent.Expression() != node
 * 	case KindExpressionWithTypeArguments:
 * 		return !IsHeritageClause(node.Parent)
 * 	case KindQualifiedName:
 * 		for node.Parent.Kind == KindQualifiedName {
 * 			node = node.Parent
 * 		}
 * 		return IsTypeQueryNode(node.Parent) || IsJSDocLinkLike(node.Parent) || IsJSDocNameReference(node.Parent) || IsJsxTagName(node)
 * 	case KindPrivateIdentifier:
 * 		return IsBinaryExpression(node.Parent) && node.Parent.AsBinaryExpression().Left == node && node.Parent.AsBinaryExpression().OperatorToken.Kind == KindInKeyword
 * 	case KindIdentifier:
 * 		if IsTypeQueryNode(node.Parent) || IsJSDocLinkLike(node.Parent) || IsJSDocNameReference(node.Parent) || IsJsxTagName(node) {
 * 			return true
 * 		}
 * 		fallthrough
 * 	case KindNumericLiteral, KindBigIntLiteral, KindStringLiteral, KindNoSubstitutionTemplateLiteral, KindThisKeyword:
 * 		return IsInExpressionContext(node)
 * 	default:
 * 		return false
 * 	}
 * }
 */
export function IsExpressionNode(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindSuperKeyword:
    case KindNullKeyword:
    case KindTrueKeyword:
    case KindFalseKeyword:
    case KindRegularExpressionLiteral:
    case KindArrayLiteralExpression:
    case KindObjectLiteralExpression:
    case KindPropertyAccessExpression:
    case KindElementAccessExpression:
    case KindCallExpression:
    case KindNewExpression:
    case KindTaggedTemplateExpression:
    case KindAsExpression:
    case KindTypeAssertionExpression:
    case KindSatisfiesExpression:
    case KindNonNullExpression:
    case KindParenthesizedExpression:
    case KindFunctionExpression:
    case KindClassExpression:
    case KindArrowFunction:
    case KindVoidExpression:
    case KindDeleteExpression:
    case KindTypeOfExpression:
    case KindPrefixUnaryExpression:
    case KindPostfixUnaryExpression:
    case KindBinaryExpression:
    case KindConditionalExpression:
    case KindSpreadElement:
    case KindTemplateExpression:
    case KindOmittedExpression:
    case KindJsxElement:
    case KindJsxSelfClosingElement:
    case KindJsxFragment:
    case KindYieldExpression:
    case KindAwaitExpression:
      return true as bool;
    case KindMetaProperty:
      // `import.defer` in `import.defer(...)` is not an expression
      return (!IsImportCall(node!.Parent) || Node_Expression(node!.Parent) !== node) as bool;
    case KindExpressionWithTypeArguments:
      return !IsHeritageClause(node!.Parent) as bool;
    case KindQualifiedName: {
      const findRoot = (current: GoPtr<Node>): GoPtr<Node> => {
        if (current!.Parent!.Kind !== KindQualifiedName) return current;
        return findRoot(current!.Parent);
      };
      const root = findRoot(node);
      return (IsTypeQueryNode(root!.Parent) || IsJSDocLinkLike(root!.Parent) || IsJSDocNameReference(root!.Parent) || IsJsxTagName(root)) as bool;
    }
    case KindPrivateIdentifier:
      return (IsBinaryExpression(node!.Parent) && AsBinaryExpression(node!.Parent)!.Left === node && AsBinaryExpression(node!.Parent)!.OperatorToken!.Kind === KindInKeyword) as bool;
    case KindIdentifier:
      if (IsTypeQueryNode(node!.Parent) || IsJSDocLinkLike(node!.Parent) || IsJSDocNameReference(node!.Parent) || IsJsxTagName(node)) {
        return true as bool;
      }
      // fallthrough
      return IsInExpressionContext(node);
    case KindNumericLiteral:
    case KindBigIntLiteral:
    case KindStringLiteral:
    case KindNoSubstitutionTemplateLiteral:
    case KindThisKeyword:
      return IsInExpressionContext(node);
    default:
      return false as bool;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsInExpressionContext","kind":"func","status":"implemented","sigHash":"950381d17ede2c571cf833db1a580598c8b5b59cec403c6a732f042fb0265d3e","bodyHash":"2541d676b7efd85e1af8ee94e59c5f14f29eb7ed77880edac706f1b9d21d2ac0"}
 *
 * Go source:
 * func IsInExpressionContext(node *Node) bool {
 * 	parent := node.Parent
 * 	switch parent.Kind {
 * 	case KindVariableDeclaration, KindParameter, KindPropertyDeclaration, KindPropertySignature, KindEnumMember, KindPropertyAssignment, KindBindingElement:
 * 		return parent.Initializer() == node
 * 	case KindExpressionStatement, KindIfStatement, KindDoStatement, KindWhileStatement, KindReturnStatement, KindWithStatement, KindSwitchStatement,
 * 		KindCaseClause, KindDefaultClause, KindThrowStatement, KindTypeAssertionExpression, KindAsExpression, KindTemplateSpan, KindComputedPropertyName,
 * 		KindSatisfiesExpression:
 * 		return parent.Expression() == node
 * 	case KindForStatement:
 * 		s := parent.AsForStatement()
 * 		return s.Initializer == node && s.Initializer.Kind != KindVariableDeclarationList || s.Condition == node || s.Incrementor == node
 * 	case KindForInStatement, KindForOfStatement:
 * 		s := parent.AsForInOrOfStatement()
 * 		return s.Initializer == node && s.Initializer.Kind != KindVariableDeclarationList || s.Expression == node
 * 	case KindDecorator, KindJsxExpression, KindJsxSpreadAttribute, KindSpreadAssignment:
 * 		return true
 * 	case KindExpressionWithTypeArguments:
 * 		return parent.Expression() == node && !IsPartOfTypeNode(parent)
 * 	case KindShorthandPropertyAssignment:
 * 		return parent.AsShorthandPropertyAssignment().ObjectAssignmentInitializer == node
 * 	default:
 * 		return IsExpressionNode(parent)
 * 	}
 * }
 */
export function IsInExpressionContext(node: GoPtr<Node>): bool {
  const parent: GoPtr<Node> = node!.Parent;
  switch (parent!.Kind) {
    case KindVariableDeclaration:
    case KindParameter:
    case KindPropertyDeclaration:
    case KindPropertySignature:
    case KindEnumMember:
    case KindPropertyAssignment:
    case KindBindingElement:
      return (Node_Initializer(parent) === node) as bool;
    case KindExpressionStatement:
    case KindIfStatement:
    case KindDoStatement:
    case KindWhileStatement:
    case KindReturnStatement:
    case KindWithStatement:
    case KindSwitchStatement:
    case KindCaseClause:
    case KindDefaultClause:
    case KindThrowStatement:
    case KindTypeAssertionExpression:
    case KindAsExpression:
    case KindTemplateSpan:
    case KindComputedPropertyName:
    case KindSatisfiesExpression:
      return (Node_Expression(parent) === node) as bool;
    case KindForStatement: {
      const s = AsForStatement(parent);
      return ((s!.Initializer === node && s!.Initializer!.Kind !== KindVariableDeclarationList) || s!.Condition === node || s!.Incrementor === node) as bool;
    }
    case KindForInStatement:
    case KindForOfStatement: {
      const s = AsForInOrOfStatement(parent);
      return ((s!.Initializer === node && s!.Initializer!.Kind !== KindVariableDeclarationList) || s!.Expression === node) as bool;
    }
    case KindDecorator:
    case KindJsxExpression:
    case KindJsxSpreadAttribute:
    case KindSpreadAssignment:
      return true as bool;
    case KindExpressionWithTypeArguments:
      return (Node_Expression(parent) === node && !IsPartOfTypeNode(parent)) as bool;
    case KindShorthandPropertyAssignment:
      return (AsShorthandPropertyAssignment(parent)!.ObjectAssignmentInitializer === node) as bool;
    default:
      return IsExpressionNode(parent);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPartOfTypeNode","kind":"func","status":"implemented","sigHash":"e76ee9c0d23aa276206013ba8941844ff1ca4316051c5ff25ebe25651c2b200a","bodyHash":"c3b51da0eff6c30788c5b65e3fe91915b5dc74bc3d15572194eb3b51fb470f8c"}
 *
 * Go source:
 * func IsPartOfTypeNode(node *Node) bool {
 * 	kind := node.Kind
 * 	if kind >= KindFirstTypeNode && kind <= KindLastTypeNode {
 * 		return true
 * 	}
 * 	switch node.Kind {
 * 	case KindAnyKeyword, KindUnknownKeyword, KindNumberKeyword, KindBigIntKeyword, KindStringKeyword,
 * 		KindBooleanKeyword, KindSymbolKeyword, KindObjectKeyword, KindUndefinedKeyword, KindNullKeyword,
 * 		KindNeverKeyword:
 * 		return true
 * 	case KindVoidKeyword:
 * 		return node.Parent.Kind != KindVoidExpression
 * 	case KindExpressionWithTypeArguments:
 * 		return isPartOfTypeExpressionWithTypeArguments(node)
 * 	case KindTypeParameter:
 * 		return node.Parent.Kind == KindMappedType || node.Parent.Kind == KindInferType
 * 	case KindIdentifier:
 * 		parent := node.Parent
 * 		if IsQualifiedName(parent) && parent.AsQualifiedName().Right == node {
 * 			return isPartOfTypeNodeInParent(parent)
 * 		}
 * 		if IsPropertyAccessExpression(parent) && parent.AsPropertyAccessExpression().Name() == node {
 * 			return isPartOfTypeNodeInParent(parent)
 * 		}
 * 		return isPartOfTypeNodeInParent(node)
 * 	case KindQualifiedName, KindPropertyAccessExpression, KindThisKeyword:
 * 		return isPartOfTypeNodeInParent(node)
 * 	}
 * 	return false
 * }
 */
export function IsPartOfTypeNode(node: GoPtr<Node>): bool {
  const kind: Kind = node!.Kind;
  if (kind >= KindFirstTypeNode && kind <= KindLastTypeNode) {
    return true as bool;
  }
  switch (node!.Kind) {
    case KindAnyKeyword:
    case KindUnknownKeyword:
    case KindNumberKeyword:
    case KindBigIntKeyword:
    case KindStringKeyword:
    case KindBooleanKeyword:
    case KindSymbolKeyword:
    case KindObjectKeyword:
    case KindUndefinedKeyword:
    case KindNullKeyword:
    case KindNeverKeyword:
      return true as bool;
    case KindVoidKeyword:
      return (node!.Parent!.Kind !== KindVoidExpression) as bool;
    case KindExpressionWithTypeArguments:
      return isPartOfTypeExpressionWithTypeArguments(node);
    case KindTypeParameter:
      return (node!.Parent!.Kind === KindMappedType || node!.Parent!.Kind === KindInferType) as bool;
    case KindIdentifier: {
      const parent: GoPtr<Node> = node!.Parent;
      if (IsQualifiedName(parent) && AsQualifiedName(parent)!.Right === node) {
        return isPartOfTypeNodeInParent(parent);
      }
      if (IsPropertyAccessExpression(parent) && Node_Name(parent) === node) {
        return isPartOfTypeNodeInParent(parent);
      }
      return isPartOfTypeNodeInParent(node);
    }
    case KindQualifiedName:
    case KindPropertyAccessExpression:
    case KindThisKeyword:
      return isPartOfTypeNodeInParent(node);
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isPartOfTypeNodeInParent","kind":"func","status":"implemented","sigHash":"d7117a770e3ca70bcdf41060f753bc34d8bd3491b5298ad6e3e359a45887f4d0","bodyHash":"027d3e63604948af81834b97bb1b32750608fed18dda5b628edf6dd6fef4c436"}
 *
 * Go source:
 * func isPartOfTypeNodeInParent(node *Node) bool {
 * 	parent := node.Parent
 * 	if parent.Kind == KindTypeQuery {
 * 		return false
 * 	}
 * 	if parent.Kind == KindImportType {
 * 		return !parent.AsImportTypeNode().IsTypeOf
 * 	}
 * 
 * 	// Do not recursively call isPartOfTypeNode on the parent. In the example:
 * 	//
 * 	//     let a: A.B.C;
 * 	//
 * 	// Calling isPartOfTypeNode would consider the qualified name A.B a type node.
 * 	// Only C and A.B.C are type nodes.
 * 	if parent.Kind >= KindFirstTypeNode && parent.Kind <= KindLastTypeNode {
 * 		return true
 * 	}
 * 	switch parent.Kind {
 * 	case KindExpressionWithTypeArguments:
 * 		return isPartOfTypeExpressionWithTypeArguments(parent)
 * 	case KindTypeParameter:
 * 		return node == parent.AsTypeParameterDeclaration().Constraint
 * 	case KindVariableDeclaration, KindParameter, KindPropertyDeclaration, KindPropertySignature, KindFunctionDeclaration,
 * 		KindFunctionExpression, KindArrowFunction, KindConstructor, KindMethodDeclaration, KindMethodSignature,
 * 		KindGetAccessor, KindSetAccessor, KindCallSignature, KindConstructSignature, KindIndexSignature,
 * 		KindTypeAssertionExpression:
 * 		return node == parent.Type()
 * 	case KindCallExpression, KindNewExpression, KindTaggedTemplateExpression:
 * 		return slices.Contains(parent.TypeArguments(), node)
 * 	}
 * 	return false
 * }
 */
export function isPartOfTypeNodeInParent(node: GoPtr<Node>): bool {
  const parent: GoPtr<Node> = node!.Parent;
  if (parent!.Kind === KindTypeQuery) {
    return false as bool;
  }
  if (parent!.Kind === KindImportType) {
    return !AsImportTypeNode(parent)!.IsTypeOf as bool;
  }

  // Do not recursively call isPartOfTypeNode on the parent. In the example:
  //
  //     let a: A.B.C;
  //
  // Calling isPartOfTypeNode would consider the qualified name A.B a type node.
  // Only C and A.B.C are type nodes.
  if (parent!.Kind >= KindFirstTypeNode && parent!.Kind <= KindLastTypeNode) {
    return true as bool;
  }
  switch (parent!.Kind) {
    case KindExpressionWithTypeArguments:
      return isPartOfTypeExpressionWithTypeArguments(parent);
    case KindTypeParameter:
      return (node === AsTypeParameterDeclaration(parent)!.Constraint) as bool;
    case KindVariableDeclaration:
    case KindParameter:
    case KindPropertyDeclaration:
    case KindPropertySignature:
    case KindFunctionDeclaration:
    case KindFunctionExpression:
    case KindArrowFunction:
    case KindConstructor:
    case KindMethodDeclaration:
    case KindMethodSignature:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindCallSignature:
    case KindConstructSignature:
    case KindIndexSignature:
    case KindTypeAssertionExpression:
      return (node === Node_Type(parent)) as bool;
    case KindCallExpression:
    case KindNewExpression:
    case KindTaggedTemplateExpression:
      return slices.Contains(Node_TypeArguments(parent)!, node);
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isPartOfTypeExpressionWithTypeArguments","kind":"func","status":"implemented","sigHash":"12708a895dca27e520af7f906f20b1b55c2c914754fd7779d72cd60e9ce8beba","bodyHash":"b91662fc8ab722792a0cca6f749d8f800b64f728a2065d54fe6b97a685bbf4a8"}
 *
 * Go source:
 * func isPartOfTypeExpressionWithTypeArguments(node *Node) bool {
 * 	parent := node.Parent
 * 	return IsHeritageClause(parent) && (!IsClassLike(parent.Parent) || parent.AsHeritageClause().Token == KindImplementsKeyword) ||
 * 		IsJSDocImplementsTag(parent) ||
 * 		IsJSDocAugmentsTag(parent)
 * }
 */
export function isPartOfTypeExpressionWithTypeArguments(node: GoPtr<Node>): bool {
  const parent: GoPtr<Node> = node!.Parent;
  return ((IsHeritageClause(parent) && (!IsClassLike(parent!.Parent) || AsHeritageClause(parent)!.Token === KindImplementsKeyword)) ||
    IsJSDocImplementsTag(parent) ||
    IsJSDocAugmentsTag(parent)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJSDocLinkLike","kind":"func","status":"implemented","sigHash":"b0dd297f5241b8c7cc3a4efe95e1eeeaa69a77c13b72b4c4ba81c67788184363","bodyHash":"5cfd116f246fe54c06e3d9d7a4e832853571fcf4e62dc97fa4df11628cbad067"}
 *
 * Go source:
 * func IsJSDocLinkLike(node *Node) bool {
 * 	return NodeKindIs(node, KindJSDocLink, KindJSDocLinkCode, KindJSDocLinkPlain)
 * }
 */
export function IsJSDocLinkLike(node: GoPtr<Node>): bool {
  return NodeKindIs(node, KindJSDocLink, KindJSDocLinkCode, KindJSDocLinkPlain);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJSDocTag","kind":"func","status":"implemented","sigHash":"7992e006eba0d200310167a0f716a8d465e3b7ee40a7ab3fc8a6310156b77ea4","bodyHash":"aef44e914228bf71b84c4ef7cb3a2241a8807230301f41f5615abf9911df72fe"}
 *
 * Go source:
 * func IsJSDocTag(node *Node) bool {
 * 	return node.Kind >= KindFirstJSDocTagNode && node.Kind <= KindLastJSDocTagNode
 * }
 */
export function IsJSDocTag(node: GoPtr<Node>): bool {
  return (node!.Kind >= KindFirstJSDocTagNode && node!.Kind <= KindLastJSDocTagNode) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsSuperCall","kind":"func","status":"implemented","sigHash":"69b0048a38c5b28cd3c66cdd60c810eba47aa1f69d7a28b99791fee508a95ec0","bodyHash":"2d5bf8dcf7167d91a8b33afdcd5fbd16851204469dba5aaaf09c850fd509d7db"}
 *
 * Go source:
 * func IsSuperCall(node *Node) bool {
 * 	return IsCallExpression(node) && node.Expression().Kind == KindSuperKeyword
 * }
 */
export function IsSuperCall(node: GoPtr<Node>): bool {
  return (IsCallExpression(node) && Node_Expression(node)!.Kind === KindSuperKeyword) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsImportCall","kind":"func","status":"implemented","sigHash":"c22608c245765e15facb22631990dcf5969c768a89f432172413aabcbb22041f","bodyHash":"6d6437edb5e3c323b1cc185afd9f49b823e8aba3c86437d62e6e624f31cb7d7b"}
 *
 * Go source:
 * func IsImportCall(node *Node) bool {
 * 	if !IsCallExpression(node) {
 * 		return false
 * 	}
 * 	e := node.Expression()
 * 	return e.Kind == KindImportKeyword || IsMetaProperty(e) && e.AsMetaProperty().KeywordToken == KindImportKeyword && e.Text() == "defer"
 * }
 */
export function IsImportCall(node: GoPtr<Node>): bool {
  if (!IsCallExpression(node)) {
    return false as bool;
  }
  const e: GoPtr<Node> = Node_Expression(node);
  return (e!.Kind === KindImportKeyword ||
    (IsMetaProperty(e) && AsMetaProperty(e)!.KeywordToken === KindImportKeyword && Node_Text(e) === "defer")) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsComputedNonLiteralName","kind":"func","status":"implemented","sigHash":"a8fec75d486271a140977cd874dd1d60d8538079e8e528a6ef72b3a8b5d71fdc","bodyHash":"ca6ca93ac14d65383408364e7cffb1bb359445b2bd1ef097749d1b361f6a3957"}
 *
 * Go source:
 * func IsComputedNonLiteralName(name *Node) bool {
 * 	return IsComputedPropertyName(name) && !IsStringOrNumericLiteralLike(name.Expression())
 * }
 */
export function IsComputedNonLiteralName(name: GoPtr<Node>): bool {
  return (IsComputedPropertyName(name) && !IsStringOrNumericLiteralLike(Node_Expression(name))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsQuestionToken","kind":"func","status":"implemented","sigHash":"ae24f9cc59de6a499e5a483cbc487130487fc4ee2ddd3e4f7613477460fcc744","bodyHash":"262ff17cb6fd2f2dcbd114a83e5295b00f7c1ceec739e5a7bb3a10ddb4ed54cf"}
 *
 * Go source:
 * func IsQuestionToken(node *Node) bool {
 * 	return node != nil && node.Kind == KindQuestionToken
 * }
 */
export function IsQuestionToken(node: GoPtr<Node>): bool {
  return (node !== undefined && node!.Kind === KindQuestionToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::EntityNameToString","kind":"func","status":"implemented","sigHash":"970ee9a297be76e327b3764ba629e8c687dcefe905555fa241e2cd0293ca3bea","bodyHash":"56f403f3199e5f1d3525e32465c0d4c4e6f6a4813202a636b4ea0c1c7d5f8b5f"}
 *
 * Go source:
 * func EntityNameToString(name *Node, getTextOfNode func(*Node) string) string {
 * 	switch name.Kind {
 * 	case KindThisKeyword:
 * 		return "this"
 * 	case KindIdentifier, KindPrivateIdentifier:
 * 		if NodeIsSynthesized(name) || getTextOfNode == nil {
 * 			return name.Text()
 * 		}
 * 		return getTextOfNode(name)
 * 	case KindQualifiedName:
 * 		return EntityNameToString(name.AsQualifiedName().Left, getTextOfNode) + "." + EntityNameToString(name.AsQualifiedName().Right, getTextOfNode)
 * 	case KindPropertyAccessExpression:
 * 		return EntityNameToString(name.Expression(), getTextOfNode) + "." + EntityNameToString(name.AsPropertyAccessExpression().Name(), getTextOfNode)
 * 	case KindJsxNamespacedName:
 * 		return EntityNameToString(name.AsJsxNamespacedName().Namespace, getTextOfNode) + ":" + EntityNameToString(name.AsJsxNamespacedName().Name(), getTextOfNode)
 * 	}
 * 	panic("Unhandled case in EntityNameToString")
 * }
 */
export function EntityNameToString(name: GoPtr<Node>, getTextOfNode: (arg0: GoPtr<Node>) => string): string {
  switch (name!.Kind) {
    case KindThisKeyword:
      return "this";
    case KindIdentifier:
    case KindPrivateIdentifier:
      if (NodeIsSynthesized(name) || getTextOfNode === undefined) {
        return Node_Text(name);
      }
      return getTextOfNode(name);
    case KindQualifiedName:
      return EntityNameToString(AsQualifiedName(name)!.Left, getTextOfNode) + "." + EntityNameToString(AsQualifiedName(name)!.Right, getTextOfNode);
    case KindPropertyAccessExpression:
      return EntityNameToString(Node_Expression(name), getTextOfNode) + "." + EntityNameToString(Node_Name(name), getTextOfNode);
    case KindJsxNamespacedName:
      return EntityNameToString(AsJsxNamespacedName(name)!.Namespace, getTextOfNode) + ":" + EntityNameToString(Node_Name(name), getTextOfNode);
  }
  throw new globalThis.Error("Unhandled case in EntityNameToString");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetTextOfPropertyName","kind":"func","status":"implemented","sigHash":"a57d83362b565cf9be4f7abe68717970312d328d2d2aa80fe014d0d2ac028d4a","bodyHash":"d3c29513d129a3112c4a2c4a0a9b743b8f841b91b662d42b9bfd3189561c57f0"}
 *
 * Go source:
 * func GetTextOfPropertyName(name *Node) string {
 * 	text, _ := TryGetTextOfPropertyName(name)
 * 	return text
 * }
 */
export function GetTextOfPropertyName(name: GoPtr<Node>): string {
  const [text] = TryGetTextOfPropertyName(name);
  return text;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::TryGetTextOfPropertyName","kind":"func","status":"implemented","sigHash":"6bed508f78634cf239f98c17f660e6ebea810857df7348bd01a6a284e502cd06","bodyHash":"af6bb13d6a40bcb9e418fda1557574a6395f6b109e6e4b0b3b32cc56d65af5f3"}
 *
 * Go source:
 * func TryGetTextOfPropertyName(name *Node) (string, bool) {
 * 	switch name.Kind {
 * 	case KindIdentifier, KindPrivateIdentifier, KindStringLiteral, KindNumericLiteral, KindBigIntLiteral,
 * 		KindNoSubstitutionTemplateLiteral:
 * 		return name.Text(), true
 * 	case KindComputedPropertyName:
 * 		if IsStringOrNumericLiteralLike(name.Expression()) {
 * 			return name.Expression().Text(), true
 * 		}
 * 	case KindJsxNamespacedName:
 * 		return name.AsJsxNamespacedName().Namespace.Text() + ":" + name.Name().Text(), true
 * 	}
 * 	return "", false
 * }
 */
export function TryGetTextOfPropertyName(name: GoPtr<Node>): [string, bool] {
  switch (name!.Kind) {
    case KindIdentifier:
    case KindPrivateIdentifier:
    case KindStringLiteral:
    case KindNumericLiteral:
    case KindBigIntLiteral:
    case KindNoSubstitutionTemplateLiteral:
      return [Node_Text(name), true as bool];
    case KindComputedPropertyName:
      if (IsStringOrNumericLiteralLike(Node_Expression(name))) {
        return [Node_Text(Node_Expression(name)), true as bool];
      }
      break;
    case KindJsxNamespacedName:
      return [Node_Text(AsJsxNamespacedName(name)!.Namespace) + ":" + Node_Text(Node_Name(name)), true as bool];
  }
  return ["", false as bool];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJSDocNode","kind":"func","status":"implemented","sigHash":"8e7b76f0378d4524a8194e27221fbaee0f2a7acf540a0942787cf4118be8e986","bodyHash":"d34951ec63484fc53d565850c18d9fa1648b72827d69f9b2a309cc7eee3b4a0a"}
 *
 * Go source:
 * func IsJSDocNode(node *Node) bool {
 * 	return node.Kind >= KindFirstJSDocNode && node.Kind <= KindLastJSDocNode
 * }
 */
export function IsJSDocNode(node: GoPtr<Node>): bool {
  return (node!.Kind >= KindFirstJSDocNode && node!.Kind <= KindLastJSDocNode) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsNonWhitespaceToken","kind":"func","status":"implemented","sigHash":"e2abb1cc4faabe261eb6a46f2d6066602936fcc962782c97aba1cf7c9f0dd32d","bodyHash":"e629b2eda9ba9714d12d4a4b74bb2e534637fa61bc6fea4e9135f47a8ed778da"}
 *
 * Go source:
 * func IsNonWhitespaceToken(node *Node) bool {
 * 	return IsTokenKind(node.Kind) && !IsWhitespaceOnlyJsxText(node)
 * }
 */
export function IsNonWhitespaceToken(node: GoPtr<Node>): bool {
  return (IsTokenKind(node!.Kind) && !IsWhitespaceOnlyJsxText(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsWhitespaceOnlyJsxText","kind":"func","status":"implemented","sigHash":"9a7910cabacab59ead4832dae74e422eb39cb550bf53d440715b84f429ed8dd6","bodyHash":"7c3801daba6ed070ef5d838ba51becd0f4915b9612dababa5cff5ea08ea22741"}
 *
 * Go source:
 * func IsWhitespaceOnlyJsxText(node *Node) bool {
 * 	return node.Kind == KindJsxText && node.AsJsxText().ContainsOnlyTriviaWhiteSpaces
 * }
 */
export function IsWhitespaceOnlyJsxText(node: GoPtr<Node>): bool {
  return (node!.Kind === KindJsxText && AsJsxText(node)!.ContainsOnlyTriviaWhiteSpaces) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetNewTargetContainer","kind":"func","status":"implemented","sigHash":"282da4ddf2d566d944ad8786a43b9910ebf09826e1095f069d1b7c281dc2e181","bodyHash":"13668e943506046c53031479e210330c9e1cbb7dfa1804109c0280233978ac13"}
 *
 * Go source:
 * func GetNewTargetContainer(node *Node) *Node {
 * 	container := GetThisContainer(node, false /*includeArrowFunctions* /, false /*includeClassComputedPropertyName* /)
 * 	if container != nil {
 * 		switch container.Kind {
 * 		case KindConstructor, KindFunctionDeclaration, KindFunctionExpression:
 * 			return container
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function GetNewTargetContainer(node: GoPtr<Node>): GoPtr<Node> {
  const container: GoPtr<Node> = GetThisContainer(node, false /*includeArrowFunctions*/, false /*includeClassComputedPropertyName*/);
  if (container !== undefined) {
    switch (container!.Kind) {
      case KindConstructor:
      case KindFunctionDeclaration:
      case KindFunctionExpression:
        return container;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetEnclosingBlockScopeContainer","kind":"func","status":"implemented","sigHash":"bf1273a6a0874495b9764e3ebeb85ac3e452acdd5562ace974bda507d471ec6c","bodyHash":"8b6ef93d3f3caf5944388e38b0ae96a94c1404667bd9c5e46eea4eeaad871706"}
 *
 * Go source:
 * func GetEnclosingBlockScopeContainer(node *Node) *Node {
 * 	return FindAncestor(node.Parent, func(current *Node) bool {
 * 		return IsBlockScope(current, current.Parent)
 * 	})
 * }
 */
export function GetEnclosingBlockScopeContainer(node: GoPtr<Node>): GoPtr<Node> {
  return FindAncestor(node!.Parent, (current: GoPtr<Node>): bool => {
    return IsBlockScope(current, current!.Parent);
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsBlockScope","kind":"func","status":"implemented","sigHash":"db28f70f9fbbb742eabaf5f676eb45d2cddbaaf06cb45f9ad4425c3d987f2924","bodyHash":"137139b2cd1423efb8e1d86d69e6ad68d4c004477c3004813ac9efe59f59dcb8"}
 *
 * Go source:
 * func IsBlockScope(node *Node, parentNode *Node) bool {
 * 	switch node.Kind {
 * 	case KindSourceFile, KindCaseBlock, KindCatchClause, KindModuleDeclaration, KindForStatement, KindForInStatement, KindForOfStatement,
 * 		KindConstructor, KindMethodDeclaration, KindGetAccessor, KindSetAccessor, KindFunctionDeclaration, KindFunctionExpression,
 * 		KindArrowFunction, KindPropertyDeclaration, KindClassStaticBlockDeclaration:
 * 		return true
 * 	case KindBlock:
 * 		// function block is not considered block-scope container
 * 		// see comment in binder.ts: bind(...), case for SyntaxKind.Block
 * 		return !IsFunctionLikeOrClassStaticBlockDeclaration(parentNode)
 * 	}
 * 	return false
 * }
 */
export function IsBlockScope(node: GoPtr<Node>, parentNode: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindSourceFile:
    case KindCaseBlock:
    case KindCatchClause:
    case KindModuleDeclaration:
    case KindForStatement:
    case KindForInStatement:
    case KindForOfStatement:
    case KindConstructor:
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindFunctionDeclaration:
    case KindFunctionExpression:
    case KindArrowFunction:
    case KindPropertyDeclaration:
    case KindClassStaticBlockDeclaration:
      return true as bool;
    case KindBlock:
      // function block is not considered block-scope container
      // see comment in binder.ts: bind(...), case for SyntaxKind.Block
      return !IsFunctionLikeOrClassStaticBlockDeclaration(parentNode) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::type::SemanticMeaning","kind":"type","status":"implemented","sigHash":"f02b1658027cc65f660651f728f6c8ae5b4c23068e1b19f234210468af1c423f","bodyHash":"716d15a546a9fe4e8dfb79942a5081db4da6dfa7a2c7a987cca2be50289804d5"}
 *
 * Go source:
 * SemanticMeaning int32
 */
export type SemanticMeaning = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::constGroup::SemanticMeaningNone+SemanticMeaningValue+SemanticMeaningType+SemanticMeaningNamespace+SemanticMeaningAll","kind":"constGroup","status":"implemented","sigHash":"f46b77bfcdd6766967186ebc00a61329dcccfc442cf604653a7516e969cb54df","bodyHash":"dd1f5b720848969ecbc736ffdb3a3bf7508403244e71c696f3e81f56b6482e34"}
 *
 * Go source:
 * const (
 * 	SemanticMeaningNone      SemanticMeaning = 0
 * 	SemanticMeaningValue     SemanticMeaning = 1 << 0
 * 	SemanticMeaningType      SemanticMeaning = 1 << 1
 * 	SemanticMeaningNamespace SemanticMeaning = 1 << 2
 * 	SemanticMeaningAll       SemanticMeaning = SemanticMeaningValue | SemanticMeaningType | SemanticMeaningNamespace
 * )
 */
export const SemanticMeaningNone: SemanticMeaning = 0 as SemanticMeaning;
export const SemanticMeaningValue: SemanticMeaning = (1 << 0) as SemanticMeaning;
export const SemanticMeaningType: SemanticMeaning = (1 << 1) as SemanticMeaning;
export const SemanticMeaningNamespace: SemanticMeaning = (1 << 2) as SemanticMeaning;
export const SemanticMeaningAll: SemanticMeaning = (SemanticMeaningValue | SemanticMeaningType | SemanticMeaningNamespace) as SemanticMeaning;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetMeaningFromDeclaration","kind":"func","status":"implemented","sigHash":"e0593d20aa92c5f0e0368755635f1971f24ebdd00fb792b520bcebacf9384b74","bodyHash":"740e3f9c3332da586ec129e8c29796bf0cb1bd70be5431dd940f93e56159bfa2"}
 *
 * Go source:
 * func GetMeaningFromDeclaration(node *Node) SemanticMeaning {
 * 	switch node.Kind {
 * 	case KindVariableDeclaration:
 * 		return SemanticMeaningValue
 * 	case KindParameter,
 * 		KindBindingElement,
 * 		KindPropertyDeclaration,
 * 		KindPropertySignature,
 * 		KindPropertyAssignment,
 * 		KindShorthandPropertyAssignment,
 * 		KindMethodDeclaration,
 * 		KindMethodSignature,
 * 		KindConstructor,
 * 		KindGetAccessor,
 * 		KindSetAccessor,
 * 		KindFunctionDeclaration,
 * 		KindFunctionExpression,
 * 		KindArrowFunction,
 * 		KindCatchClause,
 * 		KindJsxAttribute:
 * 		return SemanticMeaningValue
 * 
 * 	case KindTypeParameter,
 * 		KindInterfaceDeclaration,
 * 		KindTypeAliasDeclaration,
 * 		KindJSTypeAliasDeclaration,
 * 		KindTypeLiteral:
 * 		return SemanticMeaningType
 * 	case KindEnumMember, KindClassDeclaration:
 * 		return SemanticMeaningValue | SemanticMeaningType
 * 
 * 	case KindModuleDeclaration:
 * 		if IsAmbientModule(node) {
 * 			return SemanticMeaningNamespace | SemanticMeaningValue
 * 		} else if GetModuleInstanceState(node) == ModuleInstanceStateInstantiated {
 * 			return SemanticMeaningNamespace | SemanticMeaningValue
 * 		} else {
 * 			return SemanticMeaningNamespace
 * 		}
 * 
 * 	case KindEnumDeclaration,
 * 		KindNamedImports,
 * 		KindImportSpecifier,
 * 		KindImportEqualsDeclaration,
 * 		KindImportDeclaration,
 * 		KindJSImportDeclaration,
 * 		KindExportAssignment,
 * 		KindExportDeclaration:
 * 		return SemanticMeaningAll
 * 
 * 	// An external module can be a Value
 * 	case KindSourceFile:
 * 		return SemanticMeaningNamespace | SemanticMeaningValue
 * 	}
 * 
 * 	return SemanticMeaningAll
 * }
 */
export function GetMeaningFromDeclaration(node: GoPtr<Node>): SemanticMeaning {
  switch (node!.Kind) {
    case KindVariableDeclaration:
      return SemanticMeaningValue;
    case KindParameter:
    case KindBindingElement:
    case KindPropertyDeclaration:
    case KindPropertySignature:
    case KindPropertyAssignment:
    case KindShorthandPropertyAssignment:
    case KindMethodDeclaration:
    case KindMethodSignature:
    case KindConstructor:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindFunctionDeclaration:
    case KindFunctionExpression:
    case KindArrowFunction:
    case KindCatchClause:
    case KindJsxAttribute:
      return SemanticMeaningValue;

    case KindTypeParameter:
    case KindInterfaceDeclaration:
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
    case KindTypeLiteral:
      return SemanticMeaningType;
    case KindEnumMember:
    case KindClassDeclaration:
      return (SemanticMeaningValue | SemanticMeaningType) as SemanticMeaning;

    case KindModuleDeclaration:
      if (IsAmbientModule(node)) {
        return (SemanticMeaningNamespace | SemanticMeaningValue) as SemanticMeaning;
      } else if (GetModuleInstanceState(node) === ModuleInstanceStateInstantiated) {
        return (SemanticMeaningNamespace | SemanticMeaningValue) as SemanticMeaning;
      } else {
        return SemanticMeaningNamespace;
      }

    case KindEnumDeclaration:
    case KindNamedImports:
    case KindImportSpecifier:
    case KindImportEqualsDeclaration:
    case KindImportDeclaration:
    case KindJSImportDeclaration:
    case KindExportAssignment:
    case KindExportDeclaration:
      return SemanticMeaningAll;

    // An external module can be a Value
    case KindSourceFile:
      return (SemanticMeaningNamespace | SemanticMeaningValue) as SemanticMeaning;
  }

  return SemanticMeaningAll;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPropertyAccessOrQualifiedName","kind":"func","status":"implemented","sigHash":"29f3bede7068406cad29ca5ddf2a1fbca41e02b88d85a4d34b38bcb44446ebfb","bodyHash":"399474bbbcd08d7eedf89c3c91a36859a9dc56fe291a35873ab34198dda2ad0c"}
 *
 * Go source:
 * func IsPropertyAccessOrQualifiedName(node *Node) bool {
 * 	return node.Kind == KindPropertyAccessExpression || node.Kind == KindQualifiedName
 * }
 */
export function IsPropertyAccessOrQualifiedName(node: GoPtr<Node>): bool {
  return (node!.Kind === KindPropertyAccessExpression || node!.Kind === KindQualifiedName) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsLabelName","kind":"func","status":"implemented","sigHash":"19c2949e55d3f2bb599aaf992ae23cc78eb1513796af3df28644002d5b9cb32f","bodyHash":"0ec9c41bea5d19cd40f061039f42e47e4fd0836b542cdeb728d6554e94f776b6"}
 *
 * Go source:
 * func IsLabelName(node *Node) bool {
 * 	return IsLabelOfLabeledStatement(node) || IsJumpStatementTarget(node)
 * }
 */
export function IsLabelName(node: GoPtr<Node>): bool {
  return (IsLabelOfLabeledStatement(node) || IsJumpStatementTarget(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsLabelOfLabeledStatement","kind":"func","status":"implemented","sigHash":"bf0ebcd2043c685972c5205ba34d8544b8dd399d065efb919739bce2f024e737","bodyHash":"7316801cf2cc48b4c23a692b2beda0e4aac87632b846d3d53ef4a6a823a7dc4a"}
 *
 * Go source:
 * func IsLabelOfLabeledStatement(node *Node) bool {
 * 	if !IsIdentifier(node) {
 * 		return false
 * 	}
 * 	if !IsLabeledStatement(node.Parent) {
 * 		return false
 * 	}
 * 	return node == node.Parent.Label()
 * }
 */
export function IsLabelOfLabeledStatement(node: GoPtr<Node>): bool {
  if (!IsIdentifier(node)) {
    return false as bool;
  }
  if (!IsLabeledStatement(node!.Parent)) {
    return false as bool;
  }
  return (node === Node_Label(node!.Parent)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJumpStatementTarget","kind":"func","status":"implemented","sigHash":"755b4a13e614849a26c7e6e69b13a00dad824effded2b91c61e67125826a668f","bodyHash":"df783fdf6fe75fce3e38b7f2c559713248c5c39d36cdc180dabc960a350e7dfe"}
 *
 * Go source:
 * func IsJumpStatementTarget(node *Node) bool {
 * 	if !IsIdentifier(node) {
 * 		return false
 * 	}
 * 	if !IsBreakOrContinueStatement(node.Parent) {
 * 		return false
 * 	}
 * 	return node == node.Parent.Label()
 * }
 */
export function IsJumpStatementTarget(node: GoPtr<Node>): bool {
  if (!IsIdentifier(node)) {
    return false as bool;
  }
  if (!IsBreakOrContinueStatement(node!.Parent)) {
    return false as bool;
  }
  return (node === Node_Label(node!.Parent)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsBreakOrContinueStatement","kind":"func","status":"implemented","sigHash":"a65afc0c315c2aa23ef74e534446049edcb8ecb6696a7dea6ddd0c0e240892db","bodyHash":"1d9fb6df2904b00ca77793de2c7efabf88cb90227eda7fe503f0b0a1573adea4"}
 *
 * Go source:
 * func IsBreakOrContinueStatement(node *Node) bool {
 * 	return NodeKindIs(node, KindBreakStatement, KindContinueStatement)
 * }
 */
export function IsBreakOrContinueStatement(node: GoPtr<Node>): bool {
  return NodeKindIs(node, KindBreakStatement, KindContinueStatement);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::pushAncestor","kind":"func","status":"implemented","sigHash":"32f53e6383ca7dd23d6880ef402a50bd5dd535f7f302fe419cd0aa2f496c5518","bodyHash":"38039ca7978313a06daa651b28deae32f87b9e4a6e294681dbfd1b3e8b4e4ffc"}
 *
 * Go source:
 * func pushAncestor(ancestors []*Node, parent *Node) []*Node {
 * 	return append(ancestors, parent)
 * }
 */
export function pushAncestor(ancestors: GoSlice<GoPtr<Node>>, parent: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  // Go's `append(nil, parent)` yields a new slice; a nil input slice is treated as empty.
  return [...(ancestors ?? []), parent];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::popAncestor","kind":"func","status":"implemented","sigHash":"f8b75eea74d3792f67bfe8e9b42399d5ff9535d0299cdd9d7e1e985412a587fc","bodyHash":"57b2cbd6668f51b9a3db0b138956609013228247447d13fdce9277f92013b0e1"}
 *
 * Go source:
 * func popAncestor(ancestors []*Node, node *Node) ([]*Node, *Node) {
 * 	if len(ancestors) == 0 {
 * 		return nil, node.Parent
 * 	}
 * 	n := len(ancestors) - 1
 * 	return ancestors[:n], ancestors[n]
 * }
 */
export function popAncestor(ancestors: GoSlice<GoPtr<Node>>, node: GoPtr<Node>): [GoSlice<GoPtr<Node>>, GoPtr<Node>] {
  if ((ancestors ?? []).length === 0) {
    return [undefined!, node!.Parent];
  }
  const n = ancestors!.length - 1;
  return [ancestors!.slice(0, n), ancestors![n]];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::type::ModuleInstanceState","kind":"type","status":"implemented","sigHash":"31c4b48c2d98be2260be57b833987ff5913272e3c7c2c5e2a8c2062fb60c30e7","bodyHash":"399c314d0d21ec0c7afb5a9ef2c37a021ab921eecc7807704304227c75d234e5"}
 *
 * Go source:
 * ModuleInstanceState int32
 */
export type ModuleInstanceState = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::constGroup::ModuleInstanceStateUnknown+ModuleInstanceStateNonInstantiated+ModuleInstanceStateInstantiated+ModuleInstanceStateConstEnumOnly","kind":"constGroup","status":"implemented","sigHash":"a9730c944df24c273ef80418dedf3abb66b6835e322b0e97e8faa76fe480d3ed","bodyHash":"32e1c9c7d8bf5e3dae113f0e8d6b284dfe5e92a920bdea62e918d0805f13a8a6"}
 *
 * Go source:
 * const (
 * 	ModuleInstanceStateUnknown ModuleInstanceState = iota
 * 	ModuleInstanceStateNonInstantiated
 * 	ModuleInstanceStateInstantiated
 * 	ModuleInstanceStateConstEnumOnly
 * )
 */
export const ModuleInstanceStateUnknown: ModuleInstanceState = 0 as ModuleInstanceState;
export const ModuleInstanceStateNonInstantiated: ModuleInstanceState = 1 as ModuleInstanceState;
export const ModuleInstanceStateInstantiated: ModuleInstanceState = 2 as ModuleInstanceState;
export const ModuleInstanceStateConstEnumOnly: ModuleInstanceState = 3 as ModuleInstanceState;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetModuleInstanceState","kind":"func","status":"implemented","sigHash":"e96171169aa8f239465d00cde9e5abec4d0bffa9d0b66cbb15f94ecdfa7d8d7b","bodyHash":"387d535020695b0c685561a549242b44ced588df639f247ad3461a1da9e6b5c3"}
 *
 * Go source:
 * func GetModuleInstanceState(node *Node) ModuleInstanceState {
 * 	return getModuleInstanceState(node, nil, nil)
 * }
 */
export function GetModuleInstanceState(node: GoPtr<Node>): ModuleInstanceState {
  return getModuleInstanceState(node, undefined!, undefined!);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::getModuleInstanceState","kind":"func","status":"implemented","sigHash":"8d27ab52a7084936279561e2e338eee5c8671178fbc74f3e0e45456751bfb01c","bodyHash":"453ec688d4048b4b4e3f8e2d1288922b44421263919ad933ea7e465d76a119d5"}
 *
 * Go source:
 * func getModuleInstanceState(node *Node, ancestors []*Node, visited map[NodeId]ModuleInstanceState) ModuleInstanceState {
 * 	module := node.AsModuleDeclaration()
 * 	if module.Body != nil {
 * 		return getModuleInstanceStateCached(module.Body, pushAncestor(ancestors, node), visited)
 * 	} else {
 * 		return ModuleInstanceStateInstantiated
 * 	}
 * }
 */
export function getModuleInstanceState(node: GoPtr<Node>, ancestors: GoSlice<GoPtr<Node>>, visited: GoMap<NodeId, ModuleInstanceState>): ModuleInstanceState {
  const module_ = AsModuleDeclaration(node);
  if (module_!.Body !== undefined) {
    return getModuleInstanceStateCached(module_!.Body, pushAncestor(ancestors, node), visited);
  } else {
    return ModuleInstanceStateInstantiated;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::getModuleInstanceStateCached","kind":"func","status":"implemented","sigHash":"17eaad3b7e15ec3fc3d6eb720510c5018fa23a5751bdc04d4c4e7f7089f5cd2b","bodyHash":"9c265ba3462c588dd7c3163c2cf3e8a02171ad596f528e4fa5fcf9217c546fc8"}
 *
 * Go source:
 * func getModuleInstanceStateCached(node *Node, ancestors []*Node, visited map[NodeId]ModuleInstanceState) ModuleInstanceState {
 * 	if visited == nil {
 * 		visited = make(map[NodeId]ModuleInstanceState)
 * 	}
 * 	nodeId := GetNodeId(node)
 * 	if cached, ok := visited[nodeId]; ok {
 * 		if cached != ModuleInstanceStateUnknown {
 * 			return cached
 * 		}
 * 		return ModuleInstanceStateNonInstantiated
 * 	}
 * 	visited[nodeId] = ModuleInstanceStateUnknown
 * 	result := getModuleInstanceStateWorker(node, ancestors, visited)
 * 	visited[nodeId] = result
 * 	return result
 * }
 */
export function getModuleInstanceStateCached(node: GoPtr<Node>, ancestors: GoSlice<GoPtr<Node>>, visited: GoMap<NodeId, ModuleInstanceState>): ModuleInstanceState {
  const visitedMap: GoMap<NodeId, ModuleInstanceState> = visited !== undefined ? visited : new globalThis.Map<NodeId, ModuleInstanceState>();
  const nodeId: NodeId = GetNodeId(node);
  if (visitedMap.has(nodeId)) {
    const cached: ModuleInstanceState = visitedMap.get(nodeId)!;
    if (cached !== ModuleInstanceStateUnknown) {
      return cached;
    }
    return ModuleInstanceStateNonInstantiated;
  }
  visitedMap.set(nodeId, ModuleInstanceStateUnknown);
  const result: ModuleInstanceState = getModuleInstanceStateWorker(node, ancestors, visitedMap);
  visitedMap.set(nodeId, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::getModuleInstanceStateWorker","kind":"func","status":"implemented","sigHash":"503805903b71f3cf7c69da9d042910542a5d94ff3309b6c783bf6a23800f10fb","bodyHash":"c4b8103408a343dc6d4b83acac0caf6cad91d54bcb1cdb5b3205f83c44175bc9"}
 *
 * Go source:
 * func getModuleInstanceStateWorker(node *Node, ancestors []*Node, visited map[NodeId]ModuleInstanceState) ModuleInstanceState {
 * 	// A module is uninstantiated if it contains only
 * 	switch node.Kind {
 * 	case KindInterfaceDeclaration, KindTypeAliasDeclaration, KindJSTypeAliasDeclaration:
 * 		return ModuleInstanceStateNonInstantiated
 * 	case KindEnumDeclaration:
 * 		if IsEnumConst(node) {
 * 			return ModuleInstanceStateConstEnumOnly
 * 		}
 * 	case KindImportDeclaration, KindJSImportDeclaration, KindImportEqualsDeclaration:
 * 		if !HasSyntacticModifier(node, ModifierFlagsExport) {
 * 			return ModuleInstanceStateNonInstantiated
 * 		}
 * 	case KindExportDeclaration:
 * 		decl := node.AsExportDeclaration()
 * 		if decl.ModuleSpecifier == nil && decl.ExportClause != nil && decl.ExportClause.Kind == KindNamedExports {
 * 			state := ModuleInstanceStateNonInstantiated
 * 			ancestors = pushAncestor(ancestors, node)
 * 			ancestors = pushAncestor(ancestors, decl.ExportClause)
 * 			for _, specifier := range decl.ExportClause.Elements() {
 * 				specifierState := getModuleInstanceStateForAliasTarget(specifier, ancestors, visited)
 * 				if specifierState > state {
 * 					state = specifierState
 * 				}
 * 				if state == ModuleInstanceStateInstantiated {
 * 					return state
 * 				}
 * 			}
 * 			return state
 * 		}
 * 	case KindModuleBlock:
 * 		state := ModuleInstanceStateNonInstantiated
 * 		ancestors = pushAncestor(ancestors, node)
 * 		node.ForEachChild(func(n *Node) bool {
 * 			childState := getModuleInstanceStateCached(n, ancestors, visited)
 * 			switch childState {
 * 			case ModuleInstanceStateNonInstantiated:
 * 				return false
 * 			case ModuleInstanceStateConstEnumOnly:
 * 				state = ModuleInstanceStateConstEnumOnly
 * 				return false
 * 			case ModuleInstanceStateInstantiated:
 * 				state = ModuleInstanceStateInstantiated
 * 				return true
 * 			}
 * 			panic("Unhandled case in getModuleInstanceStateWorker")
 * 		})
 * 		return state
 * 	case KindModuleDeclaration:
 * 		return getModuleInstanceState(node, ancestors, visited)
 * 	}
 * 	return ModuleInstanceStateInstantiated
 * }
 */
export function getModuleInstanceStateWorker(node: GoPtr<Node>, ancestors: GoSlice<GoPtr<Node>>, visited: GoMap<NodeId, ModuleInstanceState>): ModuleInstanceState {
  // A module is uninstantiated if it contains only
  switch (node!.Kind) {
    case KindInterfaceDeclaration:
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
      return ModuleInstanceStateNonInstantiated;
    case KindEnumDeclaration:
      if (IsEnumConst(node)) {
        return ModuleInstanceStateConstEnumOnly;
      }
      break;
    case KindImportDeclaration:
    case KindJSImportDeclaration:
    case KindImportEqualsDeclaration:
      if (!HasSyntacticModifier(node, ModifierFlagsExport)) {
        return ModuleInstanceStateNonInstantiated;
      }
      break;
    case KindExportDeclaration: {
      const decl = AsExportDeclaration(node);
      if (decl!.ModuleSpecifier === undefined && decl!.ExportClause !== undefined && decl!.ExportClause!.Kind === KindNamedExports) {
        const stateAncestors: GoSlice<GoPtr<Node>> = pushAncestor(pushAncestor(ancestors, node), decl!.ExportClause);
        const stateBox = { value: ModuleInstanceStateNonInstantiated as ModuleInstanceState };
        for (const specifier of Node_Elements(decl!.ExportClause)!) {
          const specifierState: ModuleInstanceState = getModuleInstanceStateForAliasTarget(specifier, stateAncestors, visited);
          if (specifierState > stateBox.value) {
            stateBox.value = specifierState;
          }
          if (stateBox.value === ModuleInstanceStateInstantiated) {
            return stateBox.value;
          }
        }
        return stateBox.value;
      }
      break;
    }
    case KindModuleBlock: {
      const stateBox = { state: ModuleInstanceStateNonInstantiated as ModuleInstanceState };
      const blockAncestors: GoSlice<GoPtr<Node>> = pushAncestor(ancestors, node);
      Node_ForEachChild(node, (n: GoPtr<Node>): bool => {
        const childState: ModuleInstanceState = getModuleInstanceStateCached(n, blockAncestors, visited);
        switch (childState) {
          case ModuleInstanceStateNonInstantiated:
            return false as bool;
          case ModuleInstanceStateConstEnumOnly:
            stateBox.state = ModuleInstanceStateConstEnumOnly;
            return false as bool;
          case ModuleInstanceStateInstantiated:
            stateBox.state = ModuleInstanceStateInstantiated;
            return true as bool;
        }
        throw new globalThis.Error("Unhandled case in getModuleInstanceStateWorker");
      });
      return stateBox.state;
    }
    case KindModuleDeclaration:
      return getModuleInstanceState(node, ancestors, visited);
  }
  return ModuleInstanceStateInstantiated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::getModuleInstanceStateForAliasTarget","kind":"func","status":"implemented","sigHash":"f3dc3b689b92452637cc0ec878ea0bcb97da8e32f25a6395789eadcdc75f1212","bodyHash":"ab30b9f3c9f5f08c02e0c6f18df879133a2d729e86f00632dc9fc7fa6c78edd3"}
 *
 * Go source:
 * func getModuleInstanceStateForAliasTarget(node *Node, ancestors []*Node, visited map[NodeId]ModuleInstanceState) ModuleInstanceState {
 * 	name := node.PropertyNameOrName()
 * 	if name.Kind != KindIdentifier {
 * 		// Skip for invalid syntax like this: export { "x" }
 * 		return ModuleInstanceStateInstantiated
 * 	}
 * 	for ancestors, p := popAncestor(ancestors, node); p != nil; ancestors, p = popAncestor(ancestors, p) {
 * 		if IsBlock(p) || IsModuleBlock(p) || IsSourceFile(p) {
 * 			found := ModuleInstanceStateUnknown
 * 			statementsAncestors := pushAncestor(ancestors, p)
 * 			for _, statement := range p.Statements() {
 * 				if NodeHasName(statement, name) {
 * 					state := getModuleInstanceStateCached(statement, statementsAncestors, visited)
 * 					if found == ModuleInstanceStateUnknown || state > found {
 * 						found = state
 * 					}
 * 					if found == ModuleInstanceStateInstantiated {
 * 						return found
 * 					}
 * 					if statement.Kind == KindImportEqualsDeclaration {
 * 						// Treat re-exports of import aliases as instantiated since they're ambiguous. This is consistent
 * 						// with `export import x = mod.x` being treated as instantiated:
 * 						//   import x = mod.x;
 * 						//   export { x };
 * 						found = ModuleInstanceStateInstantiated
 * 					}
 * 				}
 * 			}
 * 			if found != ModuleInstanceStateUnknown {
 * 				return found
 * 			}
 * 		}
 * 	}
 * 	// Couldn't locate, assume could refer to a value
 * 	return ModuleInstanceStateInstantiated
 * }
 */
export function getModuleInstanceStateForAliasTarget(node: GoPtr<Node>, ancestors: GoSlice<GoPtr<Node>>, visited: GoMap<NodeId, ModuleInstanceState>): ModuleInstanceState {
  const name: GoPtr<Node> = Node_PropertyNameOrName(node);
  if (name!.Kind !== KindIdentifier) {
    // Skip for invalid syntax like this: export { "x" }
    return ModuleInstanceStateInstantiated;
  }
  const [initAncestors, initP] = popAncestor(ancestors, node);
  const outerLoop = (currentAncestors: GoSlice<GoPtr<Node>>, p: GoPtr<Node>): ModuleInstanceState => {
    if (p === undefined) return ModuleInstanceStateInstantiated;
    const [nextAncestors, nextP] = popAncestor(currentAncestors, p);
    if (IsBlock(p) || IsModuleBlock(p) || IsSourceFile(p)) {
      const statementsAncestors: GoSlice<GoPtr<Node>> = pushAncestor(currentAncestors, p);
      const foundBox = { value: ModuleInstanceStateUnknown as ModuleInstanceState };
      for (const statement of Node_Statements(p) ?? []) {
        if (NodeHasName(statement, name)) {
          const state: ModuleInstanceState = getModuleInstanceStateCached(statement, statementsAncestors, visited);
          if (foundBox.value === ModuleInstanceStateUnknown || state > foundBox.value) {
            foundBox.value = state;
          }
          if (foundBox.value === ModuleInstanceStateInstantiated) {
            return foundBox.value;
          }
          if (statement!.Kind === KindImportEqualsDeclaration) {
            // Treat re-exports of import aliases as instantiated since they're ambiguous. This is consistent
            // with `export import x = mod.x` being treated as instantiated:
            //   import x = mod.x;
            //   export { x };
            foundBox.value = ModuleInstanceStateInstantiated;
          }
        }
      }
      if (foundBox.value !== ModuleInstanceStateUnknown) {
        return foundBox.value;
      }
    }
    return outerLoop(nextAncestors, nextP);
  };
  // Couldn't locate, assume could refer to a value
  return outerLoop(initAncestors, initP);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsInstantiatedModule","kind":"func","status":"implemented","sigHash":"d1f45ff0581c843ed2e40ef144a266a826203c2c398e51f530b2ef3d96e3dec2","bodyHash":"d54b29d188c85742154c72e58e7b60606519f7c647cfcc5684b2445d51747d6b"}
 *
 * Go source:
 * func IsInstantiatedModule(node *Node, preserveConstEnums bool) bool {
 * 	moduleState := GetModuleInstanceState(node)
 * 	return moduleState == ModuleInstanceStateInstantiated ||
 * 		(preserveConstEnums && moduleState == ModuleInstanceStateConstEnumOnly)
 * }
 */
export function IsInstantiatedModule(node: GoPtr<Node>, preserveConstEnums: bool): bool {
  const moduleState: ModuleInstanceState = GetModuleInstanceState(node);
  return (moduleState === ModuleInstanceStateInstantiated ||
    (preserveConstEnums && moduleState === ModuleInstanceStateConstEnumOnly)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::NodeHasName","kind":"func","status":"implemented","sigHash":"3f23926cb8c109c0a33737771b33ab34300f5456e337e1968a695b7e0948ad72","bodyHash":"3a6ef459b084bcec455774dad8143fe319a174782f81046b8d0b00e8a756260d"}
 *
 * Go source:
 * func NodeHasName(statement *Node, id *Node) bool {
 * 	name := statement.Name()
 * 	if name != nil {
 * 		return IsIdentifier(name) && name.Text() == id.Text()
 * 	}
 * 	if IsVariableStatement(statement) {
 * 		declarations := statement.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations.Nodes
 * 		return core.Some(declarations, func(d *Node) bool { return NodeHasName(d, id) })
 * 	}
 * 	return false
 * }
 */
export function NodeHasName(statement: GoPtr<Node>, id: GoPtr<Node>): bool {
  const name: GoPtr<Node> = Node_Name(statement);
  if (name !== undefined) {
    return (IsIdentifier(name) && Node_Text(name) === Node_Text(id)) as bool;
  }
  if (IsVariableStatement(statement)) {
    const declarations = AsVariableDeclarationList(AsVariableStatement(statement)!.DeclarationList)!.Declarations!.Nodes;
    return Some(declarations, (d: GoPtr<Node>): bool => {
      return NodeHasName(d, id);
    });
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsInternalModuleImportEqualsDeclaration","kind":"func","status":"implemented","sigHash":"0064514cea5f4aefbbfefa28e207536b81a4b2e7c2703051bb6012d144c51ab2","bodyHash":"c028f750cff1f75705b784875a7e127739b427a164857e0ba83c3b907fad302b"}
 *
 * Go source:
 * func IsInternalModuleImportEqualsDeclaration(node *Node) bool {
 * 	return IsImportEqualsDeclaration(node) && node.AsImportEqualsDeclaration().ModuleReference.Kind != KindExternalModuleReference
 * }
 */
export function IsInternalModuleImportEqualsDeclaration(node: GoPtr<Node>): bool {
  return (IsImportEqualsDeclaration(node) && AsImportEqualsDeclaration(node)!.ModuleReference!.Kind !== KindExternalModuleReference) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsConstAssertion","kind":"func","status":"implemented","sigHash":"6389103fd7197dd598d698671303353f776d0efde5fe87dc04599adde46ac3f6","bodyHash":"8c58cc5cda860a19827a1ea79292ac5914686762f88ceca085f440819546b968"}
 *
 * Go source:
 * func IsConstAssertion(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindAsExpression, KindTypeAssertionExpression:
 * 		return IsConstTypeReference(node.Type())
 * 	}
 * 	return false
 * }
 */
export function IsConstAssertion(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindAsExpression:
    case KindTypeAssertionExpression:
      return IsConstTypeReference(Node_Type(node));
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsConstTypeReference","kind":"func","status":"implemented","sigHash":"36778648070fbe41198f0e574c3e01944f4239e4c50c72ace5ed44298aab251c","bodyHash":"781f335cb67730782f6611783d12c8cf507324361d2cc573987970f50db35992"}
 *
 * Go source:
 * func IsConstTypeReference(node *Node) bool {
 * 	return IsTypeReferenceNode(node) && len(node.TypeArguments()) == 0 && IsIdentifier(node.AsTypeReferenceNode().TypeName) && node.AsTypeReferenceNode().TypeName.Text() == "const"
 * }
 */
export function IsConstTypeReference(node: GoPtr<Node>): bool {
  return (IsTypeReferenceNode(node) && (Node_TypeArguments(node)?.length ?? 0) === 0 &&
    IsIdentifier(AsTypeReferenceNode(node)!.TypeName) && Node_Text(AsTypeReferenceNode(node)!.TypeName) === "const") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsGlobalSourceFile","kind":"func","status":"implemented","sigHash":"b98a5ac3406aa1f5884b438e11c24568f35ccc4f84c8bd73e86b4fef19f7813e","bodyHash":"f831f76b089fef8057fec4b0ff1cd4321ca0b9e02af42f1bdd61012d9cdff271"}
 *
 * Go source:
 * func IsGlobalSourceFile(node *Node) bool {
 * 	return node.Kind == KindSourceFile && !IsExternalOrCommonJSModule(node.AsSourceFile())
 * }
 */
export function IsGlobalSourceFile(node: GoPtr<Node>): bool {
  return (node!.Kind === KindSourceFile && !IsExternalOrCommonJSModule(AsSourceFile(node))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsParameterLike","kind":"func","status":"implemented","sigHash":"2498b572622a384df6c9d4dab3fd49aaa95465f1302b3a7e356ce020a3a067f7","bodyHash":"e6bb385314af1ff7887ef77e2fa0a81f3e8d86bb5f55142a4873a77a50045c8f"}
 *
 * Go source:
 * func IsParameterLike(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindParameter, KindTypeParameter:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsParameterLike(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindParameter:
    case KindTypeParameter:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetDeclarationOfKind","kind":"func","status":"implemented","sigHash":"f3487b8a17c9c3b6a6295fb6b31d62258ce9235c55ab9d2722d483865770f705","bodyHash":"edaa87e95fccb603d3bac3553030474722dfa6514196e4ca458b69612e75f7e0"}
 *
 * Go source:
 * func GetDeclarationOfKind(symbol *Symbol, kind Kind) *Node {
 * 	for _, declaration := range symbol.Declarations {
 * 		if declaration.Kind == kind {
 * 			return declaration
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function GetDeclarationOfKind(symbol_: GoPtr<Symbol>, kind: Kind): GoPtr<Node> {
  for (const declaration of symbol_!.Declarations ?? []) {
    if (declaration!.Kind === kind) {
      return declaration;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::FindConstructorDeclaration","kind":"func","status":"implemented","sigHash":"3d4fb0fa2a9990e0205b80b42ff2aa24788cba9b4ff36c73af3fd84be403f7ca","bodyHash":"0df9c0cd2ab0ae433b11c2bd473ace131333ba4180f024a4af231d1c37723ed6"}
 *
 * Go source:
 * func FindConstructorDeclaration(node *ClassLikeDeclaration) *Node {
 * 	for _, member := range node.Members() {
 * 		if IsConstructorDeclaration(member) && NodeIsPresent(member.Body()) {
 * 			return member
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function FindConstructorDeclaration(node: GoPtr<ClassLikeDeclaration>): GoPtr<Node> {
  for (const member of Node_Members(node) ?? []) {
    if (IsConstructorDeclaration(member) && NodeIsPresent(Node_Body(member))) {
      return member;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetFirstIdentifier","kind":"func","status":"implemented","sigHash":"2c971fb93e3d00887cde4ef6402962c98202b3d561abca38e77cc302069aa69c","bodyHash":"ed587db7341e1fb7804860c4352afacc01ea241199f17abc89c5c127af2e5133"}
 *
 * Go source:
 * func GetFirstIdentifier(node *Node) *Node {
 * 	switch node.Kind {
 * 	case KindIdentifier:
 * 		return node
 * 	case KindQualifiedName:
 * 		return GetFirstIdentifier(node.AsQualifiedName().Left)
 * 	case KindPropertyAccessExpression:
 * 		return GetFirstIdentifier(node.AsPropertyAccessExpression().Expression)
 * 	}
 * 	panic("Unhandled case in GetFirstIdentifier")
 * }
 */
export function GetFirstIdentifier(node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindIdentifier:
      return node;
    case KindQualifiedName:
      return GetFirstIdentifier(AsQualifiedName(node)!.Left);
    case KindPropertyAccessExpression:
      return GetFirstIdentifier(AsPropertyAccessExpression(node)!.Expression);
  }
  throw new globalThis.Error("Unhandled case in GetFirstIdentifier");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetNamespaceDeclarationNode","kind":"func","status":"implemented","sigHash":"172f35df97f0995e0cc5a95f46e22be747cb7278b260a453d14515d773709626","bodyHash":"332fc2e4d18b4aebd2923c1b66c763f063ac2cf53fa85bde7a8a4f53db698609"}
 *
 * Go source:
 * func GetNamespaceDeclarationNode(node *Node) *Node {
 * 	switch node.Kind {
 * 	case KindImportDeclaration, KindJSImportDeclaration:
 * 		importClause := node.ImportClause()
 * 		if importClause != nil && importClause.AsImportClause().NamedBindings != nil && IsNamespaceImport(importClause.AsImportClause().NamedBindings) {
 * 			return importClause.AsImportClause().NamedBindings
 * 		}
 * 	case KindImportEqualsDeclaration:
 * 		return node
 * 	case KindExportDeclaration:
 * 		exportClause := node.AsExportDeclaration().ExportClause
 * 		if exportClause != nil && IsNamespaceExport(exportClause) {
 * 			return exportClause
 * 		}
 * 	default:
 * 		panic("Unhandled case in getNamespaceDeclarationNode")
 * 	}
 * 	return nil
 * }
 */
export function GetNamespaceDeclarationNode(node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindImportDeclaration:
    case KindJSImportDeclaration: {
      const importClause: GoPtr<Node> = Node_ImportClause(node);
      if (importClause !== undefined && AsImportClause(importClause)!.NamedBindings !== undefined && IsNamespaceImport(AsImportClause(importClause)!.NamedBindings)) {
        return AsImportClause(importClause)!.NamedBindings;
      }
      break;
    }
    case KindImportEqualsDeclaration:
      return node;
    case KindExportDeclaration: {
      const exportClause: GoPtr<Node> = AsExportDeclaration(node)!.ExportClause;
      if (exportClause !== undefined && IsNamespaceExport(exportClause)) {
        return exportClause;
      }
      break;
    }
    default:
      throw new globalThis.Error("Unhandled case in getNamespaceDeclarationNode");
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::ModuleExportNameIsDefault","kind":"func","status":"implemented","sigHash":"dbada5f32ef6538611891ae7fd2f5ce76890daa0148ca3c3e7390e9fce6ef523","bodyHash":"6bf18eb7b5ba1f4007a64760f618300a06ec1041d7e84a616b9f6e19bd8f00e1"}
 *
 * Go source:
 * func ModuleExportNameIsDefault(node *Node) bool {
 * 	return node.Text() == InternalSymbolNameDefault
 * }
 */
export function ModuleExportNameIsDefault(node: GoPtr<Node>): bool {
  return (Node_Text(node) === InternalSymbolNameDefault) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsDefaultImport","kind":"func","status":"implemented","sigHash":"010d548c77402e7b932a8addec11010faad0386294be84cb6fdd737d135e1b38","bodyHash":"fbfb3aa7a181a68bbcb839f531eca5fc53bc9b3a03681af31b83592c8269abfe"}
 *
 * Go source:
 * func IsDefaultImport(node *Node /*ImportDeclaration | ImportEqualsDeclaration | ExportDeclaration* /) bool {
 * 	switch node.Kind {
 * 	case KindImportDeclaration, KindJSImportDeclaration:
 * 		importClause := node.ImportClause()
 * 		return importClause != nil && importClause.AsImportClause().name != nil
 * 	}
 * 	return false
 * }
 */
export function IsDefaultImport(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindImportDeclaration:
    case KindJSImportDeclaration: {
      const importClause: GoPtr<Node> = Node_ImportClause(node);
      return (importClause !== undefined && AsImportClause(importClause)!.name !== undefined) as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetImpliedNodeFormatForFile","kind":"func","status":"implemented","sigHash":"c5c5c45699a1ab3188ec5d5813425742c0143e3af84d39c5f8dd08c85ee8f3d7","bodyHash":"f56ff1ae4ec378897f7ed14ef55b7f5509e89695a790d447aaf21a351c4a9284"}
 *
 * Go source:
 * func GetImpliedNodeFormatForFile(path string, packageJsonType string) core.ModuleKind {
 * 	impliedNodeFormat := core.ResolutionModeNone
 * 	if tspath.FileExtensionIsOneOf(path, []string{tspath.ExtensionDmts, tspath.ExtensionMts, tspath.ExtensionMjs}) {
 * 		impliedNodeFormat = core.ResolutionModeESM
 * 	} else if tspath.FileExtensionIsOneOf(path, []string{tspath.ExtensionDcts, tspath.ExtensionCts, tspath.ExtensionCjs}) {
 * 		impliedNodeFormat = core.ResolutionModeCommonJS
 * 	} else if tspath.FileExtensionIsOneOf(path, []string{tspath.ExtensionDts, tspath.ExtensionTs, tspath.ExtensionTsx, tspath.ExtensionJs, tspath.ExtensionJsx}) {
 * 		impliedNodeFormat = core.IfElse(packageJsonType == "module", core.ResolutionModeESM, core.ResolutionModeCommonJS)
 * 	}
 * 
 * 	return impliedNodeFormat
 * }
 */
export function GetImpliedNodeFormatForFile(path: string, packageJsonType: string): ModuleKind {
  return FileExtensionIsOneOf(path, [ExtensionDmts, ExtensionMts, ExtensionMjs])
    ? ResolutionModeESM
    : FileExtensionIsOneOf(path, [ExtensionDcts, ExtensionCts, ExtensionCjs])
    ? ResolutionModeCommonJS
    : FileExtensionIsOneOf(path, [ExtensionDts, ExtensionTs, ExtensionTsx, ExtensionJs, ExtensionJsx])
    ? IfElse(packageJsonType === "module", ResolutionModeESM, ResolutionModeCommonJS)
    : ResolutionModeNone;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetEmitModuleFormatOfFileWorker","kind":"func","status":"implemented","sigHash":"0adb8a52e3bd1b44b86a4c9ec548f5237c8d35cd489adc57d041908aeed933f8","bodyHash":"09313c85893ebc890ccc8f62a0959419cba21e1e8c761f165f607d34b0385976"}
 *
 * Go source:
 * func GetEmitModuleFormatOfFileWorker(fileName string, options *core.CompilerOptions, sourceFileMetaData SourceFileMetaData) core.ModuleKind {
 * 	result := GetImpliedNodeFormatForEmitWorker(fileName, options.GetEmitModuleKind(), sourceFileMetaData)
 * 	if result != core.ModuleKindNone {
 * 		return result
 * 	}
 * 	return options.GetEmitModuleKind()
 * }
 */
export function GetEmitModuleFormatOfFileWorker(fileName: string, options: GoPtr<CompilerOptions>, sourceFileMetaData: SourceFileMetaData): ModuleKind {
  const result: ModuleKind = GetImpliedNodeFormatForEmitWorker(fileName, CompilerOptions_GetEmitModuleKind(options), sourceFileMetaData);
  if (result !== ModuleKindNone) {
    return result;
  }
  return CompilerOptions_GetEmitModuleKind(options);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetImpliedNodeFormatForEmitWorker","kind":"func","status":"implemented","sigHash":"32076ff66eaaceb79a5d0c82ef1dfd63cdb85e99469acecc9025cb993c049856","bodyHash":"820686ae21dc026a9241641dde26305e6012832a0cb53fa6cab917202709b655"}
 *
 * Go source:
 * func GetImpliedNodeFormatForEmitWorker(fileName string, emitModuleKind core.ModuleKind, sourceFileMetaData SourceFileMetaData) core.ResolutionMode {
 * 	if core.ModuleKindNode16 <= emitModuleKind && emitModuleKind <= core.ModuleKindNodeNext {
 * 		return sourceFileMetaData.ImpliedNodeFormat
 * 	}
 * 	if sourceFileMetaData.ImpliedNodeFormat == core.ModuleKindCommonJS &&
 * 		(sourceFileMetaData.PackageJsonType == "commonjs" ||
 * 			tspath.FileExtensionIsOneOf(fileName, []string{tspath.ExtensionCjs, tspath.ExtensionCts})) {
 * 		return core.ModuleKindCommonJS
 * 	}
 * 	if sourceFileMetaData.ImpliedNodeFormat == core.ModuleKindESNext &&
 * 		(sourceFileMetaData.PackageJsonType == "module" ||
 * 			tspath.FileExtensionIsOneOf(fileName, []string{tspath.ExtensionMjs, tspath.ExtensionMts})) {
 * 		return core.ModuleKindESNext
 * 	}
 * 	return core.ModuleKindNone
 * }
 */
export function GetImpliedNodeFormatForEmitWorker(fileName: string, emitModuleKind: ModuleKind, sourceFileMetaData: SourceFileMetaData): ResolutionMode {
  if (ModuleKindNode16 <= emitModuleKind && emitModuleKind <= ModuleKindNodeNext) {
    return sourceFileMetaData.ImpliedNodeFormat;
  }
  if (sourceFileMetaData.ImpliedNodeFormat === ModuleKindCommonJS &&
    (sourceFileMetaData.PackageJsonType === "commonjs" ||
      FileExtensionIsOneOf(fileName, [ExtensionCjs, ExtensionCts]))) {
    return ModuleKindCommonJS;
  }
  if (sourceFileMetaData.ImpliedNodeFormat === ModuleKindESNext &&
    (sourceFileMetaData.PackageJsonType === "module" ||
      FileExtensionIsOneOf(fileName, [ExtensionMjs, ExtensionMts]))) {
    return ModuleKindESNext;
  }
  return ModuleKindNone;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetDeclarationContainer","kind":"func","status":"implemented","sigHash":"412b5641889318c48418dc6b3cce1f394219def5d99a2e867373037381b92ecd","bodyHash":"5b74a987b9cfbe99d9b524858dad336a73ca3febf0b25247ca622860b761e408"}
 *
 * Go source:
 * func GetDeclarationContainer(node *Node) *Node {
 * 	return FindAncestor(GetRootDeclaration(node), func(node *Node) bool {
 * 		switch node.Kind {
 * 		case KindVariableDeclaration,
 * 			KindVariableDeclarationList,
 * 			KindImportSpecifier,
 * 			KindNamedImports,
 * 			KindNamespaceImport,
 * 			KindImportClause:
 * 			return false
 * 		default:
 * 			return true
 * 		}
 * 	}).Parent
 * }
 */
export function GetDeclarationContainer(node: GoPtr<Node>): GoPtr<Node> {
  return FindAncestor(GetRootDeclaration(node), (n: GoPtr<Node>): bool => {
    switch (n!.Kind) {
      case KindVariableDeclaration:
      case KindVariableDeclarationList:
      case KindImportSpecifier:
      case KindNamedImports:
      case KindNamespaceImport:
      case KindImportClause:
        return false as bool;
      default:
        return true as bool;
    }
  })!.Parent;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsNonLocalAlias","kind":"func","status":"implemented","sigHash":"0e854fd8331458e8177a353cb42ee7ba64932c047879cee53f3e8d2a85aa034c","bodyHash":"8e02be5e8d2f54328fed9e7c4121ac9bacd3e48e7881602dee0bd9f2774694db"}
 *
 * Go source:
 * func IsNonLocalAlias(symbol *Symbol, excludes SymbolFlags) bool {
 * 	if symbol == nil {
 * 		return false
 * 	}
 * 	return symbol.Flags&(SymbolFlagsAlias|excludes) == SymbolFlagsAlias ||
 * 		symbol.Flags&SymbolFlagsAlias != 0 && symbol.Flags&SymbolFlagsAssignment != 0
 * }
 */
export function IsNonLocalAlias(symbol_: GoPtr<Symbol>, excludes: SymbolFlags): bool {
  if (symbol_ === undefined) {
    return false as bool;
  }
  return ((symbol_!.Flags & (SymbolFlagsAlias | excludes)) === SymbolFlagsAlias ||
    ((symbol_!.Flags & SymbolFlagsAlias) !== 0 && (symbol_!.Flags & SymbolFlagsAssignment) !== 0)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsAliasSymbolDeclaration","kind":"func","status":"implemented","sigHash":"95d6801c73c4728c240450eddfd9af4053a99d2a4e1a34c595237077c7eef5a0","bodyHash":"a0348d076974de92342f11e09098c77295536497b1a58313dc10a3c2fa248549"}
 *
 * Go source:
 * func IsAliasSymbolDeclaration(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindImportEqualsDeclaration, KindNamespaceExportDeclaration, KindNamespaceImport, KindNamespaceExport,
 * 		KindImportSpecifier, KindExportSpecifier:
 * 		return true
 * 	case KindImportClause:
 * 		return node.AsImportClause().Name() != nil
 * 	case KindExportAssignment:
 * 		return ExpressionIsAlias(node.Expression())
 * 	case KindVariableDeclaration, KindBindingElement:
 * 		return IsVariableDeclarationInitializedToRequire(node)
 * 	case KindBinaryExpression:
 * 		switch GetAssignmentDeclarationKind(node) {
 * 		case JSDeclarationKindModuleExports, JSDeclarationKindExportsProperty:
 * 			return ExpressionIsAlias(node.AsBinaryExpression().Right)
 * 		}
 * 	}
 * 	return false
 * }
 */
export function IsAliasSymbolDeclaration(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindImportEqualsDeclaration:
    case KindNamespaceExportDeclaration:
    case KindNamespaceImport:
    case KindNamespaceExport:
    case KindImportSpecifier:
    case KindExportSpecifier:
      return true as bool;
    case KindImportClause:
      return (Node_Name(node) !== undefined) as bool;
    case KindExportAssignment:
      return ExpressionIsAlias(Node_Expression(node));
    case KindVariableDeclaration:
    case KindBindingElement:
      return IsVariableDeclarationInitializedToRequire(node);
    case KindBinaryExpression:
      switch (GetAssignmentDeclarationKind(node)) {
        case JSDeclarationKindModuleExports:
        case JSDeclarationKindExportsProperty:
          return ExpressionIsAlias(AsBinaryExpression(node)!.Right);
      }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsParseTreeNode","kind":"func","status":"implemented","sigHash":"87ff8416c525d43e3d3163d71d303e5381d7330f6082274b4f31ca1b4be42718","bodyHash":"9fb08822a9f292d0c3b72fd0df438649cfcb98a1f8404a9b89bc257a25e60069"}
 *
 * Go source:
 * func IsParseTreeNode(node *Node) bool {
 * 	return node.Flags&NodeFlagsSynthesized == 0
 * }
 */
export function IsParseTreeNode(node: GoPtr<Node>): bool {
  return ((node!.Flags & NodeFlagsSynthesized) === 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetNodeAtPosition","kind":"func","status":"implemented","sigHash":"417cfe52e949168d9a571cfbd772917304bc8178217441024beabf8a414f2663","bodyHash":"1312c76b3780d715144b062b8f5a6cf284cbd5fd54427a34f22f0c9045022cf7"}
 *
 * Go source:
 * func GetNodeAtPosition(file *SourceFile, position int, includeJSDoc bool) *Node {
 * 	current := file.AsNode()
 * 	for {
 * 		var child *Node
 * 		if includeJSDoc {
 * 			for _, jsdoc := range current.JSDoc(file) {
 * 				if nodeContainsPosition(jsdoc, position) {
 * 					child = jsdoc
 * 					break
 * 				}
 * 			}
 * 		}
 * 		if child == nil {
 * 			current.ForEachChild(func(node *Node) bool {
 * 				if nodeContainsPosition(node, position) {
 * 					child = node
 * 					return true
 * 				}
 * 				return false
 * 			})
 * 		}
 * 		if child == nil || IsMetaProperty(child) {
 * 			return current
 * 		}
 * 		current = child
 * 	}
 * }
 */
export function GetNodeAtPosition(file: GoPtr<SourceFile>, position: int, includeJSDoc: bool): GoPtr<Node> {
  const loop = (current: GoPtr<Node>): GoPtr<Node> => {
    const jsdocChild: GoPtr<Node> = includeJSDoc ? (() => {
      const found = { value: undefined as GoPtr<Node> };
      for (const jsdoc of Node_JSDoc(current, file)) {
        if (nodeContainsPosition(jsdoc, position)) { found.value = jsdoc; break; }
      }
      return found.value;
    })() : undefined;
    const child: GoPtr<Node> = jsdocChild !== undefined ? jsdocChild : (() => {
      const found = { value: undefined as GoPtr<Node> };
      Node_ForEachChild(current, (node: GoPtr<Node>): bool => {
        if (nodeContainsPosition(node, position)) { found.value = node; return true as bool; }
        return false as bool;
      });
      return found.value;
    })();
    if (child === undefined || IsMetaProperty(child)) return current;
    return loop(child);
  };
  return loop(NodeDefault_AsNode(file));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::nodeContainsPosition","kind":"func","status":"implemented","sigHash":"1af2b5728d837bc3b1eefd0e507e02a4ee5beebd0119539e887cad3e4568d67b","bodyHash":"d9f250e35674da43bdfcd309002360b912b16a666f437fca04885f0e0d5befa7"}
 *
 * Go source:
 * func nodeContainsPosition(node *Node, position int) bool {
 * 	return node.Kind >= KindFirstNode && node.Pos() <= position && (position < node.End() || position == node.End() && node.Kind == KindEndOfFile)
 * }
 */
export function nodeContainsPosition(node: GoPtr<Node>, position: int): bool {
  return (node!.Kind >= KindFirstNode && Node_Pos(node) <= position &&
    (position < Node_End(node) || (position === Node_End(node) && node!.Kind === KindEndOfFile))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::findImportOrRequire","kind":"func","status":"implemented","sigHash":"dc74ebd84691acdaa23ed9ecd060a4e3f0c4eff44bc25a50aa1e7dbd8a2233a2","bodyHash":"b7bab03f95853ac66811cc7c9ec6cee4845cfb117b81ee6e95ec4027a33c8c2d"}
 *
 * Go source:
 * func findImportOrRequire(text string, start int) (index int, size int) {
 * 	index = max(start, 0)
 * 	n := len(text)
 * 	for index < n {
 * 		next := strings.IndexAny(text[index:], "ir")
 * 		if next < 0 {
 * 			break
 * 		}
 * 		index += next
 * 
 * 		var expected string
 * 		if text[index] == 'i' {
 * 			size = 6
 * 			expected = "import"
 * 		} else {
 * 			size = 7
 * 			expected = "require"
 * 		}
 * 		if index+size <= n && text[index:index+size] == expected {
 * 			return index, size
 * 		}
 * 		index++
 * 	}
 * 
 * 	return -1, 0
 * }
 */
export function findImportOrRequire(text: string, start: int): [int, int] {
  // Go strings are UTF-8 byte sequences; `start`/`index` are byte offsets into
  // the source text, so reads must go through the byte view.
  const n: int = utilByteLen(text);
  let index = globalThis.Math.max(start, 0) as int;
  while (index < n) {
    const next: int = strings.IndexAny(utilByteSlice(text, index), "ir");
    if (next < 0) {
      return [-1 as int, 0 as int];
    }
    const newIndex = (index + next) as int;
    const isImport = utilByteAt(text, newIndex) === 0x69 /* 'i' */;
    const size: int = isImport ? 6 as int : 7 as int;
    const expected = isImport ? "import" : "require";
    if (newIndex + size <= n && utilByteSlice(text, newIndex, newIndex + size) === expected) {
      return [newIndex, size];
    }
    index = (newIndex + 1) as int;
  }
  return [-1 as int, 0 as int];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::ForEachDynamicImportOrRequireCall","kind":"func","status":"implemented","sigHash":"307f557334c6e2f15e072578d02d26234cb8fd02764395d71fa1b23cd2d9597f","bodyHash":"801dabc03f9f89ece2e9d78a1d0e2aa9607057e5bcb0392d1a456f9aa4f6d8f6"}
 *
 * Go source:
 * func ForEachDynamicImportOrRequireCall(
 * 	file *SourceFile,
 * 	includeTypeSpaceImports bool,
 * 	requireStringLiteralLikeArgument bool,
 * 	cb func(node *Node, argument *Expression) bool,
 * ) bool {
 * 	isJavaScriptFile := IsInJSFile(file.AsNode())
 * 	lastIndex, size := findImportOrRequire(file.Text(), 0)
 * 	for lastIndex >= 0 {
 * 		node := GetNodeAtPosition(file, lastIndex, isJavaScriptFile && includeTypeSpaceImports)
 * 		if isJavaScriptFile && IsRequireCall(node, requireStringLiteralLikeArgument) {
 * 			if cb(node, node.Arguments()[0]) {
 * 				return true
 * 			}
 * 		} else if IsImportCall(node) && len(node.Arguments()) > 0 && (!requireStringLiteralLikeArgument || IsStringLiteralLike(node.Arguments()[0])) {
 * 			if cb(node, node.Arguments()[0]) {
 * 				return true
 * 			}
 * 		} else if includeTypeSpaceImports && IsLiteralImportTypeNode(node) {
 * 			if cb(node, node.AsImportTypeNode().Argument.AsLiteralTypeNode().Literal) {
 * 				return true
 * 			}
 * 		}
 * 		// skip past import/require
 * 		lastIndex += size
 * 		lastIndex, size = findImportOrRequire(file.Text(), lastIndex)
 * 	}
 * 	return false
 * }
 */
export function ForEachDynamicImportOrRequireCall(file: GoPtr<SourceFile>, includeTypeSpaceImports: bool, requireStringLiteralLikeArgument: bool, cb: (node: GoPtr<Node>, argument: GoPtr<Expression>) => bool): bool {
  const isJavaScriptFile: bool = IsInJSFile(NodeDefault_AsNode(file));
  const text: string = SourceFile_Text(file);
  const loop = (lastIndex: int, size: int): bool => {
    if (lastIndex < 0) return false as bool;
    const node: GoPtr<Node> = GetNodeAtPosition(file, lastIndex, (isJavaScriptFile && includeTypeSpaceImports) as bool);
    if (isJavaScriptFile && IsRequireCall(node, requireStringLiteralLikeArgument)) {
      if (cb(node, Node_Arguments(node)![0])) return true as bool;
    } else if (IsImportCall(node) && (Node_Arguments(node)?.length ?? 0) > 0 && (!requireStringLiteralLikeArgument || IsStringLiteralLike(Node_Arguments(node)![0]))) {
      if (cb(node, Node_Arguments(node)![0])) return true as bool;
    } else if (includeTypeSpaceImports && IsLiteralImportTypeNode(node)) {
      if (cb(node, AsLiteralTypeNode(AsImportTypeNode(node)!.Argument)!.Literal)) return true as bool;
    }
    // skip past import/require
    const [nextIndex, nextSize] = findImportOrRequire(text, (lastIndex + size) as int);
    return loop(nextIndex, nextSize);
  };
  const [initIndex, initSize] = findImportOrRequire(text, 0 as int);
  return loop(initIndex, initSize);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsRequireCall","kind":"func","status":"implemented","sigHash":"1ef07c58213033d789455f51fe438f46b3bf05546a2569c987f6177df7272870","bodyHash":"924db1409b46fdc9f11850684c62eb4876489cae12a409bd3d4c28049926c61d"}
 *
 * Go source:
 * func IsRequireCall(node *Node, requireStringLiteralLikeArgument bool) bool {
 * 	if !IsCallExpression(node) {
 * 		return false
 * 	}
 * 	call := node.AsCallExpression()
 * 	if !IsIdentifier(call.Expression) || call.Expression.Text() != "require" {
 * 		return false
 * 	}
 * 	if len(call.Arguments.Nodes) != 1 {
 * 		return false
 * 	}
 * 	return !requireStringLiteralLikeArgument || IsStringLiteralLike(call.Arguments.Nodes[0])
 * }
 */
export function IsRequireCall(node: GoPtr<Node>, requireStringLiteralLikeArgument: bool): bool {
  if (!IsCallExpression(node)) {
    return false as bool;
  }
  const call = AsCallExpression(node);
  if (!IsIdentifier(call!.Expression) || Node_Text(call!.Expression) !== "require") {
    return false as bool;
  }
  if (call!.Arguments!.Nodes.length !== 1) {
    return false as bool;
  }
  return (!requireStringLiteralLikeArgument || IsStringLiteralLike(call!.Arguments!.Nodes[0])) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsRequireVariableStatement","kind":"func","status":"implemented","sigHash":"62519e943a07cc12ffca10ea0e14a5bbf80e03de74320f35cc791522c3335d75","bodyHash":"82a7bbe8c2ac3d4ff462b00829a267f3201da2c5822e95a067d102c9fd80d1fd"}
 *
 * Go source:
 * func IsRequireVariableStatement(node *Node) bool {
 * 	if IsVariableStatement(node) {
 * 		if declarations := node.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations.Nodes; len(declarations) > 0 {
 * 			return core.Every(declarations, IsVariableDeclarationInitializedToRequire)
 * 		}
 * 	}
 * 	return false
 * }
 */
export function IsRequireVariableStatement(node: GoPtr<Node>): bool {
  if (IsVariableStatement(node)) {
    const declarations = AsVariableDeclarationList(AsVariableStatement(node)!.DeclarationList)!.Declarations!.Nodes;
    if (declarations.length > 0) {
      return Every(declarations, IsVariableDeclarationInitializedToRequire);
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetJSXImplicitImportBase","kind":"func","status":"implemented","sigHash":"5e13fc87143f29e818a2366041d79a2f66472aad4995647d54d82288b8ae5569","bodyHash":"90472b0b09745378501b53bf09a7b51798275d93551e45fb182bfece135a406b"}
 *
 * Go source:
 * func GetJSXImplicitImportBase(compilerOptions *core.CompilerOptions, file *SourceFile) string {
 * 	jsxImportSourcePragma := GetPragmaFromSourceFile(file, "jsximportsource")
 * 	jsxRuntimePragma := GetPragmaFromSourceFile(file, "jsxruntime")
 * 	if GetPragmaArgument(jsxRuntimePragma, "factory") == "classic" {
 * 		return ""
 * 	}
 * 	if compilerOptions.Jsx == core.JsxEmitReactJSX ||
 * 		compilerOptions.Jsx == core.JsxEmitReactJSXDev ||
 * 		compilerOptions.JsxImportSource != "" ||
 * 		jsxImportSourcePragma != nil ||
 * 		GetPragmaArgument(jsxRuntimePragma, "factory") == "automatic" {
 * 		result := GetPragmaArgument(jsxImportSourcePragma, "factory")
 * 		if result == "" {
 * 			result = compilerOptions.JsxImportSource
 * 		}
 * 		if result == "" {
 * 			result = "react"
 * 		}
 * 		return result
 * 	}
 * 	return ""
 * }
 */
export function GetJSXImplicitImportBase(compilerOptions: GoPtr<CompilerOptions>, file: GoPtr<SourceFile>): string {
  const jsxImportSourcePragma: GoPtr<Pragma> = GetPragmaFromSourceFile(file, "jsximportsource");
  const jsxRuntimePragma: GoPtr<Pragma> = GetPragmaFromSourceFile(file, "jsxruntime");
  if (GetPragmaArgument(jsxRuntimePragma, "factory") === "classic") {
    return "";
  }
  if (compilerOptions!.Jsx === JsxEmitReactJSX ||
    compilerOptions!.Jsx === JsxEmitReactJSXDev ||
    compilerOptions!.JsxImportSource !== "" ||
    jsxImportSourcePragma !== undefined ||
    GetPragmaArgument(jsxRuntimePragma, "factory") === "automatic") {
    const pragmaResult: string = GetPragmaArgument(jsxImportSourcePragma, "factory");
    const sourceResult: string = pragmaResult !== "" ? pragmaResult : compilerOptions!.JsxImportSource;
    return sourceResult !== "" ? sourceResult : "react";
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetJSXRuntimeImport","kind":"func","status":"implemented","sigHash":"fc1b3981bc9dd0db44f4dc894efc50b38e2c80317a169b3d35621405bacb7d8d","bodyHash":"3d203d169d02a2f9b02663b23bba59723891124724aa1ed8c484e7eb99c6d821"}
 *
 * Go source:
 * func GetJSXRuntimeImport(base string, options *core.CompilerOptions) string {
 * 	if base == "" {
 * 		return base
 * 	}
 * 	return base + "/" + core.IfElse(options.Jsx == core.JsxEmitReactJSXDev, "jsx-dev-runtime", "jsx-runtime")
 * }
 */
export function GetJSXRuntimeImport(base: string, options: GoPtr<CompilerOptions>): string {
  if (base === "") {
    return base;
  }
  return base + "/" + IfElse(options!.Jsx === JsxEmitReactJSXDev, "jsx-dev-runtime", "jsx-runtime");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetPragmaFromSourceFile","kind":"func","status":"implemented","sigHash":"ddaa267bcfa842b5a80dc8fbd99d920472ac16523c837d8b4cddd25a55b34f74","bodyHash":"c9a886ae64beb8b1f59cb6c6a16c0ff00acd1559b8f2ba46a3589a6ac61aa1f6"}
 *
 * Go source:
 * func GetPragmaFromSourceFile(file *SourceFile, name string) *Pragma {
 * 	var result *Pragma
 * 	if file != nil {
 * 		for i := range file.Pragmas {
 * 			if file.Pragmas[i].Name == name {
 * 				result = &file.Pragmas[i] // Last one wins
 * 			}
 * 		}
 * 	}
 * 	return result
 * }
 */
export function GetPragmaFromSourceFile(file: GoPtr<SourceFile>, name: string): GoPtr<Pragma> {
  if (file === undefined) return undefined;
  return file!.Pragmas.reduce<GoPtr<Pragma>>((acc, p) => p!.Name === name ? p : acc, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetPragmaArgument","kind":"func","status":"implemented","sigHash":"2f5aa668c3ea3b345be0d8f6e54de285d5776ae747dfe65ce8d2dd02505f1cec","bodyHash":"5e315b5ada2d659a8c497d37875b2d0269aa8da4dbe4a4c109baefac1d12ba01"}
 *
 * Go source:
 * func GetPragmaArgument(pragma *Pragma, name string) string {
 * 	if pragma != nil {
 * 		if arg, ok := pragma.Args[name]; ok {
 * 			return arg.Value
 * 		}
 * 	}
 * 	return ""
 * }
 */
export function GetPragmaArgument(pragma: GoPtr<Pragma>, name: string): string {
  if (pragma !== undefined) {
    if (pragma!.Args.has(name)) {
      const arg = pragma!.Args.get(name)!;
      return arg.Value;
    }
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsVariableDeclarationInitializedToRequire","kind":"func","status":"implemented","sigHash":"b3ace01b03b327b38aa9f45a8257efc3e830b70242866b7054e5547ba99c9e54","bodyHash":"ea1201f1802d6ae6da3fa8c3df9579dd9cdccb98fe24dd48da1f64fc6b429418"}
 *
 * Go source:
 * func IsVariableDeclarationInitializedToRequire(node *Node) bool {
 * 	if node.Kind == KindBindingElement {
 * 		node = node.Parent.Parent
 * 	}
 * 	return isVariableDeclarationInitializedWithRequireHelper(node, false /*allowAccessedRequire* /)
 * }
 */
export function IsVariableDeclarationInitializedToRequire(node: GoPtr<Node>): bool {
  const current: GoPtr<Node> = node!.Kind === KindBindingElement ? node!.Parent!.Parent : node;
  return isVariableDeclarationInitializedWithRequireHelper(current, false /*allowAccessedRequire*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsVariableDeclarationInitializedToBareOrAccessedRequire","kind":"func","status":"implemented","sigHash":"e717568022e3d697d0fb5753ddfcf6c6aeebf95873066acffb6797f65370be9d","bodyHash":"7258f711b439f492b90aa761a753f06f6fe76b041ceb396306ee0ce575ddb791"}
 *
 * Go source:
 * func IsVariableDeclarationInitializedToBareOrAccessedRequire(node *Node) bool {
 * 	return isVariableDeclarationInitializedWithRequireHelper(node, true /*allowAccessedRequire* /)
 * }
 */
export function IsVariableDeclarationInitializedToBareOrAccessedRequire(node: GoPtr<Node>): bool {
  return isVariableDeclarationInitializedWithRequireHelper(node, true /*allowAccessedRequire*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isVariableDeclarationInitializedWithRequireHelper","kind":"func","status":"implemented","sigHash":"4625f5c01e8d39e374c68d784ed9b8fdc497a991e531ac96f2ec96a61f00ba96","bodyHash":"6cd6d0de311c597547febd9a54973fdc1b27b872843afa26fd41c4e3864f4cca"}
 *
 * Go source:
 * func isVariableDeclarationInitializedWithRequireHelper(node *Node, allowAccessedRequire bool) bool {
 * 	if !IsInJSFile(node) {
 * 		return false
 * 	}
 * 	if node.Kind != KindVariableDeclaration {
 * 		return false
 * 	}
 * 	initializer := node.Initializer()
 * 	if initializer == nil {
 * 		return false
 * 	}
 * 	if allowAccessedRequire {
 * 		initializer = GetLeftmostAccessExpression(initializer)
 * 	}
 * 
 * 	return node.Parent.Parent.ModifierFlags()&ModifierFlagsExport == 0 &&
 * 		node.Type() == nil &&
 * 		IsRequireCall(initializer, true /*requireStringLiteralLikeArgument* /)
 * }
 */
export function isVariableDeclarationInitializedWithRequireHelper(node: GoPtr<Node>, allowAccessedRequire: bool): bool {
  if (!IsInJSFile(node)) {
    return false as bool;
  }
  if (node!.Kind !== KindVariableDeclaration) {
    return false as bool;
  }
  const initializer0: GoPtr<Node> = Node_Initializer(node);
  if (initializer0 === undefined) {
    return false as bool;
  }
  const initializer: GoPtr<Node> = allowAccessedRequire ? GetLeftmostAccessExpression(initializer0) : initializer0;

  return ((Node_ModifierFlags(node!.Parent!.Parent) & ModifierFlagsExport) === 0 &&
    Node_Type(node) === undefined &&
    IsRequireCall(initializer, true /*requireStringLiteralLikeArgument*/)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetModuleSpecifierOfBareOrAccessedRequire","kind":"func","status":"implemented","sigHash":"5f22daf75a69c582f91802c3b9e941c1d84a5815356563709086e54245382804","bodyHash":"3ca2322ca29ff6d6e759061c8ec23c661b62d7cc4f8e67e27a93387801ddd627"}
 *
 * Go source:
 * func GetModuleSpecifierOfBareOrAccessedRequire(node *Node) *Node {
 * 	if isVariableDeclarationInitializedWithRequireHelper(node, false /*allowAccessedRequire* /) {
 * 		return node.Initializer().Arguments()[0]
 * 	}
 * 	if isVariableDeclarationInitializedWithRequireHelper(node, true /*allowAccessedRequire* /) {
 * 		leftmost := GetLeftmostAccessExpression(node.Initializer())
 * 		if IsRequireCall(leftmost, true /*requireStringLiteralLikeArgument* /) {
 * 			return leftmost.Arguments()[0]
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function GetModuleSpecifierOfBareOrAccessedRequire(node: GoPtr<Node>): GoPtr<Node> {
  if (isVariableDeclarationInitializedWithRequireHelper(node, false /*allowAccessedRequire*/)) {
    return Node_Arguments(Node_Initializer(node))![0];
  }
  if (isVariableDeclarationInitializedWithRequireHelper(node, true /*allowAccessedRequire*/)) {
    const leftmost: GoPtr<Node> = GetLeftmostAccessExpression(Node_Initializer(node));
    if (IsRequireCall(leftmost, true /*requireStringLiteralLikeArgument*/)) {
      return Node_Arguments(leftmost)![0];
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsModuleExportsAccessExpression","kind":"func","status":"implemented","sigHash":"d37a44d9cff2c8a8b076785900bd5345023674f7201caa1f63a509523ad1168d","bodyHash":"b08eec72a10cb7897c711da5229f5cb6feec4fff137904afda2f296c092383d8"}
 *
 * Go source:
 * func IsModuleExportsAccessExpression(node *Node) bool {
 * 	if IsAccessExpression(node) && IsModuleIdentifier(node.Expression()) {
 * 		if name := GetElementOrPropertyAccessName(node); name != nil {
 * 			return name.Text() == "exports"
 * 		}
 * 	}
 * 	return false
 * }
 */
export function IsModuleExportsAccessExpression(node: GoPtr<Node>): bool {
  if (IsAccessExpression(node) && IsModuleIdentifier(Node_Expression(node))) {
    const name: GoPtr<Node> = GetElementOrPropertyAccessName(node);
    if (name !== undefined) {
      return (Node_Text(name) === "exports") as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsModuleExportsQualifiedName","kind":"func","status":"implemented","sigHash":"aa3d5dcc7a6c6ad1e8c83b82a24a38e6bdb13f061566950f1fb3513f8a9b0ae9","bodyHash":"f429ee9c32bac275769218b9c2f35eafb7da5409e726b578455c201db5b2016a"}
 *
 * Go source:
 * func IsModuleExportsQualifiedName(node *Node) bool {
 * 	return IsQualifiedName(node) && IsModuleIdentifier(node.AsQualifiedName().Left) && node.AsQualifiedName().Right.Text() == "exports"
 * }
 */
export function IsModuleExportsQualifiedName(node: GoPtr<Node>): bool {
  return (IsQualifiedName(node) && IsModuleIdentifier(AsQualifiedName(node)!.Left) && Node_Text(AsQualifiedName(node)!.Right) === "exports") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsCheckJSEnabledForFile","kind":"func","status":"implemented","sigHash":"cb4c38dd1d404797e7020507b6986e2284842c0d2a6423273270e40cb6cf22f7","bodyHash":"4f3fc2333d0b15f8967248ca6ff686e15f23ca82a3e05de77dfdd67afe5bee13"}
 *
 * Go source:
 * func IsCheckJSEnabledForFile(sourceFile *SourceFile, compilerOptions *core.CompilerOptions) bool {
 * 	if sourceFile.CheckJsDirective != nil {
 * 		return sourceFile.CheckJsDirective.Enabled
 * 	}
 * 	return compilerOptions.CheckJs == core.TSTrue
 * }
 */
export function IsCheckJSEnabledForFile(sourceFile: GoPtr<SourceFile>, compilerOptions: GoPtr<CompilerOptions>): bool {
  if (sourceFile!.CheckJsDirective !== undefined) {
    return sourceFile!.CheckJsDirective!.Enabled;
  }
  return (compilerOptions!.CheckJs === TSTrue) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPlainJSFile","kind":"func","status":"implemented","sigHash":"c646e7cbbd5d24cfecb32ebbe14b602bb750a9e6d618ebdf6fe2674e89fd8844","bodyHash":"d927b4e902aedf23f3b1bc1e941ac6cd736b7289f0b306edd4f79c9d55f6dbf1"}
 *
 * Go source:
 * func IsPlainJSFile(file *SourceFile, checkJs core.Tristate) bool {
 * 	return file != nil && (file.ScriptKind == core.ScriptKindJS || file.ScriptKind == core.ScriptKindJSX) && file.CheckJsDirective == nil && checkJs == core.TSUnknown
 * }
 */
export function IsPlainJSFile(file: GoPtr<SourceFile>, checkJs: Tristate): bool {
  return (file !== undefined && (file!.ScriptKind === ScriptKindJS || file!.ScriptKind === ScriptKindJSX) && file!.CheckJsDirective === undefined && checkJs === TSUnknown) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetLeftmostAccessExpression","kind":"func","status":"implemented","sigHash":"85486eaccb43c850637939106544668a8d17638f592c2d057dbd7bb473edb38c","bodyHash":"4412b016e3b1141d964dd63c05441309ec2163abfbcf7383c05684e0e7ccd2a9"}
 *
 * Go source:
 * func GetLeftmostAccessExpression(expr *Node) *Node {
 * 	for IsAccessExpression(expr) {
 * 		expr = expr.Expression()
 * 	}
 * 	return expr
 * }
 */
export function GetLeftmostAccessExpression(expr: GoPtr<Node>): GoPtr<Node> {
  const loop = (current: GoPtr<Node>): GoPtr<Node> => {
    if (!IsAccessExpression(current)) return current;
    return loop(Node_Expression(current));
  };
  return loop(expr);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsTypeOnlyImportDeclaration","kind":"func","status":"implemented","sigHash":"ac71bae689037eecf5ba6a6f483b43cb60c4ebc6243a89887d9b529a1b3a8cd1","bodyHash":"d0328ab14c41667d5ffc83c9c5f6a4f081a0ab67f7b78c7f741d95eb796174d7"}
 *
 * Go source:
 * func IsTypeOnlyImportDeclaration(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindImportSpecifier:
 * 		return node.IsTypeOnly() || node.Parent.Parent.IsTypeOnly()
 * 	case KindNamespaceImport:
 * 		return node.Parent.IsTypeOnly()
 * 	case KindImportClause, KindImportEqualsDeclaration:
 * 		return node.IsTypeOnly()
 * 	}
 * 	return false
 * }
 */
export function IsTypeOnlyImportDeclaration(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindImportSpecifier:
      return (Node_IsTypeOnly(node) || Node_IsTypeOnly(node!.Parent!.Parent)) as bool;
    case KindNamespaceImport:
      return Node_IsTypeOnly(node!.Parent);
    case KindImportClause:
    case KindImportEqualsDeclaration:
      return Node_IsTypeOnly(node);
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isTypeOnlyExportDeclaration","kind":"func","status":"implemented","sigHash":"d9e3e7a6f6359888d7474e35a884ca1041b0167965a8d09252255df3c85c91ba","bodyHash":"81f325837396906b5251c3f2e1219db4bc58a0b728e4d1d8f4f6fdc3191f8d3c"}
 *
 * Go source:
 * func isTypeOnlyExportDeclaration(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindExportSpecifier:
 * 		return node.IsTypeOnly() || node.Parent.Parent.IsTypeOnly()
 * 	case KindExportDeclaration:
 * 		d := node.AsExportDeclaration()
 * 		return d.IsTypeOnly && d.ModuleSpecifier != nil && d.ExportClause == nil
 * 	case KindNamespaceExport:
 * 		return node.Parent.IsTypeOnly()
 * 	}
 * 	return false
 * }
 */
export function isTypeOnlyExportDeclaration(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindExportSpecifier:
      return (Node_IsTypeOnly(node) || Node_IsTypeOnly(node!.Parent!.Parent)) as bool;
    case KindExportDeclaration: {
      const d = AsExportDeclaration(node);
      return (d!.IsTypeOnly && d!.ModuleSpecifier !== undefined && d!.ExportClause === undefined) as bool;
    }
    case KindNamespaceExport:
      return Node_IsTypeOnly(node!.Parent);
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsTypeOnlyImportOrExportDeclaration","kind":"func","status":"implemented","sigHash":"c97d1a35635c17f75d8d47ff31279e0070918a1409d7faeb19db64cddcba0b36","bodyHash":"2f9df04d8633a79e5cd57237823660d41853d3696d3680a3a81d551f052d08de"}
 *
 * Go source:
 * func IsTypeOnlyImportOrExportDeclaration(node *Node) bool {
 * 	return IsTypeOnlyImportDeclaration(node) || isTypeOnlyExportDeclaration(node)
 * }
 */
export function IsTypeOnlyImportOrExportDeclaration(node: GoPtr<Node>): bool {
  return (IsTypeOnlyImportDeclaration(node) || isTypeOnlyExportDeclaration(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsExclusivelyTypeOnlyImportOrExport","kind":"func","status":"implemented","sigHash":"3c67a4fd4759e5ff02dd55f6999b6a34498ba7f815ec8ae1d3ddc0b5e452415f","bodyHash":"aacb49d69ca6539ad546b18105207963845c871109f1b92a78e6847131f79415"}
 *
 * Go source:
 * func IsExclusivelyTypeOnlyImportOrExport(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindExportDeclaration:
 * 		return node.IsTypeOnly()
 * 	case KindImportDeclaration, KindJSImportDeclaration:
 * 		if importClause := node.ImportClause(); importClause != nil {
 * 			return importClause.AsImportClause().IsTypeOnly()
 * 		}
 * 	case KindJSDocImportTag:
 * 		if importClause := node.ImportClause(); importClause != nil {
 * 			return importClause.AsImportClause().IsTypeOnly()
 * 		}
 * 	}
 * 	return false
 * }
 */
export function IsExclusivelyTypeOnlyImportOrExport(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindExportDeclaration:
      return Node_IsTypeOnly(node);
    case KindImportDeclaration:
    case KindJSImportDeclaration: {
      const importClause: GoPtr<Node> = Node_ImportClause(node);
      if (importClause !== undefined) {
        return Node_IsTypeOnly(importClause);
      }
      break;
    }
    case KindJSDocImportTag: {
      const importClause: GoPtr<Node> = Node_ImportClause(node);
      if (importClause !== undefined) {
        return Node_IsTypeOnly(importClause);
      }
      break;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetClassLikeDeclarationOfSymbol","kind":"func","status":"implemented","sigHash":"f279c6da21df6b2b06788ba9b223d41c3e9ccb912656c797aed79233924a23c6","bodyHash":"95b3a6a7e288d4b5117d2dbac714bb15fa2f10a712747bc08fd84d47501a16f5"}
 *
 * Go source:
 * func GetClassLikeDeclarationOfSymbol(symbol *Symbol) *Node {
 * 	return core.Find(symbol.Declarations, IsClassLike)
 * }
 */
export function GetClassLikeDeclarationOfSymbol(symbol_: GoPtr<Symbol>): GoPtr<Node> {
  return Find(symbol_!.Declarations ?? [], IsClassLike);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsCallLikeExpression","kind":"func","status":"implemented","sigHash":"efa0451829beb633674d0de344cf9eb2104ed974db45dcb6ddb5e35b65737529","bodyHash":"e26027c2df1f947f10019b3a4124690d2aabdbd09e7d8a988d0977c5b8371f01"}
 *
 * Go source:
 * func IsCallLikeExpression(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindJsxOpeningElement, KindJsxSelfClosingElement, KindJsxOpeningFragment, KindCallExpression, KindNewExpression,
 * 		KindTaggedTemplateExpression, KindDecorator:
 * 		return true
 * 	case KindBinaryExpression:
 * 		return node.AsBinaryExpression().OperatorToken.Kind == KindInstanceOfKeyword
 * 	}
 * 	return false
 * }
 */
export function IsCallLikeExpression(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindJsxOpeningElement:
    case KindJsxSelfClosingElement:
    case KindJsxOpeningFragment:
    case KindCallExpression:
    case KindNewExpression:
    case KindTaggedTemplateExpression:
    case KindDecorator:
      return true as bool;
    case KindBinaryExpression:
      return (AsBinaryExpression(node)!.OperatorToken!.Kind === KindInstanceOfKeyword) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJsxCallLike","kind":"func","status":"implemented","sigHash":"0d1985eb96e192e59608e2e1cfff3a9b5d4a3a6b905cd6e7a6bd916a50ea1dcf","bodyHash":"0c5106694bfb55959c5bc5a88f77340d3ccc9d1a9cb8b6ecf3c8c5eca49cc26c"}
 *
 * Go source:
 * func IsJsxCallLike(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindJsxOpeningElement, KindJsxSelfClosingElement, KindJsxOpeningFragment:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsJsxCallLike(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindJsxOpeningElement:
    case KindJsxSelfClosingElement:
    case KindJsxOpeningFragment:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsCallLikeOrFunctionLikeExpression","kind":"func","status":"implemented","sigHash":"3ce353a8560e94cb48a7b8e9ffe20e6cc7e1ed98eeda11ddb2a39d4ac81c2f55","bodyHash":"c4946ff251009c3a598aff6f427a1a8b42f2845c88dd10850091dd703dfd85c1"}
 *
 * Go source:
 * func IsCallLikeOrFunctionLikeExpression(node *Node) bool {
 * 	return IsCallLikeExpression(node) || IsFunctionExpressionOrArrowFunction(node)
 * }
 */
export function IsCallLikeOrFunctionLikeExpression(node: GoPtr<Node>): bool {
  return (IsCallLikeExpression(node) || IsFunctionExpressionOrArrowFunction(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::NodeHasKind","kind":"func","status":"implemented","sigHash":"5b7bbd60d31a176c645a426696d021f589d0ca58fe487e7b17431254cb531c12","bodyHash":"c0489d5cb441370b423d8abcc068e92db7ea9599b33bec45805eef5e60e5df36"}
 *
 * Go source:
 * func NodeHasKind(node *Node, kind Kind) bool {
 * 	if node == nil {
 * 		return false
 * 	}
 * 	return node.Kind == kind
 * }
 */
export function NodeHasKind(node: GoPtr<Node>, kind: Kind): bool {
  if (node === undefined) {
    return false as bool;
  }
  return (node!.Kind === kind) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsContextualKeyword","kind":"func","status":"implemented","sigHash":"6048ea685b072573d8877d0181a51bf13fe61137e1af653137a9a248a77c05d9","bodyHash":"8fc6bb4042cee3698ec3ef696f59694f15b81fd166abbda257542a9b0120c1ed"}
 *
 * Go source:
 * func IsContextualKeyword(token Kind) bool {
 * 	return KindFirstContextualKeyword <= token && token <= KindLastContextualKeyword
 * }
 */
export function IsContextualKeyword(token: Kind): bool {
  return (KindFirstContextualKeyword <= token && token <= KindLastContextualKeyword) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsThisInTypeQuery","kind":"func","status":"implemented","sigHash":"146ad3749c12633bdb7f49f1300309c5f89dc106ed44a6bdddae2552854af20f","bodyHash":"5581721775b07a2b1925ab0b11b408d9c63b05b496d8f60453e3f683ff5c86bc"}
 *
 * Go source:
 * func IsThisInTypeQuery(node *Node) bool {
 * 	if !IsThisIdentifier(node) {
 * 		return false
 * 	}
 * 	for IsQualifiedName(node.Parent) && node.Parent.AsQualifiedName().Left == node {
 * 		node = node.Parent
 * 	}
 * 	return node.Parent.Kind == KindTypeQuery
 * }
 */
export function IsThisInTypeQuery(node: GoPtr<Node>): bool {
  if (!IsThisIdentifier(node)) {
    return false as bool;
  }
  const loop = (current: GoPtr<Node>): bool => {
    if (IsQualifiedName(current!.Parent) && AsQualifiedName(current!.Parent)!.Left === current) return loop(current!.Parent);
    return (current!.Parent!.Kind === KindTypeQuery) as bool;
  };
  return loop(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsLet","kind":"func","status":"implemented","sigHash":"474d48c7b2ebffa02b8c28c30da68d32b9f9b43eff4d5626f92ac31e463ab3fb","bodyHash":"ca684e34d57da2d3a0e2d6db38cc607ad205e82b07d5a3d488cc95e692dd0678"}
 *
 * Go source:
 * func IsLet(node *Node) bool {
 * 	return GetCombinedNodeFlags(node)&NodeFlagsBlockScoped == NodeFlagsLet
 * }
 */
export function IsLet(node: GoPtr<Node>): bool {
  return ((GetCombinedNodeFlags(node) & NodeFlagsBlockScoped) === NodeFlagsLet) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsClassMemberModifier","kind":"func","status":"implemented","sigHash":"11f04d211ea894169a85a75726dbfa292f58395a4d72b99b216cea025443fa4e","bodyHash":"6492c16620448ae24ff3a59d95442a3d6c91cdb90c1bf2051d97360f458c9d1b"}
 *
 * Go source:
 * func IsClassMemberModifier(token Kind) bool {
 * 	return IsParameterPropertyModifier(token) || token == KindStaticKeyword ||
 * 		token == KindOverrideKeyword || token == KindAccessorKeyword
 * }
 */
export function IsClassMemberModifier(token: Kind): bool {
  return (IsParameterPropertyModifier(token) || token === KindStaticKeyword ||
    token === KindOverrideKeyword || token === KindAccessorKeyword) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsParameterPropertyModifier","kind":"func","status":"implemented","sigHash":"2ce72eb9a32d371b6efa629fd00e34520af35200f3a46e6f2f49b4fd3ee1c50a","bodyHash":"d142449fabee82a9669ac247d4d62f95c357e4f715b2a995be1962967949a94c"}
 *
 * Go source:
 * func IsParameterPropertyModifier(kind Kind) bool {
 * 	return ModifierToFlag(kind)&ModifierFlagsParameterPropertyModifier != 0
 * }
 */
export function IsParameterPropertyModifier(kind: Kind): bool {
  return ((ModifierToFlag(kind) & ModifierFlagsParameterPropertyModifier) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::ForEachChildAndJSDoc","kind":"func","status":"implemented","sigHash":"8c999e3891930dbe944f30c92eab33026bb5286101099849ef1a8701ae4075ee","bodyHash":"c177ad03a1dd791c8be548f0bcf78aa514f714ef25830c02ea383a39f61f492c"}
 *
 * Go source:
 * func ForEachChildAndJSDoc(node *Node, sourceFile *SourceFile, v Visitor) bool {
 * 	if visitNodes(v, node.JSDoc(sourceFile)) {
 * 		return true
 * 	}
 * 	return node.ForEachChild(v)
 * }
 */
export function ForEachChildAndJSDoc(node: GoPtr<Node>, sourceFile: GoPtr<SourceFile>, v: Visitor): bool {
  if (visitNodes(v, Node_JSDoc(node, sourceFile))) {
    return true as bool;
  }
  return Node_ForEachChild(node, v);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasTypeArguments","kind":"func","status":"implemented","sigHash":"e8d6d40c6639b00d2f254fb02a8c53054076bdde51b102e519c801b41bc0d58c","bodyHash":"d237d3fc272b480682ca69d1847fa30d60d12075b914b900dc9c3498b0138f98"}
 *
 * Go source:
 * func HasTypeArguments(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindCallExpression, KindNewExpression, KindTaggedTemplateExpression,
 * 		KindTypeReference, KindExpressionWithTypeArguments, KindImportType,
 * 		KindTypeQuery, KindJsxOpeningElement, KindJsxSelfClosingElement:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function HasTypeArguments(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindCallExpression:
    case KindNewExpression:
    case KindTaggedTemplateExpression:
    case KindTypeReference:
    case KindExpressionWithTypeArguments:
    case KindImportType:
    case KindTypeQuery:
    case KindJsxOpeningElement:
    case KindJsxSelfClosingElement:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsTypeReferenceType","kind":"func","status":"implemented","sigHash":"7c629b7cd3270bc52078ad4f40cbc12f615d7ffdbbf3e3875730c68c1b68c1be","bodyHash":"79ab187b1b523f75460320cddd00d92d9e2ffc93ae393cc33084b95f1910f487"}
 *
 * Go source:
 * func IsTypeReferenceType(node *Node) bool {
 * 	return node.Kind == KindTypeReference || node.Kind == KindExpressionWithTypeArguments
 * }
 */
export function IsTypeReferenceType(node: GoPtr<Node>): bool {
  return (node!.Kind === KindTypeReference || node!.Kind === KindExpressionWithTypeArguments) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsVariableLike","kind":"func","status":"implemented","sigHash":"8000cbe715819920219ce7944dbf7c26eb9bb24dca4137ec0fca2b090d3ad7fb","bodyHash":"7e2e7c96fc588f9e9eb913bff5677af104fc8d4f46ad9f40d614ae1082934a16"}
 *
 * Go source:
 * func IsVariableLike(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindBindingElement, KindEnumMember, KindParameter, KindPropertyAssignment, KindPropertyDeclaration,
 * 		KindPropertySignature, KindShorthandPropertyAssignment, KindVariableDeclaration:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsVariableLike(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindBindingElement:
    case KindEnumMember:
    case KindParameter:
    case KindPropertyAssignment:
    case KindPropertyDeclaration:
    case KindPropertySignature:
    case KindShorthandPropertyAssignment:
    case KindVariableDeclaration:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasInitializer","kind":"func","status":"implemented","sigHash":"61f34d2f4386a06605c5dd36e1b2313dc353e726707bcbb16dc5ea9da84295ad","bodyHash":"0bddd9c918fcbf93fea9abe7d7b43df51eccdc39037680307b2cc825725c0bf3"}
 *
 * Go source:
 * func HasInitializer(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindVariableDeclaration, KindParameter, KindBindingElement, KindPropertyDeclaration,
 * 		KindPropertyAssignment, KindEnumMember, KindForStatement, KindForInStatement, KindForOfStatement,
 * 		KindJsxAttribute:
 * 		return node.Initializer() != nil
 * 	default:
 * 		return false
 * 	}
 * }
 */
export function HasInitializer(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindVariableDeclaration:
    case KindParameter:
    case KindBindingElement:
    case KindPropertyDeclaration:
    case KindPropertyAssignment:
    case KindEnumMember:
    case KindForStatement:
    case KindForInStatement:
    case KindForOfStatement:
    case KindJsxAttribute:
      return (Node_Initializer(node) !== undefined) as bool;
    default:
      return false as bool;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsVariableParameterOrProperty","kind":"func","status":"implemented","sigHash":"b9dc858b6fd9585577874b849d7ffbfd43589ec6c3b556999a3bdbd025a328f1","bodyHash":"8234855ab33c1717822c03dc4d92eb14af900557d7f5a74bf81b4f8163fb5326"}
 *
 * Go source:
 * func IsVariableParameterOrProperty(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindVariableDeclaration, KindParameter, KindPropertySignature, KindPropertyDeclaration:
 * 		return true
 * 	default:
 * 		return false
 * 	}
 * }
 */
export function IsVariableParameterOrProperty(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindVariableDeclaration:
    case KindParameter:
    case KindPropertySignature:
    case KindPropertyDeclaration:
      return true as bool;
    default:
      return false as bool;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetTypeAnnotationNode","kind":"func","status":"implemented","sigHash":"f1bb6b84bbb32582874e7c2c6f0da3292d6284a5c14d708d5e3ad12178497f59","bodyHash":"fe088e8a876b41fe64974fb83ebe84a297a0ca999e007d629971bdd5c427fdaa"}
 *
 * Go source:
 * func GetTypeAnnotationNode(node *Node) *TypeNode {
 * 	switch node.Kind {
 * 	case KindVariableDeclaration, KindParameter, KindPropertySignature, KindPropertyDeclaration,
 * 		KindTypePredicate, KindParenthesizedType, KindTypeOperator, KindMappedType, KindTypeAssertionExpression,
 * 		KindAsExpression, KindSatisfiesExpression, KindTypeAliasDeclaration, KindJSTypeAliasDeclaration,
 * 		KindNamedTupleMember, KindOptionalType, KindRestType, KindTemplateLiteralTypeSpan, KindJSDocTypeExpression,
 * 		KindJSDocPropertyTag, KindJSDocNullableType, KindJSDocNonNullableType, KindJSDocOptionalType:
 * 		return node.Type()
 * 	default:
 * 		funcLike := node.FunctionLikeData()
 * 		if funcLike != nil {
 * 			return funcLike.Type
 * 		}
 * 		return nil
 * 	}
 * }
 */
export function GetTypeAnnotationNode(node: GoPtr<Node>): GoPtr<TypeNode> {
  switch (node!.Kind) {
    case KindVariableDeclaration:
    case KindParameter:
    case KindPropertySignature:
    case KindPropertyDeclaration:
    case KindTypePredicate:
    case KindParenthesizedType:
    case KindTypeOperator:
    case KindMappedType:
    case KindTypeAssertionExpression:
    case KindAsExpression:
    case KindSatisfiesExpression:
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
    case KindNamedTupleMember:
    case KindOptionalType:
    case KindRestType:
    case KindTemplateLiteralTypeSpan:
    case KindJSDocTypeExpression:
    case KindJSDocPropertyTag:
    case KindJSDocNullableType:
    case KindJSDocNonNullableType:
    case KindJSDocOptionalType:
      return Node_Type(node);
    default: {
      const funcLike: GoPtr<FunctionLikeBaseType> = Node_FunctionLikeData(node);
      if (funcLike !== undefined) {
        return funcLike!.Type;
      }
      return undefined;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsObjectTypeDeclaration","kind":"func","status":"implemented","sigHash":"b384d5d878807b1d63cfd568f9fce6495ce9f2dc385cff81b7ed30a2be5ca2d3","bodyHash":"f292752ee5918c5a48644877f0d0a29dc98efa7db11b08e8b26f23abbb2929f7"}
 *
 * Go source:
 * func IsObjectTypeDeclaration(node *Node) bool {
 * 	return IsClassLike(node) || IsInterfaceDeclaration(node) || IsTypeLiteralNode(node)
 * }
 */
export function IsObjectTypeDeclaration(node: GoPtr<Node>): bool {
  return (IsClassLike(node) || IsInterfaceDeclaration(node) || IsTypeLiteralNode(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsClassOrTypeElement","kind":"func","status":"implemented","sigHash":"d30dd9c4e7dc4134beb465c1b5f45e1db045812ea941abd96938a19dd831ad0d","bodyHash":"9ec2f94b2a4afc931a7ae18f9dabf73bff49084079fbf3b5d25e5372213edec3"}
 *
 * Go source:
 * func IsClassOrTypeElement(node *Node) bool {
 * 	return IsClassElement(node) || IsTypeElement(node)
 * }
 */
export function IsClassOrTypeElement(node: GoPtr<Node>): bool {
  return (IsClassElement(node) || IsTypeElement(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetClassExtendsHeritageElement","kind":"func","status":"implemented","sigHash":"b7166de8736e5c4c87583f7d71ee8501981f3311c1293137e0e86418bd4df8bb","bodyHash":"942743e99195b2876fbd20debde2226b0224e3f72bfc1a410c79300a9c1d28b8"}
 *
 * Go source:
 * func GetClassExtendsHeritageElement(node *Node) *ExpressionWithTypeArgumentsNode {
 * 	heritageElements := GetHeritageElements(node, KindExtendsKeyword)
 * 	if len(heritageElements) > 0 {
 * 		return heritageElements[0]
 * 	}
 * 	return nil
 * }
 */
export function GetClassExtendsHeritageElement(node: GoPtr<Node>): GoPtr<ExpressionWithTypeArgumentsNode> {
  const heritageElements: GoSlice<GoPtr<ExpressionWithTypeArgumentsNode>> = GetHeritageElements(node, KindExtendsKeyword);
  if ((heritageElements?.length ?? 0) > 0) {
    return heritageElements[0];
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetImplementsTypeNodes","kind":"func","status":"implemented","sigHash":"c8e66b4dee8a528a0d3713be6c90841771a7109ef4eea5f7640fe42b6823bd06","bodyHash":"d66ec16ac39a59c3c49fd0d5652b3b9a33322de2fbfb07fe325d36bff72cf204"}
 *
 * Go source:
 * func GetImplementsTypeNodes(node *Node) []*ExpressionWithTypeArgumentsNode {
 * 	return GetHeritageElements(node, KindImplementsKeyword)
 * }
 */
export function GetImplementsTypeNodes(node: GoPtr<Node>): GoSlice<GoPtr<ExpressionWithTypeArgumentsNode>> {
  return GetHeritageElements(node, KindImplementsKeyword);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsTypeKeywordToken","kind":"func","status":"implemented","sigHash":"4e62b0313c3ace94272baa79ec02088d59ed44e479a486020ca2ed0f545ccc70","bodyHash":"8eac04bb71351f689b6e13868976f7ecf317281bc3ca1c67630ba6192cd4c7e2"}
 *
 * Go source:
 * func IsTypeKeywordToken(node *Node) bool {
 * 	return node.Kind == KindTypeKeyword
 * }
 */
export function IsTypeKeywordToken(node: GoPtr<Node>): bool {
  return (node!.Kind === KindTypeKeyword) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJSDocSingleCommentNodeList","kind":"func","status":"implemented","sigHash":"dded63e90dadac782ff70325b9453707e9f8d736a816b37f448eb38c370dfd2f","bodyHash":"50bc787689510d5657931010b00a15bf843a2cf5d4445a4059a43bcfdfd78366"}
 *
 * Go source:
 * func IsJSDocSingleCommentNodeList(nodeList *NodeList) bool {
 * 	if nodeList == nil || len(nodeList.Nodes) == 0 {
 * 		return false
 * 	}
 * 	parent := nodeList.Nodes[0].Parent
 * 	if parent == nil {
 * 		return false
 * 	}
 * 	return IsJSDocSingleCommentNode(parent) && nodeList == parent.CommentList()
 * }
 */
export function IsJSDocSingleCommentNodeList(nodeList: GoPtr<NodeList>): bool {
  if (nodeList === undefined || nodeList!.Nodes.length === 0) {
    return false as bool;
  }
  const parent: GoPtr<Node> = nodeList!.Nodes[0]!.Parent;
  if (parent === undefined) {
    return false as bool;
  }
  return (IsJSDocSingleCommentNode(parent) && nodeList === Node_CommentList(parent)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJSDocSingleCommentNodeComment","kind":"func","status":"implemented","sigHash":"98a2d8fd62fba5154596d3b4c20a5261c7cd5ef3f74933c74304626e2c777ff7","bodyHash":"5ebb30edc1eda8f489c7ef89e7c96d499f4ddad99e324e0d2d8ae9295889ba01"}
 *
 * Go source:
 * func IsJSDocSingleCommentNodeComment(node *Node) bool {
 * 	if node == nil || node.Parent == nil {
 * 		return false
 * 	}
 * 	return IsJSDocSingleCommentNode(node.Parent) && node == node.Parent.CommentList().Nodes[0]
 * }
 */
export function IsJSDocSingleCommentNodeComment(node: GoPtr<Node>): bool {
  if (node === undefined || node!.Parent === undefined) {
    return false as bool;
  }
  return (IsJSDocSingleCommentNode(node!.Parent) && node === Node_CommentList(node!.Parent)!.Nodes[0]) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJSDocSingleCommentNode","kind":"func","status":"implemented","sigHash":"dd12ed5a931c532ea8026bcd52ddbf9dccf1490aa4ee3f8284b5cc14f920f66f","bodyHash":"1c24539ca2b39db5158174c8a9e6c1528e5a3d69bb5b87e753c045633175ce49"}
 *
 * Go source:
 * func IsJSDocSingleCommentNode(node *Node) bool {
 * 	return hasComment(node.Kind) && node.CommentList() != nil && len(node.CommentList().Nodes) == 1
 * }
 */
export function IsJSDocSingleCommentNode(node: GoPtr<Node>): bool {
  return (hasComment(node!.Kind) && Node_CommentList(node) !== undefined && Node_CommentList(node)!.Nodes.length === 1) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsValidTypeOnlyAliasUseSite","kind":"func","status":"implemented","sigHash":"ddb26ee94227efcc223eb39aec6bb3ca1c46840adf7155125ae17b728b3178a2","bodyHash":"cbaa472b34923ad55fd4fa2d4df1f01f850cb7b7a0b176aaae2ace7f897fc26d"}
 *
 * Go source:
 * func IsValidTypeOnlyAliasUseSite(useSite *Node) bool {
 * 	return useSite.Flags&(NodeFlagsAmbient|NodeFlagsJSDoc) != 0 ||
 * 		IsPartOfTypeQuery(useSite) ||
 * 		isIdentifierInNonEmittingHeritageClause(useSite) ||
 * 		isPartOfPossiblyValidTypeOrAbstractComputedPropertyName(useSite) ||
 * 		!(IsExpressionNode(useSite) || isShorthandPropertyNameUseSite(useSite))
 * }
 */
export function IsValidTypeOnlyAliasUseSite(useSite: GoPtr<Node>): bool {
  return ((useSite!.Flags & (NodeFlagsAmbient | NodeFlagsJSDoc)) !== 0 ||
    IsPartOfTypeQuery(useSite) ||
    isIdentifierInNonEmittingHeritageClause(useSite) ||
    isPartOfPossiblyValidTypeOrAbstractComputedPropertyName(useSite) ||
    !(IsExpressionNode(useSite) || isShorthandPropertyNameUseSite(useSite))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isIdentifierInNonEmittingHeritageClause","kind":"func","status":"implemented","sigHash":"96895db7cdcaa7617a57282585426cd6b009b2c5697b39f6162b2f755e1002ad","bodyHash":"ece101dde46c44d53c7e6c4edcff481d5ba9f303f818436afd45a9e9934d6bcf"}
 *
 * Go source:
 * func isIdentifierInNonEmittingHeritageClause(node *Node) bool {
 * 	if !IsIdentifier(node) {
 * 		return false
 * 	}
 * 	parent := node.Parent
 * 	for IsPropertyAccessExpression(parent) || IsExpressionWithTypeArguments(parent) {
 * 		parent = parent.Parent
 * 	}
 * 	return IsHeritageClause(parent) && (parent.AsHeritageClause().Token == KindImplementsKeyword || IsInterfaceDeclaration(parent.Parent))
 * }
 */
export function isIdentifierInNonEmittingHeritageClause(node: GoPtr<Node>): bool {
  if (!IsIdentifier(node)) {
    return false as bool;
  }
  const loop = (parent: GoPtr<Node>): bool => {
    if (IsPropertyAccessExpression(parent) || IsExpressionWithTypeArguments(parent)) return loop(parent!.Parent);
    return (IsHeritageClause(parent) && (AsHeritageClause(parent)!.Token === KindImplementsKeyword || IsInterfaceDeclaration(parent!.Parent))) as bool;
  };
  return loop(node!.Parent);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isPartOfPossiblyValidTypeOrAbstractComputedPropertyName","kind":"func","status":"implemented","sigHash":"9014c9c96a80ff1ab81578192a510045abbc13cce60bcd92c5bf9a8a694a2320","bodyHash":"19d0d9300fa6f276149351f25cb88ee07298276582c9d09299204ef285c34b99"}
 *
 * Go source:
 * func isPartOfPossiblyValidTypeOrAbstractComputedPropertyName(node *Node) bool {
 * 	for NodeKindIs(node, KindIdentifier, KindPropertyAccessExpression) {
 * 		node = node.Parent
 * 	}
 * 	if node.Kind != KindComputedPropertyName {
 * 		return false
 * 	}
 * 	if HasSyntacticModifier(node.Parent, ModifierFlagsAbstract) {
 * 		return true
 * 	}
 * 	return NodeKindIs(node.Parent.Parent, KindInterfaceDeclaration, KindTypeLiteral)
 * }
 */
export function isPartOfPossiblyValidTypeOrAbstractComputedPropertyName(node: GoPtr<Node>): bool {
  const findCurrent = (current: GoPtr<Node>): GoPtr<Node> => {
    if (!NodeKindIs(current, KindIdentifier, KindPropertyAccessExpression)) return current;
    return findCurrent(current!.Parent);
  };
  const current = findCurrent(node);
  if (current!.Kind !== KindComputedPropertyName) {
    return false as bool;
  }
  if (HasSyntacticModifier(current!.Parent, ModifierFlagsAbstract)) {
    return true as bool;
  }
  return NodeKindIs(current!.Parent!.Parent, KindInterfaceDeclaration, KindTypeLiteral);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isShorthandPropertyNameUseSite","kind":"func","status":"implemented","sigHash":"2e570217a7b30c7d8cf2114bde9f89b40659971c2067047738a390e7d4969e34","bodyHash":"b13bacbba2e9820c1af09cf9b96ae35696e7afed5109b1d78c5cc7e14aa40a5d"}
 *
 * Go source:
 * func isShorthandPropertyNameUseSite(useSite *Node) bool {
 * 	return IsIdentifier(useSite) && IsShorthandPropertyAssignment(useSite.Parent) && useSite.Parent.AsShorthandPropertyAssignment().Name() == useSite
 * }
 */
export function isShorthandPropertyNameUseSite(useSite: GoPtr<Node>): bool {
  return (IsIdentifier(useSite) && IsShorthandPropertyAssignment(useSite!.Parent) && Node_Name(useSite!.Parent) === useSite) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetPropertyNameForPropertyNameNode","kind":"func","status":"implemented","sigHash":"12d750b3b5d5735648db1f8db96b9ff22371cfc08c2e326bb1779b49e1340046","bodyHash":"5941ff5929cac2dd0e97f340919eccfd6380a5e5e9e724f99a50a6a874457363"}
 *
 * Go source:
 * func GetPropertyNameForPropertyNameNode(name *Node) string {
 * 	switch name.Kind {
 * 	case KindIdentifier, KindPrivateIdentifier, KindStringLiteral, KindNoSubstitutionTemplateLiteral,
 * 		KindNumericLiteral, KindBigIntLiteral, KindJsxNamespacedName:
 * 		return name.Text()
 * 	case KindComputedPropertyName:
 * 		nameExpression := name.Expression()
 * 		if IsStringOrNumericLiteralLike(nameExpression) {
 * 			return nameExpression.Text()
 * 		}
 * 		if IsSignedNumericLiteral(nameExpression) {
 * 			text := nameExpression.AsPrefixUnaryExpression().Operand.Text()
 * 			if nameExpression.AsPrefixUnaryExpression().Operator == KindMinusToken {
 * 				text = "-" + text
 * 			}
 * 			return text
 * 		}
 * 		return InternalSymbolNameMissing
 * 	}
 * 	panic("Unhandled case in getPropertyNameForPropertyNameNode")
 * }
 */
export function GetPropertyNameForPropertyNameNode(name: GoPtr<Node>): string {
  switch (name!.Kind) {
    case KindIdentifier:
    case KindPrivateIdentifier:
    case KindStringLiteral:
    case KindNoSubstitutionTemplateLiteral:
    case KindNumericLiteral:
    case KindBigIntLiteral:
    case KindJsxNamespacedName:
      return Node_Text(name);
    case KindComputedPropertyName: {
      const nameExpression: GoPtr<Node> = Node_Expression(name);
      if (IsStringOrNumericLiteralLike(nameExpression)) {
        return Node_Text(nameExpression);
      }
      if (IsSignedNumericLiteral(nameExpression)) {
        const baseText: string = Node_Text(AsPrefixUnaryExpression(nameExpression)!.Operand);
        return AsPrefixUnaryExpression(nameExpression)!.Operator === KindMinusToken ? "-" + baseText : baseText;
      }
      return InternalSymbolNameMissing;
    }
  }
  throw new globalThis.Error("Unhandled case in getPropertyNameForPropertyNameNode");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPartOfTypeOnlyImportOrExportDeclaration","kind":"func","status":"implemented","sigHash":"c648f8db416ec24becd65cb8163d079bb195ec19b61bc7c30f8f476ff4bc56f3","bodyHash":"cafc23597f91063eafe97c4f2ab51e7d00879380d2e57efc09bc833a15dbfde9"}
 *
 * Go source:
 * func IsPartOfTypeOnlyImportOrExportDeclaration(node *Node) bool {
 * 	return FindAncestor(node, IsTypeOnlyImportOrExportDeclaration) != nil
 * }
 */
export function IsPartOfTypeOnlyImportOrExportDeclaration(node: GoPtr<Node>): bool {
  return (FindAncestor(node, IsTypeOnlyImportOrExportDeclaration) !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPartOfExclusivelyTypeOnlyImportOrExportDeclaration","kind":"func","status":"implemented","sigHash":"1989ae662a03255e01c0b44a761abd334d620e9479b1f2f1fccab065688d5d9a","bodyHash":"b9c818b650d72117df9e315616ccb1550f1471253559c1acb554adb955fa7d08"}
 *
 * Go source:
 * func IsPartOfExclusivelyTypeOnlyImportOrExportDeclaration(node *Node) bool {
 * 	return FindAncestor(node, IsExclusivelyTypeOnlyImportOrExport) != nil
 * }
 */
export function IsPartOfExclusivelyTypeOnlyImportOrExportDeclaration(node: GoPtr<Node>): bool {
  return (FindAncestor(node, IsExclusivelyTypeOnlyImportOrExport) !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsEmittableImport","kind":"func","status":"implemented","sigHash":"182c7a4cf962ef39ad7e4c15c0a867ad75c6459adcf6fd8d7ffc53abe454828b","bodyHash":"c5c19e9e27998ce622f12a9ae1ae223385bdf1f2869087daeb07059e84cf2498"}
 *
 * Go source:
 * func IsEmittableImport(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindImportDeclaration:
 * 		return node.ImportClause() != nil && !node.ImportClause().IsTypeOnly()
 * 	case KindExportDeclaration, KindImportEqualsDeclaration:
 * 		return !node.IsTypeOnly()
 * 	case KindCallExpression:
 * 		return IsImportCall(node)
 * 	}
 * 	return false
 * }
 */
export function IsEmittableImport(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindImportDeclaration:
      return (Node_ImportClause(node) !== undefined && !Node_IsTypeOnly(Node_ImportClause(node))) as bool;
    case KindExportDeclaration:
    case KindImportEqualsDeclaration:
      return !Node_IsTypeOnly(node) as bool;
    case KindCallExpression:
      return IsImportCall(node);
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsResolutionModeOverrideHost","kind":"func","status":"implemented","sigHash":"8ed651ffda2861beb01f8e5bf2e8cc689b435d3260dacc3cb01da7bbf16de0e9","bodyHash":"02e4e6b7427f0cac52f6ec1d0c4c836343bfd1e34d8855a2a354d51355a37e83"}
 *
 * Go source:
 * func IsResolutionModeOverrideHost(node *Node) bool {
 * 	if node == nil {
 * 		return false
 * 	}
 * 	switch node.Kind {
 * 	case KindImportType, KindExportDeclaration, KindImportDeclaration, KindJSImportDeclaration:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function IsResolutionModeOverrideHost(node: GoPtr<Node>): bool {
  if (node === undefined) {
    return false as bool;
  }
  switch (node!.Kind) {
    case KindImportType:
    case KindExportDeclaration:
    case KindImportDeclaration:
    case KindJSImportDeclaration:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasResolutionModeOverride","kind":"func","status":"implemented","sigHash":"34536ec01419fa6dec8e293c19b7dddeebaacbac68477e3ef1646712407274ad","bodyHash":"33a026a0d2cb17b783a929a073ccbafe26ecf1245a19f7cb96c1509d0181520b"}
 *
 * Go source:
 * func HasResolutionModeOverride(node *Node) bool {
 * 	if node == nil {
 * 		return false
 * 	}
 * 	var attributes *ImportAttributesNode
 * 	switch node.Kind {
 * 	case KindImportType:
 * 		attributes = node.AsImportTypeNode().Attributes
 * 	case KindImportDeclaration, KindJSImportDeclaration:
 * 		attributes = node.AsImportDeclaration().Attributes
 * 	case KindExportDeclaration:
 * 		attributes = node.AsExportDeclaration().Attributes
 * 	}
 * 	if attributes != nil {
 * 		_, ok := attributes.GetResolutionModeOverride()
 * 		return ok
 * 	}
 * 	return false
 * }
 */
export function HasResolutionModeOverride(node: GoPtr<Node>): bool {
  if (node === undefined) {
    return false as bool;
  }
  const attributes: GoPtr<ImportAttributesNode> =
    node!.Kind === KindImportType ? AsImportTypeNode(node)!.Attributes :
    (node!.Kind === KindImportDeclaration || node!.Kind === KindJSImportDeclaration) ? AsImportDeclaration(node)!.Attributes :
    node!.Kind === KindExportDeclaration ? AsExportDeclaration(node)!.Attributes :
    undefined;
  if (attributes !== undefined) {
    const [, ok] = ImportAttributesNode_GetResolutionModeOverride(attributes);
    return ok;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsStringTextContainingNode","kind":"func","status":"implemented","sigHash":"c7b5b2168e6595e1a22a6b5602f352dd02663579c5fad2b432a8e9c1a090c523","bodyHash":"db0d78e4b9f6d32d4b00e21d28c92f02a1dad08f4bb65f4e0e9f3f4e2092bfcd"}
 *
 * Go source:
 * func IsStringTextContainingNode(node *Node) bool {
 * 	return node.Kind == KindStringLiteral || IsTemplateLiteralKind(node.Kind)
 * }
 */
export function IsStringTextContainingNode(node: GoPtr<Node>): bool {
  return (node!.Kind === KindStringLiteral || IsTemplateLiteralKind(node!.Kind)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsTemplateLiteralKind","kind":"func","status":"implemented","sigHash":"1845fc37d34989e4998d2eb0973bf44bab2a2bb749ad0989103229875c40a64a","bodyHash":"6796c74707840d1a7564ea8c6bfa371a588be60ec3d552d4d914aae0003c1aba"}
 *
 * Go source:
 * func IsTemplateLiteralKind(kind Kind) bool {
 * 	return KindFirstTemplateToken <= kind && kind <= KindLastTemplateToken
 * }
 */
export function IsTemplateLiteralKind(kind: Kind): bool {
  return (KindFirstTemplateToken <= kind && kind <= KindLastTemplateToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsTemplateLiteralToken","kind":"func","status":"implemented","sigHash":"4984a00375fa18f76fec60343cd0a0d3a9ab1bfd815e564bfe5901fd5b2b25d1","bodyHash":"183a3376b8c30631ee9904881260be48843f3c0b827ab76d550c6e9e2a0cb412"}
 *
 * Go source:
 * func IsTemplateLiteralToken(node *Node) bool {
 * 	return IsTemplateLiteralKind(node.Kind)
 * }
 */
export function IsTemplateLiteralToken(node: GoPtr<Node>): bool {
  return IsTemplateLiteralKind(node!.Kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetExternalModuleImportEqualsDeclarationExpression","kind":"func","status":"implemented","sigHash":"bf263dda9df9f8af210d2dbde0dc9123b95062e269d2432815df72b3f21e5594","bodyHash":"f13639b9efa2b77f5335885b517252eafb36577b5a05c724449c366917a1c8de"}
 *
 * Go source:
 * func GetExternalModuleImportEqualsDeclarationExpression(node *Node) *Node {
 * 	debug.Assert(IsExternalModuleImportEqualsDeclaration(node))
 * 	return node.AsImportEqualsDeclaration().ModuleReference.Expression()
 * }
 */
export function GetExternalModuleImportEqualsDeclarationExpression(node: GoPtr<Node>): GoPtr<Node> {
  Assert(IsExternalModuleImportEqualsDeclaration(node));
  return Node_Expression(AsImportEqualsDeclaration(node)!.ModuleReference);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::CreateModifiersFromModifierFlags","kind":"func","status":"implemented","sigHash":"3709d6957779875ac4b2a31b315f7e6fdf2316864f83b76ecacec10a91bf2693","bodyHash":"73a95b995b5159e159f75b703ec3eaa7f11a87ed4cb9177983f54652a98d4f68"}
 *
 * Go source:
 * func CreateModifiersFromModifierFlags(flags ModifierFlags, createModifier func(kind Kind) *Node) []*Node {
 * 	var result []*Node
 * 	if flags&ModifierFlagsExport != 0 {
 * 		result = append(result, createModifier(KindExportKeyword))
 * 	}
 * 	if flags&ModifierFlagsAmbient != 0 {
 * 		result = append(result, createModifier(KindDeclareKeyword))
 * 	}
 * 	if flags&ModifierFlagsDefault != 0 {
 * 		result = append(result, createModifier(KindDefaultKeyword))
 * 	}
 * 	if flags&ModifierFlagsConst != 0 {
 * 		result = append(result, createModifier(KindConstKeyword))
 * 	}
 * 	if flags&ModifierFlagsPublic != 0 {
 * 		result = append(result, createModifier(KindPublicKeyword))
 * 	}
 * 	if flags&ModifierFlagsPrivate != 0 {
 * 		result = append(result, createModifier(KindPrivateKeyword))
 * 	}
 * 	if flags&ModifierFlagsProtected != 0 {
 * 		result = append(result, createModifier(KindProtectedKeyword))
 * 	}
 * 	if flags&ModifierFlagsAbstract != 0 {
 * 		result = append(result, createModifier(KindAbstractKeyword))
 * 	}
 * 	if flags&ModifierFlagsStatic != 0 {
 * 		result = append(result, createModifier(KindStaticKeyword))
 * 	}
 * 	if flags&ModifierFlagsOverride != 0 {
 * 		result = append(result, createModifier(KindOverrideKeyword))
 * 	}
 * 	if flags&ModifierFlagsReadonly != 0 {
 * 		result = append(result, createModifier(KindReadonlyKeyword))
 * 	}
 * 	if flags&ModifierFlagsAccessor != 0 {
 * 		result = append(result, createModifier(KindAccessorKeyword))
 * 	}
 * 	if flags&ModifierFlagsAsync != 0 {
 * 		result = append(result, createModifier(KindAsyncKeyword))
 * 	}
 * 	if flags&ModifierFlagsIn != 0 {
 * 		result = append(result, createModifier(KindInKeyword))
 * 	}
 * 	if flags&ModifierFlagsOut != 0 {
 * 		result = append(result, createModifier(KindOutKeyword))
 * 	}
 * 	return result
 * }
 */
export function CreateModifiersFromModifierFlags(flags: ModifierFlags, createModifier: (kind: Kind) => GoPtr<Node>): GoSlice<GoPtr<Node>> {
  let result: GoSlice<GoPtr<Node>> = [];
  if ((flags & ModifierFlagsExport) !== 0) {
    result = [...(result ?? []), createModifier(KindExportKeyword)];
  }
  if ((flags & ModifierFlagsAmbient) !== 0) {
    result = [...(result ?? []), createModifier(KindDeclareKeyword)];
  }
  if ((flags & ModifierFlagsDefault) !== 0) {
    result = [...(result ?? []), createModifier(KindDefaultKeyword)];
  }
  if ((flags & ModifierFlagsConst) !== 0) {
    result = [...(result ?? []), createModifier(KindConstKeyword)];
  }
  if ((flags & ModifierFlagsPublic) !== 0) {
    result = [...(result ?? []), createModifier(KindPublicKeyword)];
  }
  if ((flags & ModifierFlagsPrivate) !== 0) {
    result = [...(result ?? []), createModifier(KindPrivateKeyword)];
  }
  if ((flags & ModifierFlagsProtected) !== 0) {
    result = [...(result ?? []), createModifier(KindProtectedKeyword)];
  }
  if ((flags & ModifierFlagsAbstract) !== 0) {
    result = [...(result ?? []), createModifier(KindAbstractKeyword)];
  }
  if ((flags & ModifierFlagsStatic) !== 0) {
    result = [...(result ?? []), createModifier(KindStaticKeyword)];
  }
  if ((flags & ModifierFlagsOverride) !== 0) {
    result = [...(result ?? []), createModifier(KindOverrideKeyword)];
  }
  if ((flags & ModifierFlagsReadonly) !== 0) {
    result = [...(result ?? []), createModifier(KindReadonlyKeyword)];
  }
  if ((flags & ModifierFlagsAccessor) !== 0) {
    result = [...(result ?? []), createModifier(KindAccessorKeyword)];
  }
  if ((flags & ModifierFlagsAsync) !== 0) {
    result = [...(result ?? []), createModifier(KindAsyncKeyword)];
  }
  if ((flags & ModifierFlagsIn) !== 0) {
    result = [...(result ?? []), createModifier(KindInKeyword)];
  }
  if ((flags & ModifierFlagsOut) !== 0) {
    result = [...(result ?? []), createModifier(KindOutKeyword)];
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetThisParameter","kind":"func","status":"implemented","sigHash":"dd96660ba0d3f19c8016d357e552d83488e8cb40621b4fe0b3c4a420463b7784","bodyHash":"9b6fa1dcd4b4f1e1fee7e3392e7cd88267a54c23fd46e648abd4119edf3fe2d6"}
 *
 * Go source:
 * func GetThisParameter(signature *Node) *Node {
 * 	// callback tags do not currently support this parameters
 * 	if len(signature.Parameters()) != 0 {
 * 		thisParameter := signature.Parameters()[0]
 * 		if IsThisParameter(thisParameter) {
 * 			return thisParameter
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function GetThisParameter(signature: GoPtr<Node>): GoPtr<Node> {
  // callback tags do not currently support this parameters
  if (Node_Parameters(signature).length !== 0) {
    const thisParameter: GoPtr<Node> = Node_Parameters(signature)[0];
    if (IsThisParameter(thisParameter)) {
      return thisParameter;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::ReplaceModifiers","kind":"func","status":"implemented","sigHash":"0a2128ab8f88a474c56f348c1edc82e5de62aecde7b89c48023c73f93758d4c0","bodyHash":"0b5c0160d0f4a3624ceb09c4d7c1bf60ab881e982614a401a1b63efff48cad64"}
 *
 * Go source:
 * func ReplaceModifiers(factory *NodeFactory, node *Node, modifierArray *ModifierList) *Node {
 * 	switch node.Kind {
 * 	case KindTypeParameter:
 * 		return factory.UpdateTypeParameterDeclaration(
 * 			node.AsTypeParameterDeclaration(),
 * 			modifierArray,
 * 			node.Name(),
 * 			node.AsTypeParameterDeclaration().Constraint,
 * 			node.AsTypeParameterDeclaration().Expression,
 * 			node.AsTypeParameterDeclaration().DefaultType,
 * 		)
 * 	case KindParameter:
 * 		return factory.UpdateParameterDeclaration(
 * 			node.AsParameterDeclaration(),
 * 			modifierArray,
 * 			node.AsParameterDeclaration().DotDotDotToken,
 * 			node.Name(),
 * 			node.QuestionToken(),
 * 			node.Type(),
 * 			node.Initializer(),
 * 		)
 * 	case KindConstructorType:
 * 		return factory.UpdateConstructorTypeNode(
 * 			node.AsConstructorTypeNode(),
 * 			modifierArray,
 * 			node.TypeParameterList(),
 * 			node.ParameterList(),
 * 			node.Type(),
 * 		)
 * 	case KindPropertySignature:
 * 		return factory.UpdatePropertySignatureDeclaration(
 * 			node.AsPropertySignatureDeclaration(),
 * 			modifierArray,
 * 			node.Name(),
 * 			node.PostfixToken(),
 * 			node.Type(),
 * 			node.Initializer(),
 * 		)
 * 	case KindPropertyDeclaration:
 * 		return factory.UpdatePropertyDeclaration(
 * 			node.AsPropertyDeclaration(),
 * 			modifierArray,
 * 			node.Name(),
 * 			node.PostfixToken(),
 * 			node.Type(),
 * 			node.Initializer(),
 * 		)
 * 	case KindMethodSignature:
 * 		return factory.UpdateMethodSignatureDeclaration(
 * 			node.AsMethodSignatureDeclaration(),
 * 			modifierArray,
 * 			node.Name(),
 * 			node.PostfixToken(),
 * 			node.TypeParameterList(),
 * 			node.ParameterList(),
 * 			node.Type(),
 * 		)
 * 	case KindMethodDeclaration:
 * 		return factory.UpdateMethodDeclaration(
 * 			node.AsMethodDeclaration(),
 * 			modifierArray,
 * 			node.AsMethodDeclaration().AsteriskToken,
 * 			node.Name(),
 * 			node.PostfixToken(),
 * 			node.TypeParameterList(),
 * 			node.ParameterList(),
 * 			node.Type(),
 * 			node.AsMethodDeclaration().FullSignature,
 * 			node.Body(),
 * 		)
 * 	case KindConstructor:
 * 		return factory.UpdateConstructorDeclaration(
 * 			node.AsConstructorDeclaration(),
 * 			modifierArray,
 * 			node.TypeParameterList(),
 * 			node.ParameterList(),
 * 			node.Type(),
 * 			node.AsConstructorDeclaration().FullSignature,
 * 			node.Body(),
 * 		)
 * 	case KindGetAccessor:
 * 		return factory.UpdateGetAccessorDeclaration(
 * 			node.AsGetAccessorDeclaration(),
 * 			modifierArray,
 * 			node.Name(),
 * 			node.TypeParameterList(),
 * 			node.ParameterList(),
 * 			node.Type(),
 * 			node.AsGetAccessorDeclaration().FullSignature,
 * 			node.Body(),
 * 		)
 * 	case KindSetAccessor:
 * 		return factory.UpdateSetAccessorDeclaration(
 * 			node.AsSetAccessorDeclaration(),
 * 			modifierArray,
 * 			node.Name(),
 * 			node.TypeParameterList(),
 * 			node.ParameterList(),
 * 			node.Type(),
 * 			node.AsSetAccessorDeclaration().FullSignature,
 * 			node.Body(),
 * 		)
 * 	case KindIndexSignature:
 * 		return factory.UpdateIndexSignatureDeclaration(
 * 			node.AsIndexSignatureDeclaration(),
 * 			modifierArray,
 * 			node.ParameterList(),
 * 			node.Type(),
 * 		)
 * 	case KindFunctionExpression:
 * 		return factory.UpdateFunctionExpression(
 * 			node.AsFunctionExpression(),
 * 			modifierArray,
 * 			node.AsFunctionExpression().AsteriskToken,
 * 			node.Name(),
 * 			node.TypeParameterList(),
 * 			node.ParameterList(),
 * 			node.Type(),
 * 			node.AsFunctionExpression().FullSignature,
 * 			node.Body(),
 * 		)
 * 	case KindArrowFunction:
 * 		return factory.UpdateArrowFunction(
 * 			node.AsArrowFunction(),
 * 			modifierArray,
 * 			node.TypeParameterList(),
 * 			node.ParameterList(),
 * 			node.Type(),
 * 			node.AsArrowFunction().FullSignature,
 * 			node.AsArrowFunction().EqualsGreaterThanToken,
 * 			node.Body(),
 * 		)
 * 	case KindClassExpression:
 * 		return factory.UpdateClassExpression(
 * 			node.AsClassExpression(),
 * 			modifierArray,
 * 			node.Name(),
 * 			node.TypeParameterList(),
 * 			node.AsClassExpression().HeritageClauses,
 * 			node.MemberList(),
 * 		)
 * 	case KindVariableStatement:
 * 		return factory.UpdateVariableStatement(
 * 			node.AsVariableStatement(),
 * 			modifierArray,
 * 			node.AsVariableStatement().DeclarationList,
 * 		)
 * 	case KindFunctionDeclaration:
 * 		return factory.UpdateFunctionDeclaration(
 * 			node.AsFunctionDeclaration(),
 * 			modifierArray,
 * 			node.AsFunctionDeclaration().AsteriskToken,
 * 			node.Name(),
 * 			node.TypeParameterList(),
 * 			node.ParameterList(),
 * 			node.Type(),
 * 			node.AsFunctionDeclaration().FullSignature,
 * 			node.Body(),
 * 		)
 * 	case KindClassDeclaration:
 * 		return factory.UpdateClassDeclaration(
 * 			node.AsClassDeclaration(),
 * 			modifierArray,
 * 			node.Name(),
 * 			node.TypeParameterList(),
 * 			node.AsClassDeclaration().HeritageClauses,
 * 			node.MemberList(),
 * 		)
 * 	case KindInterfaceDeclaration:
 * 		return factory.UpdateInterfaceDeclaration(
 * 			node.AsInterfaceDeclaration(),
 * 			modifierArray,
 * 			node.Name(),
 * 			node.TypeParameterList(),
 * 			node.AsInterfaceDeclaration().HeritageClauses,
 * 			node.MemberList(),
 * 		)
 * 	case KindTypeAliasDeclaration:
 * 		return factory.UpdateTypeAliasDeclaration(
 * 			node.AsTypeAliasDeclaration(),
 * 			modifierArray,
 * 			node.Name(),
 * 			node.TypeParameterList(),
 * 			node.Type(),
 * 		)
 * 	case KindEnumDeclaration:
 * 		return factory.UpdateEnumDeclaration(
 * 			node.AsEnumDeclaration(),
 * 			modifierArray,
 * 			node.Name(),
 * 			node.MemberList(),
 * 		)
 * 	case KindModuleDeclaration:
 * 		return factory.UpdateModuleDeclaration(
 * 			node.AsModuleDeclaration(),
 * 			modifierArray,
 * 			node.AsModuleDeclaration().Keyword,
 * 			node.Name(),
 * 			node.Body(),
 * 		)
 * 	case KindImportEqualsDeclaration:
 * 		return factory.UpdateImportEqualsDeclaration(
 * 			node.AsImportEqualsDeclaration(),
 * 			modifierArray,
 * 			node.IsTypeOnly(),
 * 			node.Name(),
 * 			node.AsImportEqualsDeclaration().ModuleReference,
 * 		)
 * 	case KindImportDeclaration:
 * 		return factory.UpdateImportDeclaration(
 * 			node.AsImportDeclaration(),
 * 			modifierArray,
 * 			node.ImportClause(),
 * 			node.ModuleSpecifier(),
 * 			node.AsImportDeclaration().Attributes,
 * 		)
 * 	case KindExportAssignment:
 * 		return factory.UpdateExportAssignment(
 * 			node.AsExportAssignment(),
 * 			modifierArray,
 * 			node.AsExportAssignment().IsExportEquals,
 * 			node.Type(),
 * 			node.Expression(),
 * 		)
 * 	case KindExportDeclaration:
 * 		return factory.UpdateExportDeclaration(
 * 			node.AsExportDeclaration(),
 * 			modifierArray,
 * 			node.IsTypeOnly(),
 * 			node.AsExportDeclaration().ExportClause,
 * 			node.ModuleSpecifier(),
 * 			node.AsExportDeclaration().Attributes,
 * 		)
 * 	}
 * 	panic(fmt.Sprintf("Node that does not have modifiers tried to have modifier replaced: %d", node.Kind))
 * }
 */
export function ReplaceModifiers(factory: GoPtr<NodeFactory>, node: GoPtr<Node>, modifierArray: GoPtr<ModifierList>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindTypeParameter: {
      const declaration = AsTypeParameterDeclaration(node);
      return NodeFactory_UpdateTypeParameterDeclaration(
        factory,
        declaration,
        modifierArray,
        Node_Name(node),
        declaration!.Constraint,
        declaration!.Expression,
        declaration!.DefaultType,
      );
    }
    case KindParameter: {
      const declaration = AsParameterDeclaration(node);
      return NodeFactory_UpdateParameterDeclaration(
        factory,
        declaration,
        modifierArray,
        declaration!.DotDotDotToken,
        Node_Name(node),
        Node_QuestionToken(node),
        Node_Type(node),
        Node_Initializer(node),
      );
    }
    case KindConstructorType:
      return NodeFactory_UpdateConstructorTypeNode(
        factory,
        AsConstructorTypeNode(node),
        modifierArray,
        Node_TypeParameterList(node),
        Node_ParameterList(node),
        Node_Type(node),
      );
    case KindPropertySignature:
      return NodeFactory_UpdatePropertySignatureDeclaration(
        factory,
        AsPropertySignatureDeclaration(node),
        modifierArray,
        Node_Name(node),
        Node_PostfixToken(node),
        Node_Type(node),
        Node_Initializer(node),
      );
    case KindPropertyDeclaration:
      return NodeFactory_UpdatePropertyDeclaration(
        factory,
        AsPropertyDeclaration(node),
        modifierArray,
        Node_Name(node),
        Node_PostfixToken(node),
        Node_Type(node),
        Node_Initializer(node),
      );
    case KindMethodSignature:
      return NodeFactory_UpdateMethodSignatureDeclaration(
        factory,
        AsMethodSignatureDeclaration(node),
        modifierArray,
        Node_Name(node),
        Node_PostfixToken(node),
        Node_TypeParameterList(node),
        Node_ParameterList(node),
        Node_Type(node),
      );
    case KindMethodDeclaration: {
      const declaration = AsMethodDeclaration(node);
      return NodeFactory_UpdateMethodDeclaration(
        factory,
        declaration,
        modifierArray,
        declaration!.AsteriskToken,
        Node_Name(node),
        Node_PostfixToken(node),
        Node_TypeParameterList(node),
        Node_ParameterList(node),
        Node_Type(node),
        declaration!.FullSignature,
        Node_Body(node),
      );
    }
    case KindConstructor: {
      const declaration = AsConstructorDeclaration(node);
      return NodeFactory_UpdateConstructorDeclaration(
        factory,
        declaration,
        modifierArray,
        Node_TypeParameterList(node),
        Node_ParameterList(node),
        Node_Type(node),
        declaration!.FullSignature,
        Node_Body(node),
      );
    }
    case KindGetAccessor: {
      const declaration = AsGetAccessorDeclaration(node);
      return NodeFactory_UpdateGetAccessorDeclaration(
        factory,
        declaration,
        modifierArray,
        Node_Name(node),
        Node_TypeParameterList(node),
        Node_ParameterList(node),
        Node_Type(node),
        declaration!.FullSignature,
        Node_Body(node),
      );
    }
    case KindSetAccessor: {
      const declaration = AsSetAccessorDeclaration(node);
      return NodeFactory_UpdateSetAccessorDeclaration(
        factory,
        declaration,
        modifierArray,
        Node_Name(node),
        Node_TypeParameterList(node),
        Node_ParameterList(node),
        Node_Type(node),
        declaration!.FullSignature,
        Node_Body(node),
      );
    }
    case KindIndexSignature:
      return NodeFactory_UpdateIndexSignatureDeclaration(
        factory,
        AsIndexSignatureDeclaration(node),
        modifierArray,
        Node_ParameterList(node),
        Node_Type(node),
      );
    case KindFunctionExpression: {
      const declaration = AsFunctionExpression(node);
      return NodeFactory_UpdateFunctionExpression(
        factory,
        declaration,
        modifierArray,
        declaration!.AsteriskToken,
        Node_Name(node),
        Node_TypeParameterList(node),
        Node_ParameterList(node),
        Node_Type(node),
        declaration!.FullSignature,
        Node_Body(node),
      );
    }
    case KindArrowFunction: {
      const declaration = AsArrowFunction(node);
      return NodeFactory_UpdateArrowFunction(
        factory,
        declaration,
        modifierArray,
        Node_TypeParameterList(node),
        Node_ParameterList(node),
        Node_Type(node),
        declaration!.FullSignature,
        declaration!.EqualsGreaterThanToken,
        Node_Body(node),
      );
    }
    case KindClassExpression:
      return NodeFactory_UpdateClassExpression(
        factory,
        AsClassExpression(node),
        modifierArray,
        Node_Name(node),
        Node_TypeParameterList(node),
        AsClassExpression(node)!.HeritageClauses,
        Node_MemberList(node),
      );
    case KindVariableStatement:
      return NodeFactory_UpdateVariableStatement(
        factory,
        AsVariableStatement(node),
        modifierArray,
        AsVariableStatement(node)!.DeclarationList,
      );
    case KindFunctionDeclaration: {
      const declaration = AsFunctionDeclaration(node);
      return NodeFactory_UpdateFunctionDeclaration(
        factory,
        declaration,
        modifierArray,
        declaration!.AsteriskToken,
        Node_Name(node),
        Node_TypeParameterList(node),
        Node_ParameterList(node),
        Node_Type(node),
        declaration!.FullSignature,
        Node_Body(node),
      );
    }
    case KindClassDeclaration:
      return NodeFactory_UpdateClassDeclaration(
        factory,
        AsClassDeclaration(node),
        modifierArray,
        Node_Name(node),
        Node_TypeParameterList(node),
        AsClassDeclaration(node)!.HeritageClauses,
        Node_MemberList(node),
      );
    case KindInterfaceDeclaration:
      return NodeFactory_UpdateInterfaceDeclaration(
        factory,
        AsInterfaceDeclaration(node),
        modifierArray,
        Node_Name(node),
        Node_TypeParameterList(node),
        AsInterfaceDeclaration(node)!.HeritageClauses,
        Node_MemberList(node),
      );
    case KindTypeAliasDeclaration:
      return NodeFactory_UpdateTypeAliasDeclaration(
        factory,
        AsTypeAliasDeclaration(node),
        modifierArray,
        Node_Name(node),
        Node_TypeParameterList(node),
        Node_Type(node),
      );
    case KindEnumDeclaration:
      return NodeFactory_UpdateEnumDeclaration(
        factory,
        AsEnumDeclaration(node),
        modifierArray,
        Node_Name(node),
        Node_MemberList(node),
      );
    case KindModuleDeclaration:
      return NodeFactory_UpdateModuleDeclaration(
        factory,
        AsModuleDeclaration(node),
        modifierArray,
        AsModuleDeclaration(node)!.Keyword,
        Node_Name(node),
        Node_Body(node),
      );
    case KindImportEqualsDeclaration:
      return NodeFactory_UpdateImportEqualsDeclaration(
        factory,
        AsImportEqualsDeclaration(node),
        modifierArray,
        Node_IsTypeOnly(node),
        Node_Name(node),
        AsImportEqualsDeclaration(node)!.ModuleReference,
      );
    case KindImportDeclaration:
      return NodeFactory_UpdateImportDeclaration(
        factory,
        AsImportDeclaration(node),
        modifierArray,
        Node_ImportClause(node),
        Node_ModuleSpecifier(node),
        AsImportDeclaration(node)!.Attributes,
      );
    case KindExportAssignment:
      return NodeFactory_UpdateExportAssignment(
        factory,
        AsExportAssignment(node),
        modifierArray,
        AsExportAssignment(node)!.IsExportEquals,
        Node_Type(node),
        Node_Expression(node),
      );
    case KindExportDeclaration:
      return NodeFactory_UpdateExportDeclaration(
        factory,
        AsExportDeclaration(node),
        modifierArray,
        Node_IsTypeOnly(node),
        AsExportDeclaration(node)!.ExportClause,
        Node_ModuleSpecifier(node),
        AsExportDeclaration(node)!.Attributes,
      );
  }
  throw new globalThis.Error(`Node that does not have modifiers tried to have modifier replaced: ${node!.Kind}`);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsLateVisibilityPaintedStatement","kind":"func","status":"implemented","sigHash":"e6f55c0ed00f7bcd9797df43ff149f37f0276f6db6c43156dbf5941c98341712","bodyHash":"65e094d644e80510ce334580255eadd03e2dbe48bd8dbd52440202a1837e67c3"}
 *
 * Go source:
 * func IsLateVisibilityPaintedStatement(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindImportDeclaration,
 * 		KindJSImportDeclaration,
 * 		KindImportEqualsDeclaration,
 * 		KindVariableStatement,
 * 		KindClassDeclaration,
 * 		KindFunctionDeclaration,
 * 		KindModuleDeclaration,
 * 		KindTypeAliasDeclaration,
 * 		KindJSTypeAliasDeclaration,
 * 		KindInterfaceDeclaration,
 * 		KindEnumDeclaration:
 * 		return true
 * 	default:
 * 		return false
 * 	}
 * }
 */
export function IsLateVisibilityPaintedStatement(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindImportDeclaration:
    case KindJSImportDeclaration:
    case KindImportEqualsDeclaration:
    case KindVariableStatement:
    case KindClassDeclaration:
    case KindFunctionDeclaration:
    case KindModuleDeclaration:
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
    case KindInterfaceDeclaration:
    case KindEnumDeclaration:
      return true as bool;
    default:
      return false as bool;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsExternalModuleAugmentation","kind":"func","status":"implemented","sigHash":"bd939df0d38b1bc2ea12737b6219cccfc4432cf0ff9cf87677d3493cf5a2742e","bodyHash":"759bf97fdd4a29c7c8db554bbb08b3392dc8f909b067c19b653b296fe9a44ccc"}
 *
 * Go source:
 * func IsExternalModuleAugmentation(node *Node) bool {
 * 	return IsAmbientModule(node) && IsModuleAugmentationExternal(node)
 * }
 */
export function IsExternalModuleAugmentation(node: GoPtr<Node>): bool {
  return (IsAmbientModule(node) && IsModuleAugmentationExternal(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetSourceFileOfModule","kind":"func","status":"implemented","sigHash":"0b6b9a14576f0aa4c74b148a5a139e515f266f9338c556c840b78784cf09f899","bodyHash":"1e1d11f68ed872b995b18b091ae981c6084312d3427e807d1e7aff624dd38d4a"}
 *
 * Go source:
 * func GetSourceFileOfModule(module *Symbol) *SourceFile {
 * 	declaration := module.ValueDeclaration
 * 	if declaration == nil {
 * 		declaration = GetNonAugmentationDeclaration(module)
 * 	}
 * 	return GetSourceFileOfNode(declaration)
 * }
 */
export function GetSourceFileOfModule(module_: GoPtr<Symbol>): GoPtr<SourceFile> {
  const declaration: GoPtr<Node> = module_!.ValueDeclaration !== undefined
    ? module_!.ValueDeclaration
    : GetNonAugmentationDeclaration(module_);
  return GetSourceFileOfNode(declaration);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetNonAugmentationDeclaration","kind":"func","status":"implemented","sigHash":"2a7d19c9fb631833f3b721e05cc8eaae19ac9ea4bb40a927e845e6d0802fd76f","bodyHash":"5bbc9819d54a625800a48c122aff07b4ca4108f27a04c5a9e3eaccd6b0903112"}
 *
 * Go source:
 * func GetNonAugmentationDeclaration(symbol *Symbol) *Node {
 * 	return core.Find(symbol.Declarations, func(d *Node) bool {
 * 		return !IsExternalModuleAugmentation(d) && !IsGlobalScopeAugmentation(d)
 * 	})
 * }
 */
export function GetNonAugmentationDeclaration(symbol_: GoPtr<Symbol>): GoPtr<Node> {
  return Find(symbol_!.Declarations ?? [], (d: GoPtr<Node>): bool => {
    return (!IsExternalModuleAugmentation(d) && !IsGlobalScopeAugmentation(d)) as bool;
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsTypeDeclaration","kind":"func","status":"implemented","sigHash":"4cf8192765e38e7cdd44082c018790cbec79f124d0b6727c9cda8b0a23941571","bodyHash":"b142bd1af01908a63d06970b8f7f7c62431c091a62e694b58511147cc80b669d"}
 *
 * Go source:
 * func IsTypeDeclaration(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindTypeParameter, KindClassDeclaration, KindInterfaceDeclaration, KindTypeAliasDeclaration, KindJSTypeAliasDeclaration, KindEnumDeclaration:
 * 		return true
 * 	case KindImportClause:
 * 		return node.IsTypeOnly()
 * 	case KindImportSpecifier, KindExportSpecifier:
 * 		return node.Parent.Parent.IsTypeOnly()
 * 	default:
 * 		return false
 * 	}
 * }
 */
export function IsTypeDeclaration(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindTypeParameter:
    case KindClassDeclaration:
    case KindInterfaceDeclaration:
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
    case KindEnumDeclaration:
      return true as bool;
    case KindImportClause:
      return Node_IsTypeOnly(node);
    case KindImportSpecifier:
    case KindExportSpecifier:
      return Node_IsTypeOnly(node!.Parent!.Parent);
    default:
      return false as bool;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsTypeDeclarationName","kind":"func","status":"implemented","sigHash":"8c3982a6d36a155d44d4b4d4fcb6dee8b4fe72f17693f3f8c27dbe5c26202a17","bodyHash":"63ee31a791a7fd8f83ecb043c59234ad129e2b9b792207ab4d6242a97cbe6b78"}
 *
 * Go source:
 * func IsTypeDeclarationName(name *Node) bool {
 * 	return name.Kind == KindIdentifier &&
 * 		IsTypeDeclaration(name.Parent) &&
 * 		GetNameOfDeclaration(name.Parent) == name
 * }
 */
export function IsTypeDeclarationName(name: GoPtr<Node>): bool {
  return (name!.Kind === KindIdentifier &&
    IsTypeDeclaration(name!.Parent) &&
    GetNameOfDeclaration(name!.Parent) === name) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsRightSideOfPropertyAccess","kind":"func","status":"implemented","sigHash":"8de61c942ff9f748bbf38c9d00dcf7f69a66761c837aa09bdd48836bd25eba7c","bodyHash":"527dc2ac800900f0d42d6d6ad59330e59a2b2f29a2c33cd75c581b7a4811e581"}
 *
 * Go source:
 * func IsRightSideOfPropertyAccess(node *Node) bool {
 * 	return node.Parent.Kind == KindPropertyAccessExpression && node.Parent.Name() == node
 * }
 */
export function IsRightSideOfPropertyAccess(node: GoPtr<Node>): bool {
  return (node!.Parent!.Kind === KindPropertyAccessExpression && Node_Name(node!.Parent) === node) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsArgumentExpressionOfElementAccess","kind":"func","status":"implemented","sigHash":"1947cd63ad8aa9caf1774a90cac99dca16a5229fd598731daffbaaffc49185a4","bodyHash":"cd5f71bf0e682bc991d67ba05c44926a7d3b8a0631ce28f7d697eb31c24ae455"}
 *
 * Go source:
 * func IsArgumentExpressionOfElementAccess(node *Node) bool {
 * 	return node.Parent != nil && node.Parent.Kind == KindElementAccessExpression && node.Parent.AsElementAccessExpression().ArgumentExpression == node
 * }
 */
export function IsArgumentExpressionOfElementAccess(node: GoPtr<Node>): bool {
  return (node!.Parent !== undefined && node!.Parent!.Kind === KindElementAccessExpression && AsElementAccessExpression(node!.Parent)!.ArgumentExpression === node) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::ClimbPastPropertyAccess","kind":"func","status":"implemented","sigHash":"de7239241a5472e603966f28068cd1d0568fec649ade8983bfcd6cf71ede234a","bodyHash":"41a4c103f4469864cf3dd3638106af3f32ff0552cce7fc24d59c94ba5f7be72c"}
 *
 * Go source:
 * func ClimbPastPropertyAccess(node *Node) *Node {
 * 	if IsRightSideOfPropertyAccess(node) {
 * 		return node.Parent
 * 	}
 * 	return node
 * }
 */
export function ClimbPastPropertyAccess(node: GoPtr<Node>): GoPtr<Node> {
  if (IsRightSideOfPropertyAccess(node)) {
    return node!.Parent;
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::climbPastPropertyOrElementAccess","kind":"func","status":"implemented","sigHash":"2d0a19330436e95b38bbce6cb57ac1fe459f949c4998fb172420cf0df4d0c26b","bodyHash":"1340629790b5b0905878c68294e5efda3142222ac00f7ca54114455c5017a41f"}
 *
 * Go source:
 * func climbPastPropertyOrElementAccess(node *Node) *Node {
 * 	if IsRightSideOfPropertyAccess(node) || IsArgumentExpressionOfElementAccess(node) {
 * 		return node.Parent
 * 	}
 * 	return node
 * }
 */
export function climbPastPropertyOrElementAccess(node: GoPtr<Node>): GoPtr<Node> {
  if (IsRightSideOfPropertyAccess(node) || IsArgumentExpressionOfElementAccess(node)) {
    return node!.Parent;
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::selectExpressionOfCallOrNewExpressionOrDecorator","kind":"func","status":"implemented","sigHash":"0fed4ae87bbd61e7cdc91480db44bf89bb709fff00121fb26b1233b52061fe74","bodyHash":"c425b3c58c5273cfd80ab616e9fc6687c833b039c9b993a622b282659f603dcf"}
 *
 * Go source:
 * func selectExpressionOfCallOrNewExpressionOrDecorator(node *Node) *Node {
 * 	if IsCallExpression(node) || IsNewExpression(node) || IsDecorator(node) {
 * 		return node.Expression()
 * 	}
 * 	return nil
 * }
 */
export function selectExpressionOfCallOrNewExpressionOrDecorator(node: GoPtr<Node>): GoPtr<Node> {
  if (IsCallExpression(node) || IsNewExpression(node) || IsDecorator(node)) {
    return Node_Expression(node);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::selectTagOfTaggedTemplateExpression","kind":"func","status":"implemented","sigHash":"1b31169983ababfa34d16d1571edaef04bac97439b424bd59f7353e21c34d29f","bodyHash":"077de27796d910be17f6f8de1245de3fcf4d05d864fe8f9fc8f196bb6ce4f694"}
 *
 * Go source:
 * func selectTagOfTaggedTemplateExpression(node *Node) *Node {
 * 	if IsTaggedTemplateExpression(node) {
 * 		return node.AsTaggedTemplateExpression().Tag
 * 	}
 * 	return nil
 * }
 */
export function selectTagOfTaggedTemplateExpression(node: GoPtr<Node>): GoPtr<Node> {
  if (IsTaggedTemplateExpression(node)) {
    return AsTaggedTemplateExpression(node)!.Tag;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::selectTagNameOfJsxOpeningLikeElement","kind":"func","status":"implemented","sigHash":"3f6940836daad758bec47e268e6f31f43fb6c94404da47171df55b40a9db75cf","bodyHash":"4c3a0d5b91ef3add0a93b13d4f961de2d0ca56215ab3ece6b71bb38a3d65abc8"}
 *
 * Go source:
 * func selectTagNameOfJsxOpeningLikeElement(node *Node) *Node {
 * 	if IsJsxOpeningElement(node) || IsJsxSelfClosingElement(node) {
 * 		return node.TagName()
 * 	}
 * 	return nil
 * }
 */
export function selectTagNameOfJsxOpeningLikeElement(node: GoPtr<Node>): GoPtr<Node> {
  if (IsJsxOpeningElement(node) || IsJsxSelfClosingElement(node)) {
    return Node_TagName(node);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsCallExpressionTarget","kind":"func","status":"implemented","sigHash":"80166fe815a8131e9e6d409c915010f797c5cc1fe8c633c269958cc84e5a8b31","bodyHash":"d189746ac4465026a32c7a10a06e4da86bc23e31f420e9f7e640b1811610d581"}
 *
 * Go source:
 * func IsCallExpressionTarget(node *Node, includeElementAccess bool, skipPastOuterExpressions bool) bool {
 * 	return isCalleeWorker(node, IsCallExpression, selectExpressionOfCallOrNewExpressionOrDecorator, includeElementAccess, skipPastOuterExpressions)
 * }
 */
export function IsCallExpressionTarget(node: GoPtr<Node>, includeElementAccess: bool, skipPastOuterExpressions: bool): bool {
  return isCalleeWorker(node, IsCallExpression, selectExpressionOfCallOrNewExpressionOrDecorator, includeElementAccess, skipPastOuterExpressions);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsNewExpressionTarget","kind":"func","status":"implemented","sigHash":"7b18a45f625e968d85b54354330a4b7a3408cff1a828e04e81b03f003d789407","bodyHash":"0d2b6194847ca481ad64a64ee601d6b490e0f0c52ec74c0efd9c910368eea30a"}
 *
 * Go source:
 * func IsNewExpressionTarget(node *Node, includeElementAccess bool, skipPastOuterExpressions bool) bool {
 * 	return isCalleeWorker(node, IsNewExpression, selectExpressionOfCallOrNewExpressionOrDecorator, includeElementAccess, skipPastOuterExpressions)
 * }
 */
export function IsNewExpressionTarget(node: GoPtr<Node>, includeElementAccess: bool, skipPastOuterExpressions: bool): bool {
  return isCalleeWorker(node, IsNewExpression, selectExpressionOfCallOrNewExpressionOrDecorator, includeElementAccess, skipPastOuterExpressions);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsCallOrNewExpressionTarget","kind":"func","status":"implemented","sigHash":"d1becb09f4df89e3cf0f700c1ff2db0f32320dcb041d2e9ce18fe239a7fc0a35","bodyHash":"23b4263ed723430a989fa6c638829fd31183ae8c7b111052a911dad0e45e9d71"}
 *
 * Go source:
 * func IsCallOrNewExpressionTarget(node *Node, includeElementAccess bool, skipPastOuterExpressions bool) bool {
 * 	return isCalleeWorker(node, IsCallOrNewExpression, selectExpressionOfCallOrNewExpressionOrDecorator, includeElementAccess, skipPastOuterExpressions)
 * }
 */
export function IsCallOrNewExpressionTarget(node: GoPtr<Node>, includeElementAccess: bool, skipPastOuterExpressions: bool): bool {
  return isCalleeWorker(node, IsCallOrNewExpression, selectExpressionOfCallOrNewExpressionOrDecorator, includeElementAccess, skipPastOuterExpressions);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsTaggedTemplateTag","kind":"func","status":"implemented","sigHash":"5fbc06229e91cb5f4f74010d2a6bd012043458c7d070a91d1d8c625d3a59c598","bodyHash":"2cb0bd9ca9d984a440c799cea8dd5890e485e4b4a818c29270753b6e830d83b5"}
 *
 * Go source:
 * func IsTaggedTemplateTag(node *Node, includeElementAccess bool, skipPastOuterExpressions bool) bool {
 * 	return isCalleeWorker(node, IsTaggedTemplateExpression, selectTagOfTaggedTemplateExpression, includeElementAccess, skipPastOuterExpressions)
 * }
 */
export function IsTaggedTemplateTag(node: GoPtr<Node>, includeElementAccess: bool, skipPastOuterExpressions: bool): bool {
  return isCalleeWorker(node, IsTaggedTemplateExpression, selectTagOfTaggedTemplateExpression, includeElementAccess, skipPastOuterExpressions);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsDecoratorTarget","kind":"func","status":"implemented","sigHash":"8f7ffd6b1cf68db4d541a7e5a1a071b2553659216ddd2974374a3ba660a63109","bodyHash":"c2317498b67aa6ef532e6a382ea8703605643c29f5f01cd0c253381d74dda2ab"}
 *
 * Go source:
 * func IsDecoratorTarget(node *Node, includeElementAccess bool, skipPastOuterExpressions bool) bool {
 * 	return isCalleeWorker(node, IsDecorator, selectExpressionOfCallOrNewExpressionOrDecorator, includeElementAccess, skipPastOuterExpressions)
 * }
 */
export function IsDecoratorTarget(node: GoPtr<Node>, includeElementAccess: bool, skipPastOuterExpressions: bool): bool {
  return isCalleeWorker(node, IsDecorator, selectExpressionOfCallOrNewExpressionOrDecorator, includeElementAccess, skipPastOuterExpressions);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJsxOpeningLikeElementTagName","kind":"func","status":"implemented","sigHash":"cb96dc2ca7f30353218a24e8fe2c03d803815d72a821c22d30d438bcd9fd5eb5","bodyHash":"c576a7ba33708c1a7b7480a178e52950f6049ddc1174de08dcc306f6286ea0fb"}
 *
 * Go source:
 * func IsJsxOpeningLikeElementTagName(node *Node, includeElementAccess bool, skipPastOuterExpressions bool) bool {
 * 	return isCalleeWorker(node, IsJsxOpeningLikeElement, selectTagNameOfJsxOpeningLikeElement, includeElementAccess, skipPastOuterExpressions)
 * }
 */
export function IsJsxOpeningLikeElementTagName(node: GoPtr<Node>, includeElementAccess: bool, skipPastOuterExpressions: bool): bool {
  return isCalleeWorker(node, IsJsxOpeningLikeElement, selectTagNameOfJsxOpeningLikeElement, includeElementAccess, skipPastOuterExpressions);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isCalleeWorker","kind":"func","status":"implemented","sigHash":"4d654d3db08c54dd36f59c4c73206df01cc9118224c210d8836738b99a4810e6","bodyHash":"42b3645f1b7170db8b78e055ee706d39a1bf2aeb0e3edd4cf5fec132d8a79262"}
 *
 * Go source:
 * func isCalleeWorker(
 * 	node *Node,
 * 	pred func(*Node) bool,
 * 	calleeSelector func(*Node) *Node,
 * 	includeElementAccess bool,
 * 	skipPastOuterExpressions bool,
 * ) bool {
 * 	var target *Node
 * 	if includeElementAccess {
 * 		target = climbPastPropertyOrElementAccess(node)
 * 	} else {
 * 		target = ClimbPastPropertyAccess(node)
 * 	}
 * 	if skipPastOuterExpressions {
 * 		// Only skip outer expressions if the target is actually an expression node
 * 		if IsExpression(target) {
 * 			target = SkipOuterExpressions(target, OEKAll)
 * 		}
 * 	}
 * 	return target != nil && target.Parent != nil && pred(target.Parent) && calleeSelector(target.Parent) == target
 * }
 */
export function isCalleeWorker(node: GoPtr<Node>, pred: (arg0: GoPtr<Node>) => bool, calleeSelector: (arg0: GoPtr<Node>) => GoPtr<Node>, includeElementAccess: bool, skipPastOuterExpressions: bool): bool {
  const target0: GoPtr<Node> = includeElementAccess
    ? climbPastPropertyOrElementAccess(node)
    : ClimbPastPropertyAccess(node);
  // Only skip outer expressions if the target is actually an expression node
  const target: GoPtr<Node> = skipPastOuterExpressions && IsExpression(target0)
    ? SkipOuterExpressions(target0, OEKAll as OuterExpressionKinds)
    : target0;
  return (target !== undefined && target!.Parent !== undefined && pred(target!.Parent) && calleeSelector(target!.Parent) === target) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsRightSideOfQualifiedNameOrPropertyAccess","kind":"func","status":"implemented","sigHash":"698475a388209c56ff89a176c5f4dc54cf44dc070a139a0c1df15463daa50b1f","bodyHash":"c5f52872954dae85c1f712603e42816b70907c6b9dfc504e8d62b465e1c6b603"}
 *
 * Go source:
 * func IsRightSideOfQualifiedNameOrPropertyAccess(node *Node) bool {
 * 	parent := node.Parent
 * 	switch parent.Kind {
 * 	case KindQualifiedName:
 * 		return parent.AsQualifiedName().Right == node
 * 	case KindPropertyAccessExpression:
 * 		return parent.AsPropertyAccessExpression().Name() == node
 * 	case KindMetaProperty:
 * 		return parent.AsMetaProperty().Name() == node
 * 	}
 * 	return false
 * }
 */
export function IsRightSideOfQualifiedNameOrPropertyAccess(node: GoPtr<Node>): bool {
  const parent: GoPtr<Node> = node!.Parent;
  switch (parent!.Kind) {
    case KindQualifiedName:
      return (AsQualifiedName(parent)!.Right === node) as bool;
    case KindPropertyAccessExpression:
      return (Node_Name(parent) === node) as bool;
    case KindMetaProperty:
      return (Node_Name(parent) === node) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::ShouldTransformImportCall","kind":"func","status":"implemented","sigHash":"92b10d65d382251c49679814447d311be0e2acc522d701e199222d627c8481cb","bodyHash":"60f50664e430b4ae71c0ae96f6962bdfd2a18dedb4866cce34776f90e2aa0200"}
 *
 * Go source:
 * func ShouldTransformImportCall(fileName string, options *core.CompilerOptions, impliedNodeFormatForEmit core.ModuleKind) bool {
 * 	moduleKind := options.GetEmitModuleKind()
 * 	if core.ModuleKindNode16 <= moduleKind && moduleKind <= core.ModuleKindNodeNext || moduleKind == core.ModuleKindPreserve {
 * 		return false
 * 	}
 * 	return impliedNodeFormatForEmit < core.ModuleKindES2015
 * }
 */
export function ShouldTransformImportCall(fileName: string, options: GoPtr<CompilerOptions>, impliedNodeFormatForEmit: ModuleKind): bool {
  const moduleKind: ModuleKind = CompilerOptions_GetEmitModuleKind(options);
  if ((ModuleKindNode16 <= moduleKind && moduleKind <= ModuleKindNodeNext) || moduleKind === ModuleKindPreserve) {
    return false as bool;
  }
  return (impliedNodeFormatForEmit < ModuleKindES2015) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasQuestionToken","kind":"func","status":"implemented","sigHash":"094723ec93156350eb81d5d8fd597e757593defd25a606cc40f7d4b9340f86a0","bodyHash":"8df070f5dc4fd89b9c56e20e289a834975af36ef07e945aee614726dccb9a552"}
 *
 * Go source:
 * func HasQuestionToken(node *Node) bool {
 * 	return IsQuestionToken(node.QuestionToken())
 * }
 */
export function HasQuestionToken(node: GoPtr<Node>): bool {
  return IsQuestionToken(Node_QuestionToken(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJsxOpeningLikeElement","kind":"func","status":"implemented","sigHash":"75a6dc1e85384f205d30d78ac8132793617e20b7683f27042876044e8bc8c81d","bodyHash":"88c068c2e4ec1fabd906eec3e2c86068f3953dfcb4ea78e1506cc1001ef0b8a6"}
 *
 * Go source:
 * func IsJsxOpeningLikeElement(node *Node) bool {
 * 	return IsJsxOpeningElement(node) || IsJsxSelfClosingElement(node)
 * }
 */
export function IsJsxOpeningLikeElement(node: GoPtr<Node>): bool {
  return (IsJsxOpeningElement(node) || IsJsxSelfClosingElement(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetInvokedExpression","kind":"func","status":"implemented","sigHash":"ee3a856e2670a85bd3ee78278863a2fb036b358076658300c324d899cfcf5f4e","bodyHash":"e4636f8939845371e92f33cd59f7c4b150c15d891f3347b1b37670b99e8ac10c"}
 *
 * Go source:
 * func GetInvokedExpression(node *Node) *Node {
 * 	switch node.Kind {
 * 	case KindTaggedTemplateExpression:
 * 		return node.AsTaggedTemplateExpression().Tag
 * 	case KindJsxOpeningElement, KindJsxSelfClosingElement:
 * 		return node.TagName()
 * 	case KindBinaryExpression:
 * 		return node.AsBinaryExpression().Right
 * 	case KindJsxOpeningFragment:
 * 		return node
 * 	default:
 * 		return node.Expression()
 * 	}
 * }
 */
export function GetInvokedExpression(node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindTaggedTemplateExpression:
      return AsTaggedTemplateExpression(node)!.Tag;
    case KindJsxOpeningElement:
    case KindJsxSelfClosingElement:
      return Node_TagName(node);
    case KindBinaryExpression:
      return AsBinaryExpression(node)!.Right;
    case KindJsxOpeningFragment:
      return node;
    default:
      return Node_Expression(node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsCallOrNewExpression","kind":"func","status":"implemented","sigHash":"89aba95780942d1dd92ac659b3aacd39305d4783b3f2af494f6959b7533a2654","bodyHash":"bc53e3d815c665cf7580fa99dbad081dcc7d74282a9ed8bdad3cbcb45c0bdce7"}
 *
 * Go source:
 * func IsCallOrNewExpression(node *Node) bool {
 * 	return IsCallExpression(node) || IsNewExpression(node)
 * }
 */
export function IsCallOrNewExpression(node: GoPtr<Node>): bool {
  return (IsCallExpression(node) || IsNewExpression(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IndexOfNode","kind":"func","status":"implemented","sigHash":"d6b77e369f1edaf6031c63ec4598e0e078ca55d881e5878fe766c6e915ec60fc","bodyHash":"625d482165f65d1d07ffceacdfcc738ec09461ce52470814b60d18ba72da6206"}
 *
 * Go source:
 * func IndexOfNode(nodes []*Node, node *Node) int {
 * 	index, ok := slices.BinarySearchFunc(nodes, node, CompareNodePositions)
 * 	if ok {
 * 		return index
 * 	}
 * 	return -1
 * }
 */
export function IndexOfNode(nodes: GoSlice<GoPtr<Node>>, node: GoPtr<Node>): int {
  const [index, ok] = slices.BinarySearchFunc(nodes, node, CompareNodePositions);
  if (ok) {
    return index;
  }
  return -1 as int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::CompareNodePositions","kind":"func","status":"implemented","sigHash":"a56448196f40c6da578ff93594ccd0d30e8731d5cb756dbfe671d2b48ea51e76","bodyHash":"7f4a324f65fb2430c25fee0c30bd1bf47c62a3bcce5d4e4864701d5b398685aa"}
 *
 * Go source:
 * func CompareNodePositions(n1, n2 *Node) int {
 * 	return n1.Pos() - n2.Pos()
 * }
 */
export function CompareNodePositions(n1: GoPtr<Node>, n2: GoPtr<Node>): int {
  return (Node_Pos(n1) - Node_Pos(n2)) as int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsUnterminatedLiteral","kind":"func","status":"implemented","sigHash":"61b3b46ac332575c056f3ca376531833063cdea2647960e0015aa9d9ae6677d2","bodyHash":"5216f84a53069b6dde5e2c79d9b1733098268bfcb5a22cfa8653792307270486"}
 *
 * Go source:
 * func IsUnterminatedLiteral(node *Node) bool {
 * 	return IsLiteralKind(node.Kind) && node.LiteralLikeData().TokenFlags&TokenFlagsUnterminated != 0 ||
 * 		IsTemplateLiteralKind(node.Kind) && node.TemplateLiteralLikeData().TemplateFlags&TokenFlagsUnterminated != 0
 * }
 */
export function IsUnterminatedLiteral(node: GoPtr<Node>): bool {
  return ((IsLiteralKind(node!.Kind) && (Node_LiteralLikeData(node)!.TokenFlags & TokenFlagsUnterminated) !== 0) ||
    (IsTemplateLiteralKind(node!.Kind) && (Node_TemplateLiteralLikeData(node)!.TemplateFlags & TokenFlagsUnterminated) !== 0)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsInitializedProperty","kind":"func","status":"implemented","sigHash":"57250611722c18865ded2d007960c7d65935bd724e34832abe10a4d8240ddb81","bodyHash":"60fe8ad8c385b2428eee712caa4d8da242d81dbd1266b5ea4424507ec2fc063c"}
 *
 * Go source:
 * func IsInitializedProperty(member *ClassElement) bool {
 * 	return member.Kind == KindPropertyDeclaration &&
 * 		member.Initializer() != nil
 * }
 */
export function IsInitializedProperty(member: GoPtr<ClassElement>): bool {
  return (member!.Kind === KindPropertyDeclaration &&
    Node_Initializer(member) !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsTrivia","kind":"func","status":"implemented","sigHash":"5a2b9507cb0fd4171c73d677ed71fdcc4c49314547a403c0056fa3ef1b8ffd07","bodyHash":"34ca56a8d37de3f47915487c13ade90ac88ea5ee842dd04d1b173c1033e0f8a1"}
 *
 * Go source:
 * func IsTrivia(token Kind) bool {
 * 	return KindFirstTriviaToken <= token && token <= KindLastTriviaToken
 * }
 */
export function IsTrivia(token: Kind): bool {
  return (KindFirstTriviaToken <= token && token <= KindLastTriviaToken) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasDecorators","kind":"func","status":"implemented","sigHash":"486e9215442c83b2166d654c55f955caa04de6f09d6a632f64fb223055ce7171","bodyHash":"abdc6c800824e8c3f2cd9a498121dd145dfb8243c77644b4bf2ccf9f41880023"}
 *
 * Go source:
 * func HasDecorators(node *Node) bool {
 * 	return HasSyntacticModifier(node, ModifierFlagsDecorator)
 * }
 */
export function HasDecorators(node: GoPtr<Node>): bool {
  return HasSyntacticModifier(node, ModifierFlagsDecorator);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::type::hasFileNameImpl","kind":"type","status":"implemented","sigHash":"896872024bdb96ff93631583409f62bfc7895142cdc78dcb64d60d5060ae1921","bodyHash":"62fcee5ef611fbe841c1ee190f2e7cc9a4485c8a7af330cc36cab65419378eb5"}
 *
 * Go source:
 * hasFileNameImpl struct {
 * 	fileName string
 * 	path     tspath.Path
 * }
 */
export interface hasFileNameImpl {
  fileName: string;
  path: Path_73a9f36e;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::NewHasFileName","kind":"func","status":"implemented","sigHash":"1458e5bc097a9cde387961ff50637a76b734ca8828f05fcc778897966c44548a","bodyHash":"a9fddd27f3b6768017df29da12609ee95085a78f63812e8001159a983c3a7227"}
 *
 * Go source:
 * func NewHasFileName(fileName string, path tspath.Path) HasFileName {
 * 	return &hasFileNameImpl{
 * 		fileName: fileName,
 * 		path:     path,
 * 	}
 * }
 */
export function NewHasFileName(fileName: string, path: Path_73a9f36e): HasFileName {
  const impl: GoPtr<hasFileNameImpl> = {
    fileName: fileName,
    path: path,
  };
  return {
    FileName: (): string => hasFileNameImpl_FileName(impl),
    Path: (): Path_73a9f36e => hasFileNameImpl_Path(impl),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::method::hasFileNameImpl.FileName","kind":"method","status":"implemented","sigHash":"fed0136b9db8a03828fd73e168e1ff01c88ad337d6d32a8486a048a896d4e023","bodyHash":"79aae19cfc3901400597e97538b6bfa89aab7dc5bc31adf33bd9dfd1607dcf19"}
 *
 * Go source:
 * func (h *hasFileNameImpl) FileName() string {
 * 	return h.fileName
 * }
 */
export function hasFileNameImpl_FileName(receiver: GoPtr<hasFileNameImpl>): string {
  return receiver!.fileName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::method::hasFileNameImpl.Path","kind":"method","status":"implemented","sigHash":"0e682a8334f950c7d4cc45a532c7610f031d50859f65705231c9b93126656a25","bodyHash":"43a07af76873fa0e1747a9be5be6b575e44c5aa82ab7bd3a7fe6fc1819f18bd9"}
 *
 * Go source:
 * func (h *hasFileNameImpl) Path() tspath.Path {
 * 	return h.path
 * }
 */
export function hasFileNameImpl_Path(receiver: GoPtr<hasFileNameImpl>): Path_73a9f36e {
  return receiver!.path;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetSemanticJsxChildren","kind":"func","status":"implemented","sigHash":"d0bd31ad40fefa7043139a216705eb76d35a393174463676d00a53e9720ff850","bodyHash":"cc36c98a569ca60eb3f2e3b737ce54b0da3b824c2031447b10e7f3670048153d"}
 *
 * Go source:
 * func GetSemanticJsxChildren(children []*JsxChild) []*JsxChild {
 * 	return core.Filter(children, func(i *JsxChild) bool {
 * 		switch i.Kind {
 * 		case KindJsxExpression:
 * 			return i.Expression() != nil
 * 		case KindJsxText:
 * 			return !i.AsJsxText().ContainsOnlyTriviaWhiteSpaces
 * 		default:
 * 			return true
 * 		}
 * 	})
 * }
 */
export function GetSemanticJsxChildren(children: GoSlice<GoPtr<JsxChild>>): GoSlice<GoPtr<JsxChild>> {
  return Filter(children, (i: GoPtr<JsxChild>): bool => {
    switch (i!.Kind) {
      case KindJsxExpression:
        return (Node_Expression(i) !== undefined) as bool;
      case KindJsxText:
        return !AsJsxText(i)!.ContainsOnlyTriviaWhiteSpaces as bool;
      default:
        return true as bool;
    }
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::hasComment","kind":"func","status":"implemented","sigHash":"12d284ef21dcb70266df45f9865a5c747d4078858d682edead8c0a07f140c9c9","bodyHash":"f4814ba892d1b944f64a0f8b8cbe5c869ad83cd24ae70c5163afcd4072b5491a"}
 *
 * Go source:
 * func hasComment(kind Kind) bool {
 * 	switch kind {
 * 	case KindJSDoc, KindJSDocUnknownTag, KindJSDocAugmentsTag, KindJSDocImplementsTag,
 * 		KindJSDocDeprecatedTag, KindJSDocPublicTag, KindJSDocPrivateTag, KindJSDocProtectedTag,
 * 		KindJSDocReadonlyTag, KindJSDocOverrideTag, KindJSDocCallbackTag, KindJSDocOverloadTag,
 * 		KindJSDocParameterTag, KindJSDocPropertyTag, KindJSDocReturnTag, KindJSDocThisTag,
 * 		KindJSDocTypeTag, KindJSDocTemplateTag, KindJSDocTypedefTag, KindJSDocSeeTag,
 * 		KindJSDocThrowsTag, KindJSDocSatisfiesTag, KindJSDocImportTag:
 * 		return true
 * 	default:
 * 		return false
 * 	}
 * }
 */
export function hasComment(kind: Kind): bool {
  switch (kind) {
    case KindJSDoc:
    case KindJSDocUnknownTag:
    case KindJSDocAugmentsTag:
    case KindJSDocImplementsTag:
    case KindJSDocDeprecatedTag:
    case KindJSDocPublicTag:
    case KindJSDocPrivateTag:
    case KindJSDocProtectedTag:
    case KindJSDocReadonlyTag:
    case KindJSDocOverrideTag:
    case KindJSDocCallbackTag:
    case KindJSDocOverloadTag:
    case KindJSDocParameterTag:
    case KindJSDocPropertyTag:
    case KindJSDocReturnTag:
    case KindJSDocThisTag:
    case KindJSDocTypeTag:
    case KindJSDocTemplateTag:
    case KindJSDocTypedefTag:
    case KindJSDocSeeTag:
    case KindJSDocThrowsTag:
    case KindJSDocSatisfiesTag:
    case KindJSDocImportTag:
      return true as bool;
    default:
      return false as bool;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsAssignmentPattern","kind":"func","status":"implemented","sigHash":"9f5ba7c238912bec7d6b323a4ea9f6bb4c7c0a61cd40cb27a86cc8edf6e7496b","bodyHash":"8e82acf15e72d7b5084eaf73ec34891e57d8c0f3c0da2db8188d09becdda1556"}
 *
 * Go source:
 * func IsAssignmentPattern(node *Node) bool {
 * 	return node.Kind == KindArrayLiteralExpression || node.Kind == KindObjectLiteralExpression
 * }
 */
export function IsAssignmentPattern(node: GoPtr<Node>): bool {
  return (node!.Kind === KindArrayLiteralExpression || node!.Kind === KindObjectLiteralExpression) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetElementsOfBindingOrAssignmentPattern","kind":"func","status":"implemented","sigHash":"adff8602a7cfe924132398c277c2683ba7feaf5ee75ca7865bbc28b91d25d772","bodyHash":"32aa813868ee0fab12cab76464b1d8c81e61b7914a24d634c63be3cd90dafa28"}
 *
 * Go source:
 * func GetElementsOfBindingOrAssignmentPattern(name *Node) []*Node {
 * 	switch name.Kind {
 * 	case KindObjectBindingPattern, KindArrayBindingPattern, KindArrayLiteralExpression:
 * 		// `a` in `{a}`
 * 		// `a` in `[a]`
 * 		return name.Elements()
 * 	case KindObjectLiteralExpression:
 * 		// `a` in `{a}`
 * 		return name.Properties()
 * 	}
 * 	return nil
 * }
 */
export function GetElementsOfBindingOrAssignmentPattern(name: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  switch (name!.Kind) {
    case KindObjectBindingPattern:
    case KindArrayBindingPattern:
    case KindArrayLiteralExpression:
      // `a` in `{a}`
      // `a` in `[a]`
      return Node_Elements(name)!;
    case KindObjectLiteralExpression:
      // `a` in `{a}`
      return Node_Properties(name)!;
  }
  return undefined!;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsDeclarationBindingElement","kind":"func","status":"implemented","sigHash":"2f2a4e858a27af4ebf40dc299efaaa808c45996d6dc2a92e5186eb0b5473f366","bodyHash":"305ae4016c7cb0de5f43e6d15082e2f8478771c636c74deb4b0e8a90cd2d0890"}
 *
 * Go source:
 * func IsDeclarationBindingElement(bindingElement *Node) bool {
 * 	switch bindingElement.Kind {
 * 	case KindVariableDeclaration, KindParameter, KindBindingElement:
 * 		return true
 * 	default:
 * 		return false
 * 	}
 * }
 */
export function IsDeclarationBindingElement(bindingElement: GoPtr<Node>): bool {
  switch (bindingElement!.Kind) {
    case KindVariableDeclaration:
    case KindParameter:
    case KindBindingElement:
      return true as bool;
    default:
      return false as bool;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetTargetOfBindingOrAssignmentElement","kind":"func","status":"implemented","sigHash":"e659f82a700993430f7737075841549ff34750d239eef081756cf3f61aa89dd1","bodyHash":"ee9c930b066e06d905b89b3fd720d61c736c1277d47bcb9f20d47d8b5274c676"}
 *
 * Go source:
 * func GetTargetOfBindingOrAssignmentElement(bindingElement *Node) *Node {
 * 	if IsDeclarationBindingElement(bindingElement) {
 * 		// `a` in `let { a } = ...`
 * 		// `a` in `let { a = 1 } = ...`
 * 		// `b` in `let { a: b } = ...`
 * 		// `b` in `let { a: b = 1 } = ...`
 * 		// `a` in `let { ...a } = ...`
 * 		// `{b}` in `let { a: {b} } = ...`
 * 		// `{b}` in `let { a: {b} = 1 } = ...`
 * 		// `[b]` in `let { a: [b] } = ...`
 * 		// `[b]` in `let { a: [b] = 1 } = ...`
 * 		// `a` in `let [a] = ...`
 * 		// `a` in `let [a = 1] = ...`
 * 		// `a` in `let [...a] = ...`
 * 		// `{a}` in `let [{a}] = ...`
 * 		// `{a}` in `let [{a} = 1] = ...`
 * 		// `[a]` in `let [[a]] = ...`
 * 		// `[a]` in `let [[a] = 1] = ...`
 * 		return bindingElement.Name()
 * 	}
 * 
 * 	if IsObjectLiteralElement(bindingElement) {
 * 		switch bindingElement.Kind {
 * 		case KindPropertyAssignment:
 * 			// `b` in `({ a: b } = ...)`
 * 			// `b` in `({ a: b = 1 } = ...)`
 * 			// `{b}` in `({ a: {b} } = ...)`
 * 			// `{b}` in `({ a: {b} = 1 } = ...)`
 * 			// `[b]` in `({ a: [b] } = ...)`
 * 			// `[b]` in `({ a: [b] = 1 } = ...)`
 * 			// `b.c` in `({ a: b.c } = ...)`
 * 			// `b.c` in `({ a: b.c = 1 } = ...)`
 * 			// `b[0]` in `({ a: b[0] } = ...)`
 * 			// `b[0]` in `({ a: b[0] = 1 } = ...)`
 * 			return GetTargetOfBindingOrAssignmentElement(bindingElement.Initializer())
 * 		case KindShorthandPropertyAssignment:
 * 			// `a` in `({ a } = ...)`
 * 			// `a` in `({ a = 1 } = ...)`
 * 			return bindingElement.Name()
 * 		case KindSpreadAssignment:
 * 			// `a` in `({ ...a } = ...)`
 * 			return GetTargetOfBindingOrAssignmentElement(bindingElement.Expression())
 * 		}
 * 
 * 		// no target
 * 		return nil
 * 	}
 * 
 * 	if IsAssignmentExpression(bindingElement /*excludeCompoundAssignment* /, true) {
 * 		// `a` in `[a = 1] = ...`
 * 		// `{a}` in `[{a} = 1] = ...`
 * 		// `[a]` in `[[a] = 1] = ...`
 * 		// `a.b` in `[a.b = 1] = ...`
 * 		// `a[0]` in `[a[0] = 1] = ...`
 * 		return GetTargetOfBindingOrAssignmentElement(bindingElement.AsBinaryExpression().Left)
 * 	}
 * 
 * 	if IsSpreadElement(bindingElement) {
 * 		// `a` in `[...a] = ...`
 * 		return GetTargetOfBindingOrAssignmentElement(bindingElement.Expression())
 * 	}
 * 
 * 	// `a` in `[a] = ...`
 * 	// `{a}` in `[{a}] = ...`
 * 	// `[a]` in `[[a]] = ...`
 * 	// `a.b` in `[a.b] = ...`
 * 	// `a[0]` in `[a[0]] = ...`
 * 	return bindingElement
 * }
 */
export function GetTargetOfBindingOrAssignmentElement(bindingElement: GoPtr<Node>): GoPtr<Node> {
  if (IsDeclarationBindingElement(bindingElement)) {
    return Node_Name(bindingElement);
  }

  if (IsObjectLiteralElement(bindingElement)) {
    switch (bindingElement!.Kind) {
      case KindPropertyAssignment:
        return GetTargetOfBindingOrAssignmentElement(Node_Initializer(bindingElement));
      case KindShorthandPropertyAssignment:
        return Node_Name(bindingElement);
      case KindSpreadAssignment:
        return GetTargetOfBindingOrAssignmentElement(Node_Expression(bindingElement));
    }

    // no target
    return undefined;
  }

  if (IsAssignmentExpression(bindingElement, true /*excludeCompoundAssignment*/)) {
    return GetTargetOfBindingOrAssignmentElement(AsBinaryExpression(bindingElement)!.Left);
  }

  if (IsSpreadElement(bindingElement)) {
    return GetTargetOfBindingOrAssignmentElement(Node_Expression(bindingElement));
  }

  return bindingElement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::TryGetPropertyNameOfBindingOrAssignmentElement","kind":"func","status":"implemented","sigHash":"e398ae4704db70a10fae866588067ab25c6a1acea67955b74b350dc2ca6c9434","bodyHash":"d4fe7c01a7a47d603830736efa749620f3dd77edfe12be0fbea27f940d50745d"}
 *
 * Go source:
 * func TryGetPropertyNameOfBindingOrAssignmentElement(bindingElement *Node) *Node {
 * 	switch bindingElement.Kind {
 * 	case KindBindingElement:
 * 		// `a` in `let { a: b } = ...`
 * 		// `[a]` in `let { [a]: b } = ...`
 * 		// `"a"` in `let { "a": b } = ...`
 * 		// `1` in `let { 1: b } = ...`
 * 		if bindingElement.PropertyName() != nil {
 * 			propertyName := bindingElement.PropertyName()
 * 			// if IsPrivateIdentifier(propertyName) {
 * 			// 	return Debug.failBadSyntaxKind(propertyName) // !!!
 * 			// }
 * 			if IsComputedPropertyName(propertyName) && IsStringOrNumericLiteralLike(propertyName.Expression()) {
 * 				return propertyName.Expression()
 * 			}
 * 			return propertyName
 * 		}
 * 	case KindPropertyAssignment:
 * 		// `a` in `({ a: b } = ...)`
 * 		// `[a]` in `({ [a]: b } = ...)`
 * 		// `"a"` in `({ "a": b } = ...)`
 * 		// `1` in `({ 1: b } = ...)`
 * 		if bindingElement.Name() != nil {
 * 			propertyName := bindingElement.Name()
 * 			// if IsPrivateIdentifier(propertyName) {
 * 			// 	return Debug.failBadSyntaxKind(propertyName) // !!!
 * 			// }
 * 			if IsComputedPropertyName(propertyName) && IsStringOrNumericLiteralLike(propertyName.Expression()) {
 * 				return propertyName.Expression()
 * 			}
 * 			return propertyName
 * 		}
 * 	case KindSpreadAssignment:
 * 		// `a` in `({ ...a } = ...)`
 * 		// if IsPrivateIdentifier(bindingElement.Name()) {
 * 		// 	return Debug.failBadSyntaxKind(bindingElement.Name()) // !!!
 * 		// }
 * 		return bindingElement.Name()
 * 	}
 * 
 * 	target := GetTargetOfBindingOrAssignmentElement(bindingElement)
 * 	if target != nil && IsPropertyName(target) {
 * 		return target
 * 	}
 * 	return nil
 * }
 */
export function TryGetPropertyNameOfBindingOrAssignmentElement(bindingElement: GoPtr<Node>): GoPtr<Node> {
  switch (bindingElement!.Kind) {
    case KindBindingElement:
      if (Node_PropertyName(bindingElement) !== undefined) {
        const propertyName: GoPtr<Node> = Node_PropertyName(bindingElement);
        if (IsComputedPropertyName(propertyName) && IsStringOrNumericLiteralLike(Node_Expression(propertyName))) {
          return Node_Expression(propertyName);
        }
        return propertyName;
      }
      break;
    case KindPropertyAssignment:
      if (Node_Name(bindingElement) !== undefined) {
        const propertyName: GoPtr<Node> = Node_Name(bindingElement);
        if (IsComputedPropertyName(propertyName) && IsStringOrNumericLiteralLike(Node_Expression(propertyName))) {
          return Node_Expression(propertyName);
        }
        return propertyName;
      }
      break;
    case KindSpreadAssignment:
      return Node_Name(bindingElement);
  }

  const target: GoPtr<Node> = GetTargetOfBindingOrAssignmentElement(bindingElement);
  if (target !== undefined && IsPropertyName(target)) {
    return target;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::ContainsObjectRestOrSpread","kind":"func","status":"implemented","sigHash":"e8063158902ee52dca48bdf2ceef99f9232d8f2e063c03f373c7b91f81950490","bodyHash":"173d8832ff217485911649026114c4971755f8469bdc83e1257832dab6764e03"}
 *
 * Go source:
 * func ContainsObjectRestOrSpread(node *Node) bool {
 * 	if node.SubtreeFacts()&SubtreeContainsObjectRestOrSpread != 0 {
 * 		return true
 * 	}
 * 	if node.SubtreeFacts()&SubtreeContainsESObjectRestOrSpread != 0 {
 * 		// check for nested spread assignments, otherwise '{ x: { a, ...b } = foo } = c'
 * 		// will not be correctly interpreted by the rest/spread transformer
 * 		for _, element := range GetElementsOfBindingOrAssignmentPattern(node) {
 * 			target := GetTargetOfBindingOrAssignmentElement(element)
 * 			if target != nil && IsAssignmentPattern(target) {
 * 				if target.SubtreeFacts()&SubtreeContainsObjectRestOrSpread != 0 {
 * 					return true
 * 				}
 * 				if target.SubtreeFacts()&SubtreeContainsESObjectRestOrSpread != 0 {
 * 					if ContainsObjectRestOrSpread(target) {
 * 						return true
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function ContainsObjectRestOrSpread(node: GoPtr<Node>): bool {
  if ((Node_SubtreeFacts(node) & SubtreeContainsObjectRestOrSpread) !== 0) {
    return true as bool;
  }
  if ((Node_SubtreeFacts(node) & SubtreeContainsESObjectRestOrSpread) !== 0) {
    // check for nested spread assignments, otherwise '{ x: { a, ...b } = foo } = c'
    // will not be correctly interpreted by the rest/spread transformer
    for (const element of GetElementsOfBindingOrAssignmentPattern(node) ?? []) {
      const target: GoPtr<Node> = GetTargetOfBindingOrAssignmentElement(element);
      if (target !== undefined && IsAssignmentPattern(target)) {
        if ((Node_SubtreeFacts(target) & SubtreeContainsObjectRestOrSpread) !== 0) {
          return true as bool;
        }
        if ((Node_SubtreeFacts(target) & SubtreeContainsESObjectRestOrSpread) !== 0) {
          if (ContainsObjectRestOrSpread(target)) {
            return true as bool;
          }
        }
      }
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsEmptyObjectLiteral","kind":"func","status":"implemented","sigHash":"a6ec0e35f8771d0e167372d8bf12d8f122f704a62243f415bc5a088d5cce70b5","bodyHash":"022566e2d0d60844a2a5d814569051a8a23eb637b2ee4af5c65c10d726c75fb3"}
 *
 * Go source:
 * func IsEmptyObjectLiteral(expression *Node) bool {
 * 	return IsObjectLiteralExpression(expression) && len(expression.Properties()) == 0
 * }
 */
export function IsEmptyObjectLiteral(expression: GoPtr<Node>): bool {
  return (IsObjectLiteralExpression(expression) && (Node_Properties(expression)?.length ?? 0) === 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsEmptyArrayLiteral","kind":"func","status":"implemented","sigHash":"f134b4a1ebc08288051dbb31eb4e3d97d7445ca65b3b033f7da33341810af946","bodyHash":"63a2ec532888586c3feae5273e225d19e762355b2f48ccbdfe10ab3539fb00fc"}
 *
 * Go source:
 * func IsEmptyArrayLiteral(expression *Node) bool {
 * 	return IsArrayLiteralExpression(expression) && len(expression.Elements()) == 0
 * }
 */
export function IsEmptyArrayLiteral(expression: GoPtr<Node>): bool {
  return (IsArrayLiteralExpression(expression) && (Node_Elements(expression)?.length ?? 0) === 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetRestIndicatorOfBindingOrAssignmentElement","kind":"func","status":"implemented","sigHash":"757e1530b7049ab5e1edf5d66672841030cb30bfbeb8b32ade370bda91282eea","bodyHash":"9c8ce45a6f3dda8f16634aaa22077fed2de54640d2c17a880489a92e936a96c4"}
 *
 * Go source:
 * func GetRestIndicatorOfBindingOrAssignmentElement(bindingElement *Node) *Node {
 * 	switch bindingElement.Kind {
 * 	case KindParameter:
 * 		return bindingElement.AsParameterDeclaration().DotDotDotToken
 * 	case KindBindingElement:
 * 		return bindingElement.AsBindingElement().DotDotDotToken
 * 	case KindSpreadElement, KindSpreadAssignment:
 * 		return bindingElement
 * 	}
 * 	return nil
 * }
 */
export function GetRestIndicatorOfBindingOrAssignmentElement(bindingElement: GoPtr<Node>): GoPtr<Node> {
  switch (bindingElement!.Kind) {
    case KindParameter:
      return AsParameterDeclaration(bindingElement)!.DotDotDotToken;
    case KindBindingElement:
      return AsBindingElement(bindingElement)!.DotDotDotToken;
    case KindSpreadElement:
    case KindSpreadAssignment:
      return bindingElement;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsJSDocNameReferenceContext","kind":"func","status":"implemented","sigHash":"38a025edbc753e059cedfa9acc13572f3f105843a7354503d33e4357bef1ca31","bodyHash":"caba773379a7843f2f5b4f84c7aaf2d5adf022b47e72d77a3d36af7a8cb8a93d"}
 *
 * Go source:
 * func IsJSDocNameReferenceContext(node *Node) bool {
 * 	return node.Flags&NodeFlagsJSDoc != 0 && FindAncestor(node, func(node *Node) bool {
 * 		return IsJSDocNameReference(node) || IsJSDocLinkLike(node)
 * 	}) != nil
 * }
 */
export function IsJSDocNameReferenceContext(node: GoPtr<Node>): bool {
  return ((node!.Flags & NodeFlagsJSDoc) !== 0 && FindAncestor(node, (n: GoPtr<Node>): bool => {
    return (IsJSDocNameReference(n) || IsJSDocLinkLike(n)) as bool;
  }) !== undefined) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetJSDocRoot","kind":"func","status":"implemented","sigHash":"51016fd99342633711eae19356b02244f19f0af0495965d27016df8ad68a4ed0","bodyHash":"5e145fe2183d9492712f28f83b8e3297f331dc5c2f3124d037fd225288f09894"}
 *
 * Go source:
 * func GetJSDocRoot(node *Node) *Node {
 * 	return FindAncestor(node.Parent, func(n *Node) bool {
 * 		return n.Kind == KindJSDoc
 * 	})
 * }
 */
export function GetJSDocRoot(node: GoPtr<Node>): GoPtr<Node> {
  return FindAncestor(node!.Parent, (n: GoPtr<Node>): bool => {
    return (n!.Kind === KindJSDoc) as bool;
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetJSDocHost","kind":"func","status":"implemented","sigHash":"0643a8a54af77f2012d6337f4a396968e94431f6c1b6b90e7fb9b75943dacacb","bodyHash":"82db7aa50326a5879f926283530672c0043bec3237a3f5e6ecab6955e4c93414"}
 *
 * Go source:
 * func GetJSDocHost(node *Node) *Node {
 * 	jsDoc := GetJSDocRoot(node)
 * 	if jsDoc == nil {
 * 		return nil
 * 	}
 * 	return jsDoc.Parent
 * }
 */
export function GetJSDocHost(node: GoPtr<Node>): GoPtr<Node> {
  const jsDoc: GoPtr<Node> = GetJSDocRoot(node);
  if (jsDoc === undefined) {
    return undefined;
  }
  return jsDoc!.Parent;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetHostSignatureFromJSDoc","kind":"func","status":"implemented","sigHash":"bc9585bf583fa67d5e11ce8d01b5f3a750c75d40eacdbe276459f8fbfb6b2b54","bodyHash":"c2301e48c4350104e476fadd823172a7a2c1e05a63ce274b6ee30096026e724a"}
 *
 * Go source:
 * func GetHostSignatureFromJSDoc(node *Node) *Node {
 * 	host := GetJSDocHost(node)
 * 	if host == nil {
 * 		return nil
 * 	}
 * 	// !!! Strada's getEffectiveJSDocHost applies JS assignment pattern transforms (getSourceOfAssignment, getSourceOfDefaultedAssignment, etc.) not yet ported
 * 	if IsPropertySignatureDeclaration(host) && host.Type() != nil && IsFunctionLike(host.Type()) {
 * 		return host.Type()
 * 	}
 * 	if IsFunctionLike(host) {
 * 		return host
 * 	}
 * 	return nil
 * }
 */
export function GetHostSignatureFromJSDoc(node: GoPtr<Node>): GoPtr<Node> {
  const host: GoPtr<Node> = GetJSDocHost(node);
  if (host === undefined) {
    return undefined;
  }
  // !!! Strada's getEffectiveJSDocHost applies JS assignment pattern transforms (getSourceOfAssignment, getSourceOfDefaultedAssignment, etc.) not yet ported
  if (IsPropertySignatureDeclaration(host) && Node_Type(host) !== undefined && IsFunctionLike(Node_Type(host))) {
    return Node_Type(host);
  }
  if (IsFunctionLike(host)) {
    return host;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsImportOrImportEqualsDeclaration","kind":"func","status":"implemented","sigHash":"fe92c4a59bb2e708fab26bc270ab1b41f5e2edd988dd8b156e717699fba59da4","bodyHash":"1fba3e81ee31777f279a73bec8622cbfb71896c82d629effe21c1ecbdcf7908a"}
 *
 * Go source:
 * func IsImportOrImportEqualsDeclaration(node *Node) bool {
 * 	return IsImportDeclaration(node) || IsImportEqualsDeclaration(node)
 * }
 */
export function IsImportOrImportEqualsDeclaration(node: GoPtr<Node>): bool {
  return (IsImportDeclaration(node) || IsImportEqualsDeclaration(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPrimitiveLiteralValue","kind":"func","status":"implemented","sigHash":"21cd75c12dd2f8295aa3a6caff80e8c6768b2a22e506e46d8452a3a9014f4b0a","bodyHash":"0afa96ef5fa149dcbc4773b48df682ca579830a4bac15d8e2f955fb3c7a03d29"}
 *
 * Go source:
 * func IsPrimitiveLiteralValue(node *Node, includeBigInt bool) bool {
 * 	switch node.Kind {
 * 	case KindTrueKeyword,
 * 		KindFalseKeyword,
 * 		KindNumericLiteral,
 * 		KindStringLiteral,
 * 		KindNoSubstitutionTemplateLiteral:
 * 		return true
 * 	case KindBigIntLiteral:
 * 		return includeBigInt
 * 	case KindPrefixUnaryExpression:
 * 		if node.AsPrefixUnaryExpression().Operator == KindMinusToken {
 * 			return IsNumericLiteral(node.AsPrefixUnaryExpression().Operand) || (includeBigInt && IsBigIntLiteral(node.AsPrefixUnaryExpression().Operand))
 * 		}
 * 		if node.AsPrefixUnaryExpression().Operator == KindPlusToken {
 * 			return IsNumericLiteral(node.AsPrefixUnaryExpression().Operand)
 * 		}
 * 		return false
 * 	default:
 * 		return false
 * 	}
 * }
 */
export function IsPrimitiveLiteralValue(node: GoPtr<Node>, includeBigInt: bool): bool {
  switch (node!.Kind) {
    case KindTrueKeyword:
    case KindFalseKeyword:
    case KindNumericLiteral:
    case KindStringLiteral:
    case KindNoSubstitutionTemplateLiteral:
      return true as bool;
    case KindBigIntLiteral:
      return includeBigInt;
    case KindPrefixUnaryExpression:
      if (AsPrefixUnaryExpression(node)!.Operator === KindMinusToken) {
        return (IsNumericLiteral(AsPrefixUnaryExpression(node)!.Operand) || (includeBigInt && IsBigIntLiteral(AsPrefixUnaryExpression(node)!.Operand))) as bool;
      }
      if (AsPrefixUnaryExpression(node)!.Operator === KindPlusToken) {
        return IsNumericLiteral(AsPrefixUnaryExpression(node)!.Operand);
      }
      return false as bool;
    default:
      return false as bool;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasInferredType","kind":"func","status":"implemented","sigHash":"1aaa0421409ee7ffb342e963130fc3fa37b41ad7de9bb84b669b9fe3cd95424c","bodyHash":"0c2b0da065ffba90b44df99619138e40a1fec1d0d54d4c162a35557d7bff3cd6"}
 *
 * Go source:
 * func HasInferredType(node *Node) bool {
 * 	// Debug.type<HasInferredType>(node); // !!!
 * 	switch node.Kind {
 * 	case KindParameter,
 * 		KindPropertySignature,
 * 		KindPropertyDeclaration,
 * 		KindBindingElement,
 * 		KindPropertyAccessExpression,
 * 		KindElementAccessExpression,
 * 		KindBinaryExpression,
 * 		KindCallExpression,
 * 		KindVariableDeclaration,
 * 		KindExportAssignment,
 * 		KindPropertyAssignment,
 * 		KindShorthandPropertyAssignment,
 * 		KindJSDocParameterTag,
 * 		KindJSDocPropertyTag:
 * 		return true
 * 	default:
 * 		// assertType<never>(node); // !!!
 * 		return false
 * 	}
 * }
 */
export function HasInferredType(node: GoPtr<Node>): bool {
  // Debug.type<HasInferredType>(node); // !!!
  switch (node!.Kind) {
    case KindParameter:
    case KindPropertySignature:
    case KindPropertyDeclaration:
    case KindBindingElement:
    case KindPropertyAccessExpression:
    case KindElementAccessExpression:
    case KindBinaryExpression:
    case KindCallExpression:
    case KindVariableDeclaration:
    case KindExportAssignment:
    case KindPropertyAssignment:
    case KindShorthandPropertyAssignment:
    case KindJSDocParameterTag:
    case KindJSDocPropertyTag:
      return true as bool;
    default:
      // assertType<never>(node); // !!!
      return false as bool;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsKeyword","kind":"func","status":"implemented","sigHash":"3477d7a58108bede654ef7daf2bad636a31fb61d10aaae8e96925e1293c73485","bodyHash":"77e733a0c15c810bd066e04dfeaa63077d06d36c30b37d61275347c9d59a8663"}
 *
 * Go source:
 * func IsKeyword(token Kind) bool {
 * 	return KindFirstKeyword <= token && token <= KindLastKeyword
 * }
 */
export function IsKeyword(token: Kind): bool {
  return (KindFirstKeyword <= token && token <= KindLastKeyword) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsNonContextualKeyword","kind":"func","status":"implemented","sigHash":"19732cb233b40dc6cc2a7b94eb866e8dd7b54d784e2534fe98d6f8a9f77a29eb","bodyHash":"483fa4d9d57fd171d955b23f58373cfcc5c87446f5ba1ab90f23006deb532af6"}
 *
 * Go source:
 * func IsNonContextualKeyword(token Kind) bool {
 * 	return IsKeyword(token) && !IsContextualKeyword(token)
 * }
 */
export function IsNonContextualKeyword(token: Kind): bool {
  return (IsKeyword(token) && !IsContextualKeyword(token)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasModifier","kind":"func","status":"implemented","sigHash":"c633805bd311319cf40d8fde9ce05c22d2b9423f656f11e429b90ebb2f78b256","bodyHash":"92290a7cc2f4fd1afa0f70fbeafeeebb09c8d4cbe666f6728dba7889720979b3"}
 *
 * Go source:
 * func HasModifier(node *Node, flags ModifierFlags) bool {
 * 	return node.ModifierFlags()&flags != 0
 * }
 */
export function HasModifier(node: GoPtr<Node>, flags: ModifierFlags): bool {
  return ((Node_ModifierFlags(node) & flags) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsExpandoInitializer","kind":"func","status":"implemented","sigHash":"f1987c4f350415ed08ca06d18e171aa6b6e48a74590d187d87088211057d9cf2","bodyHash":"8103a9072a9b02c74c8f6913f02853772779a38b4bd5f21e50089a322401d6f9"}
 *
 * Go source:
 * func IsExpandoInitializer(initializer *Node) bool {
 * 	if initializer == nil {
 * 		return false
 * 	}
 * 	if IsFunctionExpressionOrArrowFunction(initializer) {
 * 		return true
 * 	}
 * 	if IsInJSFile(initializer) {
 * 		return IsClassExpression(initializer) || (IsObjectLiteralExpression(initializer) && len(initializer.Properties()) == 0)
 * 	}
 * 	return false
 * }
 */
export function IsExpandoInitializer(initializer: GoPtr<Node>): bool {
  if (initializer === undefined) {
    return false as bool;
  }
  if (IsFunctionExpressionOrArrowFunction(initializer)) {
    return true as bool;
  }
  if (IsInJSFile(initializer)) {
    return (IsClassExpression(initializer) || (IsObjectLiteralExpression(initializer) && (Node_Properties(initializer)?.length ?? 0) === 0)) as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetContainingFunction","kind":"func","status":"implemented","sigHash":"b2a8015db5599e520148395631c5eccb1a045463d40128232c6294f89a7cde59","bodyHash":"854941191822b019ee81154377d05259c837b191b26034216b3ca323107c4866"}
 *
 * Go source:
 * func GetContainingFunction(node *Node) *Node {
 * 	return FindAncestor(node.Parent, IsFunctionLike)
 * }
 */
export function GetContainingFunction(node: GoPtr<Node>): GoPtr<Node> {
  return FindAncestor(node!.Parent, IsFunctionLike);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::ImportFromModuleSpecifier","kind":"func","status":"implemented","sigHash":"6b6161ceb983cd41dc1b64e8b4259819e2d434b08bb152fd75a2e4bca0c78dd8","bodyHash":"b88444e39046e7393b40bc4da979edd25e0b501ae549ede7723836a2a659b600"}
 *
 * Go source:
 * func ImportFromModuleSpecifier(node *Node) *Node {
 * 	if result := TryGetImportFromModuleSpecifier(node); result != nil {
 * 		return result
 * 	}
 * 	debug.FailBadSyntaxKind(node.Parent)
 * 	return nil
 * }
 */
export function ImportFromModuleSpecifier(node: GoPtr<Node>): GoPtr<Node> {
  const result: GoPtr<Node> = TryGetImportFromModuleSpecifier(node);
  if (result !== undefined) {
    return result;
  }
  FailBadSyntaxKind({ KindString: (): string => Node_KindString(node!.Parent) });
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::TryGetImportFromModuleSpecifier","kind":"func","status":"implemented","sigHash":"3dd329eea3a15053edfe8846d667954010c24fe3e0c15ab53452d334e1b0ec52","bodyHash":"641b95dbaece75a70434e590a1a3f5c997a6463b233d78b816d3ad0ced2e0b62"}
 *
 * Go source:
 * func TryGetImportFromModuleSpecifier(node *StringLiteralLike) *Node {
 * 	switch node.Parent.Kind {
 * 	case KindImportDeclaration, KindJSImportDeclaration, KindExportDeclaration:
 * 		return node.Parent
 * 	case KindExternalModuleReference:
 * 		return node.Parent.Parent
 * 	case KindCallExpression:
 * 		if IsImportCall(node.Parent) || IsRequireCall(node.Parent, false /*requireStringLiteralLikeArgument* /) {
 * 			return node.Parent
 * 		}
 * 		return nil
 * 	case KindLiteralType:
 * 		if !IsStringLiteral(node) {
 * 			return nil
 * 		}
 * 		if IsImportTypeNode(node.Parent.Parent) {
 * 			return node.Parent.Parent
 * 		}
 * 		return nil
 * 	}
 * 	return nil
 * }
 */
export function TryGetImportFromModuleSpecifier(node: GoPtr<StringLiteralLike>): GoPtr<Node> {
  switch (node!.Parent!.Kind) {
    case KindImportDeclaration:
    case KindJSImportDeclaration:
    case KindExportDeclaration:
      return node!.Parent;
    case KindExternalModuleReference:
      return node!.Parent!.Parent;
    case KindCallExpression:
      if (IsImportCall(node!.Parent) || IsRequireCall(node!.Parent, false /*requireStringLiteralLikeArgument*/)) {
        return node!.Parent;
      }
      return undefined;
    case KindLiteralType:
      if (!IsStringLiteral(node)) {
        return undefined;
      }
      if (IsImportTypeNode(node!.Parent!.Parent)) {
        return node!.Parent!.Parent;
      }
      return undefined;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsImplicitlyExportedJSTypeAlias","kind":"func","status":"implemented","sigHash":"46a2509382b24883adf51c0fd51d1647f95dc7d94c5c636f4bdebe158609a8f9","bodyHash":"b04a03e3d14bb63a27e523169d7799863aaea67905abe1d8f36245a2af786ebf"}
 *
 * Go source:
 * func IsImplicitlyExportedJSTypeAlias(node *Node) bool {
 * 	return IsJSTypeAliasDeclaration(node) && IsSourceFile(node.Parent) && IsExternalOrCommonJSModule(node.Parent.AsSourceFile())
 * }
 */
export function IsImplicitlyExportedJSTypeAlias(node: GoPtr<Node>): bool {
  return (IsJSTypeAliasDeclaration(node) && IsSourceFile(node!.Parent) && IsExternalOrCommonJSModule(AsSourceFile(node!.Parent))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasContextSensitiveParameters","kind":"func","status":"implemented","sigHash":"16e399d7cfd0245fb1be06a2e9f328d3f63e3c6c5adf5e225bb43cc8ec77be0d","bodyHash":"b90aaa0f0a3622ec3879c94a19faf74b67c4ab426ae1c0389bbea6240cbfd67b"}
 *
 * Go source:
 * func HasContextSensitiveParameters(node *Node) bool {
 * 	// Functions with type parameters are not context sensitive.
 * 	if node.TypeParameters() == nil {
 * 		// Functions with any parameters that lack type annotations are context sensitive.
 * 		if core.Some(node.Parameters(), func(p *Node) bool { return p.Type() == nil }) {
 * 			return true
 * 		}
 * 		if !IsArrowFunction(node) {
 * 			// If the first parameter is not an explicit 'this' parameter, then the function has
 * 			// an implicit 'this' parameter which is subject to contextual typing.
 * 			parameter := core.FirstOrNil(node.Parameters())
 * 			if parameter == nil || !IsThisParameter(parameter) {
 * 				return node.Flags&NodeFlagsContainsThis != 0
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function HasContextSensitiveParameters(node: GoPtr<Node>): bool {
  // Functions with type parameters are not context sensitive.
  if (Node_TypeParameters(node) === undefined) {
    // Functions with any parameters that lack type annotations are context sensitive.
    if (Some(Node_Parameters(node), (p: GoPtr<Node>): bool => {
      return (Node_Type(p) === undefined) as bool;
    })) {
      return true as bool;
    }
    if (!IsArrowFunction(node)) {
      // If the first parameter is not an explicit 'this' parameter, then the function has
      // an implicit 'this' parameter which is subject to contextual typing.
      const parameter: GoPtr<Node> = FirstOrNil(Node_Parameters(node));
      if (parameter === undefined || !IsThisParameter(parameter)) {
        return ((node!.Flags & NodeFlagsContainsThis) !== 0) as bool;
      }
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsInfinityOrNaNString","kind":"func","status":"implemented","sigHash":"a6df3c96edb19e41d84a2944957e8d382c009c0e61bc186d1d64fc1ad6597f30","bodyHash":"a32b7c5d5bb75c77333c908905ccbc525bbca9eff980ea7e80a7eedfa4f4aa66"}
 *
 * Go source:
 * func IsInfinityOrNaNString(name string) bool {
 * 	return name == "Infinity" || name == "-Infinity" || name == "NaN"
 * }
 */
export function IsInfinityOrNaNString(name: string): bool {
  return (name === "Infinity" || name === "-Infinity" || name === "NaN") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetFirstConstructorWithBody","kind":"func","status":"implemented","sigHash":"d51f9902a589871e704e2e26c84cd697c8ac902dd405279548792b7f8b907ebb","bodyHash":"0fc157a14cb25ced8ae255dde52a7ba9b125b326b95a826b4cdead370b3d95b3"}
 *
 * Go source:
 * func GetFirstConstructorWithBody(node *Node) *Node {
 * 	for _, member := range node.Members() {
 * 		if IsConstructorDeclaration(member) && NodeIsPresent(member.Body()) {
 * 			return member
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function GetFirstConstructorWithBody(node: GoPtr<Node>): GoPtr<Node> {
  for (const member of Node_Members(node) ?? []) {
    if (IsConstructorDeclaration(member) && NodeIsPresent(Node_Body(member))) {
      return member;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsPotentiallyExecutableNode","kind":"func","status":"implemented","sigHash":"9e4dd815d81d1ecdd71a571ab5bf1d897cd35550d8e0acf1a765a2318ffe9046","bodyHash":"4d3c16d37dcf4c706d42a0669f426351a35a1cb6fdaa32661eae9c83c2d96394"}
 *
 * Go source:
 * func IsPotentiallyExecutableNode(node *Node) bool {
 * 	if KindFirstStatement <= node.Kind && node.Kind <= KindLastStatement {
 * 		if IsVariableStatement(node) {
 * 			declarationList := node.AsVariableStatement().DeclarationList
 * 			if GetCombinedNodeFlags(declarationList)&NodeFlagsBlockScoped != 0 {
 * 				return true
 * 			}
 * 			declarations := declarationList.AsVariableDeclarationList().Declarations.Nodes
 * 			return core.Some(declarations, func(d *Node) bool {
 * 				return d.Initializer() != nil
 * 			})
 * 		}
 * 		return true
 * 	}
 * 	return IsClassDeclaration(node) || IsEnumDeclaration(node) || IsModuleDeclaration(node)
 * }
 */
export function IsPotentiallyExecutableNode(node: GoPtr<Node>): bool {
  if (KindFirstStatement <= node!.Kind && node!.Kind <= KindLastStatement) {
    if (IsVariableStatement(node)) {
      const declarationList: GoPtr<Node> = AsVariableStatement(node)!.DeclarationList;
      if ((GetCombinedNodeFlags(declarationList) & NodeFlagsBlockScoped) !== 0) {
        return true as bool;
      }
      const declarations = AsVariableDeclarationList(declarationList)!.Declarations!.Nodes;
      return Some(declarations, (d: GoPtr<Node>): bool => {
        return (Node_Initializer(d) !== undefined) as bool;
      });
    }
    return true as bool;
  }
  return (IsClassDeclaration(node) || IsEnumDeclaration(node) || IsModuleDeclaration(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasAbstractModifier","kind":"func","status":"implemented","sigHash":"3c2f454ae1260fe6a32a467913beeebada54fd4e35f85992da19eca5ef933e27","bodyHash":"ce37e9e523939fe7f567d8a9436d70bffc97cc6019b90e8989e4799026693719"}
 *
 * Go source:
 * func HasAbstractModifier(node *Node) bool {
 * 	return HasSyntacticModifier(node, ModifierFlagsAbstract)
 * }
 */
export function HasAbstractModifier(node: GoPtr<Node>): bool {
  return HasSyntacticModifier(node, ModifierFlagsAbstract);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::HasAmbientModifier","kind":"func","status":"implemented","sigHash":"edf99ab8fc49923878fdf42f16cc58d9316d4d9e828c1c8b7306207c53c99092","bodyHash":"190f6ef626f6b6113d796813483f42e9054a797b3fe6c2602550a810c8c4de26"}
 *
 * Go source:
 * func HasAmbientModifier(node *Node) bool {
 * 	return HasSyntacticModifier(node, ModifierFlagsAmbient)
 * }
 */
export function HasAmbientModifier(node: GoPtr<Node>): bool {
  return HasSyntacticModifier(node, ModifierFlagsAmbient);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::NodeCanBeDecorated","kind":"func","status":"implemented","sigHash":"77c5562c7ceacf0df5e19ae03efdac2ea37209291077985db50d467039987534","bodyHash":"5b1b87624140747e4389e34b91273e7edb6833a54cc74c3a94554a7db3fed4c4"}
 *
 * Go source:
 * func NodeCanBeDecorated(useLegacyDecorators bool, node *Node, parent *Node, grandparent *Node) bool {
 * 	// private names cannot be used with decorators yet
 * 	if useLegacyDecorators && node.Name() != nil && IsPrivateIdentifier(node.Name()) {
 * 		return false
 * 	}
 * 	switch node.Kind {
 * 	case KindClassDeclaration:
 * 		// class declarations are valid targets
 * 		return true
 * 	case KindClassExpression:
 * 		// class expressions are valid targets for native decorators
 * 		return !useLegacyDecorators
 * 	case KindPropertyDeclaration:
 * 		// property declarations are valid if their parent is a class declaration.
 * 		return parent != nil && (useLegacyDecorators && IsClassDeclaration(parent) ||
 * 			!useLegacyDecorators && IsClassLike(parent) && !HasAbstractModifier(node) && !HasAmbientModifier(node))
 * 	case KindGetAccessor, KindSetAccessor, KindMethodDeclaration:
 * 		// if this method has a body and its parent is a class declaration, this is a valid target.
 * 		return parent != nil && node.Body() != nil && (useLegacyDecorators && IsClassDeclaration(parent) ||
 * 			!useLegacyDecorators && IsClassLike(parent))
 * 	case KindParameter:
 * 		// TODO(rbuckton): ParameterDeclaration decorator support for ES decorators must wait until it is standardized
 * 		if !useLegacyDecorators {
 * 			return false
 * 		}
 * 		// if the parameter's parent has a body and its grandparent is a class declaration, this is a valid target.
 * 		return parent != nil && parent.Body() != nil &&
 * 			(parent.Kind == KindConstructor || parent.Kind == KindMethodDeclaration || parent.Kind == KindSetAccessor) &&
 * 			GetThisParameter(parent) != node && grandparent != nil && grandparent.Kind == KindClassDeclaration
 * 	}
 * 
 * 	return false
 * }
 */
export function NodeCanBeDecorated(useLegacyDecorators: bool, node: GoPtr<Node>, parent: GoPtr<Node>, grandparent: GoPtr<Node>): bool {
  // private names cannot be used with decorators yet
  if (useLegacyDecorators && Node_Name(node) !== undefined && IsPrivateIdentifier(Node_Name(node))) {
    return false as bool;
  }
  switch (node!.Kind) {
    case KindClassDeclaration:
      // class declarations are valid targets
      return true as bool;
    case KindClassExpression:
      // class expressions are valid targets for native decorators
      return !useLegacyDecorators as bool;
    case KindPropertyDeclaration:
      // property declarations are valid if their parent is a class declaration.
      return (parent !== undefined && ((useLegacyDecorators && IsClassDeclaration(parent)) ||
        (!useLegacyDecorators && IsClassLike(parent) && !HasAbstractModifier(node) && !HasAmbientModifier(node)))) as bool;
    case KindGetAccessor:
    case KindSetAccessor:
    case KindMethodDeclaration:
      // if this method has a body and its parent is a class declaration, this is a valid target.
      return (parent !== undefined && Node_Body(node) !== undefined && ((useLegacyDecorators && IsClassDeclaration(parent)) ||
        (!useLegacyDecorators && IsClassLike(parent)))) as bool;
    case KindParameter:
      // TODO(rbuckton): ParameterDeclaration decorator support for ES decorators must wait until it is standardized
      if (!useLegacyDecorators) {
        return false as bool;
      }
      // if the parameter's parent has a body and its grandparent is a class declaration, this is a valid target.
      return (parent !== undefined && Node_Body(parent) !== undefined &&
        (parent!.Kind === KindConstructor || parent!.Kind === KindMethodDeclaration || parent!.Kind === KindSetAccessor) &&
        GetThisParameter(parent) !== node && grandparent !== undefined && grandparent!.Kind === KindClassDeclaration) as bool;
  }

  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::ClassOrConstructorParameterIsDecorated","kind":"func","status":"implemented","sigHash":"b6f971b2a5f897b1e2a1454abf408aee9a8ca95e2499d653e2420935fffcfc83","bodyHash":"08ad71dc0a3bd5cff705207c3656cae6dd4fffe43595d64ffdc4aad33008a35c"}
 *
 * Go source:
 * func ClassOrConstructorParameterIsDecorated(useLegacyDecorators bool, node *Node) bool {
 * 	if NodeIsDecorated(useLegacyDecorators, node, nil, nil) {
 * 		return true
 * 	}
 * 	constructor := GetFirstConstructorWithBody(node)
 * 	return constructor != nil && ChildIsDecorated(useLegacyDecorators, constructor, node)
 * }
 */
export function ClassOrConstructorParameterIsDecorated(useLegacyDecorators: bool, node: GoPtr<Node>): bool {
  if (NodeIsDecorated(useLegacyDecorators, node, undefined, undefined)) {
    return true as bool;
  }
  const constructor: GoPtr<Node> = GetFirstConstructorWithBody(node);
  return (constructor !== undefined && ChildIsDecorated(useLegacyDecorators, constructor, node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::ClassElementOrClassElementParameterIsDecorated","kind":"func","status":"implemented","sigHash":"f37ca568238145ebe8a86c02f2cef1b9313da88b33e1267b72712eba2c9f5d3a","bodyHash":"98910a59e98277c0d39ba313ff3ea11995960ddd9d05d207303a6f12c2991583"}
 *
 * Go source:
 * func ClassElementOrClassElementParameterIsDecorated(useLegacyDecorators bool, node *Node, parent *Node) bool {
 * 	var parameters *NodeList
 * 	if IsAccessor(node) {
 * 		decls := GetAllAccessorDeclarations(parent.Members(), node)
 * 		var firstAccessorWithDecorators *Node
 * 		if HasDecorators(decls.FirstAccessor) {
 * 			firstAccessorWithDecorators = decls.FirstAccessor
 * 		} else if HasDecorators(decls.SecondAccessor) {
 * 			firstAccessorWithDecorators = decls.SecondAccessor
 * 		}
 * 		if firstAccessorWithDecorators == nil || node != firstAccessorWithDecorators {
 * 			return false
 * 		}
 * 		if decls.SetAccessor != nil {
 * 			parameters = decls.SetAccessor.Parameters
 * 		}
 * 	} else if IsMethodDeclaration(node) {
 * 		parameters = node.ParameterList()
 * 	}
 * 	if NodeIsDecorated(useLegacyDecorators, node, parent, nil) {
 * 		return true
 * 	}
 * 	if parameters != nil && len(parameters.Nodes) > 0 {
 * 		for _, parameter := range parameters.Nodes {
 * 			if IsThisParameter(parameter) {
 * 				continue
 * 			}
 * 			if NodeIsDecorated(useLegacyDecorators, parameter, node, parent) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function ClassElementOrClassElementParameterIsDecorated(useLegacyDecorators: bool, node: GoPtr<Node>, parent: GoPtr<Node>): bool {
  const paramsResult: [boolean, GoPtr<NodeList>] = (() => {
    if (IsAccessor(node)) {
      const decls: AllAccessorDeclarations = GetAllAccessorDeclarations(Node_Members(parent) ?? [], node);
      const firstAccessorWithDecorators: GoPtr<Node> = HasDecorators(decls.FirstAccessor) ? decls.FirstAccessor
        : HasDecorators(decls.SecondAccessor) ? decls.SecondAccessor
        : undefined;
      if (firstAccessorWithDecorators === undefined || node !== firstAccessorWithDecorators) return [true, undefined];
      return [false, decls.SetAccessor !== undefined ? decls.SetAccessor!.Parameters : undefined];
    }
    if (IsMethodDeclaration(node)) return [false, Node_ParameterList(node)];
    return [false, undefined];
  })();
  const [abort, parameters] = paramsResult;
  if (abort) return false as bool;
  if (NodeIsDecorated(useLegacyDecorators, node, parent, undefined)) {
    return true as bool;
  }
  if (parameters !== undefined && parameters!.Nodes.length > 0) {
    for (const parameter of parameters!.Nodes) {
      if (IsThisParameter(parameter)) {
        continue;
      }
      if (NodeIsDecorated(useLegacyDecorators, parameter, node, parent)) {
        return true as bool;
      }
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::NodeIsDecorated","kind":"func","status":"implemented","sigHash":"94f133cd02bfeaa7fc0c218b7d138cfcf7b5817c22284c7c653af73296ed8ddc","bodyHash":"278918f7d600a440dc2b6014fb25628b2b64ea7ecd045f0210ebbc9041cbb38c"}
 *
 * Go source:
 * func NodeIsDecorated(useLegacyDecorators bool, node *Node, parent *Node, grandparent *Node) bool {
 * 	return HasDecorators(node) && NodeCanBeDecorated(useLegacyDecorators, node, parent, grandparent)
 * }
 */
export function NodeIsDecorated(useLegacyDecorators: bool, node: GoPtr<Node>, parent: GoPtr<Node>, grandparent: GoPtr<Node>): bool {
  return (HasDecorators(node) && NodeCanBeDecorated(useLegacyDecorators, node, parent, grandparent)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::NodeOrChildIsDecorated","kind":"func","status":"implemented","sigHash":"2e4bf893033043039601cb9a30e971084baff7a373380e0e68aff0dcd7f088f1","bodyHash":"cc3619ef9ecc224aee738399ac0abc568d5a7a87b655db2c98b1ac68e4b84bee"}
 *
 * Go source:
 * func NodeOrChildIsDecorated(useLegacyDecorators bool, node *Node, parent *Node, grandparent *Node) bool {
 * 	return NodeIsDecorated(useLegacyDecorators, node, parent, grandparent) || ChildIsDecorated(useLegacyDecorators, node, parent)
 * }
 */
export function NodeOrChildIsDecorated(useLegacyDecorators: bool, node: GoPtr<Node>, parent: GoPtr<Node>, grandparent: GoPtr<Node>): bool {
  return (NodeIsDecorated(useLegacyDecorators, node, parent, grandparent) || ChildIsDecorated(useLegacyDecorators, node, parent)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::ChildIsDecorated","kind":"func","status":"implemented","sigHash":"4015bda9842f19f7f22a95d23520bfb3841f1e0f502b8fd0d05dcd9c9db94ee7","bodyHash":"674e79ec87626b87954f1668d689f897cbf9dc0bca21a9296490ecfbe91f28b7"}
 *
 * Go source:
 * func ChildIsDecorated(useLegacyDecorators bool, node *Node, parent *Node) bool {
 * 	switch node.Kind {
 * 	case KindClassDeclaration, KindClassExpression:
 * 		return core.Some(node.Members(), func(m *Node) bool {
 * 			return NodeOrChildIsDecorated(useLegacyDecorators, m, node, parent)
 * 		})
 * 	case KindMethodDeclaration,
 * 		KindSetAccessor,
 * 		KindConstructor:
 * 		return core.Some(node.Parameters(), func(p *Node) bool {
 * 			return NodeIsDecorated(useLegacyDecorators, p, node, parent)
 * 		})
 * 	default:
 * 		return false
 * 	}
 * }
 */
export function ChildIsDecorated(useLegacyDecorators: bool, node: GoPtr<Node>, parent: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindClassDeclaration:
    case KindClassExpression:
      return Some(Node_Members(node) ?? [], (m: GoPtr<Node>): bool => {
        return NodeOrChildIsDecorated(useLegacyDecorators, m, node, parent);
      });
    case KindMethodDeclaration:
    case KindSetAccessor:
    case KindConstructor:
      return Some(Node_Parameters(node), (p: GoPtr<Node>): bool => {
        return NodeIsDecorated(useLegacyDecorators, p, node, parent);
      });
    default:
      return false as bool;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::type::AllAccessorDeclarations","kind":"type","status":"implemented","sigHash":"74242f0a3419c657591f2f9dead0856023ac4b1afa6588e37cf98519800eb00d","bodyHash":"b2ec59fb7fea7b8aa5b375daebdf9b8018bc1b9fecda306d3b57aa6436201bc1"}
 *
 * Go source:
 * AllAccessorDeclarations struct {
 * 	FirstAccessor  *AccessorDeclaration
 * 	SecondAccessor *AccessorDeclaration
 * 	SetAccessor    *SetAccessorDeclaration
 * 	GetAccessor    *GetAccessorDeclaration
 * }
 */
export interface AllAccessorDeclarations {
  FirstAccessor: GoPtr<AccessorDeclaration>;
  SecondAccessor: GoPtr<AccessorDeclaration>;
  SetAccessor: GoPtr<SetAccessorDeclaration>;
  GetAccessor: GoPtr<GetAccessorDeclaration>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetAllAccessorDeclarationsForDeclaration","kind":"func","status":"implemented","sigHash":"34edb9d8eb794bbef4fc549bd087918140f0358b6082953d0f6f2f85015db536","bodyHash":"f19388cd5eeaf12e9a57dfbb16ad3108e361cec1c96877c25cc751b6f96d4870"}
 *
 * Go source:
 * func GetAllAccessorDeclarationsForDeclaration(accessor *AccessorDeclaration, declarationsOfSymbol []*Node) AllAccessorDeclarations {
 * 	var otherKind Kind
 * 	if accessor.Kind == KindSetAccessor {
 * 		otherKind = KindGetAccessor
 * 	} else if accessor.Kind == KindGetAccessor {
 * 		otherKind = KindSetAccessor
 * 	} else {
 * 		panic(fmt.Sprintf("Unexpected node kind %q", accessor.Kind))
 * 	}
 * 	// otherAccessor := GetDeclarationOfKind(c.getSymbolOfDeclaration(accessor), otherKind)
 * 	var otherAccessor *AccessorDeclaration
 * 	for _, d := range declarationsOfSymbol {
 * 		if d.Kind == otherKind {
 * 			otherAccessor = d
 * 			break
 * 		}
 * 	}
 * 
 * 	var firstAccessor *AccessorDeclaration
 * 	var secondAccessor *AccessorDeclaration
 * 	if otherAccessor != nil && (otherAccessor.Pos() < accessor.Pos()) {
 * 		firstAccessor = otherAccessor
 * 		secondAccessor = accessor
 * 	} else {
 * 		firstAccessor = accessor
 * 		secondAccessor = otherAccessor
 * 	}
 * 
 * 	var setAccessor *SetAccessorDeclaration
 * 	var getAccessor *GetAccessorDeclaration
 * 	if accessor.Kind == KindSetAccessor {
 * 		setAccessor = accessor.AsSetAccessorDeclaration()
 * 		if otherAccessor != nil {
 * 			getAccessor = otherAccessor.AsGetAccessorDeclaration()
 * 		}
 * 	} else {
 * 		getAccessor = accessor.AsGetAccessorDeclaration()
 * 		if otherAccessor != nil {
 * 			setAccessor = otherAccessor.AsSetAccessorDeclaration()
 * 		}
 * 	}
 * 
 * 	return AllAccessorDeclarations{
 * 		FirstAccessor:  firstAccessor,
 * 		SecondAccessor: secondAccessor,
 * 		SetAccessor:    setAccessor,
 * 		GetAccessor:    getAccessor,
 * 	}
 * }
 */
export function GetAllAccessorDeclarationsForDeclaration(accessor: GoPtr<AccessorDeclaration>, declarationsOfSymbol: GoSlice<GoPtr<Node>>): AllAccessorDeclarations {
  const otherKind: Kind = accessor!.Kind === KindSetAccessor ? KindGetAccessor
    : accessor!.Kind === KindGetAccessor ? KindSetAccessor
    : (() => { throw new globalThis.Error("Unexpected node kind " + KindString(accessor!.Kind)); })();
  // otherAccessor := GetDeclarationOfKind(c.getSymbolOfDeclaration(accessor), otherKind)
  const otherAccessor: GoPtr<AccessorDeclaration> = (declarationsOfSymbol ?? []).find(d => d!.Kind === otherKind) as GoPtr<AccessorDeclaration>;
  const [firstAccessor, secondAccessor]: [GoPtr<AccessorDeclaration>, GoPtr<AccessorDeclaration>] =
    otherAccessor !== undefined && Node_Pos(otherAccessor) < Node_Pos(accessor)
      ? [otherAccessor, accessor]
      : [accessor, otherAccessor];
  const [setAccessor, getAccessor]: [GoPtr<SetAccessorDeclaration>, GoPtr<GetAccessorDeclaration>] =
    accessor!.Kind === KindSetAccessor
      ? [AsSetAccessorDeclaration(accessor), otherAccessor !== undefined ? AsGetAccessorDeclaration(otherAccessor) : undefined]
      : [otherAccessor !== undefined ? AsSetAccessorDeclaration(otherAccessor) : undefined, AsGetAccessorDeclaration(accessor)];
  return { FirstAccessor: firstAccessor, SecondAccessor: secondAccessor, SetAccessor: setAccessor, GetAccessor: getAccessor };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetAllAccessorDeclarations","kind":"func","status":"implemented","sigHash":"e1ff7dd9719d21b6bf8849a431211b8ad3be0ed94f5a3cef57c72fc88f6d4e3a","bodyHash":"27c1506bedf026c70c998607cf4d586d755ab59fcf28e0831f5ef62f867b3f75"}
 *
 * Go source:
 * func GetAllAccessorDeclarations(parentDeclarations []*Node, accessor *AccessorDeclaration) AllAccessorDeclarations {
 * 	if HasDynamicName(accessor) {
 * 		// dynamic names can only be match up via checker symbol lookup, just return an object with just this accessor
 * 		return GetAllAccessorDeclarationsForDeclaration(accessor, []*Node{accessor})
 * 	}
 * 
 * 	accessorName := GetPropertyNameForPropertyNameNode(accessor.Name())
 * 	accessorStatic := IsStatic(accessor)
 * 	var matches []*Node
 * 	for _, member := range parentDeclarations {
 * 		if !IsAccessor(member) || IsStatic(member) != accessorStatic {
 * 			continue
 * 		}
 * 		memberName := GetPropertyNameForPropertyNameNode(member.Name())
 * 		if memberName == accessorName {
 * 			matches = append(matches, member)
 * 		}
 * 	}
 * 	return GetAllAccessorDeclarationsForDeclaration(accessor, matches)
 * }
 */
export function GetAllAccessorDeclarations(parentDeclarations: GoSlice<GoPtr<Node>>, accessor: GoPtr<AccessorDeclaration>): AllAccessorDeclarations {
  if (HasDynamicName(accessor)) {
    // dynamic names can only be match up via checker symbol lookup, just return an object with just this accessor
    return GetAllAccessorDeclarationsForDeclaration(accessor, [accessor]);
  }

  const accessorName: string = GetPropertyNameForPropertyNameNode(Node_Name(accessor));
  const accessorStatic: bool = IsStatic(accessor);
  const matches: GoSlice<GoPtr<Node>> = parentDeclarations.filter(member =>
    IsAccessor(member) && IsStatic(member) === accessorStatic &&
    GetPropertyNameForPropertyNameNode(Node_Name(member)) === accessorName
  );
  return GetAllAccessorDeclarationsForDeclaration(accessor, matches);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsAsyncFunction","kind":"func","status":"implemented","sigHash":"edf28d98657bd4ca2b59ce980dacfda22533c81358020ffc0f96c4d54fc9db88","bodyHash":"3a84f556aaad98cde3935c7ade277a1a5de4f5763971b32b33c53d9bb9813be3"}
 *
 * Go source:
 * func IsAsyncFunction(node *Node) bool {
 * 	switch node.Kind {
 * 	case KindFunctionDeclaration, KindFunctionExpression, KindArrowFunction, KindMethodDeclaration:
 * 		data := node.BodyData()
 * 		return data.Body != nil && data.AsteriskToken == nil && HasSyntacticModifier(node, ModifierFlagsAsync)
 * 	}
 * 	return false
 * }
 */
export function IsAsyncFunction(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindFunctionDeclaration:
    case KindFunctionExpression:
    case KindArrowFunction:
    case KindMethodDeclaration: {
      const data: GoPtr<BodyBaseType> = Node_BodyData(node);
      return (data!.Body !== undefined && data!.AsteriskToken === undefined && HasSyntacticModifier(node, ModifierFlagsAsync)) as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetRestParameterElementType","kind":"func","status":"implemented","sigHash":"a853dd6d5e174c3cb714fcacd5861ba7d090abd1fd8ddc90f9f004bb11911035","bodyHash":"bdb8ad86dddfbd00a2e2db229033f601d08d71783f9b6d837eba6624e0ac2364"}
 *
 * Go source:
 * func GetRestParameterElementType(node *ParameterDeclarationNode) *Node {
 * 	if node == nil {
 * 		return node
 * 	}
 * 	if node.Kind == KindArrayType {
 * 		return node.AsArrayTypeNode().ElementType
 * 	}
 * 	if node.Kind == KindTypeReference && node.AsTypeReferenceNode().TypeArguments != nil {
 * 		return core.FirstOrNil(node.AsTypeReferenceNode().TypeArguments.Nodes)
 * 	}
 * 	return nil
 * }
 */
export function GetRestParameterElementType(node: GoPtr<ParameterDeclarationNode>): GoPtr<Node> {
  if (node === undefined) {
    return node;
  }
  if (node!.Kind === KindArrayType) {
    return AsArrayTypeNode(node)!.ElementType;
  }
  if (node!.Kind === KindTypeReference && AsTypeReferenceNode(node)!.TypeArguments !== undefined) {
    return FirstOrNil(AsTypeReferenceNode(node)!.TypeArguments!.Nodes);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::TagNamesAreEquivalent","kind":"func","status":"implemented","sigHash":"a429dd1c895ab818116e83ade676fc237bb1e6c1204e26b78ff5a60e56e6ec61","bodyHash":"ef790bd95d9e677e85ad706ac26b812f60ffacadca5f55887e66333fe5701140"}
 *
 * Go source:
 * func TagNamesAreEquivalent(lhs *Expression, rhs *Expression) bool {
 * 	if lhs.Kind != rhs.Kind {
 * 		return false
 * 	}
 * 	switch lhs.Kind {
 * 	case KindIdentifier:
 * 		return lhs.Text() == rhs.Text()
 * 	case KindThisKeyword:
 * 		return true
 * 	case KindJsxNamespacedName:
 * 		return lhs.AsJsxNamespacedName().Namespace.Text() == rhs.AsJsxNamespacedName().Namespace.Text() &&
 * 			lhs.AsJsxNamespacedName().Name().Text() == rhs.AsJsxNamespacedName().Name().Text()
 * 	case KindPropertyAccessExpression:
 * 		return lhs.AsPropertyAccessExpression().Name().Text() == rhs.AsPropertyAccessExpression().Name().Text() &&
 * 			TagNamesAreEquivalent(lhs.Expression(), rhs.Expression())
 * 	}
 * 	panic("Unhandled case in TagNamesAreEquivalent")
 * }
 */
export function TagNamesAreEquivalent(lhs: GoPtr<Expression>, rhs: GoPtr<Expression>): bool {
  if (lhs!.Kind !== rhs!.Kind) {
    return false as bool;
  }
  switch (lhs!.Kind) {
    case KindIdentifier:
      return (Node_Text(lhs) === Node_Text(rhs)) as bool;
    case KindThisKeyword:
      return true as bool;
    case KindJsxNamespacedName:
      return (Node_Text(AsJsxNamespacedName(lhs)!.Namespace) === Node_Text(AsJsxNamespacedName(rhs)!.Namespace) &&
        Node_Text(Node_Name(lhs)) === Node_Text(Node_Name(rhs))) as bool;
    case KindPropertyAccessExpression:
      return (Node_Text(Node_Name(lhs)) === Node_Text(Node_Name(rhs)) &&
        TagNamesAreEquivalent(Node_Expression(lhs), Node_Expression(rhs))) as bool;
  }
  throw new globalThis.Error("Unhandled case in TagNamesAreEquivalent");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsTagName","kind":"func","status":"implemented","sigHash":"b081a238b6ca3795c5e0e7ad018f795fba584316a39c41ab2efd5d400f5c7cde","bodyHash":"dda7b9b03c4aaedf931a21b7a48d20416eb07cc9a4eb87691d9b6fe1715c8d3e"}
 *
 * Go source:
 * func IsTagName(node *Node) bool {
 * 	return node.Parent != nil && IsJSDocTag(node.Parent) && node.Parent.TagName() == node
 * }
 */
export function IsTagName(node: GoPtr<Node>): bool {
  return (node!.Parent !== undefined && IsJSDocTag(node!.Parent) && Node_TagName(node!.Parent) === node) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::literalIsName","kind":"func","status":"implemented","sigHash":"9adbace33733341019b02281c3a8f0a6dc44756cffe2de19060b2c7b4e61afb0","bodyHash":"4d9ad948e22b10164a91e77cb61ec7b7b8f12c4d527f4bfc387ef6d4d70e53a0"}
 *
 * Go source:
 * func literalIsName(node *Node) bool {
 * 	return IsDeclarationName(node) ||
 * 		node.Parent.Kind == KindExternalModuleReference ||
 * 		isArgumentOfElementAccessExpression(node) ||
 * 		IsLiteralComputedPropertyDeclarationName(node)
 * }
 */
export function literalIsName(node: GoPtr<Node>): bool {
  return (IsDeclarationName(node) ||
    node!.Parent!.Kind === KindExternalModuleReference ||
    isArgumentOfElementAccessExpression(node) ||
    IsLiteralComputedPropertyDeclarationName(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::isArgumentOfElementAccessExpression","kind":"func","status":"implemented","sigHash":"be4ff20835f53d1edf9b2a2d80643a041a87301bfee5d4e7cc9c2d419003fbbe","bodyHash":"2bf8e3fdc86c2079a618af35d2abef4e80ca97e91ffe84502e2cc74dbbfb07b9"}
 *
 * Go source:
 * func isArgumentOfElementAccessExpression(node *Node) bool {
 * 	return node != nil && node.Parent != nil &&
 * 		node.Parent.Kind == KindElementAccessExpression &&
 * 		node.Parent.AsElementAccessExpression().ArgumentExpression == node
 * }
 */
export function isArgumentOfElementAccessExpression(node: GoPtr<Node>): bool {
  return (node !== undefined && node!.Parent !== undefined &&
    node!.Parent!.Kind === KindElementAccessExpression &&
    AsElementAccessExpression(node!.Parent)!.ArgumentExpression === node) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::GetReparsedNodeForNode","kind":"func","status":"implemented","sigHash":"33182eaca71399f8833fe8133c79d1c8a540f4b40952a02af9d50ebc2a535974","bodyHash":"449322e8c80f92228388b09e38a9423d954e9aef8b039f3965e8f8239aafe595"}
 *
 * Go source:
 * func GetReparsedNodeForNode(node *Node) *Node {
 * 	if node != nil && node.Flags&NodeFlagsJSDoc != 0 && node.Flags&NodeFlagsReparsed == 0 {
 * 		if file := GetSourceFileOfNode(node); file != nil && len(file.ReparsedClones) != 0 {
 * 			pos, found := slices.BinarySearchFunc(file.ReparsedClones, node, CompareNodePositions)
 * 			if !found && pos > 0 {
 * 				pos--
 * 			}
 * 			candidate := file.ReparsedClones[pos]
 * 			if node.Loc.ContainedBy(candidate.Loc) {
 * 				if reparsed := findCloneInNode(candidate, node); reparsed != nil {
 * 					return reparsed
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return node
 * }
 */
export function GetReparsedNodeForNode(node: GoPtr<Node>): GoPtr<Node> {
  if (node !== undefined && (node!.Flags & NodeFlagsJSDoc) !== 0 && (node!.Flags & NodeFlagsReparsed) === 0) {
    const file: GoPtr<SourceFile> = GetSourceFileOfNode(node);
    if (file !== undefined && file!.ReparsedClones.length !== 0) {
      const [rawPos, found] = slices.BinarySearchFunc(file!.ReparsedClones, node, CompareNodePositions);
      const pos: int = (!found && rawPos > 0) ? (rawPos - 1) as int : rawPos;
      const candidate: GoPtr<Node> = file!.ReparsedClones[pos];
      if (TextRange_ContainedBy(node!.Loc, candidate!.Loc)) {
        const reparsed: GoPtr<Node> = findCloneInNode(candidate, node);
        if (reparsed !== undefined) {
          return reparsed;
        }
      }
    }
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::findCloneInNode","kind":"func","status":"implemented","sigHash":"288ea193ef7f00188a9ad5d9a44065852e747b04892e94d720563576ed65b7c4","bodyHash":"93258006ae0b33e5f6050c706d5d1cdd23b0aa98d50bdd2ab931a8640561c749"}
 *
 * Go source:
 * func findCloneInNode(node *Node, original *Node) *Node {
 * 	for {
 * 		if node.Kind == original.Kind && node.Loc == original.Loc {
 * 			return node
 * 		}
 * 		foundContainingChild := node.ForEachChild(func(n *Node) bool {
 * 			if original.Loc.ContainedBy(n.Loc) {
 * 				node = n
 * 				return true
 * 			}
 * 			return false
 * 		})
 * 		if !foundContainingChild {
 * 			return nil
 * 		}
 * 	}
 * }
 */
export function findCloneInNode(node: GoPtr<Node>, original: GoPtr<Node>): GoPtr<Node> {
  const loop = (current: GoPtr<Node>): GoPtr<Node> => {
    if (current!.Kind === original!.Kind &&
      TextRange_Pos(current!.Loc) === TextRange_Pos(original!.Loc) &&
      TextRange_End(current!.Loc) === TextRange_End(original!.Loc)) {
      return current;
    }
    const container = { next: undefined as GoPtr<Node> };
    const foundContainingChild: bool = Node_ForEachChild(current, (n: GoPtr<Node>): bool => {
      if (TextRange_ContainedBy(original!.Loc, n!.Loc)) {
        container.next = n;
        return true as bool;
      }
      return false as bool;
    });
    if (!foundContainingChild) return undefined;
    return loop(container.next!);
  };
  return loop(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsExpandoPropertyDeclaration","kind":"func","status":"implemented","sigHash":"60ba98efc89b2a16bd3af60566d51c0ce07298363191fdb41156120f2c706d3e","bodyHash":"729f31d0969a5c058134044da05019905af99d48056c26bc2a57f5c8d8ede4bd"}
 *
 * Go source:
 * func IsExpandoPropertyDeclaration(node *Node) bool {
 * 	return node != nil && IsBinaryExpression(node)
 * }
 */
export function IsExpandoPropertyDeclaration(node: GoPtr<Node>): bool {
  return (node !== undefined && IsBinaryExpression(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/utilities.go::func::IsSuperProperty","kind":"func","status":"implemented","sigHash":"d14f0a96cb38a995f3f2aaf87ed567303bb31f319b2c7e7d2100631afb999e6e","bodyHash":"9e8d1e3d6ad6800b110249e6869fb9ece0599418149a72415a462dd67eb4d9fb"}
 *
 * Go source:
 * func IsSuperProperty(node *Node) bool {
 * 	return (IsPropertyAccessExpression(node) || IsElementAccessExpression(node)) &&
 * 		node.Expression().Kind == KindSuperKeyword
 * }
 */
export function IsSuperProperty(node: GoPtr<Node>): bool {
  return ((IsPropertyAccessExpression(node) || IsElementAccessExpression(node)) &&
    Node_Expression(node)!.Kind === KindSuperKeyword) as bool;
}
