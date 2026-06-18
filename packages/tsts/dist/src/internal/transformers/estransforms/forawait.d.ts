import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr } from "../../../go/compat.js";
import type { ModifierList, Node, NodeList, NodeVisitor } from "../../ast/spine.js";
import type { SourceFile } from "../../ast/ast.js";
import type { AwaitExpression, ForInOrOfStatement, LabeledStatement, ReturnStatement, YieldExpression } from "../../ast/generated/data.js";
import type { FunctionFlags } from "../../ast/functionflags.js";
import type { CompilerOptions } from "../../core/compileroptions.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import type { superAccessState } from "./utilities.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::type::forAwaitHierarchyFacts","kind":"type","status":"implemented","sigHash":"89f2a13d454fc30fc2e581b3a64d8e6613f0c8304132aa4c7f38bf9964ca1d3a","bodyHash":"74a7859468c019889c9ce9acb2e9dbcd44fb07f6d451f381feab8893f24a4446"}
 *
 * Go source:
 * forAwaitHierarchyFacts int
 */
export type forAwaitHierarchyFacts = int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::constGroup::forAwaitHierarchyFactsNone","kind":"constGroup","status":"implemented","sigHash":"743dd206be10af7169e2b2ca6b556c4257ea5790895c905342579f7cc4d2ccaa","bodyHash":"833b450ae54d846d568ec89b83598ed0994efe84f22237cf4e1d32805f43c915"}
 *
 * Go source:
 * const forAwaitHierarchyFactsNone forAwaitHierarchyFacts = 0
 */
export declare const forAwaitHierarchyFactsNone: forAwaitHierarchyFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::constGroup::forAwaitHierarchyFactsHasLexicalThis+forAwaitHierarchyFactsIterationContainer+forAwaitHierarchyFactsAncestorFactsMask+forAwaitHierarchyFactsSourceFileExcludes+forAwaitHierarchyFactsStrictModeSourceFileIncludes+forAwaitHierarchyFactsClassOrFunctionIncludes+forAwaitHierarchyFactsClassOrFunctionExcludes+forAwaitHierarchyFactsArrowFunctionIncludes+forAwaitHierarchyFactsArrowFunctionExcludes+forAwaitHierarchyFactsIterationStatementIncludes+forAwaitHierarchyFactsIterationStatementExcludes","kind":"constGroup","status":"implemented","sigHash":"e20f751ad09391b355fd7413892a212380165eb40f010565639d7fc4d3fedba0","bodyHash":"722db9223e0d817be78fd04ac24d99b16719204abff5131afaa26956e2701c3c"}
 *
 * Go source:
 * const (
 * 	//
 * 	// Ancestor facts
 * 	//
 *
 * 	forAwaitHierarchyFactsHasLexicalThis forAwaitHierarchyFacts = 1 << iota
 * 	forAwaitHierarchyFactsIterationContainer
 *
 * 	//
 * 	// Ancestor masks
 * 	//
 *
 * 	forAwaitHierarchyFactsAncestorFactsMask = 1<<iota - 1
 *
 * 	forAwaitHierarchyFactsSourceFileExcludes           = forAwaitHierarchyFactsIterationContainer
 * 	forAwaitHierarchyFactsStrictModeSourceFileIncludes = forAwaitHierarchyFactsNone
 *
 * 	forAwaitHierarchyFactsClassOrFunctionIncludes = forAwaitHierarchyFactsHasLexicalThis
 * 	forAwaitHierarchyFactsClassOrFunctionExcludes = forAwaitHierarchyFactsIterationContainer
 *
 * 	forAwaitHierarchyFactsArrowFunctionIncludes = forAwaitHierarchyFactsNone
 * 	forAwaitHierarchyFactsArrowFunctionExcludes = forAwaitHierarchyFactsClassOrFunctionExcludes
 *
 * 	forAwaitHierarchyFactsIterationStatementIncludes = forAwaitHierarchyFactsIterationContainer
 * 	forAwaitHierarchyFactsIterationStatementExcludes = forAwaitHierarchyFactsNone
 * )
 */
export declare const forAwaitHierarchyFactsHasLexicalThis: forAwaitHierarchyFacts;
export declare const forAwaitHierarchyFactsIterationContainer: forAwaitHierarchyFacts;
export declare const forAwaitHierarchyFactsAncestorFactsMask: int;
export declare const forAwaitHierarchyFactsSourceFileExcludes: forAwaitHierarchyFacts;
export declare const forAwaitHierarchyFactsStrictModeSourceFileIncludes: forAwaitHierarchyFacts;
export declare const forAwaitHierarchyFactsClassOrFunctionIncludes: forAwaitHierarchyFacts;
export declare const forAwaitHierarchyFactsClassOrFunctionExcludes: forAwaitHierarchyFacts;
export declare const forAwaitHierarchyFactsArrowFunctionIncludes: forAwaitHierarchyFacts;
export declare const forAwaitHierarchyFactsArrowFunctionExcludes: forAwaitHierarchyFacts;
export declare const forAwaitHierarchyFactsIterationStatementIncludes: forAwaitHierarchyFacts;
export declare const forAwaitHierarchyFactsIterationStatementExcludes: forAwaitHierarchyFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::type::forawaitTransformer","kind":"type","status":"implemented","sigHash":"74b099c5f784cd0dc4b6903480b7f1adb0f61b2ae0834037fa6c0542fc3ba5bd","bodyHash":"85f20d7e8c3215d64829184a754d4829c59e0226dc5b95052ffded5076ef1ee0"}
 *
 * Go source:
 * forawaitTransformer struct {
 * 	transformers.Transformer
 * 	superAccessState
 * 	compilerOptions *core.CompilerOptions
 *
 * 	enclosingFunctionFlags    ast.FunctionFlags
 * 	forAwaitHierarchyFacts    forAwaitHierarchyFacts
 * 	exportedVariableStatement bool
 *
 * 	fallbackNodeVisitor    *ast.NodeVisitor
 * 	noAsyncModifierVisitor *ast.NodeVisitor
 * }
 */
export interface forawaitTransformer {
    readonly __tsgoEmbedded0?: Transformer;
    readonly __tsgoEmbedded1?: superAccessState;
    compilerOptions: GoPtr<CompilerOptions>;
    enclosingFunctionFlags: FunctionFlags;
    forAwaitHierarchyFacts: forAwaitHierarchyFacts;
    exportedVariableStatement: bool;
    fallbackNodeVisitor: GoPtr<NodeVisitor>;
    noAsyncModifierVisitor: GoPtr<NodeVisitor>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::func::newforawaitTransformer","kind":"func","status":"implemented","sigHash":"9b8ab282cb69b46cd28f0af038d8d664d988dc0ebc568c8fc57fddc1bfe7626c","bodyHash":"7fc9333cc865232603ea4660491df340b98227ff22d1d3782b7a14f4fdb4fbac"}
 *
 * Go source:
 * func newforawaitTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &forawaitTransformer{
 * 		compilerOptions: opts.CompilerOptions,
 * 	}
 * 	result := tx.NewTransformer(tx.visit, opts.Context)
 * 	tx.initSuperAccessVisitor(tx.EmitContext(), tx.Factory())
 * 	tx.fallbackNodeVisitor = tx.EmitContext().NewNodeVisitor(tx.visitFallback)
 * 	tx.noAsyncModifierVisitor = tx.EmitContext().NewNodeVisitor(func(node *ast.Node) *ast.Node {
 * 		if node.Kind == ast.KindAsyncKeyword {
 * 			return nil
 * 		}
 * 		return node
 * 	})
 * 	return result
 * }
 */
