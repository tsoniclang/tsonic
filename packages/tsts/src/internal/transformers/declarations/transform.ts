import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSeq, GoSlice } from "../../../go/compat.js";
import type { CommentRange, FileReference, ModifierList, Node, SourceFile } from "../../ast/ast.js";
import { SourceFile_Text, SourceFile_FileName, AsSourceFile, SourceFile_IsJS, Node_Symbol, Node_Initializer, Node_Type, Node_Expression, Node_Parameters, Node_ParameterList, Node_Elements, Node_IsTypeOnly, Node_ModuleSpecifier, NodeFactory_NewModifier, Node_Text, NodeFactory_UpdateClassDeclaration, NodeFactory_UpdateExpressionWithTypeArguments, Node_Arguments, NodeFactory_UpdateFunctionDeclaration, Node_StatementList, NodeFactory_UpdateSourceFile } from "../../ast/ast.js";
import type { BinaryExpression, BindingElement, BindingPattern, CallSignatureDeclaration, ClassDeclaration, ClassElementList, ConditionalTypeNode, ConstructorDeclaration, ConstructorTypeNode, ConstructSignatureDeclaration, Declaration, EnumDeclaration, ExpressionWithTypeArguments, FunctionDeclaration, FunctionTypeNode, GetAccessorDeclaration, HeritageClause, HeritageClauseList, ImportDeclaration, ImportEqualsDeclaration, ImportTypeNode, IndexSignatureDeclaration, InterfaceDeclaration, JSDocAllType, JSDocNonNullableType, JSDocNullableType, JSDocOptionalType, JSDocParameterOrPropertyTag, JSDocTypeExpression, JSDocTypeLiteral, JSDocVariadicType, LiteralTypeNode, MappedTypeNode, MethodDeclaration, MethodSignatureDeclaration, ModuleDeclaration, NodeFactory, ParameterDeclaration, ParameterList, PropertyDeclaration, PropertySignatureDeclaration, SetAccessorDeclaration, StatementList, TokenNode, TypeAliasDeclaration, TypeParameterDeclaration, TypeParameterList, TypeReferenceNode, VariableDeclaration, VariableDeclarationList, VariableStatement, ExportSpecifierList, VariableDeclarationNodeList, VariableDeclarationListNode } from "../../ast/ast_generated.js";
import { AsIdentifier, AsParameterDeclaration, AsBinaryExpression, AsBindingElement, AsBindingPattern, AsClassDeclaration, AsConstructorDeclaration, AsEnumMember, AsExpressionWithTypeArguments, AsFunctionDeclaration, AsGetAccessorDeclaration, AsHeritageClause, AsImportClause, AsImportDeclaration, AsInterfaceDeclaration, AsModuleBlock, AsModuleDeclaration, AsNamedImports, AsSetAccessorDeclaration, AsSyntaxList, AsTypeAliasDeclaration, AsVariableDeclarationList, AsFunctionExpression, AsArrowFunction, AsEnumDeclaration, AsExternalModuleReference, AsLiteralTypeNode, AsExportDeclaration, AsExportAssignment, AsVariableStatement, AsImportEqualsDeclaration, AsElementAccessExpression, NewExportDeclaration, NewNamedExports, NewTypeLiteralNode, NewUnionTypeNode, NewArrayTypeNode, NewKeywordTypeNode, NewKeywordExpression, NewLiteralTypeNode, NewToken, NewBindingPattern, NewIdentifier, NewPrivateIdentifier, NewPropertyDeclaration, NewVariableDeclaration, NewVariableDeclarationList, NewVariableStatement, NodeFactory_UpdateVariableDeclaration, NewExportAssignment, NewSyntaxList, NewModuleDeclaration, NewModuleBlock, NewPropertySignatureDeclaration, NewParameterDeclaration, NewExportSpecifier, NewFunctionDeclaration, NewPrefixUnaryExpression, NewNumericLiteral, NewStringLiteral, NewHeritageClause, NewExpressionWithTypeArguments, NewNamedImports, NewImportDeclaration, NewImportClause, NewImportEqualsDeclaration, NewExternalModuleReference, NewEnumMember, NewClassDeclaration, NewConstructorDeclaration, NewInterfaceDeclaration, NewMethodDeclaration, NewMethodSignatureDeclaration, NewConstructSignatureDeclaration, NewCallSignatureDeclaration, NewIndexSignatureDeclaration, NewGetAccessorDeclaration, NewSetAccessorDeclaration, NewTypeParameterDeclaration, NewMappedTypeNode, NewConstructorTypeNode, NewFunctionTypeNode, NewConditionalTypeNode, NewImportTypeNode, NewBindingElement, NewTypeAliasDeclaration, NewEnumDeclaration } from "../../ast/ast_generated.js";
import { KindSyntaxList, KindParameter, KindGlobalKeyword, KindNamespaceKeyword, KindModuleBlock, KindAnyKeyword, KindUndefinedKeyword, KindNullKeyword, KindExclamationToken, KindQuestionToken, KindDeclareKeyword, KindExportKeyword, KindMinusToken, KindImportDeclaration, KindJSImportDeclaration, KindImportEqualsDeclaration, KindModuleDeclaration, KindTypeLiteral, KindMappedType, KindTypeAliasDeclaration, KindJSTypeAliasDeclaration, KindJsxText, KindSourceFile, KindSemicolonClassElement, KindFunctionDeclaration, KindInterfaceDeclaration, KindClassDeclaration, KindEnumDeclaration, KindVariableStatement, KindExportDeclaration, KindExportAssignment, KindBreakStatement, KindContinueStatement, KindDebuggerStatement, KindDoStatement, KindEmptyStatement, KindForInStatement, KindForOfStatement, KindForStatement, KindIfStatement, KindLabeledStatement, KindReturnStatement, KindSwitchStatement, KindThrowStatement, KindTryStatement, KindWhileStatement, KindWithStatement, KindNotEmittedStatement, KindBlock, KindMissingDeclaration, KindExpressionStatement, KindHeritageClause, KindMethodSignature, KindMethodDeclaration, KindConstructSignature, KindConstructor, KindGetAccessor, KindSetAccessor, KindPropertyDeclaration, KindPropertySignature, KindCallSignature, KindIndexSignature, KindVariableDeclaration, KindTypeParameter, KindExpressionWithTypeArguments, KindTypeReference, KindConditionalType, KindFunctionType, KindConstructorType, KindImportType, KindTypeQuery, KindTupleType, KindJSDocTypeExpression, KindJSDocTypeLiteral, KindJSDocPropertyTag, KindJSDocAllType, KindJSDocNullableType, KindJSDocNonNullableType, KindJSDocOptionalType, KindJSDocVariadicType, KindMappedType as KindMappedTypeKind, KindExtendsKeyword, KindIdentifier, KindOmittedExpression, KindArrayBindingPattern, KindObjectBindingPattern, KindBindingElement, KindStaticKeyword, KindUnknown, KindDefaultKeyword, KindExternalModuleReference, KindDeferKeyword, KindNamespaceImport, KindFunctionExpression, KindArrowFunction } from "../../ast/generated/kinds.js";
import { IsBinaryExpression, IsIdentifier, IsPrivateIdentifier, IsSourceFile, IsOmittedExpression, IsImportEqualsDeclaration, IsPropertyAccessExpression, IsElementAccessExpression, IsVariableDeclaration, IsStringLiteral, IsComputedPropertyName, IsObjectLiteralExpression, IsTypeLiteralNode, IsParameterDeclaration, IsSetAccessorDeclaration, IsClassDeclaration, IsInterfaceDeclaration, IsFunctionDeclaration, IsExportAssignment, IsBindingElement, IsArrowFunction, IsFunctionExpression, IsJSTypeAliasDeclaration, IsModuleDeclaration } from "../../ast/generated/predicates.js";
import { ModifierFlagsAll, ModifierFlagsPrivate, ModifierFlagsExport, ModifierFlagsDefault, ModifierFlagsAmbient, ModifierFlagsNone, ModifierFlagsParameterPropertyModifier, ModifierFlagsPublic, ModifierFlagsAsync, ModifierFlagsOverride } from "../../ast/modifierflags.js";
import { NodeFlagsConst, NodeFlagsNone, NodeFlagsAmbient, NodeFlagsReparsed, SymbolFlagsAssignment } from "../../ast/generated/flags.js";
import { GetNodeId, IsParseTreeNode, IsExternalOrCommonJSModule, IsInJSFile, IsExpandoPropertyDeclaration, IsDeclaration, HasDynamicName, IsEntityNameExpression, IsEntityName, IsFunctionLike, NodeIsPresent, GetCombinedModifierFlags, CreateModifiersFromModifierFlags, ReplaceModifiers, GetThisParameter, GetAssignmentDeclarationKind, GetElementOrPropertyAccessName, GetLeftmostAccessExpression, GetExternalModuleImportEqualsDeclarationExpression, IsLateVisibilityPaintedStatement, IsExternalModuleIndicator, IsGlobalScopeAugmentation, IsVarUsing, IsVarAwaitUsing, HasSyntacticModifier, HasInferredType, IsFunctionExpressionOrArrowFunction, IsPrimitiveLiteralValue, IsNonContextualKeyword, IsLiteralImportTypeNode, IsImplicitlyExportedJSTypeAlias, CanHaveModifiers, GetFirstConstructorWithBody, JSDeclarationKindModuleExports, JSDeclarationKindExportsProperty, JSDeclarationKindProperty, JSDeclarationKindObjectDefinePropertyExports, IsModifier, IsBindingPattern } from "../../ast/utilities.js";
import { InternalSymbolNameExportEquals } from "../../ast/symbol.js";
import type { Symbol as AstSymbol } from "../../ast/symbol.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import type { NodeId } from "../../ast/ids.js";
import type { ModifierFlags } from "../../ast/modifierflags.js";
import { Node_Name, Node_Modifiers, NodeFactory_NewNodeList, NodeFactory_AsNodeFactory, Node_FunctionLikeData, updateNode, NodeFactory_NewModifierList, cloneNode, Node_DeclarationData, Node_LocalsContainerData, Node_Pos, Node_End } from "../../ast/spine.js";
import type { Set } from "../../collections/set.js";
import { Set_Has, Set_Add } from "../../collections/set.js";
import type { CompilerOptions, ResolutionMode } from "../../core/compileroptions.js";
import { ResolutionModeNone } from "../../core/compileroptions.js";
import { Filter, Map, Some, MapNonNil, IfElse } from "../../core/core.js";
import { NewTextRange } from "../../core/text.js";
import { TokenFlagsNone } from "../../ast/tokenflags.js";
import { Number_String } from "../../jsnum/string.js";
import { LanguageVariantStandard } from "../../core/languagevariant.js";
import type { ModuleSpecifierGenerationHost } from "../../modulespecifiers/types.js";
import type { EmitContext } from "../../printer/emitcontext.js";
import { EmitContext_MostOriginal, EmitContext_ParseNode, EmitContext_AddEmitFlags, EmitContext_AssignCommentRange, EmitContext_SetOriginal, EmitContext_SetCommentRange, EmitContext_NewNodeVisitor } from "../../printer/emitcontext.js";
import type { AutoGenerateOptions } from "../../printer/emitcontext.js";
import { EFSingleLine, EFNoComments } from "../../printer/emitflags.js";
import { GeneratedIdentifierFlagsOptimistic } from "../../printer/generatedidentifierflags.js";
import { NodeFactory_NewUniqueNameEx, NodeFactory_NewGeneratedNameForNode } from "../../printer/factory.js";
import type { EmitResolver, SymbolAccessibilityResult } from "../../printer/emitresolver.js";
import { GetDirectoryPath, NormalizeSlashes, GetRelativePathToDirectoryOrUrl } from "../../tspath/path.js";
import type { ComparePathsOptions } from "../../tspath/path.js";
import { GetLeadingCommentRanges, GetTrailingCommentRanges, SkipTriviaEx, StringToToken } from "../../scanner/scanner.js";
import type { SkipTriviaOptions } from "../../scanner/scanner.js";
import { IsIdentifierText } from "../../scanner/utilities.js";
import type { Transformer } from "../transformer.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_Visitor, Transformer_NewTransformer } from "../transformer.js";
import { IsOriginalNodeSingleLine } from "../utilities.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../../ast/visitor.js";
import { NodeVisitor_VisitNode, NodeVisitor_VisitNodes, NodeVisitor_VisitEachChild, NodeVisitor_VisitSlice } from "../../ast/visitor.js";
import { AsMappedTypeNode, AsMethodSignatureDeclaration, AsMethodDeclaration, AsConstructSignatureDeclaration, AsPropertyDeclaration, AsPropertySignatureDeclaration, AsCallSignatureDeclaration, AsIndexSignatureDeclaration, AsVariableDeclaration, AsTypeParameterDeclaration, AsTypeReferenceNode, AsConditionalTypeNode, AsFunctionTypeNode, AsConstructorTypeNode, AsImportTypeNode, AsTypeQueryNode, AsJSDocTypeExpression, AsJSDocTypeLiteral, AsJSDocParameterOrPropertyTag, AsJSDocAllType, AsJSDocNullableType, AsJSDocNonNullableType, AsJSDocOptionalType, AsJSDocVariadicType } from "../../ast/generated/casts.js";
import { FlagsMultilineObjectLiterals, FlagsWriteClassExpressionAsTypeLiteral, FlagsUseTypeOfFunction, FlagsUseStructuralFallback, FlagsAllowEmptyTuple, FlagsGenerateNamesForShadowedTypeParams, FlagsNoTruncation, InternalFlagsAllowUnresolvedNames, InternalFlagsNoSyntacticPrinter } from "../../nodebuilder/types.js";
import type { InternalFlags } from "../../nodebuilder/types.js";
import { NewSymbolTracker } from "./tracker.js";
import type { SymbolAccessibilityDiagnostic } from "./diagnostics.js";
import { createGetSymbolAccessibilityDiagnosticForNode, createGetSymbolAccessibilityDiagnosticForNodeName, type GetSymbolAccessibilityDiagnostic } from "./diagnostics.js";
import { createDiagnosticForNode, SymbolTrackerImpl_handleSymbolAccessibilityError, SymbolTrackerImpl_PushErrorFallbackNode, SymbolTrackerImpl_PopErrorFallbackNode, SymbolTrackerImpl_ReportInferenceFallback, SymbolTrackerSharedState_addDiagnostic, SymbolTrackerImpl_AsSymbolTracker } from "./tracker.js";
import type { SymbolTrackerImpl, SymbolTrackerSharedState } from "./tracker.js";
import { canHaveLiteralInitializer, canProduceDiagnostics, isDeclarationAndNotVisible, getBindingNameVisible, isEnclosingDeclaration, isAlwaysType, maskModifierFlags, unwrapParenthesizedExpression, isPrivateMethodTypeParameter, shouldEmitFunctionProperties, getEffectiveBaseTypeNode, needsScopeMarker, hasScopeMarker } from "./util.js";
import * as diagnosticMessages from "../../diagnostics/generated/messages.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::type::ReferencedFilePair","kind":"type","status":"implemented","sigHash":"1acae0a7e39042fd1870c208a4ed0078a626c88d9ad3c80e264bb4445390836a","bodyHash":"b90a2a9433bdd7e7e02b84c509b86299da137c99482ab84ebf78404b296f3108"}
 *
 * Go source:
 * ReferencedFilePair struct {
 * 	file *ast.SourceFile
 * 	ref  *ast.FileReference
 * }
 */
