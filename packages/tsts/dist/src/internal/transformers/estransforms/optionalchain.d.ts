import type { bool } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { CallExpression, DeleteExpression, ParenthesizedExpression } from "../../ast/generated/data.js";
import type { Expression } from "../../ast/generated/unions.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::type::optionalChainTransformer","kind":"type","status":"implemented","sigHash":"d38d23852b1698ae2acf33196bbbfcae52ccc17ab55d3fedbb0a02da11237873","bodyHash":"10b20e1c69798f894fafbbc4c1e6f26faa1771126b608bea5b7823d5d73c2fd9"}
 *
 * Go source:
 * optionalChainTransformer struct {
 * 	transformers.Transformer
 * }
 */
export interface optionalChainTransformer {
    readonly __tsgoEmbedded0?: Transformer;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::method::optionalChainTransformer.visit","kind":"method","status":"implemented","sigHash":"dbb11e0033208825634aece952d75819462fbb7c6e8d785fca71f6caacf62093","bodyHash":"9f78a1f31c76bb8b8b79810c44e5e073547a39ede886ac9c6135895e87efb98c"}
 *
 * Go source:
 * func (ch *optionalChainTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.SubtreeFacts()&ast.SubtreeContainsOptionalChaining == 0 {
 * 		return node
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindCallExpression:
 * 		return ch.visitCallExpression(node.AsCallExpression(), false)
 * 	case ast.KindPropertyAccessExpression,
 * 		ast.KindElementAccessExpression:
 * 		if node.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 			return ch.visitOptionalExpression(node, false, false)
 * 		}
 * 		return ch.Visitor().VisitEachChild(node)
 * 	case ast.KindDeleteExpression:
 * 		return ch.visitDeleteExpression(node.AsDeleteExpression())
 * 	default:
 * 		return ch.Visitor().VisitEachChild(node)
 * 	}
 * }
 */