export declare function newforawaitTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.affectsSubtree","kind":"method","status":"implemented","sigHash":"76e6c92285d4cb71be23ed97488a944dfe8c81ce15926a54624c3f0c140763e2","bodyHash":"c879cb5f936811a06d83a29e88cf9e6dc81fb42520c47081eba5cd1fba89e8ef"}
 *
 * Go source:
 * func (tx *forawaitTransformer) affectsSubtree(excludeFacts forAwaitHierarchyFacts, includeFacts forAwaitHierarchyFacts) bool {
 * 	return tx.forAwaitHierarchyFacts != (tx.forAwaitHierarchyFacts&^excludeFacts | includeFacts)
 * }
 */
export declare function forawaitTransformer_affectsSubtree(receiver: GoPtr<forawaitTransformer>, excludeFacts: forAwaitHierarchyFacts, includeFacts: forAwaitHierarchyFacts): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.enterSubtree","kind":"method","status":"implemented","sigHash":"74deceb2ecc6edd54ab978004d35fe5d74ded2753cf8c26891b4dca1a2ec3af7","bodyHash":"604e1f7c3e1fbead5057f53a79a8a75da4664ab90b7722f77316dfae6e02d8cb"}
 *
 * Go source:
 * func (tx *forawaitTransformer) enterSubtree(excludeFacts forAwaitHierarchyFacts, includeFacts forAwaitHierarchyFacts) forAwaitHierarchyFacts {
 * 	ancestorFacts := tx.forAwaitHierarchyFacts
 * 	tx.forAwaitHierarchyFacts = (tx.forAwaitHierarchyFacts&^excludeFacts | includeFacts) & forAwaitHierarchyFactsAncestorFactsMask
 * 	return ancestorFacts
 * }
 */
export declare function forawaitTransformer_enterSubtree(receiver: GoPtr<forawaitTransformer>, excludeFacts: forAwaitHierarchyFacts, includeFacts: forAwaitHierarchyFacts): forAwaitHierarchyFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.exitSubtree","kind":"method","status":"implemented","sigHash":"24e9a4e6e8594ef2f7477e8baa982bd70b14b61cd194e38db39b8dac89393879","bodyHash":"2ef16831e21930b18952bd6c939a79bfb66bf08bc6c42c12c0502c711a470899"}
 *
 * Go source:
 * func (tx *forawaitTransformer) exitSubtree(ancestorFacts forAwaitHierarchyFacts) {
 * 	tx.forAwaitHierarchyFacts = ancestorFacts
 * }
 */
export declare function forawaitTransformer_exitSubtree(receiver: GoPtr<forawaitTransformer>, ancestorFacts: forAwaitHierarchyFacts): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitModifiersNoAsync","kind":"method","status":"implemented","sigHash":"af42efb4c1654341cc38b8246bb8a65e1c9d72f64edfa2d646aa3fe13824e010","bodyHash":"cb74dce23d3964873539637f8aa1df7d39ca211542899d734d0fbd57cc700b2d"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitModifiersNoAsync(modifiers *ast.ModifierList) *ast.ModifierList {
 * 	return tx.noAsyncModifierVisitor.VisitModifiers(modifiers)
 * }
 */
export declare function forawaitTransformer_visitModifiersNoAsync(receiver: GoPtr<forawaitTransformer>, modifiers: GoPtr<ModifierList>): GoPtr<ModifierList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.doWithHierarchyFacts","kind":"method","status":"implemented","sigHash":"5663a1b827a325a42b388135bb0947710d30814985de98325f0972980c70c1c1","bodyHash":"e14109d0365f607f8e58020d082929f1026e37c820d6372ff698754878adb205"}
 *
 * Go source:
 * func (tx *forawaitTransformer) doWithHierarchyFacts(cb func(*forawaitTransformer, *ast.Node) *ast.Node, node *ast.Node, excludeFacts forAwaitHierarchyFacts, includeFacts forAwaitHierarchyFacts) *ast.Node {
 * 	if tx.affectsSubtree(excludeFacts, includeFacts) {
 * 		ancestorFacts := tx.enterSubtree(excludeFacts, includeFacts)
 * 		result := cb(tx, node)
 * 		tx.exitSubtree(ancestorFacts)
 * 		return result
 * 	}
 * 	return cb(tx, node)
 * }
 */
