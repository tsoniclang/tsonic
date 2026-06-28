import type { bool, int } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Node, NodeList, NodeVisitor } from "../../ast/spine.js";
import type { SourceFile } from "../../ast/ast.js";
import type { AwaitExpression, CatchClause, ForInOrOfStatement, ForStatement, VariableDeclaration, VariableDeclarationList } from "../../ast/generated/data.js";
import type { IdentifierNode } from "../../ast/generated/unions.js";
import type { Set } from "../../collections/set.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import type { superAccessState } from "./utilities.js";
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
export declare const asyncContextNonTopLevel: asyncContextFlags;
export declare const asyncContextHasLexicalThis: asyncContextFlags;
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
export declare function newAsyncTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer>;
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
export declare function asyncTransformer_visitSourceFile(receiver: GoPtr<asyncTransformer>, node: GoPtr<SourceFile>): GoPtr<Node>;
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
export declare function asyncTransformer_setContextFlag(receiver: GoPtr<asyncTransformer>, flag: asyncContextFlags, val: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.inContext","kind":"method","status":"implemented","sigHash":"731c55ea44c2d9b30523d888b9bb3eb5be30e33ac1f58eaeffc5b3c6788e852d","bodyHash":"8b759be86e0e7af82af34c127987c9941894221242158b34c70557c42ec745fe"}
 *
 * Go source:
 * func (tx *asyncTransformer) inContext(flags asyncContextFlags) bool {
 * 	return tx.contextFlags&flags != 0
 * }
 */
export declare function asyncTransformer_inContext(receiver: GoPtr<asyncTransformer>, flags: asyncContextFlags): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.inTopLevelContext","kind":"method","status":"implemented","sigHash":"024d93ab1f72884018fe750a021afcb67757f8df7224783a54acb446b2b0b6be","bodyHash":"ad7fb68a5b4b36017ac87f19d4dc7b6e76233d640692ab0b601c042945ab0427"}
 *
 * Go source:
 * func (tx *asyncTransformer) inTopLevelContext() bool {
 * 	return !tx.inContext(asyncContextNonTopLevel)
 * }
 */
export declare function asyncTransformer_inTopLevelContext(receiver: GoPtr<asyncTransformer>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.inHasLexicalThisContext","kind":"method","status":"implemented","sigHash":"b966b271b826b2f604ca6d9703f5d120fd63e0a5e12d0274b3446feea6f23273","bodyHash":"a6ba6d48e4eb80b8746c0934646ccb5989b28da7778d3b7f4b5c138d843e6637"}
 *
 * Go source:
 * func (tx *asyncTransformer) inHasLexicalThisContext() bool {
 * 	return tx.inContext(asyncContextHasLexicalThis)
 * }
 */
export declare function asyncTransformer_inHasLexicalThisContext(receiver: GoPtr<asyncTransformer>): bool;
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
export declare function asyncTransformer_doWithContext(receiver: GoPtr<asyncTransformer>, flags: asyncContextFlags, cb: (arg0: GoPtr<asyncTransformer>, arg1: GoPtr<Node>) => GoPtr<Node>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitDefault","kind":"method","status":"implemented","sigHash":"511101962b66551d6d256dabac810a8f1eb632094ce5c1e973d3da2779467865","bodyHash":"e834878ec9a876f0c22db21884b7650c0391375df688a3b3962b7bbc63f6a64e"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitDefault(node *ast.Node) *ast.Node {
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function asyncTransformer_visitDefault(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function asyncTransformer_fallbackVisitor(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/async.go::method::asyncTransformer.visitFallback","kind":"method","status":"implemented","sigHash":"0bf71532f8917e36dd2d23563f04a9bb55cb6b3dea35017b8a143499c848ccc9","bodyHash":"754a1ea439dbbb9a6a0d9362e815bd90875bb0530a78812a4f34b3bb2f8d26e6"}
 *
 * Go source:
 * func (tx *asyncTransformer) visitFallback(node *ast.Node) *ast.Node {
 * 	return tx.fallbackVisitor(node)
 * }
 */
export declare function asyncTransformer_visitFallback(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function asyncTransformer_visit(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function asyncTransformer_visitAsyncBodyNode(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function asyncTransformer_visitCatchClauseInAsyncBody(receiver: GoPtr<asyncTransformer>, node: GoPtr<CatchClause>): GoPtr<Node>;
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
export declare function asyncTransformer_visitVariableStatementInAsyncBody(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function asyncTransformer_visitForInStatementInAsyncBody(receiver: GoPtr<asyncTransformer>, node: GoPtr<ForInOrOfStatement>): GoPtr<Node>;
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
export declare function asyncTransformer_visitForOfStatementInAsyncBody(receiver: GoPtr<asyncTransformer>, node: GoPtr<ForInOrOfStatement>): GoPtr<Node>;
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
export declare function asyncTransformer_visitForStatementInAsyncBody(receiver: GoPtr<asyncTransformer>, node: GoPtr<ForStatement>): GoPtr<Node>;
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
export declare function asyncTransformer_visitAwaitExpression(receiver: GoPtr<asyncTransformer>, node: GoPtr<AwaitExpression>): GoPtr<Node>;
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
export declare function asyncTransformer_visitConstructorDeclaration(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function asyncTransformer_visitMethodDeclaration(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function asyncTransformer_visitGetAccessorDeclaration(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function asyncTransformer_visitSetAccessorDeclaration(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function asyncTransformer_visitFunctionDeclaration(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function asyncTransformer_visitFunctionExpression(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function asyncTransformer_visitArrowFunction(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function asyncTransformer_recordDeclarationName(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>, names: GoPtr<Set<string>>): void;
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
export declare function asyncTransformer_isVariableDeclarationListWithCollidingName(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): bool;
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
export declare function asyncTransformer_visitVariableDeclarationListWithCollidingNames(receiver: GoPtr<asyncTransformer>, node: GoPtr<VariableDeclarationList>, hasReceiver: bool): GoPtr<Node>;
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
export declare function asyncTransformer_hoistVariableDeclarationList(receiver: GoPtr<asyncTransformer>, node: GoPtr<VariableDeclarationList>): void;
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
export declare function asyncTransformer_hoistVariable(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): void;
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
export declare function asyncTransformer_transformInitializedVariable(receiver: GoPtr<asyncTransformer>, node: GoPtr<VariableDeclaration>): GoPtr<Node>;
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
export declare function asyncTransformer_collidesWithParameterName(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): bool;
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
export declare function asyncTransformer_transformMethodBody(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function asyncTransformer_createCaptureArgumentsStatement(receiver: GoPtr<asyncTransformer>): GoPtr<Node>;
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
export declare function asyncTransformer_transformAsyncFunctionParameterList(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<NodeList>;
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
export declare function asyncTransformer_transformAsyncFunctionBody(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>, outerParameters: GoPtr<NodeList>): GoPtr<Node>;
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
export declare function asyncTransformer_transformAsyncFunctionBodyWorker(receiver: GoPtr<asyncTransformer>, body: GoPtr<Node>): GoPtr<Node>;
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
export declare function asyncTransformer_convertToFunctionBlock(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function assignmentTargetContainsSuperProperty(node: GoPtr<Node>): bool;
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
export declare function isUpdateExpression(node: GoPtr<Node>): bool;
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
export declare function asyncTransformer_getOriginalIfFunctionLike(receiver: GoPtr<asyncTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function isSimpleParameterList(params: GoSlice<GoPtr<Node>>): bool;
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
export declare function isNodeWithPossibleHoistedDeclaration(node: GoPtr<Node>): bool;
//# sourceMappingURL=async.d.ts.map