export declare function optionalChainTransformer_visit(receiver: GoPtr<optionalChainTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::method::optionalChainTransformer.visitCallExpression","kind":"method","status":"implemented","sigHash":"8e52b576b86b10d39a329d1c7115fe17d6f6f744b1c1e9bcf38367f964754ff0","bodyHash":"1e99d888a3323ecca2ee93c729d2dae1c636535ce8329b72c39f7246f515a068"}
 *
 * Go source:
 * func (ch *optionalChainTransformer) visitCallExpression(node *ast.CallExpression, captureThisArg bool) *ast.Node {
 * 	if node.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 		// If `node` is an optional chain, then it is the outermost chain of an optional expression.
 * 		return ch.visitOptionalExpression(node.AsNode(), captureThisArg, false)
 * 	}
 * 	if ast.IsParenthesizedExpression(node.Expression) {
 * 		unwrapped := ast.SkipParentheses(node.Expression)
 * 		if unwrapped.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 			// capture thisArg for calls of parenthesized optional chains like `(foo?.bar)()`
 * 			expression := ch.visitParenthesizedExpression(node.Expression.AsParenthesizedExpression(), true, false)
 * 			args := ch.Visitor().VisitNodes(node.Arguments)
 * 			if ast.IsSyntheticReferenceExpression(expression) {
 * 				res := ch.Factory().NewFunctionCallCall(expression.AsSyntheticReferenceExpression().Expression, expression.AsSyntheticReferenceExpression().ThisArg, args.Nodes)
 * 				res.Loc = node.Loc
 * 				ch.EmitContext().SetOriginal(res, node.AsNode())
 * 				return res
 * 			}
 * 			return ch.Factory().UpdateCallExpression(node, expression, nil /*questionDotToken* /, nil /*typeArguments* /, args, node.Flags)
 * 		}
 * 	}
 * 	return ch.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function optionalChainTransformer_visitCallExpression(receiver: GoPtr<optionalChainTransformer>, node: GoPtr<CallExpression>, captureThisArg: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::method::optionalChainTransformer.visitParenthesizedExpression","kind":"method","status":"implemented","sigHash":"d08a7e3ba35bf3d75a14002752b47a96a6ffcabcf1c0d624421089772abdaef9","bodyHash":"b860e7e7b05a15d0ede33fa53d14bbc1f37a2e10cd466d46c5eba65c29736ab0"}
 *
 * Go source:
 * func (ch *optionalChainTransformer) visitParenthesizedExpression(node *ast.ParenthesizedExpression, captureThisArg bool, isDelete bool) *ast.Node {
 * 	expr := ch.visitNonOptionalExpression(node.Expression, captureThisArg, isDelete)
 * 	if ast.IsSyntheticReferenceExpression(expr) {
 * 		// `(a.b)` -> { expression `((_a = a).b)`, thisArg: `_a` }
 * 		// `(a[b])` -> { expression `((_a = a)[b])`, thisArg: `_a` }
 * 		synth := expr.AsSyntheticReferenceExpression()
 * 		res := ch.Factory().NewSyntheticReferenceExpression(ch.Factory().UpdateParenthesizedExpression(node, synth.Expression), synth.ThisArg)
 * 		ch.EmitContext().SetOriginal(res, node.AsNode())
 * 		return res
 * 	}
 * 	return ch.Factory().UpdateParenthesizedExpression(node, expr)
 * }
 */
export declare function optionalChainTransformer_visitParenthesizedExpression(receiver: GoPtr<optionalChainTransformer>, node: GoPtr<ParenthesizedExpression>, captureThisArg: bool, isDelete: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::method::optionalChainTransformer.visitPropertyOrElementAccessExpression","kind":"method","status":"implemented","sigHash":"0e4be773ba8ce1f858b94c481a9730d55fa8b72d4183a4924499106221ad6e1e","bodyHash":"d1bbdb71cf54834188bfca5c199b04cc2eac463295e05c2c40481e90ae6515bd"}
 *
 * Go source:
 * func (ch *optionalChainTransformer) visitPropertyOrElementAccessExpression(node *ast.Expression, captureThisArg bool, isDelete bool) *ast.Expression {
 * 	if node.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 		// If `node` is an optional chain, then it is the outermost chain of an optional expression.
 * 		return ch.visitOptionalExpression(node.AsNode(), captureThisArg, isDelete)
 * 	}
 * 	expression := ch.Visitor().VisitNode(node.Expression())
 * 	debug.Assert(expression == nil || !ast.IsSyntheticReferenceExpression(expression))
 *
 * 	var thisArg *ast.Expression
 * 	if captureThisArg {
 * 		if !transformers.IsSimpleCopiableExpression(expression) {
 * 			thisArg = ch.Factory().NewTempVariable()
 * 			ch.EmitContext().AddVariableDeclaration(thisArg)
 * 			expression = ch.Factory().NewAssignmentExpression(thisArg, expression)
 * 		} else {
 * 			thisArg = expression
 * 		}
 * 	}
 *
 * 	if node.Kind == ast.KindPropertyAccessExpression {
 * 		p := node.AsPropertyAccessExpression()
 * 		expression = ch.Factory().UpdatePropertyAccessExpression(p, expression, nil /*questionDotToken* /, ch.Visitor().VisitNode(p.Name()), p.Flags)
 * 	} else {
 * 		p := node.AsElementAccessExpression()
 * 		expression = ch.Factory().UpdateElementAccessExpression(p, expression, nil, ch.Visitor().VisitNode(p.AsElementAccessExpression().ArgumentExpression), p.Flags)
 * 	}
 *
 * 	if thisArg != nil {
 * 		res := ch.Factory().NewSyntheticReferenceExpression(expression, thisArg)
 * 		ch.EmitContext().SetOriginal(res, node.AsNode())
 * 		return res
 * 	}
 * 	return expression
 * }
 */
export declare function optionalChainTransformer_visitPropertyOrElementAccessExpression(receiver: GoPtr<optionalChainTransformer>, node: GoPtr<Expression>, captureThisArg: bool, isDelete: bool): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::method::optionalChainTransformer.visitDeleteExpression","kind":"method","status":"implemented","sigHash":"ecff27c43020084217a3ce4eb5892931fb7163ca3a6c46910b18501143e0c88a","bodyHash":"a464412ab36bfc37ceb5624a56e09fdef1ee428eb955bd908e96be4b49e8b200"}
 *
 * Go source:
 * func (ch *optionalChainTransformer) visitDeleteExpression(node *ast.DeleteExpression) *ast.Node {
 * 	unwrapped := ast.SkipParentheses(node.Expression)
 * 	if unwrapped.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 		return ch.visitNonOptionalExpression(node.Expression, false, true)
 * 	}
 * 	return ch.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function optionalChainTransformer_visitDeleteExpression(receiver: GoPtr<optionalChainTransformer>, node: GoPtr<DeleteExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::method::optionalChainTransformer.visitNonOptionalExpression","kind":"method","status":"implemented","sigHash":"3f9ab6a96fbc99844d4abd3b579deb944cf64b8f779cfde9e14bc2e14ac26db1","bodyHash":"ed923f7442c7ec212e9496ca7f44f1b20775897473a206d14723ea8ade578cec"}
 *
 * Go source:
 * func (ch *optionalChainTransformer) visitNonOptionalExpression(node *ast.Expression, captureThisArg bool, isDelete bool) *ast.Expression {
 * 	switch node.Kind {
 * 	case ast.KindParenthesizedExpression:
 * 		return ch.visitParenthesizedExpression(node.AsParenthesizedExpression(), captureThisArg, isDelete)
 * 	case ast.KindElementAccessExpression, ast.KindPropertyAccessExpression:
 * 		return ch.visitPropertyOrElementAccessExpression(node, captureThisArg, isDelete)
 * 	case ast.KindCallExpression:
 * 		return ch.visitCallExpression(node.AsCallExpression(), captureThisArg)
 * 	default:
 * 		return ch.Visitor().VisitNode(node.AsNode())
 * 	}
 * }
 */
export declare function optionalChainTransformer_visitNonOptionalExpression(receiver: GoPtr<optionalChainTransformer>, node: GoPtr<Expression>, captureThisArg: bool, isDelete: bool): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::type::flattenResult","kind":"type","status":"implemented","sigHash":"3e6c9bbcacabbb8224fae64714c1e84d2fb7c5a4451bb47747312943363477bf","bodyHash":"126af5dbbb83b6513dce8bd36b01f8f0bed6be9d583cc0bc757ff61e5e587790"}
 *
 * Go source:
 * flattenResult struct {
 * 	expression *ast.Expression
 * 	chain      []*ast.Node
 * }
 */
export interface flattenResult {
    expression: GoPtr<Expression>;
    chain: GoSlice<GoPtr<Node>>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::func::isNonNullChain","kind":"func","status":"implemented","sigHash":"e0b4568e2ce0258afd2f552f9873d429a7766f9f06d50ce6ed39de300a0bf561","bodyHash":"c295cb1694d9848b5367fc6f625b2b5213ec0531614d57f921a91235c062106b"}
 *
 * Go source:
 * func isNonNullChain(node *ast.Node) bool {
 * 	return ast.IsNonNullExpression(node) && node.Flags&ast.NodeFlagsOptionalChain != 0
 * }
 */
export declare function isNonNullChain(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::func::flattenChain","kind":"func","status":"implemented","sigHash":"d6e09ae3909143e2579daf7ad3d6ea00b6bae59f6e433c0682e34e13a2afe0f9","bodyHash":"1f3670a7ee716151575ee2b95c8342fb8bdcbafed9787e1d486046b506a171ec"}
 *
 * Go source:
 * func flattenChain(chain *ast.Node) flattenResult {
 * 	debug.Assert(!isNonNullChain(chain))
 * 	links := []*ast.Node{chain}
 * 	for !ast.IsTaggedTemplateExpression(chain) && chain.QuestionDotToken() == nil {
 * 		chain = ast.SkipPartiallyEmittedExpressions(chain.Expression())
 * 		debug.Assert(!isNonNullChain(chain))
 * 		links = append([]*ast.Node{chain}, links...)
 * 	}
 * 	return flattenResult{chain.Expression(), links}
 * }
 */
export declare function flattenChain(chain: GoPtr<Node>): flattenResult;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::func::isCallChain","kind":"func","status":"implemented","sigHash":"86b2ae21ffee1c312ea7ea061f782a06855803fada2bbb1f9b83c23840bafc9a","bodyHash":"18ac8f0180a6246c8cd91f949cd8c5bbc4793dee9f4ace217eb7cff5aabc8038"}
 *
 * Go source:
 * func isCallChain(node *ast.Node) bool {
 * 	return ast.IsCallExpression(node) && node.Flags&ast.NodeFlagsOptionalChain != 0
 * }
 */
export declare function isCallChain(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::method::optionalChainTransformer.visitOptionalExpression","kind":"method","status":"implemented","sigHash":"e65de19f41c10f036300881c45dfd469cbc92b8c4ad23a1e49207799ac524d11","bodyHash":"9ab21c6b97a9426377bfc20a1eb85e2eade41f1dbf791dd56cf5862283b31e1f"}
 *
 * Go source:
 * func (ch *optionalChainTransformer) visitOptionalExpression(node *ast.Node, captureThisArg bool, isDelete bool) *ast.Node {
 * 	r := flattenChain(node)
 * 	expression := r.expression
 * 	chain := r.chain
 * 	left := ch.visitNonOptionalExpression(ast.SkipPartiallyEmittedExpressions(expression), isCallChain(chain[0]), false)
 * 	var leftThisArg *ast.Expression
 * 	capturedLeft := left
 * 	if ast.IsSyntheticReferenceExpression(left) {
 * 		leftThisArg = left.AsSyntheticReferenceExpression().ThisArg
 * 		capturedLeft = left.AsSyntheticReferenceExpression().Expression
 * 	}
 * 	leftExpression := ch.Factory().RestoreOuterExpressions(expression, capturedLeft, ast.OEKPartiallyEmittedExpressions)
 * 	if !transformers.IsSimpleCopiableExpression(capturedLeft) {
 * 		capturedLeft = ch.Factory().NewTempVariable()
 * 		ch.EmitContext().AddVariableDeclaration(capturedLeft)
 * 		leftExpression = ch.Factory().NewAssignmentExpression(capturedLeft, leftExpression)
 * 	}
 * 	rightExpression := capturedLeft
 * 	var thisArg *ast.Expression
 *
 * 	for i, segment := range chain {
 * 		switch segment.Kind {
 * 		case ast.KindElementAccessExpression, ast.KindPropertyAccessExpression:
 * 			if i == len(chain)-1 && captureThisArg {
 * 				if !transformers.IsSimpleCopiableExpression(rightExpression) {
 * 					thisArg = ch.Factory().NewTempVariable()
 * 					ch.EmitContext().AddVariableDeclaration(thisArg)
 * 					rightExpression = ch.Factory().NewAssignmentExpression(thisArg, rightExpression)
 * 				} else {
 * 					thisArg = rightExpression
 * 				}
 * 			}
 * 			if segment.Kind == ast.KindElementAccessExpression {
 * 				rightExpression = ch.Factory().NewElementAccessExpression(rightExpression, nil, ch.Visitor().VisitNode(segment.AsElementAccessExpression().ArgumentExpression), ast.NodeFlagsNone)
 * 			} else {
 * 				rightExpression = ch.Factory().NewPropertyAccessExpression(rightExpression, nil, ch.Visitor().VisitNode(segment.AsPropertyAccessExpression().Name()), ast.NodeFlagsNone)
 * 			}
 * 		case ast.KindCallExpression:
 * 			if i == 0 && leftThisArg != nil {
 * 				if !ch.EmitContext().HasAutoGenerateInfo(leftThisArg) {
 * 					leftThisArg = leftThisArg.Clone(ch.Factory())
 * 					ch.EmitContext().AddEmitFlags(leftThisArg, printer.EFNoComments)
 * 				}
 * 				callThisArg := leftThisArg
 * 				if leftThisArg.Kind == ast.KindSuperKeyword {
 * 					callThisArg = ch.Factory().NewThisExpression()
 * 				}
 * 				rightExpression = ch.Factory().NewFunctionCallCall(rightExpression, callThisArg, ch.Visitor().VisitNodes(segment.ArgumentList()).Nodes)
 * 			} else {
 * 				rightExpression = ch.Factory().NewCallExpression(
 * 					rightExpression,
 * 					nil,
 * 					nil,
 * 					ch.Visitor().VisitNodes(segment.ArgumentList()),
 * 					ast.NodeFlagsNone,
 * 				)
 * 			}
 * 		}
 * 		ch.EmitContext().SetOriginal(rightExpression, segment)
 * 	}
 *
 * 	var target *ast.Node
 * 	if isDelete {
 * 		target = ch.Factory().NewConditionalExpression(
 * 			createNotNullCondition(ch.EmitContext(), leftExpression, capturedLeft, true),
 * 			ch.Factory().NewToken(ast.KindQuestionToken),
 * 			ch.Factory().NewTrueExpression(),
 * 			ch.Factory().NewToken(ast.KindColonToken),
 * 			ch.Factory().NewDeleteExpression(rightExpression),
 * 		)
 * 	} else {
 * 		target = ch.Factory().NewConditionalExpression(
 * 			createNotNullCondition(ch.EmitContext(), leftExpression, capturedLeft, true),
 * 			ch.Factory().NewToken(ast.KindQuestionToken),
 * 			ch.Factory().NewVoidZeroExpression(),
 * 			ch.Factory().NewToken(ast.KindColonToken),
 * 			rightExpression,
 * 		)
 * 	}
 * 	target.Loc = node.Loc
 * 	if thisArg != nil {
 * 		target = ch.Factory().NewSyntheticReferenceExpression(target, thisArg)
 * 	}
 * 	ch.EmitContext().SetOriginal(target, node.AsNode())
 * 	return target
 * }
 */
export declare function optionalChainTransformer_visitOptionalExpression(receiver: GoPtr<optionalChainTransformer>, node: GoPtr<Node>, captureThisArg: bool, isDelete: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::func::newOptionalChainTransformer","kind":"func","status":"implemented","sigHash":"cbad995a2b745db86987da159e9e4ea78e4faa8ef2f0a4ce7f2dd39c3895a899","bodyHash":"99abb9eb2b2142fb47eaa44e3d7a30dd4037b0e4cf1ab349adcd6975c1d0f439"}
 *
 * Go source:
 * func newOptionalChainTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &optionalChainTransformer{}
 * 	return tx.NewTransformer(tx.visit, opts.Context)
 * }
 */
export declare function newOptionalChainTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer>;
//# sourceMappingURL=optionalchain.d.ts.map