export declare function forawaitTransformer_doWithHierarchyFacts(receiver: GoPtr<forawaitTransformer>, cb: (arg0: GoPtr<forawaitTransformer>, arg1: GoPtr<Node>) => GoPtr<Node>, node: GoPtr<Node>, excludeFacts: forAwaitHierarchyFacts, includeFacts: forAwaitHierarchyFacts): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitDefault","kind":"method","status":"implemented","sigHash":"5aaf3bffebf6d6156dd4ecf8bf71c7f235473d9a2ec60621b328d2bd0052fd36","bodyHash":"b7998168d3b94d2b014776ee639b2b9a05fc37f4af61912daecf3f1188abdc51"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitDefault(node *ast.Node) *ast.Node {
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function forawaitTransformer_visitDefault(receiver: GoPtr<forawaitTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.fallbackVisitor","kind":"method","status":"implemented","sigHash":"448b30665c5e497e06b7a318262d177e5223b3d0bbd12b7998c759cbb24f82dd","bodyHash":"a0df4d6812439d6f1910d40e81443738d53e232420378010c8e67c1e88ef2e65"}
 *
 * Go source:
 * func (tx *forawaitTransformer) fallbackVisitor(node *ast.Node) *ast.Node {
 * 	if tx.capturedSuperProperties == nil {
 * 		return node
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindFunctionExpression, ast.KindFunctionDeclaration,
 * 		ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor,
 * 		ast.KindConstructor:
 * 		return node
 * 	}
 * 	tx.trackSuperAccess(node)
 * 	return tx.fallbackNodeVisitor.VisitEachChild(node)
 * }
 */
export declare function forawaitTransformer_fallbackVisitor(receiver: GoPtr<forawaitTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitFallback","kind":"method","status":"implemented","sigHash":"f0a33e6dba4716be40aa58f337a0cebfe51a54897fe625c9c0bf63c1429a754c","bodyHash":"4a233df46c52aa6c714e9643035c7fc957240501eefc4657816ed7c9a6e393ed"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitFallback(node *ast.Node) *ast.Node {
 * 	return tx.fallbackVisitor(node)
 * }
 */
export declare function forawaitTransformer_visitFallback(receiver: GoPtr<forawaitTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visit","kind":"method","status":"implemented","sigHash":"fa781b076800220a8d835c1ba582cb6a6d2041037efd9581734fa7b94cd925c7","bodyHash":"dcdb1c7694d3c079a3239d10b3237360580bd121e890ce6aea542e9f48f6b5f3"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.SubtreeFacts()&ast.SubtreeContainsForAwaitOrAsyncGenerator == 0 {
 * 		return tx.fallbackVisitor(node)
 * 	}
 * 	tx.trackSuperAccess(node)
 * 	switch node.Kind {
 * 	case ast.KindSourceFile:
 * 		return tx.visitSourceFile(node.AsSourceFile())
 * 	case ast.KindAwaitExpression:
 * 		return tx.visitAwaitExpression(node.AsAwaitExpression())
 * 	case ast.KindYieldExpression:
 * 		return tx.visitYieldExpression(node.AsYieldExpression())
 * 	case ast.KindReturnStatement:
 * 		return tx.visitReturnStatement(node.AsReturnStatement())
 * 	case ast.KindLabeledStatement:
 * 		return tx.visitLabeledStatement(node.AsLabeledStatement())
 * 	case ast.KindDoStatement, ast.KindWhileStatement, ast.KindForInStatement:
 * 		return tx.doWithHierarchyFacts(
 * 			(*forawaitTransformer).visitDefault,
 * 			node,
 * 			forAwaitHierarchyFactsIterationStatementExcludes,
 * 			forAwaitHierarchyFactsIterationStatementIncludes,
 * 		)
 * 	case ast.KindForOfStatement:
 * 		return tx.visitForOfStatement(node.AsForInOrOfStatement(), nil)
 * 	case ast.KindForStatement:
 * 		return tx.doWithHierarchyFacts(
 * 			(*forawaitTransformer).visitDefault,
 * 			node,
 * 			forAwaitHierarchyFactsIterationStatementExcludes,
 * 			forAwaitHierarchyFactsIterationStatementIncludes,
 * 		)
 * 	case ast.KindConstructor:
 * 		return tx.doWithHierarchyFacts(
 * 			(*forawaitTransformer).visitConstructorDeclaration,
 * 			node,
 * 			forAwaitHierarchyFactsClassOrFunctionExcludes,
 * 			forAwaitHierarchyFactsClassOrFunctionIncludes,
 * 		)
 * 	case ast.KindMethodDeclaration:
 * 		return tx.doWithHierarchyFacts(
 * 			(*forawaitTransformer).visitMethodDeclaration,
 * 			node,
 * 			forAwaitHierarchyFactsClassOrFunctionExcludes,
 * 			forAwaitHierarchyFactsClassOrFunctionIncludes,
 * 		)
 * 	case ast.KindGetAccessor:
 * 		return tx.doWithHierarchyFacts(
 * 			(*forawaitTransformer).visitGetAccessorDeclaration,
 * 			node,
 * 			forAwaitHierarchyFactsClassOrFunctionExcludes,
 * 			forAwaitHierarchyFactsClassOrFunctionIncludes,
 * 		)
 * 	case ast.KindSetAccessor:
 * 		return tx.doWithHierarchyFacts(
 * 			(*forawaitTransformer).visitSetAccessorDeclaration,
 * 			node,
 * 			forAwaitHierarchyFactsClassOrFunctionExcludes,
 * 			forAwaitHierarchyFactsClassOrFunctionIncludes,
 * 		)
 * 	case ast.KindFunctionDeclaration:
 * 		return tx.doWithHierarchyFacts(
 * 			(*forawaitTransformer).visitFunctionDeclaration,
 * 			node,
 * 			forAwaitHierarchyFactsClassOrFunctionExcludes,
 * 			forAwaitHierarchyFactsClassOrFunctionIncludes,
 * 		)
 * 	case ast.KindFunctionExpression:
 * 		return tx.doWithHierarchyFacts(
 * 			(*forawaitTransformer).visitFunctionExpression,
 * 			node,
 * 			forAwaitHierarchyFactsClassOrFunctionExcludes,
 * 			forAwaitHierarchyFactsClassOrFunctionIncludes,
 * 		)
 * 	case ast.KindArrowFunction:
 * 		return tx.doWithHierarchyFacts(
 * 			(*forawaitTransformer).visitArrowFunction,
 * 			node,
 * 			forAwaitHierarchyFactsArrowFunctionExcludes,
 * 			forAwaitHierarchyFactsArrowFunctionIncludes,
 * 		)
 * 	case ast.KindClassDeclaration, ast.KindClassExpression:
 * 		return tx.doWithHierarchyFacts(
 * 			(*forawaitTransformer).visitDefault,
 * 			node,
 * 			forAwaitHierarchyFactsClassOrFunctionExcludes,
 * 			forAwaitHierarchyFactsClassOrFunctionIncludes,
 * 		)
 * 	default:
 * 		return tx.Visitor().VisitEachChild(node)
 * 	}
 * }
 */
