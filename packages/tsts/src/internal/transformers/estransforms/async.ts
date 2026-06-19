import type { bool, int } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Node, NodeList, NodeVisitor } from "../../ast/spine.js";
import { Node_Text } from "../../ast/ast.js";
import type { SourceFile } from "../../ast/ast.js";
import { Node_Modifiers, Node_Name } from "../../ast/spine.js";
import type { ArrowFunction, AwaitExpression, Block, CatchClause, ConstructorDeclaration, ForInOrOfStatement, ForStatement, FunctionDeclaration, FunctionExpression, GetAccessorDeclaration, MethodDeclaration, SetAccessorDeclaration, VariableDeclaration, VariableDeclarationList } from "../../ast/generated/data.js";
import type { IdentifierNode } from "../../ast/generated/unions.js";
import {
  AsArrowFunction,
  AsArrayLiteralExpression,
  AsBindingPattern,
  AsBlock,
  AsCatchClause,
  AsConstructorDeclaration,
  AsForInOrOfStatement,
  AsForStatement,
  AsFunctionDeclaration,
  AsFunctionExpression,
  AsGetAccessorDeclaration,
  AsMethodDeclaration,
  AsObjectLiteralExpression,
  AsParameterDeclaration,
  AsParenthesizedExpression,
  AsPostfixUnaryExpression,
  AsPrefixUnaryExpression,
  AsPropertyAssignment,
  AsSetAccessorDeclaration,
  AsShorthandPropertyAssignment,
  AsSpreadAssignment,
  AsSpreadElement,
  AsVariableDeclaration,
  AsVariableDeclarationList,
  AsVariableStatement,
} from "../../ast/generated/casts.js";
import {
  KindArrowFunction,
  KindArrayLiteralExpression,
  KindAsyncKeyword,
  KindAwaitExpression,
  KindBindingElement,
  KindBlock,
  KindCaseBlock,
  KindCaseClause,
  KindCatchClause,
  KindClassDeclaration,
  KindClassExpression,
  KindConstructor,
  KindDefaultClause,
  KindDoStatement,
  KindElementAccessExpression,
  KindForInStatement,
  KindForOfStatement,
  KindForStatement,
  KindFunctionDeclaration,
  KindFunctionExpression,
  KindGetAccessor,
  KindIdentifier,
  KindIfStatement,
  KindLabeledStatement,
  KindMethodDeclaration,
  KindMinusMinusToken,
  KindObjectLiteralExpression,
  KindParameter,
  KindParenthesizedExpression,
  KindPlusPlusToken,
  KindPropertyAccessExpression,
  KindPropertyAssignment,
  KindSetAccessor,
  KindShorthandPropertyAssignment,
  KindSourceFile,
  KindSpreadAssignment,
  KindSpreadElement,
  KindSuperKeyword,
  KindSwitchStatement,
  KindTryStatement,
  KindVariableDeclaration,
  KindVariableStatement,
  KindWhileStatement,
  KindWithStatement,
} from "../../ast/generated/kinds.js";
import {
  IsBlock,
  IsIdentifier,
  IsOmittedExpression,
  IsPostfixUnaryExpression,
  IsPrefixUnaryExpression,
  IsVariableDeclarationList,
} from "../../ast/generated/predicates.js";
import { IsBindingPattern, IsIdentifierName, IsLabelName } from "../../ast/utilities.js";
import { NodeFlagsBlockScoped, NodeFlagsNone } from "../../ast/generated/flags.js";
import { Node_SubtreeFacts } from "../../ast/spine.js";
import { SubtreeContainsAnyAwait, SubtreeContainsAwait } from "../../ast/subtreefacts.js";
import { NewArrayLiteralExpression, NewBlock, NewExpressionStatement, NewIdentifier, NewParameterDeclaration, NewReturnStatement, NewSpreadElement, NewToken, NewVariableDeclaration, NewVariableDeclarationList, NewVariableStatement, NewYieldExpression } from "../../ast/generated/factory.js";
import { Node_Body, Node_Expression, Node_Initializer, Node_ParameterList, Node_Parameters, Node_StatementList, NodeFactory_UpdateArrowFunction, NodeFactory_UpdateBlock, NodeFactory_UpdateConstructorDeclaration, NodeFactory_UpdateForInOrOfStatement, NodeFactory_UpdateForStatement, NodeFactory_UpdateFunctionDeclaration, NodeFactory_UpdateFunctionExpression, NodeFactory_UpdateGetAccessorDeclaration, NodeFactory_UpdateMethodDeclaration, NodeFactory_UpdateSetAccessorDeclaration } from "../../ast/ast.js";
import { NodeFactory_NewAssignmentExpression, NodeFactory_NewAwaiterHelper, NodeFactory_NewGeneratedNameForNodeEx, NodeFactory_NewUniqueName, NodeFactory_NewUniqueNameEx, NodeFactory_InlineExpressions } from "../../printer/factory.js";
import { NodeFactory_NewNodeList } from "../../ast/spine.js";
import type { AutoGenerateOptions } from "../../printer/emitcontext.js";
import { EmitContext_AddEmitFlags, EmitContext_AddEmitHelper, EmitContext_AddInitializationStatement, EmitContext_AddVariableDeclaration, EmitContext_EmitFlags, EmitContext_EndAndMergeVariableEnvironmentList, EmitContext_MergeEnvironmentList, EmitContext_MostOriginal, EmitContext_NewNodeVisitor, EmitContext_ReadEmitHelpers, EmitContext_SetOriginal, EmitContext_SetSourceMapRange, EmitContext_StartVariableEnvironment, EmitContext_VisitFunctionBody, EmitContext_VisitParameters } from "../../printer/emitcontext.js";
import { EFCustomPrologue, EFNoLexicalArguments, EFNoLexicalThis, EFStartOnNewLine } from "../../printer/emitflags.js";
import { GeneratedIdentifierFlagsFileLevel, GeneratedIdentifierFlagsOptimistic, GeneratedIdentifierFlagsReservedInNestedScopes } from "../../printer/generatedidentifierflags.js";
import { IsFunctionLikeDeclaration } from "../../ast/utilities.js";
import { ConvertBindingPatternToAssignmentPattern } from "../utilities.js";
import { KindDotDotDotToken } from "../../ast/generated/kinds.js";
import type { Set } from "../../collections/set.js";
import { Set_Add, Set_Clone, Set_Delete, Set_Has } from "../../collections/set.js";
import { NewSetWithSizeHint } from "../../collections/set.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_NewTransformer, Transformer_Visitor } from "../transformer.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitEmbeddedStatement, NodeVisitor_VisitModifiers, NodeVisitor_VisitNode, NodeVisitor_VisitNodes } from "../../ast/visitor.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../../ast/visitor.js";
import { superAccessState_createSuperAccessVariableStatement, superAccessState_initSuperAccessVisitor, superAccessState_substituteSuperAccessesInBody, superAccessState_trackSuperAccess } from "./utilities.js";
import type { superAccessState } from "./utilities.js";
import { GetFunctionFlags, FunctionFlagsAsync, FunctionFlagsAsyncGenerator } from "../../ast/functionflags.js";
import type { OrderedSet } from "../../collections/ordered_set.js";
import { NewOrderedSetWithSizeHint, OrderedSet_Size } from "../../collections/ordered_set.js";
import { AsyncSuperHelper, AdvancedAsyncSuperHelper } from "../../printer/helpers.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::type::asyncContextFlags","kind":"type","status":"implemented","sigHash":"85a08bd042139636a5a3246dc21913db9d4afe3135d553aef423aa4a18d77161","bodyHash":"16f1660d2d95757cf8a9439ea4e2fc76f496703918b639d88719db90af30a092"}
 *
 * Go source:
 * asyncContextFlags int
 */
export type asyncContextFlags = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::constGroup::asyncContextNonTopLevel+asyncContextHasLexicalThis","kind":"constGroup","status":"implemented","sigHash":"690a603c20b48b223d1e1fb484ca043c0f5da895c286e3d79f80916bd181f3ab","bodyHash":"f1eb4f675b5823f95c0699cb9d527f43c07d8ff03782d899eef08e02edf4205e"}
 *
 * Go source:
 * const (
 * 	asyncContextNonTopLevel asyncContextFlags = 1 << iota
 * 	asyncContextHasLexicalThis
 * )
 */
export const asyncContextNonTopLevel: asyncContextFlags = 1 << 0;
export const asyncContextHasLexicalThis: asyncContextFlags = 1 << 1;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::type::lexicalArgumentsInfo","kind":"type","status":"implemented","sigHash":"615e96c532d72ccb64e29918b1d7b2fd60425607922a0d2861f2f68a1d3e463e","bodyHash":"76e65756b2e244196aa872215feeca4ed74a00aafd7ea0c51e1fe728a7df4df4"}
 *
 * Go source:
 * lexicalArgumentsInfo struct {
 * 	binding *ast.IdentifierNode
 * 	used    bool
 * }
 */
export interface lexicalArgumentsInfo {
  binding: GoPtr<IdentifierNode>;
  used: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::type::asyncTransformer","kind":"type","status":"implemented","sigHash":"ccedab042879344bd6a47deab748826ca278d59017e72ae4ac2e50c736e0dadc","bodyHash":"b9127e7eb84b5c613f6fb94a6c6c733a7ff9b9077baf6d4a8d8d2fb55410a7e3"}
 *
 * Go source:
 * asyncTransformer struct {
 * 	transformers.Transformer
 * 	superAccessState
 *
 * 	contextFlags asyncContextFlags
 *
 * 	enclosingFunctionParameterNames *collections.Set[string]
 * 	lexicalArguments                lexicalArgumentsInfo
 *
 * 	asyncBodyVisitor    *ast.NodeVisitor
 * 	fallbackNodeVisitor *ast.NodeVisitor
 * }
 */
export interface asyncTransformer {
  readonly __tsgoEmbedded0?: Transformer;
  readonly __tsgoEmbedded1?: superAccessState;
  contextFlags: asyncContextFlags;
  enclosingFunctionParameterNames: GoPtr<Set<string>>;
  lexicalArguments: lexicalArgumentsInfo;
  asyncBodyVisitor: GoPtr<NodeVisitor>;
  fallbackNodeVisitor: GoPtr<NodeVisitor>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::func::newAsyncTransformer","kind":"func","status":"implemented","sigHash":"c1d4bbacff6fb56b3b2490a7bd5e68e1e9e5ec6ac62f0ccbb294ef301529995c","bodyHash":"e6bf780bdc97c8a663d2aaae4678c0fee192397de0fcbb6ad6729f3923efb1db"}
 *
 * Go source:
 * func newAsyncTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &asyncTransformer{}
 * 	result := tx.NewTransformer(tx.visit, opts.Context)
 * 	tx.initSuperAccessVisitor(tx.EmitContext(), tx.Factory())
 * 	tx.asyncBodyVisitor = tx.EmitContext().NewNodeVisitor(tx.visitAsyncBodyNode)
 * 	tx.fallbackNodeVisitor = tx.EmitContext().NewNodeVisitor(tx.visitFallback)
 * 	return result
 * }
 */
export function newAsyncTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer> {
  const tx: asyncTransformer = {
    __tsgoEmbedded0: {} as Transformer,
    __tsgoEmbedded1: {} as superAccessState,
    contextFlags: 0,
    enclosingFunctionParameterNames: undefined,
    lexicalArguments: { binding: undefined, used: false },
    asyncBodyVisitor: undefined,
    fallbackNodeVisitor: undefined,
  };
  const result = Transformer_NewTransformer(tx.__tsgoEmbedded0!, (node) => asyncTransformer_visit(tx, node), opts!.Context);
  superAccessState_initSuperAccessVisitor(tx.__tsgoEmbedded1!, Transformer_EmitContext(tx.__tsgoEmbedded0!), Transformer_Factory(tx.__tsgoEmbedded0!));
  tx.asyncBodyVisitor = EmitContext_NewNodeVisitor(Transformer_EmitContext(tx.__tsgoEmbedded0!), (node) => asyncTransformer_visitAsyncBodyNode(tx, node));
  tx.fallbackNodeVisitor = EmitContext_NewNodeVisitor(Transformer_EmitContext(tx.__tsgoEmbedded0!), (node) => asyncTransformer_visitFallback(tx, node));
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitSourceFile","kind":"method","status":"implemented","sigHash":"e38c76aedde1e191e9ead938ec3291b7251c4210cada82db0531bb0d683e799c","bodyHash":"c7b19aa2ba24d160877bcb8531c412bdec28696e162e185437128b301c78d34e"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitSourceFile(node *ast.SourceFile) *ast.Node {
 * 	if node.IsDeclarationFile {
 * 		return node.AsNode()
 * 	}
 * 
 * 	tx.setContextFlag(asyncContextNonTopLevel, false)
 * 	tx.setContextFlag(asyncContextHasLexicalThis, false)
 * 	visited := tx.Visitor().VisitEachChild(node.AsNode())
 * 	tx.EmitContext().AddEmitHelper(visited, tx.EmitContext().ReadEmitHelpers()...)
 * 	return visited
 * }
 */
export function asyncTransformer_visitSourceFile(receiver: GoPtr<asyncTransformer>, node: GoPtr<SourceFile>): GoPtr<Node> {
  if (node!.IsDeclarationFile) {
    return node as unknown as GoPtr<Node>;
  }
  asyncTransformer_setContextFlag(receiver, asyncContextNonTopLevel, false);
  asyncTransformer_setContextFlag(receiver, asyncContextHasLexicalThis, false);
  const visited = NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node as unknown as GoPtr<Node>);
  const helpers = EmitContext_ReadEmitHelpers(Transformer_EmitContext(receiver!.__tsgoEmbedded0!));
  if (helpers !== undefined) {
    EmitContext_AddEmitHelper(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), visited, ...helpers);
  }
  return visited;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.setContextFlag","kind":"method","status":"implemented","sigHash":"9b4f93f304e1e54ac12972d673d367ee2bb8813128bbfa1a8c83ce466ecbef4d","bodyHash":"9d9d3c0921fbd67eb805a2b5aacf06cfd8a1de461f5f3506014b1238b4d1bbd6"}
 *
 * Go source:
 * func (tx *asyncTransformer) setContextFlag(flag asyncContextFlags, val bool) {
 * 	if val {
 * 		tx.contextFlags |= flag
 * 	} else {
 * 		tx.contextFlags &^= flag
 * 	}
 * }
 */