export interface ReferencedFilePair {
  file: GoPtr<SourceFile>;
  ref: GoPtr<FileReference>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::type::OutputPaths","kind":"type","status":"implemented","sigHash":"12dad327796b8bc7fdd5e7089ee0ae7228f4b443779f8e9ad460d1c08c905d32","bodyHash":"563b0199334cb533055845c1694f19e4fe4fe9fc06381b82e13a4ca602c31b8d"}
 *
 * Go source:
 * OutputPaths interface {
 * 	DeclarationFilePath() string
 * 	JsFilePath() string
 * }
 */
export interface OutputPaths {
  DeclarationFilePath(): string;
  JsFilePath(): string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::type::DeclarationEmitHost","kind":"type","status":"implemented","sigHash":"f906952086e862b5a37485a7bfe1d0b8e89579bd11448f1e474932c59e132858","bodyHash":"b4046b2a7859a1e6801a4215cc01db542635f8530ba0a86bbdc839fdfe08e721"}
 *
 * Go source:
 * DeclarationEmitHost interface {
 * 	modulespecifiers.ModuleSpecifierGenerationHost
 * 	GetCurrentDirectory() string
 * 	UseCaseSensitiveFileNames() bool
 * 	GetSourceFileFromReference(origin *ast.SourceFile, ref *ast.FileReference) *ast.SourceFile
 * 
 * 	GetOutputPathsFor(file *ast.SourceFile, forceDtsPaths bool) OutputPaths
 * 	GetResolutionModeOverride(node *ast.Node) core.ResolutionMode
 * 	GetEffectiveDeclarationFlags(node *ast.Node, flags ast.ModifierFlags) ast.ModifierFlags
 * 	GetEmitResolver() printer.EmitResolver
 * }
 */
export interface DeclarationEmitHost extends ModuleSpecifierGenerationHost {
  readonly __tsgoEmbedded0?: ModuleSpecifierGenerationHost;
  GetCurrentDirectory(): string;
  UseCaseSensitiveFileNames(): bool;
  GetSourceFileFromReference(origin: GoPtr<SourceFile>, ref: GoPtr<FileReference>): GoPtr<SourceFile>;
  GetOutputPathsFor(file: GoPtr<SourceFile>, forceDtsPaths: bool): OutputPaths;
  GetResolutionModeOverride(node: GoPtr<Node>): ResolutionMode;
  GetEffectiveDeclarationFlags(node: GoPtr<Node>, flags: ModifierFlags): ModifierFlags;
  GetEmitResolver(): EmitResolver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::type::DeclarationTransformer","kind":"type","status":"implemented","sigHash":"0cc4f6ffd21d0e46700910172aa1bbfe45cf16f085a73d9816adba9c5752cb37","bodyHash":"3b6bc3d860dfafb089e4fa87cd0a28fb0e9a5519f3139bde924d5d0d7799f0af"}
 *
 * Go source:
 * DeclarationTransformer struct {
 * 	transformers.Transformer
 * 	host                DeclarationEmitHost
 * 	compilerOptions     *core.CompilerOptions
 * 	tracker             *SymbolTrackerImpl
 * 	state               *SymbolTrackerSharedState
 * 	resolver            printer.EmitResolver
 * 	declarationFilePath string
 * 	declarationMapPath  string
 * 
 * 	needsDeclare                     bool
 * 	needsScopeFixMarker              bool
 * 	resultHasScopeMarker             bool
 * 	enclosingDeclaration             *ast.Node
 * 	resultHasExternalModuleIndicator bool
 * 	suppressNewDiagnosticContexts    bool
 * 	lateStatementReplacementMap      map[ast.NodeId]*ast.Node
 * 	expandoHosts                     collections.Set[ast.NodeId]
 * 	rawReferencedFiles               []ReferencedFilePair
 * 	rawTypeReferenceDirectives       []*ast.FileReference
 * 	rawLibReferenceDirectives        []*ast.FileReference
 * }
 */
export interface DeclarationTransformer {
  readonly __tsgoEmbedded0?: Transformer;
  host: DeclarationEmitHost;
  compilerOptions: GoPtr<CompilerOptions>;
  tracker: GoPtr<SymbolTrackerImpl>;
  state: GoPtr<SymbolTrackerSharedState>;
  resolver: EmitResolver;
  declarationFilePath: string;
  declarationMapPath: string;
  needsDeclare: bool;
  needsScopeFixMarker: bool;
  resultHasScopeMarker: bool;
  enclosingDeclaration: GoPtr<Node>;
  resultHasExternalModuleIndicator: bool;
  suppressNewDiagnosticContexts: bool;
  lateStatementReplacementMap: GoMap<NodeId, GoPtr<Node>>;
  expandoHosts: Set;
  rawReferencedFiles: GoSlice<ReferencedFilePair>;
  rawTypeReferenceDirectives: GoSlice<GoPtr<FileReference>>;
  rawLibReferenceDirectives: GoSlice<GoPtr<FileReference>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::func::NewDeclarationTransformer","kind":"func","status":"implemented","sigHash":"86e2ffb5034dbb8eb3dbca8531bc911df6fe113bccd753377fb1e23845c11eb0","bodyHash":"f397a999a4b40f307a8b0e34db54e7ea77ab8036337e9af37778f0936237c76f"}
 *
 * Go source:
 * func NewDeclarationTransformer(host DeclarationEmitHost, context *printer.EmitContext, compilerOptions *core.CompilerOptions, declarationFilePath string, declarationMapPath string) *DeclarationTransformer {
 * 	resolver := host.GetEmitResolver()
 * 	state := &SymbolTrackerSharedState{isolatedDeclarations: compilerOptions.IsolatedDeclarations.IsTrue(), stripInternal: compilerOptions.StripInternal.IsTrue(), resolver: resolver}
 * 	tracker := NewSymbolTracker(host, resolver, state)
 * 	// TODO: Use new host GetOutputPathsFor method instead of passing in entrypoint paths (which will also better support bundled emit)
 * 	tx := &DeclarationTransformer{
 * 		host:                host,
 * 		compilerOptions:     compilerOptions,
 * 		tracker:             tracker,
 * 		state:               state,
 * 		resolver:            resolver,
 * 		declarationFilePath: declarationFilePath,
 * 		declarationMapPath:  declarationMapPath,
 * 	}
 * 	tx.state.reportExpandoFunctionErrors = func(node *ast.Node) {
 * 		props := resolver.GetPropertiesOfContainerFunction(node)
 * 		for _, p := range props {
 * 			if ast.IsExpandoPropertyDeclaration(p.ValueDeclaration) {
 * 				errorTarget := p.ValueDeclaration
 * 				if ast.IsBinaryExpression(errorTarget) {
 * 					errorTarget = errorTarget.AsBinaryExpression().Left
 * 				}
 * 				tx.state.addDiagnostic(createDiagnosticForNode(errorTarget, diagnostics.Assigning_properties_to_functions_without_declaring_them_is_not_supported_with_isolatedDeclarations_Add_an_explicit_declaration_for_the_properties_assigned_to_this_function))
 * 			}
 * 		}
 * 	}
 * 	tx.NewTransformer(tx.visit, context)
 * 	return tx
 * }
 */
export function NewDeclarationTransformer(host: DeclarationEmitHost, context: GoPtr<EmitContext>, compilerOptions: GoPtr<CompilerOptions>, declarationFilePath: string, declarationMapPath: string): GoPtr<DeclarationTransformer> {
  const resolver = host.GetEmitResolver();
  const state: SymbolTrackerSharedState = {
    isolatedDeclarations: compilerOptions!.IsolatedDeclarations !== undefined && compilerOptions!.IsolatedDeclarations !== 0,
    stripInternal: compilerOptions!.StripInternal !== undefined && compilerOptions!.StripInternal !== 0,
    resolver: resolver,
    lateMarkedStatements: [],
    diagnostics: [],
    getSymbolAccessibilityDiagnostic: throwDiagnostic,
    errorNameNode: undefined,
    currentSourceFile: undefined,
    reportExpandoFunctionErrors: undefined as unknown as (node: GoPtr<Node>) => void,
  };
  const tracker = NewSymbolTracker(host, resolver, state);
  const tx: DeclarationTransformer = {
    __tsgoEmbedded0: { emitContext: undefined, factory: undefined, visitor: undefined },
    host: host,
    compilerOptions: compilerOptions,
    tracker: tracker,
    state: state,
    resolver: resolver,
    declarationFilePath: declarationFilePath,
    declarationMapPath: declarationMapPath,
    needsDeclare: false,
    needsScopeFixMarker: false,
    resultHasScopeMarker: false,
    enclosingDeclaration: undefined,
    resultHasExternalModuleIndicator: false,
    suppressNewDiagnosticContexts: false,
    lateStatementReplacementMap: new globalThis.Map(),
    expandoHosts: { entries: undefined } as unknown as Set,
    rawReferencedFiles: [],
    rawTypeReferenceDirectives: [],
    rawLibReferenceDirectives: [],
  };
  state.reportExpandoFunctionErrors = (node: GoPtr<Node>): void => {
    const props = resolver.GetPropertiesOfContainerFunction(node);
    for (const p of props) {
      if (IsExpandoPropertyDeclaration(p!.ValueDeclaration)) {
        let errorTarget = p!.ValueDeclaration;
        if (IsBinaryExpression(errorTarget)) {
          errorTarget = AsBinaryExpression(errorTarget)!.Left;
        }
        SymbolTrackerSharedState_addDiagnostic(state, createDiagnosticForNode(errorTarget, diagnosticMessages.Assigning_properties_to_functions_without_declaring_them_is_not_supported_with_isolatedDeclarations_Add_an_explicit_declaration_for_the_properties_assigned_to_this_function));
      }
    }
  };
  Transformer_NewTransformer(tx.__tsgoEmbedded0, (node) => DeclarationTransformer_visit(tx, node), context);
  return tx;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.GetDiagnostics","kind":"method","status":"implemented","sigHash":"7d8481e47e7876122bfae4f9fbed665a521ec2e0f19d7e690462d17d67dbe492","bodyHash":"e143abf2279ba82f1a306242a21d38e4a411f9ef4e779a9944e5714644445488"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) GetDiagnostics() []*ast.Diagnostic {
 * 	return tx.state.diagnostics
 * }
 */
export function DeclarationTransformer_GetDiagnostics(receiver: GoPtr<DeclarationTransformer>): GoSlice<GoPtr<Diagnostic>> {
  return receiver!.state!.diagnostics;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.shouldStripInternal","kind":"method","status":"implemented","sigHash":"77f322a3c61bdd8ad182bf72700eb84165c6fda3d56e247e42d50a2badf0814d","bodyHash":"b90db660ebdf2535dcddc91bb9d9fd9bd488f3be1972e262191399d6eed49499"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) shouldStripInternal(node *ast.Node) bool {
 * 	return tx.state.stripInternal && node != nil && tx.isInternalDeclaration(node, tx.state.currentSourceFile)
 * }
 */
export function DeclarationTransformer_shouldStripInternal(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>): bool {
  return (receiver!.state!.stripInternal && node !== undefined && DeclarationTransformer_isInternalDeclaration(receiver, node, receiver!.state!.currentSourceFile)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.isInternalDeclaration","kind":"method","status":"implemented","sigHash":"7fe0d8ee5a52aa54cf8a810a8a82dd68ab2526ebbf0d45cce3f0e2aeac1a3d2e","bodyHash":"23cf81e3ba0b95d530a5f8c3922631c8e31e8b752395b684007a49b6d5eaff1f"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) isInternalDeclaration(node *ast.Node, sourceFile *ast.SourceFile) bool {
 * 	if node == nil {
 * 		return false
 * 	}
 * 	parseTreeNode := tx.EmitContext().MostOriginal(node)
 * 	if !ast.IsParseTreeNode(parseTreeNode) {
 * 		return false
 * 	}
 * 	if parseTreeNode.Kind == ast.KindParameter {
 * 		params := parseTreeNode.Parent.Parameters()
 * 		paramIdx := slices.IndexFunc(params, func(p *ast.ParameterDeclarationNode) bool {
 * 			return p.AsNode() == parseTreeNode
 * 		})
 * 		var previousSibling *ast.Node
 * 		if paramIdx > 0 {
 * 			previousSibling = params[paramIdx-1].AsNode()
 * 		}
 * 
 * 		text := sourceFile.Text()
 * 		var commentRanges []ast.CommentRange
 * 
 * 		if previousSibling != nil {
 * 			// to handle
 * 			// ... parameters, /** @internal * /
 * 			// public param: string
 * 			trailingPos := scanner.SkipTriviaEx(text, previousSibling.End()+1, &scanner.SkipTriviaOptions{StopAtComments: true})
 * 			for comment := range scanner.GetTrailingCommentRanges(tx.Factory().AsNodeFactory(), text, trailingPos) {
 * 				commentRanges = append(commentRanges, comment)
 * 			}
 * 			for comment := range scanner.GetLeadingCommentRanges(tx.Factory().AsNodeFactory(), text, node.Pos()) {
 * 				commentRanges = append(commentRanges, comment)
 * 			}
 * 		} else {
 * 			trailingPos := scanner.SkipTriviaEx(text, node.Pos(), &scanner.SkipTriviaOptions{StopAtComments: true})
 * 			for comment := range scanner.GetTrailingCommentRanges(tx.Factory().AsNodeFactory(), text, trailingPos) {
 * 				commentRanges = append(commentRanges, comment)
 * 			}
 * 		}
 * 
 * 		if len(commentRanges) > 0 {
 * 			return hasInternalAnnotation(commentRanges[len(commentRanges)-1], sourceFile)
 * 		}
 * 		return false
 * 	}
 * 
 * 	for commentRange := range tx.getLeadingCommentRangesOfNode(parseTreeNode, sourceFile) {
 * 		if hasInternalAnnotation(commentRange, sourceFile) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function DeclarationTransformer_isInternalDeclaration(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>, sourceFile: GoPtr<SourceFile>): bool {
  if (node === undefined) {
    return false;
  }
  const parseTreeNode = EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), node);
  if (!IsParseTreeNode(parseTreeNode)) {
    return false;
  }
  if (parseTreeNode!.Kind === KindParameter) {
    const params = Node_ParameterList(parseTreeNode!.Parent!);
    let paramIdx = -1;
    for (let i = 0; i < params!.Nodes.length; i++) {
      if (params!.Nodes[i] === parseTreeNode) {
        paramIdx = i;
        break;
      }
    }
    let previousSibling: GoPtr<Node> = undefined;
    if (paramIdx > 0) {
      previousSibling = params!.Nodes[paramIdx - 1];
    }
    const text = SourceFile_Text(sourceFile);
    let commentRanges: GoSlice<CommentRange> = [];
    if (previousSibling !== undefined) {
      const trailingPos = SkipTriviaEx(text, Node_End(previousSibling!) + 1, { StopAfterLineBreak: false, StopAtComments: true, InJSDoc: false });
      GetTrailingCommentRanges(Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0, text, trailingPos)((comment: CommentRange) => { commentRanges = [...commentRanges, comment]; return true; });
      GetLeadingCommentRanges(Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0, text, Node_Pos(node!))((comment: CommentRange) => { commentRanges = [...commentRanges, comment]; return true; });
    } else {
      const trailingPos = SkipTriviaEx(text, Node_Pos(node!), { StopAfterLineBreak: false, StopAtComments: true, InJSDoc: false });
      GetTrailingCommentRanges(Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0, text, trailingPos)((comment: CommentRange) => { commentRanges = [...commentRanges, comment]; return true; });
    }
    if (commentRanges.length > 0) {
      return hasInternalAnnotation(commentRanges[commentRanges.length - 1]!, sourceFile);
    }
    return false;
  }
  let found = false;
  DeclarationTransformer_getLeadingCommentRangesOfNode(receiver, parseTreeNode, sourceFile)((commentRange: CommentRange) => {
    if (hasInternalAnnotation(commentRange, sourceFile)) {
      found = true;
      return true;
    }
    return false;
  });
  return found;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.getLeadingCommentRangesOfNode","kind":"method","status":"implemented","sigHash":"93598f203256e8068c729994211e60ad0a4f795da00c248bdb93e9214d8cfa25","bodyHash":"cbe01653c109551f1ebe0dff78875a0ecb8ecae982e470f053eff9c5ef80dde9"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) getLeadingCommentRangesOfNode(node *ast.Node, sourceFile *ast.SourceFile) iter.Seq[ast.CommentRange] {
 * 	if node == nil || node.Kind == ast.KindJsxText {
 * 		return nil
 * 	}
 * 	return scanner.GetLeadingCommentRanges(tx.Factory().AsNodeFactory(), sourceFile.Text(), node.Pos())
 * }
 */
export function DeclarationTransformer_getLeadingCommentRangesOfNode(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>, sourceFile: GoPtr<SourceFile>): GoSeq<CommentRange> {
  if (node === undefined || node!.Kind === KindJsxText) {
    return (_yield: (c: CommentRange) => bool): void => {};
  }
  return GetLeadingCommentRanges(Transformer_Factory(receiver!.__tsgoEmbedded0)!.__tsgoEmbedded0, SourceFile_Text(sourceFile), Node_Pos(node!));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::func::hasInternalAnnotation","kind":"func","status":"implemented","sigHash":"946964e1abb771b9c2bdebb8e46aa2fc3ed69dfea923ed057e6447ecb79b6a11","bodyHash":"ef1dc32d7414ee6d74b758aad93e983f8e15d4888668b89b0ff698d576dfeac4"}
 *
 * Go source:
 * func hasInternalAnnotation(commentRange ast.CommentRange, sourceFile *ast.SourceFile) bool {
 * 	comment := sourceFile.Text()[commentRange.Pos():commentRange.End()]
 * 	return strings.Contains(comment, "@internal")
 * }
 */
export function hasInternalAnnotation(commentRange: CommentRange, sourceFile: GoPtr<SourceFile>): bool {
  const comment = SourceFile_Text(sourceFile).slice(commentRange.pos, commentRange.end);
  return comment.includes("@internal") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::constGroup::declarationEmitNodeBuilderFlags","kind":"constGroup","status":"implemented","sigHash":"901e9a91788a64e0edf745f92c3a90c6bf9e85039d2a894c0b1739a954f6b53a","bodyHash":"87f0520a77c6a6bfff05c13b50c42de6c1d567d886ef4b23598bc13d71c1a2d8"}
 *
 * Go source:
 * const declarationEmitNodeBuilderFlags = nodebuilder.FlagsMultilineObjectLiterals |
 * 	nodebuilder.FlagsWriteClassExpressionAsTypeLiteral |
 * 	nodebuilder.FlagsUseTypeOfFunction |
 * 	nodebuilder.FlagsUseStructuralFallback |
 * 	nodebuilder.FlagsAllowEmptyTuple |
 * 	nodebuilder.FlagsGenerateNamesForShadowedTypeParams |
 * 	nodebuilder.FlagsNoTruncation
 */
export const declarationEmitNodeBuilderFlags: int = (FlagsMultilineObjectLiterals |
  FlagsWriteClassExpressionAsTypeLiteral |
  FlagsUseTypeOfFunction |
  FlagsUseStructuralFallback |
  FlagsAllowEmptyTuple |
  FlagsGenerateNamesForShadowedTypeParams |
  FlagsNoTruncation) as int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::constGroup::declarationEmitInternalNodeBuilderFlags","kind":"constGroup","status":"implemented","sigHash":"0637a954f93408f6f62ee99a44811928b4fe8ae4cb3fa9041fa9d9f79986d670","bodyHash":"eb44ae6e0e00669886a91be2ee5a237a94b6f013ba29fb6b66ff2009f58a6c91"}
 *
 * Go source:
 * const declarationEmitInternalNodeBuilderFlags = nodebuilder.InternalFlagsAllowUnresolvedNames
 */
export const declarationEmitInternalNodeBuilderFlags: InternalFlags = InternalFlagsAllowUnresolvedNames;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.visit","kind":"method","status":"implemented","sigHash":"76f128f47c9e048e0b634c96f39631818d4072cebc07c3fcfd35a1f486bb0b2d","bodyHash":"57b1ef484a5737536c55a250392ff9a4e4c5807ddf5cdb69a4d3cafce33868d1"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node == nil {
 * 		return nil
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindSourceFile:
 * 		return tx.visitSourceFile(node.AsSourceFile())
 * 	// statements we keep but do something to
 * 	case ast.KindFunctionDeclaration,
 * 		ast.KindModuleDeclaration,
 * 		ast.KindImportEqualsDeclaration,
 * 		ast.KindInterfaceDeclaration,
 * 		ast.KindClassDeclaration,
 * 		ast.KindJSTypeAliasDeclaration,
 * 		ast.KindTypeAliasDeclaration,
 * 		ast.KindEnumDeclaration,
 * 		ast.KindVariableStatement,
 * 		ast.KindImportDeclaration,
 * 		ast.KindJSImportDeclaration,
 * 		ast.KindExportDeclaration,
 * 		ast.KindExportAssignment:
 * 		return tx.visitDeclarationStatements(node)
 * 	// statements we elide
 * 	case ast.KindBreakStatement,
 * 		ast.KindContinueStatement,
 * 		ast.KindDebuggerStatement,
 * 		ast.KindDoStatement,
 * 		ast.KindEmptyStatement,
 * 		ast.KindForInStatement,
 * 		ast.KindForOfStatement,
 * 		ast.KindForStatement,
 * 		ast.KindIfStatement,
 * 		ast.KindLabeledStatement,
 * 		ast.KindReturnStatement,
 * 		ast.KindSwitchStatement,
 * 		ast.KindThrowStatement,
 * 		ast.KindTryStatement,
 * 		ast.KindWhileStatement,
 * 		ast.KindWithStatement,
 * 		ast.KindNotEmittedStatement,
 * 		ast.KindBlock,
 * 		ast.KindMissingDeclaration:
 * 		return nil
 * 	case ast.KindExpressionStatement:
 * 		return tx.visitExpressionStatement(node)
 * 	// parts of things, things we just visit children of
 * 	default:
 * 		return tx.visitDeclarationSubtree(node)
 * 	}
 * }
 */
export function DeclarationTransformer_visit(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (node === undefined) {
    return undefined;
  }
  switch (node!.Kind) {
    case KindSourceFile:
      return DeclarationTransformer_visitSourceFile(receiver, AsSourceFile(node));
    // statements we keep but do something to
    case KindFunctionDeclaration:
    case KindModuleDeclaration:
    case KindImportEqualsDeclaration:
    case KindInterfaceDeclaration:
    case KindClassDeclaration:
    case KindJSTypeAliasDeclaration:
    case KindTypeAliasDeclaration:
    case KindEnumDeclaration:
    case KindVariableStatement:
    case KindImportDeclaration:
    case KindJSImportDeclaration:
    case KindExportDeclaration:
    case KindExportAssignment:
      return DeclarationTransformer_visitDeclarationStatements(receiver, node);
    // statements we elide
    case KindBreakStatement:
    case KindContinueStatement:
    case KindDebuggerStatement:
    case KindDoStatement:
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
    case KindWhileStatement:
    case KindWithStatement:
    case KindNotEmittedStatement:
    case KindBlock:
    case KindMissingDeclaration:
      return undefined;
    case KindExpressionStatement:
      return DeclarationTransformer_visitExpressionStatement(receiver, node);
    // parts of things, things we just visit children of
    default:
      return DeclarationTransformer_visitDeclarationSubtree(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::func::throwDiagnostic","kind":"func","status":"implemented","sigHash":"990b9807239469db6384581402d974480356ebad7dfc13f38d6e56d579602b96","bodyHash":"0e878049cb65cf718483c45a194225907ba28b780fbbc6e07c03883232d07330"}
 *
 * Go source:
 * func throwDiagnostic(result printer.SymbolAccessibilityResult) *SymbolAccessibilityDiagnostic {
 * 	panic("Diagnostic emitted without context")
 * }
 */
export function throwDiagnostic(result: SymbolAccessibilityResult): GoPtr<SymbolAccessibilityDiagnostic> {
  throw new globalThis.Error("Diagnostic emitted without context");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.visitSourceFile","kind":"method","status":"implemented","sigHash":"1a023cc2cc92994130cb913ce21da2e97a5d0dbd8bcfadd00d81fb369e3c4814","bodyHash":"ae7da6c67f4d3ce4f1379df2199682c4a59c7a5d4549fa65421face29b74cf6b"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) visitSourceFile(node *ast.SourceFile) *ast.Node {
 * 	if node.IsDeclarationFile {
 * 		return node.AsNode()
 * 	}
 * 
 * 	tx.needsDeclare = true
 * 	tx.needsScopeFixMarker = false
 * 	tx.resultHasScopeMarker = false
 * 	tx.enclosingDeclaration = node.AsNode()
 * 	tx.state.getSymbolAccessibilityDiagnostic = throwDiagnostic
 * 	tx.resultHasExternalModuleIndicator = false
 * 	tx.suppressNewDiagnosticContexts = false
 * 	tx.state.lateMarkedStatements = make([]*ast.Node, 0)
 * 	tx.lateStatementReplacementMap = make(map[ast.NodeId]*ast.Node)
 * 	tx.expandoHosts = collections.Set[ast.NodeId]{}
 * 	tx.rawReferencedFiles = make([]ReferencedFilePair, 0)
 * 	tx.rawTypeReferenceDirectives = make([]*ast.FileReference, 0)
 * 	tx.rawLibReferenceDirectives = make([]*ast.FileReference, 0)
 * 	tx.state.currentSourceFile = node
 * 	tx.collectFileReferences(node)
 * 	tx.resolver.PrecalculateDeclarationEmitVisibility(node)
 * 	updated := tx.transformSourceFile(node)
 * 	tx.state.currentSourceFile = nil
 * 	return updated
 * }
 */
export function DeclarationTransformer_visitSourceFile(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<SourceFile>): GoPtr<Node> {
  if (node!.IsDeclarationFile) {
    return node;
  }
  receiver!.needsDeclare = true;
  receiver!.needsScopeFixMarker = false;
  receiver!.resultHasScopeMarker = false;
  receiver!.enclosingDeclaration = node;
  receiver!.state!.getSymbolAccessibilityDiagnostic = throwDiagnostic;
  receiver!.resultHasExternalModuleIndicator = false;
  receiver!.suppressNewDiagnosticContexts = false;
  receiver!.state!.lateMarkedStatements = [];
  receiver!.lateStatementReplacementMap = new globalThis.Map();
  receiver!.expandoHosts = { entries: undefined } as unknown as Set;
  receiver!.rawReferencedFiles = [];
  receiver!.rawTypeReferenceDirectives = [];
  receiver!.rawLibReferenceDirectives = [];
  receiver!.state!.currentSourceFile = node;
  DeclarationTransformer_collectFileReferences(receiver, node);
  receiver!.resolver.PrecalculateDeclarationEmitVisibility(node);
  const updated = DeclarationTransformer_transformSourceFile(receiver, node);
  receiver!.state!.currentSourceFile = undefined;
  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.collectFileReferences","kind":"method","status":"implemented","sigHash":"3c8eeb32d21ddf4101a508dcda866d31988086f2d7ea905ecd4fe1b970593337","bodyHash":"627d7613c7cea7f1ddb49aa00ec27a27edecc1d771a9a6fb32b8945f6fca1b73"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) collectFileReferences(sourceFile *ast.SourceFile) {
 * 	tx.rawReferencedFiles = append(tx.rawReferencedFiles, core.Map(sourceFile.ReferencedFiles, func(ref *ast.FileReference) ReferencedFilePair { return ReferencedFilePair{file: sourceFile, ref: ref} })...)
 * 	tx.rawTypeReferenceDirectives = append(tx.rawTypeReferenceDirectives, sourceFile.TypeReferenceDirectives...)
 * 	tx.rawLibReferenceDirectives = append(tx.rawLibReferenceDirectives, sourceFile.LibReferenceDirectives...)
 * }
 */
export function DeclarationTransformer_collectFileReferences(receiver: GoPtr<DeclarationTransformer>, sourceFile: GoPtr<SourceFile>): void {
  receiver!.rawReferencedFiles = [
    ...receiver!.rawReferencedFiles,
    ...Map(sourceFile!.ReferencedFiles, (ref: GoPtr<FileReference>) => ({ file: sourceFile, ref: ref } as ReferencedFilePair)),
  ];
  receiver!.rawTypeReferenceDirectives = [...receiver!.rawTypeReferenceDirectives, ...sourceFile!.TypeReferenceDirectives];
  receiver!.rawLibReferenceDirectives = [...receiver!.rawLibReferenceDirectives, ...sourceFile!.LibReferenceDirectives];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformSourceFile","kind":"method","status":"implemented","sigHash":"7a5dfb189679b2594685e8d8f81fab8ea8f9be6a6f972a81eb9fc211800dee7b","bodyHash":"1bd08a5bf9b615eba33729ac8ebf7cc1033a31bbe1c93b2ffc9e511852209d9a"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformSourceFile(node *ast.SourceFile) *ast.Node {
 * 	var combinedStatements *ast.StatementList
 * 	statements := tx.Visitor().VisitNodes(node.Statements)
 * 	combinedStatements = tx.transformAndReplaceLatePaintedStatements(statements)
 * 	combinedStatements.Loc = statements.Loc // setTextRange
 * 	if ast.IsExternalOrCommonJSModule(node) {
 * 		if ast.IsInJSFile(node.AsNode()) {
 * 			if exportEquals := node.Symbol.Exports[ast.InternalSymbolNameExportEquals]; exportEquals != nil && len(exportEquals.Declarations) > 1 {
 * 				for _, node := range exportEquals.Declarations {
 * 					tx.state.addDiagnostic(createDiagnosticForNode(node, diagnostics.Multiple_module_exports_assignments_cannot_be_serialized_for_declaration_emit))
 * 				}
 * 			}
 * 			for _, node := range node.NestedCJSExports {
 * 				tx.state.addDiagnostic(createDiagnosticForNode(node, diagnostics.Nested_CommonJS_export_constructs_cannot_be_serialized_for_declaration_emit))
 * 			}
 * 		}
 * 		if !tx.resultHasExternalModuleIndicator || (tx.needsScopeFixMarker && !tx.resultHasScopeMarker) {
 * 			marker := createEmptyExports(tx.Factory().AsNodeFactory())
 * 			newList := append(combinedStatements.Nodes, marker)
 * 			withMarker := tx.Factory().NewNodeList(newList)
 * 			withMarker.Loc = combinedStatements.Loc
 * 			combinedStatements = withMarker
 * 		}
 * 	}
 * 	outputFilePath := tspath.GetDirectoryPath(tspath.NormalizeSlashes(tx.declarationFilePath))
 * 	result := tx.Factory().UpdateSourceFile(node, combinedStatements, node.EndOfFileToken)
 * 	result.AsSourceFile().LibReferenceDirectives = tx.getLibReferences()
 * 	result.AsSourceFile().TypeReferenceDirectives = tx.getTypeReferences()
 * 	result.AsSourceFile().IsDeclarationFile = true
 * 	result.AsSourceFile().ReferencedFiles = tx.getReferencedFiles(outputFilePath)
 * 	return result.AsNode()
 * }
 */
export function DeclarationTransformer_transformSourceFile(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<SourceFile>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const statements = NodeVisitor_VisitNodes(visitor, node!.Statements as GoPtr<StatementList>);
  let combinedStatements = DeclarationTransformer_transformAndReplaceLatePaintedStatements(receiver, statements);
  combinedStatements!.Loc = statements!.Loc;
  if (IsExternalOrCommonJSModule(node)) {
    if (IsInJSFile(node)) {
      const exportEquals = Node_Symbol(node) !== undefined
        ? Node_Symbol(node)!.Exports !== undefined
          ? Node_Symbol(node)!.Exports!.get(InternalSymbolNameExportEquals)
          : undefined
        : undefined;
      if (exportEquals !== undefined && exportEquals!.Declarations !== undefined && exportEquals!.Declarations.length > 1) {
        for (const decl of exportEquals!.Declarations) {
          SymbolTrackerSharedState_addDiagnostic(receiver!.state!, createDiagnosticForNode(decl, diagnosticMessages.Multiple_module_exports_assignments_cannot_be_serialized_for_declaration_emit));
        }
      }
      for (const nestedExport of node!.NestedCJSExports) {
        SymbolTrackerSharedState_addDiagnostic(receiver!.state!, createDiagnosticForNode(nestedExport, diagnosticMessages.Nested_CommonJS_export_constructs_cannot_be_serialized_for_declaration_emit));
      }
    }
    if (!receiver!.resultHasExternalModuleIndicator || (receiver!.needsScopeFixMarker && !receiver!.resultHasScopeMarker)) {
      const marker = createEmptyExports(factory!.__tsgoEmbedded0);
      const newList = NodeFactory_NewNodeList(factory!.__tsgoEmbedded0, [...combinedStatements!.Nodes, marker]);
      newList!.Loc = combinedStatements!.Loc;
      combinedStatements = newList as GoPtr<StatementList>;
    }
  }
  const outputFilePath = GetDirectoryPath(NormalizeSlashes(receiver!.declarationFilePath));
  const result = NodeFactory_UpdateSourceFile(factory!.__tsgoEmbedded0, node, combinedStatements, node!.EndOfFileToken);
  AsSourceFile(result!)!.LibReferenceDirectives = DeclarationTransformer_getLibReferences(receiver);
  AsSourceFile(result!)!.TypeReferenceDirectives = DeclarationTransformer_getTypeReferences(receiver);
  AsSourceFile(result!)!.IsDeclarationFile = true;
  AsSourceFile(result!)!.ReferencedFiles = DeclarationTransformer_getReferencedFiles(receiver, outputFilePath);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::func::createEmptyExports","kind":"func","status":"implemented","sigHash":"febc730908760a3acfd1e18f045c85601ce1c72b53f94b27febaa00868592f9e","bodyHash":"4fa21a1d62f61f1f270f79e0720ca7d81433cf819ec6bd7f0780b15ad4ca1c3a"}
 *
 * Go source:
 * func createEmptyExports(factory *ast.NodeFactory) *ast.Node {
 * 	return factory.NewExportDeclaration(nil /*isTypeOnly* /, false, factory.NewNamedExports(factory.NewNodeList([]*ast.Node{})), nil, nil)
 * }
 */
export function createEmptyExports(factory: GoPtr<NodeFactory>): GoPtr<Node> {
  return NewExportDeclaration(factory, undefined, false as bool, NewNamedExports(factory, NodeFactory_NewNodeList(factory, [])), undefined, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformAndReplaceLatePaintedStatements","kind":"method","status":"implemented","sigHash":"9d97fe5fe716314dba91ff3eb3b0279156b1de3a705d02d6cbc1391d755f1b4d","bodyHash":"da12fcb3b80c06929c59a1892a406bef4040df2d91a4116c99044aacf0bb2cde"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformAndReplaceLatePaintedStatements(statements *ast.StatementList) *ast.StatementList {
 * 	// This is a `while` loop because `handleSymbolAccessibilityError` can see additional import aliases marked as visible during
 * 	// error handling which must now be included in the output and themselves checked for errors.
 * 	// For example:
 * 	// ```
 * 	// module A {
 * 	//   export module Q {}
 * 	//   import B = Q;
 * 	//   import C = B;
 * 	//   export import D = C;
 * 	// }
 * 	// ```
 * 	// In such a scenario, only Q and D are initially visible, but we don't consider imports as private names - instead we say they if they are referenced they must
 * 	// be recorded. So while checking D's visibility we mark C as visible, then we must check C which in turn marks B, completing the chain of
 * 	// dependent imports and allowing a valid declaration file output. Today, this dependent alias marking only happens for internal import aliases.
 * 	for true {
 * 		if len(tx.state.lateMarkedStatements) == 0 {
 * 			break
 * 		}
 * 
 * 		next := tx.state.lateMarkedStatements[0]
 * 		tx.state.lateMarkedStatements = tx.state.lateMarkedStatements[1:]
 * 
 * 		saveNeedsDeclare := tx.needsDeclare
 * 		tx.needsDeclare = next.Parent != nil && ast.IsSourceFile(next.Parent)
 * 
 * 		result := tx.transformTopLevelDeclaration(next)
 * 
 * 		tx.needsDeclare = saveNeedsDeclare
 * 		original := tx.EmitContext().MostOriginal(next)
 * 		id := ast.GetNodeId(original)
 * 		tx.lateStatementReplacementMap[id] = result
 * 	}
 * 
 * 	// And lastly, we need to get the final form of all those indetermine import declarations from before and add them to the output list
 * 	// (and remove them from the set to examine for outter declarations)
 * 	results := make([]*ast.Node, 0, len(statements.Nodes))
 * 	for _, statement := range statements.Nodes {
 * 		if !ast.IsLateVisibilityPaintedStatement(statement) {
 * 			results = append(results, statement)
 * 			continue
 * 		}
 * 		original := tx.EmitContext().MostOriginal(statement)
 * 		id := ast.GetNodeId(original)
 * 		replacement, ok := tx.lateStatementReplacementMap[id]
 * 		if !ok {
 * 			results = append(results, statement)
 * 			continue // not replaced
 * 		}
 * 		if replacement == nil {
 * 			continue // deleted
 * 		}
 * 		if replacement.Kind == ast.KindSyntaxList {
 * 			if !tx.needsScopeFixMarker || !tx.resultHasExternalModuleIndicator {
 * 				for _, elem := range replacement.AsSyntaxList().Children {
 * 					if needsScopeMarker(elem) {
 * 						tx.needsScopeFixMarker = true
 * 					}
 * 					if ast.IsSourceFile(statement.Parent) && ast.IsExternalModuleIndicator(elem) {
 * 						tx.resultHasExternalModuleIndicator = true
 * 					}
 * 				}
 * 			}
 * 			results = append(results, replacement.AsSyntaxList().Children...)
 * 		} else {
 * 			if needsScopeMarker(replacement) {
 * 				tx.needsScopeFixMarker = true
 * 			}
 * 			if ast.IsSourceFile(statement.Parent) && ast.IsExternalModuleIndicator(replacement) {
 * 				tx.resultHasExternalModuleIndicator = true
 * 			}
 * 			results = append(results, replacement)
 * 		}
 * 	}
 * 
 * 	return tx.Factory().NewNodeList(results)
 * }
 */
export function DeclarationTransformer_transformAndReplaceLatePaintedStatements(receiver: GoPtr<DeclarationTransformer>, statements: GoPtr<StatementList>): GoPtr<StatementList> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  while (true) {
    if (receiver!.state!.lateMarkedStatements.length === 0) {
      break;
    }
    const next = receiver!.state!.lateMarkedStatements[0];
    receiver!.state!.lateMarkedStatements = receiver!.state!.lateMarkedStatements.slice(1);
    const saveNeedsDeclare = receiver!.needsDeclare;
    receiver!.needsDeclare = (next!.Parent !== undefined && IsSourceFile(next!.Parent)) as bool;
    const result = DeclarationTransformer_transformTopLevelDeclaration(receiver, next);
    receiver!.needsDeclare = saveNeedsDeclare;
    const original = EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), next);
    const id = GetNodeId(original);
    receiver!.lateStatementReplacementMap.set(id, result);
  }
  const results: GoSlice<GoPtr<Node>> = [];
  for (const statement of statements!.Nodes) {
    if (!IsLateVisibilityPaintedStatement(statement)) {
      results.push(statement);
      continue;
    }
    const original = EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0), statement);
    const id = GetNodeId(original);
    if (!receiver!.lateStatementReplacementMap.has(id)) {
      results.push(statement);
      continue; // not replaced
    }
    const replacement = receiver!.lateStatementReplacementMap.get(id);
    if (replacement === undefined) {
      continue; // deleted
    }
    if (replacement!.Kind === KindSyntaxList) {
      if (!receiver!.needsScopeFixMarker || !receiver!.resultHasExternalModuleIndicator) {
        for (const elem of AsSyntaxList(replacement)!.Children) {
          if (needsScopeMarker(elem)) {
            receiver!.needsScopeFixMarker = true;
          }
          if (IsSourceFile(statement!.Parent) && IsExternalModuleIndicator(elem)) {
            receiver!.resultHasExternalModuleIndicator = true;
          }
        }
      }
      for (const elem of AsSyntaxList(replacement)!.Children) {
        results.push(elem);
      }
    } else {
      if (needsScopeMarker(replacement)) {
        receiver!.needsScopeFixMarker = true;
      }
      if (IsSourceFile(statement!.Parent) && IsExternalModuleIndicator(replacement)) {
        receiver!.resultHasExternalModuleIndicator = true;
      }
      results.push(replacement);
    }
  }
  return NodeFactory_NewNodeList(factory!.__tsgoEmbedded0, results) as GoPtr<StatementList>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.getReferencedFiles","kind":"method","status":"implemented","sigHash":"56c4287cd0f40d468ccb247272bcf091c0bfa4264e8fff1cd91c4359f0d903ff","bodyHash":"cbf133d85176ab193c9def000d86eef73e841b74dcafb9b2fc79be9d24c48967"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) getReferencedFiles(outputFilePath string) (results []*ast.FileReference) {
 * 	// Handle path rewrites for triple slash ref comments
 * 	for _, pair := range tx.rawReferencedFiles {
 * 		sourceFile := pair.file
 * 		ref := pair.ref
 * 
 * 		if !ref.Preserve {
 * 			continue
 * 		}
 * 
 * 		file := tx.host.GetSourceFileFromReference(sourceFile, ref)
 * 		if file == nil {
 * 			continue
 * 		}
 * 
 * 		var declFileName string
 * 		if file.IsDeclarationFile {
 * 			declFileName = file.FileName()
 * 		} else {
 * 			paths := tx.host.GetOutputPathsFor(file, true)
 * 			// Try to use output path for referenced file, or output js path if that doesn't exist, or the input path if all else fails
 * 			declFileName = paths.DeclarationFilePath()
 * 			if len(declFileName) == 0 {
 * 				declFileName = paths.JsFilePath()
 * 			}
 * 			if len(declFileName) == 0 {
 * 				declFileName = file.FileName()
 * 			}
 * 		}
 * 		// Should only be missing if the source file is missing a fileName (at which point we can't name a reference to it anyway)
 * 		// TODO: Shouldn't this be a crash or assert instead of a silent continue?
 * 		if len(declFileName) == 0 {
 * 			continue
 * 		}
 * 
 * 		fileName := tspath.GetRelativePathToDirectoryOrUrl(
 * 			outputFilePath,
 * 			declFileName,
 * 			false, // TODO: Probably unsafe to assume this isn't a URL, but that's what strada does
 * 			tspath.ComparePathsOptions{
 * 				CurrentDirectory:          tx.host.GetCurrentDirectory(),
 * 				UseCaseSensitiveFileNames: tx.host.UseCaseSensitiveFileNames(),
 * 			},
 * 		)
 * 
 * 		results = append(results, &ast.FileReference{
 * 			TextRange:      core.NewTextRange(-1, -1),
 * 			FileName:       fileName,
 * 			ResolutionMode: ref.ResolutionMode,
 * 			Preserve:       ref.Preserve,
 * 		})
 * 	}
 * 	return results
 * }
 */
export function DeclarationTransformer_getReferencedFiles(receiver: GoPtr<DeclarationTransformer>, outputFilePath: string): GoSlice<GoPtr<FileReference>> {
  const results: GoSlice<GoPtr<FileReference>> = [];
  for (const pair of receiver!.rawReferencedFiles) {
    const sourceFile = pair.file;
    const ref = pair.ref;
    if (!ref!.Preserve) {
      continue;
    }
    const file = receiver!.host.GetSourceFileFromReference(sourceFile, ref);
    if (file === undefined) {
      continue;
    }
    let declFileName: string;
    if (file!.IsDeclarationFile) {
      declFileName = SourceFile_FileName(file);
    } else {
      const paths = receiver!.host.GetOutputPathsFor(file, true as bool);
      declFileName = paths.DeclarationFilePath();
      if (declFileName.length === 0) {
        declFileName = paths.JsFilePath();
      }
      if (declFileName.length === 0) {
        declFileName = SourceFile_FileName(file);
      }
    }
    if (declFileName.length === 0) {
      continue;
    }
    const fileName = GetRelativePathToDirectoryOrUrl(
      outputFilePath,
      declFileName,
      false as bool,
      {
        CurrentDirectory: receiver!.host.GetCurrentDirectory(),
        UseCaseSensitiveFileNames: receiver!.host.UseCaseSensitiveFileNames(),
      } as ComparePathsOptions,
    );
    results.push({
      ...NewTextRange(-1, -1),
      FileName: fileName,
      ResolutionMode: ref!.ResolutionMode,
      Preserve: ref!.Preserve,
    } as FileReference);
  }
  return results;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.getLibReferences","kind":"method","status":"implemented","sigHash":"b6483614852c8b5a975a8683ea34352f506984fb80243c8fd4f831045acfb67b","bodyHash":"5e976c8f815666d75426ef4019d23f312ab6c4571dcd9f0e98650a6d98988eb2"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) getLibReferences() (result []*ast.FileReference) {
 * 	// clone retained references
 * 	for _, ref := range tx.rawLibReferenceDirectives {
 * 		if !ref.Preserve {
 * 			continue
 * 		}
 * 		result = append(result, &ast.FileReference{
 * 			TextRange:      core.NewTextRange(-1, -1),
 * 			FileName:       ref.FileName,
 * 			ResolutionMode: ref.ResolutionMode,
 * 			Preserve:       ref.Preserve,
 * 		})
 * 	}
 * 	return result
 * }
 */
export function DeclarationTransformer_getLibReferences(receiver: GoPtr<DeclarationTransformer>): GoSlice<GoPtr<FileReference>> {
  const result: GoSlice<GoPtr<FileReference>> = [];
  for (const ref of receiver!.rawLibReferenceDirectives) {
    if (!ref!.Preserve) {
      continue;
    }
    result.push({
      ...NewTextRange(-1, -1),
      FileName: ref!.FileName,
      ResolutionMode: ref!.ResolutionMode,
      Preserve: ref!.Preserve,
    } as FileReference);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.getTypeReferences","kind":"method","status":"implemented","sigHash":"d930c7c619c17a407fe90eb4d39639e42b9f69ebadd41c932778bf3bcac373eb","bodyHash":"3af9dd6f94b77ac44ea74df0be8d6514c30d89ccefbac89105dd785a64b76219"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) getTypeReferences() (result []*ast.FileReference) {
 * 	// clone retained references
 * 	for _, ref := range tx.rawTypeReferenceDirectives {
 * 		if !ref.Preserve {
 * 			continue
 * 		}
 * 		result = append(result, &ast.FileReference{
 * 			TextRange:      core.NewTextRange(-1, -1),
 * 			FileName:       ref.FileName,
 * 			ResolutionMode: ref.ResolutionMode,
 * 			Preserve:       ref.Preserve,
 * 		})
 * 	}
 * 	return result
 * }
 */
export function DeclarationTransformer_getTypeReferences(receiver: GoPtr<DeclarationTransformer>): GoSlice<GoPtr<FileReference>> {
  const result: GoSlice<GoPtr<FileReference>> = [];
  for (const ref of receiver!.rawTypeReferenceDirectives) {
    if (!ref!.Preserve) {
      continue;
    }
    result.push({
      ...NewTextRange(-1, -1),
      FileName: ref!.FileName,
      ResolutionMode: ref!.ResolutionMode,
      Preserve: ref!.Preserve,
    } as FileReference);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.visitDeclarationSubtree","kind":"method","status":"implemented","sigHash":"9404718612ad86102a87cd49e260db131b6aa8357348c983aa0476cbd3731231","bodyHash":"c7fe4c375dc92d93c80cb4829951ebf71de3ba32587b705a40941e856876601e"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) visitDeclarationSubtree(input *ast.Node) *ast.Node {
 * 	if tx.shouldStripInternal(input) {
 * 		return nil
 * 	}
 * 	if ast.IsDeclaration(input) {
 * 		if isDeclarationAndNotVisible(tx.EmitContext(), tx.resolver, input) {
 * 			return nil
 * 		}
 * 		if ast.HasDynamicName(input) {
 * 			if tx.state.isolatedDeclarations {
 * 				// Classes and object literals usually elide properties with computed names that are not of a literal type
 * 				// In isolated declarations TSC needs to error on these as we don't know the type in a DTE.
 * 				if !tx.resolver.IsDefinitelyReferenceToGlobalSymbolObject(input.Name().Expression()) {
 * 					if ast.IsClassDeclaration(input.Parent) || ast.IsObjectLiteralExpression(input.Parent) {
 * 						tx.state.addDiagnostic(createDiagnosticForNode(input, diagnostics.Computed_property_names_on_class_or_object_literals_cannot_be_inferred_with_isolatedDeclarations))
 * 						return nil
 * 					} else if (ast.IsInterfaceDeclaration(input.Parent) || ast.IsTypeLiteralNode(input.Parent)) && !ast.IsEntityNameExpression(input.Name().Expression()) {
 * 						// Type declarations just need to double-check that the input computed name is an entity name expression
 * 						tx.state.addDiagnostic(createDiagnosticForNode(input, diagnostics.Computed_properties_must_be_number_or_string_literals_variables_or_dotted_expressions_with_isolatedDeclarations))
 * 						return nil
 * 					}
 * 				}
 * 			} else if !tx.resolver.IsLateBound(tx.EmitContext().ParseNode(input)) || !ast.IsEntityNameExpression(input.Name().Expression()) {
 * 				return nil
 * 			}
 * 		}
 * 	}
 * 
 * 	// Elide implementation signatures from overload sets
 * 	if ast.IsFunctionLike(input) && tx.resolver.IsImplementationOfOverload(input) {
 * 		return nil
 * 	}
 * 
 * 	if input.Kind == ast.KindSemicolonClassElement {
 * 		return nil
 * 	}
 * 
 * 	previousEnclosingDeclaration := tx.enclosingDeclaration
 * 	if isEnclosingDeclaration(input) {
 * 		tx.enclosingDeclaration = input
 * 	}
 * 
 * 	canProdiceDiagnostic := canProduceDiagnostics(input)
 * 	oldWithinObjectLiteralType := tx.suppressNewDiagnosticContexts
 * 	shouldEnterSuppressNewDiagnosticsContextContext := (input.Kind == ast.KindTypeLiteral || input.Kind == ast.KindMappedType) && !(input.Parent.Kind == ast.KindTypeAliasDeclaration || input.Parent.Kind == ast.KindJSTypeAliasDeclaration)
 * 
 * 	oldDiag := tx.state.getSymbolAccessibilityDiagnostic
 * 	if canProdiceDiagnostic && !tx.suppressNewDiagnosticContexts {
 * 		tx.state.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(input)
 * 	}
 * 	oldName := tx.state.errorNameNode
 * 
 * 	if shouldEnterSuppressNewDiagnosticsContextContext {
 * 		tx.suppressNewDiagnosticContexts = true
 * 	}
 * 
 * 	var result *ast.Node
 * 
 * 	switch input.Kind {
 * 	case ast.KindMappedType:
 * 		result = tx.transformMappedTypeNode(input.AsMappedTypeNode())
 * 	case ast.KindHeritageClause:
 * 		result = tx.transformHeritageClause(input.AsHeritageClause())
 * 	case ast.KindMethodSignature:
 * 		result = tx.transformMethodSignatureDeclaration(input.AsMethodSignatureDeclaration())
 * 	case ast.KindMethodDeclaration:
 * 		result = tx.transformMethodDeclaration(input.AsMethodDeclaration())
 * 	case ast.KindConstructSignature:
 * 		result = tx.transformConstructSignatureDeclaration(input.AsConstructSignatureDeclaration())
 * 	case ast.KindConstructor:
 * 		result = tx.transformConstructorDeclaration(input.AsConstructorDeclaration())
 * 	case ast.KindGetAccessor:
 * 		result = tx.transformGetAccesorDeclaration(input.AsGetAccessorDeclaration())
 * 	case ast.KindSetAccessor:
 * 		result = tx.transformSetAccessorDeclaration(input.AsSetAccessorDeclaration())
 * 	case ast.KindPropertyDeclaration:
 * 		result = tx.transformPropertyDeclaration(input.AsPropertyDeclaration())
 * 	case ast.KindPropertySignature:
 * 		result = tx.transformPropertySignatureDeclaration(input.AsPropertySignatureDeclaration())
 * 	case ast.KindCallSignature:
 * 		result = tx.transformCallSignatureDeclaration(input.AsCallSignatureDeclaration())
 * 	case ast.KindIndexSignature:
 * 		result = tx.transformIndexSignatureDeclaration(input.AsIndexSignatureDeclaration())
 * 	case ast.KindVariableDeclaration:
 * 		result = tx.transformVariableDeclaration(input.AsVariableDeclaration())
 * 	case ast.KindTypeParameter:
 * 		result = tx.transformTypeParameterDeclaration(input.AsTypeParameterDeclaration())
 * 	case ast.KindExpressionWithTypeArguments:
 * 		result = tx.transformExpressionWithTypeArguments(input.AsExpressionWithTypeArguments())
 * 	case ast.KindTypeReference:
 * 		result = tx.transformTypeReference(input.AsTypeReferenceNode())
 * 	case ast.KindConditionalType:
 * 		result = tx.transformConditionalTypeNode(input.AsConditionalTypeNode())
 * 	case ast.KindFunctionType:
 * 		result = tx.transformFunctionTypeNode(input.AsFunctionTypeNode())
 * 	case ast.KindConstructorType:
 * 		result = tx.transformConstructorTypeNode(input.AsConstructorTypeNode())
 * 	case ast.KindImportType:
 * 		result = tx.transformImportTypeNode(input.AsImportTypeNode())
 * 	case ast.KindTypeQuery:
 * 		tx.checkEntityNameVisibility(input.AsTypeQueryNode().ExprName, tx.enclosingDeclaration)
 * 		result = tx.Visitor().VisitEachChild(input)
 * 	case ast.KindTupleType:
 * 		result = tx.Visitor().VisitEachChild(input)
 * 		if result != nil {
 * 			if transformers.IsOriginalNodeSingleLine(tx.EmitContext(), input) {
 * 				tx.EmitContext().AddEmitFlags(result, printer.EFSingleLine)
 * 			}
 * 		}
 * 	case ast.KindJSDocTypeExpression:
 * 		result = tx.transformJSDocTypeExpression(input.AsJSDocTypeExpression())
 * 	case ast.KindJSDocTypeLiteral:
 * 		result = tx.transformJSDocTypeLiteral(input.AsJSDocTypeLiteral())
 * 	case ast.KindJSDocPropertyTag:
 * 		result = tx.transformJSDocPropertyTag(input.AsJSDocParameterOrPropertyTag())
 * 	case ast.KindJSDocAllType:
 * 		result = tx.transformJSDocAllType(input.AsJSDocAllType())
 * 	case ast.KindJSDocNullableType:
 * 		result = tx.transformJSDocNullableType(input.AsJSDocNullableType())
 * 	case ast.KindJSDocNonNullableType:
 * 		result = tx.transformJSDocNonNullableType(input.AsJSDocNonNullableType())
 * 	case ast.KindJSDocOptionalType:
 * 		result = tx.transformJSDocOptionalType(input.AsJSDocOptionalType())
 * 	case ast.KindJSDocVariadicType:
 * 		result = tx.transformJSDocVariadicType(input.AsJSDocVariadicType())
 * 	default:
 * 		result = tx.Visitor().VisitEachChild(input)
 * 	}
 * 
 * 	if result != nil && canProdiceDiagnostic && ast.HasDynamicName(input) {
 * 		tx.checkName(input)
 * 	}
 * 
 * 	tx.enclosingDeclaration = previousEnclosingDeclaration
 * 	tx.state.getSymbolAccessibilityDiagnostic = oldDiag
 * 	tx.state.errorNameNode = oldName
 * 	tx.suppressNewDiagnosticContexts = oldWithinObjectLiteralType
 * 	return result
 * }
 */
export function DeclarationTransformer_visitDeclarationSubtree(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<Node>): GoPtr<Node> {
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  if (DeclarationTransformer_shouldStripInternal(receiver, input)) {
    return undefined;
  }
  if (IsDeclaration(input)) {
    if (isDeclarationAndNotVisible(emitContext, receiver!.resolver, input)) {
      return undefined;
    }
    if (HasDynamicName(input)) {
      if (receiver!.state!.isolatedDeclarations) {
        if (!receiver!.resolver.IsDefinitelyReferenceToGlobalSymbolObject(Node_Expression(Node_Name(input)))) {
          if (IsClassDeclaration(input!.Parent) || IsObjectLiteralExpression(input!.Parent)) {
            SymbolTrackerSharedState_addDiagnostic(receiver!.state!, createDiagnosticForNode(input, diagnosticMessages.Computed_property_names_on_class_or_object_literals_cannot_be_inferred_with_isolatedDeclarations));
            return undefined;
          } else if ((IsInterfaceDeclaration(input!.Parent) || IsTypeLiteralNode(input!.Parent)) && !IsEntityNameExpression(Node_Expression(Node_Name(input)))) {
            SymbolTrackerSharedState_addDiagnostic(receiver!.state!, createDiagnosticForNode(input, diagnosticMessages.Computed_properties_must_be_number_or_string_literals_variables_or_dotted_expressions_with_isolatedDeclarations));
            return undefined;
          }
        }
      } else if (!receiver!.resolver.IsLateBound(EmitContext_ParseNode(emitContext, input)) || !IsEntityNameExpression(Node_Expression(Node_Name(input)))) {
        return undefined;
      }
    }
  }
  // Elide implementation signatures from overload sets
  if (IsFunctionLike(input) && receiver!.resolver.IsImplementationOfOverload(input)) {
    return undefined;
  }
  if (input!.Kind === KindSemicolonClassElement) {
    return undefined;
  }
  const previousEnclosingDeclaration = receiver!.enclosingDeclaration;
  if (isEnclosingDeclaration(input)) {
    receiver!.enclosingDeclaration = input;
  }
  const canProdiceDiagnostic = canProduceDiagnostics(input);
  const oldWithinObjectLiteralType = receiver!.suppressNewDiagnosticContexts;
  const shouldEnterSuppressNewDiagnosticsContextContext = (input!.Kind === KindTypeLiteral || input!.Kind === KindMappedType) &&
    !(input!.Parent!.Kind === KindTypeAliasDeclaration || input!.Parent!.Kind === KindJSTypeAliasDeclaration);
  const oldDiag = receiver!.state!.getSymbolAccessibilityDiagnostic;
  if (canProdiceDiagnostic && !receiver!.suppressNewDiagnosticContexts) {
    receiver!.state!.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(input);
  }
  const oldName = receiver!.state!.errorNameNode;
  if (shouldEnterSuppressNewDiagnosticsContextContext) {
    receiver!.suppressNewDiagnosticContexts = true;
  }
  let result: GoPtr<Node>;
  switch (input!.Kind) {
    case KindMappedType:
      result = DeclarationTransformer_transformMappedTypeNode(receiver, AsMappedTypeNode(input));
      break;
    case KindHeritageClause:
      result = DeclarationTransformer_transformHeritageClause(receiver, AsHeritageClause(input));
      break;
    case KindMethodSignature:
      result = DeclarationTransformer_transformMethodSignatureDeclaration(receiver, AsMethodSignatureDeclaration(input));
      break;
    case KindMethodDeclaration:
      result = DeclarationTransformer_transformMethodDeclaration(receiver, AsMethodDeclaration(input));
      break;
    case KindConstructSignature:
      result = DeclarationTransformer_transformConstructSignatureDeclaration(receiver, AsConstructSignatureDeclaration(input));
      break;
    case KindConstructor:
      result = DeclarationTransformer_transformConstructorDeclaration(receiver, AsConstructorDeclaration(input));
      break;
    case KindGetAccessor:
      result = DeclarationTransformer_transformGetAccesorDeclaration(receiver, AsGetAccessorDeclaration(input));
      break;
    case KindSetAccessor:
      result = DeclarationTransformer_transformSetAccessorDeclaration(receiver, AsSetAccessorDeclaration(input));
      break;
    case KindPropertyDeclaration:
      result = DeclarationTransformer_transformPropertyDeclaration(receiver, AsPropertyDeclaration(input));
      break;
    case KindPropertySignature:
      result = DeclarationTransformer_transformPropertySignatureDeclaration(receiver, AsPropertySignatureDeclaration(input));
      break;
    case KindCallSignature:
      result = DeclarationTransformer_transformCallSignatureDeclaration(receiver, AsCallSignatureDeclaration(input));
      break;
    case KindIndexSignature:
      result = DeclarationTransformer_transformIndexSignatureDeclaration(receiver, AsIndexSignatureDeclaration(input));
      break;
    case KindVariableDeclaration:
      result = DeclarationTransformer_transformVariableDeclaration(receiver, AsVariableDeclaration(input));
      break;
    case KindTypeParameter:
      result = DeclarationTransformer_transformTypeParameterDeclaration(receiver, AsTypeParameterDeclaration(input));
      break;
    case KindExpressionWithTypeArguments:
      result = DeclarationTransformer_transformExpressionWithTypeArguments(receiver, AsExpressionWithTypeArguments(input));
      break;
    case KindTypeReference:
      result = DeclarationTransformer_transformTypeReference(receiver, AsTypeReferenceNode(input));
      break;
    case KindConditionalType:
      result = DeclarationTransformer_transformConditionalTypeNode(receiver, AsConditionalTypeNode(input));
      break;
    case KindFunctionType:
      result = DeclarationTransformer_transformFunctionTypeNode(receiver, AsFunctionTypeNode(input));
      break;
    case KindConstructorType:
      result = DeclarationTransformer_transformConstructorTypeNode(receiver, AsConstructorTypeNode(input));
      break;
    case KindImportType:
      result = DeclarationTransformer_transformImportTypeNode(receiver, AsImportTypeNode(input));
      break;
    case KindTypeQuery:
      DeclarationTransformer_checkEntityNameVisibility(receiver, AsTypeQueryNode(input)!.ExprName, receiver!.enclosingDeclaration);
      result = NodeVisitor_VisitEachChild(visitor, input);
      break;
    case KindTupleType: {
      result = NodeVisitor_VisitEachChild(visitor, input);
      if (result !== undefined) {
        if (IsOriginalNodeSingleLine(emitContext, input)) {
          EmitContext_AddEmitFlags(emitContext, result, EFSingleLine);
        }
      }
      break;
    }
    case KindJSDocTypeExpression:
      result = DeclarationTransformer_transformJSDocTypeExpression(receiver, AsJSDocTypeExpression(input));
      break;
    case KindJSDocTypeLiteral:
      result = DeclarationTransformer_transformJSDocTypeLiteral(receiver, AsJSDocTypeLiteral(input));
      break;
    case KindJSDocPropertyTag:
      result = DeclarationTransformer_transformJSDocPropertyTag(receiver, AsJSDocParameterOrPropertyTag(input));
      break;
    case KindJSDocAllType:
      result = DeclarationTransformer_transformJSDocAllType(receiver, AsJSDocAllType(input));
      break;
    case KindJSDocNullableType:
      result = DeclarationTransformer_transformJSDocNullableType(receiver, AsJSDocNullableType(input));
      break;
    case KindJSDocNonNullableType:
      result = DeclarationTransformer_transformJSDocNonNullableType(receiver, AsJSDocNonNullableType(input));
      break;
    case KindJSDocOptionalType:
      result = DeclarationTransformer_transformJSDocOptionalType(receiver, AsJSDocOptionalType(input));
      break;
    case KindJSDocVariadicType:
      result = DeclarationTransformer_transformJSDocVariadicType(receiver, AsJSDocVariadicType(input));
      break;
    default:
      result = NodeVisitor_VisitEachChild(visitor, input);
      break;
  }
  if (result !== undefined && canProdiceDiagnostic && HasDynamicName(input)) {
    DeclarationTransformer_checkName(receiver, input);
  }
  receiver!.enclosingDeclaration = previousEnclosingDeclaration;
  receiver!.state!.getSymbolAccessibilityDiagnostic = oldDiag;
  receiver!.state!.errorNameNode = oldName;
  receiver!.suppressNewDiagnosticContexts = oldWithinObjectLiteralType;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.checkName","kind":"method","status":"implemented","sigHash":"a7497fde72abf74ab4a5b8357a39b8565186ac7eac96fc7f2c341a1c6520c7bf","bodyHash":"104c9ffab3f10fad42b3df88c4500379780ca56ceec07065ec49c227fc6f810e"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) checkName(node *ast.Node) {
 * 	oldDiag := tx.state.getSymbolAccessibilityDiagnostic
 * 	if !tx.suppressNewDiagnosticContexts {
 * 		tx.state.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNodeName(node)
 * 	}
 * 	tx.state.errorNameNode = node.Name()
 * 	debug.Assert(ast.HasDynamicName(node)) // Should only be called with dynamic names
 * 	entityName := node.Name().Expression()
 * 	tx.checkEntityNameVisibility(entityName, tx.enclosingDeclaration)
 * 	if !tx.suppressNewDiagnosticContexts {
 * 		tx.state.getSymbolAccessibilityDiagnostic = oldDiag
 * 	}
 * 	tx.state.errorNameNode = nil
 * }
 */
export function DeclarationTransformer_checkName(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>): void {
  const oldDiag = receiver!.state!.getSymbolAccessibilityDiagnostic;
  if (!receiver!.suppressNewDiagnosticContexts) {
    receiver!.state!.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNodeName(node);
  }
  receiver!.state!.errorNameNode = Node_Name(node);
  // debug.Assert(HasDynamicName(node)) - Should only be called with dynamic names
  const entityName = Node_Expression(Node_Name(node));
  DeclarationTransformer_checkEntityNameVisibility(receiver, entityName, receiver!.enclosingDeclaration);
  if (!receiver!.suppressNewDiagnosticContexts) {
    receiver!.state!.getSymbolAccessibilityDiagnostic = oldDiag;
  }
  receiver!.state!.errorNameNode = undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformMappedTypeNode","kind":"method","status":"implemented","sigHash":"52b6492ec94bb337e2c902bcdf1939faf57fe1452d3587c2cc6abcf7a35cd7ec","bodyHash":"a962239c699f01afb010fee0788a4c90585ab2bc200227dd2a662659d67d7983"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformMappedTypeNode(input *ast.MappedTypeNode) *ast.Node {
 * 	// handle missing template type nodes, since the printer does not
 * 	var typeNode *ast.Node
 * 	if input.Type == nil {
 * 		typeNode = tx.Factory().NewKeywordTypeNode(ast.KindAnyKeyword)
 * 	} else {
 * 		typeNode = tx.Visitor().Visit(input.Type)
 * 	}
 * 	return tx.Factory().UpdateMappedTypeNode(
 * 		input,
 * 		input.ReadonlyToken,
 * 		tx.Visitor().Visit(input.TypeParameter),
 * 		tx.Visitor().Visit(input.NameType),
 * 		input.QuestionToken,
 * 		typeNode,
 * 		nil,
 * 	)
 * }
 */
export function DeclarationTransformer_transformMappedTypeNode(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<MappedTypeNode>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const readonlyToken = input!.ReadonlyToken;
  const typeParameter = NodeVisitor_VisitNode(visitor, input!.TypeParameter);
  const nameType = NodeVisitor_VisitNode(visitor, input!.NameType);
  const questionToken = input!.QuestionToken;
  const typeNode: GoPtr<Node> = input!.Type === undefined
    ? NewKeywordTypeNode(astFactory, KindAnyKeyword)
    : NodeVisitor_VisitNode(visitor, input!.Type);
  if (readonlyToken !== input!.ReadonlyToken || typeParameter !== input!.TypeParameter || nameType !== input!.NameType || questionToken !== input!.QuestionToken || typeNode !== input!.Type) {
    return updateNode(NewMappedTypeNode(astFactory, readonlyToken, typeParameter, nameType, questionToken, typeNode, undefined), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformHeritageClause","kind":"method","status":"implemented","sigHash":"834cdf9f63caa299560b8bbcb7b33e73905189df9567fd8597decc5540bcdb37","bodyHash":"98442cb25ba4e1d8bfe626187b0deb594ec41944f82c39e18091915742e9c042"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformHeritageClause(clause *ast.HeritageClause) *ast.Node {
 * 	retainedClauses := core.Filter(clause.Types.Nodes, func(t *ast.Node) bool {
 * 		return ast.IsEntityNameExpression(t.AsExpressionWithTypeArguments().Expression) ||
 * 			(clause.Token == ast.KindExtendsKeyword && t.Expression().Kind == ast.KindNullKeyword)
 * 	})
 * 	if len(retainedClauses) == 0 {
 * 		return nil // elide empty clause
 * 	}
 * 	if len(retainedClauses) == len(clause.Types.Nodes) {
 * 		return tx.Visitor().VisitEachChild(clause.AsNode())
 * 	}
 * 	return tx.Factory().UpdateHeritageClause(
 * 		clause,
 * 		clause.Token,
 * 		tx.Visitor().VisitNodes(tx.Factory().NewNodeList(retainedClauses)),
 * 	)
 * }
 */
export function DeclarationTransformer_transformHeritageClause(receiver: GoPtr<DeclarationTransformer>, clause: GoPtr<HeritageClause>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const retainedClauses = Filter(clause!.Types!.Nodes, (t: GoPtr<Node>): bool => {
    const ewta = AsExpressionWithTypeArguments(t);
    return (IsEntityNameExpression(ewta!.Expression) ||
      (clause!.Token === KindExtendsKeyword && Node_Expression(t)!.Kind === KindNullKeyword)) as bool;
  });
  if (retainedClauses.length === 0) {
    return undefined;
  }
  if (retainedClauses.length === clause!.Types!.Nodes.length) {
    return NodeVisitor_VisitEachChild(visitor, clause);
  }
  const newTypes = NodeVisitor_VisitNodes(visitor, NodeFactory_NewNodeList(factory!.__tsgoEmbedded0, retainedClauses));
  if (newTypes !== clause!.Types) {
    return updateNode(NewHeritageClause(astFactory, clause!.Token, newTypes), clause, astFactory!.hooks);
  }
  return clause;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformImportTypeNode","kind":"method","status":"implemented","sigHash":"29b26fbab3d12dacd69cefe4d43f092fd0b1ff46722d16400e7ff0b784098c99","bodyHash":"ade96ee3b95336ad7866d414dbdd4ea48ab9adb3431fa34ec9a21061476767f1"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformImportTypeNode(input *ast.ImportTypeNode) *ast.Node {
 * 	if !ast.IsLiteralImportTypeNode(input.AsNode()) {
 * 		return input.AsNode()
 * 	}
 * 	return tx.Factory().UpdateImportTypeNode(
 * 		input,
 * 		input.IsTypeOf,
 * 		tx.Factory().UpdateLiteralTypeNode(
 * 			input.Argument.AsLiteralTypeNode(),
 * 			tx.rewriteModuleSpecifier(input.AsNode(), input.Argument.AsLiteralTypeNode().Literal),
 * 		),
 * 		input.Attributes,
 * 		input.Qualifier,
 * 		tx.Visitor().VisitNodes(input.TypeArguments),
 * 	)
 * }
 */
export function DeclarationTransformer_transformImportTypeNode(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<ImportTypeNode>): GoPtr<Node> {
  if (!IsLiteralImportTypeNode(input)) {
    return input;
  }
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const argLiteral = AsLiteralTypeNode(input!.Argument);
  const newLiteral = DeclarationTransformer_rewriteModuleSpecifier(receiver, input, argLiteral!.Literal);
  // UpdateLiteralTypeNode inline
  const updatedArgument: GoPtr<Node> = newLiteral !== argLiteral!.Literal
    ? updateNode(NewLiteralTypeNode(astFactory, newLiteral), argLiteral, astFactory!.hooks)
    : argLiteral;
  // UpdateImportTypeNode inline
  const typeArguments = NodeVisitor_VisitNodes(Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor, input!.TypeArguments);
  if (updatedArgument !== input!.Argument || typeArguments !== input!.TypeArguments) {
    return updateNode(NewImportTypeNode(astFactory, input!.IsTypeOf, updatedArgument, input!.Attributes, input!.Qualifier, typeArguments), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformConstructorTypeNode","kind":"method","status":"implemented","sigHash":"42d1e84025f1b85ec5dd8e2b8cf8123bf166863271af71930092e10145864453","bodyHash":"b9c3af96c607e7556cd6203233d9ef25a1e03de5c4001e3272a7997c85753a05"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformConstructorTypeNode(input *ast.ConstructorTypeNode) *ast.Node {
 * 	return tx.Factory().UpdateConstructorTypeNode(
 * 		input,
 * 		tx.ensureModifiers(input.AsNode()),
 * 		tx.Visitor().VisitNodes(input.TypeParameters),
 * 		tx.updateParamList(input.AsNode(), input.Parameters),
 * 		tx.Visitor().Visit(input.Type),
 * 	)
 * }
 */
export function DeclarationTransformer_transformConstructorTypeNode(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<ConstructorTypeNode>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
  const typeParameters = NodeVisitor_VisitNodes(visitor, input!.TypeParameters);
  const parameters = DeclarationTransformer_updateParamList(receiver, input, input!.Parameters);
  const type = NodeVisitor_VisitNode(visitor, input!.Type);
  if (modifiers !== input!.modifiers || typeParameters !== input!.TypeParameters || parameters !== input!.Parameters || type !== input!.Type) {
    return updateNode(NewConstructorTypeNode(astFactory, modifiers, typeParameters, parameters, type), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformFunctionTypeNode","kind":"method","status":"implemented","sigHash":"0567e5ba68f837c13aef15e480ca6e258de5e57f65908031874ba6680ccb8e01","bodyHash":"f9ec3d96ec32a3dcbe15a0358421475472c275b5a6d194ed1f46702e69993029"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformFunctionTypeNode(input *ast.FunctionTypeNode) *ast.Node {
 * 	return tx.Factory().UpdateFunctionTypeNode(
 * 		input,
 * 		tx.Visitor().VisitNodes(input.TypeParameters),
 * 		tx.updateParamList(input.AsNode(), input.Parameters),
 * 		tx.Visitor().Visit(input.Type),
 * 	)
 * }
 */
export function DeclarationTransformer_transformFunctionTypeNode(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<FunctionTypeNode>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const typeParameters = NodeVisitor_VisitNodes(visitor, input!.TypeParameters);
  const parameters = DeclarationTransformer_updateParamList(receiver, input, input!.Parameters);
  const type = NodeVisitor_VisitNode(visitor, input!.Type);
  if (typeParameters !== input!.TypeParameters || parameters !== input!.Parameters || type !== input!.Type) {
    return updateNode(NewFunctionTypeNode(astFactory, typeParameters, parameters, type), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformConditionalTypeNode","kind":"method","status":"implemented","sigHash":"b0157319b9ab4d85379bd2763aaedf26f23542cb5c126c97e39dc931db02151d","bodyHash":"205842b556cd857d96bb6e6f56c64456a627c0ab9601e2f668868e1e5d856cd8"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformConditionalTypeNode(input *ast.ConditionalTypeNode) *ast.Node {
 * 	checkType := tx.Visitor().Visit(input.CheckType)
 * 	extendsType := tx.Visitor().Visit(input.ExtendsType)
 * 	oldEnclosingDecl := tx.enclosingDeclaration
 * 	tx.enclosingDeclaration = input.TrueType
 * 	trueType := tx.Visitor().Visit(input.TrueType)
 * 	tx.enclosingDeclaration = oldEnclosingDecl
 * 	falseType := tx.Visitor().Visit(input.FalseType)
 * 
 * 	return tx.Factory().UpdateConditionalTypeNode(
 * 		input,
 * 		checkType,
 * 		extendsType,
 * 		trueType,
 * 		falseType,
 * 	)
 * }
 */
export function DeclarationTransformer_transformConditionalTypeNode(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<ConditionalTypeNode>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const checkType = NodeVisitor_VisitNode(visitor, input!.CheckType);
  const extendsType = NodeVisitor_VisitNode(visitor, input!.ExtendsType);
  const oldEnclosingDecl = receiver!.enclosingDeclaration;
  receiver!.enclosingDeclaration = input!.TrueType;
  const trueType = NodeVisitor_VisitNode(visitor, input!.TrueType);
  receiver!.enclosingDeclaration = oldEnclosingDecl;
  const falseType = NodeVisitor_VisitNode(visitor, input!.FalseType);
  if (checkType !== input!.CheckType || extendsType !== input!.ExtendsType || trueType !== input!.TrueType || falseType !== input!.FalseType) {
    return updateNode(NewConditionalTypeNode(astFactory, checkType, extendsType, trueType, falseType), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformTypeReference","kind":"method","status":"implemented","sigHash":"922462f8c58b1b2968e2a52a49ad35cb0ae31a6603add8114ef6ab83d385d77f","bodyHash":"de415f23e99ca8b8091523668352558fcd23f2a8195b237a0b0e6a57335d9f0e"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformTypeReference(input *ast.TypeReferenceNode) *ast.Node {
 * 	tx.checkEntityNameVisibility(input.TypeName, tx.enclosingDeclaration)
 * 	return tx.Visitor().VisitEachChild(input.AsNode())
 * }
 */
export function DeclarationTransformer_transformTypeReference(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<TypeReferenceNode>): GoPtr<Node> {
  DeclarationTransformer_checkEntityNameVisibility(receiver, input!.TypeName, receiver!.enclosingDeclaration);
  return NodeVisitor_VisitEachChild(Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor, input);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformExpressionWithTypeArguments","kind":"method","status":"implemented","sigHash":"1995a945d227d3d4d3e79a342e1e18913de9af88a2e839ad8e52575c08cea224","bodyHash":"800e5465b0b210ca62f85038881fa1b8f7e11e620029e6a2f4af91f5cd16797f"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformExpressionWithTypeArguments(input *ast.ExpressionWithTypeArguments) *ast.Node {
 * 	if ast.IsEntityName(input.Expression) || ast.IsEntityNameExpression(input.Expression) {
 * 		tx.checkEntityNameVisibility(input.Expression, tx.enclosingDeclaration)
 * 	}
 * 	return tx.Visitor().VisitEachChild(input.AsNode())
 * }
 */
export function DeclarationTransformer_transformExpressionWithTypeArguments(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<ExpressionWithTypeArguments>): GoPtr<Node> {
  if (IsEntityName(input!.Expression) || IsEntityNameExpression(input!.Expression)) {
    DeclarationTransformer_checkEntityNameVisibility(receiver, input!.Expression, receiver!.enclosingDeclaration);
  }
  return NodeVisitor_VisitEachChild(Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor, input);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformTypeParameterDeclaration","kind":"method","status":"implemented","sigHash":"b8be7a427a5ba3931dba346a7fbf9bf2a31c354d28bdd5f253f788b5f585be27","bodyHash":"9a6b3eb66e9755946983da31ab6acf2999e2b0138568cbca4c52d1529b29fcbb"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformTypeParameterDeclaration(input *ast.TypeParameterDeclaration) *ast.Node {
 * 	if isPrivateMethodTypeParameter(tx.host, input) && (input.DefaultType != nil || input.Constraint != nil) {
 * 		return tx.Factory().UpdateTypeParameterDeclaration(
 * 			input,
 * 			input.Modifiers(),
 * 			input.Name(),
 * 			nil,
 * 			input.Expression,
 * 			nil,
 * 		)
 * 	}
 * 	return tx.Visitor().VisitEachChild(input.AsNode())
 * }
 */
export function DeclarationTransformer_transformTypeParameterDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<TypeParameterDeclaration>): GoPtr<Node> {
  if (isPrivateMethodTypeParameter(receiver!.host, input) && (input!.DefaultType !== undefined || input!.Constraint !== undefined)) {
    const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
    const astFactory = factory!.__tsgoEmbedded0;
    return updateNode(NewTypeParameterDeclaration(astFactory, input!.modifiers, input!.name, undefined, input!.Expression, undefined), input, astFactory!.hooks);
  }
  return NodeVisitor_VisitEachChild(Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor, input);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformVariableDeclaration","kind":"method","status":"implemented","sigHash":"04bbf3d7f83926f1174b9cc37c74a4ffcc018e006ffb8926231246acda8920fa","bodyHash":"de70354d8d0809b154fae674b1845adeee12652fe4c5cef36ede42017c736683"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformVariableDeclaration(input *ast.VariableDeclaration) *ast.Node {
 * 	if ast.IsBindingPattern(input.Name()) {
 * 		return tx.recreateBindingPattern(input.Name().AsBindingPattern())
 * 	}
 * 	// Variable declaration types also suppress new diagnostic contexts, provided the contexts wouldn't be made for binding pattern types
 * 	tx.suppressNewDiagnosticContexts = true
 * 	return tx.Factory().UpdateVariableDeclaration(
 * 		input,
 * 		input.Name(),
 * 		nil,
 * 		tx.ensureType(input.AsNode(), false),
 * 		tx.ensureNoInitializer(input.AsNode()),
 * 	)
 * }
 */
export function DeclarationTransformer_transformVariableDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<VariableDeclaration>): GoPtr<Node> {
  if (IsBindingPattern(Node_Name(input))) {
    return DeclarationTransformer_recreateBindingPattern(receiver, AsBindingPattern(Node_Name(input)));
  }
  receiver!.suppressNewDiagnosticContexts = true;
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  // Go: UpdateVariableDeclaration(input, Name, nil /*exclamationToken*/, ...) —
  // the nil exclamation token participates in change detection, so a
  // definite-assignment assertion is always stripped from declaration emit.
  return NodeFactory_UpdateVariableDeclaration(
    astFactory,
    input,
    input!.name,
    undefined,
    DeclarationTransformer_ensureType(receiver, input, false),
    DeclarationTransformer_ensureNoInitializer(receiver, input),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.recreateBindingPattern","kind":"method","status":"implemented","sigHash":"1125fa1c50766c1500a8e84f2966f0bedf74444660e29987991729a2ac2e389d","bodyHash":"3b1d2d422e2a9ada42b3946f10ad11d6b5fd990ececcdfb358032fab486f5abd"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) recreateBindingPattern(input *ast.BindingPattern) *ast.Node {
 * 	var results []*ast.Node
 * 	for _, elem := range input.Elements.Nodes {
 * 		result := tx.recreateBindingElement(elem.AsBindingElement())
 * 		if result == nil {
 * 			continue
 * 		}
 * 		if result.Kind == ast.KindSyntaxList {
 * 			results = append(results, result.AsSyntaxList().Children...)
 * 		} else {
 * 			results = append(results, result)
 * 		}
 * 	}
 * 	if len(results) == 0 {
 * 		return nil
 * 	}
 * 	if len(results) == 1 {
 * 		return results[0]
 * 	}
 * 	return tx.Factory().NewSyntaxList(results)
 * }
 */
export function DeclarationTransformer_recreateBindingPattern(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<BindingPattern>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const results: GoPtr<Node>[] = [];
  for (const elem of input!.Elements!.Nodes) {
    const result = DeclarationTransformer_recreateBindingElement(receiver, AsBindingElement(elem));
    if (result === undefined) {
      continue;
    }
    if (result!.Kind === KindSyntaxList) {
      for (const child of AsSyntaxList(result)!.Children) {
        results.push(child);
      }
    } else {
      results.push(result);
    }
  }
  if (results.length === 0) {
    return undefined;
  }
  if (results.length === 1) {
    return results[0];
  }
  return NewSyntaxList(factory!.__tsgoEmbedded0, results);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.recreateBindingElement","kind":"method","status":"implemented","sigHash":"23c0a77f0de3b7a5c9bada385b3ab36515a28164d248cbf1c11eeba8875aa2e5","bodyHash":"dc430444df98cfd53c2a87944454e7dfa8a9ce9003bcb20fbd38aabd5ead9a4e"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) recreateBindingElement(e *ast.BindingElement) *ast.Node {
 * 	if e.Name() == nil {
 * 		return nil
 * 	}
 * 	if !getBindingNameVisible(tx.resolver, e.AsNode()) {
 * 		return nil
 * 	}
 * 	if ast.IsBindingPattern(e.Name()) {
 * 		return tx.recreateBindingPattern(e.Name().AsBindingPattern())
 * 	}
 * 	return tx.Factory().NewVariableDeclaration(
 * 		e.Name(),
 * 		nil,
 * 		tx.ensureType(e.AsNode(), false),
 * 		nil, // TODO: possible strada bug - not emitting const initialized binding pattern elements?
 * 	)
 * }
 */
export function DeclarationTransformer_recreateBindingElement(receiver: GoPtr<DeclarationTransformer>, e: GoPtr<BindingElement>): GoPtr<Node> {
  if (Node_Name(e) === undefined) {
    return undefined;
  }
  if (!getBindingNameVisible(receiver!.resolver, e)) {
    return undefined;
  }
  if (IsBindingPattern(Node_Name(e))) {
    return DeclarationTransformer_recreateBindingPattern(receiver, AsBindingPattern(Node_Name(e)));
  }
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  return NewVariableDeclaration(astFactory, Node_Name(e), undefined, DeclarationTransformer_ensureType(receiver, e, false), undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformIndexSignatureDeclaration","kind":"method","status":"implemented","sigHash":"b94fc0da393424af5a8163dc60aba9337871da32a4d9116a7832519b6a84f3bb","bodyHash":"85d8d8930884c6f403cb19e7caabff5aa3fdef6745be7a9bfd8a2184c138a3e4"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformIndexSignatureDeclaration(input *ast.IndexSignatureDeclaration) *ast.Node {
 * 	t := tx.Visitor().Visit(input.Type)
 * 	if t == nil {
 * 		t = tx.Factory().NewKeywordTypeNode(ast.KindAnyKeyword)
 * 	}
 * 	return tx.Factory().UpdateIndexSignatureDeclaration(
 * 		input,
 * 		tx.ensureModifiers(input.AsNode()),
 * 		tx.updateParamList(input.AsNode(), input.Parameters),
 * 		t,
 * 	)
 * }
 */
export function DeclarationTransformer_transformIndexSignatureDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<IndexSignatureDeclaration>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  let t: GoPtr<Node> = NodeVisitor_VisitNode(visitor, input!.Type);
  if (t === undefined) {
    t = NewKeywordTypeNode(astFactory, KindAnyKeyword);
  }
  const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
  const parameters = DeclarationTransformer_updateParamList(receiver, input, input!.Parameters);
  if (modifiers !== input!.modifiers || parameters !== input!.Parameters || t !== input!.Type) {
    return updateNode(NewIndexSignatureDeclaration(astFactory, modifiers, parameters, t), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformCallSignatureDeclaration","kind":"method","status":"implemented","sigHash":"54f4e77c220853f6e6788af8c87e021b96fb1c70cc9cb154f189be0a86ad335b","bodyHash":"e075164c1d94aa2b1353f66e011ebfeff71cbfefa3962e605aeee9a9bf8f9984"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformCallSignatureDeclaration(input *ast.CallSignatureDeclaration) *ast.Node {
 * 	return tx.Factory().UpdateCallSignatureDeclaration(
 * 		input,
 * 		tx.ensureTypeParams(input.AsNode(), input.TypeParameters),
 * 		tx.updateParamList(input.AsNode(), input.Parameters),
 * 		tx.ensureType(input.AsNode(), false),
 * 	)
 * }
 */
export function DeclarationTransformer_transformCallSignatureDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<CallSignatureDeclaration>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const typeParameters = DeclarationTransformer_ensureTypeParams(receiver, input, input!.TypeParameters);
  const parameters = DeclarationTransformer_updateParamList(receiver, input, input!.Parameters);
  const typeNode = DeclarationTransformer_ensureType(receiver, input, false);
  if (typeParameters !== input!.TypeParameters || parameters !== input!.Parameters || typeNode !== input!.Type) {
    return updateNode(NewCallSignatureDeclaration(astFactory, typeParameters, parameters, typeNode), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformPropertySignatureDeclaration","kind":"method","status":"implemented","sigHash":"522bb2a544bfe7937acef9cfcc889959d11b783893f1957b6587a827cb3d851b","bodyHash":"ddd8bdad69dc7db2876aff493b631fc38798078a0d65ec45b9647d452ca99b76"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformPropertySignatureDeclaration(input *ast.PropertySignatureDeclaration) *ast.Node {
 * 	if ast.IsPrivateIdentifier(input.Name()) {
 * 		return nil
 * 	}
 * 	return tx.Factory().UpdatePropertySignatureDeclaration(
 * 		input,
 * 		tx.ensureModifiers(input.AsNode()),
 * 		input.Name(),
 * 		input.PostfixToken,
 * 		tx.ensureType(input.AsNode(), false),
 * 		tx.ensureNoInitializer(input.AsNode()), // TODO: possible strada bug (fixed here) - const property signatures never initialized
 * 	)
 * }
 */
export function DeclarationTransformer_transformPropertySignatureDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<PropertySignatureDeclaration>): GoPtr<Node> {
  if (IsPrivateIdentifier(Node_Name(input))) {
    return undefined;
  }
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
  const typeNode = DeclarationTransformer_ensureType(receiver, input, false);
  const initializer = DeclarationTransformer_ensureNoInitializer(receiver, input);
  if (modifiers !== input!.modifiers || typeNode !== input!.Type || initializer !== input!.Initializer) {
    return updateNode(NewPropertySignatureDeclaration(astFactory, modifiers, input!.name, input!.PostfixToken, typeNode, initializer), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformPropertyDeclaration","kind":"method","status":"implemented","sigHash":"8a4d9ca14fe9b97094b5855675e42baf0f351b98efbcbb3de5cd5736f536717d","bodyHash":"c83d92ed4fdf67dbe90655b43fb06ba3d20bfde514b25c10dc2b9e80618e020b"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformPropertyDeclaration(input *ast.PropertyDeclaration) *ast.Node {
 * 	if ast.IsPrivateIdentifier(input.Name()) {
 * 		return nil
 * 	}
 * 	// Remove definite assignment assertion (!) from declaration files
 * 	postfixToken := input.PostfixToken
 * 	if postfixToken != nil && postfixToken.Kind == ast.KindExclamationToken {
 * 		postfixToken = nil
 * 	}
 * 	return tx.Factory().UpdatePropertyDeclaration(
 * 		input,
 * 		tx.ensureModifiers(input.AsNode()),
 * 		input.Name(),
 * 		postfixToken,
 * 		tx.ensureType(input.AsNode(), false),
 * 		tx.ensureNoInitializer(input.AsNode()),
 * 	)
 * }
 */
export function DeclarationTransformer_transformPropertyDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<PropertyDeclaration>): GoPtr<Node> {
  if (IsPrivateIdentifier(Node_Name(input))) {
    return undefined;
  }
  // Remove definite assignment assertion (!) from declaration files
  const postfixToken = (input!.PostfixToken !== undefined && input!.PostfixToken.Kind === KindExclamationToken) ? undefined : input!.PostfixToken;
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
  const typeNode = DeclarationTransformer_ensureType(receiver, input, false);
  const initializer = DeclarationTransformer_ensureNoInitializer(receiver, input);
  if (modifiers !== input!.modifiers || postfixToken !== input!.PostfixToken || typeNode !== input!.Type || initializer !== input!.Initializer) {
    return updateNode(NewPropertyDeclaration(astFactory, modifiers, input!.name, postfixToken, typeNode, initializer), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformSetAccessorDeclaration","kind":"method","status":"implemented","sigHash":"352bbcefa7ce7052e74eed9cc455618c60fb98357f451670958ebe652007d76f","bodyHash":"b74f2622d782884740b5bcec548f770201bd780a4ea850c630a5f6a7bd4f6db4"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformSetAccessorDeclaration(input *ast.SetAccessorDeclaration) *ast.Node {
 * 	if ast.IsPrivateIdentifier(input.Name()) {
 * 		return nil
 * 	}
 * 
 * 	return tx.Factory().UpdateSetAccessorDeclaration(
 * 		input,
 * 		tx.ensureModifiers(input.AsNode()),
 * 		input.Name(),
 * 		nil, // accessors shouldn't have type params
 * 		tx.updateAccessorParamList(input.AsNode(), tx.host.GetEffectiveDeclarationFlags(tx.EmitContext().ParseNode(input.AsNode()), ast.ModifierFlagsPrivate) != 0),
 * 		nil,
 * 		nil,
 * 		nil,
 * 	)
 * }
 */
export function DeclarationTransformer_transformSetAccessorDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<SetAccessorDeclaration>): GoPtr<Node> {
  if (IsPrivateIdentifier(Node_Name(input))) {
    return undefined;
  }
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
  const isPrivate = receiver!.host.GetEffectiveDeclarationFlags(EmitContext_ParseNode(Transformer_EmitContext(receiver!.__tsgoEmbedded0), input), ModifierFlagsPrivate) !== 0;
  const params = DeclarationTransformer_updateAccessorParamList(receiver, input, isPrivate);
  if (modifiers !== input!.modifiers || params !== input!.Parameters) {
    return updateNode(NewSetAccessorDeclaration(astFactory, modifiers, input!.name, undefined, params, undefined, undefined, undefined), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformGetAccesorDeclaration","kind":"method","status":"implemented","sigHash":"214da66304ac8d45163fde4330368d6fee5c80cc1e9dcc0c6c2d789e88891224","bodyHash":"520804d6741b291ccb0a56e77bca3bef2e30a07fa834468536bd583f00eac496"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformGetAccesorDeclaration(input *ast.GetAccessorDeclaration) *ast.Node {
 * 	if ast.IsPrivateIdentifier(input.Name()) {
 * 		return nil
 * 	}
 * 	return tx.Factory().UpdateGetAccessorDeclaration(
 * 		input,
 * 		tx.ensureModifiers(input.AsNode()),
 * 		input.Name(),
 * 		nil, // accessors shouldn't have type params
 * 		tx.updateAccessorParamList(input.AsNode(), tx.host.GetEffectiveDeclarationFlags(tx.EmitContext().ParseNode(input.AsNode()), ast.ModifierFlagsPrivate) != 0),
 * 		tx.ensureType(input.AsNode(), false),
 * 		nil,
 * 		nil,
 * 	)
 * }
 */
export function DeclarationTransformer_transformGetAccesorDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<GetAccessorDeclaration>): GoPtr<Node> {
  if (IsPrivateIdentifier(Node_Name(input))) {
    return undefined;
  }
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
  const isPrivate = receiver!.host.GetEffectiveDeclarationFlags(EmitContext_ParseNode(Transformer_EmitContext(receiver!.__tsgoEmbedded0), input), ModifierFlagsPrivate) !== 0;
  const params = DeclarationTransformer_updateAccessorParamList(receiver, input, isPrivate);
  const typeNode = DeclarationTransformer_ensureType(receiver, input, false);
  if (modifiers !== input!.modifiers || params !== input!.Parameters || typeNode !== input!.Type) {
    return updateNode(NewGetAccessorDeclaration(astFactory, modifiers, input!.name, undefined, params, typeNode, undefined, undefined), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.updateAccessorParamList","kind":"method","status":"implemented","sigHash":"ad9b5a33496d54dc9ac74bf63943410d4c5a4892cde761e35f885378952a5a08","bodyHash":"2618e2ec4b529f7adf03c465b8eb93f6815d34ca4ecb92ff5a65ba30b1e93b42"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) updateAccessorParamList(input *ast.Node, isPrivate bool) *ast.ParameterList {
 * 	var newParams []*ast.Node
 * 	if !isPrivate {
 * 		thisParam := ast.GetThisParameter(input)
 * 		if thisParam != nil {
 * 			newParams = append(newParams, tx.ensureParameter(thisParam.AsParameterDeclaration()))
 * 		}
 * 	}
 * 	if ast.IsSetAccessorDeclaration(input) {
 * 		var valueParam *ast.Node
 * 		if !isPrivate {
 * 			if len(newParams) == 1 && len(input.AsSetAccessorDeclaration().Parameters.Nodes) >= 2 {
 * 				valueParam = tx.ensureParameter(input.AsSetAccessorDeclaration().Parameters.Nodes[1].AsParameterDeclaration())
 * 			} else if len(newParams) == 0 && len(input.AsSetAccessorDeclaration().Parameters.Nodes) >= 1 {
 * 				valueParam = tx.ensureParameter(input.AsSetAccessorDeclaration().Parameters.Nodes[0].AsParameterDeclaration())
 * 			}
 * 		}
 * 		if valueParam == nil {
 * 			// TODO: strada bug - no type printed on set accessor missing arg as though private
 * 			var t *ast.Node
 * 			if !isPrivate {
 * 				t = tx.Factory().NewKeywordExpression(ast.KindAnyKeyword)
 * 			}
 * 			valueParam = tx.Factory().NewParameterDeclaration(
 * 				nil,
 * 				nil,
 * 				tx.Factory().NewIdentifier("value"),
 * 				nil,
 * 				t,
 * 				nil,
 * 			)
 * 		}
 * 		newParams = append(newParams, valueParam)
 * 	}
 * 	return tx.Factory().NewNodeList(newParams)
 * }
 */
export function DeclarationTransformer_updateAccessorParamList(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<Node>, isPrivate: bool): GoPtr<ParameterList> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const newParams: GoPtr<Node>[] = [];
  if (!isPrivate) {
    const thisParam = GetThisParameter(input);
    if (thisParam !== undefined) {
      newParams.push(DeclarationTransformer_ensureParameter(receiver, AsParameterDeclaration(thisParam)));
    }
  }
  if (IsSetAccessorDeclaration(input)) {
    const setter = AsSetAccessorDeclaration(input);
    const paramNodes = setter!.Parameters?.Nodes ?? [];
    let valueParam: GoPtr<Node>;
    if (!isPrivate) {
      if (newParams.length === 1 && paramNodes.length >= 2) {
        valueParam = DeclarationTransformer_ensureParameter(receiver, AsParameterDeclaration(paramNodes[1]));
      } else if (newParams.length === 0 && paramNodes.length >= 1) {
        valueParam = DeclarationTransformer_ensureParameter(receiver, AsParameterDeclaration(paramNodes[0]));
      }
    }
    if (valueParam === undefined) {
      // TODO: strada bug - no type printed on set accessor missing arg as though private
      const t = !isPrivate ? NewKeywordExpression(astFactory, KindAnyKeyword) : undefined;
      valueParam = NewParameterDeclaration(astFactory, undefined, undefined, NewIdentifier(astFactory, "value"), undefined, t, undefined);
    }
    newParams.push(valueParam);
  }
  return NodeFactory_NewNodeList(astFactory, newParams) as GoPtr<ParameterList>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformConstructorDeclaration","kind":"method","status":"implemented","sigHash":"b827db6de14068d1e79160b2912655dadebcb002e803bc95e1a8d504b65877bb","bodyHash":"b060838502c14c62f76bc649b8c1ea35fddd6187ffd3cd262f39850129c414b5"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformConstructorDeclaration(input *ast.ConstructorDeclaration) *ast.Node {
 * 	// A constructor declaration may not have a type annotation
 * 	return tx.Factory().UpdateConstructorDeclaration(
 * 		input,
 * 		tx.ensureModifiers(input.AsNode()),
 * 		nil, // no type params
 * 		tx.updateParamList(input.AsNode(), input.Parameters),
 * 		nil, // no return type
 * 		nil,
 * 		nil,
 * 	)
 * }
 */
export function DeclarationTransformer_transformConstructorDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<ConstructorDeclaration>): GoPtr<Node> {
  // A constructor declaration may not have a type annotation
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
  const params = DeclarationTransformer_updateParamList(receiver, input, input!.Parameters);
  if (modifiers !== input!.modifiers || params !== input!.Parameters) {
    return updateNode(NewConstructorDeclaration(astFactory, modifiers, undefined, params, undefined, undefined, undefined), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformConstructSignatureDeclaration","kind":"method","status":"implemented","sigHash":"342fd73a827109218501b011c1fa2ee48495a1ab3b6bd5d75ec00b43a607875e","bodyHash":"e49359be65a11832be08123702dd1ef22d03c3f7cccf9e62307ade59f312297e"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformConstructSignatureDeclaration(input *ast.ConstructSignatureDeclaration) *ast.Node {
 * 	return tx.Factory().UpdateConstructSignatureDeclaration(
 * 		input,
 * 		tx.ensureTypeParams(input.AsNode(), input.TypeParameters),
 * 		tx.updateParamList(input.AsNode(), input.Parameters),
 * 		tx.ensureType(input.AsNode(), false),
 * 	)
 * }
 */
export function DeclarationTransformer_transformConstructSignatureDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<ConstructSignatureDeclaration>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const typeParams = DeclarationTransformer_ensureTypeParams(receiver, input, input!.TypeParameters);
  const params = DeclarationTransformer_updateParamList(receiver, input, input!.Parameters);
  const typeNode = DeclarationTransformer_ensureType(receiver, input, false);
  if (typeParams !== input!.TypeParameters || params !== input!.Parameters || typeNode !== input!.Type) {
    return updateNode(NewConstructSignatureDeclaration(astFactory, typeParams, params, typeNode), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.omitPrivateMethodType","kind":"method","status":"implemented","sigHash":"b62f22a38ac92ba190573a736ad7f25b4d8a6e6f8d3cc5b3c6801cbae46e0f67","bodyHash":"bf6d28a7f58e487765df634d48796b5358bcf9a675381d2286f060b04b882557"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) omitPrivateMethodType(input *ast.Node) *ast.Node {
 * 	if input.Symbol() != nil && len(input.Symbol().Declarations) > 0 && input.Symbol().Declarations[0] != input {
 * 		return nil
 * 	} else {
 * 		return tx.Factory().NewPropertyDeclaration(
 * 			tx.ensureModifiers(input),
 * 			input.Name(),
 * 			nil,
 * 			nil,
 * 			nil,
 * 		)
 * 	}
 * }
 */
export function DeclarationTransformer_omitPrivateMethodType(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<Node>): GoPtr<Node> {
  const sym = Node_Symbol(input);
  if (sym !== undefined && (sym.Declarations?.length ?? 0) > 0 && sym.Declarations![0] !== input) {
    return undefined;
  }
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const result = NewPropertyDeclaration(astFactory, DeclarationTransformer_ensureModifiers(receiver, input), Node_Name(input), undefined, undefined, undefined);
  DeclarationTransformer_preserveJsDoc(receiver, result, input);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformMethodSignatureDeclaration","kind":"method","status":"implemented","sigHash":"c04a965edd68f122a47501c3af7aacc12b1a0bb991872dc8a044423b57c1082e","bodyHash":"aae1336b137dc5df6f819bc0de5b83517f2260306c04dd3b8f0eca0f8e6e3854"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformMethodSignatureDeclaration(input *ast.MethodSignatureDeclaration) *ast.Node {
 * 	if tx.host.GetEffectiveDeclarationFlags(tx.EmitContext().ParseNode(input.AsNode()), ast.ModifierFlagsPrivate) != 0 {
 * 		return tx.omitPrivateMethodType(input.AsNode())
 * 	} else if ast.IsPrivateIdentifier(input.Name()) {
 * 		return nil
 * 	} else {
 * 		return tx.Factory().UpdateMethodSignatureDeclaration(
 * 			input,
 * 			tx.ensureModifiers(input.AsNode()),
 * 			input.Name(),
 * 			input.PostfixToken,
 * 			tx.ensureTypeParams(input.AsNode(), input.TypeParameters),
 * 			tx.updateParamList(input.AsNode(), input.Parameters),
 * 			tx.ensureType(input.AsNode(), false),
 * 		)
 * 	}
 * }
 */
export function DeclarationTransformer_transformMethodSignatureDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<MethodSignatureDeclaration>): GoPtr<Node> {
  if (receiver!.host.GetEffectiveDeclarationFlags(EmitContext_ParseNode(Transformer_EmitContext(receiver!.__tsgoEmbedded0), input), ModifierFlagsPrivate) !== 0) {
    return DeclarationTransformer_omitPrivateMethodType(receiver, input);
  } else if (IsPrivateIdentifier(Node_Name(input))) {
    return undefined;
  } else {
    const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
    const astFactory = factory!.__tsgoEmbedded0;
    const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
    const typeParams = DeclarationTransformer_ensureTypeParams(receiver, input, input!.TypeParameters);
    const params = DeclarationTransformer_updateParamList(receiver, input, input!.Parameters);
    const typeNode = DeclarationTransformer_ensureType(receiver, input, false);
    if (modifiers !== input!.modifiers || typeParams !== input!.TypeParameters || params !== input!.Parameters || typeNode !== input!.Type) {
      return updateNode(NewMethodSignatureDeclaration(astFactory, modifiers, input!.name, input!.PostfixToken, typeParams, params, typeNode), input, astFactory!.hooks);
    }
    return input;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformMethodDeclaration","kind":"method","status":"implemented","sigHash":"c3e06aeccaa82a22c49e38e9078cdeed9923178a85ea0eba31097d65c826c978","bodyHash":"8213a590f8cf68d5af40a182c764caaa16bce52c1ace2054972620f6a8ff62cb"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformMethodDeclaration(input *ast.MethodDeclaration) *ast.Node {
 * 	if tx.host.GetEffectiveDeclarationFlags(tx.EmitContext().ParseNode(input.AsNode()), ast.ModifierFlagsPrivate) != 0 {
 * 		return tx.omitPrivateMethodType(input.AsNode())
 * 	} else if ast.IsPrivateIdentifier(input.Name()) {
 * 		return nil
 * 	} else {
 * 		return tx.Factory().UpdateMethodDeclaration(
 * 			input,
 * 			tx.ensureModifiers(input.AsNode()),
 * 			nil,
 * 			input.Name(),
 * 			input.PostfixToken,
 * 			tx.ensureTypeParams(input.AsNode(), input.TypeParameters),
 * 			tx.updateParamList(input.AsNode(), input.Parameters),
 * 			tx.ensureType(input.AsNode(), false),
 * 			nil,
 * 			nil,
 * 		)
 * 	}
 * }
 */
export function DeclarationTransformer_transformMethodDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<MethodDeclaration>): GoPtr<Node> {
  if (receiver!.host.GetEffectiveDeclarationFlags(EmitContext_ParseNode(Transformer_EmitContext(receiver!.__tsgoEmbedded0), input), ModifierFlagsPrivate) !== 0) {
    return DeclarationTransformer_omitPrivateMethodType(receiver, input);
  } else if (IsPrivateIdentifier(Node_Name(input))) {
    return undefined;
  } else {
    const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
    const astFactory = factory!.__tsgoEmbedded0;
    const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
    const typeParams = DeclarationTransformer_ensureTypeParams(receiver, input, input!.TypeParameters);
    const params = DeclarationTransformer_updateParamList(receiver, input, input!.Parameters);
    const typeNode = DeclarationTransformer_ensureType(receiver, input, false);
    if (modifiers !== input!.modifiers || typeParams !== input!.TypeParameters || params !== input!.Parameters || typeNode !== input!.Type) {
      return updateNode(NewMethodDeclaration(astFactory, modifiers, undefined, input!.name, input!.PostfixToken, typeParams, params, typeNode, undefined, undefined), input, astFactory!.hooks);
    }
    return input;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.visitDeclarationStatements","kind":"method","status":"implemented","sigHash":"f56f3be8edb63ba80f84d18311cd633c40ff952e4c36da47d7ef6da4529a86a3","bodyHash":"1800e7ecfd209b8a3666939760d4399f84a2a2833bc2767cfdb2c1a4253384b4"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) visitDeclarationStatements(input *ast.Node) *ast.Node {
 * 	if tx.shouldStripInternal(input) {
 * 		return nil
 * 	}
 * 	switch input.Kind {
 * 	case ast.KindExportDeclaration:
 * 		if ast.IsSourceFile(input.Parent) {
 * 			tx.resultHasExternalModuleIndicator = true
 * 		}
 * 		tx.resultHasScopeMarker = true
 * 		// Rewrite external module names if necessary
 * 		return tx.Factory().UpdateExportDeclaration(
 * 			input.AsExportDeclaration(),
 * 			input.Modifiers(),
 * 			input.IsTypeOnly(),
 * 			input.AsExportDeclaration().ExportClause,
 * 			tx.rewriteModuleSpecifier(input, input.ModuleSpecifier()),
 * 			tx.tryGetResolutionModeOverride(input.AsExportDeclaration().Attributes),
 * 		)
 * 	case ast.KindExportAssignment:
 * 		return tx.transformExportAssignment(input, input, input.Expression(), input.AsExportAssignment().IsExportEquals)
 * 	default:
 * 		id := ast.GetNodeId(tx.EmitContext().MostOriginal(input))
 * 		if tx.lateStatementReplacementMap[id] == nil {
 * 			// Don't actually transform yet; just leave as original node - will be elided/swapped by late pass
 * 			tx.lateStatementReplacementMap[id] = tx.transformTopLevelDeclaration(input)
 * 		}
 * 		return input
 * 	}
 * }
 */
export function DeclarationTransformer_visitDeclarationStatements(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<Node>): GoPtr<Node> {
  if (DeclarationTransformer_shouldStripInternal(receiver, input)) {
    return undefined;
  }
  switch (input!.Kind) {
    case KindExportDeclaration: {
      if (IsSourceFile(input!.Parent)) {
        receiver!.resultHasExternalModuleIndicator = true;
      }
      receiver!.resultHasScopeMarker = true;
      // Rewrite external module names if necessary
      const exportDecl = AsExportDeclaration(input);
      const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
      const astFactory = factory!.__tsgoEmbedded0;
      const newModuleSpec = DeclarationTransformer_rewriteModuleSpecifier(receiver, input, Node_ModuleSpecifier(input));
      const newAttribs = DeclarationTransformer_tryGetResolutionModeOverride(receiver, exportDecl!.Attributes);
      if (newModuleSpec !== exportDecl!.ModuleSpecifier || newAttribs !== exportDecl!.Attributes) {
        return updateNode(NewExportDeclaration(astFactory, Node_Modifiers(input), Node_IsTypeOnly(input), exportDecl!.ExportClause, newModuleSpec, newAttribs), input, astFactory!.hooks);
      }
      return input;
    }
    case KindExportAssignment: {
      const exportAssign = AsExportAssignment(input);
      return DeclarationTransformer_transformExportAssignment(receiver, input, input, Node_Expression(input), exportAssign!.IsExportEquals);
    }
    default: {
      const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
      const id = GetNodeId(EmitContext_MostOriginal(emitContext, input));
      if (receiver!.lateStatementReplacementMap.get(id) === undefined) {
        // Don't actually transform yet; just leave as original node - will be elided/swapped by late pass
        receiver!.lateStatementReplacementMap.set(id, DeclarationTransformer_transformTopLevelDeclaration(receiver, input));
      }
      return input;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformExportAssignment","kind":"method","status":"implemented","sigHash":"116aa532194c7c3f95e9465143acdb92bd5dff1afad0b886120a3c367475cb78","bodyHash":"f1a5ef4f0aaea87939ebe2b3b482255efa9705c244b4e72c141e6f7dd9664d31"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformExportAssignment(input *ast.Node, assignment *ast.Node, expression *ast.Node, isExportEquals bool) *ast.Node {
 * 	if ast.IsSourceFile(input.Parent) {
 * 		tx.resultHasExternalModuleIndicator = true
 * 	}
 * 	tx.resultHasScopeMarker = true
 * 	if ast.IsIdentifier(expression) {
 * 		exportAssignment := tx.Factory().NewExportAssignment(nil, isExportEquals, nil, expression)
 * 		tx.preserveJsDoc(exportAssignment, input)
 * 		return exportAssignment
 * 	}
 * 	// expression is non-identifier, create _default typed variable to reference
 * 	newId := tx.Factory().NewUniqueNameEx("_default", printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsOptimistic})
 * 	tx.state.getSymbolAccessibilityDiagnostic = func(_ printer.SymbolAccessibilityResult) *SymbolAccessibilityDiagnostic {
 * 		return &SymbolAccessibilityDiagnostic{
 * 			diagnosticMessage: diagnostics.Default_export_of_the_module_has_or_is_using_private_name_0,
 * 			errorNode:         input,
 * 		}
 * 	}
 * 	tx.tracker.PushErrorFallbackNode(assignment)
 * 	var type_, initializer *ast.Node
 * 	if ast.IsPrimitiveLiteralValue(unwrapParenthesizedExpression(expression), true) {
 * 		initializer = tx.resolver.CreateLiteralConstValue(tx.EmitContext(), tx.EmitContext().ParseNode(assignment), tx.tracker)
 * 	}
 * 	if initializer == nil {
 * 		type_ = tx.ensureType(assignment, false)
 * 	}
 * 	varDecl := tx.Factory().NewVariableDeclaration(newId, nil, type_, initializer)
 * 	tx.tracker.PopErrorFallbackNode()
 * 	var modList *ast.ModifierList
 * 	if tx.needsDeclare {
 * 		modList = tx.Factory().NewModifierList([]*ast.Node{tx.Factory().NewModifier(ast.KindDeclareKeyword)})
 * 	} else {
 * 		modList = tx.Factory().NewModifierList([]*ast.Node{})
 * 	}
 * 	statement := tx.Factory().NewVariableStatement(modList, tx.Factory().NewVariableDeclarationList(tx.Factory().NewNodeList([]*ast.Node{varDecl}), ast.NodeFlagsConst))
 * 	exportAssignment := tx.Factory().NewExportAssignment(nil, isExportEquals, nil, newId)
 * 	// Remove comments from the export declaration and copy them onto the synthetic _default declaration
 * 	tx.preserveJsDoc(statement, input)
 * 	return tx.Factory().NewSyntaxList([]*ast.Node{statement, exportAssignment})
 * }
 */
export function DeclarationTransformer_transformExportAssignment(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<Node>, assignment: GoPtr<Node>, expression: GoPtr<Node>, isExportEquals: bool): GoPtr<Node> {
  if (IsSourceFile(input!.Parent)) {
    receiver!.resultHasExternalModuleIndicator = true;
  }
  receiver!.resultHasScopeMarker = true;
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  if (IsIdentifier(expression)) {
    const exportAssignment = NewExportAssignment(astFactory, undefined, isExportEquals, undefined, expression);
    DeclarationTransformer_preserveJsDoc(receiver, exportAssignment, input);
    return exportAssignment;
  }
  // expression is non-identifier, create _default typed variable to reference
  const newId = NodeFactory_NewUniqueNameEx(factory, "_default", { Flags: GeneratedIdentifierFlagsOptimistic, Prefix: "", Suffix: "" });
  receiver!.state!.getSymbolAccessibilityDiagnostic = (_result) => ({
    diagnosticMessage: diagnosticMessages.Default_export_of_the_module_has_or_is_using_private_name_0,
    errorNode: input,
    typeName: undefined,
  });
  SymbolTrackerImpl_PushErrorFallbackNode(receiver!.tracker, assignment);
  let type_: GoPtr<Node>;
  let initializer: GoPtr<Node>;
  if (IsPrimitiveLiteralValue(unwrapParenthesizedExpression(expression), true as bool)) {
    initializer = receiver!.resolver.CreateLiteralConstValue(emitContext, EmitContext_ParseNode(emitContext, assignment), SymbolTrackerImpl_AsSymbolTracker(receiver!.tracker));
  }
  if (initializer === undefined) {
    type_ = DeclarationTransformer_ensureType(receiver, assignment, false);
  }
  const varDecl = NewVariableDeclaration(astFactory, newId, undefined, type_, initializer);
  SymbolTrackerImpl_PopErrorFallbackNode(receiver!.tracker);
  const modNodes = receiver!.needsDeclare
    ? [NodeFactory_NewModifier(astFactory, KindDeclareKeyword)]
    : [];
  const modList = NodeFactory_NewModifierList(astFactory, modNodes);
  const declList = NewVariableDeclarationList(astFactory, NodeFactory_NewNodeList(astFactory, [varDecl]) as GoPtr<VariableDeclarationNodeList>, NodeFlagsConst);
  const statement = NewVariableStatement(astFactory, modList, declList);
  const exportAssignment = NewExportAssignment(astFactory, undefined, isExportEquals, undefined, newId);
  // Remove comments from the export declaration and copy them onto the synthetic _default declaration
  DeclarationTransformer_preserveJsDoc(receiver, statement, input);
  return NewSyntaxList(astFactory, [statement, exportAssignment]);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformCommonJSExport","kind":"method","status":"implemented","sigHash":"070ef0ffb0240015196469d233cd46752736cefca9858b5dab5940e04b720627","bodyHash":"6f9f2181fc6d015a165803133561ac092cd2e404c381974a98d8a030e4a928bc"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformCommonJSExport(input *ast.Node, name *ast.Node) *ast.Node {
 * 	tx.resultHasExternalModuleIndicator = true
 * 	tx.resultHasScopeMarker = true
 * 	if isCommonJSAliasExport(input) {
 * 		// export { name }
 * 		// export { source as name }
 * 		propertyName := input.AsBinaryExpression().Right
 * 		if ast.IsIdentifier(name) && propertyName.Text() == name.Text() {
 * 			propertyName = nil
 * 		}
 * 		exportSpecifier := tx.Factory().NewExportSpecifier(false, propertyName, name)
 * 		return tx.Factory().NewExportDeclaration(nil, false, tx.Factory().NewNamedExports(tx.Factory().NewNodeList([]*ast.Node{exportSpecifier})), nil, nil)
 * 	} else if ast.IsIdentifier(name) {
 * 		if name.Text() == "default" {
 * 			// const _default: Type; export default _default;
 * 			newId := tx.Factory().NewUniqueNameEx("_default", printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsOptimistic})
 * 			tx.state.getSymbolAccessibilityDiagnostic = func(_ printer.SymbolAccessibilityResult) *SymbolAccessibilityDiagnostic {
 * 				return &SymbolAccessibilityDiagnostic{
 * 					diagnosticMessage: diagnostics.Default_export_of_the_module_has_or_is_using_private_name_0,
 * 					errorNode:         input,
 * 				}
 * 			}
 * 			tx.tracker.PushErrorFallbackNode(input)
 * 			type_ := tx.ensureType(input, false)
 * 			varDecl := tx.Factory().NewVariableDeclaration(newId, nil, type_, nil)
 * 			tx.tracker.PopErrorFallbackNode()
 * 			var modList *ast.ModifierList
 * 			if tx.needsDeclare {
 * 				modList = tx.Factory().NewModifierList([]*ast.Node{tx.Factory().NewModifier(ast.KindDeclareKeyword)})
 * 			} else {
 * 				modList = tx.Factory().NewModifierList([]*ast.Node{})
 * 			}
 * 			statement := tx.Factory().NewVariableStatement(modList, tx.Factory().NewVariableDeclarationList(tx.Factory().NewNodeList([]*ast.Node{varDecl}), ast.NodeFlagsConst))
 * 
 * 			assignment := tx.Factory().NewExportAssignment(input.Modifiers(), false, nil, newId)
 * 			// Remove comments from the export declaration and copy them onto the synthetic _default declaration
 * 			tx.preserveJsDoc(statement, input)
 * 			tx.removeAllComments(assignment)
 * 			return tx.Factory().NewSyntaxList([]*ast.Node{statement, assignment})
 * 		} else {
 * 			// export var name: Type
 * 			tx.tracker.PushErrorFallbackNode(input)
 * 			type_ := tx.ensureType(input, false)
 * 			varDecl := tx.Factory().NewVariableDeclaration(name, nil, type_, nil)
 * 			tx.tracker.PopErrorFallbackNode()
 * 			var modList *ast.ModifierList
 * 			if tx.needsDeclare {
 * 				modList = tx.Factory().NewModifierList([]*ast.Node{tx.Factory().NewModifier(ast.KindExportKeyword), tx.Factory().NewModifier(ast.KindDeclareKeyword)})
 * 			} else {
 * 				modList = tx.Factory().NewModifierList([]*ast.Node{tx.Factory().NewModifier(ast.KindExportKeyword)})
 * 			}
 * 			return tx.Factory().NewVariableStatement(modList, tx.Factory().NewVariableDeclarationList(tx.Factory().NewNodeList([]*ast.Node{varDecl}), ast.NodeFlagsNone))
 * 		}
 * 	} else {
 * 		// const _exported: Type; export {_exported as "name"};
 * 		newId := tx.Factory().NewUniqueNameEx("_exported", printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsOptimistic})
 * 		tx.state.getSymbolAccessibilityDiagnostic = func(_ printer.SymbolAccessibilityResult) *SymbolAccessibilityDiagnostic {
 * 			return &SymbolAccessibilityDiagnostic{
 * 				diagnosticMessage: diagnostics.Default_export_of_the_module_has_or_is_using_private_name_0,
 * 				errorNode:         input,
 * 			}
 * 		}
 * 		tx.tracker.PushErrorFallbackNode(input)
 * 		type_ := tx.ensureType(input, false)
 * 		varDecl := tx.Factory().NewVariableDeclaration(newId, nil, type_, nil)
 * 		tx.tracker.PopErrorFallbackNode()
 * 		var modList *ast.ModifierList
 * 		if tx.needsDeclare {
 * 			modList = tx.Factory().NewModifierList([]*ast.Node{tx.Factory().NewModifier(ast.KindDeclareKeyword)})
 * 		} else {
 * 			modList = tx.Factory().NewModifierList([]*ast.Node{})
 * 		}
 * 		statement := tx.Factory().NewVariableStatement(modList, tx.Factory().NewVariableDeclarationList(tx.Factory().NewNodeList([]*ast.Node{varDecl}), ast.NodeFlagsConst))
 * 
 * 		assignment := tx.Factory().NewExportDeclaration(nil, false, tx.Factory().NewNamedExports(tx.Factory().NewNodeList([]*ast.Node{tx.Factory().NewExportSpecifier(false, newId, name)})), nil, nil)
 * 		// Remove comments from the export declaration and copy them onto the synthetic _default declaration
 * 		tx.preserveJsDoc(statement, input)
 * 		tx.removeAllComments(assignment)
 * 		return tx.Factory().NewSyntaxList([]*ast.Node{statement, assignment})
 * 	}
 * }
 */
export function DeclarationTransformer_transformCommonJSExport(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<Node>, name: GoPtr<Node>): GoPtr<Node> {
  receiver!.resultHasExternalModuleIndicator = true;
  receiver!.resultHasScopeMarker = true;
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  if (isCommonJSAliasExport(input)) {
    // export { name }
    // export { source as name }
    const binaryRight = AsBinaryExpression(input)!.Right;
    const propertyName = (IsIdentifier(name) && Node_Text(binaryRight) === Node_Text(name)) ? undefined : binaryRight;
    const exportSpecifier = NewExportSpecifier(astFactory, false as bool, propertyName, name);
    return NewExportDeclaration(astFactory, undefined, false as bool, NewNamedExports(astFactory, NodeFactory_NewNodeList(astFactory, [exportSpecifier]) as GoPtr<ExportSpecifierList>), undefined, undefined);
  } else if (IsIdentifier(name)) {
    if (Node_Text(name) === "default") {
      // const _default: Type; export default _default;
      const newId = NodeFactory_NewUniqueNameEx(factory, "_default", { Flags: GeneratedIdentifierFlagsOptimistic, Prefix: "", Suffix: "" });
      receiver!.state!.getSymbolAccessibilityDiagnostic = (_result) => ({
        diagnosticMessage: diagnosticMessages.Default_export_of_the_module_has_or_is_using_private_name_0,
        errorNode: input,
        typeName: undefined,
      });
      SymbolTrackerImpl_PushErrorFallbackNode(receiver!.tracker, input);
      const type_ = DeclarationTransformer_ensureType(receiver, input, false);
      const varDecl = NewVariableDeclaration(astFactory, newId, undefined, type_, undefined);
      SymbolTrackerImpl_PopErrorFallbackNode(receiver!.tracker);
      const modNodes = receiver!.needsDeclare
        ? [NodeFactory_NewModifier(astFactory, KindDeclareKeyword)]
        : [];
      const modList = NodeFactory_NewModifierList(astFactory, modNodes);
      const declList = NewVariableDeclarationList(astFactory, NodeFactory_NewNodeList(astFactory, [varDecl]) as GoPtr<VariableDeclarationNodeList>, NodeFlagsConst);
      const statement = NewVariableStatement(astFactory, modList, declList);
      const assignment = NewExportAssignment(astFactory, Node_Modifiers(input), false as bool, undefined, newId);
      // Remove comments from the export declaration and copy them onto the synthetic _default declaration
      DeclarationTransformer_preserveJsDoc(receiver, statement, input);
      DeclarationTransformer_removeAllComments(receiver, assignment);
      return NewSyntaxList(astFactory, [statement, assignment]);
    } else {
      // export var name: Type
      SymbolTrackerImpl_PushErrorFallbackNode(receiver!.tracker, input);
      const type_ = DeclarationTransformer_ensureType(receiver, input, false);
      const varDecl = NewVariableDeclaration(astFactory, name, undefined, type_, undefined);
      SymbolTrackerImpl_PopErrorFallbackNode(receiver!.tracker);
      const modNodes = receiver!.needsDeclare
        ? [NodeFactory_NewModifier(astFactory, KindExportKeyword), NodeFactory_NewModifier(astFactory, KindDeclareKeyword)]
        : [NodeFactory_NewModifier(astFactory, KindExportKeyword)];
      const modList = NodeFactory_NewModifierList(astFactory, modNodes);
      const declList = NewVariableDeclarationList(astFactory, NodeFactory_NewNodeList(astFactory, [varDecl]) as GoPtr<VariableDeclarationNodeList>, NodeFlagsNone);
      return NewVariableStatement(astFactory, modList, declList);
    }
  }
  // const _exported: Type; export {_exported as "name"};
  const newId = NodeFactory_NewUniqueNameEx(factory, "_exported", { Flags: GeneratedIdentifierFlagsOptimistic, Prefix: "", Suffix: "" });
  receiver!.state!.getSymbolAccessibilityDiagnostic = (_result) => ({
    diagnosticMessage: diagnosticMessages.Default_export_of_the_module_has_or_is_using_private_name_0,
    errorNode: input,
    typeName: undefined,
  });
  SymbolTrackerImpl_PushErrorFallbackNode(receiver!.tracker, input);
  const type_ = DeclarationTransformer_ensureType(receiver, input, false);
  const varDecl = NewVariableDeclaration(astFactory, newId, undefined, type_, undefined);
  SymbolTrackerImpl_PopErrorFallbackNode(receiver!.tracker);
  const modNodes = receiver!.needsDeclare
    ? [NodeFactory_NewModifier(astFactory, KindDeclareKeyword)]
    : [];
  const modList = NodeFactory_NewModifierList(astFactory, modNodes);
  const declList = NewVariableDeclarationList(astFactory, NodeFactory_NewNodeList(astFactory, [varDecl]) as GoPtr<VariableDeclarationNodeList>, NodeFlagsConst);
  const statement = NewVariableStatement(astFactory, modList, declList);
  const exportSpecList = NodeFactory_NewNodeList(astFactory, [NewExportSpecifier(astFactory, false as bool, newId, name)]) as GoPtr<ExportSpecifierList>;
  const assignment = NewExportDeclaration(astFactory, undefined, false as bool, NewNamedExports(astFactory, exportSpecList), undefined, undefined);
  // Remove comments from the export declaration and copy them onto the synthetic _default declaration
  DeclarationTransformer_preserveJsDoc(receiver, statement, input);
  DeclarationTransformer_removeAllComments(receiver, assignment);
  return NewSyntaxList(astFactory, [statement, assignment]);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::func::isCommonJSAliasExport","kind":"func","status":"implemented","sigHash":"8594ab9eb790f3691fdbe6fcdbf2be24fccbf4ec30a5d7907d0d074359450376","bodyHash":"a92cd0e017f7535a734861e3af6c36dd26f34657d90ce224c276f06e8aeecec1"}
 *
 * Go source:
 * func isCommonJSAliasExport(node *ast.Node) bool {
 * 	if ast.IsBinaryExpression(node) && ast.IsIdentifier(node.AsBinaryExpression().Right) {
 * 		if symbol := node.Symbol(); symbol != nil && len(symbol.Declarations) == 1 {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function isCommonJSAliasExport(node: GoPtr<Node>): bool {
  if (IsBinaryExpression(node) && IsIdentifier(AsBinaryExpression(node)!.Right)) {
    const sym = Node_Symbol(node);
    if (sym !== undefined && (sym.Declarations?.length ?? 0) === 1) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.rewriteModuleSpecifier","kind":"method","status":"implemented","sigHash":"3c65537269622c4a620fe8f6fdb0d1f6782afb0a5777979de06750e033830d55","bodyHash":"c22c4fed0c936cef98e0384ba65551db9d6e5523a1bbf0cc48cf8a0d72fc4df6"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) rewriteModuleSpecifier(parent *ast.Node, input *ast.Node) *ast.Node {
 * 	if input == nil {
 * 		return nil
 * 	}
 * 	tx.resultHasExternalModuleIndicator = tx.resultHasExternalModuleIndicator || (parent.Kind != ast.KindModuleDeclaration && parent.Kind != ast.KindImportType)
 * 	return input
 * }
 */
export function DeclarationTransformer_rewriteModuleSpecifier(receiver: GoPtr<DeclarationTransformer>, parent: GoPtr<Node>, input: GoPtr<Node>): GoPtr<Node> {
  if (input === undefined) {
    return undefined;
  }
  receiver!.resultHasExternalModuleIndicator = receiver!.resultHasExternalModuleIndicator || (parent!.Kind !== KindModuleDeclaration && parent!.Kind !== KindImportType);
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.tryGetResolutionModeOverride","kind":"method","status":"implemented","sigHash":"868a18cfe0cbe10db2c137f3e034b72d23194b0aec178012be6074f723704881","bodyHash":"e4f6b731410b8c907a544c693b37f133357204f17335ac83280d26fa0854dbda"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) tryGetResolutionModeOverride(node *ast.Node) *ast.Node {
 * 	if node == nil {
 * 		return node
 * 	}
 * 	mode := tx.host.GetResolutionModeOverride(node)
 * 	if mode != core.ResolutionModeNone {
 * 		return node
 * 	}
 * 	return nil
 * }
 */
export function DeclarationTransformer_tryGetResolutionModeOverride(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (node === undefined) {
    return node;
  }
  const mode = receiver!.host.GetResolutionModeOverride(node);
  if (mode !== ResolutionModeNone) {
    return node;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.preserveJsDoc","kind":"method","status":"implemented","sigHash":"f0fbe8a51002710af77f954c31ef737279f71e078c1ea205e62fd79d1f2bb61d","bodyHash":"8f49954eead20cdfd80abb1c3e9a124c2bb7fccbc2585f0c71d3cf6f819caee1"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) preserveJsDoc(updated *ast.Node, original *ast.Node) {
 * 	// Copy comment range from original to updated node so JSDoc comments are preserved
 * 	tx.EmitContext().AssignCommentRange(updated, original)
 * }
 */
export function DeclarationTransformer_preserveJsDoc(receiver: GoPtr<DeclarationTransformer>, updated: GoPtr<Node>, original: GoPtr<Node>): void {
  // Copy comment range from original to updated node so JSDoc comments are preserved
  EmitContext_AssignCommentRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0), updated, original);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.removeAllComments","kind":"method","status":"implemented","sigHash":"79d6735b062b7b7965dcc498d89a7c419c3680111f3ad592f82a6d7aeefdead0","bodyHash":"b8c0fc1fec9013540b620f44f8983bd8189a036978411713cca41f5c3378e26a"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) removeAllComments(node *ast.Node) {
 * 	tx.EmitContext().AddEmitFlags(node, printer.EFNoComments)
 * 	// !!! TODO: Also remove synthetic trailing/leading comments added by transforms
 * 	// emitNode.leadingComments = undefined;
 * 	// emitNode.trailingComments = undefined;
 * }
 */
export function DeclarationTransformer_removeAllComments(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>): void {
  EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0), node, EFNoComments);
  // !!! TODO: Also remove synthetic trailing/leading comments added by transforms
  // emitNode.leadingComments = undefined;
  // emitNode.trailingComments = undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.ensureType","kind":"method","status":"implemented","sigHash":"80558ada21faee32e4e56df9d5ea88dfaa4af3bcbf0dea467730be0907a68282","bodyHash":"a8f78c2602e2034e1ed1a284c474c92bd85fb17d81e5624cb58fffa820fc8992"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) ensureType(node *ast.Node, ignorePrivate bool) *ast.Node {
 * 	if !ignorePrivate && tx.host.GetEffectiveDeclarationFlags(tx.EmitContext().ParseNode(node), ast.ModifierFlagsPrivate) != 0 {
 * 		// Private nodes emit no types (except private parameter properties, whose parameter types are actually visible)
 * 		return nil
 * 	}
 *
 * 	if tx.shouldPrintWithInitializer(node) {
 * 		// Literal const declarations will have an initializer ensured rather than a type
 * 		return nil
 * 	}
 *
 * 	// Should be removed createTypeOfDeclaration will actually now reuse the existing annotation so there is no real need to duplicate type walking
 * 	// Left in for now to minimize diff during syntactic type node builder refactor
 * 	if !ast.IsExportAssignment(node) && !ast.IsBindingElement(node) && node.Type() != nil && (!ast.IsParameterDeclaration(node) || !tx.resolver.RequiresAddingImplicitUndefined(node, nil, tx.enclosingDeclaration)) {
 * 		if tx.state.currentSourceFile.IsJS() {
 * 			// JS types have a heap of constructs we can't directly emit into .d.ts files; the node builder contains logic to remap those where possible, so we invoke it here
 * 			// In strada we always built js declarations symbolically, so all js type nodes went through this postprocessing
 * 			res := tx.resolver.TryJSTypeNodeToTypeNode(tx.EmitContext(), node.Type(), tx.enclosingDeclaration, declarationEmitNodeBuilderFlags, declarationEmitInternalNodeBuilderFlags, tx.tracker)
 * 			if res != nil {
 * 				return res
 * 			}
 * 			// otherwise, fall back to full serialization
 * 		} else {
 * 			return tx.Visitor().Visit(node.Type())
 * 		}
 * 	}
 *
 * 	oldErrorNameNode := tx.state.errorNameNode
 * 	tx.state.errorNameNode = node.Name()
 * 	var oldDiag GetSymbolAccessibilityDiagnostic
 * 	if !tx.suppressNewDiagnosticContexts {
 * 		oldDiag = tx.state.getSymbolAccessibilityDiagnostic
 * 		if canProduceDiagnostics(node) {
 * 			tx.state.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(node)
 * 		}
 * 	}
 * 	var typeNode *ast.Node
 *
 * 	if ast.HasInferredType(node) {
 * 		typeNode = tx.resolver.CreateTypeOfDeclaration(tx.EmitContext(), node, tx.enclosingDeclaration, declarationEmitNodeBuilderFlags, declarationEmitInternalNodeBuilderFlags, tx.tracker)
 * 	} else if ast.IsFunctionLike(node) {
 * 		typeNode = tx.resolver.CreateReturnTypeOfSignatureDeclaration(tx.EmitContext(), node, tx.enclosingDeclaration, declarationEmitNodeBuilderFlags, declarationEmitInternalNodeBuilderFlags, tx.tracker)
 * 	} else {
 * 		debug.AssertNever(node)
 * 	}
 *
 * 	tx.state.errorNameNode = oldErrorNameNode
 * 	if !tx.suppressNewDiagnosticContexts {
 * 		tx.state.getSymbolAccessibilityDiagnostic = oldDiag
 * 	}
 * 	if typeNode == nil {
 * 		return tx.Factory().NewKeywordTypeNode(ast.KindAnyKeyword)
 * 	}
 * 	return typeNode
 * }
 */
export function DeclarationTransformer_ensureType(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>, ignorePrivate: bool): GoPtr<Node> {
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  if (!ignorePrivate && receiver!.host.GetEffectiveDeclarationFlags(EmitContext_ParseNode(emitContext, node), ModifierFlagsPrivate) !== 0) {
    // Private nodes emit no types (except private parameter properties, whose parameter types are actually visible)
    return undefined;
  }
  if (DeclarationTransformer_shouldPrintWithInitializer(receiver, node)) {
    // Literal const declarations will have an initializer ensured rather than a type
    return undefined;
  }
  const tracker = SymbolTrackerImpl_AsSymbolTracker(receiver!.tracker);
  const nodeType = Node_Type(node);
  // Should be removed createTypeOfDeclaration will actually now reuse the existing annotation so there is no real need to duplicate type walking
  // Left in for now to minimize diff during syntactic type node builder refactor
  if (!IsExportAssignment(node) && !IsBindingElement(node) && nodeType !== undefined && (!IsParameterDeclaration(node) || !receiver!.resolver.RequiresAddingImplicitUndefined(node, undefined, receiver!.enclosingDeclaration))) {
    if (SourceFile_IsJS(receiver!.state!.currentSourceFile)) {
      // JS types have a heap of constructs we can't directly emit into .d.ts files; the node builder contains logic to remap those where possible, so we invoke it here
      // In strada we always built js declarations symbolically, so all js type nodes went through this postprocessing
      const res = receiver!.resolver.TryJSTypeNodeToTypeNode(emitContext, nodeType, receiver!.enclosingDeclaration, declarationEmitNodeBuilderFlags, declarationEmitInternalNodeBuilderFlags, tracker);
      if (res !== undefined) {
        return res;
      }
      // otherwise, fall back to full serialization
    } else {
      return NodeVisitor_VisitNode(Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor, nodeType);
    }
  }
  const oldErrorNameNode = receiver!.state!.errorNameNode;
  receiver!.state!.errorNameNode = Node_Name(node);
  const oldDiag = receiver!.suppressNewDiagnosticContexts ? undefined : receiver!.state!.getSymbolAccessibilityDiagnostic;
  if (!receiver!.suppressNewDiagnosticContexts && canProduceDiagnostics(node)) {
    receiver!.state!.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(node);
  }
  const typeNode: GoPtr<Node> = HasInferredType(node)
    ? receiver!.resolver.CreateTypeOfDeclaration(emitContext, node, receiver!.enclosingDeclaration, declarationEmitNodeBuilderFlags, declarationEmitInternalNodeBuilderFlags, tracker)
    : IsFunctionLike(node)
    ? receiver!.resolver.CreateReturnTypeOfSignatureDeclaration(emitContext, node, receiver!.enclosingDeclaration, declarationEmitNodeBuilderFlags, declarationEmitInternalNodeBuilderFlags, tracker)
    : undefined;
  receiver!.state!.errorNameNode = oldErrorNameNode;
  if (!receiver!.suppressNewDiagnosticContexts) {
    receiver!.state!.getSymbolAccessibilityDiagnostic = oldDiag!;
  }
  if (typeNode === undefined) {
    const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
    const astFactory = factory!.__tsgoEmbedded0;
    return NewKeywordTypeNode(astFactory, KindAnyKeyword);
  }
  return typeNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.shouldPrintWithInitializer","kind":"method","status":"implemented","sigHash":"96cdf38d2e5847cb5ce80afa3b6e9229825a937d34810bf3513cf3ce41325cfb","bodyHash":"a07e7f4501ac91fd725e62fe06f8fbab84242d27250822be7c3e83d8caf46415"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) shouldPrintWithInitializer(node *ast.Node) bool {
 * 	return canHaveLiteralInitializer(tx.host, node) && node.Initializer() != nil && tx.resolver.IsLiteralConstDeclaration(tx.EmitContext().MostOriginal(node))
 * }
 */
export function DeclarationTransformer_shouldPrintWithInitializer(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>): bool {
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  return (canHaveLiteralInitializer(receiver!.host, node) && Node_Initializer(node) !== undefined && receiver!.resolver.IsLiteralConstDeclaration(EmitContext_MostOriginal(emitContext, node))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.checkEntityNameVisibility","kind":"method","status":"implemented","sigHash":"fb29bfdd6e7646cc94867466c1dfc49140fc815adb4ad5879ac6d9bf3090e5e3","bodyHash":"0231cd4598fcbc0aaba215af04d5209cad223100b68f5b987477fd5c9ecb230e"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) checkEntityNameVisibility(entityName *ast.Node, enclosingDeclaration *ast.Node) {
 * 	visibilityResult := tx.resolver.IsEntityNameVisible(entityName, enclosingDeclaration)
 * 	tx.tracker.handleSymbolAccessibilityError(visibilityResult)
 * }
 */
export function DeclarationTransformer_checkEntityNameVisibility(receiver: GoPtr<DeclarationTransformer>, entityName: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>): void {
  const visibilityResult = receiver!.resolver.IsEntityNameVisible(entityName, enclosingDeclaration);
  SymbolTrackerImpl_handleSymbolAccessibilityError(receiver!.tracker, visibilityResult);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformTopLevelDeclaration","kind":"method","status":"implemented","sigHash":"bc0fcaec4e5c0e4b71d0d041ff2a8d8d0b1c0432f93c7b6416a959d983fade96","bodyHash":"5a095cb7fa010c04cb45f5de7eeb644e03a7716d9a665ea0f591dfabaa87e0bf"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformTopLevelDeclaration(input *ast.Node) *ast.Node {
 * 	if len(tx.state.lateMarkedStatements) > 0 {
 * 		// Remove duplicates of the current statement from the deferred work queue (this was done via orderedRemoveItem in strada - why? to ensure the same backing array? microop?)
 * 		tx.state.lateMarkedStatements = core.Filter(tx.state.lateMarkedStatements, func(node *ast.Node) bool { return node != input })
 * 	}
 * 	if tx.shouldStripInternal(input) {
 * 		return nil
 * 	}
 * 	if input.Kind == ast.KindImportEqualsDeclaration {
 * 		return tx.transformImportEqualsDeclaration(input.AsImportEqualsDeclaration())
 * 	}
 * 	if input.Kind == ast.KindImportDeclaration || input.Kind == ast.KindJSImportDeclaration {
 * 		res := tx.transformImportDeclaration(input.AsImportDeclaration())
 * 		if res != nil && res.Kind != ast.KindImportDeclaration {
 * 			res := res.Clone(tx.Factory())
 * 			res.Kind = ast.KindImportDeclaration
 * 			return res
 * 		}
 * 		return res
 * 	}
 * 	if ast.IsDeclaration(input) && isDeclarationAndNotVisible(tx.EmitContext(), tx.resolver, input) {
 * 		return nil
 * 	}
 * 
 * 	// !!! TODO: JSDoc support
 * 	// if (isJSDocImportTag(input)) return;
 * 
 * 	// Elide implementation signatures from overload sets
 * 	if ast.IsFunctionLike(input) && tx.resolver.IsImplementationOfOverload(input) {
 * 		return nil
 * 	}
 * 	previousEnclosingDeclaration := tx.enclosingDeclaration
 * 	if isEnclosingDeclaration(input) {
 * 		tx.enclosingDeclaration = input
 * 	}
 * 
 * 	canProdiceDiagnostic := canProduceDiagnostics(input)
 * 	oldDiag := tx.state.getSymbolAccessibilityDiagnostic
 * 	oldName := tx.state.errorNameNode
 * 	if canProdiceDiagnostic {
 * 		tx.state.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(input)
 * 	}
 * 	saveNeedsDeclare := tx.needsDeclare
 * 
 * 	var result *ast.Node
 * 	switch input.Kind {
 * 	case ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration:
 * 		result = tx.transformTypeAliasDeclaration(input.AsTypeAliasDeclaration())
 * 	case ast.KindInterfaceDeclaration:
 * 		result = tx.transformInterfaceDeclaration(input.AsInterfaceDeclaration())
 * 	case ast.KindFunctionDeclaration:
 * 		result = tx.transformFunctionDeclaration(input.AsFunctionDeclaration())
 * 	case ast.KindModuleDeclaration:
 * 		result = tx.transformModuleDeclaration(input.AsModuleDeclaration())
 * 	case ast.KindClassDeclaration:
 * 		result = tx.transformClassDeclaration(input.AsClassDeclaration())
 * 	case ast.KindVariableStatement:
 * 		result = tx.transformVariableStatement(input.AsVariableStatement())
 * 	case ast.KindEnumDeclaration:
 * 		result = tx.transformEnumDeclaration(input.AsEnumDeclaration())
 * 	default:
 * 		// Anything left unhandled is an error, so this should be unreachable
 * 		panic(fmt.Sprintf("Unhandled top-level node in declaration emit: %q", input.Kind))
 * 	}
 * 
 * 	tx.enclosingDeclaration = previousEnclosingDeclaration
 * 	tx.state.getSymbolAccessibilityDiagnostic = oldDiag
 * 	tx.needsDeclare = saveNeedsDeclare
 * 	tx.state.errorNameNode = oldName
 * 	return result
 * }
 */
export function DeclarationTransformer_transformTopLevelDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<Node>): GoPtr<Node> {
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  if (receiver!.state!.lateMarkedStatements.length > 0) {
    // Remove duplicates of the current statement from the deferred work queue
    receiver!.state!.lateMarkedStatements = Filter(receiver!.state!.lateMarkedStatements, (node) => node !== input);
  }
  if (DeclarationTransformer_shouldStripInternal(receiver, input)) {
    return undefined;
  }
  if (input!.Kind === KindImportEqualsDeclaration) {
    return DeclarationTransformer_transformImportEqualsDeclaration(receiver, AsImportEqualsDeclaration(input)!);
  }
  if (input!.Kind === KindImportDeclaration || input!.Kind === KindJSImportDeclaration) {
    const res = DeclarationTransformer_transformImportDeclaration(receiver, AsImportDeclaration(input)!);
    if (res !== undefined && res!.Kind !== KindImportDeclaration) {
      // Clone as a regular ImportDeclaration (changing Kind from JSImportDeclaration)
      const importDecl = AsImportDeclaration(res)!;
      return cloneNode(NewImportDeclaration(astFactory, importDecl.modifiers, importDecl.ImportClause, importDecl.ModuleSpecifier, importDecl.Attributes), res, astFactory!.hooks);
    }
    return res;
  }
  if (IsDeclaration(input) && isDeclarationAndNotVisible(emitContext, receiver!.resolver, input)) {
    return undefined;
  }
  // !!! TODO: JSDoc support
  // if (isJSDocImportTag(input)) return;

  // Elide implementation signatures from overload sets
  if (IsFunctionLike(input) && receiver!.resolver.IsImplementationOfOverload(input)) {
    return undefined;
  }
  const previousEnclosingDeclaration = receiver!.enclosingDeclaration;
  if (isEnclosingDeclaration(input)) {
    receiver!.enclosingDeclaration = input;
  }
  const canProdiceDiagnostic = canProduceDiagnostics(input);
  const oldDiag = receiver!.state!.getSymbolAccessibilityDiagnostic;
  const oldName = receiver!.state!.errorNameNode;
  if (canProdiceDiagnostic) {
    receiver!.state!.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(input);
  }
  const saveNeedsDeclare = receiver!.needsDeclare;
  const result: GoPtr<Node> = (() => {
    switch (input!.Kind) {
      case KindTypeAliasDeclaration:
      case KindJSTypeAliasDeclaration:
        return DeclarationTransformer_transformTypeAliasDeclaration(receiver, AsTypeAliasDeclaration(input)!);
      case KindInterfaceDeclaration:
        return DeclarationTransformer_transformInterfaceDeclaration(receiver, AsInterfaceDeclaration(input)!);
      case KindFunctionDeclaration:
        return DeclarationTransformer_transformFunctionDeclaration(receiver, AsFunctionDeclaration(input)!);
      case KindModuleDeclaration:
        return DeclarationTransformer_transformModuleDeclaration(receiver, AsModuleDeclaration(input)!);
      case KindClassDeclaration:
        return DeclarationTransformer_transformClassDeclaration(receiver, AsClassDeclaration(input)!);
      case KindVariableStatement:
        return DeclarationTransformer_transformVariableStatement(receiver, AsVariableStatement(input)!);
      case KindEnumDeclaration:
        return DeclarationTransformer_transformEnumDeclaration(receiver, AsEnumDeclaration(input)!);
      default:
        throw new globalThis.Error(`Unhandled top-level node in declaration emit: ${input!.Kind}`);
    }
  })();
  receiver!.enclosingDeclaration = previousEnclosingDeclaration;
  receiver!.state!.getSymbolAccessibilityDiagnostic = oldDiag;
  receiver!.needsDeclare = saveNeedsDeclare;
  receiver!.state!.errorNameNode = oldName;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformTypeAliasDeclaration","kind":"method","status":"implemented","sigHash":"2ab6f250fdb74b1c6a701e80f24b429a345ab7e37ed56f4d69b70f4bf9e4652f","bodyHash":"2fc653bba4f6d5c015afb944e66f1935948ee7b5443dd53a9e78c715f5f670b0"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformTypeAliasDeclaration(input *ast.TypeAliasDeclaration) *ast.Node {
 * 	tx.needsDeclare = false
 * 	return tx.Factory().UpdateTypeAliasDeclaration(
 * 		input,
 * 		tx.ensureModifiers(input.AsNode()),
 * 		input.Name(),
 * 		tx.Visitor().VisitNodes(input.TypeParameters),
 * 		tx.Visitor().Visit(input.Type),
 * 	)
 * }
 */
export function DeclarationTransformer_transformTypeAliasDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<TypeAliasDeclaration>): GoPtr<Node> {
  receiver!.needsDeclare = false;
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
  const typeParameters = NodeVisitor_VisitNodes(visitor, input!.TypeParameters);
  const type = NodeVisitor_VisitNode(visitor, input!.Type);
  if (modifiers !== input!.modifiers || typeParameters !== input!.TypeParameters || type !== input!.Type) {
    return updateNode(NewTypeAliasDeclaration(astFactory, modifiers, input!.name, typeParameters, type), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformInterfaceDeclaration","kind":"method","status":"implemented","sigHash":"0573dede30465af787a11633aae14ea87571a14d9807cd55853d61249541967c","bodyHash":"1aa92b49aeed45b8d0b3589e9e9f09696823935243389f9bcbe201fad37de531"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformInterfaceDeclaration(input *ast.InterfaceDeclaration) *ast.Node {
 * 	return tx.Factory().UpdateInterfaceDeclaration(
 * 		input,
 * 		tx.ensureModifiers(input.AsNode()),
 * 		input.Name(),
 * 		tx.Visitor().VisitNodes(input.TypeParameters),
 * 		tx.Visitor().VisitNodes(input.HeritageClauses),
 * 		tx.Visitor().VisitNodes(input.Members),
 * 	)
 * }
 */
export function DeclarationTransformer_transformInterfaceDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<InterfaceDeclaration>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
  const typeParameters = NodeVisitor_VisitNodes(visitor, input!.TypeParameters);
  const heritageClauses = NodeVisitor_VisitNodes(visitor, input!.HeritageClauses);
  const members = NodeVisitor_VisitNodes(visitor, input!.Members);
  if (modifiers !== input!.modifiers || typeParameters !== input!.TypeParameters || heritageClauses !== input!.HeritageClauses || members !== input!.Members) {
    return updateNode(NewInterfaceDeclaration(astFactory, modifiers, input!.name, typeParameters, heritageClauses, members), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformFunctionDeclaration","kind":"method","status":"implemented","sigHash":"554f24546016a216b0ca1b7b5c55b6c269e459b49cfb4976cf2d5c423551b548","bodyHash":"1ba8e96b4af85f71f5ae032d7b8f08d0fbb876458cd40c8774ca5bb09ae847da"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformFunctionDeclaration(input *ast.FunctionDeclaration) *ast.Node {
 * 	if tx.resolver.IsExpandoFunctionDeclaration(input.AsNode()) && tx.state.isolatedDeclarations {
 * 		tx.state.reportExpandoFunctionErrors(input.AsNode())
 * 	}
 * 	return tx.Factory().UpdateFunctionDeclaration(
 * 		input,
 * 		tx.ensureModifiers(input.AsNode()),
 * 		nil,
 * 		input.Name(),
 * 		tx.ensureTypeParams(input.AsNode(), input.TypeParameters),
 * 		tx.updateParamList(input.AsNode(), input.Parameters),
 * 		tx.ensureType(input.AsNode(), false),
 * 		nil, /*fullSignature* /
 * 		nil,
 * 	)
 * }
 */
export function DeclarationTransformer_transformFunctionDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<FunctionDeclaration>): GoPtr<Node> {
  if (receiver!.resolver.IsExpandoFunctionDeclaration(input) && receiver!.state!.isolatedDeclarations) {
    receiver!.state!.reportExpandoFunctionErrors(input);
  }
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
  const typeParameters = DeclarationTransformer_ensureTypeParams(receiver, input, input!.TypeParameters);
  const parameters = DeclarationTransformer_updateParamList(receiver, input, input!.Parameters);
  const typeNode = DeclarationTransformer_ensureType(receiver, input, false);
  if (modifiers !== input!.modifiers || typeParameters !== input!.TypeParameters || parameters !== input!.Parameters || typeNode !== input!.Type || input!.AsteriskToken !== undefined) {
    return updateNode(NewFunctionDeclaration(astFactory, modifiers, undefined, input!.name, typeParameters, parameters, typeNode, undefined, undefined), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformModuleDeclaration","kind":"method","status":"implemented","sigHash":"83701f79e2cb62f99a103edb750808e9a4a7d13c2df2bdcd70b94b0caf03e551","bodyHash":"1b3bd669dd4c0a4b53fb45c119e4202fce71388ac3b619996fbcf693dd77d6b5"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformModuleDeclaration(input *ast.ModuleDeclaration) *ast.Node {
 * 	// !!! TODO: module declarations are now parsed into nested module objects with export modifiers
 * 	// It'd be good to collapse those back in the declaration output, but the AST can't represent the
 * 	// `namespace a.b.c` shape for the printer (without using invalid identifier names).
 * 	mods := tx.ensureModifiers(input.AsNode())
 * 	saveNeedsDeclare := tx.needsDeclare
 * 	tx.needsDeclare = false
 * 	inner := input.Body
 * 	keyword := input.Keyword
 * 	if keyword != ast.KindGlobalKeyword && (input.Name() == nil || !ast.IsStringLiteral(input.Name())) {
 * 		keyword = ast.KindNamespaceKeyword
 * 	}
 * 
 * 	if inner != nil && inner.Kind == ast.KindModuleBlock {
 * 		oldNeedsScopeFix := tx.needsScopeFixMarker
 * 		oldHasScopeFix := tx.resultHasScopeMarker
 * 		tx.resultHasScopeMarker = false
 * 		tx.needsScopeFixMarker = false
 * 		statements := tx.Visitor().VisitNodes(inner.StatementList())
 * 		lateStatements := tx.transformAndReplaceLatePaintedStatements(statements)
 * 		if input.Flags&ast.NodeFlagsAmbient != 0 {
 * 			tx.needsScopeFixMarker = false // If it was `declare`'d everything is implicitly exported already, ignore late printed "privates"
 * 		}
 * 		// With the final list of statements, there are 3 possibilities:
 * 		// 1. There's an export assignment or export declaration in the namespace - do nothing
 * 		// 2. Everything is exported and there are no export assignments or export declarations - strip all export modifiers
 * 		// 3. Some things are exported, some are not, and there's no marker - add an empty marker
 * 		if !ast.IsGlobalScopeAugmentation(input.AsNode()) && !tx.resultHasScopeMarker && !hasScopeMarker(lateStatements) {
 * 			if tx.needsScopeFixMarker {
 * 				lateStatements = tx.Factory().NewNodeList(append(lateStatements.Nodes, createEmptyExports(tx.Factory().AsNodeFactory())))
 * 			} else {
 * 				lateStatements = tx.EmitContext().NewNodeVisitor(tx.stripExportModifiers).VisitNodes(lateStatements)
 * 			}
 * 		}
 * 
 * 		body := tx.Factory().UpdateModuleBlock(inner.AsModuleBlock(), lateStatements)
 * 		tx.needsDeclare = saveNeedsDeclare
 * 		tx.needsScopeFixMarker = oldNeedsScopeFix
 * 		tx.resultHasScopeMarker = oldHasScopeFix
 * 
 * 		return tx.Factory().UpdateModuleDeclaration(
 * 			input,
 * 			mods,
 * 			keyword,
 * 			input.Name(),
 * 			body,
 * 		)
 * 	}
 * 	if inner != nil {
 * 		// trigger visit. ignore result (is deferred, so is just inner unless elided)
 * 		tx.Visitor().Visit(inner)
 * 		// eagerly transform nested namespaces (the nesting doesn't need any elision or painting done)
 * 		original := tx.EmitContext().MostOriginal(inner)
 * 		id := ast.GetNodeId(original)
 * 		body, _ := tx.lateStatementReplacementMap[id]
 * 		delete(tx.lateStatementReplacementMap, id)
 * 		return tx.Factory().UpdateModuleDeclaration(
 * 			input,
 * 			mods,
 * 			keyword,
 * 			input.Name(),
 * 			body,
 * 		)
 * 	}
 * 	return tx.Factory().UpdateModuleDeclaration(
 * 		input,
 * 		mods,
 * 		keyword,
 * 		input.Name(),
 * 		nil,
 * 	)
 * }
 */
export function DeclarationTransformer_transformModuleDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<ModuleDeclaration>): GoPtr<Node> {
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const mods = DeclarationTransformer_ensureModifiers(receiver, input);
  const saveNeedsDeclare = receiver!.needsDeclare;
  receiver!.needsDeclare = false;
  const inner = input!.Body;
  let keyword = input!.Keyword;
  if (keyword !== KindGlobalKeyword && (input!.name === undefined || !IsStringLiteral(input!.name))) {
    keyword = KindNamespaceKeyword;
  }
  const makeDecl = (body: GoPtr<Node>): GoPtr<Node> => {
    if (mods !== input!.modifiers || keyword !== input!.Keyword || body !== input!.Body) {
      return updateNode(NewModuleDeclaration(astFactory, mods, keyword, input!.name, body), input, astFactory!.hooks);
    }
    return input;
  };
  if (inner !== undefined && inner!.Kind === KindModuleBlock) {
    const oldNeedsScopeFix = receiver!.needsScopeFixMarker;
    const oldHasScopeFix = receiver!.resultHasScopeMarker;
    receiver!.resultHasScopeMarker = false;
    receiver!.needsScopeFixMarker = false;
    const statements = NodeVisitor_VisitNodes(visitor, Node_StatementList(inner));
    const lateStatementsResult = DeclarationTransformer_transformAndReplaceLatePaintedStatements(receiver, statements as GoPtr<StatementList>);
    if ((input!.Flags & NodeFlagsAmbient) !== 0) {
      receiver!.needsScopeFixMarker = false; // If it was `declare`'d everything is implicitly exported already, ignore late printed "privates"
    }
    // With the final list of statements, there are 3 possibilities:
    // 1. There's an export assignment or export declaration in the namespace - do nothing
    // 2. Everything is exported and there are no export assignments or export declarations - strip all export modifiers
    // 3. Some things are exported, some are not, and there's no marker - add an empty marker
    const lateStatements: GoPtr<StatementList> = (!IsGlobalScopeAugmentation(input) && !receiver!.resultHasScopeMarker && !hasScopeMarker(lateStatementsResult))
      ? (receiver!.needsScopeFixMarker
          ? NodeFactory_NewNodeList(astFactory, [...lateStatementsResult!.Nodes, createEmptyExports(astFactory)]) as GoPtr<StatementList>
          : NodeVisitor_VisitNodes(EmitContext_NewNodeVisitor(emitContext, (s) => DeclarationTransformer_stripExportModifiers(receiver, s)) as ConcreteNodeVisitor, lateStatementsResult) as GoPtr<StatementList>)
      : lateStatementsResult;
    const moduleBlock = AsModuleBlock(inner)!;
    const newBody = updateNode(NewModuleBlock(astFactory, lateStatements), inner, astFactory!.hooks);
    receiver!.needsDeclare = saveNeedsDeclare;
    receiver!.needsScopeFixMarker = oldNeedsScopeFix;
    receiver!.resultHasScopeMarker = oldHasScopeFix;
    return makeDecl(newBody);
  }
  if (inner !== undefined) {
    // trigger visit. ignore result (is deferred, so is just inner unless elided)
    NodeVisitor_VisitNode(visitor, inner);
    // eagerly transform nested namespaces (the nesting doesn't need any elision or painting done)
    const original = EmitContext_MostOriginal(emitContext, inner);
    const id = GetNodeId(original);
    const body = receiver!.lateStatementReplacementMap.get(id);
    receiver!.lateStatementReplacementMap.delete(id);
    return makeDecl(body);
  }
  return makeDecl(undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.stripExportModifiers","kind":"method","status":"implemented","sigHash":"f2b6dedc47305cf14b7cea41c11c708484dd5025f079ec952539fb4ee6dab2e3","bodyHash":"cecfc8c26d8fad326a53c6129b6c7c698afbfc74ea589475220c2b173a8dcfab"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) stripExportModifiers(statement *ast.Node) *ast.Node {
 * 	if statement == nil {
 * 		return nil
 * 	}
 * 	if ast.IsImportEqualsDeclaration(statement) || tx.host.GetEffectiveDeclarationFlags(tx.EmitContext().ParseNode(statement), ast.ModifierFlagsDefault) != 0 || !ast.CanHaveModifiers(statement) {
 * 		// `export import` statements should remain as-is, as imports are _not_ implicitly exported in an ambient namespace
 * 		// Likewise, `export default` classes and the like and just be `default`, so we preserve their `export` modifiers, too
 * 		return statement
 * 	}
 * 
 * 	oldFlags := ast.GetCombinedModifierFlags(statement)
 * 	if oldFlags&ast.ModifierFlagsExport == 0 {
 * 		return statement
 * 	}
 * 	newFlags := oldFlags & (ast.ModifierFlagsAll ^ ast.ModifierFlagsExport)
 * 	modifiers := ast.CreateModifiersFromModifierFlags(newFlags, tx.Factory().NewModifier)
 * 	return ast.ReplaceModifiers(tx.Factory().AsNodeFactory(), statement, tx.Factory().NewModifierList(modifiers))
 * }
 */
export function DeclarationTransformer_stripExportModifiers(receiver: GoPtr<DeclarationTransformer>, statement: GoPtr<Node>): GoPtr<Node> {
  if (statement === undefined) {
    return undefined;
  }
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  if (IsImportEqualsDeclaration(statement) || receiver!.host.GetEffectiveDeclarationFlags(EmitContext_ParseNode(emitContext, statement), ModifierFlagsDefault) !== 0 || !CanHaveModifiers(statement)) {
    // `export import` statements should remain as-is, as imports are _not_ implicitly exported in an ambient namespace
    // Likewise, `export default` classes and the like and just be `default`, so we preserve their `export` modifiers, too
    return statement;
  }
  const oldFlags = GetCombinedModifierFlags(statement);
  if ((oldFlags & ModifierFlagsExport) === 0) {
    return statement;
  }
  const newFlags = (oldFlags & (ModifierFlagsAll ^ ModifierFlagsExport)) as ModifierFlags;
  const modifiers = CreateModifiersFromModifierFlags(newFlags, (kind) => NodeFactory_NewModifier(astFactory, kind));
  return ReplaceModifiers(NodeFactory_AsNodeFactory(astFactory), statement, NodeFactory_NewModifierList(astFactory, modifiers));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformClassDeclaration","kind":"method","status":"implemented","sigHash":"b92abc52fbf359fcd6ea3da95594209d53dc87209e0cdcdc73993c4996479e02","bodyHash":"0d79933cf2d25111b1a76ed96e25349a8eda73a6058acd3846854eb9708cf3ab"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformClassDeclaration(input *ast.ClassDeclaration) *ast.Node {
 * 	tx.state.errorNameNode = input.Name()
 * 	tx.tracker.PushErrorFallbackNode(input.AsNode())
 * 	defer tx.tracker.PopErrorFallbackNode()
 * 
 * 	modifiers := tx.ensureModifiers(input.AsNode())
 * 	typeParameters := tx.ensureTypeParams(input.AsNode(), input.TypeParameters)
 * 	ctor := ast.GetFirstConstructorWithBody(input.AsNode())
 * 	var parameterProperties []*ast.Node
 * 	if ctor != nil {
 * 		oldDiag := tx.state.getSymbolAccessibilityDiagnostic
 * 		for _, param := range ctor.AsConstructorDeclaration().Parameters.Nodes {
 * 			if !ast.HasSyntacticModifier(param, ast.ModifierFlagsParameterPropertyModifier) || tx.shouldStripInternal(param) {
 * 				continue
 * 			}
 * 			tx.state.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(param)
 * 			if param.Name().Kind == ast.KindIdentifier {
 * 				updated := tx.Factory().NewPropertyDeclaration(
 * 					tx.ensureModifiers(param),
 * 					param.Name(),
 * 					param.QuestionToken(),
 * 					tx.ensureType(param, false),
 * 					tx.ensureNoInitializer(param),
 * 				)
 * 				tx.preserveJsDoc(updated, param)
 * 				parameterProperties = append(parameterProperties, updated)
 * 			} else {
 * 				// Pattern - this is currently an error, but we emit declarations for it somewhat correctly
 * 				parameterProperties = append(parameterProperties, tx.walkBindingPattern(param.Name().AsBindingPattern(), param)...)
 * 			}
 * 		}
 * 		tx.state.getSymbolAccessibilityDiagnostic = oldDiag
 * 	}
 * 
 * 	// When the class has at least one private identifier, create a unique constant identifier to retain the nominal typing behavior
 * 	// Prevents other classes with the same public members from being used in place of the current class
 * 	var privateIdentifier *ast.Node
 * 	if core.Some(input.Members.Nodes, func(member *ast.Node) bool { return member.Name() != nil && ast.IsPrivateIdentifier(member.Name()) }) {
 * 		privateIdentifier = tx.Factory().NewPropertyDeclaration(
 * 			nil,
 * 			tx.Factory().NewPrivateIdentifier("#private"),
 * 			nil,
 * 			nil,
 * 			nil,
 * 		)
 * 	}
 * 
 * 	lateIndexes := tx.resolver.CreateLateBoundIndexSignatures(
 * 		tx.EmitContext(),
 * 		input.AsNode(),
 * 		tx.enclosingDeclaration,
 * 		declarationEmitNodeBuilderFlags,
 * 		declarationEmitInternalNodeBuilderFlags,
 * 		tx.tracker,
 * 	)
 * 
 * 	memberNodes := make([]*ast.Node, 0, len(input.Members.Nodes))
 * 	if privateIdentifier != nil {
 * 		memberNodes = append(memberNodes, privateIdentifier)
 * 	}
 * 	memberNodes = append(memberNodes, lateIndexes...)
 * 	memberNodes = append(memberNodes, parameterProperties...)
 * 	visitResult := tx.Visitor().VisitNodes(input.Members)
 * 	if visitResult != nil && len(visitResult.Nodes) > 0 {
 * 		memberNodes = append(memberNodes, visitResult.Nodes...)
 * 	}
 * 	members := tx.Factory().NewNodeList(memberNodes)
 * 
 * 	extendsClause := getEffectiveBaseTypeNode(input.AsNode())
 * 
 * 	if extendsClause != nil && !ast.IsEntityNameExpression(extendsClause.AsExpressionWithTypeArguments().Expression) && extendsClause.AsExpressionWithTypeArguments().Expression.Kind != ast.KindNullKeyword {
 * 		oldId := "default"
 * 		if ast.NodeIsPresent(input.Name()) && ast.IsIdentifier(input.Name()) && len(input.Name().Text()) > 0 {
 * 			oldId = input.Name().Text()
 * 		}
 * 		newId := tx.Factory().NewUniqueNameEx(oldId+"_base", printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsOptimistic})
 * 		tx.state.getSymbolAccessibilityDiagnostic = func(_ printer.SymbolAccessibilityResult) *SymbolAccessibilityDiagnostic {
 * 			return &SymbolAccessibilityDiagnostic{
 * 				diagnosticMessage: diagnostics.X_extends_clause_of_exported_class_0_has_or_is_using_private_name_1,
 * 				errorNode:         extendsClause,
 * 				typeName:          input.Name(),
 * 			}
 * 		}
 * 
 * 		varDecl := tx.Factory().NewVariableDeclaration(
 * 			newId,
 * 			nil,
 * 			tx.resolver.CreateTypeOfExpression(tx.EmitContext(), extendsClause.Expression(), input.AsNode(), declarationEmitNodeBuilderFlags, declarationEmitInternalNodeBuilderFlags, tx.tracker),
 * 			nil,
 * 		)
 * 		var mods *ast.ModifierList
 * 		if tx.needsDeclare {
 * 			mods = tx.Factory().NewModifierList([]*ast.Node{tx.Factory().NewModifier(ast.KindDeclareKeyword)})
 * 		}
 * 		statement := tx.Factory().NewVariableStatement(
 * 			mods,
 * 			tx.Factory().NewVariableDeclarationList(tx.Factory().NewNodeList([]*ast.Node{varDecl}), ast.NodeFlagsConst),
 * 		)
 * 		newHeritageClause := tx.Factory().UpdateHeritageClause(
 * 			extendsClause.Parent.AsHeritageClause(),
 * 			extendsClause.Parent.AsHeritageClause().Token,
 * 			tx.Factory().NewNodeList([]*ast.Node{
 * 				tx.Factory().UpdateExpressionWithTypeArguments(
 * 					extendsClause.AsExpressionWithTypeArguments(),
 * 					newId,
 * 					tx.Visitor().VisitNodes(extendsClause.AsExpressionWithTypeArguments().TypeArguments),
 * 				),
 * 			}),
 * 		)
 * 		retainedHeritageClauses := tx.Visitor().VisitNodes(input.HeritageClauses) // should just be `implements`
 * 		heritageList := []*ast.Node{
 * 			newHeritageClause,
 * 		}
 * 		if retainedHeritageClauses != nil && len(retainedHeritageClauses.Nodes) > 0 {
 * 			heritageList = append(heritageList, retainedHeritageClauses.Nodes...)
 * 		}
 * 		heritageClauses := tx.Factory().NewNodeList(heritageList)
 * 
 * 		return tx.Factory().NewSyntaxList([]*ast.Node{
 * 			statement,
 * 			tx.Factory().UpdateClassDeclaration(
 * 				input,
 * 				modifiers,
 * 				input.Name(),
 * 				typeParameters,
 * 				heritageClauses,
 * 				members,
 * 			),
 * 		})
 * 	}
 * 
 * 	return tx.Factory().UpdateClassDeclaration(
 * 		input,
 * 		modifiers,
 * 		input.Name(),
 * 		typeParameters,
 * 		tx.Visitor().VisitNodes(input.HeritageClauses),
 * 		members,
 * 	)
 * }
 */
export function DeclarationTransformer_transformClassDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<ClassDeclaration>): GoPtr<Node> {
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;

  receiver!.state!.errorNameNode = input!.name;
  SymbolTrackerImpl_PushErrorFallbackNode(receiver!.tracker, input);
  try {
    const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
    const typeParameters = DeclarationTransformer_ensureTypeParams(receiver, input, input!.TypeParameters);
    const ctor = GetFirstConstructorWithBody(input);
    const parameterProperties: GoSlice<GoPtr<Node>> = ((): GoSlice<GoPtr<Node>> => {
      if (ctor === undefined) { return []; }
      const oldDiag = receiver!.state!.getSymbolAccessibilityDiagnostic;
      const ctorDecl = AsConstructorDeclaration(ctor)!;
      const result = ctorDecl!.Parameters!.Nodes.reduce((acc: GoSlice<GoPtr<Node>>, param: GoPtr<Node>): GoSlice<GoPtr<Node>> => {
        if (!HasSyntacticModifier(param, ModifierFlagsParameterPropertyModifier) || DeclarationTransformer_shouldStripInternal(receiver, param)) {
          return acc;
        }
        receiver!.state!.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(param);
        const paramDecl = AsParameterDeclaration(param)!;
        if (paramDecl!.name!.Kind === KindIdentifier) {
          const updated = NewPropertyDeclaration(
            astFactory,
            DeclarationTransformer_ensureModifiers(receiver, param),
            paramDecl!.name,
            paramDecl!.QuestionToken,
            DeclarationTransformer_ensureType(receiver, param, false),
            DeclarationTransformer_ensureNoInitializer(receiver, param),
          );
          DeclarationTransformer_preserveJsDoc(receiver, updated, param);
          return [...acc, updated];
        } else {
          // Pattern - currently an error, but emit declarations for it somewhat correctly
          return [...acc, ...DeclarationTransformer_walkBindingPattern(receiver, AsBindingPattern(paramDecl!.name)!, param)];
        }
      }, []);
      receiver!.state!.getSymbolAccessibilityDiagnostic = oldDiag;
      return result;
    })();

    // When the class has at least one private identifier, create unique constant for nominal typing
    const privateIdentifier: GoPtr<Node> = Some(input!.Members!.Nodes, (member: GoPtr<Node>): bool => {
      const memberName = Node_Name(member);
      return (memberName !== undefined && IsPrivateIdentifier(memberName)) as bool;
    })
      ? NewPropertyDeclaration(astFactory, undefined, NewPrivateIdentifier(astFactory, "#private"), undefined, undefined, undefined)
      : undefined;

    const lateIndexes = receiver!.resolver.CreateLateBoundIndexSignatures(
      emitContext,
      input,
      receiver!.enclosingDeclaration,
      declarationEmitNodeBuilderFlags,
      declarationEmitInternalNodeBuilderFlags,
      SymbolTrackerImpl_AsSymbolTracker(receiver!.tracker),
    );

    const visitResult = NodeVisitor_VisitNodes(visitor, input!.Members);
    const memberNodes: GoSlice<GoPtr<Node>> = [
      ...(privateIdentifier !== undefined ? [privateIdentifier] : []),
      ...(lateIndexes ?? []),
      ...parameterProperties,
      ...(visitResult !== undefined && visitResult!.Nodes.length > 0 ? visitResult!.Nodes : []),
    ];
    const members = NodeFactory_NewNodeList(astFactory, memberNodes) as GoPtr<ClassElementList>;

    const extendsClause = getEffectiveBaseTypeNode(input);

    if (extendsClause !== undefined) {
      const extendsEwta = AsExpressionWithTypeArguments(extendsClause)!;
      if (!IsEntityNameExpression(extendsEwta!.Expression) && extendsEwta!.Expression!.Kind !== KindNullKeyword) {
        const oldId = (NodeIsPresent(input!.name) && IsIdentifier(input!.name) && AsIdentifier(input!.name)!.Text.length > 0)
          ? AsIdentifier(input!.name)!.Text
          : "default";
        const newId = NodeFactory_NewUniqueNameEx(factory, oldId + "_base", { Flags: GeneratedIdentifierFlagsOptimistic, Prefix: "", Suffix: "" });
        receiver!.state!.getSymbolAccessibilityDiagnostic = (_result: SymbolAccessibilityResult): GoPtr<SymbolAccessibilityDiagnostic> => ({
          diagnosticMessage: diagnosticMessages.X_extends_clause_of_exported_class_0_has_or_is_using_private_name_1,
          errorNode: extendsClause,
          typeName: input!.name,
        });
        const varDecl = NewVariableDeclaration(
          astFactory,
          newId,
          undefined,
          receiver!.resolver.CreateTypeOfExpression(emitContext, extendsEwta!.Expression!, input, declarationEmitNodeBuilderFlags, declarationEmitInternalNodeBuilderFlags, SymbolTrackerImpl_AsSymbolTracker(receiver!.tracker)),
          undefined,
        );
        const declMods = receiver!.needsDeclare ? NodeFactory_NewModifierList(astFactory, [NodeFactory_NewModifier(astFactory, KindDeclareKeyword)]) : undefined;
        const statement = NewVariableStatement(
          astFactory,
          declMods,
          NewVariableDeclarationList(astFactory, NodeFactory_NewNodeList(astFactory, [varDecl]) as GoPtr<VariableDeclarationNodeList>, NodeFlagsConst),
        );
        const heritageClause = AsHeritageClause(extendsClause!.Parent)!;
        const updatedExtendsEwta = NodeFactory_UpdateExpressionWithTypeArguments(astFactory, extendsEwta, newId, NodeVisitor_VisitNodes(visitor, extendsEwta!.TypeArguments));
        const newHeritageClause = updateNode(
          NewHeritageClause(astFactory, heritageClause!.Token, NodeFactory_NewNodeList(astFactory, [updatedExtendsEwta]) as GoPtr<HeritageClauseList>),
          heritageClause,
          astFactory!.hooks,
        );
        const retainedHeritageClauses = NodeVisitor_VisitNodes(visitor, input!.HeritageClauses);
        const heritageList: GoSlice<GoPtr<Node>> = [
          newHeritageClause,
          ...(retainedHeritageClauses !== undefined && retainedHeritageClauses!.Nodes.length > 0 ? retainedHeritageClauses!.Nodes : []),
        ];
        const heritageClauses = NodeFactory_NewNodeList(astFactory, heritageList) as GoPtr<HeritageClauseList>;
        return NewSyntaxList(astFactory, [
          statement,
          NodeFactory_UpdateClassDeclaration(astFactory, input, modifiers, input!.name, typeParameters, heritageClauses, members),
        ]);
      }
    }

    return NodeFactory_UpdateClassDeclaration(
      astFactory,
      input,
      modifiers,
      input!.name,
      typeParameters,
      NodeVisitor_VisitNodes(visitor, input!.HeritageClauses),
      members,
    );
  } finally {
    SymbolTrackerImpl_PopErrorFallbackNode(receiver!.tracker);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.walkBindingPattern","kind":"method","status":"implemented","sigHash":"af90c35a26a58400c92f22a8988024c6a433aaca158bd9a1763e55d0613cbbed","bodyHash":"1d1d9f495d0209848ff4a58d6713d1a7810d0b8697aba719fb713a8dd51c66f4"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) walkBindingPattern(pattern *ast.BindingPattern, param *ast.Node) []*ast.Node {
 * 	var elems []*ast.Node
 * 	for _, elem := range pattern.Elements.Nodes {
 * 		if ast.IsOmittedExpression(elem) {
 * 			continue
 * 		}
 * 		if ast.IsBindingPattern(elem.Name()) {
 * 			elems = append(elems, tx.walkBindingPattern(elem.Name().AsBindingPattern(), param)...)
 * 			continue
 * 		}
 * 		elems = append(elems, tx.Factory().NewPropertyDeclaration(
 * 			tx.ensureModifiers(param),
 * 			elem.Name(),
 * 			nil, /*questionOrExclamationToken* /
 * 			tx.ensureType(elem, false),
 * 			nil, /*initializer* /
 * 		))
 * 	}
 * 	return elems
 * }
 */
export function DeclarationTransformer_walkBindingPattern(receiver: GoPtr<DeclarationTransformer>, pattern: GoPtr<BindingPattern>, param: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  return pattern!.Elements!.Nodes.reduce((elems: GoSlice<GoPtr<Node>>, elem: GoPtr<Node>): GoSlice<GoPtr<Node>> => {
    if (IsOmittedExpression(elem)) {
      return elems;
    }
    const elemName = Node_Name(elem);
    if (elemName !== undefined && IsBindingPattern(elemName)) {
      return [...elems, ...DeclarationTransformer_walkBindingPattern(receiver, AsBindingPattern(elemName)!, param)];
    }
    return [...elems, NewPropertyDeclaration(
      astFactory,
      DeclarationTransformer_ensureModifiers(receiver, param),
      elemName,
      undefined,
      DeclarationTransformer_ensureType(receiver, elem, false),
      undefined,
    )];
  }, []);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformVariableStatement","kind":"method","status":"implemented","sigHash":"b418e5198a4c889c0e6532957cf2eec567540b35b91fac12f7da65913bc61b51","bodyHash":"1a48b428c593e6e5bcb791995c71d590cad57e1240e23a2a0e99ffd9203aca23"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformVariableStatement(input *ast.VariableStatement) *ast.Node {
 * 	visible := false
 * 	for _, decl := range input.DeclarationList.AsVariableDeclarationList().Declarations.Nodes {
 * 		visible = getBindingNameVisible(tx.resolver, decl)
 * 		if visible {
 * 			break
 * 		}
 * 	}
 * 	if !visible {
 * 		return nil
 * 	}
 * 
 * 	nodes := tx.Visitor().VisitNodes(input.DeclarationList.AsVariableDeclarationList().Declarations)
 * 	if nodes != nil && len(nodes.Nodes) == 0 {
 * 		return nil
 * 	}
 * 
 * 	modifiers := tx.ensureModifiers(input.AsNode())
 * 
 * 	var declList *ast.Node
 * 	if ast.IsVarUsing(input.DeclarationList) || ast.IsVarAwaitUsing(input.DeclarationList) {
 * 		declList = tx.Factory().NewVariableDeclarationList(nodes, ast.NodeFlagsConst)
 * 		tx.EmitContext().SetOriginal(declList, input.DeclarationList)
 * 		tx.EmitContext().SetCommentRange(declList, input.DeclarationList.Loc)
 * 		declList.Loc = input.DeclarationList.Loc
 * 	} else {
 * 		declList = tx.Factory().UpdateVariableDeclarationList(input.DeclarationList.AsVariableDeclarationList(), nodes, input.DeclarationList.Flags)
 * 	}
 * 	return tx.Factory().UpdateVariableStatement(input, modifiers, declList)
 * }
 */
export function DeclarationTransformer_transformVariableStatement(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<VariableStatement>): GoPtr<Node> {
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const declList = AsVariableDeclarationList(input!.DeclarationList)!;
  const visible = declList.Declarations!.Nodes.some((decl) => getBindingNameVisible(receiver!.resolver, decl));
  if (!visible) {
    return undefined;
  }
  const nodes = NodeVisitor_VisitNodes(visitor, declList.Declarations);
  if (nodes !== undefined && nodes!.Nodes.length === 0) {
    return undefined;
  }
  const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
  let newDeclList: GoPtr<Node>;
  if (IsVarUsing(input!.DeclarationList) || IsVarAwaitUsing(input!.DeclarationList)) {
    const newList = NewVariableDeclarationList(astFactory, nodes, NodeFlagsConst);
    EmitContext_SetOriginal(emitContext, newList, input!.DeclarationList);
    EmitContext_SetCommentRange(emitContext, newList, input!.DeclarationList!.Loc);
    newList!.Loc = input!.DeclarationList!.Loc;
    newDeclList = newList;
  } else {
    if (nodes !== declList.Declarations || declList.Flags !== (input!.DeclarationList as GoPtr<VariableDeclarationList>)!.Flags) {
      newDeclList = updateNode(NewVariableDeclarationList(astFactory, nodes, declList.Flags), input!.DeclarationList, astFactory!.hooks);
    } else {
      newDeclList = input!.DeclarationList;
    }
  }
  if (modifiers !== input!.modifiers || newDeclList !== input!.DeclarationList) {
    return updateNode(NewVariableStatement(astFactory, modifiers, newDeclList), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformEnumDeclaration","kind":"method","status":"implemented","sigHash":"5914aaee18cf276fbd4b5225dc2ef928893b5c8167a9df170e22b4ff503a69c8","bodyHash":"00340974b06c36a47ef011add4dcea46a172441ae88d78339ce9d7203167b6cd"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformEnumDeclaration(input *ast.EnumDeclaration) *ast.Node {
 * 	return tx.Factory().UpdateEnumDeclaration(
 * 		input,
 * 		tx.ensureModifiers(input.AsNode()),
 * 		input.Name(),
 * 		tx.Factory().NewNodeList(core.MapNonNil(input.Members.Nodes, func(m *ast.Node) *ast.Node {
 * 			if tx.shouldStripInternal(m) {
 * 				return nil
 * 			}
 * 
 * 			// Rewrite enum values to their constants, if available
 * 			enumValue := tx.resolver.GetEnumMemberValue(m)
 * 
 * 			if tx.state.isolatedDeclarations && m.Initializer() != nil && enumValue.HasExternalReferences &&
 * 				// This will be its own compiler error instead, so don't report.
 * 				!ast.IsComputedPropertyName(m.Name()) {
 * 				tx.state.addDiagnostic(createDiagnosticForNode(m, diagnostics.Enum_member_initializers_must_be_computable_without_references_to_external_symbols_with_isolatedDeclarations))
 * 			}
 * 
 * 			var newInitializer *ast.Node
 * 			switch value := enumValue.Value.(type) {
 * 			case jsnum.Number:
 * 				if value >= 0 {
 * 					newInitializer = tx.Factory().NewNumericLiteral(value.String(), ast.TokenFlagsNone)
 * 				} else {
 * 					newInitializer = tx.Factory().NewPrefixUnaryExpression(
 * 						ast.KindMinusToken,
 * 						tx.Factory().NewNumericLiteral((-value).String(), ast.TokenFlagsNone),
 * 					)
 * 				}
 * 			case string:
 * 				newInitializer = tx.Factory().NewStringLiteral(value, ast.TokenFlagsNone)
 * 			default:
 * 				// nil
 * 				newInitializer = nil
 * 			}
 * 			result := tx.Factory().UpdateEnumMember(m.AsEnumMember(), m.Name(), newInitializer)
 * 			tx.preserveJsDoc(result, m)
 * 			return result
 * 		})),
 * 	)
 * }
 */
export function DeclarationTransformer_transformEnumDeclaration(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<EnumDeclaration>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const modifiers = DeclarationTransformer_ensureModifiers(receiver, input);
  const newMembers = MapNonNil(input!.Members!.Nodes, (m): GoPtr<Node> => {
    if (DeclarationTransformer_shouldStripInternal(receiver, m)) {
      return undefined;
    }
    // Rewrite enum values to their constants, if available
    const enumValue = receiver!.resolver.GetEnumMemberValue(m);
    if (receiver!.state!.isolatedDeclarations && Node_Initializer(m) !== undefined && enumValue.HasExternalReferences &&
        // This will be its own compiler error instead, so don't report.
        !IsComputedPropertyName(Node_Name(m))) {
      SymbolTrackerSharedState_addDiagnostic(receiver!.state!, createDiagnosticForNode(m, diagnosticMessages.Enum_member_initializers_must_be_computable_without_references_to_external_symbols_with_isolatedDeclarations));
    }
    const value = enumValue.Value;
    const newInitializer: GoPtr<Node> = (typeof value === 'number')
      ? (value >= 0
          ? NewNumericLiteral(astFactory, Number_String(value), TokenFlagsNone)
          : NewPrefixUnaryExpression(astFactory, KindMinusToken, NewNumericLiteral(astFactory, Number_String(-value), TokenFlagsNone)))
      : (typeof value === 'string')
      ? NewStringLiteral(astFactory, value, TokenFlagsNone)
      : undefined;
    const enumMember = AsEnumMember(m)!;
    const result = updateNode(NewEnumMember(astFactory, enumMember.name, newInitializer), m, astFactory!.hooks);
    DeclarationTransformer_preserveJsDoc(receiver, result, m);
    return result;
  });
  const newMembersList = NodeFactory_NewNodeList(astFactory, newMembers);
  if (modifiers !== input!.modifiers || newMembersList !== input!.Members) {
    return updateNode(NewEnumDeclaration(astFactory, modifiers, input!.name, newMembersList), input, astFactory!.hooks);
  }
  return input;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.ensureModifiers","kind":"method","status":"implemented","sigHash":"c31f8fcb5e92d64049015ebeffc483060baa78f1c0789c91479fa4e27e8e0841","bodyHash":"5cb2eb4e13530a02e3ae199cd165a676e62e9d2d70f758d11b41c5b1d4b73d34"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) ensureModifiers(node *ast.Node) *ast.ModifierList {
 * 	currentFlags := tx.host.GetEffectiveDeclarationFlags(tx.EmitContext().ParseNode(node), ast.ModifierFlagsAll)
 * 	newFlags := tx.ensureModifierFlags(node)
 * 	if currentFlags == newFlags {
 * 		// Elide decorators
 * 		mods := node.Modifiers()
 * 		if mods == nil {
 * 			return mods
 * 		}
 * 		return tx.Factory().NewModifierList(core.Filter(mods.Nodes, ast.IsModifier))
 * 	}
 * 	result := ast.CreateModifiersFromModifierFlags(newFlags, tx.Factory().NewModifier)
 * 	if len(result) == 0 {
 * 		return nil
 * 	}
 * 	return tx.Factory().NewModifierList(result)
 * }
 */
export function DeclarationTransformer_ensureModifiers(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>): GoPtr<ModifierList> {
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const currentFlags = receiver!.host.GetEffectiveDeclarationFlags(EmitContext_ParseNode(emitContext, node), ModifierFlagsAll);
  const newFlags = DeclarationTransformer_ensureModifierFlags(receiver, node);
  if (currentFlags === newFlags) {
    // Elide decorators
    const mods = Node_Modifiers(node);
    if (mods === undefined) {
      return mods;
    }
    return NodeFactory_NewModifierList(astFactory, Filter(mods!.Nodes, IsModifier));
  }
  const result = CreateModifiersFromModifierFlags(newFlags, (kind) => NodeFactory_NewModifier(astFactory, kind));
  if (result.length === 0) {
    return undefined;
  }
  return NodeFactory_NewModifierList(astFactory, result);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.ensureModifierFlags","kind":"method","status":"implemented","sigHash":"6be0724d6284878fd402988a2053beed8273de0a8468c78bba2fe77eb67aeb9f","bodyHash":"6b4ddb106f3029d38ba27016810690598119ac47fc2c54d402770df541650fcf"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) ensureModifierFlags(node *ast.Node) ast.ModifierFlags {
 * 	mask := ast.ModifierFlagsAll ^ (ast.ModifierFlagsPublic | ast.ModifierFlagsAsync | ast.ModifierFlagsOverride) // No async and override modifiers in declaration files
 * 	additions := ast.ModifierFlagsNone
 * 	if tx.needsDeclare && !isAlwaysType(node) {
 * 		additions = ast.ModifierFlagsAmbient
 * 	}
 * 	parentIsFile := node.Parent.Kind == ast.KindSourceFile
 * 	if !parentIsFile {
 * 		mask ^= ast.ModifierFlagsAmbient
 * 		additions = ast.ModifierFlagsNone
 * 	}
 * 	if ast.IsImplicitlyExportedJSTypeAlias(node) {
 * 		additions |= ast.ModifierFlagsExport
 * 	}
 * 	return maskModifierFlags(tx.host, node, mask, additions)
 * }
 */
export function DeclarationTransformer_ensureModifierFlags(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>): ModifierFlags {
  const baseMask = (ModifierFlagsAll ^ (ModifierFlagsPublic | ModifierFlagsAsync | ModifierFlagsOverride)) as ModifierFlags;
  const baseAdditions: ModifierFlags = (receiver!.needsDeclare && !isAlwaysType(node)) ? ModifierFlagsAmbient : ModifierFlagsNone;
  const parentIsFile = node!.Parent !== undefined && node!.Parent.Kind === KindSourceFile;
  const mask: ModifierFlags = parentIsFile ? baseMask : ((baseMask ^ ModifierFlagsAmbient) as ModifierFlags);
  const additions: ModifierFlags = parentIsFile
    ? (IsImplicitlyExportedJSTypeAlias(node) ? ((baseAdditions | ModifierFlagsExport) as ModifierFlags) : baseAdditions)
    : (IsImplicitlyExportedJSTypeAlias(node) ? ModifierFlagsExport : ModifierFlagsNone);
  return maskModifierFlags(receiver!.host, node, mask, additions);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.ensureTypeParams","kind":"method","status":"implemented","sigHash":"ba26e6ea322b990ed8dff04a8b0fad8fc034db368f4c42f188452a6361c4345a","bodyHash":"b6dc4cb1e883f6c6d0bf39f1fd023d6aee1b8c122e6042eec818c821183c820e"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) ensureTypeParams(node *ast.Node, params *ast.TypeParameterList) *ast.TypeParameterList {
 * 	if tx.host.GetEffectiveDeclarationFlags(tx.EmitContext().ParseNode(node), ast.ModifierFlagsPrivate) != 0 {
 * 		return nil
 * 	}
 * 	var typeParameters *ast.TypeParameterList
 * 	if typeParameters = tx.Visitor().VisitNodes(params); typeParameters != nil {
 * 		return typeParameters
 * 	}
 * 	oldErrorNameNode := tx.state.errorNameNode
 * 	tx.state.errorNameNode = node.Name()
 * 	var oldDiag GetSymbolAccessibilityDiagnostic
 * 	if !tx.suppressNewDiagnosticContexts {
 * 		oldDiag = tx.state.getSymbolAccessibilityDiagnostic
 * 		if canProduceDiagnostics(node) {
 * 			tx.state.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(node)
 * 		}
 * 	}
 *
 * 	if data := node.FunctionLikeData(); data != nil && data.FullSignature != nil {
 * 		if nodes := tx.resolver.CreateTypeParametersOfSignatureDeclaration(tx.EmitContext(), node, tx.enclosingDeclaration, declarationEmitNodeBuilderFlags, declarationEmitInternalNodeBuilderFlags, tx.tracker); nodes != nil {
 * 			typeParameters = &ast.TypeParameterList{
 * 				Loc:   node.Loc,
 * 				Nodes: nodes,
 * 			}
 * 		}
 * 	}
 *
 * 	tx.state.errorNameNode = oldErrorNameNode
 * 	if !tx.suppressNewDiagnosticContexts {
 * 		tx.state.getSymbolAccessibilityDiagnostic = oldDiag
 * 	}
 * 	return typeParameters
 * }
 */
export function DeclarationTransformer_ensureTypeParams(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>, params: GoPtr<TypeParameterList>): GoPtr<TypeParameterList> {
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  if (receiver!.host.GetEffectiveDeclarationFlags(EmitContext_ParseNode(emitContext, node), ModifierFlagsPrivate) !== 0) {
    return undefined;
  }
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const visited = NodeVisitor_VisitNodes(visitor, params);
  if (visited !== undefined) {
    return visited;
  }
  const oldErrorNameNode = receiver!.state!.errorNameNode;
  receiver!.state!.errorNameNode = Node_Name(node);
  const oldDiag = receiver!.suppressNewDiagnosticContexts ? undefined : receiver!.state!.getSymbolAccessibilityDiagnostic;
  if (!receiver!.suppressNewDiagnosticContexts && canProduceDiagnostics(node)) {
    receiver!.state!.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(node);
  }
  const tracker = SymbolTrackerImpl_AsSymbolTracker(receiver!.tracker);
  const data = Node_FunctionLikeData(node);
  const typeParameters: GoPtr<TypeParameterList> = (data !== undefined && data!.FullSignature !== undefined)
    ? (() => {
        const nodes = receiver!.resolver.CreateTypeParametersOfSignatureDeclaration(emitContext, node, receiver!.enclosingDeclaration, declarationEmitNodeBuilderFlags, declarationEmitInternalNodeBuilderFlags, tracker);
        if (nodes !== undefined && nodes.length > 0) {
          return { Loc: node!.Loc, Nodes: nodes } as GoPtr<TypeParameterList>;
        }
        return undefined;
      })()
    : undefined;
  receiver!.state!.errorNameNode = oldErrorNameNode;
  if (!receiver!.suppressNewDiagnosticContexts) {
    receiver!.state!.getSymbolAccessibilityDiagnostic = oldDiag!;
  }
  return typeParameters;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.updateParamList","kind":"method","status":"implemented","sigHash":"6aa2f065fa2b87765a45989e3daca255dfb01de8f5aca25ae040bdbb3cd96e30","bodyHash":"f9cbb9d3aecefb2ead280204fdcd27cb82db27e847ccb76f5d94b220ebc0951b"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) updateParamList(node *ast.Node, params *ast.ParameterList) *ast.ParameterList {
 * 	if tx.host.GetEffectiveDeclarationFlags(tx.EmitContext().ParseNode(node), ast.ModifierFlagsPrivate) != 0 || len(params.Nodes) == 0 {
 * 		return tx.Factory().NewNodeList([]*ast.Node{})
 * 	}
 * 	results := make([]*ast.Node, len(params.Nodes))
 * 	for i, p := range params.Nodes {
 * 		results[i] = tx.ensureParameter(p.AsParameterDeclaration())
 * 	}
 * 	return tx.Factory().NewNodeList(results)
 * }
 */
export function DeclarationTransformer_updateParamList(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>, params: GoPtr<ParameterList>): GoPtr<ParameterList> {
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  if (receiver!.host.GetEffectiveDeclarationFlags(EmitContext_ParseNode(emitContext, node), ModifierFlagsPrivate) !== 0 || params!.Nodes.length === 0) {
    return NodeFactory_NewNodeList(astFactory, []);
  }
  const results = params!.Nodes.map((p) => DeclarationTransformer_ensureParameter(receiver, AsParameterDeclaration(p)!));
  return NodeFactory_NewNodeList(astFactory, results);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.ensureParameter","kind":"method","status":"implemented","sigHash":"1b6f9e5314ea5cc4cc0f6541e325100222dedaa0e8624c0a143b11129260ecd7","bodyHash":"70877923efb1b4bb07d2e10bf42c4da96b702a1a64b925fafa08b29b7a336fa1"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) ensureParameter(p *ast.ParameterDeclaration) *ast.Node {
 * 	oldDiag := tx.state.getSymbolAccessibilityDiagnostic
 * 	if !tx.suppressNewDiagnosticContexts {
 * 		tx.state.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(p.AsNode())
 * 	}
 * 	var questionToken *ast.TokenNode
 * 	if tx.resolver.IsOptionalParameter(p.AsNode()) {
 * 		if p.QuestionToken != nil {
 * 			questionToken = p.QuestionToken
 * 		} else {
 * 			questionToken = tx.Factory().NewToken(ast.KindQuestionToken)
 * 		}
 * 	}
 * 	result := tx.Factory().UpdateParameterDeclaration(
 * 		p,
 * 		nil,
 * 		p.DotDotDotToken,
 * 		tx.filterBindingPatternInitializers(p.Name()),
 * 		questionToken,
 * 		tx.ensureType(p.AsNode(), true),
 * 		tx.ensureNoInitializer(p.AsNode()),
 * 	)
 * 	tx.state.getSymbolAccessibilityDiagnostic = oldDiag
 * 	return result
 * }
 */
export function DeclarationTransformer_ensureParameter(receiver: GoPtr<DeclarationTransformer>, p: GoPtr<ParameterDeclaration>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const oldDiag = receiver!.state!.getSymbolAccessibilityDiagnostic;
  if (!receiver!.suppressNewDiagnosticContexts) {
    receiver!.state!.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(p);
  }
  const questionToken: GoPtr<TokenNode> = receiver!.resolver.IsOptionalParameter(p)
    ? (p!.QuestionToken !== undefined ? p!.QuestionToken : NewToken(astFactory, KindQuestionToken))
    : undefined;
  const filteredName = DeclarationTransformer_filterBindingPatternInitializers(receiver, Node_Name(p));
  const typeNode = DeclarationTransformer_ensureType(receiver, p, true);
  const initializer = DeclarationTransformer_ensureNoInitializer(receiver, p);
  const result = updateNode(NewParameterDeclaration(astFactory, undefined, p!.DotDotDotToken, filteredName, questionToken, typeNode, initializer), p, astFactory!.hooks);
  receiver!.state!.getSymbolAccessibilityDiagnostic = oldDiag;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.ensureNoInitializer","kind":"method","status":"implemented","sigHash":"e3fdddfddc12fa3cc825747ada0f53c339171b35f873f398eb58a60f68ddf930","bodyHash":"6c35fbe341c27d3ec98d79f08a47f521cefbdd5a1232d55c48d9632b731d5d8a"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) ensureNoInitializer(node *ast.Node) *ast.Node {
 * 	if tx.shouldPrintWithInitializer(node) {
 * 		unwrappedInitializer := unwrapParenthesizedExpression(node.Initializer())
 * 		if !ast.IsPrimitiveLiteralValue(unwrappedInitializer, true) {
 * 			tx.tracker.ReportInferenceFallback(node)
 * 		}
 * 		return tx.resolver.CreateLiteralConstValue(tx.EmitContext(), tx.EmitContext().ParseNode(node), tx.tracker)
 * 	}
 * 	return nil
 * }
 */
export function DeclarationTransformer_ensureNoInitializer(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (DeclarationTransformer_shouldPrintWithInitializer(receiver, node)) {
    const unwrappedInitializer = unwrapParenthesizedExpression(Node_Initializer(node));
    if (!IsPrimitiveLiteralValue(unwrappedInitializer, true)) {
      SymbolTrackerImpl_ReportInferenceFallback(receiver!.tracker, node);
    }
    const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
    const tracker = SymbolTrackerImpl_AsSymbolTracker(receiver!.tracker);
    return receiver!.resolver.CreateLiteralConstValue(emitContext, EmitContext_ParseNode(emitContext, node), tracker);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.filterBindingPatternInitializers","kind":"method","status":"implemented","sigHash":"b1c70d2c5bcecd8a2997b707bb76833615cccf5d9dededa01d4153f799f4a5ee","bodyHash":"d21fabacbb69b8ba54624d84fd501d738ef9ffa7fbaf34016b2a7c0393167a68"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) filterBindingPatternInitializers(node *ast.Node) *ast.Node {
 * 	if node.Kind == ast.KindIdentifier {
 * 		return node
 * 	} else {
 * 		// TODO: visitor to avoid always making new nodes?
 * 		elements := make([]*ast.Node, 0, len(node.Elements()))
 * 		for _, elem := range node.Elements() {
 * 			if elem.Kind == ast.KindOmittedExpression {
 * 				elements = append(elements, elem)
 * 				continue
 * 			}
 * 			if elem.PropertyName() != nil && ast.IsComputedPropertyName(elem.PropertyName()) && ast.IsEntityNameExpression(elem.PropertyName().Expression()) {
 * 				tx.checkEntityNameVisibility(elem.PropertyName().Expression(), tx.enclosingDeclaration)
 * 			}
 * 			if elem.Name() == nil {
 * 				elements = append(elements, elem)
 * 				continue
 * 			}
 *
 * 			elements = append(elements, tx.Factory().UpdateBindingElement(
 * 				elem.AsBindingElement(),
 * 				elem.AsBindingElement().DotDotDotToken,
 * 				elem.PropertyName(),
 * 				tx.filterBindingPatternInitializers(elem.Name()),
 * 				nil,
 * 			))
 * 		}
 * 		elemList := tx.Factory().NewNodeList(elements)
 * 		return tx.Factory().UpdateBindingPattern(node.AsBindingPattern(), elemList)
 * 	}
 * }
 */
export function DeclarationTransformer_filterBindingPatternInitializers(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (node!.Kind === KindIdentifier) {
    return node;
  }
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  // TODO: visitor to avoid always making new nodes?
  const elements: GoSlice<GoPtr<Node>> = [];
  for (const elem of Node_Elements(node)!) {
    if (elem!.Kind === KindOmittedExpression) {
      elements.push(elem);
      continue;
    }
    const elemPropertyName = AsBindingElement(elem)!.PropertyName;
    if (elemPropertyName !== undefined && IsComputedPropertyName(elemPropertyName) && IsEntityNameExpression(Node_Expression(elemPropertyName))) {
      DeclarationTransformer_checkEntityNameVisibility(receiver, Node_Expression(elemPropertyName), receiver!.enclosingDeclaration);
    }
    const elemName = Node_Name(elem);
    if (elemName === undefined) {
      elements.push(elem);
      continue;
    }
    const bindingElem = AsBindingElement(elem)!;
    elements.push(updateNode(
      NewBindingElement(astFactory, bindingElem.DotDotDotToken, bindingElem.PropertyName, DeclarationTransformer_filterBindingPatternInitializers(receiver, elemName), undefined),
      elem,
      astFactory!.hooks,
    ));
  }
  const elemList = NodeFactory_NewNodeList(astFactory, elements);
  return updateNode(NewBindingPattern(astFactory, node!.Kind, elemList), node, astFactory!.hooks);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformImportEqualsDeclaration","kind":"method","status":"implemented","sigHash":"7313dd6ab49ee039bf576c87264247f7202ca24fb1376995e2ca4629a92003e6","bodyHash":"d0e35239bbc07844f1ed69c0c97de5aaf037c10c3014cd19d10b1de97e8ec787"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformImportEqualsDeclaration(decl *ast.ImportEqualsDeclaration) *ast.Node {
 * 	if !tx.resolver.IsDeclarationVisible(decl.AsNode()) {
 * 		return nil
 * 	}
 * 	if decl.ModuleReference.Kind == ast.KindExternalModuleReference {
 * 		// Rewrite external module names if necessary
 * 		specifier := ast.GetExternalModuleImportEqualsDeclarationExpression(decl.AsNode())
 * 		return tx.Factory().UpdateImportEqualsDeclaration(
 * 			decl,
 * 			decl.Modifiers(),
 * 			decl.IsTypeOnly,
 * 			decl.Name(),
 * 			tx.Factory().UpdateExternalModuleReference(decl.ModuleReference.AsExternalModuleReference(), tx.rewriteModuleSpecifier(decl.AsNode(), specifier)),
 * 		)
 * 	} else {
 * 		oldDiag := tx.state.getSymbolAccessibilityDiagnostic
 * 		tx.state.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(decl.AsNode())
 * 		tx.checkEntityNameVisibility(decl.ModuleReference, tx.enclosingDeclaration)
 * 		tx.state.getSymbolAccessibilityDiagnostic = oldDiag
 * 		return decl.AsNode()
 * 	}
 * }
 */
export function DeclarationTransformer_transformImportEqualsDeclaration(receiver: GoPtr<DeclarationTransformer>, decl: GoPtr<ImportEqualsDeclaration>): GoPtr<Node> {
  if (!receiver!.resolver.IsDeclarationVisible(decl)) {
    return undefined;
  }
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  if (decl!.ModuleReference!.Kind === KindExternalModuleReference) {
    // Rewrite external module names if necessary
    const specifier = GetExternalModuleImportEqualsDeclarationExpression(decl);
    const newSpecifier = DeclarationTransformer_rewriteModuleSpecifier(receiver, decl, specifier);
    const extRef = AsExternalModuleReference(decl!.ModuleReference)!;
    const newModuleRef = (newSpecifier !== extRef.Expression)
      ? updateNode(NewExternalModuleReference(astFactory, newSpecifier), decl!.ModuleReference, astFactory!.hooks)
      : decl!.ModuleReference;
    if (newModuleRef !== decl!.ModuleReference) {
      return updateNode(NewImportEqualsDeclaration(astFactory, decl!.modifiers, decl!.IsTypeOnly, decl!.name, newModuleRef), decl, astFactory!.hooks);
    }
    return decl;
  } else {
    const oldDiag = receiver!.state!.getSymbolAccessibilityDiagnostic;
    receiver!.state!.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(decl);
    DeclarationTransformer_checkEntityNameVisibility(receiver, decl!.ModuleReference, receiver!.enclosingDeclaration);
    receiver!.state!.getSymbolAccessibilityDiagnostic = oldDiag;
    return decl;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformImportDeclaration","kind":"method","status":"implemented","sigHash":"346c1635b71e4c4abbf765493a472eb48a0fe2fd3f4eba70a5dca9f517680028","bodyHash":"99e46a04aa294a28a9e29eac51208bd8ac2b04fb2990fbd602db9e14e9d92ab5"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformImportDeclaration(decl *ast.ImportDeclaration) *ast.Node {
 * 	if decl.ImportClause == nil {
 * 		// import "mod" - possibly needed for side effects? (global interface patches, module augmentations, etc)
 * 		return tx.Factory().UpdateImportDeclaration(
 * 			decl,
 * 			decl.Modifiers(),
 * 			decl.ImportClause,
 * 			tx.rewriteModuleSpecifier(decl.AsNode(), decl.ModuleSpecifier),
 * 			tx.tryGetResolutionModeOverride(decl.Attributes),
 * 		)
 * 	}
 * 	phaseModifier := decl.ImportClause.AsImportClause().PhaseModifier
 * 	if phaseModifier == ast.KindDeferKeyword {
 * 		phaseModifier = ast.KindUnknown
 * 	}
 * 	// The `importClause` visibility corresponds to the default's visibility.
 * 	var visibleDefaultBinding *ast.Node
 * 	if decl.ImportClause != nil && decl.ImportClause.Name() != nil && tx.resolver.IsDeclarationVisible(decl.ImportClause) {
 * 		visibleDefaultBinding = decl.ImportClause.Name()
 * 	}
 * 	if decl.ImportClause.AsImportClause().NamedBindings == nil {
 * 		// No named bindings (either namespace or list), meaning the import is just default or should be elided
 * 		if visibleDefaultBinding == nil {
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateImportDeclaration(
 * 			decl,
 * 			decl.Modifiers(),
 * 			tx.Factory().UpdateImportClause(
 * 				decl.ImportClause.AsImportClause(),
 * 				phaseModifier,
 * 				visibleDefaultBinding,
 * 				/*namedBindings* / nil,
 * 			),
 * 			tx.rewriteModuleSpecifier(decl.AsNode(), decl.ModuleSpecifier),
 * 			tx.tryGetResolutionModeOverride(decl.Attributes),
 * 		)
 * 	}
 * 	if decl.ImportClause.AsImportClause().NamedBindings.Kind == ast.KindNamespaceImport {
 * 		// Namespace import (optionally with visible default)
 * 		var namedBindings *ast.Node
 * 		if tx.resolver.IsDeclarationVisible(decl.ImportClause.AsImportClause().NamedBindings) {
 * 			namedBindings = decl.ImportClause.AsImportClause().NamedBindings
 * 		}
 * 		if visibleDefaultBinding == nil && namedBindings == nil {
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateImportDeclaration(
 * 			decl,
 * 			decl.Modifiers(),
 * 			tx.Factory().UpdateImportClause(
 * 				decl.ImportClause.AsImportClause(),
 * 				phaseModifier,
 * 				visibleDefaultBinding,
 * 				namedBindings,
 * 			),
 * 			tx.rewriteModuleSpecifier(decl.AsNode(), decl.ModuleSpecifier),
 * 			tx.tryGetResolutionModeOverride(decl.Attributes),
 * 		)
 * 	}
 * 	// Named imports (optionally with visible default)
 * 	bindingList := core.Filter(
 * 		decl.ImportClause.AsImportClause().NamedBindings.Elements(),
 * 		func(b *ast.Node) bool {
 * 			return tx.resolver.IsDeclarationVisible(b)
 * 		},
 * 	)
 * 	if len(bindingList) > 0 || visibleDefaultBinding != nil {
 * 		var namedImports *ast.Node
 * 		if len(bindingList) > 0 {
 * 			namedImports = tx.Factory().UpdateNamedImports(
 * 				decl.ImportClause.AsImportClause().NamedBindings.AsNamedImports(),
 * 				tx.Factory().NewNodeList(bindingList),
 * 			)
 * 		}
 * 		return tx.Factory().UpdateImportDeclaration(
 * 			decl,
 * 			decl.Modifiers(),
 * 			tx.Factory().UpdateImportClause(
 * 				decl.ImportClause.AsImportClause(),
 * 				phaseModifier,
 * 				visibleDefaultBinding,
 * 				namedImports,
 * 			),
 * 			tx.rewriteModuleSpecifier(decl.AsNode(), decl.ModuleSpecifier),
 * 			tx.tryGetResolutionModeOverride(decl.Attributes),
 * 		)
 * 	}
 * 	// Augmentation of export depends on import
 * 	if tx.resolver.IsImportRequiredByAugmentation(decl) {
 * 		if tx.state.isolatedDeclarations {
 * 			tx.state.addDiagnostic(createDiagnosticForNode(decl.AsNode(), diagnostics.Declaration_emit_for_this_file_requires_preserving_this_import_for_augmentations_This_is_not_supported_with_isolatedDeclarations))
 * 		}
 * 		return tx.Factory().UpdateImportDeclaration(
 * 			decl,
 * 			decl.Modifiers(),
 * 			/*importClause* / nil,
 * 			tx.rewriteModuleSpecifier(decl.AsNode(), decl.ModuleSpecifier),
 * 			tx.tryGetResolutionModeOverride(decl.Attributes),
 * 		)
 * 	}
 * 	// Nothing visible
 * 	return nil
 * }
 */
export function DeclarationTransformer_transformImportDeclaration(receiver: GoPtr<DeclarationTransformer>, decl: GoPtr<ImportDeclaration>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const makeImportDecl = (importClause: GoPtr<Node>, moduleSpecifier: GoPtr<Node>, attributes: GoPtr<Node>): GoPtr<Node> => {
    const newSpec = DeclarationTransformer_rewriteModuleSpecifier(receiver, decl, moduleSpecifier);
    const newAttribs = DeclarationTransformer_tryGetResolutionModeOverride(receiver, attributes);
    if (importClause !== decl!.ImportClause || newSpec !== decl!.ModuleSpecifier || newAttribs !== decl!.Attributes) {
      return updateNode(NewImportDeclaration(astFactory, decl!.modifiers, importClause, newSpec, newAttribs), decl, astFactory!.hooks);
    }
    return decl;
  };
  if (decl!.ImportClause === undefined) {
    // import "mod" - possibly needed for side effects? (global interface patches, module augmentations, etc)
    return makeImportDecl(undefined, decl!.ModuleSpecifier, decl!.Attributes);
  }
  const importClauseNode = AsImportClause(decl!.ImportClause)!;
  let phaseModifier = importClauseNode.PhaseModifier;
  if (phaseModifier === KindDeferKeyword) {
    phaseModifier = KindUnknown;
  }
  // The `importClause` visibility corresponds to the default's visibility.
  const visibleDefaultBinding: GoPtr<Node> =
    (decl!.ImportClause !== undefined && importClauseNode.name !== undefined && receiver!.resolver.IsDeclarationVisible(decl!.ImportClause))
      ? importClauseNode.name
      : undefined;
  const makeImportClause = (name: GoPtr<Node>, namedBindings: GoPtr<Node>): GoPtr<Node> => {
    if (name !== importClauseNode.name || phaseModifier !== importClauseNode.PhaseModifier || namedBindings !== importClauseNode.NamedBindings) {
      return updateNode(NewImportClause(astFactory, phaseModifier, name, namedBindings), decl!.ImportClause, astFactory!.hooks);
    }
    return decl!.ImportClause;
  };
  if (importClauseNode.NamedBindings === undefined) {
    // No named bindings (either namespace or list), meaning the import is just default or should be elided
    if (visibleDefaultBinding === undefined) {
      return undefined;
    }
    return makeImportDecl(makeImportClause(visibleDefaultBinding, undefined), decl!.ModuleSpecifier, decl!.Attributes);
  }
  if (importClauseNode.NamedBindings!.Kind === KindNamespaceImport) {
    // Namespace import (optionally with visible default)
    const namedBindings: GoPtr<Node> = receiver!.resolver.IsDeclarationVisible(importClauseNode.NamedBindings)
      ? importClauseNode.NamedBindings
      : undefined;
    if (visibleDefaultBinding === undefined && namedBindings === undefined) {
      return undefined;
    }
    return makeImportDecl(makeImportClause(visibleDefaultBinding, namedBindings), decl!.ModuleSpecifier, decl!.Attributes);
  }
  // Named imports (optionally with visible default)
  const bindingList = Filter(Node_Elements(importClauseNode.NamedBindings) ?? [], (b) => receiver!.resolver.IsDeclarationVisible(b));
  if (bindingList.length > 0 || visibleDefaultBinding !== undefined) {
    const namedImports: GoPtr<Node> = bindingList.length > 0
      ? updateNode(NewNamedImports(astFactory, NodeFactory_NewNodeList(astFactory, bindingList)), importClauseNode.NamedBindings, astFactory!.hooks)
      : undefined;
    return makeImportDecl(makeImportClause(visibleDefaultBinding, namedImports), decl!.ModuleSpecifier, decl!.Attributes);
  }
  // Augmentation of export depends on import
  if (receiver!.resolver.IsImportRequiredByAugmentation(decl)) {
    if (receiver!.state!.isolatedDeclarations) {
      SymbolTrackerSharedState_addDiagnostic(receiver!.state!, createDiagnosticForNode(decl, diagnosticMessages.Declaration_emit_for_this_file_requires_preserving_this_import_for_augmentations_This_is_not_supported_with_isolatedDeclarations));
    }
    return makeImportDecl(undefined, decl!.ModuleSpecifier, decl!.Attributes);
  }
  // Nothing visible
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformJSDocTypeExpression","kind":"method","status":"implemented","sigHash":"c002e719997e7436ae281b4e24453353a038f535ca01817c17b5f8912213d017","bodyHash":"238a320bdbb0e384f22e6d34ace98eab142faaf47a04224aa8c94ae65571341a"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformJSDocTypeExpression(input *ast.JSDocTypeExpression) *ast.Node {
 * 	return tx.Visitor().Visit(input.Type)
 * }
 */
export function DeclarationTransformer_transformJSDocTypeExpression(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<JSDocTypeExpression>): GoPtr<Node> {
  return NodeVisitor_VisitNode(Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor, input!.Type);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformJSDocTypeLiteral","kind":"method","status":"implemented","sigHash":"00beb8b69529648c792162ea0693557a471511c47b24377a014ef789910dad1b","bodyHash":"99d81e38fea0e3206321c9066ab3afc912f35ff0195491253dae30e381257493"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformJSDocTypeLiteral(input *ast.JSDocTypeLiteral) *ast.Node {
 * 	members, _ := tx.Visitor().VisitSlice(input.JSDocPropertyTags)
 * 	replacement := tx.Factory().NewTypeLiteralNode(tx.Factory().NewNodeList(members))
 * 	tx.EmitContext().SetOriginal(replacement, input.AsNode())
 * 	return replacement
 * }
 */
export function DeclarationTransformer_transformJSDocTypeLiteral(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<JSDocTypeLiteral>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const [members] = NodeVisitor_VisitSlice(visitor, input!.JSDocPropertyTags);
  const replacement = NewTypeLiteralNode(astFactory, NodeFactory_NewNodeList(astFactory, members));
  EmitContext_SetOriginal(emitContext, replacement, input);
  return replacement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformJSDocPropertyTag","kind":"method","status":"implemented","sigHash":"3fdfd5df86e925ac51261faf4d405f084ca06243b16144660af023b10643e03d","bodyHash":"ed609a6acd7f1eab2159e3362884a0f7bc98aed66d13e9a3622cbb2a50621f43"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformJSDocPropertyTag(input *ast.JSDocParameterOrPropertyTag) *ast.Node {
 * 	replacement := tx.Factory().NewPropertySignatureDeclaration(
 * 		nil,
 * 		tx.Visitor().Visit(input.TagName),
 * 		nil,
 * 		tx.Visitor().Visit(input.TypeExpression),
 * 		nil,
 * 	)
 * 	tx.EmitContext().SetOriginal(replacement, input.AsNode())
 * 	return replacement
 * }
 */
export function DeclarationTransformer_transformJSDocPropertyTag(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<JSDocParameterOrPropertyTag>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const replacement = NewPropertySignatureDeclaration(astFactory, undefined, NodeVisitor_VisitNode(visitor, input!.TagName), undefined, NodeVisitor_VisitNode(visitor, input!.TypeExpression), undefined);
  EmitContext_SetOriginal(emitContext, replacement, input);
  return replacement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformJSDocAllType","kind":"method","status":"implemented","sigHash":"0612c9fa7e9f61f2306bd1d84e556136ad09d628cf44296e7b9f750dddd9ed95","bodyHash":"936544d7a67033d65d93ef4fcd2aae4dc06e1d01a8154de49bd672787145b10c"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformJSDocAllType(input *ast.JSDocAllType) *ast.Node {
 * 	replacement := tx.Factory().NewKeywordTypeNode(ast.KindAnyKeyword)
 * 	tx.EmitContext().SetOriginal(replacement, input.AsNode())
 * 	return replacement
 * }
 */
export function DeclarationTransformer_transformJSDocAllType(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<JSDocAllType>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const replacement = NewKeywordTypeNode(astFactory, KindAnyKeyword);
  EmitContext_SetOriginal(emitContext, replacement, input);
  return replacement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformJSDocNullableType","kind":"method","status":"implemented","sigHash":"6220a8fd5602a9132c9569657211a96dd37f91d36ffac1f21f55c8123a9c6b55","bodyHash":"0a9bccfcb5b7d3b44dfa424311cf924319aee6ccec94f7087d8319d91d0fd210"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformJSDocNullableType(input *ast.JSDocNullableType) *ast.Node {
 * 	replacement := tx.Factory().NewUnionTypeNode(tx.Factory().NewNodeList([]*ast.Node{
 * 		tx.Visitor().Visit(input.Type),
 * 		tx.Factory().NewLiteralTypeNode(tx.Factory().NewKeywordExpression(ast.KindNullKeyword)),
 * 	}))
 * 	tx.EmitContext().SetOriginal(replacement, input.AsNode())
 * 	return replacement
 * }
 */
export function DeclarationTransformer_transformJSDocNullableType(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<JSDocNullableType>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const replacement = NewUnionTypeNode(astFactory, NodeFactory_NewNodeList(astFactory, [
    NodeVisitor_VisitNode(visitor, input!.Type),
    NewLiteralTypeNode(astFactory, NewKeywordExpression(astFactory, KindNullKeyword)),
  ]));
  EmitContext_SetOriginal(emitContext, replacement, input);
  return replacement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformJSDocNonNullableType","kind":"method","status":"implemented","sigHash":"4a2897aff5a5dd4d521f237b2647040c5c43e3135b8b3a6717bbcb8c27948fba","bodyHash":"02beb5c6024acb773bcf5a27db51bc0463110bd94d2b657ec81d26905e4dfd55"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformJSDocNonNullableType(input *ast.JSDocNonNullableType) *ast.Node {
 * 	return tx.Visitor().Visit(input.Type)
 * }
 */
export function DeclarationTransformer_transformJSDocNonNullableType(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<JSDocNonNullableType>): GoPtr<Node> {
  return NodeVisitor_VisitNode(Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor, input!.Type);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformJSDocVariadicType","kind":"method","status":"implemented","sigHash":"b5dcd4a25781e83e6e08ee37e3410ff10e7bb6c8c8cced3bd27091a9744040e1","bodyHash":"1c11f1b7d047a478fd1367bb09055db8203b682b89b114835cd814009e3092dd"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformJSDocVariadicType(input *ast.JSDocVariadicType) *ast.Node {
 * 	replacement := tx.Factory().NewArrayTypeNode(tx.Visitor().Visit(input.Type))
 * 	tx.EmitContext().SetOriginal(replacement, input.AsNode())
 * 	return replacement
 * }
 */
export function DeclarationTransformer_transformJSDocVariadicType(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<JSDocVariadicType>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const replacement = NewArrayTypeNode(astFactory, NodeVisitor_VisitNode(visitor, input!.Type));
  EmitContext_SetOriginal(emitContext, replacement, input);
  return replacement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformJSDocOptionalType","kind":"method","status":"implemented","sigHash":"1eb7cf6f72651c8bafb67a5e7b4393851df2edbf3b8713b5613e100839316e92","bodyHash":"62ebae195565a971606a0b56a3251661539d347d2325343faad2a1122e0c1332"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformJSDocOptionalType(input *ast.JSDocOptionalType) *ast.Node {
 * 	replacement := tx.Factory().NewUnionTypeNode(tx.Factory().NewNodeList([]*ast.Node{
 * 		tx.Visitor().Visit(input.Type),
 * 		tx.Factory().NewKeywordTypeNode(ast.KindUndefinedKeyword),
 * 	}))
 * 	tx.EmitContext().SetOriginal(replacement, input.AsNode())
 * 	return replacement
 * }
 */
export function DeclarationTransformer_transformJSDocOptionalType(receiver: GoPtr<DeclarationTransformer>, input: GoPtr<JSDocOptionalType>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const replacement = NewUnionTypeNode(astFactory, NodeFactory_NewNodeList(astFactory, [
    NodeVisitor_VisitNode(visitor, input!.Type),
    NewKeywordTypeNode(astFactory, KindUndefinedKeyword),
  ]));
  EmitContext_SetOriginal(emitContext, replacement, input);
  return replacement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.visitExpressionStatement","kind":"method","status":"implemented","sigHash":"162013a14fc71c190de06b228e3395c49bccbb3b37056179b347a303030bae72","bodyHash":"2f1e714190b9887038946d740391c2d4cbd241390110d859f949989f5f2808b2"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) visitExpressionStatement(node *ast.Node) *ast.Node {
 * 	if expression := node.Expression(); expression != nil {
 * 		switch ast.GetAssignmentDeclarationKind(expression) {
 * 		case ast.JSDeclarationKindModuleExports:
 * 			if ast.IsSourceFile(node.Parent) && node.Parent.AsSourceFile().CommonJSModuleIndicator != nil {
 * 				return tx.transformExportAssignment(node, expression, expression.AsBinaryExpression().Right, true /*isExportEquals* /)
 * 			}
 * 		case ast.JSDeclarationKindExportsProperty:
 * 			if ast.IsSourceFile(node.Parent) && node.Parent.AsSourceFile().CommonJSModuleIndicator != nil {
 * 				return tx.transformCommonJSExport(expression, ast.GetElementOrPropertyAccessName(expression.AsBinaryExpression().Left))
 * 			}
 * 		case ast.JSDeclarationKindProperty:
 * 			return tx.transformExpandoAssignment(expression.AsBinaryExpression())
 * 		case ast.JSDeclarationKindObjectDefinePropertyExports:
 * 			if ast.IsSourceFile(node.Parent) && node.Parent.AsSourceFile().CommonJSModuleIndicator != nil {
 * 				return tx.transformCommonJSExport(expression, expression.Arguments()[1])
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function DeclarationTransformer_visitExpressionStatement(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const expression = Node_Expression(node);
  if (expression !== undefined) {
    switch (GetAssignmentDeclarationKind(expression)) {
      case JSDeclarationKindModuleExports:
        if (IsSourceFile(node!.Parent) && AsSourceFile(node!.Parent)!.CommonJSModuleIndicator !== undefined) {
          return DeclarationTransformer_transformExportAssignment(receiver, node, expression, AsBinaryExpression(expression)!.Right, true as bool);
        }
        break;
      case JSDeclarationKindExportsProperty:
        if (IsSourceFile(node!.Parent) && AsSourceFile(node!.Parent)!.CommonJSModuleIndicator !== undefined) {
          return DeclarationTransformer_transformCommonJSExport(receiver, expression, GetElementOrPropertyAccessName(AsBinaryExpression(expression)!.Left));
        }
        break;
      case JSDeclarationKindProperty:
        return DeclarationTransformer_transformExpandoAssignment(receiver, AsBinaryExpression(expression)!);
      case JSDeclarationKindObjectDefinePropertyExports:
        if (IsSourceFile(node!.Parent) && AsSourceFile(node!.Parent)!.CommonJSModuleIndicator !== undefined) {
          const args = Node_Arguments(expression);
          return DeclarationTransformer_transformCommonJSExport(receiver, expression, args !== undefined ? args[1] : undefined);
        }
        break;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformExpandoAssignment","kind":"method","status":"implemented","sigHash":"0b92cc38be505860a06a19d02a325f6a06308b7cd9d5ddccf98f97cacff9977c","bodyHash":"0121b37af0fbfc21f2c71f27bad33c56cd00bcb2826cba0bd4541d7b50ccb9ff"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformExpandoAssignment(node *ast.BinaryExpression) *ast.Node {
 * 	left := node.Left
 * 
 * 	symbol := node.Symbol
 * 	if symbol == nil || symbol.Flags&ast.SymbolFlagsAssignment == 0 {
 * 		return nil
 * 	}
 * 
 * 	ns := ast.GetLeftmostAccessExpression(left)
 * 	if ns == nil || ns.Kind != ast.KindIdentifier {
 * 		return nil
 * 	}
 * 
 * 	declaration := tx.resolver.GetReferencedValueDeclaration(ns)
 * 	if declaration == nil {
 * 		return nil
 * 	}
 * 
 * 	if ast.IsVariableDeclaration(declaration) && declaration.Type() != nil {
 * 		return nil
 * 	}
 * 
 * 	host := declaration.Symbol()
 * 	if host == nil {
 * 		return nil
 * 	}
 * 
 * 	name := tx.Factory().NewIdentifier(ns.Text())
 * 	property := tx.tryGetPropertyName(left)
 * 	if property == "" || !scanner.IsIdentifierText(property, core.LanguageVariantStandard) {
 * 		return nil
 * 	}
 * 
 * 	tx.transformExpandoHost(name, declaration)
 * 
 * 	if ast.IsFunctionDeclaration(declaration) && !shouldEmitFunctionProperties(declaration.AsFunctionDeclaration()) {
 * 		return nil
 * 	}
 * 
 * 	isNonContextualKeywordName := ast.IsNonContextualKeyword(scanner.StringToToken(property))
 * 	exportName := core.IfElse(isNonContextualKeywordName, tx.Factory().NewGeneratedNameForNode(left), tx.Factory().NewIdentifier(property))
 * 
 * 	synthesizedNamespace := tx.Factory().NewModuleDeclaration(nil /*modifiers* /, ast.KindNamespaceKeyword, name, tx.Factory().NewModuleBlock(tx.Factory().NewNodeList([]*ast.Node{})))
 * 	synthesizedNamespace.Parent = tx.enclosingDeclaration
 * 
 * 	declarationData := synthesizedNamespace.DeclarationData()
 * 	declarationData.Symbol = host
 * 
 * 	containerData := synthesizedNamespace.LocalsContainerData()
 * 	containerData.Locals = make(ast.SymbolTable, 0)
 * 
 * 	saveDiag := tx.state.getSymbolAccessibilityDiagnostic
 * 	tx.state.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(node.AsNode())
 * 	t := tx.resolver.CreateTypeOfExpression(tx.EmitContext(), left, synthesizedNamespace, declarationEmitNodeBuilderFlags, declarationEmitInternalNodeBuilderFlags|nodebuilder.InternalFlagsNoSyntacticPrinter, tx.tracker)
 * 	tx.state.getSymbolAccessibilityDiagnostic = saveDiag
 * 
 * 	statements := []*ast.Statement{
 * 		tx.Factory().NewVariableStatement(
 * 			nil, /*modifiers* /
 * 			tx.Factory().NewVariableDeclarationList(
 * 				tx.Factory().NewNodeList([]*ast.Node{
 * 					tx.Factory().NewVariableDeclaration(exportName, nil /*exclamationToken* /, t, nil /*initializer* /),
 * 				}),
 * 				ast.NodeFlagsNone,
 * 			),
 * 		),
 * 	}
 * 
 * 	if isNonContextualKeywordName {
 * 		namedExports := tx.Factory().NewNamedExports(tx.Factory().NewNodeList(
 * 			[]*ast.Node{
 * 				tx.Factory().NewExportSpecifier(false /*isTypeOnly* /, exportName, tx.Factory().NewIdentifier(left.Name().Text())),
 * 			},
 * 		))
 * 		statements = append(statements, tx.Factory().NewExportDeclaration(nil /*modifiers* /, false /*isTypeOnly* /, namedExports, nil /*moduleSpecifier* /, nil /*attributes* /))
 * 	}
 * 
 * 	flags := tx.host.GetEffectiveDeclarationFlags(tx.EmitContext().ParseNode(declaration), ast.ModifierFlagsAll)
 * 	modifierFlags := ast.ModifierFlagsAmbient
 * 
 * 	if flags&ast.ModifierFlagsExport != 0 {
 * 		if flags&ast.ModifierFlagsDefault == 0 {
 * 			modifierFlags |= ast.ModifierFlagsExport
 * 		}
 * 		tx.resultHasScopeMarker = true
 * 		tx.resultHasExternalModuleIndicator = true
 * 	}
 * 
 * 	return tx.Factory().NewModuleDeclaration(tx.Factory().NewModifierList(ast.CreateModifiersFromModifierFlags(modifierFlags, tx.Factory().NewModifier)), ast.KindNamespaceKeyword, name, tx.Factory().NewModuleBlock(tx.Factory().NewNodeList(statements)))
 * }
 */
export function DeclarationTransformer_transformExpandoAssignment(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<BinaryExpression>): GoPtr<Node> {
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const left = node!.Left;
  const symbol = Node_Symbol(node as unknown as GoPtr<Node>);
  if (symbol === undefined || (symbol!.Flags & SymbolFlagsAssignment) === 0) {
    return undefined;
  }
  const ns = GetLeftmostAccessExpression(left);
  if (ns === undefined || ns!.Kind !== KindIdentifier) {
    return undefined;
  }
  const declaration = receiver!.resolver.GetReferencedValueDeclaration(AsIdentifier(ns)!);
  if (declaration === undefined) {
    return undefined;
  }
  if (IsVariableDeclaration(declaration) && Node_Type(declaration) !== undefined) {
    return undefined;
  }
  const host = Node_Symbol(declaration);
  if (host === undefined) {
    return undefined;
  }
  const name = NewIdentifier(astFactory, Node_Text(ns));
  const property = DeclarationTransformer_tryGetPropertyName(receiver, left);
  if (property === "" || !IsIdentifierText(property, LanguageVariantStandard)) {
    return undefined;
  }
  DeclarationTransformer_transformExpandoHost(receiver, name, declaration);
  if (IsFunctionDeclaration(declaration) && !shouldEmitFunctionProperties(AsFunctionDeclaration(declaration)!)) {
    return undefined;
  }
  const isNonContextualKeywordName = IsNonContextualKeyword(StringToToken(property));
  const exportName = isNonContextualKeywordName
    ? NodeFactory_NewGeneratedNameForNode(factory, left)
    : NewIdentifier(astFactory, property);
  const synthesizedNamespace = NewModuleDeclaration(astFactory, undefined, KindNamespaceKeyword, name, NewModuleBlock(astFactory, NodeFactory_NewNodeList(astFactory, [])));
  synthesizedNamespace!.Parent = receiver!.enclosingDeclaration;
  (Node_DeclarationData(synthesizedNamespace) as unknown as { Symbol?: GoPtr<AstSymbol> })!.Symbol = host;
  (Node_LocalsContainerData(synthesizedNamespace) as unknown as { Locals?: GoMap<string, GoPtr<AstSymbol>> })!.Locals = new globalThis.Map();
  const saveDiag = receiver!.state!.getSymbolAccessibilityDiagnostic;
  receiver!.state!.getSymbolAccessibilityDiagnostic = createGetSymbolAccessibilityDiagnosticForNode(node as unknown as GoPtr<Node>);
  const t = receiver!.resolver.CreateTypeOfExpression(emitContext, left, synthesizedNamespace, declarationEmitNodeBuilderFlags, declarationEmitInternalNodeBuilderFlags | InternalFlagsNoSyntacticPrinter, SymbolTrackerImpl_AsSymbolTracker(receiver!.tracker));
  receiver!.state!.getSymbolAccessibilityDiagnostic = saveDiag;
  const varDecl = NewVariableDeclaration(astFactory, exportName, undefined, t, undefined);
  const varDeclList = NewVariableDeclarationList(astFactory, NodeFactory_NewNodeList(astFactory, [varDecl]) as GoPtr<VariableDeclarationNodeList>, NodeFlagsNone);
  const varStatement = NewVariableStatement(astFactory, undefined, varDeclList);
  const statements: GoSlice<GoPtr<Node>> = isNonContextualKeywordName
    ? [
        varStatement,
        NewExportDeclaration(astFactory, undefined, false as bool, NewNamedExports(astFactory, NodeFactory_NewNodeList(astFactory, [NewExportSpecifier(astFactory, false as bool, exportName, NewIdentifier(astFactory, Node_Text(Node_Name(left)!)))]) as GoPtr<ExportSpecifierList>), undefined, undefined),
      ]
    : [varStatement];
  const flags = receiver!.host.GetEffectiveDeclarationFlags(EmitContext_ParseNode(emitContext, declaration), ModifierFlagsAll);
  const baseModifierFlags = ModifierFlagsAmbient;
  const modifierFlags = (flags & ModifierFlagsExport) !== 0
    ? (() => {
        receiver!.resultHasScopeMarker = true;
        receiver!.resultHasExternalModuleIndicator = true;
        return (flags & ModifierFlagsDefault) === 0 ? baseModifierFlags | ModifierFlagsExport : baseModifierFlags;
      })()
    : baseModifierFlags;
  return NewModuleDeclaration(astFactory, NodeFactory_NewModifierList(astFactory, CreateModifiersFromModifierFlags(modifierFlags, (kind) => NodeFactory_NewModifier(astFactory, kind))), KindNamespaceKeyword, name, NewModuleBlock(astFactory, NodeFactory_NewNodeList(astFactory, statements)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.transformExpandoHost","kind":"method","status":"implemented","sigHash":"646110464b3b5152aebccec085bd7f0bb0d445581280f1ac598d539a40d3b011","bodyHash":"c27b75aca2f0cbebe22736b517aaf5f7be405e35db899ff94b235167407865a4"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) transformExpandoHost(name *ast.Node, declaration *ast.Declaration) {
 * 	root := core.IfElse(ast.IsVariableDeclaration(declaration), declaration.Parent.Parent, declaration)
 * 	id := ast.GetNodeId(tx.EmitContext().MostOriginal(root))
 * 
 * 	if tx.expandoHosts.Has(id) {
 * 		return
 * 	}
 * 
 * 	saveNeedsDeclare := tx.needsDeclare
 * 	tx.needsDeclare = true
 * 
 * 	modifierFlags := tx.ensureModifierFlags(root)
 * 	defaultExport := modifierFlags&ast.ModifierFlagsExport != 0 && modifierFlags&ast.ModifierFlagsDefault != 0
 * 
 * 	tx.needsDeclare = saveNeedsDeclare
 * 
 * 	if defaultExport {
 * 		modifierFlags |= ast.ModifierFlagsAmbient
 * 		modifierFlags ^= ast.ModifierFlagsDefault
 * 		modifierFlags ^= ast.ModifierFlagsExport
 * 	}
 * 
 * 	modifiers := tx.Factory().NewModifierList(ast.CreateModifiersFromModifierFlags(modifierFlags, tx.Factory().NewModifier))
 * 	replacement := make([]*ast.Node, 0)
 * 
 * 	if ast.IsFunctionDeclaration(declaration) {
 * 		typeParameters, parameters, asteriskToken := extractExpandoHostParams(declaration)
 * 		replacement = append(replacement, tx.Factory().UpdateFunctionDeclaration(declaration.AsFunctionDeclaration(), modifiers, asteriskToken, declaration.Name(), tx.ensureTypeParams(declaration, typeParameters), tx.updateParamList(declaration, parameters), tx.ensureType(declaration, false), nil /*fullSignature* /, nil /*body* /))
 * 	} else if ast.IsVariableDeclaration(declaration) && ast.IsFunctionExpressionOrArrowFunction(declaration.Initializer()) {
 * 		fn := declaration.Initializer()
 * 		typeParameters, parameters, asteriskToken := extractExpandoHostParams(fn)
 * 		replacement = append(replacement, tx.Factory().NewFunctionDeclaration(modifiers, asteriskToken, tx.Factory().NewIdentifier(name.Text()), tx.ensureTypeParams(fn, typeParameters), tx.updateParamList(fn, parameters), tx.ensureType(fn, false), nil /*fullSignature* /, nil /*body* /))
 * 	} else {
 * 		return
 * 	}
 * 
 * 	if defaultExport {
 * 		replacement = append(replacement, tx.Factory().NewExportAssignment(nil /*modifiers* /, false /*isExportEquals* /, nil /*typeNode* /, name))
 * 	}
 * 
 * 	tx.expandoHosts.Add(id)
 * 	tx.lateStatementReplacementMap[id] = tx.Factory().NewSyntaxList(replacement)
 * }
 */
export function DeclarationTransformer_transformExpandoHost(receiver: GoPtr<DeclarationTransformer>, name: GoPtr<Node>, declaration: GoPtr<Declaration>): void {
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0);
  const astFactory = factory!.__tsgoEmbedded0;
  const root = IsVariableDeclaration(declaration) ? declaration!.Parent?.Parent : declaration;
  const id = GetNodeId(EmitContext_MostOriginal(emitContext, root!));
  if (Set_Has(receiver!.expandoHosts, id)) {
    return;
  }
  const saveNeedsDeclare = receiver!.needsDeclare;
  receiver!.needsDeclare = true;
  const modifierFlags = DeclarationTransformer_ensureModifierFlags(receiver, root!);
  const defaultExport = (modifierFlags & ModifierFlagsExport) !== 0 && (modifierFlags & ModifierFlagsDefault) !== 0;
  receiver!.needsDeclare = saveNeedsDeclare;
  const finalModifierFlags = defaultExport
    ? (modifierFlags | ModifierFlagsAmbient) ^ ModifierFlagsDefault ^ ModifierFlagsExport
    : modifierFlags;
  const modifiers = NodeFactory_NewModifierList(astFactory, CreateModifiersFromModifierFlags(finalModifierFlags, (kind) => NodeFactory_NewModifier(astFactory, kind)));
  const replacement: GoSlice<GoPtr<Node>> = (() => {
    if (IsFunctionDeclaration(declaration)) {
      const [typeParameters, parameters, asteriskToken] = extractExpandoHostParams(declaration);
      return [NodeFactory_UpdateFunctionDeclaration(astFactory, AsFunctionDeclaration(declaration)!, modifiers, asteriskToken, Node_Name(declaration), DeclarationTransformer_ensureTypeParams(receiver, declaration, typeParameters), DeclarationTransformer_updateParamList(receiver, declaration, parameters), DeclarationTransformer_ensureType(receiver, declaration, false), undefined, undefined)];
    }
    if (IsVariableDeclaration(declaration) && IsFunctionExpressionOrArrowFunction(Node_Initializer(declaration)!)) {
      const fn = Node_Initializer(declaration)!;
      const [typeParameters, parameters, asteriskToken] = extractExpandoHostParams(fn);
      return [NewFunctionDeclaration(astFactory, modifiers, asteriskToken, NewIdentifier(astFactory, Node_Text(name)), DeclarationTransformer_ensureTypeParams(receiver, fn, typeParameters), DeclarationTransformer_updateParamList(receiver, fn, parameters), DeclarationTransformer_ensureType(receiver, fn, false), undefined, undefined)];
    }
    return [];
  })();
  if (replacement.length === 0) {
    return;
  }
  const finalReplacement = defaultExport
    ? [...replacement, NewExportAssignment(astFactory, undefined, false as bool, undefined, name)]
    : replacement;
  Set_Add(receiver!.expandoHosts, id);
  receiver!.lateStatementReplacementMap.set(id, NewSyntaxList(astFactory, finalReplacement));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::func::extractExpandoHostParams","kind":"func","status":"implemented","sigHash":"9a9154f32f0c5bb9aa5758f3a190b582eb6586e5fb032be9eade814a27b1fa2e","bodyHash":"882dec6577345575f06e0cf5a3b906431b8f011ee967b313668baaa1c95de16c"}
 *
 * Go source:
 * func extractExpandoHostParams(node *ast.Node) (typeParameters *ast.TypeParameterList, parameters *ast.ParameterList, asteriskToken *ast.TokenNode) {
 * 	switch node.Kind {
 * 	case ast.KindFunctionExpression:
 * 		fn := node.AsFunctionExpression()
 * 		return fn.TypeParameters, fn.Parameters, fn.AsteriskToken
 * 	case ast.KindArrowFunction:
 * 		fn := node.AsArrowFunction()
 * 		return fn.TypeParameters, fn.Parameters, fn.AsteriskToken
 * 	default:
 * 		fn := node.AsFunctionDeclaration()
 * 		return fn.TypeParameters, fn.Parameters, fn.AsteriskToken
 * 	}
 * }
 */
export function extractExpandoHostParams(node: GoPtr<Node>): [GoPtr<TypeParameterList>, GoPtr<ParameterList>, GoPtr<TokenNode>] {
  switch (node!.Kind) {
    case KindFunctionExpression: {
      const fn = AsFunctionExpression(node)!;
      return [fn.TypeParameters, fn.Parameters, fn.AsteriskToken];
    }
    case KindArrowFunction: {
      const fn = AsArrowFunction(node)!;
      return [fn.TypeParameters, fn.Parameters, fn.AsteriskToken];
    }
    default: {
      const fn = AsFunctionDeclaration(node)!;
      return [fn.TypeParameters, fn.Parameters, fn.AsteriskToken];
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/transform.go::method::DeclarationTransformer.tryGetPropertyName","kind":"method","status":"implemented","sigHash":"e8c498f21481088e0956f25583768062143163bafb82713b83b7fa79bb836d93","bodyHash":"2809e7bae77aca6d402eabab15cf9f2af1724cacf3112e5047ca3e7fc17e131a"}
 *
 * Go source:
 * func (tx *DeclarationTransformer) tryGetPropertyName(node *ast.Node) string {
 * 	if ast.IsElementAccessExpression(node) {
 * 		return tx.resolver.GetElementAccessExpressionName(node.AsElementAccessExpression())
 * 	}
 * 	if ast.IsPropertyAccessExpression(node) {
 * 		return node.Name().Text()
 * 	}
 * 	return ""
 * }
 */
export function DeclarationTransformer_tryGetPropertyName(receiver: GoPtr<DeclarationTransformer>, node: GoPtr<Node>): string {
  if (IsElementAccessExpression(node)) {
    return receiver!.resolver.GetElementAccessExpressionName(AsElementAccessExpression(node)!);
  }
  if (IsPropertyAccessExpression(node)) {
    return Node_Text(Node_Name(node)!);
  }
  return "";
}