export declare function forawaitTransformer_visit(receiver: GoPtr<forawaitTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitAwaitExpression","kind":"method","status":"implemented","sigHash":"58e790692819e11ec611a4dc68808a6ffde0f04fcaf4c891cc9227f0976756df","bodyHash":"e92d25e42bd32376210aa851028e20f29cc1621e35a48c75f382866eda15fe3d"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitAwaitExpression(node *ast.AwaitExpression) *ast.Node {
 * 	if tx.enclosingFunctionFlags&ast.FunctionFlagsAsync != 0 && tx.enclosingFunctionFlags&ast.FunctionFlagsGenerator != 0 {
 * 		result := tx.Factory().NewYieldExpression(
 * 			nil, /*asteriskToken* /
 * 			tx.Factory().NewAwaitHelper(tx.Visitor().VisitNode(node.Expression)),
 * 		)
 * 		result.Loc = node.Loc
 * 		tx.EmitContext().SetOriginal(result, node.AsNode())
 * 		return result
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function forawaitTransformer_visitAwaitExpression(receiver: GoPtr<forawaitTransformer>, node: GoPtr<AwaitExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitYieldExpression","kind":"method","status":"implemented","sigHash":"516265a56fa8e691b50c9bad383dcde86324b3ec29aeb81ef21831c799828bbb","bodyHash":"4c751dfcf433ff126c1d19811ee8015b66ffc48543020a003b5395da3bbb4bf9"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitYieldExpression(node *ast.YieldExpression) *ast.Node {
 * 	if tx.enclosingFunctionFlags&ast.FunctionFlagsAsync != 0 && tx.enclosingFunctionFlags&ast.FunctionFlagsGenerator != 0 {
 * 		if node.AsteriskToken != nil {
 * 			expression := tx.Visitor().VisitNode(node.Expression)
 *
 * 			asyncValuesResult := tx.Factory().NewAsyncValuesHelper(expression)
 * 			asyncValuesResult.Loc = expression.Loc
 *
 * 			asyncDelegatorResult := tx.Factory().NewAsyncDelegatorHelper(asyncValuesResult)
 * 			asyncDelegatorResult.Loc = expression.Loc
 *
 * 			innerYield := tx.Factory().UpdateYieldExpression(
 * 				node,
 * 				node.AsteriskToken,
 * 				asyncDelegatorResult,
 * 			)
 *
 * 			awaitedYield := tx.Factory().NewAwaitHelper(innerYield)
 *
 * 			result := tx.Factory().NewYieldExpression(
 * 				nil, /*asteriskToken* /
 * 				awaitedYield,
 * 			)
 * 			result.Loc = node.Loc
 * 			tx.EmitContext().SetOriginal(result, node.AsNode())
 * 			return result
 * 		}
 *
 * 		var innerExpression *ast.Node
 * 		if node.Expression != nil {
 * 			innerExpression = tx.Visitor().VisitNode(node.Expression)
 * 		} else {
 * 			innerExpression = tx.Factory().NewVoidZeroExpression()
 * 		}
 *
 * 		result := tx.Factory().NewYieldExpression(
 * 			nil, /*asteriskToken* /
 * 			tx.createDownlevelAwait(innerExpression),
 * 		)
 * 		result.Loc = node.Loc
 * 		tx.EmitContext().SetOriginal(result, node.AsNode())
 * 		return result
 * 	}
 *
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function forawaitTransformer_visitYieldExpression(receiver: GoPtr<forawaitTransformer>, node: GoPtr<YieldExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitReturnStatement","kind":"method","status":"implemented","sigHash":"90e54760810dbf219145c72cb8ca0d2bf3e49fd2c44043adbd66e31477413f74","bodyHash":"ad79c943c75924cf1f9f6d653caae653cca9ee10f9aafaefce50c3550d92c29a"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitReturnStatement(node *ast.ReturnStatement) *ast.Node {
 * 	if tx.enclosingFunctionFlags&ast.FunctionFlagsAsync != 0 && tx.enclosingFunctionFlags&ast.FunctionFlagsGenerator != 0 {
 * 		var expression *ast.Node
 * 		if node.Expression != nil {
 * 			expression = tx.Visitor().VisitNode(node.Expression)
 * 		} else {
 * 			expression = tx.Factory().NewVoidZeroExpression()
 * 		}
 * 		return tx.Factory().UpdateReturnStatement(
 * 			node,
 * 			tx.createDownlevelAwait(expression),
 * 		)
 * 	}
 *
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function forawaitTransformer_visitReturnStatement(receiver: GoPtr<forawaitTransformer>, node: GoPtr<ReturnStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitLabeledStatement","kind":"method","status":"implemented","sigHash":"c47a01e51c5de6d99e9037e57693768c4eb996cf9de1f8bbef7e68a2243d0be6","bodyHash":"dcccee1d0454c76018f1a957389d1b1d81ef69846139f43484c283b989220755"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitLabeledStatement(node *ast.LabeledStatement) *ast.Node {
 * 	if tx.enclosingFunctionFlags&ast.FunctionFlagsAsync != 0 {
 * 		statement := unwrapInnermostStatementOfLabel(node)
 * 		if statement.Kind == ast.KindForOfStatement && statement.AsForInOrOfStatement().AwaitModifier != nil {
 * 			return tx.visitForOfStatement(statement.AsForInOrOfStatement(), node)
 * 		}
 * 		return tx.Factory().RestoreEnclosingLabel(tx.Visitor().VisitNode(statement), node)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function forawaitTransformer_visitLabeledStatement(receiver: GoPtr<forawaitTransformer>, node: GoPtr<LabeledStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::func::unwrapInnermostStatementOfLabel","kind":"func","status":"implemented","sigHash":"ef81b7da32e71f60f0e66cc6482c4be2df333ef1d60df9e0c4015ec52c2601fd","bodyHash":"ab7f83a5260a02547930cc6c72d4db55eef2e358e1124a2dc2242dfed6c9a842"}
 *
 * Go source:
 * func unwrapInnermostStatementOfLabel(node *ast.LabeledStatement) *ast.Node {
 * 	for {
 * 		if node.Statement.Kind != ast.KindLabeledStatement {
 * 			return node.Statement
 * 		}
 * 		node = node.Statement.AsLabeledStatement()
 * 	}
 * }
 */
export declare function unwrapInnermostStatementOfLabel(node: GoPtr<LabeledStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitSourceFile","kind":"method","status":"implemented","sigHash":"81f2fe063999736dc3574324128d48e9cf46849897977e24473fb3c5100041fe","bodyHash":"b8fe4b288aa94dbbd9430a7ef39a18335a50d4ce8c3ae7a13f1edbfa63790cff"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitSourceFile(node *ast.SourceFile) *ast.Node {
 * 	ancestorFacts := tx.enterSubtree(
 * 		forAwaitHierarchyFactsSourceFileExcludes,
 * 		forAwaitHierarchyFactsStrictModeSourceFileIncludes,
 * 	)
 * 	tx.exportedVariableStatement = false
 * 	visited := tx.Visitor().VisitEachChild(node.AsNode())
 * 	tx.EmitContext().AddEmitHelper(visited, tx.EmitContext().ReadEmitHelpers()...)
 * 	tx.exitSubtree(ancestorFacts)
 * 	return visited
 * }
 */
export declare function forawaitTransformer_visitSourceFile(receiver: GoPtr<forawaitTransformer>, node: GoPtr<SourceFile>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitForOfStatement","kind":"method","status":"implemented","sigHash":"a1398a3acc7c58354bfa198fe3be639b681d7c75a8e6a85d3f805367d00c5068","bodyHash":"0f85697196489795918de6b16d4bce25763f610cea23eba55a8c1165b101afe7"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitForOfStatement(node *ast.ForInOrOfStatement, outermostLabeledStatement *ast.LabeledStatement) *ast.Node {
 * 	ancestorFacts := tx.enterSubtree(forAwaitHierarchyFactsIterationStatementExcludes, forAwaitHierarchyFactsIterationStatementIncludes)
 * 	var result *ast.Node
 * 	if node.AwaitModifier != nil {
 * 		result = tx.transformForAwaitOfStatement(node, outermostLabeledStatement, ancestorFacts)
 * 	} else {
 * 		result = tx.Factory().RestoreEnclosingLabel(tx.Visitor().VisitEachChild(node.AsNode()), outermostLabeledStatement)
 * 	}
 * 	tx.exitSubtree(ancestorFacts)
 * 	return result
 * }
 */
export declare function forawaitTransformer_visitForOfStatement(receiver: GoPtr<forawaitTransformer>, node: GoPtr<ForInOrOfStatement>, outermostLabeledStatement: GoPtr<LabeledStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.convertForOfStatementHead","kind":"method","status":"implemented","sigHash":"a6f9a0657f1a2fe7f2e2da38c6279f20b42b1ea6383b3631f0598aba4b81b650","bodyHash":"102a7f567221df7a226d6a8d1748537fd442835e4c7f344595957590b2482b85"}
 *
 * Go source:
 * func (tx *forawaitTransformer) convertForOfStatementHead(node *ast.ForInOrOfStatement, boundValue *ast.Node, nonUserCode *ast.Node) *ast.Node {
 * 	f := tx.Factory()
 * 	value := f.NewTempVariable()
 * 	tx.EmitContext().AddVariableDeclaration(value)
 * 	iteratorValueExpression := f.NewAssignmentExpression(value, boundValue)
 * 	iteratorValueStatement := f.NewExpressionStatement(iteratorValueExpression)
 * 	tx.EmitContext().SetSourceMapRange(iteratorValueStatement, node.Expression.Loc)
 *
 * 	exitNonUserCodeExpression := f.NewAssignmentExpression(nonUserCode, f.NewKeywordExpression(ast.KindFalseKeyword))
 * 	exitNonUserCodeStatement := f.NewExpressionStatement(exitNonUserCodeExpression)
 * 	tx.EmitContext().SetSourceMapRange(exitNonUserCodeStatement, node.Expression.Loc)
 *
 * 	statements := []*ast.Node{iteratorValueStatement, exitNonUserCodeStatement}
 * 	binding := tx.Factory().CreateForOfBindingStatement(node.Initializer, value)
 * 	statements = append(statements, tx.Visitor().VisitNode(binding))
 *
 * 	var bodyLocation core.TextRange
 * 	var statementsLocation core.TextRange
 * 	statement := tx.Visitor().VisitEmbeddedStatement(node.Statement)
 * 	if ast.IsBlock(statement) {
 * 		statements = append(statements, statement.Statements()...)
 * 		bodyLocation = statement.Loc
 * 		statementsLocation = statement.StatementList().Loc
 * 	} else {
 * 		statements = append(statements, statement)
 * 	}
 *
 * 	stmtList := f.NewNodeList(statements)
 * 	stmtList.Loc = statementsLocation
 * 	block := f.NewBlock(stmtList, true)
 * 	block.Loc = bodyLocation
 * 	return block
 * }
 */
export declare function forawaitTransformer_convertForOfStatementHead(receiver: GoPtr<forawaitTransformer>, node: GoPtr<ForInOrOfStatement>, boundValue: GoPtr<Node>, nonUserCode: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.createDownlevelAwait","kind":"method","status":"implemented","sigHash":"e04f6503e860b6111e48fdc613be52d29462cd361e7e37f4b18e225dd14ac657","bodyHash":"aae274c113eb5f1fe423d3a52f144306c81ab32b0f5df7b8cb21f1d1cc52b1ed"}
 *
 * Go source:
 * func (tx *forawaitTransformer) createDownlevelAwait(expression *ast.Node) *ast.Node {
 * 	if tx.enclosingFunctionFlags&ast.FunctionFlagsGenerator != 0 {
 * 		return tx.Factory().NewYieldExpression(
 * 			nil, /*asteriskToken* /
 * 			tx.Factory().NewAwaitHelper(expression),
 * 		)
 * 	}
 * 	return tx.Factory().NewAwaitExpression(expression)
 * }
 */
export declare function forawaitTransformer_createDownlevelAwait(receiver: GoPtr<forawaitTransformer>, expression: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.transformForAwaitOfStatement","kind":"method","status":"implemented","sigHash":"9e1798e0d2fc819362d8c1829f537d0137351eaecbe97d08e12920fc2128b4a7","bodyHash":"8fa919ecd24fe6500a64b54bab0bc7920cc9b59462db7b1bdbff1483a1069cad"}
 *
 * Go source:
 * func (tx *forawaitTransformer) transformForAwaitOfStatement(node *ast.ForInOrOfStatement, outermostLabeledStatement *ast.LabeledStatement, ancestorFacts forAwaitHierarchyFacts) *ast.Node {
 * 	f := tx.Factory()
 * 	expression := tx.Visitor().VisitNode(node.Expression)
 *
 * 	var iterator *ast.Node
 * 	if ast.IsIdentifier(expression) {
 * 		iterator = f.NewGeneratedNameForNode(expression)
 * 	} else {
 * 		iterator = f.NewTempVariable()
 * 	}
 *
 * 	var result *ast.Node
 * 	if ast.IsIdentifier(expression) {
 * 		result = f.NewGeneratedNameForNode(iterator)
 * 	} else {
 * 		result = f.NewTempVariable()
 * 	}
 *
 * 	nonUserCode := f.NewTempVariable()
 * 	done := f.NewTempVariable()
 * 	tx.EmitContext().AddVariableDeclaration(done)
 * 	errorRecord := f.NewUniqueName("e")
 * 	catchVariable := f.NewGeneratedNameForNode(errorRecord)
 * 	returnMethod := f.NewTempVariable()
 * 	callValues := f.NewAsyncValuesHelper(expression)
 * 	callValues.Loc = node.Expression.Loc
 * 	callNext := f.NewCallExpression(
 * 		f.NewPropertyAccessExpression(iterator, nil, f.NewIdentifier("next"), ast.NodeFlagsNone),
 * 		nil, nil,
 * 		f.NewNodeList([]*ast.Node{}),
 * 		ast.NodeFlagsNone,
 * 	)
 * 	getDone := f.NewPropertyAccessExpression(result, nil, f.NewIdentifier("done"), ast.NodeFlagsNone)
 * 	getValue := f.NewPropertyAccessExpression(result, nil, f.NewIdentifier("value"), ast.NodeFlagsNone)
 * 	callReturn := f.NewFunctionCallCall(returnMethod, iterator, []*ast.Node{})
 *
 * 	tx.EmitContext().AddVariableDeclaration(errorRecord)
 * 	tx.EmitContext().AddVariableDeclaration(returnMethod)
 *
 * 	// if we are enclosed in an outer loop ensure we reset 'errorRecord' per each iteration
 * 	var initializer *ast.Node
 * 	if ancestorFacts&forAwaitHierarchyFactsIterationContainer != 0 {
 * 		initializer = f.InlineExpressions([]*ast.Node{
 * 			f.NewAssignmentExpression(errorRecord, f.NewVoidZeroExpression()),
 * 			callValues,
 * 		})
 * 	} else {
 * 		initializer = callValues
 * 	}
 *
 * 	// Build the for statement
 * 	iteratorDecl := f.NewVariableDeclaration(iterator, nil, nil, initializer)
 * 	iteratorDecl.Loc = node.Expression.Loc
 * 	varDeclList := f.NewVariableDeclarationList(f.NewNodeList([]*ast.Node{
 * 		f.NewVariableDeclaration(nonUserCode, nil, nil, f.NewKeywordExpression(ast.KindTrueKeyword)),
 * 		iteratorDecl,
 * 		f.NewVariableDeclaration(result, nil, nil, nil),
 * 	}), ast.NodeFlagsNone)
 * 	varDeclList.Loc = node.Expression.Loc
 *
 * 	condition := f.InlineExpressions([]*ast.Node{
 * 		f.NewAssignmentExpression(result, tx.createDownlevelAwait(callNext)),
 * 		f.NewAssignmentExpression(done, getDone),
 * 		f.NewPrefixUnaryExpression(ast.KindExclamationToken, done),
 * 	})
 *
 * 	incrementor := f.NewAssignmentExpression(nonUserCode, f.NewKeywordExpression(ast.KindTrueKeyword))
 *
 * 	forStatement := f.NewForStatement(
 * 		varDeclList,
 * 		condition,
 * 		incrementor,
 * 		tx.convertForOfStatementHead(node, getValue, nonUserCode),
 * 	)
 * 	forStatement.Loc = node.Loc
 * 	tx.EmitContext().AddEmitFlags(forStatement, printer.EFNoTokenTrailingSourceMaps)
 * 	tx.EmitContext().SetOriginal(forStatement, node.AsNode())
 *
 * 	// Build the try/catch/finally
 * 	tryBlock := f.NewBlock(f.NewNodeList([]*ast.Node{
 * 		f.RestoreEnclosingLabel(forStatement, outermostLabeledStatement),
 * 	}), true)
 *
 * 	// catch clause: { e_1 = { error: e_2 }; }
 * 	catchBody := f.NewBlock(f.NewNodeList([]*ast.Node{
 * 		f.NewExpressionStatement(
 * 			f.NewAssignmentExpression(
 * 				errorRecord,
 * 				f.NewObjectLiteralExpression(f.NewNodeList([]*ast.Node{
 * 					f.NewPropertyAssignment(nil, f.NewIdentifier("error"), nil, nil, catchVariable),
 * 				}), false),
 * 			),
 * 		),
 * 	}), false)
 * 	tx.EmitContext().AddEmitFlags(catchBody, printer.EFSingleLine)
 * 	catchClause := f.NewCatchClause(
 * 		f.NewVariableDeclaration(catchVariable, nil, nil, nil),
 * 		catchBody,
 * 	)
 *
 * 	// finally block
 * 	// inner try: if (!nonUserCode && !done && (returnMethod = iterator.return)) await returnMethod.call(iterator);
 * 	innerIfCondition := f.NewBinaryExpression(
 * 		nil,
 * 		f.NewBinaryExpression(
 * 			nil,
 * 			f.NewPrefixUnaryExpression(ast.KindExclamationToken, nonUserCode),
 * 			nil,
 * 			f.NewToken(ast.KindAmpersandAmpersandToken),
 * 			f.NewPrefixUnaryExpression(ast.KindExclamationToken, done),
 * 		),
 * 		nil,
 * 		f.NewToken(ast.KindAmpersandAmpersandToken),
 * 		f.NewAssignmentExpression(
 * 			returnMethod,
 * 			f.NewPropertyAccessExpression(iterator, nil, f.NewIdentifier("return"), ast.NodeFlagsNone),
 * 		),
 * 	)
 * 	innerIfStatement := f.NewIfStatement(
 * 		innerIfCondition,
 * 		f.NewExpressionStatement(tx.createDownlevelAwait(callReturn)),
 * 		nil,
 * 	)
 * 	tx.EmitContext().AddEmitFlags(innerIfStatement, printer.EFSingleLine)
 *
 * 	innerTryBlock := f.NewBlock(f.NewNodeList([]*ast.Node{innerIfStatement}), false)
 *
 * 	// inner finally: if (errorRecord) throw errorRecord.error;
 * 	innerFinallyIf := f.NewIfStatement(
 * 		errorRecord,
 * 		f.NewThrowStatement(
 * 			f.NewPropertyAccessExpression(errorRecord, nil, f.NewIdentifier("error"), ast.NodeFlagsNone),
 * 		),
 * 		nil,
 * 	)
 * 	tx.EmitContext().AddEmitFlags(innerFinallyIf, printer.EFSingleLine)
 * 	innerFinallyBlock := f.NewBlock(f.NewNodeList([]*ast.Node{innerFinallyIf}), false)
 * 	tx.EmitContext().AddEmitFlags(innerFinallyBlock, printer.EFSingleLine)
 *
 * 	innerTryStatement := f.NewTryStatement(innerTryBlock, nil, innerFinallyBlock)
 * 	finallyBlock := f.NewBlock(f.NewNodeList([]*ast.Node{innerTryStatement}), true)
 *
 * 	return f.NewTryStatement(tryBlock, catchClause, finallyBlock)
 * }
 */
export declare function forawaitTransformer_transformForAwaitOfStatement(receiver: GoPtr<forawaitTransformer>, node: GoPtr<ForInOrOfStatement>, outermostLabeledStatement: GoPtr<LabeledStatement>, ancestorFacts: forAwaitHierarchyFacts): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitConstructorDeclaration","kind":"method","status":"implemented","sigHash":"84d7a2aee78bd4ea221488935dcaa78d5cc7970c810bcfb178d847650ed00b9d","bodyHash":"3048a1b988050a93d2552d22e10c9487428e86698b09e9911fa0e73b3274bed1"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitConstructorDeclaration(node *ast.Node) *ast.Node {
 * 	decl := node.AsConstructorDeclaration()
 * 	savedEnclosingFunctionFlags := tx.enclosingFunctionFlags
 * 	tx.enclosingFunctionFlags = ast.GetFunctionFlags(node)
 * 	updated := tx.Factory().UpdateConstructorDeclaration(
 * 		decl,
 * 		decl.Modifiers(),
 * 		nil, /*typeParameters* /
 * 		tx.EmitContext().VisitParameters(decl.Parameters, tx.Visitor()),
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		tx.EmitContext().VisitFunctionBody(node.Body(), tx.Visitor()),
 * 	)
 * 	tx.enclosingFunctionFlags = savedEnclosingFunctionFlags
 * 	return updated
 * }
 */
export declare function forawaitTransformer_visitConstructorDeclaration(receiver: GoPtr<forawaitTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitGetAccessorDeclaration","kind":"method","status":"implemented","sigHash":"cf6a9c4b181aedcab41fa33fe9814f9f12a7f6166734071ac2c35ea99578818c","bodyHash":"4b237588146f019a3f37ee70deafaf7a48359cc3947145f82cee3737d952135e"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitGetAccessorDeclaration(node *ast.Node) *ast.Node {
 * 	decl := node.AsGetAccessorDeclaration()
 * 	savedEnclosingFunctionFlags := tx.enclosingFunctionFlags
 * 	tx.enclosingFunctionFlags = ast.GetFunctionFlags(node)
 * 	updated := tx.Factory().UpdateGetAccessorDeclaration(
 * 		decl,
 * 		decl.Modifiers(),
 * 		tx.Visitor().VisitNode(decl.Name()),
 * 		nil, /*typeParameters* /
 * 		tx.EmitContext().VisitParameters(decl.Parameters, tx.Visitor()),
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		tx.EmitContext().VisitFunctionBody(node.Body(), tx.Visitor()),
 * 	)
 * 	tx.enclosingFunctionFlags = savedEnclosingFunctionFlags
 * 	return updated
 * }
 */
export declare function forawaitTransformer_visitGetAccessorDeclaration(receiver: GoPtr<forawaitTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitSetAccessorDeclaration","kind":"method","status":"implemented","sigHash":"c18fd4c9fbe40b669fdfe1dc9c2d3dd752a598168ef0672d4b6c31cb22648a65","bodyHash":"7b37cc89e83a27a30f91dbfae2e6fc53dc9354fc184c7dcf5e68d5b360e50335"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitSetAccessorDeclaration(node *ast.Node) *ast.Node {
 * 	decl := node.AsSetAccessorDeclaration()
 * 	savedEnclosingFunctionFlags := tx.enclosingFunctionFlags
 * 	tx.enclosingFunctionFlags = ast.GetFunctionFlags(node)
 * 	updated := tx.Factory().UpdateSetAccessorDeclaration(
 * 		decl,
 * 		decl.Modifiers(),
 * 		tx.Visitor().VisitNode(decl.Name()),
 * 		nil, /*typeParameters* /
 * 		tx.EmitContext().VisitParameters(decl.Parameters, tx.Visitor()),
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		tx.EmitContext().VisitFunctionBody(node.Body(), tx.Visitor()),
 * 	)
 * 	tx.enclosingFunctionFlags = savedEnclosingFunctionFlags
 * 	return updated
 * }
 */
export declare function forawaitTransformer_visitSetAccessorDeclaration(receiver: GoPtr<forawaitTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitMethodDeclaration","kind":"method","status":"implemented","sigHash":"8b6d41736f3e85531abaf76efe180aba7580e73f3a8ff111ff6f136a5752749a","bodyHash":"dcb9baae6bea84f1f990f1b61d5950d6c5de1c55186c2258c77fbe6b0f78b2ac"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitMethodDeclaration(node *ast.Node) *ast.Node {
 * 	decl := node.AsMethodDeclaration()
 * 	savedEnclosingFunctionFlags := tx.enclosingFunctionFlags
 * 	tx.enclosingFunctionFlags = ast.GetFunctionFlags(node)
 *
 * 	var modifiers *ast.ModifierList
 * 	if tx.enclosingFunctionFlags&ast.FunctionFlagsGenerator != 0 {
 * 		modifiers = tx.visitModifiersNoAsync(decl.Modifiers())
 * 	} else {
 * 		modifiers = decl.Modifiers()
 * 	}
 *
 * 	var asteriskToken *ast.TokenNode
 * 	if tx.enclosingFunctionFlags&ast.FunctionFlagsAsync != 0 {
 * 		asteriskToken = nil
 * 	} else {
 * 		asteriskToken = decl.AsteriskToken
 * 	}
 *
 * 	var parameters *ast.NodeList
 * 	var body *ast.Node
 * 	if tx.enclosingFunctionFlags&ast.FunctionFlagsAsync != 0 && tx.enclosingFunctionFlags&ast.FunctionFlagsGenerator != 0 {
 * 		parameters = tx.transformAsyncGeneratorFunctionParameterList(node)
 * 		body = tx.transformAsyncGeneratorFunctionBody(node)
 * 	} else {
 * 		parameters = tx.EmitContext().VisitParameters(decl.Parameters, tx.Visitor())
 * 		body = tx.EmitContext().VisitFunctionBody(node.Body(), tx.Visitor())
 * 	}
 *
 * 	updated := tx.Factory().UpdateMethodDeclaration(
 * 		decl,
 * 		modifiers,
 * 		asteriskToken,
 * 		tx.Visitor().VisitNode(decl.Name()),
 * 		nil, /*postfixToken* /
 * 		nil, /*typeParameters* /
 * 		parameters,
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		body,
 * 	)
 * 	tx.enclosingFunctionFlags = savedEnclosingFunctionFlags
 * 	return updated
 * }
 */
export declare function forawaitTransformer_visitMethodDeclaration(receiver: GoPtr<forawaitTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitFunctionDeclaration","kind":"method","status":"implemented","sigHash":"a6f77f32f15059617c93d8e5b2316dbd006f748462d02000992727dd52354db3","bodyHash":"ce0effd342f2be75137dd91b06a15e03c1212fc57f5e8342f60372d86e5598e9"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitFunctionDeclaration(node *ast.Node) *ast.Node {
 * 	decl := node.AsFunctionDeclaration()
 * 	savedEnclosingFunctionFlags := tx.enclosingFunctionFlags
 * 	tx.enclosingFunctionFlags = ast.GetFunctionFlags(node)
 *
 * 	var modifiers *ast.ModifierList
 * 	if tx.enclosingFunctionFlags&ast.FunctionFlagsGenerator != 0 {
 * 		modifiers = tx.visitModifiersNoAsync(decl.Modifiers())
 * 	} else {
 * 		modifiers = decl.Modifiers()
 * 	}
 *
 * 	var asteriskToken *ast.TokenNode
 * 	if tx.enclosingFunctionFlags&ast.FunctionFlagsAsync != 0 {
 * 		asteriskToken = nil
 * 	} else {
 * 		asteriskToken = decl.AsteriskToken
 * 	}
 *
 * 	var parameters *ast.NodeList
 * 	var body *ast.Node
 * 	if tx.enclosingFunctionFlags&ast.FunctionFlagsAsync != 0 && tx.enclosingFunctionFlags&ast.FunctionFlagsGenerator != 0 {
 * 		parameters = tx.transformAsyncGeneratorFunctionParameterList(node)
 * 		body = tx.transformAsyncGeneratorFunctionBody(node)
 * 	} else {
 * 		parameters = tx.EmitContext().VisitParameters(decl.Parameters, tx.Visitor())
 * 		body = tx.EmitContext().VisitFunctionBody(node.Body(), tx.Visitor())
 * 	}
 *
 * 	updated := tx.Factory().UpdateFunctionDeclaration(
 * 		decl,
 * 		modifiers,
 * 		asteriskToken,
 * 		decl.Name(),
 * 		nil, /*typeParameters* /
 * 		parameters,
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		body,
 * 	)
 * 	tx.enclosingFunctionFlags = savedEnclosingFunctionFlags
 * 	return updated
 * }
 */
export declare function forawaitTransformer_visitFunctionDeclaration(receiver: GoPtr<forawaitTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitArrowFunction","kind":"method","status":"implemented","sigHash":"de192b55a77cb0b1a39913549467f1fcf02686a4f8644360d29ce1ea316304b7","bodyHash":"0b221d2fb125c9a400004b730ffd4a5a9edb23b9cf0bd1aa51c0eeb54fa0a421"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitArrowFunction(node *ast.Node) *ast.Node {
 * 	decl := node.AsArrowFunction()
 * 	savedEnclosingFunctionFlags := tx.enclosingFunctionFlags
 * 	tx.enclosingFunctionFlags = ast.GetFunctionFlags(node)
 * 	updated := tx.Factory().UpdateArrowFunction(
 * 		decl,
 * 		decl.Modifiers(),
 * 		nil, /*typeParameters* /
 * 		tx.EmitContext().VisitParameters(decl.Parameters, tx.Visitor()),
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		decl.EqualsGreaterThanToken,
 * 		tx.EmitContext().VisitFunctionBody(node.Body(), tx.Visitor()),
 * 	)
 * 	tx.enclosingFunctionFlags = savedEnclosingFunctionFlags
 * 	return updated
 * }
 */
export declare function forawaitTransformer_visitArrowFunction(receiver: GoPtr<forawaitTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.visitFunctionExpression","kind":"method","status":"implemented","sigHash":"89a9d83a81306d912ca33736601d12811430c7c9cbefd8f07dbfc3fff65d12a4","bodyHash":"3c81ad12ea674cc2e7a0fc24eebc9059bfb18f573472877c6cf53c2b365125f1"}
 *
 * Go source:
 * func (tx *forawaitTransformer) visitFunctionExpression(node *ast.Node) *ast.Node {
 * 	decl := node.AsFunctionExpression()
 * 	savedEnclosingFunctionFlags := tx.enclosingFunctionFlags
 * 	tx.enclosingFunctionFlags = ast.GetFunctionFlags(node)
 *
 * 	var modifiers *ast.ModifierList
 * 	if tx.enclosingFunctionFlags&ast.FunctionFlagsGenerator != 0 {
 * 		modifiers = tx.visitModifiersNoAsync(decl.Modifiers())
 * 	} else {
 * 		modifiers = decl.Modifiers()
 * 	}
 *
 * 	var asteriskToken *ast.TokenNode
 * 	if tx.enclosingFunctionFlags&ast.FunctionFlagsAsync != 0 {
 * 		asteriskToken = nil
 * 	} else {
 * 		asteriskToken = decl.AsteriskToken
 * 	}
 *
 * 	var parameters *ast.NodeList
 * 	var body *ast.Node
 * 	if tx.enclosingFunctionFlags&ast.FunctionFlagsAsync != 0 && tx.enclosingFunctionFlags&ast.FunctionFlagsGenerator != 0 {
 * 		parameters = tx.transformAsyncGeneratorFunctionParameterList(node)
 * 		body = tx.transformAsyncGeneratorFunctionBody(node)
 * 	} else {
 * 		parameters = tx.EmitContext().VisitParameters(decl.Parameters, tx.Visitor())
 * 		body = tx.EmitContext().VisitFunctionBody(node.Body(), tx.Visitor())
 * 	}
 *
 * 	updated := tx.Factory().UpdateFunctionExpression(
 * 		decl,
 * 		modifiers,
 * 		asteriskToken,
 * 		decl.Name(),
 * 		nil, /*typeParameters* /
 * 		parameters,
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		body,
 * 	)
 * 	tx.enclosingFunctionFlags = savedEnclosingFunctionFlags
 * 	return updated
 * }
 */
export declare function forawaitTransformer_visitFunctionExpression(receiver: GoPtr<forawaitTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.transformAsyncGeneratorFunctionParameterList","kind":"method","status":"implemented","sigHash":"9394db53c65477d17dc400a302912bc0af2d910325e85b98417fc02dae8dfd1c","bodyHash":"23d50ba7b11d3177c715523bb880083c6d7271a6f4db0bb017a65b23a2ac267f"}
 *
 * Go source:
 * func (tx *forawaitTransformer) transformAsyncGeneratorFunctionParameterList(node *ast.Node) *ast.NodeList {
 * 	if isSimpleParameterList(node.Parameters()) {
 * 		return tx.EmitContext().VisitParameters(node.ParameterList(), tx.Visitor())
 * 	}
 * 	// Add fixed parameters to preserve the function's `length` property.
 * 	var newParameters []*ast.Node
 * 	for _, parameter := range node.Parameters() {
 * 		param := parameter.AsParameterDeclaration()
 * 		if param.Initializer != nil || param.DotDotDotToken != nil {
 * 			break
 * 		}
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
export declare function forawaitTransformer_transformAsyncGeneratorFunctionParameterList(receiver: GoPtr<forawaitTransformer>, node: GoPtr<Node>): GoPtr<NodeList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/forawait.go::method::forawaitTransformer.transformAsyncGeneratorFunctionBody","kind":"method","status":"implemented","sigHash":"992b27dd2a7dd18af05dab61a71b0acb1e31eb02068b6f3920758ce67dfaf1c3","bodyHash":"11c6e177b6d679e748eeba4186d5694950740b5e9c548883ab3a446b85f3c716"}
 *
 * Go source:
 * func (tx *forawaitTransformer) transformAsyncGeneratorFunctionBody(node *ast.Node) *ast.Node {
 * 	f := tx.Factory()
 * 	var innerParameters *ast.NodeList
 * 	if !isSimpleParameterList(node.Parameters()) {
 * 		innerParameters = tx.EmitContext().VisitParameters(node.ParameterList(), tx.Visitor())
 * 	}
 *
 * 	savedCapturedSuperProperties := tx.capturedSuperProperties
 * 	savedHasSuperElementAccess := tx.hasSuperElementAccess
 * 	savedHasSuperPropertyAssignment := tx.hasSuperPropertyAssignment
 * 	savedSuperBinding := tx.superBinding
 * 	savedSuperIndexBinding := tx.superIndexBinding
 * 	tx.capturedSuperProperties = &collections.OrderedSet[string]{}
 * 	tx.hasSuperElementAccess = false
 * 	tx.hasSuperPropertyAssignment = false
 * 	tx.superBinding = f.NewUniqueNameEx("_super", printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel})
 * 	tx.superIndexBinding = f.NewUniqueNameEx("_superIndex", printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsFileLevel})
 *
 * 	asyncBody := f.UpdateBlock(
 * 		node.Body().AsBlock(),
 * 		tx.Visitor().VisitNodes(node.Body().StatementList()),
 * 		node.Body().AsBlock().MultiLine,
 * 	)
 * 	asyncBody = f.UpdateBlock(
 * 		asyncBody.AsBlock(),
 * 		tx.EmitContext().EndAndMergeVariableEnvironmentList(asyncBody.StatementList()),
 * 		asyncBody.AsBlock().MultiLine,
 * 	)
 *
 * 	// Substitute super property accesses with _super/_superIndex helpers
 * 	emitSuperHelpers := tx.capturedSuperProperties.Size() > 0 || tx.hasSuperElementAccess
 * 	if emitSuperHelpers {
 * 		asyncBody = tx.substituteSuperAccessesInBody(asyncBody)
 * 	}
 *
 * 	var innerParams *ast.NodeList
 * 	if innerParameters != nil {
 * 		innerParams = innerParameters
 * 	} else {
 * 		innerParams = f.NewNodeList([]*ast.Node{})
 * 	}
 *
 * 	var name *ast.Node
 * 	if node.Name() != nil {
 * 		name = f.NewGeneratedNameForNode(node.Name())
 * 	}
 *
 * 	generatorFunc := f.NewFunctionExpression(
 * 		nil, /*modifiers* /
 * 		f.NewToken(ast.KindAsteriskToken),
 * 		name,
 * 		nil, /*typeParameters* /
 * 		innerParams,
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		asyncBody,
 * 	)
 *
 * 	returnStatement := f.NewReturnStatement(
 * 		f.NewAsyncGeneratorHelper(
 * 			generatorFunc,
 * 			tx.forAwaitHierarchyFacts&forAwaitHierarchyFactsHasLexicalThis != 0,
 * 		),
 * 	)
 *
 * 	tx.EmitContext().StartVariableEnvironment()
 * 	if emitSuperHelpers {
 * 		if tx.capturedSuperProperties.Size() > 0 {
 * 			tx.EmitContext().AddInitializationStatement(tx.createSuperAccessVariableStatement())
 * 		}
 * 	}
 *
 * 	outerStatements := []*ast.Node{returnStatement}
 *
 * 	block := f.UpdateBlock(
 * 		node.Body().AsBlock(),
 * 		tx.EmitContext().EndAndMergeVariableEnvironmentList(f.NewNodeList(outerStatements)),
 * 		node.Body().AsBlock().MultiLine,
 * 	)
 *
 * 	if emitSuperHelpers && tx.hasSuperElementAccess {
 * 		if tx.hasSuperPropertyAssignment {
 * 			tx.EmitContext().AddEmitHelper(block, printer.AdvancedAsyncSuperHelper)
 * 		} else {
 * 			tx.EmitContext().AddEmitHelper(block, printer.AsyncSuperHelper)
 * 		}
 * 	}
 *
 * 	tx.capturedSuperProperties = savedCapturedSuperProperties
 * 	tx.hasSuperElementAccess = savedHasSuperElementAccess
 * 	tx.hasSuperPropertyAssignment = savedHasSuperPropertyAssignment
 * 	tx.superBinding = savedSuperBinding
 * 	tx.superIndexBinding = savedSuperIndexBinding
 *
 * 	return block
 * }
 */
export declare function forawaitTransformer_transformAsyncGeneratorFunctionBody(receiver: GoPtr<forawaitTransformer>, node: GoPtr<Node>): GoPtr<Node>;
//# sourceMappingURL=forawait.d.ts.map