export function asyncTransformer_setContextFlag(receiver: GoPtr<asyncTransformer>, flag: asyncContextFlags, val: bool): void {
  if (val) {
    receiver!.contextFlags = receiver!.contextFlags | flag;
  } else {
    receiver!.contextFlags = receiver!.contextFlags & ~flag;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.inContext","kind":"method","status":"implemented","sigHash":"731c55ea44c2d9b30523d888b9bb3eb5be30e33ac1f58eaeffc5b3c6788e852d","bodyHash":"8b759be86e0e7af82af34c127987c9941894221242158b34c70557c42ec745fe"}
 *
 * Go source:
 * func (tx *asyncTransformer) inContext(flags asyncContextFlags) bool {
 * 	return tx.contextFlags&flags != 0
 * }
 */
export function asyncTransformer_inContext(receiver: GoPtr<asyncTransformer>, flags: asyncContextFlags): bool {
  return (receiver!.contextFlags & flags) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.inTopLevelContext","kind":"method","status":"implemented","sigHash":"024d93ab1f72884018fe750a021afcb67757f8df7224783a54acb446b2b0b6be","bodyHash":"ad7fb68a5b4b36017ac87f19d4dc7b6e76233d640692ab0b601c042945ab0427"}
 *
 * Go source:
 * func (tx *asyncTransformer) inTopLevelContext() bool {
 * 	return !tx.inContext(asyncContextNonTopLevel)
 * }
 */
export function asyncTransformer_inTopLevelContext(receiver: GoPtr<asyncTransformer>): bool {
  return !asyncTransformer_inContext(receiver, asyncContextNonTopLevel);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.inHasLexicalThisContext","kind":"method","status":"implemented","sigHash":"b966b271b826b2f604ca6d9703f5d120fd63e0a5e12d0274b3446feea6f23273","bodyHash":"a6ba6d48e4eb80b8746c0934646ccb5989b28da7778d3b7f4b5c138d843e6637"}
 *
 * Go source:
 * func (tx *asyncTransformer) inHasLexicalThisContext() bool {
 * 	return tx.inContext(asyncContextHasLexicalThis)
 * }
 */
export function asyncTransformer_inHasLexicalThisContext(receiver: GoPtr<asyncTransformer>): bool {
  return asyncTransformer_inContext(receiver, asyncContextHasLexicalThis);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.doWithContext","kind":"method","status":"implemented","sigHash":"6d10e0200e2e27005fd9a1d4395ba1f89830409a8eb416ba4e6c0e4d221d294a","bodyHash":"288c08d5757ac182da3a52e6a5b46e59720d0c84e41be23905b8b90fa4718e33"}
 *
 * Go source:
 * func (tx *asyncTransformer) doWithContext(flags asyncContextFlags, cb func(*asyncTransformer, *ast.Node) *ast.Node, node *ast.Node) *ast.Node {
 * 	flagsToSet := flags & ^tx.contextFlags
 * 	if flagsToSet != 0 {
 * 		tx.setContextFlag(flagsToSet, true)
 * 		result := cb(tx, node)
 * 		tx.setContextFlag(flagsToSet, false)
 * 		return result
 * 	}
 * 	return cb(tx, node)
 * }
 */
export function asyncTransformer_doWithContext(receiver: GoPtr<asyncTransformer>, flags: asyncContextFlags, cb: (arg0: GoPtr<asyncTransformer>, arg1: GoPtr<Node>) => GoPtr<Node>, node: GoPtr<Node>): GoPtr<Node> {
  const flagsToSet = flags & ~receiver!.contextFlags;
  if (flagsToSet !== 0) {
    asyncTransformer_setContextFlag(receiver, flagsToSet, true);
    const result = cb(receiver, node);
    asyncTransformer_setContextFlag(receiver, flagsToSet, false);
    return result;
  }
  return cb(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitDefault","kind":"method","status":"implemented","sigHash":"511101962b66551d6d256dabac810a8f1eb632094ce5c1e973d3da2779467865","bodyHash":"e834878ec9a876f0c22db21884b7650c0391375df688a3b3962b7bbc63f6a64e"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitDefault(node *ast.Node) *ast.Node {
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export function asyncTransformer_visitDefault(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.fallbackVisitor","kind":"method","status":"implemented","sigHash":"23f4d295d67c6174abc7013f766d63f3e8405b5e59c4864747dd7c3428be2310","bodyHash":"d685155943297c8490bbcb65657d97e5e31b668951f5cd4dc5fe93b0da01f511"}
 *
 * Go source:
 * func (tx *asyncTransformer) fallbackVisitor(node *ast.Node) *ast.Node {
 * 	if tx.capturedSuperProperties == nil && tx.lexicalArguments.binding == nil {
 * 		return node
 * 	}
 * 	tx.trackSuperAccess(node)
 * 	switch node.Kind {
 * 	case ast.KindFunctionExpression,
 * 		ast.KindFunctionDeclaration,
 * 		ast.KindMethodDeclaration,
 * 		ast.KindGetAccessor,
 * 		ast.KindSetAccessor,
 * 		ast.KindConstructor:
 * 		return node
 * 	case ast.KindParameter,
 * 		ast.KindBindingElement,
 * 		ast.KindVariableDeclaration:
 * 		// fall through to visitEachChild
 * 	case ast.KindIdentifier:
 * 		if tx.lexicalArguments.binding != nil &&
 * 			node.Text() == "arguments" &&
 * 			!ast.IsIdentifierName(node) &&
 * 			!ast.IsLabelName(node) {
 * 			tx.lexicalArguments.used = true
 * 			return tx.lexicalArguments.binding
 * 		}
 * 	}
 * 	return tx.fallbackNodeVisitor.VisitEachChild(node)
 * }
 */
export function asyncTransformer_fallbackVisitor(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (receiver!.__tsgoEmbedded1!.capturedSuperProperties === undefined && receiver!.lexicalArguments.binding === undefined) {
    return node;
  }
  superAccessState_trackSuperAccess(receiver!.__tsgoEmbedded1!, node);
  switch (node!.Kind) {
    case KindFunctionExpression:
    case KindFunctionDeclaration:
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindConstructor:
      return node;
    case KindParameter:
    case KindBindingElement:
    case KindVariableDeclaration:
      // fall through to visitEachChild
      break;
    case KindIdentifier:
      if (
        receiver!.lexicalArguments.binding !== undefined &&
        Node_Text(node) === "arguments" &&
        !IsIdentifierName(node) &&
        !IsLabelName(node)
      ) {
        receiver!.lexicalArguments.used = true;
        return receiver!.lexicalArguments.binding as unknown as GoPtr<Node>;
      }
      break;
  }
  return NodeVisitor_VisitEachChild((receiver!.fallbackNodeVisitor as ConcreteNodeVisitor), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitFallback","kind":"method","status":"implemented","sigHash":"0bf71532f8917e36dd2d23563f04a9bb55cb6b3dea35017b8a143499c848ccc9","bodyHash":"754a1ea439dbbb9a6a0d9362e815bd90875bb0530a78812a4f34b3bb2f8d26e6"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitFallback(node *ast.Node) *ast.Node {
 * 	return tx.fallbackVisitor(node)
 * }
 */
export function asyncTransformer_visitFallback(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  return asyncTransformer_fallbackVisitor(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visit","kind":"method","status":"implemented","sigHash":"2848ffce30a8a6797a57f68ab61e30c2c6e80839432e1a666f04108f4b223ff5","bodyHash":"a766d5e34d5cb244ce6329ddd091ddc7c0a42e919d0b479aa5e9885afeb70263"}
 *
 * Go source:
 * func (tx *asyncTransformer) visit(node *ast.Node) *ast.Node {
 * 	if tx.EmitContext().EmitFlags(node)&printer.EFNoLexicalThis != 0 && tx.inHasLexicalThisContext() {
 * 		tx.setContextFlag(asyncContextHasLexicalThis, false)
 * 		defer tx.setContextFlag(asyncContextHasLexicalThis, true)
 * 	}
 *
 * 	if node.SubtreeFacts()&(ast.SubtreeContainsAnyAwait|ast.SubtreeContainsAwait) == 0 {
 * 		return tx.fallbackVisitor(node)
 * 	}
 * 	tx.trackSuperAccess(node)
 * 	switch node.Kind {
 * 	case ast.KindAsyncKeyword:
 * 		// ES2017 async modifier should be elided for targets < ES2017
 * 		return nil
 * 	case ast.KindSourceFile:
 * 		return tx.visitSourceFile(node.AsSourceFile())
 * 	case ast.KindAwaitExpression:
 * 		return tx.visitAwaitExpression(node.AsAwaitExpression())
 * 	case ast.KindMethodDeclaration:
 * 		return tx.doWithContext(asyncContextNonTopLevel|asyncContextHasLexicalThis, (*asyncTransformer).visitMethodDeclaration, node)
 * 	case ast.KindFunctionDeclaration:
 * 		return tx.doWithContext(asyncContextNonTopLevel|asyncContextHasLexicalThis, (*asyncTransformer).visitFunctionDeclaration, node)
 * 	case ast.KindFunctionExpression:
 * 		return tx.doWithContext(asyncContextNonTopLevel|asyncContextHasLexicalThis, (*asyncTransformer).visitFunctionExpression, node)
 * 	case ast.KindArrowFunction:
 * 		return tx.doWithContext(asyncContextNonTopLevel, (*asyncTransformer).visitArrowFunction, node)
 * 	case ast.KindGetAccessor:
 * 		return tx.doWithContext(asyncContextNonTopLevel|asyncContextHasLexicalThis, (*asyncTransformer).visitGetAccessorDeclaration, node)
 * 	case ast.KindSetAccessor:
 * 		return tx.doWithContext(asyncContextNonTopLevel|asyncContextHasLexicalThis, (*asyncTransformer).visitSetAccessorDeclaration, node)
 * 	case ast.KindConstructor:
 * 		return tx.doWithContext(asyncContextNonTopLevel|asyncContextHasLexicalThis, (*asyncTransformer).visitConstructorDeclaration, node)
 * 	case ast.KindClassDeclaration, ast.KindClassExpression:
 * 		return tx.doWithContext(asyncContextNonTopLevel|asyncContextHasLexicalThis, (*asyncTransformer).visitDefault, node)
 * 	default:
 * 		return tx.Visitor().VisitEachChild(node)
 * 	}
 * }
 */
export function asyncTransformer_visit(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const restoreLexicalThis =
    (EmitContext_EmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node) & EFNoLexicalThis) !== 0 &&
    asyncTransformer_inHasLexicalThisContext(receiver);
  if (restoreLexicalThis) {
    asyncTransformer_setContextFlag(receiver, asyncContextHasLexicalThis, false);
  }
  try {
    if ((Node_SubtreeFacts(node) & (SubtreeContainsAnyAwait | SubtreeContainsAwait)) === 0) {
      return asyncTransformer_fallbackVisitor(receiver, node);
    }
    superAccessState_trackSuperAccess(receiver!.__tsgoEmbedded1!, node);
    switch (node!.Kind) {
      case KindAsyncKeyword:
        // ES2017 async modifier should be elided for targets < ES2017
        return undefined;
      case KindSourceFile:
        return asyncTransformer_visitSourceFile(receiver, node as unknown as GoPtr<SourceFile>);
      case KindAwaitExpression:
        return asyncTransformer_visitAwaitExpression(receiver, node as unknown as GoPtr<AwaitExpression>);
      case KindMethodDeclaration:
        return asyncTransformer_doWithContext(receiver, asyncContextNonTopLevel | asyncContextHasLexicalThis, (tx, n) => asyncTransformer_visitMethodDeclaration(tx, n), node);
      case KindFunctionDeclaration:
        return asyncTransformer_doWithContext(receiver, asyncContextNonTopLevel | asyncContextHasLexicalThis, (tx, n) => asyncTransformer_visitFunctionDeclaration(tx, n), node);
      case KindFunctionExpression:
        return asyncTransformer_doWithContext(receiver, asyncContextNonTopLevel | asyncContextHasLexicalThis, (tx, n) => asyncTransformer_visitFunctionExpression(tx, n), node);
      case KindArrowFunction:
        return asyncTransformer_doWithContext(receiver, asyncContextNonTopLevel, (tx, n) => asyncTransformer_visitArrowFunction(tx, n), node);
      case KindGetAccessor:
        return asyncTransformer_doWithContext(receiver, asyncContextNonTopLevel | asyncContextHasLexicalThis, (tx, n) => asyncTransformer_visitGetAccessorDeclaration(tx, n), node);
      case KindSetAccessor:
        return asyncTransformer_doWithContext(receiver, asyncContextNonTopLevel | asyncContextHasLexicalThis, (tx, n) => asyncTransformer_visitSetAccessorDeclaration(tx, n), node);
      case KindConstructor:
        return asyncTransformer_doWithContext(receiver, asyncContextNonTopLevel | asyncContextHasLexicalThis, (tx, n) => asyncTransformer_visitConstructorDeclaration(tx, n), node);
      case KindClassDeclaration:
      case KindClassExpression:
        return asyncTransformer_doWithContext(receiver, asyncContextNonTopLevel | asyncContextHasLexicalThis, (tx, n) => asyncTransformer_visitDefault(tx, n), node);
      default:
        return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
    }
  } finally {
    if (restoreLexicalThis) {
      asyncTransformer_setContextFlag(receiver, asyncContextHasLexicalThis, true);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitAsyncBodyNode","kind":"method","status":"implemented","sigHash":"05c97509e59242700152bc4d60c834a029ef8ad33346e7f31db12d4eab7aaad2","bodyHash":"9f0730d2ad6004d520b9d25a29c6603e1359effe2a303b31d1ccd6bcfb30b33c"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitAsyncBodyNode(node *ast.Node) *ast.Node {
 * 	if isNodeWithPossibleHoistedDeclaration(node) {
 * 		switch node.Kind {
 * 		case ast.KindVariableStatement:
 * 			return tx.visitVariableStatementInAsyncBody(node)
 * 		case ast.KindForStatement:
 * 			return tx.visitForStatementInAsyncBody(node.AsForStatement())
 * 		case ast.KindForInStatement:
 * 			return tx.visitForInStatementInAsyncBody(node.AsForInOrOfStatement())
 * 		case ast.KindForOfStatement:
 * 			return tx.visitForOfStatementInAsyncBody(node.AsForInOrOfStatement())
 * 		case ast.KindCatchClause:
 * 			return tx.visitCatchClauseInAsyncBody(node.AsCatchClause())
 * 		case ast.KindBlock,
 * 			ast.KindSwitchStatement,
 * 			ast.KindCaseBlock,
 * 			ast.KindCaseClause,
 * 			ast.KindDefaultClause,
 * 			ast.KindTryStatement,
 * 			ast.KindDoStatement,
 * 			ast.KindWhileStatement,
 * 			ast.KindIfStatement,
 * 			ast.KindWithStatement,
 * 			ast.KindLabeledStatement:
 * 			return tx.asyncBodyVisitor.VisitEachChild(node)
 * 		}
 * 	}
 * 	return tx.visit(node)
 * }
 */
export function asyncTransformer_visitAsyncBodyNode(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (isNodeWithPossibleHoistedDeclaration(node)) {
    switch (node!.Kind) {
      case KindVariableStatement:
        return asyncTransformer_visitVariableStatementInAsyncBody(receiver, node);
      case KindForStatement:
        return asyncTransformer_visitForStatementInAsyncBody(receiver, AsForStatement(node)!);
      case KindForInStatement:
        return asyncTransformer_visitForInStatementInAsyncBody(receiver, AsForInOrOfStatement(node)!);
      case KindForOfStatement:
        return asyncTransformer_visitForOfStatementInAsyncBody(receiver, AsForInOrOfStatement(node)!);
      case KindCatchClause:
        return asyncTransformer_visitCatchClauseInAsyncBody(receiver, AsCatchClause(node)!);
      case KindBlock:
      case KindSwitchStatement:
      case KindCaseBlock:
      case KindCaseClause:
      case KindDefaultClause:
      case KindTryStatement:
      case KindDoStatement:
      case KindWhileStatement:
      case KindIfStatement:
      case KindWithStatement:
      case KindLabeledStatement:
        return NodeVisitor_VisitEachChild((receiver!.asyncBodyVisitor as ConcreteNodeVisitor), node);
    }
  }
  return asyncTransformer_visit(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitCatchClauseInAsyncBody","kind":"method","status":"implemented","sigHash":"260a9b56ce5af4c08f86ab2679efae4f511e255a2f428849483fc2d54d98aa96","bodyHash":"2b31109d1de2198da18fdf9cff28ce91548bb4ab6637484d988a3e38cee29542"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitCatchClauseInAsyncBody(node *ast.CatchClause) *ast.Node {
 * 	catchClauseNames := &collections.Set[string]{}
 * 	if node.VariableDeclaration != nil {
 * 		tx.recordDeclarationName(node.VariableDeclaration, catchClauseNames)
 * 	}
 * 
 * 	// names declared in a catch variable are block scoped
 * 	var catchClauseUnshadowedNames *collections.Set[string]
 * 	for escapedName := range catchClauseNames.Keys() {
 * 		if tx.enclosingFunctionParameterNames != nil && tx.enclosingFunctionParameterNames.Has(escapedName) {
 * 			if catchClauseUnshadowedNames == nil {
 * 				catchClauseUnshadowedNames = tx.enclosingFunctionParameterNames.Clone()
 * 			}
 * 			catchClauseUnshadowedNames.Delete(escapedName)
 * 		}
 * 	}
 * 
 * 	if catchClauseUnshadowedNames != nil {
 * 		savedEnclosingFunctionParameterNames := tx.enclosingFunctionParameterNames
 * 		tx.enclosingFunctionParameterNames = catchClauseUnshadowedNames
 * 		result := tx.asyncBodyVisitor.VisitEachChild(node.AsNode())
 * 		tx.enclosingFunctionParameterNames = savedEnclosingFunctionParameterNames
 * 		return result
 * 	}
 * 	return tx.asyncBodyVisitor.VisitEachChild(node.AsNode())
 * }
 */
export function asyncTransformer_visitCatchClauseInAsyncBody(receiver: GoPtr<asyncTransformer>, node: GoPtr<CatchClause>): GoPtr<Node> {
  const catchClauseNames: GoPtr<Set<string>> = NewSetWithSizeHint<string>(0);
  if (node!.VariableDeclaration !== undefined) {
    asyncTransformer_recordDeclarationName(receiver, node!.VariableDeclaration as unknown as GoPtr<Node>, catchClauseNames);
  }
  // names declared in a catch variable are block scoped
  let catchClauseUnshadowedNames: GoPtr<Set<string>> = undefined;
  for (const escapedName of catchClauseNames!.M.keys()) {
    if (receiver!.enclosingFunctionParameterNames !== undefined && Set_Has(receiver!.enclosingFunctionParameterNames, escapedName)) {
      if (catchClauseUnshadowedNames === undefined) {
        catchClauseUnshadowedNames = Set_Clone(receiver!.enclosingFunctionParameterNames as GoPtr<Set<string>>);
      }
      Set_Delete(catchClauseUnshadowedNames, escapedName);
    }
  }
  if (catchClauseUnshadowedNames !== undefined) {
    const savedEnclosingFunctionParameterNames = receiver!.enclosingFunctionParameterNames;
    receiver!.enclosingFunctionParameterNames = catchClauseUnshadowedNames;
    const result = NodeVisitor_VisitEachChild((receiver!.asyncBodyVisitor as ConcreteNodeVisitor), node as unknown as GoPtr<Node>);
    receiver!.enclosingFunctionParameterNames = savedEnclosingFunctionParameterNames;
    return result;
  }
  return NodeVisitor_VisitEachChild((receiver!.asyncBodyVisitor as ConcreteNodeVisitor), node as unknown as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitVariableStatementInAsyncBody","kind":"method","status":"implemented","sigHash":"a0ba5c815298cf81b3683eeb5b5f0743368794196685c5736fc4d832382b1d84","bodyHash":"993f3285d2ec5564aa797eda2a3a8bf9d02103d7e48e5c14f1736888a2292ad4"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitVariableStatementInAsyncBody(node *ast.Node) *ast.Node {
 * 	declList := node.AsVariableStatement().DeclarationList
 * 	if tx.isVariableDeclarationListWithCollidingName(declList) {
 * 		expression := tx.visitVariableDeclarationListWithCollidingNames(declList.AsVariableDeclarationList(), false)
 * 		if expression != nil {
 * 			return tx.Factory().NewExpressionStatement(expression)
 * 		}
 * 		return nil
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export function asyncTransformer_visitVariableStatementInAsyncBody(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const declList = AsVariableStatement(node)!.DeclarationList;
  if (asyncTransformer_isVariableDeclarationListWithCollidingName(receiver, declList as unknown as GoPtr<Node>)) {
    const expression = asyncTransformer_visitVariableDeclarationListWithCollidingNames(receiver, AsVariableDeclarationList(declList as unknown as GoPtr<Node>)!, false);
    if (expression !== undefined) {
      return NewExpressionStatement(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, expression as unknown as GoPtr<never>);
    }
    return undefined;
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitForInStatementInAsyncBody","kind":"method","status":"implemented","sigHash":"50c848099ded4eee086b7459c0178960c7750cf7b5300d1e3b59b2d74f52d6dc","bodyHash":"0d0675a4024c56c2cbf85ee05211d6b2c5ed94600cb294b04809cd3aa9a34299"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitForInStatementInAsyncBody(node *ast.ForInOrOfStatement) *ast.Node {
 * 	var visitedInitializer *ast.Node
 * 	if tx.isVariableDeclarationListWithCollidingName(node.Initializer) {
 * 		visitedInitializer = tx.visitVariableDeclarationListWithCollidingNames(node.Initializer.AsVariableDeclarationList(), true)
 * 	} else {
 * 		visitedInitializer = tx.Visitor().VisitNode(node.Initializer)
 * 	}
 *
 * 	return tx.Factory().UpdateForInOrOfStatement(
 * 		node,
 * 		nil, /*awaitModifier* /
 * 		visitedInitializer,
 * 		tx.Visitor().VisitNode(node.Expression),
 * 		tx.asyncBodyVisitor.VisitEmbeddedStatement(node.Statement),
 * 	)
 * }
 */
export function asyncTransformer_visitForInStatementInAsyncBody(receiver: GoPtr<asyncTransformer>, node: GoPtr<ForInOrOfStatement>): GoPtr<Node> {
  let visitedInitializer: GoPtr<Node>;
  if (asyncTransformer_isVariableDeclarationListWithCollidingName(receiver, node!.Initializer as unknown as GoPtr<Node>)) {
    visitedInitializer = asyncTransformer_visitVariableDeclarationListWithCollidingNames(receiver, AsVariableDeclarationList(node!.Initializer as unknown as GoPtr<Node>)!, true);
  } else {
    visitedInitializer = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Initializer as unknown as GoPtr<Node>);
  }
  return NodeFactory_UpdateForInOrOfStatement(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    node!,
    undefined, // awaitModifier
    visitedInitializer as unknown as GoPtr<never>,
    NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Expression as unknown as GoPtr<Node>) as unknown as GoPtr<never>,
    NodeVisitor_VisitEmbeddedStatement((receiver!.asyncBodyVisitor as ConcreteNodeVisitor), node!.Statement as unknown as GoPtr<Node>) as unknown as GoPtr<never>,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitForOfStatementInAsyncBody","kind":"method","status":"implemented","sigHash":"d6107520044a402f0973d6a7e50b9fb1650992cb53e25f3d47d3f5b668365f7a","bodyHash":"b2fee72e9c4576288a72fd7868570b4025eb807d1743a593b7ea3a1e58a314d7"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitForOfStatementInAsyncBody(node *ast.ForInOrOfStatement) *ast.Node {
 * 	var visitedInitializer *ast.Node
 * 	if tx.isVariableDeclarationListWithCollidingName(node.Initializer) {
 * 		visitedInitializer = tx.visitVariableDeclarationListWithCollidingNames(node.Initializer.AsVariableDeclarationList(), true)
 * 	} else {
 * 		visitedInitializer = tx.Visitor().VisitNode(node.Initializer)
 * 	}
 *
 * 	return tx.Factory().UpdateForInOrOfStatement(
 * 		node,
 * 		tx.Visitor().VisitNode(node.AwaitModifier),
 * 		visitedInitializer,
 * 		tx.Visitor().VisitNode(node.Expression),
 * 		tx.asyncBodyVisitor.VisitEmbeddedStatement(node.Statement),
 * 	)
 * }
 */
export function asyncTransformer_visitForOfStatementInAsyncBody(receiver: GoPtr<asyncTransformer>, node: GoPtr<ForInOrOfStatement>): GoPtr<Node> {
  let visitedInitializer: GoPtr<Node>;
  if (asyncTransformer_isVariableDeclarationListWithCollidingName(receiver, node!.Initializer as unknown as GoPtr<Node>)) {
    visitedInitializer = asyncTransformer_visitVariableDeclarationListWithCollidingNames(receiver, AsVariableDeclarationList(node!.Initializer as unknown as GoPtr<Node>)!, true);
  } else {
    visitedInitializer = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Initializer as unknown as GoPtr<Node>);
  }
  return NodeFactory_UpdateForInOrOfStatement(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    node!,
    NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.AwaitModifier as unknown as GoPtr<Node>) as unknown as GoPtr<never>,
    visitedInitializer as unknown as GoPtr<never>,
    NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Expression as unknown as GoPtr<Node>) as unknown as GoPtr<never>,
    NodeVisitor_VisitEmbeddedStatement((receiver!.asyncBodyVisitor as ConcreteNodeVisitor), node!.Statement as unknown as GoPtr<Node>) as unknown as GoPtr<never>,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitForStatementInAsyncBody","kind":"method","status":"implemented","sigHash":"6f54fde8105e510e1fdffe9f1b74547e9dd48b98177430714915ca3d9d63e2c1","bodyHash":"b14f4b8744492d0a4be9944e4d548ca6c5359374fc505f2a0a84ff54cef66bb9"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitForStatementInAsyncBody(node *ast.ForStatement) *ast.Node {
 * 	initializer := node.Initializer
 * 	var visitedInitializer *ast.Node
 * 	if initializer != nil && tx.isVariableDeclarationListWithCollidingName(initializer) {
 * 		visitedInitializer = tx.visitVariableDeclarationListWithCollidingNames(initializer.AsVariableDeclarationList(), false)
 * 	} else {
 * 		visitedInitializer = tx.Visitor().VisitNode(node.Initializer)
 * 	}
 *
 * 	return tx.Factory().UpdateForStatement(
 * 		node,
 * 		visitedInitializer,
 * 		tx.Visitor().VisitNode(node.Condition),
 * 		tx.Visitor().VisitNode(node.Incrementor),
 * 		tx.asyncBodyVisitor.VisitEmbeddedStatement(node.Statement),
 * 	)
 * }
 */
export function asyncTransformer_visitForStatementInAsyncBody(receiver: GoPtr<asyncTransformer>, node: GoPtr<ForStatement>): GoPtr<Node> {
  const initializer = node!.Initializer;
  let visitedInitializer: GoPtr<Node>;
  if (initializer !== undefined && asyncTransformer_isVariableDeclarationListWithCollidingName(receiver, initializer as unknown as GoPtr<Node>)) {
    visitedInitializer = asyncTransformer_visitVariableDeclarationListWithCollidingNames(receiver, AsVariableDeclarationList(initializer as unknown as GoPtr<Node>)!, false);
  } else {
    visitedInitializer = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Initializer as unknown as GoPtr<Node>);
  }
  return NodeFactory_UpdateForStatement(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    node!,
    visitedInitializer as unknown as GoPtr<never>,
    NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Condition as unknown as GoPtr<Node>) as unknown as GoPtr<never>,
    NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Incrementor as unknown as GoPtr<Node>) as unknown as GoPtr<never>,
    NodeVisitor_VisitEmbeddedStatement((receiver!.asyncBodyVisitor as ConcreteNodeVisitor), node!.Statement as unknown as GoPtr<Node>) as unknown as GoPtr<never>,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitAwaitExpression","kind":"method","status":"implemented","sigHash":"541dee6880725c28ca9757339007d9e978b72fb34bd4e9701cc66b1667af67fc","bodyHash":"1c8cdda0b3461d8a5efed1dfb60618bfd462d56fef6186534d926461c9b6d4f9"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitAwaitExpression(node *ast.AwaitExpression) *ast.Node {
 * 	// do not downlevel a top-level await as it is module syntax...
 * 	if tx.inTopLevelContext() {
 * 		return tx.Visitor().VisitEachChild(node.AsNode())
 * 	}
 * 	yieldExpr := tx.Factory().NewYieldExpression(
 * 		nil, /*asteriskToken* /
 * 		tx.Visitor().VisitNode(node.Expression),
 * 	)
 * 	yieldExpr.Loc = node.Loc
 * 	tx.EmitContext().SetOriginal(yieldExpr, node.AsNode())
 * 	return yieldExpr
 * }
 */
export function asyncTransformer_visitAwaitExpression(receiver: GoPtr<asyncTransformer>, node: GoPtr<AwaitExpression>): GoPtr<Node> {
  // do not downlevel a top-level await as it is module syntax...
  if (asyncTransformer_inTopLevelContext(receiver)) {
    return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node as unknown as GoPtr<Node>);
  }
  const yieldExpr = NewYieldExpression(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    undefined, // asteriskToken
    NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Expression(node as unknown as GoPtr<Node>)),
  );
  yieldExpr!.Loc = node!.Loc;
  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), yieldExpr, node as unknown as GoPtr<Node>);
  return yieldExpr;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitConstructorDeclaration","kind":"method","status":"implemented","sigHash":"4bc1d9247c9a2015478b3a420dd7aa7099ac84c34bd471e376b22fee41b84f87","bodyHash":"1c33aadcc6cfcaa144394526ca4f33e48238a24f1de090c3d2a36ad8e645a823"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitConstructorDeclaration(node *ast.Node) *ast.Node {
 * 	decl := node.AsConstructorDeclaration()
 * 	savedLexicalArguments := tx.lexicalArguments
 * 	tx.lexicalArguments = lexicalArgumentsInfo{}
 * 	updated := tx.Factory().UpdateConstructorDeclaration(
 * 		decl,
 * 		tx.Visitor().VisitModifiers(decl.Modifiers()),
 * 		nil, /*typeParameters* /
 * 		tx.EmitContext().VisitParameters(decl.Parameters, tx.Visitor()),
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		tx.transformMethodBody(node),
 * 	)
 * 	tx.lexicalArguments = savedLexicalArguments
 * 	return updated
 * }
 */
export function asyncTransformer_visitConstructorDeclaration(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const decl = AsConstructorDeclaration(node)!;
  const savedLexicalArguments = receiver!.lexicalArguments;
  receiver!.lexicalArguments = { binding: undefined, used: false };
  const updated = NodeFactory_UpdateConstructorDeclaration(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    decl,
    NodeVisitor_VisitModifiers((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Modifiers(node)),
    undefined, // typeParameters
    EmitContext_VisitParameters(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_ParameterList(node), (Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor)) as unknown as GoPtr<never>,
    undefined, // returnType
    undefined, // fullSignature
    asyncTransformer_transformMethodBody(receiver, node) as unknown as GoPtr<never>,
  );
  receiver!.lexicalArguments = savedLexicalArguments;
  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitMethodDeclaration","kind":"method","status":"implemented","sigHash":"612293448a760fbf3daf8f2d71914448a0209050a6ce3d386357f54798530524","bodyHash":"52d0f9834bc397ccdc2ef806f0709b29467e9d3b712a9ca3eb339b7b259a9f4a"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitMethodDeclaration(node *ast.Node) *ast.Node {
 * 	decl := node.AsMethodDeclaration()
 * 	functionFlags := ast.GetFunctionFlags(node)
 * 	savedLexicalArguments := tx.lexicalArguments
 * 	tx.lexicalArguments = lexicalArgumentsInfo{}
 *
 * 	var parameters *ast.NodeList
 * 	var body *ast.Node
 * 	if functionFlags&ast.FunctionFlagsAsync != 0 {
 * 		parameters = tx.transformAsyncFunctionParameterList(node)
 * 		body = tx.transformAsyncFunctionBody(node, parameters)
 * 	} else {
 * 		parameters = tx.EmitContext().VisitParameters(decl.Parameters, tx.Visitor())
 * 		body = tx.transformMethodBody(node)
 * 	}
 *
 * 	updated := tx.Factory().UpdateMethodDeclaration(
 * 		decl,
 * 		tx.Visitor().VisitModifiers(decl.Modifiers()),
 * 		decl.AsteriskToken,
 * 		decl.Name(),
 * 		nil, /*postfixToken* /
 * 		nil, /*typeParameters* /
 * 		parameters,
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		body,
 * 	)
 * 	tx.lexicalArguments = savedLexicalArguments
 * 	return updated
 * }
 */
export function asyncTransformer_visitMethodDeclaration(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const decl = AsMethodDeclaration(node)!;
  const functionFlags = GetFunctionFlags(node);
  const savedLexicalArguments = receiver!.lexicalArguments;
  receiver!.lexicalArguments = { binding: undefined, used: false };
  let parameters: GoPtr<NodeList>;
  let body: GoPtr<Node>;
  if ((functionFlags & FunctionFlagsAsync) !== 0) {
    parameters = asyncTransformer_transformAsyncFunctionParameterList(receiver, node);
    body = asyncTransformer_transformAsyncFunctionBody(receiver, node, parameters);
  } else {
    parameters = EmitContext_VisitParameters(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_ParameterList(node), (Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor));
    body = asyncTransformer_transformMethodBody(receiver, node);
  }
  const updated = NodeFactory_UpdateMethodDeclaration(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    decl,
    NodeVisitor_VisitModifiers((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Modifiers(node)),
    decl.AsteriskToken,
    Node_Name(node) as unknown as GoPtr<never>,
    undefined, // postfixToken
    undefined, // typeParameters
    parameters as unknown as GoPtr<never>,
    undefined, // returnType
    undefined, // fullSignature
    body as unknown as GoPtr<never>,
  );
  receiver!.lexicalArguments = savedLexicalArguments;
  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitGetAccessorDeclaration","kind":"method","status":"implemented","sigHash":"11176b79a9a35e13052ae9648b634e2c98903d89b5479a5ab9ccec4fc3ec7d2e","bodyHash":"fadf78869d98e4792aee2ccda300185f63983605b99be0a4394b8aa43275e294"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitGetAccessorDeclaration(node *ast.Node) *ast.Node {
 * 	decl := node.AsGetAccessorDeclaration()
 * 	savedLexicalArguments := tx.lexicalArguments
 * 	tx.lexicalArguments = lexicalArgumentsInfo{}
 * 	updated := tx.Factory().UpdateGetAccessorDeclaration(
 * 		decl,
 * 		tx.Visitor().VisitModifiers(decl.Modifiers()),
 * 		decl.Name(),
 * 		nil, /*typeParameters* /
 * 		tx.EmitContext().VisitParameters(decl.Parameters, tx.Visitor()),
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		tx.transformMethodBody(node),
 * 	)
 * 	tx.lexicalArguments = savedLexicalArguments
 * 	return updated
 * }
 */
export function asyncTransformer_visitGetAccessorDeclaration(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const decl = AsGetAccessorDeclaration(node)!;
  const savedLexicalArguments = receiver!.lexicalArguments;
  receiver!.lexicalArguments = { binding: undefined, used: false };
  const updated = NodeFactory_UpdateGetAccessorDeclaration(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    decl,
    NodeVisitor_VisitModifiers((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Modifiers(node)),
    Node_Name(node) as unknown as GoPtr<never>,
    undefined, // typeParameters
    EmitContext_VisitParameters(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_ParameterList(node), (Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor)) as unknown as GoPtr<never>,
    undefined, // returnType
    undefined, // fullSignature
    asyncTransformer_transformMethodBody(receiver, node) as unknown as GoPtr<never>,
  );
  receiver!.lexicalArguments = savedLexicalArguments;
  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitSetAccessorDeclaration","kind":"method","status":"implemented","sigHash":"d70c0968b7c625737d4e817e7f73b8ab69cb7be0e4df33001c40abe2848e9f78","bodyHash":"afc0a7afd9303ae81575335d48e0d3d961db281b026af9d9638c9d28a92a931f"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitSetAccessorDeclaration(node *ast.Node) *ast.Node {
 * 	decl := node.AsSetAccessorDeclaration()
 * 	savedLexicalArguments := tx.lexicalArguments
 * 	tx.lexicalArguments = lexicalArgumentsInfo{}
 * 	updated := tx.Factory().UpdateSetAccessorDeclaration(
 * 		decl,
 * 		tx.Visitor().VisitModifiers(decl.Modifiers()),
 * 		decl.Name(),
 * 		nil, /*typeParameters* /
 * 		tx.EmitContext().VisitParameters(decl.Parameters, tx.Visitor()),
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		tx.transformMethodBody(node),
 * 	)
 * 	tx.lexicalArguments = savedLexicalArguments
 * 	return updated
 * }
 */
export function asyncTransformer_visitSetAccessorDeclaration(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const decl = AsSetAccessorDeclaration(node)!;
  const savedLexicalArguments = receiver!.lexicalArguments;
  receiver!.lexicalArguments = { binding: undefined, used: false };
  const updated = NodeFactory_UpdateSetAccessorDeclaration(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    decl,
    NodeVisitor_VisitModifiers((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Modifiers(node)),
    Node_Name(node) as unknown as GoPtr<never>,
    undefined, // typeParameters
    EmitContext_VisitParameters(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_ParameterList(node), (Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor)) as unknown as GoPtr<never>,
    undefined, // returnType
    undefined, // fullSignature
    asyncTransformer_transformMethodBody(receiver, node) as unknown as GoPtr<never>,
  );
  receiver!.lexicalArguments = savedLexicalArguments;
  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitFunctionDeclaration","kind":"method","status":"implemented","sigHash":"35c36c3b27ac311afa9879ae34412b7b62dd1f062cb4fe4f3c221f1193f35ebd","bodyHash":"adabe8d50e16b76a814996fd7d15ef107c2f62cf53e7958ff64702f6310e7db7"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitFunctionDeclaration(node *ast.Node) *ast.Node {
 * 	decl := node.AsFunctionDeclaration()
 * 	functionFlags := ast.GetFunctionFlags(node)
 * 	savedLexicalArguments := tx.lexicalArguments
 * 	tx.lexicalArguments = lexicalArgumentsInfo{}
 *
 * 	var parameters *ast.NodeList
 * 	var body *ast.Node
 * 	if functionFlags&ast.FunctionFlagsAsync != 0 {
 * 		parameters = tx.transformAsyncFunctionParameterList(node)
 * 		body = tx.transformAsyncFunctionBody(node, parameters)
 * 	} else {
 * 		parameters = tx.EmitContext().VisitParameters(decl.Parameters, tx.Visitor())
 * 		body = tx.EmitContext().VisitFunctionBody(decl.Body, tx.Visitor())
 * 	}
 *
 * 	updated := tx.Factory().UpdateFunctionDeclaration(
 * 		decl,
 * 		tx.Visitor().VisitModifiers(decl.Modifiers()),
 * 		decl.AsteriskToken,
 * 		tx.Visitor().VisitNode(decl.Name()),
 * 		nil, /*typeParameters* /
 * 		parameters,
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		body,
 * 	)
 * 	tx.lexicalArguments = savedLexicalArguments
 * 	return updated
 * }
 */
export function asyncTransformer_visitFunctionDeclaration(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const decl = AsFunctionDeclaration(node)!;
  const functionFlags = GetFunctionFlags(node);
  const savedLexicalArguments = receiver!.lexicalArguments;
  receiver!.lexicalArguments = { binding: undefined, used: false };
  let parameters: GoPtr<NodeList>;
  let body: GoPtr<Node>;
  if ((functionFlags & FunctionFlagsAsync) !== 0) {
    parameters = asyncTransformer_transformAsyncFunctionParameterList(receiver, node);
    body = asyncTransformer_transformAsyncFunctionBody(receiver, node, parameters);
  } else {
    parameters = EmitContext_VisitParameters(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_ParameterList(node), (Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor));
    body = EmitContext_VisitFunctionBody(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_Body(node), (Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor));
  }
  const updated = NodeFactory_UpdateFunctionDeclaration(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    decl,
    NodeVisitor_VisitModifiers((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Modifiers(node)),
    decl.AsteriskToken,
    NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), decl.name as unknown as GoPtr<Node>) as unknown as GoPtr<never>,
    undefined, // typeParameters
    parameters as unknown as GoPtr<never>,
    undefined, // returnType
    undefined, // fullSignature
    body as unknown as GoPtr<never>,
  );
  receiver!.lexicalArguments = savedLexicalArguments;
  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitFunctionExpression","kind":"method","status":"implemented","sigHash":"e77157d7b1631d563e010488cd6741756293b3d862b2b31891f59d5e809488b0","bodyHash":"3b9854a0dc8ec7b3b8b44b3a7dda2d6baa32b494c3cea372f097aab7c845042b"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitFunctionExpression(node *ast.Node) *ast.Node {
 * 	decl := node.AsFunctionExpression()
 * 	functionFlags := ast.GetFunctionFlags(node)
 * 	savedLexicalArguments := tx.lexicalArguments
 * 	tx.lexicalArguments = lexicalArgumentsInfo{}
 *
 * 	var parameters *ast.NodeList
 * 	var body *ast.Node
 * 	if functionFlags&ast.FunctionFlagsAsync != 0 {
 * 		parameters = tx.transformAsyncFunctionParameterList(node)
 * 		body = tx.transformAsyncFunctionBody(node, parameters)
 * 	} else {
 * 		parameters = tx.EmitContext().VisitParameters(decl.Parameters, tx.Visitor())
 * 		body = tx.EmitContext().VisitFunctionBody(decl.Body, tx.Visitor())
 * 	}
 *
 * 	updated := tx.Factory().UpdateFunctionExpression(
 * 		decl,
 * 		tx.Visitor().VisitModifiers(decl.Modifiers()),
 * 		decl.AsteriskToken,
 * 		tx.Visitor().VisitNode(decl.Name()),
 * 		nil, /*typeParameters* /
 * 		parameters,
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		body,
 * 	)
 * 	tx.lexicalArguments = savedLexicalArguments
 * 	return updated
 * }
 */
export function asyncTransformer_visitFunctionExpression(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const decl = AsFunctionExpression(node)!;
  const functionFlags = GetFunctionFlags(node);
  const savedLexicalArguments = receiver!.lexicalArguments;
  receiver!.lexicalArguments = { binding: undefined, used: false };
  let parameters: GoPtr<NodeList>;
  let body: GoPtr<Node>;
  if ((functionFlags & FunctionFlagsAsync) !== 0) {
    parameters = asyncTransformer_transformAsyncFunctionParameterList(receiver, node);
    body = asyncTransformer_transformAsyncFunctionBody(receiver, node, parameters);
  } else {
    parameters = EmitContext_VisitParameters(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_ParameterList(node), (Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor));
    body = EmitContext_VisitFunctionBody(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_Body(node), (Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor));
  }
  const updated = NodeFactory_UpdateFunctionExpression(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    decl,
    NodeVisitor_VisitModifiers((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Modifiers(node)),
    decl.AsteriskToken,
    NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), decl.name as unknown as GoPtr<Node>) as unknown as GoPtr<never>,
    undefined, // typeParameters
    parameters as unknown as GoPtr<never>,
    undefined, // returnType
    undefined, // fullSignature
    body as unknown as GoPtr<never>,
  );
  receiver!.lexicalArguments = savedLexicalArguments;
  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitArrowFunction","kind":"method","status":"implemented","sigHash":"705e012b678d3e37a256b1e9d30aa8b10c797255de233237a20200efdd4e08a9","bodyHash":"e7ecfe573b4032e3bf070102955a7e3df7e2d840ee8eb04f0b2bd39694698d43"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitArrowFunction(node *ast.Node) *ast.Node {
 * 	// `arguments` in class static blocks is always an error, but we preserve Strada's emit
 * 	// behavior for baseline compatibility. In Strada, checker-based `isArgumentsLocalBinding`
 * 	// returns false for `arguments` in static blocks (since the binding doesn't exist due to
 * 	// the error), so the async transform leaves them untouched.
 * 	if tx.EmitContext().EmitFlags(node)&printer.EFNoLexicalArguments != 0 {
 * 		savedLexicalArguments := tx.lexicalArguments
 * 		tx.lexicalArguments = lexicalArgumentsInfo{}
 * 		defer func() { tx.lexicalArguments = savedLexicalArguments }()
 * 	}
 *
 * 	decl := node.AsArrowFunction()
 * 	functionFlags := ast.GetFunctionFlags(node)
 *
 * 	var parameters *ast.NodeList
 * 	var body *ast.Node
 * 	if functionFlags&ast.FunctionFlagsAsync != 0 {
 * 		parameters = tx.transformAsyncFunctionParameterList(node)
 * 		body = tx.transformAsyncFunctionBody(node, parameters)
 * 	} else {
 * 		parameters = tx.EmitContext().VisitParameters(decl.Parameters, tx.Visitor())
 * 		body = tx.EmitContext().VisitFunctionBody(decl.Body, tx.Visitor())
 * 	}
 *
 * 	return tx.Factory().UpdateArrowFunction(
 * 		decl,
 * 		tx.Visitor().VisitModifiers(decl.Modifiers()),
 * 		nil, /*typeParameters* /
 * 		parameters,
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		decl.EqualsGreaterThanToken,
 * 		body,
 * 	)
 * }
 */
export function asyncTransformer_visitArrowFunction(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  // `arguments` in class static blocks is always an error, but we preserve Strada's emit
  // behavior for baseline compatibility.
  let savedLexicalArguments: lexicalArgumentsInfo | undefined;
  if ((EmitContext_EmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node) & EFNoLexicalArguments) !== 0) {
    savedLexicalArguments = receiver!.lexicalArguments;
    receiver!.lexicalArguments = { binding: undefined, used: false };
  }
  const decl = AsArrowFunction(node)!;
  const functionFlags = GetFunctionFlags(node);
  let parameters: GoPtr<NodeList>;
  let body: GoPtr<Node>;
  if ((functionFlags & FunctionFlagsAsync) !== 0) {
    parameters = asyncTransformer_transformAsyncFunctionParameterList(receiver, node);
    body = asyncTransformer_transformAsyncFunctionBody(receiver, node, parameters);
  } else {
    parameters = EmitContext_VisitParameters(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_ParameterList(node), (Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor));
    body = EmitContext_VisitFunctionBody(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_Body(node), (Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor));
  }
  const result = NodeFactory_UpdateArrowFunction(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    decl,
    NodeVisitor_VisitModifiers((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Modifiers(node)),
    undefined, // typeParameters
    parameters as unknown as GoPtr<never>,
    undefined, // returnType
    undefined, // fullSignature
    decl.EqualsGreaterThanToken,
    body as unknown as GoPtr<never>,
  );
  if (savedLexicalArguments !== undefined) {
    receiver!.lexicalArguments = savedLexicalArguments;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.recordDeclarationName","kind":"method","status":"implemented","sigHash":"03a643f986cc4a4f615ec0a7c62fdfb89f5f2b0b60dc6df2b20a6dea41af72a2","bodyHash":"1db659ad2aeb21a1b61b050e987081dbe25294199283c61d29f6e67984a4c6bd"}
 *
 * Go source:
 * func (tx *asyncTransformer) recordDeclarationName(node *ast.Node, names *collections.Set[string]) {
 * 	name := node.Name()
 * 	if name == nil {
 * 		return
 * 	}
 * 	if ast.IsIdentifier(name) {
 * 		names.Add(name.Text())
 * 	} else if ast.IsBindingPattern(name) {
 * 		for _, element := range name.AsBindingPattern().Elements.Nodes {
 * 			if !ast.IsOmittedExpression(element) {
 * 				tx.recordDeclarationName(element, names)
 * 			}
 * 		}
 * 	}
 * }
 */
export function asyncTransformer_recordDeclarationName(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>, names: GoPtr<Set<string>>): void {
  const name = Node_Name(node);
  if (name === undefined) {
    return;
  }
  if (IsIdentifier(name)) {
    Set_Add(names as GoPtr<Set<string>>, Node_Text(name));
  } else if (IsBindingPattern(name)) {
    const bp = AsBindingPattern(name)!;
    for (const element of bp.Elements!.Nodes) {
      if (!IsOmittedExpression(element)) {
        asyncTransformer_recordDeclarationName(receiver, element, names);
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.isVariableDeclarationListWithCollidingName","kind":"method","status":"implemented","sigHash":"e0b1594f1e4c7de4eb36db77ebd94127b5654a4c0c34d25218b81949fbf4dcb1","bodyHash":"9f1619d271857f96a023b1ca75668100240a2bb06e86e3c677d4830ca15642e4"}
 *
 * Go source:
 * func (tx *asyncTransformer) isVariableDeclarationListWithCollidingName(node *ast.Node) bool {
 * 	return node != nil &&
 * 		ast.IsVariableDeclarationList(node) &&
 * 		node.Flags&ast.NodeFlagsBlockScoped == 0 &&
 * 		slices.ContainsFunc(node.AsVariableDeclarationList().Declarations.Nodes, tx.collidesWithParameterName)
 * }
 */
export function asyncTransformer_isVariableDeclarationListWithCollidingName(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): bool {
  if (node === undefined || !IsVariableDeclarationList(node)) {
    return false;
  }
  const vdl = AsVariableDeclarationList(node)!;
  return (node.Flags & NodeFlagsBlockScoped) === 0 &&
    vdl.Declarations!.Nodes.some((n) => asyncTransformer_collidesWithParameterName(receiver, n));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitVariableDeclarationListWithCollidingNames","kind":"method","status":"implemented","sigHash":"c48445bc20db534c59c01de0cf8cab8dac895d3155137c038a4f13e39e136459","bodyHash":"2c13597c67f64c08409bc235f8fb05ac0e36325907cdd03b186ef8c47a3e25a2"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitVariableDeclarationListWithCollidingNames(node *ast.VariableDeclarationList, hasReceiver bool) *ast.Node {
 * 	tx.hoistVariableDeclarationList(node)
 * 
 * 	var variables []*ast.Node
 * 	for _, decl := range node.Declarations.Nodes {
 * 		if decl.AsVariableDeclaration().Initializer != nil {
 * 			variables = append(variables, decl)
 * 		}
 * 	}
 * 
 * 	if len(variables) == 0 {
 * 		if hasReceiver {
 * 			name := node.Declarations.Nodes[0].Name()
 * 			var target *ast.Node
 * 			if ast.IsBindingPattern(name) {
 * 				target = transformers.ConvertBindingPatternToAssignmentPattern(tx.EmitContext(), name.AsBindingPattern())
 * 			} else {
 * 				target = name
 * 			}
 * 			return tx.Visitor().VisitNode(target)
 * 		}
 * 		return nil
 * 	}
 * 
 * 	var expressions []*ast.Node
 * 	for _, variable := range variables {
 * 		expressions = append(expressions, tx.transformInitializedVariable(variable.AsVariableDeclaration()))
 * 	}
 * 	return tx.Factory().InlineExpressions(expressions)
 * }
 */
export function asyncTransformer_visitVariableDeclarationListWithCollidingNames(receiver: GoPtr<asyncTransformer>, node: GoPtr<VariableDeclarationList>, hasReceiver: bool): GoPtr<Node> {
  asyncTransformer_hoistVariableDeclarationList(receiver, node);
  const variables: GoSlice<GoPtr<Node>> = node!.Declarations!.Nodes.filter((decl) => AsVariableDeclaration(decl)!.Initializer !== undefined);
  if (variables === undefined || variables.length === 0) {
    if (hasReceiver) {
      const name = Node_Name(node!.Declarations!.Nodes[0]);
      let target: GoPtr<Node>;
      if (IsBindingPattern(name)) {
        target = ConvertBindingPatternToAssignmentPattern(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), AsBindingPattern(name)!) as unknown as GoPtr<Node>;
      } else {
        target = name;
      }
      return NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), target);
    }
    return undefined;
  }
  const expressions: GoSlice<GoPtr<Node>> = variables.map((variable) => asyncTransformer_transformInitializedVariable(receiver, AsVariableDeclaration(variable)!) as GoPtr<Node>);
  return NodeFactory_InlineExpressions(Transformer_Factory(receiver!.__tsgoEmbedded0!), expressions as unknown as GoSlice<GoPtr<never>>) as unknown as GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.hoistVariableDeclarationList","kind":"method","status":"implemented","sigHash":"a56456e0cbeaa2649d824348b7c83877c4ff974578e497b0f45f902a11aa8990","bodyHash":"e2c185f6dd94692c01e464dc6c8da87027c0d71d28eacda098c019eeec2b953f"}
 *
 * Go source:
 * func (tx *asyncTransformer) hoistVariableDeclarationList(node *ast.VariableDeclarationList) {
 * 	for _, decl := range node.Declarations.Nodes {
 * 		tx.hoistVariable(decl)
 * 	}
 * }
 */
export function asyncTransformer_hoistVariableDeclarationList(receiver: GoPtr<asyncTransformer>, node: GoPtr<VariableDeclarationList>): void {
  for (const decl of node!.Declarations!.Nodes) {
    asyncTransformer_hoistVariable(receiver, decl);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.hoistVariable","kind":"method","status":"implemented","sigHash":"a0f4ea51721a0d1bb3a59edb686ecfce928cb59a6fc3493dd3e800511a69ac73","bodyHash":"fc7304230268c24bbda40a854822659710e158820fa68a92c706671e2602466f"}
 *
 * Go source:
 * func (tx *asyncTransformer) hoistVariable(node *ast.Node) {
 * 	name := node.Name()
 * 	if name == nil {
 * 		return
 * 	}
 * 	if ast.IsIdentifier(name) {
 * 		tx.EmitContext().AddVariableDeclaration(name)
 * 	} else if ast.IsBindingPattern(name) {
 * 		for _, element := range name.AsBindingPattern().Elements.Nodes {
 * 			if !ast.IsOmittedExpression(element) {
 * 				tx.hoistVariable(element)
 * 			}
 * 		}
 * 	}
 * }
 */
export function asyncTransformer_hoistVariable(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): void {
  const name = Node_Name(node);
  if (name === undefined) {
    return;
  }
  if (IsIdentifier(name)) {
    EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), name as unknown as GoPtr<never>);
  } else if (IsBindingPattern(name)) {
    const bp = AsBindingPattern(name)!;
    for (const element of bp.Elements!.Nodes) {
      if (!IsOmittedExpression(element)) {
        asyncTransformer_hoistVariable(receiver, element);
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.transformInitializedVariable","kind":"method","status":"implemented","sigHash":"ea89262e34539df9e88118b8299ee4af3577528048b5fde83fef8c6fa044fdad","bodyHash":"099a6eb31eb0aaa6343a793c2d01c40fec1f5e1dfb2076212c971665f456530e"}
 *
 * Go source:
 * func (tx *asyncTransformer) transformInitializedVariable(node *ast.VariableDeclaration) *ast.Node {
 * 	var target *ast.Node
 * 	if ast.IsBindingPattern(node.Name()) {
 * 		target = transformers.ConvertBindingPatternToAssignmentPattern(tx.EmitContext(), node.Name().AsBindingPattern())
 * 	} else {
 * 		target = node.Name()
 * 	}
 * 	converted := tx.Factory().NewAssignmentExpression(target, node.Initializer)
 * 	tx.EmitContext().SetSourceMapRange(converted, node.Loc)
 * 	return tx.Visitor().VisitNode(converted)
 * }
 */
export function asyncTransformer_transformInitializedVariable(receiver: GoPtr<asyncTransformer>, node: GoPtr<VariableDeclaration>): GoPtr<Node> {
  let target: GoPtr<Node>;
  const nameNode = Node_Name(node as unknown as GoPtr<Node>);
  if (IsBindingPattern(nameNode)) {
    target = ConvertBindingPatternToAssignmentPattern(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), AsBindingPattern(nameNode)!) as unknown as GoPtr<Node>;
  } else {
    target = nameNode;
  }
  const converted = NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), target as unknown as GoPtr<never>, node!.Initializer as unknown as GoPtr<never>);
  EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), converted as unknown as GoPtr<Node>, node!.Loc);
  return NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), converted as unknown as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.collidesWithParameterName","kind":"method","status":"implemented","sigHash":"0f3f819ba6fbf121fc0d687c47f8ae44b0da50ea8c233873906585d266331fce","bodyHash":"c83858d8d812b705b58bf8edc2cdfa0c962942c392381db66515ad05b836baa8"}
 *
 * Go source:
 * func (tx *asyncTransformer) collidesWithParameterName(node *ast.Node) bool {
 * 	name := node.Name()
 * 	if name == nil {
 * 		return false
 * 	}
 * 	if ast.IsIdentifier(name) {
 * 		return tx.enclosingFunctionParameterNames != nil && tx.enclosingFunctionParameterNames.Has(name.Text())
 * 	}
 * 	if ast.IsBindingPattern(name) {
 * 		for _, element := range name.AsBindingPattern().Elements.Nodes {
 * 			if !ast.IsOmittedExpression(element) && tx.collidesWithParameterName(element) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function asyncTransformer_collidesWithParameterName(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): bool {
  const name = Node_Name(node);
  if (name === undefined) {
    return false;
  }
  if (IsIdentifier(name)) {
    return receiver!.enclosingFunctionParameterNames !== undefined && Set_Has(receiver!.enclosingFunctionParameterNames as GoPtr<Set<string>>, Node_Text(name));
  }
  if (IsBindingPattern(name)) {
    const bp = AsBindingPattern(name)!;
    for (const element of bp.Elements!.Nodes) {
      if (!IsOmittedExpression(element) && asyncTransformer_collidesWithParameterName(receiver, element)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.transformMethodBody","kind":"method","status":"implemented","sigHash":"95a8652ecc88eb10550b6a94b4e0f55e41de384f641ea4dd5c46b36639003546","bodyHash":"a8c7f422afeeea07b6674b244a2a07d9ea806a427e2211622ac6b237547a3f29"}
 *
 * Go source:
 * func (tx *asyncTransformer) transformMethodBody(node *ast.Node) *ast.Node {
 * 	savedCapturedSuperProperties := tx.capturedSuperProperties
 * 	savedHasSuperElementAccess := tx.hasSuperElementAccess
 * 	savedHasSuperPropertyAssignment := tx.hasSuperPropertyAssignment
 * 	savedSuperBinding := tx.superBinding
 * 	savedSuperIndexBinding := tx.superIndexBinding
 * 	tx.capturedSuperProperties = &collections.OrderedSet[string]{}
 * 	tx.hasSuperElementAccess = false
 * 	tx.hasSuperPropertyAssignment = false
 * 	tx.superBinding = tx.Factory().NewUniqueNameEx("_super", printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel})
 * 	tx.superIndexBinding = tx.Factory().NewUniqueNameEx("_superIndex", printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel})
 *
 * 	tx.EmitContext().StartVariableEnvironment()
 * 	updated := tx.EmitContext().VisitFunctionBody(node.Body(), tx.Visitor())
 *
 * 	// Minor optimization, emit `_super` helper to capture `super` access in an arrow.
 * 	emitSuperHelpers := (tx.capturedSuperProperties.Size() > 0 || tx.hasSuperElementAccess) &&
 * 		(ast.GetFunctionFlags(tx.getOriginalIfFunctionLike(node))&ast.FunctionFlagsAsyncGenerator) != ast.FunctionFlagsAsyncGenerator
 *
 * 	if emitSuperHelpers {
 * 		if tx.capturedSuperProperties.Size() > 0 {
 * 			tx.EmitContext().AddInitializationStatement(tx.createSuperAccessVariableStatement())
 * 		}
 * 	}
 *
 * 	mergedStatements := tx.EmitContext().EndAndMergeVariableEnvironmentList(updated.StatementList())
 * 	if emitSuperHelpers && tx.hasSuperElementAccess && !updated.AsBlock().MultiLine {
 * 		newBlock := tx.Factory().NewBlock(mergedStatements, true)
 * 		newBlock.Loc = updated.Loc
 * 		updated = newBlock
 * 	} else {
 * 		updated = tx.Factory().UpdateBlock(updated.AsBlock(), mergedStatements, updated.AsBlock().MultiLine)
 * 	}
 *
 * 	if emitSuperHelpers && tx.hasSuperElementAccess {
 * 		if tx.hasSuperPropertyAssignment {
 * 			tx.EmitContext().AddEmitHelper(updated, printer.AdvancedAsyncSuperHelper)
 * 		} else {
 * 			tx.EmitContext().AddEmitHelper(updated, printer.AsyncSuperHelper)
 * 		}
 * 	}
 *
 * 	tx.capturedSuperProperties = savedCapturedSuperProperties
 * 	tx.hasSuperElementAccess = savedHasSuperElementAccess
 * 	tx.hasSuperPropertyAssignment = savedHasSuperPropertyAssignment
 * 	tx.superBinding = savedSuperBinding
 * 	tx.superIndexBinding = savedSuperIndexBinding
 * 	return updated
 * }
 */
export function asyncTransformer_transformMethodBody(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const savedCapturedSuperProperties = receiver!.__tsgoEmbedded1!.capturedSuperProperties;
  const savedHasSuperElementAccess = receiver!.__tsgoEmbedded1!.hasSuperElementAccess;
  const savedHasSuperPropertyAssignment = receiver!.__tsgoEmbedded1!.hasSuperPropertyAssignment;
  const savedSuperBinding = receiver!.__tsgoEmbedded1!.superBinding;
  const savedSuperIndexBinding = receiver!.__tsgoEmbedded1!.superIndexBinding;
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const factory = printerFactory!.__tsgoEmbedded0!;
  receiver!.__tsgoEmbedded1!.capturedSuperProperties = NewOrderedSetWithSizeHint<string>(0);
  receiver!.__tsgoEmbedded1!.hasSuperElementAccess = false as bool;
  receiver!.__tsgoEmbedded1!.hasSuperPropertyAssignment = false as bool;
  receiver!.__tsgoEmbedded1!.superBinding = NodeFactory_NewUniqueNameEx(printerFactory!, "_super", { Flags: GeneratedIdentifierFlagsOptimistic | GeneratedIdentifierFlagsFileLevel, Prefix: "", Suffix: "" });
  receiver!.__tsgoEmbedded1!.superIndexBinding = NodeFactory_NewUniqueNameEx(printerFactory!, "_superIndex", { Flags: GeneratedIdentifierFlagsOptimistic | GeneratedIdentifierFlagsFileLevel, Prefix: "", Suffix: "" });
  EmitContext_StartVariableEnvironment(Transformer_EmitContext(receiver!.__tsgoEmbedded0!));
  let updated = EmitContext_VisitFunctionBody(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_Body(node), (Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor));
  // Minor optimization, emit `_super` helper to capture `super` access in an arrow.
  const emitSuperHelpers =
    (OrderedSet_Size(receiver!.__tsgoEmbedded1!.capturedSuperProperties!) > 0 || receiver!.__tsgoEmbedded1!.hasSuperElementAccess) &&
    (GetFunctionFlags(asyncTransformer_getOriginalIfFunctionLike(receiver, node)) & FunctionFlagsAsyncGenerator) !== FunctionFlagsAsyncGenerator;
  if (emitSuperHelpers) {
    if (OrderedSet_Size(receiver!.__tsgoEmbedded1!.capturedSuperProperties!) > 0) {
      EmitContext_AddInitializationStatement(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), superAccessState_createSuperAccessVariableStatement(receiver!.__tsgoEmbedded1!));
    }
  }
  const mergedStatements = EmitContext_EndAndMergeVariableEnvironmentList(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_StatementList(updated) as unknown as GoPtr<NodeList>);
  const updatedBlock = AsBlock(updated)!;
  if (emitSuperHelpers && receiver!.__tsgoEmbedded1!.hasSuperElementAccess && !updatedBlock.MultiLine) {
    const newBlock = NewBlock(factory, mergedStatements as unknown as GoPtr<never>, true);
    newBlock!.Loc = updated!.Loc;
    updated = newBlock as unknown as GoPtr<Node>;
  } else {
    updated = NodeFactory_UpdateBlock(factory, updatedBlock, mergedStatements as unknown as GoPtr<never>, updatedBlock.MultiLine) as unknown as GoPtr<Node>;
  }
  if (emitSuperHelpers && receiver!.__tsgoEmbedded1!.hasSuperElementAccess) {
    if (receiver!.__tsgoEmbedded1!.hasSuperPropertyAssignment) {
      EmitContext_AddEmitHelper(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), updated, AdvancedAsyncSuperHelper);
    } else {
      EmitContext_AddEmitHelper(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), updated, AsyncSuperHelper);
    }
  }
  receiver!.__tsgoEmbedded1!.capturedSuperProperties = savedCapturedSuperProperties;
  receiver!.__tsgoEmbedded1!.hasSuperElementAccess = savedHasSuperElementAccess;
  receiver!.__tsgoEmbedded1!.hasSuperPropertyAssignment = savedHasSuperPropertyAssignment;
  receiver!.__tsgoEmbedded1!.superBinding = savedSuperBinding;
  receiver!.__tsgoEmbedded1!.superIndexBinding = savedSuperIndexBinding;
  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.createCaptureArgumentsStatement","kind":"method","status":"implemented","sigHash":"b69c1db43226d7a154c9ab1d29ea3d07ce35765012ce9413cc43be838debf633","bodyHash":"dde23d77bd79edb338e651f68e8e78240f0508367dec094c75a1215b26f6d3c3"}
 *
 * Go source:
 * func (tx *asyncTransformer) createCaptureArgumentsStatement() *ast.Node {
 * 	variable := tx.Factory().NewVariableDeclaration(
 * 		tx.lexicalArguments.binding,
 * 		nil,
 * 		nil,
 * 		tx.Factory().NewIdentifier("arguments"),
 * 	)
 * 	declList := tx.Factory().NewVariableDeclarationList(tx.Factory().NewNodeList([]*ast.Node{variable}), ast.NodeFlagsNone)
 * 	statement := tx.Factory().NewVariableStatement(nil, declList)
 * 	tx.EmitContext().AddEmitFlags(statement, printer.EFStartOnNewLine|printer.EFCustomPrologue)
 * 	return statement
 * }
 */
export function asyncTransformer_createCaptureArgumentsStatement(receiver: GoPtr<asyncTransformer>): GoPtr<Node> {
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const factory = printerFactory!.__tsgoEmbedded0!;
  const variable = NewVariableDeclaration(
    factory,
    receiver!.lexicalArguments.binding as unknown as GoPtr<never>,
    undefined,
    undefined,
    NewIdentifier(factory, "arguments") as unknown as GoPtr<never>,
  );
  const declList = NewVariableDeclarationList(factory, NodeFactory_NewNodeList(factory, [variable]) as unknown as GoPtr<never>, NodeFlagsNone);
  const statement = NewVariableStatement(factory, undefined, declList as unknown as GoPtr<never>);
  EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), statement, EFStartOnNewLine | EFCustomPrologue);
  return statement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.transformAsyncFunctionParameterList","kind":"method","status":"implemented","sigHash":"a56cf6201405e520c093b2946c7aa56c37001e519da0adfe8576541450e541d5","bodyHash":"35c3f563bc40cf74bc6406e32cd2e79b99f18013a7e6403209c8827adc41a818"}
 *
 * Go source:
 * func (tx *asyncTransformer) transformAsyncFunctionParameterList(node *ast.Node) *ast.NodeList {
 * 	if isSimpleParameterList(node.Parameters()) {
 * 		return tx.EmitContext().VisitParameters(node.ParameterList(), tx.Visitor())
 * 	}
 * 
 * 	var newParameters []*ast.Node
 * 	for _, parameter := range node.Parameters() {
 * 		param := parameter.AsParameterDeclaration()
 * 		if param.Initializer != nil || param.DotDotDotToken != nil {
 * 			// for an arrow function, capture the remaining arguments in a rest parameter.
 * 			// for any other function/method this isn't necessary as we can just use `arguments`.
 * 			if node.Kind == ast.KindArrowFunction {
 * 				restParameter := tx.Factory().NewParameterDeclaration(
 * 					nil,
 * 					tx.Factory().NewToken(ast.KindDotDotDotToken),
 * 					tx.Factory().NewUniqueNameEx("args", printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsReservedInNestedScopes}),
 * 					nil,
 * 					nil,
 * 					nil,
 * 				)
 * 				newParameters = append(newParameters, restParameter)
 * 			}
 * 			break
 * 		}
 * 		// for arrow functions we capture fixed parameters to forward to `__awaiter`. For all other functions
 * 		// we add fixed parameters to preserve the function's `length` property.
 * 		newParameter := tx.Factory().NewParameterDeclaration(
 * 			nil,
 * 			nil,
 * 			tx.Factory().NewGeneratedNameForNodeEx(param.Name(), printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsReservedInNestedScopes}),
 * 			nil,
 * 			nil,
 * 			nil,
 * 		)
 * 		newParameters = append(newParameters, newParameter)
 * 	}
 * 	newParametersArray := tx.Factory().NewNodeList(newParameters)
 * 	newParametersArray.Loc = node.ParameterList().Loc
 * 	return newParametersArray
 * }
 */
export function asyncTransformer_transformAsyncFunctionParameterList(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<NodeList> {
  if (isSimpleParameterList(Node_Parameters(node))) {
    return EmitContext_VisitParameters(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_ParameterList(node), (Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor));
  }
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const factory = printerFactory!.__tsgoEmbedded0!;
  const newParameters: GoSlice<GoPtr<Node>> = [];
  for (const parameter of Node_Parameters(node) ?? []) {
    const param = AsParameterDeclaration(parameter)!;
    if (param.Initializer !== undefined || param.DotDotDotToken !== undefined) {
      // for an arrow function, capture the remaining arguments in a rest parameter.
      // for any other function/method this isn't necessary as we can just use `arguments`.
      if (node!.Kind === KindArrowFunction) {
        const restParameter = NewParameterDeclaration(
          factory,
          undefined,
          NewToken(factory, KindDotDotDotToken),
          NodeFactory_NewUniqueNameEx(printerFactory, "args", { Flags: GeneratedIdentifierFlagsReservedInNestedScopes, Prefix: "", Suffix: "" }) as unknown as GoPtr<never>,
          undefined,
          undefined,
          undefined,
        );
        newParameters.push(restParameter);
      }
      break;
    }
    // for arrow functions we capture fixed parameters to forward to `__awaiter`. For all other functions
    // we add fixed parameters to preserve the function's `length` property.
    const newParameter = NewParameterDeclaration(
      factory,
      undefined,
      undefined,
      NodeFactory_NewGeneratedNameForNodeEx(printerFactory, param.name as unknown as GoPtr<Node>, { Flags: GeneratedIdentifierFlagsReservedInNestedScopes, Prefix: "", Suffix: "" }) as unknown as GoPtr<never>,
      undefined,
      undefined,
      undefined,
    );
    newParameters.push(newParameter);
  }
  const newParametersArray = NodeFactory_NewNodeList(factory, newParameters);
  newParametersArray!.Loc = Node_ParameterList(node)!.Loc;
  return newParametersArray;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.transformAsyncFunctionBody","kind":"method","status":"implemented","sigHash":"728cf69d8964d0a5bcf1d50cee929efce063e9e58c1cb131b831412cce6376a5","bodyHash":"4d6a12e59145e2e5576f19dd774dc887caa78ea3cdf6d6bc8e337677406e2212"}
 *
 * Go source:
 * func (tx *asyncTransformer) transformAsyncFunctionBody(node *ast.Node, outerParameters *ast.NodeList) *ast.Node {
 * 	isArrow := node.Kind == ast.KindArrowFunction
 * 	savedCapturedSuperProperties := tx.capturedSuperProperties
 * 	savedHasSuperElementAccess := tx.hasSuperElementAccess
 * 	savedHasSuperPropertyAssignment := tx.hasSuperPropertyAssignment
 * 	savedSuperBinding := tx.superBinding
 * 	savedSuperIndexBinding := tx.superIndexBinding
 * 	if !isArrow {
 * 		tx.capturedSuperProperties = &collections.OrderedSet[string]{}
 * 		tx.hasSuperElementAccess = false
 * 		tx.hasSuperPropertyAssignment = false
 * 		tx.superBinding = tx.Factory().NewUniqueNameEx("_super", printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel})
 * 		tx.superIndexBinding = tx.Factory().NewUniqueNameEx("_superIndex", printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel})
 * 	}
 *
 * 	innerParameters := (*ast.NodeList)(nil)
 * 	if !isSimpleParameterList(node.Parameters()) {
 * 		innerParameters = tx.EmitContext().VisitParameters(node.ParameterList(), tx.Visitor())
 * 	}
 *
 * 	savedLexicalArguments := tx.lexicalArguments
 * 	captureLexicalArguments := tx.lexicalArguments.binding == nil
 * 	if captureLexicalArguments {
 * 		tx.lexicalArguments = lexicalArgumentsInfo{
 * 			binding: tx.Factory().NewUniqueName("arguments"),
 * 		}
 * 	}
 *
 * 	var argumentsExpression *ast.Expression
 * 	if innerParameters != nil {
 * 		if isArrow {
 * 			...
 * 		} else {
 * 			argumentsExpression = tx.Factory().NewIdentifier("arguments")
 * 		}
 * 	}
 *
 * 	...
 * 	emitSuperHelpers := tx.capturedSuperProperties != nil &&
 * 		(tx.capturedSuperProperties.Size() > 0 || tx.hasSuperElementAccess)
 * 	if emitSuperHelpers {
 * 		innerParameters = tx.superAccessVisitor.VisitNodes(innerParameters)
 * 		asyncBody = tx.substituteSuperAccessesInBody(asyncBody)
 * 	}
 * 	...
 * 	return result
 * }
 */
export function asyncTransformer_transformAsyncFunctionBody(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>, outerParameters: GoPtr<NodeList>): GoPtr<Node> {
  const isArrow = node!.Kind === KindArrowFunction;
  const savedCapturedSuperProperties = receiver!.__tsgoEmbedded1!.capturedSuperProperties;
  const savedHasSuperElementAccess = receiver!.__tsgoEmbedded1!.hasSuperElementAccess;
  const savedHasSuperPropertyAssignment = receiver!.__tsgoEmbedded1!.hasSuperPropertyAssignment;
  const savedSuperBinding = receiver!.__tsgoEmbedded1!.superBinding;
  const savedSuperIndexBinding = receiver!.__tsgoEmbedded1!.superIndexBinding;
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const factory = printerFactory!.__tsgoEmbedded0!;
  if (!isArrow) {
    receiver!.__tsgoEmbedded1!.capturedSuperProperties = NewOrderedSetWithSizeHint<string>(0);
    receiver!.__tsgoEmbedded1!.hasSuperElementAccess = false as bool;
    receiver!.__tsgoEmbedded1!.hasSuperPropertyAssignment = false as bool;
    receiver!.__tsgoEmbedded1!.superBinding = NodeFactory_NewUniqueNameEx(printerFactory!, "_super", { Flags: GeneratedIdentifierFlagsOptimistic | GeneratedIdentifierFlagsFileLevel, Prefix: "", Suffix: "" });
    receiver!.__tsgoEmbedded1!.superIndexBinding = NodeFactory_NewUniqueNameEx(printerFactory!, "_superIndex", { Flags: GeneratedIdentifierFlagsOptimistic | GeneratedIdentifierFlagsFileLevel, Prefix: "", Suffix: "" });
  }
  let innerParameters: GoPtr<NodeList> = undefined;
  if (!isSimpleParameterList(Node_Parameters(node))) {
    innerParameters = EmitContext_VisitParameters(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_ParameterList(node), (Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor));
  }
  const savedLexicalArguments = receiver!.lexicalArguments;
  const captureLexicalArguments = receiver!.lexicalArguments.binding === undefined;
  if (captureLexicalArguments) {
    receiver!.lexicalArguments = { binding: NodeFactory_NewUniqueName(printerFactory!, "arguments"), used: false };
  }
  let argumentsExpression: GoPtr<Node> = undefined;
  if (innerParameters !== undefined) {
    if (isArrow) {
      // `node` does not have a simple parameter list, so `outerParameters` refers to placeholders that are
      // forwarded to `innerParameters`, matching how they are introduced in `transformAsyncFunctionParameterList`.
      const parameterBindings: GoPtr<Node>[] = [];
      const outerLen = outerParameters!.Nodes.length;
      const params = Node_Parameters(node);
      for (let i = 0; i < params.length; i++) {
        if (i >= outerLen) break;
        const originalParameter = AsParameterDeclaration(params[i])!;
        const outerParameter = AsParameterDeclaration(outerParameters!.Nodes[i])!;
        if (originalParameter.Initializer !== undefined || originalParameter.DotDotDotToken !== undefined) {
          parameterBindings.push(NewSpreadElement(factory, Node_Name(outerParameters!.Nodes[i]) as unknown as GoPtr<never>) as unknown as GoPtr<Node>);
          break;
        }
        parameterBindings.push(Node_Name(outerParameters!.Nodes[i]) as unknown as GoPtr<Node>);
      }
      argumentsExpression = NewArrayLiteralExpression(factory, NodeFactory_NewNodeList(factory, parameterBindings) as unknown as GoPtr<never>, false) as unknown as GoPtr<Node>;
    } else {
      argumentsExpression = NewIdentifier(factory, "arguments") as unknown as GoPtr<Node>;
    }
  }
  // An async function is emit as an outer function that calls an inner generator function.
  const savedEnclosingFunctionParameterNames = receiver!.enclosingFunctionParameterNames;
  receiver!.enclosingFunctionParameterNames = NewSetWithSizeHint<string>(0);
  for (const parameter of Node_Parameters(node)) {
    asyncTransformer_recordDeclarationName(receiver, parameter as unknown as GoPtr<Node>, receiver!.enclosingFunctionParameterNames);
  }
  const hasLexicalThis = asyncTransformer_inHasLexicalThisContext(receiver);
  let asyncBody = asyncTransformer_transformAsyncFunctionBodyWorker(receiver, Node_Body(node));
  const asyncBodyBlock = AsBlock(asyncBody)!;
  asyncBody = NodeFactory_UpdateBlock(
    factory,
    asyncBodyBlock,
    EmitContext_EndAndMergeVariableEnvironmentList(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_StatementList(asyncBody) as unknown as GoPtr<NodeList>) as unknown as GoPtr<never>,
    asyncBodyBlock.MultiLine,
  ) as unknown as GoPtr<Node>;
  // Substitute super property accesses with _super/_superIndex helpers
  const emitSuperHelpers = receiver!.__tsgoEmbedded1!.capturedSuperProperties !== undefined &&
    (OrderedSet_Size(receiver!.__tsgoEmbedded1!.capturedSuperProperties!) > 0 || receiver!.__tsgoEmbedded1!.hasSuperElementAccess);
  if (emitSuperHelpers) {
    if (innerParameters !== undefined) {
      innerParameters = NodeVisitor_VisitNodes(receiver!.__tsgoEmbedded1!.superAccessVisitor as ConcreteNodeVisitor, innerParameters);
    }
    asyncBody = superAccessState_substituteSuperAccessesInBody(receiver!.__tsgoEmbedded1!, asyncBody);
  }
  let result: GoPtr<Node>;
  if (!isArrow) {
    EmitContext_StartVariableEnvironment(Transformer_EmitContext(receiver!.__tsgoEmbedded0!));
    if (emitSuperHelpers) {
      if (OrderedSet_Size(receiver!.__tsgoEmbedded1!.capturedSuperProperties!) > 0) {
        EmitContext_AddInitializationStatement(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), superAccessState_createSuperAccessVariableStatement(receiver!.__tsgoEmbedded1!));
      }
    }
    if (captureLexicalArguments && receiver!.lexicalArguments.used) {
      EmitContext_AddInitializationStatement(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), asyncTransformer_createCaptureArgumentsStatement(receiver));
    }
    const returnStmt = NewReturnStatement(
      factory,
      NodeFactory_NewAwaiterHelper(
        printerFactory!,
        hasLexicalThis,
        argumentsExpression as unknown as GoPtr<never>,
        innerParameters as unknown as GoPtr<never>,
        asyncBody as unknown as GoPtr<never>,
      ) as unknown as GoPtr<never>,
    );
    const stmtList = NodeFactory_NewNodeList(factory, [returnStmt as unknown as GoPtr<Node>]);
    const mergedStmts = EmitContext_EndAndMergeVariableEnvironmentList(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), stmtList as unknown as GoPtr<NodeList>);
    const block = NewBlock(factory, mergedStmts as unknown as GoPtr<never>, true);
    block!.Loc = Node_Body(node)!.Loc;
    if (emitSuperHelpers && receiver!.__tsgoEmbedded1!.hasSuperElementAccess) {
      if (receiver!.__tsgoEmbedded1!.hasSuperPropertyAssignment) {
        EmitContext_AddEmitHelper(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), block as unknown as GoPtr<Node>, AdvancedAsyncSuperHelper);
      } else {
        EmitContext_AddEmitHelper(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), block as unknown as GoPtr<Node>, AsyncSuperHelper);
      }
    }
    result = block as unknown as GoPtr<Node>;
  } else {
    result = NodeFactory_NewAwaiterHelper(
      printerFactory!,
      hasLexicalThis,
      argumentsExpression as unknown as GoPtr<never>,
      innerParameters as unknown as GoPtr<never>,
      asyncBody as unknown as GoPtr<never>,
    ) as unknown as GoPtr<Node>;
    if (captureLexicalArguments && receiver!.lexicalArguments.used) {
      const block = asyncTransformer_convertToFunctionBlock(receiver, result);
      const blockBlock = AsBlock(block)!;
      result = NodeFactory_UpdateBlock(
        factory,
        blockBlock,
        EmitContext_MergeEnvironmentList(
          Transformer_EmitContext(receiver!.__tsgoEmbedded0!),
          Node_StatementList(block) as unknown as GoPtr<NodeList>,
          [asyncTransformer_createCaptureArgumentsStatement(receiver)],
        ) as unknown as GoPtr<never>,
        blockBlock.MultiLine,
      ) as unknown as GoPtr<Node>;
    }
  }
  receiver!.enclosingFunctionParameterNames = savedEnclosingFunctionParameterNames;
  if (!isArrow) {
    receiver!.__tsgoEmbedded1!.capturedSuperProperties = savedCapturedSuperProperties;
    receiver!.__tsgoEmbedded1!.hasSuperElementAccess = savedHasSuperElementAccess;
    receiver!.__tsgoEmbedded1!.hasSuperPropertyAssignment = savedHasSuperPropertyAssignment;
    receiver!.__tsgoEmbedded1!.superBinding = savedSuperBinding;
    receiver!.__tsgoEmbedded1!.superIndexBinding = savedSuperIndexBinding;
    receiver!.lexicalArguments = savedLexicalArguments;
  } else if (captureLexicalArguments && !receiver!.lexicalArguments.used) {
    // If we created a new binding but it wasn't used, restore the previous state.
    receiver!.lexicalArguments = savedLexicalArguments;
  } else if (captureLexicalArguments) {
    // Keep the binding but clear the used flag so siblings don't re-emit the capture statement.
    receiver!.lexicalArguments.used = false;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.transformAsyncFunctionBodyWorker","kind":"method","status":"implemented","sigHash":"366620b1ed90ebdf5b83c46826e6e6b7f6d2deb6e10d9287b32769793fadbcd7","bodyHash":"77ca964f876fc3fb6d2f6fbf2e2ce926374ff63befd7d10399c1f3ca29e8a116"}
 *
 * Go source:
 * func (tx *asyncTransformer) transformAsyncFunctionBodyWorker(body *ast.Node) *ast.Node {
 * 	if ast.IsBlock(body) {
 * 		return tx.Factory().UpdateBlock(
 * 			body.AsBlock(),
 * 			tx.asyncBodyVisitor.VisitNodes(body.StatementList()),
 * 			body.AsBlock().MultiLine,
 * 		)
 * 	}
 * 	// Convert expression body to block body with return statement
 * 	visited := tx.asyncBodyVisitor.VisitNode(body)
 * 	ret := tx.Factory().NewReturnStatement(visited)
 * 	ret.Loc = body.Loc
 * 	list := tx.Factory().NewNodeList([]*ast.Node{ret})
 * 	list.Loc = body.Loc
 * 	block := tx.Factory().NewBlock(list, false /*multiLine* /)
 * 	block.Loc = body.Loc
 * 	return block
 * }
 */
export function asyncTransformer_transformAsyncFunctionBodyWorker(receiver: GoPtr<asyncTransformer>, body: GoPtr<Node>): GoPtr<Node> {
  const factory = Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!;
  if (IsBlock(body)) {
    const bodyBlock = AsBlock(body)!;
    return NodeFactory_UpdateBlock(
      factory,
      bodyBlock,
      NodeVisitor_VisitNodes(receiver!.asyncBodyVisitor as ConcreteNodeVisitor, Node_StatementList(body) as unknown as GoPtr<NodeList>) as unknown as GoPtr<never>,
      bodyBlock.MultiLine,
    ) as unknown as GoPtr<Node>;
  }
  // Convert expression body to block body with return statement
  const visited = NodeVisitor_VisitNode(receiver!.asyncBodyVisitor as ConcreteNodeVisitor, body);
  const ret = NewReturnStatement(factory, visited as unknown as GoPtr<never>);
  ret!.Loc = body!.Loc;
  const list = NodeFactory_NewNodeList(factory, [ret as unknown as GoPtr<Node>]);
  list!.Loc = body!.Loc;
  const block = NewBlock(factory, list as unknown as GoPtr<never>, false);
  block!.Loc = body!.Loc;
  return block as unknown as GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.convertToFunctionBlock","kind":"method","status":"implemented","sigHash":"c3d5999fc1975b022730aecb9ab16066e3a996bcecfef6bec3b23a8854338a39","bodyHash":"43d1822de130e51a9d1eb957e7cd62adaf8437f5c46e32d49a4612248cf69ff7"}
 *
 * Go source:
 * func (tx *asyncTransformer) convertToFunctionBlock(node *ast.Node) *ast.Node {
 * 	if ast.IsBlock(node) {
 * 		return node
 * 	}
 * 	ret := tx.Factory().NewReturnStatement(node)
 * 	ret.Loc = node.Loc
 * 	tx.EmitContext().SetOriginal(ret, node)
 * 	list := tx.Factory().NewNodeList([]*ast.Node{ret})
 * 	list.Loc = node.Loc
 * 	block := tx.Factory().NewBlock(list, true)
 * 	block.Loc = node.Loc
 * 	return block
 * }
 */
export function asyncTransformer_convertToFunctionBlock(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const factory = printerFactory!.__tsgoEmbedded0!;
  if (IsBlock(node)) {
    return node;
  }
  const ret = NewReturnStatement(factory, node as unknown as GoPtr<never>);
  ret!.Loc = node!.Loc;
  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), ret, node);
  const list = NodeFactory_NewNodeList(factory, [ret]);
  list!.Loc = node!.Loc;
  const block = NewBlock(factory, list as unknown as GoPtr<never>, true);
  block!.Loc = node!.Loc;
  return block;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::func::assignmentTargetContainsSuperProperty","kind":"func","status":"implemented","sigHash":"93e6c9d66e85ac1d001e47e6ea0f1949591170eaa6a21e39c98e9c9e955dc5b0","bodyHash":"01c0e77321941dc532e9b12ea2ce55b7cd2c568af7d3135abd19991397215c8a"}
 *
 * Go source:
 * func assignmentTargetContainsSuperProperty(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindPropertyAccessExpression, ast.KindElementAccessExpression:
 * 		return node.Expression().Kind == ast.KindSuperKeyword
 * 	case ast.KindParenthesizedExpression:
 * 		return assignmentTargetContainsSuperProperty(node.AsParenthesizedExpression().Expression)
 * 	case ast.KindArrayLiteralExpression:
 * 		return slices.ContainsFunc(node.AsArrayLiteralExpression().Elements.Nodes, assignmentTargetContainsSuperProperty)
 * 	case ast.KindObjectLiteralExpression:
 * 		for _, prop := range node.AsObjectLiteralExpression().Properties.Nodes {
 * 			switch prop.Kind {
 * 			case ast.KindPropertyAssignment:
 * 				if assignmentTargetContainsSuperProperty(prop.AsPropertyAssignment().Initializer) {
 * 					return true
 * 				}
 * 			case ast.KindShorthandPropertyAssignment:
 * 				if assignmentTargetContainsSuperProperty(prop.AsShorthandPropertyAssignment().Name()) {
 * 					return true
 * 				}
 * 			case ast.KindSpreadAssignment:
 * 				if assignmentTargetContainsSuperProperty(prop.AsSpreadAssignment().Expression) {
 * 					return true
 * 				}
 * 			}
 * 		}
 * 	case ast.KindSpreadElement:
 * 		return assignmentTargetContainsSuperProperty(node.AsSpreadElement().Expression)
 * 	}
 * 	return false
 * }
 */
export function assignmentTargetContainsSuperProperty(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindPropertyAccessExpression:
    case KindElementAccessExpression:
      return Node_Expression(node)!.Kind === KindSuperKeyword;
    case KindParenthesizedExpression:
      return assignmentTargetContainsSuperProperty(AsParenthesizedExpression(node)!.Expression as unknown as GoPtr<Node>);
    case KindArrayLiteralExpression:
      return AsArrayLiteralExpression(node)!.Elements!.Nodes.some(assignmentTargetContainsSuperProperty);
    case KindObjectLiteralExpression: {
      for (const prop of AsObjectLiteralExpression(node)!.Properties!.Nodes) {
        switch (prop!.Kind) {
          case KindPropertyAssignment:
            if (assignmentTargetContainsSuperProperty(AsPropertyAssignment(prop)!.Initializer as unknown as GoPtr<Node>)) {
              return true;
            }
            break;
          case KindShorthandPropertyAssignment:
            if (assignmentTargetContainsSuperProperty(Node_Name(AsShorthandPropertyAssignment(prop) as unknown as GoPtr<Node>)!)) {
              return true;
            }
            break;
          case KindSpreadAssignment:
            if (assignmentTargetContainsSuperProperty(AsSpreadAssignment(prop)!.Expression as unknown as GoPtr<Node>)) {
              return true;
            }
            break;
        }
      }
      return false;
    }
    case KindSpreadElement:
      return assignmentTargetContainsSuperProperty(AsSpreadElement(node)!.Expression as unknown as GoPtr<Node>);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::func::isUpdateExpression","kind":"func","status":"implemented","sigHash":"0949af1b71ba6ad3c40592f6d782f33913226972faa33f24ea82c6a17641489d","bodyHash":"46f756ba36af4a284827d90fea4d3d58c23fdc622f321ae191798062f2ebc823"}
 *
 * Go source:
 * func isUpdateExpression(node *ast.Node) bool {
 * 	if ast.IsPrefixUnaryExpression(node) {
 * 		op := node.AsPrefixUnaryExpression().Operator
 * 		return op == ast.KindPlusPlusToken || op == ast.KindMinusMinusToken
 * 	}
 * 	if ast.IsPostfixUnaryExpression(node) {
 * 		op := node.AsPostfixUnaryExpression().Operator
 * 		return op == ast.KindPlusPlusToken || op == ast.KindMinusMinusToken
 * 	}
 * 	return false
 * }
 */
export function isUpdateExpression(node: GoPtr<Node>): bool {
  if (IsPrefixUnaryExpression(node)) {
    const op = AsPrefixUnaryExpression(node)!.Operator;
    return op === KindPlusPlusToken || op === KindMinusMinusToken;
  }
  if (IsPostfixUnaryExpression(node)) {
    const op = AsPostfixUnaryExpression(node)!.Operator;
    return op === KindPlusPlusToken || op === KindMinusMinusToken;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.getOriginalIfFunctionLike","kind":"method","status":"implemented","sigHash":"309d9131bb13e0105a92ff38dd33fff8f4ac8b7a0efd540fbc49ec3201fdfa44","bodyHash":"8e894e6db5500bca4c94f1197752f497ab1dd857eb824b40418ed7764d49974c"}
 *
 * Go source:
 * func (tx *asyncTransformer) getOriginalIfFunctionLike(node *ast.Node) *ast.Node {
 * 	original := tx.EmitContext().MostOriginal(node)
 * 	if original != nil && ast.IsFunctionLikeDeclaration(original) {
 * 		return original
 * 	}
 * 	return node
 * }
 */
export function asyncTransformer_getOriginalIfFunctionLike(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const original = EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node);
  if (original !== undefined && IsFunctionLikeDeclaration(original)) {
    return original;
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::func::isSimpleParameterList","kind":"func","status":"implemented","sigHash":"aafb3df834aa6d85e376f550bb3c61bfc9e3918a9c9e5cf3e09fbc4b5aabc26c","bodyHash":"a93795926ac598af8707176a01ea63ed7bd8f5155ea0096c72bd00ee62201d14"}
 *
 * Go source:
 * func isSimpleParameterList(params []*ast.Node) bool {
 * 	for _, param := range params {
 * 		p := param.AsParameterDeclaration()
 * 		if p.Initializer != nil || !ast.IsIdentifier(p.Name()) {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function isSimpleParameterList(params: GoSlice<GoPtr<Node>>): bool {
  for (const param of params ?? []) {
    const p = AsParameterDeclaration(param)!;
    if (p.Initializer !== undefined || !IsIdentifier(p.name)) {
      return false;
    }
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::func::isNodeWithPossibleHoistedDeclaration","kind":"func","status":"implemented","sigHash":"e096224ef1039d8f842eebf23aeb04859cfc5662a4f0db7bbaf0bd7e50e06833","bodyHash":"eee43a2b9f9d39c1518aee2e62ebc01f20fd88b8de63801862de480b0d1173ee"}
 *
 * Go source:
 * func isNodeWithPossibleHoistedDeclaration(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindBlock,
 * 		ast.KindVariableStatement,
 * 		ast.KindWithStatement,
 * 		ast.KindIfStatement,
 * 		ast.KindSwitchStatement,
 * 		ast.KindCaseBlock,
 * 		ast.KindCaseClause,
 * 		ast.KindDefaultClause,
 * 		ast.KindLabeledStatement,
 * 		ast.KindForStatement,
 * 		ast.KindForInStatement,
 * 		ast.KindForOfStatement,
 * 		ast.KindDoStatement,
 * 		ast.KindWhileStatement,
 * 		ast.KindTryStatement,
 * 		ast.KindCatchClause:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function isNodeWithPossibleHoistedDeclaration(node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindBlock:
    case KindVariableStatement:
    case KindWithStatement:
    case KindIfStatement:
    case KindSwitchStatement:
    case KindCaseBlock:
    case KindCaseClause:
    case KindDefaultClause:
    case KindLabeledStatement:
    case KindForStatement:
    case KindForInStatement:
    case KindForOfStatement:
    case KindDoStatement:
    case KindWhileStatement:
    case KindTryStatement:
    case KindCatchClause:
      return true;
  }
  return false;
}
